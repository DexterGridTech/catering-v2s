# TER 版本更新阶段 C：实施计划

## 0. 当前状态与授权

PLAN_STATUS=IMPLEMENTATION_AUTHORIZED；IMPLEMENTATION_AUTHORITY=true；DYNAMIC_AUTHORITY=true（仅本计划 §10 批准场景及四个指定 Android 设备 run）；RESET_SEED_AUTHORITY=false；L2_UAT_PRODUCTION_AUTHORITY=false。
CURRENT_TASK_AUTHORITY=DEXTER_2026-10-10_STAGE_C_IMPLEMENTATION_SHARED_CREDENTIAL_REVISION。
Dexter 2026-10-09：只做常见主流程；只允许同 App 配对，覆盖 R-07 旧不同 App 句，需求正本只读。
来源：正式需求 R-01～15/§20.5、同日期 C 详设/附件/Journey/IA/UI；A/B相关出口实施前核实。历史设计阶段仅授权写文档，以下命令当时属于未来计划；该历史状态不代表执行结果。Dexter 于 2026-10-10 明确授权先完成阶段 B R3 剩余 S-1 的 focused 修复/差量对账，随后进入阶段 C 实施，并执行本计划列明的适用动态验证。TER 动态面限两项 integration Expo Web 与四个指定 Android 设备 run；不授权 reset/seed、L2、UAT、生产部署、商店发布或阶段外功能。本授权不重开已关闭的 DESIGN cycle。旧评审 verdict 仍只对应其记录的冻结字节，不能当作当前实施证据。

范围一个原子批次、按 CP 顺序实现，不拆成多次交付。主agent独占写入，fresh子agent只读对账/review。不改在途B；B单机双屏动态收敛与其reset授权不扩为C授权。C所有生成/编译/测试/verify/Web/Android/pair/DEV/cleanup为NOT_RUN。

Dexter 2026-10-10 追加本阶段设计职责：新增kernel/feature/project-basic，接管store-basic的项目/大区/商业集团资料及base/terminal-update的项目规则业务数据链。store-basic保留门店/经营规则/合同/服务点，terminal-update保留本机更新执行和报告。project-basic选适用候选后发terminal-update公开local command，后者actor核验并执行；不得用selector变化代替跨包command。C搬移B最终源码，但不改B历史文档或CBS语义；本轮只修设计，旧SHA verdict不覆盖本次新增职责，内部已关闭cycle不重开。

共享凭证设计变更cycle=TER_UPDATE_C_SHARED_CREDENTIAL_DESIGN_2026_10_10已两轮结束；提案仍PROPOSED，不作为正本。Dexter最新relay已明确授权按当前阶段C详设/计划完成正本维护、源码、契约生成及适用动态验证；**当前实施已授权并进行中**，不是仅文档任务。当前 CP-01 先按详设§12.1维护正本与本计划执行边界，随后进行 canonical→materialize→codegen 和 owner 源码实施；不重开任何已关闭设计cycle。

## 1. 开始条件与阶段 A/B 交接

1. 重开AGENTS/Blueprint/platform与scriptsREADME、全部kernel/deterministic以及design六维路由命中原文；读正式需求、本包全部工件、A/B最终批准设计及owning source。
2. C独立设计审查/intake无阻断后按Dexter本会话明确委托继续实施；本差量先闭合详设§12.1正式正本维护与当前授权记录，不把PROPOSED提案当已接受需求；Dexter已确认IA及当前低保真邀请内容，真实UI行为仍NOT_RUN，若内容改变须重新确认。A/B按各自已批准范围完成实施review及相关OPEN。不能要求无影响旧全量重新跑；只有接缝改变做focused。
3. 按详设 §0.1/附件 §2 的 2026-10-10 截面读回 B：规则自身 createdAt 已贯通，CBS POST/ReportOwner/PG 表和 UUID taskId 已存在，不重复实现。先关闭涉及本批接缝的 B 修复依赖：同 binding counter 不因 context 重置、无 task 自然 observation、报告结果处置/状态投影、候选 await 后准入及当前绑定复核；规则快照有限重读随最终搬移链核验。无任务 observation 由同一报告 descriptor 的 lastObservationFactsKey 按 binding/context 内实际版本事实去重（排除 bootId），context 变化允许 taskId=null 新观察且绑定周期序号保持单调。当前表 actual/recent 是 JSONB object，允许 observation；C 新枚举默认零 SQL，只同步 canonical/generated/controller 校验/消费者，若最终 SQL 真变更才据实处置。不能将静态存在或局部修复当 B 整批 PASS。
4. 当前durable既存task若缺固定N/M：只有能读回原规则策略才可按其续接；否则列具体BLOCKED交Dexter，不能猜默认、清任务或长留legacyfallback。
5. 第三方实际解析图/API、API≥29安装设备、两App签名/embedded/publication，资源门/fixture身份均具备。明确真机/虚拟机 serial 与 API≥29；核 PackageInstaller、来源设置、双屏真机 display、pair 虚拟机 laptop 单屏资格及 CBS/TDS 现有 reverse；缺口停 CP-01，不换方案/减分母。已有依赖版本漂移先修受影响设计，不临时升级。

## 2. 每点与每阶段工作纪律

每个实际编辑前依RECALL重开需求条款、IA/交互、六维命中、owning source/复用先例；编辑后focused proof，再以同原文逐项读回。CP内每文件不另设review关卡；整个CP完毕fresh三维MATCHED后下一CP。各CP记录实际symbols/变更/focused范围与失败根因。

固定任务不能因review引入取消/抢占/限时；source事实可推翻设计假设，先intake比较更小方案。产品取舍/新范围交Dexter。已确认问题抽象成明确失败模式，优先落现有测试/checklist，避免新增治理平台。

## 3. CP-01：前置与公共形状

RECALL：需求R01/06/07/09、Dexter2026-10-10职责裁决、A当前比较/boot/§14差量、B§8/接口附件、C§0.1/6/8.0/8.1/9a、TR01/03/09/11及§4-F。

1. 只读确认A/B相关出口和具体OPEN关闭。未关闭停本CP，不在C改变B产品/后台行为；按详设§8.0读回store组织/合同耦合、update规则链及两assembly消费者，C已裁定的TER职责搬移在本CP进行，不把B原归属当成B未完成。
2. 新建project-basic标准owner包，按详设§9a.7列全package/模块/类型/actors/commands/slice/selectors/README/invariants及test。搬移store-basic组织路径、三个组织topic及项目加载门；合同与服务点留原包，合同不等待组织成功。搬移update规则HTTP分页/hash/订阅/接受/持久字段及刷新生命周期，复用既有校验，不复制算法。两assembly装配新包，移除旧组织/规则读面与descriptor，同步引用与测试。删除descriptor后不hydrate旧键，新包HTTP重建；不触发reset、不动fixed task/recent/failed/report，不增缓存迁移框架。
   具体门店/经营规则HTTP及flush成功后，store广播既有storeBasicInformationLoadedCommand；将store原no-op loaded handler改为自己的合同/服务点加载入口，删除广播await后重复初始化及store失败分支旧helper调用。project监听同一command，核具体store值、store.project.id、当前runtime/binding及flushed，才组织HTTP及flush→组织topics→规则完整页及flush→规则topic。两个listener同时启动各自下游，广播聚合可以等待，两包后续不能互等；不新增异步调度框架。project先注册再initialize；晚装时经initializeStoreBasicCommand请已成功store重发同一loaded command，store不重复首查，两包以当前身份/in-flight/完成事实去重，project loaded handler不回调initialize。未有本次门店成功零下游HTTP；重启重新门店首查，副机零HTTP/topic。本机loadReadiness不持久、不拿旧缓存冒充当前成功。
   定义project-basic公开selector及update公开local requestTerminalUpdateCommand，payload只一条ruleRef/hash/context/FULL-HOT摘要/N-M。feature→base依赖单向；assembly只用selector绑定提交前身份复核，base不import feature、不订阅业务规则。
3. 复用比较原语：project-basic纯业务候选选择tuple createdAt DESC/规范UUID DESC、application/scope先选；terminal-update actor实际版本比较/准入，runtime后比较，不暗选旧规则。
4. 固定policy形状N秒/HOTstrategy/M秒、origin context/boot/role；无任务/已达到不持久假任务，第一次port前flush固定。
5. 定义最小UpdatePort presentation/read/subscribe/恢复确认；prepare保留既有HTTP manifest输入，删为peer grant规划的trusted-summary新分支。defaultUnavailable/两App provider/consumer同组；不新增loader/operation。
6. 保留同App moduleName/protocol；project-basic两个record，update全isolated。“冻结TDC credential-only/plain/flush/角色及13项caller形状”在CP-01只指记录目标形状与调用者分母；除第7项所列CBS凭证头/body与生成链同步外，CP-01不要求TDC凭证持久化/同步或SLAVE调用门已经实现。protected→plain迁移、credential-only master-to-slave投影、flush后使用、SLAVE保持inactive/stopped但允许普通CBS HTTP及解绑前clear，全部在CP-04实现和证明；容量沿既有state-sync，不造peer grant信封。
7. 本轮CBS鉴权差量在本CP完成：同一terminal-binding VerificationApi/Service/Decision保留TDS原verify(Credential)设备匹配入口，增加CBS具名verifyBusinessCredential(BusinessCredential)无设备入口；共享事实查询/分类核，cancel仅删CBS设备认证，共用edge verifier/九GET/规则/grant/report/cancel的canonical头/body/error及catalog→materialize→edge-codegen→terminal generation→TDC实际caller原子同步，TDS codec/handler保持原verify入口/协议deviceId及拒绝行为，直接测试成对核验。保留bootstrap真实device绑定、owner scope/锁/事务/撤销/content grant；不复制认证器。正式正本依§12.1授权先维护。MASTER主流程CP-03使用更新契约；共享凭证完整生命周期在CP-04退出前关闭。
8. 更新公共exports/README/invariants/selector注册；canonical真变更才按materialize→codegen→terminalgeneration，不手改generated。

focused：用真实Runtime dispatcher同时安装store/project handlers，将组织HTTP保持未settle，确认store loaded listener内合同/服务点已启动且可保存；不要求广播聚合提前完成。门店HTTP或flush失败时组织/规则和合同/服务点首查均零；具体门店身份不符、hydrated旧值无资格；晚装重发相同command不重复门店首查、不递归、已完成下游不重复；重启/flush失败/分页hash/具体通知接受/旧scope隔离。store不再加载组织；旧字段不hydrate、fixed任务保持；两assembly单向依赖与selector/command调用。原规则 HTTP/topic 测试随已修正的生产分页链搬到 projectBasic.test.ts，update test 保执行/command准入；不同 context 同 binding 序号连续、自然初次观察与 HTTP 处置测试仍留 base/update。B 当前公开 accept 的 selectionContext 为 selectedSpace/contextIdentity/ruleRef；新增 requestTerminalUpdateCommand 是 C 差量，必须委托该固定执行核，旧规则转换链搬移后删除，不长期维持两个生产接受入口。选择/同time/JS整数/更高APK不兼容/同JS异pub/空集合zeroport、实际embedded vsHOTpub；旧taskpolicy缺失failclosed；typed契约所有consumer。新增CBS focused：无deviceId认证头有效credential通过，不同device信息不改变CBS鉴权；TDS正确设备通过、错误设备拒绝、缺失/非法device字段仍按原协议拒绝；两用途错secret、旧generation/撤销/错secret拒绝；cancel无device body且锁/审计/通知保留，activate真实device输入；13项catalog/两个具名认证用途及TDS现有consumer一致。完整CP独立三维MATCHED。

## 4. CP-02：本机点击与生命周期

RECALL：需求R07/12、C§8.3/5、Runtime资源、SurfaceRoot/实际keyboardportal、TR11、RN0.86.3/RNW0.21.2版本源码。

1. Runtime isolated/ephemeral lastClick＋revision、公开record command/selector；actor取clock，新JS播种now，不信任外部时间。
2. render统一responder起点观察且returnfalse，不吞原动作；共同portal只补其承载一次。两屏共用，双机不sync。
3. 技术presentation事件由UpdatePort桥转换本包command，首值播种/同值去重/跃迁发；先订阅再初始read/reconcile/evaluate，防异步初始化窗口。
4. registerResource/AsyncResource接timer/订阅与释放；failure聚合保身份。无页面挂载仍生效。

focused：内容/admin/keyboard/SECONDARY原业务结果＋clickrevision；初始化期间上下文变化、旧Runtimecallback、disposefailure、newbootbaseline；模块type/test/lint按owned入口。完整CP MATCHED。

## 5. CP-03：同核自动执行与N/M

RECALL：需求R09～14、C§8.1～5、A owner/native installed/session/boot、B N/M单位/报告reason。

1. project-basic常驻桥根据自身ready规则、当前资格及update公开actual/task selector发本包evaluate command；feature actor选最新适用候选，发update公开local requestTerminalUpdateCommand。update actor实际readback/比较，candidateawait后重读scope/hash/boot/role资格，返回no-update/rejected/fixed；一条候选、不复制完整业务列表，固定后不重选。base不自建规则observer/HTTP，assembly不以effect执行更新。两包运行态identity去重，task释放/newboot可触发feature本机检查；副机同样本机local command。
2. 接既有accept/fixed task执行核；补policy阶段 waiting-idle/prepared/邀请必要观察，不新任务账本。直接复用 currentTask.bootId 为执行 boot，不新增字段；本 boot 首次 prepare/apply 前更新并 flush，覆盖 prepared 直接 apply 和跨 boot 续接；删除 selected=null 成功与 action 结果确认时的覆写；reconcile 的 FULL→HOT fixed 仅恢复任务，由 executeNextArtifact 的首次执行接缝更新时间。当前锚点见详设 §8.2（L1045–1052、L1308–1316、L1347–1352），实施以符号重开。详设 §8.2 全部五写点/两读点逐项回读；仅执行前更新，确认旧结果不占新 boot，S1 FULL→S2 HOT→S3 可选新规则；续接优先。
3. HOT准备完IMMEDIATE直接flush/apply，IDLE本机lastclick＋M单deadline；timer identity/点击同刻/提交前revision双读；后台resume仅重算。
4. FULL初次立即沿A apply，native决定silent/系统确认；waiting-userN调度local邀请；稍后/取消继续等待，known pending-user 且 exact confirmation 可恢复时 N 后允许再邀请，恢复同 session 零 commit；正在安装/显示则不重复，UNKNOWN 仅回读；endednotinstalled 回 waiting 后用户确认才新 action。旧 native foreground 自主呈现统一归 owner 调度，避免双源。
5. confirm/defer公开localcommands核task/action/boot；flushfailurezeronative；等待不会超时变failed或开启第二规则。

focused：完整FULL→newboot→fixedHOTidle→S3确认并允许新规则、同执行boot二次accept拒；newrule/disable/role/断链不改target；foreground/sysui/N同一action；M点击/flush/late events。Kotlinfocused必要时未来通过受管入口，不在当前文档会话跑。完整CP MATCHED。

## 6. CP-04：同App凭证/业务投影与直接CBS下载

RECALL：本会话共享凭证/CBS仅凭证裁决、详设§8.6/12.1、原副机只读admin/R15、state record/flush/plain迁移、topology角色转换、generated catalog。

1. project-basic两个业务record和当前资格/tombstone保持；update全isolated，本机task/actual/failed/report不覆盖。BRANCH新candidate依当前connection业务projection，不作为普通HTTP资格。原store组织读取换project-basic。
2. 原TDC slice的credential改plain＋master-to-slave单record；六字段或null、完整key/值验证、updatedAt=0/既有connection-revision控制顺序。不复制active/TDS/topic/remoteOperations、不增加credential store；SLAVE保持inactive/stopped。复用state engine旧protected同key→plain成功→删旧，不新造迁移层。
3. TDC模块先订阅再检查，owner command等待flush并重核完整credential/role identity后才HTTP；MASTER仅发布已保存值。保存失败阻断新值/typed失败可见，reload恢复已保存SLAVE凭证资格而不connect。initial required projection接线纳入credential，普通HTTP不得要求MAIN在线。
4. 十类普通CBS HTTP允许两端，activate/cancel/report/TDS仅MASTER。显式unpair/换MAIN/TOPOLOGY_UNPAIRED经composition解绑前TDC clear command清凭证并flush，成功才角色转换/接新MAIN；失败不推进，旧connection apply失效。瞬断不清，零新root reset；副机admin取消激活只读不变。
5. 各机update调用本机TDC grant；删requestPeerTerminalUpdateSourceCommand caller/handler/exports/tests及compact摘要，不留fallback。CBS短期download grant/content复核保留。grant只attempt，发起/返回核任务/工件/来源空间及credential/network配置；瞬断不阻fixed请求，解绑后零旧凭证请求，报告仅MAIN。
6. 完整HTTP manifest沿原Preparer：FULL apk.path/hash/cert及ZIP摘要→extractFull/validateFull，HOT publication/entry/files。无peer summary新分支/格式/loader/下载器，安装后boot metadata路径保留。

focused：双Runtime只一credential entry且无其他TDC字段；null/非法/旧revision；MASTER flush前零发布/HTTP，SLAVE保存失败零HTTP；plain成功才删旧key、失败保旧；reload SLAVEinactive/stopped但直读/下载，MASTER停机零peer grant；显式解绑/换主机/旧connection迟到不带借用凭证升MASTER；13项caller/不伪active，MASTER取消后CBS拒旧binding，不声称离线即时清除。业务tombstone禁止新candidate但保fixed，本机task/actual/report保持；同App/不同App及普通FULL/HOT原测试复用，不加恶意归档专项。完整CP fresh三维MATCHED。

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

1. 与当前seed契约按key核fixture，无新独立终端/复制activationcode；报告主体任务历史合法保留，主机才激活；pair两设备共享组织和同一TDC credential，副机无TDS连接/独立激活/报告。
2. 合法fixture准备/回收表逐case填写，normalN5/M10分钟、边界只focusedfixture；真实至少1分钟，禁止临时M0。
3. final类型/ownedtests/相关静态机械门和native编译核对：仅本批受影响类型/生成/框架/TestId/代码布局/资源脚本；不跑无关全仓verify或重复不变proof。rootverify若后续明确要求才执行，其结果单列不得假PASS。
4. 场景/testid/source/seed/contracts/API/driver/readme/skill原子读回；检查project-basic是唯一组织/规则owner、旧store/update字段/订阅/selector删除、feature公开command→update actor且零base反向import；源未变化不重复旧CP独立对账。
5. 清理构建临时产物/formatter结果归当前ownedrun，读取日志首败。当前CPfocused不依赖后续完整DEV/device验收。

完整CP独立MATCHED。随后另开全批6b独立三维，不能把六个CP结论汇总代替它。

## 9. 动态前整体准入（按当前授权执行）

- CP-01～06 MATCHED＋全批6b MATCHED；本批设计review、新UI确认、§3a UI/TestId/控制面准入和所有运行身份/预算OK。
- 仅复用当前受管DEV及已存在的合规fixture，不执行reset/seed；DEV start/restart不得隐式seed。若批准场景因缺少fixture而必须reset/seed，本计划当前授权不覆盖该动作，应停止在该具体进入条件并报告，不得自行清理或制造数据。
- 如本批受管后端验收入口按AGENTS要求联动 identity 匹配的DEV，先记录并受管stop；业务与cleanup均PASS后才按规则恢复原DEV。该生命周期联动不扩大reset/seed授权。
- B单机双屏范围只B；C 的两 integration Web、console 真机双屏、wallpaper mobile 虚拟机、每 App 同 App 双虚拟机配对应在 C 授权中明列；设备不可用保留NOT_AUTHORIZED/NOT_RUN，不减分母宣称全专项完成。

## 10. 整体验证顺序与真实链路

1. 相关types/compile/ownedfocused为最低证据；不把它当Web/native/DEV通过。已有A/B无影响源码proof复用时记录原source/run/scope而非假本轮新PASS。
2. **TR-16**：非adapter project-basic业务读取/topic更新→公开update command、自动选择/点击/N-M策略/报告策略先两integration ExpoWeb同§11场景通过；update.pair 只 F（双 Runtime codec/投影 apply）→双虚拟机 P＋H，TR-16 adapter 例外：Web topologyHost unavailable，不新造 Web topology 模拟。Web测试port仅automation构建；actual/install/Hermes均不以Web模拟证明。
3. 有新增/改HTTP行为才跑受管backend-acceptance的精确update相关场景；未改BHTTP可引用适用范围并在真实供给链做当前readback。CBSJava/PG/assets远端，本机仅允许的Vite/browser/TERdriver，禁止本机Java/PGtunnel。
4. 同DEV end-to-end：两App实际build产物→运维真实上传/解析→保存→运营PROJECT有capability新建启用规则→TDC真实topic→project-basic HTTP完整snapshot/flush→feature发update公开command→update actor固定/执行（不可fixtureaccept代替）→console 真机双屏 actual FULL/HOT（wallpaper mobile 虚拟机核同主流程）→运营报告/任务历史。同父run补项目/大区/集团资料更新子断言，用现有合法后台操作/权限及seed实体，不新增移店/移区场景；主机project-basic selector更新，副机投影selector一致，store合同/服务点及本机task不被覆盖。后台actor各自session；TERinstaller设置由系统用户权限，不用后台admin冒充。
5. 设备同清单按交叉覆盖，依次 console 真机双屏 1 run→wallpaper mobile 安卓虚拟机 1 run→console 同 App 双安卓虚拟机 1 run→wallpaper 同 App 双安卓虚拟机 1 run，共 4 个设备 run；两 integration Web 各 1 执行计划在前，13c 在后。pair 测同 App 不同版本、两个显式 serial/本机 Runtime 独立/N-M/admin恢复、MAINonly HTTP报告；副机plain共享凭证本机直连CBS、不依赖主机在线；不同 App 拒绝仅静态＋既有 focused，不进设备分母。优先共用最小功能清单，原生差异才扩；不为C重跑A未改loader全部极端输入。
6. 日志读取firstfailure/lastgood/brokenboundary，business与fixturecleanup/runnercleanup分列；相同failureCategory第二次先冻结该族，回source最小修复、focused关闭后续，不盲延timeout/重复执行。源码未改不重跑相同失效case，run持有期间不改源码，一时一个managedrun。
7. 全部按详设11a逐条currentbyte结果，不只N/N；当前字节最新运行/最后通过（是否同字节）两行。无法覆盖正式V04恶意归档范围继续NOT_COVERED，不能称全V01～30PASS。

## 11. 交付前13c与IMPLEMENTATION review

全批生产caller/状态/command/selector/port/adapter/同步/生成/UI/fixture/driver原子组fresh逐代码↔详设对账MATCHED；修改后只复核影响scope，已对账无变化不重复。

然后fresh整批REVIEW_TARGET=IMPLEMENTATION独立review依据真实当前source、用户操作、实际evidence，GO/NO-GO M/S/N；设计无判据问题记DESIGN_GAPS；不设轮次上限。最终由Dexter和Claude review，不把本计划authorSELF_DECIDED当实施GO。

交付：source/API实际版本、CP/6b/13c适用范围、每scenario业务/cleanup、未运行项、finalactualMAIN/BRANCH本机读回（CBS无副机报告）、A/B继承边界。按项目可复制中文brief。所有终端/系统/runner资源精准回收，DEV是否保留以未来授权为准，不自行reset/seed。

## 12. 完成条件

共享凭证/CBS鉴权已由Dexter纳入阶段C CP-01/04；两轮DESIGN cycle已关闭且不重开。按当前授权同步需求/规范、完成契约与源码、所有CP focused proof与阶段对账、全批6b、适用Expo Web及四个设备run、13c和fresh整批IMPLEMENTATION review；按授权边界不做reset/seed、L2、UAT或生产部署。每项未运行证据保持NOT_RUN，所有业务与cleanup分别关闭后交Dexter和Claude review。


本轮文档任务：仅修订六份工件及设计处置记录；保留旧C R1～R4 和外部旧 SHA verdict，不重开旧cycle。2026-10-10 project-basic实质追加范围使用TER-UPDATE-C-PROJECT-BASIC-OWNERSHIP-2026-10-10限定cycle，最多两轮；不是旧周期重置。归属及command→actor链纳入相应CP，历史五项N/执行面裁决保持；新SHA与未验证项明确。真实UI未验证与A/B未验收保持OPEN，不把作者修订称独立GO或实施授权。未来实施任务须目标/适用场景business及cleanup关闭、交付review，不以阶段性PASS结束。
