---
title: RP-02a-U01 implementation amendment
status: ACCEPTED_FOR_STATIC_IMPLEMENTATION
packageId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
---

The implementation package resolves Claude's two design N findings with the smallest bounded
changes:

- N1: create `doc/evidence/platform/2026-08-05-v2s-whole-engineering-rp-02a-catalog-crosswalk.json`
  with the 154 post-change rows, 42 registry-only rows, 9 generic catalog-only replacement rows,
  source anchors and equality predicates;
- N2: create `scripts/check/r5-edge-materialize`, a direct check/self-test wrapper only. It is not
  added to `scripts/verify`, because aggregate verify wiring is RP-00b and has a separate authority.

No design semantic is changed. The source catalog is mechanically materialized from the already
reviewed R24/P3C projection, and the projection module only adds an explicit identity readback for
that materialized state. The payload/query and recovery edits are limited to the finite source set
named by the accepted design.

## Round 1 implementation findings

- `M-01` was confirmed and repaired: all seven source-bound command bodies now omit the globally
  forbidden `expectedContextVersion`; the focused test derives the forbidden-property set from the
  catalog and asserts body absence.
- `S-01` was confirmed. The materializer check now compares the complete generated path/component
  output set and self-tests both drift classes. The stricter check exposes an existing
  `contracts/openapi` drift, but the accepted RP-02a boundary explicitly forbids changing generated
  wire. It remains `PARTIALLY_FIXED / OUT_OF_SCOPE_DEFERRED` and blocks package exit; no false PASS is
  claimed. A separate contract/generated-wire unit must close it.
