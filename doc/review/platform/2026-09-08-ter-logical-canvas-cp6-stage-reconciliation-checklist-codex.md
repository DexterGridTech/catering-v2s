# TER 固定逻辑画布 CP-6 阶段三维对账清单

STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP6_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-6
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY_REQUIRED

## 用途与边界

本清单只控制 CP-6（文档、portrait OPEN 与测试基线回读）的阶段实施对账。它不是正式
`REVIEW_TARGET=IMPLEMENTATION` 对抗审查，不使用正式 review cycle 的轮次，也不受两轮
上限约束。每次发现可修复 OPEN，主 agent 修复后必须重新召集 fresh、只读阶段 reviewer；
直到本阶段所有可实施条目为 MATCHED。

Web preview policy 与 portrait target hardware profile 仍是 Dexter 外部决策项。它们可以
保留为 `OPEN_BY_DEXTER_DECISION`，但不能被文档改写、landscape 数字转置或窄窗结果伪装
成已完成。本 CP 只同步边界，不自行补产品决策。

## 输入清单

- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` 第 6.3、§10、§11 节。
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` 第 7 至 10 节。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md` 第 0.1、0.2、§2、§4、§5 节。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md` 第 6.2 节。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md` 第 4、§6 节。
- `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md` 第 1.1、§5.3、§9 节。
- `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md` 第 4.2、§7.2 节。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md` 全文；该文件是当前有效的 v2 implementation design，不得按历史材料跳过。
- `apps/terminal/adapter/android/dual-screen/README.md` 第 21 至 47 行。
- `apps/terminal/assembly/android/sample-terminal/README.md` 第 16 至 60 行。
- `apps/terminal/ui/base/dev-host/README.md` 第 17 至 30 行。
- `apps/terminal/ui/integration/sample-console/README.md` 第 13 至 49 行。
- CP-0A 至 CP-5 的原始证据：`doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md`。

## 对账条目

| ID | 要求 | 证据 | 结论 |
| --- | --- | --- | --- |
| CP6-01 | surface-form 的当前有效语义是固定逻辑 canvas 输入；0.1 旧解释、1157×723 与 962×541 只保留为 superseded 历史，不形成第二套有效基线 | 文档逐段回读、静态扫描 | MATCHED |
| CP6-02 | surface-form 的初始问题事实明确标为需求冻结/实施前事实；当前源码路径与 `InputSurfaceFrame.onLayout`、host viewport 接缝相符 | surface-form §2.1、current source | MATCHED |
| CP6-03 | keyboard requirements 与 input implementation plan/design 的高度计算以 `InputSurfaceFrame` 本地 logical frame 为输入；PRIMARY 1280×800 与 SECONDARY 1280×720 只作为 host canvas/容量表事实 | 文档逐段回读、静态扫描 | MATCHED |
| CP6-04 | old implementation plan/design 与 2026-09-06 v2 implementation design 的 assembly 路径、terminalSurfaces 路径与 input static-size 语义已与当前 source 对齐；不存在旧 `surfaceSize` 传递方案的有效描述 | 全部三份 implementation plan/design、source path scan、第二名 fresh 阶段 reviewer | MATCHED |
| CP6-05 | dual-screen README 明确目标 display density、owner-decorView-layout 与 per-surface host snapshot；不复制主 Activity density，不扩展公共 TS/port 面 | README、adapter source、CP-0 evidence | MATCHED |
| CP6-06 | dev-host README 明确 preview viewport 测量节点与 Web policy 待 Dexter 裁决；不把 uniform contain、browser stretch 或 width-only candidate 写成最终契约 | README、dev-host source/CP-5 evidence | MATCHED |
| CP6-07 | sample-console/sample-terminal README 的 source、assembly、host、adapter 边界与当前目录/入口一致；不引入业务层 scale/density/屏数判断 | README、source path scan | MATCHED |
| CP6-08 | portrait target hardware profile 未提供，O-01/F 维持 OPEN；不修改 landscape manifest/app.json 作为竖屏证据，不填转置数字 | 详设/计划、requirements、README 逐段回读 | OPEN_BY_DEXTER_DECISION |
| CP6-09 | 旧高度表按当前 host canvas 重新列为 PRIMARY 1280×800→320、SECONDARY 1280×720→320；公式文字不再把声明误作 input runtime source | implementation plan/design、keyboard requirements | MATCHED |
| CP6-10 | CP-0A 至 CP-5 的证据边界在当前 evidence 中仍分开：static/focused 与 Web/Android 未运行不得混称；CP-5 local scope 已闭合且 CP5-07 仍 OPEN | implementation evidence、CP-5 checklist | MATCHED |
| CP6-11 | 文档/源码扫描无未分类的旧有效基线、旧路径或 static-size bridge；历史 occurrence 必须有 superseded/实施前语义，且扫描分母包含 2026-09-06 v2 implementation design | 扩大后的 `rg` 原始输出、逐项分类记录、第二名 fresh 阶段 reviewer | MATCHED |
| CP6-12 | 当前 CP-6 修改通过格式检查；未修改源码、测试、依赖、Android 配置或 Web policy | `git diff --check` 与变更范围静态回读 | MATCHED |

## 出口规则

- CP6-01 至 CP6-07、CP6-09 至 CP6-12 必须由 fresh 独立阶段 reviewer 逐条核查；
  `CP6-08` 在 Dexter 提供 portrait profile 前只能保持 `OPEN_BY_DEXTER_DECISION`。
- 本清单的阶段对账不受正式 implementation review 两轮上限约束；修复任何本地 OPEN 后，
  主 agent 必须重新召集 fresh reviewer，不得用超时、轮次或总括结论关闭它。
- CP-6 不产生 Web/Android 运行通过结论。真实 logger、布局、命中、IME、滚动与 DCE 证据
  仍属于 CP-7；Web policy 与 portrait OPEN 不能被 CP-6 改写。
