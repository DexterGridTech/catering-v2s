# TER CP-2 fresh independent review checklist

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-2
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_EXPECTATION=FRESH_READ_ONLY

## Blind-review boundary

这是 CP-2 步骤结束后的独立静态对账与证伪审查。审查者不得修改任何文件，不得运行命令、
构建、安装、启动 Android/Web 或把 evidence 文档中的作者摘要当成源码事实。先从当前源码和
原始详设/计划反向寻找会让 CP-2 规则假绿、串屏、泄漏旧事实或扩大公共契约的反例，再阅读
Codex 的 CP-2 evidence。审查范围只到 per-surface host snapshot/source，不审 CP-3 的 canvas
transform、CP-4 的 IME logical conversion/scroll、CP-5 的 Web policy。

## Required inputs

1. `AGENTS.md`
2. `PLATFORM-BLUEPRINT.md`
3. `doc/platform/roadmap-program-registry.json` 及当前 TER 授权字段
4. `project-memory/index.md` 与本任务命中的 deterministic context / terminal design memory
5. `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`
6. `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md`
7. `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
8. `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt`
9. `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt`
10. `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts`
11. `apps/terminal/adapter/android/dual-screen/src/index.ts`
12. `apps/terminal/adapter/android/dual-screen/test/surfaceHost.test.ts`
13. `apps/terminal/adapter/android/dual-screen/README.md`
14. `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` 的 CP-2 节

## Questions that must be answered

- 是否真的按既有 PRIMARY/SECONDARY 值逐 surface 建立独立 entry；是否可能以全局 current display、
  主屏尺寸或旧 entry 冒充副屏？
- stable/current bounds 与 density 是否来自同一实际 owner `decorView` layout snapshot；是否把
  `createSurfaceContext` 的 density override 错用到 host measurement？是否保留了副屏 density 修正？
- CP-0 选定的 edge-to-edge/current-not-shrinking 分支是否被实现，而不是保留互斥分支或偷偷引入
  `maximumWindowMetrics`？IME 更新是否只改变 IME 字段而不重算 stable host size？
- Activity、Presentation、destroy/remove 与 publisher 的生命周期是否可能产生幽灵 snapshot、
  stale generation 或清理错误的另一块屏幕？
- Expo AsyncFunction/Events 是否复用现有 module/bridge，且没有扩展 DevicePort、DisplayInfo、
  PlatformPortBindings 或创建第二 React host？
- JS source 是否对 surface key、window identity、display id、generation、bounds、density 做
  真实拒绝；是否存在 malformed event / wrong display / unavailable / async initial snapshot 的
  顺序漏洞？focused mock test 是否只是协议形状而非被误写成 Android 运行证据？
- README、evidence、详设/计划的边界是否一致，是否误把 CP-2 说成 canvas transform、Web policy、
  IME 单位或最终业务视觉已完成？

## Report format

输出必须包含：

```text
REVIEW_CYCLE_ID=...
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-2
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
VERDICT=GO|NO-GO
M/S/N=...
```

每个 finding 必须标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，给出仓库根相对路径、行号、失败场景、
影响面、最小修复与是否需要 Dexter 裁决。没有 finding 才可报告 `CP-2=MATCHED`；不得把
作者 session 的 `CP-2_STAGE_RECONCILIATION=MATCHED` 当作独立审查结论。
