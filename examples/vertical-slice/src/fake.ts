import { FakeHdsrcSourceAdapter } from '../../../adapters/fake-hdsrc/src/index.js'
import { FakeMrmicSurfaceAdapter } from '../../../adapters/fake-mrmic/src/index.js'
import { buildProjectionManifest } from '../../../packages/core/src/index.js'
import { ProjectionReadinessGate } from '../../../packages/readiness/src/index.js'
import { ProjectionVerifier } from '../../../packages/verification/src/index.js'
import { VisibilityCommitStore, residentFraction } from '../../../packages/visibility/src/index.js'

export const FAKE_VERTICAL_REQUEST = {
  schema:'pncw-projection-request/v1' as const,
  requestId:'request:fake-vertical-slice',
  sourceRef:'hdsrc://state/state:demo-4096',
  observer:{observerId:'observer:fake-demo',observerType:'ai' as const,profile:'machine'},
  representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
  scope:{scopeId:'scope:block-row-0',regionRefs:['relation:block-row:0']},
  requestedMode:'machine_carrier' as const,
  authorityContext:{principalId:'principal:fake-demo',sourceRead:true,surfaceProject:true},
}

export interface FakeVerticalSliceEvidenceV1 {
  schema:'pncw-fake-vertical-slice-evidence/v0.1'
  requestId:string
  resultId:string
  manifestDigest:string
  verificationDigest:string
  visibilityCommitId:string
  readinessReady:boolean
  verificationVerified:boolean
  visibilityState:'VISIBLE'
  visibilityEvents:number
  residentFraction:number
  partialBytesRead:number
  totalCarrierBytes:number
  lifecycle:string[]
}

export async function runFakeVerticalSlice(): Promise<FakeVerticalSliceEvidenceV1> {
  const hdsrc=new FakeHdsrcSourceAdapter()
  const mrmic=new FakeMrmicSurfaceAdapter()
  const readiness=await new ProjectionReadinessGate(hdsrc,mrmic).evaluate(FAKE_VERTICAL_REQUEST)
  if (!readiness.result.ready) throw new Error('fake readiness unexpectedly failed')
  const prepared=await mrmic.prepareSurface(FAKE_VERTICAL_REQUEST,FAKE_VERTICAL_REQUEST.authorityContext)
  const surface=await mrmic.bindProjection(prepared,readiness.source,readiness.materialization,FAKE_VERTICAL_REQUEST.authorityContext)
  const manifest=buildProjectionManifest({
    request:FAKE_VERTICAL_REQUEST,source:readiness.source,materialization:readiness.materialization,surface,
    authorityRefs:readiness.authorityRefs,structuralIntegrity:readiness.structuralIntegrity,
    residencyMap:[
      {regionRef:'manifest:root',state:'RESIDENT',bytesResident:1,bytesTotal:1},
      {regionRef:'relation:block-row:0',state:'AVAILABLE',bytesResident:0,bytesTotal:286313},
    ],version:1,
  })
  const verification=await new ProjectionVerifier(hdsrc,mrmic).verify(FAKE_VERTICAL_REQUEST,manifest)
  if (!verification.verified) throw new Error(`fake verification unexpectedly failed: ${verification.failure?.code ?? 'unknown'}`)
  const store=new VisibilityCommitStore()
  const receipt=store.commit({lifecycleState:'VERIFIED',manifest,verification,revealMode:'ATOMIC_ARTIFACT'})
  const region=await hdsrc.readSelectedRegion(readiness.materialization,'relation:block-row:0',FAKE_VERTICAL_REQUEST.authorityContext)
  return {
    schema:'pncw-fake-vertical-slice-evidence/v0.1',requestId:FAKE_VERTICAL_REQUEST.requestId,resultId:manifest.resultId,
    manifestDigest:manifest.manifestDigest,verificationDigest:verification.verificationDigest,visibilityCommitId:receipt.visibilityCommitId,
    readinessReady:readiness.result.ready,verificationVerified:verification.verified,visibilityState:receipt.state,visibilityEvents:store.eventCount,
    residentFraction:residentFraction(store.getVisible(manifest.resultId)),partialBytesRead:region.bytesRead,totalCarrierBytes:region.totalCarrierBytes,
    lifecycle:['REQUESTED','RESOLVED','READY','PROJECTED','VERIFIED','VISIBLE'],
  }
}
