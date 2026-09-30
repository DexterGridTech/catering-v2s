# Terminal Data Server

## 定位

`terminal-data-server` 是单节点 WebSocket 传输运行时，承载终端连接、会话、心跳与 PostgreSQL 最新连接状态。它是独立受管进程，不是业务 HTTP deployable。

## 作用

- 通过 `GET /tdp/{groupWorkspaceKey}/ws` 接收终端 WebSocket 连接。
- 由终端凭证首帧完成设备认证；不使用登录用户或用户会话权限。
- 只调用 `terminal-binding` 提供的凭证验证 API；绑定事实仍由业务后端 owner 管理。
- 使用业务应用创建的共享 PostgreSQL schema；TDS 不运行 Flyway、seed 或 reset。
- 使用 Reactor Netty 原生 RFC 7692 `permessage-deflate`；只在客户端提出 WebSocket 扩展时协商。未提出扩展的连接保持未压缩。
- 原生 inflater 的解压 buffer 上限为 65,536 bytes，WebSocket 聚合器另将整条解压后消息限制为 65,536 bytes；任一上限超出都在进入协议解析前以共享协议关闭码 1009 关闭。压缩上下文遵循 Reactor Netty 的配置默认值；不在此承诺小消息压缩阈值、控制帧压缩细节或协议违规关闭原因。

## 结构

- `config`: 启动时校验的 TDS 容量与会话时间设置。
- `session`: 终端会话与按终端串行处理。
- `protocol`: WebSocket 消息、关闭原因与帧边界。
- `state`: TDS 拥有的最新连接状态。
- `websocket`: 握手、RFC 7692 扩展、帧边界与 WebSocket 生命周期。
- `observability`: 有界异步脱敏诊断日志。

## 用法

DEV 和 backend-acceptance 共用仓内配置文件 [`scripts/env/tds-dev-capacity.json`](../../../scripts/env/tds-dev-capacity.json)。受管 runner 每次启动前读取并校验它，再把两个连接上限注入 TDS；`TdsAcceptanceProcess` 也会核对注入值与配置文件一致。不要在 shell 环境里另外覆盖这两个容量值。

当前初始 DEV 配置为：

| 字段 | 当前值 | 含义 |
| --- | ---: | --- |
| `rssBudgetMiB` | 512 | TDS 独立进程的 DEV RSS 上限，单位 MiB。DEV 就绪探测以及 backend-acceptance 在 readiness、停止前都会读取 `/proc/<pid>/status` 的 `VmRSS`；任一观测超过上限即判失败。 |
| `maxUnauthenticatedConnections` | 4 | TDS 同时允许的未认证 WebSocket 数。 |
| `maxTrackedSessions` | 8 | 活跃会话加等待断开状态写入的会话总上限。 |

每个连接的详设逻辑预留为 1 MiB，当前两个 admission 上限合计预留 12 MiB。512 MiB 是本批为低负载 DEV 选择的初始进程 RSS 预算；受管 DEV 在就绪前持续采样，超限即停止启动并清理本 run，backend-acceptance 还会在 readiness 与停止前复核。其余空间留给 JVM、Netty、TLS、socket 与内核开销；这是 DEV 预算，不代表生产容量承诺。实测超限时，先根据当前受管 RSS 证据与详设容量公式重新计算，再改此文件，不得单纯调高上限掩盖超限。

要调整 DEV 容量，在仓库根目录编辑 `scripts/env/tds-dev-capacity.json` 的三个正整数并保留 `schemaVersion: 1`。保存后，下一次 `scripts/dev/start` 或 `scripts/test/backend-acceptance` 会读取新值；正在运行的 DEV 不会热更新，需先按受管流程 stop 后重新 start。配置缺失、JSON 错误、字段缺失或非正整数都会 fail closed。测试环境的 V-S1/V-S8 cohort 从此配置读取，不另写固定生产值。

构建使用 `./gradlew :apps:backend:terminal-data-server:bootJar`。运行、停止、端口分配与清理由 `scripts/dev` 或 `scripts/test/backend-acceptance` 的受管入口管理。

TDS 使用的第三方 API 版本、官方资料、线程/缓冲区所有权与边界见 [`TDS 第三方库官方用法审计`](../../../doc/review/platform/2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md)。改动第三方 API 调用前，先查该依赖的实际解析版本与对应官方文档/发布源码，再调整实现及 focused proof；不要凭记忆推断行为。

## 在这个包上迭代时

先重开终端激活需求、批次一详设和对应项目记忆。保持 WebFlux 应用类型、terminal-binding 窄验证 API、1 MiB 每连接逻辑分配上限与有界工作队列；修改消息或关闭原因时只改共享协议正本及其消费者。不能在 TDS 增加第二套 Flyway、业务 owner 写模型、设备类型或登录用户授权。
