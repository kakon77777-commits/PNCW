import { assertCanonicalDecimal, canonicalDecimalIsZero } from './canonical-decimal.js'
import { deepFreeze } from './identity.js'
import { PlanningError, planningFailure } from './errors.js'
import type { ProjectionRouteCandidateV1, ProjectionSelectionPolicyV1 } from './types.js'

function invalidPolicy(message:string):never{
  throw new PlanningError(planningFailure({
    code:'INVALID_POLICY',stage:'REQUEST',recovery:'NONE',source:'pncw',message,
  }))
}

function objectiveSets(candidates:ProjectionRouteCandidateV1[]):Set<string>[] {
  if(candidates.length===0) invalidPolicy('selection policy requires at least one candidate')
  return candidates.map(candidate=>new Set(candidate.objectiveObservations.map(item=>item.objectiveId)))
}

function requireObjectiveEverywhere(objectiveId:string,sets:Set<string>[]):void{
  if(!objectiveId.trim()) invalidPolicy('objective id must be non-empty')
  if(sets.some(set=>!set.has(objectiveId))) invalidPolicy(`objective ${objectiveId} is not available on every candidate`)
}

export function validateSelectionPolicyAgainstCandidateSet(
  policy:ProjectionSelectionPolicyV1,
  candidates:ProjectionRouteCandidateV1[],
):ProjectionSelectionPolicyV1{
  const sets=objectiveSets(candidates)
  if(policy.kind==='LEXICOGRAPHIC'){
    if(policy.objectiveOrder.length===0) invalidPolicy('lexicographic objective order must not be empty')
    const seen=new Set<string>()
    for(const objectiveId of policy.objectiveOrder){
      if(seen.has(objectiveId)) invalidPolicy(`duplicate lexicographic objective ${objectiveId}`)
      seen.add(objectiveId)
      requireObjectiveEverywhere(objectiveId,sets)
    }
    return deepFreeze(structuredClone(policy))
  }
  const entries=Object.entries(policy.weights)
  if(entries.length===0) invalidPolicy('weighted policy requires at least one weight')
  if(!policy.normalizationProfile.trim()) invalidPolicy('weighted policy requires an explicit normalization profile')
  let positive=false
  for(const [objectiveId,raw] of entries){
    requireObjectiveEverywhere(objectiveId,sets)
    let weight:string
    try { weight=assertCanonicalDecimal(raw,{nonNegative:true}) }
    catch { return invalidPolicy(`invalid weight for ${objectiveId}`) }
    if(!canonicalDecimalIsZero(weight)) positive=true
  }
  if(!positive) invalidPolicy('weighted policy total weight must be positive')
  return deepFreeze(structuredClone(policy))
}
