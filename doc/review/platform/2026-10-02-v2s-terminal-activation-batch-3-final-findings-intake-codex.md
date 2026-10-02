# 批次三最终复评 findings intake 与受影响差量证据

日期：2026-10-02  
范围：Claude 转交的 S-1、S-2；主 agent 重开需求、详设、计划、owning source、测试及 OpenJDK 21.0.11+9 官方源码后独立处置。  
边界：不修改需求语义；不扩大批次；不运行 L2、reset、seed、UAT 或部署。

## Finding intake

### S-1｜PG open 已提交、latest readback 失败时未排断开

**分类：CONFIRMED。**

- 判据：需求 R-6.1、R-6.3、R-7.3；详设 CP-03 要求 PG 最新状态为权威、旧身份不得覆盖新状态，并在数据库故障时保留断开待写。
- 原实现：`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java` 的 registration 在 `repository.open` 成功后调用 `readCurrentSession`；异常分支原先只移除 pending、立即释放 permit 并关闭 socket。`connectionClosed` 只处理 active，因此 provisional candidate 不会自动补断开。
- 反例边界：该缺口仅在 PG open 已提交而后续权威 readback 抛异常时发生；`repository.open` 失败和 codec 失败已有其他路径，不能覆盖此窗口。
- 最小修正：改为只移除并关闭本 candidate，以其精确 `SessionIdentity` 调用既有 `TdsConnectionStateWriter.queueDisconnect(..., "SERVER_ERROR", callback)`；只有 writer 成功持久化该断开（或 PG 的更高 sequence 已证明旧写安全完成）后才释放 tracked permit。未用 `abandonOpenedSession`，避免连带关闭 previous active；未产生 candidate 的 `SESSION_READY` 或 CONNECTED 历史。
- 当前实现位置：`TdsTerminalSessionActors.java:404-413,634-652`。
- 反例证明：
  - `TdsTerminalSessionActorsTest.java:427-474`：成功 open 后让 readback 抛错，验证候选关闭、断开以精确身份排队、previous active 保持打开、permit 在 callback 前不能复用，且 candidate 未完成认证就绪。
  - `TdsConnectionStateWriterTest.java:60-95`：写断开失败时队列项保留，回调不执行，成功重试后才调用回调。
  - `TdsConnectionStateRepositoryPostgresIntegrationTest.java:130-145`：迟到的旧 identity 断开不覆盖较新 session sequence。
- 实际证据：受管 run `r5-tc-1790922142308-62713` 中 actor 22/22、PostgreSQL repository 3/3、state writer 3/3；这些类全通过。该 run 因当时 S-2 新测试中的一个不可靠 TCP 断言而整体 FAIL，不把整次运行标成 PASS；Testcontainers、卷、进程、workspace cleanup 均 PASS。此后三个 S-1 owning/test 文件未再变化。
- 剩余不确定性：尚未在 DB 故障下运行完整多节点业务场景；此 finding 的指定异常路径由 actor/state-writer/PostgreSQL focused proof 组合覆盖。

### S-2｜10 秒 deadline 未覆盖完整 HTTP 响应体

**分类：CONFIRMED。**

- 判据：需求 R-6.6；详设 CP-02 要求最多三次有限重试，响应体有界，Doris 写入不得拖慢主流程。
- 原实现：`HttpRequest.timeout` 单独限定请求，但实际运行 JDK 的计时器在响应头/filter 后取消，body 仍由后续的 `Exchange.readBodyAsync` 消费；同步 writer 会等待 `load` 返回，故 header 后 body stall 可能占住唯一 writer。
- 官方核验：DEV JDK 为 Java 21.0.11；按 `jdk-21.0.11+9` OpenJDK 源码检查 `MultiExchange.java`、`HttpClientImpl.java`、`Exchange.java`、`MinimalFuture.java`，并核对 Java SE 21 `HttpClient` API。链接：
  - https://github.com/openjdk/jdk21u/blob/jdk-21.0.11%2B9/src/java.net.http/share/classes/jdk/internal/net/http/MultiExchange.java
  - https://github.com/openjdk/jdk21u/blob/jdk-21.0.11%2B9/src/java.net.http/share/classes/jdk/internal/net/http/HttpClientImpl.java
  - https://github.com/openjdk/jdk21u/blob/jdk-21.0.11%2B9/src/java.net.http/share/classes/jdk/internal/net/http/Exchange.java
  - https://github.com/openjdk/jdk21u/blob/jdk-21.0.11%2B9/src/java.net.http/share/classes/jdk/internal/net/http/common/MinimalFuture.java
  - https://docs.oracle.com/en/java/javase/21/docs/api/java.net.http/java/net/http/HttpClient.html
- 最小修正：每次 load 建单调时钟总 deadline；以现有 JDK `sendAsync` future 限时等待发送、响应头和有界完整 body；到期 `cancel(true)` 原 exchange 并返回现有 `RETRY/REQUEST_TIMEOUT`；保留请求级 timeout 作头前保护、现有响应体上限、三次重试与稳定 label，不加第二套重试机制。
- 当前实现位置：`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsDorisStreamLoadClient.java:74-121`。
- 当前测试位置：[`TdsDorisStreamLoadClientTest.java`](../../../../apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/history/TdsDorisStreamLoadClientTest.java):121-190。真实本地 HTTP server 在发出 200 响应头和部分 body 后停顿；测试验证 body 停顿跨过响应头仍在总 deadline 返回 `REQUEST_TIMEOUT`、response future 异常链由取消触发、同一个 client 下一批成功。
- 实际证据：最新 focused run `r5-tc-1790922784201-75675`，2026-10-02T06:33:04.201Z–06:33:54.119Z；`TdsDorisStreamLoadClientTest` 4/4，Gradle test PASS，Testcontainers 前后容器/卷查询、进程清理、远端 workspace 清理全 PASS；业务=N/A。
- 首败与根因：
  1. `r5-tc-1790922142308-62713` 的首败把服务端小块 TCP 写入立即抛 `IOException` 当作取消判据；这不是可靠判据，因为 peer 关闭后少量写入仍可能被缓冲。deadline 和返回路径已通过该次测试前半段，actor/PG/state-writer 三类均通过。
  2. `r5-tc-1790922563742-71240` 将 `CompletableFuture.isCancelled()` 当作 JDK exchange 已取消的唯一表现。该 JDK `MinimalFuture.cancel` 先转发取消，exchange 可能先以异常完成，因此外层 future 不一定表现为 `isCancelled=true`。
  3. `r5-tc-1790922690400-73738` 断言 `join()` 直接抛 `CancellationException`；JUnit XML 显示组合 future 实际为 `CompletionException`，cause 是 `CancellationException("Request cancelled")`。
  4. 最小修复后的当前用例断言异常完成、`CompletionException → CancellationException` cause 链和既有超时语义；不更改生产取消策略。JDK 版本及实现证据已补入详设与计划。
- 剩余不确定性：测试证明精确 JDK、真实 HTTP header/body 停顿、JDK future 取消链和后续 client 请求可行；未模拟 Doris 服务端自身异常实现。Doris 侧仍受既有有限重试与稳定 label 规则约束。

## 影响范围与差量核验

- S-1 影响 TDS actor 的 candidate cleanup、PG latest row、state-writer disconnect queue 和 permit 生命周期；使用已有 owner/队列，不增加业务状态、历史副本或新的恢复框架。
- S-2 影响单次 Doris HTTP load 等待边界；不改事件格式、writer queue、重试次数、label、DDL、业务事务或 Doris 权限。
- 详设 CP-02/CP-03、计划 CP-02/CP-03 已同步新实现与测试落点。没有修改需求或 decision。
- 13c 影响检查：新增 actor helper 有唯一调用方与专用测试；cancel helper 被 load 的 timeout/interruption 分支调用；新增测试场景的 producer 是当前 test method/HTTP fixture；没有新增生成物或运行入口。
- CP-02/CP-03 本轮改动已另由 fresh reviewer 做阶段差量三维核对；整批 IMPLEMENTATION verdict 见下文独立复核记录。

## 当前与历史运行证据

- **当前字节上的最新运行：**DEV start `r5-dev-1790922860937-77212-d6aee404-6382-43b0-804f-b9becf3f5c3c`；2026-10-02T06:34:20.937Z 创建；远端 Java、三个 TDS listener、双 HAProxy WebSocket readiness 与本机双 Vite readiness 均 PASS；DEV 有意保留。未运行 seed/reset。
- **最后一次通过（针对本次代码）：**focused Testcontainers run `r5-tc-1790922784201-75675`；2026-10-02T06:33:04.201Z–06:33:54.119Z；S-2 用例所在测试类 4/4，business=N/A，cleanup PASS，与当前 S-2 代码一致。
- S-1 对应三个测试类在 `r5-tc-1790922142308-62713` 全通过，但该 run 因未修正前的 S-2 断言而整体 FAIL；报告分别记录其类级结果和 run 级失败。
- 默认 `scripts/verify`、完整 backend-acceptance、完整批次三动态验收未因本次窄 finding 修复重跑；任何旧字节结果不升级为当前全批 PASS。此前 seed/reset 记录也不由本报告重新认证。

## 独立整批复核

Fresh 只读 reviewer `/root/batch3_r4_fresh_impl_review` 已从需求、详设、生产源码与证据重新形成判断后，再对照本 intake；未改文件，也未运行任何动态动作。结论：**GO，M/S/N=0/0/0**。

- reviewer 核对 S-1 的设计 CP-03、candidate-only disconnect、精确 session identity、permit callback、旧 identity 不覆盖高 sequence，以及 previous active 仍可用；未发现新增 finding。
- reviewer 核对 S-2 的单次总期限、完整受限 body 等待、原 JDK future/exchange cancel、writer 的有界重试与相同 batch payload/label；未发现新增 finding。
- reviewer 另核 resident Doris 当前 credential adoption 与本轮改动无冲突。
- reviewer 明确只做静态源码及历史 artifact 检查；没有将旧全量验收/reset/seed记录升级为本轮动态证明。

这项整批静态 GO 与本报告的当前 focused 动态证明结合，关闭本轮 review intake。它不表示本轮重跑了完整 backend-acceptance、默认 `scripts/verify`、reset 或 seed；这些仍沿用各自既有字节与拓扑范围内的证据。

## CP 影响范围差量对账

Fresh 只读三维差量 reviewer `/root/batch3_s1s2_cp_delta_reconcile` 对受影响完整阶段核对需求、详设/计划与项目记忆，结论如下：

- **CP-02 delta：MATCHED。** CP-02 的 10 秒总 deadline 与完整受限 response body/取消路径相符；有界队列、有限三次重试、稳定 label/payload 均未被修改削弱。核验源码：`TdsDorisStreamLoadClient.java:74-114`、`TdsConnectionHistoryWriter.java:28-35,77-91,185-233`；测试：`TdsDorisStreamLoadClientTest.java:121-190`。
- **CP-03 delta：MATCHED。** PG sequence 仍为权威顺序；readback 异常只处置 provisional candidate，disconnect callback 控制 permit 释放，旧 identity 不覆盖新 session。核验源码：`TdsTerminalSessionActors.java:404-413,634-652`、`TdsConnectionStateWriter.java:62-66,102-130`、`TdsConnectionStateRepository.java:212-237`；反例测试：actor、writer、PostgreSQL repository 对应测试。
- 同根扫描未发现第二个 Stream Load client，也未发现另一条绕过 actor 的 `readCurrentSession` 登记路径。该对账没有运行测试或任何动态入口，也不覆盖未受本次修改影响的其他 CP。
