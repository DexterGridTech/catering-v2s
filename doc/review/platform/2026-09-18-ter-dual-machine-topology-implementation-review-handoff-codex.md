# TER 双机拓扑 implementation review 复评交接

REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=IMPLEMENTATION_REVIEW_HANDOFF
IMPLEMENTATION_STATUS=READY_FOR_INDEPENDENT_REVIEW
EVIDENCE_STATUS=SOURCE_REMEDIATION_FOCUSED_AND_NATIVE_SUPPORTING;EXISTING_DYNAMIC_EVIDENCE_NOT_RERUN
ACCEPTANCE_STATUS=NOT_CLAIMED
REMEDIATION_SCOPE=M-1_TRANSPORT_PRIMITIVES_AND-S-1_CANONICAL_CONFIG

## 背景

上一轮 implementation review 记录在
`doc/review/platform/2026-09-18-ter-dual-machine-topology-implementation-review-claude.md`，结论为
`NO-GO,M/S/N=1/1/3`。核心双机业务与阶段一/阶段二的既有设备证据没有被本轮否定；卡点是
transport README/详设/计划声称的能力不在源码，以及 43172/basePath 在多个生产与工具位置重复。

本轮已在既有 implementation 授权内完成两项根因修复：

1. 保留需求 R-7 的通用 transport contract 范围，在 transport owner 内补入真实的配置解析、
   address failover/sticky、bounded retry/cancel/attempt metrics、heartbeat、concurrency/rate limiter、
   WebSocket profile/replaceServers/connection-token 原语；identity client 改为消费既有
   `TransportServerConfig` projection。README、详设、计划和 public-surface invariant 已同步。
2. 把 production topology port/basePath、timeout/heartbeat/reconnect bounds 收进 contracts 的
   `topology-transport.config.json`，TS projection、topology、admin-shell、Kotlin host 和 runner
   均从该住址或其运行时投影取值。Kotlin 不再保留默认端口；`start(...)` 传入的 JS `HostConfig`
   是 native host 的实际配置。runner 的 `hostBridgePort=43173` 是 ADB bridge，刻意不等于
   production topology port。

本轮没有重新启动设备或 runner。既有阶段一/阶段二运行使用的 canonical 值未改变，动态证据仍按
原始档位保留；本轮新增 transport 通用多地址行为只由 focused contract proof 支撑，U-15 的
真实多地址 runtime 行为仍为 `scope-open`。因此本交接不声称 implementation acceptance、
release PASS、visual 全局 PASS 或新的设备 PASS。

## 评审目标

请独立复核当前源码和本轮修复是否真正关闭上一轮 M-1/S-1：

1. transport 新增能力是否是可执行的真实 owner，而非 README 或类型名；identity client 是否真实
   消费既有四类 transport config contract；`replaceServers` 是否使旧 connection token 失效；
2. canonical JSON 是否是 production port/basePath 等固定事实的单一住址，TS、Kotlin、admin 文案
   和受管 runner 是否没有复制旧字面量；
3. 修复是否保持双机 topology 的既有业务行为、单 IP 业务边界、U-15 scope-open 和旧设备证据
   的 evidence-tier 诚实性；
4. 对账文档是否准确区分 source/focused/native supporting 与未重跑的动态证据。

## 需阅读文件

- `doc/review/platform/2026-09-18-ter-dual-machine-topology-implementation-review-claude.md`：上一轮 M-1/S-1 finding；
- `doc/review/platform/2026-09-17-ter-dual-machine-topology-implementation-reconciliation-codex.md`：本轮修复后的逐代码/详设对账及 U-15 边界；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md`：R-7/R-8 与 transport 范围；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md`：详设 §10.3、D-4、U-15；
- `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md`：CP-1/CP-2 transport 落点；
- `apps/terminal/kernel/base/contracts/topology-transport.config.json`：canonical port/basePath/timeout/heartbeat/reconnect 配置；
- `apps/terminal/kernel/base/contracts/src/foundations/topologyTransportConfig.ts`：typed config 与 `TransportServerConfig` projection；
- `apps/terminal/kernel/base/transport/src/foundations/resolveTransportServerAddresses.ts`：配置解析、ordered address、override 与 sticky；
- `apps/terminal/kernel/base/transport/src/foundations/createTransportRetryController.ts`：bounded retry、cancel、attempt metrics；
- `apps/terminal/kernel/base/transport/src/foundations/createTransportHeartbeat.ts`：序号 ping、pong 进度与超时回调原语；
- `apps/terminal/kernel/base/transport/src/foundations/createTransportLimiter.ts`：并发与最小启动间隔限制；
- `apps/terminal/kernel/base/transport/src/foundations/createTransportWebSocketController.ts`：profile、failover、replaceServers 与 stale token；
- `apps/terminal/kernel/base/transport/src/foundations/createTopologyIdentityClient.ts`：identity client 的 config selector 消费；
- `apps/terminal/kernel/base/transport/test/transportPrimitives.test.ts`：新增真实 red/behavior focused fixture；
- `apps/terminal/kernel/base/transport/test/identityClient.test.ts`：identity client config/failover focused fixture；
- `apps/terminal/kernel/base/topology/src/features/actors/actors.ts`、`apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`：真实 topology consumer；
- `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`：端口占用文案 projection；
- `apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx`：admin locator projection；
- `apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyHostRegistry.kt`：native host runtime config；
- `tools/terminal-topology/run-dual-device.mjs`：canonical JSON 读取与 ADB bridge 分离；
- `apps/terminal/kernel/base/transport/README.md`：与源码同步的 transport owner 说明；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md`：既有阶段一/二运行与 cleanup 档位；
- `doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp1-execution-codex.md`、`doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp2-execution-codex.md`：transport/native supporting 命令结果；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/verification-governance.md`：证据与独立复核边界。

## 本轮验证结果

| 验证 | 结果 | 说明 |
|---|---|---|
| contracts typecheck/test | PASS | typecheck 通过；contracts focused 22 tests 通过 |
| transport typecheck/test | PASS | typecheck 通过；transport focused 3 files / 10 tests 通过，含 heartbeat red/behavior fixture |
| topology typecheck/test | PASS | focused 18 tests 通过 |
| admin-shell typecheck/test | PASS | focused 9 files / 20 tests 通过 |
| `yarn --cwd apps/terminal verify:static` | PASS | `TERMINAL_STATIC=PASS`；预期 mutation 行的 FAIL 未被误报为门失败 |
| assembly-base-android typecheck/test | PASS | typecheck 与 1 个 focused test 通过 |
| sample-terminal Kotlin compile | PASS | `:app:compileDebugKotlin` / `BUILD SUCCESSFUL` |
| sample-wallpaper-terminal Kotlin compile | PASS | `:app:compileDebugKotlin` / `BUILD SUCCESSFUL` |
| 动态设备/runner | 未重跑 | 阶段一/二既有证据保留；本轮不新增设备 PASS |

本轮 focused 首败是 `transportPrimitives.test.ts` 的测试时序：`replaceServers` 在慢 connector
真正进入前被调用，导致 stale-connection 夹具没有覆盖目标路径。修复为等待
`connectorStarted` 后再替换 server，随后 transport focused 以 9/9 通过。该首败属于测试夹具
的可达性，不是 production transport 失败；原始失败与修复后的结果均应由评审从当前 test 代码
重跑核实。

## 独立核验重点

1. 不要只读 README 或 public export：让 `TransportServerConfig` 传入两个地址，亲验 selector
   顺序、成功地址 sticky、override、retry/cancel/metrics、heartbeat 的 ping/pong/timeout、limiter、WS failover 与
   `replaceServers` 的旧连接失效；确认 `createTopologyIdentityClient` 不再拼接固定地址。
2. 对 `43172`、`/terminal-topology`、heartbeat/timeout/reconnect bounds 做源码检索：canonical
   JSON 应是唯一配置源；`TerminalTopologyHostRegistry` 不应有默认生产端口，JS `start` 投影是
   native 实际配置；runner 的 43173 只应属于 ADB bridge。
3. 复核 `apps/terminal/kernel/base/contracts/terminal-invariants.json`、transport invariant、
   README、详设和计划的 public surface/能力声明与当前源码逐项一致。
4. 保留上一轮动态边界：U-15 的多地址真实业务消费者未验证；本轮 focused proof 不能升格为
   设备/发布行为。既有阶段一/二 evidence 不能被文字改写成“在本轮修复源码上重新运行”。
5. 复核本文件与 reconciliation 的 M-1/S-1 处置是 `MATCHED` 还是应保留 `OPEN`，并检查是否
   出现计划外生产落点、重复端口事实、README 示例与源码不一致或未声明的证据升级。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。
每条 finding 请区分仓内源码事实、验证事实、推论与尚缺证据的假设，给出仓库相对路径、
精确 symbol/行号、影响面、最小修复建议及是否需要 Dexter 裁决。`GO` 仅表示本轮
implementation review 覆盖范围内的独立结论，不等于产品 acceptance、release PASS 或 visual
全局 PASS；U-15 的 scope-open 必须保留。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 双机拓扑 implementation 的 M-1/S-1 修复做独立复评。

背景：上一轮 implementation review 记录在 doc/review/platform/2026-09-18-ter-dual-machine-topology-implementation-review-claude.md，结论为 NO-GO，M/S/N=1/1/3。核心双机业务与既有阶段一/阶段二设备证据没有被本轮否定；本轮已修复两项源码与账面不一致：一是在 transport owner 内补入真实的 config/address selector、ordered failover/sticky、bounded retry/cancel/attempt metrics、heartbeat、limiter、WebSocket profile/replaceServers/connection-token 原语，并让 identity client 消费 TransportServerConfig；二是把 production topology port、basePath、heartbeat、timeout、reconnect bounds 收进 contracts/topology-transport.config.json，TS、admin、Kotlin host 和 runner 均从 canonical source 或运行时投影取值。原始阶段一/阶段二设备证据本轮没有重跑，U-15 的真实多地址 runtime 行为仍 scope-open。

目标：请判断 M-1 与 S-1 是否被真实源码修复，README/详设/计划/public-surface 是否与源码一致，新增 transport focused proof 是否能逮住对应缺陷，以及本轮是否错误地把 focused/static/native supporting 或旧设备证据写成 implementation acceptance。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-09-18-ter-dual-machine-topology-implementation-review-claude.md：上一轮 findings；
- doc/review/platform/2026-09-17-ter-dual-machine-topology-implementation-reconciliation-codex.md：本轮逐代码与详设对账、M-1/S-1 处置、U-15 scope-open；
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md：R-7/R-8 与 transport 边界；
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md：详设 §10.3、D-4、U-15；
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md：CP-1/CP-2 落点；
- apps/terminal/kernel/base/contracts/topology-transport.config.json：canonical 配置；
- apps/terminal/kernel/base/contracts/src/foundations/topologyTransportConfig.ts：typed projection；
- apps/terminal/kernel/base/transport/src/foundations/resolveTransportServerAddresses.ts、createTransportRetryController.ts、createTransportLimiter.ts、createTransportWebSocketController.ts、createTopologyIdentityClient.ts：真实 transport owner；
- apps/terminal/kernel/base/transport/test/transportPrimitives.test.ts、apps/terminal/kernel/base/transport/test/identityClient.test.ts：focused red/behavior proof；
- apps/terminal/kernel/base/topology/src/features/actors/actors.ts、apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts、apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts：真实 consumers；
- apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx：admin projection；
- apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyHostRegistry.kt：native host config；
- tools/terminal-topology/run-dual-device.mjs：canonical JSON 与 ADB bridge；
- apps/terminal/kernel/base/transport/README.md：owner 文档；
- doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp1-execution-codex.md、doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp2-execution-codex.md、doc/evidence/platform/2026-09-17-ter-dual-machine-topology-cp5-execution-codex.md：focused/native supporting 与既有动态 evidence；
- project-memory/decisions/deterministic-context-only.md、project-memory/operations/verification-governance.md：复核与证据边界。

请重点独立核验：
1. 用两个地址的 TransportServerConfig 亲验 selector 顺序、override、sticky、bounded retry/cancel/metrics、heartbeat ping/pong/timeout、limiter、WS failover、replaceServers 与 stale connection-token；确认 identity client 不再写死地址。
2. 检索 43172、/terminal-topology、heartbeat/timeout/reconnect bounds，确认 canonical JSON 是唯一固定事实住址；Kotlin 不保留默认生产端口，JS start config 是 native 实际配置，runner 的 43173 只属于 ADB bridge。
3. 逐项核对 contracts invariant、transport README、详设、计划与当前 public exports；不要只按文件名或测试名判定。
4. 保留 U-15 scope-open，不把 focused proof 升格成真实多地址业务 runtime 或新的设备 PASS；旧阶段设备结果不得被写成在本轮修复源码上重新运行。
5. 复核上一轮 transport 首败是否确实是测试夹具可达性问题，及当前 9/9 focused 结果能否逮住对应缺陷。

请给出 GO 或 NO-GO，并报告 M/S/N。每条 finding 请区分源码事实、验证事实、推论和未证假设，给出仓库相对路径、精确 symbol/行号、影响面、最小修复建议，并标明是否需要 Dexter 裁决。

授权边界：本次只请求 REVIEW_TARGET=IMPLEMENTATION 的独立复评；不授权扩大双机拓扑需求、不授权把 U-15 scope-open 改成已验证、不授权把 review GO 写成 implementation acceptance、release PASS、visual 全局 PASS 或产品验收 PASS。谢谢。
```

## 授权边界

本交接只请求 Dexter 与 Claude 对当前实现及本轮 M-1/S-1 remediation 做独立复评。没有新的
产品/Journey/范围裁决，也没有重跑设备、Web、release 或部署动作。评审前不宣称
implementation acceptance；若评审发现当前源码或证据仍不闭合，必须保留 `OPEN` 或给出
`NO-GO`，不能用 focused、退出码、文件存在或旧设备记录替代业务结论。
