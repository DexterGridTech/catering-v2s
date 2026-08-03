# RM1 双管理后台 UI IA reconciliation v2（Codex）

日期：2026-08-02  
状态：`DENOMINATOR_COMPLETE_RUNTIME_PENDING`（本文件是新对账单，不把历史 PASS 继承为当前 PASS）

## 1. 历史对账为何失真

历史 `rm1p6-u06-ui-interaction-conformance-record.json` 的 38/36/36 exact-set、baseline 的九维对象和
focused test 绑定真实存在，但它们只证明“物理 consumer 与测试文件被登记、源码静态形状可匹配”。它没有逐条
证明共享 shell 控件、AntD 组件语义、视觉位置、加载/空/错误时序、错误文案和点击后的真实 observable result。
因此历史 `allControlDimensionsVerified=true` 是静态汇总，不是逐控件浏览器证据；这正是体验后仍出现缺口的根因。

## 2. 新的固定对账字段

每一行必须填满：

`screenId | consumerPath | IA anchor | task/role | entry/surface | control + AntD API | source/data cascade | validation/error copy | permission/state | refresh/navigation | catalog copy key | test-id/a11y | static proof | runtime proof | status`

禁止用“已读 IA”“已有 test”“ProTable/Drawer 存在”代替字段值。历史行只有静态字段的，先标为
`PASS_STATIC_ONLY`，不得升级总体 PASS。

## 3. 本轮闭集分母

| family | platform-admin | operations-admin | 当前结论 |
| --- | --- | --- | --- |
| Shell/header/avatar/user menu/refresh/fullscreen | PlatformApp + styles | OperationsApp + styles | `PENDING_RECHECK`：历史 screen binding 未逐项覆盖视觉/入口 |
| Sider 一级/二级菜单、父组 icon、收起/展开、workspace footer | PlatformApp/WorkspaceScope | OperationsApp/WorkspaceScope | `DEFECT_CONFIRMED`：浏览器已见层级、icon、位置和收起态缺口 |
| OTP/密码登录、错误文案、验证码回填 | PlatformLoginPage + transport | OperationsLoginPage + transport | `DEFECT_CONFIRMED`：技术 regex 泄漏、DEV OTP 未回填、失败 copy 不符合统一 error contract |
| 标准 CRUD 搜索、排序、分页、空/加载/错误 | 7 个 ProTable/list surface | 5 个 ProTable/list surface | `PENDING_RECHECK`：统一 ProTable/QueryFilter 形状与 owner sort 已静态闭合，但三态与 test-id 未逐项证明 |
| Detail Drawer 首屏、Skeleton/loading、header actions | 8 个 detail drawer | 6 个 detail drawer | `DEFECT_CONFIRMED`：operations contract detail 在 fresh owner read 前回退列表行并开放动作 |
| Logo current preview/upload/history | workspace management | 对应 workspace/brand consumers | `DEFECT_CONFIRMED`：体验见选择后预览/历史状态未闭合 |
| Tab/title/description/catalog copy | all content tabs | all content tabs | `DEFECT_CONFIRMED`：重复页面标题、说明位置和 raw/技术文案需同根扫描 |
| Shared foundation and AntD API version | `libraries/frontend/admin-ui-foundation` | same | `PENDING_RECHECK`：先用 CLI info/usage/lint，再逐控件回到 IA，不以 warning 等于 defect |

## 4. 本轮证据顺序

1. 逐 row 重开 IA 原文、memory route、当前 consumer 与可复用 foundation；记录原文锚点和反例。
2. 用 AntD CLI `doctor/info/usage/lint` 记录版本/API/使用分母；CLI 结果只作静态诊断。
3. 先修已确认同根问题，补 focused proof，再按同一 row 回读源码和证据。
4. 本地 DEV 浏览器逐控件验证实际可观察行为；业务与 cleanup 仍分开，不把静态 PASS 说成 L2/business PASS。
5. 只有所有 row 为 `PASS_STATIC_AND_RUNTIME` 或有具体反例的 `NOT_APPLICABLE_WITH_REASON`，总体才可改为 PASS。

## 5. 已识别的首批修复入口

- 两端所有 `Alert.message`、`Drawer.width`、`maskClosable`、`Modal.maskClosable`、`Space.direction` 和受影响
  `Select` props：按 AntD 6.5 API 复核后统一替换并做行为 proof。
- operations `ContractDetailDrawer`：fresh owner detail 未返回前不得用列表 row 开放编辑/作废/历史动作。
- 两端列表三态和稳定 locator：不得把默认 ProTable 空态/spinner 当作 IA 文案和 proof。
- shell/menu/footer/OTP/错误/标题/Logo/history 等 browser finding：先建立实际 row，再做 sibling scan，避免单点修复。

本文件不授权 L2、seed/reset、UAT 或 Roadmap 状态变更；它只重建当前 UI IA 实施对账分母。

## 6. 逐项执行对账（本轮代码闭合）

下表是本轮实际重新打开 IA、当前源码、共享 foundation 与 focused proof 后形成的最小可审计行。
`PASS_STATIC_ONLY` 只表示源码/类型/focused proof 已闭合；在受管浏览器逐控件复核前，不能升级为
`PASS_STATIC_AND_RUNTIME`。`runtime proof` 留空不是遗漏，而是明确的下一证据状态。

| screenId / family | 实际 consumer | IA anchor 与任务/角色 | 入口/控件/AntD 形态 | 数据/校验/状态/刷新 | catalog/test-id/a11y | static proof | runtime proof | status |
|---|---|---|---|---|---|---|---|---|
| IA02-PLATFORM-AUTHENTICATED-SHELL | `platform-admin/src/app/PlatformApp.tsx` | 已登录运维管理员在平台壳导航与切换上下文 | `Layout.Header`、`Dropdown+Avatar`、`Tabs`、`Layout.Sider`；刷新/全屏 icon-only | session owner；overlay lock；当前页 refresh 与 tab 导航 | page/tab title 来自 page registry；principal/refresh/fullscreen/sider trigger 有 stable test-id 与 aria | `PlatformApp.test.tsx`、platform typecheck/architecture PASS | 待浏览器核对字号、头像菜单与真实收起态 | `PASS_STATIC_ONLY` |
| IA02-PLATFORM-WORKSPACE-SIDER-CONTROL | `platform-admin/src/app/state/WorkspaceScope.tsx` | 未选空间时保护 required 页面；选择器固定于侧栏 footer | `Form.Item+Select`；收起态以 icon-only `labelRender` 保留可访问名称 | owner workspace list；搜索级联；未选不发 task read；失败可重试 | `aria-label="集团空间"`、`platform-workspace-selector`、required Result test-id | `WorkspaceScope.test.tsx`；selector footer 与 Sider body flex 已证明 | 待浏览器核对收起态无裸文字、footer 底部与弹层可选 | `PASS_STATIC_ONLY` |
| IA02-PLATFORM-NAV-SUBMENU | `platform-admin/src/app/PlatformApp.tsx` | 平台管理员按一级/二级菜单进入页面 | AntD `Menu` 的 `type:'submenu'`、`icon`、`children`、`inlineCollapsed`；官方 Sider `trigger` | required 子页由 workspace context 禁用；导航只走 registry | catalog page title/icon；`platform-shell-toggle-sider` 与 menu semantics | `PlatformApp.test.tsx`、typecheck PASS；移除自绘 trigger/CSS | 待浏览器核对父组 icon、官方 trigger 两态与 popup 子菜单 | `PASS_STATIC_ONLY` |
| IA02-OPERATIONS-AUTHENTICATED-SHELL | `operations-admin/src/app/OperationsApp.tsx` | 已确认任职/范围的运营用户进入业务壳 | catalog-driven `submenu`、principal `Dropdown`、icon-only refresh/fullscreen、scope footer | owner `WorkspaceSessionEntry`；contextVersion remount；锁定态阻止 shell action | generated catalog group/page labels；operations shell test-id/aria | Operations shell focused/typecheck/architecture PASS | 待浏览器核对壳字号、菜单收起控制与 scope footer | `PASS_STATIC_ONLY` |
| IA05-PLATFORM-OTP | `platform-admin/src/features/authentication/ui/PlatformLoginPage.tsx`, `PlatformPasswordRecoveryVerifyPage.tsx` | 公开登录/恢复用户以手机号+验证码验证 | `Space.Compact`：code input 与“获取验证码”同一行；Alert `title` 只显示业务 copy | owner send/verify；改手机号/失败清 code；DEV/UAT 非空 debug code 回填 Form.code，生产不显示 | `platform-login-*` 与 recovery test-id；手机号/验证码规则使用用户可读中文 message | focused OTP tests、typecheck PASS；未发现裸 regex message | 待浏览器核对请求成功后 input 实际回填与失败文案 | `PASS_STATIC_ONLY` |
| IA05-OPERATIONS-OTP | `operations-admin/src/features/authentication/ui/OperationsLoginPage.tsx`, `OperationsPasswordRecoveryVerifyPage.tsx`, `PublicInvitationOtpStep.tsx` | 运营登录/恢复/公开邀请验证，不泄漏账号存在性 | 同一 `Space.Compact` 形态；debug code 只在受控 DEV/UAT 回填 | owner grant/session；错误清理秘密字段；业务 Problem 映射 | operations/public test-id、aria-label；无技术错误码渲染 | focused OTP tests、typecheck PASS | 待浏览器核对三条公开入口一致性 | `PASS_STATIC_ONLY` |
| IA03/IA04-PLATFORM-CRUD-LIST-STATE | `WorkspaceManagementPage.tsx`, `AdministratorsPage.tsx`, `RolesPage.tsx`, `AccountsPage.tsx`, `PlatformReadPage.tsx` | 运维管理员查看标准列表；加载、空、失败必须互斥 | ProTable + shared `adminListState`；标准 CRUD 使用内建 `search`/QueryFilter；无操作列；名称链接进入 detail；概览列表只暴露契约声明的 server-side sorter | owner query/page/sort；组织概览转发 `sort/direction`；合同概览转发 `sort/direction`；失败由 feature Alert 呈现；空态不伪造行 | page catalog title；table/list loading/empty/error/detail/search test-id | foundation test 10/10；platform 39 files/44 tests + typecheck PASS；overview focused proof 覆盖无 inline Form、search、sort/direction | 待浏览器逐页核对三态、QueryFilter 真实布局、排序请求与名称→detail timing | `PASS_STATIC_ONLY` |
| IA04-OPERATIONS-CRUD-LIST-STATE | `ContractManagementPage.tsx`, `BusinessEntityManagementPage.tsx`, `StoreManagementPage.tsx`, `WorkspaceUserPage.tsx`, `WorkspaceInvitationPanel.tsx` | 运营用户按 IA 批准筛选查看业务列表 | ProTable `search`/QueryFilter；列面与筛选面分离；无操作列 | owner query/RTK tags/context；loading/error/empty 由 query 状态控制 | generated catalog labels；stable list/search/detail locators | operations typecheck/focused/architecture PASS | 待浏览器逐页核对 QueryFilter 真实布局与三态 | `PASS_STATIC_ONLY` |
| IA02/IA04-DETAIL-OPENING | platform detail drawers + operations entity/store/contract detail drawers | 点击名称先给即时反馈，再读 owner detail | `Drawer open` 由显式 detail state 控制；AntD `loading`/Skeleton；actions 只在 fresh owner detail | generation guard 丢弃迟到响应；失败保留已开 surface 与 retry/error copy | detail drawer/action test-id、close semantics | platform detail focused 8/8；operations detail focused 4/11；contract fresh-read guard test PASS | 待浏览器核对 click→drawer 即时出现、Skeleton、fresh actions | `PASS_STATIC_ONLY` |
| IA02-PLATFORM-WORKSPACE-LOGO | `WorkspaceCreateDrawer.tsx`, `WorkspaceEditDrawer.tsx`, `WorkspaceDetailDrawer.tsx` | 创建/编辑时确认当前 Logo，编辑仅允许替换 | Upload staged preview；编辑直接显示 current Logo；UI action 仅 KEEP/REPLACE | asset stage/release/bind grant；失败清理 staged object URL；owner readback；历史 HTTP REMOVE 仅作兼容值，不得有 UI consumer | logo test-id、alt text、detail audit entry；不得出现 remove locator | create/edit focused tests + typecheck PASS | 浏览器已核对：新建仅显示选择文件，编辑直接显示当前 Logo 与更换 Logo，两个 surface 均无移除入口 | `PASS_STATIC_AND_RUNTIME` |
| IA02-PLATFORM-AUDIT | `PlatformAuditHistoryModal.tsx`, workspace audit owner | 详情中查看真实操作历史及业务字段变化 | detail action opens Modal；loading/error/empty/detail states | owner canonical workspace key mapping；不显示 asset ref/raw technical fields | field catalog map、audit list/detail/pagination test-id | backend owner test + frontend focused PASS | 待浏览器核对“操作历史”真实打开、字段完整且可读 | `PASS_STATIC_ONLY` |
| IA02/IA03-TITLE-DESCRIPTION | platform list pages; operations business pages | Tab 提供页面标题；说明位于既定 title/header slot | 不重复渲染 page title；说明为 secondary text/卡片 title slot | catalog title is sole page-title source；业务分区标题保留 | registry/generated catalog labels；page intro aria | duplicate-title scan + focused tests PASS | 待浏览器核对 tab/title/description 视觉层级 | `PASS_STATIC_ONLY` |
| FOUNDATION-ANTD-API | both apps + `libraries/frontend/admin-ui-foundation` | 共享控件行为必须保持 IA，不能凭 CLI 推导业务语义 | `adminListState`、detail drawer lifecycle、AntD Menu/Sider/ProTable/Drawer/Alert | no client authority inference；owner readback; state transitions explicit | foundation tests and app focused tests | `antd doctor/info/usage/lint` recorded; CLI only adjunct; typecheck/static gates PASS | 不适用：CLI 无 runtime proof；由上面各 row 验证 | `NOT_APPLICABLE_WITH_REASON` |

### 6.1 本轮产品修订：Logo 移除能力

Dexter 2026-08-02 直接裁决：新建/编辑集团空间不提供“移除 Logo”；编辑只保留当前 Logo 或上传新 Logo 替换。当前 UI 与 focused proof 已按该裁决收口，历史 HTTP `REMOVE` 仅保留兼容，不得新增 UI consumer。旧 IA/implementation baseline 中的 `REMOVE` 描述属于已 supersede 的历史交互，不能作为当前 UI 实施依据；若要退役 HTTP 值，必须另开完整 contract/owner/generated compatibility 退役包。

### 6.1.1 本轮仍未关闭的运行证据

以下不是“再设计”或“再建门”，而是历史对账无法提供的真实用户观察证据：两个 shell 的实际字号/主题、官方
Sider trigger 两态、收起态 footer、所有列表三态、详情首屏 Skeleton、OTP input 回填、错误业务文案、审计
历史 Modal 的真实打开与字段显示。它们必须在受管本机 DEV/L2 逐项观察并将 `runtime proof` 写回上表；在此之前，
本文件状态保持 `DENOMINATOR_COMPLETE_RUNTIME_PENDING`，不把 focused/static PASS 说成 browser/L2 PASS。

### 6.2 与本轮 UI 对账无关的既有机械门红项

`tools/capability-invariants/cli.mjs check` 当前仍报告
`PlatformAuthenticationService.DiagnosticBootstrapUnavailableException` 未进入 HTTP Problem 映射。
该类型是 U13 诊断 bootstrap 的内部运行时保护异常，来源不在本轮 UI 对账 package 的允许变更面；本轮未把它
伪装成 UI PASS，也未扩大 package 去修改历史 U13 的 capability 分母。该红项必须在其 owning U13 package
重开时将内部诊断异常从 public owner exception denominator 中排除（或迁移到 package-private/API 外部类型），
并由 capability self-test 复核 88 条冻结 public exception exact-set；它不是本轮 UI 体验问题的证据。
### 6.2.1 本轮复盘后新增的通用控制族对账

| control family | 双后台同根扫描结果 | 当前静态处置 | runtime 状态 |
|---|---|---|---|
| `ANTD-6-DEPRECATED-PROP-SCAN` | 两后台 production source（排除 generated wire）已扫描；Alert、Drawer、Space、Select 的当前 AntD 6 形态已统一 | `antd lint --only deprecated` 两后台 0 issue；typecheck/focused proof PASS | `PENDING_RUNTIME` |
| `DETAIL-EXTENSION-ERROR` | operations contract detail 的扩展字段失败态已补为业务可读 Alert，并保留已确认基础资料 | `operations-contract-detail-extension-error` focused assertion + typecheck PASS | `PENDING_RUNTIME` |
| `SELECT-SEARCH-SEMANTICS` | 所有 remote Select consumer 已迁移为 nested `showSearch` 配置；普通静态 Select 未被误判为 CRUD 搜索缺口 | source scan + typecheck + deprecated lint PASS | `PENDING_RUNTIME` |
| `CATALOG-NAVIGATION-ORDER` | platform page projection 曾丢失 `navigation.order`，现已补 `menuOrder` 并按其排序 registry/shell | edge-codegen controlled write、`--check` 与 self-test PASS | `PENDING_RUNTIME` |
| `CATALOG-PLATFORM-SHELL-COPY` | 平台品牌、集团空间详细信息父菜单、修改密码、退出登录此前由 PlatformApp/raw auth copy 直接写入；现纳入 catalog `SHELL_COPY` 节点并由 generated projection 消费 | edge-codegen self-test 新增 shell-copy red；platform typecheck/focused proof PASS | `PENDING_RUNTIME` |
| `DUAL-ADMIN-PROTABLE-SORTING-STANDARD` | 双后台所有 flat paged list 已按“owner contract 闭集 → ProTable sorter 投影”逐表审计；名称/编码/业务编号/明确业务日期可排序，状态/Tag/关联聚合/操作列/固定只读表不可排序 | 标准已写入 `project-memory/operations/phase-retrospective-and-systemic-repair.md`；platform 与 operations 的 sortable 列均已完成 owner→edge→contract→generated→ProTable 闭环 | `STATIC_CLOSED`（浏览器排序行为仍属 runtime pending） |
| `PROTABLE-QUERY-SUBMIT-BOUNDARY` | 双后台所有受控 ProTable 查询入口都曾把过滤逻辑误放在被 ProTable 劫持的 `form.onFinish`，导致按钮可见但查询状态不变 | 全量迁移至顶层 `onSubmit`，自定义按钮改用官方 `searchConfig.form`；两端 architecture test 对整个 sibling 集合做反例扫描 | `STATIC_CLOSED` |
| `PROTABLE-TAB-QUERY-STATE-ISOLATION` | 组织概览的品牌、经营租户、总公司、门店四个 owner 查询 tab 共用 `organizationFilters`，切换 tab 时还将当前条件迁移到新 tab，导致用户在一个 tab 搜索后其他 tab 也带入同一条件 | 改为按 tab key 保存筛选、分页、排序和方向；切换 tab 只读取目标 tab 自己的状态；focused test 验证更新一个 tab 不改变 sibling tab | `STATIC_CLOSED`（浏览器逐 tab 交互仍属 runtime pending） |
| `HIERARCHY-TREE-ROOT-SELECTION` | 组织架构 Tree 把集团渲染成普通字符串，把大区/项目渲染成嵌套链接按钮，集团无法选中且偏离 IA 的原生 Tree 选择语义 | 使用真实 workspace commercial-group readback 的 root id/事实作为展示投影；两后台统一用业务类型 Tag（集团/大区/项目）+ owner-confirmed 名称 + 编码；Tree 使用原生 `selectedKeys` 与 `onSelect`，集团选中显示 root 详情 | `STATIC_CLOSED`（浏览器树选中、标签/编码视觉与详情联动仍属 runtime pending） |
| `ENTITY-REFERENCE-FILTER-SEMANTICS` | 全量 sibling scan 区分“当前列表实体自身的 name/code 标量筛选”和“跨实体引用筛选”。平台合同的门店、经营租户保持普通 Input，operations 合同的经营租户保持普通 Input，均与各自 IA 的“按名称/文本核查”语义一致；它们不是候选缺陷。已闭合的引用筛选为：platform 组织概览门店的项目/品牌/经营租户、operations 门店列表的项目、operations 合同列表/新建/编辑的门店，均使用 owner-backed candidate Select，并以 `name（code）` 展示。 | 引用型筛选只有在 IA 明确要求“搜索选择”时才使用 owner candidate query，候选必须提供 opaque id、name+code 标签、级联清理、分页累计、选中值保留和 owner 重验；当前实体自身名称/编号筛选仍使用 contract text Input。不得从当前表格行或单个 selectedTenant 推导候选，也不得在页面自造 SQL/fetch。 | 平台组织候选由 organization owner 同页 `filterOptions` 返回并随 workspace 绑定；operations 门店项目候选由 store owner candidates 返回；operations 合同门店候选由 contract owner 按 `storeSearch` 分页返回，selectedStoreId 不在当前页时由 owner 受限查询补回。候选读取失败会阻断筛选/创建/编辑，不再渲染可提交的空候选。 | `STATIC_CLOSED` |

本节只记录静态修复和证据边界；任何一行都不能把 CLI、typecheck 或 focused proof 升级为浏览器/L2/business PASS。

### 6.2.2 实体引用筛选闭环结论

本轮重新打开 IA03/IA04、OpenAPI、edge controller、owner task-read 与两个后台 consumer 后，确认先前对账单把“文本检索”误报成“候选缺口”。最小一致性结论如下：

1. platform contract overview 的 `storeName`、`phaseName`、`tenantName`、`contractNo`、`itemCode` 是 IA03 明确的 contract 文本 Input；当前 controller、owner predicate、total predicate 与 ProTable `onSubmit` 已闭环，不能擅自替换成 `storeId`/`tenantId`。
2. operations contract overview 的 `tenantName`、`contractNo`、`phaseName` 是 IA04 文本筛选；`storeId` 才是 IA 明确的搜索选择，当前由 contract owner 的 `storeSearch` candidate query 提供并按项目级联。
3. platform organization overview 的项目/品牌/经营租户与 operations store overview 的项目是 IA 明确的引用筛选；当前均来自 owner candidate readback，查询把 opaque id 传回 owner，切换 tab/上游条件时按现有级联清理。

因此本轮不新增 candidate contract、不改已正确的文本字段，也不把 UI 改成“看似 Select”的半成品；若未来业务要求把合同文本改为实体候选，必须新开 IA/contract/owner 一致性设计，不得从本对账单推导。
3. 生成链：先改 OpenAPI/owner read contract，再重生成 edge wire/client/RTK；禁止手改 generated output，禁止在 edge 侧从当前列表行拼候选，禁止用 client-side `Array.filter` 模拟 owner 搜索。
4. 证据闭环：候选 query 的 focused proof 必须覆盖 code 命中、name 命中、分页、scope 隔离、selected 值不在当前页时仍能显示；列表 proof 必须覆盖发送 opaque id 而非 label；两个后台分别做 query submit、reset、sort 和错误/空态回读。本轮新增的 owner focused test 覆盖 selected value preservation；真实 Docker/Testcontainers 初始化失败仅记录为本机运行面阻断，不升级为 business PASS。

在上述 owner contract 未进入批准 package 前，平台合同的两个文本筛选和运营合同的租户文本筛选保持 `STATIC_PENDING_OWNER_CONTRACT`，这是 fail-closed 的边界登记，不是 UI PASS，也不是允许继续使用错误语义的设计认可。

### 6.2.3 实体详情变体逐项对账

本轮针对“项目分期是否应出现在所有组织详情”重新打开 IA03/IA04 的原文与当前 consumer/owner readback。结论不是套用一个通用详情模板，而是按业务对象类型采用 IA 冻结的字段闭集；下表记录每个实际详情 surface 的最小字段集合、当前源码和本轮处置。

| surface | IA 冻结字段闭集 | 当前实现/owner readback | 处置 |
|---|---|---|---|
| platform 组织架构右侧详情（集团/大区/项目） | 集团/大区：名称、编码、所属机构、状态、备注、更新时间；PROJECT 另加项目分期名称（Dexter 2026-08-02 产品裁决） | `PlatformReadPage.tsx` 按 nodeType 变体渲染；organization hierarchy tree owner readback 为 PROJECT 返回 phases，集团/大区返回空数组 | `STATIC_CLOSED`：项目分期只在平台 PROJECT 详情显示，不泛化到其他节点 |
| platform 品牌/经营租户/总公司/门店详情 | owner 业务字段、状态、备注、更新时间，再接当前启用扩展定义 | `OrganizationOverviewDetailDrawer.tsx` 只消费 owner detail；`OrganizationOverviewTaskReadService` 已把 notes/remark 从三类层级、实体、门店查询投影到 readback | `STATIC_CLOSED` |
| platform 合同详情 | 合同编号、状态、门店、分期、经营租户、起止日期、货号、备注、创建时间、更新时间，再接当前启用扩展定义 | `ContractOverviewDetailDrawer.tsx` 已按 IA 顺序渲染完整集合；owner detail 返回同一事实集 | `STATIC_CLOSED` |
| operations 集团/大区/项目组织详情 | IA04-ORG-TREE 的名称、编码、状态、备注；项目分期只在项目创建/编辑面维护 | `OrganizationStructurePage.tsx` 详情严格按 IA04 字段闭集；编辑/创建 Drawer 负责分期集合 | `STATIC_CLOSED` |
| operations 品牌/经营租户/总公司详情 | 品牌：编码、名称、别名、状态、备注、更新时间；租户/总公司：编码、名称、法定名称、统一社会信用代码、状态、备注、更新时间；总公司另有经营品牌动作 | `BusinessEntityDetailDrawer.tsx` 按 `kind` 分支字段并消费 owner detail/当前启用扩展定义；动作在详情上下文外独立进入 | `STATIC_CLOSED` |
| operations 门店详情 | 门店名称、编码、项目、品牌、经营租户、总公司、状态、备注，再接当前启用扩展定义 | `StoreDetailDrawer.tsx` 以 owner detail 为唯一事实源，字段与 IA04-STORE-DETAIL 一致 | `STATIC_CLOSED` |
| operations 合同详情 | 合同编号、门店、项目分期、经营租户、货号、起止日期、状态、备注、更新时间，再接当前启用扩展定义 | `ContractDetailDrawer.tsx` 已完整渲染；固定门店资料页的只读合同详情亦已统一为同一基础字段闭集并补扩展定义读取 | `STATIC_CLOSED` |
| platform 空间/管理员/角色/账号/扩展字段详情 | 分别按 IA03-SPACE、IA03-ADMIN-DETAIL、IA03-ROLE-DETAIL、IA03-ACCOUNT-DETAIL、IA03-EXTENSION-PAGE 的专用字段集合 | 各 Drawer/内容页已按对应 IA surface 保留专用字段；账号任职表的“撤销任职”已落在每条 assignment 行而非列表操作列 | `STATIC_CLOSED` |

Dexter 于 2026-08-02 明确裁决平台 PROJECT 详情必须显示项目分期；因此旧版“平台项目分期 N/A”的判断已废止，不能继续作为验收依据。真正需要修复的是曾经把不同实体详情压成同一模板、或在 owner readback 中丢失 IA 要求字段的通用失败模式；本轮已将该模式登记为 `IA_DETAIL_VARIANT_AND_OWNER_PROJECTION_MUST_BE_EXACT`，并以本表作为后续逐项复核分母。所有 `STATIC_CLOSED` 仍只表示源码/契约/focused proof 已闭合，浏览器/L2/business/cleanup 状态继续保持 `PENDING_RUNTIME`。

### 6.2.4 双后台排序闭集对账

排序不按“看起来像文本”自动开放，而按 `DUAL_ADMIN_PROTABLE_SORTING_STANDARD` 对每个表逐表决定。`sorter` 必须映射到生成 enum 并由 owner 分页查询执行；没有闭合 contract 的列保持无 sorter，不用本地排序补齐。
角色页与空间账号页虽然使用 `search={false}`，但这是 IA 未批准任何查询条件的明确例外；它们仍使用 ProTable 承载分页、服务端排序和统一三态，不得据此退回手写表格。

| app / surface | 允许排序列 → owner key | 明确不排序列 / 反例 | 状态 |
|---|---|---|---|
| platform 集团空间 | 集团空间名称→NAME；集团空间编码→WORKSPACE_KEY；更新时间→UPDATED_AT | Logo、运营后台标题、运营后台地址、商业集团、状态 | `STATIC_CLOSED` |
| platform 管理员 | 姓名→USER_NAME；登录账号→LOGIN_NAME；最近登录→LAST_LOGIN_AT；更新时间→UPDATED_AT | 账号类型、状态；无操作列 | `STATIC_CLOSED` |
| platform 组织概览 | 名称→NAME；编码→CODE；更新时间→UPDATED_AT | 状态、来源、项目/品牌/经营租户关联 | `STATIC_CLOSED` |
| platform 合同概览 | 合同编号→CONTRACT_NO；起止日期→EFFECTIVE_FROM；更新时间→UPDATED_AT | 门店/分期/经营租户拼接值、货号摘要、状态 | `STATIC_CLOSED` |
| platform 角色 | 名称→NAME；更新时间→UPDATED_AT | 角色说明、状态、权限聚合；无操作列 | `STATIC_CLOSED` |
| platform 空间账号 | 姓名→DISPLAY_NAME；登录账号→LOGIN_NAME；更新时间→UPDATED_AT | 任职机构/角色聚合、状态；无操作列 | `STATIC_CLOSED` |
| platform 扩展字段定义、审计明细、组织树 | 无排序；配置 `displayOrder` 是定义顺序而非查询排序 | 全部列；树/配置顺序/审计事件不可伪造表格排序 | `NOT_APPLICABLE_WITH_REASON` |
| operations 品牌/经营租户/总公司 | 品牌/总公司名称→NAME、编码→CODE、更新时间→UPDATED_AT；经营租户名称→NAME、更新时间→UPDATED_AT | 经营租户显示的统一社会信用代码不映射 owner 的 CODE；状态、授权集合 | `STATIC_CLOSED` |
| operations 门店 | 门店名称→NAME；编码→CODE | 项目、品牌、经营租户、总公司关联值、状态；更新时间若 IA 不展示则不新增列 | `STATIC_CLOSED` |
| operations 合同 | 合同编号→CONTRACT_NO；起止日期→EFFECTIVE_FROM；更新时间仅在契约声明且表面展示时开放 | 门店/分期/经营租户拼接值、货号摘要、状态 | `STATIC_CLOSED` |
| operations 工作区账号/邀请 | 工作区账号姓名→DISPLAY_NAME、登录账号→LOGIN_NAME；邀请有效期→EXPIRES_AT（清除排序回到隐藏的 owner 默认 CREATED_AT） | 任职机构/角色 Tag 汇总、状态、脱敏手机号、操作/邀请动作；邀请创建时间未在 IA 表面展示，不新增列 | `STATIC_CLOSED` |
| operations 门店资料合同三态、审计明细 | 无排序；三态 Tab 顺序是业务状态 | 全部列 | `NOT_APPLICABLE_WITH_REASON` |

### 6.2.5 排序闭环静态验证

本轮排序实现的闭环证据如下；这些结果只证明源码、契约和 focused proof，不升级为浏览器/L2/business PASS：

| proof | result |
|---|---|
| `scripts/generate/edge-codegen --self-test` / `--check` | PASS；真实 red mutation 集合仍输出 |
| `scripts/check/edge-codegen`、`scripts/check/openapi-contracts` | PASS |
| 两后台 `typecheck` | PASS |
| 两后台全量 frontend test | platform 39 files/45 tests PASS；operations 22 files/46 tests PASS |
| 两后台 focused sorting tests | platform 5 files/6 tests PASS；operations 5 files/17 tests PASS |
| 两后台 query-submit architecture proof | platform/operations `query-filter-submit-boundary.test.mjs` 均 PASS；禁止受控列表使用 `form.onFinish`，并要求官方 `searchConfig.form` + 顶层 `onSubmit` |
| 相关 edge/owner focused tests | PASS；`WorkspaceUserTaskScopeTest` 依赖本机 Docker/Testcontainers，按环境纪律单独记为运行面阻断，未误报通过 |
| `antd lint --only deprecated` | 两后台分别扫描 102/99 files，均 PASS |
| raw client-side list sorting scan | 仅 operations fixed read-only store-contract display-order 配置表存在 `.sort()`；业务分页列表无 `Array.sort`/`localeCompare` |

全仓既有 `frontend-architecture` 的 `PlatformApp.tsx` page-key literal，以及 `capability-invariants` 的
`DiagnosticBootstrapUnavailableException` ledger drift 仍为历史红项；两者不在本排序变更的 owning source 中，不能被本轮排序 PASS 掩盖，也未扩大本轮范围修复。

### 6.3 94 physical-screen row ledger (corrected denominator)

Physical contract exact-set expected=94 actual=94 missing=0 extra=0. Each row independently binds screen ID, IA anchor, consumer, control/API, data/cascade, focused proof and runtime status; family summaries cannot upgrade a row.

| screen ID | IA anchor | consumer/entry | control/API | data/cascade | focused proof | runtime proof | status |
|---|---|---|---|---|---|---|---|
| IA01-PLATFORM-LOGIN | IA source line 37 (`IA01-PLATFORM-LOGIN`) | `platform-admin/src/features/authentication/ui/PlatformLoginPage.tsx` | `useOverlayLock` | `platformPasswordLogin`, future platform OTP operations | `PlatformLoginPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-PLATFORM-RECOVERY-VERIFY | IA source line 38 (`IA01-PLATFORM-RECOVERY-VERIFY`) | `platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryVerifyPage.tsx` | `useOverlayLock` | future `start/send/verifyPlatformPasswordRecovery` | `PlatformPasswordRecoveryVerifyPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-PLATFORM-RECOVERY-PASSWORD | IA source line 39 (`IA01-PLATFORM-RECOVERY-PASSWORD`) | `platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryPasswordPage.tsx` | `useOverlayLock` | future `completePlatformPasswordRecovery` | `PlatformPasswordRecoveryPasswordPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-PLATFORM-RECOVERY-COMPLETE | IA source line 40 (`IA01-PLATFORM-RECOVERY-COMPLETE`) | `platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryCompletePage.tsx` | `useOverlayLock` | future completion readback; no authenticated shell | `PlatformPasswordRecoveryCompletePage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-AUTHENTICATED-SHELL | IA source line 41 (`IA02-PLATFORM-AUTHENTICATED-SHELL`) | `platform-admin/src/app/PlatformApp.tsx` | `useOverlayLock, contextScopedQueryArgs` | supporting app-shell contract, `NOT_APPLICABLE_WITH_REASON`: no `PLATFORM-SHELL` exists in the frozen 22-surface catalog denominator; this is required host chrome, not a 23rd catalog surface | `PlatformApp.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACE-CONTEXT | IA source line 42 (`IA02-PLATFORM-WORKSPACE-CONTEXT`) | `platform-admin/src/app/PlatformApp.tsx` shell host + `platform-admin/src/app/state/WorkspaceScope.tsx` state owner | `contextScopedQueryArgs, useOverlayLock` | selected workspace app-owned React state; no Redux slice/reducer or N/A business command | `PlatformApp.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACE-SIDER-CONTROL | IA source line 42 (`IA02-PLATFORM-WORKSPACE-SIDER-CONTROL`) | `platform-admin/src/app/PlatformApp.tsx` shell host + `platform-admin/src/app/state/WorkspaceScope.tsx` state owner | `contextScopedQueryArgs, useOverlayLock` | selected workspace app-owned React state; no Redux slice/reducer or N/A business command | `PlatformApp.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACES-ACTIONS | IA source line 43 (`IA02-PLATFORM-WORKSPACES-ACTIONS`) | `platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx` | `useDetailDrawer, useOverlayLock` | `list/createPlatformGroupWorkspace`, asset staging; platform-wide management list must not inherit selected-workspace query context | `WorkspaceManagementPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER | IA source line 44 (`IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER`) | `platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx` | `adminDrawerSurfaceProps, useOverlayLock` | group-workspace detail readback | `WorkspaceDetailDrawer.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACE-CREATE-DRAWER | IA source line 45 (`IA02-PLATFORM-WORKSPACE-CREATE-DRAWER`) | `platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx`, `CommercialGroupInitializationDrawer.tsx`, `WorkspaceEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/init/update workspace command respectively | each sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER | IA source line 45 (`IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER`) | `platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx`, `CommercialGroupInitializationDrawer.tsx`, `WorkspaceEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/init/update workspace command respectively | each sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACE-EDIT-DRAWER | IA source line 45 (`IA02-PLATFORM-WORKSPACE-EDIT-DRAWER`) | `platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx`, `CommercialGroupInitializationDrawer.tsx`, `WorkspaceEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/init/update workspace command respectively | each sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACE-STATUS-MODAL | IA source line 46 (`IA02-PLATFORM-WORKSPACE-STATUS-MODAL`) | `platform-admin/src/features/workspace-management/ui/WorkspaceStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | `transitionPlatformGroupWorkspaceStatus` | `WorkspaceStatusModal.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-PLATFORM-WORKSPACE-OVERVIEW | IA source line 47 (`IA02-PLATFORM-WORKSPACE-OVERVIEW`) | `platform-admin/src/features/workspace-administration/ui/WorkspaceAdministrationPage.tsx` | `contextScopedQueryArgs, testId` | task read only; N/A mutation | `WorkspaceAdministrationPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ADMIN-LIST | IA source line 48 (`IA03-ADMIN-LIST`) | `platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx`, `AdministratorDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | administrator list/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ADMIN-DETAIL | IA source line 48 (`IA03-ADMIN-DETAIL`) | `platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx`, `AdministratorDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | administrator list/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ADMIN-CREATE | IA source line 49 (`IA03-ADMIN-CREATE`) | `platform-admin/src/features/platform-administration/ui/AdministratorCreateDrawer.tsx`, `AdministratorEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | administrator create/update | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ADMIN-EDIT | IA source line 49 (`IA03-ADMIN-EDIT`) | `platform-admin/src/features/platform-administration/ui/AdministratorCreateDrawer.tsx`, `AdministratorEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | administrator create/update | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ADMIN-CREDENTIAL | IA source line 50 (`IA03-ADMIN-CREDENTIAL`) | `platform-admin/src/features/platform-administration/ui/AdministratorCredentialDrawer.tsx`, `AdministratorStatusModal.tsx` | Drawer `useDrawerFormLifecycle, useOverlayLock`; Modal `useSubmissionLifecycle, useOverlayLock` | administrator-issued credential action / status | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ADMIN-STATUS | IA source line 50 (`IA03-ADMIN-STATUS`) | `platform-admin/src/features/platform-administration/ui/AdministratorCredentialDrawer.tsx`, `AdministratorStatusModal.tsx` | Drawer `useDrawerFormLifecycle, useOverlayLock`; Modal `useSubmissionLifecycle, useOverlayLock` | administrator-issued credential action / status | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ORG-OVERVIEW | IA source line 51 (`IA03-ORG-OVERVIEW`) | `platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx` | page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | organization overview page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ORG-HIERARCHY | IA source line 51 (`IA03-ORG-HIERARCHY`) | `platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx` | page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | organization overview page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ORG-DETAIL | IA source line 51 (`IA03-ORG-DETAIL`) | `platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx` | page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | organization overview page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-CONTRACT-OVERVIEW | IA source line 52 (`IA03-CONTRACT-OVERVIEW`) | `platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `ContractOverviewDetailDrawer.tsx` | page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | contract overview page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-CONTRACT-DETAIL | IA source line 52 (`IA03-CONTRACT-DETAIL`) | `platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `ContractOverviewDetailDrawer.tsx` | page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | contract overview page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ROLE-LIST | IA source line 53 (`IA03-ROLE-LIST`) | `platform-admin/src/features/workspace-iam/ui/RolesPage.tsx`, `RoleDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | role list/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ROLE-DETAIL | IA source line 53 (`IA03-ROLE-DETAIL`) | `platform-admin/src/features/workspace-iam/ui/RolesPage.tsx`, `RoleDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | role list/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ROLE-CREATE | IA source line 54 (`IA03-ROLE-CREATE`) | `platform-admin/src/features/workspace-iam/ui/RoleCreateDrawer.tsx`, `RoleEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update workspace role; separate page/capability trees | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ROLE-EDIT | IA source line 54 (`IA03-ROLE-EDIT`) | `platform-admin/src/features/workspace-iam/ui/RoleCreateDrawer.tsx`, `RoleEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update workspace role; separate page/capability trees | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ROLE-STATUS | IA source line 55 (`IA03-ROLE-STATUS`) | `platform-admin/src/features/workspace-iam/ui/RoleStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | `transitionWorkspaceRoleStatus` | `RoleStatusModal.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ACCOUNT-TAB | IA source line 56 (`IA03-ACCOUNT-TAB`) | `platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx`, `WorkspaceAccountDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | workspace account list/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ACCOUNT-DETAIL | IA source line 56 (`IA03-ACCOUNT-DETAIL`) | `platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx`, `WorkspaceAccountDetailDrawer.tsx` | page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock` | workspace account list/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-ACCOUNT-ACTION | IA source line 57 (`IA03-ACCOUNT-ACTION`) | `platform-admin/src/features/workspace-iam/ui/WorkspaceAccountActionModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | account status/recovery/revoke command selected by owner readback | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-EXTENSION-PAGE | IA source line 58 (`IA03-EXTENSION-PAGE`) | `platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`, `ExtensionDefinitionEditDrawer.tsx`, `ExtensionDefinitionSaveModal.tsx` | page `contextScopedQueryArgs, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; Modal `useOverlayLock` | catalog/readback/replace definition | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-EXTENSION-EDIT | IA source line 58 (`IA03-EXTENSION-EDIT`) | `platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`, `ExtensionDefinitionEditDrawer.tsx`, `ExtensionDefinitionSaveModal.tsx` | page `contextScopedQueryArgs, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; Modal `useOverlayLock` | catalog/readback/replace definition | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-EXTENSION-SAVE | IA source line 58 (`IA03-EXTENSION-SAVE`) | `platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`, `ExtensionDefinitionEditDrawer.tsx`, `ExtensionDefinitionSaveModal.tsx` | page `contextScopedQueryArgs, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; Modal `useOverlayLock` | catalog/readback/replace definition | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-PASSWORD-DRAWER | IA source line 59 (`IA03-PASSWORD-DRAWER`) | `platform-admin/src/features/authentication/ui/PlatformPasswordChangeDrawer.tsx`, `PlatformPasswordChangeResult.tsx` | Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; result `useOverlayLock` | `changeCurrentPlatformPassword` / completion N/A | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA03-PASSWORD-RESULT | IA source line 59 (`IA03-PASSWORD-RESULT`) | `platform-admin/src/features/authentication/ui/PlatformPasswordChangeDrawer.tsx`, `PlatformPasswordChangeResult.tsx` | Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; result `useOverlayLock` | `changeCurrentPlatformPassword` / completion N/A | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-OPERATIONS-AUTHENTICATED-SHELL | IA source line 60 (`IA02-OPERATIONS-AUTHENTICATED-SHELL`) | `operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx` | shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock` | `get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode` | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-OPERATIONS-SHELL-HEADER | IA source line 60 (`IA02-OPERATIONS-SHELL-HEADER`) | `operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx` | shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock` | `get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode` | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-OPERATIONS-INITIAL-ROLE-SELECTION | IA source line 60 (`IA02-OPERATIONS-INITIAL-ROLE-SELECTION`) | `operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx` | shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock` | `get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode` | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-OPERATIONS-DATA-SCOPE | IA source line 60 (`IA02-OPERATIONS-DATA-SCOPE`) | `operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx` | shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock` | `get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode` | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER | IA source line 60 (`IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER`) | `operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx` | shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock` | `get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode` | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-OPERATIONS-LOGIN | IA source line 61 (`IA01-OPERATIONS-LOGIN`) | `operations-admin/src/features/authentication/ui/OperationsLoginPage.tsx` | `useAsyncGenerationGuard, useSubmissionLifecycle, useOverlayLock` | login entry/password/OTP operations | `OperationsLoginPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-RECOVERY-VERIFY | IA source line 62 (`IA05-RECOVERY-VERIFY`) | `operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx` | each `useOverlayLock` | future anonymous operations recovery operations | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-RECOVERY-PASSWORD | IA source line 62 (`IA05-RECOVERY-PASSWORD`) | `operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx` | each `useOverlayLock` | future anonymous operations recovery operations | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-RECOVERY-COMPLETE | IA source line 62 (`IA05-RECOVERY-COMPLETE`) | `operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx` | each `useOverlayLock` | future anonymous operations recovery operations | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-PUBLIC-INVITATION | IA source line 63 (`IA01-PUBLIC-INVITATION`) | `operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx` | every step `useOverlayLock`; no authenticated app context | existing public invitation operation sequence | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-PUBLIC-INVITATION-OTP | IA source line 63 (`IA01-PUBLIC-INVITATION-OTP`) | `operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx` | every step `useOverlayLock`; no authenticated app context | existing public invitation operation sequence | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-PUBLIC-INVITATION-CREDENTIALS | IA source line 63 (`IA01-PUBLIC-INVITATION-CREDENTIALS`) | `operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx` | every step `useOverlayLock`; no authenticated app context | existing public invitation operation sequence | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-PUBLIC-INVITATION-COMPLETE | IA source line 63 (`IA01-PUBLIC-INVITATION-COMPLETE`) | `operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx` | every step `useOverlayLock`; no authenticated app context | existing public invitation operation sequence | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-ORG-TREE | IA source line 64 (`IA04-ORG-TREE`) | `operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useOverlayLock` | hierarchy read | `OrganizationStructurePage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-REGION-CREATE | IA source line 65 (`IA04-REGION-CREATE`) | `operations-admin/src/features/organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update organization commands | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-PROJECT-CREATE | IA source line 65 (`IA04-PROJECT-CREATE`) | `operations-admin/src/features/organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update organization commands | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-ORG-EDIT | IA source line 65 (`IA04-ORG-EDIT`) | `operations-admin/src/features/organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update organization commands | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-ORG-STATUS | IA source line 66 (`IA04-ORG-STATUS`) | `operations-admin/src/features/organization-structure/ui/OrganizationStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | transition organization status | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-BRAND-PAGE | IA source line 67 (`IA04-BRAND-PAGE`) | `operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock` | entity-specific list operations | `BusinessEntityManagementPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-TENANT-PAGE | IA source line 67 (`IA04-TENANT-PAGE`) | `operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock` | entity-specific list operations | `BusinessEntityManagementPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-HEAD-COMPANY-PAGE | IA source line 67 (`IA04-HEAD-COMPANY-PAGE`) | `operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock` | entity-specific list operations | `BusinessEntityManagementPage.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-BUSINESS-DETAIL | IA source line 68 (`IA04-BUSINESS-DETAIL`) | `operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx`, `BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx` | detail `useDetailDrawer, useOverlayLock`; create/edit `useDrawerFormLifecycle, useOverlayLock` | entity-specific detail/create/update | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-BUSINESS-CREATE | IA source line 68 (`IA04-BUSINESS-CREATE`) | `operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx`, `BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx` | detail `useDetailDrawer, useOverlayLock`; create/edit `useDrawerFormLifecycle, useOverlayLock` | entity-specific detail/create/update | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-BUSINESS-EDIT | IA source line 68 (`IA04-BUSINESS-EDIT`) | `operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx`, `BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx` | detail `useDetailDrawer, useOverlayLock`; create/edit `useDrawerFormLifecycle, useOverlayLock` | entity-specific detail/create/update | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-HEAD-COMPANY-BRANDS | IA source line 69 (`IA04-HEAD-COMPANY-BRANDS`) | `operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx` | `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock` | add/remove head-company brand authorization | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-BUSINESS-STATUS | IA source line 70 (`IA04-BUSINESS-STATUS`) | `operations-admin/src/features/business-entity-management/ui/BusinessEntityStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | entity-specific status operation | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-STORE-PAGE | IA source line 71 (`IA04-STORE-PAGE`) | `operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`, `StoreDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock` | store page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-STORE-DETAIL | IA source line 71 (`IA04-STORE-DETAIL`) | `operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`, `StoreDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock` | store page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-STORE-CREATE | IA source line 72 (`IA04-STORE-CREATE`) | `operations-admin/src/features/store-management/ui/StoreCreateDrawer.tsx`, `StoreEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update store + owner candidates/definition | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-STORE-EDIT | IA source line 72 (`IA04-STORE-EDIT`) | `operations-admin/src/features/store-management/ui/StoreCreateDrawer.tsx`, `StoreEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update store + owner candidates/definition | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-STORE-STATUS | IA source line 73 (`IA04-STORE-STATUS`) | `operations-admin/src/features/store-management/ui/StoreStatusModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | transition store status | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-CONTRACT-PAGE | IA source line 74 (`IA04-CONTRACT-PAGE`) | `operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`, `ContractDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock` | contract page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-CONTRACT-DETAIL | IA source line 74 (`IA04-CONTRACT-DETAIL`) | `operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`, `ContractDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock` | contract page/detail | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-CONTRACT-CREATE | IA source line 75 (`IA04-CONTRACT-CREATE`) | `operations-admin/src/features/contract-management/ui/ContractCreateDrawer.tsx`, `ContractEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update contract; tenant derives from selected store | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-CONTRACT-EDIT | IA source line 75 (`IA04-CONTRACT-EDIT`) | `operations-admin/src/features/contract-management/ui/ContractCreateDrawer.tsx`, `ContractEditDrawer.tsx` | each `useDrawerFormLifecycle, useOverlayLock` | create/update contract; tenant derives from selected store | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-CONTRACT-INVALIDATE | IA source line 76 (`IA04-CONTRACT-INVALIDATE`) | `operations-admin/src/features/contract-management/ui/ContractInvalidateModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | `invalidateOperationsContract` | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-STORE-PROFILE | IA source line 77 (`IA04-STORE-PROFILE`) | `operations-admin/src/features/store-profile/ui/StoreProfilePage.tsx`, `FixedStoreContractDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer`; Drawer `useDetailDrawer` | profile/fixed-contract task reads; N/A mutation | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA04-STORE-PROFILE-CONTRACT | IA source line 77 (`IA04-STORE-PROFILE-CONTRACT`) | `operations-admin/src/features/store-profile/ui/StoreProfilePage.tsx`, `FixedStoreContractDetailDrawer.tsx` | page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer`; Drawer `useDetailDrawer` | profile/fixed-contract task reads; N/A mutation | sibling tests | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-GROUP-USERS | IA source line 78 (`IA05-GROUP-USERS`) | `operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey | `contextScopedQueryArgs` only | five target-specific user page/detail operation families; target is capability-derived | `WorkspaceUserPage.test.tsx` parameterized by five keys | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-REGION-USERS | IA source line 78 (`IA05-REGION-USERS`) | `operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey | `contextScopedQueryArgs` only | five target-specific user page/detail operation families; target is capability-derived | `WorkspaceUserPage.test.tsx` parameterized by five keys | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-PROJECT-USERS | IA source line 78 (`IA05-PROJECT-USERS`) | `operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey | `contextScopedQueryArgs` only | five target-specific user page/detail operation families; target is capability-derived | `WorkspaceUserPage.test.tsx` parameterized by five keys | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-HEAD-COMPANY-USERS | IA source line 78 (`IA05-HEAD-COMPANY-USERS`) | `operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey | `contextScopedQueryArgs` only | five target-specific user page/detail operation families; target is capability-derived | `WorkspaceUserPage.test.tsx` parameterized by five keys | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-STORE-USERS | IA source line 78 (`IA05-STORE-USERS`) | `operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey | `contextScopedQueryArgs` only | five target-specific user page/detail operation families; target is capability-derived | `WorkspaceUserPage.test.tsx` parameterized by five keys | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-USER-DETAIL | IA source line 79 (`IA05-USER-DETAIL`) | `operations-admin/src/features/workspace-user/ui/WorkspaceUserDetailDrawer.tsx` | `useDetailDrawer, useOverlayLock` | corresponding target-specific user detail | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-USER-REVOKE | IA source line 80 (`IA05-USER-REVOKE`) | `operations-admin/src/features/workspace-user/ui/WorkspaceUserRevokeModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | corresponding target-specific revoke operation | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-USER-INVITATION-ACTIONS | IA source line 81 (`IA01-USER-INVITATION-ACTIONS`) | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationPanel.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useOverlayLock` | five target-specific invitation page/candidate operations | `WorkspaceInvitationPanel.test.tsx` | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-USER-INVITATION-CREATE-DRAWER | IA source line 82 (`IA01-USER-INVITATION-CREATE-DRAWER`) | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx` | `adminDrawerSurfaceProps, contextScopedQueryArgs, useDrawerFormLifecycle, useAsyncGenerationGuard, useOverlayLock` | corresponding target-specific create invitation operation | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-USER-INVITATION-DETAIL-DRAWER | IA source line 83 (`IA01-USER-INVITATION-DETAIL-DRAWER`) | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationDetailDrawer.tsx` | `adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock` | corresponding target-specific invitation detail readback | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA01-USER-INVITATION-ACTION-MODAL | IA source line 84 (`IA01-USER-INVITATION-ACTION-MODAL`) | `operations-admin/src/features/workspace-user/ui/WorkspaceInvitationActionModal.tsx` | `useSubmissionLifecycle, useOverlayLock` | corresponding target-specific cancel/reissue operation | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-PASSWORD-DRAWER | IA source line 85 (`IA05-PASSWORD-DRAWER`) | `operations-admin/src/features/authentication/ui/OperationsPasswordChangeDrawer.tsx` | `adminDrawerSurfaceProps, useDrawerFormLifecycle, useOverlayLock` | `changeCurrentWorkspacePassword` | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-PASSWORD-RESULT | IA source line 86 (`IA05-PASSWORD-RESULT`) | `operations-admin/src/features/authentication/ui/OperationsPasswordChangeResult.tsx` | `useOverlayLock` | N/A completion screen | sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-HOME-GROUP | IA source line 87 (`IA05-HOME-GROUP`) | `operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys | `contextScopedQueryArgs` | N/A: shell/content outlet only, no dashboard query or command | parameterized sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-HOME-REGION | IA source line 87 (`IA05-HOME-REGION`) | `operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys | `contextScopedQueryArgs` | N/A: shell/content outlet only, no dashboard query or command | parameterized sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-HOME-PROJECT | IA source line 87 (`IA05-HOME-PROJECT`) | `operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys | `contextScopedQueryArgs` | N/A: shell/content outlet only, no dashboard query or command | parameterized sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-HOME-HEAD-COMPANY | IA source line 87 (`IA05-HOME-HEAD-COMPANY`) | `operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys | `contextScopedQueryArgs` | N/A: shell/content outlet only, no dashboard query or command | parameterized sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |
| IA05-HOME-STORE | IA source line 87 (`IA05-HOME-STORE`) | `operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys | `contextScopedQueryArgs` | N/A: shell/content outlet only, no dashboard query or command | parameterized sibling test | static source binding recorded; browser proof pending | PENDING_RUNTIME |

### 6.4 每屏字段对象（可供机械 exact-set 校验）

以下对象与 §6.3 同一 94 屏分母；字段缺失或新增 screen ID 都应直接 fail closed。

```json
{
  "requiredFields": [
    "screenId",
    "consumerPath",
    "businessTask",
    "roleScenario",
    "entryInteraction",
    "controlType",
    "dataCascade",
    "validationError",
    "permissionState",
    "refreshNavigation",
    "catalogCopyKey",
    "testIdAccessibility",
    "staticProof",
    "runtimeProof",
    "status"
  ],
  "screenRecords": [
    {
      "screenId": "IA01-PLATFORM-LOGIN",
      "consumerPath": "`platform-admin/src/features/authentication/ui/PlatformLoginPage.tsx`",
      "businessTask": "IA-IA01:IA01-PLATFORM-LOGIN",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useOverlayLock`",
      "dataCascade": "`platformPasswordLogin`, future platform OTP operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`PlatformLoginPage.test.tsx`",
      "staticProof": "physical-contract:37; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-PLATFORM-RECOVERY-VERIFY",
      "consumerPath": "`platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryVerifyPage.tsx`",
      "businessTask": "IA-IA01:IA01-PLATFORM-RECOVERY-VERIFY",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useOverlayLock`",
      "dataCascade": "future `start/send/verifyPlatformPasswordRecovery`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`PlatformPasswordRecoveryVerifyPage.test.tsx`",
      "staticProof": "physical-contract:38; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-PLATFORM-RECOVERY-PASSWORD",
      "consumerPath": "`platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryPasswordPage.tsx`",
      "businessTask": "IA-IA01:IA01-PLATFORM-RECOVERY-PASSWORD",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useOverlayLock`",
      "dataCascade": "future `completePlatformPasswordRecovery`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`PlatformPasswordRecoveryPasswordPage.test.tsx`",
      "staticProof": "physical-contract:39; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-PLATFORM-RECOVERY-COMPLETE",
      "consumerPath": "`platform-admin/src/features/authentication/ui/PlatformPasswordRecoveryCompletePage.tsx`",
      "businessTask": "IA-IA01:IA01-PLATFORM-RECOVERY-COMPLETE",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useOverlayLock`",
      "dataCascade": "future completion readback; no authenticated shell",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`PlatformPasswordRecoveryCompletePage.test.tsx`",
      "staticProof": "physical-contract:40; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-AUTHENTICATED-SHELL",
      "consumerPath": "`platform-admin/src/app/PlatformApp.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-AUTHENTICATED-SHELL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useOverlayLock, contextScopedQueryArgs`",
      "dataCascade": "supporting app-shell contract, `NOT_APPLICABLE_WITH_REASON`: no `PLATFORM-SHELL` exists in the frozen 22-surface catalog denominator; this is required host chrome, not a 23rd catalog surface",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`PlatformApp.test.tsx`",
      "staticProof": "physical-contract:41; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACE-CONTEXT",
      "consumerPath": "`platform-admin/src/app/PlatformApp.tsx` shell host + `platform-admin/src/app/state/WorkspaceScope.tsx` state owner",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACE-CONTEXT",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "selected workspace app-owned React state; no Redux slice/reducer or N/A business command",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`PlatformApp.test.tsx`",
      "staticProof": "physical-contract:42; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACE-SIDER-CONTROL",
      "consumerPath": "`platform-admin/src/app/PlatformApp.tsx` shell host + `platform-admin/src/app/state/WorkspaceScope.tsx` state owner",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACE-SIDER-CONTROL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "selected workspace app-owned React state; no Redux slice/reducer or N/A business command",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`PlatformApp.test.tsx`",
      "staticProof": "physical-contract:42; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACES-ACTIONS",
      "consumerPath": "`platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACES-ACTIONS",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useDetailDrawer, useOverlayLock`",
      "dataCascade": "`list/createPlatformGroupWorkspace`, asset staging; platform-wide management list must not inherit selected-workspace query context",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceManagementPage.test.tsx`",
      "staticProof": "physical-contract:43; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER",
      "consumerPath": "`platform-admin/src/features/workspace-management/ui/WorkspaceDetailDrawer.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "group-workspace detail readback",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceDetailDrawer.test.tsx`",
      "staticProof": "physical-contract:44; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACE-CREATE-DRAWER",
      "consumerPath": "`platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx`, `CommercialGroupInitializationDrawer.tsx`, `WorkspaceEditDrawer.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACE-CREATE-DRAWER",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/init/update workspace command respectively",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "each sibling test",
      "staticProof": "physical-contract:45; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER",
      "consumerPath": "`platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx`, `CommercialGroupInitializationDrawer.tsx`, `WorkspaceEditDrawer.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/init/update workspace command respectively",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "each sibling test",
      "staticProof": "physical-contract:45; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACE-EDIT-DRAWER",
      "consumerPath": "`platform-admin/src/features/workspace-management/ui/WorkspaceCreateDrawer.tsx`, `CommercialGroupInitializationDrawer.tsx`, `WorkspaceEditDrawer.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACE-EDIT-DRAWER",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/init/update workspace command respectively",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "each sibling test",
      "staticProof": "physical-contract:45; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACE-STATUS-MODAL",
      "consumerPath": "`platform-admin/src/features/workspace-management/ui/WorkspaceStatusModal.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACE-STATUS-MODAL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "`transitionPlatformGroupWorkspaceStatus`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceStatusModal.test.tsx`",
      "staticProof": "physical-contract:46; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-PLATFORM-WORKSPACE-OVERVIEW",
      "consumerPath": "`platform-admin/src/features/workspace-administration/ui/WorkspaceAdministrationPage.tsx`",
      "businessTask": "IA-IA02:IA02-PLATFORM-WORKSPACE-OVERVIEW",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs, testId`",
      "dataCascade": "task read only; N/A mutation",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceAdministrationPage.test.tsx`",
      "staticProof": "physical-contract:47; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ADMIN-LIST",
      "consumerPath": "`platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx`, `AdministratorDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ADMIN-LIST",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "administrator list/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:48; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ADMIN-DETAIL",
      "consumerPath": "`platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx`, `AdministratorDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ADMIN-DETAIL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "administrator list/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:48; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ADMIN-CREATE",
      "consumerPath": "`platform-admin/src/features/platform-administration/ui/AdministratorCreateDrawer.tsx`, `AdministratorEditDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ADMIN-CREATE",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "administrator create/update",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:49; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ADMIN-EDIT",
      "consumerPath": "`platform-admin/src/features/platform-administration/ui/AdministratorCreateDrawer.tsx`, `AdministratorEditDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ADMIN-EDIT",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "administrator create/update",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:49; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ADMIN-CREDENTIAL",
      "consumerPath": "`platform-admin/src/features/platform-administration/ui/AdministratorCredentialDrawer.tsx`, `AdministratorStatusModal.tsx`",
      "businessTask": "IA-IA03:IA03-ADMIN-CREDENTIAL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "Drawer `useDrawerFormLifecycle, useOverlayLock`; Modal `useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "administrator-issued credential action / status",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:50; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ADMIN-STATUS",
      "consumerPath": "`platform-admin/src/features/platform-administration/ui/AdministratorCredentialDrawer.tsx`, `AdministratorStatusModal.tsx`",
      "businessTask": "IA-IA03:IA03-ADMIN-STATUS",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "Drawer `useDrawerFormLifecycle, useOverlayLock`; Modal `useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "administrator-issued credential action / status",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:50; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ORG-OVERVIEW",
      "consumerPath": "`platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ORG-OVERVIEW",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "organization overview page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:51; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ORG-HIERARCHY",
      "consumerPath": "`platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ORG-HIERARCHY",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "organization overview page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:51; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ORG-DETAIL",
      "consumerPath": "`platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ORG-DETAIL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "organization overview page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:51; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-CONTRACT-OVERVIEW",
      "consumerPath": "`platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `ContractOverviewDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-CONTRACT-OVERVIEW",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "contract overview page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:52; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-CONTRACT-DETAIL",
      "consumerPath": "`platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`, `ContractOverviewDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-CONTRACT-DETAIL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "contract overview page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:52; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ROLE-LIST",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/RolesPage.tsx`, `RoleDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ROLE-LIST",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "role list/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:53; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ROLE-DETAIL",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/RolesPage.tsx`, `RoleDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ROLE-DETAIL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "role list/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:53; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ROLE-CREATE",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/RoleCreateDrawer.tsx`, `RoleEditDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ROLE-CREATE",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update workspace role; separate page/capability trees",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:54; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ROLE-EDIT",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/RoleCreateDrawer.tsx`, `RoleEditDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ROLE-EDIT",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update workspace role; separate page/capability trees",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:54; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ROLE-STATUS",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/RoleStatusModal.tsx`",
      "businessTask": "IA-IA03:IA03-ROLE-STATUS",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "`transitionWorkspaceRoleStatus`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`RoleStatusModal.test.tsx`",
      "staticProof": "physical-contract:55; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ACCOUNT-TAB",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx`, `WorkspaceAccountDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ACCOUNT-TAB",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "workspace account list/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:56; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ACCOUNT-DETAIL",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx`, `WorkspaceAccountDetailDrawer.tsx`",
      "businessTask": "IA-IA03:IA03-ACCOUNT-DETAIL",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `useDetailDrawer, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useOverlayLock`",
      "dataCascade": "workspace account list/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:56; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-ACCOUNT-ACTION",
      "consumerPath": "`platform-admin/src/features/workspace-iam/ui/WorkspaceAccountActionModal.tsx`",
      "businessTask": "IA-IA03:IA03-ACCOUNT-ACTION",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "account status/recovery/revoke command selected by owner readback",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:57; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-EXTENSION-PAGE",
      "consumerPath": "`platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`, `ExtensionDefinitionEditDrawer.tsx`, `ExtensionDefinitionSaveModal.tsx`",
      "businessTask": "IA-IA03:IA03-EXTENSION-PAGE",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; Modal `useOverlayLock`",
      "dataCascade": "catalog/readback/replace definition",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:58; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-EXTENSION-EDIT",
      "consumerPath": "`platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`, `ExtensionDefinitionEditDrawer.tsx`, `ExtensionDefinitionSaveModal.tsx`",
      "businessTask": "IA-IA03:IA03-EXTENSION-EDIT",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; Modal `useOverlayLock`",
      "dataCascade": "catalog/readback/replace definition",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:58; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-EXTENSION-SAVE",
      "consumerPath": "`platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`, `ExtensionDefinitionEditDrawer.tsx`, `ExtensionDefinitionSaveModal.tsx`",
      "businessTask": "IA-IA03:IA03-EXTENSION-SAVE",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `contextScopedQueryArgs, useOverlayLock`; Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; Modal `useOverlayLock`",
      "dataCascade": "catalog/readback/replace definition",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:58; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-PASSWORD-DRAWER",
      "consumerPath": "`platform-admin/src/features/authentication/ui/PlatformPasswordChangeDrawer.tsx`, `PlatformPasswordChangeResult.tsx`",
      "businessTask": "IA-IA03:IA03-PASSWORD-DRAWER",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; result `useOverlayLock`",
      "dataCascade": "`changeCurrentPlatformPassword` / completion N/A",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:59; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA03-PASSWORD-RESULT",
      "consumerPath": "`platform-admin/src/features/authentication/ui/PlatformPasswordChangeDrawer.tsx`, `PlatformPasswordChangeResult.tsx`",
      "businessTask": "IA-IA03:IA03-PASSWORD-RESULT",
      "roleScenario": "运维管理员/平台认证",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "Drawer `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`; result `useOverlayLock`",
      "dataCascade": "`changeCurrentPlatformPassword` / completion N/A",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:59; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-OPERATIONS-AUTHENTICATED-SHELL",
      "consumerPath": "`operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx`",
      "businessTask": "IA-IA02:IA02-OPERATIONS-AUTHENTICATED-SHELL",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "`get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:60; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-OPERATIONS-SHELL-HEADER",
      "consumerPath": "`operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx`",
      "businessTask": "IA-IA02:IA02-OPERATIONS-SHELL-HEADER",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "`get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:60; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-OPERATIONS-INITIAL-ROLE-SELECTION",
      "consumerPath": "`operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx`",
      "businessTask": "IA-IA02:IA02-OPERATIONS-INITIAL-ROLE-SELECTION",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "`get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:60; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-OPERATIONS-DATA-SCOPE",
      "consumerPath": "`operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx`",
      "businessTask": "IA-IA02:IA02-OPERATIONS-DATA-SCOPE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "`get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:60; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER",
      "consumerPath": "`operations-admin/src/app/OperationsApp.tsx`, `features/role-home-bootstrap/ui/RoleContextSelector.tsx`, `DataScopeSelector.tsx`",
      "businessTask": "IA-IA02:IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "shell `contextScopedQueryArgs, useOverlayLock`; each selector `contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "`get/selectOperationsWorkspaceSessionContext`, `selectOperationsWorkspaceSessionDataNode`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:60; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-OPERATIONS-LOGIN",
      "consumerPath": "`operations-admin/src/features/authentication/ui/OperationsLoginPage.tsx`",
      "businessTask": "IA-IA01:IA01-OPERATIONS-LOGIN",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useAsyncGenerationGuard, useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "login entry/password/OTP operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`OperationsLoginPage.test.tsx`",
      "staticProof": "physical-contract:61; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-RECOVERY-VERIFY",
      "consumerPath": "`operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx`",
      "businessTask": "IA-IA05:IA05-RECOVERY-VERIFY",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useOverlayLock`",
      "dataCascade": "future anonymous operations recovery operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:62; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-RECOVERY-PASSWORD",
      "consumerPath": "`operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx`",
      "businessTask": "IA-IA05:IA05-RECOVERY-PASSWORD",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useOverlayLock`",
      "dataCascade": "future anonymous operations recovery operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:62; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-RECOVERY-COMPLETE",
      "consumerPath": "`operations-admin/src/features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx`, `OperationsPasswordRecoveryPasswordPage.tsx`, `OperationsPasswordRecoveryCompletePage.tsx`",
      "businessTask": "IA-IA05:IA05-RECOVERY-COMPLETE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useOverlayLock`",
      "dataCascade": "future anonymous operations recovery operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:62; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-PUBLIC-INVITATION",
      "consumerPath": "`operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx`",
      "businessTask": "IA-IA01:IA01-PUBLIC-INVITATION",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "every step `useOverlayLock`; no authenticated app context",
      "dataCascade": "existing public invitation operation sequence",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:63; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-PUBLIC-INVITATION-OTP",
      "consumerPath": "`operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx`",
      "businessTask": "IA-IA01:IA01-PUBLIC-INVITATION-OTP",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "every step `useOverlayLock`; no authenticated app context",
      "dataCascade": "existing public invitation operation sequence",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:63; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-PUBLIC-INVITATION-CREDENTIALS",
      "consumerPath": "`operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx`",
      "businessTask": "IA-IA01:IA01-PUBLIC-INVITATION-CREDENTIALS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "every step `useOverlayLock`; no authenticated app context",
      "dataCascade": "existing public invitation operation sequence",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:63; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-PUBLIC-INVITATION-COMPLETE",
      "consumerPath": "`operations-admin/src/features/invitation-acceptance/ui/PublicInvitationEntry.tsx`, `PublicInvitationOtpStep.tsx`, `PublicInvitationCredentialsStep.tsx`, `PublicInvitationCompleteStep.tsx`",
      "businessTask": "IA-IA01:IA01-PUBLIC-INVITATION-COMPLETE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "every step `useOverlayLock`; no authenticated app context",
      "dataCascade": "existing public invitation operation sequence",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:63; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-ORG-TREE",
      "consumerPath": "`operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx`",
      "businessTask": "IA-IA04:IA04-ORG-TREE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "hierarchy read",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`OrganizationStructurePage.test.tsx`",
      "staticProof": "physical-contract:64; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-REGION-CREATE",
      "consumerPath": "`operations-admin/src/features/organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-REGION-CREATE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update organization commands",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:65; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-PROJECT-CREATE",
      "consumerPath": "`operations-admin/src/features/organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-PROJECT-CREATE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update organization commands",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:65; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-ORG-EDIT",
      "consumerPath": "`operations-admin/src/features/organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-ORG-EDIT",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update organization commands",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:65; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-ORG-STATUS",
      "consumerPath": "`operations-admin/src/features/organization-structure/ui/OrganizationStatusModal.tsx`",
      "businessTask": "IA-IA04:IA04-ORG-STATUS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "transition organization status",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:66; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-BRAND-PAGE",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`",
      "businessTask": "IA-IA04:IA04-BRAND-PAGE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`",
      "dataCascade": "entity-specific list operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`BusinessEntityManagementPage.test.tsx`",
      "staticProof": "physical-contract:67; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-TENANT-PAGE",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`",
      "businessTask": "IA-IA04:IA04-TENANT-PAGE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`",
      "dataCascade": "entity-specific list operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`BusinessEntityManagementPage.test.tsx`",
      "staticProof": "physical-contract:67; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-HEAD-COMPANY-PAGE",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`",
      "businessTask": "IA-IA04:IA04-HEAD-COMPANY-PAGE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`",
      "dataCascade": "entity-specific list operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`BusinessEntityManagementPage.test.tsx`",
      "staticProof": "physical-contract:67; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-BUSINESS-DETAIL",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx`, `BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-BUSINESS-DETAIL",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "detail `useDetailDrawer, useOverlayLock`; create/edit `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "entity-specific detail/create/update",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:68; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-BUSINESS-CREATE",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx`, `BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-BUSINESS-CREATE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "detail `useDetailDrawer, useOverlayLock`; create/edit `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "entity-specific detail/create/update",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:68; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-BUSINESS-EDIT",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx`, `BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-BUSINESS-EDIT",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "detail `useDetailDrawer, useOverlayLock`; create/edit `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "entity-specific detail/create/update",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:68; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-HEAD-COMPANY-BRANDS",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-HEAD-COMPANY-BRANDS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "add/remove head-company brand authorization",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:69; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-BUSINESS-STATUS",
      "consumerPath": "`operations-admin/src/features/business-entity-management/ui/BusinessEntityStatusModal.tsx`",
      "businessTask": "IA-IA04:IA04-BUSINESS-STATUS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "entity-specific status operation",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:70; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-STORE-PAGE",
      "consumerPath": "`operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`, `StoreDetailDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-STORE-PAGE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock`",
      "dataCascade": "store page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:71; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-STORE-DETAIL",
      "consumerPath": "`operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`, `StoreDetailDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-STORE-DETAIL",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock`",
      "dataCascade": "store page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:71; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-STORE-CREATE",
      "consumerPath": "`operations-admin/src/features/store-management/ui/StoreCreateDrawer.tsx`, `StoreEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-STORE-CREATE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update store + owner candidates/definition",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:72; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-STORE-EDIT",
      "consumerPath": "`operations-admin/src/features/store-management/ui/StoreCreateDrawer.tsx`, `StoreEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-STORE-EDIT",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update store + owner candidates/definition",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:72; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-STORE-STATUS",
      "consumerPath": "`operations-admin/src/features/store-management/ui/StoreStatusModal.tsx`",
      "businessTask": "IA-IA04:IA04-STORE-STATUS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "transition store status",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:73; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-CONTRACT-PAGE",
      "consumerPath": "`operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`, `ContractDetailDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-CONTRACT-PAGE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock`",
      "dataCascade": "contract page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:74; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-CONTRACT-DETAIL",
      "consumerPath": "`operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`, `ContractDetailDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-CONTRACT-DETAIL",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer, useOverlayLock`; Drawer `useDetailDrawer, useOverlayLock`",
      "dataCascade": "contract page/detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:74; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-CONTRACT-CREATE",
      "consumerPath": "`operations-admin/src/features/contract-management/ui/ContractCreateDrawer.tsx`, `ContractEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-CONTRACT-CREATE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update contract; tenant derives from selected store",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:75; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-CONTRACT-EDIT",
      "consumerPath": "`operations-admin/src/features/contract-management/ui/ContractCreateDrawer.tsx`, `ContractEditDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-CONTRACT-EDIT",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "each `useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "create/update contract; tenant derives from selected store",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:75; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-CONTRACT-INVALIDATE",
      "consumerPath": "`operations-admin/src/features/contract-management/ui/ContractInvalidateModal.tsx`",
      "businessTask": "IA-IA04:IA04-CONTRACT-INVALIDATE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "`invalidateOperationsContract`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:76; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-STORE-PROFILE",
      "consumerPath": "`operations-admin/src/features/store-profile/ui/StoreProfilePage.tsx`, `FixedStoreContractDetailDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-STORE-PROFILE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer`; Drawer `useDetailDrawer`",
      "dataCascade": "profile/fixed-contract task reads; N/A mutation",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:77; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA04-STORE-PROFILE-CONTRACT",
      "consumerPath": "`operations-admin/src/features/store-profile/ui/StoreProfilePage.tsx`, `FixedStoreContractDetailDrawer.tsx`",
      "businessTask": "IA-IA04:IA04-STORE-PROFILE-CONTRACT",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "page `adminDrawerSurfaceProps, contextScopedQueryArgs, useDetailDrawer`; Drawer `useDetailDrawer`",
      "dataCascade": "profile/fixed-contract task reads; N/A mutation",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling tests",
      "staticProof": "physical-contract:77; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-GROUP-USERS",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey",
      "businessTask": "IA-IA05:IA05-GROUP-USERS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs` only",
      "dataCascade": "five target-specific user page/detail operation families; target is capability-derived",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceUserPage.test.tsx` parameterized by five keys",
      "staticProof": "physical-contract:78; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-REGION-USERS",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey",
      "businessTask": "IA-IA05:IA05-REGION-USERS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs` only",
      "dataCascade": "five target-specific user page/detail operation families; target is capability-derived",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceUserPage.test.tsx` parameterized by five keys",
      "staticProof": "physical-contract:78; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-PROJECT-USERS",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey",
      "businessTask": "IA-IA05:IA05-PROJECT-USERS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs` only",
      "dataCascade": "five target-specific user page/detail operation families; target is capability-derived",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceUserPage.test.tsx` parameterized by five keys",
      "staticProof": "physical-contract:78; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-HEAD-COMPANY-USERS",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey",
      "businessTask": "IA-IA05:IA05-HEAD-COMPANY-USERS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs` only",
      "dataCascade": "five target-specific user page/detail operation families; target is capability-derived",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceUserPage.test.tsx` parameterized by five keys",
      "staticProof": "physical-contract:78; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-STORE-USERS",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx` with one generated target-specific operation binding per pageDesignKey",
      "businessTask": "IA-IA05:IA05-STORE-USERS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs` only",
      "dataCascade": "five target-specific user page/detail operation families; target is capability-derived",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceUserPage.test.tsx` parameterized by five keys",
      "staticProof": "physical-contract:78; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-USER-DETAIL",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceUserDetailDrawer.tsx`",
      "businessTask": "IA-IA05:IA05-USER-DETAIL",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useDetailDrawer, useOverlayLock`",
      "dataCascade": "corresponding target-specific user detail",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:79; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-USER-REVOKE",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceUserRevokeModal.tsx`",
      "businessTask": "IA-IA05:IA05-USER-REVOKE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "corresponding target-specific revoke operation",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:80; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-USER-INVITATION-ACTIONS",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceInvitationPanel.tsx`",
      "businessTask": "IA-IA01:IA01-USER-INVITATION-ACTIONS",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, contextScopedQueryArgs, useOverlayLock`",
      "dataCascade": "five target-specific invitation page/candidate operations",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "`WorkspaceInvitationPanel.test.tsx`",
      "staticProof": "physical-contract:81; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-USER-INVITATION-CREATE-DRAWER",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx`",
      "businessTask": "IA-IA01:IA01-USER-INVITATION-CREATE-DRAWER",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, contextScopedQueryArgs, useDrawerFormLifecycle, useAsyncGenerationGuard, useOverlayLock`",
      "dataCascade": "corresponding target-specific create invitation operation",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:82; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-USER-INVITATION-DETAIL-DRAWER",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceInvitationDetailDrawer.tsx`",
      "businessTask": "IA-IA01:IA01-USER-INVITATION-DETAIL-DRAWER",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock`",
      "dataCascade": "corresponding target-specific invitation detail readback",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:83; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA01-USER-INVITATION-ACTION-MODAL",
      "consumerPath": "`operations-admin/src/features/workspace-user/ui/WorkspaceInvitationActionModal.tsx`",
      "businessTask": "IA-IA01:IA01-USER-INVITATION-ACTION-MODAL",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useSubmissionLifecycle, useOverlayLock`",
      "dataCascade": "corresponding target-specific cancel/reissue operation",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:84; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-PASSWORD-DRAWER",
      "consumerPath": "`operations-admin/src/features/authentication/ui/OperationsPasswordChangeDrawer.tsx`",
      "businessTask": "IA-IA05:IA05-PASSWORD-DRAWER",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`adminDrawerSurfaceProps, useDrawerFormLifecycle, useOverlayLock`",
      "dataCascade": "`changeCurrentWorkspacePassword`",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:85; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-PASSWORD-RESULT",
      "consumerPath": "`operations-admin/src/features/authentication/ui/OperationsPasswordChangeResult.tsx`",
      "businessTask": "IA-IA05:IA05-PASSWORD-RESULT",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`useOverlayLock`",
      "dataCascade": "N/A completion screen",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "sibling test",
      "staticProof": "physical-contract:86; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-HOME-GROUP",
      "consumerPath": "`operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys",
      "businessTask": "IA-IA05:IA05-HOME-GROUP",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs`",
      "dataCascade": "N/A: shell/content outlet only, no dashboard query or command",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "parameterized sibling test",
      "staticProof": "physical-contract:87; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-HOME-REGION",
      "consumerPath": "`operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys",
      "businessTask": "IA-IA05:IA05-HOME-REGION",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs`",
      "dataCascade": "N/A: shell/content outlet only, no dashboard query or command",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "parameterized sibling test",
      "staticProof": "physical-contract:87; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-HOME-PROJECT",
      "consumerPath": "`operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys",
      "businessTask": "IA-IA05:IA05-HOME-PROJECT",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs`",
      "dataCascade": "N/A: shell/content outlet only, no dashboard query or command",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "parameterized sibling test",
      "staticProof": "physical-contract:87; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-HOME-HEAD-COMPANY",
      "consumerPath": "`operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys",
      "businessTask": "IA-IA05:IA05-HOME-HEAD-COMPANY",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs`",
      "dataCascade": "N/A: shell/content outlet only, no dashboard query or command",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "parameterized sibling test",
      "staticProof": "physical-contract:87; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    },
    {
      "screenId": "IA05-HOME-STORE",
      "consumerPath": "`operations-admin/src/features/role-home-bootstrap/ui/RoleHomeBootstrapPage.tsx` with five catalog page keys",
      "businessTask": "IA-IA05:IA05-HOME-STORE",
      "roleScenario": "运营用户或公开入口",
      "entryInteraction": "按 physical consumer 入口渲染并以批准控件触发",
      "controlType": "`contextScopedQueryArgs`",
      "dataCascade": "N/A: shell/content outlet only, no dashboard query or command",
      "validationError": "IA exact copy + owner typed problem",
      "permissionState": "owner permission + overlay/dirty state",
      "refreshNavigation": "owner query invalidation + context navigation",
      "catalogCopyKey": "IA_COPY_OR_NON_CATALOG",
      "testIdAccessibility": "parameterized sibling test",
      "staticProof": "physical-contract:87; source/focused binding recorded",
      "runtimeProof": null,
      "status": "PENDING_RUNTIME"
    }
  ]
}
```
