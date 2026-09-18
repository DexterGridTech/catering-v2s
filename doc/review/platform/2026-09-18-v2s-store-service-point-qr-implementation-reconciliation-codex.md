# 门店桌台与二维码管理实施逐代码与详设对账

REVIEW_TARGET=IMPLEMENTATION
RECONCILIATION_KIND=P9_CODE_TO_DESIGN
EXECUTOR=MAIN_CODEX
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED
STATUS=OPEN
P9_CODE_TO_DESIGN_STATUS=OPEN
PRE_REPAIR_INDEPENDENT_REVIEW=NO-GO_M/S/N=1/2/1
INDEPENDENT_IMPLEMENTATION_REVIEW=FRESH_POST_REPAIR_REVIEW_GO_M/S/N=0/0/0
CLAUDE_CURRENT_BYTE_INTAKE=NO-GO_M/S/N=2/3/2
CURRENT_FRESH_STATIC_REVIEW=GO_M/S/N=0/0/0
OPEN_PRODUCT_DECISIONS=2
BROWSER_L2=NOT_AUTHORIZED_NOT_RUN

## 1. 范围、授权与口径

本记录覆盖「门店桌台与二维码管理」从已批准需求、Journey、IA/交互、详设与实施计划到当前源码的逐代码对账。实施授权来自 Dexter 对 Claude 第 2 轮 DESIGN 复审结果的明确转交，范围包括生产代码、契约生成、migration、测试、backend acceptance、reset、DEV 与 seed；Browser L2、UAT、生产部署和 Git 控制不在授权内。

本文件的 `MATCHED` 只表示当前功能源码与适用设计材料逐项对齐，不把静态对账替代独立实施 review，也不把 Browser L2 或 UAT 的未授权项升级为运行结论。

主要设计输入：

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`：需求正本；
- `doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md`：唯一业务 Journey；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md`：IA 与 IA-ID；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md`：交互与状态行为；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md`：详设；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md`：P0–P9 实施计划；
- `doc/review/platform/2026-09-18-v2s-store-service-point-qr-ia-static-preflight-codex.md`：进入 Browser L2 前的逐控件静态 IA 前置比对。

## 2. P0–P9 完成对账

| 步骤 | 设计交付 | 当前源码/工件 | 结果 |
| --- | --- | --- | --- |
| P0 | 需求、Journey、IA、交互、详设、计划及设计复审处置 | 上述六份文档；计划 §2–§3；Claude 第 2 轮 DESIGN findings 的处置已落入详设/计划 | MATCHED |
| P1 | 数据模型、三态生命周期、排序、未作废范围唯一性、QR 单例 | `apps/backend/catering-business-server/src/main/resources/db/migration/V20260917_000000_000__store_service_point_qr.sql`；`organization/application/StoreServicePointService.java` | MATCHED |
| P2 | edge contract、generated wire、admin-catalog 注册与错误边界 | `contracts/openapi/operations.yaml`；`contracts/catalog/admin-catalog.json`；`apps/frontend/operations-admin/src/generated/`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreServicePointController.java` | MATCHED |
| P3 | 业务渠道模板 URL rule、二维码候选 bounded read、D-10/D-12 生成语义 | `apps/backend/catering-business-server/modules/business-channel/`；`BusinessChannelAcceptanceScenarios.java`；`StoreServicePointService.java` 的 QR owner 读取/保存 | MATCHED |
| P4 | 扩展字段 `SERVICE_POINT` 宿主、集团空间级定义、值与审计 | `modules/extension/`；`modules/organization/`；`ExtensionAcceptanceScenarios.java`；generated host enum/schema | MATCHED |
| P5 | 资产 stage/release/claim、TABLE-only 图片、无孤儿资产 | `modules/asset/`；`StoreServicePointAssetCommandApi`；`StoreServicePointAcceptanceScenarios.java` | MATCHED |
| P6 | operations edge、platform-admin host、operations-admin 页面与 Drawer | `apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx`；`storeServicePointTestIds.ts`；既有 foundation 与 SalesMenu list pattern | MATCHED |
| P7 | focused/backend acceptance、V-1–V-16 场景落点与 11 个 HTTP gate entry 逐项核查 | `StoreServicePointAcceptanceScenarios.java`、`BusinessChannelAcceptanceScenarios.java`、`ExtensionAcceptanceScenarios.java`、`AssetAcceptanceScenarios.java`、`AuditAcceptanceScenarios.java`；当前受管 run 聚焦执行 gate 场景 | MATCHED（代码/场景映射与本次 focused run） |
| P8 | reset、DEV、seed、owner readback | 见 §5 的受管运行记录与 seed reports | MATCHED |
| P9 | 整体三维对账、逐代码与详设对账、交付材料 | 本文件及 `2026-09-18-v2s-store-service-point-qr-implementation-review-handoff-codex.md` | MATCHED |

## 3. 逐代码与详设对账明细

### 3.1 契约与生成链

- `SERVICE_POINT` 已接入 `ExtensionHostTypes`、definition management host 闭集和生成 wire；它不进入 `FLAT_VALUES`，list/search 两个动态能力保持 `null`，与详设 Gate-0.2、Gate-5.6 一致。
- organization area、service point、QR singleton 的 edge path、schema、generated binding 与 admin-catalog 注册均使用当前契约正本；未知字段、三态值、version/revision 和 error code 走生成/owner 分层。
- 本批没有新增平行定义页、dynamic columns 或 type search；operations-admin 只消费定义并提交 values。

### 3.2 organization owner、scope 与 gate

- `StoreServicePointService` 是区域、服务点和 QR 配置事实/命令 owner；写入先做 selected-store scope 与 `StoreOperatingRuleGate` keyed check，再做归属、状态、类型、顺序邻居和 version 校验，成功返回 owner readback。
- 三个 host 的规则读取使用门店类型目标解析：项目层走祖先路径，门店层走自身精确匹配；没有复用只解析 PROJECT target 的门店详情路径，覆盖 Claude M-01 的门店层/项目层双向边界。
- 本域 11 个 HTTP gate entry 为 9 个 organization command 加 asset stage/release 两个入口；`claimStoreServicePointImage` 仅为 point owner REQUIRED 事务步骤，不伪造成独立 HTTP entry。
- 上一批 `CatalogInventoryWorkspaceCommandTokens` 保持独立 token 链：36 条中 33 条 gate=true、3 条 preflight=false；sales-menu 的 19 个写入口不进入 token 链，直调 keyed gate。上一批 52 只是 33+19 的 gate 分母，未新增伪 token 链。
- 区域/服务点三态、区域停用不改写后代存储值、作废转态而非物理删除、未作废范围的 code/type 一致性和排序 owner readback 均与详设一致。

### 3.3 business-channel 与二维码

- QR candidate owner 使用既有 bounded read 形态及明确的门店归属、用途、模板目标、渠道状态/绑定维度谓词；不引入游标分页或模板 URL 属性预过滤。
- 保存时 owner 重新验证门店归属与四维谓词；未开启允许不选，已开启必须选。
- 候选层按既定渠道状态语义处理；D-10 的空/非法 URL 规则仍可进入候选并保存，生成层对最终 URL 做唯一合法性判定，失败显示「暂未生成二维码」；D-12 的生成判定不新增状态阻塞。
- URL composer 与合法性判定在同一住址，覆盖查询串、片段、问号/与号结尾、同名参数和百分号编码边界；参数名固定在契约中，二维码不持久化最终 URL。

### 3.4 extension 与 audit

- `SERVICE_POINT` 定义粒度为 group workspace；service point values 存在 organization owner，平面宿主集合只控制 list/search 标志，不控制存值能力。
- 扩展值变更使用与既有实体一致的四态审计表示，带字段标签快照；当前 acceptance 同时核对 definition、values、revision 和审计读写边界。

### 3.5 asset

- 复用现有 asset stage/release/claim 核心和 `STORE_SERVICE_POINT_IMAGE` usage；业务唯一关联是 point 的 `image_asset_ref`，没有新 asset target 表或存储机制。
- TABLE 才有一个真实 image input/asset path；SCAN 没有图片控件、request field、stage/release/claim path。
- stage 失败、owner save 失败或取消会 release staged asset；claim 与 point save 在同一 REQUIRED owner transaction，避免孤儿资产。

### 3.6 frontend 与 IA 控件

- `StoreServicePointPage.tsx` 复用 SalesMenu 的 master/dependent list 组织：左侧区域 master，右侧当前区域的桌台/扫码点列表；不自动选择第一条，区域/服务点上移下移通过行尾菜单并在首末边界禁用。
- 区域列表头部只有「新建区域」；依据选中区域类型动态显示「新建桌台」或「新建扫码点」，业务文案不暴露“服务点”。
- 二维码摘要留在主页面；编辑通过独立 Drawer 打开，主页面不另造二维码详情页；服务点详情使用只读 Descriptions，不使用 disabled Form 冒充详情。
- 二维码列表/详情只在 `effectiveAvailable=true` 时展示「查看二维码」入口；不可用对象只显示「不可用」边界文案。该入口消费 owner 派生 URL，不把 URL 原文作为普通字段或新增图片生成链路。
- 区域/服务点/二维码 Drawer 使用 foundation dirty lifecycle 和统一 footer；编辑控件不自管 dirty、不单独弹“请先保存”提示。扫码点不挂载桌台属性与图片，表单不出现顺序字段。
- 逐控件 IA-ID 的位置、容器、SalesMenu 基线样式、选中/排序/边界禁用/失败恢复及创建/编辑 Drawer 已在 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-ia-static-preflight-codex.md` 中逐项标为 `MATCHED_STATIC_PREFLIGHT`。该静态前置门已通过，但 Browser L2 仍未授权。

## 4. Claude finding 处置与当前代码核验

### 4.1 M-01：token 分母残留

已修复并在当前详设/计划中统一：36 条 token 中只有 33 条 gate=true，3 条 preflight 为 false；sales-menu 19 条是 owner 直调，不是 token。当前代码没有把 19 条重新塞入 token resolver 链。52 只作为上一批 gate 分母，不作为 token 数。

### 4.2 S-01：asset stage/release 场景归属

`StoreServicePointAcceptanceScenarios.storeServicePointGateAndRoles` 现在分别调用关闭门店的 stage 与 release，并在 asset lookup 前断言客户端失败；详设场景矩阵把两者归入 `storeServicePointGateAndRoles`，`storeServicePointTableAssetLifecycle` 只承载成功生命周期。这两条正向/反向边界已由受管 acceptance 场景实际执行。

### 4.3 S-02：审计场景文件集

详设和实施计划均包含仓内真实存在的 `AuditAcceptanceScenarios.java`；审计生产/读取回归与本批 service point 审计断言不再错误地塞入 organization 场景文件。

### 4.4 fresh 独立实施复审的处置

主 agent 之外的 fresh 只读 reviewer 在最后一轮修复前对当前源码给出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=1/2/1`。该 reviewer 的四条 finding 均逐条重开 owning source 后确认：

- M：QR 配置关闭时错误清空已选渠道，且数据库 check 方向相反。已新增 `V20260918_000000_000__preserve_store_qr_channel_when_disabled.sql`，将约束改为“开启才必须有渠道”；`StoreServicePointService.updateQrConfiguration` 与 `StoreServicePointPage.changeQrConfiguration` 均保留 disabled 状态下的 `channelRef`。这同时覆盖 R-6.2a、R-6.7a、R-6.7b。
- S：二维码主列表和详情把“未开启/未选渠道”与 URL 不合法混成同一文案。已由 `StoreServicePointPage.qrDisplayValue` 统一按 QR 配置状态区分“ 不显示生成结果 ”、“未选择门店渠道”和“暂未生成二维码”，列表与详情共用同一映射。
- S：服务点扩展字段只审计整个 JSON，未复用四态和字段标签快照。已将 `StoreServicePointOwnerApi.PointCommand` 改为携带 `ExtensionSubmission`，`StoreServicePointService` 调用共享 `BusinessEntityValueSupport.extensionChanges`，并增加 JSON owner value overload；新增测试覆盖字段标签与显式 JSON null 状态。
- N：页面可见标题仍出现“列表”或编辑标题缺少 IA 规定的“资料”。已将区域/桌台/扫码点卡片标题与 point 编辑 Drawer 标题统一为 IA 术语。

上述 finding 是修复前 reviewer 的输入，不把该 `NO-GO` 误写成当前最终 verdict；修复后需由新的 fresh reviewer 或 Claude 重新审查当前字节。

### 4.5 Faraday：二维码不可用边界与原始 URL 展示

新的 fresh 只读 reviewer Faraday 在上述四条修复之后重新审查当前字节，给出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=1/0/0`。该 finding 经主 agent 重开需求 R-2.8/R-6.14、IA/交互 §4.3/§10、详设 Gate-1.9/Gate-5.4 与当前前端源码后确认成立：owner projection 必须保留 D-12 的 `qrUrl` 生成事实，但区域或服务点不可用时不得把该事实作为二维码展示给用户；同时 IA 要求二维码结果为预览/入口，不能把 URL 原文当作普通用户字段。

已完成最小根因修复：

- `StoreServicePointPage.tsx` 的 `qrDisplayValue` 增加 `effectiveAvailable` 边界；不可用时只返回「不可用」，不渲染链接、不改写后端 `qrUrl`。
- 可用且配置开启、渠道已选、最终 URL 合规时，统一渲染现有 Ant Design `Typography.Link` 的「查看二维码」入口，使用 `target="_blank"` 与 `rel="noreferrer"`；关闭、未选渠道、URL 不合规仍保持各自既有文案。
- 列表与详情均传入 owner 返回的 `effectiveAvailable`，并通过 `qrResultLink(ref)` 使用稳定对象身份 testId；新增 `StoreServicePointPage.static.test.ts` 覆盖不可用不展示、有效值走入口且不暴露原始 URL 的静态断言。

该修复没有改变二维码 URL 生成、状态独立性、持久化边界或二维码图片生成范围。修复后的 fresh implementation review 由 Hubble 完成，结果见 §4.6。

### 4.6 Hubble：最新 fresh 独立复审

Hubble 作为新的 fresh、只读、非作者 reviewer，基于当前字节完成 `REVIEW_TARGET=IMPLEMENTATION` 静态代码逻辑复审，结论为 `VERDICT=GO`、`M/S/N=0/0/0`。其独立核验确认：

- `StoreServicePointPage.tsx` 的列表与详情都先消费 owner 的 `effectiveAvailable`；不可用对象只显示「不可用」，不渲染二维码入口；可用、配置开启、渠道已选且存在派生 URL 时复用现有 `Typography.Link` 展示「查看二维码」，不把 URL 原文当普通字段。
- 后端仍保留 D-12 的派生 URL 事实和状态独立生成语义，没有新增二维码图片生成、下载、持久化或 QR entity 链路；`qrResultLink` testId 在列表/详情真实绑定。
- owner/scope/gate、三态/排序/候选/save recheck、D-10/D-12、`SERVICE_POINT` extension/audit、TABLE-only asset 与 seed/runtime 边界未发现新的阻断逻辑问题。

Hubble 明确将 Browser L2、UAT、部署与本轮未重跑的动态项列为 `NOT_AUTHORIZED/NOT_RUN`，没有把静态结论升级为动态验收。至此，修复前的两次 fresh `NO-GO` 均已处置，当前独立 implementation review 结论为 `GO`；仍须保留 Browser L2 未授权边界。

## 5. 历史受管运行记录（不覆盖本轮改后字节）

以下运行记录保留为历史证据。它们发生在本轮当前字节的服务点 keyset 分页、批量 QR 读取、QR loading/failed 显示与相关静态修复之前，因此不能被写成这些改动后的动态 PASS；本轮没有为了补 evidence 擅自重启 DEV、reset 或 seed。

### 5.1 reset、DEV、seed

- reset：`R5_DEV_RESET=PASS`，run manifest：`.runtime/r5/reset/r5-reset-b7a7f262-901e-44ca-ae45-11d47a7ee6e7/run-manifest.json`；`cleanup=PASS_NO_PERSISTENT_RESET_PROCESS`。
- 最终 DEV：`runId=r5-dev-1789677991497-54436-6c84a838-ad09-44f3-9fa4-5fc06a1c3b54`；根 manifest：`.runtime/r5/run-manifest.json`。拓扑为远端 trusted Java + 远端 localhost PostgreSQL + HTTP/asset-only tunnel + 本机两个 Vite；readiness marker 为 `REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`，平台 5174、运营 5175 由受管 runner 启动。当前 DEV 未执行 seed 以外的额外手工命令。
- 最终完整 seed：`.runtime/r5/seed/complete/complete-seed-b5c32122-7430-40f8-82c8-4f99d3d6adb7/seed-report.json`；`business=PASS`、`cleanup=PASS_PRESERVED_DEV_STATE`、`firstFailure=null`。四个组件均 PASS：owner-command、external-collaboration-business-channel、catalog-inventory、sales-menu；各组件 cleanup 均为 `PASS_PRESERVED_DEV_STATE` 或 `PASS_NO_PERSISTENT_SEED_PROCESS`。owner readback 记录了 9 个 extension host、4 个 area、5 个 point；QR post-step 的 candidate/config/readback 也均 PASS。
- seed 正本为 `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs` 与 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`；host 闭集为 9，FLAT 仍为 5，`SERVICE_POINT` 的 flat flags 为 `null`，门店的 `tableManagementEnabled` 显式为 true，并有 owner readback。owner-command report 记录 `extensionDefinitions=9`、`extensionValueEntities=42`、`servicePointAreas=4`、`servicePoints=5`。

### 5.2 backend acceptance

受管 run：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789677150302-2592/run-manifest.json`。

- topology：远端 `catering-remote-dev`；源码同步 PASS；远端 Gradle `REMOTE_GRADLE_STATUS=0`；本次 post-repair focused scenario `storeQrConfigurationLifecycle` 的 `CONTRACT=PASS`、`BUSINESS=PASS`、`DB_OPERATIONS=10`。
- runner 汇总：`DISCOVERED=160`、`SELECTED=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`STUB_ONLY=0`、`DIRECT_FAILURES=0`。
- 事件证据：该 run 的 measurement evidence 为 `DB_OPERATIONS=280`、`SQL_OPERATIONS=195`、`UNCLASSIFIED_SQL=0`、`UNCLASSIFIED_SQL_RATIO=0`；container、volume 与证据归档均 PASS。
- cleanup：`remoteProcess=PASS`、`remoteWorkspace=PASS`、`testcontainersContainers=PASS`、`testcontainersVolumes=PASS`；受测前 DEV 按联动规则 stop PASS，测试后 restore PASS，最终 cleanup PASS。
- 该 focused run 只覆盖 post-repair 的 QR configuration lifecycle；之前的 gate 场景运行结果不作为本次修复后的动态 PASS。Browser L2 仍未授权。

### 5.3 之前的首败与根因修复

完整 seed 首次尝试曾在 VOIDED service point 的当前读取边界失败：mutation 后错误复用排除 VOIDED 的 public `readPoint()`；已改为 `readPointAfterMutation(...)`，保留 public current-read 语义并返回 mutation readback。随后发现 seed 只在 PROJECT scope 下读取 STORE-scoped service point；已改为共享 context version 的 PROJECT/STORE selector，并在 service point chain 前显式切换 STORE。再次发现 seed 把 VOIDED 行送入 public current detail；已改为校验 mutation readback 后跳过该行 current detail。三处均为根因修复，最终完整 seed `business=PASS`、`cleanup=PASS_PRESERVED_DEV_STATE`。

## 6. 验证分层与未授权项

已通过：

- `yarn workspace @catering-v2s/operations-admin typecheck`；
- `yarn workspace @catering-v2s/operations-admin lint:architecture`；
- `yarn workspace @catering-v2s/operations-admin test:architecture`：47 tests，43 pass、4 todo、0 fail；
- `yarn workspace @catering-v2s/operations-admin test:unit`：46 files，271 tests；
- `yarn workspace @catering-v2s/operations-admin build`；
- `yarn format:check`；
- `./gradlew --no-daemon :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava`；
- `node --test scripts/dev/owner-command-seed-executor.test.mjs`：23/23；
- `node --check scripts/dev/owner-command-seed-executor.mjs`；
- 受管 backend acceptance：见 §5.2；
- 受管 reset/DEV/完整 seed：见 §5.1。

`./scripts/verify` 已执行：OpenAPI 与 code-layout 检查通过，但全仓 backend Spotless line-limit 检查触发既有基线违规，未把该全仓结果改写为本批功能 PASS，也未对无关基线做批量格式化。该项单列为 `BASELINE_CHECK_NOT_CLOSED`，不改变上述已关闭的 feature focused/runtime 结果。

曾直接尝试运行单个 Gradle 测试以复核扩展审计 helper，但仓库 guard 在 Docker 发现前拒绝了本机执行：`V2S_TESTCONTAINERS_REMOTE_REQUIRED`。该失败属于受管运行入口违规，不是代码测试失败；按失败 recall 已保留首败并改用允许的远端 backend acceptance/编译路径，未把它升级为 PASS。

本次 post-repair 受管 backend acceptance 是 `storeQrConfigurationLifecycle` 的 focused run，不是 V-1–V-16 的全量动态套件；其余场景的代码落点、oracle 与映射已逐项对账，但不把未运行场景写成动态 PASS。

Browser L2、UAT、部署均为 `NOT_AUTHORIZED/NOT_RUN`。进入 L2 所需的 IA 逐控件位置/样式/行为静态前置比对已 PASS，但没有把它升级成浏览器动态验收。

## 7. 当前字节交付结论

本轮 Claude 转达的当前字节 review 为 `NO-GO/M/S/N=2/3/2`。其中 M-02（服务点列表 N+1）、S-01（整数 offset 伪游标）、N-01（QR 未读状态混淆）与 N-02（未引用默认值）已按根因修复；S-02 仅为结构/维护性意见，不属于本次要求的代码逻辑修复；Carson 先前针对 disabled QR 保留渠道的 Major 已由后续 Flyway 迁移反证为 `REJECTED_WITH_EVIDENCE`。

本轮新增的 fresh 只读 reviewer Mendel 基于最新字节给出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO`、`M/S/N=0/0/0`，确认 keyset 分页、批量 QR 读取、前端 QR 读取状态依赖和最终迁移约束无新的代码逻辑回归。该 GO 只覆盖静态代码逻辑，不替 Dexter 决定以下两项未决产品/范围问题：

- M-01：TABLE 的容纳人数、形态、是否可预约究竟是必填还是可选；当前 owner/数据库要求必填，而前端创建表单未完整表达该要求。
- S-03：二维码交付物保持现有「查看二维码」入口链接，还是把二维码图像生成纳入范围；当前实现沿用已有入口链接，不新增图像生成能力。

因此 `P9_逐代码与详设对账=OPEN`，原因是这两项会改变设计与实现契约，不能以静态 reviewer 的 GO 或历史运行证据代替产品/范围裁决。Browser L2、UAT、部署仍为 `NOT_AUTHORIZED/NOT_RUN`。
