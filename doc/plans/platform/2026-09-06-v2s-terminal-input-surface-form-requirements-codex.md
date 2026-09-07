# TER Terminal 输入承载形态需求

> STATUS: DRAFT_FOR_REQUIREMENTS_REVIEW
> IMPLEMENTATION_AUTHORITY: false
> REVIEW_TARGET: REQUIREMENTS
> SCOPE: 横屏与竖屏的产品形态、surface 拓扑、输入 surface 自测量边界
> DEPENDENCY: 本文通过后，才能冻结键盘视觉重构需求 v2；本文不授权详设或实施

## 1. 目的与裁定范围

本文件解决的是输入组件所处的产品形态问题，不是键帽视觉问题。
当前输入链路把固定横屏的静态 terminalSurfaces 尺寸一路传进 input 包，导致
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

以下事实来自当前源码与配置，不是模型测试推断：

| 事实 | 当前证据 |
| --- | --- |
| Expo app 配置固定横屏 | apps/terminal/assembly/android/sample-terminal/app.json 第 2 至 7 行，orientation 为 landscape |
| Android activity 固定横屏 | apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml 第 18 至 20 行，含 screenOrientation=landscape |
| Web surface 只有横屏静态基线 | apps/terminal/ui/integration/sample-console/package.json 第 10 至 21 行，PRIMARY 为 1157 × 723，SECONDARY 为 962 × 541 |
| assembly 把静态尺寸送入 input | apps/terminal/ui/integration/sample-console/src/assembly.tsx 第 44 至 70 行与第 153 至 163 行 |
| input frame 当前没有自己测量 | apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx 第 7 至 18 行只接收 surfaceSize，并把其 height 传给键盘 |
| Web host 使用静态逻辑画布与 transform 缩放 | apps/terminal/ui/base/dev-host/src/testExpoApp.tsx 第 84 至 163 行 |
| 当前 Presentation 会施加沉浸式窗口标志 | apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt 第 389 至 405 行 |

### 2.2 这些事实不应继续被解释成产品要求

1157 × 723 与 962 × 541 是当前验收基线，不是 input 的运行时布局输入。
它们可以继续用于 Web 目标尺寸的回归截图与容量测试，但不能继续由
sample-console assembly 作为 surfaceSize 传给 input。

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

### 3.3 方向与窗口行为

产品必须撤销对横屏的硬锁：

- Expo app 配置不得继续把 orientation 固定为 landscape；
- Android activity manifest 不得继续把 screenOrientation 固定为 landscape；
- 具体采用平台默认方向、允许配置或等价配置由详设核对，但结果必须允许真实
  竖屏运行；
- 不能通过额外的 runtime 方向嗅探把 input 组件重新绑定到设备型号。

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

sample-console 的 PRIMARY 1157 × 723 与 SECONDARY 962 × 541 继续保留为：

- Web 视觉回归与截图的目标基线；
- 横屏双屏容量验收的 fixture；
- 说明当前产品目标硬件比例的文档数据。

它们不再是 InputProvider、InputSurfaceFrame 或 VirtualKeyboard 的运行时输入。
键盘需求文档必须把“验收基线”和“布局输入”分开写。

### 5.2 Web 缩放边界

本轮只接受一条可执行路径：交互式 input frame 必须直接占据最终响应式盒子，
其 `onLayout` 的 width/height 必须等于实际 pointer 命中区域的布局尺寸。任何会
改变布局盒子与 pointer 命中盒子关系的 `scaleToFit` 或 ancestor `transform` 都不得
包裹 `InputSurfaceFrame`；不能用 transform 前的逻辑 width/height 宣称 48 的物理
hit target 已满足。

Web host 如果仍需保留固定逻辑画布，只能用于不承载交互输入的静态外壳。输入交互
子树必须放在无缩放的响应式容器中，不能新增“把缩放后的有效盒子反映回来”的第二套
物理尺寸桥接契约。具体 DOM/View 树调整属于详设，但验收唯一看 input frame 实际
布局盒子与实际 pointer 命中区域是否一致。

可证伪红向量：在交互 `InputSurfaceFrame` 外恢复 ancestor transform，并继续把
1157 × 723 或 962 × 541 作为几何输入，FORM-R5 必须失败；若测试只能读取 transform
前的逻辑尺寸而不能观察实际命中区域，也不得判定通过。

### 5.3 Android surface 边界

横屏双屏继续由现有 single ReactHost/multiple ReactSurface carrier 提供两个
surface。竖屏不创建第二 surface。input 包不读取 display index，不判断是否为
Presentation，也不承担 DisplayManager、IME policy 或沉浸式 window flags。

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
6. terminalSurfaces 的 package.json 声明如继续存在，只能作为宿主/验收基线，不能
   通过公共 input props 形成第二个尺寸真相源。

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
| FORM-R1 | 把 landscape orientation 与 screenOrientation 恢复 | 竖屏产品形态无法启动，FORM-3 失败 |
| FORM-R2 | 让 assembly 把 package.json 尺寸重新传给 InputSurfaceFrame | 静态尺寸输入门失败 |
| FORM-R3 | 用 Dimensions.get('window') 替代 frame onLayout | Presentation/不同 surface 的局部尺寸判据失败 |
| FORM-R4 | 在首帧用 1157 × 723 作为默认尺寸 | 首帧不渲染键盘判据失败 |
| FORM-R5 | 让 Web transform 前的尺寸通过验收 | 实际命中区域与 hit target 分离，Web 边界失败 |
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
