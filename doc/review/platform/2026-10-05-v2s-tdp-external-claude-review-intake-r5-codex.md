# TDP 外部 Claude 复评 finding intake · r5

本记录由主 agent 重开需求、详设、计划、适用项目记忆及 owning source 后编写。Claude 对旧审阅字节的 verdict 仍为 `NO-GO, M/S/N=0/4/1`；本记录只记主 agent 的 finding disposition，不是独立实施 verdict、全批 6b 或动态验收结论。

## S-1｜SQL 权限与 CP 阶段顺序

- **分类：CONFIRMED（发现属实，CP-05 最小修正后阶段对账 MATCHED）。** 独立 TDS principal 所需 schema `USAGE` 与对象权限必须按真实 SQL 授权；CP-06 的 terminal-control 对象未创建前，CP-03/CP-05 不得假定这些函数/表存在，也不能把对象不存在误报为权限拒绝。
- **依据：** 详设权限矩阵及分阶段条件见 `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:154-169`；DEV grant/probe 条件见 `scripts/dev/r5-dev-runner.mjs:935-984`；acceptance principal 对应边界见 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TdsDatabasePrincipal.java:85-169`；runner 时序断言见 `scripts/dev/r5-dev-command-wrapper.test.mjs:380-421`。
- **处置：** 已将 CP-05/基础 principal 操作改成：terminal-control 对象全缺时 defer；完整存在时才授予 schema `USAGE` 与两函数 `EXECUTE` 并执行反向表权限证明；不完整对象集明确失败。先等待业务 Flyway readiness，再 grant 和启动 TDS。CP-06 仍负责新对象建立后的正反权限验证。
- **更小替代比较：** 给 TDS 使用 CBS 账号会绕过权限边界；无条件 grant 会把阶段依赖重新引入。按完整对象集条件授权是复用当前 bootstrap 的最小修正。
- **验证：** `node --check scripts/dev/r5-dev-runner.mjs && node --test scripts/dev/r5-dev-command-wrapper.test.mjs`，21/21；`./gradlew :apps:backend:catering-business-server:compileTestJava` 成功；CP-05 fresh 独立三维阶段复核为 `MATCHED`。真实数据库权限仍未在新的 DEV/backend-acceptance run 中证明。
- **剩余：** CP-06 对象创建后实际 principal 的函数执行成功、直接表读写失败，需按计划动态验证；当前为 `NOT_RUN`。

## S-2｜八个 GET 错误契约与生成源

- **分类：REJECTED_WITH_EVIDENCE（finding 所述源码前提与当前字节不符）。** Materializer 已生成 422/503 ProblemResponse 引用；错误目录中 `PLATFORM_DEPENDENCY_UNAVAILABLE` 的 target 不是 null，null 属其后的另一错误码。
- **依据：** `scripts/generate/r5-edge-materialize.mjs:293-296`；`doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:55-56`；详设逐 operation 的 422/503 映射见 `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:130-152`。
- **影响/边界：** 上述源码反例否定“materializer 未生成这些状态”和“依赖错误 target 为空”，但不证明本专项新增 operation 的整条生成/运行链成功。
- **最小处置：** 不改错误目录、不手改生成物；保留 CP-01 canonical→materialize→codegen 的既有验证。按本次任务，不重复不受影响的生成命令；完整生成/门结果仍按最终当前字节证据报告。
- **剩余：** 若本批后续改动触及生成源或投影，再运行受影响 focused gate；当前此 finding 无新增代码修正。

## S-3｜peer 晚到结果的关联、观察和释放

- **分类：CONFIRMED（原担忧成立；实现路径已有限闭合，并补强精确关联与到期反例）。** 仅在 Runtime 新增结果槽不能追回 Topology / peer gateway 已丢失的 actor result。当前设计要求 requestId/commandId 同步、有限 residence、普通超时先返回 UNKNOWN、迟到结果只更新既存 operation、到期后不接纳。
- **依据：** 详设中的 peer owner 链与释放规则见 `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:226-235`；TDC 实际 handoff 来源 `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:540-588`；Topology 接收、实际 ActorExecutionRecord 回传及 expiry `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:199-263,274-329,347-385`；Runtime peer gateway 传递 requestId 与 late callback `apps/terminal/kernel/base/runtime/src/foundations/createCommandPeerDispatcher.ts:99-141`。
- **反例与最小修正：** 既有测试在调用时未将显式 requestId 传入 dispatch，因此命令链虽实现透传，测试未证明同一身份端到端关联。已补显式 requestId 断言，并新增发送侧关联到期后模拟迟到 completed frame、观察者不得收到结果的反例；没有新增 peer ledger 或恢复机制。更小方案是补现有 callback 测试，不修改生产链。
- **验证：** `yarn workspace @catering-v2s/kernel-base-topology typecheck` 成功；同 workspace PROD 测试 `43/43` 通过。此前 runtime/topology focused 结果仍限于对应运行字节；全批业务链尚未验证。
- **剩余：** CBS→TDS→TDC→真实 Runtime 的端到端 late-result 持久化和重连观察属于当前授权的 backend/DEV/Expo Web 验收，尚为 `NOT_RUN`；设备 adapter `NOT_COVERED`。

## S-4｜peer 结果投影与完整 wire 上界

- **分类：CONFIRMED（当前实现已有安全投影与完整帧检查；保留作本批必须证明的约束）。** Actor result 必须通过完整 `command-result` envelope 编码检查，不能截断或伪成功；接收方须对完整 frame 使用协议 parser 和 actor-result 闭集校验。
- **依据：** `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:61-97,161-188`；协议解析/序列化在 `apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts:184-214`；70,000 字符超界测试在 `apps/terminal/kernel/base/topology/test/topology.test.ts:1842-1854`。
- **处置与验证：** 当前实现保留实际完整 serializer/parser、将不可表示结果映射为 `TOPOLOGY_CODEC_FAILED`/安全 error，不切片、不返回部分成功。Topology typecheck 与 PROD 43/43 通过；本轮修改仅增强同文件 handoff 测试，不改该生产约束。
- **更小替代比较：** 只检查 actor result 片段会遗漏 envelope 开销；发送前用既有完整 serializer 校验是最小可执行边界。没有新增 TDC map 总字节配额。
- **剩余：** 超界场景在真实 CBS/TDS/TDC 运行链中的 UNKNOWN/不重派结果尚为 `NOT_RUN`。

## N-1｜详设验收表列数

- **分类：REJECTED_WITH_EVIDENCE。** 当前详设将 DEV-DATA-01～12 与 DEV-DATA-13～16 放在两个不同表格中，各自列数与表头相符；intake 所述七列错位不成立。
- **依据：** `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:385-405`。
- **最小处置：** 不改正确表格、不增场景或分母。

## 证据状态

- CP-05 阶段三维独立对账：`MATCHED`，见 `doc/review/platform/2026-10-05-v2s-tdp-cp-05-reconciliation-codex.md`。它不替代全批 6b。
- 本轮受影响 Topology focused proof：typecheck PASS、PROD 43/43 PASS。
- 当前字节的完整 `scripts/verify`、backend-acceptance、DEV 业务与 cleanup、TER Expo Web尚未据此变成 PASS；未运行项目继续标 `NOT_RUN`。
- Claude 原 NO-GO 仅绑定其原审查字节，不在本 intake 中改写为独立 GO。
