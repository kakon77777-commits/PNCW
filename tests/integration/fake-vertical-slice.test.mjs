import test from 'node:test'
import assert from 'node:assert/strict'

const demo = await import('../../dist/examples/vertical-slice/src/fake.js').catch(() => ({}))
const conformance = await import('../../dist/packages/conformance/src/index.js').catch(() => ({}))
const { FakeHdsrcSourceAdapter } = await import('../../dist/adapters/fake-hdsrc/src/index.js')
const { FakeMrmicSurfaceAdapter } = await import('../../dist/adapters/fake-mrmic/src/index.js')

const request = {
  schema: 'pncw-projection-request/v1',
  requestId: 'request:conformance',
  sourceRef: 'hdsrc://state/state:demo-4096',
  observer: { observerId: 'observer:test', observerType: 'ai', profile: 'machine' },
  representation: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
  scope: { scopeId: 'scope:block-row-0', regionRefs: ['relation:block-row:0'] },
  requestedMode: 'machine_carrier',
  authorityContext: { principalId: 'principal:test', sourceRead: true, surfaceProject: true }
}

test('fake full vertical slice closes projection lifecycle with partial residency', async () => {
  assert.equal(typeof demo.runFakeVerticalSlice, 'function')
  const evidence = await demo.runFakeVerticalSlice()
  assert.equal(evidence.schema, 'pncw-fake-vertical-slice-evidence/v0.1')
  assert.equal(evidence.readinessReady, true)
  assert.equal(evidence.verificationVerified, true)
  assert.equal(evidence.visibilityState, 'VISIBLE')
  assert.equal(evidence.visibilityEvents, 1)
  assert.ok(evidence.residentFraction > 0 && evidence.residentFraction < 1)
  assert.equal(evidence.partialBytesRead, 1272)
  assert.equal(evidence.totalCarrierBytes, 286313)
  assert.ok(evidence.partialBytesRead < evidence.totalCarrierBytes)
})

test('fake vertical slice semantic identities replay deterministically', async () => {
  const a = await demo.runFakeVerticalSlice()
  const b = await demo.runFakeVerticalSlice()
  for (const key of ['resultId','manifestDigest','verificationDigest','visibilityCommitId']) assert.equal(a[key], b[key])
})

test('reusable source and surface conformance runners pass on fake adapters', async () => {
  assert.equal(typeof conformance.runHdsrcPortConformance, 'function')
  assert.equal(typeof conformance.runMrmicPortConformance, 'function')
  const sourceChecks = await conformance.runHdsrcPortConformance(new FakeHdsrcSourceAdapter(), request)
  const surfaceChecks = await conformance.runMrmicPortConformance(new FakeMrmicSurfaceAdapter(), request)
  assert.ok(sourceChecks.length >= 5)
  assert.ok(surfaceChecks.length >= 3)
  assert.ok(sourceChecks.every(check => check.passed))
  assert.ok(surfaceChecks.every(check => check.passed))
})
