# CP3/B3 fresh independent three-dimensional reconciliation (current bytes)

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=5
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=CP3/B3
VERDICT=PARTIAL_OPEN_NOT_MATCHED
M_S_N=1/2/1
REVIEW_BOUNDARY=read-only;no test/build/Metro/Web/Android/device/dynamic

## Fresh reviewer conclusion

CP3/B3 当前源码主体静态匹配，但不能进入动态前置：B0 frozen/full acceptance、whole-scope
与 code↔design 当前收口记录以及 U8 release/device evidence 仍缺失或未 MATCHED。

## Matched current source

- 两个 integration 都通过 shared `createConsoleAssembly` 接入并注入自己的真实 runtime
  module：`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:81-116`、
  `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:58-97`。
- shared assembly 统一 `ConsoleSurfaceInputFrame` 与 `AdminLauncher`：
  `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:395-428`。
- 当前 integration/console-assembly 未发现第二条 admin console/openLayer 路径：
  `rg -n "ADMIN_CONSOLE|openLayer\\(" apps/terminal/ui/integration/*/src apps/terminal/ui/base/console-assembly/src`。
- single writer/sink 与 writer identity：
  `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts:14-35`。
- console assembly 直接以 `createRuntimeInstanceId()` 生成 `startupRunId`，不消费
  `platformPorts.startupRunId`：`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:224-252`；
  回归 test source 在 `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx:239-296`。
- sample-console 真实 `RuntimeModule` factory 与 assembly 注册：
  `apps/terminal/ui/integration/sample-console/src/application/module.ts:23-60`、
  `.../src/assembly/assembly.tsx:108-116`。
- ready 仅来自 target physical primary、host size、resolved real part layout：
  `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:102-151`；
  fallback 不是 ready：`apps/terminal/ui/base/render/test/renderSurface.test.tsx:1077-1175`。
- U7/U8 计划映射当前分开：U7 asset-reference closure、U8 release cold-start：
  `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:403-405`。

## Findings

### M-1 — dynamic admission is still blocked

**事实**：`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md:57-62`
仍列 Web、release、native-device、complete visual 和完整 A/F 为 OPEN；计划
`...implementation-plan-codex.md:504-515` 要求 whole-scope 与 code↔design ledger 收口后才动态。

### S-1 — U3/U4 focused/log output was not rerun by this reviewer

源码与工具形态存在（`tools/terminal-sample2/check-startup-diagnostics.mjs:83-109`），
但本轮严格只读，不能把未执行的 checker 变异或 focused test 写成 fresh PASS。

### S-2 — U8 final remains open

ready boundary 的 source/test 支持只属于 U8 supporting；release mobile/dual cold-start
device observer 尚无当前证据。

### N-1 — memory route note

reviewer 报告了使用宽泛 `domain=terminal` 的 memory route 会被仓库脚本拒绝，后续按
index 手动读取更具体的 terminal/verification/coordination/failure 原文；该流程注意事项
不构成 CP3 源码缺陷。

## First failure / broken boundary / last known good

- `FIRST_FAILURE`：动态前置层 first failure 是 B0 frozen/full acceptance OPEN。
- `BROKEN_BOUNDARY`：static/focused source support → dynamic admission。
- `LAST_KNOWN_GOOD`：shared console、single writer/run identity、真实 runtime module、
  resolved-only ready boundary 与 U7/U8 计划映射均已由当前字节支持。

## Reproduction (read-only)

```sh
nl -ba apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx | sed -n '224,428p'
nl -ba apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts | sed -n '1,80p'
nl -ba apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx | sed -n '1,140p'
nl -ba apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx | sed -n '1,150p'
nl -ba apps/terminal/ui/integration/sample-console/src/application/module.ts | sed -n '1,80p'
rg -n "platformPorts\\.startupRunId|startupRunId: input\\.platformPorts|startupRunId:.*platformPorts" apps/terminal/ui/base/console-assembly apps/terminal/ui/integration/sample-console/src apps/terminal/ui/integration/sample-wallpaper-console/src
nl -ba tools/terminal-sample2/check-startup-diagnostics.mjs | sed -n '1,240p'
nl -ba doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md | sed -n '45,70p'
```

## Scope note

本记录是 fresh 只读三维对账，不是实现验收；reviewer 未运行 test/build/dynamic。源码静态
匹配不等于 U8 final、Web、Android、release 或 cleanup PASS。
