import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const schemaPaths = [
  'contracts/projection-route-candidate/v1.schema.json',
  'contracts/projection-budget/v1.schema.json',
  'contracts/frozen-planning-input/v1.schema.json',
  'contracts/projection-planning-request/v1.schema.json',
  'contracts/gcm-plan-snapshot/v1.schema.json',
  'contracts/planning-receipt/v1.schema.json',
  'contracts/planning-failure/v1.schema.json',
  'contracts/projection-replan-request/v1.schema.json',
]

test('v0.2 planning schemas are present and closed', async () => {
  for (const path of schemaPaths) {
    const schema = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
    assert.equal(schema.type, 'object')
    assert.equal(schema.additionalProperties, false)
  }
})

test('canonical decimal parser rejects non-canonical spellings', async () => {
  const { assertCanonicalDecimal } =
    await import('../../dist/packages/planning/src/index.js')

  for (const value of ['01', '1.', '.5', '1e3', '-0', 'NaN', 'Infinity', '1.20']) {
    assert.throws(() => assertCanonicalDecimal(value))
  }

  for (const value of ['0', '1', '-1', '0.25', '1000.125']) {
    assert.equal(assertCanonicalDecimal(value), value)
  }

  assert.throws(() => assertCanonicalDecimal('-1', { nonNegative: true }))
})
