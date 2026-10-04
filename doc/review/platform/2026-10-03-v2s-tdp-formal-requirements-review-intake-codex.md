# TDP 正式需求 · 对抗审查 intake

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_REQUIREMENTS_2026-10-03
REVIEW_TARGET=DESIGN
AUTHOR=主 agent（需求作者处置，不是独立verdict）
AUTHORITY=正式需求文档及两轮只读审查；源码/运行 NOT_AUTHORIZED
```

## 1 · 原始目标与证据边界

Dexter：“请整理并生成正式的需求文档并完成两次对抗性review”。
正式需求只表达已裁决 B/C、十一类topic、两feature、主机数据/副机同步和纯terminal-control记录能力。
不新增移区/移店/改项目业务，不撤回既有脚本产品裁决，不把后续设计或动态验证写成已完成。

有效第一轮：fresh `/root/tdp_formal_requirements_r1_fresh`，NO-GO，M/S/N=0/1/2。
报告/checklist分别见同目录 `2026-10-03-v2s-tdp-formal-requirements-review-r1-report-codex.md`、
`2026-10-03-v2s-tdp-formal-requirements-review-r1-checklist-codex.md`。
此前输入顺序失效尝试见 `2026-10-03-v2s-tdp-formal-requirements-review-attempt-log-codex.md`，不算有效轮次。

第一轮输入hash：`bd36b68c7aff83ac1ce5eb54ac9f1920c9b9aa3bc92e49e8ff2a2aa8572999ec`。
送第二轮修订hash：`dd930a330c1e84e53f19e708a8c92956ff9043b1c5a0d50dd9c405f182193fbb`。
第一轮verdict不被改写为修订字节verdict。

路由计数补核：主agent用当前required-inventory相同六维/all条件复算，platform=33、backend=13、
union=34。第一轮checklist写backend=14的计数不被继承；其实际列出的完整union34路径与当前分母一致。
此处只纠正导航计数，不修改第一轮独立报告、不把六维结果当作业务结论。

## 2 · 主 agent 逐项核实与最小处置

| finding | owning source/原输入重开与反例 | classification | 处置/验证边界 |
|---|---|---|---|
| S-1 服务点移区验收 | StoreServicePointService.java:638—703 update沿before.areaRef且SQL不更新area_ref；:768起movePoint限原area；Dexter只要求全店ENABLED目录及详情 | CONFIRMED | 正式需求R12/V14改成现有创建/状态/内容/原区域排序，不新增移区；下游真实动态仍NOT_RUN |
| N-1 脚本类别限制 | terminal-coding-standard TR08:291—294；newposv1 build-order:728—750 T11明确远端脚本源；Dexter通用层不限制command业务类别 | CONFIRMED | §0.1/R13仅排除本期CBS脚本业务接入/远端安装command定义，明确不撤回scripts.execute、不建通用类别禁令 |
| N-2 runtime晚完成记录 | requestLedger.ts:145—153 never/isolated；createCommandActorDispatcher.ts:347—367 late事件无result；正常selector不能证明晚完成result可保存 | CONFIRMED | §8把真实观察接缝写明，仍技术OPEN；后续详设必须落实remote-only command链和反例，不在需求阶段改runtime或持久所有ledger |

最小替代比较：修改例子及准入描述已能解决需求表达问题；增加移区业务、TDC业务重试框架、
永久脚本禁令或全ledger持久化均不是本任务要求，会增加阶段成本与事实/owner风险，拒绝采用。

## 3 · 同根扫描与对 reviewer 的局部证伪

范围/关联动作全集：R05、R09、R11、R12、V06、V12、V13、V14。

- S-1范围内移区已确认；V14改为真实owner允许的动作。
- V06原“移店”不能被解释为合同可更改store_id，改为并发创建/状态退出及不同门店scope隔离。
- V13原“换项目”也不能用来新增门店改项目。第一轮同根说明仅凭StoreServiceSql的SET project_id
  即认为可变，主agent对此局部前提标记 `REJECTED_WITH_EVIDENCE`：
  corpus G04:69—71明确项目+经营租户+品牌锁定；
  `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/OrganizationStoreUpdateRequest.java:5—13`
  更新wire没有projectId/tenantId/brandId；现有controller:55声明更新时重新读回不可变关系。
  SQL列可写不等于公开业务命令准许改变。正式需求R11/V13改为合法绑定切至另一门店时退旧订新。
- R05新增不解锁既有关系、不新增迁移command的总边界；R09只处理当前集合/绑定订阅变化。

脚本族全集：§0.1、R13、R17、V16/17。当前scope是helloWorld闭环，不实现脚本业务；
通用注册command通道不按脚本类别禁用，未知/未注册/非法参数继续按契约拒绝。

记录族全集：R14—16、V18—23、§8生命周期/容量/失效绑定三项。
保留在线执行与结果未知，补报保存事实、CBS持久接收确认、重复不执行、身份不重绑。
当前取消激活/reset仅server-config留存与新远程记录保存需求可能冲突，明确列OPEN交后续设计/Dexter，
不把本轮文档授权当成已批准reset保留例外。

完成修订后主 agent 回读了同一组原始裁决、源规则及当前R/V文本；未运行生成/编译/测试/verify/DEV。

## 4 · 通用失败模式与防再犯

主防再犯落点：本 cycle 第二轮 reviewer checklist，需核验以下有限反例（不新增机器门）：

1. **把底层SQL可写或move方法名当作业务可变性。** 根因层：公开契约/owner业务准入未闭合。
   适用范围：范围成员、关联变化与动态fixture；反例：合法状态迁移/原区域排序不受限制。
   最小解：原始规则→公开command/wire→owner→SQL联合核实，验收不新增动作。
2. **把当前业务非目标升成平台长期禁令。** 根因层：通用协议与CBS contract接入范围混淆。
   适用范围：远程command类别；反例：未注册/参数非法仍拒绝。
   最小解：通用层按注册与contract接线，当前业务scope在CBS声明。
3. **把内存快照当成全部生命周期和持久事实。** 根因层：实际观察/持久确认边界缺口。
   适用范围：远程request过程、late结果、断链补报；反例：不要求所有本地command历史保存。
   最小解：详设明确remote-only观察/command/持久接收，未知不虚构result。

这三项均在正式需求拥有相应判据；review checklist负责防再犯，未在review文件另立长期产品规则。

## 5 · 第二轮与结束状态

fresh `/root/tdp_formal_requirements_r2` 已完成第二有效轮；冻结字节独立结论为
`GO / M/S/N=0/0/1`。独立reviewer在读取作者/R1材料前锁定该结论，后对照结论不变，
并在自身报告写最终综合及 `ROUND_FINAL_DECISION=SELF_DECIDED`。主agent仅整理落盘，不代写verdict。

第二轮报告/checklist分别见同目录：

- `2026-10-03-v2s-tdp-formal-requirements-review-r2-report-codex.md`。
- `2026-10-03-v2s-tdp-formal-requirements-review-r2-checklist-codex.md`。

第一轮S-1/N-1/N-2均已在第二轮冻结字节独立核实闭合；生命周期观察本身仍为后续技术准入OPEN，
不是已经实现。第二轮新增唯一N-1处置如下：

| finding | 主agent重开材料、反例及性质 | classification | 最小处置与边界 |
|---|---|---|---|
| R2 N-1 V13独立时间措辞 | R11:194明确门店规则根JSON共享门店时间；StoreService.java:541—575提交规则JSON与time.currentEpochMillis；application/persistence/StoreServiceSql.java:25—27在同一store行更新规则和updated_at_epoch_millis。规则topic可独立，project/region/group各有时间，不推出新的规则时钟 | CONFIRMED:验收措辞歧义；未认定已选择新字段 | 只将V13:323末尾改成“各实体保留自身原始时间，经营规则topic身份独立但使用门店根时间”。无需Dexter新裁决，无源码/字段/migration变化 |

同根扫描：R04—09、R11/12、V03—14，以及“独立/时间/规则”命中。
规则时间唯一有歧义的位置是V13；R11:194与202及精确/范围时间规则仍一致。
更小替代为保留R11并只澄清一个验收短语，已足够；新增规则时间字段、独立时钟或version均拒绝。
通用失败模式为“独立topic身份被误解为独立业务时钟”；有限适用范围是同一实体拆多个topic，
反例是project/region/group独立实体确实保留各自时间；最小解是按真实事实行与原始时间来源声明，
防再犯已落到第二轮report/checklist及正式V13，不新增机器门。

主agent修订后回读R04、R11、V13、原始“业务记录原始更新时间”裁决与上述owning source，
保持原需求范围。主agent一次错误猜测StoreServiceSql包路径已通过rg定位到persistence子包纠正，
没有以工具路径错误推导能力缺失。

## 6 · 最终字节、两轮收口与未运行项

有效第一轮输入hash：`bd36b68c7aff83ac1ce5eb54ac9f1920c9b9aa3bc92e49e8ff2a2aa8572999ec`，
独立 `NO-GO / 0/1/2`。

有效第二轮输入/结束hash：`dd930a330c1e84e53f19e708a8c92956ff9043b1c5a0d50dd9c405f182193fbb`，
独立 `GO / 0/0/1`。

第二轮后仅按N-1作上述一行等义修订；最终正式需求仍417行，hash为
`ba117d623bfa0663980c1ca6532b714e1a5eae19c51bbe28c7a8bce553ba4f44`。
最终hash不冒称另获fresh独立GO；第二轮冻结verdict及severity不改写成0/0/0。
正式需求header保持原审查入口metadata，完成状态以本intake及两份独立报告为准，避免再改被审header。
本cycle已完成两有效轮并关闭，失效输入尝试不计轮次；不召第三轮。

正式需求包含R01—20、V01—24；§8技术准入及失效绑定留存/接纳、保存期限产品取舍继续OPEN。
这些是后续详设必须明确的事项，不是作者本轮已批准的reset保留例外或长期保存承诺。

本期源码实施、生成、编译、构建、测试、verify、DEV、backend-acceptance、reset/seed、L2、UAT与部署
均未运行，V01—24为NOT_RUN。没有本任务新建的运行资源，cleanup为N/A，不报business/cleanup PASS。
另一专项的并发实现不作本期证据。最终完成条件为正式需求、两份fresh独立报告/checklist、逐项intake
与最小文档修订均已归档；本轮没有实施或动态运行授权。

## 7 · 两轮结束后Dexter补充：业务feature数据与topic映射

本节是2026-10-03新的用户直接需求，不是第三轮finding或独立verdict。§6的417行/hash为本次补充前
快照；R2冻结GO不覆盖此次新增要求后的字节，未重开已关闭cycle、未发起新审查或实施。

原始目的：feature按业务需要保存数据；完整集合HTTP响应可支撑范围及多个详情topic，
避免因topic数量造成重复接口调用。集合变化先比较、更新本地，再差量订退；详情通知仍查单实体。

落点与同根修订：

- 正式需求R07固定slice/topic非一一映射；R08明确同包刷新command按范围/详情选择HTTP，
  不把复用刷新入口误解成每次重拉初始全量；R09移除“新增成员必须再读详情”的歧义，
  区分完整集合响应与ref/摘要不足；R11固定门店完整ACTIVE合同列表查询与单合同详情查询。
- V07/V12补初始集合一次读取、多topic登记、A/B→A/C只退B/订C、完整C不另查及单A通知查A，
  保留空集、部分失败、集合/详情交错和迟到B等异常。§8仍要求真实terminal读取契约闭合。
- `doc/platform/terminal-coding-standard.md` §4-F“使用TDC的业务feature加载与刷新”是后续所有
  TDC业务feature的长期规范正本；项目记忆同名规范指针仅增加入口，不复制规则或新增事实owner。

主agent前后双读：本会话新原话、正式R07—12/对应V、规范§4-F、当前项目记忆指针，
及合同`StoreContractReadback.java`/`ContractTaskReadService.java`、现有feature slice持久化/主副同步样例。
现有合同readback未携带本期需要的原始时间；没有据此声称现成terminal完整合同接口已存在。
最小解是按真实返回字段复用同包业务数据；不新建TDC业务缓存、topic正文副本、跨包刷新框架或次数门。

适用反例：只返回ref/摘要时补必要详情；单个详情通知不能因列表已有记录而跳过查询；
已退订/旧身份/迟到响应不能复活成员；HTTP、持久化或订退失败不得冒成功。
这些通过规范本节评审核验与正式V07/V12承接，不新增关键词门或第三轮review。

上下文六维实际route为design/platform/backend/frontend-platform/owner/task-start，共9项：
6 kernel，以及confirmed-business-language-corpus、business-corpus-adoption-and-read-policy、
business-corpus-parked-domain-intake；均已重开原文。另明确读取deterministic-context-only及
terminal-coding-standard记忆/规范正本。未使用全局memory无关检索命中作为业务依据。
记忆只修改既有正文指针；id/route/assertions/sourceRefs及required-inventory不变，无新索引项。

新增要求后的正式需求437行，hash：
`90481305fb4fbcac767d03440b13ee577b61c5b69c41f8860a389a095f5d6803`。
本次规范hash：`53b46b2caccc56dad31dfe9956fd895de54dd39db2a247ec95e00d445302e187`；
记忆指针hash：`6269011b243b494954edac4672d28de27ac8f94544830005915cbdd4ad75d83c`。
新要求仅完成文档/规范维护；没有修改生产源码/测试/契约，没有生成、构建、测试、verify或动态运行。
V01—24仍为NOT_RUN，没有本任务运行资源，cleanup=N/A。

## 8 · Dexter后续修正：store-service-point等待门店成功command

直接原话：“store-service-point包在激活后，不主动查询，等store-basic包已经获取到门店基础信息
并广播门店基础信息获取成功command后，再执行查询”。本条取代此前R12“独立从当前激活摘要启动，
不依赖store-basic ready”，不是reviewer推导，也不重开已关闭的两轮cycle。

主agent按同根启动路径回读R07/R11/R12、V08/V14、规范§4-F与TR11、项目记忆规范指针，
及runtime公开module dispatch/selector接线与createCommandDispatcher现有多actor处理路径。
本期两个新feature及成功command尚未实施；源码只证实可复用的公开能力，不是新链路PASS。

最小文档修订：

- R07从“一律激活即查询”改为各包遵循批准前提；R11定义门店获取、应用及持久化后成功广播，
  命令名提案为storeBasicInformationLoadedCommand，不要求store-basic全部topic/HTTP ready。
- R12等待该成功事实，当前绑定与门店数据经公开selector核对，再由本包初始化command查询。
  激活/SESSION_READY/旧缓存均不能绕前提；门店失败不广播，下游失败仍由下游负责。
- 已激活重启仍等待本次门店成功获取；晚加载可补读当前绑定、本次启动已成功的事实走同一command。
  初始化进行中或已成功时重复通知不重做初始化；换绑定/取消使旧成功无效，普通后续门店刷新
  不重拉全部点位，点位topic仍按本包刷新。
- V08/V14与§8启动接线准入同步；规范§4-F“feature业务前提与成功command”及记忆指针维护。

有限失败模式：把终端激活/TDC ready当成业务数据ready，或把瞬时成功广播当成可永久补读的状态。
最小解是owning feature的成功command＋有效绑定/本次加载的公开selector，消费者自己的actor处理；
无需新事件总线、callback、通用启动调度或全包屏障。适用反例是只有批准依赖的包才等待，
不能要求所有未来feature都依赖store-basic。前提未满足零HTTP、门店/下游分别失败、其他资料未完成、
ready交错、晚加载、重复及旧绑定反例已落到规范评审核验与V08/V14，不增加机器门。

当前正式需求461行，hash：
`b0007a3eb2276411f6f7ac061b302fad428ae2af156842eada71c76baed9826a`。
本次规范hash：`6ab93e55a95d3725cd8eff98ee17a2079b384269d7bc7522cc0de3fcedd1557f`；
记忆指针hash：`63a6d7ecc00f0ea6194e8e5ec352cdecf3e753c129754356cee6afbd3a88a54d`。
§7的hash仍仅标识上次用户补充后的快照。两轮独立verdict均未改写为新增条款后的verdict。
本次只做需求/规范/记忆指针维护及文字回读，没有新增源码/测试/契约或运行生成、构建、测试、verify、
DEV等动态动作；24V仍NOT_RUN，没有新增运行资源，cleanup=N/A。

## 9 · Dexter后续补充：DEV数据同步必测场景及业务边界

原话：“需求中还有明确必测试的场景（详设必须包含但不仅限于），比如通过DEV的管理后台更新了
门店信息，TER要能同步更新等等。仅做各种数据同步的测试，不做业务逻辑判断，比如门店被停用，
不需要TER业务处理”。本轮只整理该直接要求，不是动态执行或新的独立review。

正式需求§0.1限定B及两个数据feature的数据基础能力：停用字段须同步，不要求TER新增登出、
停机、业务阻断或取消激活。集合条件/成员增退/时间确认仍属于数据正确性；CBS既有合法写入约束、
身份和已批准会话行为不被弱化。C远程command的过程/结果及补报验收未撤回。

§7.1以DEV-DATA-01～16列最低必测分母，关联现有V而不替换24V：

- 01～12覆盖十一类topic的真实DEV运营后台修改链路，门店状态另列一项。各实体时间、规则共用store根时间、
  合同集合/单合同、区域目录/详情和点目录/详情均分别有数据oracle。
- 13～16固定启动顺序、重连/在线同值、十一类主副同步及故障/竞态。部分反例可由focused辅助，
  不能替代后台真实控件→CBS→TDS/TDC→feature HTTP→slice/持久化及副机投影的DEV证明。
- 详设§11a及实施计划须逐项选真实可编辑字段/合法状态、受管执行面、selector和持久化断言、日志、
  fixture/runner cleanup；不以mock、手动广播、改库/改slice或HTTP成功充当端到端数据更新。
- 不新增管理页面；DEV使用现有后台不冒称隔离browser L2/UAT。时间相等的离线漏通知仍有已接受限制，
  没有把此测试清单变成新的可靠性或业务联动承诺。

同根回读：正式R03—12/R19及24V、规范§4-F和记忆指针；静态定位现有operations-admin的
store-management、organization-structure、contract-management、store-service-point页面/Drawer，
读取受管browser L2拓扑decision区分DEV与L2资源。仅文件定位不证明控件操作/链路已运行，
详设仍须重开当时owning source选择合法动作。一次apply_patch上下文不匹配已按真实文本纠正；
没有以工具失败推导产品阻断，也没有运行推荐runtime skill中的动态动作。

最小方案为需求内必测表＋规范“数据同步验收边界”及记忆指针；不增加业务资格算法、
统一业务恢复框架、次数门或重复全量运行关卡。反例是范围谓词/详情订退仍必须验证，
“不测业务逻辑”不能被理解为只测WS收包；未来feature业务处理仍由其另行批准需求决定。
有限防再犯落点为§7.1逐项数据断言与规范边界，不恢复控制面或新review cycle。

当前正式需求515行，hash：
`72d56c0df39c24a4fbf7c8eb1e361bd9b7aa6415897d85ef66f96a8639b2eae2`。
本次规范hash：`417f66f5e02d9e4587d42cab855ad08b476fca48859853c34a24c24351255024`；
记忆指针hash：`c53b97249ad7539155596df1d607659e69ed14b9d1dd370fa90abe1385097891`。
前两轮报告和§6—8各自hash继续保留历史适用范围，不继承为本轮字节独立GO。
记忆仅增正文入口，id/route/assertions/sourceRefs分母未变；没有修改源码/测试/契约或生成索引，
未运行构建、测试、verify、DEV、reset/seed、L2/UAT等。24V和16项DEV-DATA均计划/NOT_RUN，
没有本任务运行资源，cleanup=N/A。

## 10 · Dexter后续修正：collectionHash与订阅对象身份

Dexter直接授权将范围缓存由refIds改为resultHash/collectionHash，字段由作者选择。
本次选collectionHash；正式R-05/R-06改为只保存完整topic身份、摘要与原有topic时间，
不增加memberCount：固定空集合摘要已足以判断A/B空非空分支。只摘要化成员ID，不摘要正文或时间，
稳定去重/排序/无歧义编码，HTTP/feature仍取得真实完整数据。无缓存与已有空缓存分开，
重启保留空摘要及A；事务/并发、提交后通知及同值漏通知限制不变。

订阅对象采用topicKey/ownerRef，项目详情对应项目ID、门店合同集合对应门店ID；
服务端仍核验当前绑定的集团空间和允许关联范围，不能把客户端ref当授权。
对象身份不抹去首次本地时间、具体通知确认或多feature订退归属，A/B店实例保持隔离。
正式R-03、V-02/V-04和§8、规范§4-F、记忆正本指针同步；讨论稿仅增加后续裁决指针，
不篡改旧讨论与§10原始引用。旧refIds原话由最新直接裁决明确取代。

同根前后回读：本会话最新原话、R-03/R-05/R-06/R-07/R-08及对应V与详设准入、
规范§4-F、terminal-coding-standard记忆指针和旧讨论缓存段；范围集合的业务语义与HTTP列表
依旧是refIds，删除的是CBS缓存中的持久成员列表，不对所有refIds字样作机械替换。
六维route为design/platform/backend/frontend-platform/owner/task-start，9项路径与前次相同；
另读取deterministic-context-only及适用规范指针。一般失败模式是把变化检测缓存误当业务数据副本、
把最小对象标识误当整个协议或授权身份；最小解为摘要缓存和对象/绑定/确认的职责分工。
反例落到V-02/V-04/V-06/V-07：顺序/重复不改变摘要、空集A重启保留、不同店隔离、
跨空间拒绝、首次时间和更新确认仍有效；不增加新门、全局恢复或第三轮审查。

本次正式需求hash：`631635810d51a5ddf9d913f54d40cc92546a577e830c3fae76fac0784a631bf6`。
规范hash：`f8001b2e803e9aa39740d9015bc202ec25c0f6c211f3b57d14d2aaa4909f22c5`；
记忆指针hash：`92c084a4d3c14bfd4ebab2660b232bb11346d5772e2a1637b5b9163a25acb5d6`。
仅静态文档修订/回读；记忆元数据分母不变，无索引生成、源码/契约/测试实施或动态运行。
两轮cycle继续关闭，本次字节没有独立verdict；24V与16项DEV-DATA仍为计划/NOT_RUN，cleanup=N/A。

## 11 · Dexter后续要求：逐topic计算和真实command接线

直接原话：“初期我们约定好的这几个topic，每个topic的计算逻辑，尤其是集合topic的计算逻辑，
在需求里都应该约定好，在哪个command里面增加环节都要列出来”。正式需求新增§4.1a/b/c，
保持R01—20/V01—24分母，不增业务实体、topic类别或动态授权。

主agent先回读R03—06/R11—12及上一轮SQL/hash裁决，使用仓内cs-code-structure-recall定位公开API，
重开ContractCommandService的typed/旧参数create/update/invalidate、完整正文/扩展值写入、receipt与SQL，
确认真实HTTPoperation只转调事实owner。organization交只读子agent提取源码inventory，
主agent独占文档写入，再由该agent对新增organization表作定向source-to-doc核对。
agent两次返回均完成：源码inventory＋新增表核对，无文件写入、无运行、无review verdict；
不重开已结束DESIGN cycle，不把这次定向核对包装成独立整批GO。

源码边界核实：十一类精确/范围事实的表、ID和原始时间分别列出；三个集合谓词固定，SQL唯一/有序
计算collectionHash与B，A取触发实体实际写入时间。Store/规则共享root时间；合同内容update只发详情；
区域/点位整表单update也改status，不能只挂transition；swap实际修改两条详情，目录不变；
内部PROJECT分期及旧参数mutation核心一并覆盖，不按HTTPwrapper重复发布或漏接。
父区域状态、二维码、管理排序能力等派生readback不由point原始时间覆盖，terminal本期投影限定
原始实体事实；不为填补派生时间扩大级联写入或TER业务判断。

有限防再犯：§4.1b的完整command表及V01/V14对应静态、focused和真实DEV断言；
旧重载、receipt回放、无写入重排、同毫秒、回滚/并发、跨店、整单状态和双实体交换为反例。
最小解为现有owner mutation内有限显式接线；没有动态规则引擎、全局扫描、通用outbox或新业务入口。
主agent最后回读§4.1三节与当前源码/agent清单并检查相邻R/V和§8一致；未修改任何生产文件。

正式需求当前hash：`1cf2a17d5753b714c4c9a20063840b02bf05b7a831a8421e4e835884205a122b`。
之前§10的hash仅代表其当时字节；SQL优先实现补充和本节逐topic表均为后续用户要求，
旧独立verdict不覆盖当前新字节。所有新能力、24V及16项DEV-DATA仍计划/NOT_RUN。
本次仅需求/来源记录修改，无生成、构建、测试、verify、DEV、reset/seed、L2/UAT，cleanup=N/A。

## 12 · Dexter范围裁决：REGION商业集团父引用必填

Dexter明确确认“这个要补齐，REGION的parentID不可以为空”，将CBS真实关系及已有数据补齐纳入本期，
取代旧按集团空间单独发现集团的TER规则。不是reviewer建议，也不只是改一个DTO显示字段。
正式需求增加R-11.1，同步§0.1、R11读取链、§4.1b NODE-REGION、V13及§8；
规范§4-F和项目记忆正文指针同步。讨论稿旧源码观察只保留为历史并加明确后续裁决指针。

主agent重开createRegion:84/:101、validateParent:1178、typed/旧update持久父引用比较、
OrganizationHierarchyServiceSql及现有schema定义，确认当前REGION传null且校验要求null，
不能把这条关系描述成已存在。另重开CommercialGroupReadback、OrganizationCommandPersistence
对commercial_group_uuid的UUID投影及requireCommercialGroupRef:395；目标是公开商业集团UUID，
不是内部自增ID、集团空间ID或GROUP组织节点。Corpus G02三层业务树与此目标一致，未改写语料正本。

最小方案：现有owner创建核心保存当前空间真实商业集团UUID，普通更新/状态保留不可清空关系；
新增单一Flyway迁移匹配已有记录并落实REGION条件非空，错误/歧义引用fail closed。
详设必须检查CBS公共/旧参数/数据库/后台/generated/读取路径/范围判断/seed与fixture/TER完整影响链，
补齐时间/version和topic处理，不通过reset、临时DTO或客户端fallback掩盖持久事实缺失。
不新增集团选择UI、换集团command、多级大区或第二组织事实。一般失败模式为业务树已表达关系，
持久关系却为空，导致客户端多条发现规则；最小防再犯落点为R11.1数据库/owner/读取要求及V13正反例。

这是Dexter实质补充的需求范围，当前meta明确SCOPE_AMENDMENT；旧两轮cycle保持关闭、旧verdict
不覆盖这项新范围，不自动发起第三轮或新cycle。若后续获授权审查新范围，应说明该范围触发，
不得借局部措辞修订重置旧轮次。本次没有任何实施或动态运行授权。

正式需求hash：`b75f0380c276e50ecede63e216d8f0fd8f28994d0eddc3dfb35847607445c84c`。
规范hash：`3a0174dc948874366a62fbf61437f35ecbd191c64905f761818cb064bd6fda69`；
记忆指针hash：`fcf530e2b949ed2a36030d59c5846ab608e6728ee86bfa2736d320abd60d769a`。
记忆id/route/assertions/sourceRefs未变，不生成索引。仅文档/规范指针与来源记录维护；
源码、契约、migration、seed及测试均未修改或运行，新关系和全部动态验收仍NOT_RUN，cleanup=N/A。


## 13 · Dexter简化裁决：两个feature合并为store-basic（2026-10-04）

直接原话：“修改一下需求文档吧，两个feature包合成一个吧，不需要那么多”。
当前正式需求R-11统一为apps/terminal/kernel/feature/store-basic；R-12保留需求编号，改为同包
服务点区域/服务点职责，不另建store-service-point包。十一类topic、原始时间/collectionHash、
HTTP与集合详情复用、订退/确认、持久化及主副同步要求均不缩减，24项V与16项DEV-DATA分母保留。

启动前提仍为本次当前绑定的门店基础信息取得、应用、持久化成功；之后经同包command启动服务点，
不等待其他资料全ready，服务点局部失败不回滚门店成功。门店成功command按R11保留广播，
本期不再要求另一个feature安装/跨包订阅、晚加载补读或转发桥；重启/晚安装整个store-basic
仍走本次门店加载及同包初始化，重复/旧绑定/迟到响应隔离要求保留。数据及局部加载状态归同一owner，
不强制合并成巨型actor/slice，不新增通用调度/恢复框架。

主agent回读原始用户裁决、当前R07/R11/R12、V08/V14、DEV-DATA-13及§8，修改这些当前条款，
同步终端规范§4-F及记忆正文指针。讨论稿首部说明旧双包正文仅为历史，用户原话及旧review不改写。
通用跨feature command/selector、TDC多消费者V11及单消费者失败责任仍保留，不以本期单包删除通用能力。
只读子agent职责仅为定向文档一致性核对，不写文件、不运行动态命令，不产整批verdict或重开DESIGN cycle。

当前正式需求hash：d321237e7aa19c7ba3267606ff407e95fcccd9a311d3b628020d523cc1145916。
终端规范hash：1ebe02c0e2f63eac8e0a2950ae75b262f227e2fecb162af6dbb2f406af089bc5。
记忆指针hash：f6075eef915ee931932e3ee734113d764128630c5af0689762bfe503c0802704。
原两轮及此前hash只代表历史字节，不覆盖此次合并。记忆元数据未变，不生成索引。
本次仅文档修改，无源码/契约/依赖/迁移修改，无生成、构建、测试、verify、DEV、reset/seed、L2/UAT；
新包及动态行为仍NOT_RUN，cleanup=N/A（无新动态资源）。

定向核对结果：只读agent tdp_feature_merge_consistency已正常完成，报告正式需求唯一owner、同包
command前提、十一topic表、R/V/DEV映射、规范和记忆指针一致，未发现本次合并残留矛盾。
它核对的正式需求hash与上述hash一致；未写入文件、未运行环境，不将此结果冒称独立整批DESIGN GO。
主agent再回读R11/R12、验收映射及作者处置记录，确认当前任务仅文档且已完成；active goal为无。


## 14 · Dexter要求的作者全文一致性校正（2026-10-04）

授权原话：“你再自己review一下整个需求文档，看看有没有上下文不一致，前后矛盾的地方，全部改好”。
本次为作者全文核查及文档修正，不创建新DESIGN cycle，不修改旧独立verdict，不产整批GO/NO-GO。
主agent全文读回§0～10、R01～20（含R11.1）、十一topic/十五command组、24V/16DEV及规范§4-F，
按review/platform/backend/platform/governance/task-start路由回读适用项目记忆；原始用户裁决仍优先。
两名只读agent分别辅助核查数据/初始化与远程/范围/验收，没有文档写入、运行或verdict授权。

确认并校正的同根问题（全部为文案一致性或既定要求的追踪修正，不新增产品裁决）：

| 问题族 | 核验与最小修正 | 处置 |
| --- | --- | --- |
| 通用排序列与实际成员ref不一致 | R06原ORDER BY id与4.1a区域area_ref/点位point_ref不一致；统一实际引用列，三集合都明确hash及B计算；CBS内部摘要不要求生成到TDC | CONFIRMED，已修正R06/4.1a |
| 本期门店初始化与下游前提混写 | R07明确首门店查询不要求先有门店成功；服务点才等待本次门店应用持久化，不等待全包；逐数据登记topic | CONFIRMED歧义，已修正R07 |
| 去重周期与重启/重连混写 | R12的“当前绑定已成功不重做”限定同一本次启动周期；重启仍HTTP，纯连接重连重发有效订阅与已接受时间，不回退空集合0 | CONFIRMED歧义，已修正R07/R12/V08/V14/DEV14/规范 |
| 共订后加入消费者与已有通道关系不清 | 首次HTTP/初始差异核对不因已有通道跳过，不用迟加入者初始时间回滚已接受时间；无持续per-feature版本、仲裁或全包屏障 | CONFIRMED歧义，已澄清R08/V11 |
| 集合接受、完整详情与订退结果混写 | 集合所需数据成功应用持久化才确认；缺详情/详情失败、订退失败分别可见，不虚构相应成功，不回滚正确集合；合同完整响应要求不削弱 | CONFIRMED歧义，已澄清R09/§8 |
| 投递故障隔离与CBS同事务缓存维护易混 | R16明确隔离的是提交后投递/回传，不能允许CBS写成功但范围缓存维护失败；R06/4.1c同事务要求保留 | CONFIRMED歧义，已澄清R16/§8 |
| 远程负例及有限去重追踪不全 | R13要求协议不支持/失效身份，补入V17；V18及§0.2沿用R14有效记录范围，不暗示无限期exactly-once | CONFIRMED追踪缺项/措辞，已修正V17/V18/§0.2 |
| 当前授权与旧两轮措辞 | §0及meta区分本次作者校正与已关闭审查；§10原话保留按后句替代，不把旧refIds/两包作为现行条款 | CONFIRMED时态，已澄清 |

反例清单：区域/点位使用错误排序列；同绑定重启凭旧成功跳过服务点查询；仅socket重连覆盖已接受100为0；
迟加入共订者漏首次核对；缺详情或订退失败被范围ACK冒充成功；投递失败隔离被误用为允许缓存未写；
未知协议/失效身份远程请求未列负例。防再犯落点为上述R/V及规范本次周期限定，未新增机器门或恢复框架。

只读辅助均正常完成：数据agent指出排序列与初始化周期歧义；范围agent指出V17追踪遗漏，其余疑似
在线/补报、权限/纯能力、脚本范围、§11a模板与历史原话冲突经上下文反证不成立，不据此增加要求。
主agent逐项亲自重开正式文档和用户原话后修改，再回读同根R/V/§8；数据agent再次只读回查新字节，
未发现新增产品语义或相邻冲突。当前源码仅核对协议65536、REGION旧null、runtime晚到事件缺result等
已引用静态边界，不把它们升级成新能力运行证明。

CBS无缓存空集合初始化/批量A取值、具体容量与留存、失效绑定记录接纳等仍按§8诚实OPEN，
本次没有替Dexter决定产品取舍，亦未展开详设。11topic、24V、16DEV及单store-basic分母保持，
所有新增生产行为与动态场景仍NOT_RUN；源码、测试、契约、依赖、迁移与runtime证据未修改。
未运行生成、编译、测试、verify、DEV、acceptance、reset/seed、L2、UAT或部署；cleanup=N/A。

当前正式需求SHA-256：`a456301df1a4e376e86ee18fab177304a2328ba3d875dc3ff3d2d43713d0a5ea`；规范SHA-256：`47d6b212b87e166de3effb7059de65dbe3f806cff940104f7fdf7f20da43c1da`。
