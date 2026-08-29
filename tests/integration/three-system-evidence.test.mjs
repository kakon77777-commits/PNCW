import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const evidence = JSON.parse(await readFile('artifacts/three-system-e2e-v0.1.0.json', 'utf8'))
const schema = JSON.parse(await readFile('docs/evidence/three-system-e2e-v0.1.0.schema.json', 'utf8'))
const { sha256Digest } = await import('../../dist/packages/core/src/index.js')

test('committed three-system E2E evidence is closed and schema-valid', async t => {
  let Ajv2020
  try { ({ default: Ajv2020 } = await import('ajv/dist/2020.js')) }
  catch { t.skip('Ajv unavailable in offline local execution; GitHub CI enforces this gate'); return }
  const ajv = new Ajv2020({ allErrors:true, strict:true })
  const validate = ajv.compile(schema)
  assert.equal(validate(evidence), true, JSON.stringify(validate.errors))
})

test('three-system evidence proves actual runtime path without widening claim boundary', () => {
  assert.equal(evidence.executedFresh, true)
  assert.equal(evidence.replayByteIdentical, true)
  assert.ok(evidence.replayCount >= 2)
  assert.equal(evidence.runtime.actualMrmicCheckoutExecuted, true)
  assert.equal(evidence.runtime.actualLocalProcessHdsrcProviderExecuted, true)
  assert.equal(evidence.runtime.actualPythonHostExecuted, true)
  assert.equal(evidence.runtime.testStubRuntimeUsed, false)
  assert.equal(evidence.runtime.canonicalMutation, false)
  assert.equal(evidence.pncw.state, 'VISIBLE')
  assert.ok(evidence.pncw.residentFraction > 0 && evidence.pncw.residentFraction < 1)
  assert.ok(evidence.partialRead.compressedBytesRead > 0)
  assert.ok(evidence.partialRead.compressedBytesRead < evidence.partialRead.carrierBytes)
  assert.equal(evidence.claimBoundary.freshSameWorkspaceThreeSystemE2E, true)
  assert.equal(evidence.claimBoundary.canonicalHdsrcWriteback, false)
  assert.equal(evidence.claimBoundary.worldMutationCommit, false)
  assert.equal(evidence.claimBoundary.universalScalingClaim, false)
})

test('three-system evidence semantic digest excludes only its own digest field', () => {
  const { semanticEvidenceDigest, ...payload } = evidence
  assert.equal(sha256Digest(payload), semanticEvidenceDigest)
})
