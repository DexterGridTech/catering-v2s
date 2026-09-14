# TER Android persistKV / persistSecure CP-4 脱敏原始输出

```text
RUN_ID=TER_PKV_CP4_R2_20260913
RUN_DATE=2026-09-13
CAPTURE_KIND=SANITIZED_RAW_COMMAND_LOGCAT_PROBE_CLEANUP_TRANSCRIPT
PACKAGE=com.anonymous.sampleterminal
DEVICE=emulator-5554
MODEL=Pixel_Tablet
PRODUCT=sdk_gtablet_arm64
API=35
ABI=arm64-v8a
APK=apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk
APK_SIZE=87825831
APK_SHA256=9aabd0a27a9aae5d9991d9eecbf29b8c7754efb98e089f50931e706ee42bad92
SENSITIVE_DATA=raw ANDROID_ID, cryptKey, passwords and raw payloads omitted
```

本文件保留当前 Codex task 实际采集的 stdout/stderr、筛选后的 logcat、MMKV probe 和 cleanup 输出；只脱敏身份材料、口令及原始 payload，不把未执行边界改写成 PASS。它是 CP-4 的可独立重开 transcript，不能替代真机、断电/内核崩溃、多进程、低存储、identity rotation 或逐项 public Expo bridge invalid-vector 证据。

## 1. 设备、构建和安装

```text
$ adb devices -l
List of devices attached
emulator-5554    device product:sdk_gtablet_arm64 model:Pixel_Tablet device:... transport_id:...

$ ./gradlew :app:assembleRelease --no-daemon --stacktrace
BUILD SUCCESSFUL
581 actionable tasks: 62 executed, 519 up-to-date

$ adb install -r apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk
Performing Streamed Install
Success

$ adb shell pm clear com.anonymous.sampleterminal
Success
```

`transport_id` 和设备临时标识不影响 package/serial 归属；APK 的实际 size/hash 在本文件头固定，安装对象就是该 artifact。

## 2. release app module load / 双 mode hydrate

启动精确 package 后读取安全筛选的 logcat：

```text
ReactNativeJS: Running "main"
TerminalPersistKv: event=persist-kv operation=listKeys mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=readMany mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=listKeys mode=protected status=succeeded
TerminalPersistKv: event=persist-kv operation=readMany mode=protected status=succeeded
ReactNativeJS: sample.runtime-facts-resolved ... deviceIdentityAvailable: true
```

同一 app private MMKV 目录出现 plain/protected 各一个 `.mmkv` 和 `.crc`，没有 `unavailablePersistSecurePort` 的 hydrate 日志。日志未保留 raw identity、password、token 或原始 storage value。

## 3. MMKV 正常进程重开 probe（D-06）

首次运行使用 release artifact 中实际解析到的 MMKV 2.4.2 classes/native library；第一个进程初始化 protected namespace、写入已知非敏感 sentinel 并 `sync()`，第二个进程重新打开同 namespace：

```text
MMKV_PROBE_INITIALIZED=true
MMKV_PROBE_PREEXISTING=false
MMKV_PROBE_PROTECTED_WRITE=true
MMKV_PROBE_PROTECTED_READBACK=true
MMKV_PROBE_PLAIN_CROSS_READ=MISSING
MMKV_PROBE_KNOWN_SENTINEL_RETAINED=true
```

随后以正确 key 重新打开同 namespace：

```text
MMKV_PROBE_PREEXISTING=true
MMKV_PROBE_PROTECTED_READBACK=true
MMKV_PROBE_KNOWN_SENTINEL_RETAINED=true
```

这与源码中 `write/remove/writeMany/removeMany/clear/marker -> store.sync()` 一致，支持“正常进程退出/重新打开可恢复”这一冻结级别；不支持断电、内核崩溃或强机密性声称。

## 4. 错 key 与新 namespace 区分（D-09）

在已有 protected namespace 上使用与正确 key 前 16 字节不同的错误 key，`checkExist(namespace)` 与 marker 读取的 probe 输出为：

```text
MMKV_PROBE_INITIALIZED=true
MMKV_PROBE_WRONG_KEY_PREEXISTING=true
MMKV_PROBE_WRONG_KEY_INPUT_MATCHES_OBSERVED=false
MMKV_PROBE_WRONG_KEY_OBSERVED_LENGTH=16
MMKV_PROBE_WRONG_KEY_READ=MISSING
```

因此“新建空 namespace”分支是 `preexisting=false` 并写入 marker；“已有文件但当前 key 不匹配”分支是 `preexisting=true` 且 marker 不可读。早先使用相同前 16 字节的错误 key 试验被诊断为无效对照，未计入本结论。

## 5. 真实 Expo module 的 protected mismatch 反例与恢复

在精确 package 上先保存 protected namespace 的两个 exact 文件，再将 plain namespace 的对应文件替换到 protected exact filename，重启 app，读取安全筛选 logcat：

```text
TerminalPersistKv: event=persist-kv operation=listKeys mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=readMany mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=listKeys mode=protected status=failed code=PERSIST_KV_PROTECTED_KEY_MISMATCH
ReactNativeJS: state.persistence.hydrate.failure message protected storage identity does not match
```

没有出现 plain fallback。恢复原 protected 文件后重新启动：

```text
TerminalPersistKv: event=persist-kv operation=listKeys mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=readMany mode=plain status=succeeded
TerminalPersistKv: event=persist-kv operation=listKeys mode=protected status=succeeded
TerminalPersistKv: event=persist-kv operation=readMany mode=protected status=succeeded
```

备份文件与恢复后的 exact 文件 hash 对账：

```text
protected_mmkv_sha256=327f5799255276c5b42c1424caf3e2494dabf650ca6cff86e6806c79da47f38a
protected_crc_sha256=5c81ecd9e4a5fb3407631d01771423085dee0dcec8007a85f2e3b0423c427b06
restore_hash_match=true
```

## 6. 首败、边界诊断和修复

```text
first_probe_classpath=ClassNotFound
first_probe_d8=invalid_output_directory
first_probe_dalvikvm=UnsatisfiedLinkError(Android_Log_JNI_unavailable)
release_probe_loader_first=library "libmmkv.so" not found
```

第一组失败来自临时 probe 的 classpath、输出目录、运行时 JNI 和 native loader 边界，不是 MMKV 数据结论。诊断后使用精确临时输出目录、dex + release APK classpath、`app_process`，并把推送到设备的 native 文件名修正为 loader 要求的 exact `libmmkv.so`，上述 probe 随后成功。另一次裸 `d8` 命令不存在，改用仓内 Android SDK 的 `build-tools/36.0.0/d8` 后成功。所有失败均保留为 first-failure 诊断，不重命名为 PASS。

## 7. cleanup 原始结果

```text
$ adb shell am force-stop com.anonymous.sampleterminal
OK
$ adb shell pidof com.anonymous.sampleterminal

$ adb shell pm clear com.anonymous.sampleterminal
Success

probe_root_absent=0
probe_dex_absent=0
release_dex_absent=0
mmkv_lib_absent=0
backup_absent=0
probe_namespace_residuals=0
app_private_mmkv_files_after_pm_clear=0
package_pid_after_cleanup=
settings_test_android_id=TEST_ANDROID_ID_NOT_PRESENT
$ adb unroot
adbd is already running as non root
$ adb shell id
uid=2000(shell) gid=2000(shell) groups=...
```

cleanup 只针对本轮精确 package、probe namespace、精确临时文件和已保存的 exact backup；未按端口、模糊命令名或未知 PID 停止进程，也未触碰 backend DEV、Web、seed、UAT 或部署。

