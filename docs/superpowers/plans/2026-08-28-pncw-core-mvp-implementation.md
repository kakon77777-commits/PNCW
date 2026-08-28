# PNCW Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable PNCW coordination kernel that resolves an externally authoritative HDSRC source, verifies a projection through independently owned HDSRC/MRMIC authorities, and atomically commits a logically complete result to visibility while allowing partial physical residency.

**Architecture:** PNCW is a thin TypeScript/Node orchestrator. It owns versioned contracts, deterministic identities, lifecycle, readiness, projection verification, visibility semantics and conformance; it does not own HDSRC canonical state, HMBT1 semantics, MRMIC Canvas truth or provider authority. Fake adapters prove the kernel first; the final vertical slice reuses MRMIC/NVCL Phase 14 `LocalProcessHdsrcProvider`, `materializeResolved()`, `createHdsrcMaterializationPortal(...)`, and `readPartialRelationBlockRow(...)` rather than duplicating upstream semantics.

**Tech Stack:** Node.js `>=22.5.0`, TypeScript `^5.8.3`, ESM, npm workspaces, Node test runner, JSON Schema validated with Ajv `^8.17.1`, SHA-256 from `node:crypto`, deterministic JSON canonicalization.

**Spec:** `docs/superpowers/specs/2026-08-28-pncw-core-mvp-design.md`

## Global Constraints

- Implement on `workbench/core-mvp-v0.1`, not directly on `main`.
- Strict TDD: each production behavior starts with a focused failing test, the expected RED is observed, then minimal production code is written.
- Node.js floor: `>=22.5.0`.
- TypeScript + ESM + npm workspaces.
- `tsc --noEmit` is the static gate; Node test runner is the runtime gate.
- All six core JSON Schemas use `additionalProperties: false`, including nested contract objects.
- PNCW exposes no canonical HDSRC mutation and no unrestricted Canvas mutation.
- HDSRC source-read authority and MRMIC surface-projection authority remain independent.
- Preserve `STALE_SOURCE != INTEGRITY_FAILURE` and upstream retryability semantics.
- `VERIFIED -> VISIBLE` is the only normal reveal transition.
- RID/MID/VID/VCID exclude wall-clock timestamps, PID, temp paths and non-semantic random values.
- `manifestDigest` hashes a canonical manifest payload excluding `manifestDigest` and audit-only fields.
- `verificationDigest` hashes a canonical verification payload excluding `verificationDigest` and audit-only fields.
- `VCID = H(RID, MID, VID, RevealMode)`.
- A visible root manifest may contain non-resident detail regions; an invalid root manifest may never become visible.
- Real HDSRC integration reuses MRMIC/NVCL Phase 14 instead of reimplementing JSONL process protocol or HMBT1 structural validation.
- Release claim remains `Projection Lifecycle + Verified Visibility Commit`; no full PNCW E2E claim.

---

## File Structure

```text
PNCW/
├─ README.md
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ .gitignore
├─ .github/workflows/ci.yml
├─ scripts/run-tests.mjs
├─ contracts/
│  ├─ projection-request/v1.schema.json
│  ├─ projection-manifest/v1.schema.json
│  ├─ readiness-result/v1.schema.json
│  ├─ verification-result/v1.schema.json
│  ├─ visibility-state/v1.schema.json
│  └─ error-envelope/v1.schema.json
├─ packages/
│  ├─ core/src/{contracts,validate,canonical,identity,lifecycle,errors,manifest,index}.ts
│  ├─ adapters/src/{types,hdsrc-port,mrmic-port,index}.ts
│  ├─ readiness/src/index.ts
│  ├─ verification/src/index.ts
│  ├─ visibility/src/index.ts
│  └─ conformance/src/index.ts
├─ adapters/
│  ├─ fake-hdsrc/src/index.ts
│  ├─ fake-mrmic/src/index.ts
│  └─ real-mrmic-hdsrc/src/index.ts
├─ examples/vertical-slice/src/{fake,real}.ts
├─ tests/{contracts,lifecycle,readiness,verification,visibility,conformance,integration,negative-controls}/
└─ docs/
   ├─ architecture/REAL_HDSRC_MRMIC_ADAPTER_v0.1.md
   └─ evidence/
      ├─ real-4096d-validation.schema.json
      └─ PNCW_CORE_MVP_VALIDATION_v0.1.md
```

The final `ProjectionManifestV1` is emitted only after a non-visible MRMIC surface descriptor/binding exists. Manifest assembly may begin earlier, but MID is computed only after `surfaceRefs` are populated; this avoids a mutable authoritative manifest without adding a seventh first-class contract.

---

### Task 1 — M0 Contract Foundation and Test Harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.github/workflows/ci.yml`, `scripts/run-tests.mjs`
- Create: `packages/core/package.json`, `packages/core/src/contracts.ts`, `packages/core/src/validate.ts`, `packages/core/src/index.ts`
- Create: six `contracts/*/v1.schema.json`
- Test: `tests/contracts/contracts.test.mjs`

**Produces:** six v1 TypeScript contracts, shared types, six closed JSON Schemas, runtime assertions.

- [ ] **Step 1: Add only configuration needed to execute RED tests**

`package.json`:

```json
{
  "name": "pncw-core-mvp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.5.0" },
  "workspaces": ["packages/*", "adapters/*", "examples/*"],
  "scripts": {
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

`tsconfig.json`:

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
    "skipLibCheck": true
  },
  "include": ["packages/**/*.ts", "adapters/**/*.ts", "examples/**/*.ts"]
}
```

`.gitignore`:

```text
node_modules/
dist/
.env
.env.*
*.log
.DS_Store
```

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
  pull_request:
jobs:
  core:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
```

`scripts/run-tests.mjs`:

```js
import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collect(path))
    else if (entry.name.endsWith('.test.mjs')) files.push(path)
  }
  return files.sort()
}

const requested = process.argv.slice(2)
const files = requested.length ? requested.map(resolve) : await collect('tests')
const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' })
child.on('exit', code => { process.exitCode = code ?? 1 })
```

- [ ] **Step 2: Write the failing contract test**

`tests/contracts/contracts.test.mjs` validates each schema with Ajv and one positive/negative fixture. Projection request fixture:

```js
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
```

The test imports `assertProjectionRequest` from `dist/packages/core/src/index.js`, requires the valid fixture to round-trip, and requires `{...validRequest, injected:true}` to fail in both JSON Schema and runtime assertion.

- [ ] **Step 3: Run RED**

```bash
npm install
npm run build
npm run test:built -- tests/contracts/contracts.test.mjs
```

Expected: FAIL because core contracts/assertions do not exist.

- [ ] **Step 4: Implement exact shared types and six contracts**

Core shared types include:

```ts
export type ObservationMode = 'human_preview' | 'machine_carrier' | 'structured_manifest'
export type RevealMode = 'ATOMIC_ARTIFACT' | 'SEMANTIC_BATCH' | 'STREAM' | 'HYBRID'
export type ResidencyState = 'DECLARED' | 'AVAILABLE' | 'RESIDENT' | 'UNAVAILABLE' | 'INVALID'
export type PncwStage = 'request' | 'resolve' | 'readiness' | 'project' | 'verify' | 'visibility'
export type PncwErrorSource = 'pncw' | 'hdsrc' | 'mrmic'

export interface AuthorityContextV1 {
  principalId: string
  sourceRead: boolean
  surfaceProject: boolean
}

export interface SourceIdentityV1 {
  authority: string
  sourceId: string
  revision: number
  digest: string
}

export interface CheckResultV1 {
  name: string
  passed: boolean
  code?: PncwErrorCode
  detail?: string
}
```

`LifecycleState`:

```ts
export type LifecycleState =
  | 'REQUESTED' | 'RESOLVED' | 'READY' | 'PROJECTED' | 'VERIFIED' | 'VISIBLE'
  | 'STALE' | 'INTEGRITY_FAILURE' | 'UNAUTHORIZED' | 'UNSUPPORTED'
  | 'UNAVAILABLE' | 'CONFLICT' | 'ABORTED' | 'SUPERSEDED'
```

`PncwErrorCode`:

```ts
export type PncwErrorCode =
  | 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'UNSUPPORTED' | 'SOURCE_UNAVAILABLE'
  | 'STALE_SOURCE' | 'INTEGRITY_FAILURE' | 'MATERIALIZATION_FAILED'
  | 'SURFACE_UNAVAILABLE' | 'VERSION_CONFLICT' | 'VERIFICATION_FAILED'
  | 'INVALID_TRANSITION' | 'ALREADY_VISIBLE' | 'ABORTED'
```

Six schema IDs are exactly:

```text
pncw-projection-request/v1
pncw-projection-manifest/v1
pncw-readiness-result/v1
pncw-verification-result/v1
pncw-visibility-state/v1
pncw-error/v1
```

All digests match `^sha256:[0-9a-f]{64}$`. Validators reject rather than strip undeclared fields.

- [ ] **Step 5: Run GREEN**

```bash
npm run check
npm run test:built -- tests/contracts/contracts.test.mjs
```

- [ ] **Step 6: Commit M0**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .github scripts contracts packages/core tests/contracts
git commit -m "feat: establish PNCW v1 contract foundation"
```

---

### Task 2 — M1 Deterministic Identity, Typed Errors and Lifecycle

**Files:**
- Create: `packages/core/src/canonical.ts`, `identity.ts`, `errors.ts`, `lifecycle.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/lifecycle/core-lifecycle.test.mjs`

**Produces:** `canonicalJson`, `sha256Digest`, `deriveResultId`, `deriveManifestDigest`, `deriveVerificationDigest`, `deriveVisibilityCommitId`, `PncwError`, `assertTransition`.

- [ ] **Step 1: Write RED tests**

Tests require key-order-independent canonical hashes; RID stability for identical semantic inputs; MID stability when only excluded audit fields change; VID stability; VCID stability across different `visibleAt`; and illegal `READY/PROJECTED -> VISIBLE` rejection.

Use a complete valid `ProjectionManifestV1` fixture; do not test digest functions with schema-invalid placeholder objects.

- [ ] **Step 2: Run RED**

```bash
npm run build
npm run test:built -- tests/lifecycle/core-lifecycle.test.mjs
```

- [ ] **Step 3: Implement canonicalization and IDs**

`canonicalJson` recursively sorts object keys, preserves array order, rejects cycles, `undefined`, functions, symbols and non-finite numbers. `sha256Digest` returns lowercase `sha256:<64 hex>`.

Public signatures:

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

Prefixes:

```text
RID  pncw:result:<hex>
MID  sha256:<hex>
VID  sha256:<hex>
VCID pncw:visibility:<hex>
```

- [ ] **Step 4: Implement error and transition machine**

Normal transitions:

```text
REQUESTED -> RESOLVED -> READY -> PROJECTED -> VERIFIED -> VISIBLE -> SUPERSEDED
```

`VERIFIED -> SUPERSEDED` is also legal when freshness invalidates before reveal. Any pre-visible state may terminate in `STALE`, `INTEGRITY_FAILURE`, `UNAUTHORIZED`, `UNSUPPORTED`, `UNAVAILABLE`, `CONFLICT` or `ABORTED`. Terminal failure states have no outgoing transitions.

- [ ] **Step 5: GREEN + regression**

```bash
npm run check
npm test
```

- [ ] **Step 6: Commit M1**

```bash
git add packages/core tests/lifecycle
git commit -m "feat: add deterministic PNCW identity and lifecycle"
```

---

### Task 3 — M2 Adapter Ports and Deterministic Fake Authorities

**Files:**
- Create: `packages/adapters/package.json`, `packages/adapters/src/{types,hdsrc-port,mrmic-port,index}.ts`
- Create: `adapters/fake-hdsrc/package.json`, `adapters/fake-hdsrc/src/index.ts`
- Create: `adapters/fake-mrmic/package.json`, `adapters/fake-mrmic/src/index.ts`
- Test: `tests/conformance/fake-adapters.test.mjs`

**Produces:** provider-neutral ports and fake implementations.

Exact descriptor contracts:

```ts
export interface SourceCapabilitiesV1 {
  providerVersion: string
  observationModes: ObservationMode[]
  carrierProfiles: string[]
  partialRead: boolean
  canonicalMutation: false
}

export interface SurfaceCapabilitiesV1 {
  providerVersion: string
  observationModes: ObservationMode[]
  readOnlyProjection: boolean
  canonicalMutation: false
}

export interface MaterializationDescriptorV1 {
  materializationId: string
  sourceIdentity: SourceIdentityV1
  materializationDigest: string
  carrierProfile: string
  spatializationId: string
  logicalScale: number
  machineResourceUri: string
  previewResourceUri: string
  totalCarrierBytes: number
  integrity: {
    metadataVerified: boolean
    structuralVerified: boolean
    verifierRef: string
  }
}

export interface PrepareSurfaceInputV1 {
  resultId: string
  sourceIdentity: SourceIdentityV1
  materializationId: string
  mode: ObservationMode
  observerId: string
}

export interface SurfaceDescriptorV1 {
  surfaceId: string
  authority: 'mrmic'
  providerVersion: string
  readOnly: true
  status: 'prepared' | 'bound' | 'unavailable'
}

export interface SurfaceBindingV1 {
  surfaceId: string
  sourceIdentity: SourceIdentityV1
  materializationId: string
  materializationDigest: string
  mode: ObservationMode
}

export interface RegionReadV1 {
  regionRef: string
  bytesRead: number
  totalCarrierBytes: number
  digest: string
}
```

Exact ports:

```ts
export interface HdsrcSourcePort {
  getCapabilities(context: AuthorityContextV1): Promise<SourceCapabilitiesV1>
  resolveSource(sourceRef: string, context: AuthorityContextV1): Promise<SourceIdentityV1>
  resolveMaterialization(request: ProjectionRequestV1, source: SourceIdentityV1, context: AuthorityContextV1): Promise<MaterializationDescriptorV1>
  checkFreshness(source: SourceIdentityV1, materialization: MaterializationDescriptorV1, context: AuthorityContextV1): Promise<CheckResultV1>
  checkAuthority(source: SourceIdentityV1, context: AuthorityContextV1): Promise<CheckResultV1>
  readSelectedRegion(materialization: MaterializationDescriptorV1, regionRef: string, context: AuthorityContextV1): Promise<RegionReadV1>
}

export interface MrmicSurfacePort {
  getCapabilities(context: AuthorityContextV1): Promise<SurfaceCapabilitiesV1>
  prepareSurface(input: PrepareSurfaceInputV1, context: AuthorityContextV1): Promise<SurfaceDescriptorV1>
  bindProjection(surface: SurfaceDescriptorV1, materialization: MaterializationDescriptorV1, context: AuthorityContextV1): Promise<SurfaceBindingV1>
  surfaceState(surfaceId: string, context: AuthorityContextV1): Promise<SurfaceDescriptorV1>
  checkProjectionAuthority(surface: SurfaceDescriptorV1, context: AuthorityContextV1): Promise<CheckResultV1>
}
```

- [ ] **Step 1: Write RED conformance tests** covering independent grants, supported modes, no mutation capability, stale/integrity fault injection, exact surface lineage and partial-byte accounting.
- [ ] **Step 2: Run RED:** `npm run build && npm run test:built -- tests/conformance/fake-adapters.test.mjs`.
- [ ] **Step 3: Implement fakes** with deterministic defaults: state `state:demo-4096`, revision `12`, HMBT1 logical scale `32`, `RCM_PP`, total carrier `286313`, partial row `1272`, `canonicalMutation=false`.
- [ ] **Step 4: GREEN:** `npm run check && npm test`.
- [ ] **Step 5: Commit:** `git commit -m "feat: define PNCW adapter ports and fake authorities"`.

---

### Task 4 — M2 Projection Readiness Gate

**Files:**
- Create: `packages/readiness/package.json`, `packages/readiness/src/index.ts`
- Test: `tests/readiness/readiness.test.mjs`

**Produces:**

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

- [ ] **Step 1: Write RED tests** for happy path, HDSRC authority denied, unsupported mode, changed-valid source => `STALE_SOURCE/retryable=true`, structurally invalid materialization => `INTEGRITY_FAILURE/retryable=false`, and proof that MRMIC authority cannot compensate missing HDSRC authority.
- [ ] **Step 2: Run RED:** `npm run build && npm run test:built -- tests/readiness/readiness.test.mjs`.
- [ ] **Step 3: Implement exact evaluation order:** validate request -> source capabilities -> surface capabilities -> mode compatibility -> resolve source -> source authority -> resolve materialization -> freshness -> scope bound -> projection-profile/frame validity -> required integrity evidence present -> READY. Do not call `prepareSurface()` here.
- [ ] **Step 4: GREEN:** `npm run check && npm test`.
- [ ] **Step 5: Commit:** `git commit -m "feat: implement projection readiness gate"`.

---

### Task 5 — M3 Surface Binding and Immutable Manifest Assembly

**Files:**
- Create: `packages/core/src/manifest.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/integration/manifest-assembly.test.mjs`

**Produces:** `buildProjectionManifest(input): ProjectionManifestV1`, `freezeProjectionManifest(manifest)`.

- [ ] **Step 1: Write RED test:** ready result -> fake `prepareSurface()` -> `bindProjection()` -> manifest build. Assert exact source/materialization/surface lineage, deterministic RID/MID, detail regions initially `DECLARED/AVAILABLE`, and different source revision => different RID/MID. A surface binding at revision 13 against source/materialization revision 12 must return `VERSION_CONFLICT`.
- [ ] **Step 2: Run RED:** `npm run build && npm run test:built -- tests/integration/manifest-assembly.test.mjs`.
- [ ] **Step 3: Implement assembly:** accept only `ready:true`; derive RID; copy exact authority/lineage refs; set residency map without reading carrier bytes; reject mixed version before finalization; compute MID after surface refs exist; store `manifestDigest=MID`; deep-freeze semantic manifest.
- [ ] **Step 4: GREEN:** `npm run check && npm test`.
- [ ] **Step 5: Commit:** `git commit -m "feat: assemble immutable projection manifests"`.

---

### Task 6 — M3 Projection Verifier and Structural Fail-Closed Semantics

**Files:**
- Create: `packages/verification/package.json`, `packages/verification/src/index.ts`
- Test: `tests/verification/verification.test.mjs`
- Test: `tests/negative-controls/{rebinding,mixed-version}.test.mjs`

**Produces:** `ProjectionVerifier.verify(manifest, ports, authorityContext): Promise<VerificationResultV1>`.

Required named checks:

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

- [ ] **Step 1: Write RED verifier tests.** Rebinding control recomputes a self-consistent replacement materialization digest and MID while `integrity.structuralVerified=false`; metadata agreement must not authorize the carrier.
- [ ] **Step 2: Run RED:** `npm run build && npm run test:built -- tests/verification/verification.test.mjs tests/negative-controls/rebinding.test.mjs tests/negative-controls/mixed-version.test.mjs`.
- [ ] **Step 3: Implement verifier:** recompute MID; re-check freshness at verification time; independently re-check source and surface authority; require exact lineage; require both `metadataVerified` and authoritative `structuralVerified`; never decode HMBT1 in PNCW; fail closed on stale/integrity/version/authority errors; compute and store VID only after all semantic checks are assembled.
- [ ] **Step 4: GREEN:** `npm run check && npm test`.
- [ ] **Step 5: Commit:** `git commit -m "feat: verify projection lineage fail closed"`.

---

### Task 7 — M4 Idempotent Visibility Commit and Residency

**Files:**
- Create: `packages/visibility/package.json`, `packages/visibility/src/index.ts`
- Test: `tests/visibility/visibility.test.mjs`

**Produces:** `VisibilityCommit`, `InMemoryVisibilityStore`, `VisibilityReceiptV1`.

Entry point:

```ts
commit(input: {
  manifest: ProjectionManifestV1
  verification: VerificationResultV1
  lifecycleState: 'VERIFIED'
  revealMode: RevealMode
  visibleAt: string
}): VisibilityStateV1
```

- [ ] **Step 1: Write RED tests** for READY/PROJECTED reveal rejection, failed verification rejection, valid VERIFIED reveal, duplicate VCID idempotency, VCID independent of `visibleAt`, root `INVALID` blocking reveal, and non-root `DECLARED/AVAILABLE` remaining legal while VISIBLE.
- [ ] **Step 2: Run RED:** `npm run build && npm run test:built -- tests/visibility/visibility.test.mjs`.
- [ ] **Step 3: Implement store:** persist only semantic visibility records, never source bytes; derive VCID from RID/MID/VID/reveal mode; duplicate VCID returns original semantic record without adding an event; `markSuperseded(resultId, supersedingResultId)` only transitions VISIBLE -> SUPERSEDED and never rewrites the original manifest.
- [ ] **Step 4: GREEN:** `npm run check && npm test`.
- [ ] **Step 5: Commit:** `git commit -m "feat: add verified atomic visibility commit"`.

---

### Task 8 — M5/M7 Reusable Conformance, Fake Vertical Slice and Negative-Control Closure

**Files:**
- Create: `packages/conformance/package.json`, `packages/conformance/src/index.ts`
- Create: `examples/vertical-slice/package.json`, `examples/vertical-slice/src/fake.ts`
- Test: `tests/conformance/core-conformance.test.mjs`
- Test: `tests/integration/fake-vertical-slice.test.mjs`
- Test: `tests/negative-controls/{restart,visibility-shortcut}.test.mjs`

**Produces:** `runHdsrcPortConformance`, `runMrmicPortConformance`, `runCoreLifecycleConformance`, `runFakeVerticalSlice`.

- [ ] **Step 1: Write RED E2E test** implementing request -> readiness -> prepare/bind surface -> final manifest -> PROJECTED -> verify -> VERIFIED -> visibility commit -> VISIBLE -> selected relation read.

Final assertions:

```js
assert.equal(result.visibility.state, 'VISIBLE')
assert.ok(result.partialBytesRead > 0)
assert.ok(result.partialBytesRead < result.totalCarrierBytes)
assert.ok(result.residentFraction > 0 && result.residentFraction < 1)
assert.equal(result.semanticVisibilityEvents, 1)
```

Restart control creates a fresh adapter with stable lineage and requires re-resolution/reverification before commit; a changed revision invalidates cached verification and blocks blind recommit.

- [ ] **Step 2: Run RED:** `npm run build && npm run test:built -- tests/conformance/core-conformance.test.mjs tests/integration/fake-vertical-slice.test.mjs tests/negative-controls/restart.test.mjs tests/negative-controls/visibility-shortcut.test.mjs`.
- [ ] **Step 3: Implement reusable conformance runners** with no fake-specific branches, then implement `runFakeVerticalSlice()` as the minimal orchestrating example.
- [ ] **Step 4: GREEN full fake closure:** `npm run check && npm test`.
- [ ] **Step 5: Commit:** `git commit -m "feat: close fake PNCW vertical slice conformance"`.

M6 must not begin until this task is green.

---

### Task 9 — M6 Real MRMIC/HDSRC Adapter Reusing Phase 14

**Files:**
- Create: `adapters/real-mrmic-hdsrc/package.json`, `adapters/real-mrmic-hdsrc/src/index.ts`
- Test: `tests/integration/real-adapter-contract.test.mjs`
- Create: `docs/architecture/REAL_HDSRC_MRMIC_ADAPTER_v0.1.md`

**Produces:** `RealHdsrcMrmicAdapter.open(config)` implementing the two PNCW ports through external MRMIC modules.

Required config:

```ts
export interface RealAdapterConfig {
  mrmicRoot: string
  pythonExecutable: string
  hostScript: string
  registry: string
  profileRoot: string
  materializationRoot: string
  stateRef: string
  principalId: string
  cwd?: string
  timeoutMs?: number
}
```

- [ ] **Step 1: Write RED contract test using a temporary external-module fixture.** Prove dynamic import by file URL, use of upstream `LocalProcessHdsrcProvider`, use of upstream `createHdsrcMaterializationPortal`, exact stale/integrity mapping, and absence of canonical mutation methods.
- [ ] **Step 2: Run RED:** `npm run build && npm run test:built -- tests/integration/real-adapter-contract.test.mjs`.
- [ ] **Step 3: Implement dynamic external composition.** Import:

```text
<mrmicRoot>/dist/packages/provider-hdsrc/src/index.js
<mrmicRoot>/dist/packages/provider-hdsrc/src/local-process.js
```

Instantiate upstream:

```ts
new LocalProcessHdsrcProvider({
  executable: config.pythonExecutable,
  hostScript: config.hostScript,
  registry: config.registry,
  profileRoot: config.profileRoot,
  materializationRoot: config.materializationRoot,
  cwd: config.cwd,
  timeoutMs: config.timeoutMs
})
```

Use upstream `materializeResolved(...)` for HPCM2/HMR1 resolution. Before setting `structuralVerified=true`, force an upstream machine-resource read so Phase 14 performs its own HMBT1 structural validation. Use upstream `readPartialRelationBlockRow(materializationRef, blockRow, accessContext)` for region reads. Use upstream `createHdsrcMaterializationPortal(...)` for the read-only `native_resource_portal_v1` surface. Do not copy the JSONL protocol, Python host or HMBT1 decoder into PNCW.

- [ ] **Step 4: GREEN:** `npm run check && npm test`.
- [ ] **Step 5: Commit:** `git commit -m "feat: bridge PNCW to MRMIC HDSRC Phase 14"`.

---

### Task 10 — M8 Real 4096D Reference Demo, Evidence and Release Closure

**Files:**
- Create: `examples/vertical-slice/src/real.ts`
- Test: `tests/integration/real-4096d.test.mjs`
- Create: `docs/evidence/real-4096d-validation.schema.json`
- Create: `docs/evidence/PNCW_CORE_MVP_VALIDATION_v0.1.md`
- Create: `README.md`
- Modify: `.github/workflows/ci.yml`

**Produces:** deterministic real semantic evidence JSON and public validation report.

- [ ] **Step 1: Write RED real-integration test with explicit skip contract.** The test runs only when `PNCW_REAL_HDSRC=1`; otherwise it emits a named skip, never a fake pass. When enabled, missing external paths or unbuilt MRMIC fail immediately.
- [ ] **Step 2: Preflight external MRMIC checkout:** `npm ci`, `npm run check`, `npm test`, `npm run build`. Real validation requires `HDSRC_TEST_STUB_RUNTIME` absent.
- [ ] **Step 3: Run RED real test:** `PNCW_REAL_HDSRC=1 npm run build && PNCW_REAL_HDSRC=1 npm run test:built -- tests/integration/real-4096d.test.mjs`. Expected: FAIL because `runRealVerticalSlice` is absent.
- [ ] **Step 4: Implement exact real lifecycle:** resolve real state -> `materializeResolved` -> upstream machine structural validation -> create MRMIC read-only portal -> PNCW readiness -> final manifest/MID -> PNCW verification/VID -> PNCW visibility/VCID -> `readPartialRelationBlockRow(blockRow=0)` -> compute resident fraction -> emit semantic evidence.

Evidence records:

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

- [ ] **Step 5: Assert real acceptance:** `VISIBLE`, `canonicalMutation=false`, `0 < partialBytesRead < totalCarrierBytes`, `0 < residentFraction < 1`.

For the canonical upstream 4096D fixture, report but do not universalize:

```text
nodes              72
dimension          4096
carrier            HMBT1
logicalScale       32
spatializationId   RCM_PP
full bytes         286313
block-row-0 bytes  1272
fraction           ≈ 0.004443
```

- [ ] **Step 6: Keep default CI asset-independent.** CI runs `npm ci`, `npm run check`, `npm test`; the real external-checkout test remains an explicit skip unless a future CI job provisions real assets. A stub run may never be labeled real-runtime evidence.
- [ ] **Step 7: Run closure regression and real determinism replay twice.** Semantic evidence must be byte-for-byte identical after excluding the explicitly non-semantic audit envelope.
- [ ] **Step 8: Write validation report and README.** Report exact test counts, final PNCW commit, Node version, MRMIC commit, HDSRC lineage anchors, evidence SHA-256, all negative-control outcomes, and this bounded claim:

> PNCW Core MVP implements a deterministic projection lifecycle and verified visibility commit over adapter-bounded external authorities, including a real read-only HDSRC→MRMIC vertical slice with partial materialization.

Also state that GCM planning, ACR, CSPMF/APR, PHOSPHOR/HVAP, canonical HDSRC writeback and full PNCW E2E are outside this release.

- [ ] **Step 9: Commit release evidence:** `git commit -m "release: validate PNCW Core MVP vertical slice"`.

---

## Final Acceptance Checklist

- [ ] Six closed v1 JSON Schemas exist and agree with runtime assertions.
- [ ] RID/MID/VID/VCID are deterministic and exclude audit-only metadata.
- [ ] Every legal lifecycle transition is tested.
- [ ] `VERIFIED -> VISIBLE` is the only normal reveal path.
- [ ] Changed-valid source => `STALE_SOURCE`, retryable true.
- [ ] Malformed/tampered/structurally invalid carrier => `INTEGRITY_FAILURE`, retryable false.
- [ ] HDSRC read authority and MRMIC surface authority remain independent.
- [ ] Mixed lineage => `VERSION_CONFLICT`.
- [ ] Metadata/digest rebinding cannot pass without provider structural verification.
- [ ] Duplicate VCID produces one semantic visibility event.
- [ ] No blind recommit after restart/source change.
- [ ] Fake adapters pass reusable conformance.
- [ ] Real adapter passes applicable conformance without duplicating upstream semantics.
- [ ] Real vertical slice proves `VISIBLE` with `0 < ResidentFraction < 1`.
- [ ] Real semantic evidence replays deterministically.
- [ ] README/report preserve the bounded claim.
- [ ] Final `npm ci`, `npm run check`, `npm test` are green.

## Execution Branch and Review Gates

At execution time create an isolated worktree from the approved `main` head:

```bash
git worktree add ../PNCW-core-mvp -b workbench/core-mvp-v0.1 main
```

Each task ends in an independently reviewable commit. M6 real integration begins only after all fake/core M0–M5/M7 checks are green. A later milestone may not compensate for an earlier broken invariant.
