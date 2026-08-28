import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const validRequest = {
  schema: 'pncw-projection-request/v1',
  requestId: 'request:demo',
  sourceRef: 'hdsrc://state/state:demo-4096',
  observer: { observerId: 'observer:test', observerType: 'ai', profile: 'machine' },
  representation: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
  scope: { scopeId: 'scope:block-row-0', regionRefs: ['relation:block-row:0'] },
  requestedMode: 'machine_carrier',
  authorityContext: { principalId: 'principal:test', sourceRead: true, surfaceProject: true }
}

test('projection request schema is closed and runtime assertion agrees', async () => {
  const schema = JSON.parse(await readFile('contracts/projection-request/v1.schema.json', 'utf8'))
  assert.equal(schema.additionalProperties, false)
  const { assertProjectionRequest } = await import('../../dist/packages/core/src/index.js')
  assert.deepEqual(assertProjectionRequest(validRequest), validRequest)
  assert.throws(() => assertProjectionRequest({ ...validRequest, injected: true }))
})

test('all six schema documents are present and closed', async () => {
  for (const path of [
    'contracts/projection-request/v1.schema.json',
    'contracts/projection-manifest/v1.schema.json',
    'contracts/readiness-result/v1.schema.json',
    'contracts/verification-result/v1.schema.json',
    'contracts/visibility-state/v1.schema.json',
    'contracts/error-envelope/v1.schema.json'
  ]) {
    const candidate = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(candidate.type, 'object')
    assert.equal(candidate.additionalProperties, false)
  }
})

test('Ajv validates all six schemas when dependency is installed', async t => {
  let Ajv
  try {
    ;({ default: Ajv } = await import('ajv'))
  } catch {
    t.skip('Ajv unavailable in offline local execution; GitHub CI runs this check')
    return
  }
  const ajv = new Ajv({ allErrors: true, strict: true })
  const paths = [
    'contracts/projection-request/v1.schema.json','contracts/projection-manifest/v1.schema.json',
    'contracts/readiness-result/v1.schema.json','contracts/verification-result/v1.schema.json',
    'contracts/visibility-state/v1.schema.json','contracts/error-envelope/v1.schema.json'
  ]
  const schemas = []
  for (const path of paths) {
    const schema = JSON.parse(await readFile(path, 'utf8'))
    ajv.compile(schema)
    schemas.push(schema)
  }
  const validate = ajv.compile(schemas[0])
  assert.equal(validate(validRequest), true)
  assert.equal(validate({ ...validRequest, injected: true }), false)
})
