# TER T1 CP-01 / CP-05 与动态前置 finding intake

## 范围与证据边界

本记录处置三个独立只读审查输出：CP-01 文件移动差量、CP-05 README 差量和 TEST_CHAIN_PREFLIGHT_R2。主 agent 重开正式需求 R-03/R-15、详设 §8.1/§13、计划 CP-01/CP-05/CP-06、当前 owning source 与适用项目记忆后自行分类；reviewer 分类不是本记录结论。

本记录只覆盖当前发现及其直接依赖。未启动 DEV、Expo Web、Android、L2、reset 或 seed。历史 CP-01/CP-05 `MATCHED` 和既有动态结果不被改写；由于本次发现了当前字节差异，受影响的 CP 差量必须 fresh 复核后才能继续动态准入。

## Finding intake

| Finding | 主 agent classification | 当前事实与反例 | 最小处置 | 状态 |
|---|---|---|---|---|
| CP-01 stale generic slice test import | `CONFIRMED` | `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx:48` 仍导入已移除的 `sample-member-registry/src/features/slices/slice`；owner 当前具名文件为 `src/features/slices/memberRegistry.ts`。这会使测试模块解析依赖旧结构，直接违反 R-03/V-02 的消费者同步判据。 | 将该测试导入改到当前具名 slice；未引入兼容文件或重导出。 | 已修复；sample-member-desk 包测试 2 files / 40 tests PASS，待 CP-01 fresh 差量对账。 |
| CP-01 当前证明缺口 | `CONFIRMED` | 既有 CP-01 文档记录未覆盖本次后续文件移动后的测试引用；旧 CP-02 记录只关闭 State disposal 差量，不能证明当前 slice 移动及消费者闭合。 | 保留旧记录原字节；本次另做 fresh CP-01 差量复核，不把作者自检称作独立 MATCHED。 | 等待 fresh reviewer。 |
| CP-05 成员投影 README 不一致 | `CONFIRMED` | README 原文称同步 payload 只包含 `members`；`memberRegistry.ts:59-62` 实际包含 `{members, hostPending}`，`:73-80` 将待确认项写入 `hostPendingProjection`，`selectHostPendingMember.ts:7-12` 在 SLAVE 读取该 projection。原文把已有 projection 误称为后续独立投影，并漏记 payload 字段。 | README 改为准确描述 host projection 与 SLAVE 本地 `branchPending` 保留边界。 | 已修复；等待 fresh CP-05 差量对账。 |
| TEST_CHAIN_PREFLIGHT：run-level last known good / broken boundary 未持久化 | `CONFIRMED` | 原 managed manifest 与最终摘要没有这两个 run-level 字段；journey 步骤诊断不能替代受管 runner 自身的状态闭包。失败后仅凭业务/cleanup 状态难以直接定位最后成功边界。 | manifest 新增 `lastKnownGood`、`brokenBoundary`；runner 在资源预检、受管子进程、业务、cleanup成功点更新 LKG，在测试/清理/诊断失败处记录首个破损边界，并在最终摘要输出。失败路径继续保留 firstFailure。 | 已修复；automation typecheck PASS、managedRun/journey diagnostics/runner focused tests 89/89 PASS；待 fresh TEST_CHAIN_PREFLIGHT R2 closure review。 |
| TEST_CHAIN_PREFLIGHT：automation package typecheck 本身失败 | `CONFIRMED` | 当前 tsconfig 未声明 JSX，导致包内导入 TSX primitives 的类型分析报错；另有 Android control 等待计时器显式使用 `NodeJS.Timeout`，与当前 Node/browser timer 声明冲突。 | tsconfig 设置 `jsx: react-jsx`；计时器类型改为 `ReturnType<typeof setTimeout>`，没有增加依赖或改变运行时等待。 | 已修复；`yarn --cwd tools/terminal-automation typecheck` PASS。 |
| TEST_CHAIN_PREFLIGHT：R1 未留 tracked 文件 | `PARTIALLY_CONFIRMED` | 当前仓内没有可定位的 R1 文档；R1 输出在本任务既有协作会话记录中，R2 reviewer 也未找到 tracked review path。不能把会话输出虚构为仓内独立审查报告。 | 本记录只引用可见的 reviewer R2 输出和当前修复结果；由 fresh reviewer 对修复后当前链路完成 R2 closure，不回填或伪造 R1 文档。 | R1 可追溯性为记录限制；不是当前源码阻断项。 |
| 具名 slice 改名后的旧消费者闭合 | `CONFIRMED` | 同根搜索发现 `tools/terminal-sample2/check-behavior.mjs` 仍以旧 `slice.ts` 路径定位 wallpaper state；这类可执行 checker 在直接调用时会读错源。修正前搜索命中 5 处：sample-member-desk 测试 1 处、checker 4 处。 | 将 checker 的 4 个输入路径改到 `wallpaperSelection.ts`；执行 Node 语法检查，并重新搜索 apps/terminal 与该 checker 的可执行消费者。 | 已修复；`node --check` PASS，当前执行源码/测试/checker旧路径搜索无命中。 |

## 受影响证明

- `yarn --cwd apps/terminal/ui/feature/sample-member-desk test`：PASS，2 files / 40 tests；owned runner cleanup PASS。
- `yarn --cwd tools/terminal-automation typecheck`：PASS。
- `yarn --cwd tools/terminal-automation test test/managedRun.test.ts test/journeyFailureDiagnostics.test.ts test/runner.test.ts`：PASS，3 files / 89 tests。
- `node --check tools/terminal-sample2/check-behavior.mjs`：PASS。
- `apps/terminal` 与 `tools/terminal-sample2` 当前执行源码、测试及 checker 的旧 slice 路径搜索：0 命中。
- 测试产生的 `tools/terminal-automation/node_modules/.vite` 与 `.vite-temp` 已按本次测试范围精确清理并读回：PASS。

## 后续门

1. Fresh reviewer `/root/t1_cp01_delta_r8` 已对具名 slice 文件移动及 `sample-member-desk` 测试消费者做 CP-01 差量三维对账，结论 `MATCHED`。reviewer 未重跑测试；测试结果仍仅引用本记录所列 focused run。
2. Fresh reviewer `/root/t1_cp05_delta_r7` 已核对 host pending 投影 README 修订与 `memberRegistry` slice、两个 selectors 及 state 类型，结论为该差量 `MATCHED`。该窄差量结果不自动关闭完整 CP-05；完整 CP-05 当前字节及30份 README 仍交 fresh 全阶段 reviewer。
3. Fresh TEST_CHAIN_PREFLIGHT reviewer 正在对修订后 manifest、摘要、失败/cleanup路径与 typecheck 进行 closure review；返回 `MATCHED` 前不得进入动态运行。
4. CP-01、CP-02、完整 CP-05、preflight 及其余 CP 差量全部闭合后，再由独立 reviewer 做全批 6b；6b 不以各 CP 结果汇总替代。
5. 当前批次动态验收仍未运行。DEV/Web/Android、业务结果和 runner cleanup 均不得据本记录标记 PASS。

## Fresh closure outcome

本节为较新的状态更新，覆盖“后续门”段落中在 fresh closure 返回前记录的待办状态；原段落保留为 intake 当时的记录。

- CP-01 rename-consumer delta: `/root/t1_cp01_delta_r8` returned `MATCHED` after reviewing the current test import and all five named slice paths against R-03/V-02/V-03, CP-01, and the terminal coding standard. No tests were rerun by the reviewer; the main-agent focused output above remains the execution evidence.
- CP-05 host-pending README delta: `/root/t1_cp05_delta_r7` returned `MATCHED` after comparing the README with the current slice, host/branch selectors, and state types. This is a scoped delta result only; the complete CP-05 stage remains open pending the full-stage reviewer.
- TEST_CHAIN_PREFLIGHT closure: `/root/t1_preflight_r2` returned `MATCHED` for current run-level `lastKnownGood`/`brokenBoundary` manifest and summary paths, failure/cleanup closure, and the repaired typecheck blockers. This was static only; no test or typecheck was executed by the reviewer. The first-round review exists in the collaboration record but has no separate tracked report; that traceability limit remains disclosed.
- CP-02 exact public-export test delta and full CP-05 remain under fresh independent review. Batch 6b and all dynamic acceptance remain not started.

## CP-05 full-stage R8 finding disposition and repair

Fresh full-stage reviewer `/root/t1_cp05_full_r8` found that `selectProjectFixedTerminalUpdateContextFacts` was exported by `project-basic/src/index.ts` and registered in `createProjectBasicModule`'s selector definitions, but omitted from `terminal-invariants.json.publicExports` and the package README's selector list. The package test did not compare the root barrel against the invariant. This is `CONFIRMED`: R-15/V-03/V-18 and CP-05 require the package's public surface and its declared invariant to agree, and a consumer can legitimately depend on this selector through the root package.

Minimum repair: retain the existing public selector because both the module contract and root barrel already expose it; synchronize `terminal-invariants.json` and README, and add a package-root export equality test. No implementation or consumer path was added.

Focused proof on the repaired bytes:
- `yarn workspace @catering-v2s/kernel-feature-project-basic typecheck`: PASS (exit 0).
- `yarn workspace @catering-v2s/kernel-feature-project-basic test`: PASS, 2 files / 14 tests, `TERMINAL_PACKAGE_TEST_MODE=PASS`, `TERMINAL_PACKAGE_TEST=PASS`.
- The focused test derives the TypeScript exports from `src/index.ts` and asserts exact equality with sorted `terminal-invariants.json.publicExports`.

The first typecheck attempt exposed that `node:url` types are not included in this package's TS configuration. The test was aligned with the existing `sample-wallpaper/test/publicSurface.test.ts` pattern using `decodeURIComponent(new URL(...).pathname)`; the succeeding typecheck and test outputs above are from the corrected bytes. No runtime or DEV process was started.

The full CP-05 verdict is reopened by this finding and awaits a fresh independent full-stage reconciliation after the repair. CP-06, batch 6b, 13c, and all dynamic acceptance remain open/not run.

## Current CP-05 closure

The preceding sentence records the state before the fresh closure returned. `/root/t1_cp05_full_r9` completed a fresh independent review of the full CP-05 scope after the repair and returned `MATCHED`. It confirmed selector registration/root export/invariant/README agreement, the new exact-root-export regression test, both integration consumers, all 30 CP-05 README entries, source-layout gates/red examples and memory/gate references. Main-agent focused typecheck and tests passed as recorded above. CP-05 is closed for the current bytes; batch 6b, CP-06, 13c and dynamic acceptance remain open/not run.
