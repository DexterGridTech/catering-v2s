# TDP 外部复评 finding intake · r4

本记录由主 agent 逐项重开需求、详设、计划与当前 owning source 后编写。Claude 本轮 verdict 仍绑定其审阅字节：`NO-GO, M/S/N=0/4/1`；本记录不是独立 GO，也不替代 CP、6b、动态验收或交付 review。

## S-1｜TDS 独立数据库权限与阶段顺序

- **分类：CONFIRMED（设计问题已修；实现证明待完成）。** 先前权限表缺 schema `USAGE`、CP-03 曾将尚未创建的 terminal-control 函数权限作为待证项；该表述现已在详设 §5.1a 与计划 CP-03/CP-06 拆开。
- **证据：** `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:151-169` 明列 TDS 需要的 database `CONNECT`、精确 schema `USAGE`、认证事实列、TDS 自有 sequence/state、snapshot 与 raw-time functions；terminal-control functions 同样须 `SECURITY DEFINER`、固定安全 `search_path`、撤销 PUBLIC 执行。详设 `:169` 和计划 `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:54,94` 明确 CP-03 只验证已创建对象，claim/report 的 `USAGE/EXECUTE` 与直表拒绝证明等 CP-06 建表后再做。
- **更小处置：** 不扩 schema 授权、不回落 CBS 账号；实施按该权限矩阵创建角色与函数，正反例分别检查对象存在及权限结果。
- **剩余：** 数据库角色/函数及权限实际运行证明 `NOT_RUN`；不能将文档闭合称作权限 PASS。

## S-2｜八个 GET 的 error contract / 生成链

- **分类：REJECTED_WITH_EVIDENCE（当前 finding 的源码前提已过时）。** 生成链已有 422/503 Problem 响应引用，依赖错误码目标也非 `null`；当前设计逐 operation 给出 422/503 与 errorSet 映射。
- **证据：** `scripts/generate/r5-edge-materialize.mjs:293-296` 对每个 operation materialize `400/401/403/404/409/422/429/500/503` ProblemResponse；`doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:55-56` 中 `PLATFORM_DEPENDENCY_UNAVAILABLE` 为 `RETAIN` 且 target 同名，target `null` 属下一条 `PLATFORM_DOWNSTREAM_PROTOCOL_MISMATCH`；`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:440-446,10720-10735` 已将依赖错误列入 `TERMINAL_DATA_READ` 并给 terminal read 使用该 errorSet；详设 `:139-147` 逐项列出错误条件及 422/503 映射。
- **反例/边界：** 当前源码检查足以否定“materializer 不生成 422/503”和“依赖错误码目标为空”的现状描述；它不证明新增 terminal-control contract 或当前生成物已动态成功。
- **最小处置：** 不改错误目录、不手改生成物；CP-01 按已登记 canonical→materialize→codegen 跑既有 focused generation/check 与缺码红例。
- **剩余：** 当前生成命令/verify 尚未由本 finding 复跑；不报告 PASS。

## S-3｜peer 晚到结果关联及释放

- **分类：CONFIRMED（已实现有限关联；本轮 focused proof 通过，整批证明待完成）。** 旧代码在 Topology 和 Runtime peer gateway 丢弃 actor result，且普通 timeout 清理关联；仅在 Runtime 新增 result slot 不足以闭合。
- **证据与处置：** 当前 `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts` 将 TDP 显式注册的 `requestId/commandId`、有限 `lateResultTtlMs` 与实际 actor result 通过 `command-result` 传递；接收侧按 command 与 request identity 同时匹配，期限用 dispatch 时刻的绝对 deadline 并在 expiry 清理。`apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts` 在 actor timeout 后将实际 late outcome 交给一次性 observer，再记录不含 payload 的 journal。没有新增 peer ledger。
- **反例/最小修正：** 用实际 transfer callback 证明普通调用 timeout 后的 peer 结果仍抵达；requestId 错配不得消费订阅；期限结束后不得回写。当前测试包含上述两条；后续若发现连接断开后的释放/expiry边界缺口，只修现有关联。
- **当前 proof：** Runtime typecheck + PROD/DEV 测试通过（103/103 each）；Topology typecheck + PROD 测试通过（43/43）。这仅是 focused package proof，不是 CP-06/整批 PASS。
- **剩余：** CBS/TDS/TDC 实链、DEV 与 Expo Web 未运行。

## S-4｜peer 结果投影与完整 wire 上界

- **分类：CONFIRMED（超界反例已复现并修复；focused proof 通过）。** actor result 可超过 Topology 64 KiB 完整 envelope 上限；`TopologySession.send` 的异步发送边界会吞下同步序列化错误并关闭 session，因此发送前仅依赖该层报错不能保证失败被上层识别。
- **最小修正：** peer controller 先用真实 `serializeTopologyWireMessage` 检查完整 `command-result`。越界时不截断、不伪报完成，发不含部分结果的最小 `status=error/result=null/error=TOPOLOGY_CODEC_FAILED`；接收的 ActorExecutionRecord 不符合闭集时映射为 error/空结果。TDP 事实仍 UNKNOWN，不重派。未增加 TDC map 总字节配额。
- **证据：** `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts` 的 `sendRemoteCommandResult` 及 `readActorResults`；`apps/terminal/kernel/base/topology/test/topology.test.ts` 覆盖 70,000 字符实际 actor 结果、最低失败 frame、requestId 错配。
- **当前 proof：** Topology typecheck + PROD 43/43 通过。未证明 DEV/真实设备结果。

## N-1｜验收表列数

- **分类：REJECTED_WITH_EVIDENCE（当前字节不存在错列）。** 详设 DEV-DATA-01～12 是独立四列表；DEV-DATA-13～16 是另一张七列表，所有行均为七个单元格。
- **证据：** `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:385-398` 与 `:400-405`。旧 intake 的“每行七项”表述不适用于前一张四列表，也未在后一张得到当前反例。
- **最小处置：** 不重排正确表格，不增场景/分母；本记录更正旧说法。

## 当前证据边界

- 当前 Runtime/Topology focused proof 已执行，详见上述真实命令/结果；package changes 后续修改时须重跑受影响 proof。
- terminal-control CBS owner、TDS PostgreSQL listener/claim/report、TDC durable remoteOperations、backend acceptance、DEV 及 TER Expo Web 仍待实施/运行，不得标为 PASS。
- Claude 原 verdict 保留为被审字节结论；当前实现状态仍是 ongoing，无整批 `GO`。
