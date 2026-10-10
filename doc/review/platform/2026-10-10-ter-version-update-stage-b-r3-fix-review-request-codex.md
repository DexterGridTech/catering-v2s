# TER 版本更新阶段 B R3 修复差量 Claude review 请求

## 背景

Claude 对阶段 B 当前源码独立复评为 `NO-GO, M/S/N=0/4/2`，涉及自然启动时无任务版本报告、报告 HTTP 失败分类、规则刷新期间固定旧候选、CAS 冲突动作一致性、snapshot typed retry 与详情分页。主 agent 已逐项重开需求、详设、计划、IA/UI、owning source 和直接测试，确认并修复六项；逐项分类及局部验证见 intake。旧 verdict 保留在原审查字节边界，不被作者处置替代。

## 评审目标

请只对下列六项修复差量的当前生产源码与直接测试作独立静态复评：判断根因是否真正关闭、是否破坏已有 owner/contract 行为、是否有同根遗漏或更小修法。finding intake 由主 agent 完成，不要求 Claude 重写作者分类。此次复评不要求运行测试、构建、verify、DEV、设备或其他动态环境，也不要求索取运行 evidence。测试源码只能作为断言设计材料，不能视为测试已通过。

## 需阅读文件

- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-rereview-claude.md`：上一轮独立 findings 与证据边界。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-rereview-intake-r3-codex.md`：主 agent 当前字节的逐项 disposition、修复及局部验证边界；仅作为作者说明，不能代替独立判断。
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：正式行为要求，重点 R-14、R-15 及报告语义。
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`：规则快照、报告分类和刷新判据。
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：阶段 B 批准范围与既有执行边界。
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md`、`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md`：后台 CAS 与 CursorPagination 交互判据。
- `scripts/generate/terminal-client-api.mjs`、`apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`、`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`：生成 API、HTTP status 与 TDC 实际调用链。
- `apps/terminal/kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts`、`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`：规则刷新、taskless observation、target acceptance、报告处置和 snapshot retry。
- `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/generatedTerminalApi.test.ts`：直接反例与结果分类断言。
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerService.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java`：snapshot changed 的 owner 与错误映射。
- `apps/backend/catering-business-server/modules/terminal-update/src/test/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerServiceTest.java`、`apps/backend/catering-business-server/src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java`：后端 focused 测试源码；advice mapping 本轮未运行。
- `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`、`apps/frontend/operations-admin/src/features/terminal-update/model/terminalUpdateRuleStatus.ts`、`apps/frontend/operations-admin/src/features/terminal-update/model/terminalUpdateRuleStatus.test.ts`、`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.static.test.ts`：精确 CAS 与详情分页消费。
- `libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts`、`libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx`：复用的 cursor stack 与分页控件。

## 独立核验重点

1. **无任务版本报告**：startup/PRIMARY-ready 早于 store/project context 时，状态变化后的 refresh 是否会在完整 snapshot ready 后幂等观察实际版本；新 binding 是否用 `taskId=null`，不继承旧 task/rule/artifact 关联。
2. **报告失败分类**：生成器、generated API、TDC 返回值与 report owner 是否贯穿完成 HTTP 的 status；无合法 problem 的 401/403、坏 200、其他 4xx、5xx 与未送达网络失败是否按详设分流。
3. **规则刷新竞态**：同 context refresh pending 时，旧 ready snapshot 是否仍可能被 `acceptTerminalUpdateTargetCommand` 固定；检查最终准入的真实路径及其测试屏障。
4. **CAS**：只有精确 VERSION_CONFLICT 是否 readback；readback 后标题、按钮、再次提交是否都保持用户原 intent 并使用新 revision；其他 409 是否保留原语义。
5. **snapshot retry**：CBS owner→edge problem→generated client→actor 是否使用同一个 `TERMINAL_UPDATE_SNAPSHOT_CHANGED`；是否仅对该 typed error 在原三次预算内重启完整快照。
6. **详情分页**：门店详情与报告历史是否复用 foundation CursorPagination/useCursorStack，防止重复请求/重复追加，并使失效 context/detail 的迟到页结果不落入当前 Drawer。

请只依据当前源码、正式判据与测试设计形成判断。作者 intake 中局部运行结果仅标明边界，不构成要求重跑或索取运行 evidence 的理由。CBS `ContractProblemAdviceTypedOwnerMappingTest` 本机执行被 `V2S_TESTCONTAINERS_REMOTE_REQUIRED` 门拒绝；本次请求不要求改门或绕过门。

## 期望结论

请明确给出 `GO` 或 `NO-GO` 与 `M/S/N`。每项 finding 附当前文件和行号、事实与推论、影响、最小修正及是否需要 Dexter 产品裁决。区分静态源码结论与未运行项；本请求不覆盖阶段 B 整批动态交付或 Stage C。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 B 的 R3 修复差量进行独立静态复评。

背景：上一轮当前源码复评为 NO-GO，M/S/N=0/4/2。主 agent 已逐项重开正式需求、阶段 B 详设/计划、IA/UI、owning source 与直接测试，确认并最小修复六项 finding。旧 verdict 只属于上一轮被审字节，不由作者 intake 覆盖。
目标：独立判断六项修复是否真正闭合、是否有同根遗漏或回归；主 agent 已完成 finding intake，本轮不要求重做作者分类。请只审当前生产源码和直接测试，不运行或索取测试、构建、verify、DEV、设备或其他动态 evidence。

请从 catering-v2s 仓库根阅读：
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-rereview-claude.md`：上一轮 findings 与证据边界；
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-rereview-intake-r3-codex.md`：作者逐项处置，仅作导航，不作为独立证据；
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：正式行为要求；
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md` 与 `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：实现判据与范围；
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md` 与 `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md`：CAS 与详情分页判据；
- `scripts/generate/terminal-client-api.mjs`、`apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`、`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`；
- `apps/terminal/kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts`、`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts` 及对应的 `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/generatedTerminalApi.test.ts`；
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerService.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java` 及对应测试源码；
- `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`、相关 model/tests 与 `libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts`、`cursorPagination.tsx`。

请重点独立核验：
1. store/project context 晚于 startup/PRIMARY-ready 时，无任务报告是否在完整 snapshot ready 后幂等生成，且新 binding 不继承旧 task 身份；
2. generated API→TDC→更新 owner 是否保留已完成 HTTP 的 status，并区分身份拒绝、协议终态、5xx 与未送达网络失败；
3. 同 context 规则 refresh pending 时旧 snapshot 是否无法被固定；
4. CAS 是否只处理精确 VERSION_CONFLICT，且 readback 后标题、按钮、提交仍使用用户原 intent；
5. SNAPSHOT_CHANGED 是否从 CBS owner 到 actor 精确闭合，并仅在既有三次预算内重读完整快照；
6. 规则门店和报告历史是否复用 CursorPagination/useCursorStack，隔离重复/迟到页请求。

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。Findings 请包含当前文件/行号、影响、最小修正及是否需 Dexter 产品裁决。不要要求本轮索取或重跑 runtime evidence；CBS advice mapping 单测受远端 Testcontainers guard 限制，本轮保持未运行。

授权边界：本轮只请求当前修复差量的静态源码复评，不授权阶段 C、完整动态验收、DEV、设备、reset/seed、L2、UAT 或部署。谢谢。
```
