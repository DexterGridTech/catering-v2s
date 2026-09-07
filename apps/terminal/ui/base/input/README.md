# `@catering-v2s/ui-base-input`

## 定位

本包提供与 surface 无关的输入能力：字段的局部草稿、同步暂存快照、selection-aware 纯编辑、
系统/虚拟键盘 owner 互斥，以及随承载 surface 尺寸计算的虚拟键盘 dock。它不是业务 state、
runtime、command、store 或中文 IME 引擎。

副屏当前不承载系统 IME；副屏字段通过 `keyboardKind="virtual"` 使用本包的虚拟键盘。
主屏中文字段才使用 `keyboardKind="system"`，由 adapter/assembly 的 IME inset contract 提供
系统键盘行为。input 包不读取屏数、不读取 `Dimensions.get('window')`，也不感知业务字段名。

## 公共面

公共面由 `src/index.ts` 与 `terminal-invariants.json` 同步维护：

- `InputSurfaceFrame` 在一个 Provider 内包裹 content，并把虚拟键盘作为 content 下方的 sibling；
- `InputScrollArea` 是唯一的输入滚动祖先适配器，负责把 focus 后的字段滚入已收缩可见区；
- `InputProvider` 与 `useInputField` 维护 tokenized field registry、focus owner 与同步快照；
- `useInputSnapshot` 在提交动作边界同步读取不可变快照，不订阅编辑值；
- `VirtualKeyboard` 只产生通用编辑 key，不派业务 command；
- `KeyboardKind` 与 `KeyboardLayout` 只描述输入呈现/承载能力；frame 尺寸由
  `InputSurfaceFrame` 自己的 `onLayout` 读取，不通过公共 `surfaceSize` prop 传入。
- `full`、`alpha`、`numeric`、`financial` 的行列、稳定 keyId 与 region/key `testID` 由
  `src/model/keyboardLayout.ts` 唯一维护；键本身仍通过 primitives 的 `PrimitiveButton` 呈现，
  input/feature 不传 `className`。

值只在字段局部状态和同步 registry 中维护；提交时由消费者调用 `useInputSnapshot()` 或 field result 的 `captureInputSnapshot()`，形成
冻结对象后再交给业务 owner。编辑期不写 kernel slice、uiVariables 或 runtime command。

## 性能与焦点纪律

- 每次输入只更新当前字段和键盘 dock 的局部状态，Provider 不向表单广播所有字段值；
- registry 的 `capture()` 不 `await`，按稳定注册顺序复制并冻结；token cleanup 不会删除同 id 的新实例；
- system 与 virtual 两条切换路径都先经过 `none`，同一 surface 始终满足最多一个 keyboard owner；
- virtual 字段在 Android 上收到的「因不承载系统 IME 而产生的 native blur」不单独终止
  virtual owner；显式 `blur()`、字段注销、layer suspend 或后续字段获焦才是清理 owner 的边界。
- LayerStack 通过 render 提供的 `suspend`/`restore` 协议收起并恢复键盘，input 不反向 import render 以外的业务层；
- surface content 的非输入点击会通过 input owner 主动清理当前 field 并收起键盘；虚拟键盘 dock 是 sibling，
  不把业务按钮或文案变成 input 特例；
- Web 上 `TextInput` 不会把 RN 的 `onPressIn` 接缝转成可阻断父级 `Pressable` 的事件，因此
  `PrimitiveInput` 仅在存在 Web DOM 时把同一个边界处理器接到 `onClick`；Android/native 不传 Web 事件，
  仍由 `onPressIn` 保持相同的父级收键盘边界；
- virtual field 使用 input edit model 的受控 selection；system field 不受控回写 selection，光标顺序由原生
  `TextInput` 保持，再由 `onSelectionChange` 同步快照；
- `PrimitiveInput` 的 focus/blur 与通用 `inputRef` 是真实控件接缝，不承载 `inputMode`、业务字段或屏数；
- 焦点进入/键盘高度变化后只向最近的 `InputScrollArea` 请求一次测量与最小滚动；无祖先安全 no-op，
  已收缩 viewport 不重复扣键盘高度；逐字符输入不触发测量；
- 虚拟键盘高度来自 surface root 自身 `onLayout` 的实际尺寸：上限 320、比例上限 0.5、内容下限 208；
  首帧未测量或按轴不可行时不挂不可操作的键盘，并提供可寻址的扩大窗口提示。

## 消费方式

```tsx
const field = useInputField({
  fieldId: 'generic-field',
  testID: 'feature:field',
  keyboardKind: 'virtual',
  layout: 'numeric',
  maxLength: 3,
})

return <PrimitiveInput {...field.inputProps} />
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
