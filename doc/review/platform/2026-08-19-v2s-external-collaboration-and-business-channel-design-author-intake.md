REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_DESIGN_2026_08_19
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=AUTHOR_INTAKE_AFTER_CLAUDE_REVIEW
CLAUDE_SOURCE=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-claude.md
INDEPENDENT_SUBAGENT_SOURCE=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-rerun-execution-note.md
AUTHOR_INTAKE_STATUS=NOT_CLOSED
IMPLEMENTATION_AUTHORITY=false

# Claude 设计复核 finding 逐条 intake

本文件是作者对 Claude 静态设计复核的逐条辩证 intake，不是独立 reviewer verdict。每条 finding 均先重开原始规格、适用 project-memory、owning source 与当前设计，再标明处置分类；Claude 的 `NO-GO · M=1 · S=4 · N=5` 不被整包接受为新的事实。设计模型、owner、IA 和 E-33 的实质结论保持不变；本次只处理已确认的字面量、路径、domain、seed 设计和文档机械缺口。

## 已确认并已修复

| finding | 分类 | 处置与证据 |
| --- | --- | --- |
| M-1 contract literal drift | `CONFIRMED` | 按规格 §3.3/§5.4/§5.8 统一为 `GROUP_BUY`、`TAKEAWAY`、`INVENTORY_SYNC`、`TAKEAWAY_DELIVERY`、`LOCAL_ONLY`、`COMMERCIAL_GROUP`；实施详设的 contract/bindableNodeTypes/unbindKind、IA 节点路径、串行计划均已回读。见 `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md:94-117`、`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md:34,137`、`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md:136`。 |
| S-1 platform URL violates G-10 | `CONFIRMED` | platform-admin 页面统一改为 `/platform/external-collaboration`，集团空间由 WorkspaceScope 会话上下文提供；API 的 `groupWorkspaceKey` 约定未被连带修改；两份 Journey 补 G-10 命中表。见 `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md:64`、`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md:48`、`doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md:54-56`。 |
| S-2 acceptance domain placement | `CONFIRMED` | 设计改为实现期新增 `CollaborationAcceptanceScenarios.java` 与 `BusinessChannelAcceptanceScenarios.java`，并在当前 `BackendAcceptanceScenarioCatalog` 登记；未恢复 provider 壳、共享 SPI、退役 registry 或自动分母。见 `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md:394-413`、`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md:243-251`，现有 catalog 见 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java:10-17`。 |
| S-3 seed plan and fixture omissions | `CONFIRMED` | 设计新增本域目标 `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`；契约目录只读引用，不塞入 catalog-inventory seed；补齐五类节点、万象城海底捞三渠道/三绑定（两 `TAKEAWAY`、一 `GROUP_BUY`）及内部 `DINE_IN` 的 `POS`/`QR`/`KIOSK`。见 implementation design §7.4 与 serial plan CP-07。当前未创建、执行或修改 seed 脚本。 |
| N-1 count says ten | `CONFIRMED` | IA、交互工件与 Round 1 清单统一为十一个 surface/IA-ID；实数为 P1-P6 六个加 O1-O5 五个。见 IA:25、IA:57、UI interaction:417。 |
| N-2 IA naming form | `CONFIRMED` | 保留线框一一恒等映射的 P1-P6/O1-O5 局部别名，并在 IA 添加 IA_ID_NAMING_REASON；不将其带入 runtime/test。见 IA:26。 |
| N-4 dead API method | `CONFIRMED` | 删除 `markBindingsCascadeDisabled` 作为 command；明确绑定置灰是读取时派生显示态，不是存储状态。见 implementation design:198。 |
| N-5 dead interaction anchors | `CONFIRMED` | 两份 Journey 改用真实标题锚点 `#screen-p1外部系统接入配置树` 与 `#screen-o1项目经营渠道管理`；交互工件标题见 `...ui-interaction.md:43,197`。 |

## 保留为未闭合输入

| finding | 分类 | 当前结论与边界 |
| --- | --- | --- |
| S-4 design Round 1 independent subagent no return | `UNVERIFIED_REQUIRES_EVIDENCE` | 已按修复后清单重新派出 fresh Round 1；约四分钟内无 final message/findings，受控关闭并记录于 `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-rerun-execution-note.md`。本记录不提供 verdict；Claude review 不能替代 independent-subagent 留痕。 |
| N-3 Journey/线框的 Dexter confirmation | `DEXTER_DECISION` | 两份 Journey 已从 `DEXTER_ACCEPTED` 改为 `DRAFT_PENDING_DEXTER_WIREFRAME_REVIEW` / `DEXTER_PENDING`，保留 `WIREFRAME_REVIEW=UNSET`。需 Dexter 在提交线框时确认两份 Journey；Codex 不自行确认。见两份 Journey 第 3、16-17、70-71 行及交互工件第 415-418 行。 |

## 结论边界

- Claude 所说“模型、架构、IA 实质成立”的部分经逐点回读未发现需返工的反例；不因 finding 进行模型重写。
- 修复后的设计文档仍不能宣称 `GO`：缺少有效 independent-subagent Round 1 verdict，且 N-3 仍需 Dexter 确认。
- 本批仍未获得 implementation authorization；不执行生产源码、OpenAPI/生成物、migration、seed、reset、start/restart、DEV、L2、UAT、外部联调或 Git。
