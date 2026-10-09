# TER 版本更新阶段 C：实施计划

## 0. 当前状态与授权

PLAN_STATUS=REVIEWABLE_DRAFT；IMPLEMENTATION_AUTHORITY=false；DYNAMIC_AUTHORITY=false。
Dexter 2026-10-09：只做常见主流程；只允许同 App 配对，覆盖 R-07 旧不同 App 句，需求正本只读。
来源：正式需求 R-01～15/§20.5、同日期 C 详设/附件/Journey/IA/UI；A/B相关出口待核实。Dexter当前只授权写文档；以下命令是**未来计划**，不是已执行或授权。本包IA内容已确认；已完成内部及外部旧字节review；当前为外部review后的作者修订，未产生新独立verdict，实施授权未获得，不进入实现。

范围一个原子批次、按 CP 顺序实现，不拆成多次交付。主agent独占写入，fresh子agent只读对账/review。不改在途B；B单机双屏动态收敛与其reset授权不扩为C授权。C所有生成/编译/测试/verify/Web/Android/pair/DEV/cleanup为NOT_RUN。

## 1. 开始条件与阶段 A/B 交接

1. 重开AGENTS/Blueprint/platform与scriptsREADME、全部kernel/deterministic以及design六维路由命中原文；读正式需求、本包全部工件、A/B最终批准设计及owning source。
2. C独立设计审查/intake、外部Claude review和单独实施授权齐备；Dexter已确认IA及当前低保真邀请内容，真实UI行为仍NOT_RUN，若内容改变须重新确认。A/B按各自已批准范围完成实施review及相关OPEN。不能要求无影响旧全量重新跑；只有接缝改变做focused。
3. 专门核对详设§0.1：真实createdAt穿透generated/owner/edge；报告POST/PG持久、UUID taskId一致、无taskactual报告、整snapshot/hash恢复；读回 B 最终 terminal_report 的 schema/table、state/reason 列/约束及 taskId=null 时 recent 非空是否合法，新枚举缺口按详设 §10 的具名现有表迁移条件处置；写明B当前代码/最终接口，而非引用历史PASS。
4. 当前durable既存task若缺固定N/M：只有能读回原规则策略才可按其续接；否则列具体BLOCKED交Dexter，不能猜默认、清任务或长留legacyfallback。
5. 第三方实际解析图/API、API≥29安装设备、两App签名/embedded/publication，资源门/fixture身份均具备。明确真机/虚拟机 serial 与 API≥29；核 PackageInstaller、来源设置、双屏真机 display、pair 虚拟机 laptop 单屏资格及 CBS/TDS 现有 reverse；缺口停 CP-01，不换方案/减分母。已有依赖版本漂移先修受影响设计，不临时升级。

## 2. 每点与每阶段工作纪律

每个实际编辑前依RECALL重开需求条款、IA/交互、六维命中、owning source/复用先例；编辑后focused proof，再以同原文逐项读回。CP内每文件不另设review关卡；整个CP完毕fresh三维MATCHED后下一CP。各CP记录实际symbols/变更/focused范围与失败根因。

固定任务不能因review引入取消/抢占/限时；source事实可推翻设计假设，先intake比较更小方案。产品取舍/新范围交Dexter。已确认问题抽象成明确失败模式，优先落现有测试/checklist，避免新增治理平台。

## 3. CP-01：前置与公共形状

RECALL：需求R01/06/07/09、A当前比较/boot/§14差量、B§8/接口附件、C§0.1/6/8.1/9a、TR01/03/09。

1. 只读确认A/B相关出口和具体OPEN关闭。未关闭停本CP，不在C偷偷修B。
2. 复用比较原语，增加纯选择器/有限拒绝理由；tuple createdAt DESC/规范UUID DESC，application/scope先选、runtime后比较，不暗选旧规则。
3. 固定policy形状N秒/HOTstrategy/M秒、origin context/boot/role；无任务/已达到不持久假任务，第一次port前flush固定。
4. 定义最小UpdatePort presentation/read/subscribe/恢复确认与trusted-summary prepare typed形状，defaultUnavailable/两App provider/两adapter consumer原子列清；不新增loader或CBSoperation。
5. 保留现有 topology moduleName/protocol 准入，仅同 App；记录同步只有 rules；容量上界详设§8.6和附件§4。
6. 更新公共exports/README/invariants/selector注册；canonical真变更才按materialize→codegen→terminalgeneration，不手改generated。

focused：选择/同time/JS整数/更高APK不兼容/同JS异pub/空集合zeroport、实际embedded vsHOTpub；旧taskpolicy缺失failclosed；typed契约所有consumer。完整CP独立三维MATCHED。

## 4. CP-02：本机点击与生命周期

RECALL：需求R07/12、C§8.3/5、Runtime资源、SurfaceRoot/实际keyboardportal、TR11、RN0.86.3/RNW0.21.2版本源码。

1. Runtime isolated/ephemeral lastClick＋revision、公开record command/selector；actor取clock，新JS播种now，不信任外部时间。
2. render统一responder起点观察且returnfalse，不吞原动作；共同portal只补其承载一次。两屏共用，双机不sync。
3. 技术presentation事件由UpdatePort桥转换本包command，首值播种/同值去重/跃迁发；先订阅再初始read/reconcile/evaluate，防异步初始化窗口。
4. registerResource/AsyncResource接timer/订阅与释放；failure聚合保身份。无页面挂载仍生效。

focused：内容/admin/keyboard/SECONDARY原业务结果＋clickrevision；初始化期间上下文变化、旧Runtimecallback、disposefailure、newbootbaseline；模块type/test/lint按owned入口。完整CP MATCHED。

## 5. CP-03：同核自动执行与N/M

RECALL：需求R09～14、C§8.1～5、A owner/native installed/session/boot、B N/M单位/报告reason。

1. 常驻桥只基于必要selector变化emit evaluate；oneinflight，candidateawait后重读最新scope/hash/boot/role资格，固定后不重选。
2. 接既有accept/fixed task执行核；补policy阶段 waiting-idle/prepared/邀请必要观察，不新任务账本。直接复用 currentTask.bootId 为执行 boot，不新增字段；本 boot 首次 prepare/apply 前更新并 flush，覆盖 prepared 直接 apply 和跨 boot 续接；删除确认时 L710/L1006 的覆写，L969 也只恢复 fixed、由执行接缝更新时间。详设 §8.2 全部五写点/两读点逐项回读；仅执行前更新，确认旧结果不占新 boot，S1 FULL→S2 HOT→S3 可选新规则；续接优先。
3. HOT准备完IMMEDIATE直接flush/apply，IDLE本机lastclick＋M单deadline；timer identity/点击同刻/提交前revision双读；后台resume仅重算。
4. FULL初次立即沿A apply，native决定silent/系统确认；waiting-userN调度local邀请；稍后/取消继续等待，known pending-user 且 exact confirmation 可恢复时 N 后允许再邀请，恢复同 session 零 commit；正在安装/显示则不重复，UNKNOWN 仅回读；endednotinstalled 回 waiting 后用户确认才新 action。旧 native foreground 自主呈现统一归 owner 调度，避免双源。
5. confirm/defer公开localcommands核task/action/boot；flushfailurezeronative；等待不会超时变failed或开启第二规则。

focused：完整FULL→newboot→fixedHOTidle→S3确认并允许新规则、同执行boot二次accept拒；newrule/disable/role/断链不改target；foreground/sysui/N同一action；M点击/flush/late events。Kotlinfocused必要时未来通过受管入口，不在当前文档会话跑。完整CP MATCHED。

## 6. CP-04：同 App 主副投影与下载

RECALL：需求R07/15、C§8.6/7、state record sync、Topology HELLO/pairByHost/controller、TDC grant MASTER边界、Preparer现有ZIP摘要/清单。

1. update同slice record get/apply只rules＋nonsecretcontext，localtasks/actual/failed/reports不覆盖；MAIN权威，blank/tombstone资格正确。
2. 两composition分MAIN/B readiness，BRANCH用当前connection所需projection及matchingcontext，不伪active/flushed；先订阅再检查。
3. 保留两App各自同 moduleName/protocol 配对规则及 VICE/CHIEF 业务 placement；不同 App 明确拒绝，不建 compatibility matrix、不为这次新增协议版本。按详设 §8.7 表核物理 PRIMARY 与本机更新 scope。
4. BRANCH peer source command→MAIN核pairorigin/scope/固定artifact身份（不要求仍在最新启用集合）→TDC issuegrant，返回compactsummary；不把fullmanifest塞wire。不传credential、不把reportpeer。
5. 同 Preparer 验 ZIP 摘要；HOT 读 ZIP publication JSON；FULL 沿 summary.apk 的 path/hash/certificate 解单 APK、验身份/signer，不解析未安装 APK embedded publication JSON，summary 仅重建 platform/applicationId/nativeVersion/nativeBuildNumber/apk，安装后 boot metadata 读取仍保留。沿原校验/安装链，不改 ZIP 格式、不新下载器。网络/proxy 一次 attempt 输入，不持久 grant。
6. lategrant/换peer/新连接/空间变动精确identity；过期只重取同artifact，失败有限，不引入恢复队列。

focused：projectionempty/failed/stale、本机事实保持、两个App分别同App配对/不同App拒绝/业务保护、manifest较大compact信封/FULL单APK与HOT清单分支、同前缀/旧binding拒绝、副机零reportrow。完整CP MATCHED。

## 7. CP-05：呈现与唯一自动化场景源码

RECALL：C Journey/IA/UI、§3a、primitives/ui-state/render LayerStack、automation正式需求/skill/API/B supplyhelper。

1. IA内容已确认；实施若改变该内容需重新交Dexter。UI只用existingprimitive/local placement 与 update selector/command；复用 alert tier，仅新增 local-primary scope，ephemeral 层沿原 serializeLayer 不持久/不 sync。BRANCHlocal update layer不被MAIN投影或businessmask隐藏；localadmin优先可恢复。
2. TestIds统一附件§5，品牌类型不cast，实际Button/Text节点；两个Appresponsive一致。
3. 先做控件focused/TestId及fresh前置复核，之后才写脚本；任何UI/control change准入重新BLOCKED。
4. 扩唯一runner的C显式case/suite、Web/Android共享businessJourney、pair双session能力；peerDeviceSerial已有字段但当前只capabilities允许，明确扩到update.pair，未实现拒绝。不要复活tools/terminal-topology/run-dual-device或旧display/keyboardrunner。按详设 §10b.6.1 扩现有 androidDevice/connection/cleanupRecovery：MASTER 同 topology 固定端口 forward，SLAVE 裸10.0.2.2沿原 pairByHost；不在副机 topology port 建 reverse，避免配对前本机 host 冲突；setup/HTTP/HELLO/映射占用先 focused，不能绕过准入。pair 用既有单 display 映射但 application surfaceForm=laptop，普通 mobile 仍 mobile；显式 serial 和四种 deviceRole 写 manifest。
5. 管理动作复用 B §15.2a 已有 `terminal-automation` → `update.supply-chain` 同父run与 `terminalUpdateSupplyUi.ts` helper，不另起后台入口或第二managed run。后台各自session/role通过Playwright完成上传解析保存、规则新建启用、报告页detail/history；TER React操作走agent，安装系统UI仅driver窄例外。父run统一拥有并回收新建browser/context/session、设备/reverse/forward/安装/绑定；只借用DEV-owned Vite/tunnel。CP-01先重开B最终argv/fixture/资源交接，CP-05沿同入口加入自动eval断言；selector/request观察动作前无空窗。
6. run资源预算profile/run根/health/format登记随新入口在本CP完成，不等CP-06；manifest扩两设备/APP/context非秘密身份、forward/reverse 的 local/remote/serial/runId 和 cleanup，setup 即登记、预算/首败统一；清理先两端 session及本 run reverse 后 MASTER forward，只删精确匹配本 run，红例证明未知映射不删和部分 setup 失败也清理，以ownedserial/device/PID/starttoken控制。

focused：邀请N重复/稍后/identity失效/焦点及admin恢复、脚本动作oracle不response.ok/targetversion、双session/param解析/forward与reverse部分创建失败及身份变化拒删/cleanup失败。完整CP MATCHED。

## 8. CP-06：数据/脚本与整批静态收口

RECALL：C§10b/11/11a、scriptsREADME、实施模板6c、Bseed/API/canonicalscope。

1. 与当前seed契约按key核fixture，无新独立终端/复制activationcode；报告主体任务历史合法保留，主机才激活；pair两设备共享组织但副机无TDScredential。
2. 合法fixture准备/回收表逐case填写，normalN5/M10分钟、边界只focusedfixture；真实至少1分钟，禁止临时M0。
3. final类型/ownedtests/相关静态机械门和native编译核对：仅本批受影响类型/生成/框架/TestId/代码布局/资源脚本；不跑无关全仓verify或重复不变proof。rootverify若后续明确要求才执行，其结果单列不得假PASS。
4. 场景/testid/source/seed/contracts/API/driver/readme/skill原子读回；源未变化不重复旧CP独立对账。
5. 清理构建临时产物/formatter结果归当前ownedrun，读取日志首败。当前CPfocused不依赖后续完整DEV/device验收。

完整CP独立MATCHED。随后另开全批6b独立三维，不能把六个CP结论汇总代替它。

## 9. 动态前整体准入（未来授权才执行）

- CP-01～06 MATCHED＋全批6b MATCHED；本批设计review、新UI确认、§3a UI/TestId/控制面准入和所有运行身份/预算OK。
- 无额外DEV/reset/seed隐含授权。未来受管backend-acceptance授权按AGENTS自动包含先停identity匹配DEV，testbusiness/cleanup均PASS才恢复原DEV；不是reset/seed授权。
- 如Dexter另授权reset/seed，先当前字节完整seed dry-run PASS及上述门；managed reset→DEVstart→fullseed独立证据。未授权不得执行。
- B单机双屏范围只B；C 的两 integration Web、console 真机双屏、wallpaper mobile 虚拟机、每 App 同 App 双虚拟机配对应在 C 授权中明列；设备不可用保留NOT_AUTHORIZED/NOT_RUN，不减分母宣称全专项完成。

## 10. 整体验证顺序与真实链路

1. 相关types/compile/ownedfocused为最低证据；不把它当Web/native/DEV通过。已有A/B无影响源码proof复用时记录原source/run/scope而非假本轮新PASS。
2. **TR-16**：非adapter自动选择/点击/N-M策略/报告策略先两integration ExpoWeb同§11场景通过；update.pair 只 F（双 Runtime codec/投影 apply）→双虚拟机 P＋H，TR-16 adapter 例外：Web topologyHost unavailable，不新造 Web topology 模拟。Web测试port仅automation构建；actual/install/Hermes均不以Web模拟证明。
3. 有新增/改HTTP行为才跑受管backend-acceptance的精确update相关场景；未改BHTTP可引用适用范围并在真实供给链做当前readback。CBSJava/PG/assets远端，本机仅允许的Vite/browser/TERdriver，禁止本机Java/PGtunnel。
4. 同DEV end-to-end：两App实际build产物→运维真实上传/解析→保存→运营PROJECT有capability新建启用规则→真实topic/HTTPsnapshot→**terminal自动eval**（不可fixtureaccept代替）→console 真机双屏 actual FULL/HOT（wallpaper mobile 虚拟机核同主流程）→运营报告/任务历史。后台actor各自session；TERinstaller设置由系统用户权限，不用后台admin冒充。
5. 设备同清单按交叉覆盖，依次 console 真机双屏 1 run→wallpaper mobile 安卓虚拟机 1 run→console 同 App 双安卓虚拟机 1 run→wallpaper 同 App 双安卓虚拟机 1 run，共 4 个设备 run；两 integration Web 各 1 执行计划在前，13c 在后。pair 测同 App 不同版本、两个显式 serial/本机 Runtime 独立/N-M/admin恢复、MAINonly HTTP报告；不同 App 拒绝仅静态＋既有 focused，不进设备分母。优先共用最小功能清单，原生差异才扩；不为C重跑A未改loader全部极端输入。
6. 日志读取firstfailure/lastgood/brokenboundary，business与fixturecleanup/runnercleanup分列；相同failureCategory第二次先冻结该族，回source最小修复、focused关闭后续，不盲延timeout/重复执行。源码未改不重跑相同失效case，run持有期间不改源码，一时一个managedrun。
7. 全部按详设11a逐条currentbyte结果，不只N/N；当前字节最新运行/最后通过（是否同字节）两行。无法覆盖正式V04恶意归档范围继续NOT_COVERED，不能称全V01～30PASS。

## 11. 交付前13c与IMPLEMENTATION review

全批生产caller/状态/command/selector/port/adapter/同步/生成/UI/fixture/driver原子组fresh逐代码↔详设对账MATCHED；修改后只复核影响scope，已对账无变化不重复。

然后fresh整批REVIEW_TARGET=IMPLEMENTATION独立review依据真实当前source、用户操作、实际evidence，GO/NO-GO M/S/N；设计无判据问题记DESIGN_GAPS；不设轮次上限。最终由Dexter和Claude review，不把本计划authorSELF_DECIDED当实施GO。

交付：source/API实际版本、CP/6b/13c适用范围、每scenario业务/cleanup、未运行项、finalactualMAIN/BRANCH本机读回（CBS无副机报告）、A/B继承边界。按项目可复制中文brief。所有终端/系统/runner资源精准回收，DEV是否保留以未来授权为准，不自行reset/seed。

## 12. 完成条件

本轮文档任务：仅修订六份工件＋本轮 -codex intake；保留 R1～R4 和外部旧 SHA verdict，不重开内部审查。五项 N 与执行面裁决的作者处置、新 SHA 与未验证项明确；真实UI未验证与A/B未验收保持明确OPEN，不能声称C设计GO或实施已获授权。未来实施任务须目标/适用场景business及cleanup关闭、交付review，不以阶段性PASS结束。
