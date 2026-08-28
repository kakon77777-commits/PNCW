# PNCW Core MVP Design Specification v0.1

**Date:** 2026-08-28  
**Repository:** `kakon77777-commits/PNCW`  
**Status:** Approved design specification  
**Scope:** Thin PNCW Orchestrator — Projection Lifecycle + Verified Visibility Commit

---

## 1. Purpose

The Projection-Native Computational World (PNCW) Core MVP is the first executable reference slice of the PNCW Paper 00–08 architecture.

The MVP does **not** implement the full PNCW perception–cognition–actuation loop. Its narrower purpose is:

> Prove that an externally authoritative computational source can be resolved, projected through independently owned provider systems, verified without collapsing authority boundaries, and atomically promoted into observer-visible state while only a fraction of the physical carrier is resident.

The first real vertical slice is anchored on the strongest currently validated cross-system segment:

\[
\boxed{
\text{Real HDSRC v0.10}
\rightarrow
\text{MRMIC/NVCL}
\rightarrow
\text{PNCW Readiness}
\rightarrow
\text{PNCW Verification}
\rightarrow
\text{Visibility Commit}
}
\]

The MVP therefore implements PNCW's missing coordination kernel rather than duplicating HDSRC, MRMIC/NVCL, GCM, ACR, CSPMF, or PHOSPHOR.

---

## 2. Architectural Decision

The selected approach is **Approach 1: Thin PNCW Orchestrator**.

PNCW owns:

- cross-system projection contracts;
- projection lifecycle;
- readiness evaluation;
- projection verification;
- visibility commit semantics;
- identity/version lineage at the PNCW boundary;
- adapter port contracts;
- conformance and negative-control tests.

PNCW does **not** own:

- HDSRC canonical state;
- HDSRC carrier semantics;
- MRMIC Canvas canonical state;
- MRMIC provider/resource authority;
- GCM planning semantics;
- ACR memory truth;
- CSPMF evidence truth;
- PHOSPHOR provider authority;
- canonical world writeback.

Primary ownership invariant:

\[
\boxed{
\text{Projection Coordination}
\neq
\text{Upstream Canonical Authority}
}
\]

---

## 3. Design Goals

The Core MVP MUST demonstrate all of the following:

1. A projection request can be resolved into an immutable projection manifest.
2. A source/materialization/surface lineage can be checked without PNCW becoming canonical owner of those resources.
3. Readiness is distinct from projection, verification, and visibility.
4. Visibility promotion occurs only after successful verification.
5. A visible result can be logically complete while only a subset of physical carrier regions are resident.
6. Stale source state is distinct from malformed or structurally invalid state.
7. Mixed-version projections fail closed.
8. Upstream authority boundaries remain independent.
9. Visibility commit is deterministic and idempotent.
10. Negative controls are first-class conformance requirements.

---

## 4. Non-Goals

The Core MVP explicitly does not implement or claim:

- GCM-driven dynamic projection planning;
- ACR ActiveCognitiveDomain integration;
- CSPMF/APR perception routing;
- PHOSPHOR/HVAP actuation;
- canonical HDSRC writeback;
- Canvas edit → HDSRC symbolic mutation;
- unrestricted bidirectional HDSRC ↔ MRMIC synchronization;
- native model hidden-state projection;
- universal non-sequential AI generation;
- production multi-tenant security certification;
- remote HDSRC transport;
- universal desktop/game/audio/video integration.

The Core MVP claim is limited to:

\[
\boxed{
\text{Projection Lifecycle}
+
\text{Verified Visibility Commit}
}
\]

---

## 5. Technology Baseline

The initial implementation SHOULD follow current MRMIC/NVCL engineering conventions:

- Node.js `>=22.5.0`;
- TypeScript;
- ESM modules;
- npm workspaces;
- `tsc --noEmit` for static checks;
- Node test runner for conformance/integration tests;
- JSON Schema for versioned contracts;
- deterministic fixtures before live-provider integration.

This minimizes friction with the existing `@mrmic/provider-hdsrc` TypeScript surface and preserves a direct path to the already validated local-process bridge.

---

## 6. Repository Layout

```text
PNCW/
├─ README.md
├─ package.json
├─ tsconfig.json
├─ contracts/
│  ├─ projection-request/
│  ├─ projection-manifest/
│  ├─ readiness-result/
│  ├─ verification-result/
│  ├─ visibility-state/
│  └─ error-envelope/
├─ packages/
│  ├─ core/
│  ├─ readiness/
│  ├─ verification/
│  ├─ visibility/
│  ├─ adapters/
│  └─ conformance/
├─ adapters/
│  ├─ fake-hdsrc/
│  ├─ fake-mrmic/
│  └─ real-mrmic-hdsrc/
├─ examples/
│  └─ vertical-slice/
├─ tests/
│  ├─ contracts/
│  ├─ lifecycle/
│  ├─ conformance/
│  ├─ integration/
│  └─ negative-controls/
└─ docs/
   ├─ superpowers/specs/
   ├─ architecture/
   └─ evidence/
```

Ports and real adapter implementations remain separate.

---

## 7. Core Packages

### 7.1 `packages/core`

Responsibilities:

- canonical PNCW IDs;
- lifecycle state definitions;
- error code definitions;
- deterministic canonicalization utilities;
- immutable shared value objects.

It MUST NOT perform provider I/O or commit visibility by itself.

### 7.2 `packages/readiness`

Owns `ProjectionReadinessGate`.

It evaluates whether a projection is eligible to proceed toward surface preparation.

### 7.3 `packages/verification`

Owns `ProjectionVerifier`.

It verifies assembled projection lineage and cross-provider consistency. It is the only package allowed to produce a `VERIFIED` result.

### 7.4 `packages/visibility`

Owns `VisibilityCommit`.

It accepts only an immutable verified result and MUST NOT mutate source state, repair stale projections, or invent authority.

### 7.5 `packages/adapters`

Defines provider-neutral TypeScript ports only.

### 7.6 `packages/conformance`

Owns reusable adapter/lifecycle conformance suites applicable to fake and real adapters.

---

## 8. Core Contract Set

The MVP uses six first-class v1 contracts.

### 8.1 Projection Request

`ProjectionRequestV1` describes what the caller wants to observe.

Conceptual fields:

```text
schema
requestId
sourceRef
observer
representation
scope
requestedMode
authorityContext
```

Invariant:

\[
\boxed{
\text{ProjectionRequest}
\neq
\text{ProjectionManifest}
}
\]

### 8.2 Projection Manifest

`ProjectionManifestV1` describes what was actually prepared.

Conceptual fields:

```text
schema
resultId
sourceIdentity { authority, sourceId, revision, digest }
projectionProfile
materializationRefs
surfaceRefs
integrityRefs
authorityRefs
residencyMap
version
manifestDigest
```

`manifestDigest` is computed over a canonical **manifest payload** that excludes the `manifestDigest` field itself and excludes non-semantic runtime metadata such as generation timestamps. There is no self-referential digest.

Once `VERIFIED`, the semantic manifest payload is immutable.

### 8.3 Readiness Result

`ReadinessResultV1` records:

```text
schema
requestId
ready
checks[]
blockingError?
sourceSnapshot
capabilitySnapshot
```

### 8.4 Verification Result

`VerificationResultV1` records:

```text
schema
resultId
verified
manifestDigest
checks[]
failure?
verificationDigest
```

`verificationDigest` is computed over a canonical verification payload excluding its own digest and non-semantic runtime timestamps.

### 8.5 Visibility State

`VisibilityStateV1` records:

```text
schema
resultId
state
visibilityCommitId?
revealMode?
visibleAt?
supersedes?
```

`visibleAt` is observational/audit metadata and MUST NOT contribute to semantic identity.

Visibility state is observer-facing lifecycle state, not canonical world state.

### 8.6 Error Envelope

```ts
interface PncwErrorEnvelopeV1 {
  schema: 'pncw-error/v1'
  code: PncwErrorCode
  stage: PncwStage
  retryable: boolean
  source: 'pncw' | 'hdsrc' | 'mrmic'
  message: string
  causeRef?: string
}
```

Core JSON Schemas SHOULD use `additionalProperties: false`.

---

## 9. Adapter Ports

### 9.1 HDSRC Source Port

Initial port:

```text
getCapabilities()
resolveSource()
resolveMaterialization()
checkFreshness()
checkAuthority()
readSelectedRegion()
```

The port MUST NOT expose canonical mutation.

The real adapter SHOULD delegate to the existing MRMIC/HDSRC provider path rather than duplicating the HDSRC process bridge.

### 9.2 MRMIC Surface Port

Initial port:

```text
getCapabilities()
prepareSurface()
bindProjection()
surfaceState()
checkProjectionAuthority()
```

The port MUST NOT expose unrestricted Canvas mutation.

### 9.3 Adapter Boundary Rule

PNCW may translate provider-specific responses into PNCW lifecycle semantics, but MUST preserve distinctions that matter semantically.

\[
\boxed{
\text{Upstream Error Semantics}
\not\rightarrow
\text{Generic FAILED}
}
\]

---

## 10. Core Data Flow

\[
\boxed{
\begin{aligned}
ProjectionRequest
&\rightarrow SourceResolution\\
&\rightarrow CapabilityNegotiation\\
&\rightarrow ReadinessEvaluation\\
&\rightarrow ProjectionManifest\\
&\rightarrow SurfacePreparation\\
&\rightarrow ProjectionVerification\\
&\rightarrow VisibilityCommit.
\end{aligned}
}
\]

Normal lifecycle:

```text
REQUESTED
    ↓
RESOLVED
    ↓
READY
    ↓
PROJECTED
    ↓
VERIFIED
    ↓
VISIBLE
```

No normal transition may bypass verification.

---

## 11. Lifecycle Invariants

Legal reveal transition:

\[
\boxed{VERIFIED\rightarrow VISIBLE}
\]

Illegal shortcuts:

\[
READY\not\rightarrow VISIBLE
\]

\[
PROJECTED\not\rightarrow VISIBLE
\]

\[
FAILED\not\rightarrow VISIBLE
\]

The state machine MUST reject illegal transitions deterministically.

---

## 12. Readiness Semantics

Canonical readiness predicate:

\[
\boxed{
\mathsf{ProjectionReady}
=
SourceFresh
\land ScopeBound
\land FrameValid
\land AuthorityValid
\land IntegrityValid
\land ManifestComplete
}
\]

`READY` does not mean the surface exists, the projection is verified, or the observer may treat it as authoritative.

\[
\boxed{
Ready
\neq
Projected
\neq
Verified
\neq
Visible
}
\]

---

## 13. Error Semantics

Initial canonical error codes:

```text
INVALID_REQUEST
UNAUTHORIZED
UNSUPPORTED
SOURCE_UNAVAILABLE
STALE_SOURCE
INTEGRITY_FAILURE
MATERIALIZATION_FAILED
SURFACE_UNAVAILABLE
VERSION_CONFLICT
VERIFICATION_FAILED
INVALID_TRANSITION
ALREADY_VISIBLE
ABORTED
```

### 13.1 Stale vs Integrity Failure

A different but valid current source state maps to:

```text
STALE_SOURCE
retryable = true
```

Malformed, tampered, or structurally invalid state maps to:

```text
INTEGRITY_FAILURE
retryable = false
```

\[
\boxed{
STALE\_SOURCE
\neq
INTEGRITY\_FAILURE
}
\]

### 13.2 Fail-Closed Classes

`UNAUTHORIZED`, `INTEGRITY_FAILURE`, `VERSION_CONFLICT`, `VERIFICATION_FAILED`, and illegal lifecycle transitions MUST block visibility promotion.

---

## 14. Identity Model

### 14.1 Source Identity

```ts
interface SourceIdentityV1 {
  authority: string
  sourceId: string
  revision: number
  digest: string
}
```

### 14.2 Result Identity

\[
\boxed{
RID
=
H(
SourceIdentity,
Scope,
ObserverProfile,
ProjectionProfile,
ProtocolVersion
)
}
\]

### 14.3 Manifest Identity

Let `ManifestPayload` denote the canonical semantic manifest with `manifestDigest` and non-semantic runtime metadata excluded:

\[
\boxed{
MID
=
H(ManifestPayload)
}
\]

The stored `manifestDigest` MUST equal `MID`.

### 14.4 Verification Identity

Let `VerificationPayload` denote the canonical semantic verification result with `verificationDigest` and non-semantic runtime metadata excluded:

\[
\boxed{
VID
=
H(VerificationPayload)
}
\]

The stored `verificationDigest` MUST equal `VID`.

### 14.5 Visibility Commit Identity

\[
\boxed{
VCID
=
H(
RID,
MID,
VID,
RevealMode
)
}
\]

Therefore:

\[
\boxed{
SourceID
\neq ResultID
\neq ManifestID
\neq VerificationID
\neq VisibilityCommitID
}
\]

and:

\[
\boxed{Identity\neq Authority}
\]

---

## 15. Deterministic Identity Requirements

For fixed semantic input:

- `RID` MUST be deterministic;
- `MID` / manifest digest MUST be deterministic;
- `VID` / verification digest MUST be deterministic;
- `VCID` MUST be deterministic.

The following MUST NOT contribute to semantic identity:

- wall-clock generation timestamp;
- `visibleAt`;
- process ID;
- transient temp path;
- random nonce without semantic role.

Canonical JSON serialization or an equivalent deterministic encoding MUST be used for hashed identities.

---

## 16. Versioning and Supersession

A visible artifact is immutable at its authoritative manifest boundary.

If source revision 10 advances to revision 11, PNCW MUST NOT silently rewrite the visible projection.

Instead:

```text
RID:v1 — source revision 10 — SUPERSEDED
RID:v2 — source revision 11 — REQUESTED → ...
```

\[
\boxed{
\text{Source Mutation}
\not\Rightarrow
\text{Silent Projection Mutation}
}
\]

---

## 17. Mixed-Version Prevention

If:

```text
source revision = 10
materialization revision = 10
surface binding revision = 11
```

then:

```text
VERSION_CONFLICT
```

\[
\boxed{
\text{Mixed-Version Projection}
=
\text{Invalid Projection}
}
\]

---

## 18. Integrity Model

PNCW MUST NOT accept a projection merely because manifest metadata is self-consistent.

The MVP adopts the engineering lesson demonstrated by the real HDSRC rebinding negative control:

\[
\boxed{
\text{Digest Agreement}
\neq
\text{Structural Semantic Validity}
}
\]

The verifier MUST distinguish:

1. metadata/identity agreement;
2. provider structural verification.

For HDSRC-backed projections, the real adapter SHOULD delegate structural HMBT1 validation to the existing authoritative HDSRC integration path instead of reimplementing HMBT1 semantics in PNCW.

---

## 19. Authority Model

PNCW never converts addressability or identity into authority.

\[
\boxed{\text{Addressable}\neq\text{Authorized}}
\]

\[
\boxed{\text{Capability}\neq\text{Authority}}
\]

\[
\boxed{\text{Projection}\neq\text{Ownership Transfer}}
\]

\[
\boxed{\text{MRMIC Authentication}\neq\text{HDSRC Authorization}}
\]

HDSRC source authority and MRMIC projection/surface authority remain separate checks.

---

## 20. Atomic Visibility Semantics

`VISIBLE` does **not** mean all carrier bytes are resident.

It means:

> result root identity, immutable manifest, structure, version, authority, integrity status, and addressable residency map become authoritative at one observer visibility boundary.

Therefore:

\[
\boxed{\mathsf{Visible}(RID)=1}
\]

can coexist with:

\[
\boxed{0<\rho_{resident}<1}
\]

This is the executable form of:

\[
\boxed{
\text{Atomic Logical Reveal}
+
\text{Progressive Physical Materialization}
}
\]

---

## 21. Residency Model

Initial region residency states:

```text
DECLARED
AVAILABLE
RESIDENT
UNAVAILABLE
INVALID
```

Legal:

```text
VISIBLE + some region not RESIDENT
```

Illegal:

```text
VISIBLE + root manifest INVALID
```

\[
\boxed{Visible\neq Resident}
\]

---

## 22. Visibility Commit

`VisibilityCommit` accepts only:

- a `VERIFIED` result;
- the matching immutable manifest;
- the matching `VID`;
- a valid reveal mode;
- the expected deterministic visibility commit identity.

It MUST NOT:

- mutate the source;
- repair a stale projection;
- reauthorize an unauthorized source;
- rewrite the manifest;
- silently refresh to a newer source revision.

### 22.1 Idempotency

Repeated commit with the same `VCID` MUST NOT create duplicate observer-visible transitions.

\[
\boxed{Commit(VCID)^n=Commit(VCID)}
\]

The implementation MAY return the existing receipt or `ALREADY_VISIBLE`.

---

## 23. Initial Reveal Modes

The Core MVP SHOULD support at least:

```text
ATOMIC_ARTIFACT
SEMANTIC_BATCH
```

`STREAM` and `HYBRID` MAY exist in contracts for forward compatibility, but the first acceptance path is `ATOMIC_ARTIFACT`.

\[
\boxed{
\text{Sequential Computation}
\not\Rightarrow
\text{Sequential Visibility}
}
\]

---

## 24. Partial Materialization Requirement

The Core MVP MUST include at least one acceptance scenario where:

\[
\boxed{
Visible=1
\land
ResidentFraction<1
}
\]

For the real HDSRC vertical slice, this SHOULD reuse the existing partial machine-carrier read capability instead of materializing the complete carrier into PNCW memory.

Existing upstream 4096D validation provides a concrete integration target:

```text
full HMBT1 carrier      = 286,313 bytes
partial compressed read = 1,272 bytes
```

This is evidence for one validated workload, not a universal performance guarantee.

---

## 25. Conformance Strategy

The MVP is **conformance-first**.

Testing order:

1. contract fixtures;
2. core lifecycle;
3. fake HDSRC / fake MRMIC;
4. adapter conformance;
5. negative controls;
6. real HDSRC→MRMIC vertical integration;
7. deterministic replay.

UI/demo work is secondary to lifecycle correctness.

---

## 26. Required Test Matrix

### Happy Path

- valid request;
- source resolves;
- compatible capabilities;
- source fresh;
- authority valid;
- projection prepared;
- verification passes;
- visibility commit succeeds.

### Stale Source

- current source is valid but revision changed;
- result is `STALE_SOURCE`;
- projection cannot become visible.

### Integrity Failure

- malformed or structurally invalid source/carrier;
- result is `INTEGRITY_FAILURE`;
- non-retryable;
- no visibility commit.

### Unauthorized Read

- source principal lacks HDSRC read authority;
- `UNAUTHORIZED`;
- MRMIC authority cannot compensate.

### Unsupported Observation Mode

- requested lane absent from provider capabilities;
- `UNSUPPORTED`.

### Surface Unavailable

- source/materialization valid;
- MRMIC surface preparation fails;
- `SURFACE_UNAVAILABLE`;
- no visibility.

### Mixed Version

- source/materialization/surface lineage mismatch;
- `VERSION_CONFLICT`.

### Rebound Identity

- self-consistent rewritten digest/manifest metadata;
- structural verification rejects invalid carrier;
- fail closed.

### Provider Restart

- restart with stable materialization identity can be re-resolved;
- stale cached result cannot be blindly recommitted.

### Duplicate Visibility Commit

- same `VCID` committed twice;
- only one semantic visibility event.

### Visibility Before Verification

- transition rejected with `INVALID_TRANSITION`.

---

## 27. Recovery Semantics

Provider restart is not automatically failure if stable source/materialization identity can be re-established.

However:

\[
\boxed{
\text{Restart}
\not\Rightarrow
\text{Blind Recommit}
}
\]

The runtime MUST revalidate projection lineage before visibility promotion.

A cached `VERIFIED` record is insufficient if its freshness contract expired or provider epoch invalidated required evidence.

---

## 28. MVP Vertical Slice

The first real demo is:

```text
1. Resolve a real HDSRC 4096D state.
2. Obtain HMBT1 materialization through the existing read-only bridge.
3. Prepare an MRMIC read-only resource portal/surface.
4. Build a PNCW ProjectionManifest.
5. Verify source/materialization/surface lineage.
6. Verify authority and integrity.
7. Transition PROJECTED → VERIFIED.
8. Commit visibility atomically.
9. Observer receives the complete root manifest.
10. Read one partial HMBT1 relation block-row.
11. Demonstrate VISIBLE while carrier is not fully resident.
```

The expected claim is:

\[
\boxed{
\text{Projection-Native Atomic Visibility Vertical Slice}
=
PASS
}
\]

only if conformance and negative-control requirements also pass.

---

## 29. MVP Acceptance Criteria

The MVP is complete only when all are satisfied.

### 29.1 Contracts

- six v1 contracts exist as JSON Schema + TypeScript types;
- positive fixtures pass;
- negative fixtures fail deterministically;
- core schemas reject undeclared properties.

### 29.2 Lifecycle

- every legal transition is tested;
- every illegal visibility shortcut is rejected;
- `VERIFIED → VISIBLE` is the only normal reveal path.

### 29.3 Determinism

- fixed semantic input produces stable `RID`;
- fixed manifest payload produces stable `MID`;
- fixed verification payload produces stable `VID`;
- fixed verified result produces stable `VCID`;
- non-semantic timestamps do not affect identity.

### 29.4 Freshness

- changed-valid source → `STALE_SOURCE`;
- stale result never becomes visible.

### 29.5 Integrity

- digest mismatch fails;
- malformed manifest fails;
- rebound metadata attack fails;
- provider structural mismatch fails.

### 29.6 Authority

- source-read and surface-projection authority remain separate;
- PNCW never invents a missing upstream grant.

### 29.7 Mixed Version

- inconsistent source/materialization/surface lineage → `VERSION_CONFLICT`.

### 29.8 Atomic Reveal

- no authoritative result is visible before commit;
- root manifest becomes authoritative in one semantic transition;
- detail regions may remain non-resident.

### 29.9 Partial Materialization

- at least one test proves `Visible=1` with `ResidentFraction<1`.

### 29.10 Recovery

- provider restart recovers only after re-resolution/revalidation;
- stale cached projections cannot blind recommit.

### 29.11 Conformance

- fake adapters pass;
- real HDSRC→MRMIC adapter passes applicable conformance suites.

### 29.12 Claim Boundary

Release documentation states that the MVP implements only:

\[
\boxed{
\text{Projection Lifecycle}
+
\text{Verified Visibility Commit}
}
\]

It does not claim full PNCW E2E closure.

---

## 30. Implementation Sequence

### M0 — Contract Foundation

JSON Schemas, TypeScript types, fixtures, canonicalization.

### M1 — Core Lifecycle

IDs, error types, transition machine.

### M2 — Readiness

Readiness gate + fake source port.

### M3 — Projection / Verification

Manifest assembly, surface binding, verifier.

### M4 — Visibility

Idempotent visibility commit + residency state.

### M5 — Fake Vertical Slice

Fake HDSRC + fake MRMIC full conformance.

### M6 — Real HDSRC/MRMIC Adapter

Reuse the existing real local-process/provider path.

### M7 — Negative-Control Closure

Stale, tamper, rebound, mixed-version, restart.

### M8 — Reference Demo / Evidence

Real 4096D projection, partial relation read, reproducible evidence.

A later milestone MUST NOT compensate for an earlier violated invariant.

---

## 31. Deferred Integration Roadmap

After the Core MVP is sealed:

### Phase 2 — GCM Planning

\[
GCM\rightarrow ProjectionRequest
\]

### Phase 3 — ACR ActiveCognitiveDomain

\[
ACR\rightarrow GCM\rightarrow PNCW
\]

### Phase 4 — CSPMF/APR

Evidence-driven projection requests.

### Phase 5 — PHOSPHOR/HVAP

\[
VisualProposal
\rightarrow Readiness
\rightarrow Authority
\rightarrow Actuation
\rightarrow IndependentVerification
\]

These are outside the Core MVP.

---

## 32. Security and Trust Boundaries

The Core MVP follows these rules:

1. identity before protected reads;
2. capability does not imply authority;
3. provider-specific authorization is preserved;
4. manifests do not self-authorize;
5. digests do not override structural validation;
6. visibility promotion does not grant write authority;
7. no blind stale recommit;
8. verification failure is fail-closed.

---

## 33. Observability

Every end-to-end result SHOULD carry:

```text
requestId
resultId
manifestId
verificationId
visibilityCommitId
source authority/id/revision
materialization id
surface id
adapter/provider version
lifecycle state
error code if any
```

Metrics SHOULD include:

```text
sourceResolveMs
readinessMs
surfacePrepareMs
verificationMs
visibilityCommitMs
residentFraction
partialBytesRead
totalCarrierBytes
```

The MVP does not require production telemetry infrastructure; deterministic evidence artifacts are sufficient.

---

## 34. Claim Discipline

Allowed after successful closure:

> PNCW Core MVP implements a deterministic projection lifecycle and verified visibility commit over adapter-bounded external authorities, including a real read-only HDSRC→MRMIC vertical slice with partial materialization.

Not allowed:

> PNCW is a complete production projection-native AI operating system.

Not allowed:

> PNCW eliminates sequential computation.

Not allowed:

> Atomic reveal makes large output physically O(1).

---

## 35. Final Design Invariants

\[
\boxed{Ready\neq Projected\neq Verified\neq Visible}
\]

\[
\boxed{STALE\_SOURCE\neq INTEGRITY\_FAILURE}
\]

\[
\boxed{SourceID\neq ResultID\neq ManifestID\neq VerificationID\neq VisibilityCommitID}
\]

\[
\boxed{Identity\neq Authority}
\]

\[
\boxed{Visible\neq Resident}
\]

\[
\boxed{Projection\neq OwnershipTransfer}
\]

\[
\boxed{VisibilityCommit\neq WorldMutationCommit}
\]

\[
\boxed{DigestAgreement\neq StructuralSemanticValidity}
\]

\[
\boxed{SourceMutation\not\Rightarrow SilentProjectionMutation}
\]

\[
\boxed{SequentialComputation\not\Rightarrow SequentialVisibility}
\]

---

## 36. Final Design Decision

The PNCW Core MVP begins as a TypeScript/Node conformance-first coordination runtime that composes existing HDSRC and MRMIC/NVCL capabilities through explicit adapter ports.

This design intentionally minimizes new semantic ownership. PNCW adds only the currently missing layer:

\[
\boxed{
\text{Projection Contracts}
+
\text{Readiness}
+
\text{Verification}
+
\text{Visibility Lifecycle}
}
\]

This specification is the canonical basis for the implementation plan.
