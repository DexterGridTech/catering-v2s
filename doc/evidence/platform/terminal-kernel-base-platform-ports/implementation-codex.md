# TER `kernel.base.platform-ports` implementation evidence

```text
REVIEW_TARGET=IMPLEMENTATION
PACKAGE=@catering-v2s/kernel-base-platform-ports
IMPLEMENTATION_AGENT=Codex
DATE=2026-08-30
VERDICT=READY_FOR_DEXTER_AND_CLAUDE_REVIEW
SCOPE=platform-ports package, package-local tests, platform-ports static gates, TER-local verifier wiring
NOT_IN_SCOPE=adapter/native implementation; other 21 package production code; warehouse normal scripts/verify; device; DEV; seed; reset; browser L2; UAT; deployment
```

## 1. Design-review finding closure

1. `resetRuntime` accepted correlation: `HotUpdateMarkerInput` and `HotUpdateMarker` expose optional `resetRequestId`, so successor-runtime marker reads can carry the accepted request correlation.
2. surface identity naming: appControl input uses `containerKey`; no `surfaceKey` remains in platform-ports source or tests.
3. unavailable capability spelling: default tests assert every unavailable method returns `port`, `capability`, `reason`, and `message`; `capability` equals the method name.
4. actual port count: the package builds 10 ports. `localWebServer`, `display`, and `automation` are excluded from the public surface and pinned by type-level negative fixtures plus exact-export support.
5. stop-condition drift: the implementation plan now keeps the shared stop list in design and limits plan-specific additions to execution checks.

## 2. Implemented surface

- Public package export count from TypeScript checker: `124`.
- Forbidden public symbols detected: `0` for `localWebServer`, `display`, `automation`, and `emit`.
- `PlatformPorts` and `PlatformPortBindings` keys are exactly:
  `logger`, `persistKv`, `persistSecure`, `device`, `appControl`, `script`, `connector`, `hotUpdate`, `logUpload`, `topologyHost`.
- Port method sets are exact and required for `LoggerPort`, `StateStoragePort`, `DevicePort`, `AppControlPort`, `ScriptPort`, `ConnectorPort`, `HotUpdatePort`, `LogUploadPort`, and `TopologyHostPort`.
- Production dependency surface remains only `@catering-v2s/kernel-base-contracts`.

## 3. Package tests and type fixtures

Fresh commands:

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports typecheck --pretty false
EXIT=0
```

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports test
EXIT=0
RESULT=4 files / 16 tests passed
MARKER=TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports
```

Coverage represented by tests:

- A group: 10-key assembly, root freeze, and environment mode not leaked onto the root object.
- D group: usable `logger` and process-memory KV, plus eight unavailable defaults and every method's typed unavailable result.
- S group: accepted versus succeeded versus timed-out success semantics.
- L group: full-environment sanitizer coverage for message, data, error, phone, token, cookie, authorization, login, account, raw IP, raw payload, derived fields, and public `emit` bypass absence.
- C/F group: public-surface type fixture compiles under package `tsconfig`, including consumer call/subscribe use, branded ID negatives, excluded port negatives, `LoggerPort.emit` negative, and exhaustive binding shape negatives.

Reverse controls already run for the package type fixture:

```text
BRAND_RED=PASS TS2322 RequestId is not assignable to CommandId
EMIT_RED=PASS TS2339 LoggerPort has no property emit
CP1_SCRATCH_CLEANUP=PASS
```

## 4. Static gates

Fresh commands:

```text
COMMAND=node tools/terminal-contracts/check-static.test.mjs
EXIT=0
MARKERS=CONTRACTS_MODEL_CLEANUP=PASS; TERMINAL_CONTRACTS_STATIC_MODEL_TEST=PASS
```

```text
COMMAND=node tools/terminal-contracts/check-static.mjs
EXIT=0
MARKER=TERMINAL_CONTRACTS_STATIC=PASS
```

```text
COMMAND=node tools/terminal-platform-ports/check-static.test.mjs
EXIT=0
MARKERS=PLATFORM_PORTS_MODEL_CLEANUP=PASS; TERMINAL_PLATFORM_PORTS_STATIC_MODEL_TEST=PASS
```

```text
COMMAND=node tools/terminal-platform-ports/check-static.mjs
EXIT=0
MARKERS=PLATFORM_PORT_RULE_GATES=4; PLATFORM_PORT_SUPPORT_CHECKS=1; TERMINAL_PLATFORM_PORTS_STATIC=PASS
```

The platform-ports static model test includes targeted red vectors for:

- TR-05 named boundary: exported `Record<string, unknown>`.
- required port shape: optional `ConnectorPort.on`.
- default import allowlist: external `redux` import from defaults and nested runtime dependency from defaults.
- platform identifier boundary: `react-native` import.
- public support: unexpected export while the four rule gates stay green.

## 5. TER-local verification

Fresh command:

```text
COMMAND=yarn workspace @catering-v2s/terminal verify:static
EXIT=0
MARKERS=TERMINAL_STATIC=PASS; TERMINAL_CONTRACTS_STATIC=PASS; TERMINAL_PLATFORM_PORTS_STATIC=PASS
```

Fresh command:

```text
COMMAND=node tools/terminal-skeleton/verify.test.mjs
EXIT=0
MARKER=TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
```

Fresh command:

```text
COMMAND=yarn workspace @catering-v2s/terminal verify
EXIT=0
RESULTS=TERMINAL_STATIC=PASS; TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22; TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=7; TERMINAL_TURBO_DRY_LINT=PASS executable=0; TERMINAL_TURBO_DRY_CLEAN=PASS executable=0; 22 typecheck tasks successful; 7 test tasks successful; TERMINAL_TEST_MARKERS=PASS real=2 noTests=5; android export 663 modules; TERMINAL_VERIFY_CLEANUP=PASS; TERMINAL_VERIFY=PASS
```

This is TER-local verification only. Warehouse-level normal `scripts/verify` was not run.

## 6. Remaining boundaries

- No adapter/native capability is implemented or proven by this package.
- No device run, DEV, seed, reset, browser L2, UAT, deployment, or EAS proof is claimed.
- Connector category semantics remain intentionally unfrozen beyond the typed request/result/subscription/message/error contract.
- Exit application and kiosk product ownership remain outside this package's implementation proof.

## 7. CP-4 fresh reconciliation and final commands

The fresh whole-scope reconciliation was performed before the final command set by an independent
subagent. It re-opened the requirements, implementation design/plan, routed TER memory and the
current tree rather than aggregating CP-1 through CP-3 summaries.

```text
WHOLE_SCOPE_RECONCILIATION=PASS
REVIEWER=/root/platform_ports_whole_reconcile
OPEN_COUNT=0
```

The only intermediate OPEN found during the final close was the missing type-level negative for
`PortAccepted.value`. It was fixed in `test/public-surface.typecheck.ts`; the reviewer rechecked it
and returned `RECONCILIATION=PASS / OPEN_COUNT=0`.

### 7.1 Pre-remediation command ledger (historical baseline)

| command | exit | elapsed (observed) | relevant output / cleanup |
|---|---:|---:|---|
| `yarn workspace @catering-v2s/kernel-base-platform-ports typecheck --pretty false` | 0 | ~0.57 s | `test/public-surface.typecheck.ts` is in the project; no diagnostics |
| `yarn workspace @catering-v2s/kernel-base-platform-ports test` | 0 | ~0.39 s | pre-remediation baseline: 4 files / 14 tests; `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS` |
| `node tools/terminal-contracts/check-static.test.mjs` | 0 | ~1.14 s | `CONTRACTS_MODEL_CLEANUP=PASS`; model PASS |
| `node tools/terminal-contracts/check-static.mjs` | 0 | ~0.22 s | 4 rule gates + support PASS; `TERMINAL_CONTRACTS_STATIC=PASS` |
| `node tools/terminal-platform-ports/check-static.test.mjs` | 0 | ~0.88 s | `PLATFORM_PORTS_MODEL_CLEANUP=PASS`; model PASS |
| `node tools/terminal-platform-ports/check-static.mjs` | 0 | ~0.23 s | 4 rule gates + support PASS; `TERMINAL_PLATFORM_PORTS_STATIC=PASS` |
| `yarn workspace @catering-v2s/terminal verify:static` | 0 | ~13.12 s | skeleton/contracts/platform gates and hygiene PASS; `TERMINAL_STATIC=PASS` |
| `yarn workspace @catering-v2s/terminal verify` | 0 | ~24.21 s | pre-remediation baseline: 22 typecheck, 7 test owners, 2 REAL + 5 NO_TEST_FILES, 663-module Android export; cleanup and `TERMINAL_VERIFY=PASS` |

The final `verify` export emitted the npm warning `Unknown user config "allow-scripts"`; it did not
change the exit status or marker. The verifier removed `.expo` and `dist`; an independent filesystem
check returned `TERMINAL_EXPORT_ARTIFACT_CLEANUP=PASS`. No warehouse-level `scripts/verify` was run.

### 7.2 Type fixture inclusion and reverse control

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports exec tsc --project tsconfig.json --listFilesOnly
FILTER=platform-ports/(src|test|vitest)
MATCHED_FILES=32
INCLUDES=test/public-surface.typecheck.ts=YES
```

The added S-1 negative fixture is in the accepted branch:

```ts
if (acceptedAction.status === 'accepted') {
  // @ts-expect-error Accepted actions carry correlation/observation, not a success payload.
  acceptedAction.value.completed;
}
```

Reverse control was run against the same source: removing that directive produced `exit=2` with
`TS2339: Property 'value' does not exist on type 'PortAccepted<"SUCCESSOR_RUNTIME_STARTED">'`;
restoring it returned typecheck to `exit=0`. The earlier brand and `LoggerPort.emit` reverse controls
also remain recorded as `BRAND_RED=PASS`, `EMIT_RED=PASS`, and `CP1_SCRATCH_CLEANUP=PASS`.

## 8. Port-by-port implementation ledger

The package has ten actual ports. The methods below are the exact method sets checked by
`required-port-shape` and the exact public `src/index.ts` support list; every listed method is
required (none optional).

| port | exact methods | default tier | platform shape declared in design |
|---|---|---|---|
| `logger` | `debug`, `info`, `warn`, `error`, `scope`, `withContext` | usable (`consoleLoggerBinding`) | all four platforms for all methods |
| `persistKv` | `read`, `write`, `remove`, `readMany`, `writeMany`, `removeMany`, `listKeys`, `clear` | usable (process-memory Map) | all four platforms |
| `persistSecure` | same eight storage methods | unavailable (`ADAPTER_NOT_INJECTED`) | Android/iOS/Windows; Linux may be `PLATFORM_UNSUPPORTED` |
| `device` | `getDeviceInfo`, `getSystemStatus`, `getPowerStatus`, `subscribePowerStatus`, `unsubscribePowerStatus` | unavailable | system status may be unsupported on iOS; power subscription/status may be unsupported on Windows/Linux |
| `appControl` | `resetRuntime`, `exitApplication`, `clearHostDataCache`, `setFullscreen`, `getFullscreen`, `setKioskMode`, `getKioskMode`, `showNativeLoading`, `hideNativeLoading` | unavailable | exit is unsupported on iOS; fullscreen/kiosk may be unsupported on iOS; other platform matrix entries are in design §7.2 |
| `script` | `execute`, `getStats`, `clearStats` | unavailable | all four platforms can provide an adapter; this package provides none |
| `connector` | `call`, `subscribe`, `unsubscribe`, `on` | unavailable | iOS/channel-specific capability may be unsupported; channel taxonomy remains unfrozen |
| `hotUpdate` | `downloadPackage`, `writeBootMarker`, `readBootMarker`, `readActiveMarker`, `readRollbackMarker`, `clearBootMarker`, `confirmLoadComplete` | unavailable | Android is the proven shape source; other platforms may be unsupported |
| `logUpload` | `uploadLogsForDate` | unavailable | all four platforms can provide an adapter; this package provides none |
| `topologyHost` | `start`, `stop`, `getStatus`, `getDiagnosticsSnapshot` | unavailable | iOS background survival may be unsupported; other matrix entries remain adapter work |

`localWebServer`, `display`, and `automation` have no public type, key, default, or export. The
`localWebServer` five-question test failed on independent lifecycle, distinct guarantee, real
consumer, and concrete non-open shape; only “can start a local service” was answerable, and that
capability is already represented by `topologyHost`'s HTTP/WS/local URL fields. `display` identity is
host-provided `containerKey` flowing through `display-context`; the kernel does not query hardware.

### 8.1 Result and success semantics

All async methods return `PortResult<T>` or, for `resetRuntime`/`exitApplication`,
`PortActionResult<T, observation>` with discriminants `succeeded`, `failed`, `timed-out`,
`unavailable`, and (for actions) `accepted`. The five success questions are represented as follows:

| question | implementation contract |
|---|---|
| completion point | `succeeded` is emitted only after the operation's described observable work; `accepted` means host takeover only |
| observable confirmation | success payloads carry the readback/marker/snapshot; action acceptance carries `requestId` and terminal observation |
| later async failure | subscriptions require `onError`; accepted reset/exit keep request correlation for host/supervisor reporting |
| accepted/pending and terminal source | only reset/exit allow `accepted`; terminal observations are `SUCCESSOR_RUNTIME_STARTED` and `PROCESS_TERMINATED`; `PortAccepted` intentionally has no `value` |
| timeout | `PortTimedOut.timeoutMs` preserves the call budget and is never rewritten as failed/unavailable |

`HotUpdateMarkerInput` and `HotUpdateMarker` both carry optional `resetRequestId` so a successor
runtime can correlate a reset acceptance; the field is in the exact export list and type fixture.
The runtime marker/lifecycle implementation itself is not implemented in this package.

### 8.2 Five-finding closure locations

1. **S-1 reset correlation:** `src/types/hotUpdate.ts:21-48` adds `resetRequestId?: RequestId` to
   input and marker; the public fixture constructs both. The accepted payload remains value-free.
2. **S-2 surface identity:** `src/types/appControl.ts:7-9,19-24` uses `containerKey`; no
   `surfaceKey` appears in package source/tests.
3. **N-1 capability spelling:** all unavailable defaults build `capability` from the exact method
   string; `test/defaultPorts.test.ts:93-167` checks every method of every unavailable port.
4. **N-2 ten-port close:** `PlatformPortName`, `PlatformPortBindings`, `PlatformPorts`, the
   expected checker list, and `src/index.ts` all contain the same ten keys.
5. **N-3 stop-list source:** the plan §5 now points at design §13; implementation did not create a
   second mutable stop list.

## 9. Test-case and gate accounting

| group | concrete owner and coverage | result |
|---|---|---|
| A | `test/platformPorts.test.ts:17-65`: all ten keys, injected identity preservation, frozen root, strict assignment failure, no leaked environment mode | PASS |
| D | `test/defaultPorts.test.ts:34-185`: logger writes all four levels in all environments and Map is usable; persistSecure(8), device(5), appControl(9), script(3), connector(4), hotUpdate(7), logUpload(1), topologyHost(4) each checked method-by-method | PASS |
| S | `test/successSemantics.test.ts:13-85`: accepted reset pending until fake successor signal; succeeded fullscreen only after flag change; timed-out result produced by an over-budget fake and preserves input budget | PASS |
| L | `test/logger.test.ts:52-158`: message/data/error/name/code, phone/hash/password/OTP/token/cookie/Authorization/login/account/IP/payload, DEV/TEST/PROD, all four levels, derived context, safe diagnostic values and unknown context-field dropping; ordinary values remain; sink failure is typed | PASS |
| C/F | `test/public-surface.typecheck.ts`: actual call/subscribe consumption, result narrowing, branded-ID negatives, missing method/key negatives, excluded exports, `emit` negative, accepted value negative, complete ten-port implementations | PASS; included in typecheck |

Static model red vectors are asserted one at a time with the other gates green:

| vector | expected unique failure | model result |
|---|---|---|
| exported `Record<string, unknown>` in connector response | `tr05-named-boundary` | PASS (red vector rejected) |
| optional `ConnectorPort.on` | `required-port-shape` | PASS (red vector rejected) |
| direct `redux` import in a default | `default-import-allowlist` | PASS (red vector rejected) |
| nested runtime `redux` import reached from a default | `default-import-allowlist` | PASS (red vector rejected) |
| `react-native` type import | `platform-identifier-boundary` | PASS (red vector rejected) |
| unexpected root export | support only; four rule gates remain green | PASS (support red vector rejected) |

Real-tree outputs were independently rerun:

```text
RULE_GATES=6 / SUPPORT_CHECKS=1 / SCAFFOLD_HYGIENE=PASS
CONTRACT_RULE_GATES=4 / CONTRACT_SUPPORT_CHECKS=1 / TERMINAL_CONTRACTS_STATIC=PASS
PLATFORM_PORT_RULE_GATES=4 / PLATFORM_PORT_SUPPORT_CHECKS=1 / TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATIC=PASS
```

The TER-local verifier's test-owner denominator is literal and fixed at seven:
`kernel-base-contracts`, `kernel-base-platform-ports`, and the five Android adapter packages.
The final run returned `TERMINAL_TEST_MARKERS=PASS real=2 noTests=5` and `22 typecheck tasks
successful`; this does not claim adapter capability or native behavior.

## 10. POC delta and unresolved boundaries

The implementation records these fifteen POC-to-TER changes from the approved design: ten required
ports replace optional port keys; environment mode is factory input only; register/seal is absent in
favor of one frozen factory record; public logger `emit` is removed and all four write levels share
one sanitizer; KV is string-only with a process-memory-only default and no secure-store fallback;
device is structured cross-platform snapshots without displays/battery-health/Android-only fields;
app control exposes `resetRuntime` with accepted semantics, `containerKey`, and no load-complete
alias; script uses named dispatcher plus JSON strings instead of an open function table; connector
uses four typed methods with opaque channel keys and no mechanism enum; hot-update markers are
具名 and distinguish absent from unavailable with no report alias; log upload removes unread metadata,
uses surface fields and branded IDs; topology retains production host status/address/diagnostics and
does not include fault/prepare/handshake/automation; `localWebServer` is not a second protocol port;
`display` and `automation` are not platform ports.

Still explicitly unverified or outside this package: full adapter/native capability, iOS/Windows/Linux
adapter semantics, connector channel taxonomy, topology iOS background survival, hot-update storage
and rollback implementation, exit/kiosk product owner (`DEXTER_DECISION`), process-memory survival
across restart, Android/Kotlin capability behavior, device execution, DEV/seed/reset, browser L2,
UAT/deployment, and warehouse-level normal `scripts/verify`. Static/typecheck/Metro evidence is not
native or device evidence.

## 11. Post-review remediation

Claude's implementation review identified two significant test/behavior gaps and three notes. The
authorized remediation stayed inside this package and the existing TER-local proof surface.

1. **S-1 console default:** `createPlatformPorts.ts` no longer suppresses `debug` in PROD. The
   console binding sends every `debug/info/warn/error` event through `sendToConsole` and reports
   `succeeded` only after the console call returns. `test/defaultPorts.test.ts` now clears and
   asserts the matching console spy for all four levels in DEV, TEST, and PROD, and checks the
   captured event is sanitized. An empty console implementation therefore fails D-1.
2. **S-2 accepted observer:** `test/successSemantics.test.ts` now gives the fake reset port an
   internal successor signal. The port returns `accepted`; a tick leaves its observer state
   `pending`; only resolving the successor signal changes that state to `succeeded`.
3. **S-4 timeout producer:** the same test obtains `timed-out` from a fake `resetRuntime` whose
   simulated elapsed time exceeds the requested budget, then asserts the returned timeout equals
   the input and is neither `failed` nor `unavailable`.
4. **N-1 diagnostic preservation:** `sensitiveData.ts` preserves only valid exact diagnostic keys:
   64-hex `packageSha256`/`manifestSha256`, numeric dotted `bundleVersion`, and decimal
   `accountBalance`; unsafe hash/account values remain masked. Logger tests cover both preservation
   and masking controls.
5. **N-2 context funnel:** `LogContext` is rebuilt through a closed projection; branded IDs are
   retained, `commandName` is value-sanitized, and unknown fields are not copied. A logger test
   proves a bearer-like command name is masked and absent from the emitted event.

Fresh focused remediation run:

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports typecheck --pretty false
EXIT=0
COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports test
EXIT=0
RESULTS=4 files / 16 tests passed
MARKER=TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports
```

The TER-local verifier remains unchanged in scope: no warehouse-level normal verify, adapter/native
implementation, device, Gradle, DEV, seed/reset, browser L2, UAT, or deployment was added by this
remediation.

## 12. Final post-remediation TER-local command ledger

The following commands were rerun after the five finding fixes and after the fresh independent
reconciliation returned `OPEN_COUNT=0`. They are the current evidence, superseding the earlier
pre-remediation timing/count snapshot in §7.1.

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports typecheck --pretty false
EXIT=0

COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports test
EXIT=0
RESULTS=4 files / 16 tests passed
MARKER=TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports

COMMAND=node tools/terminal-contracts/check-static.test.mjs
EXIT=0
CONTRACTS_MODEL_CLEANUP=PASS
TERMINAL_CONTRACTS_STATIC_MODEL_TEST=PASS

COMMAND=node tools/terminal-contracts/check-static.mjs
EXIT=0
CONTRACT_RULE_GATES=4
CONTRACT_SUPPORT_CHECKS=1
CONTRACT_RULE_ZERO_ADAPTER_CAPABILITY=PASS
CONTRACT_RULE_TR05_NAMED_BOUNDARY=PASS
CONTRACT_RULE_RUNTIME_ID_PREFIX_EXACT_SET=PASS
CONTRACT_RULE_CLOSED_LITERAL_UNIONS=PASS
CONTRACT_SUPPORT=PASS
TERMINAL_CONTRACTS_STATIC=PASS

COMMAND=node tools/terminal-platform-ports/check-static.test.mjs
EXIT=0
PLATFORM_PORTS_MODEL_CLEANUP=PASS
TERMINAL_PLATFORM_PORTS_STATIC_MODEL_TEST=PASS

COMMAND=node tools/terminal-platform-ports/check-static.mjs
EXIT=0
PLATFORM_PORT_RULE_GATES=4
PLATFORM_PORT_SUPPORT_CHECKS=1
PLATFORM_PORT_RULE_TR05_NAMED_BOUNDARY=PASS
PLATFORM_PORT_RULE_REQUIRED_PORT_SHAPE=PASS
PLATFORM_PORT_RULE_DEFAULT_IMPORT_ALLOWLIST=PASS
PLATFORM_PORT_RULE_PLATFORM_IDENTIFIER_BOUNDARY=PASS
PLATFORM_PORT_SUPPORT=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS

COMMAND=node tools/terminal-skeleton/verify.test.mjs
EXIT=0
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS

COMMAND=yarn workspace @catering-v2s/terminal verify:static
EXIT=0
TERMINAL_SKELETON_MODEL_TEST=PASS
RULE_GATES=6
SUPPORT_CHECKS=1
SCAFFOLD_HYGIENE=PASS
CONTRACT_RULE_GATES=4
CONTRACT_SUPPORT_CHECKS=1
TERMINAL_CONTRACTS_STATIC=PASS
PLATFORM_PORT_RULE_GATES=4
PLATFORM_PORT_SUPPORT_CHECKS=1
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATIC=PASS

COMMAND=yarn workspace @catering-v2s/terminal verify
EXIT=0
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=7
TERMINAL_TURBO_DRY_LINT=PASS executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS executable=0
22 typecheck tasks successful
7 test tasks successful
TERMINAL_TEST_MARKERS=PASS real=2 noTests=5
Android Bundled ... (663 modules)
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS

COMMAND=yarn workspace @catering-v2s/kernel-base-platform-ports exec tsc --project tsconfig.json --listFilesOnly
EXIT=0
MATCHED_FILES=32
INCLUDES=test/public-surface.typecheck.ts=YES

COMMAND=TERMINAL_EXPORT_ARTIFACT_CLEANUP
EXIT=0
TERMINAL_EXPORT_ARTIFACT_CLEANUP=PASS

COMMAND=git diff --check -- platform-ports-relevant-paths
EXIT=0
GIT_DIFF_CHECK=PASS
```

The first combined-shell attempt reached `TERMINAL_STATIC=PASS` but its wrapper used zsh's
read-only `status` variable and therefore returned a shell error. That was diagnosed as an
external wrapper failure, not a verifier failure; the same command was rerun with `rc` and returned
`EXIT=0` as recorded above. The `verify` export still reports npm's unrelated
`Unknown user config "allow-scripts"` warning; it does not alter the exit code or marker.

`N-3` remains `UNVERIFIED_REQUIRES_EVIDENCE` for Claude's independent dynamic re-execution. These
local outputs provide current TER-local evidence but do not widen the native/device/adapter claims.
