import { deepFreeze } from './identity.js'
import type { PlanningFailureV1 } from './types.js'
import { assertPlanningFailure } from './validate.js'

export type PlanningFailureInputV1 = Omit<PlanningFailureV1,'schema'>

export function planningFailure(input:PlanningFailureInputV1):PlanningFailureV1{
  return deepFreeze(assertPlanningFailure({schema:'pncw-planning-failure/v1',...structuredClone(input)}))
}

export class PlanningError extends Error {
  readonly failure: PlanningFailureV1
  constructor(failure:PlanningFailureV1){
    super(failure.message)
    this.name='PlanningError'
    this.failure=deepFreeze(structuredClone(assertPlanningFailure(failure)))
  }
}
