import test from 'node:test'
import assert from 'node:assert/strict'

const core = await import('../../dist/packages/core/src/index.js').catch(() => ({}))

test('canonical digest ignores object key order', () => {
  assert.equal(typeof core.sha256Digest, 'function')
  assert.equal(core.sha256Digest({ z: 1, a: { y: 2, x: 3 } }), core.sha256Digest({ a: { x: 3, y: 2 }, z: 1 }))
})

test('manifest digest excludes its own digest field', () => {
  assert.equal(typeof core.deriveManifestDigest, 'function')
  const a = { schema: 'pncw-projection-manifest/v1', resultId: 'result:1', version: 1, payload: { x: 1 }, manifestDigest: `sha256:${'a'.repeat(64)}` }
  const b = { ...a, manifestDigest: `sha256:${'b'.repeat(64)}` }
  assert.equal(core.deriveManifestDigest(a), core.deriveManifestDigest(b))
})

test('RID and VCID are deterministic and wall clock independent', () => {
  assert.equal(typeof core.deriveResultId, 'function')
  const sourceIdentity = { authority: 'hdsrc', sourceId: 'state:1', revision: 4, digest: `sha256:${'1'.repeat(64)}` }
  const input = {
    sourceIdentity,
    scope: { scopeId: 'scope:1', regionRefs: ['r:1'] },
    observerProfile: { observerId: 'observer:1', observerType: 'ai', profile: 'machine' },
    projectionProfile: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
    protocolVersion: 'pncw/0.1'
  }
  assert.equal(core.deriveResultId(input), core.deriveResultId(structuredClone(input)))
  const commit = { resultId: 'result:1', manifestDigest: `sha256:${'2'.repeat(64)}`, verificationDigest: `sha256:${'3'.repeat(64)}`, revealMode: 'ATOMIC_ARTIFACT' }
  assert.equal(core.deriveVisibilityCommitId(commit), core.deriveVisibilityCommitId({ ...commit, visibleAt: '2099-01-01T00:00:00Z' }))
})

test('only legal lifecycle steps pass and READY cannot jump to VISIBLE', () => {
  assert.equal(typeof core.assertTransition, 'function')
  assert.equal(core.assertTransition('VERIFIED', 'VISIBLE'), 'VISIBLE')
  assert.throws(() => core.assertTransition('READY', 'VISIBLE'), error => error?.code === 'INVALID_TRANSITION')
})

test('upstream stale and integrity errors remain distinct', () => {
  assert.equal(typeof core.mapUpstreamError, 'function')
  const stale = core.mapUpstreamError({ code: 'STALE_STATE', retryable: true, message: 'changed state' }, 'hdsrc', 'SOURCE')
  const bad = core.mapUpstreamError({ code: 'INTEGRITY_FAILURE', retryable: false, message: 'bad bytes' }, 'hdsrc', 'SOURCE')
  assert.equal(stale.code, 'STALE_SOURCE')
  assert.equal(stale.retryable, true)
  assert.equal(bad.code, 'INTEGRITY_FAILURE')
  assert.equal(bad.retryable, false)
})
