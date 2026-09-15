# S-3：`run-a9-runtime.mjs` 先例核验

- 日期：2026-09-15
- 命令：

```text
node tools/terminal-sample2/run-a9-runtime.mjs --serial emulator-5556 --output doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-a9-runtime-probe-01
```

- 历史结果：`SAMPLE2_F_A9_RUNTIME=PASS CLEANUP=PASS`（旧 runner 的原始记录仍保持不变）。
- 原始记录：
  `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-a9-runtime-probe-01/`

## 观察到的边界

原 runner 使用 Metro/debug、单一 sample-wallpaper App 和移动设备；它用源码 mutation
把 mobile App 的 `displayIndex` 改成 1，并把声明改成 landscape `SECONDARY`。记录里仍是
手机屏幕和单一设备，没有 release APK、真实双屏冷启动、两 App profile、SplashScreen
可见/收起的窗口时序或 R-S7 failure-page 观察。

当前字节上的复跑先遇到旧 mutation anchor 过时，修复 anchor 后又在
`A9 mutated SECONDARY surface readback` 超时且 `logBytes=0` 处首败；对应记录为
`a9-runtime-current/` 与 `a9-runtime-current-rerun-01/`，两次均未形成 business PASS，且
cleanup 已按当前 runner 归属单独诊断并完成受控清理。故旧 PASS 只能作为历史 supporting
evidence，不能覆盖当前 probe 的首败。

因此本次按详设裁定④把 U8 升级为新的
`tools/terminal-sample2/run-u8-release-cold-start.mjs` record-only runner。该判断不是
根据旧脚本名字推断，而是由历史与当前两组实际命令、输出目录中的 logcat/UI/screenshot/
result.json 共同支持；旧 runner 仅保留为 supporting probe。
