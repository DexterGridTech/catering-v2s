# 当前源码与既有动态产物的边界

DATE=2026-09-15
SCOPE=TER sample infrastructure uplift
STATUS=OPEN_CURRENT_DYNAMIC_REBUILD_REQUIRED

## 结论

仓内已有若干名为 `current` 或 `final` 的 release/U10 记录，但它们不能直接作为
本轮当前源码的动态证据。只读时间核验显示，本轮源码修复发生在这些 APK 生成之后：

```text
find apps/terminal -type f -newer apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk ...
find apps/terminal -type f -newer apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk ...
```

两份 APK 的既有 binding 分别记录为：

- `u8-release-cold-start-current-rerun-04/sample-terminal-apk-binding.json`
  （APK mtime 约为 14:25 +09:00）；
- `u8-release-cold-start-current-rerun-04/sample-wallpaper-terminal-apk-binding.json`
  （APK mtime 约为 14:29 +09:00）。

当前源码中在上述时间之后仍有生产代码变化，包括 `platform-ports` descriptor、双屏
surface host、native loading、两个 MainActivity、assembly/base/android 和 focused
测试等路径。因此既有 PASS 只能作为历史 supporting evidence；不能关闭当前 release、
Android、U8、U10 或整体 implementation acceptance。

## 首败 / 边界 / 最后已知好

- `FIRST_FAILURE`：当前源码没有一份经强制重建并绑定的 release APK 动态记录。
- `BROKEN_BOUNDARY`：当前源码字节 → release APK binding；既有设备结果在该边界之前。
- `LAST_KNOWN_GOOD`：旧 binding 对应的 release/supporting run，不能覆盖当前源码。
- `CLEANUP`：既有记录各自有 cleanup，但这不替代下一次当前源码 run 的 cleanup。

## 处置

全批 fresh 三维对账完成后，必须对当前源码执行强制 release rebuild，重新写入 APK
sha256/binding，再运行目标设备观察。未完成前，设计、计划和 handoff 均保持
`release_OPEN`，不把旧目录名中的 `current` 当作事实。
