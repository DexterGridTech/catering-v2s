# 当前源码 release 构建与 APK 绑定

DATE=2026-09-15
OWNER=main Codex
EVIDENCE_TIER=release/build
SOURCE_BOUNDARY=当前工作区源码；构建完成后未再修改生产源码

## 构建命令与结果

两个 App 分别串行执行：

```sh
(cd apps/terminal/assembly/android/sample-terminal/android && ./gradlew assembleRelease --no-daemon --rerun-tasks)
(cd apps/terminal/assembly/android/sample-wallpaper-terminal/android && ./gradlew assembleRelease --no-daemon --rerun-tasks)
```

两次均为 `BUILD SUCCESSFUL`，各自完成 588 个 Gradle task；Metro 分别加载 1408 与
1412 个 module。只出现 manifest provider replace 与 deprecated Gradle warning，没有构建
失败。构建进程均已结束；设备级进程和 cleanup 由各自受管 runner 的 manifest 单独记录。

## 当前 APK

| App | 相对路径 | sha256 | bytes |
| --- | --- | --- | ---: |
| sample-terminal | `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk` | `e985891e238e72a7ff68af44e93b1b6d7629df375e6759a16c83a3b67d9f8c94` | 87920433 |
| sample-wallpaper-terminal | `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk` | `0388b6f77b49841104cdd867103ceb641326b66279bc32af62f0e6021e8045dd` | 88329713 |

U8 与 sample2 当前旅途记录均保存了相同的 local/installed APK hash 与字节数；sample1
当前源码重跑也保存了相同 binding。这里证明的是 release 构建及文件/设备安装绑定，不
把它提升为 Web、visual 或整体 implementation acceptance。

## 首败边界

早期并发 release rebuild 的 `Storage already registered` 竞争仍保留在
`release-rebuild-concurrency-first-failure.md`；本次改为串行构建后两个 APK 均成功。
