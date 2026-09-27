# Batch 1 implementation evidence — CP-05 classpath isolation work item

`EVIDENCE=LOCAL_STATIC_BUILD`
`CP_RECONCILIATION=DEFERRED_UNTIL_CP05_COMPLETION`
`PRIOR_SLICE_REVIEW=HISTORICAL_EVIDENCE_ONLY`

## Scope

This step adds a static classpath proof for the CP-05 backend-acceptance topology. It is limited to proving that business acceptance does not load the TDS project, and that the separately packaged TDS runtime resolves its intended dependency versions and excludes the forbidden business/storage modules. It does not start a backend, TDS, Testcontainers, DEV, SSH tunnel, L2, reset, or seed.

## Inputs reopened before the change and after the focused proof

- Requirement: `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` §3.1 R-1.1 says activation is public and requires no login session; §1.1 assigns the backend-acceptance multi-instance harness to batch 1.
- Design: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md` §1 and §3 CP-05 require a separate TDS process/classpath; §2 specifies TDS dependency boundaries; §12.2 lists classpath/version checks and prohibited artifacts; §12.2 backend-acceptance row requires the business/TDS classpath separation fixture.
- Plan: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md` step 7 requires separate business and TDS classpaths; §6 steps 3–6 prohibit remote runs before the complete topology and reconciliations.
- Project memory and standards: `project-memory/operations/backend-acceptance.md`, `project-memory/decisions/deterministic-context-only.md`, `doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md`, and `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` were reopened. This slice is build/classpath evidence only, not managed runtime or business-acceptance evidence.
- Owning sources reopened: `apps/backend/catering-business-server/build.gradle.kts`, `apps/backend/terminal-data-server/build.gradle.kts`, `scripts/test/backend-acceptance-structure.test.mjs`, the activation contract and controller, and `StoreTerminalAcceptanceScenarios.java`.

The same requirement/design/standard and owning-source criteria were read back after the focused proof. Activation remains public and unauthenticated: the OpenAPI operation declares `security: []` (`activation.paths.json:33`); its handler binding uses `PUBLIC_PROTOCOL_CONTEXT` (`operation-handler-bindings.json:4750-4763`); the controller has no user-session/permission dependency (`TerminalActivationController.java:15-28`); and the real acceptance request omits Cookie, Authorization, and Idempotency-Key (`StoreTerminalAcceptanceScenarios.java:292-318`). `PLATFORM_COMMON_ACCESS_DENIED` for a disabled/invalid business state is not user-permission authorization. No activation code was changed.

## Changes

- `apps/backend/terminal-data-server/build.gradle.kts`: set the production BootJar name to `terminal-data-server.jar` so the managed acceptance process can refer to a stable artifact.
- `apps/backend/catering-business-server/build.gradle.kts`: add `verifyBackendAcceptanceRuntimeClasspaths`. It resolves the business `testRuntimeClasspath` and TDS `runtimeClasspath` separately, rejects the TDS project on the business test classpath, rejects prohibited TDS runtime artifacts, checks Boot/Reactor/Netty versions and the TDS BootJar, then writes the resolved coordinates to `build/reports/backend-acceptance/runtime-classpaths.txt`.
- `scripts/test/backend-acceptance-structure.test.mjs`: add a structural guard and red fixture for a TDS project dependency declared on the business app.

## Focused proof and outcome

- `node --test scripts/test/backend-acceptance-structure.test.mjs` — PASS, 3 tests, including the TDS-on-business-classpath red fixture.
- `./gradlew :apps:backend:catering-business-server:verifyBackendAcceptanceRuntimeClasspaths --no-daemon` — PASS, `BUILD SUCCESSFUL`; 137 business test-runtime artifacts and 76 TDS runtime artifacts resolved.
- The generated report at `apps/backend/catering-business-server/build/reports/backend-acceptance/runtime-classpaths.txt` records business Boot `4.1.0`; TDS Boot `4.1.0`, Reactor Netty HTTP `1.3.7`, Reactor Core `3.8.7`, Reactor Pool `1.2.7`, and Netty `4.2.17.Final`; the business graph contains no `:apps:backend:terminal-data-server` project component. The TDS graph contains `terminal-binding`, `foundation`, and `audit-model`; it contains none of the prohibited business app, `store-terminal`, `organization`, `extension`, `platform-admin-iam`, `catalog`, `asset`, Flyway, MinIO, or AWS SDK artifacts.

## Prior slice reviews and main-agent finding intake

Earlier slice reviewers first returned `OPEN` on the authorization evidence, then a third reviewer returned `MATCHED` after the record cited the exact contract and classpath sources. Those slice verdicts are retained as historical evidence; none is a CP-05 stage reconciliation. A later slice reviewer again alleged that the current activation OpenAPI lacks `x-authorization-mode: NONE`. Main-agent intake reopened the current `contracts/openapi/paths/terminal/activation.paths.json`: `security: []` is at line 33 and `x-authorization-mode: "NONE"` is at line 79. The latest allegation is therefore `REJECTED_WITH_EVIDENCE`. The registry uses `PUBLIC_PROTOCOL_CONTEXT`, the controller has no session or permission dependency, and the acceptance request has no Cookie or Authorization header. The 403 for an inactive store is the accepted business-state rejection, not a user authorization check. Activation has no user permission restriction.

The fresh CP-05 classpath step review on 2026-09-27 returned `OPEN`, claiming both that this record said `x-authorization-mode: NONE` at line 17 and that the field is absent from the current contract. Main-agent intake rechecked both bytes: line 17 only lists the reopened owning sources; `activation.paths.json:79` explicitly declares `"x-authorization-mode": "NONE"`, alongside `security: []` at line 33. The alleged evidence mismatch is `REJECTED_WITH_EVIDENCE`; this finding does not require a code or contract change.

## Preserved first failure

The first Gradle proof failed with `TDS_RUNTIME_VERSION_MISMATCH:io.projectreactor:reactor-pool:1.2.7`. Inspection of the resolved graph and dependency declaration showed that the actual Maven group is `io.projectreactor.addons`; the source assertion used the wrong group. The assertion was corrected to the resolved coordinate and the same focused Gradle task passed. The first failure remains recorded here; the later successful task ran after that source correction.

## Evidence boundary and next step

This is local static/build classpath evidence only. It does not prove a REACTIVE TDS process, separate process identity, two business contexts, Node/Undici, real HTTP/WebSocket, shared remote PostgreSQL/run identity, outage/recovery, managed logs, or cleanup. The classpath checks and their historical slice reviews are local evidence only; they do not close CP-05. CP-05 and its topology admission remain OPEN until the complete CP-05 implementation work and focused proofs are finished and its single stage reconciliation is recorded. No remote execution was attempted. Subsequent CP-05 work must add the contexts/process harness and static proof before any authorized managed run.

## Run status

- Current-byte latest run: local `verifyBackendAcceptanceRuntimeClasspaths`, 2026-09-27, PASS; this is not remote runtime proof.
- Last PASS: same current-byte Gradle classpath task; the earlier CP-04 focused PASS used different bytes and proves no CP-05 topology behavior.
