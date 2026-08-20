# 统一列表分页：implementation-facing 详设与串行实施计划

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

- 文档状态：IMPLEMENTATION_DESIGN_DRAFT_AWAITING_DESIGN_REVIEW
- 日期：2026-08-18
- 作者：Codex
- 本轮授权：只写详设、实施计划并完成设计期独立盲审；不实施
- 需求分析正本：doc/plans/platform/2026-08-18-v2s-unified-list-pagination-requirements-analysis-codex.md
- 需求分析复核：doc/review/platform/2026-08-18-v2s-unified-list-pagination-requirements-review-claude.md

### 设计修订记录

2026-08-18：根据 Dexter 的业务裁定，数据库按聚合整体保存、业务按聚合整体读取的对象归为非分页 Detail；因此五个 ExtensionDefinition operation 不进入 Page/Cursor/Bounded 分页分类。同步修正分母口径：43 个分页成员 + 2 个主集合边界 = 45 个主集合成员，另有 5 个整体聚合 Detail，7 个边界行合计对应 50 个受审 operation。

## 0. 输入、证据档位与范围

本详设以当前源码和当前仓内文档为准，不把评审中的数字当成无需复核的事实。进入设计前已重开：

| 输入 | 用途 |
|---|---|
| AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md | owner、契约、双后台、验证与仓库边界 |
| doc/platform/implementation-task-template.md | RECALL、四类停机、自主选形态与真实 proof 纪律 |
| doc/platform/agent-operating-model.md | Codex 自设计、自实施与实施前独立盲审模型 |
| doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md | backend-acceptance 的 identity、fixture、request、businessOracle、CONTRACT/BUSINESS/cleanup 输出 |
| doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md | fresh 独立子 agent、两阶段盲审、两轮上限 |
| doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md | ProTable/AntD 既有列表表面与 size="small" |
| doc/decisions/2026-08-17-v2s-catalog-metadata-central-modal.md | 商品元数据四个顶层实体、无 UI 排序、独立 Tab/表单与 owner 边界 |
| project-memory/decisions/http-crud-efficiency-design-redlines.md | owner-local read、契约闭合、生成链、禁止万能 repository |
| project-memory/practices/read-model-granularity.md | 按业务任务事实闭集复用读模型，不按页面复制或拿大详情冒充列表 |
| project-memory/practices/set-interaction-not-n-times-single.md | 不得全 scope 读取后在 Java 内存筛 target，不得把集合读退化为 N 次单体读 |
| project-memory/practices/ordering-only-for-consumer-facing.md | 管理/配置列表不凭空增加排序语义 |
| project-memory/practices/reuse-projection-within-request.md | 只有 scope、授权、新鲜度、闭集相同才复用 projection |
| contracts/registry/operation-handler-bindings.json | 当前 operation、owner、adapter、request/response、route 的机械来源 |
| 当前 owner 源码 | CatalogOwnerService、ProductionTagOwnerService、StoreCandidateTaskReadService、WorkspaceUserService、各 registry 对应 owner service |
| 当前前端源码 | 两个 app 的 ProTable、普通 Table、独立 Pagination 及游标消费方 |

### 0.1 本轮不做

- 不运行、不修改 DEV、reset、seed、HTTP、浏览器 L2、UAT。
- 不在本轮删除数据库列、添加 migration、添加 FK、创建 read model 或改变数据模型。
- 不把所有数组响应机械改成 Page，不把 Page 与 Cursor 强行统一成一种协议。
- 不创建万能 repository、跨 owner BFF、通用 SQL builder；分页 foundation 不取得写、锁、事务或 FK 权限。
- `getOperationsOrganizationStoreCandidates` 按 Dexter 裁定退役；实施时删除其完整 contract/owner/edge/generated consumer 链路，不改成分页或 Bounded。
- `PlatformAuditHistoryModal` 与 `OperationsAuditHistoryModal` 按 Dexter 裁定统一提供 pageSize 选择，作为标准 Page surface。
- 不把 ExtensionDefinition 的完整字段定义聚合误称为 Bounded；它的当前 owner 没有字段数量上限。

### 0.2 当前证据档位

本文件的数字和边界是契约/源码静态证据。没有任何本轮动态证据。实施后的 backend-acceptance 才能产出 BUSINESS verdict；模块 Gradle test、静态门或 response.ok 不能替代它。

## 1. 业务任务、阶段意图与推荐方向

### 1.1 用户真正要完成的事

两个管理后台的用户在一个列表任务中需要：

1. 看到当前过滤条件下的真实总数；
2. 看清当前页的范围，例如“第 1-10 条/总共 20 条”；
3. 在允许的列表上切换 pageSize、页码或稳定地推进下一枚 cursor；
4. 改变筛选、排序、scope、权限上下文后，不看到旧查询结果回写；
5. 不因当前 seed 数据少而把无界 SQL、固定 LIMIT 100 或 Java 全量切片误判为正确。

所以本课题的核心不是“给控件加一个分页 prop”，而是让契约声明、owner SQL 边界、前端查询状态和业务验证对同一个集合边界负责。

### 1.2 已比较的方案

| 方案 | 处理方式 | 失去的东西 | 结论 |
|---|---|---|---|
| A：逐页面补 pagination | 每个页面自己拼请求、total、重置和缓存键 | 重复规则继续增长；伪 cursor 与 Java 全量读容易漏掉 | 拒绝 |
| B：一个万能分页 repository/endpoint | 所有 owner 复用一套查询和响应 | 破坏 owner 事实主权、scope/授权闭集和不同的 Page/Cursor/Bounded/Detail 语义 | 拒绝 |
| C：按三种集合模式建立小型 foundation，owner 只提供本地 typed read | Page 用 page/pageSize；Cursor 用 opaque cursor/stack；Bounded 需显式上界；Detail 不伪装为列表 | 需要一次契约、owner、生成链和前端基础能力的闭合 | 推荐 |

推荐 C 的理由：它复用 AntD/ProTable 与现有 generated operation 路径，只收敛重复的状态、缓存和验证语义；SQL 仍由 owner 写，跨 owner 读仍由目标 owner 的 task read 提供。

### 1.3 产品/Journey 裁定已收口

Dexter 已作出两项产品/Journey 决定，本详设按以下目标实施：

1. `PlatformAuditHistoryModal` 与 `OperationsAuditHistoryModal` 统一提供 pageSize 选择，按标准 Page surface 处理，不保留固定条数例外。
2. `getOperationsOrganizationStoreCandidates` 退役。实施时按最后消费者反向删除 contract、controller/edge binding、owner 方法与 generated consumers；不把它改成 Page 或 Bounded，也不为它新增替代用户 surface。

除上述已收口事项外，本详设不把技术实现形态上抛给 Dexter。若源码与某一不变量冲突，按 agent-operating-model.md 修改本详设并登记理由；只有产品/Journey、范围/批次、破坏性或不可逆动作才需要问 Dexter。

## 2. 统一集合模式与全局不变量

### 2.1 模式定义

| 模式 | 适用任务 | 请求边界 | 响应边界 | 前端表面 |
|---|---|---|---|---|
| Page | 需要任意页码跳转的标准表格 | page、pageSize、契约枚举内的 filter/sort | 当前页 items、过滤后的 total、稳定 query identity | AntD Table/ProTable 的标准 pagination |
| Cursor | 大集合、游标已有业务语义或手工前后推进 | opaque cursor、pageSize、filter/sort | 当前页 items、可继续的 nextCursor、完整匹配 total | foundation 的 cursor surface；不得伪装成任意页码 Table |
| Bounded | 闭集且 owner 有明确上界 | 无分页参数 | 完整集合；上界、消费者闭包、增长责任人必须写在设计中 | 小型闭集列表或固定选择器 |
| Detail | 描述一个聚合/主实体的完整任务读 | 实体身份与 scope | 完整聚合，不宣称为列表分页 | 详情/主从编辑，不进入 45 个列表模式分母 |

“低基数”“当前只有几条”不是 Bounded 依据。没有可引用上界就不能声称 Bounded。

统一边界规则：如果数据库以一个聚合整体保存，业务又以同一聚合整体读取、编辑或原子替换，
则无论 JSON 内部是否有数组字段，都归为非分页 Detail；不得为了满足“所有数组都分页”而
拆成 Page/Cursor，也不得为分页目的臆造人工上界。该规则不是 ExtensionDefinition 的特例，
任何后续根级数组都必须先证明它是逐行浏览/选择任务，才可进入 Page/Cursor；否则保持 Detail，
并验证一次完整读取、消费者闭包和原子读写语义。

### 2.2 所有 Page/Cursor owner 必须满足的不变量

1. 过滤、scope、权限、排序、计数、分页在 owner 查询边界内完成；Java 不持有全量集合再切片。
2. total 是当前过滤条件下的完整匹配 count，不是当前页长度；同一 query identity 的 cursor 不得重复、遗漏或跨 scope 泄漏。
3. 排序必须是服务端稳定排序，并带足够 tie-breaker；前端不得用 Array.sort 代替 owner 排序。
4. Page 的 page/pageSize/filter/sort 改变必须生成新 query identity；Cursor 的 cursor 只能在同一 scope/filter/sort/pageSize identity 下推进。
5. 异步旧响应不得回写到新 query identity；Tab、scope、权限和 owner 不同的读模型不得共享缓存键。
6. 任何跨 owner 组合仍由目标 owner 提供 typed task read；foundation 不读表、不持有事务、不推导写权限。
7. 契约声明的模式、请求字段、响应字段和 owner 的真实边界必须通过静态 gate 逐 operation 对账。

### 2.3 全局 FORBID

- 不保留“契约有 cursor/total、owner 忽略并返回 null/固定 100”的伪 cursor。
- 不保留 Java 全量 List、pageSlice 或“把 selected 顶替到最后一条”的补丁。
- 不在 frontend app 另造已有 foundation 的查询状态、overlay、HTTP 生命周期或缓存行为。
- 不以统一 repository、跨 schema convenience query、controller 事务或 edge 组装替代 owner。
- 不为通过门而加入重复属性、固定实例数量、临时 fallback、兼容分支或静默截断。
- 不把 ExtensionDefinition 的 definitions[] 或其他 Detail 聚合伪称 Bounded。
- 不反转 Dexter 已收口的产品/Journey 语义：审计 history Modal 统一 Page/pageSize，B02 退役。

## 3. 分母与成员逐条闭合

### 3.1 分母口径

当前静态复核得到：

- production frontend 物理 ProTable：15 个，来自 14 个 .tsx 文件；
- production frontend 物理普通 Table：14 个，来自 6 个 .tsx 文件；
- 独立 Pagination：2 个；
- 当前 registry/path shard 的唯一 GET operation 为 83 个；旧的 99 个口径已作废；
- 按“200 响应 `$ref` 解引用后，root object 的直接属性中至少有一个 `type: array`”的机械判定式，当前得到 72 个根级数组候选。该数只用于证明扫描覆盖，不是分页分母；它会包含 `definitions`、`organizations`、`roles`、`stores`、`phases` 以及 detail/tree/manifest/session/聚合根级数组；旧的 64/63 个口径已作废；
- 按 operation 意图、消费者和 owner 边界去重后，语义受审 operation 为 50 个：45 个主集合成员（其中 43 个是分页成员：25 个 Page、9 个 Page candidate、9 个 Cursor；另有 2 个非分页主集合边界）加 5 个整体聚合 Detail；
- 7 个当前边界成员单独列出：其中 B01/B02 属于上述 45 个主集合成员，B03-B07 是额外的 5 个整体保存/整体读取 ExtensionDefinition Detail 聚合。B02 退役后，目标运行面为 49 个 operation（43 个分页 + B01 闭集 + B03-B07 五个 Detail）。
  因此本详设既保存 50 个当前受审 operation 的基线，也明确退役后的目标集合，不把已删除的 B02 继续当作运行期分页成员。

`options`、`capabilityKeys`、`roleNames`、`changes` 等深层 detail/readback 数组不进入根级机械候选；但根级数组也不自动进入语义分页分母。43 个分页主成员逐行列出；B01、B02、B03、B04、B05、B06、B07 也逐行列出，不能用“同族同上”替代。

### 3.2 43 个分页主成员矩阵

表中“当前边界事实”是源码/契约现状；“目标边界事实”是本详设必须满足的状态。owning source 同时给出当前 registry adapter 与 owner 模块；实施时 CP 必须再打开具体 handler 方法，不得只凭 adapter 类名施工。

#### Page：25 个

| ID | operationId | owning source | 当前边界事实 | 目标边界事实 | CP |
|---|---|---|---|---|---|
| P01 | getOperationsContracts | registry；store.contract.application.GetOperationsContractsOperation；contract module | StoreContractPage 已有分页语义，但请求/owner SQL边界需按当前源码复核 | Page；scope/filter/sort/count/limit-offset 由 contract owner 完成 | CP-05 |
| P02 | getOperationsEntityAuditHistory | registry；platform.workspace.application.GetOperationsEntityAuditHistoryOperation；platform-workspace module | AuditHistoryPage；Modal 当前缺少统一 pageSize 选择 | Page；owner/entity filter/count 与 Modal pageSize 闭合 | CP-08 |
| P03 | getOperationsFixedStoreContracts | registry；store.contract.application.GetOperationsFixedStoreContractsOperation；contract module | StoreContractPage；固定门店来源与主表共享部分事实 | Page；固定店铺 scope 与主表过滤边界不混用 | CP-05 |
| P04 | getOperationsOrganizationBrands | registry；organization.application.GetOperationsOrganizationBrandsOperation；organization module | BrandPage；owner/可见范围由 organization 负责 | Page；DB 过滤/count/page，前端不从当前页推 total | CP-06 |
| P05 | getOperationsOrganizationHeadCompanies | registry；organization.application.GetOperationsOrganizationHeadCompaniesOperation；organization module | HeadCompanyPage；当前页面使用 ProTable | Page；稳定排序、过滤、scope 与 total 同一 query identity | CP-06 |
| P06 | getOperationsOrganizationStores | registry；organization.application.GetOperationsOrganizationStoresOperation；organization module | OrganizationStorePage；门店列表是业务主表 | Page；不与 candidates bundle 复用错误读模型 | CP-06 |
| P07 | getOperationsOrganizationTenants | registry；organization.application.GetOperationsOrganizationTenantsOperation；organization module | TenantPage；后台表格读取 owner 投影 | Page；SQL 完成 scope/权限/分页 | CP-06 |
| P08 | getOperationsWorkspaceGroupInvitations | registry；workspace.iam.application.GetOperationsWorkspaceGroupInvitationsOperation；workspace-iam module | WorkspaceInvitationPage；邀请列表有独立 query | Page；邀请筛选和 page state 独立于用户列表 | CP-07 |
| P09 | getOperationsWorkspaceGroupUser | registry；workspace.iam.application.GetOperationsWorkspaceGroupUserOperation；workspace-iam module | WorkspaceUserPage；用户列表有多种可见范围 | Page；权限过滤在 owner SQL/task read 内完成 | CP-07 |
| P10 | getOperationsWorkspaceHeadCompanyInvitations | registry；workspace.iam.application.GetOperationsWorkspaceHeadCompanyInvitationsOperation；workspace-iam module | WorkspaceInvitationPage；按 head company scope | Page；scope identity 进入 query key 与 SQL | CP-07 |
| P11 | getOperationsWorkspaceHeadCompanyUser | registry；workspace.iam.application.GetOperationsWorkspaceHeadCompanyUserOperation；workspace-iam module | WorkspaceUserPage；按 head company scope | Page；不复用 group/user 的错误状态 | CP-07 |
| P12 | getOperationsWorkspaceProjectInvitations | registry；workspace.iam.application.GetOperationsWorkspaceProjectInvitationsOperation；workspace-iam module | WorkspaceInvitationPage；按 project scope | Page；filter/page/sort 变化清除旧 query 结果 | CP-07 |
| P13 | getOperationsWorkspaceProjectUser | registry；workspace.iam.application.GetOperationsWorkspaceProjectUserOperation；workspace-iam module | WorkspaceUserPage；按 project scope | Page；权限和 scope 在 owner 侧闭合 | CP-07 |
| P14 | getOperationsWorkspaceRegionInvitations | registry；workspace.iam.application.GetOperationsWorkspaceRegionInvitationsOperation；workspace-iam module | WorkspaceInvitationPage；按 region scope | Page；不从前端当前页推候选或 total | CP-07 |
| P15 | getOperationsWorkspaceRegionUser | registry；workspace.iam.application.GetOperationsWorkspaceRegionUserOperation；workspace-iam module | WorkspaceUserPage；按 region scope | Page；服务端稳定排序和过滤 | CP-07 |
| P16 | getOperationsWorkspaceStoreInvitations | registry；workspace.iam.application.GetOperationsWorkspaceStoreInvitationsOperation；workspace-iam module | WorkspaceInvitationPage；按 store scope | Page；scope 切换不能复用前一 store 的页状态 | CP-07 |
| P17 | getOperationsWorkspaceStoreUser | registry；workspace.iam.application.GetOperationsWorkspaceStoreUserOperation；workspace-iam module | WorkspaceUserPage；按 store scope | Page；数据库侧权限过滤和 count | CP-07 |
| P18 | getPlatformAdminPage | registry；platform.admin.iam.application.GetPlatformAdminPageOperation；platform-iam module | PlatformAdminPage；平台管理员表格有标准分页需求 | Page；platform scope 与 operations scope 分离 | CP-08 |
| P19 | getPlatformContractOverviewPage | registry；store.contract.application.GetPlatformContractOverviewPageOperation；contract module | ContractOverviewPage；平台合同概览为 Page | Page；owner contract read boundary 保持，不由 foundation 拼装 | CP-05 |
| P20 | getPlatformEntityAuditHistory | registry；platform.workspace.application.GetPlatformEntityAuditHistoryOperation；platform-workspace module | AuditHistoryPage；Modal 当前缺少统一 pageSize 选择 | Page；owner/entity filter/count 与 Modal pageSize 闭合 | CP-08 |
| P21 | getPlatformOrganizationOverviewPage | registry；organization.application.GetPlatformOrganizationOverviewPageOperation；organization module | OrganizationOverviewPage；平台概览是组合 task read | Page；组合仍由 organization owner task read 提供 | CP-06 |
| P22 | getWorkspaceAccounts | registry；workspace.iam.application.GetWorkspaceAccountsOperation；workspace-iam module | WorkspaceAccountPage；已有正确“第 1-10 条/总共 N 条”样板 | Page；保留为正向 fixture，标准 foundation 不退化它 | CP-07 |
| P23 | getWorkspaceInvitations | registry；workspace.iam.application.GetWorkspaceInvitationsOperation；workspace-iam module | PlatformWorkspaceInvitationPage；平台邀请列表 | Page；filter/pageSize/sort 全进入 query identity | CP-07 |
| P24 | getWorkspaceRoles | registry；workspace.iam.application.GetWorkspaceRolesOperation；workspace-iam module | WorkspaceRolePage；角色列表为标准表格 | Page；不与 capabilityKeys 等 Detail 数组混计 | CP-07 |
| P25 | listPlatformGroupWorkspaces | registry；platform.workspace.application.ListPlatformGroupWorkspacesOperation；platform-workspace module | GroupWorkspacePage；平台空间列表 | Page；稳定默认排序与 total 由 owner 声明 | CP-08 |

#### Page candidate：9 个

| ID | operationId | owning source | 当前边界事实 | 目标边界事实 | CP |
|---|---|---|---|---|---|
| C01 | getOperationsContractCandidates | registry；store.contract.application.GetOperationsContractCandidatesOperation；contract module | StoreContractCandidatePage；候选查询有独立搜索任务 | Page candidate；候选 filter/page/count 在 contract owner | CP-05 |
| C02 | getOperationsOrganizationCandidates | registry；organization.application.GetOperationsOrganizationCandidatesOperation；organization module | OrganizationCandidatePage；候选按业务实体范围筛选 | Page candidate；只返回选择器所需字段，不借主表当前页 | CP-06 |
| C03 | getOperationsWorkspaceGroupInvitationCandidates | registry；workspace.iam.application.GetOperationsWorkspaceGroupInvitationCandidatesOperation；workspace-iam module | WorkspaceInvitationCandidatePage；候选受 group scope 约束 | Page candidate；scope/权限/selected preservation owner-local | CP-07 |
| C04 | getOperationsWorkspaceHeadCompanyInvitationCandidates | registry；workspace.iam.application.GetOperationsWorkspaceHeadCompanyInvitationCandidatesOperation；workspace-iam module | WorkspaceInvitationCandidatePage；候选受 head company scope 约束 | Page candidate；与邀请主表 query identity 分离 | CP-07 |
| C05 | getOperationsWorkspaceProjectInvitationCandidates | registry；workspace.iam.application.GetOperationsWorkspaceProjectInvitationCandidatesOperation；workspace-iam module | WorkspaceInvitationCandidatePage；候选受 project scope 约束 | Page candidate；SQL 过滤、count、page | CP-07 |
| C06 | getOperationsWorkspaceRegionInvitationCandidates | registry；workspace.iam.application.GetOperationsWorkspaceRegionInvitationCandidatesOperation；workspace-iam module | WorkspaceInvitationCandidatePage；候选受 region scope 约束 | Page candidate；不能用可见用户全量列表代替 | CP-07 |
| C07 | getOperationsWorkspaceStoreInvitationCandidates | registry；workspace.iam.application.GetOperationsWorkspaceStoreInvitationCandidatesOperation；workspace-iam module | WorkspaceInvitationCandidatePage；候选受 store scope 约束 | Page candidate；selected value 不得突破 owner scope | CP-07 |
| C08 | getPlatformOrganizationCandidates | registry；organization.application.GetPlatformOrganizationCandidatesOperation；organization module | OrganizationCandidatePage；平台概览候选 | Page candidate；平台 scope 与 operations scope 明确 | CP-06 |
| C09 | getWorkspaceInvitationCandidates | registry；workspace.iam.application.GetWorkspaceInvitationCandidatesOperation；workspace-iam module | WorkspaceInvitationCandidatePage；平台邀请候选 | Page candidate；筛选和权限在 workspace-iam owner | CP-07 |

#### Cursor：9 个

| ID | operationId | owning source | 当前边界事实 | 目标边界事实 | CP |
|---|---|---|---|---|---|
| U01 | getOperationsBrandCatalogCopyCandidates | registry；catalog.application.GetOperationsBrandCatalogCopyCandidatesOperation；catalog module | 固定 LIMIT 100、读取 keyword，cursor/pageSize 未完整进入 owner | 真 Cursor；opaque cursor、完整 total、稳定排序、scope 隔离 | CP-02 |
| U02 | getOperationsCatalogDictionary | registry；catalog.application.GetOperationsCatalogDictionaryOperation；catalog module | dictionary listing 无 limit/offset，cursor null，total 为内存 entries size | 真 Cursor；字典条目按稳定 key 分页，total 是匹配全集 | CP-02 |
| U03 | getOperationsCatalogItems | registry；catalog.application.GetOperationsCatalogItemsOperation；catalog module | 当前已有真实 cursor/CTE/total/limit 形态 | 保持真 Cursor；只接 foundation，不重写已合规 owner SQL | CP-09 |
| U04 | getOperationsInventoryTargetBusinessHistory | registry；inventory.application.GetOperationsInventoryTargetBusinessHistoryOperation；inventory module | 当前已有 cursor/page readback | 保持真 Cursor；target/scope/排序边界不退化 | CP-09 |
| U05 | getOperationsInventoryTargetConsumptionReferences | registry；inventory.application.GetOperationsInventoryTargetConsumptionReferencesOperation；inventory module | 当前已按 target 选择性读取并分页 | 保持真 Cursor；跨 scope/target 隔离由 owner SQL 保持 | CP-09 |
| U06 | getOperationsInventoryTargetLedger | registry；inventory.application.GetOperationsInventoryTargetLedgerOperation；inventory module | 当前已有 ledger page/cursor 读模型 | 保持当前真实边界；不因 foundation 把 Detail 预取回来 | CP-09 |
| U07 | getOperationsInventoryTargets | registry；inventory.application.GetOperationsInventoryTargetsOperation；inventory module | 库存目标列表已有真实 page/cursor | 保持真 Cursor；前端由 cursor foundation 承接 | CP-09 |
| U08 | getOperationsLocalCatalogCopyCandidates | registry；catalog.application.GetOperationsLocalCatalogCopyCandidatesOperation；catalog module | 固定 LIMIT 100，keyword 参与，cursor/pageSize 被忽略 | 真 Cursor；copy scope、keyword、cursor、total 一致 | CP-02 |
| U09 | getOperationsProductionTags | registry；fulfillment.production.application.GetOperationsProductionTagsOperation；fulfillment-production module | read 形参 request 被丢弃，SQL 固定 LIMIT 100，cursor null | 真 Cursor；生产标签分页参数真实到达 owner，total 完整且稳定 | CP-02 |

### 3.3 7 个边界成员

| ID | operationId | owning source | 当前边界事实 | 目标边界事实 | 处理 |
|---|---|---|---|---|---|
| B01 | getExtensionEntityCatalog | registry；extension.application.GetExtensionEntityCatalogOperation；extension module | MANAGEMENT_HOST_TYPES 是源码固定闭集，当前返回 8 个 host categories | Bounded；上界是 8 个固定 host type，consumer closure 是 ExtensionsPage 左侧选择器；acceptance 必须断言 exact set | CP-12 |
| B02 | getOperationsOrganizationStoreCandidates | registry；organization.application.GetOperationsOrganizationStoreCandidatesOperation；organization module | contract/controller/owner/generator 链路仍存在，一次返回多组候选数组；当前未发现 operations-admin 手写消费方 | RETIRED；按最后消费者反向删除 contract、controller/edge binding、owner 方法与 generated consumers，不新增替代 surface | CP-03 |
| B03 | getOperationsOrganizationStoreExtensionDefinition | registry；organization.application.GetOperationsOrganizationStoreExtensionDefinitionOperation；organization/extension owner | 返回一个门店宿主的完整 ExtensionDefinition.definitions[]，owner 无字段数量上限；编辑消费者需要完整集合 | Detail 聚合；不把整组字段当标准列表，不伪造 Bounded；完整编辑/原子替换闭包保持 | CP-12 |
| B04 | getOperationsOrganizationHierarchyExtensionDefinition | registry；organization.application.GetOperationsOrganizationHierarchyExtensionDefinitionOperation；organization/extension owner | 返回组织层级宿主的完整定义集合，无分页参数/数量上限 | Detail 聚合；只由现有定义读取与完整编辑消费者使用，不进入 45 个列表模式 | CP-12 |
| B05 | getOperationsOrganizationBusinessEntityExtensionDefinition | registry；organization.application.GetOperationsOrganizationBusinessEntityExtensionDefinitionOperation；organization/extension owner | 返回业务实体宿主的完整定义集合，无分页参数/数量上限 | Detail 聚合；不得改成列表页或自动标 bounded | CP-12 |
| B06 | getOperationsContractExtensionDefinition | registry；store.contract.application.GetOperationsContractExtensionDefinitionOperation；contract/extension owner | 返回合同宿主的完整定义集合；创建/编辑表单消费完整字段规则 | Detail 聚合；完整表单需要的闭集保持，不与合同 Page 复用 | CP-12 |
| B07 | getExtensionDefinition | registry；extension.application.GetExtensionDefinitionOperation；extension module | 平台扩展字段页读取一个宿主的完整定义集合；当前没有字段数上限 | Detail 聚合；整组编辑与原子 replace 的 read/write 闭包保持；不是 Bounded | CP-12 |

对于 B03-B07，“Detail”是对“数据库整体保存、业务整体读取”的业务聚合形状判定，不是为列表分页开绿灯，也不是要求它们证明一个人工上界。CP-12 必须证明完整聚合由 owner 一次读取、由完整编辑/原子替换闭包消费，且没有被误当成普通列表或在同一任务中重复读取；若未来 Journey 变为逐行浏览，必须新开列表 operation，而不是偷偷复用这五个 Detail operation。

## 4. Foundation 设计

### 4.1 前端 foundation

foundation 提供两种行为原语，而不是一个万能 Table：

- Page 原语：受控 page/pageSize/sort/filters，把所有影响集合的值组成 query identity；查询完成后交给 AntD/ProTable 标准分页渲染。
- Cursor 原语：受控 cursorStack/pageSize/sort/filters，只允许 first/previous/next/last-known boundary 语义；cursor stack 只能服务 Cursor surface，不能承担任意页码跳转的标准 Table。

两者共同提供：

1. filter/sort/scope/permission 变化时清除旧页或旧 cursor；
2. pageSize 变化回到首屏；
3. 旧 query identity 的响应不能覆盖当前 identity；
4. 缓存键包含 operationId、scope、filter、sort、page 或 cursor、pageSize；
5. selected value 保留必须通过 owner candidate query，不从当前页补洞；
6. loading、error、empty、total 与当前 query identity 一致。

foundation 复用仓内 AntD/ProTable，不新增分页组件库；app 继续拥有自己的 router、store、baseApi、generated client、业务列和 Journey 文案。useCursorStack 可收口为 Cursor 原语内部实现；迁移到 Page 的表面必须删除其旧调用。

### 4.2 后端 owner 读法

Page owner 的查询需要在同一 owner SQL 语句或同一 owner task-read 内完成：

1. scope/权限谓词；
2. 业务过滤；
3. 稳定排序；
4. COUNT(*) OVER() 或等价的同一次 owner count；
5. LIMIT/OFFSET。

Cursor owner 使用 opaque cursor 解码后的排序前沿，并保持：

1. cursor 只在同一 query identity 下有效；
2. next cursor 由稳定排序键生成，不泄露数据库内部主键语义；
3. total 是完整匹配集合 count；
4. pageSize 是真实上限，不是查询后再切片；
5. scope/brand/data-node 谓词在 SQL 内执行。

这里的 foundation 是行为和验证契约，不是把 SQL 抽为跨 owner repository。Catalog、Organization、Workspace IAM、Contract、Inventory、Fulfillment Production 各自保有 SQL 与 typed read。

### 4.3 Contract / edge / generated closure

只要某 operation 的请求或响应模式发生变化，必须先有对应 acceptance scenario design，再在同一次变更中完成：

OpenAPI shard → root/reference → generated Java → generated TypeScript/RTK → registry/edge → owner adapter → frontend consumer → focused test → backend-acceptance scenario。

禁止手改 generated 文件；静态 gate 必须能从 registry 读取 operationId，解引用 contract mode，并比较 owner 实际 boundary token。四个 fake cursor 只能选“真 Cursor”，不能留下 cursor/total 空转。

### 4.4 不属于本 foundation 的边界

- ExtensionDefinition 五个 Detail operation 不因包含 definitions[] 就自动改成 Page；它们现有业务任务是完整字段定义集的读取和原子替换。
- getExtensionEntityCatalog 是固定 8 个宿主闭集，按 Bounded 处理。
- 两个审计 history Modal 按标准 Page surface 提供 pageSize；organization store candidates 按 B02 退役，不进入 foundation。

## 5. 测试与 proof 设计

### 5.1 backend-acceptance 场景闭集

所有新增场景必须落在当前受管 backend-acceptance 入口对应的 *AcceptanceScenarios.java，且每条都有非空 identity、fixture、request、businessOracle。场景设计先于 contract 修改。

| scenario identity | 覆盖 | fixture 最小条件 | request | businessOracle |
|---|---|---|---|---|
| pagination.catalog-dictionary-real-cursor | U02 | 同一 dictionary scope/brand 至少 2 页条目，另造不同 scope、voided/filtered 条目 | 首页、连续 next cursor、错误 scope cursor | 第二页可达；cursor 推进到末页；total 等于完整匹配 count；无重复/遗漏；跨 scope 不可见；过滤后 total 正确 |
| pagination.production-tags-real-cursor | U09 | 生产标签超过单页，另造不同 owner scope | pageSize、小页连续 cursor | 当前 U09 契约没有 keyword 参数；证明 request 的 cursor/pageSize 到达 owner；total 是全集；不重复不遗漏；scope 隔离 |
| pagination.local-copy-candidates-real-cursor | U08 | local copy candidates 超过单页，造 keyword 干扰和其他 scope | keyword、pageSize、连续 cursor | 结果只含目标 scope/keyword；第二页和末页正确；total 不等于本页长度 |
| pagination.brand-copy-candidates-real-cursor | U01 | brand copy candidates 超过单页，造品牌/目标 scope 干扰 | keyword、pageSize、连续 cursor | brand scope、keyword、cursor、total 一致；无跨品牌泄漏 |
| pagination.workspace-user-candidates-db-page | C03-C09、WorkspaceUser 内存族 | 通过 platform invitation-candidates 在同一 workspace 为组织候选与启用角色各造 23 条，另造跨 workspace 干扰项；operations 端候选 scope 选择由现有 owner/session 规则单独保持 | platform session、targetOrganizationType、subjectType、candidateUsage、page/pageSize | 数据库侧可见范围与角色过滤；组织与角色均可连续翻过单页；total、筛选、scope 一致；跨 workspace 不可见；不依赖 operations 单一 HEAD_COMPANY scope 伪造 23 条候选 |
| pagination.contract-page-owner-boundary | P01/P03/P19/C01 | 合同列表超过一页，另造合同 scope/状态干扰 | page/pageSize/filter/sort | contract owner count/page/scope 闭合；不从当前页计算 total |
| pagination.organization-page-owner-boundary | P04-P07/P21/C02/C08 | brands/head companies/stores/tenants 超过一页，造权限外和跨 scope 数据 | page/pageSize/filter/sort | organization owner DB 过滤、count、稳定排序、页边界 |
| pagination.workspace-iam-page-owner-boundary | P08-P17/P22-P24/C03-C07/C09 | invitations/users/roles/accounts 各造超过一页与权限外数据 | page/pageSize/filter/sort | workspace-iam scope/permission/page/count；不同 tab/query identity 不串 |
| pagination.platform-page-owner-boundary | P02/P18/P20/P25 | platform admin、group workspace、两个 audit history Modal 均超过一页，造平台外与实体外历史数据 | page/pageSize/filter/sort；Modal 选择 pageSize | platform owner boundary、audit entity isolation、total、稳定排序、页边界和范围隔离 |
| pagination.extension-host-catalog-closed-set | B01 | 不少于当前固定 host type fixture，并尝试注入未知类型的负夹具 | request groupWorkspaceKey | 返回 exact MANAGEMENT_HOST_TYPES 闭集；未知类型不被静默加入；不把 8 当数据库当前行数 |
| pagination.extension-definition-aggregate-closure | B03-B07 | 每个宿主至少 2 个 field、SELECT options、revision/replace fixture | detail read、完整 replace、stale revision | 完整定义集一次读取给编辑器；revision/CAS/atomic replace 保留；证明整体聚合不被改造成分页列表、不重复 HTTP/SQL |

当前 acceptance 设计保留 11 条场景 identity；B02 退役不新增业务场景，退役路径由 contract/edge/generated/owner 最后消费者反向 proof 验证。每个场景在运行时必须报告 CONTRACT、BUSINESS、cleanup 与 businessMode=REAL。DB 调用数只做诊断输出，不是 business oracle 或通过门。

### 5.2 前端 focused test 八项

在不运行 L2 的前提下，focused test 必须覆盖：

1. 单页数据仍显示；
2. 切换 pageSize 发出新 query identity，并回到第一页；
3. 修改筛选重置 page=1；
4. 修改排序重置 page=1；
5. total 取当前过滤 query 的 total；
6. 旧 query 的延迟响应不回写当前页面；
7. Cursor 连续推进不重复、不遗漏；
8. 不同 scope/filter/sort/tab 不复用旧 query。

测试应优先放在现有两个 app 的 feature __tests__ 或已有 focused test 目录，并对 Page、Cursor 分别覆盖；不得用静态字符串存在性代替行为断言。

### 5.3 静态 gate

新增或扩展一个可从当前 registry 自动发现的静态检查，至少检查：

- 43 个分页主成员各有唯一 Page/Cursor mode disposition；45 个当前主集合成员中的 B01/B02 各有唯一边界 disposition（B02 为 RETIRED），B03-B07 各有唯一整体聚合 Detail disposition；
- Page operation 的 request/response 与 owner source 同时出现 page/pageSize/total/limit-offset 的闭合证据；
- Cursor operation 的 owner source 不得丢 request、不得固定 LIMIT、不得无条件 putNull cursor；
- B01 的 bounded upper-bound source 与 exact set closure；
- B03-B07 被列为 Detail，不被误收为 Page/Bounded；
- deleted pageSlice、selected replacement、旧手工 pagination/cursor consumers 不再被实现路径引用；
- generated Java/TS/edge/contract 的 operationId 集合一致。

红夹具必须真实运行：把一个生产 Page owner 的 LIMIT/OFFSET 或 Cursor owner 的 request forwarding 删除时门必须红；把一个仍在使用的合法 Page operation 或 fixed host set 删除时反向 proof 必须红。

### 5.4 证据边界

本轮设计文档不声称任何动态 PASS。实施完成时必须给出：

- backend-acceptance runId；
- startedAt 晚于本批所有源码修改时间；
- CONTRACT 全部通过；
- BUSINESS 全部通过，businessMode=REAL；
- cleanup=PASS；
- 运行日志/manifest 中存在真实 backend-acceptance-result.jsonl 与清理结果。

没有上述证据的项标 UNVERIFIED_REQUIRES_EVIDENCE，不能写成“已验证”。

## 6. 旧代码下线与反向 proof

| 下线项 | 最后消费者 | 删除后承接 | 反向 proof |
|---|---|---|---|
| 四个 fake cursor 的固定 LIMIT、丢 request、putNull cursor | Catalog/ProductionTag owner read 与 generated consumers | 真 Cursor owner SQL + Cursor foundation | fake token 命中为 0；四个 scenario 仍存在并真跑 |
| StoreCandidateTaskReadService generic all/pageSlice 与 slice.set(safeSize - 1, selected) | 组织候选 consumer | organization owner SQL page + Page foundation | pageSlice 和 slice.set 生产命中为 0；candidate scenario 证明页成员不被替换 |
| WorkspaceUserService candidates 的 visible/enabledRoles 全量集合与 pageSlice | Workspace user/candidate consumers | workspace-iam owner SQL page | 两族 full-list slice 形状为 0；账号标准 Page operation 仍在 |
| 5 个手工 cursor/上一页下一页表格 | 当前 catalog/inventory/production tag/copy candidate UI consumers | Cursor foundation | 旧 Previous/Next 状态与组件调用为 0；Cursor surface focused tests 仍在 |
| useCursorStack 在需要任意页码的标准 Table 上的调用 | 被迁移的 Page ProTable/Table | Page foundation state | Page surface 不再引用 cursor stack；Cursor surface 仍保留 foundation 内部能力 |
| 已删除 operation/helper/type/hook 的遗留消费点 | generated edge、RTK、feature hooks、public owner API record | 新 generated contract 或现存 typed operation | rg 成员清单为 0；没有孤儿 public record；保留集合反向检查为 PASS |

“删除为 0”必须按具体 token 和路径打印数量；没有条数不得写“全仓/唯一/零”。

## 7. 逐 CP 设计卡

以下每个 CP 都是一个独立闭环。RECALL 为空即未就绪，不获得形态自主权。每个 CP 的实现形态由实施时依据不变量选择，并在交付中登记“我选了 X 而不是 Y，因为 Z”。

### CP-00 · 分母锁定与 acceptance 先行设计

- RECALL：进入前重开需求分析 §3/§5/§8；需求复核；operation-handler-bindings.json；backend-acceptance standard；read-model-granularity；set-interaction-not-n-times-single。
- 本项失败条件：43 个分页主成员、B01、B02 退役行、5 个整体聚合 Detail、7 个当前边界行或 11 个 acceptance identity 不能逐项落到 operation、owner、fixture、request、businessOracle。
- 不变量：contract 修改前，所有新业务场景 identity 已存在于对应 AcceptanceScenarios.java 的设计清单；43 个分页成员各只有一个 Page/Cursor 目标 mode；B01、B02、B03-B07 各只有一个边界 disposition。
- FORBID：不修改生产代码、契约、生成物；不把 45 之外的嵌套数组强行纳入；不恢复 B02；不把 ExtensionDefinition 选成分页。
- 验证：静态逐行清单；registry 反向差集为空；场景表非空字段检查；生成 implementation input manifest。
- 形态理由：我选“先锁成员与场景，再分 owner 实施”而不是先改伪 cursor，因为 contract/owner 变更没有 business oracle 会重演上一批 evidence 档位错误。

### CP-01 · Page/Cursor foundation 行为契约与前端 focused harness

- RECALL：进入前重开本文 §2/§4.1/§5.2；ProTable compact standard；当前 foundation 目录；两个 app 的 ProTable/Table/Pagination 清单；query state memory。
- 本项失败条件：八项 focused behavior 中任何一项只能靠字符串存在性证明，或 Page/Cursor query identity 不含 scope/filter/sort/page/cursor/pageSize。
- 不变量：Page 与 Cursor 是两个受控状态模型；异步旧响应不能回写；Page 支持任意页码，Cursor 不暴露任意页码假语义。
- FORBID：不新增非 AntD 分页控件；不让 app 自己复制 foundation 行为；不把 useCursorStack 接到 Page Table。
- 验证：focused test 八项全部真实运行；旧 query 延迟响应和 cursor 重复的负夹具真实失败；foundation 不依赖业务 owner。
- 形态理由：我选“两个最小行为原语”而不是一个大列表组件，因为 Page/Cursor 的导航语义不同，统一外观不应统一错误状态模型。

### CP-02 · 四个 fake cursor 改成真实 Cursor

- RECALL：进入前重开 U01/U02/U08/U09 行；CatalogOwnerService dictionary/copyCandidates；ProductionTagOwnerService read/readTags；四个 OpenAPI shard；generated Java/TS/RTK；四个 acceptance identity。
- 本项失败条件：owner 继续固定 LIMIT 100、丢弃 request、无条件 putNull cursor、用当前页 size 作为 total，或四个 scenario 不能翻过一页。
- 不变量：cursor/pageSize/filter/scope 真实到 owner；owner SQL 完成稳定排序、前沿过滤、total、limit；第二页无重复/遗漏、跨 scope 不可见。
- FORBID：不删除 cursor/total 作为逃避；不新增 bounded 上界；不手改 generated 文件；不把 SQL 下沉到 edge。
- 验证：先运行 CP-00 场景设计，再成套刷新 OpenAPI/generated/edge/consumer；模块 focused test、静态 gate、4 个 backend-acceptance BUSINESS/cleanup。
- 形态理由：我选“保留现有 Cursor 契约并让 owner 真执行”而不是删除 cursor/total，因为四个操作都是可增长候选/字典集合，删除会把真实截断变成合法的未知上界。

### CP-03 · 退役 getOperationsOrganizationStoreCandidates

- RECALL：进入前重开 B02 行；`StoreCandidateTaskReadService.candidates`、对应 operation/controller、OpenAPI root/path、edge binding、generated consumers；当前 operations-admin 手写消费搜索；旧 full-list/pageSlice/selected replacement 的最后消费者。
- 本项失败条件：退役 operation 仍可从 contract、controller、edge、generated client 或 owner 方法进入，或删除 endpoint 后留下私有方法、类型、hook、绑定或公共 API 孤儿。
- 不变量：B02 退役链路从 contract 到 owner 的最后消费者全部删除；`getOperationsOrganizationCandidates`（C02）及其他仍被使用的 organization candidate path 不受连带删除影响；无新替代用户 surface。
- FORBID：不把 B02 改造成 Page 或 Bounded；不为退役接口增加兼容层/fallback；不删除 C02 或其他非 B02 候选；不改数据库模型。
- 验证：contract/registry/edge/generated/owner 反向 proof 按具体 token/path 输出计数；organization focused test；静态 operation-owner closure；不为退役接口新增 backend-acceptance 场景。
- 形态理由：我选“按最后消费者反向删除完整链路”而不是给无已确认 Journey 的无界 bundle 加分页，因为 Dexter 已裁定退役，保留新接口只会延长无界契约和维护面。

### CP-04 · WorkspaceUserService 的 DB Page

- RECALL：进入前重开 C03-C09 与 P09/P11/P13/P15/P17/P24 行；WorkspaceUserService.candidates 的 visible、enabledRoles、pageSlice；已有账号 Page 正例；workspace-iam contracts。
- 本项失败条件：visible 或 enabledRoles 继续全量物化后切片，或角色/可见范围在 Java 过滤后才决定 total。
- 不变量：数据库侧完成权限、scope、search、sort、count、page；selected candidate 不替换当前页；已有 getWorkspaceAccounts 正确 Page 形态保持。
- FORBID：不重构测试替身来绕门；不改变 IAM 角色/权限产品语义；不复用错误 tab state。
- 验证：workspace-user-candidates scenario fixture 超页且包含权限外数据；workspace-iam focused test；static gate 确认 pageSlice family 删除而 account Page 保留。
- 形态理由：我选“按候选业务任务写两条窄 SQL projection”而不是把 enabledRoles 和 visible 合成万能 user repository，因为两者授权/字段闭集不同。

### CP-05 · Contract owner 的 Page 成员

- RECALL：进入前重开 P01/P03/P19/C01；contract registry entries、OpenAPI contract shards、contract owner handlers、现有 StoreContractPage/candidate read；pagination.contract-page-owner-boundary。
- 本项失败条件：contract Page 的 total 来自当前页、scope/filter 在 edge 或前端执行、candidate 查询复用完整 contract detail。
- 不变量：contract owner 负责稳定排序、过滤、count、page；fixed-store 与 group contract 的 scope closure 各自保持；契约与 owner boundary 一致。
- FORBID：不跨 schema 读 contract 表；不以 universal repository 替换 owner；不改 contract 产品字段或审计语义。
- 验证：acceptance 场景；contract module focused test；OpenAPI/generated Java/TS/edge consumer 同批刷新；static boundary gate。
- 形态理由：我选“按 owner operation 保留三条 task read”而不是一个 contract mega query，因为 P01/P03/P19 的 scope 与字段 closure 不相同。

### CP-06 · Organization owner 的 Page 成员

- RECALL：进入前重开 P04-P07/P21/C02/C08；organization registry/OpenAPI；C02 与其他 organization task read；组织 scope/权限 memory；organization acceptance scenarios；B02 退役后的 operation-owner closure。
- 本项失败条件：组织主表或 candidate 读取全量到 Java、跨 owner 推导权限、platform overview 和 operations list 共享错误 projection。
- 不变量：organization owner 内完成 scope/permission/filter/count/page；platform overview 的组合 boundary 保持；B02 退役后 C02 的候选分页仍独立且不受连带删除影响。
- FORBID：不恢复 B02；不从 platform edge 访问 organization 表；不以当前数据量证明 bounded。
- 验证：organization acceptance；module focused test；反向 proof 保留正确的 platformContractCandidatePage 类似正例；static contract-owner gate。
- 形态理由：我选“按组织业务事实分组的窄 task read”而不是按前端页面分组，因为同一 owner 的字段闭集可复用，而不同 scope/授权仍需分开。

### CP-07 · Workspace IAM owner 的 Page 成员

- RECALL：进入前重开 P08-P17/P22-P24/C03-C07/C09；workspace-iam registry/OpenAPI/generated bindings；WorkspaceUserService 正确 account Page 与 candidate families；tab-keyed state memory。
- 本项失败条件：不同 scope/tab 共享 page/filter/sort 状态，候选依赖主表当前页，或 IAM 权限过滤在前端完成。
- 不变量：每个 operation 的 scope/role/permission/filter/page identity 独立；DB 过滤/count/page；已有 accounts Page 样板保持。
- FORBID：不把 platform-admin 与 operations-admin 合并；不跨 owner 读取 organization facts；不把 capabilityKeys 等 Detail 数组当列表。
- 验证：workspace-iam acceptance；focused tests 覆盖 tab isolation、page reset、旧 query；generated closure/static gate。
- 形态理由：我选“一个 foundation state + operation-specific typed adapters”而不是共享一个 query state object，因为不同 tab 代表不同 owner query。

### CP-08 · Platform 与审计 Page surface

- RECALL：进入前重开 P02/P18/P20/P25；platform-iam/platform-workspace registry and handlers；两份 audit Modal；Dexter 的统一分页裁定；本文 §1.3。
- 本项失败条件：P02/P18/P20/P25 任一 owner/contract/UI 没有一致的 Page 边界，或任一 audit Modal 仍固定条数、没有 pageSize selector、total 与当前实体过滤不一致。
- 不变量：platform 与 audit history 均使用标准 Page 语义；audit Modal 的实体/scope 过滤、count、稳定排序和 pageSize 在 owner 与 UI 闭合；B02 已由 CP-03 退役，不在本项重新处理。
- FORBID：不恢复固定 history detail 例外；不把 audit history 改成 Cursor；不把 B02 重新声明为 Bounded 或 Page；不跨 owner 读取审计事实。
- 验证：`pagination.platform-page-owner-boundary` 覆盖 P02/P18/P20/P25；两个 Modal focused test 覆盖 pageSize、页码、实体过滤、旧 query 不回写；contract-owner static gate。
- 形态理由：我选“审计 Modal 与主表共享标准 Page 语义”而不是保留固定条数摘要，因为 Dexter 已明确要求统一分页，且 audit history 本身是可增长事件集合而非整体聚合。

### CP-09 · 保留已经真实合规的 Catalog/Inventory Cursor

- RECALL：进入前重开 U03-U07 行；当前 CatalogOwnerService catalog items cursor SQL；InventoryOwnerService inventory targets/history/reference/ledger；QG-12 已有 reference isolation 场景与 source decision。
- 本项失败条件：已经真实 Cursor 的 owner 被改回 full list、丢掉 target/scope 谓词、或为了“统一”删除现有 correctness proof。
- 不变量：U03-U07 保持真实 cursor/total/limit 与 owner filter；inventory reference 仍是 SQL target predicate，不回到全 scope Java 过滤。
- FORBID：不改 QG-12 已确认 SQL 语义；不合并 shared read pipeline；不为了统一 UI 改业务 response。
- 验证：现有 QG acceptance 与本批 cursor focused test；反向 proof 保留 COUNT(*) OVER()、target predicate、cursor fields；no-action code path 必须有静态 proof。
- 形态理由：我选“把现有正确 owner 接到新 foundation”而不是重写 SQL，因为 foundation 应收敛消费行为，不制造新的风险面。

### CP-10 · Page frontend surfaces

- RECALL：进入前重开本文 43 个分页主成员矩阵、45 个主集合成员中的两个边界行、前端 ProTable/Table/Pagination 清单、getWorkspaceAccounts 正向样板、两个 audit Modal；AntD/ProTable standard。
- 本项失败条件：普通 Table/ProTable 仍各自复制 page reset/cache/loading，或列表继续显示本页长度代替 total。
- 不变量：每个标准 Page surface 使用 Page foundation；pageSize/filter/sort reset 与 total 一致；AntD/ProTable 主题与 size="small" 保持。
- FORBID：不把 cursor surface 强行改成任意页码；不删除业务列、owner 文案或已批准 Journey；不做 L2/UAT 声称。
- 验证：frontend focused 八项；architecture/static checks；旧本地 pagination state 与重复 hook 的反向 proof；build/typecheck。
- 形态理由：我选“foundation 只管 query state，表格仍由业务 feature 渲染”而不是共享整张 Table，因为列、操作和空态属于业务 Journey。

### CP-11 · Cursor frontend surfaces 与旧手工分页下线

- RECALL：进入前重开 U01-U09、CatalogWorkbenchPage、CatalogDictionaryDrawer、LocalCatalogCopyDrawer、CatalogItemDrawer、InventoryDetailDrawer、Production Tag consumers、useCursorStack/useCursorCandidates。
- 本项失败条件：旧五处上一页/下一页状态与新 Cursor foundation 并存，或 useCursorStack 继续被 Page Table 使用。
- 不变量：Cursor surface 只有一个 owner query state/缓存承接；cursor 不重复不遗漏；Page surface 不依赖 cursor stack。
- FORBID：不保留兼容双路径；不把 cursor 伪装成“第 N 页”；不删除仍被 Cursor surface 使用的 foundation cursor primitive。
- 验证：4 个 fake cursor acceptance + U03-U07 retained proof；focused cursor tests；旧 manual cursor token/consumer 计数；frontend typecheck。
- 形态理由：我选“收口为 foundation 内部 Cursor 原语”而不是删除所有 cursor hook，因为五个真实 Cursor/候选 surface 仍需要前后沿推进，但 Page 不需要它。

### CP-12 · Bounded/Detail 边界与 ExtensionDefinition 反向闭合

- RECALL：进入前重开 B01-B07 行；ExtensionDefinitionService.MANAGEMENT_HOST_TYPES、listManagementDefinitions、requireDefinition、replaceDraft/CAS；ExtensionsPage、ExtensionDefinitionEditDrawer；doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md。
- 本项失败条件：B01 返回未知 host type、B03-B07 被当普通列表分页，或整体保存/整体读取的定义聚合在同一任务被重复读取；任何代码把 B03-B07 声称成 Page/Cursor/Bounded，或为其臆造字段数量上限。
- 不变量：B01 exact 8 fixed set；B03-B07 保持非分页 Detail/atomic whole-definition semantics，完整字段集合只由定义/编辑闭包一次读取并消费，不伪造 bounded。
- FORBID：不凭当前字段数量添加上限；不改变 extension owner 数据模型、host type 集合、revision/CAS 或原子替换；不新增第五个 metadata tab。
- 验证：pagination.extension-host-catalog-closed-set 与 pagination.extension-definition-aggregate-closure；静态检查 B01 exact set、B03-B07 Detail mode；source scan 证明没有分页误用、重复读取或将整体聚合拆成列表协议。
- 形态理由：我选“固定闭集 Bounded + 整体保存/整体读取的非分页 Detail”而不是把 definitions[] Page 化，因为数据库与业务都把定义集作为一个完整聚合维护；分页会破坏原子编辑语义，且不是用户 Journey。

### CP-13 · Contract/generated/edge/owner 静态闭合

- RECALL：进入前重开本文 §4.3、所有发生 schema 变化的 operation shards、registry、generated Java/TS/RTK、edge controllers、owner adapters、project-memory/decisions/http-crud-efficiency-design-redlines.md。
- 本项失败条件：任何 operation 在 OpenAPI、generated、edge、owner、consumer、test 之间少一层，或 generated 文件被手改。
- 不变量：每个模式声明与 owner boundary 一一对应；operationId/path/response 集合相等；generated 由 source 重新产出。
- FORBID：不修改与本批无关的 contract；不通过扩张 schema 或 nullable/fallback 掩盖 owner 行为缺口；不手改生成物。
- 验证：codegen/check、edge-codegen check、static mode-owner gate、所有 affected compile/typecheck；反向 proof 保留非本批 operation。
- 形态理由：我选“以 registry operationId 做闭合主键”而不是按文件名对账，因为同一 operation 可能跨 root、shard、generated 与多个 consumer 出现。

### CP-14 · Acceptance 实施与受管运行

- RECALL：进入前重开本文 §5.1-§5.4、backend-acceptance standard、所有新增 scenario source、受管 runner README/脚本；读取当前 runner 日志/manifest 规则。
- 本项失败条件：用模块 Gradle test、裸 Testcontainers、response.ok 或旧 run 目录冒充 BUSINESS；缺 identity/fixture/request/businessOracle；cleanup 非 PASS。
- 不变量：所有新增场景在真实 HTTP/真实 PostgreSQL container 运行；CONTRACT/BUSINESS/cleanup 分离；businessMode=REAL；run 晚于源码修改。
- FORBID：不 reset/seed/DEV/L2/UAT；不重试遮蔽 first failure；同一失败 signal 第二次尝试前必须先读取结构化日志并定位 broken boundary。
- 验证：受管 runner 真实 run，报告 runId/startedAt、jsonl、CONTRACT、BUSINESS、cleanup；所有未运行项逐项 UNVERIFIED_REQUIRES_EVIDENCE。
- 形态理由：我选“先保存 first-failure 的 run-scoped 日志，再按边界修复”而不是盲目重复远端 run，因为仓内 failure-recall 明确要求第二次尝试前完成诊断。

### CP-15 · 死方法、类型、hook 与生成消费清理

- RECALL：进入前重开本文 §6、实际修改 CP-02-CP-14 的源码 diff、generated consumers、public owner API、InventoryOwnerApi/InventoryLedgerEntryReadback 类似孤儿检查规则。
- 本项失败条件：只删调用点而留下 private method、public record、hook、generated consumer 或旧 pagination imports；或删过头导致仍需保留的真实 Cursor/Page 消失。
- 不变量：下线项及其最后消费者逐一闭合；保留项有反向 proof；没有公共 API 孤儿和双实现。
- FORBID：不增加兼容层/fallback；不顺手删除与本批无关的 owner readback；不以搜索结果之外的猜测扩大 closed set。
- 验证：按具体 token/path 输出计数；编译、focused tests、static gate；保留集合反向 proof；API 类型和 generated consumers 重新扫。
- 形态理由：我选“按最后消费者反向删除”而不是按文件整体清空，因为同一 service 同时包含已正确的 Page/Cursor 和待下线的 full-list family。

### CP-16 · 批次收口与三方/独立复核输入

- RECALL：进入前重开需求分析正本、本文全部 CP、全部 owning source、所有 focused proof、backend-acceptance manifest/log、独立设计 review verdict。
- 本项失败条件：任何 CP 没有需求/详设/代码三方回读，或证据档位被提升，或反向 proof 缺失。
- 不变量：每个 CP 状态只能是 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE、DEXTER_DECISION；本轮不宣称 L2/UAT。
- FORBID：不把 Claude review 当设计期独立盲审替代；不改变下一 Roadmap step；不扩大到 reset/seed/DEV。
- 验证：Codex 独立 implementation/design self-review 后，交 Claude 事后 review；交付 brief 包含 GO/NO-GO、M/S/N、仓根相对路径、授权边界。
- 形态理由：我选“整批一次回读和一次 review handoff”而不是按页面拆成多个交付，因为 Dexter 要求尽量一批完成、一次交付、一次复核，同时每个 CP 内部仍保留独立 proof。

## 8. 设计期盲审协议（实施前硬闸）

本详设完成后必须先运行一轮 fresh 独立子 agent 设计盲审，作者会话不得自审自判。第一阶段不得打开本文；第二阶段才打开本文逐条攻击。prompt 必须包含以下原文要求：

- 目标与判据；
- 第一阶段从冻结输入和源码独立推导问题族、分母、批次和边界；
- 本文声称的每一个数字和事实逐条独立复测，尤其 15/14/2、83、72、50、45、43、25/9/9、2、5、7、固定 8；
- 本轮特有攻击面：四个 fake cursor 是否真能跨页、两族 Java full-list 是否真的消失、Page/Cursor/Bounded/Detail/RETIRED 是否混类、43+2+5 是否漏成员、整体保存/整体读取的 ExtensionDefinition 是否被错误分页、B02 退役是否删完整、审计 Modal 是否真正落到标准 Page、acceptance 是否能识别假绿、旧代码删除是否有消费者遗漏；
- 环境陷阱：本机没有 timeout，按 shebang 选解释器，判红绿用退出码；
- 明写“如果确实没问题就直说没问题”；
- 明写“禁止派生子 agent”。

轮次最多两轮。第二轮必须声明 ROUND_FINAL_DECISION=SELF_DECIDED。每条 verdict 按 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE、DEXTER_DECISION intake。若第一轮发现设计缺陷，Codex 先重开 owning source、修改本文并登记理由，再以第二轮作最终收口。

## 9. 实施计划（串行，一批交付）

本批不是把同一功能拆成多个独立交付；以下 CP 是一个串行 implementation batch 的内部闭环。后一 CP 只能在前一 CP 的 focused proof 和三方回读完成后开始。这样既满足 Dexter 的“一批做完、一次交付、一次复核”，又不允许跨 owner 混写或跳过证据。

| 顺序 | CP | 依赖与动作 |
|---:|---|---|
| 1 | CP-00 | 先走 RECALL；锁定 43+2+5 当前基线、B02 RETIRED 目标、7 个边界 disposition、所有 target mode、11 个 acceptance identity 和 scenario design；不改代码。 |
| 2 | CP-01 | 先走 RECALL；实现 Page/Cursor foundation 行为与 focused harness；跑八项 focused proof；回读需求/详设/源码。 |
| 3 | CP-02 | 先走 RECALL；在已有 scenario design 之后同步 OpenAPI/generated/edge/owner/consumer，修四个 fake cursor；跑四条 backend acceptance。 |
| 4 | CP-03 | 先走 RECALL；按最后消费者退役 getOperationsOrganizationStoreCandidates 全链路，删除其 full-list/pageSlice/selected replacement 及 contract/edge/generated/owner 残留；不新增 candidate scenario。 |
| 5 | CP-04 | 先走 RECALL；删除 WorkspaceUser 两族 full-list/pageSlice，落 owner SQL Page；跑 IAM candidate scenario。 |
| 6 | CP-05 | 先走 RECALL；contract owner P01/P03/P19/C01 成套同步契约链和 owner Page；跑 contract scenario。 |
| 7 | CP-06 | 先走 RECALL；organization owner P04-P07/P21/C02/C08 成套同步；确认 B02 退役不误伤 C02；跑 organization scenario。 |
| 8 | CP-07 | 先走 RECALL；workspace-iam P08-P17/P22-P24/C03-C07/C09 成套同步；跑 workspace-iam scenario。 |
| 9 | CP-08 | 先走 RECALL；platform P02/P18/P20/P25 与两个 audit Modal 成套闭合标准 Page/pageSize；复核 B02 已由 CP-03 退役，不重新处理。 |
| 10 | CP-09 | 先走 RECALL；对 U03-U07 做 no-op/retained proof，确认 QG-12 target predicate 与现有真实 Cursor 不退化。 |
| 11 | CP-10 | 先走 RECALL；迁移标准 Page frontend surfaces，删除 page state 重复实现；跑八项 focused proof 中 Page 部分。 |
| 12 | CP-11 | 先走 RECALL；迁移 Cursor surfaces，删除 5 个手工 cursor/上一页下一页表格调用，保留 foundation Cursor primitive；跑 Cursor focused proof。 |
| 13 | CP-12 | 先走 RECALL；闭合 B01 fixed set 和 B03-B07 Detail consumer proof；不加字段数量上限、不把 Detail 改 Page。 |
| 14 | CP-13 | 先走 RECALL；运行 codegen、edge-codegen、static mode-owner gate、compile/typecheck；检查 operationId 集合与 generated closure。 |
| 15 | CP-14 | 先走 RECALL；保存 first-failure logs 后运行受管 backend-acceptance；报告 CONTRACT/BUSINESS/cleanup/businessMode 和 run 时间关系。 |
| 16 | CP-15 | 先走 RECALL；按最后消费者清理 dead method/type/hook/generated consumer；跑反向 proof、compile、focused tests。 |
| 17 | CP-16 | 先走 RECALL；逐 CP 做需求/详设/代码三方回读；完成 Codex 独立 implementation review 输入；再交 Claude 事后 review。 |

### 9.1 每个 CP 的固定闭环模板

实施每个顺序项时必须按以下顺序执行，不能用总览验证代替：

1. 打开该 CP 的 RECALL 原文、命中 memory、owning source 与当前适用契约/决策。
2. 记录当前 source/生成物 identity，确认没有上游数字或路径漂移。
3. 在不违反不变量/FORBID 的前提下自主选择形态，并登记一行理由。
4. 实现后先跑该 CP focused proof；长运行失败先读结构化日志，第二次同一 signal 前加诊断。
5. 用同一组 RECALL 原文逐条回读需求、详设、源码和 evidence。
6. 做同根扫描、反例查找、反向 proof；若发现新问题，不点状止血。
7. 只有当前 CP 证据档位足够，才进入下一 CP。

## 10. 设计交付判定

本详设在 fresh 独立两阶段盲审完成、所有 findings 完成 intake、43+2+5 矩阵可逐行使用、每个 CP 的 RECALL/失败条件/不变量/FORBID/验证非空、串行计划与范围边界一致后，才可申请 implementation authorization。

本轮的最终证据只能是：

- 需求分析文本已闭合 S-1/N-1/N-2；
- 本详设与实施计划已写入仓根；
- 设计期 independent subagent verdict 已取得并按状态逐条处置；
- 没有生产代码、契约、生成物、迁移、DEV、reset、seed、L2、UAT 变更或声明。

## 10.1 设计期独立盲审当前记录

本详设的设计期盲审尚未闭合，因而状态继续保持
`IMPLEMENTATION_DESIGN_DRAFT_AWAITING_DESIGN_REVIEW`，不得据此申请实施授权。

Claude 的上一份 `GO · M=0 · S=1 · N=2` 复核覆盖的是修正前的详设字节。其提出的 64→72
取证口径修正以及 Dexter 随后作出的“审计 Modal 统一 Page/pageSize、B02 退役”决定已改变
当前详设内容；因此上一份 GO 不能被冒充为对当前字节的完整复核，后续必须对当前版本重新做
针对性详设 review。

- `REVIEW_CYCLE_ID=UNIFIED_LIST_PAGINATION_DESIGN_20260818`；
  `REVIEW_TARGET=DESIGN`；`REVIEW_ROUND_LIMIT=2`；`reviewerKind=INDEPENDENT_SUBAGENT`。
- 阶段一由 fresh 独立 reviewer 完成，且满足 `AUTHOR_MATERIAL_READ=false`、
  `SUBAGENT_DISPATCHED=false`、`DYNAMIC_ACTIONS=NONE`。其独立复测确认当前 registry 的
  GET 基线为 83，并重新打开了相关源码；阶段一没有替代阶段二对本详设逐条攻击。
- 阶段二已改用限定文件清单和 60 秒有界等待；该历史尝试使用的是修正前的 64/12 口径，
  当前详设在 S-1 与 Dexter 两项裁定后的待复核口径是 15/14/2、83、72、50、45、43、
  25/9/9、2、5、7、固定 8、四个伪 cursor、两族内存分页、B02 退役、审计 Page、11 个验收场景和
  CP-00 至 CP-16 闭合情况。该 reviewer 在有界等待内没有返回 verdict，随后受控关闭；
  因此阶段二状态为 `UNVERIFIED_REQUIRES_EVIDENCE`，没有伪造 `ROUND_FINAL_DECISION`，
  也没有把无输出当作 GO 或 NO-GO。
- 当前可声明的证据档位只有静态文档与源码核查；没有运行 backend-acceptance、模块测试、
  编译、DEV、reset、seed、HTTP、浏览器 L2 或 UAT。

后续应由新的受控评审路径完成同一设计周期的第二阶段；在取得有效逐条 verdict 并完成 intake
之前，不进入实施。
