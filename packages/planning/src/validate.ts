import {
  assertAuthorityContext,
  assertObserver,
  assertPncwErrorEnvelope,
  assertRepresentation,
  assertScope,
} from '../../core/src/index.js'
import { assertCanonicalDecimal } from './canonical-decimal.js'
import type {
  FrozenPlanningInputRefV1,
  GcmConformanceClaim,
  GcmConformanceIdentityV1,
  GcmPlanSnapshotV1,
  PlanningFailureCode,
  PlanningFailureV1,
  PlanningRecovery,
  ProjectionBudgetV1,
  ProjectionDemandEstimateV1,
  ProjectionDemandProfileV1,
  ProjectionDemandV1,
  ProjectionObjectiveObservationKindV1,
  ProjectionObjectiveObservationV1,
  ProjectionPlanningReceiptV1,
  ProjectionPlanningRequestV1,
  ProjectionReplanRequestV1,
  ProjectionRouteCandidateV1,
  ProjectionSelectionPolicyV1,
} from './types.js'

const DIGEST_RE=/^sha256:[0-9a-f]{64}$/
const CANDIDATE_RE=/^pncw:candidate:[0-9a-f]{64}$/
const BUDGET_RE=/^pncw:budget:[0-9a-f]{64}$/
const PLAN_REQUEST_RE=/^pncw:plan-request:[0-9a-f]{64}$/
const PLANNING_RE=/^pncw:planning:[0-9a-f]{64}$/
const OBSERVATION_MODES=new Set(['human_preview','machine_carrier','structured_manifest'])
const FAILURE_CODES=new Set([
  'INVALID_PLANNING_REQUEST','INVALID_CANDIDATE','INVALID_BUDGET','INVALID_POLICY',
  'GCM_UNAVAILABLE','GCM_NONCONFORMANT','NO_FEASIBLE_PLAN','POLICY_INDETERMINATE',
  'FROZEN_INPUT_MISMATCH','CANDIDATE_SET_MISMATCH','SELECTED_CANDIDATE_INVALID',
  'PLAN_INTEGRITY_FAILURE','COMPILER_INTEGRITY_FAILURE','REPLAN_REQUIRED',
])
const FAILURE_STAGES=new Set(['REQUEST','FREEZE','GCM','PLAN_ACCEPTANCE','COMPILATION','REPLAN'])
const RECOVERY=new Set(['NONE','RETRY','REPLAN'])
const CONFORMANCE=new Set(['CONFORMANT','NONCONFORMANT','INDETERMINATE'])

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}
function rec(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  const out=objectValue(value,label)
  for (const key of Object.keys(out)) {
    if (!keys.includes(key)) throw new Error(`${label}.${key} is not allowed`)
  }
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
function intBound(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number)<1 || (value as number)>2147483647) {
    throw new Error(`${label} must be an integer in [1, 2147483647]`)
  }
  return value as number
}
function digest(value: unknown, label: string): string {
  const v=str(value,label)
  if (!DIGEST_RE.test(v)) throw new Error(`${label} must be a sha256 digest`)
  return v
}
function id(value: unknown, label: string, pattern: RegExp): string {
  const v=str(value,label)
  if (!pattern.test(v)) throw new Error(`${label} has invalid identifier syntax`)
  return v
}
function enumString<T extends string>(
  value: unknown, label: string, allowed: Set<string>,
): T {
  const v=str(value,label)
  if (!allowed.has(v)) throw new Error(`${label} has unsupported value ${v}`)
  return v as T
}
function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map((item,index)=>str(item,`${label}[${index}]`))
}
function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length===0) throw new Error(`${label} must be a non-empty array`)
  return value
}

function assertDemandEstimate(value: unknown, label: string): ProjectionDemandEstimateV1 {
  const base=objectValue(value,label)
  const kind=str(base.kind,`${label}.kind`)
  if (kind==='KNOWN') {
    const x=rec(value,label,['kind','value'])
    return {kind:'KNOWN',value:assertCanonicalDecimal(x.value,{nonNegative:true})}
  }
  if (kind==='BOUNDED') {
    const x=rec(value,label,['kind','lower','upper'])
    return {
      kind:'BOUNDED',
      lower:assertCanonicalDecimal(x.lower,{nonNegative:true}),
      upper:assertCanonicalDecimal(x.upper,{nonNegative:true}),
    }
  }
  if (kind==='ESTIMATED') {
    const x=rec(value,label,['kind','value','hardSafe','provenance'])
    return {
      kind:'ESTIMATED',
      value:assertCanonicalDecimal(x.value,{nonNegative:true}),
      hardSafe:bool(x.hardSafe,`${label}.hardSafe`),
      provenance:str(x.provenance,`${label}.provenance`),
    }
  }
  if (kind==='UNKNOWN') {
    rec(value,label,['kind'])
    return {kind:'UNKNOWN'}
  }
  throw new Error(`${label}.kind has unsupported value ${kind}`)
}
function assertDemand(value: unknown, label: string): ProjectionDemandV1 {
  const x=rec(value,label,['dimensionId','unit','estimate'])
  return {
    dimensionId:str(x.dimensionId,`${label}.dimensionId`),
    unit:str(x.unit,`${label}.unit`),
    estimate:assertDemandEstimate(x.estimate,`${label}.estimate`),
  }
}
function assertDemandProfile(value: unknown, label: string): ProjectionDemandProfileV1 {
  const x=rec(value,label,['demands'])
  return {demands:requiredArray(x.demands,`${label}.demands`).map((v,i)=>assertDemand(v,`${label}.demands[${i}]`))}
}
function assertObjectiveObservationKind(
  value: unknown, label: string,
): ProjectionObjectiveObservationKindV1 {
  const base=objectValue(value,label)
  const kind=str(base.kind,`${label}.kind`)
  if (kind==='KNOWN') {
    const x=rec(value,label,['kind','value'])
    return {kind:'KNOWN',value:assertCanonicalDecimal(x.value)}
  }
  if (kind==='BOUNDED') {
    const x=rec(value,label,['kind','lower','upper'])
    return {kind:'BOUNDED',lower:assertCanonicalDecimal(x.lower),upper:assertCanonicalDecimal(x.upper)}
  }
  if (kind==='ESTIMATED') {
    const x=rec(value,label,['kind','value','provenance'])
    return {kind:'ESTIMATED',value:assertCanonicalDecimal(x.value),provenance:str(x.provenance,`${label}.provenance`)}
  }
  if (kind==='UNKNOWN') {
    rec(value,label,['kind'])
    return {kind:'UNKNOWN'}
  }
  throw new Error(`${label}.kind has unsupported value ${kind}`)
}
function assertObjective(value: unknown, label: string): ProjectionObjectiveObservationV1 {
  const x=rec(value,label,['objectiveId','direction','unit','observation'])
  return {
    objectiveId:str(x.objectiveId,`${label}.objectiveId`),
    direction:enumString<'MINIMIZE'|'MAXIMIZE'>(x.direction,`${label}.direction`,new Set(['MINIMIZE','MAXIMIZE'])),
    unit:str(x.unit,`${label}.unit`),
    observation:assertObjectiveObservationKind(x.observation,`${label}.observation`),
  }
}

export function assertProjectionRouteCandidate(value: unknown): ProjectionRouteCandidateV1 {
  const x=rec(value,'projectionRouteCandidate',[
    'schema','candidateId','sourceRef','observer','representation','scope','requestedMode',
    'planningClass','demandProfile','objectiveObservations',
  ])
  if (x.schema!=='pncw-projection-route-candidate/v1') throw new Error('projectionRouteCandidate.schema is invalid')
  return {
    schema:'pncw-projection-route-candidate/v1',
    candidateId:id(x.candidateId,'projectionRouteCandidate.candidateId',CANDIDATE_RE),
    sourceRef:str(x.sourceRef,'projectionRouteCandidate.sourceRef'),
    observer:assertObserver(x.observer),
    representation:assertRepresentation(x.representation),
    scope:assertScope(x.scope),
    requestedMode:enumString(x.requestedMode,'projectionRouteCandidate.requestedMode',OBSERVATION_MODES),
    planningClass:str(x.planningClass,'projectionRouteCandidate.planningClass'),
    demandProfile:assertDemandProfile(x.demandProfile,'projectionRouteCandidate.demandProfile'),
    objectiveObservations:requiredArray(x.objectiveObservations,'projectionRouteCandidate.objectiveObservations')
      .map((v,i)=>assertObjective(v,`projectionRouteCandidate.objectiveObservations[${i}]`)),
  }
}

export function assertProjectionBudget(value: unknown): ProjectionBudgetV1 {
  const x=rec(value,'projectionBudget',['schema','budgetId','hardLimits','maxCandidates','maxMaterializedRegions'])
  if (x.schema!=='pncw-projection-budget/v1') throw new Error('projectionBudget.schema is invalid')
  const hardLimitsRaw=objectValue(x.hardLimits,'projectionBudget.hardLimits')
  const hardLimits: ProjectionBudgetV1['hardLimits']={}
  const entries=Object.entries(hardLimitsRaw)
  if (entries.length===0) throw new Error('projectionBudget.hardLimits must not be empty')
  for (const [dimensionId,raw] of entries) {
    str(dimensionId,'projectionBudget.hardLimits key')
    const limit=rec(raw,`projectionBudget.hardLimits.${dimensionId}`,['unit','maximum'])
    hardLimits[dimensionId]={
      unit:str(limit.unit,`projectionBudget.hardLimits.${dimensionId}.unit`),
      maximum:assertCanonicalDecimal(limit.maximum,{nonNegative:true}),
    }
  }
  return {
    schema:'pncw-projection-budget/v1',
    budgetId:id(x.budgetId,'projectionBudget.budgetId',BUDGET_RE),
    hardLimits,
    ...(x.maxCandidates===undefined?{}:{maxCandidates:intBound(x.maxCandidates,'projectionBudget.maxCandidates')}),
    ...(x.maxMaterializedRegions===undefined?{}:{maxMaterializedRegions:intBound(x.maxMaterializedRegions,'projectionBudget.maxMaterializedRegions')}),
  }
}

function assertPolicy(value: unknown): ProjectionSelectionPolicyV1 {
  const base=objectValue(value,'selectionPolicy')
  const kind=str(base.kind,'selectionPolicy.kind')
  if (kind==='LEXICOGRAPHIC') {
    const x=rec(value,'selectionPolicy',['kind','objectiveOrder'])
    return {kind:'LEXICOGRAPHIC',objectiveOrder:requiredArray(x.objectiveOrder,'selectionPolicy.objectiveOrder').map((v,i)=>str(v,`selectionPolicy.objectiveOrder[${i}]`))}
  }
  if (kind==='WEIGHTED') {
    const x=rec(value,'selectionPolicy',['kind','weights','normalizationProfile'])
    const weightsRaw=objectValue(x.weights,'selectionPolicy.weights')
    if (Object.keys(weightsRaw).length===0) throw new Error('selectionPolicy.weights must not be empty')
    const weights: Record<string,string>={}
    for (const [objectiveId,weight] of Object.entries(weightsRaw)) {
      str(objectiveId,'selectionPolicy.weights key')
      weights[objectiveId]=assertCanonicalDecimal(weight,{nonNegative:true})
    }
    return {kind:'WEIGHTED',weights,normalizationProfile:str(x.normalizationProfile,'selectionPolicy.normalizationProfile')}
  }
  throw new Error(`selectionPolicy.kind has unsupported value ${kind}`)
}

export function assertFrozenPlanningInputRef(value: unknown): FrozenPlanningInputRefV1 {
  const x=rec(value,'frozenPlanningInput',[
    'schema','snapshotRef','snapshotDigest','gcmPlanningAuthorityDigest','candidateSetDigest',
    'budgetDigest','policyDigest','provider','providerContractVersion','frozenInputDigest',
  ])
  if (x.schema!=='pncw-frozen-planning-input/v1') throw new Error('frozenPlanningInput.schema is invalid')
  if (x.provider!=='gcm-phase-b') throw new Error('frozenPlanningInput.provider is invalid')
  return {
    schema:'pncw-frozen-planning-input/v1',
    snapshotRef:str(x.snapshotRef,'frozenPlanningInput.snapshotRef'),
    snapshotDigest:digest(x.snapshotDigest,'frozenPlanningInput.snapshotDigest'),
    gcmPlanningAuthorityDigest:digest(x.gcmPlanningAuthorityDigest,'frozenPlanningInput.gcmPlanningAuthorityDigest'),
    candidateSetDigest:digest(x.candidateSetDigest,'frozenPlanningInput.candidateSetDigest'),
    budgetDigest:digest(x.budgetDigest,'frozenPlanningInput.budgetDigest'),
    policyDigest:digest(x.policyDigest,'frozenPlanningInput.policyDigest'),
    provider:'gcm-phase-b',
    providerContractVersion:str(x.providerContractVersion,'frozenPlanningInput.providerContractVersion'),
    frozenInputDigest:digest(x.frozenInputDigest,'frozenPlanningInput.frozenInputDigest'),
  }
}

export function assertProjectionPlanningRequest(value: unknown): ProjectionPlanningRequestV1 {
  const x=rec(value,'projectionPlanningRequest',[
    'schema','planningRequestId','candidates','budget','selectionPolicy','authorityContext','frozenInputRef',
  ])
  if (x.schema!=='pncw-projection-planning-request/v1') throw new Error('projectionPlanningRequest.schema is invalid')
  return {
    schema:'pncw-projection-planning-request/v1',
    planningRequestId:id(x.planningRequestId,'projectionPlanningRequest.planningRequestId',PLAN_REQUEST_RE),
    candidates:requiredArray(x.candidates,'projectionPlanningRequest.candidates').map(assertProjectionRouteCandidate),
    budget:assertProjectionBudget(x.budget),
    selectionPolicy:assertPolicy(x.selectionPolicy),
    authorityContext:assertAuthorityContext(x.authorityContext),
    frozenInputRef:assertFrozenPlanningInputRef(x.frozenInputRef),
  }
}

function assertConformance(value: unknown): GcmConformanceIdentityV1 {
  const x=rec(value,'gcmConformance',['profileId','claim','profileDigest','packageName','packageVersion','allocatorContractVersion'])
  return {
    profileId:str(x.profileId,'gcmConformance.profileId'),
    claim:enumString<GcmConformanceClaim>(x.claim,'gcmConformance.claim',CONFORMANCE),
    profileDigest:digest(x.profileDigest,'gcmConformance.profileDigest'),
    packageName:str(x.packageName,'gcmConformance.packageName'),
    packageVersion:str(x.packageVersion,'gcmConformance.packageVersion'),
    allocatorContractVersion:str(x.allocatorContractVersion,'gcmConformance.allocatorContractVersion'),
  }
}

export function assertGcmPlanSnapshot(value: unknown): GcmPlanSnapshotV1 {
  const x=rec(value,'gcmPlanSnapshot',[
    'schema','planningRequestId','candidateSetDigest','budgetDigest','policyDigest','frozenInputDigest',
    'selectedCandidateId','selectedCandidateDigest','feasibleCandidateIds','rejectedCandidates',
    'allocationPlanRef','allocationPlanDigest','policySelectionRef','policySelectionDigest',
    'allocatorContractVersion','conformance','replanLineageRef','planSnapshotDigest',
  ])
  if (x.schema!=='pncw-gcm-plan-snapshot/v1') throw new Error('gcmPlanSnapshot.schema is invalid')
  const rejected=Array.isArray(x.rejectedCandidates)?x.rejectedCandidates.map((v,i)=>{
    const r=rec(v,`gcmPlanSnapshot.rejectedCandidates[${i}]`,['candidateId','reasonCode'])
    return {candidateId:id(r.candidateId,`gcmPlanSnapshot.rejectedCandidates[${i}].candidateId`,CANDIDATE_RE),reasonCode:str(r.reasonCode,`gcmPlanSnapshot.rejectedCandidates[${i}].reasonCode`)}
  }):(()=>{throw new Error('gcmPlanSnapshot.rejectedCandidates must be an array')})()
  return {
    schema:'pncw-gcm-plan-snapshot/v1',
    planningRequestId:id(x.planningRequestId,'gcmPlanSnapshot.planningRequestId',PLAN_REQUEST_RE),
    candidateSetDigest:digest(x.candidateSetDigest,'gcmPlanSnapshot.candidateSetDigest'),
    budgetDigest:digest(x.budgetDigest,'gcmPlanSnapshot.budgetDigest'),
    policyDigest:digest(x.policyDigest,'gcmPlanSnapshot.policyDigest'),
    frozenInputDigest:digest(x.frozenInputDigest,'gcmPlanSnapshot.frozenInputDigest'),
    selectedCandidateId:id(x.selectedCandidateId,'gcmPlanSnapshot.selectedCandidateId',CANDIDATE_RE),
    selectedCandidateDigest:digest(x.selectedCandidateDigest,'gcmPlanSnapshot.selectedCandidateDigest'),
    feasibleCandidateIds:stringArray(x.feasibleCandidateIds,'gcmPlanSnapshot.feasibleCandidateIds').map((v,i)=>id(v,`gcmPlanSnapshot.feasibleCandidateIds[${i}]`,CANDIDATE_RE)),
    rejectedCandidates:rejected,
    allocationPlanRef:str(x.allocationPlanRef,'gcmPlanSnapshot.allocationPlanRef'),
    allocationPlanDigest:digest(x.allocationPlanDigest,'gcmPlanSnapshot.allocationPlanDigest'),
    ...(x.policySelectionRef===undefined?{}:{policySelectionRef:str(x.policySelectionRef,'gcmPlanSnapshot.policySelectionRef')}),
    ...(x.policySelectionDigest===undefined?{}:{policySelectionDigest:digest(x.policySelectionDigest,'gcmPlanSnapshot.policySelectionDigest')}),
    allocatorContractVersion:str(x.allocatorContractVersion,'gcmPlanSnapshot.allocatorContractVersion'),
    conformance:assertConformance(x.conformance),
    ...(x.replanLineageRef===undefined?{}:{replanLineageRef:str(x.replanLineageRef,'gcmPlanSnapshot.replanLineageRef')}),
    planSnapshotDigest:digest(x.planSnapshotDigest,'gcmPlanSnapshot.planSnapshotDigest'),
  }
}

export function assertProjectionPlanningReceipt(value: unknown): ProjectionPlanningReceiptV1 {
  const x=rec(value,'projectionPlanningReceipt',[
    'schema','planningId','planningRequestId','selectedCandidateId','selectedCandidateDigest',
    'gcmPlanDigest','frozenInputDigest','conformanceDigest','compilerContractVersion',
  ])
  if (x.schema!=='pncw-projection-planning-receipt/v1') throw new Error('projectionPlanningReceipt.schema is invalid')
  return {
    schema:'pncw-projection-planning-receipt/v1',
    planningId:id(x.planningId,'projectionPlanningReceipt.planningId',PLANNING_RE),
    planningRequestId:id(x.planningRequestId,'projectionPlanningReceipt.planningRequestId',PLAN_REQUEST_RE),
    selectedCandidateId:id(x.selectedCandidateId,'projectionPlanningReceipt.selectedCandidateId',CANDIDATE_RE),
    selectedCandidateDigest:digest(x.selectedCandidateDigest,'projectionPlanningReceipt.selectedCandidateDigest'),
    gcmPlanDigest:digest(x.gcmPlanDigest,'projectionPlanningReceipt.gcmPlanDigest'),
    frozenInputDigest:digest(x.frozenInputDigest,'projectionPlanningReceipt.frozenInputDigest'),
    conformanceDigest:digest(x.conformanceDigest,'projectionPlanningReceipt.conformanceDigest'),
    compilerContractVersion:str(x.compilerContractVersion,'projectionPlanningReceipt.compilerContractVersion'),
  }
}

export function assertPlanningFailure(value: unknown): PlanningFailureV1 {
  const x=rec(value,'planningFailure',['schema','code','stage','recovery','source','message','evidenceRef'])
  if (x.schema!=='pncw-planning-failure/v1') throw new Error('planningFailure.schema is invalid')
  return {
    schema:'pncw-planning-failure/v1',
    code:enumString<PlanningFailureCode>(x.code,'planningFailure.code',FAILURE_CODES),
    stage:enumString(x.stage,'planningFailure.stage',FAILURE_STAGES),
    recovery:enumString<PlanningRecovery>(x.recovery,'planningFailure.recovery',RECOVERY),
    source:enumString(x.source,'planningFailure.source',new Set(['pncw','gcm-phase-b'])),
    message:str(x.message,'planningFailure.message'),
    ...(x.evidenceRef===undefined?{}:{evidenceRef:str(x.evidenceRef,'planningFailure.evidenceRef')}),
  }
}

export function assertProjectionReplanRequest(value: unknown): ProjectionReplanRequestV1 {
  const x=rec(value,'projectionReplanRequest',[
    'schema','parentPlanningId','planningRequestId','invalidatedCandidateId','projectionFailure','newFrozenInputRef',
  ])
  if (x.schema!=='pncw-projection-replan-request/v1') throw new Error('projectionReplanRequest.schema is invalid')
  return {
    schema:'pncw-projection-replan-request/v1',
    parentPlanningId:id(x.parentPlanningId,'projectionReplanRequest.parentPlanningId',PLANNING_RE),
    planningRequestId:id(x.planningRequestId,'projectionReplanRequest.planningRequestId',PLAN_REQUEST_RE),
    invalidatedCandidateId:id(x.invalidatedCandidateId,'projectionReplanRequest.invalidatedCandidateId',CANDIDATE_RE),
    projectionFailure:assertPncwErrorEnvelope(x.projectionFailure),
    newFrozenInputRef:assertFrozenPlanningInputRef(x.newFrozenInputRef),
  }
}
