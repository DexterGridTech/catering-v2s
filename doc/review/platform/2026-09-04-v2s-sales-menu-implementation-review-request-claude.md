REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=V2S-SALES-MENU-IMPLEMENTATION-2026-09-04
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_INDEPENDENT

## 背景

本轮是销售菜单（Sales Menu）整体实现结果 review，不是新的需求设计，也不是继续扩大实现范围。实现范围严格限定在 `apps/backend` 与 `apps/frontend` 两个应用目录；浏览器 L2 的 repository byte binding 也已永久固定为这两个目录的输入文件，不包含 `apps/terminal`。本轮不新增产品语义、Journey、权限、operation、数据模型、预算例外、UAT、部署或切流。

此前销售菜单 L2 曾长期反复失败，独立诊断已确认主要是测试/runner 组织问题：HTTP 事件计数被误当成 UI 就绪、异步 read-model 未收敛时一次性查找控件、fixture 分母与 operation 覆盖声明不一致。当前实现已按根因修复，并完成静态检查、后端 acceptance、受管 Testcontainers、受管 browser L2、fresh reset/seed 与回归证据收集。

需要特别披露一条证据边界：此前的 18/18 L2 PASS 运行产物中，历史 `runtime-state.json` 曾保存诊断 secret/HMAC。当前代码已改为持久化 runtime state 时剥离这两类凭据，并新增静态回归；修复后的 runner 尚未重新执行一次 fresh L2。因此历史 L2 的业务结果可以作为对应旧代码版本的行为证据，但不能把它写成“修复后 artifact hygiene 已经动态验证”。本轮请独立判断这一证据边界的严重性。

Dexter 已明确授权：seed 后 DEV 页面可见性不纳入本轮阻断，也不要求本轮补做该项；请不要把该项作为本轮 `M` finding。仍请核验已有 DEV seed/API/readback 证据与本轮其他需求、详设和实现是否一致。

## 评审目标

请以 fresh、独立、证伪式立场 review 当前销售菜单实现结果，确认：

1. 当前 backend owner、contract/generated edge、frontend operations-admin、fixture/seed、L2 runner 与已有 foundation 是否共同实现了批准的需求、IA、交互详设和 implementation plan；
2. 31 条受影响 operation、19 条 command、38 条 owner rule、15 个本批 backend scenario、18 个 L2 case 与实际源码/真实运行证据是否一一闭合；
3. UI 行为是否来自批准 Journey，使用已有 foundation 和同类模块的既有形态，控件是否由真实动作节点上的稳定 testId 驱动；
4. 失败/成功、read-model、scope、事务、CAS、幂等、媒体关系、排序、发布/激活/手工售罄与恢复等边界是否有正确 oracle；
5. 永久 source binding 限定为 `apps/backend`、`apps/frontend` 是否与本轮目标一致，且没有把 `apps/terminal` 或其他工程变更误纳入销售菜单结论；
6. 现有静态与动态证据是否足以支持实施结果 review；对尚未由 fresh 动态运行证明的内容，请明确标记 `UNVERIFIED_REQUIRES_EVIDENCE`，不要用静态 PASS 代替动态 PASS。

请同时从方案合理性审查：它是否解决用户真正要解决的问题，是否存在更简单直接的替代方案，以及当前复杂度和验证成本是否匹配；不要只检查“代码与文档是否形式上相同”。

## 需阅读文件

请从 `catering-v2s` 仓库根打开以下相对路径：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：仓库边界、AI 协作、运行拓扑和 review 入口；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-requirements-analysis-claude.md`：原始需求与需求分析；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`：IA 与交互基准；
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`、`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`：批准的实现设计、31-operation 矩阵、owner rule 分母、15/18 场景分母与 SM-12 判据；
- `doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/browser-l2-execution-standard.md`：Java、前端、L2 及 artifact/cleanup 规范；
- `project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/verification-governance.md`、`project-memory/operations/test-closed-loop.md`、`project-memory/operations/execution-economics-and-failure-family-closure.md`、`project-memory/operations/ui-testid-preflight-before-l2.md`、`project-memory/operations/l2-read-model-settle-before-control-binding.md`：独立 review、证据分层、失败族、testId 与 read-model 约束；
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuCommandApi.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuOwnerApi.java`：sales-menu owner、command 与查询边界；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java`：真实 HTTP edge 与 generated operation 接线；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AssetAcceptanceScenarios.java`：本批 15 个真实 HTTP 业务场景及 fixture/readback oracle；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.ts`、`apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuCommands.ts`、`apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`：前端页面、读模型、命令和 testId 唯一源；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts`、`apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.test.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.test.ts`、`apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts`、`apps/frontend/operations-admin/src/tests/l2/operationsL2.ts`：UI focused、模型和 18-case L2 行为；
- `contracts/openapi/paths/operations-admin/sales-menu.paths.json`、`contracts/policy/sales-menu-l2-case-blueprint.json`、`contracts/policy/sales-menu-l2-scenarios.json`、`contracts/policy/sales-menu-l2-fixture.json`、`contracts/policy/sales-menu-l2-locator-bindings.json`、`contracts/policy/sales-menu-l2-execution.json`：唯一契约、L2 分母、fixture、locator 与当前 profile；
- `scripts/generate/sales-menu-p1.mjs`、`scripts/test/browser-l2-runtime.mjs`、`scripts/test/browser-l2-runtime.test.mjs`：覆盖声明生成、受管 L2、永久 binding、cleanup 与 secret-safe runtime state；
- `scripts/dev/sales-menu-seed-plan.mjs`、`scripts/dev/sales-menu-seed-executor.mjs`、`scripts/dev/r5-complete-seed-executor.mjs`：seed truth table、执行器、readback 与 parent stage closure；
- `doc/evidence/platform/2026-09-01-v2s-sales-menu-implementation-evidence-codex.md`：实现过程与当前证据索引；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788513077533-56187/run-manifest.json`：99 条 backend 回归、268/268 operation set、budget 与 cleanup 结果；
- `.runtime/r5/seed/complete/complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a/run-manifest.json`、`.runtime/r5/seed/sales-menu/sales-menu-seed-0533d518-6b1f-4a89-8548-0bd7bc537281/seed-report.md`：fresh reset 后 r5-full parent/child seed 与 sales-menu readback；
- `.runtime/browser-l2/l2-1788510438441-23307-c67f43ca-26c8-4ba7-a29a-d593a000b583/l2-execution-manifest.json`、`.runtime/browser-l2/l2-1788510438441-23307-c67f43ca-26c8-4ba7-a29a-d593a000b583/l2-join-artifact.json`、`.runtime/browser-l2/l2-1788510438441-23307-c67f43ca-26c8-4ba7-a29a-d593a000b583/repository-byte-binding.json`：历史 18/18 L2 业务/cleanup、case/action join 与永久 binding 证据；阅读时须结合上面的“历史 artifact secret/HMAC 泄漏、修复后未 fresh L2”边界。

## 独立核验重点

- 先独立从需求、IA、交互和详设推导用户任务，再对照当前代码；逐项核验行为、入口/形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界。
- 对照 `SalesMenuOwnerService` 与同类模块，确认 owner 事实、scope/capability 再核验、`REQUIRED` 事务、CAS/幂等、错误闭集、operation record、媒体 include/exclude、排序和发布冻结语义没有被测试便利性改变。
- 独立复算 31/19/38、15、18；确认 31 operation identity 与详设 §5、§11.1a、backend actual completion event、L2 action join 的实际成员相等，而不是只看数量、字符串或 2xx。
- 核验 15 个 backend scenario 的 fixture 分母与反例是否完整，尤其是 BusinessChannel 的 DINE_IN、PROJECT 级不合格、STORE GROUP_BUY 不合格、EXTERNAL TAKEAWAY 不合格，以及 Asset copy/media 关系；不要把未独立证明的 PASS 当作完成证据。
- 核验 UI 是否复用 `libraries/frontend/admin-ui-foundation` 已有能力；每个 L2 操作是否使用 `salesMenuTestIds.ts` 的唯一、稳定、绑定真实动作节点的 testId；异步 owner read-model 是否先按精确身份收敛，再绑定控件；不得用 role/label/text/index/宽 locator、HTTP 计数增量、固定 sleep 或加长 timeout 止血。
- 核验 L2 runner 的 persisted runtime state 是否只保留路径和非 secret 元数据，secret/HMAC 是否不再写入 `runtime-state.json`/shared pointer，且 65/65 静态回归是否覆盖该保护；同时明确指出“修复后尚未 fresh L2”对结论的影响。
- 核验 repository byte binding 的永久范围恰为 `apps/backend`、`apps/frontend`，当前 1451 个 input files 无 outside-scope 文件；不要把 `apps/terminal` 的并行工作混入销售菜单实现 verdict，也不要擅自扩大本轮 binding 范围。
- 将 backend business、L2 business、seed business、各自 cleanup、静态/编译/typecheck 与未执行项分开判读；不要把 DEV seed、Testcontainers 或历史 L2 证据互相替代，也不要把当前 `FRAMEWORK_ONLY` active profile 误写成历史 FULL L2 已重新执行。
- 本轮按 Dexter 授权不把 seed 后 DEV 页面可见性作为阻断；若发现其他 UI/用户任务偏差，仍须单独指出其 owning source 与影响。
- 不要求 Git 操作；不扩展到 terminal/TDP/UAT/部署/切流，不修改生产语义或数据模型。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并给出 `M` / `S` / `N` 数量。每条 finding 请包含：精确相对文件路径与行号、事实与推论的区分、影响范围、最小修复建议、是否需要 Dexter 产品/Journey 裁决，以及该项是 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 还是 `UNVERIFIED_REQUIRES_EVIDENCE`。

请特别说明：

- 你是否接受当前实现的方案合理性，而不只是接受机器门和 PASS 数字；
- 历史 L2 artifact secret/HMAC 问题在当前代码修复、但未 fresh 动态重跑的情况下应如何定级；
- 永久两目录 source binding 是否满足本轮目标，且是否存在超出授权范围的 scope 误读；
- 除了 Dexter 已明确排除的 seed 后 DEV 页面可见性外，是否仍有任何需求/详设/当前代码/真实证据之间的 OPEN mismatch。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 catering-v2s 本次销售菜单整体实现结果做一次 fresh、独立、证伪式的 IMPLEMENTATION review。

背景：本轮是销售菜单实现结果 review，不是新的需求设计，也不是扩大实现范围。范围永久限定在 `apps/backend` 与 `apps/frontend`；browser L2 repository byte binding 也永久只绑定这两个目录，不包含 `apps/terminal`。本轮不新增产品语义、Journey、权限、operation、数据模型、预算例外、UAT、部署或切流。此前 L2 反复失败的根因已按失败族修复：HTTP 事件计数不再作为 UI 就绪判据，异步 read-model 控件绑定已统一等待，operation 覆盖声明已双向校验，fixture/seed/readback 与 typed helper 已收敛。

目标：请独立核验当前 backend owner、contract/generated edge、operations-admin 前端、foundation 复用、fixture/seed、L2 runner 与真实运行证据是否共同满足批准的需求、IA、交互详设和 implementation plan；重点复算 31 operations、19 commands、38 owner rules、15 个本批 backend scenarios、18 个 L2 cases，以及 31-operation 的实际 acceptance/L2 completion mapping。请同时判断方案是否合理、是否存在更简单替代、复杂度和验证成本是否匹配。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：仓库边界、运行拓扑和 review 入口；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-requirements-analysis-claude.md`：原始需求；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`：IA/交互基准；
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`、`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`：详设、计划、分母和 SM-12 判据；
- `doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/browser-l2-execution-standard.md`：后台、前端和 L2 规范；
- `project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/verification-governance.md`、`project-memory/operations/test-closed-loop.md`、`project-memory/operations/execution-economics-and-failure-family-closure.md`、`project-memory/operations/ui-testid-preflight-before-l2.md`、`project-memory/operations/l2-read-model-settle-before-control-binding.md`：独立 review、证据、失败族、testId 和 read-model 规则；
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuCommandApi.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuOwnerApi.java`：owner/command/query；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java`：HTTP edge；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AssetAcceptanceScenarios.java`：15 个真实 acceptance 场景；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.ts`、`apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuCommands.ts`、`apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`：页面、读模型、命令和 testId；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts`、`apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.test.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.test.ts`、`apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts`、`apps/frontend/operations-admin/src/tests/l2/operationsL2.ts`：focused/L2 行为；
- `contracts/openapi/paths/operations-admin/sales-menu.paths.json`、`contracts/policy/sales-menu-l2-case-blueprint.json`、`contracts/policy/sales-menu-l2-scenarios.json`、`contracts/policy/sales-menu-l2-fixture.json`、`contracts/policy/sales-menu-l2-locator-bindings.json`、`contracts/policy/sales-menu-l2-execution.json`：契约、分母、fixture、locator、profile；
- `scripts/generate/sales-menu-p1.mjs`、`scripts/test/browser-l2-runtime.mjs`、`scripts/test/browser-l2-runtime.test.mjs`：L2 生成、runner、永久 binding、cleanup 和 secret-safe state；
- `scripts/dev/sales-menu-seed-plan.mjs`、`scripts/dev/sales-menu-seed-executor.mjs`、`scripts/dev/r5-complete-seed-executor.mjs`：seed plan、执行器和 readback；
- `doc/evidence/platform/2026-09-01-v2s-sales-menu-implementation-evidence-codex.md`：实现证据索引；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788513077533-56187/run-manifest.json`：99/99 backend 回归、268/268 operation set、budget、cleanup；
- `.runtime/r5/seed/complete/complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a/run-manifest.json`、`.runtime/r5/seed/sales-menu/sales-menu-seed-0533d518-6b1f-4a89-8548-0bd7bc537281/seed-report.md`：fresh reset 后 r5-full seed/readback；
- `.runtime/browser-l2/l2-1788510438441-23307-c67f43ca-26c8-4ba7-a29a-d593a000b583/l2-execution-manifest.json`、`.runtime/browser-l2/l2-1788510438441-23307-c67f43ca-26c8-4ba7-a29a-d593a000b583/l2-join-artifact.json`、`.runtime/browser-l2/l2-1788510438441-23307-c67f43ca-26c8-4ba7-a29a-d593a000b583/repository-byte-binding.json`：历史 18/18 L2、join 和 binding 证据。

请重点独立核验：
1. 先从需求/IA/交互/详设推导用户任务，再逐项对读当前代码的行为、入口/形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界；
2. 对照 owner source 与同类模块复核 scope/capability、事务、CAS/幂等、错误、operation record、媒体关系、排序、发布/激活/售罄/恢复；
3. 复算 31/19/38、15、18，验证 31 operation 的真实 acceptance completion 与 L2 action join 成员，不要只看数量、字符串或 2xx；
4. 核验 BusinessChannel 的 DINE_IN、PROJECT 级不合格、STORE GROUP_BUY 不合格、EXTERNAL TAKEAWAY 不合格及 Asset copy/media 反例；
5. 核验 foundation 复用、真实动作节点 testId、read-model 先收敛后控件绑定；不得用宽 locator、固定 sleep、HTTP 计数增量、放宽 oracle 或加长 timeout；
6. 核验 runner 持久化 runtime state 已剥离诊断 secret/HMAC，且静态 65/65 回归覆盖该保护；同时注意修复后还没有 fresh L2，所以不要把历史 L2 直接写成修复后动态证明；
7. 核验 repository byte binding 永久只含 `apps/backend`、`apps/frontend`，不要把 `apps/terminal` 或其他工程并行变更混入本结论；
8. 分开判断静态、backend business、L2 business、seed business、cleanup 与未执行项。当前 profile 是 `FRAMEWORK_ONLY`，历史 FULL L2 证据请按上面的 run 目录读取；不要把 DEV 页面可见性列为本轮阻断，这是 Dexter 已明确排除的项。

烦请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请写精确相对路径与行号、事实与推论、影响面、最小修复、是否需要 Dexter 产品/Journey 裁决，并标记 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE`。请明确说明方案合理性、历史 artifact secret/HMAC 问题的定级、永久两目录 source binding 是否满足目标，以及除 DEV 页面可见性外是否还有 OPEN mismatch。

授权边界：本次 review 只用于判断销售菜单当前实现结果，不授权任何代码/文档/数据修改、Git 操作、reset、seed、DEV/Testcontainers/browser 动态运行、UAT、部署、切流或扩大到 terminal/TDP；Claude 的 GO 也不自动等于产品批准或交付完成。谢谢。
```
