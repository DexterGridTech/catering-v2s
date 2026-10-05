# TER automation-agent 修订设计包 · 外部差量静态复核

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE_STATIC_DESIGN_RECHECK
PRIOR_REVIEW=doc/review/platform/2026-10-05-ter-automation-agent-design-review-claude.md（NO-GO 0M/5S/8N，旧详设 dcc53cc1…）
SESSION_PROVENANCE=续接会话（v2s 仓根），非 fresh；本会话起草了正式需求，也写了上一轮评审
NOT_A_SUBSTITUTE_FOR=内部 fresh 独立子 agent DESIGN 审查（intake 记录 VALID_INTERNAL_REVIEW_ROUNDS=0）
AUTHORIZATION=仅静态设计复核；不授权需求、规范、源码、acceptance、依赖修改，不授权安装、生成、构建、测试、verify、DEV、Web/设备、reset/seed、L2、UAT 或部署
```

## 0 · 对象与亲验哈希

本轮重新计算的 SHA-256 与 intake §5 一致：

| 文件 | SHA-256 前 16 位 |
|---|---|
| 需求 `…formal-requirements-claude.md` | `37fe9363e79b6db3`（未变） |
| 详设 `…implementation-design-claude.md` | `3fde4d1cbabd3952` |
| 计划 `…implementation-plan-claude.md` | `7a38b98a8fac4be5` |
| Journey | `0f6aec0cda44ac82` |
| IA | `be8fa1bd07bc233a` |
| UI 交互 | `08c994c9f8aa6e4a` |
| 附件 source-inventory | `74ed7133dcacca07` |
| skill 草案 | `670e0b52ce74db70` |

形成判断的顺序：先读需求、当前设计与源码，最后才对照 intake。源码与 seed 事实读自当前工作区字节；runtime、TDC 等文件仍处于 Codex 在途改动中，行号只对本轮字节成立。

## 1 · 结论

```text
VERDICT=NO-GO
M/S/N=0/3/4
L1_ENGINEERING=findings：S-B fixture 槽位在现有 seed 下无法供给；S-C 资源门与 fixture 迁移排在 CP-06，晚于 CP-01 起的动态运行；N-a 跨 owner 改动未进 §9a
L2_USER_VISIBLE=PASS（文档层）：admin 两行改为 valueTestID 挂实际 value 文本，UI/IA/详设三处一致；线框仍 UNSET，属 L3
L3_UNVERIFIED=见 §6
SAME_ROOT_SCAN=见各 finding「同根」行
DESIGN_GAPS=沿用上一轮：verification-governance.md 未定义 M/S/N 判定
TEMPLATE_COVERAGE=差量范围内四份模板对应节都在；§10b.6「角色与操作人」已补（详设 L329-330）；其余节与上一轮相同，见上一轮报告 §5
EVIDENCE_TIER=静态文档、当前源码、seed fixture 契约 JSON、DB migration 读取；无任何运行；RN 0.86 官方性能页本会话无法抓取
```

上一轮 13 项中，10 项在源头真正关闭。S-3、S-4、S-5 的修订各自引出一个新的同根缺口，三处都是小改即可关闭。主干仍不需要换方案。

## 2 · 十三项关闭表

| 原项 | 本轮判定 | 依据（当前行号） |
|---|---|---|
| S-1 R-18 逐字转录 | CLOSED | 详设 L193、计划 L148、skill L61 三处一致：fresh agent 给出全文与命令，main 逐字转录；改任一字符即修 skill，换新的 fresh agent；结果交回同一 fresh agent；不豁免写入规则 |
| S-2 NON_JSON 值状态 | CLOSED | 详设 L151：值状态事件，订阅保持，NON_JSON→JSON→NON_JSON 可观察；只有抛错、超预算、会话结束才终止；skill L39 同步。附件 `selectorReturnTypeAnalysis` 声明为类型分析，不冒充运行时 JSON 证明，顶层 undefined 恰为 3 项，与源码一致 |
| S-3 共享 fixture | PARTIALLY → S-B | owner、两消费者、focused、角色与环境变量、遗留 ACTIVE 回收落点均已写定（详设 L317-322、L329-330）。但“专用槽位不得与 TDC 五个重合”在现有 seed 下无法供给 |
| S-4 品牌 TestId | PARTIALLY → S-A | 项目 props 与 nativeSlots 已收窄（详设 L185-186）。直接使用 RN 原生宿主元素的 55 个节点仍可写字面量而 typecheck 不报错 |
| S-5 退役/迁移分母 | PARTIALLY → S-C | 九处登记与 helper 已逐项处置（详设 L272-284），资源 profile、run 根、kind 写定（L291）。但计划把它们排在 CP-06 |
| N-1 需求 D-1 时间 | PARTIALLY（接受） | 需求正本 L599/L611 未改，本轮无权修改；详设 L15 已登记来源，保留为 N（carried） |
| N-2 内部 route selector | CLOSED | 附件 `excludedCandidates` 12 项含 8 个 module 级 selector 及理由；详设 L174 写明各步改用哪些已登记 selector |
| N-3 mobile case 集 | CLOSED | 详设 L177、计划 L123：mobile 只跑 normal（空/37）、reject-retry、abandon；hand-back 与 keyboard-alpha-probe 进 HANDOFF |
| N-4 FactGrid 文本节点 | CLOSED | 详设 L162、UI L83、IA L41 一致：新增 `valueTestID` 挂 value `RnrText`，外框 ID 保留 |
| N-5 首次动态前对账 | CLOSED | 计划 L19、详设 L331：每个 CP 首次动态前做 fresh 三维静态对账，同一 CP 内只对变化补差量 |
| N-6 账本成本 | CLOSED（成本 NOT_RUN） | 详设 L167、L174：一次基线 read、动作前建立订阅、选定候选后改精确订阅；F-4b 计入长驻账本并配超限红例 |
| N-7 16ms 口径 | CLOSED（性能 NOT_RUN） | 详设 L152、L165-166：同步段起止、128 订阅总负载、P95/max 与样本数。外部依据见 §6 |
| N-8 skill 示例 | CLOSED | skill L24-27：先断言 `length === 1`，再解构 |

## 3 · 方案合理性

问题和方向仍然对。本轮修订有三处明显变简单：

- 品牌类型替代了自写的符号流分析；
- 一次基线读加精确订阅，替代了反复做全账本快照；
- fixture 改为共享 helper，不再复制。

遗留 ACTIVE 回收这一处，我先质疑过它是否过度设计，后来撤回了。质疑的理由是：它复用 `scripts/dev/r5-dev-runner.mjs:1053` 的 SQL 只读 readback，并在 projection 里新增 `bound_device_id`、`store_ref`。核实后撤回，依据有三：

- 这是旧 TER runner 已在用的受管只读路径（`ter-virtual-keyboard-android.mjs:42/6588`、`ter-admin-display-web.mjs:16/177`）。
- `bound_device_id` 是真实存在的列（`V20260926_000000_000__terminal_binding_owner.sql:14`，ACTIVE 时非空，L32-34）。
- HTTP 详情确实没有 deviceId。上一轮我建议“与 binding 读回的 deviceId 比对”，默认了 HTTP 能读到 deviceId，这一点我当时没有核实。作者找到的 SQL readback 是正确落点。

代价与收益：每次运行只多读两列，换来的是“不会误取消别人设备的绑定”。在只允许一个受管运行的纪律下，这个代价相配。

本轮真正偏离用户意图的是 S-B。“专用槽位”这一条（来自我上一轮的建议）在现有 seed 下会让 R-17 结构性受阻；而本仓既有的做法是：在串行纪律下共享 seed 终端，用前先读回绑定状态。这是更简单、也已被证明可行的路径。

UI 强制自问：差量只改了 admin 两行 testID 的挂载节点，不改变操作路径。结论同上一轮，产品与 Journey 层面没有歧义。

## 4 · Findings

### S-A 品牌 TestId 没有覆盖直接使用 RN 原生宿主元素的节点，字面量在这些位置仍能通过编译

- **位置**：详设 L185-186；计划 L136；V-14（详设 §11a）。
- **仓内事实**：附件 `jsxNodes` 中，标签为 `View`、`Text`、`Pressable`、`Animated.View` 的节点共 55 个，分布在 12 个文件：
  - `ui/base/dev-host/src/components/testExpoApp.tsx`（22 个）；
  - render 的 `LayerStack`、`ScreenContainer`、`ScreenReadyBoundary`、`SurfaceHostController`、`SurfaceRoot`；
  - input 的 `InputKeyboard`、`InputSurfaceFrame`、`VirtualKeyboard`；
  - `PairReadinessInterlock`、`AdminLauncher`、`AndroidTerminalApp`。

  这些元素的 `testID` 属性类型来自 react-native，是 `string`。`nativeSlots.tsx` 的 `Omit` 收窄只作用于 `Rnr*`。
- **推论**：详设 L185 说直接原生节点“经已有注册 hook 的品牌入参或本地 typed props 绑定”，但没有任何机制阻止 `<View testID="x">`。L186 的窄门只禁 `as TestId` 和 any/unknown 断言。R-14 要求“TER 源码中手写 testID 字符串字面量即报红”，在这 55 个位置不成立；`VirtualKeyboard` 恰好是首旅途逐键输入的节点。
- **反例**：CP-05 之后，有人在 `SurfaceRoot` 新增 `<View testID="surface-root:debug">`。typecheck 通过，窄门不报红，V-14 仍判 PASS。
- **影响**：回归防护在原生宿主节点上失效，而这道门存在的目的正是防回归。
- **最小修正**：在已有窄 AST 门里加一条“定点类型”规则。TER 生产 TSX 中，每个 JSX `testID`/`testId` 属性，用 checker 在该属性处取表达式类型，不可赋给 `TestId` 即报红。这只是单点类型查询，不是跨组件流分析。红夹具补一例 `<View testID="x">`。
- **为什么不是更小的方案**：类型声明合并不能把 RN 的 `testID?: string` 收窄（同名属性必须同型）。“禁止 primitives 以外直接 import RN 宿主组件”改动面更大。
- **同根**：已检查全部 639 个节点的标签。Rnr* 与 Primitive* 由收窄覆盖；`InputScrollArea`、`MemberRow`、`WallpaperOptionCards`、`HostStateCard` 是项目组件，props 可设为 TestId。剩余缺口只有上面这 55 个。
- **需 Dexter 裁决**：否。

### S-B「专用槽位不得与 TDC 五个重合」在现有 seed 下没有可用数据，R-17 会结构性 PREREQUISITE_BLOCKED

- **位置**：详设 L319；计划 L116；Journey L31（“既有 r5-full 数据”）。
- **仓内事实**：seed 契约 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 的 `stableFixtures.organization.storeTerminals` 共 8 个终端：
  - store-operating（即 S-OP）的 ENABLED 终端恰有 5 个：前台收银终端、后厨多打印终端、后厨显示终端、移动点餐终端、标签制作终端，正是 `devScenarios.test.ts:63-69` 的五个；
  - 第 6 个 ENABLED 终端是 store-preparing 的「备餐调度终端」（mobile）；
  - 其余两个分别为 DISABLED、VOIDED。

  详设 §10b.1 规定不改 seed，L319 规定不得自动创建数据。旧 runner 的做法是：从这份 seed 契约按 key 读取终端（`ter-admin-display-web.mjs:155-181`），与 TDC 共享同一批 seed 终端，用前读回绑定状态，ACTIVE 即拒绝。
- **推论**：dual（laptop）在 S-OP 没有任何不重合的 ENABLED 终端。mobile 只剩另一家门店的终端，与 sample-console 的 S-OP 绑定语义不符。按现文，R-17 与 V-17 在当前数据上不可能进入业务步骤。
- **影响**：本批主旅途无法验收；想要专用数据，只能走 seed 变更加 reset/seed，这是昂贵动作，需另行授权。
- **最小修正**：
  - 删除“与 TDC 五个不重合”这条规则，改为从 seed 契约按 key 选取终端：dual 用 `term-front`（laptop），mobile 用 `term-handheld`（mobile）；激活码从契约读取，不在受管 JSON 里另存一份。
  - 防争用改由已有纪律承担：同一时间只有一个受管运行（计划 L21）。driver 不与 TDC acceptance 并行。
  - 保留 REQUIRE_INACTIVE，以及“仅本 driver manifest 与 `bound_device_id` 一致时才回收”的规则。遇到 TDC 崩溃遗留的 ACTIVE，照旧拒绝。
- **更正说明**：“专用槽位”是我上一轮的建议，当时没有核对 seed 中的数量。本条修正以 seed 契约原文为准。
- **需 Dexter 裁决**：否。若 Dexter 仍要求 driver 使用独立数据，则需要 seed 变更并授权 reset/seed，属 `DEXTER_DECISION`。

### S-C 资源门接入、新文件登记与顾客 fixture 迁移都排在 CP-06，晚于 CP-01 起的动态运行

- **位置**：计划 L150（CP-06 第 3 步）；计划 L60-63（CP-01 已有 Web、双屏 VM、mobile 的 F-1/F-2 运行）；计划 L114-123（CP-04 使用 DEV 与真实顾客输入）；详设 L291（“任何 driver/Expo/browser/ADB 长运行启动前调用资源门”）。
- **仓内事实**：`scripts/env/check-runtime-resource-budget` 的行为如下：
  - 存在任何未豁免的存活受管进程（`live>0`）即 FAIL（L101）；
  - `admin-validation-with-ter` 只按目录前缀豁免 `ter-virtual-keyboard-android/`、`ter-admin-display/`（L21-25）。

  `r5-dev-runner.mjs` 与旧 TER runner 都调用这道门。
- **推论**：CP-01 至 CP-05 期间，driver 已经在启动 Expo、浏览器和 VM，但按计划直到 CP-06 才接入资源门、才在 DEV 侧登记新运行根。结果是两种情况必居其一：
  - driver 运行时不经资源门，违反详设 L291；
  - CP-04 与 DEV 同时在线时，DEV 侧的检查把 driver 的存活进程计为未知，从而 fail closed。

  同根问题还有两个：`terminal-business-fixtures.mjs` 迁移到 `fixtures/member.ts` 也排在 CP-06，而 CP-04 的旅途就需要它；health/format 对新 driver 文件的登记，同样应在文件创建时完成。
- **影响**：R-13 受管资源纪律在 4 个 CP 中空缺；CP-04 可能在与 DEV 共存时失败。
- **最小修正**：
  - CP-01 第 5 步：加入 driver 调用 `ter-validation-with-dev`、运行根与 kind 的写入、DEV 侧 profile 登记新根加 kind 及其红例、health/format 登记新文件；
  - CP-04 准备阶段：加入顾客 fixture 迁移；
  - CP-06 只保留“删除旧根豁免、删除旧入口与旧 helper”。
- **需 Dexter 裁决**：否。

### N-a readback 扩展属跨 owner 改动，但 §9a 与授权说明只点名了 TDC acceptance

- **位置**：详设 L249（§9a 行只列 TDC acceptance）、L321；Journey L63。
- **事实**：扩展 `scripts/dev/r5-dev-runner.mjs:1053` 的 SQL projection 与 `parseManagedTerminalBindingReadback` 的校验，还会连带 `r5-dev-runner.d.mts:34`。该函数现有消费者只有两个将被删除的旧 runner，删除后新 driver 成为唯一消费者。Dexter 对 S-3 的裁决只覆盖“改 TDC acceptance”。
- **修正**：
  - §9a 增加一行：DEV runner 的 readback 扩展，含 `.d.mts` 与 parse 校验的红例；
  - 将来起草实施授权话术时，单独写明这一跨 owner 改动；
  - 写明 `bound_device_id` 只用于运行身份核验，不落盘原值（详设 L321 已有意图，§9a 需同步）。
- **需 Dexter 裁决**：实施授权时一并确认，现在不需要。

### N-b skill 草案缺“真实点击产生的 request 如何关联”的写法

- **位置**：skill L23-48；详设 L174。
- **事实**：R-17 每一步都要断言 command 结果，而真实点击产生的 requestId 只能经详设 L174 的基线读加订阅匹配得到。skill 只示范了 `driver.command.dispatch`。按 S-1 的逐字转录规则，fresh agent 只能从 skill 学到写法。
- **影响**：缺了这一段，V-18 只能用 direct dispatch 凑够“command 跟踪”，学不到主旅途的真实写法。
- **修正**：skill §3 或 §4 增加这一写法，或增加 driver 的高层 helper 及示例；同时写明 fixture/激活前提如何由 driver 提供。

### N-c 详设 L174 的字段名与源码不符

- **事实**：`ui/base/terminal-activation/src/selectors/selectActivationStatusView.ts:12-17` 的顶层字段是 `activation`、`connection`、`lastRttMs`、`currentPeerValue`，没有顶层 `status`。
- **修正**：改为 `activation.status` 与 `currentPeerValue`；并注明非 MASTER 且投影不可用时返回 `null`（L30-33），这是合法 JSON，不是 NON_JSON。

### N-1（carried）需求 D-1 开始时间

需求正本未改，保持 PARTIALLY。下次另获需求修改授权时同步即可，不需要新的产品裁决。

## 5 · 已亲验事实（本轮新增）

- **seed 终端**：契约 JSON 中 8 个 storeTerminals 的 key、store、deviceType、status 如 S-B 所述。激活码均存在，本文不复述其值。
- **DB 列**：`terminal_binding` migration 有 `bound_device_id VARCHAR(128)`，并有约束：ACTIVE 时非空，ENDED 时为空。
- **既有 readback 路径**：`readManagedTerminalBindingByName` 经受管 manifest 的 bootId 校验后，在远端 `docker exec psql` 只读执行，现有 projection 为 name、terminal_ref、terminal_status、binding_status、generation（`r5-dev-runner.mjs:1062`）。
- **资源门**：`check-runtime-resource-budget` 的 `ter-validation-with-dev` 只豁免精确的 `r5/run-manifest.json` 且 kind 为 `r5-dev-run-manifest`；任何其他存活受管进程都会导致失败。这与详设 L291 对“preflight 只调用一次、启动后不重复调用”的理解一致。
- **收窄可行性**：`nativeSlots.tsx:36-48` 的 Rnr* props 类型直接取自 RN 组件，可以用 `Omit` 收窄，详设方案可行。
- **activation 视图**：`selectActivationStatusView` 返回 `ActivationStatusView | null`。`selectHostStaffQualification` 在 `sample-staff-session/src/selectors/selectors.ts:24` 存在。
- **哈希**：intake 记录的 7 份设计包 SHA 与本轮计算一致。

## 6 · OPEN / NOT_RUN

1. **admin 两行没人看过。** 线框 UNSET。
2. **RN 0.86 性能页未核实。** 本会话无法抓取 `https://reactnative.dev/docs/0.86/performance`，“60Hz 约 16.67ms”的外部依据由作者读取，本轮 UNVERIFIED。
3. **共享 helper 与 readback 扩展都尚未实现。** 新增的两列 projection、manifest 回收的红例，均 NOT_RUN。
4. **seed 终端当前在 DEV 上是否 INACTIVE 未知**，要到运行时才能读回。
5. **几何与重连都没跑过。** Fabric 与副屏 Presentation 的坐标、双屏 VM 可用性、断线重连、迟到结果、F-4a/F-4b 性能与包体，均 NOT_RUN。
6. **新依赖仍未安装或解析**，精确 tag 尚未核对。
7. **V-01～V-20 全部 NOT_RUN**；内部 fresh DESIGN 审查有效轮次为 0。

## 7 · 处置建议

S-A、S-B、S-C 都由作者在既有边界内修订文档即可关闭：S-A 和 S-C 各改一两段，S-B 删一条规则、改为按 seed key 选取终端。N-a、N-b、N-c 顺带处理。

只有 S-B 的一种变体需要 Dexter 裁决：坚持 driver 使用独立终端数据，那就意味着 seed 变更加 reset/seed。修订后的差量复核范围是：详设 L174、L185-186、L249、L319-321，计划 L60-63、L114-123、L150，skill §3-§4。本结论不授权实施或任何运行。

## 8 · Dexter 裁决（2026-10-05，本会话）

- **S-B**：按 seed key 共享。driver 从 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 按 key 选取终端：dual 用 `term-front`，mobile 用 `term-handheld`；激活码从该契约读取，不另存。删除“不得与 TDC 五个重合”的规则，不新增独立终端数据，不改 seed。防争用依靠“同一时间只有一个受管运行”。REQUIRE_INACTIVE 与“仅本 driver manifest 与 `bound_device_id` 一致时才回收”保持不变。

S-B 不再是 `DEXTER_DECISION`；S-A、S-C 与各 N 由作者在既有边界内修订。
