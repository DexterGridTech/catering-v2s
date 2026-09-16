# 门店经营规则开关 · 详设与实施计划 Claude DESIGN review request

REVIEW_TARGET=DESIGN  
REVIEW_CYCLE_ID=2026-09-16-store-operating-rule-switches-design  
REVIEW_ROUND=N  
reviewerKind=CLAUDE_EXTERNAL_REVIEWER  
IMPLEMENTATION_AUTHORITY=false  
RUNTIME_EXECUTION=NOT_AUTHORIZED  
SEVERITY_FORMAT=M/S/N  

## 背景

本轮评审对象是门店经营规则开关的 implementation-facing 详设与实施计划，不是生产实现。Claude 依据当前字节给出的上一轮经 Dexter 中转结论为 `REVIEW_TARGET=DESIGN，NO-GO，M/S/N=1/2/2`。主 agent 已逐条重开 owning source、需求、Journey、IA、interaction、详设与计划，确认五条 finding 均成立并在“文档编写与只读核查”授权内完成修订；历史 verdict 保留，不把本记录当作独立 GO。

本轮不启动新的 Codex 子 agent，不执行生产代码、契约生成、构建、测试、reset、DEV、seed、backend acceptance、browser L2、UAT、部署或 Git 操作。请以当前仓库字节为准，不把本话术、旧 review、聊天摘要或旧 evidence 当作事实正本。

## 评审目标

请重新独立判断修订后的详设与实施计划是否已经消除以下结构性问题，并找出仍会让后续实施不成立的反例：

1. 三个门店商品/库存/销售菜单 host 是否使用显式 selected Store 读取，而不是从 session ambient Store 派生 profile；`storeId` 是否服务端重新做 project/assignment scope 复核。
2. strict schema 的 400 与 owner 语义 422 是否分界清楚；错误码、前端保留输入和“聚焦首项”承诺是否只在可成立的边界内适用。
3. 规则值类型是否完整支持 `BOOLEAN`、`NUMBER`、`STRING`，同时保持当前树为 11 BOOLEAN + 1 STRING、没有虚构 NUMBER 实例。
4. error disposition closure 三个计数是否已在计划中明确实现后复核为 `79/79/157`，P3 是否把 AuditChange/common wire/四类实体读写者的共享契约回归列为完成条件。
5. 需求、Journey、IA、interaction、详设、计划与 269 行 mapping 是否保持同一树、owner、错误边界、读取住址、分母和授权边界；不得因修复引入新的实现自由裁量或过度设计。

## 需阅读文件

请从 `catering-v2s` 仓库根按以下顺序打开：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/claude-review-handoff-template.md`：执行入口、owner/授权、评审交接格式；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md`：需求正本、冻结树、R-5/R-6/R-9/R-10 及历史 review 记录；
- `doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md`：actor、用户路径、三个 consumer host 和边界；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-ia-design-codex.md`：状态优先级、错误处理、读取/刷新和审计 IA；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-interaction-design-codex.md`：用户可见错误、400/422 交互、三个 host 的 empty surface 和屏幕声明；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md`：catalog、schema、owner read、审计、gate、seed 和精确实现锚点；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-plan-codex.md`：P0-P9 实施顺序、错误 closure、共享审计回归、P9 对账和授权边界；
- `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md`：269 条 operation 的完整分类、52 条 STORE mutation、source hash 和 gate 口径；
- `contracts/openapi/paths/operations-admin/store-management.paths.json` 第 530-622 行：显式 Store detail operation、`storeId` 和 scope 参数；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java` 第 206-215、283-287 行：detail controller、Store 读取和 selected-project 复核；
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java` 第 141-157 行，以及 `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationTaskPathLookup.java` 第 148-159 行：assignment/project scope 判定；
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json` 第 205-215 行：当前 closure 基线 77/77/155；
- `contracts/registry/operation-handler-bindings.json` 与上述 mapping：269 行 source 正本和分类分母。

## 独立核验重点

- 先从源码重新判断 `getOperationsOrganizationStore/{storeId}` 是否确实比 `getOperationsStoreProfile` 能表达全局选择器的 Store；核对 GROUP/REGION/PROJECT/STORE 四种 assignment 的适用边界、跨项目反例和历史 profile 调用者是否被错误扩大范围。
- 逐条核对 schema/binding 400、owner 422、`ORGANIZATION_STORE_OPERATING_RULES_INVALID`、父 false + 子 true 合法组合，以及没有 rule key 时不承诺首项聚焦；如果仍有文档给所有结构错误承诺 422，请列 finding。
- 核对三类型闭集与当前实例计数，确认计划没有把 NUMBER 偷换成未来想法，也没有要求当前生成物凭空出现 NUMBER 字段。
- 核对 P2 的 error disposition 路径和 `79/79/157` closure 复核要求；核对 P3 是否保护 legacy audit JSON/行、固定字段标签、分页、授权及 Brand/Tenant/HeadCompany/Store 四类生产者/读者。
- 重新检查 269/88/33/3/52/181 与 source hash；若只是文档字节变化而 mapping 未变，不要制造新的 hash finding；若发现分类或闭包漂移，说明具体分母和最小重建范围。
- 区分“仓内事实、推论、产品判断、尚缺证据的假设”；未执行的动态、构建、生成、reset、DEV、seed、browser L2 只能列为 `NOT_RUN/NOT_AUTHORIZED`，不得升级成实现缺陷或 GO 证据。

## 期望结论

请给出明确的 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每条 finding 请包含：

- `STATUS=CONFIRMED|PARTIALLY_CONFIRMED|REJECTED_WITH_EVIDENCE|UNVERIFIED_REQUIRES_EVIDENCE|DEXTER_DECISION`；
- `TYPE=仓内事实|推论|产品判断|尚缺证据的假设`；
- 仓根相对路径与精确行号、对应详设/计划章节；
- 根因、影响、适用边界、反例、最小修复，以及更小修复为什么不足、为何不是过度设计；
- 若只是 evidence 不全，请单列为 `UNVERIFIED/NOT_RUN`，不要冒充代码缺陷。

请另列：已确认无问题的 269 行 mapping、显式 Store detail 读取、三类型闭集与当前树、schema/owner 错误边界；以及本轮未执行的动态/构建/测试证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请基于当前仓库字节，重新独立复审「门店经营规则开关」的详设与实施计划。

背景：您上一轮经 Dexter 中转给出的结论是 REVIEW_TARGET=DESIGN、VERDICT=NO-GO、M/S/N=1/2/2。主 Codex 已按当前 owning source 逐条核实：M-01 三个 consumer host 的 Store 规则读取路径、S-01 schema 400 与 owner 422 边界、S-02 BOOLEAN/NUMBER/STRING 闭集、N-01 error disposition closure 计数、N-02 共享审计契约回归要求均确认成立，并已在仅限“文档编写与只读核查”的授权内修订。历史 verdict 不改写，本轮请只审当前字节。

评审目标：请从“为什么仍可能不能实施”出发，独立核验修订后的需求、Journey、IA、interaction、详设和实施计划是否已经统一：三个商品/库存/销售菜单 host 必须以当前选择器的 scopeRef 显式传 storeId 读取 Store detail 并由服务端复核 project/assignment；schema 结构错误与 owner 语义错误必须分别落在既有 400 和新 422；规则闭集必须是 BOOLEAN/NUMBER/STRING，而当前 12 项仍为 11 BOOLEAN + 1 STRING；P2 必须复核 error closure 79/79/157；P3 必须保护既有审计行、标签、分页、授权和四类实体读写者；269 行 mapping 与 source hash 不得漂移。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md：需求正本与冻结裁决；
- doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md：Journey、actor 和 consumer host；
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-ia-design-codex.md：状态、错误、恢复、刷新和审计 IA；
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-interaction-design-codex.md：用户可见交互、400/422 边界和三个 host；
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md：详设与精确实现锚点；
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-plan-codex.md：P0-P9、closure 计数、P3 回归和 P9 对账；
- doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md：269 行完整 mapping、52 条 mutation 与 source hash；
- contracts/openapi/paths/operations-admin/store-management.paths.json:530-622、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java:206-215,283-287、apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java:141-157、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationTaskPathLookup.java:148-159：显式 Store detail 与 assignment scope 的 owning source；
- doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:205-215、contracts/registry/operation-handler-bindings.json：error closure 基线与 operation 正本。

请重点独立核验：M-01 的 storeId 是否真由 scopeRef 表达、selected project/assignment 是否能拒绝跨 scope；S-01 的 schema 400、owner 422、首项聚焦和 parent false + child true 边界；S-02 的三类型声明、默认值和当前 12 项实例；N-01 的 79/79/157 是否被 P2 作为实现后机械复核；N-02 的共享审计回归是否足以保护 legacy JSON/行、固定字段、分页、授权及四类实体。请同时扫查跨文档旧 profile 口径、旧 422 口径、旧类型口径、旧 closure 计数、269/88/33/3/52/181 与 source hash 漂移。

请先给 VERDICT=GO 或 NO-GO，再给 M/S/N=x/y/z。每条 finding 请注明 STATUS（CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION）、TYPE（仓内事实、推论、产品判断或尚缺证据的假设）、仓根相对路径与第 X 行、详设/计划章节、根因、影响、适用边界、反例、最小修复及为什么更小方案不足。仅 evidence 不全请放在 UNVERIFIED/NOT_RUN，不要冒充代码缺陷；动态、构建、生成、reset、DEV、seed、backend acceptance、browser L2、UAT、部署均未执行。

授权边界：本轮只请求对当前需求、详设、IA、interaction、Journey、mapping 和实施计划做静态 DESIGN review。你的 GO/NO-GO 不授权生产代码、契约生成、migration、测试、构建、reset、DEV、seed、backend acceptance、browser L2、UAT、部署或 Git 操作；后续实施仍须 Dexter 单独授权。谢谢。
```
