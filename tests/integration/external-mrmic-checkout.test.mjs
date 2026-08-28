import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root=process.env.PNCW_MRMIC_DIST_ROOT
const real=await import('../../dist/adapters/real-mrmic-hdsrc/src/index.js')

const RAW_MAT={
  schema:'hdsrc-materialization/v1',materializationId:'mat:checkout-fixture',stateId:'state:checkout',stateRevision:3,
  stateDigest:`sha256:${'a'.repeat(64)}`,materializationDigest:`sha256:${'b'.repeat(64)}`,carrierProfile:'HMBT1',
  spatializationId:'RCM_PP',logicalScale:32,workloadDigest:`sha256:${'c'.repeat(64)}`,
  machineResourceUri:'hdsrc://state/state:checkout/materializations/mat:checkout-fixture/machine',
  previewResourceUri:'hdsrc://state/state:checkout/materializations/mat:checkout-fixture/preview'
}

test('actual MRMIC checkout exports Phase 14 local-process provider and portal factory', {skip:!root}, async()=>{
  const local=await import(pathToFileURL(resolve(root,'packages/provider-hdsrc/src/local-process.js')).href)
  const index=await import(pathToFileURL(resolve(root,'packages/provider-hdsrc/src/index.js')).href)
  assert.equal(typeof local.LocalProcessHdsrcProvider,'function')
  assert.equal(typeof index.createHdsrcMaterializationPortal,'function')

  const registry=new real.RealMaterializationRegistry()
  registry.set(RAW_MAT.materializationId,{ref:'hdsrc://state/state:checkout/materializations/mat:checkout-fixture',raw:RAW_MAT})
  const surface=new real.RealMrmicSurfaceAdapter(index.createHdsrcMaterializationPortal,registry,{allowedPrincipals:['principal:checkout']})
  const request={schema:'pncw-projection-request/v1',requestId:'request:checkout',sourceRef:'hdsrc://state/state:checkout',observer:{observerId:'observer:checkout',observerType:'ai',profile:'machine'},representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},scope:{scopeId:'scope:checkout',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',authorityContext:{principalId:'principal:checkout',sourceRead:true,surfaceProject:true}}
  const prepared=await surface.prepareSurface(request,request.authorityContext)
  const source={authority:'hdsrc',sourceId:'state:checkout',revision:3,digest:RAW_MAT.stateDigest}
  const mat={provider:'hdsrc',materializationId:RAW_MAT.materializationId,sourceId:'state:checkout',sourceRevision:3,sourceDigest:RAW_MAT.stateDigest,carrierProfile:'HMBT1',materializationDigest:RAW_MAT.materializationDigest,machineResourceUri:RAW_MAT.machineResourceUri,previewResourceUri:RAW_MAT.previewResourceUri,partialRead:true}
  const bound=await surface.bindProjection(prepared,source,mat,request.authorityContext)
  assert.equal(bound.portalSchema,'native_resource_portal_v1')
  assert.equal(bound.visible,false)
  assert.equal((await surface.surfaceState(bound.surfaceId)).bindingDigest,bound.bindingDigest)
})
