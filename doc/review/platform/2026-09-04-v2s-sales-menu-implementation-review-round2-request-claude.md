REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=V2S-SALES-MENU-IMPLEMENTATION-2026-09-04
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_INDEPENDENT

## 背景

这是同一 `REVIEW_CYCLE_ID` 的第二轮、也是最后一轮销售菜单整体实现结果 review。本轮不是新的需求设计，
不扩大 implementation scope。范围永久限定为 `apps/backend` 与 `apps/frontend`；browser L2 的 repository byte
binding 也只绑定这两个目录的 input files，不包含 `apps/terminal`。不新增产品语义、Journey、权限、operation、
数据模型、预算例外、UAT、部署或切流。

第一轮 Claude review 的结论为 `NO-GO; M=0; S=2; N=2`：没有 major 缺陷；S-2 是修复 persisted runtime state
后尚未 fresh L2 的证据缺口；N-1 是销售菜单 query-backed list 没复用既有 `adminListState`。N-1 已在现有
foundation 边界内修复，未引入新抽象。修复后已完成静态验证，并按既有受管拓扑完成一次 fresh full browser L2。

此前反复失败的已确认失败族也不再按实例修补：HTTP 事件计数没有作为 UI 就绪判据；控件查找统一通过既有
`waitForBoundControl` 先等待异步 read-model；operation coverage 生成器双向校验声明与实际网络范围；fixture、
seed、typed helper 与永久 source binding 均保留既有仓内边界。

## 评审目标

请以 fresh、独立、证伪式立场重新核验当前销售菜单实现及本轮新鲜证据，重点判断第一轮 S-2 是否已由 fresh
full L2 闭合、N-1 是否确已修复，以及是否还存在需求、详设、真实源码与动态证据之间的 OPEN mismatch。

请同时判断：

1. backend owner、contract/generated edge、operations-admin、foundation、fixture/seed、L2 runner 是否共同实现批准的需求、IA、交互详设和 implementation plan；
2. 31 条受影响 operation、19 条 command、38 条 owner rule、15 个本批 backend scenario 与 18 个 L2 case 的口径和实际证据是否一致；
3. fresh L2 的 18/18 case、342 control touches、18 action start/complete、HTTP/后端 join、expected negative path 与 cleanup 是否形成有效业务证据；
4. `adminListState` 修复是否覆盖全部适用 query-backed Table，失败 Alert/retry、loading、empty 是否互斥，是否错误改动了本地 editor SKU Table；
5. 方案是否合理、是否复用了同类模块和 foundation、复杂度是否与当前阶段匹配；S-1 的大文件拆分是否应保持为 SM-06 之前的非当前阻断项；
6. 永久两目录 source binding、fresh artifact secret/HMAC 保护与当前执行拓扑是否满足授权边界。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：执行边界、拓扑、独立 review 与证据规则；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-requirements-analysis-claude.md`：原始需求与分析；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`：IA 与交互基准；
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`、`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`：详设、分母和收口判据；
- `doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/browser-l2-execution-standard.md`：后台、前端、L2 规范；
- `project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/verification-governance.md`、`project-memory/operations/test-closed-loop.md`、`project-memory/operations/execution-economics-and-failure-family-closure.md`、`project-memory/operations/ui-testid-preflight-before-l2.md`、`project-memory/operations/l2-read-model-settle-before-control-binding.md`：review、证据、失败族、testId、read-model 约束；
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuCommandApi.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuOwnerApi.java`：owner、command、query；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java`：真实 HTTP edge；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AssetAcceptanceScenarios.java`：backend 场景、fixture 与 readback；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.ts`、`apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuCommands.ts`、`apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`：页面、读模型、命令、唯一 testId 源；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts`、`apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.test.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.test.ts`、`apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts`、`apps/frontend/operations-admin/src/tests/l2/operationsL2.ts`：UI、模型、L2 行为与 async control binding；
- `contracts/openapi/paths/operations-admin/sales-menu.paths.json`、`contracts/policy/sales-menu-l2-case-blueprint.json`、`contracts/policy/sales-menu-l2-scenarios.json`、`contracts/policy/sales-menu-l2-fixture.json`、`contracts/policy/sales-menu-l2-locator-bindings.json`、`contracts/policy/sales-menu-l2-execution.json`：契约、31-operation 分母、fixture、locator、profile；
- `scripts/generate/sales-menu-p1.mjs`、`scripts/test/browser-l2-runtime.mjs`、`scripts/test/browser-l2-runtime.test.mjs`：覆盖生成、永久 binding、受管 L2、cleanup、secret-safe runtime state；
- `scripts/dev/sales-menu-seed-plan.mjs`、`scripts/dev/sales-menu-seed-executor.mjs`、`scripts/dev/r5-complete-seed-executor.mjs`：seed truth table、执行、readback、parent closure；
- `doc/evidence/platform/2026-09-01-v2s-sales-menu-implementation-evidence-codex.md`：当前实现与证据索引，尤其 2026-09-04 section；
- `doc/review/platform/2026-09-04-v2s-sales-menu-implementation-review-claude.md`：第一轮 Claude 独立结论；
- `.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/l2-execution-manifest.json`、`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/l2-join-artifact.json`、`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/l2-cleanup-manifest.json`、`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/http-request-events.jsonl`、`.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/repository-byte-binding.json`：修复后的 fresh full L2、join、cleanup、HTTP operation stream 与 binding；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788513077533-56187/run-manifest.json`、`.runtime/r5/seed/complete/complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a/run-manifest.json`、`.runtime/r5/seed/sales-menu/sales-menu-seed-0533d518-6b1f-4a89-8548-0bd7bc537281/seed-report.md`：既有 backend acceptance、fresh reset/seed 与 cleanup 支撑证据。

## 独立核验重点

- 不采信本 brief 的结论，重新从需求、IA、交互、详设和 memory 推导用户任务，再逐点核对 owner、edge、frontend、fixture、seed、L2 源码与运行产物的行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据源/失效边界。
- 对 `SalesMenuPage.tsx` 的五个 query-backed Table 逐一确认 `adminListState`、failed/empty/loading 互斥、retry 路径和 list testId；确认两个本地 SKU editor Table 的不改动是适用边界而不是遗漏。
- 从 `contracts/policy/sales-menu-l2-case-blueprint.json` 的唯一 `operationCoverage[].operationId` 集合独立得到 31；与 fresh `http-request-events.jsonl` 中的 operationId 做成员相等核验。该 run 的 31/31 均出现、相关 HTTP 事件为 466；410 个 200、54 个 201，以及 1 个 404 和 1 个 409 是由通过的负向 oracle 覆盖的预期响应，不要只按 2xx 计数。
- 逐 case 核对 fresh `l2-execution-manifest.json` 与 `l2-join-artifact.json`：18 discovered/selected/results/executed、notRun=0、18 action start/complete、342 control touches、join complete、缺失/越权 control=0、invalid case event=0、firstFailure=null、business=PASS；再单独核对 `l2-cleanup-manifest.json` 的 cleanup=PASS。
- 核对 persisted runtime state 修复和 `scripts/test/browser-l2-runtime.test.mjs` 的 65/65 静态回归；确认 fresh run 的 runtime/execution/join/cleanup/binding JSON 没有 `secret` 或 `hmac` 字段，并把历史 artifact 与修复后 artifact 分开定级。
- 核对 `repository-byte-binding.json` 的 `apps/backend`、`apps/frontend` 两目录永久范围，1451 input files、12555992 bytes、outsideScope=0；不要把 `apps/terminal` 或其他并行工程变更混入本轮 verdict。
- 将 static/typecheck/architecture、backend acceptance、seed business、browser L2 business、各自 cleanup 与未执行的 DEV 页面可见性/UAT/部署分别判读。DEV 页面可见性是 Dexter 明确排除的项，不作为 M finding；SM-06–SM-12 也不因本轮 SM-05 证据而自动宣称完成。
- 对 N-2 的 backend scenario 精确枚举如无法仅靠现有公开构造与 fresh 产物可靠复算，请明确 `UNVERIFIED_REQUIRES_EVIDENCE`，不要用探针数字或作者声明替代证据。

## 期望结论

请明确给出 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请包含精确仓库相对路径与行号、事实与推论区分、影响范围、最小修复建议、是否需要 Dexter 产品/Journey 裁决，以及 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE` 状态。

请特别回答：第一轮 S-2 是否已由本轮 fresh L2 闭合；第一轮 N-1 是否完整修复；方案是否合理且没有重复造轮子；永久两目录 binding 是否满足目标；除 Dexter 已排除的 DEV 页面可见性、以及明确标为 SM-06 后处理的 S-1 外，是否仍有 OPEN mismatch。第二轮是本 review cycle 的硬停止轮次，不得通过改名或改文件重新开启第三轮。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 catering-v2s 本次销售菜单整体实现结果做同一 review cycle 的第二轮、也是最后一轮 fresh、独立、证伪式 IMPLEMENTATION review。

背景：第一轮结论是 NO-GO，M=0、S=2、N=2，没有 major 缺陷。S-2 只是 persisted runtime state 修复后缺少 fresh L2；N-1 是 query-backed list 未复用既有 adminListState。现在 N-1 已在现有 foundation 边界内修复，且修复后已完成一次受管 fresh full browser L2。范围永久限定为 `apps/backend` 与 `apps/frontend`，browser L2 byte binding 也只绑定这两个目录的 input files，不包含 `apps/terminal`。不新增产品语义、Journey、权限、operation、数据模型、预算例外、UAT、部署或切流。

目标：请独立判断第一轮 S-2 是否已被 fresh 动态证据闭合、N-1 是否已完整修复，并重新核验当前 owner、contract/generated edge、operations-admin、foundation、fixture/seed、L2 runner 与真实产物是否共同满足批准需求、IA、交互详设和 implementation plan。请复算 31 operations、19 commands、38 owner rules、15 个 backend scenario、18 个 L2 case，并判断方案合理性、foundation 复用、真实 testId/read-model 绑定、cleanup 和永久两目录 source binding。请把静态、backend business、seed business、L2 business、cleanup 与未执行项分开判读。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-requirements-analysis-claude.md`；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`、`doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`；
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`、`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`；
- `doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/browser-l2-execution-standard.md`；
- `project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/verification-governance.md`、`project-memory/operations/test-closed-loop.md`、`project-memory/operations/execution-economics-and-failure-family-closure.md`、`project-memory/operations/ui-testid-preflight-before-l2.md`、`project-memory/operations/l2-read-model-settle-before-control-binding.md`；
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuCommandApi.java`、`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuOwnerApi.java`；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java`；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AssetAcceptanceScenarios.java`；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.ts`、`apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuCommands.ts`、`apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`、`apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts`、`apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.test.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.test.ts`、`apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts`、`apps/frontend/operations-admin/src/tests/l2/operationsL2.ts`；
- `contracts/openapi/paths/operations-admin/sales-menu.paths.json`、`contracts/policy/sales-menu-l2-case-blueprint.json`、`contracts/policy/sales-menu-l2-scenarios.json`、`contracts/policy/sales-menu-l2-fixture.json`、`contracts/policy/sales-menu-l2-locator-bindings.json`、`contracts/policy/sales-menu-l2-execution.json`；
- `scripts/generate/sales-menu-p1.mjs`、`scripts/test/browser-l2-runtime.mjs`、`scripts/test/browser-l2-runtime.test.mjs`、`scripts/dev/sales-menu-seed-plan.mjs`、`scripts/dev/sales-menu-seed-executor.mjs`、`scripts/dev/r5-complete-seed-executor.mjs`；
- `doc/evidence/platform/2026-09-01-v2s-sales-menu-implementation-evidence-codex.md` 与第一轮报告 `doc/review/platform/2026-09-04-v2s-sales-menu-implementation-review-claude.md`；
- fresh L2 产物目录 `.runtime/browser-l2/l2-1788516930685-55751-c1d57da4-83fd-475a-af70-e5fc13f85c0b/` 下的 `l2-execution-manifest.json`、`l2-join-artifact.json`、`l2-cleanup-manifest.json`、`http-request-events.jsonl`、`repository-byte-binding.json`；以及 backend/seed 产物 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788513077533-56187/run-manifest.json`、`.runtime/r5/seed/complete/complete-seed-4ef512cf-e50a-4c51-80d2-f911c38bf69a/run-manifest.json`、`.runtime/r5/seed/sales-menu/sales-menu-seed-0533d518-6b1f-4a89-8548-0bd7bc537281/seed-report.md`。

请重点独立核验：
1. 从需求/IA/交互/详设推导用户任务，再逐项对读 owner、edge、frontend、fixture、seed、L2 源码与证据的行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据源/失效边界；
2. `SalesMenuPage.tsx` 五个 query-backed Table 是否都使用既有 `adminListState` 且 failed/loading/empty 互斥，两个本地 SKU editor Table 是否正确保持不变；
3. 从 blueprint 的唯一 `operationCoverage[].operationId` 集合复算 31，并与 fresh `http-request-events.jsonl` 核对：31/31 ID 出现，相关 HTTP 事件 466；410x200、54x201，以及由通过负向 oracle 覆盖的 1x404、1x409 不得被误读；
4. fresh execution/join/cleanup 是否为 18/18、notRun=0、18 action start/complete、342 control touches、join COMPLETE、firstFailure=null、business PASS、cleanup PASS，且 missing/unexpected control 与 invalid case event 为 0；
5. runtime state 的 secret/HMAC 剥离和 65/65 回归；fresh JSON 是否没有 `secret`/`hmac` 字段；历史 artifact 与修复后 artifact 必须分开定级；
6. binding 是否永久仅含 `apps/backend`、`apps/frontend`，1451 input files、12555992 bytes、outsideScope=0；不要把 `apps/terminal` 混入；
7. backend acceptance、seed、cleanup、DEV 页面可见性、UAT/部署分别判读。DEV 页面可见性是 Dexter 明确排除项，不作为 M；SM-06–SM-12 不因本轮自动完成；场景精确枚举无法可靠复算时写 `UNVERIFIED_REQUIRES_EVIDENCE`，不要猜数字。

烦请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请给出精确仓库相对路径与行号、事实与推论、影响范围、最小修复建议、是否需要 Dexter 产品/Journey 裁决，并标记 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE`。请明确回答第一轮 S-2 与 N-1 是否闭合、方案是否合理、是否还有 OPEN mismatch。此为同一 review cycle 的第二轮硬停止，不得通过改名或局部修订开启第三轮。

授权边界：本次只授权对当前销售菜单实现结果做只读独立 review，不授权任何代码、文档、数据、Git、reset、seed、DEV/Testcontainers/browser 动态运行、UAT、部署、切流或扩大到 `apps/terminal`/TDP。Claude 的 GO 也不自动等于产品批准或其他模块完成。谢谢。
```
