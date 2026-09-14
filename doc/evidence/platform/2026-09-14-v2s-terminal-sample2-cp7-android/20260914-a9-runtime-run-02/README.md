# sample2 F-A9 runtime mutation

- `RUN_ID`: `ter-sample2-cp7-f-a9-runtime-20260914-02`
- `DEVICE`: `emulator-5556`
- `RUNNER`: `tools/terminal-sample2/run-a9-runtime.mjs`
- `RESULT`: `SAMPLE2_F_A9_RUNTIME=PASS`, `CLEANUP=PASS`

临时让 mobile 入口请求 `displayIndex=1` 并走 SECONDARY 声明；过滤后的 Metro 日志记录真实
`surface-created` 与 `render.surface-root-mounted` 的 `displayMode=SECONDARY`。runner 随后恢复
源码、重新验证 PRIMARY，并清理精确 package、adb reverse 与 Metro。结果详见
`a9-runtime-result.json`，不代表真实 mobile 设备拥有副屏。
