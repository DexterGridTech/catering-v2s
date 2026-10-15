# 前后台结构优化 · owner CLEAR 动态首败 intake 与修复差量

## Intake

- `REVIEW_TARGET=IMPLEMENTATION_DELTA`
- `FAILURE_RUN_ID=e949b00d-3666-4e62-83e2-43b2a42b5061`
- `SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`
- 依据：T1 正式需求 R-12、详设 §8.7、验证附录 §4.1、当前 owner 源码与首跑日志。

## 首败处置

**Disposition：CONFIRMED（自动化 owner readback oracle 与 owner CLEAR 语义不一致；不是 owner 更新失败）。**

首跑 `e949b00d-3666-4e62-83e2-43b2a42b5061` 已完成版本工件供给、规则启用、TER 固定和执行更新、CBS 报告接收及运营历史任务读回。随后 console `update.owner-flow` 在 `adminStructureDevUi.ts` 门店字段 owner readback 断言失败，具体信号为 `ADMIN_STRUCTURE_STORE_EXTENSION_OWNER_READBACK_MISMATCH`；runner 汇总为 `TERMINAL_AUTOMATION_WEB_BUSINESS_PASS_NOT_OBSERVED`。此前终端更新与报告链业务步骤已完成；后台 owner-flow 整体未通过。run manifest 记录 `business=FAIL`、`cleanup=PASS`，本次生成的 9,103,588,043 bytes 产物已清理。日志没有 owner GET 的字段级 readback 值，因此未将该次状态或字段值推断为业务 PASS。

## 证据与反例

1. R-12 明确规定 HTTP CLEAR 以 `key:null` 表达；这描述的是提交意图，不要求 owner GET 以 JSON null 储存字段。
2. `ExtensionSubmissionWireMapper.toSubmission` 将 JSON null 转为 typed `ExtensionSubmission.Mode.CLEAR`（`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/extension/ExtensionSubmissionWireMapper.java:22-31`）。
3. 唯一 extension owner 的 `ExtensionDefinitionService.mergeValues(..., ExtensionSubmission)` 对 CLEAR 调用 `merged.remove(fieldKey)`，持久化对象不含该 key（`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java:644-652`）。
4. 组织 owner readback mapper 只将 `OrganizationEntityReadback.extensionValues()` 现有条目写回 JSON 对象，没有为缺失字段补 null（`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/BusinessEntityWireMapper.java:114-124`）。合同 owner 持久化同样复用 extension owner 的 typed submission/merge；其原生 command readback 保留 owner 值。
5. 因而原断言 `updatedStoreValues.floorLabel !== null` 会把正确的 CLEAR 读回（字段缺失，即 `undefined`）误判为失败。合同的 `signedDate !== null` 存在同一断言模式；首跑在门店场景失败，尚未动态运行到合同断言。

反例边界：浏览器请求体仍必须真实包含 `floorLabel:null` / `signedDate:null` 才能证明明确 CLEAR；缺键只适用于成功后的 owner GET。`false`、`0`、未变字段 `openingHours` / `settlementMode` 的既有断言继续保留。

## 最小修正

- 不改 owner、事务、持久化或 HTTP 契约。共享 `isOwnerExtensionFieldCleared` 仅以权威 GET 中字段不存在判定 CLEAR；显式 null、仍有值、无效非对象读回均不算已清除。
- 门店和合同读取后、断言前先输出该 run 的实际 JSON 字段值与 key-presence 日志，便于首败直接定位，不再只记录预期值。
- 附录 §4.1 分别写清“请求 body 的 null CLEAR”与“owner GET 的 key omission”，避免再将提交形状误当持久化形状。
- focused 单测覆盖 key 缺失、显式 null、仍有值及无效 readback；真实 DEV owner-flow 的 store 与 contract 会在一次定向运行中分别证明实际 owner readback。

## 执行状态

- 修复后 focused proof：`PASS`，`adminStructureDevUi.test.ts` 21/21；terminal-automation `typecheck` 退出码 0。
- CP-06 当前差量：fresh 独立只读 reviewer `/root/clear_delta_cp06_fresh` 判 `MATCHED, M/S/N=0/0/0, STATIC`。
- 全批 6b 当前差量：fresh 独立只读 reviewer `/root/clear_delta_6b_fresh` 判 `MATCHED, M/S/N=0/0/0, STATIC`。
- DEV 定向复验：`PASS`，见下节；本轮没有 reset/seed、UAT 或设备操作。
- 阶段 A 以外项目、UAT、真机及未受影响矩阵：本次不执行。

## 修复后当前字节定向复验

- 受管入口：`node ./scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --sample console --case update.owner-flow`
- Run：`ccc67936-2758-45cf-90da-62c3474fff30`，2026-10-15 10:52:28Z 至 10:57:54Z。
- Run manifest：`.runtime/terminal-automation/ccc67936-2758-45cf-90da-62c3474fff30/run-manifest.json`；`firstFailure=NONE`、`lastKnownGood=cleanup`、`brokenBoundary=NONE`、`business=PASS`、`cleanup=PASS`。Vitest `1 passed | 4 skipped`；这是唯一选择的 `update.owner-flow` 场景，不表示其余四个测试运行。
- Owner readback 证据：`runner.log` 记录 `store-extension.owner-readback` 的 `floorLabelPresent=false`，同时 `is24Hour=false`、`storeArea=0`、`openingHoursPreserved=true`；`contract-extension.owner-readback` 记录 `signedDatePresent=false`，同时 `renewal=false`、`depositRate=0`、`settlementModePreserved=true`。因此请求中的显式 null 经 owner CLEAR 后，成功 GET 以 key omission 表示已清除，未改写为显式 JSON null。
- 更新供给链：本 run 完成 console INSTALL/FULL/HOT 工件构建、校验、运维后台解析/登记、运营后台规则操作、终端 owner 读取及 CBS 报告链。实际 INSTALL/FULL/HOT/APK/ZIP 工件和约 9.1 GB run-owned build/intermediate 文件均由 runner 清理；`generated-artifacts.cleanup.passed`、`web.harness.outcome.read` 与 `cleanup.passed` 均为 PASS。此处的体积是临时生成物累计字节，不是持久占用。
- 诊断：Android=`N/A`；managed DEV after-run logs 从 CBS 与 TDS A/B/C 均成功读取，`managedDev.diagnostics.result=PASS`。manifest 顶层 `diagnostics=N/A` 是 Web run 无 Android 诊断面的状态，不覆盖上述独立 DEV 日志读取结果。
- 环境边界：复用了 DEV manifest `r5-dev-1792058956406-6851-f214e222-e03c-4c56-a971-93755ab883f8`；没有重置数据库、重跑 seed、操作 UAT 或连接设备。
- 历史失败保持原状：`acbacd91-0306-4846-9676-ea7cb569da87` 在详情 action-menu 等待失败，且该旧 run 的业务字段恢复收到 403；该路径由后续 writer owner-context 清理修复。`e949b00d-3666-4e62-83e2-43b2a42b5061` 在错误的 CLEAR readback oracle 失败。其余旧 run 的状态不被本次通过改写。修复后最后一次通过就是 `ccc67936-2758-45cf-90da-62c3474fff30`。
- 范围限制：Expo Web 证明更新供给、owner/HTTP、报告与业务运行时逻辑；本 run 不声称 Android 系统安装器实际安装 APK，也不声称 Hermes/native HOT 加载已由这次修复验证。阶段 A 原生更新与未受影响设备矩阵仍沿用其各自历史证据及范围，不因本差量重跑。
