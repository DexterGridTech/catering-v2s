# TER 版本更新阶段 C 中期实施源码评审交接 · 2026-10-11

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=INTERIM_IMPLEMENTED_SUBSET_ONLY
REVIEW_MODE=STATIC_SOURCE_ONLY
RUNTIME_EVIDENCE_REVIEW=NOT_REQUESTED
IMPLEMENTATION_STATUS=INCOMPLETE
```

## 背景

阶段 C 实施已推进到 CP-01～CP-06 的代码范围，并已有各 CP 阶段对账与整批 6b 记录；这些记录只证明各自记录字节范围的静态对账，不是阶段 C 整批实现 GO，也不替代当前源码 review、13c、动态业务验收或 cleanup。CP-05/06 的收口包含当前唯一 automation 入口、两类主要 case、project-basic/store-basic owner、终端更新供给链以及 README/skill 同步。

Dexter 已要求暂停当前实施与动态测试，先由 Claude 对已经实施的代码做阶段性 review，借此找出同根实现问题，减少继续反复运行。阶段 C 尚未完成交付。

当前最新受管 run `f5c94ca9-b13d-49c9-a3d8-bbded2ae8a9a` 已结束，manifest 状态为 `FINISHED`，`business=FAIL`、`cleanup=PASS`。症状是终端上报得到 HTTP 200，receipt 的 task identity 与提交 payload 相符；随后运营后台历史页分页读取到 43 条记录，但没有找到该 taskId 或匹配的当前业务事实，场景断言失败。根因尚未确认。本段只作为源码 review 的定位上下文；本轮不请 Claude 重读或评判 `.runtime/`、历史日志或运行证据。

此前同一业务断言失败族已经重复出现。按 Dexter 指示，本轮暂停动态测试；请勿要求重跑 runner、其他设备、DEV 或完整验收来完成本轮静态 review。

## 评审目标

请 Claude 以 `REVIEW_TARGET=IMPLEMENTATION` 对**当前已实施子集**作独立、只读、静态源码对抗 review：先从当前正式需求、阶段 C 详设和计划独立推导预期行为，再核对真实生产 owner、调用者、生成契约、直接测试与 automation runner。重点判断实现是否正确、职责是否仍在规定层内、两个主要 Journey 的源码链是否闭合，以及是否有更简单的修法。

特别检查终端报告提交到后台历史读回的代码链：终端 payload/序号与凭证上下文 → generated HTTP client → CBS edge controller/credential 验证 → terminal-update owner 与数据库持久化 → 历史查询 API/分页 → operations-admin 展示。上面的运行现象只帮助定位这条链，不要求证据复核，也不能仅凭静态源码宣称动态问题已解决。

本次结论只适用于 `INTERIM_IMPLEMENTED_SUBSET_ONLY`。不得推导 CP-01～06 当前全量 MATCHED、全批 6b 当前字节闭合、13c 完成、Stage C 整批 GO 或动态验收通过。未执行的动态状态仍为 `NOT_RUN` 或沿用原记录，不升级为 PASS。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：阶段 C 正式需求及阶段边界。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`：阶段 C owner、绑定/解绑、候选、任务和验收判据。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：CP-01～CP-06 顺序及主要验收范围。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md`：公开 API、源码入口与实现依据。
- `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md`：更新和主副机 Journey、IA、交互决策。
- `doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/review-standard.md`：TER 包边界、UI 约束及 review 判据。
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-01-evidence-intake-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-02-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-03-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-04-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-05-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-06-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-6b-reconciliation-codex.md`：历史阶段对账的字节和范围说明，仅作导航，不替代当前源码判断。
- `apps/terminal/kernel/feature/project-basic/`、`apps/terminal/kernel/feature/store-basic/`：项目/门店 owner、加载广播、规则快照与当前候选选择。
- `apps/terminal/kernel/base/terminal-update/`、`apps/terminal/kernel/base/terminal-data-client/`、`apps/terminal/kernel/base/topology/`、`apps/terminal/kernel/base/runtime/`：更新任务和报告、credential owner、Topology 绑定/解绑 command 及 Runtime 接线。
- `apps/terminal/ui/base/admin-shell/`、`apps/terminal/ui/integration/sample-console/`、`apps/terminal/ui/integration/sample-wallpaper-console/`：共享管理 shell、两套装配和业务页面调用者；同时阅读两套 app 中的 server-config panel 接线。
- `apps/backend/catering-business-server/modules/terminal-update/`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalUpdateReportController.java`、`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateReportPersistence.java`：CBS 报告 owner、HTTP edge、持久化及历史查询。
- `apps/frontend/operations-admin/src/features/terminal-update/`：规则配置及终端报告历史 UI。
- `contracts/openapi-source/`、`scripts/generate/`：本批相关 canonical contract、materialize/codegen 及 generated 消费链；只读核对来源与调用关系，不要求运行生成器。
- `tools/terminal-automation/src/runner.ts`、`tools/terminal-automation/journeys/update.android.test.ts`、`tools/terminal-automation/journeys/update.pair.android.test.ts`、`tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts` 及直接测试：当前两个主要 case、诊断与业务断言；不要求运行 runner。
- `doc/review/platform/2026-10-11-ter-stage-c-dynamic-diagnosis-codex.md`：已知阶段性症状和作者定位上下文；不要求查阅或复核 `.runtime/` 原始运行 evidence。

## 独立核验重点

1. project-basic 是否拥有项目/组织路径和版本规则；store-basic 是否继续拥有门店资料；加载命令是否按“门店先持久化并广播、各 owner 再独立加载”的链路运行，且没有互相等待或重复事实。
2. 版本规则候选是否只由 project-basic 选择；是否严格按 App 身份隔离（console 不能选取 wallpaper 的工件）；terminal-update 是否在固定前读取当前候选/实际版本，固定后继续同一任务而不重选。
3. FULL/HOT、普通启动续接和报告阶段是否复用既有 task/action/boot owner；请求、重试、receipt 与最近状态序号之间是否保持同一 operation 身份，不误报完成或重复执行。
4. 终端 credential 是否仍唯一归 TDC；副机接收主机同步的完整凭证后由本机 TDC 直接请求 CBS；解绑路径是否为 Topology 发起请求、TDC actor 清理其自有状态并持久化、TDC 完成后通知 Topology 再完成角色变化。不得直接 reset 所有 state、不得在 integration/application 实现解绑业务逻辑。
5. 配对覆盖主机同步数据、保留本地身份事实；解绑不清除非 TDC owner 的本地更新任务或其他 package 状态。Topology/TDC 的 command 握手、失败传播与重复触发是否只使用完成上述闭环所需的最小机制。
6. 共享界面是否留在 `admin-shell`：本批安装提醒及 server-config panel 是否通过其现有职责接入，而没有为小功能新增 package；两套 integration 是否只装配，不持有业务规则、状态清理或命令编排。
7. 两个主要 Journey 的页面/命令链及关键数据是否有直接测试覆盖；测试是否断言业务状态/owner 结果，而不是仅检查无异常或 UI 可见。只审查当前已实现内容，不要求补入 Stage C 以外矩阵或极端恢复场景。
8. 报告闭环：taskId、binding、terminal、report sequence、规则/工件 identity 在提交与历史查询里是否一致；history cursor/pagination、query scope 与持久化字段是否可解释当前观察到的“receipt 接受但历史页找不到对应记录”症状。请基于源码判断可能缺口，不要求对运行 evidence 作证据审查。
9. `project-basic`、`store-basic` 与本批新增/修改 TER README 是否为中文且职责说明对应实际源码；检查代码是否仍符合各层/各包边界，是否存在死 API、重复状态或超出主流程必要性的抽象。

请只报告源码中有具体路径、行号、调用路径和反例支撑的问题；将仓内事实、推论和未知运行事实分开。每项提出最小修正，并说明是否需要 Dexter 产品裁决。对详设没有判据但影响已实现行为的事项列入 `DESIGN_GAPS`。不要将前述运行症状自行定性成数据库根因。

## 期望结论

请明确给出 `GO` 或 `NO-GO` 及 `M/S/N`，并将 verdict 严格限定为 `INTERIM_IMPLEMENTED_SUBSET_ONLY`。如为 NO-GO，请逐项列出详设判据、生产代码与直接测试位置、反例、影响、最小修复和 Dexter 裁决需求；其余已核验范围说明没有 finding。请声明本次不评价或确认运行 evidence，不代表动态业务/cleanup 通过或阶段 C 整批交付。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 C 当前已实施子集做一次阶段性、只读的静态源码 review。

背景：Dexter 已要求暂停当前阶段 C 实施和动态测试，先复核已经写入的代码，以便集中发现同根问题并减少后续反复。CP-01～CP-06 和全批 6b 均有 `MATCHED` 记录，但各记录仅适用于各自核验的字节与范围；它们不是当前整批实施 GO，也不替代当前源码 review、13c 或动态验收。阶段 C 仍未完成交付。

当前最新受管 run `f5c94ca9-b13d-49c9-a3d8-bbded2ae8a9a` 的 manifest 记录为 `business=FAIL`、`cleanup=PASS`：上报 receipt 成功后，后台历史页未找到该 task 的记录，导致历史断言失败。根因未确认。此事实只用于帮助定位报告提交、持久化和历史查询源码链；本次不要求您读取/复核 `.runtime/`、日志或其他运行 evidence。

目标：请先独立从正式需求与阶段 C 详设推导预期行为，再检查当前生产源码、调用者、生成契约与直接测试；以证伪为先，判断方案是否正确、各层职责是否清楚、两个主要 Journey 的实现是否闭环，并找出会导致常见主流程失败的源码问题。请保持最小修正思路，不扩大到极端条件或阶段外功能。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：正式需求与阶段边界；
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`：阶段 C owner 与行为判据；
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：CP 与实施范围；
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md`：当前接口和源码依据；
- `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md`：Journey、IA 与交互；
- `doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/review-standard.md`：包边界、UI 与 review 规范；
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-01-evidence-intake-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-02-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-03-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-04-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-05-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-06-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-6b-reconciliation-codex.md`：历史静态对账范围，不替代当前源码判断；
- `apps/terminal/kernel/feature/project-basic/`、`apps/terminal/kernel/feature/store-basic/`；
- `apps/terminal/kernel/base/terminal-update/`、`apps/terminal/kernel/base/terminal-data-client/`、`apps/terminal/kernel/base/topology/`、`apps/terminal/kernel/base/runtime/`；
- `apps/terminal/ui/base/admin-shell/`、`apps/terminal/ui/integration/sample-console/`、`apps/terminal/ui/integration/sample-wallpaper-console/`；
- `apps/backend/catering-business-server/modules/terminal-update/`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalUpdateReportController.java`、`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateReportPersistence.java`；
- `apps/frontend/operations-admin/src/features/terminal-update/`；
- `contracts/openapi-source/` 与 `scripts/generate/` 中本批相关 canonical/generated 来源；
- `tools/terminal-automation/src/runner.ts`、`tools/terminal-automation/journeys/update.android.test.ts`、`tools/terminal-automation/journeys/update.pair.android.test.ts`、`tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts` 及直接测试；
- `doc/review/platform/2026-10-11-ter-stage-c-dynamic-diagnosis-codex.md`：仅作定位上下文，无需核查其运行 evidence。

请重点核验：project-basic/store-basic 的事实 owner 与加载链；规则候选是否按 App 身份隔离；terminal-update 的固定目标、FULL/HOT、启动续接与报告身份；TDC 凭证 owner 及 Topology→TDC 解绑 command 闭环；配对时主机同步数据覆盖与解绑后的最小 TDC 清理；共享 admin-shell/server-config-panel 的包边界；两个主要 Journey 的真实 command/selector 调用链和直接业务断言；报告 HTTP 提交、owner 持久化与历史分页读回是否共用同一 task/binding/scope 事实；中文 README 与代码职责是否一致。

本轮只做当前源码和直接测试源码的静态 review：不要求运行或查看运行 evidence，不要求补测试、构建、verify、Expo Web、DEV、Android、双机、reset/seed、L2、UAT 或部署。运行症状只作为定位线索；请勿将静态结论包装为动态 PASS。

烦请给出明确 `GO` 或 `NO-GO` 以及 `M/S/N`，verdict 范围标为 `INTERIM_IMPLEMENTED_SUBSET_ONLY`。每项 finding 请附详设判据、精确源码路径与行号、可复验调用链/反例、影响、最小修正及是否需要 Dexter 产品裁决；无判据但影响实现的事项列入 `DESIGN_GAPS`。请声明本次不代表 CP 当前全部字节 MATCHED、13c 完成、动态验收通过或阶段 C 整批交付。

授权边界：本轮只请求对阶段 C 当前已实施子集做只读静态源码 review；不授权 Claude 修改文件、要求运行或索取 evidence，也不授权 Codex 在本轮恢复实施/动态测试、进入范围外 CP 或执行 reset/seed、L2、UAT、生产部署。后续修正和验证由 Dexter 按 review 结果另行安排。谢谢。
```
