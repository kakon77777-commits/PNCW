import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  PncwError, mapUpstreamError, sha256Digest,
  type AuthorityContextV1, type MaterializationRefV1, type PreparedSurfaceV1,
  type ProjectionRequestV1, type SourceCapabilitiesV1, type SourceIdentityV1,
  type SurfaceCapabilitiesV1, type SurfaceRefV1,
} from '../../../packages/core/src/index.js'
import type {
  AuthorityDecisionV1, FreshnessResultV1, HdsrcSourcePort, MrmicSurfacePort,
  RegionReadResultV1, StructuralVerificationV1,
} from '../../../packages/adapters/src/index.js'

interface ExternalHdsrcProviderLike {
  capabilities(): Promise<unknown>
  state(ref: string, context: Record<string, unknown>): Promise<unknown>
  materializeResolved(request: Record<string, unknown>, context: Record<string, unknown>): Promise<unknown>
  materialization(ref: string, context: Record<string, unknown>): Promise<unknown>
  readPartialRelationBlockRow(ref: string, blockRow: number, context: Record<string, unknown>): Promise<unknown>
  close?(): void
}

type PortalFactory = (input: Record<string, unknown>) => unknown

export interface RawMaterializationRecord {
  ref: string
  raw: Record<string, unknown>
}

export class RealMaterializationRegistry {
  readonly #records = new Map<string, RawMaterializationRecord>()
  set(materializationId: string, record: RawMaterializationRecord): void {
    this.#records.set(materializationId, structuredClone(record))
  }
  get(materializationId: string): RawMaterializationRecord {
    const record = this.#records.get(materializationId)
    if (!record) throw new PncwError({code:'MATERIALIZATION_FAILED',stage:'MATERIALIZATION',retryable:false,source:'pncw',message:`raw materialization ${materializationId} is not registered`})
    return structuredClone(record)
  }
}

function rec(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'SOURCE',retryable:false,source:'hdsrc',message:`${label} must be an object`})
  return value as Record<string, unknown>
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'SOURCE',retryable:false,source:'hdsrc',message:`${label} must be a non-empty string`})
  return value
}
function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'SOURCE',retryable:false,source:'hdsrc',message:`${label} must be a non-negative integer`})
  return value as number
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new PncwError({code:'INTEGRITY_FAILURE',stage:'SOURCE',retryable:false,source:'hdsrc',message:`${label} must be boolean`})
  return value
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'SOURCE',retryable:false,source:'hdsrc',message:`${label} must be an array`})
  return value.map((item,index)=>text(item,`${label}[${index}]`))
}
function access(context: AuthorityContextV1): Record<string, unknown> {
  return { principalId:context.principalId, allowHdsrcRead:context.sourceRead, trustedStructured:true, trustedMachine:true }
}
function materializationRoot(materialization: MaterializationRefV1): string {
  const suffix='/machine'
  if (!materialization.machineResourceUri.endsWith(suffix)) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'MATERIALIZATION',retryable:false,source:'hdsrc',message:'machine resource URI does not identify a materialization member'})
  return materialization.machineResourceUri.slice(0,-suffix.length)
}

export interface RealHdsrcWorkloadProfile {
  goalClass?: string
  expectedSpan?: number
  expectedReuse?: number
  latencyClass?: 'interactive' | 'batch'
}

export class RealHdsrcSourceAdapter implements HdsrcSourcePort {
  readonly #provider: ExternalHdsrcProviderLike
  readonly #registry: RealMaterializationRegistry
  readonly #workload: Required<RealHdsrcWorkloadProfile>
  constructor(provider: ExternalHdsrcProviderLike, registry = new RealMaterializationRegistry(), workload: RealHdsrcWorkloadProfile = {}) {
    this.#provider=provider
    this.#registry=registry
    const expectedSpan=workload.expectedSpan ?? 0
    const expectedReuse=workload.expectedReuse ?? 1
    if (!Number.isInteger(expectedSpan) || expectedSpan < 0) throw new PncwError({code:'INVALID_REQUEST',stage:'MATERIALIZATION',retryable:false,source:'pncw',message:'real HDSRC expectedSpan must be a non-negative integer'})
    if (!Number.isInteger(expectedReuse) || expectedReuse < 1) throw new PncwError({code:'INVALID_REQUEST',stage:'MATERIALIZATION',retryable:false,source:'pncw',message:'real HDSRC expectedReuse must be a positive integer'})
    this.#workload={goalClass:workload.goalClass?.trim()||'pncw_projection',expectedSpan,expectedReuse,latencyClass:workload.latencyClass??'interactive'}
  }

  async getCapabilities(): Promise<SourceCapabilitiesV1> {
    try {
      const raw=rec(await this.#provider.capabilities(),'HDSRC capabilities')
      if (raw.canonicalMutation !== false) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'SOURCE',retryable:false,source:'hdsrc',message:'real HDSRC integration must remain read-only'})
      return {
        provider:'hdsrc', providerVersion:text(raw.providerVersion,'providerVersion'),
        observationModes:strings(raw.observationModes,'observationModes').map(mode=>{
          if (!['human_preview','machine_carrier','structured_manifest'].includes(mode)) throw new PncwError({code:'UNSUPPORTED',stage:'SOURCE',retryable:false,source:'hdsrc',message:`unsupported observation mode ${mode}`})
          return mode as 'human_preview'|'machine_carrier'|'structured_manifest'
        }),
        carrierProfiles:strings(raw.carrierProfiles,'carrierProfiles'), partialRead:bool(raw.partialRead,'partialRead'), canonicalMutation:false,
      }
    } catch (error) { throw error instanceof PncwError ? error : mapUpstreamError(error,'hdsrc','SOURCE') }
  }

  async checkAuthority(context: AuthorityContextV1): Promise<AuthorityDecisionV1> {
    return context.sourceRead ? {authorized:true,grant:'hdsrc:read'} : {authorized:false,grant:'hdsrc:read',reason:'PNCW sourceRead capability is false'}
  }

  async resolveSource(sourceRef: string, context: AuthorityContextV1): Promise<SourceIdentityV1> {
    if (!(await this.checkAuthority(context)).authorized) throw new PncwError({code:'UNAUTHORIZED',stage:'SOURCE',retryable:false,source:'hdsrc',message:'HDSRC read denied before protected source access'})
    try {
      const raw=rec(await this.#provider.state(sourceRef,access(context)),'HDSRC state')
      return {authority:'hdsrc',sourceId:text(raw.stateId,'stateId'),revision:integer(raw.stateRevision,'stateRevision'),digest:text(raw.stateDigest,'stateDigest')}
    } catch (error) { throw mapUpstreamError(error,'hdsrc','SOURCE') }
  }

  async resolveMaterialization(request: ProjectionRequestV1, source: SourceIdentityV1, context: AuthorityContextV1): Promise<MaterializationRefV1> {
    try {
      const resolved=rec(await this.#provider.materializeResolved({
        schema:'hdsrc-materialization-request/v1', stateRef:request.sourceRef,
        workload:{schema:'hdsrc-workload-hint/v1',goalClass:this.#workload.goalClass,observationMode:request.requestedMode,queryDirection:'block',expectedSpan:this.#workload.expectedSpan || Math.max(1,request.scope.regionRefs.length),expectedReuse:this.#workload.expectedReuse,latencyClass:this.#workload.latencyClass},
      },access(context)),'resolved HDSRC materialization')
      const ref=text(resolved.materializationRef,'materializationRef')
      const raw=rec(resolved.materialization,'materialization')
      const stateId=text(raw.stateId,'materialization.stateId')
      const stateRevision=integer(raw.stateRevision,'materialization.stateRevision')
      const stateDigest=text(raw.stateDigest,'materialization.stateDigest')
      if (stateId!==source.sourceId || stateRevision!==source.revision || stateDigest!==source.digest) throw new PncwError({code:'VERSION_CONFLICT',stage:'MATERIALIZATION',retryable:false,source:'hdsrc',message:'resolved materialization does not bind to resolved source'})
      const materializationId=text(raw.materializationId,'materialization.materializationId')
      this.#registry.set(materializationId,{ref,raw})
      return {
        provider:'hdsrc',materializationId,sourceId:stateId,sourceRevision:stateRevision,sourceDigest:stateDigest,
        carrierProfile:text(raw.carrierProfile,'materialization.carrierProfile'),materializationDigest:text(raw.materializationDigest,'materialization.materializationDigest'),
        machineResourceUri:text(raw.machineResourceUri,'materialization.machineResourceUri'),previewResourceUri:text(raw.previewResourceUri,'materialization.previewResourceUri'),partialRead:true,
      }
    } catch (error) { throw error instanceof PncwError ? error : mapUpstreamError(error,'hdsrc','MATERIALIZATION') }
  }

  async checkFreshness(source: SourceIdentityV1, materialization: MaterializationRefV1, context: AuthorityContextV1): Promise<FreshnessResultV1> {
    try {
      const raw=rec(await this.#provider.materialization(materializationRoot(materialization),access(context)),'current materialization')
      const fresh=text(raw.stateId,'stateId')===source.sourceId && integer(raw.stateRevision,'stateRevision')===source.revision && text(raw.stateDigest,'stateDigest')===source.digest && text(raw.materializationDigest,'materializationDigest')===materialization.materializationDigest
      return fresh ? {fresh:true,retryable:false} : {fresh:false,retryable:true,reason:'materialization no longer matches source lineage'}
    } catch (error) {
      const mapped=mapUpstreamError(error,'hdsrc','SOURCE')
      if (mapped.code==='STALE_SOURCE') return {fresh:false,retryable:true,reason:mapped.message}
      throw mapped
    }
  }

  async verifyMaterialization(materialization: MaterializationRefV1, context: AuthorityContextV1): Promise<StructuralVerificationV1> {
    try {
      const raw=rec(await this.#provider.readPartialRelationBlockRow(materializationRoot(materialization),0,access(context)),'partial relation block row')
      const compressed=integer(raw.compressedBytesRead,'compressedBytesRead')
      const carrier=integer(raw.carrierBytes,'carrierBytes')
      if (compressed<=0 || carrier<=0 || compressed>carrier) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'VERIFICATION',retryable:false,source:'hdsrc',message:'partial relation I/O bounds are invalid'})
      return {verified:true,kind:materialization.carrierProfile,digest:materialization.materializationDigest}
    } catch (error) {
      const mapped=error instanceof PncwError ? error : mapUpstreamError(error,'hdsrc','VERIFICATION')
      if (mapped.code==='INTEGRITY_FAILURE') return {verified:false,kind:materialization.carrierProfile,digest:materialization.materializationDigest,reason:mapped.message}
      throw mapped
    }
  }

  async readSelectedRegion(materialization: MaterializationRefV1, regionRef: string, context: AuthorityContextV1): Promise<RegionReadResultV1> {
    const match=/^relation:block-row:(\d+)$/.exec(regionRef)
    if (!match) throw new PncwError({code:'INVALID_REQUEST',stage:'SOURCE',retryable:false,source:'pncw',message:`unsupported selected region ${regionRef}`})
    const blockRow=Number(match[1])
    try {
      const raw=rec(await this.#provider.readPartialRelationBlockRow(materializationRoot(materialization),blockRow,access(context)),'partial relation block row')
      const bytesRead=integer(raw.compressedBytesRead,'compressedBytesRead')
      const totalCarrierBytes=integer(raw.carrierBytes,'carrierBytes')
      if (bytesRead<=0 || totalCarrierBytes<=0 || bytesRead>totalCarrierBytes) throw new PncwError({code:'INTEGRITY_FAILURE',stage:'SOURCE',retryable:false,source:'hdsrc',message:'partial region byte accounting is invalid'})
      return {regionRef,bytesRead,totalCarrierBytes,payloadDigest:sha256Digest({blockRow:raw.blockRow,srcStart:raw.srcStart,srcLength:raw.srcLength,relations:raw.relations}),structuralVerified:true}
    } catch (error) { throw error instanceof PncwError ? error : mapUpstreamError(error,'hdsrc','SOURCE') }
  }

  close(): void { this.#provider.close?.() }
}

export interface RealMrmicSurfaceOptions {
  allowedPrincipals?: string[]
  workspaceId?: string
  canvasId?: string
}

export class RealMrmicSurfaceAdapter implements MrmicSurfacePort {
  readonly #portalFactory: PortalFactory
  readonly #registry: RealMaterializationRegistry
  readonly #allowed: Set<string>
  readonly #workspaceId: string
  readonly #canvasId: string
  readonly #surfaces=new Map<string,PreparedSurfaceV1|SurfaceRefV1>()
  constructor(portalFactory: PortalFactory, registry: RealMaterializationRegistry, options: RealMrmicSurfaceOptions = {}) {
    this.#portalFactory=portalFactory; this.#registry=registry; this.#allowed=new Set(options.allowedPrincipals??[])
    this.#workspaceId=options.workspaceId??'pncw-workspace'; this.#canvasId=options.canvasId??'pncw-canvas'
  }
  async getCapabilities(): Promise<SurfaceCapabilitiesV1> { return {provider:'mrmic',providerVersion:'0.14',portalSchema:'native_resource_portal_v1',readOnlyProjection:true,canonicalMutation:false} }
  async checkProjectionAuthority(context: AuthorityContextV1): Promise<AuthorityDecisionV1> {
    const authorized=context.surfaceProject && this.#allowed.has(context.principalId)
    return {authorized,grant:'mrmic:project',...(authorized?{}:{reason:'surface principal is not independently authorized'})}
  }
  async prepareSurface(request: ProjectionRequestV1, context: AuthorityContextV1): Promise<PreparedSurfaceV1> {
    const auth=await this.checkProjectionAuthority(context)
    if (!auth.authorized) throw new PncwError({code:'UNAUTHORIZED',stage:'SURFACE',retryable:false,source:'mrmic',message:auth.reason??'surface projection denied'})
    const digest=sha256Digest({requestId:request.requestId,sourceRef:request.sourceRef,scope:request.scope,observer:request.observer,representation:request.representation})
    const surface:PreparedSurfaceV1={provider:'mrmic',surfaceId:`pncw:surface:${digest.slice(7)}`,portalSchema:'native_resource_portal_v1',visible:false}
    this.#surfaces.set(surface.surfaceId,surface)
    return structuredClone(surface)
  }
  async bindProjection(prepared: PreparedSurfaceV1, source: SourceIdentityV1, materialization: MaterializationRefV1, context: AuthorityContextV1): Promise<SurfaceRefV1> {
    const auth=await this.checkProjectionAuthority(context)
    if (!auth.authorized) throw new PncwError({code:'UNAUTHORIZED',stage:'SURFACE',retryable:false,source:'mrmic',message:auth.reason??'surface projection denied'})
    if (!this.#surfaces.has(prepared.surfaceId)) throw new PncwError({code:'SURFACE_UNAVAILABLE',stage:'SURFACE',retryable:true,source:'mrmic',message:'prepared MRMIC surface is unavailable'})
    if (source.sourceId!==materialization.sourceId || source.revision!==materialization.sourceRevision || source.digest!==materialization.sourceDigest) throw new PncwError({code:'VERSION_CONFLICT',stage:'SURFACE',retryable:false,source:'mrmic',message:'surface binding source/materialization lineage mismatch'})
    const raw=this.#registry.get(materialization.materializationId).raw
    const portal=this.#portalFactory({
      canvasObjectId:prepared.surfaceId,canvasId:this.#canvasId,portalId:`portal:${prepared.surfaceId}`,pmwWorkspaceId:this.#workspaceId,
      title:'PNCW HDSRC Projection',transform:{x:0,y:0,width:1024,height:768,rotation:0,scaleX:1,scaleY:1,zIndex:0},
      actor:{actorType:'agent',actorId:context.principalId},createdAt:'1970-01-01T00:00:00.000Z',materialization:raw,
    })
    const bindingDigest=sha256Digest({surfaceId:prepared.surfaceId,source,materialization,portal})
    const bound:SurfaceRefV1={provider:'mrmic',surfaceId:prepared.surfaceId,portalSchema:'native_resource_portal_v1',sourceId:source.sourceId,sourceRevision:source.revision,sourceDigest:source.digest,materializationId:materialization.materializationId,materializationDigest:materialization.materializationDigest,bindingDigest,visible:false}
    this.#surfaces.set(bound.surfaceId,bound)
    return structuredClone(bound)
  }
  async surfaceState(surfaceId: string): Promise<SurfaceRefV1|PreparedSurfaceV1> {
    const surface=this.#surfaces.get(surfaceId)
    if (!surface) throw new PncwError({code:'SURFACE_UNAVAILABLE',stage:'SURFACE',retryable:true,source:'mrmic',message:`surface ${surfaceId} is unavailable`})
    return structuredClone(surface)
  }
}

export interface CreateRealAdaptersOptions {
  mrmicDistRoot: string
  localProcessOptions: Record<string, unknown>
  allowedSurfacePrincipals: string[]
  workloadProfile?: RealHdsrcWorkloadProfile
  workspaceId?: string
  canvasId?: string
}

export async function createRealMrmicHdsrcAdapters(options: CreateRealAdaptersOptions): Promise<{source:RealHdsrcSourceAdapter;surface:RealMrmicSurfaceAdapter;registry:RealMaterializationRegistry}> {
  const localUrl=pathToFileURL(resolve(options.mrmicDistRoot,'packages/provider-hdsrc/src/local-process.js')).href
  const indexUrl=pathToFileURL(resolve(options.mrmicDistRoot,'packages/provider-hdsrc/src/index.js')).href
  const localModule=await import(localUrl) as Record<string,unknown>
  const indexModule=await import(indexUrl) as Record<string,unknown>
  const Provider=localModule.LocalProcessHdsrcProvider as (new (options: Record<string, unknown>)=>ExternalHdsrcProviderLike) | undefined
  const portalFactory=indexModule.createHdsrcMaterializationPortal as PortalFactory | undefined
  if (!Provider || typeof portalFactory!=='function') throw new PncwError({code:'SOURCE_UNAVAILABLE',stage:'SOURCE',retryable:false,source:'pncw',message:'MRMIC dist root does not expose required Phase 14 HDSRC integration symbols'})
  const registry=new RealMaterializationRegistry()
  const provider=new Provider(options.localProcessOptions)
  return {
    source:new RealHdsrcSourceAdapter(provider,registry,options.workloadProfile),
    surface:new RealMrmicSurfaceAdapter(portalFactory,registry,{allowedPrincipals:options.allowedSurfacePrincipals,...(options.workspaceId?{workspaceId:options.workspaceId}:{}),...(options.canvasId?{canvasId:options.canvasId}:{})}),
    registry,
  }
}
