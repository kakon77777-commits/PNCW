import test from 'node:test'
import assert from 'node:assert/strict'

const { ProjectionReadinessGate } = await import('../../dist/packages/readiness/src/index.js').catch(() => ({}))
const { FakeHdsrcSourceAdapter } = await import('../../dist/adapters/fake-hdsrc/src/index.js')
const { FakeMrmicSurfaceAdapter } = await import('../../dist/adapters/fake-mrmic/src/index.js')

const request = {
  schema: 'pncw-projection-request/v1',
  requestId: 'request:readiness',
  sourceRef: 'hdsrc://state/state:demo-4096',
  observer: { observerId: 'observer:test', observerType: 'ai', profile: 'machine' },
  representation: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
  scope: { scopeId: 'scope:block-row-0', regionRefs: ['relation:block-row:0'] },
  requestedMode: 'machine_carrier',
  authorityContext: { principalId: 'principal:test', sourceRead: true, surfaceProject: true }
}

test('readiness resolves source and materialization but does not prepare a surface', async () => {
  assert.equal(typeof ProjectionReadinessGate, 'function')
  const hdsrc = new FakeHdsrcSourceAdapter()
  const mrmic = new FakeMrmicSurfaceAdapter()
  const evaluation = await new ProjectionReadinessGate(hdsrc, mrmic).evaluate(request)
  assert.equal(evaluation.result.ready, true)
  assert.equal(evaluation.source.sourceId, 'state:demo-4096')
  assert.equal(evaluation.materialization.carrierProfile, 'HMBT1')
  assert.equal(mrmic.preparedCount, 0)
  assert.ok(evaluation.result.checks.every(check => check.passed))
})

test('stale source is retryable and never READY', async () => {
  const evaluation = await new ProjectionReadinessGate(new FakeHdsrcSourceAdapter({ stale: true }), new FakeMrmicSurfaceAdapter()).evaluate(request)
  assert.equal(evaluation.result.ready, false)
  assert.equal(evaluation.result.blockingError.code, 'STALE_SOURCE')
  assert.equal(evaluation.result.blockingError.retryable, true)
})

test('structural integrity failure is non-retryable and never READY', async () => {
  const evaluation = await new ProjectionReadinessGate(new FakeHdsrcSourceAdapter({ integrityFailure: true }), new FakeMrmicSurfaceAdapter()).evaluate(request)
  assert.equal(evaluation.result.ready, false)
  assert.equal(evaluation.result.blockingError.code, 'INTEGRITY_FAILURE')
  assert.equal(evaluation.result.blockingError.retryable, false)
})

test('source read denial fails before protected source resolution', async () => {
  const denied = { ...request, authorityContext: { ...request.authorityContext, sourceRead: false } }
  await assert.rejects(() => new ProjectionReadinessGate(new FakeHdsrcSourceAdapter(), new FakeMrmicSurfaceAdapter()).evaluate(denied), error => error?.code === 'UNAUTHORIZED' && error?.source === 'hdsrc')
})

test('surface authority remains an independent readiness check', async () => {
  const denied = { ...request, authorityContext: { ...request.authorityContext, surfaceProject: false } }
  const evaluation = await new ProjectionReadinessGate(new FakeHdsrcSourceAdapter(), new FakeMrmicSurfaceAdapter()).evaluate(denied)
  assert.equal(evaluation.result.ready, false)
  assert.equal(evaluation.result.blockingError.code, 'UNAUTHORIZED')
  assert.equal(evaluation.result.blockingError.source, 'mrmic')
})

test('unsupported observation lane fails closed', async () => {
  const hdsrc = new FakeHdsrcSourceAdapter({ observationModes: ['human_preview'] })
  await assert.rejects(() => new ProjectionReadinessGate(hdsrc, new FakeMrmicSurfaceAdapter()).evaluate(request), error => error?.code === 'UNSUPPORTED')
})
