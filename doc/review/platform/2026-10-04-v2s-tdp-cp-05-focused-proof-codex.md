# TDP CP-05 focused proof

```text
TASK=TDP data-change and remote-operations
CP=CP-05
PROOF_KIND=FOCUSED_CURRENT_BYTES
```

## Scope

CP-05 adds one registered `kernel/feature/store-basic` consumer for all eleven topic identities, keeps business bodies in its owner slice, calls the generated terminal reads through TDC public commands, and projects only MASTER-owned state. This proof covers package graph/type/test/static shape and actor-focused initialization, read-failure, collection-delta, and late-detail behavior. It does not claim CBS→TDS→TDC real delivery, backend-acceptance, DEV, Expo Web, adapter, or whole-batch 6b; those remain NOT_RUN for the batch-level acceptance phase.

## Current-byte command evidence

- `yarn workspace @catering-v2s/kernel-feature-store-basic typecheck && yarn workspace @catering-v2s/kernel-feature-store-basic lint && yarn workspace @catering-v2s/kernel-feature-store-basic test` — PASS on current bytes; 13 tests, 1 file; typecheck and lint exited zero. The package runner deletes its temporary JSON report after exit, so the actual terminal transcript is retained below rather than citing a now-missing temporary path.
- `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck && yarn workspace @catering-v2s/kernel-base-terminal-data-client lint && yarn workspace @catering-v2s/kernel-base-terminal-data-client test` — PASS; 41 tests, 8 files.
- `yarn workspace @catering-v2s/ui-integration-sample-console typecheck && yarn workspace @catering-v2s/ui-integration-sample-console lint && yarn workspace @catering-v2s/ui-integration-sample-console test` — initial test exposed an expectation missing the declared direct `kernel.base.state` dependency; after correcting the package-surface assertion, `yarn workspace @catering-v2s/ui-integration-sample-console test` — PASS; 66 tests. The preceding typecheck/lint in that run exited zero.
- `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck && yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console lint && yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test` — PASS; 35 tests.
- `node tools/terminal-ui-state/check-static.test.mjs` — PASS, including model red/restore cases.
- `yarn workspace @catering-v2s/terminal verify:static` — prior run `ter-local-static-88723-1791119225814`, exit zero, `TERMINAL_STATIC=PASS` before the latest child-result handling change. It is not evidence for the newest CP-05 bytes and must be refreshed at the batch's applicable static gate. Includes format check (1017 files), readability, skeleton model+real static, contracts, platform-ports, state, runtime, display-context, ui-state, render and layering checks. Intentional red fixtures print failures and verify restoration; the enclosing model/static verify passes.

## Focused observations

- Initial activation path reads the store snapshot, persists store state before dispatching `initializeStoreServicePoints`, then reads the service-point partitions and the remaining independent topic sources. The test asserts the persistence event precedes the service-point command.
- A store read rejection issues no service-point collection requests or subscriptions.
- A service-point partition rejection leaves the successfully read store and service-area facts available; it does not roll back the store read.
- A `topic-changed` command addressed to another subscriber returns before any generated read, local slice mutation, topic subscription change, or notification acceptance.
- A newly constructed module installing over an already persisted store-basic slice still dispatches the initial load for the current binding and re-reads the store and service-point snapshots; it does not treat persisted success as this runtime's load proof.
- A duplicate initialization after successful current-binding load does not repeat store reads. If the service-point partition failed, the store read remains complete while the incomplete service-point load can be attempted again without refetching the store; the focused proof confirms the retry reads current service points and reaches the loaded selector state.
- Contract range transition `{A,B} → {A,C}` retains A, removes B's detail subscription, subscribes C, and uses the complete C item returned in the collection response without issuing an extra detail GET.
- A late successful detail payload for B after B was removed does not reinsert B into the current range.
- Two same-topic notifications are held in a deterministic overlap: the newer read succeeds first, the older read then fails; the older handler returns `stale-result`, leaves the newer body/error state intact, and does not acknowledge the old notification.
- TDC subscribe/unsubscribe/accept are child business outcomes nested inside Runtime's aggregate `CommandDispatchResult`. `store-basic` now checks the child status: only `unsubscribed`/`not-subscribed` count as unsubscribe success, and only `accepted`/`accepted-locally` count as acceptance success. Aggregate `completed` with child `failed` leaves a selector-visible topic failure; an accept result of `failed` or `rejected` returns `accept-failed` instead of `refreshed`. A deterministic stale check after the awaited accept prevents a superseded notification's failure from replacing newer state.
- The removal-delta proof injects aggregate `completed` with child `{status:'failed'}` for B's unsubscribe and verifies `{A,C}` data remains correct while `failures.CONTRACT` exposes `TOPIC_UNSUBSCRIBE_FAILED`; two acceptance cases inject child `failed` and `rejected` results and verify `failures.STORE=TOPIC_ACCEPT_FAILED` and no false `refreshed` outcome.
- Successful topic load clears that topic's prior visible failure in the same reducer transition to `loaded`.
- The integration packages declare and register `store-basic`; sample-console's exact package-surface assertion now includes its direct `kernel.base.state` dependency.

## CP-05 review intake

- `CONFIRMED`: the Runtime fan-out includes notifications for multiple feature subscribers, while the `store-basic` handler previously checked terminal/binding identity but did not check `subscriberKey`. The handler now returns `other-subscriber` before dispatching its refresh command unless `subscriberKey === moduleName`; the focused test proves no read or slice change.
- `CONFIRMED`: the explicit CP-05 restart/repeated-init proof was missing. `createStoreBasicModule.install` already dispatches initialization for every new runtime, but the proof did not establish this against a restored slice. The focused test now installs over a persisted prior slice and observes fresh store/service-point reads; another test proves duplicate init is idempotent and incomplete service-point loads remain retryable.
- `CONFIRMED`: an older topic request could call the generic failure writer after a newer notification had become current, because stale and failed reads shared one branch. Every read branch now checks `isLatest()` first and returns `stale-result` without writing selector-visible failure; current failed reads alone write a topic failure. A deterministic overlap test proves the older request cannot replace the newer success or be acknowledged.
- The old `completedServicePointLoads` set had also represented both completed store loads and completed service-point loads. These are now separate actor-local facts so a service-point read failure cannot incorrectly mark that phase complete. Successful `setLoaded` clears a prior topic error in the slice reducer's `loaded` transition, without introducing another out-of-handler actor dispatch; a successful retry therefore removes stale failure state and remains within the TR-01 handler boundary.
- The first focused run failed because the assertion compared newly assembled `StateRoot` wrappers by object identity. The owning behavior had not failed. The test now compares the persisted feature slice identity, which is the state object under test. The preserved failed report is the Vitest JSON at `/var/folders/1v/twwzy2r94y76bp582x48cy0c0000gn/T/ter-vitest--catering-v2s-kernel-feature-store-basic-seLs8O/results.json`.
- `CONFIRMED`: the first CP-05 implementation only inspected aggregate command status for TDC unsubscribe and notification accept. Runtime can report aggregate `completed` while a completed actor's business result is `failed` or `rejected`; TDC uses that shape for persistence/send failures and stale notification rejection. This generic boundary applies to all three store-basic TDC subscription commands: subscribe was already parsing child status; unsubscribe and accept now do too. The smallest remedy is to validate each command's finite successful child statuses and preserve the existing topic failure selector, with no new result framework or retry queue.
- `CONFIRMED`: topic-level unsubscribe failure remains visible independently of successful acceptance of the parent collection notification; detail-level failure is not immediately cleared by a generic `setLoaded` transition. Tests exercise the command path, not a direct slice mutation. No claim is made that the missing TDC subscription is repaired automatically; normal initialization/retry behavior remains the bounded existing recovery path.
- Current focused run transcript (the chained command exited zero):

  ```text
  TERMINAL_PACKAGE_LINT=PASS {"packageName":"@catering-v2s/kernel-feature-store-basic","packagePath":"apps/terminal/kernel/feature/store-basic","expectedFiles":9,"actualFiles":9,"errors":0,"warnings":0,"elapsedMs":1223}
  TERMINAL_PACKAGE_TEST_MODE_START package=@catering-v2s/kernel-feature-store-basic mode=PROD
  JSON report written to /var/folders/1v/twwzy2r94y76bp582x48cy0c0000gn/T/ter-vitest--catering-v2s-kernel-feature-store-basic-6Pyesh/results.json
  VITEST_RUN_END reason=passed unhandled=0
  TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/kernel-feature-store-basic mode=PROD files=1 tests=13 allowedDevSkips=0
  TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-feature-store-basic
  ```

  The runner removed that temporary JSON after process exit. The command's captured stdout above is the retained current-byte test evidence; no JSON artifact path is claimed to remain readable.

## Evidence boundary

This file records local focused proof only. No managed backend-acceptance/DEV or TER Expo Web run is represented here. CP-05 still requires fresh independent whole-CP reconciliation after this result-validation change. Full batch 6b and final review are separate required stages.

## DEV runner lifecycle delta (2026-10-05)

- First failure retained: run `r5-dev-1791126903674-66995-f72cf4d5-2236-40a5-9211-d8bdbc6b7c33` stopped at `REMOTE_TDS_CONTROL` with PostgreSQL `schema platform_workspace does not exist`; it did not reach DEV readiness. Source tracing found `startRemoteTds` provisioned schema grants before business Flyway readiness, and the runner counted this preflight failure as an attempted TDS process even though no TDS control file/process had been created.
- Root-cause repair: `scripts/dev/r5-dev-runner.mjs` now waits for the existing business Spring readiness marker (which is emitted after Flyway) before granting the TDS role; principal provisioning is separated from the process-launch helper and is completed before the runner records TDS process ownership. Failed-start cleanup now scans exact run-root process arguments and CWD (including ` (deleted)` CWDs) plus run-labelled containers even when the remote root is already absent; it refuses cleanup if any process, container, or unreadable process remains.
- Focused proof: `node --test scripts/dev/r5-dev-command-wrapper.test.mjs` — PASS, 20/20; covers readiness → grants → launch order, avoids charging preflight as process launch, checks the generated cleanup script syntax, and ensures absent roots do not bypass resource inspection. `node --check` passes for the runner and test source.
- Recovery evidence: after the runner repair, `scripts/dev/cleanup-failed-start r5-dev-1791126903674-66995-f72cf4d5-2236-40a5-9211-d8bdbc6b7c33` recorded `R5_DEV_FAILED_START_CLEANUP=PASS`; appended recovery readback has zero active run-root processes, zero containers and zero uninspectable processes. The original `firstFailure` and original cleanup FAIL remain intact; only the appended cleanup recovery is PASS.
- Boundary: this was cleanup of the failed start only. It is not a successful DEV start, DEV readiness, Expo Web run, or current-batch full dynamic PASS. No database reset or seed was run.
