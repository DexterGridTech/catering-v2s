SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# base-1 整体重构 · 合并后的 IA 差量详设

## 1 · 元数据与边界

```text
IA_SCOPE=BASE1-IA-01..BASE1-IA-08
BUSINESS_SOURCE=doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md@4ff71de4c49cc56146501f40cde6b05e4c0a32ba4b5bd2e97afd8ee3e0614bbd;doc/plans/platform/2026-08-27-v2s-base-1-appendix-cascade-and-members-claude.md@eac35a023a83209e6d9a473ad9bf4801bb56ae95cd87b70983e3931f87219a6c
MERGE_SOURCE=doc/plans/platform/2026-08-27-v2s-base-1-design-merge-claude.md@4dc3a72696e21560729bc74cda5e32f2057aa8c3e0430db2ed325424b0de2e7c
MERGE_DECISIONS=BASE1-D01=B;BASE1-D02=B;BASE1-D03=C;CLOSED_CODE_RESPONSES=ENUM
OPERATION_DELTA=FROZEN_NET_MINUS_1
JOURNEY_REFS=doc/decisions/2026-08-19-v2s-business-channel-management-journey.md;doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md;doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md;doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md;doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md;doc/decisions/2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md;doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md;doc/decisions/2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md;doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md
UI_INTERACTION_REF=doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md;doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md;doc/decisions/2026-08-21-v2s-catalog-unit-model-ui-interaction.md;doc/decisions/2026-08-08-v2s-catalog-category-reference-interaction.md;doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md;doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md;doc/decisions/2026-08-03-v2s-extension-hosts-ui-interaction.md;doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-08-27-v2s-base-1-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=EXISTING_ACCEPTED_SURFACES_UNCHANGED
IMPLEMENTATION_AUTHORITY=false
```

本工件只声明 base-1 对既有 IA 和交互工件造成的差量。路由、页面归属、Drawer/Modal
形态、商品目录树、商品十列顺序和 SKU 子行结构均继承上述已接受工件；本批不新增页面、导航
节点或用户任务。服务端删除人读装配后，前端只在既有 surface 上组合结构化事实或查本地闭集
字典；这不是重新设计页面。

本批没有待裁项。collaboration binding 在哪些场景构成阻断及未来菜单发布准入均在 base-1 范围外，
IA 不为它们预设新的动作、禁用规则或兼容分支。

## 2 · BASE1-IA-01 · 业务渠道模板、渠道列表与详情

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 运营人员查看渠道自身状态及各上游维度状态，维护启用或停用渠道，并在新建引用时只选择当前场景可用的模板。 |
| `actorAndScenario` | 项目或门店渠道管理员；从既有项目/门店“业务渠道”页面进入列表、详情或编辑。 |
| `entryAndSurface` | 既有 `business-channels/project`、`business-channels/store` 内容页；`BusinessChannelDetailDrawer`、`BusinessChannelTemplateDrawer`、`BusinessChannelBindingDrawer`。不新增 route。 |
| `controlType` | 管理列表与详情分别显示“自身状态”和结构化上游阻断项；状态用文字+Tag，不只靠颜色。编辑仍使用既有 Drawer；停用对象可以编辑和重新启用；标记删除对象只读且无保存/转态动作。停止原因列表整体删除。 |
| `validationAndError` | 新建模板引用不可用时显示 owner 的业务原因；未改变的既有停用模板引用允许保存；`VOIDED` 自身编辑或转态显示“该业务渠道已标记删除，不能继续修改”；不得把 binding 状态错误改写成模板/渠道状态错误。 |
| `accessibilityAndTestId` | 保留既有 Drawer focus trap、关闭回焦和字段 aria；状态文本可被读屏。使用既有 `business-channel-status`、`business-channel-template-detail-status`，新增 `business-channel-status-dimensions`、`business-channel-status-dimension-${type}-${ref}`、`business-channel-blocker-${type}-${ref}`；旧 `business-channel-stop-reasons` 必须不存在。 |
| `emptyLoadingErrorStates` | blockers 为空显示“当前没有上游阻断”；读取中保留 `currentData` 并显示刷新态；刷新失败保留旧详情并呈现重试，不把失败伪装成“无阻断”。 |
| `containerBehaviorUnderLoad` | 沿用既有宽 Drawer 的唯一 body 纵向滚动区和固定操作区；阻断项逐行换行，长名称截断并可查看完整文本，操作区和标题不得溢出视口。 |
| `stateAndPermission` | **[backend-acceptance]** 用项目身份读门店渠道或反向读项目渠道均按既有 owner scope 拒绝；停用不扩大读写授权；`VOIDED` 编辑、转态均由 owner 拒绝。 |
| `navigationAndRefresh` | **[focused]** 渠道 mutation 成功只失效当前项目/门店渠道列表、当前详情和引用候选；失败不失效；模板恢复后再次读取详情，结构化 template 状态改变且不需要清除命令。 |
| `collectionShapeAndScale` | 渠道列表继续使用既有服务端集合形态；上游状态是固定字段集，blockers 是由已声明祖先维度导出的有限集合，不引入客户端分页、抽干或隐藏字段请求。 |
| `dataSourceAndCascade` | 渠道自身状态由 business-channel owner 返回；模板、目标节点、workspace、external/provider/binding 各状态由各 owner 返回并经 edge 结构化传递。前端不合成 `effectiveStatus`，只按当前动作的适用矩阵决定显示与动作可用性。 |
| `forbiddenUI` | DOM/response type 中出现 `stopReasons`、`stopReasonDisplayNames`、`effectiveStatus`、`CASCADE_TEMPLATE`、`CASCADE_EXTERNAL`、raw kind、UUID 或 problem code 即缺陷。 |

## 3 · BASE1-IA-02 · 外部协作系统、服务商方案与主体绑定

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 平台管理员查看外部系统、服务商方案和主体绑定的原始业务事实，并用业务语言识别闭集状态。 |
| `actorAndScenario` | 平台外部协作管理员；进入 `/platform/external-collaboration` 的既有列表、详情、编辑和绑定 surface。 |
| `entryAndSurface` | `ExternalCollaborationPage` 及 `ExternalSystemDetail`、`ProviderProfileDetail`、`OwnerBindingDetailDrawer`、`OwnerBindingList`、`OwnerBindingForm`；不新增路由和字典接口。 |
| `controlType` | 后端删除 collaboration 六类逻辑代码闭集 DisplayName 后，由平台前端本地字典显示 catalog status、authentication kind、unbind kind、capability class、binding status、node type；每个字典键都从 generated response enum union 派生。实体的系统名、服务商方案名、绑定名继续取 owner。组织路径由结构化节点数组逐段显示“名称（编码）”。 |
| `validationAndError` | 字典必须 exhaustive；收到未知 code 时进入显式错误态并记录脱敏诊断，不回退显示 raw code。collaboration binding 在哪些场景构成阻断不属于 base-1，不在 UI 预设按钮禁用规则。 |
| `accessibilityAndTestId` | 使用既有 `platform-external-system-detail`、`platform-provider-profile-detail`、`platform-owner-binding-table`、`platform-owner-binding-detail-${bindingRef}`、`platform-owner-binding-node`；路径各段是可读文本，不把整条路径塞进 title-only。 |
| `emptyLoadingErrorStates` | 结构化路径为空显示“未绑定组织节点”；未知闭集值显示“当前状态无法识别”并禁用依赖该值的动作；读取失败保留旧详情并提供重试。 |
| `containerBehaviorUnderLoad` | 继承既有 Drawer body 滚动；节点路径可换行，长节点名截断加提示；闭集标签不使表格横向溢出。 |
| `stateAndPermission` | **[backend-acceptance]** platform workspace 授权仍由既有 edge/owner 判定；移除 DisplayName 字段不改变授权。**[static]** 新字典模块不接收用户输入、workspace scope 或授权值。 |
| `navigationAndRefresh` | **[focused]** 修改系统、服务商或绑定成功后只重取对应列表/详情与受影响业务渠道详情；本地字典永不通过 RTK 请求刷新。 |
| `collectionShapeAndScale` | 系统、方案、绑定集合保持既有形态；字典是编译期固定 Map；节点路径是单个 read model 的有限祖先链，不是分页集合。 |
| `dataSourceAndCascade` | `externalSystemDisplayName`、`providerDisplayName`、`bindingDisplayName` 仍来自 collaboration owner；code 标签来自 `collaborationCodeLabels.ts`；静态 catalog 中 46 个翻译位置退役后，runtime 只读 codes 与业务实体。 |
| `forbiddenUI` | 不出现后端翻译字段、raw code fallback、新“字典管理”入口、权限由前端字典推断、把 binding display name 当枚举标签。 |

## 4 · BASE1-IA-03 · 邀请、账号 readiness 与用户任职

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 邀请人只向可绑定账号和启用角色发出邀请；受邀人完成验证时得到可行动的拒绝，而不是完成任职后才发现无法登录。 |
| `actorAndScenario` | 平台账号管理员、五类运营用户管理员和公开邀请受邀人；沿用既有邀请 Panel/Drawer/公开页。 |
| `entryAndSurface` | `/platform/workspace-accounts`、五类 `access/*-users` 页面及公开邀请入口；`PlatformInvitationPanel`、`WorkspaceInvitationCreateDrawer`、`WorkspaceInvitationDetailDrawer`、`WorkspaceInvitationPanel`、`PublicInvitationEntry`。 |
| `controlType` | readiness 的 `accountExists` 四态只控制公开邀请流程分支，不向用户显示内部枚举。`ABSENT` 进入凭据创建，`ENABLED` 进入已有账号确认；`DISABLED/VOIDED` 停在当前 surface 并显示不可绑定说明。邀请 URL 由前端用结构化 origin/basePath/token 事实生成并由统一复制组件消费。角色候选只列启用角色。 |
| `validationAndError` | 创建与完成两处 `DISABLED/VOIDED` 均以 `ACCOUNT_NOT_BINDABLE`/422 映射为“该账号当前不可接受邀请，请联系空间管理员”；不显示账号究竟是停用还是标记删除，避免泄露治理细节。角色不可用显示“所选角色当前不可用于新邀请，请重新选择”。 |
| `accessibilityAndTestId` | 使用既有 `public-invitation-verify`、`public-invitation-save`、`platform-invitation-roles`、`operations-workspace-invitation-link`，新增 `public-invitation-account-not-bindable`；错误区 `role=alert`；失败后焦点回到错误摘要或角色选择器。 |
| `emptyLoadingErrorStates` | readiness 读取中禁用下一步；失败保留已验证上下文并提供重试；角色候选为空显示“当前没有可用于邀请的角色”；不得把失败当 ABSENT。 |
| `containerBehaviorUnderLoad` | 沿用既有 Drawer/Panel 唯一滚动区；长邀请链接在展示区截断但复制完整值；角色候选弹层独立滚动，页脚操作不出视口。 |
| `stateAndPermission` | **[backend-acceptance]** 创建邀请时角色在 insert 前由 workspace-IAM owner 锁定并复核 ENABLED；创建/完成遇不可绑定账号均零 assignment、credential、intent 写入；五种 operation 的静态授权身份保持分离。 |
| `navigationAndRefresh` | **[focused]** 创建成功刷新当前邀请列表；422 保留表单且不刷新；完成成功进入既有完成态；完成失败回滚 `COMPLETING`，页面停在可重试状态。 |
| `collectionShapeAndScale` | 五类邀请/用户集合继续按各自 operation 读取，不合并为客户端 `targetType`；role candidate 使用既有 bounded candidate；readiness 是单对象。 |
| `dataSourceAndCascade` | 账号四态、角色状态、邀请状态由 workspace-IAM owner 返回；邀请 URL 由前端 presentation helper 组合，不写回 owner。D02=B：VOIDED 账号永久占用手机号与登录名，同一身份不存在“历史 VOIDED + 当前非 VOIDED”双行，UI 不做归并。 |
| `forbiddenUI` | 不出现 `ABSENT/ENABLED/DISABLED/VOIDED` raw 值、UUID、token 明文日志、按名称反查角色、单个泛化 targetType 接口、兼容 boolean `accountExists` 分支。 |

## 5 · BASE1-IA-04 · 合同概览

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 平台管理员查看合同阶段与合同项目事实；运营人员在门店和租户均可用于新业务时创建合同。 |
| `actorAndScenario` | 平台合同查看者及运营合同创建者；沿用 `/platform/contract-overview` 与既有合同管理页面。 |
| `entryAndSurface` | `PlatformReadPage(kind="contracts")` 的列表/详情和 operations `ContractManagementPage` 的创建 surface；不新增 route。 |
| `controlType` | `phaseName` 作为 nullable 原始事实显示；为空用明确空态。`itemSummary` 删除，前端从结构化 items 在现有容器内逐项展示，不重新拼成服务端摘要字段。 |
| `validationAndError` | 新建时 store 或 tenant 不为 ENABLED，显示 owner typed problem 对应业务说明并保留表单；已有合同管理、历史和审计不因当前有效状态丢失。 |
| `accessibilityAndTestId` | 使用既有 `platform-contract-table`、`platform-contract-detail-drawer`、`operations-contract-create-phase`、`operations-contract-create-item-code-${index}`、`operations-contract-create-item-name-${index}`、`operations-contract-create-problem`；项目列表有语义列表/表格结构，空 phase 不以颜色表达。 |
| `emptyLoadingErrorStates` | items 为空显示“当前合同没有项目”；读取失败保留旧数据；创建失败保留输入。 |
| `containerBehaviorUnderLoad` | 结构化 items 随既有容器纵向滚动；长项目名换行或截断加提示，详情操作区固定。 |
| `stateAndPermission` | **[backend-acceptance]** 创建前 owner 在同一事务锁定 store 与 tenant 并验证 ENABLED；任一不满足均零 contract/extension/audit 写入；读取授权不变。 |
| `navigationAndRefresh` | **[focused]** 创建成功刷新当前合同列表/详情；拒绝不刷新；平台概览只在 query invalidation 后重读。 |
| `collectionShapeAndScale` | 合同 overview 保持既有 Page；items 是合同 detail 的结构化子集合；不把页面字段需求转成 probe 参数，不引入 `fields`。 |
| `dataSourceAndCascade` | phase 与 items 由 contract owner 返回；前端只负责布局。store/tenant 各自状态由 organization owner 在创建命令的 policy read 中提供。 |
| `forbiddenUI` | 不出现 `itemSummary`、后端拼接的项目句子、隐藏字段 probe、根据前端已加载组织列表决定能否创建。 |

## 6 · BASE1-IA-05 · 商品目录、商品详情与库存对象

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 运营人员在不改变目录树、十列列表和 SKU 子行的前提下，从结构化事实理解商品、引用和库存换算。 |
| `actorAndScenario` | 总公司或门店商品/库存运营人员；进入既有商品工作台、商品详情、分类操作或库存详情。 |
| `entryAndSurface` | `catalog/brand-items`、`catalog/store-items`、`inventory/status`；既有 `CatalogItemViewDrawer`、`CatalogItemAssemblerDrawer`、分类操作 Modal、`InventoryDetailDrawer`。 |
| `controlType` | 删除 category path、规格/选项、属性、制作、标签、SKU 维度、引用关系、blocking reference、conversion 的人读装配字段后，前端从结构化节点/属性/选项/标签/单位事实呈现；商品名称仍是主文本，编码是次级识别。 |
| `validationAndError` | 结构事实缺失时显示对应空态，不回退 raw JSON 或 code；定义停用后未改引用的保存允许，改选另一个停用定义拒绝；VOIDED 主数据不可编辑/转态。 |
| `accessibilityAndTestId` | 使用 `catalogTestIds.ts` 既有 `catalog-item-view-summary`、`catalog-item-view-attributes`、`catalog-item-view-order-options`、`catalog-item-view-preparation`、`catalog-item-view-references`、`catalog-sku-rows`、`catalog-category-impact`、`catalog-inventory-conversion-factor`；结构字段在这些稳定 surface 下呈现。 |
| `emptyLoadingErrorStates` | 结构化集合空时使用既有业务空态；刷新中保留 currentData；失败保留旧详情且显示重试，不能把失败当无引用。 |
| `containerBehaviorUnderLoad` | 目录树、十列表格、父商品折叠与 SKU 缩进行为不变；详情唯一 Drawer body 滚动；长名称截断加提示；结构化标签换行但不撑宽表格。 |
| `stateAndPermission` | **[backend-acceptance]** catalog/inventory scope 授权保持既有 owner 复核；前端装配不成为授权判断。VOIDED 编码释放后，新对象仍按 ref 身份隔离历史对象。 |
| `navigationAndRefresh` | **[focused]** 商品/分类/定义 mutation 成功按既有 tag policy 精确失效相关列表、详情和候选；presentation helper 不保存镜像 state。 |
| `collectionShapeAndScale` | 商品列表继续 Page，SKU 是已裁定的懒加载子集合；流水、历史、ledger 继续独立分页；路径、标签、属性、选项是当前 read model 的结构化有限集合。 |
| `dataSourceAndCascade` | 所有结构事实由 catalog/inventory owner 返回；前端只组合可见文案。`skuSummary`、`inventoryDeductionSummary`、`changeSummary` 是结构化聚合事实，保留。 |
| `forbiddenUI` | 不改变目录树/结果域/筛选/十列顺序；不把编码当名称；不显示 raw kind/UUID；不新增 `fields` probe；不把 paged 子集合塞进 detail。 |

## 7 · BASE1-IA-06 · 属性库、点单选项库、单位库生命周期

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 在商品元数据 Modal 内启用、停用、标记删除或恢复可恢复对象，并使新引用只选择可用定义。 |
| `actorAndScenario` | 商品元数据维护者；进入既有属性库、点单选项库、计量单位 Tab。 |
| `entryAndSurface` | `CatalogDictionaryDrawer` 及 `CatalogDefinitionLibraries`；不新增独立页面。 |
| `controlType` | 旧删除/单位停用动作统一为“更改状态”动作；状态三项文案“启用 / 停用 / 标记删除”。停用项仍可编辑与重新启用；VOIDED 行保留治理可见但只读，编码可被新 ref 复用。 |
| `validationAndError` | 新引用只允许 ENABLED；既有未改引用允许保存。D03=C：点单选项值 code 只在 `order_option_definition_ref` 父定义内唯一；不同父定义可复用同一 value code，子值不增加 lifecycle 状态。UI 只在当前父定义内判重，不按 scope 或父状态推断额外释放规则。 |
| `accessibilityAndTestId` | testId：`catalog-attribute-status`、`catalog-order-option-status`、`catalog-unit-status`、`catalog-category-status`、`catalog-lifecycle-transition`；状态操作菜单键盘可达，确认 Modal 回焦来源行。 |
| `emptyLoadingErrorStates` | 列表空/加载/错误沿用既有 IA；VOIDED 过滤由明确筛选控制，不由前端默默丢弃。 |
| `containerBehaviorUnderLoad` | 沿用 metadata Modal 唯一滚动区与已批准上界；状态列和操作区不溢出，长名称截断加提示。 |
| `stateAndPermission` | **[backend-acceptance]** transition 由 catalog owner 复核 scope、版本和终态；B2 checkpoint 仍保留旧 delete/disable operation 及其原语义，但新 UI 不暴露它们，F3 再原子删除；只隐藏按钮不算授权。 |
| `navigationAndRefresh` | **[focused]** transition 成功刷新当前定义库 Tab、引用候选及受影响 detail；失败保留行和确认状态。 |
| `collectionShapeAndScale` | 属性库、点单选项库、单位库保持各自既有 Bounded 集合与上界，不合并成新的 bootstrap 接口。 |
| `dataSourceAndCascade` | lifecycle 状态由 catalog owner；前端字典只负责三态文案。子值仍是 aggregate 子集合，不因父生命周期原则被机械改成软删。 |
| `forbiddenUI` | 不保留“删除”HTTP 语义的兼容按钮；不显示 DRAFT/ARCHIVED；不创建后端字典接口；不把 VOIDED ref 作为候选。 |

## 8 · BASE1-IA-07 · 跨 surface 的闭集字典与名称/编码显示

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 用户在所有受影响 surface 获得一致业务语言，而后端只传代码和业务实体事实。 |
| `actorAndScenario` | BASE1-IA-01..06 的所有角色；任何消费 13 个逻辑代码闭集 DisplayName（15 个 schema occurrence）、四类翻译 payload 或组织路径的列表、详情、表单。 |
| `entryAndSurface` | 不新增入口；覆盖业务渠道、外部协作、邀请/账号、商品/库存既有 surfaces。 |
| `controlType` | 三个前端字典住址：operations `businessChannelCodeLabels.ts`、operations `collaborationCodeLabels.ts`、platform `collaborationCodeLabels.ts`；字典以 generated response enum union 的 indexed-access type 为键并用 `satisfies Record<...>` 做编译期穷尽；组织路径统一复用 foundation `presentation/nameCode.ts`。 |
| `validationAndError` | 每个 enum 成员必须在 exhaustive test 中有业务文案；未知值 fail visible，不显示 raw code。实体名为空时按 owner 的 nullable 语义显示空态，不用编码顶替名称。 |
| `accessibilityAndTestId` | 所有状态必须有可读文字；name/code 使用现有 surface testId，编码置于次级文本。字典单元测试覆盖每个成员，不为字典创建 DOM-only 隐藏节点。 |
| `emptyLoadingErrorStates` | 本地字典无加载态；owner 实体读取失败仍走所属 surface 的错误态，不回退字典或缓存。 |
| `containerBehaviorUnderLoad` | 字典标签遵循所属 surface；名称过长截断加提示，编码不挤掉主名称。 |
| `stateAndPermission` | **[static]** 字典模块无网络、scope、authorization、localStorage 或 sessionStorage 依赖；任何动作权限仍来自 owner facts。 |
| `navigationAndRefresh` | 字典不参与 cache invalidation；实体变更按 owner query 失效。 |
| `collectionShapeAndScale` | 字典是编译期有限 Map；实体列表仍按所属 read model 的集合形态；不得把逐记录标签重新写回每行 state。 |
| `dataSourceAndCascade` | code 来自 generated TS；label 来自本地 exhaustive dictionary；业务自定义 name 来自 owner；路径由结构化节点数组按 foundation helper 呈现。 |
| `forbiddenUI` | 不新增 dictionary endpoint、运行时 shapeManifest 字典依赖、catalog enumLabels 翻译 payload、raw code fallback、重复字典实现、sessionStorage 兼容层。 |

## 9 · BASE1-IA-08 · 扩展字段定义、实体消费与集团初始化

| 维度 | 差量取值与可证伪观察 |
|---|---|
| `businessTask` | 运维管理员在已选择 workspace 内管理五类扩展字段完整定义；平台与运营用户在集团初始化、组织、经营主体、门店、合同的既有 surface 中只消费当前场景允许的字段，同时仍能治理被 workspace 阻断的定义。 |
| `actorAndScenario` | 平台字段配置管理员、商业集团初始化人员、平台组织/合同查看者、运营组织/经营主体/门店/合同维护者；沿用 D01-S07P、D01-S07O 和商业集团初始化任务。 |
| `entryAndSurface` | 平台扩展字段既有内容页、`ExtensionsPage`、`ExtensionDefinitionEditDrawer`、`ExtensionDefinitionSaveModal`、`CommercialGroupInitializationDrawer`、`PlatformReadPage`；运营 `OrganizationExtensionFields`、组织创建/编辑/详情、经营主体创建/编辑/详情、门店创建/编辑/详情、合同创建/编辑/详情与门店资料详情。不新增 route、Drawer 或独立扩展值页面。 |
| `controlType` | `ExtensionDefinition` 根显示 workspace 自身状态 dimension 与结构化 blocker；每行继续显示字段自身 `ENABLED/DISABLED`。管理页不合并状态，workspace 不可用时仍允许编辑字段完整集合；集团初始化及实体真实消费只装配该场景要求的 workspace 与 field 两维均可用的字段。 |
| `validationAndError` | workspace 读取失败进入 surface error，不当作 DISABLED；workspace 不可用不阻断字段定义治理；字段自身 DISABLED 不进入新值控件但既有未知值按原规范保留。response/request 缺失 field status 是 contract failure，必须 fail visible，不得按 ENABLED 消费。CAS conflict 仍进入既有 save result Modal；没有任何分支读取或提交 `effectiveStatus`。 |
| `accessibilityAndTestId` | 保留 `extension-definition-table`、`extension-definition-retry`、`extension-definition-edit`、`extension-definition-status-${index}`、`extension-definition-save`、`extension-definition-error`、`platform-workspace-initialize-extension-${field.key}`；新增 `extension-definition-workspace-status`、`extension-definition-workspace-blocker`、`platform-workspace-initialize-extension-blocker`。blocker 文本可读屏，编辑 Drawer 与冲突 Modal 保持 focus trap/关闭回焦。 |
| `emptyLoadingErrorStates` | definition 空集合显示既有字段配置空态；workspace blocker 为空显示“当前空间状态未阻断此字段配置”；根 status 查询失败显示可重试错误，不显示“无阻断”；初始化无可消费字段时保留基础集团表单并显示字段不可用说明。 |
| `containerBehaviorUnderLoad` | 字段定义仍是整体读取、整体编辑、原子 replace 的 JSON aggregate；当前 owner/contract 没有字段数上限，不为分页目的臆造上界或客户端切片。现有 Drawer 唯一 body 滚动、固定页脚、长 label/option 换行规则不变。若未来 Journey 改为逐行浏览，另立 collection operation。 |
| `stateAndPermission` | **[backend-acceptance]** workspace status 由 platform-workspace owner 的共享 lookup 提供；extension owner 返回根 raw dimension 与 field self status。管理授权不因 workspace blocker 扩大；运营 entity owner 在写 extension values 时仍复核 definition 与 scope。 |
| `navigationAndRefresh` | **[focused]** definition replace 成功只失效该 workspace/entityType definition 及依赖它的当前实体表单；workspace transition 失效 workspace detail 与所有当前已加载 definition consumer。恢复 workspace 不写 JSON field status，重读即可恢复下游消费；失败不清空旧 definition。 |
| `collectionShapeAndScale` | `definitions[]` 是单一当前 definition 的有限原子聚合，不是 Page/Cursor/Bounded 列表；platform entity catalog 保持既有 bounded 目录。operations 四个 GET 与 platform GET 返回同一根维度形状，禁止按 face 分叉。 |
| `dataSourceAndCascade` | workspace raw status 来自 `WorkspaceStatusLookup.requireStatus`；field self status 来自 `extension.extension_definition.definitions JSONB` 且 response/update contract 均 required；root blocker 由 owner/edge 根据结构事实给出。前端只以 `field.status === 'ENABLED'` 判定可消费，不用“非 DISABLED”兜底，也不将 workspace 停用同步写入 field。 |
| `forbiddenUI` | 不恢复 `extension_definition_field` 物理模型，不出现 `effectiveStatus`、raw workspace enum、UUID、groupWorkspaceKey、revision、内部 field key 或 problem code；不因 workspace 停用关闭字段治理 Drawer，不把 field DISABLED 改写为 workspace 停用。 |

直接消费者 exact set 以主详设附录 A.3 为准；该清单覆盖 platform 六个文件与 operations 十八个文件，
operations 按组织、门店、合同、经营主体四组归类。任一新增直接 consumer 必须先进入主详设分母，再实施同一 status-dimension
规则。

## 10 · 共用信息架构规则

1. 管理列表与详情同时返回并显示对象自身状态、各上游维度状态和结构化 blockers；不得把它们压成一个 `effectiveStatus`。
2. 候选、新增引用、真实业务准入和下游消费按当前场景需要的维度判断；管理编辑、重新启用、未改引用保存只以自身终态和变更内容为准；历史、审计、快照、幂等回执不按当前状态过滤。
3. 查看 surface 与编辑 surface 继续分离；停用不把查看变成禁用表单，VOIDED 不提供写动作。
4. 用户界面不出现 UUID、raw kind、problem code、技术字段名、token、内部 operationId 或 SQL 状态值。
5. 商品目录树、结果域/筛选、十列顺序、父商品折叠和 SKU 缩进子行不改变。
6. 名称是主文本，编码是次级识别；组织路径、候选、引用、BOM、库存对象均不得以编码代替名称。

## 11 · 错误语义与界面映射

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---:|---|---|---|
| `ACCOUNT_NOT_BINDABLE` | 422 | 创建或完成邀请遇 DISABLED/VOIDED 账号 | 邀请创建、公开邀请 / workspace-IAM | “该账号当前不可接受邀请，请联系空间管理员”；保留当前输入，不透露具体治理状态。 |
| 角色不可用于新引用的既有/新增 typed problem | 422 | 创建邀请所选角色不是 ENABLED | 邀请创建 / workspace-IAM | “所选角色当前不可用于新邀请，请重新选择”；焦点回角色选择器。problem identity 由实施前 owning registry 复核，不在本稿臆造。 |
| store/tenant 不可用于新合同的既有/新增 typed problem | 422 | 新建合同所需 store 或 tenant 不是 ENABLED | 合同创建 / organization+contract | 展示具体业务主体不可用；保留合同草稿。problem identity 由实施前 owning registry 复核。 |
| `OUT_OF_SCOPE_NO_NEW_PROBLEM` | — | collaboration binding 在哪些场景构成阻断不属于 base-1 | 绑定表单 / collaboration coordinator | 保持既有已裁行为；本批不新增 problem、按钮禁用或预写文案。 |
| `DISABLED_OBJECT_NOT_EDITABLE` | 既有映射 | 旧规则已被“停用可编辑”推翻 | 所有三态主数据 | 从本批 applicable owner 路径删除；不得继续作为停用对象 UI 禁用依据。 |
| VOIDED 终态 typed problem | 既有映射或需 owner registry 补齐 | 标记删除对象不可编辑、不可转态 | 所有三态主数据 | “该对象已标记删除，不能继续修改”；不显示 problem code。具体 identity 实施前按 owner registry 复核。 |

## 12 · 交叉对账与完成判定

| 检查 | 判据 |
|---|---|
| IA ↔ 交互工件 | 路由、surface、目录树、商品十列、Drawer/Modal 生命周期全部沿用；本批只替换事实来源、状态动作与文案装配住址。 |
| IA ↔ 详设 | BASE1-IA-01..08 的 owner、结构化字段、字典住址、缓存失效、testId 与主详设 §7、§9a、§11 逐项一致。 |
| IA-ID ↔ Journey | 业务渠道/协作、邀请/账号、合同、catalog/inventory、定义库/单位、扩展字段与集团初始化分别追到元数据所列既有 Journey；BASE1-IA-07 是横切 presentation 机制，不新增 Journey。 |
| 计数自证 | IA-ID 为 8 个；错误映射表为 5 行 applicable 行 + 1 行明确 out-of-scope guard；需实施前回读 owner registry 的 identity 不构成产品待裁。 |

```text
IA_DIMENSIONS=BASE1-IA-01..BASE1-IA-08，两组维度逐项齐全
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
ERROR_MAPPING_ROWS=5_APPLICABLE_PLUS_1_OUT_OF_SCOPE_GUARD
CROSS_CHECK_WITH_DESIGN=MERGED_D01_B_D02_B_D03_C_ENUM_APPLIED
DEXTER_WIREFRAME_REVIEW=EXISTING_ACCEPTED_SURFACES_UNCHANGED
IA_STATUS=MERGED_UNIQUE_BASELINE_AWAITING_CLAUDE_INDEPENDENT_VERIFICATION;不构成 implementation authorization
```
