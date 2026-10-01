# `kernel.base.transport` · TER 通信机制 owner

## 定位

这是 TER 的通用传输 owner。它持有自己的 runtime commands 和 actor，负责连接生命周期、地址轮转、首选地址、退避与随机量、网络恢复触发、取消和连接资源释放。它不持有终端业务状态，也不解析 TDS 业务协议。

本包依赖 `contracts`、`platform-ports`、`runtime` 与 `state`。它不依赖 `server-config` 或 `terminal-data-client`。

## 作用与边界

- transport 提供通信机制；使用方给出重试参数，报告连接 ready、invalid，并通过 stop 叫停。无限重连由 transport 执行，何时停止由使用方决定。
- `terminal-data-client` 独占终端凭证、激活/取消激活、TDS 认证首帧、`SESSION_READY`、`PING/PONG`、seq、RTT、心跳超时和业务关闭原因。transport 只收发原始字节和通用连接事件。
- `start` 可携带协议 owner 提供的 opaque `endpointPathAndQuery`。terminal-data-client 按共享协议构造 `/tdp/{encodedGroupWorkspaceKey}/ws`；transport 只拒绝绝对 URL、origin-relative 双斜杠、反斜杠、fragment 与控制字符，不解释路径业务语义。composition 注入的 network adapter 将其与配置地址的 origin 组合后建连，地址切换时路径保持一致。
- `server-config` 拥有服务地址和代理配置及代理密码。TER composition 通过其内部网络装配 API 提供 snapshot provider，并注入 `TransportNetworkAdapter`。transport 每次新连接尝试读取当前快照；既不依赖 server-config，也不直接读它的 selector、state 或 persistence。代理密码只短暂到达 network adapter，不进入 selector、日志或 connection event。
- `TransportConnection.send/subscribe` 是通用原始通道；start/ready/invalid/stop、HTTP 执行、HTTP 地址可用信号与网络变化由 transport command/actor 承载。socket 回调不直接改变 transport 状态或触发重连。HTTP request 对 transport 不透明；它只按调用方给的送达分类与 `safeRetryable` 执行地址尝试和时限，不读响应 body、不解释 status 或业务错误码。
- topology 可以继续使用既有拓扑协议 primitives；拓扑字段、方向、大小和 fail-closed parser 的 owner 仍是 `contracts/src/foundations/topologyWire.ts`。TDS 业务消息不进入该 parser。

## 结构

```text
src/
  application/        runtime module、命令 gateway 和 owner 装配
  features/           transport commands 与 connection actor
  foundations/        地址、退避、network bridge、WebSocket 等纯机制
  types/              通用 transport 形状
  index.ts            唯一公开面
```

## 用法

不需要 TDS 连接的现有 topology 装配仍可创建空配置模块：

```ts
import {createTransportModule} from '@catering-v2s/kernel-base-transport'

const transportModule = createTransportModule()
```

TER 长连接 composition 按以下方向装配：

```ts
const transportModule = createTransportModule({networkAdapter})
const terminalDataClient = createTerminalDataClientModule({transport: transportModule.commandGateway, ...deps})
```

`networkAdapter.readSnapshot(serverName)` 必须调用 composition 注入的 server-config 网络 provider；`connect` 和 `sendHttp` 只收到本次地址、代理设置与必要的连接/请求参数。`connect` 以地址的 scheme/authority 为 origin，并使用可选 `endpointPathAndQuery` 作为目标 path/query；不得让它覆盖 origin。`commandGateway` 的 start/ready/invalid/stop、`executeHttp` 与 `reportHttpAddressAvailable` 均 dispatch transport owner command。terminal-data-client 解析 HTTP 契约后才决定是否报告某地址可用；transport 只更新该服务的易失首选地址，不知道业务结果类型。client 不读取或持有 server-config snapshot。

本包仍公开 `createTransportAddressSelector`、`runWithBoundedTransportRetry`、`createTransportHeartbeat` 与 `createTransportWebSocketController`，供现有 topology primitives 使用。其机制不能替代终端 client 的业务状态和协议处理。

## 在这个包上迭代时

1. 先确认新增字段属于共享 contracts 还是本包通用 transport；TDS 消息与业务错误码不属于 transport。
2. transport 只接收通用连接参数和状态信号；不得记录原始 payload、Authorization 或代理密码。
3. 网络状态订阅先读取种子，读取失败时以首个通知作种子；同值去重，跃迁只派发 transport command；订阅回调不直接重连。
4. 连接关闭必须释放本包拥有的 socket、订阅和 timer；ready 前的失败轮转到下一个地址，ready 后重连沿用当前有效配置中的首选地址。
5. 修改后运行本包 typecheck、owned tests 和适用静态门；若修改依赖、包图或 public exports，同步 package、skeleton graph 与 `terminal-invariants.json`。
