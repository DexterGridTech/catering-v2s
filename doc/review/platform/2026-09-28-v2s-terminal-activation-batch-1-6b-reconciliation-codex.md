# Terminal activation batch 1 · whole-batch 6b reconciliation

```text
REVIEW_TARGET=WHOLE_BATCH_6B_RECONCILIATION
STATUS=HISTORICAL_MATCHED_NOT_CURRENT
HISTORICAL_VERDICT=MATCHED; source-set digest below belongs to the earlier reviewed byte set only
M/S/N=0/0/0
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/batch1_6b_recheck_after_cp06_record
SCOPE=REQUIREMENT+DESIGN/IA+PROJECT_MEMORY_STANDARDS+CURRENT_IMPLEMENTATION_SOURCE
SOURCE_SET_FILES=381; historical only
SOURCE_SET_SHA256=bb3c1ec1592f66a6196097377f63c326ccaa567c0456d7cdc07b08390e8f838a; historical only
DYNAMIC_PROOF=NOT_RUN_BY_REVIEW
```

## Verdict

Fresh reviewer `/root/batch1_6b_recheck_after_cp06_record` completed the whole-batch three-way
read-only reconciliation on the then-current bytes and returned
`WHOLE_BATCH_6B_RECONCILIATION=MATCHED`, `M/S/N=0/0/0`. That verdict was superseded after the R5
preflight source/test/memory repair. A later fresh recheck on the new bytes found the evidence-state
contradiction below and left 6b `OPEN`; this document is historical and cannot authorize 6c or any
managed run. The reviewed scope included CP-01 through CP-06; CP-03 and CP-04 were included in the
complete batch comparison despite Dexter waiving their separate CP-boundary reviews.

The earlier reviewer initially found a CP-06 evidence-state contradiction, which was corrected and
then closed on the earlier byte set. The later R5 preflight repair invalidated that source-set
identity; a new 6b reviewer then found current status references still conflicted and the 381-file
hash had no reproducible enumerator. Those findings are recorded in its read-only verdict and
remain open until a fresh current-byte reconciliation is recorded.

## Evidence checked

- CP-06 report: [`2026-09-28-v2s-terminal-activation-batch-1-cp06-reconciliation-codex.md`](2026-09-28-v2s-terminal-activation-batch-1-cp06-reconciliation-codex.md), lines 3-24, 43-57, 86-101. Its stage verdict, reviewer, digest denominator, focused-proof provenance, sign-off snapshot, and current 6b result are now explicit and consistent.
- Execution status: [`2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md`](2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md), lines 6-30. CP-06 and the whole-batch verdict are transcribed consistently; no managed current-byte PASS is claimed.
- Current reviewed source-set identity, as recomputed by the independent reviewer: 381 files, aggregate SHA-256 `bb3c1ec1592f66a6196097377f63c326ccaa567c0456d7cdc07b08390e8f838a`.
- Reviewer cross-checked the design and plan's pre-calibration state, exact first-operation sequencing, TDS capacity/remote control, auth exposure, D-40 behavior, current L2 admission, Netty `4.2.18.Final`, Node `22.23.2`, and the intended ordinary verify stop at the missing CP-05 projection.
- TDS third-party API inventory and source links are recorded in [`2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md`](2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md), lines 14-24, 38-66, 188-212. Official-source review is an implementation constraint and does not claim runtime proof.

## Evidence boundary

This is a historical read-only requirements/design/IA/project-memory/source reconciliation. The
reviewer ran no tests, builds, static gates, managed commands, SSH, or tunnels. Its old source-set
digest is not reproducible from this record and is not a current source identity. Current-byte
managed DEV/TDS, backend acceptance, 6c, Browser L2, reset, seed, UAT, and full acceptance remain
unproven. A fresh 6b record and separate 6c admission remain required before any managed run.
