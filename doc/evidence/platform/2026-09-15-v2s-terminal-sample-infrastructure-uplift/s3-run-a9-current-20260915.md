# S-3：`run-a9-runtime.mjs` 当前源码探针

DATE=2026-09-15
REVIEW_TARGET=IMPLEMENTATION
COMMAND=`node tools/terminal-sample2/run-a9-runtime.mjs --serial emulator-5556 --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/s3-run-a9-current-20260915`
SOURCE_SCOPE=current working tree at invocation; the runner restored both temporary mutations
PROBE_RESULT=FAILED
S3_DECISION=UPGRADE_TO_NEW_RELEASE_RUNNER

## 事实记录

本次按需求要求实际运行已有 `tools/terminal-sample2/run-a9-runtime.mjs`，没有把旧记录
`s3-run-a9-probe.md` 当作当前证据。runner 的实际输出为：

```text
SAMPLE2_F_A9_RUNTIME=NOT_RUN CLEANUP=FAIL OUTPUT=doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/s3-run-a9-current-20260915
```

结果文件中的首败为：

```text
A9 mutated SECONDARY surface readback: timed out; logBytes=0
```

`a9-mutated-metro-filtered.log` 和最终 `a9-metro-filtered.log` 均为空，因此没有取得
SECONDARY surface 的有效 runtime readback、UI dump 或截图，业务证据保持 `NOT_RUN`。

runner 的恢复路径又等待恢复后的 PRIMARY 读回，因同样没有日志而超时，导致它在该异常
路径上没有执行自己的尾部 package/reverse cleanup；这解释了结果文件中的
`cleanup=FAIL`，不是把资源状态误判为已清理。

## 受控 cleanup 回读

首败后只对本 runner 明确拥有且已由进程/设备回读确认的对象执行清理：

```text
adb -s emulator-5556 shell am force-stop com.catering.v2s.terminal.samplewallpaper
adb -s emulator-5556 reverse --remove tcp:8081
```

随后回读结果：

- `pidof com.catering.v2s.terminal.samplewallpaper` 无输出；
- `adb -s emulator-5556 reverse --list` 只剩既有的 `host-16 tcp:8091 tcp:8091`，本次
  `tcp:8081` 已消失；
- `run-a9-runtime.mjs`、其 yarn/Expo Metro 子进程均已退出；
- runner 的两处临时源码 mutation 已由 `finally` 恢复。

因此本次运行的业务结论是 `NOT_RUN`，runner 自身 cleanup 是 `FAIL`；后续 owner-scoped
cleanup 回读为 `PASS`，二者分开记录，不把后者改写成 runner 的原始结果。

## S-3 能力判断

该先例不能作为最终 release/双屏冷启动 runner，理由均来自当前脚本源码和本次实际运行：

1. 只启动 `yarn ... start` 的 Metro 开发服务，没有 release APK 构建、APK sha256 绑定或
   release 安装证明；
2. 只有一个 `--serial`，目标固定为 `emulator-5556`，没有第二个双屏设备/物理表面入口；
3. 通过改写 `App.tsx` 和 `terminalSurfaces.ts` 制造变异，且只等待 mobile SECONDARY，再
   恢复后只等待 PRIMARY；它不是不改变源码的 release 双形态冷启动观察；
4. 观察面只有 Metro 过滤日志、UI dump 和截图，没有 U8 所需的冷启动时序：首个 RN 内容
   `t0`、开机画面当时状态、`ready-candidate`、`startup.complete`、`ready-hidden`、
   failure page 及 settled 状态；
5. 本次真实结果已经证明其最窄的 SECONDARY 变异读回路径也以空日志超时结束，并且异常
   分支的 cleanup 需要外部 owner-scoped 收尾。

据此按已定裁定④升级为新建/使用 `tools/terminal-sample2/run-u8-release-cold-start.mjs`
作为正式 U8 record-only runner；不再向旧 `run-a9-runtime.mjs` 增加 release、双屏和时序
职责。旧先例只保留为 supporting probe，不能支撑 native、Android、release、visual 或
整体 implementation acceptance PASS。

