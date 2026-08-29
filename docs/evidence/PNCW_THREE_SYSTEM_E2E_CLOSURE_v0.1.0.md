# PNCW v0.1.0 — Three-System Fresh E2E Closure Validation

**Date:** 2026-08-29 (Asia/Taipei)  
**Repository:** `kakon77777-commits/PNCW`  
**Scope:** close the remaining execution-evidence gap between HDSRC v0.10, actual MRMIC/NVCL Phase 14, and PNCW Core MVP.

## 1. Closure result

**PASS for the declared three-system read-only projection/visibility path.**

The validated same-workspace execution was:

```text
canonical HDSRC v0.10
        ↓
actual MRMIC LocalProcessHdsrcProvider
        ↓ JSONL stdio
actual MRMIC production Python host
        ↓
canonical HDSRC HPCM2 / HMR1 / HMBT1 runtime
        ↓
actual MRMIC createHdsrcMaterializationPortal(...)
        ↓
PNCW ProjectionReadinessGate
        ↓
non-visible surface binding
        ↓
PNCW ProjectionManifest
        ↓
PNCW ProjectionVerifier
        ↓
PNCW VisibilityCommit
        ↓
VISIBLE + partial physical residency
```

This closes the evidence gap intentionally left by Core MVP v0.1, where fresh HDSRC+PNCW execution and actual MRMIC checkout compatibility had been validated separately.

## 2. Provenance

PNCW executable baseline merged to `main` before this closure:

```text
51b941a23fc5f8b91e0fb55bea5fb766b2051784
```

Temporary snapshot-export commit:

```text
c1ad5c23a18f330782de6fd7d36348ac935f7df3
```

The snapshot-export commit adds only the temporary exporter workflow; the executable PNCW implementation is the already merged Core MVP baseline.

Actual MRMIC/NVCL checkout:

```text
1c3ec2b137cfe801c47b02cd64cb614f0bbaa97b
```

GitHub Actions runtime-snapshot artifact:

```text
artifact id: 9712765010
artifact SHA-256: 8a73093e1218b2efa5471868127c2374aacffffd67aef7faacc896cf2f9542b3
export workflow run: 33245718254
```

Canonical HDSRC v0.10 release ZIP:

```text
SHA-256: 583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217
```

## 3. Upstream sanity validation

Before running the PNCW closure, the actual `MRMIC_NVCL/main` production validator was executed against the same extracted canonical HDSRC release:

```text
scripts/validate_hdsrc_v010_bridge.py
```

Observed:

```text
schema                 = hdsrc-local-process-bridge-validation/v0.2
testStubRuntimeUsed    = false
canonicalMutation      = false
restartPersistence     = true
4096D decision         = oracle_fallback
oracleUsed             = true
logicalScale           = 32
spatializationId       = RCM_PP
carrierBytes           = 286313
partial bytes          = 1272
partial relations      = 256
```

Fresh upstream validation artifact SHA-256:

```text
30439128924de4f588347d05b104e2cc6658ef823456edb1b6b57c3210843b9e
```

This sanity gate prevents an upstream HDSRC/MRMIC failure from being misclassified as a PNCW integration failure.

## 4. Same-run three-system execution

A fresh registry bound:

```text
stateId       = state:4096
stateRevision = 10
principal     = principal:pncw-real
```

to the canonical HDS1 file in the extracted v0.10 release.

PNCW then invoked its production external-checkout path. The PNCW adapter dynamically loaded the actual MRMIC build exports, including `LocalProcessHdsrcProvider` and `createHdsrcMaterializationPortal(...)`. The local-process provider launched the actual MRMIC production Python host with `PYTHONPATH` pointed at the canonical HDSRC v0.10 `src` tree.

No test-stub runtime was used.

## 5. Source and materialization result

Canonical 4096D source:

```text
stateId       = state:4096
stateRevision = 10
dimension     = 4096
nodes         = 72
relations     = 576
stateDigest   = sha256:ea48a90eddc727b1684cf72204ddeaa720c6b67fe036561e05537622b0c12f85
```

Materialization:

```text
materializationId = mat:5473af99f81c9810984cafaaac4bf31837c768dcfad517b6fdab81408128a4f8
carrierProfile    = HMBT1
logicalScale      = 32
spatializationId  = RCM_PP
carrierBytes      = 286313
materializationDigest = sha256:4127f98f00cca7d85d2975e13186a2373814dbe0b53d611cf74215695e9e6c5b
workloadDigest        = sha256:488ae005d04ee7fb8e491e8c1bc205c839615690f97f1118e5e4d0d12ddd510b
```

The upstream sanity validator independently confirmed this 4096D route uses HPCM2 `oracle_fallback` and HMR1 resolves the materialization to HMBT1 b32 / `RCM_PP`.

## 6. Partial materialization / residency

Selected relation block-row:

```text
compressedBytesRead = 1272
carrierBytes         = 286313
```

Therefore:

```text
1272 / 286313 = 0.004442690342387527
```

or approximately **0.444%** of the carrier byte count for this workload.

This remains a workload-specific executable observation, not a universal scaling law.

## 7. PNCW visibility closure

PNCW produced:

```text
RID  = pncw:result:096296cee4e33f565198c658c60fe78f7881437916fe807dfd3b7f6ca5bd1f8f
MID  = sha256:c8d2ad40603774629d147624efa2ba748b822830488b10acdc1ab616c36eb28d
VID  = sha256:7948a833d6a6701cd8152966924a917ed212c9770f7f51227d26546c1453ce62
VCID = pncw:visibility:d7f9330b84ca08287beba7f6bbffa5c1220bcda709b5ba92c0d796464fa2bafb
state = VISIBLE
residentFraction = 0.0000034926688880040796
```

Thus this fresh same-workspace three-system run directly demonstrates:

```text
Visible = 1
AND
ResidentFraction < 1
```

while preserving the PNCW rule that the surface is non-visible before verification and visibility commit.

## 8. Deterministic replay

The entire fresh three-system execution was repeated after deleting the first materialization root and creating a new empty materialization root.

Both raw evidence files were byte-for-byte identical:

```text
run 1 SHA-256 = 5490d40508b0d80e4c1b22b09524e66213189220d1b2d84343333bc0c8e0f130
run 2 SHA-256 = 5490d40508b0d80e4c1b22b09524e66213189220d1b2d84343333bc0c8e0f130
```

The following all remained identical:

- RID;
- MID;
- VID;
- VCID;
- materialization ID;
- materialization digest;
- workload digest;
- logical scale;
- spatialization;
- partial-read byte count;
- carrier byte count;
- resident fraction.

## 9. Canonical committed evidence

Canonical closure artifact:

```text
artifacts/three-system-e2e-v0.1.0.json
```

File SHA-256:

```text
f7307ced2be850f368aefaa120825f66b3252bb05dea3da36f1685401b4de6d4
```

Embedded semantic evidence digest:

```text
sha256:dce34225c2a59431dbf8cbed5937bffb153824c10e554219dfac0f65dc408666
```

## 10. Authority and mutation boundary

The closure validates only a **read-only projection/visibility path**.

It preserves:

```text
HDSRC canonical authority
!=
MRMIC surface authority
!=
PNCW visibility authority
```

Observed:

```text
canonicalMutation = false
```

This closure does not introduce HDSRC canonical writeback, Canvas-pixel-to-symbolic mutation, world mutation commit, or unrestricted provider authority.

## 11. What is newly established

Before this closure, the strongest honest statement was:

```text
Fresh HDSRC + PNCW execution
+
Actual MRMIC checkout compatibility
```

After this closure, the following narrower but stronger statement is executable and supported:

```text
Fresh canonical HDSRC v0.10
→ actual MRMIC Phase 14 local-process bridge
→ actual MRMIC portal factory
→ PNCW Core readiness / verification / visibility
```

in one fresh same-workspace execution.

## 12. Explicit non-claims

This does not establish:

- full PNCW Paper 00–08 perception/cognition/actuation loop closure;
- GCM-driven dynamic projection planning;
- ACR ActiveCognitiveDomain integration;
- CSPMF/APR perception routing;
- PHOSPHOR/HVAP governed actuation;
- canonical HDSRC writeback;
- Canvas pixel edit → HDSRC symbolic mutation;
- production multi-tenant security certification;
- universal HDSRC scaling/performance superiority;
- replacement of autoregressive computation;
- physical O(1) output.

## 13. Closure decision

For the v0.1.0 read-only three-system integration boundary:

```text
Canonical HDSRC release identity          PASS
Actual MRMIC checkout/build               PASS
Actual LocalProcessHdsrcProvider          PASS
Actual production Python host             PASS
Real HPCM2/HMR1/HMBT1 path                PASS
Actual MRMIC portal factory               PASS
PNCW readiness                            PASS
PNCW manifest assembly                    PASS
PNCW independent verification             PASS
PNCW visibility commit                    PASS
Partial physical residency                PASS
No canonical mutation                     PASS
Two-run deterministic replay              PASS
```

Final result:

```text
PNCW v0.1.0 Three-System Fresh E2E Closure = PASS
```

for the declared read-only projection lifecycle and verified visibility boundary.
