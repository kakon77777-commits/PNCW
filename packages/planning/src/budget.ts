import {
  assertCanonicalDecimal,
  compareCanonicalDecimal,
} from './canonical-decimal.js'
import { PlanningError, planningFailure } from './errors.js'
import type {
  CanonicalDecimalV1,
  ProjectionBudgetV1,
  ProjectionDemandEstimateV1,
  ProjectionRouteCandidateV1,
} from './types.js'

export type PlanningFeasibilityReason =
  | 'MISSING_REQUIRED_ESTIMATE'
  | 'ESTIMATE_NOT_HARD_SAFE'
  | 'UNSUPPORTED_DIMENSION'
  | 'UNIT_MISMATCH'
  | 'BUDGET_EXCEEDED'
  | 'INVALID_BOUNDS'

export interface PlanningFeasibilityFailureV1 {
  dimensionId: string
  code: PlanningFeasibilityReason
  detail: string
}

function invalidDemand(reason:PlanningFeasibilityReason,message:string):never{
  throw new PlanningError(planningFailure({
    code:'INVALID_CANDIDATE',stage:'REQUEST',recovery:'NONE',source:'pncw',message,evidenceRef:reason,
  }))
}

export function hardDemandForEstimate(
  estimate:ProjectionDemandEstimateV1,
):CanonicalDecimalV1{
  switch(estimate.kind){
    case 'KNOWN':
      return assertCanonicalDecimal(estimate.value,{nonNegative:true})
    case 'BOUNDED':{
      const lower=assertCanonicalDecimal(estimate.lower,{nonNegative:true})
      const upper=assertCanonicalDecimal(estimate.upper,{nonNegative:true})
      if(compareCanonicalDecimal(lower,upper)>0){
        return invalidDemand('INVALID_BOUNDS','bounded hard demand lower exceeds upper')
      }
      return upper
    }
    case 'ESTIMATED':
      if(!estimate.hardSafe) return invalidDemand('ESTIMATE_NOT_HARD_SAFE','estimated hard demand is not marked hard-safe')
      return assertCanonicalDecimal(estimate.value,{nonNegative:true})
    case 'UNKNOWN':
      return invalidDemand('MISSING_REQUIRED_ESTIMATE','required hard demand is unknown')
  }
}

export function candidateFeasibilityFailures(
  candidate:ProjectionRouteCandidateV1,
  budget:ProjectionBudgetV1,
):PlanningFeasibilityFailureV1[]{
  const failures:PlanningFeasibilityFailureV1[]=[]
  for(const demand of candidate.demandProfile.demands){
    const limit=budget.hardLimits[demand.dimensionId]
    if(!limit){
      failures.push({dimensionId:demand.dimensionId,code:'UNSUPPORTED_DIMENSION',detail:'budget has no hard limit for demanded dimension'})
      continue
    }
    if(limit.unit!==demand.unit){
      failures.push({dimensionId:demand.dimensionId,code:'UNIT_MISMATCH',detail:`demand unit ${demand.unit} != budget unit ${limit.unit}`})
      continue
    }
    if(demand.estimate.kind==='UNKNOWN'){
      failures.push({dimensionId:demand.dimensionId,code:'MISSING_REQUIRED_ESTIMATE',detail:'required hard demand is unknown'})
      continue
    }
    if(demand.estimate.kind==='ESTIMATED' && !demand.estimate.hardSafe){
      failures.push({dimensionId:demand.dimensionId,code:'ESTIMATE_NOT_HARD_SAFE',detail:'estimated hard demand is not marked hard-safe'})
      continue
    }
    if(demand.estimate.kind==='BOUNDED' && compareCanonicalDecimal(demand.estimate.lower,demand.estimate.upper)>0){
      failures.push({dimensionId:demand.dimensionId,code:'INVALID_BOUNDS',detail:'bounded hard demand lower exceeds upper'})
      continue
    }
    const effective=hardDemandForEstimate(demand.estimate)
    if(compareCanonicalDecimal(effective,limit.maximum)>0){
      failures.push({dimensionId:demand.dimensionId,code:'BUDGET_EXCEEDED',detail:`hard demand ${effective} exceeds maximum ${limit.maximum}`})
    }
  }
  return failures.sort((a,b)=>a.dimensionId.localeCompare(b.dimensionId)||a.code.localeCompare(b.code))
}
