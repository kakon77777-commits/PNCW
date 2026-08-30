import test from 'node:test'
import assert from 'node:assert/strict'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`

const baseCandidate={
  schema:'pncw-projection-route-candidate/v1',
  sourceRef:'hdsrc://state/demo',
  observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
  representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
  scope:{scopeId:'scope:rows',regionRefs:['relation:block-row:0','relation:block-row:1']},
  requestedMode:'machine_carrier',planningClass:'relation-row',
  demandProfile:{demands:[
    {dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'1272'}},
    {dimensionId:'regions',unit:'count',estimate:{kind:'KNOWN',value:'1'}},
  ]},
  objectiveObservations:[
    {objectiveId:'bytes.expected_read',direction:'MINIMIZE',unit:'byte',observation:{kind:'KNOWN',value:'1272'}},
    {objectiveId:'quality.semantic_fidelity',direction:'MAXIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'1'}},
  ],
}
const budgetPayload={schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'4096'},regions:{unit:'count',maximum:'4'}},maxCandidates:8,maxMaterializedRegions:4}

test('candidate demand/objective container order is non-semantic', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const a=p.buildProjectionRouteCandidate(baseCandidate)
  const b=p.buildProjectionRouteCandidate({
    ...baseCandidate,
    demandProfile:{demands:[...baseCandidate.demandProfile.demands].reverse()},
    objectiveObservations:[...baseCandidate.objectiveObservations].reverse(),
  })
  assert.equal(a.candidateId,b.candidateId)
  assert.equal(p.candidateSemanticDigest(a),p.candidateSemanticDigest(b))
})

test('scope region order preserves v0.1 semantic meaning', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const a=p.buildProjectionRouteCandidate(baseCandidate)
  const b=p.buildProjectionRouteCandidate({...baseCandidate,scope:{...baseCandidate.scope,regionRefs:[...baseCandidate.scope.regionRefs].reverse()}})
  assert.notEqual(a.candidateId,b.candidateId)
})

test('candidate-set and budget identities ignore host insertion order', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const a=p.buildProjectionRouteCandidate(baseCandidate)
  const b=p.buildProjectionRouteCandidate({...baseCandidate,sourceRef:'hdsrc://state/other'})
  assert.equal(p.deriveCandidateSetDigest([a,b]),p.deriveCandidateSetDigest([b,a]))
  const budget1=p.buildProjectionBudget(budgetPayload)
  const budget2=p.buildProjectionBudget({...budgetPayload,hardLimits:{regions:budgetPayload.hardLimits.regions,bytes:budgetPayload.hardLimits.bytes}})
  assert.equal(budget1.budgetId,budget2.budgetId)
  assert.equal(p.deriveBudgetDigest(budget1),p.deriveBudgetDigest(budget2))
})

test('FID excludes snapshot locator while PPRID excludes PNCW authority', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate(baseCandidate)
  const budget=p.buildProjectionBudget(budgetPayload)
  const candidateSetDigest=p.deriveCandidateSetDigest([candidate])
  const policy={kind:'LEXICOGRAPHIC',objectiveOrder:['bytes.expected_read']}
  const policyDigest=p.derivePolicyDigest(policy)
  const frozenBase={schema:'pncw-frozen-planning-input/v1',snapshotDigest:D1,gcmPlanningAuthorityDigest:D2,candidateSetDigest,budgetDigest:p.deriveBudgetDigest(budget),policyDigest,provider:'gcm-phase-b',providerContractVersion:'gcm-allocator-conformance-v0.1'}
  const frozenA=p.buildFrozenPlanningInputRef({...frozenBase,snapshotRef:'gcm:snapshot:A'})
  const frozenB=p.buildFrozenPlanningInputRef({...frozenBase,snapshotRef:'gcm:snapshot:B'})
  assert.equal(frozenA.frozenInputDigest,frozenB.frozenInputDigest)
  const requestA=p.buildProjectionPlanningRequest({schema:'pncw-projection-planning-request/v1',candidates:[candidate],budget,selectionPolicy:policy,authorityContext:{principalId:'alice',sourceRead:true,surfaceProject:true},frozenInputRef:frozenA})
  const requestB=p.buildProjectionPlanningRequest({schema:'pncw-projection-planning-request/v1',candidates:[candidate],budget,selectionPolicy:policy,authorityContext:{principalId:'bob',sourceRead:false,surfaceProject:false},frozenInputRef:frozenA})
  assert.equal(requestA.planningRequestId,requestB.planningRequestId)
})

test('GPD and PPID are self-excluding deterministic identities', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate(baseCandidate)
  const conformance={profileId:'R0-M4',claim:'CONFORMANT',profileDigest:D1,packageName:'gcm-runtime',packageVersion:'0.4.0',allocatorContractVersion:'gcm-allocator-conformance-v0.1'}
  const planPayload={schema:'pncw-gcm-plan-snapshot/v1',planningRequestId:`pncw:plan-request:${'c'.repeat(64)}`,candidateSetDigest:D1,budgetDigest:D2,policyDigest:D1,frozenInputDigest:D2,selectedCandidateId:candidate.candidateId,selectedCandidateDigest:p.candidateSemanticDigest(candidate),feasibleCandidateIds:[candidate.candidateId],rejectedCandidates:[],allocationPlanRef:'gcm:plan:1',allocationPlanDigest:D2,policySelectionRef:'gcm:selection:1',policySelectionDigest:D1,allocatorContractVersion:'gcm-allocator-conformance-v0.1',conformance}
  const plan1=p.buildGcmPlanSnapshot(planPayload)
  const plan2=p.buildGcmPlanSnapshot({...planPayload,replanLineageRef:'lineage:stable'})
  assert.notEqual(plan1.planSnapshotDigest,plan2.planSnapshotDigest)
  assert.equal(plan1.planSnapshotDigest,p.deriveGcmPlanSnapshotDigest(plan1))
  const receipt=p.buildProjectionPlanningReceipt({schema:'pncw-projection-planning-receipt/v1',planningRequestId:plan1.planningRequestId,selectedCandidateId:candidate.candidateId,selectedCandidateDigest:p.candidateSemanticDigest(candidate),gcmPlanDigest:plan1.planSnapshotDigest,frozenInputDigest:D2,conformanceDigest:p.deriveConformanceDigest(conformance),compilerContractVersion:'pncw-plan-compiler/v1'})
  assert.equal(receipt.planningId,p.derivePlanningId(receipt))
})

test('runtime assertions reject caller-forged derived IDs', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate(baseCandidate)
  assert.throws(()=>p.assertProjectionRouteCandidate({...candidate,candidateId:`pncw:candidate:${'f'.repeat(64)}`}))
  const budget=p.buildProjectionBudget(budgetPayload)
  assert.throws(()=>p.assertProjectionBudget({...budget,budgetId:`pncw:budget:${'f'.repeat(64)}`}))
})
