# TER Remote Control ACTIVE Report Preflight Intake

## Scope

This intake covers the fresh read-only `TEST_CHAIN_PREFLIGHT` R1 findings for the current Web `remote.main` status-report path. It is a main-agent disposition, not an independent verdict. The source-only reviewer did not run tests or dynamic validation.

## Findings

### S-1 — ACTIVE report logs were dropped before reaching the Web run log

**Disposition: CONFIRMED.**

The remote-control actor and terminal-data-client emitted report-dispatch and HTTP-boundary events, but `tools/terminal-automation/src/browserNetworkDiagnostics.ts` accepted Runtime events only when their event name was present in `terminalRuntimeEvents`. The new report events were absent, so the Web runner projection could discard the evidence needed to locate the status-report boundary.

**Minimal repair:** add the nine report dispatch/HTTP events to the existing event allowlist and exercise them through `projectTerminalRuntimeRemoteControlLog`. The projector continues to use the existing module/category and field allowlists; the test includes secret, authorization, response-body, and exception-message sentinels and asserts they are absent from projected output.

**Focused evidence:** `test/browserNetworkDiagnostics.test.ts` passes 17 tests. No dynamic run has been made against the repaired bytes.

### S-2 — ACTIVE status-report failure was mislabeled as TDP disconnection

**Disposition: CONFIRMED.**

`maybeActivate()` and the lease-renewal event handler converted any thrown ACTIVE report into `TDP_DISCONNECTED`. The report crosses the TDC/CBS HTTP status-report path; a dispatch or HTTP failure alone does not establish that the TDP WebSocket disconnected. The actual connection-state fence continues to use `TDP_DISCONNECTED` when the TDP connection is observed disconnected.

**Minimal repair:** an ACTIVE report failure before the session reaches `active` ends startup with the existing `START_FAILED` reason. A failed ACTIVE renewal ends the session with the existing `LEASE_EXPIRED` reason, failing closed under the existing lease rule without adding a new protocol reason or recovery path. The event and TDC HTTP logs preserve the report failure boundary.

**Focused evidence:** `test/remoteControlActor.test.ts` passes 21 tests, including initial ACTIVE dispatch failure and active lease-renewal dispatch failure. `@catering-v2s/kernel-base-remote-control` typecheck passes.

## Current Verification Boundary

- Current-byte focused Vitest: remote-control actor 21/21; Web diagnostic projection 17/17.
- Current-byte remote-control package typecheck: PASS.
- `@catering-v2s/terminal-automation` workspace typecheck was attempted and failed on unrelated existing TS configuration/type errors in `apps/terminal/ui/base/primitives` JSX inclusion and `journeys/geometry.android.test.ts` / `journeys/update.android.test.ts` timer types; it reported no error in the edited diagnostic projector or its focused test.
- Current-byte Web/LiveKit dynamic run: NOT_RUN pending fresh R2 review and managed resource preflight.
- The earlier run `90a87696-f12d-4964-ab4f-b04162acc2aa` remains the first failure on older bytes: business FAIL, runner cleanup PASS. It must not be reported as a result of the repair.
- Fresh R2 `TEST_CHAIN_PREFLIGHT`: pending.
