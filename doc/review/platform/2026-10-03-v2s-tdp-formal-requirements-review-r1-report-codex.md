# TDP 正式需求独立对抗审查 · Round 1

本文件保存 `/root/tdp_formal_requirements_r1_fresh` 返回的独立报告。主 agent 只整理落盘，
不替 reviewer 改 verdict。全文回传及实际工具读取留痕见本会话；输入范围另存 checklist。

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_REQUIREMENTS_2026-10-03
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-03-v2s-tdp-formal-requirements-review-r1-checklist-codex.md
blindReviewDeclaration=先独立重开原始业务输入、目标全文、规范、路由记忆及源码，以证伪立场形成 findings/verdict；未读取作者分析或自评材料。
authorMaterialReadAfterIndependentVerdict=false
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=0/1/2
L1_ENGINEERING=S-1；N-1、N-2为非阻断说明
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:本期无新增前台任务、页面或用户操作
L3_UNVERIFIED=空:没有本期UI事实分母；动态需求验证另列NOT_RUN
SAME_ROOT_SCAN=见同根扫描
DESIGN_GAPS=见后续详设准入
TEMPLATE_COVERAGE=见逐节覆盖
EVIDENCE_TIER=只读静态需求/规范/源码审查；未运行生成、编译、测试、verify或动态环境
```

被审对象：`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md`，全文411行。
开始与结束读取的SHA256均为：
`bd36b68c7aff83ac1ce5eb54ac9f1920c9b9aa3bc92e49e8ff2a2aa8572999ec`。

本轮只判断正式需求能否准确表达批准目标并提供可落实的验收要求，不判断尚未授权编写的详设、代码或运行证据是否已经完成。上一前置输入失败不产生本轮 findings/verdict。

## 独立方案判断

实际目标是让在线MASTER收到业务变化后由feature重新读取并保存自己的业务事实，以及让CBS通过已注册command执行通用远程操作，保存发送、实际过程与结果，并让终端重连后补报已保存事实。

最小方案是继续使用现有CBS事实owner、PG、TDS/TDC连接、runtime command/actor、feature slice及既有持久化/同步能力：WS传递有限通知和操作事实，业务数据通过HTTP获取；只增加本期十一类topic、两个feature和具名terminal-control能力。

两个替代方案均不能更好满足原始目的：

- 将HTTP、业务slice和订阅全部集中到TDC，会让基础服务承担业务owner职责，并增加主副同步及跨feature耦合。
- 为通知和远程操作建设通用队列、outbox或统一feature恢复框架，会扩大本期授权，改变在线执行与未知结果语义。

当前方案方向合理。主要收益与失败边界均已表达；本轮阻断项是验收动作从现有业务能力之外推导出来，而不是基础设施方案本身不成立。

## 动作1-B：实际提取结果

| 提取项 | 当前事实 | 裁决 |
|---|---|---|
| 模板整节/整列 | 四模板独立工件尚未创建；目标349—351行明确本期仅正式需求、无UI，并要求后续阶段使用适用模板 | 本阶段有理由N/A，不能要求先产出实施详设 |
| 文档/源码矛盾 | 214、318行出现“服务点换区域”；当前owner更新不改变areaRef，movePoint只在原区域内排序 | S-1 |
| 范围措辞冲突风险 | 34行排除远程脚本，231行“不可下载脚本”，同时230行要求TDS/TDC通用执行已注册command；当前规范保留远端脚本源能力 | N-1 |
| 观察能力缺口 | 251—259行要求远程事实持久化及晚到结果；当前ledger不持久化，晚完成事件没有结果载荷 | N-2；344行已声明技术OPEN |
| 数值出处 | 65,536来自当前连接协议；0来自初次空集合裁决；100/200为已给出的通知例子；十一类为R-11七类加R-12四类；十八类可与当前CBS十八个模块目录核对 | 未发现应成为产品上限的无出处数值 |
| 后续具体参数 | 容量、保存期限、wire单位及有限关联尚未选定，266、341—347行诚实标为详设准入 | 不以未完成后续设计制造本轮finding |

提取清单非空，没有用空产出充当PASS。

## Findings

### S-1：验收要求把尚不存在的服务点移区当成本期真实HTTP动作

**位置**：目标`:214`、`:318`（V-14）；owning source
`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java:638`、`:644`、`:676`、`:768`；
既有业务输入 `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:140`；
既有IA `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md:106`。

**性质：** 仓内事实加范围/验收推论。

当前`updatePoint`读取`before.areaRef`进行区域核验，UPDATE列不包含`area_ref`。`movePoint`查询同一`before.areaRef`下的行并交换顺序，不能据方法名称推导移区能力。原始本轮输入要求全门店ENABLED集合及详情通知，没有要求新增服务点移区业务。

214行可以作为条件语义反例；318行却将“同店换区域”绑定CBS HTTP/WS与Web/VM验收，形成了本期必须执行的业务动作。

**反例：** 直接调用现有更新command即使携带另一区域ref，也不会改变持久化areaRef；调用movePoint只会重排原区域内对象。不能为满足V-14直接改库后宣称真实owner HTTP场景通过。

**影响：** 下游可能新增未授权业务动作，或通过直接造数据库变更伪造验收闭环。本阶段的验收需求因此不够准确。

**最小验收修正：** 明确本期不新增服务点移区；V-14使用当前owner真实支持的创建、启停、作废、内容更新及详情增退验证。214行删除，或明确为未来owner若获批允许关系变化时的通知边界，不作为本期动态必跑项。不要因此建设移区功能。

**是否需要Dexter：** 上述收窄到原输入的文字修正不需要新增产品裁决；若坚持本期新增移区业务，则需要Dexter明确授权。

### N-1：脚本排除应限定为本期CBS接入范围，避免成为TDS/TDC类别禁令

**位置**：目标`:34`、`:230`、`:231`；`doc/platform/terminal-coding-standard.md:291`—`:294`；
`project-memory/decisions/terminal-architecture-and-stack-rulings.md:64`；
`doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md:728`—`:752`。

**性质：** 规范事实及措辞歧义，不是要求本期实现脚本。

当前规范T-11保留`scripts.execute`产品运行期能力并允许远端脚本源。目标230行要求TDS/TDC可执行已注册command，由CBS contract约束实际下发；231行“不下载脚本”如果解释为通用层永久禁止脚本参数，将与该职责分工及既有裁决冲突。

**反例：** 本期CBS contract只包含helloWorld，且不建设脚本能力，完全可以成立；这不意味着未来已注册且由CBS contract允许的脚本command应被TDS/TDC按类别拒绝。

**影响：** 可能把合理的当前非目标误写成平台层长期限制。

**最小修正：** 将排除限定为“本期不实现/接入远程脚本业务，也不远程安装新command定义；TDS/TDC不另设已注册command类别禁令”。

**是否需要Dexter：** 只澄清当前范围与已有裁决不需要；改变T-11或通用command边界需要Dexter。

### N-2：远程持久过程与晚到结果须在详设中落实真实runtime观察接缝

**位置**：目标`:251`—`:259`、`:344`；
`apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts:145`—`:153`；
`apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:347`—`:367`；
`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:290`、`:460`；
`apps/terminal/kernel/base/runtime/src/selectors/selectRequestExecutionView.ts`。

**性质：** 当前源码事实及后续工程准入提示。

当前ledger的`persistIntent='never'`，不能直接承担远程操作持久记录。runtime已有公开request selector、订阅和按注册名称dispatch的能力；但超时后`actor.late-completed/late-error`仅发出身份、完成时间与error，不包含实际result，并返回而不走普通terminal更新。

**反例：** 未超时命令的普通完成结果可以观察；不能由此推导超时后实际result也能通过同一路径完整保存和补报。

**影响：** 若后续只把当前selector快照复制到TDC，可能持久化“timed-out”而丢失后来实际完成的结果。

**最小准入：** 在§8生命周期观察项明确公共观察面覆盖所需实际阶段和晚到结果，并设计remote-only持久记录的command/actor接线及失败反例。不改变所有本地ledger持久策略，不暴露私有ledger，不添加通用恢复框架。

**是否需要Dexter：** 在已批准的实际过程/结果语义内落实技术接缝无需Dexter；新增过程承诺、恢复执行或改变超时语义则需要。

这是已被§8承认的技术OPEN，不能升级为“本阶段必须完成runtime代码”的阻断项。

## 同根扫描

1. **关系变化/移动验收族：** 搜索目标中的“移店、换项目、换区域、换areaRef”：
   - 214、318行：服务点移区无当前owner动作，S-1。
   - 317行：门店换项目，当前Store更新SQL具有`project_id`更新；不能与服务点移区混为一谈。
   - 310行：通用范围“移店”须在详设绑定实际允许变更scope的owner；合同更新SQL不改变`store_id`，不得把合同移店直接列成真实HTTP能力。
   - 当前服务点movePoint仅排序已核对，未因方法名称误判移区。
2. **command类别限制族：** 目标34、230、231、274—277行逐项对照：本期helloWorld无副作用是验收scope；CBS contract限制实际内容成立；TDS/TDC类别禁令不应由此推导，见N-1。
3. **远程记录族：** 244—247、251—260、264—270、V-18—V-23与344—346行逐项核对：CBS意图先保存、WS send不等于持久确认、补报不重执行、有限记录去重和未知历史均有需求；remote-only记录与当前never ledger的区别已经明确；晚完成观察接缝见N-2。取消激活仅server-config保留与远程历史保留存在真实后续设计冲突，346行已明确OPEN；不能自行扩大reset保留例外。
4. **通知/范围族：** R-04—R-12及V-03—V-15逐项核对：原始时间、同值真实变化仍通知、初次/重连`!=`、同值漏失限制符合原输入；A/B四种转换、ACTIVE不自然过期退出、0/100接受、多consumer自身失败、增退及MASTER/SLAVE均有要求；PG提交/并发/重建接线仍OPEN；ENABLED不能替换为非VOIDED/父级effectiveAvailable。

## 后续详设准入与动态边界

`DESIGN_GAPS`保留目标§8当前OPEN：原始时间wire精度、无缓存空集合初始化、批量A来源、terminal HTTP身份及完整快照、缓存owner/事务并发、TDS通知路径、runtime过程观察、remote-only持久记录、容量/留存、失效绑定历史接纳、实际依赖版本官方依据。

其中失效绑定历史和未确认记录删除涉及产品冲突时交Dexter；本轮不发明保存天数、容量数字、新权限产品或恢复执行框架。

V-01—V-24均为计划，状态`NOT_RUN`。没有生成、编译、focused test、真实HTTP/PG/WS、Expo Web、VM/device、DEV、backend-acceptance、L2、UAT或部署证明。没有启动动态资源，cleanup为`NOT_APPLICABLE:未创建运行资源`，不能写业务或cleanup PASS。

本轮没有版本相关第三方运行行为结论；Reactor、PG JDBC等源码接线事实不等于其运行行为已验证。实际版本及官方依据属于目标347行的后续准入。

## 四模板逐节覆盖

四模板全文已读。下面判断的是本阶段是否需要独立模板工件；`N/A`不会免除后续阶段义务。

| 模板 | 节 | 本阶段状态及原因 |
|---|---|---|
| Journey | 1 元数据 | N/A：本轮正式需求metadata在§0，不创建新UI Journey裁决工件 |
| Journey | 2 用户任务/成功 | N/A独立工件；需求§0.2及R-01已有系统任务 |
| Journey | 3 actor前提链 | N/A独立工件；身份/连接/feature前提在R-03、07、10、13—15 |
| Journey | 4 边界/禁推 | N/A独立工件；§0.1、R-02/03/13已有边界 |
| Journey | 5 corpus | N/A独立工件；本轮已按命中语料核对，见checklist |
| Journey | 6 UI及后续工件 | N/A：无UI；目标349—351行已有声明 |
| Journey | 6.1 管理后台一致性 | N/A：无后台screen |
| Journey | 7 Dexter裁决 | N/A独立Journey工件；本轮授权及§10原话为输入，不伪造接受结论 |
| IA | 1 元数据 | N/A：没有IA-ID/screen |
| IA | 2.1 可见维度 | N/A：没有新增可见surface、控件或文案 |
| IA | 2.2 不可见维度 | N/A独立IA表；集合、身份、加载/失败、刷新需求已在R/V表达 |
| IA | 2.1.1 容器负载行为 | N/A：没有UI容器 |
| IA | 3 共用IA规则 | N/A：没有导航/页面变化 |
| IA | 4 错误界面映射 | N/A：无界面；协议/能力失败仍由需求约束 |
| IA | 5 交叉对账 | N/A：尚无本期IA/交互/详设多工件；需求与原文/源码已核对 |
| IA | 6 完成判定 | N/A：本轮不是IA交付 |
| UI | 1、1.1、1.2 元数据/准入/一致性 | 各节N/A：没有UI-bearing screen |
| UI | 2 interaction map | N/A：没有用户操作链 |
| UI | 3 v2页面盘点 | N/A：没有页面搬运或变化 |
| UI | 4 线框及控件roster | N/A：无screen、testId动作分母 |
| UI | 表单依赖/字段矩阵/主从布局子节 | 各节N/A：没有输入或mutation screen |
| UI | 搜索及candidate protocol子节 | 各节N/A：无用户搜索控件；topic条件不是UI搜索 |
| UI | 5 状态边界 | N/A界面表；系统异常需求仍适用 |
| UI | 6 逐操作合理性 | N/A：无用户可见操作 |
| UI | 7 face/owner矩阵 | N/A UI表；R-02/03已有系统职责 |
| UI | 8 Manifest B.4/B.5 | N/A screen映射；适用owner/异步边界原文已读 |
| UI | 9 demo | N/A：未请求高保真 |
| UI | 10 看图结论 | N/A：没有需要Dexter看图的工件 |
| implementation | 0 元数据 | N/A实施工件；目标§0已有需求授权边界 |
| implementation | 1 目标/比较 | N/A实施工件；需求§0.2及本轮独立比较已核对 |
| implementation | 2 CP | N/A：尚未批准实施计划 |
| implementation | 3 横切机制、第三方子节 | N/A具体接线表；R/V和§8保留应满足条件，后续详设必填 |
| implementation | 3a UI/testId/L2 | N/A：无UI且本轮不开发L2 |
| implementation | 4 CP门控 | N/A：没有实施CP |
| implementation | 5 operation/path/face | N/A具体设计；canonical及HTTP身份准入已在§8 |
| implementation | 6 跨owner写矩阵 | N/A具体command设计；本轮只固定owner/事务要求 |
| implementation | 7 声明/传递/消费矩阵 | N/A详细跨层矩阵；后续须落实R/V |
| implementation | 8 owner判定点 | N/A精确方法设计；现有owner来源已独立查验 |
| implementation | 9 API/消费者 | N/A具体API设计；本轮不凭空产出接口 |
| implementation | 9a 同步全集 | N/A：没有源码变更点 |
| implementation | 9b 变更锚点 | N/A：没有实施定位 |
| implementation | 10 migration | N/A：本轮未设计或创建迁移 |
| implementation | 10b.1—10b.6 seed | 各节N/A：需求阶段不物化新业务数据，不执行seed；后续影响面必须盘点 |
| implementation | 11、11a 验收设计/对照 | N/A可执行场景文件表；需求已有24条V，S-1须先修正 |
| implementation | 12 未决项 | N/A实施工件；目标§8已存在需求级OPEN |
| implementation | 13 停机 | N/A实施节奏；产品/授权冲突仍须Dexter |
| implementation | 13b 三维对账 | N/A：没有实施CP及整体测试 |
| implementation | 13c 逐代码对账 | N/A：没有本批实现代码 |
| implementation | 14 自查 | N/A实施交付；本轮静态需求审查如实完成 |
