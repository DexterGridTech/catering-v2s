SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# TDP DEV start failure disposition

## Preserved first failure

- Run: `r5-dev-1791126903674-66995-f72cf4d5-2236-40a5-9211-d8bdbc6b7c33`
- First failure: `REMOTE_EXECUTION_FAILED: ERROR: schema platform_workspace does not exist` at `REMOTE_TDS_CONTROL`.
- Business: FAIL; DEV never reached readiness.
- Initial cleanup: FAIL because the runner treated TDS database-principal provisioning as an attempted TDS process start and therefore demanded a TDS process stop receipt when no TDS control file/process had been created.
- Recovery: `scripts/dev/cleanup-failed-start <runId>` appended `cleanupRecovery.status=PASS`, after checking the run-root and finding zero active processes, zero owned containers, and zero uninspectable processes. The original failure and initial cleanup result were not overwritten.
- No reset, seed, or database mutation was performed by the recovery.

## Finding intake

`CONFIRMED` — the start order allowed TDS role grants to run while business Flyway was still creating the named owner schemas. `start()` called `startRemoteJava()`, then immediately called `startRemoteTds()`; the latter provisioned TDS database privileges before writing TDS control/process state. The existing business readiness probe reports Spring readiness only after Flyway. This ordering could produce a transient “schema does not exist” failure and misclassify a schema-creation race as TDS startup failure.

`CONFIRMED` — failed-start cleanup returned early when the remote run root was absent, without scanning process arguments or CWD. A process can outlive deletion of its workspace and expose a CWD ending in ` (deleted)`, so root absence alone is not a sufficient process readback.

## Generic failure pattern and finite boundary

- Pattern: resource setup that names database objects must wait for the existing migration/readiness owner; runner ownership accounting must begin at the process-launch boundary, not at prerequisite provisioning.
- Finite denominator: all TDS start attempts in `scripts/dev/r5-dev-runner.mjs`, where the principal grant references Flyway-created schemas, plus failed-start cleanup of all resources bound to a specific `/tmp/r5-dev-<runId>` root.
- Counterexample: backend acceptance against a Testcontainers database whose migrations have already completed before TDS startup; no runner readiness reorder is needed there. The run-root cleanup scan still applies whenever remote resources may outlive the root directory.
- Smallest prevention: reuse `waitForRemoteBusinessReady` before TDS grants, provision the role before marking the TDS process as attempted, and make the existing failed-start cleanup scan all process/container evidence even when the root path is absent. No new lifecycle framework or generic retry was added.
- Durable prevention: focused regression in `scripts/dev/r5-dev-command-wrapper.test.mjs`, the lifecycle explanation in `scripts/README.md`, and this finite failure disposition.

## Current proof

- `node --check scripts/dev/r5-dev-runner.mjs scripts/dev/r5-dev-command-wrapper.test.mjs` — PASS.
- `node --test scripts/dev/r5-dev-command-wrapper.test.mjs` — PASS, 20/20.
- Managed failed-start recovery: PASS for the run above; it is cleanup evidence only, not a successful DEV startup.
- A new DEV start has not yet been run on the repaired bytes. DEV readiness and Expo Web remain `NOT_RUN` for the repaired runner bytes.
