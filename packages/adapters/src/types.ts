export interface AuthorityDecisionV1 { authorized: boolean; grant: string; reason?: string }
export interface FreshnessResultV1 { fresh: boolean; retryable: boolean; reason?: string }
export interface StructuralVerificationV1 { verified: boolean; kind: string; digest?: string; reason?: string }
export interface RegionReadResultV1 {
  regionRef: string
  bytesRead: number
  totalCarrierBytes: number
  payloadDigest: string
  structuralVerified: boolean
}
