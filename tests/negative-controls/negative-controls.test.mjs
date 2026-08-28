import test from 'node:test'
import assert from 'node:assert/strict'

const core=await import('../../dist/packages/core/src/index.js')
const { ProjectionReadinessGate }=await import('../../dist/packages/readiness/src/index.js')
const { ProjectionVerifier }=await import('../../dist/packages/verification/src/index.js')
const { VisibilityCommitStore }=await import('../../dist/packages/visibility/src/index.js')
const { FakeHdsrcSourceAdapter }=await import('../../dist/adapters/fake-hdsrc/src/index.js')
const { FakeMrmicSurfaceAdapter }=await import('../../dist/adapters/fake-mrmic/src/index.js')

const request={
  schema:'pncw-projection-request/v1',requestId:'request:negative',sourceRef:'hdsrc://state/state:demo-4096',
  observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
  scope:{scopeId:'scope:block-row-0',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',
  authorityContext:{principalId:'principal:test',sourceRead:true,surfaceProject:true}
}

async function assemble(hdsrc=new FakeHdsrcSourceAdapter(),mrmic=new FakeMrmicSurfaceAdapter()){
  const readiness=await new ProjectionReadinessGate(hdsrc,mrmic).evaluate(request)
  assert.equal(readiness.result.ready,true)
  const prepared=await mrmic.prepareSurface(request,request.authorityContext)
  const surface=await mrmic.bindProjection(prepared,readiness.source,readiness.materialization,request.authorityContext)
  const manifest=core.buildProjectionManifest({request,source:readiness.source,materialization:readiness.materialization,surface,authorityRefs:readiness.authorityRefs,structuralIntegrity:readiness.structuralIntegrity,residencyMap:[{regionRef:'manifest:root',state:'RESIDENT'},{regionRef:'relation:block-row:0',state:'AVAILABLE'}],version:1})
  const verification=await new ProjectionVerifier(hdsrc,mrmic).verify(request,manifest)
  return {hdsrc,mrmic,readiness,manifest,verification}
}

test('full metadata/digest rebinding cannot authorize a non-canonical carrier',async()=>{
  const hdsrc=new FakeHdsrcSourceAdapter()
  const mrmic=new FakeMrmicSurfaceAdapter()
  const readiness=await new ProjectionReadinessGate(hdsrc,mrmic).evaluate(request)
  assert.equal(readiness.result.ready,true)
  const reboundMat={...structuredClone(readiness.materialization),materializationDigest:`sha256:${'e'.repeat(64)}`}
  const prepared=await mrmic.prepareSurface(request,request.authorityContext)
  const reboundSurface=await mrmic.bindProjection(prepared,readiness.source,reboundMat,request.authorityContext)
  const reboundManifest=core.buildProjectionManifest({
    request,source:readiness.source,materialization:reboundMat,surface:reboundSurface,authorityRefs:readiness.authorityRefs,
    structuralIntegrity:{verified:true,kind:'HMBT1',digest:reboundMat.materializationDigest},
    residencyMap:[{regionRef:'manifest:root',state:'RESIDENT'}],version:1
  })
  assert.equal(reboundManifest.manifestDigest,core.deriveManifestDigest(reboundManifest))
  const result=await new ProjectionVerifier(hdsrc,mrmic).verify(request,reboundManifest)
  assert.equal(result.verified,false)
  assert.equal(result.failure.code,'INTEGRITY_FAILURE')
})

test('serialized cached VERIFIED JSON cannot blind recommit without a live verification proof',async()=>{
  const {manifest,verification}=await assemble()
  assert.equal(verification.verified,true)
  const cached=JSON.parse(JSON.stringify(verification))
  const store=new VisibilityCommitStore()
  assert.throws(()=>store.commit({lifecycleState:'VERIFIED',manifest,verification:cached,revealMode:'ATOMIC_ARTIFACT'}),e=>e?.code==='VERIFICATION_FAILED')
  assert.equal(store.getVisible(manifest.resultId),undefined)
})

test('provider restart requires surface re-resolution and fresh verification before visibility',async()=>{
  const first=await assemble()
  assert.equal(first.verification.verified,true)

  const source2=new FakeHdsrcSourceAdapter()
  const surface2=new FakeMrmicSurfaceAdapter()
  const oldAgainstRestart=await new ProjectionVerifier(source2,surface2).verify(request,first.manifest)
  assert.equal(oldAgainstRestart.verified,false)
  assert.equal(oldAgainstRestart.failure.code,'SURFACE_UNAVAILABLE')

  const second=await assemble(source2,surface2)
  assert.equal(second.verification.verified,true)
  const store=new VisibilityCommitStore()
  const receipt=store.commit({lifecycleState:'VERIFIED',manifest:second.manifest,verification:second.verification,revealMode:'ATOMIC_ARTIFACT'})
  assert.equal(receipt.state,'VISIBLE')
})

test('source becoming stale after assembly blocks later verification',async()=>{
  const first=await assemble()
  const staleResult=await new ProjectionVerifier(new FakeHdsrcSourceAdapter({stale:true}),first.mrmic).verify(request,first.manifest)
  assert.equal(staleResult.verified,false)
  assert.equal(staleResult.failure.code,'STALE_SOURCE')
  assert.equal(staleResult.failure.retryable,true)
})

test('surface availability failure occurs after readiness and before manifest visibility',async()=>{
  const hdsrc=new FakeHdsrcSourceAdapter()
  const mrmic=new FakeMrmicSurfaceAdapter({available:false})
  const readiness=await new ProjectionReadinessGate(hdsrc,mrmic).evaluate(request)
  assert.equal(readiness.result.ready,true)
  await assert.rejects(()=>mrmic.prepareSurface(request,request.authorityContext),e=>e?.code==='SURFACE_UNAVAILABLE')
})
