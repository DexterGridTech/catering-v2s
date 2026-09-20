# `@catering-v2s/ui-base-input`

## 定位

本包提供与 surface 无关的输入能力：字段的局部草稿、同步暂存快照、selection-aware 纯编辑、
虚拟键盘 owner，以及随承载 surface 尺寸计算的虚拟键盘 dock。它不是业务 state、runtime、
command、store 或中文 IME 引擎；本轮所有输入统一走虚拟键盘。

字段使用 `keyboardKind="virtual"` 和既有 `KeyboardLayout`，input 包不读取屏数、不读取
`Dimensions.get('window')`，也不感知业务字段名。无原生控件的字段可设置 `nativeLess`，仍通过
同一个 field registry、`InputController` 和虚拟键盘取得 owner 与焦点，不另起输入管线。

## 公共面

公共面由 `src/index.ts` 与 `terminal-invariants.json` 同步维护：

- `InputSurfaceFrame` 在一个 Provider 内包裹 content，并把虚拟键盘作为 content 下方的 sibling；
- `InputScrollArea` 是唯一的输入滚动祖先适配器，负责把 focus 后的字段滚入已收缩可见区；需要在有界内容区让末尾控件完整滚入视口时，只能通过 presentation-only 的 `contentPaddingBottom` 增加尾部内容 inset，不得另建滚动祖先；
- `InputProvider` 与 `useInputField` 维护 tokenized field registry、focus owner 与同步快照；
- `useInputSnapshot` 在提交动作边界同步读取不可变快照，不订阅编辑值；
- `InputKeyboard` 是业务唯一应使用的键盘呈现入口；它只根据 placement 决定挂在 surface dock 还是调用方的局部布局，状态、owner、按键处理和 `VirtualKeyboard` renderer 始终共用；
- `VirtualKeyboard` 只产生通用编辑 key，不派业务 command，业务不得直接用它拼第二套键盘；
- `InputFieldOptions` 固定使用 `keyboardKind: 'virtual'`，`KeyboardLayout` 描述输入呈现/承载能力；
  frame 尺寸由 `InputSurfaceFrame` 自己的 `onLayout` 读取，不通过公共 `surfaceSize` prop 传入。
- `full`、`alpha`、`numeric`、`financial` 的行列、稳定 keyId 与 region/key `testID` 由
  `src/foundations/keyboardLayout.ts` 唯一维护；键本身仍通过 primitives 的 `PrimitiveButton` 呈现，
  input/feature 不传 `className`。
- 四种布局都把功能键放入连续的键区，不另起空的动作行：full 的 caps 在 home row 起始处，
  shift 在末行起始处，backspace/complete 在末端；alpha 的 shift 在末行起始处。numeric
  与 financial 的前三行都是 `123`、`456`、`789` 三列；numeric 的末端复合区是一行三列，
  依次为 backspace、`0`、complete，且三者都是独立一列；financial 的末端复合区也是
  一行三列，第一列内部左右放 `-/.`，第二列为 `0`，第三列内部左右放 backspace/complete。
  这样每个末行按键保持一行高度，动作键始终在最右侧，且数字列与符号列按 `7/8/9` 对齐。该排列参考 V1 POC 的连续软键盘心智，
  但只保留当前 input contract 已有的 key，不新增 space 或 enter。

值只在字段局部状态和同步 registry 中维护；提交时由消费者调用 `useInputSnapshot()` 或 field result 的 `captureInputSnapshot()`，形成
冻结对象后再交给业务 owner。编辑期不写 kernel slice、uiVariables 或 runtime command。

## 性能与焦点纪律

- 每次输入只更新当前字段和键盘 dock 的局部状态，Provider 不向表单广播所有字段值；
- registry 的 `capture()` 不 `await`，按稳定注册顺序复制并冻结；token cleanup 不会删除同 id 的新实例；
- 同一 surface 始终满足最多一个 virtual keyboard owner；native-less 字段在没有原生 ref 时仍能
  通过 controller 建立 virtual owner。
- virtual 字段在 Android 上收到的 native blur 不单独终止 virtual owner；显式 `blur()`、字段注销、
  layer suspend 或后续字段获焦才是清理 owner 的边界。
- LayerStack 通过 render 提供的 `suspend`/`restore` 协议收起并恢复键盘，input 不反向 import render 以外的业务层；
- surface content 的非输入点击会通过 input owner 主动清理当前 field 并收起键盘；虚拟键盘 dock 是 sibling，
  不把业务按钮或文案变成 input 特例；需要把键盘放进字段/卡片局部布局时仍使用同一个 `InputKeyboard`，不新增 input owner、状态或事件管线；
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
- 虚拟键盘高度来自 surface root 自身 `onLayout` 的实际尺寸：上限 320、比例上限 0.5、内容下限 208；
  首帧未测量或按轴不可行时不挂不可操作的键盘，并提供可寻址的扩大窗口提示。

## 键盘呈现方式

业务只在字段配置中选择位置，并始终复用 `InputKeyboard`。`keyboardPlacement` 与呈现组件的
`placement` 必须相同；不匹配时组件不渲染，避免 surface dock 与局部键盘同时出现。

- `surface`（独立 dock）：省略 `keyboardPlacement` 即使用默认值。`InputSurfaceFrame` 会自动挂载
  `<InputKeyboard placement="surface" />`，业务不再手动放置键盘。
- `field`（局部/非独立 dock）：字段设置 `keyboardPlacement: 'field'`，再在希望出现键盘的
  卡片或字段布局中挂载一次 `<InputKeyboard placement="field" />`。组件自动测量父级宽度并复用
  同一个 provider/controller/renderer；业务不需要传尺寸、重写按键、处理焦点或维护第二份字符串。

不要把 `VirtualKeyboard` 直接用于 feature，也不要使用已移除的 `constrainToParent` 类布局开关。

独立 dock：

```tsx
const field = useInputField({
  fieldId: 'generic-field',
  testID: 'feature:field',
  keyboardKind: 'virtual',
  layout: 'numeric',
  maxLength: 3,
});

return <PrimitiveInput {...field.inputProps} />;
```

局部布局：

```tsx
const field = useInputField({
  fieldId: 'generic-field',
  testID: 'feature:field',
  keyboardKind: 'virtual',
  layout: 'numeric',
  keyboardPlacement: 'field',
});

return (
  <PrimitiveContainer>
    <PrimitiveInput {...field.inputProps} />
    <InputKeyboard placement="field" />
  </PrimitiveContainer>
);
```

业务层只把 `field.inputProps` 交给既有 `PrimitiveInput`，并用 `InputScrollArea` 包住唯一的
滚动内容；提交动作调用 `useInputSnapshot()` 或该 field result 的 `captureInputSnapshot()`，再由业务 actor 组装命令。input 不替业务判断 required/optional，不读取
`PendingMember`，不生成年龄或其他用户事实。

## 依赖与实现边界

NativeWind 与 React Native Reusables 的展示实现仍由 primitives 持有；本包不暴露 `className`，
feature 生产源码也不得直接 import React Native。`ui-base-input` 只声明实际使用的
`ui-base-primitives` 与 `ui-base-render` workspace dependencies；KBC 不进入本包。

修改公共面时必须同步 `src/index.ts`、`terminal-invariants.json` 与本 README，并运行本包
`typecheck` 与 focused tests。模型红向量与真实树结果分开报告；测试通过不等于 Android/Web 行为
已验证，动态证据必须按平台单独收集。

虚拟键盘 renderer 统一复用 primitives 的 `PrimitiveKeyboardBackdrop`、`PrimitiveKeyboardSurface`、`PrimitiveButton` 与 `PrimitiveIcon`；backdrop 覆盖键盘完整高度但保持透明，surface 保持 IA 要求的内缩卡片几何与不透明键盘面。alpha 的 CAPS 是持久锁定键，普通字符输入不触发键盘整体刷新。surface 的 native touch 与 Web click 事件由 input 侧传入，primitive 只做结构化透传，不读取 input controller。
