# TER 阶段 B 当前整批复核 finding intake（r3）

日期：2026-10-10  
范围：Claude/Codex 先前阶段 B 整批静态复核 M-1、S-1～S-3；另含 13c 平台 HOT 最低 FULL 候选差量。由主 agent 独立重开当前需求、详设/IA 与 owning source 后处置。  
独立当前 verdict：`PENDING_FRESH_REVIEW`；本文不是独立 GO。

## Finding dispositions

| Finding | Intake | 当前处置 | 当前证据 / 未覆盖 |
| --- | --- | --- | --- |
| M-1 operations-admin FULL/HOT 候选仅首 50 项 | `CONFIRMED` | FULL 与 HOT picker 现在使用服务端 query/cursor、页大小 50、debounced 搜索及 load-more；切换 FULL 时通过 candidate reset key 清 HOT 候选状态。 | UI helper focused tests、typecheck、ESLint PASS；真实后台浏览器路径未在本差量运行。 |
| S-1 platform-admin 不请求 detail、HOT 最低 FULL 事实不完整 | `CONFIRMED` | 打开目标标题时调 `getPlatformTerminalUpdateArtifactDetail`；generated detail 包含 `minimumFullArtifactRef/minimumFullFacts`，HOT Drawer 展示 FULL 的五项身份事实。 | platform artifact-query Vitest、typecheck、ESLint PASS；本轮 backend-acceptance 验证了 owner detail/readback；后台浏览器 UI 本轮未运行。 |
| S-2 platform 包列表缺应用/runtime/query/reset 与目标标题入口 | `CONFIRMED` | 列表现有应用、runtime、关键词、类型、reset；“更新包”目标标题打开详情，版本字段不再承担主入口。 | platform-admin typecheck、ESLint 与 focused query tests PASS；UI 动态未运行。 |
| S-3 operations 规则列表缺应用/日期过滤与目标标题入口 | `CONFIRMED` | 查询构造器把应用名和创建日期范围映射到现有 server query；目标标题打开详情；重置清空 filter 并回到首页。 | operations-admin 2 files/4 tests、typecheck、ESLint PASS；UI 动态未运行。 |
| 13c HOT 最低 FULL 候选服务端精确过滤 | `CONFIRMED` | platform `kind=FULL` 按 FULL 行自己的 native build/publication/APK SHA 精确过滤；operations `kind=HOT` 保留按 HOT 行 `minimum_full` JSON 过滤；owner DTO 拒绝不完整三元组或缺 kind/app/runtime。 | acceptance `r5-tc-1791583917562-56600` 场景 CONTRACT/BUSINESS PASS，DB_OPERATIONS=12；独立 13c recheck pending。 |
| N-1 初始状态 UI 设计来源有差异 | `DESIGN_GAP` | 实现继续按已接受的详设/供给 Journey：新建规则固定 `DISABLED`，随后在详情启用。没有擅自新增初始状态选择器，也没有改产品语义。 | 仍需设计源后续统一；非本轮实现阻断。 |

## 关键代码与契约落点

- Platform UI query builder：`apps/frontend/platform-admin/src/features/terminal-update/ui/terminalUpdateArtifactQueries.ts:6-16`；包页 server query/detail：`apps/frontend/platform-admin/src/features/terminal-update/ui/TerminalUpdatePackagesPage.tsx:83-135,525-565`。
- Operations rule filters：`apps/frontend/operations-admin/src/features/terminal-update/model/terminalUpdateRuleFilters.ts:1-27`；规则列表的标题、过滤控件与 query/reset：`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:411-463,566-610`；FULL/HOT 候选状态与请求：同文件 `1004-1049,1080-1120,1163-1208`。
- API 输入完整性：`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/api/TerminalUpdateArtifactOwnerApi.java:222-239`。
- query SQL 对 kind 分支：`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateArtifactPersistence.java:152-191`。FULL 自身列与 HOT `minimum_full` 文本列语义有意不同，不能将该三字段含义全局改写。
- acceptance readback：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalUpdateAcceptanceScenarios.java:180-218`。
- 当前 canonical schema five-fact detail 来源为 `contracts/openapi-source/terminal-update.schemas.json`；materialized/OpenAPI 与 generated TypeScript 已由仓内生成链更新。

## focused 与受管证据

- `yarn workspace @catering-v2s/operations-admin vitest run src/features/terminal-update/model/terminalUpdateCandidateQuery.test.ts src/features/terminal-update/model/terminalUpdateRuleFilters.test.ts`：2 files / 4 tests PASS。
- `yarn workspace @catering-v2s/platform-admin vitest run src/features/terminal-update/ui/terminalUpdateArtifactQueries.test.ts`：1 file / 2 tests PASS。
- operations-admin、platform-admin typecheck PASS；各自相关文件 ESLint `--max-warnings=0` PASS。
- `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/generate/r5-edge-materialize.mjs` PASS；`edge-codegen --write`、`--check`、`--self-test` PASS。运行记录中的 schema SHA-256：`7931350f487998e5814d1cc6c176ec4e2b8bd1f307b71b3d63d1b8407cd92442`。
- backend acceptance run `r5-tc-1791583917562-56600`：`terminal-update.artifact-hot-minimum-full` CONTRACT/BUSINESS PASS，DB_OPERATIONS=12；Gradle、证据归档、Testcontainers 容器/卷、远端进程/工作区 cleanup PASS；先前受管 DEV stop 与运行后 restore PASS。完整 manifest：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1791583917562-56600/run-manifest.json`。

## 结论边界与 OPEN

- 当前受管单场景只证明 HOT minimum FULL server query、typed partial filter rejection 与 owner detail readback；不证明这次新增后台 UI 的浏览器交互。
- 两个 Stage B Android dual-screen 真实供给链历史 runs 仍不含当前源码 digest；不能声明 hash-bound 到当前字节。
- calibrated DEV budget/CP-05 operation projection 仍未关闭；identity-only DEV readiness 不等于预算 PASS。
- 默认完整 `scripts/verify`、Browser L2、完整 Android 矩阵、UAT、生产仍 `NOT_RUN/NOT_COVERED`。
- N-1 作为设计差异公开保留。fresh 独立 implementation review 与 13c/受影响 6b 差量结论仍待 reviewer 回报。

**当前字节上的最新运行：** `r5-tc-1791583917562-56600`，2026-10-09 22:11:57～22:17:24 UTC，场景 business PASS、cleanup PASS。  
**最后一次通过：** 同一 run；相对本轮后端 schema/SQL/acceptance 与受测源码一致，未证明新增后台 UI 的动态行为。
