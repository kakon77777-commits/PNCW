# PNCW Core MVP v0.1 — Validation Report

**Date:** 2026-08-29 (Asia/Taipei)  
**Repository:** `kakon77777-commits/PNCW`  
**PR:** `#1 — PNCW Core MVP v0.1 — projection lifecycle and verified visibility commit`  
**Validated executable/config head:** `d23e3168afdc38bef2f63aeb1cd3d36974165b69`  
**Scope:** Projection Lifecycle + Verified Visibility Commit

---

## 1. Final result

**PNCW Core MVP v0.1: PASS for the declared Core MVP scope.**

The validated implementation demonstrates:

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
\boxed{
Ready\neq Projected\neq Verified\neq Visible
}
\]

and:

\[
\boxed{
Visible\neq Resident.
}
\]

The release claim remains limited to:

\[
\boxed{
\text{Projection Lifecycle}
+
\text{Verified Visibility Commit}
}
\]

This report does **not** claim full PNCW Paper 00–08 perception/cognition/actuation closure.

---

## 2. Evidence model

Validation is deliberately separated into independent evidence layers. No layer is used to impersonate another.

### Layer A — PNCW deterministic/conformance runtime

Validates:

- six closed versioned JSON contracts;
- deterministic RID / MID / VID / VCID;
- lifecycle transition rules;
- source/surface authority separation;
- readiness semantics;
- immutable projection manifest;
- fresh independent verification;
- idempotent visibility commit;
- partial residency after logical visibility;
- stale/integrity/mixed-version/rebinding/restart negative controls.

### Layer B — Fresh canonical HDSRC v0.10 4096D execution

A fresh local execution used the canonical HDSRC v0.10 release source and canonical 4096D fixture to produce the committed evidence artifact.

This layer validates real HDSRC planning/materialization/partial-read behavior and then feeds that evidence into the PNCW Core lifecycle.

### Layer C — Actual MRMIC/NVCL checkout compatibility gate

GitHub Actions checks out actual `kakon77777-commits/MRMIC_NVCL@main`, installs/builds it, and executes the PNCW external-checkout test against its compiled Phase 14 exports.

This proves real source compatibility with:

- `LocalProcessHdsrcProvider`;
- `createHdsrcMaterializationPortal(...)`;
- current `native_resource_portal_v1` binding shape.

### Explicit non-collapse of evidence classes

\[
\boxed{
\text{Fresh HDSRC + PNCW execution}
\neq
\text{Actual MRMIC checkout compatibility gate}
}
\]

The current validation does not claim that all three systems were executed in one fresh same-process/same-workspace end-to-end run.

---

## 3. Frozen dependency and security gate

Final CI uses:

- Node.js `22.5.1`;
- npm `10.8.2`;
- committed `package-lock.json`;
- `npm ci --ignore-scripts` for PNCW;
- Ajv `8.18.0`;
- TypeScript `5.8.3`.

Ajv was upgraded from 8.17.1 to 8.18.0 before closure so the Core MVP does not seal with the known 8.17.1 moderate ReDoS advisory.

Final CI dependency audit:

```text
npm audit --audit-level=moderate
found 0 vulnerabilities
```

The CI-generated Ajv-8.18.0 lockfile used for the committed dependency freeze had SHA-256:

```text
b6b0d6533b2d38cdb4b9c3474f561d52047d70736848e9a33b9966fdb03d15c4
```

---

## 4. Final GitHub Actions validation

Workflow:

```text
PNCW Core MVP CI
```

Final frozen-dependency validation run:

```text
run id: 33194709545
head:   d23e3168afdc38bef2f63aeb1cd3d36974165b69
```

Both jobs completed successfully.

### 4.1 Core conformance — PASS

Commands/gates:

```text
npm ci --ignore-scripts
npm audit --audit-level=moderate
npm run check
npm test
```

Results:

```text
TypeScript check: PASS
Ajv Draft 2020-12 strict validation: PASS
Dependency audit: 0 vulnerabilities
45 tests
43 PASS
0 FAIL
2 SKIP
```

The two Core-job skips are intentional environment-specific gates:

1. actual MRMIC checkout test — executed separately in the second CI job;
2. fresh HDSRC 4096D test — requires the canonical HDSRC release/root and is backed by the separately committed fresh-execution evidence.

They are not failed Core behaviors.

### 4.2 Actual MRMIC Phase 14 checkout gate — PASS

The CI job checked out:

```text
kakon77777-commits/MRMIC_NVCL
ref: main
commit: 1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b
```

MRMIC/NVCL validation in that job:

```text
npm ci: PASS
npm run check: PASS
npm run build: PASS
npm install/audit result: 0 vulnerabilities
```

PNCW was then built with frozen dependencies and the complete built test suite was executed with:

```text
PNCW_MRMIC_DIST_ROOT=<actual MRMIC checkout>/dist
```

Results:

```text
45 tests
44 PASS
0 FAIL
1 SKIP
```

The previously skipped external MRMIC checkout test executed and passed:

```text
actual MRMIC checkout exports Phase 14 local-process provider and portal factory — PASS
```

The only remaining skip in this job is the fresh-HDSRC-in-CI test because the HDSRC release fixture is not stored in the PNCW repository.

---

## 5. Fresh HDSRC v0.10 4096D evidence

Committed evidence:

```text
artifacts/real-4096d-validation.json
```

Raw artifact SHA-256:

```text
dffeaf70a76c054c6e0da777feec5f1e297d97c1bca57777e4f2c6b97e849208
```

Semantic evidence digest embedded in the artifact:

```text
sha256:8eb4c800332a80990bb7623cac4a8df84483fe0687c2e44715edca4dfec7487b
```

Canonical HDSRC v0.10 release ZIP SHA-256:

```text
583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217
```

Canonical 4096D HDS1 source digest:

```text
sha256:ea48a90eddc727b1684cf72204ddeaa720c6b67fe036561e05537622b0c12f85
```

Decoded source:

```text
dimension = 4096
nodes     = 72
relations = 576
revision  = 10
```

Real HPCM2 result:

```text
decision       = oracle_fallback
requiresOracle = true
reason          = outside_current_trust_region
```

Resolved HMR1/HMBT1 materialization:

```text
carrier          = HMBT1
logicalScale     = 32
spatializationId = RCM_PP
carrier bytes    = 286313
materialization digest = sha256:4127f98f00cca7d85d2975e13186a2373814dbe0b53d611cf74215695e9e6c5b
```

Partial relation block-row read:

```text
compressed bytes read = 1272
carrier bytes          = 286313
relations returned     = 256
```

Thus:

\[
\frac{1272}{286313}\approx0.004443
\]

or approximately **0.444%** of the full carrier byte count for this validated workload.

This is a workload-specific executable result, not a universal asymptotic claim.

---

## 6. PNCW atomic visibility evidence

The same committed fresh-HDSRC evidence records:

```text
resultId = pncw:result:096296cee4e33f565198c658c60fe78f7881437916fe807dfd3b7f6ca5bd1f8f
manifestDigest = sha256:c8d2ad40603774629d147624efa2ba748b822830488b10acdc1ab616c36eb28d
verificationDigest = sha256:7948a833d6a6701cd8152966924a917ed212c9770f7f51227d26546c1453ce62
visibilityCommitId = pncw:visibility:d7f9330b84ca08287beba7f6bbffa5c1220bcda709b5ba92c0d796464fa2bafb
visibility state = VISIBLE
semantic visibility events = 1
residentFraction = 0.0000034926688880040796
```

Therefore the MVP contains an executable instance of:

\[
\boxed{
Visible=1
\land
ResidentFraction<1
}
\]

without claiming that physical output cost is constant or zero.

---

## 7. Required negative-control closure

The test suite includes and passes controls for:

- unknown contract fields fail closed;
- illegal lifecycle shortcuts fail;
- `READY -> VISIBLE` is rejected;
- `PROJECTED -> VISIBLE` is rejected;
- source-read denial occurs before protected resolution;
- surface authority remains independently checked;
- unsupported observation lanes fail closed;
- valid changed source maps to retryable stale state;
- structural integrity failure remains non-retryable;
- mixed source/materialization/surface lineage maps to `VERSION_CONFLICT`;
- wrong manifest digest does not verify;
- invalid root residency does not verify;
- self-consistent metadata cannot override provider structural failure;
- full metadata/digest rebinding cannot authorize a non-canonical carrier;
- serialized cached `VERIFIED` JSON cannot blind recommit without a live verification proof;
- provider restart requires re-resolution/reverification;
- source becoming stale after assembly blocks later verification;
- duplicate VCID is idempotent and yields one semantic visibility event;
- `visibleAt` does not alter VCID semantic identity.

Two hardening tests found real implementation defects during development:

1. full metadata rebinding was initially accepted by the fake structural verifier;
2. serialized cached verification data could initially be presented for blind recommit.

Both defects were corrected before final validation.

---

## 8. Authority boundary validation

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

The real adapter delegates HDSRC materialization and partial-read semantics to the Phase 14-compatible provider surface instead of implementing HMBT1 semantics inside PNCW.

---

## 9. MRMIC evidence boundary

The fresh HDSRC 4096D run used a source-grounded Phase 14 portal-factory fixture at the MRMIC surface boundary. The committed evidence therefore explicitly records:

```text
mrmic.mode = source-grounded-portal-factory
mrmic.actualCheckoutExecuted = false
```

This is intentional evidence honesty.

Separately, GitHub Actions run `33194709545` checked out and built actual `MRMIC_NVCL/main@1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b`, then executed the PNCW external-checkout compatibility test successfully.

Accordingly, the validated claim is:

\[
\boxed{
\text{Fresh HDSRC + PNCW execution}
+
\text{Actual MRMIC checkout compatibility}
}
\]

and **not**:

\[
\text{fresh same-process HDSRC + MRMIC + PNCW three-system E2E}.
\]

---

## 10. What is proven by this MVP

For the declared scope, the implementation demonstrates that PNCW can:

1. keep external canonical authority outside PNCW;
2. resolve and readiness-check a projection before surface preparation;
3. bind a non-visible projection surface;
4. assemble deterministic immutable manifest identity;
5. independently verify source/materialization/surface lineage;
6. require live, non-serializable verification proof for visibility promotion;
7. atomically promote a verified root result to observer-visible authority;
8. remain idempotent under duplicate VCID commit;
9. keep logical visibility separate from full physical residency;
10. preserve upstream stale/integrity distinctions;
11. remain compatible with actual MRMIC Phase 14 exports.

---

## 11. Explicit non-claims

This validation does not establish:

- full PNCW perception–cognition–actuation loop closure;
- GCM-driven dynamic projection planning;
- ACR ActiveCognitiveDomain integration;
- CSPMF/APR perception routing;
- PHOSPHOR/HVAP governed actuation;
- canonical HDSRC writeback;
- Canvas pixel edit → HDSRC symbolic mutation;
- production multi-tenant security certification;
- universal HDSRC scaling or performance superiority;
- a fresh same-process three-system HDSRC+MRMIC+PNCW E2E run;
- replacement of autoregressive computation;
- physical O(1) output.

---

## 12. Closure decision

Within the Core MVP scope:

```text
Contracts                     PASS
Draft 2020-12 strict schemas  PASS
Deterministic identity        PASS
Lifecycle                     PASS
Readiness                     PASS
Projection manifest           PASS
Independent verification      PASS
Visibility commit             PASS
Partial residency             PASS
Negative controls             PASS
Fresh HDSRC v0.10 evidence    PASS
Actual MRMIC checkout gate    PASS
Frozen dependency install     PASS
Moderate dependency audit     PASS (0 vulnerabilities)
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

The next engineering phase may build on this sealed core rather than redefining it.
