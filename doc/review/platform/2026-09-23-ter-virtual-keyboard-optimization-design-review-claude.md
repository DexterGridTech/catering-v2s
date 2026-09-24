# TER 程序虚拟键盘优化 · 需求修订与设计全套独立评审（Claude）

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23（经 Dexter 中转的 Codex↔Claude review，不占 cycle 轮次）
VERDICT=NO-GO
M/S/N=0/4/4
```

```text
本 verdict 只针对下列当前字节，不沿用本人上轮 NO-GO 0/2/2，也不沿用独立子 agent 第 1 轮 NO-GO 1/1/1、第 2 轮 GO 0/0/1。
reviewTargetSha256（前 16 位）:
  formal-requirements    883ce7aa7834be4d
  ui-interaction-design  b7ea2089d9677352
  ia-design              eaa3ca0da2b449c1
  implementation-design  dac2cdb7ab119e27
  implementation-plan    4fed3ca49c1606d5
EVIDENCE_TIER=静态：设计文档 + 仓内 owning source + 仓内已安装的 react-native 0.86.3 / react-native-web 0.21.2 源码 + 独立算术；未运行任何构建、测试、Web、Metro、Android 或设备
SESSION=CONTINUED_SESSION（续接会话，从 v2s 仓根发起，不是 fresh acceptance）
WRITES=仅本文件
AUTHORITY=只评审需求修订、交互设计、IA、详设与实施计划；不授权实施、源码/测试修改或任何动态验证
```

下文"需求 / 交互 / IA / 详设 / 计划 第 N 行"分别指 `doc/plans/platform/` 下同日的
`2026-09-23-ter-virtual-keyboard-optimization-{formal-requirements,ui-interaction-design,ia-design,implementation-design,implementation-plan}-codex.md`。

## 1. 方案合理性

**问题对不对**：对。三处需求修订都命中上轮反例，没有借修订扩大范围。

**方案优不优**：整体形态——surface 底部唯一覆盖层、render 声明并按 surface 创建 presentation 值且由 input 独写、
旧键盘在上新键盘在下的两阶段交接——也是我独立推导会选的。我构造过两个替代：给整块 content 加 transform
(遮罩会跟着移动，第 1 轮 M-1 已正确否决);把 backdrop 移出 LayerStack(改动更大，还要重排 layer 层序)。
bridge 的依赖方向 input→render 与现状一致，render 只声明 `Animated.Value` 类型，不反向依赖。

**代价配不配**：有两处代价没有摆到 Dexter 面前：宽屏键帽被拉满(S-3)、full 第五行增高 23%(S-4)。另有两处多出来的
复杂度：保留零消费者的 `field` placement(N-3)、逐帧滚动插值(N-4)。

**UI 强制自问**
- 操作来源：点字段、Shift、URL 字符、空格、完成、外点收起都来自 Dexter 的 A–D 与 Q1–Q6,没有新 Journey。
- 此时这样操作是否合逻辑：交接期间手指落在键盘上会发生什么，没有定义(N-1)。
- 有没有更短、更自然的路径：一次性 Shift 让每个 URL 符号都要点两下；如果接受第五行，第五行放高频符号可以一下点到
  (S-4 候选 b)。
- 不合理之处的来源:S-3、S-4 都是设计自选的形态，不是后台、owner 或契约限制。真实的容量约束只有一条：mobile 360 宽下
  10 列恰好顶到最小键宽 30。

## 2. 核实成立（不用再动）

- **需求修订三处落地**：触发条件(需求第 14、66 行)、K 的定义(第 23、64 行)、方案 (b)(第 72 行)、焦点会话
  (第 42 行)、AC-05 三类样本(第 102 行)、AC-06 逐帧判据(第 103 行);N-2 维持原口径(第 90 行)。上轮三个反例在修订后
  都不再成立。
- **presentation bridge 的源码前提属实**:`SurfaceRoot` 把 children、`ScreenContainer`、`LayerStack` 放在同一个 View
  (`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:100-106`);`LayerStack` 根为 absolute、
  zIndex/elevation 1000(`LayerStack.tsx:33-40`),backdrop 与各 layer 是并列子节点；管理员控制台经
  `openLayerCommand` 以 layer 打开(`apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx:133-141`),所以
  PIN 所在的登录面会被"每个 layer 内层平移"覆盖到；`AdminLauncher` 包在 content 外层，自身不平移，手势坐标不受影响。
- **PIN 锚点前提属实**:`PrimitivePinInput` 用一个 `RnrPressable` 承载六格(`PrimitivePinInput.tsx:31`);`RnrPressable`
  目前不是 forwardRef(`apps/terminal/ui/base/primitives/src/vendor/slots.tsx:75`);`useAdminLogin.ts:38` 为 `nativeLess`。
- **9 个生产字段与两套 integration**:`useInputField` 恰好 9 处调用(staff-auth 2、member-form 4、customer-member 1、
  admin PIN 1、拓扑主机地址 1)。sample-console 含 member-desk、staff-auth、admin-shell;wallpaper-console 含
  staff-auth、wallpaper-picker、admin-shell,wallpaper-picker 没有输入字段。`field` placement 仓内唯一使用处是
  `apps/terminal/ui/base/input/test/provider.test.tsx`。
- **十二个 URL 字符**：交互第 73 行、IA 第 52-65 行、详设第 122-135 行三处逐字一致；零插入不消耗 Shift、full 的 `.`
  不套 financial 的 `·` 标签(详设第 50 行)都已写明。
- **高度与容量独立复算**:full 五行 5×48+4×8+28+2=302、compact 5×38+4×5+20+2=232;alpha 190/146;numeric/financial
  246/189。两套 integration 声明的 surface 为 laptop 1280×800(PRIMARY/SECONDARY)、mobile 360×640:
  302≤min(320,400),232≤min(320,320),都受支持。360 宽 compact 10 列 cell=floor((360−20−36)/10)=30,恰好等于最小键宽。
- **计划含"逐代码与详设对账"强制门**(计划第 46-50 行),格式固定，结果只有 MATCHED/OPEN。

## 3. Findings

### S-1 · "升高"型交接(如 190→246)按详设的内容路径，会逐帧越过 K(t) · CONFIRMED · 需 Dexter 裁决：否

**正本**：详设第 74、76 行规定新键盘从"不可见底侧"出发，在 Phase 1 于旧键盘下层升满；第 78 行规定
"`K_B≥K_A` 时，在 Phase 1 将 offset 线性插值到 `offset_B`",论证为"K 在对应 Phase 常量或线性，凸插值保证每帧
`|offset|≤K(t)`"。计划第 38 行的 CP-3 门按同一路径写。

**事实与推论**:Phase 1 里 `K(t)=max(K_A, v_B(t))`。新键盘从底部升起，上沿越过旧键盘上沿之前，K(t) 一直停在 K_A,
之后才升到 K_B——先平台、后上升，不是线性。线性插值的内容却从第一帧就开始上移。

**反例**:laptop 上 alpha 字段饱和在 −190,focus-next 到 financial 字段，目标 −246(会员表单里 alpha 探针的下一个字段
就是 financial 探针)。Phase 1 进度为 s(新键盘与内容共用同一缓动):|offset|=190+56s,K(s)=max(190, 246s)。
s=0.5 时 |offset|=218、K=190,超出 28;s≈0.77 时超出最多，约 43 个逻辑单位；除两个端点外全程超出。mobile compact
上 146→189 最多超出约 33;full 改五行后，在电话字段点回姓名是 246→302,最多超出约 46。超出的部分就是内容底边和
键盘上沿之间露出的缝，正是需求第 72 行"不得让新旧键盘相互掏空可见遮挡"与交互第 93 行"不留露底缝"要禁止的。

**同根**:K_B<K_A 时 Phase 2 的 `K(t)=max(v_A(t), K_B)` 是先下降后平台。第 78 行"与 K(t) 同进度插值"如果被实现成
按时间进度，那么 246→190、o_A=−246、o_B=−100 时，在 K 刚降到 190 的那一帧 |offset|≈213,同样越界。只有按 K 的
进度插值才成立。

**影响**：方案 (b) 的核心算法在三种点名交接之一上违反它自己的不变量，两轮独立审查都判为"设计已闭合"。计划的 CP-3
门如果只用未饱和样本，会放过这个缺陷。

**最小修复**：在详设第 78 行二选一写死：(i)K_A≠K_B 时按 K 的进度参数化内容，λ(t)=(K(t)−K_A)/(K_B−K_A),
offset(t)=offset_A+(offset_B−offset_A)·λ(t),即新键盘冒出旧键盘上沿之前内容不动；(ii)新键盘起点放在 d_B=K_B−K_A
(上沿正好藏在旧键盘上沿之下),让 Phase 1 的 K(t) 真正线性，原来的凸插值论证才成立。同时修正"K 在对应 Phase 常量或
线性"这句论证。计划第 38 行的 CP-3 门补饱和端点样本(|o_A|=K_A、|o_B|=K_B)。只改测试不改算法的更小方案行不通：
实施时门会直接红，最后仍要回头改设计。

### S-2 · 测量契约与仓内安装的 RN / RNW 实际行为不符：普通字段会重复扣平移，PIN 公式混用单位 · CONFIRMED · 需 Dexter 裁决：否

**正本**：详设第 68 行规定普通字段"经 `measureLayout`"取框；第 70 行规定"`centerY_untranslated` 从实测可见框扣除
**当前一次** presentation translation 得到";第 116 行(以及计划第 30 行)规定 PIN 用 `measureInWindow` 计算
`PIN_windowY−surface_windowY−当前 presentationOffsetY`,w/h 用 PIN 的实测值。

**事实(外部事实，取自仓内已安装版本的源码)**
- react-native 0.86.3(`apps/terminal/assembly/android/sample-terminal/android/gradle.properties` 为
  `newArchEnabled=true`):`measureLayout` 以 `includeTransform = false` 计算
  (`apps/terminal/node_modules/react-native/ReactCommon/react/renderer/dom/DOM.cpp:573`);ScrollView 的内容偏移只在
  includeTransform 为真时累加(同目录 `core/LayoutableShadowNode.cpp:176-181`)。也就是说，`measureLayout` 既不含
  transform,也不含 ScrollView 滚动偏移。`measureInWindow` 以 `includeTransform = true, includeViewportOffset = true`
  计算(`DOM.cpp:539`)。
- react-native-web 0.21.2:`measureLayout` 沿 offsetTop 链累加并减去祖先的 scrollTop
  (`apps/terminal/node_modules/react-native-web/dist/exports/UIManager/index.js:12-24`),不含 CSS transform,含滚动偏移；
  `measureInWindow` 用 getBoundingClientRect(同文件第 81 行),含 transform。
- 仓内：`apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx:134` 对整个 canvas 施加
  `scaleX/scaleY = host/canvas`(`render/src/foundations/surfaceHost.ts:131`);`AdminLauncher.tsx:38-45` 为了自己的手势
  坐标，专门除以这个缩放。

**推论与反例**
1. 普通字段：`measureLayout` 本来就不含 presentation transform,测到的已经是未平移坐标，再"扣除当前一次"就是重复扣。
   键盘开着、内容已平移 −150 时从 A 切到 B,B 的 centerY 会多算 150(以为它更靠下),目标偏移随之多移——正是需求第
   71 行禁止的"从已平移的屏幕坐标再叠加一次旧 offset"。
2. 字段位于已滚动的 `InputScrollArea` 内、跨 ScrollView 测到 surface 根：Web 的结果含滚动偏移，Android 不含，同一份
   设计在两个平台上得出不同几何。
3. PIN:两次 `measureInWindow` 的差是缩放后的窗口单位，`presentationOffsetY` 却是 canvas 逻辑单位。只要 host 与声明的
   canvas 尺寸不同(缩放≠1),算出的 surface-local 框就按缩放比例错。此外，Fabric 的 `measureInWindow` 只反映 shadow
   tree 里的 transform:presentation 动画如果走 native driver,读数可能不含当前平移，"扣一次"又变成重复扣。详设没有指定
   动画驱动。

**影响**：键盘开着时切换字段，几乎每次都从已平移状态出发，偏差可达当前偏移量，最大就是 K(约 190–302)。focused 测试
如果用 mock 返回设计者假设的坐标，测不出这个问题，要到 Web/Android 动态阶段才会暴露。

**最小修复**：在详设 §4.1、§4.6 与 IA §1 统一一条测量契约：所有焦点框和滚动视口一律用 `measureLayout` 相对**不平移的
`InputSurfaceFrame` 根**测量。两个平台上它都不含 transform,结果直接就是 canvas 逻辑单位的未平移坐标，不再扣 presentation
偏移，也与 canvas 缩放、动画驱动都无关。`InputScrollArea` 内的字段沿用今天的做法，相对 scroll content 节点测量，再与
onScroll 回读的真实偏移、视口自身的 `measureLayout` 矩形合成，永远不跨 ScrollView 边界直接测到 surface 根。PIN 的
`InputVisibleAnchorHandle` 改为暴露 `measureLayout`(Pressable 的宿主视图支持)。继续用 `measureInWindow` 的"更小"方案
行不通：它必须同时除以 canvas 缩放、并锁定 JS 驱动，条件更多，也更容易错。

### S-3 · 宽屏上键帽被拉满：laptop 的数字键盘每颗键 412 宽，IA 没有画出来 · 需 Dexter 裁决：是

**正本**：详设第 47 行 cell=floor((W−2p−(n−1)g)/n),第 90 行 `W_render=W_surface`;IA 第 33-36 行要求 numeric/financial
"三列内按键填满"。需求第 32 行却写明"本要求不把每颗键拉成同一种宽度"——全宽只约束外框，并没有要求拉伸键帽。

**事实(独立复算，laptop 1280×800)**:full/alpha 每颗键 floor((1280−28−72)/10)=118 宽；numeric/financial 每颗键
floor((1280−28−16)/3)=412 宽，今天按 560 宽的 dock 渲染约为 172 宽。电话、年龄、管理员 PIN、拓扑主机地址在 laptop 上
都会变成一行三颗、横跨整屏的键。mobile 360 基本不变(numeric 每键 110,full 每键 30)。

**影响**:laptop 是两套 integration 的主 surface。数字键盘横跨 1280 宽，输一个号码，手要在整屏宽度上来回移动。IA 的 20 帧
没有给出任何 surface 下的实际键宽和行排布，Dexter 没法据文档做视觉审阅。

**候选(需 Dexter 定)**:(a)如现稿，全部拉满；(b)外框仍全宽直角，键区设上限并居中，例如 numeric/financial 的键区
不超过约 560、full/alpha 不超过约 820——外框贴边，不再是浮卡，只是键区不拉伸；(c)只给 numeric/financial 设上限，
full/alpha 仍拉满。我倾向 (c),其次 (b)。不论选哪个,IA 都要补齐 1280×800 与 360×640 下四种布局的实际键宽和行排布。

### S-4 · full 第五行只放 `@ #`:所有 full 输入的键盘增高约 23%,换来两个暂无生产消费者的符号 · 需 Dexter 裁决：是

**正本**：交互第 58-73 行，IA 第 21、29、64-67 行，详设第 90、172 行；交互第 107 行与 IA 第 67 行明确把第五行的占高与
可发现性交给本次审阅。

**事实**:
- 键盘高度：laptop 246→302(+56),mobile 189→232(+43),约 +23%。H=800 时可见带从 554 降到 498,H=640 时从 451 降到 408。
- 受影响的是全部三个 full 生产字段(工号、密码、姓名),它们都不需要 URL 符号；拓扑主机地址按 N-2 维持 financial。
- 第五行在 1280 宽上只有两颗键，其余位置空着;IA 没给出这两颗键在第五行的位置。
- 约束是真实的:mobile 360 宽下 10 列恰好顶到最小键宽 30,现有四行 40 个位置已全部占满，所以 compact 上要让 `@ #`
  常显，只能新开一行。做符号面也不行，因为它的入口键同样没有位置。

**候选(需 Dexter 定)**:
- (a)如现稿，第五行只放 `@ #`。
- (b)接受增高，但第五行放一排一下就能点到的 URL 常用符号(如 `@ # . / : - _`)。它们与 Shift 层重复但不冲突，需求第
  48 行允许"额外键"。这样增加的高度换来的是 URL/邮箱输入少点将近一半的键。
- (c)按宽度分两种 full:laptop 把 `@ #` 放到数字行末尾(12 列，每键约 97 宽，不增高),compact 仍用第五行。省下 laptop
  的高度，代价是要维护两套 full 键位。

我倾向 (b)。

### N-1 · 交接期间的输入归属还差两处精确定义

1. 详设第 76、98 行把旧键盘设为 `pointerEvents=none`,新键盘"可见/可操作时"才接键。Phase 2 时新键盘已经升满，但下半部
   仍被正在下滑的旧键盘盖着。这时如果新键盘已可接键，落在旧键盘可见键帽上的手指会穿透到下面看不见的新键上(看到的
   是 full 的 q,按到的却是 numeric 的某个数字)。建议写明：交接两个阶段全程，键盘区吞掉点按；旧键盘完全退出后，新
   键盘才接键。
2. 第 80 行"B 被遮挡时先经 none 交接态，可见后再提交 B"引入了一个"待提交的目标 B",但没写它存在哪里、由什么事件
   提交、A→B→C 时怎么取消，也没写它与现有 `blockedFieldId`、`preflightFocusTarget` 的关系。建议映射到现有的
   blocked/preflight 状态，并写明提交与取消事件。

### N-2 · 交接分母仍是按四行 full 算的 246/190

需求 AC-06(第 103 行)、IA-15/16/17(第 43-45 行)、计划第 16、38 行都固定为 246→190、190→246、246→246。full 改成五行后，
会员表单最常见的一次 focus-next——姓名(full)→电话(numeric)——在 laptop 上是 302→246,在 mobile 上是 232→189,
没有单独成帧；在电话字段点回姓名则是 246→302,正是 S-1 的越界形态。建议把 full 的这一对交接加入分母。

### N-3 · 保留 `field` placement,等于为零消费者的 API 多加一条注册路径

详设第 56 行保留公开的 `field`,但在新模型里它只向 surface overlay"注册可达性",渲染位置与 `surface` 完全相同，实际上
只是一个别名；为了它,IA-20、AC-07 和计划还要专门做窄字段宿主 harness。仓内唯一使用处是
`apps/terminal/ui/base/input/test/provider.test.tsx`。需求第 22 行已允许"正式移除方案"。按 CLAUDE.md"优先删除过时代码",
建议直接删除 `field`(类型、`InputKeyboard` 分支、测试、README),同时去掉 IA-20 的窄宿主部分和对应的 harness。

### N-4 · 逐帧滚动插值，且未指定动画驱动

详设第 74 行让一条 clock 同时驱动键盘、内容与"内部 scroll request",第 84 行要求"scroll offset 在每帧按真实 readback/
同一时基插值",但没有选定动画驱动。RN Animated 的 native driver 驱动不了 ScrollView 偏移；逐帧用 JS 调 scrollTo 加
readback,又无法与 native 驱动的平移对齐。而且这是 input、render、primitives 三个包里第一次引入动画。需求只要求滚动与
平移处于"同一整体时间段"(第 70、72 行)。

建议：用一个进度值，经分段线性 interpolate 同时驱动两把键盘和内容平移。S-1 的"按 K 进度参数化"恰好可以写成分段线性，
能走 native driver。滚动则在同一时刻发起一次 animated scrollTo。详设写明驱动选择即可；性能在获授权的 Android 动态阶段
顺带观察，不必另建门。

## 4. 维度核对

- **前提链**:N/A,没有新的 actor 或数据来源；9 个生产字段与两套 integration 已核。
- **契约与生成面**：无 HTTP。公开 TS 面的变更(`SurfaceRootContentFrame`、`InputSurfaceFrameProps`、
  `PrimitivePinInputProps`、`InputKeyboardProps`)在详设第 100-108 行已列出，依赖方向保持 input→render。
- **owner/状态**：唯一输入 owner 与焦点会话定义成立；交接中的待提交状态缺落点(N-1)。
- **UI**:S-3、S-4 待 Dexter 裁决；交接点按见 N-1。
- **性能**:N-4。
- **安全**:PIN 只新增测量 ref,不改口令语义，也不记录数值；未见问题。
- **测试与证据**:S-1 要求补饱和端点；S-2 说明 mock 测量测不出平台差异；计划中 L1/L2/L3 分档与逐代码对账成立。
- **授权边界**：五份文件都标 `IMPLEMENTATION_AUTHORITY=false`,彼此一致。

## 5. 需要 Dexter 裁决

1. S-3:宽屏键帽拉满，还是键区设上限居中。我倾向至少给 numeric/financial 设上限。
2. S-4:full 第五行选 (a) 只放 `@ #`、(b) 放一排常用 URL 符号、还是 (c) laptop 不增高而 compact 用第五行。我倾向 (b)。

## 6. 结论

`VERDICT=NO-GO`,`M/S/N=0/4/4`,只针对上列当前字节。

需求修订把上轮三个反例都解决了；presentation bridge、PIN 锚点、9 个字段与两套 integration 的源码前提都成立，整体架构
我独立推导也会这样选。

挡住 GO 的有四处：
- 方案 (b) 的内容路径在"升高"型交接上越过自己的上限(S-1);
- 测量契约与两个平台的实际 API 行为不符(S-2);
- 两项需要 Dexter 拍板的视觉取舍(S-3、S-4)。

S-1、S-2 由 Codex 直接修设计;S-3、S-4 等 Dexter 裁决后再改 IA。

本结论不授权实施、源码或测试修改，也不授权 Web、Metro、Android 或设备验证；静态设计结论不等于动态或视觉通过。

## 7. Dexter 裁定（评审后追记，2026-09-23）

- S-3:选 (a)。四种布局的键帽都按最终外框宽度拉满，维持详设第 47、90 行的算法。
- S-4:full 维持四行，不加第五行，也不加额外符号行。由此 `@`、`#` 不再在键盘上提供，URL 符号只保留数字行 Shift
  层的十个 `: / . ? & = - _ % +`,取代 Q3 的十二项最小分母。full 高度回到 laptop 246、mobile 189。
- N-2:因 S-4 裁定而撤回。full 回到 246 后，现有 246→190、190→246、246→246 已覆盖 full 的交接。
- S-1、S-2、N-1、N-3、N-4 不受裁定影响，交 Codex 修订。
