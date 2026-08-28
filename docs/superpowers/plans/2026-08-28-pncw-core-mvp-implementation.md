# PNCW Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable PNCW coordination kernel that resolves an externally authoritative HDSRC source, verifies a projection through adapter-bounded HDSRC/MRMIC authorities, and atomically commits a logically complete result to visibility while allowing partial physical residency.

**Architecture:** PNCW remains a thin TypeScript/Node orchestrator. It owns contracts, deterministic identity, lifecycle, readiness, verification, visibility semantics and conformance, while HDSRC and MRMIC/NVCL remain external authorities. Fake adapters close the core semantics first; the final vertical slice reuses MRMIC/NVCL Phase 14 `LocalProcessHdsrcProvider`, `createHdsrcMaterializationPortal(...)`, and `readPartialRelationBlockRow(...)` rather than reimplementing HDSRC or Canvas semantics.

**Tech Stack:** Node.js `>=22.5.0`, TypeScript, ESM, npm workspaces, Node test runner, JSON Schema, SHA-256 from `node:crypto`, deterministic JSON canonicalization, external local MRMIC/NVCL + HDSRC v0.10 checkouts for the real validation task.

**Spec:** `docs/superpowers/specs/2026-08-28-pncw-core-mvp-design.md`

## Global Constraints

- Use branch `workbench/core-mvp-v0.1` for implementation; do not implement directly on `main`.
- Use strict TDD: every production behavior begins with a focused failing test, the failure is observed, then minimal production code is added.
- Node.js runtime floor is `>=22.5.0`.
- Use TypeScript + ESM + npm workspaces.
- Use `tsc --noEmit` for static validation and the Node test runner for runtime tests.
- Keep all core JSON Schemas closed with `additionalProperties: false`.
- PNCW MUST NOT expose canonical HDSRC mutation or unrestricted Canvas mutation.
- HDSRC source-read authority and MRMIC surface-projection authority remain separate.
- Preserve `STALE_SOURCE != INTEGRITY_FAILURE` and upstream retryability semantics.
- `VERIFIED -> VISIBLE` is the only normal reveal transition.
- Wall-clock timestamps, process IDs, temp paths and non-semantic random values MUST NOT contribute to RID/MID/VID/VCID.
- `manifestDigest` hashes the canonical manifest payload excluding `manifestDigest` and non-semantic audit metadata.
- `verificationDigest` hashes the canonical verification payload excluding `verificationDigest` and non-semantic audit metadata.
- `VCID = H(RID, MID, VID, RevealMode)`.
- A visible root manifest MAY contain non-resident regions; an invalid root manifest MUST never become visible.
- Real HDSRC integration MUST reuse the existing MRMIC/NVCL Phase 14 local-process provider path instead of duplicating its Python host or HMBT1 structural validator.
- The release claim is limited to `Projection Lifecycle + Verified Visibility Commit`; do not claim full PNCW E2E closure.

---

## File Structure Map

Implementation creates the following focused units:

```text
PNCW/
├─ package.json                         # root scripts, workspaces, Node floor
├─ package-lock.json                    # deterministic npm dependency lock
├─ tsconfig.json                        # strict ESM build
├─ .gitignore
├─ .github/workflows/ci.yml             # npm ci/check/test on Node 22
├─ scripts/run-tests.mjs                # Windows-safe recursive Node-test launcher
│
├─ contracts/
│  ├─ projection-request/v1.schema.json
│  ├─ projection-manifest/v1.schema.json
│  ├─ readiness-result/v1.schema.json
│  ├─ verification-result/v1.schema.json
│  ├─ visibility-state/v1.schema.json
│  └─ error-envelope/v1.schema.json
│
├─ packages/core/
│  ├─ package.json
│  └─ src/
│     ├─ contracts.ts                   # six v1 TypeScript contracts + shared value types
│     ├─ validate.ts                    # fail-closed runtime assertions
│     ├─ canonical.ts                   # deterministic JSON + SHA-256 helpers
│     ├─ identity.ts                    # RID/MID/VID/VCID derivation
│     ├─ lifecycle.ts                   # transition machine
│     ├─ errors.ts                      # typed PNCW errors + upstream mapping target
│     ├─ manifest.ts                    # pure manifest assembly/freeze
│     └─ index.ts
│
├─ packages/adapters/
│  ├─ package.json
│  └─ src/
│     ├─ hdsrc-port.ts                  # HDSRC-facing provider-neutral port
│     ├─ mrmic-port.ts                  # surface-facing provider-neutral port
│     ├─ types.ts                       # materialization/surface/region descriptors
│     └─ index.ts
│
├─ packages/readiness/
│  ├─ package.json
│  └─ src/index.ts                      # ProjectionReadinessGate
│
├─ packages/verification/
│  ├─ package.json
│  └─ src/index.ts                      # ProjectionVerifier
│
├─ packages/visibility/
│  ├─ package.json
│  └─ src/index.ts                      # VisibilityCommit + in-memory semantic store
│
├─ packages/conformance/
│  ├─ package.json
│  └─ src/index.ts                      # reusable adapter/core conformance runners
│
├─ adapters/fake-hdsrc/
│  ├─ package.json
│  └─ src/index.ts
├─ adapters/fake-mrmic/
│  ├─ package.json
│  └─ src/index.ts
├─ adapters/real-mrmic-hdsrc/
│  ├─ package.json
│  └─ src/index.ts                      # dynamic import bridge to external MRMIC checkout
│
├─ examples/vertical-slice/
│  ├─ package.json
│  └─ src/
│     ├─ fake.ts                        # deterministic fake full lifecycle
│     └─ real.ts                        # real 4096D external-checkout validator/demo
│
├─ tests/
│  ├─ contracts/
│  ├─ lifecycle/
│  ├─ readiness/
│  ├─ verification/
│  ├─ visibility/
│  ├─ conformance/
│  ├─ integration/
│  └─ negative-controls/
│
└─ docs/evidence/
   ├─ PNCW_CORE_MVP_VALIDATION_v0.1.md
   └─ real-4096d-validation.schema.json
```

The finalized `ProjectionManifestV1` is emitted only after a non-visible surface descriptor/binding exists. This refines the spec's conceptual arrow order without adding a seventh first-class contract: manifest assembly may begin earlier, but MID is computed only over the final semantic payload containing the resolved surface lineage.

---

### Task 1 — M0 Contract Foundation and Build Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Create: `scripts/run-tests.mjs`
- Create: `packages/core/package.json`
- Create: `packages/core/src/contracts.ts`
- Create: `packages/core/src/validate.ts`
- Create: `packages/core/src/index.ts`
- Create: all six `contracts/*/v1.schema.json`
- Test: `tests/contracts/contracts.test.mjs`

**Interfaces:**
- Produces: `ProjectionRequestV1`, `ProjectionManifestV1`, `ReadinessResultV1`, `VerificationResultV1`, `VisibilityStateV1`, `PncwErrorEnvelopeV1`, `SourceIdentityV1`, `ResidencyEntryV1`, `CheckResultV1`, `assertProjectionRequest`, `assertProjectionManifest`, `assertReadinessResult`, `assertVerificationResult`, `assertVisibilityState`, `assertPncwErrorEnvelope`.

- [ ] **Step 1: Add only project/config scaffolding required to execute tests**

Root `package.json`:

```json
{
  "name": "pncw-core-mvp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.5.0" },
  "workspaces": ["packages/*", "adapters/*", "examples/*"],
  "scripts": {
    "clean": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\"",
    "build": "tsc -p tsconfig.json",
    "check": "tsc -p tsconfig.json --noEmit",
    "test:built": "node scripts/run-tests.mjs",
    "test": "npm run build && npm run test:built",
    "ci": "npm run check && npm test"
  },
  "devDependencies": {
    "ajv": "^8.17.1",
    "typescript": "^5.8.3"
  }
}
```

Root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["packages/**/*.ts", "adapters/**/*.ts", "examples/**/*.ts"]
}
```

`scripts/run-tests.mjs` recursively discovers `tests/**/*.test.mjs` and accepts explicit test paths after `--`:

```js
import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) out.push(...await collect(path))
    else if (entry.name.endsWith('.test.mjs')) out.push(path)
  }
  return out.sort()
}

const requested = process.argv.slice(2)
const files = requested.length ? requested.map(resolve) : await collect('tests')
const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' })
child.on('exit', code => { process.exitCode = code ?? 1 })
```

- [ ] **Step 2: Write the failing contract test before contract/type implementation**

`tests/contracts/contracts.test.mjs` must load every JSON Schema with Ajv, validate one positive fixture inline, reject an undeclared field, and import the corresponding TypeScript-built assertion from `dist/packages/core/src/index.js`.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import Ajv from 'ajv'

const schema = JSON.parse(await readFile('contracts/projection-request/v1.schema.json', 'utf8'))
const ajv = new Ajv({ allErrors: true, strict: true })
const validate = ajv.compile(schema)

const validRequest = {
  schema: 'pncw-projection-request/v1',
  requestId: 'request:demo',
  sourceRef: 'hdsrc://state/state:demo-4096',
  observer: { observerId: 'observer:test', observerType: 'ai', profile: 'machine' },
  representation: { profile: 'HMBT1', protocolVersion: 'pncw/0.1' },
  scope: { scopeId: 'scope:block-row-0', regionRefs: ['relation:block-row:0'] },
  requestedMode: 'machine_carrier',
  authorityContext: { principalId: 'principal:test', sourceRead: true, surfaceProject: true }
}

test('projection request schema is closed and runtime assertion agrees', async () => {
  assert.equal(validate(validRequest), true)
  assert.equal(validate({ ...validRequest, injected: true }), false)
  const { assertProjectionRequest } = await import('../../dist/packages/core/src/index.js')
  assert.deepEqual(assertProjectionRequest(validRequest), validRequest)
  assert.throws(() => assertProjectionRequest({ ...validRequest, injected: true }))
})
```

- [ ] **Step 3: Run RED**

Run:

```bash
npm install
npm run build
npm run test:built -- tests/contracts/contracts.test.mjs
```

Expected: FAIL because the contract schema/core assertion module does not exist yet.

- [ ] **Step 4: Implement the six closed schemas and TypeScript contracts**

Use exact schema IDs:

```text
pncw-projection-request/v1
pncw-projection-manifest/v1
pncw-readiness-result/v1
pncw-verification-result/v1
pncw-visibility-state/v1
pncw-error/v1
```

Use exact unions:

```ts
export type ObservationMode = 'human_preview' | 'machine_carrier' | 'structured_manifest'
export type RevealMode = 'ATOMIC_ARTIFACT' | 'SEMANTIC_BATCH' | 'STREAM' | 'HYBRID'
export type ResidencyState = 'DECLARED' | 'AVAILABLE' | 'RESIDENT' | 'UNAVAILABLE' | 'INVALID'
export type LifecycleState =
  | 'REQUESTED' | 'RESOLVED' | 'READY' | 'PROJECTED' | 'VERIFIED' | 'VISIBLE'
  | 'STALE' | 'INTEGRITY_FAILURE' | 'UNAUTHORIZED' | 'UNSUPPORTED'
  | 'UNAVAILABLE' | 'CONFLICT' | 'ABORTED' | 'SUPERSEDED'

export type PncwErrorCode =
  | 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'UNSUPPORTED' | 'SOURCE_UNAVAILABLE'
  | 'STALE_SOURCE' | 'INTEGRITY_FAILURE' | 'MATERIALIZATION_FAILED'
  | 'SURFACE_UNAVAILABLE' | 'VERSION_CONFLICT' | 'VERIFICATION_FAILED'
  | 'INVALID_TRANSITION' | 'ALREADY_VISIBLE' | 'ABORTED'
```

`SourceIdentityV1` is exactly:

```ts
export interface SourceIdentityV1 {
  authority: string
  sourceId: string
  revision: number
  digest: string
}
```

All digest fields must match `^sha256:[0-9a-f]{64}$`; all core validators reject unknown top-level and nested fields instead of stripping them.

- [ ] **Step 5: Run GREEN and full static check**

```bash
npm run check
npm run test:built -- tests/contracts/contracts.test.mjs
```

Expected: PASS, no TypeScript errors.

- [ ] **Step 6: Commit M0 contract foundation**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .github scripts contracts packages/core tests/contracts
git commit -m "feat: establish PNCW v1 contract foundation"
```

---

### Task 2 — M1 Deterministic Identity, Error Model and Lifecycle

**Files:**
- Create: `packages/core/src/canonical.ts`
- Create: `packages/core/src/identity.ts`
- Create: `packages/core/src/errors.ts`
- Create: `packages/core/src/lifecycle.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/lifecycle/core-lifecycle.test.mjs`

**Interfaces:**
- Produces: `canonicalJson(value)`, `sha256Digest(value)`, `deriveResultId(input)`, `deriveManifestDigest(manifest)`, `deriveVerificationDigest(result)`, `deriveVisibilityCommitId(input)`, `PncwError`, `mapUpstreamError(...)`, `assertTransition(from,to)`.

- [ ] **Step 1: Write failing determinism and lifecycle tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

const core = await import('../../dist/packages/core/src/index.js')

test('semantic identity ignores object key order and audit timestamps', () => {
  const a = { z: 1, a: { y: 2, x: 3 } }
  const b = { a: { x: 3, y: 2 }, z: 1 }
  assert.equal(core.sha256Digest(a), core.sha256Digest(b))
})

test('manifest digest excludes manifestDigest and visibleAt-style audit fields', () => {
  const base = { schema: 'pncw-projection-manifest/v1', resultId: 'r', version: 1, semantic: { x: 1 } }
  assert.equal(
    core.deriveManifestDigest({ ...base, manifestDigest: `sha256:${'0'.repeat(64)}` }),
    core.deriveManifestDigest({ ...base, manifestDigest: `sha256:${'f'.repeat(64)}` })
  )
})

test('only VERIFIED may normally reveal to VISIBLE', () => {
  assert.doesNotThrow(() => core.assertTransition('VERIFIED', 'VISIBLE'))
  assert.throws(() => core.assertTransition('READY', 'VISIBLE'), e => e.code === 'INVALID_TRANSITION')
  assert.throws(() => core.assertTransition('PROJECTED', 'VISIBLE'), e => e.code === 'INVALID_TRANSITION')
})
```

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/lifecycle/core-lifecycle.test.mjs
```

Expected: FAIL because identity/lifecycle exports are absent.

- [ ] **Step 3: Implement canonical JSON and identities**

`canonicalJson` recursively sorts object keys, preserves array order, rejects `undefined`, functions, symbols, non-finite numbers and cyclic structures, then serializes UTF-8 JSON. `sha256Digest` returns `sha256:<64 lowercase hex>`.

Exact public identity functions:

```ts
export function deriveResultId(input: {
  sourceIdentity: SourceIdentityV1
  scope: ProjectionRequestV1['scope']
  observer: ProjectionRequestV1['observer']
  projectionProfile: ProjectionRequestV1['representation']
  protocolVersion: string
}): string

export function deriveManifestDigest(manifest: ProjectionManifestV1): string
export function deriveVerificationDigest(result: VerificationResultV1): string
export function deriveVisibilityCommitId(input: {
  resultId: string
  manifestDigest: string
  verificationDigest: string
  revealMode: RevealMode
}): string
```

IDs use prefixes:

```text
RID  = pncw:result:<sha256 hex>
MID  = sha256:<hex>
VID  = sha256:<hex>
VCID = pncw:visibility:<sha256 hex>
```

- [ ] **Step 4: Implement typed error and transition machine**

`PncwError` carries `code`, `stage`, `retryable`, `source`, and optional `causeRef`. Legal normal transitions are exactly:

```text
REQUESTED -> RESOLVED
RESOLVED  -> READY
READY     -> PROJECTED
PROJECTED -> VERIFIED
VERIFIED  -> VISIBLE
VISIBLE   -> SUPERSEDED
```

Fail/terminal transitions may leave any pre-visible state for `STALE`, `INTEGRITY_FAILURE`, `UNAUTHORIZED`, `UNSUPPORTED`, `UNAVAILABLE`, `CONFLICT`, or `ABORTED`; terminal failure states have no outgoing transition. `VERIFIED -> SUPERSEDED` is allowed if source freshness is invalidated before reveal.

- [ ] **Step 5: GREEN + regression**

```bash
npm run check
npm test
```

Expected: all current tests PASS.

- [ ] **Step 6: Commit M1**

```bash
git add packages/core tests/lifecycle
git commit -m "feat: add deterministic PNCW identity and lifecycle"
```

---

### Task 3 — M2 Adapter Ports and Deterministic Fake Authorities

**Files:**
- Create: `packages/adapters/package.json`
- Create: `packages/adapters/src/types.ts`
- Create: `packages/adapters/src/hdsrc-port.ts`
- Create: `packages/adapters/src/mrmic-port.ts`
- Create: `packages/adapters/src/index.ts`
- Create: `adapters/fake-hdsrc/package.json`
- Create: `adapters/fake-hdsrc/src/index.ts`
- Create: `adapters/fake-mrmic/package.json`
- Create: `adapters/fake-mrmic/src/index.ts`
- Test: `tests/conformance/fake-adapters.test.mjs`

**Interfaces:**
- Produces: `HdsrcSourcePort`, `MrmicSurfacePort`, `MaterializationDescriptorV1`, `SurfaceDescriptorV1`, `SurfaceBindingV1`, `RegionReadV1`, `FakeHdsrcAdapter`, `FakeMrmicAdapter`.

Exact source port:

```ts
export interface HdsrcSourcePort {
  getCapabilities(context: AuthorityContextV1): Promise<SourceCapabilitiesV1>
  resolveSource(sourceRef: string, context: AuthorityContextV1): Promise<SourceIdentityV1>
  resolveMaterialization(request: ProjectionRequestV1, source: SourceIdentityV1, context: AuthorityContextV1): Promise<MaterializationDescriptorV1>
  checkFreshness(source: SourceIdentityV1, materialization: MaterializationDescriptorV1, context: AuthorityContextV1): Promise<CheckResultV1>
  checkAuthority(source: SourceIdentityV1, context: AuthorityContextV1): Promise<CheckResultV1>
  readSelectedRegion(materialization: MaterializationDescriptorV1, regionRef: string, context: AuthorityContextV1): Promise<RegionReadV1>
}
```

`MaterializationDescriptorV1` contains `materializationId`, full `sourceIdentity`, `materializationDigest`, `carrierProfile`, `spatializationId`, `logicalScale`, `machineResourceUri`, `previewResourceUri`, `totalCarrierBytes`, and:

```ts
integrity: {
  metadataVerified: boolean
  structuralVerified: boolean
  verifierRef: string
}
```

Exact surface port:

```ts
export interface MrmicSurfacePort {
  getCapabilities(context: AuthorityContextV1): Promise<SurfaceCapabilitiesV1>
  prepareSurface(input: PrepareSurfaceInputV1, context: AuthorityContextV1): Promise<SurfaceDescriptorV1>
  bindProjection(surface: SurfaceDescriptorV1, materialization: MaterializationDescriptorV1, context: AuthorityContextV1): Promise<SurfaceBindingV1>
  surfaceState(surfaceId: string, context: AuthorityContextV1): Promise<SurfaceDescriptorV1>
  checkProjectionAuthority(surface: SurfaceDescriptorV1, context: AuthorityContextV1): Promise<CheckResultV1>
}
```

- [ ] **Step 1: Write failing fake-adapter conformance tests**

Cover: no canonical mutation capability, independent source/surface grants, supported observation modes, stale-vs-integrity injection, surface lineage echo, and partial-region byte accounting.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/conformance/fake-adapters.test.mjs
```

Expected: FAIL because adapter contracts/implementations are missing.

- [ ] **Step 3: Implement ports and fakes minimally**

Fake HDSRC defaults:

```text
sourceId            = state:demo-4096
revision            = 12
dimension           = 4096
materializationId   = mat:demo-4096-hmbt1-32
carrierProfile      = HMBT1
logicalScale        = 32
spatializationId    = RCM_PP
totalCarrierBytes   = 286313
partial row bytes   = 1272
canonicalMutation   = false
```

Fake MRMIC returns a read-only surface whose binding repeats exact source ID/revision/digest and materialization ID/digest. Its source authorization flag MUST NOT influence HDSRC authorization.

- [ ] **Step 4: GREEN + full regression**

```bash
npm run check
npm test
```

- [ ] **Step 5: Commit M2**

```bash
git add packages/adapters adapters/fake-hdsrc adapters/fake-mrmic tests/conformance
git commit -m "feat: define PNCW adapter ports and fake authorities"
```

---

### Task 4 — M2 Readiness Gate

**Files:**
- Create: `packages/readiness/package.json`
- Create: `packages/readiness/src/index.ts`
- Test: `tests/readiness/readiness.test.mjs`

**Interfaces:**
- Consumes: `HdsrcSourcePort`, `MrmicSurfacePort`, `ProjectionRequestV1`.
- Produces: `ProjectionReadinessGate.evaluate(request, ports): Promise<ReadinessEvaluationV1>`.

Use a discriminated result:

```ts
export type ReadinessEvaluationV1 =
  | {
      ready: true
      result: ReadinessResultV1
      source: SourceIdentityV1
      materialization: MaterializationDescriptorV1
      sourceCapabilities: SourceCapabilitiesV1
      surfaceCapabilities: SurfaceCapabilitiesV1
    }
  | {
      ready: false
      result: ReadinessResultV1
      error: PncwErrorEnvelopeV1
    }
```

- [ ] **Step 1: Write failing readiness tests**

Required cases: happy path, source-read denied, unsupported `requestedMode`, changed-valid source => `STALE_SOURCE` with `retryable=true`, structurally invalid materialization => `INTEGRITY_FAILURE` with `retryable=false`, and MRMIC authority not compensating missing HDSRC authority.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/readiness/readiness.test.mjs
```

- [ ] **Step 3: Implement readiness evaluation order**

Exact order:

```text
validate request
-> source capabilities
-> surface capabilities
-> mode compatibility
-> resolve source
-> source authority
-> resolve materialization
-> freshness
-> scope bound
-> frame/profile validity
-> materialization metadata + structural evidence present
-> READY
```

Do not call `prepareSurface()` in readiness. Do not convert upstream `STALE_STATE` into generic unavailable. Map it to `STALE_SOURCE` and preserve retryability.

- [ ] **Step 4: GREEN + regression**

```bash
npm run check
npm test
```

- [ ] **Step 5: Commit readiness**

```bash
git add packages/readiness tests/readiness
git commit -m "feat: implement projection readiness gate"
```

---

### Task 5 — M3 Surface Binding and Immutable Manifest Assembly

**Files:**
- Create: `packages/core/src/manifest.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/integration/manifest-assembly.test.mjs`

**Interfaces:**
- Produces: `buildProjectionManifest(input): ProjectionManifestV1` and `freezeProjectionManifest(manifest)`.

- [ ] **Step 1: Write failing assembly tests**

The test performs: successful readiness -> fake MRMIC `prepareSurface()` -> `bindProjection()` -> manifest build. Assert that source/materialization/surface lineage is copied exactly, MID is deterministic, array ordering is canonicalized where the contract declares set semantics, and changing source revision produces a different RID/MID.

Also test that a surface binding with revision 13 over a source/materialization at revision 12 is rejected with `VERSION_CONFLICT` before manifest verification.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/integration/manifest-assembly.test.mjs
```

- [ ] **Step 3: Implement final-manifest assembly**

`buildProjectionManifest` accepts only a `ready:true` readiness result plus a prepared surface/binding. It derives RID from source + scope + observer + projection profile + protocol version. It sets residency entries from declared regions without forcing region reads. It computes MID only after `surfaceRefs` are present, stores `manifestDigest=MID`, deep-freezes the semantic object, and never calls upstream mutation methods.

- [ ] **Step 4: GREEN + regression**

```bash
npm run check
npm test
```

- [ ] **Step 5: Commit M3 assembly**

```bash
git add packages/core tests/integration/manifest-assembly.test.mjs
git commit -m "feat: assemble immutable projection manifests"
```

---

### Task 6 — M3 Projection Verifier and Structural Fail-Closed Semantics

**Files:**
- Create: `packages/verification/package.json`
- Create: `packages/verification/src/index.ts`
- Test: `tests/verification/verification.test.mjs`
- Test: `tests/negative-controls/rebinding.test.mjs`
- Test: `tests/negative-controls/mixed-version.test.mjs`

**Interfaces:**
- Produces: `ProjectionVerifier.verify(manifest, ports, authorityContext): Promise<VerificationResultV1>`.

- [ ] **Step 1: Write failing verifier tests**

Required checks:

```text
manifest_digest
source_freshness
source_authority
surface_authority
source_materialization_identity
source_materialization_revision
source_materialization_digest
surface_source_identity
surface_source_revision
surface_materialization_identity
provider_structural_verification
root_residency_validity
```

The rebinding test must create a self-consistent replacement `materializationDigest` and recomputed MID while `integrity.structuralVerified=false`; metadata must look coherent but verification must return `INTEGRITY_FAILURE` and `verified=false`.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/verification/verification.test.mjs tests/negative-controls/rebinding.test.mjs tests/negative-controls/mixed-version.test.mjs
```

- [ ] **Step 3: Implement verifier**

Rules:

- Recompute MID and reject mismatch.
- Re-resolve freshness at verification time; readiness evidence alone is insufficient.
- Require both source and surface authority checks independently.
- Require exact source/materialization/surface lineage equality.
- Require `metadataVerified === true` and `structuralVerified === true` from the authoritative source adapter.
- Never attempt to decode HMBT1 inside PNCW.
- `VERSION_CONFLICT`, `INTEGRITY_FAILURE`, `UNAUTHORIZED`, and stale evidence are fail-closed.
- Build `VerificationResultV1`, compute VID over the canonical verification payload, then store `verificationDigest=VID`.

- [ ] **Step 4: GREEN + full regression**

```bash
npm run check
npm test
```

- [ ] **Step 5: Commit verifier**

```bash
git add packages/verification tests/verification tests/negative-controls
git commit -m "feat: verify projection lineage fail closed"
```

---

### Task 7 — M4 Idempotent Visibility Commit and Residency Semantics

**Files:**
- Create: `packages/visibility/package.json`
- Create: `packages/visibility/src/index.ts`
- Test: `tests/visibility/visibility.test.mjs`

**Interfaces:**
- Produces: `VisibilityCommit`, `VisibilityReceiptV1`, `InMemoryVisibilityStore`.

Exact entry point:

```ts
commit(input: {
  manifest: ProjectionManifestV1
  verification: VerificationResultV1
  lifecycleState: 'VERIFIED'
  revealMode: RevealMode
  visibleAt: string
}): VisibilityStateV1
```

- [ ] **Step 1: Write failing visibility tests**

Test all of:

- `READY -> VISIBLE` rejected.
- `PROJECTED -> VISIBLE` rejected.
- failed verification rejected.
- valid VERIFIED commit returns `VISIBLE`.
- same VCID twice returns the same semantic visibility record and does not increment event count.
- `visibleAt` changes do not change VCID.
- root manifest `INVALID` residency blocks reveal.
- non-root detail region `AVAILABLE` or `DECLARED` is legal while visible.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/visibility/visibility.test.mjs
```

- [ ] **Step 3: Implement semantic visibility store**

The store is an MVP in-memory authority for **visibility state only**. It stores records by `resultId` and `visibilityCommitId`; it does not store source bytes or mutate Canvas/HDSRC. Duplicate VCID returns the original record. `markSuperseded(resultId, supersedingResultId)` transitions only an existing `VISIBLE` record to `SUPERSEDED`; it never rewrites its manifest.

- [ ] **Step 4: GREEN + full regression**

```bash
npm run check
npm test
```

- [ ] **Step 5: Commit M4**

```bash
git add packages/visibility tests/visibility
git commit -m "feat: add verified atomic visibility commit"
```

---

### Task 8 — M5/M7 Reusable Conformance + Fake Full Vertical Slice + Negative-Control Closure

**Files:**
- Create: `packages/conformance/package.json`
- Create: `packages/conformance/src/index.ts`
- Create: `examples/vertical-slice/package.json`
- Create: `examples/vertical-slice/src/fake.ts`
- Test: `tests/conformance/core-conformance.test.mjs`
- Test: `tests/integration/fake-vertical-slice.test.mjs`
- Test: `tests/negative-controls/restart.test.mjs`
- Test: `tests/negative-controls/visibility-shortcut.test.mjs`

**Interfaces:**
- Produces: `runHdsrcPortConformance(port)`, `runMrmicPortConformance(port)`, `runCoreLifecycleConformance(factory)`, and `runFakeVerticalSlice()`.

- [ ] **Step 1: Write failing conformance and vertical-slice tests**

The fake E2E must perform:

```text
ProjectionRequest
-> readiness
-> prepareSurface
-> bindProjection
-> final manifest
-> PROJECTED
-> verifier
-> VERIFIED
-> visibility commit
-> VISIBLE
-> readSelectedRegion(relation:block-row:0)
```

Final assertions:

```js
assert.equal(result.visibility.state, 'VISIBLE')
assert.ok(result.partialBytesRead > 0)
assert.ok(result.partialBytesRead < result.totalCarrierBytes)
assert.ok(result.residentFraction < 1)
assert.equal(result.semanticVisibilityEvents, 1)
```

Restart negative control: instantiate a new fake source adapter with stable source/materialization identity and prove re-resolution/reverification succeeds; mutate source revision and prove the cached verified result cannot be recommitted.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/conformance/core-conformance.test.mjs tests/integration/fake-vertical-slice.test.mjs tests/negative-controls/restart.test.mjs tests/negative-controls/visibility-shortcut.test.mjs
```

- [ ] **Step 3: Implement conformance runners and fake vertical slice**

Conformance tests must be adapter-agnostic and reusable by the real adapter. Do not put fake-specific conditionals in `packages/conformance`.

- [ ] **Step 4: GREEN + full suite**

```bash
npm run check
npm test
```

Expected: all M0–M5/M7 fake-path requirements pass before any real-provider code exists.

- [ ] **Step 5: Commit fake closure**

```bash
git add packages/conformance examples/vertical-slice tests/conformance tests/integration tests/negative-controls
git commit -m "feat: close fake PNCW vertical slice conformance"
```

---

### Task 9 — M6 Real MRMIC/HDSRC Adapter Reusing Phase 14

**Files:**
- Create: `adapters/real-mrmic-hdsrc/package.json`
- Create: `adapters/real-mrmic-hdsrc/src/index.ts`
- Test: `tests/integration/real-adapter-contract.test.mjs`
- Create: `docs/architecture/REAL_HDSRC_MRMIC_ADAPTER_v0.1.md`

**Interfaces:**
- Produces: `RealHdsrcMrmicAdapter.open(config)`, implementing both `HdsrcSourcePort` and `MrmicSurfacePort` via composition over external MRMIC modules.

Required environment/config fields:

```text
mrmicRoot
pythonExecutable
hostScript
registry
profileRoot
materializationRoot
stateRef
principalId
```

- [ ] **Step 1: Write failing adapter contract test using a temporary fake external module boundary**

The focused test does not require real HDSRC yet. It creates a temporary module exporting the same public API shape as MRMIC Phase 14 and proves the adapter:

- dynamically imports external compiled MRMIC code by file URL;
- calls `LocalProcessHdsrcProvider` rather than implementing JSONL itself;
- calls `createHdsrcMaterializationPortal(...)` rather than inventing Canvas metadata;
- maps MRMIC/HDSRC `STALE_STATE` to PNCW `STALE_SOURCE` with retryable true;
- maps `INTEGRITY_FAILURE` without changing retryability;
- exposes no canonical mutation operation.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/integration/real-adapter-contract.test.mjs
```

- [ ] **Step 3: Implement the real adapter**

At runtime dynamically import:

```text
<mrmicRoot>/dist/packages/provider-hdsrc/src/index.js
<mrmicRoot>/dist/packages/provider-hdsrc/src/local-process.js
```

Instantiate the upstream provider exactly through:

```ts
new LocalProcessHdsrcProvider({
  executable: pythonExecutable,
  hostScript,
  registry,
  profileRoot,
  materializationRoot,
  env,
  cwd,
  timeoutMs
})
```

Use upstream `materializeResolved(...)` for real HPCM2/HMR1 resolution. Force authoritative structural carrier verification through the upstream machine-resource read before reporting `structuralVerified=true`. Use upstream `readPartialRelationBlockRow(materializationRef, blockRow, accessContext)` for selected relation reads. Use upstream `createHdsrcMaterializationPortal(...)` to create the read-only `native_resource_portal_v1` surface descriptor/binding.

Do not copy the Phase 14 JSONL protocol or HMBT1 decoder into PNCW.

- [ ] **Step 4: GREEN adapter contract + fake regression**

```bash
npm run check
npm test
```

- [ ] **Step 5: Commit M6 adapter**

```bash
git add adapters/real-mrmic-hdsrc tests/integration/real-adapter-contract.test.mjs docs/architecture
git commit -m "feat: bridge PNCW to MRMIC HDSRC Phase 14"
```

---

### Task 10 — M8 Real 4096D Reference Demo, Evidence, CI and Release Closure

**Files:**
- Create: `examples/vertical-slice/src/real.ts`
- Test: `tests/integration/real-4096d.test.mjs`
- Create: `docs/evidence/real-4096d-validation.schema.json`
- Create: `docs/evidence/PNCW_CORE_MVP_VALIDATION_v0.1.md`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: deterministic evidence JSON from `runRealVerticalSlice(config)` and human-readable validation report.

- [ ] **Step 1: Write the real-integration test with explicit skip contract**

The test only runs when `PNCW_REAL_HDSRC=1`; otherwise it reports a named skip and does not fake a pass. When enabled it requires all external paths and fails fast if MRMIC is unbuilt or the HDSRC registry/state is missing.

- [ ] **Step 2: Execute real preflight manually**

In the external MRMIC checkout:

```bash
npm ci
npm run check
npm test
npm run build
```

Require a real HDSRC v0.10 source/runtime configuration with `HDSRC_TEST_STUB_RUNTIME` absent.

- [ ] **Step 3: Run RED real vertical test before `real.ts` exists**

```bash
PNCW_REAL_HDSRC=1 npm run build
PNCW_REAL_HDSRC=1 npm run test:built -- tests/integration/real-4096d.test.mjs
```

Expected: FAIL because `runRealVerticalSlice` is not implemented.

- [ ] **Step 4: Implement the real 4096D lifecycle**

`runRealVerticalSlice` must execute exactly:

```text
1 resolve real HDSRC state
2 materializeResolved via upstream LocalProcessHdsrcProvider
3 force upstream machine-resource structural validation
4 create MRMIC read-only portal/surface
5 PNCW readiness
6 final PNCW ProjectionManifest + MID
7 PNCW verification + VID
8 PNCW VisibilityCommit + VCID
9 upstream readPartialRelationBlockRow(blockRow=0)
10 compute residentFraction = partialBytesRead / totalCarrierBytes
11 emit deterministic semantic evidence JSON
```

The evidence must record:

```text
requestId
resultId
manifestDigest
verificationDigest
visibilityCommitId
source authority/id/revision/digest
materializationId/materializationDigest/carrierProfile/logicalScale/spatializationId
surfaceId
providerVersion
lifecycleState
partialBytesRead
totalCarrierBytes
residentFraction
canonicalMutation=false
```

Do not place wall-clock time in the hashed semantic evidence section. Audit time may exist in a separate non-semantic envelope.

- [ ] **Step 5: Assert the real acceptance boundary**

The test must require:

```js
assert.equal(evidence.lifecycleState, 'VISIBLE')
assert.equal(evidence.canonicalMutation, false)
assert.ok(evidence.partialBytesRead > 0)
assert.ok(evidence.partialBytesRead < evidence.totalCarrierBytes)
assert.ok(evidence.residentFraction > 0 && evidence.residentFraction < 1)
```

For the canonical upstream 4096D validation fixture, additionally report observed upstream values without making them universal requirements:

```text
nodes                 = 72
dimension             = 4096
carrier               = HMBT1
logicalScale          = 32
spatializationId      = RCM_PP
full carrier bytes    = 286313
block-row-0 bytes     = 1272
observed fraction     ≈ 0.004443
```

- [ ] **Step 6: Add CI separation**

Default GitHub CI runs:

```bash
npm ci
npm run check
npm test
```

and MUST keep the real external-checkout test explicitly skipped unless a future CI environment installs the real HDSRC/MRMIC assets. CI must never set `HDSRC_TEST_STUB_RUNTIME=1` and then label the result as real-runtime evidence.

- [ ] **Step 7: Run closure regression and determinism replay**

```bash
npm ci
npm run check
npm test
PNCW_REAL_HDSRC=1 npm run test:built -- tests/integration/real-4096d.test.mjs
PNCW_REAL_HDSRC=1 npm run test:built -- tests/integration/real-4096d.test.mjs
```

Capture both real semantic evidence outputs and require byte-for-byte equality after excluding the explicitly non-semantic audit envelope.

- [ ] **Step 8: Write validation report and README claim boundary**

`docs/evidence/PNCW_CORE_MVP_VALIDATION_v0.1.md` must state exact test counts, commit SHA, Node version, upstream MRMIC commit, upstream HDSRC lineage/digests, real evidence SHA-256, negative-control outcomes, and this exact bounded claim:

> PNCW Core MVP implements a deterministic projection lifecycle and verified visibility commit over adapter-bounded external authorities, including a real read-only HDSRC→MRMIC vertical slice with partial materialization.

It must also state that GCM planning, ACR, CSPMF/APR, PHOSPHOR/HVAP actuation, canonical HDSRC writeback and full PNCW E2E remain outside this release.

- [ ] **Step 9: Final verification commit**

```bash
git add examples/vertical-slice tests/integration docs/evidence README.md .github/workflows/ci.yml
git commit -m "release: validate PNCW Core MVP vertical slice"
```

---

## Final Acceptance Checklist

Before calling the MVP complete, verify every box from the approved spec maps to evidence:

- [ ] Six v1 JSON Schemas exist and reject undeclared properties.
- [ ] Six v1 TypeScript contracts and fail-closed runtime assertions agree with schemas.
- [ ] RID/MID/VID/VCID are deterministic and exclude non-semantic timestamps.
- [ ] Every legal lifecycle transition is tested.
- [ ] `VERIFIED -> VISIBLE` is the only normal reveal path.
- [ ] Changed-valid source maps to `STALE_SOURCE`, retryable true.
- [ ] Malformed/tampered/structurally invalid materialization maps to `INTEGRITY_FAILURE`, retryable false.
- [ ] HDSRC read authority and MRMIC surface authority are independently tested.
- [ ] Mixed source/materialization/surface lineage maps to `VERSION_CONFLICT`.
- [ ] A metadata/digest rebinding negative control fails structural verification.
- [ ] Duplicate VCID does not create a second semantic visibility event.
- [ ] A cached verified result cannot blind-recommit after source change/restart evidence invalidation.
- [ ] Fake HDSRC and fake MRMIC pass reusable conformance.
- [ ] Real HDSRC/MRMIC adapter passes applicable conformance without duplicating upstream semantics.
- [ ] Real vertical slice reaches `VISIBLE` with `0 < ResidentFraction < 1`.
- [ ] Real semantic evidence replays byte-for-byte deterministically.
- [ ] README/report preserve the bounded Core MVP claim.
- [ ] `npm ci`, `npm run check`, and `npm test` are green on the final head.

## Execution Branch and Review Gates

Implementation begins from the approved `main` head by creating an isolated worktree/branch:

```bash
git worktree add ../PNCW-core-mvp -b workbench/core-mvp-v0.1 main
```

Each task is independently reviewable and should remain a separate commit. Do not squash intermediate RED/GREEN evidence into undocumented behavior changes during implementation. M8 begins only after M0–M7 fake/conformance tests are green.
