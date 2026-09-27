# Batch 1 implementation record — CP-05 two business contexts

`STATE=STEP_RECONCILIATION=MATCHED`

## Scope and inputs

This implementation slice extends the sole `BackendAcceptanceTest` lifecycle to start a second business Spring context on an independent servlet port, sharing the same PostgreSQL/Testcontainers and object-storage endpoints as the primary context. It verifies that only the primary context installs the JVM-global database metrics sink, that the second context does not run Flyway, and that each context serves a correlated HTTP read with exactly one observation in the primary sink.

Before editing, and again after the focused proof, I reopened:

- Requirement: `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` §1.1 and §3.1 R-1.1. Batch 1 includes the acceptance harness; device activation is public and requires no login session.
- Design: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md` CP-05 and §10.5; lines 430–442 require two contexts, distinct ports, one metrics sink, shared DB/run identity, and real HTTP, and the R3 registration-gate boundary remains a separate TDS-process proof. §12.2 requires a red fixture against a second metrics sink.
- Plan: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md` step 7 and §6 steps 3–6; the harness must be complete before the first authorized managed run.
- Journey/IA: `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`; this harness adds no user-facing Journey behavior.
- Project memory and active standards: `project-memory/operations/backend-acceptance.md`, `project-memory/decisions/deterministic-context-only.md`, and `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`. The single `BackendAcceptanceTest` is the shared lifecycle entry; topology checks are not added to the business scenario catalog. No business scenario verdict or managed runtime proof is claimed here.
- Owning source: `BackendAcceptanceTest.java`, `BackendAcceptanceMetricsConfiguration.java`, `BackendAcceptanceDatabaseMetricsSink.java`, `DatabaseOperationTracker.java`, the public invitation route/contract, and `backend-acceptance-structure.test.mjs`.

Activation remains permission-free: `contracts/openapi/paths/terminal/activation.paths.json` has `security: []` and `x-authorization-mode: "NONE"` for `activateTerminal`; its operation binding is `PUBLIC_PROTOCOL_CONTEXT`; the controller has no user-session/permission dependency; and the activation acceptance request asserts absent Cookie, Authorization, and Idempotency-Key headers. No activation behavior or authorization configuration was changed in this slice.

## Changes and selected shape

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java`: use per-class JUnit lifecycle; require the managed remote runner before starting the child context; start a second `CateringV2sApplication` with a servlet web type, an ephemeral port, the same Testcontainers-backed properties, and `spring.flyway.enabled=false`; assert distinct ports, one metrics sink/registration only in the primary context, and no Flyway bean in the second. Create a fixture once and issue the same real public invitation read through each port, checking returned type, the primary sink snapshot, and exactly one observation per correlation ID. Reuse the existing dynamic-property suppliers for both contexts so their endpoints and credentials do not drift.
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceDatabaseMetricsSink.java`: count sink callbacks by correlation ID in addition to retaining the existing snapshot, so duplicates are detectable rather than silently overwritten.
- `scripts/test/backend-acceptance-structure.test.mjs`: add a red fixture that injects `BackendAcceptanceMetricsConfiguration` into the second builder and requires `BACKEND_ACCEPTANCE_SECOND_CONTEXT_REPLACED_METRICS_SINK`.
- `spotlessJavaApply` also formatted these already in-scope activation source files: `StoreTerminalAcceptanceScenarios.java`, `ContractProblemAdvice.java`, `TerminalActivationCancellationController.java`, `TerminalActivationProblem.java`, `ActivateTerminalOperation.java`, and `OperationsTerminalActivationProblem.java`.

I chose a second independent `SpringApplicationBuilder` context in the acceptance JVM, rather than inheriting the primary context as its parent, because it creates a second server/bean graph without duplicating the process-global measurement sink. The context reuses the same container-backed endpoint suppliers and disables its own migrations.

## Focused proof and first failure

- `node --test scripts/test/backend-acceptance-structure.test.mjs` — PASS, 4 tests; the new second-sink mutation fails with its named marker.
- `./gradlew :apps:backend:catering-business-server:spotlessJavaCheck :apps:backend:catering-business-server:compileTestJava --no-daemon` — PASS. This formats/checks Java sources and compiles test code; it does not run JUnit or start Testcontainers.
- The first `compileTestJava` attempt failed because I imported `WebServerApplicationContext` from the pre-versioned Boot package. Inspection of the locally resolved Boot `4.1.0` artifact showed that its actual path is `org.springframework.boot.web.server.context.WebServerApplicationContext` in `spring-boot-web-server-4.1.0.jar`; `javap` confirmed `getWebServer()`. I corrected the import and the same focused compile plus format check passed. The failed compiler result is retained here.

## Evidence boundary and next step

This is source, formatter, Node-static, and Java-compile evidence only. `@BeforeAll` now contains the intended live topology proof, but it has not executed: there is no proof yet that either context starts, that either HTTP request succeeds, that the shared database read succeeds, or that teardown is clean. No backend-acceptance command, Testcontainers, DEV, SSH tunnel, L2, reset, or seed was run. The fresh independent reviewer returned `STEP_RECONCILIATION=MATCHED` for this two-context slice and confirmed that runtime topology remains unproved. Continue CP-05 by adding the separate TDS process and pinned Node client before any managed runtime admission.

## Run status

- Current-byte latest runs: `spotlessJavaCheck` + `compileTestJava` PASS and `node --test scripts/test/backend-acceptance-structure.test.mjs` PASS (4/4), 2026-09-27.
- Last PASS: same current bytes; neither result proves the remote harness topology or cleanup.
