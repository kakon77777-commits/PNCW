import type { CanonicalDecimalV1 } from './types.js'

const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/

export interface DecimalPartsV1 {
  sign: -1 | 0 | 1
  coefficient: bigint
  scale: number
}

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

export function parseCanonicalDecimal(value: CanonicalDecimalV1): DecimalPartsV1 {
  assertCanonicalDecimal(value)
  const negative=value.startsWith('-')
  const body=negative?value.slice(1):value
  const [whole,fraction='']=body.split('.')
  const coefficient=BigInt(`${whole}${fraction}`)
  if(coefficient===0n) return {sign:0,coefficient:0n,scale:fraction.length}
  return {sign:negative?-1:1,coefficient,scale:fraction.length}
}

function scaledInteger(parts:DecimalPartsV1,targetScale:number):bigint{
  const magnitude=parts.coefficient*10n**BigInt(targetScale-parts.scale)
  return BigInt(parts.sign)*magnitude
}

export function compareCanonicalDecimal(
  left:CanonicalDecimalV1,
  right:CanonicalDecimalV1,
): -1 | 0 | 1 {
  const a=parseCanonicalDecimal(left)
  const b=parseCanonicalDecimal(right)
  const scale=Math.max(a.scale,b.scale)
  const av=scaledInteger(a,scale)
  const bv=scaledInteger(b,scale)
  return av<bv?-1:av>bv?1:0
}

export function canonicalDecimalIsZero(value:CanonicalDecimalV1):boolean{
  return parseCanonicalDecimal(value).coefficient===0n
}
