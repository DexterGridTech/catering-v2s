# 门店桌台与二维码管理实施计划

```text
DATE=2026-09-17
DOC_KIND=IMPLEMENTATION_PLAN
STATUS=IMPLEMENTATION_COMPLETE_REVIEWED
DESIGN=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md
JOURNEY=doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md
IA=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md
INTERACTION=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md
AUTHORIZED=Dexter 本轮直接授权按本计划进入实施，并在实施完成后执行受管 reset、DEV、seed
NOT_AUTHORIZED=Browser L2、UAT、部署、Git
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=MANAGED_RESET_DEV_SEED_ONLY
```

本计划按 Dexter 本轮直接授权进入执行；代码、契约、迁移、构建、测试和受管 reset/DEV/seed 均按 P0–P9 顺序执行。Browser L2、UAT、部署和 Git 不在本批授权内。

## 1. 真实用户任务与实施原则

运营管理后台用户要在当前选定门店内维护区域、桌台和扫码点，并在同一页面配置门店二维码下单；运维管理后台用户要在集团空间级定义服务点的纯展示扩展字段。桌台属性本批只保存不消费，容纳人数、形态、是否可预约均非必填；二维码 URL 不存储，由渠道模板规则在读取时派生，合法 URL 在列表/详情结果位置生成二维码图像。

实施保持以下已确认形态：

- 区域列表头部“新建区域”；选中桌台区后从属列表头部“新建桌台”，选中扫码区后“新建扫码点”；未选区域不显示从属新增动作。
- 区域和从属列表采用 `SalesMenuPage` 的 master/detail、选中态、行末“…”菜单、上移/下移；顺序不进入任何 Drawer 表单。
- 主页面二维码配置是只读摘要；编辑只能进入独立 Drawer；详情 Drawer 是只读展示；所有编辑 Drawer 统一使用 `useDrawerFormLifecycle`，子控件不自行管理 dirty 或提示“请先保存”。
- 桌台容纳人数、形态、是否可预约都不是必填项；owner 接受桌台属性的空值，若填写则按正整数/形态闭集/布尔值校验；扫码点仍不接受这些字段。
- 合法派生 URL 使用现有 Ant Design `QRCode` 在列表与详情结果位置直接生成并展示内存图像；不新增二维码图片资产、URL 持久化、下载或批量导出链路。
- `SERVICE_POINT` 加入 extension 管理 host 但不加入 `FLAT_VALUES`；本批不做动态列和类型化搜索。
- candidate 层按四个模板维度和 channel/template 两个 ENABLED 状态过滤；D-10/D-12 生成层只判断最终 URL 合规，不把状态变化变成第四种不出码原因。

## 2. 执行纪律与统一前置

### 2.1 每个步骤开始前

进入每个 P 之前，主 agent 重新执行该步骤 RECALL：需求正本、Journey、IA/交互、详设对应章节、六维 memory 命中原文、owning source、适用编码规范和当前生成/测试入口。任何字段事实为空、源码与设计前提不符、或两个不变量冲突，先停止在该步骤并报告原文事实、候选理解、倾向方案与原因。

主 agent 是唯一代码、测试、契约、脚本、seed 和文档写入者；独立子 agent 只能在规定时点做只读三维对账或 review，不能写文件。Git 由 Dexter 控制，本计划不要求任何 Git 动作。

### 2.2 每个步骤结束后

主 agent 先用同一组需求/详设/IA/memory/source 原文做 focused proof 和前后双读；然后在开始下一步骤前由 fresh 独立子 agent 做三维证伪式对账。三维是：

1. 需求正本的业务目标、裁决、范围和不做边界；
2. 详设、IA、交互的行为、形态、动作、位置、文案、状态、owner、失效/恢复和 focused proof；
3. 六维 memory 命中的设计规范、反例和共享 foundation 约束。

任一项 `OPEN` 由主 agent 修复后交新的 fresh reviewer 复查；未达到 `MATCHED` 不进入下一步骤。步骤对账不能被全链测试或最终 Claude review 替代。

### 2.3 失败族纪律

动态执行只允许用仓内受管 scripts。首次失败保留 first failure、日志、manifest/PID、last known good 和 broken boundary；同一 `failureCategory` 第二次出现时冻结该失败族后的业务推进，回到 owning source 和日志关闭该族，再继续。business 与 cleanup 分开判定，cleanup 非 PASS 不得收口。

## 3. P0：重新对账、建立本批同步分母（只读/设计）

### 目标

把当前字节的需求、IA、交互、详设、生成源、owner、前端、测试、fixture、seed 全链锁定，防止按单个文件或单个 UI 评论实施。

### RECALL 与 owning source

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md` §1–§11；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md` §2–§13；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md` §2–§12；
- implementation design §0–§14；
- `project-memory/kernel/01-workspace-and-roadmap.md` 至 `06-heritage-and-change.md`；
- `project-memory/practices/drawer-form-lifecycle.md`、`frontend-capability-lookup.md`、`backend-capability-lookup.md`、`collection-boundary-modes.md`、`ordering-only-for-consumer-facing.md`、`detail-drawer-action-menu.md`；
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java`；
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java`；
- `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/SalesMenuAssetCommandApi.java`；
- `contracts/catalog/admin-catalog.json`、`contracts/catalog/store-operating-rule-switches.json`、`contracts/openapi`。

### 动作

1. 以 `rg` 建立本批完整同步清单，至少包含详设 §9a 的 12 个事实族。
2. 搜索 `V20260917` 迁移版本冲突、当前 extension host/flat host 的所有引用、当前 gate/token 的所有引用、既有 QR/URL/asset target 的所有引用。
3. 确认不存在可直接复用的同义 service-point 或 QR operation；若发现，停止新增并按意图重用。
4. 为上一批 52 条 gate 分母（token gate=true 的 33 条 + sales-menu owner 直调的 19 条）和本域新 gate 分母保持两个独立集合；既有 token 闭集共 36 条，另有 3 条 preflight=false，不得把 sales-menu 直调重新造进 token；本域 HTTP gate 分母固定为 11（9 个 organization command + 2 个 asset stage/release），不得把本域入口并入旧数字；asset claim 仅作为 point owner 事务内步骤单独核验。

### 验收与停止

输出 `P0_SOURCE_RECALL=MATCHED` 的前提是同步清单、scope、owner、集合形态、禁止项均有路径和 counterexample；否则 `OPEN`。本步骤不运行代码，不产生运行证据。

## 4. P1：契约、目录、类型和生成源

### 范围

- `contracts/openapi/components/organization/store-service-point-qr.schemas.json`（新增）；
- `contracts/openapi/paths/operations-admin/store-service-point-qr.paths.json`（新增）；
- `contracts/openapi/components/business-channel/business-channel.schemas.json`；
- `contracts/catalog/admin-catalog.json`；
- `contracts/catalog/store-operating-rule-switches.json`；
- `contracts/extension` 或当前 extension host source（以 P0 实查路径为准）；
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`、`ExtensionDefinitionService.MANAGEMENT_HOST_TYPES`；
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`；
- `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs` 与 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`；
- `scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`、`scripts/generate/catalog-admin-p3.mjs`、`scripts/generate/store-operating-rule-catalog.mjs` 的 source consumption，不手改 generated 文件。

### 实施内容

1. 建立 area/point/QR singleton 的 request/readback/page schemas。area/point cursor page 固定 20；QR candidate 专用 response 为 bounded 100 且 `nextCursor=null`。
2. 建立 area/point/QR read/create/update/status/order operation path，全部 `x-consumer-faces=["operations-admin"]`、owner 为 organization、operations session security；写操作要求 Idempotency-Key，读操作禁止。
3. 建立 QR candidate path，owner 为 business-channel，禁止 cursor/pageSize；声明四维、双方 status、bounded overflow 和 candidate problem。
4. 在 `BusinessChannelTemplateCreateRequest` 与 `BusinessChannelTemplateUpdateRequest` 两个 template schema 同时增加 nullable `urlRule`；目标四维模板可为空或合法，非目标维度由 owner 拒绝非空，不能把创建后的二次 PATCH 当作必需步骤。
5. 在 admin catalog 新增页面 `PG-STORE-SERVICE-POINT-QR`（最终 source key 若 P0 发现冲突则使用同一能力意图的唯一 key），label “门店桌台与二维码管理”，以及 `EDIT_STORE_SERVICE_POINT_QR`；页面导航与可执行操作均归入一级目录“商品与服务”（页面使用 `NAV-CATALOG-SERVICES`、order=550；操作使用 `CATALOG_MANAGEMENT`），角色 `GROUP/REGION/PROJECT/STORE`、data node `STORE`、selected-store scope 与三个既有门店页一致。生成的 Java/TypeScript 目录不得手改，必须由 `admin-catalog.json` 经 edge-codegen 产出。
6. 将 `tableManagementEnabled` 的 label 改为“是否启用桌台和二维码管理”，key/parent/default 不变；保留 R-5.9 要求，把既有 36 条 command token 中 33 条 gate=true 的标志从布尔泛化为 `storeOperatingRuleKey`，3 条 preflight 保持 null；上一批 52 条 gate 分母中的另外 19 条 sales-menu 写入口本来就直调 gate，泛化后直接调用按键 `StoreOperatingRuleGate`，不进入 token chain；新 organization operation 也不进入该 token chain；不得增加桌台专用 token。
7. 在 error disposition/active edge catalog 登记新增业务 problem，生成后逐 path `x-error-codes` 对账；不要把错误只写在前端 feedback。

### 生成与 proof（仅授权后执行）

```text
node scripts/generate/r5-edge-materialize.mjs
node scripts/generate/edge-codegen.mjs --write
node scripts/generate/edge-codegen.mjs --check
node scripts/generate/edge-codegen.mjs --self-test
node scripts/generate/catalog-admin-p3.mjs
node scripts/generate/store-operating-rule-catalog.mjs --check
node scripts/generate/store-operating-rule-catalog.mjs --self-test
```

实际 CLI 若在 P0 发现变更，只使用当前脚本的帮助/源码明确支持的参数；不发明 `--write` 或 `--check` 的替代形式。proof 必须确认 generated Java/TS DTO、operation ID、catalog page/action、rule type 和 error enum 与 source 同步，且真实 red mutation 会被门拦住。

### 本步骤三维对账重点

- OpenAPI 的 operation、参数、成功 status、error list 与 edge/controller 计划一致；
- page/action source 与 generated catalog、page registry 计划一致；
- gate key、SERVICE_POINT host、三态/point type/URL rule 闭集没有未登记的第二份手写声明；既有 token chain 的 key 泛化与新 organization owner direct gate 的适用边界清楚；host 变更后 Java 两个声明、两个 seed executor 和 fixture 的 host set 必须一致，期望 host 数为 9、FLAT 数为 5。
- generated 文件未被主 agent 直接编辑。

## 5. P2：Flyway 数据结构与 persistence

### 范围

- 新增 `apps/backend/catering-business-server/src/main/resources/db/migration/V20260917_000000_000__store_service_point_qr.sql`（同时包含 `url_rule`、服务点图片 usage 与本批业务表），并追加 `V20260918_010000_000__allow_optional_store_service_point_table_attributes.sql`，删除初始 TABLE 三个标量非空约束并保留 SCAN 全空约束；
- organization service/persistence/sql/readback；business-channel template/channel persistence/query projection；asset typed adapter（不新增 asset target persistence）。

执行前必须搜索以上版本是否冲突；冲突不能覆盖或修改历史 migration，只能回到 P0 重新命名并同步文档。

### 实施内容

1. 创建 `organization.store_service_point_area`、`organization.store_service_point`、`organization.store_qr_configuration`。所有表保留 workspace/group/store identity、version、timestamps；area/point status 只允许 `ENABLED/DISABLED/VOIDED`。
2. point 保存 `point_type` 冗余值；TABLE 专属列和 image ref；TABLE 的 capacity/shape/reservable 可为空但非空值由 owner 校验，SCAN 约束这些列为空；extension JSONB 默认 `{}` 与 definition revision 同 point 保存。
3. area code、point code 使用同门店 `status <> 'VOIDED'` 部分唯一索引；point order 以 area 为范围，area order 以 store 为范围；查询索引支持 order+ref cursor。
4. area 与 point 的外键必须带 workspace/store 语义，不能以跨 schema read edge 推导写权限；所有当前行保留，不物理删除。
5. QR singleton 为一店一行，`enabled=false`、`channel_ref=null` 默认；既有 store 做默认插入，新建 store 在 organization owner 同一事务插入。
6. template URL rule nullable additive；不为既有模板虚构 URL 值。
7. asset usage closed set 增加 `STORE_SERVICE_POINT_IMAGE`；organization point 的 `image_asset_ref` 是唯一业务关联，不创建 asset target 或其他资产表。

### 最低 proof

- migration 静态/数据库验证：表、check、FK、索引、partial unique、默认值；
- persistence focused test：workspace/store 隔离、cursor 顺序、VOIDED code reuse、active order、SCAN nullability；
- business-channel focused test：template create/update projection 读回 URL rule；target empty/valid 与 non-target null 的 owner 校验；既有 BUSINESS_CHANNEL/SALES_MENU query 结果和参数语义未变化；
- asset focused test：typed target 的 workspace/store/point scope 校验、point ref readback 与 usage 不越界；不以新增 asset target 表承载关联。

## 6. P3：organization owner、扩展字段、审计与通用 gate

### 目标

将全部业务不变量放在 organization owner/共享 owner boundary，而不是 controller 或前端。

### 实施内容

1. 新增或扩展 `StoreServicePointOwnerApi`，提供 area/point page、detail、create/update/status/order、QR config read/save；所有 command 重新解析 store scope、重读目标和 version、返回 readback。
2. area type 的直接 owner 命令锁 area 与 child read；只统计 `status <> 'VOIDED'` point；非空拒绝，全部 voided 才允许；运营管理后台编辑态只读展示 area type，不提供修改控件；不要增加未被需求要求的一键清空 operation，逐 point VOIDED 即为“清空”。
3. area/point status 使用 organization 现有三态 transition 形态；VOIDED 保留原 type、extension、image；current collection 排除 VOIDED 历史 point；area 非 ENABLED 只在 projection 计算 descendants unavailable，不回写 point。
4. point create/update 读取 area type，owner 强制 `TABLE_AREA↔TABLE`、`SCAN_AREA↔SCAN`；TABLE 才接受 capacity/shape/reservable/image，前三项均可省略，填写时按类型规则校验；SCAN 请求带这些字段或 image 时拒绝，不依赖前端。
5. 扩展 `BusinessEntityValueSupport` 的共享 extension audit projection，使新 point 使用同一 `ExtensionDefinitionLookup`、`ExtensionSubmission`、四态、label snapshot、超长截断，不复制第二套 typed validator。若抽取成新 helper，必须保留四个既有 organization entity 的调用路径并做回归。
6. `OrganizationAuditHistoryService` 增加 service point fixed labels/target；未知历史 field key 保留存储的 label snapshot，不因定义删除使历史审计行消失；核心、extension、image ref、status 变更与 point write 同一 transaction。
7. 在 `StoreOperatingRuleGate` 增加窄的 `requireStoreOperatingRuleForStoreTarget(workspaceUuid, groupWorkspaceKey, targetType, storeId, ruleKey)`；既有 `requireCatalogManagementForStoreTarget` 保留并委托 `catalogManagementEnabled`，以保持既有异常/错误语义。新 organization owner 在 mutation 前直接调用该 keyed gate，使用 catalog 中的 `tableManagementEnabled`，不经过 `CommandExecutionContextResolver`，也不伪造 organization command token。与此同时按 R-5.9 将既有 36 条 command token 中 33 条 gate=true 的 `storeOperatingRuleGateRequired` 泛化为 `storeOperatingRuleKey`，3 条 preflight 为 null；sales-menu 的 19 条写入口不在 token 链，直接调用 keyed gate 并传 `catalogManagementEnabled`；两条链共享规则 catalog，但不混用分母。
8. QR config save：关闭允许 null；开启必须调用 business-channel `requireQrChannel` 重验 store relation、四维和双方 ENABLED；已有后来失效的 channelRef 不由 read/save normalization 悄悄清空；不满足重新校验时拒绝并保留旧值。

### 事务与失败

point core + extension JSON + image claim/target/ref + audit + receipt 是一个 organization REQUIRED 原子组；stage 在对象 I/O 边界，owner save 失败释放 staged asset。QR config 与 template URL rule 是两个 owner 原子组，不伪装为一个跨域事务。

### proof

- unit/focused：两类合法 type 成功、两类反向组合拒绝；active/voided code；状态/区域 type matrix；extension four-state；gate key 逐 operation；
- owner contract：PROJECT/STORE 两种 assignment 读取同一 selected store；disabled area descendants；QR stale selected channel 保存边界；
- audit regression：既有四类实体生产者/读者、历史分页、固定标签和授权不回归。

## 7. P4：business-channel URL rule、QR candidate 与 generation owner

### 实施内容

1. 给 `BusinessChannelTemplatePersistence.TemplateProjection`、`TemplateCommandProjection`、`BusinessChannelPersistence.ChannelProjection` 传递 `urlRule`；template create/update 审核目标四维。
2. 新增 `BusinessChannelOwnerApi.listQrChannelCandidates`，SQL 只筛：当前 store channel relation、template access=INTERNAL、operator=STORE、order=DINE_IN、dineInForm=QR、channel status=ENABLED、template status=ENABLED；内部 binding `NOT_REQUIRED` 不过滤；不读取 `statusDimensions/blockers` 做候选 gate，不按 URL rule 过滤。
3. QR candidate bounded limit 固定 100；SQL 取 101，超限返回 `PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION`，不静默截断、不引入 cursor。
4. `requireQrChannel` 在 QR config save 时锁/读目标，重做 store relation、四维和双方 status 检查；不要改既有 `requireSalesMenuChannel` 与 `BUSINESS_CHANNEL/SALES_MENU` operation。
5. 实现唯一 `deriveQrServicePointUrl`/`QrServicePointUrlComposer`：读取已选 channel/template 的当前 URL rule，不按 status 过滤；把 `groupWorkspaceKey`、`servicePointRef` 作为固定参数，在 fragment 前 canonical 追加；同名参数先移除再追加；值标准百分号编码。空/非法 URL 返回 invalid result，不抛到 candidate/config save。
6. 复用同一 composer 做 legality check 和 URL construction；前端不实现 URL parser；D-10/D-12 的 generation projection 只看最终 URL 是否合规。

### proof

- candidate focused：四个单维度 mismatch、双方四状态、internal NOT_REQUIRED、URL empty/invalid 均按设计；
- URL focused：无 query、已有 query、fragment、`?`/`&` 尾、同名参数、percent encoding 和空/非法两类；
- behavior：修改 URL rule 后既有 point readback 的 QR 派生结果改变，point 表没有 URL；selected channel 变 DISABLED/VOIDED 时最终 URL 合规仍生成；
-既有用途回归：BUSINESS_CHANNEL 固定 bounded read、SALES_MENU cursor/20 条语义完全不变。

## 8. P5：asset typed adapter 与图片生命周期

### 实施内容

1. 复用 `PlatformAssetService` 的 stage/content/claim/release core，新增 `StoreServicePointAssetCommandApi` 和 `StoreServicePointAssetTarget` typed boundary；usage 为 `STORE_SERVICE_POINT_IMAGE`，target 只存在于 command 内存边界，不新增 asset target persistence。
2. 复用 `OperationsOwnerScopeGrant`、bind grant、version、idempotency 和 target identity；组织 owner 不直接写 platform_asset 表，point 的 `image_asset_ref` 是唯一业务关联。
3. stage 端点返回 opaque asset ref/bind grant；point save transaction 先锁定并校验 point，再以 typed target claim asset、写 `image_asset_ref`；取消/失败 release staged asset。
4. TABLE 前端只允许一张图片；SCAN 没有 image field、file input、asset stage/release/claim 或 request property；不得用 disabled image component 代替“不适用”。
5. status/area disable/void 不清除存储 image ref；replace 使用 asset owner 的既有 prior-target 释放/保留语义，并对历史 detail/audit 进行 readback 验证。

### proof

- asset focused：成功上传→claim→readback；保存失败→release→无 orphan；重复 idempotency；workspace/store/point 错配拒绝；
- organization focused：point write rollback 不产生半写；
- frontend static：TABLE 有真实 file input/testId，SCAN 没有 image node，详情显示真实 asset preview 而非表单。

## 9. P6：operations edge、catalog wiring 与 operations-admin/platform-admin UI

### 9.1 edge 与 generated binding

实现 `contracts/openapi/paths/operations-admin/store-service-point-qr.paths.json` 的 controller/operation binding；每条 path 使用 generated request/response/problem types，不手写 DTO。所有 path 只暴露 `operations-admin`，使用 `storeRef` path identity；controller 不从 session 猜门店，不从 list row 或 draft 推导。

写入口完整全集（本域独立 gate 分母）固定为 11 个 HTTP command entry：organization 的 `postOperationsStoreServicePointArea`、`patchOperationsStoreServicePointArea`、`postOperationsStoreServicePointAreaStatus`、`postOperationsStoreServicePointAreaOrder`、`postOperationsStoreServicePoint`、`patchOperationsStoreServicePoint`、`postOperationsStoreServicePointStatus`、`postOperationsStoreServicePointOrder`、`patchOperationsStoreQrConfiguration`，以及 asset 的 `stageStoreServicePointImage`、`releaseStagedStoreServicePointImage`。`claimStoreServicePointImage` 没有独立 HTTP path，只作为 point owner REQUIRED 事务内步骤，在 point create/update 的成功、失败和孤儿资产 proof 中单独观察，不计入 HTTP 分母；template URL rule 不计入本域 gate。

### 9.2 operations-admin

新增 `apps/frontend/operations-admin/src/features/store-service-point/`，建议文件：

- `ui/StoreServicePointPage.tsx`；
- `ui/AreaDrawer.tsx`；
- `ui/ServicePointDrawer.tsx`；
- `ui/QrConfigurationDrawer.tsx`；
- `ui/ServicePointDetailDrawer.tsx`；
- `model/useStoreServicePointReadModel.ts`、`commands.ts`；
- `storeServicePointTestIds.ts`；
- status/type/QR label dictionaries。

接入 `pageRegistry.tsx`、`OperationsApp.tsx` icon map、generated admin catalog 和 operations transport。页面 gate 复用 `useStoreOperatingRuleGate` 的 identity/lifecycle，读取 `tableManagementEnabled`；后端组织 owner 也必须用同一 key 做 direct gate。主页面并行读 area collection 与 QR singleton；只有选中 area 后才读 point collection；读取失败清空对应 dataSource 并保留 retry。

必须复用：

- `adminListState`、`CursorPagination`、SalesMenuPage 的 section/item list pattern；
- `useDetailDrawer`、`AdminDetailActionMenu`、`adminDetailDescriptionsProps`；
- `adminDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useOverlayLock`；
- `createRefreshSignal/useRefreshVersion`；
- `AdminImageCollectionEditor(maxImageCount=1)`、`AssetPreview`；
- extension field renderer/formatter。

禁止：新建 parallel dirty guard、disabled Form 详情、拖拽排序、服务点技术术语下沉到 UI、扫码点图片入口、二维码主页面第二个详情 surface、本地镜像 server facts。

### 9.3 platform-admin

只扩展既有 extension definition management host/dictionary/generated enum，使 `SERVICE_POINT` 可在集团空间级定义；实施后管理 host 闭集为 9，flat host 仍为 5，`SERVICE_POINT` 的 `listDisplay/searchable` 明确为 `null`；不新建平行定义页、不进入 flat host、不接动态列/类型搜索。

### 9.4 UI/testId 前置门

在任何 L2 脚本、locator、binding、blueprint action 写入前，先按详设 §3a 逐个 IA-ID 对照全部真实控件：控件必须位于 IA 指定的 surface/container，位置与层级正确，样式与 SalesMenu 基线一致，行为符合 IA 声明的选中、排序、边界禁用、失败恢复；创建与编辑 Drawer 尤其要逐控件核验。任何一项不一致都先修复，不得以 testId 存在替代视觉/行为通过。确认后再逐项补齐区域操作、point 操作、QR Drawer、area/point Drawer、TABLE file input、detail action、retry、cursor；每个真实动作节点必须使用 `storeServicePointTestIds.ts` 的稳定业务身份；复合 Select option 只能在 API 无 option-level data 属性时按既有 `COMPOSITE_OPTION_ANCHOR` 例外记录。

本步骤状态：`UI_DESIGN_REVIEW=PASS`、`IA_CONTROL_REVIEW=PASS_STATIC_PREFLIGHT`、`TESTID_REVIEW=PASS_STATIC_BINDING`（逐控件记录见 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-ia-static-preflight-codex.md`）、`L2_SCRIPT_ADMISSION=BLOCKED`。静态前置门已按真实控件完成位置/样式/行为对照；只有在 Dexter 另行授权 Browser L2 后，才能继续动态浏览器验证，当前授权仍不包含 L2。

## 10. P7：focused/unit/static 与 backend acceptance

### 10.1 场景落点

新增场景只能落入 owning group：

- `OrganizationAcceptanceScenarios.java`：area/point/QR/gate/roles/extension integration；
- `BusinessChannelAcceptanceScenarios.java`：template URL rule、QR candidate、bounded overflow、URL owner composer；
- `AssetAcceptanceScenarios.java`：stage/release/claim/target/no orphan；
- `ExtensionAcceptanceScenarios.java`：SERVICE_POINT definition host/definition revision；
- `AuditAcceptanceScenarios.java`：四态、label snapshot、历史读出和既有回归。

每条 HTTP 场景必须写非空 `identity`、`fixture`、`request`、`businessOracle`。本批新增或语义发生变化的 HTTP operation 分母为 20：organization 13 个、business-channel candidate 1 个、template create/update 2 个、platform extension 既有读写 2 个、asset stage/release 2 个；精确 `operationId → scenario id` 矩阵见详设 §11.1，P7 必须逐项验收，不得只按能力名抽样。oracle 必须验证真实字段和副作用：store/area/point/channel identity、类型/状态/order、extension JSON/revision、image target/ref、QR config/version、派生 URL、审计行、权限隔离、无写入/幂等；不能只验证 HTTP status、`response.ok` 或 no-exception。

P7 的交付前机械核对必须重建详设 §11.1 的 20 行矩阵：每个新增/修改 HTTP `operationId` 恰好出现在矩阵中并绑定已注册 scenario；`requireQrChannel`、`deriveQrServicePointUrl`、`claimStoreServicePointImage` 作为内部 owner/事务方法不算 HTTP 行，但必须在对应 scenario 的 `businessOracle` 中显式观察。

### 10.2 最小 focused 顺序

先执行静态/编译/owner focused，再按单 operation 的真实 HTTP：

```text
scripts/test/backend-acceptance --operation storeServicePointTypeCompatibility
scripts/test/backend-acceptance --operation storeQrChannelCandidatePredicate
scripts/test/backend-acceptance --operation storeQrUrlDerivation
scripts/test/backend-acceptance --operation storeServicePointTableAssetLifecycle
scripts/test/backend-acceptance --operation storeServicePointGateAndRoles
```

每个 operation 的实际 scenario ID 以 `BackendAcceptanceScenarioCatalog` 当前注册为准，不把上述示例字符串直接写进 runtime，除非实现时 source 采用同一稳定能力名。全部 focused 通过后才允许：

```text
scripts/test/backend-acceptance --all
scripts/verify
```

`CONTRACT`、`BUSINESS`、`DB_OPERATIONS` 和 cleanup 分开记录；不得把旧的 performance/baseline/compliance-control 台账重新引入。

### 10.3 V-1 至 V-16 覆盖矩阵

| 验收判据 | 实现/测试落点 | 必须的正反例 |
| --- | --- | --- |
| V-1 | gate hook + page static/HTTP | off 不发 lists；on 有固定 area/point rows |
| V-2 | 本域 11 个 HTTP gate entry 的完整 mapping + each mutation acceptance | 9 个 organization command 与 2 个 asset stage/release 全拒绝；claim 作为 point owner 事务步骤单独验证；不能抽样 |
| V-3 | organization acceptance | off/on 前后 rows、QR config、内容一致 |
| V-4 | point owner acceptance | TABLE/TABLE、SCAN/SCAN 成功；两反向拒绝 |
| V-5 | area update/status acceptance + frontend focused | owner direct command active child 拒；逐 point void 后 direct command 改型成功；编辑 Drawer 的 area type 只读 |
| V-6 | SQL/schema + URL behavior | 无 URL 列；改 template rule 后 read projection 改变 |
| V-7 | composer focused | 五种合法形态、编码、empty/invalid 两反例 |
| V-8 | template owner acceptance | 四个单维度负例+完全合法正例 |
| V-9 | QR generation acceptance + frontend QR projection | off/no channel/invalid URL 三类；selected channel disabled/voided 仍生成；合法 URL 显示二维码图像，不显示普通 URL 文本 |
| V-10 | catalog/role acceptance | GROUP/REGION/PROJECT/STORE 四类逐项 |
| V-11 | extension + audit acceptance | definition/value/readback/audit 四态、label、truncate |
| V-12 | asset + frontend static | TABLE 成功/失败；SCAN 无 request/entry |
| V-13 | organization acceptance | area disabled/voided × point enabled/disabled/voided；re-enable restore |
| V-14 | area/point persistence acceptance | code reuse、history retains type/ext/image and not current list |
| V-15 | DB + owner acceptance | area and point code separate duplicate/reuse |
| V-16 | candidate/generation acceptance | four mismatch + four statuses + NOT_REQUIRED + store/tenant/brand status no filter |

## 11. P8：seed、reset/DEV 运行（已执行）

### 11.1 seed source

按详设 §10b 修改当前 R5 seed fixture/plan/executor：

- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`：stable fixture 正本增加 `SERVICE_POINT` definition；用于本功能写入的 store 必须显式给出 `catalogManagementEnabled=true` 与 `tableManagementEnabled=true`，并声明合法 `TABLE_AREA/TABLE`、`SCAN_AREA/SCAN`、QR singleton、合法 candidate、TABLE image 元数据与状态反例；
- `scripts/dev/r5-seed-plan.mjs` 与 `scripts/dev/owner-command-seed-executor.mjs`：同步 host 闭集从 8 到 9，分别核对当前 `definitions.length !== 9` guard，`FLAT` 仍为 5，`SERVICE_POINT` 的 `listDisplay/searchable` 必须为 `null`；owner-command 阶段按 definition → organization store → area → point → status transitions 通过 owner commands 写入，不在渠道存在前写 enabled QR config；
- `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` 与 executor：先建立合法 QR template/channel，internal binding 为 `NOT_REQUIRED`；该阶段完成 channel owner readback 后，在同一既有 stage 内执行 organization owner 的 QR config save post-step，不新增第五阶段；
- `scripts/dev/r5-complete-seed-executor.mjs`、`scripts/dev/r5-seed-bootstrap.mjs`：保持既有四阶段及顺序，只接阶段/报告，不把业务 fixture 写入 root bootstrap SQL；
- 对应 `*.test.mjs`：至少保留缺 candidate、mismatch、SCAN image、enabled-without-channel、gate-off、host count/host set 漂移 red mutation。

### 11.2 reset/DEV/seed 顺序

只有 Dexter 明确授予运行授权后才可执行。严格分开：

1. 受管 reset，记录破坏性范围、first failure、business/cleanup；
2. 受管 `scripts/dev/start` 或 `restart`，仅 additive Flyway，不 seed；
3. 受管 `scripts/dev/seed --profile r5-full`，严格保留既有四阶段：`owner-command`（不写 enabled QR config）→ `external-collaboration-business-channel`（channel readback 后执行 organization QR config save post-step）→ `catalog-inventory` → `sales-menu`；不得新增第五阶段，业务和 cleanup 分开；
4. owner readback 验证两级 gate、area/point/QR/extension/channel/image；
5. 如要 Browser L2，另过 testId/L2 admission，并使用隔离 namespace；不得把 DEV 当 L2/UAT。

本批已按 Dexter 授权完成上述受管 reset、DEV、seed；具体 business/cleanup 结果、owner readback、manifest 与首败根因记录见 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md`。Browser L2 仍未授权，未执行。

## 12. P9：整体三维对账、逐代码与详设对账、交付门

### 12.1 整体三维对账

P0–P8 全部完成且 focused proof 已有后、进入整体测试前，主 agent 重新对全批逐条做 requirements + design/IA/interaction + project-memory 三维对账；不是 CP 对账的汇总。重点查跨 CP 的 gate key、URL candidate/generation、asset transaction、audit representation、generated wire、seed order、页面文案和 refresh/invalidation 漂移。结果只用 `MATCHED/OPEN`，OPEN 先修后复查。

### 12.2 逐代码与详设对账（强制交付步骤）

这一步是 P9 的独立交付动作，名称必须保留为：`逐代码与详设对账`。

**范围**：逐行打开本批实际变更的所有 production code、test、contract source、generated output、migration、fixture、seed、frontend UI/model/testId、acceptance 和 feedback；不是抽样。逐条核对实现与详设 §3–§12：

- operation path/face/owner、参数/集合形态、scope、error registration、readback；
- area/point/QR schema、tri-state、type relation、code reuse、order、gate；
- channel candidate 四维/status/binding、URL rule、五种 URL 形态、D-10/D-12；
- extension host/value/revision/audit、四态/label/truncate；
- asset stage/release/claim/typed target、TABLE-only image、事务和孤儿处理；
- frontend screen/surface、动作位置、SalesMenu interaction、business wording、dirty guard、loading/empty/failed/disabled、refresh/focus、真实 testId；
- acceptance identity/fixture/request/businessOracle、V-1–V-16、seed/readback、business/cleanup 分离。

**执行者**：主 agent。**判据**：实现行为、形态、owner、事务、数据来源、用户可见文案、失败/恢复和限制与详设是同一件事；generated 文件与 source 一致；没有 OPEN。

**结果格式只能是**：

```text
逐代码与详设对账=MATCHED
```

或

```text
逐代码与详设对账=OPEN
```

任何 OPEN 都必须根因修复并重新逐代码对账；当前本批逐代码与详设对账结果为 `MATCHED`，逐项记录见 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md`。全仓 `scripts/verify` 的既有 backend Spotless 基线失败另行单列，不改写为本批功能 PASS。

### 12.3 实施后 review handoff 前置

只有下列项全部已关闭才准备 `REVIEW_TARGET=IMPLEMENTATION` 中文 brief：

- focused/static/compiler/HTTP/受管 runtime 的真实结果已按证据档位报告；
- business 与 cleanup 均 PASS；
- reset/DEV/seed 结果和 owner readback 有真实输出；
- P9 三维对账 `MATCHED`；
- `逐代码与详设对账=MATCHED`；
- 实施结果已整理为可供 Dexter/Claude 独立复审的 handoff；本 agent 不把自身收口代替独立 implementation review；
- 交付材料标明浏览器 L2/UAT 是否 `NOT_AUTHORIZED/NOT_RUN`，不升级证据档位。

## 13. 未来交付报告格式

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=GO | NO-GO
M/S/N=<数字>/<数字>/<数字>
IMPLEMENTATION_AUTHORITY=<实际授权范围>
P9_逐代码与详设对账=MATCHED | OPEN
BUSINESS=<PASS | FAIL | NOT_RUN>
CLEANUP=<PASS | FAIL | NOT_RUN>
BROWSER_L2=<PASS | FAIL | NOT_RUN | NOT_AUTHORIZED>
UAT=<PASS | FAIL | NOT_RUN | NOT_AUTHORIZED>
```

Finding 必须写明：分类、状态（`CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION`）、详设章节、实现路径/符号、用户/权限/数据/验收影响、最小根因修复和防再犯落点。静态 evidence 不升级为 runtime/Browser L2。

## 14. 当前设计交付自查

- [x] 已按已确认线框写入 implementation-facing 设计，不把线框确认扩大为代码授权。
- [x] 已写 P0–P9，P9 含显式“逐代码与详设对账”，范围、执行者、判据和 `MATCHED/OPEN` 结果形态齐全。
- [x] 已列出 owner、事务、集合形态、失败/恢复、generated chain、资产、扩展字段、审计、seed 和 acceptance 落点。
- [x] 已覆盖区域/point/QR/URL/gate/extension/asset 的同根同步面，而非只写用户点名的页面。
- [x] 已单列业务与 cleanup、reset/DEV/seed 和 Browser L2 边界；reset/DEV/seed 已执行并有受管报告，Browser L2 未授权未执行。
- [x] Claude DESIGN review：上一轮 NO-GO 的 M-01、S-01、S-02、N-01 已按当前字节处置并纳入实施。
- [x] fresh 独立 IMPLEMENTATION review：Hubble 已对 D-13 之前的字节完成 fresh 只读复审，结论为 `GO/M/S/N=0/0/0`；D-13 后需重新 review，Browser L2、UAT、部署仍为 `NOT_AUTHORIZED/NOT_RUN`。
- [x] IMPLEMENTATION_AUTHORITY：Dexter 本轮直接指派为 true；运行仅限受管 reset、DEV、seed。

## 15. 实施收口记录

本计划已按授权完成生产代码、契约/生成物、migration、测试、受管 backend acceptance、reset、DEV 与 `r5-full` seed。实施后逐代码与详设对账为 `MATCHED`，但该结果不替代独立 implementation review。

修复前 fresh 独立只读 reviewer 曾给出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=1/2/1`。四条 finding 已在当前字节完成根因修复：QR disabled 保留 channelRef 并修正数据库约束；列表/详情 QR 文案按配置状态区分；服务点扩展审计改为共享四态与 label snapshot；页面标题与 IA 术语一致。详细处置见 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md` §4.4。

当前受管收口结果：reset `R5_DEV_RESET=PASS`；最终 DEV `R5_DEV_START=PASS`；完整 seed `R5_COMPLETE_SEED=PASS` 且 business/cleanup 分别为 `PASS`/`PASS_PRESERVED_DEV_STATE`；post-repair focused backend acceptance 的 `CONTRACT` 与 `BUSINESS` 均为 `PASS`。Browser L2、UAT、部署仍为 `NOT_AUTHORIZED/NOT_RUN`，不得从本计划升级。

全仓 `./scripts/verify` 的 backend Spotless line-limit 首败属于既有基线，记录为 `BASELINE_CHECK_NOT_CLOSED`；本机直接运行 Docker-backed Gradle 测试被 `V2S_TESTCONTAINERS_REMOTE_REQUIRED` guard 拒绝，已改用受管远端入口，二者均不改写为功能测试 PASS。

Faraday 随后对 D-13 之前的源码做 fresh 静态复审，给出 `NO-GO/M/S/N=1/0/0`：不可用区域/服务点仍暴露派生二维码 URL，且有效 URL 以普通文本展示。主 agent 已确认并修复了不可用边界；2026-09-18 D-13 又授权合法结果直接复用 Ant Design `QRCode` 生成内存图像，当前以 `QRCode`/`qrResultImage` 为准，历史 `Typography.Link` 仅保留在处置记录中。

Hubble 对 D-13 之前的修复字节完成 fresh 独立静态 implementation review，结论为 `GO/M/S/N=0/0/0`；该 verdict 只覆盖当时的入口形态。D-14 后当前字节的 focused proof 与 fresh review 已完成；Browser L2、UAT、部署仍为 `NOT_AUTHORIZED/NOT_RUN`。

## 16. D-13 实施增补（2026-09-18）

Dexter 已明确桌台容纳人数、形态、是否可预约均为非必填，并授权二维码图像生成与展示。本增补对应以下实施动作：

- organization owner 与 OpenAPI create/update wire 接受三项 TABLE 标量省略或显式 `null`；非空值仍校验正整数、形态闭集和布尔值，SCAN 仍拒绝桌台属性。
- 新增 `V20260918_010000_000__allow_optional_store_service_point_table_attributes.sql`，删除初始 TABLE 非空约束，保留 capacity 正数检查并维持 SCAN 全空。
- acceptance 场景补充 TABLE 三项全部省略、显式清空、填写值，以及 SCAN 反例；前端仅对填写的容纳人数校验正整数，统一 Drawer Form 生命周期不变。
- 列表和详情共享 `qrDisplayValue`，合法最终 URL 使用 Ant Design `QRCode` 的 `type="svg"` 在内存中生成图像；列表尺寸 72、详情尺寸 176，testId 使用 `qrResultImage`。不落库、不下载、不批量导出、不新增二维码图片资产链路。

D-13 的 focused proof、受管 DEV 恢复和 fresh 独立 implementation review 已在后续实施收口中完成；D-14 目录归属修正后的当前字节以本节及实施对账中的最新 review 为准。

## 17. D-14 目录归属修正（2026-09-18）

Dexter 已确认“门店桌台与二维码管理”应归入运营后台的“商品与服务”一级目录。当前字节的目录不变量为：

- 页面 `PG-STORE-SERVICE-POINT-QR` 的 source navigation 为 `NAV-CATALOG-SERVICES`、label 为“商品与服务”、order=550，紧接“门店销售菜单”；
- 操作 `EDIT_STORE_SERVICE_POINT_QR` 的 source action group 为 `CATALOG_MANAGEMENT`、label 为“商品与服务”、order=500；
- capability key、page key、角色集合、STORE data node、selected-store scope、页面/操作绑定均不变；仅修正一级目录归属与页面顺序；
- `contracts/catalog/admin-catalog.json` 是唯一修改入口；`WorkspaceAuthorizationCatalog.java` 与 `generatedAdminCatalog.ts` 只能由 `node scripts/generate/edge-codegen.mjs --write` 生成，并以 `--check` 与 focused 编译校验同步。

角色编辑器的“可执行的操作”树和运营后台页面导航必须同时从上述生成目录读取，不能在任一 app 另行维护目录映射。
