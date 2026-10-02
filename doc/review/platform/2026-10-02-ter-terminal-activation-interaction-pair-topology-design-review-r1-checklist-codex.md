# 独立 DESIGN 复核输入清单 · 第 1 轮

```text
REVIEW_CYCLE_ID=TER-ACTIVATION-INTERACTION-PAIR-TOPOLOGY-DESIGN-2026-10-02
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=先独立阅读授权、原始需求、规范、记忆与 owning sources 并形成初始 findings/verdict；之后才打开作者 Journey、IA、交互、详设和计划，逐项对照。
authorMaterialReadAfterIndependentVerdict=true
```

reviewer 为每行记录 `READ / NOT_READ / NOT_APPLICABLE_WITH_REASON` 与实际路径、命令或章节；不得把未读输入记为通过。记忆查询必须按项目记忆正本执行六维路由，保留查询参数、命中原文路径及命中是否适用。

| 类别 | 必须回读的输入 | reviewer 实际路径/命令与状态 | 说明 |
| --- | --- | --- | --- |
| 仓规 | `AGENTS.md` 全文 | 待 reviewer 记录 | 从仓根 |
| 仓规 | `CLAUDE.md` 全文 | 待 reviewer 记录 | 从仓根 |
| 仓规 | `PLATFORM-BLUEPRINT.md` 全文 | 待 reviewer 记录 | 从仓根 |
| 仓规 | `doc/platform/README.md`、`scripts/README.md` | 待 reviewer 记录 | 设计与验证入口 |
| 审查治理 | `doc/platform/review-standard.md`、`doc/platform/third-party-library-usage-standard.md`、`doc/decisions/2026-07-24-v2s-verification-governance.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | 待 reviewer 记录 | 包括两轮上限与最小输入 |
| 模板 | `doc/decisions/templates/implementation-design-template.md`、`ia-design-template.md`、`ui-interaction-design-template.md`、`journey-decision-template.md` | 待 reviewer 记录 | 逐节核对适用性与缺项 |
| TER 规范 | `doc/platform/terminal-coding-standard.md` TR-16、TR-17、§4-D、§4-E | 待 reviewer 记录 | 同场景 Web→VM 与拓扑词义 |
| 项目记忆 | `project-memory/index.md` 全部 kernel；`project-memory/decisions/deterministic-context-only.md` | 待 reviewer 记录 | 先直接读取 |
| 六维路由 | 按 `scripts/README.md` 与记忆工具帮助运行本任务六维 `scripts/memory/query`/`scripts/context/recall-memory`；记录六维参数与所有命中原文 | 待 reviewer 记录 | 不得把 index 当 memory anchor |
| 业务语汇 | `project-memory/decisions/confirmed-business-language-corpus.md`；检索词：终端、激活、会员、双机、主机、副机、服务空间、代理、壁纸、店员、顾客 | 待 reviewer 记录 | 写明命中条目及“不得推导”；无命中须记 `NO_CORPUS_ENTRY_MATCHED` 与检索词 |
| Dexter 授权 | 当前会话专项设计指派及用户对线框整体方向的回答 | 待 reviewer 记录 | 接受范围仅整体方向，不代表逐屏细节或动态验证通过 |
| 正式需求 | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md` 全文 | 待 reviewer 记录 | 独立建立需求判据 |
| 需求讨论/评审 | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md` §9 用户原话；`doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r1-codex.md` 与 `...requirements-review-intake-codex.md` | 待 reviewer 记录 | 需求结论仅为来源，不继承实现/运行结论 |
| 既有裁决 | `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`、`doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md` 及 `doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md` 全文 | 待 reviewer 记录 | 旧判据若被新正式需求取代，写明准确范围 |
| decisions 目录 | `doc/decisions/` 文件标题清单 | 待 reviewer 记录 `rg --files doc/decisions` 命令与结果 | 选出相关 decision 并打开全文；不把无关决策当作输入 |
| 候选组件/代码 | `apps/terminal/ui/integration/sample-console`、`sample-wallpaper-console`；`terminal-data-client`、`server-config`、`transport`、`topology`、`sample-staff-session`、`sample-member-registry`、`sample-wallpaper`、admin-shell、sample UI feature 的 package/API/owner/source/tests | 待 reviewer 记录 | 以原始需求中的源引用与当前 `rg` 结果为准；主动找更小复用反例 |
| 候选组件/代码 | Device/Display platform ports、Android 与 Expo Web composition、当前 Testcontainers/DEV/VM 入口（如进入设计路径） | 待 reviewer 记录 | 只静态查看，不运行 |
| 作者 Journey | `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md` 全文 | 待 reviewer 记录 | 仅在初步 verdict 后打开 |
| 作者 IA | `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md` 全文 | 待 reviewer 记录 | 仅在初步 verdict 后打开 |
| 作者线框 | `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md` 全文 | 待 reviewer 记录 | 仅在初步 verdict 后打开；核26 screen及所有交互 |
| 作者详设 | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md` 全文 | 待 reviewer 记录 | 仅在初步 verdict 后打开 |
| 作者计划 | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md` 全文 | 待 reviewer 记录 | 仅在初步 verdict 后打开 |
| 证据边界 | 上述材料中引用的实际锁定依赖版本、官方资料、历史/静态/未运行证据 | 待 reviewer 记录 | 第三方行为无直接依赖时须判断 N/A 是否有具体理由；不得把规划状态升级为 PASS |

## Reviewer 回传格式

1. 先回传独立初始 `GO / NO-GO`、`M/S/N` 与初始 findings；此时不得读取作者详设/计划/IA/线框。
2. 再阅读作者产物，回传逐条 finding intake：原判据、性质、路径与行号、前提、反例、最小修正、是否需 Dexter 裁决。
3. 给整批 DESIGN `GO / NO-GO`、`M/S/N`；明确动态验证全为计划/NOT_RUN、用户已接受范围以及不等于逐屏接受的边界。
4. 禁止写文件、运行构建/测试/verify、启动设备/服务或触碰任何受管环境。
