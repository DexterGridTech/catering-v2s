# TER 固定逻辑画布 CP-0A 独立审查输入清单

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-0A
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
MAIN_SESSION_FRESH=false

审查者必须在 fresh 子 agent 上下文中先尝试证伪 CP-0A 的材料同步与三项实施前修复，
先形成 findings/verdict，再读取作者自审或处置结论。审查者只读，不得修改任何文件，
不得运行 Android、Web、DEV、seed、UAT 或部署。

## 必读输入

| 输入 | 路径或命令 | 要求 |
| --- | --- | --- |
| 执行入口 | `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md` | 完整读取 |
| 当前授权 | `doc/platform/roadmap-program-registry.json`、Registry 选出的 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | 读取授权字段；Dexter 当前会话授权是本 CP 的实施边界 |
| 六维记忆路由 | `scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face platform-admin --owner frontend-platform --impact runtime --trigger implementation` | 运行并逐个读取全部 kernel 与全部 routed hit |
| 终端架构与规范 | `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/operations/terminal-coding-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/foundation-charter.md` | 完整读取相关判据 |
| 证据与阶段纪律 | `project-memory/kernel/05-evidence-runtime-and-git.md`、`project-memory/operations/execution-economics-and-failure-family-closure.md`、`project-memory/operations/phase-retrospective-and-systemic-repair.md`、`project-memory/operations/test-closed-loop.md`、`doc/platform/review-standard.md` | 完整读取 |
| 本批详设 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` | 完整读取并从源码锚点推导预期 |
| 本批计划 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` | 完整读取并核对 CP-0A 出口 |
| 上游需求 | `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`、同目录 keyboard redesign requirements 两份、`doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md`、同目录 implementation plan 与 surface-and-keyboard implementation design | 完整读取 CP-0A 范围 |
| README | `apps/terminal/adapter/android/dual-screen/README.md`、`apps/terminal/ui/integration/sample-console/README.md`、`apps/terminal/ui/base/dev-host/README.md` | 完整读取并核对旧语义是否仅为 retired/OPEN |
| CP-0A 记录 | `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` | 在形成初步判断后读取；核对记录是否把静态结论冒充动态证据 |
| 当前源码事实 | sample-console package/parser/entry、dev-host host、input、Android dual-screen adapter | 只用于确认 CP-0A 未越界到 CP-1/CP-0 |

## 盲审要求

必须逐条证伪：

1. S-1 是否已经从恒真 ratio 改成跨源 density 与独立 owner decorView logical bounds 对账；
2. S-2 是否说明 `TYPE_APPLICATION` measurement context 的边界，并要求与真实 owner 非 IME decorView 交叉核对；
3. S-3 是否把 `sample-console/src/index.ts` 与 `sample-console/test-expo/App.tsx` 纳入 CP-1 分母和允许变更闭包；
4. 旧 `1157×723`、`962×541` 是否只剩明确退役/待 CP-1 同步语义；Web policy 与 portrait 是否仍是 OPEN；
5. CP-0A 是否只完成材料权威性同步，没有把 package/source 旧值、P-01..P-05、编译或运行写成 PASS；
6. 是否出现遗漏的同根旧基线、隐含第二套尺寸真相、未授权公共契约变更或 CP-0A 后提前进入代码实施。

输出只能对 CP-0A 给 `MATCHED` 或逐项 `OPEN`，并标注 `CONFIRMED`、
`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或
`DEXTER_DECISION`；不要修改文件。

## Blind-review declaration

I received this checklist in a fresh subagent context, tried to falsify the reviewed implementation
step, and formed findings and verdict before reading the author self-review or author disposition.
I treated every missing pointwise prewrite/post-proof reread or substituted static/runtime evidence
as a finding; a general preparation pass did not substitute for CP-0A source reconciliation.
