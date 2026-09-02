# TER kernel 重复造轮子 · 整改报告

| 项 | 值 |
|---|---|
| 性质 | 整改报告(问题 + 建议)。是否执行、执行顺序由 Dexter 裁定 |
| 作者 | Claude |
| 日期 | 2026-09-02 |
| 过程 | 五路并行静态扫描 → 三轮自查 → **两轮独立盲审反驳** → 全文重写(见 §9) |
| 范围 | `apps/terminal/kernel/base/{contracts,platform-ports,state,runtime,display-context}/src`,合计 **9788 行**(其余四个 kernel 包各 11-12 行桩 ⇒ 覆盖 kernel 源码 99.5%) |
| 方法 | 全程只读静态阅读。**未执行任何 install / build / test** |
| 证据分级 | `✅` = 我本人打开源码核过;`○` = 子代理结论,我未逐条复核 |

> ⚠️ **本文为第三版,前两版已作废。** 前两版的错误与成因记在 §9,不删,供追溯。
> 若你看过旧版,请以本版为准 —— 旧版的 §7 执行顺序与正文结论存在冲突。

---

## 0 · 先更正前提:**「kernel 零依赖」这条约束不存在** ✅

检索 `CLAUDE.md` 全文、用户级记忆目录、骨架需求文档:**没有任何一处写过"零依赖"。**

真实存在的三处正本,方向一致,**都是"该用库就用库"**:

| 出处 | 原文 |
|---|---|
| `CLAUDE.md:19` | **优先使用成熟、稳定、维护良好的第三方库,而不是重复造轮子。** |
| `CLAUDE.md:20-21` | 使用项目已有依赖解决问题之前,不要随意新增依赖;引入新方案前先检查已有代码、依赖、文档和能力。 |
| 骨架需求 §6.4 | `kernel/**` **允许**「纯 TS 运行时库(**`@reduxjs/toolkit` 等**)」;**只禁** `expo*` · `react-native*` · `react` · `react-dom` |

门也只查这四个前缀(`check-static.mjs:648-673`,denylist 非 allowlist),且**只查 kernel 包自己的依赖与自己源码的 import**。

⇒ **规则没错,是实践把第 20 行读成了"别加依赖"。**

⚠️ `CLAUDE.md:89` 另有「分钟级、**零基建**、防回归」,但那是治理/CI 工具的过滤器,
**记忆里已记录 Dexter 明确否过一次这种误用**(「我没说过零基建…现在不把基础打好,后面更难走」)。
**这是同一误读第二次发作**,防复发见 §8。

---

## 1 · 结论

### 1.1 「大量重复造轮子」对一半、错一半

| 路 | 有无"该换库"的真轮子 | 真正的问题 |
|---|---|---|
| 状态 / 不可变 | ✅ **有**(RTK) | 全仓零 `createSlice`,而 immer/reselect 已随 RTK 进包体 |
| 运行时校验 | ❌ 无 | **缺架构槽**:`defineCommand` 有类型参数却无运行时校验挂点 |
| 异步 / 并发 | ❌ 无 | 手写原语 6 个、5 个各只出现一次;**原生 API 路线被环境封死** |
| 持久化 / 序列化 | ❌ 无(100% 不该换) | 领域协议深度耦合;但埋着若干实缺陷 |
| 基础工具 | ❌ 无 | 重复**全部是仓内复制粘贴**,修法是下沉不是引包 |

**已扫描的五类里,建议新增第三方依赖:0 个。** 唯一要动的是给两个包**补声明**一个仓里已有的包。

⚠️ **这不是普查结论。** 五路按类别切分,**至少漏了两类**:
**图算法**(`resolveModuleOrder.ts` 54 行手写 DFS 拓扑排序 + 环路径重建 ✅)与
**规范化序列化**(`persistenceCodec.ts` 的 canonical JSON)。
两者我的判断都是保留手写(前者库不给环路径且是 boot 期;后者与 sync 协议绑定),
但**此前根本没被评估过** ⇒ 结论应表述为「**已扫描的五类里为 0**」。

### 1.2 价值分级(按两轮盲审 + Dexter 裁定后的实际把握度)

| 档 | 项 |
|---|---|
| **收益明确、代价小** | 给 `display-context` 补 RTK 声明(现存依赖卫生缺陷)· §5 的 hydrate 端口共享死代码 |
| **收益明确,不碰台账** | §4 的 **C-1…C-11 十一条包内部去重**(已核 ✅:涉及符号均不在各包 `publicExports`) |
| **收益明确、但需台账同批改动** | A-1(三个 slice,动 `closedUnionConsumers`)· A-2(selector,先重估行数)· **C-12(分区机制泛化 + 补 instanceMode 维,§4.1)** |
| **已由裁定简化** | B-4(清理改为随新请求扫描,顺带去掉永不释放的定时器)· R3(改祖先链判定) |
| **已撤销** | B-3(actor 只是执行器,并发保障归业务) |
| **潜在缺陷:fail-open + 零红向量** | B-1(含镜像项)· B-2 · B-5 · B-6 的 record 路径 |
| **已撤回** | 「静默丢弃写入踩 TR-02」(类型上不可达)· 单调时钟/clock port 整条线(Q-2 裁定)· valibot(Q-5 裁定) |

**可减行数** ○(子代理数字,我未逐条复核):
§4 的十一条包内部去重合计 **237 行** · A-1 ≈66 行 · A-2 待重估 ⇒ 合计约 **300 余行**(占 kernel 3%)。
⇒ 整改的价值主要在**把不确定性摊开**与**几条小而确定的修复**,不在减行,也不在"修复线上 bug"。

---

## 2 · 该引的库:`@reduxjs/toolkit`

### 2.1 包体边际成本为 0

RTK 2.12.0 的入口在顶层 **eager import immer + reselect**,无懒加载入口。
⚠️ 我本人只核了 `dist/redux-toolkit.modern.mjs`(✅);
"五个入口(`modern.mjs` / `legacy-esm.js` / `browser.mjs` / 两个 cjs)**全部**如此"是盲审的结论(○)。

**传导链**:`createStateStore.ts:7` import RTK ← `state/src/index.ts:64` 导出 `createStateRuntime`
← assembly 的 `skeletonBootstrap.ts` 从该包 index import `moduleName`。RN + Metro 默认不 tree-shake。

⇒ **只要装配层碰这个包,RTK 连同 immer、reselect 就在包体里。用 `createSlice` / `createSelector` 的包体成本是 0 字节。**

### 2.2 运行时成本:非零,但比我第二版说的小得多 ✅

`immer.mjs:666` 构造器 `autoFreeze_ = true`,RTK 全文零处 `setAutoFreeze`。但:

- `freeze(obj, deep)` 在 `isFrozen(obj)` 时**立即返回,不递归**(`immer.mjs:184-186`);
- `writeLedgerTransition` **已经**预冻了 record 与 commands 数组(`createCommandDispatcher.ts:193` / `:201`)
  ⇒ **早退发生在那个已预冻的 record 上**;**新建的 envelope 本身仍会被 immer 冻结**(浅冻),
  但递归进 `.value` 时立即早退,**碰不到 commands / observations 子图**。
  (措辞按 Codex 复核更正:早退点是 record,不是 envelope。)
- RTK 的 `createReducer` **只在命中 case reducer 时**才进 `produce`,不是每个 action。

⇒ 每次 dispatch 的真实增量 ≈ **1 个 Proxy + record map 一次 `Object.freeze` + N 次 `isFrozen` 早退 + 新 envelope 浅冻**。
而现手写 reducer 的 `{...state, [id]: {...}}` 本来就是 O(N)。

**结论**:代价是"多一趟带早退的 O(N) 遍历",**不构成把 `requestLedger` 从 A-1 里扣出来的理由**;
也**不建议** `setAutoFreeze(false)`(那会牺牲 dev 期不可变保护)。若仍不放心,做法是先测量,不是先拆分。

### 2.3 A-1 · 三个 slice 的手写 redux 样板(106 行 → 约 40 行)○

`requestLedger.ts` · `runtimeInstanceMode.ts` · `displayRole.ts`。换 `createSlice` 消掉的是:

1. **运行期重验编译期已证明的事实** —— `requestLedger.ts:96-101` 用 `Reflect.get`+`typeof` 把强类型 creator 的 payload 再验一遍,验不过静默 `return state`。`PayloadAction<T>` 免费给这个。
2. **delete 路径无变更也产生新引用** —— immer 的 delete trap 对不存在的 key 不 mark changed。
   ⚠️ **`clear` 不在此列**:写成赋新 `{}` 时 set trap 的 `Object.is` 早退必然失败,照样产生新引用
   ⇒ "角色切换每次 clear 作废缓存"**仍需一个显式空判**,不是换库自动消失。
3. **手写 action type 常量与 creator 的样板消失**。

⚠️ **首版声称的"静默丢弃写入,踩 TR-02"已撤回**:`RuntimeRequestLedgerSliceName` 是 2 成员闭合联合,
三个生产派发点全部经 `requestLedgerSliceNameForMode(mode)` 取值 ⇒ **"传错 sliceName"在类型上构造不出来**。
对另一个 slice `return state` 是"一条 action 广播给两个 store 槽位"的设计本身。
⚠️ 且"三处调用点不必再传 sliceName"也是错的 —— 换后仍要按 mode 选**哪一个 slice 的 creator**。

### 2.4 A-2 · 手工重造 reselect 的记忆化(52 行)○,语义等价性 ✅

`selectRequestExecutionView.ts:36` 的 `WeakMap<local, WeakMap<peer, Map<mode, view>>>`。

⚠️ **第二版曾以"语义不等价"撤回 A-2,那是过度修正,现恢复。**
reselect 5.2.0 的 `createSelector` 有**两层互不相干的 memo**(`reselect.mjs:642 / 648 / 656`):
`argsMemoize` 吃 `(state, requestId)`,`memoize` 吃 **input selector 的产出**。
只要把两个 envelope 抽成 input selector(那本就是 `createSelector` 的唯一用法),
`buildView` 仍按 `(localEnvelope, peerEnvelope, mode)` 身份命中 ⇒ **失效粒度与现实现一致**。

⇒ A-2 成立,但**行数收益需要重估**(要多写 input selector)。

⚠️ **必须用 reselect 5 的默认 `weakMapMemoize`,绝不能退回 `lruMemoize`**(容量 1)——
`selectRequestExecutionViews.ts:36` 会在一次调用里循环遍历全部 requestId 逐个调,容量 1 会 100% 抖动。

### 2.5 落地阻碍:**两道台账,不是零阻碍** ✅

1. **`closedUnionConsumers`** —— `runtime/terminal-invariants.json` 有一行
   `{"union":"RuntimeInstanceMode","declarationId":"createSetRuntimeInstanceModeAction",...}`,
   而该 creator 正是 `createSlice` 会删掉的符号 ⇒ `closed-union-consumers.mjs` 抛 `missing declaration`。
   ⚠️ 同文件的 `closedUnionConsumerCount: 7` **只是同一 JSON 内的自洽校验**(`:173-178` 比较的两个值都在该 JSON 里),
   **不提供任何覆盖率保证**;它检测不出"漏声明一个消费者",删/加一行时随手同改即可。
2. **五个 per-package checker 各有一道 `publicExports` 精确集合门**
   (`tools/terminal-{runtime,state,contracts,platform-ports,display-context}/check-static.mjs`),
   `missing/extra` 任一非空即抛。
   ⚠️ **口径更正(Codex 复核)**:对 A-1 而言这多数只是**重跑义务**,
   只有公共面真的增减时才需要改台账,不是"五处都要改"。
3. 🔴 **`tools/terminal-skeleton/check-static.test.mjs` 的 TR-01 红夹具锚点**(我首版遗漏)✅:
   第 558 行起把 `createSetRuntimeInstanceModeAction(payload.instanceMode)` **当字面文本**做变异锚点
   (`roleDispatchText` 以及第 563 / 571 / 577 / 588 行的多个 `source.replace(...)` 变体)。
   A-1 删掉该 creator 后,**红夹具找不到锚点,会静默停止证明任何东西**。
   ⇒ 必须同批换成新的可变异锚点。
   ⚠️ **我只查了包的测试,没查工具自己的红夹具** —— 这正踩在红夹具纪律上。
4. **`runtime` 若直接 import `createSlice`,`runtime/package.json` 必须声明 RTK**;
   而现有 dependency-completeness 门只覆盖 `@catering-v2s/*`,**抓不到这类外部依赖遗漏**(与 §2.7 同源)。

**不构成阻碍的**(第二版误列,已删):`tr01Exceptions` 的消费判据只看
**dispatch receiver 文本 + 词法作用域名**(`check-static.mjs:578-580`),
`createSlice` 只改 dispatch 的实参,两者都不变 ⇒ 照常被消费。

**仍成立的两条**:`state/types/slice.ts:44` 要的正是 `Reducer<TState, UnknownAction>`,即 `createSlice(...).reducer` 的类型;
`terminal-invariants.json` 的 `sliceName` 是 store 键,不受 action 命名影响。
⚠️ 但"测试不依赖"只在**字符串字面量**层成立 —— `runtime/test/requestLedgerSelector.test.ts:16`
**按符号 import 了 `createSetRuntimeInstanceModeAction`**。

### 2.6 🔴 测试必须同批改(Dexter 追加要求)

> 「充分使用 RTK 的 `createSlice` 之后,**包的测试脚本也不能漏,也要改**。」

已核 ✅ 的实际影响面:

- **按符号 import 手写 creator 的测试只有一个文件**:`runtime/test/requestLedgerSelector.test.ts`
  (import 了 `createSetRuntimeInstanceModeAction` 与 `createUpsertRequestLedgerRecordAction`)。
  `createDeleteRequestLedgerRecordsAction` / `createClearRequestLedgerSliceAction` / `createSetDisplayRoleAction`
  在测试中**零引用**。
- **无任何测试断言 `@@catering-v2s/...` action type 字符串** ⇒ 改名不撞断言。
- 经**命令**驱动的测试(reset / roleAndRoute / requestLedgerCleanup 等)行为不变,无需改动。

⚠️ 但"不能漏"不止是改引用:**A-1 之后每个 slice 的行为应有对应用例覆盖**,
包括 §2.3 指出的 `clear` 仍需显式空判这一条 —— 换库不会自动带来红向量。
另:各包 `terminal-invariants.json` 的 `owned.test` 与 `requiredTestIds` 须一并复核。

### 2.7 必须一并修的依赖卫生缺陷 ✅

`display-context/src/features/slices/displayRole.ts:1` 已 `import type {UnknownAction} from '@reduxjs/toolkit'`,
但 **`display-context/package.json` 没有声明 RTK**,只靠 yarn 提升到根 `node_modules` 才没炸。
`runtime` 则**刻意绕开**:`types/runtime.ts:25` 用 `Parameters<RuntimeStore['dispatch']>[0]` 结构性推导。

⇒ 两个包都该补声明。**display-context 这条与本次改造独立成立,现在就是缺陷。**
⚠️ 现有"依赖声明完整"门**只查 `@catering-v2s/*`**,查不到这类。

### 2.8 冒烟证据:`state` 造好了 `createSlice` 的工位却零消费者 ✅

`state/src/supports/workspace.ts:69-77` 的 `createWorkspaceActionDispatcher` 按**最后一个 `/`** 切 action type,
重写成 `${sliceType}.${workspace}/${actionName}` —— **只在 `<sliceName>/<reducerName>` 形态下有意义,那正是 createSlice 的约定**。
而现存 action type 是 `@@catering-v2s/runtime/UPSERT_...`,喂进去语义错乱;
且该函数与 `toWorkspaceStateDescriptors` / `createWorkspaceStateKeys` **生产侧零消费者**。

⚠️ **零消费者在这里只是"createSlice 约定的工位没人上工"的证据,不是删除依据。**
这三个工具**必须保留**(理由见 §5 抬头),并由 **C-12**(§4.1)给它们接上第一个真实消费者。

---

## 3 · 行为缺陷

### 3.0 可达性(✅ 逐条核过触发条件)

| 缺陷 | 可达性 | 依据 |
|---|---|---|
| B-1 debounce 饿死 | **潜在** | **生产** slice 零处用 `debounced`(两处持久化声明都是 `'immediate'`)。测试夹具 `persistence.test.ts:185` 与 `state/README.md` 在用 |
| B-2 reset 被吞 | **潜在** | `requestApplicationReset` 只有测试调用 |
| ~~B-3 超时 actor 继续跑~~ | **已撤销** | 非缺陷,见下(Q-1 裁定) |
| B-4 时钟回拨 | ✅ 可达,但**按 Q-2 裁定已不按缺陷处理** | 允许过期请求滞留;核心目的是防无限增长 |
| B-5 坏 key 穿透 / B-6 hydrate O(n²) | **潜在** | 走 record 持久化路径,而今天两个持久化描述符都是 `kind:'field'`(`requestLedger.ts:123` 的 record 是 **sync** 不是 persistence) |
| B-6 全量重编码 / flush 队列无合流 | ✅ **可达** | field 描述符同样走这两条 |

**潜在 ≠ 不修**:四条的共同形态是 **fail-open + 零红向量**,第一个使用该特性的人会拿到静默错误行为。
底座尚在建设期,这比线上 bug 更难发现。但**不得用现行事故语气陈述**。

### 🟠 B-1 · debounce 调度粒度错配(潜在)✅

`createStateRuntime.ts:145-170`。判据是 `slice.persistence.some(entry => ...)` ——
**只要该 slice"含有"某 flushMode 的描述符就为真,与本次改了哪个字段无关**。

⚠️ **代码上方注释(`:157-158`)恰好写着不能这么干**:
「An immediate change must **not** flush a debounced descriptor… **Keep an existing timer alive**」,
而下面照样 `clearTimeout` + 重设。**作者想对了,写错了。**

**两个对称错误**:
- `:149` `hasDebouncedChange`:纯 immediate 变更也会重启 debounce 定时器 ⇒ 该描述符可被无限饿死;
- `:146` `hasImmediateChange` 用 `!== 'debounced'`:纯 debounced 变更也会每次 dispatch 触发一次 `runFlush('immediate')` 空跑。

**现有测试为什么测不到**(表述按 Codex 复核更正)✅:
P-3b(`persistence.test.ts:181-204`)先发 debounced 变更、再发 immediate 变更,
**第二次 dispatch 之后测试重新等 40ms** —— 而 40ms **长于**被错误重启后的 25ms,
所以"原 timer 保持"与"timer 被重启"**两种实现都会通过**,该用例在结构上无法区分。

⚠️ **因此修复不是"缩短 sleep"**(缩短只会让两种实现都失败,同样不可区分)。
需要**两条独立、可证伪的 focused proof**,用 fake timer 或一个可观察的 flush seam:
- 证明 **immediate 变更不重启既有 debounce deadline**;
- 证明 **debounced-only 变更不走 immediate selection**(对应 `:146` 那个镜像错误)。

**B-1b**:debounce 无 `maxWait`,陈旧度无上界 —— 独立成因,手写约 5 行。○

### 🟠 B-2 · 用户请求的应用重置被静默吞掉 + Map 条目永久泄漏(潜在)✅

`createCommandDispatcher.ts:535-547`。`pendingResetByRoot.delete` 在 **`try` 里**(`:538`),
而 `finally`(`:543-547`)只清 `activeRoleContexts` / `commandChains` / `releaseCommand`。
root 命令在后代请求过重置后抛出时,条目永久留存,且重置**既不执行也不记日志**。
**修法**:delete 移进 `finally`,并对被丢弃的 reset 补一条 warn。

### ~~B-3 · 超时后 actor 继续跑~~ —— **已撤销(Dexter 2026-09-02 裁定)**

原报:超时后 actor 仍持有活跃 context,可继续写 store、派生子命令,最长 60 秒。

**裁定**:
> actor 只是一个 command 执行器,跟 Java Spring 的 controller 一样,每个请求互不影响。
> 至于重试、拒绝、锁定等等能力,都是 actor 的方法里面业务自己要求定义的,跟 actor 本身没有关系。

⇒ **这不是内核缺陷。** 并发下的幂等、去重、加锁属于业务在 actor 方法内自己的责任;
内核不该替业务做取消。原建议的 `AbortSignal` 方案**作废**,`ActorExecutionContext` 不加 signal 成员。

⚠️ 留一条**仍成立**的:超时 actor 派生的子命令因父链已删而作为**游离 root** 执行,
会让 `pendingResetByRoot` 条目永不被消费 —— 但那是 **B-2** 的泄漏,按 B-2 修即可,与本条无关。

### 🟢 B-4 · ledger 清理 —— **按裁定大幅简化**

原报:`cleanupRequestLedgerActor.ts:57` 用墙钟差值算年龄,时钟回拨会让跳变前的记录停止老化;
原建议 clock port 或 `monotonicNowMs`。

**裁定**:
> 简单做就好了。每次有新请求来的时候,扫描一下 slice 里面有没有超过时效的请求清理掉就好了。
> **允许超过时效的请求还在 slice 里,因为核心目的是防止 slice 无限增长**,不需要花大力气精确处理。

⇒ **单调时钟整条线作废**:不加 clock port、不加 `monotonicNowMs`、不改 `nowTimestampMs`。
时钟回拨导致"某批记录晚点才被清"完全在可接受范围内。

**由此产生的两条实际改动**:

1. **清理触发点从定时器改为"新请求到来时"**。
   现状是 `createRuntime.ts:250` 的 `setInterval` 派发 `cleanupRequestLedgerCommand`。
   改成随新请求扫描后,**那个定时器可以直接去掉** ——
   它同时是 §B-7/R6 里"生产环境永不释放的资源"之一,一并消掉。
2. **既然核心目的是"防止无限增长",可考虑加一条与时钟无关的兜底**:
   条目数超过上限时按最旧优先丢弃。这条对时钟异常天然免疫,比任何时钟方案都直接。
   ⚠️ 这是我的建议不是裁定,是否要做由 Dexter 定;不做也不影响上面第 1 条。

### 🟡 B-5 · owner 坏 key 抛异常穿透公开 API(潜在)○

`keyspace.ts:50-55` 对空 `entryKey` 抛错,而该 key 直接来自 owner 状态;record 归一化只过滤 `undefined` **值**不校验**键**。
后果:该轮全部 slice 放弃、health 不更新、`flushPersistence()` **返回 rejected promise 而非文档承诺的结果对象**。
⚠️ 不对称:坏**值**走 per-key `ENCODE_REJECTED` 典型化通道,坏**键**却走异常。

### 🟡 B-6 · 热路径上的算法与分配浪费 ○

`persistenceEngine.ts:227-251` record hydrate **O(n²)**(潜在)· `:395` 任一 slice 变更即遍历**全部** entry 完整重编码后才比缓存 ·
`:299-307` flush 队列无合流无上界 · `:914-919` `keysForStorage` 被当单键谓词用 ·
`cloneStateJsonValue.ts:144` 每个 actor 完成时 `new TextEncoder()` 只为取长度。

### 🟡 B-7 · 其余 ○

**`R3` 重入检测改为祖先链判定**(Dexter 授权我定,裁定依据:「核心目的是能够检测死循环,发生死循环的时候就该断掉并报错」)——
现状 `createCommandDispatcher.ts:558` 问的是"**全运行时**有没有任一同名三元组在飞",
会把**真正并行的兄弟命令**误判为重入;而死循环的准确特征是"**我嵌套在我自己里面**"。
dispatcher 手上已有精确祖先链 `commandChains`,判据应改为"我的链里是否含该 actorKey + commandName 的活跃条目"。
⚠️ 现有测试 D-2 **区分不了这两种读法**(两种语义下都是 error),改完须补一条**并行兄弟不被拒**的用例。 · `R4` 命令释放后兄弟 actor 终态被静默丢弃 ·
`R5` 超时边界产生伪 `actor.late-completed` · `R6` 生产环境 `registerResource` 永不排空(`Runtime` 无 `stop()`)·
`R7` `PortError.retryable` 是**没人执行的契约字段**。

---

## 4 · 仓内下沉(零依赖,合计 **约 272 行**:C-1…C-11 计 237 行 + C-12 约 35 行)○,抽验见标注

⚠️ **台账影响要逐项判,不是一刀切**(我第二版曾把所有项都说成"两文件同批改动",那也是过度修正):

- `publicExports` 门管的是**包的公共 index**。已核 ✅:display-context 的 17 个 publicExports 里
  **没有任何 foundations 内部符号**(`toDiagnostic` / `logDisplayError` / `readDisplayInfo` 全不在)。
  runtime 侧同样已核 ✅:`createActorRegistry` / `validateActorMounts` / `isRuntimeInstanceMode`
  **都不在** runtime 的 63 个 publicExports 里。
  ⇒ **C-1 · C-2 · C-3 · C-4 · C-5 · C-6 · C-7b · C-8 · C-9 · C-10 · C-11 这十一条是包内部重构,不碰台账。**
  ⚠️ **C-12 是例外**:它新增 `state` 泛型导出与 `runtime` 实例化导出,**碰台账**,故排在第二批。
- **碰台账的有三类**:① C-7a **若**走"import runtime 的 guard"路线,需 runtime publicExports 从 63 增到 64
  (走"包内本地 guard"路线则不碰);② §5 的删除(减导出 + `closedUnionConsumers` + 计数);
  ③ **C-12**(新增泛型导出 + 实例化导出)。
- 实施时仍须**逐项确认该符号是否在本包 publicExports 中**再决定是否同改。

| # | 项 | 减行 |
|---|---|---|
| C-1 | **8 份同构 `unavailable*Port` 桩**,4-10 行逐字节相同,只差 `port` 字段 ⇒ 提 `createUnavailable(port)` | ≈46 |
| C-2 | `validateActorMounts`(`createRuntime.ts:173-205`)与 `createActorRegistry` **是同一套校验的两份实现**,且对同一条件抛不同文案:`Actor was not created by defineActor: X` vs `Runtime actor must be created by defineActor` ✅ | ≈30 |
| C-3 | `readLedgerState` 同一动作写了 4 遍(2 份逐字复制 + 2 处内联同义) | ≈20 |
| C-4 | display-info 5 字段诊断字面量手拼 **7 次**,而 `validateHydratedDisplayRoleActor` 的 `toDiagnostic` 已是正确实现,只是**没被提取复用**(它不在公共面,提取不碰台账)| ≈32 |
| C-5 | `logDisplayDiagnostic` / `logDisplayError` 体内**一字不差**,只差 `.warn(`/`.error(` | ≈16 |
| C-6 | `subscribeState` 在 `createCommandDispatcher` 与 `createRuntimeLifecycle` **逐字重复 11 行** | 11 |
| C-7a | display-context 在两个 actor 里**内联硬编码** `value === 'MASTER' \|\| value === 'SLAVE'` ✅ ⇒ 应复用单一 guard。**两条路线代价不同**:包内提一个本地 guard(不碰台账)vs import runtime 的 `isRuntimeInstanceMode`(需 runtime 新增公共导出)。⚠️ 无论走哪条,**都恢复不了门覆盖**——那是门的洞,见 §8 | ≈8 |
| C-7b | `isPowerSource` 同包内抄两遍;`isObject` 在 state 内两份 | ≈8 |
| C-8 | **`freezeList` 已存在**(`moduleManifest.ts:3`)却无人复用,同包**另有 8 个文件**手写 `Object.freeze([...])` ✅ | ≈8 |
| C-9 | 非空字符串断言 **4 份实现 / 12 处调用**(须保留各自错误前缀,签名带 scope) | ≈18 |
| C-10 | `persistenceEngine` 的迁移规划在 rebaseline 侧与 hydrate 侧重复;`#tryRebaseline` 的判定分支绕路,严格等价于 hydrate 侧已有的简单写法 | ≈40 |
| 🔴 **C-12** | **状态分区机制只有一维,另一维在被手写** ✅ —— 详见下方专节 | ≈35 |
| C-11 | kernel 内**两份手写 JSON 安全校验且规则不一致**:`isStateJsonValue` **放行** accessor getter 与 symbol key,`cloneStateJsonValue` **拒绝**。runtime 本就依赖 state,方向允许复用 | — |

### 4.1 🔴 C-12 · 把状态分区机制泛化,并补齐 `instanceMode` 维

**事实** ✅:

- v1 POC 有**两套对称的分区机制**:`workspace.ts`(189 行)与 `instanceMode.ts`(172 行) ——
  建分区 slice、生成分区键、把 action 路由到当前分区、按分区读取。
- v2s **只继承了 workspace 一维**(`state/supports/workspace.ts` + `types/workspace.ts`);
- 而 `instanceMode` 同样是**运行期可变维度**(`switchInstanceMode` 命令),
  `runtime/features/slices/requestLedger.ts` 正在**手写这一维**:
  两个 slice + payload 带 `sliceName` 做路由 + `requestLedgerSliceNameForMode(mode)` 选目标。

⚠️ **与 A-1 的关系**:`createSlice` 解决的是 **action 命名空间**冲突,分区机制解决的是**状态分区**,
**两者正交互补,不能互相替代**。(我曾误称"换 createSlice 后分区天然解决",已更正。)

**归属障碍** ✅:`WorkspaceKey` 住在 `state`,`RuntimeInstanceMode` 住在 **`runtime`**,
而依赖方向是 runtime → state ⇒ **instanceMode 的分区工具不能直接放进 `state`**。

**建议做法:把分区机制做成维度无关的泛型,放在 `state`**

```
createPartitionedStateKeys<K extends string>(baseName, keys)
createPartitionedActionDispatcher<K>({partition, dispatch})
toPartitionedStateDescriptors<K, TState>({baseName, reducers, createDescriptor})
```

- workspace 维 = 用 `WorkspaceKey` 实例化(仍住 `state`);
- instanceMode 维 = 用 `RuntimeInstanceMode` 在 **`runtime`** 里实例化(runtime 依赖 state,方向成立);
- **`state` 对两个联合都零知识**,归属障碍消失。

**收益**:① 消掉两维之间的重复;② `requestLedger` 不再手写**机械性**的分区与路由。

⚠️ **收益 ③ 已撤回(Codex 复核)**:我曾写"让 workspace 三件套第一次有真实消费者"。
**不成立** —— `requestLedger` 用的是 **instanceMode** 维,不是 workspace 维;
真正被复用的是**泛型内核**,workspace 三件套只是它的薄封装,仍然零消费者。
它们该留的理由是 §5 抬头那条(workspace 是运行期可变维度),与本条无关。

### 🔴 4.1a C-12 的硬边界:泛型只能承载机械能力,四项语义必须由 runtime 显式拥有

**这是 Codex 复核提出的 M 级问题,我逐项核过,四项全部成立** ✅:

| # | requestLedger 的 partition 语义 | 证据 |
|---|---|---|
| 1 | 两分区 **syncIntent 相反** | `requestLedger.ts:134` `master-to-slave` / `:143` `slave-to-master` |
| 2 | 角色切换要**清掉前一个 mode 的分区** | `requestLedgerRoleChangedActor` 派发 `createClearRequestLedgerSliceAction(requestLedgerSliceNameForMode(payload.previousMode))` |
| 3 | 清理**只处理当前 mode** | `cleanupRequestLedgerActor:44` 取 `selectRuntimeInstanceMode(context.getState())` |
| 4 | selector 要按 **current/peer 合并同一请求** | `selectRequestExecutionView` 的 `WeakMap<local, WeakMap<peer, …>>` |

⇒ **泛型分区机制只提供:分区键生成、action 路由到当前分区、按分区读、descriptor 批量生成。**
上面四项**不得**下沉进泛型 —— 它们是 runtime 的领域语义,必须由 runtime 显式拥有,
并**逐项写成保持条件与反例**(例如:角色切换后前一分区必须为空;cleanup 不得触及非当前 mode 的分区)。

⚠️ **另一条边界**:**不要为了"runtime 实例化导出"而扩大 runtime 的公共面**。
实例化结果若只在包内使用,就不进 `publicExports`。

⚠️ 台账影响:`state` 新增泛型导出(publicExports +N),`runtime` 新增实例化导出;
若 workspace 三件套改为泛型的薄封装,`state` 的 `closedUnionConsumers` 两行与计数 5 要复核。

---

## 5 · 死代码 / 零消费者

> 🔴 **本节有一条重大更正。** 我曾把 workspace 分区三件套列为"零消费者可删",
> 那是**拿当前消费者数去判断一个地基机制**。在完成度约 5% 的工程里,这个推理本身就是错的。
>
> **为什么不能删** ✅:
> `resolveWorkspace = (SLAVE && CHIEF) ? BRANCH : MAIN`,
> 而 `resolvePowerRoleTarget` 让**单屏 SLAVE 接电 CHIEF→VICE、断电 VICE→CHIEF`**
> ⇒ **同一台设备插一次电源线就从 BRANCH 跨到 MAIN**,不涉及链路、不涉及第二台设备。
> 一台设备在运行期穿越两个 workspace,那么两侧的业务状态**必须分区**,否则在同一组 slice 键上互相覆盖。
> ⇒ 这三个工具不是"为链路预留",是**单机就需要的状态分区机制**;零消费者只因业务 slice 尚未建。
>
> ⚠️ 我另一处也错了:曾称"换 `createSlice` 后分区天然解决"。**不对** ——
> `createSlice` 解决的是 **action 命名空间**冲突,分区工具解决的是**状态分区**,两者**正交互补**。
>
> ⚠️ 由此还带出一条**新的缺口**:v1 POC 有 `createInstanceModeSlice` 作为**同一机制的另一维**,
> v2s **没有继承**,而 `requestLedger` 正在手写同一套(两 slice + payload 带 `sliceName` 路由)。
> 而 instanceMode 同样是运行期可变维度(`switchInstanceMode`)⇒ **该维度的分区机制应当补齐,而不是继续手写。**

| 项 | 结论 |
|---|---|
| hydrate 里的"两个 storage kind 共享同一物理端口"机制(≈25 行) | ✅ **可删,且不碰任何台账**:构造期 `if (plainStorage === protectedStorage) throw`,`hydrateStateRuntime` index 零导出、唯一调用点就是构造函数 ⇒ `portStorageKinds` 恒为单元素 |
| `ParameterDefinition` 的 `decode` / `validate` | ⚠️ **不是简单可删**:同名成员在 `ParameterDescriptor`、`DefineParameterInput`、`ParameterDefinition` **三个类型**上,三者都在 contracts `publicExports` 里,须同删;且 `contracts/test/public-surface.typecheck.ts:130` **就填了 `validate:`**,删成员会让该夹具报 excess-property。"零调用"≠"零消费者" |
| `createWorkspaceActionDispatcher` / `toWorkspaceStateDescriptors` / `createWorkspaceStateKeys` | 🔴 **不删**(Dexter 2026-09-02 二次裁定,推翻先前的"删")。**我把它列入删除清单是错的** —— 见下方"为什么不能删" |
| `createSliceSyncDiff` / `createSliceSyncSummary` | ✅ **删**(同上裁定)。生产路径只用 `createFullSliceSyncPayload` |
| `PersistenceKeyDescriptor.storageKind` | 声明并填充,冲突检查从不读它。标 `UNVERIFIED`(可能是有意跨 kind 保守) |

---

## 6 · 明确**不该**换的(写下来防止后续被推翻)

| 候选 | 理由 |
|---|---|
| `typia` | ❌ 需 TS transformer 接进 Metro,与"kernel 能在纯 node 里验证"直接冲突 |
| `zod` | ❌ 若要引应选 valibot:zod v3 约 13 kB 且**不可 tree-shake**,v4 core 仍 5-6 kB。POS 冷启动敏感 |
| `valibot` | ✅ **不引**(Dexter 裁定:「先不引入吧」)。可寻址边界仅约 110 行,净减 ≈49 行,而跨节点载荷边界**今天还没通电**(peer transport 未接线)。⚠️ 但 §2.3 指出的**架构槽**(`defineCommand` 无运行时校验挂点)与本条无关,仍应单独考虑 |
| `p-timeout` / `p-retry` / `p-queue` / `async-mutex` | 超时竞速只有 **2 处**且产出 `completed\|error\|timed-out` **三态领域事实**直接驱动 ledger 与 `partial-failed` 代数;`p-timeout` 抛异常要 catch 回映射,**且丢掉 late-completed 语义**。重试/退避在范围内是 **0 处** |
| `AbortSignal.timeout()` / `.any()` | ⚠️ **本栈不存在** ✅:RN 用 `polyfillGlobal` 把 `AbortController`/`AbortSignal` 覆盖成 `abort-controller@3.0.0`(2019 子集),`timeout`/`any`/`reason`/`throwIfAborted` 全无;`polyfillGlobal` 会覆盖 configurable 的既有全局(遇 non-configurable 才报错跳过)。裸 `AbortController` 可用 |
| `redux-persist` | 本引擎有双 storage kind、跨后端 key 迁移、per-entry 提交单元、六态失败分类、blocked/baseline 语义,它一个都没有 |
| `nanoid` / `uuid` | nanoid v5 在无 `crypto.getRandomValues` 时**直接抛异常**(现实现是优雅降级);uuid 更长且丢掉 `runtimeIdPrefixes` 契约(已进 `contracts/terminal-invariants.json` 并有断言)。⚠️ 首版还写过"救它要装的 `react-native-get-random-values` 被门硬禁"——**该理由不成立,已删**:那是装配层全局 polyfill,不必成为 kernel 依赖 |
| `dequal` / `fast-deep-equal` | **零适用点**:变更检测用引用相等是 Redux/immer 下唯一正确做法;持久化比较的是**已编码字符串** |
| `lodash` / `es-toolkit` | 全仓无 groupBy/uniqBy/orderBy/chunk/cloneDeep 手写实现;`mergeScope` 是**逐字段显式合并**;`sanitizeContext` 是**刻意的封闭投影**。为 B-1b 那 5 行 `maxWait` 引 kernel 依赖不划算 |
| `quick-lru` | 零适用点:`WeakMap` 随 state 替换自动回收;`persistenceEngine` 的缓存**刻意不淘汰** |
| `structuredClone` 替 `cloneStateJsonValue` | 它不是深拷贝,是**带 JSON path 的安全校验器**;`structuredClone` 会**接受** Date/Map/Set,正是要拒的 |
| deep-freeze 类库 | 方向相反:`createStateStore.ts:57-61` 已在非 PROD 开了 RTK 的 `immutableCheck`/`serializableCheck`。真问题是**一致性**(contracts 零冻结)而非覆盖率 |

---

## 7 · 建议执行顺序(已按 2026-09-02 裁定重排)

**第一批 · 小而确定,均不碰台账**:
给 `display-context` 补 RTK 声明 · §5 的 hydrate 端口共享死代码 · B-2 ·
**§4 的 C-1…C-11 十一条包内部去重**(其中 C-7a 走"包内本地 guard"路线;**C-12 不在本批,见第二批**)。
⚠️ 此处**不逐项枚举** —— 上一版就是枚举时漏了两条。以 §4 表格为准。

**第二批 · 需台账同批改动**:
A-1(三个 slice 一起,§2.2 已说明不必拆 requestLedger)· A-2(先重估行数)·
**C-12(分区机制泛化 + 补 instanceMode 维,§4.1)**。

⚠️ **C-12 与 A-1 是同一个原子整改单元**,否则 `requestLedger` 会被按旧分区迁一次、再迁一次分区。
但**同批不等于无序同改**(Codex 复核意见,采纳)。次序应为:

1. 先出 **C-12 的 implementation-facing 设计**,并为 §4.1a 那四项 runtime 语义**各写一条 focused proof**;
2. 再**一次性**完成 `requestLedger` 的迁移(泛型分区 + `createSlice`),
   同批同步:`closedUnionConsumers`(含计数)· `tools/terminal-skeleton/check-static.test.mjs` 的 TR-01 变异锚点 ·
   `runtime/package.json` 的 RTK 声明 · §2.6 的测试改动。
同批执行 §5 的删除 —— ⚠️ **只删 `createSliceSyncDiff` / `createSliceSyncSummary`**;
**workspace 三件套不删**(§5 已二次裁定,反而由 C-12 给它接上第一个真实消费者)。

**第三批 · 按裁定的行为改动**:
B-4 的清理触发点改为随新请求扫描(顺带去掉 `createRuntime.ts:250` 的定时器)·
R3 改祖先链判定(须补"并行兄弟不被拒"用例)·
B-1 两个对称错误 + B-1b · B-5 · B-6 的 record 路径。
B-1 的处置是**收紧 P-3b 的时序断言**,不是新增红向量。

**先测量再动,不排期**:B-6 的热路径优化(全量重编码、flush 队列合流、`keysForStorage` 误用、TextEncoder)。

## 8 · 防复发建议

1. **把 §0 的三处正本写进 `terminal-coding-standard.md`** —— 同一误读已两次发作,对话裁定挡不住第三次。
2. **补一道门:外部依赖声明完整。** 现有门只查 `@catering-v2s/*`,于是 display-context 用了 RTK 却没声明、门全绿。
3. **闭合联合门有两个洞** ✅:
   (a) `closedUnionConsumers` 校验的是"某 declarationId 的某 **member 类型**解析到该联合",
   **不看 guard 的判定分支,也不看字面量比较** ⇒ `value === 'MASTER' || value === 'SLAVE'` 这类内联穷举门看不见;
   (b) `closedUnionConsumerCount` 只是同一 JSON 内的自洽校验,**不提供覆盖率保证**。
   ⇒ 给这类内联 guard "补一行 consumers" 只会制造**假绿**(其形参是 `unknown`,解析不出联合,反而必报错)。
4. **三个路由维度在 contracts 有内联副本,与正本无链接** ✅:
   `CommandRouteContext` 把 `'MAIN'|'BRANCH'` · `'MASTER'|'SLAVE'` · `'PRIMARY'|'SECONDARY'` **内联声明**,
   而正本 `WorkspaceKey` / `RuntimeInstanceMode` / `DisplayMode` 分别住在 state / runtime / display-context。
   contracts 的 `literalUnions` **确实钉住了**这三个内联副本(`CommandRouteContext.workspace` 等),
   ⇒ 不是"门看不见",而是**两边各自被钉住、彼此无链接**:
   给任一联合加成员要改两处 + 两份台账,**而没有任何门会告诉你漏了一处**。
5. **`TR-02` 的门抓不到 reducer 里的静默 `return state`** —— 要么扩门,要么进评审清单。

---

## 9 · 自查与盲审记录

| 轮 | 性质 | 结果 |
|---|---|---|
| 1 | 自查:六条行为缺陷是否可达 | **命中** —— 四条实为潜在,首版语气高估 |
| 2 | 自查:RTK 建议会否撞既有断言/类型 | 未打穿(但覆盖不全,见第 4 轮) |
| 3 | 自查:五路按类别切分是否留下覆盖洞 | **命中** —— `createLifecycleEmitter.ts`(555 行,kernel 第三大)五路都没审。补审后:无新轮子,结论不变 |
| 4 | **独立盲审 ①** | **重伤** —— 11 条,抽验 6 条全成立,**4 条打在我的 `✅亲验` 上** |
| 5 | **独立盲审 ②**(攻修订本身) | **重伤** —— 13 条。指出我的修订是**追加警告而不删旧文**,造成 §7 与正文冲突;且**三处矫枉过正** |
| 6 | **Dexter 亲自指出**「workspace 可不能删」 | **重伤,且是判据层的错** —— 连带纠正三处结论:§5 的删除清单、ui-state 需求稿的"只落一份 slice"、以及我"换 `createSlice` 后分区天然解决"的误判。由此新增 **C-12** |
| 8 | **Codex 独立复核**(REVIEW_TARGET=DESIGN,Round 1) | **NO-GO(M=1 / S=2 / N=1)**,四条我逐项亲验后**全部接受**:漏了 TR-01 红夹具锚点这道台账(S-1)· P-3b 的不可区分性与修复设计(S-2)· C-12 泛型不能承载的四项 runtime 语义(M-1)· immer 早退点措辞(N-1)。根因判断未被推翻 |
| 7 | 自审前后一致性 | **命中** —— §7 第二批仍写着"删 workspace 三件套"(与刚改的 §5 冲突);§1.2 / §4 抬头的"十一条""237 行"未随 C-12 更新;§2.8 的"零消费者"可能被误读成删除依据 |

### 我的八类失误(记下来防复发)

1. **断言后果之前先证明触发条件存在** —— 首版用"POS 断电即丢"陈述潜在缺陷。
2. **负面结论必须穷举** —— "全仓零 debounced"是用一条限定了 `*/src` 目录的 grep 得出的。
3. **可达性尺子要施加到全文** —— 我用它量了新写的 §3,没回头量 §2 的"静默丢弃写入"。
4. **子代理的说法不能穿上我的 `✅亲验`** —— "RN 未安装"是错的,RN 0.86.3 就装在 `apps/terminal/node_modules`。
5. **修订不能只追加警告** —— 旧文本不删就会自相矛盾;第二版的 §7 与正文打架,是三条 M 级问题的共同成因。**本版为此整篇重写。**
6. **纠错也会过头,而且会连着犯** —— 第二版把 `tr01Exceptions` 误列为阻碍、把 immer 代价说大、把 A-2 整个撤回;
   本版重写时又把"所有下沉项都要同改台账"一刀切了一次(实际包内部重构不碰 `publicExports`)。
   **在评审压力下往严处改,和原来往松处写,是同一种不亲验。**
7. 🔴 **不能拿"当前消费者数"判断一个地基机制该不该留** —— 这是本轮最深的一次错,
   也是判据层的错(前七条都是取证层的)。
   我据此把 workspace 分区三件套列入删除清单,而它的正当性根本不在"有没有人用",
   在于**它分区的那个维度是不是运行期可变的**:
   `resolveWorkspace = (SLAVE && CHIEF) ? BRANCH : MAIN`,而单屏 SLAVE **接一次电源就跨 workspace**。
   在完成度约 5% 的工程里,零消费者是常态,**不携带"没用"的信息**。
   ⚠️ 这与 CLAUDE.md 记录的"我没说过零基建、地基要一次建彻底"是同一条,我又踩了一次。
8. **改完必须整篇重读一遍** —— 本版重写后我自己过了一遍,又抓到四处:
   §1.2 残留"每项都附带台账同批改动"(与刚改的 §4 打架,**盲审点破的那个模式我自己又犯了一次**)、
   C 项减行数求和实为 237 而非"约 300"、C-2 漏归类、§2.1 又一次让子代理结论穿了我的 `✅`。

---

## 10 · 裁定记录(Dexter 2026-09-02)

| # | 议题 | 裁定 | 对本文的影响 |
|---|---|---|---|
| Q-1 | 超时 actor 是否继续跑 | **不是缺陷**。actor 只是 command 执行器,同 Spring controller,每请求互不影响;重试/拒绝/锁定由业务在 actor 方法内自定义 | **B-3 撤销**,`AbortSignal` 方案作废 |
| Q-2 | 时钟回拨怎么修 | **简单做**。新请求到来时扫描清理即可;**允许过期请求仍在 slice 里**,核心目的是防止无限增长,不追求精确 | **单调时钟整条线作废**;清理触发点改为随新请求,顺带去掉那个永不释放的定时器 |
| Q-3 | 重入检测是否要祖先感知 | **授权我定**,并给出目的:检测死循环,发生时断掉并报错 | **改为祖先链判定**(消除并行兄弟误判),并补一条"并行兄弟不被拒"的用例 |
| Q-4 | 五处零消费者代码 | **删了吧,用的时候再加**;⚠️ **二次裁定:workspace 三件套不能删** | §5 除 workspace 三件套外转为"删";workspace 三件套改为保留,并补齐 instanceMode 维(见 §5 抬头) |
| Q-5 | 是否引 schema 库 | **先不引入** | §6 valibot 行定案 |
| 追加 | RTK 改造的测试 | **包的测试脚本也不能漏,也要改** | 见 §2.6 |

**本文当前无待裁项。**

---

## 11 · 证据边界

- **我本人亲验**:§0 全部 · §2.1(仅 `modern.mjs`)/ 2.2 / 2.4 语义等价性 / 2.5 / 2.6 / 2.7 / 2.8 ·
  §3.0 全部可达性 · B-1 / B-2 / B-4 现象 ·
  **§4.1 的归属事实**(`WorkspaceKey` 在 state、`RuntimeInstanceMode` 在 runtime;requestLedger 手写分区)·
  C-2 / C-7a / C-8 · **§5 抬头"为什么不能删"的推导链**(`resolveWorkspace` + `resolvePowerRoleTarget`)·
  §5 前两项 · §6 的 AbortController 与 nanoid 更正 · **§8 第 3、4 条**(闭合联合门的洞 · contracts 的 `literalUnions`)。
- 其余标 `○`,为五路子代理结论,**未逐条复核,应视为待验**;行数统计均属此类。
- **RN 0.86.3 已安装**在 `apps/terminal/node_modules`(首版曾误称未安装)。
- 仍 `UNVERIFIED`:目标机是否注入 `NativePerformance`(决定 `performance.now` 单调性)、
  Hermes 上 `crypto.getRandomValues` 的实际可用性。**两者须在设备上验,仓内判不了。**
- 本报告**未跑任何测试**,所有"现有测试测不到"的判断来自阅读测试源码,非运行观察。
