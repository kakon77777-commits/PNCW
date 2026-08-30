import type { ProjectionRequestV1 } from '../../core/src/index.js'
import type {
  GcmPlanningInputV1,
  GcmPlanningPort,
  GcmReplanInputV1,
} from '../../gcm-adapter-port/src/index.js'
import { compileProjectionRequest } from '../../plan-compiler/src/index.js'
import { acceptGcmPlan } from './plan-acceptance.js'
import { PlanningError, planningFailure } from './errors.js'
import {
  assertProjectionPlanningRequest,
  assertProjectionReplanRequest,
} from './validate-derived.js'
import type {
  GcmPlanSnapshotV1,
  ProjectionPlanningReceiptV1,
  ProjectionPlanningRequestV1,
  ProjectionReplanRequestV1,
  ProjectionRouteCandidateV1,
} from './types.js'

export interface PlannedProjectionV1 {
  plan:GcmPlanSnapshotV1
  receipt:ProjectionPlanningReceiptV1
  projectionRequest:ProjectionRequestV1
}

function reject(message:string):never{
  throw new PlanningError(planningFailure({
    code:'PLAN_INTEGRITY_FAILURE',
    stage:'REPLAN',
    recovery:'NONE',
    source:'pncw',
    message,
  }))
}

function gcmInput(request:ProjectionPlanningRequestV1):GcmPlanningInputV1{
  return {
    planningRequestId:request.planningRequestId,
    candidates:structuredClone(request.candidates),
    budget:structuredClone(request.budget),
    selectionPolicy:structuredClone(request.selectionPolicy),
    frozenInputRef:structuredClone(request.frozenInputRef),
  }
}

function selectedCandidate(
  request:ProjectionPlanningRequestV1,
  receipt:ProjectionPlanningReceiptV1,
):ProjectionRouteCandidateV1{
  const candidate=request.candidates.find(item=>item.candidateId===receipt.selectedCandidateId)
  if(!candidate) reject('accepted planning receipt selected a candidate missing from the planning request')
  return candidate
}

export class GcmGuidedProjectionPlanner {
  readonly #port:GcmPlanningPort

  constructor(port:GcmPlanningPort){ this.#port=port }

  async planToProjectionRequest(requestInput:unknown):Promise<PlannedProjectionV1>{
    const request=assertProjectionPlanningRequest(requestInput)
    const plan=await this.#port.plan(gcmInput(request))
    const receipt=acceptGcmPlan(request,plan)
    const candidate=selectedCandidate(request,receipt)
    const projectionRequest=compileProjectionRequest({
      receipt,
      candidate,
      authorityContext:request.authorityContext,
    })
    return Object.freeze({plan,receipt,projectionRequest})
  }

  async replanToProjectionRequest(
    requestInput:unknown,
    replanRequestInput:unknown,
  ):Promise<PlannedProjectionV1>{
    const request=assertProjectionPlanningRequest(requestInput)
    const replanRequest:ProjectionReplanRequestV1=assertProjectionReplanRequest(replanRequestInput)
    if(replanRequest.newFrozenInputRef.frozenInputDigest!==request.frozenInputRef.frozenInputDigest){
      reject('child planning request is not bound to the replan request fresh frozen input')
    }
    if(replanRequest.planningRequestId===request.planningRequestId){
      reject('child planning request identity must differ from the parent planning request identity')
    }
    const input:GcmReplanInputV1={
      ...gcmInput(request),
      replanRequest:structuredClone(replanRequest),
    }
    const plan=await this.#port.replan(input)
    const receipt=acceptGcmPlan(request,plan)
    const candidate=selectedCandidate(request,receipt)
    const projectionRequest=compileProjectionRequest({
      receipt,
      candidate,
      authorityContext:request.authorityContext,
    })
    return Object.freeze({plan,receipt,projectionRequest})
  }
}
