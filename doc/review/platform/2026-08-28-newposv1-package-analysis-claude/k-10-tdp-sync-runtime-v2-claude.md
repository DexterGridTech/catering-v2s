# `@next/kernel-base-tdp-sync-runtime-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 D · 延后** —— 同上；`terminal-data-server` 当前是空占位。且需按 owner 拆成三个包 |
| 路径 | `1-kernel/1.1-base/tdp-sync-runtime-v2` |
| 规模 | src **6,903 行 / 60 文件**（kernel 最大包）；test **7,078 行**（全仓测试最多） |
| 依赖 | `contracts` · `platform-ports` · `runtime-shell-v2` · `state-runtime` · `transport-runtime` · `tcp-control-runtime-v2` · `server-config-v2` |
| 被依赖 | 8 个包 |
| 状态 | 活跃；能力强，但**一个包承担了五件事** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**终端数据平面（TDP = Terminal Data Plane）同步。**
服务端把业务主数据以 projection 形式下发，终端保存**全量 projection 仓库**，
按 scope 优先级算出"当前生效值"，再把**生效变化**广播给业务模块。

README 的关键设计判断：
> 终端必须保存完整 projection 仓库，重启后才能重新计算生效值。

## 2 · 协议面

### 上行（客户端 → 服务端）
`HANDSHAKE` · `PING` · `STATE_REPORT` · `ACK` · `BATCH_ACK`

`HANDSHAKE` 携带 `lastCursor` / `subscribedTopics` / `requiredTopics` / `subscriptionHash` /
`previousAcceptedSubscriptionHash` / `runtimeIdentity{localNodeId, displayIndex, displayCount, instanceMode, displayMode}`
与三个 capability：`tdp.topic-subscription.v1` · subscription-hash · snapshot-chunk。

### 下行（服务端 → 客户端）
`SESSION_READY` · `FULL_SNAPSHOT` · `SNAPSHOT_BEGIN` / `SNAPSHOT_CHUNK` / `SNAPSHOT_END` ·
`CHANGESET` · `PROJECTION_CHANGED` · `PROJECTION_BATCH` · `COMMAND_DELIVERED` · `PONG` ·
`EDGE_DEGRADED` · `SESSION_REHOME_REQUIRED` · `ERROR`

### HTTP 旁路
```
GET /api/v1/tdp/terminals/{terminalId}/snapshot
GET /api/v1/tdp/terminals/{terminalId}/changes
```
**"推"走 WS，"拉"走 HTTP** —— 这个混合从一开始就是这样，不是后补的。

## 3 · 状态模型：七个 slice

| slice | persistIntent | 语义 |
|---|---|---|
| `tdpSync` | `owner-only`（只存 `lastCursor` / `lastAppliedRevision` / 订阅 hash / `serverClockOffsetMs` 等**最小恢复集**） | 同步游标与订阅协商状态 |
| `tdpProjection` | `never` | **全量 projection 仓库**（双缓冲，见 §4.1） |
| `tdpSession` | `never` | 会话运行态（9 态：IDLE/CONNECTING/RECONNECTING/HANDSHAKING/READY/DEGRADED/REHOME_REQUIRED/DISCONNECTED/ERROR） |
| `tdpCommandInbox` | `never` | 服务端下发的时效性命令 |
| `tdpControlSignals` | `never` | EDGE_DEGRADED / REHOME_REQUIRED / 最近协议错误 |
| `tdpTopicActivity` | `never` | 每 topic 的接收量窗口（诊断用） |
| `tdpHotUpdate` | — | 热更新期望态与当前态（608 行，见 §5） |

**"最小恢复集"这条落到了实处**：重启后需要的只是"从哪继续同步"，
projection 原始内容不持久化 —— 因为它会被业务模块消费成自己的状态。

## 4 · 三个值得单独讲的设计

### 4.1 projection 仓库双缓冲

```ts
interface TdpProjectionState {
    activeBufferId: string
    stagedBufferId?: string
    activeEntries: TdpProjectionEntryMap
    stagedEntries?: TdpProjectionEntryMap
}
```

`SNAPSHOT_BEGIN` 建 staged（带 snapshotId）→ `SNAPSHOT_CHUNK` 逐块填 staged →
`SNAPSHOT_END` 校验 snapshotId 后**整体提升为 active**。

⇒ **分块全量快照期间，业务读到的一直是上一份完整数据**，不会看到半份。
中途断线时 staged 直接丢弃（`stagedBufferId = undefined`）。
这是分块传输里最容易做错的一处，这里做对了。

### 4.2 scope 优先级解析

```ts
const SCOPE_PRIORITY = ['PLATFORM', 'PROJECT', 'BRAND', 'TENANT', 'STORE', 'GROUP', 'TERMINAL']
```

同一 `topic + itemKey` 可以有多个 scope 的下发，终端按优先级取最具体的那一条作为生效值。
scope 的实际取值来自 `tcp-control` 的 `tcpBinding`（platformId/tenantId/brandId/projectId/storeId）+ terminalId。

⚠️ README 写的是 `Platform < Project < Brand < Tenant < Store < Terminal`（**六级，无 GROUP**），
代码里是**七级，`GROUP` 插在 `STORE` 与 `TERMINAL` 之间**。文档与实现不一致。

### 4.3 只广播"生效变化"

`topicChangePublisher` 为每个 topic 计算指纹
（`itemKey:scopeType:scopeId:revision:operation` 排序后 join），
与上一次比对，把差异转成 `upsert` / `delete` 的 `TdpTopicDataChangeItem[]`，
再 dispatch `tdpTopicDataChanged` 广播。

**业务模块只看到"我关心的 topic 里，哪些条目变成了什么"**，
完全不需要理解 scope 优先级、快照分块、游标、重连。这是很干净的一层。

### 4.4 服务端时钟偏移（本轮新发现）

`serverClockOffsetMs` 从下行消息的 `timestamp` 推出（`messageActor.ts:51`），
存进 `tdpSync` slice 并**持久化**，
再由 `estimateTdpServerNow(localNow, offset)` 用于 **projection TTL 过期判定**。

⇒ **这个代码库是有时钟纪律的**，只是放在真正需要它的地方（TTL 判定），
而不是放在 topology 同步（那里靠 authority，见 `k-07` §3）。
我上一轮在台账 `FIX-05` 里说"没有任何时钟纪律"是错的，已在台账更正。

## 5 · 一个包承担了五件事

| # | 职责 | 体量线索 |
|---|---|---|
| 1 | **TDP 会话与游标同步** | `sessionConnectionRuntime` 431 · `messageActor` 314 · `tdpSync` slice 223 |
| 2 | **projection 仓库与生效解析** | `selectors/tdpSync` 697 · `tdpProjection` 221 · `projectionRepositoryActor` 224 |
| 3 | **热更新状态机** | `tdpHotUpdate` slice **608** · `hotUpdateNativeBootActor` 200 · `hotUpdateCompatibility` · `hotUpdateProjectionReducer` · `hotUpdateVersionReporter` · `hotUpdateTopic` |
| 4 | **终端日志上传命令路由** | `terminalLogUploadCommandRouterActor` |
| 5 | **system catalog 桥接**（error/parameter catalog 回灌 runtime-shell） | `systemCatalogBridgeActor` |

外加 `tcpResetActor`（响应 TCP 解除激活）与 `userOperationActor`（记录用户操作时间）。

19 个 actor、7 个 slice。**热更新（3）与日志上传（4）与 TDP 会话（1）之间没有必然关系**，
它们只是"都通过 TDP topic 下发"而已 —— 那是**传输通道相同**，不是**事实 owner 相同**。

## 6 · 优点

1. **快照双缓冲**，分块期间读不到半份数据（§4.1）。
2. **全量仓库 + 优先级解析**的模型对"同一配置多级下发"是正确答案，
   且重启后可从仓库重算，不依赖服务端重发。
3. **只广播生效变化**，业务模块与 TDP 协议彻底解耦（§4.3）。
4. **最小恢复集**：只持久化游标与订阅 hash，不囤 projection（`KEEP-09`）。
5. **订阅由模块声明推导**（`resolveTdpSubscriptionFromDescriptors`），
   带 `subscriptionHash` 与 `previousAcceptedTopics`，订阅集变化时能被服务端识别并重协商。
6. **服务端时钟偏移用于 TTL 判定**（§4.4）—— 在真正需要的地方做了对的事。
7. **会话状态九态**，`DEGRADED` / `REHOME_REQUIRED` 是真实边缘计算场景的状态，不是凑数。
8. **7,078 行测试**，含 live 重连、增量恢复、group policy、热更新主副屏一致性。
9. **HANDSHAKE 必须在 socket connect resolve 之后发**——README 专门记了这条坑。

## 7 · 缺点 / 风险

1. **一个包五件事**（§5）。这是 `FIX-01`（包按 runtime 名切而非按 owner 切）最典型的一例：
   "TDP 连接"这个名字底下什么都能塞。
2. **`tdpHotUpdate` 608 行 slice 在数据同步包里**。热更新有自己的期望态/当前态/回滚/版本上报，
   是独立的 owner，只是恰好经 TDP topic 下发。
3. **文档与实现不一致**：scope 优先级 README 六级、代码七级（§4.2）。
4. **`selectors/tdpSync.ts` 697 行**，是全仓最大的 selector 文件，
   内含缓存（`activeProjectionEntriesCache`）与时间估算，已经不只是"读"。
5. **`workflow` 的 remote definition topic 未被任何模块声明**（`FIX-19`）——
   这不是本包的错，但说明"订阅由模块声明推导"这个机制**没有配套的一致性校验**：
   有 actor 监听某 topic，却没有模块声明它，系统不会发现。
6. **`tdpCommandInbox` 不持久化**是对的（时效性信号），
   但服务端 `COMMAND_DELIVERED` 与终端 ACK 之间若发生重启，命令就丢了。
   README 明确写了"不做离线补执行"，属于**已知取舍**而非缺陷，此处只作记录。

## 8 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **按 owner 拆成至少三个包**：`tdp-session`（会话/游标/订阅/projection 仓库）· `hot-update`（期望态/当前态/回滚/版本上报）· `terminal-log-upload`（已经有独立包，把路由 actor 移过去） | `FIX-01` 的落点。判别式：拿掉它，谁因为拿不到那份事实而坏掉 |
| 2 | **快照双缓冲整体继承** | 分块全量的正确形态（§4.1） |
| 3 | **"全量仓库 + 优先级解析 + 只广播生效变化"整体继承** | 业务与协议解耦的关键（§4.2/4.3） |
| 4 | **服务端时钟偏移整体继承**，并把它上升为**通用能力**（`contracts` 的可注入 clock），供其它需要时间判定的地方复用 | 现在只有 TDP 有（§4.4） |
| 5 | **补一道机械门**：`actor 监听的 topic ⊆ 本模块声明的 tdpTopicInterests` | 修 `FIX-19` 暴露的机制缺口（§7.5） |
| 6 | **scope 优先级从代码常量提升为契约**，并与服务端共享定义 | 文档/实现漂移（§4.2）说明它现在只是一个本地常量 |
| 7 | **协议本身不搬**：TER 的对手方是 `apps/backend/terminal-data-server`（当前空占位），协议会重定 | 讨论稿 §7.3 —— 这个包属于"编码协议"，等对手方 |
| 8 | **selector 文件按主题拆分**，把缓存与时间估算移出 selector | 697 行的"读"已经不是读（§7.4） |
| 9 | WS 保留（SSE 已放弃），上行五类消息无需重设计 | 讨论稿 §7.1 |

## 9 · 证据档位

- 协议、状态模型、双缓冲、scope 优先级、topic 广播、时钟偏移：`已亲验`
  （`types/protocol.ts`、`types/state.ts`、`features/slices/tdpProjection.ts`、
  `selectors/tdpSync.ts` 的 SCOPE_PRIORITY、`foundations/topicChangePublisher.ts`、
  `foundations/projectionExpiry.ts`、`messageActor.ts` 的 offset 计算点均已读）。
- §5 的职责拆分：`已亲验`（19 actor / 7 slice 文件名与体量实测）。
- §7.6（重启丢命令）：`推论`，依据是 `tdpCommandInbox` 的 `persistIntent: 'never'` 与 README 的明确取舍声明。
- **未逐行读**：`selectors/tdpSync.ts` 697 行、`sessionConnectionRuntime.ts` 431 行的完整分支、
  `tdpHotUpdate.ts` 608 行。结论基于结构与关键路径，未做全量行级核对。
