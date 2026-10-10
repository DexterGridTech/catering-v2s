# TER 阶段 B 实施复评处置记录 R2

## 范围与结论

本记录处理 fresh Stage B 全批 6b reviewer 报告的两项当前字节 finding。原 `2026-10-09-ter-version-update-stage-b-6b-reconciliation-codex.md` 的 `MATCHED` 结论已被本次 fresh 复核的 `OPEN, M/S/N=0/2/0` 覆盖；不把作者修复或下述局部运行当作新的独立 6b verdict。

### S-1：报告接收时间未贯通到项目报告列表与详情

**分类：`CONFIRMED`。**

- 判据：`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md` §2 的 `PROJECT-REPORT` 要求接收时间，`PROJECT-REPORT-DETAIL` 要求状态发生时间与服务端接收时间；线框 §4 同样逐项列出。
- 根因：既有 `terminal_update.terminal_report.received_at_epoch_millis` 已保存服务端接收时间，历史 API 已返回该值；项目列表/detail owner 投影、canonical `TerminalUpdateVersionReportItem`/`TerminalUpdateVersionDetail` 与运营 UI 没有把最新报告的时间接出来。
- 最小修正：在两个既有 response DTO 增加 nullable `receivedAtEpochMillis`，沿 `terminal-update` owner 的既有 page/detail SQL 投影返回最新报告同一事实；前端项目列表显示“接收时间”，详情显示“状态发生时间” (`recent.changedAtEpochMillis`) 和“服务端接收时间”。没有报告时保持 `null` 并显示 `—`。未增加表、查询入口或时间事实。
- 变更：canonical schema、其输入哈希登记、materialized/generated wire、`TerminalUpdateReportOwnerApi`、`TerminalUpdateReportPersistence`、`OperationsTerminalUpdateReadController`、报告生命周期 acceptance 断言、`ProjectTerminalUpdatePage.tsx`。
- focused proof：`terminal-update.report-lifecycle` 断言 page/detail/history 的 `receivedAtEpochMillis` 均为已持久化正值且相同。

### S-2：状态/原因与规则状态以机器码呈现

**分类：`CONFIRMED`。**

- 判据：交互稿 §4.2 要求代码与 raw reason 不直接展示；`TerminalUpdateReportRecent` canonical schema 对状态和原因分别定义闭集。
- 根因：报告列表、详情与历史曾直接渲染 `recent.state`、`recent.reason`；规则详情也直接渲染 `detail.status`，而项目已有对应中文业务文案。
- 最小修正：运营 feature 的同页本地呈现函数将 canonical `WAITING_USER/DOWNLOADING/VERIFYING/INSTALLING/APPLYING_HOT/SUCCEEDED/FAILED/CANCELLED/UNKNOWN` 和 `NONE/NETWORK/HTTP_REJECTED/HASH_MISMATCH/PREPARE_FAILED/INSTALLER_CANCELLED/INSTALL_FAILED/HOT_APPLY_FAILED/UNKNOWN` 映射为中文；规则 `ENABLED/DISABLED` 与 `IMMEDIATE/IDLE` 使用现有页面文案。不会改 owner enum、HTTP 值或业务状态机。供给链 UI helper 改为断言用户可见中文，不再把 `SUCCEEDED` 当成屏幕成功。
- 同步：交互稿 §4.2 的报告字典从过时的历史状态名改为当前 canonical `TerminalUpdateReportRecent` 闭集；阶段 B 真实供给链 helper 对规则和报告详情/历史检查可见文案。
- 变更：`ProjectTerminalUpdatePage.tsx`、`terminalUpdateSupplyUi.ts`、交互稿 §4.2。

## 当前字节 focused 验证

| 验证 | 命令 | 结果与边界 |
| --- | --- | --- |
| OpenAPI 物化 | `node scripts/generate/r5-edge-materialize.mjs` | PASS；264 operation identities。更新本仓 canonical schema 哈希钉后通过。 |
| Edge wire 生成 | `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --write` | PASS；483 generated files。CP-05 标定前的 identity-only 生成，不是默认预算或完整 verify PASS。 |
| Edge 生成一致性 | `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --check` | PASS；483 files；仅证明生成一致性。 |
| operations-admin 类型检查 | `yarn workspace @catering-v2s/operations-admin typecheck` | PASS，当前差量通过；另一次并行运行返回成功。 |
| terminal-automation 类型检查 | `yarn workspace @catering-v2s/terminal-automation typecheck` | PASS，当前差量通过。 |
| 前端格式 | `yarn prettier --write apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts` | PASS；仅格式化两处本次修改的 TS/TSX 文件。 |
| 受管后端 acceptance | `scripts/test/backend-acceptance --operation terminalUpdateReportLifecycle` | run `r5-tc-1791537526259-98596`，2026-10-09 09:18:46–09:21:49 UTC；Gradle `compileJava`、`compileTestJava` 与唯一选定场景成功；`CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=6`，发现206/选择1，真实业务断言1；TDS contract 1/1。manifest 的 process/workspace/Testcontainers container/volume cleanup 均 PASS，证据归档 PASS。此为一个 focused 后端场景，不是全量验收或 `update.supply-chain` 端到端证据。 |

初次未带 identity-only 环境的 `edge-codegen --write` 首败为预期的 `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact`；未修改预算或跳过门。按计划 CP-05 标定前使用 identity-only 模式后写出生成物并通过一致性检查。

## 仍待完成

- 本记录不是 CP-02/CP-05 独立差量 MATCHED，也不是全批 6b verdict；须由 fresh 独立只读 reviewer 在这些当前字节上核验需求、详设/计划与项目记忆规范，复查后更新对应 reconciliation。
- 受管 `update.supply-chain`、目标双屏真机 console/wallpaper、当前 `update.artifacts`、seed dry-run、reset/DEV/full seed、清理、交付前 13c 与 fresh 整批 `REVIEW_TARGET=IMPLEMENTATION` 均没有由上表证明；按实施计划状态保持 `NOT_RUN`，不将本次 focused proof 升级为全批 PASS。
