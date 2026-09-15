# Release rebuild concurrency first failure

## 状态

本记录只保存一次并发 release 重建的首败与诊断边界，不把它计为源码或产品行为的失败，也不把后续串行成功反向改写成该次运行成功。

## 复现

在两个 Android App 目录同时执行：

```text
./gradlew assembleRelease --rerun-tasks --no-daemon --console=plain
```

分别对应：

```text
apps/terminal/assembly/android/sample-terminal/android
apps/terminal/assembly/android/sample-wallpaper-terminal/android
```

## 首败与边界

并发运行中一个 Gradle 进程在 `:catering-v2s-adapter-android-dual-screen:verifyReleaseResources` / `:expo-log-box:verifyReleaseResources` 附近退出；输出同时包含 Kotlin incremental cache 的 `Could not close incremental caches` 与 `Storage already registered`。另一进程仍继续推进，随后完成 Metro bundle、CMake/native 编译、资源处理和 APK 打包。

这使首败定位为两个 App 并发争用共享 Gradle/Kotlin/Expo 缓存的运行编排问题。它没有出现当前改动的 Kotlin/Java/TypeScript 编译错误；但该次并发运行的 business 结果不成立，不能用其残留/旧 APK 作为动态证据。

## 处置

主 agent 未重试并发组合；在受控进程结束后按当前运行归属确认无遗留构建 runner，再对两个 App 串行执行同一 release 命令。两次串行重建均到达 `BUILD SUCCESSFUL` 并生成当前 APK，后续动态记录必须重新写入 APK 相对路径、sha256、字节数和 mtime 绑定。

## 证据边界

本记录不证明 U8、U10、U13 或 sample2 完整 acceptance；这些结论只由各自最新、带 APK 绑定且包含 business/cleanup 的记录给出。旧的并发输出保留在本次执行返回中，任何后续报告不得把它压缩为无上下文的“构建失败”。
