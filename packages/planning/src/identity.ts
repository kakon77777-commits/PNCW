import { sha256Digest } from '../../core/src/index.js'
import type {
  FrozenPlanningInputRefV1,
  GcmConformanceIdentityV1,
  GcmPlanSnapshotV1,
  ProjectionBudgetV1,
  ProjectionPlanningReceiptV1,
  ProjectionPlanningRequestV1,
  ProjectionRouteCandidateV1,
  ProjectionSelectionPolicyV1,
} from './types.js'
import {
  normalizeCandidatePayload,
  normalizeGcmPlanSnapshotPayload,
  type CandidatePayloadV1,
  type GcmPlanSnapshotPayloadV1,
} from './normalize.js'

function prefixed(prefix:string,digest:string):string{
  return `${prefix}${digest.slice('sha256:'.length)}`
}

export function deepFreeze<T>(value:T):T{
  if(value && typeof value==='object' && !Object.isFrozen(value)){
    Object.freeze(value)
    for(const child of Object.values(value as Record<string,unknown>)) deepFreeze(child)
  }
  return value
}

function candidatePayload(
  input: ProjectionRouteCandidateV1 | CandidatePayloadV1,
): CandidatePayloadV1 {
  const { candidateId:_candidateId, ...payload } = input as ProjectionRouteCandidateV1
  return normalizeCandidatePayload(payload)
}

export function candidateSemanticDigest(
  input: ProjectionRouteCandidateV1 | CandidatePayloadV1,
):string{
  return sha256Digest(candidatePayload(input))
}

export function deriveCandidateId(
  input: ProjectionRouteCandidateV1 | CandidatePayloadV1,
):string{
  return prefixed('pncw:candidate:',candidateSemanticDigest(input))
}

export function buildProjectionRouteCandidate(
  input: CandidatePayloadV1,
):ProjectionRouteCandidateV1{
  const payload=candidatePayload(input)
  return deepFreeze({...payload,candidateId:deriveCandidateId(payload)})
}

export function deriveBudgetDigest(
  input: ProjectionBudgetV1 | Omit<ProjectionBudgetV1,'budgetId'>,
):string{
  const { budgetId:_budgetId, ...payload } = input as ProjectionBudgetV1
  return sha256Digest(payload)
}

export function deriveBudgetId(
  input: ProjectionBudgetV1 | Omit<ProjectionBudgetV1,'budgetId'>,
):string{
  return prefixed('pncw:budget:',deriveBudgetDigest(input))
}

export function buildProjectionBudget(
  input: Omit<ProjectionBudgetV1,'budgetId'>,
):ProjectionBudgetV1{
  const payload=structuredClone(input)
  return deepFreeze({...payload,budgetId:deriveBudgetId(payload)})
}

export function derivePolicyDigest(policy:ProjectionSelectionPolicyV1):string{
  return sha256Digest(policy)
}

export function deriveCandidateSetDigest(candidates:ProjectionRouteCandidateV1[]):string{
  const ordered=[...candidates]
    .map(candidate=>({candidateId:deriveCandidateId(candidate),payload:candidatePayload(candidate)}))
    .sort((a,b)=>a.candidateId.localeCompare(b.candidateId))
  for(let i=1;i<ordered.length;i++){
    if(ordered[i-1]!.candidateId===ordered[i]!.candidateId){
      throw new Error(`duplicate candidate ${ordered[i]!.candidateId}`)
    }
  }
  return sha256Digest(ordered.map(item=>item.payload))
}

export function deriveFrozenInputDigest(
  input: FrozenPlanningInputRefV1 | Omit<FrozenPlanningInputRefV1,'frozenInputDigest'>,
):string{
  const frozen=input as FrozenPlanningInputRefV1
  const {
    snapshotRef:_snapshotRef,
    frozenInputDigest:_frozenInputDigest,
    ...payload
  }=frozen
  return sha256Digest(payload)
}

export function buildFrozenPlanningInputRef(
  input: Omit<FrozenPlanningInputRefV1,'frozenInputDigest'>,
):FrozenPlanningInputRefV1{
  const payload=structuredClone(input)
  return deepFreeze({...payload,frozenInputDigest:deriveFrozenInputDigest(payload)})
}

export function derivePlanningRequestId(request:ProjectionPlanningRequestV1):string{
  return prefixed('pncw:plan-request:',sha256Digest({
    schema:'pncw-projection-planning-request/v1',
    frozenInputDigest:request.frozenInputRef.frozenInputDigest,
  }))
}

export function buildProjectionPlanningRequest(
  input: Omit<ProjectionPlanningRequestV1,'planningRequestId'>,
):ProjectionPlanningRequestV1{
  const payload=structuredClone(input)
  const provisional={...payload,planningRequestId:''} as ProjectionPlanningRequestV1
  return deepFreeze({...payload,planningRequestId:derivePlanningRequestId(provisional)})
}

export function deriveConformanceDigest(conformance:GcmConformanceIdentityV1):string{
  return sha256Digest(conformance)
}

function planPayload(
  input:GcmPlanSnapshotV1 | GcmPlanSnapshotPayloadV1,
):GcmPlanSnapshotPayloadV1{
  const {planSnapshotDigest:_planSnapshotDigest,...payload}=input as GcmPlanSnapshotV1
  return normalizeGcmPlanSnapshotPayload(payload)
}

export function deriveGcmPlanSnapshotDigest(
  input:GcmPlanSnapshotV1 | GcmPlanSnapshotPayloadV1,
):string{
  return sha256Digest(planPayload(input))
}

export function buildGcmPlanSnapshot(
  input:GcmPlanSnapshotPayloadV1,
):GcmPlanSnapshotV1{
  const payload=planPayload(input)
  return deepFreeze({...payload,planSnapshotDigest:deriveGcmPlanSnapshotDigest(payload)})
}

export function derivePlanningId(
  input:ProjectionPlanningReceiptV1 | Omit<ProjectionPlanningReceiptV1,'planningId'>,
):string{
  const {planningId:_planningId,...payload}=input as ProjectionPlanningReceiptV1
  return prefixed('pncw:planning:',sha256Digest(payload))
}

export function buildProjectionPlanningReceipt(
  input:Omit<ProjectionPlanningReceiptV1,'planningId'>,
):ProjectionPlanningReceiptV1{
  const payload=structuredClone(input)
  return deepFreeze({...payload,planningId:derivePlanningId(payload)})
}
