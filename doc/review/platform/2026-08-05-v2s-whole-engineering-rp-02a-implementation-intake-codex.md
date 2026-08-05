---
title: RP-02a-U01 implementation independent-review intake (Codex)
status: BLOCKED_BY_OUT_OF_SCOPE_GENERATED_WIRE_DRIFT
packageId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
reviewCycleId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
reviewTarget: IMPLEMENTATION
round1Verdict: NO-GO
round1Counts: M=1 / S=1 / N=0
authorMaterialReadAfterIndependentVerdict: true
---

## Intake boundary

Round 1 fresh independent review is recorded at
`doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-independent-review-round1-fresh.md`.
This intake reopens each finding against the owning source. It does not claim DEV, HTTP, browser L2,
seed/reset, business or cleanup evidence.

## Finding disposition

### M-01 — command body sends globally forbidden `expectedContextVersion`

**Disposition: CONFIRMED → FIXED.**

The catalog's `componentOverrides.forbiddenProperties` contains `expectedContextVersion`, and the
materializer removes it recursively from command schemas. The workload nevertheless sent it in seven
command bodies: organization brand/tenant/head-company update, invitation create/reissue/cancel, and
user-assignment revoke. The implementation now removes the field from all seven bodies. The focused
workload test loads the catalog forbidden-property set and asserts every captured body lacks every
forbidden property; the user-revoke assertion also requires the field to be absent.

### S-01 — materialize check did not compare generated path/component files

**Disposition: CONFIRMED → PARTIALLY_FIXED / OUT_OF_SCOPE_DEFERRED.**

The checker now enumerates the complete `contracts/openapi` output set, compares missing/extra files and
bytes, and has real path-file and component-file red mutations. The stricter check exposes an existing
upstream generated-wire drift: materialization expects `StoreContractCreateRequest.projectId` while the
current generated component file does not match the current materializer result (and other forbidden
property differences are governed by the contract generation boundary). The accepted RP-02a design
explicitly forbids changing `contracts/openapi` or generated wire, so this package cannot repair that
remaining drift without a new Dexter scope decision. It is not converted to PASS or silently ignored.

Evidence:

- `scripts/check/r5-edge-materialize --self-test`: PASS, including path/component drift mutations;
- `scripts/check/r5-edge-materialize --check`: FAIL closed with
  `R5_EDGE_GENERATED_OUTPUT_DRIFT:components/contract/contract.schemas.yaml`;
- `doc/plans/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-design.md:50-53` forbids
  contract/generated-wire edits in this unit.

## Current verdict

`NO-GO — M=0 / S=1 / N=1` for package exit. The source-bound workload defect is closed. Package exit is
blocked only by the generated-wire drift that the current authorization explicitly excludes. The next
safe action is a separate contract/generated-wire remediation unit (or an explicit Dexter scope change);
no DEV/runtime action is implied.

