# `@next/kernel-base-state-runtime`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F2** —— 核心继承对象；`N-9` 刷盘失败静默必须先修 |
| 路径 | `1-kernel/1.1-base/state-runtime` |
| 规模 | src **1,617 行 / 25 文件**；test **1,513 行** |
| 依赖 | `contracts` · `platform-ports` · `@reduxjs/toolkit` |
| 被依赖 | 声明 15 个包，源码实际 import **17 个** |
| 状态 | 活跃，POC 里质量最高的包之一 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**Redux store + 持久化 + 同步声明的统一基座。** 业务 slice 只**声明意图**，
落盘策略、存储后端选择、刷盘时机、同步方向全部在这里收敛。

README 原话："比旧 `redux-persist` 更适合当前业务，因为旧方式往往只能把整个 slice 存成一个大对象。"

## 2 · 核心抽象：六字段 slice descriptor

```ts
interface StateRuntimeSliceDescriptor<State> {
    name: string
    reducer?: Reducer<State>
    persistIntent: 'never' | 'owner-only'
    syncIntent?: 'isolated' | 'master-to-slave' | 'slave-to-master'
    persistence?: readonly StateRuntimePersistenceDescriptor<State>[]
    sync?: StateRuntimeSyncDescriptor<State>
}
```

### 持久化描述符两种形态

| kind | 存储形态 | 适用 |
|---|---|---|
| `field` | 一个字段一个 storage key：`<persistenceKey>:<slice>:<stateKey>` | 固定字段 |
| `record` | 一条 entry 一个 key + 一个 `__manifest__` key 记录 entry 列表 | 动态 Record 状态 |

两者共有：`protection: 'plain' \| 'protected'`（选普通/加密 storage port）、
`flushMode: 'immediate' \| 'debounced'`、`shouldPersist` / `shouldPersistEntry` 谓词。

### 同步描述符

`sync: {kind: 'record', getEntries?, applyEntries?}`，值包 `SyncValueEnvelope {value, updatedAt, tombstone}`。

## 3 · 关键实现

### 3.1 store：无 redux-persist，71 行

`foundations/store.ts` 是纯 RTK `configureStore`，额外只加两个根 action：
`@@kernel.base.state-runtime/replace`（合并 slice patch）与 `/reset`（整体回初始值）。
`serializableCheck` 与 `immutableCheck` 关闭（性能取向）。

### 3.2 变更侦测：引用相等 + 只看 persistable slice

```ts
store.subscribe(() => {
    for (const slice of persistableSlices)
        if (previousRefs.get(slice.name) !== state[slice.name]) changed.push(slice.name)
    ...
})
```

配合 RTK/immer 的不可变更新，引用比对即可。**只遍历 persistable slice**，不是全量 state 深比。

### 3.3 刷盘模式按变更 slice 计算

`collectPersistenceModes(state, changedSliceNames)` 收集本次变更涉及的 descriptor 的 `flushMode`，
有 `immediate` 就立刻刷，否则走 debounce（默认由参数目录给）。
判断里额外看 `persistedValueCache.has(key)` —— **让"字段被删除"也能触发刷盘**，
而不是只有"字段有值"才刷。这个细节容易漏，这里做对了。

### 3.4 刷盘：串行链 + 陈旧键清理 + 存储迁移

- `persistenceChain = persistenceChain.catch(()=>undefined).then(async () => {...})` —— **刷盘串行化**，
  前一次失败不阻塞后一次；
- 计算 `stalePlainKeys` / `staleProtectedKeys`：本次不再存在的 key、以及**存储类别发生迁移的 key**
  （plain→protected 或反向）都会从旧后端删除；
- record 型每次重写 `__manifest__`；
- **`protectedStorage` 缺失但存在 protected 条目 ⇒ 抛 typed error**（fail closed）。

### 3.5 hydrate：manifest 驱动，坏 JSON 容错

- field：一次 `getItem`；
- record：先读 `__manifest__` 拿 entry 列表，再逐条 `getItem`；
- `decodeEntry` 对坏 JSON 返回 `undefined` ⇒ 该条跳过，**不影响整体 hydrate**；
- protected storage 缺失 ⇒ 抛；plain storage 缺失 ⇒ `continue`。

### 3.6 scoped slice：一份声明展开成多份 slice

`supports/scopedSlice.ts` 提供三轴 `workspace` / `instanceMode` / `displayMode`。
`createScopedStateSlice` 用同一组 reducers 生成 N 个 slice；
`toScopedSliceDescriptors` 让每个 scope 值可以有**不同的** persist/sync 意图：

```ts
syncIntent: {main: 'master-to-slave', branch: 'slave-to-master'}
```

配套 `createScopedActionType` / `createScopedDispatchAction` 把 action type 重写到对应 scope。

### 3.7 同步算法（`supports/sync.ts`）

`createSliceSyncSummary` → `createSliceSyncDiff(remoteSummary)` → `applySliceSyncDiff`。
两种模式：`latest-wins`（按 `updatedAt` 比大小）与 `authoritative`（权威方直接覆盖，可选 `replaceMissing` 造墓碑）。
tombstone 在 latest-wins 下合并后被 `delete`，在 authoritative 下显式删除。

## 4 · 依赖关系

- **出边**：`contracts`、`platform-ports`、RTK。
- **入边**：几乎所有有状态的包 + `host-runtime-rn84`。

## 5 · 优点

1. **声明式意图是这个代码库最好的一个想法。** 六个字段表达完"什么落盘/什么粒度/哪个后端/何时刷/往哪同步"，
   约 40 个 slice 在用，业务包写**零行**持久化与同步代码。
2. **按字段/按条目落盘**，避免整块 blob 的写放大与恢复粒度问题。
3. **普通/加密双后端 + 缺失时 fail closed**，让 `protection: 'protected'` 有真实落点而不是注释。
4. **存储类别迁移会清理旧后端的键** —— 把一个字段从 plain 改成 protected 时，
   旧的明文副本会被删掉。这个细节多数实现会漏。
5. **坏 JSON 单条跳过**，一条损坏不会让整个终端起不来。
6. **刷盘串行化**，不会并发写打架。
7. **scoped slice 三轴**把"同一类状态按屏/角色存多份"从每包手写变成声明一个轴。
8. **同步算法与"哪些 slice 参与同步"彻底分开**（算法在这里，声明在各 slice），
   注释里写明了这个设计意图。
9. **1,513 行测试**，与源码几乎 1:1。

## 6 · 缺点 / 风险

### 6.1 自动刷盘的失败是静默的

```ts
if (mode === 'immediate') { ...; void flushPersistence(); return }
flushTimer = setTimeout(() => { flushTimer = null; void flushPersistence() }, debounceMs)
```

两条自动路径都是 `void flushPersistence()` —— **返回的 Promise 被丢弃**。
手动调 `flushPersistence()` 的调用方能拿到异常（末尾 `await persistenceChain` 会重抛），
但**自动持久化写盘失败没有任何信号**：不打日志、不改 state、不上报。
终端存储写满或权限异常时，界面一切正常，重启后状态丢失。

### 6.2 每次刷盘全量重写，不做差量

`setEntries(plainStorage, nextPlainEntries)` 里的 `nextPlainEntries` 是**当前全部**持久化条目。
`persistedValueCache` 只用于"陈旧键清理"，**没有用来跳过未变化的条目**。
所以 N 个持久化条目时，任一条变化都会写 N 次。debounce 摊薄了频次，没有摊薄单次成本。

### 6.3 `resetState` 清空整个存储后端，不按前缀

```ts
const clearStorage = async (storage) => {
    if (storage.clear) { await storage.clear(); return }
    const keys = await storage.getAllKeys?.()
    if (keys?.length) await removeKeys(storage, keys)
}
```

键本身是有前缀的（`<persistenceKey>:...`），但清理**不按前缀过滤**。
若宿主把同一个 MMKV 实例同时给了别的用途（当前 assembly 的 version-report outbox 就用了独立 namespace，
说明这种共享是会发生的），`resetState` 会一并清掉。

### 6.4 hydrate 是 N+1 次 `getItem`，没用 `multiGet`

`StateStoragePort` 提供了可选的 `multiGet`，`hydrate` 路径**完全没用**（`flush` 路径用了 `multiSet`/`multiRemove`）。
record 型 slice 有 M 个 entry 就是 M+1 次跨 JSI 调用。冷启动路径上这是可测量的成本。

### 6.5 坏 JSON 静默跳过，无观测

`decodeEntry` 吞掉 `JSON.parse` 异常返回 `undefined`，调用方 `continue`。
容错是对的，**但没有一条 warn 日志**说"某个 key 的持久化内容已损坏并被丢弃"。
现场表现是"某个设置莫名其妙回到默认值"，且无从查起。

### 6.6 plain 与 protected 缺失时的处理不对称

protected 缺失 ⇒ 抛；plain 缺失 ⇒ `continue` 静默跳过。
后者意味着**宿主忘记注入 `stateStorage` 时，整个持久化静默不工作**，
而 `persistenceEnabled` 仍是 `true`（它只看 `persistenceKey` 与 `allowPersistence`）。

### 6.7 `syncIntent` 与 `sync` 描述符可以不一致

`syncIntent: 'master-to-slave'` 但 `sync` 未定义时，`applySliceSyncDiff` 直接 `return state`（静默不同步）。
两个字段之间没有类型约束或运行期校验。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **整体继承六字段 descriptor 与两种持久化粒度** | 这是本包的核心价值，直接可用 |
| 2 | **自动刷盘失败必须可观测**：`void flushPersistence()` 改成带 `.catch()` 打 error 日志 + 置一个 `persistenceHealth` 状态位 | 静默丢状态是 POS 上最难查的一类故障（§6.1） |
| 3 | **刷盘做差量**：用 `persistedValueCache` 比对 encoded 值，只写变化条目 | 缓存已经在那了，只差一步比较（§6.2） |
| 4 | **`resetState` 按 `persistenceKey` 前缀清理**，不调 `storage.clear()` | 避免误伤共享后端（§6.3） |
| 5 | **hydrate 用 `multiGet`**（端口已提供），并把 record 型的 manifest+entries 合成一次批读 | 冷启动路径，收益直接（§6.4） |
| 6 | **坏 JSON 跳过时打 warn**，带 storageKey 与原始长度 | 容错但要留痕（§6.5） |
| 7 | **端口缺失统一 fail-fast**，与 `platform-ports` 的 `requiredCapabilities` 改造一起做 | 消掉 plain/protected 的不对称（§6.6） |
| 8 | **`syncIntent` 与 `sync` 的一致性在 descriptor 构造时校验** | 声明了方向却没有 sync 描述符 = 契约撒谎 |
| 9 | **同步的时间戳来源改为可注入 clock**（配合 `contracts` 的时间源改造） | `FIX-05` 的落点之一 |
| 10 | **新增一档"真相不在 KV"的来源语义**（为 SQLite 类数据预留），但**当前不实现** | Dexter 已裁定等真实业务再补 |
| 11 | scoped slice 三轴继承；TER 单机双屏改一个 store 后，`workspace: main/branch` 直接承载双屏 | 见讨论稿 §7.2 |

## 8 · 证据档位

全部 `已亲验`：`foundations/createStateRuntime.ts` 全文 690 行、`foundations/store.ts`、
`supports/scopedSlice.ts`、`supports/scope.ts`、`supports/sync.ts`、`types/*` 逐个读过。
§6 的七条均由具体代码分支得出，行为结论未做运行验证（`推论`，推导链已在各条写出）。
