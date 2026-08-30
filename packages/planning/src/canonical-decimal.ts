import type { CanonicalDecimalV1 } from './types.js'

const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/

export function assertCanonicalDecimal(
  value: unknown,
  options: { nonNegative?: boolean } = {},
): CanonicalDecimalV1 {
  if (typeof value !== 'string' || !DECIMAL.test(value) || value === '-0') {
    throw new Error(`invalid canonical decimal ${String(value)}`)
  }
  if (options.nonNegative && value.startsWith('-')) {
    throw new Error('canonical decimal must be non-negative')
  }
  return value
}
