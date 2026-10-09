# TER 版本更新阶段 C DESIGN 独立审查 R4

```text
REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09
REVIEW_TARGET=DESIGN
REVIEW_ROUND=4
REVIEW_ROUND_LIMIT=4
ROUND_EXTENSION=EXPLICIT_DEXTER_ROUND_EXTENSION
ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/stage_c_design_round4
INPUT_CHECKLIST=doc/review/platform/2026-10-09-ter-version-update-stage-c-design-review-input-claude.md
BLIND_REVIEW=true
INDEPENDENT_VERDICT_SEALED_BEFORE_AUTHOR_MATERIAL=true
AUTHOR_INTAKE_READ_AFTER_SEAL=true
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
```

本轮依据Dexter明确追加R3/R4指派，同cycle不重命名，R4后硬停止。reviewer先独立读取六份工件、原需求、适用规范及owning source，以证伪立场形成结论并封口；随后才读历史R1/R2/R3和intake。不继承作者CLOSED、自评或旧verdict。当前无确认M/S/N。

只覆盖静态设计；IA及当前低保真内容已确认，真实UI、C实施/动态未验证，A/B在途不是验收PASS。reviewer未写文件、未Git/测试/生成/build/verify/DEV/Web/设备/reset/seed，未读.runtime。报告由主agent落盘。

## 1. 盲审冻结输入

首次读取和封口前复算匹配：

| 工件 | SHA-256 |
| --- | --- |
| Journey | 0ed55be74354f05bcbae9ae5691f368822c017b98bfb7f585b12c635cd55ad05 |
| IA | 167c08d0752028513a836a453ddbeae721e34862983865357b36665fb8ae360b |
| UI | 115ab84603d6f628aceecde16a61de114ad12aad9cf70d970cc682e06cc5b4ef |
| 详设 | 15723770c63d60ebae867d07be76b8c2f9de0990a7fb4bbb27e7958df9c3dfcb |
| 计划 | 09674c2a8359263c17b65b1e7a6c9e1ed3a642f5df28051af541c95dda3597f6 |
| 附件 | 90260a49a8290533f14fa0d5c18d120333beccc23a2add06fae85498d62dfb7e |

完整路径：`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-{journey,ia,ui-interaction}-claude.md`及`doc/plans/platform/2026-10-09-ter-version-update-stage-c-{implementation-design,implementation-plan,source-and-api-appendix}-claude.md`。封口后唯一来源事实纠正及最终SHA另附，不覆写盲审SHA。

## 2. 方案合理性

**问题正确**：店员需要自动取得适用规则并独立更新，FULL未安装继续邀请，HOT本机立即/无点击执行。管理员沿B页面维护目标和看主机实际结果；副机不产生独立激活、TDS或报告身份。

**成本匹配**：复用A固定核、B规则/授权/报告、Runtime资源、record projection、render alert、现有runner。仅增加有限策略、点击事实、单timer、技术呈现桥、规则投影、compact grant、本机邀请。

**更小替代**：删除N/M并手选规则能少接线但不满足需求；第二调度器/恢复队列/跨机协调框架增加成本且无必要。同owner有限扩展适当，不需换主干路线。

## 3. 独立反例核验

下表位置在C详设；静态判据成立不等于新增行为已实施。

| 攻击面 | 当前依据与独立判断 |
| --- | --- |
| runtime预过滤丢FULL | §8.1 L155–161先完整scope/App/平台择新，再比较actual APK/embedded/HOT；不暗选旧规则。refreshRuleSnapshot/targetFromRuleSnapshot/nextArtifact可复用，自动择新属C增量 |
| S3确认占新名额 | §8.2 L165–167及CP-03 executionBootId只实际执行前更新；S3纯确认可释放后择新。无第二账本，A覆写bootId不是产品判据 |
| 点击吞业务 | §8.3 L171–177 capture返回false；双屏共本机、双机隔离；deadline再核revision。精确RN/RNW公开source支持接缝，非实际覆盖证明 |
| pending-user重复commit | §8.4 L181–194四分支；known恢复同session零prepare/commit，UNKNOWN回读，结束未安装才可用户新action。亲读readAction与exact Intent/session，无新installer |
| native/owner各调N | L192/CP-03统一旧foreground自主呈现为技术事件→owner，native只验身份/呈现；实施须同步旧进程内去重，不能叠两套调度 |
| 投影覆盖副机task | §8.6 L206–219仅完整规则及非秘密context，task/actual/failed/report/click isolated；现有逐slice/connection/revision/apply后ready支持 |
| BRANCH伪本机active | 两composition分MAIN/BRANCH，副机必要projection与matching context，不复制activation。当前assembly本机gate需C按计划改，未假称已有 |
| FULL缺ZIP manifest | FULL summary.apk path/hash/certificate→验签APK embedded；HOT ZIP publication/files。Preparer extractFull/validateFull/extractHot支持，无新格式/库 |
| peer无限files | compact summary完整信封64KiB，不借state-full承诺result分片，超限失败不截断，不预建扩容 |
| 停用抢占task | 固定续接不要求仍启用，当前binding/scope/artifact授权继续复核 |
| VICE邀请错读MAIN | §8.5/8.7 L202/223–233 physicalPRIMARY与logicalSECONDARY分开，BRANCH/PRIMARY本机context/local-primary；business interlock不藏alert，admin优先，CP-05承担现LayerStack增量 |
| 跨App新模式 | HELLO/pairByHost moduleName equality/protocol1保留；两App各跑sameApp，不互配，无矩阵/协议/fallback |
| 副机凭证/代报 | §8.8及TDC当前门；grant经MAIN update→TDC，report仅MAIN，MASTER/active/credential保留 |
| 激活身份写规则 | §10b.3 L289 account-multi-role、GROUP→PROJECT、MANAGE_PROJECT_TERMINAL_VERSION，canonical/页面同key；不足即停，不造admin |
| accept fixture冒自动 | §11及整链真实上传/保存/建启用→snapshot→自动eval，不以fixture替代 |
| 原子组永久兼容 | §9a/CP01–06顺序与同步明确，中间类型错不得fallback，无虚构编译 |
| 设备先跑 | TR16先两integration Web，再同清单application/device；native事实独立，CP/6b/动态/13c/review顺序明确 |

本轮官方读取为[RN 0.86.3 ViewPropTypes](https://raw.githubusercontent.com/react/react-native/v0.86.3/packages/react-native/Libraries/Components/View/ViewPropTypes.js)和[RNW 0.21.2 View](https://raw.githubusercontent.com/necolas/react-native-web/0.21.2/packages/react-native-web/src/exports/View/index.js)。只支持公开接口/source判断，不证明本仓真实操作。

## 4. 同父run与资源定向核验

亲读B§15.2a、runner/managedRun、SupplyUi创建、Android journey cleanup，C修后自洽：

- 详设§3a L103、CP-05第5项、附件§6同一个terminal-automation→update.supply-chain父run。
- SupplyUi创建browser/context及两后台页面，把browser返回调用生命周期；Android afterAll回收连接/安装包/browser/server，失败进cleanup marker。
- runner owned tree/RSS/残留与artifacts回收，Android cleanup与business分列。
- DEV Vite/tunnel借用，不TER owned，不由case停止。
- Playwright/helper后台DOM，agent TER React，系统installer/settings窄例外。
- 当前Android注册不是C Web/policy/pair可运行；CP-05扩case/suite/双session/profile，未实现拒绝。无第二入口或自拼fixture残余指令。

| 在途source截面 | SHA-256 |
| --- | --- |
| runner.ts | a0ecdb313c91d20fc04a7de46bec0d77efe54fd4b8527136c9d7d9276f3a1785 |
| managedRun.ts | b40421e370b1e36987c4a9afa73f7df252fe797a42437d36308f0124960b252c |
| terminalUpdateSupplyUi.ts | f272f4df773e1ef50a7bb0a3e44039cc5fc83409097156fc0b7c17c85b7e5600 |
| update.android.test.ts | 5aa4aa2f592277882146e3abb1c6e78b626ad59573003a3f9208468a2087f090 |

这些不是B最终冻结/cleanup证明。

## 5. TEMPLATE_COVERAGE

“有”只指静态设计。

| 模板适用槽位 | 结论 |
| --- | --- |
| Journey §1–7 | 元数据/任务/actor三类前提/禁推/corpus/UI/裁决有，后台沿B，内容确认与真实未知分开 |
| IA §1/2.1/2.2/2.1.1/3–6 | 维度/可证伪观察/负载/共用/错误/对账/完成有，无表单不省动作身份 |
| UI §1/1.1/1.2/2–4 | canonical/primitive/布局/后台/surface/map/来源/两宽线框/roster有 |
| UI mutation/hidden/5–10 | confirm/defer各task/action/boot事实、状态焦点/合理性/owner/B4B5/看图有 |
| UI条件项 | 新输入/owner-definition/动态集合/搜索N/A有业务理由；高保真NOT_REQUIRED不免真实UI |
| 详设§0–2 | 授权/来源/目的/替代/CP有 |
| 详设§3/3a/4 | 横切/第三方/未来proof/控制面/CP门有；准入BLOCKED非运行资格 |
| 详设§5–8 | operation/owner/跨层/完整业务判据有 |
| 详设§9/9a/9b | API consumer/六原子组/顺序/锚点有 |
| 详设§10/10b | durable旧task/seed/fixture/角色/父链/授权清理有 |
| 详设§11/11a | 具名case/oracle/RV/继承增量有，全部NOT_RUN |
| 详设§12/13/13b/13c/14 | OPEN/停止/双读/CP6b13c/implementation review/selfcheck有 |

DESIGN_GAPS=NONE；未发现需要另立产品判据的缺口。A/B前置与C实现义务仍OPEN，不推已证明。

## 6. 实际读取范围

完整：根AGENTS/CLAUDE/Blueprint/两README、index六kernel/deterministic、六维全部29原文、cs-review/cs-memory-recall/automation skill；需求、C六文/清单、四模板、review/third-party标准。实施/terminal/frontend等规范适用章节、corpus/review/verification/reasonableness/foundation/observability/handoff/退役sourceRefs已读。

相关调用链而非无关大文件全读：讨论稿§19–21；A三工件fixed/native/session/FULL/HOT/boot/provider/fixture；B三工件snapshot/grant/report/权限/seed/§15.2a；update公开类型/module/actor核心；Runtime资源/subscription，render/primitive/input；topology identity/readiness/state-sync/peer，TDCgrant/report，两assembly；UpdatePort/native/Preparer，automation runner/managedRun/SupplyUi/Android；B owner/service/persistence/edge/canonical/generated/权限页/seed契约。

先独立封口，后读R1/R2 findings、R3/intake；关键输出截断补读，不假称无关全读。

## 7. 历史与来源漂移

R1 boot/跨App/FULL/pending、R2权限/模板、R3父run反例均无当前残余。只确认设计反例消除，非代码/运行闭环。

**盲审截面提示，非新增finding**：详设L26曾说createdAt已传播；本reviewer读取的RuleSnapshotItem/Service/edge未传rule.createdAt，只有artifact时间。B在途且B_INTERFACE_OPEN/CP-01最终重开明确，未升级C产品阻断，也不能交接为“已闭合”。主agent须亲验。本行封口后的来源纠正及独立读回见附记，不覆写历史。

## 8. 未验证与最终块

静态已证：六文判据/owner/身份/模板/接缝，IA内容确认。测试已证：无。

未验证：邀请布局/小屏/长版本/重复N/稍后/返回/焦点/admin；真实M点击/双屏；Web/Android/sameApp双机/跨版本/断链；FULL/HOTactual/报告链；C源码/生成/类型/focused/native/环境/资源/cleanup；B最终接口/报告/seed/argv出口。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS（仅当前静态设计与相关接缝；无实施或运行证明）
L2_USER_VISIBLE=PASS（批准任务、已确认内容与静态交互对账；真实UI仍未验证）
L3_UNVERIFIED=邀请布局/焦点/admin；N/M与双屏点击；Web/Android/同App双机；真实FULL/HOT与后台报告链；全部C运行及cleanup均NOT_RUN
SAME_ROOT_SCAN=六文boot、N/M、sameApp、projection、邀请、grant/report、权限seed、原子组、父run/owned-borrowed/cleanup已交叉核；无残余finding
DESIGN_GAPS=NONE；A/B接口及全部C实施义务OPEN
TEMPLATE_COVERAGE=四模板适用槽位有，条件N/A有理由
EVIDENCE_TIER=STATIC_CURRENT_DOCUMENT_AND_RELATED_SOURCE
CURRENT_TASK_COMPLETE=true
FILE_WRITES=NONE
RUNTIME_READS=NONE
DYNAMIC=NOT_RUN
CLEANUP=NOT_RUN
NEXT=主agentintake后交另一Claude
NO_FURTHER_CODEX_DESIGN_ROUND=true
```

reviewer未创建运行资源。R4后不自动追加，实施/动态须后续明确授权。

## 9. R4 封口后唯一来源纠正（独立附记）

本reviewer亲读最终D§0.1 L26并复算SHA。该行准确区分规则时间与工件时间：canonical/generated要求规则createdAtEpochMillis，当前RuleSnapshotItem/Service/edge尚未传递，不可用artifact时间替代。B_INTERFACE_OPEN与CP-01最终重开保留。

这是来源事实与OPEN纠正，无产品行为、实施范围或准入改变；未发现新反例，封口结论保持 **GO_WITH_UNVERIFIED_UI，0M/0S/0N**。属于R4最终交付差量确认，不是第五轮或新cycle。

| 工件 | 原盲审SHA | 最终交付SHA |
| --- | --- | --- |
| 详设 | 15723770c63d60ebae867d07be76b8c2f9de0990a7fb4bbb27e7958df9c3dfcb | 15f790d1901a06f28e3e1a5e4cadb223bd0e203996b167332740fd1056a19fe1 |

其余五份SHA沿§1原冻结值，未修订。仅纯读该行和复算D，无写入/动态；A/B仍OPEN，全部C实施/真实UI/cleanup NOT_RUN，R4到此停止。
