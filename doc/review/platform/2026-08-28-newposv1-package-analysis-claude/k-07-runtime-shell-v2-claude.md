# `@next/kernel-base-runtime-shell-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F3** —— 关键路径；需吸收 `k-04` 的 middleware 与错误归一化 |
| 路径 | `1-kernel/1.1-base/runtime-shell-v2` |
| 规模 | src **2,501 行 / 40 文件**；test 1,152 行 |
| 依赖 | `contracts` · `definition-registry` · `platform-ports` · `state-runtime` |
| 被依赖 | 声明 19 个包，源码实际 import **20 个** —— 全仓第二广 |
| 状态 | 活跃，是整个 kernel 的中枢 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**唯一的 runtime shell。** 模块装配 + Command/Actor 广播执行 + request ledger +
参数解析 + error/parameter catalog + state sync 接口 + peer dispatch gateway。

README 的告诫写得很直白："不要让它再次膨胀成第二个 ApplicationManager。"

## 2 · 五个能力块

### 2.1 模块装配（`application/`）

`resolveKernelRuntimeModuleOrderV2` 是一个**带三种保护的拓扑排序**：

```ts
重复 moduleName        → throw 'Duplicate kernel runtime module detected'
依赖成环              → throw 'Circular kernel runtime module dependency detected'
必需依赖缺失          → throw 'Missing required kernel runtime module dependency: A -> B'
可选依赖缺失          → continue（`{moduleName, optional: true}`）
```

`createKernelRuntimeApp` 的启动序列：
`appCreated 日志 → 按序 preSetup 每个模块 → runtime.start() → bootstrap catalogs → dispatch initialize command → started 日志`。
`start()` 幂等（`started` 标志 + `startPromise` 复用）。

### 2.2 Command/Actor 广播（`foundations/runtimeCommandDispatcher.ts`）

见 `KEEP-06`。补充几个此前未记的细节：

- 重入保护键是 `requestId + commandName + actorKey`，**允许不同 request 并发、允许 actor 派子命令**；
- actor 超时用 `Promise.race([execution, timeout])`，超时后仍 `clearTimeout`，**但不会取消 actor 本身**
  —— actor 继续跑到底，只是结果不再被采纳；
- `requestApplicationReset` 是一个逃生门：actor 可以请求整个应用重置，
  由 dispatcher 在**根命令**完成后执行（`options.parentCommandId == null` 时才触发）；
- `target: 'peer'` 时**先在本地登记 request**再转发，注释写明理由是
  "前端 selector 能同步看到已开始，再等拓扑网关回填远端结果"。

### 2.3 request ledger（427 行）

内存真相源，支持 `subscribeRequest(requestId, fn)` 与 `subscribeRequests(fn)` 两级订阅。
README 明确"request 状态以内存 RequestLedger 为主真相源，不强制写进 Redux"。

### 2.4 catalog（`features/slices/errorCatalogState.ts` / `parameterCatalogState.ts`）

静态定义在模块 manifest 里声明，`bootstrapRuntimeCatalogs` 在 initialize 前把它们灌进 state；
远端下发由 `tdp-sync-runtime-v2` 的 system catalog bridge 调本包 command 更新。
**runtime-shell 比 tdp-sync 更早装配，所以它自己不监听 TDP**——这个方向性依赖在 README 里有明确说明。

### 2.5 state sync 接口（`foundations/runtimeStateSync.ts`，70 行）

`getSyncSlices()` 过滤出带 `sync` 描述符的 slice；
`applyStateSyncDiff(envelope)` 把跨端 diff 应用到本地。
**topology 不理解 Redux slice 内部结构，只通过这里** —— 设计意图注释写明了。

## 3 · 【重要】同步的真实冲突解决模型（本轮亲验，纠正此前判断）

我此前在台账 `FIX-05` 里判定"跨端同步用墙钟 LWW，快的那台永远赢"。**这个判断是错的**，
正确的模型如下（穷举 `1-kernel` `2-ui` `3-adapter` 下 `*.ts` 确认）：

### 3.1 方向由 `syncIntent` 静态决定，不由时间戳决定

`topology-runtime-v3/src/foundations/syncRegistry.ts`：

```ts
const toDirection = ctx => ctx.instanceMode === 'MASTER' ? 'master-to-slave' : 'slave-to-master'
const filterSlicesByDirection = (slices, direction) =>
    slices.filter(slice => slice.syncIntent === direction && slice.sync)
```

⇒ **一个 slice 只有一个权威方**：`master-to-slave` 的 slice 只有 MASTER 发送，
`slave-to-master` 的只有 SLAVE 发送。另一端只收不发。

### 3.2 模式恒为 `authoritative`

三个构造点全部显式传 `{mode: 'authoritative'}`；
`runtimeStateSync.ts` 第 15-17 行那个三元：

```ts
const syncMode = envelope.direction === 'master-to-slave' || envelope.direction === 'slave-to-master'
    ? 'authoritative' : 'latest-wins'
```

`StateSyncDiffEnvelope.direction` 的类型就是这两个值的联合 ⇒ **条件恒真，`'latest-wins'` 不可达**。

### 3.3 因此 `updatedAt` 只是变化检测，不是冲突裁决

- 发送侧 `createSliceSyncDiff` 在 authoritative 下用 `localEntry.updatedAt !== remoteEntry.updatedAt`
  —— **不等号，用于"有没有变"**，不是 `<` 的"谁更新"；
- 接收侧 `applySliceSyncDiff` 在 authoritative 下**无条件应用**incoming，不比时间戳。

### 3.4 结论

**POC 的同步模型比我上一轮判断的更稳健。** 它采用的正是我当时"建议"的方案 ——
按 slice 的 authority 决胜，不比墙钟。作者已经做对了。

### 3.5 但由此暴露三处真实残留

| # | 事实 | 影响 |
|---|---|---|
| a | `runtimeStateSync.ts:15-17` 的三元分支**不可达** | 读代码的人会以为 latest-wins 是可能模式 |
| b | `state-runtime/supports/sync.ts` 的 `mergeSyncRecordState` 与整条 latest-wins 分支**只有测试覆盖，生产不可达**（穷举确认：生产调用点仅第 148 行自身，位于 latest-wins 分支内） | 一整套 LWW 语义作为死路径存在 |
| c | `ui-runtime-v2` 的 `screenState.applySyncEntries` 与 `uiVariableState.applySyncEntries` 两个 reducer **零 dispatch 点**（穷举确认只在定义处出现），而它们的实现是 `if (!local \|\| local.updatedAt < incoming.updatedAt)` —— **LWW 语义** | 与实际生效的 authoritative 语义**不一致**。照着这两个 reducer 读会得出错误的同步模型结论。这正是"声称≠行为"的一个实例 |

补充：`applySlicePatches` 走 `createReplaceStateRuntimeAction`，
在根 reducer 里 `combinedReducer({...state, ...incomingSlices}, init)` ——
**整片替换 slice state，完全绕过 slice 自己的 reducer**。这就是 (c) 里那两个 reducer 永远不被调用的机制原因。

## 4 · 依赖关系

- **出边**：`contracts`、`definition-registry`、`platform-ports`、`state-runtime`。
- **入边**：20 个包。它是所有 runtime 包的装配入口与 command DSL 来源。

## 5 · 优点

1. **模块排序三种保护齐全**（重复/成环/缺依赖），且区分必需与可选依赖。启动期就报错，不是运行到一半才发现。
2. **广播 command + 聚合四态**是 POS 领域的正确抽象（`KEEP-06`）。
3. **`target:'peer'` 先登记本地 request 再转发**——UI 立刻看到"已开始"，不会出现"点了没反应"。
4. **request ledger 两级订阅**（单 request / 全部），UI 不需要持有 promise。
5. **catalog 的方向性依赖有明确说明**：runtime-shell 更早装配所以不监听 TDP，由 tdp-sync 反向调它的 command。
   这种"我知道我为什么不能反过来"的注释很少见。
6. **state sync 接口只有 70 行**，把"topology 不懂 Redux 内部"这条边界压缩成一个极薄的适配面。
7. **`start()` 幂等**，重复调用返回同一个 promise。

## 6 · 缺点 / 风险

1. **不可达分支与死 reducer**（§3.5 的 a/b/c）。其中 (c) 最危险：
   两个 reducer 写着与实际语义相反的冲突解决逻辑，且看起来完全像在用。
2. **actor 超时不取消 actor**。`Promise.race` 只是不再采纳结果；
   超时的 actor 仍在跑，若它带副作用（写 state、发 HTTP），副作用照样发生。
   这在 `TIMEOUT` 聚合状态下会产生"命令报超时但事情做了"的可能。
3. **`ActorExecutionResult.result` 是 `Record<string, unknown>`**，
   聚合结果无类型。调用方要手剥（`FIX-18` 里 workflow 出口那四层剥壳就是这个的下游表现）。
4. **request ledger 在内存、无上限说明**。427 行里没有看到显式的条目上限或过期清理，
   长时间运行的终端上 request 记录会持续增长。（此条为 `推论`：未逐行读完 427 行，需复验）
5. **`requestApplicationReset` 是一个很大的逃生门**：任意 actor 可以请求整个应用重置。
   目前只有明确场景在用，但它没有任何权限约束。
6. **`displayContext` 是构造期固定的**（`config.displayContext ?? {}`），
   TER 若走"一个 ReactHost 多 surface"，同一个 runtime 会同时服务两块屏，
   这个单值 displayContext 就不够用了。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **整体继承**模块排序、广播 command、request ledger、catalog、state sync 接口 | 中枢能力，形状已验证 |
| 2 | **删掉 latest-wins 整条死路径**（`runtimeStateSync` 的三元、`sync.ts` 的 merge 分支、两个 `applySyncEntries` reducer） | 保留会让"同步到底怎么裁决"有两个互相矛盾的答案（§3.5） |
| 3 | **把 authority 模型写进 TER 编码规范**："每个可同步 slice 恰有一个权威方，由 `syncIntent` 静态决定；时间戳只作变化检测" | 这是 POC 做对但没写下来的一条 |
| 4 | **actor 超时要能真正取消**：给 `ActorExecutionContext` 传 `AbortSignal`，约定长动作必须响应 | 否则 `TIMEOUT` 与"没做"不等价 |
| 5 | **命令结果类型化**：`CommandDefinition<TPayload, TResult>`，让 `actorResults[].result` 有类型 | 直接消掉调用点的手工剥壳 |
| 6 | **request ledger 加显式上限与过期策略**，并暴露当前条目数供诊断 | 终端长期运行 |
| 7 | **`displayContext` 从构造期单值改为按 surface 解析** | TER 一个 runtime 服务两块屏时必须（讨论稿 §7.2） |
| 8 | 吸收 `execution-runtime` 的 **middleware 链**作为横切扩展点（`k-04` §7） | 广播 actor 模型缺"每条命令都要做的事"这个位置 |

## 8 · 证据档位

- 模块排序、启动序列、dispatcher、state sync 接口：`已亲验`，源码逐行读过。
- §3 的同步模型结论：`已亲验`。穷举范围＝`1-kernel` `2-ui` `3-adapter` 下 `*.ts`，
  `applySyncEntries` 命中 2 处（均为定义）、`mergeSyncRecordState` 生产命中 1 处（自身分支内）、
  `'latest-wins'` 生产命中 2 处（类型声明 + 不可达三元）。
- §6.4（ledger 无上限）：`推论`，未逐行读完 `requestLedger.ts` 427 行，TER 落地前需复验。
