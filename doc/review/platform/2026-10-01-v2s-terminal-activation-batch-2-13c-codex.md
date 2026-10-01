# 终端激活与长连接·批次二 13c 逐代码对账

日期：2026-10-01  
目标：批次二详设与实施计划 13c；对当前字节建立逐代码核验索引。  
范围：TER `server-config`、`transport`、`terminal-data-client`，既有终端 HTTP schema/生成链，TDS 协议资源链与本批 acceptance/DEV 场景。  
排除：批次三、多节点生产拓扑扩展、Android/物理设备与 UAT。  
作者状态：fresh 独立 reviewer 已判 `13c=MATCHED`，`M/S/N=0/0/1`。本记录提供逐项来源与证据映射；最终结论来自独立复核，不由作者预先宣布。

## 1. 阶段与证据边界

CP-01～CP-06 的既有阶段对账不在本记录中重跑或重判；此前已完成的全批 6b 也不重复执行。参考 [6b 记录](2026-10-01-v2s-terminal-activation-batch-2-6b-reconciliation-codex.md)。本记录只补齐详设 §13c 要求的逐生产符号、生成链、依赖图和判据映射，供独立复核。

本轮最后一次当前字节终端验证：

- `ter-local-59258-1790846371503`：`yarn workspace @catering-v2s/terminal run verify`，`TERMINAL_VERIFY=PASS`；静态阶段、29 个 package tests、31 个 package lint / 579 个文件、Android JVM `testDebugUnitTest`、Expo Android bundle/export 均通过，运行清理通过。Android JVM 与 bundle/export 不是设备运行证据。该 run 已包含 runtime 异步资源释放注册表、transport disposer 与对应包级测试；其后仅修改 acceptance 测试清理调用以 await 新 API。
- 类型与 focused 测试：`@catering-v2s/kernel-base-terminal-data-client` typecheck 通过；6 个测试文件、19 个测试通过。
- 异步资源释放后的当前字节受管 Node 场景：双 composition 隔离 `ter-client-dev-1790847163804-76194-f8ad34dd-7d73-4deb-a065-e56506f31317` 与 E1 生命周期 `ter-client-dev-1790847169393-76450-46ac12b2-81e1-4d40-a633-94d7b87e7a03` 均 `BUSINESS=PASS; FIXTURE_CLEANUP=PASS; CLEANUP=PASS`。E1 覆盖共享 scenario-client disconnect/finally-await-release 与 afterEach 清理；双 composition 覆盖两个 runtime 的独立清理。此前 E2/E5/E6 的 run 仍为 PASS，但先于本次 acceptance 清理调用改动，故只作为历史业务证据，不标作当前字节证明；本次仅修改三场景共享的 teardown，而没有改其业务步骤或断言，避免为相同 teardown 重跑无额外证明价值的场景。
- 对应早先 E1 Node run 启动的受管 DEV：`r5-dev-1790847061667-72984-3f7d7705-e520-42ac-8479-1e3e247b59aa`，`R5_DEV_START=PASS`；三 TDS 节点均 ready，三个本机受管进程与 tunnel 已登记。该次 Node run 当时没有 reset 或重跑 seed。随后在 §8 完成了本批最终授权的 reset→DEV start→完整 seed；§8 的 seed 与 DEV run supersede 此处历史摘要。
- backend-acceptance 全目录此前通过：199/199 BUSINESS、49/49 TDS CONTRACT、296/296 operation identity，业务与临时资源 cleanup 均 PASS。该运行早于本轮 terminal-data-client close-reason 类型收窄；本轮对受影响客户端路径已由 E1/E2/E5/E6 与终端 verify 覆盖。不得将早先验收误写成与最终全部字节同一 run。
- `scripts/verify --validate-only` 与默认 `scripts/verify`、V-S15/V-S1 默认 nodeId 等历史通过结果按各自原 run 保留；本记录不将它们伪称为本轮重跑。当前 terminal verify 和 managed DEV run 覆盖了最后的 client close-reason 修正。

- root `scripts/verify` run `r5-verify-69267-1790842907944` 被主 agent 有意中断，没有 `PASS` 结论；其启动的 catalog Testcontainers 子运行 `r5-tc-1790845087502-32304` business 与 cleanup 均 PASS，DEV restore PASS。它部分执行的其它模块门不作为完整 root verify 证据。本轮最新改动只影响 TER runtime 异步资源释放与 Node acceptance teardown；相关终端 aggregate 与两个受影响的代表性 managed Node proof 已通过，因此不重跑不受影响的后台大套件。

本轮终端验证后，补跑了 fresh reviewer 指出的 V-B15 当前字节缺口：

- `r5-tc-1790840460165-42576`（2026-10-01 07:41:00Z～07:45:59Z）：受管远端 backend-acceptance，精确执行 `storeTerminalActivationUnknownFields`。manifest `testExecution=PASS`、`backendAcceptance.operation` 与请求场景一致；报告 `DISCOVERED=199 SELECTED=1 HTTP_SUCCESS=1 REAL_BUSINESS_ASSERTIONS=1`，该场景 `CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=9`。同一 run 的 TDS contract 为 `DISCOVERED=1 PASS=1 FAIL=0`。真实独立 TDS 为 `REACTIVE`，readiness RSS 266732 KiB / 停止前 RSS 297512 KiB，低于 512 MiB 预算。远端进程、工作区、Testcontainers 容器与卷 cleanup 均 PASS；运行前 DEV_WAS_RUNNING=true，受管 stop 与测试后 restore 均 PASS。详证位于 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790840460165-42576/` 的 run manifest、Gradle 日志、acceptance 结果及归档索引。
- 截至 V-B15 专项核验时的最新受管运行：`r5-tc-1790840460165-42576`，2026-10-01 07:41:00Z～07:45:59Z，PASS（业务与 cleanup 均 PASS）。
- 该项最后一次通过：同上；仅证明 V-B15 单场景，不是全目录 backend-acceptance，也不表示 TER 后续改动已纳入该 run。

最终 client close-reason 修正的当前字节 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `apps/terminal/kernel/base/terminal-data-client/src/types/client.ts` | `499052b8a80723f83b244d6a58e027f88814115e6b40fcb364e8603ae1b3a276` |
| `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts` | `8c3f3c3f1fb8ec96589e06b28b4f578582afac35561d6ef765666b640d9a05d4` |
| `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts` | `5d52cad62e717c3478333ef8b71b02c4768af8df7e55930ab341a7d044052435` |

## 7. Final affected-byte proof and disposition

The earlier runtime fix adds asynchronous runtime-owned cleanup so transport can await bridge/connection disposal. The earlier TER aggregate run is historical for the later timer/connection-disposal corrections. The late acceptance changes are now covered by the focused Node package suite and the current managed E1 run; the older double-composition run below is retained as historical evidence, not labeled current-byte:

| Managed run evidence | Scenario | Business | Fixture cleanup | Runner cleanup |
|---|---|---|---|---|
| `ter-client-dev-1790847163804-76194-f8ad34dd-7d73-4deb-a065-e56506f31317` (historical source before final disposal correction) | `terminal.client.multi-instance-isolation` | PASS | PASS | PASS |
| `ter-client-dev-1790848486403-6005-ec2176f8-da4a-4456-972e-ac1b9e188334` (current source) | `terminal.dev.lifecycle-and-compression` (E1) | PASS | PASS | PASS |

The Node runner resolved Node `v24.13.0`, Vitest `4.1.10`, and Undici `8.11.2` in both runs. Their manifests bind the runs to managed DEV `r5-dev-1790847061667-72984-3f7d7705-e520-42ac-8479-1e3e247b59aa`. Current DEV start passed with all three TDS nodes ready and HAProxy locally hosted on the remote machine; it remains running for review. The E1 wait for three heartbeat samples is an explicit test assertion (up to 125 seconds), not an infrastructure hang.

The full root `scripts/verify` invocation `r5-verify-69267-1790842907944` was interrupted by the main agent before completion; it has no PASS verdict. Its already-started catalog Testcontainers child `r5-tc-1790845087502-32304` completed with business, cleanup, and DEV restore PASS. The broad root command is not repeated because the final source delta is confined to TER runtime/transport lifecycle and TER acceptance teardown, and the current `terminal-verify` plus the two affected managed acceptance paths cover those consumers. Backend acceptance, Java/TDS, schema generation, reset/seed inputs were not modified by this delta; their last passing evidence remains explicitly historical where listed above.

Current affected source hashes:

| File | SHA-256 |
|---|---|
| `apps/terminal/kernel/base/runtime/src/foundations/createRuntimeResourceRegistry.ts` | `7ac32a7194eda41d0373566069144a3c1e0f61eaac84dea1fbf83558e405bf95` |
| `apps/terminal/kernel/base/runtime/src/foundations/createRuntimeLifecycle.ts` | `53c87fc26d8c132432dcddd83192c4607900eac9db2d8c94ec9a927ee664f411` |
| `apps/terminal/kernel/base/runtime/src/types/module.ts` | `72797182fac9b8daa6839c15d86d82ea4691ae27981b4ce1c1cadc5db17a0d28` |
| `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` | `03c74ac4f9fad6523c89b60b8f5457599ea4b02415a54debe28908850e742527` |
| `apps/terminal/kernel/base/runtime/src/testing/releaseRuntimeForTest.ts` | `c5e5e0b0bb023e273feb48bbd306d4c653e8704d4ce3ea17e7883f6cc7af1a9b` |
| `apps/terminal/kernel/base/runtime/test/asyncResourceRegistry.test.ts` | `dd6886319c07303d61d523bdf610d47844290e1dfb93ad8e63d155aa32e88f90` |
| `apps/terminal/kernel/base/runtime/terminal-invariants.json` | `d854caa77ea7025a04a2e640c7679a2953bb0408aa8acc4834209f0e05b3ef39` |
| `tools/terminal-runtime/check-static.test.mjs` | `7908a7d8c52d230915bce86923e632e95bc7605f96259381ee575126ae474d11` |
| `apps/terminal/kernel/base/transport/src/application/createTransportModule.ts` | `00c2fa0c54cd7a74f4638ba991a57f1ffaa4afacc43bdaa63ac29c370c4b3346` |
| `apps/terminal/kernel/base/transport/src/foundations/createTransportConnectionOwner.ts` | `3d3e00928f679ab7a310a891cc87dbf8525fa63512e8e422d73f46582af34baf` |
| `apps/terminal/kernel/base/transport/test/moduleCommands.test.ts` | `0b59040b2914c737114a1e2dff0442a722eaa43f8a712c3b2304d699f990ce2d` |
| `apps/terminal/kernel/base/transport/test/connectionOwner.test.ts` | `71535ee05ead25696040f60e492548fc8edbc0f33a60326c70cc05f745044f7f` |
| `apps/terminal/kernel/base/terminal-data-client/acceptance/multiInstanceIsolation.test.ts` | `2831605dea9ff1c87aef024c271396c04a4771b05073310dce2ea1956d481999` |
| `apps/terminal/kernel/base/terminal-data-client/acceptance/asyncDisposal.ts` | `78d7f0d1279911e9f4ddd86dc7af1ae8aa4e38c173abf92aa003b8001cf23a02` |
| `apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts` | `e9a3db226cb80b4fc766373e3801585b1e5ac289ca51a32691c6a6eb7192b2fb` |
| `apps/terminal/kernel/base/terminal-data-client/test/asyncDisposal.test.ts` | `f6af04a23c008441f906b92cefd5bff037e2d5fbebdf2705076ee929f69e11c8` |
| `apps/terminal/kernel/base/terminal-data-client/test/undiciNodeTransport.test.ts` | `5755966e9f290f5176ea6cd8b73503df57f29aa02479fa62c3896bb8817b7a9c` |

**最后一次当前字节 TER Node run：** E1 managed Node run `ter-client-dev-1790848486403-6005-ec2176f8-da4a-4456-972e-ac1b9e188334`，2026-10-01T09:54:46Z–09:56:32Z，PASS（business、fixture cleanup、runner cleanup）；Vitest 精确选择 1 场景、另 3 场景跳过。整批最新受管 run 是 §8 的完整 `r5-full` seed。

**该 Node 场景最后一次通过：** 同一 E1 run；与当前 acceptance 源文件 SHA 一致。双 composition 隔离 run `ter-client-dev-1790847163804-76194-f8ad34dd-7d73-4deb-a065-e56506f31317` 是早先的通过，仍按其自身记录绑定旧字节。

## 2. 生产符号、入口与消费者

下列 package entry 是具名外部入口；各内部 command 由所属 module 注册并由同包 actor 消费。对外可见 exports 与 package 边界分别见各 `src/index.ts`、`package.json` 和 `terminal-invariants.json`。测试调用不替代生产 caller；在暂未接入具体产品 assembly 的 TER 基础包中，公开 factory/command gateway 是明确的外部集成入口。

| Owner / symbols | 调用/消费链 | 证据位置 |
|---|---|---|
| `server-config`: `createServerConfigModule`; `selectServerConfigSpaceCommand`, `setServerOverrideCommand`, `clearServerOverrideCommand`, `restoreServerDefaultsCommand`; `selectServerConfiguration` | module 注册 commands 与 `serverConfigActor` 的 `onCommand` handlers；启动 hydrate 由 `createServerConfigModule.install` 派发 `validateHydratedServerConfigCommand`；公开 selector 返回脱敏视图；组合层专用 `./network-adapter` 导出 `resolveServerNetworkSnapshot`，只用于给 transport network adapter 注入当前 provider。 | `apps/terminal/kernel/base/server-config/src/index.ts:1-18`; `src/application/createServerConfigModule.ts:17-43`; `src/features/actors/serverConfigActor.ts:203-320`; `src/selectors/selectServerConfiguration.ts:44-110`; `package.json:1-10`; `README.md:13-15` |
| `terminal-data-client`: `createTerminalDataClientModule`; activation/connect/cancel/disconnect commands; `selectActivationState`, `selectConnectionState`, `selectConnectionLatency`; `TerminalApi` generated executor | `terminalDataClientActor` 注册并处理所有 client commands；HTTP executor 由生成 API factory 提供；通用 transport gateway 由 composition 注入；业务界面/应用通过 owner commands 改变激活与连接状态，并通过三个 selectors 读取状态、连接与 RTT。 | `apps/terminal/kernel/base/terminal-data-client/src/index.ts:1-24`; `src/application/createTerminalDataClientModule.ts:18-46`; `src/features/commands/terminalDataClientCommands.ts`; `src/features/actors/terminalDataClientActor.ts`; `src/selectors/selectTerminalDataClientState.ts`; `test/terminalDataClientActor.test.ts`; `test/clientState.test.ts` |
| `transport`: `createTransportModule`, `TransportCommandGateway`; public `start/ready/invalid/stop/executeHttp/reportHttpAddressAvailable` gateway; internal network/retry/readiness/stability commands | module owns command actor and generic connection lifecycle. `terminal-data-client` calls only the generic gateway; network adapter is injected at composition. `createTransportNetworkStatusBridge` dispatches generic network transition command; owner timers dispatch retry/ready-timeout/stable-period commands. No TDS frame, credential, activation result or business close reason parsing belongs to transport. | `apps/terminal/kernel/base/transport/src/index.ts:1-91`; `src/application/createTransportModule.ts:42-183`; `src/features/actors/transportActor.ts:1-75`; `src/features/commands/transportCommands.ts`; `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:120-153` |
| `transport` reusable public helpers: topology session/identity/state-transfer; address selection; retry; heartbeat; WebSocket controller; network bridge; connection owner | Called by the generic transport module, `kernel-base-topology`, and named package tests. The export inventory is the package `src/index.ts`; implementation roots are corresponding `src/foundations/*.ts`; topology consumers include `apps/terminal/kernel/base/topology/**`. | `apps/terminal/kernel/base/transport/src/index.ts:4-79`; `apps/terminal/kernel/base/topology/test/topology.test.ts`; `apps/terminal/kernel/base/transport/test/*.test.ts` |
| `terminal-data-client` support types/foundations: client state, credential, event, protocol parser | Actor/state reducer/selector and generated executor consume them; protocol parser rejects malformed recognized fields while ignoring unknown fields per D-43. | `apps/terminal/kernel/base/terminal-data-client/src/types/client.ts`; `src/foundations/parseTerminalConnectionMessage.ts`; `src/features/slices/terminalDataClient.ts`; corresponding package tests |

### 2.1 Commands and selectors: zero-caller check

- Client commands: `activateTerminalCommand`, `cancelTerminalOnlineCommand`, `cancelTerminalOfflineCommand`, `connectTerminalCommand`, `disconnectTerminalCommand` are exported by the package, registered by `createTerminalDataClientModule`, and handled by `terminalDataClientActor`; actor command tests exercise the handler paths. Internal `terminalTransportEventCommand` and `terminalHeartbeatTickCommand` are registered and dispatched by the transport callback/heartbeat scheduler in that actor.
- Client selectors: `selectActivationState`, `selectConnectionState`, `selectConnectionLatency` are package exports and are read in `clientState.test.ts`, actor tests, and DEV scenario assertions.
- Server-config commands: four user-facing commands are exported/registered/handled and dispatched in owner tests; `validateHydratedServerConfigCommand` is an internal startup command registered and handled during module installation. `selectServerConfiguration` has owner/test consumers; `resolveServerNetworkSnapshot` is a composition-only subpath API and is used by the transport adapter test seam, not by the client.
- Transport commands: all ten definitions are registered in `createTransportModule`; `transportActor` handles owner commands; gateway methods dispatch public commands; bridge/timer callback dispatches internal commands. Tests cover module commands, connection lifecycle, network changes, retry, heartbeat and HTTP behavior.
- No new public command or selector is intentionally left without either an actor consumer or named package/composition entry. Fresh reviewer must verify each symbol against the current references and invariant lists; any symbol with no valid caller is `OPEN`.

## 3. Module graph and ownership

Current graph comes from `apps/terminal/skeleton-graph.ts:27-46` and package `dependencies.ts`:

```text
contracts / platform-ports / state / runtime
                   ↓
               transport
                   ↓
        terminal-data-client

contracts / runtime / state → server-config
```

`server-config` has `platform-ports` as a dev dependency only; production dependency direction has no edge back to transport or client. `terminal-data-client` depends on generic transport and owns terminal identity, credential persistence, activation/cancellation, protocol messages and selectors. Composition injects server-config's resolved network provider into transport. The actor/client never reads server-config selector/state/persistence directly. There is no dependency cycle in the declared batch-2 graph; graph check and package tests cover the package manifests and assembly shape.

`terminal-data-client` module owner and transport module are instantiated independently per runtime; isolation proof is `apps/terminal/kernel/base/terminal-data-client/acceptance/multiInstanceIsolation.test.ts`. Current DEV end-to-end composition is in `apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts`. The DEV suite proves actual Node clients and service topology, while unit multi-instance proof checks distinct runtime state/commands/connections/storage boundaries.

## 4. Generated files and their producers

| Generated output | Unique producer and canonical inputs | Consumer / verification |
|---|---|---|
| `contracts/openapi/edge.openapi.json`, materialized component schemas (including `contracts/openapi/components/terminal-binding/terminal-binding.schemas.json`), materialized terminal paths, `doc/evidence/platform/r5-u01-edge-placement-resolution.json` | `scripts/generate/r5-edge-materialize.mjs`; canonical contract catalogs, `contracts/openapi-source/terminal-binding.schemas.json`, placement/error/authorization registries; writes under `contracts/openapi` and its named evidence output. No edit to materialized component. | `edge-codegen` and edge-contract checks; `r5-edge-materialize --check` compares current generated snapshot. |
| Generated terminal edge Java request DTOs `TerminalActivationRequest.java` and `TerminalActivationCancellationRequest.java` (plus the generator's complete wire output closure) | `scripts/generate/edge-codegen.mjs`, from materialized canonical OpenAPI components plus edge operation catalog/report. Its target constants name generated Java roots and `writeOutputs/checkOutputs` enforce generated closure. | business edge controller/binding operations consume generated DTOs; `edge-codegen --check` and `openapi-contracts`. Only the two terminal request schemas allow unknown fields; operations-admin remains strict. |
| `apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts` | `contracts/policy/terminal-client-generation.json` + terminal face path/catalog/canonical schemas → `scripts/generate/terminal-client-api.mjs`; policy selects `terminal-binding` tag into exactly one terminal-data-client owner output. | `terminalDataClientActor` imports generated operation descriptors, types and executor factory; generator tests plus `openapi-contracts` verify exact closure/output bytes. |
| TDS classpath `protocol/terminal-connection-protocol.json` | Canonical `contracts/protocol/terminal-connection-protocol.json` copied by TDS Gradle `processResources`; `verifyTerminalConnectionProtocolResource` asserts source and classpath SHA-256 equality. | `TerminalConnectionProtocol` loads this classpath copy for message and close-reason interpretation; TDS protocol tests exercise it. |

Generation/source chain for the terminal HTTP request shape is:

```text
contracts/openapi-source/terminal-binding.schemas.json
  → accepted edge catalog / canonical schema digest
  → r5-edge-materialize
  → contracts/openapi/components + terminal paths
  → edge-codegen
  → Java edge wire DTOs

terminal face paths + operation catalog + canonical schemas
  → terminal-client-generation.json
  → terminal-client-api.mjs
  → terminal-data-client/src/generated/terminalApi.ts
  → terminalDataClientActor
```

The terminal API generator is distinct from the 296-operation backend projection: this batch does not add HTTP route, OpenAPI `operationId`, or generated-operation identity. `storeTerminalActivationUnknownFields` is an acceptance `module.operation` scenario key only.

## 5. Requirement and test/scenario mapping

The detailed enumerated map is `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md:345-402` (§11a). The following groups were checked against that table and current implementation/evidence; IDs remain distinct proof obligations, not implied merely by the existence of a test file.

| Criteria | Owning production path | Scenario/test proof and current result |
|---|---|---|
| V-B15, two terminal request bodies tolerate unknown fields while known fields stay strict and operations-admin stays strict | canonical terminal schema → materialized schema → edge DTO → terminal endpoint | `StoreTerminalAcceptanceScenarios.storeTerminalActivationUnknownFields`; current-byte managed run `r5-tc-1790840460165-42576` reports `CONTRACT=PASS BUSINESS=PASS`, plus same-run TDS contract PASS; focused generated wire tests and current `openapi-contracts` from terminal verify. The run selected exactly 1 of 199 discovered acceptance scenarios; it is not represented as a full-directory run. |
| V-S1, V-S3, V-S4, V-S6, V-S8, V-S9, V-S11, V-S12, V-S15 | TDS properties, admission/session actors, persistence owner, close/readiness lifecycle, protocol | `TerminalConnectionContractScenarios` scenario IDs in §11a; V-S15 and default V-S1 were separately run with real HTTP/WS and DB readback; full acceptance run previously covered remaining scenarios. Terminal verify confirms current TDS/package tests. |
| V-B1, V-B5, V-B6, V-B7, V-B10, V-B13 | `terminal-binding` owner API/operations and edge generated DTOs | `StoreTerminalAcceptanceScenarios` methods mapped in design §11a; full acceptance 199/199 BUSINESS PASS. Business assertions and cleanup have separate reports. |
| V-T1–V-T18 | `server-config`, `transport`, `terminal-data-client`, `platform-ports`, terminal API generator | Per-ID scenario names and proof files in design §11a; Node packages, focused client suites, generator/structure checks and Expo Web V-T17 passed. V-T17 is the only non-adapter Web smoke; Android device/VM execution is not claimed. |
| V-E1, V-E2, V-E5, V-E6 | TER composition, client owner, transport generic mechanisms, injected Undici adapter; managed backend/TDS/HAProxy topology | Current-byte E1 and double-composition disposal proofs are listed in §1; both business/fixture cleanup/runner cleanup PASS. Earlier E2/E5/E6 scenario runs remain prior-byte business evidence and are not relabeled current-byte; their business bodies were unchanged by the cleanup API migration. |
| V-G1 batch 2 | skeleton graph, `terminal-invariants.json`, checker red fixtures, TDS readiness/config | `terminal-verify` current PASS; `openapi-contracts` included in prior current-code terminal verify. Checker definitions/markers enumerated in design §11a and R-12 gate ledger. |

Additional current-byte close-reason focused proof:

- `terminalDataClientActor.test.ts` compares the 12 canonical business close reasons with the shared protocol and classifies only code `4000` plus a recognized canonical reason as that reason. Standard close codes, unknown reasons, and error events map to `UNKNOWN`; only the canonical `ACTIVATION_CANCELLED` close clears local identity.
- The prior full `terminal-verify` PASS predates the final two finding repairs and is historical for those changed bytes; this aggregate was not repeated. The affected transport package was run on current bytes: 45 tests PASS plus production-source lint and typecheck PASS. The affected client package was run on current bytes: 23 tests PASS plus typecheck PASS. Current managed E1 passed business, fixture cleanup, and runner cleanup. E2/E5/E6 were not repeated because their scenario inputs and business bodies were not changed; their prior PASS values remain explicitly historical.

Unknown TDS message type remains a no-op under requirement R-4.9 (`requirements...md` §R-4.9): this was independently checked against the reviewer concern and current actor/parser tests; it is not changed to connection invalidation.

## 6. 13c disposition checklist

| 13c requirement | Author-side evidence index | Candidate status |
|---|---|---|
| Each added production type/method has a caller or named external entry | §2 symbol/owner inventory; package export lists, command registries/handlers, module composition, topology consumers and tests | `MATCHED` |
| Each generated file has exactly one producer | §4 canonical producer/output table; generator policy and output target constants | `MATCHED` |
| Each producer has named generated output(s) | §4 rows for materializer, edge-codegen, terminal client generator and TDS resource copy | `MATCHED` |
| Declared module edges match design; no cycle | §3 plus `skeleton-graph.ts:27-46`, package dependency manifests | `MATCHED` |
| No zero-caller new command/selector | §2.1 traces command registration/handler and selector reads; fresh reviewer challenged key paths | `MATCHED` |
| Every requirement has source and corresponding test/scenario | design §11a line-by-line map plus §5 implementation mapping and current/historical run references | `MATCHED` |

**要求最终独立结论只能为 `MATCHED` 或 `OPEN`。** Fresh reviewer 若发现任何表项仅凭静态索引、无法从真实消费链或证据闭合，必须记 `OPEN`；主 agent 修复后另由 fresh reviewer复核，不以此作者索引预先宣布批次交付成功。

## 7. Fresh implementation review finding intake

上一轮 fresh 独立 implementation review 提出 M-1 与 S-1；主 agent 按当前需求/详设、transport actor 与 managed cleanup owning source 重新核验，均为 `CONFIRMED`。两个问题族及有限范围如下：

| Finding | 根因与处置 | 当前字节 focused proof | 反例边界 |
|---|---|---|---|
| M-1：timer command failure 曾通过直接调用 owner 绕过 transport actor | 定时器的 retry/readiness/stability 状态迁移必须只由 actor command 串行应用。保留失败诊断，不作旁路状态推进；actor 拒绝时状态不变。 | `moduleCommands.test.ts` 以被拒 retry command 断言 connect 尝试数不变并读取 `internal-command-failed`；再通过同一个真实 actor command 路径派发被扣住 payload，断言 actor 正常推进。`yarn workspace @catering-v2s/kernel-base-transport test`：45/45 PASS。 | 普通公开 `commandGateway` 命令由调用方 await 并接收失败，不属于 timer 后台派发路径；不将公开命令降为吞错日志。 |
| S-1：远端 WebSocket close 时异步 dispatcher 关闭错误被吞，transport 又先清除 connection 引用 | 一个 owner 生命周期必须共用一个 dispatcher-disposal Promise；远端 close 事件可以启动它，但 runtime close/dispose 必须 await 同一个可拒绝 Promise。transport 只在 connection.close 成功后清除引用，失败则保留给 runtime dispose 重试并将 cleanup 标 FAIL。清理扫描还发现 Node `undiciNodeTransport` focused test 以 `.catch(() => undefined)` 吞 dispatcher close 错误，已改为传播失败。 | `test/asyncDisposal.test.ts` 断言事件路径与 runtime cleanup 得到同一个 Promise、只 dispose 一次且敏感底层错误被折叠为稳定失败码；`connectionOwner.test.ts` 断言首次 close 拒绝后 connection 仍被跟踪、owner.dispose 再次 close；当前 managed E1 run `ter-client-dev-1790848486403-6005-ec2176f8-da4a-4456-972e-ac1b9e188334` 的真实远端取消/重连与末尾释放通过，`business=PASS, fixtureCleanup=PASS, cleanup=PASS`。client package 23/23 PASS。 | WebSocket 正常主动 close、HTTP dispatcher 的 finally cleanup 均继续沿各自 owner await；只有已观察远端 close 的 dispatcher 关闭与运行时清理汇合到共享 Promise。测试中的 rejection observer 只防事件回调产生 unhandled rejection，不改变同一 Promise 对显式 cleanup 的 rejection。 |

本轮未重跑不受最后 TER 异步释放修复影响的 backend-acceptance、E2/E5/E6、生成链或根 `scripts/verify`。根默认 verify 的旧 run 仍为 `INTERRUPTED/NO_VERDICT`，不能称 PASS；本轮在最终 TER 字节上重新运行 `scripts/verify --validate-only`，49/49 通过。当前字节受影响的 transport/client focused suites 和 managed E1 也在本轮通过。其余历史动态证据仅按原 run 与覆盖范围引用，不升级为最终字节的重新运行。独立 13c reviewer 曾将 13c 判为 `OPEN`，理由是计划列出的跨执行面证据仍有旧 run；新增 §8 逐项说明当前证明、未重跑项目与最后改动的影响边界，待 fresh reviewer 对该 finding 复核后再记录最终 `MATCHED`/`OPEN`。

## 8. 最后改动后的验证与非重跑范围

遵循 Dexter 的本轮要求：之前已通过且最后代码改动不影响的验证不重复运行。以下记录区分当前字节证据、历史证据与明确未取得的结论。

| 验证/判据组 | 当前证据与结果 | 未重跑/边界 |
|---|---|---|
| 静态门 | 最终 TER 字节运行 `scripts/verify --validate-only`。原运行末尾输出摘录：`TERMINAL_STATIC=PASS`、`R5_VERIFY_VALIDATE_ONLY=PASS`、`EXECUTED=49/49`、`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`；退出码 0。终端 skeleton 静态子进程 run id `ter-local-static-19500-1790849016365`，开始于 2026-10-01T10:03:36.365Z。 | 根默认 `scripts/verify` 仍是 `r5-verify-69267-1790842907944` 的 `INTERRUPTED/NO_VERDICT`，没有写成 PASS。没有重跑默认模式中不受这组 TER 修复影响的 backend/远端验收工作。 |
| M-1 transport timer command failure | 最终代码 `yarn workspace @catering-v2s/kernel-base-transport test` 45/45 PASS，lint 与 typecheck PASS；`moduleCommands.test.ts` 验证 command reject 不推进状态，actor command 路径仍可推进。 | 当前改动没有改变 backend 或 TDS timer/协议代码；因此不重跑 backend-acceptance 和 TDS acceptance。 |
| S-1 dispatcher/connection 异步释放 | 最终代码 `yarn workspace @catering-v2s/kernel-base-terminal-data-client test` 23/23 PASS，typecheck PASS；transport connection owner 测试验证失败后保留引用并由 dispose 重试；async-disposal 测试验证 remote event 与 runtime cleanup 共用同一失败可见的 Promise。当前 managed E1 `ter-client-dev-1790848486403-6005-ec2176f8-da4a-4456-972e-ac1b9e188334` 于 2026-10-01T09:54:46.403Z～09:56:32.972Z business、fixture cleanup、runner cleanup 均 PASS。 | 没有重跑 E2/E5/E6；最后差异修复的是共享 close/disposal 路径，不改这些场景的业务请求、判据或场景输入。该路径由当前 transport/client focused suites 与 E1 的真实 disconnect/reconnect/finally cleanup 覆盖；E2/E5/E6 保留各自原 run 的历史状态，不宣称当前 run。 |
| Backend acceptance / V-B15、V-S15、默认 V-S1 | 最近 V-B15 专项受管 run `r5-tc-1790840460165-42576` 于 2026-10-01T07:41:00.165Z～07:45:59.451Z `CONTRACT=PASS BUSINESS=PASS`，Testcontainers/远端进程/工作区 cleanup PASS；全目录 199 BUSINESS、49 TDS CONTRACT、296 identity 的早期全量 PASS 仍按历史运行报告。最后 TER 异步生命周期差异只改 TER transport/client TS 与 Node teardown。 | 未重跑该组。最后一轮受影响源码 focused proof 覆盖的是 TER command/disposal owner；TDS/Java/HTTP 业务没有调用这些 TS 实现。V-B15、V-S15、默认 V-S1 的 PASS 按原 run 保留，不声称为本轮重新执行。当前源树摘要（用于审阅范围，不伪装成历史 run hash）：backend `src/main + src/test + build.gradle.kts` 832 files，SHA-256 `ab697308b30016c6d158bf015a9b1768aa2f4d940cb69e09529797585dc4735c`；TDS `src/main + src/test + build.gradle.kts` 49 files，SHA-256 `8c0898ab6d646f3b0063959d262998c3878d19bae0283dfa773be6f487062c9a`。这些摘要采用 `SHA256(concat(sorted(relativePath UTF-8 + NUL + SHA256(fileBytes) raw 32 bytes + LF)))`，排序与路径均相对仓根。按 V-B15 run 结束时刻之后的 mtime 检索，这些目录没有更新文件。接受记录明确：旧 run `sourceSync` 只有 PASS/workspace/stagingRoot，没有保存可比较的历史整树 digest，因此此处是范围和文件时间的非重跑影响证明，不宣称密码学意义上的历史字节同一。 |
| 生成闭环与协议静态门 | 当前 `scripts/verify --validate-only` 的 49/49 包含本批静态入口；此前 materialize/codegen 与协议资源链 PASS 保持各自 run 记录。当前生成输入树（canonical OpenAPI source、materialized components/paths 与 materialize/codegen）99 files，SHA-256 `4921907312c0741b4b20a084ea8ebdf3183bd335a51ec45e74e78ed29be4f776`，摘要使用上一行所述算法。 | 最后 TER 异步释放改动不改变 canonical OpenAPI、生成器、TDS protocol 或生成物；不重复生成。V-B15 当前运行与该生成链已有独立证据；本表的当前摘要用于限定未重跑源域。 |
| Reset → DEV → seed | 当前 seed dry-run `R5_COMPLETE_SEED_DRY_RUN=PASS`（73 source items / 72 created / 1 excluded / 8 terminals）；reset `r5-reset-a924adeb-484a-474c-83a8-b4fdb0c63ebb` PASS，远端数据库不存在 readback PASS；当前 DEV `r5-dev-1790849302252-25524-b0bf6fe5-2072-4e10-a69c-18ee8fdab058` start/readiness PASS（Java、3 个 TDS、HAProxy、双 WS probe）；真实完整 seed `complete-seed-c4948030-2371-4a6e-96c2-7899d9d916d4` 于 2026-10-01T10:10:05.558Z～10:13:56.240Z `business=PASS`, `cleanup=PASS_PRESERVED_DEV_STATE`, `firstFailure=null`。四个 owner 组件与 store-terminal post-step/readback 均 PASS。 | 当前 DEV 按授权保留供 Dexter review；这是有意保留的 DEV，不记为临时资源 cleanup 失败。 |

### 独立复核结果

- CP-06 fresh 三维对账：`MATCHED`，见 `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-cp06-proof-codex.md`。
- 全批 6b fresh 三维对账：`MATCHED`，见 `doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-6b-reconciliation-codex.md`。
- Fresh `REVIEW_TARGET=IMPLEMENTATION` 对抗复核：`GO`, `M/S/N=0/0/1`。唯一 N-1 是根默认 `scripts/verify` 仍无完整 verdict；不得宣称 PASS。Reviewer 判定在诚实保留 `INTERRUPTED/NO_VERDICT` 的前提下，不需要为 TER 收尾修复重跑 backend-acceptance、E2/E5/E6、seed、生成链或根默认 verify。
- Fresh 13c 最终复核：`MATCHED`, `M/S/N=0/0/1`。Reviewer 复算并确认受影响 TER 文件哈希，接受 backend/TDS 文件时间边界与当前源树摘要作为非重跑范围佐证；仍保留 N-1：根默认 verify 无 PASS，且原始 validate-only transcript 未作为独立 artifact 保存。当前记录保存了实际运行末尾摘要和退出码，根默认 verify 继续标 `INTERRUPTED/NO_VERDICT`。
