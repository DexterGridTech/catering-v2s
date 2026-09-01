# TER kernel.base.runtime Unit B implementation review request

## 背景

TER `kernel.base.runtime` 单元 B 已按冻结详设完成实施，并在 Claude 第一轮 IMPLEMENTATION review 后闭合 1M/1S/2N。Codex 已重新运行授权内 TER-local 验证，并更新实施证据与 HANDOFF。

本次请求 Claude 对当前字节做 fresh 独立 IMPLEMENTATION review；不要采信 Codex 证据自述，需重开源码、测试、工具与新鲜输出对应的文件。

## 评审目标

请独立判断 Unit B 的 request ledger、selector、lifecycle ledger writer、cleanup actor 与验证工具是否真的满足需求与详设；重点找“所有判据通过但 runtime 仍没建成或 request ledger 错误”的路径。

## 需阅读文件

- `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md`：Unit B 需求与判据。
- `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-design-codex.md`：Unit B 冻结详设与实施计划。
- `doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-review-claude.md`：上一轮 IMPLEMENTATION review 的 1M/1S/2N。
- `apps/terminal/kernel/base/runtime/src/`：Unit B 当前生产源码。
- `apps/terminal/kernel/base/runtime/test/`：Unit B 当前测试与类型夹具。
- `tools/terminal-runtime/`：runtime 静态门与 red mutation model。
- `tools/terminal-skeleton/verify.mjs`、`tools/terminal-skeleton/verify-static.mjs`、`tools/terminal-skeleton/verify.test.mjs`：TER-local 验证接线。
- `doc/evidence/platform/terminal-kernel-base-runtime/implementation-b-codex.md`：Codex 实施证据与本轮修复输出。
- `apps/terminal/kernel/base/runtime/HANDOFF.md`：Unit B 当前边界与欠账登记。

## 独立核验重点

- M-1 是否闭合：actor running/terminal ledger writer 失败必须落成该 actor 的 typed `ledger_write_failed` error record，并保留同命令 sibling actor；普通 `command.started`/`command.completed` 等无 actor slot 的 ledger 写失败必须 typed reject，不得吞成 `completed`。
- S-1 是否闭合：`selectRequestExecutionView().commands[].results` 是否保留每个 actor slot，失败或超时 actor 为 `null`，且 `errors` 只收集真实 error。
- N-1 是否闭合：cleanup actor 的 terminal 判断是否使用 `RequestLifecycleStatus` 闭集 exhaustive switch，而非开放 string。
- N-2 是否闭合：`createLifecycleEmitter` 的 depth rejected branch 是否无 `depthRecord!` 非空断言，并且有显式 narrowing。
- 本轮新增首败是否正确修复：`requestLedgerLifecycle.test.ts` 不再假设同毫秒父子 command 输出顺序，而是按 `commandName` 对拍结果；请确认这没有削弱设计规定的 `startedAt + commandId` 稳定排序。
- 验证输出是否可复现：runtime typecheck exit 0；runtime 13 files / 76 tests PASS；focused `requestLedgerLifecycle` + `requestLedgerSelector` 2 files / 14 tests PASS；runtime static 5 gates + support PASS；TER `verify:static` PASS；TER-local `verify` 为 22/22 typecheck、9/9 test、`TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`、Metro 710 modules、`TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请写精确文件与行号、事实与证据、失败后果、最小修复建议，以及是否需要 Dexter 产品裁决。请区分静态源码事实、运行输出证据、推论与尚缺证据的假设。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER kernel.base.runtime 单元 B 的当前 implementation。

背景：Unit B 已按冻结详设完成实施，并在上一轮 IMPLEMENTATION review 后闭合 1M/1S/2N。Codex 已按当前仓库字节重新运行授权内 TER-local 验证，并更新证据与 HANDOFF。本轮请不要采信 Codex 自述，请重新打开源码、测试、工具和证据做 fresh 独立核验。

目标：请判断 Unit B 的 request ledger、selector、lifecycle ledger writer、cleanup actor 与验证工具是否真的满足需求和详设；重点构造“所有判据通过但 runtime 仍没建成或 request ledger 错误”的路径。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md：Unit B 需求与判据；
- doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-design-codex.md：Unit B 冻结详设与实施计划；
- doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-review-claude.md：上一轮 IMPLEMENTATION review 的 1M/1S/2N；
- apps/terminal/kernel/base/runtime/src/：当前生产源码；
- apps/terminal/kernel/base/runtime/test/：当前测试与类型夹具；
- tools/terminal-runtime/：runtime 静态门与 red mutation model；
- tools/terminal-skeleton/verify.mjs、tools/terminal-skeleton/verify-static.mjs、tools/terminal-skeleton/verify.test.mjs：TER-local 验证接线；
- doc/evidence/platform/terminal-kernel-base-runtime/implementation-b-codex.md：Codex 实施证据与本轮修复输出；
- apps/terminal/kernel/base/runtime/HANDOFF.md：Unit B 当前边界与欠账登记。

请重点独立核验：M-1 是否闭合，即 actor running/terminal ledger 写失败必须落成该 actor 的 typed ledger_write_failed error record 并保留 sibling，而普通 command.started/command.completed 写失败必须 typed reject；S-1 是否闭合，即 selector results 保留全部 actor slot，失败或超时 actor 为 null；N-1 是否使用 RequestLifecycleStatus 闭集 exhaustive switch；N-2 是否已去掉 depthRecord! 并改为显式 narrowing；以及本轮首败修复是否正确，也就是 requestLedgerLifecycle.test.ts 不再假设同毫秒父子 command 输出顺序，而按 commandName 对拍结果，且没有削弱 startedAt + commandId 稳定排序。

Codex 本轮新鲜输出为：yarn workspace @catering-v2s/kernel-base-runtime typecheck exit 0；yarn workspace @catering-v2s/kernel-base-runtime test 为 13 files / 76 tests PASS；focused requestLedgerLifecycle + requestLedgerSelector 为 2 files / 14 tests PASS；node tools/terminal-runtime/check-static.test.mjs PASS；node tools/terminal-runtime/check-static.mjs 为 5 rule gates + support PASS；yarn workspace @catering-v2s/terminal verify:static PASS；yarn workspace @catering-v2s/terminal verify 为 22/22 typecheck、9/9 test、TERMINAL_TEST_MARKERS=PASS real=4 noTests=5、Metro 710 modules、TERMINAL_VERIFY_CLEANUP=PASS、TERMINAL_VERIFY=PASS。请你可复跑则复跑，不能复跑则把动态输出标为未亲验。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请写精确文件与行号、事实与证据、失败后果、最小修复建议，以及是否需要 Dexter 产品裁决。请区分静态源码事实、运行输出证据、推论和尚缺证据的假设。

授权边界：本次只请求 Unit B implementation review。不授权开始 Unit C 或下一个包，不授权 adapter/native、Gradle、设备、DEV、seed、reset、浏览器 L2、UAT、部署或仓级 normal scripts/verify。TER-local 静态、typecheck、测试与 Expo JS export 通过，不构成 native、设备、DEV、真实跨机 transport 或跨重启行为已证明。谢谢。
```
