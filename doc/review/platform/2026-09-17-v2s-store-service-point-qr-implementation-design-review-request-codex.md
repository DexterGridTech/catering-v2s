# 「门店桌台与二维码管理」实现向详设与实施计划 · Claude 独立 DESIGN review 请求

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_CYCLE_ID=2026-09-17-store-service-point-qr-implementation-facing-design
REVIEW_ROUND=1
reviewerKind=CLAUDE_INDEPENDENT_STATIC_REVIEW
DESIGN_GRANULARITY_MANIFEST=N/A_WITH_REASON：仓内规则已退役 implementation-design-granularity 控制面，本轮不创建或运行该 manifest/checker
ADVERSARIAL_REVIEW_REPORT=NOT_YET_AVAILABLE_CLAUDE_REVIEW_REQUEST
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW
CODEX_SOURCE_RECONCILIATION=COMPLETED_STATIC_ONLY
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-17
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
```

## 背景

本轮交付单元是「门店桌台与二维码管理」的实现向详设与实施计划。需求正本、Journey、IA 和交互工件已经完成收口；Dexter 已于 2026-09-17 确认低保真线框，可以继续编写实现向设计。主页面采用区域/从属列表与二维码只读摘要，二维码编辑进入独立 Drawer；区域、桌台和扫码点的顺序使用列表行操作菜单中的上移/下移，不在编辑表单指定；扫码点不提供图片上传；所有编辑 Drawer 统一使用现有 dirty guard 与 Drawer lifecycle。

Codex 已按当前仓库源码、项目 memory 和设计约束完成静态 source reconciliation，并形成详设与实施计划。当前没有写入生产代码、生成契约、迁移、构建、测试、reset、DEV、seed、UAT、部署或浏览器 L2 证据。本请求只要求对设计字节做独立静态 DESIGN 对抗复审；它不构成实施授权。

## 评审目标

请不要把详设中的自查清单、静态计数或 Codex 的 reconciliation 结论当成事实正本。请先重开需求、Journey、IA/交互、项目 memory 和 owning source，再以证伪为立场判断：

1. 实现向详设是否忠实落实已确认的用户任务、页面结构、动作、术语、状态、失败/恢复和 dirty guard；
2. operation、consumer face、owner、selected-store scope、契约、生成链和错误码闭环是否真实可实施；
3. 组织、渠道、扩展字段、资产、审计、经营规则 gate 之间的事实主权、事务、生命周期和失败边界是否自洽；
4. P0–P9、67 条需求映射、17 项机制、16 条 acceptance scenario 是否存在遗漏、假闭环或实现自由度；
5. 详设与实施计划是否有越权设计、重复造轮子或与当前源码冲突的方案。

## 需阅读文件

请从 `catering-v2s` 仓库根直接打开：

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`：需求正本、裁决、范围与 R-1 至 R-7；
- `doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md`：已确认用户 Journey、页面边界和不可替代的用户任务；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md`：已确认 IA、区域/从属列表、二维码主页面摘要和 Drawer 结构；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md`：已确认低保真交互、上移/下移、术语、dirty guard、失败/恢复与线框规则；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md`：实现向详设、owner/operation 矩阵、机制矩阵、迁移、seed、验收与 P9 对账要求；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md`：P0–P9 执行顺序、步骤级三维对账、focused proof 和动态授权边界；
- `doc/decisions/templates/implementation-design-template.md`、`doc/decisions/templates/ia-design-template.md`、`doc/decisions/templates/ui-interaction-design-template.md`：详设、IA、交互工件的仓内结构要求；
- `doc/platform/review-standard.md`、`doc/platform/claude-review-handoff-template.md`：review 证据分层、结论和交接格式；
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`project-memory/decisions/deterministic-context-only.md`：执行边界、source-first、owner、事务、共享 foundation 与动态运行边界；
- `project-memory/practices/drawer-form-lifecycle.md`、`project-memory/practices/ordering-only-for-consumer-facing.md`、`project-memory/practices/detail-drawer-action-menu.md`：统一 Drawer dirty guard、用户可见排序动作和已有详情抽屉动作菜单规范；
- `project-memory/practices/frontend-capability-lookup.md`、`project-memory/practices/backend-capability-lookup.md`、`project-memory/practices/collection-boundary-modes.md`：前后端能力复用、owner 边界和列表集合形态；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`、`apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuReadModel.ts`：区域/从属列表 master/detail、选中态、行操作菜单和上移/下移的复用基线；
- `libraries/frontend/admin-ui-foundation`：既有 Drawer lifecycle、列表上下文、surface、HTTP 和共享交互 primitive；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAuditHistoryService.java`：组织 owner、扩展字段、审计和门店 scope 的事实主权；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreOperatingRuleGate.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationTaskPathLookup.java`：既有门店经营规则 gate、selected-store scope 和角色路径；
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java`、`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelService.java`、`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTaskReadService.java`、`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`、`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelPersistence.java`、`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTaskReadPersistence.java`、`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTemplatePersistence.java`：渠道 owner、bounded read、状态维度、模板 URL rule 和写入复核；
- `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java`、`apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/CatalogAssetCommandApi.java`、`apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/SalesMenuAssetCommandApi.java`：资产 stage/release/claim 既有能力与 typed command 边界；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql`、`V20260827_010000_001__base1_business_channel_derived_facts.sql`、`V20260901_000000_000__sales_menu_owner.sql`：三态、渠道派生维度与既有资产关联的当前数据库事实；
- `contracts/catalog/admin-catalog.json`、`contracts/catalog/store-operating-rule-switches.json`、`contracts/openapi/paths/operations-admin/business-channel.paths.json`、`contracts/openapi/components/business-channel/business-channel.schemas.json`：页面/能力/经营规则和渠道契约正本；
- `scripts/generate/edge-codegen.mjs`、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/catalog-admin-p3.mjs`、`scripts/generate/store-operating-rule-catalog.mjs`：契约、目录和生成链的实际消费边界。

## 独立核验重点

请以当前字节逐项证伪，并在发现问题时给出最小修复，不要因 review 额外引入平行抽象：

1. **视觉与交互一致性**：主页面二维码只有一个只读配置摘要，编辑才打开二维码配置 Drawer，不再增加二维码详情页或二维码生成区；区域列表头部是“新建区域”，选中区域后从属列表头部按区域类型显示“新建桌台/新建扫码点”；区域和点的排序只走列表行“…”菜单中的上移/下移；排序不出现在任何表单；扫码点没有图片；所有编辑抽屉通过 `useDrawerFormLifecycle` 统一 dirty guard，子控件不得自行提示“请先保存”。
2. **operation 与 scope**：复核详设 §5.1 的所有 organization operation 是否使用真实的门店标识、selected-store scope、正确的 `operations-admin` face 和 organization owner；集团、大区、项目、门店四类角色是否都能读到当前门店事实；平台 `SERVICE_POINT` 扩展字段是否复用现有 definition operation 而不是虚构新 operation；二维码候选读取是否是独立的 bounded owner read，且不改变既有 `BUSINESS_CHANNEL`/`SALES_MENU` 语义。
3. **数据与生命周期**：区域/点/二维码配置三张事实表、三态、未作废编码复用、区域类型与 point type 冗余一致性、区域非启用时后代仅不可用不改写存储值、作废历史保留并排除当前校验；二维码一店单例、关闭可不选渠道、开启必须选渠道；不要把“服务点”技术术语泄漏到用户操作。
4. **经营规则 gate**：`tableManagementEnabled` 只换标签为“是否启用桌台和二维码管理”，key/父子/default 不变；gate 判定必须泛化复用上一批中央 token，而不是复制桌台专用实现；本域写入口单独建立完整 gate 分母；gate 位于 organization owner 命令事实写入之前，前端页面 gate 不能替代后端 gate。
5. **渠道候选与 URL**：候选只按当前门店、`INTERNAL + STORE + DINE_IN + QR` 四维及渠道/模板自身 `ENABLED` 状态过滤；内部渠道 binding `NOT_REQUIRED` 不成为阻塞；不得按 URL rule 预过滤候选；保存时 owner 重新验证门店归属、四维和双方状态。URL composer 与合法性判断必须是同一住址，覆盖无 query、已有 query、fragment、`?`/`&` 尾、同名参数、百分号编码，以及空/非法 URL；D-10/D-12 必须保持：空/非法规则仍可进入候选、可选择、配置可保存，生成层只显示“暂未生成二维码”，且状态变化不新增第四种生成层不出码原因；区域/点不可用是独立的展示投影。
6. **资产与事务**：服务点图片只复用既有 asset core；检查 `STORE_SERVICE_POINT_IMAGE` usage、stage/release/claim、organization point `image_asset_ref` 和 typed target 的实际边界。详设不新增 `platform_asset.*_target` 或其他资产表；point owner 必须先锁定并校验 point/store，再在同一 REQUIRED 事务中 claim、保存关联与审计；失败不得产生孤儿资产。若当前 asset core 事实证明该最小方案不可行，请指出具体 owning source 和更小的替代，不要仅因 SalesMenu 有 target 表就复制它。
7. **扩展字段与审计**：`SERVICE_POINT` 接入定义 host 但不加入 `FLAT_VALUES`；本批不做动态列和类型化搜索；扩展值、核心字段、状态、排序、图片关联进入同一审计边界，四态表示、label snapshot、未知历史 key、超长值截断语义与既有四类实体回归不冲突。
8. **计划可执行性**：逐项核对 17 项机制、67/67 需求映射、P0–P9、16 条 acceptance scenario、seed 明确开启门店桌台和二维码管理、generated wire/error code/closure、三维步骤对账、全批对账和 P9。特别检查 V-1 至 V-16 是否有正反对照，能否阻止“永远拒绝”“永远空结果”“只实现一类角色”这类假绿。
9. **边界与权限**：检查详设是否在设计层冻结了必须冻结的事实，是否把关键行为推给实现；是否有与用户裁决、既有 owner、事务、审计、资产、foundation 或 current migration 冲突的越界机制。当前只做静态 review，动态验证全部单列为未运行/未授权。

## 期望结论

请基于当前仓库字节给出明确结论：

- `REVIEW_TARGET=DESIGN`；
- `VERDICT=GO` 或 `VERDICT=NO-GO`；
- `M/S/N` 三档 finding 数量；
- 每条 finding 标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE`，并说明是仓内事实、推论、产品判断还是尚缺证据的假设；
- 每条 finding 给出仓库根相对路径、精确行号/符号、对用户/权限/数据/验收的影响、最小修复及“为什么不能更小”；涉及产品、Journey、权限或页面操作的事项请明确是否需要 Dexter 裁决；
- 静态、focused、backend acceptance、reset/seed、DEV、Browser L2、UAT、cleanup evidence 分开报告。没有实际运行的项目必须写 `NOT_RUN` 或 `NOT_AUTHORIZED`，不得把设计或历史 evidence 升级为动态 PASS；
- 详设中找不到判据的问题请列为 `DESIGN_GAP`，不要把未授权运行缺失直接记成代码缺陷。

本轮不授权生产代码、契约生成物、migration、构建、测试、backend acceptance、reset、DEV、seed、Browser L2、UAT、部署或 Git。即使结论为 `GO`，也只表示实现向详设与实施计划通过本轮静态 DESIGN review；后续实施仍需 Dexter 明确授权并按计划执行。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对「门店桌台与二维码管理」的实现向详设与实施计划做一轮独立静态 DESIGN 对抗评审。REVIEW_TARGET=DESIGN，评审对象是实现向设计文档，不是生产实现；请以证伪为立场，不要把作者自查或本交接材料中的结论当作已验证事实。

背景：本批在运营管理后台建设区域、桌台、扫码点和门店二维码配置；平台侧新增 SERVICE_POINT 扩展字段宿主。需求正本、Journey、IA 与交互工件已经收口，Dexter 已于 2026-09-17 确认低保真线框。已确认的交互是：区域列表头部“新建区域”；选中区域后从属列表头部按类型显示“新建桌台/新建扫码点”；区域和点的顺序只通过列表行“…”菜单上移/下移；排序不在表单；二维码配置在主页面只读摘要上展示，编辑进入独立 Drawer；没有二维码详情页或生成区；扫码点没有图片；所有编辑 Drawer 统一由 useDrawerFormLifecycle 管理 dirty，子控件不得自行提示“请先保存”。Codex 已完成实现向详设与实施计划，并只做了当前源码的静态核对，没有实施或运行。

目标：请独立判断详设与计划是否能在不改变既有 owner、权限、状态、事务、审计、资产和共享前端 foundation 语义的前提下完整实现需求；重点找出会导致错误候选、越权写入、历史数据破坏、用户操作偏移、假绿验收或详设自由发挥的缺陷。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md：需求正本；
- doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md：Journey；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md：已确认 IA 与线框结构；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md：已确认交互工件；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md：详设；
- doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md：P0–P9 实施计划；
- doc/platform/review-standard.md、doc/platform/claude-review-handoff-template.md、AGENTS.md、PLATFORM-BLUEPRINT.md、project-memory/decisions/deterministic-context-only.md：评审与工程边界；
- project-memory/practices/drawer-form-lifecycle.md、project-memory/practices/ordering-only-for-consumer-facing.md、project-memory/practices/detail-drawer-action-menu.md、project-memory/practices/frontend-capability-lookup.md、project-memory/practices/backend-capability-lookup.md、project-memory/practices/collection-boundary-modes.md：共享 UI、排序、Drawer、owner 和集合规范；
- apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx、apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuReadModel.ts、libraries/frontend/admin-ui-foundation：已有列表/Drawer/foundation 复用基线；
- apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAuditHistoryService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreOperatingRuleGate.java：组织 owner、scope、扩展字段、审计、gate；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java、apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelService.java、apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTaskReadService.java、apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java、apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelPersistence.java、apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTaskReadPersistence.java、apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTemplatePersistence.java：渠道 bounded read、状态维度、模板 URL rule 和保存复核；
- apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java、apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/CatalogAssetCommandApi.java、apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/SalesMenuAssetCommandApi.java：资产 stage/release/claim 既有能力；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql、V20260827_010000_001__base1_business_channel_derived_facts.sql、V20260901_000000_000__sales_menu_owner.sql：当前迁移事实；
- contracts/catalog/admin-catalog.json、contracts/catalog/store-operating-rule-switches.json、contracts/openapi/paths/operations-admin/business-channel.paths.json、contracts/openapi/components/business-channel/business-channel.schemas.json、scripts/generate/edge-codegen.mjs、scripts/generate/r5-edge-materialize.mjs：契约、目录与生成链。

请重点独立核验：
1. organization 全部 operation 的真实 path、face、owner、selected-store scope 及四类角色可用性；platform SERVICE_POINT definition 是否复用既有 operation；二维码候选是否为不改变既有 usage 语义的独立 bounded owner read。
2. 区域/桌台/扫码点/二维码的三态、作废保留、编码复用、冗余类型一致性、区域不可用投影、二维码单例和关闭/开启保存边界。
3. tableManagementEnabled 的 key-based gate 泛化、本域独立写入口分母和 owner-before-write；不能靠前端 gate。
4. 渠道候选四维谓词、渠道/模板自身 ENABLED、内部 binding NOT_REQUIRED、URL 不预过滤、保存重验，以及 D-10/D-12 的 generation-only URL 合规判定与 R-2.8 独立展示边界。
5. URL composer 对 query、fragment、delimiter、同名参数、百分号编码、空/非法 URL 的闭包，并确认空/非法规则仍可候选、可选、可保存，只在生成位置显示“暂未生成二维码”。
6. 图片是否真正复用既有 asset core；organization point image_asset_ref、typed target、stage/release/claim、同一 REQUIRED 事务、失败无孤儿，且没有不必要的 asset target 表。
7. SERVICE_POINT 扩展字段 host 不进入 FLAT_VALUES、不做本批动态列/类型搜索；四态审计、label snapshot、未知历史 key、超长截断与既有四类实体回归。
8. 17 项机制、67/67 R 映射、P0–P9、16 条 acceptance、seed 显式开启开关、生成闭包、逐步骤三维对账和 P9 是否可执行；特别攻击“永远拒绝”“永远空结果”“只覆盖一类角色”的假实现。
9. IA/交互/详设/计划是否仍有前后冲突、实现自由度、重复造轮子或与当前源码/迁移冲突。

请给出明确 VERDICT=GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请标明状态、事实类型、仓库根相对路径与精确行号/符号、影响、最小修复及为何不能更小，并注明是否需要 Dexter 产品/Journey/权限裁决。静态、focused、backend acceptance、reset/seed、DEV、Browser L2、UAT、cleanup 分开报告；未实际运行的项目必须标记 NOT_RUN 或 NOT_AUTHORIZED。详设缺少判据的问题请标记 DESIGN_GAP。

授权边界：本次只授权对上述实现向详设与实施计划做独立静态 DESIGN review，不授权生产代码、契约生成、migration、构建、测试、backend acceptance、reset、DEV、seed、Browser L2、UAT、部署或 Git。即使 GO，也只表示设计材料通过本轮静态评审，后续实施必须另获 Dexter 明确授权。谢谢。
```
