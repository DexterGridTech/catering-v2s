# `@next/kernel-base-host-runtime`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 N · 不建** —— 仅当 TER 决定端内自跑 topology host 才需要；届时重新设计 |
| 路径 | `1-kernel/1.1-base/host-runtime` |
| 规模 | src **1,986 行 / 25 文件**；test **1,185 行** |
| 依赖 | `contracts` · `platform-ports` |
| 被依赖 | **0**（声明 0，源码 import 0，全仓穷举） |
| 状态 | **被 V3 设计明确取代的 V2 世代 host 内核**——不是被遗忘，是被裁掉后留下的实现 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

README 的定位是"**双机 host 纯控制面内核**"：pairing ticket、session registry、
connection attach/detach、resume begin/complete、relay queue、fault injection、host observability。

设计亮点里写着一句关键话：

> `0-mock-server/dual-topology-host-v3` 和终端内置 host 可以复用同一内核。

**这个复用没有发生。**（见 §4）

## 2 · 能力面（`types/host.ts` 的 `HostRuntime` 接口，17 个方法）

| 组 | 方法 |
|---|---|
| 配对 | `issueTicket` · `getTicket` |
| 会话 | `processHello` · `getSession` |
| 连接 | `attachConnection` · `detachConnection` · `recordHeartbeat` · `expireIdleConnections` |
| 恢复 | `beginResume` · `completeResume` |
| 中继 | `relayEnvelope` · `drainConnectionOutbox` |
| 故障注入 | `addFaultRule` · `replaceFaultRules` · `clearFaultRules` · `listFaultRules` |
| 观测 | `getSnapshot` |

状态模型相当完整：

- `HostSessionRecord.status` 六态：`awaiting-peer / resume-required / resyncing / active / degraded / closed`
- `HostSessionResumeState.phase` 三态：`idle / required / resyncing`，带 `pendingNodeIds`
- `HostTicketRecord.occupiedRoles` 明确 master/slave 各自被谁占用，防止同角色重复接入
- 故障注入是**有类型的规则集**：`hello-delay`（延迟 ack）、`hello-reject`（指定 rejectionCode）等，
  带 `remainingHits` 命中次数与 session/role/node 过滤条件

## 3 · 为什么没有消费者——这是一次有据可查的设计取代

`docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md` 白纸黑字：

**§7.2 关于 ticket 的定位**
> V3 默认 **不使用 ticket**。……slave 只要拿到 `masterLocator`，就直接按地址建链，然后走 `hello / hello-ack`。
> ……ticket 在 V3 里最多只是迁移期 transport 兼容层，不是产品语义本身。

**§8.2 明确移除**（V3 第一版从 core 协议移除）
> 1. `resume-begin` 2. `resume-complete` 3. `state-sync-summary`
> 4. `state-sync-diff` 5. `state-sync-commit-ack` 6. 任何多 peer 路由/转发协议 7. `resumeTopologySession` command
>
> 原因很简单：当前业务就是 pair；reconnect 直接 snapshot 修复即可；图模型和重 barrier 只会增加脆弱性。

**`host-runtime` 实现的恰好就是被移除的那一套**：ticket、resume begin/complete、relay outbox。

**实测印证**：`0-mock-server/dual-topology-host-v3/package.json` 的 `dependencies` **只有 `ws`**，
`src` 下 `@next/*` import 数为 **0** —— 它是按 V3 重新写的，没有复用这个内核。

⚠️ 所以正确的结论不是"没人用它所以是死代码"，而是：
**它是 V2 世代的 host 内核；V3 的简化裁决把它的核心概念（ticket / resume barrier）判为多余，
新 host 因此另起炉灶。留下的是一份被取代的实现。**

## 4 · 一个连带残留

被 V3 移除的三个协议对象仍留在 `contracts/types/stateSync.ts` 里：
`StateSyncSummaryEnvelope`、`StateSyncDiffEnvelope`、`StateSyncCommitAckEnvelope`，
且经 `contracts/protocol/index.ts` **对外导出为"线上协议对象"**。

其中 `StateSyncDiffEnvelope` 仍在用（`topology-runtime-v3` 的 `applyStateSyncDiff`），
但 `Summary` 与 `CommitAck` 属于被裁掉的三段式协商。
**协议出口比实际协议宽**，后来者读 `protocol/index.ts` 会以为三段式仍然成立。

## 5 · 优点

1. **host 语义与 server 适配彻底分开**——它不启动任何 server，只做纯状态机。
   这个切法本身是对的：同一套 host 语义可以被 Node mock、Android 原生、Electron 分别驱动。
2. **有类型的故障注入规则集**，带命中次数与过滤条件。
   这是双机测试最难做的部分（"让第二次 hello 延迟 3 秒"、"让 slave 的 ack 被拒一次"），
   而它做成了**数据**而不是测试里的 if 分支。
3. **session/resume 状态机的状态值取得准**：`awaiting-peer` / `degraded` / `resume-required`
   这几个状态名直接对应真实故障形态。
4. **1,185 行测试**，说明这套状态机自己是跑通的。
5. **纯函数式、零平台依赖**，可完整 node 测试。

## 6 · 缺点 / 风险

1. **实现与当前协议裁决不一致，且没有任何标记。**
   包内没有一行注释说明"ticket/resume 已被 V3 裁掉"，README 的定位表也仍把它列为在编层级。
   一个新人按 README 的层级表读代码，会以为 ticket 仍是当前拓扑模型的一部分。
2. **"可复用同一内核"这句设计承诺没有兑现**，而且**没有任何机制会发现它没兑现**（对应 `FIX-11`）。
3. **连带把已裁协议留在 `contracts/protocol` 出口里**（§4）。
4. 与 `execution-runtime` 一样，**它的存在让"当前 host 模型是什么"有两个答案**。

## 7 · 重构到 TER 的优化方向

**结论：不继承包，但要抢救两样东西，并把一条教训写进规范。**

| # | 动作 | 理由 |
|---|---|---|
| 1 | **不建这个包**。TER 的拓扑按 V3 的 pair 模型，无 ticket、无 resume barrier | V3 的简化裁决有明确论证，不要回退 |
| 2 | **抢救"有类型的故障注入规则集"** | 双机/双屏测试最需要的就是可编程故障；把它做成数据而不是测试内分支，这个形态值得继承。TER 的 automation 控制面正好可以承载它 |
| 3 | **抢救"host 语义与 server 适配分离"这个切法** | TER 同机双屏改成一个 store 后本机不需要 host；但跨机仍需要，届时 Node/Android/Electron 三种驱动应共用一套语义 |
| 4 | **`contracts/protocol` 出口清掉已裁协议**，并加一道机械门：protocol 导出的类型必须有实际生产消费者 | 防止"协议出口比实际协议宽" |
| 5 | **把"设计被取代时，实现要么删除要么标记"写进 TER 规范** | 这是 `FIX-11` 的根：没有机制会发现"承诺的复用没发生"。最低成本的机制是依赖 checker 报零消费者的包 |

## 8 · 证据档位

- 规模、零消费者：`已亲验`（穷举范围＝五个顶层目录下 `*.ts`/`*.tsx`，排除 `node_modules`/`dist`/`build`）。
- `dual-topology-host-v3` 零 `@next` 依赖：`已亲验`（`package.json` + `rg '@next/'` 双向确认）。
- V3 移除 ticket/resume：`已亲验`，原文见 `topology-runtime-v3-design.md` §7.2 与 §8.2。
- "被取代而非遗忘"：`推论`，推导链＝设计文档的明确移除 + 新 host 独立实现 + 本包实现的正是被移除项。
