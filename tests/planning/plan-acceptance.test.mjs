import test from 'node:test'
import assert from 'node:assert/strict'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`

async function fixture(){
  const p=await import('../../dist/packages/planning/src/index.js')
  const { FakeGcmPhaseBAdapter }=await import('../../dist/adapters/fake-gcm-phase-b/src/index.js')
  const candidateA=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/A',
    observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:A',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',planningClass:'route-a',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'100'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.2'}}],
  })
  const candidateB=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/B',
    observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:B',regionRefs:['relation:block-row:1']},requestedMode:'machine_carrier',planningClass:'route-b',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'200'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.4'}}],
  })
  const budget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'500'}}})
  const policy={kind:'LEXICOGRAPHIC',objectiveOrder:['latency']}
  const frozen=p.buildFrozenPlanningInputRef({
    schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:test',snapshotDigest:D1,gcmPlanningAuthorityDigest:D2,
    candidateSetDigest:p.deriveCandidateSetDigest([candidateA,candidateB]),budgetDigest:p.deriveBudgetDigest(budget),policyDigest:p.derivePolicyDigest(policy),
    provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1',
  })
  const request=p.buildProjectionPlanningRequest({schema:'pncw-projection-planning-request/v1',candidates:[candidateA,candidateB],budget,selectionPolicy:policy,authorityContext:{principalId:'principal:test',sourceRead:true,surfaceProject:true},frozenInputRef:frozen})
  const input={planningRequestId:request.planningRequestId,candidates:request.candidates,budget:request.budget,selectionPolicy:request.selectionPolicy,frozenInputRef:request.frozenInputRef}
  const plan=await new FakeGcmPhaseBAdapter().plan(input)
  return {p,request,plan,candidateA,candidateB,budget,policy,frozen}
}

async function expectFailure(action,code){
  await assert.rejects(action,error=>error?.failure?.code===code)
}

test('accepts a conformant plan and mints a derived planning receipt', async () => {
  const {p,request,plan}=await fixture()
  const receipt=p.acceptGcmPlan(request,plan)
  assert.equal(receipt.schema,'pncw-projection-planning-receipt/v1')
  assert.equal(receipt.planningRequestId,request.planningRequestId)
  assert.equal(receipt.selectedCandidateId,plan.selectedCandidateId)
  assert.equal(receipt.gcmPlanDigest,plan.planSnapshotDigest)
  assert.equal(receipt.planningId,p.derivePlanningId(receipt))
  assert.equal(receipt.compilerContractVersion,p.PNCW_PLAN_COMPILER_CONTRACT_VERSION)
})

test('rejects NONCONFORMANT and INDETERMINATE GCM identities', async () => {
  const {p,request,plan}=await fixture()
  for(const claim of ['NONCONFORMANT','INDETERMINATE']){
    const changed=p.buildGcmPlanSnapshot({...plan,conformance:{...plan.conformance,claim},planSnapshotDigest:undefined})
    await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,changed)),'GCM_NONCONFORMANT')
  }
})

test('rejects selected candidate outside the frozen request set', async () => {
  const {p,request,plan,candidateA}=await fixture()
  const outside=p.buildProjectionRouteCandidate({...candidateA,sourceRef:'hdsrc://state/outside'})
  const changed=p.buildGcmPlanSnapshot({...plan,selectedCandidateId:outside.candidateId,selectedCandidateDigest:p.candidateSemanticDigest(outside),feasibleCandidateIds:[outside.candidateId],planSnapshotDigest:undefined})
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,changed)),'SELECTED_CANDIDATE_INVALID')
})

test('rejects selected candidate that is not in the feasible set', async () => {
  const {p,request,plan,candidateB}=await fixture()
  const changed=p.buildGcmPlanSnapshot({...plan,selectedCandidateId:candidateB.candidateId,selectedCandidateDigest:p.candidateSemanticDigest(candidateB),feasibleCandidateIds:[plan.selectedCandidateId],planSnapshotDigest:undefined})
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,changed)),'SELECTED_CANDIDATE_INVALID')
})

test('rejects selectedCandidateDigest mismatch', async () => {
  const {p,request,plan}=await fixture()
  const changed=p.buildGcmPlanSnapshot({...plan,selectedCandidateDigest:D1,planSnapshotDigest:undefined})
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,changed)),'SELECTED_CANDIDATE_INVALID')
})

test('rejects frozen candidate-set lineage mismatch', async () => {
  const {p,request,plan}=await fixture()
  const changed=p.buildGcmPlanSnapshot({...plan,candidateSetDigest:D1,planSnapshotDigest:undefined})
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,changed)),'CANDIDATE_SET_MISMATCH')
})

test('rejects budget, policy, and frozen-input lineage mismatch', async () => {
  const {p,request,plan}=await fixture()
  for(const field of ['budgetDigest','policyDigest','frozenInputDigest']){
    const changed=p.buildGcmPlanSnapshot({...plan,[field]:D1,planSnapshotDigest:undefined})
    await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,changed)),'FROZEN_INPUT_MISMATCH')
  }
})

test('rejects a planSnapshotDigest that does not recompute', async () => {
  const {p,request,plan}=await fixture()
  const forged={...plan,planSnapshotDigest:D1}
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,forged)),'PLAN_INTEGRITY_FAILURE')
})

test('rejects allocator contract drift and missing policy-selection evidence', async () => {
  const {p,request,plan}=await fixture()
  const wrongVersion=p.buildGcmPlanSnapshot({...plan,allocatorContractVersion:'gcm:other/v9',planSnapshotDigest:undefined})
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,wrongVersion)),'PLAN_INTEGRITY_FAILURE')
  const {policySelectionRef:_,policySelectionDigest:__,planSnapshotDigest:___,...withoutPolicy}=plan
  const missing=p.buildGcmPlanSnapshot(withoutPolicy)
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,missing)),'PLAN_INTEGRITY_FAILURE')
})

test('authority and credential laundering fails before normal plan parsing without echoing secret values', async () => {
  const {p,request,plan}=await fixture()
  const attacks=[
    ['sourceRead',true],
    ['surfaceProject',true],
    ['authorityContext',{principalId:'attacker'}],
    ['commitAuthority',true],
    ['writerCapability','world'],
    ['apiKey','SECRET-DO-NOT-ECHO'],
  ]
  for(const [field,value] of attacks){
    const raw={...plan,[field]:value}
    try{
      p.acceptGcmPlan(request,raw)
      assert.fail(`expected ${field} to be rejected`)
    }catch(error){
      assert.equal(error?.failure?.code,'PLAN_INTEGRITY_FAILURE')
      assert.equal(String(error?.message).includes('SECRET-DO-NOT-ECHO'),false)
    }
  }
})

test('feasible/rejected candidate references must stay within the original frozen set', async () => {
  const {p,request,plan,candidateA}=await fixture()
  const outside=p.buildProjectionRouteCandidate({...candidateA,sourceRef:'hdsrc://state/outside'})
  const feasible=p.buildGcmPlanSnapshot({...plan,feasibleCandidateIds:[plan.selectedCandidateId,outside.candidateId],planSnapshotDigest:undefined})
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,feasible)),'PLAN_INTEGRITY_FAILURE')
  const rejected=p.buildGcmPlanSnapshot({...plan,rejectedCandidates:[{candidateId:outside.candidateId,reasonCode:'NOPE'}],planSnapshotDigest:undefined})
  await expectFailure(()=>Promise.resolve(p.acceptGcmPlan(request,rejected)),'PLAN_INTEGRITY_FAILURE')
})
