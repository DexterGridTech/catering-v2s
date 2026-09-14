# TER sample2 F-A9_RUNTIME cleanup

- `RUN_ID`: `ter-sample2-cp7-f-a9-runtime-20260914-01`
- `CLEANUP_SCOPE`: mobile `emulator-5556` 上的 F-A9_RUNTIME 变异、sample2 app 与 TER 自有 Metro
  session `17085`
- `CLEANUP_STATUS`: `PASS`
- `CLEANED_AT`: `2026-09-14 07:30 +09:00`

## 精确 readback

```text
serial=emulator-5554 package=com.catering.v2s.terminal.samplewallpaper pid=ABSENT
serial=emulator-5556 package=com.catering.v2s.terminal.samplewallpaper pid=ABSENT
owned Metro session=17085 stopped; terminal reported Stopped server
temporary App/declaration/assembly mutations=RESTORED
post-restore node tools/terminal-sample2/check-behavior.mjs=PASS
```

本 run 只停止当前明确拥有且 identity 匹配的 sample2 app 与 Metro；没有按端口、模糊命令名或
未知 PID 停止其他进程。红夹具截图/XML/终端 transcript 保留在其 evidence 文档与列出的 `/tmp`
路径中。
