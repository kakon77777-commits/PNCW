import test from 'node:test'
import assert from 'node:assert/strict'

const core = await import('../../dist/packages/core/src/index.js')
const visibilityModule = await import('../../dist/packages/visibility/src/index.js').catch(() => ({}))
const { ProjectionReadinessGate } = await import('../../dist/packages/readiness/src/index.js')
const { ProjectionVerifier } = await import('../../dist/packages/verification/src/index.js')
const { FakeHdsrcSourceAdapter } = await import('../../dist/adapters/fake-hdsrc/src/index.js')
const { FakeMrmicSurfaceAdapter } = await import('../../dist/adapters/fake-mrmic/src/index.js')

const request = {
  schema: 'pncw-projection-request/v1',
  requestId: 'request:visibility',
  sourceRef: 'hdsrc://state/state:demo-4096',
  observer: { observerId: 'observer:test', observerType: 'ai', profile: 'machine' },
  representation: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
  scope: { scopeId: 'scope:block-row-0', regionRefs: ['relation:block-row:0'] },
  requestedMode: 'machine_carrier',
  authorityContext: { principalId: 'principal:test', sourceRead: true, surfaceProject: true }
}

async function verifiedProjection() {
  const hdsrc = new FakeHdsrcSourceAdapter()
  const mrmic = new FakeMrmicSurfaceAdapter()
  const evaluation = await new ProjectionReadinessGate(hdsrc, mrmic).evaluate(request)
  const prepared = await mrmic.prepareSurface(request, request.authorityContext)
  const surface = await mrmic.bindProjection(prepared, evaluation.source, evaluation.materialization, request.authorityContext)
  const manifest = core.buildProjectionManifest({
    request, source:evaluation.source, materialization:evaluation.materialization, surface,
    authorityRefs:evaluation.authorityRefs, structuralIntegrity:evaluation.structuralIntegrity,
    residencyMap:[
      {regionRef:'manifest:root',state:'RESIDENT',bytesResident:1,bytesTotal:1},
      {regionRef:'relation:block-row:0',state:'AVAILABLE',bytesResident:0,bytesTotal:1272}
    ], version:1
  })
  const verification = await new ProjectionVerifier(hdsrc,mrmic).verify(request,manifest)
  assert.equal(verification.verified,true)
  return {manifest,verification}
}

test('visibility commit is the only transition that makes an authoritative result visible', async () => {
  assert.equal(typeof visibilityModule.VisibilityCommitStore,'function')
  const {manifest,verification}=await verifiedProjection()
  const store=new visibilityModule.VisibilityCommitStore()
  assert.equal(store.getVisible(manifest.resultId),undefined)
  const receipt=store.commit({lifecycleState:'VERIFIED',manifest,verification,revealMode:'ATOMIC_ARTIFACT',visibleAt:'2026-08-28T21:00:00+08:00'})
  assert.equal(receipt.state,'VISIBLE')
  assert.equal(store.getVisible(manifest.resultId),manifest)
  assert.equal(store.getState(manifest.resultId).visibilityCommitId,receipt.visibilityCommitId)
})

test('READY or PROJECTED cannot bypass verification', async () => {
  const {manifest,verification}=await verifiedProjection()
  const store=new visibilityModule.VisibilityCommitStore()
  assert.throws(()=>store.commit({lifecycleState:'READY',manifest,verification,revealMode:'ATOMIC_ARTIFACT'}),e=>e?.code==='INVALID_TRANSITION')
  assert.throws(()=>store.commit({lifecycleState:'PROJECTED',manifest,verification,revealMode:'ATOMIC_ARTIFACT'}),e=>e?.code==='INVALID_TRANSITION')
})

test('unverified or digest-mismatched result cannot become visible', async () => {
  const {manifest,verification}=await verifiedProjection()
  const store=new visibilityModule.VisibilityCommitStore()
  assert.throws(()=>store.commit({lifecycleState:'VERIFIED',manifest,verification:{...verification,verified:false},revealMode:'ATOMIC_ARTIFACT'}),e=>e?.code==='VERIFICATION_FAILED')
  assert.throws(()=>store.commit({lifecycleState:'VERIFIED',manifest,verification:{...verification,verificationDigest:`sha256:${'f'.repeat(64)}`},revealMode:'ATOMIC_ARTIFACT'}),e=>e?.code==='INTEGRITY_FAILURE')
})

test('duplicate VCID is idempotent and creates one semantic visibility event', async () => {
  const {manifest,verification}=await verifiedProjection()
  const store=new visibilityModule.VisibilityCommitStore()
  const input={lifecycleState:'VERIFIED',manifest,verification,revealMode:'ATOMIC_ARTIFACT'}
  const first=store.commit(input)
  const second=store.commit(input)
  assert.deepEqual(second,first)
  assert.equal(store.eventCount,1)
})

test('atomic logical visibility allows partial physical residency', async () => {
  assert.equal(typeof visibilityModule.residentFraction,'function')
  const {manifest,verification}=await verifiedProjection()
  const store=new visibilityModule.VisibilityCommitStore()
  store.commit({lifecycleState:'VERIFIED',manifest,verification,revealMode:'ATOMIC_ARTIFACT'})
  const fraction=visibilityModule.residentFraction(store.getVisible(manifest.resultId))
  assert.ok(fraction > 0)
  assert.ok(fraction < 1)
  assert.equal(store.getState(manifest.resultId).state,'VISIBLE')
})

test('visibleAt does not affect VCID semantic identity', async () => {
  const {manifest,verification}=await verifiedProjection()
  const a=core.deriveVisibilityCommitId({resultId:manifest.resultId,manifestDigest:manifest.manifestDigest,verificationDigest:verification.verificationDigest,revealMode:'ATOMIC_ARTIFACT',visibleAt:'2020-01-01'})
  const b=core.deriveVisibilityCommitId({resultId:manifest.resultId,manifestDigest:manifest.manifestDigest,verificationDigest:verification.verificationDigest,revealMode:'ATOMIC_ARTIFACT',visibleAt:'2099-01-01'})
  assert.equal(a,b)
})
