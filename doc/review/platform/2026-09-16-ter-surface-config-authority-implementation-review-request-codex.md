# TER surface 配置覆盖实施评审交接

```text
REVIEW_KIND=IMPLEMENTATION
REVIEW_TARGET=IMPLEMENTATION
REVIEW_STATUS=OPEN_FOR_CLAUDE_REVIEW
DESIGN_SOURCE=doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md
PLAN_SOURCE=doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md
VALIDATION_EVIDENCE=doc/evidence/platform/2026-09-16-ter-surface-config-authority-implementation-validation-codex.md
OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED
IMPLEMENTATION_ACCEPTANCE=NOT_CLAIMED
```

## 背景

本次实施依据已通过 Claude 第 2 轮复评的 v2 最小方案，目标是让两个 Android 实际运行 App
使用各自 App 包 `package.json` 中的逻辑 surface 配置，同时保留 integration 包用于 Web 预览的
默认配置和可选整份覆盖语义。实施已完成授权范围内的两个 Android package、两个 integration
factory、两个既有 integration assembly 测试和四个 README 修改；没有修改 Web、base、host 测量、
tsconfig、App.tsx 或 Android 构建/设备内容。

七条限定命令中前六条通过。最后的既有 `yarn --cwd apps/terminal verify:static` 在既有
`readability-model-test` 的 RD-6 descriptor guard 基线处失败，完整原始输出、首败和边界见
`doc/evidence/platform/2026-09-16-ter-surface-config-authority-implementation-validation-codex.md`。
该失败涉及本批未修改的 14 个 kernel/adapter/dev-host 文件；按当前授权没有修改无关 baseline。

## 评审目标

请独立判断实现是否忠实满足详设与计划的 v2 最小方案，重点确认：

1. 两个 Android App 是否各自拥有与实施时 integration 默认值相同的 `terminalSurfaces`；
2. 两个 integration factory 的 `terminalSurfaces` 是否仍为可选整份对象，并严格使用
   `getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)`；
3. 两个 Android `platformPorts.ts` 是否静态导入本 App 的 `../../package.json`，并逐字传递
   `terminalSurfaces: packageJson.terminalSurfaces`，没有在 Android 侧预先按 `surfaceForm` 选声明；
4. 两个新增 asymmetric override 用例的传入值是否确实不同于包内默认值，并能在 factory 忽略
   覆盖时失败；
5. Web 预览链路、两个 App 的 tsconfig/App.tsx、base parser、loader、AST 门、失败页、导出和
   批次是否保持计划要求；
6. §9.3 逐行对账和 v1 作废文件核对是否如实，尤其是 static 的 OPEN 基线不能被解释为 PASS。

## 实施结果与逐代码对账

### 实际改动文件

- `apps/terminal/assembly/android/sample-terminal/package.json`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/package.json`
- `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts`
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`
- `apps/terminal/ui/integration/sample-console/README.md`
- `apps/terminal/ui/integration/sample-wallpaper-console/README.md`
- `apps/terminal/assembly/android/sample-terminal/README.md`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/README.md`

### 计划 §9.3 逐行状态

| 计划项 | 状态 | 复核事实 |
| --- | --- | --- |
| Android JSON | MATCHED | 两个 Android App 的 `package.json` 均有与对应 integration 当前默认值同形同值的 `terminalSurfaces`。 |
| optional input | MATCHED | 两个 integration factory 的 `terminalSurfaces` 均为可选字段。 |
| override expression | MATCHED | 两个 factory 均使用 `getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)`。 |
| Android pass | MATCHED | 两个 Android `platformPorts.ts` 均静态导入 `../../package.json` 并传递整份 `terminalSurfaces`。 |
| Web no-change | MATCHED | 两个 integration `test-expo/App.tsx`、`ui/base/dev-host` 和预览链路未修改。 |
| tests | MATCHED | 两个既有 integration assembly 测试各增加了与默认值不同的 override 断言。 |
| README/cleanup | MATCHED | 四个 README 已补覆盖语义；v1 作废路径均不存在，记录为 `OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED`。 |
| non-goals | MATCHED | 未增加 base parser、loader、AST 门、失败页、tsconfig 改动、导出改动或新批次。 |

### §9.1 验证状态

四个 typecheck 与两个 integration owned test 均为 PASS；既有 `yarn --cwd apps/terminal verify:static`
在 `readability-model-test` 的 RD-6 descriptor guard 断言处为 `OPEN`，详见
`doc/evidence/platform/2026-09-16-ter-surface-config-authority-implementation-validation-codex.md`。
该 OPEN 涉及本批未修改的 14 个文件，未在本授权内扩大修复。

## 需阅读文件

- `doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md`：已批准 v2 最小详设；
- `doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md`：单批次落点、七条命令和 §9.3 对账表；
- `doc/review/platform/2026-09-15-ter-surface-config-authority-design-review-round2-claude.md`：上一轮 `GO / 0M / 0S / 0N` 的设计复评；
- `apps/terminal/assembly/android/sample-terminal/package.json`：sample-terminal 的 Android surface 配置；
- `apps/terminal/assembly/android/sample-wallpaper-terminal/package.json`：sample-wallpaper-terminal 的 Android surface 配置；
- `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`：sample-terminal 的 Android 到 integration 接线；
- `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts`：sample2 的 Android 到 integration 接线；
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`：sample-console factory 的覆盖输入与 surface 选择；
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`：sample2 factory 的覆盖输入与 surface 选择；
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`：sample-console 既有 assembly 测试及新增 asymmetric override 用例；
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`：sample2 既有 assembly 测试及新增 asymmetric override 用例；
- `doc/evidence/platform/2026-09-16-ter-surface-config-authority-implementation-validation-codex.md`：实际文件清单、七条命令原始输出、首败边界与 v1 清单。

## 独立核验重点

请从仓库根按当前源码重新核对，并给出可复现依据：

- 静态检查 `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts:15` 和
  `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts:19` 的
  字面传参；
- 静态检查两个 factory 的可选类型和 `??` 表达式；
- 读取两个 package JSON 的 landscape/portrait 数值，确认与对应 integration package JSON 的
  实施前默认值一致；
- 读取两个新增测试，确认 override 数值与默认值不同、断言的是按 `surfaceForm` 选中的结果，且
  不新建 App 测试基建；
- 复核四个 README 的 owner/覆盖语义说明，以及证据中的明确未修改边界；
- 按证据文件复核四个 typecheck、两个 owned test 的结果；
- 独立判断 `verify:static` 的 RD-6 首败是否属于本批因果范围。当前记录为
  `OPEN_BASELINE_FAILURE`，不应将其重述为 static PASS；
- 复核 v1 规划的九个路径均不存在，结论应为 `OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED`；
- 不要求也不应启动 Web、Metro、Android 构建、设备、DEV、seed、UAT、部署或 Git。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请带仓库相对路径、
精确行号、影响面、可复现核验方式、最小修复建议，并区分：

- 本批实现事实；
- 详设/计划约束；
- `verify:static` 的既有 RD-6 OPEN 基线；
- 仍缺少的 Web、Android、设备、release、visual 或 acceptance 证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 TER surface 配置覆盖实施（REVIEW_TARGET=IMPLEMENTATION）。

背景：本次实施依据已通过第 2 轮设计复评的 v2 最小方案，目标是让两个 Android 实际运行 App 使用各自 App 包 package.json 的 terminalSurfaces，同时保留 integration 包用于 Web 预览的默认配置与可选整份覆盖语义。已完成授权范围内的两个 Android package、两个 integration factory、两个既有 integration assembly 测试和四个 README 修改；没有修改 Web、base、host 测量、tsconfig、App.tsx 或 Android 构建/设备内容。前六条限定命令通过；第七条既有 terminal static 在 readability-model-test 的 RD-6 descriptor guard 基线失败，不能把它写成 PASS，完整原始输出见 doc/evidence/platform/2026-09-16-ter-surface-config-authority-implementation-validation-codex.md。

目标：请独立核验实现是否忠实满足详设与执行计划的 v2 最小方案，尤其是 Android package 配置的权威方向、两个 factory 的可选整份覆盖、两个 platformPorts.ts 的字面传参、focused override 测试的反向有效性、Web/base/non-goal 边界，以及 static 首败是否属于本批因果范围。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md：已批准 v2 最小详设；
- doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md：实施落点、七条命令和 §9.3 对账；
- doc/review/platform/2026-09-15-ter-surface-config-authority-design-review-round2-claude.md：上一轮 GO / 0M / 0S / 0N 的设计复评；
- apps/terminal/assembly/android/sample-terminal/package.json：sample-terminal Android surface 配置；
- apps/terminal/assembly/android/sample-wallpaper-terminal/package.json：sample2 Android surface 配置；
- apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts：sample-terminal Android 接线；
- apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts：sample2 Android 接线；
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx：sample-console factory 覆盖与 surface 选择；
- apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx：sample2 factory 覆盖与 surface 选择；
- apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx：sample-console asymmetric override 用例；
- apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx：sample2 asymmetric override 用例；
- doc/evidence/platform/2026-09-16-ter-surface-config-authority-implementation-validation-codex.md：实际改动文件、七条命令原始输出、首败边界和 v1 清单。

请重点独立核验：
1. apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts:15 与 apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts:19 是否确实静态传入 terminalSurfaces: packageJson.terminalSurfaces，且 Android 侧没有预先按 surfaceForm 选声明；
2. 两个 integration factory 是否保留可选 terminalSurfaces，并严格使用 getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)；
3. 两个 Android package 的对象是否与对应 integration 当前默认值同形同值，两个测试的 override 是否不同于默认值并能在忽略覆盖时失败；
4. Web preview、ui/base/dev-host、两个 App 的 tsconfig/App.tsx、assembly/base/android、物理 host 测量、既有 exports 是否保持不变；
5. 七条命令结果是否与证据一致：四个 typecheck PASS、sample-console owned test 8 files/38 tests PASS、sample-wallpaper-console owned test 4 files/15 tests PASS；既有 terminal static 的 first failure 是 readability-model-test / RD-6，状态为 OPEN_BASELINE_FAILURE，不是 PASS；
6. v1 规划的路径是否均不存在，是否应记录 OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED；不要启动任何 Web、Metro、Android 构建、设备、DEV、seed、UAT、部署或 Git 动作。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请给出真实仓库相对路径、精确行号、影响面、可复现核验方式和最小修复建议；请区分实现事实、详设/计划约束、既有 RD-6 OPEN 基线，以及仍缺少的 Web/Android/设备/release/visual/acceptance 证据。

授权边界：本次交接只请求对已完成的 surface 配置源码、现有 focused 测试、README 和限定证据做 implementation review；不授权扩大源码范围、修复无关 RD-6 baseline、修改详设/计划、启动 Web、Metro、Android 构建、设备、DEV、seed、UAT、部署或 Git。该 review 结果不自动代表 implementation acceptance、Web/Android/native/release/visual/cleanup 或整体 acceptance 通过，最终由 Dexter 决定。
谢谢。
```
