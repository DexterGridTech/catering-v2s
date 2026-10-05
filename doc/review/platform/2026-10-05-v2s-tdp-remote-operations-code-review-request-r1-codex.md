# Claude 评审交付：TDP 数据变化通知与远程运维源码修正

## 背景

本次对 Claude 转来的源码静态 findings 做了主 agent intake，五项均在当前源码层确认并完成修正。该 review 请求对应修正后的当前源码字节；此前 NO-GO 只对应修正前被审字节，不能继承为当前源码 verdict。本轮未运行测试、构建、verify、DEV 或动态验收。

## 评审目标

请只对当前生产源码和直接相关测试源码作独立静态 review：核验修正是否解决集合订阅差量、初始化绑定过期、TDC 迟到操作串扰、Topology 接收侧 TTL 上限及 Jackson 测试序列化问题；评价方案是否保持简单、正确、健壮。不要要求或比对运行 evidence，也不要把测试源码视为测试通过。

## 需阅读文件

- `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts`：集合刷新订阅对账和初始化绑定检查。
- `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`：集合刷新与初始化交错反例源码。
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`：TDC topic 操作、连接身份及迟到结果边界。
- `apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts`：订阅恢复、接受时间回滚和 pending 条件更新。
- `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`：连接更换、通知覆盖及替代订阅交错测试源码。
- `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`：接收侧 late-result TTL 有效值和槽生命周期。
- `apps/terminal/kernel/base/runtime/src/types/module.ts`、`apps/terminal/kernel/base/runtime/src/foundations/createRuntimeLifecycle.ts`、`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts`：Runtime residence limit 向模块上下文传递。
- `apps/terminal/kernel/base/runtime/test/types.test.ts`、`apps/terminal/kernel/base/runtime/test/foundations.test.ts`：Runtime 上限上下文形状与来源测试源码。
- `apps/backend/catering-business-server/modules/terminal-control/src/test/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistenceTest.java`：显式 Instant serializer 和 UNKNOWN 投影断言。
- `doc/review/platform/2026-10-05-v2s-tdp-remote-operations-code-review-intake-r1-codex.md`：作者对 finding 的核验、修正位置和未运行边界。

## 独立核验重点

- `store-basic` 是否依据 TDC 的实际订阅事实而非已被并发刷新改写的业务列表计算当前集合差量；旧刷新是否能覆盖最新结果；MASTER、绑定和失败状态在每个 await 后是否仍正确。
- TDC 连接身份变化是否涵盖所有相关生命周期；迟到 subscribe、unsubscribe、accept 是否可能向新连接发送，覆盖新登记、回滚新接受时间或清除新通知；共享 subscriber 不应被误删。
- Topology 建槽、超时与释放是否统一使用接收侧有效 residence limit，Runtime 配置路径是否确实向该 handler 提供对应值；检查是否还有另一路径未受限。
- terminal-control 测试的 explicit `Instant` serializer 是否只影响测试，是否保留 UNKNOWN 的完整 DTO 序列化断言。
- 新测试代码是否真实构造所声称的交错，是否有遗漏的失败/替代路径；测试源码未运行，不得视为通过。

## 期望结论

请给明确 `GO` 或 `NO-GO`，并报告 `M/S/N` 数量。每条 finding 请提供精确路径与行号、源码事实/推论区分、影响及最小修复建议，并说明是否需要 Dexter 产品裁决。请只做源码静态 review，不要求、不比较运行 evidence，不因本请求自行执行代码。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TDP 数据变化通知与远程运维》本轮源码修正做一次独立静态 review。

背景：上一轮源码静态 review 对其当时读取的字节给出 NO-GO；主 agent 已逐项核验并修正五项 finding。本请求针对修正后的当前源码。本轮没有运行测试、编译、构建、verify 或动态环境，测试源码不代表运行通过。
目标：只审查当前生产源码和直接相关测试源码，判断修正是否解决原问题，方案是否简单、正确、稳健。请不要要求或比对运行 evidence。

请从 catering-v2s 仓库根阅读：
- `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts`：集合刷新订阅差量与初始化绑定复核；
- `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`：集合刷新、绑定变化的交错测试源码；
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`：TDC 订阅、退订、通知确认与连接身份；
- `apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts`：迟到结果下的条件恢复/回滚；
- `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`：连接替换、通知覆盖及退订失败交错测试源码；
- `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`：接收侧 late-result TTL；
- `apps/terminal/kernel/base/runtime/src/types/module.ts`、`apps/terminal/kernel/base/runtime/src/foundations/createRuntimeLifecycle.ts`、`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts`：Runtime residence limit 的传递；
- `apps/terminal/kernel/base/runtime/test/types.test.ts`、`apps/terminal/kernel/base/runtime/test/foundations.test.ts`：该上下文值的测试源码；
- `apps/backend/catering-business-server/modules/terminal-control/src/test/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistenceTest.java`：Instant serializer 与 UNKNOWN 断言；
- `doc/review/platform/2026-10-05-v2s-tdp-remote-operations-code-review-intake-r1-codex.md`：作者 finding intake 及修改/未运行边界。

请独立核验：集合刷新并发时，真实 TDC 订阅与当前集合能否收敛；初始化的读/flush/订阅等待后是否可能提交过期绑定；迟到 TDC 操作是否能串扰新连接、新通知或替代订阅；Topology 接收槽是否按接收侧有效 TTL 建立、超时并释放；测试 mapper 是否稳定支持 Instant，同时保留完整 UNKNOWN 投影断言。检查测试源码所构造的交错与尚未覆盖的相邻路径，但不要把测试源码说成已通过。

烦请给出明确 `GO` 或 `NO-GO` 及 `M/S/N` 数量。每条 finding 请列精确路径与行号、事实/推论、影响、最小修复及是否需要 Dexter 产品裁决。

授权边界：本次只授权源码静态 review，不要求运行 evidence，不授权测试、编译、构建、verify、DEV 或任何动态验收。谢谢。
```
