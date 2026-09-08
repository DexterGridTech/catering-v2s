# TER CP-3 阶段三维对账独立复核清单

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP3_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-3
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY_REQUIRED
```

## 目的与边界

这是 CP-3 实施步骤的阶段三维对账，不是正式的 `REVIEW_TARGET=IMPLEMENTATION` 对抗
review cycle。它不登记 `REVIEW_CYCLE_ID`、不占用正式两轮上限；如果主 agent 修复后仍有
`OPEN`，可以再次召集 fresh reviewer，直到本阶段只剩 `MATCHED`。本复核只审 CP-3 的
固定逻辑 canvas、host viewport、独立 scaleX/scaleY、source 接线与 readiness，不提前审
CP-4 的 IME/scroll、不审 CP-5 的 Web policy、不审 portrait profile 或最终视觉验收。

reviewer 必须先独立读取需求、详设/计划、项目记忆约束、当前 CP-3 源码、测试和 evidence，
然后逐条输出 `MATCHED` 或 `OPEN`；不得修改文件、运行命令或把 focused/static 结果写成
Android/Web 运行结果。

## 必读输入

| 输入 | 仓库根相对路径 | 读取要求 |
| --- | --- | --- |
| 执行边界 | `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md` | 全文 |
| 当前实施授权与步骤 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` | 第 0-5 节及 CP-3 条款 |
| 实施详设 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` | §6、§8、§9.1-§9.2 及 host 相关条款 |
| 原始需求 | `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md` | surface、adapter、input 边界与失败恢复条款 |
| render host | `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`、`apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx` | 当前全文 |
| render entry | `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`、`apps/terminal/ui/base/render/src/types/props.ts`、`apps/terminal/ui/base/render/src/index.ts` | 当前全文 |
| sample wiring | `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | current declaration/source wiring 与 InputSurfaceFrame seam |
| Android wiring | `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`、`apps/terminal/assembly/android/sample-terminal/App.tsx` | host source owner 与业务边界 |
| Android source | `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts` | 当前 source interface 与 CP-2 fence |
| synthetic fixture | `apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts` | 仅核对 declared/measured fixture 数值，不能冒充设备证据 |
| focused tests | `apps/terminal/ui/base/render/test/renderSurface.test.tsx`、`apps/terminal/ui/base/render` package tests、sample/adapter focused tests | 当前全文及已产出结果 |
| 当前证据 | `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` | CP-3 最新结果与分档 |
| 项目规范 | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`、`doc/platform/implementation-task-template.md` | 阶段对账与正式 review 边界 |

## 逐条对账问题

1. render host 是否把 declaration 作为固定 canvas 的逻辑 width/height，host viewport 是否
   `flex:1` 填满父承载，transform 是否只有一处且为 top-left、独立 `scaleX` 与 `scaleY`；
   是否没有把 host snapshot 或 scale 传给 InputSurfaceFrame/业务 children。
2. scale 是否严格由同一 host source snapshot 的 stable logical size 除以 declaration 得到，
   两轴是否独立，非法/缺失 snapshot 是否返回 pending 而不是猜 declaration 或保留旧状态。
3. source readiness 是否在首次 ready、unavailable 事件与 stale 清空后均不渲染 canvas/keyboard
   依赖内容；无 source 的 Web 静态承载是否只是明确的 declaration identity mode，未擅自决定
   CP-5 preview policy。
4. sample assembly 是否只做结构性 host 注入，Android adapter 是否通过现有 source 接线，
   业务 feature 是否没有新增 Platform、Dimensions、density、screen-size 或 host scale 分支。
5. InputSurfaceFrame 是否仍由自身 `onLayout` 负责 measured frame；startup.surfaces 的
   measured 事件是否仍来自该真实 layout seam，而不是 declaration 自己回读。
6. `DisplayMode`、既有 display-context owner、TR-11 边界及公共 DevicePort/DisplayInfo/
   PlatformPortBindings 是否保持不变；是否没有第二 React host/bridge、Web policy 或 CP-4
   IME/scroll 的越界实现。
7. synthetic fixture 是否只同步到当前横屏 declaration/measured 数值，未改变事件顺序、
   startupRunId、sequence、终态或 descriptor 断言语义；CP-3 focused/typecheck 证据是否与
   Android/Web 动态证据分开，且没有把 render test 的 props/style 断言升级为真实视觉证明。
8. 当前 CP-3 为修复测试暴露的 render hook-order 问题（若纳入本步），该修复是否仅使 hooks
   无条件调用且保持 runtime-unavailable/container-empty 的可见行为不变；若发现其它预存改动，
   不得将其默认为本 CP 的实现证据。

## 输出格式

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP3_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-3
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=MATCHED|OPEN
OPEN_COUNT=<number>
```

每一条只写 `MATCHED` 或 `OPEN`，若为 `OPEN` 必须给出源码路径、行号、失败场景、影响面和
最小修复；不得输出正式 review cycle 的 `M/S/N` 结论，也不得宣称 CP-3 已进入下一步骤。
