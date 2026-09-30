# 终端激活与长连接 · 批次二详设

```text
DOC_KIND=IMPLEMENTATION_DESIGN
BUSINESS_SOURCE=doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md
SERVICE_SHAPE=doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md
AUTHORIZED=DEXTER_BATCH_2_DESIGN_AND_IMPLEMENTATION_PLAN_ONLY
NOT_AUTHORIZED_NOW=source_implementation; dependency_or_lockfile_changes; generation; build; test; managed_runtime; DEV; reset; seed; L2; UAT; deployment; batch_3
IMPLEMENTATION_AUTHORITY=false
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-DESIGN-2026-09-30
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
REVIEW_TARGET=DESIGN
REVIEW_STATUS=AUTHOR_REVISED_PENDING_FRESH_INDEPENDENT_REVIEW
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION
```

## 收录尺度与范围

本详设只定义需求批次二。批次二是一个原子交付；CP 仅为未来实施的内部阶段，不构成独立交付或授权。本稿形成于详设与计划授权内，没有改动需求、decision、源码、契约或其他文件，也没有运行构建、测试、生成器、DEV、reset、seed、L2 或 UAT。

包含：`server-config`、`terminal-data-client`；TER transport、state reset 保留范围、DevicePort 网络状态；已有两个 `terminal` HTTP operation 的 TER 生成与校验、以及这两个终端请求 DTO 按 R-15.7 忽略未知字段的后端生成器变更；现有 Expo Web 冒烟；TER 注入式 Node 客户端与 DEV 联调；TDS 可配置节点号、Actuator 就绪检查及先摘除后下线；DEV 三个 TDS 节点与两个 HAProxy 入口。

不包含：批次三 Doris、跨节点会话取代与同步、topic 同步、大块业务数据推送、Android/Expo Web 实际 WebSocket/代理接入、TER 页面入口、生产部署、UAT 与设备操作。Android 与浏览器压缩证明按 R-10.5 延后；本批只证明注入式 Node 客户端。DEV 的激活数据沿用现有 `r5-full` 业务 fixture；本批不把终端凭证身份加入 seed。

## 0 · 输入、授权与证据

按用户指定顺序先读需求 §0～§10、§12、§13 与 owning source，再读需求 §11。恢复并核对 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`、`doc/platform/README.md`、`doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md`、`doc/platform/terminal-coding-standard.md`（TR-09～TR-16）、`doc/platform/third-party-library-usage-standard.md`、`scripts/README.md`、项目记忆 kernel 与本任务六维命中原文、已接受 Journey/service-shape decision、批次一详设/计划/复核、共享协议、TER 与 TDS 当前源码。

授权边界依 D-33/D-34：当前回合只写本详设与实施计划，并提交 `REVIEW_TARGET=DESIGN` 独立审查。后续实施必须以本稿和实施计划获准为前提，并遵从其中 CP 对账、6b、运行准入和清理要求。需求正本、门店终端需求和 accepted decision 本回合不编辑。

**来源差异与批次边界**：Journey 表第 48、54 行将终端持久凭证表述为保存在 `server-config` state；第 48 行的 owner 列则写 `terminal-data-client/state`，第 54 行也把恢复职责分给 `terminal-data-client/state`。这与需求 R-9.3/R-9.6、D-16 及本次 Dexter 指派中的唯一身份住址不一致。本设计遵循当前明确指派：`terminal-data-client/state` 是唯一终端凭证身份持久化 owner；`server-config` 只持有环境、服务覆盖与受保护代理配置。该差异作为 accepted Journey 的来源漂移记录，不修改 Journey 或 accepted decision。后续实施开始前重新读取两处 Journey 原文；若 owner 已更正文案则按新字节执行；若仍矛盾，先由 Journey owner 修订或由 Dexter 明确裁定来源优先级，再进入 CP-01，不得由实施者自行改 accepted Journey，也不得建立第二凭证库。

## 1 · 业务目标与方案比较

### 1.1 结构性问题

批次一只完成服务端端点与单节点 TDS。TER 还没有唯一的地址/代理配置 owner、可经 command 调用的终端激活生命周期、基于当前配置轮转的可靠传输，以及匹配终端凭证接口的生成客户端。与此同时，DEV 的多个 TDS 实例若没有健康摘除的入口，会把节点内部故障暴露给设备；直接在旧 session controller 上加重连会混淆机制与终端业务决策。

不做本批：设备无法通过获准的 TER 接口完成激活/取消激活、长连接状态不可查询，代理与多地址行为无法按服务隔离，节点的优雅下线也无法在保持现有 WebSocket 的同时让入口停止分流。

### 1.2 方案比较

| 决策 | 方案 | 结论 | 理由 |
|---|---|---|---|
| 服务配置所有权 | 把 server-config 放进 transport | 拒绝 | transport 是机制 owner；环境选择、地址与代理覆盖、持久化属于配置 owner。混入后 transport 会拥有策略与持久数据。 |
| 服务配置所有权 | 把地址、密码分别存进 terminal-data-client | 拒绝 | HTTP 与 WebSocket 使用同一配置，分散存储会产生两份权威值，并违反 D-16 的唯一保留范围。 |
| 服务配置所有权 | 独立 `server-config` owner，transport 只接收按服务解析的配置快照 | **采用** | 沿用 `TransportServerConfig`，保持配置与传输机制单向依赖；selector 掩蔽密码，网络装配得到一次性内部快照。 |
| 重连策略 | 在 terminal-data-client 内自写完整重试 loop | 拒绝 | 与 R-10.3 及 transport 的 owner 边界相冲突；会重复连接机制。 |
| 重连策略 | transport 的 command/actor 持有节奏、地址轮转、网络恢复与无限重连；terminal-data-client 提供会话信号和业务处置 | **采用** | 沿用现有 transport/runtime command-actor 能力，不把“收到已取消激活后本地清空身份”等业务策略放入 transport。 |
| WebSocket Node 客户端 | Node 内置 WebSocket 与 Node 内置 Undici 混用 | 拒绝 | 内置版本随 Node 发布，不能依靠它与独立包的代理 dispatcher API 兼容。 |
| WebSocket Node 客户端 | 新增 `ws` 并自行适配 fetch 与 WebSocket 两套网络栈 | 拒绝 | 本仓已有可满足要求的 Undici 组件；多一套客户端与代理接线没有收益。 |
| WebSocket Node 客户端 | 固定独立 `undici@8.11.2`，同一包提供 WebSocket、fetch 与 `ProxyAgent` | **采用** | 8.11.2 的官方源码明确提供 Node 客户端所需的 `client_max_window_bits` 报价、解压尺寸上界和可注入 dispatcher；同时已包含 8.10.2 的压缩拒绝服务修复。Node 22 采用其当前官方补丁版本 22.23.3；Node 自带 Undici 与新增的 standalone Undici 是不同依赖，客户端只从显式 package import 使用 8.11.2。 |
| DEV 入口 | 每个客户端固定到某个 TDS 节点 | 拒绝 | 不满足 D-45，也不能验证优雅下线与节点故障切换。 |
| DEV 入口 | 两个 HAProxy 入口，入口一 round-robin 到 A/B，入口二只到 C | **采用** | 业务源地址相同也能确定地观察 A/B 分流；不使用源地址亲和；入口内节点下线由成熟组件摘除，入口间失效由 TER 地址轮转处理。 |

**我选了独立 `server-config` owner、owner-command 生命周期、transport 机制、Undici 注入客户端和两入口 HAProxy，而不是把配置/重试/代理散落在使用方，因为这样已有的依赖方向和唯一状态住址得以保留，且每个被测故障都落在一个真实 owner 边界。**

### 1.3 方案取舍的限界

- `server-config` 默认值由应用装配注入；owner 只持久化环境选择、显式服务覆盖与受保护密码，不持久化源代码默认值。
- `terminal-data-client` 对外只有 command 与 selectors；激活、在线取消、离线取消、建连、断连均经 command→actor。回调、命令 actor 与状态 reducer 不互相直接调用。
- Node 客户端实现位于 TER 验证/装配边界，不进入生产终端 package runtime 依赖。生成的 operation 文件没有网络实现。
- HAProxy 只用于受管 DEV 的两个本地隧道入口；节点端口与检查路径只绑定远端 loopback，不增加 PostgreSQL 隧道、不暴露单节点隧道。
- 就绪组只包含 `readinessState`，不加入 `db`。TDS 使用共享 PostgreSQL；周期性数据库健康查询会破坏 V-S8 对 TDS 业务表零查询的计量口径，且数据库故障并不会因把所有共享数据库节点摘除而恢复。数据库不可用仍由 TDS 认证返回已定义的服务端错误。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-01 | 批次二治理增量、R-12 门/生成链与 operation 输入闭环 | main agent / edge generation | decision amendment 的实施步骤、有限门清单、terminal 生成配置/生成文件、终端请求 DTO 未知字段容忍、门与反例 | 需求、accepted decision、批次一 R-12 ledger |
| CP-02 | server-config 与 state 精确保留范围 | `kernel.base.server-config`、`kernel.base.state` | 具名命令、selectors、安全持久化、owner-declared reset retention、默认配置 | CP-01 |
| CP-03 | transport、terminal-data-client、DevicePort | `kernel.base.transport`、`kernel.base.terminal-data-client`、`kernel.base.platform-ports` | command/actor、网络状态桥、连接状态/延时 selectors、代理/HTTP/WS 注入 | CP-02 的配置协议 |
| CP-04 | TDS readiness、节点身份与下线时序 | TDS + backend-acceptance harness | Actuator readiness、3 秒摘除等待、现有 10 秒 drain、可配置 nodeId、闭集 TDS 合约场景选择 | CP-01；不引入跨节点 session coordination |
| CP-05 | DEV 受管拓扑与 Node 联调装配 | `scripts/dev`、`scripts/test`、Node 注入装配 | 3 个独立 TDS 控制、2 个 HAProxy 入口、运行清单/隧道、双端场景 | CP-02～CP-04 |
| CP-06 | 批次二全部动态验收与交付证据 | 所有上述 owner | V-T/V-B/V-S/V-E/V-G 判据逐条结果、清理 PASS、最终对账和 review 资料 | CP-01～CP-05 |

每个完整 CP 完成后、开始下一 CP 前，fresh 独立只读 reviewer 按需求、详设/IA、项目记忆规范三维对账并给 `MATCHED`；单个文件或改动点不拆成 CP。全 CP 完成后、第一次整体动态验收前，再做一次完整 6b。实施者仍须在每个变更点前后用原文/owning source 双读，并完成对应 focused proof。主 agent 是唯一文件写入者；CP reviewer 只读。

## 3 · 横切机制对照表

| 机制 | ① 复用的现成能力/规范 | ② 可做的验证观察 | ③ 无现成时的边界形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | N/A；本批无业务 owner 数据读授权或跨 schema join | package dependency 与 generated operation 的编译闭包 | 不新增业务读取权 | 无 |
| 写授权与 grant 复核 | N/A；不新增业务后台命令或用户授权 | 确认 terminal 激活仍为 `NONE`，设备取消仍只走 terminal credential | 不得把用户/IAM 权限加到激活请求 | 2 个现有 terminal operation，仅客户端生成 |
| 跨 owner 写与事务 | N/A；本批无 Java business owner 写 | edge operation identities 与 backend-acceptance 行为保持不变 | 不复制 terminal-binding 数据或凭证 | 无 Java 写路径 |
| 集合形态与分页 | N/A | — | — | 无 |
| 缓存失效 | server-config command 的 state store subscription 由其 owner 包处理；transport 只读取最新版本配置 | 命令前后 selector 值及 revision；现存 WebSocket 不被关闭 | 若没有既有 store subscription，只允许 owner 内 selector/command 订阅，不引入全局 event bus | 当前环境、各服务的地址/代理覆盖 |
| RTK 数据读取 | N/A；没有 RTK API 或页面 | — | — | 无 |
| 同一事实一个住址 | `server-config` 唯一持有持久配置；`terminal-data-client` 唯一持有终端身份；transport 只持有易失首选与会话机制 | 重启/取消激活后逐 owner 读取；检查没有 second credential store | 不复制凭证或代理密码到 transport state | 激活身份、配置、连接态与 RTT |
| 失败可见且原因不得改写 | 后端/TER 协议闭集、R-10.1、runtime result 类型 | 错误闭集与终端 owner 状态断言逐类匹配 | 不把网络错误变为成功 fallback；激活只按 `safeRetryable` 和确定送达状态切地址 | 激活、设备取消、HTTP failover、WS 重连 |
| owner 错误到 HTTP 映射 | 当前 OpenAPI/error catalog，既有生成链 | 当前 2 个 operation 的 `errorSetRef` 与 generated descriptor 对比 | 不新添业务码、不改 status 或 error set | `activateTerminal`、`cancelTerminalActivation` |
| 新 owner 审计三件套 | N/A；TER client 与 server-config 是本地 TER owner，不产生后端业务审计 | 确认无后端审计 schema/operation changes | 不写 Java 业务 audit table | 无 |
| 幂等键与重放 | R-1.6 激活秘密重试、R-15 operation 描述 | 同一激活操作的 command 重调与地址重发都收到同一秘密 | 不引入通用 replay/store/operation id | 激活 client |
| 生成物而非手搓字符串 | R-15 生成器正本；现有 edge-codegen | 删除生成物字段后 drift 失败；重生成前端 outputs 字节一致 | 生成器内生成全量闭包，不复制类型到 owner | 2 个终端 operation |
| 日志与脱敏 | `AGENTS.md` observability standard、Undici/TDS run-scoped logs | run id/phase/process identity 贯穿；可搜阳性 marker，激活码/凭证/代理密码阴性 | 不记录 URL userinfo、Authorization、payload、secret hashes | Node、transport、server-config、TDS、HAProxy runner |
| 迁移回填 | state schema/version 机制；无 PostgreSQL/Flyway migration | 重启后持久 state hydrate；旧 server-config schema 缺失时回默认 | 不迁移 TDS/业务数据库 | server-config 初始版本与 secure fields |
| 前端共享行为 | N/A；没有管理页 | 现有 Expo Web sample-console smoke | 不新增 UI/foundation 行为 | 仅 DevicePort read-only capability projection |
| 管理后台交互 | N/A；没有 L2 操作控件 | V-T17 现有 Expo Web 页面及三行状态 | 不新增可交互控件 | `ui/integration/sample-console` 既有 platform-port view |
| 候选/下拉、编码呈现 | N/A | — | — | 无 |
| 会同时坏的原子组 | `server-config` 地址+代理、reset retention+持久化、transport reconnect+DevicePort、3 TDS+2 LB+manifest | CP 对账与 V-T/V-E 配对场景 | 原子测试 fixture 按完整逻辑配置建立 | 上述四组 |

### 3.1 第三方库 API 与运行行为依据

| 组件/实际版本 | 本批使用点 | 官方精确依据与必须证明的行为 |
|---|---|---|
| Spring Boot `4.1.0`（root Gradle 插件解析版本） | TDS `spring-boot-starter-actuator`；`ApplicationAvailability` readiness indicator 与 HTTP health group | [Spring Boot 4.1.0 `ReadinessState`](https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/availability/ReadinessState.html)、[4.1.0 `ReadinessStateHealthIndicator`](https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/health/application/ReadinessStateHealthIndicator.html)、[4.1.0 WebFlux Actuator mapping](https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/webflux/actuate/endpoint/web/package-summary.html)。只暴露 Actuator `health` endpoint，基路径为 `/actuator/health`；readiness group 的 URL 是 `/actuator/health/readiness`，且只含 `readinessState`，detail/components 禁用。focused + backend-acceptance 实测 status 与关停事件时序。不得手造 readiness endpoint。 |
| **拟新增精确 pin** Node.js `22.23.3` + standalone `undici@8.11.2`（尚未写入本仓 package/lock；不是当前已解析依赖的声明） | Node 注入式 HTTP/WebSocket、HTTP proxy、WebSocket proxy、D-37 压缩协商/解压 | [Node 22.23.3 官方发布说明](https://nodejs.org/en/blog/release/v22.23.3)、[Undici 8.11.2 WebSocket API](https://github.com/nodejs/undici/blob/v8.11.2/docs/docs/api/WebSocket.md)、[ProxyAgent API](https://github.com/nodejs/undici/blob/v8.11.2/docs/docs/api/ProxyAgent.md)、[8.11.2 handshake source](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/connection.js)、[bounded PMD inflater](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/permessage-deflate.js)、[8.11.2 package engine](https://github.com/nodejs/undici/blob/v8.11.2/package.json)、[GHSA-3wwx-pv8p-q78v](https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v)。Node 官方 22.23.3 发布说明给出的 Node 自带 Undici 是 6.28.1；本批只显式 import standalone 8.11.2，不以 Node bundled API 替代。官方 tag 源码核验的目标行为：8.11.2 要求 Node ≥22.19.0，发送 `permessage-deflate; client_max_window_bits`，WebSocket/fetch 可注入 `dispatcher`，PMD 解压按 `maxPayloadSize` 上限停止；Node 22.23.3 满足该 engine。当前仓仅有 Node `>=22` 的 engine 下限和 lock 内传递解析的 Undici 8.9.0，不能声称拟 pin 已解析或当前运行时满足版本。CP-03 加入依赖后必须从实际 package manager lock 读回唯一解析版本，CP-05 必须从受管运行时读回 Node 版本；两者分别与该官方 engine/API 对照并冻结证据后才可进入依赖它们的 focused proof。HTTP 与 WebSocket 只从 standalone 包导入，不能混用 `globalThis.fetch`/Node bundled WebSocket 与独立 dispatcher。HTTP 每请求创建/关闭代理 dispatcher；每个 WebSocket 连接持有代理 dispatcher 到 close 后关闭。 |
| HAProxy Community `3.4.6` 容器镜像；implementation run manifest 必须记录 registry digest | DEV 两个 loopback 入口、HTTP readiness check、round-robin 与 WebSocket upgraded tunnel | [官方 3.4 source release index](https://www.haproxy.org/download/3.4/src/)、[官方 3.4 configuration manual](https://docs.haproxy.org/3.4/configuration.html)、[Docker Official Image](https://hub.docker.com/_/haproxy/)。使用 `mode http`、`balance roundrobin`、`option httpchk GET /actuator/health/readiness`、`http-check expect status 200`、`inter 1s/fall 1/rise 1/timeout check 1s`、`timeout tunnel 180s`。readiness 失败后最迟 2 秒摘除，TDS 配 3 秒等待；受管 DEV 动态验证需观察 A/B 真实分流、A graceful removal 和 B crash removal。版本 tag 不代替镜像 digest；digest 在授权实施 CP-05 冻结并写入 run manifest。 |

没有采用 `ws`、自写 CONNECT、帧编解码器、代理池、负载均衡器、轮询线程或日志异步系统。HAProxy 的 Docker digest、Spring 依赖解析与 Node 实际版本在实施前必须从仓内 lock/managed runtime/registry 取得并记录；此设计没有声称它们已在当前 run 中动态解析。

## 3a · L2 与 UI/testId

`L2_SCRIPT_ADMISSION=N/A_WITH_REASON`：本批没有用户可执行的新 UI 控件、操作流程、页面入口或 L2 场景；R-9.1 明确两个新 owner 不接入 application/UI。V-T17 是现有 integration 的 Expo Web smoke，不是 Browser L2。平台端口页仅依据现有 capability projection 显示新增三项只读状态，不产生 click/fill/select 控件。实施不得因此新增 L2 入口或 UI 控件。本项不豁免 V-T16/V-T17。虽然没有 L2 执行动作，DEV reset/seed 前仍须按 AGENTS 的动态前整体准入独立重核完整 admission 输入，并留下 `L2_SCRIPT_ADMISSION=PASS`（空 action 分母，`N/A_WITH_REASON`）；该记录不是 Browser L2 运行授权。

当前字节的 control denominator 来自 `contracts/policy/store-terminal-l2-admission.json` 的六个 `caseIds` 与 `contracts/policy/store-terminal-l2-scenarios.json` 的逐例 `controlKeys`/`actionControlKeys`。静态解析得到 6 cases、60 个 distinct control keys、40 个 distinct action control keys。批次二新增 UI/action/testId/control 数量均为 0；保留现有只读 `TERMINAL_DEVICE_TYPE_READONLY`。这些数是本稿写作时的源文件快照；CP-06 在动态前从当前 policy/blueprint 重算，任何差异都更新分母，不能沿用数字快照。

当前 admission policy 中 36 个 `controlPlaneFiles`，再加本批详设和实施计划两项，形成批次二动态准入的 38 个文件清单；CP-01 把两项路径加入 `controlPlaneFiles`，不修改 case、control/action key、fixture、locator 或 UI 文件。若下列既有 36 项或新加的两项发生字节变化，之前 L2 admission 记录失效，需按新字节重做独立准入：

```text
contracts/policy/store-terminal-l2-fixture.json
contracts/policy/store-terminal-l2-activation-candidate.json
contracts/policy/store-terminal-l2-case-blueprint.json
contracts/policy/store-terminal-l2-locator-bindings.json
contracts/policy/store-terminal-l2-scenarios.json
contracts/policy/store-terminal-l2-timing-budget.json
apps/frontend/operations-admin/src/tests/l2/store-terminal.spec.ts
apps/frontend/operations-admin/src/tests/l2/operationsL2.ts
apps/frontend/operations-admin/src/tests/l2/operationsL2.test.ts
scripts/generate/store-terminal-l2-p1.mjs
scripts/test/browser-l2-runtime.mjs
scripts/test/browser-l2-runtime.test.mjs
scripts/test/l2-suite-admission.mjs
scripts/test/l2-suite-admission.test.mjs
scripts/test/store-terminal-l2-admission.mjs
scripts/test/store-terminal-l2-admission.test.mjs
scripts/test/store-terminal-l2-p1.test.mjs
scripts/test/l2-locator-bindings.static.test.mjs
apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalL2ActionNodes.static.test.ts
apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.static.test.ts
apps/frontend/operations-admin/src/features/store-terminal/storeTerminalTestIds.ts
apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.tsx
apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalFormDrawer.tsx
apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDeviceTypeField.tsx
apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalEditDrawer.tsx
apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalFunctionEditor.tsx
apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalPrinterEditor.tsx
apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalSceneEditor.tsx
doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md
doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md
doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md
doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md
doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-plan-codex.md
doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md
doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md
doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md
doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md
doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md
```

## 4 · 每个 CP 的门控

### CP-01 · 治理增量、生成链和有限门台账

- **RECALL**：需求 §1.1、R-12、R-15.1～15.7、R-16、D-44～D-51；service-shape decision §6.1～6.3、R-12 supersede 文本；批次一详设 §12 的 Q1～Q16 与 Q14；`scripts/README.md`、`tools/verify-gates/verify.mjs`、`tools/terminal-skeleton`、`tools/terminal-platform-ports`、`tools/terminal-ui-state`、`THCL-04-node-tests`。
- **复用**：`contracts/openapi/paths/terminal/activation.paths.json` 已有且仅有 `activateTerminal`、`cancelTerminalActivation`，tag 均为 `terminal-binding`，face 均为 `terminal`；当前 activated edge projection 有 terminal face count 2。复用 `edge-codegen --check` 与 `scripts/verify` 既有 openapi-contracts entry，不造第二套 operation parser。
- **工作**：新增一份仓内 TER generation policy，目标唯一为 `apps/terminal/kernel/base/terminal-data-client`，按 terminal face + tag `terminal-binding` 选中全部 2 个既有 HTTP operation。通过现有 edge generator 生成 `src/generated/terminalApi.ts`，无 import、无网络代码。operation 生成配置与自检接入 `openapi-contracts`；focused 红夹具覆盖 zero/multiple/wrong target/empty selector/non-terminal target/drift/新增未知 terminal face。与此同时按 R-15.7 调整现有边缘 OpenAPI schema 与 `scripts/generate/edge-codegen.mjs`：仅在 `TerminalActivationRequest` 和 `TerminalActivationCancellationRequest` schema 设置 `additionalProperties: true`，并使 edge-codegen 对这两个 terminal request DTO 生成未知子树跳过逻辑；保留已知字段必填/类型/长度/取值校验、重复字段与非法 JSON 拒绝。`OperationsTerminalActivationCancellationRequest` 及其它非 terminal-face DTO 仍拒绝未知字段。更新对应两个 generated Java DTO，不手改生成物。Journey 第 48、54 行的持久身份用词只作为来源漂移记录；本批不编辑 Journey 或 accepted decision。CP-01 写入前须重开该来源：若仍冲突，先由 Journey owner 修订或交 Dexter 明确裁定，未解决则 CP-01 不进入写入阶段。
- **decision 实施清单**：保留 accepted decision 与 acceptance metadata；CP-01 implementation 按 anchor-local amendment 更新其标题和 §6.3 的 Batch 2/3 边界，并逐项处置 §6.1 清单：根 ADR 的 TDS/TDP/单 deployable 条款、TDS placeholder decision、`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`、foundation charter、project-memory kernel/02 与 `required-inventory`、`distributed-topology` memory 与必备断言、seed fixture 中 `tdp=FORBIDDEN`（保持）、backend-acceptance standard、TR-09 server-config retention wording、DEV run manifest/tunnel allowlist。`HANDOFF.md` 按 Dexter 既有指示忽略，不作为实施输入或同步对象。其余 Batch 1/3 条款按 R-12 搜索命中标 N/A 和反例，不做 whole-file supersede。
- **可证伪条件**：配置漏领/双领任一 terminal operation，policy 非仓内输入、目标非 owner package、生成漂移不报错、改动导致 admin 前端 generated file 字节变化、删除当前 skeleton 实包或填入不存在包仍被认为有效，任一则 CP FAIL；任一非 terminal request DTO 改为容忍未知字段、任一 terminal DTO 仍拒绝未知数组/嵌套对象/长字符串、任一已知字段/重复字段/非法 JSON 校验被削弱，或有手改生成 DTO，也为 CP FAIL。
- **验证**：TER skeleton static + graph mutation 三例；TER generator focused suite；新增 `scripts/test/edge-codegen-terminal-unknown-fields.test.mjs` 并登记到 `THCL-04-node-tests`，通过 `edge-codegen --check` 核验生成字节。正例分别覆盖两个 terminal DTO 的 unknown array、nested object、1KiB string；负例覆盖 known-field invalid、duplicate member、malformed/trailing JSON，以及 operations-admin DTO 继续拒绝未知字段。相关 `scripts/verify --validate-only` 与默认模式记录实际静态 entry 与耗时；不重复跑已注册 Node suites。CP-01 结束后独立三维 `MATCHED`。
- **形态理由**：tag 定归属，完整 terminal-face denominator 定闭包；不把操作 ID 清单硬编码成生成器业务逻辑。

### CP-02 · server-config 与 reset retention

- **RECALL**：需求 R-9.3、R-9.6、R-11.1～11.9、§6 第 9 条、V-T1/V-T2/V-T8/V-T12/V-T18；TER TR-04/TR-09/TR-10、state slice/persistence owner API。
- **复用**：`contracts` 里的 `TransportServerConfig`、`TransportServerConfigSpace`、`TransportServerDefinition`、`ResolveTransportServerConfigOptions`；state `defineStateRuntimeSlice`、secure persistence descriptor、`createStateRuntime.reset`；runtime command/actor 与 selector 注册。不要复制 resolver 或另建 key-value store。
- **owner 形态**：新增 `kernel.base.server-config`；slice names 以 `server-config` moduleName 开头。依赖仅 `contracts`, `state`, `runtime`。API command：`selectEnvironment`、`setServerOverride`（一次写完整具名地址与 proxy）、`clearServerOverride`、`restoreServerDefaults`；selectors：effective public config、service addresses、defaults、override flags、proxy auth configured flag。密码不由 selector 返回。
- **网络专用快照**：唯一 assembly boundary 按 `serverName` 读取 `ServerNetworkSnapshot {revision, addresses, proxyCredentials?}`；它只传给 injected network adapter，禁止 UI/log/runtime diagnostic 导出。该 API 是网络装配依赖，不是 selector，不缓存凭据副本。revision 随任何该服务有效地址/proxy command 递增，便于 transport 清首选；不将密码哈希化作版本值。
- **有效配置**：default address 顺序由装配输入决定。override 是完整替换，不按 index 继承 `addressName`/`timeoutMs`/proxy；地址名明确且在同一 service 唯一，override timeout 必填、正整数；每服务 1～4 个地址（V-T1 正向到 4、5 个的红夹具；4 覆盖两个 TDS 入口及当前备用需求，封闭配置/资源上界）。默认地址可不带超时，此时用 R-10.1/R-10.3 缺省 5,000ms。proxy 限 HTTP、非空 host、port 1..65535；用户名与密码同有同无；只支持用户密码的 Basic proxy auth；禁止 SOCKS/PAC。`keepExistingPassword` 仅当原服务 override 已有密码时合法。仅代理用户名不是 secret，密码置 `persistSecure`。
- **持久化与 reset**：单一 app state runtime 和同一 namespace；新增 owner-declared `resetIntent: clear|retain` descriptor（默认 clear）。只有 `server-config` slice 可声明 retain；state runtime 依据已注册 slice descriptor 保留该 owner 自己声明的持久 key，并把保留策略交给各 owner reducer 的 reset action。其他已注册 owner 与未注册 orphan key 照常清除。storage 删除有任一失败，reset 返回失败、不派发可见 reset、不调 `appControl.resetRuntime`；成功则其余 owner 回初始值，server-config 原子保留；不做临时快照 store、不靠 reset 后补写找回密码。TR-09 只更新 server-config 的既有例外说明；不扩大 `kernel.base.state` 的跨 owner 读写权限。
- **server-config defaults**：默认空间由 test/DEV/应用装配输入提供，至少 `DEV` 与 `PRODUCTION` 两环境；服务仅含当前业务后端与 TDS；本地实现以运行 manifest 的 HTTP port、两个 LB tunnel port 提供 `DEV` defaults。production endpoint 由环境装配提供，不写入本地 fixture。缺失已持久化 space 时按 R-11.3 回默认并报告；覆盖按服务跨环境保留，清除 override 才恢复新环境 default。
- **可证伪条件**：任一 command 部分合并地址字段、重排丢失 addressName/timeout、越界配置被接受；取消激活后 server-config 或代理密码变化/丢失，另一持久 owner 未重置，或 orphan key 存活；任一 selector 返回 proxy password。
- **验证**：owner-focused command/selector/storage tests；重启 hydrate；V-T8 全失败路径、两个反例；对取消激活 command races 做 state runtime focused tests。不运行受管 DEV。
- **形态理由**：owner 声明保留，state runtime 使用既有 app reset 管线实现；不再造一份密钥备份，也不把密码放 plain KV。

### CP-03 · transport、terminal-data-client 与 DevicePort

- **RECALL**：需求 R-9.1～9.7、R-10.1～10.5、R-11.6～11.9、TR-01/TR-04/TR-06/TR-09～TR-16、Dexter 命令/selector 要求。
- **依赖**：`transport` 仅依赖 `contracts`, `platform-ports`, `state`, `runtime`；`server-config` 仅依赖 `contracts`, `state`, `runtime`；`terminal-data-client` 依赖 `contracts`, `platform-ports`, `state`, `runtime`, `transport`。transport 不 import server-config、terminal-data-client 或 WebSocket业务策略，server-config 不 import transport，图无环。客户端收到有效配置用依赖注入的 provider，不创建 package dependency 反向边。
- **transport command/actor**：机制 command 至少有 start、disconnect/stop、parameters changed、ready、connection invalid/retry cause 五种职责（名称按现有 command naming），只有 actor 创建/销毁 socket、管理重试计数/计时器、转地址与 preferred。每次 HTTP request 或新 WebSocket attempt 取得当时完整 config snapshot；已连接 WebSocket 不因 config revision 改变而关闭。配置 revision 改变时清掉旧 preferred，不发起 reconnect。
- **HTTP 多地址**：同一次 API 操作持有同一 address list/config revision；默认 attempt timeout 5s、地址 override timeout 自己覆盖。按 R-10.1：连接错误/无法判断是否送达只对 `safeRetryable=true` 操作切下一个地址；业务响应中已知 4xx 立即返回，未知 business code 返回 `UNKNOWN_BUSINESS_REJECTION`，2xx HTML/schema invalid 和 5xx 按送达后失败分类，可安全重试时切下一个。所有地址失败有界并返回最后失败类别；成功后才 mark preferred。拓扑 identity 查询仍用 topology 自己配置，不经 per-service proxy。
- **WebSocket 建连**：连接 open 不算地址成功；只有可解析且语义正确 `SESSION_READY` 才记 preferred。一个 entry 上没就绪的拒绝在同一连接周期继续下一个 entry；两个 entry 都失败则按 R-10.3 重连。主动 `REDIRECT_TO_NEXT_NODE`、`NODE_BUSY` 新连接拒绝沿用 D-45 对应轮转；已就绪 session 的 `REDIRECT_TO_NEXT_NODE` 先按重连节奏尝试当前 preferred entry，该次未就绪再轮转。
- **重连**：首次启动/显式 connect 立即尝试；断开或失败按 n 的 10,11,…300 秒、100%～150% jitter 规则；超 300 秒在 250～300 秒；只有 readiness 后稳定满本次 `SESSION_READY.heartbeatIntervalMs` 才 n=0。机制 actor 在等待时收到网络恢复命令，距最近尝试起点不足 10 秒就补足到 10 秒后尝试；已在尝试时在本次失败后 10 秒起；网络 event 不归零 n。1000 次仍持续、有界定时器、不会忙循环。R-4.6 每种原因的业务反应在 terminal-data-client 测。
- **DevicePort**：扩展现有 `DevicePort` 的 network read/subscribe/unsubscribe，复用 `NetworkStatus` 事实类型，订阅首个值可作状态种子。transport 网络桥先 read 作 seed，再 subscribe；read 失败则首通知只 seed；相同值去重；状态跃迁只 dispatch transport command；unavailable 时不创建 bridge；subscription teardown 在 transport stop/dispose。Android adapter 与 Web dev-host 三能力声明并返回 `unavailable`，本批不调用原生。
- **terminal-data-client commands**：`activateTerminal`、`cancelTerminalActivationOnline`、`cancelTerminalActivationOffline`、`connectTerminal`、`disconnectTerminal` 均 dispatch command，由 owner actor 完成。激活/在线取消使用 generated client + transport HTTP executor；秘密只在单次激活 operation 内由注入安全随机源生成；同次 command 重新调用/地址重发保持同一秘密；迟到答复/并行 command 不能重复写身份。关闭帧、SESSION_READY、PONG、网络跃迁经 command 进入对应 actor，不从 socket listener 直接 mutation。仅 `ACTIVATION_CANCELLED` 允许触发本地 reset，并 exactly-once；先停 transport retry，再调用 `requestApplicationReset`，只有 succeeded 才调用 `appControl.resetRuntime`。
- **Dexter 专项 selectors**（无任何凭证字段）：`selectActivationState` 返回 inactive/activating/active/cancelling 与不含凭证的绑定身份引用；`selectConnectionState` 返回 stopped/disconnected/connecting/awaiting-ready/connected/backoff、当前 safe addressName、nodeId、last close reason；`selectConnectionLatency` 返回 latest RTT 与本地时间有序样本。连接态和 latency 不持久化；每次采样裁掉早于 now−2h 的项，样本数 ≤ `floor(7,200,000 / currentHeartbeatIntervalMs)`，变化心跳间隔后立即重新裁切；重连不清空，JS restart 清空。新增 selector each 至少 1 test，不允许只有 reducer existence test。
- **代理执行**：server-config 的代理密码只在 request/socket 创建时从 protected persistence 解密，内存对象只沿 adapter call stack；绝不放到 log context、HTTP operation descriptor、selector 或异常字符串。Undici ProxyAgent 使用官方 `dispatcher` option；HTTP 对请求生命周期 `close()`，WS 对 socket 生命周期 `close()`；TLS/WSS 由该组件 CONNECT，不实现 CONNECT。错误认证/代理不可达按服务失败，代理对单目标拒绝按“确定未送达”切地址。节点入口透传 WebSocket upgrade，由 HAProxy tunnel。
- **V-T15 generator**：generated method executor 是生成器里的唯一协议正本；零 import 文件内给 operation descriptor、完整类型闭包、错误码闭集、2xx required/basic-type response validator 与 factory；未知 response fields 忽略。执行器新增未知 failure kind 必须 TypeScript 编译红。
- **可证伪条件**：同一安全秘密被重试替换；未收到 ready 即记录 preferred；网络恢复直接 socket/connect；配置更新关闭 active socket；selector 泄漏 secret/错误地清连接态；DevicePort unavailable 下 transport 仍启动；新增命令绕过 actor；代码使用自造 HTTP/WS/proxy 协议。
- **验证**：`terminal-verify` 包 tests、`THCL-04-node-tests` 各注册一次；focused fakes + loopback Node server 的正反例；已有 topology transport contract 同字节回归，不重跑/重复注册现有 test file。V-T17 是后来单独 Web 验收。
- **形态理由**：transport 拥有 retry/failover 机制，terminal-data-client 拥有终端状态和业务 reaction；网络不可用只是 absent capability，不降级成另一个私有监听器。

### CP-04 · TDS readiness 与节点身份

- **RECALL**：需求 R-4.5、R-7.1、R-12、R-13、R-14、R-16.1～16.2、V-S15、V-E6、批次一 `TdsGracefulShutdownLifecycle`/`TdsTerminalSessionActors`/`TdsRuntimeProperties`。
- **复用**：现有 TDS `SmartLifecycle` 的 phase 高于 `WebServerApplicationContext.GRACEFUL_SHUTDOWN_PHASE`、callback 延迟、`REFUSING_TRAFFIC` event、`SessionActors.refuseNewConnections/beginDrain/finishDrain`；追加 actuator，不自写 readiness HTTP endpoint。
- **nodeId**：`TdsRuntimeProperties.nodeId` 默认 `terminal-data-server`，外部配置 key `V2S_TDS_NODE_ID`；validated `TdsRuntimeSettings` 延续非空且 ≤128 字符。managed runner 对 A/B/C 明确传 `tds-a`, `tds-b`, `tds-c`；启动前判唯一。`SESSION_READY.nodeId` 与 PostgreSQL 最新状态 `node_id` 必须相等。
- **readiness**：新增 `spring-boot-starter-actuator`，只暴露 Actuator `health` endpoint（基路径 `/actuator/health`）；readiness group 路径为 `/actuator/health/readiness`，明确 include `readinessState`（不 include `db`），`show-details=never`、`show-components=never`。该 endpoint 与 WebFlux 服务同一进程/端口。HAProxy 仅访问本机 readiness path；外部两个 WS listener 不向用户侧转发 `/actuator/**`。
- **下线精确时序**：关停 phase 中先发布 `ReadinessState.REFUSING_TRAFFIC`；此刻不改 admission/draining，不关既有 session，不拒新连接。用 `readinessWithdrawalWaitMs` 等待 HAProxy 摘除；默认 3,000ms，允许 `V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS` 覆盖到 2,000..10,000ms。下限 ≥ HAProxy `inter(1000ms) + timeout check(1000ms) × fall(1)` 的 2,000ms 最坏发现界；上限不超过现有 10 秒 drain window，避免把单一关停等待变成无界部署暂停。V-S15 用非默认 4,000ms 验收。readiness health group 从 `UP` 转为非 `UP`，其 HTTP 响应不再是 HAProxy 要求的 200；验收断言 `status != UP` 与 HTTP 非 200，不臆定 health body 一定写成 `DOWN`。等待期间旧连接继续 PING/PONG，新连接仍有机会 SESSION_READY。等待完成后先 `refuseNewConnections()`，再 `beginDrain()`（它关闭未认证 pending admission，返回活跃会话存在），等现有 `drainWindowMs`（默认且上限 10,000ms），再 `finishDrain()`，所有 active session 与等待期间登记会话以 `REDIRECT_TO_NEXT_NODE` 关闭。`SmartLifecycle` callback 最后结束，随后才由 Spring 关闭 WebServer。关停期间异常仍完成 callback，日志标记失败；不把 readiness 恢复成 UP。
- **配置闭集**：新增 `V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS` 可选环境覆盖；application config 默认 3,000ms，未给覆盖时读取默认，非法或越过 2,000..10,000ms 边界则启动失败。新增 `V2S_TDS_NODE_ID` 可配置 key，默认仍为 `terminal-data-server`；更新环境键闭集、数量计数和 TDS startup tests，不手改历史计数。DEV `application.yml` defaults 与 runner override 一致；V-S15 实际覆盖等待值为 4,000ms。
- **可证伪条件**：第一条 shutdown event 之前 listener 已关闭/新请求被拒；readiness 下线到节点拒新不足 2,000ms；等待期既有 PONG 丢失或新 SESSION_READY 失败；等待后旧和窗口期新会话未在 10 秒内关闭；nodeId 写回与配置不一致；健康页暴露 DB 细节或 actuator 多余 endpoint。
- **验证**：TDS config unit tests（nodeId default/invalid/unique runner; wait missing/invalid/bound）；backend-acceptance V-S15真实 TDS HTTP health + WebSocket；V-E6真实 HAProxy摘除/转发。该 CP 不写 batch-3 跨节点 takeover。
- **V-S15 选择与隔离**：当前 `--operation` 只选择 BUSINESS 场景，不能用 TDS 场景 ID 冒充 operation。为本批新增闭集 CLI 参数 `--tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain`，唯一允许该 ID；仅接受与 `--operation storeTerminalActivationBusinessPrecedence --topology-preflight` 组合，未知 ID/不允许的组合在本机 wrapper 校验后、远端启动前 fail closed。选择通过 `V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO` 进入受管环境并记录 run manifest。`BackendAcceptanceTest` 新增独立 TDS `@TestFactory`，只运行所选 CONTRACT 场景；它不加入 `BackendAcceptanceScenarioCatalog`、business operation denominator 或 BUSINESS channel。当前 `terminalConnectionTopologyContractProbe()` 无条件输出的 `terminal.connection.vs1.database-only-configuration-startup` 在 V-S15 selector + topology-preflight 组合下改为拓扑预检证据：与现有 `@BeforeAll` `topologyPreflightWithTenSecondOutage` 的结果一并写入独立 `TOPOLOGY_PREFLIGHT` 通道，不作为 V-S15 的 CONTRACT 场景，也不增加场景分母；没有 `--topology-preflight` 时原 V-S1 CONTRACT 场景照常保留。预检须先于 BUSINESS 和所选 TDS CONTRACT；失败时两场景均不运行。该命令的精确分母是 1 个 `storeTerminalActivationBusinessPrecedence` BUSINESS + 1 个 `terminal.connection.vs15.readiness-withdrawal-and-drain` TDS CONTRACT，另加独立 topology-preflight 记录。`TdsAcceptanceProcess` 接收窄的 `TdsStartConfiguration(nodeId, readinessWithdrawalWaitMs)`；V-S15 用非默认 nodeId 和 4,000ms。参数、环境转发、manifest、未登记 ID/组合拒绝、预检先于两场景、只发现所选 TDS 行、V-S1 在非 topology-preflight run 保持 CONTRACT 输出均要有 focused tests。
- **形态理由**：单一 Actuator health path 直接反映 Spring readiness；不增加另一管理 port/自造 probe/数据库轮询。

### CP-05 · DEV HAProxy 与 Node 联调装配

- **RECALL**：需求 D-44/D-45、R-9.5、R-10.5、R-12、R-13、R-14、R-16、V-E1/V-E2/V-E5/V-E6、D-50、AGENTS 环境矩阵/受管资源约束、`scripts/dev/r5-dev-runner.mjs` 与其 manifest/control/tests。
- **TDS 单元**：同一 Gradle artifact 启动三个独立进程，各绑定独有 loopback port、`nodeId`、pid/startticks/host/bootId/log、runId 与共享 DB；进程所有者与资源上限逐节点和 aggregate 入 manifest。
- **HAProxy**：远端 Docker Official Image `haproxy:3.4.6`，实现端在镜像拉取前锁 registry digest；`--network host` 仅绑定远端 loopback listener，与本机 SSH tunnel 相连。入口 1 后端只有 A/B，`balance roundrobin`，健康检查 `GET /actuator/health/readiness` 并精确要求 HTTP 200；入口 2 后端只有 C。每个前端 WebSocket upgrade 之后使用 `timeout tunnel 180s`（TDS ping 每 30s、超时 90s）。管理/控制仅接受当前 run manifest 的 container ID、image digest、host boot id、runId、config sha256 完全匹配；停止、取日志和清理只按该 identity 操作。
- **运行清单与 tunnel**：manifest schema 从单 TDS 扩为三个 TDS controls、一个 HAProxy container control、entry1/entry2 local+remote ports、HAProxy digest/config hash、每 node port/nodeId/readiness/log/identity/RSS、runId、cleanup status。两个端口都指向各自 HAProxy listener；不得 tunnel node port、PostgreSQL、管理端口。local ports 由 runner 选择并记录；Node script 只从该 run manifest 读地址。
- **Node 程序**：一个仓内 `scripts/test/terminal-client-dev-acceptance.mjs` 受管入口，消费 manifest、已 seed 的 fixture identity、scenario 参数；通过终端 owner commands/selector 和 injected `undici@8.11.2` WebSocket/fetch 操作。每设备实例使用独立 runtime namespace 与 `deviceId`；E6 四客户端可在一 Node process 内维持 4 个独立 package compositions，单进程 run identity 与每逻辑客户端安全标识写结构化诊断。operation inputs/secret/activation code 只进进程内存，run output/log 仅报告 safe ref 与结果。
- **fixture 与秘密**：沿用 `scripts/dev/seed` 的当前业务 `r5-full` fixtures（store-terminal seed 8 个 terminal activation code）；脚本只在内存选 1 或 4 条用于场景，不把秘密复制进 JSON 报告/日志；取消激活与再次激活通过真实 HTTP commands。seed run 仍是显式受管动作，DEV start/restart 不 seed。
- **受管控制动作**：扩展已有 `scripts/dev/r5-dev-runner.mjs` 以及 remote guards/tests；提供按精确 node identity 的 graceful-stop(A)、force-stop(B)、restart(A/B)；节点间不得用进程名/端口猜停。资源清理先取所有 Node/TDS/HAProxy logs，再按当前 manifest identity stop/remove；数据库 run resources empty，三个 TDS 和容器全回收。HAProxy cleanup 与 TDS cleanup 各自状态，任一未 PASS 总 cleanup FAIL。
- **可证伪条件**：未登记远端 node/container 被停止；Node 取默认全局 WebSocket而绕过 injected Undici；四个客户端共享同一个 activation identity/state；Tunnel 直接连 TDS node；启动 TDS 少于三个或节点 ID 重复；用来源地址 hash 代替 roundrobin；日志出现 credentials/secret/proxy authorization；留存任何资源而 report PASS。
- **验证**：先运行本 CP local runner guard/config tests（不连远端），通过后整体 6b；首次远端过程必须单场景、topology preflight 对齐。DEV 不得与 TERMINAL UI/TER 的资源门复用同一个计数，按 Dexter 最新指示两套资源门独立；受管 owner 与 RSS 仍必须各自精确归属。
- **形态理由**：远端主机内以 loopback+host-network 让 HAProxy 可访问三个受管 TDS，同时不开放节点端口；没有新拉一套独立 Linux service management。

### CP-06 · 验收与交付

- **RECALL**：需求 §4、D-48、V-B15、V-S15、V-T1～V-T18、V-E1/E2/E5/E6、V-G1；verification governance、failure-family closure、terminal TR-16；implementation task template 6a/6b/6c/13c。
- **顺序**：CP 全部完成/阶段级 MATCHED → 整体 6b MATCHED → `scripts/verify` static/default + `terminal-verify` 当前字节 → §3a 空分母与 control-plane 独立准入复核 → 单场景 backend-acceptance run 内先执行 topology preflight（两个业务上下文、独立 TDS、两套解析版本、REACTIVE、唯一度量 sink、共用 DB/runId、真实 HTTP/WS、受管 10 秒停库恢复、clean exit），全部通过才执行所选业务场景与一个 TDS CONTRACT 场景 → Node focused suite → Expo Web V-T17 → 完整 seed 当前字节 dry-run PASS 与首次 reset/seed/L2 四项整体准入记录 → DEV 三节点/双入口拓扑预检 → V-E1 → V-E2 → V-E5 → V-E6。不得声称拓扑预检在该 managed run 之外已执行；也不得运行全目录去发现静态问题。任一动态运行都不得先于完整 6b。第一批 reset/seed/L2 前需另外满足动态前整体准入；backend-acceptance 按标准可在该四项之前独立运行。
- **V-S15**：TDS contract selector 仅选 `terminal.connection.vs15.readiness-withdrawal-and-drain`。命令为 `scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain`；它运行一个指定 BUSINESS operation（拓扑预检所需）和一个指定 TDS CONTRACT 场景，不扩成全目录或增加 TDS business operation。真实 TDS 配置非默认 nodeId 与 4,000ms wait；先确认 readiness health `status != UP` 且 HTTP 非 200（记录实际 status 值，不硬编码 `DOWN`），等待期现有及新建 session 仍能 PING/PONG 与 SESSION_READY；wait 届满后拒新，再 drain（最多 10 秒）并以 redirect 关闭 active/等待期登记 session；SESSION_READY nodeId 与 DB 最新状态相同。`bad-order-red` 由 TDS lifecycle focused test 断言“拒新发生在 wait 届满前”即 FAIL，不伪装成第二个 acceptance scenario。输出 CONTRACT、BUSINESS、DB_OPERATIONS、cleanup 分别记录；清理单独 PASS。
- **V-T17**：只启动现有 Expo Web sample-console smoke；观察三个 network capability row 均 unavailable，transport 未派发命令/连接；无页面/ L2 扩张。
- **V-S15 受管入口**：在 `scripts/test/backend-acceptance` 及 `scripts/test/r5-remote-testcontainers.mjs` 增加闭集参数 `--tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain`。只与 `--operation storeTerminalActivationBusinessPrecedence --topology-preflight` 组合；未知场景、缺拓扑预检、错误 operation 或 calibration 组合必须在远端进程启动前失败。selection 写入 run manifest，并传给独立 TDS CONTRACT factory。第一次 command 为：`scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain`。本次 acceptance run 先做 topology preflight，只有 preflight 全通过才运行单个 BUSINESS operation 和单个 TDS CONTRACT 场景；输出通道独立。它不把 V-S15 放进 `--operation` 或业务 catalog。
- **DEV topology preflight**：重跑时按当前 DEV 与 TDS+HAProxy manifest 检查 process/container identity、host/bootId/start ticks、RSS/aggregate budgets、3 个唯一 nodeId、readiness、共享 DB、entry1/entry2 两条 tunnel、本机 Node version/package resolution、真实 HTTP 与 WebSocket。不得用 remote TDS direct port。该拓扑与 acceptance 内的单 TDS 进程是两个不同 managed lifecycle，分别记录资源及 cleanup。
- **Failure family**：同 failureCategory 第 2 次出现，只冻结该族后续场景；从 log/owning source 定位根因，代码变化后用同一 focused proof 归零再继续；这不停止整个批次，不等 Dexter。代码未变不重跑；first failure 保留，business 与 cleanup 分开；不得延时、换场景或换命令规避。
- **可证伪条件**：空白/没对应真实行为的场景 ID；把 package node proof 说成 DEV；把 `/actuator/health` 单点请求说成完整 shutdown；受管业务 PASS 但 cleanup 没 PASS；V-T selector 无真实读回断言。
- **交付时输出**：每条验收判据当前 byte 状态；runId/time/result 与 last known good 对照；版本/摘要；generated/fixture/runner artifacts hashes；所有 managed controls cleanup；每个 command/selector tests；逐代码-详设 MATCHED；fresh implementation review 记录。

## 5 · Operation、路径、face 与集合形态

| 业务意图 | operationId | method/path | face | 集合形态与预期规模 |
|---|---|---|---|---|
| 激活终端 | `activateTerminal` | `POST /api/terminal/group-workspaces/{groupWorkspaceKey}/activation` | `terminal` | 1 item；保留现有无用户授权语义、请求体、response/error闭集 |
| 设备主动取消激活 | `cancelTerminalActivation` | `POST /api/terminal/group-workspaces/{groupWorkspaceKey}/terminals/{terminalRef}/activation/cancel` | `terminal` | 1 item；保留 terminal credential 与 operation 语义 |

来源：`contracts/openapi/paths/terminal/activation.paths.json` 与边缘契约目录 `operationId` 处置。当前 `terminal` face operation count 为 2；不改 backend route、`operationId`、认证或错误闭集。R-15.7 仅调整两个 terminal request schema 的 `additionalProperties` 兼容元数据，并由 `edge-codegen` 重生对应请求 DTO；不增加 API operation、error code 或 DB operation budget。TER 生成配置按 tag 归入 `terminal-data-client`，face denominator 作精确闭包。

## 6 · 跨 owner 写矩阵

本批不修改 Java business owner、route/controller/service 业务判定、跨 owner transaction 或数据库写。R-15.7 只改 OpenAPI terminal request schema 兼容元数据与 edge-codegen 生成的两个 edge wire adapter DTO；这不改变后端业务 owner、命令、业务语义或 ops-admin DTO。TER 本地 actions 的所有 mutation 通过对应 package owner command；`state` 仅提供已注册 slice persistence/reset transport。`terminal-data-client` 不读取 server-config slice 根状态、不写 server-config；只消费按 package API 注入的有效网络快照。

## 7 · 声明—传递—消费

| 事实 | 声明 | 传递 | 消费 | proof |
|---|---|---|---|---|
| 服务地址/代理 | `TransportServerConfig` default + server-config overrides | `selectEnvironment/setServerOverride` → owner state → revisioned internal network snapshot | 每个 HTTP request / 新 WebSocket attempt | V-T1/V-T2/V-T18 |
| proxy password | server-config protected persistence | internal snapshot只传给 Undici adapter | ProxyAgent 授权；selector只出 `passwordConfigured` | V-T18 + leak search |
| terminal identity | terminal-data-client owner secure state | activation command/actor + generated operation response | auto-connect/cancel/connect actors | V-T4/V-T8/V-E1 |
| server-config retention | owner slice descriptor `resetIntent=retain` | state runtime reset保留该 owner's persisted keys; reset dispatch to owner reducers | reset 后 hydration | V-T8 reverse/partial failure tests |
| connection/retry state | terminal-data-client ephemeral slice | WebSocket/node callbacks dispatch commands | three dedicated selectors | V-T4/5/6/7 focused tests |
| retry signals | R-10.3 fixed parameter/ready/failure/retry/stop owner signals | terminal-data-client command → transport command | transport actor mechanism | V-T7/V-T14 |
| network availability | DevicePort read/subscribe/unsubscribe | transport bridge seed+dedupe→mechanism command | transport actor only | V-T14/V-T16 |
| terminal HTTP contract | edge contract face/tag/security/error closure; only two terminal request schemas allow unknown fields | edge-codegen generated Java wire DTOs + terminal generation policy→TER generated file | terminal-data-client executor injection | V-T15/V-B15 |
| node identity/readiness | TDS `nodeId`, Spring readiness event | Actuator `health` endpoint (`/actuator/health`) readiness group at `/actuator/health/readiness` → HAProxy check | round-robin entry backend membership | V-S15/V-E6 |
| secrets and diagnostics | AGENTS observability and redaction | run-scoped logs keyed by runId/safe device alias | reviewer/test log scans | V-E1/V-T18 |

## 8 · 需求规则 → owner 判定点

| 规则 | 判定点 |
|---|---|
| R-9.2 activate/cancel/offline cancel/connect/disconnect are commands | terminal-data-client command registry/actor dispatcher |
| R-9.2 already active/absent identity gates | terminal-data-client actor before network calls |
| R-9.3 credential and safe binding references persist securely | terminal-data-client state persistence descriptor |
| R-9.4 connection/session/node/close reason/RTT samples ephemeral; 2-hour/count bound | terminal-data-client latency reducer/selector |
| R-9.5 HTTP/WS/random injected, no network in foundations | command actor dependency injection + Node composition |
| R-9.6 cancel stops retry; reset; appControl only after successful reset; server-config preserved exactly | cancellation actor + state reset descriptors |
| R-9.7 strategy owner vs transport mechanism | profile parameters passed from terminal-data-client to transport command |
| R-10.1 HTTP delivery certainty/error/retry classification | generated executor result type + transport HTTP actor |
| R-10.2 config at request/connection start; active socket remains | injected versioned config snapshot and transport actor |
| R-10.3 infinite backoff/address preference | transport actor; preferred only on SESSION_READY |
| R-10.4 network transition boundary | DevicePort optional capability and transport bridge |
| R-10.5 Node client PMD support | injected Undici 8.11.2 adapter; no TER code compression |
| R-11.2～11.5 defaults/overrides/commands/selectors | server-config owner |
| R-11.6 config changes notify but do not force reconnect | server-config revision only; no disconnect command |
| R-11.7 no network probes in server-config | no request/health methods in owner API |
| R-11.8 reset preserves config & proxy password | server-config retention descriptor and V-T8 |
| R-11.9 per-service HTTP proxy | snapshot->Undici adapter; direct services remain direct |
| R-15 terminal face generated exactly once into owner package | terminal generation policy and generated artifact checker |
| R-15.7 unknown HTTP fields ignored only terminal face; generated response tolerates unknown | two terminal request schema policy + edge-codegen; known fields/duplicates/malformed JSON remain strict; operations-admin remains strict | V-B15 real HTTP + generated DTO focused tests + `openapi-contracts` |
| R-4.5/R-7.1 node ID/readiness/drain | TDS properties, lifecycle, Actuator |
| R-12 governance/skeleton/dependency closure | CP-01 finite gate delta and decision amendment plan |
| D-51 large business data via HTTP, WS small notifications | no large payload channel added |

## 9 · Owner API 与消费者

| Owner API | 精确消费者 |
|---|---|
| server-config `selectEnvironment` command | future admin console assembly; current focused/DEV harness |
| server-config `setServerOverride` command | future admin console assembly; current owner tests |
| server-config `clearServerOverride` command | future admin console assembly; current owner tests |
| server-config `restoreServerDefaults` command | future admin console assembly; current owner tests |
| server-config public selectors (masked) | future admin console and `terminal-data-client` assembly boundary |
| server-config `resolveNetworkSnapshot(serverName)` internal adapter API | application/test composition that constructs transport HTTP/WS profile |
| terminal-data-client `activateTerminal` command | injected Node test and DEV client |
| terminal-data-client online/offline cancellation commands | injected Node test and DEV client |
| terminal-data-client `connectTerminal` / `disconnectTerminal` commands | package tests, DEV client, future application assembly |
| terminal-data-client selectors `selectActivationState`, `selectConnectionState`, `selectConnectionLatency` | focused tests, DEV harness; future application integration |
| transport mechanism commands/actors | terminal-data-client profile integration; tests |
| DevicePort network methods | transport bridge; default, Android unavailable, Web unavailable adapters |
| generated terminal client factory | terminal-data-client activation and device cancellation actors only |
| TDS Actuator `health` (base `/actuator/health`) | readiness group `/actuator/health/readiness`; HAProxy active check and V-S15 HTTP observer; no user client |
| managed TDS per-node controls | `scripts/dev/r5-dev-runner.mjs` and its exact-identity tests |
| Node DEV acceptance entry | `scripts/test/terminal-client-dev-acceptance.mjs` from the run manifest only |

**Dexter command/selector验收**：每个上述生命周期 command 都有一个 actor-dispatch assertion、至少一个 state/result assertion、一个对应拒绝/失败 assertion；三个 named selector 分别有从实际 command/`SESSION_READY`/`PONG` action 输入到 selector 读回的 focused test。只有 reducer、command name 或 selector 函数存在不算通过。

## 9a · 全链同步清单

| 变更事实 | 声明源/生成物 | owner/assembly | 验证 |
|---|---|---|---|
| terminal HTTP outputs to TER | edge catalog/OpenAPI → new `contracts/policy/terminal-client-generation.json` → `terminal-data-client/src/generated/terminalApi.ts` | generator + terminal-data-client | positive exact 2; all V-T15 red fixtures; generated drift check |
| terminal unknown HTTP fields | R-15.7 + only the two terminal request schemas and edge-codegen | generated terminal DTOs ignore unknown subtrees while known fields, duplicate members and malformed JSON stay strict; operations-admin DTO remains strict | V-B15 real HTTP + focused edge-codegen test + `openapi-contracts` |
| server-config retained fields | contracts TransportServerConfig + owner slice descriptor | `server-config` + `kernel.base.state` reset policy | V-T1/V-T8/restart/protected-storage reads |
| service address+proxy revision | server-config full override command | HTTP/WebSocket transport snapshot | V-T2/V-T3/V-T18 |
| terminal local identity and cancellation | R-9.3/R-9.6 secure state | terminal-data-client command actor | V-T4/V-T8/V-E1/V-E5 |
| connection state and latency selectors | R-9.4/R-10.3 | terminal-data-client slice/selector | V-T4/V-T5/V-T6/V-T7 |
| network state capability | R-10.4 | platform ports + default/Android/Web adapters + transport bridge | V-T14/V-T16/V-T17 |
| node IDs/readiness/lifecycle order | R-4.5/R-7.1/R-16.2 | TDS properties/settings/lifecycle/Actuator | V-S15/V-E6 |
| three nodes/two entry topology | R-13/D-44/D-45/D-50 | remote runner + local tunnel + HAProxy config + manifest | V-E6 exact routing, graceful removal, crash failover, cleanup |
| secret diagnostic boundary | AGENTS observability + R-4/R-11.9 | state logs, transport logs, Node/TDS/HAProxy runner |陽性 marker first, then credential+secret+activation code+proxy password searches |
| governance and graph | R-12/D-44/D-45 | accepted service-shape amendment + anchors listed in CP-01 + graph manifests | query ledger, all gate red fixtures, `NO_MQ_OUTBOX_TDP` unchanged |

实施前在 CP-01 依据 owning source 重跑每条检索、重算结果全集、逐条把命中映射到 entry/mode/red fixture 或带反例的 N/A；本表是范围同步清单，不宣称搜索或门已经运行。

## 9b · 变更定位

实施目标文件（计划内，未在本回合修改）：

- **contracts/生成**：`apps/terminal/kernel/base/contracts/src/types/transport.ts`、`contracts/policy/terminal-client-generation.json`、`apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`。
- **TER owner**：`apps/terminal/kernel/base/server-config/{package.json,README.md,src/**,test/**}`；`apps/terminal/kernel/base/terminal-data-client/{package.json,README.md,src/**,test/**}`；`apps/terminal/kernel/base/transport/{README.md,terminal-invariants.json,src/**,test/**}`；`apps/terminal/kernel/base/platform-ports/{README.md,terminal-invariants.json,src/**,test/**}`；`apps/terminal/skeleton-graph.ts`、`apps/terminal/package.json`。
- **TDS**：`apps/backend/terminal-data-server/build.gradle.kts`、`src/main/resources/application.yml`、TdsRuntimeProperties/Settings/config、`TdsGracefulShutdownLifecycle` 与 lifecycle/config tests。
- **runner/test**：`scripts/dev/r5-dev-runner.mjs`、相关 identity/readiness/tunnel tests、`scripts/test/terminal-client-dev-acceptance.mjs`、相关 structure/focused tests、`tools/verify-gates/verify.mjs` 静态入口/耗时声明。
- **governance**：仅 CP-01 implementation 按 R-12 anchor-local 清单同步。需求与门店终端正本不得修改。任何设计范围之外路径被搜索命中时，先分类后按授权/decision，不自行扩展。

`terminal-data-client` 不直接依赖 `server-config`；assembly 将其 snapshot API 注入 transport profile。transport 不依赖 terminal owner。这是有意保持的单向边界。

## 10 · 数据迁移、持久化与故障边界

### 10.1 业务数据库

无 PostgreSQL schema/Flyway/Doris 变更，无新后端 operation、数据库 owner、seed identity 或 TDP/MQ/outbox。TDS 三个进程仍用同一个已配置 PostgreSQL 与原有 LISTEN/NOTIFY；节点 ID 仅为连接/最新状态记录事实，不建立跨节点 session state 或 Doris 历史。

### 10.2 TER storage

- 新 `server-config` state 首次 hydrate 缺失时使用装配 defaults；只保存环境选择、服务 override 非敏感字段与 proxy auth secret 的 protected field。defaults 可随新版本变化，不写入用户 KV。
- `terminal-data-client` 只将 groupWorkspaceKey、terminalRef、storeRef、安全凭证写入 protected persistence；不储存设备名/类型。每次 session connection/node/close state/RTT 均为 memory-only。
- local cancel：关闭重连入口；清除所有 `clear` owner persisted keys；保留 `server-config` owner persisted keys；未知 orphan keys删除；清理成功后 reset runtime。任一存储失败不 reset JS runtime，状态和失败可见。再次调用必须无副作用，server-config 指令在失败后照常可执行。
- 防泄漏反例按 marker-first 流程搜索 Node run log、TDS logs 与测试报告；搜索 activation code、设备凭证及秘密部分 Base64URL/standard Base64/hex、代理密码/代理授权。不得把 Hash 加入日志。

### 10.3 治理状态闭集

无新的业务实体、状态枚举、审计操作者或 error code。新增 TER package invariant 明列 allowed package exports/commands/selectors/ports、generated only folder 与 dependency edges；骨架图以 actual package directories 及 manifests 对账，不写死总 node count。

## 10b · seed 与执行前提

### 10b.1 本批 seed 范围

业务 fixture 输入沿用 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json#stableFixtures.organization.storeTerminals`（现有 8 个终端与 activation code）及其所属 workspace/store/account fixture；不修改其内容/分母、不增加端凭证身份、不把 TDS 节点状态塞入 seed。

### 10b.2 两类改动

- 新功能 seed：N/A；已有 business fixture 已覆盖终端/门店/空间，批次二只用真实 HTTP 激活与真实设备侧命令，不增加持久事实。
- 旧 seed 变非法：N/A；不改 operation/schema/business policy 或 fixture shape。

### 10b.3 覆盖判据

实施 static fixture test 对当前 8 条 stable terminal fixtures 与 activation code uniqueness 原样通过；双端 Node runtime 随场景从该输入按 safe key 选 1 或 4 条；报告只输出不敏感 `terminalRef` suffix/run alias。不能把 fixture secret 打进 stdout、manifest、websocket dump、artifact 名称或 log。

### 10b.4 同步项

有新业务 fixture 才同步 fixture contract、owner seed executor、expected counts、seed report与contract tests；本批没有这些改动。

### 10b.5 边界

DEV start/restart 绝不 seed。reset/seed 是独立受管 run；按动态整体准入四项 PASS 后才执行。node client runtime 不将 fixture key复制进 terminal secure store之外的位置。

### 10b.6 执行前提、父流程与角色

未来实施由 main agent 自主执行 CP；fresh reviewer 只读。完整 seed 对当前 byte 试运行 PASS 是第一次受管 DEV `reset`/`seed`/L2 前置条件。`backend-acceptance` 的 V-S15 按规范仅建立它自己的 Testcontainers lifecycle；DEV 场景用现有受管 DEV reset/seed，不让 Node 脚本直接写数据库。每次 TDS/HAProxy/Node process 都必须由 manifest 注册，启动前资源预算/identity 预检、run-scoped 日志、逐项 cleanup。

## 11 · 验收场景设计

包级 `V-T` 是 Node/TER tests，假服务端为 in-process/loopback 并注入 clock/random/storage/DevicePort；不连 DEV。业务后端/TDS 语义只由真实 HTTP/WebSocket 的 acceptance/DEV 场景证明。每项结果进入自己的 evidence channel；契约和业务结果、DB_OPERATIONS 与 cleanup 分开报告。

### 11a · 判据 → 场景 ID → 执行档位

| 判据 | Scenario id 与主要断言 | 执行档位/输出 |
|---|---|---|
| V-B15 | acceptance scenario `storeTerminalActivationUnknownFields`：terminal `activateTerminal` 和 device `cancelTerminalActivation` 的真实 HTTP body 各带 unknown array/nested/1KiB string，业务结果与 known-field baseline 相同；known-field invalid 仍拒；operations-admin 的负例仍拒。`module.operation` 是验收场景选择键，不是 route、OpenAPI `operationId` 或 generated-operation budget identity。 | `backend-acceptance --operation storeTerminalActivationUnknownFields`;真实请求形状入 CONTRACT，业务 readback/审计/凭证结果入 BUSINESS，`DB_OPERATIONS` 信息项单报；cleanup 单报 |
| V-S15 | `terminal.connection.vs15.readiness-withdrawal-and-drain`：真实 TDS/HTTP/WS，nodeId 与 DB readback 一致；readiness 从 UP 变为非 UP（HTTP 不再为 200，不硬编码健康 JSON 的状态名），4 秒摘除等待期间旧连接 PING/PONG 正常且窗口内可登记新 session；wait 后拒新，再在 10 秒内 redirect 关闭全部 active/等待期 session。`terminal.connection.vs15.bad-order-red` 仅为 focused lifecycle regression：将拒新移到 wait 前必须 FAIL。 | closed CLI `--tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain` 与单个现有业务场景 + topology preflight；V-S15 为唯一 TDS CONTRACT 场景、选定场景为唯一 BUSINESS 场景；topology preflight 使用独立通道，不计入场景分母；cleanup 单报 |
| V-T1 | `terminal.server-config.commands-and-selectors`; `terminal.server-config.address-identity-stays-with-address`; `terminal.server-config.invalid-overrides`; `terminal.server-config.restart-hydration` | `terminal-verify` focused owner tests |
| V-T2 | `terminal.server-config.change-notification-no-reconnect`; `terminal.transport.next-request-new-revision`; `terminal.transport.active-socket-remains` | package tests + fake network server |
| V-T3 | `terminal.transport.http.retry-by-delivery-class`; `terminal.transport.http.known-business-error-stops`; `terminal.transport.http.unknown-code-stops`; `terminal.transport.http.max-timeout-and-final-error` | transport Node focused tests |
| V-T4 | `terminal.client.activate-secure-and-connect-after-restart`; `terminal.client.activation-state-selector`; `terminal.client.connect-requires-identity` | owner storage/restart tests; selector tested from command actions |
| V-T5 | `terminal.client.latency-two-hour-boundary`; `terminal.client.latency-cap-by-heartbeat-interval`; `terminal.client.latency-retained-over-reconnect` | controlled clock/sample test |
| V-T6 | `terminal.client.server-heartbeat-settings`; `terminal.client.unknown-session-ready-fields`; `terminal.client.unknown-pong-fields` | Node fake server + protocol contract fixtures |
| V-T7 | `terminal.transport.first-attempt-immediate`; `terminal.transport.linear-backoff-and-jitter`; `terminal.transport.unbounded-1000-failures`; `terminal.transport.rotation-no-ready`; `terminal.transport.redirect-keeps-preferred`; `terminal.transport.explicit-connect-disconnect`; `terminal.client.close-reason-reactions` | controlled clock/random, actor command tests |
| V-T8 | `terminal.state.cancel-clears-nonconfig`; `terminal.state.server-config-retained`; `terminal.state.reset-once-race`; `terminal.state.partial-reset-preserves-config`; `terminal.state.orphan-key-cleared`; `terminal.state.reset-failure-does-not-restart-js` | full state runtime focused tests; current-state after restart and both retention red fixtures |
| V-T9 | `terminal.client.device-id-unavailable-no-request` | fake DevicePort command test |
| V-T10 | mapped to V-E5 | no duplicated test |
| V-T11 | `terminal.client.online-cancel-transport-failure-retains-identity`; `terminal.client.online-cancel-business-rejection-retains-identity` | injected HTTP executor tests |
| V-T12 | `terminal.client.environment-switch-recommended`; `terminal.client.environment-switch-fallback-retains-identity` | two config spaces + fake WS backend; server-side proof remains V-E5 |
| V-T13 | `terminal.client.activation-command-retry-secret-stable`; `terminal.client.activation-late-response-once`; `terminal.client.activation-expired-new-secret`; `terminal.client.activation-random-source-unavailable` | same fake executor captures request secrets in memory only; assertions never print them |
| V-T14 | `terminal.transport.network.seed-dedupe`; `terminal.transport.network.first-notification-seed`; `terminal.transport.network.recover-12s`; `terminal.transport.network.recover-4s`; `terminal.transport.network.recover-during-attempt`; `terminal.transport.network.flap-2m`; `terminal.transport.network.disabled`; `terminal.transport.network-through-actor` | DevicePort fake + controlled clock; assert only commands and attempt timestamps |
| V-T15 | `terminal.generator.operation-closure`; `terminal.generator.descriptor-and-executor`; `terminal.generator.response-validation`; `terminal.generator.unknown-fields`; `terminal.generator.output-no-imports`; `terminal.generator.admin-output-byte-stable`; `terminal.generator.red-zero-duplicate-wrong-face-selector-drift` | generator unit/structure tests + `openapi-contracts` static verify |
| V-T16 | `terminal.platform-ports.network-unavailable-default`; `terminal.platform-ports.network-unavailable-android`; `terminal.platform-ports.network-unavailable-web`; `terminal.platform-ports.network-capability-declarations` | focused port/adapter capability tests; assert no native calls |
| V-T17 | `terminal.integration.expo-web-platform-ports-smoke` | existing Expo Web `sample-console` smoke; visual/status assertion; no L2 |
| V-T18 | `terminal.proxy.no-proxy-direct`; `terminal.proxy.service-isolation`; `terminal.proxy.auth-success-failure`; `terminal.proxy.address-failover`; `terminal.proxy.config-change-keeps-socket`; `terminal.proxy.mask-and-no-leak`; `terminal.proxy.retained-on-cancel` | injected Undici local fake proxy tests + V-T8 persisted value assertion |
| V-E1 | `terminal.dev.lifecycle-and-compression` | managed DEV; real backend HTTP+TDS WS; activate→3 PINGs/latest read→backend cancel→local cancel→same code reactivation→online device cancel; negotiate PMD; CONTRACT/business/cleanup separate |
| V-E2 | `terminal.dev.entry-address-failover` | managed DEV; HTTP blackhole first TDS entry, entry2 succeeds ≤20s, preferred thereafter |
| V-E5 | `terminal.dev.two-device-rebind` | managed DEV real HTTP; client A offline, backend cancel, B same code activates/connects, A recovers and self-cancels, B remains online |
| V-E6 | `terminal.dev.three-node-two-entry-handoff` | managed DEV real HAProxy + 3 TDS + 4 logical clients; graceful A→B, kill B→C via entry2, cancel one, restart A/B no failback; node/latest/session cross-check after each stage |
| V-G1 batch2 | `terminal.gates.skeleton-two-packages`; `terminal.gates.platform-network-port`; `terminal.gates.terminal-package-invariants`; `terminal.gates.generator-red-closure`; `terminal.gates.tds-readiness-and-config` | every new static checker/red fixture tied to `terminal-verify` or `openapi-contracts` in stated verify mode; report entry time |

场景 ID 是实施目标名，不是本回合已新增/已运行的场景。实施时逐条对照需求完整子项，任何子项不能被“场景存在”替代；尤其 V-T7 的每一种 R-4.6 reason、V-T8 每条 failure path、V-T18 双向服务隔离与 V-E6 四阶段在各自 scenario body 内逐项断言。

## 12 · 未决项与 R-12 门台账

没有等待 Dexter 的产品问题。implementation-time registry digest/依赖解析与真实远端 host resource preflight 是可验证的实施输入，不是未决产品语义；超过 host 已批准资源边界就按 AGENTS 硬约束受控阻断，不降级成同 JVM/本机 Java/节点直连。

### 12.1 批次二适用检索与当前可复现命中

以下命令在 implementation CP-01 开始时需对当前字节重跑，输出按字典排序；详设内的命中是已核仓内现行规则/文件，不是门执行证据：

```sh
rg -l 'must contain 29 nodes|29 nodes' tools/terminal-skeleton | sort -u
rg -l 'platform-ports|platformPortsRoot|@catering-v2s/kernel-base-platform-ports' tools/terminal-platform-ports tools/terminal-ui-state apps/terminal/kernel/base/platform-ports apps/terminal/kernel/base/transport | sort -u
rg -n 'terminal-data-server|TDP|tdp|ONE_BUSINESS_DEPLOYABLE|single-node TDS|multi-node coordination' AGENTS.md PLATFORM-BLUEPRINT.md doc/platform scripts project-memory doc/decisions -g '*.md' -g '*.json' -g '*.mjs' -g '*.java' -g '*.kts'
rg -n 'terminal|operationId|x-consumer-faces' doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json contracts/openapi/paths/terminal/activation.paths.json
rg -n 'V2S_TDS_|node-id|withdrawal|readiness' apps/backend/terminal-data-server scripts/dev scripts/env tools/verify-gates
```

现行 Q14 的已知完整结果（来源为批次一详设 §12.1 Q14；CP-01 必须复跑确认，不把历史输出当 current gate proof）：

```text
tools/terminal-skeleton/check-static.mjs
tools/terminal-skeleton/check-static.test.mjs
apps/terminal/kernel/base/platform-ports/README.md
apps/terminal/kernel/base/platform-ports/package.json
apps/terminal/kernel/base/platform-ports/src/defaults/logger.ts
apps/terminal/kernel/base/platform-ports/src/defaults/processMemoryStorage.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailableConnector.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailableHotUpdate.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailableLogUpload.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailablePersistSecure.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailableScript.ts
apps/terminal/kernel/base/platform-ports/src/defaults/unavailableTopologyHost.ts
apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts
apps/terminal/kernel/base/platform-ports/src/moduleName.ts
apps/terminal/kernel/base/platform-ports/terminal-invariants.json
apps/terminal/kernel/base/platform-ports/test/defaultPorts.test.ts
apps/terminal/kernel/base/platform-ports/test/logger.test.ts
apps/terminal/kernel/base/platform-ports/test/platformPorts.test.ts
apps/terminal/kernel/base/platform-ports/test/public-surface.typecheck.ts
apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts
apps/terminal/kernel/base/platform-ports/test/successSemantics.test.ts
apps/terminal/kernel/base/transport/README.md
apps/terminal/kernel/base/transport/package.json
apps/terminal/kernel/base/transport/src/dependencies.ts
tools/terminal-platform-ports/check-static.mjs
tools/terminal-platform-ports/check-static.test.mjs
tools/terminal-ui-state/check-behavior.mjs
tools/terminal-ui-state/check-static.mjs
tools/terminal-ui-state/check-static.test.mjs
```

### 12.2 Hit-to-gate disposition

| Search family / entry | Batch2 treatment | Verify mode | Red fixture / boundary |
|---|---|---|---|
| 29-node literal (`tools/terminal-skeleton/check-static.mjs`, its test) | Replace count literal with exact graph↔package-directory/manifest reconciliation; add server-config + terminal-data-client nodes/edges, expect neither hardcoded 29 nor 31 | `terminal-verify` static | delete each node while package exists; add node with absent package; replace dependency with cycle; each marker non-zero |
| platform-ports search set above | Add network read/subscribe/unsubscribe to interface, default unavailable, descriptor and public type surface; Android/Web unavailable stubs no native access | `terminal-platform-ports` checker/test via `terminal-verify` | omit each capability descriptor/method or make default available; marker-specific failure |
| transport hits (`README.md`,`package.json`,`src/dependencies.ts`) | README/dependency graph describe mechanism owner and disallow server-config/terminal-data-client imports; no new runtime deps | `terminal-verify` static | add forbidden edge or direct server-config import; package invariant fails |
| terminal owner package invariants | New package READMEs/moduleName, package manifests, public exports and graph exact | `terminal-verify` static | new package without README/moduleName; undeclared export; invalid package edge |
| existing terminal face/operation metadata | Keep exact existing 2 operations and request/security/error behavior; new policy maps them once | `openapi-contracts` in `--validate-only` and default static | remove/duplicate/retarget operation assignment; wrong tag/face; empty selector; drift |
| generator new config/input paths | repo-contained JSON policy only; data path guard re-used from D-41 generator closure | `openapi-contracts` static; Node suite already in `THCL-04-node-tests` | `../`/absolute/symlink escape in policy; explicit outside-root marker |
| TDS environment and property闭集 | 2 new TDS inputs (`V2S_TDS_NODE_ID`, optional `V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS`) added to inventory and exact static count; wait defaults to 3,000ms; no convenience aliases silently counted | TDS config tests + verify static runtime-key gate | missing key inventory, duplicate count, invalid/out-of-bound override, duplicate node IDs |
| service shape/service decision/R-12 anchors | anchor-local amendment; keep no MQ/TDP/outbox, one business deployable, one DB/Flyway, seed `tdp=FORBIDDEN`; server-config state exception exactly D-16 | project-memory + decision checks | deleting `NO_MQ_OUTBOX_TDP`, removing TDP forbidden seed, broad whole-file supersede, old batch assignment still active |
| UI/L2/testId policies | no action surface changed; sample-console displays only read-only capability rows | V-T17 Expo Web only; `§3a=N/A` | N/A boundary: no new click/fill/select/testId/control node. If implementation adds action/control, stop and re-scope before writing UI/L2. |
| TDS runtime classpath/gate | no org `store-terminal` or Doris/TDP dependency; Actuator only new direct runtime dependency | Gradle dependency report/static classpath check and TDS tests | add forbidden module, Flyway, DB migration or object storage; classpath red fixture |

Q1–Q13 and Q15–Q16 from batch one remain query sources, not waived. CP-01 replays applicable rows from batch1 §12.2 and current source, adds hits under new TER packages, Actuator and HAProxy runner, then records every current hit to one exact command/mode/red marker or `NOT_APPLICABLE_WITH_REASON`. No prior result substitutes for this current-byte ledger.

## 13 · 停机条件与执行纪律

- **本回合**：只写此详设/计划。不得改源码、requirements、decision、lockfile、scripts、seed、L2 或 run state，不运行门/编译/test/服务。
- **未来 implementation**：遇到需要改需求产品语义、D-45 入口模型或超出批准资源上限；host/SSH/registry/Docker 不可达；某 TDS/HAProxy identity 不可证明；要用节点直连、本机 Java、PG tunnel、同 JVM TDS 替代已批准拓扑等实质偏离，停止该下一步并精确报告 Dexter。普通测试失败不是整体停止理由。
- 第 2 次相同 `failureCategory` 出现时只冻结该失败族之后的场景，日志/owning source 根因修复，用同一 focused proof 关到零复发继续；失败首例保留；相关字节未改不重跑，不准提高 timeout/换场景伪通过。
- managed 资源预检/identity遵循 AGENTS：本机 PID + start token；远端 host/boot id/start ticks；container ID + digest/runId/config hash。未知 process/container 不 stop。运行时输出有 runId、phase、owned identities、logPath 和清理状态；实际读取日志，business 与 cleanup 分开。
- 不改需求正本、门店终端正本或 accepted requirement。实现中确需改需求，先由 Dexter 转 Claude 改并重新准入。
- Android/Expo Web 实际代理或 PMD app 集成、Doris、跨节点 takeover 属于禁止的后续范围；代码看似相似也不扩批。

## 13b · 实施节奏与三维对账

CP-01..CP-06 为完整阶段单位。每个完整 CP 的改动与 focused proof 完成后、下一 CP 前由 fresh reviewer 逐条核对需求、详设/IA、项目记忆规范，结果必须 `MATCHED`。不因 CP 内改一行另设门，也不延迟完整 CP 对账。全部 CP 完成、整体测试开始前由 fresh reviewer 重做全批 6b；`OPEN` 必须先修并复核 MATCHED。CP01/overall reviewers 不接收作者结论作替代。

本批无新 screen/IA/action/交互工件；`N/A` 不是 UI 或功能闭环证据。

## 13c · 逐代码与详设对账

实施计划在 CP-06 交付前设 fresh 子 agent 做逐文件/逐生产符号对账：每个生产类型/方法有真实 caller 或具名外部入口；每个 generated file 有唯一 producer；每个 producer 有具名 generated output；node graph edges 与本稿一致；不存在零调用者的新命令/selector；每条详设约束落实到相应源码与 test scenario。结果只能 `MATCHED` 或 `OPEN`；任何 OPEN 未关闭不进入实现后 review。

## 14 · 模板覆盖自查

| 模板节 | 状态 | 本稿落点/理由 |
|---|---|---|
| §0 授权与来源 | PRESENT | 元数据与 §0；当前只获准设计和计划 |
| §1 问题、方案比较 | PRESENT | §1.1～1.3 |
| §2 CP | PRESENT | §2 |
| §3 横切机制与第三方依据 | PRESENT | §3、§3.1 |
| §3a L2 | N/A + 理由 | 无可操作控件/L2，见 §3a；保留 V-T17 |
| §4 每 CP 门 | PRESENT | §4 CP-01～06 |
| §5 operation/path/face/规模 | PRESENT | §5 两个现有 operation |
| §6 跨 owner 写 | N/A + 理由 | 无 Java owner writes，见 §6 |
| §7 传递矩阵 | PRESENT | §7 |
| §8 业务事实→owner | PRESENT | §8 |
| §9 owner API/消费者 | PRESENT | §9，Dexter 明确三 selectors/command tests |
| §9a 全链同步 | PRESENT | §9a |
| §9b 变更定位 | PRESENT | §9b |
| §10 migration/state | PRESENT | 无 DB migration；TER reset/persistence 在 §10 |
| §10b seed | PRESENT | 新/旧 seed 均 N/A，写明唯一既有 fixture范围、角色与准入 |
| §11/11a 验收与逐条映射 | PRESENT | §11、§11a 覆盖所有本批 V 条目 |
| §12 未决项/门台账 | PRESENT | 当前无产品待裁决；§12 查询/命中映射并注明重跑要求 |
| §13/13b/13c 执行纪律与交付对账 | PRESENT | §13、§13b、§13c |
| §14 自查 | PRESENT | 本表每项有状态/理由 |
