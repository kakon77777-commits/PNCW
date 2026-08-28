import type {
  AuthorityContextV1, AuthorityRefV1, CheckResultV1, IntegrityRefV1,
  MaterializationRefV1, ObserverProfileV1, PncwErrorCode, PncwErrorEnvelopeV1,
  PncwStage, PreparedSurfaceV1, ProjectionManifestV1, ProjectionRequestV1,
  ProjectionScopeV1, ReadinessResultV1, RepresentationProfileV1, ResidencyEntryV1,
  SourceCapabilitiesV1, SourceIdentityV1, SurfaceCapabilitiesV1, SurfaceRefV1,
  VerificationResultV1, VisibilityStateV1,
} from './contracts.js'

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/
const OBS_MODES = new Set(['human_preview', 'machine_carrier', 'structured_manifest'])
const REVEAL_MODES = new Set(['ATOMIC_ARTIFACT', 'SEMANTIC_BATCH', 'STREAM', 'HYBRID'])
const RESIDENCY = new Set(['DECLARED', 'AVAILABLE', 'RESIDENT', 'UNAVAILABLE', 'INVALID'])
const LIFECYCLE = new Set(['REQUESTED','RESOLVED','READY','PROJECTED','VERIFIED','VISIBLE','STALE','INTEGRITY_FAILURE','UNAUTHORIZED','UNSUPPORTED','UNAVAILABLE','CONFLICT','ABORTED','SUPERSEDED'])
const ERROR_CODES = new Set(['INVALID_REQUEST','UNAUTHORIZED','UNSUPPORTED','SOURCE_UNAVAILABLE','STALE_SOURCE','INTEGRITY_FAILURE','MATERIALIZATION_FAILED','SURFACE_UNAVAILABLE','VERSION_CONFLICT','VERIFICATION_FAILED','INVALID_TRANSITION','ALREADY_VISIBLE','ABORTED'])
const STAGES = new Set(['REQUEST','SOURCE','READINESS','MATERIALIZATION','SURFACE','MANIFEST','VERIFICATION','VISIBILITY','RECOVERY'])

function rec(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  const out = value as Record<string, unknown>
  for (const key of Object.keys(out)) if (!keys.includes(key)) throw new Error(`${label}.${key} is not allowed`)
  return out
}
function str(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`)
  return value
}
function int(value: unknown, label: string, min = 0): number {
  if (!Number.isInteger(value) || (value as number) < min) throw new Error(`${label} must be an integer >= ${min}`)
  return value as number
}
function digest(value: unknown, label: string): string {
  const v = str(value, label)
  if (!DIGEST_RE.test(v)) throw new Error(`${label} must be a sha256 digest`)
  return v
}
function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map((x, i) => str(x, `${label}[${i}]`))
}
function enumString<T extends string>(value: unknown, label: string, set: Set<string>): T {
  const v = str(value, label)
  if (!set.has(v)) throw new Error(`${label} has unsupported value ${v}`)
  return v as T
}

export function assertObserver(value: unknown): ObserverProfileV1 {
  const x = rec(value, 'observer', ['observerId','observerType','profile'])
  const observerType = enumString<'human'|'ai'|'service'>(x.observerType, 'observer.observerType', new Set(['human','ai','service']))
  return { observerId: str(x.observerId,'observer.observerId'), observerType, profile: str(x.profile,'observer.profile') }
}
export function assertRepresentation(value: unknown): RepresentationProfileV1 {
  const x = rec(value, 'representation', ['profile','protocolVersion'])
  return { profile: str(x.profile,'representation.profile'), protocolVersion: str(x.protocolVersion,'representation.protocolVersion') }
}
export function assertScope(value: unknown): ProjectionScopeV1 {
  const x = rec(value, 'scope', ['scopeId','regionRefs'])
  return { scopeId: str(x.scopeId,'scope.scopeId'), regionRefs: stringArray(x.regionRefs,'scope.regionRefs') }
}
export function assertAuthorityContext(value: unknown): AuthorityContextV1 {
  const x = rec(value, 'authorityContext', ['principalId','sourceRead','surfaceProject'])
  return { principalId: str(x.principalId,'authorityContext.principalId'), sourceRead: bool(x.sourceRead,'authorityContext.sourceRead'), surfaceProject: bool(x.surfaceProject,'authorityContext.surfaceProject') }
}
export function assertSourceIdentity(value: unknown): SourceIdentityV1 {
  const x = rec(value, 'sourceIdentity', ['authority','sourceId','revision','digest'])
  return { authority: str(x.authority,'sourceIdentity.authority'), sourceId: str(x.sourceId,'sourceIdentity.sourceId'), revision: int(x.revision,'sourceIdentity.revision'), digest: digest(x.digest,'sourceIdentity.digest') }
}
function assertCheck(value: unknown, label = 'check'): CheckResultV1 {
  const x = rec(value,label,['name','passed','detail'])
  return { name: str(x.name,`${label}.name`), passed: bool(x.passed,`${label}.passed`), ...(x.detail === undefined ? {} : { detail: str(x.detail,`${label}.detail`) }) }
}
export function assertSourceCapabilities(value: unknown): SourceCapabilitiesV1 {
  const x = rec(value,'sourceCapabilities',['provider','providerVersion','observationModes','carrierProfiles','partialRead','canonicalMutation'])
  if (x.canonicalMutation !== false) throw new Error('sourceCapabilities.canonicalMutation must be false')
  if (!Array.isArray(x.observationModes)) throw new Error('sourceCapabilities.observationModes must be an array')
  return {
    provider: str(x.provider,'sourceCapabilities.provider'), providerVersion: str(x.providerVersion,'sourceCapabilities.providerVersion'),
    observationModes: x.observationModes.map((v,i)=>enumString(v,`sourceCapabilities.observationModes[${i}]`,OBS_MODES)),
    carrierProfiles: stringArray(x.carrierProfiles,'sourceCapabilities.carrierProfiles'), partialRead: bool(x.partialRead,'sourceCapabilities.partialRead'), canonicalMutation: false,
  }
}
export function assertSurfaceCapabilities(value: unknown): SurfaceCapabilitiesV1 {
  const x = rec(value,'surfaceCapabilities',['provider','providerVersion','portalSchema','readOnlyProjection','canonicalMutation'])
  if (x.canonicalMutation !== false) throw new Error('surfaceCapabilities.canonicalMutation must be false')
  return { provider:str(x.provider,'surfaceCapabilities.provider'),providerVersion:str(x.providerVersion,'surfaceCapabilities.providerVersion'),portalSchema:str(x.portalSchema,'surfaceCapabilities.portalSchema'),readOnlyProjection:bool(x.readOnlyProjection,'surfaceCapabilities.readOnlyProjection'),canonicalMutation:false }
}
export function assertMaterializationRef(value: unknown): MaterializationRefV1 {
  const x = rec(value,'materializationRef',['provider','materializationId','sourceId','sourceRevision','sourceDigest','carrierProfile','materializationDigest','machineResourceUri','previewResourceUri','partialRead'])
  return { provider:str(x.provider,'materializationRef.provider'), materializationId:str(x.materializationId,'materializationRef.materializationId'), sourceId:str(x.sourceId,'materializationRef.sourceId'), sourceRevision:int(x.sourceRevision,'materializationRef.sourceRevision'), sourceDigest:digest(x.sourceDigest,'materializationRef.sourceDigest'), carrierProfile:str(x.carrierProfile,'materializationRef.carrierProfile'), materializationDigest:digest(x.materializationDigest,'materializationRef.materializationDigest'), machineResourceUri:str(x.machineResourceUri,'materializationRef.machineResourceUri'), previewResourceUri:str(x.previewResourceUri,'materializationRef.previewResourceUri'), partialRead:bool(x.partialRead,'materializationRef.partialRead') }
}
export function assertPreparedSurface(value: unknown): PreparedSurfaceV1 {
  const x=rec(value,'preparedSurface',['provider','surfaceId','portalSchema','visible'])
  if (x.visible !== false) throw new Error('preparedSurface.visible must be false')
  return {provider:str(x.provider,'preparedSurface.provider'),surfaceId:str(x.surfaceId,'preparedSurface.surfaceId'),portalSchema:str(x.portalSchema,'preparedSurface.portalSchema'),visible:false}
}
export function assertSurfaceRef(value: unknown): SurfaceRefV1 {
  const x=rec(value,'surfaceRef',['provider','surfaceId','portalSchema','sourceId','sourceRevision','sourceDigest','materializationId','materializationDigest','bindingDigest','visible'])
  return {provider:str(x.provider,'surfaceRef.provider'),surfaceId:str(x.surfaceId,'surfaceRef.surfaceId'),portalSchema:str(x.portalSchema,'surfaceRef.portalSchema'),sourceId:str(x.sourceId,'surfaceRef.sourceId'),sourceRevision:int(x.sourceRevision,'surfaceRef.sourceRevision'),sourceDigest:digest(x.sourceDigest,'surfaceRef.sourceDigest'),materializationId:str(x.materializationId,'surfaceRef.materializationId'),materializationDigest:digest(x.materializationDigest,'surfaceRef.materializationDigest'),bindingDigest:digest(x.bindingDigest,'surfaceRef.bindingDigest'),visible:bool(x.visible,'surfaceRef.visible')}
}
function assertIntegrityRef(value: unknown): IntegrityRefV1 {
  const x=rec(value,'integrityRef',['provider','kind','digest','structuralVerified'])
  return {provider:str(x.provider,'integrityRef.provider'),kind:str(x.kind,'integrityRef.kind'),...(x.digest===undefined?{}:{digest:digest(x.digest,'integrityRef.digest')}),structuralVerified:bool(x.structuralVerified,'integrityRef.structuralVerified')}
}
function assertAuthorityRef(value: unknown): AuthorityRefV1 {
  const x=rec(value,'authorityRef',['provider','principalId','grant','authorized'])
  return {provider:str(x.provider,'authorityRef.provider'),principalId:str(x.principalId,'authorityRef.principalId'),grant:str(x.grant,'authorityRef.grant'),authorized:bool(x.authorized,'authorityRef.authorized')}
}
function assertResidency(value: unknown): ResidencyEntryV1 {
  const x=rec(value,'residencyEntry',['regionRef','state','bytesResident','bytesTotal'])
  return {regionRef:str(x.regionRef,'residencyEntry.regionRef'),state:enumString(x.state,'residencyEntry.state',RESIDENCY),...(x.bytesResident===undefined?{}:{bytesResident:int(x.bytesResident,'residencyEntry.bytesResident')}),...(x.bytesTotal===undefined?{}:{bytesTotal:int(x.bytesTotal,'residencyEntry.bytesTotal')})}
}

export function assertProjectionRequest(value: unknown): ProjectionRequestV1 {
  const x=rec(value,'projectionRequest',['schema','requestId','sourceRef','observer','representation','scope','requestedMode','authorityContext'])
  if (x.schema !== 'pncw-projection-request/v1') throw new Error('projectionRequest.schema is invalid')
  return {schema:'pncw-projection-request/v1',requestId:str(x.requestId,'projectionRequest.requestId'),sourceRef:str(x.sourceRef,'projectionRequest.sourceRef'),observer:assertObserver(x.observer),representation:assertRepresentation(x.representation),scope:assertScope(x.scope),requestedMode:enumString(x.requestedMode,'projectionRequest.requestedMode',OBS_MODES),authorityContext:assertAuthorityContext(x.authorityContext)}
}
export function assertProjectionManifest(value: unknown): ProjectionManifestV1 {
  const x=rec(value,'projectionManifest',['schema','resultId','sourceIdentity','projectionProfile','materializationRefs','surfaceRefs','integrityRefs','authorityRefs','residencyMap','version','manifestDigest'])
  if (x.schema !== 'pncw-projection-manifest/v1') throw new Error('projectionManifest.schema is invalid')
  const p=rec(x.projectionProfile,'projectionManifest.projectionProfile',['observer','representation','scope','requestedMode'])
  for (const [name,val] of [['materializationRefs',x.materializationRefs],['surfaceRefs',x.surfaceRefs],['integrityRefs',x.integrityRefs],['authorityRefs',x.authorityRefs],['residencyMap',x.residencyMap]] as const) if (!Array.isArray(val)) throw new Error(`projectionManifest.${name} must be an array`)
  return {schema:'pncw-projection-manifest/v1',resultId:str(x.resultId,'projectionManifest.resultId'),sourceIdentity:assertSourceIdentity(x.sourceIdentity),projectionProfile:{observer:assertObserver(p.observer),representation:assertRepresentation(p.representation),scope:assertScope(p.scope),requestedMode:enumString(p.requestedMode,'projectionManifest.projectionProfile.requestedMode',OBS_MODES)},materializationRefs:(x.materializationRefs as unknown[]).map(assertMaterializationRef),surfaceRefs:(x.surfaceRefs as unknown[]).map(assertSurfaceRef),integrityRefs:(x.integrityRefs as unknown[]).map(assertIntegrityRef),authorityRefs:(x.authorityRefs as unknown[]).map(assertAuthorityRef),residencyMap:(x.residencyMap as unknown[]).map(assertResidency),version:int(x.version,'projectionManifest.version',1),manifestDigest:digest(x.manifestDigest,'projectionManifest.manifestDigest')}
}
export function assertPncwErrorEnvelope(value: unknown): PncwErrorEnvelopeV1 {
  const x=rec(value,'errorEnvelope',['schema','code','stage','retryable','source','message','causeRef'])
  if (x.schema !== 'pncw-error/v1') throw new Error('errorEnvelope.schema is invalid')
  const source=enumString<'pncw'|'hdsrc'|'mrmic'>(x.source,'errorEnvelope.source',new Set(['pncw','hdsrc','mrmic']))
  return {schema:'pncw-error/v1',code:enumString<PncwErrorCode>(x.code,'errorEnvelope.code',ERROR_CODES),stage:enumString<PncwStage>(x.stage,'errorEnvelope.stage',STAGES),retryable:bool(x.retryable,'errorEnvelope.retryable'),source,message:str(x.message,'errorEnvelope.message'),...(x.causeRef===undefined?{}:{causeRef:str(x.causeRef,'errorEnvelope.causeRef')})}
}
export function assertReadinessResult(value: unknown): ReadinessResultV1 {
  const x=rec(value,'readinessResult',['schema','requestId','ready','checks','blockingError','sourceSnapshot','capabilitySnapshot'])
  if (x.schema !== 'pncw-readiness-result/v1') throw new Error('readinessResult.schema is invalid')
  if (!Array.isArray(x.checks)) throw new Error('readinessResult.checks must be an array')
  const c=rec(x.capabilitySnapshot,'readinessResult.capabilitySnapshot',['source','surface'])
  return {schema:'pncw-readiness-result/v1',requestId:str(x.requestId,'readinessResult.requestId'),ready:bool(x.ready,'readinessResult.ready'),checks:x.checks.map((v,i)=>assertCheck(v,`readinessResult.checks[${i}]`)),...(x.blockingError===undefined?{}:{blockingError:assertPncwErrorEnvelope(x.blockingError)}),sourceSnapshot:assertSourceIdentity(x.sourceSnapshot),capabilitySnapshot:{source:assertSourceCapabilities(c.source),surface:assertSurfaceCapabilities(c.surface)}}
}
export function assertVerificationResult(value: unknown): VerificationResultV1 {
  const x=rec(value,'verificationResult',['schema','resultId','verified','manifestDigest','checks','failure','verificationDigest'])
  if (x.schema !== 'pncw-verification-result/v1') throw new Error('verificationResult.schema is invalid')
  if (!Array.isArray(x.checks)) throw new Error('verificationResult.checks must be an array')
  return {schema:'pncw-verification-result/v1',resultId:str(x.resultId,'verificationResult.resultId'),verified:bool(x.verified,'verificationResult.verified'),manifestDigest:digest(x.manifestDigest,'verificationResult.manifestDigest'),checks:x.checks.map((v,i)=>assertCheck(v,`verificationResult.checks[${i}]`)),...(x.failure===undefined?{}:{failure:assertPncwErrorEnvelope(x.failure)}),verificationDigest:digest(x.verificationDigest,'verificationResult.verificationDigest')}
}
export function assertVisibilityState(value: unknown): VisibilityStateV1 {
  const x=rec(value,'visibilityState',['schema','resultId','state','visibilityCommitId','revealMode','visibleAt','supersedes'])
  if (x.schema !== 'pncw-visibility-state/v1') throw new Error('visibilityState.schema is invalid')
  return {schema:'pncw-visibility-state/v1',resultId:str(x.resultId,'visibilityState.resultId'),state:enumString(x.state,'visibilityState.state',LIFECYCLE),...(x.visibilityCommitId===undefined?{}:{visibilityCommitId:str(x.visibilityCommitId,'visibilityState.visibilityCommitId')}),...(x.revealMode===undefined?{}:{revealMode:enumString(x.revealMode,'visibilityState.revealMode',REVEAL_MODES)}),...(x.visibleAt===undefined?{}:{visibleAt:str(x.visibleAt,'visibilityState.visibleAt')}),...(x.supersedes===undefined?{}:{supersedes:str(x.supersedes,'visibilityState.supersedes')})}
}
