# Terminal activation batch 1 · store-terminal L2 script admission · current-byte refresh

```text
REVIEW_TARGET=L2_SCRIPT_ADMISSION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=/root/l2_admission_current_review
INDEPENDENT_SOURCE_REVIEW=PASS
INDEPENDENT_INITIAL_GATE_STATUS=OPEN_ONLY_BECAUSE_DESIGNATED_RECORD_DIGEST_WAS_STALE
HISTORICAL_L2_ADMISSION_REVIEW_STATUS=PASS
HISTORICAL_ADMISSION_SOURCE_DIGEST=721171d0eb01a9048ca121a4970f960165f017d1e1005b28e58ac30711ac5a24
POLICY_DIGEST=9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f
CASE_COUNT=6
CONTROL_PLANE_FILE_COUNT=36
UI_FILE_COUNT=22
FILE_COUNT=58
UNIQUE_PATH_COUNT=48
BYTE_COUNT=2167163
PATH_CONTAINMENT=PASS
BROWSER_L2=NOT_RUN
DEV=NOT_RUN
RESET=NOT_RUN
SEED=NOT_RUN
UAT=NOT_RUN
EVIDENCE_TIER=FRESH_READ_ONLY_SOURCE_REVIEW
PURE_VALIDATOR=PASS_PENDING_EXECUTION
```

The fresh reviewer independently recomputed the current snapshot from the admission strategy:

- `contracts/policy/store-terminal-l2-admission.json:5-12,53` — six ordered cases, 36 control-plane
  inputs, and the policy-designated path for this record.
- `scripts/test/store-terminal-l2-admission.mjs:6-19` and `scripts/test/l2-suite-admission.mjs:142-175`
  — the strategy computes the digest, file and byte counts from policy inputs plus the UI source
  directory; the designated review record is not part of its digest denominator.
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:45,57`
  and `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:62`
  — D-18 requires the device type to remain readonly in edit mode.
- `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDeviceTypeField.tsx:9-30`
  — edit mode renders readonly text; creation retains the selectable radio group.
- `contracts/policy/store-terminal-l2-fixture.json:19-20` and
  `contracts/policy/store-terminal-l2-scenarios.json:12-18` — the readonly case has an isolated
  fixture and is declared before the destructive status case.
- `scripts/generate/store-terminal-l2-p1.mjs:158-215` and
  `scripts/test/store-terminal-l2-p1.test.mjs:59-83` — fixture isolation and isolated-before-destructive
  ordering are mechanically checked, with a reversed-order red mutation.
- `apps/frontend/operations-admin/src/tests/l2/store-terminal.spec.ts:1515` — readonly credentials
  are selected for `terminal-readonly-state`.

The only initial finding was that the old designated record contained
`ADMISSION_SOURCE_DIGEST=0994b6f0b376eeba8b9854039514cdcdb28da2c62e9a98ff8d7c17ad45e46da8`, while the
current snapshot recomputes to `721171d0eb01a9048ca121a4970f960165f017d1e1005b28e58ac30711ac5a24`
(`POLICY_DIGEST=9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f`, 6 cases, 36
control-plane files, 22 UI files, 58 entries, 48 unique paths, 2,167,163 bytes). This refresh
materializes that current snapshot and the independent source findings; the L2 admission marker is
intentionally left OPEN until the independent reviewer rereads this exact record and confirms the
closure. No Browser L2, DEV, reset, seed, UAT, build, or dynamic runtime result is claimed.

## 2026-09-29 current-byte refresh after selector-helper repair

The prior record above is historical and is superseded for admission by the current snapshot below.
The fresh reviewer `/root/l2_admission_after_selector_fix` independently inspected the current
six-case source set and found no source or helper defect. Its only finding was that this designated
record still named the pre-repair digest, so the reviewer correctly left admission OPEN pending this
refresh. The preserved first-failure trace remains the evidence for the old duplicate-click defect;
the focused helper test, formatting check and operations-admin typecheck passed after its repair.

```text
REVIEW_TARGET=L2_SCRIPT_ADMISSION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=/root/l2_admission_after_selector_fix
INDEPENDENT_SOURCE_REVIEW=PASS
INDEPENDENT_INITIAL_GATE_STATUS=OPEN_ONLY_BECAUSE_DESIGNATED_RECORD_DIGEST_WAS_STALE
L2_ADMISSION_REVIEW_STATUS=OPEN
ADMISSION_SOURCE_DIGEST=748cf5203b6186ba34bcd09ba32fe2c4b74cd8d64912c3120b6468d70e20f77f
POLICY_DIGEST=9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f
CASE_COUNT=6
CONTROL_PLANE_FILE_COUNT=36
UI_FILE_COUNT=22
FILE_COUNT=58
UNIQUE_PATH_COUNT=48
BYTE_COUNT=2167606
PATH_CONTAINMENT=PASS
BROWSER_L2=NOT_RUN
DEV=NOT_RUN
RESET=NOT_RUN
SEED=NOT_RUN
UAT=NOT_RUN
EVIDENCE_TIER=FRESH_READ_ONLY_SOURCE_REVIEW
PURE_VALIDATOR=PASS_PENDING_FRESH_INDEPENDENT_RECORD_CONFIRMATION
```

The reviewer independently recomputed the exact six-case order and these current counts. It verified
that `operationsL2.ts` performs only one pointer click and waits for the controlled selection to
commit before taking the keyboard fallback; `operationsL2.test.ts` guards that ordering and rejects
a repeated pointer click. It also confirmed that the earlier trace records the old immediate-read,
second-click path and that the current selector library toggles an already selected multi-value
option on another click. The designated record is outside the 36 control-plane paths, so this update
does not change the admission digest. This status remains OPEN until a fresh independent reviewer
confirms this exact refreshed record; no Browser L2, DEV, reset, seed, UAT, or new runtime result is
claimed here.

## 2026-09-29 fail-closed binding of verdict to the latest review

The fresh reviewer identified a real admission-validator gap: `validateAdmissionRecord` previously
searched the whole Markdown file for independent-review, PASS and digest strings independently. A
historical PASS block plus a later current digest could therefore satisfy the gate even when the
latest review block was OPEN. The validator now selects the latest `REVIEW_TARGET=L2_SCRIPT_ADMISSION`
record and requires exactly one reviewer-kind, status and digest marker inside that record. A
regression test proves that a historical PASS cannot combine with a later OPEN record's digest and
that duplicate digest markers fail closed. The historic PASS and digest above are now explicitly
prefixed `HISTORICAL_` so they cannot satisfy a current admission check.

```text
REVIEW_TARGET=L2_SCRIPT_ADMISSION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=/root/store_terminal_l2_final_admission
L2_ADMISSION_REVIEW_STATUS=PASS
ADMISSION_SOURCE_DIGEST=7813036e9c7ebce5fc49139c8708b8e51b7a198915758b45a5bbd88b133801bb
POLICY_DIGEST=9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f
CASE_COUNT=6
CONTROL_PLANE_FILE_COUNT=36
UI_FILE_COUNT=22
FILE_COUNT=58
UNIQUE_PATH_COUNT=48
BYTE_COUNT=2169585
PATH_CONTAINMENT=PASS
BROWSER_L2=NOT_RUN
DEV=NOT_RUN
RESET=NOT_RUN
SEED=NOT_RUN
UAT=NOT_RUN
M_S_N=0/0/0
EVIDENCE_TIER=FRESH_READ_ONLY_SOURCE_REVIEW
PURE_VALIDATOR=PASS; node --test scripts/test/l2-suite-admission.test.mjs scripts/test/store-terminal-l2-admission.test.mjs; 6/6
```

The record is not part of the admission digest. The digest above is recomputed from the current 36
control-plane files plus the 22-file UI source set. It supersedes the prior `748cf520...` snapshot
because the generic admission validator and its regression test are themselves in the control-plane
denominator. Fresh reviewer `/root/store_terminal_l2_final_admission` independently recomputed the
same digest/counts, checked the ordered six cases, current helper and validator regressions, and
returned `L2_ADMISSION_REVIEW_STATUS=PASS`, `M/S/N=0/0/0`. This is static admission only; Browser L2,
DEV, reset, seed, UAT and dynamic business results remain unrun on these bytes. The direct current
record/gate test run passed 6/6 after the independent verdict was recorded.

## 2026-09-29 current-byte admission confirmation

The following fresh read-only verdict binds the unchanged six-case L2 source set to the current
admission digest. Since the prior verdict, the only changed control-plane input was the implementation
plan's V-S2 WebSocket authentication note; the independent reviewer confirmed that it changes no L2
case, fixture, UI behavior, or execution order. The reviewer recomputed the digest and counts below.

```text
REVIEW_TARGET=L2_SCRIPT_ADMISSION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=/root/store_terminal_l2_final_admission
L2_ADMISSION_REVIEW_STATUS=PASS
ADMISSION_SOURCE_DIGEST=27abd37ee8548962c49f7688393def93bc473f006088e5bedcace04f2c33fdb1
POLICY_DIGEST=9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f
CASE_COUNT=6
CONTROL_PLANE_FILE_COUNT=36
UI_FILE_COUNT=22
FILE_COUNT=58
UNIQUE_PATH_COUNT=48
BYTE_COUNT=2170957
PATH_CONTAINMENT=PASS
BROWSER_L2=NOT_RUN
DEV=NOT_RUN
RESET=NOT_RUN
SEED=NOT_RUN
UAT=NOT_RUN
M_S_N=0/0/0
EVIDENCE_TIER=FRESH_READ_ONLY_SOURCE_REVIEW
```
