# CP-1 stage reconciliation — fresh independent review

REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION
REVIEW_STAGE=CP-1
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=NO-GO
CP1_RECONCILIATION=OPEN
M/S/N=1/2/2
EVIDENCE_TIER=static + focused; no runtime/device/Web/DEV/cleanup

## Provenance

This is the verbatim independent reviewer report received on 2026-09-15. The reviewer
read current repository bytes, the v3.6 requirements, the implementation design and plan,
project-memory inputs, owning source and static checkers before comparing the author
materials. The reviewer did not modify files, use Git, or start runtime, device, Web, DEV,
seed, UAT, deployment or managed cleanup.

## Findings

### F-1 — M — PARTIALLY_CONFIRMED

The production D-1 checker exists, but complete scope and red-control evidence are not
closed. The reviewer cited `tools/terminal-layering/check-static.mjs:85-106,214-233,240-310`
and `tools/terminal-skeleton/check-static.mjs:437-493,526-588` as existing implementation,
but found that `tools/terminal-skeleton/graph-model.mjs:270-278` only reads `src` and
optional `test-expo`, and `graph-model.mjs:210-222` does not verify root
`package.json.workspaces`. Existing `tools/terminal-layering/check-static.test.mjs:331-410`
does not prove the two new base packages' `test/`, `test-expo/`, package-root scripts or
root workspace deletion controls. A mutation in those uncovered locations could evade the
claimed scope. Reproduce by injecting a forbidden edge into each omitted scope and by
removing a root workspace entry, then observing the current checker/control output.

### F-2 — S — CONFIRMED

`apps/terminal/ui/integration/sample-console/README.md:10-11` still says the package uses
temporary base module descriptors, while the current production source has the real factory
at `src/application/module.ts:5-16` and registers it at `src/assembly/assembly.tsx:238-247`.
`rg baseModuleDescriptors` currently finds the stale README claim. This violates the
README/source reconciliation requirement.

### F-3 — S — CONFIRMED

`apps/terminal/ui/base/console-assembly/terminal-invariants.json:4-7` declares
`kind=REAL_TESTS`, `package.json:8-10` has a test script, and `tsconfig.json:1-4` includes
`test/**/*.ts`, but the package has no `test/` file. The owned-test runner would report
`NO_TEST_FILES`, conflicting with the invariant and preventing focused package closure.

### F-4 — N — UNVERIFIED_REQUIRES_EVIDENCE

The plan requires sample2 frozen implementation acceptance before B1–B4
(`doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:68-82`),
but the visible CP-1 record only cited static outputs and the A9 probe. The A9 record is
explicitly supporting-only and does not prove complete sample2 native/release/Web/dual-screen
acceptance. The current frozen sample2 acceptance record must be located and checked for
version/range before B1–B4 can close.

### F-5 — N — UNVERIFIED_REQUIRES_EVIDENCE

The root `package.json:8-19` declaration is present, but the graph census only scans
`apps/terminal` (`tools/terminal-skeleton/graph-model.mjs:210-222`). The plan requires a
separate root workspace/Turbo observation (`...implementation-plan-codex.md:177`); no such
record was visible. Removing a root workspace pattern could leave the package census green,
so graph PASS cannot stand in for workspace enumeration proof.

## Reviewer conclusion

The old CP-1 structural fixes were mostly present, but the stage cannot be marked MATCHED.
The independent verdict is `NO-GO`, M/S/N `1/2/2`; static PASS does not close the missing
scope/red-control, package test, prerequisite, or root workspace evidence.
