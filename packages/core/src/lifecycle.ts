import type { LifecycleState } from './contracts.js'
import { PncwError } from './errors.js'

const NORMAL: Record<string, Set<LifecycleState>> = {
  REQUESTED: new Set(['RESOLVED']),
  RESOLVED: new Set(['READY']),
  READY: new Set(['PROJECTED']),
  PROJECTED: new Set(['VERIFIED']),
  VERIFIED: new Set(['VISIBLE']),
  VISIBLE: new Set(['SUPERSEDED']),
}
const FAILURE_STATES = new Set<LifecycleState>(['STALE','INTEGRITY_FAILURE','UNAUTHORIZED','UNSUPPORTED','UNAVAILABLE','CONFLICT','ABORTED'])
const ACTIVE_STATES = new Set<LifecycleState>(['REQUESTED','RESOLVED','READY','PROJECTED','VERIFIED'])

export function assertTransition(from: LifecycleState, to: LifecycleState): LifecycleState {
  if (NORMAL[from]?.has(to)) return to
  if (ACTIVE_STATES.has(from) && FAILURE_STATES.has(to)) return to
  throw new PncwError({
    code: 'INVALID_TRANSITION',
    stage: 'VISIBILITY',
    retryable: false,
    source: 'pncw',
    message: `invalid PNCW lifecycle transition ${from} -> ${to}`,
  })
}
