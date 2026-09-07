# TER Terminal 输入承载形态与虚拟键盘 v2 详设

> STATUS: IMPLEMENTATION_READY_FOR_EXTERNAL_REVIEW
> IMPLEMENTATION_AUTHORITY: true
> REVIEW_TARGET: IMPLEMENTATION
> DESIGN_REVIEW_CYCLE_ID: TERMINAL_INPUT_V2_DESIGN_2026-09-06
> IMPLEMENTATION_ADMISSION: ADMITTED_BY_DEXTER

## 0. 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md; doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md; doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md; doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md
JOURNEY_REFS=sample-staff-auth; sample-member-desk; customer-member; FORM-1..FORM-5; KEY-R1..KEY-R9
IA_REF=本文件 §10 IA/交互矩阵；ia-design-template.md 的可见/不可见维度
INTERACTION_REF=doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md
AUTHORIZED=Dexter 已授权按本详设与实施计划完成 CP-0..CP-6；交付前必须完成两类对账
NOT_AUTHORIZED=不改 App 方向锁/拓扑/设备策略，不运行真实 POS/DEV/seed/UAT/部署，不执行 Git；Web/Android 动态证据仍按计划授权边界分档
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_ADMISSION=ADMITTED_BY_DEXTER
```

本详设的实施输入是两份已收口需求。本文规定将来实施时每一条代码如何与设计逐条比较，
但不把“设计已写完”表述成“实现已完成”。副屏系统 IME 仍按产品决定关闭；副屏虚拟键盘
是本批要实现的输入路径。

判据住址明确如下：`S-30..S-39`（含本详设引用的 `S-36/S-37/S-38/S-39`）来自
`doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`
第 9.2 节；`PF-1..PF-8` 来自
`doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md` 第 6 节。
两份 2026-09-06 v2 文档引用这些判据但不另造编号；若上游正本改变编号或语义，必须先
停止实施并同步修订本详设与计划，不得凭 review 摘要猜测。

## 1. 真实业务目标与方案比较

### 1.1 结构性问题

当前 `InputSurfaceFrame` 接收 `terminalSurfaces` 的静态尺寸，导致同一套输入能力不能知道
它实际占据的 PRIMARY、SECONDARY、Web 响应式盒子或竖屏 View 的尺寸。结果不是单纯的视觉不一致，
而是键盘几何、可见性、命中区域、焦点滚入和副屏/竖屏拓扑共同失去可信输入。

本批要保持的业务事实是：店员登录仍使用 full，会员资料中电话/年龄仍使用 numeric；
新增的 alpha 与 financial 只作为 `MemberForm` 的 sample-only 能力验证字段，不进入
`Member`、`PendingMember`、`submitMemberCommand`、dirty 判定或顾客确认路径。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 继续把 `terminalSurfaces` 静态尺寸传入 input，按固定逻辑画布缩放 | Presentation 和 Web 都会把别的尺寸当成本地尺寸；transform 前的命中尺寸不能证明触控面积 | 拒绝：不能解决根因 |
| B. 在 input 中读取 `Dimensions`、`useWindowDimensions`、设备类型或 `Platform.OS` | 这些是应用/宿主级事实，Presentation 中不能保证代表当前 surface；设备分类也不能表达窄 Web 窗口 | 拒绝：跨 surface 错位且反向依赖环境 |
| C. `InputSurfaceFrame` 自己在真实交互根 View 上 `onLayout`，既有 Android 宿主只提供 `imeInset`，Web 去除交互祖先 transform，键盘布局数据化 | 每个 surface 有本地宽高，input 不拥有宿主拓扑，视觉与命中区域可被同一事实验证 | **采用** |

我选了 C 而不是 A/B，因为 C 直接读取造成错误的事实边界，同时不把屏数、设备类别或
业务字段引入 `ui/base/input`。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | input 与既有 Android carrier 的边界 | `InputSurfaceFrame`、assembly 的 `imeInset` bridge | 不改方向锁、拓扑或设备策略；input 只消费既有 `imeInset` | 既有 Android carrier、input local onLayout |
| CP-1 | 本地测量与容量状态 | `InputSurfaceFrame`、`InputProvider`、`keyboardHeight` | 去掉静态 `surfaceSize` 公共入口；onLayout 驱动尺寸、首帧安全、按轴可行性 | `SurfaceRoot.renderContentFrame`、`imeInset` |
| CP-2 | 四种虚拟键盘与交互 | `keyboardLayout`、`VirtualKeyboard`、`InputProvider`、`useInputField` | full/alpha/numeric/financial 数据形态、dense token、region/key testID、互斥焦点、滚入可见区 | CP-1 capacity、既有 edit/snapshot/scroll 模型 |
| CP-3 | sample 消费者与 Web 交互盒 | `MemberForm`、`testExpoApp.SurfaceCanvas`、`sample-console assembly` | 两个 sample-only 探针、竖屏真实业务矩阵、无 transform 交互树、assembly 不穿静态尺寸 | CP-1、CP-2、形态需求 |
| CP-4 | focused/static 验证与模型红向量 | input/primitives/sample/adapter 各自测试与 typecheck | 真实焦点/容量/业务边界证据；模型红与生产树结果分开 | CP-0..CP-3 |
| CP-5 | 全批三维对账与逐代码对账 | 主 agent；fresh 独立子 agent 只读复核 | 阶段/整体三维对账；代码↔详设逐行记录；交付 brief | CP-4 完成，且所有 OPEN 已修复 |

## 3. 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时必须符合的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | N/A：本批无 HTTP/owner 读授权；组件只读本地注册表 | [静态] 无新增 edge/HTTP import | 不引入新的服务读取 | input snapshot registry、sample 表单 |
| 写授权与 grant 复核 | N/A：无服务端写 | [focused] 业务探针字段不进入 command | 不得把 sample-only 值写入业务模型 | `MemberForm` 四个输入字段；真实提交仅姓名/电话 |
| 跨 owner 写与事务 | N/A：无跨 owner 持久化 | [静态] 命令调用面无新增跨 feature import | 保持 feature actor/command owner | `submitMemberCommand`、`confirmMemberCommand` 不改契约语义 |
| 集合形态与分页 | N/A：输入字段注册表是 bounded local map，不是业务集合 | [focused] 注册/注销后快照只含 live 字段 | token 比对注销，不能遍历业务列表推断字段 | `InputSnapshot` live registry |
| 缓存失效 / 改完刷新什么 | N/A：无远程缓存 | [focused] layout 重测只重新计算 geometry，不清业务值 | 尺寸变化不得丢输入值/selection | `InputProvider` metrics、`MemberForm` draft |
| RTK 数据读取与加载判定 | N/A：本批不使用 RTK | [静态] 新增代码无 RTK 读侧 | 不把输入快照复制为服务器缓存 | input/sample 变更全集 |
| 同一事实只有一个住址 | `snapshot.ts` 的 live registry 是编辑期事实；业务 command 是提交边界事实 | [focused] capture 同步冻结；sample-only 无业务消费 | 不增加第二个编辑值 store；不从 DOM 反读 | value/selection/registration、`Member`/command |
| 失败可见且原因不得改写 | `InputCapacityState` 与现有 typed edit/command 结果；`SurfaceRoot` layer 由 render owner 管理 | [focused] unmeasured/width/height/axis 不可行各有可观察状态 | 不静默隐藏必填输入；不伪造 submit 成功 | `unmeasured`、`unsupported-width`、`unsupported-height`、`unsupported-horizontal` |
| owner 错误到 HTTP 的映射与注册处 | N/A：无 HTTP | N/A | 不新建 problem code | — |
| 幂等键构成与重放语义 | N/A：本批没有服务命令写 | [静态] 不新增幂等 API | 不把 input event 当远程 command | — |
| 该用生成物的地方不得手搓字符串 | `terminalSurfaces` 保留为已有 package 元数据，input 不读取；testID 由 input 常量集中定义 | [静态] 搜索没有复制 terminal surface 数值；key/region ID 来自布局定义 | 业务不得散写键盘 testID；不引入生成字符串替代源 | `VirtualKeyboard`、`testExpoApp`、assembly |
| 日志落点与脱敏字段 | `AGENTS.md` 与 observability standard；adapter 记录 topology/count，不记录输入值 | [静态] 搜索日志参数不含姓名、手机号、密码、原始键值 | 只记阶段、orientation、actual/effective displayCount、capacity 状态 | handler topology、测试 run manifest；禁止 password/raw payload |
| 迁移回填与可逆性 | N/A：无数据库/迁移 | N/A | 不产生 migration/seed | — |
| 前端共享行为(Drawer/列表/表单生命周期) | `SurfaceRoot.renderContentFrame`、`LayerStack`、`SurfaceFocusBoundaryContext`、`InputScrollArea` | [focused] layer suspend/restore、scroll ancestor、focus restore | render 不 import input；input 只消费 boundary context | render/input/sample integration |
| 候选/下拉数据源 | N/A：无候选/下拉 | N/A | 不添加 IME 候选栏 | — |
| 编码与名称呈现 | 现有 `KeyboardLayout` 类型、feature fieldId/testID 常量 | [静态] 四布局名称和 sample-only 文案逐项一致 | 能力命名，不把 alpha/financial 变成业务字段 | full/alpha/numeric/financial |
| 会同时坏的东西是否已声明为原子组 | `InputSurfaceFrame` + provider + keyboard + scroll + sample/Web surface | [阶段对账] CP 完成后逐条 MATCHED/OPEN | API、测量、容量、焦点和 Web 命中不允许拆成半套 | CP-0..CP-5 全范围 |

### 3a. UI/testID 前置复核

```text
UI_DESIGN_REVIEW=PASS:本轮完成 design-only 的 surface/action/focus/文案盘点，不宣称运行通过
TESTID_REVIEW=PASS:本轮冻结 base 与 sample action 节点的 testID contract，不宣称 L2 binding 已验证
L2_SCRIPT_ADMISSION=BLOCKED
```

本轮 design-only 分母如下；真实节点尚未实现，故最后一列是“待实施观察”而不是运行证据：

| case/action | 设计控件 | 设计 owner/testID source | 实际动作节点 | 本轮结论 |
| --- | --- | --- | --- | --- |
| MemberForm alpha probe focus/edit | `英文字符测试（仅 sample）` input | `MemberForm` fieldId/testID 固定值 | `PrimitiveInput` 实际 input 节点 | `MATCHED`（设计契约；实施后复核） |
| MemberForm financial probe focus/edit | `金额格式测试（仅 sample）` input | `MemberForm` fieldId/testID 固定值 | `PrimitiveInput` 实际 input 节点 | `MATCHED`（设计契约；实施后复核） |
| virtual keyboard regions | letters/digits/symbols/actions | `VirtualKeyboard` §4.4 region IDs | region View 下真实 `PrimitiveButton` | `MATCHED`（设计契约；实施后复核） |
| virtual keyboard key action | text/action key | `KeyboardKeyDefinition.keyId` → §4.4 key ID | 真实 `PrimitiveButton`，不得是外层 wrapper | `MATCHED`（设计契约；实施后复核） |

将来 CP-3/CP-4 若获得 L2/浏览器授权，必须在写 binding 前重新打开四份需求/判据正本、
本文 §4.4、真实 sample 组件与 `testExpoApp`，并把上述每行替换为真实节点证据；
本节不能替代实施后的真实控件盘点。

## 4. 精确实现设计

### 4.1 `SurfaceRoot` 与输入 frame 的树形接缝

`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx` 当前以唯一的
`renderContentFrame={({content}) => ...}` 接缝把 `content` 包在外层。该接缝保持不变，
`ui/base/render` 不 import input。assembly 的组合形态固定为：

```tsx
<SurfaceRoot
  renderContentFrame={({content}) => (
    <InputSurfaceFrame imeInset={surfaceImeInset}>
      {content}
    </InputSurfaceFrame>
  )}
>
  {screenAndBusinessChildren}
</SurfaceRoot>
```

将来代码中 `InputSurfaceFrame` 的根树必须是以下结构，名称是对账锚点，不允许另造第二个
交互 frame：

```text
View testID=ui.base.input:surface-frame onLayout=handleSurfaceLayout
└─ InputProvider (包住内容区交互树与 VirtualKeyboard)
   ├─ Pressable testID=ui.base.input:surface-content onPress=dismissActiveField
   │  └─ content (SurfaceRoot 已构造的 content subtree)
   └─ VirtualKeyboard (仅 capacity=supported 且 active virtual field)
```

根 View 是真正承载 pointer 的树的一部分；`onLayout` 读的就是它的实际布局盒。内容区
和键盘是兄弟节点，键盘不覆盖内容；内容区的可用高度由当前 keyboard owner 的唯一底部
遮挡者决定：virtual 用 `dockHeight`，system 用 adapter 的 `imeInset`，none 为零。

### 4.2 本地测量、首帧与尺寸变化

`InputSurfaceFrame` 私有类型定义为：

```ts
type LocalFrameMetrics = {
  width: number;
  height: number;
  ready: boolean;
  orientation: 'landscape' | 'portrait';
};
```

`ready` 仅当 `Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0`
时为 true。首个有效 `onLayout` 之前：

1. 内容区正常渲染；
2. `VirtualKeyboard` 不渲染；
3. `visible=false`，不使用默认尺寸、不使用上一次 surface 的尺寸；
4. 点击 virtual field 只能进入 `blockedVirtualFieldId` 的待重评估状态，不能提交
   active owner；待首次有效测量后下一次用户焦点动作重新评估；
5. 不改变字段值、selection、可选/必填语义或决策按钮的可操作性。

尺寸变为零、NaN、Infinity 或 layout 变化时，先把 metrics 标为未就绪，再用新值一次性
重算 capacity；旧 dock 不得短暂继续显示。有效变化不会清除 snapshot、field registry
或业务 draft。

### 4.3 精确高度与按轴容量公式

以下常量是详设真相，必须成为 `keyboardHeight`/geometry focused test 的可观察常量；
它们不是设备分类，也不是从 `terminalSurfaces` 读取的值：

```text
MIN_SUPPORTED_FRAME_WIDTH = 360
MIN_CONTENT_HEIGHT        = 208
MAX_DOCK_HEIGHT           = 320
MAX_DOCK_RATIO            = 0.5
KEY_CELL_HEIGHT           = 48
DOCK_PADDING_HORIZONTAL   = 8
DOCK_PADDING_VERTICAL    = 9
ROW_GAP                   = 3
DENSE_KEY_MIN_WIDTH       = 32
DENSE_COLUMN_GAP          = 2
STANDARD_COLUMN_GAP       = 8
```

高度公式固定为：

```text
candidate = min(MAX_DOCK_HEIGHT,
                 floor(frameHeight * MAX_DOCK_RATIO),
                 frameHeight - MIN_CONTENT_HEIGHT)
availableDockHeight = max(0, candidate)
dockHeight = min(availableDockHeight, verticalRequired(rowCount))
```

`candidate` 是当前 frame 能提供的最大 dock 高度；当前布局的真实内容高度为：

```text
verticalRequired(rowCount) = rowCount * KEY_CELL_HEIGHT
                           + (rowCount - 1) * ROW_GAP
                           + 2 * DOCK_PADDING_VERTICAL
```

渲染高度为 `min(candidate, verticalRequired(rowCount))`。因此五行 full/numeric/financial
需要 `270`，四行 alpha 需要 `219`；content 使用上下各 `DOCK_PADDING_VERTICAL`，不再
设置 `rowBlockOffset`，所以键盘外框不为短布局预留上、下空白。若 `candidate` 小于
`verticalRequired(rowCount)`，高度取 candidate、capacity 为 `unsupported-height`，键盘
不渲染并显示既定尺寸提示；不通过裁剪或缩小纵向命中区域来“适配”。布局切换时内容区
按真实 dock 高度同步收缩/恢复，这是本次视觉复核后对原先“同一 surface 四布局 outer 高一致”
约束的明确修订。

横向公式为：

```text
columnGap = horizontalMode === 'dense' ? DENSE_COLUMN_GAP : STANDARD_COLUMN_GAP
horizontalAvailable = frameWidth - 2 * DOCK_PADDING_HORIZONTAL
                      - (columnCount - 1) * columnGap
cellWidth = floor(horizontalAvailable / columnCount)
horizontalFeasible = cellWidth >=
  (horizontalMode === 'dense' ? DENSE_KEY_MIN_WIDTH : KEY_CELL_HEIGHT)
```

full/alpha 使用 dense 模式；numeric/financial 使用 standard 模式。窄屏 full 的十列在
最小宽度上为 `floor((360 - 16 - 18) / 10) = 32`，满足 dense 下限；三列 standard
布局在 360 宽下为 `floor((360 - 16 - 16) / 3) = 109`，满足 48 的标准横向下限。

容量状态精确为：

```text
unmeasured | unsupported-width | unsupported-height | unsupported-horizontal | supported
```

判断顺序为 `!ready -> unmeasured`；宽度小于 360 -> `unsupported-width`；candidate 不满足
当前布局的 `verticalRequired(rowCount)` -> `unsupported-height`；横向 cell 不满足当前布局 ->
`unsupported-horizontal`；其余为 `supported`。

`InputProvider` 在 virtual field `onFocus` 前检查 capacity。非 `supported` 时不登记
active virtual owner、不渲染 dock，并记录 blocked field；有效尺寸后重新点击即可重试。
已测量的不可行状态显示统一的、可寻址的不可支持提示，要求扩大当前窗口；它不接受
dismiss，也不伪造提交成功。input 不接收 `required` prop，也不推断业务必填性：
StaffLogin 的必填路径通过该提示和 resize recovery 继续，MemberForm/年龄的可选语义与
确认/拒绝/交还动作保持可用。

验收基线只用于 fixture：

| frame fixture | candidate/dockHeight | 内容区剩余 |
| --- | ---: | ---: |
| 1157 × 723 | 320 | 403 |
| 962 × 541 | 270 | 271 |

上述数字不得回流为运行时输入。

### 4.4 键盘布局数据、行列与稳定 ID

新建或重构 `apps/terminal/ui/base/input/src/model/keyboardLayout.ts`，布局数据只描述
呈现与编辑键语义，不描述业务字段：

```ts
type KeyboardLayout = 'full' | 'alpha' | 'numeric' | 'financial';
type KeyboardKeyDefinition =
  | { keyId: `text-${string}`; zone: 'letters' | 'digits' | 'symbols'; kind: 'text'; text: string }
  | { keyId: 'shift' | 'caps' | 'backspace' | 'complete'; zone: 'actions'; kind: 'shift' | 'caps' | 'backspace' | 'complete' };
type KeyboardRow = {
  keys: readonly KeyboardKeyDefinition[];
  align: 'start' | 'center';
};
type KeyboardLayoutDefinition = {
  layout: KeyboardLayout;
  rows: readonly KeyboardRow[];
  maxColumns: number;
  horizontalMode: 'dense' | 'standard';
};
```

精确行数据如下；字符顺序固定，不由业务组件传入：

| layout | rows（从上到下） | maxColumns | mode |
| --- | --- | ---: | --- |
| full | `1234567890`; `qwertyuiop`; `asdfghjkl`; `zxcvbnm`; `shift,caps,backspace,complete` | 10 | dense |
| alpha | `qwertyuiop`; `asdfghjkl`; `zxcvbnm`; `shift,backspace,complete` | 10 | dense |
| numeric | `123`; `456`; `789`; centered `0`; `backspace,complete` | 3 | standard |
| financial | `123`; `456`; `789`; `-,0,.`; `backspace,complete` | 3 | standard |

字符 key 的 `keyId` 永远是 `text-${text}`；动作 key 永远使用自身 kind 字符串。
`complete.hasNextField` 由 Provider 按当前 live registration order 在渲染时计算，
不进入 layout definition，故 keyID 不因焦点或字段变化而漂移。`-` 和 `.` 仍是文本键，
分别得到 `text--` 与 `text-.`，不得改成业务名称。

`VirtualKeyboard` 的 testID 规则固定：

| 节点 | testID |
| --- | --- |
| root | `ui.base.input:virtual-keyboard` |
| content | `ui.base.input:virtual-keyboard:content` |
| letters region | `ui.base.input:virtual-keyboard:region:letters` |
| digits region | `ui.base.input:virtual-keyboard:region:digits` |
| symbols region | `ui.base.input:virtual-keyboard:region:symbols` |
| actions region | `ui.base.input:virtual-keyboard:region:actions` |
| each key | `ui.base.input:virtual-keyboard:${keyId}` |

不出现的 zone 不渲染空 region。所有 key 仍通过 `PrimitiveButton` 进入 automation
注册路径；业务 feature 不需要知道 className、NativeWind 或布局 token。

### 4.5 焦点、键盘 owner 与 LayerStack

同一 surface 只有一个 keyboard owner：`none | system | virtual`，并以
`systemVisible + virtualVisible <= 1` 作为不变量。

owner 转换不再在目标字段 `onFocus` 内调用会 blur 目标自身的 `Keyboard.dismiss`；
所有会把 native focus 移到另一个字段的路径必须先经过同一个
`preflightFocusTarget(targetFieldId)`，不能只把守卫挂在 pointer `onPressIn`。转换分两段：

1. `useInputField` 的 `onPressIn` 在 native focus 到达前执行 preflight。system→virtual
   时先对仍为当前焦点的 system 字段调用 `Keyboard.dismiss()`，再把 owner 置 `none`；
   virtual→system 时只清 active virtual owner 并隐藏 dock，不对即将获焦的 system
   字段调用 `Keyboard.dismiss()`；同 owner 换字段只改绑，不重开同类键盘。
2. `focusField` 与 `completeField` 的程序化 focus 也必须先调用同一 preflight：
   `completeField` 在 `nextField.inputRef.focus()` 之前执行它；若 preflight 不能完成，
   不调用目标 focus，owner 保持 `none`。这样 complete 的 focus-next 从 virtual 字段
   转到 system 字段时仍然经过同一互斥守卫。
3. 目标字段 `onFocus` 只做 commit：确认 capacity，登记目标 fieldId 与 owner；不再
   dismiss 当前目标。若目标 focus 未实际到达，owner 留在 none，不能伪造 visible。

`onBlur` 只清理仍由该 field 持有的 owner；旧 system 字段的延迟 blur 不能清掉已经
commit 的新 virtual owner。`onPressIn` 与程序化 focus-next 共用同一真实焦点 harness
验证，不能用 dismiss 调用次数、mock callback 或手调 `props.onFocus` 代替。

`LayerStack` 继续是 layer focus owner。首层打开时，`LayerStack` 依次保存当前 native
focus、发送 `SurfaceFocusBoundaryContext.suspend`、focus 顶层 View；input 收到 suspend
后清 `activeFieldId`、owner 置 none、隐藏 virtual dock，并调用全局的
`Keyboard.dismiss()`。末层关闭时，LayerStack 先发送 `restore`，再恢复保存的 native
focus；input 只有在 registration token 仍有效并真正收到该字段 focus 事件后才重开键盘。
如果字段在 layer 内被卸载，token 无效，保持 none。

`Keyboard.dismiss()` 是 RN 应用级调用，不按 display/React tree 隔离；本轮安全前提是
除承载输入的 surface 外没有其它 surface 持有 system-keyboard 字段。副屏只有 numeric
虚拟键盘且不弹业务 alert，不能借此引入 scope 机制；将来出现副屏中文 system 字段时必须
先重新裁定该前提。

### 4.6 焦点滚入收缩后的可见区

owner 是 `InputScrollArea`，不在 render 层，也不在按键热路径。`useInputField` 在
focus、active field、dockHeight 或 imeInset 变化后触发一次 effect，调用
`InputScrollArea.ensureVisible`；每次按键编辑不触发滚动测量。

调用链固定为：

```text
useInputField focus/active/geometry effect
→ InputScrollArea.ensureVisible(fieldRef, viewport)
→ PrimitiveInput.measureInWindow + PrimitiveScrollView.measureInWindow
→ calculateScrollOffset(..., viewportAlreadyShrunk=true)
→ PrimitiveScrollView.scrollTo(offset)
```

viewport 已由 InputProvider 从 surface height 减去当前唯一遮挡者得到，
`viewportAlreadyShrunk=true` 时 `calculateScrollOffset` 不得再次扣 dockHeight 或 imeInset。
不存在 `InputScrollArea` ancestor 时 no-op；不得为了通过 S-36 临时插入第二层 scroll view。
Web 与 Android 使用同一调用链。

### 4.7 Android 平台事实边界

本专题不拥有 Android 宿主拓扑，也不裁定 App 是否锁定 landscape。既有
`TerminalDualScreenActivityHandler`、Presentation carrier、`TerminalDeviceModule`、
沉浸式 window flags、AndroidManifest、Expo `app.json`、Kiosk/Lock Task、IME policy 与
adb 配置均不属于 input 实施对象；本轮不得新增 lifecycle listener、host/VM/process、
方向分支或设备策略。

input 只消费 assembly/adapter 提供的 `imeInset` 平台事实，并在每个自己的
`InputSurfaceFrame` 根 View 上通过 `onLayout` 读取实际布局盒。方向、宽度、键盘几何与
容量状态都只由这一个 frame 的 `width/height` 推导；不读取 Dimensions、window 全局值、
设备类型、`terminalSurfaces` 或另一块 surface 的尺寸。因此 App 锁定 landscape、允许
竖屏或 Web 窗口调整尺寸，都不改变 input 的公共面和测量模型。

若实现需要修改 Android carrier、方向声明、Presentation 拓扑或系统 IME 策略才能让
input 显示，立即按计划停止并报告；不得把宿主问题伪装成 input fallback。

### 4.8 Web 交互子树与真实 pointer hit 区域

`apps/terminal/ui/base/dev-host/src/testExpoApp.tsx` 的 `SurfaceCanvas` 仍可用
`terminalSurfaces` 提供 baseline aspect ratio、状态标签和截图 fixture，但不得让
`styles.logicalCanvas` 或其祖先以 `transform: scale(...)` 包裹 `SurfaceRoot`/
`InputSurfaceFrame`。

目标树为：

```text
SurfaceCanvas (outer shell may use host window dimensions)
└─ responsiveSurfaceStage (untransformed)
   ├─ primarySurfaceBox (actual responsive box)
   │  └─ SurfaceRoot → InputSurfaceFrame
   └─ secondarySurfaceBox (only when dual topology)
      └─ SurfaceRoot → InputSurfaceFrame
```

surface box 用 flex/aspect-ratio/gap 直接布局；窄 Web 窗口可按宿主既定规则堆叠，但
交互树始终是无 transform 的最终盒。`onLayout` 读到的盒就是 pointer 的布局盒，不能
把逻辑画布宽高或 transform 前尺寸传给 input。

将来授权浏览器证明时，观察脚本必须：

1. 找到 `ui.base.input:virtual-keyboard:key-*` 的真实 DOM 节点，读取
   `getBoundingClientRect()`；
2. 用 rect 中心调用 `document.elementFromPoint(centerX,centerY)`，确认返回节点属于
   同一个真实 key 动作树；
3. 从 key 向上检查交互祖先的 computed `transform`，逐级为 `none`；
4. 以实际 rect 与 elementFromPoint 结果判定命中，不以 transform 前逻辑尺寸判定 48。

该观察不在本轮执行，必须与浏览器证据分档，不能被 focused test 或模型红向量替代。

## 5. 公共 API、快照与业务字段边界

### 5.1 input 公共面收敛

将来 CP-1 必须从 `InputProvider`、`InputSurfaceFrame` 和公共 index 中删除
`surfaceSize`/`InputSurfaceSize`；`imeInset` 保留。内部 `LocalFrameMetrics` 只存在
input 包内。`sample-console/src/assembly.tsx` 的 `SurfaceInputFrame` 只把 imeInset
传入，不从 `terminalSurfaces.surfaces[displayMode]` 读取尺寸。

`PrimitiveInput` 的四个新增/现有可选关系保持：`maxLength` 是唯一为年龄三位上限
增加的能力；不新增 `inputMode`。其余公共 props 继续由 primitives 的既有契约提供，
业务生产源码不暴露 `className`。为让键盘的真实按键 cell 在不外泄 `className` 的前提下
获得 `flex-1`、48 高与 action key 的呈现差异，CP-2 允许给 `PrimitiveButton` 增加一个
可选的呈现-only `variant: 'default' | 'key' | 'key-action'`；它不改变默认 variant 的
语义、不增加业务 props，且只由 `VirtualKeyboard` 消费。该加法必须由 primitives 自己的
token 与 focused test 覆盖，不能把布局 token 或 NativeWind prop 下放到 input/feature。

### 5.2 原子快照

继续复用 `apps/terminal/ui/base/input/src/model/snapshot.ts` 的同步 live registry：
每个注册字段有 token、value、selection；顶层 revision 用于变化检测。`captureSnapshot()`
必须在同一 JS turn 内复制并冻结全部 live value/selection，不能 await、不能读 DOM、不能
把 registration token 暴露给 actor。unregister 只接受当前 token，旧字段卸载事件不能删除
新注册字段。

`MemberForm` 提交只按现有 fieldId 读取姓名/电话；alpha/financial 两个 probe 不被
遍历快照推导进 payload。probe 在 unmount、success、cancel、failure retry、re-enter 时
清空并 unregister；不改变 Member/PendingMember、command、dirty、customer confirm。

### 5.3 sample-only 字段

在 `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx` 的
phone 字段之后、业务动作之前新增两行：

| 字段 | label | layout | fieldId/testID | 业务边界 |
| --- | --- | --- | --- | --- |
| 英文字符测试 | `英文字符测试（仅 sample）` | alpha | `sample.desk.member-form:keyboard-alpha-probe` | 只验证拉丁/shift/edit/complete；不进 Member/command/dirty |
| 金额格式测试 | `金额格式测试（仅 sample）` | financial | `sample.desk.member-form:keyboard-financial-probe` | 只验证数字、`.`、`-` 与编辑可达；不进 Member/command/dirty |

下方固定辅助文案 `不保存到会员资料`，保证体验者不会把能力验证字段理解成业务字段。
这两个字段是 MemberForm 内部 registry-only 控件，不出现在 SECONDARY 或
`CustomerMember` 的确认 payload；它们同时为真实业务树提供 numeric→alpha→financial
连续切换路径。

## 6. 业务/交互与 IA 详设

### 6.1 可见 IA-ID

| IA-ID | 业务任务 | surface/入口 | 控件与文案 | 错误/恢复 | focus/testID |
| --- | --- | --- | --- | --- | --- |
| IA-AUTH-FULL | 店员输入工号与密码并登录 | PRIMARY；single/dual landscape 或 portrait | `full`：数字、拉丁、shift/caps、删除、完成；字段标签沿用 StaffLogin | 不可行显示扩大窗口提示；恢复靠 resize 后重新点字段 | 两字段既有 field testID；键盘 region/key IDs 见 §4.4 |
| IA-MEMBER-MIX | 店员录入会员姓名、电话并验证三种虚拟布局 | PRIMARY | system 姓名、virtual numeric 电话、sample-only alpha/financial；两个测试字段文案固定 | 字段值失败/取消按现有 actor；probe 不影响业务提交 | `MemberForm` fieldId 固定；键盘 owner 互斥 |
| IA-CUSTOMER-AGE | 顾客确认年龄 | SECONDARY 双屏，PRIMARY handheld-confirm 单屏/竖屏 | virtual numeric age，`maxLength=3`；确认/拒绝/交还按钮 | 年龄可为空；撤回/拒绝清掉 pending 年龄，确认不写空 age | age 与 hand-back IDs；副屏不启用 system IME |

### 6.2 不可见 IA 观察

| 维度 | 观察（未来授权后执行） |
| --- | --- |
| stateAndPermission | [静态/focused] input 只读 local registry；sample-only probe 的值在 command call 与 Member/PendingMember 写入点零命中 |
| navigationAndRefresh | [focused] layout 重测只改 capacity/dock geometry；snapshot value/selection 与 sample业务 dirty 不被清空 |
| collectionShapeAndScale | [focused] live registry 是当前 surface 的 bounded field map；注册/注销按 token，capture 不遍历服务端集合 |
| dataSourceAndCascade | [静态] keyboard key data 只来自 `keyboardLayout.ts`；field value 只来自 `useInputField` registry；sample command 只从固定 field IDs 取值 |
| forbiddenUI | [静态/浏览器] input 交互祖先不得有 transform；键盘不得出现候选栏、IME、业务快捷键；probe 不得出现在顾客确认层 |

### 6.3 体验矩阵

| 状态 | 内容区 | dock | 焦点 | 用户可继续路径 |
| --- | --- | --- | --- | --- |
| 首帧未测量 | 正常 | 不渲染 | 不承诺 virtual owner | 首次有效 layout 后再次点击 |
| supported virtual | 收缩到 `surfaceHeight-dockHeight` | 渲染对应 layout，dock 精确包住当前行块 | virtual owner | 编辑、切字段、complete/close-only |
| supported system | 按 `imeInset` 收缩 | 不渲染 virtual | system owner | 系统 IME 编辑；点击非输入区 dismiss |
| unsupported width/height/axis | 内容仍可见 | 不渲染 dock，显示不可行提示 | 不登记 virtual owner | resize/re-layout 后重试；可选字段的业务决策仍可用 |
| layer suspended | 内容由 layer owner 控制 | 隐藏 | owner none；保存焦点由 LayerStack | 关闭末层后 token 有效且收到 focus 才恢复 |

## 7. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| surface local size | `InputSurfaceFrame` 根 View `onLayout` | `LocalFrameMetrics` 内部传给 `InputProvider` | `calculateVirtualKeyboardMetrics`、VirtualKeyboard 可见性 | focused geometry tests；不同 surface fixture |
| ime inset | 既有 Android adapter/assembly 平台事实 | `imeInset` bridge → `InputSurfaceFrame` | system owner 的 content padding 与 scroll viewport | static/typecheck；Android 结果另档，不由 input 声称 |
| keyboard owner | `InputProvider` state | onPressIn preflight → onFocus commit → onBlur guarded cleanup | dock/system IME/content shrink | real focus harness；非调用计数 |
| keyboard geometry | `KeyboardLayoutDefinition` + constants | provider capacity → `VirtualKeyboard` props | rows, cell width, dock height | focused formula/layout/hit tests |
| focus visibility | `InputScrollArea` ancestor | field geometry effect → scroll API | scroll offset in shrunk viewport | focused scroll tests；no ancestor no-op |
| sample probe boundary | `MemberForm` field declarations | registry only; fixed submit field selection | UI only | static consumer search + focused submit test |
| error/unsupported | capacity enum | frame/provider → visible notice | user resize/retry | focused state tests；required login no silent dead |

## 8. 业务规则 → owner 判定点

| 规则 | owner 判定点 |
| --- | --- |
| FORM-1..FORM-5 | `InputSurfaceFrame` metrics/capacity 与既有 `imeInset` bridge；逐项不以单张截图替代 |
| full/alpha/numeric/financial 行列 | `keyboardLayout.ts` definition 与 `VirtualKeyboard` region renderer |
| 360 最小宽度/按轴可行性 | `calculateVirtualKeyboardMetrics` 与 geometry focused tests |
| system/virtual 互斥和首击不丢 | `useInputField` preflight + `InputProvider` commit；真实 focus harness |
| layer suspend/restore | `LayerStack` + `SurfaceFocusBoundaryContext` + `InputProvider.notifyFocusBoundary` |
| 收缩后滚入可见区 | `InputScrollArea.ensureVisible` 与 `calculateScrollOffset` |
| sample-only alpha/financial | `MemberForm` field declarations、固定 submit reads、unregister paths |
| 年龄三位与可选 age | `CustomerMember` + `PrimitiveInput.maxLength` + confirm actor normalization |
| App 方向与拓扑 | 本专题不设 owner；由既有 Android carrier 负责，input 只消费 frame onLayout 与 imeInset |
| Web hit target | `SurfaceCanvas` no-transform tree + browser rect/elementFromPoint observation |
| 性能 | `PF-1..PF-8` focused/static; PF-1..6 全绿不得单独宣称性能达标 |

无其它业务规则被本批创建。业务 command、Member/PendingMember、customer actor 仍由既有 owner
负责，本详设不把输入组件变成业务 owner。

## 9. owner API 与消费者清单

| owner 方法/符号 | 消费者 |
| --- | --- |
| `InputSurfaceFrame` / `handleSurfaceLayout` | `sample-console` 的 `SurfaceRoot.renderContentFrame`；dev-host 各 surface |
| `calculateVirtualKeyboardMetrics` | `InputProvider`；`keyboardHeight.test.ts` |
| `KeyboardLayoutDefinition` / `getKeyboardLayout` | `VirtualKeyboard`；layout/region focused tests |
| `InputProvider.handleFocus` / `handleBlur` / `dismissActiveField` | `useInputField`；surface content `Pressable` |
| `InputProvider.notifyFocusBoundary` | `LayerStack` 通过 `SurfaceFocusBoundaryContext` |
| `InputScrollArea.ensureVisible` | `useInputField` geometry effect；`ScrollArea` feature wrapper |
| `captureSnapshot` | `StaffLogin`、`MemberForm`、`CustomerMember` submit actors |
| `MemberForm` sample probe declarations | sample-only tests and renderer；不被业务 command 消费 |

## 10. 实施前全链同步变更清单

| 变更事实 | 契约/唯一源/生成物 | owner / edge / migration | 前端 model/surface/state | focused/static/runtime 测试 | fixture/seed | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 静态尺寸改为 local metrics | `InputSurfaceFrame` onLayout；无生成物 | input owner；无 DB | Frame/provider/geometry/assembly | provider、keyboardHeight、FORM tests | N/A：无业务 seed | 同步修改 |
| public `InputSurfaceSize` 删除 | `input/src/index.ts` 与 invariants | N/A | InputProvider/Frame props、README | public face/invariant/typecheck | N/A | 同步修改 |
| 四布局行列与 testID | `keyboardLayout.ts` 唯一源 | N/A | VirtualKeyboard regions | virtualKeyboard/layout/hit tests | N/A | 同步修改 |
| owner transition/focus | `InputProvider`/`useInputField` | N/A | focus state/dock visibility | real focus harness、KEY-R8 | N/A | 同步修改 |
| ime inset platform fact | existing adapter/assembly bridge | N/A | InputSurfaceFrame system-owner padding/scroll | static/typecheck；平台运行另档 | N/A | 保持现状 |
| Web no-transform input tree | `SurfaceCanvas` owning source | N/A | dev-host surface tree | static + browser when authorized | N/A | 同步修改 |
| alpha/financial sample-only fields | `MemberForm` field declarations | command/Member/PendingMember explicitly unchanged | registry-only fields | submit, cleanup, consumer search | N/A | 同步修改 |
| docs/invariants/readme | docs are source of design statement | N/A | public README/invariant | review and typecheck | N/A | 同步修改 |

## 11. 验收场景与红向量

| scenario | owner | identity/fixture | request | businessOracle / 判定 |
| --- | --- | --- | --- | --- |
| FORM-1 | InputSurfaceFrame + assembly | PRIMARY local measurement fixture | focus StaffLogin full on landscape single | dock geometry is from onLayout; login fields remain usable |
| FORM-2 | two InputSurfaceFrame instances + host | primary/secondary baseline fixtures | focus phone/age and sample probes on correct surface | each surface has independent metrics; no cross-surface size; age only virtual on SECONDARY |
| FORM-3 | InputSurfaceFrame + handheld-confirm | portrait-shaped local frame fixture | measure PRIMARY-shaped frame and focus age | input chooses geometry from local onLayout; age remains actionable; no topology claim |
| FORM-4 | dev-host SurfaceCanvas + input | narrow/resize responsive fixture | resize frame across landscape/portrait/unsupported width | geometry, capacity, and actual pointer rect recompute; no transform ancestor |
| FORM-5 | InputSurfaceFrame/provider | no initial layout callback | focus before first valid layout | no dock/default size/dead focus; remeasure and retry works |
| KEY-R3 | MemberForm | real sample business tree | numeric→alpha→financial and back | probe fields render and edit; no command/member/dirty/confirmation effect |
| KEY-R8 | InputProvider/useInputField | real focus harness, not hand-called callbacks | pointer focus and virtual complete focus-next across system/virtual fields | first click and programmatic focus-next both get target focus; at most one owner; mutation removing shared preflight must fail |
| S-36/S-37 | geometry + scroll | target baselines and insufficient axes | focus field under dock | field complete visible after shrink/scroll; formula source local; no double subtract |
| S-38 | sample-member-desk actor + customer-member | double-screen age-entry race fixture | customer is editing age on SECONDARY while staff selects 撤回 | three business oracles must all hold: SECONDARY leaves confirmation and returns to `customer-welcome`; a subsequent customer 确认 produces no registration; store contains no age residue |
| S-39 | capacity notice + sample action | optional age and required login fixtures | force width/height infeasible | no silent keyboard; login has visible recovery; age decisions remain actionable |

模型红向量的 FAIL 只说明判据能识别错误实现；后续生产源码 typecheck、focused test、Android
或浏览器结果必须分档记录。任何调用次数、prop 值、transform 前逻辑尺寸都不能作为行为类
判据的唯一证明。

## 12. 迁移、seed 与未决项

### 12.1 数据迁移与 seed

`§10` migration = `N/A`：没有数据库事实。`§10b` seed = `N/A_WITH_REASON`：
alpha/financial 是 registry-only sample 输入，不能进入业务数据；年龄/Member/command
契约不在本批改变，不需要 seed 回填。acceptance/focused fixture 不是 seed，未来也不得把
probe 塞进会员 seed。

### 12.2 未决项

| 项目 | 状态 | 本批处理 |
| --- | --- | --- |
| Presentation 副屏系统 IME | 已有产品决定：不开 | 不引入权限/device policy/adb；仅验证虚拟键盘路径 |
| 真实 POS 物理屏/DPI/厂商 ROM | 未取证 | Android 模拟器结果不得写成真实 POS 已验 |
| 浏览器实际 pointer rect | 需要浏览器档证据 | 设计给出 observation；本轮不运行 |
| §9 比例静态门 | 未经 Dexter 裁定 | 不建比例机器门；用 focused geometry 与逐代码对账 |

## 13. 停机条件

未来获实施授权后，出现以下任一项必须停机交 Dexter，不得加 fallback：

1. 既有 Android carrier 无法继续提供 input 所需的 `imeInset` 接缝，或 input 被迫新增 host、VM、process、bootstrap 或 carrier 改造；
2. 为让 input 展示键盘，必须让 input 读取 App 方向锁、拓扑、设备类别或其它 surface 的尺寸；
3. `InputSurfaceFrame` 无法在真实 pointer tree 的根 View 获得 onLayout；
4. 为兼容竖屏必须让 input 读取 Dimensions、设备类别或静态 `terminalSurfaces`；
5. Android IME/Presentation 需要改变已裁定的副屏不启用系统 IME 产品边界；
6. `MemberForm` 的 alpha/financial 不能在不污染 Member/command/dirty/confirm 的前提下注册；
7. 任一行为判据只能靠调用次数、mock callback、prop 或 transform 前逻辑尺寸证明；
8. 本文与当前源码公共签名冲突且不能在批准范围内闭合；
9. 任一阶段三维对账或最终逐代码与详设对账为 `OPEN` 且无法通过同根修复闭合。

## 13b. 实施节奏与三维对账

每个 CP 完成后、进入下一个 CP 前，主 agent 只负责提供前后双读留痕、focused proof
和待核对清单；由 fresh 独立子 agent 按下表逐条作出阶段对账结论：

| 维度 | 对账对象 |
| --- | --- |
| 一 | 两份需求：业务目标、S-1/S-2 修复、已裁定不做项 |
| 二 | 本详设与 IA/交互矩阵：字段、owner、树、文案、失败/恢复、焦点、数据源 |
| 三 | 项目 memory：deterministic-context、terminal architecture/stack rulings、implementation source reread、frontend/input performance/focus pitfalls |

每一条只出 `MATCHED` 或 `OPEN`；fresh reviewer 给出 `OPEN` 后由主 agent 修根因，
再由 fresh reviewer 只读复核；主 agent 不得把自己的预判写成阶段 `MATCHED`，也不能启动
下一个 CP。全部 CP 完成后、进入整体测试前，再由 fresh 独立子 agent 对全批做一次
独立于阶段记录的三维对账。

## 13c. 逐代码与详设对账派生要求

实施计划必须有名为 **“逐代码与详设对账”** 的独立交付步骤。该步骤：

- 范围是本详设列出的每一个源码锚点、每一个新增/删除公共面、每一个测试/README/invariant
  同步点，逐代码，不抽样；
- 执行者是主 agent，fresh 独立子 agent 只读盲审记录，不代写、不替代主 agent；
- 每行记录文件、唯一符号锚点、详设条款、代码观察、结论；结论只允许 `MATCHED` 或 `OPEN`；
- 调用计数、prop 值、mock callback、transform 前逻辑尺寸不能作为行为 MATCHED 的唯一证据；
- 任一 `OPEN` 未闭合时，只能报“实施未就绪”，不得交 Dexter/Claude 做实施后 review；
- 对账记录必须随未来交付 brief 一起给出。它与 §13b 三维对账不是同一件事。

## 14. 详设自查

```text
REQUIREMENT_S_FIXES=S-1 portrait matrix includes staff-auth/member-form/handheld-confirm; S-2 required-input unsupported behavior explicit
SURFACE_MEASUREMENT=onLayout on the actual pointer tree; no static surfaceSize/Dimensions/device sniffing
GEOMETRY=exact constants, formula, dense full/alpha token, minimum width, axis safety valve
LAYOUT_DATA=four layouts, rows/columns, stable keyId, region/key testID
FOCUS=preflight before native focus; commit on focus; LayerStack suspend/restore; real focus proof
ANDROID_BOUNDARY=existing carrier and imeInset only; no input-owned orientation or topology changes
WEB=untransformed interaction subtree; getBoundingClientRect + elementFromPoint observation
SAMPLE=alpha/financial registry-only; command/member/pending/dirty/confirm unchanged
IA=visible and invisible dimensions are both explicit; no new Journey
RECONCILIATION=stage/whole three-dimensional and separate code/design gate specified
IMPLEMENTATION_AUTHORITY=true
```
