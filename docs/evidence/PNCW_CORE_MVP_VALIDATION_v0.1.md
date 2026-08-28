# PNCW Core MVP v0.1 — Final Validation Report

**Date:** 2026-08-29 (Asia/Taipei)  
**Repository:** `kakon77777-commits/PNCW`  
**PR:** `#1 — PNCW Core MVP v0.1 — projection lifecycle and verified visibility commit`  
**Validated pre-report implementation head:** `bd948fe3e977cc8d5a553e7a1e81abf52d59ae0b`  
**Final validation workflow before this documentation-only seal:** `33195259884`  
**Scope:** `Projection Lifecycle + Verified Visibility Commit`

---

## 1. Closure result

**PNCW Core MVP v0.1 = PASS for the declared Core MVP scope.**

The validated implementation closes:

\[
\boxed{
\text{ProjectionRequest}
\rightarrow
\text{Readiness}
\rightarrow
\text{Non-visible Surface}
\rightarrow
\text{Manifest}
\rightarrow
\text{Verification}
\rightarrow
\text{Visibility Commit}
\rightarrow
\text{VISIBLE}
}
\]

while preserving:

\[
\boxed{Ready\neq Projected\neq Verified\neq Visible}
\]

\[
\boxed{Visible\neq Resident}
\]

The release claim is limited to:

\[
\boxed{
\text{Projection Lifecycle}
+
\text{Verified Visibility Commit}
}
\]

It does **not** claim full PNCW Paper 00–08 perception/cognition/actuation closure.

---

## 2. Evidence classes remain separate

Validation deliberately keeps three evidence layers distinct.

### Layer A — PNCW Core runtime / conformance

Validates:

- six versioned Draft 2020-12 JSON contracts;
- closed top-level and relevant nested contract objects;
- deterministic RID / MID / VID / VCID;
- lifecycle transitions;
- readiness ordering;
- independent source and surface authority;
- immutable manifest construction;
- fresh verification;
- live-proof-bound visibility commit;
- idempotent VCID;
- partial residency after logical visibility;
- negative controls for stale/integrity/mixed-version/rebinding/restart.

### Layer B — Fresh canonical HDSRC v0.10 execution

A fresh local run used the canonical HDSRC v0.10 release and canonical 4096D HDS1 fixture, then fed the resulting materialization/partial-read evidence into the PNCW lifecycle.

### Layer C — Actual MRMIC/NVCL checkout compatibility

GitHub Actions checks out actual `kakon77777-commits/MRMIC_NVCL@main`, installs/builds it, and executes the PNCW external-checkout gate against its compiled Phase 14 exports.

Therefore:

\[
\boxed{
\text{Fresh HDSRC + PNCW execution}
\neq
\text{Actual MRMIC checkout compatibility gate}
}
\]

The current MVP does **not** claim one fresh same-process HDSRC + MRMIC + PNCW three-system execution.

---

## 3. Final dependency/security freeze

Final dependency policy:

```text
Node.js >= 22.5.0
CI Node = 22.5.1
npm = 10.8.2
TypeScript = 5.8.3
Ajv = 8.18.0
install = npm ci --ignore-scripts
```

Ajv was upgraded from 8.17.1 to patched 8.18.0 before closure. Final CI runs:

```text
npm audit --audit-level=moderate
```

Result:

```text
found 0 vulnerabilities
```

The CI-generated Ajv-8.18.0 lockfile used for the dependency freeze had SHA-256:

```text
b6b0d6533b2d38cdb4b9c3474f561d52047d70736848e9a33b9966fdb03d15c4
```

---

## 4. Contract-schema hardening closure

Final PR self-review found one important contract-evidence mismatch: top-level schemas were closed, but several nested readiness/verification objects were still generic JSON objects while the TypeScript/runtime contracts were strict.

The affected shapes were:

- `readiness-result.capabilitySnapshot.source`;
- `readiness-result.capabilitySnapshot.surface`;
- `readiness-result.blockingError`;
- `verification-result.failure`.

This was repaired with a strict TDD cycle rather than by weakening Ajv.

### RED

Commit:

```text
39bdb6040c22b9c981966add47f0f19b2510d315
```

Workflow:

```text
33195165091
```

Result:

```text
46 tests
43 PASS
1 FAIL
2 SKIP
```

The only failure was the intentionally new assertion:

```text
source capability snapshot must reject unknown nested field
```

All pre-existing runtime behaviors remained green.

### GREEN

Schema fixes:

```text
6f542263c3f20f058d081760527abc117ee870d5 — close nested readiness objects
bd948fe3e977cc8d5a553e7a1e81abf52d59ae0b — close verification failure object
```

Final pre-report validation workflow:

```text
33195259884
```

Both jobs passed.

This closes the claim that the six Core contracts are validated with strict Draft 2020-12 schemas and fail closed on undeclared fields at the modeled nested boundaries.

---

## 5. Final GitHub Actions results

Workflow:

```text
PNCW Core MVP CI
```

Run:

```text
33195259884
head: bd948fe3e977cc8d5a553e7a1e81abf52d59ae0b
```

### 5.1 Core conformance — PASS

Gates:

```text
npm ci --ignore-scripts
npm audit --audit-level=moderate
npm run check
npm test
```

Result:

```text
TypeScript check: PASS
Ajv Draft 2020-12 strict validation: PASS
all-six positive contract fixtures: PASS
nested contract closedness: PASS
dependency audit: 0 vulnerabilities
46 tests
44 PASS
0 FAIL
2 SKIP
```

The two intentional Core-job skips are environment-specific:

1. actual MRMIC checkout test — executed in the second CI job;
2. fresh-HDSRC-in-CI test — the canonical HDSRC release is not stored in the PNCW repository and is backed by separate fresh execution evidence.

### 5.2 Actual MRMIC Phase 14 checkout gate — PASS

Actual checkout:

```text
repository: kakon77777-commits/MRMIC_NVCL
ref: main
commit: 1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b
```

MRMIC/NVCL:

```text
npm ci: PASS
npm run check: PASS
npm run build: PASS
npm audit/install result: 0 vulnerabilities
```

PNCW then ran with:

```text
PNCW_MRMIC_DIST_ROOT=<actual MRMIC checkout>/dist
```

Result:

```text
46 tests
45 PASS
0 FAIL
1 SKIP
```

The actual external-checkout test executed and passed:

```text
actual MRMIC checkout exports Phase 14 local-process provider and portal factory — PASS
```

The only remaining skip is fresh-HDSRC-in-CI.

---

## 6. Fresh HDSRC v0.10 4096D evidence

Committed artifact:

```text
artifacts/real-4096d-validation.json
```

Raw artifact SHA-256:

```text
dffeaf70a76c054c6e0da777feec5f1e297d97c1bca57777e4f2c6b97e849208
```

Embedded semantic evidence digest:

```text
sha256:8eb4c800332a80990bb7623cac4a8df84483fe0687c2e44715edca4dfec7487b
```

Canonical HDSRC v0.10 release ZIP SHA-256:

```text
583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217
```

Canonical 4096D HDS1 digest:

```text
sha256:ea48a90eddc727b1684cf72204ddeaa720c6b67fe036561e05537622b0c12f85
```

Decoded source:

```text
dimension = 4096
nodes = 72
relations = 576
revision = 10
```

Real HPCM2:

```text
decision = oracle_fallback
requiresOracle = true
reason = outside_current_trust_region
```

HMR1/HMBT1 resolution:

```text
carrier = HMBT1
logicalScale = 32
spatializationId = RCM_PP
carrierBytes = 286313
materializationDigest = sha256:4127f98f00cca7d85d2975e13186a2373814dbe0b53d611cf74215695e9e6c5b
```

Partial relation block-row:

```text
compressedBytesRead = 1272
carrierBytes = 286313
relations = 256
```

Thus:

\[
\frac{1272}{286313}\approx0.004443
\]

or approximately **0.444%** of the full carrier byte count for this validated workload.

This is a workload-specific executable result, not a universal scaling claim.

---

## 7. Atomic visibility evidence

The committed fresh evidence records:

```text
resultId = pncw:result:096296cee4e33f565198c658c60fe78f7881437916fe807dfd3b7f6ca5bd1f8f
manifestDigest = sha256:c8d2ad40603774629d147624efa2ba748b822830488b10acdc1ab616c36eb28d
verificationDigest = sha256:7948a833d6a6701cd8152966924a917ed212c9770f7f51227d26546c1453ce62
visibilityCommitId = pncw:visibility:d7f9330b84ca08287beba7f6bbffa5c1220bcda709b5ba92c0d796464fa2bafb
visibilityState = VISIBLE
semanticVisibilityEvents = 1
residentFraction = 0.0000034926688880040796
```

Therefore this MVP contains an executable instance of:

\[
\boxed{
Visible=1
\land
ResidentFraction<1
}
\]

without claiming physical O(1) output.

---

## 8. Negative-control closure

The final suite passes controls for:

- unknown top-level contract fields;
- unknown modeled nested readiness/verification fields;
- illegal lifecycle shortcuts;
- `READY -> VISIBLE` rejection;
- `PROJECTED -> VISIBLE` rejection;
- source-read denial before protected resolution;
- independent surface authority;
- unsupported observation mode;
- retryable stale source;
- non-retryable structural integrity failure;
- mixed source/materialization/surface lineage;
- wrong manifest digest;
- invalid root residency;
- provider structural failure despite self-consistent metadata;
- full metadata/digest rebinding against canonical carrier semantics;
- serialized cached `VERIFIED` JSON blind-recommit prevention;
- provider restart requiring re-resolution/reverification;
- source becoming stale after assembly;
- duplicate VCID idempotency;
- `visibleAt` exclusion from VCID identity.

Two hardening tests also found real implementation defects during development:

1. full metadata rebinding was initially accepted by the fake structural verifier;
2. serialized cached verification data could initially blind recommit.

Both were fixed before final closure.

---

## 9. Authority boundary

The validated runtime preserves:

\[
\boxed{
\text{HDSRC Source Authority}
\neq
\text{MRMIC Surface Authority}
\neq
\text{PNCW Visibility Authority}
}
\]

PNCW does not expose or invent:

- canonical HDSRC mutation;
- unrestricted MRMIC Canvas mutation;
- provider authorization;
- world mutation commit.

The real adapter delegates HDSRC materialization and partial-read semantics to the Phase 14-compatible provider surface rather than reimplementing HMBT1 semantics inside PNCW.

---

## 10. MRMIC evidence boundary

The fresh 4096D execution deliberately records:

```text
mrmic.mode = source-grounded-portal-factory
mrmic.actualCheckoutExecuted = false
```

That fresh run therefore does not impersonate an actual MRMIC checkout.

Separately, CI run `33195259884` checked out and built actual:

```text
MRMIC_NVCL/main@1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b
```

and the external Phase 14 compatibility gate passed.

The correct engineering claim is:

\[
\boxed{
\text{Fresh HDSRC + PNCW execution}
+
\text{Actual MRMIC checkout compatibility}
}
\]

not a fresh same-process three-system E2E claim.

---

## 11. What this MVP proves

For the declared Core scope, PNCW can:

1. keep canonical source/surface authority outside PNCW;
2. readiness-check before surface preparation;
3. bind a non-visible surface;
4. assemble deterministic immutable result/manifest identity;
5. independently re-check source/materialization/surface lineage;
6. require a live non-serializable verification proof for visibility promotion;
7. atomically promote a verified root manifest to observer-visible authority;
8. remain idempotent under duplicate VCID commit;
9. remain logically visible while detail regions are not fully resident;
10. preserve stale/integrity distinctions;
11. remain compatible with actual MRMIC Phase 14 exports;
12. enforce closed contract schemas consistent with runtime types at modeled boundaries.

---

## 12. Explicit non-claims

This report does not establish:

- full PNCW perception–cognition–actuation closure;
- GCM dynamic planning integration;
- ACR ActiveCognitiveDomain integration;
- CSPMF/APR perception routing;
- PHOSPHOR/HVAP actuation;
- canonical HDSRC writeback;
- Canvas pixel edit -> HDSRC symbolic mutation;
- production multi-tenant security certification;
- universal HDSRC performance superiority;
- fresh same-process HDSRC + MRMIC + PNCW three-system E2E;
- replacement of autoregressive computation;
- physical O(1) output.

---

## 13. Final closure matrix

```text
Six v1 contracts                    PASS
Draft 2020-12 strict schemas        PASS
Modeled nested schema closedness    PASS
Deterministic identity              PASS
Lifecycle                           PASS
Readiness                           PASS
Projection manifest                 PASS
Independent verification            PASS
Visibility commit                   PASS
Partial residency                   PASS
Negative controls                   PASS
Fresh HDSRC v0.10 evidence          PASS
Actual MRMIC checkout gate          PASS
Frozen dependency install           PASS
Moderate dependency audit           PASS (0 vulnerabilities)
```

Final result:

\[
\boxed{
\text{PNCW Core MVP v0.1}
=
\textbf{PASS}
}
\]

for:

\[
\boxed{
\text{Projection Lifecycle}
+
\text{Verified Visibility Commit}
}
\]

The next engineering phase may build on this sealed Core rather than redefining it.
