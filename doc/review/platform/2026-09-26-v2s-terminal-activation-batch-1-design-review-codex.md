# 终端激活与长连接 · 批次一详设与计划复核

```text
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-1-DESIGN-2026-09-26
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=AUTHOR_INTAKE_AFTER_INDEPENDENT_SUBAGENT
INDEPENDENT_REVIEWER=INDEPENDENT_SUBAGENT:batch1_design_round2_fresh
ROUND_FINAL_DECISION=SELF_DECIDED
ACTION_1_VARIANT=1-B 文档提取
INDEPENDENT_VERDICT=GO
INDEPENDENT_M/S/N=0/0/0
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
EVIDENCE_TIER=STATIC_SOURCE_ONLY
```

## 结论

独立 reviewer 最终结论为 `GO`, `M/S/N=0/0/0`。作者辩证 intake 接受其设计就绪结论，并按 `doc/platform/review-standard.md` §1/§5 对 UI-bearing 范围补足未验证清单，最终记为 `GO_WITH_UNVERIFIED_UI`, `M/S/N=0/0/0`。这表示详设与实施计划可交 Claude 独立评审；TER-E01 实际渲染及运行证据尚未产生。没有第三轮，也没有需要 Dexter 裁决的新事项。

## 固定 verdict block

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS — 本轮是设计与计划静态复核；未发现范围、owner、契约或证据表述 finding。
L2_USER_VISIBLE=PASS — D-18 的创建态可选、编辑态只读、无解释提示及 owner 拒绝改变类型，与 IA、交互工件、详设和计划描述一致；此项只证明设计文档对齐。
L3_UNVERIFIED=TER-E01 改后实际渲染与交互；门店终端 L2 重新准入；backend-acceptance、真实 WebSocket 压缩双向往返、分片解压超限 1009、远端运行与 cleanup。以上均属于后续实施证据，未在设计复核中执行。
SAME_ROOT_SCAN=无 finding，无需同族修复扫描。
DESIGN_GAPS=none
TEMPLATE_COVERAGE=四份模板逐节覆盖，见下表；无缺项。
EVIDENCE_TIER=STATIC_SOURCE_ONLY
```

## Findings

无。独立 reviewer 对设计与计划完成盲审并在 provisional verdict 之后核对需求 §11、详设 §14；无 finding 需要写入 M/S/N。独立轮次的 checklist 关闭记录包含于本文件的事实、模板覆盖和核验边界各节。

## 已核且成立

- **批次边界**：需求 §1.1 将服务端、TDS、契约与门店终端设备类型只读改动放在批次一；TER client、`server-config`、transport/state/DevicePort 和 TER 生成/双端验证在批次二；多节点与 Doris 在批次三。证据：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:53-65`、`doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:18-20,390-416`。
- **WebSocket 压缩**：共享协议将 RFC 7692 `permessage-deflate` 作为 opening-handshake 扩展协商，JSON 帧不另编码；TDS 在 peer offer 时启用并保留无压缩 fallback。详设分别约束压缩帧、解压 buffer 与含分片的完整解压消息上限为 65,536 bytes，超限以 RFC 6455 标准状态 1009 在解析、认证和注册副作用之前关闭。V-S1 要验证协商、双向压缩帧、无扩展 fallback 与压缩分片超限；TER Expo Web/Android 客户端实际 offer/协商留在批次二。证据：详设 `:34,179-190,374,390-416`；计划 `:16,30,84`。外部协议依据为 [RFC 7692](https://www.rfc-editor.org/rfc/rfc7692)、[RFC 6455 §7.4.1](https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1) 及详设 §0 列出的 Reactor Netty / Spring 官方 API 文档。
- **D-18**：新建仍可选择设备类型；编辑态只读显示、不是表单控件且不加解释提示；更新载荷不得改类型，owner 对类型变更拒绝且不写配置/version。证据：IA `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md:18-20,75-90`；交互工件 `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md:3-5,240-253,356-371`；详设 `:91-100`；计划 `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:38-49`。当前组件仍需实施改动；这些文档只定义预期，不代表 UI 已改变。
- **模块方案**：详设比较将绑定留在 `store-terminal`、独立 owner 模块、另立服务三个形态，选择独立 binding owner；TDS 只消费窄验证接口，保持 command DAG 无环和单事务跨 owner 行为。证据：详设 `:28-50,192-203`；服务形决策 `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md:20-28,75-91`。
- **设计包的模板结构**：fresh reviewer 完成 section-by-section 对照，无模板缺项；详细清单见下表。
- **证据档位**：详设记录当前 `scripts/verify --validate-only` 首个失败为 `frontend-format`，且没有在本轮重跑或升级成通过。证据：详设 `:32,460-464`；计划将静态失败、acceptance、DEV、seed、L2 与 cleanup 分开记录：`doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:118-134`。

## 模板逐节覆盖

标记 `有` 表示目标文档具备该节；`NOT_APPLICABLE` 表示模板可选或已退役内容有明确适用性边界。此覆盖由 round-2 reviewer 完成，作者核对其精确列表与文档位置。

### implementation-design-template → 详设

源模板：`doc/decisions/templates/implementation-design-template.md:1-371`；目标：详设 `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:18-448`。

| 模板节 | 状态 |
|---|---|
| 收录尺度 | 有 |
| 0 元数据与授权边界 | 有 |
| 1 真实业务目标与方案比较 | 有 |
| 2 CP 总览 | 有 |
| 3 横切机制对照表 | 有 |
| 3a UI/testId 前置复核 | 有 |
| 4 每个 CP 的门控 | 有 |
| 5 operation/path/face/集合形态 | 有 |
| 6 跨 owner 写矩阵 | 有 |
| 7 声明—传递—消费矩阵 | 有 |
| 8 业务规则与 owner 判定点 | 有 |
| 9 owner API 与消费者 | 有 |
| 9a 实施前全链同步清单 | 有 |
| 9b 变更定位 | 有 |
| 10 数据迁移 | 有 |
| 10b seed 数据 | 有 |
| 10b.1 受影响 seed 全集 | 有 |
| 10b.2 两类改动 | 有 |
| 10b.3 覆盖判据 | 有 |
| 10b.4 同步项 | 有 |
| 10b.5 边界 | 有 |
| 10b.6 执行前提、父流程与角色 | 有 |
| 11 验收场景设计 | 有 |
| 12 未决项处置 | 有 |
| 13 停机条件 | 有 |
| 13b 实施节奏与三维对账 | 有 |
| 三维、两个时点、理由与边界 | 有 |
| 13c 逐代码与详设对账 | 有 |
| 13c 对详设写法的反向要求 | 有 |
| 14 交付前自查 | 有 |

### ia-design-template → D-18 IA overlay

源模板：`doc/decisions/templates/ia-design-template.md:1-160`；目标：`doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md`。

| 模板节 | 状态 |
|---|---|
| 模板目的说明 | NOT_APPLICABLE（说明段，不是目标工件必填节） |
| 1 元数据 | 有 |
| 2 可见与不可见维度 | 有 |
| 2.1 可见维度 | 有 |
| 2.2 可操作的不可见观察 | 有 |
| containerBehaviorUnderLoad 分工 | 有 |
| 3 共用 IA 规则 | 有 |
| 4 全量错误语义映射 | 有 |
| 5 交叉对账 | 有 |
| 6 完成判定 | 有 |

### ui-interaction-design-template → D-18 interaction overlay

源模板：`doc/decisions/templates/ui-interaction-design-template.md:7-433`；目标：`doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md`。

| 模板节 | 状态 |
|---|---|
| 1 工件元数据 | 有 |
| 1.1 UI 详设强制标准 | 有 |
| 1.2 管理后台交互一致性 | 有 |
| Surface ownership 自检 | 有 |
| 业务语言与动态明细命名 | 有 |
| Owner-definition 字段槽位 | 有 |
| 2 Interaction map | 有 |
| 3 v2 对应页面盘点 | 有 |
| 4 低保真线框 | 有 |
| Screen 模板 | 有 |
| L2/testId 清单 | 有 |
| Implementation-facing 控件 roster | 有 |
| 表单控件依赖图 | 有 |
| mutation 字段事实矩阵 | 有 |
| 主从集合布局与归属 | 有 |
| 搜索与候选选择 | 有 |
| 候选搜索统一协议 | 有 |
| 5 状态与边界表 | 有 |
| 6 逐操作任务合理性 | 有 |
| 7 Face/owner 对齐矩阵 | 有 |
| 8 Manifest B.4/B.5 | NOT_APPLICABLE（compliance-control 已退役） |
| 9 高保真静态 demo | NOT_APPLICABLE（可选） |
| 10 Dexter 看图结论 | 有 |

### journey-decision-template → Journey decision

源模板：`doc/decisions/templates/journey-decision-template.md:7-72`；目标：`doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md:12-82`。

| 模板节 | 状态 |
|---|---|
| 1 裁决元数据 | 有 |
| 2 用户任务与成功结果 | 有 |
| 3 逐 actor 前提链 | 有 |
| 4 任务边界、非目标与禁推 | 有 |
| 5 Corpus 命中与冲突 | 有 |
| 6 UI 适用性与后续工件 | 有 |
| 6.1 管理后台交互一致性 | 有 |
| 7 Dexter 裁决 | 有 |

## 核验与未验证清单

**已核且成立的静态事实**：批次归属、TDS owner 选择、协议/压缩上限与验收映射、D-18 文案和请求边界、详设与计划的模板覆盖均与本轮 reviewed source 对齐。证据见上节逐项路径与行号，以及 `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-round-2-input-checklist-codex.md` 与 `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-round-1-input-checklist-codex.md`。

**未能核为动态事实**：终端编辑态真实渲染为文本且不可聚焦/编辑；重准入后的全量门店终端 L2；真实 backend-acceptance 多实例拓扑；RFC 7692 压缩握手和双向帧；分片解压超限关闭与无副作用；所有受管服务启动、运行和 cleanup。这些分别安排在批次实施与批次二客户端，不因本轮 review 结论自动变为 PASS。

**当前红门**：详设中记录的最近静态验证为 `scripts/verify --validate-only` 失败，首个失败 `frontend-format`；本轮未重跑，没有把它当作 review finding 或 PASS。设计/计划可继续进入 Claude 的设计评审；实现前仍按计划关闭适用的静态、focused、动态准入与清理证据。

## 独立 reviewer checklist 收口

- Blind 顺序：需求 §0–§10、§12–§13 与详设 §0–§13 后先发 provisional；获 parent 确认后才读需求 §11 与详设 §14。
- `RELEVANT_DECISIONS=COMPLETE`：执行 `rg --files doc/decisions | sort`，记录完整标题目录，并打开适用决定；同轮 addendum 补齐前述清单缺口。
- `TEMPLATE_COVERAGE=COMPLETE_WITH_NOT_APPLICABLES`：四份设计模板已逐节核对；无材料性缺项或矛盾。
- 只读边界：未执行 build、tests、generator、`scripts/verify`、DEV、backend-acceptance、reset、seed、L2、UAT、部署、设备、数据库/数据操作。
- Round 2 是本 cycle 的最终独立 DESIGN review；`ROUND_FINAL_DECISION=SELF_DECIDED`；没有第三轮。
