# TER 版本定义、完整更新与热更新：阶段 B 实施计划

### 2026-10-07 Dexter 最新裁决（覆盖旧报告方案）

1. 报告存 CBS PostgreSQL，由 `terminal-update` owner 写入；运营右 Tab 可按门店和当前实际版本查询。Dexter 最终更正“仅包含启用”：范围为当前项目 **启用门店下的启用终端**，停用/作废均排除；未报告终端仍有列表行。显示门店名、终端名、实际版本、最新升级报告状态，点击终端打开标准详情 Drawer，显示最新报告及历史报告。
2. 上传成功且解析校验成功后才可保存；按钮名称统一“保存”，之前禁用。HOT 还必须选定与声明五事实完全匹配的最小 FULL。换文件、解析失败、stage 过期或上下文改变立即撤销旧保存资格。
3. 升级报告经 CBS HTTP 上报；失败正文缓存到升级 owner 的持久化 state。TDC 对有效匹配 PONG 发公开本机广播 command，业务 actor 消费后重试自己的未发送内容。TDC 不保存其他 owner 的失败正文，广播不证明 CBS HTTP 成功，不通过报告失败重连 TDS。
4. N/M 界面单位为分钟；InputNumber 正整数分钟 1～1440 为本设计的有限参数，canonical/API/持久字段仍明确为秒，提交乘 60、读取除 60，服务端检查 60～86400 且为 60 的倍数；正常 DEV 用 N=5/M=10 分钟，边界值只进 acceptance fixture。
5. 运维保留 APK、JS、runtime、构建号、applicationId、publicationId、摘要等真实技术字段；不得暴露凭证、下载 grant 或原始异常。
6. 规则详情增加“操作历史”，复用标准审计能力，不新建审计流水/弹窗容器/operation。

后续直接确认：“每个更新任务一条报告”。阶段变化更新同一任务记录，历次任务保留；每次 HTTP 重送与心跳不新增历史行。此前“包含启用和停用”的答复已被“仅包含启用”覆盖，不作为当前输入。

正式需求 R-15 中旧双后台、最后值而无任务历史、TDS 上报路径由上述直接裁决覆盖。本轮只改 B 设计包及 intake；需求正本、开发规范、项目记忆、A、源码均不修改。未来实施授权须覆盖正式来源同步与终端标准唯一正本中的心跳触发重试条款；当前仍无实施或运行授权。大致 IA 已确认，本次新增历史/筛选/审计细节为修订设计，未冒充逐控件看图或动态 PASS。

## 0 · 当前状态与授权

STATUS=DRAFT_READY_FOR_DEXTER_CLAUDE_REVIEW；IMPLEMENTATION_AUTHORITY=false；UI_REVIEW=ACCEPTED@2026-10-07_SCOPE_APPROXIMATE_IA_DYNAMIC_NOT_RUN。
正式需求、B详设/Journey/IA/UI/附件同批引用；当前只写文档。2026-10-07 Dexter：“大致IA内容已经确认了，可以下一步了”；本次继续设计完善，不推导实施或运行授权。A由Codex继续实施/验收，未继承任何PASS；未读取其运行产物，不发送追加任务。所有未来命令都为计划/NOT_RUN，不授权现在执行。

用户任务：运维上传/解析成功后保存真正 FULL/HOT；运营维护不可编辑项目规则及标准审计，查询启用门店下启用终端的实际版本、最新报告和每任务历史。主机保存完整规则供给，通过 CBS HTTP 上报并持久缓存失败；C 自动/双机不进入 B。

### 2026-10-07 Dexter 后台职责裁定（本批优先输入）

Dexter：“PLATFORM-REPORT这个业务……做成和RULE-LIST是一个页面，但是两个不同的tab，左边……这个项目中所有的更新规则，右边……这个项目中所有门店终端的更新状态”；随后确认：“运维管理后台，只定义终端的更新版本，运营后台才是规则与更新情况报告”。

platform-admin 只负责更新包/版本定义；operations-admin“项目终端版本管理”同页左“更新规则”、右“终端更新状态”。右 Tab 查询当前项目启用门店下的启用终端，包含尚无报告者；标准详情 Drawer 显示最新报告及按任务保存的历史。规则操作历史使用现有标准审计 Modal；仍只有两个内容页/两个路由，无手工任务重试或任务看板。

当前产品输入以“Dexter 最新裁决”节为准；旧 R-15 文字只作来源对照，不能恢复旧后台或旧报告通道。正式来源同步安排在未来实施授权内，当前仅设计、NOT_RUN。

### 内部 DESIGN 历史与 Dexter 追加两轮授权

同一 cycle `ter-version-update-stage-b-project-tabs-20261007`：R1 原始 NO-GO 3M/4S/0N；R2 原始 NO-GO 2M/2S/0N，原报告和旧字节结论保留。主 agent 亲自核验后作最小文档修订，其处置不是独立 GO；SELF_DECIDED 不表示作者可以替 reviewer 出具 verdict。

Dexter 追加原话：“授权你再多两轮对抗性review，然后再给另一个Claude做review”。据此保留同一 cycle，追加 fresh 只读 R3、R4；不以措辞、文件名或产品范围变化重置轮次。随后明确：“如果第四轮还是NO GO，并且也是你确认的真问题，可以再增加两轮”。R4原始NO-GO 0M/1S/0N，主agent重开verification-governance§8、本文§10与详设§15.2，确认验收依赖顺序矛盾，条件已触发；同cycle完成fresh只读R5；R6尝试因agent thread limit reached未能创建，NOT_EXECUTED_TOOL_LIMIT/NOT_ISSUED。默认两轮不变，本cycle上限6只来自这两次直接授权；工具状态单列归档，不把R6写成已完成，不重开cycle，交外部Claude。

`ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION`；`REVIEW_ROUND_LIMIT=6`（仅本 cycle 的显式例外，R4原报告仍保留其当时上限4）。当前大致 IA 已确认，不重复申请。计数仍是 normal 设计假设，实际解析/SQL/UI/资源/运行仍 OPEN 或 NOT_RUN；本次不新增实施授权。

## 1 · 实施进入条件

1. Dexter接受本批Journey/IA/线框/详设与计划，并另行授权实施及实际执行面；大致IA已确认，不重复申请同一页面/Tab确认；其余设计结论仍须接受。
2. A实际交付/实施review与详设§0.1接口闭合，特别FULLZIP及actual HOT readback；A仍OPEN时可以写本计划，不能开始B生成/源码改动。
3. 重开A当前字节与TDP/最新automation driver公开能力，列接口差量及消费者，不继承旧GO。当前没有工具/原始运行证据，不填PASS。
4. 依赖/资源工具在CP-01核实，跨阶段新增接口只在本次明确授权范围内变更，不重做A已完成且未受影响的对账。

## 2 · 实施纪律

主agent唯一写入/运行；只读fresh reviewer按完整CP审查。每点写前重开原需求/IA/六维命中记忆/规范/owning source/可复用能力，focused后同组原文回读。CP内不按文件另拆审查；阶段所有点和必要修复后fresh三维MATCHED再下CP。发现同根失败先扫描整个有限输入/消费集合，最小修复＋真实red，不添加通用恢复框架。失败保留日志，禁止重复盲跑/延时救绿；business与cleanup分列。

## 3 · CP-01：A交接、契约与可执行输入

1. 根据详设0.1/附件2读取A最终工件与源码/验收面。确认manifest、FULLZIP消费、pub/ZIP身份、真实actual、A六端口与provider最终签名。记录current/proposed接口，不自行修A源码作为本CP准备。若A未关闭，停止实施，记录具体OPEN。
2. 原需求＋最新直接裁决→canonical/openapi-source/IAM/admin-catalog→materialize→edge-codegen→terminal generator/Java/TS。冻结完整18项HTTP roster、报告body/receipt/错误集/鉴权三头、具名PROJECT审计类型与标准读取扩展；protocol只新增规则topic，不新增版本report/ACK。随未来实施授权同步正式需求R-15及终端标准§4-F心跳重试规则与适用记忆；本轮不修改。
3. 落实详设§5真实getOperationsOrganizationCandidates PagePaged与新第15项getOperationsProjectTerminalUpdateRuleStorePage CursorPaged合同、DTO/排序/权限；验证停用/作废固定refs读回，不将协议选择留到实施期。
4. 解析工具/依赖：CommonsCompress1.28.0、Minio实际版本、AndroidBuildTools36.0.0候选部署、官方tag/source/工具校验。证明实际安全读取/签名/metadata/res映射；unsupportedfailclosed。定位r5预算profile/principal/dependency/cache路径，不在Flyway安装SDK/创建bucket。
5. 当前受管resource profile中保存B用既有runner的kind/运行根，不能造第二runner。版本选择与永久工件业务数量无上限；技术预算明示/红例。生成src和registry同步、focused/check/adversarial完整CP对账。

退出：A交接已验收、canonical与consumer类型可编译、依赖/预算准入明确、有限红例结构成立、完整CP-01 MATCHED。后续整体验收不回流到该CP。

## 4 · CP-02：真实工件与私有asset

1. 新terminal-update模块/schema/api/persistence/receipt/audit接入唯一CBS；asset具名ZIP stage/claim/private stream扩展而非新平台。
2. 按详设8.1实现stream/hash/bounds/ZipFile及工具验证；签名APKmetadata对应真实bundle/res；解析I/O不在TX，资源close与失败cleanup可见。
3. stage→register transaction原子claim、全局pub同version内容冲突、samecontent跨space、HOT固定FULL五字段；未验收包不变可用对象。
4. 私有bucket隔离publiccontroller/anonymouspolicy；不泄露URL/key；实现releaseownedstage拒绝crossspace/crosssession。
5. owner/parser/assetdirecttests＋真实HTTP acceptance源码 `TerminalUpdateAcceptanceScenarios.java` 的artifact三个场景；注册generatedbinding/API文档与audit读取；平台最小FULL候选统一既有artifactPage的五事实server query（附件17），错误映射按IA4，focused验证和完整CP对账。

退出：实际解析/reject/跨空间/private对象代码与focusedproof完整，CP-02 MATCHED。不接受只看response.ok或没有throw。

## 5 · CP-03：规则、快照、topic与下载授权

1. PROJECT读/写cap分离，RULE immutable目标/status/时间；ALL/refs/配对/N/M合法性，默认停用及显式状态取已接受UI。owner校验先receipt；audit同TX、scope锁先集合查询覆盖首次无cache。
2. 同projectcollectionHash/原始time/notify；不造人工递增time。同time在线仍通知；no cache空time0明确初始化。
3. 完整启用规则所有App分页；collectionHash/cursor/currentcontext绑定，mutation变化409与有限重读/8MiB明确拒绝；不是Bounded first100。101规则、读取期间启停、初次并发create和同毫秒反例。
4. TDS新topic合法boundstore/projectSQL、principalfunctionONLY及DEV受管grant/probe；改schema/singlemigration，不赋TDS新owner写主权。
5. TDC凭证发行短期opaquegrant，artifact关联覆盖boundStore的已创建规则（ALL或refs含boundStore），含停用固定task来源；在owner短TX复用AdvisoryLock.acquireHashText按workspace/terminal/bindingGeneration互斥，锁先于过期回收、有效计数和insert；31有效项双并发必须恰一成功一BUSY、总数≤32，既有token仍有效；content每次currentbinding复核，私有stream在TX外；无secret落盘/log/query。下载过期/撤权/首次失败临时资源有界。
6. rule/snapshot/download acceptance源码、TDSpermission/topicdirecttests、生成物/消费者/报错、focused与完整CP对账。

退出：规则/快照/通知/授权下载生产链有真实调用者和focused反例，CP-03 MATCHED。无C自动选择/提醒/闲时/副机实施。

## 6 · CP-04：TER供给、CBS HTTP报告与心跳触发重试

1. sameupdate owner的独立snapshot持久slice/command/selector；资源桥先订阅后读初值，当前boot STORE/PROJECT各HTTP与flush成功组合gate（store-basic storeOrganizationPathLoadedCommand/selectStoreBasicLoadReadiness差量，composition晚装配从非持久selector重建两项，不依赖一次性STORE事件）、每readyHTTP、在线同time通知、epoch隔离、empty替换/flush后accept。复用TDCHTTP/公开selectors，不直接读state/persistence。
2. 在同一升级owner新增持久报告descriptor：bindingIdentity/nextReportSequence/pendingReports/sendPaused/latestDeliveryFailure（同task合并，不同task保留；无任务observation不造历史），actual/recent归一selector和发送command。正文先flush再TDC typed POST；依详设§8.5结果表分类：通信/503/结果未知保留，终态报告拒绝移出并存同slice最近失败摘要，身份拒绝持久暂停，普通重启/断线不抹分类；CBS短REQUIRED＋binding最终复核＋owner锁/UPSERT，重复/乱序/旧绑定按详设8.5，收到匹配commit/SUPERSEDED receipt后再清匹配项且flush。测试同task一行、两task历史、响应丢失幂等、本地flush失败、较旧receipt不能删新pending及actual不取target；加409不阻塞下一task、422不阻塞observation、停用/凭证拒绝经多PONG及重启仍零补发、配置/绑定变化清旧pause、两种receipt与非匹配回包反例。只在同一slice保存最新递送失败摘要，不新增失败库/人工重试/后台显示。
3. transientgrant sourceprovider与UpdatePort/native网络header扩展；旧同步签名删除；A所有直接消费者/单测/fixedFULLHOT续接做**受影响差量**，不重开A整批。secret无persist，scope/角色失效迟到不污染。
4. 两integration装配update供给/报告桥、同一资源释放；readiness selector返回runtimeId/binding/projectRef/flush成功状态，迟到结果隔离，不以hydrated值触发；不调用accept-target/prepare/apply响应rulesnapshot；sourceprovider仅已固定A任务消费。rootreset/配置/绑定变化清旧报告pending/context（不得给旧task改签新binding）；retainedtask按A例外不变。
5. TDC新增public/local terminalDataHeartbeatCommand：有效PONG完成存活/RTT更新后异步广播；禁用会transport.invalid的通用background失败路径。升级actor消耗此command补发持久pending，首await前inFlight、直到实际IO结束才释放；command timeout不误当IO结束，绑定/角色/上下文重验。focused含重复/未知PONG、不阻塞心跳、两业务consumer相互失败隔离、多tick重叠仅一真实IO及脱敏。TDS仅规则topic EXECUTE-only权限probe，无report函数/队列/WS ACK能力。

退出：供给和观察完整focusedproof、sourcegrant/Aconsumer差量闭合、CP-04 MATCHED。是否需要受管focused动态由将来实施授权明确，不能用旧run宣称当前通过。

## 7 · CP-05：两后台、验收与唯一自动化接线

1. 按IA§2全部页内交互的后台/菜单/宿主/控件/读与写权限实现，确认后才同步catalog/routing；先foundation/目录/类型TestIds/控件componenttests。upload实际fileinput/testID，candidatecursor/值回显（门店复用useOrganizationCandidates，最小透传既有loadNext，250ms防抖＋加载更多）；statusModal/dirty/focus/contextinvalid/readcap/createdAt/unknown全部component反例。
2. 包列表/上传解析/保存禁用准入/详情；规则新建/详情/启停及OperationsAuditHistoryModal；运营右Tab按门店、实际APK/JS/runtime查询启用门店下启用终端，详情Descriptions＋历史Table/CursorPagination。全部复用标准容器；分钟InputNumber×60提交/÷60回显、标准审计真实PROJECT读取、未知/NO_REPORT/无任务/历史加载失败分开。无手工任务retry/每阶段流水。
3. UI/TestId fresh前置PASS后才写完整L2 policy/generator/P1/check/spec，按详设3a逐case→fixture→actions。本run真实激活＋CBS报告HTTP作为REPORT-CURRENT生产者，至少两task/同task阶段更新；禁止SQL造report/旧DEV报告，不为report增TDS。readiness→同runP1 activation→生成链check→finalize→run；凭证仅内存，绑定/资产/浏览器按manifest身份cleanup。
4. TER新场景走当前automation skill/API，selector先订阅再动作、精确requestId无空窗；Webtypedfixture不假nativeactual；Androidactualreport场景使用A真正执行核/UpdatePort与main绑定，reload后重建session/UI/selectorhelpers。不得复活旧runner/直接ADB驱动TER React节点。
5. sharedacceptancefixture/scenarios（详设11）由真实ownerHTTP建立；tool/ZIP坏包fixture本仓拥有/hash；所有旧运行不继承。readme/API文档完整、focused与CP对账。

退出：UI/testIds/验收源码/完整控制面/唯一runner消费者完成，CP-05 MATCHED；独立L2脚本准入报告仍需整体验收前当前字节核对。

## 8 · CP-06：代码与seed收尾

1. seed新域plan/executor/test、父流程COUNT_KEYS/expectedCounts/角色与capability同步；本仓A实际输入/hash定位，缺输入failclosed；完整dry-run的脚本结构需可执行而当前不声称运行。
2. 当前代码生成→typecheck/build/focused/verify按授权执行，区分validate-only与完整verify；首败读日志及最小修复，未受影响验证不重复。
3. 删除替代旧签名/无调用helper，保留A核/既有TDP无重复恢复；保存实际symbols/consumer/source范围与NOT_RUN，检查两后台错误/审计/API同步。
4. CP-06全项focused与fresh完整三维MATCHED。**本退出不依赖整批6b、整体验收、13c或最终review**。

## 9 · 全部CP后：整批对账与动态前整体准入

1. 新fresh子agent重开全批需求/详设IA/路由记忆、当前源码与逐点focused，做整批6b；不是CP verdict汇总，任OPEN根因修复/差量CP复查后再做全批复核，不重做无关A对账。
2. `动态前整体准入`：所有CP MATCHED＋全批6b MATCHED；UI/testId与完整L2脚本/全部页内交互分母、budget/controls/source身份当前字节fresh `L2_SCRIPT_ADMISSION=PASS`；为本批首次L2、reset或seed，以上各项连同当前字节完整seed dry-run PASS必须同时满足；backend-acceptance不受此门约束。dry-run不等于真实seed或reset授权，本轮全部NOT_RUN。
3. 实际执行授权分别列backend-acceptance、受管DEV/TERWebAndroid、adminL2；没有授权的一面保持NOT_AUTHORIZED/OPEN，不用低档局部PASS补足阶段出口。

## 10 · 整体验收：执行面与顺序

所有命令为未来计划。具体currentCLI在CP-01/CP-05依据`--help`/源码确定并写成完整argv；若新suite或journey未接线，先在对应CP完成入口，不能验收期边跑边发明。

1. 依赖/生成/compile/focused/verify：按本批owner实际入口；生成只用canonical，`scripts/verify --validate-only`与默认完整结论分列。
2. CBS/TDS真实HTTP/PG/Minio：唯一 `scripts/test/backend-acceptance` focused TerminalUpdate场景和受影响TerminalConnection协议，再适用整批范围。不建立provider壳或新scenario注册分母。
3. PG重启读回、topic listener恢复/同time、报告HTTP重复/乱序/binding/历史分页属于API闭环本run fixture；业务事件广播由TDC matchedPONG与owner-focused证明。遵受管DEV/Testcontainers联动及owned cleanup，绝不隐含seed。
4. 两后台 UI：API闭环后受管 browser-l2-runtime 的terminal-update suite，按详设3a合法HTTP report producer跑全部case。包含上传/解析/保存准入、分钟换算、规则审计、版本筛选、enabled范围、NO_REPORT、最新/任务历史与切project隔离。readiness→同runP1 activation→generated-chain check→finalize→run；不借TER/DEV运行态，不用TERagent操控admin。脚本准入不替business/cleanup。
5. TER的数据前置：API与两后台L2 business/cleanup都关闭后，且当前完整seed dry-run、CP/6b和适用准入已满足，只有Dexter明确授权DEV/reset/seed时，按受管 `scripts/dev/reset` → `scripts/dev/start` → 完整r5-full seed建立本批当前字节四真实工件/八规则。完整seed只在reset空库执行，不把历史seed、dry-run或L2隔离fixture当当前可用事实。未获该授权则TER阶段保持NOT_AUTHORIZED，批次整体验收不能完成；本计划不授予执行权。
6. TER非adapter供给/持久化/失败/报告入口：上述当前完整seed成功后，先 `scripts/test/terminal-automation.mjs` 的受管ExpoWeb新共享清单，再同清单Androidapplication比较。Web真实CBS/TDP供给；Webportfixture只证明非native逻辑，禁止写成实际APK更新PASS；seed只提供DEV体验前提，不加入API/L2业务分母。
7. Android原生依赖：用A同owner command/真实port应用最小真实更新后读actualselector/TDC/PG；后台报告显示另由L2自己的真实报告fixture证明，不跨层复用TER运行态。scope保持本run拥有设备/application/安装/reverse，用driver窄例外处理非Reactinstaller/settings，无旧独立UiAutomator入口。A旧run不等同本B报告链。
8. business/CONTRACT/cleanup按层分列；artifact解析临时、private对象fixture、grant、process/container/tunnel/browser/APK/reverse各当前ownership受控释放，cleanup非PASS不得完成。失败不得自动清真实管理员保存的正常业务包。

没有无条件reset→seed收尾安排：B执行授权尚未存在。这里的DEV完整seed是TER体验验证的前置，必须位于API/L2闭环之后、TER之前，不能后置成验收后的可选收尾；缺授权即在该边界停止。最后保留DEV与否按未来Dexter授权执行。每层独立runId、fixture/readback和cleanup，不重跑未受B影响已MATCHED的A对账。

## 11 · 逐代码与详设对账

显式步骤名：**逐代码与详设对账**。执行者fresh独立只读子agent；覆盖所有新增/修改/删除行（生产、测试、脚本、契约输入/生成输出、SQL、seed、目录、README/API文档）；判据B详设/IA实际逐条，检查无调用symbol、未建立文件、规则自动执行越界、错误脱敏遗漏。产物MATCHED/OPEN；OPEN禁止交Dexter/Claude做实施结果review。此步骤与全批6b/动态结果不同，互不替代。

## 12 · 整批实施review与交付

fresh独立 `REVIEW_TARGET=IMPLEMENTATION` 从真实需求/详设/源码/用户行为重新判断合理性，不用“符合设计”豁免。finding核验同根、最低成本修复再focused及受影响CP/6b/13c差量，未受影响已MATCHED不重复；整批review重开全范围不能只看修复文件。

交付给Dexter/Claude：当前字节范围、实际命令/run/source/层级、CP及全批6b/逐代码MATCHED、首败/cleanup、每条V本期子断言与A/C边界、NOT_RUN/NOT_AUTHORIZED，两个后台各自UI与运营后台真正A更新后报告证据。不得把B供给保存称自动更新完成。Git完全由Dexter控制，非完成门。

## 13 · 本轮文档交付的独立设计审查

默认DESIGN上限两轮；Dexter先追加R3/R4，又条件授权R4仍NO-GO且主agent确认真问题时追加R5/R6，该条件已触发。保留同cycle、本次上限6，原话与确认依据见§0，R6因工具线程上限未执行且无verdict，已停止。原始verdict由fresh reviewer独立出具，作者只有intake/修订权。外部Claude经Dexter转交。当前全部实施/运行/cleanup=NOT_RUN。

本次Dexter改变报告消费后台与同页双Tab Journey，旧cycle R1 NO-GO及R2受控STOPPED_SCOPE_CHANGED/NOT_ISSUED仅历史。当前cycle ter-version-update-stage-b-project-tabs-20261007原按两轮结束；随后按两次直接授权完成R3/R4及条件触发后的R5；R6因工具线程上限未执行且没有verdict，本cycle本次例外上限6，不重建cycle。旧scope cycle的停止及结论仍仅历史。所有行为/cleanup仍NOT_RUN。

CP-05逐交互面落实附件§10标准容器：ProTable/查询/唯一cursor分页、编辑/详情Drawer、StatusChangeConfirm/Tabs，规则操作历史复用OperationsAuditHistoryModal。新增HTTP roster18项；规则审计扩既有通用GET不另计新operation；历史GET第18项。UI/TestId前置完成才写L2脚本，当前NOT_RUN。

CP-06 seed完整输入与四工件/八规则/role-group写、role-project读及COUNT_KEYS父链同步按详设§15.1执行；CP-05唯一runner实际扩展case/suite、fixture/manifest/首败清理按§15.2。这些是CP必交付源码，不可用验收时临时脚本替代。完整seed dry-run和reset/seed分别守未来授权/准入，本轮均NOT_RUN。

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
| CP-06 | 新域seed四工件八规则；正常N=5/M=10分钟；父count不变 | seed不伪report/审计；业务测试经ownerHTTP产报告，两task/history仅测试fixture；完整dry-run结构按父链验证 |

原有已MATCHED且未受影响的A内容不重复对账；新增报告descriptor/typedPOST/心跳标准/审计与消费者差量必须分别纳入其完整CP及全批6b，不能把“无需重复”误用于本次变化。


报告资格 focused/HTTP/UI fixture须同时覆盖启用门店＋启用终端、单侧停用、双方停用、任一作废、启用且NO_REPORT；列表身份集合及详情/历史同资格拒绝见详设§8.5。不得将“未作废”作为报告查询的有效条件；规则固定refs回显与数据库历史保留仍是独立事实。
