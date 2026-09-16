# TER admin console keyboard dismissal: manual reproduction and focused repair

## Scope

- Target: `com.anonymous.sampleterminal` on `emulator-5554`, dual-display Android VM, primary display.
- Boundary: `expo run:android` debug runtime with Metro; the keyboard under test is TER's native-less virtual keyboard, not Android system IME.
- Evidence date: 2026-09-16 (device logcat clock shown by the runtime).

## First failure

The user performed the real top-left gesture. The admin login layer opened, the virtual keyboard reached `visible=true` / `rendered=true`, and then a later top-left surface touch dismissed it:

```text
10:50:42.590 admin.launcher-gesture-completed ... completed=true propagationStopped=true
10:50:42.736 input.keyboard-visibility ... activeFieldId='terminal.admin:password-field' owner='virtual' visible=true rendered=true
10:50:42.804 input.surface-touch-start ... pageX=41.9921875 pageY=43.994140625
10:50:42.972 input.surface-touch-end ... shouldDismiss=true
10:50:42.993 input.keyboard-visibility ... activeFieldId=null owner='none' visible=false rendered=false
10:50:42.994 input.surface-state ... keyboardRendered=false
```

The preceding surface touch ended at the same physical corner as the launcher gesture, but it had a different event timestamp and target. Therefore `stopPropagation()` on the completion event correctly prevented that completion event from reaching the parent dismiss observer; it could not protect the separately delivered follow-up touch.

The user-visible artifact is `/tmp/ter-admin-manual-after-click.png` (admin login remains, virtual keyboard is absent).

## Last known good and broken boundary

- Last known good before the fix: `admin.launcher-gesture-completed` and the first `input.keyboard-visibility visible=true`.
- First failing boundary: `InputSurfaceFrameContents.onTouchEnd` called `controller.dismissActiveField()` while the active field belonged to `admin.console`.
- Broken ownership rule: the business surface's passive touch observer had no focus-scope boundary and could clear a modal/admin-owned field after the admin layer had taken focus ownership.

## Root-cause repair

The owning fix is in `apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts`:

- surface dismissal still clears business-scope fields;
- if the active registered field has any non-business `focusScopeId`, surface dismissal is rejected and a DEV diagnostic is emitted;
- explicit field blur, scope restoration, or layer close continues to own admin-field cleanup.

The existing `AdminLauncher` completion propagation guard remains in place because it closes the separate completion-event path; it is not used as a substitute for the focus-scope ownership rule.

The focused regression is `does not let business surface dismissal clear a non-business scoped field` in `apps/terminal/ui/base/input/test/provider.test.tsx`.

## Dynamic re-verification

After restarting the debug Activity and clearing logcat, five controlled top-left taps plus one same-location post-open touch produced:

```text
10:58:03.657 admin.launcher-gesture-completed ... completed=true propagationStopped=true
10:58:03.779 input.keyboard-visibility ... activeFieldId='terminal.admin:password-field' owner='virtual' visible=true rendered=true
10:58:04.440 input.surface-touch-end ... pageX=42 pageY=44 shouldDismiss=true
10:58:04.443 input.surface-dismiss ... accepted=false reason='non-business-focus-scope' activeFieldId='terminal.admin:password-field' fieldScopeId='admin.console' activeScopeId='admin.console'
```

The post-touch UI dump `/sdcard/ter-admin-after-fix.xml` contained both:

```text
resource-id="terminal.admin:login" ...
resource-id="ui.base.input:virtual-keyboard" ...
```

The virtual key at the UI-dump bounds `[770,787][1098,883]` was tapped once. The follow-up dump `/sdcard/ter-admin-after-key.xml` showed:

```text
resource-id="terminal.admin:password:digit:0" ... content-desc="第1位已填写"
resource-id="ui.base.input:virtual-keyboard" ...
```

This proves the keyboard remained rendered and accepted input after the same class of follow-up surface touch.

After the final blocked-field ordering correction, the same dynamic check was repeated on the restarted debug Activity:

```text
11:01:15.297 admin.launcher-gesture-completed ... completed=true propagationStopped=true
11:01:15.439 input.keyboard-visibility ... activeFieldId='terminal.admin:password-field' owner='virtual' visible=true rendered=true
11:01:16.108 input.surface-touch-end ... pageX=42 pageY=44 shouldDismiss=true
11:01:16.108 input.surface-dismiss ... reason='non-business-focus-scope' activeFieldId='terminal.admin:password-field' fieldScopeId='admin.console' activeScopeId='admin.console'
```

The final UI dump `/sdcard/ter-admin-final.xml` still contained `terminal.admin:login`, `ui.base.input:virtual-keyboard`, and the keyboard key `text-1`. After one key tap, `/sdcard/ter-admin-final-key.xml` showed `terminal.admin:password:digit:0` with `content-desc="第1位已填写"` and the virtual keyboard node still present.

## Focused verification

All commands completed with exit code 0 after the final patch:

```text
yarn --cwd apps/terminal/ui/base/input typecheck
yarn --cwd apps/terminal/ui/base/input test        # 10 files, 52 tests
yarn --cwd apps/terminal/ui/base/admin-shell typecheck
yarn --cwd apps/terminal/ui/base/admin-shell test  # 7 files, 16 tests
yarn --cwd apps/terminal/ui/integration/sample-console test # 8 files, 38 tests
```

## Cleanup

Cleanup is recorded separately from the business result:

- `am force-stop com.anonymous.sampleterminal`: exit 0.
- `pidof com.anonymous.sampleterminal`: no PID (`PID_ABSENT`).
- Task-owned Expo/Metro session: stopped cleanly (`Stopped server`).
- Task-owned `emulator-5554` reverse `tcp:8081`: removed after confirming it was the only listed reverse.
- Local TCP 8081 listener: none.

Cleanup result: PASS for the target app, task-owned Metro session, reverse, and local listener. No unrelated process was stopped.

The final post-correction run was also closed with the same exact checks: target PID absent, Expo/Metro reported `Stopped server`, the only `emulator-5554` `tcp:8081` reverse was removed, and the local 8081 listener was absent.
