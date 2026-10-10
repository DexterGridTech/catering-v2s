# TER 阶段 B 全批 6b R3 finding intake

## 结论与边界

此前 `doc/review/platform/2026-10-09-ter-version-update-stage-b-6b-reconciliation-codex.md` 的 `MATCHED` 仅对应旧字节，已被 fresh 全批复核的 `OPEN, M/S/N=0/3/0` 覆盖。此 intake 是主 agent 对新 findings 的核验和处置，不替代修复后的独立 6b verdict。没有将历史运行升级为当前通过。

## S-1：规则状态变更后详情仍显示旧状态

**分类：`CONFIRMED`。**

- 详设要求状态变化后刷新同一项目的规则列表与当前详情：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md` §3 缓存失效/改后刷新、§8.2 状态事实；实施计划 CP-05 要求启停后详情和状态可见。
- 当前 `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx` 的 `changeStatus` 在成功后只调用 `loadRules`，没有重新读取仍打开的同一规则详情。详情状态及“启用/停用规则”动作均来自 `detail.status`。
- 最小修正：成功后刷新列表，并仅在原详情仍显示同一 `ruleRef`、context 未变化时重新调用既有 `openRule(target)`；不新增缓存或状态副本。真实供给链 runner 先验证新规则初始为停用，再点击启用并断言详情更新为启用、后续动作改为停用。
- 剩余：修复后的页面行为须由受管 `update.supply-chain` 证明；旧失败运行不覆盖此路径。

## S-2：IDLE 空闲时长 UI 单位与契约不一致

**分类：`CONFIRMED`。**

- 详设 §8.2 明确 UI 输入/回显为分钟 1–1440，API/数据库用秒 60–86400 且为 60 的倍数。
- 当前页面将表单字段命名为 `mSeconds`，标签显示秒，未给出设计上限；提交时直接发送该值。详情也直接显示秒数。这与设计不一致，并允许业务界面将 10 分钟表达为 10 秒。
- 最小修正：UI 字段改为 `mMinutes`，限制 1–1440；只在提交边界转换为 `mSeconds = minutes * 60`；详情以秒除以 60 显示分钟。owner 继续验证 API 秒数规则，不扩大业务上限。
- 剩余：受管页面当前供给链覆盖 IMMEDIATE；IDLE 转换以类型/生成检查和 owner/API focused proof 验证，设备更新场景不被误称为 IDLE 动态证据。

## S-3：FULL-only 规则仍强制填写 HOT 策略

**分类：`CONFIRMED`。**

- 正式需求及详设 §8.2 明确 FULL-only 没有 `hotStrategy`/M；详设 owner model 允许策略为 null。
- 当前 canonical `contracts/openapi-source/terminal-update.schemas.json` 将创建请求的 `hotStrategy` 设为必填，响应策略非 nullable；`TerminalUpdateRuleOwnerService.validateRule` 在判断是否有 HOT 工件前强制要求 IMMEDIATE/IDLE。数据库初始迁移将 `hot_strategy` 设为 `NOT NULL`。故完整规则链不能按已批准 FULL-only 语义保存。
- 最小修正：生成源中使请求 HOT 策略成为可选、响应字段保持必填但允许 null；owner 校验仅在有 HOT 工件时要求策略；增加后续 Flyway 迁移允许空策略，并以约束保证 FULL-only 三字段均为空、HOT 配对策略满足对应 M 规则；UI 无 HOT 时省略策略字段；seed 两条 FULL-only fixture 删除策略。保持历史 migration 不变，沿 canonical→materialize→edge-codegen 生成。
- 剩余：需用 owner/seed focused tests 与修复后完整 seed dry-run 验证；真实供给链仍需受管页面路径验证。

## 同根闭包

本轮修正范围包含 canonical/生成 wire、owner 校验、持久约束、运营 UI、runner UI oracle 和 seed fixture/validator/executor/readback。不得只修页面显示而让 API、数据库或 seed 继续强制 HOT 策略；不得改历史 migration 或手改生成物。

修复后的 seed executor focused 测试又暴露一个同根字段错误：`PlatformTerminalUpdateArtifactController.stage` 只接受 `TERMINAL_UPDATE_ARTIFACT`，executor 原先发送 `TERMINAL_UPDATE_PACKAGE`。canonical schema 与 controller 都确认前者才是 HTTP 上传用途；平台 asset 内部持久化用途由 owner 映射，不应由调用方替换成内部值。只将 seed multipart 字段改为 HTTP 契约值。

## 证据状态

最近受管业务运行仍是 `update.supply-chain` 首败，业务失败、cleanup PASS；该次未走到启用确认，因此不覆盖 S-1。它也没有覆盖 S-2 的 IDLE 输入或 S-3 的 FULL-only 创建。修复后按授权补受影响的 focused proof 和运行。

## 修复后局部证据更新

- `TerminalUpdateRuleOwnerServiceTest` 经仓根 `./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --tests 'com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerServiceTest' --no-daemon` 通过；Gradle 显示 `BUILD SUCCESSFUL`，20 tasks 中 3 executed、17 up-to-date。
- operations-admin `terminalUpdateDuration.test.ts` 通过（1/1）；operations-admin typecheck 退出码 0。
- seed executor、fixture contract 与 seed plan focused Node tests 通过（9/9）。首轮失败保留为真实字段错误；修正后同一 focused proof 通过。
- `r5-edge-materialize --check`、`edge-codegen --check`（`IDENTITY_ONLY` 模式）与 `terminal-client-api --check` 均通过。它们是相关生成闭包检查，不代表默认全仓 verify 或动态验收。
- 当前受管 `update.supply-chain` 业务结果仍为既有首败（业务 FAIL、cleanup PASS）；上述修正尚未由受管 UI 路径验证。当前字节完整 seed dry-run 与受管真机运行仍未执行。
