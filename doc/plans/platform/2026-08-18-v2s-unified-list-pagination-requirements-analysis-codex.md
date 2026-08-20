# V2S 统一列表分页需求分析

日期：2026-08-18  
状态：需求分析（只读盘点；不是详设，不是实施计划）  
范围：`platform-admin`、`operations-admin`、两端公开 contract、当前业务后端 list/candidate read path  
本轮结论：当前仓库已经有可复用的分页形态，但没有形成跨 contract、owner 与前端表格的统一不变量；应建设“分页模式与查询语义”foundation，同时保留分页、游标、候选加载、闭集/有界详情四种不同形态。

## 1. 这份分析要解决什么

本报告回答两个问题：

1. 用户看到的“完整列表分页”应当具备哪些稳定行为；
2. 当前 contract、前端、后端中，哪些列表没有满足该行为，问题的完整分母是什么，以及后续应建设什么样的统一底座。

本报告不做以下事情：

- 不修改生产代码、contract、生成物或测试；
- 不规定具体类名、文件拆分、SQL builder 形态或实施顺序；
- 不把所有返回数组的接口都判成分页缺陷；
- 不运行 DEV、reset、seed、浏览器 L2、UAT 或 Testcontainers。

数字均为 2026-08-18 对当前工作树的静态复核结果。分母按成员清单保存，不能仅以聚合数字作为结论。

## 2. 正确样板与分页标准

### 2.1 正确样板的业务含义

正确样板是 `platform-admin` 的空间邀请列表，源码成员为
`apps/frontend/platform-admin/src/features/workspace-iam/ui/PlatformInvitationPanel.tsx` 的
`PlatformInvitationPanel`（分页配置约在 435 行）：

- 当前页有明确的结果范围，例如“第 1-10 条”；
- 有明确总数，例如“总共 20 条”；
- 有页码，可进入第 2 页；
- 有页大小选择器，例如“10 条/页”；
- 即使当前数据量较少，用户仍能看到完整分页控制，而不是由数据量阈值决定是否出现页大小选择；
- 列表是服务端分页，页码、页大小、筛选和排序都进入请求，不由前端把全量数据切片伪装成分页。

同一页面的空间账号列表只有“第 1-6 条/总共 6 条 1”，没有页大小选择器，因此它不是完整样板。它证明了 `total` 驱动页码并不等于分页交互完整。

对应的错误成员是 `apps/frontend/platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx` 的
`AccountsForWorkspace`；它只有 `{current, pageSize, total}`，没有显式 `showSizeChanger: true`。

### 2.2 面向管理员表格的标准

面向重复业务实体的管理表格，需求标准应固定为：

| 维度 | 必须满足的行为 |
|---|---|
| 结果范围 | 显示当前结果范围与总数；不能只显示页码，也不能只给 API 的 `total` 而不让用户看见总量 |
| 页码 | 显示当前页、上一页/下一页；当总数允许时可以跳页 |
| 页大小 | 始终提供页大小选择；默认 10，候选值至少覆盖 10、20、50、100；不由 `total > 50` 这种组件默认阈值决定 |
| 单页 | 不因只有一页就隐藏整个分页器；用户仍能看见列表范围和页大小语义 |
| 请求 | `page`、`pageSize`、筛选、排序是查询身份的一部分；改变筛选、排序、页大小或数据域时回到第 1 页 |
| 结果接纳 | 切换 tab、scope 或 query generation 时只接纳当前查询的结果；不能让旧请求回写新的分页状态 |
| 排序 | 服务端执行；必须有确定性排序和唯一的 tie-breaker，避免跨页重复或遗漏 |
| 总数 | `total` 必须与同一 scope、筛选和权限谓词下的成员集合一致；不能用当前页长度冒充总数 |
| 上限 | 后端必须校验并限制 `pageSize`；超过上限要有明确的 validation 语义，不能静默读全量 |
| 空态 | 空列表是“当前查询没有成员”，不是缺少分页协议；分页区域的显示由统一 foundation 决定 |

“始终显示页大小选择”是本需求的关键修正。Ant Design `Pagination` 的默认页大小是 10，页大小选择器的默认出现条件受总数阈值影响；如果产品要求稳定的管理员体验，不能把该关键行为交给默认值。Ant Design 官方 API 也将 `showSizeChanger`、`showTotal`、`hideOnSinglePage`、`current`、`pageSize` 与 `total` 分开定义，说明这些不是一个 `total` 字段可以自动替代的语义：[Pagination](https://ant.design/components/pagination/)。

### 2.3 不是所有集合都应套用表格分页

统一底座必须先区分集合形状：

1. **Page list**：用户浏览、筛选、排序和跳页的业务实体列表，采用上述管理员表格标准。
2. **Cursor list**：高增长、时间序列、追加型或候选下拉的连续加载集合，使用 opaque cursor、`hasNextPage`/`nextCursor` 和 page size；不能展示一个看似可任意跳转、实际只能顺序推进的假页码。Relay connection 规范把 opaque cursor 与 `pageInfo` 作为这种形态的核心：[GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm)。
3. **Bounded collection**：有明确 owner 上界的闭集或详情快照，例如支持的实体类型、账号最近 10 条登录历史、单个审计事件的字段变更；由 owner 和 contract 声明上界，不做机械分页。
4. **Tree / hierarchy**：层级导航使用树或明确的层级加载协议；不能为了凑“列表统一”改成平面分页表。

候选下拉虽然也是 list，但它的用户任务是搜索/选择，不是管理所有记录；应使用独立的 cursor/infinite candidate foundation，并且必须有 query debounce、selected-value preservation、scope 重验和去重。它不能成为管理表格 foundation 的最低公分母。

## 3. 盘点口径与分母

### 3.1 前端 production 分母

对两个 app 的 production `.tsx` 进行 JSX 物理实例扫描：

| 项目 | 数量 |
|---|---:|
| `ProTable` 物理实例 | 15 |
| `Table` 物理实例 | 14 |
| 表格物理实例合计 | 29 |
| 独立 `Pagination` | 2 |
| platform-admin 表格 surface | 12 |
| operations-admin 表格 surface | 18 |

物理实例和业务 surface 不完全相同：`PlatformReadPage` 的一个 ProTable 服务四个组织 tab；`BusinessEntityManagementPage` 的一个 ProTable 服务三类经营实体；`CatalogDictionaryDrawer` 的三个 Table 承载五个元数据实体。因此报告同时保存物理成员和业务成员，不能把物理实例数直接当作业务列表数。

### 3.2 Contract operation 分母

对两个 app 的公开 OpenAPI operation registry 与 path shard 的响应形状进行解析。先以当前
registry 的唯一 `GET operationId` 建立稳定总数，再解引用 200 响应 schema，统计响应根对象
直接承载的、任意字段名的数组属性。这个机械候选只是取证入口，不能直接当作分页分母：它会
同时收进 `definitions`、`organizations`、`roles`、`stores`、`phases` 等合法但语义不同的
集合，也会收进 detail、tree、manifest、session 和单次聚合中的根级数组。

- 当前 registry/path shard 的唯一 GET operation 为 83 个；旧的 99 个口径已作废；
- 当前“200 响应解引用后，root object 直接属性中至少有一个 `type: array`”的机械候选为
  72 个；旧的 64/63 个口径已作废。72 只表示根级数组形状被发现，不表示 72 个都需要分页；
- 语义受审边界为当前 50 个 operation：43 个真正需要分页协议的成员（Page 25、Page candidate
  9、Cursor 9），2 个主集合边界接口，另有 5 个数据库整体保存、业务整体读取/原子替换的
  `ExtensionDefinition` Detail 聚合；
- 因此当前列表/候选主分母为 45 个，其中 43 个需要分页、B01 是固定闭集、B02 已裁定退役。
  B02 退役后，目标运行面为 49 个 operation（43 个分页 + B01 闭集 + 5 个整体聚合 Detail）；
  5 个 ExtensionDefinition 不进入 45，也不因 `definitions[]` 可增长而被伪造为 Bounded。

这 45 个 operation 的成员清单见第 5 节：43 个分页成员见第 5.1–5.3 节，2 个主集合边界接口见第 5.4 节前两项。列表分母不是“所有 JSON 数组”，而是“用户或 owner 以集合形式浏览、搜索、选择或分页的响应”。
第 5.4 节还保存 5 个不进入 45 个主分母的 ExtensionDefinition Detail operation，因此本报告边界总清单为 50 个 operation（45 个主集合成员 + 5 个整体聚合 Detail 成员）。这些 Detail 成员不能因为包含 `definitions[]` 就被改造成分页列表。

机械候选的完整 operationId 清单如下。它只证明根级数组扫描没有丢成员，不能替代第 5 节的语义分母；其中已经明确属于 Detail、Tree、manifest、session 或单次聚合的成员，后续不得因为出现在这份清单里就强行分页：

```text
getCurrentPlatformSession
getOperationsBrandCatalogCopyCandidates
getOperationsCatalogDictionary
getOperationsLocalCatalogCopyCandidates
getOperationsProductionTags
getOperationsCatalogItems
getOperationsInventoryTargets
getOperationsCatalogItem
getOperationsCatalogNavigation
getExtensionDefinition
getExtensionEntityCatalog
getOperationsCatalogShapeManifest
getOperationsContract
getOperationsContractCandidates
getOperationsContractExtensionDefinition
getOperationsContracts
getOperationsEntityAuditHistory
getOperationsFixedStoreContracts
getOperationsInventoryTarget
getOperationsInventoryTargetBusinessHistory
getOperationsInventoryTargetConsumptionReferences
getOperationsInventoryTargetDiagnostics
getOperationsInventoryTargetLedger
getOperationsOrganizationBrands
getOperationsOrganizationBusinessEntityExtensionDefinition
getOperationsOrganizationCandidates
getOperationsOrganizationHeadCompanies
getOperationsOrganizationHeadCompany
getOperationsOrganizationHierarchy
getOperationsOrganizationHierarchyExtensionDefinition
getOperationsOrganizationStoreCandidates
getOperationsOrganizationStoreExtensionDefinition
getOperationsOrganizationStores
getOperationsOrganizationTenants
getOperationsWorkspaceGroupInvitationCandidates
getOperationsWorkspaceGroupInvitations
getOperationsWorkspaceGroupUser
getOperationsWorkspaceGroupUserAccount
getOperationsWorkspaceHeadCompanyInvitationCandidates
getOperationsWorkspaceHeadCompanyInvitations
getOperationsWorkspaceHeadCompanyUser
getOperationsWorkspaceHeadCompanyUserAccount
getOperationsWorkspaceProjectInvitationCandidates
getOperationsWorkspaceProjectInvitations
getOperationsWorkspaceProjectUser
getOperationsWorkspaceProjectUserAccount
getOperationsWorkspaceRegionInvitationCandidates
getOperationsWorkspaceRegionInvitations
getOperationsWorkspaceRegionUser
getOperationsWorkspaceRegionUserAccount
getOperationsWorkspaceSessionEntry
getOperationsWorkspaceStoreInvitationCandidates
getOperationsWorkspaceStoreInvitations
getOperationsWorkspaceStoreUser
getOperationsWorkspaceStoreUserAccount
getPlatformAdminPage
getPlatformContractOverviewDetail
getPlatformContractOverviewPage
getPlatformEntityAuditHistory
getPlatformOrganizationCandidates
getPlatformOrganizationHierarchyTree
getPlatformOrganizationOverviewDetail
getPlatformOrganizationOverviewPage
getPublicInvitationView
getWorkspaceAccount
getWorkspaceAccounts
getWorkspaceInvitation
getWorkspaceInvitationCandidates
getWorkspaceInvitations
getWorkspaceRole
getWorkspaceRoles
listPlatformGroupWorkspaces
```

### 3.3 后端分母

后端按 operation 对应的 owner task-read 路径复核 SQL/集合处理，而不是只搜索 `LIMIT` 字符串。判定重点是：

- 请求是否真的影响 SQL 的筛选、排序、LIMIT/OFFSET 或 cursor；
- 返回的 `total` 是否是完整匹配集合的 count；
- 是否读完整集合后在 Java 内存 `stream`/`subList` 分页；
- cursor 是否只是字段外形，实际却固定读前 100 条；
- 无分页集合是否有真实、稳定、owner 负责的上界。

### 3.4 五路调查路线

本次静态调查按互不重叠的五路执行并汇总去重：

1. contract registry/path shard：按 83 个 GET、根级数组机械候选 72 个、请求参数、operationId
   和实际用户/owner 任务建立 72 → 50 → 45 的成员清单；机械候选与语义分页分母分开保存；
2. platform-admin：逐个读取 ProTable、Table、List、Pagination 和对应 query hook；
3. operations-admin：逐个读取工作台、用户/合同/门店/库存/商品元数据列表及 cursor 控件；
4. backend owner：从 edge operation 追到 owner task-read，核对 request 是否进入 SQL、count、LIMIT/OFFSET/cursor 和内存切页；
5. foundation/行业规范：复核已有 `admin-ui-foundation` 能力与 AntD、ProTable、Relay、OData 的一手规范，区分可复用标准与不能合并的业务模式。

五路均为只读检查；并行 agent thread 配额在本轮不可用时，主 agent 以同样边界完成了未返回路线的源码复核，没有因配额失败缩小分母。

## 4. 当前问题总览

### 4.1 M-1：cursor contract 与 owner 实际行为不一致，可能静默丢失成员

当前发现 4 个 cursor operation 的 contract 形状与 owner 行为不一致：

- `getOperationsCatalogDictionary`
- `getOperationsProductionTags`
- `getOperationsLocalCatalogCopyCandidates`
- `getOperationsBrandCatalogCopyCandidates`

具体事实：

- `CatalogOwnerService.loadDictionaryListing` 查询匹配字典条目时不读取 request 的 cursor/pageSize，直接读取全部匹配行；响应 `cursor=null`、`total=entries.size()`；排序仍带 `display_order`，而当前产品语义已不需要 UI 排序。
- `ProductionTagOwnerService.read` 转给 `readTags` 时没有使用 request 的 cursor/pageSize；SQL 固定 `ORDER BY code LIMIT 100`，然后以实际返回的行数作为 `total` 并返回空 cursor。
- `CatalogOwnerService.copyCandidates` 的本地复制和品牌复制分支都固定 `LIMIT 100`，忽略 cursor；返回的 `total` 是被截断后的 entries 数量。

后果：

- 真实成员超过 100 时，客户端得到“总数就是 100”的错误事实；
- cursor 看起来存在但永远不能继续读取；
- 不同 owner 的同一类接口有的全量、有的固定截断、有的真实分页，调用方无法根据 contract 判断数据是否完整；
- 该问题不是单纯 UI 缺一个控件，而是“返回集合边界”和“contract 声明”不一致。

证据源：

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` 的 `copyCandidates`、`dictionary`、`loadDictionaryListing`；
- `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java` 的 `read`/`readTags`。

### 4.2 M-2：page candidate 先全量读取、内存过滤/排序/切片

已确认的同族形状至少出现在两个 owner task-read 路径：

- `StoreCandidateTaskReadService.candidatePage`：先得到 `List<Candidate> all`，再在 Java 里过滤、排序、`pageSlice`，并以 `all.size()` 作为 total；
- `WorkspaceUserService.candidates`：`ORGANIZATION` 分支先取得全部可见组织后内存过滤/排序/切页，`ROLE` 分支先读取全部角色后内存过滤/排序/切页。

`StoreCandidateTaskReadService` 还有一个由该形状诱发的语义补丁：当切片大小等于 `safeSize`
且选中项不在当前页时，用 `slice.set(safeSize - 1, selected)` 顶掉当前页最后一项。它会让当前页静默少展示一个本应属于该页的成员；真实数据库分页与显式 selected-value 保留协议应分别表达这两个需求，不应通过覆盖页内成员解决。

这类接口 contract 已经声明 `page/pageSize`，但分页发生在 SQL 之后。它当前可能在小数据量下“看起来正确”，却违反“查询需要什么就取什么”和“数据库先过滤、计数、排序、分页”的根本要求。

后果：

- candidate 数量增长时内存和网络成本随全量集合增长；
- scope 过滤与选择项保留逻辑容易出现全量读取后泄漏或排序漂移；
- 通过前端分页交互无法发现后端读全量，属于静态不变量必须直接识别的缺陷。

证据源：

- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java` 的 `candidatePage`、`pageSlice`；
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java` 的 `candidates`、`pageSlice`。

### 4.3 S-1：标准管理员表格没有统一的页大小可见性不变量

在前端当前 production 分母中，完整可分页的用户界面没有统一到邀请样板：

- platform-admin 8 个服务端分页 surface 中，邀请列表 1 个显式 `showSizeChanger: true`；其余 7 个没有稳定声明，账号列表因此出现用户截图中的不完整样板；
- operations-admin 的 `BusinessEntityManagementPage` 一个物理 ProTable 承载三类业务实体，三类业务列表均未显式开放页大小选择；
- 两个审计历史 Modal 使用手工 `Pagination` 且明确 `showSizeChanger={false}`；
- 其余 operations-admin 的标准 ProTable（用户、邀请、合同、门店资料、门店管理）已有显式页大小配置，应作为可复用正例，但当前没有 foundation 将该不变量集中承载。

按业务 surface 计，已确认缺失“始终可选页大小”的标准 Page 成员为 12 个：platform-admin 9 个、operations-admin 3 个。platform-admin 的 9 个是：

1. `listPlatformGroupWorkspaces`
2. `getPlatformAdminPage`
3. `getWorkspaceRoles`
4. `getWorkspaceAccounts`
5. `getPlatformOrganizationOverviewPage` 的 BRAND、TENANT、HEAD_COMPANY、STORE 四个 tab
6. `getPlatformContractOverviewPage`

前四项加上组织四个 tab 和合同项，合计 9 个业务成员；`getOperationsOrganizationCandidates` 是候选查询，不属于表格分页，不计入本条。

operations-admin 的 3 个是 `BusinessEntityManagementPage` 的经营主体、经营租户和总公司三类业务成员。其余 operations-admin 标准 ProTable 已显式配置页大小选择。

上面按“物理表格 + 业务 tab”展开时，platform-admin 的 6 个物理 Page ProTable 对应 9 个业务成员；组织概览的四个 tab共享一个物理表格。两个 audit pager 另作为下一节的独立问题，不与标准 Page 成员混计。为避免误读，后续详设必须同时保存物理分母和展开后的业务分母。

### 4.4 S-2：自定义上一页/下一页替代完整表格分页

以下 5 个业务 surface 使用 cursor stack 加自定义“上一页 / 第 N 页 / 下一页”或同等手工控制：

- `CatalogWorkbenchPage` 的商品主列表；
- `InventoryManagementPage` 的库存目标列表；
- `InventoryDetailDrawer` 的业务历史；
- `InventoryDetailDrawer` 的消费引用；
- `InventoryDetailDrawer` 的台账。

这不是说 cursor 本身错误：消费引用、台账和高增长历史应保留 cursor 协议。但商品主列表和库存目标列表是管理员浏览/筛选/排序的表格，当前 UI 既不能显示总数，也不能选择页大小，和正确样板不是同一用户任务。

foundation 不能把 cursor 强行包装成任意跳页的 page number；应明确区分“表格 Page list”和“连续 Cursor list”。商品主列表、库存目标列表是否转换为 page 协议，要由其业务数据规模、排序和契约语义在详设阶段逐项裁，不在本需求分析阶段假定所有 cursor 都改成 page。

### 4.5 S-3：商品元数据五个业务列表没有分页或上界声明

`CatalogDictionaryDrawer` 的三个物理 Table 承载以下五个业务实体：

- 商品标签；
- 销售单位；
- SKU 销售属性；
- SKU 销售属性值；
- 商品处理标签。

当前它们均 `pagination={false}`，且对应读取不带 cursor/pageSize。用户截图中商品标签和销售单位为空时看不出问题，但这只是空数据状态，不是列表协议完整。

业务量较低不能自动免除标准：即使商品处理标签通常每个门店不超过 20 个，也应在需求上明确它是“有界闭集/低基数但仍完整可读”，或者成为可分页列表；不能让 UI 形态由当前 seed 数量偶然决定。另一方面，SKU 属性与属性值是 master-detail 关系，不应为了套一个通用表格把父子实体拼成扁平的 page。

本节的前端问题业务分母为 24 个：12 个标准 Page 成员缺少始终可选页大小，2 个审计列表禁用页大小选择，5 个 cursor 表格使用不完整的手工页控件，5 个商品元数据表无分页/上界声明。物理 JSX 实例数与该数字不同，详见第 3.1 节。

`platform-admin` 的 `ExtensionsPage` 右侧字段定义表虽然也是一个物理 `ProTable` 且当前
`pagination={false}`，但它承载的是第 5.4 节 5 个 `*ExtensionDefinition` operation 的
detail/readback 集合，不能在尚未决定 bounded 证据前直接并入上述 24 个标准 Page 成员；它的
物理实例已计入第 3.1 节，详设必须把该 UI 与对应 contract/owner 一起收口。

## 5. Contract 完整成员清单

### 5.1 Page list：25 个

operations-admin（17 个）：

`getOperationsContracts`、`getOperationsEntityAuditHistory`、`getOperationsFixedStoreContracts`、`getOperationsOrganizationBrands`、`getOperationsOrganizationHeadCompanies`、`getOperationsOrganizationStores`、`getOperationsOrganizationTenants`、`getOperationsWorkspaceGroupInvitations`、`getOperationsWorkspaceGroupUser`、`getOperationsWorkspaceHeadCompanyInvitations`、`getOperationsWorkspaceHeadCompanyUser`、`getOperationsWorkspaceProjectInvitations`、`getOperationsWorkspaceProjectUser`、`getOperationsWorkspaceRegionInvitations`、`getOperationsWorkspaceRegionUser`、`getOperationsWorkspaceStoreInvitations`、`getOperationsWorkspaceStoreUser`。

platform-admin（8 个）：

`getPlatformAdminPage`、`getPlatformContractOverviewPage`、`getPlatformEntityAuditHistory`、`getPlatformOrganizationOverviewPage`、`getWorkspaceAccounts`、`getWorkspaceInvitations`、`getWorkspaceRoles`、`listPlatformGroupWorkspaces`。

### 5.2 Page candidate：9 个

`getOperationsContractCandidates`、`getOperationsOrganizationCandidates`、
`getOperationsWorkspaceGroupInvitationCandidates`、
`getOperationsWorkspaceHeadCompanyInvitationCandidates`、
`getOperationsWorkspaceProjectInvitationCandidates`、
`getOperationsWorkspaceRegionInvitationCandidates`、
`getOperationsWorkspaceStoreInvitationCandidates`、
`getPlatformOrganizationCandidates`、`getWorkspaceInvitationCandidates`。

候选接口的页面协议不等于管理表格协议；但上面第 4.2 节的两个 owner 已证明 page candidate 也可能在内存全量分页，故候选 foundation 必须有独立的数据库分页不变量。

### 5.3 Cursor：9 个

`getOperationsBrandCatalogCopyCandidates`、`getOperationsCatalogDictionary`、`getOperationsCatalogItems`、`getOperationsInventoryTargetBusinessHistory`、`getOperationsInventoryTargetConsumptionReferences`、`getOperationsInventoryTargetLedger`、`getOperationsInventoryTargets`、`getOperationsLocalCatalogCopyCandidates`、`getOperationsProductionTags`。

其中已确认真实 cursor SQL/读取边界的 5 个是商品主列表、库存目标列表和库存详情的业务历史/消费引用/台账；已确认 cursor 假实现的 4 个见 M-1。

### 5.4 无分页边界、整体聚合与退役边界：7 个

- `getExtensionEntityCatalog`：返回 `ExtensionDefinitionService.MANAGEMENT_HOST_TYPES` 的固定 8 类支持实体，是闭集目录，不应套表格分页；但 contract/owner 应明确这是闭集，而不是普通 `Page`。
- `getOperationsOrganizationStoreCandidates`：contract 不带 page/pageSize，owner 的 `StoreCandidateTaskReadService.candidates` 一次返回 projects、brands、tenants、headCompanies 多组数组；当前源码扫描没有发现 operations-admin 手写消费方，只有生成 client/edge binding。Dexter 已裁定退役；实施时必须按最后消费者删除 contract、controller/edge binding、owner 方法与 generated consumers，并保留反向 proof。它不进入目标分页 foundation，也不得改成 Bounded。
- `getOperationsOrganizationStoreExtensionDefinition`、`getOperationsOrganizationHierarchyExtensionDefinition`、`getOperationsOrganizationBusinessEntityExtensionDefinition`、`getOperationsContractExtensionDefinition`、`getExtensionDefinition`：这些 operation 返回一个宿主的完整 ExtensionDefinition 聚合。数据库按聚合整体保存，业务也按聚合整体读取、编辑和原子替换；它们不是逐行浏览的列表，因此不需要 page/cursor，也不因 `definitions[]` 可增长就伪造 Bounded。详设只需证明完整聚合的 owner/消费者闭包、单次读取与原子替换语义；如果未来 Journey 变成逐行浏览，必须新开列表 operation，而不是改写这五个 Detail operation。

## 6. 后端/contract 反例与应有边界

### 6.1 可保留的非分页反例

以下不是分页缺陷，但必须有来源或上界证据：

- 扩展实体目录固定 8 个 `MANAGEMENT_HOST_TYPES`；
- 扩展字段定义 detail/readback 的 `definitions[]` 属于数据库整体保存、业务整体读取/编辑/原子替换的聚合；它不进入 Page/Cursor/Bounded 分页分类，也不需要为分页目的臆造人工上界。必须证明的是完整聚合的 owner/消费者闭包、一次读取与原子替换语义；若未来 Journey 改成逐行浏览，另开列表 operation。
- 账号详情 authentication history 明确取最新 10 条；
- 审计事件详情的 `changes[]` 是单个事件的字段差异，不是跨事件列表；
- 组织 hierarchy 是树，不是平面实体列表；
- 候选下拉是搜索/选择 surface，不是 CRUD 管理表。

### 6.2 不能接受的伪分页/隐式截断

以下形状一律不能作为统一 foundation 的合法实现：

- contract 有 cursor/pageSize，但 owner 忽略请求；
- SQL 固定 `LIMIT 100`，返回 `cursor=null`，再把当前页长度写入 `total`；
- SQL 读全 scope 后 Java `filter/sort/subList`，再声称返回 page；
- 没有稳定唯一 tie-breaker 的 `ORDER BY code` 配合 page/cursor；
- 前端显示页码但总数来自当前页长度；
- 前端用 `pagination={false}` 加自定义上一页/下一页承载本应支持筛选、排序、页大小的管理员表格；
- 用某次 seed 恰好少于 20 条来证明“无需分页”。

## 7. 统一列表分页 foundation 的需求方向

### 7.1 目标

foundation 的目标不是让所有查询都长成同一个 DTO，而是让每个集合在 contract、owner 与 UI 上明确选择正确的读取模式，并把模式的不可变规则集中提供：

- “表格分页完整”不再依赖每个页面作者记住 AntD 默认阈值；
- “cursor 连续加载”不再伪装成任意跳页；
- “有界闭集”不再被机械分页，也不再无证据全量返回；
- 后端分页不再因 owner 手写遗漏而退化成全量读取或固定截断；
- page/cursor 的 total、排序、scope 与缓存身份有统一的可检查语义。

### 7.2 Contract 需求

建议建立两个可复用的协议族，而不是一个最低公分母：

**Page envelope**（管理表格）：

- `items`：当前页成员；
- `page`、`pageSize`、`total`：与当前筛选、排序、scope 完全一致；
- 可选的已确认排序回显；
- pageSize 有明确最大值，不能由 endpoint 自己随意扩大；
- 当前请求的 scope/context version 必须仍由业务 contract 保留，不能被“统一分页”吞掉。

**Cursor envelope**（候选/高增长集合）：

- `items`；
- opaque `nextCursor` 或等价的 `hasNextPage`；
- pageSize 有界；
- cursor 必须绑定查询身份、scope、排序版本和必要的 generation，不能跨筛选复用；
- 若保留 `total`，必须说明它是同一过滤集合的 count，不能用当前页长度填充。

`Page` 与 `Cursor` 必须是显式的 discriminated mode。不能用一个字段名叫 `cursor` 的空值来掩盖“其实未分页”，也不能在前端把 cursor stack 当作任意页码。

### 7.3 后端 owner 需求

所有纳入 Page/Cursor 的 owner task-read 都必须满足：

- scope、权限、状态、用户筛选在 count 和 page/cursor 之前相同地生效；
- 数据库先做过滤、排序和边界读取；
- 排序有唯一 tie-breaker；
- page size/cursor 输入有统一校验；
- `total` 不能由当前页长度推导；
- 不允许全量读取后在 Java 内存 `filter/sort/subList`；
- owner 保留其事实主权和关系闭包，不由通用 repository 猜测跨 owner join；
- 只在多个消费者需要完全相同 scope、过滤、排序、生命周期与 freshness 的字段闭包时共享一次 full projection；不同关系闭包不得为了复用而强行合并。

foundation 可以提供值校验、page/cursor 结果值对象、排序 token 解析和可验证的 SQL 片段约束；不应引入一个隐藏 owner 谓词、授权或关系事实的万能 repository。

### 7.4 前端 foundation 需求

前端应基于仓内已采用的 AntD/ProTable，而不是再造分页控件：

- 为标准管理表格统一提供 `showTotal`、`showSizeChanger`、`hideOnSinglePage=false`、默认 pageSize 及选项；
- 统一处理筛选、排序、pageSize、scope/tab 切换时回到第一页；
- 每个 tab/master-detail 维护独立 query identity；
- RTK query 结果读取使用 `currentData`，避免缓存旧 query 回写当前 surface；
- loading、error、empty 与 stale 结果保持分页上下文，不以旧页数据冒充新查询；
- cursor candidate 继续复用 `useCursorCandidates`，不要把候选下拉改成管理表格 pager；
- `useCursorStack` 不能承担需要任意页码跳转的标准 Table surface；
- 页面只声明业务列、过滤和 operation，通用分页行为由 foundation 统一接管。

ProTable 官方文档的 `request` 约定本身以 `current/pageSize` 驱动请求并要求返回 `total`，适合承载 Page mode：[ProTable](https://procomponents.ant.design/en-US/components/table/)。因此当前仓库已有组件栈足够承载需求，不需要为了分页再引入 OData、GraphQL 或新 UI 库。

### 7.5 查询复用边界

foundation 不能以“少写一个接口”为目标合并不同字段闭包：

- A、B 都需要 X 的同一组字段、同一 scope、同一 freshness，允许共享一个 X full projection；
- C 需要 X+Y 的另一组关系字段，不能因为也包含 X 就复用 A 的查询；
- 详情的主实体、懒加载 history/reference、候选搜索、闭集目录是不同 query surface，不能用一个大 response 统一塞回前端；
- 任何跨 owner 组合必须保留目标 owner 的读取边界，不由分页 foundation 取得写、锁、事务或 FK 权限。

### 7.6 行业标准的采用边界

行业标准提供的是可复用概念，不是要求本仓整套替换：

- Ant Design/ProTable：直接复用现有依赖和已验证样板；
- Relay：采用 opaque cursor、`hasNextPage`/`nextCursor` 的概念，不引入 GraphQL；
- OData：`$top/$skip/$count/$orderby` 体现 page 查询的通用语义，但本仓保留已有 generated OpenAPI 与 owner-specific filter enums，不整体迁移 OData；参考 [OData v4.02 URL Conventions](https://docs.oasis-open.org/odata/odata/v4.02/odata-v4.02-part2-url-conventions.html)。

## 8. 需求验收判据（供后续详设使用）

详设阶段必须把以下判据逐成员落到 contract、owner 和 UI：

1. 43 个分页主成员逐一标为 Page 或 Cursor，并有 owning source；B01 逐一给出 Bounded，B02 逐一给出 RETIRED；5 个 ExtensionDefinition 是主分母外的整体聚合 Detail，不进入分页分类；Tree/Detail 是主分母外的形态说明。机械候选 72 与语义分母 50/45 必须分别可复算，不能再把旧 99/64/63 当作当前事实；
2. 4 个伪 cursor 成员不能再同时满足“返回空 cursor”和“声称完整 total”；
3. 2 个已确认的内存分页 owner family 不得继续在 Java `filter/sort/subList` 后返回 page；
4. 标准管理表格的完整业务成员必须始终显示页大小选择、范围/总数和页码；
5. 5 个商品元数据列表必须明确是 bounded 还是 Page，不能继续由当前数据量默认为无分页；
6. 5 个 cursor table surface 必须验证 cursor 的连续性、边界、排序和 scope 隔离；
7. 第 5.4 节的 7 个当前边界成员必须按形态证明：B01 提供固定闭集上界，B02 按退役路径完成最后消费者删除，B03–B07 提供整体保存/整体读取、完整消费者闭包和原子替换证据，不得为了分页而虚构上界；
8. 所有 Page/Cursor backend path 必须证明数据库先过滤/排序/边界读取，count 与成员谓词一致；
9. foundation 的测试必须覆盖：单页仍显示、切换 pageSize、筛选重置页码、排序重置页码、total 与当前过滤一致、旧 query 不回写、cursor 不重复、不跨 query 复用；
10. Page/Cursor 成员不得用全量返回冒充分页；只有 Bounded 成员必须写出真实上界。整体保存、整体读取的 Detail 成员不需要分页或人工上界，但必须写出完整聚合消费者闭包、原子读写语义和未来若改成逐行浏览时新开列表 operation 的责任边界；不得把 Detail 改标为 Bounded。

## 9. 反例复核与剩余未知项

本轮已主动排除：

- 组织树和导航树；
- Select candidate 的连续加载；
- 扩展实体 8 类闭集；
- 账号详情最近 10 条登录历史；
- 单个审计事件的 change set；
- 生成 client、测试源码和 Heritage 快照。

仍需在详设阶段逐项核实、但本报告不擅自定产品语义的一类边界：

- 审计 history Modal 已由 Dexter 裁定提供与主表一致的 pageSize selector；详设和实施计划必须把它作为标准 Page surface，不再保留固定条数例外。
- 上述 5 个 `*ExtensionDefinition` 的 `definitions[]` 属于数据库整体保存、业务整体读取的完整聚合；它们不需要分页，也不需要为分页目的臆造 owner 上界。详设只需证明完整消费者闭包、一次读取和原子替换语义；如果未来 Journey 变成逐行浏览，必须新开独立列表 operation。本报告不把它们改判为 Page 或 Bounded。

## 10. 结论

当前问题不是“某个分页控件少写一个属性”，而是三层对同一个集合的边界表达不一致：

- contract 有 page/cursor，但 owner 忽略输入或固定截断；
- owner 声称 page，但实际全量读取后内存切片；
- 前端标准表格、手工 cursor、无分页元数据混在一起，没有按用户任务和集合增长形状做显式分类。

因此，后续详设应以“模式分类 + 每个成员的边界证明”为入口，建设小而明确的 Page/Cursor/Bounded foundation；不应把所有数组统一改成分页，也不应把所有 cursor 统一改成 page。当前报告没有代码修改，也没有动态验收结论。
