REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=RETIRED_NOT_APPLICABLE_BY_CURRENT_AGENTS
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-execution-note.md
REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_DESIGN_2026_08_19
REVIEW_TARGET=DESIGN
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW

> `DESIGN_GRANULARITY_MANIFEST` 仅为旧 handoff 模板的显式退役哨兵，不是文件、准入门、分母或证据台账；依据当前 `AGENTS.md`，不得创建、读取或恢复 `scripts/check/implementation-design-granularity` 及任何 exact-surface/package-exit 机制。

## 背景

本轮是 R5 外部协作与经营渠道的一次性设计批次。Dexter 已直接授权先完成 IA 详设、implementation-facing 详设和串行实施计划；当前不授予 implementation、contract、generated artifact、migration、seed、reset、DEV、L2、UAT 或 Git 权限。

原始规格把外部协作的通用能力拆为 `external_system`、`provider_profile`、`owner_binding` 与 workspace enablement，把经营渠道定义为项目/门店模板与渠道实例。当前设计保留 `platform-admin` 与 `operations-admin` 两个独立 app：前者负责平台配置和 binding，后者负责模板/渠道；跨 owner 写由 edge policy 在同一 `REQUIRED` 事务中编排公开 owner command。

本轮必须特别核验 E-33：`catalogStatus=PLANNED` 不是 enablement 门槛，也不阻断运营侧候选。C-01、C-02、C-03、C-04、C-08、C-09 仍是 `[未定]`，设计只能保留依赖，不得自行落成 contract/DB 约束。

Codex 已完成本地文档和静态输入核对，但 fresh 独立子 agent Round 1 在受控等待后无任何 verdict，已按 Dexter 指示停止等待并记录为 `UNVERIFIED_REQUIRES_EVIDENCE`；因此本次不把作者自审、静态 PASS 或未返回的 reviewer 当作 GO，转交 Claude 做独立 review。

## 评审目标

请从业务用户与架构 owner 两个角度，独立确认这三份设计是否足以作为后续 implementation authorization 的输入，重点判断：

- IA 是否真的服务批准的两个 Journey，而不是从现有表结构/接口反推页面；
- implementation-facing 详设是否保持最小、可维护、owner 清晰，是否把未决 C 偷渡成硬约束；
- edge、OpenAPI、generated client、双后台、foundation、acceptance 和受管 seed 的串行路径是否可执行且没有第二真相源；
- 设计是否正确处理 E-33、双 consumer face、同模板多渠道、停用/恢复、外部授权三态、typed problem、敏感字段与 cleanup；
- 当前源码真实 acceptance 分母为 44，新增设计为 14 条、预计 58，且不能恢复已退役的 196 provider inventory、shared SPI、scenario registry、compliance-control、package exit 或 `CURRENT_*` 状态机制。

## 需阅读文件

请从 `catering-v2s` 仓库根按以下顺序阅读：

- `AGENTS.md`：执行边界、Roadmap authorization-only、R5 implementation 未授权与独立 review 规则；
- `CLAUDE.md`：Claude review 入口、GO/NO-GO、M/S/N 和授权边界；
- `PLATFORM-BLUEPRINT.md`：单 deployable、多 owner schema、事务、consumer face 与环境边界；
- `doc/platform/roadmap-program-registry.json`：显式程序选择；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：只读取当前 R5 授权字段，不把历史 §7 示例值当活状态；
- `project-memory/index.md` 与 `project-memory/kernel/01-workspace-and-roadmap.md` 至 `06-heritage-and-change.md`：项目 kernel；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`：上下文、业务语义和独立审查；
- `project-memory/operations/backend-acceptance.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/implementation-source-reread-discipline.md`：验收、交接和逐点双读；
- `project-memory/practices/collection-boundary-modes.md`、`project-memory/practices/backend-capability-lookup.md`、`project-memory/practices/frontend-capability-lookup.md`、`project-memory/practices/decided-undecided-marking.md`：集合边界、能力查找和未决标记；
- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`：BR/OP/typed problem/C/U 原始规格；
- `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md`：Dexter source records 001–012；
- `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`：platform Journey；
- `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`：operations Journey；
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`：P1–P6/O1–O5 交互、线框、foundation 复用和 visual review 状态；
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`：IA-P1..P6/IA-O1..O5 九维度；
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`：owner、契约、API、事务、UI、acceptance 设计；
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`：CP-00..CP-09 串行实施计划；
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-round-1-input-checklist.md`：Round 1 完整输入、hash 和攻击清单；
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-execution-note.md`：独立 reviewer 无 verdict 的真实执行记录；
- `contracts/openapi/edge.openapi.json` 与 `contracts/registry/operation-handler-bindings.json`：当前契约和 operation registry；
- `scripts/generate/edge-codegen.mjs`、`scripts/generate/operation-handler-bindings.mjs`：生成链；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java`、`BackendAcceptanceTest.java`、`CatalogAcceptanceScenarios.java`、`CommercialContractAcceptanceScenarios.java`、`OrganizationAcceptanceScenarios.java`：真实 acceptance 分母与 owner 文件；
- `libraries/frontend/admin-ui-foundation/src/index.ts`、`apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts`、`apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts`：共享 foundation 与 cursor candidate 复用；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OperationsOwnerScopeGrant.java`、`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java`：当前 scope/capability 事实。

## 独立核验重点

请先独立推导 expected behavior 和最小方案，再对照设计；不要因为设计文档自称已覆盖就接受。至少核验：

1. E-33 是否在 Journey、IA、API、候选、acceptance 和 UI 中一致；任何 `PLANNED` gate 都是 finding。
2. BR 集合是否为 BR-01..BR-32、BR-34、BR-35（无 BR-33），OP 的 Bounded/Detail/Page/command 边界和 OP-21 复用是否完整。
3. 六项 C 与 U-02 是否明确 `[未定]`，且没有偷偷生成 unique index、state enum、polymorphic FK、规则 DSL 或恢复算法。
4. 十一个 IA screen 是否每屏有 businessTask、actorAndScenario、entryAndSurface、controlType、dataSourceAndCascade、validationAndError、stateAndPermission、navigationAndRefresh、accessibilityAndTestId；操作是否来自批准 Journey，是否有更短路径。
5. 每条 edge route 是否只有一个真实 `x-consumer-faces`；两个 app 是否保持独立 shell/router/store/session/context/theme；operations 是否只有两个写 capability，且没有独立非渠道 binding 管理面。
6. collaboration 与 business-channel 的事实主权、公开 owner command、同一 `REQUIRED` 事务、跨 schema 读写和错误边界是否正确；是否错误地让一个模块调用另一个模块 command。
7. OpenAPI `$ref`、operation registry、Java/TypeScript generated byte flow 是否能从 source 逐段回读；runtime/test 是否没有 Journey/BR/OP/PKG/G 编号命名。
8. 当前 acceptance 源码是否确实是 44 条；新增 14 条是否具有非空 identity/fixture/request/businessOracle、真实 HTTP/fixture/business assertion，并且 owner file 落点不会把断言塞回入口或恢复退役 registry。
9. seed 是否仅为设计、顺序是否 owner-command → catalog-inventory、start/restart 是否不隐式 seed；是否有任何 reset/seed/runtime/L2 伪造或混用证据。
10. typed problem、CAS、敏感字段、structured logging、first failure、business/cleanup 分离和禁用对象可读/置灰规则是否闭合。

请把每个问题标成 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并给出精确相对路径和行号、影响面、适用边界、反例和更小修复建议。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并按 `M`（major）、`S`（significant）、`N`（note）报告 finding 数量。`GO` 只表示本批设计可以作为下一步决策输入，不表示 implementation、runtime、seed、reset、DEV、L2、UAT 或产品 C 裁决已获授权。若 UI visual review、产品语义或 C 项仍需 Dexter 决策，请标为 `DEXTER_DECISION`，不要用静态闭环代替。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审本次“外部协作与经营渠道”一批的 IA 详设、implementation-facing 详设和串行实施计划。

背景：Dexter 已明确授权本批先做完整设计，但当前 R5 implementation authorization 仍为 false。设计保留 platform-admin 与 operations-admin 两个独立 app，由 collaboration 与 business-channel 分别持有事实，edge policy 在同一 REQUIRED 事务中编排跨 owner 写。请特别注意 E-33：catalogStatus=PLANNED 不构成启用门槛，也不阻断运营侧候选；C-01/C-02/C-03/C-04/C-08/C-09 仍未裁决，不能被设计偷渡成 contract 或 DB 硬约束。

本地 fresh 独立子 agent Round 1 已按清单派出，但在受控等待后没有返回任何 verdict，已停止并记录为 UNVERIFIED_REQUIRES_EVIDENCE。因此请你从仓根重新独立推导并 review，不要把 Codex 的静态 PASS、自审或未返回 agent 当作结论。

目标：请判断这三份设计是否足以作为 implementation authorization 的输入，重点核验业务目标、owner/transaction、single consumer face、双后台独立边界、IA 九维度与 Journey 合理性、E-33、六项 C、OpenAPI/generated byte flow、foundation 复用、当前 acceptance 44→新增 14 的真实落点、seed/runtime/cleanup 和安全日志边界。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md：BR/OP/typed problem/C/U 原始规格；
- doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md：Dexter source records 001–012；
- doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md：platform Journey；
- doc/decisions/2026-08-19-v2s-business-channel-management-journey.md：operations Journey；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md：P1–P6/O1–O5 交互与线框；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md：十一个 IA screen 的九维度；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md：implementation-facing owner/contract/API/UI 设计；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md：CP-00..CP-09 串行计划；
- doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-round-1-input-checklist.md：完整输入清单与 hash；
- contracts/openapi/edge.openapi.json、contracts/registry/operation-handler-bindings.json：当前契约与 operation registry；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java、BackendAcceptanceTest.java、CatalogAcceptanceScenarios.java、CommercialContractAcceptanceScenarios.java、OrganizationAcceptanceScenarios.java：当前 44 条 acceptance 的真实源码；
- libraries/frontend/admin-ui-foundation/src/index.ts、apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts、apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts：foundation 与候选协议；
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、当前 Roadmap 授权字段和适用 project-memory：执行/架构/审查边界。

请重点独立核验：E-33 是否全链路成立；BR-01..BR-32、BR-34、BR-35 与 OP 是否完整；六项 C 是否只保留依赖；IA 是否来自批准 Journey 且有更短替代；每条 route 是否单一 x-consumer-faces；两个 admin 是否完全独立；owner command 与同一 REQUIRED 事务是否正确；OpenAPI 到 generated client 是否可回读；acceptance 是否真实 44→58 且不恢复已退役的 196/provider/SPI/registry/package-exit/compliance-control；seed、runtime、日志、敏感字段和 cleanup 是否没有越界。

烦请给出明确 GO 或 NO-GO。每条 finding 请按 M / S / N 标注，给出精确相对路径与行号、影响面、适用边界、反例、最小修复建议，并标明是否需要 Dexter 产品/Journey/C 项裁决。若信息不足请写 UNVERIFIED_REQUIRES_EVIDENCE，不要用推论冒充事实。

授权边界：本次只请求对设计进行独立 architecture、contract、boundary、UI reasonableness、acceptance/readiness review。你的 GO/NO-GO 不授权任何生产代码、OpenAPI/生成物、数据库迁移、seed、reset、start/restart、DEV、L2、UAT、外部联调、产品 C 裁决或 Git 操作；不代表 implementation authorization。谢谢。
```
