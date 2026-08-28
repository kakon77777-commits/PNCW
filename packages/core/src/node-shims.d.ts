declare module 'node:crypto' {
  export interface HashLike { update(data: string): HashLike; digest(encoding: 'hex'): string }
  export function createHash(algorithm: string): HashLike
}
declare module 'node:path' {
  export function resolve(...paths: string[]): string
}
declare module 'node:url' {
  export function pathToFileURL(path: string): { href: string }
}
declare module 'node:child_process' {
  export function execFileSync(file: string, args?: readonly string[], options?: { encoding?: 'utf8'; env?: Record<string, string | undefined>; cwd?: string; maxBuffer?: number }): string
}
