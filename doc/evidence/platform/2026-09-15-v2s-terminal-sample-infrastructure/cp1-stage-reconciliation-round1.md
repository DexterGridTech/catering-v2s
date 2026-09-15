# CP-1 stage 三维对账（round 1）

```text
REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION
REVIEW_STAGE=CP-1
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=Planck
VERDICT=NO-GO
M/S/N=2/3/1
EVIDENCE_TIER=static_source_reconciliation_only
```

## 输入与独立性

fresh 子 agent 只读核对了 AGENTS.md、平台蓝图、当前 Roadmap 授权、命中的
project-memory、v3.6 需求、当前详设/计划、CP-0/CP-1 源码，以及静态输出
`/tmp/ter-static-cp1-after-platform.txt`。未执行 Git、构建、设备、DEV、L2、seed/reset
或动态动作；没有修改文件。审查先以证伪为立场，再对照作者材料。

## Findings

1. **M / CONFIRMED**：
   `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`
   重复导入并重复注册 `createSampleWallpaperConsoleModule()`；
   `resolveModuleOrder` 对重复 moduleName 会失败。复现：
   `rg -n "createSampleWallpaperConsoleModule" apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`。
2. **M / CONFIRMED**：当前 `tools/terminal-layering/check-static.mjs` 与
   `tools/terminal-skeleton/check-static.mjs` 尚未实现 D-1 要求的 source/target
   platform equality；现有 adapter sibling green 不是 cross-platform red proof。
3. **S / CONFIRMED**：计划 §2.1 和详设 CP-0 gate card 仍有 B0 “graph/package 两侧
   修复”旧表述，与 v3.6 R-E6 的“只删 package.json devDependency”冲突。
4. **S / CONFIRMED**：两个新包 README 只有定位短句，尚未覆盖 TR-10 的定位、作用、
   结构、用法和迭代边界。
5. **S / CONFIRMED**：计划 §1.3 把真实 moduleName
   `assembly.android.sample-wallpaper-terminal` 写成了
   `assembly.android.sample-wallpaper`。
6. **N / REJECTED_WITH_EVIDENCE**：CP-0 当前源码没有把 test-only type import 伪装成
   production graph/dependency；picker package、graph 与 dependencies.ts 的 dev 集合均为空，
   与 v3.6 R-E6 一致。

## 三维结论

- 需求维：R-E6 的删除方向、两个新包、batch/graph 和真实 runtime subset 与当前源码大体匹配。
- 详设/计划维：D-1 的 predicate 尚未落实；B0 旧文字、README 责任和 graph edge 名称仍 OPEN。
- memory/规范维：静态 PASS 不能替代真实 red mutation、runtime duplicate proof 或后续
  stage reconciliation。

`TERMINAL_STATIC=PASS` 仅说明现有静态总门在该时点通过，不能将本记录升级为 CP-1 GO
或整体 implementation acceptance。
