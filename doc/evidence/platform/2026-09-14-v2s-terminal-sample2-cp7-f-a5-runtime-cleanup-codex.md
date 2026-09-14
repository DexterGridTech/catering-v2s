# TER sample2 F-A5_RUNTIME 本回合 cleanup

- `RUN_ID`: `ter-sample2-cp7-f-a5-runtime-20260914-01`
- `CLEANUP_SCOPE`: mobile `emulator-5556` 上 F-A5_RUNTIME storage-loss 变异、其自有 Metro
  session `94551` 与临时变异源码
- `CLEANUP_STATUS`: `PASS`
- `CLEANED_AT`: `2026-09-14 07:18 +09:00`

## 精确 readback

```text
serial=emulator-5554 package=com.catering.v2s.terminal.samplewallpaper pid=ABSENT
serial=emulator-5556 package=com.catering.v2s.terminal.samplewallpaper pid=ABSENT
owned Metro session=94551 stopped; terminal reported Stopped server
owned mutation source=restored; slice.ts wallpaperId descriptor has no shouldPersist override
runtime red outputs retained:
  /tmp/ter-sample2-cp7-f-a5-runtime-confirmed-5556.png
  /tmp/ter-sample2-cp7-f-a5-runtime-after-restart-5556.png
  /tmp/ter-sample2-cp7-f-a5-runtime-after-restart-5556.xml
  /tmp/ter-sample2-cp7-f-a5-runtime.log
```

冷启动 readback 显示认证态与 picker 仍在，但 `none` 被选中、w1 未选中且没有
`sample.wallpaper.background`，因此保留为 F-A5_RUNTIME 的 Android 红夹具证据，而不是把变异
结果写回源码。只停止了本 run 明确拥有且 identity 匹配的 sample2 app 与 Metro；未按端口、模糊
命令名或未知 PID 停止其他进程。
