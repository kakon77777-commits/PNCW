import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`
const D3=`sha256:${'3'.repeat(64)}`
const D4=`sha256:${'4'.repeat(64)}`

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

const sourceIdentity={authority:'hdsrc',sourceId:'state:demo-4096',revision:12,digest:D1}
const sourceCaps={provider:'hdsrc',providerVersion:'0.10',observationModes:['machine_carrier'],carrierProfiles:['HMBT1'],partialRead:true,canonicalMutation:false}
const surfaceCaps={provider:'mrmic',providerVersion:'0.14',portalSchema:'native_resource_portal_v1',readOnlyProjection:true,canonicalMutation:false}
const validError={schema:'pncw-error/v1',code:'STALE_SOURCE',stage:'READINESS',retryable:true,source:'hdsrc',message:'source advanced'}

const validManifest={
  schema:'pncw-projection-manifest/v1',resultId:'pncw:result:test',sourceIdentity,
  projectionProfile:{observer:validRequest.observer,representation:validRequest.representation,scope:validRequest.scope,requestedMode:'machine_carrier'},
  materializationRefs:[{provider:'hdsrc',materializationId:'mat:test',sourceId:sourceIdentity.sourceId,sourceRevision:12,sourceDigest:D1,carrierProfile:'HMBT1',materializationDigest:D2,machineResourceUri:'hdsrc://machine',previewResourceUri:'hdsrc://preview',partialRead:true}],
  surfaceRefs:[{provider:'mrmic',surfaceId:'surface:test',portalSchema:'native_resource_portal_v1',sourceId:sourceIdentity.sourceId,sourceRevision:12,sourceDigest:D1,materializationId:'mat:test',materializationDigest:D2,bindingDigest:D3,visible:false}],
  integrityRefs:[{provider:'hdsrc',kind:'HMBT1',digest:D2,structuralVerified:true}],
  authorityRefs:[{provider:'hdsrc',principalId:'principal:test',grant:'hdsrc:read',authorized:true},{provider:'mrmic',principalId:'principal:test',grant:'mrmic:project',authorized:true}],
  residencyMap:[{regionRef:'manifest:root',state:'RESIDENT',bytesResident:1,bytesTotal:1}],version:1,manifestDigest:D4
}
const validReadiness={schema:'pncw-readiness-result/v1',requestId:'request:demo',ready:true,checks:[{name:'source-fresh',passed:true}],sourceSnapshot:sourceIdentity,capabilitySnapshot:{source:sourceCaps,surface:surfaceCaps}}
const validVerification={schema:'pncw-verification-result/v1',resultId:'pncw:result:test',verified:true,manifestDigest:D4,checks:[{name:'manifest-digest',passed:true}],verificationDigest:D3}
const validVisibility={schema:'pncw-visibility-state/v1',resultId:'pncw:result:test',state:'VISIBLE',visibilityCommitId:'pncw:visibility:test',revealMode:'ATOMIC_ARTIFACT'}

const contractCases=[
  ['projection-request','contracts/projection-request/v1.schema.json',validRequest],
  ['projection-manifest','contracts/projection-manifest/v1.schema.json',validManifest],
  ['readiness-result','contracts/readiness-result/v1.schema.json',validReadiness],
  ['verification-result','contracts/verification-result/v1.schema.json',validVerification],
  ['visibility-state','contracts/visibility-state/v1.schema.json',validVisibility],
  ['error-envelope','contracts/error-envelope/v1.schema.json',validError],
]

test('projection request schema is closed and runtime assertion agrees', async () => {
  const schema = JSON.parse(await readFile('contracts/projection-request/v1.schema.json', 'utf8'))
  assert.equal(schema.additionalProperties, false)
  const { assertProjectionRequest } = await import('../../dist/packages/core/src/index.js')
  assert.deepEqual(assertProjectionRequest(validRequest), validRequest)
  assert.throws(() => assertProjectionRequest({ ...validRequest, injected: true }))
})

test('all six schema documents are present and top-level closed', async () => {
  for (const [,path] of contractCases) {
    const candidate = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(candidate.type, 'object')
    assert.equal(candidate.additionalProperties, false)
  }
})

test('Ajv validates positive fixtures for all six Draft 2020-12 contracts', async t => {
  let Ajv2020
  try { ;({ default: Ajv2020 } = await import('ajv/dist/2020.js')) }
  catch { t.skip('Ajv unavailable in offline local execution; GitHub CI runs this check'); return }
  for(const [name,path,fixture] of contractCases){
    const ajv=new Ajv2020({allErrors:true,strict:true})
    const schema=JSON.parse(await readFile(path,'utf8'))
    const validate=ajv.compile(schema)
    assert.equal(validate(fixture),true,`${name} positive fixture: ${JSON.stringify(validate.errors)}`)
    assert.equal(validate({...fixture,injected:true}),false,`${name} must reject top-level unknown field`)
  }
})

test('nested readiness and verification objects are closed exactly like runtime types', async t => {
  let Ajv2020
  try { ;({ default: Ajv2020 } = await import('ajv/dist/2020.js')) }
  catch { t.skip('Ajv unavailable in offline local execution; GitHub CI runs this check'); return }
  const readinessSchema=JSON.parse(await readFile('contracts/readiness-result/v1.schema.json','utf8'))
  const verifyReadiness=new Ajv2020({allErrors:true,strict:true}).compile(readinessSchema)
  assert.equal(verifyReadiness({...validReadiness,capabilitySnapshot:{...validReadiness.capabilitySnapshot,source:{...sourceCaps,injected:true}}}),false,'source capability snapshot must reject unknown nested field')
  assert.equal(verifyReadiness({...validReadiness,ready:false,blockingError:{...validError,injected:true}}),false,'blockingError must reject unknown nested field')

  const verificationSchema=JSON.parse(await readFile('contracts/verification-result/v1.schema.json','utf8'))
  const verifyVerification=new Ajv2020({allErrors:true,strict:true}).compile(verificationSchema)
  assert.equal(verifyVerification({...validVerification,verified:false,failure:{...validError,stage:'VERIFICATION',retryable:false,injected:true}}),false,'verification failure must reject unknown nested field')
})
