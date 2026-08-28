import type { PncwErrorCode, PncwErrorEnvelopeV1, PncwStage } from './contracts.js'

export class PncwError extends Error {
  readonly code: PncwErrorCode
  readonly stage: PncwStage
  readonly retryable: boolean
  readonly source: 'pncw' | 'hdsrc' | 'mrmic'
  readonly causeRef: string | undefined

  constructor(envelope: Omit<PncwErrorEnvelopeV1, 'schema'>) {
    super(envelope.message)
    this.name = 'PncwError'
    this.code = envelope.code
    this.stage = envelope.stage
    this.retryable = envelope.retryable
    this.source = envelope.source
    this.causeRef = envelope.causeRef
  }

  envelope(): PncwErrorEnvelopeV1 {
    return {
      schema: 'pncw-error/v1',
      code: this.code,
      stage: this.stage,
      retryable: this.retryable,
      source: this.source,
      message: this.message,
      ...(this.causeRef ? { causeRef: this.causeRef } : {}),
    }
  }
}

const HDSRC_CODES: Record<string, { code: PncwErrorCode; retryable?: boolean }> = {
  INVALID_REQUEST: { code: 'INVALID_REQUEST' },
  UNAUTHORIZED: { code: 'UNAUTHORIZED' },
  RESOURCE_NOT_FOUND: { code: 'SOURCE_UNAVAILABLE', retryable: false },
  UNSUPPORTED_PROFILE: { code: 'UNSUPPORTED' },
  STALE_STATE: { code: 'STALE_SOURCE', retryable: true },
  INTEGRITY_FAILURE: { code: 'INTEGRITY_FAILURE', retryable: false },
  MATERIALIZATION_FAILED: { code: 'MATERIALIZATION_FAILED' },
  ORACLE_REQUIRED: { code: 'MATERIALIZATION_FAILED', retryable: true },
  ORACLE_FAILED: { code: 'MATERIALIZATION_FAILED', retryable: true },
  PROVIDER_UNAVAILABLE: { code: 'SOURCE_UNAVAILABLE', retryable: true },
}

const MRMIC_CODES: Record<string, { code: PncwErrorCode; retryable?: boolean }> = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED' },
  UNSUPPORTED: { code: 'UNSUPPORTED' },
  SURFACE_UNAVAILABLE: { code: 'SURFACE_UNAVAILABLE', retryable: true },
  VERSION_CONFLICT: { code: 'VERSION_CONFLICT', retryable: false },
  INTEGRITY_FAILURE: { code: 'INTEGRITY_FAILURE', retryable: false },
}

export function mapUpstreamError(
  error: unknown,
  source: 'hdsrc' | 'mrmic',
  stage: PncwStage,
): PncwError {
  if (error instanceof PncwError) return error
  const item = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const upstreamCode = typeof item.code === 'string' ? item.code : ''
  const map = source === 'hdsrc' ? HDSRC_CODES : MRMIC_CODES
  const mapped = map[upstreamCode] ?? { code: source === 'hdsrc' ? 'SOURCE_UNAVAILABLE' : 'SURFACE_UNAVAILABLE', retryable: true }
  const message = typeof item.message === 'string' && item.message ? item.message : String(error)
  const retryable = mapped.retryable ?? item.retryable === true
  return new PncwError({ code: mapped.code, stage, retryable, source, message })
}
