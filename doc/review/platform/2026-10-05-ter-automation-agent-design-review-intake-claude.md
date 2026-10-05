> 历史快照说明：本记录对应再次差量修订前字节；当前处置与哈希请读 `doc/review/platform/2026-10-05-ter-automation-agent-design-recheck-intake-claude.md`。以下旧处置和哈希保留，不是当前独立结论。

# TER automation-agent · 外部 DESIGN finding intake（修订设计包）

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_IMPLEMENTATION_DESIGN_2026-10-05_CLAUDE
AUTHOR_DISPOSITION_ONLY=true
INDEPENDENT_REVIEW_STATUS=OPEN_TOOL_CAPACITY
IMPLEMENTATION_AUTHORITY=false
EVIDENCE_TIER=STATIC_DOCUMENT_AND_SOURCE_INSPECTION
NEW_CAPABILITIES_AND_CLEANUP=NOT_RUN

## 1. 输入与授权

外部输入为 `doc/review/platform/2026-10-05-ter-automation-agent-design-review-claude.md` 的 NO-GO、0M/5S/8N，对应旧详设 dcc53cc1…、计划 db232523…；保留原 verdict，不代写新 GO。
先重开正式需求、评审原条款、详设/计划、六维路由与 owning source，再做最小修订。Dexter 已明确逐字转录验收与实施期抽共享 fixture；不重复申请产品裁决。本次只写七份设计包与本 intake/差量交接；需求、规范、项目记忆、源码和依赖未改。当前表中的 CLOSED 仅表示文档缺口按作者核验处置，不证明实现或动态通过。

旧作者检查与首次请求 `2026-10-05-ter-automation-agent-design-author-check-claude.md` 的输入属于首版设计快照；review-request本轮已更新为差量请求。本记录与当前差量请求标识修订后的字节；旧哈希不提升为当前证明。

## 2. 逐项 intake / 处置

下表 D/P/J/UI/K/I 分别指本包详设、计划、Journey、UI交互、skill草案、source-inventory；完整相对路径在§5。位置均为本轮当前文件行号。

| finding | 核验分类与关闭状态 | 重开的源码/判据、事实与最小修订 | 当前位置 | Dexter |
|---|---|---|---|---|
| S-1 | CONFIRMED / CLOSED | 原“提出→main落实”不能证明技能足够。按已裁决全文/命令逐字转录，改任何字符修skill换fresh，结果同fresh核对，不豁免写入边界。全文/命令相等与V-18同步。 | D193、D360、P148、P172、K61；J§7 | 已裁定 |
| S-2 | CONFIRMED / CLOSED | selectContent.ts:32、selectTopologyFacts.ts、sample-wallpaper/selectors.ts含undefined。NON_JSON为值状态事件不退订，JSON恢复照常推；抛错/预算/会话结束终止。真实checker对42项重扫，附件全部返回类型与输入哈希。 | D40、D149、D151、D348；P88；K39；I7415 | 否 |
| S-3 | CONFIRMED / CLOSED（实现/fixture仍OPEN） | devScenarios.test.ts:58–63、527–640为常量/私有五函数，原prepare无条件cancel。明确TDC acceptance/operationsFixture.ts owner，两消费者，专用槽位与focused。HTTP StoreTerminalBinding.java:4–8缺deviceId：不假设它存在，复用r5-dev-runner.mjs:1054的既有managed只读binding helper最小增projection/parse；取消仍由HTTP owner并CAS/readback。遗留ACTIVE必须manifest与权威deviceId匹配，缺项拒绝。 | D249、D315–322、D329–331；P114–118；J§3 | 实施范围已裁定 |
| S-4 | CONFIRMED / CLOSED | nativeSlots.tsx:36–48、PrimitiveAdmin.tsx:79等props为string，过程间流分析不必要。改品牌TestId、项目props/nativeSlots收窄、现有typecheck；窄AST只拒非法cast、编译失败红夹具，不自写符号流。跨surface同ID合法，拒同scope歧义。 | D68、D185–186、D356；P134–136；K48 | 否 |
| S-5 | CONFIRMED / CLOSED | 九处helper/登记逐项迁移/同步/删除；附件从11场景源码增9分类记录。资源门两个现有profile、driver run根/kind、DEV侧登记与误alias红例写定；进口与路径字符串两类都检查。 | D255、D272–285、D291；P150；I7180及I7804 | 否 |
| N-1 | CONFIRMED / PARTIALLY | 需求D-1/§8仍禁止提前设计，当前Dexter明确指派覆盖设计开始时间。详设公开登记源头OPEN；本轮不改正本。下次另获需求修改授权时同步裁决来源，无需重裁产品。 | D15、D376；需求599/611未改 | 不需新裁决；源头修改未授权 |
| N-2 | CONFIRMED / CLOSED | 两integration module.ts八个StateRoot selector未root导出；补排除，不多造公开API。旅途用已公开activation/staff/screen/layers/member selectors +控件/request，无内部route复制。 | I404起八条；D39、D146、D174 | 否 |
| N-3 | CONFIRMED / CLOSED | mobile明确normal(age空/37)、reject-retry、abandon；hand-back/keyboard-alpha-probe为待重写HANDOFF，不再模糊写返回case。 | D102、D177；P123；§9a.1 | 否 |
| N-4 | CONFIRMED / CLOSED | PrimitiveAdmin.tsx:74–90 item.testID在View。新增valueTestID挂value RnrText；保留item外框ID，组件分别断言。CP-05同根处理所有FactGrid调用。 | D162；UI83；IA§3；P100 | 否 |
| N-5 | CONFIRMED / CLOSED | 实施模板6c:173要求fresh三维前移。统一每CP首次动态前需求/详设IA/记忆三维静态核验，非CP退出MATCHED；同CP只对变化补差量。 | D331、D385；P19 | 否 |
| N-6 | CONFIRMED / CLOSED（运行成本NOT_RUN） | selectRequestExecutionViews.ts:14–38全量新数组、workspace=null仍包括，limits.ts:13是保留时长非条数上限。一次基线read、动作前workspace订阅、选中后关集合改精确订阅；F4b测真实长驻账本与超预算红例，未假设无限体量可过。 | D167、D174；P101 | 否 |
| N-7 | CONFIRMED / CLOSED（性能NOT_RUN） | 明确release VM同步flush和query测量起止、128订阅总体成本、P95/max，不含调度/网络等待。RN0.86官方performance为60Hz时间及release测量依据；16ms仍是本批初始预算。 | D152、D165–167；P101 | 否 |
| N-8 | CONFIRMED / CLOSED | 示例先length===1、再解构并检查node，不用第一项掩盖歧义，不加queryOne API。 | K24–28 | 否 |

作者处置统计：12 CLOSED、1 PARTIALLY、0未处置finding。N-1需求源头为OPEN；新增机制实现/能力证据均OPEN/NOT_RUN，不与文档关闭状态混称。

## 3. 同根核验与方案成本

- 六CP与所有R/V映射、两屏、skill统一逐字转录/首次三维/值状态语义；未留下“fresh本人必须写跑、需再豁免”的旧方案。
- 42 selector均作checker返回类型分析（TypeScript6.0.3、读取各owner tsconfig、getReturnTypeOfSignature，不emit/不执行tsc gate），顶层undefined三项、顶层any零项；内部可选字段/真实数据的JSON性不从类型分析推成PASS。
- 原145 testID文件的哈希只读复算，无漂移；没有执行全量生成或类型门。附件12条排除项由原4项加8内部selector组成，20条退役分类由原11场景源码加9登记/helper组成。
- 共享HTTP helper替代复制；品牌类型替代过程间符号分析；身份readback复用已有manifest-bound远端只读函数，不建产品API、第二存储/恢复框架；没有新增业务slice/platform port。
- N-7外部一手读取：[RN0.86 Performance Overview](https://reactnative.dev/docs/0.86/performance)。该文支持帧时间及release测量原则，不证明本仓达到预算，不替代具体Fabric/Presentation API官方依据。
- 新fixture槽位是否实际存在、持久化deviceId/manifest回收及新增readback字段运行均未验证；缺数据/权限明确BLOCKED，不自动reset/seed。

## 4. fresh DESIGN 审查工具状态

本轮实际尝试 `automation_design_revised_r1`，fork_turns=none，提供授权原文、全部最小输入、完整包与只读边界。工具直接返回 `collab spawn failed: agent thread limit reached`，未生成agent/session ID、阅读记录或verdict。
随后实际list_agents：root运行，四个历史子agent completed。它们不是本任务fresh reviewer；工具无释放历史线程的API，不复用历史agent冒充fresh。此前首版尝试的同样失败见旧author-check，本轮仅一次新派发，不盲重试凑三次，不启用作者接管例外。

FIRST_FAILURE=协作线程容量；LAST_KNOWN_GOOD_PHASE=主agent完成静态文档修订；BROKEN_BOUNDARY=reviewer creation。
CURRENT_REVIEWER_STATUS=NOT_CREATED
VALID_INTERNAL_REVIEW_ROUNDS=0
INDEPENDENT_VERDICT=NONE
INTERNAL_DESIGN_REVIEW=OPEN
AUTHOR_SELF_DECIDED_VERDICT=NOT_USED

外部差量复评不替代内部fresh留痕，也不重开已经关闭的需求DESIGN cycle。当前不授权实施。

## 5. 当前设计包 SHA-256

需求正本未改：`37fe9363e79b6db3dbb68a36429d109cb8f7d586e465f701f86de4bf09507739`。

| 文件（仓根相对路径） | 当前SHA-256 |
|---|---|
| `doc/decisions/2026-10-05-ter-automation-agent-journey-claude.md` | `0f6aec0cda44ac82e5054db6c03470eaa53081f022cfdccf008f77bf84e0d6ed` |
| `doc/decisions/2026-10-05-ter-automation-agent-ia-claude.md` | `be8fa1bd07bc233a6318261adc7135bfc0b2fe7f19cc8ba2f381baa7ebc703ce` |
| `doc/decisions/2026-10-05-ter-automation-agent-ui-interaction-claude.md` | `08c994c9f8aa6e4ad8a47b3f1dd3d01bb8726dd80a9a4838b33312664700789e` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md` | `3fde4d1cbabd39521093ac87c14f7c4aec04ac32dbd0539a327c364a65be792e` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md` | `7a38b98a8fac4be50fb6d2a115e6ee3b137601d58e0ad87cbfcf4afb1087b732` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-source-inventory-claude.json` | `74ed7133dcacca07a6aeb68881de1a6afb23f667d83abe34c6ff2bcfa6dc225c` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-skill-draft-claude.md` | `670e0b52ce74db70ef70e7af3cb32218323e6abd7632b09f53f9d311532339c5` |

## 6. 未验证项与下一步

UI线框UNSET；F-1/F-2/F-4a/F-4b、V-01～20、selector注册/订阅、command late、品牌门红例、fixture/回收、driver资源/日志/cleanup均NOT_RUN。新依赖仍未安装或解析；精确官方依据未闭合项保持OPEN。未运行生成、编译、测试、verify、DEV、Web/mobile/dual VM、reset/seed、L2/UAT。
下一步仅为外部差量静态复核，范围详设§4.2/4.4/4.5/4.6/9a/9a.1/9a.2/10b.6（及关联§4.3预算/文本节点）、附件/skill、计划CP-04～06；具体话术见同日design-review-request。
