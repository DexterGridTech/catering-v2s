# 阶段一测试脚本与用例复核（Codex）

```text
REVIEW_TARGET=TEST_SCRIPTS_AND_CASES
AUTHOR=MAIN_AGENT
SCOPE=Batch 1 backend-acceptance, TDS wire client, TDS tests, scripts/verify test selection, and the formatter gate blocking scripts/verify
VERDICT=GO_FOR_TEST_HARNESS_AND_CURRENT_RUN
M/S/N=0/0/2
OVERALL_IMPLEMENTATION_REVIEW=CLAUDE_R3_PENDING
CURRENT_RUNTIME=r5-tc-1790697767533-50846
```

本记录只评估测试与验收链是否把客户端输入、服务端断言、日志相关性和清理证据接在一起，并记录本轮全量运行结果。结束时未关闭项为 `M/S/N=0/0/2`，仅含两条非阻断建议。它不替代 Claude 的整批 `REVIEW_TARGET=IMPLEMENTATION` 静态评审；阶段一逐代码与详设对账中的 13c 项仍以对应对账记录的 `OPEN` 状态为准。

## 复核结论

初始静态测试 review 提出 M/S/N=1/3/2。逐项重开源码后，三项 S 已有实现与回归断言，S-3 属于两个不同 stage 字段被混为一谈；N-1 在本轮确认并修复。M-1 的事实成立，但缺少单个 TDS scenario selector 是受管入口的效率限制，不是当前合同断言失效：`--operation` 表示业务目录 operation，单项 Java/Node focused proof 与 `--operation all` 的完整 TDS CONTRACT 仍可用。因此不为本轮临时增加第二套 CLI/分母语义，按非阻断建议保留。N-2 继续使用安全的通用失败分类，避免把未知异常文本（可能含凭证或 raw payload）写入日志。

本轮为报告修正过程发现并关闭了三个测试/门问题：

1. Java formatter 要求 `Map.entry` 单行，而该完整行超过 120 字符。把搜索范围描述提取为 `V_S11_SEARCHED_OUTPUTS` 常量，结构测试同时核对常量值和结果字段；`spotlessJavaCheck` 与 `backendJavaUtf8LineLimit` 通过。
2. 结构测试仍匹配 `markerId`，实际校验代码已使用 `requestMarkerId`。更新结构断言后，相关 Node 测试全通过。
3. 总静态门发现 `sampleAssembly.test.tsx` 的 Prettier 格式问题。只运行仓内 Prettier 对这个现存测试文件格式化，没有改其行为；`ter-format-check` 的 892 文件检查通过。

## Finding 处置

### 非阻断建议 1（原 M-1）：不能单独选择一个 TDS CONTRACT scenario

- **事实**：`scripts/test/backend-acceptance` 的 `--operation` 用于业务 operation；除 topology probe 外，TDS 场景 factory 在 operation 不为 `all` 时返回空流。[`scripts/test/backend-acceptance:7-8`](../../../scripts/test/backend-acceptance) [`BackendAcceptanceTest.java:818-830`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java) [`BackendAcceptanceTest.java:931-955`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java)
- **性质/状态**：仓内事实已确认；原评审 severity `M` 不成立，重新归为 `N`。TDS CONTRACT 被明确排除在业务 scenario catalog 之外，复用 `--operation` 接受 TDS id 会混淆两个执行面；新添独立 selector 还要定义仅跑 TDS 时的业务结果与 run-level 预算语义。
- **影响**：完整 TDS 受管合同失败时，目前不能只通过 `--operation` 重跑其中一条；Node/Java focused 单测可以缩小本地边界，但不能冒充真实 WebSocket CONTRACT。
- **最小建议**：只有出现真实排错成本或 Dexter 要求逐 TDS 场景远端重跑时，再为 CONTRACT 增加独立 selector、无效 id 红例和 `BUSINESS=NOT_APPLICABLE` 判据。本轮没有为效率收益引入第二套 selector；当前完整受管 run 已覆盖全部 49 条 TDS CONTRACT。
- **Dexter 裁决**：不需要，本轮作为非阻断效率建议。

### S-1：wire marker 等待超时诊断不完整 — 已关闭

- **当前事实**：`requireWireMarker` 区分客户端存活/退出，并带出最后安全 stage、SIGTERM 诊断和 TDS authentication trace；等待函数同时检查 marker 与客户端退出。[`TerminalConnectionContractScenarios.java:3535-3565`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java)
- **验证**：结构测试核对注册闸门与进程退出竞态保留安全诊断。[`backend-acceptance-structure.test.mjs:1247-1310`](../../../scripts/test/backend-acceptance-structure.test.mjs)
- **处置**：原 finding 已由此前代码修复，本轮未重复增加诊断抽象。

### S-2：撤销通知解析绕过 codec scheduler 缺回归证明 — 已关闭

- **当前事实**：`TdsBindingRevocationListener.poll` 在独立 `tds-revocation-listener` 线程同步解析并派发撤销；`tds-log-worker` 只承载日志。[`TdsBindingRevocationListener.java:34-55`](../../../apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListener.java) [`TdsBindingRevocationListener.java:129-171`](../../../apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListener.java)
- **验证**：单测 spy 真实 `ObjectMapper.readTree`，记录 parse 与 actor dispatch 的线程并断言二者都是专用监听线程。[`TdsBindingRevocationListenerTest.java:81-148`](../../../apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListenerTest.java)
- **处置**：断言位于实际解析调用点，因此若未来把解析移入另一个 codec worker，线程断言会失败；无需再引入一个拒绝调度器接口。

### S-3：Java 与 Node stage 白名单不一致 — 不成立

- **结论**：Node 的 `TERMINAL_WIRE_STAGE=...` 事件由 `SAFE_WIRE_CLIENT_STAGES` 校验；SIGTERM 行中的 `stage=...` 是单独字段，由 `SAFE_WIRE_SIGNAL_DIAGNOSTIC` 的枚举匹配。`WAITING_FOR_EXACT_BOUNDARY_SESSION_READY` 是 signal 诊断阶段，不是 `TERMINAL_WIRE_STAGE` 事件。review 把两类前缀混为一类。
- **证据**：客户端 stage allowlist 与 signal pattern 分开定义。[`TerminalConnectionContractScenarios.java:37-73`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java) 结构测试分别从 Node 源提取实际 wire 事件与诊断阶段并比较。[`terminal-ws-wire-client.test.mjs:176-220`](../../../scripts/test/terminal-ws-wire-client.test.mjs)
- **验证**：上述跨语言 allowlist 单测通过；无需把 signal-only 阶段加进另一套事件集合。

### 非阻断建议 2：未知 Node 异常统一记为客户端失败

- **事实**：已知稳定 `TERMINAL_WIRE_*` marker 按原类别输出；不认识的异常消息映射为 `TERMINAL_WIRE_CLIENT_FAILED`，不把异常原文写入输出。[`terminal-ws-wire-client.mjs:153-155`](../../../scripts/test/terminal-ws-wire-client.mjs) [`terminal-ws-wire-client.test.mjs:147-153`](../../../scripts/test/terminal-ws-wire-client.test.mjs)
- **处置**：保留安全兜底分类。按任意异常文本细分会有泄漏凭证/raw payload 的风险；需要更细的 failure category 时应增加稳定的错误 marker，而不是复制原始 message。
- **Dexter 裁决**：不需要，作为非阻断诊断建议。

### 已修复：多个 one-shot wire 场景共用日志（原 N-1）

- **事实**：topology probe、V-S14 与 `runWireClient` 均用请求 marker 生成独立日志文件；`startWireClient` 验证请求 marker 与日志文件名一致。[`TerminalConnectionContractScenarios.java:118-124`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java) [`TerminalConnectionContractScenarios.java:3164-3174`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java) [`TerminalConnectionContractScenarios.java:3493-3503`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java) [`TerminalConnectionContractScenarios.java:4122-4128`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java)
- **防回归**：结构测试核对 topology、one-shot、persistent 三条创建路径；Node 测试要求 topology/V-S14 marker 合法。[`backend-acceptance-structure.test.mjs:1177-1222`](../../../scripts/test/backend-acceptance-structure.test.mjs) [`terminal-ws-wire-client.test.mjs:225-280`](../../../scripts/test/terminal-ws-wire-client.test.mjs)
- **同根扫描**：TDS 目录中不再有 Java 测试代码直接写入 `terminal-wire-client.log`；远端 evidence aggregator 有意将所有 per-marker 日志合并到一个归档文件，供整次 run 下载，不会合并各场景的运行期输入流。[`r5-remote-testcontainers.mjs:78-88`](../../../scripts/test/r5-remote-testcontainers.mjs)

### 已修复：V-S11 结果声明的输出范围与实际递归扫描不一致

- **事实**：扫描遍历 TDS run 目录全部子目录，检查 `.log/.txt/.json/.jsonl/.out`；结果声明用同一命名常量报告递归范围。[`TerminalConnectionContractScenarios.java:1543-1556`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java) [`TerminalConnectionContractScenarios.java:1568-1579`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java)
- **防回归**：结构测试核对递归调用、后缀全集、命名常量和值引用，禁止恢复过时共享日志名。[`backend-acceptance-structure.test.mjs:1224-1245`](../../../scripts/test/backend-acceptance-structure.test.mjs)

## 当前字节验证

| 验证 | 结果 |
|---|---|
| `node --test scripts/test/terminal-ws-wire-client.test.mjs scripts/test/backend-acceptance-structure.test.mjs scripts/test/r5-remote-testcontainers.test.mjs` | PASS，95/95 |
| `./gradlew :apps:backend:catering-business-server:spotlessJavaCheck :apps:backend:catering-business-server:backendJavaUtf8LineLimit --no-daemon` | PASS |
| `node tools/terminal-shared/run-terminal-format.mjs --check` | PASS，892 files |
| `scripts/verify --validate-only` | PASS，48/48；数据库构造诊断仍为 2279 项 `OPEN_UNTIL_CAPTURE_OR_REVIEW`，非本轮测试失败 |
| `scripts/test/backend-acceptance --operation all` | PASS，run `r5-tc-1790697767533-50846` |

受管 acceptance 于 `2026-09-29T16:02:47Z` 至 `2026-09-29T16:13:45Z` 运行（本地 2026-09-30）。结果：198/198 HTTP 业务场景 `CONTRACT=PASS/BUSINESS=PASS`；TDS CONTRACT 49/49；其中 V-S14 压缩/帧场景为恰好 9 条，九个 ID 与 D-42 清单一致；296/296 operation identity，missing/extra/drift 均为 0，`UNCLASSIFIED_SQL=0`。TDS application type 为 `REACTIVE`，readiness RSS 229,132 KiB，停止前 257,448 KiB（512 MiB 预算）。前后 Testcontainers 容器/卷查询均 PASS、资源基线为空、远端 process identity 捕获 508 条，TDS 与远端 workspace 清理 PASS。`DEV_WAS_RUNNING=false`，本轮未停启 DEV。

D-43 在两档均有覆盖：Node focused tests 对 SESSION_READY/PONG 已知字段严格校验并忽略未知字段；真实 TDS CONTRACT 的 `terminal.connection.vs1.unknown-auth-field` 和 `terminal.connection.vs3.unknown-ping-field` 验证 AUTHENTICATE/PING 的未知字段通过实际 WebSocket 流程。[`terminal-ws-wire-client.test.mjs:324-359`](../../../scripts/test/terminal-ws-wire-client.test.mjs) [`TerminalConnectionContractScenarios.java:2841-2878`](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java)

`TERMINAL_VERIFY_DEBUG` 的第一次失败已保留在本会话输出：Java formatter 首先要求 `Map.entry` 单行；随后 UTF-8 行长门指出该单行 122 字符。修正为 120 字符边界内的命名常量后，相关 Gradle 两门、聚焦 Node 测试、全量 `scripts/verify --validate-only` 均通过。聚焦运行中唯一断言失败是结构测试还匹配旧变量名 `markerId`；修正为当前实现名 `requestMarkerId` 后 95/95 通过。第一次全量 verify 另发现一个现存 TER sample-console 测试文件的 Prettier 问题；按 Dexter 已授权的全仓 failing-script 修复要求仅格式化该文件，随后 TER format 门与全量 verify 均通过。

## 交付边界

本记录不声称 L2 在本轮变更后重新通过，也不声称 13c 已关闭；已有 L2 记录按其对应字节解释。Claude 第 3 轮整批实现静态 review 尚待 Dexter 转交。除测试脚本/测试代码和阻断全仓格式门的单文件格式修复外，本轮没有修改生产业务逻辑。
