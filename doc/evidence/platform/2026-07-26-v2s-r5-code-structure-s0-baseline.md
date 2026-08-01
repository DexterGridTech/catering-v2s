---
title: R5 结构整改 S0 分母与控制基线
status: S0_ENTRY_PASS
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
scope: STRUCTURE_REMEDIATION_S0_ONLY
authorityBoundary: No business capability, contract, schema, migration, DEV, seed, or runtime behavior is changed by this evidence.
---

# R5 结构整改 S0 分母与控制基线

## 1. 冻结分母

| 面 | 分母 | owning source |
|---|---:|---|
| edge HTTP controller | 24 | `doc/review/platform/2026-07-26-v2s-r5-code-structure-retrospective-and-remediation-plan.md` §4.2 |
| frontend surface | 22 | `contracts/policy/frontend-asset-carryover-manifest.json` |
| frontend page design key | 25 | manifest `pageDesignKeySurfaceCrosswalk` |
| operations page keys | 17 | 12 `PG-*` + 5 `HOME-*`; `HOME-*` only permits `CARRY_ROUTE_BOOTSTRAP_ONLY` |
| scenario / operation | 32 / 104 | accepted R5 whole-scope design; structure work must not alter either denominator |

The 24-controller denominator concerns HTTP edge sources only. `BusinessDataConfiguration`, boot,
Problem advice, and generated registry/problem classes are assigned separately and are not owner-library
or controller counts.

## 2. S0 ownership map

| slice | target owner | current implementation source family | next package |
|---|---|---|---|
| platform session | platform face edge | `PlatformAuthenticationController`, `PlatformAdminGovernanceController` | `app.edge.platform.session` |
| platform workspace | platform face edge | `PlatformWorkspaceAdministrationController`, `PlatformCommercialGroupController` | `app.edge.platform.workspace` |
| platform workspace IAM | platform face edge | role, account, invitation, invitation-candidate controllers | `app.edge.platform.workspaceiam` |
| platform read/definition/asset | platform face edge | organization, contract, extension, asset controllers | `app.edge.platform.{organization,contract,extension,asset}` |
| operations session/context | operations face edge | authentication, catalog-authentication, login-entry, membership controllers | `app.edge.operations.{session,context}` |
| operations organization/contract/access | operations face edge | organization, store-profile, contract, invitation, invitation-candidate controllers | `app.edge.operations.{organization,contract,access}` |
| public entry | public face edge | asset, invitation, password-reset controllers | `app.edge.publicentry.{asset,invitation,passwordreset}`; Java identifier avoids reserved word only |
| shared cross-face | app assembly edge | `ContractProblemAdvice`, generated registry/problem sources | `app.edge.{problem,generated}` |

Frontend ownership is frozen by the manifest: `surfaces[*].id`,
`foundationConsumptionBySurface`, and `textAssertionsBySurface` each contain the same 22 ids. Fifteen
surfaces carry the 25 page keys; the remaining seven are auth/public/shell/password non-page surfaces.
Each surface must be carried by the named capability in the remediation plan §4.3. `PLATFORM-*` have ten
feature owners; the twelve operations/public surfaces include `OPERATIONS-FIVE-HOME-BOOTSTRAPS`, whose
five keys remain app routes only and do not create a generic dashboard feature.

## 3. Existing-control baseline

| control | S0 state | proof / activation rule |
|---|---|---|
| `scripts/check/code-layout` | ACTIVE_RED_VERIFIED | Real nested frontend traversal and backend app-root allowlist are protected by scratch mutations; production must remain compliant. |
| `scripts/check/frontend-architecture` | ACTIVE_RED_VERIFIED | Private-feature UI, direct transport, and lifecycle-idempotency predicates are active; existing source violations remain visible until the Phase C substrate is complete. |
| backend ArchUnit | ACTIVE_RED_VERIFIED | Servlet, persistence, and peer-capability boundaries are active with fixtures; existing servlet edge violations remain visible until Phase B closes them. |
| edge route coverage | ACTIVE_RED_VERIFIED | Runtime routes are checked in both directions against the generated registry, excluding only framework error/actuator paths. |
| security and logging controls | ACTIVE_RED_VERIFIED | Security mutates a production-read route registry; logging examines value-side plaintext literals rather than identifier names. |
| aggregate `scripts/verify` | OUT_OF_SCOPE_THIS_PACKAGE | It remains visibly red before S5 because affected L2 targets and dynamic evidence do not yet exist; this evidence does not call it PASS. |
| routed pitfall anchor | OUT_OF_SCOPE_THIS_PACKAGE | `required-inventory.json` remains frozen. The app-root accumulation rule is carried by blueprint §14 and existing mechanical controls; only a future governance batch may add routed memory. |

Controls do not cross the work they guard in a `PENDING` state. Each listed control is active only after
the same production predicate has failed a real scratch mutation. A current production failure remains an
honest Phase B/C input, not a reason to postpone the control or rename the failure as a pass.

`scripts/check/affected-l2` is deliberately red at this point: its 25 mapped rows are complete, but 18
future R5 focused L2 files do not exist yet. This is a missing implementation-evidence denominator, not an
unclassified mapping. It stays open for S2-S4; S0 does not suppress or relabel it as PASS.

## 4. S0 exit status

`S0_ENTRY_PASS`. Mechanical readback confirmed: 24 controller source names are all present in the §4.2
map; the manifest has 22 surface ids, matching both foundation and text-assertion keysets; it has 25 page
keys (12 `PG-*`, 5 `HOME-*`); and `code-layout` passes with its real nested-layout red mutation. S1 may
start. DEV/seed remains paused independently until S0-S4 all pass.

## 5. Subsequent verified execution record

This record is not an S1/S2 closure claim. It records only work already rebuilt against current bytes:

| item | result |
|---|---|
| 24 edge controllers | moved from `app/` root into `edge/<face>/<capability>`; Java's reserved `public` identifier is represented as `publicentry` only in package names, never in HTTP consumer-face data |
| session cookie responsibility | platform and operations cookie reads occur only in their respective `*SessionResolver`; focused `BackendModuleBoundariesTest` rejects a deliberate cookie-reading controller fixture |
| backend rebuild | `gradle :apps:backend:catering-business-server:compileJava --no-daemon` PASS after the move and resolver changes |
| platform transport | direct `fetch` moved to `app/api/client/platformClient.ts`; platform typecheck and architecture test PASS |
| server-owned invitation expiry | platform UI no longer computes invitation reissue expiry; `WorkspaceInvitationService` computes the reissue TTL through its injected clock, matching the request schema that accepts only `expectedVersion` |
| frontend transport guard | existing `frontend-architecture` now rejects direct `fetch` outside app transport files; its scratch mutation PASS. R3 `src/main.js` static boundary snapshots are excluded because Vite uses `main.tsx`, while the hash-bound historic files are retained as evidence only |
| backend app root | boot/config/generated sources moved respectively to `bootstrap/`, `configuration/`, and `edge/generated/`; `edge-codegen --check` and its deliberate drift mutation PASS against the new output paths |
| platform app shell | `PlatformApp` is being reduced to shell/session composition; the fixed platform denominator remains ten surfaces, and any missing surface stays visible until Phase D rather than being renamed as “nine existing” |
| operations app shell | login and context selection live in `authentication` and `work-context`; route rendering uses an explicit `PG-*` registry with fixed columns, never JSON-key-derived columns or a raw JSON detail drawer |
| public paths | invitation acceptance and password recovery are independent capability features; the former `PublicEntry` mixed file is absent and the architecture test reads both owning feature sources |
| R3 static security compatibility | `security-boundaries` reopens the frozen R3 path fragments (rather than treating the 104-operation R5 master OpenAPI as a three-operation contract), checks the moved C-01 controller's session resolver boundary, and passes |
| mutation transport baseline | an app-client generated `Idempotency-Key` is not lifecycle-owned replay protection. Every catalog-required mutation must use a foundation lifecycle stable key; remaining violations stay visible for Phase C. |
| immutable memory boundary | an attempted active pitfall entry was rejected by the independently frozen `required-inventory` denominator; it was removed, `project-memory` is PASS, and the plan now records that a future governance batch—not this structural implementation—must authorize a routed-memory addition |
| typed edge failure | production controllers no longer throw `IllegalArgumentException`; `InvalidEdgeRequestException` is mapped by `ContractProblemAdvice`, and `BackendModuleBoundariesTest` proves a deliberate controller fixture with that framework-default exception turns red |
| Problem envelope ownership | platform and operations authentication controllers now reuse the single `ContractProblemAdvice.Problem` envelope instead of defining face-local copies; focused backend test, compile, security and layout checks remain PASS |

The above are execution observations, not an S4 closure declaration. In particular, the affected-L2 registry
still names focused Playwright files that require the later managed DEV routes. Their current absence remains a
visible `R5_AFFECTED_L2_TARGET_MISSING` result and cannot be converted into a pass by path-only stubs.

## 6. Known aggregate failures registered before Phase D

- `scripts/check/logging-boundaries` **was** red because its prior identifier-side regex treated the
  cookie-name constant `COOKIE = "V2S_OPERATIONS_SESSION"` as a sensitive value. Phase A corrected it to
  a value-side plaintext-literal predicate and red-verified a real plaintext-password mutation; its current
  result is green. The former red is retained here as a diagnosed false-positive, not rewritten as a past pass.
- `scripts/verify` is currently red at `U10-affected-l2` because focused L2 targets and their managed
  dynamic evidence have not yet been created. This is a real Phase D prerequisite, not a static failure
  that may be hidden, stubbed, or reworded.

## 7. Phase A red-verification record

All controls were activated before the Phase B substrate work. Each result below is a real mutation in an
isolated scratchpad copy; a self-test green result was not used as the activation proof.

| item | scratch mutation and observed result |
|---|---|
| A1 route reverse coverage | Added `@GetMapping("/phase-a-red")` to the scratch `OperationsAuthenticationController`; the Testcontainers-backed `EdgeRouteRegistryCoverageTest` failed with `R5 runtime route outside generated registry: ... GET /api/operations/auth/phase-a-red`. The existing five external endpoints remain separately visible as the Phase B6 input. |
| A2 persistence boundary | Scratch `JdbcTouchingController` fixture injected `JdbcTemplate`; `edgePersistenceBoundaryRejectsProductionShape()` passed only because the ArchUnit rule rejected the fixture. |
| A3 capability boundary | Scratch `operations.contract` fixture imported `operations.organization` and was rejected; the paired `operations.session` dependency passed as the explicit resolver exception. |
| A4 servlet boundary | Scratch controller fixture accepted `HttpServletRequest` and was rejected by `EDGE_CONTROLLERS_DO_NOT_TOUCH_SERVLET_API`; the real tree's 118 servlet dependencies remain the Phase B4 input. |
| A5 frontend lifecycle | In a scratch feature that otherwise passed the frontend control, removed `lifecycle.getIdempotencyKey()` from a POST; the command failed `R5_FRONTEND_MUTATION_LIFECYCLE_MISSING`. |
| A6 backend app root | Added scratch `app/service/StrayService.java`; `code-layout` failed `BACKEND_APP_ROOT_NOT_ALLOWED`. |
| A7 security input | Changed the scratch production-read route-face registry from `platform-admin` to `operations-admin`; `security` failed `R4_SECURITY_ROUTE_FACE_REGISTRY_DRIFT`. |
| A8 logging predicate | Added scratch `password = "plaintext"`; `logging` failed `R4_LOGGING_SENSITIVE_LITERAL`. |
| A9 control-state closure | Changed a scratch control-table state to `PENDING Phase B`; existing `implementation-design-granularity --s0-baseline` failed `S0_BASELINE_CONTROL_STATE_INVALID:PENDING Phase B`. |

The production readbacks after activation are intentionally not all green: route reverse coverage and servlet
boundaries are the Phase B work inputs, and frontend lifecycle remains the Phase C input. Their red results
are recorded rather than relabelled as an S0 pass.
