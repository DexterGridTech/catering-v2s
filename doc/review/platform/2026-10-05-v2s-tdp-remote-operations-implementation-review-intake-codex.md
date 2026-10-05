# TDP 数据变化通知与远程运维：Claude 源码评审 finding intake

日期：2026-10-05  
审查对象：Claude 当前源码静态复核输入及其指向的 owning source  
处置人：Codex 主 agent  
动态执行：NOT_RUN（未运行编译、测试、生成、构建、verify、DEV、Expo Web、Android、VM、reset/seed、L2、UAT 或部署）

## 输入与边界

Claude 上轮 verdict 输入为 `NO-GO`、`M/S/N=0/7/3`。该 verdict 只描述其审查字节，本文不继承该结论，也不把 intake 替代为独立 review。按 Dexter 当前要求，本文逐项重开正式需求、已批准详设与 owning source；只修已确认且仍在既有实施授权内的工程问题。运行证据与本轮代码状态分开记录。

已重新核对：

- `doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md`：R-08/R-09、R-12、R-13～R-16；
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：remote outcome handoff、缓存生命周期、完整集合和资源边界；
- `doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`、`project-memory/operations/claude-review-finding-intake.md`；
- 每项下方列出的当前生产代码与直接测试。

## Finding disposition

### S-1：混合 actor 超时过早终结 peer 关联

**Disposition：CONFIRMED。** Runtime 聚合允许“一个 actor 完成、另一个 actor 超时”成为 `partial-failed`；原 Topology 只按顶层 `timed-out` 保留关联，TDC 也只按顶层状态进入 UNKNOWN。该组合会提前释放 peer 关联，错过详设规定期限内的真实结果。

**最小修正：** Topology 根据顶层状态或 actor 记录中是否仍有 `timed-out` 保留原关联并发送 timeout 事实；TDC 展开嵌套 actor 记录后判断未决状态，持久化 UNKNOWN 和已完成子结果，再由现有 exact-request observer 接收余下结果。未增加关联表或重派机制。回归用例把 mixed success/timeout 输入到同一通路。

**代码：** `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:389-416`；`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:758-784`。测试见 `apps/terminal/kernel/base/topology/test/topology.test.ts` 中 late-result 场景及 `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts` 中 mixed result 场景。

### S-2：失败报告丢失真实 actor 结果

**Disposition：CONFIRMED。** TDC 可以同时持有失败 actor 的 typed code 与其他 actor 的结果，但此前 `errorCode` 存在时会省略 `resultJson`，测试也断言其为空。R-13/R-15 与 REMOTE_REPORT 格式允许两者并存。

**最小修正：** FAILED 事实同时保存有界 actor result/typed error code 与稳定的顶层失败码；仍不写入原始异常消息。超过完整 WS 消息上限时继续使用现有 `TERMINAL_RESULT_TOO_LARGE` 失败事实，不截断或伪成功。

**代码：** `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:625-666`；直接断言在 `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts` 的 late-result/FAILED 场景。

### S-3：集合持久化等待后，旧通知仍可执行订退

**Disposition：CONFIRMED。** `replaceContracts`、`replaceAreas`、`replaceServicePoints` 在 flush 后才恢复；入口处的 `isLatest` 不能阻止过期通知执行异步订阅差量。外层检查晚于这些副作用。

**最小修正：** 三条路径在 flush 返回后、每次异步 unsubscribe/subscribe 前重验同一通知与 binding 的 `isLatest`。没有引入新的序列化机制。

**代码：** `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts:660-755`。新增 flush 等待被更新通知取代的确定性用例在 `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`。

### S-4：旧持久化 store 缓存绕过本启动周期加载前提

**Disposition：CONFIRMED。** `store` 非空可能来自持久化 hydration；`initializeStoreServicePoints` 的公开 actor 命令原先只检查当前 binding 与 store 非空，未要求当前 actor runtime 已成功完成 store load。R-12 要求本次启动周期先成功加载门店。

**最小修正：** 在现有 `completedStoreLoads` 标记中验证当前 binding key；不增加新状态或启动调度。

**代码：** `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts:371-381`。新增测试在 `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`，用已 hydration 的非空状态直接调用公开 command。

### S-5：同连接业务帧积压可能阻塞 PING

**Disposition：PARTIALLY_CONFIRMED。** 当前源码让入站帧共用串行处理；`REMOTE_REPORT` 的处理等待数据库，而随后 PING 也在同一 `concatMap` 后排队。R-16 明确要求补报积压不饿死心跳。评审给出的“46 次、每次 2 秒、超过 90 秒”是构造性推论，本轮没有动态测量该精确时延。

**最小修正：** 每连接为非 PING 业务帧提供容量 64 的有界串行队列；认证后的 PING 在接收路径快速处理。队列满时写脱敏结构化日志并按现有 `SERVER_ERROR` 关闭，不丢帧后假 ACK，不创建无限并发或通用任务队列。该数值是技术性在途上界，不是订阅实体或业务集合数量上限。

**代码：** `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandler.java:49,155-160,182-193,563-616`。新增 focused 测试验证已有业务帧留在队列时随后 PING 仍产出 PONG，位于同目录 `TdsWebSocketHandlerTransportFailureTest.java`。容量边界及真实 JDBC 积压行为本轮未运行验证。

### S-6：服务端允许同 topic identity 使用不同 subscriptionId

**Disposition：PARTIALLY_CONFIRMED；不修改。** 服务端登记以 `subscriptionId` 识别订阅，因此重复客户端帧可建立多个登记，这是源码事实。但“按 topicKey+ownerRef 唯一拒绝”过宽：R-08/R-09 允许多个 feature 订阅同一 topic，TDC 的订阅 identity 还包含 `subscriberKey`，而当前 TDS wire 不携带该字段。服务端若只按 topic identity 去重，会丢失合法订阅者路由；引入 refcount/共享登记会扩大协议与 owner 设计。

**更小处理：** 保留当前协议和行为，不实施会误伤多订阅者的服务端去重。该审查意见中“无限重复造成资源增长”的工程边界仍值得 Claude 在当前 wire 约束下重新判断；它不构成接受任意大队列或增加业务实体数量限制的依据。

**源码：** `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java` 的 subscriptionId 注册；`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts` 的订阅 identity、subscriber 路由；正式需求 R-08/R-09。

### S-7：CLAIMED 且无实际结果时查询未显式投影 UNKNOWN

**Disposition：CONFIRMED。** claim 会持久化 `CLAIMED`；发生投递前故障时 `result/errorCode` 仍为空。只返回阶段状态不能表达 R-14 定义的未知执行结果。

**最小修正：** `OperationView` 保留 `status=CLAIMED`，并经 JSON 序列化公开 `outcome=UNKNOWN`；仅当实际 result/error 尚无值时如此投影。不改数据库状态、不扫描、不自动重派。

**代码：** `apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/api/TerminalControlOwnerApi.java:85-98`；序列化断言在 `.../terminal-control/.../TerminalControlPersistenceTest.java`。

### N-1：late-result TTL 未遵从当前 Runtime 上限

**Disposition：CONFIRMED。** 仅验证固定 topology 上限会允许 peer observer 超过当前 Runtime 的 `requestMaxResidenceMs`。

**最小修正：** 保留既有输入合法性检查，计算 `min(requested TTL, requestMaxResidenceMs)`，将有效值传入 peer 与本地 actor dispatcher。未新增配置。

**代码：** `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:511-523,635-656`；有效值转发断言在 `apps/terminal/kernel/base/runtime/test/peerGateway.test.ts`。

### N-2：owner 拒绝 report 被 `null`/empty 结果吞掉

**Disposition：CONFIRMED。** 原拒绝 sentinel 与 `Mono.fromCallable` 的空完成语义不相容，导致拒绝分支不可达。

**最小修正：** 使用显式 boolean；拒绝时记录不含业务 payload 的连接级诊断并按已有 `UNKNOWN` 路径关闭，不发送 ACK。

**代码：** `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandler.java:625-650`；owner 拒绝不 ACK 的用例在 `.../websocket/TdsWebSocketHandlerTransportFailureTest.java`。

### N-3：服务点测试 SQL 别名断言过期

**Disposition：CONFIRMED。** 当前生产 SQL 没有 `p` 别名，测试只需按实际 SQL 断言过滤条件。

**最小修正：** 将断言改为 `AND status='ENABLED'`；保留排序、无父区域 join 与实际 status 的行为断言。

**代码：** `apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/StoreServicePointTerminalReadTest.java:30-35`，SQL owner 为同模块 `StoreServicePointService`。

## 已在审查输入中确认的两项 peer 修正

此轮没有重复修改：`apps/terminal/kernel/base/runtime/src/foundations/createCommandPeerDispatcher.ts` 在 late peer error 路径把已有真实 actor results 交给有限 observer；`apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts` 保留 actor error 的 message。对应直接测试为 `runtime/test/peerGateway.test.ts` 与 `topology/test/topology.test.ts`。本轮没有增加 full-wire 集成测试，也不声称通过了运行验证。

## 修改文件范围

- `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`
- `apps/terminal/kernel/base/topology/test/topology.test.ts`
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`
- `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`
- `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts`
- `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandler.java`
- `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandlerTransportFailureTest.java`
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`
- `apps/terminal/kernel/base/runtime/test/peerGateway.test.ts`
- `apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/api/TerminalControlOwnerApi.java`
- `apps/backend/catering-business-server/modules/terminal-control/src/test/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistenceTest.java`
- `apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/StoreServicePointTerminalReadTest.java`

## 未运行与当前证据边界

- 新增/更新测试均为源代码，不是通过证据；未执行任何测试、编译、构建或脚本；
- 没有当前字节上的运行 ID 或本轮 PASS；业务、DEV、Expo Web 和清理均 NOT_RUN；
- Claude 后续请只审查源码及其直接测试，不要求读取或比较运行 evidence，不把历史 PASS 作为本轮结论。
