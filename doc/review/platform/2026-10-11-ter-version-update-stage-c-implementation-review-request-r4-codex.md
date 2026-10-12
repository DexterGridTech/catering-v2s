# TER 版本更新阶段 C · 当前整批实施复评请求

## 背景

Claude 对此前阶段 C 当前源码与指定归档的整批实施 review 为 `NO-GO，M/S/N=0/4/3`，记录于 `doc/review/platform/2026-10-11-ter-version-update-stage-c-final-implementation-review-claude.md`。本次作者按 finding intake 逐项重开来源并修复确认差量；差量处置记录为 `doc/review/platform/2026-10-11-ter-version-update-stage-c-final-implementation-review-intake-codex.md`。

本次未重跑六个历史设备 run、backend-acceptance、完整 CP/6b/13c、DEV 或完整动态矩阵。原报告中六个设备 run 的 business 与 runner cleanup PASS 保留为历史证据；Android diagnostics 缺口与 backend-acceptance 的 DEV 自动恢复问题继续分别记录，不改写成业务失败，也不升级成修复后整批 PASS。

## 评审目标

请基于当前实现与阶段 C 正式需求、详设，独立判断原 S-1～S-4 是否已由当前代码与定向 proof 关闭；核对 N-1～N-3 的处置是否正确；再判断整批 Stage C 当前是否存在新的或仍未关闭的阻断问题。不要把作者 intake、自报测试数字、历史 verdict 或局部 focused PASS 当成独立证明。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：阶段 A/B/C 正式行为与范围。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`：当前 Stage C owner、资格、传输、报告及验收判据。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：CP 顺序及当前受管执行面。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md`：公开 API 与来源依据。
- `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md`：获批用户流程、页面与主副机边界。
- `doc/review/platform/2026-10-11-ter-version-update-stage-c-final-implementation-review-claude.md`：此前 finding、同根范围与历史 run 身份。
- `doc/review/platform/2026-10-11-ter-version-update-stage-c-final-implementation-review-intake-codex.md`：本轮主 agent disposition、修改与实际局部验证边界，仅供定位，不作独立证明。

请重开以下 owning source 与直接测试：

- `apps/terminal/ui/base/integration-assembly/src/foundations/createBrowserTransportNetworkAdapter.ts`、`apps/terminal/ui/base/integration-assembly/test/createBrowserTransportNetworkAdapter.test.ts`：Web HTTP decoded 上界和 WS 独立边界。
- `apps/terminal/kernel/feature/project-basic/src/selectors/selectors.ts`、`src/application/module.ts`、`test/projectBasic.test.ts`，以及 `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、`apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`：strict 候选与 fixed task 来源资格、selector 注册和接线。
- `apps/terminal/kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts`、`src/features/actors/terminalUpdateActor.ts`、`test/terminalUpdate.test.ts`：固定任务 grant 前后 reader 的实际消费范围。
- `apps/frontend/operations-admin/src/features/terminal-update/model/terminalUpdateActualUnknownReason.ts`、对应 `.test.ts`、`src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`：最新及历史 `actual.unknownReason` 展示。
- `tools/terminal-automation/src/androidDevice.ts`、`src/managedRun.ts`、`src/runner.ts`、`journeys/update.android.test.ts` 及 `test/androidDevice.test.ts`、`test/runner.test.ts`：有界日志读取、主副设备诊断聚合、manifest、退出码与 cleanup 顺序。
- `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts`：history `taskFound` 诊断语义。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`、`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：规则 topic 首订阅与当前 response shape 的同步。
- `apps/frontend/operations-admin/src/app/catalog/generatedAdminCatalog.ts`、`src/app/components/OperationsRequiredScopeSurface.test.tsx`：项目规则页的 required-scope 分母。

## 独立核验重点

1. HTTP 正文限制应是解码后单页 1 MiB；Web adapter 对 64 KiB 以上正常页面应接受，对 1 MiB+1 应有界拒绝；WebSocket 仍是独立 65,536 字节。检查 reader 是否在超界后停止并取消。
2. 证明固定任务读取路径只放宽普通 peer projection readiness，不放宽本地 binding、activation/credential 身份、来源和显式解绑判定；候选路径仍严格。沿两套 assembly、selector 注册、grant 前后及恢复入口检查同根。
3. 检查运营最新详情和历史报告读取的是 `actual.unknownReason`，而不是任务 `recent.reason`；未知值不应被臆造为已知原因。
4. 检查 Android MASTER/PAIR_SLAVE 的 runtime/native-update 诊断是否分别关联 runId、role、source；读取受界限；缺失、不可读或重复信号是否让 diagnostics 单独失败并导致非零，同时保留原 business/cleanup 事实且不跳过 cleanup。
5. 核对旧 `{selectionContext}` 调用是否还通过 runner 被承诺为“implemented”；Stage C 当前业务主 Journey 是 `update.supply-chain` 和 `update.pair`。确认旧 case 被 fail closed 后不会启动资源，也不会误伤这两条 Stage C 入口。检查历史源码保留是否造成错误对外承诺。
6. 核实规则快照 response 没有更新时间水位时，详设与计划是否准确描述 subscribe-before-snapshot 与 `initialTimeEpochMillis=0` 的实际语义；该 0 不能冒充更新时间事实。
7. 核对 `taskFound` 是否只表达找到目标，不暗示全历史唯一；`matchingBusinessFacts` 和服务端唯一约束的含义保持独立。
8. 区分本轮直接 focused proof、已有历史设备 run、未执行动态项和 package typecheck 残余；不得以局部 PASS 代替整批动态通过。

历史六个 run ID 及各自证据边界见此前 Claude review 第 3、4 节和 run 清单；如果查阅既有归档，只沿用其标注范围，不要求也不假设本轮重跑。作者记录的定向命令与已知 package typecheck/测试边界见 finding-intake 文件。

## 期望结论

请给出当前字节的整批 `REVIEW_TARGET=IMPLEMENTATION` 结论，明确 `GO` / `GO_WITH_UNVERIFIED_UI` / `NO-GO` 及 `M/S/N`。每项 finding 请给详设位置、实现路径与行号、反例/影响、最小修正建议和是否需要 Dexter 产品裁决。若有详设没有规定的要求，列入 `DESIGN_GAPS`；不要要求重新执行不受影响的动态矩阵来替代源码判断。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 C 当前字节做整批实施结果复评。

背景：你此前对 Stage C 的整批结论为 NO-GO，M/S/N=0/4/3。本轮主 agent 已按 finding intake 修复确认差量，并记录了针对性验证。六个设备 run 的历史 business/runner cleanup PASS 保持原证据边界；Android diagnostics 与 backend-acceptance DEV 自动恢复问题分别保留。没有重跑未受影响的设备矩阵、backend-acceptance、DEV、reset/seed、L2 或完整动态验收。

目标：独立复核修复后的当前字节，并判断阶段 C 整批实现是否仍有阻断项。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：正式需求；
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md：当前详设；
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md：当前计划；
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md：接口依据；
- doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md、ia 与 ui-interaction 同前缀文件：获批用户和双机边界；
- doc/review/platform/2026-10-11-ter-version-update-stage-c-final-implementation-review-claude.md：上轮 findings 与历史 run 范围；
- doc/review/platform/2026-10-11-ter-version-update-stage-c-final-implementation-review-intake-codex.md：作者处置与局部证明，仅供定位；
- 本 brief 所列 integration-assembly adapter、project-basic selectors/assembly、terminal-update actor、operations-admin 页面、terminal-automation runner/Journey 及其直接测试。

请独立核验：S-1 HTTP 1 MiB decoded 上界与 65,536 字节 WS 边界；S-2 fixed task 与新候选 readiness 分离且解绑/binding/credential 仍拒绝；S-3 actual.unknownReason 在最新详情和历史报告中的来源；S-4 Android 诊断有界读取、主副来源聚合、独立退出判定和 cleanup 顺序；N-1 旧 payload case 是否从有效 runner 支持集合 fail closed；N-2 rule snapshot 无更新时间字段时首订阅语义；N-3 taskFound 与唯一性断言的区别。主动检查同根路径与其他消费者，不继承作者分类或历史 GO。

本轮已运行定向测试和部分 typecheck；integration-assembly typecheck 仍有三个位于未修改源/测试的现存错误。Expo Web、Android/VM、DEV、backend-acceptance、reset/seed、L2、完整动态验收和全量 verify 均未在本轮运行。请区分这些范围与历史设备证据，不把当前局部 proof 升级为修复后整批动态通过。

请给出明确 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO`，以及 `M/S/N`。每项 finding 请列详设与源码精确位置、事实/推论、影响、最小修正和是否需要 Dexter 产品裁决；详设没有判据的问题列 `DESIGN_GAPS`。

授权边界：本话术请求独立实施结果复评，不授权新增源码修改、测试/verify、DEV、设备、reset/seed、L2、UAT、生产部署或阶段外工作。谢谢。
```
