import type {
  AuthorityContextV1,
  ObservationMode,
  ObserverProfileV1,
  PncwErrorEnvelopeV1,
  ProjectionScopeV1,
  RepresentationProfileV1,
} from '../../core/src/index.js'

export type CanonicalDecimalV1 = string

export type PlanningLifecycleState =
  | 'PLANNING_REQUESTED'
  | 'INPUTS_FROZEN'
  | 'GCM_PLANNED'
  | 'PLAN_ACCEPTED'
  | 'COMPILED'
  | 'PLAN_REJECTED'
  | 'REPLAN_REQUIRED'
  | 'SUPERSEDED'
  | 'ABORTED'

export type PlanningRecovery = 'NONE' | 'RETRY' | 'REPLAN'

export type PlanningFailureCode =
  | 'INVALID_PLANNING_REQUEST'
  | 'INVALID_CANDIDATE'
  | 'INVALID_BUDGET'
  | 'INVALID_POLICY'
  | 'GCM_UNAVAILABLE'
  | 'GCM_NONCONFORMANT'
  | 'NO_FEASIBLE_PLAN'
  | 'POLICY_INDETERMINATE'
  | 'FROZEN_INPUT_MISMATCH'
  | 'CANDIDATE_SET_MISMATCH'
  | 'SELECTED_CANDIDATE_INVALID'
  | 'PLAN_INTEGRITY_FAILURE'
  | 'COMPILER_INTEGRITY_FAILURE'
  | 'REPLAN_REQUIRED'

export type ProjectionDemandEstimateV1 =
  | { kind: 'KNOWN'; value: CanonicalDecimalV1 }
  | { kind: 'BOUNDED'; lower: CanonicalDecimalV1; upper: CanonicalDecimalV1 }
  | {
      kind: 'ESTIMATED'
      value: CanonicalDecimalV1
      hardSafe: boolean
      provenance: string
    }
  | { kind: 'UNKNOWN' }

export interface ProjectionDemandV1 {
  dimensionId: string
  unit: string
  estimate: ProjectionDemandEstimateV1
}

export interface ProjectionDemandProfileV1 {
  demands: ProjectionDemandV1[]
}

export type ProjectionObjectiveObservationKindV1 =
  | { kind: 'KNOWN'; value: CanonicalDecimalV1 }
  | { kind: 'BOUNDED'; lower: CanonicalDecimalV1; upper: CanonicalDecimalV1 }
  | { kind: 'ESTIMATED'; value: CanonicalDecimalV1; provenance: string }
  | { kind: 'UNKNOWN' }

export interface ProjectionObjectiveObservationV1 {
  objectiveId: string
  direction: 'MINIMIZE' | 'MAXIMIZE'
  unit: string
  observation: ProjectionObjectiveObservationKindV1
}

export interface ProjectionRouteCandidateV1 {
  schema: 'pncw-projection-route-candidate/v1'
  candidateId: string
  sourceRef: string
  observer: ObserverProfileV1
  representation: RepresentationProfileV1
  scope: ProjectionScopeV1
  requestedMode: ObservationMode
  planningClass: string
  demandProfile: ProjectionDemandProfileV1
  objectiveObservations: ProjectionObjectiveObservationV1[]
}

export interface ProjectionBudgetV1 {
  schema: 'pncw-projection-budget/v1'
  budgetId: string
  hardLimits: Record<string, { unit: string; maximum: CanonicalDecimalV1 }>
  maxCandidates?: number
  maxMaterializedRegions?: number
}

export type ProjectionSelectionPolicyV1 =
  | { kind: 'LEXICOGRAPHIC'; objectiveOrder: string[] }
  | {
      kind: 'WEIGHTED'
      weights: Record<string, CanonicalDecimalV1>
      normalizationProfile: string
    }

export interface FrozenPlanningInputRefV1 {
  schema: 'pncw-frozen-planning-input/v1'
  snapshotRef: string
  snapshotDigest: string
  gcmPlanningAuthorityDigest: string
  candidateSetDigest: string
  budgetDigest: string
  policyDigest: string
  provider: 'gcm-phase-b'
  providerContractVersion: string
  frozenInputDigest: string
}

export interface ProjectionPlanningRequestV1 {
  schema: 'pncw-projection-planning-request/v1'
  planningRequestId: string
  candidates: ProjectionRouteCandidateV1[]
  budget: ProjectionBudgetV1
  selectionPolicy: ProjectionSelectionPolicyV1
  authorityContext: AuthorityContextV1
  frozenInputRef: FrozenPlanningInputRefV1
}

export type GcmConformanceClaim =
  | 'CONFORMANT'
  | 'NONCONFORMANT'
  | 'INDETERMINATE'

export interface GcmConformanceIdentityV1 {
  profileId: string
  claim: GcmConformanceClaim
  profileDigest: string
  packageName: string
  packageVersion: string
  allocatorContractVersion: string
}

export interface GcmPlanSnapshotV1 {
  schema: 'pncw-gcm-plan-snapshot/v1'
  planningRequestId: string
  candidateSetDigest: string
  budgetDigest: string
  policyDigest: string
  frozenInputDigest: string
  selectedCandidateId: string
  selectedCandidateDigest: string
  feasibleCandidateIds: string[]
  rejectedCandidates: { candidateId: string; reasonCode: string }[]
  allocationPlanRef: string
  allocationPlanDigest: string
  policySelectionRef?: string
  policySelectionDigest?: string
  allocatorContractVersion: string
  conformance: GcmConformanceIdentityV1
  replanLineageRef?: string
  planSnapshotDigest: string
}

export interface ProjectionPlanningReceiptV1 {
  schema: 'pncw-projection-planning-receipt/v1'
  planningId: string
  planningRequestId: string
  selectedCandidateId: string
  selectedCandidateDigest: string
  gcmPlanDigest: string
  frozenInputDigest: string
  conformanceDigest: string
  compilerContractVersion: string
}

export interface PlanningFailureV1 {
  schema: 'pncw-planning-failure/v1'
  code: PlanningFailureCode
  stage: 'REQUEST' | 'FREEZE' | 'GCM' | 'PLAN_ACCEPTANCE' | 'COMPILATION' | 'REPLAN'
  recovery: PlanningRecovery
  source: 'pncw' | 'gcm-phase-b'
  message: string
  evidenceRef?: string
}

export interface ProjectionReplanRequestV1 {
  schema: 'pncw-projection-replan-request/v1'
  parentPlanningId: string
  planningRequestId: string
  invalidatedCandidateId: string
  projectionFailure: PncwErrorEnvelopeV1
  newFrozenInputRef: FrozenPlanningInputRefV1
}
