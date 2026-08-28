# PNCW Core MVP Execution Clarifications

**Applies to:** `docs/superpowers/plans/2026-08-28-pncw-core-mvp-implementation.md`  
**Spec:** `docs/superpowers/specs/2026-08-28-pncw-core-mvp-design.md`  
**Status:** Normative execution clarification

## 1. Canonical M8 ordering

The real 4096D vertical slice MUST preserve the same gate ordering as the fake/conformance path. The canonical execution order is:

```text
1. Open the real adapter and negotiate source/surface capabilities.
2. Run ProjectionReadinessGate.
   - resolve real HDSRC state;
   - check HDSRC source authority;
   - materializeResolved through upstream LocalProcessHdsrcProvider;
   - establish freshness;
   - force upstream machine-resource structural validation before reporting structuralVerified=true;
   - verify requested observation mode/scope/profile prerequisites.
3. Only after readiness=true, prepare the non-visible MRMIC read-only portal/surface.
4. Bind the verified materialization lineage to that surface.
5. Build the finalized ProjectionManifestV1 and MID.
6. Transition to PROJECTED.
7. Run ProjectionVerifier, including a fresh lineage/authority check, and produce VID.
8. Transition to VERIFIED.
9. Commit visibility and produce VCID.
10. Transition to VISIBLE.
11. Read relation block row 0 through upstream readPartialRelationBlockRow().
12. Record partialBytesRead, totalCarrierBytes and ResidentFraction.
```

Therefore:

```text
Readiness -> Surface Preparation -> Final Manifest -> Verification -> Visibility
```

is normative. A real provider's ability to materialize or prepare a portal earlier MUST NOT be used to bypass this order.

## 2. Structural verification ownership

PNCW MUST NOT implement HMBT1 structural decoding. The real adapter may report `structuralVerified=true` only after the existing MRMIC/HDSRC Phase 14 path accepts the machine resource under its authoritative structural validation.

## 3. Cross-platform real-validation invocation

POSIX shell:

```bash
PNCW_REAL_HDSRC=1 npm run test:built -- tests/integration/real-4096d.test.mjs
```

PowerShell:

```powershell
$env:PNCW_REAL_HDSRC='1'
npm run test:built -- tests/integration/real-4096d.test.mjs
```

The test still requires the explicit external MRMIC/HDSRC configuration described by the implementation plan.

## 4. Priority

If wording in Task 10 of the implementation plan appears to suggest surface preparation before `ProjectionReadinessGate`, this clarification controls execution. All other task definitions and TDD gates remain unchanged.
