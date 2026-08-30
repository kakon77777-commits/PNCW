import {
  assertAuthorityContext,
  assertProjectionRequest,
  sha256Digest,
} from '../../core/src/index.js'
import type {
  AuthorityContextV1,
  ProjectionRequestV1,
} from '../../core/src/index.js'
import {
  PNCW_PLAN_COMPILER_CONTRACT_VERSION,
  PlanningError,
  planningFailure,
  assertProjectionPlanningReceipt,
  assertProjectionRouteCandidate,
  candidateSemanticDigest,
} from '../../planning/src/index.js'
import type {
  ProjectionPlanningReceiptV1,
  ProjectionRouteCandidateV1,
} from '../../planning/src/index.js'

export { PNCW_PLAN_COMPILER_CONTRACT_VERSION }

export interface CompileProjectionRequestInput {
  receipt: ProjectionPlanningReceiptV1
  candidate: ProjectionRouteCandidateV1
  authorityContext: AuthorityContextV1
}

function reject(message: string): never {
  throw new PlanningError(planningFailure({
    code: 'COMPILER_INTEGRITY_FAILURE',
    stage: 'COMPILATION',
    recovery: 'NONE',
    source: 'pncw',
    message,
  }))
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

export function compileProjectionRequest(
  input: CompileProjectionRequestInput,
): ProjectionRequestV1 {
  let receipt: ProjectionPlanningReceiptV1
  let candidate: ProjectionRouteCandidateV1
  let authorityContext: AuthorityContextV1

  try { receipt = assertProjectionPlanningReceipt(input.receipt) }
  catch { return reject('planning receipt failed structural or derived-identity validation') }

  try { candidate = assertProjectionRouteCandidate(input.candidate) }
  catch { return reject('selected candidate failed structural or derived-identity validation') }

  try { authorityContext = assertAuthorityContext(input.authorityContext) }
  catch { return reject('current PNCW authority context is invalid') }

  if (receipt.compilerContractVersion !== PNCW_PLAN_COMPILER_CONTRACT_VERSION) {
    reject('planning receipt targets an unsupported compiler contract version')
  }
  if (receipt.selectedCandidateId !== candidate.candidateId) {
    reject('planning receipt selected candidate does not match compiler candidate')
  }
  if (receipt.selectedCandidateDigest !== candidateSemanticDigest(candidate)) {
    reject('planning receipt selected-candidate digest does not match compiler candidate semantics')
  }

  const requestId = `pncw:compiled-request:${sha256Digest({
    planningId: receipt.planningId,
    candidateId: candidate.candidateId,
  }).slice('sha256:'.length)}`

  let request: ProjectionRequestV1
  try {
    request = assertProjectionRequest({
      schema: 'pncw-projection-request/v1',
      requestId,
      sourceRef: candidate.sourceRef,
      observer: structuredClone(candidate.observer),
      representation: structuredClone(candidate.representation),
      scope: structuredClone(candidate.scope),
      requestedMode: candidate.requestedMode,
      authorityContext: structuredClone(authorityContext),
    })
  } catch {
    return reject('compiled projection request failed sealed v0.1 structural validation')
  }

  return deepFreeze(request)
}
