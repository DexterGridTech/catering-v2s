# TER automation-agent 详设与实施计划 · 独立静态 DESIGN 评审

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE_STATIC_DESIGN_REVIEW
SESSION_PROVENANCE=续接会话（v2s 仓根发起，但非 fresh；本会话此前起草了正式需求本身，不是该需求的独立评审者）
NOT_A_SUBSTITUTE_FOR=内部 fresh 独立子 agent DESIGN 审查；不是需求旧 cycle 的第三轮
AUTHORIZATION=仅静态设计评审；不授权改需求/设计/规范/源码/依赖，不授权生成、构建、测试、verify、DEV、Web/设备、reset/seed、L2、UAT 或部署
```

## 0 · 评审对象与亲验哈希

本轮重新计算 SHA-256，与作者检查所列一致：

| 文件 | SHA-256 前 12 位 |
|---|---|
| `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md` | `37fe9363e79b` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md` | `dcc53cc1a648` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md` | `db2325233bc7` |
| `doc/decisions/2026-10-05-ter-automation-agent-journey-claude.md` | `23b6b1d961ee` |
| `doc/decisions/2026-10-05-ter-automation-agent-ia-claude.md` | `cbc898abed57` |
| `doc/decisions/2026-10-05-ter-automation-agent-ui-interaction-claude.md` | `445d66bae04a` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-source-inventory-claude.json` | `33a5df4eb028` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-skill-draft-claude.md` | `f7cfdfbb98d7` |

源码事实读自当前工作区字节。`kernel/base/runtime`、`terminal-data-client`、`topology` 等文件正处于 Codex 在途改动中，以下引用的源码行号只对本轮字节成立，实施前须重读。作者检查 `doc/review/platform/2026-10-05-ter-automation-agent-design-author-check-claude.md` 在形成本文 findings 之后才读，未继承其判断。

## 1 · 结论

```text
VERDICT=NO-GO
M/S/N=0/5/8
L1_ENGINEERING=findings：S-3 fixture 复用无落点；S-5 退役/迁移分母缺共享登记点；N-5 首次动态前对账措辞与模板 6c 不一致
L2_USER_VISIBLE=findings：N-4（admin「自动化」「连接地址」的 testID 现落在 FactGrid 外层 View，与 UI 工件「实际文本节点」不符）；两条常量行线框 DEXTER_WIREFRAME_REVIEW=UNSET
L3_UNVERIFIED=见 §6
SAME_ROOT_SCAN=见各 finding「同根」行
DESIGN_GAPS=project-memory/operations/verification-governance.md 未给出 M/S/N 的判定定义（review-standard 指向该文件，但该文件只写 severity 由 Dexter 裁定）
TEMPLATE_COVERAGE=见 §5
EVIDENCE_TIER=静态文档 + 当前源码读取；本机 node_modules 元数据读取（zod 4.4.3 的 mini 导出）；没有任何运行
```

没有 M 级 finding。架构主干成立：App 主动连接 WS；按名 selector；primitives 无依赖接缝；一个 Runtime 一条连接；journal 先订阅后分发；固定闭集协议；CP 顺序无环。五项 S 都是在主干上缺一个明确决定，或缺一个落点。不需要换方案。按本仓惯例，存在 S 时判 NO-GO。修复后只需复核这几处差量。

## 2 · 方案合理性

**问题对不对。** 对。Dexter 的真实诉求是：让同一份旅途脚本在 Web 和 Android 上，用 Runtime 的真实语义观察和操作 TER。今后的 agent 也要能靠 skill 使用这套机制，从而替代各自解析 UI dump 的旧 runner。详设 §1 的目标陈述与讨论稿原话一致。设计没有把它做成远程运维产品或业务工作台。

**方案优不优。** 我独立构造过以下替代方案：

- **App 监听端口，driver 主动连。** 双机场景和 Web 都要新增平台端口，不如 App 主动连出。
- **uiautomator 加 Playwright 双栈，不做 agent。** 看不到 selector 和 request 语义，正是旧 runner 的病根。
- **agent 直读 full state。** 违背 Dexter 第二轮更正（只经 selector）。
- **在 primitives 里直接依赖 agent。** 会破坏依赖 DAG。

详设的选择在每一项上都更简单，或是唯一合规的选项。下面两处有更简单的替代，已列为 finding：

- **testID 机械门**（S-4）：品牌类型交给 `tsc` 完成，比自写符号流分析更简单，也更强。
- **R-18 验收**（S-1）：逐字转录规则能保住验收的证明力。

**一个观察，不构成 finding。** adbkit 的收益有限。多屏 input/screencap 本来就要回落到固定参数的 `spawn('adb')`，详设 §3.1 也承认 adbkit 的参数数组不是安全边界，于是 driver 里会同时有两套 adb 调用。R-20 已按 Dexter 采纳的推荐选了 adbkit，本轮不翻案。实施时如果 adbkit 只剩 `listDevices` 和 `reverse` 两处用途，值得在 CP-01 记录一行理由。

**代价配不配。** 大体相配。单批六个 CP 的规模与“全量 testID 重建 + 全部 runner 退役”的范围一致。各预算的依据如下：

- 1 MiB 的 bundle 上限较宽松，不构成负担。
- 2 GiB RSS 与现有 `scripts/env/check-runtime-resource-budget` 的 default `max_rss_mb=2048` 一致，有依据。
- 16 ms 的“整体 JS 周期”没有定义测量口径（N-7）。

**UI 强制自问。** 只有两条只读常量行，来自 R-04（Dexter 已批准的需求）。管理员已经在「运行状态」里看运行事实，在这里查看是自然路径，也是最短路径：没有新入口、新按钮或新 Tab。唯一不合理之处是 testID 的挂载节点（N-4），来源是现有 primitive 的实现惯性，不是产品语义问题。产品与 Journey 层面没有歧义需要裁决；线框看图仍在 Dexter 手里（UNSET）。

## 3 · Findings

### S-1 R-18 的「fresh 提出 / 主 agent 写跑」失去了验收的证明力

- **位置。** 详设 L186；计划 L147；skill 草案 L58；需求 R-18 的验收句（「由一个只读过这份 skill 的 fresh agent，独立写出并跑通…」）。
- **仓内事实。** 实施模板「实施者角色边界」规定子 agent 只读，主 agent 是唯一写入者。R-18 要求 fresh agent 独立写出并跑通。两者确有冲突，详设已如实登记。
- **推论。** R-18 要证明的是“只读 skill 就足以用好这套机制”。详设让 fresh agent 只“提出小旅途及命令序列”，再由掌握全部实现细节的主 agent 落文件、执行。主 agent 的隐性知识会在落文件时补上 skill 的缺口，于是验收无论 skill 好坏都能通过。
- **反例。** skill 漏写“query 返回数组时须校验恰好一个节点”，或漏写 `--shape` 参数。fresh agent 提出的序列不可运行，主 agent 顺手补齐，V-18 仍判 PASS。
- **影响。** V-18 证明力归零。R-18 的“skill 有缺口就修复后重验”机制失效。
- **最小修复。** fresh agent 在只读报告里给出完整的旅途文件全文与完整命令行。主 agent 只做逐字转录与执行，不得改一个字符；任何必要修改都记为 skill 缺口，修订 skill 后换一个新的 fresh agent 重来。执行结果交回同一 fresh agent 核对。这样既守住主 agent 唯一写入规则，又保留了验收的独立性。
- **为什么不是更小的方案。** 只写“不依赖额外隐藏说明”（计划 L147）不可验证；逐字转录是可审计的最小约束。
- **需 Dexter 裁决。** 可选确认。按上述规则，我认为已与 R-18 目的等价。若 Dexter 坚持 fresh agent 本人执行，则需对 AGENTS 写入规则做豁免，属 `DEXTER_DECISION`。

### S-2 NON_JSON_VALUE 是否终止订阅没有写定；三个已登记 selector 在常态下就会触发

- **位置。** 详设 L144（严格 JSON 检查，以及 selectScreen/selectTopologyFacts/selectPendingWallpaperId 空态为 NON_JSON_VALUE）；L147（「异常作为明确事件然后释放该订阅」）；L148（超预算「终止该订阅」）。
- **仓内事实。** `apps/terminal/kernel/base/ui-state/src/selectors/selectContent.ts:32-36` 中，`selectScreen` 的返回类型为 `ScreenPlacement | undefined`。附件 selectors 列表含这三项。
- **推论。** 详设没有区分 NON_JSON_VALUE 是“本次值不可表示”，还是“订阅异常”。按 L147 的字面意思，实现者会把它当作异常并释放订阅。
- **反例。** render-smoke 想订阅 `selectScreen` 观察 part 出现：订阅在首推（空态 `undefined`）就被释放，屏幕切换时又回到 `undefined`。`selectPendingWallpaperId` 在没有待确认壁纸时恒为 `undefined`，几乎无法订阅。旅途只能反复重订阅，变相轮询，而计划与 skill 都禁止轮询。
- **影响。** R-06 订阅能力对 3/42 个已登记 selector 不可用；R-17 的 selector 断言可能被迫改用别的 selector 或改成轮询。
- **最小修复。** 写定一句：NON_JSON_VALUE 作为该次推送的明确值状态事件发出（例如 `valueState: 'NON_JSON'`，原因码 `UNDEFINED`），订阅保持；之后出现合法 JSON 值时照常推送。只有求值抛错、超预算和会话结束才终止订阅。这仍满足 R-05「返回明确错误、不静默改写」。
- **同根。** 42 项中返回类型含 `undefined` 的，附件给出 3 项。实施时用同一 type checker 重扫一次返回类型，结果写入附件。
- **需 Dexter 裁决。** 否。

### S-3 Activation fixture「复用」的五个函数是测试文件私有函数，详设没有给出抽取落点

- **位置。** 详设 L294-295、§6、§9a；计划 L110、L114-116；Journey §3 第 5 行。
- **仓内事实。** `apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts` 中各函数均为模块内 `const`，未 export：
  - `operationsSession` L527；
  - `operationsTerminalByRef` L581；
  - `operationsTerminal` L593；
  - `cancelByOperations` L612；
  - `prepareFixture` L633。

  这些函数依赖同文件的 `workspaceKey='aurora'`（L58）、`storeCode='S-OP'`（L59）、`fixtureTerminals`（L63）、账号 `r5-account-multi-role`，以及环境变量 `V2S_SEED_OPERATIONS_DEFAULT_PASSWORD`。`prepareFixture` 遇到 ACTIVE 会无条件 `cancelByOperations`。
- **推论。** `tools/terminal-automation` 无法 import 一个 `.test.ts` 的私有函数，只剩两种做法：
  - 复制，违背 DRY，两份 fixture 链会漂移；
  - 改 TDC acceptance 文件、抽出共享模块。这是跨 owner 写入，不在 §6、§9a 任何一行。

  详设对 `prepareFixture` 的 ACTIVE 语义已正确声明“不照搬”，但下面几件事都没有写：
  - 抽取后的 owner；
  - 共享位置与消费者；
  - driver 专用的 fixture 槽位，避免与 TDC devScenarios 争用同一 `fixtureTerminals`；
  - §10b.6 所需的角色与操作人（上述账号、环境变量名，不写值）；
  - 本 driver 上次崩溃遗留的 ACTIVE binding 如何证明身份并回收。
- **反例。** 上一次 run 在激活之后崩溃，binding 仍为 ACTIVE。按「未知 ACTIVE 拒绝」，下一次 run 永远 PREREQUISITE_BLOCKED，只能人工处置。
- **影响。** R-17 前提链无法按设计实施，会在 CP-04 现场临时决定抽取或复制。
- **最小修复。** 在 §9a 增加一行：
  - 抽取的目标模块与 owner：建议仍归 TDC acceptance，导出 Node 可用的纯 HTTP helper，`devScenarios.test.ts` 与 driver 同时消费；
  - TDC acceptance 的 focused 验证；
  - driver 专用 fixture 索引或名称；
  - 回收规则：仅当 run manifest 记录的 deviceId 与 binding 读回的 deviceId 一致时，才允许 cancel。

  §10b.6 补写角色与操作人。
- **需 Dexter 裁决。** 否。若 Dexter 不愿让本批改 TDC acceptance 文件，则只能复制，需要 Dexter 接受重复。

### S-4 testID 机械门选了自写的符号流分析；品牌类型更简单，判定也更强

- **位置。** 详设 L179；计划 L135；需求 R-14 机械门段。
- **仓内事实。** `ui/base/primitives/src/foundations/assertTestID.ts` 只校验非空。testID 经组件 props 跨层传递，例如 InputScrollArea、MemberRow 转发（详设 L116 已列）。现有派生拼接如 `PrimitiveAdmin.tsx:79` 的 `${testID}:item:${item.key}`。
- **推论。** 详设要求 gate 证明“传给 testID 字段的值都由构造函数或其常量流入”，并且“符号流不能靠单 regex 豁免变量”。props 一旦是 `string`，这就是跨组件的过程间数据流分析。`check-static.mjs` 里没有这种分析，自写成本高，容易留洞，也难给出可信红例。
- **替代方案。** `createTestId` 返回品牌类型 `TestId`（`string & {readonly __brand: unique symbol}`），所有 primitives 与转发组件的 `testID` prop 改为 `TestId`：
  - 手写字面量、模板拼接、旧常量都在现有 `tsc` typecheck 中报红，过程间流动由编译器完成；
  - 机械门只剩一条窄规则：除构造函数文件外禁止 `as TestId` 或断言，用现有 TypeScript AST 判断；
  - 红夹具是一个必须编译失败的 fixture 文件。

  这同样满足 R-14 的「手写字面量即报红、须红夹具、接入现有静态流程」。全量重建本来就要逐文件改，改 prop 类型不增加触面。
- **影响。** 按现方案，CP-05 会把大量时间花在 gate 本身，判定强度反而更弱。
- **最小修复。** CP-05 改为品牌类型加窄 cast 门；§3 横切表、§9a、V-14 同步。
- **需 Dexter 裁决。** 否（R-14 已把判定口径交给详设）。

### S-5 退役/迁移分母漏掉共享登记点和两个独占 helper

- **位置。** 详设 §9a.1（L244-264）、§9a 末行；计划 CP-06 L149-150。
- **仓内事实。** 以下登记点均不在 §9a.1 或附件 `runnerInventory` 中：
  - `scripts/test/terminal-business-fixtures.mjs`（11 行，生成 run 隔离的顾客姓名/电话）。它只被 `ter-admin-display-web.mjs:17`、`ter-virtual-keyboard-android.mjs:40` 及其测试消费；后者正是 R-17 顾客输入需要的能力，应迁移，不应随旧入口变成孤儿。
  - `tools/terminal-sample2/wallpaperCatalog.mjs`，只被 `run-sample2-frozen-journey.mjs` 与 ter-vk 测试消费。
  - `scripts/test/test-health-entry-runner.mjs:62-64` 登记了三份将删除的测试文件。
  - `tools/terminal-shared/run-terminal-format.mjs:58-68,94` 登记了旧 runner 文件。
  - `scripts/env/check-runtime-resource-budget:21-25`：`admin-validation-with-ter` profile 只豁免 `ter-virtual-keyboard-android/`、`ter-admin-display/` 两个 TER run 根。旧 TER runner 和 `r5-dev-runner.mjs` 都调用这道资源门。
  - `tools/terminal-sample2/check-production-bundle.mjs:16` 的禁用词 `run-u8-release-cold-start`。
  - `project-memory/required-inventory.json`、`project-memory/index.json`、`project-memory/operations/test-closed-loop.md`、`scripts/README.md` 引用旧入口。计划 L148 提到 required-inventory，其余未列。
- **推论。** 删除引用会被 CP-06 的“static 引用搜索”抓到，但正向迁移不会被抓到：新 driver 需要像旧 runner 一样接入资源门，其 run 根需要登记进 DEV 侧 profile。
- **反例。** R-17 要求受管 DEV 同时在线。新 driver 若不调用资源门，现有资源控制会静默失效，“漏了不报错”。若 driver run 根落在 `.runtime/` 下而未登记，DEV 侧 `admin-validation-with-ter` 检查会 fail closed。
- **影响。** R-16「完整分类」的声明不成立，R-13 的受管资源纪律存在空窗。
- **最小修复。** §9a.1 增加上述 9 处，各标迁移、同步或删除。§9a.2 写明 driver 调用 `check-runtime-resource-budget` 的 profile 及 run 根登记方式。附件 `runnerInventory` 的判别式改为同时扫描“导入旧入口的模块”和“按路径字符串登记旧入口的文件”两类。
- **同根。** 已对 11 个 runner 文件名做全仓路径字符串搜索（scripts、tools、根 package.json、`.agents`、project-memory、doc/platform），命中如上。apps/terminal 两个 App 的 README 也提到 ter-vk，已由详设「README 同步」覆盖。
- **需 Dexter 裁决。** 否。

### N-1 需求 D-1 与详设开始时间不一致

- **位置。** 需求 L599、L611；详设 L15；Journey §1 L14。
- **事实与推论。** Dexter 本次指派明确授权现在编写设计，详设据此覆盖 D-1 中“设计也等待 Codex”的部分；实施仍在 Codex 批次之后。需求正本未同步。
- **修复。** 下次需求修订（另获授权时）在 D-1 下记一行裁决来源与日期。本轮无需动文件。
- **需 Dexter 裁决。** 否（会话中已给出）。

### N-2 两个 ui/integration RuntimeModule 的 8 个 StateRoot selector 未进入排除清单

- **位置。** 附件 `excludedCandidates`（4 项）；详设 L142。
- **仓内事实。** 以下函数都在 module.ts 中 export，但未从包根导出：
  - `ui/integration/sample-console/src/application/module.ts:63,69,74,96`（含 `selectSampleConsoleRouteStage`）；
  - `ui/integration/sample-wallpaper-console/src/application/module.ts:62,68,73,95`。

  按 R-05 的定义（包根导出），它们不在登记范围。
- **影响。** `selectSampleConsoleRouteStage` 是 R-17「activation→staff→member」每一步最自然的 selector 断言，旅途无法读取。
- **修复。** 附件补列 8 项及排除理由。若旅途需要 route stage，由 sample-console 从包根导出并登记（owner 内小改）；否则在 §4.4 写明各步改用哪个已登记 selector。

### N-3 mobile 执行面的 case 集三处说法不一

- **位置。** 详设 L171（「single-screen业务normal/拒绝/放弃/返回」）；计划 L43（CLI case 枚举无 hand-back）；需求 R-17（`hand-back` 列入 R-16 待重写清单）。
- **影响。** 如果“返回”指 hand-back，就与 CLI 和 R-17 冲突；如果不是，则含义不明。
- **修复。** 改为与 CLI 一致的明确 case 名，并写明 hand-back 属 HANDOFF 空窗。

### N-4 admin 两行的 testID 当前会落在 FactGrid 外层 View

- **位置。** UI 交互 L80-81（「实际文本节点，不是 wrapper 冒充」）。
- **仓内事实。** `ui/base/primitives/src/components/PrimitiveAdmin.tsx:77-86`：`item.testID` 挂在包含 label 与 value 两个 `RnrText` 的外层 `RnrView` 上。
- **修复。** §3a 或 §9b 写明：PrimitiveFactGrid 用构造函数为 value 文本派生 ID（item 级 ID 保留在外层，或改挂 value）。UI 组件 proof 按此断言。
- **同根。** FactGrid 的其余调用点，在 CP-05 全量重建时同规则处理。

### N-5 首次动态前的对账：措辞比模板 6c 弱，频率又比模板 6c 高

- **位置。** 计划 L19「任何dynamic focused proof前…最小独立静态对账」；详设 L69、§13b。
- **仓内事实。** `doc/platform/implementation-task-template.md` 6c：「fresh 独立三维对账必须在第一次动态运行之前完成」。
- **修复。** 改为：每个 CP 第一次动态运行前，由 fresh 独立做三维静态对账（不是 CP 退出 MATCHED）；同一 CP 后续动态运行不重复，除非字节变化影响已对账范围。

### N-6 UI 自建 request 的关联在原理上可靠，但全账本快照的体量未纳入预算

- **位置。** 详设 L168；计划 CP-04。
- **仓内事实。** 关联链路的源码事实如下：
  - `selectRequestExecutionViews`（`kernel/base/runtime/src/selectors/selectRequestExecutionViews.ts:14-38`）每次返回全部 live view 的新数组，含 local 与 peer，顶层没有 memo。
  - 账本保留 30 min（`types/limits.ts:13`）。
  - 后台 actor 也会 `createRequestId()`：TDC、topology、store-basic。
  - UI 的 public command 一律经 `dispatchWithRequestId` 带 requestId。
  - 账本对没有 requestId 的请求不记录（`createCommandDispatcher.ts:170-172`）。
- **结论。** 按 root commandName、workspace、displayMode 做差集，在 sample 旅途里可靠。候选不唯一时 fail closed，处置正确。剩余风险是：长时间运行后整账本 JSON 可能逼近 1 MiB 与 8 ms 预算，而 F-4b 没有覆盖这一负载。
- **修复。** F-4b 增加一行“30 min 账本上限下 `selectRequestExecutionViews` 的求值与序列化”。或在 §4.4 写明：动作前的基线只用一次 `selector.read`，新增候选由动作前已建立的订阅捕获，并带 `workspace` 参数缩小范围。

### N-7 「整体 JS 周期 16ms」没有测量口径

- **位置。** 详设 L148、L161。
- **修复。** 写明测什么：例如 agent 处理一次 state 变化的同步段，用 JS 线程上的 performance mark 计时，P95 与 max 分别报告。依据写“60 Hz 帧预算”这一外部事实来源，并注明在 release 构建的 VM 上测。

### N-8 skill 草案示例与自身约束矛盾

- **位置。** skill 草案 L24、L28-30 用 `controls[0]`；L35 说“不要从 array[0] 掩盖 ambiguous”。
- **修复。** 示例改为“恰好一个”的查询接口，例如 `controls.queryOne`，或先断言 `length === 1`。

## 4 · 已亲验的事实（本轮读源码或文件得到）

- **Runtime.dispatchCommand 可分发 internal command。** `kernel/base/runtime/src/application/createRuntime.ts:461-474` 按名查找注册表后直接交给 dispatcher，没有 visibility 过滤，满足 R-07“包括 internal”。public 缺 requestId 的拒绝在 `createCommandDispatcher.ts:527`。
- **F-2 reload 用既有 command 可行。** `resetRuntimeAfterSystemFailureCommand` 的可见性为 `public`（`features/commands/resetRuntimeAfterSystemFailure.ts:8`；`createInternalRuntimeModule.ts:47`）。
- **一个 Runtime 一条连接的前提成立（静态）。** `application/base/android/src/components/AndroidTerminalApp.tsx:23,44-45` 按 surfaceForm 用模块级 Promise 缓存同一 assembly，两个 displayIndex 根共享同一 Runtime。前提是 Presentation 与主屏处于同一 JS 上下文，这一点属 UNVERIFIED（原生）。
- **依赖方向无反向依赖。**
  - render 与 input 依赖 primitives；
  - admin-shell 依赖 input、primitives、render；
  - integration-assembly 依赖 admin-shell、input、render（各 package.json）。

  接缝定义在 primitives、由 integration-assembly 注入 agent，不产生反向依赖。
- **AdminLauncher 现有几何的换算方式。** `admin-shell/src/components/AdminLauncher.tsx:25-56` 用窗口测量宽度除以 canvas 宽度得到比例，说明现有代码把 measureInWindow 视为已含祖先变换。这与详设 L121“不再乘 host/canvas 比例”同向。Fabric 下是否成立仍待 F-1。
- **RuntimeSection 结构。** 两个 `RuntimeSection{Mobile,Laptop}.tsx` 都使用 `PrimitiveScrollView` 加 `PrimitiveFactGrid`。`AdminSectionRenderContext` 定义在 `admin-shell/src/types/adminSection.ts:7-13`。
- **依赖解析。** `yarn.lock` 已解析 zod 4.4.3、ws 8.21.3、pngjs 3.4.0、dequal 2.0.3。本机 `node_modules/zod` 4.4.3 导出 `./mini`，`v4/mini/schemas.d.ts` 含 `strictObject`（L219）与 `discriminatedUnion`（L263）。rxjs、pixelmatch、adbkit 未解析，与详设 NOT_RESOLVED 一致。
- **附件盘点。** selectors 42 项、覆盖 11 个包；`excludedCandidates` 4 项；testIdFiles 145；jsxNodes 639；runnerInventory 11，均与详设一致。
- **其他 checker 不驱动 UI。** `check-behavior.mjs`、`check-u8-focused.mjs`、`check-native-projection.mjs`、`check-startup-diagnostics.mjs` 只 import Node 内置模块，不含 adb 或 uiautomator 调用，保留正确。
- **production 扫描门。** `check-production-bundle.mjs:8-16` 禁用词含 `ui.base.automation` 等，需求 R-15 与详设 CP-06 已覆盖删除。

## 5 · TEMPLATE_COVERAGE（四份模板逐节）

- **journey-decision-template §1–§7（含 §6.1）。** 全部有。§5 corpus 有。§7 裁决为 UNSET（正确）。
- **ia-design-template §1–§6（含 2.1、2.2、2.1.1 的 containerBehaviorUnderLoad）。** 全部有。§4 错误语义有两行，其中 HTTP 列为 N/A（无 HTTP，理由成立）。
- **ui-interaction-design-template。**
  - §1、§1.1、§1.2、§2、§3、§4（两屏线框）、§5–§7、§9、§10：有。
  - §4 下的 1.2 表单依赖图、1.2.1 mutation 字段矩阵、1.3 与 1.3.1 搜索候选：NOT_APPLICABLE（无输入、写操作或搜索，理由成立）。
  - §8 Manifest B.4/B.5：NOT_APPLICABLE（compliance-control 已退役）。
- **implementation-design-template。**
  - §0–§3、§3.1 第三方依据、§3a、§4–§9、§9a、§9b、§10、§10b.1–§10b.6、§11、§11a、§12、§13、§13b、§13c、§14：都有。
  - 有内容但不完整的三节：§3a 有（N-4）；§9a 有（S-3、S-5）；§10b.6「角色与操作人」缺（S-3）。

§3a 的 `L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON` 成立：本批执行面是 TER 的 Web 与 VM，不是两个后台的 browser L2。控件 roster 仍按 case 列出，满足 CLAUDE.md 对 §3a 的核对要求。

## 6 · OPEN / NOT_RUN（L3_UNVERIFIED，按产品负责人能决策的话写）

1. **没有人看过 admin 两行长什么样。** 线框 UNSET，等 Dexter 看图。
2. **双屏上的点击位置还不能保证点准。** Fabric 下 measureInWindow 与副屏 Presentation 的坐标、两套 display ID 映射，都还没在真机或 VM 上验证（F-1）。
3. **双屏 Android VM 是否可用不确定。** 若没有支持 Presentation 的 VM，R-17 的 Android 双屏部分无法完成，只能报告硬前提未满足。
4. **断线与重连的实际行为没跑过。** 包括正常关闭重连、异常断开重连、本地关闭不重连、超时后的迟到结果推送。
5. **打开自动化对终端性能与包体的影响没测。** F-4a 像素一致、F-4b 查询与订阅耗时、bundle 增量都 NOT_RUN。
6. **新依赖未安装。** rxjs、adbkit、pixelmatch 与 pngjs 7 的精确 tag API 未闭合；ws 8.21.3 的 tag 源码未读。
7. **激活准备链没有在当前 DEV 上跑过。** 所需的合法 INACTIVE fixture 是否存在，取决于届时 DEV 数据；没有就会 PREREQUISITE_BLOCKED，不会自动 reset 或 seed。
8. **Codex 在途批次正在改 runtime 的 dispatcher、module 类型与 TDC actor。** 本文引用的源码行号与语义须在实施前重读。
9. **V-01～V-20 全部 NOT_RUN。** 所有新增能力与 cleanup 均 NOT_RUN；旧 runner 未迁移的 case 的回归空窗尚待在 HANDOFF 登记。

## 7 · 焦点逐项回答

1. **接缝、surface 与身份。**
   - 零反向依赖的接缝、render 拥有 surface scope、一个 Runtime 一条连接、runtimeId 与 sessionId 分离：成立。
   - complete 与 error 都进入重试流、openObserver 重置失败计数、takeUntil 本地关闭后不再恢复：与 RxJS 7.8.2 语义一致（沿用前序 RxJS 复评已核实的源码事实）。
   - 无 finding。
2. **selector、命令观察与 request 关联。**
   - 包根签名全量登记：N-2。
   - 简单参数描述与严格 JSON：S-2。
   - 按名求值、journal 先订阅、超时后 120 s 的有限观察：成立。
   - 经既有账本关联真实 UI 操作：原理可靠，见 N-6。
3. **坐标、输入与第三方库。**
   - 坐标系与两套 display ID 的区分清楚；real 与 semantic 的分列清楚。
   - RxJS、Zod、adbkit 的选择没有过度要求，见 §2 的观察。
   - 关闭时“不注册、不测量、不加监听”成立。
4. **CP 顺序与对账。**
   - CP-01→06 的顺序，F 闸、首次动态前对账、CP 退出 MATCHED、6b、终验与 13c 之间无环。
   - 已 MATCHED 且未变的内容不重做，写清楚了。
   - 唯一问题是 N-5 的措辞。
5. **执行面顺序与退役。**
   - Web 先于设备；双屏五个 case 加两种年龄全部保留；真实 DEV 激活不隐含 reset 或 seed。
   - 退役分母缺口见 S-5；mobile case 集见 N-3。
6. **R-18 治理、admin 行与覆盖。**
   - R-18 的治理读法：S-1。
   - admin 两条常量行：N-4。
   - R-01～R-20 与 V-01～V-20 在 §8 与 §11a 中一一映射，无空号。
   - 模板覆盖见 §5。

## 8 · 处置建议

五项 S 和八项 N 都可由作者在既有边界内修订文档关闭，不涉及新业务范围。

只有 S-1 的“fresh agent 本人执行”变体，以及 S-3 的“若不改 TDC acceptance 则接受复制”，需要 Dexter 选择。

修订后请对差量复核：§4.2、§4.4、§4.5、§4.6、§9a、§9a.1、§9a.2、§10b.6、附件，以及计划 CP-04 至 CP-06。本 verdict 不授权实施、依赖安装或任何运行。

## 9 · Dexter 裁决（2026-10-05，本会话）

- **S-1**：采用逐字转录规则。fresh agent 在只读报告中给出完整旅途文件全文与完整命令行；主 agent 只做逐字转录与执行，任何修改都记为 skill 缺口，修订 skill 后换一个新的 fresh agent 重来；执行结果交回同一 fresh agent 核对。不豁免 AGENTS 的主 agent 唯一写入规则。
- **S-3**：允许本批修改 TDC acceptance。从 `devScenarios.test.ts` 抽出共享的 operations fixture helper，由 TDC acceptance 与新 driver 共同消费，不复制。

上述两项不再是 `DEXTER_DECISION`；其余 finding 由作者在既有边界内修订。
