# TER 版本定义、完整更新与热更新 · 阶段 B 完整设计包 · 外部独立静态评审

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/3/8
L1_ENGINEERING=findings：S-3（后台 L2 报告前提无合法生产者、case 分母缺失、TestId 三套命名）；N-1..N-5
L2_USER_VISIBLE=findings：S-1（最近状态/原因/规则工件无闭集与业务文案）、S-2（§3-K-2/3/5/7 与“无例外”声明冲突）；N-6
L3_UNVERIFIED=见 §6（全部 UI 渲染、HTTP/PG/Minio、TDP、TER Web/Android、L2、seed/reset、cleanup 均 NOT_RUN）
SAME_ROOT_SCAN=见各 finding「同族全集」
DESIGN_GAPS=见 §5
TEMPLATE_COVERAGE=见 §4（四份模板逐节）
EVIDENCE_TIER=READ_ONLY_STATIC_DESIGN_AND_SOURCE（只读文档与当前源码；零生成/编译/测试/运行）
reviewerKind=EXTERNAL_CLAUDE_VIA_DEXTER
SESSION_PROVENANCE=续接会话（上下文经压缩，前段含其他评审与 Rive 工作）；v2s 仓根内执行，非 fresh v2s-rooted 会话；本轮重读了入口链与全部输入原文
IMPLEMENTATION_AUTHORITY=false
FILE_WRITES=仅本文件
```

## 0 · 范围、输入与授权边界

Dexter 转交：静态评审阶段 B 完整设计包，可读当前源码与官方资料；只可在 `doc/review/platform/` 写一份 `-claude` 文件；不授权修改需求/规范/记忆/A 或生产源码/依赖，不授权生成、构建、测试、verify、DEV、Web、Android、reset/seed、L2/UAT、部署或 C。本结论不授权实施。

冻结输入（本轮读取时的 SHA-256）：

| 文件 | SHA-256 |
| --- | --- |
| `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` | `f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22` |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md` | `4832f2fab31f6688ab6594a714f504a068202afa43b8816e767b8fffe4b64f34` |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md` | `846297d93393fc8213dff4b31ee6b433cfa805feab5120678a70438aa43a446f` |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md` | `a7d603e506404b317acb911c09a75de47df66968ab401ccea4f150ee4cddc4bd` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md` | `e076785342290eb78959d0501300aab01a0f322b7c13133fc0677afffc408220` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md` | `11949c7f2f847d7ed4c8f249dcc732ba7259707e1da4dc3d17883f96cbb84bb4` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md` | `8bd1071b4439d9d92dbbae92a319c6fb75111ee146a5e402e3ca0bc35d0eaee2` |

阅读顺序：入口链（`AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md` 相关节）→ 六个 kernel、`deterministic-context-only`、六维路由命中的主要条目 → 正式需求全文（R-01～R-15、§17、§20）→ 讨论稿数值出处检索 → Journey/IA/UI/详设/计划/附件全文 → 四份模板、`implementation-task-template.md`、`review-standard.md`、前端 §3-K 全节 → owning source 抽查 → **最后**才读 R5、R6 工具状态与 intake。作者 intake 未被当作独立证明。

严重度口径：`review-standard.md` 指向 `project-memory/operations/verification-governance.md`，但该文件当前没有 M/S/N 的定义（见 §5 DESIGN_GAPS-1）。本文按常用口径：M=方向错误或使批次目标不成立；S=实施前必须修、否则会在 L2/验收或用户体验上失败，但修法清楚；N=建议或需裁决的低影响项。

## 1 · 先于作者材料的独立预期

从需求 §20.4、R-04/05/07/15 与 Dexter 2026-10-07 裁定推导，B 应当是：

1. CBS 一个 terminal-update owner：私有 ZIP 经既有 asset 生命周期暂存→解析（实际 APK/清单/签名/发布身份）→登记不可变工件；HOT 固定最小 FULL；跨空间同内容可登记，同版本异内容拒绝。
2. 运营项目规则：只新建/启停；PROJECT 读与具名写 cap 分离；ALL 动态含新门店，指定 refs 不扩张；N/M 有单位和技术上界。
3. 项目规则 topic + 终端完整快照 HTTP + 下载授权；主机 update owner 存快照、不触发 prepare/apply。
4. 主机实际版本与最近状态经 TDC→TDS→PG 最后一行；运营项目页右 Tab 以项目全部终端为分母（含 NO_REPORT），运维不提供报告。
5. 验收：backend-acceptance 证授权/事务/并发；两后台各自 L2；TER 先 Web 后 Android 同清单。

与作者方案对照：主干一致（详设 §1 第三方案、§5 十六项 operation、§8.1–8.5、§14.1）。差异集中在三处——报告“最近状态”的可见语义没有落地、后台交互文案与 §3-K 不符、后台 L2 的报告前提无法执行——见 §3。

## 2 · 方案合理性（先于闭环核验）

**问题对不对。** 对。B 把“A 产物能被管理员供给、主机能拿到完整规则、运营能看到主机实际版本与最近状态”闭合，自动执行留给 C，与需求 §20.4 和 Dexter 两条后台职责裁定一致。运维只管包/版本、运营项目页左规则右终端状态，在 Journey §1、IA §1.1/§6、UI §2、详设 §0/§14.1、计划 §0 五处一致，未发现恢复运维报告入口的残留 GET/页面（仅一处措辞残留，见 N-7）。

**方案优不优。** 我自己构造并比较了三个作者未列出的替代：

| 替代 | 结论 |
| --- | --- |
| 快照 HTTP 由服务端按凭证推导项目（不传 projectRef），从而免去 store-basic 新增 readiness 事实 | 不采用。TDP topic 身份以 `topicKey+ownerRef` 为准（`doc/platform/terminal-coding-standard.md` 1052 行起），且 R-07 要求监听项目/门店变化；项目事实在 TER 的 owner 是 store-basic。复用其公开 command/selector 是正确 owner 复用，作者的 readiness 补丁（详设 §8.3，附件 §8）有当前源码依据：`apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts:388–397,423–427` 先发 STORE 成功事件、PROJECT 先置 loaded 后 flush。 |
| 报告走终端 HTTP POST 而非 TDP 帧 | 不采用。需求 §20.4(4) 明确“同一报告入口→TDS→CBS”，TDS 已有 function-only 写先例（`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/remote/TdsTerminalControlRepository.java:14–40`）。 |
| 只用 TDP 的成员 `collectionHash` 做快照一致性，不另设 `snapshotHash` | **值得采用**。启用规则内容与 refs 不可变，启用成员集合相同即快照正文相同；两种 hash 是冗余（N-2）。 |

**代价配不配。** 整体匹配：单 owner、复用 asset/TDP/foundation、不建 MQ/流水/调度。两处代价偏高需要 Dexter 看一眼：报告 ACK 耗尽后的自触发 stop/connect（N-1）与双 hash（N-2）。其余复杂度（16 项逐请求合同、完整 DB 计数、grant 32 上限加锁）都对应真实的授权、幂等与并发风险，不是装饰。

**UI 自问（逐项）。** 九个交互面都来自 Journey §4 或 Dexter 2026-10-07 裁定；用户此刻的操作顺序合逻辑；包登记保留“先看解析再登记”的两步（UI §6）比上传即发布更安全，我认同；规则不可编辑、只启停来自 R-05，不存在更短的合法路径。不合理之处的归因：S-1 归因“详设未把 A 的开放 reason 收成可显示闭集”；S-2 归因“交互稿声明套用 §3-K 但文案未逐条落实”；N-6 归因“产品语义未裁决（技术词是否作为运维可见文案）”。没有从接口或旧页面反推出的新操作。

## 3 · Findings

### S-1 · 报告“最近状态/原因/规则与工件”没有闭集与业务文案，R-15/V-29 的可见语义不能落地

- **仓内事实（CONFIRMED）**：A 当前任务模型 `apps/terminal/kernel/base/terminal-update/src/types/terminalUpdate.ts:24,31–36`：`phase` 九值、`recentStatus.state` 八值、`reason: string | null`；actor 会动态拼出 `PREPARE_${status}`、`APPLY_${status}`、`ACTION_${status}`、`CONFIRM_${status}` 等原因（`.../terminal-update/src/features/actors/terminalUpdateActor.ts:161,185,216,303`），即 reason 是开放字符串。B 只写了“recent含ruleRef/artifactRef/phase/state/reason/changedAt”“有限schema”（详设 226 行），未给出 phase/state/reason/`unknownReason`/`entryKind` 的闭集，也没有任何一处给出它们的中文文案与颜色语义；“等待安装”只出现在 UI 线框示例里（UI 130 行左右）。
- **需求事实**：R-15 要求后台“可区分等待用户/闲时、准入拒绝、部分成功和失败/已回退”（需求 234 行）；V-29 在 B 闭合。
- **同族全集（5 项，均缺）**：PROJECT-REPORT 列“最近状态”；PROJECT-REPORT-DETAIL 的“规则/工件/阶段/原因”“未知（原因）”“发布内容（entryKind）”；报告 canonical schema 的 reason/unknownReason 字段约束。此外“规则/工件”在 DTO（详设 §14.1，332 行）只有 `ruleRef/artifactRef`，没有可显示事实；按 UI 模板“业务语言与动态明细命名”，ref 不能当可见文案。
- **影响**：实施期只能由前端临场造文案和映射（review-standard 动作 2“前端自造枚举文案”），开放 reason 进入 canonical 还会破坏“有限 schema”和 typed 映射；运营看到的要么是原始码，要么是不可追溯的翻译。
- **最小可验收修正**：在详设 §8.5 与附件 §11/§13 定义报告用的 `recentState`/`reasonCode`/`unknownReason`/`entryKind` 闭集（把 A 的动态原因归一为有限码，未知码映射为一个具名“未分类原因”）；在 UI §1.1/§4 给出每个值的业务文案、Tag 语义（遵守 §3-K-7“非生命周期状态不得挪用五色”）以及 R-15 四类区分的对应；报告 page/detail DTO 由 terminal-update owner 关联出规则与工件的结构化事实（应用/类型/版本），标题由前端组装（与 R5 已修的 1-K 口径一致）。不需要新 operation。
- **是否需 Dexter 裁决**：否；只有个别文案的业务措辞若无语料可依，标“待 Dexter 裁决”。
- **属于 A 交接还是 B**：闭集与归一属于 B 的报告契约；A 只需保证 reason 可被归一（列入 §0.1 交接表即可）。
- 精确定位补充：“等待安装”仅见 UI 128 行线框示例行。

### S-2 · USER_VISIBLE_COPY 与 `frontend-coding-standard.md` §3-K 多条冲突，而 UI §1.2 声明“无例外”

- **仓内事实（CONFIRMED）**：UI §1.2（22–33 行）声明 K1–K10 逐面适用且“无新的豁免”。逐条对照 §3-K 原文：
  - **§3-K-2 弹层标题**（“已存在对象的标题固定为‘对象名称 · 动作对象类型’……禁止只写‘详情’”）：PKG-DETAIL“更新包详情”（UI 68 行）、RULE-DETAIL“规则详情”（106 行）、PROJECT-REPORT-DETAIL“终端更新状态详情”（137 行）都缺对象名称。
  - **§3-K-3 动作命名**（同一动作在入口/确认/结果用同一动词）：包登记入口“上传更新包”，提交按钮“登记”（UI 13、62 行），一个新建动作用了两个不在动词表里的词；新建任务按 §3-K-2 应为“新建 + 对象类型”。
  - **§3-K-5 空态句式**（“还没有 X”+ 业务影响一句 + 可执行下一步；无写权限时说明由谁完成）：PKG-LIST“尚无更新包/重试”、RULE-LIST“先选择项目/尚无规则”（UI 12、15 行）缺后两部分；无 W-P 时 UI 只写“无cap只去掉新建/操作”（85 行附近），没有给出“由谁或到哪里完成”的说明。
  - **§3-K-7 状态 Tag**：规则状态“启用/停用”应用绿/橙；“最近状态”不是生命周期状态，不得挪用五色——两者都未声明（与 S-1 同根的颜色部分）。
  - **§3-K-6 普通确认**（正文说明对象、动作、直接影响）：RULE-STATUS 标题“启用 / 停用此规则？”（116 行）未带规则对象名称。
- **同族全集**：九个交互面全部核对；上列 PKG-UPLOAD、PKG-DETAIL、RULE-DETAIL、RULE-STATUS、PROJECT-REPORT-DETAIL、PKG-LIST、RULE-LIST 有缺口；其余 2 个（RULE-CREATE“新建规则”标题与“保存/取消”页脚、PROJECT-REPORT 列表）已核对符合。
- **影响**：§3-K-8 规定无业务差异的交互差异即 finding；这些都是 Dexter 体验时首先看到的位置，且与“无例外”声明自相矛盾，实施会照抄线框。
- **最小可验收修正**：只改 UI §1.1 `USER_VISIBLE_COPY` 与对应线框/IA §2.2 文案：三个详情标题改“〈标题〉 · 〈类型〉详情”（标题来源沿用前端组装的“应用·类型·版本”/终端名称）；包登记统一一个动词（建议“新建更新包”+“登记”是否保留由 Dexter 选，或在 UI 记录 Dexter 接受的词汇例外）；三类空态按“还没有 X + 影响 + 下一步”写全，含无写权限说明；声明规则状态 Tag 与最近状态的非生命周期颜色；确认面带对象名。不新增控件。
- **是否需 Dexter 裁决**：仅“上传/登记”是否作为本域受认可动词需 Dexter 一句话裁定；其余作者可直接修。

### S-3 · 后台 L2 不可执行：报告前提没有合法生产者、case 分母缺失、TestId 三套命名

- **仓内事实（CONFIRMED）**：
  1. 详设 382 行与计划 §10(4)（108 行）要求“后台报告显示由其自身合法报告fixture建立”“一份scope隔离TESTfixture涵盖artifact/rule/report”。但报告唯一写入路径是 TDS 帧→`record_terminal_version_report`（详设 §8.5、附件 §11.3），且 owner SQL 先校验当前 ACTIVE binding 与当前 PG session。当前 L2 runtime 只启动远端 CBS，不启动 TDS、不含终端激活/WS 客户端（`scripts/test/browser-l2-runtime.mjs` 中无 TDS/terminal-data-server 引用；既有 `contracts/policy/store-terminal-l2-fixture.json` 的 `setupChannel=OWNER_HTTP_COMMANDS`）。设计没有说明 L2 如何在隔离库中产生一行“合法报告”。
  2. 详设模板 §3a 要求列出 L2 控制面全集**以及 case 分母**；详设 §3a（104–112 行）只有文件名，§11 只有一行 `update.admin.journey`，没有逐 case 列表与每 case 的 fixture 引用（对照 `store-terminal-l2-fixture.json.caseFixtures` 的形态）。
  3. 控件常量在三处不同名：UI 线框 roster（如 `PKG_ROW`、`PKG_UPLOAD_OPEN`、`PKG_FULL_CANDIDATE`、`RULE_CREATE_OPEN`、`RULE_ROW`、`RULE_FILTER_TIME`、`PROJECT_REPORT_STORE`），附件 §9（`PKG_TITLE`、`PKG_UPLOAD`、`PKG_MIN_FULL`、`RULE_CREATE`、`RULE_TITLE`），附件 §12（`PKG_MIN_FULL_QUERY_TEXT`、`RULE_CANDIDATE_FULL/HOT`、`RULE_FILTER_CREATED_RANGE`、`PROJECT_REPORT_STORE_SEARCH`）。UI §4.1/§12 却声称三者“同一常量来源/唯一分母”。
  4. `scripts/README.md` 181–207 行的 L2 唯一顺序是 readiness → **同 run P1 activation → 生成链检查** → finalize → run；详设 15.2（380 行）与计划只写 readiness/finalize/run，漏了 P1 activation 步（生成器 `terminal-update-l2-p1.mjs` 在 §3a 有名无步）。
- **影响**：V-29 的“有报告时的显示”在 L2 无法取得合法前提，实施期只能临时造 SQL 后门或改用 TER 运行态（后者违反 Dexter“后台用自身受管 L2，不复用跨层运行事实”）；case 分母与 TestId 多名正是 2026-09-24 批 L2 36 跑 1 过的同类前因（模板 §3a 实证）。
- **最小可验收修正**：(a) 在详设 §15.2/计划 §10(4) 明确报告生产者，推荐：L2 runtime 为本 run 启动隔离 TDS，并复用既有 `scripts/test/terminal-ws-wire-client.mjs` 走真实激活→ready→`TERMINAL_VERSION_REPORT`；若 Dexter 认为成本过高，备选是 L2 只验 NO_REPORT 与列表/详情渲染，“有报告”的显示改由 component test＋backend-acceptance 的真实报告 HTTP 读回证明，并在 V-29 记录这一执行面调整（**需 Dexter 裁决**）。(b) 在 §3a 增加逐 case 分母（case→fixtureRef→actions）。(c) 指定附件 §9 为唯一常量表，把 UI roster 与 §12 改成引用同名常量。(d) 补上 P1 activation 与生成链检查步骤。
- **同族全集**：L2 前提共四类——身份/角色（邀请链 owner HTTP）、工件（stage/register owner HTTP）、规则（create/status owner HTTP）、报告。前三类有合法 owner 写路径，已核对；只有报告缺。
- **是否需 Dexter 裁决**：(a) 的执行面取舍需要；(b)(c)(d) 作者直接修。

### N-1 · 报告 ACK 耗尽后自触发 stop/connect：收益窄、代价跨通道（DEXTER_DECISION）

详设 §8.5（230 行起）在同连接 3×5 秒未获 ACK 后调用 transport stop/connect 一次，并用非持久 `reportRecoveryUsed` 按内容限次。推论：健康 WS 上丢 ACK 的主要原因是 TDS 侧 PG 失败；15 秒内多半未恢复，重连后大概率再次耗尽；而一次重连会让 store-basic、合同、更新快照等全部订阅者在 ready 时各自 HTTP 核对。更小的替代是“耗尽后保留最新 pending 与 `REPORT_ACK_TIMEOUT`，等下一次自然 ready 或内容变化再发”，代价是稳定连接上后台可能长时间显示旧值。两者都满足 R-15“离线变化下一次 ready 补报”。Dexter 在转交说明中已把“跨 ready 同内容最多一次自恢复”列为期望，故这里只请 Dexter 确认这一取舍，不作为阻断。

### N-2 · `snapshotHash` 与成员 `collectionHash` 冗余；项目锁应点名既有原语

启用规则的内容与 refs 不可变（R-05），快照只含启用规则，因此启用成员集合相同即快照正文相同；详设 §8.3 另设一个含正文的 `snapshotHash`（209 行）属于第二个表达同一事实的值。建议 HTTP 分页一致性直接绑定 `collectionHash`（附件 §11.2 snapshot 行的 header 读取不变）。另：§8.2 的项目锁“固定 namespace＋project UUID 稳定 64 位键”（203 行）与 `AdvisoryLock.acquire(JdbcTemplate,int,UUID)`（`apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/persistence/AdvisoryLock.java:37`）同形，应点名复用，避免实施期另写。

### N-3 · 下载授权未绑定规则门店范围

详设 §8.4（220 行）与附件 §11.2 只要求工件属于终端所在项目“已创建规则目标（含停用）”。门店 A 的终端因此可以为只指向门店 B 的 `STORE_REFS` 规则工件取得 grant。同项目内泄露影响低，但 R-03“获授权的规则/下载通路”更准确的读法是“覆盖本终端门店的规则”。同一条关联查询加 `scope=ALL 或 refs 含 boundStore` 即可，计数不变。R5 曾因证据不足未报，此处只作建议。

### N-4 · N/M 单位与 1～86400 秒上界无出处；DEV seed 用了边界值（部分 DEXTER_DECISION）

需求 R-05 把单位与技术上界交给详设，但详设 §8.2（199 行）、UI、附件 §12 都只给出数值没有理由；讨论稿与 A 详设中均无 86400、1000 字符、5 秒 ACK、32 grant、5 分钟等出处（256 MiB/512 MiB/8192 条来自 A 详设 242 行，有出处）。运营在“秒”里填小时级提醒不自然，N=1 秒在 C 接入后会造成每秒提醒。DEV seed（详设 354 行起）把 N=1、M=1、86400 写进“DEV 体验前提”，这些边界值应只在 acceptance fixture；DEV seed 用接近真实的取值。单位是否改分钟/小时请 Dexter 一句话裁定。

### N-5 · 候选控件交互与既有共享原语描述不一致

新建规则门店候选应直接复用 app 级 `useOrganizationCandidates`（`apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts:14`，已支持 `projectId`，底层 `useCursorCandidates` 页码模式），设计只点名了 foundation hook。另：`useCursorCandidates` 自带 250 ms 防抖与滚动加载（`libraries/frontend/admin-ui-foundation/src/list/useCursorCandidates.ts:3,120–150`），而 UI 线框给候选画了“查询/重置/下一页”按钮，IA §4.1 又写“禁止逐keypress自动query”，附件 §12（273 行）写“候选按现有分页hook输入/查询机制”。三处应收成一种：沿既有候选形态（防抖搜索＋“加载更多”按钮，见 `BrandCatalogCopyDrawer.tsx:341–348` 先例），列表筛选才用显式查询。

### N-6 · 需 Dexter 裁决的可见语言与入口（DEXTER_DECISION）

1. 运维可见文案出现 `runtime`、`JS`、`APK`，包标题首段是 applicationId（UI 48、128 行等）；IA 写“应用/运行版本Input”（IA 39 行），UI 写“runtime检索”，两处不一致。UI 模板要求语料或 Journey 推不出的文案标“待 Dexter 裁决”，目前没有标。
2. 规则 create/status 写审计，但 RULE-DETAIL 菜单没有“操作历史”，而本后台其他详情（如 `BusinessEntityDetailDrawer`、`ContractDetailDrawer` 使用 `OperationsAuditHistoryModal`）提供该入口。按 §3-K-8 属跨批交互差异；是否本期提供请 Dexter 定。
3. 新建规则“初始状态默认停用”、规则列表筛选三项、报告列五项等细节随“大致 IA 确认”进入详设，没有逐项看图结论（UI §10）。

### N-7 · 文档残留与内部不一致（作者直接修）

- 详设 §9b（263 行）“扩现有report面”与 Dexter“不再扩展旧 Card”裁定冲突，应删。
- 附件 §13 每个后台 fact 行都附“已提交action按A原事实回读”（311 行起），对 stage/register/create/status 无意义，属判据退化成套话（`project-memory/pitfalls/criterion-degraded-into-list.md`）；只保留在 grant/report 行。
- UI §13 PKG-LIST 写“5列”（195 行），线框只有 4 列；IA §2.3 PKG-LIST“kind/app/runtime/版本条件服务器过滤”（82 行）多了线框与附件 §12 都没有的“版本条件”。
- 附件 §4.2 把 `TdsDatabasePrincipal.java` 列在 TDS 扩展处，实际是 CBS acceptance 测试类 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TdsDatabasePrincipal.java`；DEV 侧是 `scripts/dev/r5-dev-runner.mjs:935` 的 `provisionRemoteTdsDatabasePrincipal`。路径应写全。
- 附件 §2 的 `terminalUpdateActor.ts` 截面 SHA（`4356…`）已与当前字节（`5e974e57…`）不同；A 仍在推进，CP-01 必须重开，不能沿用表中行号。

### N-8 · 模板结构偏离（内容大多在附件，形式需补）

见 §4 TEMPLATE_COVERAGE 中标“部分”的各节。最影响后续核对的是：UI §2/§5/§6/§7 用散文代替模板要求的表（可见操作分母需要逐操作一行，现由附件 §13.1 分组覆盖），IA 缺 §6 完成判定块，Journey/UI/IA 的 `DEXTER_WIREFRAME_REVIEW` 取值不在模板枚举内（写 `IA_CONFIRMED`，应写 `ACCEPTED@2026-10-07` 并注明范围是“大致 IA”）。

## 4 · TEMPLATE_COVERAGE（逐节：有 / 部分 / 缺 / N_A）

**Journey 模板**（对 Journey 文件）

| 节 | 结论 | 说明 |
| --- | --- | --- |
| §1 元数据 | 部分 | 缺 `SKILL_USED`；`STATUS` 取值不在枚举内 |
| §2 用户任务与成功结果 | 部分 | 有三类任务与成功结果；“失败后仍成立的事实”未逐 actor 写 |
| §3 逐 actor 前提链 | 有 | 来源类型三选一齐全，无 `EXTERNAL_PREREQUISITE`；A 交接如实标为未完成工程依赖 |
| §4 任务边界/非目标/禁推/禁止伪修复 | 部分 | 范围与非目标有；禁推、禁止伪修复散在条目中，无独立项 |
| §5 Corpus | 部分 | 缺“冲突/未知”“是否需 Dexter 裁决”两列 |
| §6 / §6.1 | 有 | 指向 IA/UI；引用 §3-K-1..10 |
| §7 Dexter 裁决 | 部分 | 记录了职责与大致 IA 确认；未列未决项（见 N-6） |

**IA 模板**

| 节 | 结论 | 说明 |
| --- | --- | --- |
| §1 元数据 | 部分 | `DEXTER_WIREFRAME_REVIEW` 非枚举值 |
| §2.1 可见维度 | 部分 | 九个 IA-ID 有任务/入口/控件/校验/状态/容器；`interactionConsistency` 列转指 UI §1.2（S-2 显示该转指内容不准确） |
| §2.2 不可见维度 | 有 | 观察句带证据档位，多数降到 acceptance/组件档 |
| §2.1.1 容器负载行为 | 部分 | 有“表格分页/长标题省略/表头分页不越视口”；左右 Tab 对齐不适用 |
| §3 共用规则 | 有 | — |
| §4 错误映射 | 有 | 逐码全量（4.1）；S-1 的报告原因码不在其中 |
| §5 交叉对账 | 部分 | 有声明；未发现 N-7 所列不一致 |
| §6 完成判定 | 缺 | 无模板完成块 |

**UI 交互模板**

| 节 | 结论 | 说明 |
| --- | --- | --- |
| §1 元数据 | 部分 | 缺 `JOURNEY_DECISION/BUSINESS_PROBLEM/SUCCESS_OUTCOME` 等逐项键；审图值非枚举 |
| §1.1 十项声明 | 有 | 九行 canonical 表齐全；`USER_VISIBLE_COPY` 内容有缺陷见 S-1/S-2 |
| §1.2 §3-K 引用 | 部分 | 有表，但“无例外”与实际文案冲突（S-2） |
| Surface ownership 自检 | 有 | §13 九行 |
| 业务语言与动态明细命名 | 部分 | 技术词未标待裁决（N-6）；ref 当可见值（S-1） |
| Owner-definition 字段槽位 | N_A | 本批实体无 owner-definition 扩展字段 |
| §2 Interaction map | 部分 | 散文，无模板表列 |
| §3 v2 盘点 | 有 | `NO_V2_COUNTERPART`，含冻结集合 hash（附件 §7） |
| §4 线框/testId 清单/roster | 部分 | 九个线框齐；roster 与附件 §9/§12 命名不一（S-3） |
| §1.2 控件依赖图 / §1.2.1 字段事实矩阵 | 有 | 位于附件 §12/§13，逐控件、逐 variant 逐 fact |
| 主从动态集合 | N_A | 无主从可编辑集合 |
| §1.3/§1.3.1 搜索与候选协议 | 部分 | 有逐控件表；候选交互形态三处不一（N-5） |
| §5 状态与边界表 | 部分 | 散文 |
| §6 逐操作合理性 | 部分 | 分组散文＋附件 §13.1，无逐操作行 |
| §7 Face/owner | 部分 | 散文 |
| §8 Manifest B.4/B.5 | N_A | Part B 已退役（`deterministic-context-only`） |
| §9 高保真 | N_A | 有理由 |
| §10 看图结论 | 部分 | 只有“大致 IA 确认” |

**implementation-facing 详设模板**

| 节 | 结论 | 说明 |
| --- | --- | --- |
| §0 元数据与授权 | 有 | — |
| §1 方案比较 | 有 | 三方案，其中两项是明显的稻草人；更有价值的替代见本文 §2 |
| §2 CP 总览 | 有 | 六个 CP，前后置清楚 |
| §3 横切机制表 | 有 | 19 行，三列齐 |
| §3 第三方依据 | 有 | 版本/官方链接/OPEN 状态如实；无实际解析 |
| §3a UI/testId 与 L2 | 部分 | 有三状态与控制面文件全集；缺 case 分母与 P1 步骤，常量三套名（S-3） |
| §4 CP 门控 | 有 | 六行 RECALL/不变量/比例理由 |
| §5 operation/face/形态 | 有 | 16 项，规模指向附件 §18 |
| §6 跨 owner 写 | 有 | — |
| §7 声明—传递—消费 | 有 | 含机制行 |
| §8 规则→owner 判定点 | 有 | §8.1–8.5 |
| §9 owner API 与消费者 | 有 | 附件 §11.3 逐方法 caller |
| §9a 全链同步 | 有 | §9a.1 十行 |
| §9b 变更定位 | 部分 | 残留“扩现有report面”（N-7） |
| §10 迁移 | 有 | — |
| §10b.1–.6 seed | 有 | 路径全集、父链 COUNT_KEYS、角色/会话、试运行前提齐；取值问题见 N-4 |
| §11 验收场景 | 部分 | HTTP/协议场景具名；后台 L2 case 不具名（S-3） |
| §11a 判据对照 | 有 | 附件 §6/§14 |
| §12 未决项 | 有 | — |
| §13 停机条件 | 有 | — |
| §13b 三维对账 | 有 | — |
| §13c 逐代码对账 | 有 | 计划 §11 独立步骤 |
| §14 交付前自查 | 有 | §14、§15.3 |

`implementation-task-template.md` 的「动态前整体准入」四项与「失败族阶段准入」在计划 §9.2、详设 §13 有落点；授权话术未来起草时须按 `CLAUDE.md` 单列（见 §8）。

## 5 · DESIGN_GAPS（正本缺判据，交设计侧补，本评审不就地立规则）

1. `review-standard.md` §1 动作 5 指向 `project-memory/operations/verification-governance.md` 取 M/S/N 定义，但该文件没有定义。本评审用了 §0 所述口径。
2. 前端规范没有“候选搜索是防抖即搜还是显式提交”的正本；`useCursorCandidates` 实现的是防抖＋滚动，各批文档各写各的（N-5）。
3. 前端规范 §3-K-7 只给五种生命周期状态色，没有“任务/同步/报告类状态”的颜色正本，S-1 修订时只能写“不得挪用”，无法引用正向规则。

## 6 · Dexter 五项重点的逐项结论

1. **四模板与 UI 面**：两个内容页、运营双 Tab、PROJECT 读与写 cap 分离、NO_REPORT 以项目终端为分母、标准 ProTable/foundation 分页/Drawer/StatusChangeConfirm、唯一 dirty owner，在 IA §2/§6/§7、详设 §14.1、附件 §10 一致。缺口是可见文案（S-1、S-2）与 TestId 命名（S-3c）。hidden fact/visible action 的逐 variant 表（附件 §13）完整，但含套话（N-7）。
2. **A 交接与工件**：详设 §0.1 六项前置全部被当前源码印证——schema 无 kind、五字段 minimumFull（`contracts/terminal/terminal-update-artifact.schema.json`）；FULL 当前直接下载 `candidate.apk`、请求无授权头（`.../update/TerminalUpdateArtifactPreparer.kt:57–60,109–115`）；actual 的 bundleVersion 取自 embedded 清单（`.../update/TerminalUpdateRuntime.kt:211–224`）；端口六方法无 header（`.../platform-ports/src/types/update.ts:82–90`）。16 项 HTTP 的输入/错误/caller/事务 origin/完整 DB 计数齐全，数字明确标为假设而非测量（附件 §11.2a）。JSON 与 binary 分界、TDC `terminalRead` 前缀与 `queryParameters={}`（`terminalDataClientActor.ts:920,945`）属实。
3. **TDP/grant/report**：project 锁先于集合查询；完整多页快照与末页复核；原始 time 规则与 TDP 正本 1036–1050 行一致；store-basic 当前 boot STORE/PROJECT 各自 HTTP+flush 门有源码依据；grant 先 binding 锁再回收/计数/插入、旧有效 grant 不被撤销；报告以 TDS 权威 session_sequence（`TdsConnectionStateRepository.java:27–48`）与连接内 sequence 排序、PG 提交后才 ACK。没有新增调度、流水或通用恢复框架；自恢复的取舍见 N-1。
4. **测试与 seed**：四真实工件、八规则、稳定 key（`project-river`、`gw-aurora`、`store-operating`、`store-preparing`、`asg-multi-group`、`account-multi-role` 均在 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 中实际存在且归属正确）、`root` 平台 seed 会话与 `V2S_SEED_PLATFORM_ROOT_PASSWORD` 先例（`scripts/dev/owner-command-seed-executor.mjs:677`）、COUNT_KEYS/父子报告/完整 dry-run 均有设计。执行顺序 CP→6b→准入→API→后台 L2→（授权后）reset/start/seed→TER Web→同清单 Android→13c/实施 review 与 Dexter 要求一致；准入≠业务通过、dry-run≠真实 seed 写得清楚。阻断点只有后台 L2 的报告前提（S-3a）。
5. **B/C 边界与执行面**：B 不装配 accept/prepare/apply、不做 N/M 调度、不建副机对象；TER 只用 `scripts/test/terminal-automation.mjs` 的 `update` phase（`tools/terminal-automation/src/runner.ts:32`）；后台用自身 L2；不重跑未受影响的 A 对账，受影响的 source provider/UpdatePort 差量回归已列（详设 §8.4、计划 CP-04 第 3 项）。

## 7 · 已核实与未验证清单

**静态已证（本轮亲读当前字节）**：§6 各条所列源码事实；admin-catalog 中 `NAV-STORE-OPERATIONS`/`PG-STORE-TERMINALS order=310`；`SELECTED_PROJECT_SCOPE` 有既有使用；引用的 10 个既有 problem code 均在 contracts 中存在；L2 控制面八文件命名与 store-terminal 先例同形；`ui/integration/{sample-console,sample-wallpaper-console}` 路径存在；`AdvisoryLock.acquireHashText`、`OpaqueCollectionCursor`、`CanonicalCursorIdentity` 存在。

**测试已证**：无。本轮未运行任何生成、编译、测试或 verify。

**无人验证（产品负责人可据此决策）**：

- 两个后台的页面是否真的长成线框那样、文案、焦点、滚动、Drawer 尺寸、文件选择、启停确认——没有任何渲染。
- 上传真实 FULL/HOT ZIP 能否被解析、签名能否核验、坏包是否被拒——依赖 A 最终产物与 apksigner/aapt2 部署，均未取得。
- 规则创建/启停的权限隔离、并发、幂等，快照 101 条分页、topic 通知，下载授权与 32 上限——没有一次 HTTP/PG/Minio 运行。
- 终端是否真的保存了完整快照、是否只在 PROJECT 加载完成后取数、报告能否在断线后补报——Web 与 Android 都未运行。
- 运营页右 Tab 在有真实报告时显示什么——当前设计在 L2 里也拿不到真实报告（S-3）。
- reset/seed、cleanup 全部未执行；A 阶段本身仍在 Codex 实施中，未验收。

## 8 · 结论、授权边界与处置

`NO-GO 0M/3S/8N`。方向与主体结构合理，未发现需要推翻的设计；三条 S 都是可在文档内修正的缺口（S-1 报告可见语义、S-2 §3-K 文案、S-3 后台 L2 可执行性），修后可做差量复核。

- 需 Dexter 裁决：S-2 的“上传/登记”动词是否作为本域例外；S-3(a) 后台 L2 是自建隔离 TDS 产生真实报告，还是把“有报告的显示”降到 component＋backend-acceptance 证明；N-1 自恢复取舍；N-4 N/M 单位；N-6 三项可见语言与入口。
- 其余由 Codex 在既有批准边界内按同根范围修订，修订后经 Dexter 转交差量复核即可；外部评审不重开、也不替代其内部 R6 cycle。
- 本结论只评价设计字节，不授权实施、生成、运行、DEV、L2、reset/seed 或 C。后续若起草实施授权话术，须按 `CLAUDE.md`「转达实施授权」单列 CP 对账、整体对账、§3a 准入、seed 试运行四项进入条件、失败族第二次出现的冻结纪律、代码未改不重跑、持有运行时不改源码、同时只跑一个受管运行，以及“当前字节上的最新运行 / 最后一次通过”两行状态。

最后读取的作者材料：R5（NO-GO 0/1/0，标题职责问题，已核对当前附件 §17 已改为前端组装 label）、R6 工具状态（未创建 reviewer、无 verdict，如实记录）、intake。三条 S 与 R5 不重叠；R5 记录了“grant 与门店 scope 疑问证据不足未报”，本文以 N-3 建议形式提出。
