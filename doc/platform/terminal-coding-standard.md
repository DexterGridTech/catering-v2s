# 终端编码规范 · 唯一权威

> **这是终端（`apps/terminal`，下称 TER）编码规范的唯一内容源。**
> 其他地方（项目记忆、skill、评审文档）**只放指针，不复述内容** —— 同一条规则写两处必然漂移。
>
> **规则只有一种写法：自带反例的禁止句。** 判断不了对错的句子不进本文。
> **每条必须有反例栏** —— 写不出「这道门抓不到什么」，说明这条还没想清楚。
>
> **上限**：本文超过"半小时读完"，或门超过"分钟级"，就是在重建刚退役的那套控制面。

---

## 0 · 怎么用这份文件

| | |
|---|---|
| **规则来源** | 2026-08-27/28 对 POC `newPOSv1` 的全量逐包分析（35 个包、约 98K 行 TS + Kotlin），归纳出 36 条 KEEP / 33 条 FIX / 4 条平台约束 |
| **实例台账** | `doc/review/platform/2026-08-27-v2s-terminal-poc-findings-ledger-claude.md` |
| **建设顺序与裁定** | `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` |
| **逐包分析** | 同目录 27 份 `k-` / `b-` / `u-` / `a-` 文档 |

### 与既有规范的关系

⚠️ **通用工作纪律不在本文重复。** 以下条目**指针引用** `doc/platform/frontend-coding-standard.md`，
它们不是前端专属，同样约束 TER：

| 条目 | 位置 |
|---|---|
| 读 RTK 数据用 `currentData`、判加载用 `isFetching` | 前端规范 §3-B |
| 命令式 `initiate` 必须承担 RTK 的义务 | 前端规范 §3-C |
| 同一个事实只能有一个住址 | 前端规范 §3-E |
| 幂等键按操作性质划边界 | 前端规范 §3-G |
| 否定式全称命题必须穷举后才能写 | 前端规范 §4-A |
| finding 必须带真实业务场景 | 前端规范 §4-B |
| 动手写新规则/新方案/新裁决前先查仓内五处 | 前端规范 §4-D |

⚠️ **明确不适用**：前端规范 §3-K（管理后台交互一致性七族）是针对 antd 后台控件形态写的，
TER 的控件形态不同。**等 TER 有真实 UI 批次、由实例产生后另立**，现在写就是无实例的口号。

⚠️ **`TR-05` 不适用于 RTK Query 相关条目**：TER 已裁定**不使用 RTK Query**（见 `T-5`），
前端规范 §3-B / §3-C 因此在 TER 只作为"同类问题的判据参考"，不作为现行约束。

---

## 1 · 十条硬规则（`TR-01` … `TR-10`）

### `TR-01` · reducer 只能被 actor 调用，且只由 command 驱动

**规则**：进入 reducer 的路径只有一条 —— `command → actor → dispatchAction`。
标识符 `dispatchAction` / `store.dispatch` / `useDispatch`
**不得出现在 `features/actors/**` 之外的任何生产文件**。

**白名单**：`kernel/base/runtime/**` 与 `kernel/base/state/**` —— 它们**实现**派发本身，在 actor 概念之下。

**反例**（POC 实测）：

- `2-ui/.../AdapterDiagnosticsScreen.tsx:54` —— React 组件里
  `store.dispatch(adminConsoleStateActions.setLatestAdapterSummary(summary))`；
- `tdp-sync/foundations/reduceServerMessage.ts` —— foundation 接收 `dispatchAction` 形参并在内部调用。
  **形式上由 actor 发起，实质上写入点已散到 foundation**，ledger 里看不到这次写入对应哪条命令。

**为什么**：三条真实收益 ——
① request ledger 成为状态变更的**完整审计**（每次迁移带 `requestId`/`commandId`，可 selector 观察）；
② automation 的 `command.dispatch` 成为**完备驱动面**，可覆盖 100% 状态迁移，不需要后门；
③ foundation 被迫变纯，可脱离 store 单测。

**foundation 改写形态**：

| foundation 性质 | 改写 |
|---|---|
| 同步纯逻辑（把输入化成一组状态变更） | **返回 `readonly UnknownAction[]`**，actor 逐条 dispatch |
| 长生命周期控制器（持有连接/队列，异步随事件写） | **改发 command**（`dispatchCommand`，不是 `dispatchAction`），由对应 actor 写状态 |

**module `install` 不设例外**：install 只 `dispatchCommand(initialize)`，由 `initializeActor` 写状态。

**门**：禁止句 —— 上述标识符在非 actor 生产文件中零命中。
**红夹具**：在任一 foundation 或 UI 文件加一行 `context.dispatchAction(...)` → 门必须红。
**负控制**：actor 内正常 dispatch → 绿；任何位置的 `dispatchCommand` → 绿（发命令不是写 reducer）。
**反例栏**：把 dispatch 藏进一个名字不同的包装函数再跨文件传递 —— 禁标识符抓不到。
这是刻意规避，不是无意犯错；门防的是后者。

---

### `TR-02` ·「什么都没做」的路径不得返回成功

**规则**：任何执行路径，若实际未完成其名义动作，**不得返回成功值、不得静默继续**，
必须产出**可区分的、有类型的**失败或"未执行"结果。

**反例**（POC 实测，四条本质缺陷里的三条同根）：

| 实例 | 表现 |
|---|---|
| workflow 未知/未实现 step | `type:'custom'` 或拼错的 type 落进兜底分支，**什么都不做然后报 `COMPLETED`** |
| HTTP 全链路不检查状态码 | 5xx 当成传输成功 ⇒ **故障切换不触发、坏地址被记为首选** |
| 自动刷盘失败静默 | `void flushPersistence()` 丢弃 Promise，**写盘失败无任何信号** |

**门（两条机械断言）**：
① `switch` / `if-else` 分派链必须有 default 分支，且 default **不得返回成功形状**
（TS 的 `never` 穷尽检查可直接承载：联合类型漏一支即编译错误）；
② **禁止 `void <返回 Promise 的表达式>`**（丢弃 Promise = 丢弃失败）。

**红夹具**：给某个联合类型加一个成员而不加处理分支 → 编译必须红；
把一处 `await flush()` 改成 `void flush()` → 门必须红。
**反例栏**：`try { ... } catch { return {ok:true} }` 这种**显式伪造成功**两条断言都抓不到，只能靠 review。

**对齐**：与 v2s 后台规范 **2-B** 是同一条，判据以那边为准，本文只补终端实例。

---

### `TR-03` · 跨包读只能走 selector，禁止按字符串键读别人的 slice

**规则**：读其它包的状态**只能**调用该包导出的 selector。
**禁止**用字符串字面量作 key 从 `getState()` 取别人的 slice。

**反例**（POC 实测）：`topology-runtime-v3/foundations/connectionController.ts:96-99`

```ts
const parameterCatalog = context.getState()?.[
    'kernel.base.runtime-shell-v2.parameter-catalog' as keyof ReturnType<typeof context.getState>
] as Record<string, {rawValue?: unknown}> | undefined
```

四个问题叠加：跨包读别人 slice、硬编码字符串键、双重 `as` 绕过类型、
绕过该包的解析函数直接读原始值（因而丢掉 decode / validate / source）。

**为什么必须有**：它**补上依赖门唯一的洞**。依赖门查的是 `import`，
而**按字符串键读 state 不产生任何 import** —— 依赖图上看不见这条耦合，
门全绿而两个包已紧耦合。这是隐蔽度最高的跨包依赖。

**门**：禁止 `getState()[` 后紧跟字符串字面量；禁止其它包的 slice name 字符串出现在非 owner 包
（owner 由 `TR-09` 的命名派生判定）。
**红夹具**：加一行 `getState()['其它包.某slice']` → 门必须红。
**反例栏**：把 key 拼进变量再取（`const k = base + '.x'`）抓不到 —— 刻意规避，不在防范目标内。

**与 `TR-01` 成对**：`TR-01` 管**谁能写**，本条管**谁能读**。两条合起来状态读写面才完全受控。

⚠️ **本条有一个例外，与 `TR-09` 的写侧例外是同一条**：
`kernel.base.state` 为持久化与同步读取他包 slice。
**内容见 `TR-09` 下的《例外：`kernel.base.state` 的持久化与同步》一节** ——
本文只有一份例外正文，此处不复述，避免两处漂移。

---

### `TR-04` · 声明了持久化，就必须有正反双断言的重启测试

**规则**：任何声明 `persistIntent: 'owner-only'` 的 slice，必须有一条**真实重启**
（独立进程 / 独立 runtime 实例）测试，**同时断言两侧**：该恢复的恢复了 · **不该恢复的确实没恢复**。

**反例**（POC 实测，数字最刺眼）：声明持久化的包 **12 个**，有重启恢复测试的 **5 个**；
缺的 7 个里包括 **`ui-runtime-v2`** —— 它的整个 `test/` 目录（974 行）中
`hydrate|persist|storage|restart|恢复` **零命中**。
**持有"崩溃重启恢复原状"这个灵魂核心状态（screen / overlay / uiVariable）的包，从未验证过恢复。**

**正例**（POC 内现成）：`tcp-control-runtime-v2` 的重启测试

```ts
expect(selectTcpRuntimeState(second.runtime.getState())?.lastActivationRequestId).toBeUndefined()
```

—— **断言"不该恢复的确实没恢复"**。

**门**：扫全部 slice descriptor，凡 `persistIntent: 'owner-only'`，本包 test 下必须存在
标记为 restart-recovery 的用例覆盖该 slice name，且该用例**同时含正向与反向断言**。
**红夹具**：给某个 slice 加 `persistIntent: 'owner-only'` 而不加测试 → 门必须红。
**反例栏**：门只能判"有没有这条用例"，判不了"断言得对不对" ——
一条只写 `expect(true).toBe(true)` 的用例能骗过它。靠 review 兜。

---

### `TR-05` · 端口与契约的入参/返回禁止 `Record<string, unknown>` 与 `any`

**规则**：`kernel/base/platform-ports` 与 `kernel/base/contracts` 中，
任何对外方法的参数与返回值必须是**具名类型**。禁止 `Record<string, unknown>` / `any` / 双重 `as` cast。

**反例**（POC 实测）：
`DevicePort.addPowerStatusChangeListener(listener: (event: Record<string, unknown>) => void)`；
`HotUpdatePort` 的四个 marker 读取全返回 `Record<string, unknown> | null`；
`LocalWebServerPort` 三个方法全是；`ConnectorPort` 几乎全是。

**为什么**：端口的全部意义是**有类型的边界**。退化成 `Record<string, unknown>` 之后它不是边界，是洞：
消费侧只能手搓字段名，那些字段名立刻变成**跨层字符串、零编译器保护**。

⚠️ **`DevicePort.addPowerStatusChangeListener` 是地基批必需能力**
（副屏拿下来当主屏靠监听接电状态，见 `T-9`/`Q-04` 裁定），
**且必须具名事件类型** —— 它正是本条点名的那个方法。

**门**：扫上述两个包的类型定义文件，禁止上述三种形态。
**红夹具**：把任一端口方法返回改回 `Record<string, unknown>` → 门必须红。
**反例栏**：`interface PowerEvent { [k: string]: unknown }` 这种"具名但内容开放"能过门，需 review 判。

---

### `TR-06` · foundations 不得触达 store、网络与平台 API

**规则**：`foundations/` 下的代码必须是纯函数，或只接受**显式注入的、已抽象的**依赖。
不得 import store、不得直接发起 HTTP/WS、不得调用平台 API。

**这是 `TR-01` 的配套**：既然 foundation 不能 dispatch，就该顺势把它变纯。

**反例**（POC 实测）：`reduceServerMessage.ts` 名字就叫"把服务端消息 reduce 成状态变更"，
本该是纯函数，现在**必须持有 dispatch 才能测**；`connectionController.ts` 同时持有 socket 与 dispatch。

**门**：`foundations/**` 不得 import store / transport 实现；不得出现 `dispatchAction` 标识符（与 `TR-01` 同一道门）。
**反例栏**：foundation 接受一个"看起来抽象、实际就是 store"的对象（`{getState, dispatch}`）能过门，需 review 判注入的依赖是否真抽象。

#### 例外：JS 运行时自带的时间与随机数（Dexter 2026-08-29 裁定）

**`Date.now()` · `Math.random()` · `crypto`（含 `crypto.randomUUID`）不属本条禁止的"平台 API"，
因此 `nowTimestampMs` 与 ID 生成一族允许留在 `foundations/`，尽管它们不是纯函数。**

**理由**（Dexter）：
1. 它们**是 JS 端能力，不依赖适配器** —— 任何 JS 运行时都有，不需要原生模块提供。
   把它们做成端口，是把"本来就有的能力"包装成"需要注入的能力"。
2. **时间不需要 JS 层校正**。真要校正是**操作系统级**的；OS 校正后 `Date.now()`
   自动就是校正值。JS 层再做一层偏移是在解一个不存在的问题。

**由此确立的边界线**（本条"平台 API"的准确含义）：

> **JS 语言与运行时自带的 ⇒ 允许**；**需要适配器提供的 ⇒ 禁止**
> （存储 · 网络 · 设备 · 原生模块）。

⚠️ **例外覆盖两类，不得扩大解释**：
① `nowTimestampMs` 与 ID 生成一族本身；
② **直接派生自它们、且派生是该函数固有语义的构造器** ——
   目前只有一个：错误构造器盖 `createdAt`（`createAppError`）。
   「固有语义」指：**去掉这次取值，该函数就不再完成它名义上的动作**。
   仅仅"顺手用了一下时间"不属于此列。

`foundations/` 下其余导出仍必须是纯函数。
⚠️ **新增任何第 ② 类派生构造器，必须在本节点名**，不得由下游文档自行豁免。
⚠️ **例外不豁免可测性**：依赖时间的行为必须用测试框架的假时钟
（如 vitest 的 `vi.setSystemTime`）做**精确值断言**，
不得退化成 `typeof x === 'number'` 这类弱断言。

---

### `TR-07` · 每个返回集合的接口先声明形态，声明了游标就必须真消费

**规则**：任何返回集合的接口/状态，**设计期先判定形态**
（Page / Cursor / Bounded / Detail 聚合），形态决定义务。
**契约声明了 `cursor`/`pageSize`，owner 就必须真消费它。**

**判据以 v2s charter §1-J 为准**，本文只补终端侧证据与加重理由。

**反例**（POC 实测，形态逐作者自定、无统一声明）：

| 集合 | 有界？ |
|---|---|
| workflow 的 observation / queue / journal | ✅ 有上限参数 |
| workflow 的 **definitions 数组** | ❌ **无界累积**：同一 key 每来一个新版本就多留一条，永不裁剪，且整块立即刷盘 |
| tdp projection 仓库 | ❌ 未见裁剪 |

**为什么终端比后台更需要**：**后台内存可扩，终端不能**。
无界数组在门店连续运行数周后是真实 OOM 来源，且先表现为"越用越卡"而非崩溃，极难归因。

**门**：slice 里任何数组/Record 型字段必须在 descriptor 里声明形态标记；声明了 cursor 的必须有消费点。
**反例栏**：声明了 `Bounded` 但上界取自"当前行数"（charter §1-J 已点名）抓不到。

---

### `TR-08` · 调试与自动化面必须编译期剔除，不靠运行期开关

**规则**：automation 控制面、诊断 socket 等**调试能力**，
在 production 构建产物里**必须不存在**，而不是"存在但默认不启动"。

⚠️ **边界（与 `T-11` 分清）**：本条针对 **automation 调试控制面**
（`adb` socket、`runtime.getState`、`ui.*` 这类调试入口）。
**`scripts.execute` 作为产品运行期能力已由 `T-11` 保留，并支持运行期远端下发脚本源** ——
**它不在本条剔除范围内**，写门时不得连它一起剔掉。

**反例**（POC 实测）：`host-runtime-rn84/application/createApp.ts:376`
`const automation = adbSocketDebugConfig.enabled ? ... : undefined` —— **运行期分支，代码照常编进产物**。
设计文档的"Product 默认不启动"是**约定型防线**，在"有人改了初始化顺序"时无声失效。

**门**：对 production bundle 做符号扫描，automation 相关标识符零命中。
**红夹具**：把剔除开关关掉重新打包 → 门必须红。
**反例栏**：符号被压缩/重命名后扫不到 —— 需按模块入口而非标识符判定。

---

### `TR-09` · 包必须声明自己是 owner 还是 toolkit；slice 名由 moduleName 派生

**规则**：
- 每个包在 manifest 声明 `kind: 'owner' | 'toolkit'`；
- `owner` 包**必须至少拥有一个 slice**，且是这些 slice 的**唯一写者**；
- `toolkit` 包**不得拥有 slice**；
- 所有 slice 名**必须以本包 `moduleName` 为前缀**。

**为什么**：把"包是什么"从口头判断变成可判定；**并且它是 `TR-03` 的前提** ——
知道谁是 slice 的 owner，才能说"你在跨包读"。

**反例**（POC 实测）：切分轴错误的两端 —— 两个零消费者的包 + 一个五职责的巨包（6,903 行 / 19 actor / 7 slice），
根因是"包"这个概念没有可判定的定义。

**门**：slice 名前缀检查；`kind:'owner'` 却零 slice、或 `kind:'toolkit'` 却有 slice → 红；
**零消费者的包报出来**。
**反例栏**：一个包拥有 slice 但职责仍过宽，门抓不到 ——"一个 owner 该管多大"仍是 review 判断。

#### 例外：`kernel.base.state` 的持久化与同步（Dexter 2026-08-31 裁定）

⚠️ **本节是 `TR-03` 与 `TR-09` 共用的唯一一份例外正文。**
持久化与同步天然跨 owner 读写，两侧是同一个机制的两半，因此写在一处；
`TR-03` 下只放指针。

**写侧例外（`TR-09`）**：`kernel.base.state` 在应用主副同步数据时，
可以整体写入他包的 slice。

**读侧例外（`TR-03`）**：`kernel.base.state` 可以按**已注册 descriptor 的 `slice.name`**
从根状态读取他包 slice，**仅限两个用途** ——
① 持久化的 flush，**只读声明了 `persistence` 的 slice**；
② 同步的载荷产出，**只读声明了 `sync` 的 slice**。

⚠️ **读侧为什么消不掉**：恢复那一侧已经靠构造期 `preloadedState` 消除了运行期写入，
但**落盘必须读他包的当前状态**，这一步没有等价的构造期做法。

**为什么必须是例外，而不能靠"让 owner 自己写"绕开**：同步的本质就是
**把对端的数据写进本机某个 owner 的状态**。改成"state 把数据递给 owner、
owner 自己在 reducer 里接"，只是把同一个外部写入拆成二十份样板代码分散到各包 ——
写入方向一点没变，`TR-09` 表面成立而实质未变，还多了一层 command 通路依赖。
**把例外写在明面上并限定死范围，比制造一个形式上合规的假象更诚实。**

⚠️ **边界，六条，不得扩大解释**：

0. **键必须来自已注册 descriptor 的 `slice.name`**，不得在逻辑中临时拼接或硬编码；
   未声明或未知的 slice **必须跳过并记录诊断**，不得静默处理；
1. **写侧只有同步落地这一条路径**。恢复（hydrate）不在例外内 ——
   它必须走 `preloadedState` 在 store 构造时注入，store 对外可见时状态已就位，
   **不存在运行期的外部写**；
2. **重置（reset）不在例外内**，因为它根本不是外部写入：
   根级 reset 把 `undefined` 交给 combineReducers，
   **每个 owner 的 reducer 各自返回自己的初始值**，没有任何外来数据被注入；
3. **只能写声明了 `sync` 描述符的 slice**。没声明的 slice 即使出现在载荷里也必须跳过并记录原因；
4. **不得导出"写任意 slice"的 API**；读侧不得导出**为读取具名他包 slice 提供的便捷访问器**。

   ⚠️ **读侧这条必须这样措辞才可满足**：Redux 的 store 根**结构上藏不住** ——
   `getStore()` / `getState()` 是 React 绑定与 owner selector 的必需品，
   它们返回的是 Redux 原生根，任何持有 store 的包都能按键取到他包 slice。
   ⇒ **读侧的执行机制是 `TR-03` 的门本身**（禁 `getState()[` 紧跟字符串字面量），
   而不是"根类型不可索引"。本条禁止的是**在这之上再加一层具名便捷入口**，
   例如 `readSlice(name)` 或 `getSliceState(name)` 这类导出；
5. **`reset` 虽不在写侧例外内，仍受 `TR-01` 约束** —— 公开的重置入口必须
   `command → actor → dispatch`；**根级 reset action 与它的 action creator
   不得作为公共后门导出**给任意 consumer。

⚠️ **新增任何第二条例外（读侧或写侧），必须在本节点名**，
不得由下游文档、需求或详设自行豁免，也不得在别处另写一份例外正文。

#### 骨架阶段例外（Dexter 2026-08-29 裁定）

**骨架阶段的包一律不声明 `kind`，改用 `plannedKind`。**

**为什么必须是例外而不是"占位 slice"**：骨架阶段明确不做任何能力实现，
而 `owner` 按本规则必须真拥有 slice。两者不能同时成立 ——
造一个占位 slice 去满足门，是**让包声称自己已经是 owner，而它不是**，
恰恰是本规范全篇要防的"声称 ≠ 行为"。

**规则**：
- **`plannedKind` 的唯一载体是骨架规格文件**（`apps/terminal/skeleton-graph.ts`），
  **不写在包内**。骨架期的包还没有 `application/moduleManifest.ts` ——
  那是 owner 包有了真实模块之后才有的东西，此时往包里塞一份 `plannedKind`
  就又制造了一处会漂移的陈述；
- `kind` 门**只对声明了 `kind` 的包生效** —— 没有 `kind` 的包不进入该门的分母；
- 包落下**第一个真实 slice** 时，在该包 manifest 写下 `kind`，
  并从规格文件移除它的 `plannedKind`，从那一刻起受本门约束；
- `plannedKind` 与最终 `kind` 不一致时，**以实际 slice 归属为准**，并说明为什么设计变了。

⚠️ `plannedKind` 是**设计意图**，不是已达成状态。任何报告不得把
"22 个包的 `plannedKind` 都标好了"表述成"owner/toolkit 划分已生效"。

---

### `TR-10` · 每个包必须有中文 `README.md`，说清定位、作用、结构、用法

**规则**：`apps/terminal/**` 下**每一个 workspace 包**，在该包实施收口时必须交付
包根的 `README.md`，用**中文**写，且至少覆盖四件事：

| 必写 | 要回答的问题 | 不合格的写法 |
|---|---|---|
| **定位** | 这个包是什么、**不是**什么；`owner` 还是 `toolkit`；依赖谁、被谁依赖 | 只抄一句 moduleName |
| **作用** | 什么东西该放进来、什么不该 —— **给出判别式**，不是罗列现有内容 | 「本包提供若干工具函数」 |
| **结构** | 目录树 + 每个目录/关键文件的**唯一职责** | 贴一棵没有注解的树 |
| **用法** | 最小可用代码示例；**示例必须来自本包真实公开面** | 伪代码，或从设计文档抄的、与源码不符的签名 |

**并且必须写「在这个包上迭代时」一节**：新增东西要过哪几关、改完必跑哪些命令、
本包踩过哪些坑不要踩回去。**README 的读者是下一个在这里改代码的人，不是评审。**

**为什么**：包的边界判据（什么该进来、什么不该）只活在设计文档与评审记录里时，
下一个开发者打开目录只能看到文件列表，于是**按现有内容归纳边界** ——
而现有内容恰恰是边界最模糊的那批。`TR-09` 让"包是什么"可判定，
`TR-10` 让"包是什么"**在包内可读**。

**反例**（本仓实测，`TR-10` 的产生实例）：`kernel.base.contracts` 完成并通过两轮评审后，
包内 21 个文件、74 个导出、零 README；
`apps/terminal` 下仅有的四个 `README.md` 全是骨架期的目录占位说明。
"哪些类型算共享词汇"这条判据只写在需求文档里，包内无任何痕迹。

**门**：`apps/terminal/**` 每个 workspace 包根存在 `README.md` 且非空 —— 可机械检查。
**反例栏**：**README 写得对不对、示例与源码是否一致，机器判不了**。
⚠️ 因此 `README.md` 与源码不一致，**按 finding 处理**，与代码缺陷同等；
包 review 时必须实际读 README 并对照公开面，不得只看文件存在。

**已落地范例**：`apps/terminal/kernel/base/contracts/README.md`。
新包写 README 时以它为形，不必逐字照抄结构。

## 2 · 三重命名与依赖方向

### 2-A · 三重标识由目录路径唯一派生

```
目录路径     kernel/base/contracts
moduleName   kernel.base.contracts                  ← 目录路径用「.」连接
npm 包名     @catering-v2s/kernel-base-contracts    ← moduleName 用「-」连接 + scope
```

`moduleName` 是**命名空间真相源**：command key、actor key、slice key、error key、parameter key、
日志 scope 全部由它派生。

**反例**（POC 实测，两处不一致）：
`ui-automation-runtime` 目录/包名/moduleName 三者两两不同且 moduleName 用连字符不用点；
`host-runtime-rn84` 的 npm 名缺 `adapter-android-` 前缀。

**门**：读每个包的目录路径、`package.json.name`、`src/moduleName.ts`，断言三者可互推。
**红夹具**：把任一包 `moduleName` 改成不匹配值 → 门必须红。

### 2-B · 包名禁止出现版本号与框架名

**规则**：包名不得含 `-v2` / `-v3` / `rn84` 之类。演进用**同名包内改实现**表达；
真要两代并存，用两个**能力不同**的名字。

**反例**（POC 实测，33 个包里 11 个）：`runtime-shell-v2`（225 处 import，出 v4 时要么改 225 处要么让名字长期说谎）、
`host-runtime-rn84`（**框架版本成了包身份**，一换 Expo 当天就错）。

**与 v2s 的"能力命名而非流程命名"红线同类**：名字说"它是什么能力"，不说"第几版"或"跑在什么上"。

### 2-C · 依赖门必须有两条断言，缺第二条则第一条是纸糊的

1. **方向断言**：按目录把包映射到层，断言 `dependencies` 不违反层级方向；
2. **声明完整性断言**：源码里每一个 `@catering-v2s/*` import，在本包 `package.json` 里都有对应声明。

**为什么缺 ② 不行**（POC 实测）：Yarn 的 node_modules linker 会 hoist，
**未声明的包在运行期照样 import 得到**。POC 里 **33 个包中 8 个（24%）有未声明的工作区依赖** ——
最严重的 `topology-runtime-v3` 声明 1 个、实际 import 5 个。
**被检查的那份 `dependencies` 根本不是真实依赖图。**

**红夹具**：给 `kernel/base/<x>` 加一条对 `ui/base/<y>` 的依赖 → 红；
在 `kernel/base/<x>` 源码 import 一个未声明的 `@catering-v2s/*` → 也必须红。
**反例栏**：deep import（`@catering-v2s/pkg/src/internal/...`）两条都抓不到，需靠包的 `exports` 字段收口。

---

## 3 · 能力端口的形状

### 3-A · 端口注册器 + 默认实例，端口无可选字段

**规则**：`PlatformPorts` **取消全部可选字段，端口永远存在**。
有人注册就用注册的实现；没人注册就用**声明端口时自带的默认实例**。

**默认实现必须零额外依赖**，分两类：

| 类别 | 语义 | 例 |
|---|---|---|
| **可用默认** | 零额外依赖就能真干活 | `logger` → `console.log`；KV → 进程内 Map |
| **不可用默认** | 明确返回 typed `CAPABILITY_UNAVAILABLE`，业务据此走自己的分支 | 摄像头扫码、打印/HID、热更新、topology host、安全存储 |

**反例**（POC 实测）：12 个字段 10 个可选 ⇒ 每个调用点写 `ports.device?.getDeviceId()`，
**在每一处**决定"没有时怎么办"，降级行为散落且不一致；
最坏一例是 `scriptExecutor` 缺失时**静默退回 `new Function` 在主 JS 上下文求值**。

**为什么**：`ports.scanner.scan()` 永远可调、永远类型正确、永远返回有意义的结果；
**降级只在端口声明处发生一次**。这条同时收掉"可选端口降级散落"与"缺能力静默成功"。

**范围红线**：**不得为了让 web 像真机而给默认实现加戏。**
摄像头就返回不可用。一旦在默认实现里模拟设备行为，web 面会变成第二个要维护的"假终端"，
而它给出的结论还不可信。

### 3-B ·「能力缺失」是一等业务事实

**规则**：能力缺失**不是异常、不是 `undefined`、不是静默成功**，
而是**有类型的业务结果**，UI 要能把它渲染成用户看得懂的话（"此设备无摄像头，请手动输入条码"）。

**与 `TR-02` 同根**：三者修法一致 ——"没做成"必须产生可区分的结果。

---

## 4 · UI 与多屏

### 4-A · `displayMode` 与 `containerKey` 必须随命令/容器传入，不得从全局 state 读

**规则**：多屏场景下，"这条命令作用于哪块屏"必须由**调用方随命令传入**。

**正例**（POC 已做对，TER 保持）：
overlay 的 `displayMode` 在 command payload 里（`openOverlay(…{displayMode, overlay})`）；
screen 的 `containerKey` 在 definition 里（`primaryRootContainer` / `secondaryRootContainer`）。

**反例（会坏）**：把 `displayMode` 改成从全局 state 读（"反正设备只有一个 displayMode"）——
**两块屏的 overlay 会串**。

⚠️ **注意区分**：`workspace`（`MAIN` / `BRANCH`）是**设备级工作上下文**
（跟随主机 / 脱离主机独立工作），**不是"哪块屏"**，两块屏共享它，从全局读**是正确的**。

### 4-B · 导航选中态只读 UI runtime，不在业务 slice 里复制

**规则**：页面 / Tab / 面板"当前选中的是哪个 screen"的事实源统一是 UI runtime 的 `screen` slice。
业务 slice **不得**新增 `selectedTab` / `currentPage` / `activeScreen` 这类导航镜像状态。

**为什么**：这是"崩溃/被关闭后重启能恢复原状"能成立的机制性原因 ——
**当前在哪一页只有一个真相源**。有第二份镜像，恢复就会出现"页面对了但 tab 不对"。

### 4-C · 自动化语义注册下沉到控件层（加法改减法）

**规则**：automation 的可寻址节点注册**由控件层统一提供**，业务组件零感知。

**反例**（POC 实测）：手工注册 ⇒ `semanticId` 52 处 vs `testID` 221 处，
**能不能被自动化测到，取决于有没有人记得注册**。加法型机制的覆盖率必然随代码量下降。

**TER 形态**：所有业务组件由 `ui/base/primitives`（NativeWind + React Native Reusables）构建，
该层统一挂注册 ⇒ 默认全部可寻址。

⚠️ **已登记例外**：虚拟键盘按「单表面命中测试」实现（`T-12`），
其三层结构落在 RNR 组件模型之外，**automation 寻址方式必须单独设计**
（虚拟节点 + `bounds`，或专用 command，或两者并存）。

---

## 5 · 明确不做的

| 候选 | 否掉理由 |
|---|---|
| 文件/函数行数上限 | 冻结计数不是不变量（charter §6-C）。问题是**职责**不是行数 |
| 强制单测覆盖率阈值 | 覆盖率是代理指标。POC 已证"有测试 ≠ 测了行为" |
| 禁止 `as` 类型断言 | 会误伤大量合法窄化。真问题是**双重 cast 绕过边界**，已由 `TR-05` 精确覆盖 |
| 强制每个 command 有对应 actor | 会破坏 `allowNoActor` 的既有设计语义 |
| 统一 UI 交互一致性七族 | 等 TER 有真实 UI 批次、由实例产生 |
| 禁止 `console.*` | 与 §3-A 的端口默认实现直接冲突（默认 logger 就是 `console.log`） |
| 强制所有异步带超时 | 无差别加超时会制造**假超时**（POC 实例：`setTimeout` 挡不住同步死循环）。超时要按边界设计 |

⚠️ **这一节的用途是"下次有人再提同样的候选，先看这里"**，避免反复重提。

---

## 6 · 维护约定

- **本文是唯一内容源。** 新增或修改规则只改本文。
- **别处只放指针**：项目记忆、skill、评审文档一律只写"见本文"。
- **新规则由实例产生**，写在修完之后 —— 没有实例的规则不进本文。
- **每条规则必须自带反例与反例栏**，否则它不是规范，是口号。
- 通用工作纪律见 §0 的指针表，不在本文复述。
