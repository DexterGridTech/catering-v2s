# TER `kernel.base.runtime` 单元 A 详细设计 · 第二轮定向 recheck

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `DESIGN` |
| REVIEW_ROUND | `2 / 2`（硬上限，本轮之后按仓内规矩由作者 `SELF_DECIDED` 收口） |
| 对象 | 修订版 910 行 / `sha256 3f763248…`（第一轮为 843 行 / `54015c97…`） |
| **VERDICT** | **GO** —— 条件：S-8、S-9 在进入 CP-A1 之前闭合（两条都是一句话的修订，不动接缝、不动分母） |
| **M / S / N** | **0 / 2 / 2** |
| 处置复核 | **M 2/2 闭合 · S 7/7 闭合 · N 9/9 闭合**，全部逐条回原文亲验，未采信 §14 的自陈 |
| 方法 | 逐字节打开修订版比对；仓内事实重新打开源码核；**本会话不运行任何命令** |
| 会话出处 | fresh，v2s 仓根发起 |

⚠️ **两条新 S 的性质要分清**：**S-8 是这一轮的修法引入的回归**（N-4 的修法越界了）；
**S-9 是第一轮就存在、我漏了的**，不是作者的新错 —— 只是这一轮把那个签名从三处扩到五处，撞上来了。

---

## 1 · 两条 Major：接缝是否真实闭合

### M-1 · routeContext 触点 —— **闭合**

亲验三处，逐条对上：

- **§5.6**：`command.started` transition **从 A 起就携带 `routeContext: CommandRouteContext | null`；A 只不透明搬运，不读取其中任何字段**。
  这正是我要的那一条 —— 它把"B 期要改 transition 类型"这个必然事件消掉了。
- **§5.6 末段**："A 构造 observation 时 `displayMode: null` 只有一处，且同一作用域已有 command.started 携带的 routeContext；
  **B 只把该表达式改为 `routeContext?.displayMode ?? null`，不改 transition 类型或调用点**"。
- **§5.2** 仍保持"A 不读 `workspace`、`instanceMode`、`displayMode`"，**与搬运不冲突** —— 搬运不是读取，这个区分写对了。

⚠️ 残留一处精度，见 **N-11**（不影响闭合判定）。

### M-2 · initialize 失败语义 —— **闭合**

**§5.8 阶段 4** 现在写死了：
"派发 `initializeCommand` 并 await typed result；**只有聚合状态为 `completed` 才进入 `started`**，
`error`、`partial-failed`、`timed-out` **或意外 `running`** 一律形成专用 AppError 并进入不可逆 `failed`。"

**四态穷举正确**，而且把"意外 `running`"也列进去了 —— 那一支我没点名，作者自己补的，
它对应 `completedAt` 未推进的病态实现，列进来是对的。

**没有自行新增产品轴** ✓：
"当前模型没有'非关键模块'分类，因此 initialize 非 completed 采用 fail-closed 是对既有阶段失败规则的收口，不新增产品轴；
未来若要允许非关键模块降级启动，须由 Dexter 另行裁定并先增加模块 criticality 语义。"
这个处理方式是对的 —— 把 `DEXTER_DECISION` 留在未来的扩范围上，而不是拿它当现在不裁决的借口。

**测试落点存在** ✓：新增 `L-3`（"initialize actor 返回 error、partial-failed、timed-out 时 start 均 reject 且 status=failed；completed 才 started"）。

---

## 2 · 七条 Significant 与九条 Note 的逐条复核

| # | 落点 | 复核结果 |
|---|---|---|
| S-1 | §5.2 末条 | **闭合**。已分域：actor 子命令默认当前 commandId、显式值只允许相等；**门面"没有'当前 commandId'"，原样接受调用方的 parentCommandId、缺省 `null`，跨机入站的对端 parent 不做本机相等校验**。三句都在，`rootCommandId` 恒为 null 的那条路径消掉了 |
| S-2 | §4.3 首段 | **闭合，且论证写对了**。`actorName` 空串或含 `.` 构造期拒绝，并显式写出后果："该规则使业务 actor 结构上无法伪造包内 peer synthetic key"。没有恢复无效的保留名表 ✓。测试 `N-2` 有落点 |
| S-3 | §5.1 第 7 条 | **闭合，比我要求的更完整**。存在性权威 = `AppModule.commands`；运行期只读已验证的 `CommandDefinition.visibility`；**descriptor 的 `visibility` 缺省按 `public`，注册期必须与同名 definition 精确相等否则拒绝**。需求 §4.2 第 4 条的 `?? 'public'` 也一并落在 descriptor 侧了。测试 `V-5` 有落点 |
| S-4 | §7.3 第 3 项 | **闭合**。"新增 REAL/NO_TEST 精确集检查**固定放在** contracts/platform-ports/state 三条既有 per-package 断言**之后**，保证第 6、7 项仍先命中原有定向错误消息"。定序写死了，第 6、7 项的"仍定向命中"现在有依据 |
| S-5 | §7.2 反例表 | **闭合**。五道门/support 各有反例边界行；`RUNTIME_RESTART_POSITIVE` 那行是"**仅作…存在性扫描，不证明恢复语义真实正确；反向断言本批无对象可测，B 交付 never-persisted 台账后补齐**" —— 与需求 A-4 的原话对得上，且把"存在性扫描"这个限制自己标出来了 |
| S-6 | §5.11 | **闭合，且比我提的最小修复更严**。两条约束并列：`>= 4 * requestRetentionMs`，以及 `> maxCommandDepth * maxRegisteredCommandTimeoutMs`，**后者取"模块解析后所有已注册 command definition 的最大 timeout"而不是只看缺省值**。我提的是乘缺省 timeout，作者取实际最大值，覆盖了"业务命令声明更长 timeout"这一类。⚠️ 我复算了缺省值下两条都成立：`7200000 >= 4×1800000`（取等）且 `7200000 > 32×60000 = 1920000` ✓。⚠️ 另核：`maxRegisteredCommandTimeoutMs` 要在**构造期**可得 —— §5.1 第 6 条与 §4.5 的 `descriptors` 表明模块解析确实发生在 `createRuntime` 而非 `start()`，所以"构造期重新校验"是自洽的 |
| S-7 | §9 CP-A0 + §13 | **闭合，就是我提的那个拆法**。入口只阻断"A 真实消费的有限集合"（逐项列了 contracts/platform-ports/state 三份清单，含 `getResetActor().handleResetCommand()` 与 isolated sync 拒绝）；需求 §7 的全量重扫**并行、不阻断 CP-A1/CP-A2**，结论回填需求 §7 与 HANDOFF，并保留"若推翻 A 前提则对应 CP 停机"。还加了一句我没提但很对的："**定向核验和全量重扫不得互相冒充**"。§13 也拆成了两行 ✓ |
| N-1 | §1.4 第 7 项 | **闭合**："record.result 为 `StateJsonValue`（其中已包含 null）" |
| N-2 | §5.6 末段 | **闭合**："角色清账另走契约三的 effect seam，不与本触点混称'唯一改动'" |
| N-3 | §5.8 | **闭合，且逐字段映射写全了**。`RuntimeStateInput` 补 `runtimeName`、`persistenceDebounceMs` 改必填；十字段逐项来源（含 `logger`/`plainStorage`/`protectedStorage` 取自 `platformPorts` 的哪三个端口）都在。⚠️ 我核过的那条事实也被正确吸收："`runtimeName` 只作为 state logger component，不参与存储命名空间" |
| N-4 | §4.5 + §5.8 | **闭合，但修法越界了**，见 **S-8**。`Runtime` 改 `interface` 并用 `get status()` / `get failure()` 访问器 ✓（`Runtime` 不是持久化 record，用 `interface` 不违反 §4.4 的 (a) 约束 —— 我复核了四个 record 类型仍全部是 `type`）；同步 throw 与异步 reject 也分清了 |
| N-5 | §4.3 · §4.5 | **闭合**。三个具名 alias **全文零残留**（grep 确认），三处公开形状改成内联签名；**exact exports 逐组复算仍为 57、名字集合未变** |
| N-6 | §5.6 | **闭合**："失败只写到 platform logger 的脱敏 runtime scope，**绝不写回 journal，避免 append 失败递归**" |
| N-7 | §5.10 | **闭合，措辞准确**："本设计**明确不同意**需求 §4.8a 中'internal 使它只能被模块内 actor 发出'的理由句，因为公开的 command definition 可被任意持有它的 actor 派发…**不能在 A 偷加 caller 分类学或把假保护恢复回来**"。§14 也标成 `CONFIRMED_REQUIREMENTS_DEFECT` —— 分类正确，那确实是我的需求的缺陷 |
| N-8 | §7.1 | **闭合**。`D-2`/`D-5` 都补上了 `completedAt !== null` 前置；`P-4` 补了"对端收到本机声明 `allowNoActor:true` 且本机无 actor 时返回 completed 而非 error"；另新增 `V-5`、`N-2`、`L-3`。⚠️ 但引入了一处编号重复，见 **N-10** |
| N-9 | §12 + HANDOFF | **闭合**。README 第 8 项补了"reset 会重跑 initialize，因此每个模块的 initialize actor 必须可重复执行并自带幂等保证"；HANDOFF 段落把"角色切换的业务留痕只在内存 journal、重启后不存在"单列了，并且**明写"不能把 journal 改成持久化作为临时解"** —— 这句是作者加的，堵住了最可能的错误修法 |

---

## 3 · 新 findings

### S-8 · N-4 的修法越界，与阶段 3、4 直接对撞（**本轮引入的回归**）

**位置**：§5.8 第 550 行；连带 §7.1 的 `L-2` 行

**事实**：修订新增的句子是
"`created`/`starting` 阶段 store 尚不可见，**`getState()`、`getStore()` 同步抛**同一个 runtime-not-started AppError"。
这句**没有限定作用域**。而本设计里有**三个** `getState`，签名完全相同：
`Runtime.getState`（§4.5 第 360 行）· `RuntimeModuleContext.getState`（§4.3 第 258 行）· `ActorExecutionContext.getState`（§4.3 第 279 行）。

**可证伪的失败后果**：§5.8 的阶段 3（`install`）与阶段 4（派发 `initialize`）**都发生在 `starting` 期间**，
而 store 在阶段 2 就已建成。按这句话的字面读法，
**任何模块在 `install` 里调 `ctx.getState()` 都会抛**，
**任何 initialize actor 调 `ctx.getState()` 也会抛** —— 阶段 3、4 变得不可实现。
两个 `getState` 与门面同名同签名，最自然的实现就是委托到同一个函数，这条路会被直接走上。
`L-2` 那行写的"start/dispatch/**getState** 均同一 typed reject"同样不分域，会把这个读法固化进测试。

⚠️ **我第一轮的 N-4 只要求"定义 `created` 阶段门面 `getState`/`getStore` 的行为"，
修法把它扩到了整个 `starting` 期与所有同名成员** —— 这是修法越界，不是原缺陷。

**最小修复**（一句话）：把该句限定为门面 ——
"本段只约束 `Runtime` 门面的 `getState`/`getStore`；`RuntimeModuleContext.getState` 与
`ActorExecutionContext.getState` 在阶段 2 之后正常可用，不受 runtime `status` 约束。"
`L-2` 行同步写成"门面 `getState`"。

**为什么不是更小的方案**：不能靠"实现者自然会懂" —— 三个成员同名同签名，
且 §5.8 是唯一定义它们何时可用的地方；`L-1`（四阶段）会在实现期变红，但那时已经按错的读法把 context 接线做完了。

---

### S-9 · `CommandDefinition<TPayload>` 的 brand 形状未定，`TPayload` 可能根本不绑定（**第一轮我漏了**）

**位置**：§4.2 的 `CommandDefinition`；影响 §4.2 两个门面重载、§4.3 两个上下文的内联 `dispatchCommand`、§4.2 的 `CommandIntent`

**事实**：`CommandDefinition<TPayload extends StateJsonValue = StateJsonValue>` 的**类型体里没有任何一处出现 `TPayload`**，
唯一相关的是一行注释 `// 私有 brand；只能由 defineCommand 生成` —— **brand 的形状没有写出来**。
`defineCommand` 那段只说"输出全名和不可伪造 brand"，也没说 brand 带不带 `TPayload`。

**可证伪的失败后果**（当 brand 不带 `TPayload` 时）：
TS 里未使用的类型参数不参与结构比较 ⇒ `CommandDefinition<{instanceMode: RuntimeInstanceMode}>`
与 `CommandDefinition<{typo: boolean}>` 是**同一个类型**。
于是在 `dispatchCommand<T>(definition: CommandDefinition<T>, payload: T, …)` 里，
`T` 从 `definition` 推不出任何东西、**只能从 `payload` 推** ⇒ **任何 payload 都能配任何命令，编译通过**。
具体反例：actor 写 `ctx.dispatchCommand(setRuntimeInstanceModeCommand, {typo: true})`
⇒ `T` 推成 `{typo: boolean}` ⇒ 编译通过 ⇒ 角色 actor 读到的 `payload.instanceMode` 是 `undefined`。
`onCommand(definition, handler)` 同理：为 payload X 写的 handler 能挂到声明 payload Y 的命令上。
测试 `T-3` 断言的是 brand 的**不可伪造**，不是 payload 的**绑定**，抓不到这一类。

⚠️ **这不是本轮引入的** —— 第一轮原文就是这样，是我漏了。
本轮把这个签名从三处内联扩到五处（N-5 的修法），它才浮出来。

**最小修复**：在 §4.2 写明 brand 由 `TPayload` 参数化，
例如 `readonly [commandPayloadBrand]: TPayload`（`commandPayloadBrand` 是不导出的 `unique symbol`），
并在 T 组补一条 `@ts-expect-error` 夹具：把 A 命令的 definition 与 B 命令的 payload 传进 `dispatchCommand` 必须编译失败。

**为什么不是更小的方案**：删掉 `TPayload` 参数也能自洽（承认不做 payload 类型绑定），
但那会让 `CommandIntent<TPayload>`（它**确实**用了 `TPayload`）与 definition 侧割裂，
且五处签名都要改；加一个 phantom 字段是改动最小、且把已经写出来的 API 承诺兑现的那一支。
⚠️ phantom 字段**不违反** §4.4 的 (b)（无可选属性）——那条只约束三个要进 `StateJsonValue` 的 record 类型，
`CommandDefinition` 不在其中。

---

### N 组（2 条）

| # | 位置 | 事实与后果 |
|---|---|---|
| N-10 | §7.1 | **`L-3` 被用了两次**：新增的"initialize 非 completed 一律 failed"与原有的"test-only release"共用同一个编号（全表 40 行、39 个不同 id，其余无重复）。用例 id 是 §7.1 与 §9 各 CP 完成信号之间的追溯键，重号会让"L-3 绿"指代不明 —— 少做一条也读得通。改成 `L-4` 即可 |
| N-11 | §5.6 末段 | "同一作用域已有 command.started 携带的 routeContext"这句**只在 observation 于 `command.started` 处构造时才字面成立**。`command.started` 与 `command.completed` 是同一函数里的两个分支，不是同一作用域；若 observation 在 `command.completed` 处构造，routeContext 必须由 accumulator 条目持有，而全文没说 accumulator 存它。⚠️ A 期**没有任何东西会迫使它被留住** —— A 不读它、不写日志、无测试、无门。⇒ 建议钉一句："observation 在 `command.started` 处构造（`completedAt: null`），此后只推进"，这样那句话无条件为真，也与 rule 0 的存在互相印证。**不影响 M-1 的闭合判定**：难的那一半（transition 类型）已经解决 |

---

## 4 · 新冲突扫描（Dexter 点名要查的四类）

| 类别 | 结果 |
|---|---|
| **范围** | **无新冲突**。§1.3 正文分母、§1.4 契约一九项、§0-A 的 A/B 划分均未漂移；没有把 B 的东西拉进来（仍无 slice/selector/淘汰/latest-wins/第二级聚合）；§13 随 CP-A0 拆分正确更新为两行 |
| **类型** | **一处新冲突（S-8）+ 一处旧的浮出（S-9）**。其余：exact exports 逐组复算仍 57、名字未变；三个 alias 零残留；四个 record 类型仍全部 `type`、`result` 仍是 `StateJsonValue`；observation 九字段形状（无 `requestId`、`target` 二值、`displayMode` 完整联合）未变；`Runtime` 改 `interface` 不触碰 §4.4 (a) 的适用范围 |
| **测试分母** | **一处编号重复（N-10）**，无其它漂移。新增 `V-5`、`N-2`、`L-3`；`D-2`/`D-5`/`P-4`/`V-4` 扩断言。CP-A4 的 `9 test owners / 4 REAL / 5 NO_TEST` 与 §9.1 停机条件的"REAL_TESTS owner 分母不是 4"仍一致 |
| **工具定序** | **无冲突，且原冲突已消**。§7.3 把新检查钉在三条 per-package 断言之后；`50–56` 保持原字节；`83–96` 仍改判 package mismatch；八处编号与 `verify-static.mjs` 两项注册都在 |
| **Markdown 结构** | **干净**：无表格被空行截断、无跨行断裂的表行、代码围栏 24 个成偶 |

---

## 5 · 结论与授权边界

**`VERDICT = GO`　`M=0  S=2  N=2`**

**GO 的依据**：两条 M 的接缝**都真实闭合**（不是文字层面的承诺，是把"B 期必然要改的东西"从设计里消掉了）；
7 条 S 与 9 条 N 逐条回原文亲验全部落地，其中 S-6 与 S-3 的修法**严于**我提的最小方案。
**条件**：S-8、S-9 在进入 CP-A1 之前闭合 —— 两条都是一句话的修订，
**不动五个接缝、不动 57 项公开面、不动 9/11 上下文、不动测试分母**，
按仓内规矩属 Codex 在既有批准边界内自主修复，**不需要 Dexter 裁决**。
N-10、N-11 同批顺手改掉即可。

**这个 GO 授权什么**：什么都不授权。
它只是一次**静态设计评审**的结论 —— 不授权实施、不授权开始 CP-A0、不授权修改任何 TER 源码、
不授权 typecheck / 测试 / TER-local verify / Expo / 设备 / DEV / seed / reset / 浏览器 L2 / UAT / 部署 / 数据操作。
**是否接受本设计、是否授权实施，由 Dexter 决定。**

**这个 GO 不能证明什么**：本轮与第一轮一样**没有运行任何命令**。
所有结论都是对**源码与文档字节**的静态核验。
类型是否真能编译、40 条用例是否真能写出来并变绿、五道门的红夹具是否真能定向红、
`verify.test.mjs` 那五处夹具改完是否真的只有预期的那几处变化 —— **本轮一概未证**，
那些只能由实施期的新鲜运行输出回答。

⚠️ **本轮是 `REVIEW_ROUND_LIMIT=2` 的第二轮**：按仓内两轮硬上限，
本轮之后由作者做辩证 intake 并 `SELF_DECIDED` 收口，**不得靠再换一轮 review 或局部修订重置 cycle**。
