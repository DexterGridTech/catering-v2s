# TER CP-4 阶段三维对账独立复核清单

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP4_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-4
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY_REQUIRED
```

## 目的与边界

这是 CP-4 实施步骤的阶段三维对账，不是正式的 `REVIEW_TARGET=IMPLEMENTATION` 对抗
review cycle。它不登记 `REVIEW_CYCLE_ID`，不占用正式 review 的两轮上限；如果修复后仍有
`OPEN`，可以再次召集 fresh reviewer，直到本阶段只剩 `MATCHED`。本清单只核 CP-4 的 IME
逻辑单位转换、host→sample→input 传递、content-local scroll、诊断事实与 focused proof。
不提前核 CP-5 的 Web preview policy、CP-7/CP-8 的真实 Web/Android 运行、portrait、最终
视觉验收或生产 bundle DCE。

reviewer 必须先独立读取三维输入，再逐条输出 `MATCHED` 或 `OPEN`。允许使用只读方式读取
文件和已存在的证据；不得修改任何文件、构建、测试、启动/停止设备或把 focused/static
结果写成 Web/Android 动态结果。不得输出正式 review cycle 的 `M/S/N` verdict。

## 必读输入

| 维度 | 仓库根相对路径 | 读取要求 |
| --- | --- | --- |
| 执行边界 | `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md` | 全文；特别是主 agent 写入、步骤级三维对账、证据分档与阶段审查轮次边界 |
| 项目模板 | `doc/platform/implementation-task-template.md` | 第 6b、逐代码对账、阶段对账与交付前置相关条款 |
| 原始需求 | `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md` | 0.2、§4.2-§4.3、§5.1-§5.3、§8 FORM-R2～FORM-R5 |
| 实施详设 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` | §7.1-§7.2、§8 诊断、§9.1 H-02/H-05/H-07、§10.2 与相关 host/input 边界 |
| 实施计划 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` | 第 6 节 CP-4 全部条款，尤其第 211-231 行及 focused fixture/证据要求 |
| CP-0 事实 | `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` | CP-0 选择的 branch、RN 0.86 measure probe 与当前证据档位；不得重判已选 branch |
| render host | `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`、`apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx`、`apps/terminal/ui/base/render/src/contexts/SurfaceHostImeContext.ts` | 当前全文；核对 IME 输入、scaleY 换算、pending 与 children 边界 |
| render entry | `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`、`apps/terminal/ui/base/render/src/index.ts` | 当前全文；核对 context/export 是否只暴露最终逻辑 inset |
| sample owner | `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | 当前 SurfaceInputFrame 与 host source 接线、diagnostic owner、InputSurfaceFrame 入参 |
| Android wiring | `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`、`apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts` | 当前 IME/host snapshot 传递；核对未恢复旧的独立 input scale/inset 路径 |
| IME owner | `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt` | 当前全文；核对 target-window density conversion 与既有 owner 未被 CP-4 改变 |
| input scroll | `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx`、`apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`、`apps/terminal/ui/base/input/src/contexts/context.ts`、`apps/terminal/ui/base/input/src/components/InputProvider.tsx` | 当前全文；核对 content-local API、viewport onLayout、diagnostic 与 input 边界 |
| primitives seam | `apps/terminal/ui/base/primitives/src/components/PrimitiveInput.tsx`、`apps/terminal/ui/base/primitives/src/components/PrimitiveScrollView.tsx`、`apps/terminal/ui/base/primitives/src/types/types.ts`、`apps/terminal/ui/base/primitives/src/index.ts` | 当前全文；核对 public primitive seam 是真实 native ref 转发而不是测试专用 API |
| focused tests | `apps/terminal/ui/base/input/test/scrollArea.test.tsx`、`apps/terminal/ui/base/render/test/renderSurface.test.tsx`、`apps/terminal/ui/base/primitives/test/primitives.test.tsx` | 当前全文与本 CP 原始运行结果；核对 before offset、scaleY、delta、requested/actual onScroll 与 IME 除轴 |
| current evidence | `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` | CP-4 focused 结果与证据分档；没有的动态证据不得补写成已有 |
| 项目记忆与审查规范 | `project-memory/decisions/deterministic-context-only.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | 当前任务命中的约束、只读 reviewer 与阶段复核边界 |

## 逐条三维对账问题

1. `SurfaceHostController` 是否只使用 host snapshot 的 `bottomLogicalBeforeCanvasScale` 与
   当前几何的 `scaleY` 计算 `finalImeInset = bottom / scaleY`；不可见 IME 是否为零，非法
   scale/inset 是否进入 pending 而非猜测；是否没有扣额外 padding/offset、误用 scaleX 或
   单一 scale。
2. host controller 是否把最终纯逻辑 `imeInset` 通过 render-owned context 传给
   `SurfaceInputFrame`，sample 是否只负责记录 displayMode/declaration/host-source provenance，
   未把 host snapshot、scale、density、physical px 或 Dimensions/Platform 传给 input/business。
3. Android IME owner 的 target density conversion 与副屏 density correction 是否保持；CP-4
   是否没有恢复旧的独立 input-facing IME source、扩展公共 platform contract、添加第二 bridge
   或改变 system/virtual keyboard 的既有业务语义。
4. `PrimitiveInput.measureLayout` 是否真实转发到当前 native/web ref；
   `PrimitiveScrollView.getContentNativeNode` 是否取得 ScrollView 的真实 content node；旧的
   `measureInWindow`/`scrollTo` 通用 seam 是否仍保留且没有被伪造替代。
5. `InputScrollArea` 是否用 content node 作为唯一相对坐标锚点，并用自身 viewport 的
   `onLayout` 与 content `currentOffset` 构造同一逻辑坐标系；是否彻底不再用
   `measureInWindow` 值计算 delta，也没有失败时退回 window 坐标、读取 scale、Dimensions 或
   Platform。
6. focus fixture 是否真的具备非零 before offset、外部 scaleY≠1 的语义、逻辑下沿多出 200、
   `delta=200`、`requestedOffset=before+200`，且随后以 `onScroll` 观察 actual offset；不是只
   断言 `scrollTo` 被调用或只在 offset=0 下通过。字段可见性/键盘遮挡若未在本 CP 动态验证，
   必须明确留到对应动态 CP，不能用该 focused test 冒充。
7. 输入诊断事件是否统一标注逻辑单位，并至少能记录 viewport layout、before/current offset、
   content-local input/viewport rect、delta、requested offset 与 actual `onScroll`；是否脱敏且
   没有把业务输入值、密码、手机号或 raw payload 写入日志。
8. CP-4 focused tests/typechecks 的结果是否与 static/focused/Web/Android 档位分开；是否没有
   改变既有业务断言语义、键盘布局语义、字段值语义或焦点恢复语义；新增断言是否是结果型
   行为观察而非调用次数、prop 值或字符串搜索的唯一证明。
9. CP-4 的改动是否只覆盖本步 IME/scroll 与必要 primitive seam；是否没有提前固定 Web
   preview policy、修改 portrait profile、改变 CP-0 stable/current branch 或把未决项伪装成
   已决定的产品行为。

## 输出格式

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP4_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-4
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=MATCHED|OPEN
OPEN_COUNT=<number>
```

每一条只写 `MATCHED` 或 `OPEN`。若为 `OPEN`，必须给出仓库根相对路径、具体行号、失败
场景、影响面和最小根因修复；不得输出正式 review cycle 的 `M/S/N`，不得把阶段结果写成
正式 implementation review GO，也不得宣称 CP-4 以外的动态验收已完成。
