# TER sample2 F-A9_RUNTIME 真实 Android 红夹具（当前字节）

```text
RUN_ID=ter-sample2-cp7-f-a9-runtime-20260914-02
DEVICE=emulator-5556
PHYSICAL_DISPLAY=720x1280
MOBILE_CANVAS=360x640 portrait
PACKAGE=com.catering.v2s.terminal.samplewallpaper
RUNNER=tools/terminal-sample2/run-a9-runtime.mjs
RESULT=SAMPLE2_F_A9_RUNTIME=PASS
CLEANUP=PASS
OUTPUT=doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-a9-runtime-run-02
```

## 变异边界

这是一个可重复的 runtime mutation，不把原始 guard-only F-A9 变异改名为成功。runner 临时：

- 将 `apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx` 的生产入口请求
  `displayIndex=1`；
- 让 `apps/terminal/ui/integration/sample-wallpaper-console/src/application/terminalSurfaces.ts`
  的 mobile 声明走 landscape/SECONDARY；
- 保持其它变异范围与当前 F-A9 runtime 设计一致，使禁止的 SECONDARY surface 能在真实 mobile
  入口到达。

所有临时源码变更由 runner 在退出前恢复，并用恢复后的启动/readback 完成边界检查。

## 真实输出

`a9-runtime-result.json`：

```json
{"runId":"ter-sample2-cp7-f-a9-runtime-20260914-02","serial":"emulator-5556","packageName":"com.catering.v2s.terminal.samplewallpaper","port":8081,"mutation":"mobile App displayIndex=1 plus mobile declaration reuses landscape SECONDARY","business":"PASS","cleanup":"PASS","firstFailure":null}
```

`a9-mutated-metro-filtered.log` 含两条承重事件：

- `surface-created`: `displayIndex=1`, `displayMode=SECONDARY`, `surfaceForm=mobile`；
- `render.surface-root-mounted`: `displayMode=SECONDARY`。

这证明恶意实现已经在真实 mobile runtime 创建并挂载了 A9 禁止的 SECONDARY surface。真实设备
本身没有副屏，placement 仍记录 `secondaryAvailable=false`；这不影响 mutation 已到达入口/渲染
路径的结论，也不被误写成真实副屏业务成功。

## 恢复与 cleanup

- `a9-restored-metro-filtered.log` 证明源码恢复后的入口回到 `displayIndex=0`/PRIMARY。
- `a9-mutated.xml`、`a9-mutated.png`、两份过滤日志与 `a9-runtime-result.json` 均在上述仓内
  output 目录；不依赖 `/tmp`。
- runner 精确停止拥有的 package、移除 adb reverse、终止自有 Metro，并验证 package absence；
  cleanup=PASS。

该证据只关闭补充 F-A9 runtime red fixture 的可证伪性，不关闭 A1-A9 全量动态矩阵、Web、
release、native 真机或 visual acceptance。
