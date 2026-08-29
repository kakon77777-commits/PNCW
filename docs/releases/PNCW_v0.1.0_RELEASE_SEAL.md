# PNCW v0.1.0 — Canonical Release Seal

**Project:** Projection-Native Computational World (PNCW)  
**Release:** v0.1.0  
**Seal date:** 2026-08-29 (Asia/Taipei)  
**Canonical repository:** `kakon77777-commits/PNCW`  
**Release class:** Core projection/visibility runtime + fresh three-system read-only integration evidence  

---

## 1. Release decision

PNCW v0.1.0 is sealed as the first executable baseline for the following bounded claim:

```text
Projection Lifecycle
+
Verified Visibility Commit
+
Fresh read-only HDSRC → MRMIC → PNCW integration evidence
```

The release does **not** claim implementation of the full PNCW Paper 00–08 perception/cognition/actuation architecture.

The canonical release principle is:

```text
Ready != Projected != Verified != Visible
```

with:

```text
Visible != Resident
```

and:

```text
Visibility Commit != World Mutation Commit
```

---

## 2. Canonical lineage

### 2.1 Core MVP integration

PR:

```text
#1 — PNCW Core MVP v0.1 — projection lifecycle and verified visibility commit
```

Validated feature seal head:

```text
3e086aca82594f2ad6d2a1e79645070bf1660a66
```

Core MVP merge commit:

```text
51b941a23fc5f8b91e0fb55bea5fb766b2051784
```

Final pre-merge validation:

```text
GitHub Actions run 33195484507
Core conformance:                  PASS
Actual MRMIC Phase 14 checkout:   PASS
```

Merged-result validation:

```text
GitHub Actions run 33195757068
Core conformance:                  PASS
Actual MRMIC Phase 14 checkout:   PASS
```

### 2.2 Three-system fresh E2E closure

PR:

```text
#2 — PNCW v0.1.0 closure: fresh HDSRC → actual MRMIC → PNCW E2E evidence
```

Final closure head:

```text
71a991b1333d4569ccf54a0843ca591aaeae833b
```

Closure merge commit:

```text
288f7f6cbeca15a40bbc28e8b85dd95d6d3630a9
```

Final exact-head validation:

```text
GitHub Actions run 33246159797
Core: 49 tests / 47 PASS / 0 FAIL / 2 intentional environment SKIP
Actual MRMIC gate: 49 tests / 48 PASS / 0 FAIL / 1 fresh-HDSRC-in-CI SKIP
```

Merged-result validation:

```text
GitHub Actions run 33246244686
Core conformance:                  PASS
Actual MRMIC Phase 14 checkout:   PASS
```

---

## 3. Core MVP capability seal

The v0.1.0 Core implements:

- six versioned Draft 2020-12 projection/lifecycle contracts;
- closed top-level and modeled nested contract boundaries;
- deterministic RID / MID / VID / VCID identity;
- typed fail-closed lifecycle and error semantics;
- independent HDSRC source-read and MRMIC surface-projection authority checks;
- `ProjectionReadinessGate`;
- non-visible surface preparation/binding;
- immutable deterministic `ProjectionManifest`;
- `ProjectionVerifier` with fresh upstream checks;
- live non-serializable verification proof;
- idempotent `VERIFIED → VISIBLE` visibility commit;
- partial physical residency after atomic logical reveal;
- fake HDSRC/MRMIC conformance adapters;
- real Phase-14-compatible HDSRC/MRMIC adapter boundary;
- stale / integrity / mixed-version / metadata-rebinding / restart / blind-recommit negative controls;
- frozen npm dependencies and moderate vulnerability audit gate.

Canonical lifecycle:

```text
REQUESTED
→ RESOLVED
→ READY
→ PROJECTED
→ VERIFIED
→ VISIBLE
```

Failure/recovery states remain typed and non-collapsed.

---

## 4. Core invariants sealed by v0.1.0

```text
Computation != Representation != Projection != Observation != Presentation
Ready != Projected != Verified != Visible
STALE_SOURCE != INTEGRITY_FAILURE
Identity != Authority
Digest Agreement != Structural Semantic Validity
Visible != Resident
Projection != Ownership Transfer
Visibility Commit != World Mutation Commit
Source Authority != Surface Authority != Visibility Authority
```

A serialized cached `VERIFIED` object cannot be blindly recommitted; visibility requires a live verification proof from the current verifier runtime.

---

## 5. Canonical HDSRC v0.10 evidence anchor

Release ZIP SHA-256:

```text
583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217
```

Canonical 4096D HDS1 state digest:

```text
sha256:ea48a90eddc727b1684cf72204ddeaa720c6b67fe036561e05537622b0c12f85
```

Validated source:

```text
dimension = 4096
nodes     = 72
relations = 576
revision  = 10
```

Observed materialization route:

```text
HPCM2 decision       = oracle_fallback
reason                = outside_current_trust_region
HMR1 carrier          = HMBT1
logicalScale          = 32
spatializationId      = RCM_PP
carrier bytes         = 286313
materializationDigest = sha256:4127f98f00cca7d85d2975e13186a2373814dbe0b53d611cf74215695e9e6c5b
```

Selected relation block-row read:

```text
compressedBytesRead = 1272
carrierBytes         = 286313
fraction             ≈ 0.444%
```

This is workload-specific executable evidence and is not a universal scaling claim.

---

## 6. Actual MRMIC/NVCL integration anchor

Validated repository:

```text
kakon77777-commits/MRMIC_NVCL
```

Validated `main` commit:

```text
1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b
```

The fresh closure executed actual Phase 14 components including:

```text
LocalProcessHdsrcProvider
JSONL stdio process bridge
production Python HDSRC host
createHdsrcMaterializationPortal(...)
native_resource_portal_v1
```

The MRMIC-side integration remained read-only and did not acquire HDSRC canonical state authority.

---

## 7. Fresh same-workspace three-system closure

The strongest newly validated read-side path in v0.1.0 is:

```text
Fresh canonical HDSRC v0.10
→ actual MRMIC LocalProcessHdsrcProvider
→ actual MRMIC production Python host
→ real HPCM2 / HMR1 / HMBT1
→ actual MRMIC portal factory
→ PNCW ProjectionReadinessGate
→ non-visible projection surface
→ PNCW ProjectionManifest
→ PNCW ProjectionVerifier
→ PNCW VisibilityCommit
→ VISIBLE
```

This path was executed in one fresh same-workspace run.

The same fresh run was then repeated with a new empty materialization root. The raw evidence files were byte-for-byte identical.

Raw replay SHA-256 for both executions:

```text
5490d40508b0d80e4c1b22b09524e66213189220d1b2d84343333bc0c8e0f130
```

---

## 8. Canonical closure evidence

Evidence artifact:

```text
artifacts/three-system-e2e-v0.1.0.json
```

Evidence file SHA-256:

```text
7d9da62224b23ea353a781de7971e0966e773761a49e83d7e6a32e0383893340
```

PNCW-canonical semantic evidence digest:

```text
sha256:4af48ceb91ae4b0cc1c327e3715c617e094466dbed53cce71625ad28f55273e5
```

Evidence schema:

```text
docs/evidence/three-system-e2e-v0.1.0.schema.json
```

Closure report:

```text
docs/evidence/PNCW_THREE_SYSTEM_E2E_CLOSURE_v0.1.0.md
```

Runtime-snapshot provenance artifact SHA-256:

```text
8a73093e1218b2efa5471868127c2374aacffffd67aef7faacc896cf2f9542b3
```

---

## 9. Cross-language canonicalization hardening

During closure, the first evidence-conformance CI correctly rejected a semantic digest that had been computed with Python JSON serialization.

RED run:

```text
33245971511
49 tests / 46 PASS / 1 FAIL / 2 SKIP
```

The sole failure was the evidence semantic-digest assertion.

Cause:

```text
Python JSON numeric serialization
!=
PNCW JavaScript canonical JSON numeric serialization
```

for a small floating `residentFraction`.

The PNCW canonicalization algorithm was **not** changed to accommodate the evidence. Instead, PNCW Core `sha256Digest(...)` remained authoritative and the evidence digest was recomputed through that function.

GREEN validation:

```text
33246053652
Core: 49 / 47 PASS / 0 FAIL / 2 SKIP
Actual MRMIC: 49 / 48 PASS / 0 FAIL / 1 SKIP
```

Final exact-head validation repeated the same success in run `33246159797`.

---

## 10. Atomic visibility result

The fresh three-system evidence records:

```text
RID  = pncw:result:096296cee4e33f565198c658c60fe78f7881437916fe807dfd3b7f6ca5bd1f8f
MID  = sha256:c8d2ad40603774629d147624efa2ba748b822830488b10acdc1ab616c36eb28d
VID  = sha256:7948a833d6a6701cd8152966924a917ed212c9770f7f51227d26546c1453ce62
VCID = pncw:visibility:d7f9330b84ca08287beba7f6bbffa5c1220bcda709b5ba92c0d796464fa2bafb
state = VISIBLE
residentFraction = 0.0000034926688880040796
```

Thus v0.1.0 contains executable evidence of:

```text
LogicalVisible = 1
AND
ResidentFraction < 1
```

without claiming constant-time physical transfer, storage, or rendering.

---

## 11. Authority and mutation boundary

v0.1.0 remains strictly bounded:

```text
HDSRC Canonical Authority
!=
MRMIC Surface Authority
!=
PNCW Visibility Authority
```

The following remain absent/open by design:

- HDSRC canonical writeback;
- Canvas pixel edit → HDSRC symbolic mutation;
- general projected mutation return path;
- world mutation commit through PNCW;
- unrestricted provider actuation authority.

Therefore:

```text
Fresh HDSRC → actual MRMIC → PNCW read-only E2E = VALIDATED
Canonical mutation return path                    = OPEN
```

---

## 12. Broader PNCW maturity boundary

### Implemented / validated in v0.1.0

```text
Projection contracts
Deterministic identity
Projection readiness
Non-visible surface binding
Projection manifest
Independent verification
Live verification proof
Atomic logical visibility commit
Partial physical residency
Read-only HDSRC/MRMIC adapter boundary
Fresh HDSRC → actual MRMIC → PNCW read-only E2E
```

### Not implemented by this release

```text
GCM-driven dynamic projection planning
ACR ActiveCognitiveDomain integration
CSPMF/APR perception routing
PHOSPHOR/HVAP governed actuation
Canonical projected mutation return path
Full Paper 00–08 perception–cognition–actuation E2E
```

So the correct release statement is:

```text
PNCW v0.1.0 = sealed executable projection/visibility substrate
```

and not:

```text
PNCW full architecture = complete
```

---

## 13. Dependency/security seal

PNCW v0.1.0 uses frozen npm dependency resolution and includes a CI moderate-audit gate.

Validated release-line dependencies include:

```text
Node.js     22.5.1
TypeScript  5.8.3
Ajv         8.18.0
```

The release line was sealed only after the previously observed Ajv 8.17.1 moderate advisory was removed from the dependency set.

Final validated audit state:

```text
npm audit --audit-level=moderate
0 vulnerabilities
```

---

## 14. Canonical release references

```text
Core MVP PR                     #1
Core MVP merge                  51b941a23fc5f8b91e0fb55bea5fb766b2051784
Core merged-result CI           33195757068

Three-system closure PR         #2
Three-system closure merge      288f7f6cbeca15a40bbc28e8b85dd95d6d3630a9
Three-system final-head CI      33246159797
Three-system merged-result CI   33246244686

HDSRC v0.10 release SHA         583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217
MRMIC/NVCL validated commit     1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b
Closure snapshot SHA            8a73093e1218b2efa5471868127c2374aacffffd67aef7faacc896cf2f9542b3
Closure evidence file SHA       7d9da62224b23ea353a781de7971e0966e773761a49e83d7e6a32e0383893340
Closure semantic digest         sha256:4af48ceb91ae4b0cc1c327e3715c617e094466dbed53cce71625ad28f55273e5
```

---

## 15. Intended Git tag

The canonical intended release tag is:

```text
v0.1.0
```

The tag must point to the final `main` commit that merges this release-seal document after its own CI and post-merge validation succeed.

The existence of this document does **not** itself assert that the Git tag has already been created.

---

## 16. Final seal statement

Subject to successful validation and integration of this seal document itself:

```text
PNCW v0.1.0
=
Core Projection Lifecycle
+
Verified Visibility Commit
+
Fresh HDSRC v0.10 → Actual MRMIC Phase 14 → PNCW Read-Only E2E Closure
```

with canonical mutation return and the broader perception/cognition/actuation architecture explicitly deferred to later versions.
