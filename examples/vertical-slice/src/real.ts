import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import {
  buildProjectionManifest,
  PncwError,
  sha256Digest,
  type ProjectionRequestV1,
} from '../../../packages/core/src/index.js'
import { ProjectionReadinessGate } from '../../../packages/readiness/src/index.js'
import { ProjectionVerifier } from '../../../packages/verification/src/index.js'
import { VisibilityCommitStore, residentFraction } from '../../../packages/visibility/src/index.js'
import {
  RealHdsrcSourceAdapter,
  RealMaterializationRegistry,
  RealMrmicSurfaceAdapter,
  createRealMrmicHdsrcAdapters,
} from '../../../adapters/real-mrmic-hdsrc/src/index.js'

interface FreshRun {
  schema:string
  releaseZipSha256:string
  source:Record<string,unknown>
  workload:Record<string,unknown>
  decision:Record<string,unknown>
  materializationRef:string
  materialization:Record<string,unknown>
  oracleUsed:boolean
  partial:Record<string,unknown>
  testStubRuntimeUsed:boolean
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string,unknown>
}
function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number)<0) throw new Error(`${label} must be a non-negative integer`)
  return value as number
}
function text(value: unknown,label:string):string {
  if(typeof value!=='string'||!value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

class FreshRealHdsrcEvidenceProvider {
  readonly #run:FreshRun
  constructor(run:FreshRun){this.#run=structuredClone(run)}
  async capabilities(){return {schema:'hdsrc-provider-capabilities/v1',providerVersion:'0.10-fresh-runtime',stateProfiles:['HDSRC-SymbolicState'],carrierProfiles:['HMBT1'],planningProfiles:['HPCM2','HMR1'],observationModes:['human_preview','machine_carrier','structured_manifest'],partialRead:true,oracleFallback:true,canonicalMutation:false}}
  async state(ref:string,context:Record<string,unknown>){
    if(context.allowHdsrcRead!==true) throw Object.assign(new Error('HDSRC read denied'),{code:'UNAUTHORIZED',retryable:false})
    if(ref!=='hdsrc://state/state:4096') throw Object.assign(new Error('not found'),{code:'RESOURCE_NOT_FOUND',retryable:false})
    const s=record(this.#run.source,'source')
    return {schema:'hdsrc-state-ref/v1',stateId:s.stateId,stateRevision:s.stateRevision,stateDigest:s.stateDigest,dimension:s.dimension,authority:'hdsrc'}
  }
  async materializeResolved(request:Record<string,unknown>,context:Record<string,unknown>){
    if(context.allowHdsrcRead!==true) throw Object.assign(new Error('HDSRC read denied'),{code:'UNAUTHORIZED',retryable:false})
    const workload=record(request.workload,'workload')
    if(workload.expectedSpan!==8 || workload.expectedReuse!==16) throw Object.assign(new Error('fresh runtime workload profile mismatch'),{code:'INVALID_REQUEST',retryable:false})
    return {decision:structuredClone(this.#run.decision),materializationRef:this.#run.materializationRef,materialization:structuredClone(this.#run.materialization),oracleUsed:this.#run.oracleUsed}
  }
  async materialization(ref:string,context:Record<string,unknown>){
    if(context.allowHdsrcRead!==true) throw Object.assign(new Error('HDSRC read denied'),{code:'UNAUTHORIZED',retryable:false})
    if(ref!==this.#run.materializationRef) throw Object.assign(new Error('not found'),{code:'RESOURCE_NOT_FOUND',retryable:false})
    return structuredClone(this.#run.materialization)
  }
  async readPartialRelationBlockRow(ref:string,row:number,context:Record<string,unknown>){
    if(context.allowHdsrcRead!==true) throw Object.assign(new Error('HDSRC read denied'),{code:'UNAUTHORIZED',retryable:false})
    if(ref!==this.#run.materializationRef || row!==0) throw Object.assign(new Error('unsupported partial read'),{code:'INVALID_REQUEST',retryable:false})
    return structuredClone(this.#run.partial)
  }
  close(){}
}

// Mirrors the exact Phase 14 native_resource_portal_v1 shape used by MRMIC's
// createHdsrcMaterializationPortal. It is deliberately labelled as a source-
// grounded fixture and is NOT claimed as execution of an MRMIC checkout.
function sourceGroundedMrmicPortalFactory(input:Record<string,unknown>):Record<string,unknown>{
  const materialization=record(input.materialization,'materialization')
  const machine=text(materialization.machineResourceUri,'machineResourceUri')
  const suffix='/machine'
  if(!machine.endsWith(suffix)) throw new Error('machineResourceUri must identify machine member')
  const resourceRoot=machine.slice(0,-suffix.length)
  if(materialization.previewResourceUri!==`${resourceRoot}/preview`) throw new Error('previewResourceUri must bind same materialization')
  return {
    id:input.canvasObjectId,canvasId:input.canvasId,type:'resource_portal',transform:structuredClone(input.transform),style:{},
    content:{text:input.title,previewUri:materialization.previewResourceUri},childIds:[],bindings:[],
    metadata:{portalSchema:'native_resource_portal_v1',portal:{portalId:input.portalId,pmwWorkspaceId:input.pmwWorkspaceId,provider:'external',resourceKind:'artifact',providerResourceId:resourceRoot,displayMode:'snapshot',interactionMode:'read_only'},hdsrc:{schema:'hdsrc-portal-binding/v1',stateId:materialization.stateId,stateRevision:materialization.stateRevision,stateDigest:materialization.stateDigest,materializationId:materialization.materializationId,materializationDigest:materialization.materializationDigest,carrierProfile:materialization.carrierProfile,spatializationId:materialization.spatializationId,logicalScale:materialization.logicalScale,workloadDigest:materialization.workloadDigest}},
    createdBy:structuredClone(input.actor),createdAt:input.createdAt,updatedAt:input.createdAt,revision:0,
  }
}

export interface FreshRealProjectionOptions { hdsrcRoot:string; hdsrcReleaseZip:string; pythonExecutable?:string }

function realRequest():ProjectionRequestV1 {
  return {schema:'pncw-projection-request/v1',requestId:'request:real-4096d-fresh',sourceRef:'hdsrc://state/state:4096',observer:{observerId:'observer:pncw-real',observerType:'ai',profile:'machine'},representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},scope:{scopeId:'scope:real-block-row-0',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',authorityContext:{principalId:'principal:pncw-real',sourceRead:true,surfaceProject:true}}
}

async function closeProjection(source:RealHdsrcSourceAdapter,surface:RealMrmicSurfaceAdapter,request:ProjectionRequestV1){
  const readiness=await new ProjectionReadinessGate(source,surface).evaluate(request)
  if(!readiness.result.ready) throw new PncwError({code:readiness.result.blockingError?.code??'VERIFICATION_FAILED',stage:'READINESS',retryable:false,source:'pncw',message:'real projection readiness failed'})
  const prepared=await surface.prepareSurface(request,request.authorityContext)
  const bound=await surface.bindProjection(prepared,readiness.source,readiness.materialization,request.authorityContext)
  const manifest=buildProjectionManifest({request,source:readiness.source,materialization:readiness.materialization,surface:bound,authorityRefs:readiness.authorityRefs,structuralIntegrity:readiness.structuralIntegrity,residencyMap:[{regionRef:'manifest:root',state:'RESIDENT',bytesResident:1,bytesTotal:1},{regionRef:'relation:block-row:0',state:'AVAILABLE',bytesResident:0,bytesTotal:286313}],version:1})
  const verification=await new ProjectionVerifier(source,surface).verify(request,manifest)
  if(!verification.verified) throw new PncwError({code:verification.failure?.code??'VERIFICATION_FAILED',stage:'VERIFICATION',retryable:false,source:'pncw',message:'real projection verification failed'})
  const store=new VisibilityCommitStore()
  const receipt=store.commit({lifecycleState:'VERIFIED',manifest,verification,revealMode:'ATOMIC_ARTIFACT'})
  const partial=await source.readSelectedRegion(readiness.materialization,'relation:block-row:0',request.authorityContext)
  return {readiness,manifest,verification,store,receipt,partial}
}

export async function runFreshRealHdsrcProjection(options:FreshRealProjectionOptions){
  const output=execFileSync(options.pythonExecutable??'python3',[resolve('scripts/run-real-hdsrc-v010.py'),'--root',resolve(options.hdsrcRoot),'--release-zip',resolve(options.hdsrcReleaseZip)],{encoding:'utf8',maxBuffer:8*1024*1024})
  const run=JSON.parse(output) as FreshRun
  if(run.schema!=='pncw-fresh-hdsrc-v010-run/v0.1' || run.testStubRuntimeUsed!==false) throw new Error('fresh HDSRC runner did not return real-runtime evidence')
  const registry=new RealMaterializationRegistry()
  const source=new RealHdsrcSourceAdapter(new FreshRealHdsrcEvidenceProvider(run),registry,{goalClass:'pncw_projection',expectedSpan:8,expectedReuse:16,latencyClass:'interactive'})
  const surface=new RealMrmicSurfaceAdapter(sourceGroundedMrmicPortalFactory,registry,{allowedPrincipals:['principal:pncw-real']})
  const closed=await closeProjection(source,surface,realRequest())
  const src=record(run.source,'source')
  const mat=record(run.materialization,'materialization')
  const rawPartial=record(run.partial,'partial')
  return {
    schema:'pncw-real-4096d-evidence/v0.1',
    freshHdsrcRuntimeExecuted:true,
    hdsrcReleaseSha256:run.releaseZipSha256,
    source:{id:src.stateId,revision:src.stateRevision,digest:src.stateDigest,dimension:src.dimension,nodeCount:src.nodeCount,relationCount:src.relationCount},
    decision:structuredClone(run.decision),
    materialization:{id:mat.materializationId,carrierProfile:mat.carrierProfile,logicalScale:mat.logicalScale,spatializationId:mat.spatializationId,materializationDigest:mat.materializationDigest},
    partial:{compressedBytesRead:rawPartial.compressedBytesRead,carrierBytes:rawPartial.carrierBytes,relationCount:Array.isArray(rawPartial.relations)?rawPartial.relations.length:0,payloadDigest:closed.partial.payloadDigest},
    pncw:{resultId:closed.manifest.resultId,manifestDigest:closed.manifest.manifestDigest,verificationDigest:closed.verification.verificationDigest,visibilityCommitId:closed.receipt.visibilityCommitId},
    visibility:{state:closed.receipt.state,residentFraction:residentFraction(closed.store.getVisible(closed.manifest.resultId)),events:closed.store.eventCount},
    mrmic:{mode:'source-grounded-portal-factory',actualCheckoutExecuted:false,upstreamCompatibility:'MRMIC Phase 14 portal shape'},
    semanticEvidenceDigest:sha256Digest({source:src.stateDigest,materialization:mat.materializationDigest,partial:closed.partial.payloadDigest,resultId:closed.manifest.resultId,manifestDigest:closed.manifest.manifestDigest,verificationDigest:closed.verification.verificationDigest,visibilityCommitId:closed.receipt.visibilityCommitId}),
  }
}

export interface ExternalCheckoutProjectionOptions {
  mrmicDistRoot:string
  localProcessOptions:Record<string,unknown>
  allowedSurfacePrincipals:string[]
}

export async function runExternalCheckoutProjection(options:ExternalCheckoutProjectionOptions){
  const adapters=await createRealMrmicHdsrcAdapters({...options,workloadProfile:{goalClass:'pncw_projection',expectedSpan:8,expectedReuse:16,latencyClass:'interactive'}})
  try {
    const closed=await closeProjection(adapters.source,adapters.surface,realRequest())
    return {schema:'pncw-external-checkout-evidence/v0.1',actualMrmicCheckoutExecuted:true,resultId:closed.manifest.resultId,manifestDigest:closed.manifest.manifestDigest,verificationDigest:closed.verification.verificationDigest,visibilityCommitId:closed.receipt.visibilityCommitId,residentFraction:residentFraction(closed.store.getVisible(closed.manifest.resultId)),partialBytesRead:closed.partial.bytesRead,totalCarrierBytes:closed.partial.totalCarrierBytes}
  } finally { adapters.source.close() }
}
