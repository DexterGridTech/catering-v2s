# Claude 静态代码评审请求：TDP 数据变化通知与远程运维

## 背景

Claude 上轮对当前 TDP 生产源码与直接测试的静态复核输入为 `NO-GO`、`M/S/N=0/7/3`。Codex 主 agent 已按当前正式需求和已批准详设逐项核验并完成确认项的最小修正；S-6 因现有协议不能区分合法的多个 subscriber 而部分确认、不做会改变语义的去重。此前两项 peer error 转发修正已在源码中，未在本轮重做。

本轮未运行测试、编译、构建、verify、DEV、Expo Web 或其他环境，也未读取运行 evidence。请求范围是源码与直接相关测试的静态代码评审；不要要求 evidence 比对或动态运行。

## 评审目标

独立审查当前实现是否符合 TDP 正式需求与已批准详设，重点判断：混合 actor 超时和 peer late outcome 是否仍能保留真实结果；失败报告是否同时保留有界 actor result 与 typed error；集合订阅差量是否隔离过期通知；启动周期门是否能阻止旧 hydrated state 绕过前提；TDS 心跳是否能越过串行、有界的业务帧积压；Runtime observer TTL 是否服从当前上限；owner 拒绝、UNKNOWN 投影与测试断言是否真实有效；方案是否简单且没有误伤共享订阅者。

## 需阅读文件

从 `catering-v2s` 仓库根阅读：

- `doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md`：R-08～R-16 行为边界；
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：owner、UNKNOWN、订阅、队列和 late-result 设计；
- `doc/review/platform/2026-10-05-v2s-tdp-remote-operations-implementation-review-intake-codex.md`：主 agent 对上轮 findings 的逐项核验与处置，作为待核记录而非结论权威；
- `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`、`apps/terminal/kernel/base/topology/test/topology.test.ts`：peer 结果关联与 mixed-timeout 行为；
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`、`apps/terminal/kernel/base/runtime/test/peerGateway.test.ts`：有效 observer TTL 的计算与转发；
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`、`apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`：远程结果持久化、UNKNOWN 与失败 actor 结果；
- `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts`、`apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`：当前周期前提与异步集合差量；
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandler.java`、`apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandlerTransportFailureTest.java`：业务帧串行队列、PING 快速路由及 report 拒绝；
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java`：subscriptionId 与服务端订阅身份边界；
- `apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/api/TerminalControlOwnerApi.java`、`apps/backend/catering-business-server/modules/terminal-control/src/test/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistenceTest.java`：CLAIMED 阶段与序列化 outcome 投影；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java`、`apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/StoreServicePointTerminalReadTest.java`：SQL owner 与对应测试断言；
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandPeerDispatcher.ts`、`apps/terminal/kernel/base/runtime/test/peerGateway.test.ts`：上轮已确认的 peer late error 转发；
- `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`、`apps/terminal/kernel/base/topology/test/topology.test.ts`：actor error message wire 投影。

## 独立核验重点

1. 对 mixed completed/timed-out actor records，核对 Topology 是否一直保留关联到实际终态或有限 expiry，TDC 是否先持久 UNKNOWN/部分结果、再更新同一远程 operation；错误与 completed 子结果是否均保留，且没有 raw error message。
2. 核对 TDC 的 late observer / Topology peer / Runtime dispatcher 传递的 requestId、commandId、TTL 和 release 时机；配置清理后的迟到结果不可重建 map 项，普通断线重连仍保留原项。
3. 核对三个集合路径是否每次异步订退前都重新检查 notification 和 binding，旧任务不能执行新的 subscription side effects；当前周期 `completedStoreLoads` 门是否覆盖公开 service-point command。
4. 核对 `TdsWebSocketHandler` 主 receive 路由是否将 PING 从阻塞的业务 JDBC 消息链中分离；业务帧仍串行、有界，超界明确关闭/日志且不 ACK；断开、close 和队列完成时是否释放连接资源。
5. 核对 capacity 64 是技术性在途上界，不是业务实体或订阅数上限；检查多个 feature 对相同 topic identity 的合法订阅是否仍可区分。若提出 S-6 修正，请证明它不会遗漏其他 subscriber 的通知。
6. 核对 `OperationView.outcome` 是否实际进入序列化响应并只在 CLAIMED 且没有 report result/error 时投影 UNKNOWN；测试 SQL 断言是否匹配 owning query。
7. 独立判断各改动是否采用最小现有机制，指出仍成立的缺陷、过度设计、无需求判据或反例；不要以未运行的测试源码声称行为已通过。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每项 finding 写准确仓根相对路径与行号、仓内事实/推论、影响、最小修正和是否需 Dexter 产品裁决。请只审查当前代码及直接测试源码；不得要求 Codex补充、比较或重跑运行 evidence，也不把本请求视为任何动态执行授权。

## 授权边界

授权边界：本次只请求当前源码及直接测试的静态实现 review，不授权运行测试、编译、构建、verify、DEV、Expo Web、Android、VM、reset/seed、L2、UAT 或部署。未运行证据不得写为 PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TDP 数据变化通知与远程运维》当前实现做一次独立静态代码评审。

背景：你上轮静态评审输入为 NO-GO、M/S/N=0/7/3。Codex 主 agent 已逐条重开正式需求、详设和 owning source，完成确认项的最小修正；逐项 disposition 与改动位置在 intake 文件。本轮没有执行测试、编译、构建、verify、DEV、Expo Web 或其他环境，也没有读取运行 evidence。
目标：独立判断当前生产源码及直接测试是否符合需求和已批准详设，方案是否简单、健壮，特别核验 late result/UNKNOWN 闭包、混合 actor 超时、失败结果持久化、过期集合订阅隔离、启动周期 store gate、TDS 业务队列与 PING、TTL 上限、UNKNOWN 序列化及多 subscriber 订阅边界。请只做静态代码评审，不要求 evidence 比对或动态执行。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md：R-08～R-16 正式行为；
- doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md：批准的 owner、失败和资源边界；
- doc/review/platform/2026-10-05-v2s-tdp-remote-operations-implementation-review-intake-codex.md：本轮主 agent finding disposition 与代码范围；
- apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts 与 apps/terminal/kernel/base/topology/test/topology.test.ts；
- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts 与 apps/terminal/kernel/base/runtime/test/peerGateway.test.ts；
- apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts 与 apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts；
- apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts 与 apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts；
- apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandler.java、apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandlerTransportFailureTest.java 与 session/TdsTerminalSessionActors.java；
- apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/api/TerminalControlOwnerApi.java 与对应 TerminalControlPersistenceTest.java；
- apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java 与对应 StoreServicePointTerminalReadTest.java；
- 上轮已确认 peer late-error 转发的 createCommandPeerDispatcher.ts、peerGateway.test.ts 及 Topology actor-error wire 测试。

请重点核验：mixed completed/timed-out 记录是否留在同一有限 request 关联中并能回传真实结果；结果/errorCode 是否共同持久化且不泄漏原始异常；异步集合差量和当前周期门是否正确隔离 stale/hydrated state；同连接 PING 是否能越过串行 JDBC 业务帧且队列满时有界、可见地失败；有效 TTL 是否实际传给 actor 与 peer；CLAIMED 无 report 是否序列化为 outcome=UNKNOWN；S-6 是否有协议内最小修复而不破坏多个合法 subscriber。

烦请给出明确 GO 或 NO-GO 与 M/S/N。每条 finding 提供准确路径/行号、事实与推论、影响、最小修正及是否需要 Dexter 产品裁决。

授权边界：本轮只审查源码和测试代码，不要求运行或比较 evidence，不授权任何测试、构建、verify、DEV、Expo Web、设备、reset/seed、L2、UAT 或部署。谢谢。
```
