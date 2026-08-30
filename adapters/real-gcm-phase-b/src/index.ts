import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
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
  deriveBudgetDigest,
  deriveCandidateSetDigest,
  derivePolicyDigest,
  type GcmConformanceIdentityV1,
  type GcmPlanSnapshotV1,
  type ProjectionRouteCandidateV1,
  PlanningError,
  planningFailure,
  validateSelectionPolicyAgainstCandidateSet,
} from '../../../packages/planning/src/index.js'
import { sha256Digest } from '../../../packages/core/src/index.js'
import { GcmPhaseBProcessClient } from './process-client.js'

export * from './process-client.js'

const ADAPTER_VERSION='0.2.0'
const DEFAULT_HOST_SCRIPT='adapters/real-gcm-phase-b/host/gcm_phase_b_host.py'
const DEFAULT_SUPPORT_PROFILE='docs/evidence/gcm-phase-b-public-api-profile-v0.4.json'

const FORBIDDEN_OUTPUT_KEYS=new Set([
  'authoritycontext','sourceread','surfaceproject','commitauthority',
  'writercapability','credential','apikey','privatetoken','secret',
])

export interface RealGcmPhaseBConfig {
  pythonExecutable: string
  hostScript?: string
  expectedPackageVersion: string
  expectedAllocatorContractVersion: string
  conformanceProfile: 'R0-M4'
  routeProfiles: Record<string,{
    executorId:string
    configurationId:string
    requiredCapabilities:string[]
  }>
  snapshotRegistryPath: string
  publicApiProfilePath?: string
  cwd?: string
  timeoutMs?: number
}

export interface AcceptedGcmPublicApiSnapshotV1 {
  accepted:true
  packageName:string
  packageVersion:string
  allocatorContractVersion:string
  importOrigin:string
  symbols:Record<string,{visibility:string;module:string;signature:string}>
  supportProfileDigest:string
}

interface SupportProfile {
  schema:string
  packageName:string
  packageVersion:string
  allocatorContractVersion:string
  conformanceProfile:string
  requiredConformanceCases:number
  symbols:Record<string,{visibility:string;module:string;signature:string}>
}

interface RemotePlanResult {
  planningRequestId:string
  candidateSetDigest:string
  budgetDigest:string
  policyDigest:string
  frozenInputDigest:string
  selectedCandidateId:string
  selectedCandidate?:unknown
  feasibleCandidateIds:string[]
  rejectedCandidates:{candidateId:string;reasonCode:string}[]
  allocationPlanRef:string
  allocationPlanDigest:string
  policySelectionRef?:string
  policySelectionDigest?:string
  allocatorContractVersion:string
  replanLineageRef?:string
}

function fail(
  code:'GCM_UNAVAILABLE'|'NO_FEASIBLE_PLAN'|'POLICY_INDETERMINATE'|'FROZEN_INPUT_MISMATCH'|'CANDIDATE_SET_MISMATCH'|'PLAN_INTEGRITY_FAILURE',
  message:string,
):never{
  throw new PlanningError(planningFailure({
    code,
    stage:'GCM',
    recovery:code==='GCM_UNAVAILABLE'?'RETRY':code==='FROZEN_INPUT_MISMATCH'||code==='CANDIDATE_SET_MISMATCH'?'REPLAN':'NONE',
    source:'gcm-phase-b',
    message,
  }))
}

function expectedPlanningRequestId(frozenInputDigest:string):string{
  const digest=sha256Digest({schema:'pncw-projection-planning-request/v1',frozenInputDigest})
  return `pncw:plan-request:${digest.slice('sha256:'.length)}`
}

function forbiddenOutputKey(value:unknown):string|null{
  if(Array.isArray(value)){
    for(const item of value){ const found=forbiddenOutputKey(item); if(found) return found }
    return null
  }
  if(!value || typeof value!=='object') return null
  for(const [key,item] of Object.entries(value as Record<string,unknown>)){
    const normalized=key.replace(/[^a-z0-9]/gi,'').toLowerCase()
    if(FORBIDDEN_OUTPUT_KEYS.has(normalized)) return key
    const nested=forbiddenOutputKey(item)
    if(nested) return nested
  }
  return null
}

function requireString(value:unknown,label:string):string{
  if(typeof value!=='string'||value.length===0) return fail('PLAN_INTEGRITY_FAILURE',`${label} must be a non-empty string`)
  return value
}

function validatePlanningInput(input:GcmPlanningInputV1):{
  candidates:ProjectionRouteCandidateV1[]
  eligible:ProjectionRouteCandidateV1[]
  budgetRejected:{candidateId:string;reasonCode:string}[]
}{
  const candidates=input.candidates.map(candidate=>assertProjectionRouteCandidate(candidate))
  const budget=assertProjectionBudget(input.budget)
  const frozen=assertFrozenPlanningInputRef(input.frozenInputRef)
  validateSelectionPolicyAgainstCandidateSet(input.selectionPolicy,candidates)
  if(input.planningRequestId!==expectedPlanningRequestId(frozen.frozenInputDigest)) return fail('FROZEN_INPUT_MISMATCH','planning request id does not match frozen planning input')
  if(frozen.candidateSetDigest!==deriveCandidateSetDigest(candidates)) return fail('CANDIDATE_SET_MISMATCH','candidate set digest does not match frozen planning input')
  if(frozen.budgetDigest!==deriveBudgetDigest(budget)||frozen.policyDigest!==derivePolicyDigest(input.selectionPolicy)) return fail('FROZEN_INPUT_MISMATCH','budget or policy digest does not match frozen planning input')
  const eligible:ProjectionRouteCandidateV1[]=[]
  const budgetRejected:{candidateId:string;reasonCode:string}[]=[]
  for(const candidate of [...candidates].sort((a,b)=>a.candidateId.localeCompare(b.candidateId))){
    const failures=candidateFeasibilityFailures(candidate,budget)
    if(failures.length===0) eligible.push(candidate)
    else budgetRejected.push({candidateId:candidate.candidateId,reasonCode:failures[0]!.code})
  }
  if(eligible.length===0) return fail('NO_FEASIBLE_PLAN','no projection route satisfies the PNCW hard budget')
  return {candidates,eligible,budgetRejected}
}

function remoteFailure(error:unknown):never{
  const code=typeof (error as {code?:unknown})?.code==='string'?(error as {code:string}).code:''
  const message=error instanceof Error?error.message:'GCM process request failed'
  if(code==='NO_FEASIBLE_PLAN') return fail('NO_FEASIBLE_PLAN',message)
  if(code==='POLICY_INDETERMINATE') return fail('POLICY_INDETERMINATE',message)
  if(code==='FROZEN_INPUT_MISMATCH') return fail('FROZEN_INPUT_MISMATCH',message)
  if(code==='PLAN_INTEGRITY_FAILURE') return fail('PLAN_INTEGRITY_FAILURE',message)
  return fail('GCM_UNAVAILABLE',message)
}

export class RealGcmPhaseBAdapter implements GcmPlanningPort {
  readonly #client:GcmPhaseBProcessClient
  readonly #config:RealGcmPhaseBConfig
  readonly #capabilities:GcmPlanningCapabilitiesV1
  readonly #conformance:GcmConformanceIdentityV1
  readonly #api:AcceptedGcmPublicApiSnapshotV1

  private constructor(input:{client:GcmPhaseBProcessClient;config:RealGcmPhaseBConfig;capabilities:GcmPlanningCapabilitiesV1;conformance:GcmConformanceIdentityV1;api:AcceptedGcmPublicApiSnapshotV1}){
    this.#client=input.client
    this.#config=structuredClone(input.config)
    this.#capabilities=structuredClone(input.capabilities)
    this.#conformance=structuredClone(input.conformance)
    this.#api=structuredClone(input.api)
  }

  static async open(config:RealGcmPhaseBConfig):Promise<RealGcmPhaseBAdapter>{
    if(!config.pythonExecutable) throw new Error('pythonExecutable is required')
    if(!config.snapshotRegistryPath) throw new Error('snapshotRegistryPath is required')
    const hostScript=resolve(config.cwd ?? process.cwd(),config.hostScript ?? DEFAULT_HOST_SCRIPT)
    const profilePath=resolve(config.cwd ?? process.cwd(),config.publicApiProfilePath ?? DEFAULT_SUPPORT_PROFILE)
    const client=await GcmPhaseBProcessClient.open({
      executable:config.pythonExecutable,
      args:[hostScript],
      ...(config.cwd!==undefined?{cwd:config.cwd}:{}),
      ...(config.timeoutMs!==undefined?{timeoutMs:config.timeoutMs}:{}),
    })
    try{
      const init=await client.request('initialize',{
        expectedPackageVersion:config.expectedPackageVersion,
        expectedAllocatorContractVersion:config.expectedAllocatorContractVersion,
        conformanceProfile:config.conformanceProfile,
        snapshotRegistryPath:resolve(config.cwd ?? process.cwd(),config.snapshotRegistryPath),
        routeProfiles:structuredClone(config.routeProfiles),
        requireInstalled:true,
      }) as any
      const support=JSON.parse(await readFile(profilePath,'utf8')) as SupportProfile
      if(support.schema!=='pncw-gcm-phase-b-public-api-profile/v1') throw new Error('unsupported GCM public API support profile schema')
      if(support.packageName!=='gcm-reference-runtime'||support.packageVersion!==config.expectedPackageVersion||support.allocatorContractVersion!==config.expectedAllocatorContractVersion) throw new Error('GCM public API support profile identity mismatch')
      if(support.conformanceProfile!=='GCM-ALLOC-R0-M4'||support.requiredConformanceCases!==80) throw new Error('GCM public API support profile conformance mismatch')
      const actual=init?.api
      if(!actual||actual.packageName!==support.packageName||actual.packageVersion!==support.packageVersion||actual.allocatorContractVersion!==support.allocatorContractVersion) throw new Error('installed GCM public API identity mismatch')
      for(const [name,expected] of Object.entries(support.symbols)){
        const observed=actual.symbols?.[name]
        if(!observed||observed.visibility!=='public'||observed.module!==expected.module||observed.signature!==expected.signature) throw new Error(`unsupported GCM public API signature: ${name}`)
      }
      const conf=init?.conformance
      if(!conf||conf.profile_id!=='GCM-ALLOC-R0-M4'||conf.claim!=='CONFORMANT'||conf.required_total!==80||conf.required_passed!==80||conf.required_failed!==0||conf.required_indeterminate!==0) throw new Error('installed GCM allocator is not 80/80 CONFORMANT')
      const conformance:GcmConformanceIdentityV1={
        profileId:conf.profile_id,
        claim:'CONFORMANT',
        profileDigest:requireString(conf.profile_digest,'GCM conformance profile digest'),
        packageName:support.packageName,
        packageVersion:support.packageVersion,
        allocatorContractVersion:support.allocatorContractVersion,
      }
      const rawCapabilities=init?.capabilities
      const capabilities:GcmPlanningCapabilitiesV1={
        provider:'gcm-phase-b',adapterVersion:ADAPTER_VERSION,
        providerContractVersions:[support.allocatorContractVersion],
        conformanceProfiles:['GCM-ALLOC-R0-M4'],supportsReplan:true,
        policyKinds:['LEXICOGRAPHIC','WEIGHTED'],normalizationProfiles:['pncw:unit-interval/v1'],
      }
      if(rawCapabilities?.provider!=='gcm-phase-b') throw new Error('installed GCM capabilities response mismatch')
      const api:AcceptedGcmPublicApiSnapshotV1={
        accepted:true,packageName:actual.packageName,packageVersion:actual.packageVersion,
        allocatorContractVersion:actual.allocatorContractVersion,importOrigin:requireString(actual.importOrigin,'GCM import origin'),
        symbols:structuredClone(actual.symbols),supportProfileDigest:sha256Digest(support),
      }
      return new RealGcmPhaseBAdapter({client,config,capabilities,conformance,api})
    }catch(error){
      await client.close().catch(()=>undefined)
      throw error
    }
  }

  async capabilities():Promise<GcmPlanningCapabilitiesV1>{ return structuredClone(this.#capabilities) }
  async conformanceIdentity():Promise<GcmConformanceIdentityV1>{ return structuredClone(this.#conformance) }
  async publicApiSnapshot():Promise<AcceptedGcmPublicApiSnapshotV1>{ return structuredClone(this.#api) }

  async plan(input:GcmPlanningInputV1):Promise<GcmPlanSnapshotV1>{
    return this.#execute('plan',input)
  }

  async replan(input:GcmReplanInputV1):Promise<GcmPlanSnapshotV1>{
    const replan=assertProjectionReplanRequest(input.replanRequest)
    if(replan.newFrozenInputRef.frozenInputDigest!==input.frozenInputRef.frozenInputDigest) return fail('FROZEN_INPUT_MISMATCH','replan input is not bound to the new frozen snapshot')
    return this.#execute('replan',input)
  }

  async close():Promise<void>{ await this.#client.close() }

  async #execute(method:'plan'|'replan',input:GcmPlanningInputV1|GcmReplanInputV1):Promise<GcmPlanSnapshotV1>{
    const {candidates,eligible,budgetRejected}=validatePlanningInput(input)
    const params:any={
      planningRequestId:input.planningRequestId,
      candidates:structuredClone(eligible),
      budget:structuredClone(input.budget),
      selectionPolicy:structuredClone(input.selectionPolicy),
      frozenInputRef:structuredClone(input.frozenInputRef),
    }
    if(method==='replan') params.replanRequest=structuredClone((input as GcmReplanInputV1).replanRequest)
    let raw:RemotePlanResult
    try { raw=await this.#client.request(method,params) as RemotePlanResult }
    catch(error){ return remoteFailure(error) }
    const forbidden=forbiddenOutputKey(raw)
    if(forbidden) return fail('PLAN_INTEGRITY_FAILURE',`GCM response contains forbidden authority/credential key ${forbidden}`)
    if(!raw||raw.planningRequestId!==input.planningRequestId) return fail('PLAN_INTEGRITY_FAILURE','GCM response planning request identity mismatch')
    if(raw.candidateSetDigest!==input.frozenInputRef.candidateSetDigest||raw.budgetDigest!==input.frozenInputRef.budgetDigest||raw.policyDigest!==input.frozenInputRef.policyDigest||raw.frozenInputDigest!==input.frozenInputRef.frozenInputDigest) return fail('FROZEN_INPUT_MISMATCH','GCM response frozen lineage mismatch')
    if(raw.allocatorContractVersion!==this.#config.expectedAllocatorContractVersion) return fail('PLAN_INTEGRITY_FAILURE','GCM response allocator contract mismatch')
    const byId=new Map(candidates.map(candidate=>[candidate.candidateId,candidate] as const))
    const selected=byId.get(raw.selectedCandidateId)
    if(!selected) return fail('PLAN_INTEGRITY_FAILURE','GCM selected candidate is outside original PNCW candidate set')
    const eligibleIds=new Set(eligible.map(candidate=>candidate.candidateId))
    if(!eligibleIds.has(selected.candidateId)) return fail('PLAN_INTEGRITY_FAILURE','GCM selected a PNCW budget-ineligible candidate')
    const feasible=[...new Set(raw.feasibleCandidateIds)].sort()
    if(feasible.some(id=>!eligibleIds.has(id))||!feasible.includes(selected.candidateId)) return fail('PLAN_INTEGRITY_FAILURE','GCM feasible/selected candidate references are inconsistent')
    const rejectedMap=new Map<string,string>()
    for(const row of budgetRejected) rejectedMap.set(row.candidateId,row.reasonCode)
    for(const row of raw.rejectedCandidates ?? []){
      if(!byId.has(row.candidateId)) return fail('PLAN_INTEGRITY_FAILURE','GCM rejected candidate is outside original PNCW candidate set')
      if(!rejectedMap.has(row.candidateId)) rejectedMap.set(row.candidateId,requireString(row.reasonCode,'GCM rejection reason'))
    }
    const allocationPlanRef=requireString(raw.allocationPlanRef,'GCM allocation plan reference')
    const allocationPlanDigest=requireString(raw.allocationPlanDigest,'GCM allocation plan digest')
    const policySelectionRef=requireString(raw.policySelectionRef,'GCM policy selection reference')
    const policySelectionDigest=requireString(raw.policySelectionDigest,'GCM policy selection digest')
    return buildGcmPlanSnapshot({
      schema:'pncw-gcm-plan-snapshot/v1',planningRequestId:input.planningRequestId,
      candidateSetDigest:input.frozenInputRef.candidateSetDigest,budgetDigest:input.frozenInputRef.budgetDigest,
      policyDigest:input.frozenInputRef.policyDigest,frozenInputDigest:input.frozenInputRef.frozenInputDigest,
      selectedCandidateId:selected.candidateId,selectedCandidateDigest:candidateSemanticDigest(selected),
      feasibleCandidateIds:feasible,
      rejectedCandidates:[...rejectedMap].sort(([a],[b])=>a.localeCompare(b)).map(([candidateId,reasonCode])=>({candidateId,reasonCode})),
      allocationPlanRef,allocationPlanDigest,policySelectionRef,policySelectionDigest,
      allocatorContractVersion:this.#config.expectedAllocatorContractVersion,
      conformance:structuredClone(this.#conformance),
      ...(raw.replanLineageRef!==undefined?{replanLineageRef:requireString(raw.replanLineageRef,'GCM pre-admission replan lineage')}:{}),
    })
  }
}
