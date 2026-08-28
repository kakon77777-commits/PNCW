import {
  PncwError, assertTransition, deriveManifestDigest, deriveVerificationDigest, deriveVisibilityCommitId, hasLiveVerificationProof,
  type LifecycleState, type ProjectionManifestV1, type RevealMode, type VerificationResultV1, type VisibilityStateV1,
} from '../../core/src/index.js'

export interface VisibilityCommitInput {
  lifecycleState: LifecycleState
  manifest: ProjectionManifestV1
  verification: VerificationResultV1
  revealMode: RevealMode
  visibleAt?: string
}

export interface VisibilityCommitReceiptV1 {
  resultId: string
  visibilityCommitId: string
  state: 'VISIBLE'
  revealMode: RevealMode
  visibleAt?: string
}

interface VisibleRecord {
  manifest: ProjectionManifestV1
  state: VisibilityStateV1
  receipt: VisibilityCommitReceiptV1
}

export function residentFraction(manifest: ProjectionManifestV1 | undefined): number {
  if (!manifest || manifest.residencyMap.length === 0) return 0
  let totalBytes=0
  let residentBytes=0
  for (const entry of manifest.residencyMap) {
    if (entry.bytesTotal !== undefined) {
      totalBytes += entry.bytesTotal
      if (entry.bytesResident !== undefined) residentBytes += Math.min(entry.bytesResident, entry.bytesTotal)
      else if (entry.state === 'RESIDENT') residentBytes += entry.bytesTotal
    }
  }
  if (totalBytes > 0) return Math.max(0, Math.min(1, residentBytes / totalBytes))
  const resident = manifest.residencyMap.filter(entry=>entry.state==='RESIDENT').length
  return resident / manifest.residencyMap.length
}

export class VisibilityCommitStore {
  readonly #byResult = new Map<string, VisibleRecord>()
  readonly #byCommit = new Map<string, VisibilityCommitReceiptV1>()
  #eventCount=0

  get eventCount(): number { return this.#eventCount }

  getVisible(resultId: string): ProjectionManifestV1 | undefined {
    return this.#byResult.get(resultId)?.manifest
  }

  getState(resultId: string): VisibilityStateV1 | undefined {
    return this.#byResult.get(resultId)?.state
  }

  commit(input: VisibilityCommitInput): VisibilityCommitReceiptV1 {
    assertTransition(input.lifecycleState,'VISIBLE')
    if (!input.verification.verified) {
      throw new PncwError({code:'VERIFICATION_FAILED',stage:'VISIBILITY',retryable:false,source:'pncw',message:'unverified result cannot become visible'})
    }
    if (input.verification.resultId !== input.manifest.resultId || input.verification.manifestDigest !== input.manifest.manifestDigest) {
      throw new PncwError({code:'VERSION_CONFLICT',stage:'VISIBILITY',retryable:false,source:'pncw',message:'verification and manifest identity mismatch'})
    }
    if (deriveManifestDigest(input.manifest) !== input.manifest.manifestDigest) {
      throw new PncwError({code:'INTEGRITY_FAILURE',stage:'VISIBILITY',retryable:false,source:'pncw',message:'manifest digest mismatch at visibility boundary'})
    }
    if (deriveVerificationDigest(input.verification) !== input.verification.verificationDigest) {
      throw new PncwError({code:'INTEGRITY_FAILURE',stage:'VISIBILITY',retryable:false,source:'pncw',message:'verification digest mismatch at visibility boundary'})
    }
    if (!hasLiveVerificationProof(input.verification)) {
      throw new PncwError({code:'VERIFICATION_FAILED',stage:'VISIBILITY',retryable:false,source:'pncw',message:'visibility commit requires a live verification proof from the current verifier runtime'})
    }
    const root=input.manifest.residencyMap.find(entry=>entry.regionRef==='manifest:root')
    if (!root || root.state==='INVALID' || root.state==='UNAVAILABLE') {
      throw new PncwError({code:'VERIFICATION_FAILED',stage:'VISIBILITY',retryable:false,source:'pncw',message:'invalid root manifest cannot become visible'})
    }
    const visibilityCommitId=deriveVisibilityCommitId({
      resultId:input.manifest.resultId,
      manifestDigest:input.manifest.manifestDigest,
      verificationDigest:input.verification.verificationDigest,
      revealMode:input.revealMode,
    })
    const existingByCommit=this.#byCommit.get(visibilityCommitId)
    if (existingByCommit) return existingByCommit
    const existingByResult=this.#byResult.get(input.manifest.resultId)
    if (existingByResult) {
      throw new PncwError({code:'ALREADY_VISIBLE',stage:'VISIBILITY',retryable:false,source:'pncw',message:`result ${input.manifest.resultId} is already visible under another commit`})
    }
    const state: VisibilityStateV1=Object.freeze({
      schema:'pncw-visibility-state/v1',
      resultId:input.manifest.resultId,
      state:'VISIBLE',
      visibilityCommitId,
      revealMode:input.revealMode,
      ...(input.visibleAt ? {visibleAt:input.visibleAt} : {}),
    })
    const receipt: VisibilityCommitReceiptV1=Object.freeze({
      resultId:input.manifest.resultId,visibilityCommitId,state:'VISIBLE',revealMode:input.revealMode,
      ...(input.visibleAt ? {visibleAt:input.visibleAt} : {}),
    })
    this.#byResult.set(input.manifest.resultId,{manifest:input.manifest,state,receipt})
    this.#byCommit.set(visibilityCommitId,receipt)
    this.#eventCount += 1
    return receipt
  }
}
