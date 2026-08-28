import {
  PncwError, assertProjectionRequest,
  type AuthorityRefV1, type CheckResultV1, type MaterializationRefV1,
  type ProjectionRequestV1, type ReadinessResultV1, type SourceIdentityV1,
} from '../../core/src/index.js'
import type { AuthorityDecisionV1, HdsrcSourcePort, MrmicSurfacePort, StructuralVerificationV1 } from '../../adapters/src/index.js'

export interface ReadinessEvaluationV1 {
  request: ProjectionRequestV1
  result: ReadinessResultV1
  source: SourceIdentityV1
  materialization: MaterializationRefV1
  sourceAuthority: AuthorityDecisionV1
  surfaceAuthority: AuthorityDecisionV1
  structuralIntegrity: StructuralVerificationV1
  authorityRefs: AuthorityRefV1[]
}

function check(name: string, passed: boolean, detail?: string): CheckResultV1 {
  return { name, passed, ...(detail ? { detail } : {}) }
}

function failResult(
  request: ProjectionRequestV1,
  source: SourceIdentityV1,
  sourceCapabilities: Awaited<ReturnType<HdsrcSourcePort['getCapabilities']>>,
  surfaceCapabilities: Awaited<ReturnType<MrmicSurfacePort['getCapabilities']>>,
  checks: CheckResultV1[],
  error: PncwError,
): ReadinessResultV1 {
  return {
    schema: 'pncw-readiness-result/v1',
    requestId: request.requestId,
    ready: false,
    checks,
    blockingError: error.envelope(),
    sourceSnapshot: source,
    capabilitySnapshot: { source: sourceCapabilities, surface: surfaceCapabilities },
  }
}

export class ProjectionReadinessGate {
  readonly #source: HdsrcSourcePort
  readonly #surface: MrmicSurfacePort
  constructor(source: HdsrcSourcePort, surface: MrmicSurfacePort) {
    this.#source = source
    this.#surface = surface
  }

  async evaluate(input: unknown): Promise<ReadinessEvaluationV1> {
    const request = assertProjectionRequest(input)
    const checks: CheckResultV1[] = []
    const sourceCapabilities = await this.#source.getCapabilities()
    const surfaceCapabilities = await this.#surface.getCapabilities()

    const modeSupported = sourceCapabilities.observationModes.includes(request.requestedMode)
    checks.push(check('observation-mode-supported', modeSupported, modeSupported ? undefined : request.requestedMode))
    if (!modeSupported) {
      throw new PncwError({ code:'UNSUPPORTED', stage:'READINESS', retryable:false, source:'hdsrc', message:`observation mode ${request.requestedMode} is unsupported` })
    }
    const carrierSupported = sourceCapabilities.carrierProfiles.includes(request.representation.profile)
    checks.push(check('carrier-profile-supported', carrierSupported, carrierSupported ? undefined : request.representation.profile))
    if (!carrierSupported) {
      throw new PncwError({ code:'UNSUPPORTED', stage:'READINESS', retryable:false, source:'hdsrc', message:`carrier profile ${request.representation.profile} is unsupported` })
    }
    const frameValid = request.representation.protocolVersion === 'pncw/0.1'
    checks.push(check('projection-frame-valid', frameValid, request.representation.protocolVersion))
    if (!frameValid) {
      throw new PncwError({ code:'INVALID_REQUEST', stage:'READINESS', retryable:false, source:'pncw', message:'unsupported PNCW protocol version' })
    }
    const scopeBound = request.scope.regionRefs.length > 0
    checks.push(check('scope-bound', scopeBound))
    if (!scopeBound) {
      throw new PncwError({ code:'INVALID_REQUEST', stage:'READINESS', retryable:false, source:'pncw', message:'projection scope must select at least one region' })
    }

    const sourceAuthority = await this.#source.checkAuthority(request.authorityContext)
    checks.push(check('source-authority', sourceAuthority.authorized, sourceAuthority.reason))
    if (!sourceAuthority.authorized) {
      throw new PncwError({ code:'UNAUTHORIZED', stage:'READINESS', retryable:false, source:'hdsrc', message:sourceAuthority.reason ?? 'source read denied' })
    }

    const source = await this.#source.resolveSource(request.sourceRef, request.authorityContext)
    checks.push(check('source-resolved', true, `${source.sourceId}@${source.revision}`))

    const surfaceAuthority = await this.#surface.checkProjectionAuthority(request.authorityContext)
    checks.push(check('surface-authority', surfaceAuthority.authorized, surfaceAuthority.reason))
    if (!surfaceAuthority.authorized) {
      const error = new PncwError({ code:'UNAUTHORIZED', stage:'READINESS', retryable:false, source:'mrmic', message:surfaceAuthority.reason ?? 'surface projection denied' })
      const unresolvedMaterialization: MaterializationRefV1 = {
        provider: sourceCapabilities.provider,
        materializationId: 'unresolved', sourceId: source.sourceId, sourceRevision: source.revision, sourceDigest: source.digest,
        carrierProfile: request.representation.profile, materializationDigest: `sha256:${'0'.repeat(64)}`,
        machineResourceUri: 'unresolved://machine', previewResourceUri: 'unresolved://preview', partialRead: false,
      }
      return {
        request,
        result: failResult(request, source, sourceCapabilities, surfaceCapabilities, checks, error),
        source, materialization: unresolvedMaterialization, sourceAuthority, surfaceAuthority,
        structuralIntegrity: { verified:false, kind:request.representation.profile, reason:'surface authority denied before materialization' },
        authorityRefs: [
          { provider:sourceCapabilities.provider, principalId:request.authorityContext.principalId, grant:sourceAuthority.grant, authorized:true },
          { provider:surfaceCapabilities.provider, principalId:request.authorityContext.principalId, grant:surfaceAuthority.grant, authorized:false },
        ],
      }
    }

    const materialization = await this.#source.resolveMaterialization(request, source, request.authorityContext)
    checks.push(check('materialization-resolved', true, materialization.materializationId))
    const freshness = await this.#source.checkFreshness(source, materialization, request.authorityContext)
    checks.push(check('source-fresh', freshness.fresh, freshness.reason))
    if (!freshness.fresh) {
      const error = new PncwError({ code:'STALE_SOURCE', stage:'READINESS', retryable:freshness.retryable, source:'hdsrc', message:freshness.reason ?? 'source is stale' })
      return {
        request, result:failResult(request, source, sourceCapabilities, surfaceCapabilities, checks, error), source, materialization, sourceAuthority, surfaceAuthority,
        structuralIntegrity:{ verified:false, kind:materialization.carrierProfile, reason:'structural verification skipped for stale materialization' },
        authorityRefs:[
          {provider:sourceCapabilities.provider,principalId:request.authorityContext.principalId,grant:sourceAuthority.grant,authorized:true},
          {provider:surfaceCapabilities.provider,principalId:request.authorityContext.principalId,grant:surfaceAuthority.grant,authorized:true},
        ],
      }
    }

    const structuralIntegrity = await this.#source.verifyMaterialization(materialization, request.authorityContext)
    checks.push(check('structural-integrity', structuralIntegrity.verified, structuralIntegrity.reason))
    if (!structuralIntegrity.verified) {
      const error = new PncwError({ code:'INTEGRITY_FAILURE', stage:'READINESS', retryable:false, source:'hdsrc', message:structuralIntegrity.reason ?? 'materialization integrity failure' })
      return {
        request, result:failResult(request, source, sourceCapabilities, surfaceCapabilities, checks, error), source, materialization, sourceAuthority, surfaceAuthority, structuralIntegrity,
        authorityRefs:[
          {provider:sourceCapabilities.provider,principalId:request.authorityContext.principalId,grant:sourceAuthority.grant,authorized:true},
          {provider:surfaceCapabilities.provider,principalId:request.authorityContext.principalId,grant:surfaceAuthority.grant,authorized:true},
        ],
      }
    }

    checks.push(check('manifest-preconditions-complete', true))
    const result: ReadinessResultV1 = {
      schema:'pncw-readiness-result/v1', requestId:request.requestId, ready:true, checks,
      sourceSnapshot:source, capabilitySnapshot:{source:sourceCapabilities,surface:surfaceCapabilities},
    }
    return {
      request, result, source, materialization, sourceAuthority, surfaceAuthority, structuralIntegrity,
      authorityRefs:[
        {provider:sourceCapabilities.provider,principalId:request.authorityContext.principalId,grant:sourceAuthority.grant,authorized:true},
        {provider:surfaceCapabilities.provider,principalId:request.authorityContext.principalId,grant:surfaceAuthority.grant,authorized:true},
      ],
    }
  }
}
