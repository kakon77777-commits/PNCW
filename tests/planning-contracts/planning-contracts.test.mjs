import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`
const CID=`pncw:candidate:${'a'.repeat(64)}`
const BID=`pncw:budget:${'b'.repeat(64)}`
const PPRID=`pncw:plan-request:${'c'.repeat(64)}`
const PPID=`pncw:planning:${'d'.repeat(64)}`

const schemaPaths = [
  'contracts/projection-route-candidate/v1.schema.json',
  'contracts/projection-budget/v1.schema.json',
  'contracts/frozen-planning-input/v1.schema.json',
  'contracts/projection-planning-request/v1.schema.json',
  'contracts/gcm-plan-snapshot/v1.schema.json',
  'contracts/planning-receipt/v1.schema.json',
  'contracts/planning-failure/v1.schema.json',
  'contracts/projection-replan-request/v1.schema.json',
]

const candidate={
  schema:'pncw-projection-route-candidate/v1',candidateId:CID,
  sourceRef:'hdsrc://state/demo',
  observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
  representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
  scope:{scopeId:'scope:row-0',regionRefs:['relation:block-row:0']},
  requestedMode:'machine_carrier',planningClass:'relation-row',
  demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'1272'}}]},
  objectiveObservations:[{objectiveId:'bytes.expected_read',direction:'MINIMIZE',unit:'byte',observation:{kind:'KNOWN',value:'1272'}}],
}
const budget={schema:'pncw-projection-budget/v1',budgetId:BID,hardLimits:{bytes:{unit:'byte',maximum:'4096'}},maxCandidates:8,maxMaterializedRegions:4}
const frozen={schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:demo',snapshotDigest:D1,gcmPlanningAuthorityDigest:D2,candidateSetDigest:D1,budgetDigest:D2,policyDigest:D1,provider:'gcm-phase-b',providerContractVersion:'gcm-allocator-conformance-v0.1',frozenInputDigest:D2}
const request={schema:'pncw-projection-planning-request/v1',planningRequestId:PPRID,candidates:[candidate],budget,selectionPolicy:{kind:'LEXICOGRAPHIC',objectiveOrder:['bytes.expected_read']},authorityContext:{principalId:'principal:test',sourceRead:true,surfaceProject:true},frozenInputRef:frozen}
const conformance={profileId:'R0-M4',claim:'CONFORMANT',profileDigest:D1,packageName:'gcm-runtime',packageVersion:'0.4.0',allocatorContractVersion:'gcm-allocator-conformance-v0.1'}
const plan={schema:'pncw-gcm-plan-snapshot/v1',planningRequestId:PPRID,candidateSetDigest:D1,budgetDigest:D2,policyDigest:D1,frozenInputDigest:D2,selectedCandidateId:CID,selectedCandidateDigest:D1,feasibleCandidateIds:[CID],rejectedCandidates:[],allocationPlanRef:'gcm:plan:1',allocationPlanDigest:D2,policySelectionRef:'gcm:selection:1',policySelectionDigest:D1,allocatorContractVersion:'gcm-allocator-conformance-v0.1',conformance,planSnapshotDigest:D2}
const receipt={schema:'pncw-projection-planning-receipt/v1',planningId:PPID,planningRequestId:PPRID,selectedCandidateId:CID,selectedCandidateDigest:D1,gcmPlanDigest:D2,frozenInputDigest:D2,conformanceDigest:D1,compilerContractVersion:'pncw-plan-compiler/v1'}
const failure={schema:'pncw-planning-failure/v1',code:'GCM_UNAVAILABLE',stage:'GCM',recovery:'RETRY',source:'gcm-phase-b',message:'temporarily unavailable'}
const pncwFailure={schema:'pncw-error/v1',code:'STALE_SOURCE',stage:'READINESS',retryable:true,source:'hdsrc',message:'source advanced'}
const replan={schema:'pncw-projection-replan-request/v1',parentPlanningId:PPID,planningRequestId:PPRID,invalidatedCandidateId:CID,projectionFailure:pncwFailure,newFrozenInputRef:frozen}

const fixtures=[candidate,budget,frozen,request,plan,receipt,failure,replan]

test('v0.2 planning schemas are present and closed', async () => {
  for (const path of schemaPaths) {
    const schema = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
    assert.equal(schema.type, 'object')
    assert.equal(schema.additionalProperties, false)
  }
})

test('Ajv validates planning fixtures and rejects top-level unknown fields', async t => {
  let Ajv2020
  try { ;({default:Ajv2020}=await import('ajv/dist/2020.js')) }
  catch { t.skip('Ajv unavailable outside CI'); return }
  for(let i=0;i<schemaPaths.length;i++){
    const schema=JSON.parse(await readFile(schemaPaths[i],'utf8'))
    const validate=new Ajv2020({allErrors:true,strict:true}).compile(schema)
    assert.equal(validate(fixtures[i]),true,`${schemaPaths[i]}: ${JSON.stringify(validate.errors)}`)
    assert.equal(validate({...fixtures[i],injected:true}),false,`${schemaPaths[i]} must reject unknown field`)
  }
})

test('canonical decimal parser rejects non-canonical spellings', async () => {
  const { assertCanonicalDecimal } = await import('../../dist/packages/planning/src/index.js')
  for (const value of ['01','1.','.5','1e3','-0','NaN','Infinity','1.20']) assert.throws(()=>assertCanonicalDecimal(value))
  for (const value of ['0','1','-1','0.25','1000.125']) assert.equal(assertCanonicalDecimal(value),value)
  assert.throws(()=>assertCanonicalDecimal('-1',{nonNegative:true}))
})

test('runtime planning assertions accept closed fixtures and reject nested unknowns', async () => {
  const p=await import('../../dist/packages/planning/src/index.js')
  const assertions=[
    p.assertProjectionRouteCandidate,p.assertProjectionBudget,p.assertFrozenPlanningInputRef,p.assertProjectionPlanningRequest,
    p.assertGcmPlanSnapshot,p.assertProjectionPlanningReceipt,p.assertPlanningFailure,p.assertProjectionReplanRequest,
  ]
  for(let i=0;i<assertions.length;i++) assert.deepEqual(assertions[i](fixtures[i]),fixtures[i])
  assert.throws(()=>p.assertProjectionRouteCandidate({...candidate,demandProfile:{demands:[{...candidate.demandProfile.demands[0],injected:true}]}}))
  assert.throws(()=>p.assertProjectionPlanningRequest({...request,authorityContext:{...request.authorityContext,injected:true}}))
  assert.throws(()=>p.assertGcmPlanSnapshot({...plan,conformance:{...conformance,injected:true}}))
})
