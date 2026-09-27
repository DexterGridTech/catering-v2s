# Terminal activation batch 1 · store-terminal L2 script admission

```text
REVIEW_TARGET=L2_SCRIPT_ADMISSION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=/root/cp06_l2_snapshot_recheck
L2_ADMISSION_REVIEW_STATUS=PASS
ADMISSION_SOURCE_DIGEST=e5b145158a25e8d08c187aa04041cdde93cff3a0d874ec3c9786018c4790c32a
POLICY_DIGEST=75b9f754ce74142cd24e0f9bfb902df368a5d563062864f1f99e184f0bf1f981
CASE_COUNT=6
CONTROL_PLANE_FILE_COUNT=36
UI_FILE_COUNT=22
FILE_COUNT=58
BYTE_COUNT=2134563
BROWSER_L2=NOT_RUN
EVIDENCE_TIER=FRESH_READ_ONLY_SOURCE_REVIEW
```

## Independent admission result

The fresh reviewer recomputed the current snapshot and returned `L2_ADMISSION_REVIEW_STATUS=PASS` for the digest above. The review record itself is not included in `controlPlaneFiles`; adding this result therefore does not change the reviewed digest. The six case sources match the policy order across candidate, blueprint, scenarios, timing and fixture files. The 36 policy paths match the detailed-design §3a literal list in order. The snapshot contains 22 UI source files (58 files total, 2,134,563 bytes).

For E01 / `terminal-edit-configuration`, blueprint and scenario each declare 30 controls and 17 actions. `TERMINAL_DEVICE_TYPE_READONLY` appears only as a control observation, not an action; its locator is a read-only `TEXT` node. The edit field renders `Typography.Text`, and the L2 script checks visible non-empty text and rejects focusable or interactive shape. `UI_DESIGN_REVIEW=PASS` and `TESTID_REVIEW=PASS` are present in the design. Browser L2 remains `NOT_RUN`.

## Evidence and boundary

- Policy and six-case source order: `contracts/policy/store-terminal-l2-admission.json:13-53`, with candidate, blueprint, scenarios, timing and fixture paths enumerated there.
- Design admission markers and status boundary: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:105-107`.
- Plan confirms the current 36-file control-plane set and keeps Browser L2 separately evidenced: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:33,71`.
- D-18 control and action shape: `contracts/policy/store-terminal-l2-case-blueprint.json:100-103` and `contracts/policy/store-terminal-l2-scenarios.json:211-235`.
- Read-only locator and rendered field: `contracts/policy/store-terminal-l2-locator-bindings.json:26`; `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDeviceTypeField.tsx:11-15`.
- Focused and Browser L2 assertions: `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.static.test.ts:30-44`, `scripts/test/l2-locator-bindings.static.test.mjs:340-343`, and `apps/frontend/operations-admin/src/tests/l2/store-terminal.spec.ts:1278-1298`.

This record proves static L2 script admission only. It does not claim Browser L2, DEV, backend-acceptance, remote, Testcontainers, reset, seed or runtime evidence. A change to any digest-bound control-plane or UI source requires recomputing the snapshot and obtaining a new independent admission result.
