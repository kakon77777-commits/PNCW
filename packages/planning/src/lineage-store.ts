import { PlanningError, planningFailure } from './errors.js'
import { assertProjectionPlanningReceipt } from './validate-derived.js'
import type { ProjectionPlanningReceiptV1 } from './types.js'

type StoredStatus='PLAN_ACCEPTED'|'COMPILED'|'REPLAN_REQUIRED'|'SUPERSEDED'

interface Entry {
  receipt:ProjectionPlanningReceiptV1
  status:StoredStatus
  parentPlanningId?:string
  childPlanningId?:string
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

function frozenReceipt(input:ProjectionPlanningReceiptV1):ProjectionPlanningReceiptV1{
  const receipt=structuredClone(assertProjectionPlanningReceipt(input))
  return Object.freeze(receipt)
}

export class PlanningLineageStore {
  #entries=new Map<string,Entry>()

  registerAccepted(receiptInput:ProjectionPlanningReceiptV1):void{
    const receipt=frozenReceipt(receiptInput)
    if(this.#entries.has(receipt.planningId)) reject('planning receipt is already registered')
    this.#entries.set(receipt.planningId,{receipt,status:'PLAN_ACCEPTED'})
  }

  markCompiled(planningId:string):void{
    const entry=this.#required(planningId)
    if(entry.status!=='PLAN_ACCEPTED') reject('only an accepted planning receipt may become compiled')
    entry.status='COMPILED'
  }

  markReplanRequired(planningId:string):void{
    const entry=this.#required(planningId)
    if(entry.status!=='PLAN_ACCEPTED' && entry.status!=='COMPILED'){
      reject('only accepted or compiled planning may require replan')
    }
    entry.status='REPLAN_REQUIRED'
  }

  registerReplacement(
    parentPlanningId:string,
    childReceiptInput:ProjectionPlanningReceiptV1,
  ):void{
    const parent=this.#required(parentPlanningId)
    if(parent.status!=='REPLAN_REQUIRED') reject('parent planning must be REPLAN_REQUIRED before replacement')
    const child=frozenReceipt(childReceiptInput)
    if(child.planningId===parentPlanningId) reject('planning replacement cannot form a self-cycle')
    if(child.frozenInputDigest===parent.receipt.frozenInputDigest){
      reject('planning replacement must be bound to a fresh frozen input')
    }
    if(this.#entries.has(child.planningId)) reject('replacement planning receipt is already registered')
    this.#entries.set(child.planningId,{
      receipt:child,
      status:'PLAN_ACCEPTED',
      parentPlanningId,
    })
    parent.childPlanningId=child.planningId
  }

  supersedeParent(parentPlanningId:string,childPlanningId:string):void{
    const parent=this.#required(parentPlanningId)
    const child=this.#required(childPlanningId)
    if(parent.status!=='REPLAN_REQUIRED') reject('only REPLAN_REQUIRED parent planning may be superseded')
    if(parent.childPlanningId!==childPlanningId || child.parentPlanningId!==parentPlanningId){
      reject('child planning receipt is not the registered replacement for this parent')
    }
    if(child.status!=='PLAN_ACCEPTED') reject('replacement child must still be an accepted planning receipt')
    parent.status='SUPERSEDED'
  }

  status(planningId:string):StoredStatus{
    return this.#required(planningId).status
  }

  #required(planningId:string):Entry{
    const entry=this.#entries.get(planningId)
    if(!entry) reject('planning lineage entry does not exist')
    return entry
  }
}
