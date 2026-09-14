# TER sample2 CP-7 本回合 cleanup

- `RUN_ID`: `ter-sample2-cp7-20260914-01`
- `CLEANUP_SCOPE`: 本回合 sample2 Android app 与本回合 Metro session
- `CLEANUP_STATUS`: `PASS`
- `CLEANED_AT`: `2026-09-14 02:35 +09:00`

## 精确 readback

```text
owned_android_packages
serial=emulator-5554 sample2_pid=ABSENT
serial=emulator-5556 sample2_pid=ABSENT
owned_local_processes
Metro session=14188 STOPPED
owned sample-wallpaper-terminal process=ABSENT
```

只对本 run 明确拥有的 Android package 和 Metro session 执行停止与 readback。系统中其他
Node 进程未按端口、命令名或模糊匹配停止，也不纳入本 run 的 owned process。
