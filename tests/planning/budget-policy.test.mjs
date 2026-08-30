import test from 'node:test'
import assert from 'node:assert/strict'

const baseCandidatePayload={
  schema:'pncw-projection-route-candidate/v1',
  sourceRef:'hdsrc://state/demo',
  observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
  representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
  scope:{scopeId:'scope:row-0',regionRefs:['relation:block-row:0']},
  requestedMode:'machine_carrier',planningClass:'relation-row',
  demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'1272'}}]},
  objectiveObservations:[
    {objectiveId:'bytes.expected_read',direction:'MINIMIZE',unit:'byte',observation:{kind:'KNOWN',value:'1272'}},
    {objectiveId:'quality.semantic_fidelity',direction:'MAXIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'1'}},
  ],
}
const budgetPayload={schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'4096'}}}

test('BOUNDED hard demand uses conservative upper bound', async () => {
  const { hardDemandForEstimate }=await import('../../dist/packages/planning/src/index.js')
  assert.equal(hardDemandForEstimate({kind:'BOUNDED',lower:'4',upper:'16'}),'16')
})

test('UNKNOWN required hard demand fails closed and is never coerced to zero', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate({...baseCandidatePayload,demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'UNKNOWN'}}]}})
  const budget=p.buildProjectionBudget(budgetPayload)
  assert.deepEqual(p.candidateFeasibilityFailures(candidate,budget).map(x=>x.code),['MISSING_REQUIRED_ESTIMATE'])
})

test('unsafe ESTIMATED hard demand is rejected deterministically', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate({...baseCandidatePayload,demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'ESTIMATED',value:'1272',hardSafe:false,provenance:'estimator:v1'}}]}})
  const budget=p.buildProjectionBudget(budgetPayload)
  assert.deepEqual(p.candidateFeasibilityFailures(candidate,budget).map(x=>x.code),['ESTIMATE_NOT_HARD_SAFE'])
})

test('unit mismatch, unsupported dimension and exceeded budget fail closed', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate({...baseCandidatePayload,demandProfile:{demands:[
    {dimensionId:'bytes',unit:'kilobyte',estimate:{kind:'KNOWN',value:'1'}},
    {dimensionId:'regions',unit:'count',estimate:{kind:'KNOWN',value:'1'}},
    {dimensionId:'vram',unit:'byte',estimate:{kind:'KNOWN',value:'8192'}},
  ]}})
  const budget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'4096'},vram:{unit:'byte',maximum:'4096'}}})
  assert.deepEqual(
    p.candidateFeasibilityFailures(candidate,budget).map(x=>[x.dimensionId,x.code]),
    [['bytes','UNIT_MISMATCH'],['regions','UNSUPPORTED_DIMENSION'],['vram','BUDGET_EXCEEDED']],
  )
})

test('budget comparison is exact for canonical decimals and does not use IEEE-754 rounding', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate({...baseCandidatePayload,demandProfile:{demands:[{dimensionId:'cost',unit:'unit',estimate:{kind:'KNOWN',value:'9007199254740993.0000000000000001'}}]}})
  const budget=p.buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{cost:{unit:'unit',maximum:'9007199254740993'}}})
  assert.deepEqual(p.candidateFeasibilityFailures(candidate,budget).map(x=>x.code),['BUDGET_EXCEEDED'])
})

test('lexicographic policy requires explicit unique objectives available on every candidate', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate(baseCandidatePayload)
  assert.doesNotThrow(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'LEXICOGRAPHIC',objectiveOrder:['bytes.expected_read','quality.semantic_fidelity']},[candidate]))
  assert.throws(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'LEXICOGRAPHIC',objectiveOrder:[]},[candidate]))
  assert.throws(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'LEXICOGRAPHIC',objectiveOrder:['bytes.expected_read','bytes.expected_read']},[candidate]))
  assert.throws(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'LEXICOGRAPHIC',objectiveOrder:['missing.objective']},[candidate]))
})

test('weighted policy is explicit, positive-total and not silently rescaled', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate(baseCandidatePayload)
  const policy={kind:'WEIGHTED',weights:{'bytes.expected_read':'2','quality.semantic_fidelity':'3'},normalizationProfile:'pncw:unit-interval/v1'}
  const validated=p.validateSelectionPolicyAgainstCandidateSet(policy,[candidate])
  assert.deepEqual(validated,policy)
  assert.throws(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'WEIGHTED',weights:{},normalizationProfile:'pncw:unit-interval/v1'},[candidate]))
  assert.throws(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'WEIGHTED',weights:{'bytes.expected_read':'0'},normalizationProfile:'pncw:unit-interval/v1'},[candidate]))
  assert.throws(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'WEIGHTED',weights:{'bytes.expected_read':'-1'},normalizationProfile:'pncw:unit-interval/v1'},[candidate]))
  assert.throws(()=>p.validateSelectionPolicyAgainstCandidateSet({kind:'WEIGHTED',weights:{'missing.objective':'1'},normalizationProfile:'pncw:unit-interval/v1'},[candidate]))
})
