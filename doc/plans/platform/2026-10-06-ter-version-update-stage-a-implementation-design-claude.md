---
title: TER 版本定义、完整更新与热更新阶段 A 详设
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
implementationAuthority: false
---

# TER 本机更新阶段 A 详设

## 0 · 元数据与授权边界

需求正本：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`（R-01～15；§20.3 A 范围、§20.7/20.8 子判据）。
Journey=`doc/decisions/2026-10-06-ter-local-update-journey-claude.md`；IA=`doc/decisions/2026-10-06-ter-local-update-ia-claude.md`；交互=`doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md`；计划=`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md`；源码/API附件=`doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md`。
本轮 Dexter 明确委托 Claude 代写阶段 A 文档；允许文档写入/静态审查，不授权源码、契约、规范、依赖修改或任何生成/编译/运行。
本轮只静态读取 automation-agent 当前接口，不打扰 Codex 的工作；运行交付状态未核验，不把目录或作者状态当验收完成。
UI_CONTENT=ACCEPTED；DEXTER_WIREFRAME_REVIEW=ACCEPTED：Dexter 于 2026-10-06 明确“界面内容我都确认”，覆盖系统安装/来源设置、启动加载、原生失败文本三个面。设备行为仍 NOT_RUN，工程 OPEN 与实施授权独立保留；界面确认不授权实施或运行。
STANDARD_DEPENDENCY=APPROVED_PENDING_CP02_IMPLEMENTATION_SYNC：Dexter 已批准仅取消激活根级清除的精确 TR-09 例外；当前正本未落地，须在未来实施授权下、CP-02 之前同步并完成 focused/red。本轮不修改规范。
需求 status/旧授权字段不覆盖本次会话文档授权；A/B/C 原划分不改。

## 1 · 真实业务目标与方案比较

A 先证明安装包、FULL、HOT 真能在两个 application 更新本机，固定任务跨 JS 启动可续接，并不错误报告成功或循环应用坏包。
B/C 消费本批稳定接口；本批不建 CBS 包库/规则/TDP 报告、主副投影、N/M 自动调度或新手工更新页。

| 路线 | 收益/成本 | 结论 |
| --- | --- | --- |
| Expo 公开 Host handler + 同 Host reload | 复用 ReactHost、双屏共享 VM；须独立 boot 保护及文件资源闭包 | 选定；公开 loader getter 每次访问重新计算，embedded asset/HOT file 两条路径的 F-LOAD 未运行 |
| 整进程重启+冷入口 | 单一冷启动路径；Android 主动退出后的可靠拉起、后台启动限制、双屏 Activity 恢复需额外机制 | 本批不选，保留为 F-LOAD 证伪后交 Dexter 的替代，不同时实现两套 |
| expo-updates/托管更新控制面 | 有现成更新库，但另带清单/选包/启动与恢复机制，需证明不与自定义固定 FULL/HOT 冲突 | 本批不引入；不是断言它不可能支持自定义服务器 |

加载推荐由官方公开接口支持，当前工程可行性是可证伪推论；没有 native proof，不能写“已能热更新”。
发布采用 Hermes bytecode 与完整资源；不是在 Hermes VM 里改几段源码。受控 reload 重建 JS Runtime，单机双屏一起重建。

## 2 · CP 总览

| CP | 完整责任 | 前置 | 退出 |
| --- | --- | --- | --- |
| CP-01 | 四版本、清单单源、两 App 三脚本、run/update case 登记 | 本包获接受、automation 公共接口可核验 | 工件/版本 focused；完整阶段 MATCHED |
| CP-02 | UpdatePort契约与最终本机owner、typed-port focused/Web先行 | CP-01 MATCHED | 固定/flush/UNKNOWN/每boot限制；无原生HOT触发；MATCHED |
| CP-03 | Android准备/loader/installer及原生启动保护、PRIMARY确认同时接线 | CP-02 MATCHED | 首次真实更新走最终owner并带完整保护；F-LOAD/F-INSTALL/F-BOOT；MATCHED |
| CP-04 | 数据兼容发布、跨启动/失败/重载边界完整反例 | CP-03 MATCHED | F-COMPAT/中间包与全部边界；MATCHED |
| CP-05 | 两 App/mobile/单机双屏的统一 automation 场景完善 | CP-04 MATCHED | 场景实现与 focused、Web→设备；MATCHED |
| CP-06 | 收尾源码/fixtures、阶段对账；其后整体验收/13c/fresh IMPLEMENTATION | CP-05 MATCHED | 阶段出口=MATCHED；其后按§13b先全批6b，再批次验收/review/cleanup闭合 |

CP-06 不以整批 review/cleanup反向作为 CP-01～05 退出条件。已有效 MATCHED 的未受影响范围不重复对账；受影响差量必须标当前字节和影响范围，不能以历史结论免去新的全批6b。

## 3 · 横切机制对照表

模板后端组（读侧节点授权、写grant/事务、HTTP错误注册、审计三件套）N/A_WITH_REASON：A不建CBS/DB/HTTP业务，不能将TER端口错当后台operation。前端RTK、后台Drawer/下拉/§3-K组N/A_WITH_REASON：TER不用RTKQuery，无后台表单；其余适用机制逐行如下。

| 机制 | ①现成能力/精确来源 | ②可做的最低档观察 | ③新实现形态 | ④适用全集 |
| --- | --- | --- | --- | --- |
| 跨owner写 | TR-01/11、Runtime dispatchCommand | 静态无外包reducer写；focused输入冲突拒绝 | owner actor写唯一slice，技术事件转command | update、integration、native bridge |
| 集合形态/分页 | state单值声明、artifact schema | focused文件数量超8192拒绝；无项目列表分页 | currentTask单值，files有界技术列表 | task/files/failed identity |
| 缓存失效/刷新 | module.initialize/reconcile、native readFacts | focused旧action不写新task，安装后读取实际facts | native actual事实不被prepared目标替换 | 所有转移/两个App |
| 同事实唯一住址 | TR-11；native AtomicFile边界 | 静态只有JS一个task，native只有boot/selection/action | 不复制规则/业务slice | update slice、native records |
| 失败可见/原因不改写 | TR-02；PortResult | focused失败flush/unknown/cancel分别断言 | 原因码具名，保留失败与不确定性 | 6端口、actor、两App |
| 幂等键/重放 | Runtime requestId + task/action/publication identity | focused两屏冲突target、同action重复 | 新requestId不能换已固定任务 | accept/prepare/apply/readback/confirm/release |
| 应生成不手搓 | protocol生成器既有模式、artifact canonical schema | 生成self-test改字段只派生两语言模型 | Node直接AJV校验，TS/Kotlin有限生成 | manifest/版本常量/两App |
| 日志/脱敏 | AGENTS日志标准、platformPorts.logger | focused注入URI/密码/异常，输出不含原值 | 安全关联ID+阶段+错误码，非rawpayload | publisher/owner/native/driver |
| 迁移/可逆 | state slice/AtomicFile formatVersion | focused未知格式不可加载；APK升级业务键不变 | 无DB迁移；旧不可用marker删除，无兼容层 | 两App/旧port所有引用 |
| 编码/名称呈现 | corpus；IA/UI | 静态技术字段不进failure文本；OS copy不锁死 | 用户文本与技术reason分离 | INSTALL/BOOT/FAILURE |
| 会同时坏的原子组 | foundation-charter §5-C | focused工件半包不active、version跨产物不符拒绝 | 发布树+manifest、selection+boot、task+action组 | 三产物/两App/跨boot |
| 生命周期/清理 | Runtime registerAsyncResource、native进程协调器 | focused退订/文件清理失败可见 | 初始化不依赖页面，不建轮询 | module/Host/deadline/installer |
| 网络准备 | TerminalNetworkModule配置逻辑、compositionprovider | native下载截断/超期取消call；静态非65KiB JSON调用 | 更新adapter流式下载，复用配置规则 | FULL/HOT及代理 |
| 自动化 | tools/terminal-automation、agent registry | driver focused phase/update参数；W→AND同case | 同一driver扩展，无旧runner旁路 | §11a全部case |

### 第三方库 API 与运行行为依据

附件 §2 是本批读取的精确版本与官方链接。实际 Gradle/Maven Hermes、Commons Compress、APK签名/API 的运行解析均 OPEN。
未来 CP-01/02 的 proof 绑定 installed package/锁文件/Gradle解析，不以 package 范围替代实际版本。新增库须先证明已有实现不能覆盖。

## 3a · UI/testId 前置复核与验收准入

三个面按 IA/交互工件。管理后台 Browser L2=N/A_WITH_REASON（无后台）；TER Expo Web/Android 仍适用。
L2_SCRIPT_ADMISSION=N/A_WITH_REASON（非后台BrowserL2）；TER_UI_ADMISSION=OPEN：Dexter 已接受三个面的界面内容；当前 source/control 注册、实现期独立静态复核与设备行为仍待完成，不能把看图确认写成运行 PASS。

| case-action/观察 | 真实节点/owner | 唯一标识来源/挂载 | wrapper/native | driver通路 | 当前proof |
| --- | --- | --- | --- | --- | --- |
| install-result：安装确认 | Android系统Installer按钮 | OS包+资源语义+display；无TER TestId | native OS | 最新driver内R-10系统UI窄例外：uiautomator取节点bounds后真实input；报告注明 | NOT_RUN |
| install-result：取消 | 同系统取消按钮 | 同上，不以TER文案猜控件 | native OS | 同例外；不能泛化到TER React节点 | NOT_RUN |
| install前提：允许来源 | OS安装来源设置开关，仅系统要求时 | OS设置包/语义resource/display | native OS | 同driver窄例外；权限事实读回 | NOT_RUN |
| rollback：无安全目标 | adapter/android/update内拟TerminalUpdateStartupFailureView.kt的Text | contentDescription=terminal-update-startup-failure；真实Text | native TER | 同driver R-10非React界面窄例外：uiautomator读取真实Text/屏幕，不是点击wrapper；报告注明 | NOT_RUN |
| boot-guard：PRIMARY成功/失败 | integrationAssembly real-ready；既有loading gate | 非控件；当前boot与owner selector/原生读回 | internal state | agent注册selector；失败JS由driver原生事实读回 | NOT_RUN |

上述是A全部新增/复用的控件与关键观察，不用此表取代§11a。系统权限面为INSTALL前置变体，由OS控制，不在TER新增表单。
控制面适用全集：两App package/Gradle/签名/发布配置，artifact schema/生成器，update owner/port/native，integrationAssembly及两integration selector registry，automation agent开关/run配置和driver phase/fixtures/journeys/native动作，resource/health/format。任一变化后重开本表与受影响case准入，不能拿旧字节准入执行。

系统控件无 TER TestId，使用 automation driver 的系统包/窗口/display限定控件；新增失败文本 contentDescription 見交互 roster。
第一次动态前做该 CP 的静态三维准入：需求、详设/IA与逐点变更、命中 memory/规范；不是提前 MATCHED。
完成 CP 全部 focused proof 后再做完整 CP 退出对账。无脚本时先补当前 automation driver，不跳到旧方式。
本批没有 reset/seed/L2 计划，§10b 是 N/A 与已有 fixture 准入；无空分母准入和无条件seed dry-run。

## 4 · 每个 CP 的门控

计划逐 CP 写 RECALL/允许改动/PROOF/退出。每点改前和 focused 后回读同一原始材料/owning source/记忆。
F-LOAD/F-INSTALL/F-BOOT 在 CP-03 的同一受保护生产链先做单场景；F-COMPAT 完整反例在 CP-04，不推给 CP-06 的 all。CP-02 仅 typed-port focused/Web，安装产品 App 内的更新触发始终由最终 owner command 发起。计划 CP-02 前另列可选、需单独授权的一次性 F-LOAD 技术探针，不进入产品代码、不构成更新执行或第二条 HOT 路径，不能替代 CP-03 生产链证明。
技术阈值拟定见 §8.8；实际预算不支持则修小的 owning path或交 Dexter，不悄悄放宽产品边界。

## 5 · operation/path/face/集合形态

A 新增终端本机 command/selector 和原生技术端口，无 CBS HTTP、DB/schema/Flyway/后台face。
工件 fixture HTTP 仅受管静态文件供给，不是第二业务服务器；WS/automation只发送 metadata，不传 ZIP/base64。
当前任务形态=单值；failedArtifactIds=本机拒绝身份集合而非历史/队列；artifact.files=有界技术列表。

## 6 · 跨 owner 写矩阵

| 来源→目标 | 公开入口 | 权限与事实 |
| --- | --- | --- |
| 后续 C 调度/受管fixture→terminal-update | acceptTerminalUpdateTargetCommand | 最终同一执行核；fixture不能生成默认生产规则 |
| integration PRIMARY→terminal-update | confirmTerminalUpdateBootCommand | real-ready + hydration + 当前 bootToken |
| adapter event bridge→terminal-update | internal reconcileTerminalUpdateCommand | 只传技术状态；身份不匹配不写原task |
| terminal-update→runtime/state | flushPersistence/actor slice actions | 仅写本机 owner slice；不写 TDC/server-config/topology |
| terminal-update→Android UpdatePort | prepare/apply/readback/confirm/release | 原生文件/installer/boot真实事实，不写业务slice |

副机不会因投影获得已执行任务；A 的本机 slice syncIntent=isolated。项目规则投影及副机调度仅 C 接线。

## 7 · 声明—传递—消费矩阵

| 事实/机制 | 声明 | 传递 | 消费/反例 |
| --- | --- | --- | --- |
| 四版本 | application/package.json version + terminalRelease | 构建清单→APK native常量/内嵌发布→HOT清单 | 实际selector；Gradle写死值红例 |
| publication identity | 稳定 relative path/文件 bytes digest；版本与application/runtime | INSTALL内嵌资源、FULL metadata、HOT metadata | 同版本不同内容拒绝；未知身份不能 already reached |
| 最小 FULL | HOT manifest.minimumFull={applicationId,nativeBuildNumber,runtimeVersion,publicationId,apkSha256} | 固定 target.full/hot | 不比较runtime字符串；合法旧JS中间包必须读新数据 |
| target/task | caller→owner校验→持久slice | flush成功后 port sideeffect | 两屏同时请求只固定一个任务，后续不能换目标 |
| boot身份 | native一次JS实例生成，独立于Activity与agent session | adapter actual facts→owner→PRIMARYconfirm | 迟到旧boot忽略，reload也开启期限 |
| 失败/UNKNOWN | typed原因+实际readback | currentTask/recentStatus/failedArtifactIds | 只失败身份禁重试，不把取消标坏包 |
| 资源所有权 | run/task/prepared/install identity | native原子记录/driver manifest | 清理不碰active、previous成功、未知installer、他run资源 |
| 代理 | server-config公开selector→compositionprovider | adapter每次网络调用读取快照 | 切空间不静默重绑固定task，秘密不进入update slice |

## 8 · 业务规则与状态机

### 8.1 四版本与工件

`package.json.version`=nativeVersion；新增 `terminalRelease.nativeBuildNumber` 1～2147483647整数、`bundleVersion` 三段非负整数、`runtimeVersion` 非空显式兼容字符串。
两个application分别声明；Gradle、JS编译常量、manifest只消费该源。`bundleVersion` 按三整数比较；nativeBuildNumber比较整数；runtime只能相等。
新增规范输入 `contracts/terminal/terminal-update-artifact.schema.json` 为清单形状单源；能力型生成器 `scripts/generate/terminal-update-artifact.mjs` 输出 platform-ports TS与 adapter Android Kotlin模型，Node打包器直接校验 schema；不能手写第二份模型。
发布脚本名称 `package:install`/`package:full`/`package:hot`，两App均有；FULL复用该次INSTALL APK同字节，不二次build。
HOT 必须显式引用同application的minimum FULL metadata；不通过文件名/最新目录猜FULL。
安装APK的 embedded release 与对应HOT由同一 compiled bundle+资源发布树产生。manifest记录platform/applicationId/runtime/native声明、entry、resource paths/size/hash、publicationId；FULL含APK路径/hash/签名核验信息，HOT含 minimumFull。
publicationId=有序相对路径+每文件SHA256的稳定编码摘要，包含真实入口/资源，不包含外层ZIP/清单自身避免递归。排序仅为内容身份编码，不赋予业务列表顺序。
embedded 保持 RN 默认的 assets:// bundle 与 APK res 资源路径，不增加安装后复制整树的启动步骤。构建从共同 compiled 发布树计算 publicationId，把该身份与实际 embedded bundle asset 名称写入受 APK 签名保护的发布 metadata；INSTALL/FULL 的身份来自该构建事实，不从 AAPT 转换后的 drawable 重新推算。HOT 保留同源未封装发布树及其文件摘要；两种封装形式不同不影响共同内容身份，普通启动不依赖文件准备或额外磁盘复制。
签名 metadata 本身不足以证明实际入口同源：CP-01 必须从最终签名 APK 解出 metadata 指定的真实 embedded bundle，SHA-256 与该 compiled 发布树入口摘要相等；RN Gradle 打包必须消费该树，不允许另一轮 Metro 产物悄悄替换入口。资源核对发布树文件清单到 APK assets/res 名称、类型与尺度/限定符的实际映射，缺项或错映射拒绝；AAPT 会转换部分 drawable 内容，因此不以转换后 drawable 字节与原始文件逐项相等为判据，原始身份仍由发布树摘要确定，实际资源可用性另由 F-LOAD 证明。
原始版本同但身份不同一律冲突；actual identity缺失/损坏时返回unknown，不假填目标值；更高native只有实际runtime兼容才跳FULL。
受管版本fixture只在仓内 run-owned descriptor副本中声明测试版本/包名后缀；生产三脚本只读application package源；不能允许环境变量绕过生产版本来源。

### 8.2 文件资源与加载路线

新增 `adapter/android/update` Expo模块；TerminalUpdatePackage实现Expo Package公开createReactNativeHostHandlers，autolinking识别 *Package.kt/java。
getJSBundleFile 每次读取 beginBoot 已核验的唯一入口：embedded 显式返回 assets:// 加构建 metadata 中的真实 asset 名称；HOT/文件恢复目标返回已校验的 file 路径。两者共用 application 既有 Expo factory 的唯一 Host，不用 DevLauncher/private 字段。选择记录的已安装 APK 身份绑定与复位见 §8.4/§8.7。
受控 HOT 应用顺序：owner flush → apply 持久化与当前已安装 APK 身份绑定的 selection → beginBoot 核对 identity/hash/合法 root → 同 Host reload → 加载实际 HBC。FULL 后冷启动先进行 APK 身份复位，再显式选择新 embedded。
embedded 图片沿 RN 的 APK res 解析，字体沿内嵌资产加载；HOT 和获准的文件型恢复目标按 RN 文件 bundle 布局（drawable-*、非图片 raw/*，generic resolver 保留相对路径）打包。获准 embedded 恢复仍走 asset/res，不复制为文件包。expo-asset 未安装 expo-updates 时使用 RN resolveAssetSource；F-LOAD 分别证明 embedded asset/res 与 HOT file 两条路径下 HBC、图片、字体离线可用，HOT 新资源不能依赖旧 APK drawable、旧缓存或远程资产。
原生只提供已验证入口/root事实，不导出可由任意command直接指定的文件路径。带native新模块/不支持资源发布闭包不能发布HOT，须FULL；不通过有网/旧缓存fallback掩盖。
F-LOAD失败时停止该CP的后续推进；先验证公开接缝/布局，若要换整进程路线必须交回Dexter并修同包，不双维护加载器。

### 8.3 最终公开接口

`kernel/base/terminal-update`：public命令 acceptTerminalUpdateTargetCommand、confirmTerminalUpdateBootCommand；公开selectors selectTerminalUpdateActualVersions、selectTerminalUpdateTask、selectTerminalUpdateRecentStatus。
module.initialize在runtime hydration完成后发送internal reconcile command；nativeevent内部转command，外包不订阅第二业务总线。
accept输入为完整不可变 `FixedUpdateTarget`：ruleRef/createdAt/applicationId、full?、hot?、N/M策略参数、可信下载来源ref及expectedhash、selectionContext（selectedSpace/context identity）。不接受raw下载路径、脚本代码或页面状态。
来源授权provider由composition注入：A正式应用无规则供给，不自动调用accept；automation fixture按manifest登记可信artifact与来源，再用同一命令。provider不允许任意URL/额外“fixture执行”command。B/C换真实授权数据，不换执行核。
精确装配：两ui/integration的src/application/module.ts调用createTerminalUpdateModule并注入同一个具名UpdateTargetSourceProvider；application/base/android仅装配UpdatePort与当前网络配置读取能力。生产A provider返回SOURCE_UNAVAILABLE，不内置测试target。受管构建profile从仓内run-owned descriptor生成有限允许工件ref/expectedhash/来源origin，只有当前automation-enabled测试构建使用；production构建不得导入该descriptor，包/构建检查要有红例。driver仅通过正式accept command引用这些ref，不靠测试专用native入口；此fixture也是可信来源的替身，不是执行核的替身。
选择/鉴权与固定前检查在owner串行临界区；async查询后重读状态，防迟到提交。重复同target/task幂等；不同payload identity冲突；每boot只占用一个rule。
UpdatePort替代旧HotUpdatePort，无兼容别名：readFacts、prepareArtifact、applyPrepared、readAction、confirmBoot、releasePrepared 六项。
readFacts 返回实际 native 版本、installedApkIdentity、embedded/selected/previous/candidate 发布及加载资格、current boot、installer/action 状态；APK 身份不符后的 selectionResetReason=APK_CHANGED_SELECTION_RESET 明确可见，保留旧身份作诊断，不以目标版本填 actual。prepare 只下载/校验/解包，返回 opaque preparedId；apply 输入 task/action/prepared 身份和 FULL/HOT 类别，不接受路径；readAction 按 action identity 查询；confirmBoot 带 bootToken+publicationId，并与该 context 的 installedApkIdentity 绑定核对；release 只释放无引用 prepared。
所有方法沿用具名PortResult，不用开放Record/index signature。native状态事件是技术事件，经module注册桥传internalcommand；port不裁决项目规则/持久业务task。

### 8.4 State 与唯一事实

持久化 slice：currentTask（或 null）、recentStatus、failedArtifactIds；persistIntent=owner-only，syncIntent=isolated。Dexter 已批准的取消激活根级清除例外及唯一规范落地前置见 §12；CP-02 满足该前置后，terminal-update 自有 descriptor 采用 resetIntent=retain，仅保留其实际落盘的这三项。非持久运行态、其他 owner、orphan 键照常清除，TDC 凭证不保留；不得把此决定扩为任意 root reset 许可。topology 角色切换是 flush 后 appControl.resetRuntime 重载 JS，不清 state，不作为 reset 例外理由。卸载应用仍按系统清本机存储，不新增手工 clear 入口。若来源授权已失效，尚未提交动作按具名拒绝终结，不能借新凭证/新空间换固定目标；已提交动作仍必须以原 identity 读回。UNKNOWN 中不得删 installer 文件。
retain 的实际机制按 slice.resetIntent 生效，不读取 reset 原因。精确裁决的范围依赖当前生产源码唯一根级触发点为 TDC 取消激活；新增任何生产 requestApplicationReset 调用点前必须重新评审该例外，不能据现有 retain 推导其他原因已获批准。此义务落在 CP-02 规范同步与独立 review checklist，不新增原因过滤或通用扫描门。
currentTask包括taskId、固定target、full/hot阶段、preparedId、actionId、applicable native identity、lastBootId、最近安全原因及时间；无另一JS任务map/历史流水。
实际 version/boot/installer facts 来自 native readback，JS 缓存只呈现当前读回值，不作为执行成功来源。Web 生产构建的 UpdatePort 使用 typed unavailable 默认实例，不提供 APK/Hermes 假事实；typed fixture port 只在 automation-enabled Web 测试构建显式注入，范围与 §8.3 来源 provider 同形。生产装配禁止导入 fixture，初始化不根据缺 native 能力自动回退为 mock；CP-02 包/构建 red 必须证明 production 中夹入 fixture 会失败。测试 facts 不冒充 native。
native 最小原子记录只保存 selection/previous/candidate/boot/action 关联及必要 result，因坏 JS 无法运行必须原生维护；不复制项目规则/currentTask 或业务 slice。selection、previous、candidate 均保存创建时的 installedApkIdentity={applicationId, actual nativeBuildNumber(versionCode), embedded publicationId}，这是现有事实的技术绑定，不是第五个版本。冷启动 beginBoot 将每项与实际安装 identity 比较；不一致则作废加载资格并保留旧记录作诊断，选择当前 APK 的 embedded 发布，旧 candidate 的 boot/deadline/confirmation 资格同时失效。身份无法读回不猜成匹配、不批准 HOT，返回具名不可核验事实；可核验的签名 embedded 是冷启动基线。AtomicFile 外再串行化 native 选择/安装操作。
已确认的上一成功发布和active永不随无关cleanup删除；prepared未active时可清，UNKNOWN读回未结束不可清。

### 8.5 固定与跨启动

阶段：FIXED→PREPARING→PREPARED→APPLYING→WAITING_USER/UNKNOWN/WAITING_BOOT→SUCCEEDED或FAILED；readback决定转移。
首次port前先固定target并flush，failed则不触碰port；下载中可有限网络重试但不换artifact/target。
每次安装commit或HOT selection前flush所有dirty owner-only业务slice；失败零提交，保留原可运行版本。
同boot ledger只是本机占用事实，不新建第二执行队列；继任boot先续接currentTask。FULL读回成功后新的boot运行内嵌JS，再续接HOT；即使embedded低于原HOT，也须发布compat测试证明可读。
FULL-only目标不能降低实际JS；配对最终HOT也不能降低原JS；原始source JS版本及identity保存在固定task比较依据中，不能在FULL后用低内嵌值重算而误放行降级。
HOT实际加载且PRIMARY确认后才SUCCEEDED；reload accepted、系统install success均不足以称整rule成功。
同boot失败不领第二rule；后继boot可接受不同修复artifact，但不自动重试failedArtifactIds中的旧工件，不提供手工retry/clear标记接口。

### 8.6 FULL 系统路径

PackageInstaller先核对APK包名/签名/native版本实际字段与清单；同包同签名、不降native。最低API和企业安装资格由readFacts读回。
silent仅在系统允许时请求，否则接受STATUS_PENDING_USER_ACTION，foreground时打开返回的系统Intent。应用后台/系统面期间不叠弹窗。
用户明确取消：保持WAITING_USER，记录USER_CANCELLED，不加入failedArtifactIds，不把STATUS_FAILURE_ABORTED一律当技术失败；无法区分abort来源时返回UNKNOWN/ABORT_UNCLASSIFIED而不作取消推断。
A无N重复提醒调度；等待状态和参数保存供C；A可在fixture里真实第一次取消后系统合法再次受理同固定目标以证明非失败，但不加面向用户手工重试能力。
已 commit 但无结果/断进程：先 UNKNOWN；下一 boot readAction+PackageManager 实际包/version/签名并核对系统 session。实际更新成功才推进；仍在进行不能再次 commit。成功读回证明本 action 的 session 已结束/消失且实际版本未达目标时，返回 ENDED_NOT_INSTALLED，owner 回到 WAITING_USER；下次可呈现时依同固定目标建立新 action/session 再邀请安装，语义与明确取消相同，不标坏包、不 FAILED、不新增手工重试。A 的再次邀请由既有 fixture 续接触发，N 调度仍归 C。session 仍存在而不可判定，或 session/版本查询本身失败时保持 UNKNOWN；不以读回失败推断 session 消失，不轮询重复提交。
明确技术失败可FAILED；清理先确认session无引用，不能将“未见callback”当安全删除依据。

### 8.7 HOT 启动保护

原生在每次selected候选JS实例创建前建立 bootToken（同Activity reload也新建），以独立native计时覆盖加载到确认。
确认：integration PRIMARY real-ready没有内容失败 +必要owner hydration成功 +token与当前候选/发布完全相等；SECONDARY或旧boot/已隐藏splash不确认。
确认前错误或T到期最多恢复一次：仅同native/runtime、已确认成功且符合发布纪律的previous目标；原失败candidate身份记录并拒绝自动重入。
任意 APK 身份变化（即使 runtime 相同）都使旧 selection/previous/candidate 失去加载资格；FULL 首次新启动必须先运行新 embedded，再由同固定 task 续接兼容 HOT。外部安装更高版本 APK 同样复位，不凭同 runtime 继续旧 HOT。新 APK 的 embedded 仅在实际发布 compat 证明后可作该 APK 内获准恢复目标，不臆测业务数据。
无安全目标则原生失败面，不加载任意旧包、不APK降级；JS timer、HTTP/PONG、TDS状态都不是启动保护依据。
确认后的HTTP/断链/业务错误不回退。进程退出导致未确认记录只记unconfirmed，不能虚构codeBug；后继冷启动读取该identity、按同兼容准则有界恢复或可见失败，不无限加载候选。
发布门对HOT确认前写入及FULL中间旧JS读取建立真实数据样例；manifest的compat声明只是承诺标识，不能代替发布测试。两App分别证明。

#### 原生实例与所有重载入口的具体协议

不能以Expo `onWillCreateReactInstance`当每次reload的前置：installed factory只在Host首次建立调用。
冷启在 application native 生命周期、首次访问 lazy ReactHost 前调用 adapter 进程协调器 beginBoot：先读实际 installedApkIdentity、核对三类记录资格，发现 APK_CHANGED_SELECTION_RESET 时显式选择签名 embedded；readFacts 及 owner recentStatus 可观察旧/新身份与实际 entryKind，不能继续报旧 HOT 为 active。HOT apply/获准恢复在选择记录原子替换后、调用 host.reload 前 beginBoot，旧 APK 的 token 不得确认新 APK。
既有 `TerminalAppControlModule.resetRuntime` 统一经过同协调器：TDC取消激活（terminalDataClientActor.ts）、topology切换（topology/src/features/actors/actors.ts）、Runtime系统失败（resetRuntimeAfterSystemFailureActor.ts）三个消费者的公开命令与错误观察保留。
若candidate尚未确认，外来reset不能悄悄重复candidate或刷新其T：加入当前in-flight reload（同attempt）或按当前失败/兼容事实进入一次恢复；无法安全重载返回具名失败，不能称successor已起。
每个 beginBoot reservation 只生成一次 token，并绑定 installedApkIdentity/entryKind/publicationId；串行化相同 in-flight reload，getJSBundleFile 只读 reservation，getter 多次求值不新建 token、不延 T。embedded 显式走 assets:// 入口及 res 资源；已选 HOT 或获准文件型恢复目标缺失/损坏时显式失败并依保护判据恢复，不能 return null 悄悄退到默认 assets。APK 变化时的显式 embedded 复位、获准 embedded 恢复与这种隐式 fallback 必须区分。
Native以ReactContext实例维护不可变boot绑定：每次更换pending reservation前，先读取公开ReactHost.currentReactContext并把仍存活旧context绑定到旧reservation（即使其Update module尚未首次初始化）；再建立新reservation。这避免旧context迟到首次读取时偷取新token。新context首次Update module初始化绑定其reservation；Expo onDidCreateReactInstance/context listener再核对同一entry/实例，不能把旧context改绑新token。旧context已销毁后以weak引用释放。冷启无旧context；所有reload路径均经同协调器，非登记入口不得写pending。
Update native module从调用者ReactContext绑定取token；JS selector/确认拿不到全局新token来给旧实例冒名。监听/模块初始化顺序尚须F-BOOT证明；绑定不可用返回NOT_READY并由context-ready技术事件触发reconcile，不加轮询。
普通已确认发布的reset仍需新boot身份供actualfacts，但没有candidate HOT回退；其他来源reload与native exception共同做反例。

#### Installer action/commit 崩溃窗协议

JS 先持久化 task.actionId/目标 hash/阶段并 flush。Native 先 AtomicFile 写 INTENT（actionId/taskId/package/目标 hash），再建立 Session；启动动作前 getMySessions 必须为空，非空且无法精确归属则 BUSY_UNKNOWN，不删除、不认领、不创建冲突 session。BUSY_UNKNOWN 在 foreground/resume 或系统 session callback 时重新读回，不轮询：仍有未知归属 session 则保持；唯一且符合原 INTENT 的本 action session 才恢复；成功读回确认占用 session 全部已结束时，实际目标已安装则成功，否则解除 busy、回 WAITING_USER，下一可呈现时以新 action/session 邀请原固定工件。查询失败不能当成空集合。
进程中只此adapter可创建installer Session；已持久INTENT且唯一新getMySessions的包名/创建阶段匹配，可恢复createSession→保存sessionId间的窗口，不能按端口或包名猜别的App资源。多候选/字段不匹配保持UNKNOWN。
保存sessionId后写入APK并校验，记录STAGED；commit之前原子写COMMITTING。PendingIntent携actionId/sessionId，通过本native模块的manifest receiver回写状态，receiver在后继APK仍可读同记录；日志不存原系统异常。
COMMITTING 时崩溃：PackageManager 已达目标则成功；系统 session 在进行则等待；平台 API 能明确证明未 commit 才允许继续同 session；session 仍存在但不可判定或读回失败则 UNKNOWN。成功读回证明该 action session 已消失且实际未达目标，原 action 记 ENDED_NOT_INSTALLED，owner 回 WAITING_USER；原 action 不再 commit。下次合法呈现前先 flush 新 actionId，再建立新 session；保持同 task/工件，不将此过程视为失败工件重试。
API 分支必须采用 §12 经 Dexter 选定的 FULL 设备范围：SessionInfo.isCommitted() 从 API 29 才提供，false 只证明未调用 commit，还须核验该自有 session 合法可续接；不能忽略 sealed/其他状态。在 API 24～28 无法证明 COMMITTING 的实际状态时，保留 UNKNOWN 至成功读回系统已回收或其他明确结果，不按应用等待时间猜回收、不新建冲突 session。系统回收没有本产品可承诺的固定期限。
ACTION结果必须匹配task/action/session/hash；迟到回调不能替换后继操作。USER_CANCELLED/ABORT_UNCLASSIFIED不标坏包；明确用户取消保留WAITING。
仅已核验结束的本 action（USER_CANCELLED/ENDED_NOT_INSTALLED），或经精确 readback 证明未提交且本 action 拥有的 session 才可受控释放无引用准备资源；WAITING_USER 续接仍引用的 APK 不清，UNKNOWN 不得清 APK。
这是一份native action原子记录与现有系统session事实，不是第二业务任务账本；安装等待继续不代表每次自动重复create/commit。

| 中断窗口 | 可恢复事实与最小动作 | 禁止 |
| --- | --- | --- |
| JS action flush前/失败 | 无native动作；保持原发布 | 先建session再补task |
| native INTENT前 | 同action幂等建立INTENT | 为相同task换action造成双session |
| INTENT后、create前 | getMySessions为空，创建唯一session | 非空未知session删除或占用 |
| create后、sessionId持久前 | 用INTENT和唯一、包名/阶段匹配的本installer session恢复；模糊则UNKNOWN | 猜session归属或再create |
| sessionId后、APK写入中 | 同session核对写入/hash；未commit才继续stage | 把残缺APK当已准备/已安装 |
| STAGED后、COMMITTING前 | 原子写COMMITTING，再一次commit | 无action记录提交 |
| COMMITTING后、调用/回调间 | 实际包已达→成功；系统在途→等待；可确证未commit→同session继续；仍存在不可判定/查询失败→UNKNOWN；确证session消失且未安装→ENDED_NOT_INSTALLED→WAITING_USER | 因无callback或读回失败重复旧commit/create |
| callback后、JS未读回 | receiver持久技术结果；下boot按完整identity读回 | 迟到旧session写新task；系统success冒整rule成功 |
| 明确用户取消或ENDED_NOT_INSTALLED后 | 仍WAITING_USER；旧action终结且不再commit，未来C提醒或A同fixture续接以原task建立新action/session | FAILED标坏、旧回调覆盖新action或提供手工retry界面 |
| BUSY_UNKNOWN后 | 按foreground/resume/session事件读回；未知session仍存在则保持；确证全部结束后核对实际版本→成功或WAITING_USER | 删除/认领未知session；查询失败当空集合；轮询抢占 |

### 8.8 有限技术预算（本设计拟定，尚待测量）

每次只有1个native准备工作与1个application update任务；ZIP最多256MiB、解包累计512MiB、files最多8192、manifest最多256KiB；64KiB流式buffer，不整包入JS。
空间预检需下载ZIP+本次解包上界+64MiB保留；当前active/previous空间另计，不为凑预算删除其资源。压缩比不能仅按声明判定，实际读取累计也限额。
connect10s、一次下载总期限120s、最多3次（1s/3s延迟）暂时网络失败；下载尝试与退避累计≤364s（取消/资源结束的单次10s另计，最多三次共30s，不虚报整个动作只需364s）；认证/摘要/路径/兼容失败不重试。到期取消原call/流并等待可观察资源结束，不只cancel Promise。
native boot T=60s，独立进程native scheduler；仅覆盖candidate启动，不给普通每次业务启动加HOT回退。人工安装等待没有TTL；清理/读回单次10s，超过返回UNKNOWN/cleanup failure，不杀未知session。
这些是控制资源的工程候选，不是已测安全容量或新业务配额。CP-03/04单场景测量证明目标设备可达；需要改变须记录依据及受影响测试，不能通过盲延timeout获得PASS。

## 9 · owner API 与消费者清单

terminal-update只依赖runtime/contracts/platform-ports/state；纯比较在foundations，事件业务处理在actor。
Android update adapter只实现platform-ports，原生Package/模块/文件/安装代码在其android目录；application/base/android负责装配/PRIMARY readiness，不反向导入业务owner。
两个application共同消费base/android与adapter；ui/integration两包共同注册update module+selectors，不重复本地执行者。
打包Node工具消费canonicalartifact schema和application package，无React/UI依赖。B/C将来消费固定接口，不增另一schema/版本账本。

## 9a · 全链同步变更清单（未来实施范围）

| 正本/生产路径 | 变更与消费者 |
| --- | --- |
| contracts/terminal/terminal-update-artifact.schema.json；scripts/generate/terminal-update-artifact.mjs | 新清单/生成器，D41完整路径校验；平台端口与Kotlin同源 |
| apps/terminal/kernel/base/platform-ports/src/types/hotUpdate.ts、src/types/platformPorts.ts、src/types/result.ts、src/index.ts、默认不可用实现及测试 | 换UpdatePort与具名消息；检索所有hotUpdate引用，同批删除旧七方法，无fallback |
| apps/terminal/kernel/base/terminal-update/ | 新最终owner、commands/slice/actor/selectors/initialize与tests；package/public exports/invariants |
| apps/terminal/adapter/android/update/ | Expo native模块、TerminalUpdatePackage/HostHandler、file preparation/PackageInstaller/AtomicFile、tests |
| apps/terminal/application/base/android/src/foundations/androidPlatform.ts、src/foundations/nativeLoadingCapability.ts | 装配adapter、注入provider和bootfacts，正确失败不confirm |
| apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingRegistry.kt、TerminalAppControlModule.kt | 复用loading/Host，共同调用adapter的进程协调器；保留TDC取消/topology/Runtime失败reset三个原消费者与typed结果 |
| apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx | PRIMARY real-ready确认接缝；旧boot隔离 |
| apps/terminal/ui/integration/sample-console/src/application/module.ts；apps/terminal/ui/integration/sample-wallpaper-console/src/application/module.ts | update module配置与selectors registry，单Runtime单实例，无页面启动effect |
| apps/terminal/application/android/sample-terminal/；sample-wallpaper-terminal/ | package.json/scripts/app.config/Gradle/embeddedmetadata/autolink，两App签名与版本传播 |
| scripts/build/terminal-update-artifact.mjs；tools/terminal-automation/src/runner.ts、androidBuild.ts、managedRun.ts | 单源打包和新update phase；同run包名/签名跨安装/重启 |
| tools/terminal-automation/fixtures/updateArtifacts.ts、journeys/update*.test.ts、src/index.ts与直接测试 | 受管静态工件、最终command、实际安装动作/selector/native readback |
| tools/verify-gates/verify.mjs、scripts/README.md、scripts/env/check-runtime-resource-budget、health/format登记 | 只扩既有门/资源profile；不要引入新台账控制面 |
| doc/platform/terminal-coding-standard.md TR-09 | Dexter 已批准取消激活根级清除的精确例外；未来实施授权下、CP-02之前于唯一正本落实并做focused/red；本轮不改规范，不扩大其他reset/owner |

### 9a.1 有限门映射

类型与package边界复用现有typecheck/code-layout/TER invariants；失效源码、错误depend方向有对应red。
artifact generator/check self-test：根外package/manifest/子文件symlink必须拒绝；路径穿越、duplicate entry、symlink/压缩炸弹、同版本不同identity、旧HotUpdate消费者用最小red fixture。
application version propagation打包门读最终签名APK真实字段、metadata及实际embedded bundle：实际入口SHA-256必须等于发布树入口摘要，资源清单与APK assets/res名称映射必须匹配。红夹具保留metadata/版本却替换入口字节（必要时按测试签名重签）必须拒绝；资源缺项/错映射同样拒绝。AAPT转换后的drawable不作原始字节相等比较，理由见§8.1；改Gradle写死/red声明不可被expected常量掩盖。
全仓verify未来仍须跑实际默认模式；validate-only不可作替代。阈值/业务/兼容不建通用机械语义门，靠focused和独立review。
### 9a.2 runner复用/退役

唯一新能力并入 `scripts/test/terminal-automation.mjs` / `tools/terminal-automation`；不新增ter-update旧风格runner。
runner拟扩展phase=update与§11a有限case；当前CLI尚不支持这些case，计划命令是待实现，不是已成功运行命令。
新phase支持不需DEV的本地工件；需要激活/业务恢复的case才用现有受管fixture与授权DEV；不隐式启动reset/seed。
当前 `tools/terminal-automation/src/runner.ts` 的 DEV 父流程覆盖 journey/skill；update 尚无分支。CP-01必须给update增加精确requiresManagedDev分支：update.flush、update.compatibility、update.rollback中的真实业务数据子断言为true，复用managedActivation。其余更新技术分支为false；不得只增加phase enum而遗留fixture无context。CP-05按该布尔分支验证缺manifest/缺合法角色的拒绝红例。
在CP-01登记本机run根 `.runtime/terminal-automation/` 的既有kind扩展和资源profile（沿用现有命名，不自造预算豁免）、health/format及红例；CP-05完善场景。
原生真实动作由同driver Android能力扩展；安装、来源设置及原生启动失败文本三类非React界面可按automation需求R-10使用driver内uiautomator窄例外并注明（失败文本只读），TER React节点仍走agent；不用旧UiAutomator入口或独立adb工具脚本。cleanup以run实际包/进程startidentity为准。

### 9a.3 当前 automation 接口与本批接入

本次静态重开实际接口：`tools/terminal-automation/src/driver.ts` 的 `createTerminalAutomationDriver` 返回 `transport`（协议 server）、`waitForSession`、可选 `fixtures` 与 `close`，没有 driver 自身的业务 command 方法。正式更新 command 经 `driver.transport.request(sessionId, 'command.dispatch', body)` 进入现有 Runtime；真实 UI 操作的 request 观察复用 `requests.observeUiAction({server, sessionId, workspace, displayMode, commandName, action})`，与语义 command 分发分别标注，不复制账本。selector 复用 `readSelector`/`subscribeSelector`/`waitForSelector`，按公开 name 与 argsTuple 求值；新增 update selectors 由最终 owner 在 `selectorDefinitions` 登记。

有授权 DEV 的业务 case 复用 `fixtures.ensureActivated({shape, deviceId, runId})` 及 managedActivation，不复制激活路径。Web deviceId 使用当前 run 的受管注入；Android 从新会话经 `readApplicationDeviceId(server, sessionId)` 查询 runtime.info 中生产 DevicePort 身份，不以 ADB 身份或 Web 注入值替代。

`createWebJourneyUiPort`、`createAndroidJourneyUiPort` 与 selector 订阅均固定建立时的 sessionId。HOT reload/FULL 后重新等待当前应用的新 session，释放旧本地观察并重建这些 helper、业务 selector 基线与 request 观察；旧会话完成不确认新 boot，不能把旧 helper 指向新 socket。沿用 `createTestId(moduleName, part, {element?, key?})`，不使用第三个字符串参数或手写定位别名。

当前源码静态评审见 `doc/review/platform/2026-10-06-ter-automation-agent-source-static-review-claude.md`：事件 ID/旧会话隔离、迟到 command 实例身份、selector 最新值、设备 cleanup 与 TestId 门存在待修复输入。阶段 A 实施前重开修复后的同一 helper 与直接反例；不以历史 GO 推定可靠、不重做未受影响的 automation CP，不在阶段 A 另建替代 driver。诊断/JSON/容量注记仅按实际消费修复，不扩为通用恢复框架。本次没有核验 automation 的运行交付状态。

既有 `tools/terminal-skeleton/check-static.mjs` 的 `runStateResetRetentionOnly` 当前只接受 server-config 一个 retain 声明。CP-02落实已批准 TR-09 例外时，同步修改这一现有门的精确 owner/source 与数量判定，接受 server-config 加 terminal-update 自有持久 descriptor；拒绝其他 owner、非持久字段和 orphan 扩保留。字段保留仍由既有 focused/red 验证，不新增原因扫描门或通用 retain 豁免。

## 9b · 变更定位

新增owner入口位于 `kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts`，状态变更只在 `src/features/actors/terminalUpdateActor.ts`；selectors/commands由包根与terminal-invariants登记。
原生组件位于adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/下的TerminalUpdateModule.kt、TerminalUpdatePackage.kt、TerminalUpdateCoordinator.kt、TerminalUpdateStartupFailureView.kt及InstallerStatusReceiver.kt；不写node_modules。
打包器/生成器及两App消费路径见§9a；所有旧hotUpdate字段/descriptor/public export/test support/admin port projection/developer README一同rg查全，不能只改类型。

## 10 · 数据迁移

无PG/Flyway/seed改动。新update slice版本从空初始化；旧marker无可用生产消费者，不造迁移兼容层。
native records带formatVersion；未知格式拒绝并保留只读诊断，不静默加载未知路径。
APK升级不能清业务持久化；入口变更不能重命名业务slice键或替换储存namespace。

## 10b · seed、fixture与角色

### 10b.1 受影响seed全集
N/A_WITH_REASON：A不改变seed。可复用 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 中dual=term-front/mobile=term-handheld。
### 10b.2 改动分类
新工件fixture在run-owned仓内目录；不新增业务终端/activationcode副本；业务fixture使用当前automation已有helper。
### 10b.3 覆盖判据
无激活本地case不需DEV；恢复业务字段case需要fixture真实建立/读回，再改版本；不能用假selector值替代持久数据。
### 10b.4 同步项
manifest只记seedkey/terminalRef/storeRef/deviceId安全身份、artifacthash、packageId、action/session、进程身份；激活码/账号秘密/代理不落盘。
### 10b.5 边界
同时间一受管run；REQUIRE_INACTIVE；仅driver manifest身份与真实binding一致才回收；沿用当前helper而非另造cancel。
### 10b.6 父流程与角色
本机发布操作者=开发者，企业签名由授权配置；DEV业务fixture复用tools/terminal-automation/fixtures/managedActivation.ts→terminalActivation.ts→TDC acceptance/operationsFixture.ts。环境变量名为V2S_TERMINAL_DEV_MANIFEST、V2S_TERMINAL_DEV_HTTP_BASE_URL、V2S_SEED_OPERATIONS_DEFAULT_PASSWORD；operations actor由既有helper按seed合法操作人解析，不伪造会话。
未来实施先重开automation的fixture helper/seed中合法actor并确认当前值由受管配置提供再运行；本轮不索取秘密，也不假定已有管理员登录。
FULL/HOT fixture始终在同一managed run保持applicationId后缀、signature、storage；不调用当前每次生成新包名的另一个build run来假称覆盖更新。

## 11 · 验收场景设计

自动化端点只触发正式command、查询selectors、真实点击系统控件；zip经受管静态文件HTTP流式下载，fixture可切断/截断响应但不改owner执行核。
准备loader/installer/保护的native case在CP-03；高层owner行为Web先行在CP-02/05。该顺序不把原生特有行为虚构成WebPASS。

### 11a · 验收判据对照

所有行当前结果=NOT_RUN；F=focused源码测试，W=Expo Web，AND=安装application设备。不使用A表示执行面，避免与阶段A混淆。

| case（拟扩当前driver） | R/V当阶段子判据 | fixture/动作 | 可证伪业务断言 | 执行面/cleanup |
| --- | --- | --- | --- | --- |
| update.artifacts | R01/02；V01、V03本机部分 | 两App三产物、JS1.0.9/1.0.10，解最终签名APK/ZIP；保留metadata却替换入口、资源缺项/错映射红例 | 所有版本单源、FULL APK同字节；实际embedded入口摘要等于发布树入口摘要；assets/res清单与名称映射匹配；不比较AAPT转换drawable的原始字节；same-version不同内容拒绝 | 打包+F+AND；仅run产物 |
| update.baseline | R03/13；V02 | 不同App/runtime/native模块差异 | 拒绝HOT、无select/reload；未知identity不already-reached | F/W→AND；prepared释放 |
| update.archive | R03；V04/V30 | 穿越/symlink/duplicate/截断/超预算/无空间 | active不变；安全原因码、无越界文件 | F+AND；本action无引用文件 |
| update.fixed | R09；V14/V15局部 | 两屏并发、慢flush、冲突target/迟到读回 | 同boot1task；flush失败零port；固定不替换 | F/W→AND双屏；资源注销 |
| update.full-hot | R06/09；V08 A部分 | APK1JS3→FULL2JS4→HOT5 | 跨boot同task；真实APK/JS5且确认，非reload接受 | W状态→AND；同包签名，系统session收敛 |
| update.compatibility | R06；V09/10 | 同runtime APK1+HOT JS5→FULL2 embedded4→HOT6；外部更高APK替换 | 两个反例均先作废旧selection/previous/candidate加载资格并报APK_CHANGED_SELECTION_RESET；实际首boot只运行新embedded，旧token无效；中间JS4真实读JS5数据；固定HOT后续独立确认，不以目标伪actual | F/W→AND；数据/active保护 |
| update.install-result | R10/11；V16/17 | cancel/pending/仍存不可判定session/消失未安装/BUSY释放/读回失败/技术失败 | 取消及ENDED_NOT_INSTALLED回WAITING_USER、未标坏；下次呈现新action/session只邀请原工件；BUSY释放有出口；查询失败不当消失；仍存UNKNOWN不重复commit；旧回调不写新action，无手工retry | F/W→AND真实点击；unknown不得清session资源 |
| update.flush | R09/10；V20 | owner-only持久数据、故障flush | 应用前failed零commit/reload；真实重启恢复所声明字段 | F/W→AND；只清fixture数据 |
| update.offline-assets | R13；V21及embedded基线反例 | 两App先embedded asset/res禁网启动，再HOT file新图片/字体，去旧cache | 两条路径各自HBC/图片/字体离线可用；embedded无需复制整树；HOT新资源不回旧drawable/默认assets，字节码匹配真实nativeHermes | AND两App；留active/获准previous |
| update.interruption | R09/13；V22 | prepare/selection/install/reload中断；COMMITTING落盘后退出；API≥29可查询commit状态/API24～28无该API；模拟可控session移除后版本仍未达 | 半包不active；≥29仅明确未commit且合法可续接才继续同session；低API无法判定时UNKNOWN直到实际回收读回，无应用TTL或重复commit；两分支均在确证消失未安装后结束旧action→WAITING_USER→新邀请，不坏包；读回失败UNKNOWN；外部APK替换不复用旧加载记录 | F+AND；设备只验证Dexter批准的API范围，未选分支明确N/A_WITH_REASON，不能说已运行；只stop本run拥有tree |
| update.boot-guard | R14；V23/24 | primary成功/内容失败/停顿/旧boot迟到/同Activityreload | 每candidate新T，hide非confirm，旧token不确认；一次恢复 | F+AND双屏；deadline/executor释放 |
| update.rollback | R14；V25/26 | confirmation前数据写入、新native不兼容、确认后断网 | 旧成功包读数据/finite恢复；没安全目标可见失败；普通HTTP不回退 | F+AND；失败identity保留 |
| update.recent | R15 A局部；V27/28局部 | FULL成功HOT失败、unknown实际读回 | recentStatus真实；APK/JS分别显示；不伪报告CBS | F/W→AND；订阅注销 |
| update.cleanup | R03/10；V30 | 清理失败/unknowninstaller/active资源 | 安全关联日志；cleanup失败不能完成，active/他run不删除 | F+AND+managed；精确ownership |

全部case跑两application；AND至少mobile与单机双屏。涉及actor/state的同case W先于AND；两个机器配对/同步归C，A不声称四拓扑完整通过。
V05/06管理、V07最新规则、V11/12投递、V13主副、V18 N提醒/V19 M判闲、V29后台为B/C，详设只保存接口不标A完成。

## 12 · 未决项处置

APPROVED_STANDARD_SYNC_PENDING：Dexter 于本轮批准取消激活引发的根级 state 清除例外，唯一触发是 terminalDataClientActor 的 dispatchOfflineReset 调用 requestApplicationReset(TERMINAL_ACTIVATION_CANCELLED)（评审锚点L193，当前源码L199）。例外正文只落 doc/platform/terminal-coding-standard.md 的 TR-09；本轮不修改正本，未来实施授权下须在 CP-02 之前同步，focused/red 同时证明 update descriptor 实际持久三字段保留，ephemeral、其他 owner、orphan 仍清除，sync isolated 且 TDC 凭证不保留。topology 角色切换仅 flush 后 resetRuntime 重载 JS，不清 state、不作例外理由。已批准产品取舍无需再裁决；正本同步与 proof 尚未完成，不将批准写成现行实现或扩大适用原因。
正本同步必须同时说明 retain 按 slice 生效、不按原因过滤；当前生产根级调用点集合为 {TDC 取消激活}。新增任何 requestApplicationReset 生产调用点必须重新评审此例外。采用明确文字义务与 CP-02/后续相关 review checklist，保留既有字段 focused/red；不另加字符串扫描门，避免将 Runtime 测试中的其他 reset 原因误作生产触发点，也避免为当前单调用点增加独立门维护成本。
OPEN-LOAD：公开handler/资产布局在本仓尚未加载；CP-03工程单场景前置。
OPEN-NATIVE：Maven Hermes/ZIP依赖、企业签名/安装资格未解析；CP-01/03逐项确认。FULL 最低设备 API 须 Dexter 在实施授权前二选一：①限制为 API≥29，以公开 SessionInfo.isCommitted 判定是否调用 commit（仍核验 session 可续接状态）；②允许 API24～28，并接受无法判定的自有 session 在系统实际回收前一直 UNKNOWN，不能承诺等待上限或通过应用TTL释放。官方 API29 来源与 Android7/9 AOSP 启动读回时三天年龄阈值见附件§2；该阈值不是三天必回收 SLA，具体目标系统/OEM仍需核实。仓内静态min24不是本批已经选择的FULL最低设备范围；本轮不改配置、不代 Dexter 选择。§11a update.interruption 与 CP-03 采用获批分支。
OPEN-PUBLISH：两App的数据兼容发布证明与60s/ZIP预算未测；CP-04。
OPEN-AUTOMATION：当前源码已提供 agent/driver 主旅途接口，本轮未核验其验收完成状态；当前 update phase 不存在。§9a.3登记了实际 API 和待修源码输入，未来实施前重开修复后的公共 helper，update 能力仍由本批在同一 driver 内扩展；不据目录存在、作者报告或本次文档修订声称运行通过，不追加在途任务。
UI_CONTENT_ACCEPTED：Dexter 已确认系统安装/来源设置、启动加载、原生失败文本三个面的界面内容；UI/设备行为、全部新能力及 cleanup 仍 NOT_RUN。看图前置已关闭，不覆盖工程 OPEN、最低 API 决定或实施授权。
上述是明确工程/交互前置；本轮没有用计划升级为PASS。若关键公开能力不成立，应先修方案或求具体产品裁决，不能到实施末尾换目标。

## 13 · 停机条件

实际公开loader/资源/installer能力不能满足需求，或失败处置需变更已裁规则时，带原文和反例交Dexter；其他授权内根因修复不中止整批。
同failureCategory第二次出现冻结该族后续，读首败日志/owning path后focused复验；不用延长timeout/旧runner/假常量绕过。

## 13b · 实施节奏与三维对账

动态前静态准入≠CP退出MATCHED。完整CP focused后fresh独立对账，不能把文件拆成阶段；有OPEN先修同CP。
全部CP-01～05完成后，CP-06内先完成收尾code/fixtures工作，再做CP-06阶段对账与全批6b，才进入批次级整体验收。
后续纯报告更新不倒灌CP退出；实际生产/fixture修复触发受影响差量、6b差量、focused，不重复无关已对账范围。

## 13c · 逐代码与详设对账

交付前遍历本批新增/修改/删除的生产、配置、生成输入/输出、测试/runner，逐条对照§7/8/9a/11a，不抽样。
结果MATCHED/OPEN，不产GO；同批作者修复、独立复核；不得用各CP汇总代替全批6b/13c。

## 14 · 交付前自查

本轮只有文档与静态源码/官方来源检查；新增源码/生成/编译/verify/测试/DEV/Web/设备/cleanup均NOT_RUN。
内审最多两轮、盲读input/hash与作者intake另存；另一个Claude经Dexter做外部review，不替代内部fresh审查。
需求/源码/规范不改；没有reset/seed/UAT/L2/生产部署授权；已读来源和未测依赖明确区分。
