import type {
  GcmPlanSnapshotV1,
  ProjectionRouteCandidateV1,
} from './types.js'

export type CandidatePayloadV1 = Omit<ProjectionRouteCandidateV1, 'candidateId'>
export type GcmPlanSnapshotPayloadV1 = Omit<GcmPlanSnapshotV1, 'planSnapshotDigest'>

export function normalizeCandidatePayload(input: CandidatePayloadV1): CandidatePayloadV1 {
  const candidate=structuredClone(input)
  candidate.demandProfile.demands.sort((a,b)=>{
    const left=`${a.dimensionId}\u0000${a.unit}`
    const right=`${b.dimensionId}\u0000${b.unit}`
    return left.localeCompare(right)
  })
  for(let i=1;i<candidate.demandProfile.demands.length;i++){
    const previous=candidate.demandProfile.demands[i-1]!
    const current=candidate.demandProfile.demands[i]!
    if(previous.dimensionId===current.dimensionId && previous.unit===current.unit){
      throw new Error(`duplicate demand ${current.dimensionId}/${current.unit}`)
    }
  }
  candidate.objectiveObservations.sort((a,b)=>a.objectiveId.localeCompare(b.objectiveId))
  for(let i=1;i<candidate.objectiveObservations.length;i++){
    const previous=candidate.objectiveObservations[i-1]!
    const current=candidate.objectiveObservations[i]!
    if(previous.objectiveId===current.objectiveId){
      throw new Error(`duplicate objective ${current.objectiveId}`)
    }
  }
  return candidate
}

export function normalizeGcmPlanSnapshotPayload(
  input: GcmPlanSnapshotPayloadV1,
): GcmPlanSnapshotPayloadV1 {
  const plan=structuredClone(input)
  plan.feasibleCandidateIds.sort()
  plan.rejectedCandidates.sort((a,b)=>{
    const candidate=a.candidateId.localeCompare(b.candidateId)
    return candidate || a.reasonCode.localeCompare(b.reasonCode)
  })
  return plan
}
