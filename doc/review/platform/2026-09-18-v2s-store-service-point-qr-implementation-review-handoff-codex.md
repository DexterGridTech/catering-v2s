# 门店桌台与二维码管理实施结果评审交接

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=STORE_SERVICE_POINT_QR_IMPLEMENTATION_20260917
REVIEWER_KIND=MAIN_CODEX_HANDOFF
EVIDENCE_TIER=MANAGED_RUNTIME_AND_STATIC_RECONCILIATION
PRE_REPAIR_INDEPENDENT_REVIEW=NO-GO_M/S/N=1/2/1
LATEST_INDEPENDENT_IMPLEMENTATION_REVIEW=GO_M/S/N=0/0/0
POST_REPAIR_INDEPENDENT_REVIEW=GO_M/S/N=0/0/0
CLAUDE_CURRENT_BYTE_INTAKE=NO-GO_M/S/N=2/3/2
CURRENT_FRESH_STATIC_REVIEW=GO_M/S/N=0/0/0
CURRENT_STATUS=OPEN_PRODUCT_DECISION
BROWSER_L2=NOT_AUTHORIZED_NOT_RUN

## 背景

本轮交付单元是「门店桌台与二维码管理」的实现结果。Dexter 已根据 Claude 上一轮 `REVIEW_TARGET=DESIGN` 的结论授权进入实施；本轮已完成详设/计划对应的生产代码、契约与生成物、migration、测试、seed 与受管 reset/DEV/backend acceptance。Claude 上一轮指出的 token 分母残留（M-01）以及 asset stage/release 场景归属（S-01）、审计场景文件集（S-02）均已修复并在当前字节重新核对。

实施完成后，fresh 独立只读 reviewer 在修复前的当前字节给出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=1/2/1`。四条 finding 已逐条重开 owning source 并完成修复：QR disabled 保留渠道与数据库约束修正；QR 列表/详情配置状态文案区分；服务点扩展审计改为共享四态/标签快照；页面标题恢复 IA 术语。随后新的 fresh reviewer Faraday 对当前修复字节提出 `NO-GO/M/S/N=1/0/0`：不可用对象仍展示 QR URL，且有效值未按 IA 转成入口。该 finding 已重开需求/IA/交互/详设并修复为 `effectiveAvailable` 边界加现有 `Typography.Link` 入口。修复前两次结论均不作为当前最终 verdict；Hubble 已对最新字节完成新的 fresh 独立静态复审，结论为 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO`、`M/S/N=0/0/0`。

本交接不把主 agent 自身的逐代码对账当作独立 review verdict，也不把 Browser L2 未授权项当作实现缺陷或验收 PASS。当前字节另有 Claude 转达的 `NO-GO/M/S/N=2/3/2` finding intake，以及 Mendel 的 fresh 静态 `GO/M/S/N=0/0/0`；前者的 M-01 与 S-03 仍分别需要产品和范围裁决，因此本交接不是已收口的最终交付结论。

本轮已确认并修复的代码逻辑项：服务点列表改为 `OpaqueCollectionCursor` keyset 且去除 per-item DB 查询；QR 配置/候选读取移到列表循环外并在内存派生 URL；前端区分 QR 配置 loading/failed；删除未引用的 `createPointDefaults`。Carson 针对初始 QR CHECK 的 finding 已由 `V20260918_000000_000__preserve_store_qr_channel_when_disabled.sql` 的后续约束替换反证，不做错误修复。上述本轮改动尚未追加新的动态 reset/DEV/seed 证据。

## 评审目标

请基于当前仓库字节独立进行 `REVIEW_TARGET=IMPLEMENTATION` 静态代码逻辑复审，确认：

1. organization owner、门店类型 target scope、项目层/门店层双向读取、按开关键 gate、三态/排序/作废和 owner readback 是否与详设一致；
2. 本域 11 个 HTTP gate entry 是否完整，尤其 stage/release 两个资产入口是否在 gate-off 时均先拒绝；`claim` 是否只作为 point owner 事务步骤；
3. `CatalogInventoryWorkspaceCommandTokens` 的 33 条 gate=true + 3 条 preflight=false 与 sales-menu 19 条直调 gate 是否没有被错误合并为伪 token 链；52 只作为 gate 分母；
4. QR candidate bounded read、门店归属、四维谓词、保存时 owner 重校验、D-10 候选不预过滤与 D-12 生成层最终 URL 判定是否闭合；
5. `SERVICE_POINT` extension host、非 flat flags、集团空间定义粒度、扩展值及四态审计是否复用既有 owner/contract；
6. TABLE-only image、asset stage/release/claim、事务与无孤儿资产边界是否成立；
7. operations-admin 的 SalesMenu 式双列表、动态「新建桌台/新建扫码点」、排序边界、统一 dirty guard、二维码主页面摘要/独立编辑 Drawer、扫码点无图片及 IA 静态前置记录是否和实现一致；二维码列表/详情是否以 `effectiveAvailable` 隐藏不可用入口，并以「查看二维码」入口而非原始 URL 展示有效结果；
8. seed、reset/DEV、backend acceptance 与当前对账材料是否只报告实际证据，business 与 cleanup 是否分开。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`：需求正本；
- `doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md`：业务 Journey；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md`：IA、IA-ID 与控件约束；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md`：交互状态与失败恢复；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md`：实现详设、gate、契约、owner 与 P9 判据；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md`：P0–P9 实施计划；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java`：区域、服务点、QR owner；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreServicePointController.java`：operations edge 与 scope；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreServicePointAcceptanceScenarios.java`：本域 acceptance，含 stage/release gate-off 反例；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`：渠道模板、候选和 QR 语义；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/ExtensionAcceptanceScenarios.java`：`SERVICE_POINT` host 与定义；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AuditAcceptanceScenarios.java`：共享审计读写回归；
- `apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx`：页面、双列表、Drawer、QR 与错误恢复；
- `apps/frontend/operations-admin/src/features/store-service-point/storeServicePointTestIds.ts`：IA 控件 testId 绑定；
- `doc/review/platform/2026-09-18-v2s-store-service-point-qr-ia-static-preflight-codex.md`：逐控件 IA 静态位置/样式/行为前置比对；
- `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs`：9 host seed、scope 切换与显式规则 readback；
- `doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md`：本次 P9 逐代码对账、运行结果与失败根因记录。

## 独立核验重点

- `StoreServicePointService` 与 `OperationsStoreServicePointController`：门店类型 target scope 是否同时支持项目层祖先路径和门店层自身匹配，规则 gate 是否在所有 mutation 之前；
- `StoreServicePointAcceptanceScenarios.storeServicePointGateAndRoles`：9 个 organization command、asset stage、asset release 是否每个都有关闭 gate 的反例，且 stage/release 在 asset lookup 前拒绝；
- `CatalogInventoryWorkspaceCommandTokens`、生成脚本与 `SalesMenuOwnerService`：33 条 gate token、3 条 preflight token 和 19 条 sales-menu 直调是否保持两条链分离，52 是否只作为分母；
- business-channel candidate/composer 与 acceptance：bounded read、门店归属、四维谓词、保存重校验、D-10 候选不预过滤、D-12 最终 URL 合规判定及 URL 五种合法形态；
- extension/audit/asset owner：`SERVICE_POINT` 是否不进入 flat 宿主，四态审计是否可表达，TABLE-only 图片是否复用现有 asset core 且失败无孤儿；
- `StoreServicePointPage.tsx`：SalesMenu 式双列表、动态按钮、上移/下移边界、主页面 QR 摘要与独立编辑 Drawer、扫码点无图片、统一 dirty guard、失败恢复和静态 IA-ID 记录；
- seed/runtime：9 host/FLAT=5、显式 `tableManagementEnabled=true`、PROJECT/STORE scope 切换、VOIDED mutation/current-read 边界，以及受管 manifest 的 business/cleanup 分账。

## 当前受管运行证据

- reset：`.runtime/r5/reset/r5-reset-b7a7f262-901e-44ca-ae45-11d47a7ee6e7/run-manifest.json`，`R5_DEV_RESET=PASS`，cleanup=`PASS_NO_PERSISTENT_RESET_PROCESS`；
- 最终 DEV：run `r5-dev-1789677991497-54436-6c84a838-ad09-44f3-9fa4-5fc06a1c3b54`，`.runtime/r5/run-manifest.json`；远端 Java、HTTP/asset-only tunnel、本机 5174/5175 Vite 均为受管拓扑，readiness=`REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`；
- 完整 seed：`.runtime/r5/seed/complete/complete-seed-b5c32122-7430-40f8-82c8-4f99d3d6adb7/seed-report.json`，`business=PASS`、`cleanup=PASS_PRESERVED_DEV_STATE`、`firstFailure=null`；四个组件均 PASS，owner readback 为 9 个 extension host、4 个 area、5 个 point，QR post-step PASS；
- post-repair focused backend acceptance：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789677150302-2592/run-manifest.json`，`storeQrConfigurationLifecycle` 的 `CONTRACT=PASS`、`BUSINESS=PASS`、`DB_OPERATIONS=10`，measurement `DB_OPERATIONS=280`、`SQL_OPERATIONS=195`、`UNCLASSIFIED_SQL=0`，远端 cleanup PASS；
- Browser L2：`NOT_AUTHORIZED/NOT_RUN`；IA 静态前置比对为 `PASS_STATIC_PREFLIGHT`，不是动态浏览器验收。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M/S/N` 数量。每条 finding 请标明：

- 依据的详设/计划章节与当前源码精确文件、行号；
- 属于仓内事实、推论、产品判断还是尚缺证据的假设；
- 对业务、权限、数据、审计、契约或用户体验的影响；
- 最小根因修复及为何不能更小；
- 是否需要 Dexter 产品或范围裁决。

请将未授权的 Browser L2、UAT、部署单列为 `NOT_AUTHORIZED/NOT_RUN`，不要把它们作为 M/S/N 缺陷，也不要把受管运行结果扩展为浏览器验收结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对「门店桌台与二维码管理」实施结果做一轮独立静态 IMPLEMENTATION review。

背景：Dexter 已根据上一轮 DESIGN 复审结论授权实施。本轮已完成生产代码、契约/生成物、migration、测试、seed、受管 reset/DEV/backend acceptance；Claude 上一轮指出的 token 分母残留、asset stage/release gate 场景归属和审计场景文件集已修复。当前交付材料与逐代码对账见：
- doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md
- doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-review-handoff-codex.md

目标：请独立核验当前实施的 architecture、contract、owner boundary、业务代码逻辑与受管运行材料是否与详设和实施计划一致，并识别任何应阻断交付的 M/S/N finding。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md：需求正本；
- doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md：业务 Journey；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md：IA 与 IA-ID；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md：交互与失败恢复；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md：详设；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md：P0–P9 计划；
- apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java：organization owner；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreServicePointController.java：edge/scope；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreServicePointAcceptanceScenarios.java：本域 gate、asset、scope 场景；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java：渠道/二维码场景；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/ExtensionAcceptanceScenarios.java：SERVICE_POINT host；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AuditAcceptanceScenarios.java：审计回归；
- apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx：页面、列表、Drawer 与恢复；
- apps/frontend/operations-admin/src/features/store-service-point/storeServicePointTestIds.ts：IA 控件绑定；
- doc/review/platform/2026-09-18-v2s-store-service-point-qr-ia-static-preflight-codex.md：逐控件 IA 静态前置比对；
- scripts/dev/r5-seed-plan.mjs 与 scripts/dev/owner-command-seed-executor.mjs：seed 与 scope/readback；
- doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md：P9 对账及受管运行记录。

请重点独立核验：
1. 门店类型 target 的 scope 解析是否同时支持项目层与门店层；owner gate 是否位于 mutation 前；三态、排序、作废、类型一致性和 readback 是否闭合；
2. 本域 11 个 HTTP gate entry 是否逐项覆盖，stage/release 在 gate-off 时是否各自先拒绝；claim 是否只在 point owner 事务内；
3. 既有 36 条 token 中 33 条 gate=true、3 条 preflight=false，以及 sales-menu 19 条直调 gate 是否保持两条链分离；52 仅为 gate 分母；
4. QR candidate bounded read、四维谓词、保存重校验、D-10 候选不预过滤、D-12 仅按最终 URL 合规生成；
5. SERVICE_POINT extension host/非 flat flags/四态审计；TABLE-only image 与 staged asset 无孤儿；
6. operations-admin 的 SalesMenu 式双列表、动态新建按钮、上移下移边界、二维码摘要/编辑 Drawer、扫码点无图片、统一 dirty guard，以及 IA 静态前置记录是否与源码一致；
7. reset/DEV/seed/backend acceptance 的 business 与 cleanup 是否与实际 manifest 一致；重点区分 post-repair QR focused run 与未在本轮重跑的其他场景。不要把 Browser L2（当前未授权）当作本轮动态验收。

烦请给出明确 `GO` 或 `NO-GO`，并按 `M/S/N` 报告。每条 finding 请写明详设章节、当前源码文件与行号、影响、最小根因修复及是否需要 Dexter 裁决。动态未运行或未授权项请单列，不要升级为实现缺陷。

授权边界：本轮只请求对当前实施源码、契约、migration、测试/seed 代码与已产生的受管运行材料做独立静态 IMPLEMENTATION review；不新增实施、reset、seed、DEV、Browser L2、UAT、部署或 Git 授权。谢谢。
```
