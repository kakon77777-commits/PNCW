import test from 'node:test'
import assert from 'node:assert/strict'

const adapters = await import('../../dist/packages/adapters/src/index.js').catch(() => ({}))
const fakeHdsrcModule = await import('../../dist/adapters/fake-hdsrc/src/index.js').catch(() => ({}))
const fakeMrmicModule = await import('../../dist/adapters/fake-mrmic/src/index.js').catch(() => ({}))

const request = {
  schema: 'pncw-projection-request/v1',
  requestId: 'request:adapter-test',
  sourceRef: 'hdsrc://state/state:demo-4096',
  observer: { observerId: 'observer:test', observerType: 'ai', profile: 'machine' },
  representation: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
  scope: { scopeId: 'scope:block-row-0', regionRefs: ['relation:block-row:0'] },
  requestedMode: 'machine_carrier',
  authorityContext: { principalId: 'principal:test', sourceRead: true, surfaceProject: true }
}

test('fake providers expose read-only capabilities and independent authority checks', async () => {
  assert.equal(typeof fakeHdsrcModule.FakeHdsrcSourceAdapter, 'function')
  assert.equal(typeof fakeMrmicModule.FakeMrmicSurfaceAdapter, 'function')
  const hdsrc = new fakeHdsrcModule.FakeHdsrcSourceAdapter()
  const mrmic = new fakeMrmicModule.FakeMrmicSurfaceAdapter()
  assert.equal((await hdsrc.getCapabilities()).canonicalMutation, false)
  assert.equal((await mrmic.getCapabilities()).canonicalMutation, false)
  await assert.rejects(() => hdsrc.resolveSource(request.sourceRef, { ...request.authorityContext, sourceRead: false }), e => e?.code === 'UNAUTHORIZED')
  assert.equal((await mrmic.checkProjectionAuthority({ ...request.authorityContext, surfaceProject: false })).authorized, false)
})

test('fake HDSRC returns partial region evidence without full carrier residency', async () => {
  const hdsrc = new fakeHdsrcModule.FakeHdsrcSourceAdapter()
  const source = await hdsrc.resolveSource(request.sourceRef, request.authorityContext)
  const materialization = await hdsrc.resolveMaterialization(request, source, request.authorityContext)
  const region = await hdsrc.readSelectedRegion(materialization, 'relation:block-row:0', request.authorityContext)
  assert.equal(region.structuralVerified, true)
  assert.ok(region.bytesRead > 0)
  assert.ok(region.bytesRead < region.totalCarrierBytes)
})

test('fake adapters can model stale and structural-integrity failures separately', async () => {
  const staleAdapter = new fakeHdsrcModule.FakeHdsrcSourceAdapter({ stale: true })
  const source = await staleAdapter.resolveSource(request.sourceRef, request.authorityContext)
  const materialization = await staleAdapter.resolveMaterialization(request, source, request.authorityContext)
  assert.equal((await staleAdapter.checkFreshness(source, materialization, request.authorityContext)).fresh, false)

  const badAdapter = new fakeHdsrcModule.FakeHdsrcSourceAdapter({ integrityFailure: true })
  const badSource = await badAdapter.resolveSource(request.sourceRef, request.authorityContext)
  const badMat = await badAdapter.resolveMaterialization(request, badSource, request.authorityContext)
  assert.equal((await badAdapter.verifyMaterialization(badMat, request.authorityContext)).verified, false)
})

test('port packages do not define canonical mutation methods', () => {
  assert.equal(typeof adapters.assertReadOnlyPortSurface, 'function')
  const hdsrc = new fakeHdsrcModule.FakeHdsrcSourceAdapter()
  const mrmic = new fakeMrmicModule.FakeMrmicSurfaceAdapter()
  assert.doesNotThrow(() => adapters.assertReadOnlyPortSurface(hdsrc))
  assert.doesNotThrow(() => adapters.assertReadOnlyPortSurface(mrmic))
})
