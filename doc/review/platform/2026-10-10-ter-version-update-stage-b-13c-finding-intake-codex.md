# 阶段 B 13c OPEN finding intake 与差量修复

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
`FINDING=S-1`
`CLASSIFICATION=CONFIRMED`
`INITIAL_REVIEW=OPEN`
`POST_FIX_RECHECK=FRESH_REVIEW_PENDING`

## 原判据与当前源码

- 详设附件 §17，`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:493-497`：HOT 的最低 FULL 候选通过 `getPlatformTerminalUpdateArtifactPage` 在服务端按 `applicationId`、`nativeBuildNumber`、`runtimeVersion`、`publicationId`、`apkSha256` 五事实精确过滤；浏览器不得拿无约束分页结果自行筛选。
- 原 UI `apps/frontend/platform-admin/src/features/terminal-update/ui/TerminalUpdatePackagesPage.tsx:87-101` 仅发送 `appId`、`runtimeVersion` 及 `queryText=publicationId`，其余精确匹配发生在当前响应页的浏览器过滤中。当前 generated contract 已含三个 `minimumFull*` 查询字段：`apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:2038-2044`。CBS controller 接收全部字段：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/terminalupdate/PlatformTerminalUpdateArtifactController.java:110-130`；persistence 在 SQL 中精确过滤 build、publicationId 与 apkSha256：`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateArtifactPersistence.java:152-182`。
- 反例成立：若精确匹配工件不在未受约束的首个 50 项中，浏览器只扫描当前页，可能显示无候选；这是正确性缺口，不只是额外过滤。
- 同根扫描命令：`rg -n "getPlatformTerminalUpdateArtifactPage\\(|minimumFullCandidateQuery|matchesMinimumFull" apps/frontend/platform-admin/src --glob '*.ts' --glob '*.tsx'`。当前只有一个包列表 UI 文件、两个调用点：普通分页列表与最低 FULL 候选查询；本次只改变候选查询。generated contract、controller 与 SQL 已有完整过滤支持，未发现需同步的第二个 UI 消费者。

## 最小修复

- `TerminalUpdatePackagesPage.tsx` 将最低 FULL 候选查询改为调用 `platformMinimumFullCandidateQuery`；候选请求向同一 generated operation 发送 `kind=FULL`、`appId`、`runtimeVersion` 与三个 `minimumFull*` 字段，移除用模糊 `queryText` 替代精确身份的做法。
- 保留已有 `matchesMinimumFull` 对服务器返回项做防御性 readback，不再以它替代服务端范围过滤。普通 FULL 列表仍只带 `kind/limit`，不受候选过滤条件影响。
- 新增纯 query builder 与 focused test，断言五事实字段全部送达且普通 FULL 列表不附候选限制；没有修改合同、服务端、分页上限、业务语义或新增 operation。

## 当前字节验证

修复后命令均通过：

- `yarn workspace @catering-v2s/platform-admin vitest run src/features/terminal-update/ui/terminalUpdateArtifactQueries.test.ts`：1 个文件、2 个测试通过。
- `yarn workspace @catering-v2s/platform-admin typecheck`：退出码 0。
- `yarn workspace @catering-v2s/platform-admin eslint src/features/terminal-update/ui/TerminalUpdatePackagesPage.tsx src/features/terminal-update/ui/terminalUpdateArtifactQueries.ts src/features/terminal-update/ui/terminalUpdateArtifactQueries.test.ts --max-warnings=0`：退出码 0。

首轮 lint 因新 helper 读取 `minimumFull` 对象但 `useMemo` 未声明该依赖而失败；依赖数组改为 `[groupWorkspaceKey, minimumFull]` 后，同一 lint 命令通过。此首败不是业务行为失败；没有通过延时或重跑掩盖。

该差量未改变受管 backend/Android 执行字节，不重跑受影响范围外的 acceptance 或两条真机链。13c OPEN 已由主 agent 修复，最终 MATCHED 仍待 fresh 只读复核；整批 implementation review 也须按修复后的当前字节判断。

## 后续独立复核输入与后台服务端闭环

首次修复后 fresh candidate recheck 发现后端对同一 query 的语义依赖 `kind`：`kind=HOT` 时三项 `minimumFull*` 比较 HOT 行保存的 `minimum_full` JSON；`kind=FULL` 时应比较 FULL 行自身的 `native_build_number`、`publication_id`、`apk_sha256`。主 agent 对照 owner query DTO、SQL 与正常 FULL/HOT 两类消费者后采用此条件分支，未全局改变 query 含义。

- `TerminalUpdateArtifactOwnerApi.ArtifactQuery` 要求最低 FULL 三项必须同时存在，并且还必须提供 kind、applicationId、runtimeVersion；不完整组合在 owner 层拒绝。
- `TerminalUpdateArtifactPersistence.readPage` 对 FULL 候选比较 FULL 自身身份字段；对 HOT 候选继续比较 HOT 行的 `minimum_full` JSON。native build number 对 FULL 使用数字绑定，对 JSON 文本使用十进制字符串绑定。
- `TerminalUpdateAcceptanceScenarios.hotArtifactRequiresAndRetainsSelectedMinimumFull` 验证完整五事实 query 命中已注册 FULL、部分 tuple 返回 typed 422，并验证 HOT detail 保存并读回同一 FULL 的 application/build/runtime/publication/APK SHA。
- 受管运行 `r5-tc-1791583917562-56600`（`2026-10-09T22:11:57.562Z` 至 `2026-10-09T22:17:24.284Z`）`status=PASS`：唯一场景 `terminal-update.artifact-hot-minimum-full` 的 CONTRACT/BUSINESS PASS，DB_OPERATIONS=12；Testcontainers 容器、卷、远端进程、远端工作区与证据归档均 PASS；原有 DEV `r5-dev-1791582207969-15314-4ad905ab-fc3f-45df-b309-b48cf768e7b8` 按受管联动停止并恢复，cleanup PASS。该 run 证明此 acceptance 场景和服务端查询，不证明平台浏览器 L2 或本轮 UI 动态行为。
- Stage B 后台差量验证：operations-admin 候选/query helper 与日期过滤 helper Vitest 2 files/4 tests PASS，platform-admin artifact query Vitest 1 file/2 tests PASS；两个后台 typecheck 和受影响文件 ESLint 均 PASS。`edge-codegen --self-test`、`--check`、canonical→materialize→codegen `--write` 均 PASS。
- 该 review finding 的最终 `MATCHED/OPEN` 仍由 fresh reviewer 对当前字节独立判断；以上仅为主 agent 的修复与证据记录。
