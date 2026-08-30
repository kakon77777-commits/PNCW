import { assertPncwErrorEnvelope } from '../../core/src/index.js'
import type { PncwErrorEnvelopeV1 } from '../../core/src/index.js'
import { PlanningError, planningFailure } from './errors.js'
import {
  assertFrozenPlanningInputRef,
  assertProjectionPlanningReceipt,
  assertProjectionReplanRequest,
} from './validate-derived.js'
import type {
  FrozenPlanningInputRefV1,
  PlanningRecovery,
  ProjectionPlanningReceiptV1,
  ProjectionReplanRequestV1,
} from './types.js'

const REPLAN_CODES=new Set([
  'STALE_SOURCE',
  'VERSION_CONFLICT',
  'SURFACE_UNAVAILABLE',
  'UNSUPPORTED',
])
const RETRY_CODES=new Set([
  'SOURCE_UNAVAILABLE',
  'MATERIALIZATION_FAILED',
])

function reject(message:string):never{
  throw new PlanningError(planningFailure({
    code:'REPLAN_REQUIRED',
    stage:'REPLAN',
    recovery:'NONE',
    source:'pncw',
    message,
  }))
}

function deepFreeze<T>(value:T):T{
  if(!value || typeof value!=='object' || Object.isFrozen(value)) return value
  for(const child of Object.values(value as Record<string,unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

export function projectionFailureRecovery(
  errorInput:PncwErrorEnvelopeV1,
):PlanningRecovery{
  const error=assertPncwErrorEnvelope(errorInput)
  if(REPLAN_CODES.has(error.code)) return 'REPLAN'
  if(RETRY_CODES.has(error.code)) return error.retryable ? 'RETRY' : 'NONE'
  return 'NONE'
}

export interface BuildProjectionReplanRequestInput {
  parentReceipt:ProjectionPlanningReceiptV1
  invalidatedCandidateId:string
  projectionFailure:PncwErrorEnvelopeV1
  newFrozenInputRef:FrozenPlanningInputRefV1
}

export function buildProjectionReplanRequest(
  input:BuildProjectionReplanRequestInput,
):ProjectionReplanRequestV1{
  let parent:ProjectionPlanningReceiptV1
  let frozen:FrozenPlanningInputRefV1
  let failure:PncwErrorEnvelopeV1
  try { parent=assertProjectionPlanningReceipt(input.parentReceipt) }
  catch { return reject('parent planning receipt failed structural or derived-identity validation') }
  try { frozen=assertFrozenPlanningInputRef(input.newFrozenInputRef) }
  catch { return reject('new frozen planning input failed structural or derived-identity validation') }
  try { failure=assertPncwErrorEnvelope(input.projectionFailure) }
  catch { return reject('projection failure envelope is invalid') }

  if(projectionFailureRecovery(failure)!=='REPLAN'){
    reject('projection failure does not authorize deterministic replanning')
  }
  if(input.invalidatedCandidateId!==parent.selectedCandidateId){
    reject('replan invalidated candidate does not match the parent selected candidate')
  }
  if(frozen.frozenInputDigest===parent.frozenInputDigest){
    reject('replan requires a fresh frozen input identity')
  }

  let request:ProjectionReplanRequestV1
  try {
    request=assertProjectionReplanRequest({
      schema:'pncw-projection-replan-request/v1',
      parentPlanningId:parent.planningId,
      planningRequestId:parent.planningRequestId,
      invalidatedCandidateId:input.invalidatedCandidateId,
      projectionFailure:failure,
      newFrozenInputRef:frozen,
    })
  } catch {
    return reject('projection replan request failed closed contract validation')
  }
  return deepFreeze(request)
}
