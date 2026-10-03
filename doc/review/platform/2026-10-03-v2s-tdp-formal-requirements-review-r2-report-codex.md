# TDP 正式需求独立对抗审查 · Round 2

本报告由 fresh 独立只读 reviewer `/root/tdp_formal_requirements_r2` 形成；主 agent 仅整理落盘。判断对象是正式需求准确性、范围与验收可落实性，不是未授权的实施详设或代码交付。

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_REQUIREMENTS_2026-10-03
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-03-v2s-tdp-formal-requirements-review-r2-checklist-codex.md
blindReviewDeclaration=先独立读取原始输入、正式需求全文、适用规范、路由记忆及真实owning source，以证伪立场形成结论并向主agent锁定；之后才读取指定R1报告/checklist和作者intake。
authorMaterialReadAfterIndependentVerdict=true
ROUND_FINAL_DECISION=SELF_DECIDED
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO
M/S/N=0/0/1
L1_ENGINEERING=PASS:正式需求层；N-1为非阻断验收措辞澄清
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:本期B/C无前台、页面或新增用户操作
L3_UNVERIFIED=空:本期UI分母为空；动态能力验证另列NOT_RUN
SAME_ROOT_SCAN=见同根扫描及R/V对账
DESIGN_GAPS=见后续设计OPEN；未把已明确的后续准入当作本阶段缺交付
TEMPLATE_COVERAGE=见四模板逐节N/A理由
EVIDENCE_TIER=只读静态正式需求/规范/源码审查；动态NOT_RUN
```

被审对象：`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md`，全文417行。输入、独立结论前及结束复算均为：
`dd930a330c1e84e53f19e708a8c92956ff9043b1c5a0d50dd9c405f182193fbb`。

本结论绑定上述字节。本轮未修改目标；主 agent 后续若按N-1澄清文字，应登记差量及新hash，不能把冻结hash写成修订后的hash，也不再召第三轮。

## 独立方案合理性判断

真实目标是：在线MASTER获得变化提示后由业务feature自己HTTP读取、更新并保存业务slice，通过既有owner同步给SLAVE；CBS通过已注册command实施远程能力，保存发送、实际过程、结果和未知，并接纳终端重连后补报的已保存事实。本期不设计前台、业务权限产品或离线执行队列。

较小替代一是feature只在启动时HTTP读取。这能减少协议，但不能满足在线变化通知和远程操作。较小替代二是直接让TDC持有所有业务HTTP与slice。这减少feature接线，却把业务owner移入基础层，违背明确分工并增加多feature和主副同步耦合。更强的消息日志/单调版本/通用恢复框架可提高漏失可靠性，却改变Dexter已接受的原始时间限制和在线执行边界，不属于本期。

当前最小方案合理：沿用已存在的CBS、PG、TDS/TDC、runtime command/actor与feature持久化/同步；WS承载有限提示与操作事实，业务正文由HTTP读取。成本集中在topic契约、owner派生缓存一致性、terminal读取身份与runtime真实观察接缝；这些必须在后续详设闭合，正式需求已明确其OPEN。本轮没有发现需要扩大产品范围才能使正式需求成立的M/S。

## 动作1-B实际提取

| 提取面 | 当前独立提取 | 结论 |
|---|---|---|
| 模板整节/整列 | Journey、IA、interaction、implementation模板全文均已读；目标为正式需求、无UI、无实施授权 | 独立模板工件逐节N/A有理由，后续适用义务仍保留 |
| 文档与源码冲突 | V-13:323“规则变化与实体时间独立”可能误指规则拥有独立时间；R-11:194及StoreService共享门店根时间 | N-1澄清；不新增字段/时钟 |
| 值与出处 | 初次空0来自原输入；100/200为通知关联例子；65,536来自现有协议；十一类=R11七类+R12四类 | 没有把例子升成产品容量上限 |
| 来源与权限 | 商业集团不是GROUP组织节点；Store项目/租户/品牌锁定，point更新不改areaRef；旧HTTP目录非VOIDED、合同CURRENT含日期过滤 | 已在需求区分，新读取闭包不得冒用旧谓词 |
| 当前能力与计划 | protocol只有AUTHENTICATE/SESSION_READY/PING/PONG；generation只覆盖激活/取消；ledger不持久、late-completed不带result | §8如实记录接缝；不把计划写成现成能力 |
| 未决值与验收 | wire精度、容量、留存、批量A、无缓存空初值、失效绑定补报均有具体准入位置 | 后续设计OPEN，不能要求本阶段实现 |

提取非空，没有用材料存在或历史PASS替代内容核验。

## Finding

### N-1：V-13应区分“独立topic”与“独立更新时间”

位置：目标`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:323`；相对判据`:194`、`:202`、`:87`—`:91`。

Owning source：
`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java:541`—`:578`；
`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreOperatingRuleReadback.java:9`；
`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java:242`—`:272`。

性质：仓内事实已确认；验收解释歧义为推论，非新增产品决策。R-11已正确写“store根JSON与原始时间；独立topic身份”。当前Store update同时提交经营规则JSON与门店资料，并只给该store写一个原始更新时间。V-13末尾“规则变化与实体时间独立”却可能被理解为规则时间必须独立于Store实体时间。

反例与边界：规则topic身份独立而使用Store原始更新时间完全满足原需求；规则变化不应覆盖project/region/group各自的时间。若验收解释成规则必须另有updatedAt，则会要求不存在的字段或产生新时钟，违背R-04/R-11。本轮未据这句话认定作者已经选择新字段；明确的R-11和真实源码足以约束解释，因此是N，不阻断GO。

最小修正：V-13末尾改为“各实体保留自身原始时间；经营规则topic身份独立但使用门店根时间”。保留规则变化时门店/规则相关topic核验的义务，不增加独立规则时钟、version或迁移。

Dexter决策：上述澄清不改变原输入，无需新产品裁决；若要使经营规则拥有新的独立时间事实，必须另交Dexter。主agent须独立intake，不能把reviewer建议自动视为新规则。

## 20R / 24V逐项对账与反例

下表“成立”指正式需求表达可成立；所有V的动态状态仍为NOT_RUN。

| R / V | 独立反例与边界 | 静态结果 |
|---|---|---|
| R01 / V01 | 新B/C不能由既有四类连接帧推导已经存在；TDP术语以§4-F为准 | 成立；当前与未来分开 |
| R02 / V01 | TDC不得接管业务slice/HTTP；TDS不得保存业务正文或拥有业务写入；凭证秘密不得复制给feature | 成立；公开接线待详设 |
| R03 / V01,V02,V22 | UUID不是授权；同ref不能跨集团/门店混topic；旧session/绑定不能写新身份 | 成立；contract与真实身份闭合要求明确 |
| R04 / V03,V24 | 时钟回拨不使用remote>local；同值在线实际变化通知；同值漏通知不保证恢复 | 成立；接受的可靠性限制未被升级 |
| R05 / V04,V05 | 顺序变化、内容变化不能当成员变化；空非空B/其他变化A；ACTIVE自然过期不退出 | 成立；不借CURRENT/PENDING/HISTORY |
| R06 / V06,V07 | 空集合A重启不能归零；第一分页不是全集；不同快照拼接不是一致快照；通知不是离线队列 | 成立；初始化、批量A、事务/listener接线OPEN |
| R07 / V08 | 已激活启动/晚feature不能等再次激活；HTTP与ready交错不能丢意图；旧local非空也必须初始刷新 | 成立；当前selector可作为前提但新增接线待设计 |
| R08 / V09,V10,V11 | 0→通知100→HTTP仍空应确认100；旧100不能确认200；倒退时间不能按大小排序；X成功不能替Y成功 | 成立；有限通知关联与失败由各feature处理 |
| R09 / V12 | A/B→A须退本包B；迟到B不能复活；部分详情失败不能回滚范围或伪造全成功 | 成立；其他consumer意图保留 |
| R10 / V15 | SLAVE不可独连/HTTP/订阅；本机BRANCH既有输入不被误禁；业务time不可替拓扑session/revision | 成立；既有master-to-slave注册可复用思路 |
| R11 / V05,V13 | 集团不是空间或GROUP节点；Store项目不因SQL可写而可变；规则共享Store根时间 | 成立；V13仅N-1措辞 |
| R12 / V14 | 管理非VOIDED列表含DISABLED；point目录不是按area；point自身ENABLED不被父区effectiveAvailable替代；movePoint只是原区排序 | 成立；不新增移区command |
| R13 / V16,V17 | 注册command类别不由helloWorld限制；CBScontract约束实际下发；未来脚本裁决不因本期非目标被撤回 | 成立；纯能力无管理endpoint |
| R14 / V18 | send成功不等执行；timeout不等回滚/停止；重复operation不重执行；不承诺跨系统exactly-once | 成立；有限去重/身份/关联待详设 |
| R15 / V19,V20,V21,V22 | 内存ledger不能证明持久；late-result当前缺载荷；应用重启只能恢复事实；CBS持久确认丢失仅重报 | 成立；真实观察及失效绑定冲突OPEN |
| R16 / V21,V23 | 无界补报可饿死心跳；不得默删未确认记录；保存失败不能宣称可靠接受 | 成立；数值/留存不在本阶段臆定 |
| R17 / V16 | helloWorld不能改业务数据/地址/激活；无权限产品不等匿名执行 | 成立；安全terminalInfo由后续contract有限化 |
| R18 / V24 | 候选十八owner分类不是全部topic实现；订单模块未来范围不能由名称自动创建 | 成立；广泛清单只为盘点，不是迁移分母 |
| R19 / V01—24 | 计划/历史run不能冒PASS；WS能力断言不能冒HTTP BUSINESS；无UI不强造browser L2 | 成立；执行面与cleanup后续落实 |
| R20 / V06—10,V19—23 | 后续技术方案与产品留存冲突必须区分；不能先实现reset保留例外再寻裁决 | 成立；详设前闭合、产品冲突交Dexter |

## 同根扫描与第一轮比较

作者材料读取前已向主agent锁定：GO、M/S/N=0/0/1及N-1。之后只读指定R1 report、R1 checklist、review-intake全文，没有读本期discussion分析或失效attempt档案。对照后结论未变。

1. 范围/关系/验收族：R05、R09、R11、R12、V06、V12—14全部核验。现有Store wire没有projectId/tenantId/brandId；controller从owner读回不可变关系；StoreService要求项目相等；Hierarchy更新拒绝改变parentId；point更新不改areaRef、move只在before.areaRef重排；Contract更新SQL不改store_id。当前R11/V13以合法绑定切换取代修改原门店关系，R12/V14只要求真实允许动作。R1 S-1修复成立。作者对R1“SQL SET project_id即可变”的局部证伪与独立源码证据一致，不能把R1该旧前提继承为事实。
2. 通用command类别族：§0.1、R13、R17、V16/17已把本期CBS脚本接入非目标与通用层注册command能力分开。R1 N-1修复成立；未知/未安装/非法参数继续拒绝，不新增脚本实现要求。
3. 生命周期/持久族：R14—16、V18—23、§8三行。当前runtime selector/注册dispatch可复用，ledger never及late事件无result已明确；remote-only保存、CBS确认、未知历史、补报不重执行均存在。R1 N-2是后续设计接缝，当前§8已准确写明，不能因此要求本阶段改runtime。
4. 时间/身份族：R04—09、R11/12、V03—14。原始time/协议接受time/拓扑revision职责分开；规则topic独立身份而共享Store根时间是有限反例。N-1仅V13词义澄清，全集扫描未找到其他独立规则时间要求。
5. 防再犯落点：本轮checklist保留三个原问题族（SQL/方法名不能证明业务可变、当前非目标不能升平台禁令、内存快照不能证明持久/晚结果）及新增时间身份区分反例。没有建设关键词gate、receipt或通用恢复框架。

## 后续设计OPEN与未核边界

DESIGN_GAPS为已知后续准入，不是本阶段M/S：

- 原始time单位/无损范围、无缓存空集合初值与批量A来源。
- terminal读取身份、完整范围/时间快照、canonical materialize/codegen与feature接线。
- owner缓存事务/并发、提交后唤醒、TDS session/listener恢复核对。
- runtime公开生命周期观察及晚到result、remote-only持久记录/actor-result关联。
- 容量数值、释放条件、CBS/终端留存；删除未确认记录或产品保存期限须Dexter。
- 失效绑定/取消激活/换店历史合法回传与reset仅server-config保留冲突：不得自行新增保留例外。
- 实际第三方版本与官方依据；本轮未形成依赖第三方运行行为的新结论，不把源码接线当作库运行PASS。

动态V01—24全部NOT_RUN；生成、编译、focused test、HTTP/PG/WS、Expo Web、VM/device、DEV、backend-acceptance、L2、UAT、部署均无本期证据。cleanup=NOT_APPLICABLE_WITH_REASON:未创建运行资源；不能写cleanup PASS。实施前后双读、focused-proof、CP/全批三维对账为N/A：本轮没有实施计划CP和源码变更，不把这些gates移入正式需求交付。

## 四模板逐节覆盖

四模板全文已读；N/A指不要求本阶段创建该类独立工件，不豁免后续详设。

| 模板/节 | 状态与理由 |
|---|---|
| Journey §1元数据 | N/A独立Journey；正式需求§0有任务授权 |
| Journey §2用户任务/成功 | N/A独立Journey；系统任务已在§0.2/R01表达 |
| Journey §3actor前提链 | N/A独立Journey表；系统身份/绑定/ready在R03/07/10/13—15 |
| Journey §4边界/禁推 | N/A独立工件；§0.1及R02/03/13明列 |
| Journey §5corpus | N/A独立Journey表；本轮已实际检索命中与禁推 |
| Journey §6UI/后续工件、§6.1后台一致性 | 各节N/A：无UI、screen、后台变更 |
| Journey §7Dexter裁决 | N/A：不伪造Journey接受；当前授权/§10原话为真实输入 |
| IA §1元数据 | N/A：无IA-ID/screen |
| IA §2、§2.1可见维度 | 各节N/A：无surface/控件/文案 |
| IA §2.2不可见维度 | N/A独立IA表；系统集合/加载/失败语义由R/V约束 |
| IA §2.1.1负载容器 | N/A：无UI容器 |
| IA §3共用规则 | N/A：无页面/导航 |
| IA §4错误映射 | N/A界面表；协议/能力失败仍必须明确 |
| IA §5交叉对账 | N/A本期IA工件；需求/原文/源码已核 |
| IA §6完成 | N/A：不是IA交付 |
| UI §1、§1.1、§1.2元数据/准入/一致性 | 各节N/A：无UI-bearing screen |
| UI Surface ownership、业务语言、owner-definition子节 | 各节N/A：无线框、标签或字段槽位 |
| UI §2Interaction map、§3页面盘点 | 各节N/A：无用户操作或搬运页面 |
| UI §4线框、Screen、testId、roster | 各节N/A：无screen/动作分母 |
| UI 表单依赖、mutation事实矩阵、主从集合子节 | 各节N/A：没有输入/mutation界面 |
| UI 搜索/candidate protocol子节 | 各节N/A：topic条件不是用户搜索控件 |
| UI §5状态/边界、§6任务合理性 | 各节N/A界面表；系统异常R/V仍适用 |
| UI §7face/owner | N/A UI表；系统owner已在R02/03固定 |
| UI §8manifest B4/B5 | N/A screen映射；通用owner/状态标准仍适用 |
| UI §9demo、§10看图 | 各节N/A：无高保真或看图请求 |
| implementation 收录尺度、§0元数据 | 各节N/A实施工件；需求授权边界已有 |
| implementation §1目标/方案 | N/A实施工件；本轮独立方案比较非空 |
| implementation §2CP | N/A：尚无获批实施计划 |
| implementation §3横切机制/第三方子节 | 各节N/A具体接线表；§8保留后续必填 |
| implementation §3aUI/testId/L2 | N/A：无UI、不开发L2 |
| implementation §4门控 | N/A：无实施CP |
| implementation §5operation/path/face | N/A具体设计；canonical及HTTP身份准入保留 |
| implementation §6跨owner写 | N/A具体command矩阵；owner/事务要求已固定 |
| implementation §7声明传递消费 | N/A完整实施矩阵；后续落实R/V |
| implementation §8owner判定 | N/A方法设计；已有owner已查验 |
| implementation §9API/consumer | N/A具体API设计；不凭空生成接口 |
| implementation §9a同步全集、§9b锚点 | 各节N/A：无源码实施变更 |
| implementation §10migration | N/A：本阶段未设计迁移 |
| implementation §10b、§10b.1—6seed | 各节N/A：无数据物化/运行；后续必须盘点影响面与显式授权 |
| implementation §11验收、§11a对照 | 各节N/A可执行fixture表；正式需求24V已逐项核验 |
| implementation §12未决 | N/A实施工件；正式需求§8保留OPEN |
| implementation §13停机 | N/A实施节奏；产品/授权冲突仍交Dexter |
| implementation §13b三维及其子节 | 各节N/A：无CP、focused proof或整体测试 |
| implementation §13c逐代码及反向要求 | 各节N/A：本批没有新实现代码 |
| implementation §14自查 | N/A实施交付；静态正式需求本轮已核 |

## 第二轮最终综合

ROUND_FINAL_DECISION=SELF_DECIDED由本独立reviewer作出：GO，M/S/N=0/0/1。第一轮阻断在当前字节已消除，当前不需新增产品范围才能生成可复核的正式需求。N-1可作等义文字澄清；§8产品冲突仍留给后续设计/Dexter，不制造实施授权。此cycle在第二有效轮硬停止，不召第三轮。
