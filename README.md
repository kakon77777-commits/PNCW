# PNCW — Projection-Native Computational World

PNCW is a conformance-first coordination runtime for projection-native computational worlds.

The **Core MVP v0.1** implements only:

- versioned projection contracts;
- deterministic RID / MID / VID / VCID identity;
- `REQUESTED → RESOLVED → READY → PROJECTED → VERIFIED → VISIBLE` lifecycle;
- independent source/surface authority checks;
- fail-closed freshness, integrity and mixed-version verification;
- idempotent atomic visibility commit;
- partial physical residency after logical reveal;
- HDSRC and MRMIC/NVCL adapter boundaries.

It does **not** claim the full Paper 00–08 perception/cognition/actuation loop is implemented.

## Current executable evidence

Local reference validation includes a fresh run against the canonical HDSRC v0.10 release ZIP (SHA-256 `583659487a25cd76a7a3a32a35fda373074e630c3f7f60e47c618358bbb1c217`). The 4096D case produced HPCM2 oracle fallback, HMR1 HMBT1 b32 / `RCM_PP`, a 286,313-byte carrier and a 1,272-byte partial relation block-row read, followed by PNCW `VERIFIED → VISIBLE` with partial residency.

The current sandbox did **not** contain an executable MRMIC checkout, so that fresh validation used a source-grounded `native_resource_portal_v1` factory matching MRMIC Phase 14 rather than claiming an actual local MRMIC checkout. The production adapter also exposes `runExternalCheckoutProjection(...)` / `createRealMrmicHdsrcAdapters(...)` for the full external-checkout path.

See `docs/evidence/PNCW_CORE_MVP_VALIDATION_v0.1.md`.
