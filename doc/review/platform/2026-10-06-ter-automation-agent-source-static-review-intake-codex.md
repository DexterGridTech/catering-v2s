# TER automation-agent 当前源码静态评审 Intake

日期：2026-10-06  
输入：`doc/review/platform/2026-10-06-ter-automation-agent-source-static-review-claude.md`  
范围：逐项重开当前源码、正式需求与详设；主 agent 自行裁定 findings 并完成已确认工程修正。  
边界：不读取 `.runtime/`，不运行 managed runner、DEV、Expo Web、Android、VM、reset/seed、L2、UAT 或部署。

## 结论

Claude 对评审输入字节的结论仍为 `NO-GO`，`M/S/N=0/6/3`。下表是主 agent 对该输入的独立 disposition 与修正记录，不是新的独立 `REVIEW_TARGET=IMPLEMENTATION` verdict；修订后的当前字节须交 Claude 做新一轮只读源码复评后才能形成新 verdict。

九项均为 `CONFIRMED`，无产品裁决。S-1～S-6 的源码缺口已按最小范围修正并补直接反例；N-1～N-3 也已处置。Android/Web Journey 相关代码只增加源码接线与本地单元/类型证明，没有运行任何 Journey 或设备。

## Finding disposition

### S-1 — control/runtime 事件 ID 冲突

- **判定**：`CONFIRMED`。两个 handler 独立计数且发送窗口按 messageId 去重；同一连接有未 ACK 窗口时可冲突。
- **证据/修正**：`apps/terminal/ui/base/automation-agent/src/application/controlRequestHandler.ts:52,141,151` 现用 `controls-event-N`；`runtimeRequestHandler.ts:225,240,264` 现用 `runtime-event-N`，控制面与 Runtime 仍独立 owner，无新增分配框架。
- **直接反例**：`apps/terminal/ui/base/automation-agent/test/runtimeRequestHandler.test.ts:60-81` 同时产生两 handler 事件并断言 ID 唯一、前缀分离。
- **结果**：事件身份冲突不再触发同连接 fail-closed。无需 Dexter 裁决。

### S-2 — 旧会话异步回包可能污染新连接

- **判定**：`CONFIRMED`。原 handler 的延迟结果可越过 reconnect 并被全局当前 socket 发送。
- **证据/修正**：`apps/terminal/ui/base/automation-agent/src/application/createAutomationAgentModule.ts:36-44,90,150-155,174,203-211` 将发送函数绑定到创建它的 session/socket，并在连接失效或 socket 关闭后丢弃；消息分发只把该 sender 传给对应 handler。
- **直接反例**：`apps/terminal/ui/base/automation-agent/test/module.test.ts:18-43` 先创建 session A sender，再切换到 B，延迟发送后断言 A/B socket 都没有收到旧回包。
- **边界**：不重派、不回放旧 command；只阻止过期 handler 破坏替换连接。无需 Dexter 裁决。

### S-3 — 同 actorKey 的不同 command 实例被合并

- **判定**：`CONFIRMED`。`actorKey` 不是一次执行身份；journal 已提供 `commandId`。
- **证据/修正**：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:46-47,480-488,527-532` 以 `commandId + actorKey` 关联超时与迟到终态；迟到终态先于 dispatch result 到达时记录已完成实例，避免 result 补录时重新挂起观察。
- **直接反例**：`apps/terminal/ui/base/automation-agent/test/runtimeRequestHandler.test.ts:403-480` 覆盖同 request 两个同 actorKey 子 command 的独立迟到结果，以及 root 完成前收到迟到终态的路径。
- **边界**：复用 Runtime journal 身份，不建立第二账本或恢复框架。无需 Dexter 裁决。

### S-4 — selector waitFor 可能匹配过期 current 或旧 JSON

- **判定**：`CONFIRMED`。current 只适合作为订阅基线；收到新事件后必须以最新有效事件为准，`NON_JSON` 不能回退到旧 JSON。
- **证据/修正**：`tools/terminal-automation/src/selectorObservation.ts:50-96` 用单一 `latest` 状态表示最新 JSON/INVALID；初次 selector.read 仅在订阅期间尚无事件时填充基线，`waitFor` 只检查最新 JSON。
- **直接反例**：`tools/terminal-automation/test/selectorObservation.test.ts:50-125` 覆盖 active→inactive 后等待 active 不会命中旧值，以及 JSON→NON_JSON 后旧 JSON 不会假绿。
- **边界**：不增加事件历史队列；current 继续作为读取结果。无需 Dexter 裁决。

### S-5 — Android 资源清理失败未进入受管 cleanup；获取失败可丢失 releaser

- **判定**：`CONFIRMED`。设备清理异常先前只导致 Vitest 非零，本机进程和 build 目录清理却可令 manifest cleanup PASS；setup 部分失败还可能吞掉 reverse remove 错误。
- **证据/修正**：
  - `tools/terminal-automation/src/androidDevice.ts:284-315,327-376` 在创建后读回/部分创建失败时按精确 serial 与 remote/local 映射清理；ownership 不匹配不删除，清理失败转换为 `TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:*`。
  - `tools/terminal-automation/src/androidAutomationConnection.ts:130-166` 汇总 setup/release/driver-close 失败并保留 cleanup failure 标记。
  - 四个 Android Journey harness 在 `tools/terminal-automation/journeys/{sampleConsole,agentCapabilities,geometry,f4Performance}.android.test.ts` 以统一标记抛出清理失败；`tools/terminal-automation/src/runner.ts:79-87,615-623,738-773` 跨输出分块识别该标记并将 manifest cleanup 置为 FAIL。
- **直接反例**：`tools/terminal-automation/test/androidDevice.test.ts:178-225` 覆盖创建后 readback ownership 不明、部分创建及移除失败；`tools/terminal-automation/test/runner.test.ts:19-25` 覆盖标记跨输出块；cleanup 状态映射在 runner 中直接消费标记。
- **边界**：仅操作本轮精确创建且身份仍匹配的映射；不猜端口/名称、不删除未知资源。无需 Dexter 裁决。

### S-6 — TestId cast 门漏检生产 `.ts`

- **判定**：`CONFIRMED`。旧源文件筛选仅含 `.tsx`，所以常量 `.ts` 中的构造器外 cast 逃过检查。
- **证据/修正**：`tools/terminal-skeleton/test-id-type-gate.mjs:6-12,54-75` 将生产 `.ts/.tsx` 纳入源扫描、排除 `.d.ts`；JSX 属性仍只在 `.tsx` 检查，cast 检查则覆盖两种扩展。
- **直接反例**：`tools/terminal-skeleton/check-static.test.mjs:83-126` 加入 `.ts` 常量别名导入 cast 红例和 `createTestId` 正例。本轮独立聚焦运行也得到 `TEST_ID_TS_CAST_RED=PASS`、`TEST_ID_FACTORY_GREEN=PASS`。
- **边界**：不加跨组件流分析，仅防止唯一构造器门被 `.ts` 断言绕过。无需 Dexter 裁决。

### N-1 — selector 完整信封超限未释放订阅

- **判定**：`CONFIRMED`。只检查 selector value 上限不够；完整 response/event envelope 超限时必须释放该订阅，且不能把未发送值记为 previous。
- **证据/修正**：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:215-245,317-333` 让容量拒绝的 `reply` 返回 `undefined`；订阅值未成功发送时立即 `removeSubscription`，且仅成功发送后更新 `previous`。
- **直接反例**：`apps/terminal/ui/base/automation-agent/test/runtimeRequestHandler.test.ts:280-331` 以 value 本身在限制内、完整 envelope 越界的 fixture 断言 `RESOURCE_LIMIT`、订阅槽与 state listener 均释放。
- **边界**：不改变单消息限额与协议错误形态。无需 Dexter 裁决。

### N-2 — 非规范数组数字属性序列化时丢失

- **判定**：`CONFIRMED`。仅有数字字符不表示规范数组索引；`"01"`、`"4294967295"` 等属性不会按 JSON 数组元素序列化。
- **证据/修正**：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:81-110` 只接受十进制规范索引，且必须小于数组长度；其它自有属性返回 NON_JSON。
- **直接反例**：`apps/terminal/ui/base/automation-agent/test/runtimeRequestHandler.test.ts:263-278` 对两种边界属性逐一断言拒绝。
- **边界**：未添加 JSON 序列化框架。无需 Dexter 裁决。

### N-3 — 主 Journey 失败上下文未接线

- **判定**：`CONFIRMED`。正式需求要求失败步骤、相关推送、仍进行中的 requestId 与安全截图处理；主 Web/Android Journey 原先直接 await 后进入 cleanup，没有汇总入口。
- **证据/修正**：
  - 新增 `tools/terminal-automation/src/journeyFailureDiagnostics.ts:1-87`，仅采集步骤、requestId、白名单事件元数据；不记录 selector 值、command payload、输入内容或异常原文。
  - `tools/terminal-automation/src/requests.ts:112-113,200-201,242` 在精确请求被识别/终结时通知诊断上下文；`journeyUiPort.ts:18-45` 记录当前控件/输入步骤。
  - `tools/terminal-automation/journeys/sampleConsole.test.ts` 与 `sampleConsole.android.test.ts` 在主 Journey 失败边界报告并关闭监听；Journey 代码也能在业务 command 与 store-basic proof 间更新当前步骤。
- **直接反例**：`tools/terminal-automation/test/journeyFailureDiagnostics.test.ts:1-57` 覆盖 request 未完成状态及 selector/输入敏感值与错误原文不进入输出。
- **截图处理**：没有已证明适用于本批所有可视字段的遮蔽实现，因此安全失败报告写入 `NOT_SAVED_REDACTION_UNAVAILABLE`，绝不保存 raw screenshot。这符合详设允许的“mask 失败仅记录原因 metadata”。Web/Android screenshot capture 行为本轮未运行。
- **边界**：不新增日志框架或持久化。无需 Dexter 裁决。

## 验证记录与证据边界

- `yarn workspace @catering-v2s/ui-base-automation-agent typecheck`：PASS。
- `yarn workspace @catering-v2s/terminal-automation typecheck`：PASS。
- `yarn workspace @catering-v2s/ui-base-automation-agent test`：PASS，6 files / 38 tests。
- `yarn workspace @catering-v2s/terminal-automation test`：PASS，34 files / 156 tests。其 `tools/terminal-automation/vitest.config.ts` 只包含 `test/**/*.test.ts`，没有执行 `journeys/**/*.test.ts`。
- 首次 terminal-automation 定向 suite 有两次 fixture 失败：先是 cleanup 反例 fixture 声明的 serial 与 fake ADB device id 不一致；修正身份后发现 fixture 只传两个 managed reverse 映射，未达到接口要求的三映射，因此没有进入部分创建分支。修正为 matching serial 与完整三映射后，同一 suite 34/34 files、156/156 tests 通过；没有启动 ADB 或设备。
- TestId focused fixture：构造器外 `.ts` cast 红例与 factory 正例均 PASS。
- `node tools/terminal-skeleton/check-static.test.mjs`：启动后执行了 TestId/selector 等多组 fixture，但完整脚本运行约 5 分钟仍处于后续既有 package graph/runtime mutation 阶段；为避免继续消耗时间而中止。**不得将完整 `check-static.test.mjs` 或全仓 verify 标记为 PASS。**
- 未运行 Expo、Android、DEV、VM、受管 runner、reset/seed、L2、UAT 或部署；未读取 `.runtime/` 或运行证据。静态源码与本地单元测试不代表 Journey/device 动态 PASS。

“我选择为消息 event 分别使用稳定前缀，而不是引入连接级共享 ID allocator，因为两类 owner 本已独立且前缀足以消除同一连接中的碰撞。”

## 交 Claude 的独立只读源码复评话术

> Dexter 转交：
>
> Claude，你好。请对 TER automation-agent 修订后的当前生产源码与直接相关测试做一轮独立静态源码复评，报告 `GO/NO-GO` 与 `M/S/N`。本次只评代码是否符合已批准需求/详设、边界是否简单高效健壮；请重开 owning source，不沿用此前 verdict。可参考原始评审 `doc/review/platform/2026-10-06-ter-automation-agent-source-static-review-claude.md` 与主 agent disposition `doc/review/platform/2026-10-06-ter-automation-agent-source-static-review-intake-codex.md`，但先按需求、详设和当前源码独立形成判断。
>
> 重点复核：S-1～S-6、N-1～N-3 的当前修正及其同根调用链，特别是 event ID 前缀、旧 session sender、`commandId + actorKey` 迟到观察、selector 最新状态、Android cleanup marker 到 managed manifest、`.ts/.tsx` TestId cast、完整信封超限订阅释放、数组规范索引、Journey 失败上下文脱敏。
>
> 范围外明确不要求 evidence：F-4b、geometry、F-1/F-2、非主要 Journey、额外拓扑、旧场景迁移、Android 双屏/双机、L2/UAT 均不作为本轮 finding，也不得要求本轮补这些运行证据。本轮没有执行任何动态 Journey/设备/DEV；本地 typecheck、unit tests 与 TestId focused fixture 仅按记录列示，不等同动态通过。
>
> 请每条 finding 写明需求/详设位置、当前实现与测试位置、源码事实/推论、影响、最小可验收修正、是否需 Dexter 裁决；缺少详设判据的问题列 `DESIGN_GAPS`。未运行项保持 `NOT_RUN/NOT_COVERED`，不要求作者重跑动态场景。
>
> 本次复评只针对当前源码，`GO/NO-GO`、`M/S/N` 由你独立给出；不授权新增实现范围或任何动态运行。
