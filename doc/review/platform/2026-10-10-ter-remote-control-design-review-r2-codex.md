# TER 应用内远程控制 DESIGN 独立盲审 R2

以下为独立子 agent `/root/remote_design_r2` 返回的报告正文。主 agent 仅保存，未改变其 verdict；本报告绑定下列修订前 SHA，不是后来修订字节的独立结论。

Dexter，本轮独立结论为 **NO-GO，0M/2S/3N**。两个 S 是当前设计仍可静态确定的契约与交互生命周期缺口；T-01～T-04 技术 proof 的 OPEN、看图 UNSET 和尚未运行的 UI，不是本轮阻断原因。R1 的六个 finding 均已在当前设计声明层关闭。

```text
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_DESIGN_2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-remote-control-design-review-r2-input-codex.md
BLIND_REVIEW=true
blindReviewDeclaration=先独立读取当前输入并形成findings/verdict，通知主agent后，才读取R1报告与作者intake核对关闭
authorMaterialReadAfterIndependentVerdict=true
ROUND_FINAL_DECISION=SELF_DECIDED

ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0M/2S/3N
L1_ENGINEERING=R2-S01；R2-N02
L2_USER_VISIBLE=R2-S02；R2-N01；R2-N03
L3_UNVERIFIED=DEXTER_WIREFRAME_REVIEW=UNSET；T-01～T-04=OPEN；新增SDK/native/media/真实UI/生成/实施/Web/Android/L2/seed/资源与cleanup全部NOT_RUN
SAME_ROOT_SCAN=见逐finding的全集、反例与适用边界
DESIGN_GAPS=未发现需由review临时创设的新判据；本轮缺项已有正式模板、规范或需求依据
TEMPLATE_COVERAGE=见四模板逐节覆盖表
EVIDENCE_TIER=STATIC_SOURCE_ONLY
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_EXECUTION=NOT_RUN
FILE_WRITES=NONE
```

`review-standard.md:172` 的“L3 非空只能 GO_WITH_UNVERIFIED_UI”若孤立理解，会使存在静态阻断的审查无法 NO-GO。本报告按本轮输入明确指定的“仅静态合格且剩未验证 UI/技术时 GO_WITH_UNVERIFIED_UI”处理：当前有两个静态 S，故 NO-GO；二者关闭后，技术与 UI 仍未验证时只能讨论草案 `GO_WITH_UNVERIFIED_UI`，不能据此宣布冻结技术输入可执行。

**实际读取与独立性**

本轮全文读取六个被审对象，未以 R1 或作者 intake 替代当前字节。独立候选结论形成并通知主 agent 后，才读取下列两份材料：

- `doc/review/platform/2026-10-10-ter-remote-control-design-review-r1-codex.md`
- `doc/review/platform/2026-10-10-ter-remote-control-design-review-intake-codex.md`

入口与约束实际读取：

- 本仓 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`。
- `.agents/skills/cs-review/SKILL.md`。
- `project-memory/index.md` 的全部六个 kernel 原文及 `project-memory/decisions/deterministic-context-only.md`。
- 正式需求 `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md` 全文与同批 discussion 全文。
- 四份 `doc/decisions/templates/{ia-design,journey-decision,ui-interaction-design,implementation-design}-template.md`。
- `implementation-task-template.md`、`review-standard.md`、frontend/backend/terminal coding standard、foundation charter、third-party-library-usage standard，以及 verification-governance 原文。

六维路由实际执行：

```text
scripts/memory/query
  --task-kind design
  --domain platform
  --consumer-face operations-admin
  --owner platform
  --impact architecture
  --trigger task-start
```

已读取全部命中原文，包括六个 kernel，以及以下任务相关记忆：confirmed-business-language-corpus、deterministic-context-only、http-crud-efficiency-design-redlines、independent-subagent-adversarial-review、owner-read-model-and-lifecycle-standard、business-corpus-adoption-and-read-policy、business-corpus-parked-domain-intake、terminal-coding-standard、designing-from-conversation-not-system、invisible-dimension-drifts-at-implementation、platform-detail-reverse-inference、backend-capability-lookup、collection-boundary-modes、module-call-boundary-ownership、ordering-only-for-consumer-facing、ter-input-and-virtual-keyboard-usage、third-party-library-official-source-verification、terminal-architecture-and-stack-rulings、terminal-build-order-and-batches。

Corpus 检索覆盖“运营/运维、项目、门店、终端、主机/副机、主屏/副屏、读授权与写授权”。本轮未从版本管理权推远控写权，未从客户端 projectRef 推 scope，未把副机推为独立 CBS 终端，也未把 LMS/LSP 内容角色推成新的认证身份。

查看了 `doc/decisions` 标题导航，并全文重开适用的 solution-reasonableness、verification-governance、frontend foundation consumption、frontend asset carry-over、agent coordination、confirmed corpus adoption、design governance batch1/batch1.5、independent review governance、identified finding generalization、observability and acceptance、backend acceptance business scenario、roadmap retirement及 terminal activation service-shape 决定。历史材料中的 hook/package 控制面按当前 AGENTS 的退役边界处理，未恢复为本轮准入。

按问题重开真实 owning source，读取范围为相应实现及相关调用/查询段落：

- `OperationsTerminalUpdateReadController` 的原页面读取授权与 PROJECT scope。
- `TerminalUpdateReportPersistence` 的 `page/detail`、五项查询条件、SQL 过滤及 cursor 身份。
- `TerminalControlOwnerService` 的 `invokeOnline`，`TerminalControlPersistence` 的 binding、online session、online operation 与 claim。
- `WorkspaceCapabilityScopeResolver` 的生成操作授权形态。
- TDC actor 的 generated transport、credential owner 与 terminal read command 边界。
- Runtime request ledger、topology facts 与 peer controller 的目标和关联。
- platform ports 的类型/default/装配边界。
- dual-screen 的 Window registry、Presentation、几何与生命周期。
- `ProjectTerminalUpdatePage` 的 report columns、原 Drawer、overlay lock 和原动作。
- foundation 的 detail action menu、async generation guard 与公开导出。
- terminal automation runner 的 phase/parser，现有 operations fixture、seed role key 与父流程接线。
- canonical edge catalog 的 errorSets、security/authorizationMode 及相关登记结构。

源码定位与部分段落读取不等于声称这些大型源文件全部逐行审查；完整被审对象、必读入口、模板、规范、路由记忆和原始需求则已全文读取。未读取 `.runtime`，未执行测试、生成、构建、verify、DEV、L2、设备或 seed，也未写入文件。

外部官方资料只用于核对技术路线的证据边界：已查看 [LiveKit data packets](https://docs.livekit.io/transport/data/packets/)、[Expo 集成](https://docs.livekit.io/transport/sdk-platforms/expo/)、[官方 JVM SDK](https://github.com/livekit/server-sdk-kotlin) 与 [Android PixelCopy](https://developer.android.com/reference/android/view/PixelCopy)。这些资料不证明本仓选定版本可完成 native frame→SDK track 接缝，不关闭 T-01～T-04。

**当前字节绑定**

六文件实际 SHA-256 均与 R2 输入清单一致：

| 被审文件 | 实际 SHA-256 |
|---|---|
| `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md` | `45629570d53cf1d3a243db993f64ff731d388c3c4f4633f105bfe8483eb8a923` |
| `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md` | `87fdf43bf7e8ec6833e9938bdf022808f23345ae8942e128b5236fc7b357115c` |
| `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md` | `b1555e6fcfdc6c26fb5249861f3019d279f39ec0421efed8349e7bf9d5211ac8` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md` | `2667675c89f8ef76afa46e6228a8df27ff767aaef7d002e5f71913a8d4006de4` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md` | `8cb4484c8f6747bcd1e92da317c07076302b90349020e32ace3ac0ddff2fd4fa` |
| `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md` | `7a87e8db88993c289cdd92ac77094bf7a2708ea6b21b801ae9dc860b063111d9` |

**应然事实与方案合理性**

从设计文档提取的主流程是：原项目终端 Tab 查询→终端名称→原详情 Drawer→操作菜单远控→STARTING→全部所需屏幕 ready 后 ACTIVE→正常 pointer/虚拟键盘业务输入→结束或关闭→清理；断连后由用户重新发起新 session。既有列表与详情承担终端定位，新工作区承担视频与输入，终端不增加 UI 面。

整体方案与 90% 主流程目标相符：

- terminal-control 保有 session、独占、lease、grant 和审计 owner；TDS 保持运输职责。
- 原报告集合增加显式任务型 connection join，不另造终端目录，不改变升级报告事实。
- 三个运营 POST 用新写 capability；session GET 沿原页面与角色读取范围，不以写 capability 收窄 GET。
- TDC 的两项新认证 command 与原 `terminalRead*` 分开，未把只读运输伪装成 POST。
- 一个 TS SDK Room、窄 native Window/frame/input 接缝，避免第二套 Room 或通用桥框架。
- 当前实例、pair、stream、gesture 与 sequence 绑定能约束旧响应和错目标；无自动恢复、排队、接管及离线补发。
- 关闭先禁输入、CANCEL，再结束事实和释放媒体；资源 cleanup 与会话结束分开。
- 种子明确角色差量，复用父 seed 和 fixture，不新增真实账号角色政策。
- CP→整体三维对账→获授权动态验证→13c 的顺序未发现循环依赖。未来 managed、资源预算和 cleanup 接线仍是计划，未被写成已运行通过。

未发现为了罕见攻击或保密需求新建协议平台、持久队列或协同输入引擎的必要性。本轮最小修正均可以在现有文档中完成。

**R2-S01：六个 HTTP operation 的 canonical typed-error 合同尚未确定**

位置：

- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:47`
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:74`
- 同附件 `:75`、`:76`、`:77`、`:78`、`:79`、`:82`

事实：详设只声明每个 operation 的集合应等于基础 `errorSet ∪ augmentation`。六行矩阵列的是中文业务语义、少量 reason 和 HTTP 状态，没有逐 operation 的实际 `errorSetRef`、完整增补清单和 wire problem code。附件第78行以 `TERMINAL_CREDENTIAL` 称“基础错误集”，但当前 catalog 的该值属于 security/authorizationMode；`errorSets` 在 catalog 第400行起另行定义。第82行仍把基础集合选择与 typed HTTP 对齐留到实施前。

判据：`doc/decisions/templates/implementation-design-template.md:66` 明确要求逐 operation 写出 `errorSetRef` 与增补清单；相关设计治理还要求业务失败条件与 typed problem 判定对应。

推论与影响：即使完全不做 SDK/native proof，实施者仍需自行决定 NOT_READY、identity conflict、expired、非法状态回退等常见条件对应哪个 wire code、HTTP 状态和错误优先级。现有 reason 闭集及中文文案不能替代 HTTP problem 合同。当前文档因此尚未达到“实施 agent 最小自由发挥”的设计目标。

最小修正：补六行准确 `errorSetRef` 与各自 augmentation；将已定义失败条件对应至准确 wire code/HTTP，并明确并存条件的判定先后。共用认证和上下文条件可引用现有基础集合，不必复制六遍；会话 reason、Data 输入结果与 HTTP problem 必须区分，不应把 R-20 全集灌进每个 operation。本轮只补设计，不生成文件或运行。

同根扫描：六个新 HTTP operation 全部适用；原 page/detail 保持其既有错误边界，不因本批新增远控就重定义。此 finding 不要求当前冻结 SDK 方法签名、DB 实测计数或执行生成。

性质：**静态模板与契约设计缺口，未声称已发生实现错误。**

Dexter 裁决：按现有错误规范补齐不需要新的产品决策；若作者拟新增或改变产品失败语义，再交 Dexter。严重度建议 S。

**R2-S02：Drawer→全屏 Modal 的叠层及焦点生命周期未确定**

位置：

- `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md:45`
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:48`
- 同 UI 文件 `:99`～`:104`
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:133`

事实：文档规定从原 Drawer 打开全屏工作区，但没有确定是否先关闭 Drawer、叠层上限和同层互斥。附件只写“焦点归原入口”，没有说明入口是仍在的 Drawer 菜单按钮还是列表终端名称。全屏 Modal 的承载例外不同时等于批准保留 Drawer 的叠层例外。

判据：

- `doc/platform/frontend-coding-standard.md:449` 要求 Journey 声明叠层上限、同层互斥和焦点归还位置。
- `doc/decisions/templates/ui-interaction-design-template.md:386`～`:387` 的默认路径是从详情动作关闭详情后打开下一 surface。

当前源码的原终端 Drawer 与 `useOverlayLock` 已有具体生命周期；增加工作区时仍必须作出上述选择，不能用“复用 foundation”代替决定。

推论与影响：正常用户打开、Esc/关闭和返回列表的行为存在两种不同实现：保留 Drawer 或先关闭 Drawer。二者影响 overlay lock、焦点目标、原详情保留和关闭事件，属于每次远控都会经过的正常路径。

最小修正：按现有默认规则，在 Journey/UI 明确“关闭详情后打开工作区、叠层上限1、同层互斥”；关闭/Esc 进入同一 workspace owner 的取消、结束与清理路径，焦点返回当前项目下原终端名称按钮，原节点失效时返回当前 Tab 的明确焦点锚点。无需新增 dirty guard、关闭确认或 overlay 框架。如确需保留 Drawer，则应明确例外和对应焦点归还行为。

同根扫描：已核对 LIST→DETAIL、DETAIL→WORKSPACE、ACTIVE→ENDED、ENDED→新 STARTING、结束、关闭、导航离开及项目切换。ENDED 与重发仍在同一工作区，不需要另开结果弹层；本 finding 不要求本轮动态证明焦点。

性质：**静态交互生命周期缺口，未声称运行时存在双重清理或焦点 bug。**

Dexter 裁决：采用已有默认路径无需新增产品裁决；保留 Drawer 的例外交 Dexter。严重度建议 S。

**R2-N01：原查询保持现状，但模板分母及逐操作合理性覆盖不完整**

位置：

- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:28`
- 同文件 `:59`、`:89`、`:131`～`:132`
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:137`

事实：文档明确原查询保持现状，新增自动化只操作其选定控件；但未按模板列出逐 screen 搜索适用分母、原输入依赖及完整查询条件表。“逐操作任务合理性”仍是一段整体理由，而不是每个本批可见操作的 Journey/任务依据。

源码反例与适用分母：`ProjectTerminalUpdatePage.tsx:609`～`:695` 的原报告查询有终端名称、门店、APK、JS、Runtime 五项。门店使用 searchable Select，版本使用原文本输入；最近状态、接收时间为 `search:false`。`TerminalUpdateReportPersistence` 已定义名称与版本查询语义及 cursor 身份。新增 connection 状态不自动成为新查询条件。

判据：UI 模板第252行起要求 input-bearing 面的依赖声明，第312行起要求逐 screen `SEARCH_CAPABILITY_DENOMINATOR`，第378行起要求逐可见操作的任务合理性。

影响：文档覆盖不便于确认原条件完整保留，亦不能把技术 locator/九列表当成任务合理性表。不过，当前源码与明确的“保持现状”给出了足够反例，不据此认定产品查询被改坏，也不重新打开 R1 的自动化 finding。

最小修正：简表声明 LIST 为 APPLICABLE 并引用原五条件、已有查询语义和上下文失效；DETAIL/WORKSPACE 搜索为 N/A；原输入依赖引用现有 owner/read source。逐操作补原动作保持依据以及新增 start、pointer、end/close、restart 的任务依据。无需新增筛选、候选服务、控件或自动化动作。

同根扫描：三个 surface 全部核对；五个原查询条件与本批实际操作分开。低影响模板完整性问题记 N。

Dexter 裁决：无需，除非拟改变原查询行为。

**R2-N02：既有 operation 表名写成不存在的 `remote_operation`**

位置：

- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:52`
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:206`

事实：两处称保留既有 `remote_operation` 表。真实 source：

`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistence.java:44`、`:53`、`:65` 使用 `terminal_control.online_operation`；`:150` 使用 `terminal_control.claim_online_operation`。

影响与最小修正：实施导航可能找错 owner 表或误认为需建兼容表。把两处精确表名改为真实名字即可；无需任何源码、迁移或别名。

同根扫描：本批两个表名引用均成立；泛指“remote operation 事实”的自然语言不视为表名错误。设计已经明确复用既有投递，故按文档定位错误记 N，而非新平台功能冲突。

Dexter 裁决：无需。

**R2-N03：STARTING 文案与正式需求不一致**

位置：

- `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md:109`
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:20`
- 同 UI 文件 `:74`；`:118` 为相邻 NOT_READY 文案

事实：正式需求规定 STARTING 显示“正在连接终端”；交互工件使用“连接中，请稍后”。

影响与最小修正：当前尚未实现，但实施时会出现两个可选正本。统一 STARTING 状态文案及线框即可。NOT_READY 的状态/失败语义应分别说明，不能仅凭相似中文把二者合并。

同根扫描：三个 surface 的状态与文案已核对，差异位于工作区 STARTING；占用提示和有限结束原因未发现同类冲突。

性质：文档间可见文案冲突，记 N。沿正式需求修正无需 Dexter；若主动改正式需求文案，则由 Dexter 确认。

**四模板逐节覆盖**

“有”表示本轮草案已提供对应内容或精确互文，绝不表示运行 PASS。以下不要求恢复已退役 manifest/compliance 控制面。

| 模板 | 槽位 | 结果 |
|---|---|---|
| IA | §1 元数据 | 有，含草案、看图及授权边界 |
| IA | §2.1 可见维度 | 有，原列表、详情和工作区分开 |
| IA | §2.2 不可见维度 | 有，owner、scope、状态、失效及媒体/输入边界 |
| IA | §2.1.1 容器负载行为 | 有，原容器引用及全屏媒体布局 |
| IA | §3 共用 IA 规则 | 有，复用既有内容面，无新终端目录 |
| IA | §4 全量错误语义映射 | 有 UI/reason 互文；HTTP canonical 缺项另见 S01 |
| IA | §5 交叉对账 | 有；文案差异见 N03 |
| IA | §6 完成判定 | 有，UNSET/OPEN，不宣称实施冻结 |
| Journey | §1 元数据 | 有 |
| Journey | §2 用户任务与成功结果 | 有 |
| Journey | §3 逐 actor 前提链 | 有 |
| Journey | §4 边界、非目标与禁推 | 有 |
| Journey | §5 Corpus | 有 |
| Journey | §6 UI/后续工件 | 有 |
| Journey | §6.1 管理后台一致性 | 部分缺：叠层、互斥及精确焦点，S02 |
| Journey | §7 Dexter 裁决 | 有，功能原话、看图及技术 OPEN 分开 |
| UI | §1 元数据 | 有 |
| UI | §1.1 强制 UI 标准 | 有，基础能力互文 |
| UI | §1.2 管理后台一致性 | 有引用与 surface roster；生命周期缺项见 S02 |
| UI | Surface ownership | 有，三个 surface |
| UI | 业务语言/动态明细命名 | 有；本批无新增业务动态明细集合 |
| UI | Owner-definition 字段事实 | 有，新 mutation 与隐藏事实矩阵 |
| UI | §2 Interaction map | 有；DETAIL→WORKSPACE 生命周期不足见 S02 |
| UI | §3 Heritage 盘点 | 有“无对应新远控面”及 CP01 再核查边界；非已搬运证明 |
| UI | §4 线框 | 有，三个 surface及工作区状态 |
| UI | testId/控件 roster | 有，附件4a/4b互文；全部挂载/focused OPEN |
| UI | 输入依赖图 | 部分缺：原查询输入未完整列入，N01 |
| UI | mutation 字段矩阵 | 有，terminal/project/request/session/gesture/token 来源 |
| UI | 主从动态集合保存边界 | NOT_APPLICABLE：无本批可编辑主从集合；媒体 slot 不作为表单集合 |
| UI | 搜索适用分母/条件详设 | 缺，N01 |
| UI | 候选查询统一协议 | 原门店候选保持现有实现，缺明确保留互文，归 N01；不要求新增候选机制 |
| UI | §5 状态与边界 | 有，R20及输入/cleanup区分 |
| UI | §6 逐操作合理性 | 部分缺：只有整体理由，归 N01 |
| UI | §7 Face/owner | 有 |
| UI | §8 Manifest B.4/B.5 | NOT_APPLICABLE：当前 AGENTS 已退役此控制面；复用/冻结边界仍有 |
| UI | §9 可选 demo | NOT_APPLICABLE_WITH_REASON：ASCII 草案，不另运行原型 |
| UI | §10 Dexter 看图 | 有，明确 UNSET |
| 详设 | §0 授权元数据 | 有 |
| 详设 | §1 业务目标/方案比较 | 有 |
| 详设 | §2 CP 总览 | 有 |
| 详设 | §3 横切机制表 | 有；错误登记行实值缺项 S01 |
| 详设 | 第三方 API依据 | 有研究路线与 OPEN；精确版本/API proof合法留待技术前置 |
| 详设 | §3a UI/testId前置 | 有，附件互文，OPEN/BLOCKED 未伪 PASS |
| 详设 | §4 CP 门控 | 有 |
| 详设 | §5 operation/path/face/集合 | 有；六 HTTP合同欠准确错误集合 S01 |
| 详设 | §6 跨 owner 写矩阵 | 有 |
| 详设 | §7 声明—传递—消费 | 有，含机制边界 |
| 详设 | §8 owner 判定点 | 有 |
| 详设 | §9 owner API/消费者 | 有；精确 SDK/native接缝未冻结，T前置 OPEN |
| 详设 | §9a 全链同步 | 有，含原 page/detail DTO |
| 详设 | §9b 变更定位 | 有，附件 create/update/retain |
| 详设 | §10 迁移 | 有；既有表名称 N02 |
| 详设 | §10b.1～10b.6 seed | 有，文件、差量、角色、父流程及执行边界；未运行 |
| 详设 | §11 验收场景 | 有，六 HTTP、协议及用户路径 |
| 详设 | §11a 判据对照 | 有 |
| 详设 | §12 未决项 | 有，T技术与 UI OPEN |
| 详设 | §13 停机条件 | 有 |
| 详设 | §13b 三维对账 | 有，以完整 CP 为单位 |
| 详设 | §13c 逐代码对账 | 有，实施后的真实代码判定，未提前完成 |
| 详设 | §14 自查 | 有，不能替代独立 verdict |

无出处数值扫描覆盖启动30秒、lease30秒、token初始60秒、数据包4096bytes及输入/keepalive相关设计阈值。它们已区分需求规定、当前设计选择与后续验证，不把官方 transport 最大值冒充本域需求，也未凭空增加分页上界。未因这些草案选择另报 finding。

**R1 六项关闭核对**

| R1 finding | 当前独立核对 | 状态 |
|---|---|---|
| S01：GET 被写 capability 收窄 | 详设第40/78/93/108行与附件第75行明确 GET 沿原页面与角色 PROJECT 读范围，不调用写操作 resolver；过期只读导出 ENDED，不写 audit。三个运营 POST及续约仍复核 live 写授权。与原 `projectReadSession` 形态一致。 | CLOSED |
| S02：动作控件/自动化控制面缺分母 | UI第84～104行及附件§4a/4b提供真实动作节点、九列表、常量、binding、控制文件及 PROJECT helper 接线。未把不存在的新节点/focused结果说成 PASS。N01要求的是原查询和任务合理性模板分母，不重新打开此项。 | CLOSED，设计声明层 |
| N01：ACK 消息名错位 | 附件第94行与详设协议成员使用 `KEEPALIVE_ACK`，六消息互文一致，不引入旧别名。 | CLOSED |
| N02：`readCurrent` 源码导航不存在 | 附件第13行改为真实 `page/detail`，与查询 owning source 对应。 | CLOSED |
| N03：connection DTO 形状不一致 | 详设第95行及全链同步矩阵规定顶层 `connectionStatus/observedAt/evaluatedAt`，原 page/detail同步，不保留嵌套别名。 | CLOSED |
| N04：seed role 与凭据来源不清 | 附件第165～168行明确原 `role-project` 加 cap、`role-group` 不加 cap，DEV角色/账号数量不因此扩张；独立测试 controller/readonly fixture 与 DEV seed 分开，凭据沿现有父流程。 | CLOSED，fixture设计层 |

CLOSED 不表示生成、seed、挂载或真实授权行为已通过，也不改写 R1 的原 SHA 与历史 verdict。

**未验证清单与终轮边界**

| 档位 | 本轮结果 |
|---|---|
| 静态已核对 | 当前六文档、输入/授权、owner/scope、真实能力复用、计划变更与前置边界、模板缺项、R1修正文档 |
| 测试已证 | 无；本轮没有运行 |
| 无人于本轮验证 | Dexter看图；T01～04 native capture/track/input/多屏 proof；准确解析SDK与native API兼容；RTC/TURN/真实Room；Web/Android用户场景；真实焦点与pointer映射；生成一致性；seed及fixture执行；资源预算、business与cleanup |

本轮只审设计草案。T-01～T-04 OPEN 是诚实的技术前置，不能要求本轮执行动态来换取设计 verdict；同样不能由静态草案通过推导供应商桥 API 已冻结、native 接缝可用或获得实施授权。

本 cycle 已完成第二轮，应硬停止独立 DESIGN 轮次。主 agent 必须亲自核实并处置上述五个输入，可作最小文档修订；修订后的字节没有本轮独立 verdict，需保留原 SHA 边界并按 `SELF_DECIDED` 收口，不召集第三轮。真实产品例外及仍未解决的技术阻断直接交 Dexter。

本子任务的只读审查与报告已完成；没有文件写入或动态资源，故无本轮运行 cleanup 待关闭。
