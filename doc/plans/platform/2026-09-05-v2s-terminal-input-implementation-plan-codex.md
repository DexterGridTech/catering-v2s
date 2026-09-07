# TER terminal input 实施计划

## 0. 计划元数据与授权边界

```text
PLAN=2026-09-05-v2s-terminal-input
DESIGN=doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md
ANALYSIS_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-analysis-claude.md
SAMPLE_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
INTERACTION_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md
IMPLEMENTATION_AUTHORITY=true
CURRENT_TASK_AUTHORIZATION=CP-0 至 CP-3 源码、测试、依赖同步与 Android/Web 验证
AUTHORIZED_NOW=CP-0 至 CP-3 实施、focused proof、Android/Web 运行验证、逐代码—详设对账、独立实现盲审
NOT_AUTHORIZED_NOW=真实 POS 硬件、UAT、部署、seed、浏览器自动化、§9 比例静态门、Git
PLAN_STATUS=IMPLEMENTATION_AUTHORIZED_CP0_TO_CP3
IMPLEMENTATION_REVIEW_ADMISSION=BLOCKED_UNTIL_CODE_TO_DESIGN_RECONCILIATION_PASS
```

本计划不是源码实施授权。后续实施必须由 Dexter 另行授权，并按 CP 原子推进；任何 stop
condition 命中时停在当前 CP，保留 first failure、last known good、broken boundary，不以
延长 timeout、旧 POC 或“看起来可用”越过。

## 1. 目标与不可变边界

### 1.1 目标

在不把输入草稿提升成 kernel/store 事实的前提下，为终端提供：

- 四种虚拟布局：`full`、`financial`、`numeric`、`alpha`；
- PRIMARY 上的中文字段走系统 IME，数字/金额/拉丁字段走 virtual keyboard；SECONDARY 当前不承载系统 IME，顾客年龄走 virtual keyboard；
- selection-aware 编辑、backspace、shift/caps、complete/next；
- 同一 surface 内 Provider、字段注册、原子提交快照和底部键盘 sibling；
- 主 Activity 的 edge-to-edge IME inset 消费；Presentation 不作为当前系统 IME 承载面，副屏虚拟键盘使用 surface 声明尺寸；
- sample 年龄场景从本地草稿到 `confirmMemberCommand` 的可复核闭环。

### 1.2 不可变边界

1. `ui/base/render` 不 import `ui/base/input`；SurfaceRoot 只提供通用 frame seam。
2. 业务 feature 不 import React Native；所有可呈现 input 仍由 primitives 提供。
3. `PrimitiveInput` 保留既有六项 prop 语义，新增 `selection`、`onSelectionChange`、
   `showSoftInputOnFocus`、`maxLength`，以及为真实 focus/restore/scroll measurement 所需的
   `onFocus`、`onBlur`、`inputRef`；`PrimitiveScrollView` 只增加通用 ref、offset observation
   接缝；不加 `inputMode`。加法及其原因已记录在详设 §5.1a/§5.1b。
4. RNR/NativeWind 的视觉实现不改变 primitives public contract；KBC 本批不进 manifest。
5. 主题不抽到共享 `ui/theme`；本批不建立新的跨 feature 业务控件。
6. 业务 part 不按屏数分支；副屏动作只在已有 assembly/actor 的 `hasSecondarySurface`
   分支中出现。
7. 不建立尚未获 Dexter 裁定的比例静态门，不做浏览器自动化，不宣称 S-12 Web 刷新或
   S-26 浏览器 resize 已被本批取证。

## 2. 方案与顺序

```text
CP-0  主屏 IME inset / 副屏 virtual-input preflight
  ↓
CP-1  SurfaceRoot frame seam + PrimitiveInput contract
  ↓
CP-2  ui/base/input core + virtual keyboard
  ↓
CP-3  sample age journey + system IME wiring + acceptance
```

顺序不是按文件数量，而是按失败代价：先证明主屏系统 IME 的 inset contract 与副屏不依赖系统 IME
的虚拟输入 probe；如果 SurfaceRoot 没有一个同时承载 content/provider/dock
的接缝，input 包会被迫把 render 逻辑复制进去；只有这两项成立后，field registry 和四套
键盘才有稳定宿主。

## 3. CP-0：主屏 IME inset 与副屏虚拟输入前置验证

### 3.1 范围

CP-0 只改/验证 adapter/assembly 侧，不实现 `ui/base/input`：

- 在主 Activity 确认 window root 的 `WindowInsetsCompat.Type.ime()` 消费入口；
- 确认 `applyImmersiveWindow` 的 system bar flags 不会清空或重写 IME snapshot；
- 主屏 snapshot 保留 display/window identity；不把 display 0 的 inset 伪装成副屏能力；
- 在一个受控 probe surface 上验证主屏系统 IME inset，以及副屏不依赖系统 IME 的虚拟按键输入、
  回写和提交回读；
- 用本机实际安装值记录 RN 0.86.3、Expo 57、Android min/compile/target/NDK 组合；
- 不把 `react-native-keyboard-controller` 加入 workspace。若未来重新评估，需另开 spike。

`Keyboard.dismiss()` 的边界：它是应用级调用，不按 React tree/display 隔离。当前安全前提是除
承载输入的 surface 外没有其他 surface 持有 system-keyboard 字段；当前副屏年龄路径只用
virtual keyboard，且副屏不会在输入期间打开 alert layer。未来若副屏增加 system-keyboard 字段，
需另开 scoped keyboard coordination 设计；本批不预建 scope 机制。

### 3.2 具体观察

| 观察 | PASS 条件 | 最低档位 |
|---|---|---|
| 主屏 inset | `Type.ime()` visible/height 在主 window 变化且不改 store | Android focused |
| 副屏虚拟输入 | display 2 的 probe 能在 `showSoftInputOnFocus=false` 下接受虚拟按键、回写一串值并提交读回；不要求 IME visible | Android focused |
| 生命周期 | detach/destroy 后 listener 移除；主屏仍能再次 focus | Android focused + logs |
| KBC 边界 | Web export 已有 PASS；native compile/load 若未形成 PASS，不引入 KBC | static + scratch evidence |

### 3.3 红向量与停止条件

- 红向量：把副屏 probe 改回依赖系统 IME 或移除虚拟按键回写，副屏虚拟输入验收必须失败；
  把主屏 IME snapshot 的 display identity 换成副屏，主屏 inset 对账必须失败；不绑定 cleanup，
  重复 mount 必须暴露 listener/诊断计数异常。
- 停止：主屏系统 IME inset 无法解释消费；副屏虚拟输入无法在同一 host/surface 链上完成回写与
  提交；为了任一能力要新增 host、VM、process、store、MainActivity bootstrap 或 kernel port；
  必须让业务 part 感知 surfaceMode；
  或出现无法解释的启动期错误。
- 若只出现局部主题/context/insets 问题，在同一 carrier 内修；不得退回第二 VM/独立 store。

### 3.4 CP-0 交付

交付一份 run-scoped 证据：版本、命令、log path、first failure/last known good、主屏 IME
snapshot、副屏虚拟输入值、提交回读和 cleanup。CP-0 必须先构造并运行一个不依赖 input 包的
临时 probe surface（主屏至少含真实 RN `TextInput`；副屏含 `showSoftInputOnFocus=false`
的 direct input 与临时虚拟按键）；当前 sample 没有输入控件不是降级理由。若 probe surface
无法构造、启动或挂到目标 root，立即停机交 Dexter；若主屏 IME inset、虚拟按键回写或提交
回读任一失败，同样停机。副屏系统 IME hidden 是本产品预期，不得作为失败或放行依据。
这里的副屏 IME 结论必须按可复核事实记录：Android 的 IME display policy 受 WindowManager
控制，普通应用没有为 Presentation 开启该策略所需的系统权限；本产品也有意不开启它，
因为系统 IME 的工具条会破坏沉浸式 kiosk 边界，而副屏唯一输入是年龄数字，不需要中文
system-keyboard。探针若观察到副屏 IME hidden，应原样记为 `FIRST_FAILURE`/事实边界，
不能改写成 PASS，也不能为此增加 adb 配置、权限或应用内兼容层。
探针完成后必须恢复生产 App、删除临时代码与临时日志接线，再进入 CP-1。

## 4. CP-1：SurfaceRoot frame seam 与 PrimitiveInput 契约

### 4.1 SurfaceRoot

在 `apps/terminal/ui/base/render/src/types/props.ts` 增加窄的
`SurfaceRootContentFrame` 与可选 `renderContentFrame`；在
`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx` 让默认路径保持现有行为：

```text
SurfaceContext.Provider
└─ root View
   └─ frame({content: children + ScreenContainer + LayerStack}) 或 content
      └─ content area (flex:1)
```

`ui-base-render` 只生成 content 并调用 callback，不 import input。sample-console assembly
将 input frame 作为 consumer，形成：

```text
InputProvider
└─ flex root
   ├─ content (flex:1)                 ← children + ScreenContainer + LayerStack
   └─ KeyboardDock (bottom sibling)
```

不引入两个相互独立的 content/bottom props，不把 children 改成函数。

Layer focus 协议也在 CP-1 落位：render 提供业务无关的
`SurfaceFocusBoundaryContext`（listener 只接收 `suspend`/`restore` 两个 phase），InputProvider 在 frame
内提供 listener，LayerStack 只发通知并继续拥有 native focus 的保存/恢复。打开层时先
`suspend`、清 active field 并 dismiss 两类键盘，再把焦点移到 layer；关闭最后一层时先
`restore` 解除 input 的 focus 抑制，再恢复原 native focus。render 不 import input，input
通过既有单向依赖消费该协议。

### 4.2 PrimitiveInput

在 `apps/terminal/ui/base/primitives/src/components.tsx` 及其 public/invariants/README/test
同步四个编辑/呈现 prop：selection、onSelectionChange、showSoftInputOnFocus、maxLength，及
详设 §5.1a 授权的 `onFocus`、`onBlur`、`inputRef` focus seam。
`PrimitiveInput` 继续在唯一的 `assertTestID` 路径上把 testID 挂真实 input 节点；不加
`inputMode`、业务字段、keyboard layout、command 或 store prop。

### 4.3 CP-1 判据

| 判据 | 实施证明 | 红向量 |
|---|---|---|
| 默认 SurfaceRoot 不变 | 现有 render focused test 全绿 | 移除 callback 时 content/ScreenContainer/LayerStack 结构变化 |
| frame contract | tree test 断言 Provider ancestry、content flex sibling、content 内 LayerStack、dock sibling、layer focus boundary 通知 | 将 LayerStack 留在未收缩 root、把 dock 放 overlay、遗漏 suspend/restore 或另建 Provider，tree test/transition test 必红 |
| PrimitiveInput | typecheck + focused pass-through/ref test | 删除任一新 prop 或 focus/ref seam 的透传，测试/类型断言必红 |
| 输入边界 | feature 生产源码零 RN import/className，input 只经 primitives | feature 直接 import RN 或 `className` 必红 |

CP-1 未完成前不得写 input keyboard implementation。若为保持现有调用点需要破坏性
SurfaceRoot API，停在 CP-1 重新裁定，不加兼容层。

## 5. CP-2：input 核心与虚拟键盘

### 5.1 文件/模块落点

预期新增/修改范围，以开工前枚举为准：

- `apps/terminal/ui/base/input/src/index.ts`
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`
- `apps/terminal/ui/base/input/src/components/InputProvider.tsx`
- `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx`
- `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx`
- `apps/terminal/ui/base/input/src/hooks/useInputField.ts`
- `apps/terminal/ui/base/input/src/model/editText.ts`
- `apps/terminal/ui/base/input/src/model/snapshot.ts`
- `apps/terminal/ui/base/input/src/model/keyboardHeight.ts`
- `apps/terminal/ui/base/input/test/`
- `apps/terminal/ui/base/input/README.md`、`terminal-invariants.json`、dependencies/package.json

实施前要先核当前空壳 export/invariant，不手改 generated/manifest 之外的无关包。

### 5.2 field registry 与 snapshot

实施次序：

1. 先写纯函数/模型测试：selection normalization、insert、backspace、shift/caps、maxLength、
   complete target；不得先写业务组件。
2. 写 tokenized register/unregister：同 id 双挂载抛错；旧 token 不能删新记录。
3. 写同步 `captureInputSnapshot`：复制 ref registry，freeze，不能 await，不能读 React closure；
   通过 `useInputSnapshot` 暴露给跨字段的提交消费者。
4. 将 `useInputField` 接到 PrimitiveInput；用真实 `onFocus`/`onBlur` 事件决定 owner，用
   `inputRef` 执行 focus-next 与 restore；每个 field 自己更新，form container 不订阅所有值。
5. 接 virtual keyboard：只调用编辑器/field update，不 dispatch runtime command。
6. 接 focus-next/last-field complete；最后字段只执行 close-only/clear-focus，不 submit、不
   confirm、不派任何业务 command。业务提交只能来自用户点击批准的提交/确认动作。

### 5.3 keyboard height

将公式固化为纯函数并用表驱动测试：

```text
candidate = min(320, floor(surface.height * 0.5), surface.height - 208)
height    = max(0, candidate)
visible   = height >= 250
```

必须锁定 sample 的 `PRIMARY 1157×723 → 320` 与 `SECONDARY 962×541 → 270`；同一 surface
四种 layout 都返回同一 height。不能调用 `Dimensions.get`/window measurement，不能按
`displayMode` 在部件内分支。

键盘 frame 只在 `visible` 时出现；若内容不足，保留 field 语义、保留决策动作、报告
`contentTooSmall`，不显示一个不可操作的键盘。

### 5.4 scroll/focus

`PrimitiveScrollView` 是唯一允许的 input feature 滚动祖先，`InputScrollArea` 只负责把它接入
input 的内部 context；focused input 进入可见区域的
逻辑在 input layer，详设锚点为 input 详设 §7.3。触发点是字段 focus、active field 切换、
keyboard dock 高度变化与 per-window IME inset 变化，逐字符输入不触发；测量发生在 layout
提交后。若没有 scrollable ancestor 则安全 no-op。不得引入第二个滚动祖先或靠 window resize
推断 scroll amount；必须用收缩后的可见 bottom 计算最小滚动量，使字段完整可见；若测量坐标
已经是收缩后的 scroll viewport，不得再次扣除 keyboard height。

### 5.5 CP-2 判据与红向量

| 判据 | 最低证明 | 红向量 |
|---|---|---|
| snapshot 原子性 | register/change/capture/unregister focused test | capture 中加入 await 或改从 React state closure 读值 |
| stale cleanup 安全 | mount A → mount B → cleanup A focused test | unregister 只按 fieldId 删除 |
| 局部重渲染 | 多 field render counters；字段只订阅不含 revision/按键编辑状态的 field keyboard context；`VirtualKeyboard` key handler identity focused proof | 所有 fields 订阅完整 provider value，或普通字符导致 key handler identity 改变/键盘树重建 |
| 编辑正确 | pure model test 覆盖 selection/backspace/limit/complete；真实 virtual complete key 覆盖非末字段 focus-next 与末字段 close-only | 只 append、忽略 selection，或真实 complete 不推进/末字段仍保持键盘 |
| keyboard 高度 | formula table + component tree | 用 `Dimensions`、按 layout/screen 分支或无上限 |
| S-36 焦点可见 | `InputSurfaceFrame + InputScrollArea + useInputField` 真实树与 host geometry mock 断言 `measureInWindow→scrollTo`；另测无祖先 no-op；Web/Android layout evidence 单列 | 删除 `InputScrollArea` 的 scroll 调用、让 content 不收缩或遮住 age field |
| keyboard owner 互斥 | system↔virtual 双向 transition focused test，并 spy `Keyboard.dismiss()`；生产树仍分平台报告真实 IME | 省略任一方向的先清 owner 步骤或只测单向转移 |
| no dead state | min height + typed `contentTooSmall` + decision action focused test | keyboard 显示但 action 被盖/disabled，或把容量不足伪装成可输入 |
| no per-key command | static import/call path + focused spy | key handler 直接 dispatch command 或 serialize whole runtime |

PF-1…PF-6 绿不能单独写成性能达标；至少要补 PF-7 连打 20 字符与 PF-8 无同步重活。
如 PF-7 反复争议，再由 Dexter 授权新增 measured frame/latency 基建；本批不预建。

## 6. CP-3：sample 年龄场景与双屏闭环

### 6.1 契约同步

开工前用同一清单重扫：

- sample requirements §4.5.3 的 `Member.age?: number`；
- `confirmMemberCommand` 的可选 age payload；
- confirm actor 读取/规范化 age 写入 `Member.age`；
- `PendingMember` 与 `confirmPending` reducer 不改；
- customer-member 的 `age` testID、hand-back testID、三种 mode；
- S-30…S-39 和 `hasSecondarySurface` 分支；
- 交互设计中 waiting-confirm layer、registry-notice retry/abandon、system notice 归属。

任何一项旧字段/旧动作仍在代码或 focused fixture 中，先同步 owner，再接 input。

### 6.2 system IME wiring

在 CP-0 owner 接口闭合后，assembly 只把当前 surface size/inset contract 交给
`InputSurfaceFrame`。feature 不感知 WindowInsets、Presentation、KBC 或 screen count。
系统输入切换前 dismiss；中文字段使用 system；年龄/电话根据批准场景使用 virtual
numeric/alpha，不在 feature 内复制 keyboard。

### 6.3 actor/action

- member-form 的 submit handler 在动作触发时只 capture 姓名/电话 snapshot，派
  `submitMemberCommand({name, phone})`；不从 `PendingMember` 或 React render 反读编辑中的值；
- customer-member 的 confirm handler 在顾客点击确认时 capture age snapshot，派
  `confirmMemberCommand({age?: number})`；
- submit actor 不读取 age；只有 confirm actor 读取并规范化可选 age，再写入 owner；
- confirmPending reducer/PendingMember 保持冻结；
- system failure 的 retry/abandon/dismiss 仍按 feature owner，旧 member-desk
  `noticeDismissedCommand` 不复用；rejection 之后保留 registry owner 的 `PendingMember`
  供 retry 读取，只有 registry-notice 的 abandon 路径派发 owner 的
  `withdrawMemberCommand` 清理 pending。这里是为同时满足既定「reject 后修改后重试回填」
  与「放弃后清除待登记事实」两条业务语义而作的最小闭合，详设 §11.1 item 5 已记录原因，
  不把本地表单草稿写入 runtime store；
- `registryMemberWithdrawnCommand` 在双屏确认层路径必须同时关闭 `withdraw-confirm` 与
  `waiting-confirm`、将 SECONDARY 回 `customer-welcome`、将 PRIMARY 回表单；单屏 hand-back
  没有确认层时只回 PRIMARY 表单，双屏无确认层的直接命令保持 no-op。该接缝由详设 §11.1
  item 6 记录，并由 CP-3 assembly focused test 固定；
- 副屏动作全部由 `hasSecondarySurface`/其派生布尔守护；单屏下不存在 SECONDARY 列。

### 6.4 CP-3 判据、红向量与运行顺序

1. focused：age maxLength、name/phone snapshot→submit、customer age snapshot→confirm actor、optional semantics；
2. focused：逐字按 sample requirements §9.2 覆盖 S-30…S-39；其中 S-36 必须是真实布局/焦点
   可见性，不得用纯公式测试替代；S-38 必须验证撤回后的副屏回 welcome、后续确认无登记、store 无年龄残留；
3. focused：单屏 `handheld-confirm`、双屏 customer member、waiting-confirm、registry notice；
4. Android：主屏真实 system-IME/inset；副屏真实 virtual-input focus、按键回写与提交；
5. Web：固定 terminal surface 画布、输入局部更新、四种 layout；
6. cleanup：停止 Web/Android 受管进程并分开报告业务与 cleanup。

红向量：去掉 age payload、让 actor 自行生成 age、恢复 PendingMember 字段、让单屏 part
按屏数分支、把副屏动作移出 guard、把中文 virtual 化、让系统 IME 走 `adjustResize` 而
不消费 inset、移除任一方向的 keyboard-owner 清理、移除焦点滚入可见区、或让撤回后的
顾客确认继续登记，均必须在对应 focused/static/Android 证据中失败。

若主屏 system-IME/inset 或副屏 virtual-input 在 CP-0 不成立，停，不用隐藏字段、第二 VM 或
独立 store 绕过；副屏 Presentation 的 system-IME 不属于当前停止条件。

## 7. 每段停止条件与报告口径

### CP-0 停止条件

- 无法在同一 ReactHost/ReactSurface 上完成副屏虚拟输入回写与提交；
- 主屏 system-IME inset 无法被同一 adapter/assembly owner 解释消费；
- 需要 MainActivity/assembly bootstrap、第二 host/VM/process/store 或 kernel port；
- inset owner 与 `applyImmersiveWindow` 互相覆盖且没有不改需求的窄修复。

### CP-1 停止条件

- SurfaceRoot frame 只能靠 render import input；
- 旧调用点必须破坏性迁移；
- PrimitiveInput 必须接受 inputMode 或业务 props 才能完成需求。

### CP-2 停止条件

- 提交只能从 store/业务 slice 获取编辑值；
- 键盘每键 dispatch 或全树重渲染不可避免；
- 高度必须依赖屏数/window 或不同 layout 不可统一；
- min content 下不能同时保留字段语义与决策动作。

### CP-3 停止条件

- age 链在 submit/confirm 任一 owner 断开；
- 出现焦点存在但不能输入也不能继续的状态；
- 任一副屏动作在无 secondary 时仍渲染/触发；
- failure/rejection 重新静默或 loading 被提前清掉。

## 8. 验证矩阵

| 维度 | 证据 | 结果必须如何表述 |
|---|---|---|
| 静态 | package/import/public export/dependency/typecheck | 只能说明源码/契约形态 |
| focused | edit/snapshot/height/render/actor tests | 只能说明被测试的行为 |
| Web | Expo start/export + 体验 | 不能升级为 Android/刷新/resize 证据 |
| Android | 双屏模拟器 logs、dumpsys、屏幕/输入结果 | 写“在双屏 Android 模拟器验证，未在真实 POS 硬件验证” |
| model red | 夹具/变异破坏已通过模型 | 写“门能抓到该形态”，不等同真实树失败 |
| cleanup | PID/log/process tree | business 与 cleanup 分开；cleanup 非 PASS 不收口 |

仍未取证的既有边界：S-12 Web 刷新需要真实浏览器新 JS context；S-26 第一项需要浏览器
resize 与布局，不由 react-test-renderer 或本计划的 focused test 冒充。

## 9. 实施后逐代码—详设对账（交付 review 前的硬闸门）

这一步不是“看 diff 大致像不像”，也不是用 typecheck、focused test 或静态门代替语义对账。
CP-0 至 CP-3 的实施与各自 focused proof 完成后，主 agent 必须按本节固定分母重开实际生产
源码，并逐项对照本详设、冻结需求、sample 交互设计和项目记忆中的适用规则。

### 9.1 固定代码全集

实施前先把以下路径按当前字节枚举，新增路径也必须加入清单；“没有该文件”要记录为
`N/A_WITH_REASON`，不能用猜测补齐：

| 代码组 | 必对账路径/范围 | owning design |
|---|---|---|
| input package | `apps/terminal/ui/base/input/src/**`、`package.json`、`src/dependencies.ts`、`terminal-invariants.json`、`README.md`、`test/**` | 本详设 §5、§6、§7.2、§7.3、§7.4、§12 |
| render seam | `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`、`src/contexts/SurfaceFocusBoundaryContext.tsx`、`src/types/props.ts`、`src/index.ts`、`test/**`、README/invariants | 本详设 §4.1、§4.3、计划 CP-1 |
| primitive contract | `apps/terminal/ui/base/primitives/src/components.tsx`、`src/index.ts`、test、README/invariants | 本详设 §5.1、计划 CP-1 |
| integration assembly | `apps/terminal/ui/integration/sample-console/src/assembly.tsx`、`src/terminalSurfaces.ts`、package/config、focused test | 本详设 §4.2、§7、计划 CP-3 |
| Android IME owner | `apps/terminal/adapter/android/dual-screen/android/src/**` 中 ActivityHandler、Primary IME coordinator 及其 test/readme；Presentation 只保留 surface 生命周期 | 本详设 §8、计划 CP-0 |
| member feature | `apps/terminal/ui/feature/sample-member-desk/src/**`、test、README/invariants/dependencies | 本详设 §10、计划 CP-3 |
| registry owner | `apps/terminal/kernel/feature/sample-member-registry/src/**`、test、README/invariants | 本详设 §10、sample requirements §4.5.3 |

### 9.2 逐项对账维度

每个生产组件、actor、command、adapter listener、公共 export 和测试夹具至少填写一行
对账表，维度不得合并省略：

| 维度 | 必答问题 | 证据档位 |
|---|---|---|
| behavior | 输入、提交、确认、撤回、失败、恢复是否与详设逐条一致 | focused/Android |
| shape | SurfaceRoot content/LayerStack/dock 树形、控件 props、snapshot 形状是否一致 | static/focused |
| actions | complete：非末字段推进焦点、末字段 close-only 且不提交；submit/confirm 是否唯一派命令；notice 出口是否正确 | focused |
| relationships | render/input/feature/kernel/adapter 依赖方向是否一致；无反向 import | static |
| placement | 键盘是否在承载输入的 surface；LayerStack 是否在收缩 content 内；焦点输入是否滚入收缩后的可见区；副屏动作是否受 guard | focused/Android |
| user-visible copy | 当前代码文案与 interaction design 的 screen/layer 文案逐项相等 | source review/focused |
| limits | maxLength=3、layout 集合、208/250/320/0.5、same-surface 高度是否落地 | focused/table |
| state/control | 编辑值不进 store；Pending/reducer 不改；loading、focus、optional age 语义不漂移 | focused |
| failure/recovery | rejection/resolved failure、IME too-small、撤回竞态是否有可区别结果且不静默 | focused/Android |
| accessibility/focus | testID 在真实动作节点；focus、selection、back、hand-back；layer 打开先 suspend、关闭后随实际 focus restore 恢复 keyboard owner | focused/Android |
| data/invalidation | snapshot 读 ref；submit/confirm owner 读取正确 payload；无陈旧 closure/跨屏镜像 | focused/static |

### 9.3 对账执行顺序与硬结果

1. 先逐 CP 回读，使用实施前保存的同一组源路径和锚点；不得只读改动文件。
2. 再做全批跨 CP 对账，特别查 SurfaceRoot→InputSurfaceFrame→feature→actor 的完整链，
   以及主 Activity 的 IME inset 链与 Presentation 的 virtual-input focus 链。
3. 对每个断言保留 `design anchor → code anchor → proof output → MATCHED/OPEN`；行号不是
   稳定锚点，使用唯一 symbol/文本锚点。
4. 任一 `OPEN`、代码与详设不一致、缺少 red vector、生产树结果与模型结果混写，均为
   `RECONCILIATION=FAIL`；主 agent 必须修代码/测试/详设中的正确 owner 后重新对账。
5. 只有所有行 `MATCHED`、focused/typecheck/static/动态证据各自分档、business 与 cleanup
   都 PASS，才能写 `RECONCILIATION=PASS`，并生成给 Dexter/Claude 的实施 review brief。
6. `RECONCILIATION=PASS` 之前，不得交付“实施完成”、不得邀请 Claude 做实施结果 review，
   也不得用本计划的设计 review 代替代码—详设对账。

当前文档阶段的状态固定为：

```text
CODE_TO_DESIGN_RECONCILIATION=BLOCKED_UNTIL_IMPLEMENTATION
IMPLEMENTATION_REVIEW_ADMISSION=BLOCKED
```

这不是把未实施误报成失败，而是明确说明当前尚无可逐代码验收的 input 生产实现。

## 10. 设计阶段自验与 review 输入

本批详设自验完成项：

- 已回答 SurfaceRoot API、snapshot/registry/race、keyboard formula/values、notice command、
  PrimitiveInput maxLength/inputMode；
- 已给出 KBC Web export PASS、Android autolinking PASS、native build boundary，以及
  Presentation 系统 IME 不作为当前能力、副屏虚拟输入由 CP-0 实跑证明的边界；
- 已把 IME coordinator 放在 adapter/assembly，并把它排在 input 实施之前；
- 已列每个 CP 的 stop condition、focused/red vector；未建立比例静态门；
- 未修改任何源码、依赖、测试、Android 文件、运行配置或用户体验文件。

交 Dexter 与 Claude review 时，要求 reviewer 特别复核：

1. frame render prop 是否确实能让 Provider 同时覆盖 content subtree 与 keyboard sibling，且 LayerStack 位于可收缩 content 内，随键盘出现按变矮可用区重排，同时 overlay/guard/back/focus 语义不被破坏；
2. snapshot 的 JS-turn 胜者规则是否足以防 submit/unmount 过期闭包；
3. layer open/close 时 `SurfaceFocusBoundaryContext` 的 suspend/restore 顺序、active field 清理与
   keyboard owner 恢复是否有明确 winner；
4. `208/250/320/0.5` 是否能由当前 PRIMARY/SECONDARY 和 S-36/S-37 支撑，且 S-36 是否验证了
   真实焦点滚入可见区而非只验证公式；
5. S-30…S-39 是否逐条与 sample requirements §9.2 同编号、同语义，尤其 S-38 是否包含三段撤回断言；
6. system↔virtual 两个方向是否都先经过 `none`，且任一时刻最多一个 keyboard owner 可见；
7. KBC 与 adapter flag/inset ownership 的证据是否被准确降级；
8. CP-0 是否已把副屏真实虚拟输入的 focus/write/submit 证明与 Presentation 系统 IME 的非能力边界分开；
   age field 接入后只做业务复验，不得把虚拟输入证据升级成系统 IME 支持；
9. CP-0 是否真的先于 input package 实施，且 probe surface 无法构造时是否立即停机而非放行。

## 11. 交付闸门

```text
DESIGN_DELIVERABLES=implementation-design + implementation-plan
IMPLEMENTATION_AUTHORITY=false
FRESH_INDEPENDENT_REVIEW_REQUIRED=true
REVIEW_TARGET=DESIGN
L2_SCRIPT_ADMISSION=BLOCKED
RATIO_STATIC_GATE=NOT_BUILT_PENDING_DEXTER_DECISION
NEXT=等待 Dexter/Claude 对详设与计划的 review，未获实施授权前不改源码
```
