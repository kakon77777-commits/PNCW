import { PlanningError, planningFailure } from './errors.js'
import type { PlanningLifecycleState } from './types.js'

const STATES=new Set<PlanningLifecycleState>([
  'PLANNING_REQUESTED','INPUTS_FROZEN','GCM_PLANNED','PLAN_ACCEPTED','COMPILED',
  'PLAN_REJECTED','REPLAN_REQUIRED','SUPERSEDED','ABORTED',
])
const NORMAL=new Map<PlanningLifecycleState,PlanningLifecycleState>([
  ['PLANNING_REQUESTED','INPUTS_FROZEN'],
  ['INPUTS_FROZEN','GCM_PLANNED'],
  ['GCM_PLANNED','PLAN_ACCEPTED'],
  ['PLAN_ACCEPTED','COMPILED'],
])
const ACTIVE=new Set<PlanningLifecycleState>([
  'PLANNING_REQUESTED','INPUTS_FROZEN','GCM_PLANNED','PLAN_ACCEPTED','COMPILED',
])
const REPLAN_SOURCES=new Set<PlanningLifecycleState>(['GCM_PLANNED','PLAN_ACCEPTED','COMPILED'])

export function assertPlanningTransition(
  from:PlanningLifecycleState,
  to:string,
):PlanningLifecycleState{
  if(!STATES.has(from) || !STATES.has(to as PlanningLifecycleState)){
    throw new PlanningError(planningFailure({code:'INVALID_PLANNING_REQUEST',stage:'REQUEST',recovery:'NONE',source:'pncw',message:`unsupported planning lifecycle transition ${from} -> ${to}`}))
  }
  const target=to as PlanningLifecycleState
  if(NORMAL.get(from)===target) return target
  if(ACTIVE.has(from) && (target==='PLAN_REJECTED'||target==='ABORTED')) return target
  if(REPLAN_SOURCES.has(from) && target==='REPLAN_REQUIRED') return target
  if(from==='REPLAN_REQUIRED' && target==='SUPERSEDED') return target
  throw new PlanningError(planningFailure({code:'INVALID_PLANNING_REQUEST',stage:'REQUEST',recovery:'NONE',source:'pncw',message:`illegal planning lifecycle transition ${from} -> ${target}`}))
}
