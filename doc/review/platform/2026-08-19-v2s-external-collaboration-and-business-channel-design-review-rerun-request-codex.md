REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=RETIRED_NOT_APPLICABLE_BY_CURRENT_AGENTS
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-rerun-execution-note.md
REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_DESIGN_2026_08_19
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
REVIEW_STATUS=READY_FOR_CLAUDE_RE_REVIEW

> `DESIGN_GRANULARITY_MANIFEST` 是当前退役控制面的显式哨兵，不是文件、准入门、分母或证据台账；不得读取或恢复 `scripts/check/implementation-design-granularity`、exact-surface/package-exit、196 provider inventory、compliance-control 或 Roadmap `CURRENT_*` 状态机制。

## 背景

本轮是 R5 外部协作与经营渠道的一次性设计批次，交付单元为 IA 详设、implementation-facing 详设和串行实施计划。Claude 首轮静态设计复核结论为 `NO-GO · M=1 · S=4 · N=5`；其明确确认模型、owner、edge、IA、E-33 和六项 C 依赖态成立，finding 集中在契约字面量、platform URL、acceptance domain、seed plan/fixture 和若干机械缺口。

Codex 已按原始规格、G-10 语料、active acceptance standard、当前 acceptance catalog 与既有 seed plan 逐点核验，并修复 M-1、S-1、S-2、S-3、N-1、N-2、N-4、N-5。两份 Journey 已诚实改为 `DEXTER_PENDING`，N-3 仍需 Dexter 连同线框确认。修复只涉及设计文档、计划与 review 记录，没有生产代码、契约生成物、migration、seed、runtime 或 Git 变化。

修复后 fresh independent-subagent Round 1 已按更新清单派出，但在约四分钟受控等待内没有任何 verdict/findings，已受控停止并留痕为 `UNVERIFIED_REQUIRES_EVIDENCE`。该无返回记录不被本次 Claude 复核冒充为独立子 agent verdict；请从仓根重新核验当前材料。

## 评审目标

请独立确认修复是否真正消除了首轮 finding，且没有为修复字面量而破坏已成立的模型、owner、IA、E-33、六项 C 依赖、single consumer face、双后台边界、同一 `REQUIRED` 事务和 34 条 BR 映射。请特别判断本批设计是否足以进入“向 Dexter 申请 implementation authorization”的下一步；不要把本次 GO/NO-GO 解释为 implementation authorization。

## 需阅读文件

请从 `catering-v2s` 仓库根阅读：

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`：执行、审查和架构边界；
- `doc/platform/roadmap-program-registry.json`、`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：显式 program 与 authorization-only 字段；
- `project-memory/index.md`、全部 `project-memory/kernel/*.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/backend-acceptance.md`、`project-memory/operations/implementation-source-reread-discipline.md`：项目规则、G-10、验收和逐点双读；
- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`：冻结契约字面量、BR/OP/typed problems/C/U；
- `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md`：Dexter source records 001–012；
- `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`、`doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`：两个 Journey，重点看 `DEXTER_PENDING` 和真实 Screen 锚点；
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`：P1–P6/O1–O5 交互、十一 surface、线框与 visual review 状态；
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`：十一 IA-ID、九维度、platform URL 与 `COMMERCIAL_GROUP`；
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`：契约字面量、owner/API、acceptance domain、seed plan 设计；
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`：CP-00..CP-09、CP-07 seed 与 CP-08 acceptance placement；
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-claude.md`：首轮 Claude findings，仅读作待证伪输入，不替代当前核验；
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-author-intake.md`、`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-round-1-input-checklist.md`：Codex intake 与 Round 1 输入清单；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` 及其当前 acceptance owner 文件：真实 domain group 与 44 条口径；
- `scripts/dev/catalog-inventory-seed-plan.mjs`：既有 seed plan 形态与职责边界；
- `apps/frontend/platform-admin/src/app/PlatformApp.tsx`、`apps/frontend/platform-admin/src/app/state/WorkspaceScope.tsx`、`apps/frontend/operations-admin/src/app/OperationsApp.tsx`：双后台 route/session/context 事实；
- `contracts/openapi/edge.openapi.json`、`contracts/registry/operation-handler-bindings.json`、相关 generated registry：API face 与生成链；
- `libraries/frontend/admin-ui-foundation/src/index.ts`、两个 candidate query：共享 foundation 与候选复用；
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-rerun-execution-note.md`：独立子 agent 无返回的真实记录。

## 独立核验重点

1. 将规格 §3.3、§5.4、§5.8 的六类字面量逐一与 IA、implementation design、serial plan 对照：`GROUP_BUY`、`TAKEAWAY`、`INVENTORY_SYNC`、`TAKEAWAY_DELIVERY`、`LOCAL_ONLY`、`COMMERCIAL_GROUP`；确认没有 `GROUP`、`GROUP_BUYING`、`TAKEOUT`、`INVENTORY`、`DELIVERY` 或 `SELF_SERVICE` 偷渡。
2. 亲验 G-10：platform-admin 页面只能是 `/platform/external-collaboration`，集团空间由 WorkspaceScope 提供；operations URL/API 可携带 `groupWorkspaceKey` 的范围不能被误改；Journey corpus 表与 Screen P1/O1 锚点必须真实。
3. 亲验 acceptance placement：实现期应新增 `CollaborationAcceptanceScenarios.java` 与 `BusinessChannelAcceptanceScenarios.java` 并登记当前 `BackendAcceptanceScenarioCatalog`；不能把新增场景塞回 Organization/CommercialContract，也不能恢复 196/provider/shared SPI/scenario registry/自动分母；44+14=58 且低于 80。
4. 亲验 seed 设计：契约目录是只读输入，不放进 `catalog-inventory-seed-plan.mjs`；本域计划目标、五类节点、万象城海底捞一店三渠道三绑定（两 `TAKEAWAY`、一 `GROUP_BUY`）、内部 DINE_IN 的 POS/QR/KIOSK 均有明确设计；当前仍无 seed 创建/执行。
5. 亲验 N 项：实数十一；IA 命名理由存在且不进入 runtime/test；两 Journey 不再自称 Dexter accepted；没有 `markBindingsCascadeDisabled` command；锚点指向实际 Screen 标题。
6. 反向攻击首轮确认的实质：E-33 不被 `catalogStatus` 阻断；六项 C 仍依赖态；BR 集合为 34 条且 BR-33 空号；owner/edge/同一 `REQUIRED` 事务、single `x-consumer-faces`、双 app、foundation、敏感字段、typed error 和 cleanup 没有被修复改坏。

## 期望结论

请明确给出 `GO` 或 `NO-GO`，并给出 M/S/N 数量。每条 finding 必须有精确仓根相对路径与行号、影响面、适用边界、反例或验证方式、最小修复建议，并标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`。请单独说明 N-3 的 Dexter confirmation 是否仍是闭门条件，以及 independent-subagent Round 1 无返回是否阻止设计 GO。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助复核本次“外部协作与经营渠道”设计整改后的 IA 详设、implementation-facing 详设和串行实施计划。

背景：首轮 Claude 设计复核为 NO-GO · M=1 · S=4 · N=5，但已确认模型、owner、edge、IA、E-33 和六项 C 依赖态成立。本轮已按首轮 findings 修复契约枚举、platform URL、acceptance domain、seed plan/fixture、IA 计数与命名说明、Journey 状态/锚点及派生置灰 API。修复未触碰生产代码、契约生成物、migration、seed、runtime 或 Git。修复后的 fresh independent-subagent Round 1 已派出，但约四分钟无任何 verdict/findings，已受控关闭并记录为 UNVERIFIED_REQUIRES_EVIDENCE；请不要把该无返回记录或 Codex 静态 PASS 当作独立 verdict。

目标：请从原始规格与当前源码重新核验整改是否闭合，并反向攻击原先已成立的模型、owner、IA、E-33、六项 C、single consumer face、双后台独立边界、同一 REQUIRED 事务和 34 条 BR 映射。请特别确认本批设计是否可以向 Dexter 申请 implementation authorization 的下一步。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md：冻结字面量、BR/OP/typed problems/C/U；
- doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md、doc/decisions/2026-08-19-v2s-business-channel-management-journey.md：两个 Journey、DEXTER_PENDING 与真实 Screen 锚点；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md：P1-P6/O1-O5 十一 surface 与线框；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md：十一 IA-ID、九维度、platform URL；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md：契约、owner/API、acceptance domain、seed plan 设计；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md：CP-07/CP-08 与串行边界；
- doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-claude.md：首轮 finding，作为待证伪输入；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java 及当前 acceptance owner 文件：44 条真实入口与 domain group；
- scripts/dev/catalog-inventory-seed-plan.mjs：既有 seed plan 形态；
- apps/frontend/platform-admin/src/app/PlatformApp.tsx、apps/frontend/platform-admin/src/app/state/WorkspaceScope.tsx、apps/frontend/operations-admin/src/app/OperationsApp.tsx：双后台 route/context；
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、project-memory/index.md 及适用 project-memory：执行和审查边界。

请重点逐字对照六个规格字面量 GROUP_BUY、TAKEAWAY、INVENTORY_SYNC、TAKEAWAY_DELIVERY、LOCAL_ONLY、COMMERCIAL_GROUP；亲验 G-10 的 platform URL 与 WorkspaceScope；确认新增 acceptance domain 文件及 catalog 登记；确认本域 seed plan、五类节点、万象城海底捞三渠道三绑定和 POS/QR/KIOSK 设计；确认十一 IA、Journey pending、真实 Screen 锚点、派生置灰；并反向验证 E-33、六项 C、BR-33 空号、owner/edge/事务、single x-consumer-faces、双 app、foundation 与退役控制面红线。

烦请给出明确 GO 或 NO-GO，按 M/S/N 报告 findings，并为每条 finding 给出相对路径、行号、影响面、适用边界、最小修复和是否需 Dexter 裁决；信息不足请标 UNVERIFIED_REQUIRES_EVIDENCE。

授权边界：本次只请求设计整改的独立 architecture、contract、boundary、UI reasonableness、acceptance/readiness review。GO/NO-GO 不授权生产代码、OpenAPI/生成物、数据库迁移、seed、reset、start/restart、DEV、L2、UAT、外部联调、产品 C 裁决或 Git 操作；implementation authorization 仍须由 Dexter 单独裁定。谢谢。
```
