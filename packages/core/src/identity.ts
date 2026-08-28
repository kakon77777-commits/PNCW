import type {
  ObserverProfileV1, ProjectionManifestV1, ProjectionScopeV1, RepresentationProfileV1,
  RevealMode, SourceIdentityV1, VerificationResultV1,
} from './contracts.js'
import { sha256Digest } from './canonical.js'

export interface ResultIdentityInput {
  sourceIdentity: SourceIdentityV1
  scope: ProjectionScopeV1
  observerProfile: ObserverProfileV1
  projectionProfile: RepresentationProfileV1
  protocolVersion: string
}

export function deriveResultId(input: ResultIdentityInput): string {
  const digest = sha256Digest({
    sourceIdentity: input.sourceIdentity,
    scope: input.scope,
    observerProfile: input.observerProfile,
    projectionProfile: input.projectionProfile,
    protocolVersion: input.protocolVersion,
  })
  return `pncw:result:${digest.slice('sha256:'.length)}`
}

function withoutKeys<T extends Record<string, unknown>>(input: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) if (!keys.includes(key)) out[key] = value
  return out
}

export function deriveManifestDigest(manifest: ProjectionManifestV1 | Record<string, unknown>): string {
  return sha256Digest(withoutKeys(manifest as Record<string, unknown>, ['manifestDigest','generatedAt','visibleAt']))
}

export function deriveVerificationDigest(result: VerificationResultV1 | Record<string, unknown>): string {
  return sha256Digest(withoutKeys(result as Record<string, unknown>, ['verificationDigest','verifiedAt','visibleAt']))
}

export interface VisibilityCommitIdentityInput {
  resultId: string
  manifestDigest: string
  verificationDigest: string
  revealMode: RevealMode
  visibleAt?: string
}

export function deriveVisibilityCommitId(input: VisibilityCommitIdentityInput): string {
  const digest = sha256Digest({
    resultId: input.resultId,
    manifestDigest: input.manifestDigest,
    verificationDigest: input.verificationDigest,
    revealMode: input.revealMode,
  })
  return `pncw:visibility:${digest.slice('sha256:'.length)}`
}
