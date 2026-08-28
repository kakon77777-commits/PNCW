import test from 'node:test'
import assert from 'node:assert/strict'

const core = await import('../../dist/packages/core/src/index.js')
const verificationModule = await import('../../dist/packages/verification/src/index.js').catch(() => ({}))
const { ProjectionReadinessGate } = await import('../../dist/packages/readiness/src/index.js')
const { FakeHdsrcSourceAdapter } = await import('../../dist/adapters/fake-hdsrc/src/index.js')
const { FakeMrmicSurfaceAdapter } = await import('../../dist/adapters/fake-mrmic/src/index.js')

const request = {
  schema: 'pncw-projection-request/v1',
  requestId: 'request:verify',
  sourceRef: 'hdsrc://state/state:demo-4096',
  observer: { observerId: 'observer:test', observerType: 'ai', profile: 'machine' },
  representation: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
  scope: { scopeId: 'scope:block-row-0', regionRefs: ['relation:block-row:0'] },
  requestedMode: 'machine_carrier',
  authorityContext: { principalId: 'principal:test', sourceRead: true, surfaceProject: true }
}

async function readyProjection({ hdsrc = new FakeHdsrcSourceAdapter(), mrmic = new FakeMrmicSurfaceAdapter() } = {}) {
  const evaluation = await new ProjectionReadinessGate(hdsrc, mrmic).evaluate(request)
  assert.equal(evaluation.result.ready, true)
  const prepared = await mrmic.prepareSurface(request, request.authorityContext)
  const surface = await mrmic.bindProjection(prepared, evaluation.source, evaluation.materialization, request.authorityContext)
  return { hdsrc, mrmic, evaluation, surface }
}

test('final manifest is deterministic, immutable, and includes non-visible surface lineage', async () => {
  assert.equal(typeof core.buildProjectionManifest, 'function')
  const { evaluation, surface } = await readyProjection()
  const manifest = core.buildProjectionManifest({
    request,
    source: evaluation.source,
    materialization: evaluation.materialization,
    surface,
    authorityRefs: evaluation.authorityRefs,
    structuralIntegrity: evaluation.structuralIntegrity,
    residencyMap: [
      { regionRef: 'manifest:root', state: 'RESIDENT', bytesResident: 1, bytesTotal: 1 },
      { regionRef: 'relation:block-row:0', state: 'AVAILABLE', bytesResident: 0, bytesTotal: 1272 }
    ],
    version: 1
  })
  assert.equal(surface.visible, false)
  assert.equal(manifest.manifestDigest, core.deriveManifestDigest(manifest))
  assert.throws(() => { manifest.version = 2 }, TypeError)
  const manifest2 = core.buildProjectionManifest({
    request, source: evaluation.source, materialization: evaluation.materialization, surface,
    authorityRefs: evaluation.authorityRefs, structuralIntegrity: evaluation.structuralIntegrity,
    residencyMap: manifest.residencyMap, version: 1
  })
  assert.equal(manifest.resultId, manifest2.resultId)
  assert.equal(manifest.manifestDigest, manifest2.manifestDigest)
})

test('verifier independently accepts matching fresh source, structure, surface, authority and digest', async () => {
  assert.equal(typeof verificationModule.ProjectionVerifier, 'function')
  const { hdsrc, mrmic, evaluation, surface } = await readyProjection()
  const manifest = core.buildProjectionManifest({ request, source:evaluation.source, materialization:evaluation.materialization, surface, authorityRefs:evaluation.authorityRefs, structuralIntegrity:evaluation.structuralIntegrity, residencyMap:[{regionRef:'manifest:root',state:'RESIDENT'}], version:1 })
  const result = await new verificationModule.ProjectionVerifier(hdsrc, mrmic).verify(request, manifest)
  assert.equal(result.verified, true)
  assert.equal(result.manifestDigest, manifest.manifestDigest)
  assert.equal(result.verificationDigest, core.deriveVerificationDigest(result))
  assert.ok(result.checks.every(check => check.passed))
})

test('mixed source/materialization/surface lineage fails with VERSION_CONFLICT', async () => {
  const hdsrc = new FakeHdsrcSourceAdapter()
  const mrmic = new FakeMrmicSurfaceAdapter({ revisionOffset: 1 })
  const { evaluation, surface } = await readyProjection({ hdsrc, mrmic })
  const manifest = core.buildProjectionManifest({ request, source:evaluation.source, materialization:evaluation.materialization, surface, authorityRefs:evaluation.authorityRefs, structuralIntegrity:evaluation.structuralIntegrity, residencyMap:[{regionRef:'manifest:root',state:'RESIDENT'}], version:1 })
  const result = await new verificationModule.ProjectionVerifier(hdsrc, mrmic).verify(request, manifest)
  assert.equal(result.verified, false)
  assert.equal(result.failure.code, 'VERSION_CONFLICT')
})

test('self-consistent metadata cannot override provider structural failure', async () => {
  const goodHdsrc = new FakeHdsrcSourceAdapter()
  const mrmic = new FakeMrmicSurfaceAdapter()
  const { evaluation, surface } = await readyProjection({ hdsrc: goodHdsrc, mrmic })
  const manifest = core.buildProjectionManifest({ request, source:evaluation.source, materialization:evaluation.materialization, surface, authorityRefs:evaluation.authorityRefs, structuralIntegrity:evaluation.structuralIntegrity, residencyMap:[{regionRef:'manifest:root',state:'RESIDENT'}], version:1 })
  const result = await new verificationModule.ProjectionVerifier(new FakeHdsrcSourceAdapter({ integrityFailure: true }), mrmic).verify(request, manifest)
  assert.equal(result.verified, false)
  assert.equal(result.failure.code, 'INTEGRITY_FAILURE')
})

test('manifest with wrong digest or invalid root residency never verifies', async () => {
  const { hdsrc, mrmic, evaluation, surface } = await readyProjection()
  const valid = core.buildProjectionManifest({ request, source:evaluation.source, materialization:evaluation.materialization, surface, authorityRefs:evaluation.authorityRefs, structuralIntegrity:evaluation.structuralIntegrity, residencyMap:[{regionRef:'manifest:root',state:'RESIDENT'}], version:1 })
  const wrongDigest = { ...structuredClone(valid), manifestDigest: `sha256:${'f'.repeat(64)}` }
  let result = await new verificationModule.ProjectionVerifier(hdsrc, mrmic).verify(request, wrongDigest)
  assert.equal(result.verified, false)
  assert.equal(result.failure.code, 'INTEGRITY_FAILURE')

  const invalidRootPayload = { ...structuredClone(valid), residencyMap: [{ regionRef:'manifest:root', state:'INVALID' }] }
  invalidRootPayload.manifestDigest = core.deriveManifestDigest(invalidRootPayload)
  result = await new verificationModule.ProjectionVerifier(hdsrc, mrmic).verify(request, invalidRootPayload)
  assert.equal(result.verified, false)
  assert.equal(result.failure.code, 'VERIFICATION_FAILED')
})
