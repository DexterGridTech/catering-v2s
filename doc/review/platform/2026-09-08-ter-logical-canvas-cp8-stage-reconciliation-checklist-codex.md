# TER 固定逻辑画布 CP-8 全批阶段三维对账与逐代码详设对账

STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP8_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-8_FULL_BATCH_3D_AND_CODE_DESIGN_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY_REQUIRED

## 1. 轨道、用途与边界

本清单是 CP-8 的实施步骤对账，不是正式 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查。它不使用
`REVIEW_CYCLE_ID`、`REVIEW_ROUND` 或正式 review 的两轮上限；发现本地可修复 OPEN 后，主 agent
修复并取得 focused proof，再召集新的 fresh 独立 reviewer，直到本阶段没有本地可修复 OPEN，或
事实确认需要 Dexter/设备能力后停止声称交付。此前把阶段对账误套入正式 implementation review
轮次上限是流程使用错误，根因是早期 CP 记录没有把两个 review target 明确分开；CP-4 至 CP-7
清单和本清单均已显式写出这一区别。

本阶段只做静态三维回读和逐代码—详设对账；不修改源码，不新增 fallback、兼容层、临时常量、
公共契约、第二 React host、第二 bridge 或第二单位系统。已有 focused/Web/Android 证据只按其
原档位引用；模型 red fixture 的 FAIL 不作为生产 FAIL。CP-7 的设备/外部决策 OPEN 必须原样保留。

## 2. 输入清单

### 2.1 权威需求与详设

- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md` 第 15-26、
  231-263、289-319 行。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md`
  第 68-82、215-259、322-367 行。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`
  第 143-159、245-287、382-414 行。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`
  第 17-37、78-109、137-180、431-478、607-690 行。
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`
  第 7-77、81-158、160-186、188-257、263-296、300-396、398-426 行。
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md`
  第 5-38、40-153、155-210、211-255、256-291、293-348 行。

### 2.2 项目记忆与规范

- `project-memory/operations/terminal-coding-standard.md` 第 21-45 行。
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md` 第 23-40 行。
- `project-memory/decisions/terminal-build-order-and-batches.md` 第 17-57 行。
- `doc/platform/terminal-coding-standard.md` 第 198-214、377-454、681-696、759-774 行。
- 当前 `AGENTS.md` 的“实施节奏、逐点双读与步骤级独立对账”“主 agent 唯一编码”及“正式
  implementation review 两轮上限”条款。

### 2.3 已交付证据与阶段资料

- `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md`。
- CP-0A 至 CP-7 阶段清单及其中列出的 focused、Web、Android 原始输出。
- 当前工作区源码、测试与 package metadata；范围不按文件名抽样。

## 3. 全批三维对账

三维对账必须重新从需求、详设/IA、项目记忆三条轴逐条回读，不能把 CP-0A 至 CP-7 的局部
结论相加。`MATCHED` 表示三维语义、当前代码与相称档位证据相互一致；`OPEN` 表示证据缺失、
外部决策未下达或某个源码锚点仍未闭合。表中不使用 `PASS` 代替证据结论。

| ID | 需求轴 | 详设/IA 轴 | 记忆/规范轴 | 当前代码/证据观察 | 证据档位 | verdict | 状态说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CP8-3D-01 | 横屏 PRIMARY 1280×800、SECONDARY 1280×720；旧 1157×723/962×541 退役 | alignment 详设 I-01、§4.1 | 单一事实源、不要保留旧有效解释 | package/parser 与 CP-7 运行记录使用新画布；旧命中只作为历史/fixture 分类 | static/Android/Web | MATCHED | 旧材料不得重新解释为当前基线 |
| CP8-3D-02 | 竖屏 PRIMARY-only 形态，不得转置横屏数字 | surface-form FORM-3、alignment §4.2 | 方向与拓扑不得由 input 推断 | parser/type 仅允许可选 portrait PRIMARY；package 未填 portrait；无 target profile，F 保持 OPEN | static/focused | OPEN | 形态约束已闭合，硬件 profile 仍等待 Dexter |
| CP8-3D-03 | Android adapter 提供 per-surface display/window/lifecycle 事实 | alignment I-02、§5 | DisplayMode 既有 owner；不得全局 current display | registry 按 PRIMARY/SECONDARY、displayId、windowIdentity、generation 保存并过滤 | static/focused/Android | MATCHED | 未扩 DevicePort/DisplayInfo |
| CP8-3D-04 | stable/current 与 IME 变化分离；稳定尺寸不能由 IME current 驱动 | alignment I-03、§5.2.1/5.2.2 | host 事实和 input 局部测量分层 | native/JS 记录 stable/current、IME 前后 scale 不变；CP-7 默认/非等比证据已分档 | focused/Android | MATCHED | H-02 结构与已取运行证据一致 |
| CP8-3D-05 | Android 以 scaleX/scaleY 逐轴铺满、不留边不裁切 | alignment I-04、A-C、H-04 | render owner 管理 host geometry | render controller 使用两轴 scale；已取得 primary scaleY=.9 的真实运行，但四角全集仍缺 | focused/Android | OPEN | CP7-13 外部证据缺口继续保留 |
| CP8-3D-06 | IME final inset 必须除 scaleY，input 只收逻辑单位 | alignment I-05、§7.1、D | input 不读宿主 scale/Dimensions | `bottomLogicalBeforeCanvasScale / scaleY`；primary scaleY=.9 的 339/.9 运行记录成立 | focused/Android | MATCHED | 未把 scale 下发 input |
| CP8-3D-07 | Web policy 未裁决前不得自定 contain 或 browser stretch | alignment I-06、§6.3、CP-5 | Web 是预览工具，策略须由 Dexter 决定 | 当前实现和 README 保留 policy OPEN；Web 运行只记录候选 geometry，不写成契约 | static/Web | OPEN | `OPEN_BY_DEXTER_DECISION`，不由 reviewer 关闭 |
| CP8-3D-08 | 事实由 owner 产生，不新增跨层聚合器；DisplayMode/TR-11 边界保留 | alignment I-07、§3.1A、RD-12 | TR-11 command owner 与层向约束 | modules/slices/commands/actors、ports、parts、surfaces 分 owner 发出；host source 只给 render | static/Android/Web | MATCHED | 未发现跨层业务写入 |
| CP8-3D-09 | InputSurfaceFrame 自测 onLayout；不读取 Dimensions/Platform/宿主 scale | FORM-R2/R3/R4/R5、keyboard requirements | input 与 foundations 边界 | frame 仍以自身 onLayout 传给 provider；source 只注入最终 imeInset | static/focused/Android/Web | MATCHED | 首帧 pending 与键盘可见性已覆盖 |
| CP8-3D-10 | 键盘键位、owner、焦点、滚动和业务断言不可改 | keyboard requirements、RD-10/IA 矩阵 | 行为证明不能由结构替代 | focused 测试与 clean primary UI 记录通过；逐条断言语义需由 CP8 code/design 表继续核 | focused/Android | MATCHED | 未把 screenshot 当唯一行为证据 |
| CP8-3D-11 | 公共 TS port、DisplayInfo、PlatformPortBindings 不扩展 | surface-form 非目标、alignment §1.3/§10 | 架构单 host/单 VM/不造第二 bridge | public types 未加 per-surface 字段；descriptor/host source 位于 adapter/render 结构面 | static/focused | MATCHED | 仅内部 source 结构变化 |
| CP8-3D-12 | 生产构建不得包含 dev raw diagnostics；cleanup 与业务证据分开 | alignment §8、CP-7、AGENTS observability | 调试面编译期剔除、日志分档 | final Web bundle exact event strings absent；Android/Web cleanup 分别记录 | static/Web/Android | MATCHED | first DCE failure 已保留 |
| CP8-3D-13 | CP-0 P-01 至 P-05 先于 CP-1；不支持就停机 | plan §2、O-02/O-03/O-04/O-05 | 不以文档/预期数字替代版本实测 | CP-0 已有 probe/evidence；secondary quantization、ADB capture 等边界没有被隐藏 | static/focused/Android | MATCHED | 证据仍按档位分开 |
| CP8-3D-14 | 全批先复核，再做逐代码对账；任一 OPEN 不得交付 | plan §10.1/10.2、AGENTS 阶段对账 | 步骤级 fresh 独立对账、正式 review 分轨 | 本清单建立独立 CP-8 轨道；此前阶段 review 轮次误用已修正 | static | MATCHED | 无轮次上限仅适用于阶段对账 |
| CP8-3D-15 | CP-7 A-G 的动态证据必须 fresh；外部 OPEN 不能改写 | alignment §9.2、CP-7 evidence | dynamic 与 static 不混同 | secondary PNG、secondary exact residual、四角 tap、生产 scroll E、Web policy、portrait 均原样保留 | Android/Web/static | OPEN | 交付闸门仍未闭 |

## 4. 逐代码与详设对账

本表覆盖详设源码矩阵和实施计划每一个允许变更组；同一文件的多个职责分别列出。行号是当前
工作区读取时的行号，后续任何代码变动都必须重新读取并更新本表。`actual observation` 只写
源码或已保存的原始输出，不写“应该如此”。行为类条目没有把调用次数、prop、字符串搜索或
UIAutomator 结构当作唯一证明。

| code path | symbol/anchor | design clause | expected behavior | actual observation | evidence tier | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/terminal/ui/integration/sample-console/package.json` 第 7-24 行 | `exports`、`terminalSurfaces` | §4.1、I-01、CP-1 规则 1-2 | 唯一新画布声明入口；PRIMARY/SECONDARY 为 1280×800/1280×720 | exports 有点号与 CSS 子路径；terminalSurfaces 使用 orientation→DisplayMode→size，新数字存在 | static | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts` 第 1-67 行 | `readTerminalSurfaces` | §3.2、§4.1、CP-1 | 复用 DisplayMode；正数解析；缺失/非法形态失败；portrait 只能是 PRIMARY | `SurfaceDeclarations` 用于 landscape 的两 surface；`PortraitSurfaceDeclarations` 仅含 PRIMARY；parser 拒绝 portrait.SECONDARY；4 个 focused tests 通过 | static/focused | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/index.ts` 第 1-12 行 | public exports | §3.1/3.2、CP-1 | 仅从包公开入口导出 assembly 与新 declaration 类型 | 重新导出 terminalSurfaces 与 landscape/portrait 类型；无旧 shape 旁路 | static | MATCHED |
| `apps/terminal/ui/integration/sample-console/test/terminalSurfaces.test.ts` 第 1-70 行 | portrait declaration tests | FORM-3、alignment §4.2、CP-1 | synthetic parser fixture 不得制造 SECONDARY portrait；不把 fixture 当硬件 profile | PRIMARY-only portrait fixture 通过；portrait SECONDARY fixture 被拒绝；focused test exit=0 | focused | MATCHED |
| `apps/terminal/ui/integration/sample-console/test-expo/App.tsx` 第 1-14 行 | Web production entry | CP-1 分母、CP-5 | 入口传入同一 declaration；CSS 走包契约 | 从包点号入口取得 assembly/terminalSurfaces；CSS 走包名子路径 | static/Web | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` 第 31-115 行 | `SurfaceInputFrame` | I-01、I-05、§8 | declaration 只作 host canvas 输入；InputSurfaceFrame 自己测量；IME 只收最终逻辑值 | `declaredSize` 只用于诊断 delta；frame 使用 `onLayout`；`useSurfaceHostImeInset` 注入 imeInset | static/focused/Android/Web | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` 第 119-129 行 | `createSurfaceForDisplayIndex` | DisplayMode/TR-11 边界 | display index 通过既有 display-context 派生 DisplayMode | 调用 `resolveSurfaceDisplayMode`，未引入 SurfaceKey | static/focused | MATCHED |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` 第 143-255 行 | `createSampleAssembly/createSurface` | §3.1、§8、CP-3 | assembly 只组装 source；startup owner 记录声明；业务组件不读 platform facts | `SurfaceRoot` 接收 canvas 与 per-mode source；日志注明 package/assembly source | static/Android/Web | MATCHED |
| `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts` 第 1-65 行 | host types/calculators | I-03/I-04/I-05、H-04/H-05 | 逐轴 scale；IME 只除 scaleY；snapshot 缺失返回 null | `scaleX=host.width/canvas.width`、`scaleY=host.height/canvas.height`；IME 用 `bottom.../scaleY`；非法值 null | static/focused | MATCHED |
| `apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx` 第 14-114 行 | `SurfaceHostController` | §3.3、§6.2、H-08 | source snapshot 到位后才渲染 canvas；transform 只在 render host；不把 scale 传给 input | pending 时只渲染 pending host；canvas 设置两轴 transform；context 仅提供 imeInset | static/focused/Android | MATCHED |
| `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx` 第 10-81 行 | `SurfaceRoot` | §3.1、CP-3 | host controller 包在 frame 外；SurfaceContext 仍使用 DisplayMode | `canvas` 与 source 进入 `SurfaceHostController`；SurfaceContext 值为 displayMode/containerKey | static/focused | MATCHED |
| `apps/terminal/ui/base/render/src/types/props.ts` 第 43-50 行 | `SurfaceRootProps` | §3.2、非目标 | render 只接结构型 canvas/source；不暴露硬件对象 | props 仅有 canvas 与 `SurfaceHostSource`，无 Platform/Dimensions/physical px | static | MATCHED |
| `apps/terminal/ui/base/render/src/index.ts` 第 14-25、37-43 行 | public render surface | §3.2、§10 | 公开结构型 calculator/source 类型与 controller；不扩业务 port | 导出 host foundation/type/controller/context；未导出 Android 硬件对象 | static | MATCHED |
| `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts` 第 1-239 行 | `acceptAndroidSurfaceHostEvent/createAndroidSurfaceHostSource` | §5.1/5.3、H-01/H-08 | per-surface identity/generation fence；foreign broadcast 不误报；无效/过期/缺失不进入 render | 按 key/window/generation/display 过滤；foreign known event 忽略；missing snapshot 保持 null | static/focused/Android | MATCHED |
| `apps/terminal/adapter/android/dual-screen/src/index.ts` 第 1-4 行 | adapter public source | §5.1 | 仅公开 source factory 与 snapshot 类型 | 公开 `createAndroidSurfaceHostSource`，未扩 DevicePort | static | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt` 第 6-24、43-73 行 | Expo module definition/map | §5.1 | 同一 module 的 AsyncFunction/Events；payload 带 per-surface facts | `getSurfaceHostSnapshot` 与 `onSurfaceHostChanged` 同模块；map 包含 key、display/window/generation、bounds/density/IME | static/Android | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` 第 161-367 行 | `TerminalSurfaceHostRegistry` | I-02/I-03、§5.2 | 一份 per-surface registry；stable/current 与 IME 事实按 owner/generation 更新 | registry entries 按 display index 保存 owner Window、snapshot、generation 与 ime；更新时 stable 不随 IME 重算 | static/Android | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` 第 399-430 行 | primary owner wiring | §5.2、P-01 | PRIMARY 用 Activity owner 的真实 window layout；日志带 identity | decorView layout/post-layout 调 `captureWindow(0, activity.window, "primary")`；沉浸式配置在同一 handler | static/Android | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` 第 465-550 行 | Presentation/surface creation | §5.1、§5.2.1、P-02 | SECONDARY 使用 Presentation target display；保留目标 density 修正；同一 React host | Presentation 以 target display 创建；`createSurfaceContext(...targetMetrics.densityDpi)`；ReactSurface view layout 被记录 | static/Android | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` 第 658-665 行 | `createSurfaceContext` | §5.2.1、非目标 | 只负责 ReactSurface target density 修正，不冒充 host measurement context | 该 helper 仍单独覆写 densityDpi；host registry 不以它拼 stable bounds/density | static/Android | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` 第 779-829 行 | re-layout/immersive lifecycle | §5.2、H-02 | owner window layout 变化与生命周期清理正确；不让系统栏改变 content rect | Presentation/Activity layout callbacks 捕获并 `applyImmersiveWindow`；CP-7 native logs 记录全屏 owner | static/Android | MATCHED |
| `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt` 第 24-102、104-108 行 | `TerminalImeInsetsCoordinator`、`TerminalImeInsetsEventBus` | §7.1、H-05 | 从目标 window 读 IME，按目标 density 输出 pre-canvas logical inset，并带 window/display identity | `WindowInsetsCompat.Type.ime()`、bottomPx/density→bottomLogical；show/hide 输出与 host source 关联 | static/Android | MATCHED |
| `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts` 第 12-42 行 | platform source wiring | §3.1、CP-3 | PRIMARY/SECONDARY 各自创建 adapter source；不共享 current singleton | 两次 `createAndroidSurfaceHostSource('PRIMARY'/'SECONDARY')` 传入同一 sample assembly | static/Android | MATCHED |
| `apps/terminal/assembly/android/sample-terminal/App.tsx` 第 1-38 行 | Android app entry | §5.1、CP-3 | 复用一个 assembly/React host；按 displayIndex 选择既有 DisplayMode | app 只取 package assembly 与 local platformPorts；displayIndex 交给 `createSurfaceForDisplayIndex` | static/Android | MATCHED |
| `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx` 第 23-73、141-190 行 | `InputSurfaceFrame` | FORM-R2/R3/R4/R5、I-05 | 自身 onLayout 是 frame owner；null/未测量不渲染 keyboard；只收 imeInset | root frame 用 `onLayout` 生成 LocalFrameMetrics；keyboard 条件要求 ready；无 Dimensions/host scale import | static/focused/Android/Web | MATCHED |
| `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx` 第 16-152 行 | `InputScrollArea` | §7.2、H-07 | scroll 计算使用 content-local rect 与 currentOffset 同坐标；input 不读 scale | 使用 `measureLayout(contentNode)`、viewport/current offset、`calculateScrollOffset`；请求 `before+delta` | static/focused | OPEN |
| `apps/terminal/ui/base/input/src/foundations/scrollIntoView.ts` 第 1-37 行 | `calculateScrollOffset` | §7.2、E | 以可见 top/bottom 与 input rect 得出最小非负 target，保留 before offset | 纯函数返回 `Math.max(0,currentOffset+delta)`；CP-7 缺 scaleY≠1 production before/after 运行证据 | focused/Android | OPEN |
| `apps/terminal/ui/base/primitives/src/components/PrimitiveScrollView.tsx` 第 16-58 行 | scroll bridge | §7.2、input boundary | 暴露 content node、scrollTo、onScroll offset，不暴露 host scale | `getContentNativeNode`、`scrollTo`、onScroll contentOffset；无 Dimensions/Platform | static/focused | MATCHED |
| `apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts` 第 1-109 行 | preview geometry/point mapping | §6.3、H-06 | 由 measured viewport 与 declaration 计算 preview；真实 hit 使用变换后坐标 | measured viewport、stage geometry、point mapper 与 transform helper 存在；策略仍是外部 OPEN | static/Web | OPEN |
| `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` 第 21-25、166-350 行 | `TerminalSurfaces`、`SurfaceCanvas` | §3.2、§6、H-06、CP-5 | preview viewport 是内部无 border 节点；canvas border 不侵占 surface frame；portrait 类型不得制造 SECONDARY | `TerminalSurfaces.portrait` 仅允许 PRIMARY；`previewViewport` 由 onLayout 测量；surface decoration 独立 overlay；logical stage 使用 scale | static/Web | MATCHED |
| `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` 第 454-601 行 | Web app lifecycle/toggle | §6、CP-5 | startup、resize、single/dual 重新计算；未测量期间有明确 pending | assembly、display info、surface mode 与 canvas 生命周期分开；Web fresh wide/narrow logs 已保存 | Web | MATCHED |
| `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` 第 814-864 行 | canvas/surface decoration styles | H-06 | 装饰 border 不改变 measured canvas/surface box | `styles.surface` 无 border；`surfaceDecoration` absolute overlay 有 border | static/Web | MATCHED |
| `apps/terminal/kernel/base/display-context/src/types/display.ts` 第 4-6 行 | `DisplayMode` | §3.1A、S-3 | PRIMARY/SECONDARY 类型唯一复用，不新增 SurfaceKey | `DisplayMode = 'PRIMARY' | 'SECONDARY'` | static | MATCHED |
| `apps/terminal/kernel/base/display-context/src/index.ts` 第 3-25 行 | display owner public read/commands | §3.1A、TR-11 | 既有 display facts/commands 继续归 display-context；host event 不交给业务 actor | 导出 `readDisplayInfo`、派生函数与 commands；render/dev-host 消费公开读侧 | static | MATCHED |
| `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts` 第 41-125、180-288 行 | `StartupTracker`、startup facts/ports | §8、非目标 | startup owner 读取真实 registry/descriptor；公共 ports 不携带 host geometry | startupRunId/port descriptor 与 surface tracker 在各 owner；PlatformPorts 公共面未扩展 | static/focused/Android/Web | MATCHED |
| `apps/terminal/ui/base/input/test/scrollArea.test.tsx` 当前测试文件 | scroll behavior assertions | RD-10、§7.2 | 测试路径可变，既有行为断言语义保留；新增诊断断言不得替代行为 | 诊断断言受 `__DEV__` guard；行为 fixture 与 scroll result 仍存在 | focused | MATCHED |
| `apps/terminal/ui/base/input/test/*`、`ui/base/render/test/*`、`ui/integration/sample-console/test/*` | focused test groups | CP-1/3/4/5/6、RD-10 | focused 结果支持结构/纯函数边界；行为类仍需真实 Web/Android | CP-7 evidence 保存各包 focused 输出；Web/Android dynamic 档位未混入 focused | focused | MATCHED |
| `apps/terminal/adapter/android/dual-screen/test/surfaceHost.test.ts` 当前测试文件 | identity fence tests | H-01/H-08 | stale/wrong/foreign surface 事件行为可观察且无误报 | 7 tests 通过，含 foreign broadcast ignore；Android run rejection absence 单列 | focused/Android | MATCHED |
| `apps/terminal/assembly/android/sample-terminal/metro.config.js` 当前文件 | NativeWind CSS input | 包边界修复 | CSS 经 sample-console exports 子路径解析；不恢复跨包相对路径 | 当前 App 与 Metro input 均使用包名/require.resolve 保护路径；既有行为证据在 CP-7 | static/focused/Android/Web | MATCHED |

## 5. CP-8 当前结论与 OPEN 保留

### 5.1 已匹配范围

- CP-0A 至 CP-6 的源码/设计边界、公共契约边界、input 隔离、DisplayMode 复用、DCE guard、
  host identity fence 与清理证据均在本次全批回读中保持 `MATCHED`。
- Newton 指出的 portrait declaration shape 缺口已由主 agent 修复：sample-console parser、public
  type、dev-host shape 与 focused parser tests 现在统一为 landscape 双 surface、可选 portrait
  PRIMARY-only；没有填写或猜测 target hardware profile。
- CP-7 的 Web wide/narrow、Android build/launch、primary business/custom keyboard、IME roundtrip、
  production DCE 与 cleanup 只按各自真实档位引用，不被 static/focused 结论替代。

### 5.2 不得关闭的 OPEN

| OPEN | 原始证据/决策依赖 | 当前结论 |
| --- | --- | --- |
| Android virtual FLAG_PRESENTATION secondary PNG | `screencap -d 2` 与 `screenrecord --display-id 2` 的原始失败；当前设备能力边界 | `OPEN`，不得以 primary 截图/UIAutomator 冒充 |
| SECONDARY measured delta 0.375549... | RN layout/density quantization；要求 exact-zero 的验收仍未满足 | `OPEN`，不得静默舍入 |
| scaleX/scaleY 非 1 的四角 safe-point 全集 | 已有 primary scaleX=1/scaleY=.9 运行只有部分 tap | `OPEN`，需新的真实 Android 行为证据 |
| scaleY 非 1 的 production scroll before/after offset | 480/1000 等探测未触发 production scroll oracle | `OPEN`，不得用纯函数/结构测试代替 |
| Web preview policy | Dexter 未在 contain/browser stretch 间裁决 | `OPEN`，不由 reviewer 自行选择 |
| portrait target hardware profile | Dexter 未提供真实 profile | `OPEN`，不填转置数字 |

以上 OPEN 中，前四项是动态设备/行为证据边界，后两项是 Dexter 决策边界；它们不是本地通过
追加静态改动即可安全关闭的条目。故 CP-8 的阶段对账可确认“无新的本地可修复 OPEN”，但不能
把全批交付标为已完成。

## 6. 阶段出口与后续闸门

1. fresh 独立 reviewer 必须以本文件作为输入，使用 `REVIEW_TARGET=CP_STAGE_RECONCILIATION`、
   `REVIEW_ROUND_LIMIT=NOT_APPLICABLE`，先证伪再读作者结论；允许只读 `rg/sed/nl/awk/git diff --check`，
   禁止写文件、构建、测试、Web/Android 动态操作。
2. 若 reviewer 找到本地可修复 OPEN，主 agent 必须修复、重新 focused proof、回读本表并重新召集
   fresh reviewer；阶段对账不因达到任何轮次数而停止。
3. 若 reviewer 确认只剩本表 §5 的设备/外部决策 OPEN，则记录其原始输出，阶段对账仍为 `OPEN`，
   `LOCAL_FIXABLE_OPEN=0`；不可写成正式 implementation review 的 GO。
4. CP-8 之后，只有在逐代码表和全批三维表每行均为 `MATCHED`、并完成计划 §12 的正式
   `REVIEW_TARGET=IMPLEMENTATION` 流程时，才可形成交付 brief。当前存在 OPEN，因此预先声明：
   `IMPLEMENTATION_NOT_READY`；`DELIVERY_TO_DEXTER_AND_CLAUDE=BLOCKED`。

## 7. 主 agent 双读记录

本次 CP-8 由主 agent 重新打开 §2 的全部输入后编写；任何下一次代码变更都必须以当前文件
作为“被对账的详设与计划映射”，重新读取 owning source 和原始需求，不以本表历史观察覆盖
新的源码事实。阶段 reviewer 的独立原始输出在其完成后追加到 CP-7 evidence 或单独的 CP-8
evidence，不由主 agent 代写 reviewer verdict。

## 8. CP-8 阶段 reviewer 原始输出与处置

### 8.1 Newton：第一次 fresh 阶段 reviewer

Newton 使用 `REVIEW_TARGET=CP_STAGE_RECONCILIATION`、`REVIEW_ROUND_LIMIT=NOT_APPLICABLE`，
以只读 shell 读取当前需求、详设、计划、证据、清单与源码；没有写文件、构建、测试、Web 或
Android 动态操作。原始机器可读输出如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP8_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES

STAGE_RECONCILIATION=OPEN
OPEN_COUNT=7
LOCAL_FIXABLE_OPEN=1
OPEN_BY_DEXTER_DECISION_COUNT=2
EVIDENCE_EXAGGERATION=CP8-CODE-01

CP8-3D-02=OPEN
CP8-3D-02.external-boundary=portrait target hardware profile 未提供；Web/Android/设备命令本轮禁止，不能本地关闭。
CP8-3D-02.local-fixable=当前 sample-console portrait declaration parser/test 与 PRIMARY-only 竖屏要求不一致。

CP8-3D-05=OPEN
CP8-3D-05.external-boundary=scaleX/scaleY 非 1 的四角 safe-point 全集仍缺真实 Android 行为证据；不是本地静态修复项。

CP8-3D-07=OPEN_BY_DEXTER_DECISION
CP8-3D-07.external-boundary=Web preview policy 未由 Dexter 裁决；不得选择 contain 或 browser stretch。

CP8-3D-15=OPEN
CP8-3D-15.secondary-screenshot=OPEN external-boundary；ADB secondary screenshot/screenrecord 失败仍保留。
CP8-3D-15.secondary-exact-residual=OPEN external-boundary；SECONDARY measured delta 0.375549... 未满足 exact-zero。
CP8-3D-15.production-scroll=OPEN external-boundary；scaleY!=1 production scroll before/after offset 仍缺真实 oracle。

CP8-CODE-01=OPEN local-fixable
path=apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts
current_lines=11-17,33-38,45-49
failure=SurfaceDeclarations 被定义为 Record<DisplayMode, SurfaceSize>，portrait?: SurfaceDeclarations；readSurfaceDeclarations 对 portrait 也强制读取 PRIMARY+SECONDARY。
conflicts_with=doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md:96-104,136-145; doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md:178-186; doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md:46-53,114-118
related_test=apps/terminal/ui/integration/sample-console/test/terminalSurfaces.test.ts:10-27 uses portrait PRIMARY+SECONDARY with 360x720
impact=作者 code-design 表把该行写为 MATCHED/“portrait 可选且不填猜测值”，但当前 parser/test 已编码 portrait SECONDARY 形态，并用 360x720 合成数值表达可读 portrait declaration。
minimal_fix=把 declaration model 拆成 landscape requires PRIMARY+SECONDARY，portrait absent or PRIMARY-only；测试改为不填 portrait 或只验证 PRIMARY-only synthetic parser behavior，并避免把 360x720+SECONDARY 表述成 target profile。
```

处置：主 agent 独立回读后确认该 finding，未扩大为 portrait hardware 实施；以最小 shape 修复拆出
`PortraitSurfaceDeclarations`（仅 `PRIMARY`），parser 明确拒绝 portrait `SECONDARY`，同步
dev-host 的结构类型并更新 focused parser tests。focused 输出为：sample-console
`terminalSurfaces.test.ts` 4 tests passed、exit=0；sample-console typecheck exit=0；dev-host
typecheck exit=0。随后必须以当前源码和本清单重新召集 fresh reviewer；本次输出不作为最终阶段结论。

### 8.2 CP-8 第一次修复处置（历史状态）

```text
CP8-CODE-01=REPAIRED_BY_MAIN_AGENT
FOCUSED_SAMPLE_CONSOLE_TERMINAL_SURFACES=PASS exit=0 (4 tests)
FOCUSED_SAMPLE_CONSOLE_TYPECHECK=PASS exit=0
FOCUSED_DEV_HOST_TYPECHECK=PASS exit=0
NEXT_REQUIRED=FRESH_CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT_RECONCILIATION=NOT_APPLICABLE
```

### 8.3 Hooke：第二次 fresh 阶段 reviewer

Hooke 是在 CP8-CODE-01 修复及 focused proof 后重新召集的 fresh、只读独立 reviewer。它允许只读
shell 读取材料，但没有写文件、构建、测试、Web、Android、ADB 或设备操作。原始机器可读结论如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP8_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES
STAGE_RECONCILIATION=OPEN
OPEN_COUNT=7
LOCAL_FIXABLE_OPEN=1
OPEN_BY_DEXTER_DECISION_COUNT=2
EVIDENCE_EXAGGERATION=NONE_FOUND_LOCAL
```

指定项状态：

```text
CP8-CODE-01=CLOSED
CP8-CODE-01.evidence=terminalSurfaces.ts 当前为 landscape PRIMARY+SECONDARY；portrait 可选且 PRIMARY-only；readPortraitSurfaceDeclarations 显式拒绝 portrait.SECONDARY。src/index.ts 导出 PortraitSurfaceDeclarations；dev-host TerminalSurfaces 类型同形；terminalSurfaces.test.ts 覆盖 PRIMARY-only 与 SECONDARY rejection。360x720 只作为 parser synthetic fixture/negative fixture，没有被当前源码写成 hardware profile。

CP8-3D-02=OPEN
CP8-3D-02.local-shape=CLOSED
CP8-3D-02.remaining=portrait target hardware profile 仍未由 Dexter 提供；不得把 landscape 或 360x720 fixture 当真实 profile。

CP8-3D-05=OPEN
CP8-3D-05.remaining=scaleX/scaleY 非 1 的四角 safe-point 全集仍缺真实 Android 行为证据；本轮禁止 Android，不能本地关闭。

CP8-3D-07=OPEN_BY_DEXTER_DECISION
CP8-3D-07.remaining=Web preview policy 未裁决；README/详设/checklist 均保留 OPEN，没有擅自选择 contain 或 browser stretch。

CP8-3D-15=OPEN
CP8-3D-15.remaining=secondary PNG capture、secondary 0.375549... exact residual、四角 tap、scaleY 非 1 production scroll、Web policy、portrait profile 均原样保留；没有用静态结论替代动态证据。
```

新增本地可修复 OPEN：

```text
CP8-CHECKLIST-01=OPEN local-fixable
path=doc/review/platform/2026-09-08-ter-logical-canvas-cp8-stage-reconciliation-checklist-codex.md
finding=逐代码表部分当前行号范围不准确。
evidence=terminalSurfaces.ts 当前 67 行，但表写第 1-65 行；terminalSurfaces.test.ts 当前 70 行，但表写第 1-66 行；dev-host createTestExpoApp 组件实际闭合到 601 行，表写第 454-600 行。
impact=不改变 CP8-CODE-01 的代码闭合，但违反 checklist 自己第 81-83 行要求“行号是当前工作区读取时的行号；actual observation 只写源码或原始输出”。
minimal_fix=主 agent 只需更新 CP-8 checklist 的对应逐代码表行号/锚点范围；不需要改生产源码，也不需要动态验证。
```

Hooke 未发现新的代码侧本地可修复 OPEN，也未发现把 Android/Web 动态缺口误报为本地静态已闭合
的证据夸大。其输出不能作为最终阶段结论，因为上述清单行号 OPEN 尚未由下一次 fresh 对账确认。

### 8.4 Laplace：第三次 fresh 阶段 reviewer

Laplace 是在 Hooke 指出的三处行号修复后重新召集的 fresh、只读独立 reviewer。它允许只读 shell
读取材料，但没有写文件、构建、测试、Web、Android、ADB 或设备操作。原始机器可读结论如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP8_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES
STAGE_RECONCILIATION=OPEN
OPEN_COUNT=7
LOCAL_FIXABLE_OPEN=1
OPEN_BY_DEXTER_DECISION_COUNT=2
EVIDENCE_EXAGGERATION=NONE_FOUND_LOCAL
```

指定项状态：

```text
CP8-CODE-01=CLOSED
CP8-CODE-01.evidence=terminalSurfaces.ts 当前为 landscape PRIMARY+SECONDARY；portrait 可选且 PRIMARY-only；readPortraitSurfaceDeclarations 显式拒绝 portrait.SECONDARY。src/index.ts 导出 PortraitSurfaceDeclarations；dev-host TerminalSurfaces 类型同形；terminalSurfaces.test.ts 覆盖 PRIMARY-only 与 SECONDARY rejection。360x720 只作为 parser synthetic fixture/negative fixture，没有被当前源码写成 hardware profile。

CP8-CHECKLIST-01=OPEN local-fixable
path=doc/review/platform/2026-09-08-ter-logical-canvas-cp8-stage-reconciliation-checklist-codex.md
finding=逐代码表部分当前行号/锚点范围仍不准确。
evidence=TerminalDualScreenModule.kt 表写第 6-24、45-75 行而当前 map payload 实际为第 43-73 行；TerminalDualScreenActivityHandler.kt 的 applyImmersiveWindow 延续到第 829 行；TerminalImeInsetsCoordinator.kt coordinator/事件总线延续到第 108 行；createPlatformPorts.ts surface tracker/返回逻辑延续到第 125/288 行。
```

其余状态：

```text
CP8-3D-02=OPEN (local-shape=CLOSED; portrait target hardware profile 未提供)
CP8-3D-05=OPEN (非等比四角 safe-point 全集仍缺真实 Android 行为证据)
CP8-3D-07=OPEN_BY_DEXTER_DECISION (Web preview policy 未裁决)
CP8-3D-15=OPEN (secondary capture、exact residual、四角 tap、scaleY 非 1 production scroll 等动态边界仍保留)
```

Laplace 未发现新的生产代码本地 OPEN，也未发现证据档位夸大；本次本地 OPEN 仅限清单行号/锚点，
修复后必须再次召集 fresh 阶段 reviewer。阶段对账继续使用 `REVIEW_ROUND_LIMIT=NOT_APPLICABLE`。

### 8.5 Lagrange：第四次 fresh 阶段 reviewer

Lagrange 是在 Laplace 指出的四组 native/source 行号修复后重新召集的 fresh、只读独立 reviewer。
它允许只读 shell 读取材料，但没有写文件、构建、测试、Web、Android、ADB 或设备操作。原始机器
可读结论如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP8_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES
STAGE_RECONCILIATION=OPEN
OPEN_COUNT=7
LOCAL_FIXABLE_OPEN=1
OPEN_BY_DEXTER_DECISION_COUNT=2
EVIDENCE_EXAGGERATION=NONE_FOUND_LOCAL

CP8-CODE-01=CLOSED
CP8-CODE-01.finding=NONE_FOUND_LOCAL
CP8-CODE-01.evidence=terminalSurfaces.ts 当前 1-67 行为 landscape PRIMARY+SECONDARY、portrait PRIMARY-only；readPortraitSurfaceDeclarations 拒绝 portrait.SECONDARY；src/index.ts 导出 PortraitSurfaceDeclarations；dev-host TerminalSurfaces.portrait 同为 Pick<..., PRIMARY>；terminalSurfaces.test.ts 覆盖 PRIMARY-only 与 SECONDARY rejection。360x720 只在 parser synthetic fixture/negative fixture 中出现，未写成 target hardware profile。

CP8-CHECKLIST-01=OPEN local-fixable
CP8-CHECKLIST-01.finding=当前有效逐代码表仍有行号/范围与当前 bytes 不精确。
CP8-CHECKLIST-01.evidence=package.json 表写第 7-23 行，但 terminalSurfaces 对象闭合在当前第 24 行；apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts 表写第 12-41 行，但 createSampleTerminalAssembly 调用闭合在当前第 42 行；apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts 表写第 42-125 行且 actual observation 命名 surface tracker，但 StartupTracker 类型锚点实际从第 41 行开始。
CP8-CHECKLIST-01.minimal_fix=只更新 CP8 checklist 的逐代码表行号/范围；不需要改生产源码、构建、测试、Web 或 Android。

CP8-3D-02=OPEN (local-shape=CLOSED; portrait target hardware profile 未提供)
CP8-3D-05=OPEN (非等比四角 safe-point 全集仍缺真实 Android 行为证据)
CP8-3D-07=OPEN_BY_DEXTER_DECISION (Web preview policy 未裁决)
CP8-3D-15=OPEN (secondary capture、exact residual、四角 tap、scaleY 非 1 production scroll 等动态边界仍保留)
```

Lagrange 未发现新的生产代码本地 OPEN，也未发现证据档位夸大；本地 OPEN 仍仅限清单行号/锚点，
修复后必须再次召集 fresh 阶段 reviewer。阶段对账继续使用 `REVIEW_ROUND_LIMIT=NOT_APPLICABLE`。

### 8.6 Harvey：第五次 fresh 阶段 reviewer与 CP-8 最终阶段状态

Harvey 是在 Lagrange 指出的三组清单范围修复后重新召集的 fresh、只读独立 reviewer。它允许只读
shell 读取材料，但没有写文件、构建、测试、Web、Android、ADB 或设备操作。原始机器可读结论如下：

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP8_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
FRESH_READ_ONLY=YES
NO_WRITE=YES
NO_BUILD_TEST_WEB_ANDROID=YES
STAGE_RECONCILIATION=OPEN
OPEN_COUNT=6
LOCAL_FIXABLE_OPEN=0
OPEN_BY_DEXTER_DECISION_COUNT=2
EVIDENCE_EXAGGERATION=NONE_FOUND_LOCAL

CP8-CODE-01=CLOSED
CP8-CODE-01.evidence=当前 bytes 中 terminalSurfaces.ts 第 1-67 行为 landscape PRIMARY+SECONDARY、portrait PRIMARY-only；readPortraitSurfaceDeclarations 拒绝 portrait.SECONDARY；src/index.ts 第 1-12 行导出 PortraitSurfaceDeclarations；dev-host TerminalSurfaces.portrait 同为 PRIMARY-only；terminalSurfaces.test.ts 第 1-70 行覆盖 PRIMARY-only 与 SECONDARY rejection。360x720 仅为 parser/behavior synthetic fixture，未写成 target hardware profile。

CP8-CHECKLIST-01=CLOSED
CP8-CHECKLIST-01.evidence=当前有效逐代码表已与当前 bytes 对齐：package.json 第 7-24 行、terminalSurfaces.ts 第 1-67 行、terminalSurfaces.test.ts 第 1-70 行、sample-terminal platformPorts.ts 第 12-42 行、TerminalDualScreenModule.kt 第 6-24/43-73 行、TerminalDualScreenActivityHandler.kt 第 161-367/399-430/465-550/658-665/779-829 行、TerminalImeInsetsCoordinator.kt 第 24-102/104-108 行、createPlatformPorts.ts 第 41-125/180-288 行均匹配。清单末尾历史 raw reviewer 输出仍含旧行号，但不属于当前有效逐代码表。

CP8-3D-02=OPEN
CP8-3D-02.evidence=local-shape=CLOSED；portrait PRIMARY-only 形态已由 parser/type/test 当前 bytes 证明。remaining=portrait target hardware profile 未由 Dexter 提供，不能把 landscape 或 360x720 synthetic fixture 当真实 profile。

CP8-3D-05=OPEN
CP8-3D-05.evidence=render foundation/controller 当前 bytes 使用 scaleX/scaleY 逐轴计算与 transform；但非等比 Android 四角 safe-point 全集仍缺真实行为证据，本轮禁止 Android/ADB，不能本地关闭。

CP8-3D-07=OPEN_BY_DEXTER_DECISION
CP8-3D-07.evidence=Web preview policy 在详设、README、CP7/CP8 证据中仍保持未裁决；当前 dev-host 只保留候选 geometry，不把 contain 或 browser stretch 写成有效契约。

CP8-3D-15=OPEN
CP8-3D-15.evidence=CP-7 外部/动态 OPEN 被原样保留：secondary ADB 像素捕获失败、secondary exact residual 0.375549...、非等比四角 tap 全集、scaleY 非 1 production scroll before/after offset 仍未闭合；未发现用静态/focused 证据替代动态证据的本地夸大。
```

Harvey 未发现新的本地可修复 OPEN，且确认阶段对账与正式 implementation review 的轮次轨道已分离。
因此 CP-8 阶段的最终状态是：

```text
CP8_STAGE_RECONCILIATION=OPEN
LOCAL_FIXABLE_OPEN=0
EXTERNAL_OR_DECISION_OPEN=6
REVIEW_ROUND_LIMIT_RECONCILIATION=NOT_APPLICABLE
IMPLEMENTATION_NOT_READY
DELIVERY_TO_DEXTER_AND_CLAUDE=BLOCKED
```

剩余 OPEN 不是本地静态清单问题：包括 secondary virtual display 像素捕获、SECONDARY 精确残差、
非等比四角真实命中全集、scaleY 非 1 的 production scroll 行为证据，以及未裁决的 Web policy、
portrait target hardware profile。它们必须分别取得设备/动态证据或 Dexter 决策后才能继续收口。
