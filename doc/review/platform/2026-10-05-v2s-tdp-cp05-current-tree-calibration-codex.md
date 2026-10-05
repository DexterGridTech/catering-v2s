# TDP · CP-05 current-tree calibration

```text
REVIEW_TARGET=CP05_CALIBRATION
RUNS=3
BATCH_CARDINALITIES=1,20,100
OPERATION_IDENTITIES=304
BASELINE_REF=DEXTER-2026-10-05-TDP-CP05-304
```

## Authority and scope

Dexter's 2026-10-05 instruction in the active task authorizes reasonable budget-related changes when the rationale is recorded. This record applies that instruction only to the CP-05 measurement baseline needed by this TDP batch. The accepted 2026-09-29 baseline explicitly covered 296 terminal-activation operation identities; the current canonical operation inventory contains 304 identities after TDP adds eight terminal-read operations. Reusing the old 296 baseline reference would misstate its operation scope. The new reference records the current 304-operation remeasurement and does not authorize deleting business facts, changing operation identity, or granting an unmeasured ceiling.

## Measurement runs

| Batch cardinality | Managed run | Started (UTC) | Finished (UTC) | Business | TDS CONTRACT | Measurement | Cleanup |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `r5-tc-1791161982370-47071` | 2026-10-05T00:59:42Z | 2026-10-05T01:11:59Z | PASS (200/200) | PASS (49/49) | PASS (304/304; unclassified SQL 0) | PASS |
| 20 | `r5-tc-1791162730569-65655` | 2026-10-05T01:12:10Z | 2026-10-05T01:24:33Z | PASS (200/200) | PASS (49/49) | PASS (304/304; unclassified SQL 0) | PASS |
| 100 | `r5-tc-1791163478551-79862` | 2026-10-05T01:24:38Z | 2026-10-05T01:37:17Z | PASS (200/200) | PASS (49/49) | PASS (304/304; unclassified SQL 0) | PASS |

Each managed manifest is under `.runtime/r5/evidence/remote-testcontainers/<runId>/run-manifest.json`; each run used the real remote Testcontainers topology. No reset, seed, L2, Android, VM, UAT or deployment was run.

## Current operation scope and rationale

The three manifests report identical 304-operation identity sets, zero missing/extra/drift, successful real business assertions, 49/49 TDS protocol contracts, and zero unclassified SQL. The per-operation ceilings are derived from each operation's maximum measured database-operation count across these three runs; no average is used. The linear batch operation retains its existing `1/20/100` formula validation. Where an existing operation-scoped exception applies, its existing source decision and dual-admission checks remain authoritative; this remeasurement does not broaden those exceptions.

The one pre-calibration ordinary `--operation all` attempt failed before managed-run creation with `BUDGET_NULL_REJECTED:adjustOperationsInventoryTarget`; it executed no scenario and is retained as a preflight failure, not a business run.
