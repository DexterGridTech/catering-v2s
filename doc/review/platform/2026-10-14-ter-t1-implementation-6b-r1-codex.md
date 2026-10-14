# TER T1 全批 6b 独立三维对账 R1

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
`BATCH_GATE=6b`
`REVIEWER=/root/t1_batch_6b_r1`
`VERDICT=OPEN`

## 结论与范围

fresh 独立 reviewer 在依据当前需求、详设、项目记忆与生产源码形成判断后，报告全批 6b 为 `OPEN`。此结论不等于整批实现 `GO/NO-GO`，也不证明动态验收；6b 未闭合时不得开始 CP-06 整体动态验收。

## Finding

### 6b-S1 · package root exports 与 `publicExports` 不一致

- 判据：需求 R-15/V-03/V-18；详设 §8.4、§9、§11a V-18；计划 CP-05 与 CP-05 后的全批 6b 门。
- reviewer 证据：TypeScript checker 对 `src/index.ts` 与 `terminal-invariants.json.publicExports` 比较后，发现以下包的实际根导出未列入 invariant：`kernel/base/platform-ports`、`remote-control`、`server-config`、`state`、`terminal-update`、`topology`、`transport`、`kernel/feature/sample-member-registry`、`sample-staff-session`、`ui/base/dev-host`、`feature-assembly`、`integration-assembly`、`primitives`。
- 事实：主 agent 独立以当前 workspace 各包 TypeScript checker 复核，当前拥有 `publicExports` 声明的 35 个 package 中，13 个有缺项，合计 75 个未声明的 root export，未见 invariant 多列项。reviewer 报告的 13 个包集合与主 agent 的集合一致；其报告分母 31 与主 agent 按当前文件系统和 field 计算出的 35 不同，处置以可复现的当前 35-package scan 与目标 mismatch 列表为准。
- 影响：维护清单不能完整描述当前公开包根表面，同族遗漏可能再次进入消费者，V-03/V-18 尚未闭合。
- 最小修正：保留当前 source root public API，精确同步 13 个 `terminal-invariants.json`；在现有终端结构门加入 TypeScript exact-set 检查和真实少列红例，另以 wildcard mutation 验证 root barrel 必须具名。未新增业务出口、兼容层或恢复框架。
- 主 agent disposition：`CONFIRMED`。

reviewer 提到计划中的源码语义对读文件路径原先尚不存在。该记录现在已在 `doc/review/platform/2026-10-13-ter-t1-implementation-source-review-codex.md` 落档，且明确不是独立 verdict。

## 独立性边界

reviewer 披露其最终 verdict 前的一次 broad `rg` 包含作者 intake/evidence 路径；其 OPEN 依据为当前正式需求、详设和 root/invariant source bytes，而非作者结论。该限制随原始 verdict 保留。主 agent 的独立 scan 与 fix 不冒充 fresh reviewer；修复后必须另由 fresh reviewer 复核。

## 证据边界

R1 未运行测试、构建、verify、DEV、Expo Web、Android 或设备场景，未读取运行 evidence。CP-05、全批 6b、CP-06、13c 与整批 IMPLEMENTATION 状态须各自报告，不得合并。
