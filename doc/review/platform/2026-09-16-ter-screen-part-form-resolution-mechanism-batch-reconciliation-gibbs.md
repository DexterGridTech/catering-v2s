# TER screenPart 机型解析 · 机制批全范围三维对账（复核）

```text
REVIEW_TARGET=BATCH_RECONCILIATION
SCOPE=A-0..A-4 / R-1..R-9 / R-15 / R-16 / R-10a
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Gibbs
REVIEWER_ID=01a0a971-7419-7132-9828-267262af7dbc
INPUTS=需求、详设、IA、实施计划、项目记忆、CP1~CP4 evidence/对账、当前源码
TESTS_RUN=NO; this was a read-only reconciliation
VERDICT=MATCHED
```

## 复核结果

无当前源码级 `OPEN` finding。首轮机制批对账中的 ready identity 缺口已由
`ScreenContainer` 按最小范围修复：

- `container-empty` 仍是唯一传 `readyPartKey=null` 的分支；
- `missing-catalog-entry`、`incompatible-catalog-entry`、`invalid-props` 都从 placement
  保留 requested `partKey`；
- `ScreenReadyBoundary` 将该值写入 `RenderSurfaceReadyInput`；
- `consoleAssembly.tsx` 透传到 integration startup-ready command 并更新 readiness；
- 两个 integration assembly 与 actor payload 原样保留该 identity；
- `startupDiagnosticsWriter.ts` 仍是唯一 `startup.complete` writer，二次写会拒绝。

精确源码链：

```text
resolvePart.ts:79-88,120-139,142-159,182-200
ScreenContainer.tsx:107-135,161-168
ScreenReadyBoundary.tsx:227-234
consoleAssembly.tsx:396-415
sample-console/src/assembly/assembly.tsx:93-98
sample-wallpaper-console/src/assembly/assembly.tsx:76-81
sample-console/src/application/module.ts:31-36
sample-wallpaper-console/src/application/module.ts:31-36
```

## 三维结论

| 维度 | 结果 | 说明 |
|---|---|---|
| 需求 | MATCHED | R-5/R-16 的 content-failure ready identity 与 content/system 分流闭合 |
| 详设/IA | MATCHED | D-2/D-9 的 ready input → console writer → integration payload 链路无丢失；A 批只完成 R-10a，未提前完成 B 批组件/布局 |
| 项目记忆标准 | MATCHED_WITH_BOUNDARY | CP-3 的主 agent fallback 保持 `MAIN_AGENT_FALLBACK`，未冒充 fresh；证据档位仍与 dynamic/native/visual 分离 |

## 范围与证据边界

未发现 A 批误做 B 批。此轮按指令只读核验、未运行测试，不升级为 native、Android、Web、
visual、release 或 implementation acceptance 证据。CP-3 fallback 记录仍为
`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp3-three-dimensional-reconciliation-main-fallback.md`；
本记录不能把它转换为 fresh verdict。
