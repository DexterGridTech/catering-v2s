# TER Terminal 虚拟键盘视觉重构需求 v2

> STATUS: DRAFT_FOR_REQUIREMENTS_REVIEW
> IMPLEMENTATION_AUTHORITY: false
> REVIEW_TARGET: REQUIREMENTS
> SUPERSEDES: doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md
> FORM INPUT: doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md
> SCOPE: full、alpha、numeric 与 financial 四种程序虚拟键盘；alpha/financial 由 sample 会员资料中的受控能力验证字段消费
> USER_VISUAL_REVISION: 2026-09-07：按实际视觉复核与 V1 POC 对照，键盘外框按当前布局内容自适应，功能键并入最后内容行；numeric/financial 的末端改为一行三列对齐网格，列内复合键水平分布；本条 supersede 本文原先的“四布局外框同高”“独立动作行”以及 numeric/financial 五等分末行表述；2026-09-19 Dexter 确认 alpha 加入 CAPS，沿用现有 capsLock 语义，保持三行高度不变

## 1. 需求关系与第一性目标

本文不是独立决定屏幕形态。它以
2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md 为前置输入：
输入组件从自己的 InputSurfaceFrame onLayout 得到最终 width/height，横屏和竖屏
都是同一条本地测量路径。

本需求解决的是真实可用性问题：当前 VirtualKeyboard 把按键全部交给同一级
PrimitiveActions 平铺，字符、数字、删除和完成没有稳定的键区层级，且固定逻辑
尺寸无法同时适配主屏、副屏、Web 缩放与竖屏。用户要找键、确认和删除时必须在一
张无结构的按键表里扫描，窄 surface 还可能把触控目标缩小或裁掉。

第一性目标是：在不增加业务组件负担、不改变编辑语义、不引入系统 IME 的前提下，
让 full、alpha、numeric 与 financial 在各自真实消费者以及受控 input harness 中都有
熟悉的空间分组、可预测的尺寸、完整的可寻址按键和稳定的输入反馈。

## 2. 本轮范围

### 2.1 保留并重做的布局

本轮重做并实际消费：

- full：店员工号与密码；
- numeric：会员电话与顾客年龄。
- alpha：sample 会员资料中的“英文字符测试”能力验证字段；
- financial：sample 会员资料中的“金额格式测试”能力验证字段。

当前消费者证据：

| 布局      | 真实消费者                                                            | 证据                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| full      | StaffLogin 的工号与密码，均为 virtual                                 | apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLogin.tsx 第 27 至 55 行                                                                                                |
| numeric   | MemberForm 电话、CustomerMember 年龄，年龄 maxLength 为 3             | apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx 第 30 至 45 行；apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx 第 39 至 45 行 |
| alpha     | MemberForm 内受控的 sample-only “英文字符测试”字段，virtual/alpha     | 本需求新增的 sample 能力验证点；字段不进入 Member、PendingMember 或 submitMemberCommand                                                                                                |
| financial | MemberForm 内受控的 sample-only “金额格式测试”字段，virtual/financial | 本需求新增的 sample 能力验证点；字段不进入 Member、PendingMember 或 submitMemberCommand                                                                                                |

alpha 与 financial 当前源码没有既有非测试消费者；本轮不再把它们当成“未来占位”
保留，而是明确新增两个 sample-only 能力验证点。它们放在 sample 会员资料
页面的独立“键盘能力验证”区域，目的是让四种布局都有可操作、可寻址的真实
渲染路径，同时不虚构会员领域事实。

这两个验证点是 sample 会员资料页中面向店员的、明确标注的开发验证区域，不是
顾客确认页，也不进入 SECONDARY。它们必须放在现有 PRIMARY-only `MemberForm` 的
姓名、电话字段之后、提交/取消动作之前；区域标题固定表达“输入能力验证（仅
sample）”，字段文案分别为“英文字符测试（仅 sample）”与“金额格式测试（仅
sample）”，并附带“不保存到会员资料”的说明。这样店员能在真实表单承载树中
验证 alpha/financial 的焦点、键区和完成动作，同时不会误把它们理解为会员领域
字段。

两个验证字段的边界必须固定：

- “英文字符测试”只消费 alpha，允许拉丁字母编辑，fieldId/testID 固定为
  sample.desk.member-form:keyboard-alpha-probe；
- “金额格式测试”只消费 financial，用于验证数字、句点和负号键的空间与编辑
  可达性，fieldId/testID 固定为 sample.desk.member-form:keyboard-financial-probe；
  它不宣称自己是余额、充值或任何会员财务事实；
- 两个字段由 input registry 持有，提交时不进入 submitMemberCommand，不进入
  PendingMember、Member 或 confirmMemberCommand；
- 两个字段由 `MemberForm` 挂载时以空值注册，卸载、提交成功、取消、放弃、失败
  重试或重新进入表单时清空并注销；它们不从 pending 或任何业务快照恢复，也不
  改变现有提交成功、取消、撤回、拒绝、重试和业务 dirty 语义。业务 dirty 只由
  姓名与电话决定；能力验证字段的编辑不会改变取消确认、提交按钮可用性或业务
  command payload；
- 字段文案与测试说明必须明确“仅 sample 能力验证”，不得被复用成生产业务字段；
- 两个字段只在 PRIMARY 的 `MemberForm` 承载树出现；不得复制到 CustomerMember、
  SECONDARY 或 handheld-confirm，alpha/financial 的 SECONDARY 覆盖由 input
  harness 提供，而不是扩张业务拓扑；
- 验收必须观察两个字段各自出现对应 layout、能获得 virtual owner、能完成编辑与
  complete 动作，离开 MemberForm 后 registry 中不再存在；完成两个字段的编辑后，
  业务提交 payload、Member/PendingMember、取消 dirty 判定和顾客确认路径都必须与
  未编辑验证字段时相同；
- 实现前仍须在仓根重扫 alpha/financial 的完整消费者分母，结果应包含这两个
  受控字段和对应测试，不得另行添加未评审的业务消费者。

### 2.2 不属于本轮的行为

保留以下既有边界：

- KeyboardKind、system/virtual owner 互斥；
- system 到 virtual 与 virtual 到 system 都先经过 none；
- surface 收缩模型、内容区最小可用高度与焦点滚入可见区；
- 副屏只使用虚拟键盘，不开启系统 IME；
- 原子输入快照、提交与卸载竞态；
- feature actor、业务 command、年龄三位上限与现有 optional 语义；
- 上一轮已关闭的 virtual 到 system 首击不丢失，以及真实焦点可观察的双向测试；
- 非输入区域点击收起当前虚拟键盘；
- PrimitiveInput 的已有公共契约与既有 testID 命名。

本文不新增会员领域字段、screen-count 分支、keyboardKind 分支或 feature 内布局
复制；两个 sample-only 能力验证字段是本轮明确批准的测试 UI，不属于业务契约。

## 3. 视觉与编辑事实

### 3.1 当前源码事实

apps/terminal/ui/base/input/src/model/keyboardHeight.ts 第 1 至 32 行目前声明
InputSurfaceSize、四种 KeyboardLayout 与基于 surface.height 的固定高度公式。
apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx 第 20 至 52 行把数字、
字母和功能键组合成扁平数组，第 68 至 92 行用同一层 PrimitiveButton 渲染。

这些是需要重构的当前实现，不是新的目标契约。键盘 v2 的高度和可行性必须使用
form requirements 规定的本地测量，不能继续把 terminalSurfaces 静态值当运行时
surface。

### 3.2 不能新增的键语义

full 必须保留当前可达集合：0 至 9、a 至 z、shift、caps、backspace、complete。
alpha 必须保留 a 至 z、caps、shift、backspace、complete。
numeric 必须保留 0 至 9、backspace、complete。
financial 必须保留 0 至 9、句点、负号、backspace、complete。

本轮不新增 space、enter、语言切换、候选栏、emoji 或业务快捷键。financial 的
句点与负号是当前 KeyboardKey 集合已经存在的字符键，不是本轮新增业务语义。
视觉布局可以分组现有键，不能用增加“看起来像系统键盘”的按钮来掩盖业务契约
没有这些语义。

### 3.3 可见反馈

shift、capsLock、pressed、disabled、backspace 和 complete 必须有稳定可识别的
视觉或辅助技术反馈。按键文本可以按现有大小写状态变化，但不能改变 KeyboardKey
的编辑结果。

## 4. 共同几何输入

### 4.1 唯一输入

键盘只接受所属 InputSurfaceFrame 的最终测量：

- width 与 height 来自该 frame 根 View 的 onLayout；
- direction 由 width/height 比较得出，不从设备、Platform.OS 或浏览器环境判断；
- full 的 wide/compact 变体由可用宽度和列数可行性决定；
- numeric 在横屏、竖屏、PRIMARY、SECONDARY 都使用同一键语义和三列任务模型；
- host 的横屏固定逻辑画布是 PRIMARY 1280 × 800、SECONDARY 960 × 540；sample Android
  副屏的 1280 × 720 physical px / 213 dpi 只是硬件显示配置。逻辑画布是 host 承载层的
  画布输入，不是 input 的直接运行时尺寸；input 运行时仍只读取自己的 onLayout。

input 不读取 Dimensions.get('window')、useWindowDimensions、window 全局值、
terminalSurfaces、assembly 的 surfaceSize 或另一块 surface 的尺寸。

### 4.2 首帧与重测

首次 onLayout 之前：

- 不渲染虚拟键盘；
- 不用猜测尺寸画一版再跳；
- visible 必须为 false；
- 不得给虚拟字段制造已获焦但没有输入路径的死状态。

当 width/height 变化时，必须使用最新本地值重新计算方向、几何变体、高度和可行性。
旧值不能跨 surface、旋转或 Web resize 复用。尺寸无效时回到不渲染键盘状态。

### 4.3 外部 inset

imeInset 继续由 adapter 提供，是系统 IME 的平台事实；不能被 input 的本地测量
替代。副屏没有系统 IME 的既有产品决定不变。

## 5. 四种键盘的目标形态

### 5.1 full

full 是同一套键语义的两种几何变体，不是两个 public KeyboardLayout。布局采用 V1 POC
的软键盘心智：修饰键位于字母区边缘，删除与完成位于末端；功能键与内容键共用最后一行，
不再单独占据一个动作行。为保留现有 caps 语义且让窄屏仍能容纳十列，caps 位于 home
row 起始位置，shift 位于最后一行起始位置。

空间顺序（wide 与 compact/portrait 的键顺序相同）：

    数字行： 1 2 3 4 5 6 7 8 9 0
    字符行： Q W E R T Y U I O P
    home 行： caps A S D F G H J K L
    末行：    shift Z X C V B N M backspace 完成

compact/portrait 仍必须显示全部数字、字母和现有功能键，允许按测得宽度压缩
列宽与间距，但不得删除、折叠成不可达或横向滚动隐藏任何键。它保持数字、QWERTY、
home row、末行的空间分组；动作键的视觉层级由 key-action 样式表达，而不是用独立
动作行制造额外空白。full 的四行各有十个逻辑 cell，窄屏仍使用 dense token。

full 的要求：

- 数字与字母不能重新合并成一条平铺数组；
- shift 与 caps 保留当前状态语义；
- shift/caps 与 backspace/complete 都位于内容行内的动作 segment；
- complete 的 focus-next/末字段 close-only 语义不变；
- 不新增 space 或 enter。

### 5.2 numeric

numeric 使用三列数字网格，末端保持一行高度。**历史口径说明：本段原始的 `0` 横跨前两列
描述已由文首 `USER_VISUAL_REVISION` 2026-09-19 的用户视觉修订 supersede；当前实施唯一
有效口径是 `BACKSPACE | 0 | COMPLETE` 三列底行，以下旧示意仅保留为历史记录，不得作为实现或
验收正本。**

旧版示意（已 supersede）：`0` 横跨前两列，backspace 与 complete
在右侧第三列内部左右分布：

    1 2 3
    4 5 6
    7 8 9
    0 0 | backspace 完成

`backspace` 与 `complete` 始终在最右侧动作列，且分别与上方 `9` 的列对齐；`0` 的横向
跨度是两个标准 cell，动作键在该列内共享水平空间，但不复制 key 或产生第二个 testID。
这样 numeric 仍是三列任务模型，
同时保留标准数字键盘的“大零键 + 右侧编辑/完成动作”心智。
numeric 不显示小数点、负号或金融快捷键。电话和年龄共享这一布局；年龄的
maxLength=3 仍由输入字段与同一纯编辑边界共同保证。

### 5.3 alpha

alpha 是纯拉丁字母能力验证布局：

    Q W E R T Y U I O P
    CAPS A S D F G H J K L
    shift Z X C V B N M backspace 完成

它只给 sample-only “英文字符测试”字段消费。`CAPS` 是持久大小写锁定，`shift`
仍是一次性大写；两者都复用现有 `KeyboardKey`/`EditState.capsLock` 编辑语义。
它不承担中文姓名，不提供系统 IME 替代，不新增 space 或 enter。`CAPS` 与字母共用
第二行，不增加视觉行数；compact/portrait 下仍须保持全部 26 个字母和动作键可达。

### 5.4 financial

financial 是 sample-only 金额格式能力验证布局：

    1 2 3
    4 5 6
    7 8 9
    - . | 0 | backspace 完成

它用于验证句点与负号字符键在窄宽布局中的位置、命中和编辑可达性；它不宣称
sample 已经拥有余额、充值或金额业务。字段内容不会进入会员 command/state。
financial 的前三行与底部复合区都使用同一组三列 standard cells：`-` 与 `.` 在第一列
内部左右分布，`0` 独占第二列，backspace 与 complete 在第三列内部左右分布，分别对齐
`7/8/9`。本轮不在 input
包内做金额格式校验，负号和句点的纯编辑结果仍遵循当前
KeyboardKey/editText 语义。

## 6. 按轴可行性与高度规则

### 6.1 高度

同一 surface 上 full、alpha、numeric 和 financial 的 dock 外框都必须完整包住当前布局的
真实内容，不能用行数最多的布局为其它布局预留大块空白。布局切换允许内容区随键盘真实
行数改变而收缩或恢复；这与系统软键盘在不同键盘形态下占用不同高度的行为一致。高度以
本地 surface height 为输入，并继续受以下产品边界限制：

- 内容区最小高度为 208；
- dock 最大高度为 320；
- dock 不得超过 surface height 的 50%；
- 低于键盘最低显示能力时不渲染 dock；
- layout 变体不能申请超过当前 surface 可用高度的 dock，也不能用 overflow hidden 裁剪按键；
- dock 高度等于当前布局的 `verticalRequired`，其中 numeric/financial 的复合列内水平间距
  不增加视觉行数；仅在 surface 可用高度不足时降至可用高度并
  进入 `unsupported-height`，不得通过 `rowBlockOffset` 把短布局垂直塞进长布局。

旧的 1157 × 723 与 962 × 541 高度结果已退役，不是验收基线或运行时常量；详设必须
把当前公式改成消费 InputSurfaceFrame 本地测量的纯计算函数。host 画布声明与 input
测量之间不得再建立静态 props 桥。

### 6.2 按轴计算

可行性必须分开判断纵轴和横轴，不能用一个 visible 高度布尔值替代：

    verticalRequired =
      rowCount × MIN_VERTICAL_TOUCH
      + (rowCount - 1) × rowGap
      + paddingTop + paddingBottom

    horizontalAvailable =
      measuredWidth - paddingLeft - paddingRight
      - (columnCount - 1) × columnGap

    keyWidth = floor(horizontalAvailable / columnCount)

MIN_VERTICAL_TOUCH 固定为 48 个逻辑单位。纵向可操作区域包括整个 key cell；
键帽的装饰填充可以小于 cell，但相邻命中区域不能重叠。

横向不得再强制每列 48。numeric 的三列在受支持的窄 surface 上应满足 48 的
横向 cell 基线；full 的 compact/portrait 使用专门的 dense-key 横向 token，
由详设在本地测量模型下确定并记录，不能把 48 直接套到十列 QWERTY。该 token
必须足以让字符可辨、可命中、无重叠、无裁切，并在目标竖屏宽度 fixture 上通过。

布局可行当且仅当：

- verticalRequired 不超过可用 dock 高度；
- horizontalAvailable 能为每一行的列数提供该布局允许的最小 keyWidth；
- 内容区仍达到 208；
- 测量 ready 且 width/height 为有限正数。

### 6.3 不可行时的确定行为

本轮支持的最小 frame 宽度为 `MIN_SUPPORTED_FRAME_WIDTH = 360` 个逻辑单位。
这是键盘 frame 的能力边界，不是设备分类、方向判定或布局输入；方向与布局仍只
由该 frame 自身的 onLayout 结果决定。低于此宽度时，当前 frame 的容量状态为
`unsupported-width`，不得把它当成一条可继续压缩的 compact 变体。

任一轴不可行时：

- visible=false，不渲染半截或溢出的键盘；
- 不猜一个更小的逻辑 surface，也不把按键压到不可操作；
- 不把字段改成新的必填/可选语义；
- 决策动作仍必须有可操作路径；
- 不得出现“字段已经获得虚拟焦点、没有键盘、也无法继续”的死状态；
- 保留当前草稿与原子快照语义；
- 诊断必须能区分“未测量”和“已测量但容量不足”。

这条是产品安全阀，不等于可以让字段静默失效。对承载必填 virtual 输入的页面，
低于 `MIN_SUPPORTED_FRAME_WIDTH` 或其它轴不可行时，frame 必须显示可见且不可
误解的“不支持当前窗口尺寸”提示，明确要求把窗口调整到至少 360 个逻辑单位；
不得静默隐藏键盘后继续让字段获得虚拟焦点，也不得伪造提交成功。恢复路径只有
把同一 frame 调整回受支持尺寸后重新测量并恢复可输入状态。对可选 virtual 输入，
保留其原有可选语义，年龄可以为空，确认、拒绝、交还等决策动作仍必须可操作。
input 包不从业务模型推断必填性；该提示是 frame 容量状态，业务页面负责保持
自己的必填/可选与决策语义。

测试必须构造高度不足与宽度不足两种反例，并分别观察：未测量态不渲染键盘、
`unsupported-width` 不进入虚拟焦点、必填页面出现受支持尺寸提示、可选页面仍能
完成不填值的决策，以及尺寸恢复后键盘重新可用。

## 7. 空间、触控与视觉层级

### 7.1 共同 token

dock padding、行间距、列间距、按键圆角、动作区高度和状态色来自 input 可复用的
token/主题接缝。左右边缘对称，不能使用负 margin、屏幕外 absolute 定位或横向
滚动把键塞进去。

full、alpha、numeric 与 financial 在同一 surface 使用同一组 token，但 dock 外框按各自
视觉行数自适应；短行与末行 compound/grid segment 左右对称，内部行高、列宽和间距可按
本地 width 做几何变体，但不能改变编辑语义或键的 testID。numeric/financial 的复合区
必须使用上方数字区的三列 shared cell width，不得再用五列 fit 破坏 `7/8/9` 的列对齐。

### 7.2 视觉目标

- 字符区、数字区、动作区有明确空间边界；
- backspace 和 complete 与普通字符键有层级差异；
- pressed、disabled、shift、capsLock 状态可辨；
- 标签不截断、不重叠、不被 dock overflow 裁掉；
- 视觉填充可以小于命中 cell，但命中区域必须来自真实布局，不得靠重叠扩大；
- Web 与 Android 使用同一 key 顺序、语义和状态模型，不要求复制厂商键盘的像素。

### 7.3 可寻址性

每个可操作 key 仍使用稳定的 ui.base.input:virtual-keyboard:* testID 和已有
accessibilityLabel 规则。视觉重构不得通过数组 index、随机 id、文本搜索或
父容器宽 locator 替代键级 testID。compound row 的 row-level `actions` region 允许
同时承载中间内容 segment；各 segment 另有稳定的 `segment:${zone}:${index}` 挂点，
最终操作仍以 key-level testID 为准。

## 8. 输入性能与共存边界

按键热路径只做编辑状态、selection/value registry 与必要的低频键盘状态更新；
不得在每次按键中重新测量整棵 surface、触发业务 command、持久化逐字值或重建
所有按键的回调闭包。

必须保留已关闭的 virtual/system 双向首击修复与真实焦点可观察测试。仅断言
Keyboard.dismiss 调用次数或 showSoftInputOnFocus 值不能证明 owner 切换正确；
验收应能观察第一次切换后目标字段仍可获焦并显示目标键盘。

input 包仍不得 import feature、业务 command、screen topology 或 display mode。
业务组件不需要知道 full 的 wide/compact 变体。

## 9. 验收矩阵与红向量

### 9.1 真实业务消费者矩阵

这张表只描述 sample 真实业务树中会出现的消费者，不要求为了覆盖布局而把
MemberForm 放到 SECONDARY，也不要求 CustomerMember 增加非业务字段：

| 真实承载面与场景                                               | full | alpha                | numeric      | financial            |
| -------------------------------------------------------------- | ---- | -------------------- | ------------ | -------------------- |
| 横屏 PRIMARY / sample-staff-auth                               | 必验 | —                    | —            | —                    |
| 横屏 PRIMARY / sample.desk.member-form                         | —    | 必验（英文字符测试） | 必验（电话） | 必验（金额格式测试） |
| 横屏 SECONDARY / sample.desk.customer-member                   | —    | —                    | 必验（年龄） | —                    |
| 竖屏 PRIMARY / sample-staff-auth                               | 必验 | —                    | —            | —                    |
| 竖屏 PRIMARY / sample.desk.member-form                         | —    | 必验（英文字符测试） | 必验（电话） | 必验（金额格式测试） |
| 竖屏 PRIMARY / handheld-confirm 的 sample.desk.customer-member | —    | —                    | 必验（年龄） | —                    |

Web resize 复用当前实际激活的 PRIMARY/SECONDARY route；它改变 frame 尺寸，不
新增 alpha/financial 的 SECONDARY 消费者。真实业务矩阵中的尺寸只来自对应
frame 的 onLayout；旧的 1157 × 723 与 962 × 541 不再作为回归 fixture。host 侧横屏
画布声明使用 PRIMARY 1280 × 800 与 SECONDARY 960 × 540；副屏 1280 × 720 physical px /
213 dpi 仅指硬件显示配置。

### 9.2 input base geometry harness 矩阵

这张表是 input 包的受控非业务 harness，用来覆盖布局几何，而不是给 sample
新增业务 surface：

| harness frame fixture         | full         | alpha        | numeric  | financial    |
| ----------------------------- | ------------ | ------------ | -------- | ------------ |
| 横屏 PRIMARY 逻辑画布 1280 × 800  | 必验         | 必验         | 必验     | 必验         |
| 横屏 SECONDARY 逻辑画布 960 × 540   | 必验         | 必验         | 必验     | 必验         |
| 竖屏窄宽 fixture              | 必验 compact | 必验 compact | 必验三列 | 必验 compact |
| Web resize 后实际 frame       | 必验         | 必验         | 必验     | 必验         |

harness 必须使用与生产相同的 InputProvider/InputSurfaceFrame/VirtualKeyboard
公共面和 key testID；它可以提供受控字段值，但不得伪造 Member、PendingMember、
业务 command 或 SECONDARY 业务路由。两张矩阵合起来才是本轮完整分母：第一张
证明真实业务消费者没有漏，第二张证明四种布局没有因业务拓扑而失去几何覆盖。

矩阵中的 1280 × 800 与 960 × 540 是 host 固定画布 fixture，不是 input 的静态尺寸基线；
所有运行时公式必须取 InputSurfaceFrame 的 onLayout。

### 9.3 红向量

| ID      | 变异                                                                                                               | 应失败的判据                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| KEY-R1  | 把 InputSurfaceFrame 的 onLayout 改回静态 surfaceSize                                                              | 运行时几何输入来源失败                             |
| KEY-R2  | 用 Dimensions/useWindowDimensions 决定方向                                                                         | Presentation 或多 surface 局部测量失败             |
| KEY-R3  | 删除 alpha/financial，或删除 MemberForm 中任一 sample-only 能力验证字段，或把验证字段复制到 SECONDARY/业务 command | 真实消费者矩阵、harness 矩阵或 sample 业务边界失败 |
| KEY-R4  | 对 full compact 横向也强制 48                                                                                      | 竖屏十列布局可行性失败                             |
| KEY-R5  | 只判断 height>=250，不判断横轴                                                                                     | 宽度不足仍显示溢出键盘，失败                       |
| KEY-R6  | 首帧给默认尺寸                                                                                                     | 未测量态不渲染键盘失败                             |
| KEY-R7  | 删除或重排 key testID                                                                                              | 可寻址性失败                                       |
| KEY-R8  | 只 mock onFocus 并断言 dismiss 次数                                                                                | 行为测试无法观察首击焦点，必须被测试门拒绝         |
| KEY-R9  | 把任一能力验证值写入业务 command、Member/PendingMember，或让它改变业务 dirty/顾客确认路径                          | sample-only 字段边界失败                           |
| KEY-R10 | 移除 `PrimitiveButton` 的 `Pressable` pressed style，或只用调用次数证明按下反馈                                    | 按键按下时没有可观察的局部视觉反馈，或行为证明无效 |
| KEY-R11 | 从 alpha 布局删除 `caps`，或把 `caps` 实现成只影响下一次输入的临时 shift                         | alpha 缺少持久大小写切换，或 `EditState.capsLock` 语义未被真实 alpha 键位承接 |

模型红向量的 FAIL 只说明判据可证伪；生产树的静态/编译/运行结果必须分开报告，
不得把模型 FAIL 伪装成生产源码 FAIL。

## 10. 替代方案取舍

| 方案                                    | 结论 | 原因                                                                         |
| --------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| 继续一张平铺按钮表，只换颜色和圆角      | 拒绝 | 没有解决键区扫描、动作层级与窄宽可用性                                       |
| 精确复制某个系统键盘                    | 拒绝 | 跨平台、双 surface 与现有业务 key set 不同，复制会引入未授权语义             |
| 删除 alpha/financial                    | 拒绝 | 本轮明确在 sample 会员资料增加两个受控能力验证消费者，删除会让需求与场景脱节 |
| 把 alpha/financial 扩成真实会员财务字段 | 拒绝 | 会无谓扩大 Member/PendingMember/command/state 与业务语义范围                 |
| 继续用 terminalSurfaces 静态尺寸        | 拒绝 | Presentation 与响应式 frame 会读错，且 Web transform 会掩盖真实 hit target   |
| 用设备型号区分 mobile/desktop           | 拒绝 | 同一宽度的 Web 小窗与手机应得到同一布局，设备分类不是几何事实                |

## 11. 公共面与前置关系

本需求要求详设与实现同步完成：

1. 保留 alpha 与 financial 的 KeyboardLayout 公共成员和布局数据，并在 sample
   MemberForm 里加入两个受控能力验证字段；
2. 删除 InputSurfaceSize 公共 export，并让键盘计算消费本地测量；
3. 删除 InputProvider/InputSurfaceFrame 的 surfaceSize 入口；
4. sample-console assembly 不再穿透 terminalSurfaces 尺寸；
5. MemberForm 的 system 姓名移除无效 layout=full，或由类型约束保证 system
   字段不能声明 layout；
6. 保留 imeInset、surface-local keyboard owner、focus boundary、快照和年龄链。

实现前必须重扫所有非测试消费者。允许的 alpha/financial 消费者只有本需求列出的
两个 sample-only 字段及其测试；任何其他业务使用都属于需求范围冲突，不能用
兼容别名偷过公共面门。

## 12. 非目标与通过条件

本文不授权：

- 本轮源码、依赖、Android/Web 运行或部署；
- 中文 IME、候选词、语音、emoji、第三方软键盘；
- true Kiosk、Lock Task、副屏系统 IME 或设备权限；
- 新业务 command、字段、screen 或 feature 分支。

只有同时满足以下条件，才可进入详设：

- 形态需求文档已经通过独立 review；
- full/numeric 的按轴几何规则、不可行行为和本地测量来源已被接受；
- alpha/financial 的两个 sample-only 消费者、字段边界和非业务 payload 语义已被接受；
- 视觉需求中的 target baseline 已明确是验收 fixture，而不是布局输入；
- 上一轮 owner 互斥、焦点、收缩、快照和真实首击回归边界没有被改写。
