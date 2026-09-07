# `kernel.base.state` · 状态、持久化与同步的执行机制

| 字段 | 值 |
|---|---|
| npm 名 | `@catering-v2s/kernel-base-state` |
| moduleName | `kernel.base.state` |
| 层 | `kernel/base` |
| kind | `toolkit` —— **不拥有任何 slice**（`TR-09`） |
| 依赖 | `contracts` · `platform-ports` · `@reduxjs/toolkit` |
| 构造输入 | 两个存储端口 · `LoggerPort` · `persistenceKey` · 三类 timeout · slice registration 集合 |

---

## 1 · 这个包是什么

**它是「按声明执行」的那一半。** 业务包声明*要什么*，本包负责*怎么做到*：

> owner 声明「这个字段要落盘、按条目落、放加密后端、立即刷」，
> 本包负责枚举、编解码、差量比对、逐键提交、失败可见、重启恢复。

一个叫 `state` 的包**不持有任何状态**。`TR-09` 规定 `toolkit` 不得拥有 slice，
所以 `src/**` 里不会有 `createSlice`，也不会导出任何具体的 registration 实例。

## 2 · 什么该进来 —— 一条判别式

> **它是「机制」还是「策略」？**
> 所有 owner 都一样的做法 = 机制，进来；
> 某个 owner 才知道的取舍 = 策略，留在那个包里。

| 机制（本包） | 策略（owner 包） |
|---|---|
| 怎么枚举、怎么编码、怎么比对、怎么提交 | **哪些字段**要落盘、**哪条 entry** 值得存 |
| 失败怎么表达、健康位怎么算 | 失败了**界面**怎么显示 |
| authoritative diff 怎么算、怎么应用 | **哪个 slice**参与同步、往**哪个方向** |
| 存储键的语法与冲突检查 | 存储键叫什么名字 |

## 3 · 它不是什么

| 不是 | 为什么 |
|---|---|
| 业务状态 owner | 没有自己的 slice，也没有业务字段 |
| 通用 KV 抽象层 | 只经 `StateStoragePort`，且只为 state runtime 服务 |
| 同步协议 | **不维护会话、序号、游标、重传、冲突解决** —— 那些归 topology |
| display / instance 轴的 owner | 只提供 `workspace` 的 `MAIN`/`BRANCH` 一轴（见 §6.6） |

---

## 4 · 目录结构

```text
src/
  types/
    value.ts        StateJsonValue —— JSON-safe 值的闭合递归联合
    persistence.ts  descriptor · timeout policy · failure/health · operation result
    slice.ts        公开 descriptor、opaque registration、以及**内部 erased 形态**
    sync.ts         envelope · summary · diff（full 与 partial 用判别式分开）
    runtime.ts      构造输入 · StateRuntime facade · reset actor
    workspace.ts    MAIN/BRANCH 单轴类型
  foundations/
    defineStateRuntimeSlice.ts  四条双向校验 + WeakMap 支撑的 opaque registration
    keyspace.ts                 key 语法、解析、冲突检查（**唯一**产生存储键的地方）
    persistenceCodec.ts         JSON-safe 校验、canonical 编解码（**唯一**的 canonical 实现）
    createStateStore.ts         preloaded store 与两个**私有** root action
    persistencePrimitives.ts    descriptor · keyspace grouping · failure helpers
    persistenceHydration.ts     hydrate · migration discovery · initial health
    persistenceEngine.ts        差量 flush · 迁移 · reset · 队列 · health
    createStateRuntime.ts       async 装配，唯一对外 facade
  foundations/
    sync.ts       summary / diff / full payload / apply / tombstone（**纯函数，零状态**）
    workspace.ts  workspace 的 key、dispatcher 与 descriptor 展开
test/
  descriptor.test.ts · persistence.test.ts · sync.test.ts · workspace.test.ts
  public-surface.typecheck.ts   ← 只进 tsc，不进 vitest
```

---

## 5 · 用法

### 5.1 owner 声明一个 registration

```ts
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';

export const cartRegistration = defineStateRuntimeSlice({
  name: 'kernel.feature.cart',        // 必须以本包 moduleName 为前缀（TR-09）
  reducer: cartSlice.reducer,          // 必填
  persistIntent: 'owner-only',
  persistence: [
    {kind: 'field', stateKey: 'lastOrderId'},
    {
      kind: 'record',
      storageKeyPrefix: 'lines',
      protection: 'plain',
      flushMode: 'debounced',
      getEntries: (state) => state.lines,                       // 必填
      applyEntries: (state, lines) => ({...state, lines}),      // 必填
      shouldPersistEntry: (_key, line) => line.quantity > 0,
    },
  ],
});
```

**四条一致性在构造时就报错，不是运行期才发现**：
`owner-only` 必须有非空 `persistence` · `never` 必须没有 ·
非 `isolated` 的 `syncIntent` 必须有 `sync` · `isolated` 或未声明必须没有 `sync`。

⚠️ **`registration` 是不透明的**：它只暴露五个元数据，具体回调封在包内 closure 里。
外部写不出这个对象（brand 是未导出的 `unique symbol`），伪造的也进不去（WeakMap 双关）。

### 5.2 装配 runtime —— 注意它是 `async` 的

```ts
const runtime = await createStateRuntime({
  runtimeName: 'terminal',
  environmentMode: 'DEV',
  slices: [cartRegistration, sessionRegistration],
  logger: ports.logger,
  plainStorage: ports.persistKv,
  protectedStorage: ports.persistSecure,
  persistenceKey: 'pos-01',
  storageTimeouts: {readMs: 2000, writeMs: 2000, resetMs: 5000},
  persistenceDebounceMs: 300,
});
```

🔴 **`await` 返回时，恢复已经完成。** 校验 → 枚举 → 读取 → 解码 → 构建 `preloadedState` →
`configureStore` → 订阅，全部做完才 resolve。**调用方永远拿不到「store 已可用但状态还没回来」的中间态。**

⚠️ **配置错误直接抛**（重复 slice 名、descriptor 冲突、非法 timeout 或 key）——
它们是程序员错误，必须炸掉装配。
⚠️ **端口失败不抛**：返回一个初始或部分恢复的 store，用 health 与日志表达。
这两类的区别就是「写错了」和「这台机器这次读不到」。

### 5.3 消费与健康位

```ts
const store = runtime.getStore();          // 交给 react-redux

const health = runtime.getPersistenceHealth();
if (health.status === 'degraded') {
  // health.lastFailure / dirtyKeys / blockedStorageKinds
}
const unsubscribe = runtime.subscribePersistenceHealth((next) => { /* … */ });
```

⚠️ **health 不是 slice**（`TR-09` 不允许），它是 runtime 上的冻结快照 + 订阅。
**本包只负责让失败可被读到，不负责呈现** —— 要展示就由某个 owner 订阅后写进自己的 slice。
⚠️ `subscribe` 不会立即回调：先 `getPersistenceHealth()` 拿当前值，再订阅增量。
⚠️ `lastFailure` 是**历史值**，恢复为 `healthy` 后仍可能非空 —— **判据是 `status`，不是 `lastFailure` 是否存在**。

### 5.4 reset 与同步

```ts
await runtime.getResetActor().handleResetCommand();       // 唯一的 reset 入口

const payload = runtime.createFullSyncPayload('kernel.feature.cart');
if (payload.status === 'ready') { /* 交给 topology 发送 */ }

runtime.applyAuthoritativeSync('kernel.feature.cart', incoming);
```

**未注册或未声明 `sync` 的 slice 一律返回 `skipped` 并 warn**，不会被写。
**本包不决定方向、不发送、不接收、不重传** —— 那些是 `topology` 的事。

---

## 6 · 七个非显然的取舍 —— 光看代码得不到

### 6.1 恢复走 `preloadedState`，不是 action

`TR-01` 说 reducer 只能被 actor 调用。若 hydrate 用一个 root action 把数据塞回去，
就绕过了每个 owner 的 reducer。**改成构造期 `preloadedState` 之后，运行期根本没有这次写入** ——
既满足 `TR-01`，又顺带消掉了「hydrate 期间用户 dispatch 会被覆盖」的竞争窗口。

### 6.2 生产路径**永不使用** `writeMany` / `removeMany` / `clear`

`StateStoragePort` 的批量方法**只返回整批一个 `PortResult`，没有 per-key 状态，也不承诺原子性**。
而差量写入必须知道**哪一个键**成功了才能前移缓存 —— 批量方法给不了这个粒度。
⇒ 写与删**逐键**进行；`clear` 会跨越 namespace 删掉别人的键，所以有一道门禁止它出现。

### 6.3 record **不用** `__manifest__`

POC 用一个额外的 manifest 键记录 entry 列表，于是 manifest 与 entries 之间有一个
**没有提交协议的窗口**（manifest 写成功而 entry 失败 ⇒ 指向不存在的条目）。
TER 的 `listKeys` 是**必填**方法，直接枚举就知道有哪些条目 ——
**删掉一个键、删掉整套提交协议**，比补 generation/commit-marker 简单得多。

### 6.4 record 的每个 entry 是**独立提交单元**

**本包不承诺整份 record 的「全有或全无」。** 端口给不了这个保证，所以不假装有。
批写部分成功后重启，得到「新 a + 旧 b」是**合法结果**，不是 bug。
⇒ 需要整份原子的业务出现之前，不建事务端口、不建 generation 协议。

### 6.5 读失败之后**宁可不写**

读不到盘上有什么，就不知道什么是「陈旧键」。此时若拿空缓存去清理，**会删掉真实数据**。
⇒ 读失败的后端进入 `blocked`，后续第一次 flush 做**一次有界 re-baseline**：
成功则解除并继续写，失败则**本进程内不再周期重试**，直到一次成功的 reset。

⚠️ **这是一个明确的取舍，不是遗漏**：代价是一次启动期读失败可能让该后端在本进程内不再持久化；
换来的是绝不发生「读失败之后的破坏性写入」。health 会一直是 degraded 并列出 `blockedStorageKinds`。

### 6.6 只有 `workspace` 一轴

POC 有 `workspace` / `instanceMode` / `displayMode` 三轴。穷举实测：`workspace` 的 helper
有 3 个生产消费者，另两轴**各 0 个**。⇒ 本包只建 `workspace`。
`containerKey` 与随 command 传入的 `displayMode` 是**同一个 owner slice 内部的路由键**，
不是需要拆成多份 reducer 的物理轴。

```ts
const registrations = toWorkspaceStateDescriptors({
  baseName: 'kernel.feature.cart',
  reducers: {MAIN: mainReducer, BRANCH: branchReducer},
  createDescriptor: (workspace, name, reducer) => ({name, reducer, persistIntent: 'never'}),
});
```

### 6.7 `valueHash` 不是摘要

`SyncStateSummaryEntry.valueHash` 的值是 `json:<canonical-json>` —— **完整序列化，不是短摘要**。
这样没有碰撞、不引入哈希依赖，但**它的大小等同于全量数据**。
⇒ 不要基于「摘要很便宜」去设计定期对账协议。

---

## 7 · 跨 owner 的边界 —— 你的 slice 什么时候会被本包改写

持久化与同步**天然要跨 owner 读写**，这在正本里是一条**具名例外**
（`terminal-coding-standard.md` 的 `TR-09` 下《`kernel.base.state` 的持久化与同步》一节）。

| 路径 | 是不是外部写入 | 说明 |
|---|---|---|
| 恢复 | **否** | 构造期 `preloadedState`，运行期无写入（§6.1） |
| 重置 | **否** | 根级 reset 把 `undefined` 交给 combined reducers，**各 owner 自己的 reducer 返回自己的初始值** |
| **同步落地** | **是** | **唯一的例外**：`applyAuthoritativeSync` 整体替换该 slice |

**边界**：只写声明了 `sync` 的 slice · 键必须来自已注册 registration 的 `name` ·
**不导出任何「写任意 slice」或「读具名他包 slice」的便捷入口** ·
root action 的 type 与 creator 全部 package-private。

⚠️ `getStore()` / `getState()` 返回的是 **Redux 原生根** —— 它结构上藏不住（`useSelector` 需要它）。
跨包读的执行机制是 **`TR-03` 的门**，不是根类型不可索引。**不要在它之上再加一层具名访问器。**

---

## 8 · 在这个包上迭代时

### 8.1 改一处，要同步改这几处

| 动作 | 必须同步 |
|---|---|
| **加/改一个公开导出** | ① `src/index.ts` 逐项显式导出；② 门里的 `expectedPublicExports`；③ 详设的 exact list。**三方精确相等，漏一处门就红** |
| **加一个存储键的形态** | `keyspace.ts` 是**唯一**产生键的地方；必须同时补冲突检查与可逆编码往返用例 |
| **加一种持久化粒度** | 公开 descriptor 联合 + **内部 erased 形态** + 引擎的三条路径（hydrate/flush/迁移）+ 对应用例 |
| **动 `sensitive`/`canonical` 编码** | `persistenceCodec.ts` 是**唯一**的 canonical 实现，`foundations/sync.ts` 复用它。**不要在同步侧再写一份** |

⚠️ 门里的 expected 清单是**手写常量**，**不得改成从源码自动派生** —— 否则多出来的导出永远抓不到。

### 8.2 必跑

```bash
yarn workspace @catering-v2s/kernel-base-state typecheck
```

```bash
yarn workspace @catering-v2s/kernel-base-state test
```

```bash
node tools/terminal-state/check-static.test.mjs && node tools/terminal-state/check-static.mjs
```

四道门：`toolkit-zero-slice`（`src/**` 零 `createSlice`）· `tr05-named-boundary` ·
`storage-result-consumed`（**不得丢弃端口返回值**）· `no-storage-clear`，外加一条公开面精确相等。

### 8.3 踩过的坑，不要踩回去

- **`tsconfig.json` 的 `include` 必须含 `test/**`**，否则 `public-surface.typecheck.ts` 的
  `@ts-expect-error` 不被求值，负夹具全部假绿。验证办法：删掉一行该注释，`typecheck` 必须变红。
- **不要写「`any` 不可赋值」的负夹具** —— `any` 可赋给任意类型，那行只会得到
  `unused @ts-expect-error`。显式 `any` 归门管，类型层夹具用 `unknown` 或缺字段的形状。
- **端口返回值必须判别五态**。TER 的端口**不抛异常**，`status: 'failed'` 是一个返回值 ——
  不看它就等于当成功，而且没有任何 lint 会提醒你。有一道门专门扫这个。
- **写失败的键不得进入已落盘缓存**，否则它永远不会被重试。
- **`types/slice.ts` 里的 `RegisteredStateRuntimePersistence` 必须保持判别式联合**：
  field 分支的 `stateKey`、归一化 `storageKey`、`readField`、`writeField` 必须齐全，
  record 分支的归一化 `storageKeyPrefix`、`getEntries`、`applyEntries` 必须齐全；
  不允许回退成「`kind` + 一堆可选字段」。引擎据此不使用可选链或字面量兜底，缺失在
  构造期断言/类型层 fail closed，而不是静默丢数据。新增 descriptor kind 时必须新增完整分支，
  并同步构造期校验、引擎消费与门测试。
- **持久化职责按自然边界分开**：`persistencePrimitives.ts` 持有 descriptor/key/cache 的共享纯原语，
  `persistenceHydration.ts` 负责 hydrate 与 migration discovery，`persistenceEngine.ts` 负责已 hydrated
  状态的 flush、迁移执行、reset、队列与 health；三者共享既有类型和结果语义，不新增 public facade。

### 8.4 遇到这些停下来问，不要自己决定

需要给整份 record 加事务或 commit marker · 需要改 `StateStoragePort` ·
需要新增第三个 root action · 需要导出「写任意 slice」或「读具名 slice」的入口 ·
需要恢复 `latest-wins`、序号、游标或任何接收方账本 · 需要新增第二条正本例外。
