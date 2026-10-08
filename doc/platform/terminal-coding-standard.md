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

## 1 · 硬规则（`TR-01` 起，编号只增不改）

> ⚠️ **本节标题刻意不含条数。** 2026-09-02 新增 `TR-11` 时，
> 旧标题「十条硬规则（`TR-01` … `TR-10`）」是 `project-memory` 路由锚点的字面量，
> 一改就使 routed memory recall 失败（`PROJECT_MEMORY=FAIL`）。
> ⇒ 锚点里不得带会随内容增长的数字。**加规则只追加条目，不动本标题。**

### `TR-01` · reducer 只能被 actor 调用，且只由 command 驱动

**规则**：进入 reducer 的路径只有一条 —— `command → actor → dispatchAction`。
**统一业务入口（Dexter 2026-10-02）**：发起任何业务指令必须使用 owner 公开 command，
包括不直接修改 slice 的业务动作。禁止新增业务 service 方法、回调、event bus、effect 列表或
capability 方法作为另一条业务执行入口。UI、integration、helper 和跨机路由都必须收敛到
同一 command 派发路径；现有基础设施适配只能承接该路径，不能绕过 command 执行业务。
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
**统一业务读取（Dexter 2026-10-02）**：业务数据与状态读取一律使用 owner 公开 selector；
禁止新增 getter、service 查询方法、callback 或 snapshot API 作为替代读面。名称是 provider、
capability 或 helper 不能成为例外：若其为既有基础设施适配，读取必须落到 owner selector，
不得直接访问他包 state、slice 或 persistence。selector 保持纯读；UI 的响应式读取遵循 `TR-15`。
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

### `TR-04` · 声明了持久化，就必须有重启测试证明持久化边界的范围正确

**规则**：任何声明 `persistIntent: 'owner-only'` 的 slice，必须有一条**真实重启**
（独立进程 / 独立 runtime 实例）测试，证明**持久化边界的范围正确**：该恢复的恢复了 · **不该恢复的确实没恢复**。

⚠️ **反向断言的对象不必在同一个 slice 内**（Dexter 2026-09-13 裁定澄清）。它可以指向同一条重启用例里
任何**本应不跨重启存活**的状态。理由：这条规则要证的是**边界的范围**，而边界本来就是跨 slice 的。

⚠️ **当一个 slice 的全部字段都合法地持久化时**（例如它承载的每一项都要求恢复原状），
本包内没有反向对象。此时**允许只写正向断言**，但必须在用例里注明"本 slice 全字段持久，无反向对象"。
**不得为了凑出反向断言而给 slice 增加一个没有消费者的字段** —— 那与 `TR-09` 禁止的"造占位 slice"是同一种病。
判据是：**去掉那个字段，功能还成不成立**。

**反例**（POC 实测，数字最刺眼）：声明持久化的包 **12 个**，有重启恢复测试的 **5 个**；
缺的 7 个里包括 **`ui-runtime-v2`** —— 它的整个 `test/` 目录（974 行）中
`hydrate|persist|storage|restart|恢复` **零命中**。
**持有"崩溃重启恢复原状"这个灵魂核心状态（screen / overlay / uiVariable）的包，从未验证过恢复。**

**正例**（POC 内现成）：`tcp-control-runtime-v2` 的重启测试

```ts
expect(selectTcpRuntimeState(second.runtime.getState())?.lastActivationRequestId).toBeUndefined()
```

—— **断言"不该恢复的确实没恢复"**。

**门**：⚠️ **该通用门今天不存在，这是已知欠账**（Dexter 2026-09-13 登记）。
现有两处实现都是**包级硬编码且只判正向**：`tools/terminal-runtime/check-static.mjs:506-525`
的 `runRestartPositive` 写死 `runtimeInstanceMode.ts`；
`tools/terminal-display-context/check-static.mjs:183-187` 是对字符串
`display-context-restart-positive` 的存在性扫描。
**新建的持久化包会得到零 TR-04 门覆盖**，本条目前完全靠 review 兜。
**在通用门建立之前，本规则是 review 判据，不得被当作"不这么写会红"来驱动设计。**
**反例栏**：即便将来建了门，它也只能判"有没有这条用例"，判不了"断言得对不对" ——
一条只写 `expect(true).toBe(true)` 的用例能骗过它。

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

⚠️ **边界（与 `T-11` 分清）**：本条针对 **TER automation-agent 调试控制面**
（agent WebSocket、`runtime.info`、selector/控件观察及 driver 输入等调试入口）。
**`scripts.execute` 作为产品运行期能力已由 `T-11` 保留，并支持运行期远端下发脚本源** ——
**它不在本条剔除范围内**，写门时不得连它一起剔掉。

TER automation-agent 只由显式的开发/验收构建输入启用；应用 package 的默认配置保持关闭。该输入不是运行时开关，也不得从业务 state、远端配置或环境变量回退推导。production bundle 仍必须通过本仓产物门证明 agent 控制面与 driver 接缝不存在；该边界不豁免其他 TR-08 调试符号。

**反例**（POC 实测）：`host-runtime-rn84/application/createApp.ts:376`
`const automation = adbSocketDebugConfig.enabled ? ... : undefined` —— **运行期分支，代码照常编进产物**。
设计文档的"Product 默认不启动"是**约定型防线**，在"有人改了初始化顺序"时无声失效。

**门**：对 production bundle 做符号扫描，automation 相关标识符零命中。
**红夹具**：把剔除开关关掉重新打包 → 门必须红。
**反例栏**：符号被压缩/重命名后扫不到 —— 需按模块入口而非标识符判定。

---

### `TR-09` · 包必须声明自己是 owner 还是 toolkit；slice 名由 moduleName 派生

⚠️ **2026-09-13 修订**：移除"owner 必须至少拥有一个 slice"（与 `P-5c` 矛盾，详见规则栏）。

**规则**：
- 每个包在 manifest 声明 `kind: 'owner' | 'toolkit'`；
- `owner` 包是它所拥有 slice 的**唯一写者**；
  ⚠️ **不再要求"owner 必须至少拥有一个 slice"**（Dexter 2026-09-13 裁定移除）。原因是它与 `P-5c` 直接矛盾：
  `tools/terminal-layering/check-static.mjs:42,55` 禁止 `ui/feature` 包 import `createSlice` 与
  `defineStateRuntimeSlice`，分母是全部 `ui/feature`（`:181`）—— **该层结构上不可能拥有 slice**。
  仓内 `ui.feature.sample-staff-auth` 与 `ui.feature.sample-member-desk` 今天就是
  `moduleKind='owner'` + `slices: []`，且全门绿。
  **`owner` 的判据改为"拥有 command / actor / slice 中至少一类,并对其负唯一写责"**；
- `toolkit` 包**不得拥有 slice**；
- 所有 slice 名**必须以本包 `moduleName` 为前缀**。

**为什么**：把"包是什么"从口头判断变成可判定；**并且它是 `TR-03` 的前提** ——
知道谁是 slice 的 owner，才能说"你在跨包读"。

**反例**（POC 实测）：切分轴错误的两端 —— 两个零消费者的包 + 一个五职责的巨包（6,903 行 / 19 actor / 7 slice），
根因是"包"这个概念没有可判定的定义。

**门**：slice 名前缀检查；`kind:'toolkit'` 却有 slice → 红；**零消费者的包报出来**。
⚠️ **"`kind:'owner'` 却零 slice → 红"这一条已随上述规则移除**，它从未被实现
（`tools/terminal-skeleton/graph-model.mjs:132-138` 只强制"有真 slice ⇒ 必须 owner"这一半）。
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
2. **根级重置（reset）默认清除各 owner 状态**：把 `undefined` 交给 combineReducers，
   **每个 owner 的 reducer 各自返回自己的初始值**。窄例外只有已接受的 D-16 `server-config`
   持久配置 slice，以及 Dexter 于 2026-10-06 批准的阶段 A `terminal-update` 持久任务 slice：
   两者都由 owner 声明 `resetIntent: 'retain'`，只保留各自 `persistence` descriptor 实际会落盘的字段与记录；
   不声明为持久化的运行期状态仍回到初始值。`terminal-update` 的例外只为 TDC 取消激活
   `TERMINAL_ACTIVATION_CANCELLED` 引发的当前生产根级 reset 保留 `currentTask`、`recentStatus`
   和 `failedArtifactIds`；同步仍为 isolated，TDC 凭证、其它 owner、orphan 键及未声明持久化的值照常清除。
   例外按已注册 slice 生效，不由 reset 发起方选择原因或扩大保留范围；当前唯一生产
   `requestApplicationReset` 调用点是 TDC 取消激活。任何新增生产调用点必须先重新评审该例外。
   state runtime 必须先 flush 当前状态，再按这组 descriptor 保留对应存储键并删除其它 namespace 键
   （包括未注册 orphan）；失败时不得派发根级 reset。不得增加第二份配置或凭证存储。
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
而 `owner` 按本规则必须真拥有 command / actor / slice 中的至少一类并对其负唯一写责
（⚠️ 2026-09-13 修订前此处写的是"必须真拥有 slice"，已随规则栏同步更正）。两者不能同时成立 ——
造一个占位 slice 去满足门，是**让包声称自己已经是 owner，而它不是**，
恰恰是本规范全篇要防的"声称 ≠ 行为"。

**规则**：
- **`plannedKind` 的唯一载体是骨架规格文件**（`apps/terminal/skeleton-graph.ts`），
  **不写在包内**。骨架期的包还没有 `application/moduleManifest.ts` ——
  那是 owner 包有了真实模块之后才有的东西，此时往包里塞一份 `plannedKind`
  就又制造了一处会漂移的陈述；
- `kind` 门**只对声明了 `kind` 的包生效** —— 没有 `kind` 的包不进入该门的分母；
- 包落下**第一个真实 owner capability**（`command` / `actor` / `slice` 任一）时，在该包 manifest 写下 `kind`，
  并从规格文件移除它的 `plannedKind`，从那一刻起受本门约束；
  ⚠️ **2026-09-13 修订**：此处原写"第一个真实 slice"，与规则栏移除 owner-zero-slice 之后不一致 ——
  `ui/feature` 层结构上不可能有 slice（`P-5c`），却可以有真实 actor，届时必须写 `kind`；
- `plannedKind` 与最终 `kind` 不一致时，**以实际 capability 归属为准**，并说明为什么设计变了。

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

### `TR-11` · 事件必须变成 command，不得以回调或 effect 列表交给业务方

**规则**：任何**外部事件**（平台/端口：电源、网络、屏幕、生命周期…）与**内部事件**
（角色切换、连接状态变化…）到达业务逻辑的路径**只有一条** ——
**事件 → command → 关心它的业务方自己的 actor → `dispatchAction`**。

**不得**导出「注册一个回调、由事件源在事件发生时调用业务方代码」的接缝；
**不得**把 `ActorExecutionContext` 或任何写能力交给这样的回调；
**不得**用 effect 列表、事件总线或事件源直接写他包 slice 来替代。

⚠️ **Dexter 2026-09-02 定为「本 TER 工程最重要的设计模式」，内部外部一律照此。**

**反例**（仓内实测，两条）：

- 🔴 `runtime` 的 `RuntimeModule.roleChangeEffects` —— 一个**回调列表**，
  把完整 `ActorExecutionContext`（含 `dispatchAction`）交给第三方 effect。
  它使 `createRequestLedgerRoleEffect.ts` 成为 `TR-01` 的一条**具名例外**；
  按本规则它应当是「角色切换发 command、关心的包定 actor 处理」，**一条例外都不需要**；
- 🔴 `display-context` 需求首版的电源路径 —— 订阅端口回调、算出一个「意图」，
  而**公开面里没有承载它的东西**：无命令、无 slice 字段、无事件。
  订阅回调算完把结果**丢在地上**，而全部门与测试仍绿。
  这是回调式设计的典型病：**算出了结论，却没有地方放**。

**为什么**：四条真实收益 ——
① 写路径回到 `TR-01` 的唯一合法路，事件处理者是普通 actor，**不需要任何 `TR-01` 例外**；
② **结果天然有承载体** —— command 本身就是；
③ 事件源**不需要知道谁关心**，N 个业务方各自定 actor，事件源零改动；
④ 每次事件进 request ledger，可 selector 观察，`automation` 的 `command.dispatch` 成为完备驱动面。

**🔴 command 的定义点**：**由能依赖 `runtime` 的那一侧定义**，通常是消费方包自己。
⚠️ 低层包**定义不了 command** —— `CommandDefinition` 住在 `runtime/src/types/command.ts`、
`defineCommand` 由 `runtime/src/index.ts` 导出，而 `platform-ports` 只依赖 `contracts`。
让端口自己定义 command 会让**最底层的包反向依赖 runtime**（22 个包里 16 个依赖 platform-ports），方向倒置。
⇒ payload 用**消费方自己的类型**，值域可抄端口的但**不 import 它**，
「端口事件 → command」的桥在订阅回调里翻译一次，**连类型依赖都不产生**。

**🔴 桥必须播种与去重**：首个事件**只播种、不派发**；同值**去重**；只有跃迁才派发 command。
播种状态的持有点**在桥，不入 slice**。
⚠️ 缺播种时，OS 在启动时投递的**当前**状态会被当成跃迁 —— POC 实测：**每次启动翻转一次屏身份**。

**门**：禁止句 —— 生产源码中不得出现「导出的注册函数接受回调形参，且该回调形参类型的成员里
含可写状态的能力」。可由 `TR-01` 的同一套 symbol-origin 分析覆盖：
**写能力符号出现在非 actor 文件的回调形参上 ⇒ 红**。
**红夹具**：新增一个 `registerXxxListener(cb: (e) => void)` 并在 `cb` 入参里放 `dispatchAction` ⇒ 门必须红。
**负控制**：`subscribeXxx` 只回传**纯数据**、桥在本包内翻译成 command ⇒ 绿。

**反例栏**：门**只抓「回调形参携带写能力」这一种形状**。
「事件源自己 import 消费方的 action creator 并写」「用字符串协议间接触发」
「把事件写进一个共享 slice 让别人轮询」——**都抓不到**，那只能靠 review。
⚠️ 「这个事件该不该有人关心」「谁该关心」同样**不可机械判定**，属 `UNENFORCEABLE_BY_MACHINE`。

---

### `TR-12` · 一个 `kernel/feature` 必须能配多套 `ui/feature`

**规则**：`kernel/feature` 与 `ui/feature` 的分工是 **1 : N**——

| 层 | 内容 | 份数 |
|---|---|---|
| `kernel/feature/<domain>` | 与后台的交互与判断、业务状态管理、信息存储 | **一份** |
| `ui/feature/<domain>-*` | 用户交互层：呈现、导航、提示 | **多份**（POS／KDS／自助机…各一套） |
| `ui/integration/*` | 按交互场景挑选组合 | 多份 |

由此三条硬约束：

1. **`kernel/feature` 对 UI 形态零假设** —— 源码中不得出现 `partKey`／`containerKey`／
   `displayMode` 字面量，`package.json` 不得依赖任何 `ui/*` 包。
   一旦出现，该 kernel 即绑死一种 UI，1 : N 失效；
2. **领域事件命令是 kernel 对外的公开契约面** —— 按结果拆成独立命令
   （`xxxSucceededCommand` / `xxxFailedCommand`），payload **只含业务事实，不含呈现意图**。
   不得用单条命令带 `boolean` 由各 actor 自行分支；
3. **`ui/feature` 必须有自己的 module 与 actor** —— 「失败了该怎么呈现」「成功后跳哪里」
   每种交互场景答案不同，只能由 UI 侧承接。`partKey` 自始至终不离开拥有它的 `ui/feature` 包。

⚠️ **Dexter 2026-09-03 定为「整个 TER 的灵魂」。** 这是这两层分开的**唯一存在理由**，
不是分层洁癖；违反它，两层就该合并。

**与 `TR-11` 的关系**：`TR-11` 规定事件必须变 command；`TR-12` 规定**这些 command 的定义方
与监听方分别是谁**。kernel 派出领域事件时**不知道谁关心**，正是 `TR-11` 收益 ③ 的兑现形式。

**反例**（sample 需求 v1 实测，作者自查发现）：

- 🔴 把导航与提示的 actor 全部写在 `kernel/feature`，于是
  `kernel/feature/sample-staff-session` 内出现 `openLayer(PRIMARY,'sample.auth.notice')`
  与 `showScreen(PRIMARY,'main','sample.auth.login')` ——
  **kernel 包硬编码了 ui 包的 `partKey`**。ui 侧改名则 kernel 静默失效，无门可抓，
  且该 kernel 再也换不了第二套登录界面；
- 🔴 用单条 `sessionEstablishedCommand{authenticated: boolean}` 代替
  `loginSucceeded` / `loginFailed` / `logoutSucceeded` 三条 ——
  每个监听方都要写 `if (authenticated)`，且 payload 混入了「该走哪条呈现分支」的意图。

**为什么**：三条真实收益 ——
① 同一业务能力换 UI **不改 kernel 一行**；
② 领域事件成为**稳定契约面**，新增 UI 只是新增监听方，事件源零改动（同 `TR-11` ③）；
③ kernel 可脱离任何 UI 单测。

**门**：禁止句两条 ——
① `kernel/feature/**` 生产源码中 `partKey` / `containerKey` / `displayMode` 字面量零命中；
② `kernel/feature/*/package.json` 的 dependencies 中 `ui/*` 包零命中。

**红夹具**：在任一 `kernel/feature` 的 actor 里加一行
`dispatchCommand(showScreenCommand, {partKey: 'x.y'})` ⇒ 门必须红。

**负控制**：`ui/feature` 的 actor 里出现 `partKey` ⇒ 绿（那是它自己的部件）；
`kernel/feature` 派出不含 partKey 的领域事件命令 ⇒ 绿。

**反例栏**：门**只抓字面量与依赖**。
「把 partKey 存进 kernel 的 slice 再读出来」「用字符串拼接构造 partKey」
「kernel 依赖一个中间常量包、由它转手 partKey」——**都抓不到**，只能靠 review。
⚠️ 「这个 kernel 是否真的能换一套 UI」属 `UNENFORCEABLE_BY_MACHINE`，由 review 判断。
**不要求以「再配一套 UI」来证明** —— 1 : N 是这两层的设计前提，不是待证命题；
门与 review 的职责是**防止耦合发生**，不是事后举证。

---

### `TR-13` · 每个 `ui/integration` 必须集成共享 admin console

**规则**：`apps/terminal/ui/integration/*` 是可运行的终端组合层，不是只展示业务画面的
测试夹具。每个 integration 包都必须把共享 `ui.base.admin-shell` 接进自己的生产 surface，
并沿用同一套 catalog 与隐藏入口：

1. 包的 `package.json` 与 `src/dependencies.ts` 必须声明 `ui.base.admin-shell`；
2. assembly 的**未过滤装配输入**（即 assembly 汇总的
   `...adminShellAssembly.parts` 与 integration parts）必须包含完整的
   `...adminShellAssembly.parts`；随后按本机形态过滤属于装配步骤，不能以过滤后的 catalog
   反推是否接入，且不得复制 admin part 或另建 registry；
3. 生产 surface 的 content frame 必须由 `AdminLauncher` 包住业务内容，使用该 surface 的
   `canvas`，从而保留现有隐藏手势、主承载显示门禁和业务子树的正常触摸；
4. integration 不得自行定义 `ADMIN_CONSOLE_*` 常量、第二个 `openLayer` 路径、覆盖层或
   输入管线；admin 身份、layer renderer 与登录/关闭行为只能从 `ui.base.admin-shell` 的
   根 public API 使用。

这不是新增业务 Journey，也不是要求每个 integration 自己实现一套管理 UI；它是所有终端
组合的基线设计不变量。`sample-console` 的 `createSampleDefinedParts` 与 `createSurface`
是仓内实例；本规则的直接反例是一个 integration 只装业务 parts、没有 admin parts 或
`AdminLauncher`，导致该终端无法完成既有 admin journey。

**验证边界**：本条不新增独立 skeleton/layering 机器门，也不把包名硬编码进工具。现有依赖
方向/声明完整性、typecheck、integration focused test 与 implementation review 必须按上述
四个形态核对；机器通过不能代替检查 catalog 是否真的可渲染或入口是否真的可达。

**为什么**：admin console 是 TER 终端的共同诊断/运行态入口。把它遗漏在某个 integration
会让同一 Android 形态、端口与 runtime 的问题无法在该终端观察，也会诱使业务包另造入口。
直接复用 `sample-console` 的单 catalog + 单 launcher 组合，是比在每个 integration 中复制
admin parts、状态或入口更小且能保持 owner 边界的方案。

**反例栏**：只在 README 或 test fixture 中声明 admin、只把 `ui.base.admin-shell` 写进
`package.json` 而不接入未过滤装配输入、只渲染 launcher 但未把 admin parts 纳入该输入，均不算
集成；它们会分别表现为运行时找不到 part、入口打开后无法渲染或仍然只有纸面依赖。

---

### `TR-14` · 单机型组件文件名必须显式标出机型

**规则（R）**：声明单一 `surfaceForm` 的 screenPart renderer，组件文件 basename 必须包含该机型
名称（`Laptop` 或 `Mobile`）；同时支持两种机型的组件不得用机型名伪装差异。当前 TER 采用
`AdminConsoleLaptop.tsx` / `AdminConsoleMobile.tsx` 这种普通 TypeScript 文件名，不依赖 Metro
把 `.laptop.tsx` 或 `.mobile.tsx` 当作平台扩展名解析。该规则只适用于组件实现文件，不改变
partKey、rendererKey 或调用方的 partKey-only API。

**仓内实例**：`apps/terminal/ui/base/admin-shell/src/parts/parts.ts` 将为同一 admin partKey
注册 laptop/mobile 两个 renderer；实现文件必须能从文件名直接看出形态。

**验证边界**：这是 review-only 规则。`tools/code-layout/cli.mjs` 的目录词表不覆盖组件文件名，
而改名并同步 import 不会改变 production 行为，不能提供有效的 production red mutation；
由 implementation review 按 part 的 `surfaceForm` 与组件文件 basename 逐项核验。不得为了本条
新增 AST 门、resolver 配置或兼容别名。

**反例栏**：一个只渲染 mobile 的组件仍叫 `AdminConsole.tsx`；或者保留普通文件与
`AdminConsole.mobile.tsx` 两套同名候选，靠 resolver 顺序决定实现。前者隐藏形态边界，后者会
让开发/构建解析差异无法从源文件判断；它们都违反本条，即使 typecheck 仍可能通过。

---

### `TR-15` · React UI 状态读取必须经过 selector-aware framework hook

**规则**：`apps/terminal/ui/**` 的生产 React UI 读取 TER runtime state，必须使用
`@catering-v2s/ui-base-render` 的 `useUiStateSelector(selector[, equalityFn])`；读取 runtime lifecycle
status 必须使用 `useRenderStatus()`。生产 UI 不得调用、重新导出或重新引入 `useRenderSnapshot`，不得直接
调用 `stateSource.getState()` / `stateSource.getStatus()`，也不得把 raw state root/source 作为业务渲染
prop 向下传递。`useRenderContext()` 的 public 返回类型不得暴露 `stateSource` / `snapshotReader`；这两个
字段只能存在于 render framework 的 private subscription accessor。`useUiStateSelector` 返回
`undefined` 只表示选择结果，不表示 runtime lifecycle 或业务空值；需要区分 runtime unavailable 与业务
选择结果为空时，必须同时读取 `useRenderStatus()`。

selector 必须是纯读函数：只能从传入的 root 计算返回值，不得 dispatch、写 store、调用 IO、读取时间或
随机数，或修改输入。跨包状态只能调用 owner 导出的 typed selector，不得按字符串 slice key 读取别人的
状态，仍受 `TR-03` 约束。

无参数 selector 应放在模块级；参数化 selector 必须使用模块级 selector factory 或 `useMemo` / `useCallback`
及其完整依赖构造。禁止用缺少依赖的 hook 把旧闭包伪装成稳定 selector；equality function 也必须稳定，或
由完整依赖构造。scalar、boolean 和 owner 已稳定的引用可直接返回；派生对象/数组或昂贵计算应由 owner
selector/Reselect 提供稳定引用，或在确有理由时传入窄的 equality function。Reselect 只缓存派生计算和
结果引用，不改变外部 store 的订阅粒度；只替换 selector 而继续订阅完整 snapshot 不满足本条。

**允许的窄例外**：render framework 内部的 `RenderContext.ts`、`RenderProvider.tsx`、
`createRenderSnapshotReader.ts`、`useUiStateSelector.ts` 与 `useRenderStatus.ts` 可以通过 private accessor
读 source/snapshot 以实现订阅；`apps/terminal/ui/base/integration-assembly` 创建 state source 并向
`RenderProvider` 注入 `stateSource` 属于 assembly→render 的基础设施接线，但不得继续传给业务组件。
专门验证订阅机制的 `ui-base-render` tests 可以选择 full root。kernel actor/foundation 的同步
`getState()` 继续遵循其 owner selector/API，不迁移成 React hook。以上例外不得成为 feature、integration
或 admin-shell 生产 UI 的调用模板。

**公共面同步**：`useRenderSnapshot` 不再是 render package public export；新增或迁移状态读取后，必须同步
package invariant、README、类型与静态边界。不得为了本条新增第二个 store、Provider、UI 层状态副本或
兼容 hook。

**反例栏**：

- 在 feature 组件里 `useRenderContext().stateSource.getState()` 或把 `stateRoot` 传给 section；
- 把 `useUiStateSelector` 换成返回完整 root，或用 `createSelector` / Reselect 但仍订阅完整 snapshot；
- 用 `useCallback([])` 捕获会变化的 `partKey` / `displayMode`，或让 selector 在执行时 dispatch；
- 用一次 `equalityFn = () => true`、漏比较一个语义字段，或在 equality 中深遍历/IO；
- 只删除 public export 而不更新 invariant、README 或直接依赖。

机器门只判定 public context 类型、旧 hook 的 import/export、明显的 admin raw state pass-through、public
export 与 direct dependency 闭包；selector 纯度、闭包依赖完整性、返回值语义和 equality 合理性必须由
focused tests 与 implementation review 判定。门不能以字符串命中或测试名称冒充这些语义。

---

### `TR-16` · 不涉及 adapter 的功能，先过 integration 的 Expo Web，再上设备跑 application，两端表现必须一致

**规则**（Dexter 2026-09-24）：被测行为不依赖 `adapter/*` 真实平台能力的功能，**未在 integration 的 Expo Web
上验证通过之前，不得到虚拟机或真机上运行 application 包**。动态验证必须按以下顺序进行：

1. **先 Web**：在承载该功能的 `apps/terminal/ui/integration/*` 包的 Expo Web 环境（包内 `web` 脚本）中，
   以当前源码字节，按批准的场景清单实际操作，观察并记录业务结果与可见形态；
2. **后设备**：Web 验证通过后，才允许构建 `apps/terminal/application/*` 的包，并在虚拟机或真机上运行；
3. **证明两端一致**：在设备上用**同一份场景清单**重跑，逐场景并列记录两端结果。两端出现差异时只有两种处置：
   说明它来自平台固有差异（如像素取整、字体渲染、系统栏）且不影响该场景的行为判据；或按缺陷修复后两端重跑。
   只有一端的结果，不能声称两端一致。

"是否涉及 adapter"以**被测行为**为准。当前 adapter 提供的是设备信息读取（`adapter/android/device`）、
双屏承载（`adapter/android/dual-screen`）与本地持久化（`adapter/android/persist-kv`）等真实平台能力；
Web 上这些能力只有端口默认实例（见 §3-A）。依赖这类能力的被测行为可以直接在设备上验证；同一批次中不涉及
adapter 的部分仍须遵守本条，**不得因为批次里有一处涉及 adapter 就整批跳过 Web**。

**仓内实例**：2026-09-24 虚拟键盘优化。键盘外框、键位、Shift、覆盖避让与交接动画全部位于 `ui/base/input` 与
`ui/base/render`，不依赖任何 adapter，却直接跳到 Android 虚拟机验证；新写的 Android runner 先后出现三类假失败，
5 次受管 run、约 3.5 小时后，19 个 IA 帧仍然一帧都没有被观察到
（`doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-execution-retrospective-review-claude.md`）。
按本条，这些帧应先在 sample-console 的 Expo Web 上看到并核对；设备阶段只需证明一致，只有"双屏各自独立"
这类依赖双屏承载的部分才直接在设备上验证。

**验证边界**：本条不新增机器门。实施计划必须写出两个阶段与共享场景清单；实施证据必须能看出 Web 验证与设备
运行针对同一份源码字节、每个功能的 Web 通过记录早于它自己的第一次设备运行，并附逐场景的两端对照；
implementation review 逐项核对。
vitest/jsdom 等 focused 测试是另一档证据，不算 Expo Web 验证。

**为什么**：Web 上改动即时生效、可以直接观察和调试；设备上每一轮都要构建、安装、启动并依赖 runner，
成本高得多，失败时也很难分清是功能问题、平台问题还是工具问题。先在 Web 把功能行为做对，设备阶段就只剩一个问题：
两端是否一致。出现差异时，Web 的结果就是对照基准，能直接把问题定位到平台层。

**反例栏**：

- 功能不涉及 adapter，却不经 Web 直接上虚拟机或真机；
- 把 vitest/jsdom 的 focused 测试当作 Expo Web 验证；
- Web 与设备跑的场景清单不同，或只在一端运行，就声称两端一致；
- 先跑设备、事后补 Web 记录，或 Web 验证用的是旧字节；
- 以"本批有一处涉及 adapter"为由整批跳过 Web；
- 把两端差异一律写成"平台差异"，不说明来源及其对行为判据的影响。

本条抓不到的：场景清单本身选得太弱，或两端都"通过"但判据不对。这两点由场景清单的独立复核与
implementation review 判定，不能因两端结果一致而默认成立。

---

### `TR-17` · TER 输入与虚拟键盘只能通过 input owner 使用

**规则**（Dexter 2026-09-24）：TER 的输入与程序虚拟键盘是 `ui/base/input` 的共享能力。业务
`feature`、`integration` 和 assembly 只声明字段与业务提交，不得各自实现键盘、避让、测量或焦点
所有权。凡新增或修改 virtual field，必须遵守下面的使用边界；不能因为某个页面暂时只有一个字段
就绕过这些边界。

1. **唯一接入与承载**：字段由实际渲染该字段的组件调用 `useInputField`，使用
   `keyboardKind: 'virtual'` 和 `KeyboardLayout`；完整 surface 由 `InputSurfaceFrame` 提供，输入
   状态由同一 `InputProvider`/field registry 管理；业务组件不得直接渲染 `VirtualKeyboard`、维护
   keyboard owner、复制 `shift`/键值状态或在卡片、字段、弹窗里另挂键盘。一个 surface 同时只能有
   一个 virtual keyboard owner。
2. **滚动与 native-less 锚点**：字段如果位于可滚动内容中，调用 hook 的组件本身必须是对应
   `InputScrollArea` 的 React 后代；不得由父组件在滚动区外创建 hook 后再把 `inputProps` 传进去。
   `nativeLess` 字段的 `visibleAnchorRef` 必须接到实际承载可见交互的 Pressable/native 节点，不能
   用卡片、固定坐标或历史 POC 坐标冒充焦点框。
3. **覆盖模型，不改业务布局盒**：键盘是完整 surface 上方的全宽、四角直角 bottom overlay，不
   进入普通 flex 流，不得使用 `KeyboardAvoidingView`、缩短内容高度、把“提交”等业务控件挤到键盘
   上方，或在 feature 内自行改变键盘位置。非键盘内容的避让只由 input 的 presentation offset 与
   `InputScrollArea` 内部滚动共同完成；固定的遮罩、弹窗和不可移动层不能随业务内容一起平移。
4. **几何测量一次且在正确边界内**：普通字段与视口使用 `measureLayout` 相对未平移的
   `InputSurfaceFrame` root；滚动区字段相对 scroll content 测量，再与 viewport 的 root-local
   矩形和真实 `onScroll` offset 合成。presentation offset 只在求当前可见矩形时加一次；禁止
   `measureInWindow`、`Dimensions.get('window')`、物理像素或另一块屏推断 surface 几何。测量代数不能
   跨越 ScrollView 边界。
5. **布局和编辑语义只有一个目录正本**：四种布局 `full`、`alpha`、`numeric`、`financial` 的
   键位、行列、稳定 keyId 和 label/value 映射只维护在
   `apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts`。业务包不得另写键位数组或
   “相似键盘”。`full` 与 `alpha` 的动作位置保持一致：Shift 在 `a` 左侧、Space 在 `z` 左侧；
   不提供 CAPS、caps lock 或长按状态。Shift 是当前字段当前焦点会话的一次性 modifier，只在字符或
   空格真正成功插入后消费；被 `maxLength` 拒绝的零字符输入不消费。`full` 的 Shift 数字层只提供
   `: / . ? & = - _ % +` 十项，并且可见 label 必须等于实际插入值。`numeric`/`financial` 的
   业务语义不因 full 的 URL 层而改变。
6. **焦点、交接与生命周期**：业务只调用 field result/controller 的 focus、blur、complete 等
   既有入口；不得直接改 `activeFieldId`、owner、blocked focus 或通过 native blur 猜测虚拟 owner。
   keyboard 的“可编辑 owner”与“呈现生命周期”是两件事：首开、测量、进入、显示、交接、退出期间
   覆盖层不得因 owner 暂时为 `none` 而提前卸载，键盘区域必须继续拦截点按；动画完成、目标重新预检
   且焦点仍有效后，才提交新的可编辑目标或卸载呈现层。
7. **动画与性能**：每个 surface 只允许一个 presentation progress 驱动键盘与内容位移；不在
   每个字段、每个键或业务 feature 内另建动画时钟、全局键盘状态副本或逐字符测量。焦点进入、键盘
   高度变化和字段切换只触发必要的一次测量/最小滚动；既有 registry、快照、selection、owner
   和失败恢复语义必须保持。
8. **验证顺序与证据**：先在承载行为的 `ui/integration/*` Expo Web 入口按同一场景清单验证，
   再运行 `application/*` 设备入口；遵守 `TR-16`，不得用 typecheck、jsdom 或键盘 testID 存在冒充
   Web/Android 画面通过。视觉或交互结论必须检查实际键帽形态、label/value、命中、焦点框、遮罩、
   滚动和布局盒，而不是只检查节点存在。
9. **公共面同步**：触及 input 的 public type、hook、context、layout 或 renderer 时，必须按同一
   变更同步包 README、`src/index.ts`、`terminal-invariants.json` 与对应 focused/组件测试；不以
   业务包的临时 re-export 或新增依赖绕过 input owner。

**反例栏**：

- 在 feature 中直接 `<VirtualKeyboard />`，或为 laptop/mobile、sample-console/sample-wallpaper-console
  各自复制一份键位、宽度、避让和焦点状态；
- 用 `KeyboardAvoidingView`、flex 高度收缩、`Dimensions.get('window')` 或全局 window 位置让“提交”
  等业务控件让位；
- 父组件在 `InputScrollArea` 外调用 `useInputField`，再把 `inputProps` 传给滚动区内的输入节点；
- 用 `measureInWindow`、卡片 ref、固定坐标或扣两次 presentation offset 测量普通字段/PIN；
- 给 alpha/full 保留 CAPS、caps lock、长按大写，或把 URL 符号显示成字符却实际插入数字；
- 只因 `owner` 变为 `none` 就卸载 handoff/exit 键盘，或让键盘区域点按穿透到下面的业务 UI；
- 只跑 focused/typecheck 或只看 testID 就跳过 integration Web，直接把设备结果写成虚拟键盘通过。

**本条依赖的当前正本**：使用示例、field/scroll ancestor 和公共面边界见
`apps/terminal/ui/base/input/README.md`；键位目录见
`apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts`；测量、覆盖与呈现 owner 的实现
见 `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`、`InputProvider.tsx`、
`InputScrollArea.tsx` 与 `InputKeyboard.tsx`。本条只规定 TER 的长期使用边界，具体批次的字段分母、
IA、交互设计和授权仍以对应需求与详设为准。

---

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
（主机内容 / 副机本地交互上下文），**不是"哪块屏"**，两块屏共享它，从全局读**是正确的**。
副机本地交互不表示独立终端资格；配对副机的产品边界见 §4-E。

### 4-B · 导航选中态只读 UI runtime，不在业务 slice 里复制

**规则**：页面 / Tab / 面板"当前选中的是哪个 screen"的事实源统一是 UI runtime 的 `screen` slice。
业务 slice **不得**新增 `selectedTab` / `currentPage` / `activeScreen` 这类导航镜像状态。

**为什么**：这是"崩溃/被关闭后重启能恢复原状"能成立的机制性原因 ——
**当前在哪一页只有一个真相源**。有第二份镜像，恢复就会出现"页面对了但 tab 不对"。

### 4-C · 自动化语义注册下沉到控件层（加法改减法）

**术语与规则**：本文称其为**界面自动化定位标识**（`TestId`），用于 UI 自动化定位节点或读取该节点的断言状态。`TestId` 由 primitives 的 `createTestId` 构造器生成，并沿项目拥有的 props、常量与转发路径保持强类型。静态门逐个检查生产 TSX 的 `testID`/`testId` 属性，拒绝字面量、普通 string 与构造器外 cast。只给自动化需要交互/定位，或需要读取几何/可见状态作为断言对象的节点提供 testID；纯装饰、静态且不参与自动化断言的 Primitive 不增加 testID。

输入控件和虚拟键盘由 `ui/base/input` 提供实际可交互节点，沿同一 `TestId` 注册/查询路径供 driver 使用。driver 通过已注册节点和 bounds 进行实际 Web/Android 输入；它不需要第二套虚拟键盘身份、独立 surface 注册机制或手写语义 ID。surface 与 display index 是查询/动作参数，不拼进 testID。

---

### 4-D · feature 端按 workspace 的 slice 写入归属

**正式写入归属规则（Dexter）**：`MAIN` 只能主机的 actor 执行 command 写入 slice。`BRANCH` 只能
副机的 actor 执行 command 写入 slice。

这条规则是唯一的写入 owner 判定：`MAIN ↔ MASTER`、`BRANCH ↔ SLAVE`。投影方向由它自然导出：
`MAIN` 由主机向副机下行，`BRANCH` 由副机向主机上行；投影接收侧只能应用 owner 已写入的 state，
不能把投影当成本地业务 command 再执行一次。

1. **副屏由主机 state 驱动**：单机双屏使用共享 store；双机双屏使用 workspace descriptor 已声明
   的 `MAIN → SLAVE` 投影。副屏用户操作回到主机，由主机 actor 执行业务 command 并写 `MAIN`。
   副机不得仅因拓扑事件在本地猜测、重放或另写一份副屏业务事实。
2. **副机切到主屏后走 `BRANCH`**：`SLAVE + PRIMARY` 的 UI 由 `BRANCH` workspace 驱动，command
   由副机 actor 本地处理；对应投影方向是 `BRANCH → MASTER`。这里的本地处理是 BRANCH 内容/交互
   写入，不产生独立终端或主机业务事实写权。共享业务事实经其 owner 的具名 command 路由处理，
   不得以通用 `peer-intent` 冒充该业务 owner 路由。feature 不支持该分支时，必须显式
   提供不可用/找不到页的 catalog 结果，不得静默读取 `MAIN`、把全部操作发回 peer，或以空白内容伪装支持。
3. **写入门必须在公共 content write seam 判定**：凡由 content actor 写 slice 的路径，都必须同时
   具备 workspace 与执行方 `instanceMode`，并在 `MAIN/MASTER`、`BRANCH/SLAVE` 不匹配时 fail closed。
   这条门覆盖所有 feature，不以逐 feature 的人工约定替代。
   `resolveWorkspace`回答本机当前渲染哪个 workspace，刻意允许 `SLAVE + VICE → MAIN`；
   `workspaceOwnedByInstanceMode`回答执行方可写哪个 workspace，`SLAVE` 始终只拥有 `BRANCH`。
   两者不是同义函数，禁止用渲染 workspace 代替写入 owner 判定。
4. **物理屏数 helper 不等于拓扑资格**：只表达本机物理屏数的 helper 继续保持物理语义，不能用它
   代替“主机已配对副机”的拓扑资格；需要拓扑资格时统一使用 topology 事实与操作级 evaluator。

**最小反例**：主机已配对但本机只有一块物理屏时，主机把 `showScreen(SECONDARY)` 直接发给副机，
由副机 actor 写自己的 `MAIN`；或者副机收到拓扑恢复事件后自行重放 secondary placement；或者副机
处于 `PRIMARY/BRANCH` 时仍使用 `peer-intent`。这些写法都违反同一条 workspace 写入归属规则。

**证据要求**：实现或 review 必须证明：(a) 单机双屏中 `MAIN` 由主机 actor 写入并驱动 secondary；
(b) 双机中 `MAIN` 由主机写入，经 descriptor 投影驱动副机 secondary，副屏操作回传主机；
(c) 副机 `PRIMARY/BRANCH` 的 UI 与 command 本地闭环，且 `BRANCH` 写入者是副机 actor。上述
语义不能用路径/字符串门冒充，必须有公共 write-seam 门与 focused 行为证据。

---

### 4-E · 终端界面场景统一术语

**来源**：Dexter 2026-10-02「终端激活交互与双机拓扑优化专项」的界面场景定义。
本节确认术语、当前源码映射及下述补充裁决，不授权新业务实现；未明确的专项细节仍留在需求讨论中。

终端机型 `surfaceForm` 分为 `mobile` 与 `laptop`；laptop 的部署场景分为单机单屏、单机双屏、
双机双屏。一种机型可以用于多种部署场景，禁止把屏幕数量或设备数量当成新的 `surfaceForm`。

| 界面内容简称 | 使用场景 | 内容归属与显示模式（讨论中的说法） | 当前内容地址 | 实际承载设备 `instanceMode` |
| --- | --- | --- | --- | --- |
| MMP | mobile 主界面 | master + primary | `MAIN / PRIMARY` | `MASTER` |
| LMP | laptop 单机主屏，或已配对双机的主机屏幕 | master + primary | `MAIN / PRIMARY` | `MASTER` |
| LMS | laptop 单机的副屏 | master + secondary | `MAIN / SECONDARY` | `MASTER` |
| LMS | 已配对双机中处于副屏角色的副机屏幕（接外部电源的目标场景） | master + secondary | 主机拥有的 `MAIN / SECONDARY` 投影 | `SLAVE`，`displayRole=VICE` |
| LSP | 已配对双机中处于主屏显示角色的副机屏幕（电池供电的目标场景） | slave + primary | `BRANCH / PRIMARY` | `SLAVE`，`displayRole=CHIEF` |

MMP/LMP/LMS/LSP 称呼的是**屏幕内容场景**，不是新的持久化状态、连接身份或拓扑实例枚举。
以上「master/slave」描述内容归属；源码的 `instanceMode` 描述实际设备实例角色，两者不得混写。
双机 LMS 由主机 actor 写入内容，再投影到副机；不能为了匹配简称，把副机实际角色改成 `MASTER`，
也不能把其 renderer 的实例资格只声明成 `MASTER` 而排除 `SLAVE`。

当前 ui-state 通过 workspace、displayMode 与 containerKey 定位内容，catalog 另检查 surfaceForm 与
instanceMode；不存在名为「master + primary」的独立 ui-state 枚举。LMP 与 MMP 的内容地址相同，
由机型选择不同 renderer；单机 LMS 与双机 LMS 使用同一内容语义，但承载实例不同。

**供电与未配对边界**：`external` 是接外部电源，不要求电池此刻正在充电；`battery` 是电池供电。
当前 display-context 在供电变化时请求确认，再切换 CHIEF/VICE；Dexter 在本专项讨论中确认沿用该确认步骤。
确认前、供电未知时仍以已生效角色
判定内容，不能仅凭充电图标声称已经变成 LMS/LSP。
未配对副机、配对链路断开、角色切换中的用户行为必须在各专项中显式说明，不能从本表推导独立激活、
离线写入或自动提升为主机。

**主副机与激活准入（Dexter 2026-10-02 补充裁决）**：副机配对后只能作为主机的扩展，本身不作为
独立终端。LSP 的独立页面、录入过程和本地 BRANCH UI 不改变这个产品身份；共享业务事实仍由主机 owner
承接，不从副机 UI 的本地写权推导独立终端认证身份、TDS 会话或断链提交/合并能力。
店员上下文属于具体业务准入，不能仅由「扩展」一词推定；Dexter 已在本专项单独裁定两个 sample
integration 的 LSP 沿用主机店员资格，主机登出后退出业务并显示登录提示，不传播店员口令。
副机不能独立连接 TDS，不能是本机激活态；
一台机器连接了 TDS，就不能作为副机。主机激活信息的同步投影不代表副机自身已激活。
已激活但暂时断连同样不能被当成副机，不能用「socket 当前没连上」绕过激活限制；只停止连接不等于取消激活。
配对、切换实例角色、启动恢复和激活/建连命令都必须尊重这同一边界，不能只在管理台隐藏按钮。
副机在 CHIEF/PRIMARY 下显示 LSP 时仍是 `SLAVE`，不因显示主屏内容取得独立激活或 TDS 建连资格。
本条是后续专项实现的判据；当前已存在的 client/topology 源码尚不据此声称完成准入集成。

**配对副机断链的业务与管理边界（同次专项补充裁决）**：两个 sample integration 统一控制业务准入。
已配对副机断链后，不论 LMS/LSP 当前业务页面或业务弹层，都显示「配对连接中，请稍后」并阻断业务输入
和命令；本地壁纸操作也不例外。左上角 admin 入口、管理员认证与输入、取消配对/切换配对地址仍须本机
可用。不能将业务遮罩放在 admin 上方，也不能全局禁用 dispatcher/输入而关闭恢复通道。
主机投影的 MAIN 内容与副机本地管理控制面是不同归属；不得为了离线打开 admin 放宽 SLAVE 对 MAIN
业务 UI 的写权。退配/换地址中间的角色变化不是操作完成，失败仍保留可见恢复入口与业务阻断。
恢复业务之前，必须依据本连接最新主机激活/店员及所需业务投影重新判定，不能把 peer accepted 或旧缓存
当作准入；不引入离线业务队列、自动升主或第二套重连框架。
原始裁决与 state/command 静态盘点见
`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md`
§9.5/§10。后续 review 同时核验 LMS 与 LSP、业务确认层、输入焦点、local admin open/close 和退配异步窗口；
当前新增遮罩、LMS 本地 admin 控制面及业务准入尚未实现，不能据本节宣称功能 PASS。

**源码核对入口**：`kernel/base/display-context/src/foundations/displayDerivation.ts` 的
`resolveSurfaceDisplayMode` / `resolveWorkspace`，`ui/base/render/src/foundations/createCatalogContext.ts`，
以及 `kernel/base/ui-state/src/foundations/workspaceOwnership.ts`；路径均相对 `apps/terminal/`。
内容写入 owner 仍按 §4-D，命令的 surface 定位仍按 §4-A。

**反例与评审边界**：将所有 SECONDARY 都称为「第二台机器」、把 SLAVE+VICE 的 LMS 当作 LSP、
将 laptop 按三种拓扑扩成三个设备类型，或复制 MMP/LMP/LMS/LSP 成新的导航真相，都不符合本定义。
这组术语由文档/实现评审逐项对照实际 catalog、内容 owner 与 surface 判定，不新增关键词机器门；
简称一致不能证明页面可渲染、供电切换成功或同步闭环。

---

### 4-F · 终端与服务器长连接统一术语

**来源**：Dexter 2026-10-03「TDP 数据变化通知与远程运维」需求讨论中的直接命名裁决。
术语自本节生效；B/C 的业务范围和实现方式仍待需求确认，不因命名生效而获得实施授权。

| 简称 | 全称或含义 | 仓内位置 / 组成 |
| --- | --- | --- |
| CBS | Catering Business Server，业务后台服务 | `apps/backend/catering-business-server` |
| TDP | Terminal Data Platform，终端与服务器长连接通信能力的整体 | TDS + TDC |
| TDS | Terminal Data Server，服务器侧长连接服务 | `apps/backend/terminal-data-server` |
| TDC | Terminal Data Client，终端侧长连接 client | `apps/terminal/kernel/base/terminal-data-client` |

TDP 的目的分为 A：服务器和终端知道对方在线情况；B：服务器数据变化通知终端；
C：服务器向终端下发远程指令并取得执行结果，主要用于运维。A 的既有实现与 B/C 的待建能力
必须分别报告，不能由连接 ready 推导数据通知或远程指令已可用。

不得把 TDP 当成新增 deployable、目录、业务 owner、业务数据库或消息中间件；CBS 各业务 owner
仍拥有业务事实，TDS 负责服务器侧协议与会话路由，TDC 负责终端侧协议基础服务，feature
负责自己的业务数据、持久化与使用。新增 B/C 能力的具体责任和准入以之后获批的需求、设计为准。
TER 业务指令仍走 command，数据与状态读取仍走 selector，不因跨网络另造业务入口。

**TDP 主副机数据归属（Dexter 2026-10-03）**：TDC 的 ready/topic 广播只在主机，副机不连接 TDS。
主机 feature 负责订阅和取得业务数据，业务数据从主机同步到副机；副机读取同步投影，不另建 TDP
订阅或独立刷新同一份数据。该规则限定业务数据来源，不改变已批准的副机本地 UI、输入草稿或
壁纸偏好归属；同步仍复用现有 owner 能力，不引入第二套广播或状态协议。本条是需求裁决，
不据此声称新增 topic 同步已经实现。

**topic 初始时间与更新接受确认（Dexter 2026-10-03 最新修正）**：首次 HTTP 成功后由 feature
计算 topic 初始时间，使用业务记录原始更新时间，结果集取成员最大值、空结果集取0。以后收到
TDC 的 topic 更新广播，feature 刷新并保存成功后用 command 确认该更新已接受；TDC 将对应
服务端通知时间作为 topic 本地时间，不用 feature 再次计算的时间覆盖。例如首次空集合0、
服务端通知100、重新读取仍空，成功确认后 TDC 记100；不把100伪写成业务记录原始时间。
确认必须关联具体通知和有效身份，旧通知的确认不能顺带确认后来未处理的更新；失败不确认成功。
多个 feature 允许订阅同一 topic，各自刷新/确认，不再建设此前的跨包时间冲突 WARN/覆盖规则，
不建立跨包版本仲裁。退订一包不解除其他包；一包确认不证明所有包业务数据已成功刷新。
一包刷新失败由该feature自己处理，不上升为TDP统一恢复/重试机制。在线真实数据变化即使
时间同值也通知当前订阅者；初次/重连按不相等核对，接受同值漏通知无法全部发现的限制。
CBS范围缓存持久保存完整topic身份、collectionHash与topic时间到PostgreSQL，不保存refIds或额外memberCount，
不能用纯内存缓存替代。collectionHash由完整去重refIds经固定排序/无歧义编码生成，空集合有固定摘要；
只判断成员变化，不包含正文/更新时间，不替代topic时间。空集合摘要与已保存A重启后保留，
无缓存记录不同于已有空集合；HTTP仍返回真实完整业务数据，feature按自己的slice管理成员差量。
该规则不授权已有源码修改，具体 command/selector、重连与 HTTP 初始化链见本期需求。

**topic订阅对象与范围隔离（Dexter 2026-10-03）**：feature经TDC公开command指定生成的
`topicKey + ownerRef`，例如项目详情/项目ID、有效合同集合/门店ID；ownerRef不是feature或后台模块名。
有限条件由contract的topicKey定义；集团空间和合法关联范围由当前绑定/会话及服务端owner事实核验，
内部完整身份仍含范围，不以裸UUID或客户端声明替代授权。A店变化不更新/通知B店集合实例。
对象身份之外，首次登记仍带初始topic时间，接受确认仍关联具体通知，多包订退仍保留各自归属。
实际字段/生成值在详设和contract闭合；本条不新增第二业务入口，也不声称协议已经实现。

**TDP组织引用链补齐（Dexter 2026-10-03）**：本期按正式需求R-11.1补齐CBS的
REGION必填商业集团parentId，TER沿Store.projectId→PROJECT.parentId→REGION.parentId读取真实引用，
不另建客户端按集团空间发现集团的平行规则。空间隔离/关系核验仍由CBS owner负责，
当前旧源码的REGION空父引用不构成目标实现；源码、契约、已有数据及验证的具体边界回读正式需求，
本条不授权立即实施或动态运行。

**使用TDC的业务feature加载与刷新（长期约束，Dexter 2026-10-03）**：适用于本期store-basic及
后续所有TDC业务消费者。feature按业务任务组织自己的slice，业务数据与topic不要求一一对应；
一个列表或组合查询可以同时支持范围topic与多个精确topic。TDC只拥有订阅/通知关联及协议时间，
不解释列表正文，不为每个topic复制业务数据，也不替feature决定业务HTTP查询。

1. 初始加载优先复用本次HTTP已返回的完整业务数据。以store-basic为例，一个查询取得当前门店
   全部ACTIVE合同的完整资料及原始时间，先经本包command/actor保存、持久化合同列表，再登记
   合同范围及各成员详情topic。不得因登记多个详情topic就逐个重复调用已被集合响应覆盖的详情接口。
2. 范围通知仍要查询最新完整结果。feature与本slice旧数据按稳定业务ref比较成员和已返回内容，
   先更新、持久化本地，再经TDC公开command新增/解除本包详情订阅；保留成员不重复退订重订。
   新增或保留成员的所需详情已由响应完整覆盖时直接复用；响应只有ref或摘要时，只补取必要缺失详情，
   不把摘要当完整详情。不能为了减少HTTP调用省略必要业务字段或真实刷新。
3. 对仍有效订阅的单个实体详情通知，调用该实体详情HTTP接口，更新同一份slice业务数据，
   不因列表中已经有该实体而跳过，也不为一次详情变化默认重拉整个列表；响应显示成员已退出范围时，
   本包相应更新成员及订阅，不把失效对象重新插回当前列表。已退订/旧身份的迟到结果仍须隔离。
4. 数据应用和持久化完成后，仍按本节既有具体通知关联确认更新已接受；首次时间与后续服务端通知
   时间的分工不变。集合业务数据、成员原始时间、范围通知时间分别保持各自含义。HTTP/持久化或
   订阅调整失败须可观察，不能伪称对应动作成功，不因局部详情失败回滚已正确应用的范围。
5. 刷新、数据提交、订退与确认仍由command驱动，读取走selector；同包复用已有刷新链，主机
   保存并同步业务数据给副机。不得为这一要求建设TDC业务缓存、跨feature统一刷新/恢复或第二事件机制。

评审核验：初始完整集合一次读取后可登记多个topic；集合由{A,B}变{A,C}时更新同一列表、只退B/订C，
完整返回C时不另查C；A详情通知仍查询单个A。摘要/部分详情不足、迟到B、查询失败、订退失败及
集合/详情交错是必须覆盖的反例。业务正确性优先于调用数量；本条不设全业务HTTP次数硬预算，
不声明现有接口已具备完整terminal合同读取能力，也不授权源码实施或动态运行。

**feature业务前提与成功command（Dexter 2026-10-03启动顺序修正）**：feature有明确获批的
上游业务前提时，须等待该owner取得、应用并持久保存对应数据后广播成功command，再由本包actor
发起查询；激活或TDC ready不等于上游业务数据ready。成功事实由上游owning feature定义并广播，
读取其数据/本次加载状态只走公开selector，不复制该包事实、不另建回调或统一启动调度框架。

本期（Dexter 2026-10-04合并裁决）：只新增store-basic一个feature，门店/组织/规则/合同及区域/服务点
十一类topic的业务数据均由本包拥有；不另建store-service-point包。门店基础信息成功取得、应用并
持久化后，经同包command启动服务点查询；门店成功command按正式需求广播，但不要求跨feature启动桥接。
只依赖本次当前绑定的门店基础信息成功，不等待其他组织/规则/合同查询，不因服务点失败回滚门店成功。
重启或晚安装store-basic仍先完成本次门店加载，初始化command通过本包selector核验当前前提；
不能用旧缓存或TDC ready代替。同一本次启动及当前绑定周期内重复command不重复初始化；应用重启
不能沿用旧成功标记跳过本次加载，仅TDC连接重连也不重置已接受时间。后续topic刷新不重做无关数据全量。
换绑定/取消激活使旧前提失效，迟到响应不能污染新门店；包内职责和局部加载/失败状态仍须清晰。
评审核验覆盖前提未满足零服务点查询、成功后启动、门店/服务点分别失败、其他资料未完成、ready交错、
重启/晚安装、重复command及旧绑定反例。上述跨feature通用规则仅在实际获批跨包依赖时适用，
不因本期合并删除后续消费者的command/selector边界，也不为包内顺序新增统一调度/恢复框架。
当前仍是需求/规范，不声称新包已实现或授予动态运行授权。

**数据同步验收边界（Dexter 2026-10-03）**：本期TDP B及store-basic只建设、
测试数据取得、变化通知、刷新、持久化、topic订退与主副同步，不新增TER根据门店停用、规则、合同
或点位状态作出的业务处理。门店停用应同步真实DISABLED字段，不因此要求TER新增登出、停机、
业务阻断或取消激活；集合谓词和成员差量属于同步正确性，不能省略。CBS既有状态约束/鉴权及
已批准会话处理不因测试范围改变，C远程操作验收也不取消。
本期DEV管理后台真实修改→TER的数据同步最低场景，回读正式需求§7.1；详设必须包含且不限于该清单，
逐项固定真实输入、公开selector/持久化/主副数据断言与cleanup，不用mock、直接改库、写slice或
手动广播代替真实链路。使用已有后台不等于新增前台功能，DEV证明不冒称L2/UAT；后续新增业务联动
按其另行批准需求验收，不把本期边界升级为业务feature永久不能有业务逻辑。

**远程 command 与记录归属（Dexter 2026-10-03）**：仅在线执行、无离线补发，超时/断链允许
执行结果未知。CBS 计划新增 terminal-control 纯能力 owner，持久化发送记录、执行过程和执行结果，
后续供其他业务模块通过公开 API 集成；本期不涉及前台管理或权限模型。持久化使用现有 PostgreSQL
owner 边界，不把记录当离线执行队列，不写 Doris，也不把 TER 内存 request ledger 或日志当作
持久记录。终端也持久保存远程执行过程与结果，重连后补报；TDC负责终端记录与回传基础服务，
TDS负责转发/关联，沿用现有终端鉴权与真实绑定/session。不将整个runtime ledger改成持久化。
补报既有执行事实不能重新执行command；CBS持久接收确认与终端补报关联需幂等，
未收到的过程如实保留未知，不推导未执行/回滚；具体阶段、schema和保存策略见本期需求与后续详设。
本条是需求边界，不表示 owner 或持久化链已经实现，也不授予源码/动态运行授权。

**旧措辞边界**：旧文档中的「不引入 TDP」「TDS 不是 TDP」及 newPOSv1 的 Terminal Data Plane
是旧阶段/旧方案语境；本次仅以 Terminal Data Platform 统一整体称呼，不启用旧 placeholder、
projection 仓库、MQ、通用 outbox、持久消息队列或常态轮询，也不改写冻结历史。

**评审反例**：把 CBS 业务数据存入 TDC 成为第二事实 owner；把任意 socket open 称为业务 ready；
把副机拓扑 peer 当成 TDS；或以新术语推导 B/C 已授权实施，均不符合本定义。
本节通过文档/源码 review 核对真实 owner 与协议，不新增缩写关键词门。

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

---

## 7 · 2026-09-07 可读性整改规则

### 7.1 `src/` 目录词表

`apps/terminal/**/src/` 的根目录只能按需使用以下闭合词表；需要表外目录时，必须先修改本节并说明
为什么现有词不能承接。根下仍保留三个法定文件：`index.ts`、`moduleName.ts`、`dependencies.ts`。

| 目录 | 装什么 | 明确不装什么 |
|---|---|---|
| `types/` | 只有 `type`/`interface`/类型级常量，零运行时值 | 任何有运行时行为的东西 |
| `foundations/` | 纯函数与纯工厂；共享注册表与无副作用基础设施 | store、网络、平台 API、有副作用的东西、React |
| `implementations/` | 已声明端口的真实实现，可触达平台 API | 端口以外的业务逻辑 |
| `features/` | command 驱动的业务单元；固定子目录 `actors/`、`commands/`、`slices/`、`variables/` | 纯函数、React |
| `selectors/` | 跨包读的唯一入口（状态读取与派生 selector） | 写操作 |
| `application/` | 包的组装与入口：module descriptor、runtime 工厂 | 业务逻辑 |
| `components/` | React 组件，以及直接产出 `ReactNode` 的渲染函数 | 不产出 `ReactNode` 的东西 |
| `hooks/` | React hooks；一文件一 hook，`useX` 命名 | 非 hook |
| `contexts/` | React context 定义及其 Provider | 消费 context 的业务组件 |
| `defaults/` | 已声明端口的默认/不可用实现 | 真实实现、普通配置 |
| `parts/` | part 声明（`definePart` 的产物） | 组件实现、renderer |
| `assembly/` | 装配：把 module、catalog、surface 拼起来 | 业务逻辑 |
| `theme/` | 设计 token | 组件 |
| `vendor/` | 外部代码的仓内拷贝，原样保留不改写 | 自己写的代码 |
| `generated/` | 仓内生成器的输出；必须能追溯到唯一生产者与输入 | 手工维护的业务逻辑 |
| `testing/` | 把生产设施暴露给测试的逃生口 | 测试本身（去 `test/`）、生产逻辑 |

`features/` 的直接子目录只允许 `actors/`、`commands/`、`slices/`、`variables/`；更深层目录由所属
feature 自己组织，不由本条目录词表递归猜测职责。`testing/` 不得从生产 `src/index.ts` 公开导出，且
不得进入生产 import graph。

### 7.2 规则档位

`L` 表示可由确定的 AST、路径或 import graph checker 判定；`R` 表示必须由评审读取职责、反例与
行为 oracle 判定，不得用关键词或正则把语义伪装成机器门。每条规则都保留一个仓内实例与一个可使
对应判定变红的反例。

### `TR-R01` · 单元按职责拆分

**规则（R）**：单元不得承担多个变更理由；拆分轴是职责，不是冻结的行数阈值。

**仓内实例**：dispatcher、persistence engine 与 `InputProvider` 各自存在相互独立的变更理由，需在
拆分前建立职责到 behavior oracle 的对照表。

**反例栏**：把已拆开的两个职责合回同一个函数、类或组件，且移除其中一个职责的独立 oracle；此
语义不能由本节的机器 checker 代替，必须由 review 判定。

### `TR-R02` · export 必须靠近定义

**规则（L）**：禁止文件中的本地 `export { ... }` 汇总块；定义处的 `export const/function/class` 才是
公开声明位置。带 `from` 的 re-export 仅允许作为显式模块边界。

**仓内实例**：当前有 33 个文件在文件末尾维护本地 export 汇总块。

**反例栏**：在非 `index.ts` 文件中加入 `export {value}`；AST checker 必须报告该文件与行号。

### `TR-R03` · 业务组件不直接调用 createElement

**规则（L）**：`apps/terminal/**/src/**` 中业务组件不得调用 React `createElement`。唯一明示例外是
`apps/terminal/ui/base/render/src/components/resolvePart.ts`，因为它是动态 part renderer 且直接产出
ReactNode；新增例外必须先修改本节。

**仓内实例**：四个生产渲染文件存在该调用，其中只有上述 renderer 具备例外理由。

**反例栏**：在 allowlist 之外通过 named import、别名或 `React.createElement` 调用它；TypeChecker/AST
checker 必须报告调用点。

### `TR-R04` · 函数参数不超过三个

**规则（L）**：有执行体的函数、方法、构造器与 accessor 的位置参数超过 3 个时，必须改为对象参数或
另一个有明确职责的单元。解构参数与 rest 参数各按一个位置参数计算。

**仓内实例**：现有源码中有 7 个四参数执行单元。

**反例栏**：新增 `function f(a, b, c, d) {}`；checker 必须按 AST 参数个数报告。

### `TR-R05` · 控制嵌套不超过三层

**规则（L）**：每个 function-like 单元内，`if`、`for`（含 in/of）、`while`、`switch`、`try` 的词法
控制嵌套深度不得超过 3。`case`、`catch`、`finally` 不额外加层；三元、conditional、`&&`、`||`、
`??` 不计；进入嵌套函数时重新从 0 计算。

**仓内实例**：现有源码中有 22 个控制深度超过 3 的 function-like 单元。

**反例栏**：构造四层 `if`/`for`/`while`/`try` 控制嵌套；AST visitor 必须报告最深层与所属单元，不能用
调用次数、源码字符串或 lint 文本作为唯一证明。

### `TR-R06` · source 根与 features 直接子目录必须闭合

**规则（L）**：逐 package 枚举 `src/` 根 direct children；根文件只允许三个法定文件，根目录必须来自
本节 15 项词表。若存在 `src/features/`，其 direct children 目录只允许 `actors`、`commands`、`slices`、
`variables`；`features/` 更深层目录不由本条约束。

**仓内实例**：35 个散文件与 3 个旧目录名需要归位。

**反例栏**：在根增加 `misc.ts`、`src/unknown/` 或 `src/features/misc/`；路径 checker 必须分别报告。

### `TR-R07` · testing 不得进入生产 import graph

**规则（L）**：从每个 package 的生产 `src/index.ts` 解析 runtime value import/export graph；同 package 的
`src/testing/**` 不得可达。`import type` 与 type-only export 只解析语法、不计 runtime reachability；
生产与测试可以共享 `foundations/` 中同一个 registry。包内测试可深路径进入 `src/testing/`，跨包测试只能
走 package 的 `./testing` 子路径；测试入口不作为生产 entry。

**仓内实例**：`kernel/base/runtime` 的生产 `createRuntime` 曾从 `src/testing` 引入注册函数，需把共享
registry 与注册函数移入 `foundations/`。

**反例栏**：生产 entry 直接 import `src/testing/startupDiagnostics.ts`，即便该文件没有任何
`startup.` 字面量，graph checker 仍必须变红。
