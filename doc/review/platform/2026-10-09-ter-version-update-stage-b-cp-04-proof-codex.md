# TER 阶段 B CP-04 证据与对账输入

## 范围

本记录覆盖实施计划 CP-04：TER 规则供给与持久快照、TDC 下载授权/报告 HTTP command、升级 owner 报告 pending 与回执消费、有效 PONG 广播及两套 integration composition 接线。它不是整批 6b、整体验收或逐代码 13c。

## 本轮根因处置

4. **报告配置上下文失效（CP-04 首轮独立对账 OPEN，已由主 agent intake 确认）。** 原 descriptor 只用 bindingIdentity；同一终端/代次更换服务空间或规则项目后，旧 pending 可能继续发送。现在 descriptor 同 slice 记录非秘密 `contextIdentity`，完整身份包含 terminalRef、bindingGeneration、selectedSpace、storeRef、projectRef、projectUpdatedAtEpochMillis。规则刷新遇到已知新上下文时先持久清除旧 pending/pause/失败摘要；heartbeat 观察到上下文变化也先清理并结束本次发送；当前绑定仍有效但配置事实暂不可读时保留 descriptor、拒绝发送；task 固定上下文报告仍须匹配当前上下文才能发送。新增 focused 测试断言 context change 清空旧报告且不调用 HTTP。intake 与设计/计划同步见 `doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-04-finding-intake-codex.md`。

1. **报告拒绝隔离。** `terminalUpdateActor.ts` 将 `TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT`（409）归为整条身份发送暂停，导致后续合法 task/observation 报告无法在后续 PONG 发送。现在 409/422/404 只移除该终态拒绝项并记录最新失败摘要；仅凭证/门店/空间身份错误暂停发送。测试覆盖 409 后仍提交下一 task、422 后仍提交 observation。
2. **心跳触发身份。** 原有效 PONG 广播只带绑定代次，无法区分当前 TDS WebSocket session。现在载荷包括 bindingGeneration、sessionId、sequence、observedAt、rttMs；升级 owner 在读取 pending 之前匹配当前 connected session，旧 session 的触发不发 HTTP、不改变 pending。sessionId 仅用于主机本地连接事实，不进入主副机状态投影；projection 使用不含 sessionId 的独立类型。
3. **首败与修复。** 首次升级 owner 测试因 receipt-flush fixture 中 `sessionId` 未在局部作用域定义而失败，原始错误为 `ReferenceError: sessionId is not defined`（测试断言处 `terminalUpdate.test.ts`）。这是测试夹具作用域错误；修正为测试内创建 connected TDC 状态后，以同一包测试复验。未修改被测生产行为来绕过失败。

## 当前字节 focused proof

| 执行面 | 命令 | 结果 |
|---|---|---|
| TDC | `yarn workspace @catering-v2s/kernel-base-terminal-data-client test` | PASS，8 files / 54 tests；含有效 PONG 载荷、consumer reject 不使连接失效、status projection 不暴露 sessionId |
| TDC | `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck` | PASS，exit 0 |
| terminal-update | `yarn workspace @catering-v2s/kernel-base-terminal-update test` | PASS，2 files / 37 tests；含上下文变化不发送旧报告、旧 session 不触发报告、409 后继续下一条、422 observation 继续、回执 flush 失败保留 pending |
| terminal-update | `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` | PASS，exit 0 |

以上为包级 focused proof，不是整批动态验收。CP-04 的受管动态运行尚未进入：按计划须在全部 CP 与全批 6b MATCHED 后统一进入。

## 仍需 reviewer 证伪的完整 CP 项

- source provider 可选时生产由 CBS persisted snapshot 提供规则，fixture provider 仅测试显式注入；验证两个 composition 的实际 assembly 传递 readiness/network reader、UpdatePort 与 TDC commands。
- 规则快照采用完整分页、collectionHash/context 校验，正文持久化成功后才接受具体 topic notification；reset/身份上下文变化清理快照与报告 context。
- transient download grant / report POST 只经 TDC typed HTTP commands；secret 不落盘，binary content 只走 UpdatePort/native protected source。
- pending report 同 task 合并、不同 task 保留；task 终态释放前从显式 rule/FULL/HOT 事实形成报告；无任务 observation 不生成历史 task；receipt 仅释放精确匹配 pending。
- 心跳是异步 local command，仅有效 PONG 在 RTT/deadline 更新后发出；不走会触发 transport.invalid 的通用后台失败路径；业务 consumer 失败隔离心跳健康。
- 全 CP 独立三维对账确认上述范围与需求、详设/计划和适用项目规范一致。

CP-04 的首轮 reviewer 曾对上述报告上下文项给出 OPEN；修复后 fresh reviewer 已对完整 CP-04 复核并给出 MATCHED，详情见 `doc/review/platform/2026-10-09-ter-version-update-stage-b-cp-04-reconciliation-codex.md`。该结论仅为 CP-04 三维对账，不是整批 6b 或整批实施 verdict。

## 明确未运行

- 本记录没有执行 DEV、受管 backend-acceptance、管理后台浏览器、TER Web 或真机动态；也没有据旧 run 把当前字节标为动态 PASS。
- 受管 acceptance/DEV 与 CP-05、CP-06 及全批 6b 的依赖顺序仍按实施计划执行。
