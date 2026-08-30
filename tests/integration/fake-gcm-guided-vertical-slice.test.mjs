import test from 'node:test'
import assert from 'node:assert/strict'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`
const D3=`sha256:${'3'.repeat(64)}`
const D4=`sha256:${'4'.repeat(64)}`

async function planningFixture(authorityContext={principalId:'principal:gcm-guided',sourceRead:true,surfaceProject:true},snapshot='parent'){
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidateA=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/state:demo-4096',
    observer:{observerId:'observer:gcm-guided',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:block-row-0',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',planningClass:'machine-row',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'1272'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.2'}}],
  })
  const candidateB=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/state:demo-4096',
    observer:{observerId:'observer:gcm-guided',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:block-row-1',regionRefs:['relation:block-row:1']},requestedMode:'structured_manifest',planningClass:'manifest-row',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'2048'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.6'}}],
  })
  const candidates=[candidateA,candidateB]
  const budget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'4096'}}})
  const selectionPolicy={kind:'LEXICOGRAPHIC',objectiveOrder:['latency']}
  const frozen=p.buildFrozenPlanningInputRef({
    schema:'pncw-frozen-planning-input/v1',snapshotRef:`gcm:snapshot:${snapshot}`,
    snapshotDigest:snapshot==='parent'?D1:D3,gcmPlanningAuthorityDigest:snapshot==='parent'?D2:D4,
    candidateSetDigest:p.deriveCandidateSetDigest(candidates),budgetDigest:p.deriveBudgetDigest(budget),policyDigest:p.derivePolicyDigest(selectionPolicy),
    provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1',
  })
  const request=p.buildProjectionPlanningRequest({
    schema:'pncw-projection-planning-request/v1',candidates,budget,selectionPolicy,authorityContext,frozenInputRef:frozen,
  })
  return {p,candidateA,candidateB,budget,selectionPolicy,frozen,request}
}

test('planning service never sends PNCW authority into GCM planning port', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const { FakeGcmPhaseBAdapter }=await import('../../dist/adapters/fake-gcm-phase-b/src/index.js')
  const {request}=await planningFixture()
  const delegate=new FakeGcmPhaseBAdapter()
  let observed
  const spy={
    capabilities:()=>delegate.capabilities(),
    conformanceIdentity:()=>delegate.conformanceIdentity(),
    plan:async input=>{observed=structuredClone(input);return delegate.plan(input)},
    replan:input=>delegate.replan(input),
  }
  const planner=new p.GcmGuidedProjectionPlanner(spy)
  const planned=await planner.planToProjectionRequest(request)
  assert.deepEqual(Object.keys(observed).sort(),['budget','candidates','frozenInputRef','planningRequestId','selectionPolicy'].sort())
  const payload=JSON.stringify(observed)
  for(const forbidden of ['authorityContext','principalId','sourceRead','surfaceProject']) assert.equal(payload.includes(forbidden),false,forbidden)
  assert.deepEqual(planned.projectionRequest.authorityContext,request.authorityContext)
})

test('planning service replan keeps parent and child planning identities distinct and authority-free upstream', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const { FakeGcmPhaseBAdapter }=await import('../../dist/adapters/fake-gcm-phase-b/src/index.js')
  const parent=await planningFixture()
  const child=await planningFixture({principalId:'principal:child',sourceRead:true,surfaceProject:false},'child')
  const delegate=new FakeGcmPhaseBAdapter()
  let observed
  const spy={
    capabilities:()=>delegate.capabilities(),
    conformanceIdentity:()=>delegate.conformanceIdentity(),
    plan:input=>delegate.plan(input),
    replan:async input=>{observed=structuredClone(input);return delegate.replan(input)},
  }
  const planner=new p.GcmGuidedProjectionPlanner(spy)
  const first=await planner.planToProjectionRequest(parent.request)
  const replanRequest=p.buildProjectionReplanRequest({
    parentReceipt:first.receipt,
    invalidatedCandidateId:first.receipt.selectedCandidateId,
    projectionFailure:{schema:'pncw-error/v1',code:'STALE_SOURCE',stage:'READINESS',retryable:true,source:'hdsrc',message:'source advanced'},
    newFrozenInputRef:child.frozen,
  })
  const replanned=await planner.replanToProjectionRequest(child.request,replanRequest)
  assert.notEqual(child.request.planningRequestId,parent.request.planningRequestId)
  assert.equal(observed.planningRequestId,child.request.planningRequestId)
  assert.equal(observed.replanRequest.planningRequestId,parent.request.planningRequestId)
  for(const forbidden of ['authorityContext','principalId','sourceRead','surfaceProject']) assert.equal(JSON.stringify(observed).includes(forbidden),false,forbidden)
  assert.deepEqual(replanned.projectionRequest.authorityContext,child.request.authorityContext)
})

test('fake GCM-guided reference example closes v0.1 visibility with partial residency', async () => {
  const demo=await import('../../dist/examples/gcm-guided-vertical-slice/src/index.js').catch(()=>({}))
  assert.equal(typeof demo.runFakeGcmGuidedVerticalSlice,'function')
  const evidence=await demo.runFakeGcmGuidedVerticalSlice()
  assert.equal(evidence.schema,'pncw-fake-gcm-guided-evidence/v0.2')
  assert.equal(evidence.selectedPlanningClass,'machine-row')
  assert.equal(evidence.visibilityState,'VISIBLE')
  assert.equal(evidence.visibilityEvents,1)
  assert.ok(evidence.residentFraction>0 && evidence.residentFraction<1)
  assert.equal(evidence.partialBytesRead,1272)
  assert.equal(evidence.totalCarrierBytes,286313)
  assert.match(evidence.planningRequestId,/^pncw:plan-request:/)
  assert.match(evidence.selectedCandidateId,/^pncw:candidate:/)
  assert.match(evidence.gcmPlanDigest,/^sha256:/)
  assert.match(evidence.planningId,/^pncw:planning:/)
  assert.match(evidence.compiledRequestId,/^pncw:compiled-request:/)
  assert.match(evidence.resultId,/^pncw:result:/)
})
