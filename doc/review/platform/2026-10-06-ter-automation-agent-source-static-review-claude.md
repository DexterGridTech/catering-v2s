# TER automation-agent 批次一 · 当前源码静态评审

日期：2026-10-06。授权：Dexter 转交 Codex 的当前源码评审，并授权同步受影响的版本更新阶段 A 详设与计划。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
REVIEW_CONTEXT=DEXTER_RELAYED_EXTERNAL_SOURCE_ONLY
VERDICT=NO-GO
M/S/N=0/6/3
EVIDENCE_TIER=SOURCE_AND_TEST_SOURCE_ONLY
DYNAMIC_EXECUTION=NOT_RUN
L3_UI_ASSESSMENT=OUT_OF_SCOPE_BY_EXPLICIT_AUTHORITY
DESIGN_GAPS=NONE_FOR_REPORTED_FINDINGS
```

本会话是续接会话，并曾参与本批详设编写，不能称为 fresh 外部作者盲审。两个新只读子审分别检查 agent/Runtime 和 driver/Journey，先从需求、详设与源码形成反例；主 agent 重开对应源码、过滤与汇总。不继承旧 GO/MATCHED，不重开已关闭的内部 DESIGN cycle，也不以本报告替代内部 fresh 整批 IMPLEMENTATION 审查。

## 1. 范围、输入与方法

读回 AGENTS、PLATFORM-BLUEPRINT、平台入口、CLAUDE、review/terminal 规范、kernel/deterministic memory、路由材料及当前 skill。正式需求与详设只用于当前源码行为判据；final-verification 文档只用于定位批准范围，不核对其中运行声明。没有读取 `.runtime/`，没有执行测试、生成、编译、构建、verify 或环境操作。文件读取、搜索、摘要计算与获授权的文档写入不是动态验证。

主要核查：automation-agent 的连接、registry、control/runtime handler、Runtime selector/journal/command 通路；driver 的协议、真实输入、selector/request 观察、DEV fixture、Android acquisition/release、受管 runner；主 Journey 与对应测试；TestId 构造/类型门、保留静态门、source-map 的直接声明与消费、skill/API。

不评估也不索取 F-4b、geometry、F-1/F-2、非主要 Journey、额外拓扑、未迁移旧场景、Android 双屏/双机、L2/UAT 的运行证据。以下全部 finding 都有源码中的错误分支或反例，不因上述项目未运行而成立。测试位置只是断言结构证据，未宣称测试实际通过。

### 当前输入 SHA-256

| 仓根相对路径 | SHA-256 |
| --- | --- |
| doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md | 562a5c3f75de74d3f19e53743e1bcdc81da0a58feba1702533ae51c1dbc220f4 |
| doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md | 60f685b72d3fd3b026e8c5f2648f71b91b444c3a5c4c86f8480d786a944f0f84 |
| doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md | f1cf3ae50a728025ae1c39bb139eb33b9c1957a1d2606554bbd6017eca7e523d |
| apps/terminal/ui/base/automation-agent/src/application/createAutomationAgentModule.ts | 1f0787a8e5c1d0f6df71ffc65ef76e4ffb3007e7e73ac24b93adf80595399c72 |
| apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts | 8f1737c88101eebd6b2a8622a15cc9510226d4f0989ee4fc9bef3f46c6959e14 |
| apps/terminal/ui/base/automation-agent/src/application/controlRequestHandler.ts | b3e04abc12dfd4f1cb70e8c9ea12e81f66ef69c3c072845237fa04870a0acfc2 |
| tools/terminal-automation/src/selectorObservation.ts | ff3dc02fc735bc582a0a5a9102a182c5ecb9c4f6334a6dc9ca8600c336cb279d |
| tools/terminal-automation/src/runner.ts | c1b112a0dde50871a02c375532627ce6e70aa4208e1f2ed5f944f92a4e0a1b0f |
| tools/terminal-skeleton/test-id-type-gate.mjs | 2b2af205785de36db5e93b1b8266acb1dcb45091e60789364c60a422f05854fd |

## 2. 方案合理性与已核实源码事实

主干可保留：agent 是工具控制面，不拥有业务状态；Runtime 是 selector/command/journal 唯一入口；driver 分离真实控件操作与语义 command，并复用生产 owner 和共享 fixture。没有必要增加第二账本、恢复服务或新 runner。当前不足集中于已有机制的身份、当前值和错误传播，最小修复成本与影响相称。

- agent 的依赖不向业务 feature/adapter 倒置，selector 经 Runtime 按名与参数求值；不靠 slice 字符串或 full-state 读取。
- command 路径先订阅 journal 再 dispatch；NON_JSON 是明确值状态，agent 的订阅不会仅因非 JSON 而主动终止。迟到实例身份仍有 S-3。
- Web locator 限定 surface，Android 绑定显式 serial/display；registered node/revision/bounds 与真实 press 观察参与动作证明。此项是源码事实，不是 geometry 动态 PASS。
- `tools/terminal-automation/src/requests.ts:102-246` 在真实动作前建立 request 集合观察、读取基线，再定位唯一 root request 并转到精确 selector；候选歧义不猜第一项。业务 selector 与 request 结果分别检查。
- 主 Journey 激活复用共享 operations fixture；Android 的 `tools/terminal-automation/src/runtimeInfo.ts:7-26` 使用 runtime.info 中应用 DevicePort 身份。TDP 门店变化旅途通过 CBS HTTP 改业务事实、观察 store-basic selector 并恢复，未直接写 slice/数据库。
- `createTestId(module, part, {element?, key?})` 的实现与当前 skill 一致；现有源码搜索到的 `as TestId` 在唯一构造器内。S-6 是门对 `.ts` 旁路的覆盖漏洞，不是声称当前已有非法生产 ID。
- `tools/terminal-automation/package.json` 直接声明 `source-map: 0.6.1`；`src/bundleAttribution.ts:2,26-48` 使用 SourceMapConsumer 处理文本 bundle/source map，不把 HBC 当文本。此处核实声明/调用，不宣称重新解析依赖或取得 F-4b 测量。
- 旧 runner 的导入和按路径登记，由 `tools/terminal-skeleton/check-static.mjs` 的退役路径门检查；Runtime 静态门仍保留。没有执行这些门，不能写门 PASS。

## 3. S findings

### S-1 · control/runtime 的 event ID 共用命名空间却各自计数

**判据**：详设 §4.1，`doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md:139-144`：按信封 messageId ACK 释放同一连接的发送窗口。

**源码事实**：`apps/terminal/ui/base/automation-agent/src/application/controlRequestHandler.ts:43,52,141,151` 与 `src/application/runtimeRequestHandler.ts:205,215,254` 各自生成 `event-N`；`src/foundations/boundedWebSocketCtor.ts:97-106` 遇到 pending 中相同 messageId 即 failClosed。

**反例/影响（由源码推论）**：一个新会话先处理 controls.query，首条性能事件为 event-1；在 ACK 往返前处理 selector.read，另一 handler 的首条性能事件也为 event-1，合法消息触发断链。driver `tools/terminal-automation/src/server.ts:128-136` 收到消息后才回 ACK，不能消除该窗口；订阅并发推送同根。

**最小修正/可验收**：给两类事件不同稳定前缀，或共用已有连接的 ID 分配器；测试两个 handler 的事件同时未 ACK 时不冲突。无需新增队列。**Dexter 裁决：不需要。**

### S-2 · 旧会话异步回包会写入新 activeSocket

**判据**：R-03；详设 §4.1 `:137,142` 的旧会话释放和 session 核对。

**源码事实**：`apps/terminal/ui/base/automation-agent/src/application/createAutomationAgentModule.ts:185-198` 的 send 闭包运行时读取全局 activeSocket；`src/application/runtimeRequestHandler.ts:503-521` 的 dispatch Promise 不因 dispose 而停止回包；`src/application/controlRequestHandler.ts:190-199,218-220` 的异步 bounds 同根。`tools/terminal-automation/src/server.ts:124-126` 将旧 session 信封视为 SESSION_MISMATCH 并关闭当前 socket。

**反例/影响（推论）**：A 会话发出 deferred command/bounds，断开后 B 已重连，A 才完成；回包带 A.sessionId，却经 B socket 发送，导致 B 再次断链。不是要求重放命令，而是旧完成破坏新连接。

**最小修正/可验收**：发送闭包绑定原 session/具体 socket，仅在仍属于当前连接时发送；dispose 或有限观察结束后不再推送该 handler 的迟到 Promise 回包。覆盖 deferred command/bounds 完成于重连后的反例。**Dexter 裁决：不需要。**

### S-3 · 迟到观察以 actorKey 合并不同 command 实例

**判据**：R-07；详设 §4.2 `:161-165` 要求同 request 的全部迟到 actor 在有限观察期内可见。

**源码事实**：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:454,464-471,511-514` 用 actorKey Set 保存/删除 timeout。Runtime `apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:241-263` 允许子 command 继承 requestId，journal `src/types/journal.ts:9-11` 已携 commandId。

**反例/影响（推论）**：root 的另一个 actor 顺序调用相同 child command 两次，两次 actorKey 相同而 commandId 不同且均 timeout；root settled 后第一项 late 完成就删除唯一 key、停止观察，第二项真实结果丢失。`automation-agent/test/runtimeRequestHandler.test.ts:299-335` 只覆盖不同 actorKey，未检验实例重复。

**最小修正/可验收**：以 commandId+actorKey 跟踪，dispatch 补录不重新加入已经 late 完成的实例；复用 journal 的现有身份。补同 actor 两个 child command 及 late 在 root settled 前后的反例，不建第二账本。**Dexter 裁决：不需要。**

### S-4 · driver waitFor 会把过期初值当当前成功

**判据**：详设 §4.2 `:158` 当前值/最后值状态，§4.4 `:183` 真实业务 selector 观察。

**源码事实**：`tools/terminal-automation/src/selectorObservation.ts:50-68,82-89` 固定保存首次 current，waitFor 先测试 current 再测试 latest；NON_JSON/error 只拒绝当时 waiter，不保存值状态。

**反例/影响（推论）**：初值 active，后来已收到 inactive，此时 waitFor(active) 仍立即返回旧初值；JSON→NON_JSON 若发生时没有 waiter，随后也可能用旧 JSON 成功。业务断言存在假绿路径，涉及更新后状态恢复时更明显。`test/selectorObservation.test.ts:6-49` 只有 before→after 单向等待。

**最小修正/可验收**：current 可保留为基线 API；waitFor 只判最新有效观察状态，首次读与后续事件协调更新这一状态，NON_JSON 不沿用旧 JSON。覆盖 before→after→等待 before 与 JSON→NON_JSON→JSON；无需保存历史队列。**Dexter 裁决：不需要。**

### S-5 · Android 清理失败不能正确进入受管 cleanup，setup 失败还可丢失资源释放身份

**判据**：R-13 `formal-requirements...md:307-313`；详设 §9a.2 `:300-303,310`：APK/reverse 回收，business 与 cleanup 分开。

**源码事实**：`tools/terminal-automation/journeys/sampleConsole.android.test.ts:186-204` 对卸载/readback 或 connection 清理失败只抛 Vitest 错误；`src/runner.ts:691-718,719-743` 用本机 process tree/build directory 判 cleanup，Vitest 非零只影响 business。

**反例/影响（推论）**：卸载后 APK 仍存在，或 reverse remove 失败；afterAll 抛错使 Vitest 非零，但本机进程与目录清空仍能生成 cleanup=PASS。这是代码中的判定错误，不是索取某 run 证据。

**同根 acquisition**：`src/androidDevice.ts:279-288` 创建 reverse 后 readback 失败，尚未返回 releaser；`:318-338,354-357` 部分创建后调用 releaseOwned(false)，吞移除错误；`src/androidAutomationConnection.ts:143-160` 吞 setup cleanup 错误，连接对象未返回给 harness。当前 runner 没有这些注释所称的设备读回路径。

**最小修正/可验收**：现有受管结果接收设备清理的明确结果，残留或无法确认时 cleanup=FAIL；获取阶段保留精确 serial/remote/local/package ownership，部分失败也能受控释放或上报未释放。补“创建后 readback 失败”“部分创建且移除失败”“afterAll 清理失败进入 runner cleanup”的直接测试。保持 first failure，不按端口/名称删除未知资源，不建恢复服务。**Dexter 裁决：不需要。**

### S-6 · 禁止构造器外 TestId cast 的门跳过 `.ts` 文件

**判据**：详设 §4.5 `:193-194` 的唯一构造器与构造文件外断言拒绝；terminal 规范 §4-C。

**源码事实**：`tools/terminal-skeleton/test-id-type-gate.mjs:6-11,55-56` 只遍历生产 TSX，cast 检查 `:70-74` 也在这层过滤内。正式常量的 `*TestIds.ts` 不进入 cast 检查。`check-static.test.mjs:92-113` 的 cast 红例也只在 Screen.tsx。

**反例/影响（推论）**：在生产 `.ts` 中导出 `'raw' as TestId`，TSX 引用该值的类型就是 canonical TestId，属性定点检查通过；生成常量的文件则完全未检查。唯一构造器约束有假绿旁路。本轮未发现实际生产非法 cast，不能将门的漏洞写成已有非法节点。

**最小修正/可验收**：同一门对生产 `.ts/.tsx` 都检查构造器外 cast，JSX 属性仍只在存在该属性处检查；补 `.ts` 常量跨文件导入的 red（含别名）及正常工厂 green。不增加跨组件流分析。**Dexter 裁决：不需要。**

## 4. N findings

### N-1 · 完整信封容量拒绝没有终止 selector 订阅

判据：详设 §4.2 `:158` 的超预算终止。源码：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:141-146` 只先查 result 大小；`:226-235` 完整信封越界返回 RESOURCE_LIMIT，却返回数字；`:307-319` 已缓存 previous，只有 undefined 才退订。

源码推论：合法 result 在上限内，加 envelope/subscriptionId 后越界时，订阅继续占槽且相同值被去重。最小修正：区分成功发送和容量拒绝，拒绝释放当前订阅、不要把未发送值当成功 previous；补完整信封而非仅 value 越界的边界断言。Dexter：不需要。

### N-2 · 数组的非规范数字属性被当作 JSON 索引

判据：详设 §4.2 `:155` 拒绝静默丢字段。源码：`apps/terminal/ui/base/automation-agent/src/application/runtimeRequestHandler.ts:79-90` 以数字正则接受属性；`test/runtimeRequestHandler.test.ts:218-247` 只测 privateField 和正常索引。

源码反例：数组附加 `"01"` 或 `"4294967295"` 属性能通过检查，JSON 数组序列化却不保存该属性。最小修正：接受规范且有效、在实际数组长度内的索引，额外属性明确 NON_JSON；补这两个反例，不添加序列化框架。Dexter：不需要。

### N-3 · 主 Journey 的失败上下文采集尚未接线

判据：R-13 `formal-requirements...md:305-306` 的失败步骤、最后相关推送、requestId、脱敏截图；详设 §9a.2 `:303,310`。

源码事实：`tools/terminal-automation/journeys/sampleConsole.test.ts:213` 与 `sampleConsole.android.test.ts:218` 直接 await 主旅途；失败转入 afterAll 关闭页面/app。`src/requests.ts:203-246` 的精确 requestId 留在局部，异常退出无上述受控上下文；`src/runner.ts:728-738` 只选择进程/预算等失败码。未找到主旅途失败采集接缝。此项不要求本轮提供截图或运行证明。

影响：业务判定本身仍可失败，但失败时丢失工具已经掌握的诊断上下文。最小修正：在现有主 harness 一处失败边界采集受控步骤、requestId、允许字段的最后状态；截图先按现有遮蔽约束处理，无法遮蔽则仅记录不能保存的原因。禁止 raw payload，不新增日志框架。Dexter：不需要。

## 5. 过滤与边界

没有把动态未运行、旧场景未迁移、额外 display 或 geometry 未验证当 finding。没有提出新恢复框架、持久队列、command 重放或通用观测账本。可见性几何的子审疑问未进一步确认为本报告 finding，不由不完整阅读升级为缺口。TR-08 的文字与明确始终打包裁决的同步问题不作为当前生产代码 finding；本轮没有获授权修改规范，不能用旧规范推翻 Dexter 裁决。

所有已报告项均已有需求/详设判据，DESIGN_GAPS 为空。以上修复建议是待主 agent 核实的输入，不授予代码修改或运行授权。当前目标完成条件是静态评审交付，不需要任何动态 evidence。

## 6. 对版本更新阶段 A 的影响与已同步文档

不改变 FULL/HOT、UpdatePort、APK/boot 身份、启动保护、业务 owner 或 UI 内容。只修改获授权的两份阶段 A 文档；没有改 automation 源码、需求、规范、项目记忆或其他设计工件。

1. 详设 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:284,288-298`：实际 DEV 父流程是 journey/skill；补 transport/fixture/selector/TestId API。reload 后重建固定 sessionId helper。新增 update phase、系统非 React 动作仍是阶段 A 的未来扩展，不是 automation 本批漏实现。
2. 同详设 §12 的 OPEN-AUTOMATION：删除把作者在途状态当当前验收事实的说法，明确此次仅源码核查、没有核验交付运行状态，并登记本报告待修 helper。
3. 计划 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:35,44,89,93`：CP-01 接实际接口；CP-02 同步既有 retain 门；CP-05 重新 session/observer 和设备 cleanup。
4. `tools/terminal-skeleton/check-static.mjs:1374-1375,1439-1455` 当前 retain 门仅精确允许 server-config 且要求数量1。阶段 A 已获批 terminal-update 例外，未来 CP-02 须同步此既有门的精确声明和 red；本轮没有改门，也没有增加原因扫描门。
5. S-1～S-6 中实际消费的基础 helper 修复须在阶段 A 实施前重开核实，不假定旧 GO 代表可靠；不重做未受影响的 automation CP、不另造替代 driver。企业签名、最低 API 选择与其他既有 OPEN 保持原状态。

修订后 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md | 4c568c619123ab9088aa5a4eb1718d41267bcd90e4872b284c3be752613a04af |
| doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md | c15174f985a190f7b846fb79810e3ce25c488a7a95776c0d4da2164352abab03 |

这些是接口影响的文档修订，不是新的 DESIGN verdict 或实施授权。Dexter 已确认的 UI 内容保持确认；阶段 A 新能力及动态运行仍 NOT_RUN。
