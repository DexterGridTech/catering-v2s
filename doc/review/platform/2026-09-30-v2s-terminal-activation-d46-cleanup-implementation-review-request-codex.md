# 批次一 D-46 清理批 · 实现静态评审请求

## 背景

D-46 是批次一之后、批次二详设之前的独立清理工作。本轮按授权完成生成 wire secret 的 `toString()` 遮蔽、改用 Reactor Netty 原生 `permessage-deflate`、保留非阻塞且可见丢弃数的 `TdsAsyncLog`，以及 actor 写库锁、重复 limiter、冗余参数和审计 allowlist 的清理；并补齐场景发现和审计内容断言。

一轮主 agent 之外的只读对抗复核指出两个已确认问题：第三方库审计还把已删除的 PMD 组件当作当前实现，`code-layout` 曾泛化放行任意空根目录。二者已按最小范围修复。读回文档时另发现 TDS README 仍描述 128-byte 压缩阈值和双方不保留上下文；现已按 D-42 与 Reactor Netty 实际默认值改正。

整批 §13c 行级对账仍是 `OPEN`。Dexter 已表示避免重复进行整批对账；本评审只请求检查 D-46 清理范围，不声明批次一整体交付已就绪。

## 评审目标

请依据当前需求、详设与实施计划，对 D-46 的当前实现及测试作一次 fresh、独立、只读的 `REVIEW_TARGET=IMPLEMENTATION` 评审。重点确认原生压缩上界和应用边界、删除旧手写实现后无残留、D-46 各清理项的调用闭环/反例，以及下列修复是否准确而不过度。

## 已有证据与修复记录

- **S-1（第三方审计过时）已修复**：审计文件新增 D-46 当前实现与官方发布源码区段，逐项记录实际解析的 Reactor Netty 1.3.7 / Netty 4.2.18.Final、客户端提出才启用的 `compress(true)`、65,536 解压 buffer 上限、完整消息聚合器、1009 映射及当前 V-S14 证据；D-46 前代码和表格现明确标成历史快照。详设已说明旧成员清单是历史，引用当前区段。
- **S-2（空目录白名单过宽）已修复**：`tools/code-layout/cli.mjs` 仅允许已知的空 `rive/` 根目录。`.local-tool/prompts/` 空目录失败；含文件或符号链接的 `rive/` 失败；未知含源码根目录仍失败。最新 `scripts/check/code-layout --self-test` 逐条输出上述绿/红 marker 并以退出码 0 结束，`scripts/check/code-layout` 输出 `CODE_LAYOUT=PASS`。
- **追加 finding S-1（在途 actor 提前回收）已修复**：`TdsTerminalSessionActors.register` 在并发 map 原子区间内先 pin 当前 actor，并在 `finally` 释放在途计数；`isIdle` 只有在 pending、active、registrationsInFlight 都为空时才成立。确定性竞态测试 `inFlightRegistrationRetainsThePerTerminalActorAndLockAfterRevocation` 阻塞旧登记写库、撤销代次、验证 actor 仍被保留，再发起新代次登记，断言新写入未越过旧锁且写入顺序不反转。远端 run `r5-tc-1790752760245-71591`：`TdsTerminalSessionActorsTest` 18/18，JUnit 0 failures/errors/skips；`RESOURCE_CLEANUP=PASS`。
- **追加 finding S-2（根级 rive 符号链接绕过）已修复**：`tools/code-layout/cli.mjs` 对精确空目录例外先要求根项为真实目录，再检查空内容；根项本身为指向空目录的符号链接时以 `REPOSITORY_ROOT_DIRECTORY_NOT_ALLOWED:rive` 失败。红夹具 marker `RED_FIXTURE_SYMLINK_RIVE_ROOT=PASS`，`scripts/check/code-layout --self-test` 与 `scripts/check/code-layout` 均通过；实际空根 `rive/` 仍保留。
- **追加 finding S-3（普通会话强制压缩方向）已修复**：Java acceptance 和 Node wire client 仍验证协商结果，但不再断言普通 AUTH/PING/SESSION_READY/PONG 必须由任一方向压缩；压缩超限场景仍明确发送压缩数据。详设 §11 的 `terminal-connection-compression-bounds` 改为普通 JSON 会话不限定方向。Node wire-client 测试 23/23；远端 run `r5-tc-1790752957090-75609` 的 V-S14 九场景 9/9，TDS CONTRACT 0 failures、`RESOURCE_CLEANUP=PASS`（`BUSINESS=NOT_APPLICABLE`，此 run 为 TDS contract-only）。
- **README 旧压缩承诺已修复**：README 现在描述原生 PMD、仅客户端提出时协商、独立 inflater 与完整消息上限、共享 1009；不再承诺 128-byte 阈值、控制帧压缩结果或双方 no-context takeover。
- **N-6 核验结果**：未确认存在重复或错位的协议边界。共享协议分别列出帧 payload、解压 buffer、完整解压消息与超限关闭码；`TerminalConnectionProtocol` 从共享契约读取全部字段；`TerminalConnectionProtocolTest` 断言这些值；结构红夹具把解压上限改成硬编码时会报 `TDS_PROTOCOL_DECOMPRESSION_LIMIT_NOT_READ_FROM_CONTRACT`。这三项 65,536 是同数值、不同处理边界，不应合并为一个运行时上限。
- **当前字节全量静态验证**：本轮三个追加 finding 修复与格式调整后再次运行 `scripts/verify --validate-only`，完成 `EXECUTED=48/48`、`TERMINAL_STATIC=PASS`、`R5_VERIFY_VALIDATE_ONLY=PASS`、`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`。数据库 SQL 构造诊断照门的既定状态输出 `OPEN_UNTIL_CAPTURE_OR_REVIEW`，不属于本轮 failure；code-layout 根级符号链接红例与正向门均通过。
- **D-46 管理型线路验证**：run `r5-tc-1790749796132-99308`，2026-09-30 06:29:56.132Z–06:31:40.089Z。TDS CONTRACT `discovered=9, pass=9, fail=0`，九个 V-S14 场景全部通过；TDS 为单独 `REACTIVE` 进程，RSS readiness 234,516 KiB、停止前 257,140 KiB，低于 512 MiB；远端进程、workspace、Testcontainers 容器/卷 cleanup 全部 `PASS`。这是 TDS contract-only 运行，`BUSINESS=NOT_APPLICABLE`。
- **单元 proof**：生成 wire secret 遮蔽测试、native 解压 cap 测试及超限到共享关闭码映射测试均通过；其源码/报告见下方文件与本次验证产物。

## 最终独立审查的 finding intake

最终只读对抗复核原始结论为 `NO-GO M/S/N=0/1/0`，唯一 finding 指向工作区中 TER Android 优化文件，要求将其移出 D-46。主 agent 对该 finding 的处置为 `REJECTED_WITH_EVIDENCE`：这些 TER 路径在 D-46 开始前的首次状态快照中已经修改，且本批授权范围仅为服务端 D-46；Dexter 也已说明另一个 agent 正在处理 TER 优化。因此它们是并发的范围外工作区改动，不由 D-46 引入，也不能为满足 D-46 评审而撤销或改写。对应路径为：

- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
- `apps/terminal/application/android/sample-terminal/android/app/build.gradle`
- `apps/terminal/application/android/sample-terminal/package.json`
- `apps/terminal/application/android/sample-wallpaper-terminal/android/app/build.gradle`
- `apps/terminal/application/android/sample-wallpaper-terminal/package.json`
- `apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingRegistry.kt`
- `apps/terminal/application/base/android/android/src/test/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingDispatchTest.kt`
- `scripts/test/ter-virtual-keyboard-android.test.mjs`

按 Dexter 最新要求，仓库根目录 `.ccgui/` 已不存在，空的 `rive/` 目录保留；`code-layout` 仅允许这个精确的空根目录，不放行其他未知空目录。该范围外 finding 不改变 D-46 服务端清理范围的结论；整批 §13c 对账仍为 `OPEN`。

## 需阅读文件

- `AGENTS.md`：仓库授权、验证、评审和写入边界。
- `doc/platform/review-standard.md`、`doc/platform/third-party-library-usage-standard.md`：实现复核格式与第三方库精确版本证据规则。
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`：D-37、D-42～D-48 等需求与裁决。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`：D-46 详设、压缩边界、测试映射与容量。
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`：D-46 实施范围与验证顺序。
- `contracts/protocol/terminal-connection-protocol.json`：运行时读取的共享消息与限制契约。
- `apps/backend/terminal-data-server/README.md`：TDS 使用与配置说明；本轮同步修复其压缩行为说明。
- `doc/review/platform/2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md`：D-46 当前官方依据与显式历史区段。
- `tools/code-layout/cli.mjs`：精确的 `rive` 空根例外及红/绿自测。
- `scripts/generate/edge-codegen.mjs`、生成的 terminal wire 请求 DTO，以及 `TerminalActivationSecretToStringTest`：敏感字段模板与 proof。
- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/`：WebSocket 原生压缩、pipeline 聚合及超限映射。
- `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/websocket/TdsNativeDecompressionLimitTest.java`、`TdsMessageSizeCloseHandlerTest.java`：有界解压与 1009 proof。
- `scripts/test/terminal-ws-wire-client.mjs`、`scripts/test/backend-acceptance-structure.test.mjs`、相关 `*AcceptanceScenarios.java`：九场景生产器、选择器与场景/断言结构。
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790749796132-99308/run-manifest.json`、`tds-contract-result.jsonl.gz`、`backend-runtime-classpaths.txt`：实际版本、场景及 cleanup 证据。

## 独立核验重点

1. 用 Reactor Netty 1.3.7 与 Netty 4.2.18.Final 官方版本源码确认：客户端未提出时不协商；inflate 期间受 65,536-byte buffer cap；完整分片消息在 `ReactiveBridge` 前受 aggregator 限制；1009 发生在解析、认证、登记、写库之前；每连接压缩状态计入容量。
2. 确认 TDS 与 wire client 当前源码/测试不再依赖被 D-46 退役的 PMD 自有组件；审计正文里它们只作为清楚标记的历史事实出现。
3. 按本轮列出的红/绿夹具核验 `rive` 精确例外和根目录 fail-closed 行为，不接受对所有空根目录的泛化放行。
4. 逐项核 generator 模板脱敏、actor 锁外 JDBC、限流器合并、删去冗余参数/审计字段、N-4 场景漏登记红例和 N-5 审计 actor/reason 内容断言。
5. 核验 N-6 的独立协议字段是否真是不同限制层；检查共享契约、TDS 加载器、focused test 和硬编码红例一致。
6. 确认九个 V-S14 线路场景的场景身份与当前 run 结果逐一对应。动态运行证据已列出，不要求你重跑测试或动态环境。
7. 保留边界：本次不关闭整批 §13c `OPEN`，不覆盖 UI/L2、批次二/三、reset、seed、UAT 或部署。工作区中的 TER Android 优化改动属于本批开始前已存在的并发范围外改动，不要以 D-46 finding 处置为由改写它们。
8. 检查在途登记是否阻止 actor 被 idle 回收，且竞态 proof 确实覆盖撤销期间旧/新代次共用同一登记锁。
9. 检查根级 `rive` 符号链接被拒且精确空真实目录仍允许；检查普通会话不再要求压缩的单一方向，同时仍核实协商、超限反例。

## 期望结论

请给明确 `GO` 或 `NO-GO` 及 `M/S/N`。每个 finding 写精确仓库相对路径与行号、性质、影响、最小可验收修正及是否需要 Dexter 决策。请分列核实成立事实、尚不能核实项目，并声明本轮是否运行测试/动态环境。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《终端激活与长连接》批次一 D-46 清理批做一轮独立静态实现复核。

背景：D-46 是批次一之后、批次二详设之前的独立清理。本轮已完成 generator wire secret 的 toString 遮蔽、改用 Reactor Netty 原生 permessage-deflate 与有界解压/聚合、TdsAsyncLog 选择及批次内剩余清理。主 agent 已运行 scripts/verify --validate-only，并完成 9 个 V-S14 TDS managed contract 场景。上一轮和追加复核的 S-1～S-3 均已按“已有证据与修复记录”修复和复验，请据当前字节独立核实。

目标：请独立核验 D-46 当前实现是否符合批准详设、共享契约、第三方库实际解析版本的官方行为及当前验收证据，并审查本文件所列修复是否闭环且无过度设计。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、doc/platform/review-standard.md、doc/platform/third-party-library-usage-standard.md：治理、评审及官方依据要求；
- doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md：批准需求与裁决；
- doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md 与 doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md：详设、实施范围与验收；
- contracts/protocol/terminal-connection-protocol.json、apps/backend/terminal-data-server/README.md 与 doc/review/platform/2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md：当前契约、说明及第三方官方依据；
- tools/code-layout/cli.mjs：rive 精确目录例外及红/绿测试；
- scripts/generate/edge-codegen.mjs、相关 wire DTO/测试、apps/backend/terminal-data-server/src/main 与 src/test、scripts/test/terminal-ws-wire-client.mjs、scripts/test/backend-acceptance-structure.test.mjs、相关 AcceptanceScenarios：实现、测试和场景映射；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1790749796132-99308/run-manifest.json、tds-contract-result.jsonl.gz、backend-runtime-classpaths.txt：九个场景、解析版本与清理证据。

请重点核验本文件“独立核验重点”，尤其是 65,536 解压过程/整条消息两层上限、N-6 是否成立、过时 PMD 说明是否全部标为历史，以及 `.ccgui` 已不存在且只保留空 `rive/` 根目录。

烦请给出明确 GO/NO-GO 和 M/S/N。每项写路径与行号、性质、影响、最小可验收修正和是否需要 Dexter 决策，并分列成立事实与未能核实项目。工作区中 TER Android 优化文件在 D-46 开始前已经修改，属于范围外并发改动；请评审时勿要求 D-46 撤销或改写这些文件。仓库根 `.ccgui/` 已删除、空 `rive/` 保留，code-layout 对此只有精确目录例外。

授权边界：只做 D-46 清理批静态实现评审。不要运行动态验证，不涉及 L2、reset、seed、UAT、部署、批次二或批次三。整批 §13c 对账仍 OPEN，本请求不要求重做该对账，也不声称批次一整体已可交付。谢谢。
```
