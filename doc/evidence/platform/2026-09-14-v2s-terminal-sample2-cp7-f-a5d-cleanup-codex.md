# TER sample2 F-A5d 本回合 cleanup

- `RUN_ID`: `ter-sample2-cp7-f-a5d-20260914-01`
- `CLEANUP_SCOPE`: F-A5d 真实 Android mutation 的 sample2 app 与本回合 Metro
- `CLEANUP_STATUS`: `PASS`
- `CLEANED_AT`: `2026-09-14 02:52 +09:00`

## 精确 readback

```text
serial=emulator-5554 sample2_pid=ABSENT
serial=emulator-5556 sample2_pid=ABSENT
owned Metro process tree (yarn start --clear --port 8081)=ABSENT
owned mutation source=restored
```

只对本回合明确拥有且通过完整命令身份核对的 sample2 app 与 Metro 进程执行停止与 readback；
未按端口、模糊命令名或未知 PID 停止其他本机进程。F-A5d 的持久化输出保留在
`/tmp/ter-sample2-cp7-f-a5d-after-restart.mmkv`，供 review 复核，不作为运行对象继续使用。
