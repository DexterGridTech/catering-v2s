# TER 版本定义、完整更新与热更新阶段 B implementation review 请求

## 背景

Dexter 已授权阶段 B 实施；本轮交付范围是阶段 B 已批准的供给闭环与报告闭环，不包含阶段 C 自动择新、闲时调度、双机更新规则、生产发布或 UAT。阶段 A 的差量修复和阶段 B 实施期间的多轮静态 intake 已分别记录，旧结论只按其字节边界保留。

本次请求 Claude 对当前仓库字节做 `REVIEW_TARGET=IMPLEMENTATION` 独立源码复核。请不要把本请求视为 Codex 自行宣称整批 GO；当前证据需要由 Claude 重新判断。

## 最终供给链动态差量（2026-10-10）

- 额外 fresh 子 agent review 曾给出 `NO-GO, M/S/N=0/3/2`，主 agent 已重开当前 cited source。五项均为 `REJECTED_WITH_EVIDENCE`：上传 Drawer 实际只有恒显示“保存”的一个主按钮；规则新建有默认停用的“初始状态”选择且提交所选值；报告 UI 通过 owner 投影渲染规则/工件身份，缺投影不回退暴露 UUID；Tab 当前文案为“终端更新状态”；停用 Tag 使用 warning 色。逐项路径、行号和反例见 `doc/review/platform/2026-10-10-ter-version-update-stage-b-final-intake-codex.md`。请仍以当前源文件为准独立判断，不继承该 review 或作者的拒绝分类。
- 该 run 另暴露 Playwright exact-text oracle 不接受 Ant Design 中文按钮排版空格：首败 `1aa7b20e-f3a3-4210-a5b5-27e9a4a83999` 发生在 FULL parse HTTP 201 后、保存点击前。页面文字源是“保存”；最终只将 helper 断言改为接受汉字间可选空白，并保留 enabled 检查与真实点击。该首败与根因记录见上方 final intake 文档。修正后 terminal-automation typecheck PASS。
- Console 当前双屏真机 `update.supply-chain`：run `83d2878b-a672-4af9-8b6b-3f82cf4cf0c0`，case assertions PASS，CBS 报告投递后 selector `pending=0`，后台报告历史读回 `history=1`，最终 `business=PASS`、`cleanup=PASS`。其 manifest、日志和逐阶段读回位于 `.runtime/terminal-automation/83d2878b-a672-4af9-8b6b-3f82cf4cf0c0/`。运行时间从 `2026-10-09T22:49:59.702Z` 到 `2026-10-09T22:55:16.625Z`。
- Wallpaper 当前双屏真机同 case：run `5a051c3a-c1e4-46d2-8dab-bb87210e4042`，FULL 安装与 HOT 完成，wallpaper assets selector/readback 为 loaded，CBS 报告投递后 `pending=0`，后台历史读回 `history=1`，最终 `business=PASS`、`cleanup=PASS`。manifest、日志和逐阶段读回位于 `.runtime/terminal-automation/5a051c3a-c1e4-46d2-8dab-bb87210e4042/`。运行时间从 `2026-10-09T22:55:22.095Z` 到 `2026-10-09T23:00:32.016Z`。
- 两条真机 run 使用同一已授权设备 `D409P5C2J0285`（API 34、arm64-v8a）及唯一入口 `node ./scripts/test/terminal-automation.mjs --phase update --platform android --shape dual --case update.supply-chain --sample <console|wallpaper> --device-serial D409P5C2J0285`。设备包、浏览器、adb reverse、生成 APK/ZIP 和 staging 均清理 PASS。受管 DEV 保留并继续运行；未执行 reset/seed。run manifest 未绑定 source digest/worktree hash，故请将这些视为实际受管运行记录而非哈希证明。
- 未运行默认全仓 `scripts/verify`、完整设备矩阵、Browser L2、UAT、生产或阶段 C。当前 DEV start 为 `IDENTITY_ONLY` readiness，不是当前 operation roster 的 calibrated budget PASS。

## 本次 closeout 新增证据与明确限制

- TDS topic acceptance 首次失败及最小修复见 `doc/review/platform/2026-10-10-ter-version-update-stage-b-topic-acceptance-first-failure-codex.md`。修复后的同一 focused command run `r5-tc-1791581711945-13865` 于 `2026-10-09T21:35:11.945Z` 至 `2026-10-09T21:38:44.063Z` 完成，manifest `status=PASS`、`firstFailure=null`、Testcontainers 容器/卷、远端进程与工作区 cleanup 均 `PASS`；scenario `storeTerminalActivationBusinessPrecedence` 的 CONTRACT/BUSINESS 均 PASS，TDS contract `DISCOVERED=3 PASS=3 FAIL=0`。首次失败原因为 FULL-only acceptance helper 错带 `hotStrategy=IMMEDIATE`，已记录并由最小 fixture 修正关闭。
- 默认 calibrated DEV start 首败 run `r5-dev-1791581940180-14259-7aebbff7-de20-4727-ac65-9743b96e737b`，首因是已有 CP-05 校准报告缺少当前 `stagePlatformTerminalUpdateArtifact` 投影项，非 DEV runtime readiness 失败。未伪造或补写校准结果，也未运行 304 operation 三次标定。
- 其后通过仓内受管 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/dev/start` 启动 run `r5-dev-1791582207969-15314-4ad905ab-fc3f-45df-b309-b48cf768e7b8`。CBS、三台 TDS、HAProxy 双入口、两个后台 Vite/tunnel 完成 readiness；DEV 有意保留供 Dexter review。此 run 证明当前 identity-only 模式的受管运行就绪，不证明 CP-05 calibrated budget；预算报告差异仍为 OPEN/未标定。
- 当前 6b 最新复核为 `MATCHED`，记录见 `doc/review/platform/2026-10-10-ter-version-update-stage-b-6b-current-reconciliation-codex.md`；其明确不替代本次逐代码 13c 或最终整批 `REVIEW_TARGET=IMPLEMENTATION` verdict。
- Console 与 wallpaper 两个 Android 单机双屏真实供给链历史 run 仍分别为 `313353c8-f19c-4ca0-9d7a-65e5e5bbbfe1`、`ad05f7b8-6ef0-4ab9-ba75-59ba9fe63066`，business/cleanup 均 PASS；manifest 未绑定源码摘要、revision 或 workspace hash，故不得称为 hash-bound 当前字节证据。
- 本次未执行默认全仓 `scripts/verify`、完整设备矩阵、Browser L2、UAT 或生产验证；这些保持 `NOT_RUN`/`NOT_COVERED`，不得从 focused proof 或历史 run 推导为 PASS。
- 本轮修复此前整批静态复核的 M-1、S-1、S-2、S-3：operations-admin FULL/HOT 候选现用服务端游标与 query 搜索；platform-admin 最低 FULL 候选发送完整五事实过滤，详情读取 generated detail operation 并展示 HOT 的最低 FULL 身份；包列表添加应用/runtime/query/reset 与目标标题详情入口；规则列表添加应用/创建日期过滤与目标标题详情入口。finding intake 与准确代码行由 `doc/review/platform/2026-10-10-ter-version-update-stage-b-implementation-intake-r3-codex.md` 记录。
- 修复后的受管单场景 backend-acceptance run `r5-tc-1791583917562-56600` 于 `2026-10-09T22:11:57.562Z`～`2026-10-09T22:17:24.284Z` 完成，`status=PASS`、`business=PASS`、`cleanup=PASS`、`evidenceArchive=PASS`；场景 `terminal-update.artifact-hot-minimum-full` CONTRACT/BUSINESS PASS，DB_OPERATIONS=12。远端 Testcontainers 容器/卷、进程与工作区清理 PASS；已有 DEV `r5-dev-1791582207969-15314-4ad905ab-fc3f-45df-b309-b48cf768e7b8` 按联动先停止、运行后恢复，DEV cleanup PASS。原始 manifest：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1791583917562-56600/run-manifest.json`。
- acceptance 的 owner 断言包含：五事实 FULL query 命中注册 FULL、部分 minimumFull tuple 返回 typed 422、HOT 详情读回同一 FULL 的 application/build/runtime/publication/APK SHA。此为后台 HTTP/PG 场景证据，不是平台/运营后台浏览器 UI 动态证据。
- 当前后台差量的 focused 证据：operations-admin helper Vitest 2 files/4 tests PASS；platform-admin artifact query Vitest 1 file/2 tests PASS；两个后台 typecheck 与受影响文件 ESLint PASS。canonical→materialize→edge-codegen write、edge-codegen check/self-test PASS。不要据此声明默认全仓 verify 或 Browser L2 PASS。

## 评审目标

请独立核验阶段 B 当前实现是否符合正式需求、阶段 B 详设/计划/附件、Journey/IA/交互工件及项目规范，重点判断：

- CBS 工件上传、FULL/HOT 规则保存、项目报告查询、后台 UI 与 seed/fixture 生成链是否闭合；
- TDC/TER 固定目标、跨 App 拒绝、grant manifest、FULL/HOT 身份、报告发送和迟到/失败边界是否简单、正确、不过度；
- Android FULL/HOT prepare、readback、安装身份、APK/ZIP 摘要、staging 清理与 runner 清理是否满足普通有效更新路径；
- 现有 proof、CP 记录和 6b 记录的边界是否足以支持当前字节，哪些仍只能算 focused/static proof；
- 阶段 C、极端归档输入、完整设备矩阵、reset/seed/UAT 是否被越界实现或越界声明。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：正式需求与 R-15 行为判据。
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md`：阶段 B 用户任务和后台职责。
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md`：阶段 B 后台 IA、控件、权限与不可见行为。
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md`：阶段 B 交互稿和状态/原因文案边界。
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`：阶段 B 详设。
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：阶段 B 实施计划与验证顺序。
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md`：源码/API/官方依据与 operation 分母。
- `doc/review/platform/2026-10-09-ter-version-update-stage-b-6b-reconciliation-codex.md`：原全批 6b 记录；注意后续 R2 曾覆盖其结论。
- `doc/review/platform/2026-10-09-ter-version-update-stage-b-implementation-intake-r2-codex.md`：后续 fresh 复核 finding 处置及当前 focused evidence。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-static-review-intake-codex.md`：阶段 B 身份链静态复核与 Stage C 边界说明。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-failure-diagnosis-codex.md`：terminal-update actor 首败、根因与 focused 修复记录。
- `doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-01-proof-codex.md`、`doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-02-proof-codex.md`、`doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-03-reconciliation-codex.md`、`doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-04-reconciliation-codex.md`、`doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-05-reconciliation-codex.md`、`doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-06-proof-codex.md`：CP 级 proof/对账记录。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-6b-current-reconciliation-codex.md`：当前字节整批 6b 独立核验。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-cp-05-supply-chain-delta-reconciliation-codex.md`：供给链差量对账。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-topic-acceptance-first-failure-codex.md`：TDS topic acceptance 首败、根因、修复与同命令复验；也记录 DEV calibrated 首败和 identity-only 恢复边界。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-13c-finding-intake-codex.md`：13c 首次 OPEN finding 的主 agent intake、最小修复与当前字节 focused checks；其中 recheck 仍以 fresh reviewer 当前结论为准。
- `apps/backend/catering-business-server/modules/terminal-update/`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/terminalupdate/`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalupdate/`：CBS owner、edge、报告和下载入口。
- `apps/terminal/kernel/base/terminal-update/`、`apps/terminal/kernel/base/terminal-data-client/`、`apps/terminal/adapter/android/update/android/`：TER 固定目标、报告发送、FULL/HOT 原生实现。
- `apps/frontend/platform-admin/src/features/terminal-update/`、`apps/frontend/operations-admin/src/features/terminal-update/`、`tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts`、`tools/terminal-automation/journeys/update.android.test.ts`：两个后台 UI 与 automation 供给链。
- `scripts/dev/terminal-update-seed-*.mjs`、`scripts/dev/r5-fixture-contract.mjs`、`scripts/dev/r5-dev-runner.mjs`：seed/runner/fixture 支撑。

## 独立核验重点

1. 规则和报告事实链：上传工件、解析、保存、启用规则、TER 固定目标、任务报告、CBS 持久化、运营后台查询之间的身份是否连续可追踪。
2. FULL/HOT 身份链：应用名、native build、runtime、publication、APK SHA、ZIP SHA 和 `minimumFull` 是否在 owner、grant、TER、Android readback 中一致；console 不得升级 wallpaper。
3. 普通有效路径优先：代码是否聚焦普通有效更新路径；是否把阶段 C 或极端恶意归档防护误带入阶段 B。
4. 报告 UI：接收时间、状态发生时间、中文状态/原因、规则状态、FULL/HOT 引用是否从 owner 事实投影到前端，且没有 raw enum 直接暴露。
5. 资源与清理：FULL staging、run-owned 目录、seed 输入、Android prepared artifact 和 runner cleanup 是否有明确 ownership；cleanup 未证明的地方是否被如实标注。
6. 证据边界：focused tests/typecheck/backend-acceptance/managed Gradle run 各自只能证明对应执行面；请检查是否有把历史或局部 PASS 升级为整批动态 PASS 的问题。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M/S/N`。如有 finding，请列出仓根相对路径和精确行号、事实与推论、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
Dexter 转交：

您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 B 当前实现做独立 implementation review。

背景：Dexter 已授权阶段 B 实施；当前范围是阶段 B 已批准的供给闭环与报告闭环，不包含阶段 C 自动择新、闲时调度、双机更新规则、生产发布或 UAT。阶段 A 的差量修复和阶段 B 实施期间的多轮静态 intake 已分别记录，旧结论只按其字节边界保留。本次请求你对当前仓库字节独立判断，不继承 Codex 的旧 GO/MATCHED，也不要把局部 focused PASS 升级为整批动态 PASS。

目标：请独立核验阶段 B 当前实现是否符合正式需求、阶段 B 详设/计划/附件、Journey/IA/交互工件及项目规范。重点判断 CBS 工件上传、FULL/HOT 规则保存、项目报告查询、后台 UI、seed/fixture、TDC/TER 固定目标、grant manifest、FULL/HOT 身份、报告发送、Android prepare/readback、staging/runner cleanup 是否闭合；同时检查是否越界做了阶段 C、极端归档专项、完整设备矩阵、reset/seed/UAT 或生产部署。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：正式需求与 R-15 行为判据；
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md：阶段 B 用户任务和后台职责；
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md：阶段 B 后台 IA、控件、权限与不可见行为；
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md：阶段 B 交互稿和状态/原因文案边界；
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md：阶段 B 详设；
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md：阶段 B 实施计划与验证顺序；
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md：源码/API/官方依据与 operation 分母；
- doc/review/platform/2026-10-09-ter-version-update-stage-b-6b-reconciliation-codex.md：原全批 6b 记录；注意后续 R2 曾覆盖其结论；
- doc/review/platform/2026-10-09-ter-version-update-stage-b-implementation-intake-r2-codex.md：后续 fresh 复核 finding 处置及当前 focused evidence；
- doc/review/platform/2026-10-10-ter-version-update-stage-b-static-review-intake-codex.md：阶段 B 身份链静态复核与 Stage C 边界说明；
- doc/review/platform/2026-10-10-ter-version-update-stage-b-failure-diagnosis-codex.md：terminal-update actor 首败、根因与 focused 修复记录；
- doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-01-proof-codex.md、doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-02-proof-codex.md、doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-03-reconciliation-codex.md、doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-04-reconciliation-codex.md、doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-05-reconciliation-codex.md、doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-06-proof-codex.md：CP 级 proof/对账记录；
- doc/review/platform/2026-10-10-ter-version-update-stage-b-6b-current-reconciliation-codex.md：当前字节的全批 6b 独立 MATCHED 记录；
- doc/review/platform/2026-10-10-ter-version-update-stage-b-cp-05-supply-chain-delta-reconciliation-codex.md：CP-05 供给链差量对账；
- doc/review/platform/2026-10-10-ter-version-update-stage-b-topic-acceptance-first-failure-codex.md：TDS topic acceptance 首败根因、focused 修复及最终 DEV 启动边界；
- apps/backend/catering-business-server/modules/terminal-update/、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/terminalupdate/、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalupdate/：CBS owner、edge、报告和下载入口；
- apps/terminal/kernel/base/terminal-update/、apps/terminal/kernel/base/terminal-data-client/、apps/terminal/adapter/android/update/android/：TER 固定目标、报告发送、FULL/HOT 原生实现；
- apps/frontend/platform-admin/src/features/terminal-update/、apps/frontend/operations-admin/src/features/terminal-update/、tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts、tools/terminal-automation/journeys/update.android.test.ts：两个后台 UI 与 automation 供给链；
- scripts/dev/terminal-update-seed-*.mjs、scripts/dev/r5-fixture-contract.mjs、scripts/dev/r5-dev-runner.mjs：seed/runner/fixture 支撑。

请重点独立核验：
1. 上传工件、解析、保存、启用规则、TER 固定目标、任务报告、CBS 持久化、运营后台查询之间的身份是否连续可追踪；
2. 应用名、native build、runtime、publication、APK SHA、ZIP SHA 和 minimumFull 是否在 owner、grant、TER、Android readback 中一致，console 不得升级 wallpaper；
3. 代码是否聚焦普通有效更新路径，是否把阶段 C 或极端恶意归档防护误带入阶段 B；
4. 报告列表/详情是否显示接收时间、状态发生时间、中文状态/原因、规则状态和 FULL/HOT 引用，且没有 raw enum 直接暴露；
5. FULL staging、run-owned 目录、seed 输入、Android prepared artifact 和 runner cleanup 是否有明确 ownership；cleanup 未证明的地方是否被如实标注；
6. focused tests/typecheck/backend-acceptance/managed Gradle run 各自只能证明对应执行面，请检查是否有把历史或局部 PASS 升级为整批动态 PASS 的问题。

本轮新增当前字节证据与边界：
- 修复后的 focused backend-acceptance run `r5-tc-1791581711945-13865` 于 `2026-10-09T21:35:11.945Z`～`2026-10-09T21:38:44.063Z` PASS；唯一场景 CONTRACT/BUSINESS PASS，TDS contract 3/3 PASS，容器、卷、远端进程与工作区 cleanup PASS。前一首败及修复因果见上述 failure 记录。
- 默认 calibrated DEV start run `r5-dev-1791581940180-14259-7aebbff7-de20-4727-ac65-9743b96e737b` 因当前 CP-05 报告缺 `stagePlatformTerminalUpdateArtifact` 未启动完成；未补造预算报告，未运行 304 operation 三次标定。随后 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/dev/start` run `r5-dev-1791582207969-15314-4ad905ab-fc3f-45df-b309-b48cf768e7b8` PASS 并有意保留。该结果证明 identity-only 受管 readiness，不证明 calibrated budget。
- 历史单机双屏真机 console 与 wallpaper supply-chain runs 分别为 `313353c8-f19c-4ca0-9d7a-65e5e5bbbfe1`、`ad05f7b8-6ef0-4ab9-ba75-59ba9fe63066`，均有 manifest business/cleanup PASS；manifest 不含源码 digest/revision/workspace hash，不是 hash-bound 当前字节证明。
- 本轮未跑默认全仓 `scripts/verify`、完整设备矩阵、Browser L2、UAT 或生产验证；均保持 `NOT_RUN`/`NOT_COVERED`。请勿将局部和历史 PASS 扩写为当前全量 PASS。
- 13c 对平台 HOT 候选 finding 首次报 `OPEN`。主 agent 已确认并作最小差量：候选请求现发送五事实服务端 query，普通 FULL 列表仍无候选过滤；新增 query-builder focused test。当前 bytes 上该 Vitest 2/2、platform-admin typecheck、三个变更文件 ESLint 均 PASS。请独立重开修复后的 UI、helper、test、generated query 与 owner SQL，确认此项是否关闭；不得把作者 intake 当作 `MATCHED`。

请给出明确 GO 或 NO-GO，并报告 M/S/N。每条 finding 请列出仓根相对路径和精确行号、事实与推论、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次只请求阶段 B 当前实现的 implementation review。评审结论不授权阶段 C、完整动态重跑、reset/seed、L2、UAT、生产部署或商店发布；不要求补跑本轮明确未授权或未受影响的设备矩阵。谢谢。
```

交付前结构检查：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-10-10-ter-version-update-stage-b-implementation-review-request-codex.md
```

