# 终端激活与长连接批次二：过滤后 Review Intake 与处置

日期：2026-10-01  
范围：Claude 过滤后的批次二实现 review（S-1、S-2、S-3、S-4、S-7）；只记录已授权范围内的工程修正、证据和整批复核。  
结论：`GO`，fresh 整批 `REVIEW_TARGET=IMPLEMENTATION` verdict 为 `M/S/N=0/0/1`。N 的内容与未验证边界见 §5。

## 1. Intake 原则与结论

每项均重开当前 owning source、需求条款和详设，不将评审建议直接视为事实。下表中的行号对应当前工作区字节。

| Finding | 分类 | 判定与根因 | 最小修正及当前证据 | Dexter 裁决 |
|---|---|---|---|---|
| S-1 同一业务激活操作可能生成多个秘密 | `CONFIRMED` | [需求 R-1.6](../../plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md)、详设 CP-03/§7 所要求的同次操作秘密重用，不能只以客户端提供的 `operationId` 定义操作身份。设备身份读取含 `await`，多个根 command 可在读取前捕获同一旧状态。 | 在身份读取完成后重读 actor state；优先匹配同 `operationId`，否则复用同集团空间与激活码的未完成业务激活；deviceId、surfaceForm、appVersion 不一致时拒绝；只在找不到匹配操作时生成并登记秘密。没有加入全局队列、epoch 或通用 replay。focused 并发/重试、参数冲突、响应倒序测试见 [`terminalDataClientActor.test.ts:221`](../../../apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts)。 | 不需要 |
| S-2 连续合法 PONG 仍可能触发心跳超时 | `CONFIRMED` | [需求 R-5.3](../../plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md) 要求按有效 PONG 维护存活；旧 deadline 仅由首个 PING 建立，pending 未清空时不会因后续有效 PONG 重新计时。 | seq 匹配且字段有效的 PONG 记录 RTT 并重设存活 deadline，保留 seq 匹配语义。测试覆盖仍有其它 pending seq 时持续有效 PONG，以及无 PONG 超时，见 [`terminalDataClientActor.test.ts:1024`](../../../apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts)。 | 不需要 |
| S-3 恢复持久身份后没有自动建连入口 | `CONFIRMED` | [需求 R-9.9](../../plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md) 要求恢复已持久身份后恢复连接；原 runtime 只恢复 state，需由初始化路径触发既有 client connect command。 | hydration 后 module install 派发 initialize；actor 仅在有 credential 时调用既有 `connectTerminalCommand`。无 credential 不建连。runtime restart 与无身份用例见 [`runtimeStartup.test.ts:128`](../../../apps/terminal/kernel/base/terminal-data-client/test/runtimeStartup.test.ts)。 | 不需要 |
| S-4 本地取消开始后未立即禁止建连 | `CONFIRMED` | [需求 R-9.6](../../plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md) 要求取消期间不得恢复/建立连接；旧实现先 await transport stop，之后才设置 cancelling。 | 本地取消同步进入 cancelling，再等待 stop；connect 在 cancelling 期间拒绝，stop 失败保持可见。等待和 stop 拒绝反例见 [`terminalDataClientActor.test.ts:1134`](../../../apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts)。未要求跨独立 root command 共享 reset，也未改 dispatcher。 | 不需要 |
| S-7 生成器子文件符号链接可能越出仓根 | `CONFIRMED` | [D-41](../../../AGENTS.md) 要求所有数据输入路径在仓根内。此前只校验 package 目录，未校验其下两个实际读取文件的解析后完整路径；未发现当前已有逃逸链接，风险来自路径校验缺口。 | `package.json` 与 `src/moduleName.ts` 的完整路径分别复用 `resolveInsideRoot`；既有 generator self-test 对两种链接添加仓外目标红例，verify 门检查两个 marker。见 [`terminal-client-api.mjs:161`](../../../scripts/generate/terminal-client-api.mjs) 与 [`verify.mjs:59`](../../../tools/verify-gates/verify.mjs)。 | 不需要 |

## 2. 撤回、裁决与保留项

- Claude 原 S-5（主动 disconnect 延迟清理）已撤回：现有判据未规定相应延时语义，本次不为此修改源码。
- Claude 原 S-6（共享 runtime registry 重复释放）已撤回：首次退订失败已进入脱敏异常与 cleanup 聚合；规范未要求重复释放保证。本轮不扩展 registry；首次失败仍不得记为 PASS。
- 未知 TDS 消息类型保持静默忽略：这是 Dexter 已作出的行为裁决，本轮没有改动。
- N-1「timer command 失败后生产自动恢复」为 `UNVERIFIED_REQUIRES_EVIDENCE / OPEN`。现有测试手动重派 captured payload 不能证明生产自动恢复，也不能证明生产必然停滞；没有真实失败证据，不增加恢复框架。

## 3. 当前字节 focused 验证

| 验证 | 结果 | 证据边界 |
|---|---|---|
| terminal-data-client package tests | PASS，8 files / 31 tests；2026-10-01 12:30:38Z | focused package proof，不等同于受管业务验收。日志：`.runtime/review/terminal-activation-batch-2-filtered-r2/terminal-data-client-test.log` |
| terminal-client-api generator `--check` 与 `--self-test` | PASS；两个完整子文件 symlink 红标记均 PASS；2026-10-01 12:30:45Z | 生成器输入闭包 proof。日志：`.runtime/review/terminal-activation-batch-2-filtered-r2/terminal-client-generator.log` |
| `scripts/verify --validate-only` | PASS，49/49，exit 0；run `ter-local-static-26031-1790858238313`，2026-10-01 12:35:13Z–12:40:52Z | 只证明 validate-only。默认 `scripts/verify` 不得由此升级为 PASS。 |

## 4. 受影响动态证据与未受影响证据

受影响的 DEV 场景 E1、E2、E5、E6 均在同一个受管 DEV `r5-dev-1790849302252-25524-b0bf6fe5-2072-4e10-a69c-18ee8fdab058` 上按单场景运行；每次 `business=PASS`、fixture cleanup `PASS`、runner cleanup `PASS`、`firstFailure=null`。执行版本为 Node `v24.13.0`、Vitest `4.1.10`、Undici `8.11.2`。

| 场景 | Run ID | 开始时间 UTC | 结果 |
|---|---|---|---|
| E1 `terminal.dev.lifecycle-and-compression` | `ter-client-dev-1790858987277-42532-586dd501-944e-4abf-abdc-fa8f34531f0d` | 2026-10-01 12:49:47Z | business / fixture cleanup / runner cleanup：PASS / PASS / PASS |
| E2 `terminal.dev.entry-address-failover` | `ter-client-dev-1790859090876-44778-92c42c8e-c1f0-424e-a498-50a4ed7f46ef` | 2026-10-01 12:51:30Z | business / fixture cleanup / runner cleanup：PASS / PASS / PASS |
| E5 `terminal.dev.two-device-rebind` | `ter-client-dev-1790859100693-45153-080e8e69-e5a8-4270-b5b1-69c3c3a2970b` | 2026-10-01 12:51:40Z | business / fixture cleanup / runner cleanup：PASS / PASS / PASS |
| E6 `terminal.dev.three-node-two-entry-handoff` | `ter-client-dev-1790859109561-45522-73364c97-5008-4652-9273-6562e392ebad` | 2026-10-01 12:51:49Z | business / fixture cleanup / runner cleanup：PASS / PASS / PASS |

E6 是本轮最新受影响动态运行，也是最后一次通过；它对应上述当前 TER source bytes。所有 E 运行的 manifest 与日志位于 `.runtime/ter-client-dev-acceptance/` 对应 run 目录。更早 V-T17 曾首败，failure code `WEB_PLATFORM_PORTS_COUNT_INVALID:terminal.admin:ports:summary:available`，cleanup PASS；该首败保留。当前 V-T17 后续 run `ter-v2s-vt17-20261001-01` 为 `sourceStable=PASS`、business PASS、cleanup PASS，未改写首败。

V-B15 最近历史通过 `r5-tc-1790840460165-42576` 覆盖真实 HTTP 的 `storeTerminalActivationUnknownFields`、TDS CONTRACT 与 cleanup；V-S15 最近历史通过 `r5-tc-1790835825346-33524` 覆盖 TDS readiness/drain。当前 backend/TDS 源码树摘要与先前记录一致，故沿用这些历史证据，不重跑未受影响字节，也不将其表述为本轮新 run。Android/VM/设备 parity、Browser L2、UAT 与生产部署不在本轮范围。

## 5. 对账、整批独立复核与最终状态

- Fresh CP-01 受影响子范围、CP-03 与整批 6b 均为 `MATCHED`；13c 当前增量复核为 `MATCHED`。详细输入与证据见 [13c 记录 §9](2026-10-01-v2s-terminal-activation-batch-2-13c-codex.md#9-过滤复评修正后的当前字节增量对账)。
- Fresh 整批 `REVIEW_TARGET=IMPLEMENTATION` 对抗复核：`GO`，`M/S/N=0/0/1`，无 `DESIGN_GAPS`。唯一 N 是默认 `scripts/verify` 尚无完整 PASS；当前 `--validate-only` 不是替代证据。历史默认 verify run `r5-verify-69267-1790842907944` 保持 `INTERRUPTED/NO_VERDICT`。
- 过滤 intake 遗留 timer 自动恢复项仍为 `UNVERIFIED_REQUIRES_EVIDENCE / OPEN`，无生产故障证据；不新增恢复机制。它是单独保留项，不应伪装成当前 fresh review 已发现的故障。
- 当前字节上的最新受影响动态运行：E6，run `ter-client-dev-1790859109561-45522-73364c97-5008-4652-9273-6562e392ebad`，2026-10-01 12:51:49Z 开始，business PASS、fixture cleanup PASS、runner cleanup PASS。
- 最后一次通过：同一 E6 run；对应当前 TER source bytes。默认 `scripts/verify` 仍为 INTERRUPTED/NO_VERDICT，不能标 PASS。

## 6. 本轮不包含

本轮没有重开已关闭的 DESIGN cycle，没有修改需求或 Journey，没有扩大批次三范围；没有新增 DEV、reset/seed、L2、UAT 或部署执行。未验证项目均如实保留为未验证。
