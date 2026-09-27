# CP-05 · per-marker wire-client log archive repair

`STATE=FIXED; CP-05_RECONCILIATION_AT_CREATION=OPEN; CURRENT_CP-05_RECONCILIATION=MATCHED`

## Confirmed finding and repair

The fresh CP-05 read-only review found that `TerminalConnectionContractScenarios.java` writes client stderr to both the fixed `terminal-wire-client.log` and per-marker `terminal-wire-<marker>.log` files. Before this repair, `r5-remote-testcontainers.mjs` copied only the fixed file into managed results before reclaiming the remote workspace. The per-marker diagnostics could therefore be lost.

The runner now appends every per-marker `terminal-wire-*.log` file, with a filename separator, into the existing `terminal-wire-client.log` artifact before the existing archive/hash step. The archive artifact set and manifest schema remain unchanged.

## Evidence

- Writer and per-marker callsites: `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java`, including `wireClientLog` and its Node `redirectError` use.
- Archive implementation: `scripts/test/r5-remote-testcontainers.mjs`, `terminalWireEvidenceAggregationScript` and `runScript`.
- Regression fixture: `scripts/test/r5-remote-testcontainers.test.mjs`, creates a fixed log and two per-marker logs, runs the exact aggregation shell, checks both named contents, verifies the fixed log appears once, and verifies `runScript` includes the helper.
- `node --check scripts/test/r5-remote-testcontainers.mjs` — exit 0.
- `node --check scripts/test/r5-remote-testcontainers.test.mjs` — exit 0.
- `node --test --test-name-pattern='remote evidence aggregates every per-marker' scripts/test/r5-remote-testcontainers.test.mjs` — 1/1 PASS.
- `node --test scripts/test/r5-remote-testcontainers.test.mjs` — 32/32 PASS.

At the time this note was created, this was local Node source/shell-fixture evidence only. No Gradle, SSH, remote Testcontainers, TDS, DEV, L2, reset, seed, or database action ran, so the CP-05 full-stage reconciliation was still open then.

Dexter directed on 2026-09-27 that CP-03 and CP-04 standalone reconciliations be deferred until the implementation target is complete. This does not create separate review gates per edit or file. The authorized whole-batch 6b reconciliation remains required before the first dynamic run.

## Subsequent reconciliation status

The `CP-05_RECONCILIATION=OPEN` line above records the status when this repair note was first written. The complete CP-05 source/focused scope was subsequently reconciled as `MATCHED`, `M/S/N=0/0/0`, by the fresh independent review recorded in `2026-09-27-v2s-terminal-activation-batch-1-cp05-reconciliation-codex.md`. That reconciliation does not claim remote runtime evidence; managed TDS/backend-acceptance, DEV, L2 and cleanup remain unproven here.
