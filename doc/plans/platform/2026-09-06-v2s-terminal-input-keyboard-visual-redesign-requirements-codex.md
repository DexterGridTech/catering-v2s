# TER Terminal 虚拟键盘视觉重构需求

> STATUS: SUPERSEDED_BY_SURFACE_FORM_AND_KEYBOARD_REQUIREMENTS_V2  
> IMPLEMENTATION_AUTHORITY: false  
> SCOPE: `apps/terminal/ui/base/input` 的四种程序虚拟键盘布局  
> OUT_OF_SCOPE: 本轮不实施、不改业务 Journey、不改系统 IME、不新增第三方依赖

> 本稿保留为首版需求评审历史。由于产品形态已从固定横屏扩展为横屏加竖屏，且尺寸
> 来源已改为每个 `InputSurfaceFrame` 自测量，当前有效输入请改读：
> `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`
> 与 `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`。

## 1. 目的与问题定义

本需求解决的不是“颜色不够好看”，而是当前虚拟键盘把所有按键平铺在一个
`PrimitiveActions` 中，字符键、数字键、修饰键和动作键没有稳定的空间分组。
用户无法把它当作熟悉的软键盘使用，寻找按键和确认/删除动作的成本高，也更容易
误触。这是一个真实的可用性问题，尤其发生在店员登录的 `full` 键盘和顾客年龄的
`numeric` 键盘上。

当前实现证据：

- `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx` 第 26 至 52 行把
  每种布局都转换为一条扁平键数组；第 78 至 89 行把它们全部渲染为同一级按钮。
- 现有模型已经支持 `text`、`backspace`、`shift`、`caps`、`complete` 五类键，且编辑、
  选区、光标、最大长度和完成语义由 `editText` 负责。本需求只重构视觉空间，不重写
  这些语义。
- 当前业务消费者是：店员工号/密码使用 `full` 虚拟键盘，会员电话使用 `numeric`，
  顾客年龄使用带三位上限的 `numeric`。中文姓名仍按已裁定规则使用系统键盘，不能
  把本包表述成通用中文输入法。

第一性目标是：在不增加业务组件负担的前提下，让每一种虚拟键盘都具备可识别的
键区、稳定的触控目标、明确的动作层级和可预测的焦点/编辑反馈。

## 2. 本批目标与非目标

### 2.1 目标

1. 重构 `full`、`alpha`、`numeric`、`financial` 四种现有布局；四种都不能继续以
   “所有键同一层平铺”作为最终视觉形态。
2. 让字符区、数字/符号区、修饰区、编辑/完成区有稳定的空间分组；不同 surface
   只改变可用宽高，不改变布局语义。
3. 保留现有 `KeyboardKey` 行为：光标插入、选区替换、退格、shift、caps、完成、
   `maxLength`、非末字段 focus-next、末字段 close-only。
4. 保留 surface-local 键盘、内容区收缩、现有键盘高度公式和输入框滚入可见区。
5. 保留每个按键的稳定 `testID` 与可访问名称；视觉重构不能降低可寻址性。
6. 让布局数据可扩展：使用现有键类型新增一种排列时，不再需要为每种新排列复制
   一套组件渲染逻辑。

### 2.2 非目标

- 不实现中文 IME、拼音、候选词、联想、表情、语音或第三方输入法。
- 不改变 `KeyboardKind`、surface focus boundary、system/virtual owner 互斥、快照
  提交、业务 command 或任何 feature actor。
- 不新增 `phone`、`email` 等布局模式。本批没有对应的已批准业务消费者；以后新增
  模式必须先有业务场景和独立需求。
- 不把 Web CSS、`className` 或应用 theme 泄漏到 `ui/feature`；input 继续只通过
  primitives 和既有 theme/token 接缝表现。
- 不精确复制某个 Android/iOS 厂商键盘的像素、动画或系统 IME 行为。跨平台实现
  采用共同的空间原则和本仓 token，具体 token 归详设裁定。

## 3. 事实边界与来源

### 3.1 当前输入契约

当前 `KeyboardLayout` 只有 `full`、`financial`、`numeric`、`alpha`，定义在
`apps/terminal/ui/base/input/src/model/keyboardHeight.ts` 第 6 行。当前键盘高度来自
surface 自身声明尺寸，而不是窗口尺寸：

```text
contentHeight = max(0, surface.height - 208)
ratioBound    = floor(surface.height * 0.5)
candidate     = min(320, ratioBound, contentHeight)
keyboard      = max(0, candidate)
visible       = keyboard >= 250
```

这组边界在 `keyboardHeight.ts` 第 15 至 32 行实现，并由
`apps/terminal/ui/base/input/test/keyboardHeight.test.ts` 第 5 至 42 行覆盖。
视觉重构不得用每种布局不同的高度规避空间问题；同一 surface 的四种布局继续使用
同一高度结果。目标尺寸 PRIMARY `1157 × 723`、SECONDARY `962 × 541` 已在
`apps/terminal/ui/integration/sample-console/package.json` 第 10 至 21 行声明，且在
输入包测试中有对应基线。

### 3.2 当前业务接线

- `apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLogin.tsx` 的工号和
  密码字段使用虚拟 `full` 键盘。
- `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx` 的电话
  字段使用虚拟 `numeric`，姓名字段使用系统键盘。
- `apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx`
  的年龄字段使用虚拟 `numeric`，`maxLength=3`，副屏只使用这条虚拟数字路径。

因此本批必须同时考虑店员主屏的宽键盘和顾客副屏的窄键盘；不能只按 PRIMARY
截图设计。

### 3.3 命名空间与旧契约边界

当前实现使用的功能键是 `backspace`、`shift`、`caps`、`complete`，不是一个完整
的系统 IME 功能键集合。旧需求 §5.1 中关于 `enter`、`space` 的示例若被解释为
本批必须新增的键类型，会与当前业务契约冲突；本需求按已运行的 `KeyboardKey` 与
真实消费者取交集，不在没有业务场景时偷偷引入 `enter` 或 `space`。若需求 owner
仍要把该示例解释为硬约束，必须在详设前单独修订原需求；本文件不以新增空格键
绕开该冲突。

## 4. 研究依据与设计原则

这些资料用于抽取跨平台原则，不作为复制系统键盘实现的授权：

- [Android accessibility views](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views)
  要求交互控件具备足够的触控尺寸和可访问语义；Android 常用的最低触控目标是
  48dp × 48dp。
- [Android accessibility codelab](https://developer.android.com/codelabs/basic-android-kotlin-compose-test-accessibility)
  同样以 48dp 作为触控目标基线，并强调控件之间的间距。
- [Apple Human Interface Guidelines: Virtual Keyboards](https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards)
  建议根据输入内容选择键盘布局，并允许应用在需要时提供任务专用键盘。
- [Material 3 interaction states](https://m3.material.io/foundations/interaction/states/overview)
  要求 enabled、disabled、focused、pressed 等状态有一致、可辨认的表现。
- [Android KeyboardType](https://developer.android.com/reference/kotlin/androidx/compose/ui/text/input/KeyboardType)
  展示了数字、十进制、电话等输入任务之间的布局差异；本批只采用其中支持当前
  `numeric` 与 `financial` 任务的空间原则，不新增未被业务使用的 mode。
- [React Native TextInput](https://reactnative.dev/docs/textinput) 明确区分系统
  输入法提示和输入控件行为；本批的程序虚拟键盘仍是 input 包内部的编辑界面，
  不把 `inputMode` 暴露成业务布局控制。

据此，本批采用以下原则：

1. **熟悉的空间分组优先于装饰。** 用户应一眼看出字符区、数字区和动作区。
2. **任务专用键盘优先于万能平铺。** 不在数字输入中混入字母，也不在字符输入中
   用不可解释的金融键。
3. **动作键有层级。** 删除、完成、shift/caps 与字符键在形态和位置上可区分，
   但仍使用现有键语义和稳定 testID。
4. **尺寸和间距可评估。** 任何布局都必须在两个目标 surface 上无截断、无溢出、
   无重叠，且可达触控目标不小于 48 个逻辑像素；若声明尺寸无法同时满足内容区
   最小高度与触控目标，按现有 `visible=false` 容量边界停用键盘，不压缩到不可用。
5. **状态必须可见。** pressed、disabled、shift、capsLock、当前 focus/owner 与
   完成动作要有稳定视觉或辅助技术反馈。
6. **平台一致、应用可控。** 不依赖操作系统字体缩放或系统 IME 的布局；Web 与
   Android 共享同一布局数据和逻辑顺序，平台只负责渲染尺寸单位。

## 5. 四种布局的目标形态

下面是需求级 wireframe 约束。它规定区块、顺序和可见语义；颜色、圆角、阴影、
精确 gutter 和 token 在详设确定。所有示意中的键都对应现有 `KeyboardKey`，不代表
要新增一个业务功能。

### 5.1 `full`：数字行 + QWERTY 字符区 + 动作行

```text
┌ 1 ─ 2 ─ 3 ─ 4 ─ 5 ─ 6 ─ 7 ─ 8 ─ 9 ─ 0 ┐  数字行
┌ Q ─ W ─ E ─ R ─ T ─ Y ─ U ─ I ─ O ─ P ┐  字符行 1
  ┌ A ─ S ─ D ─ F ─ G ─ H ─ J ─ K ─ L ┐    字符行 2
    ┌ Z ─ X ─ C ─ V ─ B ─ N ─ M ┐          字符行 3
┌ shift ─ caps ───────── backspace ─ 完成 ┐  动作行
```

- 数字和拉丁字母必须分行，禁止再次把 26 个字母和 10 个数字连成一条平面列表。
- 字母排列采用稳定的 QWERTY 近似行序；不要求复制物理键盘的斜切键帽。
- `shift`、`caps` 保持当前语义和状态显示；`backspace`、`complete` 位于动作行，
  其中 `complete` 仍按现有 `hasNextField` 语义处理。
- 本批不添加空格、回车、语言切换或候选栏。工号与密码的现有输入集合必须仍然
  完整可达。

### 5.2 `alpha`：纯 QWERTY 字符区 + 动作行

```text
┌ Q ─ W ─ E ─ R ─ T ─ Y ─ U ─ I ─ O ─ P ┐
  ┌ A ─ S ─ D ─ F ─ G ─ H ─ J ─ K ─ L ┐
    ┌ Z ─ X ─ C ─ V ─ B ─ N ─ M ┐
┌ shift ───────────────── backspace ─ 完成 ┐
```

- 只呈现当前 `alpha` 已支持的字母、shift、backspace、complete。
- 不因为视觉上接近系统字母键盘就擅自加入 caps；caps 只能由契约变更另行批准。
- 字母大小写仍由现有 shift 规则决定；按钮标签不得只显示固定小写而隐藏当前状态。

### 5.3 `numeric`：三列数字键区 + 底部动作区

```text
┌ 1 ─ 2 ─ 3 ┐
┌ 4 ─ 5 ─ 6 ┐
┌ 7 ─ 8 ─ 9 ┐
┌     0     ┐
┌ backspace ───────────── 完成 ┐
```

- 数字按 1 至 9 的三列网格排列，0 独占底部中心位置；这比当前数组顺序更接近
  用户熟悉的数字软键盘。
- 不显示小数点和负号；电话、工号、密码、年龄继续共享这套数字布局。
- 空白对齐区域不是可点击控件，不得产生额外 testID 或无语义焦点。
- 顾客副屏的年龄字段只使用该布局；按键仍是程序输入，不依赖副屏系统 IME。

### 5.4 `financial`：三列数字键区 + 符号行 + 动作区

```text
┌ 1 ─ 2 ─ 3 ┐
┌ 4 ─ 5 ─ 6 ┐
┌ 7 ─ 8 ─ 9 ┐
┌  - ─ 0 ─ . ┐
┌ backspace ───────────── 完成 ┐
```

- `-` 与 `.` 只在金融布局出现，位置固定在数字区最后一行，避免用户在数字键区
  里寻找符号。
- `.`、`-` 的编辑语义仍由现有纯编辑模型决定；本批不引入金额校验、货币符号、
  千分位或业务格式化。
- `financial` 与 `numeric` 共用数字区几何，差异只来自已有字符键数据和对应标签。

## 6. 统一几何与响应式要求

### 6.1 区域结构

每个布局必须由以下逻辑层组成：

1. keyboard dock：surface-local 的兄弟节点，继续位于内容区下方，不覆盖内容；
2. character grid：字符/数字/符号的主键区；
3. action row：backspace、complete 以及当前布局已有的 shift/caps；
4. 每个 keycap：一个可寻址的既有 primitive button。

布局数据必须描述 rows、区块顺序和 key 类型；renderer 负责用同一套结构递归渲染。
今后只由已有键类型组成的新排列应只增加布局数据，不得复制另一套按键组件。

### 6.2 尺寸、间距和容量

- 键盘高度继续由 surface 声明尺寸和现有公式决定：最大 320、最大 surface 高度
  的 50%、内容区至少 208；任何布局不能单独申请更高高度。
- 目标基线为 PRIMARY `1157 × 723` 和 SECONDARY `962 × 541`；必须分别检查四种
  布局，而不是只在较宽主屏截图上验收。
- 每个可操作 keycap 的可触控区域至少 48 × 48 个逻辑像素；键帽视觉填充可以
  小于 hit target，但相邻 hit target 不得重叠。详设须说明 Android dp 与 Web
  逻辑像素的换算边界。
- dock 内外边距、键间距和行间距必须来自统一 token，左右边缘对称；不允许用负
  margin、横向滚动或屏幕外绝对定位塞下按键。
- 字符、符号和动作标签必须完整显示；任何截断、互相覆盖、横向溢出或被 dock
  `overflow: hidden` 裁掉都算失败。
- `alpha` 只有三行字符加动作行，`full`、`numeric`、`financial` 采用四至五行；
  行数差异不得改变 surface 级键盘高度，只能由内部行高和间距均匀分配。
- 当当前 surface 只能满足 208 内容高度而不能满足 250 键盘最低高度时，继续沿用
  `visible=false` 结果，不为了显示一排残缺按键而破坏内容可用高度。

### 6.3 缩放与平台边界

- 布局计算只读 `InputSurfaceSize` 和本布局的 key 数据，不读取浏览器 viewport、
  Android window 全局尺寸或设备字体缩放值。
- Android 与 Web 使用同一行/列/键顺序和同一语义尺寸约束；平台差异只能落在
  primitive 的单位实现和字体渲染，不得形成两套布局。
- 键盘出现时内容区继续按现有收缩模型工作，焦点输入框继续由 input 自己滚入
  收缩后的可见区域；视觉重构不能把 dock 改回 overlay。

### 6.4 字体与标签基线

- key label 必须使用 input/primitives 已有的应用字体与文字 token；业务 feature
  不得为单个按键传入字号、字体或 `className`。
- 当前 RNR text slot 已在
  `apps/terminal/ui/base/primitives/src/rnr/slots.tsx` 第 38 至 57 行关闭普通按键
  文本和输入文本的系统字体放大。本批不改变这一公共行为，也不把操作系统 font
  scale 当作布局计算输入；详设仍须在 Web 与 Android 目标尺寸上验证字形完整、
  基线稳定和对比度足够。
- 关闭系统字体放大只约束当前 app-owned keyboard 的几何稳定性，不得被扩展为关闭
  整个应用或辅助技术的文字缩放；任何更广的可访问性策略必须另行裁定。
- key label 为单行内容，禁止省略号和裁切；动作键的图形可以保留现有 glyph，但
  `accessibilityLabel` 必须提供可读的动作名称。

## 7. 交互、状态和可寻址性

### 7.1 行为不变

- 点击字符键只调用既有 `onKey` 编辑路径，不在键盘组件内 dispatch 业务 command。
- 光标/选区、shift 一次性状态、capsLock 锁定状态、退格、完成和 maxLength 的
  行为与现有 `editText` 保持一致。
- 非末字段的完成仍推进焦点；末字段完成仍 close-only，不因视觉上有“完成”按钮
  就自动提交业务表单。
- 点击非输入区域收起虚拟键盘、system/virtual owner 的互斥、layer focus suspend/
  restore 均保持既有 input/render 契约。

### 7.2 可访问性与自动化

- 现有 root `testID="ui.base.input:virtual-keyboard"`、content/keys 容器及每个
  `ui.base.input:virtual-keyboard:<keyId>` 必须继续存在；重排不能改变同一 key 的
  `keyId`。
- 每个可操作键必须仍是 button role，具有不依赖字形猜测的
  `accessibilityLabel`；例如 backspace、shift、caps、complete 要表达动作而不只
  暴露 `⌫`、`↑` 等图形。
- action row、character grid 的分组可以增加稳定的容器 testID，但不能删除旧的
  按键 testID，也不能以容器 testID 代替按键寻址。
- Web 键盘焦点顺序按视觉行序；Android 无障碍遍历顺序也按 character grid → action
  row，不能按内部数组的旧扁平顺序跳行。
- pressed、disabled、shift、capsLock 状态必须可通过视觉或辅助技术区分；不能
  依赖 hover，不能用颜色作为唯一状态信号。

## 8. 性能要求

视觉重构不能回退现有性能边界。按键数量约 30 至 40 个时：

- `VirtualKeyboard` 仍应保持 memo 化边界；普通按键的 handler identity 在父级无关
  更新后保持稳定。
- 单次输入不能因为 value/selection 变化导致所有 keycap 重新渲染；只允许当前
  输入字段和必要的 shift/caps 视觉状态更新。
- 布局不得在每次按键时逐键 `measure`、序列化整棵树、重建大数组或执行同步重活。
- 动画若保留，必须继续不占 JS 线程；不得为视觉重构引入新的动画库。
- 现有 PF-1 至 PF-8 的口径不变：PF-1 至 PF-6 只证明架构保护，不能单独宣称
  “UI 性能达标”；PF-7 连打观察和 PF-8 按键路径审查仍需分别报告。

本批新增的结构性红向量至少包括：

1. 把四种布局重新退回一个扁平 `PrimitiveActions`，必须红；
2. 把数字混入字母同一行、或把 `backspace/complete` 混进字符网格，必须红；
3. 删除任何旧 key testID、改变既有 keyId 映射或让同屏出现重复 testID，必须红；
4. 让某布局申请不同键盘高度、横向溢出、标签截断或负 margin，必须红；
5. 在每键路径加入同步测量/序列化或让每个 keycap 随每个字符重渲染，必须红。

## 9. 验收矩阵

验收必须把“模型红向量”和“真实树结果”分开记录，不得把模型 mutation 的 FAIL
写成生产源码 FAIL。

| 维度 | 必验对象 | 通过条件 |
| --- | --- | --- |
| 布局结构 | full/alpha/numeric/financial × PRIMARY/SECONDARY | 分区、行序、动作位置符合 §5，无扁平混排 |
| 尺寸容量 | 两种 surface 声明尺寸 | 同一 surface 四种布局高度相同；内容至少 208；无溢出 |
| 可操作性 | 所有 keycap | hit target ≥ 48；左右对称；无重叠、无截断 |
| 语义保留 | editText 与 Provider | 字符、退格、shift/caps、完成、选区、maxLength 行为不变 |
| 焦点关系 | virtual/system owner 切换 | 非输入点击收起；切换不吞首击；每个 surface 至多一个键盘 owner |
| 可寻址性 | root、区块、每个 key | 旧 testID 完整、无重复；label 表达动作；遍历顺序符合视觉顺序 |
| 业务落点 | StaffLogin、MemberForm、CustomerMember | 业务字段只提供 layout/既有 input props，不出现业务键盘分支 |
| 性能 | PF-1 至 PF-8 | 架构保护与连打观察分别记录；不得混称性能已证明 |
| 跨平台 | Expo Web 与 Android | 同一布局数据、顺序、状态、触控目标；平台只差渲染单位 |

最低运行场景：店员工号和密码各输入一串拉丁/数字字符，会员电话输入数字，
顾客年龄输入 0 至 3 位数字；四种布局中无业务消费者的 `alpha`/`financial` 用
受控 harness 验证真实树结构，不伪造业务 Journey。每种布局都要覆盖 focused、
pressed、disabled、shift/caps（适用时）、backspace、complete 和超长输入边界。

## 10. 方案比较

### A. 只把当前平铺键改颜色和圆角

拒绝。它改善装饰，不解决按键寻找、动作分组和任务认知；用户指出的问题仍存在。

### B. 精确复制 Android 或 iOS 系统键盘

拒绝作为实现目标。系统键盘属于平台 IME，尺寸、工具条、字体和厂商变体会漂移，
也不能满足副屏不启用系统 IME 的产品边界。采用系统键盘的布局原则，但保留本包
自己的跨平台数据和可寻址性。

### C. 只重做当前实际出现的 numeric

拒绝。`full` 是当前店员登录的主要痛点，`financial` 和 `alpha` 是同一公共契约
的布局分支；只改一个模式会留下相同的扁平 renderer 和不一致的用户体验。

### D. 引入第三方键盘或 IME 库

拒绝。它会扩大依赖、破坏 surface-local 虚拟键盘边界，并不能解决业务层的 testID、
焦点、快照和双屏一致性。当前问题可由 input 包内部的布局数据与既有 primitives
解决。

### 推荐方案

一次性重做 input renderer 的通用行/区块能力，四种布局只提供结构化数据；不新增
依赖，不改变输入模型，不把业务知识下沉到 input。这样一次改动解决当前四种布局，
并让以后使用已有键类型的排列变化不再复制组件。

## 11. 后续详设与实施边界

本文件只作为需求输入，不授权代码、依赖、Android/Web 运行或视觉实现。通过需求
review 后，详设必须补齐：

1. `KeyboardLayoutSpec` 的最小数据形态、keyId 稳定映射和区块 testID 规则；
2. 两个目标 surface 的精确 token、列数、行高、gutter、hit target 与文字基线；
3. action row 在各布局的宽度分配、focus order 和 disabled/pressed 状态；
4. 无法满足 48 hit target 或 208 内容下限时的可复核停用判定；
5. Android/Web 真实树与两端截图的逐布局对账，以及 PF-7/PF-8 证据边界。

实施前必须重新读取现有 input 需求、实施详设、sample 交互设计和当前源码；视觉
重构不得顺手改变已关闭的 M-1/M-2 行为、CP-0 副屏 IME 决策或业务字段链路。

## 12. 需求审查清单

- [ ] 四种布局都不再是平铺键阵列。
- [ ] full/alpha/numeric/financial 的行序、分组和功能键语义被批准。
- [ ] 48 hit target、左右对称、无截断/溢出与 208 内容下限有明确详设数值。
- [ ] 同一 surface 四种布局高度一致，且不改现有高度公式。
- [ ] 旧 key testID、accessibility label、focus/owner、编辑语义保持不变。
- [ ] 业务源码没有新增屏数、业务字段或 keyboard layout 分支。
- [ ] PF-1 至 PF-8 的结果与视觉截图分开报告；未把结构门当成延迟证明。
- [ ] 需求评审通过后，才进入逐代码详设对账和实施授权。
