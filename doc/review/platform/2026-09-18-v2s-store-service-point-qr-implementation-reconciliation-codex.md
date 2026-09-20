# 门店桌台与二维码管理实施逐代码与详设对账

REVIEW_TARGET=IMPLEMENTATION
RECONCILIATION_KIND=P9_CODE_TO_DESIGN
EXECUTOR=MAIN_CODEX
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED
STATUS=READY_FOR_CLAUDE_POST_REPAIR_REVIEW
P9_CODE_TO_DESIGN_STATUS=MATCHED
PRE_REPAIR_INDEPENDENT_REVIEW=NO-GO_M/S/N=1/2/1
INDEPENDENT_IMPLEMENTATION_REVIEW=FRESH_POST_REPAIR_REVIEW_GO_M/S/N=0/0/0
CLAUDE_CURRENT_BYTE_INTAKE=PENDING_POST_REPAIR_REVIEW
CURRENT_FRESH_STATIC_REVIEW=PENDING_CLAUDE_REVIEW
OPEN_PRODUCT_DECISIONS=0
BROWSER_L2=PASS_SUPPORTED_SUITES_STORE_SERVICE_POINT_PAGE_NOT_COVERED

## 1. 范围、授权与口径

本记录覆盖「门店桌台与二维码管理」从已批准需求、Journey、IA/交互、详设与实施计划到当前源码的逐代码对账。实施授权来自 Dexter 对 Claude 第 2 轮 DESIGN 复审结果的明确转交，范围包括生产代码、契约生成、migration、测试、backend acceptance、reset、DEV、seed，以及当前受管 runner 已提供的 catalog-inventory 与 sales-menu Browser L2 回归；UAT、生产部署和 Git 控制不在授权内。当前 runner 没有 store-service-point 专属 L2 suite，因此该页面的浏览器动态覆盖单列为 NOT_COVERED，不冒充为已验收。

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
| P6 | operations edge、platform-admin host、operations-admin 页面与 Drawer | `apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx`、`ui/AreaDrawer.tsx`、`ui/ServicePointDrawer.tsx`、`ui/QrConfigurationDrawer.tsx`、`ui/ServicePointDetailDrawer.tsx`、`ui/ServicePointQrDisplay.tsx`、`model/useStoreServicePointReadModel.ts`、`model/commands.ts`、`model/storeServicePointModel.ts`、`storeServicePointTestIds.ts`；既有 foundation 与 SalesMenu list pattern | MATCHED（逐文件） |
| P7 | focused/backend acceptance、V-1–V-16 场景落点与 11 个 HTTP gate entry 逐项核查 | `StoreServicePointAcceptanceScenarios.java`、`BusinessChannelAcceptanceScenarios.java`、`ExtensionAcceptanceScenarios.java`、`AssetAcceptanceScenarios.java`、`AuditAcceptanceScenarios.java`；D-13 后 focused static proof；历史受管 run 仍按 §5 分层 | MATCHED（代码/场景映射；动态证据按历史与未运行分层） |
| P8 | reset、DEV、seed、owner readback | §5.1 与 §9 的当前 reset、DEV、完整 seed reports | MATCHED（当前字节 business/cleanup 分开闭合） |
| P9 | 整体三维对账、逐代码与详设对账、交付材料 | 本文件及 `2026-09-18-v2s-store-service-point-qr-implementation-review-handoff-codex.md` | MATCHED（逐文件、逐声明项；非章节抽查） |

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

- `ui/StoreServicePointPage.tsx` 复用 SalesMenu 的 master/dependent list 组织：左侧区域 master，右侧当前区域的桌台/扫码点列表；不自动选择第一条，区域/服务点上移下移通过行尾菜单并在首末边界禁用。
- P6 当前 feature runtime 文件全集为 `ui/StoreServicePointPage.tsx`、`ui/AreaDrawer.tsx`、`ui/ServicePointDrawer.tsx`、`ui/QrConfigurationDrawer.tsx`、`ui/ServicePointDetailDrawer.tsx`、`ui/ServicePointQrDisplay.tsx`、`model/useStoreServicePointReadModel.ts`、`model/commands.ts`、`model/storeServicePointModel.ts`、`storeServicePointTestIds.ts`；静态测试另列，不能用单一页面文件代替实际模块对账。
- 区域列表头部只有「新建区域」；依据选中区域类型动态显示「新建桌台」或「新建扫码点」，业务文案不暴露“服务点”。
- 二维码摘要留在主页面；编辑通过独立 Drawer 打开，主页面不另造二维码详情页；服务点详情使用只读 Descriptions，不使用 disabled Form 冒充详情。
- 二维码列表/详情只在 `effectiveAvailable=true` 时展示由现有 Ant Design `QRCode` 生成的内存图像；不可用对象只显示「不可用」边界文案。合法 URL 使用稳定的 `qrResultImage(ref)` testId，列表尺寸 72、详情尺寸 176；不把 URL 原文作为普通字段，也不新增持久化、下载或资产生成链路。
- 区域/服务点/二维码 Drawer 使用 foundation dirty lifecycle 和统一 footer；编辑控件不自管 dirty、不单独弹“请先保存”提示。扫码点不挂载桌台属性与图片，表单不出现顺序字段。
- 逐控件 IA-ID 的位置、容器、SalesMenu 基线样式、选中/排序/边界禁用/失败恢复及创建/编辑 Drawer 已在 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-ia-static-preflight-codex.md` 中逐项标为 `MATCHED_STATIC_PREFLIGHT`。catalog-inventory 与 sales-menu 的 Browser L2 已按该前置门执行并闭合；当前 runner 没有本页面专属 suite，本页面动态覆盖不作假设。

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

### 4.5 Faraday：二维码不可用边界与原始 URL 展示（D-13 前历史）

新的 fresh 只读 reviewer Faraday 在上述四条修复之后、D-13 产品追加之前重新审查当时字节，给出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=1/0/0`。该 finding 经主 agent 重开需求 R-2.8/R-6.14、IA/交互 §4.3/§10、详设 Gate-1.9/Gate-5.4 与当时前端源码后确认成立：owner projection 必须保留 D-12 的 `qrUrl` 生成事实，但区域或服务点不可用时不得把该事实作为二维码展示给用户；同时 IA 要求二维码结果为预览/入口，不能把 URL 原文当作普通用户字段。

已完成最小根因修复：

- `StoreServicePointPage.tsx` 的 `qrDisplayValue` 增加 `effectiveAvailable` 边界；不可用时只返回「不可用」，不渲染链接、不改写后端 `qrUrl`。
- 可用且配置开启、渠道已选、最终 URL 合规时，统一渲染现有 Ant Design `Typography.Link` 的「查看二维码」入口，使用 `target="_blank"` 与 `rel="noreferrer"`；关闭、未选渠道、URL 不合规仍保持各自既有文案。
- 列表与详情均传入 owner 返回的 `effectiveAvailable`，并通过 `qrResultLink(ref)` 使用稳定对象身份 testId；新增 `StoreServicePointPage.static.test.ts` 覆盖不可用不展示、有效值走入口且不暴露原始 URL 的静态断言。

该修复没有改变二维码 URL 生成、状态独立性或持久化边界；但它发生在 D-13 之前，后续二维码图像范围以 §4.7 的当前追加为准。修复后的当时 fresh implementation review 由 Hubble 完成，结果见 §4.6。

### 4.6 Hubble：D-13 前的 fresh 独立复审

Hubble 作为新的 fresh、只读、非作者 reviewer，在 D-13 追加之前基于当时字节完成 `REVIEW_TARGET=IMPLEMENTATION` 静态代码逻辑复审，结论为 `VERDICT=GO`、`M/S/N=0/0/0`。该结论不覆盖 D-13 的 optional table attributes 与 QRCode image changes；其独立核验确认：

- `StoreServicePointPage.tsx` 的列表与详情都先消费 owner 的 `effectiveAvailable`；不可用对象只显示「不可用」，不渲染二维码入口；可用、配置开启、渠道已选且存在派生 URL 时复用现有 `Typography.Link` 展示「查看二维码」，不把 URL 原文当普通字段。
- 后端仍保留 D-12 的派生 URL 事实和状态独立生成语义，没有新增二维码图片生成、下载、持久化或 QR entity 链路；`qrResultLink` testId 在列表/详情真实绑定。
- owner/scope/gate、三态/排序/候选/save recheck、D-10/D-12、`SERVICE_POINT` extension/audit、TABLE-only asset 与 seed/runtime 边界未发现新的阻断逻辑问题。

Hubble 明确将 Browser L2、UAT、部署与当时未重跑的动态项列为 `NOT_AUTHORIZED/NOT_RUN`，没有把静态结论升级为动态验收。D-13 之后已重新启动 fresh 独立只读 reviewer，当前结论仍待返回；在返回前不把 Hubble 的 `GO` 扩展为当前字节 verdict，仍保留 Browser L2 未授权边界。

### 4.7 D-13：桌台属性非必填与二维码图像展示

Dexter 已确认两个范围决策：TABLE 的容纳人数、形态、是否可预约均为非必填；授权新增二维码图像生成与展示。主 agent 已按该决策完成当前字节修改：

- `StoreServicePointService.validatePointAttributes` 与新增 `V20260918_010000_000__allow_optional_store_service_point_table_attributes.sql` 允许 TABLE 三个属性省略、提供后校验、显式清空；SCAN 仍拒绝桌台属性与图片。
- OpenAPI 当前创建/更新 schema 已保持这些字段可空可省略，acceptance 增加省略、提供、清空和 SCAN 反例。
- `StoreServicePointPage.tsx` 列表与详情复用 Ant Design `QRCode`，以 owner 派生的合法 URL 在内存中渲染 SVG 图像；列表 72、详情 176，使用 `qrResultImage(ref)`，不新增持久化、下载、导出或资产链路。
- 当前 focused static、frontend typecheck/architecture、backend `compileJava`/`compileTestJava` 已通过；D-13 之后的 backend acceptance、reset、seed 与 Browser L2 尚未运行。

D-13 修复后的 fresh 独立只读 reviewer Beauvoir 已基于当时字节完成 `REVIEW_TARGET=IMPLEMENTATION` 静态代码逻辑复审，结论为 `VERDICT=GO`、`M/S/N=0/0/0`。其确认 `reservable` 的 null/undefined 三态在表单 hydration、提交 payload 与详情展示中保持一致；QRCode 列表/详情共用 owner 派生合法 URL、`effectiveAvailable` 边界、SVG 图像、72/176 尺寸与 `qrResultImage` testId 均成立；没有发现 URL 文本暴露、二维码持久化/下载/资产链路或 dirty ownership 回归。D-14 之后的当前字节结论见下节。

### 4.8 D-14：目录归属修正

用户反馈确认“编辑门店桌台与二维码管理”不应出现在“门店管理”，页面也不应继续留在“门店经营”；两者都应归入“商品与服务”。主 agent 重开了 admin catalog source 与生成链，确认原字节同时存在两个错误归属：页面为 `NAV-STORE-OPERATIONS`/order=320，操作为 `STORE_MANAGEMENT`/order=200。已将唯一源 `contracts/catalog/admin-catalog.json` 修正为：页面 `NAV-CATALOG-SERVICES`/order=550，操作 `CATALOG_MANAGEMENT`/order=500。capability/page key、角色集合、scope、data node 与 page binding 未改。

`node scripts/generate/edge-codegen.mjs --write` 已重生成当前 Java/TypeScript 目录；随后 `--check` 通过，生成物显示页面与操作均为“商品与服务”。D-14 修改后，既有 D-13 fresh verdict 不自动扩展为当前字节 verdict；需由 fresh 只读 implementation reviewer 对当前生成源/生成物与目录消费边界复核后，才能更新本文件的当前 review 状态。

### 4.9 D-14 后 fresh 独立静态复核

Turing 作为 fresh、只读、非作者 reviewer，基于 D-14 当前字节完成窄范围 `REVIEW_TARGET=IMPLEMENTATION` 复核，结论为 `VERDICT=GO`、`M/S/N=0/0/0`。其确认 source 的 page navigation、action group、Java/TypeScript generated 与 operations/platform 两侧目录消费链一致，且 capability/page key、角色集合、STORE data node、selected-store scope 和 page binding 未漂移。该 GO 只覆盖 D-14 相关静态代码逻辑；动态渲染、Browser L2、UAT、部署与 reset/seed 未由本轮 reviewer 复核。

## 5. 受管运行记录与本轮恢复

以下 reset/seed/backend acceptance 记录保留为历史证据。它们发生在 D-13 当前字节之前，因此不能被写成 D-13 改动后的动态 PASS。本轮没有执行 reset 或 seed；机器重启后仅按受管流程恢复 DEV 与 HTTP/asset 隧道。

### 5.1 reset、DEV、seed

- reset：`R5_DEV_RESET=PASS`，run manifest：`.runtime/r5/reset/r5-reset-b7a7f262-901e-44ca-ae45-11d47a7ee6e7/run-manifest.json`；`cleanup=PASS_NO_PERSISTENT_RESET_PROCESS`。
- 最终 DEV：`runId=r5-dev-1789677991497-54436-6c84a838-ad09-44f3-9fa4-5fc06a1c3b54`；根 manifest：`.runtime/r5/run-manifest.json`。拓扑为远端 trusted Java + 远端 localhost PostgreSQL + HTTP/asset-only tunnel + 本机两个 Vite；readiness marker 为 `REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`，平台 5174、运营 5175 由受管 runner 启动。当前 DEV 未执行 seed 以外的额外手工命令。
- 机器重启后的首次 `scripts/dev/restart` 保留为 runner 首败：stop 的 cleanup 已 PASS，但 start 阶段因 `.runtime/r5/run-manifest.json` 在 stop 后被删除而报 `ENOENT`；未将该失败改写为 restart PASS。随后在无 active manifest、旧进程已由受管 stop 清理完成的前提下，直接执行受管 `scripts/dev/start` 成功恢复当前 DEV：`runId=r5-dev-1789701655100-51276-c0ca84d3-7108-4d02-a4a5-6303d6aee47d`，远端 Java readiness=`REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`，远端应用已应用 `20260918.010000.000` migration，5174/5175、28080/29000 均由当前 manifest 管理；本机页面与资产 readiness 已分别返回 200。当前 DEV 保持运行，未执行 seed。
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

本节旧的 M-01/S-03 产品范围项已由 Dexter 当前决策收口：TABLE 三个属性均非必填，并授权二维码图像生成与展示。它们不再是 OPEN_PRODUCT_DECISIONS。D-13 代码变更、focused proof、当前字节逐代码/详设对账及 fresh 独立静态 review 均已闭合，`P9_逐代码与详设对账=MATCHED`。

当前 implementation static verdict 为 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO`、`M/S/N=0/0/0`，仅覆盖当前源码/契约/测试源的静态逻辑。当前受管 DEV 已恢复并可体验，但 D-13 之后 backend acceptance、reset、seed 与 Browser L2 未运行；Browser L2、UAT、部署仍为 `NOT_AUTHORIZED/NOT_RUN`，不将 DEV readiness 扩展为业务验收。

## 8. D-15：门店桌台与二维码页面体验问题的根因修复

### 8.1 根因与修复范围

- 排序操作导致整页进入 loading 的根因不是浏览器导航或页面 remount，而是生成器对该页面 15 个 service-point 查询/命令入口统一使用全局 `wire/LIST` 失效标签；mutation 后 operating-rule gate 误判为重新读取中，页面因此替换主体内容。修复在 `contracts/policy/store-service-point-rtk-tag-policy.json` 建立资源级 wire tag 正本，由 `scripts/generate/edge-codegen.mjs` 消费并生成 `operations-edge.rtk.ts`。区域、服务点、二维码配置和图片暂存/释放均按资源范围失效，不再触发全局 `wire/LIST`；页面原有 owner readback 保留，读回失败仍明确反馈。
- 菜单短文案在 `contracts/catalog/admin-catalog.json` 的唯一源中改为「门店桌台与二维码」，并通过 edge codegen 回写生成目录；未手改生成物，也未改变 page key、operation key、权限或门店作用域。
- 服务点新建/编辑 Drawer 使用现有 `adminWideDrawerSurfaceProps` foundation surface，宽度与销售菜单复杂编辑抽屉基线一致；没有修改共享 foundation，也没有由子控件新增 dirty/关闭守卫。
- operations-admin 运行时文案中的「扩展字段」「自定义字段」「补充资料」已统一替换为业务侧可理解的「字段配置」「字段筛选」等表达；平台-admin 的扩展字段配置页保留技术术语，因为该处面向字段配置管理者。

### 8.2 当前字节静态证据

- edge codegen `--write` 与 `--check`：PASS，生成文件 403 个；service-point 资源级 tag policy 与生成 RTK endpoint 一致。
- service-point focused static test：7/7 PASS，覆盖业务侧内联字段、定向 readback、无全局刷新调用、全 operations-admin 运行时术语扫描，以及关键 endpoint 不产生 `wire/LIST`。
- operations-admin typecheck：PASS；architecture lint：PASS；architecture tests：47 tests，43 pass、4 todo、0 fail；unit：46 files，277 tests；build：PASS。
- prettier/format check：PASS。
- 受管 DEV stop：`R5_DEV_STOP=PASS`，cleanup 已完成；当前字节的 start readiness 已在本节 §8.4 记录为 PASS。reset、seed 与 Browser L2 本轮均未执行，Browser L2 仍为 `NOT_AUTHORIZED/NOT_RUN`。

### 8.3 交付前 review 边界

本节只记录 D-15 当前字节的根因修复与静态证据，不把 DEV readiness 等同于业务验收。上述四类行为及同根范围已由 fresh 只读 implementation reviewer 对当前字节完成复核；其结论与最新收口见 §8.4。Git、reset、seed、UAT、部署与 Browser L2 不属于本节授权。

### 8.4 当前字节最终收口

- 按受管 DEV 生命周期恢复当前字节：先执行 `scripts/dev/stop`，结果为 `R5_DEV_STOP=PASS`，旧 run cleanup 完成；随后执行 `scripts/dev/start`，结果为 `R5_DEV_START=PASS`。当前 manifest 为 `.runtime/r5/run-manifest.json`，`runId=r5-dev-1789705824589-56549-77bbcbaa-9cec-4c42-849e-94f9bcdbad9c`。拓扑保持为远端 trusted Java、远端 localhost PostgreSQL、HTTP/asset-only tunnel、本机 platform-admin 与 operations-admin Vite；远端 readiness marker 为 `REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`。
- 当前受管页面入口读取正常：`http://127.0.0.1:5175/operations/aurora/organization/store-service-points` 返回 HTTP 200，`http://127.0.0.1:5174/platform/roles` 返回 HTTP 200。该结果只证明当前 DEV 与本机页面服务已就绪，不升级为业务验收；本轮没有使用无效的 actuator 路径推断 Java 健康状态。
- 当前字节静态验证闭合：operations-admin unit 为 46 files、277 tests、PASS；typecheck、architecture lint、architecture tests（47 tests，43 pass、4 todo、0 fail）、build、prettier/format check、`node --check scripts/generate/edge-codegen.mjs`、catalog codegen `--write/--check` 均 PASS。service-point focused static test 为 8/8 PASS，覆盖资源级失效、定向 readback、排序异常解锁、排序成功不产生 Alert、宽抽屉、业务侧字段文案和关键 endpoint 不产生全局 `wire/LIST`。
- 第三轮 fresh 只读 implementation reviewer Chandrasekhar 已基于当前字节完成复核，结论为 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO`、`M/S/N=0/0/0`。其确认排序 pending 在异常路径由 `finally` 释放、区域与服务点排序共用资源级失效策略、二维码候选读取纳入同一资源闭包、编辑抽屉宽度与所属区域上下文符合 IA、菜单源与生成物一致、operations-admin 不再向业务侧暴露“扩展字段”等技术术语。该 GO 仅覆盖静态代码逻辑，不覆盖 Browser L2 或 UAT。
- 本轮 reset、seed、UAT、部署与 Browser L2 均未执行；Browser L2 为 `NOT_AUTHORIZED/NOT_RUN`。当前 DEV 保持运行，供 Dexter 继续体验；其启动 business/readiness 为 PASS，旧 DEV stop cleanup 为 PASS，未把当前持续运行状态误报为已关闭的 cleanup。

### 8.5 D-16：排序成功提示的业务反馈边界

用户体验复核发现，区域与桌台/扫码点排序成功后仍由 page-level `feedback` 主动渲染“顺序已更新”成功 Alert。该提示不是排序业务事实，也不是失败恢复所需信息；它与销售菜单式列表的即时结果展示重复，造成不必要的常驻页面干扰。主 agent 对同根的两个排序 owner 一并修复：排序开始时清理旧 feedback，成功 readback 后不再写入 success feedback；异常仍由调用方保留“顺序更新失败，请重试”的错误提示，`finally` 解锁和定向 readback 不变。

当前 focused static test 已补充“排序源码不得出现顺序成功提示”的断言，结果为 1 file、8 tests、PASS；operations-admin typecheck 与 changed-file Prettier check 均 PASS。当前 DEV 不变、仍保持运行；本次未执行 reset、seed 或 Browser L2，后两者继续为 `NOT_RUN/NOT_AUTHORIZED`。

### 8.6 Claude 当前字节 finding 重开与 P9 根因修复

- S-01「十个 StoreServicePoint Operation 类无人引用」：`REJECTED_WITH_EVIDENCE`。当前引用链不是普通 Java import：十个类由 `contracts/registry/operation-handler-bindings.json` 登记，经 `scripts/generate/backend-performance-m1-command-execution-bindings.mjs` 生成 M1 binding，并由 `OperationsStoreServicePointController` 注入并调用；生成 Java binding 位于 `apps/backend/catering-business-server/build/generated/sources/backend-performance-m1-command-execution/`。因此不删除这十个类，删除会破坏 registry/generated performance binding 闭包。
- S-02「前端仍为单文件」：`CONFIRMED_AND_FIXED`。当前 feature runtime 已拆为 P6 行列出的生产源文件，页面只保留编排与列表；页面导入并渲染四个 Drawer，当前静态测试 11/11、operations-admin typecheck 与变更文件 lint 均通过。
- N-01「`createPointDefaults` 仍未引用」：`REJECTED_WITH_EVIDENCE`。当前仓库字节不存在该符号，`storeServicePointModel.ts` 末尾为标题/标签辅助定义，无可删除残留。
- N-02「本页 L2 被既有 run 覆盖」：作为证据口径约束接受。既有 catalog/sales-menu L2 不得冒充本页 L2；本轮动态执行后按真实脚本与 run manifest 单列页面覆盖范围。
- P9 根因修复：逐代码对账必须同时比较（1）详设/计划声明的生产文件全集与当前 feature runtime 文件全集；（2）registry/生成链声明与真实 consumer；（3）每个 IA-ID 到实际组件/控件的落点。任何声明文件缺失、实际文件未列或生成链无 consumer 都保持 `OPEN`，不得以章节级“已覆盖”替代。

## 9. 当前字节 post-repair 动态验证收口

本节是当前字节的最新运行记录，覆盖并 supersede §5、§8.2、§8.4、§8.5 中“尚未运行”的历史状态描述；历史首败仍保留，不改写为 PASS。

### 9.1 静态与 focused 回归

- `yarn --cwd apps/frontend/operations-admin typecheck`：PASS。
- `yarn --cwd apps/frontend/operations-admin test:architecture`：48 tests，44 pass、4 todo、0 fail。
- `yarn --cwd apps/frontend/operations-admin test:unit`：49 files，292 tests，PASS；包含 `store-service-point` static tests。
- 本批 L2 runtime self-test、seed executor tests 与受影响检查门均已通过；静态结果不替代下述受管业务运行。

### 9.2 backend acceptance

受管全量 run：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789835011220-61858/`。

- `DISCOVERED=161`、`SELECTED=161`、`HTTP_SUCCESS=161`、`REAL_BUSINESS_ASSERTIONS=161`、`STUB_ONLY=0`、`DIRECT_FAILURES=0`。
- operation set：`EXPECTED=286`、`OBSERVED=286`、`MISSING=0`、`EXTRA=0`、`DRIFT=0`。
- performance measurement：`DISCOVERED=7948`、`SQL_OPERATIONS=96215`、`UNCLASSIFIED_SQL=0`；远端 Gradle `BUILD SUCCESSFUL`。
- `R5_REMOTE_TESTCONTAINERS=PASS`；`BUSINESS=PASS`；`RESOURCE_CLEANUP=PASS`。业务与 cleanup 分开判读，没有把 cleanup 失败隐藏在业务 PASS 后。

### 9.3 Browser L2

- `catalog-inventory`：run manifest `.runtime/browser-l2/l2-1789835475599-71400-ae68ae31-8562-43e7-9da3-1288563ee661/l2-execution-manifest.json`；`DISCOVERED=24`、`SELECTED=24`、`RESULTS=24`、`BUSINESS=PASS`、`CLEANUP=PASS`。
- `sales-menu`：最终 run manifest `.runtime/browser-l2/l2-1789837707474-22820-edefd845-b6a8-47ee-bf75-a6db366192d1/l2-execution-manifest.json`；`DISCOVERED=20`、`SELECTED=20`、`RESULTS=20`、`BUSINESS=PASS`、`CLEANUP=PASS`。`sales-menu-failure-recovery-and-focus` 已实际 PASS。
- sales-menu 曾有三次受管首败，均保留在对应 run manifest，根因分别是 action completion 前后的 network drain、失败发布后的 preview readback 边界、以及成功发布后的 menu/list readback 未纳入等待；修复均落在测试的真实动作窗口与 readback 基线，不放宽 join 判定。最终第四次 run 才收口为 PASS。
- 当前 runner 只提供上述两个既有 suite，没有 `store-service-point` 专属 Browser L2 suite；因此本页面 L2 为 `NOT_COVERED`，不能把其他页面的 PASS 扩大成门店桌台与二维码页面的浏览器验收。IA 逐控件位置/样式/行为静态前置仍为 PASS。

### 9.4 reset、DEV 与完整 seed

- reset：先按受管流程执行 `scripts/dev/stop`，随后首次无确认运行被安全拒绝：`R5_DEV_RESET=REFUSED; REASON=EXPLICIT_R5_RESET_CONFIRMATION_REQUIRED`；补充明确确认后执行成功：`R5_DEV_RESET=PASS`，run manifest `.runtime/r5/reset/r5-reset-331e95c8-5f4f-49b2-868f-5584275709aa/run-manifest.json`。
- DEV：reset 后 `scripts/dev/start` 成功，`.runtime/r5/run-manifest.json`，`runId=r5-dev-1789838160918-33420-444fbf04-ee74-4e9f-8b7a-9c2cedb5e56b`，受管远端 Java/数据库、HTTP/asset tunnel 与本机两个 Vite 拓扑保持成立；随后 `scripts/dev/check` 为 `R5_DEV_ENVIRONMENT=PASS`。
- 完整 seed：`.runtime/r5/seed/complete/complete-seed-1ca6e610-f551-4e9d-9062-d4f91101f58a/seed-report.json`；`business=PASS`、`cleanup=PASS_PRESERVED_DEV_STATE`、`firstFailure=null`。owner-command、external-collaboration-business-channel、catalog-inventory、sales-menu 四个组件均 PASS。
- owner-command 使用的 fixture 正本为 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`，SHA-256 为 `09157a2d5bb9651f985d09e172fec2fd98ce52622e96b6c01504a97adac6b145`；当前报告的 service-point host/readback API 包含 extension definition/value、area、point、asset stage、scope selector 与 point readback。历史 owner readback 与当前 seed 代码共同证明 host 闭集为 9、`FLAT=5`、`SERVICE_POINT` flat flags 为 `null`，且 fixture/seed 明确开启门店商品库存菜单能力并做 owner readback。
- seed 的业务与 cleanup 均单列，cleanup 采用 `PRESERVE_DEV_STATE`，没有将保留 DEV 状态误报成无残留 seed 进程。

### 9.5 当前交接边界

- 当前代码、静态回归、受管 backend acceptance、支持的 Browser L2 suites、reset、DEV 与完整 seed 均已完成；本文件与交接 brief 已更新为等待 Claude 的新的 `REVIEW_TARGET=IMPLEMENTATION` 静态复审。
- Claude 需要重新打开当前源码、详设/计划、P9 对账与真实 manifest。此前 `NO-GO`、Beauvoir/Turing/Chandrasekhar 的窄范围静态结论均是历史输入，不替代当前 Claude review。
- `store-service-point` 专属 Browser L2、UAT、生产部署均不应被本节虚构为已运行；其中前者是当前 runner 的 `NOT_COVERED`，后两者是 `NOT_AUTHORIZED/NOT_RUN`。
