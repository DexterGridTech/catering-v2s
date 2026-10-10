# Stage C project-basic：独立 DESIGN R2 报告

主 agent 整理保存独立 reviewer 返回的只读报告。结论、对象字节、输入边界和事实均来自 reviewer；作者处置在同日 design-intake-claude 另记。

```text
REVIEW_CYCLE_ID=TER-UPDATE-C-PROJECT-BASIC-OWNERSHIP-2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=/root/project_basic_ownership_design_r2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-version-update-stage-c-project-basic-review-input-codex.md
BLIND_REVIEW=true
AUTHOR_INTAKE_READ=false
R1_REPORT_READ=false
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0M/0S/0N
FILE_WRITES=NONE
```

reviewer先从用户原话、原始需求、规范和当前源码形成独立判断，未读作者intake或R1报告，不继承旧finding/verdict。输入里的历史说明仅用于识别范围和轮次。无文件修改、无.runtime读取、无Git/生成/编译/测试/verify/DEV/Web/Android/设备命令。未用全局memory。

## 1. 范围及方案合理性

本范围是project-basic建包、组织与规则搬移，对C启动、command、固定任务、同步、持久化、公开面和计划的影响；不重评无变化native installer、后台布局或旧Ccycle。

目标是把项目业务资料与本机更新执行分开，并落实具体门店取得成功后的先后顺序。最小方案为project保存组织/规则、选业务候选；store保门店/经营规则/合同/服务点；update接一候选，actual比较/准入/固定/执行/报告；assembly只绑定公开selector纯身份复核。

复用既有actor/command、分页hash、topic、持久化、record sync。规则留base违反最新授权；assembly选规则扩大装配职责；新增成功通知、调度器、业务cache或候选账本无必要。固定task.target是接受后的执行事实，不应为了表面单一住址删除。方案合理，未发现本范围必须修改的问题。

## 2. 五动作与证伪事实

动作1采用1-B提取模板覆盖、文档事实与数值/形态，非空；动作2对六工件、需求/规范；动作3同族扫描；动作4分离静态/未验证；动作5固定verdict。

以下“详设/计划/附件”均为 `doc/plans/platform/2026-10-09-ter-version-update-stage-c-{implementation-design,implementation-plan,source-and-api-appendix}-claude.md`，行号绑定§6六SHA；源码路径相对仓根。

| 证伪入口/反例 | 当前设计与源码依据 | 独立判断 |
| --- | --- | --- |
| active/hydrated门店即可首查组织，门店失败仍查合同/项目 | 详设174要求具体store非空、id/space匹配、本runtime/binding flushed；计划33/41删除现有失败helper。store actors329–446确有需搬移的completed/失败/广播后路径 | 未形成反例，设计明确修正现状 |
| project慢HTTP阻断store后续 | 详设176–181将store下游放自身loaded handler，project另一handler组织→规则。Runtime createCommandDispatcher.ts653–654 Promise.all先启动各handler再汇总；actor dispatcher103–105按actor+command判reentry | 与现有能力相容，无需scheduler |
| 晚装从selector直接首查或initialize/loaded递归 | 详设183先注册，经公开store initialize重发同成功command；loaded不再initialize。计划33/41列身份/in-flight/完成去重和递归反例 | 实施判据充分，运行NOT_RUN |
| base排序业务规则/反向依赖feature，assembly编排 | 详设169–172/187/191/199–205：feature选，一local command传一候选，base实际比较；assembly只核ruleRef/hash/context。计划34/58，附件41–44一致 | 职责闭合 |
| await后scope/hash/boot变，旧候选仍固定 | 详设191/203要求feature提交前、update await后及首次port前重读；拒绝未固定候选，fixed不因新规则/停用替换 | 未形成反例 |
| MAIN失败留正文，BRANCH新boot用旧规则 | 详设193/265–267失效entry tombstone，组织身份失效带规则失效；副机核value身份/currentconnection apply。计划70/77有同connection失败反例。state/foundations/sync.ts98–104清tombstone，topology slice94–135按connection/revision接受，readiness同时核failed/applied revision | 两entry足够，无第三状态entry |
| 旧descriptor退出仍hydrate，或固定任务误删 | 详设195/336、附件49只停止旧键hydrate，不承诺物理删、不reset。hydration97–98/128仅读注册descriptor，root reset处理orphan；fixed/recent/failed/report保留 | 与现有能力一致 |
| 旧TDC订阅需要第二账本迁移 | TDC slice215–220仅持久credential/acceptedTopicTimes/remoteOperations，subscription不持久；详设195新subscriberKey重建 | 无需迁移框架 |
| 包/exports/依赖/测试消费者遗漏或兼容壳 | 详设314/324–326、计划32–41/99、附件41–44列新标准包、三包入口/README/invariants/selector注册/测试和两assembly；旧读面删、规则case搬project、update保执行准入 | 本scope覆盖充分 |
| 六工件保留单链串行，或新增设备run/UI | Journey13–14/38–40、IA10/35、UI121–127、详设8.0/8.1/8.6、计划CP01/03/04、附件2.1一致；资料case复用父run | 无矛盾或扩张 |

两个entry来自组织/规则两owner事实；单候选来自最新适用规则与固定任务约束；分页100、单页1MiB、完整snapshot8MiB沿B既有界限；N/M沿已批准参数。没有将技术上界当容量测量PASS。

## 3. Findings与同根扫描

**M=0、S=0、N=0。没有已确认finding，无本轮新增Dexter产品/权限裁决。未成功证伪的假设不计N。DESIGN_GAPS=NONE，仅本scope。**

逐一核过三个owner的数据、command/selector、依赖、持久/topic/任务事实；两个assembly安装、依赖、sync/context读面及测试；两个loaded listeners和late-install链的失败/重启/旧binding/重复/递归；四topic PROJECT/REGION/COMMERCIAL_GROUP/TERMINAL_UPDATE_RULES的订退/接受/scope；两个record entry的空集/诊断正文/tombstone/旧新连接/fixed保持；旧descriptor/公开面与orphan/retain；六工件及测试搬移/资源引用。未发现剩余同族遗漏。

防再犯已落计划CP01/03/04的Runtime fan-out、失败零首查、迟到身份、tombstone、fixed目标反例，没有新增检查器或治理控制面。

## 4. 四模板逐节覆盖

“有”只表示设计具备，不是实现/运行通过。N/A仅指本scope不适用。

| 模板 | 逐节结果 |
| --- | --- |
| Journey | §1元数据、2任务、3前提、4边界、5corpus/冲突、6工件、7裁决有；6.1后台一致性N/A，本次无后台变更 |
| IA | §1元数据、2.1可见沿邀请、2.2不可见资料/投影、2.1.1负载、3来源资源权限、4等待错误、5交叉、6完成判定均有 |
| UI | §1元数据、1.1canonical/标准、1.2后台不新增、2map、3资产/surface、4线框/roster/TestId/focus/语言/owner有；表单依赖/主从集合/搜索N/A；5状态、6合理性（工件10）、7owner、8B4/B5有；9demo可选N/A；10看图有、运行NOT_RUN |
| 详设 | §0授权、1目标比较、2CP、3横切第三方、3aUI/TestId、4门、5operation/path/face/集合、6owner/事实、7传递、8行为、9API/消费者、9a原子组、9b正本、10迁移、10b.1–6来源规模角色权限文件资源、11/11a场景R/V、12OPEN、13停止、13b双读/阶段及全批三维（4/13和计划2）、13c逐代码、14自检均有 |

没有新增职责所需的缺失整节、整列或无owner判定落点的设计空白。

## 5. 实际输入及证据档位

仓根 `/Users/dexter/Documents/workspace/idea/catering-v2s`。全文与片段明确分开，不冒称全仓逐行覆盖。

- 全文：AGENTS、CLAUDE、BLUEPRINT、platform README、scripts README、输入清单、本仓cs-review skill、project-memory index全部6kernel及deterministic。
- 六维实际query：`scripts/memory/query --task-kind design --domain platform --consumer-face backend --owner frontend-platform --impact architecture --trigger task-start`。22命中正文全部读：6kernel、corpus/http-crud/owner-read-model/terminal architecture/build-order；corpus adoption/parked/terminal规范；conversation-not-system/invisible-dimension/platform-detail-reverse-inference；backend fixture oracle/collection-boundary/consumer-ordering/input/third-party官方验证。另读severity verification-governance原文。
- 全文：六C工件，2026-10-05正式update需求、2026-10-03正式TDP需求。
- A详设适用§0–8.1、8.3–8.5、9/9a、12–14.2；B详设§0–3.1、6–9a.1、14.1–14.2，B附件2/11.1–11.4及HTTP报告锚点。未重评未变化native/ZIP/UI。
- 全文：四模板、implementation-task-template/review/foundation/third-party规范，相关review/方案合理性/verification/协作边界/roadmap退休decision，已列decisions标题。TER规范适用TR01–04、09–11、16、命名依赖、4D/E/F；frontend3A/D/E/F、4；backend owner/读事实/集合/R-READ。routed TER build-order依赖命名治理拓扑栈、skeleton6.2/9原文重开；旧归属依最新用户授权，不从旧规则推回。
- store全文公共形状/module/commands/selectors/slice/actors/deps/index/package/invariants及storeBasic.test.ts。update公共形状、actor snapshot/refresh/target/任务/报告/accept/execute/reconcile/confirm完整相关函数；test规则分页/启动接受/固定/并发身份/报告context/跨boot/retained reset，纯旧native/ZIPcase未全文读或执行。
- 两assembly实际装配/reader/sync/依赖及public-surface测试；Runtime actor/local fan-out；state hydration/record sync全文及reset/orphan/retain相关完整函数；topology sync controller/readiness/connection-revision slice；TDC topic订退/接受完整相关函数/module/persist descriptor。
- 未读作者intake、R1报告、全局memory或.runtime。

| 档位 | 当前结论 |
| --- | --- |
| 静态已证 | 六工件一致、职责依赖闭合、dispatcher/hydration/sync复用可行、计划有反例 |
| 测试已证 | 无；读取测试只证明先例及断言存在 |
| 无人验证 | 新包实施/类型/exports、两个listener运行、晚装、双机tombstone、实际比较/准入、UI/设备/business/cleanup |

focused/build/verify/DEV/Web/Android/设备/seed/reset/IMPLEMENTATION review/business/cleanup均NOT_RUN，无本轮动态cleanup PASS。第三方运行与设备能力未新验证；搬移无新库，实施仍按CP01准入。

## 6. 六份当前SHA（独立纯读重算匹配）

```text
a84f9ab406c71c77bf2404f9164a81a575428d1b7ec1c7645688bb0d87b894fd Journey
038dbebbdf1bdcfb0c90733627a04d5f2df13f974c30b1ad93c730f91eaeb5be IA
f547b1df6a7aeb3ff3d7b74d361fd7465809834595d232bfa1a82cd57bfb49d9 UI
dff540b1f98daee11acac21a019ce2329eb7149b1e5eb2e2bd072a10bbcf5e26 详设
6335ebff3e4bc259fa10cdab423984a7e51ae6958d4b8b32f830604fc7f040db 计划
f65fd154f62c832e1ad64d9a99514b08985e479f44b9ff690430d3c838cde9e4 附件
```

## 7. 固定结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS（仅本范围静态设计、职责与复用依据）
L2_USER_VISIBLE=PASS（仅需求/交互静态映射，不代表UI运行通过）
L3_UNVERIFIED=实现、类型/构建、focused、Web、Android、设备、业务、cleanup均NOT_RUN
SAME_ROOT_SCAN=三个owner、两个assembly、两个loaded listener、四topic、两record entry、旧descriptor/公开面及六工件已核
DESIGN_GAPS=NONE（仅本次新增职责及同根C影响）
TEMPLATE_COVERAGE=四模板逐节覆盖，无本scope缺项
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENTS
```

独立报告完成，R2后硬停止，不召集第三轮；作者按SELF_DECIDED处置。该verdict不授权实施/动态，也不替代后续整批IMPLEMENTATION review。
