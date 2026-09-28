# Terminal activation batch 1 · CP-05 budget projection repair

```text
FAILURE_CATEGORY=BUDGET_NULL_REJECTED:adjustOperationsInventoryTarget
FIRST_ATTEMPT=scripts/test/backend-acceptance --operation all
RUN_ID=NONE_LOCAL_PREFLIGHT_ONLY
REMOTE_TOUCHED=false
NETWORK_INTERRUPTED=false
PROJECTION_REPAIR=PASS
CURRENT_REGISTRY=296_OF_296_BUDGETS_VALID
FOCUSED_TEST=PASS_7_OF_7
IDENTITY_ONLY_TEST=PASS_6_SKIP_1_EXPECTED
EDGE_CODEGEN_CHECK=PASS_FILES_437
CP05_RECONCILIATION_AT_REPAIR_RECORD_CREATION=OPEN_AFTER_CURRENT_BYTE_REPAIR
WHOLE_BATCH_6B_AT_REPAIR_RECORD_CREATION=OPEN_AFTER_CURRENT_BYTE_REPAIR
CURRENT_CP05_RECONCILIATION=MATCHED; M/S/N=0/0/0; see 2026-09-29-v2s-terminal-activation-batch-1-projection-binding-reconciliation-codex.md
CURRENT_WHOLE_BATCH_6B=MATCHED; M/S/N=0/0/0; current source SHA256=0dca67eb5ce5353e11986bdb7318dc7fc990342591aa0dd06210a8101d5e43d8; fresh reviewer=/root/stage1_6c_admission_retry; see current-byte correction in 2026-09-29-v2s-terminal-activation-batch-1-projection-binding-reconciliation-codex.md
FULL_BACKEND_ACCEPTANCE=NOT_RUN_AFTER_REPAIR
```

## First failure and owning boundary

The managed command failed locally before allocating a run ID, opening SSH, or starting remote
Testcontainers. `scripts/test/r5-remote-testcontainers.mjs` loads the acceptance registry from the
238-row `edge-route-face-registry.json` plus the 58-row
`catalog-inventory-edge-route-registry.json`, then validates all 296 generated budgets before
resource acquisition. The edge registry already had 238/238 budgets and a digest matching the
current calibration report. The catalog/inventory registry was timestamped before the current
CP-05 report and had 0/58 budgets; `adjustOperationsInventoryTarget` therefore failed closed with
`BUDGET_NULL_REJECTED`.

## Root-cause repair

After the three CP-05 reports, only the edge-codegen projection had been refreshed. The plan's
singular “regenerate the budget projection” did not name both runtime projection producers. The
canonical catalog/inventory producer is `scripts/generate/catalog-inventory-p1.mjs`; it reads the
current CP-05 report and emits the 58 catalog/inventory budget rows. Running it restored the
current registry without hand-editing generated output. The checked-in L2 execution mode remained
`FRAMEWORK_ONLY` and was not activated by this projection refresh.

The initial invocation included `--write --check`, but source inspection confirmed that this
generator recognizes only `--self-test`; those two arguments were ignored. The plan and
`scripts/README.md` now invoke the generator without unsupported flags and run its actual checker,
`node tools/catalog-inventory-p1/cli.mjs`, separately.

The plan now names both projection producers and their row counts. The registered THCL-04
`backend-performance-operation-reconciliation.test.mjs` compares all 296 generated budgets against
`buildBudgetProjection` from the active CP-05 report, validates the generated registry, and applies
an in-memory missing-catalog-budget mutation that must emit the same operation-specific marker. The
test is skipped only in explicit `IDENTITY_ONLY` bootstrap mode, when the design intentionally has
no measured projection.

## Focused evidence

- `node scripts/generate/catalog-inventory-p1.mjs --write --check` (the generator ignored these unsupported flags):
  `CATALOG_INVENTORY_P1_GENERATION=PASS`,
  `OPERATIONS=58`, L2 remained `FRAMEWORK_ONLY`.
- Current registry validation: 296 operation identities, 296 budgets; the failed operation now has
  fixed maximum 13, matching the current three-run report.
- `node --test scripts/test/backend-performance-operation-reconciliation.test.mjs`: 7/7 PASS,
  including current-report equality and the red mutation.
- `node tools/catalog-inventory-p1/cli.mjs`: `CATALOG_INVENTORY_P1_CHECK=PASS`, `OPERATIONS=58`.
- `node --check scripts/test/backend-performance-operation-reconciliation.test.mjs`: exit 0.
- `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node --test
  scripts/test/backend-performance-operation-reconciliation.test.mjs`: 6 PASS, 1 expected skip.
- `scripts/check/edge-codegen --check`: `R5_EDGE_CODEGEN_CHECK=PASS`, `FILES=437`.

No remote command, source deletion, signal, route or SSH change was performed during this repair.
The current-byte CP-05 and whole-batch 6b independent reconciliations were subsequently refreshed
and are `MATCHED` in the record cited above. The failed initial attempt remains preserved as a
preflight failure; it is not rewritten as a managed-run failure or PASS.
