import test from 'node:test'
import assert from 'node:assert/strict'

const hdsrcRoot=process.env.PNCW_HDSRC_V010_ROOT
const hdsrcZip=process.env.PNCW_HDSRC_V010_ZIP
const realDemo=await import('../../dist/examples/vertical-slice/src/real.js').catch(()=>({}))

test('fresh real HDSRC v0.10 4096D execution closes PNCW visibility with partial residency', {skip:!(hdsrcRoot&&hdsrcZip)}, async () => {
  assert.equal(typeof realDemo.runFreshRealHdsrcProjection,'function')
  const evidence=await realDemo.runFreshRealHdsrcProjection({hdsrcRoot,hdsrcReleaseZip:hdsrcZip,pythonExecutable:process.env.PNCW_PYTHON??'python3'})
  assert.equal(evidence.schema,'pncw-real-4096d-evidence/v0.1')
  assert.equal(evidence.freshHdsrcRuntimeExecuted,true)
  assert.equal(evidence.hdsrcReleaseSha256,'583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217')
  assert.equal(evidence.source.digest,'sha256:ea48a90eddc727b1684cf72204ddeaa720c6b67fe036561e05537622b0c12f85')
  assert.equal(evidence.source.dimension,4096)
  assert.equal(evidence.source.nodeCount,72)
  assert.equal(evidence.source.relationCount,576)
  assert.equal(evidence.decision.decision,'oracle_fallback')
  assert.equal(evidence.materialization.carrierProfile,'HMBT1')
  assert.equal(evidence.materialization.logicalScale,32)
  assert.equal(evidence.materialization.spatializationId,'RCM_PP')
  assert.equal(evidence.materialization.materializationDigest,'sha256:4127f98f00cca7d85d2975e13186a2373814dbe0b53d611cf74215695e9e6c5b')
  assert.equal(evidence.partial.compressedBytesRead,1272)
  assert.equal(evidence.partial.carrierBytes,286313)
  assert.equal(evidence.visibility.state,'VISIBLE')
  assert.ok(evidence.visibility.residentFraction>0 && evidence.visibility.residentFraction<1)
  assert.equal(evidence.partial.compressedBytesRead<evidence.partial.carrierBytes,true)
  assert.equal(evidence.mrmic.mode,'source-grounded-portal-factory')
  assert.equal(evidence.mrmic.actualCheckoutExecuted,false)
})

test('external MRMIC checkout full path remains an explicit separate capability', () => {
  assert.equal(typeof realDemo.runExternalCheckoutProjection,'function')
})
