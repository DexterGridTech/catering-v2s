# TDP 数据变化通知与远程运维：Claude 源码复评 finding intake

本记录由主 agent 逐项重开当前需求、详设、owning source 与适用项目记忆后撰写。Claude 提供的 findings 是待核验输入，不是独立结论。本轮只修改当前明确指出的实现/测试源码；不运行测试、构建、verify 或动态环境。

## Findings disposition

### S-1｜集合刷新被取代后可能漏订详情

- **分类：CONFIRMED，已修正。** 原实现依据业务 slice 刷新前后的成员集合算订阅差量；较早刷新先更新 slice、等待持久化时，后续刷新可能把新增成员误认为已订阅。
- **依据：** `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts` 中 `replaceContracts`、`replaceAreas`、`replaceServicePoints` 已改为持久化后读取 TDC 的公开 `selectTerminalTopicSubscriptions`，以当前实际订阅与本次期望成员对账；退订和补订均在每个异步边界前复核通知是否仍为最新、当前实例是否为 MASTER 且绑定仍一致。详见该文件 `reconcileTopicSubscriptions` 与三个 replace 函数。
- **反例/边界：** 不复制第二份订阅意图状态；跨 feature 的同一 owner 仍通过各自 `subscriberKey` 独立订阅。陈旧通知不会执行其差量。
- **新增测试源码：** `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts` 的“newer range retains an unsubscribed addition”用确定性 flush gate 构造旧刷新已改业务列表、新刷新返回相同新增成员的交错，并断言最新新增成员在实际订阅 selector 中恰有一项。
- **剩余：** 测试源码尚未执行，行为运行证据 NOT_RUN。

### S-2｜初始化异步等待后仍可能提交旧绑定状态

- **分类：CONFIRMED，已修正。** 初始化现于读请求返回、持久化 flush、订阅调用、子初始化/loaded 广播等异步边界后复核当前 MASTER、激活凭证和 store-basic 绑定；失败状态只在绑定仍有效时写入。过期初始化退出，不继续登记旧 owner 的订阅。
- **依据：** `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts`：`checkCurrentBinding`、`checkCurrentMasterBinding`、`withBinding`；`loadStore`、`loadOrganizationAndContracts`、`loadServicePoints` 中异步边界后的检查及错误提交保护；订阅回调也校验同一绑定。
- **新增测试源码：** `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts` 的“does not subscribe or publish initialization after the binding changes during persistence flush”在 flush 等待期间切换凭证绑定代次，断言旧初始化返回 stale、未登记订阅且未发送 loaded command。
- **剩余：** 本轮源码交错测试未执行；角色切换的实际运行路径未执行验证。

### S-3｜TDC 迟到 topic 操作可能影响新连接/新通知/新订阅

- **分类：CONFIRMED，已修正。** 已完成的持久化等待可能跨越 WebSocket 连接重建；旧操作此前可用当前连接发送、回滚替代订阅或清除新通知。
- **依据：** `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts` 现以连接代次和连接对象标识操作所属会话，并在 flush 后核对 MASTER、完整凭证身份、订阅身份及通知身份。取消订阅发送前还确认没有同 owner 的替代订阅。`apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts` 的退订恢复、接受时间回滚、pending 清除均以当前原项身份作条件更新。
- **新增测试源码：** `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts` 在单一测试中以确定性 flush gate 覆盖：连接更换后旧订阅不向新连接重复发送；新通知覆盖后旧接受操作不发送、不清除新 pending；替代订阅已建立后旧退订失败不恢复旧登记。
- **剩余：** 相关测试源码未执行；真实网络/存储故障及设备 adapter 未覆盖。

### N-1｜Topology late-result 槽未受接收侧 Runtime 上限约束

- **分类：CONFIRMED，已修正。** 接收侧现用 `Math.min(message.lateResultTtlMs, context.requestMaxResidenceMs)` 作为槽的有效 TTL，并以同一值计算 expiry 与超时路径，避免 wire TTL 长于本地 Runtime 可保留请求的期限。
- **依据：** `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts` 的 `handleCommandRequest`；`apps/terminal/kernel/base/runtime/src/types/module.ts`、`src/foundations/createRuntimeLifecycle.ts`、`src/application/createRuntime.ts` 将实际解析的 Runtime 限额作为只读模块上下文值提供。`apps/terminal/kernel/base/runtime/test/types.test.ts` 与 `test/foundations.test.ts` 覆盖上下文公开形状及来源。
- **剩余：** 新增的来源/上下文断言未运行；Topology 接收端 TTL 的动态到期结果未运行。

### N-2｜UNKNOWN 断言测试 mapper 无法保证处理 Instant

- **分类：CONFIRMED，已修正。** terminal-control 测试模块声明的依赖未保证包含 Java Time Jackson module；`findAndRegisterModules()` 因而不能作为此处稳定前提。
- **依据：** `apps/backend/catering-business-server/modules/terminal-control/src/test/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistenceTest.java` 为该测试 mapper 显式注册 `Instant` serializer，同时保留完整 `OperationView` 到 JSON tree 的断言。
- **最小性：** 只在测试中用 databind 已提供的 `SimpleModule` 注册 serializer；不新增依赖，也不改生产配置。
- **剩余：** Java 测试未编译或执行。

## 验证边界

- 源码已静态回读；修正触及的测试均为新增/调整后的测试源码，不代表通过。
- 当前字节最新运行：本轮未运行测试、编译、构建、verify、DEV 或其他动态验证，状态 `NOT_RUN`。
- 最后一次通过：本轮没有可归属到修正后当前字节的通过结果；历史运行不升级为当前 PASS。

## 修正源码

- `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts`
- `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`
- `apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts`
- `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`
- `apps/terminal/kernel/base/runtime/src/types/module.ts`
- `apps/terminal/kernel/base/runtime/src/foundations/createRuntimeLifecycle.ts`
- `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts`
- `apps/terminal/kernel/base/runtime/test/types.test.ts`
- `apps/terminal/kernel/base/runtime/test/foundations.test.ts`
- `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`
- `apps/backend/catering-business-server/modules/terminal-control/src/test/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistenceTest.java`

`apps/terminal/kernel/base/topology/test/topology.test.ts` 本轮未改；已有测试中的发送侧 TTL 断言不等同于接收侧槽限时的动态证明，请 Claude 静态检查是否存在相关覆盖缺口。本轮不因该项自行扩展测试或运行范围。

## 交给 Claude 的复评请求

本轮 disposition 是作者核验记录，不是独立 GO。请 Claude 只审查上述当前生产代码和直接相关测试源码是否正确、简单、稳健；不比较运行 evidence，也不要求任何测试、构建或动态验证结果。
