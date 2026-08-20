SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

---

title: v2s 外部协作与经营渠道 implementation-facing 详设
status: ACTIVE_IMPLEMENTATION_AUTHORIZED
createdAt: 2026-08-19
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: true
journeyRefs:

- doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md
- doc/decisions/2026-08-19-v2s-business-channel-management-journey.md
  interactionRef: doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md
  iaRef: doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md

---

# 外部协作与经营渠道 · implementation-facing 详设

## 0. 目标、授权和方案取舍

### 0.1 真实业务目标

本批要解决的不是“再做一套渠道 CRUD”，而是两个结构性错位：

1. 外部系统、provider profile、owner binding 不能继续绑定在经营渠道上，否则团购/订单同步/会员权益等未来能力会复制同构三层；
2. 经营渠道需要以项目自建四维模板承载任意多条实例，且只在外部 binding 有效时生效，不能把平台授权、门店状态或旧的渠道唯一性结论混成一条规则。

### 0.2 方案比较

| 方案                                                                                                        | 结果                                                                          | 结论                                   |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------- |
| A：继续扩展旧 `BusinessChannelProviderConfig/Binding`                                                       | 只解决当前页面，未来每种能力重复三层；渠道 owner 反向拥有外部接入事实         | 拒绝，违反 E-02/E-27                   |
| B：一个 `integration` 巨型模块承载契约、启停、binding、模板、渠道                                           | 短期文件少，但 owner 事实边界和跨域事务混在一起，未来变更面大                 | 拒绝，违反模块 owner sovereignty       |
| C：`collaboration` 拥有外部协作关系，`business-channel` 拥有模板/渠道，edge 以有限 owner command 编排跨域写 | 独立存在、变化原因不同、依赖单向；新增消费者只引用 collaboration read/command | **采用**；当前最小且能承载多业务消费者 |

**我选了 C，而不是 A/B，因为**真正需要复用的是“外部系统是谁、provider 以什么能力接入、内部 owner 如何映射”这组事实，而不是把经营渠道的页面 CRUD 抽成通用组件；C 让 owner 主权清楚，跨域写只在实际需要时由 edge 组合，避免规则复制和 Gradle 环。

### 0.3 授权边界

```text
AUTHORIZED=IA + implementation-facing design + serial implementation plan + design independent review + this bounded display-name implementation
NOT_AUTHORIZED=seed execution + reset + L2 + UAT
R5_EXTERNAL_COLLABORATION_DESIGN_AUTHORIZED=true
R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_AUTHORIZED=true
DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION
```

本稿已获 Dexter 2026-08-19 实施授权。UI 按已接受的文字版 IA/interaction 实施；不再等待另行的视觉 review，Journey 与 IA 中保留的 `PENDING_DEXTER` 只表示该裁定的来源状态。

### 0.4 本次用户反馈收口的业务不变量

- `templateCode` 与 `channelCode` 都由用户在创建表单中录入；输入只做首尾空白清理，不由系统生成，也不允许在编辑流程修改。
- `templateCode` 在同一集团空间、同一项目内唯一；`channelCode` 在同一集团空间内唯一。owner 负责业务判重，数据库部分唯一索引负责并发兜底，冲突统一返回 `DUPLICATE_CODE`。
- 旧数据允许编码为空，读列表和详情时显示 `—`，不得伪造“待生成”。新建请求不允许空编码。
- 内部接入渠道不依赖 binding，创建后直接为 `EFFECTIVE`；外部接入只有有效 binding 才能为 `EFFECTIVE`，否则保持 `DRAFT`。内部渠道详情不显示外部授权回填占位。对历史上“内部 + 无绑定 + 无停用原因 + DRAFT”的遗留行由一次性 Flyway repair 提升为 `EFFECTIVE`；其它停用/级联事实不被覆盖。
- 页面列表顺序固定为“渠道名称、渠道编码、来源模板、状态、绑定状态”；渠道名称进入只读详情 Drawer，编辑使用独立表单 Drawer。

## 1. CP 总览

本批内部有串行 CP，但不是分批交付；只有全部 CP 设计、复核和独立盲审完成后，才向 Dexter 申请一次 implementation authorization。

| CP    | 主题                                  | owner                         | 主要输出                                                        | 依赖                              |
| ----- | ------------------------------------- | ----------------------------- | --------------------------------------------------------------- | --------------------------------- |
| CP-01 | contract catalogue 与 descriptor      | contract / collaboration read | checked-in external platform catalogue、contract validation     | IA P2/P3；BR-01/02/30             |
| CP-02 | collaboration runtime owner           | collaboration                 | enablement、binding、callback/解绑协议边界、owner API           | CP-01                             |
| CP-03 | business-channel runtime owner        | business-channel              | template、channel、state/stop facts、owner API                  | CP-01；collaboration read         |
| CP-04 | edge face、capability、跨域 policy    | edge / workspace IAM          | platform/operations paths、两个 capability、有限 owner commands | CP-02/03                          |
| CP-05 | generated wire 与双 admin UI          | contract/codegen/frontend     | OpenAPI→generated Java/TS→两 app feature；foundation 接入       | CP-04；Dexter textual IA decision |
| CP-06 | seed plan、acceptance、全范围静态证明 | test/seed/review              | declarative plan、真实场景设计、静态/focused proof 命令         | CP-02～05                         |

## 2. CP-01：contract catalogue 与动态 descriptor

### 2.1 五件门控

- **RECALL**：重开 `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md` §5/§6/§9/§11/§12、source-claude 记录 001/003/006/007/010/012、`project-memory/practices/backend-capability-lookup.md`、`collection-boundary-modes.md`、`decided-undecided-marking.md`；重开 `libraries/frontend/admin-ui-foundation/src/presentation/descriptorRenderer.tsx`。
- **可证伪失败条件**：新增平台需要修改 owner Java/SQL 或新增页面结构；provider `businessScope` 可声明系统没有的能力；descriptor 缺 `label/helpText`；`catalogStatus=PLANNED` 被 publish/enable candidate 拒绝；readonly response 暴露 token/authorizationRef。
- **不变量**：每个平台恰一条 `external_system`；provider profile 的 `businessScope ⊆ external_system.capabilities`；能力属性是 checked-in contract；contract 定义全局、不带 workspace row/version/audit；`PLANNED` 只是信息字段。
- **FORBID**：contract DB 表、平台/能力规则 DSL、静态 credential 入主库、把 foundation 的 `dataPath/tabKey/admittedShapes` 直接当后端 contract 语义、因“未部署”硬编码候选禁用。
- **比例验证**：contract JSON/schema 校验 BR-01/02/30；红 mutation：重复 external system、越界 business scope、空 label/helpText、PLANNED 被拒；对 descriptor 生成一个只读 UI mapping 单测，不启动 runtime。

**我选了独立 contract descriptor，而不是直接嵌入 foundation `FieldDescriptor`，因为**后端能力属性是稳定业务数据，foundation 的 `dataPath/tabKey/admittedShapes/fieldRules` 是前端布局/形状事实；强行共享会把 UI 结构反向变成 owner contract。

### 2.2 contract 文件与模型

设计目标文件（实现时由 contract 源生成 edge/generated wire，不手改生成物）：

```text
contracts/collaboration/external-platform-catalog.json                 [NEW checked-in source]
contracts/collaboration/external-platform-catalog.schema.json           [NEW validation schema]
contracts/openapi/components/collaboration/collaboration.schemas.json   [NEW generated-input component source]
contracts/openapi/components/business-channel/business-channel.schemas.json [NEW]
contracts/openapi/components/common/problem.schemas.json                [existing, extend typed codes]
contracts/openapi/paths/platform-admin/external-collaboration.paths.json [NEW]
contracts/openapi/paths/operations-admin/business-channel.paths.json     [NEW]
contracts/openapi/edge.openapi.json                                      [add $ref path entries]
```

`external-platform-catalog.json` 只包含全局契约定义：

```text
external_system = {
  externalSystemCode: string,          // immutable, globally unique
  displayName: string,
  catalogStatus: PLANNED | AVAILABLE,  // information only
  catalogStatusDisplayName: non-empty string,
  attributeDictionary: [{
    fieldKey: string,
    label: non-empty string,
    helpText: non-empty string,
    controlKind: readonlySummary | readonlyPreview,
    optionSourceRef: enum | endpoint | local
  }],
  capabilities: [{
    capabilityClass: MASTER_DATA_SYNC | MEMBER_BENEFIT | GROUP_BUY |
      TAKEAWAY | INVENTORY_SYNC | TAKEAWAY_DELIVERY | ORDER_SYNC,
    displayName: non-empty string,
    attributeValueLabels: { <fieldKey>: non-empty string },
    attributeValues: { <fieldKey>: JSON scalar/array/object }
  }]
}

provider_profile = {
  providerCode: string,                 // immutable, globally unique under catalogue
  displayName: string,
  externalSystemCode: string,
  businessScope: capabilityClass[],
  businessScopeDisplayNames: string[],  // position-aligned with businessScope
  bindableNodeTypes: COMMERCIAL_GROUP | REGION | PROJECT | HEAD_COMPANY | STORE [],
  bindableNodeTypeDisplayNames: string[], // position-aligned with bindableNodeTypes
  authenticationKind: EXTERNAL_GRANT | INTERNAL_MAPPING | NO_MAPPING,
  authenticationKindDisplayName: non-empty string,
  unbindKind: LOCAL_ONLY | REQUIRES_ADAPTER_UNBIND,
  unbindKindDisplayName: non-empty string,
  catalogStatus: PLANNED | AVAILABLE,      // information only; not an enablement gate
  catalogStatusDisplayName: non-empty string
}
```

属性 descriptor 的五字段是 `fieldKey/label/helpText/controlKind/optionSourceRef`；能力当前取值仍放在 `capabilities[].attributeValues`，不把 read value 冒充 descriptor 字段。`attributeValueLabels` 按同一 `fieldKey` 提供该能力当前值的中文名称。P2 以能力分类为卡片、只渲染该 capability 在 `attributeValues` 中实际声明的 descriptor，避免把系统级字典与能力分类做笛卡尔积；`属性` 使用 descriptor `label`，`当前值` 使用 readback 的中文 `attributeValueLabels[fieldKey]`，`说明` 使用 descriptor `helpText`。能力没有属性时显示“暂无能力属性”；已声明但缺少当前中文值时显示 `—`，不得回退为机器字面量。`controlKind` 与 `optionSourceRef` 继续由 contract 校验并保留给后续只读控件演进，本次表格不把它们转换成编辑控件。

### 2.2a 用户可见名称字段不变量

机器字面量仍保留在 response 中供 policy、筛选和 command 使用，但不得成为用户可见文案。所有跨 edge 的 readback 必须同时提供中文名称，并由两端直接消费：

| readback                      | 机器事实                                                          | 中文名称字段                                                                                                                                                                                  | 用户消费                             |
| ----------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `ExternalCapability`          | `capabilityClass`、`attributeValues`                              | `displayName`、`attributeValueLabels`                                                                                                                                                         | platform 能力卡片标题与属性值        |
| `ProviderProfileView`         | 各类 `*Code`/enum                                                 | `displayName`、`externalSystemDisplayName`、`businessScopeDisplayNames`、`bindableNodeTypeDisplayNames`、`authenticationKindDisplayName`、`unbindKindDisplayName`、`catalogStatusDisplayName` | 两端档案/候选/绑定上下文             |
| `OwnerBindingView`            | `providerCode`、`capabilityClass`、`nodeType`、`status`           | `providerDisplayName`、`capabilityClassDisplayName`、`businessScopeDisplayNames`、`nodeTypeDisplayName`、`statusDisplayName`                                                                  | platform 与 operations 绑定列表/详情 |
| `BusinessChannelTemplateView` | `accessKind`、`operatorKind`、`orderKind`、`dineInForm`、`status` | 对应 `*DisplayName`                                                                                                                                                                           | operations 模板/渠道详情             |
| `BusinessChannelView`         | `ownerNodeType`、`status`、`stopReasons`                          | `ownerNodeTypeDisplayName`、`statusDisplayName`、`stopReasonDisplayNames`                                                                                                                     | operations 渠道列表/详情             |

表单提交仍发送机器值；只读显示、Tag、详情描述和候选选项的辅助文案不得从 enum literal 临时反推。新增枚举必须先在 contract/edge readback 中补中文名称，再接入 UI；不新增第二份前端 enum-label 字典。

**readback 版本漂移防线**：消费端不得假设旧运行实例一定已经返回新增的显示字段。缺失的显示数组/中文值只能按空集合或 `—` 呈现，不能调用未定义值的方法、不能回退显示机器字面量、不能在前端复制契约枚举映射；这只保证旧响应不把页面打崩，不把缺字段视为契约合格，服务重启/升级后仍必须返回完整 display-name 字段。

### 2.3 contract 低成本判据与未决 C

- `[已定]` 新增属性只改 contract array；后端 owner 不添加属性分支，P2 三列表格按 descriptor 的 `label/helpText` 与 readback 中文值自动呈现。
- `[已定]` 新增 provider 只加 provider profile 与系统定义，启停表不添加新列。
- `[未定·C-08]` 不建设规则 DSL/谓词表；若具体业务范围判断需要更多属性，先停止该属性的 contract 落点并向 Dexter 单条求证。
- `[未定·C-09]` “两处/一处/零主程序代码”的精确数值不是本轮机器门；只保留变更面可审计，不能为了量化新建 compliance control。

## 3. CP-02：collaboration owner

### 3.1 五件门控

- **RECALL**：重开 source-claude §3.4/§3.5/§5.5/§5.6、规格 BR-03/04/10/12/22/23/24/25/27/28/29/32/34/35、`PLATFORM-BLUEPRINT.md` owner/transaction/cross-schema 条款、`project-memory/practices/backend-capability-lookup.md`。
- **可证伪失败条件**：collaboration import business-channel；collaboration service 直接写 channel 表；外部系统停用后 channel 未获得 edge 级联；platform-admin 创建 `EXTERNAL_GRANT`；运营授权流程创建 `EXTERNAL_GRANT` 时强制 externalOwnerId；binding 删除物理丢行；适配器 callback 被主程序解析或把原始 payload 写入日志。
- **不变量**：collaboration 只拥有 enablement 与 owner_binding；platform owner command 只创建非外部授权 binding，operations owner command 承载渠道侧 `EXTERNAL_GRANT` pending；契约定义不进 DB；运行状态按 workspace；跨域写由 edge 调两个 owner command 同一 `REQUIRED` 事务；主程序只存 opaque authorization reference 与治理时间，不存动态 token。
- **FORBID**：反向 import、跨 owner repository 直写、外部 URL/signature、自动超时解绑、`externalOwnerId` 唯一索引、`authorizations[]` 子集合、按 provider 分支写外部 API。
- **比例验证**：模块依赖 ArchUnit/Gradle 静态 gate；owner focused unit test 验证认证三态、workspace default disabled、CAS、logical delete、callback no-secret；后续 backend acceptance 证明真实 HTTP 和 DB readback。

**我选了两张明确 owner runtime 表，而不是一个多态 subject 表，因为**外部系统和 provider profile 都是契约代码而非 DB row，两个运行态启停事实需要清楚的 workspace/code 唯一键；多态表会弱化 code 语义和后续 owner 约束，不能省掉真正的业务判断。

### 3.2 module 与 schema

新增模块（精确路径，当前不存在）：

```text
apps/backend/catering-business-server/modules/collaboration/
apps/backend/catering-business-server/modules/business-channel/
```

建议 schema：

```text
collaboration.external_system_enablement
  workspace_uuid, external_system_code, status, version, created_at, updated_at
  unique(workspace_uuid, external_system_code)

collaboration.provider_profile_enablement
  workspace_uuid, provider_code, status, version, created_at, updated_at
  unique(workspace_uuid, provider_code)

collaboration.owner_binding
  binding_ref, workspace_uuid, external_system_code, provider_code,
  capability_class nullable, node_type, node_ref,
  external_owner_id nullable, authorization_ref nullable,
  status, unbind_requested_at nullable, external_revoked_at nullable,
  deleted_at nullable, version, created_at, updated_at
```

`owner_binding` 的“同店两渠道”事实由多行表达：美团两个业务可有不同 `externalOwnerId`；饿了么两个业务可有相同 `externalOwnerId`，不加该字段唯一约束。`capability_class` 对开放类按 BR-29 一行一个业务线；非开放类的空值/全部业务语义按 E-26 处理，但不将其扩成 `businessScope[]` 子对象。

`node_type + node_ref` 作为 API/owner command 的两个独立输入事实保留；`[未定·C-02]` 不在本批冻结 polymorphic node value object、UUID discriminator 或跨模块 FK 形态。`[未定·C-04]` 不新增 `UNBINDING/FAILED` 最终数据库枚举；本批只保留 `unbindRequestedAt/externalRevokedAt` 事实和现有协议依赖，适配器解绑状态细节属于后续批次。

### 3.3 collaboration owner API（实现目标）

```text
CollaborationCatalogReadApi
  readExternalSystem(code)
  readProviderProfile(code)
  readCapabilityDictionary()
  listEnabledProviderProfiles(workspace, capabilityClass)

CollaborationBindingReadApi
  readBinding(workspace, bindingRef)
  pageBindings(workspace, providerCode, bindingName, nodeQueryText, sortKey?, sortDirection?, page, pageSize)
  findBindingsForChannelReference(workspace, bindingRef/providerCode/node facts)

CollaborationCommandApi
  transitionExternalSystemStatus(command, expectedVersion)
  transitionProviderProfileStatus(command, expectedVersion)
  createBinding(command, grantOrPlatformFact, expectedVersion)
  updateBinding(command, grantOrPlatformFact, expectedVersion)
  requestOrDeleteBinding(command, expectedVersion)  // exact C-04 branch remains explicit dependency
  applyAuthorizationCallback(command)               // adapter identity only
  applyRevocationCallback(command)                  // adapter identity only
```

所有 command 返回 owner readback；所有 mutation 在 owner 首读、grant/recheck、CAS、审计/幂等 receipt 之后写入。绑定的级联置灰是读取时由外部系统/档案 enablement 与下游状态派生的显示态，不写入 collaboration binding，也不提供 `markBindingsCascadeDisabled` command。`requestOrDeleteBinding` 的最终 path/body/status 由 C-04 具体裁决触发；本稿不假装已选“解绑中”枚举。

## 4. CP-03：business-channel owner

### 4.1 五件门控

- **RECALL**：重开规格 §5.8/§5.9、BR-05/06/07/09/13/14/15/16/18/21/24/25/26/31/35、E-09/E-10/E-20/E-21/E-22/E-33、`project-memory/practices/collection-boundary-modes.md` 与 corpus G-02/G-03/G-05A/G-08。
- **可证伪失败条件**：同一模板第二条合法渠道因实例条数被唯一约束拒绝；重复 templateCode/channelCode 未返回 typed `DUPLICATE_CODE`；外部到店模板被创建；非到店携带 dineInForm；绑定无效仍把渠道置为生效；停用对象被隐藏/删除/编辑；模板恢复错误地打开双来源停用或 MANUAL 停用渠道；门店停用阻断创建。
- **不变量**：business-channel 拥有 template/channel；依赖方向只读 collaboration；模板四维创建后 immutable；channel 是可多实例 owner fact；渠道 status 与 binding validity、template/external stop facts 分开；跨域删除/停用由 edge policy 组合。
- **FORBID**：business-channel 直接改 collaboration 表；collaboration 反向调用 business-channel；由前端隐藏或由系统生成业务编码；C-01 以前写死恢复算法；门店 status 推导 channel admission；runtime 订单/菜单判断 DSL。
- **比例验证**：owner unit test 覆盖四维 validation、同模板多实例、typed problems、stop source readback、binding detach command；静态 ArchUnit 证明单向依赖；backend acceptance 覆盖真实 HTTP/readback。

**我选了 channel 的显式 `stopReasons` 集合，而不是单值 `stoppedBy`，因为**模板停用、外部停用和运营 MANUAL 可以同时存在，单值会让恢复一个来源误开另一个来源；但恢复算法的最终裁决仍保留为 C-01，不提前写入契约约束。

### 4.2 schema 与 owner API

```text
business_channel.business_channel_template
  template_ref, workspace_uuid, project_ref, template_name,
  template_code,                         // user-entered, immutable, project-scoped unique
  access_kind, operator_kind, order_kind, dine_in_form nullable,
  provider_code nullable, status, version, created_at, updated_at

business_channel.business_channel
  channel_ref, workspace_uuid, target_node_type(PROJECT|STORE), target_node_ref,
  template_ref, channel_code, channel_name, binding_ref nullable,
  status(DRAFT|EFFECTIVE|DISABLED), stop_reasons, version,
  created_at, updated_at
```

`template_code` 与 `channel_code` 都是 owner 返回并在对应列表/详情独立呈现的真实业务编码。两者均由用户创建时输入、只做首尾空白清理且创建后不可变；模板编码按项目判重，渠道编码按集团空间判重。owner 先做 typed duplicate check，数据库 partial unique index 处理并发竞争，冲突统一返回 `DUPLICATE_CODE`。历史空值只作为兼容读回，页面显示 `—`。

创建状态由接入类型决定：`INTERNAL` 渠道不需要 binding，创建即 `EFFECTIVE`；`EXTERNAL` 渠道只有 binding 为 `EFFECTIVE` 时才为 `EFFECTIVE`，其它情况保持 `DRAFT`。`EXTERNAL_GRANT` 的外部主体编号仅在授权回填后显示，内部渠道始终显示 `—`。

```text
BusinessChannelReadApi
  boundedTemplates(workspace, projectRef, filters, sortKey?, sortDirection?)
  pageStoreTemplateCandidates(workspace, projectRef, storeRef, cursor, pageSize)
  boundedChannels(workspace, targetNodeType, targetNodeRef, filters, sortKey?, sortDirection?)
  readChannel(workspace, channelRef)

BusinessChannelCommandApi
  createTemplate(command, OperationsOwnerScopeGrant)
  updateTemplate(command, OperationsOwnerScopeGrant, expectedVersion)
  transitionTemplateStatus(command, OperationsOwnerScopeGrant, expectedVersion)
  createChannel(command, OperationsOwnerScopeGrant)
  updateChannel(command, OperationsOwnerScopeGrant, expectedVersion)
  transitionChannelStatus(command, OperationsOwnerScopeGrant, expectedVersion)
  returnChannelToDraftAfterBindingDeletion(command, expectedVersion) // edge only, same REQUIRED transaction
  applyExternalStopReason(command, expectedVersion)                 // edge only, same REQUIRED transaction
```

模板和渠道不能物理删除；绑定标记删除后，edge 同事务调用 `returnChannelToDraftAfterBindingDeletion`，由 business-channel owner 按模板接入类型回读：外部渠道为 `status=DRAFT`，内部渠道保持/恢复 `status=EFFECTIVE`，并清空 `binding_ref`。外部系统/档案停用由 edge 先调用 collaboration 的 status transition，再调用 business-channel 的 `applyExternalStopReason` 写入 `CASCADE_EXTERNAL` 事实；这不是派生置灰 command，也不由任一 owner 反向调用另一 owner。模板/渠道停用保留列表事实并置灰。`PLANNED` provider 只要 workspace enablement 为启用即可被 O2 候选选中。

## 5. CP-04：edge、paths、capability 与跨域事务

### 5.1 五件门控

- **RECALL**：重开 `PLATFORM-BLUEPRINT.md`、规格 §9、BR-20/27/31/34、`backend-capability-lookup.md`、`contracts/registry/generated/operation-handler-bindings/` 现有 owner binding、`WorkspaceCapabilityRequirementCatalog` 与 `OperationsOwnerScopeGrant`。
- **可证伪失败条件**：platform-admin operation 带 `capabilityKey`；operations GET 被 capability 拒绝；请求 body 自带 target 绕过 grant；跨域级联只写一张表；edge 通过 repository 直写 owner schema；一次 policy 不是同一 REQUIRED 事务。
- **不变量**：`x-consumer-faces` 单一 HTTP 面；platform/admin 两 face 独立；operations 写 capability 恰两个；每个 command owner 在 CAS/audit/replay 前复核 grant；跨域写由 edge 明确列出两个 command。
- **FORBID**：为 platform-admin 新造 capability；把 capability 当页面/GET 权限；动态 operation registry/旧 196 provider 壳；手改 generated Java/TS；operation 以 BR/OP/Journey ID 命名 runtime/test 文件。
- **比例验证**：OpenAPI contract checker + operation-handler-bindings generator；capability registry 静态数检查恰两个；红 mutation：第三 capability、platform capability、missing owner command、不同 transaction mode；ArchUnit 检查 imports。

**我选了 face-specific edge adapter + shared owner API，而不是一个 multi-face controller，**因为 `platform-admin` 与 `operations-admin` 的 session/授权/target boundary 不同；共享 owner command 复用事实，edge 面保持可验证的安全边界。

### 5.2 operationId/path 设计

下表是 implementation-facing stable capability names；它们不是运行时 Journey/BR/OP 编号。

| 业务意图                              | operationId                                                                                                                                 | method/path                                                                                                           | face             | collection                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------- |
| 系统/档案树                           | `getPlatformExternalCollaborationTree`                                                                                                      | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/external-collaboration`                                       | platform-admin   | Bounded                   |
| 系统详情                              | `getPlatformExternalSystemDetail`                                                                                                           | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}`                        | platform-admin   | Detail                    |
| 档案详情                              | `getPlatformProviderProfileDetail`                                                                                                          | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}`                             | platform-admin   | Detail                    |
| 系统启停                              | `transitionPlatformExternalSystemStatus`                                                                                                    | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}/status`                | platform-admin   | command                   |
| 档案启停                              | `transitionPlatformProviderProfileStatus`                                                                                                   | POST `/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/status`                     | platform-admin   | command                   |
| binding Page                          | `getPlatformProviderProfileBindings`                                                                                                        | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/owner-bindings`              | platform-admin   | Page                      |
| binding Detail                        | `getPlatformOwnerBindingDetail`                                                                                                             | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}`                                  | platform-admin   | Detail                    |
| platform binding create/update/delete | `createPlatformOwnerBinding` / `updatePlatformOwnerBinding` / `deletePlatformOwnerBinding`                                                  | POST/PATCH/DELETE `/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings[/{bindingRef}]`                  | platform-admin   | command                   |
| platform capability dictionary        | `getPlatformExternalCapabilityDictionary`                                                                                                   | GET `/api/platform/external-capability-dictionary`                                                                    | platform-admin   | Detail aggregate          |
| operations capability dictionary      | `getOperationsExternalCapabilityDictionary`                                                                                                 | GET `/api/operations/external-capability-dictionary`                                                                  | operations-admin | Detail aggregate          |
| operations provider candidates        | `getOperationsExternalProviderCandidates`                                                                                                   | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/external-provider-candidates`                               | operations-admin | Cursor candidate protocol |
| channel-associated binding detail     | `getOperationsOwnerBindingDetail`                                                                                                           | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding`               | operations-admin | Detail                    |
| channel-associated binding commands   | `createOperationsOwnerBinding` / `updateOperationsOwnerBinding` / `deleteOperationsOwnerBinding`                                            | POST/PATCH/DELETE `/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding` | operations-admin | command                   |
| template bounded read                 | `getOperationsBusinessChannelTemplates`                                                                                                     | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates`                                 | operations-admin | Bounded                   |
| store template candidates             | `getOperationsStoreBusinessChannelTemplateCandidates`                                                                                       | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-template-candidates`                       | operations-admin | Cursor candidate protocol + transient sort |
| template commands                     | `createOperationsBusinessChannelTemplate` / `updateOperationsBusinessChannelTemplate` / `transitionOperationsBusinessChannelTemplateStatus` | POST/PATCH/POST `.../business-channel-templates[/{templateRef}][/status]`                                             | operations-admin | command                   |
| project channel bounded read          | `getOperationsProjectBusinessChannels`                                                                                                      | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels`                    | operations-admin | Bounded                   |
| store channel bounded read            | `getOperationsStoreBusinessChannels`                                                                                                        | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels`                        | operations-admin | Bounded                   |
| channel Detail                        | `getOperationsBusinessChannelDetail`                                                                                                        | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}`                             | operations-admin | Detail                    |
| channel commands                      | `createOperationsBusinessChannel` / `updateOperationsBusinessChannel` / `transitionOperationsBusinessChannelStatus`                         | POST/PATCH/POST `.../business-channels[/{channelRef}][/status]`                                                       | operations-admin | command                   |
| existing node candidates              | existing `getPlatformOrganizationCandidates` / `getOperationsOrganizationCandidates`                                                        | existing paths, only enum/usage extension                                                                             | both             | Cursor candidate protocol |

OP-11/OP-12 adapter callback paths are not exposed to either admin app. They use a separately designed adapter face and are included in collaboration owner API only; no external integration is implemented in this batch.

Operations-admin 没有独立的 owner-binding collection/detail 管理面；上表的 binding operation 只能从一个已定位的 business channel 上下文进入，并且只能维护该渠道关联的 binding。非渠道 binding、provider profile 下的全量 binding、平台级 enablement 与适配器 callback 均不在 operations-admin route 或 capability 中。

### 5.3 capability policy

```text
BC-BUSINESS-CHANNEL-PROJECT-EDIT = 项目渠道编辑
BC-BUSINESS-CHANNEL-STORE-EDIT   = 门店渠道编辑
```

Capability registry entries are the only two new operations-facing write keys. Both cover the corresponding channel writes and the binding writes initiated from that channel context. Platform enablement and non-channel binding operations have `x-required-platform-authorization` only. Owner grant fields must be server minted: workspace, group, target type, target reference, capability, operation purpose and `expectedContextVersion`; client body/session/page key cannot widen them. The implementation extends the existing `OperationsOwnerScopeGrant` with that context version and rechecks it before owner CAS/audit/replay.

### 5.3a operation source-of-truth mapping

The following table is the per-operation source mapping for this batch. The path shard and operationId are the OpenAPI source; generated Java/TS/edge consumers are regenerated from it. `NONE` means no capability is attached to the read route, not that session, owner or context rechecks are skipped. New requirement/resolver/recheck/red-fixture identifiers in this table are introduced together in the manifest and are not inferred at implementation time.

| operationId                                           | OpenAPI source path / method                                | face             | authorization / requirementId                                                                                                                 | resolver / ownerRecheckId                                     | typed problem / red fixture                                                                                       | context contract                                             |
| ----------------------------------------------------- | ----------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `getPlatformExternalCollaborationTree`                | `platform-admin/external-collaboration.paths.json#/.../get` | platform-admin   | NONE                                                                                                                                          | PLATFORM_WORKSPACE_SCOPE / OWNER_RECHECK_COLLABORATION        | — / RED_PLATFORM_WORKSPACE_SCOPE                                                                                  | WorkspaceScope session; group key from session context       |
| `getPlatformExternalSystemDetail`                     | same shard / get                                            | platform-admin   | NONE                                                                                                                                          | PLATFORM_WORKSPACE_SCOPE / OWNER_RECHECK_COLLABORATION        | — / RED_PLATFORM_WORKSPACE_SCOPE                                                                                  | WorkspaceScope session; group key from session context       |
| `getPlatformProviderProfileDetail`                    | same shard / get                                            | platform-admin   | NONE                                                                                                                                          | PLATFORM_WORKSPACE_SCOPE / OWNER_RECHECK_COLLABORATION        | — / RED_PLATFORM_WORKSPACE_SCOPE                                                                                  | WorkspaceScope session; group key from session context       |
| `transitionPlatformExternalSystemStatus`              | same shard / post                                           | platform-admin   | `x-required-platform-authorization=REQ_TRANSITION_PLATFORM_EXTERNAL_SYSTEM_STATUS`                                                            | PLATFORM_WORKSPACE_TARGET / OWNER_RECHECK_COLLABORATION       | `VERSION_CONFLICT,PROVIDER_NOT_ENABLED` / RED_PLATFORM_EXTERNAL_STATUS_CAS                                        | server workspace target + expectedVersion                    |
| `transitionPlatformProviderProfileStatus`             | same shard / post                                           | platform-admin   | `x-required-platform-authorization=REQ_TRANSITION_PLATFORM_PROVIDER_PROFILE_STATUS`                                                           | PLATFORM_WORKSPACE_TARGET / OWNER_RECHECK_COLLABORATION       | `VERSION_CONFLICT,PROVIDER_NOT_ENABLED` / RED_PLATFORM_PROVIDER_STATUS_CAS                                        | server workspace target + expectedVersion                    |
| `getPlatformProviderProfileBindings`                  | same shard / get                                            | platform-admin   | NONE                                                                                                                                          | PLATFORM_WORKSPACE_SCOPE / OWNER_RECHECK_COLLABORATION        | — / RED_PLATFORM_WORKSPACE_SCOPE                                                                                  | WorkspaceScope session                                       |
| `getPlatformOwnerBindingDetail`                       | same shard / get                                            | platform-admin   | NONE                                                                                                                                          | PLATFORM_WORKSPACE_SCOPE / OWNER_RECHECK_COLLABORATION        | — / RED_PLATFORM_WORKSPACE_SCOPE                                                                                  | WorkspaceScope session                                       |
| `createPlatformOwnerBinding`                          | same shard / post                                           | platform-admin   | `x-required-platform-authorization=REQ_CREATE_PLATFORM_OWNER_BINDING`                                                                         | PLATFORM_WORKSPACE_TARGET / OWNER_RECHECK_COLLABORATION       | `NODE_TYPE_NOT_BINDABLE,AUTHORIZATION_REQUIRED` / RED_PLATFORM_BINDING_POLICY                                     | server workspace/target fact + expectedVersion when supplied |
| `updatePlatformOwnerBinding`                          | same shard / patch                                          | platform-admin   | `x-required-platform-authorization=REQ_UPDATE_PLATFORM_OWNER_BINDING`                                                                         | PLATFORM_WORKSPACE_TARGET / OWNER_RECHECK_COLLABORATION       | `BINDING_EDIT_NOT_ALLOWED,IMMUTABLE_FIELD,VERSION_CONFLICT` / RED_PLATFORM_BINDING_POLICY                         | server workspace/target fact + expectedVersion               |
| `deletePlatformOwnerBinding`                          | same shard / delete                                         | platform-admin   | `x-required-platform-authorization=REQ_DELETE_PLATFORM_OWNER_BINDING`                                                                         | PLATFORM_WORKSPACE_TARGET / OWNER_RECHECK_COLLABORATION       | `ADAPTER_UNBIND_REQUIRED,VERSION_CONFLICT` / RED_PLATFORM_BINDING_UNBIND                                          | server workspace/target fact + expectedVersion               |
| `getPlatformExternalCapabilityDictionary`             | same shard / get                                            | platform-admin   | NONE                                                                                                                                          | PLATFORM_WORKSPACE_SCOPE / OWNER_RECHECK_COLLABORATION        | — / RED_PLATFORM_DESCRIPTOR_READBACK                                                                              | WorkspaceScope session                                       |
| `getOperationsExternalCapabilityDictionary`           | `operations-admin/business-channel.paths.json#/.../get`     | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_BUSINESS_CHANNEL       | — / RED_OPERATIONS_SCOPE                                                                                          | operations session + groupWorkspaceKey context               |
| `getOperationsExternalProviderCandidates`             | same shard / get                                            | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_COLLABORATION          | — / RED_OPERATIONS_SCOPE                                                                                          | operations session + groupWorkspaceKey context               |
| `getOperationsOwnerBindingDetail`                     | same shard / get                                            | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_COLLABORATION          | — / RED_OPERATIONS_CHANNEL_CONTEXT                                                                                | channel context only                                         |
| `createOperationsOwnerBinding`                        | same shard / post                                           | operations-admin | `REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_CREATE` + target map `PROJECT→BC-BUSINESS-CHANNEL-PROJECT-EDIT,STORE→BC-BUSINESS-CHANNEL-STORE-EDIT` | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_COLLABORATION    | `AUTHORIZATION_REQUIRED,BINDING_EDIT_NOT_ALLOWED` / RED_OPERATIONS_CHANNEL_GRANT                                  | server grant + expectedContextVersion                        |
| `updateOperationsOwnerBinding`                        | same shard / patch                                          | operations-admin | `REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_UPDATE` + same target map                                                                            | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_COLLABORATION    | `AUTHORIZATION_REQUIRED,BINDING_EDIT_NOT_ALLOWED,VERSION_CONFLICT` / RED_OPERATIONS_CHANNEL_GRANT                 | server grant + expectedContextVersion                        |
| `deleteOperationsOwnerBinding`                        | same shard / delete                                         | operations-admin | `REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_DELETE` + same target map                                                                            | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_COLLABORATION    | `AUTHORIZATION_REQUIRED,ADAPTER_UNBIND_REQUIRED` / RED_OPERATIONS_CHANNEL_GRANT                                   | server grant + expectedContextVersion                        |
| `getOperationsBusinessChannelTemplates`               | same shard / get                                            | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_BUSINESS_CHANNEL       | — / RED_OPERATIONS_SCOPE                                                                                          | groupWorkspaceKey + project context                          |
| `getOperationsStoreBusinessChannelTemplateCandidates` | same shard / get                                            | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_BUSINESS_CHANNEL       | — / RED_OPERATIONS_SCOPE                                                                                          | groupWorkspaceKey + store context                            |
| `createOperationsBusinessChannelTemplate`             | same shard / post                                           | operations-admin | `REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE` + `BC-BUSINESS-CHANNEL-PROJECT-EDIT`                                                        | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_BUSINESS_CHANNEL | `BUSINESS_SCOPE_EXCEEDED,DUPLICATE_CODE,VERSION_CONFLICT` / RED_OPERATIONS_TEMPLATE_GRANT                     | server grant + expectedContextVersion                        |
| `updateOperationsBusinessChannelTemplate`             | same shard / patch                                          | operations-admin | `REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE` + `BC-BUSINESS-CHANNEL-PROJECT-EDIT`                                                        | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_BUSINESS_CHANNEL | `IMMUTABLE_FIELD,DISABLED_OBJECT_NOT_EDITABLE,VERSION_CONFLICT` / RED_OPERATIONS_TEMPLATE_GRANT                   | server grant + expectedContextVersion                        |
| `transitionOperationsBusinessChannelTemplateStatus`   | same shard / post                                           | operations-admin | `REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS` + `BC-BUSINESS-CHANNEL-PROJECT-EDIT`                                             | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_BUSINESS_CHANNEL | `VERSION_CONFLICT` / RED_OPERATIONS_TEMPLATE_GRANT                                                                | server grant + expectedContextVersion                        |
| `getOperationsProjectBusinessChannels`                | same shard / get                                            | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_BUSINESS_CHANNEL       | — / RED_OPERATIONS_SCOPE                                                                                          | groupWorkspaceKey + project context                          |
| `getOperationsStoreBusinessChannels`                  | same shard / get                                            | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_BUSINESS_CHANNEL       | — / RED_OPERATIONS_SCOPE                                                                                          | groupWorkspaceKey + store context                            |
| `getOperationsBusinessChannelDetail`                  | same shard / get                                            | operations-admin | NONE                                                                                                                                          | OPERATIONS_OWNER_SCOPE / OWNER_RECHECK_BUSINESS_CHANNEL       | — / RED_OPERATIONS_SCOPE                                                                                          | groupWorkspaceKey + channel context                          |
| `createOperationsBusinessChannel`                     | same shard / post                                           | operations-admin | `REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL` + target map `PROJECT→BC-BUSINESS-CHANNEL-PROJECT-EDIT,STORE→BC-BUSINESS-CHANNEL-STORE-EDIT`         | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_BUSINESS_CHANNEL | `ORDER_KIND_MISMATCH,DINE_IN_FORM_MISMATCH,BINDING_NOT_EFFECTIVE,DUPLICATE_CODE,VERSION_CONFLICT` / RED_OPERATIONS_CHANNEL_GRANT | server grant + expectedContextVersion                        |
| `updateOperationsBusinessChannel`                     | same shard / patch                                          | operations-admin | `REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL` + same target map                                                                                    | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_BUSINESS_CHANNEL | `IMMUTABLE_FIELD,DISABLED_OBJECT_NOT_EDITABLE,VERSION_CONFLICT` / RED_OPERATIONS_CHANNEL_GRANT                    | server grant + expectedContextVersion                        |
| `transitionOperationsBusinessChannelStatus`           | same shard / post                                           | operations-admin | `REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS` + same target map                                                                         | OPERATIONS_OWNER_SCOPE_GRANT / OWNER_RECHECK_BUSINESS_CHANNEL | `DISABLED_OBJECT_NOT_EDITABLE,VERSION_CONFLICT` / RED_OPERATIONS_CHANNEL_GRANT                                    | server grant + expectedContextVersion                        |

Every operations write request carries the server-checked `groupWorkspaceKey`, target context and `expectedContextVersion`; the body cannot select a different target or capability. The two capability keys above are the only new operations writes; reads remain capability-free.

### 5.4 edge policy finite write matrix

| policy                           | first command                                                                       | second command                                                         | transaction                         | rollback fact                                          |
| -------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| binding logical delete           | collaboration `requestOrDeleteBinding`                                              | business-channel `returnChannelToDraftAfterBindingDeletion`            | same `REQUIRED`                     | any failure rolls both back; read binding row retained |
| external system/profile disable  | collaboration `transitionExternalSystemStatus` or `transitionProviderProfileStatus` | business-channel `applyExternalStopReason`                             | same `REQUIRED`                     | enablement and stop reason remain unchanged on failure |
| channel binding create/update    | business-channel create/update channel                                              | collaboration create/update binding only when command variant requires | same `REQUIRED` through edge policy | no channel with an uncommitted binding                 |
| normal template/channel mutation | business-channel owner command only                                                 | none                                                                   | `REQUIRED`                          | owner CAS/readback                                     |

`collaboration` cannot import `business-channel`; `business-channel` may depend on collaboration read API only. Edge wiring is the sole place that knows both write commands.

## 6. CP-05：generated wire 与双 admin frontend

### 6.1 五件门控

- **RECALL**：重开 IA P1-P6/O1-O5、UI interaction artifact、`frontend-capability-lookup.md`、`admin-ui-foundation/src/index.ts`、`descriptorRenderer.tsx`、`usePlatformOrganizationCandidates.ts`、`useOrganizationCandidates.ts`、`PlatformReadPage.tsx`、`WorkspaceManagementPage.tsx`。
- **可证伪失败条件**：app 手写共享 Drawer/list/query/overlay/descriptor behavior；generated wire 与 OpenAPI 不一致；operations 页面合并 platform shell；P6 用 page pager 冒充 cursor candidate；停用对象从 DOM 消失；UI 显示 token/UUID；O2 过滤掉 enabled `PLANNED`。
- **不变量**：OpenAPI 是 wire source；Java/TS generated files 只由 generator 产生；platform/operations app 保持独立；foundation 对接已有 exports；server owner 再核验所有 write；UI 只改善可用性不承担授权。
- **FORBID**：手改 `apps/frontend/*/src/app/api/generated/*`；在 app 内复制 `adminDrawerSurfaceProps`/overlay lock/list identity/HTTP protocol；用 `dataPath/tabKey/admittedShapes` 改写 contract；凭 URL/page key/session projection 生成 grant。
- **比例验证**：`scripts/generate/edge-codegen.mjs` 生成后运行 TypeScript/build；foundation focused tests；architecture static tests 加真实 red mutation；browser L2 只在单独授权后执行，不作为本批设计证明。

**我选了 contract descriptor→frontend adapter，而不是让 backend 返回 foundation `FieldDescriptor`，因为**后端必须稳定表达能力属性业务含义，前端仍需决定 tab/shape/data path；adapter 让两侧各自拥有正确的事实。

### 6.2 两 app 目标路径

```text
apps/frontend/platform-admin/src/features/external-collaboration/
  application/queries.ts
  ui/ExternalCollaborationPage.tsx
  ui/ExternalSystemDetail.tsx
  ui/ProviderProfileDetail.tsx
  ui/OwnerBindingList.tsx
  ui/OwnerBindingDetailDrawer.tsx
  ui/OwnerBindingFormDrawer.tsx
apps/frontend/operations-admin/src/features/business-channel/
  application/queries.ts
  ui/ProjectBusinessChannelPage.tsx
  ui/StoreBusinessChannelPage.tsx
  ui/BusinessChannelTemplateDetailDrawer.tsx
  ui/BusinessChannelTemplateDrawer.tsx
  ui/BusinessChannelEditDrawer.tsx
  ui/BusinessChannelDetailDrawer.tsx
  ui/BusinessChannelCreateDrawer.tsx
  ui/BusinessChannelList.tsx
```

这些是 capability-based 设计目标名，不含 Journey/BR/OP 编号。两个 app 各自拥有 route/store/baseApi/generated API/business copy；共享生命周期/Drawer/list/query/descriptor/observability/automation 只来自 foundation。

### 6.3 foundation 对接

| 需求                        | 现有 export/source                                                                                                                        | 设计动作                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| P1 树+详情                  | `WorkspaceScope`, `contextScopedQueryArgs`, `adminListState`, `useOverlayLock`；`PlatformReadPage.tsx` 的 `platform-master-detail-*` 结构 | 复用主从网格，不复制 shell；左侧 Card 承载搜索与外部系统树，右侧承载空态或外部系统/接入档案详情；不渲染页面级 owner 技术说明          |
| P4 Page / O1-O3-O5 bounded  | `usePageQuery`, `createPageQueryIdentity`, `adminListState`, `NameCodeText`, `ProTable`                                                               | P4 使用服务端独立 `bindingName/nodeQueryText/page/pageSize/sortKey/sortDirection` 与完整 `metadata.total`；绑定表搜索项分开，表格使用标准 ProTable、服务端分页/排序与 `scroll.x`；O1/O3/O5 使用 ProTable 关闭 search/pagination，仅把表头排序转换为 `sortKey/sortDirection` 后重新执行 bounded read；不做前端搜索、过滤或切片 |
| P5/O1-T/O4 detail Drawer    | `useDetailDrawer`, `adminDetailDescriptionsProps`, `adminDrawerSurfaceProps`, `useOverlayLock`                                            | 只读详情统一使用标准 Descriptions；详情 action 放在 Drawer header `extra`；停用对象仍可读                                             |
| P6/O2/O4 edit/create Drawer | `adminDrawerSurfaceProps`, `useDrawerFormLifecycle`, `useDirtyFormLock`, `useOverlayLock`                                                 | 表单使用独立 Drawer 与 sticky footer；详情 Drawer 关闭后才能进入编辑表单，不在详情内嵌 Form                                           |
| 动态能力属性                | `DescriptorFieldRenderer`, `FieldDescriptor`, `DESCRIPTOR_CONTROL_KINDS`                                                                  | adapter 生成 readonly FieldDescriptor，helpText 必填                                                                                  |
| P6/O2 候选                  | `usePlatformOrganizationCandidates`, `useOrganizationCandidates`, `useCursorCandidates`                                                   | 只扩 enum/candidateUsage；不新建候选 operation                                                                                        |
| 编码呈现                    | `formatNameCode`, `NameCodeText`                                                                                                          | 主实体名称/编码分列；关联实体按标准格式                                                                                               |
| query/HTTP/observability    | `contextScopedQueryArgs`, `platformHttpProtocol`, `createObservedBaseQuery`, `createSafeLogger`, `testId`                                 | 对每个新 generated client 接线                                                                                                        |

### 6.4 UI admission

```text
IA=written
INTERACTION=written
DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION
UI_IMPLEMENTATION_DESIGN_ADMISSION=ACCEPTED_TEXTUAL_IA
```

后端/契约/owner 详设与前端具体实现均按 Dexter 已接受的文字版 IA/interaction 继续实施。

## 7. CP-06：验收与 seed 设计

### 7.1 acceptance current denominator

当前仓源码静态分母由 `@AcceptanceScenario` 计数得到：

```text
IamAcceptanceScenarios=10
OrganizationAcceptanceScenarios=7
CommercialContractAcceptanceScenarios=4
AssetAcceptanceScenarios=2
CatalogAcceptanceScenarios=18
AuditAcceptanceScenarios=1
ExtensionAcceptanceScenarios=2
CURRENT_SOURCE_COUNT=44
HARD_LIMIT=80
PROPOSED_NEW_COUNT=16
PROJECTED_COUNT=60
```

`scripts/README.md` 与 `project-memory/operations/backend-acceptance.md` 的 28 是旧叙述；实现/验收前以 source count 和 active standard 为准，不修改旧记忆作为本批设计副作用。

### 7.2 新增场景设计

每条场景必须落在其正确业务 owner 的 domain `*AcceptanceScenarios.java` 中，使用真实 HTTP/fixture/request/business oracle；不在入口类堆业务。本批实现时新增 `CollaborationAcceptanceScenarios.java` 与 `BusinessChannelAcceptanceScenarios.java`，并在当前 `BackendAcceptanceScenarioCatalog` 显式登记两个 domain group；不新增 provider 壳、共享 SPI、退役的通用 scenario registry 或自动分母。生产 owner 仍分别是 collaboration 与 business-channel。

| scenario id（能力命名）                                 | owner file                                                                | identity                                              | fixture                                                                                                                                    | request                                                                           | businessOracle                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collaboration.catalog-readback`                        | `CollaborationAcceptanceScenarios.java`                                   | platform session + enabled workspace                  | checked-in external system/provider catalog with descriptor labels, option sources, capability classes and system/provider `catalogStatus` | real platform tree/detail HTTP read via existing route identity                   | readback returns the exact system/provider display facts, capability literals, both status levels and attribute read values without leaking technical refs; this is not a `response.ok`-only check |
| `collaboration.planned-profile-enablement`              | `CollaborationAcceptanceScenarios.java`（workspace/organization fixture） | enabled workspace + PLANNED provider                  | contract exists, enablement absent then enabled                                                                                            | platform enable + operations provider candidate read                              | PLANNED 可启用并进入候选；未启用 provider 不进候选                                                                                                                                                 |
| `collaboration.bindable-node-candidates`                | `CollaborationAcceptanceScenarios.java`                                   | provider profile + five node kinds                    | commercial-group/region/project/head-company/store owner facts                                                                             | real candidate HTTP per existing route identity                                   | 候选只列 bindableNodeTypes；node display names，不返回 UUID 文案                                                                                                                                   |
| `collaboration.platform-external-grant-create-rejected` | `CollaborationAcceptanceScenarios.java`                                   | platform session + enabled workspace                  | EXTERNAL_GRANT provider profile                                                                                                            | platform create request                                                           | typed `BINDING_EDIT_NOT_ALLOWED`; no platform binding row is created                                                                                                                               |
| `collaboration.internal-and-no-mapping`                 | `CollaborationAcceptanceScenarios.java`                                   | platform owner                                        | INTERNAL_MAPPING and NO_MAPPING bindings                                                                                                   | real create/update HTTP                                                           | internal mapping requires owner id; no mapping has no field and is effective                                                                                                                       |
| `collaboration.provider-binding-edit-policy`            | `CollaborationAcceptanceScenarios.java`                                   | platform session + owner readback                     | non-grant binding plus the adjacent EXTERNAL_GRANT rejection scenario                                                                      | platform read/write requests                                                      | non-grant binding follows its owner policy; EXTERNAL_GRANT platform create is rejected by the dedicated typed scenario                                                                             |
| `business-channel.same-store-two-owner-ids`             | `BusinessChannelAcceptanceScenarios.java`                                 | operations channel context                            | Meituan two rows different externalOwnerId; Eleme two rows same externalOwnerId                                                            | real channel/binding commands                                                     | all four rows succeed; no externalOwnerId unique constraint                                                                                                                                        |
| `collaboration.logical-delete-retains-row`              | `CollaborationAcceptanceScenarios.java`                                   | owner command identity                                | eligible binding with revoked timestamp                                                                                                    | delete command + detail/DB readback                                               | row remains, deletedAt non-null; physical delete path absent/rejected                                                                                                                              |
| `collaboration.adapter-unbind-required`                 | `CollaborationAcceptanceScenarios.java`                                   | adapter callback identity                             | requires-adapter binding with null externalRevokedAt                                                                                       | delete request, then callback/readback                                            | first request returns ADAPTER_UNBIND_REQUIRED; no logical delete before callback                                                                                                                   |
| `collaboration.binding-page-searches-node-name`         | `CollaborationAcceptanceScenarios.java`                                   | platform provider binding page                        | a real store binding with owner-resolved node display path                                                                                 | provider binding Page uses independent bindingName/nodeQueryText filters plus sort/page | both filters are independently echoed and effective; sort metadata and requested page size are read back from the real owner Page                                                                 |
| `business-channel.cascade-and-draft`                    | `BusinessChannelAcceptanceScenarios.java`                                 | operations project/store identity                     | template/channel/binding relations                                                                                                         | real disable/delete edge commands                                                 | external/template stop cascades; binding delete clears ref and returns draft                                                                                                                       |
| `business-channel.planned-provider-candidate`           | `BusinessChannelAcceptanceScenarios.java`                                 | operations project grant                              | enabled PLANNED provider + external template                                                                                               | candidate + template create                                                       | PLANNED candidate accepted; only enablement controls admission                                                                                                                                     |
| `business-channel.double-source-and-manual-stop`        | `BusinessChannelAcceptanceScenarios.java`                                 | operations project target                             | template and external stop reasons plus MANUAL                                                                                             | disable/restore mutations                                                         | removing one cascade reason does not open channel with another; MANUAL remains stopped                                                                                                             |
| `business-channel.store-template-scope`                 | `BusinessChannelAcceptanceScenarios.java`                                 | operations store target                               | project templates with PROJECT and STORE operator kinds plus an explicitly disabled STORE template                                         | store candidate/list/channel create, then disable the used STORE template and read the channel                                             | only project-owned, effective (`status=ENABLED`) STORE templates appear; PROJECT and disabled STORE templates do not appear as store candidates; an existing channel becomes `DISABLED` with `CASCADE_TEMPLATE`                                                                 |
| `business-channel.disabled-store-create`                | `BusinessChannelAcceptanceScenarios.java`                                 | operations store target                               | disabled store and valid project/template                                                                                                  | create binding/channel                                                            | creation succeeds; store status is not used as unrelated admission                                                                                                                                 |
| `business-channel.cross-node-read-authorization`        | `BusinessChannelAcceptanceScenarios.java`                                 | attacker selected store vs same-project foreign store | same-project sibling store with owner candidate                                                                                            | owner candidate read using foreign storeRef                                       | selected-store mismatch returns 403 and does not expose owner template ref                                                                                                                         |

`CatalogAcceptanceScenarios.java` 只承接现有 catalog domain 的业务场景；契约发布对重复系统、provider 越界 scope、空 label/helpText 的拒绝由 CP-01 的 contract validator 独占，不冒充真实 HTTP acceptance。实现时新增的 `CollaborationAcceptanceScenarios.java` 与 `BusinessChannelAcceptanceScenarios.java` 分别承接两个生产 owner 的业务断言，并在 `BackendAcceptanceScenarioCatalog` 登记；其中 `collaboration.catalog-readback` 通过真实 platform tree/detail HTTP 读取契约目录。此处扩展的是当前显式 domain group，不是已退役的 provider 壳、共享 SPI、JSON registry 或自动分母；当前实现前仍不改测试源码。

每条场景的 focused command：

```bash
scripts/test/backend-acceptance --operation <capability-named-scenario-id>
scripts/test/backend-acceptance --operation all
scripts/verify
```

动态执行不在本批授权范围；上面仅是后续 implementation/acceptance plan 的 verification intent。

### 7.3 红夹具与人工核验

| 缺陷族                           | red/control 方式                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| PLANNED 被拒绝                   | enabled PLANNED fixture；候选和启用必须成功，reject 视为失败                        |
| 停用隐藏/删除                    | 停用后 Page/Detail 仍含对象；缺失视为失败                                           |
| 置灰可保存                       | 直接 command 试保存 disabled object；必须 `DISABLED_OBJECT_NOT_EDITABLE`            |
| 凭证/token/authorizationRef 洩露 | response + DOM scan；出现任何值失败                                                 |
| 物理删除                         | delete 后查询行与 deletedAt；行消失失败                                             |
| 同店外部主体唯一性               | Meituan/Eleme paired fixture；两种 externalOwnerId 关系均成功                       |
| 两个 capability                  | 人工打开 capability registry，恰为项目/门店两个；不增第三个                         |
| edge owner boundary              | 人工 review imports/operation policy；collaboration 不直接写 channel                |
| 外部平台细节泄漏                 | 人工 review 主程序无 provider-specific URL/signature/callback parse/adapter DB read |

### 7.4 seed plan 设计（仅设计，不执行）

- 后续新增本域计划与 executor：`scripts/dev/external-collaboration-business-channel-seed-plan.mjs`、`scripts/dev/external-collaboration-business-channel-seed-executor.mjs`，沿用 `catalog-inventory-seed-plan.mjs`/executor 的可审计形态：revision、seedDatasets、ownerScopes、entities、relations、依赖顺序、planDigest、stage manifest/report 与 `STATIC_PLAN_ONLY`；本批实现脚本但不执行 seed。
- `contracts/collaboration/external-platform-catalog.json` 仅作为该计划的只读输入引用。契约目录/能力字典随代码交付，不放入 `catalog-inventory-seed-plan.mjs`，也不经 seed 写入契约态数据。
- fixture 覆盖五类可绑定节点：`COMMERCIAL_GROUP`、`REGION`、`PROJECT`、`HEAD_COMPANY`、`STORE`，以覆盖 BR-04 全部候选类型。
- fixture 包含万象城海底捞形态：一个门店、三条渠道、三条绑定，其中两条 `TAKEAWAY`、一条 `GROUP_BUY`；另含内部 `DINE_IN` 的 `POS`、`QR`、`KIOSK` 各一条。
- 保留并补齐既有场景：PLANNED 可启用、未启用 provider 不进候选、运营渠道授权创建 `EXTERNAL_GRANT` 后保持 pending/callback、platform 创建 `EXTERNAL_GRANT` 明确拒绝、INTERNAL_MAPPING、NO_MAPPING、两种 externalOwnerId 多实例、双停用来源 + MANUAL、binding 删除按接入类型回落（外部 DRAFT、内部 EFFECTIVE）与 DINE_IN 组合问题。
- 后续受管执行须把本域接入既有 `scripts/dev/r5-complete-seed-executor.mjs` 的父 manifest/report：stage 集合固定为 `[owner-command, external-collaboration-business-channel, catalog-inventory]`，顺序为 owner-command → 本域 executor → catalog-inventory；本域 executor 接收父 `managedDevRunId`，输出自己的 stage manifest/report，由父 runner 校验并汇总 business/cleanup/first failure，不允许旁路 `scripts/dev/seed --profile r5-full`。`start/restart` 不隐式 seed，reset/seed 是独立显式动作；business 与 cleanup 证据分开。

## 8. 34 条 BR 到 owner judgment point（一条不漏）

规格编号存在 BR-33 缺号；本表完整集合是 BR-01～BR-32、BR-34、BR-35，按原编号保留，不重编号。

| BR    | owner judgment point                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | contract loader/publish validator 拒绝同一 externalSystemCode 多定义；不进 HTTP                                                     |
| BR-02 | contract loader 校验 provider businessScope 是 external_system capability 子集；失败不发布                                          |
| BR-03 | operations channel binding create 校验开放类 capabilityClass 属 provider businessScope；platform create 只接受非开放类              |
| BR-04 | collaboration owner 校验 nodeType 属 provider bindableNodeTypes；失败 `NODE_TYPE_NOT_BINDABLE`                                      |
| BR-05 | business-channel owner 读取 provider/binding 后校验 orderKind 映射一致；失败 `ORDER_KIND_MISMATCH`                                  |
| BR-06 | template owner 校验 DINE_IN 只能 INTERNAL；失败 `DINE_IN_MUST_BE_INTERNAL`                                                          |
| BR-07 | template owner 校验 DINE_IN 必有 dineInForm、其它订单类型必须为空；失败 `DINE_IN_FORM_MISMATCH`                                     |
| BR-08 | owner 只读取 workspace enablement 判断 provider；未启用 `PROVIDER_NOT_ENABLED`                                                      |
| BR-09 | channel transition owner 要求 binding status effective；失败 `BINDING_NOT_EFFECTIVE`                                                |
| BR-10 | EXTERNAL_GRANT 只能由 adapter authorization callback 进入 effective；手工 mutation 返回 `AUTHORIZATION_REQUIRED`                    |
| BR-11 | platform owner 对 `EXTERNAL_GRANT` 禁止新增/编辑，仅保留删除/解绑相关命令；返回 `BINDING_EDIT_NOT_ALLOWED`                          |
| BR-12 | binding owner 按三种 authenticationKind 校验 externalOwnerId：NO_MAPPING 空、INTERNAL_MAPPING 创建必填、EXTERNAL_GRANT 创建可空回填 |
| BR-13 | read owner 不过滤停用下游对象；Page/Detail 保留置灰对象                                                                             |
| BR-14 | owner command 拒绝 disabled object 保存；`DISABLED_OBJECT_NOT_EDITABLE`                                                             |
| BR-15 | 同一模板允许多条渠道实例；模板编码按项目唯一、渠道编码按集团空间唯一，编码冲突返回 `DUPLICATE_CODE`                         |
| BR-16 | store template candidate owner 只返回上级项目维护、operatorKind STORE 且 status ENABLED 的有效模板；候选 UI 不重复展示状态列                                                       |
| BR-17 | 管理 candidate adapter 只返回 provider bindableNodeTypes 内节点；权限不从该字段推导                                                 |
| BR-18 | templateCode/channelCode、template 四维和 binding provider/node facts 创建后 immutable；变更 `IMMUTABLE_FIELD`                    |
| BR-19 | contract/edge/owner/TS read model/DOM 全链路禁止敏感值；红夹具检测                                                                  |
| BR-20 | capability registry 只登记 `BC-BUSINESS-CHANNEL-PROJECT-EDIT`、`BC-BUSINESS-CHANNEL-STORE-EDIT` 两个运营写 capability；读无独立 key |
| BR-21 | template/channel 无 delete route；binding delete route 对不允许对象 `DELETE_NOT_ALLOWED`                                            |
| BR-22 | 本规格对象只逻辑删除；owner readback 保留行/时间；不提供物理 delete                                                                 |
| BR-23 | REQUIRES_ADAPTER_UNBIND 缺 externalRevokedAt 返回 `ADAPTER_UNBIND_REQUIRED`；不写 deletedAt                                         |
| BR-24 | edge binding delete 同 REQUIRED 事务调用 channel detach；channel 回读 DRAFT/bindingRef null                                         |
| BR-25 | template/external disable edge policy 写相应 cascade stop reason 并保留对象                                                         |
| BR-26 | 恢复必须按 C-01 状态处理；本批不冻结算法，但 red fixture 必须防止单来源恢复误开双来源/MANUAL                                        |
| BR-27 | edge operation policy 显式列两个 owner commands；模块 import/SQL 禁止反向写                                                         |
| BR-28 | collaboration/adapter protocol boundary 不解析平台解绑 payload、不拼 URL/signature                                                  |
| BR-29 | open provider 每条 binding 一个 capability；business channel 关联一条 binding；同店两平台 fixture                                   |
| BR-30 | contract descriptor `label/helpText` 非空；contract publish reject                                                                  |
| BR-31 | channel/binding owner 不读取 store enabled status 作为创建门槛；停用门店 fixture 成功                                               |
| BR-32 | 主程序不直连外部；adapter 不读主库；人工 review + module/import boundary                                                            |
| BR-34 | operations paths 不提供非渠道 binding write；platform face 承担统一维护                                                             |
| BR-35 | `catalogStatus` 仅展示；contract 存在且 workspace enablement 开启即可启用/候选，PLANNED 红夹具必须成功                              |

## 9. declaration-transfer-consumption matrix

任何修改 operation/selector/header/capability/owner command/request/response/generated wire 前，先更新下表对应行，再重新生成 consumer；禁止单层修补。

| fact                             | declaration                                                                                   | transfer                                                                   | consumption                                                             | proof                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| external system/provider catalog | `contracts/collaboration/external-platform-catalog.json` + display fields                     | contract schema/loader → collaboration read → generated edge response      | P1/P2/P3/O2 descriptor/candidate; no raw capability/provider enum in UI | contract validator + generated readback + browser                           |
| capability attribute             | five-field contract descriptor + `displayName`/`attributeValueLabels` + capability read value | owner aggregate → generated wire → frontend adapter                        | P2 三列表格的属性/当前值/说明；机器值只留在 response policy 事实        | descriptor test + missing label/option source/primitive-control red fixture |
| workspace enablement             | OpenAPI status command + collaboration table                                                  | platform edge session → owner command → readback                           | P1/P2/P3/O2 candidate                                                   | typed error + PLANNED red fixture                                           |
| binding identity/state           | create/update/detail schema + provider/capability/node/status display fields                  | face edge → grant/platform fact → collaboration owner → generated response | P4/P5/P6/O4; display names only, opaque refs remain secondary facts     | callback/delete/readback + raw-enum scan                                    |
| node candidate                   | existing organization candidate declaration + enum extension                                  | backend existing candidate route → app hook                                | P6/O2 selector                                                          | cursor selectedId/total test                                                |
| template four dimensions         | business-channel request schema + `*DisplayName` response fields                              | operations edge → grant → owner row → generated wire                       | O1/O2/O3/O5 中文显示；request 仍使用机器事实                            | typed validation + owner readback + UI typecheck                            |
| channel status/stopReasons       | business-channel detail/transition schema + status/node/stop display fields                   | owner/edge cascade commands → generated response                           | O3/O4/O5 中文显示；停止原因集合仍保留机器事实                           | double-source + MANUAL fixture + raw-enum scan                              |
| operation authorization          | OpenAPI `x-required-platform-authorization` or capability declaration                         | generated registry → edge resolver → owner grant/recheck                   | command only                                                            | capability count + no client scope red                                      |
| typed problems                   | common problem schema + path error list                                                       | owner exception → edge problem mapping → generated client                  | form/list feedback                                                      | exact code/status scenarios                                                 |

## 10. 未决项处置

| 项目 | 当前状态                                 | 本批允许                                                       | 本批禁止                                      |
| ---- | ---------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| C-01 | `[未定]` 恢复 stopReasons 算法           | 设计 red fixture，保留 stopReasons 多来源事实                  | 冻结恢复 SQL/枚举/自动清理规则                |
| C-02 | `[未定]` nodeRef discriminator/类型对    | API 维持 nodeType 与 nodeRef 两个事实字段                      | 新造 polymorphic shared package、跨 owner FK  |
| C-03 | `[已收口]` channelCode 集团空间唯一       | owner 判重、可见独立列、读回与并发唯一索引                     | 不再作为 implementation 阻断                 |
| C-04 | `[未定]` unbind failure/in-progress      | 保留 requested/revoked facts和 typed `ADAPTER_UNBIND_REQUIRED` | 冻结 `UNBINDING/FAILED` public contract/state |
| C-08 | `[未定]` 规则是否不建模                  | 不建 DSL/规则表；具体判断停在 owner source gap                 | 用作者推导冒充 Dexter 业务裁决                |
| C-09 | `[未定]` 成本定量化                      | 记录变更面和复用路径                                           | 新建旧 compliance-control 数字 gate           |
| U-02 | `[已定·本轮不执行]` 外部单方 revoke 语义 | 只保留 OP-12 adapter callback 入口设计                         | 本批决定失效/删除的产品语义                   |

## 11. implementation readiness / stop rules

可进入 implementation 的共同前提：

1. Dexter 已接受本批 IA 与文字版 wireframe/interaction 裁定；
2. design independent review round 1/必要时 round 2 完成，作者逐 finding 做 dialectical intake；
3. OpenAPI/owner/migration/generated/frontend implementation target 由一个串行 CP 同步落地；
4. 每个实际变更点写入前后重新打开同一 IA、原始 BR、六维记忆、owning source 和可复用源码；
5. implementation authority 由 Dexter 单独授予。Claude GO 不升级为 implementation/DEV/seed/L2/Git 授权。

必须停止并向 Dexter 单条提问的条件：

- C-01/C-02/C-04/C-08/C-09 在某个具体 request/response/DB constraint 上不能继续保持未定；C-03 已按本规格收口，不得恢复为未决；
- owning source 与本设计的 owner、consumer face、Journey 或 transaction 发生冲突；
- 现有 generator/route registry 要求新增机制而不是扩展当前能力；
- 任何安全红线需要靠前端隐藏、默认账号、seed 或外部 mock 才能通过。

## 12. Verification intent

```bash
scripts/check/project-memory
scripts/check/agent-lifecycle
scripts/check/openapi-contracts
scripts/check/operation-handler-bindings
scripts/check/contract-face
scripts/check/ui-wireframe-traceability
scripts/verify
scripts/test/backend-acceptance --operation <capability-named-scenario-id>
scripts/test/backend-acceptance --operation all
```

本次名称/编码/状态修复已执行 contract validator、R5 materialize/codegen、backend compileJava、backend focused tests 与 frontend typecheck；受管 DEV restart 已执行，Flyway `V20260819.230000.003` 与 `V20260819.230000.004` 已应用，Spring Boot 与两个本地 Vite app 均已就绪。未执行 seed、reset、L2 或 UAT；上述 acceptance/运行命令仍是后续收口的验证意图，不得将当前静态、编译或 DEV 证据扩大解释为 L2/UAT 证据。
