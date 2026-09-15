# CP4 stage reconciliation — current bytes, round 7

`REVIEW_TARGET=IMPLEMENTATION_SUPPORT_STAGE_RECONCILIATION`
`STAGE=CP4`
`REVIEWER=Confucius`
`REVIEWER_KIND=INDEPENDENT_SUBAGENT`
`FRESH_BLIND_READ=true`
`DYNAMIC_RUN=false`
`VERDICT=MATCHED_WITH_OPEN_EVIDENCE`
`M/S/N=0/0/2`

## Scope and method

The reviewer read current source, requirements v3.6, design, plan, standards,
project memory and owning test/runtime source. The reviewer did not rely on
author or prior reviewer verdicts, did not write files, and did not run
focused/dynamic/build/Web/Metro/Android/device/deployment/seed/UAT/Git actions.

## Current result

- Auth and member-desk system-notice actors now check the PRIMARY layer stack
  before `openLayer`; repeated observation is idempotent and remains ephemeral.
- Their real-runtime tests dispatch the observed command twice and assert two
  completed parent results, one notice layer, no
  `ui-state.layer.duplicate-rejected` log, and no error child open-layer journal
  completion.
- D-12 matches the current `requestOutcome` mapping; picker two-hop child
  result/readback and before/after write-phase semantics remain aligned.
- B4 remains a B1-only dependency boundary; system notices are ephemeral and
  the kernel hydration path filters them on cold restart.
- No M/S implementation finding remained. N-1 is the unexecuted feature-level
  PF-06 cold-restart evidence for an already-open notice; N-2 is the unexecuted
  TR-08 production-bundle symbol scan. Both remain evidence work, not source
  claims.

## Reproducible anchors

```text
apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts
apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts
apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts
apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx
apps/terminal/ui/base/render/src/foundations/requestOutcome.ts
apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts
apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts
```

