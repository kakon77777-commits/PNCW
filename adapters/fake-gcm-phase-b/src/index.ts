import type {
  GcmPlanningCapabilitiesV1,
  GcmPlanningInputV1,
  GcmPlanningPort,
  GcmReplanInputV1,
} from '../../../packages/gcm-adapter-port/src/index.js'
import {
  assertFrozenPlanningInputRef,
  assertProjectionBudget,
  assertProjectionReplanRequest,
  assertProjectionRouteCandidate,
  buildGcmPlanSnapshot,
  candidateFeasibilityFailures,
  candidateSemanticDigest,
  compareCanonicalDecimal,
  deriveBudgetDigest,
  deriveCandidateSetDigest,
  derivePolicyDigest,
  parseCanonicalDecimal,
  PlanningError,
  planningFailure,
  validateSelectionPolicyAgainstCandidateSet,
  type CanonicalDecimalV1,
  type GcmConformanceIdentityV1,
  type GcmPlanSnapshotV1,
  type ProjectionObjectiveObservationV1,
  type ProjectionRouteCandidateV1,
} from '../../../packages/planning/src/index.js'
import { sha256Digest } from '../../../packages/core/src/index.js'

interface Rational { numerator: bigint; denominator: bigint }
type KnownObjective = ProjectionObjectiveObservationV1 & {
  observation: { kind:'KNOWN'; value:CanonicalDecimalV1 }
}

function gcd(a:bigint,b:bigint):bigint{
  let x=a<0n?-a:a
  let y=b<0n?-b:b
  while(y!==0n){ const r=x%y; x=y; y=r }
  return x===0n?1n:x
}
function rational(numerator:bigint,denominator:bigint):Rational{
  if(denominator===0n) throw new Error('zero rational denominator')
  const sign=denominator<0n?-1n:1n
  const n=numerator*sign
  const d=denominator*sign
  const factor=gcd(n,d)
  return {numerator:n/factor,denominator:d/factor}
}
function decimalRational(value:CanonicalDecimalV1):Rational{
  const parts=parseCanonicalDecimal(value)
  return rational(BigInt(parts.sign)*parts.coefficient,10n**BigInt(parts.scale))
}
function add(a:Rational,b:Rational):Rational{
  return rational(a.numerator*b.denominator+b.numerator*a.denominator,a.denominator*b.denominator)
}
function subtract(a:Rational,b:Rational):Rational{
  return rational(a.numerator*b.denominator-b.numerator*a.denominator,a.denominator*b.denominator)
}
function multiply(a:Rational,b:Rational):Rational{
  return rational(a.numerator*b.numerator,a.denominator*b.denominator)
}
function divide(a:Rational,b:Rational):Rational{
  return rational(a.numerator*b.denominator,a.denominator*b.numerator)
}
function compareRational(a:Rational,b:Rational):-1|0|1{
  const left=a.numerator*b.denominator
  const right=b.numerator*a.denominator
  return left<right?-1:left>right?1:0
}

function failure(code:'NO_FEASIBLE_PLAN'|'POLICY_INDETERMINATE'|'FROZEN_INPUT_MISMATCH'|'CANDIDATE_SET_MISMATCH',message:string):never{
  throw new PlanningError(planningFailure({
    code,stage:'GCM',recovery:code==='FROZEN_INPUT_MISMATCH'||code==='CANDIDATE_SET_MISMATCH'?'REPLAN':'NONE',source:'gcm-phase-b',message,
  }))
}
function expectedPlanningRequestId(frozenInputDigest:string):string{
  const digest=sha256Digest({schema:'pncw-projection-planning-request/v1',frozenInputDigest})
  return `pncw:plan-request:${digest.slice('sha256:'.length)}`
}
function validateInput(input:GcmPlanningInputV1):{
  candidates:ProjectionRouteCandidateV1[]
  feasible:ProjectionRouteCandidateV1[]
  rejected:{candidateId:string;reasonCode:string}[]
}{
  const candidates=input.candidates.map(candidate=>assertProjectionRouteCandidate(candidate))
  const budget=assertProjectionBudget(input.budget)
  const frozen=assertFrozenPlanningInputRef(input.frozenInputRef)
  validateSelectionPolicyAgainstCandidateSet(input.selectionPolicy,candidates)
  if(input.planningRequestId!==expectedPlanningRequestId(frozen.frozenInputDigest)) return failure('FROZEN_INPUT_MISMATCH','planning request id does not match frozen planning input')
  if(frozen.candidateSetDigest!==deriveCandidateSetDigest(candidates)) return failure('CANDIDATE_SET_MISMATCH','candidate set digest does not match frozen planning input')
  if(frozen.budgetDigest!==deriveBudgetDigest(budget)||frozen.policyDigest!==derivePolicyDigest(input.selectionPolicy)) return failure('FROZEN_INPUT_MISMATCH','budget or policy digest does not match frozen planning input')
  const feasible:ProjectionRouteCandidateV1[]=[]
  const rejected:{candidateId:string;reasonCode:string}[]=[]
  for(const candidate of [...candidates].sort((a,b)=>a.candidateId.localeCompare(b.candidateId))){
    const failures=candidateFeasibilityFailures(candidate,budget)
    if(failures.length===0) feasible.push(candidate)
    else rejected.push({candidateId:candidate.candidateId,reasonCode:failures[0]!.code})
  }
  if(feasible.length===0) return failure('NO_FEASIBLE_PLAN','no projection route satisfies the hard budget')
  return {candidates,feasible,rejected}
}
function observation(candidate:ProjectionRouteCandidateV1,objectiveId:string):KnownObjective{
  const found=candidate.objectiveObservations.find(item=>item.objectiveId===objectiveId)
  if(!found||found.observation.kind!=='KNOWN') return failure('POLICY_INDETERMINATE',`fake GCM requires KNOWN objective ${objectiveId}`)
  return found as KnownObjective
}
function selectLexicographic(candidates:ProjectionRouteCandidateV1[],objectiveOrder:string[]):ProjectionRouteCandidateV1{
  const ordered=[...candidates].sort((a,b)=>a.candidateId.localeCompare(b.candidateId))
  return ordered.reduce((best,current)=>{
    for(const objectiveId of objectiveOrder){
      const left=observation(best,objectiveId)
      const right=observation(current,objectiveId)
      if(left.direction!==right.direction||left.unit!==right.unit) return failure('POLICY_INDETERMINATE',`objective ${objectiveId} has incompatible direction or unit`)
      const cmp=compareCanonicalDecimal(left.observation.value,right.observation.value)
      if(cmp===0) continue
      if(left.direction==='MINIMIZE') return cmp<0?best:current
      return cmp>0?best:current
    }
    return best.candidateId.localeCompare(current.candidateId)<=0?best:current
  })
}
function normalizedObjective(item:KnownObjective):Rational{
  if(compareCanonicalDecimal(item.observation.value,'0')<0||compareCanonicalDecimal(item.observation.value,'1')>0) return failure('POLICY_INDETERMINATE',`objective ${item.objectiveId} is outside unit interval`)
  const value=decimalRational(item.observation.value)
  return item.direction==='MINIMIZE'?subtract(rational(1n,1n),value):value
}
function weightedScore(candidate:ProjectionRouteCandidateV1,weights:Record<string,CanonicalDecimalV1>):Rational{
  let totalWeight=rational(0n,1n)
  const entries=Object.entries(weights).sort(([a],[b])=>a.localeCompare(b))
  for(const [,weight] of entries) totalWeight=add(totalWeight,decimalRational(weight))
  if(totalWeight.numerator<=0n) return failure('POLICY_INDETERMINATE','weighted policy has non-positive total weight')
  let score=rational(0n,1n)
  for(const [objectiveId,weight] of entries){
    const normalizedWeight=divide(decimalRational(weight),totalWeight)
    score=add(score,multiply(normalizedWeight,normalizedObjective(observation(candidate,objectiveId))))
  }
  return score
}
function selectWeighted(candidates:ProjectionRouteCandidateV1[],weights:Record<string,CanonicalDecimalV1>,profile:string):ProjectionRouteCandidateV1{
  if(profile!=='pncw:unit-interval/v1') return failure('POLICY_INDETERMINATE',`unsupported fake normalization profile ${profile}`)
  const ordered=[...candidates].sort((a,b)=>a.candidateId.localeCompare(b.candidateId))
  return ordered.reduce((best,current)=>{
    const cmp=compareRational(weightedScore(best,weights),weightedScore(current,weights))
    if(cmp===0) return best.candidateId.localeCompare(current.candidateId)<=0?best:current
    return cmp>0?best:current
  })
}

const CONFORMANCE:GcmConformanceIdentityV1={
  profileId:'PNCW-FAKE-GCM-R0-M4',claim:'CONFORMANT',
  profileDigest:sha256Digest({profile:'PNCW-FAKE-GCM-R0-M4',version:'1'}),
  packageName:'@pncw/fake-gcm-phase-b',packageVersion:'0.2.0',allocatorContractVersion:'pncw-fake-gcm-phase-b/v1',
}

export class FakeGcmPhaseBAdapter implements GcmPlanningPort {
  async capabilities():Promise<GcmPlanningCapabilitiesV1>{
    return {provider:'gcm-phase-b',adapterVersion:'0.2.0',providerContractVersions:['pncw-fake-gcm-phase-b/v1'],conformanceProfiles:['PNCW-FAKE-GCM-R0-M4'],supportsReplan:true,policyKinds:['LEXICOGRAPHIC','WEIGHTED'],normalizationProfiles:['pncw:unit-interval/v1']}
  }
  async conformanceIdentity():Promise<GcmConformanceIdentityV1>{ return structuredClone(CONFORMANCE) }
  async plan(input:GcmPlanningInputV1):Promise<GcmPlanSnapshotV1>{
    const {feasible,rejected}=validateInput(input)
    const selected=input.selectionPolicy.kind==='LEXICOGRAPHIC'
      ?selectLexicographic(feasible,input.selectionPolicy.objectiveOrder)
      :selectWeighted(feasible,input.selectionPolicy.weights,input.selectionPolicy.normalizationProfile)
    const feasibleCandidateIds=feasible.map(candidate=>candidate.candidateId).sort()
    const allocationPlanDigest=sha256Digest({provider:'fake-gcm-phase-b',planningRequestId:input.planningRequestId,feasibleCandidateIds,selectedCandidateId:selected.candidateId})
    const policySelectionDigest=sha256Digest({policy:input.selectionPolicy,selectedCandidateId:selected.candidateId})
    return buildGcmPlanSnapshot({schema:'pncw-gcm-plan-snapshot/v1',planningRequestId:input.planningRequestId,candidateSetDigest:input.frozenInputRef.candidateSetDigest,budgetDigest:input.frozenInputRef.budgetDigest,policyDigest:input.frozenInputRef.policyDigest,frozenInputDigest:input.frozenInputRef.frozenInputDigest,selectedCandidateId:selected.candidateId,selectedCandidateDigest:candidateSemanticDigest(selected),feasibleCandidateIds,rejectedCandidates:rejected,allocationPlanRef:`fake:gcm-plan:${allocationPlanDigest.slice('sha256:'.length)}`,allocationPlanDigest,policySelectionRef:`fake:gcm-selection:${policySelectionDigest.slice('sha256:'.length)}`,policySelectionDigest,allocatorContractVersion:'pncw-fake-gcm-phase-b/v1',conformance:structuredClone(CONFORMANCE)})
  }
  async replan(input:GcmReplanInputV1):Promise<GcmPlanSnapshotV1>{
    const replan=assertProjectionReplanRequest(input.replanRequest)
    if(replan.newFrozenInputRef.frozenInputDigest!==input.frozenInputRef.frozenInputDigest) return failure('FROZEN_INPUT_MISMATCH','replan input is not bound to the new frozen snapshot')
    const planned=await this.plan(input)
    const {planSnapshotDigest:_ignored,...payload}=planned
    const lineageDigest=sha256Digest({parentPlanningId:replan.parentPlanningId,newFrozenInputDigest:input.frozenInputRef.frozenInputDigest})
    return buildGcmPlanSnapshot({...payload,replanLineageRef:`pncw:fake-replan:${lineageDigest.slice('sha256:'.length)}`})
  }
}
