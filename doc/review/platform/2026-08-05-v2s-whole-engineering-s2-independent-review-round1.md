# S2 Whole-Engineering Independent Implementation Review — Round 1

```text
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-S2-OBSERVABILITY-20260805
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=VALID
```

## Scope and method

This is a fresh, adversarial, source-first review of S2 (RP-04/RP-05/RP-06). I first read the repository instructions, active platform roadmap context, applicable project-memory kernels, the generated edge registry, backend diagnostic/problem/bootstrap sources, frontend foundation observability sources, and their focused tests. Only after that source audit did I read the S2 design, manifest, proof receipt, and review-input material. No DEV/UAT/HTTP/L2/seed/reset or Git operation was performed.

The implementation is **NO-GO** for this round. The backend completion event, typed event shape, bootstrap structured failure log, and app-owned ErrorBoundary wiring are materially present, but the cross-layer observability contract still has confirmed correlation/privacy defects and the claimed red-mutation proof is incomplete.

## Findings

### S1 — Opaque invitation token is emitted in frontend observability fields

- **Status:** `CONFIRMED`
- **Severity:** `S` (security/privacy and observability contract breach; promote to `M` if public invitation links are treated as bearer credentials in the product threat model)
- **Evidence:**
  - `libraries/frontend/admin-ui-foundation/src/observability/observedBaseQuery.ts:70-71` derives `operationId` and `routeTemplate` from the concrete request URL.
  - `libraries/frontend/admin-ui-foundation/src/observability/observedBaseQuery.ts:12-15` only removes query text, UUID-like segments, and long numeric segments; it does not remove opaque invitation tokens.
  - `apps/frontend/operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx:18,29,35` passes `invitationToken` into the generated public client. `apps/frontend/operations-admin/src/api/generated/OperationsApi.ts:30-44` expands it into the concrete path `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}`.
  - `libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts:59-64` deletes blocked **keys**, but does not inspect/redact sensitive values in allowed `operationId` or `routeTemplate` fields. The value therefore reaches the in-memory event, console path when enabled, and the configured beacon/fetch sink.
- **Why it applies:** S2's frontend sink denominator includes all observed app requests, not only private/admin calls. A public invitation route is an in-scope frontend request and its token is an opaque credential-like path value. The backend public-security observer exemption does not make a frontend log value safe.
- **Smallest repair:** Build the event route/operation from generated operation metadata, or explicitly sanitize the sensitive generated path parameter before logging. Add a focused test with a non-UUID opaque token that asserts neither event field nor serialized sink payload contains the token.
- **Disposition:** `OPEN` — blocks GO.

### S2 — `ContractProblemAdvice` overload can return a correlation ID different from the completion event

- **Status:** `CONFIRMED`
- **Severity:** `S`
- **Evidence:**
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:244-252` correctly reads the canonical completion state when invoked with `HttpServletRequest`.
  - The overload at `ContractProblemAdvice.java:255-260` instead uses `request.correlationId()` and generates a new UUID when it is absent/invalid.
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/RequestCompletionDiagnosticState.java:33-41` creates and freezes a separate canonical correlation value for the request.
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/session/EdgeRequestContextArgumentResolver.java:33-40` obtains the context correlation from the public-security state; when no valid incoming header exists, that state may generate another value (`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/PublicSecurityDiagnosticRequestState.java:50-53`).
  - Mapped business controllers, for example `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspace/PlatformCommercialGroupController.java:93-102`, use the `EdgeRequestContext` overload. Thus a no-header or invalid-header error can have: completion event/response header correlation A, but Problem body correlation B.
  - Existing tests use a manually supplied valid correlation or the servlet overload and do not cover the no-header/invalid-header business-controller path.
- **Why it applies:** This is the exact failure mode S2 is intended to prevent: a user-visible Problem cannot be joined to the permanent completion event. Valid caller headers mask the defect; the default path does not.
- **Smallest repair:** Make the context overload read the request's canonical completion state (or inject that canonical value into `EdgeRequestContext` before controller invocation), then add an integration-style focused test for both absent and invalid `X-Correlation-Id`.
- **Disposition:** `OPEN` — blocks GO.

### S3 — Frontend event uses the client-generated request ID instead of the backend canonical request ID

- **Status:** `CONFIRMED`
- **Severity:** `S`
- **Evidence:**
  - `libraries/frontend/admin-ui-foundation/src/observability/observedBaseQuery.ts:42` creates a local request ID; `:62-66` reads response correlation/trace headers but does not read `X-Request-Id`; `:70-74` emits the local `requestId` in the frontend event.
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/RequestCompletionDiagnosticState.java:33-41` and `RequestCompletionDiagnosticInterceptor.java:33-34` generate the canonical edge request ID and place it on the response. The accepted design explicitly treats edge-generated request ID as canonical and does not trust external request-ID values.
  - Therefore a normal frontend request produces a frontend event with request ID A and a backend completion event/response with request ID B, even though correlation may match.
  - Existing `observedBaseQuery` tests do not assert propagation of a response `X-Request-Id`.
- **Why it applies:** The request ID is the cross-layer join key for the permanent backend event and frontend sink event. Falling back to a local ID is reasonable only when no response ID exists; always using it when the response supplies the canonical ID breaks the stated contract.
- **Smallest repair:** Read `response.headers.get(REQUEST_HEADER)` and use it for the emitted event, falling back to the local ID only when absent. Add a focused test asserting response-ID precedence and local-ID fallback.
- **Disposition:** `OPEN` — blocks GO.

### N1 — Claimed typed-event red mutation is not demonstrated by the focused test

- **Status:** `CONFIRMED` (evidence gap; production constructor validation itself is present)
- **Severity:** `N`
- **Evidence:** `apps/backend/catering-business-server/modules/foundation/src/test/java/com/catering/v2s/platform/foundation/diagnostic/RequestCompletionEventTest.java:8-18` covers only a valid construction and field projection. It has no `assertThrows`/illegal-value assertions for invalid owner/face/outcome/error code, status range, or negative metrics, despite `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/diagnostic/RequestCompletionEvent.java` enforcing those constraints and the S2 red-mutation list claiming illegal-value coverage.
- **Why it applies:** Removing the constructor validation while retaining the valid constructor path would leave this focused test green. The source is typed/validated, but the package-exit proof cannot claim the required real red mutation from this test alone.
- **Smallest repair:** Add focused invalid-value assertions (at minimum owner/face/outcome, status, and negative metric) and record the resulting red mutation receipt.
- **Disposition:** `OPEN` as an evidence closure defect; does not by itself establish a runtime defect.

## Positive evidence / non-findings

- `RequestCompletionEvent` is a typed record with constructor validation and nonnegative metric/status bounds.
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/RequestCompletionDiagnosticInterceptor.java` registers against the generated edge registry, emits at most one completion event, preserves the managed diagnostic/seed skip boundary, and returns response `X-Request-Id`/`X-Correlation-Id`.
- `ManagedInvitationBootstrap` emits only structured success/failure fields. Its failure log contains type and a boolean message-presence indicator, not the exception object or raw exception message; no bootstrap raw-exception log finding is raised.
- Both app roots provide app-owned `AdminErrorBoundary.onError` callbacks, and the foundation logger sink is nonfatal on transport failure.

## Verdict

```text
VERDICT=NO-GO
M=0 (S1 may be promoted to M by product threat-model decision)
S=3
N=1
OPEN_FINDINGS=S1,S2,S3,N1
ROUND_FINAL_DECISION=NOT_APPLICABLE (round 1)
```

The next bounded action is to repair S1–S3 and add the missing red-mutation assertions, then perform the mandated independent Round 2 (same review cycle, final round) against fresh source and evidence. No product/Journey change is required to resolve these implementation defects.

## Round 2 — final independent verification

```text
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-S2-OBSERVABILITY-20260805
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=VALID (owning source and focused tests re-read before this section)
ROUND_FINAL_DECISION=SELF_DECIDED
```

### Re-opened source and focused proof

- `observedBaseQuery.ts:12-16` now replaces the opaque segment of the exact generated public invitation route with `:invitation-token`; `:63-76` gives response `X-Request-Id` precedence and retains the local ID only as fallback. The generated public client uses the matching `/api/public/invitations/{groupWorkspaceKey}/{invitationToken}` shape. `observedBaseQuery.test.ts:38-55` asserts both token absence and response-ID precedence. **S1 and S3 are closed at source and focused-test level.**
- `EdgeRequestContextArgumentResolver.java:34-40` now reads `RequestCompletionDiagnosticState.find(servlet)` and uses its canonical correlation when present. `RequestCompletionDiagnosticState.java:28-41` creates the canonical state before controller argument resolution; `ContractProblemAdvice.java:244-252` already uses that same state for the servlet overload. The raw managed-header bypass is closed by `RequestCompletionDiagnosticInterceptor.java:58-62`, which accepts only the validated metrics request attribute, not caller headers. **The implementation defect from S2 is repaired.**
- `RequestCompletionDiagnosticState.completeOnce()` now snapshots the existing tracker (`:56-71`) without opening a nested collector; the managed metrics interceptor owns the scope (`HttpRequestMetricsInterceptor.java:64-67`) and the focused tracker tests pass. **The tracker regression is closed.**
- `RequestCompletionEventTest.java:21-34` now has illegal face/outcome/status/negative-metric assertions; the fresh foundation focused run passed (`BUILD SUCCESSFUL`). **N1 is closed.**
- Fresh frontend focused run: `yarn --cwd libraries/frontend/admin-ui-foundation test --run` → 3 files, 17 tests passed. Fresh foundation focused Java run (event, tracker, recorder) → `BUILD SUCCESSFUL`. No DEV/UAT/HTTP/L2/seed/reset/Git operation was performed.

### Remaining final-round findings

#### N2 — Canonical `EdgeRequestContext` correlation repair lacks the required absent/invalid-header focused test

- **Status:** `CONFIRMED` (evidence gap; source repair itself is correct)
- **Evidence:** The only completion test correlation assertions remain in `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/diagnostic/RequestCompletionDiagnosticInterceptorTest.java:26-76`; they use valid caller correlation values and the `HttpServletRequest` Problem overload. A fresh source/test search finds no test that invokes `EdgeRequestContextArgumentResolver` (or an equivalent mapped controller path) with an absent or invalid `X-Correlation-Id` and then asserts equality between the Problem body and completion event/response correlation. The S2 design's red-mutation requirement (line 45) and Round 1 S2 repair acceptance explicitly require that boundary case.
- **Applicability:** The repaired resolver is used for all `EdgeRequestContext` controller methods; valid incoming headers mask the old bug, so only the default/invalid-header paths expose it. Static source reading proves the intended value flow but cannot prove the controller-adapter path without the focused test.
- **Disposition:** `OPEN` evidence closure; blocks a final GO.

#### N3 — Focused static proof receipt is stale after the Round 2 test addition

- **Status:** `CONFIRMED`
- **Evidence:** `doc/evidence/platform/2026-08-05-v2s-whole-engineering-s2-focused-static-proof.json:13` records `yarn --cwd libraries/frontend/admin-ui-foundation test` as “16 tests pass”, while the exact governed test command on the current source produced 17 passing tests (3 files). The package exit's hook path equality is now 32/32, but this proof line is not a truthful current receipt.
- **Applicability:** This is a package-evidence correctness issue, not a production behavior failure; nevertheless the S2 package cannot claim a final static proof while its recorded count disagrees with the owning command output.
- **Disposition:** `OPEN` evidence closure; blocks a final GO until the receipt is refreshed. The package exit still reports `reviewClosure=PENDING_INDEPENDENT_REVIEW_ROUND1` at `doc/evidence/platform/2026-08-05-v2s-whole-engineering-s2-package-exit.json:8`, which must also be advanced by the package owner after this final verdict.

### Final Round 2 verdict

```text
VERDICT=NO-GO
M=0
S=0
N=2
OPEN_FINDINGS=N2,N3
S1=CONFIRMED_CLOSED
S2=SOURCE_REPAIRED_BUT_FOCUSED_EVIDENCE_OPEN
S3=CONFIRMED_CLOSED
N1=CONFIRMED_CLOSED
ROUND_FINAL_DECISION=SELF_DECIDED
```

This is the hard stop for `REVIEW_CYCLE_ID=WHOLE-ENGINEERING-S2-OBSERVABILITY-20260805`; no third adversarial round is requested. The bounded owner follow-up is to add the absent/invalid `EdgeRequestContext` correlation assertion and refresh the focused-proof count/closure metadata, without changing runtime authority or starting any dynamic environment.
