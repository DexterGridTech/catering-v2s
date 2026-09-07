# TER terminal input CP-0 Android probe

```text
RUN_ID=TERMINAL-INPUT-CP0-ANDROID-PROBE-2026-09-06
TARGET=apps/terminal/assembly/android/sample-terminal
DEVICE=emulator-5554
PACKAGE=com.anonymous.sampleterminal
PROBE=temporary direct React Native TextInput; ui/base/input was not imported
STATUS=CP0_REOPENED_PASS_WITH_SECONDARY_VIRTUAL_BOUNDARY
CP1_ADMISSION=OPEN_FOR_INDEPENDENT_REVIEW
PRODUCT_RULING=Dexter 2026-09-06：SECONDARY 默认不支持系统 IME；副屏输入必须走虚拟键盘
LATEST_RUN=doc/evidence/platform/terminal-input/runs/TERMINAL-INPUT-CP0-ANDROID-VIRTUAL-PROBE-2026-09-06T04-44-29/
```

## 1. Scope and setup

The probe replaced `apps/terminal/assembly/android/sample-terminal/App.tsx` temporarily with a
direct React Native `TextInput`, a submit button, and length-only diagnostic logs. It did not import
`ui/base/input`, did not dispatch a runtime command, and did not alter the kernel or platform-port
contracts. After each run, the production `App.tsx` was restored and the Android app was force-stopped.

The emulator reported:

- display 0: `2560x1600`, `320dpi`;
- display 2: `1280x720`, `213dpi`;
- both roots started in one process/one React host, with `displayIndex=0` and `displayIndex=1`.

The dual-screen adapter was rebuilt with a per-window `WindowInsetsCompat.Type.ime()` listener. The
listener logs only window/display identity, visibility and inset dimensions; it does not write runtime
state or input values.

## 2. Probe results

| Check | Result | Evidence |
|---|---|---|
| Probe construction | PASS | Both React roots mounted the direct probe; no input-package import was present. |
| Primary focus and IME | PASS for primary window | `TerminalDualScreen` logged `window=primary displayIndex=0 displayId=0 visible=true bottomPx=736 bottomLogical=368.0`. |
| Secondary RN focus | PASS | `dumpsys input_method` reported `mCurClient ... mSelfReportedDisplayId=2` and a served `ReactEditText` on the secondary surface. |
| Secondary IME visibility/inset | **FAIL** | At the same secondary focus, the secondary listener logged `window=secondary displayIndex=1 displayId=2 visible=false bottomPx=0 bottomLogical=0.0`, while the primary listener logged `visible=true`. |
| Secondary typed value | PASS | The probe logged `typed displayIndex=1 length=1` through `length=25`. The raw value was not logged. |
| Secondary submit readback | PASS | The probe logged `submitted displayIndex=1 length=25`. |
| IME token placement | **FAIL for secondary-surface requirement** | `dumpsys input_method` reported `mCurTokenDisplayId=0` while the current client self-reported display 2. |

The failure is not a missing listener: the listener was attached to both windows and produced an
identity-correct hidden snapshot for display 2. The broken boundary is Android IME placement: the
focused Presentation client is on display 2, but the IME token and visible IME inset remain on display
0. ADB text injection can therefore prove the `TextInput` editing callback and submit path, but it
cannot be substituted for an IME visible on the customer surface.

## 3. First failure / last known good (original probe)

```text
LAST_KNOWN_GOOD=secondary RN TextInput focus + typed callback + submit callback
FIRST_FAILURE=secondary Presentation did not receive visible Type.ime() while its TextInput was focused
BROKEN_BOUNDARY=mCurTokenDisplayId=0 and primary window visible=true; secondary window visible=false
```

At the time of this original run, the implementation plan treated secondary IME visibility as a CP-0
stop condition. Dexter's 2026-09-06 product ruling supersedes that interpretation: the observed
secondary hidden IME and primary IME token are now an accepted platform boundary for the current
product, because SECONDARY is virtual-keyboard-only. The first failure is preserved as evidence and
is not rewritten as a pass. A new CP-0 run must still prove the primary system-IME inset path and a
secondary virtual-input path before CP-1 admission.

## 4. Product ruling and reopened CP-0

The secondary `TextInput` focus, typed callback and submit callback remain useful facts, but they do
not prove a virtual keyboard. The reopened probe must use a temporary direct-RN input with
`showSoftInputOnFocus=false` and a temporary on-screen virtual-key button that writes/commits a value.
The secondary system IME is expected to remain hidden. The temporary probe must be removed and the
production `App.tsx` restored before CP-1; probe code is not an implementation artifact.

## 5. Build and cleanup (original run)

The first coordinator compile attempt failed on an incorrect Kotlin listener type and was corrected
against the installed AndroidX API. The resulting `:catering-v2s-adapter-android-dual-screen:compileDebugKotlin`
and `:app:assembleDebug` completed successfully. The build output resolved Expo/RN Android values as
`minSdk=24`, `compileSdk=36`, `targetSdk=36`, `ndk=27.1.12297006`.

Cleanup was separate from business evidence:

- `adb shell am force-stop com.anonymous.sampleterminal`: PASS;
- the temporary probe source was restored to the sample assembly App: PASS;
- the owned Expo 8081 parent/child processes (PIDs 9115/9116) were stopped: PASS;
- no unknown emulator process was stopped.

The primary-window coordinator and diagnostic bridge remained only as CP-0 infrastructure for review
of this stop boundary; they were not claimed as a completed input feature and no later CP was admitted
from the original run.

## 6. Reopened CP-0 run after the product ruling

```text
REOPENED_RUN_ID=TERMINAL-INPUT-CP0-ANDROID-VIRTUAL-PROBE-2026-09-06T20-20-15
PROCESS_PID=15772
PRIMARY_IME_EXPECTED=VISIBLE
SECONDARY_IME_EXPECTED=HIDDEN
```

The reopened probe kept the secondary direct `TextInput` as a virtual-input target with
`showSoftInputOnFocus=false`, and added temporary on-screen buttons that write a value and submit it.
The secondary field was not auto-focused, so the primary system-IME path could be observed without a
secondary focus stealing the primary IME.

The primary path produced all of the following signals in one run:

```text
InputMethodManager: showSoftInput() ... reason=SHOW_SOFT_INPUT
GoogleInputMethodService: onStartInput ... packageName=com.anonymous.sampleterminal
GoogleInputMethodService: onStartInputView ... packageName=com.anonymous.sampleterminal
TerminalDualScreen: event=ime-insets window=primary displayIndex=0 displayId=0 visible=true bottomPx=736 bottomLogical=368.0
dumpsys input_method: mCurTokenDisplayId=0
dumpsys input_method: mInputShown=true
```

The secondary virtual path then produced:

```text
ReactNativeJS: [cp0-probe] virtual-typed displayIndex=1 length=1
ReactNativeJS: [cp0-probe] focused displayIndex=1
ReactNativeJS: [cp0-probe] submitted displayIndex=1 length=1
dumpsys input_method: mCurClient ... mSelfReportedDisplayId=2
dumpsys input_method: mCurTokenDisplayId=0
dumpsys input_method: mInputShown=false
```

This proves the current product boundary: the secondary surface can focus the direct target, receive a
programmatic virtual key, and submit the resulting value without requiring or showing a system IME.
It does not claim that a Presentation can host a system IME. The old secondary listener output in
sections 2 and 3 remains the raw evidence for that rejected product capability.

The temporary probe was then removed before CP-1 admission:

- `rg` over `apps/terminal/assembly/android/sample-terminal` found `0` `cp0-probe`, `ProbeSurface`,
  `Virtual 7`, or `Virtual 8` markers;
- production `apps/terminal/assembly/android/sample-terminal/App.tsx` was restored;
- `yarn workspace @catering-v2s/assembly-android-sample-terminal typecheck`: PASS;
- `yarn workspace @catering-v2s/adapter-android-dual-screen typecheck`: PASS;
- `./gradlew :catering-v2s-adapter-android-dual-screen:compileDebugKotlin :app:assembleDebug --no-daemon`:
  PASS, with only existing Android deprecation warnings;
- `adb shell am force-stop com.anonymous.sampleterminal`: PASS, and `pidof` returned no app PID;
- the owned Expo/Metro process on port 8081 was stopped: PASS;
- a pre-existing Expo process on port 8082 was not owned by this run and was left untouched.

The secondary `TerminalImeInsetsCoordinator` was removed from `TerminalPresentation` after the run.
The production adapter now observes IME insets only for the primary Activity; the secondary input path
is intentionally virtual-only. `TerminalImeInsetsEventBus` remains the primary inset handoff for the
future input implementation, not a secondary-IME workaround.

## 7. Canonical run artifacts after the CP-0 lifecycle fix

The canonical run-scoped artifacts for the current CP-0 admission are kept under
`doc/evidence/platform/terminal-input/runs/TERMINAL-INPUT-CP0-ANDROID-VIRTUAL-PROBE-2026-09-06T04-44-29/`.
`manifest.txt` contains the run identity, first failure/last known good and cleanup readback;
`commands.txt` contains the exact commands; `logcat.filtered.txt` contains the primary IME and
secondary virtual-input output; `dumpsys.txt` contains the emulator display/input-method snapshot;
`build.txt` contains the Gradle result. The temporary probe was removed immediately after this run;
the run artifact is evidence only and is not a runtime dependency.

The adapter lifecycle fix was compiled in this run: the primary Activity registers application
lifecycle callbacks even when no secondary exists, and unregisters only after primary destruction and
secondary cleanup are both complete. The run itself confirms primary listener attachment and primary
IME snapshots; source review is the evidence for the destroy/idle ownership rule because force-stopping
the process terminates the callback host before a detach log can be emitted.

```text
LAST_KNOWN_GOOD=primary system IME visible/inset observed; secondary virtual typed + submitted
FIRST_FAILURE=none for the revised CP-0 product boundary
EXPECTED_NON_CAPABILITY=secondary Presentation system IME remains unavailable by product ruling
CP0_REOPENED=PASS
CP1_ADMISSION=OPEN_FOR_INDEPENDENT_REVIEW
```
