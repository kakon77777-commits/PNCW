# PNCW Runtime Technical Whitepaper v0.1

## 投影原生計算世界執行期技術白皮書
### Projection-Native Computational World Runtime Technical Whitepaper v0.1

**Project:** Projection-Native Computational World (PNCW)  
**Document version:** v0.1  
**Canonical engineering baseline:** `kakon77777-commits/PNCW` tag `v0.1.0`  
**Canonical release commit:** `121bc1024277e7e21a14e8e1a92eed7dba02400d`  
**Date:** 2026-08-29  
**Status:** Public technical whitepaper / implementation-grounded architecture specification

---

## 摘要

PNCW 的核心問題不是「如何把 token 一次吐得更快」，而是重新切分：

\[
\boxed{
\text{Computation}
\neq
\text{Internal Representation}
\neq
\text{Projection}
\neq
\text{Observation}
\neq
\text{Presentation}
}
\]

PNCW 認為序列輸出只是一種觀察拓樸，而不是計算本身的普遍拓樸。因而：

\[
\boxed{\text{One-shot visibility}\neq\text{instant generation}}
\]

更精確地：

\[
\boxed{
\text{Atomic Logical Reveal}
+
\text{Progressive Physical Materialization}
}
\]

PNCW v0.1.0 已把這個命題縮成可執行核心：

\[
\boxed{
\text{Projection Lifecycle}
+
\text{Verified Visibility Commit}
}
\]

並完成 fresh canonical HDSRC v0.10 → actual MRMIC/NVCL Phase 14 → PNCW Core 的同一工作空間、read-only three-system E2E validation。

本白皮書不重新抄寫 Paper 00–08，而是以 v0.1.0 實作為基準回答：runtime 真正擁有什麼、各 authority 如何分離、哪些行為已驗證、哪些仍只是 contract vocabulary，以及下一階段如何接 GCM、ACR、CSPMF/APR 與 PHOSPHOR/HVAP。


# 1. 文件定位與 Source of Truth

Canonical source：

```text
Repository:
  kakon77777-commits/PNCW

Tag:
  v0.1.0

Commit:
  121bc1024277e7e21a14e8e1a92eed7dba02400d
```

主要實作：

```text
packages/core/
packages/adapters/
packages/readiness/
packages/verification/
packages/visibility/
packages/conformance/

adapters/fake-hdsrc/
adapters/fake-mrmic/
adapters/real-mrmic-hdsrc/

contracts/
tests/
artifacts/
docs/evidence/
docs/releases/
```

本文件使用五種成熟度標記：

- **IMPLEMENTED**：v0.1.0 runtime 已存在。
- **VALIDATED**：已有執行證據。
- **CONTRACT-LEVEL**：型別或 vocabulary 已存在，但不代表完整行為引擎完成。
- **PLANNED**：下一階段整合。
- **OPEN**：尚未閉合。

PNCW 的 claim discipline 要求：component evidence 不能被升級成 universal proof。


# 2. 最小工程命題

PNCW runtime 的最小命題：

\[
\boxed{
\text{Result Existence}
\neq
\text{Result Visibility}
\neq
\text{Full Residency}
}
\]

主 lifecycle：

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
   ↓
SUPERSEDED
```

failure states：

```text
STALE
INTEGRITY_FAILURE
UNAUTHORIZED
UNSUPPORTED
UNAVAILABLE
CONFLICT
ABORTED
```

因此：

\[
READY\not\rightarrow VISIBLE
\]

\[
PROJECTED\not\rightarrow VISIBLE
\]

\[
FAILED\not\rightarrow VISIBLE
\]

這是 executable invariant，而不是 UI convention。


# 3. v0.1.0 正式範圍

## 3.1 已實作與驗證

- versioned projection contracts；
- deterministic RID / MID / VID / VCID；
- typed lifecycle；
- typed fail-closed error taxonomy；
- source / surface capability negotiation；
- independent source-read / surface-project authority；
- `ProjectionReadinessGate`；
- read-only HDSRC adapter；
- read-only MRMIC surface adapter；
- non-visible surface preparation；
- deterministic immutable `ProjectionManifest`；
- independent `ProjectionVerifier`；
- live non-serializable verification proof；
- idempotent `VisibilityCommitStore`；
- residency accounting；
- fake-provider conformance / negative controls；
- actual MRMIC Phase 14 external checkout validation；
- fresh HDSRC v0.10 → actual MRMIC → PNCW E2E evidence。

## 3.2 尚未實作

```text
GCM-driven dynamic projection planning
ACR ActiveCognitiveDomain integration
CSPMF/APR perceptual routing
PHOSPHOR/HVAP governed actuation
canonical HDSRC writeback
Canvas pixel → HDSRC symbolic mutation
general projected mutation return path
full Paper 00–08 perception–cognition–actuation loop
production multi-tenant security certification
```

正確 release statement：

\[
\boxed{
\text{PNCW v0.1.0}
=
\text{Sealed Executable Projection/Visibility Substrate}
}
\]


# 4. 五層非折疊關係

\[
\boxed{
\text{Source}
\neq
\text{Materialization}
\neq
\text{Surface}
\neq
\text{Verified Artifact}
\neq
\text{Visible Artifact}
}
\]

**Source** 是 external canonical authority 的狀態。v0.1.0 three-system path 中，canonical source authority 是 HDSRC。

**Materialization** 是 carrier/resource，不是 canonical state 本身。

**Surface** 是 observer / Canvas / portal 投影表面。MRMIC 可以擁有 Canvas 幾何與 surface lifecycle，但不因此取得 HDSRC canonical authority。

**Verified Artifact** 是 PNCW 在當下重新查驗 identity、freshness、authority、surface binding、structural integrity、manifest digest 與 residency root 後得到的結果。

**Visible Artifact** 只有經 `VisibilityCommit` 後才是 observer-authoritative result。

所以：

\[
\boxed{
\text{Visibility Commit}
\neq
\text{World Mutation Commit}
}
\]


# 5. Package Architecture

```text
packages/
├─ core/
│  ├─ canonical.ts
│  ├─ contracts.ts
│  ├─ errors.ts
│  ├─ identity.ts
│  ├─ lifecycle.ts
│  ├─ manifest.ts
│  ├─ validate.ts
│  └─ verification-proof.ts
├─ adapters/
├─ readiness/
├─ verification/
├─ visibility/
└─ conformance/

adapters/
├─ fake-hdsrc/
├─ fake-mrmic/
└─ real-mrmic-hdsrc/
```

核心設計原則：

\[
\boxed{
\text{PNCW}
=
\text{Protocol}
+
\text{Coordination}
+
\text{Readiness}
+
\text{Verification}
+
\text{Visibility Semantics}
}
\]

而不是把 HDSRC、MRMIC、GCM 複製進一個 monolith。


# 6. Canonical Contracts

v0.1.0 的核心 vocabulary：

```text
ObservationMode
RevealMode
ResidencyState
LifecycleState
PncwErrorCode
PncwStage

ObserverProfileV1
RepresentationProfileV1
ProjectionScopeV1
AuthorityContextV1
SourceIdentityV1
SourceCapabilitiesV1
SurfaceCapabilitiesV1
MaterializationRefV1
PreparedSurfaceV1
SurfaceRefV1
IntegrityRefV1
AuthorityRefV1
ResidencyEntryV1
ProjectionRequestV1
ProjectionManifestV1
ReadinessResultV1
VerificationResultV1
VisibilityStateV1
PncwErrorEnvelopeV1
```

Observation modes：

```text
human_preview
machine_carrier
structured_manifest
```

RevealMode vocabulary：

```text
ATOMIC_ARTIFACT
SEMANTIC_BATCH
STREAM
HYBRID
```

但：

\[
\boxed{
\text{RevealMode enum exists}
\not\Rightarrow
\text{four independent transport engines implemented}
}
\]

v0.1.0 真正已驗證的是 `VERIFIED → VISIBLE`、idempotent VCID、logical visibility 與 partial residency。


# 7. ProjectionRequest 與 AuthorityContext

```ts
interface ProjectionRequestV1 {
  schema: 'pncw-projection-request/v1'
  requestId: string
  sourceRef: string
  observer: ObserverProfileV1
  representation: RepresentationProfileV1
  scope: ProjectionScopeV1
  requestedMode: ObservationMode
  authorityContext: AuthorityContextV1
}
```

最小 authority：

```ts
interface AuthorityContextV1 {
  principalId: string
  sourceRead: boolean
  surfaceProject: boolean
}
```

因此：

\[
\boxed{
\text{Source Authority}
\neq
\text{Surface Authority}
}
\]

`sourceRead=true` 不會自動讓 MRMIC surface authorized；MRMIC adapter 還有自己的 allowed-principal policy。


# 8. Deterministic Identity

四個核心 semantic identities：

\[
\boxed{RID,\ MID,\ VID,\ VCID}
\]

RID：

\[
RID=
H(
SourceIdentity,
Scope,
ObserverProfile,
ProjectionProfile,
ProtocolVersion
)
\]

MID：

\[
MID=
H(
Manifest-\{manifestDigest,generatedAt,visibleAt\}
)
\]

VID：

\[
VID=
H(
Verification-\{verificationDigest,verifiedAt,visibleAt\}
)
\]

VCID：

\[
VCID=
H(
RID,
MID,
VID,
RevealMode
)
\]

所以：

\[
\boxed{
\text{Temporal Metadata}
\neq
\text{Semantic Identity}
}
\]

`visibleAt` 不會改變 VCID。


# 9. Cross-Language Canonicalization Hardening

v0.1.0 closure 實際抓到一個重要問題：最初 evidence digest 使用 Python JSON serialization 計算，而 PNCW canonical digest 使用 JavaScript `JSON.stringify` numeric representation。

在：

```text
residentFraction = 0.0000034926688880040796
```

這類浮點數上，兩邊不保證 byte-identical。

第一輪 CI：

```text
Run 33245971511
49 tests / 46 PASS / 1 FAIL / 2 SKIP
```

唯一 failure 是 semantic evidence digest mismatch。

PNCW 沒有修改 canonicalization 迎合 evidence，而是讓 evidence 回到 PNCW Core `sha256Digest(...)`。

最終 semantic digest：

```text
sha256:4af48ceb91ae4b0cc1c327e3715c617e094466dbed53cce71625ad28f55273e5
```

因此：

\[
\boxed{
\text{Equivalent Logical JSON}
\not\Rightarrow
\text{Equivalent Cross-Language Canonical Bytes}
}
\]

未來若需要真正跨語言 identity，可考慮 RFC 8785 JCS、canonical CBOR 或 schema-constrained normalized numeric encoding。


# 10. Error Taxonomy

核心 error code：

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

最重要的分離：

\[
\boxed{
STALE\_SOURCE
\neq
INTEGRITY\_FAILURE
}
\]

stale 通常表示 valid-but-changed lineage，可重 resolve / materialize；integrity failure 表示 malformed / corrupted / structurally invalid，應 fail closed。

因此：

```text
changed valid source → STALE_SOURCE / often retryable
malformed carrier    → INTEGRITY_FAILURE / non-retryable
```


# 11. ProjectionReadinessGate

實際 readiness 順序：

```text
1. validate request
2. get source capabilities
3. get surface capabilities
4. observation mode supported
5. carrier profile supported
6. protocol version == pncw/0.1
7. scope is bounded/non-empty
8. source authority
9. resolve source
10. surface authority
11. resolve materialization
12. freshness check
13. structural integrity
14. manifest preconditions complete
```

所以 readiness 可抽象為：

\[
R_P =
C_{mode}
\land C_{carrier}
\land C_{frame}
\land C_{scope}
\land C_{sourceAuth}
\land C_{surfaceAuth}
\land C_{fresh}
\land C_{structural}
\]

但：

\[
\boxed{
ProjectionReady
\neq
Verified
\neq
Visible
}
\]

readiness 不建立 observer-authoritative visibility。


# 12. Surface Preparation 與 Manifest

`PreparedSurfaceV1` 明確要求：

```ts
visible: false
```

也就是 surface 可先被準備、綁定幾何與 portal identity，但尚未對 observer 成為 authoritative。

`ProjectionManifestV1` 組合：

```text
resultId
sourceIdentity
projectionProfile
materializationRefs
surfaceRefs
integrityRefs
authorityRefs
residencyMap
version
manifestDigest
```

`buildProjectionManifest()` 的關鍵 runtime invariant：

```text
surface.visible == true
→ INVALID_TRANSITION
```

同時 manifest 會 recursive `Object.freeze()`。

因此：

\[
\boxed{
\text{Assembled Manifest}
\rightarrow
\text{Immutable Runtime Manifest}
}
\]


# 13. ProjectionVerifier

ProjectionVerifier 不相信 manifest 自己宣稱自己正確。

它重新檢查：

```text
manifest schema
manifest digest
RID recomputation
source authority
surface authority
current source identity
single materialization/surface MVP constraint
materialization lineage
current surface state
surface snapshot digest
surface lineage
materialization freshness
provider structural integrity
declared structural integrity
root residency
```

因此：

\[
\boxed{
\text{Manifest Self-Consistency}
\not\Rightarrow
\text{Projection Validity}
}
\]

若 source/materialization/surface lineage 混版：

```text
VERSION_CONFLICT
```

而不是「盡量顯示」。


# 14. Live Verification Proof

成功 verification 會被 runtime 加上一個 non-enumerable Symbol brand：

```text
pncw-live-verification-proof
```

它：

- 不會進 JSON；
- 不會被 serialization 保存；
- 只能由當前 verifier runtime 對 `verified=true` 結果加上。

VisibilityCommit 會要求：

```text
hasLiveVerificationProof(...) == true
```

因此：

\[
\boxed{
\text{Persisted VERIFIED JSON}
\neq
\text{Current Live Verification}
}
\]

這直接阻斷：

```text
provider restart
→ load old verified.json
→ blind recommit
```


# 15. VisibilityCommit

commit 前檢查：

```text
legal VERIFIED → VISIBLE transition
verification.verified == true
verification/result identity matches manifest
manifest digest recomputes
verification digest recomputes
live verification proof exists
root manifest residency is valid
```

之後導出：

\[
VCID=H(RID,MID,VID,RevealMode)
\]

再建立 `VISIBLE` state。

因此：

\[
\boxed{
\text{Visibility Authority}
\neq
\text{Mutation Authority}
}
\]

VisibilityCommit 無權：

```text
write HDSRC state
patch symbolic graph
commit world mutation
grant provider authority
perform physical actuation
```


# 16. Idempotency 與 Atomic Logical Reveal

同一 VCID 重送：

\[
\boxed{
Commit(VCID)^n = Commit(VCID)
}
\]

不會生成多個 semantic visibility events。

PNCW 的 Atomic Reveal 定義不是「所有 bytes 瞬間出現在 RAM」，而是：

> result root identity、manifest、version、lineage、integrity、authority refs 與 region namespace 在同一 visibility boundary 成為 authoritative。

所以：

\[
\boxed{
\mathsf{Visible}(RID)=1
}
\]

可以同時：

\[
\boxed{
0<\rho_{resident}<1
}
\]


# 17. Residency Model

Residency states：

```text
DECLARED
AVAILABLE
RESIDENT
UNAVAILABLE
INVALID
```

因此：

\[
\boxed{
Available\neq Resident
}
\]

\[
\boxed{
Visible\neq Resident
}
\]

byte-level resident fraction：

\[
\rho=
\frac{\sum bytesResident}{\sum bytesTotal}
\]

root manifest 不可是 `INVALID` / `UNAVAILABLE`，但 detail regions 可以仍未 resident。

這形成：

\[
\boxed{
\text{Logical Completeness}
\neq
\text{Full Physical Residency}
}
\]


# 18. HDSRC Port 與 Real Adapter

PNCW source port 的 read-side 能力：

```text
getCapabilities()
checkAuthority()
resolveSource()
resolveMaterialization()
checkFreshness()
verifyMaterialization()
readSelectedRegion()
```

故意沒有：

```text
write()
patch()
replace()
commitCanonicalState()
mutateGraph()
```

所以：

\[
\boxed{
\text{Read Adapter}
\not\supset
\text{Canonical Mutation API}
}
\]

Real adapter 包裝 actual MRMIC Phase-14-compatible provider：

```text
capabilities()
state()
materializeResolved()
materialization()
readPartialRelationBlockRow()
```

它不重新實作 HDSRC。


# 19. Real Adapter Workload 與 GCM 邊界

Real HDSRC adapter 可帶：

```text
goalClass
expectedSpan
expectedReuse
latencyClass
```

並建立 HDSRC workload hint。

但 v0.1.0 的 workload profile 是 adapter configuration，不是 GCM。

因此：

\[
\boxed{
\text{Fixed Adapter Workload Hint}
\neq
\text{GCM Projection Planning}
}
\]

這個區分很重要，因為 v0.2 才應讓 planner 動態決定 representation / scope / resource budget。


# 20. HDSRC Read-Only Fail-Closed

Real adapter 要求 upstream capability：

```text
canonicalMutation === false
```

若 provider 意外宣稱 mutation capability，v0.1.0 不會「順便開放更強功能」，而是 fail closed。

\[
\boxed{
\text{Unexpected Mutation Capability}
\rightarrow
\text{Integrity Failure}
}
\]

這把 release scope 寫進 executable boundary。


# 21. MRMIC Surface Adapter

MRMIC adapter 的 capability：

```text
provider           = mrmic
providerVersion    = 0.14
portalSchema       = native_resource_portal_v1
readOnlyProjection = true
canonicalMutation  = false
```

surface authority：

```text
context.surfaceProject
AND
principal ∈ independently configured allowed set
```

所以：

\[
\boxed{
\text{PNCW Requested Capability}
+
\text{MRMIC Independent Authorization}
}
\]

兩者都要成立。

MRMIC 擁有 Canvas/portal geometry；PNCW 擁有 projection visibility semantics。

\[
\boxed{
\text{Canvas Exists}
\neq
\text{PNCW Result Visible}
}
\]


# 22. Three-System Fresh E2E

v0.1.0 已完成：

```text
Canonical HDSRC v0.10
        ↓
Actual MRMIC LocalProcessHdsrcProvider
        ↓ JSONL stdio
Actual MRMIC Production Python Host
        ↓
Canonical HDSRC HPCM2 / HMR1 / HMBT1
        ↓
Actual MRMIC createHdsrcMaterializationPortal(...)
        ↓
PNCW ProjectionReadinessGate
        ↓
Non-visible Surface
        ↓
ProjectionManifest
        ↓
ProjectionVerifier
        ↓
VisibilityCommit
        ↓
VISIBLE
```

這是同一 fresh workspace execution，不再只是「fresh HDSRC+PNCW」與「actual MRMIC checkout compatibility」兩條分離 evidence。


# 23. 4096D Validation Evidence

HDSRC release ZIP：

```text
583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217
```

canonical 4096D state：

```text
dimension = 4096
nodes     = 72
relations = 576
revision  = 10
stateDigest =
sha256:ea48a90eddc727b1684cf72204ddeaa720c6b67fe036561e05537622b0c12f85
```

HPCM2：

```text
oracle_fallback
reason = outside_current_trust_region
```

HMR1：

```text
HMBT1
logicalScale = 32
spatializationId = RCM_PP
```

carrier：

```text
286,313 bytes
```

partial relation block-row：

```text
1,272 bytes
≈ 0.444% of carrier byte count
```

這是 workload-specific executable evidence，不是 universal scaling law。


# 24. Fresh PNCW Identity Evidence

```text
RID
pncw:result:096296cee4e33f565198c658c60fe78f7881437916fe807dfd3b7f6ca5bd1f8f

MID
sha256:c8d2ad40603774629d147624efa2ba748b822830488b10acdc1ab616c36eb28d

VID
sha256:7948a833d6a6701cd8152966924a917ed212c9770f7f51227d26546c1453ce62

VCID
pncw:visibility:d7f9330b84ca08287beba7f6bbffa5c1220bcda709b5ba92c0d796464fa2bafb
```

最後：

```text
state = VISIBLE
residentFraction = 0.0000034926688880040796
```

所以：

\[
\boxed{
LogicalVisible=1
\land
ResidentFraction<1
}
\]

已有 real execution evidence。


# 25. Deterministic Replay

整條 fresh three-system execution 在新的 empty materialization root 下重跑第二次。

兩次 raw evidence SHA-256 都是：

```text
5490d40508b0d80e4c1b22b09524e66213189220d1b2d84343333bc0c8e0f130
```

byte-for-byte identical。

一致項目：

```text
RID / MID / VID / VCID
materializationId
materializationDigest
workloadDigest
logicalScale
spatializationId
partial-read bytes
carrier bytes
resident fraction
```

因此固定 baseline 下的 deterministic replay 已被實際驗證。


# 26. Negative Controls

v0.1.0 至少包含：

```text
unknown contract fields
invalid lifecycle shortcut
stale source
structural integrity failure
source authority denial
surface authority denial
unsupported observation mode
mixed source/materialization/surface version
wrong manifest digest
invalid root residency
metadata/digest rebinding
serialized VERIFIED blind recommit
provider restart without fresh verification
source mutation after manifest assembly
surface unavailable after readiness
duplicate visibility commit
```

這些測試的重點是：

\[
\boxed{
\text{What Must Never Happen}
}
\]

也被寫成 executable behavior。


# 27. Digest Rebinding 與 Structural Validity

攻擊者可能：

```text
modify carrier
recompute SHA
recompute materialization identity
rewrite URI
rewrite manifest
make metadata self-consistent
```

但 metadata 自洽不代表 machine semantics 有效。

所以：

\[
\boxed{
\text{Digest Rebinding}
\not\Rightarrow
\text{Valid Machine Semantics}
}
\]

\[
\boxed{
\text{Cryptographic Digest Agreement}
\neq
\text{Structural Semantic Validity}
}
\]

PNCW 因此保留 upstream structural verification，不只驗 metadata equality。


# 28. Reference Request

```json
{
  "schema": "pncw-projection-request/v1",
  "requestId": "req:4096-demo",
  "sourceRef": "state:4096",
  "observer": {
    "observerId": "observer:demo",
    "observerType": "ai",
    "profile": "machine-structured"
  },
  "representation": {
    "profile": "HMBT1",
    "protocolVersion": "pncw/0.1"
  },
  "scope": {
    "scopeId": "scope:relation-row-0",
    "regionRefs": [
      "relation:block-row:0"
    ]
  },
  "requestedMode": "machine_carrier",
  "authorityContext": {
    "principalId": "principal:pncw-real",
    "sourceRead": true,
    "surfaceProject": true
  }
}
```

注意：`surfaceProject=true` 仍不等於 MRMIC 真正 authorization；MRMIC 自己的 principal policy 仍須通過。


# 29. Current Runtime Flow

```text
ProjectionRequest
      ↓
ProjectionReadinessGate
      ↓
Resolved Source
      ↓
Resolved Materialization
      ↓
Structural Verification
      ↓
prepareSurface()
      ↓
bindProjection()
      ↓
buildProjectionManifest()
      ↓
ProjectionVerifier
      ↓
Live Verification Proof
      ↓
VisibilityCommitStore
      ↓
VISIBLE
      ↓
optional selected-region read
```

這裡最重要的架構價值是：每個 boundary 都可獨立 fail，不需要把全部狀態壓成一個 `success=true`。


# 30. 為什麼 Readiness / Verification / Visibility 不能合併

Readiness 問：

> 是否有足夠前置條件開始建立 projection？

Verification 問：

> projection 組裝後，現在是否仍與 source、surface、authority、freshness、integrity 一致？

Visibility 問：

> 這個已驗證 artifact 是否現在要成為 observer-authoritative result？

例如：

```text
t0 readiness passes
t1 source changes
t2 old materialization binds
t3 verification
```

如果 readiness=verification，\(t_1\) 的 stale transition 可能被漏掉。

因此：

\[
\boxed{
\text{Precondition Validation}
\neq
\text{Post-Assembly Verification}
\neq
\text{Publication / Visibility Promotion}
}
\]


# 31. Current Reveal Semantics 的 Claim Boundary

理論系列有：

```text
STREAM / BATCH / ATOMIC / CANVAS / HYBRID
```

v0.1.0 runtime contract 有：

```text
ATOMIC_ARTIFACT / SEMANTIC_BATCH / STREAM / HYBRID
```

**已驗證：**

```text
VERIFIED → VISIBLE
atomic logical authority promotion
idempotent VCID
partial residency after visible
```

**未宣稱完整完成：**

```text
high-throughput stream transport
semantic batch scheduler
Canvas-native multi-region reveal engine
hybrid transport/materialization policy engine
```

所以：

\[
\boxed{
\text{Visibility Semantics Implemented}
\neq
\text{All Presentation Engines Implemented}
}
\]


# 32. Security Boundary

v0.1.0 已證明：

```text
source authority checked
surface authority independent
protected read gated
read-only boundary explicit
stale/integrity/version fail closed
live proof blocks blind recommit
```

但尚未完成：

```text
production multi-tenant isolation
formal delegated capability chain
distributed revocation
network transport authentication
hardware-backed trust
zero-trust federation
security certification
```

因此：

```text
Security semantics: IMPLEMENTED / TESTED
Production security certification: OPEN
```


# 33. PNCW 與 HDSRC / MRMIC 的 Authority Contract

HDSRC 擁有：

```text
canonical source identity
state revision / digest
carrier/materialization semantics
HPCM2 / HMR1 / HMBT1 behavior
partial relation structural decode
```

MRMIC 擁有：

```text
Canvas / portal representation
surface identity
geometry
visual/resource projection
```

PNCW 擁有：

```text
projection request semantics
readiness
cross-provider lineage assembly
manifest identity
verification lifecycle
visibility authority
```

因此：

\[
\boxed{
\text{HDSRC Canonical Authority}
\neq
\text{MRMIC Surface Authority}
\neq
\text{PNCW Visibility Authority}
}
\]


# 34. GCM Integration — Proposed v0.2

v0.1.0 的 representation / scope / requestedMode 由 request 或 integration configuration 給定。

v0.2 的核心變化：

```text
Task / Goal
    ↓
GCM
    ↓
ProjectionPlan
    ↓
PNCW
```

GCM 可負責選：

```text
representation
carrier route
resolution
scope
materialization budget
resource placement
observation topology
reveal strategy candidate
```

但必須保持：

\[
\boxed{
\text{GCM Selected}
\neq
\text{PNCW Ready}
}
\]

以及：

\[
\boxed{
\text{Planner Decision}
\neq
\text{Execution Authority}
}
\]

GCM 不能繞過 v0.1.0 的 authority / freshness / integrity / verification / visibility kernel。


# 35. Proposed GCM Plan Contract

```ts
interface GcmProjectionPlanRefV1 {
  planId: string
  planDigest: string
  selectedRepresentation: string
  selectedObservationMode: string
  scopePolicy: string
  materializationBudget: {
    bytes?: number
    regions?: number
    latencyClass?: string
  }
  plannerVersion: string
}
```

這是 **PLANNED**，不是 v0.1.0 contract。

v0.2 最重要的工程原則是：

> 在 v0.1.0 上面加 planner，而不是重寫 readiness / verifier / visibility。


# 36. ACR Integration — Proposed v0.3

ACR 提供：

\[
\boxed{
C_t^{active}
\subseteq
C_t^{resident}
\subseteq
\mathcal M_t^{total}
}
\]

未來：

```text
Memory World
      ↓
ACR ContextCapsule
      ↓
ActiveCognitiveDomain
      ↓
GCM Projection Plan
      ↓
PNCW
```

但：

\[
\boxed{
\text{Context Compression}
\neq
\text{World Mutation}
}
\]

PNCW 不應把 active context 誤當 whole-world authority。


# 37. Software Spacetime / Perception / Actuation — Planned

Software Spacetime：

\[
\boxed{
\text{State Projection}
\subset
\text{Spacetime Projection}
}
\]

未來 projection scope 可加入：

```text
TemporalWindow
CausalScope
BranchRef
ReplayRef
SpacetimeProjectionScope
```

並保持：

\[
\boxed{
\text{Serialization Order}
\neq
\text{Necessary Causal Order}
}
\]

完整 closed-loop target：

```text
Software Spacetime World
→ Machine Observation
→ Evidence
→ APR Perceptual Routing
→ ACR Active Cognitive Domain
→ GCM Plan
→ SPET
→ HDSRC
→ MRMIC/NVCL
→ PNCW Verification / Visibility
→ Action Proposal
→ APR Action Readiness
→ PHOSPHOR/HVAP Authority
→ Provider
→ Receipt
→ New Observation
→ Independent Outcome Verification
```

此圖是 **target architecture**，不是 v0.1.0 completed system。


# 38. Projection Readiness ≠ Action Readiness ≠ Authorization

未來接 APR / PHOSPHOR 後必須保持：

\[
\boxed{
ProjectionReady
\neq
ActionReady
\neq
Authorized
}
\]

- `ProjectionReady`：可以安全建立 observation projection。
- `ActionReady`：現有 evidence 是否足以提出執行候選。
- `Authorized`：governance / capability / policy 是否真正允許 provider apply。

三者不能共用同一 boolean。

同理：

\[
\boxed{
APR\_ALLOW
\neq
PHOSPHOR\_AUTHORIZED
}
\]

以及：

\[
\boxed{
Receipt
\neq
IndependentVerification
}
\]


# 39. v0.2 Acceptance Criteria

建議：

```text
1. GCM plan contract versioned
2. deterministic plan→request compilation
3. unsupported plan fails before materialization
4. GCM cannot grant authority
5. semantic plan change changes identity when required
6. planner timestamps do not affect semantic identity
7. materialization budget enforced
8. at least two legal projection routes
9. deterministic selection under fixed input
10. typed fallback route
11. all v0.1.0 negative controls remain green
12. real HDSRC/MRMIC path remains compatible
```

核心：

\[
\boxed{
\text{Reuse v0.1.0 Verified Visibility Kernel}
}
\]


# 40. Benchmark 與 Falsification

PNCW benchmark 不應只看 tokens/sec。

### Logical metrics

```text
time-to-authoritative-root
time-to-first-addressable-region
verification latency
visibility commit latency
manifest assembly latency
```

### Physical metrics

```text
bytes transferred
bytes resident
carrier bytes
partial-read bytes
decoded regions
rendered regions
```

### Integrity metrics

```text
stale detection
mixed-version rejection
tamper detection
rebind detection
blind-recommit rejection
```

### Determinism metrics

```text
RID / MID / VID / VCID replay stability
materialization replay stability
```

重要 falsification gates：

```text
mixed-version prevention
stale rejection
malformed carrier fail-closed
partial residency != semantic incompleteness
planner selection cannot grant authority
metadata rebinding cannot bypass structural validation
HDSRC auth != MRMIC auth
visibility authorization != action authorization
Canvas geometry mutation cannot mutate HDSRC source identity
```


# 41. Maturity Matrix

| Layer | Status | Notes |
|---|---|---|
| Core contracts | RELEASED | v0.1.0 |
| Identity | RELEASED | deterministic RID/MID/VID/VCID |
| Lifecycle | RELEASED | typed transitions |
| Readiness | RELEASED | executable |
| Manifest | RELEASED | deterministic + frozen |
| Verification | RELEASED | current upstream revalidation |
| Live proof | RELEASED | non-serializable |
| Visibility | RELEASED | idempotent commit |
| Residency | RELEASED | visible != resident |
| Fake adapters | RELEASED | conformance / negative controls |
| Real HDSRC adapter | RELEASED | read-only |
| Real MRMIC adapter | RELEASED | read-only portal |
| Three-system E2E | VALIDATED | fresh 4096D |
| GCM integration | PLANNED | proposed v0.2 |
| ACR integration | PLANNED | proposed v0.3 |
| Perception/APR | PLANNED | proposed v0.4 |
| PHOSPHOR/HVAP | PLANNED | proposed v0.5 |
| Canonical writeback | OPEN | deliberately absent |
| Full closed loop | OPEN | not claimed |


# 42. Release Evidence

```text
PR #1 — Core MVP
Core merge:
51b941a23fc5f8b91e0fb55bea5fb766b2051784

PR #2 — Three-System Fresh E2E Closure
Closure merge:
288f7f6cbeca15a40bbc28e8b85dd95d6d3630a9

PR #3 — Canonical Release Seal
Release commit:
121bc1024277e7e21a14e8e1a92eed7dba02400d

Tag:
v0.1.0
```

canonical evidence：

```text
artifacts/three-system-e2e-v0.1.0.json
```

file SHA-256：

```text
7d9da62224b23ea353a781de7971e0966e773761a49e83d7e6a32e0383893340
```

semantic digest：

```text
sha256:4af48ceb91ae4b0cc1c327e3715c617e094466dbed53cce71625ad28f55273e5
```


# 43. Toolchain / Test Line

release line：

```text
Node.js     22.5.1
TypeScript  5.8.3
Ajv         8.18.0
```

Core release closure：

```text
49 tests
47 PASS
0 FAIL
2 intentional environment SKIP
```

Actual MRMIC checkout gate：

```text
49 tests
48 PASS
0 FAIL
1 fresh-HDSRC-in-CI SKIP
```

fresh HDSRC three-system E2E 有獨立 committed evidence，不拿 CI skip 冒充 execution evidence。

dependency gate：

```text
npm audit --audit-level=moderate
0 vulnerabilities
```

在 release validation dependency graph 下成立。


# 44. 公開 Claim Boundary

PNCW v0.1.0 可以說：

> PNCW v0.1.0 implements a deterministic, fail-closed projection lifecycle with independently verified visibility-commit semantics, and validates a fresh read-only HDSRC v0.10 → actual MRMIC Phase 14 → PNCW execution path in which a logically visible result exists without requiring full carrier residency.

不應說：

```text
PNCW solved non-autoregressive AI generation.
PNCW makes arbitrary large output O(1).
HDSRC proves universal image-native performance superiority.
PNCW already has autonomous governed actuation.
```

因此：

\[
\boxed{
\text{Semantic / Runtime Closure}
\neq
\text{Universal Performance Proof}
}
\]


# 45. 核心工程原則

\[
\boxed{
\text{Compute Globally}
}
\]

\[
\boxed{
\text{Project Selectively}
}
\]

\[
\boxed{
\text{Verify Independently}
}
\]

\[
\boxed{
\text{Reveal Atomically at the Logical Boundary}
}
\]

\[
\boxed{
\text{Materialize Progressively}
}
\]

\[
\boxed{
\text{Actuate Only Through Separate Authority}
}
\]


# 46. 結論

PNCW v0.1.0 最重要的成果不是它已完成投影原生 AI 世界的全部願景，而是第一個最難說清楚的工程邊界已經從理論變成 runtime：

\[
\boxed{
\text{Result Computed / Materialized}
\neq
\text{Result Authoritatively Visible}
}
\]

以及：

\[
\boxed{
\text{Authoritatively Visible}
\neq
\text{Fully Physically Resident}
}
\]

v0.1.0 把以下鏈條封裝成可執行、可測、可失敗、可重播的 reference substrate：

\[
\boxed{
\text{ProjectionRequest}
\rightarrow
\text{Readiness}
\rightarrow
\text{Non-visible Projection}
\rightarrow
\text{Manifest}
\rightarrow
\text{Independent Verification}
\rightarrow
\text{Live Proof}
\rightarrow
\text{Visibility Commit}
\rightarrow
\text{Visible Result}
}
\]

並以 fresh canonical HDSRC v0.10、actual MRMIC Phase 14 與 4096D carrier 完成 real three-system validation。

因此，v0.1.0 之後不需要再回頭問：

>「投影原生 visibility lifecycle 能不能存在？」

下一個問題是：

>「誰決定應該投影什麼、以什麼 representation、scope、resource budget 與 observation topology？」

這正是 GCM integration 的工作。

所以建議下一階段：

\[
\boxed{
\text{PNCW v0.2}
=
\text{GCM-Guided Projection Planning}
+
\text{v0.1.0 Verified Visibility Kernel}
}
\]

v0.1.0 本身保持封板，作為後續 projection-native runtime 的 canonical executable foundation。

---

## Appendix A — Canonical References

```text
PNCW Repository
kakon77777-commits/PNCW

PNCW Tag
v0.1.0

PNCW Release Commit
121bc1024277e7e21a14e8e1a92eed7dba02400d

Core MVP Merge
51b941a23fc5f8b91e0fb55bea5fb766b2051784

Three-System Closure Merge
288f7f6cbeca15a40bbc28e8b85dd95d6d3630a9

HDSRC v0.10 Release SHA-256
583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217

HDSRC 4096D State Digest
sha256:ea48a90eddc727b1684cf72204ddeaa720c6b67fe036561e05537622b0c12f85

MRMIC/NVCL Validated Commit
1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b

Three-System Evidence File SHA-256
7d9da62224b23ea353a781de7971e0966e773761a49e83d7e6a32e0383893340

PNCW Semantic Evidence Digest
sha256:4af48ceb91ae4b0cc1c327e3715c617e094466dbed53cce71625ad28f55273e5
```

## Appendix B — Canonical Runtime Source Paths

```text
packages/core/src/contracts.ts
packages/core/src/identity.ts
packages/core/src/lifecycle.ts
packages/core/src/manifest.ts
packages/core/src/verification-proof.ts

packages/adapters/src/hdsrc-port.ts
packages/adapters/src/mrmic-port.ts

packages/readiness/src/index.ts
packages/verification/src/index.ts
packages/visibility/src/index.ts
packages/conformance/src/index.ts

adapters/fake-hdsrc/src/index.ts
adapters/fake-mrmic/src/index.ts
adapters/real-mrmic-hdsrc/src/index.ts

artifacts/three-system-e2e-v0.1.0.json
docs/evidence/three-system-e2e-v0.1.0.schema.json
docs/evidence/PNCW_THREE_SYSTEM_E2E_CLOSURE_v0.1.0.md
docs/releases/PNCW_v0.1.0_RELEASE_SEAL.md
```

## Appendix C — One-Line Definition

\[
\boxed{
\textbf{PNCW is a runtime methodology for turning externally authoritative computational state into independently verified, observer-authoritative projections whose logical visibility is decoupled from full physical materialization.}
}
\]
