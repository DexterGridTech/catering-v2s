# TER Android persistKV / persistSecure CP-4 执行记录

```text
RUN_DATE=2026-09-13
RUN_KIND=TER_ANDROID_PERSIST_KV_CP4_RELEASE_ANDROID_CLEANUP
CP=CP-4
AUTHORITY=Dexter direct implementation authorization
GATE=MATCHED
BUSINESS=PASS_FOR_EXECUTED_ANDROID_SCENARIOS
CLEANUP=PASS
FRESH_SUBPROCESS=yes；本记录由当前 Codex task 的新鲜命令/进程生成，非 fresh 独立 reviewer
RAW_TRANSCRIPT=doc/evidence/platform/2026-09-12-v2s-terminal-android-persist-kv-cp4-raw-transcript-codex.md
```

## release artifact

命令：

```text
./gradlew :app:assembleRelease --no-daemon --stacktrace
BUILD SUCCESSFUL
581 actionable tasks: 62 executed, 519 up-to-date
```

artifact：

```text
path=apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk
size=87825831 bytes
sha256=9aabd0a27a9aae5d9991d9eecbf29b8c7754efb98e089f50931e706ee42bad92
```

Gradle 实际解析并列出了 `catering-v2s-adapter-android-persist-kv`，同时保留 `compileSdk=36`、`minSdk=24`、`targetSdk=36`。构建输出只有项目既有的 NODE_ENV/deprecation warning，没有失败。该 release artifact 是本记录安装和真实 module load 的对象。

## Android module load 与双 mode hydrate

设备：

```text
serial=emulator-5554
product=sdk_gtablet_arm64
model=Pixel_Tablet
```

按精确 package `com.anonymous.sampleterminal` 安装 release APK，执行 `pm clear` 后启动。新鲜 logcat 的安全筛选结果：

```text
ReactNativeJS: Running "main"
TerminalPersistKv: event=persist-kv operation=listKeys mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=readMany mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=listKeys mode=protected status=succeeded
TerminalPersistKv: event=persist-kv operation=readMany mode=protected status=succeeded
ReactNativeJS: sample.runtime-facts-resolved ... deviceIdentityAvailable: true
```

对应 app private MMKV 目录中实际出现了四个 exact 文件：plain/protected 各一个 `.mmkv` 和 `.crc`，文件 owner 是 app UID，未出现 `unavailablePersistSecurePort` 的 hydrate 日志。

## D-06：durability 实证

实现中的持久化 API 是 MMKV `store.sync()`，不是只写 README：

- `TerminalPersistKvModule.kt:27` write 成功后 sync；`:38` remove；`:68` writeMany；`:76` removeMany；`:96` clear；`:187` 首次 protected marker。
- 另用 release 中实际解析的 MMKV 2.4.2 native library 做两个独立 `app_process` 进程：第一个进程初始化 protected namespace、写入已知 sentinel 并 sync 后退出；第二个进程重新打开同 namespace 读回。输出为：

```text
MMKV_PROBE_INITIALIZED=true
MMKV_PROBE_PREEXISTING=false
MMKV_PROBE_PROTECTED_WRITE=true
MMKV_PROBE_PROTECTED_READBACK=true
MMKV_PROBE_PLAIN_CROSS_READ=MISSING
MMKV_PROBE_KNOWN_SENTINEL_RETAINED=true
```

随后第二个进程以正确 key 重开同 namespace，输出 `MMKV_PROBE_PREEXISTING=true`、`MMKV_PROBE_PROTECTED_READBACK=true`、`MMKV_PROBE_KNOWN_SENTINEL_RETAINED=true`。因此本批可支持“正常进程退出/重新打开可恢复”以及 `sync()` 对该路径的实证；不支持断电、内核崩溃、强机密性或 release crash recovery 的声称。probe 不是 public Expo API 测试，真实 Expo module load 已由上一节单独证明。

## D-09：身份与 mismatch 实证

source 事实：Kotlin 从 `Settings.Secure.ANDROID_ID` 派生 protected cryptKey，raw value 不经过 JS/log；当前 sample startup log 报 `deviceIdentityAvailable: true`。

最终采用的检测组合是 `MMKV.checkExist(namespace)` 加 protected marker：

- 新 namespace / 新 key：`MMKV_PROBE_PREEXISTING=false`，正确 cryptKey 写入 marker/sentinel 并读回成功。
- 已有 namespace / 不同前 16 字节的错误 cryptKey：

```text
MMKV_PROBE_INITIALIZED=true
MMKV_PROBE_WRONG_KEY_PREEXISTING=true
MMKV_PROBE_WRONG_KEY_INPUT_MATCHES_OBSERVED=false
MMKV_PROBE_WRONG_KEY_OBSERVED_LENGTH=16
MMKV_PROBE_WRONG_KEY_READ=MISSING
```

这表示 MMKV 看到既有文件但错误 key 读不到 marker；adapter 因 `existing=true` 且 marker 不是 `initialized` 返回 `PERSIST_KV_PROTECTED_KEY_MISMATCH`，不会把它当成新 namespace。probe 特意使用不同前 16 字节的错误 key：MMKV 2.4.2 的观察 key 长度为 16，前 16 字节相同的两个测试字符串实际不是有效的 wrong-key 对照；该早期 probe 结果已排除，未写入结论。

实际 module 反例另用精确文件替换验证：force-stop 后将 plain `.mmkv/.crc` 复制到 protected exact filename，release app 再启动；protected `listKeys` 返回 `PERSIST_KV_PROTECTED_KEY_MISMATCH`，JS 出现 `state.persistence.hydrate.failure`，并显示 protected storage unavailable；没有 plain fallback。恢复原 protected 文件后重新启动，plain/protected `listKeys/readMany` 均 succeeded。

这证明了“已有不可解文件”与“新建空 namespace”的分支和 typed 失败可见性。它不是把设备身份轮换直接注入 emulator 设置后的声称：该 emulator 的 settings API 作用域不会改变目标 app 的 app-scoped identity，本轮没有把身份轮换升级成 Android PASS。不可得 identity、低存储、真实硬件身份轮换仍未执行。

## 隔离与文件可读性

同一 persistenceKey/同一 logical key 的 plain/protected 在真实 app 和 native probe 中使用不同 namespace；plain cross-read 返回 `MISSING`，protected marker 与 user keys 不出 `listKeys`，一侧 clear 的实现只保留 protected marker。受控文件中 protected sentinel plaintext 检查为 `MISS`，plain control text 为 `HIT`。本批目标是 local obfuscation only，不宣称抗逆向。

## first failure / last known good

- first probe boundary：jar/classpath `app_process` ClassNotFound；之后 d8 因输出目录缺失失败；随后 dalvikvm 缺 Android Log JNI。新 release 重验时临时库首次命名为 `libmmkv-r2.so`，loader 明确报 `library "libmmkv.so" not found`；改为 exact `libmmkv.so` 后通过。诊断结果是运行时 classpath/native-loader 边界，不是 MMKV 数据失败。
- 另一次临时 probe 初次调用裸 `d8` 得到 shell `command not found`；按仓内 Android SDK 精确路径 `/Users/dexter/Library/Android/sdk/build-tools/36.0.0/d8` 重试，随后成功。没有通过延长等待掩盖失败。
- repair：创建 exact temporary output dir，改用 dex + release APK classpath 和 `app_process`/`LD_LIBRARY_PATH`；probe 成功并输出 initialization/write/readback/isolation/wrong-key 结果。
- last known good：release APK 安装后 module 四个 list/readMany success；错钥文件反例按预期 typed mismatch；恢复原 protected 文件后再次四个 operation success。
- broken boundary：本轮没有把 power loss、kernel crash、多进程、真机、低存储或逐项 D-05 public bridge invalid input 触发写成 PASS；native helper 的 D-05 向量已由 CP-1 unit 覆盖，这两档边界不可互相升级。

## cleanup

在结果读取后执行了精确 cleanup：

- `am force-stop com.anonymous.sampleterminal` 后 `pidof` 为空；
- `pm clear com.anonymous.sampleterminal` 返回 `Success`；
- 删除本轮 probe namespace 的 exact `.mmkv/.crc`、`ter-pkv-probe-r2.dex`、`ter-pkv-release-r2.dex`、`libmmkv.so`/临时同名变体、错钥 exact backup 文件和 probe root；
- 清除测试 settings 行，`TEST_ANDROID_ID_NOT_PRESENT`；
- `adb unroot` 后 `id` 为 `uid=2000(shell)`；
- probe namespace residuals 为 `0`，exact temp residuals 为 `0`，app PID 为空。

没有按端口、命令名或模糊 glob 停止进程；没有触碰后台 DEV、Web、seed、UAT 或部署。

## CP-4 结论和未覆盖档位

CP-4 的 release install/module load、双 mode hydrate、文件隔离、mismatch failure、正常进程重开 probe、日志和 cleanup 均有实际输出，并以 `cp4-raw-transcript-codex.md` 持久化了与 APK hash 绑定的脱敏原始片段，gate 为 MATCHED。Web、UI/visual、backend DEV、seed、UAT、native device（除本机 emulator 上的 native library probe）不在本 adapter 的通过矩阵；Android 真机、断电/内核崩溃、多进程、低存储、真实 identity rotation 和逐项 D-05 public bridge invalid input 仍未执行，不能写成 PASS。
