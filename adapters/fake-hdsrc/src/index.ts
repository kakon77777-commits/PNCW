import type {
  AuthorityContextV1, MaterializationRefV1, ProjectionRequestV1, SourceCapabilitiesV1, SourceIdentityV1,
} from '../../../packages/core/src/index.js'
import { PncwError, sha256Digest } from '../../../packages/core/src/index.js'
import type { AuthorityDecisionV1, FreshnessResultV1, HdsrcSourcePort, RegionReadResultV1, StructuralVerificationV1 } from '../../../packages/adapters/src/index.js'

export interface FakeHdsrcOptions {
  stale?: boolean
  integrityFailure?: boolean
  authorized?: boolean
  partialBytesRead?: number
  totalCarrierBytes?: number
  observationModes?: Array<'human_preview' | 'machine_carrier' | 'structured_manifest'>
}

const SOURCE_DIGEST = `sha256:${'a'.repeat(64)}`
const MATERIALIZATION_DIGEST = `sha256:${'b'.repeat(64)}`

export class FakeHdsrcSourceAdapter implements HdsrcSourcePort {
  readonly #options: Omit<Required<FakeHdsrcOptions>, 'observationModes'> & { observationModes: Array<'human_preview' | 'machine_carrier' | 'structured_manifest'> }
  constructor(options: FakeHdsrcOptions = {}) {
    this.#options = {
      stale: options.stale ?? false,
      integrityFailure: options.integrityFailure ?? false,
      authorized: options.authorized ?? true,
      partialBytesRead: options.partialBytesRead ?? 1272,
      totalCarrierBytes: options.totalCarrierBytes ?? 286313,
      observationModes: options.observationModes ?? ['human_preview','machine_carrier','structured_manifest'],
    }
  }

  async getCapabilities(): Promise<SourceCapabilitiesV1> {
    return { provider:'fake-hdsrc', providerVersion:'0.10-test', observationModes:structuredClone(this.#options.observationModes), carrierProfiles:['HMBT1'], partialRead:true, canonicalMutation:false }
  }

  async checkAuthority(context: AuthorityContextV1): Promise<AuthorityDecisionV1> {
    const authorized = this.#options.authorized && context.sourceRead
    return { authorized, grant:'hdsrc:read', ...(authorized ? {} : { reason:'source read denied' }) }
  }

  async resolveSource(sourceRef: string, context: AuthorityContextV1): Promise<SourceIdentityV1> {
    const auth = await this.checkAuthority(context)
    if (!auth.authorized) throw new PncwError({ code:'UNAUTHORIZED', stage:'SOURCE', retryable:false, source:'hdsrc', message:'HDSRC source read denied' })
    if (sourceRef !== 'hdsrc://state/state:demo-4096') throw new PncwError({ code:'SOURCE_UNAVAILABLE', stage:'SOURCE', retryable:false, source:'hdsrc', message:`source ${sourceRef} not found` })
    return { authority:'hdsrc', sourceId:'state:demo-4096', revision:12, digest:SOURCE_DIGEST }
  }

  async resolveMaterialization(request: ProjectionRequestV1, source: SourceIdentityV1, context: AuthorityContextV1): Promise<MaterializationRefV1> {
    const auth = await this.checkAuthority(context)
    if (!auth.authorized) throw new PncwError({ code:'UNAUTHORIZED', stage:'MATERIALIZATION', retryable:false, source:'hdsrc', message:'HDSRC materialization read denied' })
    if (request.representation.profile !== 'HMBT1') throw new PncwError({ code:'UNSUPPORTED', stage:'MATERIALIZATION', retryable:false, source:'hdsrc', message:'only HMBT1 is supported by fake adapter' })
    return { provider:'fake-hdsrc', materializationId:'mat:demo-4096-hmbt1-32', sourceId:source.sourceId, sourceRevision:source.revision, sourceDigest:source.digest, carrierProfile:'HMBT1', materializationDigest:MATERIALIZATION_DIGEST, machineResourceUri:'hdsrc://state/state:demo-4096/materializations/mat:demo-4096-hmbt1-32/machine', previewResourceUri:'hdsrc://state/state:demo-4096/materializations/mat:demo-4096-hmbt1-32/preview', partialRead:true }
  }

  async checkFreshness(source: SourceIdentityV1, materialization: MaterializationRefV1, _context: AuthorityContextV1): Promise<FreshnessResultV1> {
    const matching = source.sourceId === materialization.sourceId && source.revision === materialization.sourceRevision && source.digest === materialization.sourceDigest
    if (!matching || this.#options.stale) return { fresh:false, retryable:true, reason:'canonical source advanced' }
    return { fresh:true, retryable:false }
  }

  async verifyMaterialization(materialization: MaterializationRefV1, _context: AuthorityContextV1): Promise<StructuralVerificationV1> {
    const canonical = materialization.materializationId === 'mat:demo-4096-hmbt1-32'
      && materialization.materializationDigest === MATERIALIZATION_DIGEST
      && materialization.carrierProfile === 'HMBT1'
      && materialization.machineResourceUri.endsWith('/mat:demo-4096-hmbt1-32/machine')
    if (this.#options.integrityFailure || !canonical) return { verified:false, kind:'HMBT1', digest:materialization.materializationDigest, reason:'structural mismatch against canonical HDSRC materialization' }
    return { verified:true, kind:'HMBT1', digest:materialization.materializationDigest }
  }

  async readSelectedRegion(materialization: MaterializationRefV1, regionRef: string, _context: AuthorityContextV1): Promise<RegionReadResultV1> {
    if (!regionRef) throw new PncwError({ code:'INVALID_REQUEST', stage:'SOURCE', retryable:false, source:'hdsrc', message:'regionRef is required' })
    const payloadDigest = sha256Digest({ materializationId:materialization.materializationId, regionRef, bytes:this.#options.partialBytesRead })
    return { regionRef, bytesRead:this.#options.partialBytesRead, totalCarrierBytes:this.#options.totalCarrierBytes, payloadDigest, structuralVerified:!this.#options.integrityFailure }
  }
}
