# CP-3 / CP-4 阶段三维对账（Round 3，Arendt）

- `REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `REVIEW_ROUND=3`（实施阶段对账；不适用 DESIGN cycle 上限）
- 执行日期：2026-09-15
- `RECORD_STATE=PRE_REPAIR_RECORD`
- 限制：只读；未修改源码、文档、测试或工具；未执行 Web、Metro、DEV、Android、设备、seed、deploy 或 Computer Use。
- 说明：该记录产生于当前共享 assembly 与 D-12 focused 修复证据补齐之前，不能作为当前源码的 MATCHED；它保留了独立审查的首败与边界，后续必须由 fresh reviewer 对当前字节重审。

## 独立输入与方法

审查者读取当前仓库的需求 v3.6、implementation design/plan、项目记忆中命中的约束、CP/B0 evidence，以及 CP-3/B3、CP-4/B4 的源码、测试与工具；先以证伪为立场形成结论，未参考作者自报 PASS 作为源码真相。审查范围是三维对账：需求、详设/计划、源码/验证证据。

## Verdict

`OPEN`；`NEXT_STAGE=NO-GO`。

CP-3/B3 与 CP-4/B4 当时均未达到 `MATCHED`。该结论针对审查时点，不覆盖随后主 agent 的共享 assembly、D-12 测试和行为检查器修复。

## Findings

### M-1 — CP-3/CP-4 阶段记录与前置样例验收未闭合（`CONFIRMED`）

当时缺少 CP-3/CP-4 的阶段对账记录；B0 evidence 仍明确 sample2 冻结/完整验收有 Web、release、native-device、完整 visual、A/F 项 OPEN。复核位置：

- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:66-82`
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md:57-62`

因此当时不允许把下一阶段或动态验证标成可进入。当前主 agent 已补写 focused 修复证据，但仍需新的 fresh 阶段对账与 B0 边界收口记录。

### M-2 — shared console assembly 抽取在审查时点仍未完成（`CONFIRMED_AT_REVIEW_TIME`）

审查时 `ui.base.console-assembly` 只导出 startup writer，而两个 integration 各自持有 `SurfaceInputFrame`、`createStateSource`、`createDispatchCommand` 与 surface resolver：

- `apps/terminal/ui/base/console-assembly/src/index.ts:1-4`
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:82-190`
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:62-164`

这是实现缺口而非证据缺口。主 agent 随后已把 shared assembly 实现落入 `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`，此记录不对该后续修复作闭合判断。

### S-1 — kind 修复缺少当时的 focused/stage matched 记录（`PARTIALLY_CONFIRMED`）

源码可见 `declared`/`measured` kind，但审查时没有对应修复后的阶段记录。可复核：

```text
rg -n "kind: 'declared'|kind: 'measured'" apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx
```

### S-2 — requestOutcome 源码映射正确但缺精确全表测试（`PARTIALLY_CONFIRMED`）

当时 `apps/terminal/ui/base/render/src/foundations/requestOutcome.ts:3-15` 的逻辑与详设映射一致，但未见逐类、空集合、混合错误和 unknown 输入的全表 focused test。主 agent 后续新增 `apps/terminal/ui/base/render/test/requestOutcome.test.ts`；需要 fresh reviewer 按当前字节确认。

### S-3 — U13 两跳失败与冷重启覆盖不足（`PARTIALLY_CONFIRMED`）

当时仅见 picker 的局部 runtime fixture 与 child failure injection：

- `apps/terminal/ui/feature/sample-wallpaper-picker/test/pickerSystemFailure.test.ts:76-142`
- `apps/terminal/ui/feature/sample-wallpaper-picker/test/sampleWallpaperPicker.test.tsx:222-258`

PF-01–PF-10、三个关闭路径及 cold restart 没有阶段证据。该项不能用局部 focused 结果替代，需按 U13 矩阵补证。

### S-4 — TR-08 生产 bundle 排除未取得 APK 证据（`UNVERIFIED_REQUIRES_EVIDENCE`）

审查时未执行真实 release APK scan。检查器与约束位置为：

- `doc/platform/terminal-coding-standard.md:278-293`
- `tools/terminal-sample2/check-production-bundle.mjs:8-17,69-77`

### N-1 — B4 feature factory 与 thin adapter 的静态形态存在（`CONFIRMED`）

`apps/terminal/ui/base/feature-assembly/src/index.ts:1-99` 与三个 feature adapter 的 factory 形态可见，且未观察到超出 B1 基础能力的依赖。

### N-2 — ephemeral notice 序列化过滤存在（`CONFIRMED`）

`apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:253-290` 有 notice 过滤，局部 focused assertion 已存在；仍需把它放进当前完整矩阵。

## 边界记录

- `FIRST_FAILURE`：进入 B3/B4 阶段对账时缺少独立阶段记录；继续核验又发现 shared console assembly 尚未实现。
- `BROKEN_BOUNDARY`：B3 implementation → mandatory stage reconciliation；以及 B4 focused proof → 完整 U13 journey evidence。
- `LAST_KNOWN_GOOD`：审查时最新可审计阶段记录仍为 CP-1；其后主 agent 已产生 focused repair evidence，但本记录未审查那些后续字节。

## 后续准入

主 agent 必须先以当前源码取得 fresh CP-3/CP-4 三维对账，确认 shared assembly、D-12 全表测试、U13 完整矩阵、TR-08 APK scan 与 B0 前置边界，再进行全批三维对账；动态证据不得替代这些前置项。
