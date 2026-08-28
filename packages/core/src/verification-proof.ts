import type { VerificationResultV1 } from './contracts.js'

const LIVE_VERIFICATION = Symbol('pncw-live-verification-proof')

type BrandedVerification = VerificationResultV1 & { [LIVE_VERIFICATION]?: true }

export function markLiveVerified<T extends VerificationResultV1>(result: T): T {
  if (!result.verified) throw new Error('only verified results can receive a live verification proof')
  Object.defineProperty(result as BrandedVerification, LIVE_VERIFICATION, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return result
}

export function hasLiveVerificationProof(result: VerificationResultV1): boolean {
  return (result as BrandedVerification)[LIVE_VERIFICATION] === true
}
