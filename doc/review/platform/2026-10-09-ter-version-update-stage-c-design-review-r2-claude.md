# TER 更新阶段 C：fresh 独立 DESIGN Round 2

```text
REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=/root/stage_c_design_round2
ROUND_FINAL_DECISION=SELF_DECIDED
INPUT_CHECKLIST=doc/review/platform/2026-10-09-ter-version-update-stage-c-design-review-input-claude.md
VERDICT=NO-GO
M/S/N=0M/1S/2N
EVIDENCE_TIER=STATIC_CURRENT_SOURCE
IMPLEMENTATION_AUTHORITY=false
DYNAMIC=NOT_RUN
FILE_WRITES=NONE
RUNTIME_READS=NONE
AUTHOR_MATERIAL_READ_AFTER_INDEPENDENT_VERDICT=true
```

## 1. 结论与独立性

当前冻结六份设计总体方向合理，R1 暴露的四个主流程反例已在当前设计中实质修正。仍有一项普通供给链准入指令与真实权限合同冲突，故本截面为 **NO-GO，0M/1S/2N**。两个 N 是模板显式覆盖不足，不是已证实的运行失败。

本 reviewer 先读取根规、kernel、deterministic、六维路由原文、需求、规范、当前六份设计与真实接缝，独立形成上述 findings/verdict，并向主 agent 留下封口消息；之后才完整读取 R1 与作者 intake。未继承其分类、严重度或 CLOSED 标签。主 agent 提供过权限源码导航，本 reviewer 重新打开 canonical、实际 UI 与合法账号链后独立定性。

本轮遵守 Dexter 当前直接裁决：只处理常见主流程；不同 App 不得配对；保留同 moduleName/protocol 资格；不为 C typed command 升级协议；A/B 在途材料不作为 accepted proof；新邀请 UI 仍 UNSET。没有因缺少动态证据产生 finding。

## 2. 受审字节与来源截面

| 文件（仓根相对路径） | SHA-256 |
| --- | --- |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md | ed7646bdebb7ce165de138a9b3d1b18aa19baafc020f758f017ce04b41eac8e1 |
| 同前缀 ia-claude.md | 08c73da937bb7768728924f24650b8473830ef979756b7ef1124a0433815706c |
| 同前缀 ui-interaction-claude.md | 065f359a218405737e8894fab8076cc560d573df95297746dd692830f1ded003 |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md | 1966c95e8926a67425c5ee885ac3501bfafe84f3f68bd8ef5f63d9e30c9c5281 |
| 同前缀 implementation-plan-claude.md | 1e5393e934af009010aa5bf07fcfdc841719cc5c03696baf0510101c9d1a3421 |
| 同前缀 source-and-api-appendix-claude.md | c2b445c8c0e9ef21040db16ff5381298b4e1f3bb1b35bffdc7b7e0cb89d83c01 |
| INPUT_CHECKLIST | 23e981f1228c09d27db88050adaacc10b2ac90c49ac03b5fd0b1840cc621e158 |

七项实际复算均与冻结输入一致。未执行 Git 命令。

B 正在并行实施，以下是本轮读取结束附近的源码哈希，不能外推为 B 最终截面：

| 来源 | SHA-256 |
| --- | --- |
| terminal-update/src/features/actors/terminalUpdateActor.ts | afab9ade2f9249e2132f93b98ebc09964d1b05dbc4c99ef697c87555fc53532b |
| topology/src/application/createTopologyStateSyncController.ts | c9f156b298b344986176ce47f3966e4571eab8018c92a195a166673acfe5c21f |
| topology/src/features/actors/actors.ts | 5073cd9a2ec57ef04ef7289b8a35dcef1a4a0dad4ebafa6982cac83147140963 |
| Android update/TerminalUpdateRuntime.kt | d6903e96b21f5355c65c61f353e57d26cfdc27333b499d796218df478d422cfb |
| Android update/TerminalUpdateArtifactPreparer.kt | f20d8bcdaf7de7db0d0c688a3fad851e3a73e7044ca931d1c0cf3784db3609d8 |
| operations-admin/terminal-update/ui/ProjectTerminalUpdatePage.tsx | b61f771ebb606c9e0ba1c998d86020cb00fe4ab455a2294413cb860c080f8c6b |
| contracts/catalog/admin-catalog.json | 766f7e668483e6e6ef5e2b17c30907b82e31bd3ce57b7c1904c9de00736d8f07 |

## 3. 方案合理性

店员真正需要完成的是：系统自动取得符合本机条件的新规则，在原业务界面继续工作；FULL 沿系统安装能力执行，并持续邀请尚未完成安装的用户；HOT 按立即或本机连续 M 分钟无点击执行。运营管理员需要通过既有后台发布目标并观察主机真实结果。副机需要独立执行自己的固定任务，同时遵守现有配对与授权边界。

Dexter 的范围和成本立场明确支持复用 A 执行核、B 供给链、既有 topology/runtime/render/automation。当前设计增加的是有限策略字段、一个本机计时器、规则投影、compact grant、技术呈现桥及本机邀请，不要求第二任务账本、跨 App 业务、peer command 分片、后台闹钟或通用恢复框架。

独立比较的更小替代为“FULL/HOT 均立即执行，取消 N/M 策略和 React 再邀请”。它确实减少状态与 UI，但不能满足已批准的持续提醒和闲时 HOT。另一个替代为“每次 FULL 先显示业务安装按钮”。它会阻断平台本可完成的静默安装，增加必经用户操作。当前选择先沿 A apply、仅对等待用户的任务再邀请，路径更符合目的。

当前方案合理性为 **方向成立、有限增量可实施**。主要成本在已有 owner/native 生命周期交接和真实双机验证，不在新框架。S-01 是供给链前提身份错误，修正不需要改变方案。新增邀请的外观与交互仍需 Dexter 看图；静态审查不能代替该结论。

## 4. Findings

### S-01：C fixture 使用不存在的能力标识，普通供给链准入与真实合同冲突

- **设计位置**：`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:287`，§10b.3。
- **判据与真实来源**：
  - `contracts/catalog/admin-catalog.json:2035`：唯一 canonical key 为 `MANAGE_PROJECT_TERMINAL_VERSION`；2037 为 operations-admin，2044–2048 为 GROUP/PROJECT 可授予任职及 SELECTED_PROJECT_SCOPE。
  - `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:24`：实际 writable 判定消费同一正确 key。
  - `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:521`：运营写 actor 使用 r5-account-multi-role，真实 shell 选择 asg-multi-group 的 GROUP 任职，再选择 project-river 的 PROJECT 数据节点，并核验 `MANAGE_PROJECT_TERMINAL_VERSION`。禁止借用激活 fixture 的 PROJECT/STORE session 写规则。
- **事实**：C 287 写的是 `TERMINAL_VERSION_MANAGE`，并规定权限缺失即停止 fixture 准备。当前 canonical、实际页面及 B 合法链均使用另一标识。六份 C 同根搜索只发现这一处错误能力名；没有找到合法旧名或 alias。
- **推论与普通反例**：按 C 指令核验或准备 capability 时，合法 seed actor 也不能满足该不存在的 key；若实现者据此创建权限，则会偏离既有合同。普通上传→保存→运营建规则→TER 自动消费主线在创建/启用规则前无法按设计准入。
- **影响范围**：设计/fixture 指令，不能据此声称现有产品权限实现已坏。实际代码与 B 正确 helper 可以避免失败，但这要求实施者忽略或修正 C 明文前提，不能证明该指令正确。
- **最小修正**：将 C 287 改为正确 canonical key，并回指 B 521 的现有 GROUP 任职→PROJECT 数据节点链。无需新 capability、账号、seed 或授权框架。
- **更小替代比较**：只替换字符串即可消除当前直接冲突；增加一个合法链引用能够同时防止误用激活 session，成本仍是一句来源说明。拒绝为此扩大权限设计。
- **状态**：`CONFIRMED`。
- **Dexter 产品裁决**：无需新增产品裁决；严重度及是否采纳仍由 Dexter/主 agent 辩证处置。若要改账号/任职语义才需要另行裁决。

### N-01：Journey 前提表未采用规定三选一及逐 actor 证据槽位

- **位置**：`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md:5–10、28–36`。
- **规范位置**：`doc/decisions/templates/journey-decision-template.md:14–20、32–43`。
- **事实**：模板要求 `IN_SCOPE_PRODUCED / ESTABLISHED_SOURCE / EXTERNAL_PREREQUISITE_DEXTER_DECISION`，及“对谁、需要什么事实、产生/确认位置、来源文件+锚点”。当前表使用 `EXISTING_APPROVED_CAPABILITY`、`THIS_BATCH_MUST_BUILD`，并压缩为四列；元数据也没有显式 SKILL_USED、DECISION_OWNER、CORPUS_VERSION。
- **边界与反例**：A/B 行已经明确“出口尚需核实”“B 仍在实施”，C 详设 §0.1/§12 也明确 OPEN，因此没有证据说明作者把 A/B 验收偷换成 accepted proof。已有管理员与上下文来源亦可由真实代码追踪。
- **影响**：模板覆盖及后续逐 actor 回读不够明确；不能从这一形式缺口推成新增业务失败。
- **最小修正**：保留现有内容，换成规定来源类型，并为管理员、主机、副机等补 actor、必要事实与实际 path#anchor；已有能力和未验收出口分开说明。补齐元数据。新 UI 继续外部前提 UNSET。
- **状态**：`CONFIRMED`，本轮记 N。
- **Dexter 产品裁决**：无新增业务裁决；不要求修改当前“可评审草案、不可开工”授权。

### N-02：邀请动作合理性与逐 hidden fact 矩阵仍被合并省略

- **位置**：`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md:108–123`。
- **规范位置**：`doc/decisions/templates/ui-interaction-design-template.md:267–284、378–391`。
- **事实**：当前 §6 列控件/TestId/动作关联，§7 一句规定 confirm/defer 输入为 taskId、actionId|null、bootId，以及 owner 原子核验。没有按两个真实 command variant 列 `FORM_MUTATION_DENOMINATOR` 及逐 fact 的唯一来源/分类，也没有逐可见操作的 Journey anchor、此时目的、更短路径、替代理由和约束归因表。
- **边界与反例**：当前 Journey 和详设已说明“稍后”“安装”的目的；旧点击零 native、local owner、未知不重 commit 也有明确行为。因此未证实出现多余按钮、身份发明或 stale click 漏洞。
- **影响**：无法按模板逐操作、逐 hidden fact 对账；现有 prose 可以指导实现，但降低后续复核的可追踪性。
- **最小修正**：两个操作各补一行合理性；两个 command variant 各列三个 hidden facts 的最新本机 selector 来源、不可编辑性、owner 最终复核及 stale 失败行为。复用已写出的事实，不新增状态、HTTP、操作或 UI。
- **状态**：`CONFIRMED`，本轮记 N。
- **Dexter 产品裁决**：线框仍需 Dexter 确认；补矩阵本身无需新增产品决定。

## 5. 四份模板完整覆盖对账

“覆盖”仅指本轮静态设计内容，不表示实现或运行 PASS。

| 模板及槽位 | 当前覆盖结论 |
| --- | --- |
| Journey §1 元数据 | 部分；见 N-01 |
| Journey §2 用户任务/结果 | 已有 actor、动作、owner 与可观察结果 |
| Journey §3 逐 actor 前提链 | 部分；见 N-01 |
| Journey §4 边界/禁推 | 已有，符合低成本主流程裁决 |
| Journey §5 Corpus | 已有来源及语义冲突处理；不同 App 冲突明确归当前裁决 |
| Journey §6 UI 适用性 | 已有 TER/后台区分及 IA/UI 引用 |
| Journey §7 裁决/完成条件 | 已有；UI UNSET、无实施授权明确 |
| IA §1 元数据 | 已有来源与 BLOCKED 草案状态 |
| IA §2 可见/不可见维度 | 已有逐项维度和未来可证伪观察，未冒充结果 |
| IA §3 共用 IA 规则 | 当前 §3/§5 写明权限、资源、本机层和引用 |
| IA §4 全量错误映射 | 当前 §4及详设§8给正常/等待/技术失败/UNKNOWN/配对保护；不新增通用错误 UI |
| IA §5 交叉对账 | 当前 §5 指定唯一来源及继承边界 |
| IA §6 完成判定 | 已有 NOT_RUN、UNSET及 A/B 待核实 |
| UI §1/§1.1 元数据/canonical | 已有 TER适用性、文案、技术边界、primitive、容器公式 |
| UI §1.2 后台一致性、语言、surface、owner-definition | 后台继承 B；TER来源/归属在§1/§7；本次无 owner-definition 输入。显式矩阵尚有 N-02 缺口 |
| UI §2 Interaction map | 已有，包含等待、邀请、系统确认与返回 |
| UI §3 v2页面盘点 | 新本机邀请，无可直接搬运旧后台页面；沿 A 原生/B后台，理由明确 |
| UI §4 线框与控件 roster | 已有两种宽度、正文滚动、真实 TestId 动作节点 |
| UI 输入依赖/动态集合/搜索候选 | 无可编辑字段、动态集合或搜索；不应用后台搜索合同造控件 |
| UI mutation/hidden fact 矩阵 | 部分；见 N-02 |
| UI §5 状态/边界 | 已有 known pending、安装中、UNKNOWN、后台、stale 与 idle |
| UI §6 逐操作合理性 | 部分；见 N-02 |
| UI §7 Face/owner | 当前 prose 已给本机 owner 与禁止项；显式表可随 N-02 补齐 |
| UI §8 B4/B5 | 当前 §8 引用 B；退役 manifest 不恢复 |
| UI §9 高保真 | NONE/NOT_REQUIRED，未提供虚假 demo evidence |
| UI §10 Dexter看图 | UNSET，未写确认 |
| 详设 §0–§2 目的/方案/CP | 已有授权、替代比较、CP-01～06 |
| 详设 §3 横切/第三方 | 已有固定机制行、版本/来源、技术事实与未来 proof 区分 |
| 详设 §3a UI/TestId | 已有完整控制分母及未来准入 |
| 详设 §4 每CP门控 | 已有进入/退出及整组 proof |
| 详设 §5 operation/path/face/规模 | 沿 B 既有 HTTP；不新增 operation/face或规则数量上限 |
| 详设 §6/§7 生命周期、跨层声明传递消费 | 已有；local事实与投影、secret区别明确 |
| 详设 §8 owner业务规则 | 自动选择、boot、N/M、native、投影、配对、报告均有具体判据 |
| 详设 §9 API/§9a原子组/§9b正本 | 已有具名文件、消费方、组内编辑顺序；不需要临时 fallback |
| 详设 §10/§10b迁移seed | 已有保留/清理、来源/角色/fixture/资源；权限 key 见 S-01 |
| 详设 §11/§11a验收 | 已有具名场景和 R/V 条目映射，区分继承与受影响增量 |
| 详设 §12/§13/§13b/§13c | 已有 OPEN、停工边界、逐点双读、完整 CP/6b/13c；不把本轮静态review当实施proof |
| 详设 §14自检 | 已有；“各槽位均已填”仍受 N-01/N-02 限制 |

## 6. 已核实的主流程与当前可实施性

1. **S3 确认与执行名额分离**：详设165明确只在准备/应用前更新 executionBootId，纯确认不更新；S2续接 HOT占S2，S3确认旧 HOT 后释放并可择一条新规则。修正落在原 currentTask，不建独立名额账本。当前 A reconcile 的旧 bootId 形状只是需改接缝，不再作为正确产品判据。
2. **FULL/HOT 分源正确**：详设208–215及附件§4分别处理 FULL单APK和 HOT ZIP publication。FULL摘要来自现有 grant.manifest.apk 的 path/sha/certificate，再校验 APK及其 embedded metadata；HOT沿现有 ZIP manifest/files。真实 Preparer/CBS grant结构支持该有限增量；无需改容器或新解析库。
3. **known pending-user 可以按 N 恢复**：详设181–190明确四类，已知且 exact Intent 可恢复时邀请，仅恢复同 session，零 prepare/commit；UNKNOWN 只回读；确认结束且未安装才允许用户触发新 action。native foreground旧自主呈现被统一为技术事件→owner，避免两套调度。
4. **物理 PRIMARY 与 VICE 逻辑业务面分离**：详设225–227、IA18/40、UI22明确 SLAVE/VICE 用 BRANCH/PRIMARY 本机上下文。当前 LayerStack既有投影方式不会自行得到这个行为，因此 C需要明确 local-primary placement增量；文档没有把现有代码误称已支持。
5. **同 App/protocol 准入保留**：真实 HELLO与pairByHost均核验 moduleName equality；当前样本 application/module身份不同。详设221明确拒绝跨 App，不提供 fallback或新业务模式。没有要求为C新 command改变 protocol版本。
6. **只投影规则**：当前state-sync逐slice创建payload、按connection/revision接收并 apply；成功 apply才发ready事件。C专门record entry与readiness、isolated task/点击/actual/report符合现有机制。未固定候选失效与固定任务续接有明确区分。
7. **grant/report 所有权明确**：TDC真实command为MASTER/active/credential owner；副机grant通过MAIN update handler复核后调用TDC，报告不peer转发。CBS工件关联查询不依赖规则仍ENABLED，支持固定后停用不抢占；权限/空间变化仍拒绝。
8. **有限容量**：compact grant不传files，command不借statefull分片；当前64KiB帧及state reassembly预算沿用，超限显式失败，不截断。当前设计未承诺无限集合可传，也没有为极端规模建设新框架。
9. **runtime/UI原语真实**：subscribeState/registerResource、现有RN/RNWcapture属性、PrimitiveContainer/ScrollView/Button及containerCard token均有当前来源。前后台技术桥、外部portal盘点与两端真实点击属于未来实现义务。
10. **后台/TER运行所有权分开**：B browser/helper负责后台真实动作与其资源；TER runner负责TER/session/device/reverse/APK等自身资源。现有runner case闭集和peer-device限制仍需C显式扩展，设计没有假称当前C case可运行，也没有新造联合orchestrator。

## 7. R1与作者 intake 的事后对照

| R1输入 | 当前独立核验 |
| --- | --- |
| S-01 确认占新boot | 当前165及对应Journey/计划/V判据消除了该文档反例；尚未实现 |
| S-02 不同App VICE业务 | Dexter直接裁决不同App不得配对，当前删除跨App承诺；不要求创造业务模式 |
| S-03 FULL错误ZIP manifest | 当前明确singleAPK与grant.apk摘要分支；消除了该反例 |
| S-04 pending-user被排除 | 当前四分支及exact恢复零commit消除了该反例 |
| N-01 UI canonical/尺度/归属 | canonical、primitive、有限safe viewport、本机归属已补主要内容；本轮 N-02 是另一个显式覆盖缺口 |
| N-02 原子组顺序 | 当前263已写type→producer→adapter→consumer→exports→整组proof；消除了原文档缺口 |

上述只确认文档处置，不把作者 CLOSED标签升级为实现、native、双机或cleanup PASS。

## 8. 实际阅读清单与边界

### 完整阅读

- 根 AGENTS、CLAUDE、PLATFORM-BLUEPRINT、doc/platform/README、scripts/README。
- project-memory/index、全部六个kernel、deterministic-context-only。
- 清单规定六维只读memory route命中原文：confirmed corpus、deterministic、independent review、terminal architecture；backend acceptance/backend/frontend/terminal/verification/业务语言/Claude handoff operations；命中的六类pitfall；atomic-group、business-channel scope、content-tab refresh、decided/undecided、external collaboration display、TER input practices。适用规范 sourceRefs 重新打开，不把memory摘要当当前证据。
- 正式需求全文；本轮六份C全文和输入清单。
- Journey、IA、UI、implementation-design四模板全文；implementation-task/review/terminal/frontend/third-party标准；适用backend/foundation、独立review、verification、方案合理性、observability、backend acceptance规范。
- 项目 cs-review/cs-memory-recall技能；terminal automation skill作为真实调用与边界输入读取，未执行。
- 形成独立verdict后完整读取C R1与作者intake。

### 相关材料与生产源码范围

- 讨论稿：读取本任务用户裁决相关段落，尤其§19–21/539–661；不声称661行全读。
- A/B各三份工件：以当前更新、授权下载、版本报告、native/session、供给链账号、fixture及CP接缝为阅读范围；不声称历史状态、无关operation全文覆盖。A appendix完整，A design涉及132–247、382–423；A plan涉及当前授权与CP、近期接缝。B design涉及更新/报告主链及509–542账号供给链；B appendix涉及真实接缝、canonical、权限与§20最新输入。
- update包 types/slice/module/selectors/commands完整；actor读取rule snapshot/materialization、execute/prepare/apply、reconcile、accept/commit主链（含330–434、435–1030、1120–1221等相关段）。
- runtime module/context/install/resource相关段；ui-state持久与sync序列化、ephemeral排除及registration；SurfaceRoot/LayerStack与实际container/button/scroll primitives。
- topology HELLO、pairByHost、selector、peer command、wire/transport；state-sync controller125–408覆盖发送、连接/方向/revision拒绝、apply和ready；当前transport配置。
- TDCgrant/report真实handler相关970–1100；两个integration assembly readiness/模块装配相关段。
- Android UpdateRuntime的foreground/pending/commit/readAction/boot相关段；Module桥；Preparer普通下载、FULL/HOT提取与验证相关1–245、267–360；UpdatePort/default和TS桥。
- CBS RuleOwnerApi、snapshot owner/read controller、grant owner204–267、grant/规则persistence相关查询；当前canonical required createdAt及生成接口相关形状；运营权限页面15–29及其实际来源；r5-fullfixture权限/组织/终端契约相关段。
- automation runner case/phase/parseArgs相关1–150、400–510；managedRun生命周期形状；current update journey入口、sample identity、driver公开API、requests/uiAction真实动作观察；未将A本地fixture供包当B/C生产供给。
- 实际node_modules版本及RN/RNW/AppState相关声明源码；本reviewer没有重新解析依赖、编译或亲验官方API运行行为。

检索输出过长时进行了相关段补读；源码大文件仅覆盖上述真实调用链，不声称无关行全读。未读取`.runtime`文件；源码里的`.runtime`路径文字不属于runtime evidence读取。

## 9. OPEN、NOT_RUN与硬停止

- **OPEN-UI**：新增本机邀请仍UNSET，需Dexter看图；A/B已确认UI不能替代。
- **OPEN-A/B**：相关最终出口、snapshot required createdAt、report task身份/真实producer等需在B收口后按当前bytes重开。它们已被C列为前置，不在本轮转成C新增finding或acceptedproof。
- **OPEN-C**：所有新增字段、timer、native presentation、summary prepare、local placement、pair projection与driver能力均未实施证明。
- **NOT_RUN**：测试、生成、类型检查、编译、verify、Web、Android、DEV、设备、reset/seed、双机、资源及cleanup。
- 本轮没有动态run，所以cleanup为NOT_RUN，不能写PASS；无需清理本reviewer未创建的资源。
- 当前阻断是S-01。若主agent最小修正并诚实绑定作者处置，且没有新增阻断，仅余新UI未确认时应按standard使用 **GO_WITH_UNVERIFIED_UI**；不能将本报告冻结字节的NO-GO回写成已审新字节GO。
- 同cycle第二轮至此硬停止。作者自行辩证处置，不召第三轮；未决产品/权限变更直接交Dexter。

```text
CURRENT_TASK_READ_COMPLETE=true
INDEPENDENT_FINDINGS_COMPLETE=true
AUTHOR_INTAKE_READ=true
CURRENT_TASK_COMPLETE=true
NEXT=主agent逐项辩证intake及最小文档处置；Dexter确认新UI。
NO_THIRD_ROUND=true
```
