# TER 固定逻辑画布 CP-0 独立对账清单

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-0
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
READ_ONLY=true

## 输入清单

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、当前项目记忆中与
   terminal architecture、verification、runtime/evidence、test closed-loop 相关的原文。
2. `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`。
3. `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` 的
   CP-0、全局停止条件与证据要求。
4. `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` 的
   CP-0A 与 CP-0 P-01 至 P-05 记录；把 `/tmp/ter-cp0-final.log`、
   `/tmp/ter-cp0-probe-primary.png`、`/tmp/ter-cp0-secondary.mp4` 的存在/内容仅作为作者提供的
   原始证据路径，不能把摘要当成运行事实。
5. `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`、
   `TerminalDualScreenModule.kt`、`TerminalImeInsetsCoordinator.kt`。
6. `apps/terminal/assembly/android/sample-terminal/App.tsx`、
   `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx`。
7. RN 0.86.3 的 `ReactSurfaceImpl.kt`、`ReactSurfaceView.kt`、`ReactSurface.kt`。

## 必须证伪的断言

- P-01：branch 2 是否由同一次真实 Android run 的 owner decorView 与 IME/inset 前后日志支持；
  display 0/2 的 density 是否是独立事实；是否错误使用由同源数值构造的恒真配对比值。
- P-02：fixed child 是否真实完成 primary/secondary layout；是否把临时 probe 的结构日志写成生产
  host 已经实现。
- P-03：`scaleX=0.7` 与 `scaleY=0.5` 下是否有真实视觉证据和真实 primary/secondary tap；
  virtual display 截图能力失败是否被如实限定。
- P-04：onLayout/measureLayout 是否只提供 content-local 位置，currentOffset/contentOffset 是否
  同坐标；measureInWindow 的 transformed delta 是否被正确排除。
- P-05：同一 JS runtime 的 process-global `PixelRatio=2` 是否被正确识别为禁止依赖的全局值，
  而不是误写成 secondary 的 per-surface density；display/window identity 是否可追踪。
- 临时 `DebugSurfaceProbe.tsx` 是否已删除，`App.tsx` 是否恢复，是否越过 CP-0 授权边界。
- evidence 每个 `MATCHED` 是否有对应原始输出；缺失、静态推断、模型红向量或截图限制不得伪装为
  Android/Web 生产结论。

## 输出

独立报告必须声明本文件的全部元数据，给出 `VERDICT=GO|NO-GO`、`M/S/N`，逐条 finding 使用
`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或
`UNVERIFIED_REQUIRES_EVIDENCE`，带仓库相对路径、行号、失败场景、影响面、最小修复；最后给出
`CP-0=MATCHED|OPEN`。不得修改文件、不得代写修复、不得把作者的预先 `CP-0_STATUS` 当作独立结论。
