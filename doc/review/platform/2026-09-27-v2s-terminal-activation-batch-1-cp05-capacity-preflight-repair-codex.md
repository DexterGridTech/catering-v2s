# CP-05 · managed TDS capacity preflight repair

`STATE=FIXED_LOCAL; ORIGINAL_CAPACITY_INPUT=SUPERSEDED_BY_REPOSITORY_FILE; CP-05_RECONCILIATION_AT_CREATION=OPEN; CURRENT_CP-05_RECONCILIATION=MATCHED`

## Confirmed finding

The fresh CP-05 reviewer found that backend-acceptance's remote SSH preflight read `V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS` and `V2S_TDS_MAX_TRACKED_SESSIONS` from the remote login environment. The local runner sent the preflight script but neither supplied the values nor guaranteed that the remote shell had them. This violated the detailed design's managed-configuration requirement and made the dynamic-run boundary depend on hidden remote shell state.

## Repair and chosen form

The backend-acceptance runner now validates both required values from its local process environment before inspecting/stopping DEV or opening SSH. It fails closed with `LOCAL_TDS_CAPACITY_REQUIRED_OR_INVALID` for missing or invalid values. The same validated pair is shell-quoted into the remote preflight body, recorded in `manifest.resourcePreflight.tdsCapacity` with source `LOCAL_REQUIRED_ENVIRONMENT`, and passed into the managed TDS process environment. Remote preflight no longer reads either key from the login shell.

I chose the local required environment as the sole input rather than the remote shell environment because the existing DEV launcher already consumes these same local environment keys; one explicit invocation input now feeds both managed launch paths and the run manifest records the exact values/source.

## Evidence

- Requirements/design: batch-1 requirement R-4.2; implementation design §§10.4, 10.5, 13, and §12.2; plan Steps 6–7 and §6 dynamic preflight.
- Existing shared config precedent: `scripts/dev/r5-dev-environment.mjs` reads and validates both keys from the local process environment; `scripts/dev/r5-dev-runner.mjs` copies the validated values into the remote TDS environment.
- Owning fix: `scripts/test/r5-remote-testcontainers.mjs` validates local capacity before DEV lifecycle work, injects the values into `remotePreflightScript`, records their source, and forwards them through `backendAcceptanceEnvironment`.
- Regression coverage: `scripts/test/r5-remote-testcontainers.test.mjs` proves missing/invalid local values fail closed, the configured values enter the remote preflight body, remote preflight no longer reads implicit shell variables, parsed capacity is marked as local configuration, and the same values reach the TDS process environment.
- A prior CP-05 classpath-slice record incorrectly claimed the OpenAPI operation had `x-authorization-mode: NONE`. Reopened current sources and corrected `doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-step-7-cp05-classpath-codex.md`: the accurate evidence is OpenAPI `security: []`, `PUBLIC_PROTOCOL_CONTEXT`, the public controller without session/permission dependencies, and the acceptance request's absent Cookie/Authorization/Idempotency-Key headers.
- `node --check scripts/test/r5-remote-testcontainers.mjs` — exit 0.
- `node --check scripts/test/r5-remote-testcontainers.test.mjs` — exit 0.
- Focused preflight/configuration tests — 3/3 PASS.
- The first full-suite run after adding the source field returned 32/33 PASS; the sole failure was a stale test expectation omitting `source: LOCAL_REQUIRED_ENVIRONMENT` from the parsed capacity object. Updated that expected value only; the failure output is preserved in the task tool history.
- Full `node --test scripts/test/r5-remote-testcontainers.test.mjs` rerun — 33/33 PASS after that expectation correction.

At the time of this record, the current local process environment and `.runtime/r5/credentials.env` did not supply these values. No managed runtime proof was claimed. The initial `CP-05_RECONCILIATION=OPEN` status above was superseded by the fresh independent CP-05 source/focused reconciliation, `MATCHED` with `M/S/N=0/0/0`, recorded in `2026-09-27-v2s-terminal-activation-batch-1-cp05-reconciliation-codex.md`. The managed runtime evidence is still required before the first TDS start.

## Superseding capacity decision

The preceding paragraphs describe the runner behavior and absent inputs at the time this record was written. Dexter later delegated the low-load DEV selection to the main agent and required a repository file plus README instructions. The current configuration is `scripts/env/tds-dev-capacity.json` with RSS `512 MiB`, unauthenticated connection limit `4`, and tracked session limit `8`; `scripts/env/tds-capacity-configuration.mjs`, `scripts/dev/r5-dev-environment.mjs`, `scripts/test/r5-remote-testcontainers.mjs`, and `TdsAcceptanceProcess.java` now use that file. See `doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-6b-m1-capacity-repair-codex.md` for the implementation evidence. The earlier environment-sourced description is historical and must not be used as current configuration or runtime proof. No managed start has run yet.
