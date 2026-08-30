import test from 'node:test'
import assert from 'node:assert/strict'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`
const D3=`sha256:${'3'.repeat(64)}`

async function fixture(){
  const p=await import('../../dist/packages/planning/src/index.js')
  const candidate=p.buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/demo',
    observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:row-0',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',planningClass:'relation-row',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'1272'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.2'}}],
  })
  const receiptA=p.buildProjectionPlanningReceipt({schema:'pncw-projection-planning-receipt/v1',planningRequestId:`pncw:plan-request:${'a'.repeat(64)}`,selectedCandidateId:candidate.candidateId,selectedCandidateDigest:p.candidateSemanticDigest(candidate),gcmPlanDigest:D1,frozenInputDigest:D2,conformanceDigest:D3,compilerContractVersion:p.PNCW_PLAN_COMPILER_CONTRACT_VERSION})
  const receiptB=p.buildProjectionPlanningReceipt({schema:'pncw-projection-planning-receipt/v1',planningRequestId:`pncw:plan-request:${'b'.repeat(64)}`,selectedCandidateId:candidate.candidateId,selectedCandidateDigest:p.candidateSemanticDigest(candidate),gcmPlanDigest:D2,frozenInputDigest:D3,conformanceDigest:D1,compilerContractVersion:p.PNCW_PLAN_COMPILER_CONTRACT_VERSION})
  return {p,candidate,receiptA,receiptB}
}

test('compiler exact-copies projection semantics and injects only current authority', async () => {
  const { compileProjectionRequest }=await import('../../dist/packages/plan-compiler/src/index.js')
  const {candidate,receiptA}=await fixture()
  const currentAuthority={principalId:'principal:current',sourceRead:true,surfaceProject:false}
  const out=compileProjectionRequest({receipt:receiptA,candidate,authorityContext:currentAuthority})
  assert.equal(out.schema,'pncw-projection-request/v1')
  assert.equal(out.sourceRef,candidate.sourceRef)
  assert.deepEqual(out.observer,candidate.observer)
  assert.deepEqual(out.representation,candidate.representation)
  assert.deepEqual(out.scope,candidate.scope)
  assert.equal(out.requestedMode,candidate.requestedMode)
  assert.deepEqual(out.authorityContext,currentAuthority)
  assert.match(out.requestId,/^pncw:compiled-request:[0-9a-f]{64}$/)
  assert.ok(Object.isFrozen(out))
})

test('compiler rejects candidate semantic mutation after receipt creation', async () => {
  const { compileProjectionRequest }=await import('../../dist/packages/plan-compiler/src/index.js')
  const {candidate,receiptA}=await fixture()
  const mutated={...candidate,scope:{...candidate.scope,regionRefs:['relation:block-row:99']}}
  assert.throws(()=>compileProjectionRequest({receipt:receiptA,candidate:mutated,authorityContext:{principalId:'principal:test',sourceRead:true,surfaceProject:true}}),error=>error?.failure?.code==='COMPILER_INTEGRITY_FAILURE')
})

test('compiler rejects wrong compiler contract version', async () => {
  const { compileProjectionRequest }=await import('../../dist/packages/plan-compiler/src/index.js')
  const {p,candidate,receiptA}=await fixture()
  const wrong=p.buildProjectionPlanningReceipt({...receiptA,compilerContractVersion:'pncw-plan-compiler/v99',planningId:undefined})
  assert.throws(()=>compileProjectionRequest({receipt:wrong,candidate,authorityContext:{principalId:'principal:test',sourceRead:true,surfaceProject:true}}),error=>error?.failure?.code==='COMPILER_INTEGRITY_FAILURE')
})

test('different PPID provenance can compile to different request IDs but the same RID', async () => {
  const { compileProjectionRequest }=await import('../../dist/packages/plan-compiler/src/index.js')
  const { deriveResultId }=await import('../../dist/packages/core/src/index.js')
  const {candidate,receiptA,receiptB}=await fixture()
  const authority={principalId:'principal:test',sourceRead:true,surfaceProject:true}
  const a=compileProjectionRequest({receipt:receiptA,candidate,authorityContext:authority})
  const b=compileProjectionRequest({receipt:receiptB,candidate,authorityContext:authority})
  assert.notEqual(receiptA.planningId,receiptB.planningId)
  assert.notEqual(a.requestId,b.requestId)
  const sourceIdentity={authority:'hdsrc',sourceId:'state:demo',revision:10,digest:D1}
  const ridA=deriveResultId({sourceIdentity,scope:a.scope,observerProfile:a.observer,projectionProfile:a.representation,protocolVersion:a.representation.protocolVersion})
  const ridB=deriveResultId({sourceIdentity,scope:b.scope,observerProfile:b.observer,projectionProfile:b.representation,protocolVersion:b.representation.protocolVersion})
  assert.equal(ridA,ridB)
})

test('semantic projection change still changes RID', async () => {
  const { compileProjectionRequest }=await import('../../dist/packages/plan-compiler/src/index.js')
  const { deriveResultId }=await import('../../dist/packages/core/src/index.js')
  const {p,candidate,receiptA}=await fixture()
  const changedCandidate=p.buildProjectionRouteCandidate({...candidate,scope:{...candidate.scope,regionRefs:['relation:block-row:1']}})
  const changedReceipt=p.buildProjectionPlanningReceipt({...receiptA,selectedCandidateId:changedCandidate.candidateId,selectedCandidateDigest:p.candidateSemanticDigest(changedCandidate),planningId:undefined})
  const authority={principalId:'principal:test',sourceRead:true,surfaceProject:true}
  const a=compileProjectionRequest({receipt:receiptA,candidate,authorityContext:authority})
  const b=compileProjectionRequest({receipt:changedReceipt,candidate:changedCandidate,authorityContext:authority})
  const sourceIdentity={authority:'hdsrc',sourceId:'state:demo',revision:10,digest:D1}
  const ridA=deriveResultId({sourceIdentity,scope:a.scope,observerProfile:a.observer,projectionProfile:a.representation,protocolVersion:a.representation.protocolVersion})
  const ridB=deriveResultId({sourceIdentity,scope:b.scope,observerProfile:b.observer,projectionProfile:b.representation,protocolVersion:b.representation.protocolVersion})
  assert.notEqual(ridA,ridB)
})
