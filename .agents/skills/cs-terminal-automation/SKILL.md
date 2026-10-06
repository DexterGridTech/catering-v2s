---
name: cs-terminal-automation
description: Use the TER automation-agent driver to implement and verify a managed terminal journey on Expo Web or Android.
---

# TER automation-agent

## Before a run

Read the current `AGENTS.md`, `doc/platform/terminal-coding-standard.md`, the approved Journey and the applicable implementation plan. Use this skill only with an already-authorized scenario and the managed runner. Do not use `adb`, Expo, or the driver as an unmanaged substitute for the runner. Do not reset or seed.

The managed runner verifies the active DEV manifest and owns the driver, app/test process tree, logs, resource heartbeat and cleanup:

```sh
node ./scripts/test/terminal-automation.mjs --phase journey --platform web --shape mobile --sample console --case normal --age empty
node ./scripts/test/terminal-automation.mjs --phase journey --platform android --shape mobile --sample console --case normal --age empty --device-serial <explicit-adb-serial-matched-to-assigned-vm>
```

For the wallpaper main journey, use `--sample wallpaper` and omit `--case` and `--age`. The runner provisions the run identity and reads the managed DEV URLs and credentials from its validated manifest. Do not put passwords, activation codes, session tokens, or raw fixture payloads in command arguments, manifests, or logs. Android requires the exact device serial; never select a device by list order. Both commands are examples for an authorized run, not authorization by themselves.

The app connects to the driver through the build-only `EXPO_PUBLIC_TER_AUTOMATION_URL` and `EXPO_PUBLIC_TER_AUTOMATION_TOKEN` inputs. Web receives them from the managed runner. Android uses `EXPO_PUBLIC_TER_AUTOMATION_BUILD=true` with run-scoped build inputs. Product package configuration keeps automation disabled by default. Do not add runtime toggles or read secrets from application business state.

## Public driver shape

The package is `@catering-v2s/terminal-automation`, exported from `tools/terminal-automation/src/index.ts`. Create a driver with `createTerminalAutomationDriver({token, host, port, fixtureFactory?})`, wait using `driver.waitForSession(...)`, use `driver.transport` for protocol requests/events, and always `await driver.close()` in `finally`. A managed journey should normally reuse the existing Web/Android setup in `tools/terminal-automation/journeys/sampleConsole.test.ts` and `sampleConsole.android.test.ts` rather than creating another process lifecycle.

Selector helpers accept the owning driver server and session identity:

```ts
const initial = await readSelector(server, sessionId, selectorName, argsTuple);
const current = await waitForSelector(server, sessionId, selectorName, argsTuple, predicate, timeoutMs);
const observation = await subscribeSelector(server, sessionId, selectorName, argsTuple);
try {
  assertBusinessValue(observation.current);
  const next = await observation.waitFor(predicate, 15_000);
  assertBusinessValue(next);
} finally {
  await observation.close();
}
```

Selector names must be registered public selectors, and arguments are passed as the selector's positional argument tuple. The subscription immediately exposes `current`, then `waitFor` observes later JSON values. Do not read full Runtime state, access slices by key, or treat a subscription as proof of a business mutation without checking its value.

For exact low-level control inspection, send `controls.query` with `{filter: {testID, surface, displayIndex}}`; require exactly one matching node. Send `controls.bounds` with `{nodeInstanceId, layoutRevision}` from that query. A missing or ambiguous node is a test failure; do not choose the first match or reuse bounds after layout changes. Prefer the shared UI ports below for actual actions.

## Real UI actions and command tracking

`createWebJourneyUiPort` and `createAndroidJourneyUiPort` implement the same journey port. They use registered-node lookup, correct surface/display mapping, input focus, virtual-keyboard readiness and physical/Web input. `createVirtualKeyboardInput` supplies `enterText`, `enterTextAndComplete`, `enterFormValues` and `completeInputSteps`; journeys provide only the business field identifiers and values.

Correlate a real button click to its Runtime command with `clickObservedJourneyCommand(port, {commandName, testID, display})`. It observes `selectRequestExecutionViews` before clicking, finds the unique new matching request, then follows that exact request outcome. Assert the resulting business selector as well; request completion alone is not a business result. For a custom action use `dispatchObservedJourneyCommand` with an `action` callback, or `requests.observeUiAction` with `{server, sessionId, workspace, displayMode, commandName, action}`. Do not dispatch a second business command to make the observation easier.

Use `mainSampleTestIds` or the owning package's exported `*TestIds` constants. A **UI automation locator (`TestId`)** is created only by `createTestId(module, part, {element?, key?})` from `@catering-v2s/ui-base-primitives` and remains strongly typed. Keep the identifier stable and free of personal data; do not hand-write strings, concatenate suffixes, cast with `as TestId`, or include a surface in the identifier. Surface and display index belong in the query/action input. Only controls used for automated interaction or an explicit geometry/visibility assertion need a test identifier; decorative primitives do not.

## Writing and running a journey

Keep each journey about its business fixture and expected result. Reuse `loginSampleStaff`, `runSampleConsoleJourney` or `runSampleWallpaperJourney`, `mainSampleTestIds`, `createWebJourneyUiPort`/`createAndroidJourneyUiPort`, selector helpers and `clickObservedJourneyCommand`. The existing complete flow is `tools/terminal-automation/journeys/sampleConsoleJourney.ts`; its Web and Android managed harnesses are `sampleConsole.test.ts` and `sampleConsole.android.test.ts`. It demonstrates a real login, registered-node input/click, exact request tracking, and business selector readback without duplicating device lifecycle in the journey. The wallpaper counterpart is `sampleWallpaperJourney.ts`.

Use `terminalAutomationMemberFixture(runId)` from `tools/terminal-automation/fixtures/member.ts` for the sample member; the managed harness supplies the run identity and shared fixture. A new journey should add only its own business fixture setup and oracle, then use the same platform-neutral port. Do not duplicate runner startup, activation, authentication, keyboard timing, Android tap geometry or cleanup in a journey.

The skill proof entry is intentionally a one-line import of the existing managed journey. The complete file contents are:

`tools/terminal-automation/journeys/skill.test.ts`:

```ts
// R-18 intentionally reuses the exact managed main journey and its assertions.
import './sampleConsole.test.ts';
```

`tools/terminal-automation/journeys/skill.android.test.ts`:

```ts
// R-18 intentionally reuses the exact managed Android main journey and its assertions.
import './sampleConsole.android.test.ts';
```

This exercises the actual selector subscription, command tracking, real input/click and business oracle without a duplicate journey. Preserve these file bytes when recreating either entry; do not write a second implementation. For Android, use `adb devices -l` only to inspect the connected-device inventory, match the serial to the explicitly assigned VM identity for this run, and pass that exact serial as `--device-serial`. Never choose by row order; if the assigned VM cannot be identified uniquely, do not start the run.

The skill proof runs the same `console`, `mobile`, `normal`, `age=empty` journey on Web and Android. Its ordered business flow and assertions are:

1. The managed harness connects the app session and ensures the assigned seed terminal is active for this run; it does not reset or seed data.
2. On `PRIMARY`, enter staff `A001` and passcode `1111`, click the registered login control, observe Runtime command `kernel.feature.sample-staff-session.login`, and assert `kernel.feature.sample-staff-session.selectHostStaffQualification` is authenticated for `A001`; wait for `sample.desk.member-list`.
3. Read `kernel.feature.sample-member-registry.selectMembers` and `selectPendingMember`; require an empty member list and no pending member.
4. Click the empty-list action and observe `ui.feature.sample-member-desk.member-form-opened`; wait for `sample.desk.member-form`. Enter the run-scoped fixture name and phone through the shared registered-input helper, then complete the form's registered input steps.
5. Click submit and observe `kernel.feature.sample-member-registry.submit-member`; wait for `sample.desk.customer-member`; assert `selectPendingMember` has the fixture name/phone and a non-empty operation ID.
6. With `case=normal` and `age=empty`, do not enter age and do not take reject, retry, abandon, or withdraw branches. Click confirm and observe `kernel.feature.sample-member-registry.confirm-member`.
7. Require `selectMembers` to contain exactly one matching name/phone with no age field, require `selectPendingMember` to be cleared, and wait for `sample.desk.member-list`.
8. Then prove CBS-to-store-basic propagation: subscribe to `kernel.feature.store-basic.selectStore` and `selectStoreBasicTopicState('STORE')`; update only the seed store notes through the existing CBS operations fixture with a run-scoped marker; require the selector to show that marker and the returned revision/time, require `STORE` topic state `loaded`, and read CBS back to match. Restore the original notes, verify the restored selector/readback, and close both subscriptions.
9. Every real UI click is paired with the exact new Runtime request: observe `kernel.base.runtime.selectRequestExecutionViews`, subscribe to that request's `selectRequestExecutionView(requestId)`, and require the matching root command to complete without errors. Selector request completion alone does not replace the member/CBS business assertions.

Run the skill proof for the console main journey exactly as follows:

```sh
node ./scripts/test/terminal-automation.mjs --phase skill --platform web --shape mobile --sample console --case normal --age empty
node ./scripts/test/terminal-automation.mjs --phase skill --platform android --shape mobile --sample console --case normal --age empty --device-serial <explicit-adb-serial-matched-to-assigned-vm>
```

`skill` is the R-18 alias for the console main journey only; it receives the same verified managed DEV/TDS context and run identity as `journey`. `journey` also supports the wallpaper main journey with `--sample wallpaper` and no `--case` or `--age`. The managed runner records a manifest and log, asserts run/resource identity and reports business separately from cleanup.

Keep behavior platform-neutral and run the same approved scenario first in Expo Web, then Android through the managed runner. Report Web and Android independently. A test passes only when the intended visible state, exact command outcome and business selector/readback all agree. Do not use fixed sleeps; use selectors, events and bounded waits. Keep assertions and fixture ownership in the journey, not in driver lifecycle helpers.

## Runtime registration and test identifier gates

Public selectors are registered in the package's Runtime selector definition and exposed through the owning module; the skeleton static gate compares public selector definitions with the automation-agent registry. A missing selector must make `tools/terminal-skeleton/check-static.mjs` fail at `SELECTOR_REGISTRATION`.

The testID type gate checks each production TSX `testID`/`testId` expression against the canonical `TestId` type. It rejects literal strings, arbitrary strings and casts outside the constructor. The focused red examples live in `tools/terminal-skeleton/check-static.test.mjs`; run that test when changing the type gate or constructor. Do not add test identifiers to decorative controls just to increase a count.

## Reactive waits and cleanup

Runtime selector subscriptions, request observation and driver event waits use RxJS inside the driver. Public journey helpers return promises and JSON values; do not export Observable from app-facing APIs. Subscribe before triggering an action, use a bounded timeout, match exact identity, and always unsubscribe in `finally`. Preserve the first failure; do not retry by changing the scenario or extending the timeout. Runner cleanup must be reported separately from business outcome and must be `PASS` before closing the run.

## Diagnosis

- **No session:** inspect the current run log and manifest first; verify exact WebSocket URL, build-time setting, app/session identity and managed reverse mapping. Never print the token.
- **Authentication rejected:** compare presence and run ownership of the token without logging its value; the driver rejects a wrong token.
- **Node missing/ambiguous:** query the exact surface and display index, confirm the owning `*TestIds` constant is mounted once, then re-query after layout changes.
- **Bounds or tap offset:** inspect registered bounds, surface layout revision, display mapping and device window metrics. Do not multiply coordinates again as an unverified correction.
- **Selector did not change:** inspect its initial value, public registration and the command request/result. A request may complete without the expected business mutation.
- **Old session or late result:** match the run/session/request identity. Do not replay the command; reconnect creates a new session and old subscriptions are released.
- **Cleanup failure:** preserve the manifest and first failure, inspect owned process identity and resource readback, and use only the managed cleanup path.

Never write credentials, activation secrets, passcodes, raw member data, session tokens, cookies, authorization headers, raw IPs or raw payloads to logs or manifests. Keep only the minimum run identity needed to reproduce and diagnose the result.
