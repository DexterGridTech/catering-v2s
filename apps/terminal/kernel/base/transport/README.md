# `kernel.base.transport` · TER 拓扑传输边界

## 定位

这是 `owner` 包，负责一个拓扑连接的帧边界、协议 session、连接身份、传输地址解析、受界限的重试/取消/限流与 connection-token 调度。它依赖
`kernel.base.contracts`、`kernel.base.platform-ports`、`kernel.base.runtime` 和
`kernel.base.state`，由 `kernel.base.topology` 使用；它不是业务状态 owner，也不是命令路由 owner。

## 作用与边界

判别式是：凡是“把受约束的拓扑帧安全地送入/送出一个连接”的机制放在本包；凡是“这个命令该由
本地还是对端执行、哪些 state 可以同步、配对是否成立”的事实与策略留在 topology、runtime 和
各自业务 owner。`routeContext` 不进入 wire，members 的同步白名单也不由本包推导。

本包不提供认证、多副机、离线队列或永不放弃的业务策略；它提供 ordered address failover、
sticky preferred address、bounded retry、cancellation、heartbeat、concurrency/rate limiting 和
WebSocket profile 原语，拓扑 owner 决定何时使用它们。heartbeat controller 只负责按配置发出
序号化 ping、接收 pong 进度与报告超时，不解释业务消息；当前 native/topology 仍拥有实际 wire
ping/pong 的连接接线。业务语义仍由 topology/runtime owner
决定。

## 结构

```text
src/
  moduleName.ts       包命名与 kind
  dependencies.ts     runtime module dependency metadata
  application/        transport module owner
  foundations/        地址解析、frame/session、retry/limit 与连接调度纯机制
  types/              仅本包的 transport 形状
  index.ts            唯一公开面
```

线上 message 字段、方向、大小和 fail-closed parser 的唯一 owner 是
`kernel.base.contracts/src/foundations/topologyWire.ts`；transport 通过公开 contracts API 消费它。
固定端口、base path、心跳、调用超时和重连边界的唯一配置源是
`kernel-base-contracts/topology-transport.config.json`，TS 代码、runner 和 Android host 的
运行时入口不得重新声明这些值。

## 用法

最小公开装配是：

```ts
import {createTransportModule} from '@catering-v2s/kernel-base-transport'

const transportModule = createTransportModule()
```

地址和连接能力通过公开的 `createTransportAddressSelector`、`runWithBoundedTransportRetry`、
`createTransportHeartbeat`、`createTransportLimiter` 与 `createTransportWebSocketController` 暴露；identity client 使用
contracts 的 `TransportServerConfig` 解析候选地址并把成功地址置为 sticky 首选。当前拓扑只有
一个真实网络消费者，通用多地址行为由本包 focused tests 证明，不冒充为本批设备行为已验证。

模块只声明 transport 的 runtime 依赖；业务装配再把它与 topology module 一起注册。不得从业务包
直接构造 native listener 或绕过 contracts 解析原始帧。

## 在这个包上迭代时

1. 先确认新增字段属于 contracts 还是 transport；协议字段必须先改 contracts 类型、parser、golden
   vectors 和 invariant，再改本包消费。
2. 不得把 `routeContext`、业务 state、目标角色或原始敏感 payload 写入帧。
3. 改完至少运行本包 typecheck、owned test 与 `node tools/terminal-contracts/check-static.mjs`；涉及
   graph 或依赖时同步 package、skeleton graph、invariants 和 census。
4. 连接关闭必须释放本包拥有的 session 资源；断线重连策略不得偷偷变成业务层的“放弃重试”。
