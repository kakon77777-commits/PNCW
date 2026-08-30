import type {
  FrozenPlanningInputRefV1,
  GcmConformanceIdentityV1,
  GcmPlanSnapshotV1,
  ProjectionBudgetV1,
  ProjectionReplanRequestV1,
  ProjectionRouteCandidateV1,
  ProjectionSelectionPolicyV1,
} from '../../planning/src/index.js'

export interface GcmPlanningCapabilitiesV1 {
  provider: 'gcm-phase-b'
  adapterVersion: string
  providerContractVersions: string[]
  conformanceProfiles: string[]
  supportsReplan: boolean
  policyKinds: ('LEXICOGRAPHIC'|'WEIGHTED')[]
  normalizationProfiles: string[]
}

export interface GcmPlanningInputV1 {
  planningRequestId: string
  candidates: ProjectionRouteCandidateV1[]
  budget: ProjectionBudgetV1
  selectionPolicy: ProjectionSelectionPolicyV1
  frozenInputRef: FrozenPlanningInputRefV1
}

export interface GcmReplanInputV1 extends GcmPlanningInputV1 {
  replanRequest: ProjectionReplanRequestV1
}

export interface GcmPlanningPort {
  capabilities(): Promise<GcmPlanningCapabilitiesV1>
  plan(input:GcmPlanningInputV1): Promise<GcmPlanSnapshotV1>
  replan(input:GcmReplanInputV1): Promise<GcmPlanSnapshotV1>
  conformanceIdentity(): Promise<GcmConformanceIdentityV1>
}
