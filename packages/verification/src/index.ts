import {
  PncwError, assertProjectionManifest, assertProjectionRequest, deriveManifestDigest,
  markLiveVerified,
  deriveResultId, deriveVerificationDigest, sha256Digest,
  type CheckResultV1, type PncwErrorEnvelopeV1, type ProjectionManifestV1,
  type ProjectionRequestV1, type VerificationResultV1,
} from '../../core/src/index.js'
import type { HdsrcSourcePort, MrmicSurfacePort } from '../../adapters/src/index.js'

function check(name: string, passed: boolean, detail?: string): CheckResultV1 {
  return { name, passed, ...(detail ? { detail } : {}) }
}

function asPncwError(error: unknown): PncwError {
  if (error instanceof PncwError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new PncwError({ code:'VERIFICATION_FAILED', stage:'VERIFICATION', retryable:false, source:'pncw', message })
}

function failureResult(manifest: ProjectionManifestV1, checks: CheckResultV1[], error: PncwError): VerificationResultV1 {
  const payload: Omit<VerificationResultV1, 'verificationDigest'> = {
    schema:'pncw-verification-result/v1', resultId:manifest.resultId, verified:false,
    manifestDigest:manifest.manifestDigest, checks, failure:error.envelope(),
  }
  return Object.freeze({ ...payload, verificationDigest:deriveVerificationDigest(payload as unknown as Record<string, unknown>) })
}

function successResult(manifest: ProjectionManifestV1, checks: CheckResultV1[]): VerificationResultV1 {
  const payload: Omit<VerificationResultV1, 'verificationDigest'> = {
    schema:'pncw-verification-result/v1', resultId:manifest.resultId, verified:true,
    manifestDigest:manifest.manifestDigest, checks,
  }
  const result={ ...payload, verificationDigest:deriveVerificationDigest(payload as unknown as Record<string, unknown>) }
  return Object.freeze(markLiveVerified(result))
}

function equalIdentity(a: {authority:string;sourceId:string;revision:number;digest:string}, b: {authority:string;sourceId:string;revision:number;digest:string}): boolean {
  return a.authority===b.authority && a.sourceId===b.sourceId && a.revision===b.revision && a.digest===b.digest
}

export class ProjectionVerifier {
  readonly #source: HdsrcSourcePort
  readonly #surface: MrmicSurfacePort
  constructor(source: HdsrcSourcePort, surface: MrmicSurfacePort) { this.#source=source; this.#surface=surface }

  async verify(requestInput: unknown, manifestInput: unknown): Promise<VerificationResultV1> {
    const checks: CheckResultV1[] = []
    let request: ProjectionRequestV1
    let manifest: ProjectionManifestV1
    try {
      request=assertProjectionRequest(requestInput)
      manifest=assertProjectionManifest(manifestInput)
    } catch (error) {
      const fallback = manifestInput as ProjectionManifestV1
      const pncw = new PncwError({code:'INTEGRITY_FAILURE',stage:'VERIFICATION',retryable:false,source:'pncw',message:error instanceof Error?error.message:String(error)})
      const safeManifest: ProjectionManifestV1 = fallback && typeof fallback === 'object' && typeof fallback.resultId === 'string' && typeof fallback.manifestDigest === 'string'
        ? fallback
        : {schema:'pncw-projection-manifest/v1',resultId:'unresolved',sourceIdentity:{authority:'unresolved',sourceId:'unresolved',revision:0,digest:`sha256:${'0'.repeat(64)}`},projectionProfile:{observer:{observerId:'unresolved',observerType:'service',profile:'unresolved'},representation:{profile:'unresolved',protocolVersion:'pncw/0.1'},scope:{scopeId:'unresolved',regionRefs:[]},requestedMode:'structured_manifest'},materializationRefs:[],surfaceRefs:[],integrityRefs:[],authorityRefs:[],residencyMap:[],version:1,manifestDigest:`sha256:${'0'.repeat(64)}`}
      return failureResult(safeManifest,checks,pncw)
    }

    const expectedManifestDigest = deriveManifestDigest(manifest)
    const digestOk = expectedManifestDigest === manifest.manifestDigest
    checks.push(check('manifest-digest',digestOk))
    if (!digestOk) return failureResult(manifest,checks,new PncwError({code:'INTEGRITY_FAILURE',stage:'VERIFICATION',retryable:false,source:'pncw',message:'manifest digest mismatch'}))

    const expectedResultId = deriveResultId({sourceIdentity:manifest.sourceIdentity,scope:request.scope,observerProfile:request.observer,projectionProfile:request.representation,protocolVersion:request.representation.protocolVersion})
    const resultIdOk = expectedResultId === manifest.resultId
    checks.push(check('result-identity',resultIdOk))
    if (!resultIdOk) return failureResult(manifest,checks,new PncwError({code:'VERSION_CONFLICT',stage:'VERIFICATION',retryable:false,source:'pncw',message:'result identity does not match request/source lineage'}))

    try {
      const sourceAuthority=await this.#source.checkAuthority(request.authorityContext)
      checks.push(check('source-authority',sourceAuthority.authorized,sourceAuthority.reason))
      if (!sourceAuthority.authorized) return failureResult(manifest,checks,new PncwError({code:'UNAUTHORIZED',stage:'VERIFICATION',retryable:false,source:'hdsrc',message:sourceAuthority.reason??'source read denied'}))
      const surfaceAuthority=await this.#surface.checkProjectionAuthority(request.authorityContext)
      checks.push(check('surface-authority',surfaceAuthority.authorized,surfaceAuthority.reason))
      if (!surfaceAuthority.authorized) return failureResult(manifest,checks,new PncwError({code:'UNAUTHORIZED',stage:'VERIFICATION',retryable:false,source:'mrmic',message:surfaceAuthority.reason??'surface projection denied'}))

      const currentSource=await this.#source.resolveSource(request.sourceRef,request.authorityContext)
      const sourceFresh=equalIdentity(currentSource,manifest.sourceIdentity)
      checks.push(check('current-source-identity',sourceFresh))
      if (!sourceFresh) return failureResult(manifest,checks,new PncwError({code:'STALE_SOURCE',stage:'VERIFICATION',retryable:true,source:'hdsrc',message:'current source no longer matches manifest source'}))

      if (manifest.materializationRefs.length !== 1 || manifest.surfaceRefs.length !== 1) {
        checks.push(check('single-materialization-surface',false))
        return failureResult(manifest,checks,new PncwError({code:'VERIFICATION_FAILED',stage:'VERIFICATION',retryable:false,source:'pncw',message:'MVP requires exactly one materialization and one surface'}))
      }
      const materialization=manifest.materializationRefs[0]!
      const surface=manifest.surfaceRefs[0]!
      const matLineage=materialization.sourceId===manifest.sourceIdentity.sourceId && materialization.sourceRevision===manifest.sourceIdentity.revision && materialization.sourceDigest===manifest.sourceIdentity.digest
      checks.push(check('materialization-lineage',matLineage))
      if (!matLineage) return failureResult(manifest,checks,new PncwError({code:'VERSION_CONFLICT',stage:'VERIFICATION',retryable:false,source:'pncw',message:'materialization lineage mismatch'}))

      const surfaceState=await this.#surface.surfaceState(surface.surfaceId)
      if (!('sourceId' in surfaceState)) {
        checks.push(check('surface-bound',false))
        return failureResult(manifest,checks,new PncwError({code:'SURFACE_UNAVAILABLE',stage:'VERIFICATION',retryable:true,source:'mrmic',message:'surface is not bound'}))
      }
      const surfaceSnapshotDigest=sha256Digest(surfaceState)
      const manifestSurfaceDigest=sha256Digest(surface)
      const surfaceExact=surfaceSnapshotDigest===manifestSurfaceDigest
      checks.push(check('surface-snapshot',surfaceExact))
      if (!surfaceExact) return failureResult(manifest,checks,new PncwError({code:'VERSION_CONFLICT',stage:'VERIFICATION',retryable:false,source:'mrmic',message:'surface state changed after manifest assembly'}))
      const surfaceLineage=surface.sourceId===manifest.sourceIdentity.sourceId && surface.sourceRevision===manifest.sourceIdentity.revision && surface.sourceDigest===manifest.sourceIdentity.digest && surface.materializationId===materialization.materializationId && surface.materializationDigest===materialization.materializationDigest
      checks.push(check('surface-lineage',surfaceLineage))
      if (!surfaceLineage) return failureResult(manifest,checks,new PncwError({code:'VERSION_CONFLICT',stage:'VERIFICATION',retryable:false,source:'mrmic',message:'surface binding lineage mismatch'}))

      const freshness=await this.#source.checkFreshness(currentSource,materialization,request.authorityContext)
      checks.push(check('materialization-fresh',freshness.fresh,freshness.reason))
      if (!freshness.fresh) return failureResult(manifest,checks,new PncwError({code:'STALE_SOURCE',stage:'VERIFICATION',retryable:freshness.retryable,source:'hdsrc',message:freshness.reason??'materialization stale'}))

      const structural=await this.#source.verifyMaterialization(materialization,request.authorityContext)
      checks.push(check('provider-structural-integrity',structural.verified,structural.reason))
      if (!structural.verified) return failureResult(manifest,checks,new PncwError({code:'INTEGRITY_FAILURE',stage:'VERIFICATION',retryable:false,source:'hdsrc',message:structural.reason??'provider structural verification failed'}))

      const declaredIntegrity=manifest.integrityRefs.some(ref=>ref.structuralVerified)
      checks.push(check('declared-structural-integrity',declaredIntegrity))
      if (!declaredIntegrity) return failureResult(manifest,checks,new PncwError({code:'VERIFICATION_FAILED',stage:'VERIFICATION',retryable:false,source:'pncw',message:'manifest lacks positive structural-integrity evidence'}))

      const root=manifest.residencyMap.find(entry=>entry.regionRef==='manifest:root')
      const rootValid=!!root && root.state!=='INVALID' && root.state!=='UNAVAILABLE'
      checks.push(check('root-residency-valid',rootValid,root?.state))
      if (!rootValid) return failureResult(manifest,checks,new PncwError({code:'VERIFICATION_FAILED',stage:'VERIFICATION',retryable:false,source:'pncw',message:'root manifest residency is invalid'}))

      return successResult(manifest,checks)
    } catch (error) {
      const pncw=asPncwError(error)
      checks.push(check('unexpected-provider-error',false,pncw.message))
      return failureResult(manifest,checks,pncw)
    }
  }
}
