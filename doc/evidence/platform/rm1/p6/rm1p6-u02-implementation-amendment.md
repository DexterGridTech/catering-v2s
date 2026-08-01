---
title: RM1 P6-2 implementation authorization and bounded execution amendment
status: ACTIVE_IMPLEMENTATION_DESIGN
packageId: RM1P6-U02
---

# P6-2 implementation authorization and bounded execution amendment

## Business problem and authorization

P6-2 implements the accepted IA02/IA03 platform-governance tasks: a platform user manages group-workspace
facts and platform administrators; within a selected group workspace, the same user manages roles, workspace
accounts and extension definitions; the user can only read organization and contract facts. The administrator
population is a platform-IAM task, not the selected-workspace account task. All lists, filters, candidates,
totals, authorization and readback facts must originate from their owner, rather than browser inference or
edge-local full-list materialization.

Original business sources are D01-S07P, D02-S06, D03-S06, D04-S01/S02/S03/S11/S12P and the accepted
IA02/IA03 `BUSINESS_REQUIREMENT_SOURCE` citations. The exact implementation sequence and forbidden
pseudo-fixes are frozen in `rm1-u09-implementation-facing-design-and-three-phase-plan.md` §4 and
`rm1-u09-implementation-design-granularity-manifest.json#RM1P6-U02`.

Dexter authorized P6-2 implementation after P6-1 implementation GO. This amendment is the package-local
record of that authorization. It does not alter Roadmap state and does not advance P6-3.

## Bounded execution shape

The package may change platform governance OpenAPI contracts, the accepted R5 edge-operation catalog and its
generated placement report, the controlled materializer when a declared contract header cannot otherwise be
expressed, the business-server owner/edge/test sources, and platform-admin sources only. Contract changes are
generated through the controlled edge generator; UI
uses the generated `PlatformApi`/transport plus `admin-ui-foundation`, without hand-written endpoints,
additional API slices, Redux slices, raw HTTP protocol construction, browser authorization inference or
client-side full-list filtering.

The generator may also rewrite the operations-admin **generated API output only** when it verifies the one
repository-wide edge denominator. That mechanical consistency output neither changes an operations page nor
starts P6-3 behavior.

Implementation proceeds owner/service tests and edge mapping tests first, then generated consumers, then
focused platform-admin tests. `PLATFORM-ADMIN-USERS` maps to `platform-administration/AdministratorsPage`;
`PLATFORM-WORKSPACE-ACCOUNTS` maps to `workspace-iam/AccountsPage`. Both retain name-link → detail →
independent Drawer/Modal interaction; no row action column bypasses the detail readback.

## Required proof and exclusions

Before the first P6-2 `.tsx` production consumer write, the package must complete a
`UI_IA_PREWRITE_BASELINE=PASS`: every intended consumer is bound to its screen ID, business task, control
dimensions, approved IA and physical-contract hash. The managed pre-write hook rejects a missing, stale, non-PASS
or unbound baseline. This is not a final UI claim.

Before any L2 starts, P6-2 must complete a `UI_INTERACTION_CONFORMANCE_RECORD` whose finite denominator is every
P6-2 platform-admin physical screen/control in `rm1-u09-final-ui-surface-roster.md` and
`rm1-u09-physical-screen-import-contracts.md`. For each entry it compares the approved IA02/IA03 interaction
against the implemented consumer's task, entry/shape, visible copy, data or candidate source, prerequisite,
cascade/clear behavior, state/recovery, owner recheck, foundation primitive and prohibited interaction. Any
unresolved difference blocks L2; L2 results cannot substitute for the comparison.

Before exit, owner filter/total equivalence, version-conflict readback, asset staging disposition, status
transition separation, two independent role authorization trees, administrator-issued credential recovery,
and no-client-derivation red cases must have focused proof. Dexter's L2 scope correction additionally makes
the full P6-2 platform business-surface denominator in
`contracts/policy/affected-l2-registry.json#phaseBusinessL2Obligations[RM1P6-U02]` mandatory: every listed
test file must contain a non-empty real browser case and run through a managed environment, with run-scoped
business PASS and independent cleanup PASS. Focused unit, static, generated, or mock-only tests do not replace
that L2 proof. Package exit must prove exact changed-file / receipt equality, code generation, frontend
architecture and required static standards.

The receipt-control denominator is also explicit: the ten historical P6-2 control/design paths that were
admitted after the independent package baseline may only be closed by the exact
`rm1p6-u02-dexter-authorized-historical-receipt-recovery.json` record and its generic validator binding.
That record must pin each baseline/current byte, prove the pre-existing same-package chain cannot start at
the package baseline, and retain the real receipt chain for its own creation. It must not recreate a prior
receipt, rewrite the baseline, or absorb any production consumer source.

This authorization excludes P6-3 operations/public work, DEV, seed, reset, Roadmap mutation, repository
control actions and changes outside the named roots.
