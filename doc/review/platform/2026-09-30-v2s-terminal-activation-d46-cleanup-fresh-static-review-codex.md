# D-46 清理批 fresh 静态实现复核

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TERMINAL_ACTIVATION_D46_DEXTER_FRESH_STATIC_2026_09_30
REVIEW_ROUND=1（本次 Dexter 明确指派的 fresh 复核）
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/d46_fresh_review
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/3/0
L1_ENGINEERING=3 confirmed static findings
L2_USER_VISIBLE=NOT_APPLICABLE_TO_THIS_CLEANUP_SCOPE
L3_UNVERIFIED=current-source dynamic proof; proposed counterexamples not executed
DESIGN_GAPS=无新增判据缺口；S-3 是既有 D-42 与设计/实现不一致
TEMPLATE_COVERAGE=NOT_APPLICABLE_IMPLEMENTATION
EVIDENCE_TIER=STATIC_SOURCE_REVIEW + EXISTING_MANAGED_EVIDENCE_READ_ONLY
BUSINESS=NOT_RUN_THIS_REVIEW
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
```

本报告由主 agent 记录独立 reviewer 的 verdict，并逐条重开 owning source 后完成 intake。独立 reviewer 没有写文件或执行测试。S-1 由其独立源码分析发现；S-2、S-3 的攻击入口由主 agent 提出，reviewer 独立读取判据与源码后确认。作者自述只作导航，不作通过依据；不声称完全隔绝作者材料的盲审。

授权仅限 D-46 清理批静态实现评审。不运行测试、构建、生成器或动态环境，不修改实现，不覆盖 L2、reset、seed、UAT、部署、批次二/三，不要求重做或关闭整批 §13c。TER Android 优化是 Dexter 明确排除的既存并发改动，不列为 finding，也不要求撤销或改写。

## 输入与方法

请求正本：`doc/review/platform/2026-09-30-v2s-terminal-activation-d46-cleanup-implementation-review-request-codex.md`。

恢复入口、kernel、仓内 cs-review/cs-memory-recall、评审标准和第三方库使用标准。六维路由为 `review/backend/backend/backend/evidence/review`；独立 reviewer 完整读取 30 个命中 memory 原文（含六个 kernel）。recall wrapper 输出截断后直接读取 `scripts/memory/query` 的完整输出，并分段补读长原文。路由是原文导航，不升级为授权。

范围输入包括需求 D-42/D-46/V-S14、批次一详设与计划的适用段、共享协议、TDS README、第三方审计当前与历史分界、TDS 生产源码与相关测试、generator 与 generated DTO、code-layout、Java acceptance 场景、结构测试与 Node wire client，以及指定 run 的 manifest、结果、classpath、日志与测试报告。未声称通读不适用的全批详设，未进行 §13c 行级对账。

## Findings 与主 agent intake

### S-1：在途登记允许 actor 提前退役，破坏同终端登记串行

- **性质 / intake**：并发生命周期与权威最新状态一致性；`CONFIRMED`，静态可构造反例，未执行动态复现。
- **实现位置**：`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java:139` 取得 actor；`:292` 使用该实例的 registrationLock；`:340` 锁外 JDBC；`:160`、`:163` 连接关闭后按 idle 删除 actor；`:514` idle 仅检查 pending/active。`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateRepository.java:26` 在 SQL 执行时分配 sequence，`:45` 允许更大 sequence 覆盖最新状态。
- **详设判据**：`doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:437`、`:492` 要求 JDBC 不持状态锁，且同终端 registrationLock 保持登记串行。
- **反例与影响**：A 停在 JDBC 实际执行之前；A socket 关闭清除 pending，旧 actor 被移出 map；B 同终端创建新 actor，使用另一把锁，先完成登记与 SESSION_READY。A 随后执行 SQL 获得更新 sequence，覆盖 B 的 latest_state；A 回读发现已失效，写断开状态。最终数据库可显示 disconnected，而 B 仍在线，其 heartbeat 因身份不匹配不能更新。sequence fencing 不能排除这个执行顺序。
- **最小可验收修正**：保持 JDBC 锁外执行，将在途登记纳入 actor 生命周期，在进入 JDBC 前固定该状态，成功、异常、取消路径均释放后才允许退役。补确定性 latch 反例：A 在途关闭、B 开始登记、A 恢复，证明同终端仍由同一个串行 owner 处理，最终最新行属于 B，permit 正确释放。不要把 JDBC 移回 monitor，也不要引入全局锁或永久保留 actor。
- **同根扫描**：`isIdle()` 的 drain/失败处理、reject、connectionClosed、revoke、reconcile、removeIfIdle 共七处退役调用已核对，均应消费一致生命周期判定。现有 revoke/JDBC latch 测试只证明状态锁不阻塞撤销，未证明跨 actor 实例的登记串行。
- **Dexter 决策**：无需新增产品/权限裁决；既有判据足够。severity 与风险接受仍归 Dexter。

### S-2：`rive` 自身为根级符号链接时绕过精确空目录例外

- **性质 / intake**：机器门 fail-closed 缺口；`CONFIRMED`，静态分支反例，未运行自测。
- **实现位置**：`tools/code-layout/cli.mjs:100`–`:106` 只对 `entry.isDirectory()` 执行根目录准入。根级符号链接的 Dirent 不满足该条件。`:223`–`:243` 的自测只覆盖真实空 rive、目录内文件及目录内链接，没有覆盖 rive 自身为链接。
- **判据**：Dexter 本轮明确只允许精确的真实空根目录 `rive/`；请求的独立核验重点 3 要求 fail closed。
- **反例与影响**：根级 `rive` 指向非空目录时被 root loop 跳过；其余限定 apps/libraries/modules 的扫描不补偿该检查。门会接受不符合例外条件的输入。当前工作区 rive 确实是真实空目录，S-2 不声称当前目录已经违规。
- **最小可验收修正**：在适用该例外前确认 rive 自身为真实目录且为空；拒绝 rive 根项为符号链接。补自身指向空目录、非空目录的红例，必要时覆盖 dangling link。无需扩大为所有已知根目录的全新链接政策。
- **同根扫描**：根准入循环、例外集合与后续限定扫描已核对；现有 rive 正例及两个内容反例不覆盖根项类型。`.ccgui/` 已不存在，不恢复；未知空目录也不应获得泛化豁免。
- **Dexter 决策**：无需，按现有精确目录裁决修正。

### S-3：V-S14 仍以压缩方向作为硬验收条件

- **性质 / intake**：验收语义偏离明确裁决；`CONFIRMED`。
- **实现位置**：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java:2973`–`:2983` 要求 negotiated 会话客户端压缩类型为 AUTHENTICATE/PING，且服务端压缩类型非空；`scripts/test/terminal-ws-wire-client.mjs:1218`–`:1220` 在 negotiated 而服务端没有压缩响应时直接抛错。
- **需求 / 详设位置**：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:704` 明确排除“线路上两个方向是否出现压缩帧；协商了却不压缩的实现是否变红”。详设 `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:553` 仍写 both directions，需同步。第 586 行仅列 producer map，不误报该行有方向承诺。
- **影响**：用例拒绝 D-42 明确不作为验收的行为，使未来合法原生实现仅因发送策略变化而变红；现有九场景 PASS 不消除错误 oracle。
- **最小可验收修正**：删除 Java/Node 的方向硬断言，方向信息可保留为观察数据；保留压缩输入 fixture、offer/no-offer、解码内容、会话、精确边界与超限无副作用判定。用“已协商但服务端合法明文响应”正向反例证明不会仅因方向失败，并同步详设第 553 行。
- **同根扫描**：Java 场景 consumer、Node producer 的方向记录与报错，以及详设场景表/producer map 已核对；压缩输入 fixture 自身不需要删除，测试必须继续证明接收方解压与上界。
- **Dexter 决策**：无需重开压缩方向取舍，按 D-42 修正。

## 已核实事实

1. 共享协议分别声明 frame payload、native decompression buffer、完整解压消息三个 65,536-byte 边界及 overflow code 1009。TDS loader 分别读取，原生 inflater cap 与消息聚合器不是重复边界。
2. 实际 run classpath 记录 Reactor Netty **1.3.7** 与 Netty **4.2.18.Final**。当前 `.compress(true)`、maxDecompressionBufferSize、maxFramePayloadLength 参数链与 native decoder/aggregator 顺序已核对。Reactor Netty 对客户端 offer 的协商行为见 [1.3.7 WebsocketServerOperations](https://github.com/reactor/reactor-netty/blob/v1.3.7/reactor-netty-http/src/main/java/reactor/netty/http/server/WebsocketServerOperations.java)；解压 allocation cap 见 [4.2.18.Final ZlibDecoder](https://github.com/netty/netty/blob/netty-4.2.18.Final/codec-compression/src/main/java/io/netty/handler/codec/compression/ZlibDecoder.java) 与 [JdkZlibDecoder](https://github.com/netty/netty/blob/netty-4.2.18.Final/codec-compression/src/main/java/io/netty/handler/codec/compression/JdkZlibDecoder.java)。完整分片大小由独立 aggregator 在 ReactiveBridge 前限制。不是进程 RSS 的精确证明。
3. TDS 生产/测试与 wire client 已扫描旧自有 PMD 类引用；当前生产不依赖已删除组件，审计旧条目已清楚标为历史。Node core zlib 的压缩 fixture 与有限 raw-frame producer 不等于已退役生产 PMD 实现。
4. generator 敏感字段模板、生成 activation DTO 的 toString 遮蔽及 credential context 的脱敏闭环成立；不是仅手改生成产物。现有 secret 测试报告一例 PASS 已读。
5. TdsAsyncLog 保持异步有界调度，丢弃计数可见；合并 limiter 保留两类独立容量与幂等释放。冗余 persistence 参数及 stale audit allowlist 已移除；保留创建审计 deviceType 是有效反例，不误删。
6. N-4 未登记场景的结构红 fixture、N-5 设备/运营取消审计 actor/reason 内容断言、N-6 独立限制字段与硬编码红例源码已核对。这里是静态检查，不声称本轮执行它们。
7. `.ccgui/` 不存在，rive 是真实空目录。TER Android 并发改动不纳入 D-46 处置。

## 九个 V-S14 场景与已有证据

证据根：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790749796132-99308/`。result JSONL、BackendAcceptanceTest XML 与当前 Java/Node 场景身份逐一对应，九项均在已有 run 中记录 PASS。

| 场景后缀（统一前缀 terminal.connection.） | 已有结果 |
| --- | --- |
| compression.offer-none | PASS |
| compression.offer-bare | PASS |
| compression.offer-client-max-window-bits | PASS |
| compression.session-negotiated | PASS |
| compression.session-fallback | PASS |
| frame.exact-boundary | PASS |
| frame.raw-overflow | PASS |
| frame.compressed-single-overflow | PASS |
| frame.compressed-fragmented-overflow | PASS |

manifest 记录 TDS CONTRACT discovered=9/pass=9/fail=0，独立 REACTIVE TDS 进程；BUSINESS=NOT_APPLICABLE。进程/workspace/Testcontainers 容器与卷 cleanup 均记录 PASS。原始日志亦已读取；三个超限场景与无应用处理断言对应。压缩产物清单的压缩/解压 SHA 与 classpath SHA 已核对一致。这是读取已有运行证据，不是本轮重新运行得到的 PASS。

## 未能核实及证据边界

- 三项反例未执行，修复尚未发生；不将静态竞态表述为本轮实际发生的运行故障。
- 当前工作树未重新构建或动态验证。已有 run 的 jar hash 与产物一致性不能单独证明当前完整生产源码与运行字节完全相同。
- 指定 run 包含 secret 测试报告，但未在该 run 中找到 native inflater/overflow focused 单元报告；其测试源码已核对，作者声称通过不替代精确运行产物。本轮没有重跑以补证。
- 每连接逻辑容量是设计估算；未测量压缩状态的精确 JVM/native RSS。现有 run 的进程 RSS 记录不升级为每连接内存证明。
- UI/L2、reset、seed、UAT、部署、批次二/三均未验证；整批 §13c 继续 OPEN，且不作为本轮要求重做的 finding。

评审标准的 L3 未验证限制保留；本轮存在三项已确认工程 finding，且无 UI-bearing 授权，因此按 Dexter 要求给 NO-GO，不以 GO_WITH_UNVERIFIED_UI 替代。

## 输入绑定

| 输入 | SHA-256 |
| --- | --- |
| reviewer 30 项 memory 路径与 SHA 列表 | 574af59a777fae0f12289b04cac5c19747e8e4a03346e3e3be83fb44d2be3185 |
| 需求 | d5547971f87cf9041e162734de910db5a116d026faf91a73aaa9487e8d62ff28 |
| 详设 | c70c15c49bd0dfc38700f4c11b355c61064dd9bd76038b02e0eb7e6387ab3d0c |
| 实施计划 | d84ffa6bbb69a1792996fced14a6387b3bd85a783c958ee20d36775214d94d96 |
| actor | 45466ed9601a2877c61b0b82e3c14e2236762ccd2996e10db6d291919366deb2 |
| code-layout | d8abc06484662478509b48f1494fcdddae4b966a70346c7d31513e137a66e47a |
| Java wire 场景 | c3ad146ee3d71340168b43949510fa10954d9f7974ba336930f37884dbbb61d9 |
| Node wire client | 5e26ec7c1f4ac7cdf5a645e383c862001415465bf65b3051d3f02c62132f632a |
| run manifest | 8fc6a9e43d96964754ba271bc39c6bb3028205d4c0cfbe986060aaf12a797a63 |
| result gzip | 7e15870fd7e3c08a9b8768225ecdf142dfbc532fa055f7dc4d855be123230152 |
| classpaths | 29ab720a0fab14f3b08b4f3ca2d672cf507222eeeb7eb0f711f51792076ea6ab |

## 可转交 Codex 的结论

本轮 D-46 fresh 静态 IMPLEMENTATION 复核 NO-GO，M/S/N=0/3/0。请按本报告三条 S finding 独立重开正本与 owning source 做 intake：保留在途登记期间的同终端 actor 生命周期；封闭 rive 根项为符号链接的例外绕过；移除 Java/Node 的压缩方向硬 oracle 并同步详设 553。三项均有既有判据，无需新增产品决策。实现修正与验证须遵守届时 Dexter 授权，本次评审本身不扩张为动态执行授权。不要撤销并发 TER Android 改动，不重做整批 §13c，不扩到批次二/三。修正后报告逐条分类、最小修正、focused proof 与未覆盖项，再交 fresh 独立 IMPLEMENTATION 复核。
