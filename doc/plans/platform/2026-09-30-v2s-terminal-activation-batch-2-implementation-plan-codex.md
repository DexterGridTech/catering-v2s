# 终端激活与长连接 · 批次二实施计划

```text
DOC_KIND=IMPLEMENTATION_PLAN
DESIGN=doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md
SERVICE_SHAPE=doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md
AUTHORIZED=DEXTER_BATCH_2_DESIGN_AND_IMPLEMENTATION_PLAN_ONLY
NOT_AUTHORIZED_NOW=source_implementation; dependency_or_lockfile_changes; generation; build; test; managed_runtime; DEV; reset; seed; L2; UAT; deployment; batch_3
IMPLEMENTATION_AUTHORITY=false
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-DESIGN-2026-09-30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
REVIEW_STATUS=AUTHOR_REVISED_PENDING_FRESH_INDEPENDENT_REVIEW
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION
```

## 0 · 任务与授权

### 0.1 真实任务与本阶段意图

业务目标是让 TER 使用需求已定的 terminal credential HTTP 接口激活/取消激活，按配置的服务地址与代理建立 WebSocket，并能查询激活、连接、时延状态；同时令 DEV 的三个单节点 TDS 在两个可健康摘除的入口后接受连接，并在退役节点时先从新连接选择中移除再 drain。批次二的实施设计和计划由本任务定义；当前授权只覆盖两份文档及其 `REVIEW_TARGET=DESIGN` 独立盲审，不覆盖任何代码、依赖、生成、编译、测试或运行。

Dexter 的阶段意图是一次性形成可审查的完整批次二实施输入，尽量用已存在的 owner、state、transport、Undici、Actuator 和受管 runner，避免实施期临时发明连接器、第二凭证库、探针或代理服务。UI 交互不是本批目标，因此不新建 Journey、IA、交互稿或 L2 控件。

### 0.2 可行方案与选择理由

可行方案包括：把配置与重试并入现有 transport、TER client 自写网络/代理栈、Node 内置 WebSocket 加另一个 HTTP 客户端、单个 TDS 入口后直连节点，或采用详设 §1.2 的独立 `server-config` owner、transport command/actor、终端 owner command/selector、固定 Undici 和两个 HAProxy 入口。推荐最后一种：它沿用仓内配置/状态/transport 主权与 R-10.3 边界，不再造 proxy/WebSocket 协议，并能在 DEV 里用真实连接证据观察节点摘除。当前没有待 Dexter 裁决的产品语义；实现期未能证明依赖版本、拓扑、资源身份或配置界限时按下文停在该具体步骤，不猜 API、不降档。

### 0.3 阶段权限

本计划描述未来批次二实施的 CP、焦点证明和动态验收，不是其实施授权。不得在本设计/计划任务中修改任何非本文件；需求与 decision 继续由其正本维护者维护。未来实施的授权仍以 Dexter 明确指派及批准本计划为准。批次三的 Doris、跨节点会话取代、topic 同步均不在本计划内。

## 1 · 批次边界与交付物

完整范围、owner、精确行为、失败边界和场景期望以详设为正本；本计划只把它排成可执行阶段。批次原子交付，CP 是阶段级内部对账单位，不是分批验收或单独交付。

### 1.1 本批交付

| 范围 | 实施输出 | 主要 owning source |
|---|---|---|
| 生成 terminal HTTP client | terminal face+tag policy、生成器闭包/门、`terminalApi.ts` | `contracts/policy`、edge codegen、`apps/terminal/kernel/base/terminal-data-client` |
| `server-config` | package、命令、脱敏 selectors、持久化、全量显式 override、代理安全信息、默认配置与 reset retain | `apps/terminal/kernel/base/server-config`、`kernel/base/state`、现有 `TransportServerConfig` |
| `terminal-data-client` 与 transport | 命令→actor 生命周期、生成 operation 调用、持久身份、3 selectors、重连/切址、network DevicePort bridge | `kernel/base/terminal-data-client`、`kernel/base/transport`、`kernel/base/platform-ports` |
| TDS readiness/node identity | `nodeId` 配置、Actuator readiness、readiness 先行撤出、3 秒流量转移等待及现有 10 秒 drain | `apps/backend/terminal-data-server` |
| DEV 联调 | 3 个隔离 TDS、2 个 loopback HAProxy 入口、Undici 注入 client、run manifest/tunnel/cleanup | `scripts/dev/r5-dev-runner.mjs`、`scripts/test/terminal-client-dev-acceptance.mjs` |
| 批次验收 | 所有 V-B/V-S/V-T/V-E/V-G 对应 focused/真实运行证据、清理、13c、整批 IMPLEMENTATION review handoff | `doc/review/platform`、现有 acceptance/terminal gates |

### 1.2 禁止范围

不实现 Doris、TDP、MQ/outbox、跨 TDS session 迁移、topic 数据同步、大型业务消息 WebSocket、TER 页面或 L2 action、不替 Android/Expo Web 接入真实 WebSocket/代理、不做生产发布/UAT/物理设备操作、不改需求正本或门店终端正本。R-10.5 本批只证明注入式 Node client 的 PMD 协商与解压；以后 runtime 接 App 再验证各自平台。

## 2 · 阶段总览与依赖

| 顺序 | CP | 阶段出口 | 下阶段前必备证据 |
|---:|---|---|---|
| 1 | CP-01 生成链与治理闭包 | 当前两个 operation 精确分配到 TER owner；门闭包与 anchor-local 同步清单闭合 | focused codegen/静态门；fresh 三维 CP-01 `MATCHED` |
| 2 | CP-02 server-config/state retention | 配置 owner、reset retain、秘密遮蔽与默认值完成 | package focused tests；fresh 三维 CP-02 `MATCHED` |
| 3 | CP-03 transport/client/DevicePort | command/actor、selectors、网络桥、代理及调用闭包完成 | package focused tests；fresh 三维 CP-03 `MATCHED` |
| 4 | CP-04 TDS health/node/shutdown | Actuator 健康闭集、nodeId、摘除等待时序完成 | TDS focused tests；fresh 三维 CP-04 `MATCHED` |
| 5 | CP-05 managed 3-node/2-entry harness | runner、HAProxy、tunnel、独立 Node client 与 manifest 能准确控制/清理 | runner local guard tests；fresh 三维 CP-05 `MATCHED` |
| 6 | CP-06 acceptance 与收口 | 全部映射判据、整体对账、13c、独立整批 review 请求完整 | CP-06 三维 `MATCHED`；再执行 6b、动态、13c、IMPLEMENTATION review |

CP 内每个实际变更点按实施模板做需求/记忆/owning source 写前重读与 focused proof；只有完整 CP 结束时进入独立三维对账。实施者不能在 CP reviewer `MATCHED` 前进入下一 CP。完成 CP-06 后、第一次整体动态验收前做一次新的全批 6b，不用阶段结论代替。此任务当前只产生本计划和详设，尚无 CP 完成证据。

## 3 · 每阶段实施工单

### CP-01 · 生成链、门闭包与治理同步

**RECALL（进入前重开）**：需求 §1.1、R-12、R-15.1～15.7、R-16、D-44～D-51；service-shape decision §6.1～6.3；批次一详设 §12 Q1～Q16/Q14；批次一详设、R-12 gate ledger；`doc/platform/implementation-task-template.md`；`scripts/README.md`；`tools/verify-gates/verify.mjs`；edge codegen 当前 source/fixtures/tests；`tools/terminal-skeleton` 当前 graph/check/tests；`contracts/openapi/paths/terminal/activation.paths.json`；`THCL-04-node-tests`。运行六维 memory recall 并读取全部命中原文。重新搜索当前字节，不把本计划或 Q14 快照作为当前门输出。

| 项 | 计划 |
|---|---|
| 用哪个现成能力/规范 | 现有 `edge-codegen --check`、`openapi-contracts`、D-41 路径守卫、`THCL-04-node-tests`、TER package manifests、`terminal-skeleton` 的 package graph。两个 HTTP operation 已存在，不创建后端 route/OpenAPI `operationId`；另新增的 V-B15 是 acceptance `module.operation` 场景键，不进入 generated-operation budget。治理同步用 service-shape decision 已接受正文锚点，不整文件取代。 |
| 修改全集 | 新增 `contracts/policy/terminal-client-generation.json`；生成 `apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`（唯一 TER producer）；调整 `contracts/openapi/components/terminal-binding/terminal-binding.schemas.json` 中且仅中 `TerminalActivationRequest`、`TerminalActivationCancellationRequest` 的 unknown-field schema policy，由 `scripts/generate/edge-codegen.mjs` 重生对应两个后端 wire DTO；保持 `OperationsTerminalActivationCancellationRequest` 和全部非 terminal-face DTO 严格拒绝 unknown。更新 generator/checker/focused tests、`scripts/verify` 对应入口；新增 `scripts/test/edge-codegen-terminal-unknown-fields.test.mjs` 并登记至 `THCL-04-node-tests`；TER skeleton graph/check/tests 加两个 package 节点/依赖；按设计 §4 CP-01、§12 命中清单进行 R-12 anchor-local 同步。Journey 第 48、54 行的持久身份表述只登记为来源漂移，不改 Journey 或 accepted decision；CP-01 写入前若该冲突仍存在，先由 Journey owner 修订或交 Dexter 明确裁定，未解决则不进入 CP-01 写入。把 Batch2 详设与计划两路径加入 `contracts/policy/store-terminal-l2-admission.json#controlPlaneFiles`，不改 6 cases、60 controlKeys、40 actionControlKeys 或 UI/fixture/locator；这会让已有 L2 准入记录失效，后续按新字节重做。每条检索命中记录 path、line、entry、verify mode、marker-specific red fixture 或反例支持的 N/A。 |
| 若无现成能力，形态 | 两份 OpenAPI request schema 以 `additionalProperties: true` 明确 R-15.7 的终端兼容性，edge-codegen 按该元数据生成 unknown subtree skip；不加全局 Jackson 容忍开关。必须仍追踪全部 property 名称，以拒绝重复字段；已知字段照原规则校验，malformed/trailing JSON 仍拒绝。运营后台 schema 保持 `additionalProperties: false`。TER policy 仅含仓内相对路径/tag/target；沿 D-41 的 root-containment/symlink fail-closed 方式。terminal face + `terminal-binding` exactly selects 两个既有 operation，各归属一次；TER 生成文件零 import、零 fetch/socket，运行 executor 由 owner 注入。 |
| focused proof | generator positive exact-two closure；zero/duplicate/wrong tag/wrong face/nonterminal target/empty selector/drift/root escape/symlink escape 红例；生成文件移除后 `--check` 报标记；非 terminal frontend generated outputs bytes unchanged；skeleton 漏包、虚构包、forbidden/cyclic edge 各红。edge-codegen positive cases: 两个 terminal request DTO 各自可读 unknown array/nested object/1KiB string; known-field bad type/length, duplicate unknown name, malformed/trailing JSON fail; operations-admin DTO unknown property fails。检查只有指定两个 DTO 生成改变，未手改生成物。`THCL-04-node-tests` 中已有测试不得二次注册。记录 `openapi-contracts` 与默认 verify 各自耗时。 |
| 交付记录与 CP 退出 | policy/生成产物来源关系、当前检索全集与门映射、decision/R-12 anchor-local 清单、focused 输出、实际选择理由。全部命中有处置，门 red mutation 经指定 `scripts/verify` 入口生效；fresh CP-01 三维 `MATCHED`。 |

本批不新增 HTTP route、OpenAPI `operationId` 或 generated-operation budget identity，所以 CP-01 不做全目录预算 calibration，也不改预算上限或投影来配合生成器。V-B15 增加一个 backend-acceptance `module.operation` 场景选择键，不进入 API operation catalog 或 generated-operation budget。先从当前 projection source 确认两个既有 HTTP operation 已包含在正常投影中，TER 生成配置与 API operation denominator 分开断言。若 `--validate-only` 失败，保留首败并从读取它的门及 owning projection/source 查明原因；不得把静态失败写成绿基线、延期到后续 CP 或擅自扩大 API operation 数量。

### CP-02 · `server-config` 与 owner-declared reset retention

**RECALL**：需求 R-9.6、R-11.1～11.9、D-16；TR-09（特别是 state reset exception）；`TransportServerConfig`、现有 defaults 与 `resolveTransportServerAddresses.ts`、`kernel/base/state` slice persistence/reset composition、`platform-ports` `PersistSecurePort` 和同类 secure owner。六维 recall 命中原文逐条读回。

| 项 | 计划 |
|---|---|
| 复用与路径 | 新建 `apps/terminal/kernel/base/server-config/{package.json,README.md,src/**,test/**}`；复用 `TransportServerConfig` / service-name type；使用现有 owner command/selector/state reducer 和 `PersistSecurePort`，state engine 提供 owner 声明的 retain intent；不让 server-config 依赖 transport 或 terminal-data-client。 |
| 命令/selector | `selectEnvironment`、`setServerOverride`、`clearServerOverride`、`restoreServerDefaults` 均由 package command dispatcher/actor 处理。Selectors 返回环境、服务名、address 名称/主机等必要非秘密属性和 `passwordConfigured`；没有 selector 输出密码。override 一次写明服务全部地址/超时/proxy；同服务旧版本的未填字段不能按地址索引继承。 |
| 配置与故障形态 | Defaults 由 composition 注入，不进用户持久 store。Proxy 仅 HTTP；host/port 合法；用户名/密码同存同缺；secret 经 secure persistence；代理无效时整份 command 拒绝且旧配置不变。每服务最大 4 addresses。命令更新增 revision；只通知新 HTTP request / 新 WebSocket attempt，active socket 不关。 |
| 验证观察 | V-T1：初始 defaults、环境选择、selector 脱敏、全量地址身份、非法 override 原子拒绝、重启恢复逐条读回。V-T2：configuration revision 变更后下一 request 使用新设置、existing socket 仍可 ping。V-T8：clear-all state 后只保留该 owner 持久配置，credential state/未知孤儿清除；删除 retain 规则红例，误 retain 第二 owner/red orphan 红例；reset failure 不启动 runtime reset。V-T18 service isolation/password mask 由下一 CP 端到端消费。 |
| CP 退出 | 新 package 静态闭包与 focused tests 完成；TR-09 文案仅细化 D-16 server-config exception；持久值/secure secret/重置状态对账；fresh CP-02 三维 `MATCHED`。 |

现有 state engine 若只能清除命名空间所有键，实施需扩为“owner-declared persistence retention”且由 state owner实现，不允许 server-config 自己绕过 reset，也不允许添加 credential shadow store。`retain` 的实际保留 keys 只能是 server-config 声明的注册 slice；其他 owner 与 orphan 不保留。

### CP-03 · transport、`terminal-data-client` 与网络 port

**RECALL**：需求 R-1.6、R-2.1、R-4.6、R-9.1～R-10.5、R-15、D-37、D-40、D-43；TR-09～TR-16；CP-01 generated client、CP-02 snapshot API；现有 `transport` package owner commands/actor、`DevicePort`/`NetworkStatus`、`resolveTransportServerAddresses.ts`、`AppControlPort`/secure persistence、`kernel/base/runtime` and state reset。第三方 Undici 8.11.2 官方 API/源码按详设 §3.1 当前版本重核并带版本匹配证明。

| 项 | 计划 |
|---|---|
| 依赖与路径 | 扩 `apps/terminal/kernel/base/platform-ports` 增 network read/subscribe/unsubscribe 端口与 unavailable default；扩 `transport` 的机制 command/actor、address failover/retry/network bridge；新建 `kernel/base/terminal-data-client` 保存终端 owner 状态/命令/selector/executor composition。`transport` 不 import 两个 owner；`terminal-data-client` 不 import `server-config`；App/test composition 仅以 snapshot/profile 参数传递配置。更新 skeleton graph 和 package invariants。 |
| 生命周期命令 | `activateTerminal`、online cancel、offline cancel、connect、disconnect 每个通过 `terminal-data-client` command→actor；WebSocket callbacks/PONG/SESSION_READY/close 先 command 再 state mutation。activation command 仅一次生成 secret，operation 重试/换地址相同 command 使用稳定 secret；不同 operation 新 secret。取消激活停止 retry 后 request secure state clear，经 state reset；仅 reset 成功后调 `appControl.resetRuntime`。 |
| 三个 selectors | `selectActivationState`、`selectConnectionState`、`selectConnectionLatency`。对每个 selector 写入从真实 command/SESSION_READY/PONG action 得 state 的测试；同时拒绝分支和 credential redaction。Latency 样本限 2 小时且 `floor(7_200_000 / heartbeatIntervalMs)`；重连保留、JS restart 清空、心跳变化即裁切。单测不得只实例化 selector 或 reducer。 |
| Transport/network | transport actor 持有重连/backoff、address rotation、network bridge 与无限尝试；terminal client 持有 `R-4.6` 对业务状态的 reaction。Bridge 先读 current state，再 subscribe；read error 则首通知 seed；same value dedupe；state transition 仅 dispatch command；unavailable 不装 bridge；stop/dispose unsubscribe。网络触发 attempt 遵守 10s 起点间隔，不 reset n；稳定 ready 一个 heartbeat 周期才 reset n。 |
| 第三方代理/PMD | `apps/terminal` devDependency 和 lockfile 精确 pin standalone `undici@8.11.2`，Node managed runtime pin `22.23.3`（Node 官方 22.23.3 发布说明显示 bundled Undici 6.28.1；应用仍显式使用 standalone 8.11.2）；只用同一个 standalone Undici 的 fetch/WebSocket/ProxyAgent，禁止 global fetch/Node bundled WebSocket 混用；代理使用 `dispatcher`，HTTP request close 资源、WS close lifecycle 清代理 agent；无自写 CONNECT。Node tests 从真实 package request/fetch/WS API 产生 PMD 协商与解压上限证明。 |
| 验证 | V-T3/7/14 transport command/actor timing 和 error delivery；V-T4/5/6/8/9/11/12/13 client persistence/selectors/actions；V-T15 generated descriptor/executor/output and unknown fields; V-T16 default/Android/Web no-network capability; V-T18 HTTP/WS direct/proxy/service isolation/auth/leak/config update; fake clock/random/DevicePort/secure store tests。现有 Node tests 只经 `THCL-04-node-tests` 注册一次。 |
| CP 退出 | package graph/invariant、依赖版本官方依据、全部命令 caller、selectors action-to-readback tests、secret negative search/focused red fixtures 均闭合；fresh CP-03 三维 `MATCHED`。 |

无现成的同步 network availability API 时，按现有 DevicePort 的 read/subscribe/unsubscribe 与 capability result 约定扩展，不加系统监测线程。无现成的 actor action 时按该 package 的 command/actor/reducer 结构实现，不让 callback 成为第二写入口。

### CP-04 · TDS readiness、node identity 与 graceful withdrawal

**RECALL**：需求 R-4.5、R-7.1、R-12、R-13、R-14、R-16.1～16.2、V-S15/V-E6；现有 `TdsRuntimeProperties`、`TdsRuntimeSettings`、`TdsGracefulShutdownLifecycle`、`TdsTerminalSessionActors`、`build.gradle.kts`、`application.yml`、环境 key closed inventory、AGENTS diagnostics/run lifecycle。重核 Boot 4.1.0 official Javadocs 与实际 Gradle resolution。

| 项 | 计划 |
|---|---|
| 配置/依赖 | 增 `spring-boot-starter-actuator` 到 `apps/backend/terminal-data-server/build.gradle.kts`；node ID `V2S_TDS_NODE_ID` 默认 `terminal-data-server`；`V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS` 可选覆盖，application config 默认 3000ms，非法/越界（2000..10000ms）startup fail closed；V-S15用4000ms非默认值；同步 runtime env-key inventory/count与测试。 |
| Health | 只暴露 Boot Actuator `health` endpoint（基路径 `/actuator/health`）；由 `ApplicationAvailability`/`ReadinessStateHealthIndicator` 提供的 readiness group 路径为 `/actuator/health/readiness`，webflux server 同端口；health detail/components=never，readiness group 只 include `readinessState`，无 `db` contributor，不新增管理端口或自建 endpoint。 |
| Lifecycle | phase 在 WebServer graceful shutdown 前；第一动作 publish `REFUSING_TRAFFIC`，listener/admission/session 暂不变；等待 3000ms；期满先 refuse new，再 beginDrain pending unauth admission，然后现有 10s drain，finishDrain close active sessions redirect，最后 callback return 让 WebServer 停止接收。异常也完成 callback但不得报告健康恢复。 |
| 验证 | `backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain`：选定分母恰为一个 BUSINESS 场景 + 一个 TDS CONTRACT 场景；topology preflight 独立记录，不列入场景分母。现有 `BackendAcceptanceTest.terminalConnectionTopologyContractProbe()` 在该组合下不再额外报告 V-S1 CONTRACT 行；其数据库配置-only启动与真实 Node wire probe 必须并入/标记为 `TOPOLOGY_PREFLIGHT` 检查，与 `@BeforeAll` 现有两业务上下文、单独 TDS、解析版本/REACTIVE/度量 sink/DB/run identity、真实 HTTP/WS、10 秒受管停库恢复及清理结果一并先于两个所选场景输出。没有 `--topology-preflight` 时，该 factory 仍报告既有 V-S1 CONTRACT。V-S15 真实读取 `/actuator/health/readiness` 与 SESSION_READY/PING，TDS 用非默认 nodeId、4000ms withdrawal wait，readiness 从 `UP` 转非 `UP` 且 HTTP 非 200（记录实际 health status，不硬编码 `DOWN`），等待期已有 PONG 且新会话可登记、等待后拒新并将活动/等待期会话在现有 10s drain 内 redirect 关闭。bad-order 只由 TDS lifecycle focused test 证明，拒新提前即红。未知 TDS scenario id/错误 operation/缺 topology preflight/calibration 组合，在远端启动前失败。配置默认、非法/越界/nodeId invalid/runner 重复 nodeId 用 unit/runner tests。V-E6另证HAProxy摘流。 |
| CP 退出 | Gradle resolved actuator version 与 Boot 4.1.0 docs记录；静态 key inventory及 focused tests完成；fresh CP-04三维 `MATCHED`。 |

### CP-05 · 受管 DEV 三 TDS/两 HAProxy/注入式 Node client

**RECALL**：需求 R-9.5、R-10.5、R-12、R-13、R-14、R-16、D-44/D-45/D-50、V-E1/E2/E5/E6；AGENTS 受管资源/远程拓扑/Testcontainers/DEV lifecycle；当前 runner/manifest/remote guard/tunnel code；official HAProxy 3.4 docs与registry image metadata；official Undici docs。读取已有 `r5-full` terminal fixtures contract，不变更 seed。

| 项 | 计划 |
|---|---|
| Managed TDS | 扩 `scripts/dev/r5-dev-runner.mjs`，三个独立 TDS processes 共用获准数据库、独有 nodeId `tds-a/b/c`、端口、PID/start ticks/boot id/log/run id/RSS。每个节点与 aggregate budget 独立声明/计量；资源不足或不匹配 fail closed。 |
| HAProxy | 锁 `haproxy:3.4.6` registry digest；生成 run-scoped config SHA-256。两 loopback listener：entry1 round-robin 到 A/B，entry2 仅 C。容器 host networking on remote only；HTTP readiness GET expect 200，check bound ≤2s，TDS wait 3s；WS timeout tunnel 180s。Manifest 收纳 container id+image digest+host/boot/runId+config hash。只有 exact identity 能取日志/stop/remove；tunnel 只穿两个 LB listener。 |
| Node harness | 新 `scripts/test/terminal-client-dev-acceptance.mjs` 接受 run manifest/场景，不解析用户默认 endpoints。通过实际 terminal-data-client commands/selectors + `undici@8.11.2` HTTP/WebSocket/ProxyAgent 注入进行场景操作。多 logical device 各有隔离 runtime composition、fixture identity 和日志 safe alias。现有 `terminal-ws-wire-client.mjs` 只供 TDS wire CONTRACT，不移植/复制协议实现。 |
| fixture/secret | 只读取 `r5-full` 的 8 条现有 terminal fixtures；测试内存选 fixture，绝不写 secret 到 manifest/log/result/ws dump。DEV start/restart不 seed。Node逻辑不访问 DB。reset/seed 仍走独立受管脚本且先满足动态前整体准入。 |
| runner focused proof | local runner tests 验证三节点身份唯一、两个 listener只映射目标 backend、两个 tunnel不允许直连节点/PG/management port、没有按名称/端口停未登记进程、manifest digest/config hash/host identity mismatch拒控、cleanup逐个 resource归属。容器起停与 remote managed运行不得在静态 CP focused proof内执行。 |
| 真实场景 | V-E1 real HTTP activate/WS compressed connection/3 pings/latest state/backend cancel/device local cancel/reactivation/device online cancel；V-E2 首地址故障后 entry2 20秒内成功并记 preferred；V-E5 两 client rebind/旧设备自取消但不误关新设备；V-E6 四逻辑客户端、三节点、两入口、A graceful removal→B、B crash removal→C/entry2、单客户端 cancel、restart A/B 无 failback，逐阶段核会话节点、最新状态、readiness与cleanup。 |
| CP 退出 | HAProxy source/version/docs约束、Node exact package/runtime、manifest/tunnel/cleanup focused tests、scenario fixtures 与安全字段逐一核准；fresh CP-05 三维 `MATCHED`。 |

### CP-06 · 对账、逐判据验收与交付

**RECALL**：详设 §11a/§13/§13b/§13c、批次二需求每条 V 项、implementation-task-template §6a/6b/6c/13c、verification governance、D-48 V-B15 已有 acceptance standard，review standard 与 blind-review governance。对每个 operation 重新确认 backend scenario file、现有 path identity、fixture、request、具体业务 oracle 和 focused/full runner；本批只补/扩既有 `*AcceptanceScenarios.java` group，不造 `performanceCriterion` 等退役字段。

| 项 | 计划 |
|---|---|
| 静态顺序 | 检查所有代码、生成产物、门与脚本的 owning diff；`scripts/verify --validate-only` 与默认 `scripts/verify` 分别取实际输出/耗时；`terminal-verify` 与 `THCL-04-node-tests` 不重复调用 Node suite。按已批准 CP 逐点记录前后双读与 focused proof。 |
| 6b | CP-01..06 每阶段 reviewer `MATCHED` 后，由新的 fresh read-only reviewer 对整批需求、详设、IA（无 UI-bearing IA时标N/A理由）、项目记忆规范逐项6b；所有跨 CP事实复核。OPEN 主 agent修复后再用 fresh reviewer复查。此步在任何整体动态验收前。 |
| Browser/seed准入 | 按详设§3a从当前 admission source 逐项复核6 cases、60 distinct `controlKeys`、40 distinct `actionControlKeys` 与 38 条 `controlPlaneFiles`；fresh reviewer记录 `L2_SCRIPT_ADMISSION=PASS` 及 `§3a=N/A_WITH_REASON`（没有批次二浏览器 action），不新增 L2。完整 seed current-byte dry-run PASS 之前不 reset/seed。CP对账、6b、该独立admission和seed四项齐全并在 `doc/review/platform/*-codex.md`留证才允许首次任何批次 reset/seed/L2；38文件任一字节变化都使准入失效。 |
| 首次动态场景 | 第一次 managed run 精确执行：`scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain`。现有 `--operation` 始终指一个业务场景；新增 TDS selector 只接受该单一闭集 ID，独立报告 CONTRACT，不扩充业务 operation catalog。该次运行先执行现有 topology-preflight phase：两个业务后端上下文、独立 TDS 进程、两类 classpath 解析版本、TDS `REACTIVE` 应用类型、一个度量 sink、共用数据库与 run identity、真实 HTTP/WS、一次受管 10 秒数据库停机及恢复、clean exit。预检失败则 selected BUSINESS 与 TDS scenario 均不得执行；预检通过后只执行所选一个 BUSINESS operation 和一个 TDS CONTRACT 场景，不运行全目录。 |
| 动态顺序 | V-S15 focused backend-acceptance且cleanup PASS → package/Node focused tests → existing Expo Web V-T17 before any non-adapter app/device tests (本批不跑 Android/VM) → 完成四项准入/seed dry-run → 受管 DEV按单场景 first run V-E1 smoke → V-E2 → V-E5 → V-E6 → 所有剩余验证回归。业务 CONTRACT/BUSINESS/DB_OPERATIONS/cleanup分开；受管场景只用当前 manifest entry。动态全量只在先行 focused proof 通过后。 |
| 13c/逐代码 | 逐项证明生产类型/方法有调用方或具名入口；每个生成物有唯一 producer；每个 producer有具体输出。逐文件、逐生产符号、逐新增/修改代码行与详设约束对账，逐条列 path/symbol/criterion/result。结论只 `MATCHED`/`OPEN`；不得抽样、不得用CP三维对账代替。 |
| 整批 adversarial review | fresh 子 agent `REVIEW_TARGET=IMPLEMENTATION` 按详设攻击真实 production code、真实场景与当前 bytes；每项指详设位置+实现位置。设计中无判据者记`DESIGN_GAPS`并回到未来获授权的设计变更，不在实现里自创产品语义。主 agent dialectical intake 后修复finding并 fresh复核。之后提供 static review request给 Dexter与Claude；13c `MATCHED`之前不得handoff。 |

**CP-06 退出**：完整判据表没有缺项；最新 run 和 last known good 按两行格式、runId/time/result/current-byte一致性呈报；业务结果/cleanup分开且 cleanup PASS；first failures保留；全部 CP和6b MATCHED；13c MATCHED；整批 implementation review已完成；实际静态/动态输出、版本与source hash随交付。任一OPEN或清理不PASS，结论为实施未就绪。

## 4 · 动态执行顺序与资源安全

| 阶段 | 进入条件 | 范围/输出 | 未通过处理 |
|---|---|---|---|
| local focused | 对应 CP 的所有 RECALL 完成，当前字节源码与 fixture 已静态核对 | owner/actor/selector/client/generator/config/TDS unit and structure tests；每次读取实际 log | 保存 first failure，归一化 failureCategory；同一类第二次出现冻结其后场景，用同一 proof根因修复后继续 |
| CP 阶段对账 | 本 CP 所有修改+focused proof完成 | fresh独立三维需求、详设/IA、memory规范逐项 MATCHED | OPEN 修复后 fresh复查同一完整 CP，不能进入下一CP |
| 完整6b | CP-01..06全MATCHED | fresh独立读全批需求、详设、IA适用性、memory规范；不合并旧结论 | OPEN根因修复并复查 |
| V-S15 acceptance | 6b MATCHED；闭集 selector/manifest tests通过；拓扑预检 phase 的两个业务上下文、独立 TDS、解析版本、REACTIVE 类型、单度量 sink、共用 DB/run identity、真实 HTTP/WS、10 秒受管停库恢复、clean exit 全部通过 | 单个所选 BUSINESS operation + 一个 TDS CONTRACT 场景：真实 TDS HTTP readiness 从 UP 转非 UP（HTTP 非 200，记录实际状态）/WS shutdown ordering；CONTRACT、BUSINESS、DB_OPERATIONS 与 cleanup分开报告 | 按 failure family closure，同一 failureCategory 第二次即冻结后续动态场景 |
| Dynamic pre-admission | CP review/6b；§3a controls and L2 list独立review `PASS`（明确空分母理由）；seed current-byte dry-run PASS | review记录置于 `doc/review/platform`。其中本批 `§3a=N/A_WITH_REASON`，但无L2控制的独立admission结果仍须存为 PASS，且后续任何控件改动使其失效 | 四项缺失禁止当前批次任何reset/seed/L2；不影响已批准的 backend-acceptance按标准执行 |
| 受管 DEV preflight | 动态前整体准入 PASS；首次运行一个场景；remote resource/process/container manifests符合AGENTS | 三TDS唯一身份、两HAProxy、两tunnel、Node runtime/package resolved versions、real HTTP/WS、remote logs、budget、single scenario和clean exit | 未知identity/资源拒绝；禁止端口/名称猜测；资源门与TER UI资源门各自独立 |
| V-E series | V-E1首场景PASS+cleanup PASS | E1,E2,E5,E6各按表独立运行并报告；全完成后只需当前字节的必要回归，不得通过变场景避失败 | first failure保留；源码未变不重跑；清理在业务之后单报；cleanup非PASS不继续运行新的 managed scenario |
| Delivery | 当前字节完整动态证据、所有review/对账完成 | 详设、计划、命令真实输出与log redaction/cleanup/runner manifests | 有 OPEN/cleanup failure则报告未就绪，不以旧 bytes证据代替 |

受管运行规则：先记录本机/远端/容器 owner identity 和各自 rss/resource budget；远端 PID 必须匹配 host/boot id/start ticks，容器匹配 id/image digest/runId/config hash。held run期间不改 `apps/backend` 或 `apps/frontend`。任何数据库停机只调用授权的受管 harness action；不得手工通知 DB、按端口停进程或直接写库。DEV stop/restart遵循 AGENTS Testcontainers联动：若预检确认 manifest-owning DEV正在运行，先记 `DEV_WAS_RUNNING=true` 并受管 stop+cleanup PASS，再 Testcontainers；仅当 business及cleanup PASS后 restart 当前字节 DEV；原无 DEV或测试失败不擅自启动。此要求不表示本回合执行。

## 5 · 输入/输出清单与角色

| CP | 主要新增/修改路径（未来实施） | 不改动/保留 | 实际调用入口 |
|---|---|---|---|
| CP-01 | `contracts/policy/terminal-client-generation.json`、TER client generated output、edge generator/test/checker、skeleton graph/checker/test、R-12 anchors | backend routes/operationId/security/error set、admin generated bytes、`tdp=FORBIDDEN` seed assertion、batch3 files | `openapi-contracts`、`terminal-verify` |
| CP-02 | `kernel/base/server-config/**`、`kernel/base/state/**` reset descriptor/runtime、TR-09 exception anchor | terminal credential唯一owner；other owners；protected store contract | `terminal-verify` |
| CP-03 | `platform-ports/**`、`transport/**`、`terminal-data-client/**`、TER package dependency & lock resolution | terminal UI/actions、native adapters行为（仍 unavailable）、batch3 network sync | `terminal-verify`, `THCL-04-node-tests` |
| CP-04 | `terminal-data-server/build.gradle.kts`, `application.yml`, `TdsRuntimeProperties.java`/`TdsRuntimeSettings.java`/`TdsGracefulShutdownLifecycle.java` 与对应 `TdsRuntimeSettingsTest.java`/`TdsGracefulShutdownLifecycleTest.java`；`TdsAcceptanceProcess.java`, `TerminalConnectionContractScenarios.java`, `BackendAcceptanceTest.java`; `scripts/test/backend-acceptance`, `scripts/test/backend-acceptance-structure.test.mjs`, `scripts/test/r5-remote-testcontainers.mjs`, `scripts/test/r5-remote-testcontainers.test.mjs`; runtime-key inventory/count | database schema/Flyway/seed/TDS business owner；V-S15 不进 business operation catalog/denominator | TDS tests, backend-acceptance |
| CP-05 | existing `scripts/dev/r5-dev-runner.mjs`/remote manifest/guards; new `scripts/test/terminal-client-dev-acceptance.mjs`; focused tests | `terminal-ws-wire-client.mjs` wire contract use, DB tunnel prohibition, no direct TDS tunnel | runner guard tests, managed DEV scenarios |
| CP-06 | acceptance scenario expansion/recorded review evidence and output artifacts | generated scenario contract and retired provider fields | `scripts/verify`, `terminal-verify`, acceptance and managed scenario entry points |

Main agent only writer for all listed paths after separate implementation authority. CP reviewer reads; 6b reviewer reads; 13c reviewer reads; independent `REVIEW_TARGET=IMPLEMENTATION` reviewer reads. Tester and runner code may not write production state outside owning APIs.

## 6 · 业务验收场景定义

批次二不新增 backend HTTP route、OpenAPI `operationId` 或 generated-operation budget identity，但因要求核对现有端点对未知字段的行为，须按主动标准扩展现有 owning group，而不是为每个 variant 创建新 route 或另一个 registry。V-B15 会新增一个唯一 backend-acceptance `module.operation` 场景选择键；这是验收 catalog 的业务场景，不进入 API operation catalog 或 DB operation budget。

**V-B15 scenario group**：在当前真实 class path 找到并扩展既有终端激活 acceptance scenario class。Intent 固定为：

- `identity`: HTTP operation pair `activateTerminal` / `cancelTerminalActivation`，现有 `terminal` face；验收 scenario `id/module.operation` 为 `storeTerminalActivationUnknownFields` / `TERMINAL_BINDING.storeTerminalActivationUnknownFields`；后者只用于 `--operation` 选择该场景，不是 OpenAPI `operationId`、路由 identity 或 generated-operation budget identity；
- `fixture`: 从现有 `r5-full` 8 条终端 fixture 中选一个未作废且所属 store/workspace 正确的设备，另建全新的执行期 JSON 请求体，不落库直接造事实；
- `request`: 真实 HTTP command activation 与 device cancellation 各发送一份合法 body；两个 body 分别带齐 unknown array、nested object、1 KiB string；再分别对认识字段发送 invalid type/length/range；运营后台对相同权限边界仍用其已有负例；
- `businessOracle`: 对两个合法未知字段请求，读取 HTTP业务响应、通过公开 readback确认设备/激活 generation、会话登记/业务结果和状态写入等于基线应有结果；对 invalid known field 和运营后台请求，核对具体 error code/status、无 owner state mutation、无 audit/credential/session change；确认多请求没有泄漏 secret。不以状态码或 `response.ok` 单独作为 oracle；
- command: unique `@AcceptanceScenario(id="storeTerminalActivationUnknownFields", module="TERMINAL_BINDING", operation="storeTerminalActivationUnknownFields")` in the existing `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java`; the existing runner selects exactly this scenario by `--operation storeTerminalActivationUnknownFields`, as its current filter accepts either annotation `id` or annotation `operation`. This creates one additional BUSINESS acceptance scenario, not a production HTTP operation or performance-projection identity. Then the authorized full batch `backend-acceptance` invocation follows the focused proof and cleanup rules.

场景现状/类名在 CP-06 RECALL 时从 `rg` 当前源码找到，不依据本计划臆造文件路径；如标准要求的 intent field 与当前 runner实现不能并存，先在当前授权下按标准修 runner，不新增退役元数据字段。

V-S15 是真实 TDS contract scenario，不是业务 `BUSINESS` 场景。新增 closed `--tds-contract-scenario` 参数只允许 `terminal.connection.vs15.readiness-withdrawal-and-drain`，要求与 `--operation storeTerminalActivationBusinessPrecedence --topology-preflight` 组合；unknown ID 或组合不合法时远端 runner 不启动。参数由 wrapper 传入 `V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO` 并写入 run manifest；独立 TDS contract factory 只选该 ID。V-S15 selector run 的执行/结果分母精确为一个所选 BUSINESS scenario 与一个所选 TDS CONTRACT scenario；先执行的拓扑检查（含当前无条件 `terminalConnectionTopologyContractProbe()` 的 V-S1 database-only-startup 检查）统一标记并写入独立 `TOPOLOGY_PREFLIGHT` 通道，不输出 CONTRACT 行、不算作第三个 scenario。该 TDS probe 的原 V-S1 CONTRACT 结果在没有 `--topology-preflight` 的常规 acceptance run 保持不变。拓扑预检必须完整 PASS 后才执行两个所选场景；任一 preflight 失败时两者不启动。TDS readiness/shutdown输出 `CONTRACT`，现有 operation 输出 `BUSINESS/DB_OPERATIONS`，不把 TDS ID 注册成业务 operation，且 TDS process cleanup独立记录。

## 7 · 运行状态报告模板

每次状态更新必须提供：

```text
当前字节上的最新运行：<run id | 无；time | 无；result | 本回合未运行>
最后一次通过：<run id | 无；time | 无；是否与当前字节一致 | N/A>
```

每份交付证据再附详设 §11a 逐项映射，至少包括 scenario id、当前 byte result、runId、evidence tier、business channel/cleanup、首次失败和最后一次通过。设计/计划阶段本回合没有运行，将“未运行”原样标清，不造 run id 或预期 PASS。动态运行中的日志不足即定位 owning source，不等、不加长 timeout、不猜测错误进程身份。

## 8 · 批次完成定义

1. 六个 CP 完成后各自有 fresh 独立三维 `MATCHED`。
2. 整体动态运行之前 fresh 6b 为 `MATCHED`，§3a 空分母 admission、seed dry-run 和四项整体准入留有 current-byte `-codex` 证据。
3. 详设 §11a 每行都有执行入口、场景 ID 和分离 evidence channel；所有适用场景在当前字节运行，V-S15/V-E 都是实际远端/真实 HTTP/WS 证据而非 unit 模拟。
4. `scripts/verify` 两种模式、`terminal-verify`、既有 Node suites、V-S15、V-B15、V-T17、V-E1/E2/E5/E6真实输出和耗时按各入口出具；未重复执行已注册的测试。
5. V-T selectors 测试从真实 owner command、`SESSION_READY`、`PONG` 事件到 selector 读值；没有“方法存在即覆盖”证据。
6. 当前 bytes 的日志、输出、secrets marker 与所有 owned resources cleanup PASS；两行运行状态有真实 run ids/time/bytes status。
7. 13c逐代码与详设对账全量 `MATCHED`，fresh 独立批次二 `REVIEW_TARGET=IMPLEMENTATION` 已完成并由主 agent处置；Dexter/Claude static review handoff request依模板检查通过。
8. 交付范围只有批次二；实现期若遇产品语义缺口、超资源边界或要求改需求，停在对应处置边界，不延伸批次三。

上述均是未来 implementation 的条件；当前交付目标只到两份文档与 DESIGN review。

## 9 · 对 Dexter 与 Claude 的转交话术（未来实施完成后）

后续实施交付时，依据 `doc/platform/claude-review-handoff-template.md` 创建并经 `scripts/check/claude-review-handoff --file <path>` 验证的静态 review 请求。此计划阶段不创建 implementation review handoff 文件，也不运行该校验脚本。

## 10 · 可复用验收清单

| 检查面 | 本计划要求的可观察结果 | 反例 |
|---|---|---|
| Command→actor | 五项 lifecycle command 都进入 terminal-data-client actor；三 selectors由实际动作填充 | command直接 mutation，或selector永远读默认值 |
| API generation | 两个 operation 面面俱到、恰好一次、仅进 terminal-data-client | policy漏 operation/分配两次/生成文件有 import或网络 |
| Config owner | 一份完整 service config持久值，masked selectors，密码只有protected | 按下标继承旧 override；密码在selector/log/state复制 |
| Reset retention | reset 后只留下 server-config登记 keys | terminal identity、别的 owner 或 orphan残留；server-config丢失 |
| Network state | 可选 DevicePort读/订阅、seed/dedupe，仅 transport command | unavailable仍访问系统API，subscriber直连WS |
| Retry | 有界定时器、无次数上限；失败退避；preferred仅在ready后 | 网络 flap把n重置，退避被绕过，等ready前切preferred |
| HTTP/WS proxy | 新 request/new socket用配置；existing socket不变；同Undici dispatcher | global fetch混包，自写CONNECT，改配置杀现有socket |
| Readiness drain | ready下线先于摘流但不先拒新；超过检测界后拒新，再drain | 先 refuse traffic、listener still ready、HAProxy仍可路由到拒绝节点 |
| HAProxy topology | entry1 A/B roundrobin；entry2仅C；两个 loopback tunnel | source hash、node-direct tunnel、入口映射交叉 |
| Secrets | 请求秘密、代理密码、凭证等只在需要内存/secure flow | 日志、manifest、HTTP descriptor、异常消息出现秘密 |
| Dynamic gate | 真HTTP/WS、远端身份和清理有独立证据 | 单测假连接宣称多节点接入；cleanup未pass宣称场景通过 |

## 11 · 计划模板覆盖自查

| 模板字段 | 状态 | 落点 |
|---|---|---|
| 当前授权、用户目标、Dexter阶段意图 | PRESENT | §0 |
| 替代方案与推荐 | PRESENT | §0.2；详设 §1.2 |
| RECALL 与六维 memory | PRESENT | 六 CP 的 RECALL |
| 每步骤现成能力 | PRESENT | CP 步骤表 |
| 每步骤验证观察 | PRESENT | CP 步骤表、§4、§6 |
| 缺少能力时形态 | PRESENT | CP-01～05 |
| 完整业务 scenario intent + oracle | PRESENT | §6 V-B15 |
| every acceptance criterion→scenario→tier | PRESENT | 详设 §11a，并由 §4/§8 收口 |
| CP review 与完整6b | PRESENT | §2、§4、§8 |
| `动态前整体准入` | PRESENT | §4 dynamic pre-admission |
| TER TR-16 | PRESENT | CP-06：Expo Web V-T17先于任何未来 non-adapter app/device；本批不进行 Android/device run |
| explicitly named `逐代码与详设对账` | PRESENT | CP-06 13c；逐行全改动，MATCHED/OPEN |
| 整批 fresh IMPLEMENTATION review | PRESENT | CP-06 |
| 第三方版本与版本匹配官方资料 | PRESENT | 详设 §3.1，CP-03～05复核与focused proof |
| 动态、资源、日志、cleanup纪律 | PRESENT | §4、§7 |
| 超范围和停机边界 | PRESENT | §0.3、§1.2、§4 |
