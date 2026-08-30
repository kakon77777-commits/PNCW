import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`

async function fixture(policy={kind:'LEXICOGRAPHIC',objectiveOrder:['latency']}){
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidateA=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/A',
    observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:A',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',planningClass:'route-a',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'100'}}]},
    objectiveObservations:[
      {objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.2'}},
      {objectiveId:'quality',direction:'MAXIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.5'}},
    ],
  })
  const candidateB=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/B',
    observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:B',regionRefs:['relation:block-row:1']},requestedMode:'machine_carrier',planningClass:'route-b',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'200'}}]},
    objectiveObservations:[
      {objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.4'}},
      {objectiveId:'quality',direction:'MAXIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.9'}},
    ],
  })
  const budget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'500'}}})
  const candidateSetDigest=p.deriveCandidateSetDigest([candidateA,candidateB])
  const policyDigest=p.derivePolicyDigest(policy)
  const frozen=p.buildFrozenPlanningInputRef({schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:test',snapshotDigest:D1,gcmPlanningAuthorityDigest:D2,candidateSetDigest,budgetDigest:p.deriveBudgetDigest(budget),policyDigest,provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1'})
  const request=p.buildProjectionPlanningRequest({schema:'pncw-projection-planning-request/v1',candidates:[candidateA,candidateB],budget,selectionPolicy:policy,authorityContext:{principalId:'principal:test',sourceRead:true,surfaceProject:true},frozenInputRef:frozen})
  return {p,candidateA,candidateB,budget,frozen,request,input:{planningRequestId:request.planningRequestId,candidates:request.candidates,budget:request.budget,selectionPolicy:request.selectionPolicy,frozenInputRef:request.frozenInputRef}}
}

test('GCM planning port exposes no PNCW authority surface', async () => {
  const source=await readFile('packages/gcm-adapter-port/src/index.ts','utf8')
  for(const token of ['AuthorityContextV1','sourceRead','surfaceProject','commitAuthority','writerCapability']){
    assert.equal(source.includes(token),false,`${token} must not appear in GCM planning port`)
  }
})

test('fake GCM selects lexicographically and ignores candidate container order', async () => {
  const { FakeGcmPhaseBAdapter }=await import('../../dist/adapters/fake-gcm-phase-b/src/index.js')
  const {candidateA,input}=await fixture()
  const adapter=new FakeGcmPhaseBAdapter()
  const first=await adapter.plan(input)
  const second=await adapter.plan({...input,candidates:[...input.candidates].reverse()})
  assert.equal(first.selectedCandidateId,candidateA.candidateId)
  assert.equal(second.selectedCandidateId,candidateA.candidateId)
  assert.equal(first.planSnapshotDigest,second.planSnapshotDigest)
  assert.deepEqual(first.feasibleCandidateIds,second.feasibleCandidateIds)
})

test('fake GCM weighted selection uses explicit unit-interval policy deterministically', async () => {
  const { FakeGcmPhaseBAdapter }=await import('../../dist/adapters/fake-gcm-phase-b/src/index.js')
  const policy={kind:'WEIGHTED',weights:{latency:'1',quality:'4'},normalizationProfile:'pncw:unit-interval/v1'}
  const {candidateB,input}=await fixture(policy)
  const plan=await new FakeGcmPhaseBAdapter().plan(input)
  assert.equal(plan.selectedCandidateId,candidateB.candidateId)
})

test('fake GCM reports deterministic conformance and fails when no candidate is feasible', async () => {
  const { FakeGcmPhaseBAdapter }=await import('../../dist/adapters/fake-gcm-phase-b/src/index.js')
  const {input,p}=await fixture()
  const adapter=new FakeGcmPhaseBAdapter()
  const conformance=await adapter.conformanceIdentity()
  assert.equal(conformance.claim,'CONFORMANT')
  assert.equal(conformance.profileId,'PNCW-FAKE-GCM-R0-M4')
  const tinyBudget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'1'}}})
  const tinyFrozen=p.buildFrozenPlanningInputRef({schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:tiny',snapshotDigest:D1,gcmPlanningAuthorityDigest:D2,candidateSetDigest:p.deriveCandidateSetDigest(input.candidates),budgetDigest:p.deriveBudgetDigest(tinyBudget),policyDigest:p.derivePolicyDigest(input.selectionPolicy),provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1'})
  const tinyRequest=p.buildProjectionPlanningRequest({schema:'pncw-projection-planning-request/v1',candidates:input.candidates,budget:tinyBudget,selectionPolicy:input.selectionPolicy,authorityContext:{principalId:'not-forwarded',sourceRead:false,surfaceProject:false},frozenInputRef:tinyFrozen})
  await assert.rejects(()=>adapter.plan({planningRequestId:tinyRequest.planningRequestId,candidates:tinyRequest.candidates,budget:tinyRequest.budget,selectionPolicy:tinyRequest.selectionPolicy,frozenInputRef:tinyRequest.frozenInputRef}),error=>error?.failure?.code==='NO_FEASIBLE_PLAN')
})

test('fake replan reruns fresh feasibility and binds deterministic lineage', async () => {
  const { FakeGcmPhaseBAdapter }=await import('../../dist/adapters/fake-gcm-phase-b/src/index.js')
  const {p,candidateA,candidateB,input}=await fixture()
  const adapter=new FakeGcmPhaseBAdapter()
  const original=await adapter.plan(input)
  const freshBudget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'150'}}})
  const freshCandidateSet=p.deriveCandidateSetDigest([candidateA,candidateB])
  const freshFrozen=p.buildFrozenPlanningInputRef({schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:fresh',snapshotDigest:D2,gcmPlanningAuthorityDigest:D1,candidateSetDigest:freshCandidateSet,budgetDigest:p.deriveBudgetDigest(freshBudget),policyDigest:p.derivePolicyDigest(input.selectionPolicy),provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1'})
  const parentReceipt=p.buildProjectionPlanningReceipt({schema:'pncw-projection-planning-receipt/v1',planningRequestId:input.planningRequestId,selectedCandidateId:original.selectedCandidateId,selectedCandidateDigest:original.selectedCandidateDigest,gcmPlanDigest:original.planSnapshotDigest,frozenInputDigest:input.frozenInputRef.frozenInputDigest,conformanceDigest:p.deriveConformanceDigest(original.conformance),compilerContractVersion:'pncw-plan-compiler/v1'})
  const replanRequest={schema:'pncw-projection-replan-request/v1',parentPlanningId:parentReceipt.planningId,planningRequestId:input.planningRequestId,invalidatedCandidateId:candidateA.candidateId,projectionFailure:{schema:'pncw-error/v1',code:'STALE_SOURCE',stage:'READINESS',retryable:true,source:'hdsrc',message:'source advanced'},newFrozenInputRef:freshFrozen}
  const childRequest=p.buildProjectionPlanningRequest({schema:'pncw-projection-planning-request/v1',candidates:[candidateA,candidateB],budget:freshBudget,selectionPolicy:input.selectionPolicy,authorityContext:{principalId:'unused-by-port',sourceRead:false,surfaceProject:false},frozenInputRef:freshFrozen})
  const replanned=await adapter.replan({planningRequestId:childRequest.planningRequestId,candidates:childRequest.candidates,budget:childRequest.budget,selectionPolicy:childRequest.selectionPolicy,frozenInputRef:childRequest.frozenInputRef,replanRequest})
  assert.equal(replanned.selectedCandidateId,candidateA.candidateId)
  assert.match(replanned.replanLineageRef,/^pncw:fake-replan:/)
  assert.notEqual(replanned.planSnapshotDigest,original.planSnapshotDigest)
})
