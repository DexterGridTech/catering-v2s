# `@catering-v2s/ui-base-input`

## 定位

本包提供与 surface 无关的输入能力：字段的局部草稿、同步暂存快照、selection-aware 纯编辑、
虚拟键盘 owner，以及随承载 surface 尺寸计算的虚拟键盘 dock。它不是业务 state、runtime、
command、store 或中文 IME 引擎；本轮所有输入统一走虚拟键盘。

字段使用 `keyboardKind="virtual"` 和既有 `KeyboardLayout`，input 包不读取屏数、不读取
`Dimensions.get('window')`，也不感知业务字段名。无原生控件的字段可设置 `nativeLess`，仍通过
同一个 field registry、`InputController` 和虚拟键盘取得 owner 与焦点，不另起输入管线。
`InputFieldResult.visibleAnchorRef` 是 native-less 字段可见交互锚点的测量 seam：消费者须把它接到
实际承载该字段交互的 native 节点；input 只通过该节点相对 `InputSurfaceFrame` 根的
`measureLayout` 读取未平移 surface-local 几何，不读取窗口坐标或伪造输入控件。

## 公共面

公共面由 `src/index.ts` 与 `terminal-invariants.json` 同步维护：

- `InputSurfaceFrame` 在一个 Provider 内包裹完整 surface 内容，并把虚拟键盘作为覆盖内容的底部 overlay；键盘不参与内容尺寸分配；
- `InputScrollArea` 是唯一的输入滚动祖先适配器，负责在固定尺寸视口内按焦点框、键盘可见带与当前 scroll offset 计算最小滚动；需要在有界内容区让末尾控件完整滚入视口时，只能通过 presentation-only 的 `contentPaddingBottom` 增加尾部内容 inset，不得另建滚动祖先；处于滚动区内的 virtual 字段必须由**实际渲染在对应 `InputScrollArea` 下方的 React 组件调用 `useInputField` 并渲染输入框**，以保持 Android/Web 测量坐标一致。仅把父组件创建的 `field.inputProps` 对应 `PrimitiveInput` JSX 放入滚动区不够，因为 hook 会在父组件中读取不到滚动祖先 context；
- `InputProvider` 与 `useInputField` 维护 tokenized field registry、focus owner 与同步快照；
- `useInputSnapshot` 在提交动作边界同步读取不可变快照，不订阅编辑值；
- `InputKeyboard` 是 `InputSurfaceFrame` 独占的 surface overlay presenter；字段不选择键盘位置，也不在业务卡片内挂载键盘；状态、owner、按键处理和 `VirtualKeyboard` renderer 始终共用；
- `VirtualKeyboard` 只产生通用编辑 key，不派业务 command，业务不得直接用它拼第二套键盘；
- `InputFieldOptions` 固定使用 `keyboardKind: 'virtual'`，`KeyboardLayout` 描述输入呈现/承载能力；
  frame 尺寸由 `InputSurfaceFrame` 自己的 `onLayout` 读取，不通过公共 `surfaceSize` prop 传入。
- `full`、`alpha`、`numeric`、`financial` 的行列、稳定 keyId 与 region/key `testID` 由
  `src/foundations/keyboardLayout.ts` 唯一维护；键本身仍通过 primitives 的 `PrimitiveButton` 呈现，
  input/feature 不传 `className`。
- 四种布局都把功能键放入连续的键区，不另起空的动作行：full 的一次性 Shift 在 home row
  起始处，空格在末行起始处，backspace/complete 在末端；alpha 的 home row 从 A 开始且
  不留 CAPS 占位，第二行起始处为一次性 Shift 后接 `a…l`，第三行起始处为空格后接
  `z…m`，backspace/complete 在末端。full 的数字行在 Shift 态把 `1–0` 显示并插入
  `:/.?&=-_%+` 十个 URL 常用符号（顺序为 `: / . ? & = - _ % +`），成功插入后回普通态。
  numeric
  与 financial 的前三行都是 `123`、`456`、`789` 三列；numeric 的末端复合区是一行三列，
  依次为 backspace、`0`、complete，且三者都是独立一列；financial 的末端复合区也是
  一行三列，第一列内部左右放 `-/.`，第二列为 `0`，第三列内部左右放 backspace/complete。
  这样每个末行按键保持一行高度，动作键始终在最右侧，且数字列与符号列按 `7/8/9` 对齐。该排列参考 V1 POC 的连续软键盘心智，
  financial 的负号和小数点仍显示 `−/·` 并插入 `-/.`；完成动作保持原有语义。

值只在字段局部状态和同步 registry 中维护；提交时由消费者调用 `useInputSnapshot()` 或 field result 的 `captureInputSnapshot()`，形成
冻结对象后再交给业务 owner。编辑期不写 kernel slice、uiVariables 或 runtime command。

## 性能与焦点纪律

- 每次输入只更新当前字段和键盘 dock 的局部状态，Provider 不向表单广播所有字段值；
- registry 的 `capture()` 不 `await`，按稳定注册顺序复制并冻结；token cleanup 不会删除同 id 的新实例；
- 同一 surface 始终满足最多一个 virtual keyboard owner；native-less 字段在没有原生 ref 时仍能
  通过 controller 建立 virtual owner。
- virtual 字段在 Android 上收到的 native blur 不单独终止 virtual owner；显式 `blur()`、字段注销、
  layer suspend 或后续字段获焦才是清理 owner 的边界。一次性 Shift 仅属于当前字段焦点会话；
  真正离开字段、完成收起或 scope suspend 时清除，成功插入（包括空格或 Shift 符号）后消耗，
  `maxLength` 拒绝的零字符插入和退格不消耗。
- LayerStack 通过 render 提供的 `suspend`/`restore` 协议通知 input owner：开层时清除 active field、收起键盘并 blur 原生输入；被覆盖的 business-scope 字段拒绝文本、选择与扫码写入。恢复只解除挂起，不隐式恢复旧焦点；弹层自身字段由当前 focus scope 正常写入。input 不反向 import render 以外的业务层；
- surface content 的非输入点击会通过 input owner 主动清理当前 field 并收起键盘；虚拟键盘 dock 是 sibling，
  不把业务按钮或文案变成 input 特例；
- `PrimitiveButton` 在 primitives 内用自身的 `onPressIn`/`onPressOut` 保存局部 pressed 状态并
  提供反馈：普通键透明度变为 `0.78`、动作键变为 `0.72` 并轻微缩放到 `0.985`，同时显示
  integration 提供的主题 focus 边框；释放后恢复普通边框。它只影响当前按键，不触发表单
  字段或整个键盘的额外状态更新。
- `InputSurfaceFrame` 的表面收键盘是被动 touch/click 观察，不参与 responder 协商，因此不会抢
  `ScrollView` 或业务后代的手势；真实输入节点阻断该观察事件。Web 上 `PrimitiveInput` 仍把同一个
  输入边界处理器接到 `onClick`，Android/native 则由 `onPressIn` 与 touch-end 边界共同保持相同语义；
- 所有 virtual field 使用 input edit model 的受控 selection；有原生控件时由 `TextInput` 提供测量与
  可访问挂点，无原生控件时 `inputRef` 为 null 但编辑快照与焦点状态仍由同一模型维护；
- `PrimitiveInput` 的 focus/blur 与通用 `inputRef` 是真实控件接缝，不承载 `inputMode`、业务字段或屏数；
- 焦点进入/键盘高度变化后只向最近的 `InputScrollArea` 请求一次测量与最小滚动；无祖先安全 no-op，
  已收缩 viewport 不重复扣键盘高度；逐字符输入不触发测量；
- 焦点测量缺失/无效，或滚动实际读回后焦点框仍被裁切时，不得把目标 offset 已到达当成可见成功：保留
  字段草稿、清理当前失效的 virtual owner，并显示“焦点框无法完整显示，请调整窗口尺寸或退出输入”。
  只有真实焦点框完整落在 surface 与内部视口的可见交集内才清除该恢复状态；修复尺寸后可重新聚焦；
- 虚拟键盘高度来自 surface root 自身 `onLayout` 的实际尺寸：上限 320、surface 高度比例上限 0.5；
  四种布局按自身行数计算所需高度，外框横向填满 surface 且四角直角；键帽宽度根据最终外框
  的逻辑宽、真实 padding 与 gap 计算。旧内容下限 208 不再作为覆盖模式的容量判据；
  首帧未测量或按轴不可行时不挂不可操作的键盘，并提供可寻址的扩大窗口提示。

## 键盘呈现方式

每个 surface 只有 `InputSurfaceFrame` 呈现一个全宽底部覆盖层。业务字段只声明键盘布局，不持有
keyboard placement，也不得在卡片、字段或弹窗内另挂键盘。所有焦点字段的键盘都覆盖在完整尺寸的
非键盘 UI 上方；焦点避让通过 surface 内容整体平移和既有 `InputScrollArea` 内部滚动完成。

不要把 `VirtualKeyboard` 直接用于 feature，也不要使用已移除的 `constrainToParent` 类布局开关。

滚动输入的 hook 组件必须作为 `InputScrollArea` 后代调用 `useInputField`，例如：

```tsx
const ScrollField = () => {
  const field = useInputField({
    fieldId: 'generic-field',
    testID: 'feature:field',
    keyboardKind: 'virtual',
    layout: 'numeric',
    maxLength: 3,
  });

  return <PrimitiveInput {...field.inputProps} />;
};

const Form = () => (
  <InputScrollArea testID="feature:scroll">
    <ScrollField />
  </InputScrollArea>
);
```

提交动作调用 `useInputSnapshot()` 或该 field result 的 `captureInputSnapshot()`，再由业务 actor 组装命令。input 不替业务判断 required/optional，不读取
`PendingMember`，不生成年龄或其他用户事实。

## 依赖与实现边界

NativeWind 与 React Native Reusables 的展示实现仍由 primitives 持有；本包不暴露 `className`，
feature 生产源码也不得直接 import React Native。`ui-base-input` 只声明实际使用的
`ui-base-primitives` 与 `ui-base-render` workspace dependencies；KBC 不进入本包。

修改公共面时必须同步 `src/index.ts`、`terminal-invariants.json` 与本 README，并运行本包
`typecheck` 与 focused tests。模型红向量与真实树结果分开报告；测试通过不等于 Android/Web 行为
已验证，动态证据必须按平台单独收集。

虚拟键盘 renderer 统一复用 primitives 的 `PrimitiveKeyboardBackdrop`、`PrimitiveKeyboardSurface`、`PrimitiveButton` 与 `PrimitiveIcon`；backdrop 覆盖键盘完整高度但保持透明，surface 沿用 integration 提供的键盘语义色，外框无圆角。普通字符输入只更新当前字段与必要的键帽状态，不向表单广播所有字段值。surface 的 native touch 与 Web click 事件由 input 侧传入，primitive 只做结构化透传，不读取 input controller。
