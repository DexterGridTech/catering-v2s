# TER 可读性整改 CP-3 focused proof

`REVIEW_TARGET=IMPLEMENTATION_STEP`
`CP=CP-3`
`STATUS=FOCUSED_PROOF_PASS`
`AUTHORITY=DEXTER_IMPLEMENTATION_AUTHORIZATION`

## 范围

本步只处理 `ui/base` 的 input、dev-host、primitives、render 四个包，以及与这些归位直接相关的
测试 import 和 README 结构说明。CP-4 才处理 feature、integration、adapter 与 assembly 的剩余归位；
本步没有启用全部 L 规则，也没有运行 Web pointer、Android、DEV、seed、UAT 或部署验证。

实施前已使用当前职责到测试矩阵
`doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-responsibility-test-matrix-codex.md`
完成 CP-1 的前置条件核对：InputProvider 的 registration、edit/config、focus/blur、complete、keyboard、
snapshot、boundary、resize 与 context projection 均有结果型 behavior oracle；没有以 callback 调用次数、
prop 值或 transform 前尺寸作为唯一证明。

## 变更观察

- `apps/terminal/ui/base/input/src/model/` 的五个纯模型文件归入 `src/foundations/`，`context.ts` 归入
  `src/contexts/context.ts`，`types.ts` 归入 `src/types/types.ts`；公共 `src/index.ts` 的导出语义保持。
- `InputProvider` 只保留装配、状态投影与 resize 接缝；内部职责分别由
  `hooks/useInputFieldRegistry.ts`、`hooks/useInputFocusController.ts`、
  `hooks/useInputKeyboardController.ts` 承担，`components/FocusBoundaryBridge.tsx` 保留 focus boundary
  Provider 关系。字段 registry、owner transition、首击 focus、system/virtual 互斥、complete、snapshot、
  surface capacity 与 boundary suspend/restore 的实现语义未改。
- `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx` 进入 `components/`，`surfacePreview.ts` 进入
  `foundations/`，`webPlatform.ts` 与 `webStorage.ts` 进入 `implementations/`；出口与两项测试 import
  已按新路径更新。
- `apps/terminal/ui/base/primitives/src/components.tsx` 已拆为九个实际运行时 primitive 组件文件，十五项
  类型进入 `types/types.ts`，`assertTestID` 进入 `foundations/`，`rnr/` 两个 copy-in 文件进入 `vendor/`；
  `src/index.ts` 仍导出原公共集合，未新增公共类型或控件。
- `apps/terminal/ui/base/render/src/foundations/resolvePart.ts` 进入 `components/resolvePart.ts`，仍是
  `createElement` 唯一 allowlist；`SurfaceRoot`、`ScreenContainer`、`RenderProvider` 改为 JSX 等价树，
  保留 SurfaceContext、RenderContext、content sibling 顺序、fallback reason、props 与 Provider 关系。
- 迁移后的 `input/src/model/` 与 `primitives/src/rnr/` 已确认为空并移除；CP-3 目标包没有遗留旧目录。

## 真实 focused 输出

### TypeScript

以下四条命令均退出码 `0`：

```text
yarn --cwd apps/terminal/ui/base/input typecheck
yarn --cwd apps/terminal/ui/base/primitives typecheck
yarn --cwd apps/terminal/ui/base/render typecheck
yarn --cwd apps/terminal/ui/base/dev-host typecheck
```

### 包测试

```text
@catering-v2s/ui-base-input       Test Files 9 passed (9),  Tests 47 passed (47), exit=0
@catering-v2s/ui-base-primitives  Test Files 1 passed (1),  Tests 8 passed (8),   exit=0
@catering-v2s/ui-base-render      Test Files 8 passed (8),  Tests 37 passed (37),  exit=0
@catering-v2s/ui-base-dev-host    Test Files 4 passed (4),  Tests 11 passed (11),  exit=0
```

### AST/目录 focused 观察

使用与真实树 checker 相同的 resolver，对四个 CP-3 包结果为：

```text
CP3_TR_R03_FINDINGS=0
CP3_TR_R06_FINDINGS=0
```

模型门真实输出为：

```text
MODEL_TR_R02=PASS
MODEL_TR_R03=PASS
MODEL_TR_R04=PASS
MODEL_TR_R05=PASS
MODEL_TR_R06=PASS
MODEL_TR_R07=PASS
MODEL_RD12=PASS
MODEL_RD13=PASS
MODEL_RD14=PASS
MODEL_RD09_RD11=PASS
READABILITY_MODEL=PASS
```

当前完整真实树门仍按计划保持未启用状态，输出为：

```text
READABILITY_RULE_GATES=0
READABILITY_STATIC=PASS
```

这不是把 CP-4 的真实树结果提前写成 PASS。启用前做过一次 whole-tree `--rule` 观察，当前复核的部分批次
结果是 `TR-R03=4 finding(s)`、`TR-R06=16 finding(s)`；16 条 TR-R06 分别位于
`adapter/android/device/src/androidDevice.ts`、`adapter/android/dual-screen/src/imeInsets.ts`、
`adapter/android/persist-kv/src/androidPersistKv.ts`、`assembly/android/sample-terminal/src/platformPorts.ts`、
`ui/feature/sample-member-desk/src/{assembly,commands,module,parts}.ts`、
`ui/feature/sample-staff-auth/src/{assembly,commands,module,parts,variables}.ts`，以及
`ui/integration/sample-console/src/{assembly,baseModuleDescriptors,terminalSurfaces}.ts`；这些 finding 来自尚未执行的 CP-4 归位/等价改写，
因此不被当作 CP-3 目标包证据。CP-3 的可核验结果是上面的 scoped `0/0` 与模型 red/negative control
全 PASS。

### 既有 terminal static sequence

命令 `node tools/terminal-skeleton/verify-static.mjs` 以 runId
`ter-local-static-14440-1788784502513` 完成，进程退出码 `0`，终态输出为：

```text
READABILITY_MODEL=PASS
READABILITY_STATIC=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
TERMINAL_UI_STATE_STATIC=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_STATIC=PASS
```

## 证据边界与阶段结论

以上是静态、typecheck 与 focused `react-test-renderer` 证据。它证明了 CP-3 目标包的路径归位、类型可解析、
已有行为 oracle 仍通过，以及 render 的 JSX 等价改写未破坏现有测试观察；它不证明 Web 实际 pointer 命中、
Android 副屏输入、真实字体/视觉结果或生产 bundle DCE。

`CP-3_FOCUSED_PROOF=PASS`。进入 CP-4 前仍须完成 fresh 独立子 agent 的 CP-3 三维对账；任何 `OPEN` 必须
先修复并复查。

## CP-3 阶段三维对账

`REVIEW_CYCLE_ID=TER_READABILITY_IMPLEMENTATION_2026_09_07`
`REVIEW_TARGET=IMPLEMENTATION_STEP_RECONCILIATION`
`reviewerKind=INDEPENDENT_SUBAGENT`
`REVIEW_ROUND=2`
`REVIEW_ROUND_LIMIT=2`
`ROUND_FINAL_DECISION=SELF_DECIDED`
`CP3_STAGE_3D_RECONCILIATION=MATCHED`
`CP3_GATE_TO_CP4=OPENED`

fresh 独立 reviewer Bacon 的逐点结果为 `VERDICT=MATCHED`、`M/S/N=0/0/0`：

- 需求维：CP-3 的四个 `ui/base` 包归位、InputProvider 内部职责拆分、primitives 公共面、render JSX
  等价改写与唯一 `resolvePart` 例外均与需求一致；whole-tree 的 4 条 TR-R03 与 16 条 TR-R06 明确属于 CP-4。
- 详设/计划维：registry、owner/focus、complete、boundary、capacity、snapshot、keyboard routing、
  Provider/content/sibling/fallback 关系与 CP-3 计划锚点一致；证据没有把未启用的全树门写成 CP-3 PASS。
- 项目记忆/规范维：typecheck、focused test、静态模型和真实静态序列的证据档位分开；未声称 Web pointer、
  Android、副屏输入、视觉、production DCE、DEV、seed、UAT 或部署已验证。

CP-3 阶段无未闭 `OPEN`，允许进入 CP-4。独立 reviewer 的证据缺口（其审查会话不重复运行会清理目录的
package test runner）不构成 CP-3 的 OPEN，因为本文件已经保存了主 agent 在 CP-3 内实际取得的四包测试输出。
