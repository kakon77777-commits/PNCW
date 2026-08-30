import test from 'node:test'
import assert from 'node:assert/strict'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`
const D3=`sha256:${'3'.repeat(64)}`
const D4=`sha256:${'4'.repeat(64)}`

function projectionError(code,retryable=false){
  return {
    schema:'pncw-error/v1',
    code,
    stage:'READINESS',
    retryable,
    source:'pncw',
    message:`${code} fixture`,
  }
}

async function fixture(){
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',
    sourceRef:'hdsrc://state/replan-demo',
    observer:{observerId:'observer:replan',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:replan',regionRefs:['relation:block-row:0']},
    requestedMode:'machine_carrier',
    planningClass:'relation-row',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'1272'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.2'}}],
  })
  const candidateSetDigest=p.deriveCandidateSetDigest([candidate])
  const budget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'4096'}}})
  const policy={kind:'LEXICOGRAPHIC',objectiveOrder:['latency']}
  const policyDigest=p.derivePolicyDigest(policy)
  const parentFrozen=p.buildFrozenPlanningInputRef({
    schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:parent',snapshotDigest:D1,
    gcmPlanningAuthorityDigest:D2,candidateSetDigest,budgetDigest:p.deriveBudgetDigest(budget),policyDigest,
    provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1',
  })
  const childFrozen=p.buildFrozenPlanningInputRef({
    schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:child',snapshotDigest:D3,
    gcmPlanningAuthorityDigest:D4,candidateSetDigest,budgetDigest:p.deriveBudgetDigest(budget),policyDigest,
    provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1',
  })
  const parentReceipt=p.buildProjectionPlanningReceipt({
    schema:'pncw-projection-planning-receipt/v1',
    planningRequestId:`pncw:plan-request:${'a'.repeat(64)}`,
    selectedCandidateId:candidate.candidateId,
    selectedCandidateDigest:p.candidateSemanticDigest(candidate),
    gcmPlanDigest:D1,
    frozenInputDigest:parentFrozen.frozenInputDigest,
    conformanceDigest:D2,
    compilerContractVersion:p.PNCW_PLAN_COMPILER_CONTRACT_VERSION,
  })
  const childReceipt=p.buildProjectionPlanningReceipt({
    schema:'pncw-projection-planning-receipt/v1',
    planningRequestId:`pncw:plan-request:${'b'.repeat(64)}`,
    selectedCandidateId:candidate.candidateId,
    selectedCandidateDigest:p.candidateSemanticDigest(candidate),
    gcmPlanDigest:D3,
    frozenInputDigest:childFrozen.frozenInputDigest,
    conformanceDigest:D4,
    compilerContractVersion:p.PNCW_PLAN_COMPILER_CONTRACT_VERSION,
  })
  return {p,candidate,parentFrozen,childFrozen,parentReceipt,childReceipt}
}

test('projection failures distinguish REPLAN, RETRY and NONE', async () => {
  const { projectionFailureRecovery }=await import('../../dist/packages/planning/src/index.js')
  for(const code of ['STALE_SOURCE','VERSION_CONFLICT','SURFACE_UNAVAILABLE','UNSUPPORTED']){
    assert.equal(projectionFailureRecovery(projectionError(code,false)),'REPLAN',code)
  }
  for(const code of ['SOURCE_UNAVAILABLE','MATERIALIZATION_FAILED']){
    assert.equal(projectionFailureRecovery(projectionError(code,true)),'RETRY',`${code} retryable`)
    assert.equal(projectionFailureRecovery(projectionError(code,false)),'NONE',`${code} non-retryable`)
  }
  for(const code of ['UNAUTHORIZED','INTEGRITY_FAILURE','VERIFICATION_FAILED','INVALID_REQUEST','INVALID_TRANSITION','ALREADY_VISIBLE','ABORTED']){
    assert.equal(projectionFailureRecovery(projectionError(code,false)),'NONE',code)
  }
})

test('replan request requires a REPLAN-class failure and a fresh frozen input', async () => {
  const { buildProjectionReplanRequest }=await import('../../dist/packages/planning/src/index.js')
  const {parentReceipt,parentFrozen,childFrozen,candidate}=await fixture()
  assert.throws(()=>buildProjectionReplanRequest({
    parentReceipt,
    invalidatedCandidateId:candidate.candidateId,
    projectionFailure:projectionError('INTEGRITY_FAILURE',false),
    newFrozenInputRef:childFrozen,
  }),error=>error?.failure?.code==='REPLAN_REQUIRED')
  assert.throws(()=>buildProjectionReplanRequest({
    parentReceipt,
    invalidatedCandidateId:candidate.candidateId,
    projectionFailure:projectionError('STALE_SOURCE',true),
    newFrozenInputRef:parentFrozen,
  }),error=>error?.failure?.code==='REPLAN_REQUIRED')
})

test('replan request preserves parent lineage but carries no PNCW authority or old feasible set', async () => {
  const { buildProjectionReplanRequest }=await import('../../dist/packages/planning/src/index.js')
  const {parentReceipt,childFrozen,candidate}=await fixture()
  const request=buildProjectionReplanRequest({
    parentReceipt,
    invalidatedCandidateId:candidate.candidateId,
    projectionFailure:projectionError('STALE_SOURCE',true),
    newFrozenInputRef:childFrozen,
  })
  assert.equal(request.parentPlanningId,parentReceipt.planningId)
  assert.equal(request.planningRequestId,parentReceipt.planningRequestId)
  assert.equal(request.invalidatedCandidateId,candidate.candidateId)
  assert.deepEqual(request.newFrozenInputRef,childFrozen)
  const json=JSON.stringify(request)
  for(const forbidden of ['authorityContext','sourceRead','surfaceProject','feasibleCandidateIds']){
    assert.equal(json.includes(forbidden),false,forbidden)
  }
  assert.ok(Object.isFrozen(request))
})

test('lineage store requires a newly accepted child before parent supersession', async () => {
  const { PlanningLineageStore }=await import('../../dist/packages/planning/src/index.js')
  const {parentReceipt,childReceipt}=await fixture()
  const store=new PlanningLineageStore()
  store.registerAccepted(parentReceipt)
  assert.equal(store.status(parentReceipt.planningId),'PLAN_ACCEPTED')
  store.markCompiled(parentReceipt.planningId)
  assert.equal(store.status(parentReceipt.planningId),'COMPILED')
  store.markReplanRequired(parentReceipt.planningId)
  assert.equal(store.status(parentReceipt.planningId),'REPLAN_REQUIRED')
  assert.throws(()=>store.supersedeParent(parentReceipt.planningId,childReceipt.planningId))
  store.registerReplacement(parentReceipt.planningId,childReceipt)
  assert.equal(store.status(childReceipt.planningId),'PLAN_ACCEPTED')
  assert.equal(store.status(parentReceipt.planningId),'REPLAN_REQUIRED')
  store.supersedeParent(parentReceipt.planningId,childReceipt.planningId)
  assert.equal(store.status(parentReceipt.planningId),'SUPERSEDED')
})

test('lineage store rejects self-cycle, same PPID replacement and unknown parents', async () => {
  const { PlanningLineageStore }=await import('../../dist/packages/planning/src/index.js')
  const {parentReceipt}=await fixture()
  const store=new PlanningLineageStore()
  assert.throws(()=>store.markCompiled(parentReceipt.planningId))
  store.registerAccepted(parentReceipt)
  store.markCompiled(parentReceipt.planningId)
  store.markReplanRequired(parentReceipt.planningId)
  assert.throws(()=>store.registerReplacement(parentReceipt.planningId,parentReceipt))
  assert.throws(()=>store.registerReplacement(`pncw:planning:${'f'.repeat(64)}`,parentReceipt))
})

test('serialized planning receipt remains evidence but cannot manufacture current authority', async () => {
  const { compileProjectionRequest }=await import('../../dist/packages/plan-compiler/src/index.js')
  const {candidate,parentReceipt}=await fixture()
  const restored=JSON.parse(JSON.stringify(parentReceipt))
  const json=JSON.stringify(restored)
  for(const forbidden of ['authorityContext','sourceRead','surfaceProject']) assert.equal(json.includes(forbidden),false)
  assert.throws(()=>compileProjectionRequest({receipt:restored,candidate,authorityContext:undefined}),error=>error?.failure?.code==='COMPILER_INTEGRITY_FAILURE')
  const current={principalId:'principal:restart',sourceRead:true,surfaceProject:false}
  const compiled=compileProjectionRequest({receipt:restored,candidate,authorityContext:current})
  assert.deepEqual(compiled.authorityContext,current)
})
