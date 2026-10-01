# 终端激活与长连接 · 批次二实施计划

```text
DOC_KIND=IMPLEMENTATION_PLAN
DESIGN=doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md
SERVICE_SHAPE=doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md
AUTHORIZED=DEXTER_2026-09-30_BATCH_2_RESIDUAL_REVIEW_FIX_CONTINUOUS_IMPLEMENTATION_DYNAMIC_ACCEPTANCE_RESET_DEV_START_R5_FULL_SEED
NOT_AUTHORIZED=production_deployment; UAT; batch_3; requirements_or_journey_product_semantics; physical_device_operations
IMPLEMENTATION_AUTHORITY=true
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-OWNER-BOUNDARY-2026-09-30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
REVIEW_STATUS=DESIGN_CYCLE_CLOSED; RESIDUAL_S1_N1_REPAIRED; IMPLEMENTATION_AUTHORIZED_BY_DEXTER
LAST_INDEPENDENT_VERDICT=CLAUDE_FRESH_NO_GO_M0_S1_N1_ON_PRE_REPAIR_BYTES
ROUND_FINAL_DECISION=SELF_DECIDED
AUTHOR_FINAL_DESIGN_DISPOSITION=SELF_DECIDED_GO_FOR_CLOSED_SUBAGENT_CYCLE_ONLY
CURRENT_BYTES_AUTHOR_STATUS=S1_N1_REPAIRED_AND_RECONCILED;BATCH_2_IMPLEMENTATION_AUTHORIZED
INDEPENDENT_VERDICT_COVERS_FINAL_BYTES=false
CLAUDE_REVIEW_STATUS=IMPLEMENTATION_REVIEW_AFTER_BATCH_DELIVERY
EVIDENCE_TIER=STATIC_DESIGN_AND_PLAN;IMPLEMENTATION_AND_DYNAMIC=NOT_RUN
```

## 0 · 任务与授权

### 0.1 真实任务与本阶段意图

业务目标是让 TER 使用需求已定的 terminal credential HTTP 接口激活/取消激活，按配置的服务地址与代理建立 WebSocket，并能查询激活、连接、时延状态；同时令 DEV 的三个独立 TDS 实例经两个可健康摘除的 HAProxy WebSocket 入口接受连接，并在退役节点时先从新连接选择中移除再 drain。本计划先修复 S-1/N-1 文档残项并完成一致性回读，随后按 CP-01～CP-06 连续实施，不重开已关闭 DESIGN cycle。

Dexter 的阶段意图是一次性形成可审查的完整批次二实施输入，尽量用已存在的 owner、state、transport、Undici、Actuator 和受管 runner，避免实施期临时发明连接器、第二凭证库、探针或代理服务。UI 交互不是本批目标，因此不新建 Journey、IA、交互稿或 L2 控件。

### 0.2 可行方案与选择理由

可行方案包括：把配置与重试并入现有 transport、TER client 自写网络/代理栈、Node 内置 WebSocket 加另一个 HTTP 客户端、单个 TDS 入口后直连节点，或采用详设 §1.2 的独立 `server-config` owner、transport command/actor、终端 owner command/selector、固定 Undici 和两个 HAProxy 入口。推荐最后一种：它沿用仓内配置/状态/transport 主权与 R-10.3 边界，不再造 proxy/WebSocket 协议，并能在 DEV 里用真实连接证据观察节点摘除。当前没有待 Dexter 裁决的产品语义；实现期未能证明依赖版本、拓扑、资源身份或配置界限时按下文停在该具体步骤，不猜 API、不降档。

### 0.3 阶段权限

**当前授权（Dexter 2026-10-01 本会话）**：完成 S-1/N-1 的最小修正与一致性核实后，立即执行本计划全部批次二实现、适用动态验证及最终非生产 reset→DEV start→完整 `r5-full` seed；无需再次等待授权或另开设计评审轮次。reset-only、seed-only 或组合动作前均须当前字节完整 `r5-full` seed dry-run PASS，且 reset 时先于 reset。授权还包括 CP/6b 对账、受管 backend-acceptance、TER Node/Expo Web、真实 HTTP/WS 与 DEV 联调。无真实 L2 控件时 §3a 保持 N/A，不制造空分母 admission；每项受管运行继续满足资源身份/预算、日志与 cleanup。不得生产部署、UAT、批次三、物理设备操作或修改需求/Journey 产品语义。动态结果与历史静态证据分开报告。

## 1 · 批次边界与交付物

完整范围、owner、精确行为、失败边界和场景期望以详设为正本；本计划只把它排成可执行阶段。批次原子交付，CP 是阶段级内部对账单位，不是分批验收或单独交付。

### 1.1 本批交付

| 范围 | 实施输出 | 主要 owning source |
|---|---|---|
| 生成 terminal HTTP client | terminal face+tag policy、生成器闭包/门、`terminalApi.ts` | `contracts/policy`、edge codegen、`apps/terminal/kernel/base/terminal-data-client` |
| `server-config` | package、命令、脱敏 selectors、持久化、全量显式 override、代理安全信息、默认配置与 reset retain | `apps/terminal/kernel/base/server-config`、`kernel/base/state`、现有 `TransportServerConfig` |
| `terminal-data-client` 与 transport | 命令→actor 生命周期、生成 operation 调用、持久身份、3 selectors、重连/切址、network DevicePort bridge | `kernel/base/terminal-data-client`、`kernel/base/transport`、`kernel/base/platform-ports` |
| TDS readiness/node identity | `nodeId` 配置、Actuator readiness、readiness 先行撤出、3 秒流量转移等待、生产 drain 上限 10 秒（本 acceptance 场景用现有 8 秒） | `apps/backend/terminal-data-server` |
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
| 6 | CP-06 场景闭包与动态前准备 | 全部判据映射、场景/runner 接线及 focused proof 完成 | CP-06 三维 `MATCHED`；随后单独进行整批 6b，之后才开始整体动态验收 |

CP 内每个实际变更点按实施模板做需求/记忆/owning source 写前重读与 focused proof；只有完整 CP 结束时进入独立三维对账。实施者不能在 CP reviewer `MATCHED` 前进入下一 CP。CP-06 退出只要求该阶段的场景/runner/focused proof 完成并 `MATCHED`；全 CP 完成后单独进行整批 6b，6b `MATCHED` 后才进入整体动态验收。此任务当前只产生本计划和详设，尚无 CP 完成证据。

## 3 · 每阶段实施工单

### CP-01 · 生成链、门闭包与治理同步

**RECALL（进入前重开）**：需求 §1.1、R-12、R-15.1～15.7、R-16、D-44～D-51；service-shape decision §6.1～6.3；批次一详设 §12 Q1～Q16/Q14；批次一详设、R-12 gate ledger；`doc/platform/implementation-task-template.md`；`scripts/README.md`；`tools/verify-gates/verify.mjs`；edge codegen 当前 source/fixtures/tests；`tools/terminal-skeleton` 当前 graph/check/tests；`contracts/openapi/paths/terminal/activation.paths.json`；`THCL-04-node-tests`。运行六维 memory recall 并读取全部命中原文。重新搜索当前字节，不把本计划或 Q14 快照作为当前门输出。

| 项 | 计划 |
|---|---|
| 用哪个现成能力/规范 | 现有 `edge-codegen --check`、`openapi-contracts`、D-41 路径守卫、`THCL-04-node-tests`、TER package manifests、`terminal-skeleton` 的 package graph。两个 HTTP operation 已存在，不创建后端 route/OpenAPI `operationId`；另新增的 V-B15 是 acceptance `module.operation` 场景键，不进入 generated-operation budget。治理同步用 service-shape decision 已接受正文锚点，不整文件取代。 |
| 修改全集 | 新增 `contracts/policy/terminal-client-generation.json`；生成 `apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`（唯一 TER producer）；从 canonical `contracts/openapi-source/terminal-binding.schemas.json` 修改且仅修改 `TerminalActivationRequest`、`TerminalActivationCancellationRequest` 的 unknown-field policy，并更新 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 中该 source 的 SHA-256。按 `canonical source + catalog pin → r5-edge-materialize --write → edge-codegen --write → TER generation → 三方逐项对账` 执行，绝不手改 `contracts/openapi/components/terminal-binding/terminal-binding.schemas.json` 等物化/生成输出。仅两个 terminal request DTO 忽略未知字段；`OperationsTerminalActivationCancellationRequest` 与其他 DTO 继续严格拒绝 unknown。更新 generator/checker/focused tests、`scripts/verify` 对应入口；新增 `scripts/test/edge-codegen-terminal-unknown-fields.test.mjs` 并登记至 `THCL-04-node-tests`；TER skeleton graph/check/tests 加两个 package 节点/依赖；按设计 §4 CP-01、§12 命中清单进行 R-12 anchor-local 同步。Journey 第 48、54、60 行的凭证 owner、reset 范围、多实例/跨节点批次边界与 R-10.5 错引按详设 §0 登记来源漂移；本次 Dexter 裁决已定凭证 owner，不再重复等待同一裁决。本授权不含 Journey 正本修改，CP-01 将当前裁决列为实施依据并同步其引用清单。批次没有新增 L2 action，不改 `contracts/policy/store-terminal-l2-admission.json` 的 `controlPlaneFiles`、6 cases、60 controlKeys、40 actionControlKeys、UI/fixture/locator。root ADR 锚点由已接受的 2026-09-26 service-shape decision 精确 supersede；因其是 hash-bound local frozen asset，本批只核实原字节摘要，不修改该 ADR 或两处哈希钉。每条检索命中记录 path、line、entry、verify mode、marker-specific red fixture 或反例支持的 N/A。 |
| 若无现成能力，形态 | 两份 OpenAPI request schema 以 `additionalProperties: true` 明确 R-15.7 的终端兼容性，edge-codegen 按该元数据生成 unknown subtree skip；不加全局 Jackson 容忍开关。必须仍追踪全部 property 名称，以拒绝重复字段；已知字段照原规则校验，malformed/trailing JSON 仍拒绝。运营后台 schema 保持 `additionalProperties: false`。TER policy 仅含仓内相对路径/tag/target；沿 D-41 的 root-containment/symlink fail-closed 方式。terminal face + `terminal-binding` exactly selects 两个既有 operation，各归属一次；TER 生成文件零 import、零 fetch/socket，运行 executor 由 owner 注入。 |
| focused proof | TER generator positive exact-two closure；zero/duplicate/wrong tag/wrong face/nonterminal target/empty selector/drift/root escape/symlink escape 红例；生成文件移除后 `--check` 报标记；非 terminal frontend generated outputs bytes unchanged；skeleton 漏包、虚构包、forbidden/cyclic edge 各红。edge-contract source 修改后确认 catalog hash 与 canonical bytes 一致，materialize 输出逐项反映该源，edge-codegen 只更新两个 terminal request wire DTO，TER operation descriptor 与两个既有 operation 精确相等。两个 terminal request DTO 各自可读 unknown array/nested object/1KiB string; known-field bad type/length, duplicate unknown name, malformed/trailing JSON fail; operations-admin DTO unknown property fails。不得直接编辑 materialized component 或生成 DTO。`THCL-04-node-tests` 中已有测试不得二次注册。记录 `openapi-contracts` 与默认 verify 各自耗时。 |
| 交付记录与 CP 退出 | policy/生成产物来源关系、当前检索全集与门映射、decision/R-12 anchor-local 清单、hash-bound ADR 原摘要核实、focused 输出、实际选择理由。全部命中有处置，门 red mutation 经指定 `scripts/verify` 入口生效；fresh CP-01 三维 `MATCHED`。 |

本批不新增 HTTP route、OpenAPI `operationId` 或 generated-operation budget identity，所以 CP-01 不做全目录预算 calibration，也不改预算上限或投影来配合生成器。V-B15 增加一个 backend-acceptance `module.operation` 场景选择键，不进入 API operation catalog 或 generated-operation budget。先从当前 projection source 确认两个既有 HTTP operation 已包含在正常投影中，TER 生成配置与 API operation denominator 分开断言。若 `--validate-only` 失败，保留首败并从读取它的门及 owning projection/source 查明原因；不得把静态失败写成绿基线、延期到后续 CP 或擅自扩大 API operation 数量。

### CP-02 · `server-config` 与 owner-declared reset retention

**RECALL**：需求 R-9.6、R-11.1～11.9、D-16；TR-09（特别是 state reset exception）；`TransportServerConfig`、现有 defaults 与 `resolveTransportServerAddresses.ts`、`kernel/base/state` slice persistence/reset composition、`platform-ports` `PersistSecurePort` 和同类 secure owner。六维 recall 命中原文逐条读回。

| 项 | 计划 |
|---|---|
| 复用与路径 | 新建 `apps/terminal/kernel/base/server-config/{package.json,README.md,src/**,test/**}`；复用 `TransportServerConfig` / service-name type；使用现有 owner command/selector/state reducer 和 `PersistSecurePort`，state engine 提供 owner 声明的 retain intent；不让 server-config 依赖 transport 或 terminal-data-client。 |
| 命令/selector | `selectEnvironment`、`setServerOverride`、`clearServerOverride`、`restoreServerDefaults` 均由 package command dispatcher/actor 处理。Selectors 返回环境、服务名、address 名称/主机等必要非秘密属性和 `passwordConfigured`；没有 selector 输出密码。override 一次写明服务全部地址/超时/proxy；同服务旧版本的未填字段不能按地址索引继承。 |
| 配置与故障形态 | Defaults 由 composition 注入，不进用户持久 store。Proxy 仅 HTTP；host/port 合法；用户名/密码同存同缺；secret 经 secure persistence；代理无效时整份 command 拒绝且旧配置不变。每服务最大 4 addresses。命令更新增 revision；只通知新 HTTP request / 新 WebSocket attempt，active socket 不关。 |
| 验证观察 | V-T1：初始 defaults、环境选择、selector 脱敏、全量地址身份、非法 override 原子拒绝、重启恢复逐条读回。V-T2：configuration revision 变更后下一 request 使用新设置、existing socket 仍可 ping。V-T8：clear-all state 后只保留该 owner 持久配置，credential state/未知孤儿清除；删除 retain 规则红例，误 retain 第二 owner/red orphan 红例；reset failure 不启动 runtime reset。V-T18 service isolation/password mask 由下一 CP 端到端消费。 |
| CP 退出 | 新 package 静态闭包与 focused tests 完成；TR-09 明确仅 `server-config` 可声明 retain，state runtime 按其 persistence descriptors 保留对应存储键，并在 reset 成功时将仅持久字段/记录投影回 slice 初始值；其他 owner 与 orphan 清除，第二 owner 的 TER skeleton static 红夹具失败；持久值/secure secret/重置状态对账；fresh CP-02 三维 `MATCHED`。 |

现有 state engine 若只能清除命名空间所有键，实施需扩为“owner-declared persistence retention”且由 state owner实现，不允许 server-config 自己绕过 reset，也不允许添加 credential shadow store。`retain` 的实际保留 keys 只能是 server-config 声明的注册 slice；其他 owner 与 orphan 不保留。

### CP-03 · transport、`terminal-data-client` 与网络 port

**RECALL**：需求 R-1.6、R-2.1、R-4.6、R-9.1～R-10.5、R-15、D-37、D-40、D-43；TR-09～TR-16；CP-01 generated client、CP-02 snapshot API；现有 `transport` package owner commands/actor、`DevicePort`/`NetworkStatus`、`resolveTransportServerAddresses.ts`、`AppControlPort`/secure persistence、`kernel/base/runtime` and state reset。第三方 Undici 8.11.2 官方 API/源码按详设 §3.1 当前版本重核并带版本匹配证明。

| 项 | 计划 |
|---|---|
| 依赖与路径 | 扩 `apps/terminal/kernel/base/platform-ports` 增 network read/subscribe/unsubscribe 端口与 unavailable default；扩 `transport` 的通用 socket/retry/address-switch/network bridge；新建 `kernel/base/terminal-data-client` 唯一保存终端凭证、激活/取消命令、TDS协议处理与状态selectors。TER application/test composition 经 `server-config` owner API 解析当前有效配置，并把不可变 network provider 注入 `transport` 的 network adapter/profile；client 只调用 `transport` 的公开通用 command API，不读取 server-config selector/snapshot/state/persistence，也不绕过 owner 直接读持久化实现。TDS 路径 `/tdp/{groupWorkspaceKey}/ws` 由 terminal-data-client 按协议构造为 origin-relative `endpointPathAndQuery`，作为不透明字段随通用 `transport.start` 传递；transport 只拒绝 origin escape，不解释 workspace key 或 TDS 语义，注入 adapter 将 path 与当前 address origin 组合后建连。更新 skeleton graph和package invariants。 |
| 生命周期命令 | `activateTerminal`、online cancel、offline cancel、connect、disconnect 每个通过 `terminal-data-client` command→actor；它拥有Authorization/HTTP业务schema、错误码与响应解释、AUTHENTICATE首帧、SESSION_READY校验、PING/PONG/seq/RTT、heartbeat timeout、TDS业务关闭原因及R-4.6反应。socket callbacks/帧先转成client command，不直改state。激活凭证秘密仅在当前 JS runtime 的未完成操作状态中供 R-1.6 重试复用，不写持久化；成功后仅最终终端凭证由 client 经 `persistSecure` 持久保存，JS 重启后 pending operation 为空、已成功凭证恢复。在线/离线取消按需求清身份并先以通用`stop`叫停transport。 |
| 三个 selectors | `selectActivationState`、`selectConnectionState`、`selectConnectionLatency`。对每个 selector 写入从真实 command/SESSION_READY/PONG action 得 state 的测试；同时拒绝分支和 credential redaction。Latency 样本限 2 小时且 `floor(7_200_000 / heartbeatIntervalMs)`；重连保留、JS restart 清空、心跳变化即裁切。真实独立 state runtime 重启测试验证最终凭证恢复、未完成激活操作秘密不恢复且激活 selector 仍返回 active。单测不得只实例化 selector 或 reducer。 |
| Transport/network | transport只接通用`start(parameters)`（含可选且不透明的 origin-relative `endpointPathAndQuery`）、`ready(stableAfterMs)`、`invalid(cause)`、`stop`与配置revision信号，管理socket、超时、地址轮转/首选、重试/网络恢复；不解析HTTP schema/status业务码或TDS帧/关闭原因。client校验SESSION_READY后报告通用ready并给稳定期长度（本次heartbeat间隔），transport只计时，不知道其TDS来源；client解释heartbeats与业务失效。Composition 注入的 network adapter 将 opaque path 与选中的服务 origin 组合，并不得允许其覆盖 origin；transport 对 `//host`、绝对 URL、反斜杠、fragment 与控制字符作拒绝测试。Bridge先read作seed再subscribe；read失败则首通知seed；同值去重；跃迁仅dispatch transport command；unavailable不装bridge；stop/dispose unsubscribe。握手失败同次换下地址；握手后已open但未ready则结束本attempt，下轮按节奏从下一个地址开始；ready后失效沿用首选。网络恢复最早距尝试开始≥10秒、不重置n。 |
| 类型/时序反例 | `SurfaceForm` 与 edge 生成的设备形态类型做双向精确相等；两侧各加一个形态的 red mutation 必须由 `scripts/verify` 对应门拒绝。V-T7 分开测 DNS/连接/HTTP upgrade 握手失败（同 attempt 尝试下一地址）与 WS open 后业务未 ready/拒绝（终止 attempt，下一轮按退避与下一个地址）；网络状态触发只发通用 transport command，不直接创建 socket。 |
| 第三方代理/PMD | `undici@8.11.2` 是R-16.3/R-16.4允许的standalone替代实现；本包 `engines.node` 与 Undici 官方 engine 同为 `>=22.19.0`，CP-05 managed run manifest 仍记录受管 Node 实际精确版本。Node bundled Undici 6.28.1与本包不同代；HTTP/WS只用standalone实现。直连 `Agent` 与 `ProxyAgent` 都显式配置 `webSocket: { maxPayloadSize: 65_536 }`，不可依赖128MiB默认；WebSocket 代理显式使用官方 `proxyTunnel: true`，因为 Undici 会把 `ws:` URL 映射为 `http:` 后再 dispatch，而默认协议判断会走非隧道 HTTP 转发。focused测试覆盖直连/代理、压缩准确上界与分片累计，按官方 dispatcher 链证明选项生效；代理凭据只到 proxy CONNECT，origin 收不到。
| 验证 | V-T3/7/14 transport command/actor timing 和 error delivery；V-T4/5/6/8/9/11/12/13 client persistence/selectors/actions；V-T15 generated descriptor/executor/output and unknown fields; V-T16 default/Android/Web no-network capability; V-T18 HTTP/WS direct/proxy/service isolation/auth/leak/config update; fake clock/random/DevicePort/secure store tests。现有 Node tests 只经 `THCL-04-node-tests` 注册一次。 |
| CP 退出 | package graph/invariant、依赖版本官方依据、全部命令 caller、selectors action-to-readback tests、secret negative search/focused red fixtures 均闭合；fresh CP-03 三维 `MATCHED`。 |

无现成的同步 network availability API 时，按现有 DevicePort 的 read/subscribe/unsubscribe 与 capability result 约定扩展，不加系统监测线程。无现成的 actor action 时按该 package 的 command/actor/reducer 结构实现，不让 callback 成为第二写入口。

### CP-04 · TDS readiness、node identity 与 graceful withdrawal

**RECALL**：需求 R-4.5、R-7.1、R-12、R-13、R-14、R-16.1～16.2、V-S15/V-E6；现有 `TdsRuntimeProperties`、`TdsRuntimeSettings`、`TdsGracefulShutdownLifecycle`、`TdsTerminalSessionActors`、`build.gradle.kts`、`application.yml`、环境 key closed inventory、AGENTS diagnostics/run lifecycle。实施前先从 TDS 实际 Gradle resolution 确认 Boot/Actuator artifact 版本；现有 4.1 line API 链接不是补丁版本依据，须按该实际版本核对官方 Javadoc/source 或精确 release tag，并记录坐标、版本、来源和使用的 class/API。

| 项 | 计划 |
|---|---|
| 配置/依赖 | 增 `spring-boot-starter-actuator` 到 `apps/backend/terminal-data-server/build.gradle.kts`；node ID `V2S_TDS_NODE_ID` 默认 `terminal-data-server`；`V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS` 可选覆盖，application config 默认 3000ms，非法/越界（2000..10000ms）startup fail closed；V-S15用4000ms非默认值；同步 runtime env-key inventory/count与测试。 |
| Health | 只暴露 Boot Actuator `health` endpoint（基路径 `/actuator/health`）；由 `ApplicationAvailability`/`ReadinessStateHealthIndicator` 提供的 readiness group 路径为 `/actuator/health/readiness`，webflux server 同端口；health detail/components=never，readiness group 只 include `readinessState`，无 `db` contributor，不新增管理端口或自建 endpoint。HAProxy用户入口显式拒绝`/actuator`与`/actuator/**`（path/path_beg ACL + `http-request deny`）；健康检查直接在远端 loopback 请求readiness，不经用户入口。focused config proof断言入口拒绝、loopback检查仍可读。 |
| Lifecycle | phase 在 WebServer graceful shutdown 前；第一动作 publish `REFUSING_TRAFFIC`，listener/admission/session 暂不变；默认等待 3000ms，V-S15 覆盖 4000ms；期满先 refuse new，再 beginDrain pending unauth admission，然后 acceptance 配置的 8000ms drain，finishDrain close active sessions redirect，最后 callback return 让 WebServer 停止接收。`beginDrain()` 同步完成 admission/session 状态转换后，TDS log worker 在一个有序任务中依次写 `event=tds_admission_refused readiness=REFUSING_TRAFFIC` 与 `event=tds_drain_started`；验收等待的字面量必须与生产日志一致。异常也完成 callback但不得报告健康恢复。 |
| 验证 | 首次命令 `scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.vs15.readiness-withdrawal-and-drain`：恰一条 BUSINESS 与一条 TDS CONTRACT；preflight 独立记录且失败时二者不执行。新增 `V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO` 必须同步加入 foundation `RuntimeEnvironmentKeys` exact-key test、shell/remote parser闭集与run manifest，作为验收控制键，不计入 TDS 应用配置的两项新runtime-key计数。preflight覆盖两个业务上下文、独立TDS、双classpath解析版本、REACTIVE、唯一metrics sink、共享DB/runId、真实HTTP/WS、10秒停库恢复和clean exit。该run的非默认TDS不承担V-S1默认节点断言。V-S15真实读取readiness与SESSION_READY/PING：非默认nodeId、4000ms withdrawal、8000ms acceptance drain；等待期旧会话PONG且新合法会话SESSION_READY并登记，等待后新连接得到REDIRECT_TO_NEXT_NODE；从HTTP readiness首次观察到非UP至关闭全部会话总上界14000ms（4000+8000+2000 observer/scheduler tolerance），从drain start起关闭界为8000ms。时序判定以真实HTTP readiness观察时间及其到admission-refused/drain-started标记的经过时间为准；readiness诊断日志异步写入，不作为排序时钟。仅核同一有序日志任务中的admission-refused先于drain-started。另一次默认配置run运行原有V-S1 CONTRACT probe：没有`V2S_TDS_NODE_ID`，以真实HTTP fixture helper激活终端，再以真实WS SESSION_READY与latest-state DB readback证明nodeId为`terminal-data-server`；场景结束经真实owner HTTP取消激活并readback。两种V-S1/V-S15配置分别报告。V-S9留在`operation=all`全量回归里，使用默认3000ms withdrawal、8000ms drain与2000ms tolerance（总上界13000ms），断言同一有序日志任务中的admission-refused→drain-started；再通过会话关闭与DB readback、TDS进程退出核实排空完成，不把异步readiness/drain-completed日志的文本先后作为验收依据。未知TDS scenario id/错误operation/缺topology preflight/calibration组合在远端启动前失败；bad-order red由lifecycle focused test证明；默认/非法配置、runner唯一nodeId用unit/runner tests。V-E6另证HAProxy摘流。 |
| CP 退出 | Gradle 实际解析的 Actuator artifact 与 classpath 版本、匹配该版本的官方 class/API 依据均记录；静态 key inventory及 focused tests完成；fresh CP-04三维 `MATCHED`。 |

### CP-05 · 受管 DEV 三 TDS/两 HAProxy/注入式 Node client

**RECALL**：需求 R-9.5、R-10.5、R-12、R-13、R-14、R-16、D-44/D-45/D-50；AGENTS 受管资源/远程拓扑/Testcontainers/DEV lifecycle；当前 runner/manifest/remote guard/tunnel code；official HAProxy 3.4 docs与registry image metadata；official Undici docs。读取已有 `r5-full` terminal fixtures contract，不变更 seed。CP-05只建立拓扑与入口；V-E1/E2/E5/E6场景文件和catalog闭包在CP-06完成。

| 项 | 计划 |
|---|---|
| Managed TDS | 扩 `scripts/dev/r5-dev-runner.mjs`，三个独立 TDS processes 共用获准数据库、独有 nodeId `tds-a/b/c`、端口、PID/start ticks/boot id/log/run id/RSS。每个节点与 aggregate budget 独立声明/计量；资源不足或不匹配 fail closed。 |
| HAProxy | 锁 `haproxy:3.4.6` registry digest；生成 run-scoped config SHA-256。两 loopback listener：entry1 round-robin 到 A/B，entry2 仅 C。健康检查直接从远端 HAProxy 请求每个节点 loopback readiness，GET expect 200；`defaults` 中的 `timeout connect 2s`、`timeout check 1s` 配合 `default-server inter 1s fall 1 rise 1 check`，按 HAProxy 3.4.6 官方语义，检查连接超时取 `min(timeout connect, inter)`，读取超时另计 1s，整体上界 ≤2s，TDS wait 3s。`timeout check` 是 section 指令，不得放入 `default-server` 的参数列表。用户入口按顺序用 `acl actuator_root path /actuator`、`acl actuator_tree path_beg /actuator/`、`http-request deny deny_status 403 if actuator_root or actuator_tree`，管理路径被拒；focused config proof 断言 `/actuator` 和 `/actuator/health` 经任一入口返回 403，节点 loopback readiness 仍为 200。容器 host networking on remote only；WS timeout tunnel 180s。Manifest 收纳 container id+image digest+host/boot/runId+config hash。只有 exact identity 能取日志/stop/remove；tunnel 只穿两个 LB listener。 |
| Node harness | `.mjs`受管入口只管理manifest、scenario与Vitest子进程，不直接`import`TER TS包。CP-03为新owner package建立仅包含`acceptance/**/*.test.ts`的Vitest config；普通`run-owned-tests.mjs`不承担远端联调。受管入口从实际workspace lock解析Vitest CLI，以精确文件及唯一suite/test标题选择场景。self-test用锁内实际Vitest 4.1.10 CLI执行`vitest list`，读取JSON结果，逐条断言catalog映射的文件与完整测试名恰好一个；无匹配与重复匹配的反例必须拒绝。过滤参数由实际列举证明，不靠源码字符串推断；JSON输出只写入OS临时目录，使用`--json=<绝对临时路径>`，不把可能被可选参数消费的位置文件路径放到`--json`之后。CP-05双composition与CP-06四个DEV场景分开登记。wrapper注入runId/scenarioId/phase JSONL sidecar；成功场景恰有一条`SCENARIO_STARTED`及一个fixture-cleanup PASS，缺失、损坏、跨run或cleanup FAIL均使fixture cleanup失败。fixture cleanup与进程/隧道/TDS/HAProxy cleanup分开记录。`terminal-ws-wire-client.mjs`只供TDS wire CONTRACT，不复制业务协议。 |
| fixture/secret | 本阶段仅从DEV当前受管`r5-full`终端fixture中选形态与设备闭集相同的laptop/mobile记录；Acceptance V-B15不用seed。任何已用fixture在场景末尾经真实backend owner HTTP取消激活；每次成功取消后再经公开详情HTTP读回同一terminalRef并断言`binding.status=INACTIVE`，全部成立后才发出fixture-cleanup PASS。失败时仅写安全枚举标记，不把cleanup记PASS。业务复原和进程/容器cleanup分开报。秘密只在内存使用，不进manifest/log/result/ws dump。DEV start/restart不seed；reset/seed按条件执行当前字节完整seed dry-run与对应准入。 |
| runner focused proof | local runner tests 验证三节点身份唯一、两个 listener只映射目标 backend、两个 tunnel不允许直连节点/PG/management port、没有按名称/端口停未登记进程、manifest digest/config hash/host identity mismatch拒控、cleanup逐个 resource归属。容器起停与 remote managed运行不得在静态 CP focused proof内执行。 |
| 真实场景 | V-E1/E2/E5/E6由CP-06创建真实 test 文件、完整场景名与catalog映射后，按整体动态验证计划逐个运行；CP-05不把计划中的场景名称当作当前可运行证明。 |
| CP 退出 | HAProxy source/version/docs约束、Node resolved package/runtime、manifest/tunnel/cleanup focused tests、当前 catalog 对应的真实 test file/完整名称与安全字段逐一核准；fresh CP-05 三维 `MATCHED`。V-E1/E2/E5/E6场景由CP-06新增并核验。 |

### CP-06 · 场景闭包与动态前准备

**RECALL**：详设 §11a/§13/§13b/§13c、批次二需求每条 V 项、implementation-task-template §6a/6b/6c/13c、verification governance、D-48 V-B15 已有 acceptance standard，review standard 与 blind-review governance。对每个 operation 重新确认 backend scenario file、现有 path identity、fixture、request、具体业务 oracle 和 focused/full runner；本批只补/扩既有 `*AcceptanceScenarios.java` group，不造 `performanceCriterion` 等退役字段。

| 项 | 计划 |
|---|---|
| CP-06 阶段入口检查 | 检查所有代码、生成产物、门与脚本的 owning diff；CP-06 退出前运行并记录 `scripts/verify --validate-only`，以及本 CP 的场景 catalog/runner focused proofs。不得在 CP 对账和整批 6b 之前运行默认 `scripts/verify` 或全量 `terminal-verify`：前者会启动受管远端 Testcontainers suites，后者执行整个 TER package suites；两者都属于 6b 之后的批次级回归。按已批准 CP 逐点记录前后双读与 focused proof。 |
| 批次级 6b | CP-01..06 每阶段 reviewer `MATCHED` 后，且在任何整体动态验收前，由新的 fresh read-only reviewer 对整批需求、详设、IA（无 UI-bearing IA时标 N/A 理由）、项目记忆规范逐项6b；所有跨 CP事实复核。OPEN 主 agent修复后再用 fresh reviewer复查。 |
| 条件式 reset/seed/L2 准入 | 本批没有浏览器 action，§3a 为 `N/A_WITH_REASON`；不要求空 action 分母取得 `L2_SCRIPT_ADMISSION=PASS`，也不改旧 L2 control plane。backend-acceptance 与不执行 reset/seed 的 DEV 不依赖虚构空分母或 seed dry-run。任何实际执行的 reset-only、seed-only 或 reset+seed，都须先有当前字节完整 `r5-full` seed dry-run PASS；reset 时 dry-run 必须在 reset 之前完成。CP 阶段对账和批次级 6b 始终必需；§3a 只对真实 L2 控件分母要求 admission，不制造空分母 PASS。资源身份、预算、日志与 cleanup 规则始终适用。 |
| 首次动态场景 | 第一次 managed run 精确执行上列 V-S15 命令：拓扑 preflight 与一条 TDS CONTRACT 场景必须都通过；同时只选择一个现有 BUSINESS operation。该 run 的 nodeId 显式非默认，不能充当默认 nodeId 的证据。V-S1 默认 nodeId 的 acceptance CONTRACT 另行运行，`V2S_TDS_NODE_ID` 不设置；先后次序不得依赖 BUSINESS 测试顺序。 |
| 动态顺序 | V-S15 首次受管 run（含 topology preflight）并 PASS+cleanup → 默认配置 V-S1 acceptance proof PASS+cleanup → package/Node focused tests → existing Expo Web V-T17 before any non-adapter app/device tests（本批不跑 Android/VM）→ 受管 DEV 按单场景 V-E1 → V-E2 → V-E5 → V-E6 → 剩余验证回归。全部适用动态验收的 business 与临时运行 cleanup PASS 后，执行当前最终字节完整 `r5-full` seed dry-run → 非生产 reset → DEV start → 完整 seed。若任何其他步骤要先做 reset/seed，同样先取得当前字节 dry-run PASS；不执行 Browser L2，§3a 为 N/A_WITH_REASON。业务 CONTRACT/BUSINESS/DB_OPERATIONS/fixture 复原/cleanup 分开；动态全量只在先行 focused proof 通过后。 |
| DEV场景闭包（CP-06） | `terminal.dev.lifecycle-and-compression` → `acceptance/devScenarios.test.ts`; suite `terminal-data-client managed DEV end-to-end scenarios`; test `terminal-data-client managed DEV lifecycle activates, receives heartbeats and latency, survives backend cancellation, reactivates and cancels online`：断言握手后的 `WebSocket.extensions` 实际包含 `permessage-deflate`、3 次心跳、RTT owner readback、后台取消/本地清除、同码重激活及在线设备取消。`terminal.dev.three-node-two-entry-handoff` → 同文件；suite `terminal-data-client managed DEV end-to-end scenarios`; test `terminal-data-client managed DEV drains node A, fails node B to entry two, and does not fail back after restart`：每阶段核验 client nodeId、PostgreSQL latest row 与 sessionId，证明入口一分流 A/B、优雅 drain A、B 故障后走入口二到 C、取消单台而其他会话不变、重启 A/B 超过首个 10 秒退避仍不 failback，且已取消客户端保持 inactive/disconnected、无新 owner 会话。E2/E5 继续按详设表。self-test经锁内Vitest `list --json=<OS临时报告路径>`逐条证明五个catalog项各只匹配其唯一文件/测试名，并对零匹配与重复匹配置红。每个已用fixture取消后均重新经业务HTTP读回同一terminalRef且`binding.status=INACTIVE`，该读回结果是`SCENARIO_CLEANUP_PASS`的必要条件。sidecar恰有一条同runId/scenarioId的`SCENARIO_STARTED`与一个fixture cleanup结果；fixture cleanup、业务结果与managed process/resource cleanup分列；不把CP-05双composition focused test冒充V-E场景。 |
| 13c/逐代码（CP-06退出后的批次级收口） | 全部适用动态验收与最终 reset→DEV start→seed 关闭后，逐项证明生产类型/方法有调用方或具名入口；每个生成物有唯一 producer；每个 producer有具体输出。逐文件、逐生产符号、逐新增/修改代码行与详设约束对账，逐条列 path/symbol/criterion/result。结论只 `MATCHED`/`OPEN`；不得抽样、不得用CP三维对账代替。 |
| 批次级整批 adversarial review（CP-06退出后的批次级交付收口） | 13c `MATCHED` 后由 fresh 子 agent `REVIEW_TARGET=IMPLEMENTATION` 按详设攻击真实 production code、真实场景与当前 bytes；每项指详设位置+实现位置。设计中无判据者记`DESIGN_GAPS`并按授权边界处理，不在实现里自创产品语义。主 agent intake 后修复 finding 并 fresh 复核。之后提供 static review request 给 Dexter 与 Claude；13c `MATCHED`之前不得 handoff。 |

**CP-06 退出**：完整判据表有对应真实执行入口与场景 ID；场景/runner 改动、CP-06 focused proof 及该阶段静态入口检查完成；CP-06 阶段三维对账 `MATCHED`。整批 6b 在 CP-06 退出后单独完成，且在整体动态验收之前；动态结果、cleanup、13c 和整批 implementation review 均属于批次交付收口，不构成 CP-06 的退出条件。

## 4 · 动态执行顺序与资源安全

| 阶段 | 进入条件 | 范围/输出 | 未通过处理 |
|---|---|---|---|
| local focused | 对应 CP 的所有 RECALL 完成，当前字节源码与 fixture 已静态核对 | owner/actor/selector/client/generator/config/TDS unit and structure tests；每次读取实际 log | 保存 first failure，归一化 failureCategory；同一类第二次出现冻结其后场景，用同一 proof根因修复后继续 |
| CP 阶段对账 | 本 CP 所有修改+focused proof完成 | fresh独立三维需求、详设/IA、memory规范逐项 MATCHED | OPEN 修复后 fresh复查同一完整 CP，不能进入下一CP |
| 完整6b | CP-01..06全MATCHED | fresh独立读全批需求、详设、IA适用性、memory规范；不合并旧结论 | OPEN根因修复并复查 |
| V-S15 acceptance | 6b MATCHED；闭集 selector/manifest tests通过；拓扑预检 phase 的两个业务上下文、独立 TDS、解析版本、REACTIVE 类型、单度量 sink、共用 DB/run identity、真实 HTTP/WS、10 秒受管停库恢复、clean exit 全部通过 | 一个 BUSINESS + 一个 TDS CONTRACT：真实 readiness 从 UP 转非 UP；4,000ms wait 期间旧 PONG 与新 SESSION_READY/登记成立；wait 后拒新；8,000ms drain 内关闭旧与 wait 期间登记会话；从 withdrawal 起总上界 14,000ms。CONTRACT、BUSINESS、DB_OPERATIONS 与 cleanup分开报告；默认节点证明另行走 V-S1。 | 按 failure family closure，同一 failureCategory 第二次即冻结后续动态场景 |
| Dynamic pre-admission | 仅在具体获授权运行实际包含 reset/seed/L2 时按动作执行适用准入；本批无新 Browser L2 action，§3a=`N/A_WITH_REASON` | 不改旧 L2 control plane，不要求空分母 PASS。backend-acceptance 与无 reset/seed 的 DEV 不需要空分母 admission 或 seed dry-run。CP 阶段对账和批次级 6b 始终保留；真实 L2 才要求其控件分母 admission；任何 reset-only、seed-only 或组合动作都须先有当前字节完整 `r5-full` seed dry-run PASS，reset 时必须先于 reset。 | 无对应动作时不执行虚构 admission；每次受管运行的资源身份、预算、日志与 cleanup 条件不变。 |
| 受管 DEV preflight | 批次级 6b `MATCHED`；首次运行一个场景；remote resource/process/container manifests符合AGENTS。仅当该具体步骤实际包含reset/seed/L2时，另满足其对应前置准入 | 三TDS唯一身份、两HAProxy、两tunnel、Node runtime/package resolved versions、real HTTP/WS、remote logs、budget、single scenario和clean exit | 未知identity/资源拒绝；禁止端口/名称猜测；资源门与TER UI资源门各自独立 |
| V-E series | V-E1首场景PASS+cleanup PASS | E1,E2,E5,E6各按表独立运行并报告；全完成后只需当前字节的必要回归，不得通过变场景避失败 | first failure保留；源码未变不重跑；清理在业务之后单报；cleanup非PASS不继续运行新的 managed scenario |
| Delivery | 当前字节完整动态证据、所有review/对账完成 | 详设、计划、命令真实输出与log redaction/cleanup/runner manifests | 有 OPEN/cleanup failure则报告未就绪，不以旧 bytes证据代替 |

受管运行规则：先记录本机/远端/容器 owner identity 和各自 rss/resource budget；远端 PID 必须匹配 host/boot id/start ticks，容器匹配 id/image digest/runId/config hash。held run期间不改 `apps/backend` 或 `apps/frontend`。任何数据库停机只调用授权的受管 harness action；不得手工通知 DB、按端口停进程或直接写库。DEV stop/restart遵循 AGENTS Testcontainers联动：若预检确认 manifest-owning DEV正在运行，先记 `DEV_WAS_RUNNING=true` 并受管 stop+cleanup PASS，再 Testcontainers；仅当 business及cleanup PASS后 restart 当前字节 DEV；原无 DEV或测试失败不擅自启动。受管验收使用上述联动规则；最终授权的 reset→DEV start→seed 则按§4的独立次序执行，DEV start 不 seed。

## 5 · 输入/输出清单与角色

| CP | 主要新增/修改路径（未来实施） | 不改动/保留 | 实际调用入口 |
|---|---|---|---|
| CP-01 | `contracts/policy/terminal-client-generation.json`、TER client generated output、edge generator/test/checker、skeleton graph/checker/test、R-12 anchors | backend routes/operationId/security/error set、admin generated bytes、`tdp=FORBIDDEN` seed assertion、batch3 files | `openapi-contracts`、`terminal-verify` |
| CP-02 | `kernel/base/server-config/**`、`kernel/base/state/**` reset descriptor/runtime、TR-09 exception anchor | terminal credential唯一owner；other owners；protected store contract | `terminal-verify` |
| CP-03 | `platform-ports/**`、`transport/**`、`terminal-data-client/**`、TER package dependency & lock resolution | terminal UI/actions、native adapters行为（仍 unavailable）、batch3 network sync | `terminal-verify`, `THCL-04-node-tests` |
| CP-04 | `terminal-data-server/build.gradle.kts`, `application.yml`, `TdsRuntimeProperties.java`/`TdsRuntimeSettings.java`/`TdsGracefulShutdownLifecycle.java` 与对应 `TdsRuntimeSettingsTest.java`/`TdsGracefulShutdownLifecycleTest.java`；`TdsAcceptanceProcess.java`, `TerminalConnectionContractScenarios.java`, `BackendAcceptanceTest.java`; `scripts/test/backend-acceptance`, `scripts/test/backend-acceptance-structure.test.mjs`, `scripts/test/r5-remote-testcontainers.mjs`, `scripts/test/r5-remote-testcontainers.test.mjs`; runtime-key inventory/count | database schema/Flyway/seed/TDS business owner；V-S15 不进 business operation catalog/denominator | TDS tests, backend-acceptance |
| CP-05 | existing `scripts/dev/r5-dev-runner.mjs`/remote manifest/guards; shared DEV/acceptance lock; new `scripts/test/terminal-client-dev-acceptance.mjs`; THCL-04 registration and `scripts/README.md` invocation; focused tests | `terminal-ws-wire-client.mjs` wire contract use, DB tunnel prohibition, no direct TDS tunnel | runner guard tests, exact Node package-resolution proof, managed DEV scenarios |
| CP-06 | acceptance scenario expansion/recorded review evidence and output artifacts | generated scenario contract and retired provider fields | `scripts/verify`, `terminal-verify`, acceptance and managed scenario entry points |

本次 Dexter 授权已覆盖列明的批次二实现及适用验证；main agent 是所有路径的唯一写入者。CP reviewer、6b reviewer、13c reviewer 与独立 `REVIEW_TARGET=IMPLEMENTATION` reviewer 只读。测试与 runner 代码不得绕过 owning API 写生产业务状态。

## 6 · 业务验收场景定义

批次二不新增 backend HTTP route、OpenAPI `operationId` 或 generated-operation budget identity，但因要求核对现有端点对未知字段的行为，须按主动标准扩展现有 owning group，而不是为每个 variant 创建新 route 或另一个 registry。V-B15 会新增一个唯一 backend-acceptance `module.operation` 场景选择键；这是验收 catalog 的业务场景，不进入 API operation catalog 或 DB operation budget。

**V-B15 scenario group**：在当前真实 class path 找到并扩展既有终端激活 acceptance scenario class。Intent 固定为：

- `identity`: HTTP operation pair `activateTerminal` / `cancelTerminalActivation`，现有 `terminal` face；验收 scenario `id/module.operation` 为 `storeTerminalActivationUnknownFields` / `TERMINAL_BINDING.storeTerminalActivationUnknownFields`；后者只用于 `--operation` 选择该场景，不是 OpenAPI `operationId`、路由 identity 或 generated-operation budget identity；
- `fixture`: 由现有 `createConnectionContractFixture` acceptance helper 通过真实业务 HTTP command 创建/激活本次 fixture；不读 `r5-full` seed，不手工写库造事实；请求体只在场景内存构造。
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
2. CP-01～06 各自三维 `MATCHED` 后，整体动态运行之前另有 fresh 6b `MATCHED`。本批 §3a 为 `N/A_WITH_REASON`，不制造空分母 admission；不执行 reset/seed 的 backend-acceptance/DEV 不要求 seed dry-run。任何实际执行的 reset-only、seed-only 或组合动作都须先有当前字节完整 `r5-full` seed dry-run PASS，reset 时必须先于 reset。真实资源身份、预算、日志和 cleanup 仍是每次受管运行的必备条件。
3. 详设 §11a 每行都有执行入口、场景 ID 和分离 evidence channel；所有适用场景在当前字节运行，V-S15/V-E 都是实际远端/真实 HTTP/WS 证据而非 unit 模拟。
4. `scripts/verify --validate-only` 在 CP-06 退出前出具静态门结果；CP-01～06 与整批 6b MATCHED 后，再运行默认 `scripts/verify`、全量 `terminal-verify`、既有 Node suites、V-S15、V-B15、V-T17、V-E1/E2/E5/E6，并按各入口分别记录真实输出与耗时。默认 `scripts/verify` 的远端 Testcontainers suites 按受管生命周期逐个执行；不得为满足 CP 阶段退出而提前启动这些运行，也不得重复已注册测试。
5. V-T selectors 测试从真实 owner command、`SESSION_READY`、`PONG` 事件到 selector 读值；没有“方法存在即覆盖”证据。
6. 当前 bytes 的日志、输出、secrets marker 与所有 owned resources cleanup PASS；两行运行状态有真实 run ids/time/bytes status。
7. 13c逐代码与详设对账全量 `MATCHED`，fresh 独立批次二 `REVIEW_TARGET=IMPLEMENTATION` 已完成并由主 agent处置；Dexter/Claude static review handoff request依模板检查通过。
8. 交付范围只有批次二；实现期若遇产品语义缺口、超资源边界或要求改需求，停在对应处置边界，不延伸批次三。

上述均是批次二交付的完成条件；它们在执行前不是 PASS 证据。当前授权为先修复 S-1/N-1 并回读一致，随后连续实施、验证与最终交付收口；历史 DESIGN verdict 只绑定其审查时的静态字节。

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
| 当前授权、用户目标、Dexter阶段意图 | PRESENT | 元数据、§0、CP/动态/最终 reset→DEV→seed步骤；明确范围外事项与证据档位 |
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
| explicitly named `逐代码与详设对账` | PRESENT | CP-06 退出后的批次级交付收口；逐行全改动，MATCHED/OPEN |
| 整批 fresh IMPLEMENTATION review | PRESENT | CP-06 退出后的批次级交付收口 |
| 第三方版本与版本匹配官方资料 | PRESENT | 详设 §3.1，CP-03～05复核与focused proof |
| 动态、资源、日志、cleanup纪律 | PRESENT | §4、§7 |
| 超范围和停机边界 | PRESENT | §0.3、§1.2、§4 |
