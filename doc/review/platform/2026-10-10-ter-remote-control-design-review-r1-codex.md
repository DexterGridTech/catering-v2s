# TER remote-control DESIGN 独立盲审 R1

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_DESIGN_2026-10-10
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-remote-control-design-review-r1-input-codex.md
BLIND_REVIEW=true
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0M/2S/4N
L1_ENGINEERING=S-01；N-01、N-02、N-04
L2_USER_VISIBLE=S-02；N-03
L3_UNVERIFIED=看图、第三方解析/桥接、真实Window捕获/输入、媒体网络、运行资源与cleanup、Web/Android/L2均未验证；见下文
SAME_ROOT_SCAN=六工件内全部运营operation、三个交互面及其拟执行动作、六消息type、两个报告读取锚点、连接DTO、权限seed/父链，详见各finding
DESIGN_GAPS=未发现需要另立产品或通用框架的新判据；已发现项均能回指现行需求、模板、规范或真实source
TEMPLATE_COVERAGE=四模板逐节结果见下文；详设§3a及交互逐动作/控件roster缺项
EVIDENCE_TIER=STATIC_SOURCE_ONLY
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_EXECUTION=NOT_RUN
FILE_WRITES=NONE
```

仓根：`/Users/dexter/Documents/workspace/idea/catering-v2s`。以下证据位置均为仓根相对路径，行号绑定本轮实际读取字节。

本轮先尝试证伪设计并独立形成 findings/verdict，未阅读本设计作者自审、disposition、intake 或旧远控 review。来源导航、既有治理决定与源码只用于重新建立判据，不继承历史 verdict。主 agent 关于 `readCurrent/detail` 的提示未作为判据；N-02 依据本轮直接读取的 owning source。

本轮只读文档和源码，执行确定性 memory 查询与只读哈希核对；未读 `.runtime`，未改文件，未安装依赖，未生成、编译、测试、verify、启动环境或操作设备。

## 1. 实际输入核验

| 最小输入 | 实际结果 |
| --- | --- |
| 入口 | 完整读取 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md` |
| Kernel | 完整读取 `project-memory/index.md` 所列六份 kernel；读取确定性上下文决定 |
| 六维路由 | 按指定参数实际查询，返回 **25 refs＝6 kernel＋19 routed**；全部命中原文已读 |
| Corpus | 完整读取并检索运营/运维、项目、门店、终端、主副及读取/写 capability；重点命中 G-05A，记录禁推 |
| 原需求 | 完整读取正式需求全文及 discussion 原话、最新调整；使用 90% 核心主流程边界 |
| 四模板 | 完整读取 Journey、IA、UI interaction、implementation design 四模板 |
| 规范 | 完整读取 implementation-task-template、review-standard、backend/frontend/terminal/third-party/foundation 正本；TER 正本全部 1277 行已读 |
| 决定导航 | 查看 decisions 标题，回读本任务适用的设计治理、独立审查、方案合理性、foundation 对接、前端搬运、验证、日志、acceptance、seed、远端拓扑、terminal service-shape、批次三 amendment、Roadmap 退役决定 |
| 六工件 | 全文读取，最终 SHA 与输入清单六项全部一致 |
| 真实 source | 按下列问题重开 scope/auth、报告集合 SQL、TDC credential HTTP/commands、request ledger、当前 peer gateway、ports、Window registry、automation runner/driver、菜单 foundation、testIds 和 seed 角色/父链 |
| 逐点实施留痕 | `NOT_APPLICABLE_WITH_REASON`：本轮没有实现或 focused 运行，不要求不存在的实施日志 |

指定查询：

```text
scripts/memory/query
  --task-kind design
  --domain platform
  --consumer-face operations-admin
  --owner platform
  --impact architecture
  --trigger task-start
```

实际命中并完整读取的 25 个 refs：

```text
project-memory/decisions/confirmed-business-language-corpus.md
project-memory/decisions/deterministic-context-only.md
project-memory/decisions/http-crud-efficiency-design-redlines.md
project-memory/decisions/independent-subagent-adversarial-review.md
project-memory/decisions/owner-read-model-and-lifecycle-standard.md

project-memory/kernel/01-workspace-and-authorization.md
project-memory/kernel/02-service-shape-and-owner.md
project-memory/kernel/03-transaction-data-and-dependencies.md
project-memory/kernel/04-contract-consumer-and-admin.md
project-memory/kernel/05-evidence-runtime-and-git.md
project-memory/kernel/06-heritage-and-change.md

project-memory/operations/business-corpus-adoption-and-read-policy.md
project-memory/operations/business-corpus-parked-domain-intake.md
project-memory/pitfalls/designing-from-conversation-not-system.md
project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md
project-memory/pitfalls/platform-detail-reverse-inference.md
project-memory/practices/backend-capability-lookup.md
project-memory/practices/collection-boundary-modes.md
project-memory/practices/module-call-boundary-ownership.md
project-memory/practices/ordering-only-for-consumer-facing.md
project-memory/operations/terminal-coding-standard.md
project-memory/decisions/terminal-architecture-and-stack-rulings.md
project-memory/decisions/terminal-build-order-and-batches.md
project-memory/practices/ter-input-and-virtual-keyboard-usage.md
project-memory/practices/third-party-library-official-source-verification.md
```

适用 source refs 已按主题回读当前正本和原始决定，包括 TER build-order 的相关技术栈、pair、治理章节及 skeleton 验收判据。商品生产标签、邀请、历史性能 workload 等不同业务专题的 source refs 不构成本批业务分母；未把历史计数、已退役控制面或别的批次授权恢复为本轮准入。

Corpus 禁推检查结果：

- `operations-admin` 与 `platform-admin` 不互换。
- 项目→启用门店→启用终端由服务端事实复核，不由客户端 ref 推权限。
- instance 的 MASTER/SLAVE 与视频 main/secondary 不混同；副机不因此取得独立 CBS 终端身份。
- 页面准入、主对象读取范围、写 capability 不相互推导。最后一项存在 S-01 冲突。

关键 source 实际回读范围：

- CBS：`WorkspaceCapabilityScopeResolver`、`OperationsTerminalUpdateReadController.projectReadSession`、`TerminalUpdateReportPersistence.page/detail`、`TerminalControlOwnerService.invokeOnline`、`TerminalControlPersistence.readActiveBinding/readOnlineSession`。
- TER：TDC actor 的 credential/generated HTTP 与既有具名 POST、TDC module 注册、request ledger、当前 topology peer command controller/selectors、platform-ports types/factory/default 形态、原 dual-screen Window/Presentation owner。
- 前端：`ProjectTerminalUpdatePage` 报告列及终端 Drawer、`terminalUpdateTestIds`、foundation export 与 `AdminDetailActionMenu` 的真实实现。
- 受管执行：唯一 automation entry、runner phase/parser、driver、managed activation、资源 profile、seed fixture 角色、`r5-seed-plan` 与完整 seed 父流程。
- 官方资料只核验候选路线的一般依据，未提升为本仓解析或可行性 PASS：Expo/native build、data packets、VM 部署、PixelCopy。

## 2. 被审字节

| 工件 | SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md` | `357417a5f26a2eb340cdc05c94e578e36cbf2e279d54e7a8508004bb7b518c47` |
| `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md` | `a8968e9981a5584db018c012df3df6ccc5c1b44f4bd282cf50873215cd3cba8d` |
| `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md` | `48affebcf93c7cefd3bab49b82d4dbd54591744c48639dc8f2268fed99e78222` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md` | `a328b187969473cdaf85007f02bcb204a9e0ca87c4b7ab9667f291fee4f6dd97` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md` | `a526e3a0f5f0cb684e8507e4af3d811b6fd8012074692f448fe44fa3facac420` |
| `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md` | `3a7fff20d1159fa89eacf4e4e39ebefc3875e9fdfaf751206a1fdcc01f5c701e` |

六项均与 R1 input 一致。该 verdict 仅覆盖以上字节；修订后不得把本轮 verdict 标作修订字节的独立结论。

## 3. 方案合理性

当前产品路径合理：复用现有项目终端 Tab、终端详情 Drawer 与“操作”菜单，减少重复目录和重复筛选；工作区只增加当前会话的画面与输入，原业务仍走正常控件及 owner command。固定四拓扑、最多两屏、独占会话、有限 lease、单指输入和手动重新发起符合当前核心任务。

CBS 复用既有 terminal-control owner 和 `invokeOnline`，PG 集合 join 提供连接事实；TDS 保持运输职责。TDC 新增具名 authenticated POST，避免把只支持 `terminalRead*` 的 read command 当成通用写入口。TER remote owner、value-only port、原 Window owner 的窄接缝也比复制 registry 或引入第二业务状态 owner 更清楚。

独立比较后，没有发现更小且同样满足“看到真实应用画面、通过正常输入帮助操作”的已存能力：直接业务 command 无法满足正常输入；automation-agent 不能成为生产入口；系统抓屏/系统输入改变批准边界。所选 LiveKit 路线可以保留为候选，但 **公开自有帧桥的可维护性仍未证明**。

官方 Expo 文档支持 native build、所需 plugins 和 `registerGlobals` 的方向；data packets 文档明确 reliable 仍是有限重传、不缓存断开期间数据，支持设计保留 watchdog 和手动重发起的选择。[LiveKit Expo](https://docs.livekit.io/transport/sdk-platforms/expo/)、[Data packets](https://docs.livekit.io/transport/data/packets/)。这些依据不能证明候选版本与本仓 Expo/RN/native 图兼容，也不能证明 PixelCopy→SDK track 桥已经存在。

未要求新增加密平台、持久触摸记录、恢复队列、通用 outbox、第二 runner 或全组合故障矩阵。

## 4. Findings

### S-01：会话 GET 被纳入写 capability/grant，违反当前读写授权边界

**位置**

- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:40`：写授权行包含 `start/read/controllerGrant/end`。
- 同文件 `:108`：声明“4运营op全部同源”授权。
- `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md:28`：无新 capability 者四运营接口均拒绝。
- 同文件 `:47`：四运营 operation 与 grant 每次复核。
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:75`：GET 要求“当前PROJECT能力”。

**事实与判据**

`PLATFORM-BLUEPRINT.md:25` 明确禁止 capability 作为任何 GET 读取权限；普通 scoped GET 使用页面、会话、owner scope。Corpus `project-memory/decisions/confirmed-business-language-corpus.md:91` 的 G-05A 同样规定 capability 只控制写操作。

正式需求 `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md:113` 定义的是 PROJECT **写** capability，`:115` 点名发起、授权领取、续约复核，没有授权 GET 例外。

当前 source：

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalupdate/OperationsTerminalUpdateReadController.java:176`：`projectReadSession` 核对 session context、页面准入及组织 role scope，没有写 capability。
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolver.java:80`：`resolveGeneratedOperation` 实际依赖 generated capability requirement。
- `tools/capability-invariants/cli.mjs:1031`：GET/non-write capability 的 OpenAPI、registry 和 read resolver 均受明确拒绝规则约束。

**正常主流程反例**

管理员已发起会话，随后远控写权限被撤销，但运营 session、原页面读取和当前项目 role scope 仍有效。设计要求其 GET 返回 403，无法按正常读取取得本会话 ENDED/失效原因；若四 operation 都进入写 capability 生成链，还会与现有读边界机器判据冲突。

这不要求撤权后继续远控。grant 和续约仍应拒绝，并终止会话；问题是把只读状态也受写能力控制。

**影响**

实施必须在设计与 Blueprint/corpus/生成约束之间自行选择，无法作为最小自由发挥的输入。也会把授权变化后的状态读取误做写权限拒绝。

**最小修正**

从“四运营接口统一写 grant”中移除 GET。GET 使用原会话、context、页面/角色项目 scope，加本 session 发起账号与 terminal/project 归属校验；不返回 token。start、controller-grant、end 和 MASTER 续约继续按各自写授权规则核验。同步 IA、详设和附件措辞及负向场景。

更小替代是直接删除 GET 的 capability 要求并具名复用既有 read scope；不需要新增 read capability、额外秘密身份或授权框架。

**同根全集**

六工件中的四运营 operation、两个终端 operation、原 page/detail、标准 audit read；明确区分 GET 的 read scope、运营 POST 的写 grant、终端 POST 的 credential。原 page/detail 设计已声明保留读取权限，冲突集中在新 session GET 和“四项一律”的总括句。

**DexterDecision**

`NOT_REQUIRED`：按现行明确读写边界修正文档即可。只有刻意改变 GET 授权模型才需要 Dexter 新裁决；本报告不建议该扩张。

---

### S-02：业务动作清单替代了逐动作节点表，菜单触发器和 L2 控制面静态分母仍缺项

**位置**

- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:61`～`:71`。
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:104`～`:110`。
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:52`、`:58`、`:70`～`:77`。

**事实与判据**

详设 §3a 只有 case/fixture/actions/最后断言四列；附件只有 start、screen、end/close/restart 三组。没有逐动作 UI source、常量 symbol、真实动作节点、wrapper/native 区分、binding/touch 和明确 OPEN 结论。UI 的 Surface roster 只有 surface 归属，不能替代控件 roster。

附件新常量列表包含 `start(terminalRef)`，但没有 Drawer“操作”触发器。当前 source 证明它不是可自动继承的现成节点：

- `libraries/frontend/admin-ui-foundation/src/overlay/detailActionMenu.tsx:7` 强制 `triggerTestId`；`:27` 将其挂在真实 Button。菜单 label 另有独立 `testIdValue`。
- `apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts:17` 只有规则 Drawer 的 `ruleDetailActions`；全文没有终端报告 Drawer 菜单触发器。
- `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:974` 当前终端报告 Drawer 尚无该菜单。

详设控制面清单还用“两App现有 activation/shared operations helper”“及实际 browser L2 入口”“资源profile、seed父链”等类别替代精确文件，`:71` 把全集留给 CP-01 建立。

`doc/decisions/templates/implementation-design-template.md:121` 要求逐动作九列表，`:130`～`:132` 明确规定控制面全集及缺表/缺清单的 DESIGN NO-GO。UI 模板 `doc/decisions/templates/ui-interaction-design-template.md:216`～`:250` 要求逐动作表和最小控件 roster。前端正本 `doc/platform/frontend-coding-standard.md:588` 又明确要求触发器和每个菜单项各有稳定 testId。

**正常主流程反例**

用户必须先点击“操作”再点击“远程控制”。当前设计只给后者 `start(terminalRef)`，第一个实际动作缺常量和挂载节点。实施者必须自行发明 trigger 名称/绑定；脚本作者也无法只凭设计确定如何触达菜单。

同样，“查询、翻页、打开详情”合在一格，没有说明真实 query/input、submit、分页与行入口分别消费哪个已有常量。只有状态观察的 onlineStatus/workArea/status 又与操作节点混列。

**影响**

静态设计尚未确定有限 UI/自动化输入，未来 L2 可能依靠宽 locator 或临时补控件实现。缺项发生在文档层，不是因为本轮尚无动态 PASS。

**最小修正**

在现有 §3a 和附件中补一张有限的逐 case/action 表：

- 复用控件写实际已有 source/常量/节点。
- 新控件写计划 source/常量/真实 Button、Menu label 或 video pointer 节点。
- “操作”触发器与远控菜单项分两行。
- 查询、分页、详情入口和场景真实操作的 context 控件分别具名。
- 固定主/副 video pointer 和结束、关闭、重发起；状态观察单独标明。
- 所有未来 focused/binding/独立复核结果保留 `OPEN/NOT_RUN`。
- 使用模板状态：`UI_DESIGN_REVIEW=OPEN`、`TESTID_REVIEW=OPEN`、`L2_SCRIPT_ADMISSION=BLOCKED`。
- 把拟新增/修改的 L2 scene、binding、fixture、配置、预算、generator/spec 和 managed 接线文件写成精确有限清单。

不要求本轮运行 UI，不要求先实施组件，也不建新台账或新门；只补能够静态确定的 planned 输入。

**同根全集**

REMOTE-LIST、REMOTE-DETAIL、REMOTE-WORKSPACE 三面；remote.online/permission/start/input/end 五组 case 中的实际 click/fill/select/press/pointer/分页动作；新触发器、菜单项、媒体、结束/关闭/重发起；相应 browser 与 TER automation 控制面。普通 TER 业务控件仍复用其包内 testId，不新增远控专用业务按钮。

**DexterDecision**

技术清单补齐 `NOT_REQUIRED`。具体线框仍 `UNSET`，按既定流程提交 Dexter；这与补齐静态节点表是两个事项。

---

### N-01：六消息表把 KEEPALIVE_ACK 写成 ACK

**位置**

`doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:94`。

**事实/反例**

该表第一列名为 `type`，写 `ACK`；正式需求 `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md:270` 与 `:315` 明确为 `KEEPALIVE_ACK`。若生成输入按附件表逐字填写，一端发送 `ACK`、另一端按需求校验，会被当作未知 type，正常 keepalive 不能闭合。

附件又声明完整字段以需求为唯一来源，因此目前更像可直接纠正的精确名称错误，建议 N；尚无生成/实现，不能声称已发生运行失败。

**最小修正**

type 行改为 `KEEPALIVE_ACK`；ACK 可保留为自然语言简称，不能成为第七类型或兼容别名。六工件全扫闭集 type，生成计划保持同源。

**影响/同根**

协议六 type 唯一输入及两端消费；未发现必须增加消息的需求。

**DexterDecision**

`NOT_REQUIRED`，按既有正式需求修正。

---

### N-02：报告详情 source 导航指向不存在的 readCurrent

**位置**

`doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:13`。

**事实/反例**

附件写 `TerminalUpdateReportPersistence#page/#readCurrent`。真实文件：

`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateReportPersistence.java:150`

实际方法是 `detail(...)`；`:98` 为 `page(...)`。详设 `:95` 已正确使用 `page/detail`。按附件导航会找不到详情锚点，或把另一处方法误当本次变更点。

**最小修正**

将附件锚点改为 `#page/#detail`，无需改 source 或增加兼容方法。复核六工件中原报告查询方法引用；page 与 detail 均保留启用门店/终端约束及既有查询语义。

**影响/同根**

两个现有报告读取锚点，属于实施导航偏差。

**DexterDecision**

`NOT_REQUIRED`。

---

### N-03：connectionStatus 与 connection.state 的 DTO 名称不一致

**位置**

- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:95`：`connection={state,observedAt,evaluatedAt}`。
- 同文件 `:79`：原 page/detail 增加 connection 对象。
- `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md:99`：返回 `connectionStatus`、`observedAt`、`evaluatedAt`。

**事实/反例**

四态语义与权威来源一致，但具体返回字段/层级存在两个表达。两个实施者可能分别生成顶层 `connectionStatus` 与嵌套 `connection.state`，使 typed wire、edge mapping、列表/详情 consumer 和 fixture 不一致。当前没有已生成 DTO，不判现状 broken。

**最小修正**

在六工件的 operation/DTO 矩阵给出一份明确 shape，沿正式需求保留 `connectionStatus` 命名并具名说明层级；同步列表/detail 两个映射和验收断言。不得让生成器或前端 consumer 自行选一种，也不新增另一个在线接口。

**影响/同根**

原 page/detail 两读取、schema/generated DTO、edge mapping、状态列/Drawer 及四态 fixture。

**DexterDecision**

沿既有需求澄清技术 shape `NOT_REQUIRED`；若有意改变正式需求字段语义，归 Dexter。当前建议不改变语义。

---

### N-04：seed 要求有权/只读角色，但尚未点名角色与授权差量

**位置**

`doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:185`～`:194`；附件 `:113`。

**事实/反例**

设计要求显式角色计划、只读与远控角色，指出 GROUP_SEED_CAPABILITIES 和角色断言同步，却没有写哪个 seed role 获得新 capability、哪个保持只读、各自 actor/assignment fixture key。

现有 fixture 并非只有一个可能角色：

- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json:1433` 的 `role-group` 已有终端版本页面及版本管理能力。
- 同文件 `:1477` 的 `role-project` 也有终端版本页面，其 capability 集不同。
- `scripts/dev/r5-seed-plan.mjs:35` 的真实断言按具体 role/page/capability 校验。

若凭“项目管理员”或已有版本权自行给两角色都加远控权，可能违反“不自动由版本管理权推远控权”；若只给一个，另一实施者又可能选择另一个，无法从当前文档得到唯一差量。

**最小修正**

补一张小表：role fixture key、page 保留项、新 capability 加/不加、actor/assignment fixture key、seed 写入会话来源和对应断言。只使用符号 key，不写账号秘密。保持原完整 seed 父链，不 seed 假 ONLINE/Room/session。

**影响/同根**

角色 fixture、owner-command capability 集、`r5-seed-plan` 角色断言、正常 DEV 使用账号和只读/错 scope acceptance fixture。

**DexterDecision**

纯测试/DEV fixture 的具名技术计划可按当前批准任务补齐；若拟改变真实角色授权政策或新增产品授权关系，标 `DEXTER_DECISION`。本轮不执行 seed。

## 5. 四模板逐节覆盖

“有”只说明槽位已有内容，不代表 UI/技术 proof 已通过；“缺”指本轮静态可以填写的内容缺失。未来实现证据保持 OPEN 不算模板缺项。

### Journey 模板

| 模板节 | 结果 |
| --- | --- |
| §1 裁决元数据 | 有：Journey、PROPOSED、Dexter owner、UI、corpus、授权及草案边界 |
| §2 用户任务/成功/失败事实 | 有 |
| §3 逐 actor 前提链 | 有：身份、权限、资料、在线、共享 credential、两屏、媒体服务；技术/部署未满足不冒充已完成 |
| §4 边界/非目标/禁推 | 有 |
| §5 Corpus 命中/冲突 | 有，但遗漏 G-05A 导致 S-01 |
| §6 UI 适用性/后续工件 | 有 |
| §6.1 管理后台一致性 | 有 |
| §7 Dexter 裁决 | 有：功能来源与本包看图/实施边界分开，UNSET 合法 |

### IA 模板

| 模板节 | 结果 |
| --- | --- |
| §1 元数据 | 有 |
| §2.1 可见维度 | 有：任务、actor、入口、控件、验证错误、可达性、空/加载/错误、容器负载、一致性 |
| §2.2 不可见维度及可执行观察 | 有：权限、导航刷新、集合规模、数据源/级联、禁 UI；权限内容存在 S-01 |
| §2.1.1 容器与交互分工 | 有 |
| §3 共用规则 | 有 |
| §4 全量错误映射 | 有，回指 UI §5 |
| §5 交叉对账 | 有，权限行须按 S-01 更正 |
| §6 完成判定 | 有；仅静态草案，不冒充 UI/实施 PASS |

### UI interaction 模板

| 模板节/强制子槽 | 结果 |
| --- | --- |
| §1 元数据 | 有 |
| §1.1 UI 强制声明 | 有：三面 face/surface/entry/actor/scenario/goal/copy/boundary/foundation/layout |
| 管理后台一致性 | 有；全屏 Modal 形态来源具名，具体看图 UNSET |
| Surface ownership | 有 surface 归属表；不等于控件 roster |
| 业务语言/动态明细命名 | 有：终端/门店/主副屏及原因中文；无技术身份作为标题 |
| Owner-definition 字段槽 | `NOT_APPLICABLE`：无新增 owner 自定义业务表单 |
| §2 Interaction map | 有 |
| §3 Heritage 页面盘点 | 有：新远控工作区无已指出的搬运基线，原列表/Drawer 复用；实施前仍核对冻结资产 |
| §4 三面线框 | 有 |
| L2/自动化逐动作 testId 表 | **缺**，S-02 |
| Implementation-facing 控件 roster | **缺**，S-02；附件简称表不能代替真实动作节点 |
| 表单依赖/字段事实矩阵 | 新业务表单 `NOT_APPLICABLE`；原列表查询保持现状，但拟执行查询动作须进入 S-02 清单 |
| 主从动态集合 whole-save | `NOT_APPLICABLE`：固定媒体 slots，无业务明细编辑 |
| 新搜索/候选协议 | `NOT_APPLICABLE`：无新增候选服务或选择业务表单 |
| §5 状态与边界 | 有：原空/加载/错误回指 IA，远控原因全量映射 |
| §6 逐操作合理性 | 有：进入、输入、结束、重新发起均服务当前用户任务 |
| §7 Face/owner | 有 |
| §8 旧 manifest 命中 | `NOT_APPLICABLE`：按退役治理不恢复 B/C/D 台账；已有 source/foundation 复用说明 |
| §9 静态高保真 demo | `NOT_APPLICABLE`：本次提交 ASCII 低保真 |
| §10 看图结论 | 有：UNSET，未写虚假接受 |

### Implementation design 模板

| 模板节 | 结果 |
| --- | --- |
| §0 元数据/授权 | 有 |
| §1 真实目标/方案比较 | 有；候选方案需 T proof，不冒充已可行 |
| §2 CP 总览 | 有 |
| §3 横切固定机制 | 有；read/write 两行存在 S-01 |
| 第三方版本/API依据 | 有候选、未解析与官方导航；实际版本/API/桥 proof OPEN |
| §3a UI/testId/L2 前置 | **缺逐动作列、完整节点 roster、精确控制面文件及模板状态**，S-02 |
| §4 CP 门控 | 有：完整 CP focused＋双读＋独立 MATCHED；不逐文件另开关 |
| §5 operation/path/face/集合 | 有六 HTTP 矩阵；GET 权限须修 S-01，DTO 澄清 N-03；canonical errorSet 与预算依据仍是冻结前输入 |
| §6 跨 owner 写/事务 | 有：同 owner session/invokeOnline、审计 REQUIRED；外部 Room RPC 不放 DB 锁内 |
| §7 声明→传递→消费 | 有；“4运营op同源”须修 S-01 |
| §8 规则/owner/状态/adapter | 有；具体 vendor bridge 合法留待 T-01 |
| §9 Owner API/caller | 有 |
| §9a 全链同步 | 有 |
| §9b 精确变更定位 | 有附件清单；N-02 修不存在锚点，S-02 补类别式控制面文件 |
| §10 migration | 有 |
| §10b.1 seed 文件 | 有 |
| §10b.2 新旧差量 | 有 |
| §10b.3 覆盖 | 有 |
| §10b.4 同步 | 有 |
| §10b.5 边界 | 有 |
| §10b.6 父流程/角色/操作人 | 有父流程与会话来源；**缺具名角色授权表**，N-04 |
| §11 真实验收设计 | 有 fixture/request/businessOracle；未把 2xx 当真值 |
| §11a 验收判据对应 | 有 V-01～V-15；两 App/四拓扑与 adapter 档位分开 |
| §12 未决项 | 有，OPEN/UNSET 诚实 |
| §13 停机 | 有 |
| §13b 三维对账 | 有 |
| §13c 逐代码对账 | 有，安排在动态收尾后 |
| §14 交付检查 | 有，但本轮“六事实一致/模板齐”尚不成立 |

串行计划的 CP→完整 CP 对账→全批 6b→动态前准入→整批动态→13c→IMPLEMENTATION review 顺序没有发现循环。CP-01 有限 T proof 与未来全批动态已作区分；CP-05 的 receiver/runner/资源登记不应倒置到启动之后。当前计划声明先登记受管资源再 proof，边界合理。

## 6. 同根扫描与防再犯

| 问题族 | 本轮有限全集 | 结论与最小复用规则 |
| --- | --- | --- |
| 读授权误套写 grant | 四运营接口、两个 terminal POST、原 page/detail、audit read，六工件全部相关句 | session GET 冲突；按 HTTP 读/写/credential 分类，不按 feature 名一括授权 |
| 动作清单替代真实节点 | 三面及五 case 组，触发器/菜单项/查询分页/行入口/video pointer/结束关闭重发起 | 缺项；planned 节点逐行动作映射，未来 proof OPEN，不借 wrapper/宽 locator |
| canonical 名称漂移 | 六 Data type、两端生成计划与 R13～16 | ACK type 一处偏差；只保留 KEEPALIVE_ACK 的 wire 名 |
| source 锚点误写 | page/detail 导航与真实 owning class | readCurrent 不存在；复用实际 symbol，不新增兼容代码 |
| DTO 声明/消费分裂 | page/detail→schema/generated→edge→列表/Drawer→四态 fixture | 明确一份 connection shape，避免 consumer 自选 |
| seed 权限隐含推导 | role fixture→capability 集→计划断言→actor assignment→父 seed | 具名授权差量；页面/版本权不推远控权 |

建议把以上六类放入本批已有 review checklist；文档修复只需补当前缺项，不建立 prompt hook、receipt、hash-chain 或通用控制平台。未来实现阶段使用真实既有 tests 验证绑定/生成/角色断言，本轮不运行。

## 7. 未验证与冻结边界

| 事项 | 本轮证据 | 状态/后续条件 |
| --- | --- | --- |
| 需求与正常用户任务 | 原话、正式需求、六工件对读 | 静态已核；发现项见上文 |
| 新 HTTP/协议/DTO | 设计矩阵与 current source | 尚未生成/实现；S-01、N-01、N-03 待修 |
| Window owner/peer/TDC 接缝 | 现有 source | 已证明现成边界；未证明新增能力 |
| IA/线框接受 | ASCII 与 UNSET 声明 | `DEXTER_WIREFRAME_REVIEW=UNSET` |
| 新依赖 exact lock/native/Gradle 图 | 候选坐标与官方资料 | `OPEN`，未安装/解析 |
| PixelCopy→官方 SDK 两 track 公共桥 | 原 Window source、官方入口 | `OPEN`；不能凭私有 factory 或主分支导航认定可用 |
| 持续双屏捕获/普通 UI 覆盖 | T-02 计划 | `NOT_RUN` |
| 正常触摸/滚动/虚拟键盘/本地冲突 | T-03 计划 | `NOT_RUN` |
| TLS/ICE/TURN、SDK 断连、JVM grant/Room 管理 | T-04 计划 | `NOT_RUN` |
| 资源预算/受管启动/cleanup | 既有 runner/profile 与计划 | 新 media resident 尚无运行证据 |
| Web 两 integration 与 Android 四拓扑 | 场景清单 | `NOT_RUN` |
| backend acceptance/浏览器 L2/DEV device | fixture/oracle 计划 | `NOT_RUN`，各档位须未来分别授权 |
| seed dry-run/reset/seed | 静态父链 | `NOT_RUN`，本轮没有执行授权 |
| 逐点双读/CP/full 6b/13c/IMPLEMENTATION review | 未来步骤 | `NOT_APPLICABLE` 于当前设计审查，不能写 PASS |

T-01～T-04 和阶段 C 最终出口是实施冻结前置，不是本轮静态草案必须动态关闭的事项。真实 UI 也没有获得看图确认。本轮 NO-GO 由两项成立的静态 S 决定；不能因为仍有未验证 UI，把已确认设计冲突降为 `GO_WITH_UNVERIFIED_UI`。

本轮批准的只读审查任务已经完成，无待执行的文件修改或动态动作。作者可在独立 verdict 之后，逐条重开上述 source 做 intake；建议先修 S-01/S-02，再一并处理四项小修正。下一轮保持同一 cycle，按 DESIGN Round 2 定向核验并遵守两轮上限。
