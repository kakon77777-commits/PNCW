export * from './types.js'
export * from './hdsrc-port.js'
export * from './mrmic-port.js'

const FORBIDDEN = /(write|patch|mutat|register|replace|commit)/i
export function assertReadOnlyPortSurface(value: object): void {
  let prototype: object | null = value
  while (prototype && prototype !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name !== 'constructor' && FORBIDDEN.test(name)) throw new Error(`forbidden canonical mutation method ${name}`)
    }
    prototype = Object.getPrototypeOf(prototype) as object | null
  }
}
