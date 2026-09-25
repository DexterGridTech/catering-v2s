# 终端激活与长连接 · 需求讨论稿（Claude）

```text
STATUS=DISCUSSION_DRAFT（讨论稿，不是需求正本，不授权设计或实施）；第 1 轮讨论已记入 §8，§8 与 §4 冲突处以 §8 为准
SOURCE=Dexter 2026-09-25 原始需求（§1 逐字）
REFERENCE_ONLY=newPOSv1 的 TCP/TDP 运行时与 mock server；requirement-doc/design-v6 的终端控制平面与数据平面章节（仅供参考，不照搬）
SESSION_PROVENANCE=续接会话，Claude 主会话；只读了参考材料与仓内源码，未运行任何命令
```

## 0 · 我对这件事的理解

**一句话**：让一台装着 TER 的设备，凭激活码成为「门店终端管理」里已经配置好的那台终端，拿到身份与凭证，然后与 terminal-data-server（下称 TDS）保持一条高效、健壮的 WebSocket 长连接；设备和后台都能取消激活。

**本期要证明的闭环**：激活 → 取连接令牌 → 建立长连接 → ping/pong 保活与测延时 → 断线重连与多地址切换 → 取消激活（后台发起、终端发起两条路）→ 终端清空持久化状态并重启 JS。

**本期不做**：topic 数据同步、任何 TER UI 包、统计分析、运营后台与 admin console 的入口（后台取消激活只测 API，服务切换只做配置能力）。

## 1 · 原始需求（逐字）

> 我们来开启一个新的主题需求。请你先作为需求讨论稿来记录。
> A，刚刚我们在apps/backend/catering-business-server实现的门店终端的管理。
> B，apps/terminal是我们终端的程序包。
> C，apps/backend/terminal-data-server是我们的TDP服务的占位。
> 我现在希望实现A、B、C的打通。请你先仔细阅读newPOSv1中TCP和TDP与mock server的连接方式，这个仅仅供你参考，但我们不是要完全照搬，再阅读requirement-doc/design-v6中关于TCP和TDP的业务描述，也仅供参考，不是要完全照搬。以下是我当前要实现的需求：
> 1，TCP与TDP不再分那么清楚，都在terminal-data-server中承载。
> 2，catering-business-server与terminal-data-server共用一个数据库（还要再加一个Doris），领域互通，terminal-data-server可独立部署，两者都可横向扩展。terminal-data-server目前不做主从同步。
> 3，terminal-data-server使用Spring WebFlux WebSocket作为WS连接和管理的方式。
> 4，终端激活、生成连接Token、保持长连接等服务，都在terminal-data-server中。服务URL需要区分集团空间，类似于http://127.0.0.1:5175/tpd/aurora（集团空间key）/xxx，或者你有不同建议，我们探讨。
> 5，在terminal/kernel/base中新建terminal-data-client包，用于与terminal-data-server连通。暂不做UI包，只做node测试即可。
> 6，terminal/kernel/base/transport中需要支持多服务地址切换（参考newPOSv1）
> 7，newPOSv1中有server-config-v2来做服务管理，TER中如何管理，是否需要新增TER包，我们需要一起讨论设计。后续我会做在admin console中管理和切换server的功能，但本期不做。
> 8，terminal-data-server需要记录终端激活、连接、断开、ping/pong的延时等，我希望terminal-data-server只保存最新值，使用Doris保存历史。本期不做统计，但后续会做。
> 9，terminal-data-server有API可以主动取消激活终端，后续会做到frontend/operations-admin中，但本期不做，仅测试API
> 10，终端也可主动取消激活，取消激活后会清空state persist的数据，然后重启应用（仅重启JS端，不重启原生），效果就是重启后state被重置，本期只做node测试即可，仅测试是否调用了port接口。
> 11，terminal-data-client中state会记录与terminal-data-server的连接状态，与ping/pong的延时（只记录2小时内的），不需要persist
> 12，本次仅做激活、取消激活、WS长连接（要高效、健壮）ping/pong等场景，暂不做topic数据同步，那是另外的话题，我们以后再说。
>
> 以上是我的原始需求，我们一起讨论

## 2 · 现状（仓内事实）

### 2.1 A · 门店终端管理（catering-business-server）

- **终端表**：`store_terminal.terminal` 存终端规则聚合，字段含集团空间、门店、名称、设备类型、状态（启用、停用、作废）、版本、8 位明文激活码与 JSONB 配置（`src/main/resources/db/migration/V20260924_000000_000__store_terminal_owner.sql`）。**没有任何设备绑定、凭证或在线状态字段。**
- **激活码的性质**（需求正本 `2026-09-23-v2s-store-terminal-management-requirements-claude.md`）：
  - 集团空间内唯一，已作废终端的码也算在内，永不回收（R-8.4）；
  - 创建后不能修改（R-8.5）；
  - 明文存放，只在详情里显示（R-8.6、D-28）。
- **当时留给本期的约定**：
  - 激活时设备用带集团空间 key 的 URL 访问激活服务（D-16）；
  - 当时不提供「凭激活码查找终端」的接口（R-8.8）；
  - 将来的激活设计必须自带防穷举措施（§6.3 第 2、5 条：8 位数字可被穷举，手填码可能很弱）。

### 2.2 B · 终端程序（apps/terminal）

- **kernel/base 现有包**：contracts、display-context、platform-ports、runtime、state、topology、transport、ui-state。
- **transport 已有的能力**（`kernel/base/transport/README.md`）：
  - 按顺序切换地址，并把成功的地址记为首选；
  - 有界重试与取消；
  - 心跳控制器：发出带序号的 ping，跟踪 pong 进度，报告超时；
  - WebSocket 控制器：通过注入的 `TransportSocketConnector` 建连，支持 `replaceServers` 在运行中换服务配置。
  - 目前唯一的真实网络消费者是双机拓扑。
- **地址配置类型**：contracts 已有与 newPOSv1 同构的 `TransportServerConfig`（空间 → 服务 → 多地址，`kernel/base/contracts/src/types/transport.ts`），并支持覆盖地址。唯一的配置实例是拓扑自己的 `topologyTransportServerConfig`。
- **平台端口**：
  - `appControl.resetRuntime` 返回「新的运行时已启动」，拓扑已在使用，正对应「只重启 JS」；
  - 有 `persist` 与 `persistSecure` 两种存储端口；
  - 没有网络端口：React Native 与 Node 都自带全局 `fetch` 与 `WebSocket`，由装配层注入连接器即可。
- **state**：持久化引擎有 `reset`，会删除全部持久化键并把状态恢复为初始值（`kernel/base/state/src/foundations/persistenceEngine.ts`）。
- **终端规范中与本期直接相关的条款**（`doc/platform/terminal-coding-standard.md`）：
  - TR-01：状态只由 command 驱动；
  - TR-04：声明了持久化就必须有重启测试；
  - TR-06：foundations 不得触达网络与平台 API；
  - TR-09：包要声明自己是 owner 还是 toolkit；
  - TR-10：每个包要有中文 README；
  - TR-11：事件必须转成 command；
  - TR-16：不涉及 adapter 的功能先过 Expo Web。

### 2.3 C · terminal-data-server

- 只有 `README.md` 与一个仅含 `java` 插件的 `build.gradle.kts`，没有任何运行时、路由、数据库或迁移。
- 业务后端用 `spring-boot-starter-web`（Servlet），仓内还没有 WebFlux，也没有 Doris。

### 2.4 现行治理边界（本需求会改变它们）

- `AGENTS.md` 与 `PLATFORM-BLUEPRINT.md` 的现行约定：
  - 一个业务 deployable；
  - 一个 PostgreSQL、多 owner schema、单一 Flyway history；
  - 「初始不引入 MQ、通用 outbox、TDP、内部 OpenAPI client 或常态轮询」，「只有真实触发条件与新 decision 可以改变该边界」。
- `doc/decisions/2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md` 把 TDS 固定为空占位。
- 环境执行矩阵规定：DEV、后台验收与 L2 的 Java 后端都跑在受信远端主机，与 PostgreSQL、对象存储同侧。

## 3 · 参考材料：借什么，不借什么

**可以借鉴**：

- **凭证分两层**：激活拿到长期凭证，建连前换短期连接令牌（newPOSv1 `tcp-control-runtime-v2` 的 activate / refresh；design-v6 第 14 阶段 04 章的凭证表只存摘要）。
- **握手协议**：先 `HANDSHAKE`，服务端回 `SESSION_READY`，内容含会话号、节点号、服务器时间与可替代端点（newPOSv1 `tdp-sync-runtime-v2/src/types/protocol.ts`）。
- **应用层心跳**：客户端发 `PING`、服务端回 `PONG`（mock server `tdp/wsServer.ts` 在收到 PING 时记录心跳）。
- **优雅迁移**：服务端主动要求改连（`SESSION_REHOME_REQUIRED`），用于节点下线时平滑迁移。
- **多地址管理**：服务地址按「空间 → 服务 → 多地址」管理，顺序切换并记住首选（newPOSv1 `server-config-v2` 与 `transport-runtime` 的 `httpRuntime.ts`、`socketRuntime.ts`；TER 已有同构能力）。
- **取消激活即清空**：取消激活必须清空终端本地状态（design-v6 第 18 章 §3.10）。
- **在线真相在长连接一侧**：在线状态以 TDS 为准，业务侧只读镜像（design-v6 §4.21 `TerminalPresenceMirror`）。

**不照搬**：

- **沙箱号 `sandboxId`**：那是 newPOSv1 的隔离单位，我们用集团空间 key。
- **一次性激活码**：newPOSv1 mock 激活后把码标为已使用；design-v6 默认一次性、可设最大次数。v2s 已裁定激活码永久属于一台终端、不回收（R-8.4、R-8.5）。
- **在激活时创建终端**：newPOSv1 在激活时生成终端编号；v2s 的终端在门店终端管理里预先建好，激活只是把设备绑定上去。
- **激活码只存摘要**：design-v6 的做法。v2s 已裁定明文（D-13）。
- **topic、projection、cursor、snapshot 这一整套同步协议**：本期不做（需求第 12 条）。
- **design-v6 控制平面的大量实体**：profile、template、capability manifest、任务、升级等，本期不做。

## 4 · 关键设计议题

每条写：问题、候选、我的建议、是否需要 Dexter 决定。

### 4.1 部署、数据库与 owner 归属（需求 1、2）

- **deployable**：TDS 成为第二个 Spring Boot deployable，与业务后端各自可横向扩展。
- **数据库**：两者共用一个 PostgreSQL。
- **迁移归属**：
  - (a) 仍保持单一 Flyway history，由业务后端的迁移目录统一承载，TDS 启动时只校验、不迁移；
  - (b) TDS 自带迁移。
  - **建议 (a)**：维持「单一 Flyway history」这条既有约定，避免两个进程抢迁移。
- **owner**：新建一个模块承载「设备绑定、凭证、当前连接的最新值」，暂名 `terminal-access`（名称待定），由 TDS deployable 装配。
  - 它通过 store-terminal 模块的公开 API 读取终端，不直接写门店终端表。
  - 不把这些运行态字段并进门店终端聚合：那个聚合按版本整体保存，频繁的在线状态写入会与编辑冲突。
- **需 Dexter 决定**：迁移归属；新模块的名称与边界；以及为 §2.4 的治理边界新立一份 decision（第二个 deployable、TDP 落地、Doris、跨节点信号）。

### 4.2 WebFlux 与现有阻塞式数据访问（需求 3）

- **事实**：现有模块都用阻塞式 `JdbcTemplate`。
- **候选**：
  - (a) WebFlux 处理器把数据库调用切到 `boundedElastic` 线程池，复用现有模块；
  - (b) 为 TDS 改用 R2DBC。
- **建议 (a)**：激活、换令牌、取消激活都是低频操作。
- **关键约束**：ping/pong 不能每次都写数据库，最新值按节拍合并写入（见 4.8）。
- **需 Dexter 决定**：否（工程选择）。

### 4.3 服务 URL 与集团空间（需求 4）

- **建议**：路径带集团空间 key，与运营后台 `/api/operations/group-workspaces/{groupWorkspaceKey}/...` 的做法一致，也满足 D-16。
- **示例路径**（示例里的 `tpd` 我理解为 `tdp`）：
  - `POST /tdp/{groupWorkspaceKey}/activations`：激活；
  - `POST /tdp/{groupWorkspaceKey}/connection-tokens`：用长期凭证换短期连接令牌；
  - `POST /tdp/{groupWorkspaceKey}/terminals/{terminalRef}/deactivation`：终端主动取消激活；
  - `GET /tdp/{groupWorkspaceKey}/ws`：升级为 WebSocket。
- **备选**：按集团空间分子域名。需要通配 DNS 与证书，现阶段不建议。
- **需 Dexter 决定**：前缀是 `tdp` 还是别的；路径形态。

### 4.4 激活语义（v2s 与参考最不同的地方）

- **激活的含义**：凭集团空间 key 加激活码，找到那台已存在的终端，把本设备绑定上去。
- **一台终端同一时间只绑一台设备**（需求正本 §6.3 已提示）。同一台终端已绑定其他设备时，候选有两种：
  - (a) 拒绝，要求先取消激活；
  - (b) 新设备顶替，旧设备被踢下线。
  - **建议 (a)**，更安全。
  - 同一设备重复激活（例如重装应用）视为幂等。
- **终端状态闸门**：停用或作废的终端不能激活、不能建连；已连接的终端被停用或作废时，是否立即踢下线也要定。
- **防穷举**：按集团空间与来源限制尝试频率，失败累计锁定一段时间。这是需求正本已写明的前置条件。
- **设备指纹**：取自平台端口的设备标识（`platform-ports/src/foundations/normalizeDeviceIdentity.ts`）；稳定性需要在真机上确认。
- **需 Dexter 决定**：已绑定时拒绝还是顶替；停用或作废时是否立即断线；防穷举的力度。

### 4.5 凭证与连接令牌（需求 4）

- **建议两层**：
  - 激活返回长期终端凭证：只给设备一次，服务端只存摘要，设备放进 `persistSecure`；
  - 每次建连前用它换一个短期、一次性的连接令牌，再带着连接令牌建立 WebSocket。
- **令牌怎么带**：浏览器里的 WebSocket 不能自定义请求头，而 TR-16 要求先过 Expo Web。所以连接令牌放在 URL 查询参数里（短期、一次性，降低日志泄漏风险），或者放在连接后的第一帧。
- **吊销**：凭证带版本号，取消激活时版本失效，旧令牌立即作废。
- **需 Dexter 决定**：长期凭证是否需要定期轮换；连接令牌的有效期。

### 4.6 长连接协议（最小集，需求 12）

- **建连握手**：客户端先发 `HANDSHAKE`（终端编号、应用版本）；服务端回 `SESSION_READY`（会话号、节点号、服务器时间、心跳参数）。
- **心跳**：
  - 客户端定时发 `PING{seq, clientTs, lastRttMs}`，服务端回 `PONG{seq, serverTs}`；
  - 客户端据此算延时，记入 2 小时窗口（需求 11）；
  - 顺带把上一次的延时报给服务端，服务端据此记录最新值（需求 8）。
  - 只用一套应用层心跳，就能同时满足两端的延时记录。
- **超时**：客户端在超时内收不到 PONG，就判定断线；服务端长时间收不到 PING，就关闭会话。
- **服务端主动关闭时带明确原因**：已取消激活、被新连接顶替、节点下线请改连。
- **重连**：指数退避加随机抖动，避免服务重启后所有终端同时重连。
- **重复连接**：同一终端出现两条连接时，保留新的、关旧的。
- **需 Dexter 决定**：心跳间隔与超时的默认值。拓扑现有配置是 10 秒与 30 秒，可作为起点。

### 4.7 横向扩展与跨节点动作（需求 2「不做主从同步」）

- **接入**：任何节点都能接任何终端，节点之间不同步会话。
- **难点**：后台取消激活时，要断开的连接可能在别的节点上。
- **候选**：
  - (a) PostgreSQL `LISTEN/NOTIFY`：共用数据库，不新增基础设施；
  - (b) 定时轮询：违反现行「不引入常态轮询」；
  - (c) 引入 Redis：新增基础设施。
- **建议 (a)**，再加一道保险：终端重连或换令牌时必然校验凭证版本，漏掉的通知也会在下次建连时生效。
- **最新在线值**：按会话先后做条件更新，避免从 A 节点迁到 B 节点时被旧会话覆盖。
- **需 Dexter 决定**：是否接受用 `LISTEN/NOTIFY` 作跨节点信号。这需要新 decision。

### 4.8 记录：PostgreSQL 存最新值，Doris 存历史（需求 8）

- **最新值**（PostgreSQL）：激活状态、绑定设备、当前会话所在节点、最近连接与断开时间、最近心跳时间、最近延时。延时按节拍合并写入，不随每次 ping 写库。
- **历史**（Doris）：激活、取消激活、连接、断开、延时采样。
  - 由 TDS 异步批量写入（例如 Stream Load），失败有界重试；
  - 历史写入失败不能影响长连接本身。
- **待定**：
  - 历史是否允许在极端情况下丢失：若不允许，就要先落 PostgreSQL 再转存，这属于 outbox，现行约定默认不引入；
  - DEV、后台验收环境里 Doris 放在哪：远端主机加容器？Testcontainers 起 Doris 较重，后台验收是否要覆盖历史写入？
- **需 Dexter 决定**：历史可否有损；Doris 的环境与测试范围。

### 4.9 取消激活的两条路径（需求 9、10）

- **后台发起**：候选有两种。
  - (a) 放在 TDS。但运营后台今后要调用它，TDS 就得学会运营后台的登录会话、权限与审计；
  - (b) 放在业务后端，作为门店终端管理的一个写操作。复用 `EDIT_STORE_TERMINAL` 权限与审计，写入取消状态后，通过 4.7 的信号让 TDS 断线。
  - **建议 (b)**。
  - 本期「仅测试 API」可以只做接口与后台验收，不做页面。
- **终端发起**：
  1. 终端带长期凭证调用 TDS 取消激活，服务端作废凭证、断开连接；
  2. 终端调用 state 的 `reset` 清空全部持久化；
  3. 再调用 `appControl.resetRuntime` 重启 JS。
  - 本期 node 测试断言：取消激活接口被调用、`reset` 与 `resetRuntime` 按顺序被调用。
  - **待定**：网络不通时终端是否允许「只清本地」。
- **需 Dexter 决定**：后台取消激活放在哪个服务；离线时终端能否单方面清空。

### 4.10 TER 侧的包划分（需求 5、6、7）

- **`kernel/base/terminal-data-client`**：owner 包。
  - **command**：激活、取消激活、建连、断连。
  - **身份与凭证**：终端编号、集团空间、长期凭证。持久化到 `persistSecure`，按 TR-04 要有重启测试。
  - **连接状态**：状态、会话号、节点号、2 小时延时窗口。不持久化（需求 11）。
  - 网络经由注入的 HTTP 与 WebSocket 连接器，满足 TR-06；node 测试注入 Node 自带的实现。
- **transport（需求 6）**：
  - WebSocket 的多地址切换、记住首选、`replaceServers` 已具备；
  - 缺的是一个带顺序切换与首选记忆的 HTTP 请求执行器，对应 newPOSv1 `httpRuntime.ts` 的做法。
  - 建议只补这一块。
- **服务地址管理（需求 7）**：
  - 候选：
    - (a) 新建 `kernel/base/server-config` 包，登记服务名与各环境的多地址，以后 admin console 切换服务也放这里；
    - (b) 放进 terminal-data-client 自己；
    - (c) 像拓扑一样放进 contracts 的 JSON。
  - **建议 (a)**，但本期只做静态目录与解析；保存「当前选中哪个环境、有哪些覆盖」的持久化状态，等 admin console 真正要切换时再加，避免先建没人用的状态。
  - newPOSv1 把 `server-config-v2` 单独成包，理由也是避免地址散落各处。
  - 默认值加可选覆盖、最后传入者生效，符合现有开发配置从简的约定。
- **需 Dexter 决定**：服务地址是否单独成包。

### 4.11 验证范围

- **后端**：
  - TDS 的 WebSocket 集成测试：用 Reactor Netty 客户端验证握手、心跳、超时、踢线、重复连接；
  - 激活、换令牌、取消激活的真实 HTTP 场景，纳入后台验收；
  - 跨节点踢线要起两个 TDS 实例验证。
- **终端**：
  - terminal-data-client 的 node 测试，用本地假服务验证协议与状态；
  - 可选一条 node 连真实 TDS 的联调，需要远端 DEV 加入 TDS。
- **与 TR-16 的关系**：TR-16 要求先过 Expo Web。本期按需求只做 node 测试、不做 UI，建议登记为本期的明确例外。
- **需 Dexter 决定**：终端侧是否要连真实 TDS 联调；DEV 拓扑是否本期就加入 TDS 与 Doris。

## 5 · 我建议的本期范围（最小闭环）

**做**：

- **TDS**：WebFlux 应用；激活、换令牌、终端取消激活三个 HTTP 接口；一条 WebSocket（握手、心跳、超时、踢线、重复连接、服务端主动关闭原因）。
- **跨节点信号**：`LISTEN/NOTIFY`。
- **数据**：新 owner 模块的三张表（绑定、凭证、在线最新值）；Doris 历史的异步批量写入。
- **业务后端**：一个后台取消激活接口（若 4.9 选 (b)），只测 API。
- **TER**：
  - `terminal-data-client` 新包；
  - transport 补 HTTP 顺序切换；
  - `server-config` 新包（若 4.10 选 (a)）；
  - node 测试。

**不做**：topic 同步、TER UI、admin console 的服务切换、运营后台入口、统计、凭证定期轮换（若 4.5 定为以后）。

## 6 · 需要 Dexter 决定的问题（按影响排序）

1. **治理边界**：同意为「第二个 deployable、TDP 落地、Doris、跨节点信号」新立 decision 吗？迁移是否仍保持单一 Flyway history（4.1）？
2. **后台取消激活放在哪**：业务后端（推荐）还是 TDS（4.9）？
3. **已绑定时再激活**：拒绝（推荐）还是顶替？停用或作废时是否立即断线（4.4）？
4. **跨节点踢线**：用 PostgreSQL `LISTEN/NOTIFY`（推荐）吗（4.7）？
5. **服务 URL**：`/tdp/{groupWorkspaceKey}/...` 的形态可以吗（4.3）？
6. **服务地址管理**：单独新建 `server-config` 包（推荐）吗（4.10）？
7. **历史数据**：Doris 历史能否有损？DEV 与测试环境里 Doris 怎么放（4.8）？
8. **离线取消激活**：终端能否在网络不通时只清本地（4.9）？
9. **心跳参数**：间隔、超时、令牌有效期的默认值；长期凭证要不要轮换（4.5、4.6）？
10. **验证范围**：终端侧是否连真实 TDS 联调；本期 DEV 是否就加入 TDS 与 Doris（4.11）？

## 7 · 下一步

先就 §6 讨论定稿。之后由 Claude 写需求正本（含验收判据），再按惯例交独立审查与 Codex 评审；需求定稿前不进入设计或实施。

## 8 · 第 1 轮讨论记录（Dexter 2026-09-25）

### 8.1 Dexter 回复（逐字）

> 4.1，4.2，4.3，4.9，是不是所有激活、换令牌、取消激活等操作都放到apps/backend/catering-business-server，TDS只做WebSocket连接就会更简单一点？
>
> 4.4，拒绝
>
> 4.5，长期凭证不轮换，连接令牌你来定就好了。
>
> 4.6，30秒心跳，90秒超时，要求服务器可配置，终端连接后根据服务器规则。
>
> 4.7，接受用 LISTEN/NOTIFY 作跨节点信号
>
> 4.8，接受，Doris与PostgreSQL一样部署与测试，reset的时候要一起清空。
>
> 4.9，离线时终端能单方面清空。终端因为服务端被取消激活后，WS会断开，终端再次尝试获取连接令牌或连接时，应该明确返回终端被取消激活，然后终端自己执行取消激活逻辑。
>
> 4.10，服务地址管理，新建 kernel/base/server-config 包，但我希望做完整，因为它也需要slice 持久化，也需要command和actor，我希望后续做admin console的时候，server-config可以零改动
>
> 4.11，单元测试的时候后端和终端可以分开。但本期交付的时候，两端必须要能打通，必须有指定的测试脚本支持双端联动的测试。TDS 与 Doris本期就是 DEV 拓扑必要组成部分

### 8.2 已定（本轮）

- **已绑定时再激活**：拒绝（4.4）。
- **激活码穷举**：本期忽略，不做防护，不增加复杂度（Dexter 追加原话：「可以忽略激活码穷举的问题，不要复杂化」）。这覆盖了门店终端需求正本 §6.3 第 2、5 条「将来的激活设计必须自带防穷举」的要求，也取代本稿 4.4 的防穷举一项。
- **长期凭证**：不轮换；连接令牌由 Claude 定（4.5，见 8.3 第 2 条）。
- **心跳**：30 秒心跳、90 秒超时。由服务端配置，终端建连后按服务端下发的规则执行（4.6）。
- **跨节点信号**：PostgreSQL `LISTEN/NOTIFY`（4.7）。
- **Doris**：部署与测试方式和 PostgreSQL 一样，reset 时一起清空（4.8）。
- **取消激活后的终端行为**（4.9）：
  - 离线时终端可以单方面清空本地；
  - 终端被服务端取消激活后长连接断开，之后再取令牌或建连，都要明确返回「终端已取消激活」，终端随即自行执行取消激活逻辑。
- **服务地址管理**：新建 `kernel/base/server-config`，要做完整（持久化 slice、command、actor），目标是以后做 admin console 时本包零改动（4.10）。
- **验证**（4.11）：
  - 单元测试可以前后端分开；
  - 本期交付时两端必须真实打通，并有指定的测试脚本支持双端联动测试；
  - TDS 与 Doris 本期就是 DEV 拓扑的必要组成部分。

### 8.3 Claude 对本轮问题的回答

**1. 激活、取消激活都放进业务后端，TDS 只做 WebSocket：同意，这样更简单。**

- **理由（仓内事实）**：业务后端已经具备这些 HTTP 操作需要的全部基础。
  - 按集团空间 key 路由的「公开」接口已有 12 个，例如运营后台登录与邀请，激活接口可以照同样形态做；
  - 契约生成、typed problem、审计、幂等回执与后台验收都是现成的。
- **放在 TDS 的代价**：这些都要在 WebFlux 里再搭一遍，而且以后运营后台要调用 TDS，还得让它学会登录会话与权限。
- **放进业务后端，TDS 就只剩长连接这一件事**：认证建连、会话、心跳、踢线、在线最新值与历史。
- **修订后的分工**：
  - **业务后端**：终端激活（公开接口，带集团空间 key；按 8.2 不做防穷举）、终端主动取消激活（终端凭证认证）、后台取消激活（运营后台面，复用 `EDIT_STORE_TERMINAL` 与审计；本期只测 API），并记录激活与取消激活的最新值与历史。
  - **TDS**：只有 WebSocket。负责认证建连、按服务端规则心跳、超时断开、`LISTEN/NOTIFY` 踢线、服务端主动关闭时带明确原因，并记录连接、断开与延时的最新值与历史。
  - **持久化**：绑定与凭证由业务后端一侧的 owner 模块拥有；TDS 装配同一模块的公开读取 API 来校验凭证。在线最新值由 TDS 一侧的 owner 模块拥有。两边写 Doris 共用一个写入模块。
- **需要知道的一个代价**：业务后端要新增一个「终端」暴露面，以及终端凭证这种新的认证方式（现有只有两种会话 cookie 和无认证）。这是一次性的平台能力，以后终端调用业务接口也会用到。

**2. 连接令牌：我建议不再单独换令牌，改为建连后首帧用长期凭证认证。**

- **做法**：终端连上 WebSocket 后，第一帧发送终端编号与长期凭证；TDS 校验通过后回 `SESSION_READY`，并下发心跳规则（30 秒与 90 秒，服务端可配）。
- **为什么不换令牌**：
  - 换令牌要求每次重连都先经过业务后端。业务后端不可用时，TDS 明明在线，终端也连不上；
  - 首帧认证没有这层依赖，也少一张令牌表和一个接口；
  - 安全上两者相当：换令牌同样要在每次重连时发送长期凭证；首帧走加密连接，不会像 URL 参数那样进入代理日志；浏览器里也能用，满足 TR-16。
- **约束**：TDS 对未认证的连接设认证时限（例如 10 秒），并限制每个节点的未认证连接数。
- **取消激活后**：TDS 以「已取消激活」为原因关闭连接；终端之后再建连，首帧认证同样返回这个原因，终端据此执行本地取消激活（满足 8.2 第 6 条）。
- 如果你仍希望保留「连接令牌」这一步，我按「一次性、60 秒有效、只存摘要」来定，也能满足同样的行为。

**3. 服务 URL（修订 4.3）**：

- 业务后端：`/api/terminal/group-workspaces/{groupWorkspaceKey}/...`，与运营后台现有路径风格一致；
- TDS：`/tdp/{groupWorkspaceKey}/ws`。

**4. `kernel/base/server-config` 的完整范围（落实 4.10「零改动」）**：

- **持久化 slice**：当前选中的环境（space），以及每个服务的地址覆盖。
- **command**：切换环境、覆盖某个服务的地址列表（增、改、删、排序）、清除覆盖、恢复默认。
- **selector**：生效中的完整配置、某个服务的有效地址。
- **变更通知**：按 TR-11 转成 command 交给消费方。例如 terminal-data-client 收到后调用 transport 的 `replaceServers` 重连。
- **验证方式**：在 node 测试里只用这些 command 模拟 admin console 的全部操作；以后接 UI 时本包不需要改。
- **不放进本包**：「测试某个地址能否连通」这类网络动作，属于 transport 或具体客户端。

### 8.4 仍待 Dexter 确认

1. 按 8.3 第 1 条的分工修订（业务后端负责 HTTP、TDS 只做长连接），可以吗？
2. 连接认证改为首帧携带长期凭证、不再换令牌（8.3 第 2 条），可以吗？
3. 两处 URL 形态（8.3 第 3 条）可以吗？
4. 治理边界仍需新立一份 decision：第二个 deployable、TDP 落地、Doris、`LISTEN/NOTIFY`、终端暴露面与认证方式、单一 Flyway history 的保持方式。我在写需求正本时一并起草，交你拍板。

