# Terminal activation batch 1 · Step 5 reconciliation

## Result

`STEP_RECONCILIATION=MATCHED`

The Step 5 HTTP contract and denial scenarios match the requirement, detailed design, implementation plan, active backend-acceptance standard, routed project memory, and current source. Activation remains public and has no user login, session, IAM, workspace capability, or permission restriction. Store/group status and activation-code checks remain business eligibility rules.

## Input and scope

- Requirement: `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`, R-1.1, R-1.4, V-B1, V-B2, and V-B13.
- Design: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`, §5, §8, §10, and §12.
- Plan: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`, Steps 5 and 7.
- Governing scenario standard: `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`.
- Routed memory: `project-memory/operations/backend-acceptance.md` and `project-memory/operations/test-closed-loop.md`.

The scope is Step 5 only. V-B13's multi-instance, response-drop, held-request, and live TDS assertions remain assigned to Step 7's managed acceptance topology and are not claimed as dynamically verified here.

## Reconciliation and evidence

| Dimension | Finding |
| --- | --- |
| Requirement | R-1.1 says the activation endpoint is public and requires no login session (`requirements-claude.md:85`). R-1.4 fixes business rejection order (`:91-100`). V-B2 requires each rejection to leave no binding or credential digest (`:539-544`). |
| Design and plan | `implementation-design-codex.md:245-247,256` declares `activateTerminal` terminal-face `NONE`, with no user session, IAM requirement, workspace capability, or permission resolver. Plan Step 5 (`implementation-plan-codex.md:30`) requires anonymous real HTTP scenarios and defers execution until Step 7. |
| Production source | `TerminalActivationController.java:15-31` accepts only group key and request body. `ActivateTerminalOperation.java:29-61` validates the protocol request and calls the store-terminal and terminal-binding owners; it has no user-permission dependency. `TerminalBindingOwnerService.java:68-75,77-113` returns a rejection before binding, audit, or notification writes. |
| Contract and HTTP scenario | `contracts/openapi/paths/terminal/activation.paths.json:3-33,79` has `security: []` and authorization `NONE`. `StoreTerminalAcceptanceScenarios.java:121-136` sends activation with no cookie and empty headers, then asserts no Cookie, Authorization, Idempotency-Key, secret response, or set-cookie. |
| Denial oracle | `StoreTerminalAcceptanceScenarios.java:429-471` records scoped counts for `terminal_binding.latest_binding` and `terminal_binding.audit_event`, asserts both start at zero, sends the real anonymous activation request, checks `STORE_TERMINAL_STORE_VOIDED`, then verifies both counts are unchanged. `latest_binding` owns `credential_digest` (`TerminalBindingOwnerPersistence.java:87-113`), so no row means no registered current credential digest for this terminal. `BackendAcceptanceTest.java:1460-1461` implements `host.count` as a parameterized read-only `JdbcTemplate.queryForObject` count. |
| Scenario standard and memory | The active standard requires real fixtures, requests, business oracles, and no illegal write on negative cases (`backend-acceptance-business-scenario-standard.md:65-78`). Routed backend-acceptance memory requires real HTTP and separately reported CONTRACT/BUSINESS outcomes (`project-memory/operations/backend-acceptance.md:16`). The read-only post-request count is an observation oracle; it does not replace the real HTTP activation request. |

The prior fresh Step 5 review returned `OPEN` because the store-voided row checked only the typed error. The operations audit HTTP endpoint cannot serve as the post-void observer: its authorization derives visible stores from enabled organization candidates, and a voided store is no longer in that set. The minimal repair retained that authorization boundary and used the existing test-side read-only count capability. A new fresh, read-only three-dimensional reviewer returned `MATCHED` after checking the repaired current bytes and the complete scoped inputs; it ran no commands or dynamic checks.

## Implementation shape

Reused the existing anonymous activation endpoint and the backend-acceptance host's parameterized read-only count capability. Added only the test-side precondition and post-request no-write assertions. No production authorization behavior or permission model was changed.

## Verification and limits

- `./gradlew :apps:backend:catering-business-server:compileTestJava --console=plain --quiet` — PASS at 2026-09-26 18:43 UTC (`LOCAL-COMPILETEST-2026-09-26T1843Z`). This is local compilation only.
- backend-acceptance, Testcontainers, remote execution, SSH, DEV, TDS/WebSocket, L2, reset, and seed: `NOT_RUN`; no runtime or cleanup PASS is claimed. Plan Step 7 owns the authorized acceptance topology and dynamic V-B cases.

## Independent reconciliation

- Reviewer: fresh independent read-only verifier `/root/step5_recheck_activation_anonymous`.
- Verdict: `STEP_RECONCILIATION=MATCHED`.
- Scope: requirements + design/plan + active standard/routed memory + current source; no tests, builds, scripts, network or runtime operations.
