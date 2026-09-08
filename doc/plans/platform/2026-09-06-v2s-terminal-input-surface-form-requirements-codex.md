# TER Terminal 输入承载形态需求

> STATUS: DRAFT_FOR_REQUIREMENTS_REVIEW
> IMPLEMENTATION_AUTHORITY: false
> REVIEW_TARGET: REQUIREMENTS
> SCOPE: 横屏与竖屏的产品形态、surface 拓扑、输入 surface 自测量边界
> DEPENDENCY: 本文通过后，才能冻结键盘视觉重构需求 v2；本文不授权详设或实施

## 0.1 2026-09-07 Web 预览宿主缩放增补（已被 2026-09-08 裁定 supersede）

本节只保留为历史变更记录。其“Web 统一等比缩放、Android 产品承载不使用 transform、
声明只是验收基线”的解释，已被 2026-09-08 Dexter 裁定的固定逻辑画布方案取代；当前有效
语义见下方 0.2 与 §5.1-§5.3。

## 0.2 2026-09-08 固定逻辑画布裁定（当前有效）

每个横屏 surface 的声明是承载层的固定逻辑画布输入：PRIMARY 为 1280 × 800，SECONDARY
为 960 × 540；两者比例不同，不互相转置或强行统一。sample Android 副屏的 1280 × 720
是 physical display 配置，不是逻辑画布声明。承载层把固定画布映射到各自实际
显示区域，input 只在画布逻辑坐标中工作，不能读取 scale、Dimensions、Platform 或物理
屏幕事实。

Android 由 carrier/host 使用稳定的 display/window 承载事实计算 scaleX 与 scaleY，并以
非等比缩放铺满实际 content rect；不得以 transform 替代目标 display density 修正。Web
dev-host 采用 `width-fill-preserve-ratio`：以 preview content rect 的宽度除以 logical stage
宽度得到唯一 uniform scale，宽度铺满、比例保持；高度不参与 scale，超高由可滚动内容区承载，
不得使用 uniform contain 或 browser 非等比拉伸。`InputSurfaceFrame` 不得自行引入 transform
或建立第二套物理尺寸桥；Web 真实命中必须在 transform 后用 DOM rect 与 elementFromPoint
观察，Android 必须用真实 tap 观察。

## 0.3 2026-09-08 横屏范围 supersede（当前有效）

本轮只交付横屏固定画布。竖屏 target hardware profile、解除方向锁定、PRIMARY-only 真机拓扑
与竖屏键盘验收全部保持 OPEN：不得新增或修改 portrait declaration，不得修改 sample-terminal 的
`AndroidManifest.xml` landscape 锁定或 `app.json` landscape 默认，也不得用横屏证据声称竖屏
已支持。本节 supersede 本文 §3.3 与 FORM-R1 中“本轮必须撤销 landscape 锁定”的旧要求；未来
竖屏支持必须以真实硬件 profile 与 Dexter 的单独范围授权重新开启。

## 1. 目的与裁定范围

本文件解决的是输入组件所处的产品形态问题，不是键帽视觉问题。
需求冻结时的输入链路把固定横屏的静态 terminalSurfaces 尺寸一路传进 input 包，导致
input 看到的是编译期声明而不是它实际占据的 View。这个前提在双屏
Presentation、Web 缩放、窗口变窄和竖屏手持形态下都不成立。

本文件冻结三件事：

1. 产品同时支持笔记本/终端横屏和手持 POS 竖屏；
2. 竖屏永远是单 surface 的 handheld-confirm 形态；
3. input 包只使用承载它的 InputSurfaceFrame 自己测得的最终宽高，不能依赖
   外部 surface 配置或应用级窗口尺寸。

本文件不实现 input，不修改业务 Journey，不决定具体键帽 token、动画或 Android
生命周期代码。键盘排版、行列与 hit target 的需求在
2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md。

## 2. 问题证据与事实边界

### 2.1 已核实的仓内事实

以下是需求冻结时的初始源码/配置事实，不是模型测试推断；其中标为实施前的条目不再描述
当前实现：

| 事实 | 当前证据 |
| --- | --- |
| Expo app 配置固定横屏 | apps/terminal/assembly/android/sample-terminal/app.json 第 2 至 7 行，orientation 为 landscape |
| Android activity 固定横屏 | apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml 第 18 至 20 行，含 screenOrientation=landscape |
| Web surface 在 CP-1 前含旧 shape | apps/terminal/ui/integration/sample-console/package.json 第 10 至 21 行；1157 × 723、962 × 541 是实施前待退役源码事实，不是当前有效基线；当前 shape 由 `src/application/terminalSurfaces.ts` 解析 |
| assembly 在 CP-1 前把静态尺寸送入 input | `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` 第 42 至 115 行记录当前 host declaration 与本地 frame seam；实施前的旧静态 props 桥已删除 |
| input frame 在 CP-1/CP-2 前没有自己测量 | `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx` 第 23 至 65 行现在由自己的 `onLayout` 产生 local frame metrics，并将其交给 keyboard 计算 |
| Web host 在 CP-5 前使用静态逻辑画布与预览几何 | `apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx` 第 1 至 339 行；当前仍保留固定 canvas 与待裁决的 preview policy，但 preview viewport 已由内部无 border 节点测量 |
| 当前 Presentation 会施加沉浸式窗口标志 | apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt 第 389 至 405 行 |

### 2.2 这些事实不应继续被解释成产品要求

1157 × 723 与 962 × 541 已退役，不是验收基线、硬件 profile 或运行时布局输入；它们只作为
CP-0A 要清除的旧材料证据出现。当前横屏固定逻辑画布是 PRIMARY 1280 × 800、SECONDARY
960 × 540；sample Android 副屏的 1280 × 720 只作为 physical display 配置记录，声明进入 host 承载层作为画布输入，但不能由 sample-console assembly 直接
作为 `surfaceSize` 传给 input。

AndroidManifest 的 adjustResize 也是声明事实，不足以证明沉浸式 edge-to-edge
窗口已经提供了可依赖的收缩行为。输入组件的收缩、IME inset 和自绘键盘尺寸必须
分别由各自 owner 的实际测量或平台事实提供。

现有 Presentation 的沉浸式 flags 不等于 true Kiosk 或 Lock Task。本文不把
沉浸式窗口包装成设备级锁定能力。

## 3. 产品形态矩阵

### 3.1 横屏

横屏是 laptop/终端的业务形态，可有一个或两个 surface：

| 条件 | PRIMARY | SECONDARY | 业务形态 |
| --- | --- | --- | --- |
| 没有第二显示 | 存在 | 不存在 | 单屏业务流；需要顾客确认时使用既有 handheld-confirm 语义 |
| 有第二显示 | 存在 | 存在 | 双屏业务流；PRIMARY 与 SECONDARY 各自拥有自己的 surface root |

双屏时 SECONDARY 是真实承载输入控件的 surface。顾客年龄字段仍使用虚拟数字
键盘并留在 SECONDARY；不因此开启或宣称副屏系统 IME。

### 3.2 竖屏

竖屏是手持 POS 的真实产品形态，不是“窗口拖窄后不崩”的附带测试形态。

竖屏必须满足：

- 只有 PRIMARY 一个 surface；
- 不创建 SECONDARY Presentation，不渲染 SECONDARY root，也不把 SECONDARY
  作为“存在但隐藏”的列保留在业务交互树中；
- 需要顾客确认时使用既有 handheld-confirm 形态；
- 虚拟键盘属于 PRIMARY 上承载输入控件的 frame；
- 顾客年龄仍可为空，确认、拒绝和交还店员动作必须有可操作路径；
- input 包不得因为竖屏而新增屏数分支或业务字段分支。

竖屏与横屏的差异由 assembly/宿主的 surface 拓扑负责。ui/base/input 只知道
自己所在 frame 的本地测量结果，不知道 PRIMARY、SECONDARY 或 handheld-confirm
这些业务概念。

### 3.3 方向与窗口行为（本轮横屏范围）

本轮保留横屏硬锁：

- Expo app 配置继续保持 orientation=landscape；
- Android activity manifest 继续保持 screenOrientation=landscape；
- 不增加 runtime 方向嗅探，不把 input 组件重新绑定到设备型号；
- 竖屏运行不属于本轮验收，见 §0.3 的 OPEN 边界。

沉浸式全屏在横屏和竖屏都保留。本文采用既有 A 档沉浸式边界：应用隐藏系统
状态栏/导航栏并占据自己的窗口，不引入 true Kiosk、Lock Task、设备策略或
厂商级锁屏。若未来需要设备级锁定，必须另立产品需求和安全/设备管理裁定，不得
借竖屏支持顺手引入。

### 3.4 方向判定

InputSurfaceFrame 的本地测量值定义方向：

- width >= height：landscape；
- width < height：portrait；
- square 按 landscape 处理，保证边界确定且不依赖设备类别。

这个方向只用于 input 内部选择几何变体；它不是业务模式，不得传入或暴露为
feature 的 screen-count 分支。

### 3.5 宿主拓扑 owner 与竖屏副屏抑制

竖屏只有 PRIMARY 的决定由 Android 宿主/adapter 持有，不由 input、feature 或
assembly 推导。宿主在创建主屏 delegate、调用 `ensureSecondarySurface` 之前，必须
在同一次 Activity 生命周期节点读取 PRIMARY Activity 当前的
`resources.configuration.orientation`（或详设核实后的等价当前 Activity 配置 API），
并与同一节点取得的 display snapshot 一起决定拓扑：

- `PORTRAIT` 时，拓扑固定为 `PRIMARY_ONLY`，不得调用
  `ensureSecondarySurface`，不得创建 Presentation 或 SECONDARY ReactSurface；
- `LANDSCAPE` 时，才允许按当前 display snapshot 创建 SECONDARY；是否实际存在
  副屏仍由该 snapshot 决定；
- 这个 host-level 判断发生在 `onDidCreateReactActivityDelegate` 的副屏创建分支
  之前，不能等 input frame 测量后再补救；input 的本地 width/height 方向只决定
  键盘几何，不得反向决定 surface 拓扑。

方向或配置发生变化时，宿主必须重新计算拓扑。切入竖屏时，若 SECONDARY 已存在，
必须按既有 stop → detach → clear 的顺序收尾后再进入 `PRIMARY_ONLY`；切回横屏且
仍有可用副屏时，才允许重新创建 SECONDARY。具体 Android 生命周期接缝和调用方式
属于详设，但“竖屏不创建/切换时不残留副屏”的 owner、时点和不变量在此需求层
固定。

可证伪红向量：把 handler 改成只要发现非默认 display 就在竖屏调用
`ensureSecondarySurface`，FORM-3 必须失败；把 host-level 判断下沉到 input 并让
input 的方向值决定 Presentation 创建，也必须失败。两条都证明宿主拓扑边界被破坏，
不允许用“创建后 hidden”作为兼容。

## 4. surface 尺寸的唯一来源

### 4.1 本地 View 测量

每一个 InputSurfaceFrame 必须在自己的根 View 上通过 onLayout 获得最终布局后的
width 与 height。这个 View 必须是实际接收 pointer/press 的输入承载树的一部分，
不能测量一个未参与交互的外壳。

Input 的运行时尺寸事实定义为：

| 字段 | 语义 |
| --- | --- |
| width | 当前 surface frame 实际可用的布局宽度 |
| height | 当前 surface frame 实际可用的布局高度 |
| ready | width 与 height 都为有限正数 |
| orientation | 由本地 width/height 比较得出 |

主屏、Presentation 副屏、Web 容器、窗口缩放和旋转都必须分别产生自己的测量
结果。任何 surface 不得读取另一个 surface 的尺寸。

### 4.2 明确禁止的尺寸来源

input 几何与可见性不得由以下来源决定：

- Dimensions.get('window')；
- useWindowDimensions；
- window.innerWidth、window.innerHeight 或 typeof window；
- Platform.OS、设备型号、用户代理或屏幕类别；
- sample-console package.json 的 terminalSurfaces；
- assembly 传入的静态 surfaceSize；
- 另一个 surface 的测量结果；
- 编译期常量加 scaleToFit 推导出的“逻辑尺寸”。

这些 API 可以被宿主用于非 input 的浏览器外壳布局，但不能成为键盘尺寸、行列、
方向或 hit target 的输入。

### 4.3 未测量初始态

第一次 onLayout 之前没有可信尺寸。此时必须：

- 渲染输入内容区，但不渲染虚拟键盘 dock；
- 不猜一个默认宽高先画键盘再跳变；
- 不把未测量状态宣布为 visible；
- 虚拟字段不得进入“已经获焦但没有键盘也没有继续路径”的死状态；
- 用户在首帧前触发虚拟字段时，必须延迟或拒绝虚拟键盘焦点承诺，待首次有效
  测量后重新评估；现有字段值、可选/必填语义与决策动作不能因此改变。

系统键盘的 inset 仍由平台 adapter 提供；没有 imeInset 不能伪造系统 IME 的
可用尺寸。imeInset 是平台事实，不因 input 自测量而删除或改为全局推导。

### 4.4 尺寸变化

同一个 frame 的 onLayout 后续变化必须以最新本地测量为准，重新计算：

- orientation；
- full/numeric 的几何变体；
- keyboard dock 的高度与可行性；
- 内容区是否仍达到最小可用高度；
- 当前 virtual owner 是否仍能安全显示。

旧测量结果不能跨 surface 复用，也不能在旋转、Web resize 或 Presentation 重新
布局后继续作为键盘输入。尺寸暂时变成无效值时，回到未测量态：不渲染虚拟键盘，
不凭旧尺寸继续画一版。

## 5. 宿主与 Web 基线

### 5.1 静态基线的保留范围

旧的 1157 × 723 与 962 × 541 不再保留为任何基线；它们只能在 CP-0A 记录为已 supersede
的历史材料。当前横屏固定逻辑画布为：PRIMARY 1280 × 800（目标 16:10），SECONDARY
960 × 540（目标 16:9）；sample Android 副屏的 1280 × 720 是 physical display 配置，不是画布声明。画布声明是 host 承载层的运行时输入，host 负责把画布映射到
实际 content rect；`InputSurfaceFrame` 仍只接受自己的 onLayout，不接收静态声明尺寸。

### 5.2 Web 缩放边界

input frame 的 `onLayout` 仍必须来自它自己实际占据的逻辑 frame；input 不读取 host
scale，也不把 transform 前逻辑 width/height 作为 Web 物理 hit target 证明。固定逻辑
画布由 host 承载层创建并映射到实际 content rect；任何 transform 只属于 host，不是
input 包的几何机制，也不得新增“把缩放后的有效盒子反映回来”的第二套物理尺寸桥接契约。

Android 允许在 surface host 上使用 scaleX/scaleY 非等比铺满实际 content rect，同时继续
使用目标 `Presentation` display 的 metrics/density 修正 ReactSurface context；transform
不能替代 density。Web 的缩放 policy 固定为 `width-fill-preserve-ratio`：以 preview content rect
宽度除以 logical stage 宽度得到唯一 uniform scale，宽度铺满、比例保持；高度不参与缩放，超高
由可滚动内容区承载。两端统一的是固定逻辑画布与逻辑坐标，不是把 Android density 伪装成 Web 单位。

具体 DOM/View 树调整属于详设；Web 验收必须同时看 input frame 的 local layout、真实
DOM rect 和 `elementFromPoint` 命中。可证伪红向量：在 `SurfaceCanvas` 删除唯一 host
stage scale 后 S-26 的 resize/比例判据必须失败；在 `InputSurfaceFrame` 内引入自有
transform、读取 host scale 或用 transform 前尺寸冒充 Web/Android hit target 时，
FORM-R5 必须失败。

### 5.3 Android surface 边界

横屏双屏继续由现有 single ReactHost/multiple ReactSurface carrier 提供两个
surface。竖屏不创建第二 surface。input 包不读取 display index，不判断是否为
Presentation，也不承担 DisplayManager、IME policy 或沉浸式 window flags。

Android carrier 负责按目标 display 的 metrics/density 配置副屏 `ReactSurface` context，
同时由承载层把固定逻辑画布映射到 owner window 的实际 content rect；不得复制主 Activity
的 density，也不得把 raw display pixels 直接当作画布声明。目标 display 的 density 修正与
画布的 scaleX/scaleY 是两个独立步骤，均属于 carrier/host，不进入 input、assembly 或业务
组件，也不改变 Presentation 拓扑、方向策略或 IME 策略。

副屏系统 IME 的既有产品决定保持不变：副屏只支持虚拟键盘；本文件不新增 adb、
权限或设备配置步骤。

## 6. 公共面与 assembly 影响

本文通过后，详设与实施必须处理以下公共面收敛：

1. InputProvider 不再接受 surfaceSize；
2. InputSurfaceFrame 不再接受 surfaceSize；
3. InputSurfaceSize 不再从 input 公共 index 导出，内部测量类型不得成为公共
   契约；
4. sample-console assembly 不再从 terminalSurfaces 取尺寸并穿给 InputSurfaceFrame；
5. input 的公共面保留 imeInset，因为它来自 adapter 能知道的平台事实；
6. terminalSurfaces 的 package.json 声明是 host 固定逻辑画布的输入；它不能通过公共
   input props 形成第二个尺寸真相源，InputSurfaceFrame 仍只使用自己的 onLayout。

实现前必须重新搜索 InputSurfaceSize、surfaceSize 与 terminalSurfaces 的消费者；
若发现本文未列出的真实消费者，先按影响面修订详设，不得用兼容 prop 偷渡旧模型。

## 7. 验收矩阵

| ID | 形态 | topology | 必验结果 |
| --- | --- | --- | --- |
| FORM-1 | 横屏单屏 | PRIMARY only | 内容与虚拟键盘使用 PRIMARY frame 的本地测量 |
| FORM-2 | 横屏双屏 | PRIMARY + SECONDARY | 两个 frame 各自测量；顾客年龄键盘只出现在 SECONDARY |
| FORM-3 | 竖屏 | PRIMARY only | 不创建 SECONDARY；customer-member 使用 handheld-confirm |
| FORM-4 | Web resize | 一个响应式 frame | resize 后方向、几何与可见性重新由本地测量决定 |
| FORM-5 | 首帧未测量 | 任一 surface | 内容可见、键盘不渲染、不猜尺寸、不出现死焦点 |

FORM-1 至 FORM-5 必须分别检查 input 的几何输入、surface 拓扑和用户可继续路径。
不能用一张横屏 Web 截图替代竖屏或副屏证据。

## 8. 可证伪红向量

以下 mutation 变绿时，形态需求没有真正落地：

| 红向量 | 变异 | 必须失败的结果 |
| --- | --- | --- |
| FORM-R1（本轮 superseded） | 删除 landscape orientation 或 screenOrientation 锁定以伪造竖屏支持 | 本轮范围漂移；不得以此替代未来竖屏 profile、拓扑与真机验收 |
| FORM-R2 | 让 assembly 把 package.json 画布声明直接传给 InputSurfaceFrame，绕过 host 承载层 | 静态尺寸输入门失败 |
| FORM-R3 | 用 Dimensions.get('window') 替代 frame onLayout | Presentation/不同 surface 的局部尺寸判据失败 |
| FORM-R4 | 在首帧用固定画布声明或任意静态尺寸作为 InputSurfaceFrame 默认尺寸 | 首帧不渲染键盘判据失败 |
| FORM-R5 | 把 host transform 前尺寸当作物理命中证据，或让 input 自己引入 transform/宿主 scale，或用 transform 替代 Android 目标 display density | 实际 DOM/Android 命中区域与逻辑坐标分离，或目标 display 的 density 修正丢失，边界判据失败 |
| FORM-R6 | 在竖屏保留 SECONDARY 但只把它设为 hidden | 竖屏单 surface 拓扑判据失败 |

模型红向量只证明门能识别错误；真实树结果必须另行记录，不能把模型 FAIL
写成生产源码 FAIL。

## 9. 非目标与前置关系

本文件不授权：

- input 详设或源码实现；
- Android 方向锁改动、真实设备运行或 Android/Web UAT；
- true Kiosk、Lock Task、IME policy 或权限变更；
- 新的业务 screen、字段、command 或 feature 分支；
- 任何键帽视觉、颜色、字体或动画实现。

依赖顺序固定为：

1. 本形态需求通过需求 review；
2. 以本文的本地测量模型为输入，评审键盘视觉重构需求 v2；
3. 两份需求通过后，才进入详设，详设再决定 onLayout 接缝、容量公式与宿主改法；
4. 未通过前不得以当前静态横屏输入模型继续实现键盘视觉。

本文的核心判据不是“能否把窗口拖成竖长”，而是：
同一份 input 能在每个承载它的实际 frame 上独立知道自己的尺寸，并在横屏单屏、
横屏双屏和竖屏单屏中保持可用、可继续、可验证。
