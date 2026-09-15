# U8 runner step reconciliation — current source

```text
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=11
reviewerKind=INDEPENDENT_SUBAGENT
reviewerThread=01a0a529-3687-7ab1-99b9-d6068fc30ba6
reviewer=Kuhn
STEP_RECONCILIATION=MATCHED
REVIEWER_M_S_N=0/0/0
DYNAMIC_STATUS=NOT_RUN_BY_REVIEWER
```

## Scope and conclusion

The fresh reviewer read the governing entry files, current requirements, design,
plan, project-memory routes, U8 runner, sample feature part declarations and
render fallback/failure sources. It independently checked that the current
`hasFirstRnContent` predicate accepts only the closed set of real sample
application content roots and does not accept loading/fallback, startup-failure,
or runtime-failure identities. The dedicated `startupFailureUiIdentity`
predicate remains separate and requires the startup failure page identity and
copy.

The reviewer returned `STEP_RECONCILIATION=MATCHED`, `M/S/N=0/0/0`. It did not
run dynamic commands. The previous current-source U8 `FAIL` remains a runtime
first-failure record to be re-run, not a source mismatch.

## Attempt history and diagnosis

- Hegel (`01a0a51f-d195-7142-a7b0-e33d06e5d850`) returned `OPEN` with M-1/S-1:
  the normal-content predicate also accepted `ui.base.render:runtime-failure`.
  The main agent removed both failure-page identities from that predicate and
  kept `startupFailureUiIdentity` as the dedicated failure oracle.
- Meitner (`01a0a524-e97f-7390-bc60-cea5d449cbb5`) produced no status after a
  bounded wait and a controlled status request; it was diagnosed as a stuck
  reviewer and closed. Its missing output was not used as evidence.
- Kuhn performed the replacement fresh read-only check and returned the matched
  result recorded above.

## Source/evidence anchors

- `tools/terminal-sample2/run-u8-release-cold-start.mjs:156-165` — closed
  normal-content predicate and separate startup failure identity.
- `apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts` — auth
  content roots.
- `apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts` — desk
  content roots.
- `apps/terminal/ui/feature/sample-wallpaper-picker/src/parts/parts.ts` —
  wallpaper picker root.
- `apps/terminal/ui/base/render/src/components/resolvePart.ts` and
  `ScreenReadyBoundary.tsx` — fallback and failure identities excluded from the
  normal predicate.
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-current-source-final-20260915/result.json`
  — preserved prior first failure (`first RN content device observation was
  not captured`) and cleanup result; it is not current PASS evidence.

