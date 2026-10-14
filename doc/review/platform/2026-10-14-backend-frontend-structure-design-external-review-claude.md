# 前后台重点代码结构优化完整设计包：外部独立静态评审（Claude）

## 0 · 结论块

```text
REVIEW_TARGET=DESIGN（详设、实施计划、源码与验证附件；Dexter 转交的外部整包评审，不重开内部 cycle）
ACTION_1_VARIANT=1-B 文档提取＋owning source 静态读回
VERDICT=NO-GO
M/S/N=0/2/2
L1_ENGINEERING=STATIC_ONLY；CP01–CP05 的代码改点与源码一致、边界保护完整；CP06 的终端在线 fixture 违反 TDS 不经 tunnel 的红线（S-2）
L2_USER_VISIBLE=原 Journey/IA/UI 复用，无新增操作；更新页与远控的 L2 证明路线代价过高（S-1，需 Dexter 裁决）
L3_UNVERIFIED=非空（§7）；两条 S 关闭后最多 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=每条 finding 内列出
DESIGN_GAPS=2（§8）
TEMPLATE_COVERAGE=§6
EVIDENCE_TIER=SOURCE_ONLY_STATIC_DESIGN_REVIEW
reviewerKind=EXTERNAL_CLAUDE
```

本轮实算 SHA-256：

| 文件 | SHA-256 |
|---|---|
| 正式需求 | 378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47 |
| 详设 | 87e382793739557ad3ef524c59d9ec5d04fde7bad66abf56fcc1b59c339eb921 |
| 计划 | 64fbf23fe057ab867728b57d6d29f14d8cf04c2a734142cd98d72de24b5855f0 |
| 附件 | 2872ac8713ca0e48edb1dfa1560d8b317cd94b4aa0bd798fac418cf9de4e30ce |

两条 S 都集中在 CP06 的验证控制面：CP01–CP05 的代码整改本身没有阻断。S-1 是方案取舍问题，需要 Dexter 裁决；S-2 是一句话可修的红线问题。

## 1 · 会话出处与独立性

- 非 fresh：本会话是续接会话。我此前对本专项正式需求旧字节做过外部评审（NO-GO 0/1/3），那四条已并入当前需求。因此本次对需求部分的判断独立性偏弱。我没有参与起草详设、计划或附件。
- 阅读顺序：先读需求、详设、计划、附件全文和相关 owning source，形成全部 finding 之后，才读 R3、R4 和 intake。
- 未读：`.runtime/`。CLAUDE.md、AGENTS、BLUEPRINT、R-READ-01～10 与实施模板 §3a 已在本会话读过；foundation-charter、third-party 标准和 UI/IA/Journey 模板正文只按需检索，没有逐节重读。

## 2 · 方案合理性

**问题对不对。** 对。以下维护风险我都亲自核过，它们是真实存在的：
- topic 名单两处声明；
- 远控 reason 手写在 parser 里；
- 资产两条流式循环；
- 制作差异判断两处；
- 菜单按图标过滤；
- 扩展字段双重 cast 后发送 legacy 数组；
- 更新页里十几个 request counter 散落；
- 远控 session 身份在宿主和 Workspace 各存一份。

**方案优不优（CP01–CP05）。** 我自己会给出同样的方案：
- 加载器加一个 `topicKeys()`；生成器在同一 renderer 里新增数组；
- 资产只增加一个 private `materializeStream`；
- 商品纯规则留在 owner 包内，以 package-private 类实现；
- 菜单图标并入 registration；
- 五组已有能力各出一个窄出口；
- 四个具名读 hook 直接消费 foundation guard；
- launcher 作为 session 身份的唯一 owner，Workspace 改为受控 prop。

这些都没有新增 Bean、代理、registry 或 HTTP 执行器。B-4/B-5 延后、B-7 现有构造路径保留，与源码一致：`CatalogItemService` 的 `sourceFact` 在 :4473-4477 已经只依赖 `ItemRow.sourceScopeRef`，`itemDetail` 的入参（:4587-4594）全部是已读取的值。

**代价配不配。** CP01–CP05 匹配。CP06 不匹配，见 S-1：一个“代码结构优化”批次，为更新页和远控的回归新建了一整套浏览器 L2 在线终端基础设施。它对远控的证明力还弱于仓内已有的受管 Journey。

## 3 · 重点逐项核验

| 重点 | 结论 |
|---|---|
| 1 R/V 与 CP、文件、档位闭合；B4/B5/B7 | 成立。§8 判定表逐条落到 §8.1–8.7；§11a 给出 V01–V18 的具体文件；附件 §1 按 CP 列出文件处置；保护清单（附件 §1 RETAIN）完整 |
| 2 asset、catalog、topic、双目标生成 | asset：两个 wrapper 加一个 stream helper，限值、prefix、decode 各自保留，与 `PlatformAssetService.java:201-245/1389-1434` 一致。catalog：纯计算与 IO 分开，写前逐个重查闭包，处置正确。topic：codec 已注入 `TerminalConnectionProtocol`（`TerminalConnectionFrameCodec.java:38-45`），改成实例消费可行。双目标生成：同一 renderer、additive、TER 手写代码不接入，成立。派生范围见 N-1 |
| 3 菜单、五个窄出口、六个读取资源、launcher/Workspace | 成立。26 个 catalog key 当前都有图标，删除 filter 今天没有可见变化。十一处外部引用与我此前统计一致。“表单排序”和“列表排序”分开保留，这个判断正确 |
| 4 十个 Drawer/十四个 operation、对象 SET/CLEAR、legacy 退役 | 成立。14 条写路径都经过 `ExtensionSubmissionWireMapper`；seed 中 7 处 `extensionSubmission(` 调用全部确认；browser-l2 runtime 已经发送 `{}`；平台集团初始化和服务点按整对象提交，作为反例保留。真实 HTTP 证明要求在 `ExtensionAcceptanceScenarios` 中补对象形状的 SET/CLEAR |
| 5 六个 case、TestId、受管入口、在线 fixture、工件交接 | TestId 逐动作表与控制面全集齐全，符合模板 §3a 硬要求。在线 fixture 与工件路线见 S-1/S-2 |
| 6 focused H→L2→最终 full H、seed dry-run、日志与两轮查漏 | 顺序正确（计划 §2、§9）。dry-run 实际覆盖什么见 N-2 |
| 7 Node 测试登记 | 成立。我按 `walkScriptTests` 的口径静态复算：登记 53 项、发现 58 项，缺的正好是计划 CP06 第 7 项点名的 5 项；新增的 4 项同步登记，没有新增 checker 或 runner |

## 4 · Findings

### S-1 · 更新页与远控的 L2 路线代价过高，远控证明力反而弱于现有受管 Journey（DEXTER_DECISION）

**位置**
- 详设 §3a L74-76；
- 计划 CP06 第 4、5 项（L79-80）及 §9 L96；
- 附件 §4 六个 case、§5 L141-175；
- 需求 V-09/V-10/V-11/V-14 L177-183 写的是“受影响页面路径 L2”。

**仓内事实**
- 为了让 rules/reports/remote 三个 case 能在 browser-l2 里运行，CP06 要新建以下内容：
  - 隔离 TDS profile（`browser-l2-terminal-transport.mjs`）。`browser-l2-runtime.mjs`（9314 行）目前没有任何 TDS 或 WebSocket 支持。
  - wire client 的新 fixture 模式。
  - 用终端 credential 提交超过 20 条报告的 fixture。
  - 工件交接与回收协议：先跑 `terminal-automation --case update.artifacts`，构建两个 TER App 的 INSTALL/FULL/HOT 工件（`update.test.ts:313` 起），再把十个文件交给 L2。
  - 4 份手写 policy、3 份生成 policy、admission 适配器、P1 生成器、CLI、fixture producer，以及 4 个 Node 测试。
- 仓内已有受管 Journey 在驱动同一批页面：
  - `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts`：建规则（FULL/HOT 候选）、启用、规则详情、报告查询/打开/历史分页；
  - `remote.web.test.ts`：详情菜单→start→end→close，带真实 Room。
- 新 L2 的远控 case 因为没有 description，Workspace 不会建 Room，只能断言 STARTING/end/焦点（附件 L161）。
- TER 工件要从 T1 正在重构的 TER 源码构建；该批任何构建失败都会直接阻塞本批 L2。

**推论**
- 本批在这些页面上的风险点（迟到响应、分资源 guard、session 身份）是确定性的异步逻辑，设计已在 F 档用 deferred request 和 mock Room 测试，L2 本来就难以稳定制造这类竞态。
- L2 能提供的是“页面没坏”的回归，而现有 Journey 对远控提供了更强的回归证据（真实 Room）。
- 仓内实证：门店终端批新建 L2 suite 后“跑了 36 次只通过 1 次”（实施模板 §3a）。

**影响**：CP06 大约是全批最大的新增代码量和失败面，而且一半成本用在证明力更弱的 case 上。这与 Dexter 反复强调的“只满足 90% 主流程、不过度设计”相悖。

**候选方案**
- A（推荐）：
  - admin-ui suite 只保留不依赖终端的 menu 与两个 extension case，fixture 只用 owner HTTP；
  - 更新页/远控的 UI 回归在实施后，经 Dexter 授权，复跑现有 `terminal-automation` 的 update Web 与 `remote.web` Journey；
  - 同时保留 V-09/V-10/V-11 的全部 F 测试；
  - 删除隔离 TDS、wire 新模式、报告 credential fixture 和工件到 L2 的交接。
  - 需要同步把需求 V-09/V-10/V-11/V-14 的 L2 改写为“现有受管 Journey 回归”。
- B：维持原设计。此时必须先修 S-2。
- C：更新页/远控只做 F，L2 明确列为 L3_UNVERIFIED 并延后。

注意：按实施模板 6c，首次 L2 前必须跑完整 seed dry-run，而 dry-run 需要 `R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID`（`r5-complete-seed-executor.mjs:425-427`）。因此只要本批跑任何 L2，A/B/C 都至少要构建一次 TER 工件。A 省掉的是在线终端 fixture、报告 fixture 与工件交接这一层。

**需 Dexter 裁决**：是。这条改变的是需求 V 行的证明档位。

### S-2 · 隔离 TDS 经“父 run WS tunnel”供 wire client 连接，与“TDS 节点端口不经 tunnel 暴露”冲突（CONFIRMED）

**位置**：附件 §5 L157（“CBS先迁移并ready→TDS连接同库→父run WS tunnel→复用 terminal-ws-wire-client”）；计划 CP06 第 4 项 L79。

**仓内事实**
- AGENTS.md L54 与 BLUEPRINT L55 规定“TDS 节点端口只绑定远端 loopback，不经 tunnel 暴露”。DEV 只能经两个 HAProxy 入口接入。
- browser-l2 runtime 目前没有任何获准的 TDS WebSocket ingress。
- 浏览器本身不连接 TDS，只有 wire client 需要连。
- wire client 只接受 localhost URL（`terminal-ws-wire-client.mjs:363`）。backend-acceptance 的现有用法是在远端以子进程运行它，直连 loopback 上的 TDS（`TerminalConnectionContractScenarios.java:133-135,187`）。

**反例**：照原文实施，会把一个 TDS 节点端口经 tunnel 转发到本机，这是一个新的网络 ingress，越过了环境执行矩阵的 Dexter 裁决。

**最小修正**：写明 wire client 在远端主机运行，直连父 run 拥有的 TDS loopback 端口，沿用 backend-acceptance 的现有形态；本机不新增 TDS tunnel。若采纳 S-1 的 A 或 C，这一条随之消失。

**需 Dexter 裁决**：否。若作者坚持在本机运行 wire client，就需要 Dexter 另行批准 L2 WS ingress。

### N-1 · 远控生成器只派生 3 个闭集，parser 仍手写 screen 与 phase（CONFIRMED）

**位置**：详设 §8.1 L145（“派生三个readonly arrays”）；需求 R-04“INPUT_RESULT、SESSION_END 等真实消费闭集”。

**仓内事实**：canonical 共有 6 个 enum 字段：SCREEN_READY.screen、POINTER.screen、POINTER.phase、INPUT_RESULT.status、INPUT_RESULT.reason、SESSION_END.reason。Web parser 在 `RemoteControlWorkspace.tsx:108,112,116` 手写了 `'main'/'secondary'` 和 `down/move/up/cancel`。

**影响**：小。screen/phase 很少变化，但它们与 reason 属于同一个“第二份闭集”模式。

**最小修正**：让生成器按 `body.fields[*].enum` 统一导出每个 enum 字段的只读数组，覆盖全部 6 个，parser 一并消费。这和手挑 3 个一样简单，也不用再判断“哪些算真实消费”。

**需 Dexter 裁决**：否。

### N-2 · seed dry-run 不覆盖本批改动的 seed 文件，证明边界应写明（CONFIRMED）

**位置**：详设 §10b L205-209；计划 §9。

**仓内事实**
- 本批改的是 `owner-command-seed-executor.mjs` 中 7 处 `extensionSubmission` 调用。
- `r5-complete-seed-executor.mjs#dryRun`（L409-430）只运行 `r5-seed-plan.mjs` 和其他 executor 的 `--plan-only`，不执行 `owner-command-seed-executor`。

**影响**：dry-run PASS 容易被读成“seed 对象化已验证”。实际上，在 Dexter 授权真实 seed 之前，这项改动只有 `owner-command-seed-executor.test.mjs` 的 F 证明。

**最小修正**：§10b 补一句：dry-run 是模板 6c 的准入要求，不证明 owner seed 的对象化；后者只有 F 证明，列入 L3/NOT_RUN，直到真实 seed 获授权。

**需 Dexter 裁决**：否。

## 5 · 与 R3/R4/intake 对照（形成结论后阅读）

- R3 NO-GO 0/1/0（Node 测试登记），R4 差量 GO_WITH_UNVERIFIED_UI 0/0/0。我复算后确认 Node 登记已闭合。
- R3 §6 认为“有限 L2 接线需要”。intake 显示，L2 基础设施是在 R1/R2 的 S02、S03、S05 推动下逐步加上的，期间 Dexter 没有对 L2 范围做过裁决。S-1 正是对这一累积结果的方案合理性复核。
- R3/R4 都没有核对 TDS 是否经 tunnel 暴露（S-2），也没有核对 enum 全集（N-1）和 dry-run 的实际覆盖面（N-2）。
- 历史 verdict 只对应各自字节，本文不继承。

## 6 · TEMPLATE_COVERAGE

| 模板 | 覆盖 |
|---|---|
| implementation-design | §0–14 都有，含 3a（控件分母表、L2 控制面全集）、9a、9b、10b.1–10b.6（seed 执行前提与角色）、11a、13b、13c；数据迁移与新 owner 审计按理由 N/A |
| journey-decision | NOT_APPLICABLE：复用 §0 所列已批准 Journey，没有新任务或 actor |
| ia-design | NOT_APPLICABLE：复用原 IA 的权限、刷新和集合锚点（详设 §3、§5、§7） |
| ui-interaction | NOT_APPLICABLE：没有新 screen 或文案；附件 §4 只做回归观察，看图维持 UNSET |

## 7 · 未验证项

| 项 | 状态 |
|---|---|
| 全部实现、生成、编译、F/H/L2、seed dry-run、TER 工件构建、cleanup | NOT_RUN |
| UI_DESIGN_REVIEW / TESTID_REVIEW / L2_SCRIPT_ADMISSION | OPEN / OPEN / BLOCKED |
| Java 实际 classpath 与 Spring 版本 | 未运行，按设计在 CP01 核实 |
| T1 最终的生成输出位置 | 写前重读 |
| seed 对象化 | 真实 seed 授权前只有 F 证明（N-2） |

用产品负责人能直接核对的话说，以下几件事还没有人看过：
- 菜单是否完整；
- 更新页的列表、详情、翻页和刷新是否与现在一致；
- 远控的开始、结束、重新发起和焦点回位；
- 门店和合同扩展字段的填写、清空、日期、是/否能否原样保存并读回。

## 8 · DESIGN_GAPS

1. `verification-governance` 仍没有 M/S/N 定义。本文沿用以往口径：S 指按原文没有合法实现路径、越过红线，或方案代价明显不配；N 指一致性或证明边界问题。待 Dexter 确认。
2. 结构优化这类“无业务变化”的批次，它的 UI 回归可以用什么档位证明，正本没有判据：是必须新建隔离 L2，还是可以复用现有受管 Journey。S-1 只能由 Dexter 个案裁决。本文不就地立规则。

## 9 · 授权声明

本文是外部静态设计评审，只新写本文件，其余路径只读。不授权实施，不授权修改需求、规范、记忆、源码、测试、生成器或依赖，不授权任何构建、测试、verify、DEV、reset/seed、Web、设备、L2、UAT 或部署，也不扩大 TER T1 范围。
