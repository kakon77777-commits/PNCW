import type {
  AuthorityRefV1, MaterializationRefV1, ProjectionManifestV1, ProjectionRequestV1,
  ResidencyEntryV1, SourceIdentityV1, SurfaceRefV1,
} from './contracts.js'
import { deriveManifestDigest, deriveResultId } from './identity.js'
import { PncwError } from './errors.js'

export interface StructuralIntegrityInput {
  verified: boolean
  kind: string
  digest?: string
  reason?: string
}

export interface BuildProjectionManifestInput {
  request: ProjectionRequestV1
  source: SourceIdentityV1
  materialization: MaterializationRefV1
  surface: SurfaceRefV1
  authorityRefs: AuthorityRefV1[]
  structuralIntegrity: StructuralIntegrityInput
  residencyMap: ResidencyEntryV1[]
  version: number
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

export function buildProjectionManifest(input: BuildProjectionManifestInput): ProjectionManifestV1 {
  if (input.surface.visible) {
    throw new PncwError({ code:'INVALID_TRANSITION', stage:'MANIFEST', retryable:false, source:'pncw', message:'surface must remain non-visible until PNCW visibility commit' })
  }
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new PncwError({ code:'INVALID_REQUEST', stage:'MANIFEST', retryable:false, source:'pncw', message:'manifest version must be a positive integer' })
  }
  const resultId = deriveResultId({
    sourceIdentity:input.source,
    scope:input.request.scope,
    observerProfile:input.request.observer,
    projectionProfile:input.request.representation,
    protocolVersion:input.request.representation.protocolVersion,
  })
  const payload: Omit<ProjectionManifestV1, 'manifestDigest'> = {
    schema:'pncw-projection-manifest/v1',
    resultId,
    sourceIdentity:structuredClone(input.source),
    projectionProfile:{
      observer:structuredClone(input.request.observer),
      representation:structuredClone(input.request.representation),
      scope:structuredClone(input.request.scope),
      requestedMode:input.request.requestedMode,
    },
    materializationRefs:[structuredClone(input.materialization)],
    surfaceRefs:[structuredClone(input.surface)],
    integrityRefs:[{
      provider:input.materialization.provider,
      kind:input.structuralIntegrity.kind,
      ...(input.structuralIntegrity.digest ? { digest:input.structuralIntegrity.digest } : {}),
      structuralVerified:input.structuralIntegrity.verified,
    }],
    authorityRefs:structuredClone(input.authorityRefs),
    residencyMap:structuredClone(input.residencyMap),
    version:input.version,
  }
  const manifest = { ...payload, manifestDigest: deriveManifestDigest(payload as unknown as Record<string, unknown>) }
  return deepFreeze(manifest)
}
