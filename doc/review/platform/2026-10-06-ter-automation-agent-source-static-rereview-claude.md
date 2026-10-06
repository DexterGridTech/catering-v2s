# TER automation-agent 当前源码独立静态复评

日期：2026-10-06。对象：Dexter 转交的当前生产源码及直接相关测试源码；不核验运行产物。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=NO-GO
M/S/N=0/1/2
L1_ENGINEERING=S-1：Android cleanup 判定仍可能假绿
L2_USER_VISIBLE=N-1/N-2：selector 表示与失败诊断的有限残留
L3_UNVERIFIED=本次明确排除运行验证，不以未运行项计 finding
DESIGN_GAPS=NONE_FOR_REPORTED_FINDINGS
TEMPLATE_COVERAGE=NOT_APPLICABLE（源码复评，不是设计模板评审）
EVIDENCE_TIER=SOURCE_AND_TEST_SOURCE_ONLY
EXECUTION=NOT_RUN
```

## 1. 出处、范围与读法

本主会话为续接会话，不冒充 fresh acceptance；本轮重新读取需求、详设、计划与当前源码，形成判断后对照旧报告和作者 intake。两位本轮 fresh、只读子 reviewer 分别检查会话/Runtime 与 driver/cleanup 路径；主 reviewer 重开候选问题、合并同根项并过滤过度要求。它们未写文件、未执行验证；本报告不重开内部 DESIGN cycle。

本轮只使用纯读取命令及项目只读记忆导航。未执行生成、编译、测试、verify、DEV、Expo Web、Android、设备或数据操作，未读取 `.runtime/`。作者 intake 的局部 PASS 只是待核声明，本报告不继承。

F-4b、geometry、F-1/F-2、非主要 Journey、额外拓扑、旧场景迁移、Android 双屏/双机、L2/UAT 均不作为缺少 evidence 的 finding。下文 Android finding 针对当前 runner 已有的清理判定代码，不要求本轮运行设备。

## 2. 方案合理性

问题与方案方向成立：agent 提供有限协议与 Runtime selector/command 接缝，driver 持有真实输入、旅途判断和受管生命周期，业务 owner 不依赖 agent。不同事件前缀、session-scoped sender、`commandId + actorKey`、单一 latest 状态与定点类型门，均是比新增共享分配器、事件历史或恢复框架更小的修复。

仍不放行的原因是 cleanup 的成功判定未闭合。两项 N 是现有能力的小修，不要求新框架、通用脱敏、父进程设备恢复或增加动态场景。真实 UI 操作的来源与 selector/request 观察仍沿批准 Journey；本轮不推导其已动态通过。

## 3. 原九项关闭表

`CLOSED_STATIC` 仅指原反例已由当前源码关闭且直接测试源码包含相应断言，不表示测试执行 PASS。

| 原项 | 当前状态 | 当前源码及测试证据（仓根相对路径） |
| --- | --- | --- |
| S-1 事件 ID 冲突 | CLOSED_STATIC | `apps/terminal/ui/base/automation-agent/src/application/controlRequestHandler.ts:52,141,151,161` 使用 `controls-event-*`；同目录 `runtimeRequestHandler.ts:225,240,264` 使用 `runtime-event-*`。`test/runtimeRequestHandler.test.ts:60` 同连接两 handler 的事件前缀/唯一性反例。 |
| S-2 异步回包污染新连接 | CLOSED_STATIC | `apps/terminal/ui/base/automation-agent/src/application/createAutomationAgentModule.ts:36` sender 同时检查原 session、原 socket 与当前身份；`:203,211` 将该 sender 交给对应 handler。`test/module.test.ts:18` 包含替换 session 后旧 sender 不发送的反例。 |
| S-3 同 actorKey 不同 command 被合并 | CLOSED_STATIC | `apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:481` 以 commandId/actorKey 关联 timeout/late；`:527` 使用已观察迟到终态防止结果补录重新挂起。`test/runtimeRequestHandler.test.ts:403,432,458` 覆盖同 actor 多 command 与迟到先于 root result。 |
| S-4 waitFor 命中过期状态 | CLOSED_STATIC | `tools/terminal-automation/src/selectorObservation.ts:58,68,85,91` 保存最新 JSON/INVALID，初读不覆盖已收到事件，waitFor 不再检查旧 current。`test/selectorObservation.test.ts:52` 起覆盖 active→inactive 与 JSON→NON_JSON→JSON。 |
| S-5 设备清理失败假绿 | PARTIALLY | `tools/terminal-automation/src/androidDevice.ts:284,327` 与 `androidAutomationConnection.ts:121,143` 已修复精确映射释放/失败聚合；`test/androidDevice.test.ts:178` 有 acquisition 失败反例。runner 最终判定仍有本报告 S-1。 |
| S-6 .ts cast 漏检 | CLOSED_STATIC | `tools/terminal-skeleton/test-id-type-gate.mjs:6,55,74` 纳入生产 .ts/.tsx，JSX 属性检查仍限定 TSX；`tools/terminal-skeleton/check-static.test.mjs:114` 跨文件别名 cast 红例，`:128` factory 正例。未运行门。 |
| N-1 完整信封超限未退订 | CLOSED_STATIC | `apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:215,317,328` 容量拒绝返回 undefined，释放订阅且不写 previous；`test/runtimeRequestHandler.test.ts:280` 起检验完整信封超限、listener 与槽位释放。 |
| N-2 非规范数组索引 | CLOSED_STATIC（原索引反例） | `apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:82` 规范十进制索引与数组长度检查；`test/runtimeRequestHandler.test.ts:263` 覆盖 `01`/`4294967295`。数组取值另有本报告 N-2。 |
| N-3 主 Journey 失败诊断 | PARTIALLY | `tools/terminal-automation/journeys/sampleConsole.test.ts:209`、`sampleConsole.android.test.ts:215` 已接失败报告与监听释放；请求身份接线存在。真实 selector event 仍被诊断投影丢弃，见本报告 N-1。 |

## 4. Findings

### S-1 — Android cleanup 仍从“没有失败标记”推导 PASS

- **判据**：正式需求 `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md:307`（R-13，受控设备身份与独立 cleanup）；详设 `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md:303,310`（§9a.2，设备包/reverse 的受控释放及失败仍做 cleanup）。
- **源码事实**：`tools/terminal-automation/src/runner.ts:615` 只有一份 `androidCleanupMarkerTail`，`:620` 在 stdout/stderr 上共同消费。`:659,674` 的预算/监控/信号路径会终止 child；`:738` 判 PASS 只检查本机 tree、build 目录与“未发现设备失败标记”，`:770` 据此输出 Android device cleanup PASS。
- **反例与推论**：stdout 半段 `TERMINAL_AUTOMATION_DEVICE_` → stderr 普通日志 → stdout 后半 `CLEANUP_FAILED` 会打断标记识别。另在 APK/reverse 已取得后，child 被受控终止而未完成 afterAll，既没有设备失败标记，也没有设备 cleanup 完成；本机清理成功仍可输出 cleanup PASS。这是当前判定路径的反例，不是要求运行 evidence。
- **影响**：设备资源未释放或未确认时，受管 cleanup 可假绿。
- **最小修正**：分别维护 stdout/stderr 的尾缓存；设备 cleanup 必须有明确的完成信号，child 中断或没有完成信号时不得标 PASS，应保留 FAIL/UNKNOWN。无需新增父进程设备恢复框架。`tools/terminal-automation/test/runner.test.ts:19` 目前只测同一序列两块文本；补交错输出及中断/未完成设备清理的最终判定反例即可。
- **性质**：仓内事实 + 对既有终止/输出交错路径的推论。
- **Dexter 裁决**：不需要；属于批准的 cleanup 正确性。

### N-1 — 失败诊断仍丢弃实际 selector 推送，表单步骤也会退化

- **判据**：正式需求同文件 `:305`（R-13，最后相关推送与失败步骤）；详设同文件 `:230,303,310`（安全诊断/截图遮蔽失败边界）。
- **源码事实**：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:321` 的实际 selector event 是 `subscriptionId/sequence/valueState/value|reason`。`tools/terminal-automation/src/journeyFailureDiagnostics.ts:21,29` 只认 requestId、kind、event.kind、selectorName，四项均不存在时丢弃事件；`:60` 因而不更新最后相关推送。`tools/terminal-automation/src/journeyUiPort.ts:38` 将多个字段 ID 拼成逗号串，诊断 `:18,65` 的 safeIdentifier 不允许逗号，失败步骤成为 unclassified。
- **影响**：业务 selector 或精确 request selector 的变化无法进入失败上下文，成员表单输入阶段也可能失去可定位步骤。正常业务断言本身未因此改变。
- **最小修正**：识别真实订阅事件的安全元数据 `subscriptionId/sequence/valueState/受控 reason`，不记录 selector 正文；表单步骤改为可接受且能定位当前字段的安全标识。`tools/terminal-automation/test/journeyFailureDiagnostics.test.ts:19` 当前只用 journal 风格的人工消息，应补真实 selector 消息及表单步骤反例。保持 `NOT_SAVED_REDACTION_UNAVAILABLE`；详设允许遮蔽失败不落原图，不要求通用截图脱敏框架。
- **性质**：仓内消息形状与投影分支事实。
- **Dexter 裁决**：不需要。

### N-2 — 数组索引 accessor 仍可被标 JSON 并在序列化时改变值

- **判据**：正式需求同文件 `:176`（R-05，不能静默丢字段/改写值）；详设同文件 `:155`（§4.2，严格 JSON 表示）。
- **源码事实**：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:96` 数组循环直接求值 `value[index]`；`:104` 对象分支已检查 own descriptor 并拒绝 accessor。`:129` 的普通 prototype 检查排除了数组；`:151` 随后再次 JSON.stringify。
- **静态反例**：数组 own 索引 0 为 getter，第一次返回 1，随后返回 undefined。数组长度和规范索引检查均通过；校验求值得到 1，序列化再次求值得到 undefined，wire 数组变为 `[null]`，却标为 JSON。同根反例是自定义数组 prototype 的继承 toJSON 可改变正文。未运行这些反例，也未发现当前已注册业务 selector 必然返回这些形态，因此维持 N，不升级成已发生的业务故障。
- **最小修正**：数组分支复用对象分支的 own descriptor/data-property 检查，递归 descriptor.value；accessor 返回受控 NON_JSON 原因且不执行 getter，同时拒绝不支持的自定义数组 prototype。补 `test/runtimeRequestHandler.test.ts:263` 附近的 getter 未执行/继承 toJSON 红例及普通数组绿例。无需新 serializer 或恢复机制。
- **性质**：源码事实 + JavaScript accessor/序列化路径的静态推论。
- **Dexter 裁决**：不需要。

## 5. 同根过滤与设计缺口

已扫描 control/runtime 的事件出口、异步回复、selector read/subscribe、command journal/result、driver latest 值、两类 reverse acquisition/release、connection 正常/失败释放、四个 Android harness 的 cleanup 标记、两端主 Journey 诊断、生产 TS/TSX cast 门及红例。skill 别名沿同一主 Journey，不另计 finding。

以下候选不列 finding：fixtureFactory 位于资源保护前的疑问，当前实际 factory 仅同步构造对象，未确认真实 throw 条件；120 秒 tracking 结束后 deferred dispatch 回包的疑问，未确认当前生产 command 的可达超期路径；没有截图遮蔽时不保存原图，符合批准详设；未有 Topology/额外场景运行证明，不在本轮范围。没有据此要求新增恢复、重跑或通用机制。

`DESIGN_GAPS=NONE_FOR_REPORTED_FINDINGS`。每条报告项均有需求/详设判据。

## 6. 证据边界与当前字节

静态已确认：上述修正路径和直接测试断言确实存在。测试源码不等于测试已执行。本轮所有生成、typecheck、单测、build、verify、Journey、DEV、Web、Android、cleanup 运行均未执行；作者局部验证和历史状态未升级为本轮 PASS。没有核验任何 run ID、日志、截图、manifest 或数据库读回。

本次读取 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| 正式需求 | `562a5c3f75de74d3f19e53743e1bcdc81da0a58feba1702533ae51c1dbc220f4` |
| 详设 | `60f685b72d3fd3b026e8c5f2648f71b91b444c3a5c4c86f8480d786a944f0f84` |
| 实施计划 | `f1cf3ae50a728025ae1c39bb139eb33b9c1957a1d2606554bbd6017eca7e523d` |
| runtimeRequestHandler.ts | `822b7eb0914ea9dbfb8f793512494831609dcb21a4fbf0d47c38e31d1465f6b6` |
| runner.ts | `ab51a11fb33441bbe59f0e527037199c003b593395539989c403d21dcc1ad3c9` |
| journeyFailureDiagnostics.ts | `eacccaa49368ac2f5be1301b56ff374fe571f63cd82a89fbdb59e23501984bf6` |
| test-id-type-gate.mjs | `e3ef9308fa1f4dcb03965db19cb48f23c1ae9d2d00a2e8da1210beff4c5a64d5` |

结论只适用于本次静态源码范围。NO-GO 不改变 Dexter 的执行授权；findings 仍是供主 agent 重开 owning source、确认并作最小修正的输入。本报告只新增本评审文件，没有修改需求、设计、规范、项目记忆、生产/测试源码或依赖。
