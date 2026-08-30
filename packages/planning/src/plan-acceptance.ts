import {
  assertGcmPlanSnapshot,
  assertProjectionPlanningRequest,
} from './validate-derived.js'
import {
  buildProjectionPlanningReceipt,
  candidateSemanticDigest,
  deriveConformanceDigest,
} from './identity.js'
import { PlanningError, planningFailure } from './errors.js'
import type {
  GcmPlanSnapshotV1,
  PlanningFailureCode,
  ProjectionPlanningReceiptV1,
  ProjectionPlanningRequestV1,
  ProjectionRouteCandidateV1,
} from './types.js'

export const PNCW_PLAN_COMPILER_CONTRACT_VERSION='pncw-plan-compiler/v1'

const FORBIDDEN_KEYS=new Set([
  'authoritycontext',
  'sourceread',
  'surfaceproject',
  'commitauthority',
  'writercapability',
  'credential',
  'apikey',
  'privatetoken',
  'secret',
])

function normalizedKey(key:string):string{
  return key.toLowerCase().replace(/[^a-z0-9]/g,'')
}

function scanForbiddenKeys(value:unknown,path='plan'):string|undefined{
  if(Array.isArray(value)){
    for(let i=0;i<value.length;i++){
      const found=scanForbiddenKeys(value[i],`${path}[${i}]`)
      if(found) return found
    }
    return undefined
  }
  if(!value || typeof value!=='object') return undefined
  for(const [key,child] of Object.entries(value as Record<string,unknown>)){
    if(FORBIDDEN_KEYS.has(normalizedKey(key))) return `${path}.${key}`
    const found=scanForbiddenKeys(child,`${path}.${key}`)
    if(found) return found
  }
  return undefined
}

function reject(
  code:PlanningFailureCode,
  message:string,
):never{
  throw new PlanningError(planningFailure({
    code,
    stage:'PLAN_ACCEPTANCE',
    recovery:'NONE',
    source:'pncw',
    message,
  }))
}

function assertRequestForAcceptance(value:unknown):ProjectionPlanningRequestV1{
  try { return assertProjectionPlanningRequest(value) }
  catch { return reject('INVALID_PLANNING_REQUEST','planning request failed structural or identity validation') }
}

function assertPlanForAcceptance(value:unknown):GcmPlanSnapshotV1{
  const forbidden=scanForbiddenKeys(value)
  if(forbidden) return reject('PLAN_INTEGRITY_FAILURE',`GCM plan contains forbidden authority or credential field at ${forbidden}`)
  try { return assertGcmPlanSnapshot(value) }
  catch { return reject('PLAN_INTEGRITY_FAILURE','GCM plan failed closed structural or plan-digest validation') }
}

function candidateMap(request:ProjectionPlanningRequestV1):Map<string,ProjectionRouteCandidateV1>{
  return new Map(request.candidates.map(candidate=>[candidate.candidateId,candidate]))
}

function assertCandidateReferences(plan:GcmPlanSnapshotV1,original:Map<string,ProjectionRouteCandidateV1>):void{
  const feasible=new Set<string>()
  for(const candidateId of plan.feasibleCandidateIds){
    if(!original.has(candidateId)) reject('PLAN_INTEGRITY_FAILURE','GCM feasible set references a candidate outside the frozen request set')
    if(feasible.has(candidateId)) reject('PLAN_INTEGRITY_FAILURE','GCM feasible set contains a duplicate candidate')
    feasible.add(candidateId)
  }
  const rejected=new Set<string>()
  for(const item of plan.rejectedCandidates){
    if(!original.has(item.candidateId)) reject('PLAN_INTEGRITY_FAILURE','GCM rejected set references a candidate outside the frozen request set')
    if(rejected.has(item.candidateId)) reject('PLAN_INTEGRITY_FAILURE','GCM rejected set contains a duplicate candidate')
    if(feasible.has(item.candidateId)) reject('PLAN_INTEGRITY_FAILURE','GCM candidate appears in both feasible and rejected sets')
    rejected.add(item.candidateId)
  }
}

export function acceptGcmPlan(
  requestInput:unknown,
  planInput:unknown,
):ProjectionPlanningReceiptV1{
  const request=assertRequestForAcceptance(requestInput)
  const plan=assertPlanForAcceptance(planInput)

  if(plan.planningRequestId!==request.planningRequestId){
    reject('FROZEN_INPUT_MISMATCH','GCM plan is bound to a different planning request')
  }
  if(plan.candidateSetDigest!==request.frozenInputRef.candidateSetDigest){
    reject('CANDIDATE_SET_MISMATCH','GCM plan candidate-set digest does not match frozen planning input')
  }
  if(plan.budgetDigest!==request.frozenInputRef.budgetDigest){
    reject('FROZEN_INPUT_MISMATCH','GCM plan budget digest does not match frozen planning input')
  }
  if(plan.policyDigest!==request.frozenInputRef.policyDigest){
    reject('FROZEN_INPUT_MISMATCH','GCM plan policy digest does not match frozen planning input')
  }
  if(plan.frozenInputDigest!==request.frozenInputRef.frozenInputDigest){
    reject('FROZEN_INPUT_MISMATCH','GCM plan frozen-input digest does not match planning request')
  }
  if(plan.allocatorContractVersion!==request.frozenInputRef.providerContractVersion){
    reject('PLAN_INTEGRITY_FAILURE','GCM allocator contract version does not match frozen provider contract')
  }

  if(plan.conformance.claim!=='CONFORMANT'){
    reject(
      'GCM_NONCONFORMANT',
      plan.conformance.claim==='INDETERMINATE'
        ? 'GCM allocator conformance is indeterminate'
        : 'GCM allocator is nonconformant',
    )
  }

  const original=candidateMap(request)
  const selected=original.get(plan.selectedCandidateId)
  if(!selected){
    reject('SELECTED_CANDIDATE_INVALID','GCM selected a candidate outside the frozen request set')
  }
  if(!plan.feasibleCandidateIds.includes(plan.selectedCandidateId)){
    reject('SELECTED_CANDIDATE_INVALID','GCM selected candidate is not in the feasible set')
  }
  if(plan.selectedCandidateDigest!==candidateSemanticDigest(selected)){
    reject('SELECTED_CANDIDATE_INVALID','GCM selected-candidate digest does not match frozen candidate semantics')
  }
  assertCandidateReferences(plan,original)

  if(!plan.allocationPlanRef.trim() || !plan.allocationPlanDigest.startsWith('sha256:')){
    reject('PLAN_INTEGRITY_FAILURE','GCM allocation-plan evidence is missing')
  }
  if(!plan.policySelectionRef?.trim() || !plan.policySelectionDigest?.startsWith('sha256:')){
    reject('PLAN_INTEGRITY_FAILURE','GCM policy-selection evidence is missing for explicit policy')
  }

  return buildProjectionPlanningReceipt({
    schema:'pncw-projection-planning-receipt/v1',
    planningRequestId:request.planningRequestId,
    selectedCandidateId:selected.candidateId,
    selectedCandidateDigest:candidateSemanticDigest(selected),
    gcmPlanDigest:plan.planSnapshotDigest,
    frozenInputDigest:request.frozenInputRef.frozenInputDigest,
    conformanceDigest:deriveConformanceDigest(plan.conformance),
    compilerContractVersion:PNCW_PLAN_COMPILER_CONTRACT_VERSION,
  })
}
