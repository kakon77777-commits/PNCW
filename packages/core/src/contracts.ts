export type ObservationMode = 'human_preview' | 'machine_carrier' | 'structured_manifest'
export type RevealMode = 'ATOMIC_ARTIFACT' | 'SEMANTIC_BATCH' | 'STREAM' | 'HYBRID'
export type ResidencyState = 'DECLARED' | 'AVAILABLE' | 'RESIDENT' | 'UNAVAILABLE' | 'INVALID'
export type LifecycleState =
  | 'REQUESTED' | 'RESOLVED' | 'READY' | 'PROJECTED' | 'VERIFIED' | 'VISIBLE'
  | 'STALE' | 'INTEGRITY_FAILURE' | 'UNAUTHORIZED' | 'UNSUPPORTED'
  | 'UNAVAILABLE' | 'CONFLICT' | 'ABORTED' | 'SUPERSEDED'

export type PncwErrorCode =
  | 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'UNSUPPORTED' | 'SOURCE_UNAVAILABLE'
  | 'STALE_SOURCE' | 'INTEGRITY_FAILURE' | 'MATERIALIZATION_FAILED'
  | 'SURFACE_UNAVAILABLE' | 'VERSION_CONFLICT' | 'VERIFICATION_FAILED'
  | 'INVALID_TRANSITION' | 'ALREADY_VISIBLE' | 'ABORTED'

export type PncwStage =
  | 'REQUEST' | 'SOURCE' | 'READINESS' | 'MATERIALIZATION' | 'SURFACE'
  | 'MANIFEST' | 'VERIFICATION' | 'VISIBILITY' | 'RECOVERY'

export interface ObserverProfileV1 {
  observerId: string
  observerType: 'human' | 'ai' | 'service'
  profile: string
}

export interface RepresentationProfileV1 {
  profile: string
  protocolVersion: string
}

export interface ProjectionScopeV1 {
  scopeId: string
  regionRefs: string[]
}

export interface AuthorityContextV1 {
  principalId: string
  sourceRead: boolean
  surfaceProject: boolean
}

export interface SourceIdentityV1 {
  authority: string
  sourceId: string
  revision: number
  digest: string
}

export interface CheckResultV1 {
  name: string
  passed: boolean
  detail?: string
}

export interface SourceCapabilitiesV1 {
  provider: string
  providerVersion: string
  observationModes: ObservationMode[]
  carrierProfiles: string[]
  partialRead: boolean
  canonicalMutation: false
}

export interface SurfaceCapabilitiesV1 {
  provider: string
  providerVersion: string
  portalSchema: string
  readOnlyProjection: boolean
  canonicalMutation: false
}

export interface MaterializationRefV1 {
  provider: string
  materializationId: string
  sourceId: string
  sourceRevision: number
  sourceDigest: string
  carrierProfile: string
  materializationDigest: string
  machineResourceUri: string
  previewResourceUri: string
  partialRead: boolean
}

export interface PreparedSurfaceV1 {
  provider: string
  surfaceId: string
  portalSchema: string
  visible: false
}

export interface SurfaceRefV1 {
  provider: string
  surfaceId: string
  portalSchema: string
  sourceId: string
  sourceRevision: number
  sourceDigest: string
  materializationId: string
  materializationDigest: string
  bindingDigest: string
  visible: boolean
}

export interface IntegrityRefV1 {
  provider: string
  kind: string
  digest?: string
  structuralVerified: boolean
}

export interface AuthorityRefV1 {
  provider: string
  principalId: string
  grant: string
  authorized: boolean
}

export interface ResidencyEntryV1 {
  regionRef: string
  state: ResidencyState
  bytesResident?: number
  bytesTotal?: number
}

export interface ProjectionRequestV1 {
  schema: 'pncw-projection-request/v1'
  requestId: string
  sourceRef: string
  observer: ObserverProfileV1
  representation: RepresentationProfileV1
  scope: ProjectionScopeV1
  requestedMode: ObservationMode
  authorityContext: AuthorityContextV1
}

export interface ProjectionManifestV1 {
  schema: 'pncw-projection-manifest/v1'
  resultId: string
  sourceIdentity: SourceIdentityV1
  projectionProfile: {
    observer: ObserverProfileV1
    representation: RepresentationProfileV1
    scope: ProjectionScopeV1
    requestedMode: ObservationMode
  }
  materializationRefs: MaterializationRefV1[]
  surfaceRefs: SurfaceRefV1[]
  integrityRefs: IntegrityRefV1[]
  authorityRefs: AuthorityRefV1[]
  residencyMap: ResidencyEntryV1[]
  version: number
  manifestDigest: string
}

export interface ReadinessResultV1 {
  schema: 'pncw-readiness-result/v1'
  requestId: string
  ready: boolean
  checks: CheckResultV1[]
  blockingError?: PncwErrorEnvelopeV1
  sourceSnapshot: SourceIdentityV1
  capabilitySnapshot: {
    source: SourceCapabilitiesV1
    surface: SurfaceCapabilitiesV1
  }
}

export interface VerificationResultV1 {
  schema: 'pncw-verification-result/v1'
  resultId: string
  verified: boolean
  manifestDigest: string
  checks: CheckResultV1[]
  failure?: PncwErrorEnvelopeV1
  verificationDigest: string
}

export interface VisibilityStateV1 {
  schema: 'pncw-visibility-state/v1'
  resultId: string
  state: LifecycleState
  visibilityCommitId?: string
  revealMode?: RevealMode
  visibleAt?: string
  supersedes?: string
}

export interface PncwErrorEnvelopeV1 {
  schema: 'pncw-error/v1'
  code: PncwErrorCode
  stage: PncwStage
  retryable: boolean
  source: 'pncw' | 'hdsrc' | 'mrmic'
  message: string
  causeRef?: string
}
