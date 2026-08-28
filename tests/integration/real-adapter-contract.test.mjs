import test from 'node:test'
import assert from 'node:assert/strict'

const real = await import('../../dist/adapters/real-mrmic-hdsrc/src/index.js').catch(() => ({}))
const { assertReadOnlyPortSurface } = await import('../../dist/packages/adapters/src/index.js')

const RAW_STATE = {
  schema:'hdsrc-state-ref/v1', stateId:'state:4096', stateRevision:10,
  stateDigest:`sha256:${'a'.repeat(64)}`, dimension:4096, authority:'hdsrc'
}
const RAW_MAT = {
  schema:'hdsrc-materialization/v1', materializationId:'mat:4096', stateId:'state:4096', stateRevision:10,
  stateDigest:RAW_STATE.stateDigest, materializationDigest:`sha256:${'b'.repeat(64)}`, carrierProfile:'HMBT1',
  spatializationId:'RCM_PP', logicalScale:32, workloadDigest:`sha256:${'c'.repeat(64)}`,
  machineResourceUri:'hdsrc://state/state:4096/materializations/mat:4096/machine',
  previewResourceUri:'hdsrc://state/state:4096/materializations/mat:4096/preview'
}

class ExternalProviderFixture {
  stale=false
  lastMaterializeRequest=null
  async capabilities(){ return {schema:'hdsrc-provider-capabilities/v1',providerVersion:'0.10',stateProfiles:['HDSRC-SymbolicState'],carrierProfiles:['HMBT1'],planningProfiles:['HPCM2','HMR1'],observationModes:['human_preview','machine_carrier','structured_manifest'],partialRead:true,oracleFallback:true,canonicalMutation:false} }
  async state(ref,ctx){ if(!ctx.allowHdsrcRead) throw Object.assign(new Error('denied'),{code:'UNAUTHORIZED',retryable:false}); assert.equal(ref,'hdsrc://state/state:4096'); return structuredClone(RAW_STATE) }
  async materializeResolved(request,ctx){ this.lastMaterializeRequest=structuredClone(request); if(!ctx.allowHdsrcRead) throw Object.assign(new Error('denied'),{code:'UNAUTHORIZED',retryable:false}); assert.equal(request.workload.observationMode,'machine_carrier'); return {decision:{schema:'hdsrc-materialization-decision/v1',decision:'oracle_fallback',confidence:{mode:'empirical',requiresOracle:true,reason:'outside_current_trust_region'}},materializationRef:'hdsrc://state/state:4096/materializations/mat:4096',materialization:structuredClone(RAW_MAT),oracleUsed:true} }
  async materialization(_ref,_ctx){ if(this.stale) throw Object.assign(new Error('changed source'),{code:'STALE_STATE',retryable:true}); return structuredClone(RAW_MAT) }
  async readPartialRelationBlockRow(ref,row,_ctx){ assert.equal(ref,'hdsrc://state/state:4096/materializations/mat:4096'); return {blockRow:row,srcStart:0,srcLength:32,relations:[{src:0,dst:1,kind:'edge',qsim:7}],compressedBytesRead:1272,carrierBytes:286313} }
  close(){}
}

const request = {
  schema:'pncw-projection-request/v1',requestId:'request:real-adapter',sourceRef:'hdsrc://state/state:4096',
  observer:{observerId:'observer:test',observerType:'ai',profile:'machine'},representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
  scope:{scopeId:'scope:block-row-0',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',
  authorityContext:{principalId:'principal:real',sourceRead:true,surfaceProject:true}
}

test('real HDSRC adapter maps LocalProcessHdsrcProvider-compatible surface without reimplementing carrier semantics', async () => {
  assert.equal(typeof real.RealHdsrcSourceAdapter,'function')
  const registry=new real.RealMaterializationRegistry()
  const sourceAdapter=new real.RealHdsrcSourceAdapter(new ExternalProviderFixture(),registry)
  assertReadOnlyPortSurface(sourceAdapter)
  const caps=await sourceAdapter.getCapabilities()
  assert.equal(caps.canonicalMutation,false)
  const source=await sourceAdapter.resolveSource(request.sourceRef,request.authorityContext)
  assert.deepEqual(source,{authority:'hdsrc',sourceId:'state:4096',revision:10,digest:RAW_STATE.stateDigest})
  const mat=await sourceAdapter.resolveMaterialization(request,source,request.authorityContext)
  assert.equal(mat.materializationId,'mat:4096')
  assert.equal(registry.get('mat:4096').raw.spatializationId,'RCM_PP')
  assert.equal((await sourceAdapter.verifyMaterialization(mat,request.authorityContext)).verified,true)
  const region=await sourceAdapter.readSelectedRegion(mat,'relation:block-row:0',request.authorityContext)
  assert.equal(region.bytesRead,1272)
  assert.equal(region.totalCarrierBytes,286313)
})


test('real HDSRC adapter accepts an explicit fixed workload profile without widening ProjectionRequest', async () => {
  const provider=new ExternalProviderFixture()
  const registry=new real.RealMaterializationRegistry()
  const adapter=new real.RealHdsrcSourceAdapter(provider,registry,{expectedSpan:8,expectedReuse:16,goalClass:'pncw_projection'})
  const source=await adapter.resolveSource(request.sourceRef,request.authorityContext)
  await adapter.resolveMaterialization(request,source,request.authorityContext)
  assert.equal(provider.lastMaterializeRequest.workload.expectedSpan,8)
  assert.equal(provider.lastMaterializeRequest.workload.expectedReuse,16)
  assert.equal(provider.lastMaterializeRequest.workload.goalClass,'pncw_projection')
  assert.equal(request.scope.regionRefs.length,1)
})

test('real adapter preserves STALE_STATE as retryable freshness failure', async () => {
  const provider=new ExternalProviderFixture()
  const registry=new real.RealMaterializationRegistry()
  const adapter=new real.RealHdsrcSourceAdapter(provider,registry)
  const source=await adapter.resolveSource(request.sourceRef,request.authorityContext)
  const mat=await adapter.resolveMaterialization(request,source,request.authorityContext)
  provider.stale=true
  const freshness=await adapter.checkFreshness(source,mat,request.authorityContext)
  assert.equal(freshness.fresh,false)
  assert.equal(freshness.retryable,true)
})

test('real MRMIC surface adapter keeps surface authority independent and passes raw HDSRC materialization to portal factory', async () => {
  assert.equal(typeof real.RealMrmicSurfaceAdapter,'function')
  const registry=new real.RealMaterializationRegistry()
  registry.set('mat:4096',{ref:'hdsrc://state/state:4096/materializations/mat:4096',raw:structuredClone(RAW_MAT)})
  let received
  const portalFactory=input=>{ received=input; return {id:input.canvasObjectId,metadata:{portalSchema:'native_resource_portal_v1',hdsrc:{materializationId:input.materialization.materializationId}}} }
  const surfaceAdapter=new real.RealMrmicSurfaceAdapter(portalFactory,registry,{allowedPrincipals:['principal:real']})
  assertReadOnlyPortSurface(surfaceAdapter)
  assert.equal((await surfaceAdapter.checkProjectionAuthority({...request.authorityContext,surfaceProject:false})).authorized,false)
  const prepared=await surfaceAdapter.prepareSurface(request,request.authorityContext)
  const source={authority:'hdsrc',sourceId:'state:4096',revision:10,digest:RAW_STATE.stateDigest}
  const mat={provider:'hdsrc',materializationId:'mat:4096',sourceId:'state:4096',sourceRevision:10,sourceDigest:RAW_STATE.stateDigest,carrierProfile:'HMBT1',materializationDigest:RAW_MAT.materializationDigest,machineResourceUri:RAW_MAT.machineResourceUri,previewResourceUri:RAW_MAT.previewResourceUri,partialRead:true}
  const bound=await surfaceAdapter.bindProjection(prepared,source,mat,request.authorityContext)
  assert.equal(bound.visible,false)
  assert.equal(received.materialization.workloadDigest,RAW_MAT.workloadDigest)
  assert.equal(received.transform.width,1024)
  assert.equal((await surfaceAdapter.surfaceState(bound.surfaceId)).bindingDigest,bound.bindingDigest)
})

test('dynamic real-adapter loader is available for external MRMIC dist checkout', () => {
  assert.equal(typeof real.createRealMrmicHdsrcAdapters,'function')
})
