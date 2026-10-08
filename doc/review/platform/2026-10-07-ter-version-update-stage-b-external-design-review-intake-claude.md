# TER 版本定义、完整更新与热更新 · 阶段 B 外部参考评审 intake

```text
ACTION=AUTHOR_FINDING_INTAKE_AND_DOCUMENT_REPAIR
INPUT_REVIEW=doc/review/platform/2026-10-07-ter-version-update-stage-b-design-review-claude.md
INPUT_VERDICT=NO-GO
INPUT_M/S/N=0/3/8
CURRENT_INDEPENDENT_VERDICT=NOT_ISSUED
AUTHORITY=DEXTER_DOCUMENT_DESIGN_TASK
IMPLEMENTATION_AUTHORITY=false
REVIEW_CYCLE_ID=ter-version-update-stage-b-project-tabs-20261007
CYCLE_STATE=CLOSED_NOT_REOPENED
R6=NOT_EXECUTED_TOOL_LIMIT / NOT_ISSUED
EVIDENCE_TIER=AUTHOR_STATIC_DOCUMENT_AND_OWNING_SOURCE_INTAKE
UI_AND_ALL_DYNAMIC=NOT_RUN
```

## 0 · 原话、输入顺序与范围

Dexter转交外部意见后明确：“内容仅供参考”。未勾选的六项选择不是产品裁决。作者先完整读外部报告，再逐条重开正式需求、适用规范和owning source，比较更小替代；本记录是作者处置，不是fresh审查或独立GO，不接受“review说过”作为权威。

只修阶段B六份设计文档及本intake。未修改A、需求正本、开发规范、项目记忆、源码、测试、依赖或其他owner；未发消息给在途Codex。未运行生成、编译、测试、verify、DEV、Web、设备、reset/seed、L2/UAT或部署，未读取`.runtime/`。纯读命令和主agent文档编辑不构成实现或验证PASS。六维路由首次owner=terminal-update无登记而失败，改为登记的platform路由；路由仅导航，适用判据按当前原文核验，未把失败查询当准入通过。

内部R5已有独立记录；R6尝试因agent thread limit reached未能创建，既有tool-status记录保留。本次是Dexter中转的外部意见intake，不消耗、重开或伪造R6，不用作者修订代独立verdict。

## 1 · 逐条处置（关闭仅指文档问题；运行均NOT_RUN）

| 输入 | 作者分类 / 关闭状态 | owning事实、反例与边界 | 最小处置及当前位置 | Dexter决定 |
| --- | --- | --- | --- | --- |
| S-1 报告可见语义 | CONFIRMED / PARTIALLY | `apps/terminal/kernel/base/terminal-update/src/types/terminalUpdate.ts:24/31`及`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:161/185/216/248/252/254/303`证明reason开放且动态拼码。仅entryKind=file-recovery不证明本次回退；部分accept拒绝未保存recent，不能造报告事实。 | `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:265`、`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:283`定义有限phase/recentState/reasonCode/unknownReason/entryKind和raw白名单；`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:176`逐值中文；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:372`同SQL关联规则/工件结构化事实，不增operation。文档闭集关闭；A最终拒绝/部分成功/恢复readback来源在`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:31`保持OPEN_A_HANDOFF，CP-01前关闭，不向在途Codex加任务。 | 归一无须；A交接未完成不是本轮已通过 |
| S-2 文案一致性 | CONFIRMED（其中动词为DEXTER_DECISION） / PARTIALLY | frontend规范§3-K-2/3/5/6/7；三个详情标题、两列表空态、对象确认缺口成立。不得把非生命周期任务状态套五色。 | `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:17`、`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:31`、`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:133`：对象标题、完整空态/无写cap联络人、绿/橙规则状态、任务Text＋图标已补。包动词现仅旧候选，Journey7.1待决；未宣称“无例外”。 | 包动词待决 |
| S-3 L2生产者/case/TestId/P1 | CONFIRMED / PARTIALLY | browser-l2-runtime当前仅CBS受管后端；报告写需ACTIVE binding与PG session，不能用SQL写fixture。store-terminal-l2-fixture的caseFixtures及scripts/README:181–207提供现成形状和顺序。 | `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:113`十二case→fixtureRef→actions；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:134`及`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md:101`补readiness→同runP1→生成链check→finalize→run；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:157`唯一93个TestId常量，UI及输入表统一引用。报告生产者A/B待决定，REPORT-CURRENT明确BLOCKED。 | L2隔离TDS或调整V-29执行面待决 |
| N-1 耗尽后自重连 | DEXTER_DECISION / OPEN | 独立收益/代价推论成立但不证明旧方案错误：跨通道重连会触发各feature ready核对；pending自然恢复可能长期滞后。原方案是有限一次，不是无限框架。 | `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md:91`并列原方案与较小pending替代；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:265`暂保留原受审方案，明确非新增批准。不给未经裁定的stop/connect写实施授权。 | 保留或移除待决 |
| N-2 双hash/项目锁 | PARTIALLY_CONFIRMED / CLOSED_DOC | 直接删除snapshotHash只有在执行正文不可变时才成立；后台DTO仍有可变revision/updatedAt。AdvisoryLock.java:37–40提供namespaceTag＋UUID现成锁。 | `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:246`执行投影排除可变CAS字段、成员即enabled；绑定唯一collectionHash，末页读权威topicTime，含启停往返hash相同反例。`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:236`点名AdvisoryLock.acquire(JdbcTemplate,int,UUID)。后台detail保留CAS，未删正确事实。 | 无须 |
| N-3 grant门店隔离 | CONFIRMED / CLOSED_DOC | 同project不等于目标规则覆盖boundStore；不能因低影响漏掉现成scope谓词。停用已固定规则仍须能下载，不能加enabled条件中断固定执行。 | `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:257`、`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:236`原关联SQL加ALL或refs含boundStore；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:333`补A/B门店反例、ALL/停用正例。不增查询、表或operation。 | 无须 |
| N-4 参数依据与seed | PARTIALLY_CONFIRMED（单位为DEXTER_DECISION） / PARTIALLY | 原数值是候审技术参数，不是原话/官方值。N/M单位可以与API保存秒分开；改单位不能只改label。DEV边界值不适合体验。 | `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:240`补86400秒、1000字符、5秒×3ACK、32grant/5分钟理由与未测限制；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:388`八条DEV规则N300/M600，1/86400边界只acceptance。分钟/秒尚未选择，所有候选继续明示单位。 | 界面单位待决 |
| N-5 候选复用与动作 | PARTIALLY_CONFIRMED / CLOSED_DOC | useOrganizationCandidates.ts:14/22/33/83支持project与现成GET，但:97–109尚未暴露loadNext；foundation useCursorCandidates.ts:3/43–53已提供防抖/下一页。不能假称只靠现API可直接按钮加载。 | `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:324`门店点名app hook，CP-05仅透传已有loadNext，无第二页状态；候选250ms＋加载更多，列表显式查询。UI/IA/输入表/常量表统一，未改hook源码。 | 无须 |
| N-6 技术词/审计入口/IA | DEXTER_DECISION（大致IA部分REJECTED_WITH_EVIDENCE） / OPEN | 用户已说“大致IA内容已经确认了，可以下一步了”，不能要求重看全部原页面细节。技术词与新操作历史未在该确认中另裁。OperationsAuditHistoryModal.tsx是既有容器，但入口还涉及audit entity/task scope/权限消费者。 | `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md:91`保留技术词/操作历史候选；审计写不等于已具备可见入口，未偷偷添加第十面或第十七operation。`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:362`仅ACCEPTED@2026-10-07（大致IA），不冒称修订逐项被接受。 | 两项待决；不重复申请原大致IA |
| N-7 残留一致性 | CONFIRMED / CLOSED_DOC | report旧Card与最新职责冲突；后台stage/rule字段无A native action事实；TdsDatabasePrincipal是CBS test source，actor截面SHA已漂移。 | `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:302`删扩旧report面；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:358`A action只保留grant/report；UI包表4列、IA无虚构版本filter；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:51`写principal真路径；`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md:19`注明actor旧SHA仅截面，CP-01重开。内部R6完成误称同时纠正。 | 无须 |
| N-8 模板覆盖 | CONFIRMED / CLOSED_DOC | 模板槽位/表格缺口成立；补表应有具体动作理由，不能把统一套话铺成80行。 | `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md:34`逐actor失败事实、§4.1禁推/伪修复、corpus两列；`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md:151`完成块；`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:44`、`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:234`、`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:250`、`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:338`补逐面/状态/每动作/精确operation表，逐动作写实际任务/替代/归因；审图enum全包统一，接受范围仍仅大致IA。 | 新产品选择见Journey7.1，不以补槽位代裁决 |

## 2 · 同根核对范围与反例

九个交互面固定为PKG-LIST/UPLOAD/DETAIL、RULE-LIST/CREATE/DETAIL/STATUS、PROJECT-REPORT/DETAIL。新增内容页仍只有运维包库、运营项目终端版本管理两个；后者两Tab。十六项operation以附件§11.2逐行合同为准（平台5、运营8、terminal3），不是新compliance控制面。

| 问题族 | 修改范围 | 其余核对、反例及不变边界 |
| --- | --- | --- |
| S-1有限显示事实 | 2报告面、2报告GET与WS canonical计划 | 其余7面、14operation已核对：包/规则structured title不改为ref；NO_REPORT/null/UNKNOWN/旧binding不合并；动态raw理由不上送。只返拒绝的A路径明确OPEN，未以schema冒称能力。 |
| S-2标题/空态/确认 | 3详情＋2列表＋启停确认＋包动词候选 | 其余3面已核对（上传、新建、报告）；16operation全表保持原权限，文案不扩写cap，启停入口仅开确认不即写；候选空态不同于列表空态。 |
| S-3执行面/定位 | 全9面TestId、12后台case及8policy/P1接线计划 | 16operation已按fixture/动作回读；报告GET2之外的14operation各有ownerHTTP合法来源，报告仍需TDS选择。三候选与固定refs分页不同，不让L2伪造A native真实版本。 |
| N-1报告恢复 | 2报告面、TDC报告路径 | 其余7面、16HTTPoperation均不改变；不扩topic自动恢复，不加永久失败存储。两候选收益/滞后都记录，不盲从意见。 |
| N-2分页/锁 | terminal snapshot GET1、create/status2 | 其余13operation已核对；后台rule detail保留revision，固定refs不可编辑；hash相同但topicTime不同不构造正文不一致，真正成员变动拒拼页。9面不改变业务任务。 |
| N-3下载scope | grant/content2 | 其余14operation和9面已核对：无公开下载/副机凭证；已停用仍覆盖boundStore可续，跨门店拒绝不使用enabled筛选。 |
| N-4字段/容量 | 新建规则面、create1、WS ACK/grant资源 | 其余8面、15operation已核对：FULL_ONLY不含HOT/M，IMMEDIATE无M；技术32grant不是规则/包数量上限；正常seed与边界fixture分开。单位改变尚未作。 |
| N-5候选形态 | 上传最小FULL、新建包/门店、报告门店4控件；候选GET及既有organization GET | 其余面控件、16operation已核对：列表query/Enter显式；候选防抖、按钮loadNext；固定refs仍cursor pager，selected事实不由当前候选页推翻。 |
| N-6语言/审计 | 包技术词、规则详情附属历史候选 | 其余8面与16operation已核对：报告无历史流水/重试、运维无报告入口；新审计入口不因已有写审计自动视作闭合。原大致IA不重复求证。 |
| N-7残留 | 全6文档交叉回读 | 九面、16operation其余条款已核对，没有新增运维reportGET、旧Card入口或后台native action语义；当前未改源码，旧actorSHA不可作为最终交接。 |
| N-8模板 | Journey/IA/UI全部适用槽位 | 九面和16operation覆盖引用回读；RETired manifest/compliance槽位明确N/A，不恢复；逐动作表区别只读、draft、stage、register/create/status写事实。 |

这些是作者静态核对范围，未声称逐行复核A全生产源码或任何实际动态路径。TestId一致性检查仅比六份设计文本的常量与引用，93个构造并未实现/编译；其中RULE_TARGET_INVALID等错误码不是TestId。

## 3 · 有界失败模式与防再犯 checklist

1. 开放owner错误串不可直接成为公开报告枚举/用户文案；有限白名单＋未分类码；真实事实不足时保留unknown/工程前置，不能从目标/入口猜成功。反例：actor只返拒绝、recovery文件存在但boot未确认。
2. 不同名字表达同一控件会使自动化打假绿；本包只有附件9.1常量表，UI/输入表引用它；同时区分生产读写动作与仅改draft/开弹层。
3. 验收case的每份fixture必须有合法生产者和同run生命周期；后台报告不能用SQL绕过当前binding/session。前置选择未获接受则BLOCKED，计划不是PASS。
4. 删除冗余hash先证明正文不变；Admin可变CAS与终端不可变执行投影区分；ABA有topicTime但无正文变化时仍可接受，真成员变动拒拼页。
5. 复用先核验实际exports：支持project候选不等于暴露loadNext；最小透传既有状态，不写第二分页owner。普通列表与候选交互各自一套，不混用。
6. scope关联要落实既有搜索条件而不是增恢复机制；download须覆盖boundStore，停用规则不改变已固定执行事实。
7. 每个表格单元应解释该动作的实际任务、约束、失败，不把“同原事实回读”或统一口号铺到无关owner。本checklist是当前授权文档内的防再犯落点，不修改项目记忆/标准，不新增机器门。

## 4 · DESIGN_GAPS / OPEN 与裁决

外部报告§5的治理缺口（M/S/N统一定义、候选交互通用判据、跨批状态用色口径）只作导航，当前实际§3-K与已接受IA优先；作者不在B暗中改规范或建立新治理。规范缺失不能用作者自定severity代独立verdict。

六项产品待决集中Journey7.1：L2报告生产者、包动词、报告耗尽恢复、N/M界面单位、运维技术词、规则操作历史。作者已通过异步问题给出候选；没有收到答复，不采用预选，不凭等待推导批准。N-6“大致IA未逐项确认因此需重看全包”的扩大部分有原话证据拒绝，其余真实新选择保留。

A工程前置仍OPEN_A_HANDOFF（最终ZIP/actual HOT/native task readback、拒绝/恢复可读事实）；CP-01只能以A最终交付字节关闭，不把本次字典/计划证明成A验收。依赖精确解析、工具部署、SQL计数/权限、资源容量、全部UI/HTTP/TDP/automation/seed/cleanup仍OPEN/NOT_RUN。stage B实现权限=false，阶段C未授权。

本轮没有新的独立GO/NO-GO与M/S/N；输入旧NO-GO 0/3/8保留原字节归属。作者文档处置汇总：CLOSED_DOC=5（N-2/3/5/7/8）；PARTIALLY=4（S-1/2/3、N-4）；OPEN=2（N-1/6）。不把工程前置/产品问题升级成测试失败，也不为凑关闭数删掉它们。

## 5 · 受影响字节与旧审阅范围

旧六份SHA保持在原外部报告§0，本轮不改原verdict或原SHA。以下是作者修订后当前冻结输入；独立差量复评尚未执行，非代码/运行证据：

| 文件 | 当前SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md` | `f68c3cbebb08ffee25fb1bf74155b03c82a14c77e270a68e216acdd3a53ec799` |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md` | `c1d8923ef8d76d5c9b97ceb3e4b625ef3ecb55f818ab7537a0716a4858889417` |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md` | `35dc3840c5c819e45a443a36365280b357a54148071acb1234ab2da4c2d8a012` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md` | `dae6684a67d915d1742b5ccaf55aa6b4938d712bf95eca891ed3db3a7f92b6f8` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md` | `3bad243dd3928ef3dbba41a459dfb2e34b7cb4acbb2e8bc711e0bc1dc3fd9d3d` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md` | `3a171af21730b873218a63b82f06e67cecf04af3637acafce670c566c027caac` |
| `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` | `f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22` |

需求正本SHA仍为f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22；未修改。六项答复后只修相应文档与本intake，并重新计算摘要；在当前字节独立复评前不称新GO。
