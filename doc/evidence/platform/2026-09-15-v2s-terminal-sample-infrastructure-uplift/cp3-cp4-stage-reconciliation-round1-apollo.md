# CP-3 / CP-4 stage reconciliation（Round 1，Apollo）

- `REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `REVIEW_ROUND=1`（实施阶段对账；不适用 DESIGN cycle 上限）
- 执行日期：2026-09-15
- 范围：当前 CP-3/B3、CP-4/B4 源码、测试、工具、需求 v3.6、implementation design/plan、
  project-memory 与既有 evidence。
- 限制：只读；未执行 Web、Metro、DEV、Android、设备、seed、deploy 或 Computer Use。

## Verdict

`OPEN`；`NEXT_STAGE=NO-GO`。

CP-3/B3 与 CP-4/B4 均未达到 `MATCHED`，不允许进入下一阶段或动态验证。

## CP-3 / B3

### M-1 — stage record 与 focused proof 缺失（`CONFIRMED`）

必需的 B3 stage reconciliation 记录不存在；当时 evidence 目录仅有 CP-1 记录。缺失记录
本身阻断 stage 收口。

### M-2 — shared console assembly uplift 未完成（`CONFIRMED`）

当前 `ui.base.console-assembly` 只导出 startup writer：

```text
apps/terminal/ui/base/console-assembly/src/index.ts:1-4
```

两个 integration 仍分别拥有 `SurfaceInputFrame`、`createStateSource`、
`createDispatchCommand`、surface resolver 等核心 assembly 逻辑：

```text
apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:82-190
apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:62-164
```

这与详设要求的 shared console assembly uplift 不匹配，是实现层缺口，不是单纯证据缺口。

已部分确认：

- 两个 integration 当前已有 startup surface `kind: declared/measured`；
- `startupDiagnosticsWriter` 有 duplicate-write guard：
  `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts:14-33`；
- 两个 integration 具有 `AdminLauncher`、共享 catalog assembly 形态。

### S-1 — kind 修复缺少 focused assertion/记录（`PARTIALLY_CONFIRMED`）

当前源码已有 `declared`/`measured` kind，但当时没有修复后的 CP-3 focused/stage matched
记录。可复核：

```text
rg -n "kind: 'declared'|kind: 'measured'" \
  apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx
```

## CP-4 / B4

已确认或部分确认：

- shared `ui.base.feature-assembly` factory 存在：
  `apps/terminal/ui/base/feature-assembly/src/index.ts:1-99`；
- 三个 feature adapter 使用该 factory，依赖保持 B1 基础能力范围；
- `requestOutcome` 当前源码映射符合设计：
  `apps/terminal/ui/base/render/src/foundations/requestOutcome.ts:3-15`；
- U13 存在 runtime fixture + child failure injection：
  `apps/terminal/ui/feature/sample-wallpaper-picker/test/pickerSystemFailure.test.ts:76-142`；
- ephemeral notice 序列化过滤存在：
  `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:253-290`。

仍未闭合：

- CP-4 stage reconciliation record 不存在；
- 没有 requestOutcome 精确全表测试，当前只能证明源码逻辑；
- U13 只覆盖部分两跳失败路径，完整 PF-01–PF-10、三个关闭路径和 cold restart 没有
  stage evidence；
- ScreenReadyBoundary、release debug seam、TR-08 生产 bundle 排除没有真实 APK scan/
  red mutation 证明；当前未确认存在违规，但属于 `UNVERIFIED_REQUIRES_EVIDENCE`。

## M/S/N

建议数量：`M/S/N=2/4/2`。

- `M-1 CONFIRMED`：CP3/CP4 stage reconciliation evidence 缺失，直接阻断收口。
- `M-2 CONFIRMED`：shared console assembly uplift 未完成，B3 核心逻辑仍重复在两个
  integration。
- `S-1 PARTIALLY_CONFIRMED`：kind 修复存在但缺 focused assertion/evidence。
- `S-2 PARTIALLY_CONFIRMED`：requestOutcome 源码语义正确但缺精确分类表测试。
- `S-3 PARTIALLY_CONFIRMED`：U13 两跳 runtime injection 有局部覆盖，完整 journey matrix
  未闭合。
- `S-4 UNVERIFIED_REQUIRES_EVIDENCE`：TR-08 production bundle exclusion 未证明。
- `N-1 CONFIRMED`：B4 feature factory 与三个 thin adapter 静态形态已具备。
- `N-2 CONFIRMED`：ephemeral notice 源码机制与局部 focused assertion 已具备。

## 边界

- `FIRST_FAILURE`：进入 B3/B4 stage reconciliation 时，CP-3/CP-4 独立记录不存在；
  进一步核验发现 B3 shared assembly implementation 也未完成。
- `BROKEN_BOUNDARY`：B3 implementation → mandatory stage reconciliation；以及 B4 focused
  proof → complete journey/stage evidence。
- `LAST_KNOWN_GOOD`：当前仓内最新可审计阶段记录为 CP-1；本轮独立 focused 命令结果尚未
  形成该 reviewer 的 matched record。

## Admission

不允许进入动态。主 Codex 应先完成 shared console assembly 根因修复、精确
requestOutcome 表测试、U13/生产 bundle evidence 与 CP3/CP4 fresh stage 对账；动态不得
替代这些前置项。

