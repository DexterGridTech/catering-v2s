# `@next/kernel-base-tcp-control-runtime-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 D · 延后** —— 编码的是协议，对手方 `catering-business-server` 尚未定义 |
| 路径 | `1-kernel/1.1-base/tcp-control-runtime-v2` |
| 规模 | src **1,747 行 / 26 文件**；test 1,330 行 |
| 依赖 | `contracts` · `runtime-shell-v2` · `state-runtime` · `transport-runtime` · `server-config-v2` |
| 被依赖 | 11 个包 |
| 状态 | 活跃；**是 slice descriptor 用得最好的一个范例** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**终端控制平面（TCP = Terminal Control Plane，不是 TCP/IP）。**
负责：终端激活、解除激活、凭证刷新、任务结果上报，并把**最小恢复状态**落入 kernel state。

它与 `tdp-sync-runtime-v2`（数据平面）是一对：控制面管"这台机器是谁、有没有权限"，
数据面管"这台机器该拿到哪些业务数据"。

## 2 · 状态模型：五个 slice，各自意图明确

| slice | persistIntent | syncIntent | 持久化字段 | 语义 |
|---|---|---|---|---|
| `tcpRuntime` | `never` | `isolated` | —— | **本次进程的运行态观察值**（各种 lastRequestId） |
| `tcpSandbox` | `owner-only` | `master-to-slave` | `sandboxId` · `updatedAt`（immediate） | 沙箱身份 |
| `tcpIdentity` | `owner-only` | `master-to-slave` | `deviceFingerprint` · `deviceInfo` · `terminalId` · `activationStatus` · `activatedAt` | 终端身份 |
| `tcpBinding` | `owner-only` | `master-to-slave` | `platformId` · `tenantId` · `brandId` · `projectId` · `storeId` · `profileId` · `templateId` | 组织绑定链路 |
| `tcpCredential` | `owner-only` | `master-to-slave` | **`accessToken` / `refreshToken` 标 `protection: 'protected'`**；`expiresAt` / `refreshExpiresAt` / `status` / `updatedAt` 走普通存储 | 凭证 |

**这是整个 POC 里 slice descriptor 用得最到位的一处**：

- 运行态观察值（`tcpRuntime`）明确不持久化 —— 对应 `KEEP-09` 的"恢复真相源 vs 运行时观察值"；
- 敏感字段与非敏感字段**在同一个 slice 内分流到两个存储后端**，而不是把整个 slice 加密；
- 全部 `flushMode: 'immediate'` —— 激活/凭证这类状态丢一次就要重新激活，不能等 debounce；
- 全部 `master-to-slave` —— 副屏不自己激活，身份跟主屏走。

## 3 · Command 模型：动作 + 事实广播成对出现

11 条 command 里，5 条是 `public` 动作，5 条是 `internal` 的**事实广播**，1 条是 reset：

| public 动作 | internal 事实广播 |
|---|---|
| `bootstrapTcpControl` | `bootstrapTcpControlSucceeded` |
| `activateTerminal` | `activateTerminalSucceeded` |
| `refreshCredential` | `credentialRefreshed` |
| `deactivateTerminal` | `deactivateTerminalSucceeded` |
| `reportTaskResult` | `taskResultReported` |

**这是广播 command 被当作"事实总线"用**，不只是"写指令"：
`catering-shell/src/features/actors/tcpLifecycleActor.ts` 监听
`activateTerminalSucceeded` / `deactivateTerminalSucceeded` 来驱动 screen 路由，
**而不需要依赖 tcp-control 的内部状态或轮询 selector**。

这个形态很好：**下游模块订阅"发生了什么"，而不是"轮询状态变了没有"。**

## 4 · HTTP 服务面

四个端点，全部经 `createModuleHttpEndpointFactory` 定义：

```
POST /api/v1/terminals/activate
POST /api/v1/terminals/token/refresh
POST /api/v1/terminals/{terminalId}/deactivate
POST /api/v1/terminals/{terminalId}/tasks/{instanceId}/result
```

走 `transport-runtime` 的 `envelope` binder（`{success, data, error}` 形状），
失败转成本包的 typed `AppError`。

## 5 · 优点

1. **五个 slice 的持久化/同步意图逐个想清楚了**，没有"整个 slice 一起存"的偷懒（§2）。
2. **凭证的两个 token 走 protected 存储、时间戳走普通存储**——
   这是 `state-runtime` 的 `protection` 设计能兑现价值的最好证明。
3. **动作/事实成对的 command 设计**，让跨模块协作不需要状态轮询（§3）。
4. **`activationStatus` 与 `credential.status` 分开**：
   "这台机器激活过"和"当前凭证有效"是两件事，分成两个 slice 两个状态。
   凭证刷新失败后回到可重试状态，不会把终端整体判死。
5. **HTTP 端点集中在一个 `httpService.ts`**，业务 actor 不碰 URL。
6. **1,330 行测试**，覆盖激活、刷新失败、重启恢复。

## 6 · 缺点 / 风险

### 6.1 为纯广播注册"空 actor"

`features/actors/stateMutationActor.ts` 里有五个：

```ts
onCommand(tcpControlV2CommandDefinitions.bootstrapTcpControlSucceeded, () => ({})),
onCommand(tcpControlV2CommandDefinitions.activateTerminalSucceeded, () => ({})),
onCommand(tcpControlV2CommandDefinitions.credentialRefreshed, () => ({})),
onCommand(tcpControlV2CommandDefinitions.deactivateTerminalSucceeded, () => ({})),
onCommand(tcpControlV2CommandDefinitions.taskResultReported, () => ({})),
```

原因是 `CommandDefinition.allowNoActor` 默认 `false`，
而 dispatcher 在 `handlers.length === 0 && !allowNoActor` 时聚合为 `FAILED`。
所以**纯事实广播必须有人"接"，否则广播自己会报失败**。

⇒ 这是"**命令**"与"**事件**"共用一个机制的代价。
广播一个事实本来就不该要求有订阅者。

### 6.2 kernel 包里写着 mock server 的名字

```ts
const defineEndpoint = createModuleHttpEndpointFactory(moduleName, SERVER_NAME_MOCK_TERMINAL_PLATFORM)
```

README 明确写"**不直接绑定 mock-terminal-platform**"，但代码里绑的正是这个常量。

公平地说：绑的是**逻辑服务器名**而不是物理地址，地址仍由 `server-config-v2` 的 space 决定，
所以换服务端不用改这里。但那个名字字面量是 `'mock-terminal-platform'` ——
一个 dev 期产物的名字被写进了 kernel 包，且与自己的 README 声明相反。

### 6.3 `tcpBinding` 七个 ID 全是裸 string

`platformId / tenantId / brandId / projectId / storeId / profileId / templateId` 全是 `string`，
没有 branded 类型（而 `contracts` 里恰恰有 branded ID 的做法）。
七个同类型字段相邻，传参写错顺序编译器不会拦。

### 6.4 `syncIntent: 'master-to-slave'` 但副屏不应有独立身份

副屏（managed secondary）按 topology 规则**不 bootstrap 自己的 TCP identity**，
状态靠同步过来。这条依赖关系写在 topology 设计文档里，
但在这个包内看不到任何标注——包内读代码的人不知道"为什么这几个 slice 要同步"。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **五个 slice 的意图划分整体继承**，作为 TER 的 slice 设计范例写进编码规范 | 这是"声明式意图"最好的落地样本（§2） |
| 2 | **区分"命令"与"事件"**：事件类定义默认 `allowNoActor: true`，或引入独立的 `defineEvent` | 消掉为广播注册空 actor 的反模式（§6.1）。TER 里事实广播会更多，这个代价会放大 |
| 3 | **服务器名从 kernel 包移出**：endpoint 工厂接收 serverName 作为模块输入，由 assembly 注入 | 修 §6.2，同时与"取消 server-config 独立包、地址值归 assembly"（`FIX-12`）一致 |
| 4 | **七个组织 ID 用 branded 类型** | `contracts` 已有现成做法，零成本（§6.3） |
| 5 | **协议本身不搬**：TER 的控制面对手方是 `apps/backend/catering-business-server`，端点与字段都会变 | Dexter 已裁定当前不接服务器；这个包属于"编码协议"，等对手方（讨论稿 §7.3） |
| 6 | **保留"动作 + 事实广播成对"的形态**，并在 TER 规范里写成条目 | 它让下游不必轮询 selector（§3） |
| 7 | slice 上加一行注释说明**为什么**要同步（副屏无独立身份） | 包内可读性（§6.4） |

## 8 · 证据档位

全部 `已亲验`：`index.ts`、`features/commands/index.ts`、五个 slice 的 descriptor、
`features/actors/stateMutationActor.ts`、`foundations/httpService.ts` 读过；
"谁监听 `*Succeeded`"由全仓 `rg` 穷举（`1-kernel` `2-ui` `3-adapter` 下 `*.ts`）确认。
未逐行读的：`activationActor` / `credentialActor` / `taskReportActor` / `deactivationActor` 的完整实现
（读了签名与 dispatch 点，未逐行核对错误分支）。
