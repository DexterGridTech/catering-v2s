---
title: v2s 外部协作与经营渠道 IA 详设
status: ACCEPTED_TEXTUAL_DESCRIPTION
createdAt: 2026-08-19
decisionOwner: Dexter
implementationAuthority: true
journeyRefs:
  - doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md
  - doc/decisions/2026-08-19-v2s-business-channel-management-journey.md
interactionRef: doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md
---

# 外部协作与经营渠道 · IA 详设

```text
IA_SCOPE=P1-P6 + O1-O5
BUSINESS_SOURCE=doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md
SOURCE_RECORDS=doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md#记录 001～012
IA_BASELINE=doc/evidence/platform/rm1/p6/rm1p6-u02-ui-ia-implementation-baseline.json
UI_INTERACTION=doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION
IMPLEMENTATION_AUTHORITY=true
```

本稿按五份 RM1 IA 文档的九维度写法组织，不从当前源码倒推业务。十一个 IA-ID 是文档层稳定锚点；不得进入 runtime、package、controller、测试目录或测试类名。页面/字段的实现复用只指向当前 v2s source 和 foundation，不把 all-v2 当 runtime/build fallback。
IA_ID_NAMING_REASON=本批 P1-P6/O1-O5 与交互工件 Screen 标识一一恒等映射，先保留面向线框的文档局部别名；它们不进入 runtime/test。待 Dexter 确认后，如需纳入仓内 IA0X-面-屏 总目录，再做一次文档级编号映射，不改变业务或实现语义。

## 1. 共用信息架构规则

### 1.1 数据来源与级联

1. **四个级联维度**：`accessKind`（内部/外部）→ `operatorKind`（项目/门店）→ `orderKind`（到店/外卖/团购）→ `dineInForm`（POS/扫码/自助机，仅到店生效）。外部时再选择能力分类和当前空间已启用的 provider profile；provider 的认证方式、可绑定节点类型和解绑方式只读显示。
2. **能力属性**：`external_system.capabilities[]` 由 checked-in contract 定义；每个属性必须有业务 `label`、`helpText` 和可渲染 control kind。`catalogStatus=PLANNED` 是信息标记；只要 contract 有定义且空间 enablement 已启用，就可显示/启用/进入运营候选。
3. **节点路径**：集团/大区/项目来自商场运营方组织树；总公司/门店来自 tenant side。门店是项目内经营点，不是组织树下级；品牌和实际经营租户是门店属性/关联，不放进绑定路径。
4. **平台候选**：P6 使用 `usePlatformOrganizationCandidates`；扩展 `subjectType` 的 `COMMERCIAL_GROUP`/`REGION` 与 `candidateUsage=EXTERNAL_BINDING` 只为候选用途，不新建 operation。操作候选使用 `useOrganizationCandidates`，同样保留 `PAGE_SIZE=50`、debounce、selectedId 回显、滚动累加和 total。
5. **状态**：契约定义全局；`enablement_state` 无行默认停用，按集团空间隔离；binding、template、channel 运行事实按集团空间隔离。停用对象仍可读、置灰、不隐藏；置灰对象不可编辑。

### 1.2 只读/编辑原则

- P1/P2/P3/P4/P5 以读为主；P2/P3 只有启停命令，P5 的绑定动作按认证方式显示。
- P6 的节点类型、节点和主体编号按 provider profile 的认证方式决定可编辑/只读；platform-admin 的新建/编辑仅适用于 `INTERNAL_MAPPING` 与 `NO_MAPPING`；`EXTERNAL_GRANT` 在 platform 面只保留删除/解绑说明，创建时 `externalOwnerId` 可空的规则属于运营渠道授权流程。
- O1/O3/O5 列表只提供 bounded 结果、表头临时排序、详情入口和被授权的动作；不提供搜索、查询、重置或分页；O2 负责模板四维；O4 负责渠道详情和进入动作。
- 运营侧只有两个写 capability：项目渠道编辑、门店渠道编辑；读不设独立 capability。platform-admin 无 capability，使用有效 platform session + collaboration owner recheck。

### 1.3 通用禁止 UI

所有十一个 IA 都不得出现：

- token、credential、原始授权码、`authorizationRef` 值、原始 callback payload、签名或外部 URL；
- `nodeRef` UUID 作为用户文字、原始 enum literal 作为标签、以“节点”代替具体业务名称；
- 非渠道绑定的运营侧维护入口、第三个渠道写 capability、以 capability 过滤 GET；
- 因 `catalogStatus=PLANNED` 隐藏/禁用系统或档案；
- 因门店停用阻断新 binding/channel；
- 停用对象的删除按钮、保存按钮或从列表移除；
- `NO_MAPPING` 的 externalOwnerId 输入框；`EXTERNAL_GRANT` 的人工“标记为已授权”；
- 依 C-01/C-02/C-04/C-08/C-09 预先新增数据库唯一索引、状态枚举、复杂规则 DSL、成本机器门或统一 polymorphic node abstraction；C-03 已按规格收口为渠道编码集团空间唯一。

## 2. 十一个 IA-ID 九维度

### IA-P1：外部系统树

```text
businessTask=在指定集团空间定位外部系统或接入档案，并看到该空间启停状态。
actorAndScenario=运维管理员已认证并已在 WorkspaceScope 选择集团空间；进入外部系统接入配置页面。
entryAndSurface=platform-admin 独立页面 /platform/external-collaboration；集团空间由 WorkspaceScope 会话上下文提供；左侧 bounded tree，右侧未选态/详情承载区。
controlType=本地树搜索；树节点选择；只读状态 Tag；不在树中直接编辑敏感/契约事实。
dataSourceAndCascade=external_system/provider_profile checked-in catalog + 当前 workspace enablement read；系统节点展开 provider profile；选择 provider 后进入 IA-P3/P4。
validationAndError=读取失败使用当前 edge typed problem；不为树节点的“出现即缺陷”编造 HTTP reject；PLANNED 只显示信息标记，不影响启用。
stateAndPermission=platform session + owner recheck；无 operations capability；停用系统/档案仍显示并置灰；系统未选时右侧为空态。
navigationAndRefresh=WorkspaceScope 变更使 query identity 重置；选择系统打开 P2，选择 provider 打开 P3；启停成功只精确刷新受影响节点和下游状态。
accessibilityAndTestId=树节点键盘可达、aria-expanded/aria-selected、状态文本不只靠颜色；testId: platform-external-collaboration-tree / platform-external-system-node-<code> / platform-provider-profile-node-<code>。
```

### IA-P2：外部系统详情

```text
businessTask=查看一个 external_system 的能力分类、属性业务含义和当前集团空间启停状态。
actorAndScenario=运维管理员从 P1 选择系统；系统定义已存在于 checked-in contract，运行态只提供空间状态。
entryAndSurface=P1 右侧详情面板；可用 PlatformReadPage 的树+详情布局，不另造 app shell。
controlType=只读名称/编码/能力属性；启停状态控件；确认 Modal；能力属性按“属性 / 当前值 / 说明”三列表格展示。
dataSourceAndCascade=external system detail aggregate + enablement_state；能力属性表格按 descriptor label、中文当前值、helpText 渲染；provider 子节点不在系统详情中伪装成分页表。
validationAndError=启停命令失败按 owner typed problem 展示；`PROVIDER_NOT_ENABLED` 只用于下游提交/候选，不能把 PLANNED 映射为该错误；版本冲突为 VERSION_CONFLICT；旧 readback 缺显示字段时按 `—`/空集合渲染且不得崩溃，不从机器字面量补中文。
stateAndPermission=平台 session + platform owner final recheck；启用/停用可操作取决于 owner 状态，不取决于 catalogStatus；停用后下游仍可读、置灰。
navigationAndRefresh=成功返回最新 system readback；P1 树节点、P3 provider 状态和 O2 candidate query 精确失效；失败留在详情且保留旧状态。
accessibilityAndTestId=属性有可读 label/helpText；开关有 aria-label 和状态文本；testId: platform-external-system-detail / platform-external-system-status。
```

### IA-P3：接入档案详情

```text
businessTask=理解 provider_profile 的业务范围、可绑定节点、认证与解绑方式，并控制该档案空间启停。
actorAndScenario=运维管理员从 P1 选中接入档案；需在当前集团空间内看其绑定关系。
entryAndSurface=P1 右侧 provider detail；两个内容 Tab：详情与绑定关系；Tab 是独立 surface。
controlType=字段只读描述；启停状态控件；绑定关系 Tab；按认证方式呈现操作说明而非技术值。
dataSourceAndCascade=provider contract + provider enablement + P4 binding Page；provider businessScope 是 external_system capabilities 的子集；bindableNodeTypes 只用于管理候选。
validationAndError=启停失败按 typed owner problem；P3 只读不触发 BR-03/04/05；不因 bindableNodeTypes 推导 IAM access；敏感值永不入 response/DOM。
stateAndPermission=platform session + owner recheck；需外部授权的 binding 只能删除/解绑相关操作；非外部授权 binding 可增改删；停用档案置灰但保留。
navigationAndRefresh=详情 Tab↔P4 保留 provider/workspace query identity；启停成功刷新 P1/P4/O2 候选；Tab 切换不重复生成另一套数据真相。
accessibilityAndTestId=Tab 有 role/tablist/aria-controls；认证说明可读；testId: platform-provider-profile-detail / platform-provider-profile-tabs / platform-provider-profile-status。
```

### IA-P4：绑定关系列表

```text
businessTask=按 provider profile 浏览当前集团空间的 owner_binding 服务端 Page，找到某条绑定进入详情。
actorAndScenario=运维管理员在 P3 进入绑定关系 Tab；列表可能超过一页，需要真实 SQL Page。
entryAndSurface=P3 内容 Tab 内标准分页表格；可搜索绑定名称/节点名称；首列打开 P5。
controlType=搜索框、查询/重置、分页、首列链接、新建绑定按钮；不提供批量删除或隐藏停用对象。
dataSourceAndCascade=collaboration 服务端 Page（bindingName/nodeQueryText/page/pageSize/sortKey/sortDirection）；nodeType+nodeRef 由 collaboration read 与 organization task lookup 映射为业务名称；businessScopeDisplayNames、externalOwnerId/status 可读；authorizationRef 值不返回。
validationAndError=page query 失败不清空当前结果；版本冲突只在 mutation；跨空间/越权由 owner typed access denied；不把空页伪装成无绑定。
stateAndPermission=platform session + provider/workspace owner recheck；停用 binding 仍在表中；删除是标记删除，列表默认仍可按搜索读历史事实。
navigationAndRefresh=usePageQuery/createPageQueryIdentity/contextScopedQueryArgs；新建/删除成功回到当前页并按精确 cache/query identity 刷新；详情关闭恢复列表；内容 Tab 的统一刷新必须覆盖该 Page 与打开的只读详情，不覆盖脏表单。
accessibilityAndTestId=表头与分页可读；状态颜色有文字；testId: platform-owner-binding-list / platform-owner-binding-filter / platform-owner-binding-detail-<stableRef>。
```

### IA-P5：绑定详情

```text
businessTask=核对一条 owner_binding 的业务身份、节点名称、业务范围、外部主体编号和授权状态。
actorAndScenario=运维管理员或运营用户从绑定首列进入；详情必须以最新 owner readback 为准。
entryAndSurface=platform-admin P4 Drawer；operations-admin 在 O4 的绑定区可复用同一 Detail surface，但 face/owner 仍分别声明。
controlType=只读详情描述；认证方式决定编辑/删除/解绑 action；不显示 raw payload。
dataSourceAndCascade=owner_binding detail + organization node display lookup；P4 业务字段完整返回；nodeRef 只做内部定位。
validationAndError=读取失败展示 typed problem；不以 nodeRef 缺失替换业务名称；敏感字段不应出现，出现属于 BR-19 红夹具，不定义“脱敏后继续显示”补丁。
stateAndPermission=platform-admin 依 platform session；operations 依页面读 scope；写操作再由 grant/owner 判断；需授权绑定无手工有效入口。
navigationAndRefresh=关闭 Drawer 返回来源列表；编辑成功返回最新 detail；删除成功进入 binding deleted readback/渠道草稿处理，不静默跳空页。
accessibilityAndTestId=Drawer 标题、字段 label、关闭/确认按钮可达；testId: owner-binding-detail / owner-binding-delete / owner-binding-authorization-state。
```

### IA-P6：绑定新建/编辑

```text
businessTask=按档案允许的节点类型建立或修改非外部授权 owner_binding；外部授权 binding 由运营渠道授权流程建立并在 platform 面回读状态。
actorAndScenario=运维管理员维护非渠道 binding，或运营用户在渠道上下文维护对应 binding；目标节点与 capability 由各 face owner 再核验。
entryAndSurface=P4/P5 Drawer；operations 从 O4 的绑定 action 打开同一业务能力但使用 operations edge 和 grant。
controlType=节点类型 searchable Select；节点 searchable Select；externalOwnerId 条件输入/只读；提交/取消；不提供 token/授权码输入。
dataSourceAndCascade=provider profile bindableNodeTypes → nodeType candidate → nodeRef candidate；商场路径为 COMMERCIAL_GROUP/REGION/PROJECT，租户路径为 HEAD_COMPANY/STORE；认证类型决定 externalOwnerId。
validationAndError=严格映射 NODE_TYPE_NOT_BINDABLE、EXTERNAL_OWNER_ID_MISMATCH、BINDING_EDIT_NOT_ALLOWED、IMMUTABLE_FIELD、VERSION_CONFLICT、AUTHORIZATION_REQUIRED；platform 面不得创建 `EXTERNAL_GRANT`，运营授权流程不得因创建时缺少 externalOwnerId 失败。
stateAndPermission=停用/置灰对象不可编辑；platform 面的 `EXTERNAL_GRANT` 仅删除/解绑相关操作，待授权状态只读；`INTERNAL_MAPPING` 外部主体编号必填；`NO_MAPPING` 无输入且创建即有效。
navigationAndRefresh=上游改变清理下游选择；保存以 owner readback 关闭 Drawer 并刷新 P4/O4；失败保留表单与最新错误，不重置到默认节点。
accessibilityAndTestId=字段 label/required/disabled 与认证说明一致；testId: owner-binding-form / owner-binding-node-type / owner-binding-node / owner-binding-external-owner-id / owner-binding-submit。
```

### IA-O1：项目经营渠道管理页

```text
businessTask=在项目数据节点维护模板与项目主体渠道实例。
actorAndScenario=集团/大区/项目角色进入 operations-admin；当前 data node 固定为 PROJECT。
entryAndSurface=独立页面 /operations/:groupWorkspaceKey/business-channels/project；上模板、下项目渠道。项目数据节点由已确认的 WorkspaceScope/queryContext 提供；projectRef 只存在于 owner API 请求与服务端授权复核，不作为浏览器路由 scope。
controlType=经营渠道模板与项目主体经营渠道两个 bounded 结果表格；不提供搜索、查询、重置或分页，仅提供表头临时排序；新建模板/新建渠道；模板列含名称/编码，渠道列固定为名称/编码/来源模板/状态/绑定状态；渠道名称与模板名称首列进入只读详情 Drawer；详情中的编辑动作再打开独立表单 Drawer；不显示门店主体模板作为项目渠道事实。
dataSourceAndCascade=business-channel template bounded read + project channel bounded read；owner 固定上限由服务端提供，表头排序通过 `sortKey/sortDirection` 重新读取，前端不做过滤或展示切片；外部模板候选读取 collaboration enablement/provider；同一模板允许多实例，但 templateCode 按项目唯一、channelCode 按集团空间唯一。
validationAndError=读取无 capability 依赖；写失败显示 PROVIDER_NOT_ENABLED、DINE_IN_*、ORDER_KIND_MISMATCH、BINDING_NOT_EFFECTIVE、DUPLICATE_CODE、DISABLED_OBJECT_NOT_EDITABLE、IMMUTABLE_FIELD、VERSION_CONFLICT。
stateAndPermission=项目渠道编辑 grant 控制模板、项目渠道及对应 binding 写；角色范围控制主对象读取；门店停用不阻断新建。
navigationAndRefresh=页面上下文由 WorkspaceScope/queryContext；模板成功后只刷新模板表；渠道成功后只刷新渠道表；详情/Drawer 关闭保留当前表头排序状态。
accessibilityAndTestId=两个表有独立标题与 aria region；testId: project-business-channel-page / project-business-channel-template-list / project-business-channel-list。
```

### IA-O2：渠道模板新建/编辑

```text
businessTask=定义项目维护的四维经营渠道模板，并在外部接入时选择当前空间开放的 provider profile。
actorAndScenario=商场运营方持有项目渠道编辑 capability；目标模板 owner 是 PROJECT。
entryAndSurface=O1 的新建模板或模板详情 Drawer 的编辑动作打开独立表单 Drawer；门店页不创建模板，只选择项目模板；模板停用/启用只在只读详情 Drawer 承载。
controlType=名称 Input；创建时必填且编辑时只读的模板编码 Input；接入类型 Radio；经营主体 Select；订单类型 Select；到店点餐形式条件 Select；外部档案 bounded searchable Select；保存/取消；不在表单内承载停用命令。
dataSourceAndCascade=四维字段由 template owner；外部档案由 collaboration bounded candidate；provider profile 的 authenticationKind/bindableNodeTypes 只读说明；PLANNED 只作标签。
validationAndError=BUSINESS_SCOPE_EXCEEDED、ORDER_KIND_MISMATCH、DINE_IN_MUST_BE_INTERNAL、DINE_IN_FORM_MISMATCH、PROVIDER_NOT_ENABLED、DUPLICATE_CODE、IMMUTABLE_FIELD、DISABLED_OBJECT_NOT_EDITABLE、VERSION_CONFLICT；BR-01/02/30 为 contract publish，不在页面伪造。
stateAndPermission=模板编码与四维创建后不可变；停用模板保留且置灰；仅 PROJECT target grant；运营 GET 不看 capability。
navigationAndRefresh=接入类型/订单类型变化清理下游；保存成功回模板列表；停用只写状态并由 owner cascade channel；失败保留表单。
accessibilityAndTestId=条件字段隐藏时不保留 stale value；testId: business-channel-template-form / business-channel-template-access-kind / business-channel-template-operator-kind / business-channel-template-order-kind / business-channel-template-dine-in-form / business-channel-template-provider。
```

### IA-O3：项目经营渠道列表

```text
businessTask=查看和定位项目主体的渠道实例，允许同一模板创建多条渠道。
actorAndScenario=商场运营方在 O1 下半区；主对象为 PROJECT business_channel。
entryAndSurface=O1 内容页下半区 bounded 结果表格；首列进入 O4。
controlType=bounded 结果表格；不提供名称/编码搜索、查询、重置或分页；表头支持临时排序；新建渠道；首列渠道名称详情；渠道编码独立只读列；状态/绑定状态只读呈现。
dataSourceAndCascade=business-channel bounded read；template displayName、channelCode、channelName、status、binding status；表头排序由 owner bounded read 处理；owner read 不隐藏级联停用对象，且不承诺当前行数上限；历史空编码只显示 `—`。
validationAndError=列表错误不覆盖当前结果；写命令按 typed problem；外部绑定无效只阻止渠道生效，不阻止草稿/绑定管理。
stateAndPermission=项目渠道编辑 grant 只控制写；读按 role node scope；MANUAL/CASCADE stopReasons 都映射为业务说明。
navigationAndRefresh=表头排序状态作为 bounded read query identity；新建/编辑/绑定回读后刷新当前项目 bounded channel read；不跳到门店页。
accessibilityAndTestId=编码单列、名称单列且名称列可聚焦进入详情；testId: project-business-channel-list / project-business-channel-open-detail-<channelRef>。
```

### IA-O4：经营渠道详情

```text
businessTask=理解一个项目或门店渠道的四维、模板、绑定和当前状态。
actorAndScenario=商场运营方或店铺运营方从 O3/O5 首列进入；主对象 owner 先读最新事实。
entryAndSurface=独立只读详情 Drawer；根据来源 face 保留 platform/operations owner boundary；不要把两个 app 合并成一套 shell；编辑动作关闭详情后打开独立编辑表单 Drawer。
controlType=只读详情；编辑/维护绑定/停用 action 按状态和 grant；无手工“置为有效”；编辑表单不复用详情布局。
dataSourceAndCascade=channel detail + template read + optional binding detail；bindingRef 仅用于 owner join；stopReasons 转业务文案。
validationAndError=BINDING_NOT_EFFECTIVE、DISABLED_OBJECT_NOT_EDITABLE、IMMUTABLE_FIELD、DELETE_NOT_ALLOWED、VERSION_CONFLICT；出现凭证值属于 BR-19 红夹具，不靠前端修剪。
stateAndPermission=渠道名称与渠道编码均为只读事实；门店主体 target 必须 STORE；项目主体 target 必须 PROJECT；内部渠道不显示外部授权回填占位且创建即生效；外部渠道按 binding 状态决定 DRAFT/EFFECTIVE；渠道停用/模板停用/外部停用分别可读并置灰。
navigationAndRefresh=关闭返回来源列表；成功命令回最新 detail；binding 删除后渠道草稿与 bindingRef 清除由 edge owner readback 证明。
accessibilityAndTestId=详情字段有业务 label；testId: business-channel-detail / business-channel-edit / business-channel-binding / business-channel-status。
```

### IA-O5：门店经营渠道管理页

```text
businessTask=在门店数据节点查看并维护门店主体渠道，只选择上级项目维护、经营主体为门店且有效的门店模板。
actorAndScenario=集团/大区/项目/门店角色进入 operations-admin；当前 data node 固定为 STORE。
entryAndSurface=独立页面 /operations/:groupWorkspaceKey/business-channels/store；不承载模板 CRUD；首列进入只读详情 Drawer，详情编辑再打开独立表单 Drawer。门店数据节点由已确认的 WorkspaceScope/queryContext 提供；storeRef 只存在于 owner API 请求与服务端授权复核，不作为浏览器路由 scope。
controlType=可选门店模板与门店主体经营渠道均使用 ProTable 结果表格（不提供搜索或分页，表头支持临时排序）；新建渠道表单 Drawer；渠道只读详情 Drawer与独立编辑表单 Drawer；模板候选内部仍使用上级项目 provider/template cursor candidate protocol，但不把 cursor/pageSize 暴露为用户分页。
dataSourceAndCascade=store channel bounded read + project-owned template cursor candidate read filtered `operatorKind=STORE AND status=ENABLED`（只返回上级项目维护且有效的门店模板）；候选表列为模板名称/模板编码/接入类型/订单类型，不重复显示已由查询谓词保证的状态；模板表头排序通过 candidate query 的白名单 `sortKey/sortDirection` 与 cursor 一起由 owner 处理，渠道表头排序由 owner bounded read 处理；storeRef 的 project owner read 仅作关系事实，不放宽 scope。
validationAndError=模板候选不因 store status 被剔除；写失败映射两个 capability target、BINDING_NOT_EFFECTIVE、PROVIDER_NOT_ENABLED、DUPLICATE_CODE、VERSION_CONFLICT 等 typed problem。
stateAndPermission=门店渠道编辑 grant target STORE；页面可读角色按四类；非渠道 binding 无入口；停用对象仍在表内置灰。
navigationAndRefresh=useOrganizationCandidates 仅用于业务关系候选；模板候选的 cursor、排序或 query context 改变即重置并重新收集；表头排序状态随对应 owner read 变化；bounded channel read 成功回读后刷新当前 store channel list。
accessibilityAndTestId=页面标题明确“门店”；testId: store-business-channel-page / store-business-channel-list / store-business-channel-create / store-business-channel-template-select。
```

## 3. 错误语义与界面映射（15 个 typed problem 全量）

| problem code                   | HTTP | BR 映射      | 触发界面/owner            | 用户可见处理                                 |
| ------------------------------ | ---: | ------------ | ------------------------- | -------------------------------------------- |
| `BUSINESS_SCOPE_EXCEEDED`      |  422 | BR-03        | P6/O2/O4 owner validation | 指向业务范围字段，保留其它输入               |
| `NODE_TYPE_NOT_BINDABLE`       |  422 | BR-04        | P6 binding command        | 节点类型重新选择                             |
| `ORDER_KIND_MISMATCH`          |  422 | BR-05        | O2/O4                     | 指向订单类型/档案绑定关系                    |
| `DINE_IN_MUST_BE_INTERNAL`     |  422 | BR-06        | O2                        | 指向接入类型并清理不兼容的外部档案           |
| `DINE_IN_FORM_MISMATCH`        |  422 | BR-07        | O2                        | 清理/纠正到店点餐形式                        |
| `PROVIDER_NOT_ENABLED`         |  422 | BR-08、BR-35 | O2/P6                     | 显示当前空间未开放；不说“PLANNED 不可用”     |
| `BINDING_NOT_EFFECTIVE`        |  409 | BR-09        | O4/O3/O5                  | 留在草稿并引导维护绑定                       |
| `AUTHORIZATION_REQUIRED`       |  409 | BR-10        | P6/O4                     | 显示等待外部授权，不提供手工有效化           |
| `BINDING_EDIT_NOT_ALLOWED`     |  403 | BR-11        | P5/P6                     | 隐藏编辑入口并对直接请求显示拒绝             |
| `EXTERNAL_OWNER_ID_MISMATCH`   |  422 | BR-12        | P6 / adapter callback     | 显示 owner 校验失败，不把编号当授权输入      |
| `DUPLICATE_CODE`               |  409 | 编码唯一性   | O2/O3/O5                  | 指向模板/渠道编码字段，保留其它输入         |
| `DISABLED_OBJECT_NOT_EDITABLE` |  409 | BR-14        | P5/O4/O2                  | 置灰详情只读，刷新最新状态                   |
| `IMMUTABLE_FIELD`              |  422 | BR-18        | P6/O2/O4                  | 标出创建后不可改字段                         |
| `DELETE_NOT_ALLOWED`           |  403 | BR-21        | O2/O4                     | 不显示删除；直调时 typed reject              |
| `ADAPTER_UNBIND_REQUIRED`      |  409 | BR-23        | P5/P6/O4                  | 显示外部解除授权依赖；C-04 分支保持未决      |
| `VERSION_CONFLICT`             |  409 | CAS          | 所有写 surface            | 关闭旧编辑态、读取最新详情、允许用户重新确认 |

BR-01/BR-02/BR-30 是 contract publish validation，不产生 HTTP；BR-13/BR-15/BR-19/BR-20/BR-22/BR-27/BR-28/BR-29/BR-31/BR-32/BR-34 等“出现即缺陷”项由红夹具或人工 review 证明，不添加伪造的 reject code。

## 4. IA 完成判定

```text
IA_NINE_DIMENSIONS=P1-P6,O1-O5 each complete
IA_FORBIDDEN_UI=explicit
TYPED_PROBLEMS=16 total, including VERSION_CONFLICT
CONSUMER_FACES=platform-admin / operations-admin separate
FOUNDATION_REUSE=declared per screen
DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION
IA_STATUS=ACCEPTED_TEXTUAL_DESCRIPTION; implementation authorization is recorded in the frontmatter and current execution plan
```
