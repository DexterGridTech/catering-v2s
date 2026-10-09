# Stage B CP-02 implementation proof

## Scope and result

CP-02 implements the CBS terminal-update artifact owner, private asset staging/claim/release integration, package parsing and signature validation, artifact persistence/audit, generated edge exposure, and the focused HTTP acceptance scenarios registered for the later managed acceptance run. CP-02 work is implemented. This record separates local focused proof from managed business evidence; it does not claim the latter has run.

The owner-identity findings are recorded in [the CP-02 finding intake](2026-10-09-ter-version-update-stage-b-cp-02-stage-actor-intake-codex.md). The confirmed gaps were missing persisted stage creator identity and a completed register receipt that was not bound to its actor. The minimum correction stores actor type/id on the existing stage row, scopes the asset-stage idempotency key and register request hash by actor, and retains the same receipt table/lock/transaction. Missing or cross-workspace resources remain hidden as 404; a different stage actor in the same workspace receives `TERMINAL_UPDATE_STAGE_NOT_OWNED/403`; a different register receipt actor receives the existing idempotency conflict before artifact data is returned.

## Focused evidence

| Proof | Command / source | Result | Boundary |
| --- | --- | --- | --- |
| Artifact owner and parser tests | `./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --no-daemon` | Earlier whole-module run: 12 tests, 0 failures/errors (owner 5, parser 7). After receipt-actor fix, focused owner run below: 6 tests, 0 failures/errors. | Exercises creator ownership, actor-scoped stage identity, ordinary manifest/path/declared-size checks and signature-tool rejection. Does not execute PostgreSQL migration or HTTP adapter. |
| Register receipt actor replay | `./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --tests 'com.catering.v2s.terminalupdate.application.TerminalUpdateArtifactOwnerServiceTest' --no-daemon` | `BUILD SUCCESSFUL`; JUnit XML owner service: 6 tests, 0 failures, 0 errors | Original actor receives its exact committed receipt; another actor using same key/body gets the existing idempotency conflict. No DB/HTTP runtime claim. |
| Audit read integration tests | `./gradlew :apps:backend:catering-business-server:modules:audit-read:test --no-daemon` | Previously completed successfully; 11 tests, 0 failures/errors | Existing audit read path only; the new artifact HTTP audit scenario remains for managed acceptance. |
| Canonical materialization | `node scripts/generate/r5-edge-materialize.mjs --check` | PASS, 264 operation identities | Generated contract freshness, not application behavior. |
| Edge generation | `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --check` | PASS, 481 generated files | Generation consistency only. |

The last full module `test` invocation includes compilation of the changed terminal-update module and its tests. Whole CBS application compilation is intentionally deferred to CP-03, when the planned rule adapters and their registered M1 bindings exist. No unchanged full-app compile was repeated.

## Current source coverage

- Canonical contract and generated edge paths are owned by the existing materialize/codegen chain; generated files were not hand-edited.
- `TerminalUpdateArtifactParserTest` covers valid package input plus invalid digest, required file, ordinary path/declared-size boundary, and signature verification failure.
- `TerminalUpdateArtifactOwnerServiceTest` covers stage replay, non-creator acceptance/register/release rejection, same-actor completed register replay, cross-actor completed receipt conflict, actor-scoped idempotency identity, and no downstream asset/audit mutation on rejection.
- `TerminalUpdateAcceptanceScenarios` contains the real HTTP scenarios for artifact parsing/stage/register, replay and scope rejection, and artifact audit readback. They are source-registered but have not yet run against the managed PostgreSQL/asset topology.
- The DDL migration adds stage creator facts to the existing row; persistence writes and reads those facts in the existing stage SQL path. It does not add an ownership table or SQL round trip.

## Deferred proof and CP boundary

`NOT_RUN` in this CP record: PostgreSQL migration execution, real HTTP 403/404 mapping, private object storage behavior, acceptance business assertions, acceptance cleanup, and admin UI flow. These require the authorized managed lifecycle and are scheduled after CP/6b prerequisites; this proof does not turn source or unit tests into business PASS.

Full CBS `compileJava` also remains scheduled for CP-03 after rule operation sources land. The first fresh CP-02 reconciliation found the register receipt actor gap; that finding is recorded and closed in the intake above. A new fresh independent three-dimensional reconciliation (requirements, design/plan, project-memory standards) is required on these corrected bytes before advancing. This file is evidence input for that review, not its verdict.
