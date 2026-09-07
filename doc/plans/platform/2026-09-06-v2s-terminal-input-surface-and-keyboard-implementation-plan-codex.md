# TER Terminal 输入承载形态与虚拟键盘 v2 实施计划

> STATUS: IMPLEMENTATION_COMPLETE_PENDING_EXTERNAL_REVIEW
> IMPLEMENTATION_AUTHORITY: true
> REVIEW_TARGET: IMPLEMENTATION
> DESIGN_REF: doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md
> REQUIREMENT_REFS: doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md; doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md; doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md; doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md
> IMPLEMENTATION_ADMISSION: ADMITTED_BY_DEXTER

## 0. 任务边界

本文件定义实施边界、步骤与证据口径；源码、测试与文档只能由主 agent 在已获授权的实施阶段
写入，不运行 DEV、seed、UAT 或部署，不改设备策略。两条需求 S 已在需求文件中处置：竖屏真实消费者矩阵补齐三行；
低于 `MIN_SUPPORTED_FRAME_WIDTH=360` 时必填 virtual 输入有可见不支持路径。

### 0.1 2026-09-07 Web 宿主缩放修复增补（Dexter 直接指派）

当前实施收到 Dexter 对 Web 体验的明确修复要求：预览 surface 必须保持声明逻辑分辨率的
宽高比，并随页面可用宽度整体等比缩小，不能让每棵 surface 通过 flex/aspectRatio 被页面
挤压。故本计划 §6.2 原先关于响应式 surface box 的表述由本增补替代；host preview 的唯一
缩放接缝与 input 内部的禁止边界均以本增补及 §6.2 正文为准。

实现范围只在 `apps/terminal/ui/base/dev-host`：`SurfaceCanvas` 以自己的 canvas `onLayout`
作为预览宽度输入，`surfacePreview.ts` 计算当前已挂载 surface 的逻辑 stage 与共同倍率；
logical stage 和每棵 surface box 保留固定声明 width/height，Web host 只在 logical stage
这一处施加 preview transform。`ui/base/input` 仍不读取宿主尺寸/scale，`InputSurfaceFrame`
仍使用自己的 local `onLayout` metrics；不会新增物理尺寸桥，也不改 Android/native。

Web 真实验收必须观察 `getBoundingClientRect()` 与 `elementFromPoint()`，用于证明视觉命中
来自实际 DOM；缩放后的 Web rect 不作为 Android 48dp 证据。`scaleToFit=false` 保持倍率 1
并由外层滚动承载超出宽度的 stage；首帧未收到 canvas layout 时不渲染 stage。

判据正本不可省略：`S-30..S-39`（包括 S-36/S-37/S-38/S-39）读取
`doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`
第 9.2 节；`PF-1..PF-8` 读取
`doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md` 第 6 节。
本 plan 的 `REQUIREMENT_REFS` 与 fresh review 最小输入清单均包含这两个正本；不允许从
历史 review 摘要或作者转述补判据。

实施阶段必须由主 agent 写入全部代码、测试、依赖和文档；fresh 独立子 agent 只能只读审查、
对账和报告 finding。Git 由 Dexter 控制，本计划不把 Git 作为任何前置动作。

## 1. 目标与不变量

### 1.1 目标

把 input 的几何事实从静态 `terminalSurfaces` 改为每个实际交互 frame 的 `onLayout`；让
每个 surface frame 与 Web resize 使用同一套四布局键盘；让 alpha/financial 在真实
`MemberForm` 路径可验证但不污染业务；恢复真实
焦点、owner、收缩和滚动行为；让实施结果可以逐代码对账到详设。

### 1.2 不变量

- input 不新增或改变 ReactHost、ReactSurface、JS VM/store、process、bootstrap 或 Android 拓扑。
- 每个 InputSurfaceFrame 只消费自己的实际 `onLayout`；不消费 Dimensions、设备分类、
  另一个 surface 测量或静态 `terminalSurfaces`。
- full/alpha 使用 dense 横向 token 32；numeric/financial 使用 standard 横向最小 48；
  纵向 key cell 高 48；full、numeric 与 financial 四个视觉行需要 219，alpha 三个视觉行
  需要 168；dock 精确包住当前布局，不为短布局预留 rowBlockOffset 空白。numeric 的 `0`
  横跨前两列，右侧一列内部左右放 backspace/complete；financial 的 `-/.` 在第一列内部
  左右分布、`0` 独占第二列、右侧一列内部左右放 backspace/complete；两种布局均使用三列
  shared cell width。
- system/virtual owner 互斥，两个方向都经 `none`；virtual→system 第一次点击不能被
  目标字段自己的 `Keyboard.dismiss` 吞掉。
- layer suspend 清 owner；restore 先发 boundary restore 再由真实 focus 且 token 有效时重开。
- content viewport 已收缩时，scroll 算法不二次扣 dock/ime inset。
- alpha/financial 仅 `MemberForm` registry-only，不进 Member、PendingMember、command、
  dirty、customer confirm。
- 模型红向量的 FAIL 与真实生产树的结果分开报告；PF-1..PF-6 绿不能单独宣布性能达标。

## 2. 交付顺序与 CP 总览

实施必须按 CP-0→CP-1→CP-2→CP-3→CP-4→CP-5→CP-6 顺序执行。每个 CP 结束后必须先做
三维对账，任何 `OPEN` 未闭不得进入下一 CP。

CP-0 至 CP-4 的每个“阶段三维对账”都使用同一执行分工：主 agent 只提供前后双读留痕、
focused proof 和待核对清单；fresh 独立子 agent 在进入下一 CP 前逐项给出唯一的
`MATCHED`/`OPEN` 结论；主 agent 只修复 `OPEN`，不得自判阶段已 `MATCHED`。CP-5 的
整体对账同样由 fresh 独立子 agent 给出最终结论。

| CP   | 执行主题                                                   | 主 owner                               | 输出                                                                                            | 进入条件                            |
| ---- | ---------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| CP-0 | input 与既有 Android carrier 的边界核对（不改 App 方向锁） | 主 agent + input/assembly source audit | imeInset 接缝与既有 carrier 保持；方向锁不作为 input 准入                                       | 获得实施授权；本计划/详设 review GO |
| CP-1 | local frame measurement 与公共面收敛                       | input package、sample-console assembly | onLayout metrics、capacity states、删除 static surfaceSize                                      | CP-0 boundary audit                 |
| CP-2 | keyboard layout/geometry/focus/scroll                      | input + primitives                     | four data layouts、regions、dense token、PrimitiveButton key variants、real focus owner、scroll | CP-1 capacity/metrics focused proof |
| CP-3 | sample consumers 与 Web surface preview                    | sample-member-desk、dev-host、assembly | alpha/financial probes、portrait matrix、fixed logical surface boxes、host stage scale        | CP-2 focused input proof            |
| CP-4 | focused/static/typecheck 与 run-scoped verification        | all affected packages                  | evidence bundles、red mutations、Android/Web evidence when authorized                           | CP-3 source complete                |
| CP-5 | whole-batch three-dimensional reconciliation               | 主 agent + fresh read-only reviewer    | new full reconciliation, all MATCHED                                                            | CP-4 complete                       |
| CP-6 | **逐代码与详设对账**及交付 brief                           | 主 agent + fresh read-only reviewer    | code↔design ledger, only MATCHED/OPEN, review brief                                             | CP-5 complete; no OPEN              |

## 3. CP-0：input 与既有 Android carrier 的边界核对

本专题解决的是 input 在实际 surface frame 中的测量、几何、焦点与交互，不解决 App 是否
锁定 landscape，也不改变 AndroidManifest、Expo app.json、Presentation 拓扑或设备策略。
因此 CP-0 不新增 Android lifecycle listener，不调整 `TerminalDualScreenActivityHandler`、
`TerminalDeviceModule` 或方向声明；既有 adapter 只作为 `imeInset` 平台事实的提供者。

### 3.1 精确核对集合

1. 静态确认 `TerminalDualScreenActivityHandler` 仍提供既有 primary/secondary carrier，且
   `TerminalImeInsetsCoordinator`/`imeInsetsSource` 是 input 唯一消费的 Android 平台事实。
2. 静态确认 `InputSurfaceFrame` 不读取 DisplayManager、Dimensions、window、Platform、
   terminalSurfaces 或其它 surface 的尺寸；实际 frame 尺寸只来自自身 `onLayout`。
3. 静态确认 CP-0 不修改 `MainActivity`、`MainApplication`、AndroidManifest、`app.json`，
   不新增 host/VM/process、ReactInstanceManager、设备策略或 IME policy。

### 3.2 可证伪门、停止条件与证据

| 项     | 判据                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| 边界门 | carrier 的既有 `imeInset` 接缝可被 assembly 传给 InputSurfaceFrame；input 不反向依赖 carrier 拓扑或方向锁             |
| STOP   | 若 input 为了展示正确必须改方向声明、创建第二 host/VM/process、读取其它 surface 尺寸或新增设备策略，立即停机交 Dexter |
| 证明   | 只做 source/static boundary audit；Android/Web 运行证据留到获授权的平台验证，不能用本 CP 的静态结果冒充运行结果       |
| 禁止   | 不解除 landscape lock、不试 adb/IME policy、不把副屏系统 IME 变成 input 通过条件                                      |

### 3.3 阶段三维对账

主 agent 提供 input requirements、详设 §4.1/§4.5/§4.7、assembly 与 adapter 的前后双读留痕；
fresh 独立子 agent 在进入 CP-1 前逐项给出 `MATCHED`/`OPEN`。主 agent 只能修复 `OPEN`，
不能把方向锁是否存在或既有 Android carrier 的运行结果写成 input 已验证。

## 4. CP-1：本地测量与公共面收敛

### 4.1 精确变更集合

1. `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`：在真实根 View
   `ui.base.input:surface-frame` 接 `onLayout`，移除 `surfaceSize`；以 `LocalFrameMetrics`
   驱动 `InputProvider`，保留 `imeInset`；内容区与 dock 为兄弟节点。
2. `InputProvider.tsx`：移除 static metrics 初始化；加入 `unmeasured`、capacity enum、
   blocked field 和统一内容收缩；任何 virtual focus 先做 capacity 判定，不支持时不提交 owner。
3. `src/types.ts`/`src/index.ts`/`terminal-invariants.json`/README：删除 public
   `InputSurfaceSize` 与 surfaceSize props；保留其它既有 public contract 与 `imeInset`。
4. `src/model/keyboardHeight.ts`：按详设常量和公式实现 geometry/capacity；不得引入
   Dimensions、window、Platform、terminalSurfaces。
5. `apps/terminal/ui/integration/sample-console/src/assembly.tsx`：`SurfaceInputFrame`
   只传 `imeInset`；删除按 displayMode 取 `terminalSurfaces.surfaces` 的尺寸桥。
6. 迁移所有测试调用点到真实 `onLayout` fixture；不得用默认静态尺寸伪造首帧。

### 4.2 精确几何门

| 反例                                                            | 必须发生                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| 无 onLayout                                                     | 内容可见、dock 不渲染、capacity=unmeasured                            |
| width<360                                                       | capacity=unsupported-width；dock 不渲染；显示不可支持提示；不伪造提交 |
| `height - MIN_CONTENT_HEIGHT` 使 dock<当前布局 verticalRequired | capacity=unsupported-height；不以旧固定高度门通过                     |
| 横向 cell 小于 dense/standard 下限                              | capacity=unsupported-horizontal；不溢出、不压缩到未声明 token         |
| 旋转/Web resize                                                 | 旧 metrics 不能跨 frame 复用；新 onLayout 后 geometry/capacity 重算   |

### 4.3 阶段三维对账

必须逐条核对 requirements 的 FORM-1..5、KEY-R1/R2/R4/R5/R6/R10、详设 §4.1–§4.3/§5、
memory 的 local-measurement 与 false-green pitfalls。`InputSurfaceSize` 搜索结果、assembly
消费者与 public export 必须逐一记录，不得只写“全仓已改”。

## 5. CP-2：键盘数据、几何、焦点与滚动

### 5.1 精确变更集合

1. 新建/重构 `apps/terminal/ui/base/input/src/model/keyboardLayout.ts`，只放
   `KeyboardKeyDefinition`/rows/layout definitions。固定四布局，动作键与内容键共用末行：
   - full：`1234567890`、`qwertyuiop`、`caps,asdfghjkl`、`shift,zxcvbnm,backspace,complete`；
   - alpha：qwerty、home、`shift,zxcvbnm,backspace,complete`；
   - numeric：123、456、789、一行三列 grid（`0` 跨前两列，backspace/complete 右列左右）；
   - financial：123、456、789、一行三列 grid（`-/.` 左列左右，`0` 中列，backspace/complete 右列左右）。
2. `VirtualKeyboard.tsx`：把 flat button list 改成 row/zone renderer；保留既有 key semantics，
   按详设 region/segment/key testID 生成节点；compound row 的动作区仍由 `region:actions`
   包裹，所有可操作键仍经 `PrimitiveButton`/automation path。
3. `InputProvider.tsx` + `useInputField.ts`：owner transition 由共享
   `preflightFocusTarget` 和 `onFocus` commit 组成。pointer `onPressIn` 与
   `focusField`/`completeField` 的程序化 focus-next 都必须调用同一 preflight；
   `completeField` 在 `nextField.inputRef.focus()` 前调用它。virtual→system 不在目标
   onFocus 调 dismiss；system→virtual 在旧 system 仍 focused 时 dismiss；same owner 只改绑；
   stale blur 不能清新 owner。
4. `LayerStack` 不改变既有顺序；`SurfaceFocusBoundaryContext` 仍只传 suspend/restore。
   provider suspend 清 owner/virtual dock 并做全局 `Keyboard.dismiss`；restore 只有 token
   有效且实际收到 focus 才重开。
5. `InputScrollArea.tsx`/`useInputField.ts`：focus/active/geometry effect 触发一次
   `ensureVisible`；传 `viewportAlreadyShrunk=true`；无 ancestor no-op；按键热路径不测量。
6. `VirtualKeyboard` 使用 exact tokens：`MAX_DOCK_HEIGHT=320`、`MAX_DOCK_RATIO=.5`、
   `DENSE_KEY_MIN_WIDTH=32`、`DENSE_COLUMN_GAP=2`、`STANDARD_COLUMN_GAP=8` 等，full/alpha
   纵向 cell 高 48、numeric/financial 复合区内每个子键同样保持一行高；dock 高度按当前
   layout 的 `verticalRequired(visualRowCount)` 精确包裹。shared row 与 grid column 都使用
   layout cellWidth；列内水平分组使用同一列间距，禁止用 rowBlockOffset 为短布局留空，也
   禁止以缩小子键高度换取复合区适配。
7. `PrimitiveButton` 为 default/key/key-action 三种呈现 variant 提供按键自身的局部
   `onPressIn`/`onPressOut` pressed style：key opacity `0.78`、key-action opacity `0.72`、
   default opacity `0.86`，均使用 scale `0.985`；该样式不新增业务 prop、不触发输入状态更新。
   默认按钮语义与既有调用点保持不变，input/feature 不得传 `className` 或复制 primitives token。

### 5.2 行为证据要求

- `KEY-R8` 必须使用真实焦点 harness/受控 native focus 观察目标字段第一次点击后的
  focus、owner 和可继续编辑；不得只调用 `props.onFocus`、只数 dismiss 或只看 prop。
- hit target 必须在实际 DOM pointer box 上观察；host preview scale 只能由 `logicalStage`
  管理，transform 前逻辑尺寸不算 Web/Android 物理 hit target 证明。
- `S-36` 同时观察内容收缩和字段完整可见；纯公式测试不能替代 scroll/focus observation。
- `PF-1..PF-6` 的测试不建立延迟/帧率基建；必须加 PF-7 连打观察和 PF-8 按键路径无同步
  重活；六项全绿也不能单独写“性能达标”。
- `KEY-R10` 必须在真实 Pressable 节点上观察按下生命周期：触发 `onPressIn` 后当前节点
  获得当前 variant 的 opacity/scale，触发 `onPressOut` 后恢复未按下样式；不能用 onPress
  调用次数、静态 prop 或 mock callback 代替按下状态反馈。

### 5.3 阶段三维对账

逐条比较 requirements §3–§8、KEY-R1..R10/PF-1..PF-8、详设 §4.3–§4.6/§8、memory 的
input owner、first-click、keyboard performance、scroll double-subtraction 记录。任何调用
计数 false green、layout ID 漂移、region 省略或 layer restore 顺序偏差都是 `OPEN`。

## 6. CP-3：sample consumers 与 Web surface

### 6.1 sample 变更

只改 `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx` 的
字段注册区域和清理路径：在 phone 后添加两个 registry-only 字段：

```text
keyboard-alpha-probe:
  label=英文字符测试（仅 sample）
  layout=alpha
  testID=sample.desk.member-form:keyboard-alpha-probe

keyboard-financial-probe:
  label=金额格式测试（仅 sample）
  layout=financial
  testID=sample.desk.member-form:keyboard-financial-probe
```

两者共同显示 `不保存到会员资料`。提交仍只按现有 name/phone fieldId 读取；不得改变
`Member`、`PendingMember`、`submitMemberCommand`、`confirmMemberCommand`、dirty 或
customer-member。重扫 `MemberForm` 的显式 fieldId 读取、success/cancel/failure retry/
re-enter/unmount 清理点。

### 6.2 Web 变更

只改 `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx#SurfaceCanvas` 与同包内部的
`src/surfacePreview.ts`：canvas 的 `onLayout` 只记录宿主预览可用宽度；几何函数按
`terminalSurfaces.layout`、当前已挂载的 `PRIMARY/SECONDARY` 声明尺寸和固定 gap 计算
logical stage，`scaleToFit=true` 时计算一个不超过 1 的共同倍率。stage 外壳的渲染宽高
按 `logical stage × scale + padding` 设置，内部 logical stage 固定逻辑 width/height，
每棵 surface box 固定其自己的声明 width/height、`flexShrink=0`，不再使用 flex/aspectRatio
互相挤压。首帧没有正的 canvas layout 时只渲染 `measure-pending`，不猜尺寸；`false` 时
倍率固定为 1、canvas 允许滚动。

这是 Web 预览宿主层的定向缩放，不是 input 几何机制。`InputSurfaceFrame` 虽随所属
surface 在 Web 预览中一起显示缩放，但 input 只消费自己真实 frame 的 local `onLayout`，
不读取 host scale、不把逻辑尺寸冒充 Web 物理 hit target。浏览器验证需用实际 DOM rect 中心
与 `elementFromPoint` 观察命中；不得以 transform 前逻辑尺寸替代。

`sample-console/src/assembly.tsx` 只保留 `SurfaceRoot`/`InputSurfaceFrame` composition 与
`imeInset` bridge，不再穿 `terminalSurfaces` 尺寸；Android/native 不读取该 Web 预览配置。

### 6.3 业务矩阵门

真实消费者必须逐项通过：

| 形态                | 真实消费者                                                                         |
| ------------------- | ---------------------------------------------------------------------------------- |
| landscape PRIMARY   | staff-auth full；member-form numeric phone、alpha probe、financial probe           |
| landscape SECONDARY | customer-member numeric age；不含 alpha/financial                                  |
| portrait PRIMARY    | staff-auth full；member-form numeric/alpha/financial；handheld-confirm numeric age |

缺任何一行或把 probe 写入业务 payload，CP-3 为 `OPEN`。

CP-3 还必须覆盖 sample verification 正本的完整 `S-30..S-39` 分母，不得只验证键盘
出现与字段编辑。特别是 `S-38` 的双屏竞态必须由真实 actor/CustomerMember 路径证明三条
结果同时成立：顾客输年龄时店员撤回后 SECONDARY 回到 `customer-welcome`；顾客随后点
「确认」不产生登记；store 中没有年龄残留。遗漏任一观察点，CP-3 为 `OPEN`。

### 6.4 阶段三维对账

核 requirements 两份 §2/§9、详设 §5/§6/§10/§11、memory 的 UI foundation、sample owner、
no business-term primitive 与 no className 约束。重点是 alpha/financial 不能变成会员领域
事实，也不能由 Web host 重新引入静态尺寸桥。

## 7. CP-4：验证、证据档位与资源纪律

### 7.1 focused/static/typecheck 命令

获运行授权后，由主 agent 在 affected package 根目录运行实际 package scripts；命令以当时
`package.json` 为准，不手写替代测试入口。最小范围为：

| 范围                                          | 证据                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/terminal/ui/base/input`                 | typecheck、owned tests、edit/snapshot/provider/keyboard/scroll focused tests                                                           |
| `apps/terminal/ui/base/primitives`            | typecheck、existing PrimitiveInput/PrimitiveButton/ScrollView focused tests；默认语义无破坏，详设批准的 key variant 作为呈现-only 加法 |
| `apps/terminal/ui/base/render`                | typecheck、LayerStack focus boundary focused tests                                                                                     |
| `apps/terminal/ui/feature/sample-member-desk` | typecheck、MemberForm/customer actor focused tests                                                                                     |
| `apps/terminal/ui/integration/sample-console` | typecheck、assembly/public surface focused tests                                                                                       |
| `apps/terminal/ui/base/dev-host`              | typecheck、SurfaceCanvas tests/fixture evidence                                                                                        |
| Android adapters/assembly                     | Gradle/typecheck and authorized Android run evidence; no source-only result called runtime                                             |

若某 package script 名称与本文列举不同，以当前 package.json 的现有 script 为准并记录实际
命令；不得新增另一套测试 runner 来绕过失败。

### 7.2 红向量分档

| 类别                     | 模型红向量                                                  | 真实树证明                                                                                                                     |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| geometry                 | KEY-R1/R2/R4/R5/R6、FORM-R2/R3/R4                           | typecheck/focused geometry 与获授权 Web/Android local layout evidence 分开                                                     |
| focus                    | KEY-R8；去掉共享 preflight（包括 complete focus-next 路径） | real focus harness/Android interaction；不能用 call count                                                                      |
| sample boundary          | KEY-R3/R9                                                   | static consumer search + MemberForm focused submit/cleanup                                                                     |
| topology                 | FORM-R1/R6                                                  | adapter static + authorized Android run；不以模型 FAIL 冒充设备结果                                                            |
| Web hit                  | FORM-R5                                                     | local Web `getBoundingClientRect` + `elementFromPoint` 已执行并记录于 `doc/evidence/platform/terminal-input/web-surface-scale-2026-09-07.md`；Android 48dp 与真实 POS 仍不执行 |
| customer withdrawal race | S-38                                                        | double-screen actor run/controlled sample interaction；必须观察 SECONDARY 回 welcome、后续确认不登记、store 无年龄残留三条结果 |

每次 mutation 记录 first failure、last known good、broken boundary；FAIL 不是生产树 FAIL。
动态运行还要把 business 与 cleanup 分开，受管 process/log/manifest 按仓内规范记录。

### 7.3 动态停止边界

- 若 input 无法消费既有 surface-local frame 与 `imeInset` 接缝，或必须改 Android carrier 才能
  让自身键盘展示，停机；App 是否锁定 landscape、是否双屏不属于本包的准入条件。
- 副屏 system IME 不可见保持既定产品决定，不试权限或设备策略；仅验证 virtual keyboard。
- 真实 POS 未授权/未执行，任何模拟器结果必须写“在双屏 Android 模拟器上验证，未在真实 POS 硬件上验证”。
- Web browser proof 只有另行授权才运行；不能以静态 screenshot 代替 rect/hit observation。

## 8. CP-5：全批三维对账

### 8.1 执行方式

主 agent 在全部 CP focused proof 完成后、整体测试前，重新逐条打开并留下前后双读留痕；
随后由 fresh 独立子 agent 逐条作出整体结论：

1. 两份 requirements 的所有 FORM/KEY/PF、sample verification 正本的完整 `S-30..S-39`、真实消费者矩阵、
   alpha/financial 边界和明确不做项；其中 `S-38` 必须逐项核对 SECONDARY 回 `customer-welcome`、
   后续确认不登记、store 无年龄残留三条 oracle；
2. 详设 §4–§13c 与本 plan 的每个 CP/stop/red/evidence 条目；
3. 六维 memory route 的全部命中，至少包括 terminal architecture/stack、frontend/input
   coding、source reread、independent review、focus/performance pitfalls。

逐条记录 `需求条目 → 详设条款 → 代码/证据锚点 → 规范条款 → MATCHED/OPEN`，由 fresh
独立子 agent 作出最终 `MATCHED/OPEN`。这不是把
各 CP 的记录拼接起来；要重新检查跨 CP 的事实是否出现两份 owner、两个尺寸真相或相反恢复序列。

### 8.2 全批停止条件

任一维度缺失、任一 `OPEN`、任何 source/test/运行证据档位混称、任何未授权运行或任何
“全仓/唯一/零”没有先搜索计数，都不得进入 CP-6。

## 9. CP-6：逐代码与详设对账（交付前置门）

这是实施计划中的独立步骤，不是收尾备注，也不是 §8 三维对账的别名。

### 9.1 范围

范围是本详设逐条列出的全部可实施锚点，不抽样：

| 代码/文档集合 | 逐项对象                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| input         | `InputSurfaceFrame`、`InputProvider`、`VirtualKeyboard`、`keyboardLayout`、`keyboardHeight`、`useInputField`、`InputScrollArea`、snapshot、types/index、README/invariants、所有受影响 focused tests |
| render        | `SurfaceRoot.renderContentFrame`、`LayerStack`、`SurfaceFocusBoundaryContext` 的相关消费点                                                                                                          |
| primitives    | `PrimitiveInput`/`PrimitiveButton`/`PrimitiveScrollView` 的既有语义与 automation path；仅核对详设批准的 `PrimitiveButton` key variant 呈现加法                                                      |
| sample        | `MemberForm` probe declarations/cleanup/submit reads、`CustomerMember` age path、assembly render frame                                                                                              |
| dev-host      | `SurfaceCanvas`/`surfacePreview.ts` canvas onLayout、fixed logical stage、shared host scale、surface boxes                                                                                          |
| Android       | existing `imeInset` bridge only；方向、topology、device effective count 不在本批改动                                                                                                                |
| evidence      | tests/readme/invariant/plan/design sync entries and future run records                                                                                                                              |

### 9.2 执行者与记录格式

主 agent 对每个唯一 symbol anchor 做以下动作：

1. 打开详设对应条款和原 requirements 条目；
2. 打开当前代码/测试/配置的实际变更行；
3. 观察行为或最小可证伪测试，避免以调用计数、prop 值、mock callback 或 transform 前逻辑尺寸代替行为证据；
4. 在记录中写 `path#unique-symbol-anchor | design clause | code observation | evidence path | MATCHED/OPEN`。

fresh 独立子 agent 只读核验该记录和源码，不能改文件、不能代写、不能把作者自判当 verdict。
记录结论只有 `MATCHED` 或 `OPEN`，不使用“基本一致”“部分通过”“预期通过”。

### 9.3 交付门

只有当所有行都是 `MATCHED` 且 fresh 独立复核没有未处置 finding，才允许生成交付 brief，
其中写 `CODE_TO_DESIGN_RECONCILIATION=MATCHED`。任一 `OPEN` 未闭时只能报：

```text
IMPLEMENTATION_NOT_READY=OPEN
DELIVERY_TO_DEXTER_AND_CLAUDE=BLOCKED
```

不得声称“已交付实施 review”。代码↔详设记录必须随未来交付物一并提供，且不被三维对账
替代。当前实现阶段在 CP-6 尚未完成前不能生成 PASS；不得把作者自判或未运行的动态证据伪造成对账记录。

## 10. 新鲜独立对抗审查纪律

详设与计划写完后，主 agent 必须派 fresh 独立子 agent 做盲审。子 agent 最小输入清单：

- 两份最新 v2 requirements，以及它们仍引用的判据正本
  `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`
  与 `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md`；
- 本详设与本 plan；
- `SurfaceRoot`/`LayerStack`/`SurfaceFocusBoundaryContext`；
- input 的 Frame/Provider/Keyboard/height/snapshot/scroll/edit 类型与测试；
- sample `MemberForm`/`CustomerMember`/assembly；
- dev-host `SurfaceCanvas`；
- existing Android `imeInset` source only；不审 input 之外的方向、topology 或 device policy；
- implementation-design、IA 与 implementation-task templates；
- 相关 project-memory：deterministic context、terminal architecture/stack、source reread、
  independent review、input focus/performance pitfalls。

盲审 prompt 必须要求：先以“证明它为什么不成立”为立场；只读不改文件；逐项检查两条 S、
六项详设留白、CP stop/red/evidence、公共面、sample-only、逐代码门；输出
`CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE`。
元数据必须写 `REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_DESIGN_2026-09-06`、
`REVIEW_ROUND=1|2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`。

发现 finding 后，主 agent 必须重开 owning source、主动找反例并修正文档；同一 review cycle
最多两轮，第二轮仍有未决产品/权限事项直接交 Dexter，不得召集第三轮。Claude 后续 review
不替代该 fresh 独立审查。

## 11. 逐代码影响面清单（未来实施时不得缩成“相关文件”）

| 影响面                | 具体路径/锚点                                                                              | 计划动作                                                        | 证据                                        |
| --------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------- |
| input frame           | `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx#InputSurfaceFrame`       | onLayout、本地 metrics、content/dock siblings、删除 surfaceSize | focused/typecheck                           |
| input provider        | `.../src/components/InputProvider.tsx#InputProvider`                                       | capacity、owner preflight/commit、Layer boundary、viewport      | provider/focus tests                        |
| keyboard model        | `.../src/model/keyboardHeight.ts#calculateVirtualKeyboardMetrics`; `.../keyboardLayout.ts` | exact constants/formula、four rows definitions                  | geometry/layout tests                       |
| keyboard renderer     | `.../src/components/VirtualKeyboard.tsx#VirtualKeyboard`                                   | rows/zones/testIDs/actual key widths                            | render/hit tests                            |
| field hook            | `.../src/hooks/useInputField.ts#useInputField`                                             | onPressIn/onFocus/onBlur/scroll effect                          | real focus tests                            |
| scroll                | `.../src/components/InputScrollArea.tsx#InputScrollArea`                                   | no ancestor no-op、shrunk viewport、no double subtraction       | scroll tests                                |
| public face           | `.../src/index.ts`; `terminal-invariants.json`; `README.md`                                | delete InputSurfaceSize/surfaceSize; document local measure     | invariant/typecheck/static                  |
| assembly              | `apps/terminal/ui/integration/sample-console/src/assembly.tsx#SurfaceInputFrame`           | imeInset only; no static dimension bridge                       | typecheck/static                            |
| Web host              | `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx#SurfaceCanvas`; `src/surfacePreview.ts#calculateSurfacePreviewGeometry` | fixed logical boxes; one host preview scale; no input scale bridge | focused/typecheck/browser when authorized |
| sample member         | `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx#MemberForm`     | alpha/financial probe + cleanup and fixed submit reads          | focused/static                              |
| Android platform fact | existing adapter/assembly `imeInset` bridge                                                | consume only; no carrier/orientation/topology change            | static/typecheck; platform runtime separate |

## 12. 交付内容与口径

未来实施完成后交付：各 CP focused/typecheck/static/authorized runtime evidence；first failure、
last known good、broken boundary；阶段和整体三维对账；单独的 `逐代码与详设对账` 记录；
fresh 独立审查 verdict；模型红向量与真实树结果分列；Android 模拟器覆盖声明与真实 POS
未覆盖边界；以及给 Dexter/Claude 的中文 review brief。

不得在未获新授权前运行或报告 Android/Web。不得把“详设与计划 review GO”写成“实现 GO”。
