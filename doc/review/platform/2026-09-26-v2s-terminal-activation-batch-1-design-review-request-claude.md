# Claude 评审请求：终端激活与长连接 · 批次一详设与计划

## 背景

《终端激活与长连接 · 需求》已由 Dexter 定稿并进入详设与实施计划阶段。本交付覆盖批次一：服务端与门店终端设备类型只读改动。Codex 已完成两轮 DESIGN 流程的最终独立复核；独立 reviewer 的结论为 `GO`, `M/S/N=0/0/0`，Codex 作者 intake 为 `GO_WITH_UNVERIFIED_UI`, `M/S/N=0/0/0`。未发现设计 finding；后续实际 UI、WebSocket 和受管运行证据仍待实施阶段产生。

Dexter 最新补充要求 WebSocket 支持压缩。详设将 RFC 7692 `permessage-deflate` 纳入 TDS 共享协议与 V-S1：明确协商、限制及超限关闭；TER Expo Web/Android 的实际协商证明属于批次二。

## 评审目标

请独立判断批次一详设与计划是否完整、可执行且符合需求、仓库当前 owner/模块、门和治理要求；重点复核压缩协议选择、TDS 与 `terminal-binding` 依赖、R-12 门/红夹具闭包、D-18 设计同步与批次边界。此评审只判断设计包，不判断实现结果。

## 需阅读文件

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：需求正本；先读 §0–§10、§12、§13，再读 §11。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`：批次一 implementation-facing 详设，含共享契约、R-12、V-S1 和压缩边界。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`：批次一串行实施步骤、动态前置条件与交付闸门。
- `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`：TDS 与绑定 owner 的服务形决策。
- `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`：Journey 任务、批次边界和产品裁决归属。
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` 与 `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md`：门店终端 D-18 IA 与编辑态交互覆盖。
- `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md` 与 `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-plan-codex.md`：D-18 既有工件基线及同步边界。
- `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-review-codex.md`：Codex 两轮独立设计复核与未验证清单。
- `doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md` 与四份 `doc/decisions/templates/` 设计模板：评审动作、设计覆盖和详设/计划判据。
- `doc/platform/terminal-coding-standard.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/foundation-charter.md`：适用工程与 UI 约束。
- `doc/decisions/2026-07-24-v2s-verification-governance.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`、`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`、`doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md`：证据、独立审查、acceptance 场景和授权规则。
- `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-round-2-input-checklist-codex.md`：独立 reviewer 实际采用的输入清单和盲审顺序。

## 独立核验重点

- 从当前源码检查详设中的服务端模块、TDS runtime 依赖、owner command 图、数据库事务/通知、接口生成和 R-12 门清单；不要仅复述详设中的仓内事实。
- 核对 batch 1/2/3 切分，尤其 `server-config` 在本期整体范围内但属于 batch 2；TER transport/state/DevicePort/client 与生成器也在 batch 2；多节点/Doris 属 batch 3。
- 独立核对 RFC 7692 `permessage-deflate` opening-handshake 协商、Reactor Netty 的压缩与帧上限语义、decompressed complete-message 上限、分片消息关闭状态 1009、fallback，以及测试是否证明压缩/无压缩两路。区分 batch-1 TDS 能力和 batch-2 Expo Web/Android 客户端运行证明。
- 核对 D-18 创建态与编辑态区别：设备类型只在新建态可选；TER-E01 只读文本，不是禁用选择器、不加解释提示；更新请求不携带设备类型，owner 对类型变化拒绝且不写配置/version。
- 按要求核对四份设计模板逐节覆盖、UI/testId 分母、门店终端 L2 重新准入、动态前置条件、backend-acceptance 的双业务后端加 TDS 拓扑、故障注入与生产测试接缝边界。
- 证据必须区分静态、focused、backend-acceptance、DEV、L2 和未验证项。详设记录最近一次 `scripts/verify --validate-only` 首败为 `frontend-format`；本轮不要重跑构建、测试、生成器、验证门或受管运行。

## 期望结论

请给明确 `GO` 或 `NO-GO`，附 `M/S/N` 数量。每条 finding 写明位置、性质（仓内事实/外部事实/推论/产品判断）、仓库相对路径与行号、影响、最小可验收修正，以及是否需要 Dexter 裁决。另列已核且成立的事实、无法核实的事实、需 Dexter 裁决的事项和证据等级。该结果用于 Dexter 决定后续处理；请勿修改仓库文件。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审《终端激活与长连接》批次一详设与实施计划。

背景：需求已定稿并进入批次一详设与实施计划阶段。Codex 最终独立 DESIGN reviewer 给出 GO、M/S/N=0/0/0；作者 intake 为 GO_WITH_UNVERIFIED_UI、M/S/N=0/0/0，未发现设计 finding。实际 TER-E01 渲染、WebSocket 运行和受管验收仍未执行。Dexter 最新要求 WebSocket 支持压缩，详设已将 RFC 7692 permessage-deflate、65,536-byte 上限、1009 超限关闭与 V-S1 验收纳入 batch 1；TER Expo Web/Android 客户端压缩协商证明属于 batch 2。
目标：请独立判断批次一详设/计划的 architecture、contract、owner boundary、R-12 gate 闭包、D-18 UI 设计和压缩验证是否完整、可执行，指出任何仓内事实错误、遗漏或过度设计。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md：需求正本。按盲审顺序先读 §0–§10、§12、§13，再读 §11。
- doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md：批次一详设、共享协议和门清单。
- doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md：实施顺序、准入和交付条件。
- doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md：TDS 与绑定 owner 的结构选择。
- doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md：用户任务、批次边界与 Dexter 裁决。
- doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md 和 doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md：D-18 IA 与交互覆盖。
- doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-review-codex.md：Codex 复核结果与未验证项。
- doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-round-2-input-checklist-codex.md：round 2 输入清单和盲审顺序。
- doc/platform/review-standard.md、doc/platform/implementation-task-template.md、doc/platform/terminal-coding-standard.md、doc/platform/backend-coding-standard.md、doc/platform/frontend-coding-standard.md、doc/platform/foundation-charter.md 及适用的四份 doc/decisions/templates/ 设计模板：评审动作与判据。

请重点独立核验：当前源码中的模块依赖和 COMMAND DAG、TDS runtime 最小依赖、R-12 门入口和有效红夹具、backend-acceptance 同时起两个业务后端与 TDS 的可行性、D-18 的创建/编辑差异、WebSocket RFC 7692 压缩协商和 bounded decompression，并确认 batch 2 的 Expo Web/Android 证明没有被错误算入 batch 1。标出静态验证已知首败 frontend-format；不要运行构建、测试、生成器、scripts/verify 或 DEV、backend-acceptance、reset、seed、L2、UAT、部署、设备或数据操作。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N。每条 finding 请列位置、性质、仓库相对路径与行号、影响、最小可验收修正和是否需要 Dexter 裁决；另列已核事实、未能核实事实、需 Dexter 裁决事项与证据等级。

授权边界：本次只做批次一详设与实施计划的只读评审，不修改任何仓库文件，不开始详设以外的实施、DEV、backend-acceptance、reset、seed、L2、UAT、部署或数据操作。Claude 的 GO/NO-GO 仅作评审结论，不扩展本次工作范围。谢谢。
```
