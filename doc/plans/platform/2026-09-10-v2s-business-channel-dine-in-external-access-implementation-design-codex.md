---
SKILL_USED=cs-spec-to-plan; cs-writing-plans
title: v2s 到店点餐允许外部接入 implementation-facing 详设
status: PROPOSED_FOR_DESIGN_REVIEW
createdAt: 2026-09-10
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
journeyRefs:
  - doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md
interactionRef: doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md
iaRef: doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md
implementationAuthority: false
reviewTarget: DESIGN
reviewCycleId: BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
---

# 到店点餐允许外部接入 · implementation-facing 详设

## 0. 目标、授权和方案取舍

### 0.1 真实业务目标

本批要让门店自己的小程序等外部系统能够承载门店到店消费经营渠道。例如瑞幸门店自己的小程序相对于购物中心是外部系统。它不是本平台内部 POS、扫码或自助机，因此外部 `DINE_IN` 不应携带 `dineInForm`，也不应由本平台销售菜单 owner 建菜单。

同时，销售菜单业务不变：只有 `STORE + INTERNAL + DINE_IN/TAKEAWAY` 渠道可以进入菜单候选和菜单直接资格复核。外部 `DINE_IN` 是合法的业务渠道事实，但不是销售菜单事实。

### 0.2 已接受的 Dexter 决策

| 决策 | 本设计的固定解释 |
| --- | --- |
| D-01 | 门店自有小程序相对于购物中心是外部系统，可以承载 DINE_IN；外部 DINE_IN 不使用 POS/QR/KIOSK，`dineInForm=null` |
| D-02 | 新规则只适用于 STORE；PROJECT+EXTERNAL+DINE_IN 继续拒绝 |
| D-04 | 本批形成完整可用的 platform closure：catalog capability、provider candidate、template/channel owner、binding、UI、seed、acceptance 全闭；外部系统不建立本平台销售菜单 |

### 0.3 授权边界

```text
DESIGN_AUTHORITY=true
IMPLEMENTATION_FACING_DESIGN_AUTHORITY=true
IMPLEMENTATION_AUTHORITY=false
NOT_AUTHORIZED=production code, contract generation, migration execution, tests, seed, reset, DEV, backend acceptance, browser L2, UAT, deployment, cutover
```

本稿只定义获授权后的实现目标和验证计划；本轮不得修改生产代码、契约、迁移、测试或 seed。Roadmap 的其他授权字段不能扩大本次直接边界。

### 0.4 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：只删除 Java 的 DINE_IN=INTERNAL 分支 | owner 可能允许组合，但数据库 CHECK、provider catalog、generated closed set 和前端都会继续拒绝或展示错误候选，形成半闭包 | 拒绝 |
| B：把外部 DINE_IN 当成 INTERNAL，继续要求 POS/QR/KIOSK | 丢失外部系统身份，无法表达门店自有小程序；会把内部终端概念泄漏到外部渠道 | 拒绝 |
| C：新增 DINE_IN capability，STORE 外部组合使用 `dineInForm=null`，PROJECT 专用拒绝，菜单 edge 保持内部谓词；门店管理与菜单读取分离 | 每层都表达同一业务事实，且不增加菜单 owner 或外部菜单模型 | **采用** |

## 1. 规则与 owner 判定

### 1.1 业务规则闭集

| 规则 | owner 判定点 | 结果 |
| --- | --- | --- |
| `STORE + EXTERNAL + DINE_IN` 合法 | `BusinessChannelPolicy.validateTemplate`、模板 create/update、channel create revalidation | `dineInForm=null`；provider 必须存在、启用且 scope 含 `DINE_IN` |
| `PROJECT + EXTERNAL + DINE_IN` 非法 | `BusinessChannelPolicy.validateTemplate`；数据库 CHECK 作为最终结构保护 | `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED`，不写模板/渠道 |
| 内部 DINE_IN 仍需要内部终端形式 | `BusinessChannelPolicy.validateTemplate`、DB CHECK | `dineInForm ∈ POS/QR/KIOSK`；provider 为空 |
| 非 DINE_IN 不接受终端形式 | `BusinessChannelPolicy.validateTemplate`、DB CHECK | `dineInForm=null` |
| 外部 provider 必须精确支持订单类型 | collaboration read + `validateTemplate`/`validateTemplateProvider` + binding policy | `DINE_IN` 不得由 TAKEAWAY 替代 |
| 门店经营渠道读取包含外部 DINE_IN | operations edge `usage=BUSINESS_CHANNEL` + `pageChannels` | 读取全部 STORE 渠道事实，固定 bounded 上界 |
| 销售菜单仍只认内部门店渠道 | `listSalesMenuEligibleChannels`、`requireSalesMenuChannel` | `STORE + INTERNAL + DINE_IN/TAKEAWAY`；外部 DINE_IN fail closed |

### 1.2 组合真值表

```text
STORE / INTERNAL / DINE_IN     => form required POS|QR|KIOSK, provider null, sales-menu eligible
STORE / EXTERNAL / DINE_IN     => form null, provider capability DINE_IN, sales-menu ineligible
STORE / INTERNAL / TAKEAWAY    => form null, provider null, sales-menu eligible
STORE / EXTERNAL / TAKEAWAY    => form null, provider capability TAKEAWAY, sales-menu ineligible
STORE / EXTERNAL / GROUP_BUY   => form null, provider capability GROUP_BUY, sales-menu ineligible
PROJECT / INTERNAL / DINE_IN   => form required POS|QR|KIOSK, provider null, sales-menu ineligible
PROJECT / EXTERNAL / DINE_IN   => typed reject PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED
```

### 1.3 错误语义

- 退役 `DINE_IN_MUST_BE_INTERNAL`：它描述的全局规则已经不成立，不能留在 source error catalog、generated error enum、OpenAPI error arrays 或前端错误文案中。
- 新增 `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED`：只表示 D-02 的 PROJECT 限制；中文文案为“项目级到店点餐仅支持内部接入”。
- 保留 `DINE_IN_FORM_MISMATCH`：外部 DINE_IN 携带 POS/QR/KIOSK、内部 DINE_IN 缺形式、非 DINE_IN 携带形式都由此 typed problem 表达。
- `BUSINESS_SCOPE_EXCEEDED`、`PROVIDER_NOT_ENABLED`、`CATALOG_NOT_FOUND`、`VERSION_CONFLICT` 沿用既有语义；新增能力不得为同一事实再造一组错误码。

## 2. CP 总览

本批是一个完整实施单元，以下 CP 是内部串行步骤，不是独立交付或独立授权。

| CP | 主题 | 主要 owning source | 交付结果 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-01 | catalog、error source 与生成链 | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、error disposition catalog、两个 generator | DINE_IN capability、新 project-specific problem 从源头闭合 | O2/IA |
| CP-02 | collaboration provider closure | `contracts/collaboration/*`、`CheckedInCollaborationCatalogSource`、collaboration owner | 真实门店自有小程序 provider 可按 DINE_IN 候选/绑定 | CP-01 |
| CP-03 | business-channel policy、DB 与通用门店读取 | `BusinessChannelPolicy`、`BusinessChannelOwnerService`、migration | STORE 外部 DINE_IN 合法；PROJECT 外部 DINE_IN fail closed；门店渠道与菜单读取分离 | CP-01/02 |
| CP-04 | edge contract 与 generated wire | `OperationsBusinessChannelController`、OpenAPI source/materialized chain | `BUSINESS_CHANNEL` 与 `SALES_MENU` usage 明确分支，生成物一致 | CP-03 |
| CP-05 | operations-admin UI | `BusinessChannelTemplateDrawer`、O5/O4 surfaces、foundation | 外部 DINE_IN 无内部形式控件，provider 精确查询，全部门店渠道可读 | CP-04 |
| CP-06 | seed、acceptance、静态/全量验证设计 | seed plan/executor、两个 acceptance domain group、L2 specs | 正负场景、readback、无部分写入、菜单隔离完整 | CP-02～05 |

## 3. CP-01：source catalog 与 generated closed set

### 3.1 owning source 与目标

必须先修改并验证 source，再 materialize/codegen；不得只修改 generated 产物：

- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`：将 `DINE_IN` 作为 collaboration capability 的闭集成员；为相关 provider-candidate/binding/readback operation 声明新增枚举事实；
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`：退役 `DINE_IN_MUST_BE_INTERNAL`，登记 `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED` 的 active disposition；
- `scripts/generate/r5-edge-materialize.mjs`：按 source catalog materialize capability/error 结果；
- `scripts/generate/edge-codegen.mjs`：重新生成 Java/TypeScript wire、enum 和 error closed set；
- `contracts/collaboration/external-platform-catalog.schema.json` 与 `contracts/collaboration/external-platform-catalog.json`：声明 DINE_IN capability 和 provider descriptor；
- `contracts/openapi-source/collaboration.schemas.json`、`contracts/openapi-source/business-channel.schemas.json`、`contracts/openapi/paths/operations-admin/business-channel.paths.json`：更新源 schema/path 和活动 error arrays；materialized 文件不得成为唯一修改源。

### 3.2 provider descriptor

本批需要一个可绑定的门店自有小程序 provider profile。为使 implementation-facing 形态不留给实施者猜测，本批固定以下 checked-in 平台 provider profile：

```text
externalSystemCode=STORE_OWNED_MINI_PROGRAM
externalSystemDisplayName=门店自有点单小程序
externalSystemCatalogStatus=PLANNED
capabilities=[DINE_IN]
capabilityDisplayName=到店点餐
capabilityAttributeValues={}
providerCode=STORE_OWNED_MINI_PROGRAM_DINE_IN
providerDisplayName=门店自有点单小程序·到店点餐
businessScope=[DINE_IN]
bindableNodeTypes=[STORE]
authenticationKind=EXTERNAL_GRANT
unbindKind=LOCAL_ONLY
providerCatalogStatus=PLANNED
```

该 descriptor 表示平台可配置的外部系统能力，不实现、不伪造任何第三方网络适配器，也不声明瑞幸已有 adapter。固定 `EXTERNAL_GRANT + LOCAL_ONLY + PLANNED` 是沿用当前已存在的 external-grant/local-only 闭集与目录状态语义：运营侧绑定按既有 pending/callback 流程，平台只维护本地 binding，不新增外部撤销调用；`PLANNED` 不成为候选硬门。D-04 的“完整可用闭包”仅要求本平台完成 catalog、enablement、候选、模板/渠道保存、binding 创建/回读和销售菜单隔离，不要求本批实现第三方网络 adapter 或外部菜单同步。不得在实施时替换为真实第三方名称、凭证字段或 TAKEAWAY alias。

workspace 必须为该固定 provider 建立 `ENABLED` enablement，seed/acceptance 断言该 enablement、provider scope、bindability 与 readback 完整一致；没有完整 descriptor 或 enablement 时，候选必须为空并 fail closed，不得凭 UI 先显示未验证 provider。

### 3.3 可证伪失败条件、不变量与验证

- **失败条件**：修改 generated Java/TS 后重新生成会复活旧 error；schema 允许 DINE_IN 但 runtime closed set 拒绝；provider scope 超出 system capability；前端枚举出现 `DINE_IN` 但 OpenAPI 不接受。
- **不变量**：source → materialized → generated 的 DINE_IN 和新 error 只各有一份源头；新 error 名称在 active set 中唯一；旧错误不在 active set；provider scope 是 system capability 子集。
- **验证**：catalog/schema validator、generator check、generated typecheck；至少一条 red mutation 删除 source capability 或恢复旧 error，必须失败。这里不运行脚本，本轮只定义验证。

## 4. CP-02：collaboration provider 与 binding closure

### 4.1 owning source

- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationBindingPolicy.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationReadback.java`

### 4.2 运行语义

1. `CAPABILITY_CLASSES` 及其 readback enum 增加 `DINE_IN`；checked-in source 验证 provider scope 不得超过 system capability。
2. provider candidate query 接收 `capabilityClass=DINE_IN`，过滤 workspace enablement、provider scope 和 provider 可绑定节点；外部 `DINE_IN` 的候选只针对 `STORE`。
3. provider binding 的 capability 使用 `DINE_IN` 精确值；`CollaborationBindingPolicy` 仍拒绝 provider scope 不包含目标 capability。
4. provider enablement、binding status 和 version 继续由 collaboration owner 持有；business-channel 只调用公开 read/command，不写 collaboration schema。
5. `PLANNED`/`AVAILABLE` 目录状态仍是目录信息，不被误用成新的菜单或 provider 规则；workspace 未启用时候选为空/保存返回 `PROVIDER_NOT_ENABLED`。

### 4.3 跨 owner 写矩阵

| 业务意图 | 第一个 owner | 第二个 owner | 事务 | 失败回滚 |
| --- | --- | --- | --- | --- |
| 读取 DINE_IN provider 候选 | collaboration read | 无 | read-only | 无写入 |
| 创建 STORE 外部 DINE_IN channel | collaboration read/recheck provider | business-channel command | edge `REQUIRED`，business-channel command 内再次复核 | channel/template child rows 不产生；provider 不被写 |
| 创建外部 binding | collaboration binding command | business-channel channel recheck | 既有 operations binding coordinator 事务 | binding 与 channel 状态不部分落库 |

任何 edge 只读不能推导写权限；任何 collaboration 类不能直写 business-channel schema。

## 5. CP-03：business-channel policy、migration 与门店通用读取

### 5.1 policy 修改目标

目标文件：`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`。

`validateTemplate` 的判断顺序固定为：

```text
validate accessKind/operatorKind/orderKind closed sets
if operatorKind=PROJECT and accessKind=EXTERNAL and orderKind=DINE_IN:
    reject PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED
if orderKind=DINE_IN and accessKind=INTERNAL:
    require dineInForm in POS|QR|KIOSK
if orderKind=DINE_IN and accessKind=EXTERNAL:
    require dineInForm == null
if orderKind != DINE_IN:
    require dineInForm == null
if accessKind=INTERNAL:
    require providerCode == null
else:
    require providerCode, provider exists, enabled, businessScope contains orderKind
```

模板创建 `BusinessChannelOwnerService.createTemplate`、模板更新命令、渠道创建 `createChannel` 的模板 revalidation 都必须使用同一 policy。不能只修模板创建，也不能让前端清理替代 owner recheck。

### 5.2 additive migration

目标 migration（实际执行前按 Flyway 当前 head 复核版本，不改写已执行文件）：

```text
apps/backend/catering-business-server/src/main/resources/db/migration/V20260910_000000_000__business_channel_dine_in_external_access.sql
```

迁移只做两件事：

1. `ALTER TABLE business_channel.business_channel_template DROP CONSTRAINT ck_business_channel_template_dine_in_form`；
2. 添加新的 CHECK，表达：
   - INTERNAL + DINE_IN 必须是 POS/QR/KIOSK；
   - STORE + EXTERNAL + DINE_IN 必须是 NULL；
   - 非 DINE_IN 必须是 NULL；
   - PROJECT + EXTERNAL + DINE_IN 不落入任何允许分支，数据库拒绝。

不新增列、不改写旧 migration、不做数据回填。现存 INTERNAL DINE_IN 行应天然满足新 CHECK；migration integration test 与 acceptance 必须实际证明，不得只写文档断言。provider 存在、enablement、scope 和 PROJECT typed problem 是 owner/edge 责任，不能塞进跨表 CHECK。

### 5.3 门店经营渠道读取与销售菜单读取分离

当前 `OperationsBusinessChannelController.storeChannels` 将 store route 限定为 `usage=SALES_MENU`，而 `BusinessChannelList` 将其用于 O5 门店全部渠道区。这会把合法的外部 DINE_IN 渠道从经营渠道事实中隐藏。最小修复是复用既有 endpoint 和 owner API，不新增业务模型或权限：

| usage | edge 分支 | owner read | 消费者 | 形态 |
| --- | --- | --- | --- | --- |
| `BUSINESS_CHANNEL` | session/store scope 后调用 `businessChannels.pageChannels(..., STORE, storeRef, null, sortKey, sortDirection)` | 全部门店渠道，含外部 DINE_IN | O5 门店主体经营渠道 | Bounded，服务端 `BOUNDED_READ_LIMIT=100` |
| `SALES_MENU` | 保持现有校验和固定 page size/cursor | `businessChannelOwner.listSalesMenuEligibleChannels` | 销售菜单页面 | Cursor，`SALES_MENU_PAGE_SIZE=20` |

OpenAPI 同一 `getOperationsStoreBusinessChannels` operation 的 `usage` enum 扩展为 `BUSINESS_CHANNEL|SALES_MENU`。`BUSINESS_CHANNEL` 不接受 cursor/pageSize；edge 对其提供 cursor/pageSize 返回 typed invalid request，不忽略客户端输入。`SALES_MENU` 的 cursor/pageSize/sort 语义不变。前端 `readStoreBusinessChannels` 改为 `BUSINESS_CHANNEL`；销售菜单现有 read model 继续发送 `SALES_MENU`。

`pageChannels` 的 SQL 仍由 business-channel owner 负责 scope、target type、status 与固定 bounded limit；不在 edge 或前端做客户端过滤。外部 DINE_IN 只是被通用渠道读取看见，不因此进入销售菜单。

### 5.4 CP-03 的失败条件与 focused proof

- **失败条件**：`EXTERNAL+DINE_IN` 携带 form 能落库；`PROJECT+EXTERNAL+DINE_IN` 能落库；O5 全部渠道仍调用 `usage=SALES_MENU`；菜单 candidate/direct guard 只保留 accessKind 而放宽 operator/order。
- **不变量**：owner policy、DB CHECK、edge usage、sales-menu SQL 和 O5 query 的行为矩阵一致；失败不产生模板/渠道/绑定部分写入。
- **最低 proof**：policy focused test 覆盖全矩阵；migration integration test 覆盖 old/new rows 和 red combinations；owner focused test 覆盖 create/update/channel revalidation；HTTP acceptance 覆盖读回与业务后果。

## 6. CP-04：edge、OpenAPI 与 generated wire

### 6.1 目标文件

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/BusinessChannelWireMapper.java`
- `contracts/openapi-source/business-channel.schemas.json`
- `contracts/openapi-source/collaboration.schemas.json`
- `contracts/openapi/paths/operations-admin/business-channel.paths.json`
- `contracts/openapi/edge.openapi.json`
- generated Java/TypeScript 只由生成器产出，不手改。

### 6.2 contract 规则

- 不新增 `dineInForm` 字段；既有 nullable field 足以表达外部 DINE_IN 的 null。
- capability closed set 增加 `DINE_IN`；provider candidate query 的 capability enum 由 source catalog 生成。
- active error arrays 移除 `DINE_IN_MUST_BE_INTERNAL`，加入 `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED`。
- `getOperationsStoreBusinessChannels` usage 增加 `BUSINESS_CHANNEL`；operationId、consumer face、owner module、权限 capability 不变。
- response 继续返回 machine code 与现有 displayName/display fields；operations-admin 的既有 `collaborationCodeLabels.ts` 是本 app 消费闭集 code 的唯一中文 label 源，允许在同一 map 中补齐 `DINE_IN`，但不得再创建第二份业务 enum-label 字典，也不为本批新增不存在的 contract displayNames。

### 6.3 owner/edge 复核

`BUSINESS_CHANNEL` 只证明当前 store scope 后读取全部 store channel；它不调用 sales-menu owner。`SALES_MENU` 继续经 sales-menu owner 的 candidate/direct 双重谓词。无论前端传入哪一种 usage，edge 都必须先 `requireWorkspaceRead` 并复核 store scope。

## 7. CP-05：operations-admin UI 与 foundation

### 7.1 owning source

- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDetailDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/application/queries.ts`
- `apps/frontend/operations-admin/src/features/business-channel/model/collaborationCodeLabels.ts`
- `apps/frontend/operations-admin/src/app/automation/businessChannelTemplateTestIds.ts`
- foundation consumer：`libraries/frontend/admin-ui-foundation/src/index.ts` 及其中 `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useDirtyFormLock`、`useOverlayLock`、`useAsyncGenerationGuard`、`collectCursorPages`、`testId`、`closedCodeLabel` 的实际实现。

### 7.2 组件行为

1. `BusinessChannelTemplateDrawer` 的 provider query 必须由 `orderKind` 精确映射 capability；DINE_IN 不得把 undefined 透传为“所有 provider”。
2. `STORE + EXTERNAL + DINE_IN` 显示 provider Select 和只读说明“外部系统不使用 POS、扫码或自助机点餐形式”，隐藏 `dineInForm`；save body 发送 `dineInForm=null`。
3. `STORE + INTERNAL + DINE_IN` 显示必填 POS/扫码/自助机 Select；外部 provider 为空。
4. `PROJECT + DINE_IN` 禁用外部接入选项或显示项目限制；不能仅靠 disabled，owner 必须返回新 typed problem。
5. provider loading/empty/error/retry 状态不能把失败静默变成空数组；空/失败均阻断外部 DINE_IN 保存。
6. order/access/operator 变化清理 stale `dineInForm`/`providerCode`；异步旧响应不能覆盖当前选择。
7. `BusinessChannelTemplateDetailDrawer` 对外部 DINE_IN 查询 provider 时显式传 `DINE_IN`，不以 undefined 读取全量 provider。
8. `BusinessChannelList`/`StoreBusinessChannelPage` 的 O5 全部渠道 query 使用 `BUSINESS_CHANNEL`；销售菜单页面保持自己的 `SALES_MENU` query。
9. DINE_IN label map 和 collaboration capability label map 由 generated closed-set type 约束的既有 `collaborationCodeLabels.ts` + `closedCodeLabel` 消费；本批只在该既有 map 补齐 `DINE_IN`，不新增 contract displayNames 或第二份业务枚举源。

### 7.3 testId 与 L2 admission

testId 唯一源是 `businessChannelTemplateTestIds.ts`；实现时要将当前 Drawer 的 inline testId 迁移进去，并按 UI 工件的完整 roster 绑定到真实 Radio、Select、option、Button、Alert/table 节点。关键集合为：

```text
businessChannelTemplateForm
businessChannelTemplateAccessKind
businessChannelTemplateAccessKindInternal
businessChannelTemplateAccessKindExternal
businessChannelTemplateOperatorKind
businessChannelTemplateOrderKind
businessChannelTemplateOrderKindDineIn
businessChannelTemplateOrderKindTakeaway
businessChannelTemplateOrderKindGroupBuy
businessChannelTemplateDineInForm
businessChannelTemplateDineInFormPos
businessChannelTemplateDineInFormQr
businessChannelTemplateDineInFormKiosk
businessChannelTemplateProvider
businessChannelTemplateProviderOption(providerCode)
businessChannelTemplateProviderEmpty
businessChannelTemplateProviderReadProblem
businessChannelTemplateProviderRetry
businessChannelTemplateExternalDineInInfo
businessChannelTemplateSubmit
businessChannelTemplateCancel
storeBusinessChannelTemplateCandidateTable
storeBusinessChannelList
businessChannelExternalDineInDetail
```

不新增 L2 script，直到 UI roster、真实动作节点和 focused/static proof 均 PASS。L2 只能消费 roster 常量，不能用 role/label/text/CSS/XPath/wait 替代。

## 8. CP-06：seed 与 acceptance 设计

### 8.1 seed fixture

目标文件（获授权后才改）：

- `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`
- `scripts/dev/external-collaboration-business-channel-seed-executor.mjs`
- 对应 seed tests 与 `scripts/README.md` 受管入口说明

fixture 必须包含：

1. 两个同项目 `ENABLED` 门店，以及一个可选 `DISABLED`/`VOIDED` 负例；
2. 一个 `STORE_OWNED_MINI_PROGRAM_DINE_IN` provider，workspace enablement 为 ENABLED，scope 精确为 DINE_IN，bindable node 只允许 STORE；
3. 一个 STORE external DINE_IN template/channel with `dineInForm=null`，并完成/保留既有 binding 状态语义；
4. 内部 DINE_IN POS/QR/KIOSK、内部 TAKEAWAY、既有外部 TAKEAWAY/GROUP_BUY 正例；
5. PROJECT external DINE_IN negative；外部 DINE_IN 不创建本平台 sales menu；
6. 同一门店的通用渠道 read 能返回 external DINE_IN，而 `SALES_MENU` read 只能返回内部 DINE_IN/TAKEAWAY。

seed 自校验不再断言“全部 DINE_IN 必须 INTERNAL”；它应断言：STORE 外部 DINE_IN form 为空、PROJECT 外部 DINE_IN 被拒、内部 DINE_IN 三种形式仍有效、菜单集合仍只有内部渠道。

### 8.2 backend acceptance 场景

业务场景必须分别放入现有 domain group：

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`
- 销售菜单边界回归放入 `SalesMenuAcceptanceScenarios.java`，不把菜单 fixture 移到 collaboration。

每条场景必须有真实 fixture、真实 HTTP route identity、`CONTRACT` 和 `BUSINESS` 分开的 real oracle；负向场景必须证明没有非法写入。计划中的最小场景闭集如下：

| scenario id | owner file | fixture/request/oracle |
| --- | --- | --- |
| `collaboration.dine-in-capability-readback` | `CollaborationAcceptanceScenarios.java` | 读取 catalog/dictionary，断言 system capability、provider scope、bindable STORE 含 DINE_IN；不出现 POS/QR/KIOSK capability |
| `collaboration.dine-in-provider-candidates` | `CollaborationAcceptanceScenarios.java` | workspace enable provider，带 `capabilityClass=DINE_IN` 请求候选；断言只有 DINE_IN provider，TAKEAWAY provider 不混入 |
| `business-channel.store-external-dine-in-template` | `BusinessChannelAcceptanceScenarios.java` | POST STORE external DINE_IN with `dineInForm=null` and `providerCode=STORE_OWNED_MINI_PROGRAM_DINE_IN`; readback 断言 access/order/provider/form；DB/owner readback 证明 form null、provider 精确为 DINE_IN profile |
| `business-channel.store-external-dine-in-provider-missing` | `BusinessChannelAcceptanceScenarios.java` | POST STORE external DINE_IN with `dineInForm=null` and `providerCode=null`；断言 typed validation failure，模板/渠道/绑定无部分写入 |
| `business-channel.store-external-dine-in-channel` | `BusinessChannelAcceptanceScenarios.java` | 从模板创建 STORE channel；owner revalidation 断言成功且外部 binding 状态沿用既有语义 |
| `business-channel.project-external-dine-in-rejected` | `BusinessChannelAcceptanceScenarios.java` | POST PROJECT external DINE_IN with null form；断言 `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED`、模板/渠道未写入 |
| `business-channel.external-dine-in-form-rejected` | `BusinessChannelAcceptanceScenarios.java` | STORE external DINE_IN 分别携带 POS/QR/KIOSK；断言 `DINE_IN_FORM_MISMATCH`，读取确认无部分写入 |
| `business-channel.internal-dine-in-form-matrix` | `BusinessChannelAcceptanceScenarios.java` | INTERNAL DINE_IN POS/QR/KIOSK 成功；null/unknown form 失败；读回和 DB CHECK 一致 |
| `business-channel.store-management-channel-read-includes-external-dine-in` | `BusinessChannelAcceptanceScenarios.java` | GET store channels with `usage=BUSINESS_CHANNEL`；断言 external DINE_IN identity 存在，响应形状为 bounded |
| `sales-menu.external-dine-in-excluded` | `SalesMenuAcceptanceScenarios.java` | 同一门店 GET `usage=SALES_MENU` 与 menu direct create；断言 external DINE_IN 不在候选且 direct 返回 `SALES_MENU_CHANNEL_INELIGIBLE` |
| `business-channel.store-usage-separation` | `BusinessChannelAcceptanceScenarios.java` | 对同一 store 分别调用两种 usage；断言通用渠道结果包含 external，菜单结果只含 internal DINE_IN/TAKEAWAY |
| `business-channel.dine-in-project-no-partial-write` | `BusinessChannelAcceptanceScenarios.java` | 在事务中触发 project typed reject；回读模板、channel、binding 与 version，证明均未变化 |
| `collaboration.dine-in-binding-scope` | `CollaborationAcceptanceScenarios.java` | 用不含 DINE_IN scope provider 创建 DINE_IN binding；断言 `BUSINESS_SCOPE_EXCEEDED` 且 binding 未写入 |

focused 命令（实施授权后）：

```bash
scripts/test/backend-acceptance --operation <scenario-id>
```

批次完成后必须跑全量：

```bash
scripts/test/backend-acceptance --operation all
scripts/verify
```

全量 acceptance 不能由一串 focused run 代替；最后一次全量 run 必须晚于所有生产/契约/fixture 代码改动。每条场景报告 `CONTRACT`、`BUSINESS=REAL`、信息性 `DB_OPERATIONS`；受管资源 cleanup 独立报告。

### 8.3 browser L2 设计

L2 使用无 HMR 受管拓扑：远端 Spring/DB/object storage，本机两个 Vite 和 Playwright，只经 HTTP/asset tunnel；每个 run 绑定独立远端 DB 与 asset prefix。当前不执行。

最小 UI case/action：

1. O2 创建 STORE external DINE_IN：选择经营主体、DINE_IN、外部接入；断言不存在 `dineInForm` 控件，出现外部说明；provider query 明确为 DINE_IN；选择 provider、保存、详情回读 `dineInForm` 为空。
2. O2 negative PROJECT external DINE_IN：外部选项置灰/说明可见；直接 HTTP reject 由 backend acceptance 负责，L2 只验证 UI 不提供错误路径。
3. O5 门店全部渠道：外部 DINE_IN 出现在“门店主体经营渠道”；销售菜单页同门店不出现该渠道。
4. provider empty/error/retry：空集和失败均阻断保存，Retry 使用 roster 真实按钮。

L2 完成标准：所有 case business PASS，join `COMPLETE`，missing/unexpected control 为零，business 与 cleanup 分开且均 PASS；无法从当前字节可靠推导的 UI 分母写 `UNVERIFIED_REQUIRES_EVIDENCE`，不得猜数。

## 9. 跨层 declaration—transfer—consumption matrix

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| 外部 DINE_IN 无内部形式 | Journey/UI/IA 的组合矩阵 | nullable `dineInForm` in business-channel wire → Java policy/DB CHECK | Drawer 隐藏形式并显示外部说明；详情显示业务说明 | policy/migration/HTTP/L2 |
| D-02 仅 STORE | Journey D-02 | owner policy + error catalog + DB CHECK | UI 对 PROJECT 置灰；edge/owner 复核 | HTTP negative/no-write |
| DINE_IN capability | catalog source | materializer/codegen → collaboration read/provider candidate/binding | O2 provider query sends DINE_IN; detail label consumes generated readback | catalog red mutation + HTTP |
| 菜单边界 | Journey + existing sales-menu owner | `usage=SALES_MENU` → `listSalesMenuEligibleChannels`/`requireSalesMenuChannel` | sales-menu UI only uses menu read | sales-menu acceptance/L2 |
| 门店全部渠道 | IA-O5 | `usage=BUSINESS_CHANNEL` → `pageChannels` bounded read | O5 `readStoreBusinessChannels` | channel read acceptance |
| 集合形态 | IA collectionShape | OpenAPI usage/cursor/pageSize + owner limit | foundation cursor collector only for candidate/menu; bounded table no client slice | static + HTTP |
| 授权执行点 | IA stateAndPermission | edge session/store scope + owner `requireScope` | O2/O5 consume only scoped readback | HTTP cross-scope negative |
| 缓存失效 | IA navigationAndRefresh | refresh signals/query identities | only O2/O5 affected reads refresh; sales-menu usage stays isolated | focused/static |
| 错误映射 | IA error table/source error catalog | generated Java/TS problem closed set | operations problem renderer keeps typed detail | generator + focused |
| 日志与脱敏 | backend/frontend standards | runner/owner structured logs with run/operation identity | reports contain stage/result, never token/raw payload | acceptance log read |

## 10. 全链同步变更清单（实施前后同一分母）

| 变更事实 | 契约/源/生成物 | 后端 owner/edge/migration | 前端 model/surface/state | focused/HTTP/L2 | fixture/seed | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `EXTERNAL+DINE_IN` 的 `dineInForm=null` | business-channel source schema；generated wire | policy、create/update recheck、additive CHECK | Drawer 条件隐藏/清理、详情说明、labels | matrix focused + HTTP + L2 | store external positive；form red | 同步修改 |
| D-02 仅 STORE | new error source/generated/OpenAPI | policy、edge、migration | PROJECT external option state/error | HTTP negative/no-write + L2 state | project red fixture | 同步修改 |
| DINE_IN capability/provider | collaboration catalog/schema/source catalog/generated | checked-in source、candidate、binding policy | provider query/detail/label | catalog + collaboration HTTP + L2 provider | real descriptor/enablement | 同步修改 |
| 退役旧 error | error disposition catalog/generator/generated | policy no longer emits old code | feedback old copy retired | generator + old red mutation | seed old assertion retired | 同步修改 |
| O5 全渠道读取 | OpenAPI usage enum/generated client | edge usage branch + `pageChannels` | `readStoreBusinessChannels=BUSINESS_CHANNEL` | HTTP read separation + L2 | external channel visible | 同步修改 |
| Sales menu unchanged | existing sales-menu paths/generated remain | sales-menu owner predicates unchanged | sales-menu query remains SALES_MENU | existing full regression + new negative | internal positive/external negative | 反例同步确认 |

## 11. 依赖、日志、证据和不执行项

### 11.1 复用机制

- 后端继续复用 `BusinessChannelPolicy`、`CollaborationReadback`、既有 `pageChannels`、`listSalesMenuEligibleChannels`、owner scope/CAS/transaction 和 `CollaborationBindingPolicy`。
- 前端继续复用 `libraries/frontend/admin-ui-foundation` 的 Drawer/form lifecycle、overlay lock、generation guard、cursor collection、refresh signal、closed code label 和 testId。
- 生成契约继续复用 source catalog → materialize/codegen，不手改 generated。
- acceptance 继续复用现有 `BackendAcceptanceTest.ScenarioContext`、domain group、真实 route identity 和 report 分层。

### 11.2 日志与脱敏

每个受管 acceptance/L2 run 必须记录 run identity、阶段、受控进程、日志路径、首败/最后已知成功、业务结果和 cleanup；日志不得包含 token、password、OTP、cookie、Authorization、手机号、登录名、原始 provider payload 或外部 owner secret。业务响应中只允许 opaque provider/channel identity 和已声明中文 display field。

### 11.3 当前未执行项

```text
STATIC_SOURCE_RECONCILIATION=DESIGN_ONLY
FOCUSED_TEST=NOT_RUN
BACKEND_ACCEPTANCE=NOT_RUN
BROWSER_L2=NOT_RUN
RESET/SEED/DEV=NOT_AUTHORIZED_AND_NOT_RUN
UAT/DEPLOYMENT/CUTOVER=OUT_OF_SCOPE
```

## 12. 设计完成判定

```text
IMPLEMENTATION_DESIGN_STATUS=PROPOSED_FOR_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
UI_DESIGN_REVIEW=OPEN
TESTID_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
STATIC_FACTS=source paths, owner symbols, matrix and generated chain identified
DYNAMIC_FACTS=UNVERIFIED_REQUIRES_EVIDENCE until focused/acceptance/L2 runs
INDEPENDENT_REVIEW=REQUIRED; fresh reviewer; max two rounds
CLAUDE_REVIEW=REQUIRED
```

只有 independent DESIGN review、Claude review 和 Dexter 后续明确实施授权全部满足后，才可进入本稿 CP；本稿本身不授权任何实现或动态运行。
