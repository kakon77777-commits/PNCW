import { FakeGcmPhaseBAdapter } from '../../../adapters/fake-gcm-phase-b/src/index.js'
import { FakeHdsrcSourceAdapter } from '../../../adapters/fake-hdsrc/src/index.js'
import { FakeMrmicSurfaceAdapter } from '../../../adapters/fake-mrmic/src/index.js'
import { buildProjectionManifest } from '../../../packages/core/src/index.js'
import {
  GcmGuidedProjectionPlanner,
  buildFrozenPlanningInputRef,
  buildProjectionBudget,
  buildProjectionPlanningRequest,
  buildProjectionRouteCandidate,
  deriveBudgetDigest,
  deriveCandidateSetDigest,
  derivePolicyDigest,
} from '../../../packages/planning/src/index.js'
import { ProjectionReadinessGate } from '../../../packages/readiness/src/index.js'
import { ProjectionVerifier } from '../../../packages/verification/src/index.js'
import { VisibilityCommitStore, residentFraction } from '../../../packages/visibility/src/index.js'

const D1=`sha256:${'1'.repeat(64)}`
const D2=`sha256:${'2'.repeat(64)}`

export interface FakeGcmGuidedEvidenceV02 {
  schema:'pncw-fake-gcm-guided-evidence/v0.2'
  planningRequestId:string
  selectedCandidateId:string
  selectedPlanningClass:string
  gcmPlanDigest:string
  planningId:string
  compiledRequestId:string
  resultId:string
  manifestDigest:string
  verificationDigest:string
  visibilityCommitId:string
  visibilityState:'VISIBLE'
  visibilityEvents:number
  residentFraction:number
  partialBytesRead:number
  totalCarrierBytes:number
}

function planningRequest(){
  const candidateA=buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/state:demo-4096',
    observer:{observerId:'observer:gcm-guided',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:block-row-0',regionRefs:['relation:block-row:0']},requestedMode:'machine_carrier',planningClass:'machine-row',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'1272'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.2'}}],
  })
  const candidateB=buildProjectionRouteCandidate({
    schema:'pncw-projection-route-candidate/v1',sourceRef:'hdsrc://state/state:demo-4096',
    observer:{observerId:'observer:gcm-guided',observerType:'ai',profile:'machine'},
    representation:{profile:'HMBT1',protocolVersion:'pncw/0.1'},
    scope:{scopeId:'scope:block-row-1',regionRefs:['relation:block-row:1']},requestedMode:'structured_manifest',planningClass:'manifest-row',
    demandProfile:{demands:[{dimensionId:'bytes',unit:'byte',estimate:{kind:'KNOWN',value:'2048'}}]},
    objectiveObservations:[{objectiveId:'latency',direction:'MINIMIZE',unit:'ratio',observation:{kind:'KNOWN',value:'0.6'}}],
  })
  const candidates=[candidateA,candidateB]
  const budget=buildProjectionBudget({schema:'pncw-projection-budget/v1',hardLimits:{bytes:{unit:'byte',maximum:'4096'}}})
  const selectionPolicy={kind:'LEXICOGRAPHIC' as const,objectiveOrder:['latency']}
  const frozenInputRef=buildFrozenPlanningInputRef({
    schema:'pncw-frozen-planning-input/v1',snapshotRef:'gcm:snapshot:fake-guided',snapshotDigest:D1,gcmPlanningAuthorityDigest:D2,
    candidateSetDigest:deriveCandidateSetDigest(candidates),budgetDigest:deriveBudgetDigest(budget),policyDigest:derivePolicyDigest(selectionPolicy),
    provider:'gcm-phase-b',providerContractVersion:'pncw-fake-gcm-phase-b/v1',
  })
  return buildProjectionPlanningRequest({
    schema:'pncw-projection-planning-request/v1',candidates,budget,selectionPolicy,
    authorityContext:{principalId:'principal:gcm-guided',sourceRead:true,surfaceProject:true},frozenInputRef,
  })
}

export async function runFakeGcmGuidedVerticalSlice():Promise<FakeGcmGuidedEvidenceV02>{
  const request=planningRequest()
  const planner=new GcmGuidedProjectionPlanner(new FakeGcmPhaseBAdapter())
  const planned=await planner.planToProjectionRequest(request)
  const selected=request.candidates.find(candidate=>candidate.candidateId===planned.receipt.selectedCandidateId)
  if(!selected) throw new Error('fake GCM selected candidate missing from request')

  const hdsrc=new FakeHdsrcSourceAdapter()
  const mrmic=new FakeMrmicSurfaceAdapter()
  const projectionRequest=planned.projectionRequest
  const readiness=await new ProjectionReadinessGate(hdsrc,mrmic).evaluate(projectionRequest)
  if(!readiness.result.ready) throw new Error('fake GCM-guided readiness unexpectedly failed')
  const prepared=await mrmic.prepareSurface(projectionRequest,projectionRequest.authorityContext)
  const surface=await mrmic.bindProjection(prepared,readiness.source,readiness.materialization,projectionRequest.authorityContext)
  const regionRef=projectionRequest.scope.regionRefs[0]
  if(!regionRef) throw new Error('selected projection has no region')
  const manifest=buildProjectionManifest({
    request:projectionRequest,source:readiness.source,materialization:readiness.materialization,surface,
    authorityRefs:readiness.authorityRefs,structuralIntegrity:readiness.structuralIntegrity,
    residencyMap:[
      {regionRef:'manifest:root',state:'RESIDENT',bytesResident:1,bytesTotal:1},
      {regionRef,state:'AVAILABLE',bytesResident:0,bytesTotal:286313},
    ],version:1,
  })
  const verification=await new ProjectionVerifier(hdsrc,mrmic).verify(projectionRequest,manifest)
  if(!verification.verified) throw new Error(`fake GCM-guided verification unexpectedly failed: ${verification.failure?.code ?? 'unknown'}`)
  const store=new VisibilityCommitStore()
  const visibility=store.commit({lifecycleState:'VERIFIED',manifest,verification,revealMode:'ATOMIC_ARTIFACT'})
  const region=await hdsrc.readSelectedRegion(readiness.materialization,regionRef,projectionRequest.authorityContext)

  return {
    schema:'pncw-fake-gcm-guided-evidence/v0.2',
    planningRequestId:request.planningRequestId,
    selectedCandidateId:selected.candidateId,
    selectedPlanningClass:selected.planningClass,
    gcmPlanDigest:planned.plan.planSnapshotDigest,
    planningId:planned.receipt.planningId,
    compiledRequestId:projectionRequest.requestId,
    resultId:manifest.resultId,
    manifestDigest:manifest.manifestDigest,
    verificationDigest:verification.verificationDigest,
    visibilityCommitId:visibility.visibilityCommitId,
    visibilityState:visibility.state,
    visibilityEvents:store.eventCount,
    residentFraction:residentFraction(store.getVisible(manifest.resultId)),
    partialBytesRead:region.bytesRead,
    totalCarrierBytes:region.totalCarrierBytes,
  }
}
