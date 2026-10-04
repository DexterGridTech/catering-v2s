# 终端激活交互与双机拓扑优化专项 · 实施计划

## 0 · 目标、状态与授权

DESIGN_REF=doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md
JOURNEY=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md
IA=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md
INTERACTION=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md
IMPLEMENTATION_AUTHORITY=true
AUTHORIZED=Dexter于2026-10-03当前会话授权最小文档修正、批次全范围实施、生成/构建/测试/verify、受管DEV、Expo Web和VM/adapter动态验收；排除Browser L2、reset/seed、UAT、生产部署、生产HA与范围外功能
ALL_DYNAMIC_STATUS=IN_PROGRESS
REVIEW_CYCLE_ID=TER-ACTIVATION-INTERACTION-PAIR-TOPOLOGY-DESIGN-2026-10-02

本计划按当前Dexter授权执行；详设与计划中的动态步骤不扩展其边界。DEV start/restart不隐式seed。

## 1 · 实施纪律

本次实施先重开原始需求、适用详设、IA、screen线框、memory六维命中原文、该CP owning source与可复用源码；每个实际变更点写入前后都逐条回读同一组输入并做同根盘点与focused proof。全部代码、测试、脚本、文档由主agent写；独立子agent只做read-only阶段对账和最终对抗review。不得动批次外Android app功能，除本批serverSpaces接线、测试/testId所必需的具名文件。

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
- 如何验证：server-config owner focused tests 用独立 defaults fixture 观察默认选择、非法声明启动拒绝、合法 hydration 覆盖保留；并用畸形持久值证明无效 selectedSpace 回默认、无效 service override 与代理秘密形状被丢弃、有效 override 保留，脱敏 hydration log 记录 reset/drop 计数。两个 integration composition tests 各自观察省略参数时读取本包 package.json defaults、传入异值 fixture 时只暴露该 fixture 的空间集合。两个 Android `platformPorts.ts` 必须逐字传入各自 application package.json 的 `serverSpaces`，并通过各自 typecheck；获准的 application VM 场景再分别读取两个实际 application 的有效 server config，确认没有采用 integration defaults。不得把一条通用 owner test 冒充四个入口的运行证明。
- 无现成时实现形态：在两个integration与两个Android application入口各自package.json声明本入口serverSpaces；composition读取并传入server-config defaults，入口配置不互相合并。主机继续从不可变package defaults读取默认值；既有server-config同步记录携带主机defaults、selectedSpace、overrides与代理密码，副机将主机defaults保存在`syncedHostDefaults`只读投影字段并以plain persistence缓存，不将它解释成副机package defaults或第二个可写配置owner。
- 具体触及输入全集：sample-console/package.json、sample-wallpaper-console/package.json、sample-terminal/package.json、sample-wallpaper-terminal/package.json；其两个integration assembly及两个Android platformPorts.ts。

### 步骤2：确认proxy明文持久/同步与config public commands

- 现成能力：server-config commands/selectors、state persistence intent、topology stateSyncSlices/createTopologyStateSyncController。
- 如何验证：server-config owner test保存后readback；state-sync focused从host发送到branch后两边effective config等价；测试输出/可视树不含password明文。
- 无现成时实现形态：只调整server-config owner声明中的该字段保护/同步属性以及既有slice注册；branch只消费projection，不建立proxy secret store，不由client绕过selector直读persistence。
- 重开具体源：serverConfig.ts、serverConfigActor.ts、selectServerConfiguration.ts、stateSyncSlices.ts、两composition assembly。

### 步骤3：拓扑projection readiness最小闭包

- 现成能力：topology selectTopologyFacts、createTopologyStateSyncController按声明传full snapshot/revision；现有pair session identity。
- 如何验证：同步成功时读到当前peer的required slices与revision；断连、apply失败、换peer后，旧revision/current peer混配不会成为ready。
- 无现成时实现形态：topology owner 的瞬态 state 记录 `peerStateSyncConnectionId` 与按 sliceName 索引的 `peerAppliedStateSyncRevisions`，由 `selectTopologyRequiredProjectionsReady(state, requiredSliceNames)` 判定；controller仅在当前已接纳连接的完整快照成功 apply 后提交该连接/slice/revision。新连接、断连和 peer 替换清空记录，迟到旧连接帧忽略。该 selector 的必需 slice 清单由 CP-04 composition 提供，不另建轮询或第二 ready cache。
- 同根检索：两个integration的stateSyncSlices声明、topology apply/revision/connection close路径、现有测试夹具。把具体required slice全集列入CP实现记录并锁定后才通过。

### CP-01 退出

server-config owner defaults/projection 与 hydrated invalid-state focused tests 通过；两个 integration composition tests 通过；两个 Android wrapper 分别传入各自 package.json 的 `serverSpaces` 并通过 typecheck；四入口 README、package/invariant graph 同步完成；CP-01 三维对账 MATCHED。Android application 的实际运行期有效配置仍由 V-07 的受管 VM 场景核验，不以本阶段 typecheck 冒充。

## 4 · CP-02 终端激活UI和status tab

### 步骤1：激活screen与四面路由输入

- 现成能力：client activateTerminalCommand、selectActivationState、config selector、definePartPair/useUiStateSelector/useDispatchCommand、InputScrollArea/PrimitiveInput/PrimitiveButton、owner API生成链。
- 如何验证：前导零8字符作为string保持；UI仅含激活码字段；未激活时四面展示各自表单/引导；显式派 `needToActivateTerminalCommand` 且已激活时四面仅显示“设备已激活成功”，无继续按钮、无计时，并由integration按最新owner selector路由；断链mask优先；异步期间切换配置/角色不得把旧target结果提交。
- 无现成时实现形态：按正式需求R-03新增`apps/terminal/ui/base/terminal-activation`，按`ui/base/admin-shell`的moduleName/dependencies/public-export/parts布局公开四面Screen parts、admin status section与`needToActivateTerminalCommand`。两个integration负责组合parts并消费该UI意图做阶段路由；已激活提示不是停留页，成功状态出现后integration即依当前selector把control交给业务包，不额外渲染返回/继续动作，不设定时器。激活结果只经client command/selector。不得套用`createFeatureAssemblyModule`（其契约只接受`ui.feature.*`），不复制client状态、凭证或后台请求。
- 同根核对：client actor/command/selectors/generated API，server config view，两个composition及现有terminal coding/ui package scaffold。

### 步骤1a：canonical route 到 terminal request suffix

- 现成能力：`contracts/openapi-source`、edge catalog、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`、`scripts/generate/terminal-client-api.mjs`及`contracts/policy/terminal-client-generation.json`。
- 如何验证：按当前生成入口产物可重现；只为activate/cancel两个terminal operation生成去掉canonical group-workspaces前缀的operation suffix；其它consumer route不变。URL fixture逐字节断言baseUrl path、suffix、query和编码参数，断言client command/actor没有server-config selector/state访问。
- 无现成时实现形态：canonical仍保留完整route；terminal生成policy显式选中这两个operation并只影响terminal consumer生成片；不得手改generated文件或改变后台operation。激活command输入仅含8位activationCode及由client owner生成的操作身份；取消command不接收groupWorkspaceKey、terminalRef、URL或prefix；client从自身credential读取terminalRef填入generated path parameter。generated代码负责operation suffix及path/query参数编码；client只序列化operation参数。composition注入server-config公开provider到transport network adapter；adapter每次请求按当前selected service space选择地址并把suffix追加到`addresses[].baseUrl`。client不读server-config、不解析URL、不重建集团编码。凭证中的groupWorkspaceKey、terminalRef、storeRef与generation仅取验证成功响应。
- 当前服务空间若不接纳已保存凭证，展示owner拒绝并保留凭证；不静默切回旧服务空间。

### 步骤2：cancel公开名与admin status screen

- 现成能力：terminal-data-client现有cancelTerminalOnlineCommand和actor；selectors selectActivationState/selectConnectionState/selectConnectionLatency；topology的selectTopologyRequiredProjectionsReady按当前peer与apply revision判定；admin-shell public adminShellAssembly、AdminSectionComponent、AdminLauncher。取消请求使用当前选中的服务空间配置；切换空间后按新地址请求，服务器拒绝则保留当前凭证并展示稳定原因。
- 如何验证：通过status screen cancel后selector依次显示cancelling与terminal状态；slave direct command拒绝且不改变凭证；tab中不存在activate action；切换服务空间后真实HTTP fixture观察取消请求抵达新地址，拒绝不清凭证；匹配当前peer的持久缓存断链时标记“上次主机状态（待同步）”，另一peer的缓存或无缓存时显示“主机状态待同步”，均不显示“未激活”或授权业务。
- 无现成时实现形态：按需求公开拼写导出cancelTerminaActivationCommand并同步package index、README、invariants、所有consumer与测试；在terminal-data-client增加仅含激活展示摘要、连接展示摘要、最新RTT和sourceNodeId的`terminal-data-client.status-projection`切片，以plain owner persistence保存host摘要并按`master-to-slave`同步；原credential/pending client slice继续isolated。由client actor从已有selectors刷新安全投影，两个composition显式纳入state sync；SLAVE仅显示sourceNodeId匹配当前peer的缓存，当前peer revision已apply时标记为当前，否则显示“上次主机状态（待同步）”；无同host缓存时显示“主机状态待同步”。此缓存只用于状态显示，不授予业务资格。投影不含凭证秘密、deviceId、activationCode、pending或RTT历史。
- 不在组件解读TDS business reason；仅显示client owner映射后的稳定错误。

### CP-02 focused/静态proof

端面matrix ACT-01..04；response loss/并发/配置变化由client owner focused；status projection测试证明credential/pending slice不可同步、safe summary可持久/同步、只消费匹配当前peer身份的缓存并在未ready时标旧，不回退inactive；以持久化SLAVE状态恢复且故意残留本地credential，运行client initialize并断言无HTTP/WS，ACT引导不得将该隔离本地凭证显示为成功；SLAVE激活、取消、离线取消、connect命令拒绝，不清credential且不触网。disconnect是本地teardown例外：允许清本机连接/transport资源，但不得开始连接、发HTTP或更改credential及host status projection。screen展示错误状态由UI tests。确认generated API的canonical→materialize→edge-codegen→client链未手改产物。

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

- 现成能力：当前topology session/peer accepted与state sync revision；`selectStateSyncSlices`只接受composition显式传入的owner `stateSlices`；resolveTopologyCommandTarget提供明确peer/local路线。CP-04实际接入的owner slices为staff qualification、member confirmed list及（壁纸sample）host confirmed wallpaper。
- 如何验证：两个app实例接受peer后但projection未apply时仍block；前一个peer迟到full-state不能满足新identity；当前session断连后ready立刻失效。
- 无现成时实现形态：用topology owner的current connection id + registered required sync revisions创建单一readiness selector；每个integration在`stateSyncSlices`中传入owner真实声明，并以current peer applied revision解锁。不新增ready轮询/泛化框架。staff投影只传status/operatorName且不覆盖SLAVE本机会话；member投影只传confirmed members且保留branchPending；壁纸投影只更新SLAVE的hostConfirmedWallpaperId且保留本地wallpaperId/pending。
- required slice全集按composition逐项列出：两个app均含ui-state MAIN placement与staff qualification；sample-console另含member registry slice；sample-wallpaper-console另含host-confirmed wallpaper slice。CP-05把含`operationId`的`hostPendingProjection`放入既有member registry slice，因此承载LMS的required set继续使用已登记的`memberSliceName`，不新增第二个slice名称或readiness项；需由owner focused proof验证同一slice的投影值与`branchPending`隔离，再由composition proof确认该slice仍在当前peer required set。config projection另供admin只读/HTTP；TDC status projection仅用于ADMIN-01显示，current peer apply后标当前，未ready但sourceNodeId匹配时标为上次缓存，peer不匹配或无缓存时显示等待；terminal credential slice永远不列。单机LMS(MASTER+SECONDARY)从同一runtime读取hostPending并本地调用owner；双机LMS由SLAVE+VICE承载，只消费当前peer身份的投影，确认/拒绝携带operationId并显式target=peer回MASTER owner。

### 步骤3：local admin topology recovery

- 现成能力：AdminSection topology commands，topology unpair/pair flow，resolveTopologyCommandTarget。
- 如何验证：断链仍可本地打开/关层，取消配对/换host只在current owner结果完整后更新mask；中间MASTER、flush失败、旧projection均继续mask。
- 无现成时实现形态：复用已有unpair→pair命令顺序，不建switch-host协议；写前复读role/pair facts。

### CP-04 proof

focused topology controller/actor tests对disconnect、current identity replacement、迟到full snapshot；Expo Web覆盖普通mask交互；两真实实例VM证明adapter断连与本机恢复。

当前执行记录：LayerStack focused test证明标准业务层 < business interlock < 本机admin层、interlock时业务层不进入accessibility tree、focus boundary保持suspended且admin层可见；两个integration composition tests分别证明 MASTER 不mask、SLAVE在当前peer/连接/required slice revision未ready时mask、全部所需slice apply后解除。受影响render/admin-shell/integration-assembly及两个integration的test/lint/typecheck均已运行通过；另运行staff-auth、member-desk、wallpaper-picker包测试与lint/typecheck，结果均通过。member-desk首跑因四个已启动runtime的`finally`同步调用`releaseRuntimeForTest`触发`ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC`；根因为transport module按runtime契约注册异步cleanup，已改用现有`releaseRuntimeForTestAsync`，同一包测试复验通过。真实Expo Web、VM及adapter场景仍未运行，不能由上述focused证据替代。

CP-04投影闭包修正记录：两composition此前漏把staff session（及壁纸composition的wallpaper owner）传给`selectStateSyncSlices`；staff slice原为isolated、wallpaper slice原为isolated；member slice原样发送完整state会把branch pending带上。现staff仅发送`{status,operatorName}`到`hostQualification`，SLAVE本机会话保留；member只发送confirmed members并保留SLAVE pending；wallpaper只把MASTER confirmed值写入SLAVE的`hostConfirmedWallpaperId`，不覆盖本地confirmed/pending。CP-04 fresh reviewer `/root/cp04_reconciliation_r2` 已按当时CP-04范围完成需求/详设与项目记忆三维复核并返回`STEP_RECONCILIATION=MATCHED`，只读报告见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp04-reconciliation-codex.md`。CP-05新增host pending projection仍落在既有member registry slice中；required set不增加slice身份，只需以当前peer的member-slice revision证明该投影已应用。

当前字节复验：member-registry `1 file/10 tests PASS`；staff-session `1/8 PASS`；wallpaper owner `2/10 PASS`；sample-console `9/61 PASS`；sample-wallpaper-console `5/29 PASS`。以上owner/composition包typecheck均exit 0，lint均`0 errors/0 warnings`。member-registry首次断言把`SyncValueEnvelope`误写为裸value，发生同一focused failure family；对照state sync封套源码后改为断言`entry.value.value`，同一focused suite现通过。首败保留在CP-04 intake。

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

domain focused tests优先证所有operation identity和owner边界；Expo Web场景复用`scripts/test/ter-admin-display-web.mjs`现有受管能力；设备专属拓扑证据可用`scripts/test/ter-virtual-keyboard-android.mjs`的受管VM、resource-id UI操作和日志采集动作，双机接线及状态转换使用已有`tools/terminal-topology/run-dual-device.mjs`具名能力。CP-06按设计实现`scripts/test/ter-terminal-interaction-android.mjs`，但仅作本专项有限场景的薄编排入口：调用现有受管Android action，按§9.2顺序检查屏幕、显式提交和业务结果、收集简明前后端证据；不新增通用scenario registry、UI框架、第二套设备/清理管理或产品debug接口。旧双机拓扑runner只证明其实际记录的拓扑断言，不替代本专项UI业务oracle。

CP-05 focused 当前字节结果：`@catering-v2s/kernel-feature-sample-member-registry` 为1文件/13 tests PASS，typecheck与lint PASS；`@catering-v2s/ui-feature-sample-member-desk` 为2文件/36 tests PASS，typecheck与lint PASS；`@catering-v2s/ui-feature-sample-staff-auth` 为2文件/14 tests PASS，typecheck与lint PASS；`@catering-v2s/ui-feature-sample-wallpaper-picker` 为3文件/20 tests PASS，typecheck与lint PASS；wallpaper integration 为5文件/30 tests PASS，typecheck与lint PASS。member-desk路径覆盖SLAVE+CHIEF分支列表/本机草稿/同屏确认及host owner提交；staff-auth覆盖slave只读资格引导与禁止本机登录；壁纸feature覆盖LSP独立页面、退出与MMP/LMP既有logoutCommand。当前重跑原始命令、退出码、完整输出、源码指纹与范围边界见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp05-focused-proof-codex.md`及相邻`.log`；byte fingerprint为`89866d9fca4564c4a0be0e24fd40f89dba431be8f3f0163afe31ac4fd0785768`。上述为包级focused proof，不是Expo Web、VM或V-01～V-20运行证明。`hostPendingProjection`通过member registry既有slice同步，composition现有peer required slice名称不变；CP-05 fresh阶段三维对账MATCHED见`doc/review/platform/2026-10-03-ter-terminal-activation-pair-topology-cp05-reconciliation-codex.md`。

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

两composition scenario tests与publicSurface/static dependency tests。Web runner 的共享机械目录是 `scripts/test/ter-admin-display-web-contract.mjs::WEB_SCENARIOS`；可执行分母是 `scripts/test/ter-admin-display-web.test.mjs` 中完整的 integration/surface/failureOwner 准入矩阵。两个 `test-expo/App.tsx` 分别装配本 integration 的真实 assembly，按准入矩阵运行各自适用行；不得把所有通用 runner 场景复制到不承载该功能的另一 integration。该目录和矩阵只证明现有 Expo Web runner 的屏幕/键盘/平台端口场景，不冒充 V-01～V-20 业务验收。业务场景分母仍是详设 §11a 的 V-01～V-20；逐项使用同一 V-ID、业务断言和 cleanup，在适用 integration 的 Expo Web 先运行，再在对应 VM/application 拓扑运行；涉及 adapter 的行仅在对应 VM 单独证明。Web runner 准入矩阵用 `node --test scripts/test/ter-admin-display-web.test.mjs` 验证，包含runtime输出目录符号链接逃逸红例；业务 V 场景结果按全批 §11a 单独登记。

## 9 · 全CP之后的验收与交付前置

### 9.1 CP与全批对账

每CP所有修改和focused tests完成后fresh独立reviewer针对完整CP做需求/详设IA/记忆规范三维对账，OPEN修后同CP复核；全部CP结束做全批6b，MATCHED后才进以下总体动态步骤。

### 9.2 动态步骤

#### 分类与强制执行顺序

本批业务场景分为两类；`A-*` 是同一业务断言可由 Expo Web 与终端 application 各自验证的场景，`B-*` 依赖终端 adapter、实际多实例链路或真实设备能力，只在对应终端拓扑验证。`F-*` 仅指 focused/static proof，不替代 A/B 动态场景。一个 V 判据可拆为多个子场景，但每个子场景只归一个类别，不能用 F 结果填 A/B。

1. 先冻结当前源码、fixture、scenario catalog 与 manifest 输入摘要；受管资源预检通过后执行 F 类 prerequisite。此阶段不得启动 Expo Web、VM/application 或业务场景。
2. **Web 阶段只执行全部 A 场景**：按 A-ID 顺序先跑 `sample-console` 与 `sample-wallpaper-console` 各自承载的全部适用场景；每个场景业务与 cleanup 分开 PASS，且所有 A-Web 场景关闭前不得启动任何终端 application/VM 场景。Web 侧激活使用当前 DEV 已有、仍有效且未作废的 seed fixture；`term-front`、`term-handheld`、`term-kds`、`term-preparing` 均属于 seed 空间 `aurora`，四份 sample package 的 DEV business `addresses[].baseUrl` 必须使用 `/api/terminal/group-workspaces/aurora`，运行时主机/端口来自受管 DEV manifest。DEV将`V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS`默认设为`http://127.0.0.1:8093`；Web runner在启动浏览器前须确认manifest含有与本次端口精确匹配的loopback origin。自定义端口只在DEV启动前显式配置并重启后使用。manifest/log仅记录fixture key，不记录激活码。不得reset或重新seed。
3. **终端阶段随后执行全部 A 与 B**：先以相同 A-ID、相同 fixture key/业务 oracle 在对应终端 application 重放 A；随后执行全部 B。MMP mobile host、LMP laptop primary host、LMS laptop secondary host、LSP 独立 slave primary 四种拓扑均需覆盖其适用场景；双机使用两个设备身份不同的真实受管 VM。两面 test-expo 均已通过对应 A 场景后，才能开始此阶段。
4. adapter 场景直接在适用 VM 验证。A-Web 不证明供电、显示器角色/双屏 surface、Android 持久化或终端代理栈；B 与 focused proof 也不得替代对应 A-Web/A-terminal 业务场景。
5. 同一时间只运行一个受管场景。每次运行前检查 manifest 所有权、PID/start token、远端 host/boot id/start ticks、DEV 与 tunnel 身份、预算、日志路径和残留资源；每次记录 source hash、scene ID、integration/surface/topology、fixture key、业务断言和 cleanup。激活及取消激活场景同时保存脱敏前端 actor/HTTP method/operation/status/传输结果与响应 `X-Request-Id`/`X-Correlation-Id`，并从同一时间窗采集后端 `REQUEST_COMPLETED` 的 operation、owner、status、typed error、DB 操作数及相同请求标识；以后端响应头返回的标识作为权威关联键，按 requestId+correlationId 逐请求关联，不要求出站请求头本地值与后端生成值相同。另从三个当前受管 TDS 节点读取运行窗口及结束后 2 秒日志刷新宽限内的安全字段；A-02 至少观察到同节点同 `connectionId` 的 `tds_ws_accepted` 和 `tds_session_registered`。V-05 前端日志另须记录已匹配的 PONG sequence/RTT，并与 selector 暴露的实测样本相符；初始 `0` sentinel 不能充当 RTT 样本。只记录安全字段和 fixture key，不记录请求体、激活码或凭证；临时原始远端日志复制件在解析后删除。cleanup 非 PASS 不进入下一场景。当前 DEV seed 可供激活测试使用；本计划不含 reset/seed。

#### Android application 执行路线

Android 只在全部 A-Web 完成后开始；每个 A-ID 在 Android 复用同一 fixture key、同一业务 oracle，再运行其适用 B-ID。执行次序固定为「运行前状态确认 → 单一用户路径 → 业务结果读回 → 服务端日志核对 → cleanup/保留结果登记」。以同一 app、设备身份和受管 run 连续完成可串接的场景，避免每个点击单独重建 APK 或运行环境；不同 application package、拓扑或必须隔离的反例才分 run。不得为省时跳过状态读回或把 UI 出现等同后端业务成功。

1. **运行前只读准入。** 每个设备/app 先 `diagnose-business-screen` 读取当前逻辑屏、App window、有限 resource-id/控件类摘要与已知屏幕控件计数，再用 `inspect` 核对目标 selector；随后读取 application credential selector、server-config effective selector、DEV manifest 地址及服务端 terminal binding 当前状态。若本地 selector 为 active，先经现有 admin launcher 与认证打开 `terminal.activation.admin.status`，调用 `verify-terminal-binding-identity` 在内存中对照 UI terminalRef/workspace 与指定 owner fixture；manifest 只保存匹配布尔值、binding 状态/代次和 fixture key，不保存任何身份原值。诊断只保存安全 resource-id、类计数和 `uiTextCaptured=false`，不保存节点文本或 content description；屏幕等待失败时 manifest 保留最近一次控件摘要、缺失控件和 broken boundary，禁止只记 timeout 后盲目重试。若设备已在 staff/workspace 页或服务端 binding 已 active，该 fixture 标为 `ALREADY_ACTIVE`，不重复输码；需要新的 activation proof 时选一个当前未绑定且类型匹配的既有 seed fixture，且确认 App 本地身份与该 fixture 一致。不得假定 `cleanup` 会清理 app persistence、凭证或后端 binding，不运行 reset/seed。当前已知 `term-front` 在 `ter-android-priority-20261003-05` 中激活成功且取消未被证明，先列为 `ALREADY_ACTIVE/DO_NOT_REUSE_FOR_ACTIVATION`；`term-handheld` 仅在本步骤读回未绑定后才可作为 mobile fixture。
2. **激活路径必须显式提交。** `activation-fixture-input` 负责边界输入、前导零/长度读回、键盘“回车”及提交按钮可用性，不代表已发送激活请求。紧接着必须以 `tap terminal.activation.submit` 点击真实激活控件，再用 `wait-business-screen staff-login` 等待 owner 路由后的 staff login screen；成功 oracle 同时要求 staff login 可见、前端 activation command 成功、后端同 request/correlation id 的 `activateTerminal` 为 200/SUCCEEDED。若当前不在 activation screen、键盘未收起、submit 不可用或目的 screen 未出现，立刻保留首败和对应 UI/前后端日志，停止该场景，不继续输入登录信息。
3. **登录与后续业务在同一活跃会话执行。** 只在 staff-login screen 已断言后输入已批准 fixture 的 operator/password；每个输入动作先完成虚拟键盘，再读回字段；密码不得写入 stdout、manifest 或日志。两个字段完成后才 `tap sample.auth.login:submit`，并用 `wait-business-screen` 等待目标 workspace screen；不得把输入完成当登录成功。逐个业务页面按 V-ID 操作，先断言页面与控件，再派发真实 command，最后以 selector/UI 读回业务结果。键盘输入使用 runner 的批量输入动作和最终字段读回；禁止为每个按键重复抓完整 UI 树。wallpaper/logout、会员确认及管理页状态属于各自 A-ID 的业务结果，不因激活已经成功而省略。
4. **fixture 与持久状态按租约管理。** 一份 fixture 在同一时刻只分配给一个设备/app。成功激活后，继续在该已激活会话完成状态、连接/PONG、登录、该 sample 适用业务及最后的正常取消激活；取消后必须分别读回服务端 binding 已结束与本地 credential 已清除，才把 fixture 标记 `RELEASED`。若取消未完成，fixture 保持 `ACTIVE/QUARANTINED`，转用另一个经只读核实可用的既有 fixture，不能清数据或假定可重试激活。拒绝场景单独使用 `term-disabled`，预期无绑定写入。
5. **按拓扑顺序合并场景。** 先跑 mobile MMP 与 single-display laptop MASTER/LMP 中可串接的 A 场景；再跑 single-runtime dual-display 的 MASTER/SECONDARY 场景（LMS 是该 host runtime 的 secondary surface）；最后启动两台不同设备身份的 paired VM，分别验证 host 的 LMS 投影与 slave/VICE 上的 LSP 本地页面。pair 建立后连续验证 V-08/V-09/V-12/V-13b/V-14c/V-15/V-16/V-17/V-18，需断链的场景按“触发→读回业务遮罩与本机 admin→恢复连接→核对 owner readback”完成后才进入下一个。V-01 的真实供电/显示器变化单独列 adapter run，不混入普通页面路径。任何拓扑或 sample 不承载某场景时，记 `NOT_APPLICABLE_WITH_REASON`，不得用另一拓扑代替。
6. **Android 业务路径用薄编排入口驱动。** CP-06 的 `ter-terminal-interaction-android.mjs` 只把本计划有限场景按run manifest驱动成有序步骤，并复用 `scripts/test/ter-virtual-keyboard-android.mjs` 的 run-bound `inspect`、`tap`、`activation-fixture-input`、`business-input`、`assert-business-screen`、`assert-business-text`、`wait-business-screen`、`assert-business-member-readback`、`mark-terminal-evidence-start` 与 `capture-terminal-business-logs`。它不重做ADB/UI解析/设备身份/日志/cleanup，不增加通用scenario registry；点击提交前键盘未收起或目标控件不可用时必须fail closed。当前入口无法表达的业务断言先补到本专项已有的明确 UI resource/action 与测试，不以坐标盲点、人工口述或 `bridge-dev-tunnels` 代替业务证明。每个场景日志引用同一设备manifest/run ID，并记录 `V-ID/A-ID/B-ID`、期望动作、业务结果与cleanup；场景映射只用计划中的有限表。
7. **脚本化前后端取证与结束。** 每个需要核对激活/取消/连接的有限场景，在动作开始前调用 `mark-terminal-evidence-start --run-id <RUN> --device dual|mobile`；结束时调用 `capture-terminal-business-logs --run-id <RUN> --device dual|mobile --app sample-terminal|sample-wallpaper-terminal --expectation activation-success|activation-cancelled|heartbeat-pong`，不手填时间戳。若要确认 seed fixture 的数据库事实，调用同一 runner 的只读 `read-terminal-binding --run-id <RUN> --device dual|mobile --fixture-key <固定fixture> --group-workspace-key <DEV服务空间> --expected-binding-status UNBOUND|ACTIVE|ENDED`；它复用 `readManagedTerminalBindingByName`，只输出终端状态、绑定状态和代次，不接受任意 SQL、不写数据库、不输出终端引用或服务空间值。runner 用当前设备 serial/bootId 记录日志窗口，验证同一 DEV run manifest 与已拥有的 tunnel 映射，复用受管远端日志采集器读取业务后端及三个 TDS 节点；TDS 身份从控制面 `remoteTdsNodes[].nodeId` 读取，readiness 投影里的 `remoteIdentity.nodeId` 只用于启动就绪对账，两个对象不可互换。按 Android 请求中的 requestId/correlationId 与后端 completion 核对，TDS 只作简明会话登记读回。每种 expectation 都要求对应客户端业务事件；HTTP 操作还必须有匹配的后端 completion，激活与连接还必须观察到匹配 TDS 会话登记。缺失预期日志或关联一律 FAIL，不得把零事件作为采集成功。Manifest 记录不保留原始文本的安全计数：总行数、已解析 `ReactNativeJS` 行数、当前 app PID 行数、其他 PID 行数、无法解析的目标 tag 行数、结构化 envelope 与已知事件候选；日志读失败同时记录 `lastKnownGood` 与精确的 `brokenBoundary`，区分客户端日志投影、业务后端日志、请求关联、TDS 日志和 TDS 投影。epoch 时间戳解析兼容小数秒精度变化，并同时按设备 epoch 时间和结构化事件时间校窗。每次捕获以递增序号单独落盘，避免后一次覆盖前一次。业务日志落盘仅为 allowlist 投影，原始临时日志在 `finally` 删除；采集失败、请求不匹配或原始日志无法清除均记录为 FAIL/`LOG_NOT_AVAILABLE`。店员名如由 `operator-name` owner 持久状态预填，仅在与固定测试账号完全相同时记录 `USE_REMEMBERED_MATCH` 并复用；不一致必须 fail closed，口令仍由键盘动作输入且不写入日志。业务断言、以 `run-manifest.json` 为索引的 `V-ID/A-ID/B-ID → businessChecks/命令日志` 对照表，以及设备/tunnel/runner cleanup 分开记录；fixture 的 active 持久业务结果单独列出，不冒充 cleanup 失败或 PASS。

Web runner 的 screen-placement 诊断以结构化 `startup.complete` 后观察到的最新 placement 为准；可信 owner 的 `runtime.reset.completed` 是一次应用内状态重置边界，会清除边界前的 placement 观察，之后新一代的 placement 仍照常检查。重置过渡期间短暂的 `container-empty` 不单独判失败；业务场景仍须通过其显式页面/owner 断言证明重置后的目标状态。

#### V-01～V-20 场景分类、执行与清理矩阵

Android fixture 只读准入可省略 `read-terminal-binding` 的 `--expected-binding-status` 以安全输出当前终端/绑定状态和代次；该模式是 `OBSERVED`，不判业务 PASS。指定期望状态时，runner 先把安全的 expected/observed 状态、代次及 `matched` 写入本 run manifest，再对不匹配项记 `SERVER_TERMINAL_BINDING_READBACK` 首败并退出非零；终端引用、激活码、密码与原始 SQL 不进入输出。只有 observed 为 `UNBOUND` 且 terminal status 与 fixture contract 一致的 fixture 才能用于新激活场景。

| 判据 | 子场景类别 | 夹具与触发 | 业务断言 / 执行面 | 清理 |
| --- | --- | --- | --- | --- |
| V-01 四面与供电确认 | B-01a | 在 mobile、single-display、dual-display VM 分别构造 MMP/LMP/LMS/LSP；触发真实供电与显示器角色变化 | VM/application：确认前内容面与设备角色不变；确认后仅更新适用 instance 事实；LMS 始终读取 MASTER 投影。当前 Expo host 只能构造单 runtime MASTER/SECONDARY，不能证明 LSP 或真实供电/显示器确认，故不设 Web A 场景 | 恢复面/角色/供电夹具，关闭 runtime；VM 恢复显示器与电源状态 |
| V-02 激活输入/环境 | A-02 | 以适用的已 seed、有效 terminal fixture 打开激活页，输入 8 位码（另用输入夹具检查前导零/长度）并提交 | Web 与终端同断言：只允许 8 位输入且保留前导零；页面仅提交需求字段；服务空间名称/生效配置正确；真实 business HTTP 成功；integration 按激活 owner selector 立即接管登录路由，激活成功文案由 focused assembly test 断言，不要求在本页停留 | 取消本场景新建的 terminal binding；恢复输入和 config fixture；核实未输出激活码 |
| V-03 URL 消费 | A-03a、B-03b、F-03c | A：真实 package `serverSpaces` 的 `aurora` business prefix + generated activation/cancel suffix；B：终端 application 实际经当前 HAProxy/TDS 地址执行；F：带编码斜杠、保留 path/query、多个 serverSpace 的 HTTP adapter 边界 | A：Web 与终端的真实请求使用 DEV manifest 地址和完整 `/api/terminal/group-workspaces/aurora` 前缀；B：终端 HTTP/TDS adapter 读取当前 server-config provider；F：RFC URL 编码与 prefix/query 规则由 focused adapter fixture 证明，不冒充 Web business 场景 | 删除本场景 binding；清理 HTTP fixture；VM 释放本 run 连接/tunnel |
| V-04 激活失败/竞态 | A-04a、F-04b | A：`term-disabled` seed fixture 在两个 Expo integration 的 laptop 入口真实提交激活；F：缺设备能力、并发/响应倒序、config 或 role 在请求期间变化 | A：HTTP 409 + `STORE_TERMINAL_DISABLED` 与页面“终端已停用”一致；仍留激活页、不进入staff登录、没有凭证提交；后端`REQUEST_COMPLETED`须为`outcome=FAILED`、status=409、typed error=`STORE_TERMINAL_DISABLED`，并与该请求ID唯一关联。F：actor 测试断言同次操作秘密复用、参数冲突拒绝及旧响应不覆盖新状态 | 禁用终端夹具不应产生绑定；若响应意外成功，runner 经现有后台取消入口清理该 binding，失败则cleanup=FAIL |
| V-05 激活管理 | A-05a、B-05b、B-05c | A：host 激活后读取状态、连接、延迟并取消；B-05b：LMS/LSP 副机只读尝试；B-05c：终端 successor-runtime reset adapter | A：Web 与终端均验证真实 server-config/TDS 链、active/connected，以及至少一条已匹配 PONG 的 RTT（无样本时不得将初始 `0` sentinel 显示成实测延时）；取消 HTTP outcome 为 `CANCELLED` 或 `ALREADY_CANCELLED`，身份清除并回到激活页。激活页是取消结果反馈，结果 toast 不作为 reset 后判据。Web 只证明业务取消与应用内状态清理；`appControl.resetRuntime` 的 successor-runtime observation 不在 Expo Web 支持面，记录 `NOT_APPLICABLE_IN_EXPO_WEB`，由 B-05c 在 VM 验证。B-05b：slave 无激活/取消入口且 owner command 被拒；双机 VM。B-05c：真实 appControl adapter 受理 reset、观察后继 runtime 启动并确认凭证已清除 | 等待取消与 disconnect 收敛；确认 binding、credential 与 tracked session 清理；VM 记录 reset request 与 successor observation；撤销只读拒绝夹具 |
| V-06 配置管理 | A-06a、B-06b | A：`terminal-server-config` 在两 integration 的 laptop/mobile 页面经公开 command 改 TDS timeout、保存、清除、恢复默认并提交无效 timeout；B：VM 重启 application 后读持久化状态 | A：effective selector 从 10000→10001→10000，timeout=0 被拒且有效值不变，再恢复 package 默认；前端command日志含 save/clear/restore，草稿不冒充生效值。B：实际终端存储重启 readback；写盘与同步故障继续由owner focused proof覆盖 | runtime销毁前恢复默认并读回；清除代理密码输入与本run config override；VM还原原配置 |
| V-07 内置声明 | A-07a、B-07b、F-07c | A：`terminal-server-config` 读取两 Expo Web 入口实际 effective selected space、business/TDS package addresses；B：application 冷启动读取打包 defaults；F：hydration、恢复默认、无效声明 | A：每个sample的selected space为development，business route和两个TDS入口均与该 integration 自身package声明一致；B：真实打包入口配置生效。F：合法override保留、非法/未知服务被拒绝并读回正确默认 | 恢复所选空间与持久 config；关闭入口runtime；F清除probe state |
| V-08 配置同步/HTTP | B-08 | 两台不同身份终端建立 host/slave，主机修改含明文代理密码的配置，副机发业务 HTTP command | 双机 VM：主配置投影到当前 peer，持久化后仍可恢复；副机业务 command 用同步配置请求正确 endpoint，且不建立 TDS business path | 取消pair，仅由owner释放投影/持久配置；恢复主机配置；确认两个实例独立退出 |
| V-09 副机管理只读 | B-09 | 两台不同身份设备上覆盖 host active/inactive、peer在线/断链；检查 LMS/LSP 的配置与激活管理页面并尝试公开 command | paired VM/application：副机不提供可执行配置修改、激活或取消入口；直接派发 command 时 owner 拒绝，host事实与 branch-local pending 不变。当前 Expo host 不支持构造 SLAVE+VICE，不能产生 Web A 证据 | 恢复只读状态夹具；还原pair/connection并核对 config readback |
| V-10 integration 路由 | A-10a、F-10b | A：两 integration 的 Expo Web 与终端按真实 activation→staff login→workspace 路径运行；F：对 hydration、credential、staff、config、projection selector 变化及迟到事件逐项注入 | A：正常业务路由由当前 owner selector 决定，Web 与 terminal application 对同一场景的可见路由一致。F：阶段优先级、同阶段草稿保留、迟到事件不能越过资格门；注入 selector/event 只记 focused，不填 A/B | 恢复 selectors 与草稿，关闭订阅并销毁两个 integration runtime |
| V-11 sample 登录/登出 | A-11a、B-11b | A：MMP/LMP host 登录并在壁纸页登出；B：slave host资格变化与LSP页面 | A：两sample host均能登出，logout command 清资格并按integration路由；退出选择不冒充logout。B：LSP无staff login/logout，host资格失效后跟随owner selector退出 | 清除本run staff session；恢复sample用户fixture与页面状态 |
| V-12 两端会员并发 | B-12 | 两台不同设备独立提交会员；LMS查看peer投影；并行pending、迟到确认、重复回包 | 双机VM：两端待确认不覆盖；LMS带operationId确认/拒绝并回MASTER；过期ID不处理新录入；同一列表仅一次添加。Web/focused不得冒充跨设备 PASS | 未完成pending撤销、运行时/peer投影清理；成功确认的owner-persisted会员是本场景业务结果，按run标识登记为retained business outcome；不得绕过owner清存储 |
| V-13 顾客确认 | A-13a、B-13b | A：MMP/LMP单机或双屏真实确认；Web输入name/phone与可选age=37并提交真实confirm command；B：LSP本页与双机LMS→MASTER peer roundtrip | A：Web/终端观察同一顾客身份与电话、年龄输入、confirm command的owner-selector结果；前端日志须可读且不含该command拒绝。当前`useDispatchCommand`只有拒绝事件，没有成功完成事件，不能虚构success log。UI不展示已登记年龄，因此精确age持久值由既有member-registry focused owner proof核对，拒绝分支不写列表也由owner focused proof覆盖，不能将UI或姓名/电话冒充年龄值断言。B：LSP在本页确认；LMS确认/拒绝按当前hostPendingProjection回MASTER，过期operationId不消费新项 | 本场景确认成功后新增的会员是需求验证的持久业务结果；sample-member-registry没有删除已确认会员的owner command，测试不得直接清本地存储或伪造删除。使用run-scoped合成姓名/电话并在manifest只记录value key，不记录值；结束时撤销未完成pending、关闭运行时并恢复peer投影，已确认的合成会员按预期保留并单独登记为retained business outcome |
| V-14 独立壁纸 | A-14a、A-14b、B-14c | A-14a：壁纸 Web场景选择、确认并登出；A-14b：仅 laptop 的 `terminal-wallpaper-exit` 在选中 pending 后退出；B：真实 LMS host 投影与 LSP 本地壁纸并发改变 | A-14a：读取确认后的选中项并观察登出回 staff login；A-14b：主页背景标签仍等于原 confirmed 壁纸，未确认 pending 被取消；mobile 没有独立 exit 按钮，不运行或声称覆盖 exit。B：LMS只显示host confirmed，LSP本地状态不被投影覆盖 | 恢复两端壁纸和staff状态，移除临时选择 |
| V-15 全业务断链 | B-15 | 两台不同身份设备建立真实 pair 后断开 peer/TDS；逐屏尝试激活、登录、会员/确认、壁纸输入与业务 command，同时保持本机 admin 可用 | paired VM/application：所有业务 surface 被遮罩且输入不穿透、owner command 无业务写入；admin仍可打开；重连前不恢复业务。Expo host 的本地 connection fixture 不能构造 pair interlock，故不列 Web A | 重新建立 peer/TDS，核实遮罩退出且没有误提交；按 manifest 释放运行资源 |
| V-16 本地admin恢复 | B-16 | 双机 LMS/LSP 实际断链时，本机打开/认证/退配或换 host/关闭 admin | paired VM/application：管理员只读 tab 正常可用，关闭 admin 不解除业务遮罩；副机仍只读，owner 状态按当前资格恢复 | 关闭 admin layer；仅经 owner command 释放本 run pair；读回业务遮罩与 owner state |
| V-17 重连/换主机 | B-17 | 双机VM更换peer/host，先送accepted再释放旧projection屏障；主机离线期间登出/取消 | 旧peer projection不能解锁；current peer/host身份与最新owner决定路由；不因迟到消息误登录或误取消 | 释放屏障、旧peer fixture；恢复host credential/staff及sync state |
| V-18 角色与恢复中间态 | B-18、F-18 | 双机VM交错activation/TDS/pair命令；F注入 unpair flush失败及中间MASTER | B：未批准角色操作被拒。F：中间MASTER、flush失败均不解锁业务、不清凭证；F不替代终端适用路径 | 等待命令终结，按owner恢复credential/role/pairing，核实无隐藏持久状态 |
| V-19 命令与读取全集 | F-19 | 检查所有变更surface/import边界并派发公开command读取selector | 每个动作经公开command，每项业务读取经selector；无component HTTP、direct slice/getState/callback通路；静态/focused结果不写成Web/VM业务PASS | 销毁probe runtime；不写生产slice，清除只读结构fixture |
| V-20 四拓扑交付 | A-20a、B-20b | A：汇总全部A-ID在两Web integration的场景回执；B：同一A-ID在四种VM拓扑回执及所有B-ID | 每个适用V判据均映射fixture、integration/surface/topology、run ID、source hash、业务oracle；`scripts/test/ter-admin-display-web-stage.mjs <11-run-ids>` 输出A-Web聚合manifest PASS后才可启动终端A/B；不可适用项逐项说明；cleanup独立统计 | 所有Web、设备、tunnel、runtime与临时fixture按各自manifest释放；DEV仅按授权保留，明确标记非测试临时资源 |

#### Expo Web A-ID 精确执行分母

以下映射是业务场景分母；`WEB_SCENARIOS` 只是 runner 的参数名闭集，不能替代这些 A-ID。每个 run manifest 的 `businessAssertionIds` 必须与右列逐字一致；同一 ID 只在表中列出的 integration/surface 运行，不能为凑“两 app 全覆盖”重复运行不承载该业务面的 app。

| A-ID | Web scenario | integration / surface | 真实夹具与覆盖边界 |
| --- | --- | --- | --- |
| A-02、A-03a、A-05a、A-10a、A-11a | `terminal-activation-connection` | `sample-console` × laptop/mobile；`sample-wallpaper-console` × laptop/mobile | 各入口的启用 seed terminal、manifest 注入的 business/TDS loopback tunnel、真实激活/登录/登出/状态/PONG/取消；A-03a 仅证明 package 默认prefix与generated后缀，编码保留字符和自定义path/query归F-03c。 |
| A-04a | `terminal-activation-owner-rejection` | 两 integration × laptop | `term-disabled` 真实 DEV seed fixture；409/`STORE_TERMINAL_DISABLED`、页面拒绝、route留在激活页、后端同request身份关联；无绑定写入。若 Chromium 输出 HTTP 409 控制台错误，仅当唯一 activation POST 409 响应、明确拒绝断言和后端同请求关联均通过，且控制台安全分类时间距该响应不超过 1 秒时允许该单条错误；其他错误仍失败。响应若意外成功，先用正常管理取消清理并记录cleanup。 |
| A-06a、A-07a | `terminal-server-config` | 两 integration × laptop/mobile | UI经公开command修改TDS timeout、effective selector readback、clear、invalid拒绝不改变有效值、restore默认；从各自package.json读取development serverSpaces声明，核对business与两个具名TDS入口。受管manifest覆盖的三个地址须在selector中按business/TDS身份映射到当前DEV loopback tunnel；TDS两入口名称、顺序、端口和10000ms逐项相符。runner与stage两层都必须证明每run恰有一次`server-config.set-server-override`预期拒绝，其他A-Web run的command拒绝数为零；该拒绝须由场景内日志切片、用户可见拒绝及effective selector不变共同证明。Web不把注入tunnel URL称为package.json原始默认URL。写盘跨进程恢复只由B-06b覆盖。 |
| A-13a | `terminal-activation-connection` | `sample-console` × laptop/mobile | 两面提交会员后，在顾客确认页输入可选年龄37并通过真实confirm command；pending姓名/电话与确认后的列表行读回。最终frontend log必须成功读取且无`command-dispatch-rejected`；UI列表owner-selector回读证明确认成功。当前列表UI不显示年龄，精确age状态由CP-05 member-registry focused proof断言；Web结果不得声称观察到age持久值。`useDispatchCommand`当前仅对拒绝记录命令诊断，不存在成功完成事件，因此不把不存在的`command-dispatch-completed`当作判据。LMS/LSP及peer回送只属于B-13b。 |
| A-14a | `terminal-activation-connection` | `sample-wallpaper-console` × laptop/mobile | 本机选择/确认，读取radio confirmed marker并走店员登出；不声称跨实例隔离。 |
| A-14b | `terminal-wallpaper-exit` | `sample-wallpaper-console` × laptop | 选择未确认项后点真实exit control，回主页并核对accessible current-wallpaper仍是原confirmed值；移动端没有exit入口，因此不安排mobile run。 |
| A-20a | `node scripts/test/ter-admin-display-web-stage.mjs <11-run-ids>` | 上述全部适用行 | CLI读取显式列出的Web run manifest，核实11个唯一scenario/integration/surface行完整、每行expected A-ID由runner真实断言逐项记录、business/cleanup/sourceStable均PASS且source hash与当前Web source相同；产出带sourceFiles与runIds的`.runtime/ter-admin-display/web-a-*.json`。仅此manifest PASS后开始终端A/B。 |

#### 结束判据

Web 阶段完成条件：按上表对每个 A-ID 明确的 integration/surface 执行完整场景；每个场景 manifest 列 `businessAssertionIds`，与 `WEB_TERMINAL_BUSINESS_ASSERTION_IDS` 中该 run 的预期集合逐字一致，且相同受管 DEV run/manifest 身份、业务与 cleanup、frontend log/readiness均PASS；激活场景另须同请求前后端日志关联及真实PONG/RTT selector样本PASS。汇总器核对11个manifest的目录runId与manifest runId一致，所有行绑定同一DEV manifest SHA和当前Web source SHA。缺失、额外或重名 A-ID 都是失败。任何 A-Web 失败按 §9.4 根因修复并用同一场景关闭后才继续 Web 阶段，不启动终端 A/B。发生server-config有效值变更后，无论业务成功或失败，都先在该隔离runtime通过公开restore command恢复默认并读回；恢复失败则cleanup=FAIL。终端阶段按相同 A-ID、相同 fixture key 与业务 oracle 在适用application/VM重放，全部 B-ID 在对应 topology/adapter 通过；V-01～V-20每行逐项写当前字节结论，业务和cleanup分列。只有两阶段均达到条件且适用清理PASS后才进入§11逐代码交付对账及整批review。本专项授权不含Browser L2、reset/seed、UAT或生产部署。

静态执行入口盘点：`scripts/test/ter-admin-display-android.mjs` 只证明管理页显示事实；`scripts/test/ter-virtual-keyboard-android.mjs` 现已提供本计划 Android 顺序所需的 run-bound VM、build/install/launch、设备身份、ADB tunnel、resource-id 操作、业务字段/屏幕读回和日志采集动作。采用单个受管入口的顺序 CLI 动作，不另建通用业务 scenario runner；`bridge-dev-tunnels` 只负责从 DEV manifest 接线，不是业务场景 PASS。若某个 V-ID 所需的具名 UI action 或业务 oracle 确实缺失，先对该单项补最小受限 action 与红例，再纳入本专项动作序列；不得先造一套编排/注册框架。

### 9.3 当前验证禁区

本节描述计划顺序，不是运行证据。执行以当前授权与受管入口为准；本次明确排除Browser L2、reset/seed、UAT和部署。DEV已有seed可复用于激活场景，不得清除或重新生成。所有尚未生成真实manifest/日志的场景在§13与最终报告中保持`NOT_RUN`。

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

设计复评NO-GO历史字节边界保留；按本轮授权完成指定最小修订后直接进入实施，不重开已关闭DESIGN cycle。

| 范围                                     | 当前状态                                         | 当前字节证据                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CP-01                                    | `MATCHED`                                        | CP-01 fresh 阶段级独立三维对账 `STEP_RECONCILIATION=MATCHED`，0 finding；reviewer 检查当前需求/详设/IA、四入口defaults接线、README、owner invalid-hydration test、raw logs与哈希。详见 `doc/review/platform/2026-10-03-ter-terminal-activation-pair-topology-cp01-finding-intake-codex.md`。Expo Web、Android VM、DEV、adapter 与 V-01～V-20 尚未由 CP-01 证明。                                                                 |
| CP-02                                    | `MATCHED`                                        | Fresh阶段级独立三维对账由`/root/cp02_reconciliation_r2`完成，`CP02_RECONCILIATION=MATCHED`；终端完整静态门`node tools/terminal-skeleton/verify-static.mjs`以run ID `ter-local-static-21377-1790970009305`退出码0并报告`TERMINAL_STATIC=PASS`。Expo Web、VM/device、adapter、DEV、V-01～V-20仍未由本CP证明。详见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp02-finding-intake-codex.md`。 |
| CP-03                                    | `MATCHED`                                        | Fresh独立阶段级三维对账`STEP_RECONCILIATION=MATCHED`；S-CP03-1确认并修复四个server-config公开命令的SLAVE owner准入，9项owner tests、60项sample-console tests、28项wallpaper-console tests通过；reviewer更正assembly路径后结论保持MATCHED。Expo Web/VM/DEV与整体验收未执行。详见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp03-finding-intake-codex.md`。 |
| CP-04                                    | `MATCHED`                                        | focused tests、lint、typecheck及fresh独立三维对账均完成；required slices与两个composition的实际owner sync registrations闭合，投影保留branch-local state。member-desk首败与Async-release根因修复见CP-04 intake；fresh报告见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp04-reconciliation-codex.md`。Expo Web/VM/device/adapter仍NOT_RUN。 |
| CP-05                                    | `MATCHED`                                        | fresh reviewer `/root/cp05_reconciliation_r2` 返回`STEP_RECONCILIATION=MATCHED`、0 finding；独立核验113/113 tests及当前源码fingerprint。focused原始命令/输出见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp05-focused-proof-codex.md`与相邻`.log`，三维对账见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp05-reconciliation-codex.md`。Expo Web/VM仍NOT_RUN。
| CP-06                                    | `MATCHED`                                        | Fresh reviewer `/root/cp06_reconciliation_r5` 返回`STEP_RECONCILIATION=MATCHED`、无finding；当前源码、focused proof、四份原始日志哈希一致；两integration完整包typecheck/test及Web runner准入矩阵均PASS。Expo Web、VM/device、adapter、DEV与V-01～V-20动态验收均NOT_RUN。详见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-reconciliation-codex.md`及focused proof。 |
| 全批 6b                                  | `MATCHED`                                        | Fresh reviewer `/root/whole_batch_6b_reconciliation_r1` 返回`6B_RECONCILIATION=MATCHED`、无finding；逐项核了需求、详设/Journey/IA、CP-01～CP-06阶段证据与执行面边界，详见`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-6b-reconciliation-codex.md`。这是静态整体对账，不是动态验收。 |
| Expo Web / VM / dual-device / adapter    | `CURRENT_WEB_NOT_RUN_AFTER_STATIC_FIX; HISTORICAL_WEB_PARTIAL; VM_NOT_RUN` | 下列 Web 结果绑定旧 sourceSha256=`01cf44588b7f20dcfd82b227c47951e68ee2bc29072a9dde677c3cf1bd56f301`，仅作历史部分证据：A-02/A-03/A-05 激活、business/TDS URL、连接状态、PONG RTT 与取消，四次 run 为`ter-v02-web-sample-console-laptop-r12`、`ter-v02-web-sample-console-mobile-r13`、`ter-v02-web-sample-wallpaper-console-laptop-r14`、`ter-v02-web-sample-wallpaper-console-mobile-r15`；当时四次各自业务、cleanup、sourceStable与前后端请求关联PASS。该历史通过未覆盖本次新增的拒绝、壁纸退出、RTT selector 数值相等判据，也不覆盖完整 A-ID 分母。**本次静态改动后的 Expo Web、VM/device、adapter 当前运行均 NOT_RUN**；任何历史 RTT 与业务结果不得写成本次字节 PASS。原 manifest/log 仍位于`.runtime/ter-admin-display/<run-id>/run-manifest.json`、`expo-web.log`、`backend-terminal-activation.jsonl`。 |
| Browser L2 / reset / seed / UAT / deploy | N/A_WITH_REASON / NOT_AUTHORIZED                 | 本批明确排除。                                                                                                                                                                                                                                                                                                                                                                                                                   |

CP-01首败保留与处置：topology owned test首先报告多个`ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC`，测试改为await既有async release后同包40/40通过；readiness映射改为revision后，focused反例发现换连接未清revision，修复connection setter清空逻辑后同包40/40/typecheck/lint PASS；skeleton静态门发现两个integration package graph未登记server-config，补齐skeleton与dependency declarations后8/8 PASS；sample-console package surface测试发现expected dependency roster未更新，补齐后原suite 57/57 PASS。随后fresh CP-01 intake发现defaults composition proof、四入口 README 与原始运行证据不完整，新增两个 composition tests、更新五份 README 和阶段证据记录；当前 sample-console 58/58、sample-wallpaper-console 27/27。新增测试首次 typecheck 报 `TS2532`/`TS2339`，改为结构断言后 typecheck 与两包测试通过；首次 Prettier check 报 wallpaper test 格式错误，格式化后check通过。fresh CP-01 reconciliation 进一步发现 owner 没有无效持久配置恢复反例；新增用真实 state JSON codec 字节播种的测试，覆盖非法 selectedSpace 回默认、未知服务和代理秘密形状丢弃、合法 business override 保留并核验 reset/drop 日志计数。首轮测试因夹具错误地添加 `json:` 前缀而未能 hydration，按 `persistenceCodec.ts` 的原始 JSON 编码修正夹具；失败日志保留，最终 owner 7/7 与 lint PASS。所有首败均保留且没有改写为通过。
