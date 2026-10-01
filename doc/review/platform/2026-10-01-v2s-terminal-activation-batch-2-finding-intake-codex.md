# 终端激活与长连接·批次二 Claude findings intake

日期：2026-10-01  
范围：Claude 对批次二实施的 0M/3S/2N 静态复核 findings。本文只记录主 agent 逐条重开原始需求、当前详设、计划、owning source 和项目记忆后的判断与处置；不沿用此前整批 verdict，也不把旧运行证据提升为本轮结果。

## 1. 证据来源与范围

- 原始需求：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`，R-1.6、R-10.3、V-T7。
- 详设：`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`，CP-03、运输命令/actor、激活凭证与测试边界。
- 计划：`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`，CP-03 执行路径与 package checks。
- 逐代码材料：`doc/review/platform/2026-10-01-v2s-terminal-activation-batch-2-13c-codex.md`。该记录的 13c/MATCHED 是本轮之前的证据，不能替代本轮受影响 CP-03 或新的整批 6b。
- 项目记忆路由：implementation / platform / backend / platform / session / implementation；review / platform / backend / platform / evidence / review；diagnostics / platform / backend / platform / runtime / failure；implementation / platform / backend / platform / architecture / implementation；implementation / platform / backend / platform / runtime / failure；review / platform / backend / platform / governance / task-start。重开了 Claude finding intake、逐点前后双读、TER 命令/actor/owner 边界、验证治理、测试失败族与受管运行限制等命中原文。
- 本轮未启动 DEV、backend-acceptance、远端进程、reset、seed、L2、UAT 或部署；仅运行受影响 TER workspace package 的 typecheck、owned test 与 owned lint。

## 2. Finding intake 与处置

### S-1｜同次激活并发可能生成不同秘密

**Classification: CONFIRMED — 已修复；CP-03/6b=MATCHED，待整批 implementation review。**

- **原文与证据**：需求 R-1.6 要求同一操作的全部请求复用一个秘密、同操作并发只建立一次绑定，并覆盖较早请求迟到（`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:104-109`）；详设凭证规则位于 `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md:165`，计划位于 `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md:108-115`。
- **实现根因**：root command handler 可并发执行；runtime 对 actor handlers 使用 `Promise.all`（`apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:620-630`）。旧逻辑在 `getDeviceInfo` await 前读取 pending snapshot，await 后从旧快照判空，两个 root 调用可各自生成秘密。
- **同根范围与反例**：重开激活秘密生成、pending reducer action、成功提交、HTTP 请求完成顺序、设备信息异步边界。参数不同的同 operationId 必须拒绝；同参数的 command 重试/地址重发沿用 pending；pending 不持久化，也不新增队列/replay/store。
- **最小修正**：设备信息返回后重新读取当前 owner state；在无 await 临界区内检查 credential、按 operationId 校验全部输入，再复用已有 pending 或生成并同步登记一份秘密。实现见 `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:269-301`。
- **验证**：`terminalDataClientActor.test.ts` 覆盖两个并发 root command 同秘密、HTTP 响应按实际请求发起次序逆序释放、最终 credential/pending readback，以及不同输入的同 operationId 拒绝（`apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts:206-325`）。当前 client package typecheck、owned test（7 files / 26 tests）与 lint（11 files）均通过。
- **Dexter 裁决**：不需要；纯实现并发边界。

### S-2｜重复 connect 先关闭现有连接/尝试

**Classification: CONFIRMED — 已修复；CP-03/6b=MATCHED，待整批 implementation review。**

- **原文与证据**：需求 R-10.3 显式规定已连接或正在尝试时再次建连不做任何事；等待/backoff 或已叫停时才恢复并立即尝试（`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:367-369`），V-T7 重申显式行为（同文件 `:764-765`）；详设 transport 与 client 分工在 `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md:161-165`。
- **实现根因**：旧 client connect 无条件先执行 `closeLocalConnection`，既清除现有 client listener/heartbeat，又调用 `transport.stop`；这会抹掉 transport owner 对 connected/inAttempt 的幂等保护（`apps/terminal/kernel/base/transport/src/foundations/createTransportConnectionOwner.ts:399-407`）。
- **同根范围与反例**：检查 client command 至 transport `start/stop` 的完整链、连接 listener 与 heartbeat 状态。重复 connect 在 connecting、awaiting-ready、connected 不得 stop 或重订阅；backoff 应撤掉旧 client listener 后直接调用 start 取消等待；stopped 才由显式 stop 后再 start。
- **最小修正**：把本地资源清理与 transport stop 分开；connect 在 connecting/awaiting-ready/connected 直接返回现状，backoff 仅清本地旧连接后重启 transport，显式断连/取消仍调用 stop。见 `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:377-399`。
- **验证**：完整 client command-path 测试覆盖 connecting、connected（包括 PING/heartbeat 与 listener 保留）、backoff（不先 stop）和 stopped 后重连：`apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts:735-821`。同一 client package 当前 typecheck、owned test 26/26、lint 均 PASS。
- **Dexter 裁决**：不需要；实现违反已有显式幂等语义。

### S-3｜网络退订非成功结果被当作成功

**Classification: CONFIRMED — 已修复；CP-03/6b=MATCHED，待整批 implementation review。**

- **适用规范**：`DevicePort.unsubscribeNetworkStatus` 返回 `Promise<PortResult<NoOutput>>`（`apps/terminal/kernel/base/platform-ports/src/types/device.ts:103`）；模块资源释放须聚合异步失败（`apps/terminal/kernel/base/transport/src/application/createTransportModule.ts:115-131`）。
- **实现根因**：bridge 之前忽略退订的 typed result；将 disposed/订阅身份提前清空后，`failed`、`timed-out`、`unavailable` 都会 resolve 成功，外层 `Promise.allSettled` 看不到失败且无法重试。
- **同根范围与反例**：检查 bridge 的状态跃迁、并发 dispose、退订 promise、异步资源聚合和脱敏日志；unavailable adapter 不等于成功卸载有订阅身份的资源，失败需保留 identity 以供 cleanup 重试。
- **最小修正**：disposed 后不再派发通知；仅 `succeeded` 清除 subscription id；其他结果以稳定、不含底层敏感信息的失败码拒绝；重复并发 dispose 共用当前 promise，失败后保留 id 并允许下一次 cleanup 重试。见 `apps/terminal/kernel/base/transport/src/foundations/createTransportNetworkStatusBridge.ts:42-61`。
- **验证**：focused test 分别注入 `failed`、`timed-out`、`unavailable`，断言公开失败、保留 ID、下一次成功退订以及成功后的幂等；模块测试确认失败进入现有异步聚合日志（`apps/terminal/kernel/base/transport/test/networkStatusBridge.test.ts:97-117`、`apps/terminal/kernel/base/transport/test/moduleCommands.test.ts:351-382`）。当前 transport package typecheck、owned test（8 files / 48 tests）、lint（19 files）均 PASS。
- **Dexter 裁决**：不需要；履行现有 typed cleanup 结果。

### N-1｜计时器 command 失败后的生产恢复证据

**Classification: UNVERIFIED_REQUIRES_EVIDENCE — 保留 OPEN，不宣称复现或已修复。**

- **当前可证事实**：`createTransportModule.ts:75-90` 通过 runtime dispatch retry、ready-timeout、stable command；若 dispatch 非 completed 或 promise reject，仅写脱敏诊断日志，并没有重新排定同一个 timer。正常 adapter 的 `readSnapshot/connect` 异常会被 `runAttempt` 捕获并继续按策略安排 retry（`apps/terminal/kernel/base/transport/src/foundations/createTransportConnectionOwner.ts:273-321`）；ready-timeout 的 `detachConnection/close` 可拒绝并使 owner command 失败（同文件 `:322-339`、`:500-512`）。runtime 会将 actor handler throw 转成 error actor result（`apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:266-287`）。这些静态事实证明失败结果可见和某些失败边界存在，不证明正常生产配置下 timer dispatch 会遇到该失败，也不证明会发生真实重连停滞。
- **测试局限**：`apps/terminal/kernel/base/transport/test/moduleCommands.test.ts:202-303` 用 fake dispatcher 拒绝一次 retry，再手工派发捕获的 payload；它证明没有旁路直调 owner，但不证明生产 runtime 会自动恢复，也不能充当生产故障证据。
- **同根范围与反例**：retry、ready-timeout、stable 三种 timer 各自的 owner token、runtime actor command、正常 adapter promise 与异常传播。`runAttempt` 已捕获预期网络失败并排定下一次 retry，是不能把所有 adapter 拒绝都归为停滞的反例。
- **处置/最小后续**：不改 production recovery、不让 timer callback 绕过 actor。需后续在当前真实 runtime/adapter 边界取得一次可复现的 active timer command 失败及后继状态证据；确认有效 timer 丢失后，再以同一 focused proof 证明 token 失效保护与恢复。当前无此动态证据，故保持 `OPEN`。
- **Dexter 裁决**：暂不需要；先补工程证据。

### N-2｜受管入口 README catalog 状态过时

**Classification: CONFIRMED — 文档已修复。**

- **证据**：实际入口 `scripts/test/terminal-client-dev-acceptance.mjs:23-49` 当前注册 5 个场景：一个双 composition 隔离场景与四个 CP-06 DEV 场景；README 原 `scripts/README.md:221` 只描述 CP-05 双 composition 当前状态。
- **影响与同根范围**：读者会低估可运行的单场景入口集合，并误解 CP 历史与当前 catalog。核对 catalog 所有条目及 selector 语义；无须改写 CP 阶段历史或实际场景行为。
- **最小修正**：README 已改为列出当前五项、指出双 composition 是 CP-05 阶段状态、其余四项由 CP-06 加入，并要求一次只选一个精确场景。见 `scripts/README.md:221-227`。
- **验证**：静态对读 catalog 五项与 README 列表一一相符；不需要运行 DEV acceptance。
- **Dexter 裁决**：不需要。

## 3. 本轮实际运行与证据边界

- `@catering-v2s/kernel-base-terminal-data-client`：typecheck PASS；owned test PASS，7 files / 26 tests；owned lint PASS，11 files / 0 errors / 0 warnings。
- `@catering-v2s/kernel-base-transport`：typecheck PASS；owned test PASS，8 files / 48 tests；owned lint PASS，19 files / 0 errors / 0 warnings。
- package runners 未生成受管 `runId`/manifest；不得伪造 run id。最后一次本地 owned test 的 UTC 时间见最终状态报告；当时没有 DEV 或其他受管运行。
- 本轮没有运行 backend-acceptance、`scripts/verify`、Node managed acceptance、DEV、reset、seed、L2、UAT 或部署。13c 所列 E1、全目录业务、seed 和旧 verify 证据均维持原证据档位/字节，不用作本轮当前证据。

### 首败诊断与防再犯

- 首次 client typecheck 报三处测试 context 的 `dispatchAction` 参数隐式 `any`；根因是测试对象在最后才整体 cast、未获得目标函数的上下文类型。新增 context 统一显式声明 `(action: unknown)`，当前包 typecheck 通过。
- 首次 client package test 的两个新增并发用例失败。检查 actor 输入校验后发现 fixture 的重复字符秘密尾部不是规范 base64url sextet，导致 handler 在发 HTTP 前拒绝；修正 fixture 为规范格式并加格式断言，确保异步 barrier 前 fixture 已满足生产校验。
- 同一测试失败族第二次出现后冻结后续验证并定位到另一个测试假设：第一 root command 登记 pending 后等待 persistence flush，第二个 root 可以更早发出 HTTP；不能假设 HTTP resolver 下标等于 command 启动顺序。测试现先按实际 HTTP submission 顺序释放最后一个请求，再释放第一个，并用 `Promise.race` 等待任一响应，证明确有响应逆序而不挂在错误 root 上。
- 上述是测试编排缺陷，不是生产激活逻辑失败；同一受影响 client package 在每次修正字节后以 owned runner 验证，最终结果 26/26 PASS。该回归用例直接固定了「测试输入先满足被测生产校验」与「异步 completion 按被测边界识别，而非臆定调用序」两项可复用规则。

## 4. 对账与最终 verdict

- 受影响完整阶段：CP-03。fresh 独立只读三维复核结果：**MATCHED**，`M/S/N=0/0/0`；reviewer 逐项核验 S-1～S-3 修复、owner 边界及 focused proof。
- 整批 6b：fresh 独立只读三维对账结果：**MATCHED**。它是独立的批次级检查，不以 CP 结论汇总替代；动态运行仍按各自证据状态报告。
- 整批 `REVIEW_TARGET=IMPLEMENTATION`：fresh 独立 reviewer 给出 **NO-GO，M/S/N=0/1/1**。其 S-1 指向 TER 收到未知 TDS 消息类型后不发 `transport.invalid`，并建议改成 `PROTOCOL_INVALID`；N-1 timer 项正确保留为 `OPEN / UNVERIFIED_REQUIRES_EVIDENCE`。
- 主 agent 对独立 S-1 的 intake：**DEXTER_DECISION — 保留未知消息类型静默忽略**。需求 R-4.9 明确把未知消息类型排除在 D-43 新规则之外并要求维持已有处理；当前解析层保留任意 JSON `type`，actor 对未识别类型不采取动作，测试明确固定此行为。详设 V-T6 只要求未知字段，不要求改未知类型处理。共享契约的 `unknownApplicationMessage=4000/UNKNOWN` 是 TDS 对设备发来不认识应用消息的服务端处理；不能据此推出相反方向的 TER 也必须改成失效。Dexter 随后明确裁定“TER 客户端把未知 TDS 消息类型静默忽略”没问题，先忽略；据此不改源码或测试。
- reviewer 随后对未覆盖面补做只读核验：生成链、terminal Java DTO 与 operations-admin 反例、V-B15/V-S15 acceptance helpers、TDS config/shutdown、runtime-key inventory、Node DEV scenarios、TER parser 与 generated API tests。Verdict 不变（`NO-GO 0/1/1`），没有新增 finding。仍未逐行检查所有无关生成 Java DTO、全部 skeleton/readability gates、所有 Android/Web adapter tests 和远端 runner 分支；Claude brief 保留这个覆盖边界。
- 独立 reviewer 的原始 NO-GO 与 M/S/N=0/1/1 如实保留；其 S-1 已由 Dexter 决策关闭，不据此改写独立 verdict。当前交付结论：**OPEN，待 Dexter 转 Claude 做整批复评**；N-1 的工程证据仍 OPEN。历史 `GO/MATCHED` 和本轮局部 package PASS 均不覆盖未运行的动态面。

### 5. Fresh 整批 review finding intake

#### IR-S1｜未知 TDS 消息类型未触发 transport invalid

**Classification: DEXTER_DECISION — 按 Dexter 明确裁决保留静默忽略，不修改生产处理或测试。**

- **Reviewer 依据**：需求 R-4.9 `:228` 将不认识的消息类型排除在字段前向兼容范围之外，要求维持现有处理；详设 V-T6 `:383` 的用例仅包括 `SESSION_READY`、`PONG` 未知字段。实现收到已 ready 后的未知 `type` 会从 actor handler 返回 `null`，测试在 `terminalDataClientActor.test.ts:717-725` 断言不调用 `transport.invalid`。
- **事实**：未知字段与未知消息类型是两个不同维度；D-43 只改字段行为。当前 client unknown-type 测试明确固定 no-op。TDS 对设备送来的未知类型由 `TerminalConnectionProtocol.message` 抛出并在 `TdsWebSocketHandler.receivePing` 路径关闭为 `UNKNOWN`，这是另一方向的既有行为。
- **推论边界**：本条没有要求设备收到未知服务端消息后调用 `transport.invalid`；reviewer 的 `PROTOCOL_INVALID` 建议会改变 TER 当前处理，而非恢复一个由 R-4.9/V-T6 明确要求的行为。`unknownApplicationMessage` 不能单独决定反方向客户端策略。
- **影响与处置**：不新增关闭或重连行为，保留已有无动作语义；按 Dexter 决策，本项关闭。
- **Dexter 裁决**：2026-10-01：“TER 客户端把未知 TDS 消息类型静默忽略”没问题，先忽略。该项关闭。
