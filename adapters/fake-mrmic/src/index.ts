import type {
  AuthorityContextV1, MaterializationRefV1, PreparedSurfaceV1, ProjectionRequestV1, SourceIdentityV1, SurfaceCapabilitiesV1, SurfaceRefV1,
} from '../../../packages/core/src/index.js'
import { PncwError, sha256Digest } from '../../../packages/core/src/index.js'
import type { AuthorityDecisionV1, MrmicSurfacePort } from '../../../packages/adapters/src/index.js'

export interface FakeMrmicOptions { authorized?: boolean; available?: boolean; revisionOffset?: number }

export class FakeMrmicSurfaceAdapter implements MrmicSurfacePort {
  readonly #options: Required<FakeMrmicOptions>
  readonly #surfaces = new Map<string, PreparedSurfaceV1 | SurfaceRefV1>()
  #preparedCount = 0
  constructor(options: FakeMrmicOptions = {}) {
    this.#options = { authorized:options.authorized ?? true, available:options.available ?? true, revisionOffset:options.revisionOffset ?? 0 }
  }

  get preparedCount(): number { return this.#preparedCount }

  async getCapabilities(): Promise<SurfaceCapabilitiesV1> {
    return { provider:'fake-mrmic', providerVersion:'0.14-test', portalSchema:'native_resource_portal_v1', readOnlyProjection:true, canonicalMutation:false }
  }
  async checkProjectionAuthority(context: AuthorityContextV1): Promise<AuthorityDecisionV1> {
    const authorized = this.#options.authorized && context.surfaceProject
    return { authorized, grant:'mrmic:project', ...(authorized ? {} : { reason:'surface projection denied' }) }
  }
  async prepareSurface(request: ProjectionRequestV1, context: AuthorityContextV1): Promise<PreparedSurfaceV1> {
    const auth = await this.checkProjectionAuthority(context)
    if (!auth.authorized) throw new PncwError({code:'UNAUTHORIZED',stage:'SURFACE',retryable:false,source:'mrmic',message:'MRMIC projection denied'})
    if (!this.#options.available) throw new PncwError({code:'SURFACE_UNAVAILABLE',stage:'SURFACE',retryable:true,source:'mrmic',message:'surface unavailable'})
    this.#preparedCount += 1
    const surface: PreparedSurfaceV1 = {provider:'fake-mrmic',surfaceId:`surface:${request.requestId}`,portalSchema:'native_resource_portal_v1',visible:false}
    this.#surfaces.set(surface.surfaceId,surface)
    return structuredClone(surface)
  }
  async bindProjection(prepared: PreparedSurfaceV1, source: SourceIdentityV1, materialization: MaterializationRefV1, context: AuthorityContextV1): Promise<SurfaceRefV1> {
    const auth = await this.checkProjectionAuthority(context)
    if (!auth.authorized) throw new PncwError({code:'UNAUTHORIZED',stage:'SURFACE',retryable:false,source:'mrmic',message:'MRMIC projection denied'})
    if (!this.#surfaces.has(prepared.surfaceId)) throw new PncwError({code:'SURFACE_UNAVAILABLE',stage:'SURFACE',retryable:true,source:'mrmic',message:'prepared surface missing'})
    const revision = source.revision + this.#options.revisionOffset
    const bindingDigest = sha256Digest({surfaceId:prepared.surfaceId,sourceId:source.sourceId,sourceRevision:revision,sourceDigest:source.digest,materializationId:materialization.materializationId,materializationDigest:materialization.materializationDigest})
    const bound: SurfaceRefV1 = {provider:'fake-mrmic',surfaceId:prepared.surfaceId,portalSchema:prepared.portalSchema,sourceId:source.sourceId,sourceRevision:revision,sourceDigest:source.digest,materializationId:materialization.materializationId,materializationDigest:materialization.materializationDigest,bindingDigest,visible:false}
    this.#surfaces.set(bound.surfaceId,bound)
    return structuredClone(bound)
  }
  async surfaceState(surfaceId: string): Promise<SurfaceRefV1 | PreparedSurfaceV1> {
    const value=this.#surfaces.get(surfaceId)
    if (!value) throw new PncwError({code:'SURFACE_UNAVAILABLE',stage:'SURFACE',retryable:true,source:'mrmic',message:'surface not found'})
    return structuredClone(value)
  }
}
