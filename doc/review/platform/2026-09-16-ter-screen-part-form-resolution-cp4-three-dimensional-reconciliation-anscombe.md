# TER screenPart 机型解析 · CP-4 三维对账

```text
REVIEW_TARGET=STEP_RECONCILIATION
SCOPE=CP-4 / A-4 R-10a admin declaration split with same-component siblings
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Anscombe
REVIEWER_ID=01a0a968-bb40-7910-a451-f3d1325cfa2b
INPUTS=需求、详设、IA、实施计划、项目记忆命中原文、CP-4 evidence 与当前源码
VERDICT=MATCHED
TESTS_RUN=NO; this was a read-only reconciliation
```

## 独立核验结论

CP-4 当前源码核验闭合：

- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts:75` 导出 8 个真实 `parts`，四个稳定 `partKey` 各有 laptop/mobile sibling。
- `apps/terminal/ui/base/admin-shell/test/parts.test.ts:15` 断言 8 条、四 key、每 key 两 sibling、不相交 `surfaceForm`、全局 8 个唯一 `rendererKey`；`:41` 断言归一化 catalog 七字段与 `layerTier/layerGuard` 相等。
- `apps/terminal/ui/base/console-assembly/test/partSelection.test.ts:79` 使用 `adminShellAssembly.parts` 的真实 `admin.console.platform-ports` sibling，并对 laptop/mobile 请求都断言 pre-filter overlap 报错。
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx:41` wrapper 调用 production `createSampleAssembly`；`:350` 分别创建 laptop/mobile assembly，认证后断言四个生产 section：platform-ports、runtime、display-context、sampleConsole。
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx:40` wrapper 调用 production assembly；`:205` 对 laptop/mobile 都打开真实 admin layer，认证后断言三个共享生产 section：platform-ports、runtime、display-context。
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp4-execution-codex.md:27` 的首败/计数与源码核验一致，`:96` 起对应上述源码覆盖声明。

本轮未运行测试，只做限定范围的当前源码/evidence 只读核验；旧 finding“integration 缺少每种形态全部 sections/完整分母”已按当前源码闭合。

## 三维对账

| 维度 | 结果 | 依据 |
|---|---|---|
| 需求 | MATCHED | R-10a 的 8 条未过滤输入、同 key 双形态不相交、稳定 identity 与完整 integration 分母均可定位到真实源码/测试 |
| 详设/IA | MATCHED | CP-4 只做声明拆分与零回归基线；组件分化/布局仍留在 CP-5；测试走真实 assembly |
| 项目记忆标准 | MATCHED | 独立复核遵守主 agent 唯一写入、逐步三维对账、失败与证据分档边界；未以测试名或 exit code 代替业务 oracle |

`VERDICT=MATCHED` 仅表示 CP-4 步骤级三维对账通过，不表示机制批整体、CP-5、动态证据或 implementation acceptance 通过。
