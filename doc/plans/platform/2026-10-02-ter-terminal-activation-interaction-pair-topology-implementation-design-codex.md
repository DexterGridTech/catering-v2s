SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 终端激活交互与双机拓扑优化专项 · implementation-facing 详设

## 0 · 元数据与授权边界

BUSINESS_SOURCE=doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md
JOURNEY_REFS=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md
IA_REF=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md
INTERACTION_REF=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md
AUTHORIZED=仅本轮详设、实施计划、Journey/IA/交互设计与测试方案；无源码、生成、构建、测试、verify、DEV、reset/seed、L2、UAT、部署授权
IMPLEMENTATION_AUTHORITY=false
REVIEW_CYCLE_ID=TER-ACTIVATION-INTERACTION-PAIR-TOPOLOGY-DESIGN-2026-10-02
REVIEW_TARGET=DESIGN
EVIDENCE_STATUS=STATIC_ONLY；V-01..V-20均NOT_RUN

## 1 · 真实业务目标与方案比较

### 1.1 结构性问题

两个TER integration当前没有统一激活/登录准入；terminal-data-client与server-config的owner能力尚未接到本地admin、配置默认值未接app composition。AdminLauncher/AdminLayerFrame的既有手势和关闭路径按host-primary或peer-intent处理，不能满足副机断链时本机管理恢复。member-registry只有一个pending，整份state同步会让两端录入互相覆盖；wallpaper已有本地owner但LMS/LSP职责未分开。只在页面隐藏不足以防止迟到command或旧projection重新开放业务。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：integration直接读写slice、直接发HTTP、按surface条件隐藏 | 两个composition重复准入；credential/config/projection出现第二事实；branch无法离线恢复 | 拒绝，破坏owner与唯一command/selector业务通路 |
| B：增加通用journey router、offline queue、同步协调层和恢复状态框架 | 包住所有阶段，但当前只有两个integration；重复integration command与topology sync | 拒绝，为未来复杂性付当前成本 |
| C：两integration以owner selector驱动唯一阶段路由；UI呈现包只发具名owner command；复用当前topology sync及连接身份判定 | 事实留在owner；业务页面共享现有owner能力；不存第二份阶段事实 | 采用 |

我选了C而不是A/B，因为它补当前缺失的唯一接线和本批明确的projection隔离，不复制业务事实，也不创建泛化恢复框架。正式需求R-03明定激活与服务配置呈现包为`ui/base`；它们跨两个integration复用，消费client/server-config公开command和selector，不以`ui/feature` feature-assembly承载，也不持有owner事实。成员列表保留本地整体owner state聚合，不新设上限；PrimitiveList只用于窗口呈现。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-01 | package defaults、owner API与sync shape | server-config、terminal-data-client、topology、composition | package.json serverSpaces；代理密码同步；client/config/projection selectors与command闭包 | 无 |
| CP-02 | 激活/取消UI与四面准入 | client + `ui/base/terminal-activation` + 两integration | ACT-01..04与status tab；只输入8位；激活及取消结果 | CP-01 |
| CP-03 | 本机admin与服务配置 | admin-shell、`ui/base/server-config-panel`、server-config | 所有内容面local打开/关闭；编辑/只读配置tab；秘密mask | CP-01 |
| CP-04 | 当前peer readiness、断链mask与恢复 | topology、integration-assembly、admin-shell、两integration | current peer身份+required projection gate；业务双重阻断；local topology恢复 | CP-01、CP-03 |
| CP-05 | sample staff/member/wallpaper隔离 | sample owners及feature UI | host共享成员列表、每端独立pending、staff投影、本地壁纸 | CP-01、CP-04 |
| CP-06 | 两composition阶段路由、public surface与focused proofs | 两integration、全部新包 | hydration后重判、测试接线、入口与导出同步 | CP-02..05 |

CP为一个批次内阶段，不是独立交付。逐CP完整阶段对账、全批6b、整体验收、13c与implementation review的顺序在计划中明确。

## 3 · 横切机制对照表

| 机制 | ①现成能力/规范 | ②可证伪观察 | ③无现成时实现形态 | ④本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧权限 | local owner selector、workspaceOwnership、topology projection | branch断链/旧peer时业务面不显示可操作旧数据；所有business selectors不得让过期缓存变资格 | projection绑定current peer identity/revision；不加第二授权系统 | 两integration全部业务页与admin只读页 |
| 写授权与复核 | owner command；resolveTopologyCommandTarget | branch直接调用config/cancel/host MAIN command被拒；断链不提交 | 具名command重读current owner facts后写入 | activation/cancel/config/topology/staff/member/wallpaper/placement |
| 跨owner写 | integration actor按owner selector定阶段 | activation result未completed时不进入staff；UI自身state不能改变owner事实 | 只单向调用公开command，不造事务 | activation、staff、member confirm、wallpaper、topology recovery |
| 集合形态与分页 | member-registry完整members state；PrimitiveList窗口渲染；collection-boundary-modes | 造大于24项仍能访问末项，mounted row不超过24，持久/同步集合未截断 | Detail整体state读写；不加page/cursor/cap | 唯一业务集合为member list；serverSpaces和壁纸是固定app配置 |
| 缓存失效/刷新 | owner selector、runtime subscribeState、integration stage actor | owner更新后当前页readback改变；未受影响owner、其他端pending不变 | owner command后由selector观察，不加RTK query/轮询 | 所有新screen和两个composition |
| RTK读取/加载 | N/A：TER用runtime selector，非RTK Query管理后台 | 源码无RTK currentData/isFetching依赖 | 遵守ui-base-render selector上下文 | 全部26 screen |
| 同一事实单一住址 | TER state owner切片 | UI/integration没有credential/config/member/staff/wallpaper事实副本 | 只新增必要草稿与同步ready元数据 | client、server-config、topology、staff、member、wallpaper |
| 失败可见 | terminal-coding-standard、owner typed errors、结构化日志规范 | 非completed命令不能显示成功；失败与owner结果对齐 | UI按owner结果显示，不吞错不改事实 | 激活、取消、配置、拓扑、员工、会员、壁纸 |
| owner错误到HTTP映射/注册 | N/A：无新增业务HTTP operation/error code | OpenAPI/edge diff无新增操作 | 若需要新后台operation停下提出裁决 | 全部本地TER commands |
| owner审计三件套 | N/A：无新后端owner或审计表 | migration和seed diff无新增业务审计 | 不用UI日志冒充业务审计 | 本专项无新增审计 |
| 幂等与replay | terminal-data-client operation identity；member-registry operation identity | 响应丢失后先读取owner身份/列表，无重复激活或会员 | 只加确切operation身份，不建全局queue/replay | activation与LSP host member submission |
| generated code | contracts/openapi-source→r5-edge-materialize→edge-codegen→terminal-client-api生成链；terminal consumer policy登记需要生成的operation | canonical 保留完整路由；只对被terminal policy选中的两个请求生成去group-workspaces前缀的operation suffix；其他消费者和后台请求不变 | terminal-data-client command只收8位activationCode或取消动作所需的非配置业务参数；client编码suffix参数/query但不读配置、不解析或重建groupWorkspaceKey。composition把server-config公开provider注入transport network adapter；adapter每次请求按当前selected service space读取addresses[].baseUrl并追加suffix，保留baseUrl path及operation query。激活凭证中的groupWorkspaceKey/terminalRef/storeRef/generation只取经验证成功响应 | canonical、terminal policy、两个生成器、client actor、composition、adapter与URL fixtures；激活/取消前缀与编码逐字节验收 |
| 日志与脱敏 | AGENTS observability标准与当前runtime logger | 日志有阶段/status/request身份，但无code/password/credential/raw payload | 使用现有logger，不造bus | 新screen command与stage transition |
| 迁移/回填 | 现有TER owner persistence版本机制 | restart读回owner状态；无第二credential副本 | 如需改版本，只按当前owner既有迁移形态 | client/config/member/staff/wallpaper state |
| 前端共享行为 | ui-base-render/primitives/input/admin-shell/integration-assembly | 新页面使用公开原语与现有焦点、滚动、手势 | 没有现成组件时只建feature局部叶组件并引用代码先例 | 26屏与两composition |
| 管理后台交互一致性 | N/A：§3-K面向antd管理后台；TER按terminal-coding-standard TR-16/TR-17与§4-D/§4-E | screen逐项检查位置、焦点、行为、失败与恢复 | 不复用后台例外；按TER控件行为实现 | 全部TER screens |
| 候选/下拉数据源 | server-config selector/package serverSpaces、wallpaperCatalogData.json | 显示候选与owner声明集合完全相同 | 用TER primitives真实Radio/候选选择 | 服务空间、服务名、壁纸目录 |
| 路由编码与名称呈现 | terminal-client generation policy + transport network adapter；UI只显示server-config selector提供的服务空间名称 | 两个terminal operation使用当前选中服务空间对应地址；路径前缀、operation suffix、斜杠、query及编码参数逐字节到达fixture；client没有config selector/state访问 | terminal policy从canonical route派生operation suffix；client仅序列化业务参数；composition注入server-config provider，通用adapter读取当前selected address的addresses[].baseUrl并组合请求；不把集团标识从URL解析为凭证身份 | terminal激活、取消两个请求；其它generated consumer保持完整route；ADMIN-02每个候选地址 |
| 原子变更组 | foundation-charter §5-C、workspace public exports/invariants | package、index、README、invariants、tests与composition一并更新 | 单向依赖，无额外provider | 新UI feature和owner sync fields |

### 第三方库 API 与运行行为依据

本设计不依赖新的第三方API、隐藏默认值或网络行为；屏幕、滚动、输入、列表、render均经本仓现有封装，网络/双屏/持久化仍由既有adapter与owner处理。当前两个Expo integration的package.json声明Expo ~57.0.18、React 19.2.3、React Native 0.86.3、react-native-web ~0.21.0；root yarn.lock解析Expo 57.0.18、React Native 0.86.3、react-native-web 0.21.2。该版本记录不宣称运行行为已通过。实施如需直接依赖任何第三方新API/默认行为，先按doc/platform/third-party-library-usage-standard.md和cs-third-party-library-usage skill核实际解析版本与对应官方资料，补到该CP后再动手。新增依赖为N/A。

## 3a · UI/testId 前置复核与L2边界

UI_DESIGN_REVIEW=OPEN（Dexter接受整体方向；R2对修订前字节NO-GO；S-1已按作者intake修复；修订后字节待Dexter/Claude评审）
TESTID_REVIEW=OPEN（26个screen的控件分母与当前/提案ID已逐屏列明；实现尚未发生）
L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：无Browser L2场景且未获L2授权
L2适用性=N/A_WITH_REASON：需求的未来验证面是两个Expo Web integration与application VM同场景及adapter专项，没有Browser L2授权。testId仍服务TER集成场景与VM控件证据，不将N/A说成PASS。

| case/action（screen） | 用户控件与动作 | UI owning source | 当前 testId / 后续唯一TestIds提案 | 实际动作节点（目前/要求） | L2 binding/touch | focused/static proof | fresh 独立复核 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-01-MMP | 8位数字输入、提交、激活结果 | apps/terminal/ui/base/terminal-activation（新） | 当前无；提案：terminal.activation.code / terminal.activation.submit / terminal.activation.result | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ACT-02-LMP | 8位数字输入、提交、激活结果 | apps/terminal/ui/base/terminal-activation（新） | 当前无；提案：terminal.activation.code / terminal.activation.submit / terminal.activation.result | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ACT-03-LMS | 主屏激活引导，只读 | apps/terminal/ui/base/terminal-activation（新） | 当前无；提案：terminal.activation.guide | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ACT-04-LSP | 配对主机激活引导，只读 | apps/terminal/ui/base/terminal-activation（新） | 当前无；提案：terminal.activation.guide | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ADMIN-00 | 本机96 logical px内5次/1800ms手势 | apps/terminal/ui/base/admin-shell | 当前常量：terminal.admin:launcher | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ADMIN-SHELL | 本机管理标题、设备激活状态/服务配置/双机拓扑导航项、关闭 | apps/terminal/ui/base/admin-shell | 当前常量：`terminal.admin:shell` / `terminal.admin:navigation`；既有adminTestIds.section(partKey)生成导航项ID；新增section须登记稳定partKey | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ADMIN-AUTH | 本机管理员密码、验证、关闭 | apps/terminal/ui/base/admin-shell | 当前常量：terminal.admin:password-input / terminal.admin:verify / terminal.admin:close | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ADMIN-01 | 状态行、仅host可见的取消激活、结果 | apps/terminal/ui/base/terminal-activation（新） | 当前无；提案：terminal.activation.admin.status / terminal.activation.admin.cancel / terminal.activation.admin.result | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ADMIN-02 | 服务空间/服务、地址1..4各自addressName/baseUrl（完整URL前缀）/timeoutMs、代理各字段、保存/清除/恢复/结果 | apps/terminal/ui/base/server-config-panel（新） | 当前无；提案：terminal.server-config.space / service / address.<slot>.name / address.<slot>.url / address.<slot>.timeout / proxy-enabled / proxy-host / proxy-port / proxy-user / proxy-password / save / clear / restore / result；每个address.<slot>.url是唯一baseUrl输入，不另设url-prefix | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ADMIN-03 | 主机配置只读状态；无输入与写按钮 | apps/terminal/ui/base/server-config-panel（新） | 当前无；提案：terminal.server-config.read.status / space / service / address / proxy-status | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| ADMIN-04 | 拓扑状态、host地址、连接/配对、退配、错误阶段 | apps/terminal/ui/base/admin-shell + kernel/base/topology | 当前常量：terminal.admin:topology:host-status / host-ip / pair / unpair / operation-feedback / failure:reason | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| AUTH-01-MMP | 姓名、密码、登录、错误/进行中 | apps/terminal/ui/feature/sample-staff-auth | 当前字面量：sample.auth.login:operator-name / passcode / submit / loading；sample.auth.notice:message | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| AUTH-02-LMP | 姓名、密码、登录、错误/进行中 | apps/terminal/ui/feature/sample-staff-auth | 同AUTH-01（移动/笔记本语义一致） | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| AUTH-03-LMS | 请在主屏登录；无输入/提交 | apps/terminal/ui/feature/sample-staff-auth（只读引导提案） | 当前无独立引导节点；提案：sample.auth.guide | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| AUTH-04-LSP | 请先在主机登录；无输入/提交 | apps/terminal/ui/feature/sample-staff-auth（只读引导提案） | 当前无独立引导节点；提案：sample.auth.guide | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-01-MMP | 会员列表/行/空态/新增、姓名电话、提交取消、退出；年龄仅在SAMPLE-04确认时录入 | apps/terminal/ui/feature/sample-member-desk | 当前字面量：sample.desk.member-list:title / row / empty / empty-action / add / logout；sample.desk.member-form:name / phone / submit / cancel；此表单无年龄输入；sample.desk.customer-member:age-label / age只用于确认态 | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-02-LMP | 同SAMPLE-01（姓名/电话表单无年龄；年龄只在顾客确认时输入） | apps/terminal/ui/feature/sample-member-desk | 同SAMPLE-01；实施时集中为该feature唯一TestIds源 | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-03-LSP | 列表/新增表单姓名电话/提交取消与同页顾客确认态的可选年龄/确认/拒绝；无退出 | apps/terminal/ui/feature/sample-member-desk（LSP独立实现） | 现有源码无LSP专属动作；提案：sample.desk.branch.member-list / add / member-form:name / phone / submit / cancel / customer-member:name / phone / age / confirm / reject | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-04-MMP | 单屏移动主机当前pending姓名/电话、可选年龄、确认/拒绝/条件性交还店员 | apps/terminal/ui/feature/sample-member-desk/src/components/mobile/CustomerMember.tsx + ../../hooks/useCustomerMember.ts | 当前字面量：sample.desk.customer-member:title / name / phone / age-label / age / confirm / reject / hand-back | Heading/只读文本/真实年龄输入/真实Button；hand-back仅handheld-confirm模式 | N/A_WITH_REASON：本专项未授权Browser L2 | future component focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude DESIGN评审 | DESIGN_PROPOSAL / CURRENT_SOURCE_IDS_NOT_REVIEWED_FOR_IMPLEMENTATION |
| SAMPLE-05-LMP | 无LMS的LMP单屏顾客确认：姓名/电话、可选年龄、确认/拒绝/条件性交还店员 | apps/terminal/ui/feature/sample-member-desk/src/components/laptop/CustomerMember.tsx + ../../hooks/useCustomerMember.ts | 当前字面量：sample.desk.customer-member:title / name / phone / age-label / age / confirm / reject / hand-back | Heading/只读文本/真实年龄输入/真实Button；hand-back仅handheld-confirm模式 | N/A_WITH_REASON：本专项未授权Browser L2 | future component focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude DESIGN评审 | DESIGN_PROPOSAL / CURRENT_SOURCE_IDS_NOT_REVIEWED_FOR_IMPLEMENTATION |
| SAMPLE-06-LMS | 欢迎、姓名/电话只读、可选年龄输入、确认/拒绝 | apps/terminal/ui/feature/sample-member-desk | 同SAMPLE-04（LMS仅host runtime pending） | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-07-MMP | 壁纸none/w1/w2/w3选择、确认、店员登出 | apps/terminal/ui/feature/sample-wallpaper-picker | 当前常量：sample.wallpaper.picker:title / options / options:<wallpaperId> / confirm；新增logout动作使用该feature唯一TestIds常量 | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-08-LMP | 壁纸选择/确认、退出选择、店员登出 | apps/terminal/ui/feature/sample-wallpaper-picker | `sample.wallpaper.picker:options:<wallpaperId> / confirm / exit / logout`；exit与staff logout是独立真实动作 | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-09-LMS | 只显示host已确认壁纸，无操作 | apps/terminal/ui/feature/sample-wallpaper-picker | 当前字面量：sample.wallpaper.background | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| SAMPLE-10-LSP | 本地壁纸选择/确认/退出；无登出 | apps/terminal/ui/feature/sample-wallpaper-picker（LSP独立页面） | 当前源码无LSP专属screen；提案：sample.wallpaper.branch.picker:option.<wallpaperId> / confirm / exit；不登记logout | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| MASK-01 | 断链提示与业务全屏遮罩；保留本机admin launcher | 两个integration composition + topology | 当前无专项mask节点；提案：terminal.pair.mask:status；launcher继续terminal.admin:launcher | 当前控件按interaction §4标明的源码事实；新增节点必须将ID挂到真实输入/按钮/Radio/状态节点，不用wrapper替代。 | N/A_WITH_REASON：本专项无Browser L2授权；非adapter未来按TR-16先Expo Web再同场景VM | 未来所属组件focused + Expo Web；当前NOT_RUN | 修订后字节待Dexter/Claude评审；非实现验收 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
实施授权后重开screen源码，逐控件对账唯一TestIds文件、实际动作节点、web/VM binding与focused proof。当前没有Browser L2场景，表中testId未实现、未绑定。

## 4 · 每个 CP 的门控

| CP | 可证伪失败条件与不变量 | FORBID | 验证与形态理由 | RECALL |
| --- | --- | --- | --- | --- |
| CP-01 | 两app defaults交叉使用；proxy password遗漏branch同步；client credential进projection即红 | 禁新credential owner、配置getter、同步框架 | defaults与state-sync focused；复用server-config注入和topology声明 | 正式R-02/R-06..08/R-12..13；config/client/topology owners |
| CP-02 | secondary可输码；配置/角色异步变化后提交旧target；unknown result显示成功 | 禁UI保存secret、手拼workspace key/full URL | owner actor与feature tests + Web；表单只调用client | R-03..05/R-08；terminal client generated/source |
| CP-03 | 双机LMS/LSP无法local开关admin；slave有editable config/cancel；password回显 | 禁peer-intent本机通路、禁只隐藏控件而owner仍可写 | shell/admin tests + Web；复用AdminLauncher/frame和admin sections | R-05..06/R-11..12；admin-shell |
| CP-04 | stale peer/revision/sync未应用时任一业务command成功；关admin解除mask | 禁轮询、offline queue、角色中间态放行 | topology及actor focused、两实例VM；复用session identity并新增最窄projection readiness | R-10..12；topology selectors/controller/target |
| CP-05 | 多pending互相覆盖、LSP确认重复写、branch可独立staff登录、host壁纸覆盖branch | 禁全局journal/锁/全功能同步副本 | owner tests + Web + paired VM；owner内分list/pending与projection | R-09/R-09a/R-09b/R-12；sample owners/components |
| CP-06 | 两integration不同阶段、login恢复绕开gate、导出无consumer | 禁React本地stage事实 | assembly/public-surface tests + Web；复用runtime subscriptions | R-10/R-15；两个integration source |

每个CP RECALL：相应正式需求、Journey、IA与interaction、memory六维命中原文、上述owning source、terminal-coding-standard TR-16/TR-17/§4-D/§4-E。阶段对账单位是完整CP；全部CP之后单独全批6b。

## 5 · operation / path / face / 集合形态

| 意图 | operationId | path | face | 集合形态 | 预期规模/增长 |
| --- | --- | --- | --- | --- | --- |
| 本批新增HTTP | N/A | 不新增operation | N/A | N/A | sample功能为本地owners |
| 既有激活/取消API消费 | 使用当前generated operation身份 | server-config prefix + terminal API generated suffix | public terminal client | 单次请求 | config最多4个地址 |
| member registry selector | 非HTTP | 无 | public local state | Detail整体集合 | 本机sample登记随使用增长；不设人为上限 |
| serverSpaces | 非HTTP | app package input | 本机TER | Bounded | 每app声明的有限集合 |
| wallpaper catalog | 非HTTP | wallpaperCatalogData.json | local sample | Bounded | 当前源码固定4项 |

没有新增edge/error set；如路径需要调整，只更canonical source并走既有materialize/codegen，不手改生成物。

## 6 · 跨 owner 写矩阵

| policy | 第一个owner command | 第二个owner command | 事务 | 失败时回滚事实 |
| --- | --- | --- | --- | --- |
| 激活 | UI以{activationCode} dispatch activateTerminalCommand | client生成本次operation身份、设备/版本事实并调用generated suffix API | client管理本地凭证生命周期；groupWorkspaceKey、terminalRef、storeRef与generation取validated success response | 拒绝不写active；结果unknown先读selector |
| 取消激活 | status UI派发cancelTerminaActivationCommand target=local | client失效本机credential并stop TDS | client现有生命周期 | 失败仍呈cancelling/owner错误，UI不清slice |
| config | panel派select/set/clear/restore | server-config校验后先同步更新owner effective state；持久化结果及topology apply结果分别readback | 业务写仍由server-config owner串行；同步是独立的topology apply | 校验拒绝：effective不变且草稿保留；内存已生效但持久化失败：保留新effective并提示未落盘；同步失败：host保持当前effective、branch不得用旧值冒充current并保持not-ready；不默认回滚旧值 |
| branch member confirm | LSP feature本机command保存local pending | 显式peer目标host member owner command | 现有command传递，无DB事务 | 结果不明先读host列表与op identity，不重发 |
| staff | host staff UI command | owner projection同步 | owner内部提交 | slave不写；host失败保持原session |
| wallpaper | 本机picker command | host LMS只读confirmed | 不跨owner写 | 失败保留旧confirmed |
| topology recovery | local admin命令 | topology owner运行pair/unpair | 既有owner command | 中间态继续mask，失败不清credential |

依赖单向：UI feature调用public owner API；integration组装feature/owner；base owner不依赖UI。

## 7 · 声明—传递—消费矩阵

| fact | 声明 | 传递 | 消费 | proof |
| --- | --- | --- | --- | --- |
| app defaults | 每app package.json serverSpaces | composition传给createServerConfigModule | selector/network adapter provider | 两app互不合并、restore回本app |
| proxy password | server-config owner明文保存 | host→branch authoritative sync字段 | branch config selector供本地HTTP adapter | sync测试值相同；DOM/log不回显 |
| terminal credential | terminal-data-client protected owner state | 不同步secret/pending | host TDS/activate only | projection不含credential |
| peer readiness | topology current session identity和apply revision | 现有sync controller按声明传送 | integration stage与actors | old peer投影不能解锁 |
| staff资格 | staff owner | 仅必要safe字段主到副 | stage router与LSP引导 | host logout后slave不再业务 |
| member facts | host list + hostPending（含operationId）+ branchPending | projection只更新branch可见的members与hostPendingProjection；apply保留branchPending；不覆盖branch本地草稿 | 单机LMS读MASTER本地hostPending并本地决定；双机SLAVE+VICE的LMS只读hostPendingProjection，confirm/reject附operationId并显式target=peer回MASTER owner；LSP只读/写branchPending | stale operationId被MASTER owner拒绝；迟到projection不覆盖branchPending；并发host确认最多提交当前operation一次 |
| wallpaper | runtime-local pending/confirmed | host confirmed供LMS；不覆写slave | host两个面和slave LSP | 切换面后LSP值保持 |
| admin commands | local target | 不送peer | 本地打开/关闭和恢复 | peer断开可开关local layer |
| HTTP route | canonical完整route；terminal generation policy声明suffix | client生成suffix和必要参数；不接收或解析selected-space编码 | composition provider→transport adapter当前address baseUrl | 实际request target断言前缀路径保留、suffix/query正确；地址空间切换后使用新selected baseUrl |
| testIds | 各app的唯一TestIds.ts | integration automation/VM binding | 实际动作节点 | DOM/native node与roster一致 |

## 8 · 业务规则 → owner 判定点

| 规则 | owner判定点 | 验收场景 |
| --- | --- | --- |
| R-01 | device/display context与topology分离；供电变化只经确认command | V-01、V-18、V-20 |
| R-02 | client独占终端credential/TDS业务协议；server-config独占服务地址与代理秘密；transport通用；composition注入provider | V-08、V-19 |
| R-03 | 四面显式激活UI command在active时显示“设备已激活成功”；无计时/按钮，integration按当前selector交业务包路由；断链遮罩优先 | V-01、V-10、V-20 |
| R-04 | 激活command不接受groupWorkspaceKey；service space只读selector；credential身份仅由validated success response建立；route使用当前selected space | V-02、V-03、V-04 |
| R-05 | status selectors展示激活/连接/RTT；仅host取消；命名按需求拼写 | V-05、V-09、V-16 |
| R-06 | config owner命令拒slave；config UI对slave只读；addresses[].baseUrl是唯一地址/URL前缀输入 | V-06、V-09、V-16 |
| R-07 | app package各声明serverSpaces并由composition传递，不合并 | V-07 |
| R-08 | terminal consumer生成suffix、client编码operation参数、composition注入provider、transport adapter拼接到当前baseUrl，四者职责闭合 | V-03、V-08 |
| R-09 | staff/member/wallpaper独立feature阶段路由；LMP/LSP组件独立 | V-01、V-10、V-11、V-13、V-14 |
| R-09a | host持member list/hostPending；单机LMS在MASTER+SECONDARY消费同runtime hostPending；双机LMS在SLAVE+VICE消费绑定peer的hostPendingProjection，确认/拒绝带operationId显式target=peer回MASTER owner；branchPending只由LSP消费 | V-12、V-13、V-15 |
| R-09b | wallpaper每runtime独立；LMS读host confirmed | V-14、V-15 |
| R-10 | init与selector变化重判，无阶段副本；优先级严守需求 | V-10、V-11、V-17、V-18 |
| R-11 | current peer身份、连接与required projection ready管mask；UI与owner actor双重阻断；admin local | V-15、V-16、V-17、V-18 |
| R-12 | slave无credential/TDS/staff独立资格；proxy password由server-config同步明文 | V-08、V-09、V-11、V-18 |
| R-13 | 所有读取经selector、修改经owner command，字段同步闭集 | V-04～V-19 |
| R-14 | 新增最少activation/config-panel feature和具体screen；复用现有基础能力 | V-19、V-20 |
| R-15 | V-01..20逐条对账；非adapter先Web再VM，adapter单独证明 | V-01～V-20（详见§11a） |
| R-16 | 每CP重开真实source与用户需求；静态/历史证据不升级动态PASS | 各CP RECALL、全批6b与V-20 |

## 9 · owner API 与消费者

| owner API | consumer |
| --- | --- |
| activateTerminalCommand、cancelTerminalOnlineCommand（改名为需求公开拼写）、selectActivationState/selectConnectionState/selectConnectionLatency | `ui/base/terminal-activation`呈现包与activation admin status；四面阶段路由消费其needToActivateTerminalCommand |
| select/set/clear/restore server-config commands、selectServerConfiguration | `ui/base/server-config-panel`、两app compositions、networkAdapter provider |
| resolveTopologyCommandTarget、selectTopologyFacts、topology commands、createTopologyStateSyncController | integration stages、local topology tab、明确target的LSP host writes |
| staff login/logout commands/selectors | sample-staff-auth与两个integration stage |
| member registry commands/selectors | member-desk host/branch surfaces及sync声明 |
| wallpaper commands/selectors/catalog | wallpaper-picker与两compositions |
| AdminLauncher/AdminLayerFrame/adminShellAssembly/AdminSection types | composition、status/config/topology tabs |
| useUiStateSelector/useDispatchCommand/definePartPair；PrimitiveInput/Button/Radio/List/ScrollView/Image | 新features与旧sample UI重构 |

每个新增公开command/selector须有至少一个具名调用方；详设点名产生物都须有producer/consumer。

## 9a · 实施前全链同步变更清单

| 变更事实 | canonical/生成 | owner/migration | 前端 | tests | fixtures/seed | 处置 |
| --- | --- | --- | --- | --- | --- | --- |
| activation API消费 | 既有openapi-source→r5-edge-materialize→edge-codegen→terminal-client-api | terminal-binding不改业务语义 | client selectors + 新feature + composition | generated/actor/feature/Web/VM | owner tests，不seed | 只由唯一源派生 |
| serverSpaces | app package.json输入 | server-config owner | composition/provider/panel | default validation+composition | per-app fixtures，不seed | 逐app单选不合并 |
| proxy password sync | 无API | server-config + topology sync | config edit/read-only |同步及脱敏 | owner test fixture | 裁决要求明文同步但不回显 |
| local admin | 无API | topology target only | AdminLauncher/Frame/sections | command focus+Web/VM | 无seed | local开关 |
| projection readiness/mask | 若sync message schema变化仅走既有topology protocol source | topology owner |两integration stage/mask | stale-peer与双机VM | test fixtures |最窄身份/revision gate |
| member pending隔离 | 无API | member-registry owner | member-desk LSP/host screens |并发/丢响应/Web/VM | owner fixtures | host list与branch pending分离 |
| staff projection | 无API | staff-session | auth/stage |logout projection tests | owner fixtures |同步安全状态 |
| wallpaper | wallpaperCatalogData.json | wallpaper owner | picker/LMS/LSP components |4项确认与重连 | existing assets | local state |
| testIds | app唯一TestIds.ts | N/A |真实动作节点 |static roster/Web/VM | N/A |no Browser L2 |
|受管UI runner|现有ter-admin-display-web.mjs与tools/terminal-topology/run-dual-device.mjs|N/A|test-expo fixtures|同场景Web及2-device|per-run manifest/cleanup|复用托管进程/身份；若缺专项case只扩所属既有入口 |

实现前用rg建立全量文件集，尤其package README、public index、terminal-invariants、skeleton graph、tests和compositions；本表不是“影响面举例”。生成物不得手改。

## 9b · 变更定位

- 两composition：apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx；apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx。
- admin gesture：apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx；保持现有96px/5 tap/1800ms行为，只撤掉host-primary-only操作门。
- admin open/close：apps/terminal/ui/base/admin-shell/src/components/AdminLayerFrame.tsx；本地layer命令显式target=local。
- config：apps/terminal/kernel/base/server-config/src/features/commands、src/selectors/selectServerConfiguration.ts、src/foundations/networkAdapter.ts。
- member owner：apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts、src/features/actors/actors.ts。
- sync readiness：apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts与两composition的sync slice声明。
- feature source：apps/terminal/ui/feature/sample-member-desk、sample-staff-auth、sample-wallpaper-picker。
- base UI source：apps/terminal/ui/base/terminal-activation、server-config-panel；两包按正式需求R-03跨integration复用，不使用要求`ui.feature.*`的`createFeatureAssemblyModule`，不拥有terminal-data-client或server-config事实。
- 新包/路径先查code-layout与现有workspace scaffold；流程ID不进入runtime目录/类名。

## 10 · 数据迁移

| 迁移 | 加/改什么 | 回填值 | 来源 | 回滚 |
| --- | --- | --- | --- | --- |
| PG/Flyway | N/A，无后端schema/审计/数据库改动 | N/A | N/A | N/A |
| TER persistence | 先重开owner版本机制确认是否需要字段保护/sync schema更新 | 只可保留当前owner本地事实；不从peer缓存回填credential/pending | owner state唯一来源 | 由现有TER owner版本规则确定；若需清真实设备数据则停并裁决 |

本节第二行是实施调查，不授权数据操作，也不假定兼容双写。

## 10b · seed数据

### 10b.1 受影响全集

N/A：无新增后台业务对象、角色、PG schema或seed reference。实施开始前检索seed调用确认，如有真实引用必须增列准确文件。

### 10b.2 两类改动

新功能seed：N/A，本地app初始页展示未激活/空列表/默认壁纸。
既有seed调整：N/A，本批不改后端事实；TER hydration以owner persistence tests核实。

### 10b.3 覆盖

无seed fixture。defaults与owner state由focused tests覆盖，不能调用seed来准备本地UI。

### 10b.4 同步项

N/A：不修改seed plan/executor/role/count。

### 10b.5 边界

不执行reset或seed；本详设不授权任何受管运行。

### 10b.6 前提、父流程与角色

N/A：无seed能力、角色或操作者变更。

## 11 · 验收场景设计

现有UI相关受管入口：scripts/test/ter-admin-display-web.mjs负责Expo Web管理/会员等场景；tools/terminal-topology/run-dual-device.mjs和scripts/test/ter-virtual-keyboard-android.mjs有受管设备身份与双机/双屏执行能力。新增验收只扩所属既有场景，不建泛化registry。下表所有proof当前NOT_RUN。

| scenario | owner文件 | identity | fixture | action | businessOracle | 每场景清理 |
| --- | --- | --- | --- | --- | --- | --- |
| V-01 | both integration tests + topology runner | MMP/LMP/LMS/LSP及对应host/slave实例 | 四内容面、两端身份、供电角色切换fixture | 未确认切换供电与display role；确认切换 | 未确认前当前face/role保持；确认后只更新适用instance事实，LMS仍是主机投影内容面 | 恢复display/role基线；关闭本run创建的terminal与adapter资源 |
| V-02 | terminal-activation UI/client tests | 四面ACT及host/slave资格 | 8位前导零、错误长度、active success、断链mask | 输入并显式派needToActivateTerminalCommand | 前导零保持字符串；active时四面显示“设备已激活成功”，不出现继续按钮/计时；integration按最新selector接管路由；mask优先 | 清除激活码草稿，恢复测试client状态；不保留凭证秘密 |
| V-03 | terminal client URL tests | client、server-config与transport adapter | canonical完整route、terminal policy、带path/query的prefix、两地址空间 | 激活/取消，切换当前selected service space，检查真实HTTP target | terminal policy仅为两个请求生成operation suffix；client不传groupWorkspaceKey且不读config；adapter每次用当前selected addresses[].baseUrl并保留path/query；身份只来自成功响应；切换后使用新prefix | 停止fixture server并确认关闭；清理临时请求记录 |
| V-04 | client actor tests + Expo Web | activation owner | 相同业务操作重放、配置变化、owner拒绝、响应丢失/迟到 | 并发提交与重放 | 同一operation复用凭证；配置/角色变化后的结果不误提交；拒绝和unknown不显成功 | 等待请求结束；销毁runtime和pending operation；不保留credentialSecret |
| V-05 | admin/activation tests | host与slave | active、cancel、失败、投影状态 | 查看状态、取消激活、切tab | selector反映真实状态；只有host能取消；tab不显示激活入口；失败保持可见 | 恢复激活/取消测试状态与角色资格；关闭临时client会话 |
| V-06 | server-config tests + panel | host config owner | addresses[].baseUrl唯一前缀；校验拒绝、effective更新、持久化失败、sync失败 | 编辑并分别执行save/clear/restore | 校验拒绝不dispatch且effective不变；内存生效后持久化失败仍显示新effective及未落盘；sync失败host保留当前值且branch not-ready；不默认回滚 | 恢复原config/default fixture；清除代理密码输入并核对DOM/log无秘密 |
| V-07 | both composition tests | 两app package defaults | 不同serverSpaces、非法声明、hydrated override | 启动与恢复配置 | 每app仅加载自身serverSpaces；restore回本app声明，合法hydrated override不被defaults覆盖 | 恢复两app package/default fixture原字节；关闭test runtime |
| V-08 | topology/config tests + adapter scenario | host/slave HTTP | 同步proxy明文、current selected address、实际HTTP代理 | 保存、同步并经adapter请求 | slave配置与host一致；password不入DOM/log；被批准请求实际使用同步配置 | 关闭两端runtime及HTTP fixture；删除同步fixture并检查日志脱敏 |
| V-09 | server-config owner/admin UI | paired branch/offline branch | 直接调用branch config write command | 尝试edit/save/clear/restore | owner拒绝且branch事实不变；branch UI没有有效编辑控件 | 恢复branch同步快照和owner状态；清除临时草稿 |
| V-10 | two integration tests | startup与迟到owner signals | hydration、credential、staff、config、projection阶段组合 | 启动、改变selector并投递迟到事件 | 阶段始终由最新owner事实决定；相同stage不清草稿；旧事件不越过资格门 | 恢复两个integration fixture；关闭订阅并销毁runtime |
| V-11 | staff owner/UI tests | host与slave | 有效/无效/恢复staff状态与主动logout | 登录、壁纸页logout、host logout同步 | host selector决定资格；MMP/LMP壁纸页logout派既有logoutCommand并回登录阶段；LMP exit不登出；slave无独立staff login/logout | 清除临时staff session；恢复用户fixture与UI状态 |
| V-12 | member registry + managed dual-device | single-runtime MASTER/SECONDARY与dual-process MASTER、SLAVE/VICE、LSP BRANCH | hostPending(operationId)、hostPendingProjection、branchPending并存；迟到投影与过期operationId | 并行登记；LMS确认/拒绝；LSP本地新增与确认 | 单机LMS同runtime直接决定MASTER hostPending；双机LMS读当前peer绑定的hostPendingProjection并带operationId显式target=peer回MASTER；过期ID拒绝；同步更新保留branchPending | 等待双方命令结束；清除此scenario新建会员/pending并读回基线 |
| V-13 | member UI + Web/VM | SAMPLE-04/05、单机/双机SAMPLE-06、SAMPLE-03-LSP | name/phone、可选age、过期operationId | confirm/reject与双机LMS peer round-trip | host owner只决定当前hostPending；branchPending不变；拒绝不写list；过期ID不消费新pending | 结束本scenario pending；恢复member registry基线，不清其他端pending |
| V-14 | wallpaper owner/UI | MMP、LMP、LMS、LSP | 四项选择、pending与confirmed差异、staff session有效/失效 | 确认/取消；LMP exit；MMP/LMP logout；切换LMS/LSP | LMS仅显示host confirmed；LSP本地值不受投影覆盖；MMP/LMP logout真实派staff logoutCommand；LMP exit不登出；LSP无logout入口 | 恢复两端wallpaper状态与staff session；移除临时资源 |
| V-15 | topology/UI actor + paired VM | slave业务screen/layer全集 | 每种面、输入焦点与弹层中的断链 | 断开当前peer | 业务全屏mask与规定文案出现；任何业务输入/command被阻断，本机admin launcher仍可用 | 释放断链注入与焦点；恢复pair和mask前owner快照 |
| V-16 | admin shell + two-device runner | LMS host secondary及LSP slave primary | peer offline、本机admin凭据 | 开层、认证、切tab、unpair/改host、关层 | local admin可操作；关层后业务仍mask；branch config/activation只读 | 关闭admin layer；仅经owner路径释放本run创建的pair；cleanup单独PASS |
| V-17 | state sync controller + paired VM | peer replacement/reconnect | 旧projection延迟、host logout/cancel离线 | 重连并送达旧peer snapshot | 旧peer投影不能解锁；stage按当前host事实与current peer身份路由 | 释放屏障及旧peer fixture；恢复host session和sync快照 |
| V-18 | topology/client tests + paired VM | 并发role state | active credential/socket/pairing/unpair flush失败 | 交错执行授权/取消/退配 | 未获准模式被拒；中间MASTER不解锁业务、不清credential | 等竞态结束；恢复credential/role/pairing/connection fixture，核对无隐藏持久状态 |
| V-19 | public surface/import tests | 所有新增feature action | 直接检查source owner、slice及selector通路 | 派发动作并审查import边界 | 每个动作经公开command、读取经selector；无component HTTP/getState/direct slice | 销毁probe runtime；删除只读结构fixture；不写production slice |
| V-20 | both integration suites + managed runner | 全部4种内容面/拓扑、两app；双机场景用两实例 | 相同场景ID与run manifests | 先Expo Web，再对相同清单运行VM；adapter场景单独在对应VM | Web先于VM且scenario/source对应；adapter、业务和cleanup结果分开，不将单元proof升级运行PASS | 按run manifest释放临时设备/tunnel/process/fixture；两侧cleanup分别PASS |

### 11a · 判据映射（逐条）

| 验收判据 | scenario | 执行档位 | 所在文件/未来落点 |
| --- | --- | --- | --- |
| V-01 face mapping/confirmation | V-01 | owner focused + Expo Web + VM adapter | integration assembly tests + terminal topology scenario |
| V-02 8-digit/no extra input | V-02 | focused + Expo Web + VM | terminal-activation package + both test-expo |
| V-03 generated suffix/prefix preservation | V-03 | focused + actual HTTP adapter fixture | terminal-data-client URL tests |
| V-04 activation race/rejection | V-04 | owner focused + Expo Web | terminalDataClientActor and activation UI tests |
| V-05 status/cancel | V-05 | focused + Expo Web + VM | terminal-data-client/admin-shell tests |
| V-06 config command readback | V-06 | owner focused + Expo Web | server-config and new panel tests |
| V-07 per-app defaults | V-07 | focused + Expo Web + VM | two composition tests |
| V-08 sync/proxy HTTP | V-08 | focused + managed two-instance VM adapter | topology sync and HTTP fixture |
| V-09 slave readonly | V-09 | focused + Expo Web + paired VM | config actor + admin section |
| V-10 lifecycle routing | V-10 | focused + Expo Web + VM | integration assembly tests |
| V-11 staff qualification | V-11 | focused + Expo Web + VM | staff-session and integration tests |
| V-12 concurrent pending | V-12 | owner focused + managed 2-device VM | registry test + topology runner |
| V-13 customer confirmation | V-13 | focused + Expo Web + appropriate VM | member-desk tests and same scenario runner |
| V-14 wallpaper isolation | V-14 | focused + Expo Web + VM | wallpaper-picker and two composition tests |
| V-15 disconnect mask | V-15 | actor focused + Expo Web + paired VM | topology and managed device scenario |
| V-16 local admin recovery | V-16 | focused + Expo Web + paired VM | admin-shell and run-dual-device |
| V-17 stale projection | V-17 | sync focused + paired VM | topology controller and device proof |
| V-18 role race/unpair failure | V-18 | owner focused + paired VM | topology/client actor tests |
| V-19 command/selector closure | V-19 | static + package focused tests | all changed publicSurface/invariant tests |
| V-20 four-topology parity | V-20 | aggregate Web then same-list VM | both test-expo, app pair runner |

No row is run evidence. Browser L2, DEV, reset/seed, UAT and deployment are outside current authorization.

## 12 · 未决项处置

| 项目 | 状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| member list上界 | 需求未定上限；现有owner整体保存/读取 | Detail无分页/人为cap；用PrimitiveList窗口化 | 不丢项、不做自动清理、不新增容量阈值；长期设备存储限制留作sample规模边界 |
| slave config/proxy | 已裁定read-only与明文同步 | server-config owner落实 | 不换owner或隐去同步字段 |
| hifi | Dexter接受线框方向，hifi不要求 | 以当前低保真逐屏review | 不用hifi延迟设计 |
| Browser L2 | 不适用且未授权 | N/A | 不造空分母 |
| 动态UI/VM证据 | 未运行 | 后续另获实施/运行授权后按TR-16 | 当前不执行 |

## 13 · 停机条件与节奏

当前只授权文档，不执行任何CP实现或动态步骤。将来若需新增后台权限/operation、变更凭证或代理owner、改变8位码/URL/serverSpaces/副机只读、引入第三种业务事实owner，属于批准方案实质漂移，须提交Dexter。普通静态不确定项写OPEN由独立设计review处理。

实施节奏：每个完整CP的全部改动与focused proof完成后，fresh reviewer按需求/详设与IA/记忆规范三维对账；OPEN修复并复核同一CP后才下个CP。全CP完成后另做全批6b，之后进入整体验收。CP对账不产生整批GO。

## 13c · 逐代码与详设对账

实施计划显式安排交付前置：fresh独立审查者逐个核对详设§9a每个文件/符号及全部实际修改，确认代码与详设逐条匹配、每个生产新增符号有唯一调用者/外部入口、每个生成物有producer/consumer、owner/sync权限与UI/testId执行证据一致。结论仅MATCHED/OPEN。任一OPEN须由主agent修复并重查，不得将实施交付给Dexter/Claude。此门与实施测试前的CP/全批6b三维对账不同。

## 14 · 交付前自查

| 检查 | 判据 |
| --- | --- |
| §3机制行 | 模板行完整；N/A有反例与理由；全集已枚举 |
| §3a | 26 screens控件/ID已列；browser L2 BLOCKED/N/A理由，不冒充PASS |
| owner链 | credential、config/proxy、topology、staff/member/wallpaper唯一owner |
| 集合 | member Detail整集合，无人为上限；24只为视窗挂载数 |
| IA/interaction | 26个screen id、文案、入口、surface、layout逐字核对 |
| 生成/同步 | 无手改生成物；canonical和sync事实均有传递/消费 |
| seed | N/A范围准确，实施前以源码检索再核 |
| 判据 | V-01..V-20每条都有场景、执行面与未来落点 |
| 证据 | 本轮只读；全部动态未运行 |
