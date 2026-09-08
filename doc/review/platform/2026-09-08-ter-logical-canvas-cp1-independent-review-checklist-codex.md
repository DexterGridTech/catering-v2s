# TER logical canvas CP-1 independent review checklist

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-1
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY

## Blind-review boundary

The reviewer must reopen the current repository bytes and the original requirements, design, plan,
project instructions, and CP-1 evidence. The reviewer must not treat the author's claimed test output
or this checklist as proof without comparing it with the current files. The reviewer must not modify
files, run commands, enter CP-2, or review later CP implementation as if it were present.

## Required inputs

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/roadmap-program-registry.json`
- the selected Roadmap authorization fields
- `project-memory/index.md` and the implementation-relevant routed memory
- `scripts/README.md`
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md`
- `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md`
- current CP-1 source and test files under `apps/terminal/ui/integration/sample-console`,
  `apps/terminal/ui/base/dev-host`, `apps/terminal/ui/base/input`,
  `apps/terminal/ui/feature/sample-member-desk`, and `apps/terminal/ui/feature/sample-staff-auth`

## Falsification checks

1. Confirm `package.json` and `readTerminalSurfaces` implement only
   `orientations.landscape[DisplayMode]` for the current sample and reject the old
   `layout`/`scaleToFit`/`surfaces` shape; confirm the optional portrait parser does not invent a
   target profile.
2. Confirm the parser test covers positive landscape/portrait input, missing members, invalid sizes,
   and the old shape; confirm the package-surface expectation is exactly 1280×800 and 1280×720.
3. Confirm sample assembly reads the landscape declaration through the existing `DisplayMode`, and
   its diagnostics no longer read package-level layout or scale policy.
4. Confirm dev-host reads the new declaration while its current preview layout/overflow policy is
   owned locally and is not accidentally treated as package declaration; confirm CP-5 geometry was
   not implemented early.
5. Confirm `sample-console/test-expo/App.tsx` and `src/index.ts` have no old-shape bypass; classify
   unchanged direct-entry hits explicitly rather than treating them as outside the denominator.
6. Confirm all CP-1 fixture changes distinguish declaration-derived landscape frames from neutral
   input fixtures and synthetic portrait/unsupported boundaries; confirm no business assertion was
   weakened or replaced by a structural assertion.
7. Confirm CP-1 does not modify Android adapter, host transform, Web policy, IME conversion,
   `InputScrollArea`, public platform contracts, or portrait target hardware handling.
8. Reconcile the current source against the CP-1 plan's allowed files and denominator. Any new old
   shape/old baseline hit without classification is OPEN.
9. Reconcile the evidence's typecheck/test claims with the visible test files and package scripts;
   static evidence must not be presented as Android/Web runtime evidence.

## Required report

Return `VERDICT=GO` or `VERDICT=NO-GO`, `M/S/N`, every finding with
`CONFIRMED`, `PARTIALLY_CONFIRMED`, `REJECTED_WITH_EVIDENCE`,
`UNVERIFIED_REQUIRES_EVIDENCE`, or `DEXTER_DECISION`, and a final `CP-1=MATCHED` only if every
check is closed. Do not provide an implementation verdict for CP-2 or later.
