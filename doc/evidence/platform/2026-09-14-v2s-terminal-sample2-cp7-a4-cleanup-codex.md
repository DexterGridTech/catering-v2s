# TER sample2 CP-7 A4 本回合 cleanup

- `RUN_ID`: `ter-sample2-cp7-a4-20260914-01`
- `CLEANUP_SCOPE`: laptop `emulator-5554` 的 sample2 authenticated-cold A4 run、mobile
  `emulator-5556` 的同包残留检查，以及本回合 TER 自有 Metro。
- `CLEANUP_STATUS`: `PASS`
- `CLEANED_AT`: `2026-09-14 03:21 +09:00`

精确 readback：

```text
serial=emulator-5554 package=com.catering.v2s.terminal.samplewallpaper pid=ABSENT
serial=emulator-5556 package=com.catering.v2s.terminal.samplewallpaper pid=ABSENT
owned Metro command tree (sample-wallpaper-terminal, yarn start --clear --port 8081)=ABSENT
source mutation state=RESTORED
```

本回合只停止了本 run 明确拥有的 sample2 package 与 Metro 会话；未按端口、模糊命令名或
未知进程身份停止其他对象。A4 业务证据与 cleanup 分开记录，cleanup PASS 不提升 A4、Web、
release 或完整 visual 档位。
