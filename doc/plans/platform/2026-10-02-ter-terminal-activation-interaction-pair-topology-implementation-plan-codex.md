# 终端激活交互与双机拓扑优化专项 · 实施计划

## 0 · 目标、状态与授权

DESIGN_REF=doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md
JOURNEY=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md
IA=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md
INTERACTION=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md
IMPLEMENTATION_AUTHORITY=false
AUTHORIZED=本轮仅详设、计划、Journey、IA、交互与测试方案；源码、生成、构建、测试、verify、DEV、reset/seed、L2、UAT、部署均未授权
ALL_DYNAMIC_STATUS=NOT_RUN
REVIEW_CYCLE_ID=TER-ACTIVATION-INTERACTION-PAIR-TOPOLOGY-DESIGN-2026-10-02

计划仅供后续实施派工，不能被解释为当前运行授权。

## 1 · 实施纪律

实施如另获授权，先重开原始需求、适用详设、IA、screen线框、memory六维命中原文、该CP owning source与可复用源码；每个实际变更点写入前后都逐条回读同一组输入并做同根盘点与focused proof。全部代码、测试、脚本、文档由主agent写；独立子agent只做read-only阶段对账和最终对抗review。不得动批次外Android app功能，除本批serverSpaces接线、测试/testId所必需的具名文件。

每个完整CP完成全部修改、focused proof和修复后，fresh reviewer做该CP三维对账，结果MATCHED方可进入下一CP。全部CP之后做单独全批6b，MATCHED后才开始整体验收。动态期间保留首败、日志、当前bytes、business与cleanup；failureCategory第二次出现冻结该类后续运行，先根因修复并用同focused proof关到零复发，再继续，不换场景或盲重跑。

## 2 · RECALL 与预检

每CP开工前必须重新读：
- 原始正式需求的本CP R条款及V条款；
- design §4的CP三列、§7同步事实、§9a文件全链、§11a场景；
- Journey与该CP对应screen的IA/interaction；
- project-memory/index.md全部kernel、deterministic-context-only和本CP六维查询命中的全部原文；
- AGENTS.md、terminal-coding-standard.md TR-16/TR-17/§4-D/§4-E、frontend capability lookup、foundation-charter；
- 当前CP列出的每个owner文件及直接测试、包index/README/invariants、实际package graph。

第三方依赖/API/默认行为若进入实施，以当前lock解析版本重查官方文档/源码；没有任何依赖specific行为时记录N/A理由。不得凭记忆或相似API猜。

## 3 · CP-01 package defaults 与owner/sync闭包

### 步骤1：核实app配置声明和owner defaults形状

- 现成能力：server-config/src/types/serverConfig.ts、validateServerConfigDefaults.ts、createServerConfigModule.ts；app packageJson读取先例为两Android platformPorts.ts及integration terminalSurfaces.ts。
- 如何验证：对两个integration和两个Android package分别构造不同serverSpaces fixture；默认空间选择、非法配置拒绝、有效hydrated override不被defaults覆盖均能在owner/composition focused tests观察。
- 无现成时实现形态：在每个app自己的package.json声明需求定义的serverSpaces闭集；composition读取并传入server-config defaults；配置owner验证；不合并app配置、不让kernel读UI package、不把service defaults写进hydrated state。
- 具体触及输入全集：sample-console/package.json、sample-wallpaper-console/package.json、sample-terminal/package.json、sample-wallpaper-terminal/package.json；其两个integration assembly及两个Android platformPorts.ts。

### 步骤2：确认proxy明文持久/同步与config public commands

- 现成能力：server-config commands/selectors、state persistence intent、topology stateSyncSlices/createTopologyStateSyncController。
- 如何验证：server-config owner test保存后readback；state-sync focused从host发送到branch后两边effective config等价；测试输出/可视树不含password明文。
- 无现成时实现形态：只调整server-config owner声明中的该字段保护/同步属性以及既有slice注册；branch只消费projection，不建立proxy secret store，不由client绕过selector直读persistence。
- 重开具体源：serverConfig.ts、serverConfigActor.ts、selectServerConfiguration.ts、stateSyncSlices.ts、两composition assembly。

### 步骤3：拓扑projection readiness最小闭包

- 现成能力：topology selectTopologyFacts、createTopologyStateSyncController按声明传full snapshot/revision；现有pair session identity。
- 如何验证：同步成功时读到当前peer的required slices与revision；断连、apply失败、换peer后，旧revision/current peer混配不会成为ready。
- 无现成时实现形态：在既有topology-owned同步状态中记录当前连接身份已应用的具名所需业务slice/revision，输出一个selector给stage/actor；不加事件总线、常态轮询或多源ready cache。
- 同根检索：两个integration的stateSyncSlices声明、topology apply/revision/connection close路径、现有测试夹具。把具体required slice全集列入CP实现记录并锁定后才通过。

### CP-01 退出

focused defaults/projection测试通过；package类型/文档/invariant同步完成；CP-01三维对账MATCHED。

## 4 · CP-02 终端激活UI和status tab

### 步骤1：激活screen与四面路由输入

- 现成能力：client activateTerminalCommand、selectActivationState、config selector、definePartPair/useUiStateSelector/useDispatchCommand、InputScrollArea/PrimitiveInput/PrimitiveButton、owner API生成链。
- 如何验证：前导零8字符作为string保持；UI仅含激活码字段；未激活时四面展示各自表单/引导；显式派 `needToActivateTerminalCommand` 且已激活时四面仅显示“设备已激活成功”，无继续按钮、无计时，并由integration按最新owner selector路由；断链mask优先；异步期间切换配置/角色不得把旧target结果提交。
- 无现成时实现形态：按正式需求R-03新增`apps/terminal/ui/base/terminal-activation`，按`ui/base/admin-shell`的moduleName/dependencies/public-export/parts布局公开四面Screen parts、admin status section与`needToActivateTerminalCommand`。两个integration负责组合parts并消费该UI意图做阶段路由；已激活提示不是停留页，成功状态出现后integration即依当前selector把control交给业务包，不额外渲染返回/继续动作，不设定时器。激活结果只经client command/selector。不得套用`createFeatureAssemblyModule`（其契约只接受`ui.feature.*`），不复制client状态、凭证或后台请求。
- 同根核对：client actor/command/selectors/generated API，server config view，两个composition及现有terminal coding/ui package scaffold。

### 步骤1a：canonical route 到 terminal request suffix

- 现成能力：`contracts/openapi-source`、edge catalog、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`、`scripts/generate/terminal-client-api.mjs`及`contracts/policy/terminal-client-generation.json`。
- 如何验证：按当前生成入口产物可重现；只为activate/cancel两个terminal operation生成去掉canonical group-workspaces前缀的operation suffix；其它consumer route不变。URL fixture逐字节断言baseUrl path、suffix、query和编码参数，断言client command/actor没有server-config selector/state访问。
- 无现成时实现形态：canonical仍保留完整route；terminal生成policy显式选中这两个operation并只影响terminal consumer生成片；不得手改generated文件或改变后台operation。激活command输入仅含8位activationCode及由client owner生成的操作身份；取消command不接收groupWorkspaceKey、URL或prefix。generated代码负责operation suffix及path/query参数编码；client只序列化operation参数。composition注入server-config公开provider到transport network adapter；adapter每次请求按当前selected service space选择地址并把suffix追加到`addresses[].baseUrl`。client不读server-config、不解析URL、不重建集团编码。凭证中的groupWorkspaceKey、terminalRef、storeRef与generation仅取验证成功响应。
- 当前服务空间若不接纳已保存凭证，展示owner拒绝并保留凭证；不静默切回旧服务空间。

### 步骤2：cancel公开名与admin status screen

- 现成能力：terminal-data-client现有cancelTerminalOnlineCommand和actor；selectors selectActivationState/selectConnectionState/selectConnectionLatency；admin-shell public adminShellAssembly、AdminSectionComponent、AdminLauncher。取消请求使用当前选中的服务空间配置；切换空间后按新地址请求，服务器拒绝则保留当前凭证并展示稳定原因。
- 如何验证：通过status screen cancel后selector依次显示cancelling与terminal状态；slave direct command拒绝且不改变凭证；tab中不存在activate action；切换服务空间后真实HTTP fixture观察取消请求抵达新地址，拒绝不清凭证。
- 无现成时实现形态：按需求公开拼写导出cancelTerminaActivationCommand并同步package index、README、invariants、所有consumer与测试；owner内部可以继续复用既有终止流程。
- 不在组件解读TDS business reason；仅显示client owner映射后的稳定错误。

### CP-02 focused/静态proof

端面matrix ACT-01..04; response loss/并发/配置变化由client owner focused；screen展示错误状态由UI tests。确认generated API的canonical→materialize→edge-codegen→client链未手改产物。

## 5 · CP-03 admin layer 与server-config-panel

### 步骤1：admin open/close全内容面本地化

- 现成能力：AdminLauncher当前96逻辑像素、5次、1800ms手势；AdminLayerFrame管理认证/focus和close lifecycle；openLayerCommand/closeLayerCommand。
- 如何验证：在本机LMS secondary及slave LSP primary离线时打开、认证、关闭；peer日志不出现admin open/close command；close后业务仍mask。
- 无现成时实现形态：沿用既有手势，只移除host-primary-only handler条件；AdminLauncher及AdminLayerFrame open/close显式使用local target；不新增可见icon/button、不改手势次数/区域。
- 具体源：AdminLauncher.tsx、AdminLayerFrame.tsx、admin-shell tests/index/README/invariants。

### 步骤2：config编辑与readonly section

- 现成能力：server-config四个commands与selectServerConfiguration；adminShellAssembly section API；PrimitiveInput/Radio/Button和InputScrollArea。
- 如何验证：host可执行select/set/clear/restore并与owner selector逐字段相同；每个地址只有一个`baseUrl`输入且它是完整URL前缀；branch所有实际写操作与直接command均拒绝；代理密码不出DOM/log；最多4个addressName/baseUrl/timeoutMs条目。
- 保存结果分层：validation拒绝不得派发/effective不变并保留草稿；内存effective已更新但持久化失败时，仍展示新effective并明确“未持久化”，不默认回滚；同步失败时host维持权威effective，branch旧projection不标为当前且维持not-ready。clear/restore/set/select均按相同区分进行selector readback。
- 无现成时实现形态：按正式需求R-03新增`apps/terminal/ui/base/server-config-panel`作为可复用呈现包；section以`AdminSectionComponent`公开类型装入既有`adminShellAssembly`，只调用server-config公开command/selector。参考`apps/terminal/ui/base/admin-shell/src/types/adminSection.ts`的section契约；不新增config state/capability或第二份秘密，仅把代理密码作为secure输入提交给owner。
- 目录及局部组件按sample-staff-auth与wallpaper-picker单机型目录先例；不用AdminSection内部非public export冒充能力。

### 步骤3：本地激活状态与拓扑tab

- 现成能力：client selectors和cancel command；topology selectors/commands；admin section selection与local layer。
- 如何验证：host显示当前credential/connection/latency facts且可cancel；branch两个tab只读；断链情况下topology tab仍可操作本机unpair/change-host命令。
- 无现成时实现形态：小型admin section组件和真实testIds，command由既有owner实现；不复制状态到admin slice。

### CP-03 focused/静态proof

admin-shell单测覆盖主primary、同runtime secondary、slave primary的open/close local target；config actor/panel测试覆盖正常/拒绝/validation/storage失败；与CP-01 proxy sync一同核对日志脱敏。

## 6 · CP-04 branch mask 与current readiness

### 步骤1：业务Stage gate与全业务mask

- 现成能力：SurfaceRoot/LayerStack、workspace placement commands、topology selector/sync apply；已有integration runtime module subscribeState。
- 如何验证：对ACT/AUTH/member list/form/customer confirmation/wallpaper和当前已打开business layer分别断链；每种触摸/键盘/按钮都不能派业务command；MASK-01固定提示出现。
- 无现成时实现形态：在TER integration placement最高业务层覆盖mask并锁焦点，复用LayerStack/现有focus scopes；每个业务owner actor在async提交点复核授权，mask之外不可绕过；admin layer压在mask上仍能点。
- 不把owner业务screen状态转换成mask自有的第二份状态。

### 步骤2：current peer同步ready与迟到event

- 现成能力：当前topology session/peer accepted与state sync revision；resolveTopologyCommandTarget提供明确peer/local路线。
- 如何验证：两个app实例接受peer后但projection未apply时仍block；前一个peer迟到full-state不能满足新identity；当前session断连后ready立刻失效。
- 无现成时实现形态：用topology owner的current connection id + registered required sync revisions创建单一readiness selector；仅在所有本批明确需要的slice由当前peer apply之后ready。不新增ready轮询/泛化框架。
- required slice全集按composition逐项列出：ui-state placement、staff qualification、member confirmed list、当前peer绑定的hostPendingProjection（含operationId，仅双机LMS需要）、wallpaper host confirmed（仅适用面）；config projection另供admin只读/HTTP；terminal credential永远不列。投影apply只更新members与hostPendingProjection，必须保留slave branchPending。单机LMS(MASTER+SECONDARY)从同一runtime读取hostPending并本地调用owner；双机LMS由SLAVE+VICE承载，只消费当前peer身份的投影，确认/拒绝携带operationId并显式target=peer回MASTER owner。

### 步骤3：local admin topology recovery

- 现成能力：AdminSection topology commands，topology unpair/pair flow，resolveTopologyCommandTarget。
- 如何验证：断链仍可本地打开/关层，取消配对/换host只在current owner结果完整后更新mask；中间MASTER、flush失败、旧projection均继续mask。
- 无现成时实现形态：复用已有unpair→pair命令顺序，不建switch-host协议；写前复读role/pair facts。

### CP-04 proof

focused topology controller/actor tests对disconnect、current identity replacement、迟到full snapshot；Expo Web覆盖普通mask交互；两真实实例VM证明adapter断连与本机恢复。

## 7 · CP-05 staff/member/wallpaper业务隔离

### 步骤1：会员集合和两端pending

- 现成能力：sample-member-registry owner commands/selectors与member-desk local operations；PrimitiveList实现窗口化mounted item。host member owner区分权威`hostPending`与slave的本地`branchPending`；单机LMS的MASTER+SECONDARY共享runtime，双机LMS实际由SLAVE+VICE进程承载。
- 如何验证：>24条member可定位到末尾，列表项挂载不超过24；单机LMS直接通过本地MASTER owner确认hostPending；双机SLAVE+VICE LMS读取含operationId的当前peer `hostPendingProjection`，确认/拒绝显式发回MASTER；同一时刻创建branchPending后更新host投影，branchPending保持原值；旧peer/过期operationId拒绝；丢响应后host列表只增加一个记录。
- 无现成时实现形态：owner state分别持有host confirmed list、hostPending及branch-local pending；现有sync声明投影members与hostPendingProjection，apply时保留branchPending；不复制第二份可写host事实。双机LMS携带stable operationId并显式target=peer，请MASTER owner复核当前pending；LSP提交使用既有稳定操作身份，重连先查host list/identity，不盲重发。
- 保留Detail完整聚合且不设上限，不加分页、自动删除或全局journal。

### 步骤2：员工资格projection

- 现成能力：sample-staff-session login/logout和selectStaffSession、topology sync。
- 如何验证：host logout后slave业务route回login引导；slave直接dispatch staff login/logout被拒；同步中断维持MASK。
- 无现成时实现形态：只声明需求批准的非秘密资格显示字段；password从不存branch/sync。

### 步骤3：wallpaper LMP/LMS/LSP

- 现成能力：sample-wallpaper owner、wallpaperCatalogData.json四项、wallpaper-picker现有platform components与PrimitiveRadio/Image；`apps/terminal/kernel/feature/sample-staff-session`公开的既有`logoutCommand`供MMP/LMP壁纸页复用。
- 如何验证：host confirmed变更刷新LMS，slave本地值在host修改/LMS-LSP切换/断线重连后保持；cancel/exit不改confirmed；MMP和LMP有独立店员登出动作并派既有logoutCommand，selector确认登出后由integration回登录阶段；LMP的退出选择只离开picker；LSP无登出入口。
- 无现成时实现形态：新增LSP独立screen component与具名commands；共用catalog与leaf display component，不用角色条件伪造LMP页面。

### CP-05 proof

domain focused tests优先证所有op identity和owner边界；Expo Web场景复用scripts/test/ter-admin-display-web.mjs现有业务功能，按业务域增加明确场景；device/machine-specific同场景用既有managed topology runner。缺少真实case时只增对应owner的case，不扩为通用registry。

## 8 · CP-06 integration阶段路由与composition闭环

### 步骤1：唯一stage actor与双assembly消费

- 现成能力：integration createIntegrationAssembly、runtime module subscribeState、现有sample-wallpaper stage actors与sample-staff auth/member features。
- 如何验证：hydration与initialize完成、配置/credential/staff/projection变化后路由到精确screen；连续相同stage的RTT、PONG更新不清pending表单；旧login-restored event不能越过gate。
- 无现成时实现形态：每个integration拥有简洁stage actor消费owners selectors并发出既有placement commands；不新增stage Redux slice或route framework。
- 依据 formal R-10 优先级：初始化/修复→当前配对/投影ready→cancelling→activation→staff→feature；按当前owner事实持续判定。

### 步骤2：同步依赖、导出与invariant

- 现成能力：各workspace package README/index/dependencies/terminal-invariants/skeleton graph与publicSurface tests。
- 如何验证：每个新增public symbol有唯一consumer；依赖图无环；generated files有producer并通过既有check；每面only指定features。
- 无现成时实现形态：跟随各owner包当前文件布局/public export格式，目录名描述能力，不用Journey编号。
- 逐CP检查所有 package manifests、index、README、test、invariant及两个composition。

### CP-06 proof

两composition scenario tests与publicSurface/static dependency tests；复制同一webscenario set到两app test-expo，之后按TR-16执行VM同scenario。

## 9 · 全CP之后的验收与交付前置

### 9.1 CP与全批对账

每CP所有修改和focused tests完成后fresh独立reviewer针对完整CP做需求/详设IA/记忆规范三维对账，OPEN修后同CP复核；全部CP结束做全批6b，MATCHED后才进以下总体动态步骤。

### 9.2 动态步骤

1. 本专项当前没有测试运行授权。未来实施授权后先检查资源、设备身份、run manifest、日志和cleanup；确保没有同一时间并发受管运行。
2. 跑相关package的focused tests与静态type/test；修已知故障后才做场景级验收。
3. 所有不依赖adapter行为先在两个integration Expo Web跑获批场景；完整记录scene id、source hash、设备/浏览器状态、业务断言和cleanup。
4. Web通过后，以同一scenario ids先验四拓扑VM：MMP mobile host、LMP laptop primary host、LMS laptop secondary host、LSP独立slave primary；双机用两台不同身份VM，分场景连续使用，不要求四台同时启动。
5. adapter专项（供电/设备角色、双屏display surface、本地持久化、实际HTTP/代理/TDS连接）按场景在对应VM直接证明并单独报告，不能用Web test或focused mock冒充。
6. V-01..V-20逐行记business结果；per-run fixture/process/session/tunnel cleanup独立PASS，cleanup非PASS不可收口。本批不包含r5 seed、reset或L2。

### 9.3 当前验证禁区

不以README脚本存在推导授权。此次无任何UI、VM、Playwright、ADB、DEV、reset或seed动态执行；计划不构成授权。

### 9.4 失败族

保留首败与受管日志；同一failureCategory第二次出现冻结该失败族后面的场景，回到日志、owning source修根因，以同一个focused proof清到零复发再继续。代码未改不重跑；持有运行时不改受测源码。不延长timeout、不换场景绕开。

## 10 · 未决项与不适用

- member list没有产品总量上限，owner采用Detail整体聚合；这是当前sample事实和风险边界，不人为设限。若实现阶段有具体设备容量证据，提出最小产品问题，不自行加上限/清理。
- browser L2为N/A；UI future validation按Expo Web+VM TR-16。
- 高保真视觉review非必需；现有低保真有26个screen线框（含共享admin导航壳）和accepted direction。
- 不新增seed、不改数据库schema、不新增后台operation；实施前检索若发现相反事实须重新更新设计并受评审。

## 11 · 交付条件

实施阶段交付前顺序：全部CP三维MATCHED→全批6b MATCHED→适用完整动态场景与cleanup均PASS→逐代码与详设对账MATCHED→fresh独立REVIEW_TARGET=IMPLEMENTATION review。若有任何未执行场景，逐条列NOT_RUN；不能写整批PASS。此次设计交付不触发以上实施门。

## 12 · 逐代码与详设对账（计划必备）

实施计划第11节包含显式交付步骤：fresh独立审查者对详设§9a全部文件清单和实现的全部差异逐代码核查；不是抽样。检查每个新增生产方法/类型都有唯一调用者或具名外部入口、每个生成物有production generator、UI/testId命中真实节点、owner事实与projection身份符合本详设。结论只有MATCHED/OPEN。OPEN必须修复并fresh复核，未全部MATCHED不得交Dexter/Claude做实施后review。

## 13 · 当前状态自证

CP-01..06=DESIGN_ONLY；focused=NOT_RUN；Expo Web=NOT_RUN；VM/dual-device=NOT_RUN；managed cleanup=NOT_RUN；Browser L2=N/A_WITH_REASON；DEV/reset/seed/UAT/deploy=N/A_NOT_AUTHORIZED。详设与计划须一同接受独立REVIEW_TARGET=DESIGN。
