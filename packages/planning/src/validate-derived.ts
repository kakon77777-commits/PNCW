import {
  assertFrozenPlanningInputRef as assertFrozenPlanningInputRefStructure,
  assertGcmPlanSnapshot as assertGcmPlanSnapshotStructure,
  assertProjectionBudget as assertProjectionBudgetStructure,
  assertProjectionPlanningReceipt as assertProjectionPlanningReceiptStructure,
  assertProjectionPlanningRequest as assertProjectionPlanningRequestStructure,
  assertProjectionReplanRequest as assertProjectionReplanRequestStructure,
  assertProjectionRouteCandidate as assertProjectionRouteCandidateStructure,
} from './validate.js'
import {
  deriveBudgetId,
  deriveCandidateId,
  deriveFrozenInputDigest,
  deriveGcmPlanSnapshotDigest,
  derivePlanningId,
  derivePlanningRequestId,
} from './identity.js'
import type {
  FrozenPlanningInputRefV1,
  GcmPlanSnapshotV1,
  ProjectionBudgetV1,
  ProjectionPlanningReceiptV1,
  ProjectionPlanningRequestV1,
  ProjectionReplanRequestV1,
  ProjectionRouteCandidateV1,
} from './types.js'

export function assertProjectionRouteCandidate(value:unknown):ProjectionRouteCandidateV1{
  const out=assertProjectionRouteCandidateStructure(value)
  if(out.candidateId!==deriveCandidateId(out)) throw new Error('projectionRouteCandidate.candidateId does not match derived CID')
  return out
}

export function assertProjectionBudget(value:unknown):ProjectionBudgetV1{
  const out=assertProjectionBudgetStructure(value)
  if(out.budgetId!==deriveBudgetId(out)) throw new Error('projectionBudget.budgetId does not match derived BID')
  return out
}

export function assertFrozenPlanningInputRef(value:unknown):FrozenPlanningInputRefV1{
  const out=assertFrozenPlanningInputRefStructure(value)
  if(out.frozenInputDigest!==deriveFrozenInputDigest(out)) throw new Error('frozenPlanningInput.frozenInputDigest does not match derived FID')
  return out
}

export function assertProjectionPlanningRequest(value:unknown):ProjectionPlanningRequestV1{
  const out=assertProjectionPlanningRequestStructure(value)
  for(const candidate of out.candidates) assertProjectionRouteCandidate(candidate)
  assertProjectionBudget(out.budget)
  assertFrozenPlanningInputRef(out.frozenInputRef)
  if(out.planningRequestId!==derivePlanningRequestId(out)) throw new Error('projectionPlanningRequest.planningRequestId does not match derived PPRID')
  return out
}

export function assertGcmPlanSnapshot(value:unknown):GcmPlanSnapshotV1{
  const out=assertGcmPlanSnapshotStructure(value)
  if(out.planSnapshotDigest!==deriveGcmPlanSnapshotDigest(out)) throw new Error('gcmPlanSnapshot.planSnapshotDigest does not match derived GPD')
  return out
}

export function assertProjectionPlanningReceipt(value:unknown):ProjectionPlanningReceiptV1{
  const out=assertProjectionPlanningReceiptStructure(value)
  if(out.planningId!==derivePlanningId(out)) throw new Error('projectionPlanningReceipt.planningId does not match derived PPID')
  return out
}

export function assertProjectionReplanRequest(value:unknown):ProjectionReplanRequestV1{
  const out=assertProjectionReplanRequestStructure(value)
  assertFrozenPlanningInputRef(out.newFrozenInputRef)
  return out
}
