# TER 固定逻辑画布 CP-5 阶段三维对账清单

STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP5_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-5
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY_REQUIRED

## 用途与轮次边界

本清单只控制 CP-5（Web dev-host 装饰盒、preview viewport 测量与现有预览几何
接线）的阶段实施对账。它不是 `REVIEW_TARGET=IMPLEMENTATION` 的正式对抗审查，
不使用正式 review cycle 的 `REVIEW_ROUND` 或 `REVIEW_ROUND_LIMIT`，也不受正式两轮
上限约束。每次出现可修复的 OPEN，主 agent 修复后必须重新召集 fresh、只读的
阶段 reviewer，直到所有本阶段可实施条目为 MATCHED。

Web preview policy（uniform contain、browser 非等比 stretch 或其它方案）仍是
Dexter 的外部裁决项。本阶段不得替 Dexter 选择该 policy；该项可记录为
`OPEN_BY_DEXTER_DECISION`，不把它伪装成实现完成，也不阻止不依赖该裁决的
preview viewport 与装饰盒工作继续。

## 输入清单

- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` 第 6.3 节。
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` 第 7 节。
- `doc/platform/terminal-coding-standard.md` 中适用的 Web/分层/测试约束。
- `apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts`。
- `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx`。
- `apps/terminal/ui/base/dev-host/test/surfacePreview.test.ts`。
- `apps/terminal/ui/base/dev-host/test/testExpoApp.test.tsx`。
- `apps/terminal/ui/base/dev-host/README.md`。
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`。
- `apps/terminal/ui/integration/sample-console/test-expo/App.tsx`。
- `apps/terminal/ui/integration/sample-console/test/testExpoApp.test.tsx`。
- `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` 的 CP-0A 至 CP-5 记录。

路径校对：`surfacePreview` 的 focused test 实际位于 `test/surfacePreview.test.ts`；不存在
`src/foundations/surfacePreview.test.ts`。后续记录必须使用实际路径，不把 test 文件误写到
foundation 目录。

## 本阶段对账条目

| ID | 要求 | 证据 | 结论 |
| --- | --- | --- | --- |
| CP5-01 | geometry 只读取方向分组后的固定 canvas declaration；不把 Web policy 改写成 package contract | 源码与 focused test | MATCHED |
| CP5-02 | preview viewport 由 SurfaceCanvas 内部无 border 节点实际测量；不使用 window 外框、固定高度或 canvas border 作为可用 rect | 源码、focused test、static | MATCHED |
| CP5-03 | canvas border 与 surface decoration 不侵入业务 InputSurfaceFrame 的测量盒 | 源码、focused test | MATCHED |
| CP5-04 | surface canvas 仍保持逻辑尺寸、排列与声明分离；装饰层不改变 layout box | 源码、focused test | MATCHED |
| CP5-05 | resize/双 surface 预览 geometry 的现有行为保持，且源码输出诊断包含 viewport、rect 与最终缩放事实；真实 payload 读取留给 CP-7 Web run | static、focused | MATCHED |
| CP5-06 | 已提供 policy-neutral 的逻辑点到 client 点映射纯函数与 focused 正/反例；真实 Web `elementFromPoint` 留给 CP-7，不以 transform 字符串或 outer box 单独证明命中 | focused、源码 | MATCHED |
| CP5-07 | Web preview policy 不自行裁决，明确保留为 `OPEN_BY_DEXTER_DECISION` | 详设、计划、README、证据 | OPEN_BY_DEXTER_DECISION |

## 出口规则

- CP5-01 至 CP5-06 必须在本阶段实现后由 fresh 独立子 agent 逐条核查；本轮已将
  可修复的实现与 focused 准备项闭合。CP5-05 的 dev-only 真实 payload、CP5-06 的
  `elementFromPoint` 真实命中属于 CP-7 动态 Web 证据，不在本阶段伪装成已运行。
- CP5-07 只允许保持 `OPEN_BY_DEXTER_DECISION`，不得写成 policy 已实现或 Web
  视觉验收已通过；它不因文字重写而变成 MATCHED。
- focused 结果只能证明 dev-host 自身逻辑/结构，不得写成真实 Web 运行结果。
- 本清单不放宽 CP-6/CP-7 的 Web dynamic、Android dynamic、全批对账或清理要求。
