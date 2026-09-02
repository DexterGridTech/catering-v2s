# TER kernel 重复造轮子整改报告：Codex 独立只读复核

## 元数据与边界

| 项 | 值 |
|---|---|
| 审核对象 | `doc/plans/platform/2026-09-02-v2s-terminal-kernel-wheel-reinvention-remediation-claude.md` |
| 审核性质 | 对整改建议的源码回溯复核；不构成实施授权 |
| REVIEW_TARGET | `DESIGN` |
| REVIEW_CYCLE_ID | `TER_KERNEL_WHEEL_REINVENTION_REMEDIATION_DESIGN_2026_09_02` |
| REVIEW_ROUND | `1` |
| REVIEW_ROUND_LIMIT | `2` |
| reviewerKind | `INDEPENDENT_CODEX_READ_ONLY` |
| 执行边界 | 未改业务/测试源码；未启动 DEV、seed、L2、UAT 或任何受管运行；未运行测试 |
| 方法 | 先把报告中的四个可证伪主张映射到当前源码、invariant 和测试，再做同根符号扫描；不采信报告的行数统计和 `✅` 自述 |

本记录不冒充正式“盲审”：任务输入本身就是 Claude 报告。独立性来自当前仓字节和 heritage POC 的回源核验，而不是对报告内容的未知。

## 回源范围

- 当前报告：`e8126c981087d761dac29378fe73f78488b9c7810a692c41e0b92a028a6fdda7`
- runtime invariant：`af1a1587b1e0c611634c682227b5bb5a5437433a3329609b50a71ac8d6d3b7f1`
- request ledger：`1a7ed1df2eb36af25443d120d9da7a678bf0ede0ec23d9b44ccc915cdd5cf6b1`
- state runtime：`e7d2095e5f06e78cf6c53d6e72aadc0781d2feb8b3f14cb4260fe8933467a701`
- persistence test：`d129f714a5812e1d6c35443a21ffbdd3046d25d887de177f97bafc18fae6782f`
- skeleton static red-control test：`5b5b3136e0841a537ad3121dc7f4c83458b4d8674251bd99d449a156a151cf20`

另重开 state workspace helpers、runtime role-change actor、request execution selectors、五个 package-local static checker、skeleton checker，以及 heritage `newPOSv1` 的 scoped helpers。项目记忆路由为 `review/platform/platform-admin/platform/architecture/review`；其“先查既有能力、失败条件必须可证伪、owner/依赖方向不可倒置”约束在本次适用。

## 四项指定核验

### A-1：台账不是仅两道

**判定：PARTIALLY_CONFIRMED；两道已列门存在，但“只有两道落地阻碍”不完整。**

1. `runtime/terminal-invariants.json` 确有 `closedUnionConsumers` 指向 `createSetRuntimeInstanceModeAction`。若该独立 creator 被 `createSlice` 生成的 action 替代，这一行及 `closedUnionConsumerCount` 必须同步改为当前真实声明；不可保留悬挂 declaration。
2. 五个 package-local `publicExports` 精确集合门也都存在。但 A-1 的三个 creator 都是 feature 内符号，单纯把 reducer 改成 `createSlice` 并不必然改变 package root export。因此它们是**必须重跑的门**，不是五处都必然要改的台账；真正新增 state generic export 的影响属于 C-12。
3. 同根扫描发现 `tools/terminal-skeleton/check-static.test.mjs` 的 TR-01 红控把 actor 行文本和 `createSetRuntimeInstanceModeAction(...)` 写死为变异锚点。creator 消失或 actor 改用 slice action 后，现有 `replace` 会失配，测试夹具必须同批改成新的可变异锚点。这是报告 §2.6 未列出的直接消费者。
4. `runtime/package.json` 必须在 runtime 直接 import `createSlice` 时声明 `@reduxjs/toolkit`；报告 §2.7 已指出，但 A-1 的实施台账未把它与前三项并列。skeleton 的 `dependency-declaration-completeness` 只投影和比对 `@catering-v2s/*` workspace dependency，不能捕获该外部依赖遗漏；display-context 的既有 RTK type import 同样证明此盲区已真实存在。

对 `tr01Exceptions` 的排除 **CONFIRMED**：检查的是 dispatch receiver 表达式和 lexical declaration，不检查 action creator 名。若 actor 仍以 `context.dispatchAction(...)` 直接派发，换 action 实参不会破坏该 exception；但这不免除上一项红控夹具迁移。

### Immer：结论可保留，运行机理须改写

**判定：PARTIALLY_CONFIRMED。**

`createCommandDispatcher` 确实分别冻结 `record` 和 `commands`；RTK `createReducer` 对无命中 case reducer 返回原 state，命中才进入 `produce`。Immer 的 `freeze` 对 frozen object 立即返回。因此没有源码依据要求先把 requestLedger 排除出 A-1，也没有依据先关闭 `autoFreeze`。

但报告“深冻结走到 envelope 就停”不精确：case reducer 新建的 envelope 仍是未冻结对象，Immer 先冻结 root state 和该 envelope，遇到预冻结 `record` 才停止向下遍历。已存在的 frozen envelope 在后续更新中会早退。正确的表述应为：

> 单次命中 requestLedger case 时仍有 root map 遍历、draft 和新 envelope 的冻结；不会再深遍历预冻结的 record/commands。未测量前，不以此理由拆出 requestLedger，也不调用 `setAutoFreeze(false)`。

这是静态结构判断，不是目标机性能证明；包体“边际 0”与实际 CPU/内存成本是两件事，后者仍需在获授权后测量。

### C-12：泛型归属成立，当前提案尚不能直接实施

**判定：PARTIALLY_CONFIRMED；这是本报告的 M 级阻塞项。**

将只接收 `K extends string`、有序 key 集和回调的无维度泛型放在 state，runtime 以 `RuntimeInstanceMode` 实例化，**不会**形成 state → runtime 反向依赖；此解法方向成立。heritage 也确有 generic scoped core 与 workspace/instance-mode wrappers，可作为反例来源，但不能机械复制。

当前 requestLedger 的两个分区不只是 key 命名：

- MASTER 与 SLAVE 的 `syncIntent` 相反；
- role-change actor 清理 previous-mode 分区；
- cleanup 只作用当前 mode；
- 两个 request execution selector 以当前 mode 判定 local/peer，并合并两侧的同一请求。

因此泛型的最小职责只能是“按 caller 提供的 key 生成 name/descriptor/action routing”；每个分区的 sync intent、当前/peer 选择、切换清理和 lifecycle dispatch 仍必须由 runtime 明确拥有。特别是 `createPartitionedActionDispatcher` 不得暗中把 workspace 的 `routeContext.workspace` 语义套到 instance mode；runtime 必须显式提供当前 mode 或目标 partition。

报告还应删除两句过度结论：

- runtime 的 instance-mode instantiation 没有已知跨包消费者，不应为了“实例化导出”扩大 runtime public surface；保持 runtime feature-private，除非真实消费面另有需求。
- workspace 三件套仍是生产零消费者；C-12 可以让它们改为对 generic core 的薄封装，但不会使它们本身成为 requestLedger 的“第一个真实消费者”。Dexter 的“不删”裁定不受此影响。

### B-1 与 P-3b：两个镜像缺陷均成立，现有用例不足以关闭

**判定：CONFIRMED。**

`createStateRuntime` 先按 slice reference 形成 `changedSlices`，再从同一 slice 的全部 persistence descriptor 推导 `hasImmediateChange` 和 `hasDebouncedChange`：

- 仅改变 debounced descriptor，但该 slice 另有 immediate descriptor时，错误触发 `runFlush('immediate')`；
- 仅改变 immediate descriptor，但该 slice 另有 debounced descriptor时，错误清理并重启 debounce timer。

现行 P-3b 先发 debounced record，再发 immediate field；第二次派发确实满足错误的 `hasDebouncedChange`，因而重启 25ms timer。随后测试从第二次派发后等待 40ms，这比被重启后的 25ms 更长，故“原 timer 不变”和“timer 被重启”都会通过。报告的实质描述正确，宜改成这一因果表述，避免“40ms 吸收 25ms”这种不以首次派发为基准的说法。

仅把等待时间调短不是稳定证明。修复设计至少要有两个可证伪 focused cases：以 fake timer/可观察 flush seam 证明 immediate 更新不清理或重启已存在的 debounce deadline；并证明 debounced-only 更新不走 immediate selection。它们是修复所需的 red controls，不应称为“无需新增 red vector”。

## 还站不住的主张与最小修订

| 原主张 | 反证 | 应改成 |
|---|---|---|
| A-1 只有 closed-union 与五个 publicExports 两道台账 | TR-01 red-control test 硬编码旧 creator/actor 文本；runtime 引 RTK 的外部依赖也没有现有 skeleton completeness 门 | A-1 change matrix 至少列 invariant、静态红控夹具、runtime package dependency、直接符号测试及 public surface 重跑；publicExports 只在实际 root export 变更时更新 |
| Immer 深冻结走到 envelope 即停止 | 新 envelope 由 case reducer 创建，仍会被冻结；早退发生在预冻结 record | 保留“不拆 requestLedger、不关 autoFreeze”的结论，但改为“root/envelope 仍有开销，record/commands 不再深遍历” |
| C-12 会让 workspace 三件套成为第一个真实消费者，且应新增 runtime 实例化导出 | requestLedger 不调用 workspace wrappers；runtime public surface 无已知新 consumer | generic core 的首个生产消费者是 runtime 私有 requestLedger；workspace wrappers 保留并可薄封装，runtime 不扩大 public API |
| B-1 只须收紧 P-3b，不新增 red vector | P-3b 既观测不到错误 immediate flush，也不以首次 debounce deadline 断言 | 写两类独立可证伪 focused cases，使用 fake timer 或显式 flush observation，不依赖 wall-clock sleep |

## 建议执行顺序（供 Dexter 裁定）

认可 A-1 与 C-12 处于同一个**原子整改批**，理由是 requestLedger 不应先按旧的手写分区迁一次、随后再迁分区；但不认可它们作为无序的同一实现步骤。

1. 先完成 C-12 的 implementation-facing 设计：泛型输入/输出、key 枚举来源、slice-name 形态、动作定向方式，以及四项 runtime 专属语义（sync intent、role-change clear、current/peer selector、cleanup）的保留与反例。
2. 建立 C-12 focused cases：两个 mode 各自写入、切换后 previous clear、local/peer 合并、两侧反向 sync intent；再证明 generic helper 不导入 runtime。
3. 在同一批中把 requestLedger 一次迁为“generic partition + createSlice”，并按完整 A-1 matrix 同步迁移 instanceMode/displayRole、package manifest、invariant 和 static red-control fixture。
4. 先以 fake-timer cases 闭合 B-1，再改 scheduling 粒度；最后运行适用 package tests/typechecks/static gates。动态/设备性能与报告已标明的 NativePerformance/Hermes 项维持未验证，未经单独授权不启动。

## Verdict

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取后对当前源码、invariant、静态红控和 heritage POC 回源
VERDICT=NO-GO
M/S/N=M=1 / S=2 / N=1
L1_ENGINEERING=未运行；本轮为只读静态复核。A-1 静态夹具、C-12 语义保留、B-1 可证伪测试仍未形成实施设计。
L2_USER_VISIBLE=NOT_APPLICABLE；本次对象为 terminal kernel 整改建议，未声明获批用户可见 Journey。
L3_UNVERIFIED=未测 target-device CPU/内存；NativePerformance 注入和 Hermes crypto.getRandomValues 仍须真机验证；未执行任何测试。
SAME_ROOT_SCAN=已扫 createSetRuntimeInstanceModeAction、requestLedger partition helpers、TR-01 static red control、workspace helpers、request ledger selectors/actors 和 package dependency checks；发现 A-1 第三类直接消费者。
DESIGN_GAPS=C-12 尚未把 runtime 专属分区语义写成可证伪保持条件；B-1 未给两方向错误形状分别建立稳定 focused proof；A-1 matrix 未纳入 static red-control fixture。
EVIDENCE_TIER=STATIC_SOURCE_AND_GATE_RECONCILIATION
```

`NO-GO` 仅针对“按报告当前 §7 进入执行”的建议，不否定“零依赖误读、RTK 是适用既有依赖、B-1 是真实缺陷、C-12 的泛型方向可成立”这些根因结论。C-12 设计补齐、A-1 matrix 补全、B-1 proof 设计改正后，可由 Dexter 决定是否发起下一轮核验或实施授权。
