# `@next/kernel-base-topology-runtime-v3`

| 字段 | 值 |
|---|---|
| **TER 批次** | **拆两半** —— 上下文半边 → **批 F · F4b**；链路半边 → **批 D**。见 `00-ter-build-order` §3 |
| 路径 | `1-kernel/1.1-base/topology-runtime-v3` |
| 规模 | src **3,070 行 / 37 文件**；test 2,344 行 |
| 依赖 | 只声明 `contracts`（实际还 import `runtime-shell-v2` / `state-runtime` / `transport-runtime`） |
| 被依赖 | 10 个包 |
| 状态 | 活跃；**是 TER 单机双屏改造的核心接触面** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**一主一副（pair）拓扑控制面。** 管：谁是主谁是副、连接与重连、远程 command 转发、
request 生命周期镜像、state 同步、最小恢复信息（masterLocator）。

它**不管**：业务状态仓库、业务 command 结果解释、UI 渲染、哪些 state 该同步（那是 slice 自己声明）。

## 2 · 运行上下文推导

```ts
standalone   = displayIndex === 0
instanceMode = config ?? (standalone ? 'MASTER' : 'SLAVE')
displayMode  = config ?? (standalone ? 'PRIMARY' : 'SECONDARY')
workspace    = (instanceMode === 'SLAVE' && displayMode === 'PRIMARY') ? 'BRANCH' : 'MAIN'
enableSlave  = config ?? (displayCount > 1 && standalone)
```

四个场景统一成同一个 pair 模型（详见 `KEEP-11`），真正的差异只在**宿主约束**：

| | managed secondary | standalone slave |
|---|---|---|
| 判据 | `displayCount > 1 && displayIndex > 0` | `displayIndex === 0 && instanceMode === 'SLAVE'` |
| 本地业务持久化 | ❌ 禁 | ✅ 允许 |
| 自己 bootstrap TCP 身份 | ❌ | ✅ |
| displayMode 可切 | ❌ | ✅（电源策略） |

## 3 · 状态：八个 slice，只有一个持久化

| slice | persistIntent | syncIntent |
|---|---|---|
| `configState`（instanceMode / displayMode / enableSlave / **masterLocator**） | **`owner-only`** | `isolated` |
| `contextState` · `connectionState` · `hostState` · `peerState` · `syncState` · `requestMirrorState` | `never` | `isolated` |
| `demoSyncState`（两份） | `never` | 一份 `master-to-slave`、一份 `slave-to-master` |

**只持久化 masterLocator 这一族**，正是"最小恢复集"：slave 重启后靠它重新找到 master，
其余全部由重连重建。`contextState` 不持久化——它由 `displayIndex/displayCount` 每次重新推导。

`demoSyncState` 是**内建的双向同步探针**（方法论文档里的
`upsert-demo-master-entry` / `upsert-demo-slave-entry`），用于在不碰业务的前提下
证明"拓扑同步通道本身是否健康"。

## 4 · 三个值得单独讲的设计

### 4.1 eligibility 返回原因码，不是布尔

```ts
getTopologyV3TcpActivationEligibility(...) => {allowed: false, reasonCode: 'managed-secondary'}
```

七种原因码：`master-unactivated` · `already-activated` · `managed-secondary` · `slave-instance` ·
`activated-master-cannot-switch-to-slave` · `master-primary-enable-slave` · `standalone-slave-only-display-mode`。

⇒ UI 不只是"按钮置灰"，而是能说清**为什么不能**。
这与 v2s 后台规范 2-H 讲的 `deletionAvailability: {blocked, reason, count}` 是同一个形态。

### 4.2 peer command 转发 + request 镜像

`target: 'peer'` 的 command 经 `TopologyPeerOrchestratorV3` 转发；
远端的 `command-event`（accepted/started/resultPatch/completed/failed）回流本机 request ledger。

⇒ **本机不会在远端刚开始时就显示 completed**。V3 设计文档把这条列为必须保留的旧工程优点。

### 4.3 同步权威由 `syncIntent` 静态决定

`foundations/syncRegistry.ts` 的 `filterSlicesByDirection` ——
一个 slice 只有一个权威方，另一端只收不发；模式恒为 `authoritative`。
详见 `k-07` §3。**这是本轮推翻我 `FIX-05` 判断的关键证据所在地。**

## 5 · 优点

1. **pair 模型统一四场景**，且是**推翻"图网络"后的结论**（设计文档 §1.4 记录了被证伪的上一版）。
2. **只持久化 masterLocator**，恢复集最小（§3）。
3. **eligibility 带原因码**（§4.1）——很少见，很有用。
4. **内建双向同步探针**，能在不碰业务的前提下定位"是通道坏了还是业务坏了"（§3）。
5. **request 镜像**让跨机命令的进度是真实的，不是本机猜的（§4.2）。
6. **V3 主动做减法**：明确移除 ticket、resume barrier、summary/diff/commit 三段协商
   （设计文档 §7.2 / §8.2），理由写得很清楚——"图模型和重 barrier 只会增加脆弱性"。
7. **reconnect 间隔走参数目录**，可远端调，测试可覆写。
8. **宿主约束（managed secondary vs standalone slave）明确不进 core 模型**，
   只留在 assembly/host —— 边界判断准确。

## 6 · 缺点 / 风险

1. **`package.json` 只声明 `contracts` 一个 `@next` 依赖，实际 import 四个**
   （`runtime-shell-v2` / `state-runtime` / `transport-runtime` 都在源码里用了）。
   这正是 `CON-03` 说的"Yarn hoist 让未声明依赖照样能 import"的**真实实例**。
   ⇒ 依赖门若只查 `package.json`，这个包会通过；实际依赖图与声明不符。
2. **`connectionController.ts` 667 行**，一个文件里同时有：socket 连接、hello 握手、
   重连节奏、远程命令派发、request 镜像、state 快照/增量发送、错误归一化。
3. **`demoSyncState` 是生产代码里的测试设施**（两个 slice + 一个 actor + 若干 command）。
   它有价值（探针），但按当前形态它会被打进产品包。
4. **`supports/sharePayload.ts` 259 行**处理配对二维码的编解码，
   与拓扑控制面耦合在同一个包里，而它本质是一个序列化格式。
5. **`isolated` 与 `undefined` 的 syncIntent 语义等价**，但表达方式不统一
   （`syncRegistry` 里写 `slice.syncIntent === 'isolated' || !slice.syncIntent`）。

## 7 · 【TER 关键】这个包是单机双屏改造的接触面

Dexter 已裁定：**一个 ReactHost 挂多 surface、共享 Hermes VM、一个 store**。

对本包的影响：

| 当前 | TER |
|---|---|
| 同机双屏 = 两个进程两个 runtime，走设备内 WS | 同机双屏 = **同一个 runtime、同一个 store、零传输** |
| `target: 'peer'` 在同机也走网关 | 同机 `target: 'local'` 即可，**peer gateway 只在跨机时安装** |
| managed secondary 禁本地持久化的闸门 | **自动消失**（只有一个持久化 owner） |
| `contextState` 由单一 `displayIndex` 推导 | 需要**按 surface 解析**（一个 runtime 服务两块屏） |

⇒ **kernel 的 command/actor/slice 语义一行不用改**（接缝是 `installPeerDispatchGateway`），
但 `contextState` 的推导需要从"进程级单值"改成"surface 级"。

## 8 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **pair 模型 + eligibility 原因码 + 最小恢复集整体继承** | 已被证伪过一次的方向不要重走（`KEEP-11`） |
| 2 | **`contextState` 从进程级单值改为 surface 级解析** | 一个 runtime 服务两块屏的必要改造（§7） |
| 3 | **同机不安装 peer gateway**，`target` 判别式改为"对端在不在本机" | 零传输、零延迟、零失败模式（讨论稿 §7.2） |
| 4 | **`syncIntent` 的 authority 模型写进 TER 编码规范** | POC 做对但没写下来（`k-07` §3） |
| 5 | **`connectionController` 按职责拆**：连接/握手、远程命令、state 同步各自成文件 | 667 行一个文件（§6.2） |
| 6 | **同步探针保留但移出产品包**（放进 test-support 或按构建变体剔除） | 探针有价值，但不该进产品包（§6.3） |
| 7 | **`sharePayload` 独立成序列化包或并入 adapter 的 scanner 能力** | 它是格式不是拓扑（§6.4） |
| 8 | **依赖声明补全并加机械门**（声明完整性断言，见 `CON-03`） | 本包正是反例（§6.1） |
| 9 | **`syncIntent` 改为必填**，`isolated` 显式写出 | 消掉 undefined 与 isolated 的双重表达（§6.5） |

## 9 · 证据档位

- 上下文推导、eligibility、slice 意图、syncRegistry、reconnect 参数：`已亲验`。
- 依赖声明不全：`已亲验`（`package.json` 只有 `contracts`；源码 `rg '@next/'` 命中四个包）。
- **未逐行读**：`connectionController.ts` 667 行（读了结构与关键函数，未逐行核对错误分支）、
  `hostLifecycleActor.ts` 269 行、`sharePayload.ts` 259 行。
