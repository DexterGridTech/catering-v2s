# v2s 双管理后台浏览器发现登记（Codex）

> 这是一份面向当前 DEV 浏览器体验的缺陷登记，不是 Roadmap package，也不改变 Journey、catalog 或授权边界。登记先于修复；每项都先判定是否为两个管理后台的共性问题，再按根因修复并做 focused self-test。

| ID | 浏览器现象 | 影响面判定 | 根因/依据 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-01 | platform-admin 侧栏品牌名视觉过小 | 两后台共性 | 两 app 都使用无字号约束的 `.brand` 文本；operations 还把工作空间名与后台标题压在同一小块中。v2 shell 的品牌/标题使用明确字号层级。 | **FIXED**：双 app brand typography 已统一补齐。 |
| UI-BROWSER-02 | 顶栏直接平铺“修改密码/退出登录” | 两后台共性 | 两 app 都没有采用 v2 已验证的 `Dropdown + principal` 入口；操作不应占据顶栏常驻空间。 | **FIXED**：改为右上角头像/姓名下拉，菜单内保留修改密码、退出。 |
| UI-BROWSER-03 | 刷新按钮显示文字 | 两后台共性 | 两 app shell 按钮同时渲染 icon 与 raw label；v2 shell 已定义 icon-only 且保留 aria-label。 | **FIXED**：改为 icon-only，保留 aria-label 与 test-id。 |
| UI-BROWSER-04 | 全屏按钮显示文字 | 两后台共性 | 同 UI-BROWSER-03。 | **FIXED**：改为 icon-only，动态 aria-label 保留“进入/退出全屏”。 |
| UI-BROWSER-05 | 集团空间/数据范围选择器未固定在菜单 footer | 两后台共性 | AntD `Layout.Sider` 的内容实际包在 `.ant-layout-sider-children` 内；只给外层 Sider 写 flex 不会让 Menu/footer 参与纵向布局。 | **FIXED**：两个 Sider 的内部 children 宿主均使用 flex column，Menu 占剩余空间、selector 用 `margin-top:auto` 固定到底部，不改变 owner scope 逻辑。 |
| UI-BROWSER-06 | platform-admin 菜单全部像一级菜单 | 非共性/当前不构成代码缺陷 | operations catalog 具有四个 `NAVIGATION_GROUP` 并已分组；IA02 明确要求 platform 的“集团空间详细信息”父组，当前 catalog 设计文档的 flat 说法是 proposed review 材料。 | **FIXED**：按已接受 IA02 恢复 platform 父组；不修改 catalog 生成真相。 |
| UI-BROWSER-07 | 编辑选择图片后没有预览 | platform-admin 当前缺陷；operations 无同类后台 Logo 编辑面 | edit/create Drawer 的 Upload 隐藏了文件列表且只保存 staged ref，没有把本地文件映射为预览。 | **FIXED**：新建/编辑均显示本地 staged 预览，并释放 object URL；保留 asset staging 语义。 |
| UI-BROWSER-08 | platform workspace “操作历史”点击后不显示 | platform-admin 后端+前端链路缺陷 | 实测 GET `/api/platform/audit-history?entityType=GROUP_WORKSPACE&entityId=mixc` 首先返回 `PLATFORM_COMMON_RESOURCE_NOT_FOUND`；修正 host 校验后继续发现历史 writer 按冻结规范把 `entity_ref_text` 写成内部 decimal id，而入口传稳定 group key，导致 200 空页。 | **FIXED**：owner 先按 `group_workspace_key` 解析 canonical legacy id，再用同一 ref 查询 platform/organization 历史；错误态不再静默关闭。重启后同请求返回 2 条历史。 |
| UI-BROWSER-09 | 编辑时只显示 KEEP/REPLACE/REMOVE，不直接展示当前 Logo | platform-admin UX 缺陷；operations 无同类后台 Logo 编辑面 | v2 U07 明确要求“有图直接预览、操作为更换/移除；不操作自然保持”，旧实现把 owner intent 误做成用户必须选择的 Radio。 | **FIXED**：移除意图 Radio；当前 Logo 直接预览，按更换/移除动作派生 KEEP/REPLACE/REMOVE，保留 owner 契约。 |
| UI-BROWSER-10 | 列表没有排序 | 需按 contract/IA 分层，不是无条件两后台全开 | platform workspace 后端已有 sortKey/sortDirection；IA02/IA04 对多数列表未批准展示排序，IA04 明确要求排序参数留在实现协议。 | **PARTIALLY FIXED / DESIGN-BOUND**：platform workspace 已接入 NAME/WORKSPACE_KEY/UPDATED_AT 远端排序；operations 及 IA 明确不展示排序的页面保留为设计事项，不擅自加控件。 |

## 修复顺序

1. 双后台共用壳层：品牌、用户菜单、图标-only 操作、scope footer。
2. platform workspace asset 预览：先当前 Logo，再 staged Logo；create/edit 一致。
3. platform audit history：owner 查询根因与前端错误呈现。
4. 按 contract + IA 逐页接入排序，保留“IA 明确不展示排序”的页面。
5. 对改动文件运行对应 frontend typecheck/focused tests，以及 workspace audit owner test；再回读本登记与 IA，更新每项状态。

## 当前证据边界

- 仅使用当前本机 DEV + 远端中间件运行面进行观察；不把静态检查当动态业务结果。
- 本登记不包含 reset、seed、L2 或 Roadmap 状态变更。
- 菜单层级项在当前 catalog/IA 语义未获实现授权，保留为待评审问题而非伪修复。

## 自测证据（2026-08-01）

- `apps/frontend/platform-admin`: `yarn typecheck` PASS；shell、workspace create/edit、workspace management focused tests PASS；改动文件 ESLint PASS。
- `apps/frontend/operations-admin`: `yarn typecheck` PASS；audit-history focused tests PASS；改动文件 ESLint PASS。
- `gradle :apps:backend:catering-business-server:modules:workspace:test --no-daemon`: PASS。
- 重启后受管 DEV 实测：`GET /api/platform/audit-history?entityType=GROUP_WORKSPACE&entityId=mixc&page=1&pageSize=20` 返回 HTTP 200，`items` 含 `COMMERCIAL_GROUP_INITIALIZED` 与 `GROUP_WORKSPACE_CREATED` 两条、`total=2`；此前同请求为 `PLATFORM_COMMON_RESOURCE_NOT_FOUND`。既有历史已真实读出。
- 全仓本轮改动面仍未命中“操作”列模式、裸 `fetch` 或 `axios`；operations 的全量 architecture lint 仍有本轮之外的既有 hook/unused-var findings，未归因给本次修复。

## 本轮浏览器发现（2026-08-01）

| ID | 浏览器现象 | 影响面判定 | 根因/依据 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-11 | platform 侧栏“集团空间”出现必选星号 | platform shell 单点；operations 没有同一控件 | 选择器把 shell 上下文 guard 的逻辑必需错误表达成 AntD `Form.Item.required` 的视觉必选；IA02 要求未选时菜单置灰/空态，不要求星号。 | **FIXED**：移除视觉必选标记，保留未选择时的导航 guard 与空态。 |
| UI-BROWSER-12 | OTP“获取验证码”单独占一行 | 两后台及公开邀请/恢复 OTP 入口的共性形态 | 现实现把验证码输入与发送按钮拆成两个 Form 行；IA01/IA05 明确是“验证码 Input + 获取验证码”同一行。 | **FIXED**：platform 登录、operations 登录、operations 恢复和公开邀请均使用嵌套 `Form.Item` + `Space.Compact`，保留字段校验、发送状态与 test-id。 |
| UI-BROWSER-13 | workspace 列表缺少“运营后台地址” | platform workspace 单点；operations 列表无该业务对象 | IA02-PLATFORM-WORKSPACES-ACTIONS 与 v2 源码均要求该导航列；地址由已配置 operations origin 和稳定 workspace key 形成，不是新的业务事实或 API 字段。 | **FIXED**：补回导航列，使用 `target=_blank` 打开 `/operations/{groupWorkspaceKey}/login`；不增加操作列。 |
| UI-BROWSER-14 | 创建/更新审计只展示“名称/字段变更”，看不到完整资料变更 | platform workspace owner；operations 审计 label 另行沿用其 owner 字段集 | workspace owner 的 create/update audit writer 只写 `name`；初始化记录的 `commercialGroupCode/Name` 也未有 platform label。 | **FIXED**：owner 按业务可见字段写入编码、名称、运营标题、Logo 状态、备注及 update 的实际差异；UI 补齐字段词典，禁止展示 asset ref。 |
| UI-BROWSER-15 | 修改密码菜单不显示手机号、也不能改手机号 | 不构成缺陷，不跨后台新增能力 | IA03-PASSWORD-DRAWER 明确只承载当前/新/确认密码；手机号属于管理员资料详情/编辑（IA03-ADMIN-DETAIL/EDIT），平台 session 也不返回手机号供 shell 自行推导。 | **NOT_APPLICABLE_WITH_REASON**：不把资料编辑混入改密 Drawer；需手机号管理时从管理员详情进入 owner profile command。 |
| UI-BROWSER-16 | 操作历史字段名显示“字段变更” | 两后台 audit renderer 的通用 fallback；本次确认的具体缺口在 platform commercial/workspace keys | field label map 对 owner 已声明字段不完整，未知 key 退回泛化文案；本次已覆盖 platform workspace 与商业集团初始化字段。 | **FIXED**：补齐 platform map；operations 的通用 fallback 保留为未知扩展字段的安全兜底，不伪造业务含义。 |
| UI-BROWSER-17 | 侧栏底部集团空间 selector 在短窗口仍可能不贴底 | 两后台共性 shell | AntD Sider 的 `.ant-layout-sider-children` 才是纵向布局宿主；仅外层 flex 无效。 | **FIXED**：两个 app 均对内部 children 设置 flex column，selector footer 使用剩余空间布局。 |
| UI-BROWSER-18 | 点击列表业务标识后，详情抽屉要等详情请求完成才出现，体感延迟约 1 秒；部分已挂载抽屉只显示转圈/文字 | 两后台详情交互共性 | 多个页面把 `Drawer.open` 绑定到详情响应对象（target）；请求未完成时 target 为空，Drawer 未挂载，用户无法看到即时反馈。已挂载的运营实体/门店/合同详情又各自实现 Spin/文字 loading，造成反馈不一致。 | **FIXED**：共享 `useDetailDrawer` 增加显式 `isOpen/loading/openLoading/finishLoading` 状态；平台工作区、管理员、角色、账号、组织/合同概览和运维用户在请求发出前先打开 Drawer，AntD Drawer 使用 `loading` 展示 Skeleton，响应成功后再写入 owner readback；运维实体、门店、合同详情统一接入 Drawer loading/Skeleton。请求代际 guard 防止关闭或快速切换后的迟到响应覆盖当前详情。 |

## 本轮验证（2026-08-01）

- platform-admin `yarn typecheck` PASS；PlatformLoginPage、WorkspaceEditDrawer、WorkspaceManagement、PlatformApp focused tests PASS；改动文件 ESLint PASS。
- operations-admin `yarn typecheck` PASS；OperationsLoginPage、OperationsPasswordRecoveryVerifyPage focused tests PASS；OTP 公开邀请组件改动文件 ESLint PASS。
- workspace owner `gradle -p apps/backend/catering-business-server :apps:backend:catering-business-server:modules:workspace:test --no-daemon` PASS。
- 本轮未启动/重置/seed；DEV 继续使用既有受管本机 app + 远端中间件运行面。动态浏览器业务结果仍需后续受管 L2 重新读取日志与 cleanup 证据，不以本轮静态/focused proof 冒充 L2 PASS。

## UI-BROWSER-18 修复自测（2026-08-02）

- `libraries/frontend/admin-ui-foundation/src/list/useDetailDrawer.ts`：详情状态由“target 是否存在”改为显式 `isOpen/loading`；`openLoading()` 在请求前打开 surface，`open()` 仅接收成功 owner readback，`finishLoading()` 保留失败态的已打开 surface。
- 平台异步详情入口：workspace、platform administrator、workspace role、workspace account、organization overview、contract overview；运维异步详情入口：workspace user。每个入口先 `openLoading()`，成功才写 target，失败保留已打开 Drawer 并结束 loading；关闭/切换通过 `useAsyncGenerationGuard` 丢弃迟到响应。
- 已有即时挂载详情入口：运维 business entity、store、contract 统一采用 AntD Drawer `loading` 与 `Skeleton`，不再各自使用 Spin/裸文本作为唯一加载反馈。
- `yarn --cwd apps/frontend/platform-admin typecheck`：PASS。
- `yarn --cwd apps/frontend/operations-admin typecheck`：PASS。
- platform focused detail contracts：8 files / 8 tests PASS；operations focused detail contracts：4 files / 11 tests PASS。
- 本修复未执行 seed/reset/L2；上述为静态与 focused proof，不声明动态业务 PASS。DEV 运行面保持不变。

## 本轮浏览器发现（2026-08-02）

| ID | 浏览器现象 | 影响面判定 | 根因/依据 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-19 | platform 侧栏“集团空间详细信息”父组没有图标 | platform shell 单点；IA02 明确要求该 supporting navigation group，operations 已由 catalog navigation group 提供图标 | 首次修复把 `icon` 放进 AntD `MenuItemGroupType`；该类型明确排除 `icon`，因此字段不会进入 group-title DOM。另有 OVERVIEW 子页误用了 Setting 图标。 | **FIXED**：父组保留 group 语义，改为在 `label` ReactNode 内显式渲染 IA02 的 SettingOutlined；概览子页使用 DashboardOutlined。 |
| UI-BROWSER-20 | platform 顶栏品牌右侧重复显示“平台管理员” | platform shell 单点；operations 顶栏已经只有 role/context selector 与 principal | Shell 同时渲染 brand 与静态 actor label；actor 已由右上角 principal 的头像、Root 与 aria-label 表达，产生重复视觉层级。 | **FIXED**：移除可见静态 actor label，保留 Root principal 下拉与无障碍语义。 |
| UI-BROWSER-21 | Tab 已有页面标题，内容区又重复显示 Card/Title/ProTable 标题 | 两后台共性 | 两个 Shell 都负责 page/tab title，但页面组件仍各自渲染同一 catalog title；operations 的 `headerTitle` 和 platform 的 Card/正文 Title 均是重复来源。 | **FIXED**：platform 管理、集团空间、概览、组织/合同、角色、账号、扩展页去掉页面级重复标题；operations 合同、门店、门店档案、组织结构去掉重复 `headerTitle`/Card title。业务分区小标题、详情标题与登录/恢复独立流程标题保留。 |
| UI-BROWSER-22 | Tab 说明性描述另占正文首行，未处在既有页头位置 | platform 页面共性 | 页面标题槽位被重复标题占用，说明被放在 Card body；在无 Card 的页则直接成为独立正文首段，导致 shell/page header 层级不一致。 | **FIXED**：管理员、集团空间、概览把说明移入原 Card title slot（只显示说明，不重复页面标题）；角色、账号、扩展页保留为统一 secondary page-intro，组织/合同页仅保留页头刷新动作。 |
| UI-BROWSER-23 | operations-admin stylelint 仍报 AntD 内部选择器与 rgba | 两后台共性样式治理 | operations shell 用 CSS 深选择器定位 Sider 内部宿主和 Form label，并用 rgba 绕过主题 token；与 platform semantic styles 约束冲突。 | **FIXED**：改用 `Layout.Sider.styles.body` 注入 flex 宿主，删除无实际业务作用的 Form 内部选择器，颜色改用 operations-admin CSS 变量。 |

## UI-BROWSER-19..23 修复自测（2026-08-02）

- `apps/frontend/platform-admin`: `yarn typecheck` PASS；`yarn lint:style` PASS；38 个 focused test files / 42 tests PASS。
- `apps/frontend/operations-admin`: `yarn typecheck` PASS；`yarn lint:style` PASS；21 个 focused test files / 42 tests PASS。
- 两个后台的页面级标题重复扫描已复核：保留登录/恢复流程卡片标题、业务内分区标题、详情标题；Shell 已提供的页面标题不再由业务列表重复渲染。
- 本轮仍未执行 seed/reset/L2；以上为源码、类型、样式与 focused proof，不声明动态业务 PASS。

## UI-BROWSER-19 根因纠偏（2026-08-02）

- 首次静态自检只确认了 `menuItems` 对象存在 `icon` 字段，没有验证 AntD `MenuItemGroupType` 的真实渲染契约，导致“源码 PASS、浏览器无图标”的误判。
- 已回读 `node_modules/antd/lib/menu/interface.d.ts`：`MenuItemGroupType` 从 rc-menu group 类型中排除 `children`，没有 `icon` 属性；因此父组图标必须作为 `label` 的可渲染节点显式组合，不能仿照 MenuItem/SubMenu 的 `icon` 字段。
- 预防：以后对 AntD item union 的视觉属性，必须同时检查类型定义与最终 DOM/组件渲染路径；对象字段存在不再作为 UI 渲染证据。
- 修复后 platform-admin `typecheck`、`lint:architecture`、`lint:style` 与 38 files / 42 tests 全部 PASS；未将此静态证据表述为 L2 PASS。

## 本轮浏览器发现（2026-08-02，收起态）

| ID | 浏览器现象 | 影响面判定 | 根因/依据 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-24 | 侧栏收起后父组“集团空间详细信息”仍显示文字 | platform shell 单点 | 父组图标为自定义 `label` ReactNode；AntD 收起态只隐藏其内建菜单文字，不会识别自定义 label 内的文本节点。 | **FIXED**：`siderCollapsed` 驱动父组 label class，收起时隐藏文字、保留 SettingOutlined，并保留 aria-label。 |
| UI-BROWSER-25 | 收起/展开按钮的图标视觉不变化 | platform shell 单点 | 旧实现使用同一自绘 SVG，仅依赖 CSS 旋转；路径本身不表达两个状态，且收起态视觉差异不可靠。 | **FIXED**：改用 AntD `LeftOutlined`（展开态，点击收起）与 `RightOutlined`（收起态，点击展开）显式状态映射，移除旋转补偿。 |

## UI-BROWSER-24..25 修复自测（2026-08-02）

- platform-admin `typecheck`：PASS。
- platform-admin `lint:architecture`：PASS。
- platform-admin `lint:style`：PASS。
- platform-admin focused tests：38 files / 42 tests PASS。
- `git diff --check`：PASS。
- 本轮未执行 L2；上述证据不替代动态浏览器业务 PASS。

## UI-BROWSER-19/24 官方菜单模型纠偏（2026-08-02）

- 对照 Ant Design 5 Menu 官方 API 后确认：一级带图标并承载二级菜单应使用 `SubMenuType`（`type: 'submenu'`、`icon`、`label`、`children`）；`MenuItemGroupType` 只用于分组标题，不支持一级菜单图标，也不提供收起态图标语义。
- platform shell 已改为官方 `submenu` items，并显式传 `mode="inline"`、`inlineCollapsed={siderCollapsed}`、`defaultOpenKeys`；移除自定义 group-label 及相关 CSS。父组图标、收起态 popup/二级菜单交互交由 AntD 官方实现。
- platform-admin `typecheck`、`lint:architecture`、`lint:style` 与 38 files / 42 tests 全部 PASS；本轮未执行 L2。

## UI-BROWSER-19/24/25 跨后台通用菜单模型修复（2026-08-02）

- 根因抽象：导航父节点的图标与可进入子节点被错误建模成 `MenuItemGroup`，同时 operations-admin 通过页面显示文案分组，导致父组无法获得官方图标/收起语义，且前端重复维护分组真相。
- 通用修复：`contracts/catalog/admin-catalog.json` 为四个 operations 导航组声明唯一 `navigation.iconKey`；`scripts/generate/edge-codegen.mjs` 校验其闭集并向每个 operations page projection 生成 `menuGroupKey/menuGroupIconKey`；operations-admin 按生成字段聚合并输出 AntD `submenu`，父组 icon 由 iconKey 映射，子项继续使用 page icon。
- 这样两个后台都遵循同一官方模型：platform-admin 已使用 `submenu` + `inlineCollapsed`，operations-admin 使用 `submenu` + `mode="inline"`，不再以 `MenuItemGroup` 伪装可进入一级节点，也不再以 raw label 作为分组 key。
- 静态自测：edge-codegen self-test/check PASS（246 outputs）；operations-admin typecheck PASS；operations-admin 21 files / 42 tests PASS；platform-admin PlatformApp focused test PASS；双后台 architecture/style lint 与 `git diff --check` PASS。未执行 DEV、seed 或 L2，以上不构成动态业务 PASS。

## UI-BROWSER-26 管理员改名后壳层名称陈旧（2026-08-02）

| ID | 浏览器现象 | 影响面判定 | 根因/依据 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-26 | 管理员资料中的“姓名”已改为“超级超级管理员”，右上角仍显示旧的“Root” | platform-admin session-owned shell；同类壳层展示 read model 均需检查写后刷新 | 右上角读取当前 platform session 的 `displayName`；管理员编辑只做列表/详情 owner readback，没有触发 shell session readback。IA03 将姓名定义为管理员资料字段，`PlatformSessionView.displayName` 是壳层展示来源。 | **FIXED**：新增 app-owned `PlatformSessionProvider`；管理员资料保存成功后触发 `getCurrentPlatformSession`，用 owner 返回的最新 `displayName` 替换 shell session。刷新瞬时失败保留当前可见名称；未授权响应仍走既有 session recovery。 |

## UI-BROWSER-26 修复自测（2026-08-02）

- platform-admin typecheck：PASS。
- platform-admin 全量 focused tests：38 files / 42 tests PASS。
- platform-admin architecture/style lint：PASS。
- `git diff --check`：PASS。
- 未启动 DEV、seed 或 L2；以上为源码、类型、静态门与 focused proof，不声明动态业务 PASS。

## UI-BROWSER-27 标准 CRUD 搜索区统一（2026-08-02）

| ID | 浏览器现象 | 影响面判定 | 根因/依据 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-27 | 标准 CRUD 列表的查询区由各页面手写 inline Form，控件布局、重置语义与 test-id 不统一 | 两后台共性；只覆盖 IA 已批准筛选的标准 CRUD 列表，不扩大到只读/树形/IA 明确暂不开放筛选的页面 | 页面重复维护查询表单；ProTable 的官方 QueryFilter 能力未作为列表统一入口使用，导致相同列表交互出现多套实现 | **FIXED**：platform 管理员、集团空间，以及 operations 业务实体、门店、用户、邀请列表统一使用 ProTable `search`/QueryFilter；表格列用 `search: false` 或 `hideInTable` 表达显示面，查询参数仍由 owner query 与原有分页/排序链路承载；按钮与字段通过 `fieldProps`/`optionRender` 复用稳定 test-id。IA03 的只读组织/合同概览、层级树、角色/账号/扩展字段等无筛选页面保持原状，不凭空增加查询能力。 |

## UI-BROWSER-27 修复自测（2026-08-02）

- platform-admin：typecheck PASS；style lint PASS；architecture lint PASS；38 focused test files / 42 tests PASS。
- operations-admin：typecheck PASS；style lint PASS；architecture lint PASS；21 focused test files / 42 tests PASS。
- 标准 CRUD 源码扫描不再存在页面级手写 inline filter Form；剩余 inline Form 均属于登录/恢复、创建/编辑 Drawer 或 IA 明确为只读/准备中的特殊 surface。
- 本修复未启动 DEV、seed 或 L2；以上为源码、类型、架构、样式与 focused proof，不声明动态业务 PASS。

## UI-BROWSER-29..31 复核发现（2026-08-02）

| ID | 浏览器/对账现象 | 影响面判定 | 根因 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-29 | 收起菜单按钮位置与图标行为不像 v2/AntD 官方 Sider | 两后台共性 shell | 历史修复用外置 Button + 自绘状态图标；静态断言只确认了“有图标字段”，没有验证 Layout.Sider 官方 trigger 的 DOM/两态语义，也遗漏了 operations shell。 | **FIXED**：两个 app 改为受控 `Layout.Sider(collapsible/collapsed/onCollapse/trigger)`，Menu 使用 `inlineCollapsed`，trigger 由官方 Sider 承载并用明确 Left/Right 图标；overlay lock 时拒绝折叠。 |
| UI-BROWSER-30 | platform 收起态 footer 仍显示“集团空间”等文字 | platform shell；operations 范围 selector 同类 | 仅隐藏 Form label，Select 的 placeholder/选中 label 仍然渲染；历史 row 没有把“收起态最终 DOM 文案”列成独立 observable。 | **FIXED**：收起态 Select 使用 icon-only `labelRender`、去掉 placeholder、缩窄宽度并保留 aria-label；operations scope trigger 同样 icon-only，Popover 与 owner cascade 不变。 |
| UI-BROWSER-31 | 历史“逐控件已对照”仍漏掉真实缺陷 | 双后台全部 shared/feature control | 对账把 screen/consumer/test exact-set、九维 JSON、CLI/API 静态 warning 当成用户行为证明；共享 shell 未独立入分母；focused test 多为源码包含断言；没有按 AntD item union 的真实 render contract 和当前 DOM 回读。 | **FIXED（治理层）**：新 reconciliation v2 ledger 强制逐行记录 IA anchor、AntD API、运行时 observable、static/runtime 分离状态、catalog key、test-id/a11y、反例与 sibling scan；项目记忆新增通用失败模式，当前实现逐项按该表回读。 |

本组仍未声明 browser/L2 PASS；受管运行完成后须把真实观察证据回填 `2026-08-02-v2s-admin-ui-ia-reconciliation-v2-codex.md`，不能用本登记的静态自测替代。

## UI-BROWSER-28 验证码错误与 DEV/UAT 回填（2026-08-02）

| ID | 浏览器现象 | 影响面判定 | 根因/依据 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-28 | 手机号校验把 `手机号与模式不匹配 /^1\d{10}$/` 等技术文本显示给用户；发送验证码后 DEV/UAT 返回的验证码只显示在提示区，没有回填验证码输入框 | 两后台共性，覆盖登录、公开恢复和公开邀请 OTP；生产仍不显示 owner 未返回的 debug code | AntD `pattern` rule 未提供业务化 `message`，组件回退到正则原文；各流程只保存 `debugVerificationCode`/`debugCode` 用于 Alert，未写入同一 Form 的 `code` 字段 | **FIXED**：所有 OTP 手机号/验证码规则补充用户可读中文 message；platform/operations 登录、platform recovery、operations recovery、public invitation 在 owner 返回非空测试码时同时回填 Form `code`，改手机号、失败或离开流程仍清除。生产无 debug code 时不推导、不显示。 |

## UI-BROWSER-28 修复自测（2026-08-02）

- platform-admin：typecheck PASS；style lint PASS；architecture lint PASS；38 focused test files / 42 tests PASS。
- operations-admin：typecheck PASS；style lint PASS；architecture lint PASS；21 focused test files / 42 tests PASS。
- 新增/更新 focused contract 断言覆盖业务化校验文案与 debug code → `Form.code` 回填；全仓 OTP pattern 扫描确认已识别的规则均有用户可读 message。
- 本修复未启动 DEV、seed 或 L2；以上为源码、类型、架构、样式与 focused proof，不声明动态业务 PASS。

## UI-BROWSER-32 实体引用筛选语义（2026-08-02）

| ID | 浏览器/对账现象 | 影响面判定 | 根因 | 处置 |
|---|---|---|---|---|
| UI-BROWSER-32 | 平台合同概览的“门店”与“经营租户”是普通文本输入；运营合同概览的“经营租户”也是普通文本输入。用户无法按 owner 候选的 key/code 与 name 选择稳定实体。 | 双后台同根问题；实体自身列表的 name/code 标量筛选不属于本 finding。 | UI 形状与 owner contract 同时缺失：platform 合同只提供 `storeName`/`tenantName` 文本参数，返回的 `filterOptions` 只有 `id/name`；operations 合同只提供门店 candidate 与 selectedTenant，列表仍只有 `tenantName` 文本参数。当前 package 未包含 `contracts/openapi` 和 `modules/store-contract` owner source，不能通过页面局部 Select、当前列表行或单个 selectedTenant 伪造完整候选闭环。 | **ROOT-CAUSE REGISTERED / OWNER-CONTRACT-PENDING**：新增统一 `ENTITY_REFERENCE_FILTER_MUST_USE_OWNER_CANDIDATE_QUERY` 设计红线；对账单明确三处缺陷与五处已正确闭合的 sibling surface。下一 owner-contract package 必须先扩展 candidate DTO（id/code/name、远程 code/key+name 查询、分页/selected preservation）与 list id predicate，再生成 edge/client，最后替换 UI；本 package 不做越界补丁。 |

### UI-BROWSER-32 全量 sibling 盘点

- 已正确闭合：platform 组织概览的项目/品牌/经营租户；operations 门店列表的项目；operations 合同新建/编辑的门店；operations 门店创建/编辑的项目、品牌、经营租户、总公司；operations workspace invitation 的任职机构/业务角色候选。
- 误报排除：`WorkspaceInvitationPanel` 的“任职机构”列表筛选保留文本查询是允许的，因为 owner 先通过 `OrganizationAssignmentCandidateService` 返回 scoped opaque refs，`displayPath` 同时包含各层 code 与 name，再由 owner 以 ref 集合过滤邀请；它不是从当前表格行做 client-side 文本匹配。
- 明确反例：platform/operations 各实体自身的名称、编码、合同编号、货号、手机号、角色名等是当前列表实体的标量查询，不应被误改成候选 Select。
- 明确反例：`DataScopeSelector` 的大区/项目/门店 Select 是已授权上下文切换，不是列表搜索条件；不能因为其 option label 当前是业务名称就把它并入 CRUD 查询分母。
- 待 owner contract package：platform 合同门店、platform 合同经营租户、operations 合同经营租户。

本 finding 的静态结论不代表 DEV/L2/business PASS；候选契约闭合后仍须按新的实体引用筛选对账行执行 focused proof 与受管浏览器验证。
