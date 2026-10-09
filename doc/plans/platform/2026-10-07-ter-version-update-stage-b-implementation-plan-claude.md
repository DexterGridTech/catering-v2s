# TER 版本定义、完整更新与热更新：阶段 B 实施计划

### 2026-10-09 · 本轮授权及执行面覆盖旧计划

本次 Dexter 已授权关闭阶段 A 的 `D-S-1` 差量并通过 focused proof 后，连续完成阶段 B 实施和适用验收。无需再次申请阶段 B 进入许可；不包括阶段 C。

本轮 TER 设备场景仅在一台单机双屏真机运行，console 与 wallpaper 两个 App 均覆盖详设适用判据；Expo Web、mobile、双机、双 VM 和全设备矩阵均为 `NOT_RUN` 或 `NOT_COVERED_BY_THIS_ASSIGNMENT`，不得作为 PASS 或交付前置。此执行面调整是 Dexter 对本轮的明确授权，不修改正式需求功能语义，也不推广为 TR-16 的全仓豁免。

两个管理后台的工件上传/解析/保存、规则配置和版本/报告历史查询，须由同一 `update.supply-chain` 受管 run 中的真实页面交互完成并读回真实 HTTP/业务结果。该链使用 run-owned Playwright 与 DEV 已有 Vite/tunnel；本轮不实现或运行独立 Browser L2 12-case 控制面/全量 suite，避免把已指定的真实供给链扩大成无关的完整 L2 批次。TER React 仍只经 automation-agent driver。必要生成、类型检查、编译、构建、focused tests 和相关行为门按 CP 执行，不跑默认全仓 verify 或未受影响的全量回归；运行与 cleanup 分开报告。

### 2026-10-07 Dexter 最新裁决（覆盖旧报告方案）

1. 报告存 CBS PostgreSQL，由 `terminal-update` owner 写入；运营右 Tab 可按门店和当前实际版本查询。Dexter 最终更正“仅包含启用”：范围为当前项目 **启用门店下的启用终端**，停用/作废均排除；未报告终端仍有列表行。显示门店名、终端名、实际版本、最新升级报告状态，点击终端打开标准详情 Drawer，显示最新报告及历史报告。
2. 上传成功且解析校验成功后才可保存；按钮名称统一“保存”，之前禁用。HOT 还必须选定与声明五事实完全匹配的最小 FULL。换文件、解析失败、stage 过期或上下文改变立即撤销旧保存资格。
3. 升级报告经 CBS HTTP 上报；失败正文缓存到升级 owner 的持久化 state。TDC 对有效匹配 PONG 发公开本机广播 command，业务 actor 消费后重试自己的未发送内容。TDC 不保存其他 owner 的失败正文，广播不证明 CBS HTTP 成功，不通过报告失败重连 TDS。
4. N/M 界面单位为分钟；InputNumber 正整数分钟 1～1440 为本设计的有限参数，canonical/API/持久字段仍明确为秒，提交乘 60、读取除 60，服务端检查 60～86400 且为 60 的倍数；正常 DEV 用 N=5/M=10 分钟，边界值只进 acceptance fixture。
5. 运维保留 APK、JS、runtime、构建号、applicationId、publicationId、摘要等真实技术字段；不得暴露凭证、下载 grant 或原始异常。
6. 规则详情增加“操作历史”，复用标准审计能力，不新建审计流水/弹窗容器/operation。

后续直接确认：“每个更新任务一条报告”。阶段变化更新同一任务记录，历次任务保留；每次 HTTP 重送与心跳不新增历史行。此前“包含启用和停用”的答复已被“仅包含启用”覆盖，不作为当前输入。

正式需求 R-15 中旧双后台、最后值而无任务历史、TDS 上报路径由上述直接裁决覆盖。该段记录的是原设计修订时状态；2026-10-09 Dexter 已授权本轮阶段 B 实施以及明确的执行面，现由本计划开头的本轮授权条款覆盖。正式需求与 `terminal-coding-standard.md` 的来源同步属于 CP-01。

## 0 · 当前状态与授权

STATUS=IMPLEMENTATION_AUTHORIZED@2026-10-09；IMPLEMENTATION_AUTHORITY=true；UI_REVIEW=ACCEPTED@2026-10-07_SCOPE_APPROXIMATE_IA_DYNAMIC_NOT_RUN。
正式需求、B详设/Journey/IA/UI/附件是本批输入。原文中 `DRAFT_READY` 与 `IMPLEMENTATION_AUTHORITY=false` 是 2026-10-07 的历史状态，由本条及 2026-10-09 Dexter 授权覆盖。先完成 Stage A D-S-1 差量 focused proof，再按 CP-01～CP-06 实施阶段 B；历史 PASS 不继承为本轮证据。

用户任务：运维上传/解析成功后保存真正 FULL/HOT；运营维护不可编辑项目规则及标准审计，查询启用门店下启用终端的实际版本、最新报告和每任务历史。主机保存完整规则供给，通过 CBS HTTP 上报并持久缓存失败；C 自动/双机不进入 B。

### 2026-10-07 Dexter 后台职责裁定（本批优先输入）

Dexter：“PLATFORM-REPORT这个业务……做成和RULE-LIST是一个页面，但是两个不同的tab，左边……这个项目中所有的更新规则，右边……这个项目中所有门店终端的更新状态”；随后确认：“运维管理后台，只定义终端的更新版本，运营后台才是规则与更新情况报告”。

platform-admin 只负责更新包/版本定义；operations-admin“项目终端版本管理”同页左“更新规则”、右“终端更新状态”。右 Tab 查询当前项目启用门店下的启用终端，包含尚无报告者；标准详情 Drawer 显示最新报告及按任务保存的历史。规则操作历史使用现有标准审计 Modal；仍只有两个内容页/两个路由，无手工任务重试或任务看板。

当前产品输入以“Dexter 最新裁决”节为准；旧 R-15 文字只作来源对照，不能恢复旧后台或旧报告通道。正式来源同步是本次实施授权覆盖的 CP-01 工作。

### 内部 DESIGN 历史与 Dexter 追加两轮授权

同一 cycle `ter-version-update-stage-b-project-tabs-20261007`：R1 原始 NO-GO 3M/4S/0N；R2 原始 NO-GO 2M/2S/0N，原报告和旧字节结论保留。主 agent 亲自核验后作最小文档修订，其处置不是独立 GO；SELF_DECIDED 不表示作者可以替 reviewer 出具 verdict。

Dexter 追加原话：“授权你再多两轮对抗性review，然后再给另一个Claude做review”。据此保留同一 cycle，追加 fresh 只读 R3、R4；不以措辞、文件名或产品范围变化重置轮次。随后明确：“如果第四轮还是NO GO，并且也是你确认的真问题，可以再增加两轮”。R4原始NO-GO 0M/1S/0N，主agent重开verification-governance§8、本文§10与详设§15.2，确认验收依赖顺序矛盾，条件已触发；同cycle完成fresh只读R5；R6尝试因agent thread limit reached未能创建，NOT_EXECUTED_TOOL_LIMIT/NOT_ISSUED。默认两轮不变，本cycle上限6只来自这两次直接授权；工具状态单列归档，不把R6写成已完成，不重开cycle，交外部Claude。

`ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION`；`REVIEW_ROUND_LIMIT=6`（仅本 cycle 的显式例外，R4原报告仍保留其当时上限4）。当前大致 IA 已确认，不重复申请。计数仍是 normal 设计假设，实际解析/SQL/UI/资源/运行仍 OPEN 或 NOT_RUN；本次不新增实施授权。

## 1 · 实施进入条件

1. 设计包已按既有授权接受；2026-10-09 Dexter 明确授权阶段 B 实施及本轮单机双屏真机/必要受管运行，不新增设计或进入许可前置。
2. 本次进入 B 的前置是本轮 D-S-1 修复及 focused proof 已完成，并只核实 B 实际消费的 A 接口/字节。该修复的 31 项包测试与类型检查已记录在同日 intake；它不代表 A 整批重新验收，也不阻止本次已明确授权的 B。
3. 重开 A 与 TDP/最新 automation driver 的真实公开能力，列出 B 接口差量和受影响消费者，不继承旧 GO。历史工具/运行证据按其原范围保留，不填成本轮 PASS。
4. 依赖/资源工具在CP-01核实，跨阶段新增接口只在本次明确授权范围内变更，不重做A已完成且未受影响的对账。

### 1.1 · reset 与真实完整链的当前授权输入

Dexter 2026-10-09 已授权阶段 B 所需的受管非生产 reset/start/完整 seed；只有在全CP及全批6b、适用准入、当前完整seed dry-run与资源身份确认通过后执行。两个后台的必要真实页面场景只取本链的 focused 范围，不执行无关全量 Browser L2 suite；后台 focused 业务结果与同 DEV 真机更新链分别报告。C 自动择新/闲时/副机仍不实施。

## 2 · 实施纪律

主agent唯一写入/运行；只读fresh reviewer按完整CP审查。每点写前重开原需求/IA/六维命中记忆/规范/owning source/可复用能力，focused后同组原文回读。CP内不按文件另拆审查；阶段所有点和必要修复后fresh三维MATCHED再下CP。发现同根失败先扫描整个有限输入/消费集合，最小修复＋真实red，不添加通用恢复框架。失败保留日志，禁止重复盲跑/延时救绿；business与cleanup分列。

### 2026-10-09 · A 差量修复完成与避免极端设计

阶段 A 的 D-S-1 非成功 readback boot 占位问题已由主 agent 修复并以同包 focused tests/typecheck 证明；证明及首败修正记录在 `doc/review/platform/2026-10-09-ter-version-update-stage-a-non-success-readback-intake-codex.md`。本记录只关闭该差量，不冒充 A 整批 review 或重跑。按 Dexter 同日授权，完成该 focused proof 后立即进入 B；CP-01 只重核 B 实际消费的 A 接口/字节，已 MATCHED 且未受影响部分不重做。

ZIP 改用 JDK ZipFile，取消 Commons Compress、ZIP Unix symlink/截断中央目录/炸弹专项和专用测试 seam；保留清单、摘要、普通路径、实际读取大小、签名、身份与私有下载鉴权。正式 V-04 更宽的专项仍 NOT_COVERED/NOT_RUN，不宣称全部通过。D-41 的仓根输入符号链接逃逸门继续保留，它与 ZIP 条目专项是两个问题。报告 HTTP/pending/PONG、合法并发 grant、完整快照与当前 boot 身份隔离按已接受设计实施；不增加通用恢复框架。

## 3 · CP-01：A交接、契约与可执行输入

1. 根据详设0.1/附件2读取A最终工件与源码/验收面。确认有效 FULL ZIP 打包与解出 APK 消费、pub/ZIP身份、native/embedded 与 HOT actual 身份分开、成功 HOT 冷启动后的当前 boot 就绪、FULL UNKNOWN→真实成功后的固定 HOT 续接，以及 A 六端口与 provider 最终签名。当前 recentStatus 仅四字段、终态 task 新 boot 释放、strategy 仅技术参数的事实要按详设0.1记录；B 不把它们误称完整报告关联或 N/M 调度。阶段 A 的 D-S-1 差量已在本轮 focused proof 关闭；核对 B 消费的接口与其余已批准 A 接缝，发现问题只按本轮 A 差量授权及 B 接口边界处置，不把未受影响的 A 整批历史验收重新设为门。
2. 原需求＋最新直接裁决→canonical/openapi-source/IAM/admin-catalog→materialize→edge-codegen→terminal generator/Java/TS。冻结完整18项HTTP roster、报告body/receipt/错误集/鉴权三头、具名PROJECT规则审计及平台工件审计类型与既有标准读取扩展；protocol只新增规则topic，不新增版本report/ACK。新增的两条运营规则命令同时闭合 M1 emitter，并由 generator self-test 检查具名 wire/adapter 调用形状。**时序修正：**这两条生成方法依赖 CP-03 才落地的 `CreateOperationsProjectTerminalUpdateRuleOperation` 与 `ChangeOperationsProjectTerminalUpdateRuleStatusOperation`；因此 CP-01 验证 canonical/consumer 生成闭包及独立生成源，CBS `compileJava` 延至 CP-03 两个真实 adapter 建立后执行，不创建空 adapter 以提前通过编译。CP-01 在生产消费前同步正式需求R-15及终端标准§4-F心跳重试规则与适用记忆。
3. 落实详设§5真实getOperationsOrganizationCandidates PagePaged与新第15项getOperationsProjectTerminalUpdateRuleStorePage CursorPaged合同、DTO/排序/权限；验证停用/作废固定refs读回，不将协议选择留到实施期。
4. 解析工具/依赖：核 Java 21 实际版本及 JDK ZipFile entries/getInputStream/close 官方依据、Minio实际版本、AndroidBuildTools36.0.0候选部署、官方tag/source/工具校验。证明普通有效工件读取/签名/metadata/res映射及普通无效输入拒绝；不安装 Commons Compress，不造 ZIP 专项解析 seam。定位r5预算profile/principal/dependency/cache路径，不在Flyway安装SDK/创建bucket。
5. 当前受管resource profile中保存B用既有runner的kind/运行根，不能造第二runner。版本选择与永久工件业务数量无上限；技术预算明示/红例。生成src和registry同步、focused/check/adversarial完整CP对账。

退出：B实际消费的A交接接口已核对；canonical与现有consumer生成输入闭合，独立生成产物通过其生成器检查；依赖/预算准入和有限红例结构明确；M1规则adapter的全模块编译按上述时序在CP-03真实adapter落地后证明；完整CP-01独立三维对账为MATCHED。后续整体验收不回流到该CP。

## 4 · CP-02：真实工件与私有asset

1. 新terminal-update模块/schema/api/persistence/receipt/audit接入唯一CBS；asset具名ZIP stage/claim/private stream扩展而非新平台。
2. 按详设8.1实现stream/hash/bounds/JDK ZipFile及工具验证；签名APKmetadata对应真实bundle/res；解析I/O不在TX，资源close与失败cleanup可见。只在现有 parser 测试中覆盖正常有效 FULL/HOT、坏摘要、缺文件、路径/大小与签名拒绝；不新增恶意归档专项库、解析框架或测试入口。
3. stage→register transaction原子claim、全局pub同version内容冲突、samecontent跨space、HOT固定FULL五字段；未验收包不变可用对象。
4. 私有bucket隔离publiccontroller/anonymouspolicy；不泄露URL/key；stage行保存创建者actor_type/actor_id，register/release按当前actor和workspace复核。stage发给asset owner的幂等身份由workspace、actor、客户端key摘要派生，保证同owner重放稳定而不同actor不能复用/旋转同一asset grant。缺失或异workspace stage按404隐藏；同workspace非创建者按`TERMINAL_UPDATE_STAGE_NOT_OWNED/403`拒绝；不增加SQL往返。
5. owner/parser/assetdirecttests＋真实HTTP acceptance源码 `TerminalUpdateAcceptanceScenarios.java` 的artifact三个场景；注册generatedbinding/API文档与平台artifact审计读取：按附件19.1扩现有平台audit封闭query/dispatch及owner任务读依赖，经既有GET验证保存一事件、重放不增事件、跨空间拒绝，不新建UI/operation。平台最小FULL候选统一既有artifactPage的五事实server query（附件17），错误映射按IA4，focused验证和完整CP对账。

退出：实际解析/reject/跨空间/private对象代码与focusedproof完整，CP-02 MATCHED。不接受只看response.ok或没有throw。

## 5 · CP-03：规则、快照、topic与下载授权

1. PROJECT读/写cap分离，RULE immutable目标/status/时间；ALL/refs/配对/N/M合法性，默认停用及显式状态取已接受UI。owner校验先receipt；audit同TX、scope锁先集合查询覆盖首次无cache。
2. 同projectcollectionHash/原始time/notify；不造人工递增time。同time在线仍通知；no cache空time0明确初始化。
3. 完整启用规则所有App分页；collectionHash/cursor/currentcontext绑定，mutation变化409与有限重读/8MiB明确拒绝；不是Bounded first100。101规则、读取期间启停、初次并发create和同毫秒反例。
4. TDS新topic合法boundstore/projectSQL、principalfunctionONLY及DEV受管grant/probe；改schema/singlemigration，不赋TDS新owner写主权。
5. TDC凭证发行短期opaquegrant，artifact关联覆盖boundStore的已创建规则（ALL或refs含boundStore），含停用固定task来源；在owner短TX复用AdvisoryLock.acquireHashText按workspace/terminal/bindingGeneration互斥，锁先于过期回收、有效计数和insert；31有效项双并发必须恰一成功一BUSY、总数≤32，既有token仍有效；content每次currentbinding复核，私有stream在TX外；无secret落盘/log/query。下载过期/撤权/首次失败临时资源有界。
6. rule/snapshot/download acceptance源码、TDSpermission/topicdirecttests、生成物/消费者/报错、focused与完整CP对账。

退出：规则/快照/通知/授权下载生产链有真实调用者和focused反例；两个operations-admin规则adapter及其M1生成绑定通过 `compileJava`；CP-03 MATCHED。无C自动选择/提醒/闲时/副机实施。

## 6 · CP-04：TER供给、CBS HTTP报告与心跳触发重试

1. same update owner 的独立完整规则snapshot持久slice/selector，status/error单独非持久；store-basic公开`selectStoreBasicLoadReadiness`提供本Runtime、binding及STORE/PROJECT分别HTTP+flush后的事实。两套composition通过窄reader仅在相同当前binding且两项flushed、projectRef与组织路径相同时启动刷新；topic changed触发整页重读，刷新flush成功后才accept该notification。配置/绑定/项目变化、未就绪与reset清旧context；分页、collectionHash及当前上下文复核沿TDC HTTP/read selectors，不直接读他包slice/persistence。
2. 在同一升级owner新增持久报告descriptor：bindingIdentity/contextIdentity/nextReportSequence/pendingReports/sendPaused/latestDeliveryFailure（同task合并，不同task保留；无任务observation不造历史）。contextIdentity为当前完整规则上下文的非秘密身份（终端/绑定代次/当前服务空间/门店/项目/项目更新时间）。同一上下文普通重启/断线保留；已读到新上下文时先持久清除旧pending、pause和失败摘要；配置暂不可读但绑定有效时保留旧身份并暂停发送；task报告发送前再匹配当前上下文，旧回包只更新仍存在且身份匹配的原项。actual/recent归一selector和发送command。正文先flush再TDC typed POST；依详设§8.5结果表分类：通信/503/结果未知保留，终态报告拒绝移出并存同slice最近失败摘要，身份拒绝持久暂停，CBS短REQUIRED＋binding最终复核＋owner锁/UPSERT，重复/乱序/旧绑定按详设8.5，收到匹配commit/SUPERSEDED receipt后再清匹配项且flush。测试同task一行、两task历史、响应丢失幂等、本地flush失败、较旧receipt不能删新pending及actual不取target；加409不阻塞下一task、422不阻塞observation、停用/凭证拒绝经多PONG及重启仍零补发、配置/绑定变化清旧pause且不发送旧报告、暂不可读期间不丢失但不发送、两种receipt与非匹配回包反例。只在同一slice保存最新递送失败摘要，不新增失败库/人工重试/后台显示。
3. transientgrant sourceprovider与UpdatePort/native网络header扩展；旧同步签名删除；FULL/HOT都下载完整 ZIP，expectedSha256 为该 ZIP 摘要，解出的 APK 用 manifest.apk.sha256 校验，publicationId 只标发布内容身份，不混用三种摘要。A所有直接消费者/单测/fixedFULLHOT续接做**受影响差量**，不重开A整批。secret无persist，scope/角色失效迟到不污染。
4. 两integration装配update供给/报告桥、同一资源释放；readiness selector返回runtimeId/binding/projectRef及STORE/PROJECT各自flush状态，迟到结果隔离，不以hydrated值触发；topic/ready触发完整规则分页snapshot，完整正文flush后才accept具体通知。规则摘要固定目标不含完整manifest；prepare时grant一次性携带manifest，actor校验与目标身份一致后传给UpdatePort。快照刷新不自动调用accept-target/prepare/apply；按详设§8.4把ruleRef加入selectionContext并由owner从完整snapshot物化目标；受管验收显式调用A公开command固定规则。root reset/配置/绑定变化清旧snapshot/report context；retained task按A例外不变。
5. TDC新增public/local terminalDataHeartbeatCommand：有效PONG完成存活/RTT更新后异步广播；禁用会transport.invalid的通用background失败路径。升级actor消耗此command补发持久pending，首await前inFlight、直到实际IO结束才释放；command timeout不误当IO结束，绑定/角色/上下文重验。focused含重复/未知PONG、不阻塞心跳、两业务consumer相互失败隔离、多tick重叠仅一真实IO及脱敏。TDS仅规则topic EXECUTE-only权限probe，无report函数/队列/WS ACK能力。

退出：供给和观察完整focusedproof、sourcegrant/Aconsumer差量闭合、CP-04 MATCHED。报告最小接缝还须证明：同 owner 在终态 task 释放前保留显式 rule/FULL/HOT 关联，合法原绑定存在时持久化原任务 pending；task 清除后仍能准确发送，不能从 taskId/新绑定/目标版本猜事实。不增第二任务账本，不以 HTTP 不可达阻塞本机任务释放；无合法原绑定时遵守旧报告失效规则。是否需要受管focused动态由将来实施授权明确，不能用旧run宣称当前通过。

## 7 · CP-05：两后台、验收与唯一自动化接线

1. 按IA§2全部页内交互的后台/菜单/宿主/控件/读与写权限实现，确认后才同步catalog/routing；先foundation/目录/类型TestIds/控件componenttests。upload实际fileinput/testID，candidatecursor/值回显（门店复用useOrganizationCandidates，最小透传既有loadNext，250ms防抖＋加载更多）；statusModal/dirty/focus/contextinvalid/readcap/createdAt/unknown全部component反例。
2. 包列表/上传解析/保存禁用准入/详情；规则新建/详情/启停及OperationsAuditHistoryModal；运营右Tab按门店、实际APK/JS/runtime查询启用门店下启用终端，详情Descriptions＋历史Table/CursorPagination。全部复用标准容器；分钟InputNumber×60提交/÷60回显、标准审计真实PROJECT读取、未知/NO_REPORT/无任务/历史加载失败分开。无手工任务retry/每阶段流水。
3. 本轮管理端动态范围以真实供给链为准，不接入独立 Browser L2 控制面或12-case suite；详设§3a 的其余管理端 case 在本轮标记 `NOT_RUN_BY_DEXTER_EXECUTION_SCOPE`，不伪装 PASS。`update.supply-chain` 必须经真实平台页面保存 FULL/HOT、经真实运营页面建立并启用规则、由真机执行产生 CBS HTTP 报告，再经运营页面读回最新值与任务历史；不得 SQL 造 report 或沿用旧 DEV 报告。Browser、fixture 与借用 DEV Vite/tunnel 的身份和 cleanup 分开记录。
4. 实现详设§15.2a同DEV完整链：仅扩现有runner的`update.supply-chain` case；该case只接受 Android dual，mobile/web参数必须fail closed；同步implemented判定、DEV准入/case→suite映射，借用DEV已拥有的两管理端Vite/tunnel，只新增Playwright browser/context/session与TestId动作及budget/profile/manifest/cleanup；真实UI保存工件和启用rule→snapshot→production provider/A公开accept→CBS grant/content→真port→HTTP报告→同DEV运营Tab/Drawer。供给页面helper为`tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts`，由`update.android.test.ts`调用，不存在独立供给链test case。共享A原生操作但禁本地target/供包fixture；账号GROUP/PROJECT、两个App各一条FULL→HOT逐项固定，FULL-only沿owner/Web/API focused复用，seed不代替本链UI。无新runner/C自动调度。TER新场景走当前automation skill/API，selector先订阅再动作、精确requestId无空窗；Webtypedfixture不假nativeactual；Androidactualreport场景使用A真正执行核/UpdatePort与main绑定，reload后重建session/UI/selectorhelpers。不得复活旧runner/直接ADB驱动TER React节点。
5. sharedacceptancefixture/scenarios（详设11）由真实ownerHTTP建立；tool/ZIP坏包fixture本仓拥有/hash；所有旧运行不继承。readme/API文档完整、focused与CP对账。

退出：本轮指定供给链涉及的 UI/TestIds、真实页面 helper、`update.supply-chain` runner 消费者及 focused proofs 完成，CP-05 MATCHED；独立 Browser L2 控制面与其他 §3a case 按本轮 Dexter 执行面调整保持未运行/未实现，不得作为当前 PASS。

## 8 · CP-06：代码与seed收尾

1. seed 新域 plan/executor/tests、父流程 COUNT_KEYS/expectedCounts/角色与capability同步。使用现有 runner 的 `update.artifacts` 构建并校验 Android 发布物，以 `R5_TERMINAL_UPDATE_SEED_ARTIFACT_EXPORT=1 scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --case update.artifacts` 生成本仓 run-owned `update/seed-inputs/`（此 case 只构建产物，不运行 TER 行为或设备场景）；只有该 run 的 manifest 明确记录 `phase=update`、`case=update.artifacts`、business/cleanup 均 PASS、十个输入文件与哈希清单完整时，`scripts/dev/seed --profile r5-full --dry-run` 才可进入终端更新 plan。父流程后置步骤按 `store-terminal → terminal-update` 顺序运行：通过既有平台/运营 HTTP owner 建立并详情/列表读回4工件、8规则，再删除该 run 下精确 seed-inputs 副本并读回清理结果。source 缺失、身份/字节不符或上传/规则读回不全时 dry-run/seed fail closed。
   FULL-only规则详情必须保留并读回`hotArtifactRef=null`；该响应字段必有且可空，不得为其伪造HOT工件。
2. 当前代码生成→typecheck/build/focused/verify按授权执行，区分validate-only与完整verify；首败读日志及最小修复，未受影响验证不重复。
3. 删除替代旧签名/无调用helper，保留A核/既有TDP无重复恢复；保存实际symbols/consumer/source范围与NOT_RUN，检查两后台错误/审计/API同步。
4. CP-06全项focused与fresh完整三维MATCHED。**本退出不依赖整批6b、整体验收、13c或最终review**。

## 9 · 全部CP后：整批对账与动态前整体准入

1. 新 fresh 子 agent 重开全批需求/详设 IA/路由记忆、当前源码与逐点 focused，做整批 6b；不是 CP verdict 汇总。任一 OPEN 根因修复并差量复核，不重做无关 A 对账。
2. 首次受管真机、focused browser 或 reset/seed 前，按各自入口的现行准入和当前字节身份做预检；发生 reset/seed 前先满足本批全 CP、全批 6b、适用的脚本准入与完整 seed dry-run。后台页面只运行本链所需的 focused scenario，不要求生成无关全量 L2 的空分母。
3. 执行面：本轮 TER 仅单机双屏真机；两后台本链走受管浏览器 focused 场景；DEV 后端使用批准的远端环境。未获准的 Expo Web/mobile/双机/双 VM及其它设备均保持 NOT_RUN/NOT_COVERED，不以低档结果替代真实端到端。

## 10 · 整体验收：执行面与顺序

本计划中的命令以受管入口为准，CP-01/CP-05 重开当前 `--help` 与源码后记录实际 argv；当前执行授权有效。若新 suite/case 未接线，先在对应 CP 完成入口，不能验收期临时发明。

1. 依赖/生成/compile/focused/verify：按本批owner实际入口；生成只用canonical，`scripts/verify --validate-only`与默认完整结论分列。
2. CBS/TDS真实HTTP/PG/Minio：唯一 `scripts/test/backend-acceptance` focused TerminalUpdate场景和受影响TerminalConnection协议，再适用整批范围。不建立provider壳或新scenario注册分母。
3. PG重启读回、topic listener恢复/同time、报告HTTP重复/乱序/binding/历史分页属于API闭环本run fixture；业务事件广播由TDC matchedPONG与owner-focused证明。遵受管DEV/Testcontainers联动及owned cleanup，绝不隐含seed。
4. 两后台 UI：API 闭环后，由 `update.supply-chain` 在既有受管 `terminal-automation` 父 run 内启动并拥有 Playwright browser/context/session，借用当前 DEV manifest 所属的两个后台 Vite 与 tunnel，完成本链上传/解析/保存、规则配置、分钟换算、报告查询及历史读回。该同 DEV 业务链不调用固定隔离库的 `browser-l2-runtime`，也不运行无关 Browser L2 suite。管理端交互使用真实 DOM/TestId 与真实 HTTP/DB oracle；不得由 TER agent 操控后台。browser 属 TER run-owned 资源，DEV Vite/tunnel 属借用资源；cleanup 按各自所有权报告，脚本准入不替代 business/cleanup。
5. DEV完整链前置：API/隔离L2 business与cleanup关闭后，满足CP/6b、脚本准入及当前完整 `scripts/dev/seed --profile r5-full --dry-run` PASS；按§1.1既有实施期reset授权，根据需要执行 `R5_RESET_CONFIRMATION=EXPLICIT_R5_RESET scripts/dev/reset` → `scripts/dev/start` → `R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full`，各步先读回成功再下一步。reset入口自身完整dry-run与Doris/PG身份检查仍保留；不因重复索要reset许可停止，不在长run内reset。seed只供真实账号/组织/终端等前提，不代替后续UI写入工件/规则或造报告；reset失败不得继续start/seed。
6. TER 真机动态只在一台单机双屏设备执行。console 与 wallpaper 两个 App 各按本批适用主流程及更新判据验证；当前同设备序列和双屏拓扑由受管清单明确记录。Expo Web、本轮以外的 mobile/双机/双 VM 均 NOT_RUN 或 NOT_COVERED；不得声明跨面 parity。所有 UI/资源需 CP-05 接线而非验收时临时补入口。
7. 同DEV真实端到端：按详设§15.2a，两App依次经真实打包→运维 UI 上传 FULL/HOT 并保存→运营 GROUP 任职/PROJECT 节点创建与启用规则→实际激活 TER snapshot→agent 显式 A command 固定该 ruleRef→CBS grant 下载同 artifact→指定单机双屏真机执行 Android FULL→HOT→同 task 实际 HTTP 报告→运营右 Tab 版本查询及 Drawer 同任务历史读回。工件/规则/绑定/任务/报告身份前后一一关联；不得用 A local target server 或合成报告代替。管理端经受管 Playwright/现有 TestId，TER React 经最新 automation-agent，系统 installer 只走 driver 已批准窄例外。运行期间不 reset/seed、不重建 namespace；本链之外的 L2 和设备矩阵不执行。
8. business/CONTRACT/cleanup分列；同父run精确资源身份回收。链中禁止reset/seed、停止并重建后台namespace或补造task/report；保留run拥有的真实rule/report正常历史、不新增删除API/SQL清理，下一run必要时经受管reset。每App开始前终端inactive，每App单任务内同binding保持，两App间身份匹配回收；未拥有的应用/进程/绑定不得动。

当前执行按本段明确授权进行。未受影响且已 MATCHED 的 A 内容不重复对账、不要求完整 A 动态重跑；新增 CBS 生产供给/真实报告/两后台读回链不得被旧 A 通过替代。DEV 是否保留以本轮授权和实际 cleanup 记录为准。

## 11 · 逐代码与详设对账

显式步骤名：**逐代码与详设对账**。执行者fresh独立只读子agent；覆盖所有新增/修改/删除行（生产、测试、脚本、契约输入/生成输出、SQL、seed、目录、README/API文档）；判据B详设/IA实际逐条，检查无调用symbol、未建立文件、规则自动执行越界、错误脱敏遗漏。产物MATCHED/OPEN；OPEN禁止交Dexter/Claude做实施结果review。此步骤与全批6b/动态结果不同，互不替代。

## 12 · 整批实施review与交付

fresh独立 `REVIEW_TARGET=IMPLEMENTATION` 从真实需求/详设/源码/用户行为重新判断合理性，不用“符合设计”豁免。finding核验同根、最低成本修复再focused及受影响CP/6b/13c差量，未受影响已MATCHED不重复；整批review重开全范围不能只看修复文件。

交付给Dexter/Claude：当前字节范围、实际命令/run/source/层级、CP及全批6b/逐代码 MATCHED、首败/cleanup、每条 V 本期子断言与 A/C 边界、NOT_RUN/NOT_COVERED；包含两后台本链 focused 真实页面证据，以及§15.2a同 DEV 同规则/同终端/真实任务的 UI→TER更新→CBS报告→运营UI闭环证据。管理页面运行与设备运行分别报告，但通过同一业务身份链关联；不得用独立 fixture 与本地 A 更新拼接成端到端 PASS。不得把 B 供给保存称自动更新完成。

## 13 · 本轮文档交付的独立设计审查

本段记录已结束的 DESIGN cycle 和当时各轮状态，不是本次实施进度或权限声明。原始 verdict 保留在对应文件；当前实施及运行状态只以后续 CP/run 记录为准。

本次Dexter改变报告消费后台与同页双Tab Journey，旧cycle R1 NO-GO及R2受控STOPPED_SCOPE_CHANGED/NOT_ISSUED仅历史。当前cycle ter-version-update-stage-b-project-tabs-20261007原按两轮结束；随后按两次直接授权完成R3/R4及条件触发后的R5；R6因工具线程上限未执行且没有verdict，本cycle本次例外上限6，不重建cycle。旧scope cycle的停止及结论仍仅历史。所有行为/cleanup仍NOT_RUN。

CP-05逐交互面落实附件§10标准容器：ProTable/查询/唯一cursor分页、编辑/详情Drawer、StatusChangeConfirm/Tabs，规则操作历史复用OperationsAuditHistoryModal。新增HTTP roster18项；规则审计扩既有通用GET不另计新operation；历史GET第18项。UI/TestId前置完成才写L2脚本，当前NOT_RUN。

CP-06 seed完整输入与四工件/八规则/role-group写、role-project读及COUNT_KEYS父链同步按详设§15.1执行；CP-05唯一runner实际扩展case/suite、fixture/manifest/首败清理按§15.2。这些是CP必交付源码，不可用验收时临时脚本替代。完整seed dry-run与实际reset/seed守§1.1既有reset授权和实际实施执行面准入，本轮均NOT_RUN。

## 14 · 修订设计的CP必需输入

每CP前重开详设§4对应RECALL/不变量/形态理由；每actual点按§9a.1完整事实分母同步。CP-01以附件§11逐operation合同、JSON/binary消费、安全scheme/头、具名handler origin及normal fixture完整databaseOperationCount声明（SQL execution＋CONNECTION＋TRANSACTION，batch按tracker报告）为定稿输入，不留组级“身份另计”；CP-02/03由app application operation建立REQUIRED和授权事实，再调用owner API；owner module不反向引用app-edge，不从edge起commandTX。CP-05逐输入/variant/fact/action对照附件§12/13与真实DOM；CP-06精确seed files按§15。逐V适用子断言具名表按附件§6/14，不重复未受影响A，也不能将N_A写成整条通过。

## 15 · 最新裁决差量的强制实施与测试落点

| CP | 实施义务 | focused/acceptance/L2最低反例（均计划NOT_RUN） |
| --- | --- | --- |
| CP-01 | 18项HTTP、报告POST鉴权三头与生成器名单，TERMINAL_UPDATE_RULE审计type与§4-F标准唯一正本同步 | binary不能进JSON；typed报告POST不是read命令；标准不建立通用pending owner |
| CP-02 | file上传＋parse成功资格绑定当前stage/file/context；唯一保存按钮 | parsing/上传失败/替换/过期时禁用；直接HTTP绕UI仍owner拒绝 |
| CP-03 | 规则审计同REQUIRED，N/M分钟×60秒；合同scope不变 | create/启停各一审计，同key回放不重复，拒绝零审计；59/61秒及越界拒绝 |
| CP-04 | CBS每task行、actual观察；升级持久pending与TDC有效PONG广播/HTTP receipt | 两task不丢；同task更新不增行；HTTP失败/失响应/flush失败/hydration/迟到；PONG有效性、零重连副作用、真实IO single-flight |
| CP-05 | 启用门店＋启用终端SQL范围、actual版本filters、Drawer历史分页/标准审计Modal与真实HTTP L2 fixture | 两个停用维度各排除；未报告行；server过滤跨页；101历史分页不全拉；不同PROJECT/无写cap读/切上下文拒旧结果 |
| CP-06 | 新域seed四工件八规则；正常N=5/M=10分钟；父子count按新增域与真实asset事实同步，既有终端key不变 | seed不伪report/审计；业务测试经ownerHTTP产报告，两task/history仅测试fixture；完整dry-run结构按父链验证 |

原有已MATCHED且未受影响的A内容不重复对账；新增报告descriptor/typedPOST/心跳标准/审计与消费者差量必须分别纳入其完整CP及全批6b，不能把“无需重复”误用于本次变化。


报告资格 focused/HTTP/UI fixture须同时覆盖启用门店＋启用终端、单侧停用、双方停用、任一作废、启用且NO_REPORT；列表身份集合及详情/历史同资格拒绝见详设§8.5。不得将“未作废”作为报告查询的有效条件；规则固定refs回显与数据库历史保留仍是独立事实。
