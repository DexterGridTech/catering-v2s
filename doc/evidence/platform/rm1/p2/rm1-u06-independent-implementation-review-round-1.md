# RM1-U06 / P2 implementation independent adversarial review, round 1

Dexter，以下为当前 bytes 的独立盲审结论。

`REVIEW_CYCLE_ID=RM1-P2-IMPLEMENTATION-20260728`  
`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`VERDICT=NO-GO`  
`M/S/N = 2/0/1`

## Blind-review declaration

先重开现行源码、模块根、Gradle 坐标、generated 输入/输出与控制实现，形成初步否证；之后才读取 P2 package input、amendment、freeze、post-L2 receipt、source-disposition 与 package-exit。当前 bytes 已在材料更新后重新打开并复跑 P-C3。

## Inputs

- `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md@8ea5d20a8d614cfc4fd9de0bebe946bee5a240d1b5bcbfe1943c0159aa384e3c`
- `doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json@e1d8583116c252ebf598f2416c7bd9076050c03fb008810a721b7277591462d6`
- `doc/evidence/platform/rm1/p2/rm1-u06-package-input.json@c7dec473a284c2300769f60d554f9469b0c32c00e4335816da42bed9b0f7850e`
- `doc/evidence/platform/rm1/p2/rm1-u06-implementation-amendment.json@74445eea761b1957a12e441c88477cefaf8352b48445dc32ee930ce3eb8d1a5c`
- `doc/evidence/platform/rm1/p2/rename-denominator.json@53bc9c45285bf7618987c69dff4b1b14c2fd764365bb200523392c5a55163d3d`
- `doc/evidence/platform/rm1/p2/rm1-u06-affected-l2-post-verification.json@a2caffbc6dff30fcd1e412bdfa83a418d9c6d6a6a9c45c86b11fffed143d72ee`
- `doc/evidence/platform/rm1/p2/rm1-u06-package-exit.json@49bf9a10343af2c382c45bd1352a68373f784f2524cf2b0ad5e10e372b9f795d`
- `contracts/policy/module-dependency-registry.json@4a6c95fe24e40be6ec21479ed6fdea5fa976848b03126eaf6b076ae6c5fcc173`
- `tools/code-layout/cli.mjs@e5cf1ebff1119cf09eb91fdc4db42f38a3c8c5788d1ccd9e53d56a7c29726d35`
- `tools/verify-gates/cli.mjs@ad72d2056e430a1e15b5e9c9b8f45fe0d8b820adbc8ee4467b8520978be5acb1`

## Findings

### M-01 — rename freeze is insufficient to prove the approved eight-form denominator is closed

Status: `CONFIRMED`

Evidence: `rename-denominator.json` has only six `forms`: `Membership`, `membership`, `MEMBERSHIP`, standalone `Member`, `WorkspaceMember`, and `/membership`. It does not enumerate the roadmap-required `.member()` method / `.Member` record form, nor scan the active generated authorities that the manifest lists as P2 change surfaces: `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` and `doc/evidence/platform/r5-u01-edge-placement-resolution.json`.

Risk: the current tree happens to contain no residue in those omitted surfaces, but the claimed complete denominator is not mechanically established; a same-family residue can bypass the receipt.

Minimal repair: explicitly model the eight forms/categories as an exact, repeatable denominator; include `.member()` / `.Member` and both active generated authorities, then rerun pre/post set equality. No business scope expansion is needed.

### M-02 — app-contained relocation is incomplete and the package exit's full-compliance claim conflicts with the current production control

Status: `CONFIRMED`

Evidence: fresh `scripts/check/code-layout` fails for legacy empty directories under `libraries/backend/**/src/**`, plus `apps/frontend/operations-admin/src/features/business-page` and `apps/frontend/operations-admin/src/features/workspace-membership/ui`. This conflicts with RM1-P2-5's `libraries/` removal / clean relocation criterion and P2's P-A1/P-Q6 layout scope. `rm1-u06-package-exit.json` still declares `fullComplianceScan: "PASS"` without binding a successful production `code-layout` invocation.

Risk: old roots and stale feature paths remain; the package exit cannot establish a complete current-byte structural closure.

Minimal repair: remove the legacy empty directories, including `libraries/backend` build/source-tree remnants, rerun `scripts/check/code-layout`, and bind its real output before re-declaring full scan PASS.

### N-01 — P-C3 update has the intended deferred-selected-change semantics

Status: `CONFIRMED_NOT_A_FINDING`

Current `scripts/check/affected-l2` and `--self-test` pass. The self-test now proves `R5_AFFECTED_L2_DEFERRED_SELECTED_FOR_CHANGE`; `--changed apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` intentionally fails because that surface's only legacy L2 target is explicitly `DEFERRED_UNTIL_RM2`. This is the declared behavior-neutral P2 boundary, not a P-C3 false green.

## Independent verification summary

- Source scan excluding E found no old Membership token residue; all ten app-contained module `src/main/java` roots are non-empty, totaling 103 files.
- `scripts/check/module-dependency-registry` and `scripts/check/capability-invariants` pass.
- P2 exit has 322 `actualChangedPaths` and 322 `incrementalChecks`; their path sets are equal. That mechanical equality does not cure M-01 or M-02.
- No dynamic environment, DEV, seed/reset, or shared-worktree production-source change was performed by this reviewer.

## Authorization boundary

This verdict rejects only the current RM1-U06/P2 implementation closure. It grants no authority for business, contract, database, runtime, or data operations.
