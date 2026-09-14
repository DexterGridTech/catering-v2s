# TER Android persistKV / persistSecure CP-1 执行记录

```text
RUN_DATE=2026-09-13
RUN_KIND=TER_ANDROID_PERSIST_KV_CP1_NATIVE_AND_ANDROID
CP=CP-1
AUTHORITY=Dexter direct implementation authorization
GATE=MATCHED
BUSINESS=MATCHED_FOR_EXECUTED_SCENARIOS
CLEANUP=PASS（CP-4 结束时对本记录产生的 exact runtime resources 做统一清理）
FRESH_SUBPROCESS=yes；独立 reviewer 未执行本记录命令
```

## 输入和范围

- 需求：`doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md`。
- 详设：`doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-design-codex.md`。
- owning source：`StorageMode.kt`、`TerminalPersistKvModule.kt`、`StateStoragePort` 及 state storage consumers。
- CP-0 已在 `2026-09-12-v2s-terminal-android-persist-kv-cp0-execution-codex.md` 完成 source freeze；本记录不把 CP-0 的 artifact signature 当作行为证据。

## 实际命令结果

### D-01、D-02：storage timeout 删除

当前 `StateStorageCall` 是空对象，storage 八个方法的输入不含 `timeoutMs`；Kotlin/JS private wire 也没有 storage deadline 参数。以下检查均为当前字节的新鲜执行：

```text
yarn workspace @catering-v2s/adapter-android-persist-kv typecheck       PASS
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck       PASS
yarn workspace @catering-v2s/kernel-base-state typecheck                PASS
yarn workspace @catering-v2s/kernel-base-runtime typecheck              PASS
yarn workspace @catering-v2s/assembly-android-sample-terminal typecheck PASS
```

这是 static/typecheck 证据，不声称存在一个实际 storage timeout 行为。

### Kotlin mode/native helper

```text
./gradlew :catering-v2s-adapter-android-persist-kv:compileDebugKotlin \
  :catering-v2s-adapter-android-persist-kv:testDebugUnitTest --no-daemon --stacktrace
BUILD SUCCESSFUL
7 tests completed, 0 failed (StorageValidationTest 5 + StorageModeResolverTest 2)
```

正向断言接受且仅接受 `plain`、`protected`；`null`、空值、`PLAIN`、`future`、`plain ` 均返回 null。`StorageValidationTest` 的 5 个测试覆盖 persistence key 128、entry key 256、UTF-8 value 1 MiB、key batch 512、write batch shape/size/value、控制字符和 protected marker 保留键；`StorageModeResolverTest` 的 2 个测试覆盖 mode closed-set。先做 D-05 value-limit red mutation：把 `StorageValidation.kt` 的 `value > MAX_VALUE_BYTES` 临时改成 `value > MAX_VALUE_BYTES + 1`，同一 Gradle test 实际结果为：

```text
StorageValidationTest > single values use UTF-8 bytes and enforce the one MiB boundary FAILED
7 tests completed, 1 failed
BUILD FAILED
```

随后恢复 `value > MAX_VALUE_BYTES`，再做 `StorageModeResolver` 的 unknown-token red mutation，把 `else -> null` 临时改成 `else -> StorageMode.PLAIN`，实际结果为：

```text
StorageModeResolverTest > missing empty and unknown tokens are rejected without a plain fallback FAILED
7 tests completed, 1 failed
BUILD FAILED
```

随后已恢复 `else -> null`，正向 Gradle test 再次为 `BUILD SUCCESSFUL`（7/7）。两条红变异分别证明 D-05 的一 MiB value 边界和 §11.1 item 16 的 fail-closed mode 边界确实可证伪；它们是 native helper/source boundary proof，不被扩写成完整八方法 native bridge proof。

### Kotlin source/data-flow 对账

- `withStore` 先 `StorageModeResolver.resolve`，再做 persistence/entry/batch validation，最后才进入 `openStore`；invalid mode 返回具名 `PERSIST_KV_INVALID_MODE`，不会调用 `openStore`。
- plain 使用 `catering-v2s.terminal.state.v1.`，protected 使用独立的 `catering-v2s.terminal.state.protected.v1.`。
- protected 使用 `MMKV.mmkvWithID(namespace, MMKV.SINGLE_PROCESS_MODE, cryptKey)`；plain 使用无 cryptKey overload。
- protected `cryptKey` 在 Kotlin 侧由 `Settings.Secure.ANDROID_ID` 派生；原始材料不经过 JS，也不写入日志。
- `MMKV.checkExist(namespace)` 在 protected store 打开前提供文件存在信号；既有文件 marker 解不出时返回 `PERSIST_KV_PROTECTED_KEY_MISMATCH`，新 namespace 写 marker 后 `sync()`。没有自动 rekey 或 plain fallback。
- write/remove/writeMany/removeMany/clear 和新 protected marker 写入路径均调用 `store.sync()`。
- `readMany` 遇到存在但不能 decode 的项直接返回整批 `PERSIST_KV_STRING_DECODE_FAILED`，不返回 missing。
- `StorageValidation` 是 module 与 native unit 共用的单一校验 owner；5 个 `StorageValidationTest` 实际覆盖 D-05 的 persistence/entry/value/batch/控制字符/保留键边界，另有 2 个 `StorageModeResolverTest` 覆盖 mode closed-set。D-05 value-limit red mutation 已实际失败并在恢复源码后重新通过。仍未把每个 invalid vector 逐一经 Android public Expo bridge 触发，本记录不把 native helper proof 扩写成完整 public bridge proof。

## Android 真实运行补充

设备：`emulator-5554`，`sdk_gtablet_arm64` / `Pixel_Tablet`；安装对象是 sample-terminal release APK（SHA-256 记录在 CP-4）。

真实 app load 后，`TerminalPersistKv` 日志出现：

```text
event=persist-kv operation=listKeys mode=plain status=succeeded
event=persist-kv operation=readMany mode=plain status=succeeded
event=persist-kv operation=listKeys mode=protected status=succeeded
event=persist-kv operation=readMany mode=protected status=succeeded
```

这证明 release sample 的 Expo module 真实加载并走过两个 mode；具体安装、错钥文件反例、重启与 cleanup 见 CP-4。

## 首败、修复和边界

本 CP 的 temporary MMKV probe 有三个可复现的启动边界：直接以 jar/classpath 启动 `app_process` 得到 ClassNotFound；`d8` 初次因输出目录不存在返回 invalid output；`dalvikvm` 运行 dex 后因 Android Log JNI 不在该运行时得到 `UnsatisfiedLinkError`。诊断后改为：创建精确临时输出目录，使用 dex + release APK classpath，并通过 `app_process`/`LD_LIBRARY_PATH` 加载 release 的 MMKV native library；随后 probe 成功。失败没有被重命名为 PASS，解决后的边界与输出保留在 CP-4。

## CP-1 结论

CP-1 的实现 gate 对于已批准的 mode/store、namespace、cryptKey、sync、typed error 和 D-05 native validation limits 已闭合；Android module load、隔离、文件可读性、marker mismatch、重启读回的真实结果见 CP-4。D-05 的 invalid vector 尚未逐一通过 public Expo bridge 触发，故本记录不声称 public Android boundary 已覆盖这些向量。
