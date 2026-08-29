# TER skeleton batch 1 — CP-7 Android device evidence

```text
REVIEW_TARGET=IMPLEMENTATION
CP=CP-7
CP7_DEVICE_STEP=PASS
CP7_ROOT_TUPLE_WIRING=CONNECTED
CP7_OVERALL=OPEN_ROOT_VALIDATE_BACKEND_STATIC_BASELINE
DATE=2026-08-29
```

This is the one-time emulator step from the accepted TER skeleton design. It proves only
the Android build/autolinking/startup/bootstrap-rendering boundary for the batch-1
assembly. It does not prove Kotlin capability, persistence behavior, any command/slice,
port behavior, batch 2, or business behavior.

## Command and device

The command was run from `apps/terminal/assembly/android/pos-desktop` with the existing
emulator explicitly selected. Google-hosted traffic used the local proxy; Aliyun traffic
was excluded from the proxy by the user Gradle properties.

```sh
cd apps/terminal/assembly/android/pos-desktop
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
ALL_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1 \
CI=1 EXPO_NO_TELEMETRY=1 EXPO_DEBUG=1 ANDROID_SERIAL=emulator-5554 \
npx expo run:android --no-install --device Pixel_Tablet
```

The run started at `2026-08-29T10:32:30.863Z`. The captured Expo output is
`.runtime/terminal-skeleton/cp7/expo-run-android-pixel-tablet-cache3.log`.

```text
› Using --device Pixel_Tablet
BUILD SUCCESSFUL in 7s
› Installing .../android/app/build/outputs/apk/debug/app-debug.apk
› Opening com.anonymous.posdesktop/.MainActivity on Pixel_Tablet
Android Bundled 2095ms ... (751 modules)
```

ADB identity is captured in `.runtime/terminal-skeleton/cp7/adb-devices-l-cache3.txt` and
`.runtime/terminal-skeleton/cp7/adb-avd-name-cache3.txt`:

```text
emulator-5554  device  product:sdk_gtablet_arm64 model:Pixel_Tablet device:emu64a
Pixel_Tablet
```

The host Expo/Metro process was stopped after the screenshot/UI-dump capture; the app was
then force-stopped with `adb -s emulator-5554 shell am force-stop
com.anonymous.posdesktop`. The post-cleanup focus and empty post-stop PID are recorded in
`.runtime/terminal-skeleton/cp7/adb-focused-app-cache3.txt` and
`.runtime/terminal-skeleton/cp7/adb-app-pid-after-stop-cache3.txt`; they are cleanup
observations, not the live-start assertion. Live startup is established by the Expo
`am start`/`Opening` lines together with the screenshot and UI dump.

## Four required assertions

1. **Gradle build — PASS.** The run log contains `BUILD SUCCESSFUL in 7s`; the adapter
   module's Android compilation tasks were part of the build. A separate offline
   `:app:assembleDebug` replay also passed in
   `.runtime/terminal-skeleton/cp7/offline-assemble-cache-gap-7.log` (`BUILD SUCCESSFUL
   in 35s`). This is build evidence only, not Kotlin capability evidence.
2. **Expo autolinking — PASS.** The direct resolver exited 0; its raw JSON is
   `.runtime/terminal-skeleton/cp7/autolinking-resolve-android.json`. The forced Gradle
   package-list generation exited 0 in
   `.runtime/terminal-skeleton/cp7/expo-generate-packages-list-rerun.log`. The generated
   registry source is
   `apps/terminal/node_modules/expo/android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt`,
   with this exact entry:

   ```kotlin
   com.catering.v2s.terminal.adapter.android.persistkv.TerminalPersistKvModule::class.java to null,
   ```

   The copied rerun artifact is `.runtime/terminal-skeleton/cp7/ExpoModulesPackageList-rerun.kt`.
3. **Application start — PASS.** The Expo log records installation, `am start`, and the
   selected emulator. The package was live during capture; the post-run PID file is empty
   only because the explicitly owned app process was force-stopped during cleanup.
4. **Bootstrap rendering — PASS.** The screenshot is
   `.runtime/terminal-skeleton/cp7/emulator-screen-cache3.png`; the UI dump is
   `.runtime/terminal-skeleton/cp7/emulator-ui-module-names.txt`. Decoding its `&#10;`
   separators yields exactly these 14 visible names:

   ```text
   assembly.android.pos-desktop
   kernel.base.contracts
   kernel.base.platform-ports
   kernel.base.state
   kernel.base.runtime
   kernel.base.display-context
   kernel.base.ui-state
   kernel.base.test-support
   ui.base.render
   ui.base.automation
   ui.base.primitives
   ui.base.test-support
   ui.integration.platform-console
   adapter.android.persist-kv
   ```

## Generated-output cleanup

Before cleanup, the command-owned paths were recorded in
`.runtime/terminal-skeleton/cp7/cleanup-generated-before.log`:

```text
apps/terminal/assembly/android/pos-desktop/android/app/build  1.4G
apps/terminal/assembly/android/pos-desktop/android/build       208K
apps/terminal/assembly/android/pos-desktop/android/.gradle     6.3M
apps/terminal/assembly/android/pos-desktop/android/.kotlin       0B
apps/terminal/assembly/android/pos-desktop/android/app/.cxx     20M
apps/terminal/adapter/android/persist-kv/android/build         800K
```

Those generated directories, plus the entire Expo-generated assembly native project
`apps/terminal/assembly/android/pos-desktop/android/`, were moved out of the repository
tree to the run-scoped recoverable path `/tmp/catering-v2s-cp7-generated-20260829-104224`.
The assembly project was `732K`; its complete before tree is recorded in
`.runtime/terminal-skeleton/cp7/assembly-android-generated-before.log` and the after
absence check is `.runtime/terminal-skeleton/cp7/assembly-android-generated-after.log`.
No adapter `android/src` source was removed. The after-check is
`.runtime/terminal-skeleton/cp7/cleanup-generated-after.log` and reports no matching
`build`, `.gradle`, `.kotlin`, or `.cxx` directory under the two TER Android trees.
The assembly `android/` directory is also absent after cleanup. The `.expo` directory
created by the run had already been moved to the same cleanup area and is recorded as
`EXPO_RUNTIME_CLEANUP=PASS`.

Post-cleanup `tools/terminal-skeleton/check-static.mjs` passed with the required
six rule gates and one hygiene support check; the final after-assembly-cleanup output is
`.runtime/terminal-skeleton/cp7/check-static-after-assembly-cleanup.log` (the earlier
post-device output is retained at `.runtime/terminal-skeleton/cp7/check-static-post-device.log`).
The generated outputs are
also covered by the existing root and Android `.gitignore` rules, so they are not Git
entries.

## Download/cache route evidence

The failure that initiated CP-7 was a Google-hosted `builder-8.5.0.jar` read timeout;
the first failure is preserved in `.runtime/terminal-skeleton/cp7/first-failure.log`.
The missing artifacts were fetched once and placed in the canonical Gradle cache, after
which the online run and offline assemble both succeeded. Canonical artifact hashes are:

| artifact | route | canonical cache path | SHA-1 |
|---|---|---|---|
| Android Gradle builder 8.5.0 | Google official through `127.0.0.1:7890` | `~/.gradle/caches/modules-2/files-2.1/com.android.tools.build/builder/8.5.0/b67b3f37071bee0d38a4b1e7ce5b9da9ba9ca139/builder-8.5.0.jar` | `b67b3f37071bee0d38a4b1e7ce5b9da9ba9ca139` |
| Prefab CLI 2.1.0 | Google official through `127.0.0.1:7890` | `~/.gradle/caches/modules-2/files-2.1/com.google.prefab/cli/2.1.0/aa32fec809c44fa531f01dcfb739b5b3304d3050/cli-2.1.0-all.jar` | `aa32fec809c44fa531f01dcfb739b5b3304d3050` |
| React Android 0.86.3 debug AAR | Maven Central URL recorded by Gradle; canonical cache reused | `~/.gradle/caches/modules-2/files-2.1/com.facebook.react/react-android/0.86.3/811474b9e24f783511aebb0863c63cb9cb8edb3b/react-android-0.86.3-debug.aar` | `811474b9e24f783511aebb0863c63cb9cb8edb3b` |
| Pika compiler 0.3.2-2.1.20 | Aliyun direct | `~/.gradle/caches/modules-2/files-2.1/io.github.lukmccall.pika/pika-compiler/0.3.2-2.1.20/a5839baa0b31debd17649885c9957fc43da5e53b/pika-compiler-0.3.2-2.1.20.jar` | `a5839baa0b31debd17649885c9957fc43da5e53b` |
| AndroidX collection 1.0.0 | Aliyun direct | `~/.gradle/caches/modules-2/files-2.1/androidx.collection/collection/1.0.0/42858b26cafdaa69b6149f45dfc2894007bc2c7a/collection-1.0.0.jar` | `42858b26cafdaa69b6149f45dfc2894007bc2c7a` |
| AAPT2 8.12.0-13700139 | Aliyun direct | `~/.gradle/caches/modules-2/files-2.1/com.android.tools.build/aapt2/8.12.0-13700139/f25680dd4cff522de523e629f956271d8ee111cf/aapt2-8.12.0-13700139-osx.jar` | `f25680dd4cff522de523e629f956271d8ee111cf` |

The routing source is the user-level `/Users/dexter/.gradle/gradle.properties`:

```properties
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=7890
systemProp.http.nonProxyHosts=localhost|127.0.0.1|*.aliyun.com
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=7890
systemProp.https.nonProxyHosts=localhost|127.0.0.1|*.aliyun.com
```

Route probes are retained in `prefab-cli-official-probe.log` (`GOOGLE_OFFICIAL_PROXY`),
`pika-aliyun-probe.log` (`ALIYUN_DIRECT`), and `aapt2-aliyun-body.log`
(`ALIYUN=NO_PROXY`). These probes establish the requested split for those requests:
Aliyun does not use the proxy and Google official endpoints do. The React AAR row is
deliberately not classified as an Aliyun download because the retained Gradle output
records `repo.maven.apache.org` for that artifact; the canonical cache hash is the
evidence, not an unsupported route inference.

## Root verifier wiring and remaining boundary

After the final fresh CP-7 recheck returned `RECONCILIATION=MATCHED / OPEN_COUNT=0`, the
planned root tuples were added to `tools/verify-gates/verify.mjs` and locked by the two
focused catalog tests. The TER static tuple was executed directly and passed; output is
`.runtime/terminal-skeleton/cp7/ter-verify-static-after-root-wire.log` and ends with
`TERMINAL_STATIC=PASS`.

The required root `scripts/verify --validate-only` was attempted twice after wiring.
The first attempt stopped at a pre-existing root `frontend-format` violation and is
`.runtime/terminal-skeleton/cp7/root-verify-validate-only.log`. After a mechanical
Prettier-only correction of that HEAD file, retry 1 stopped at the pre-existing root
`.turbo` directory and is
`.runtime/terminal-skeleton/cp7/root-verify-validate-only-retry1.log`. The `.turbo`
cache was moved out of the repository, but retry 2 then reached the backend static
chain and stopped at `backendJavaUtf8LineLimit`/`spotlessCheck` violations in existing
backend organization/acceptance sources; that first failure is
`.runtime/terminal-skeleton/cp7/root-verify-validate-only-retry2.log`.

`terminal-verify` is intentionally not run through root normal verification because the
accepted boundary forbids the root remote/runtime commands. Root normal verification,
device automation, Kotlin capability, batch 2, and all business/runtime validation
remain out of scope. CP-7 therefore remains open only on the independent backend static
baseline, not on TER device/static evidence.
