# TER Admin console 非登录区高保真 IA 设计

状态：`DEXTER_CONFIRMED_FOR_IMPLEMENTATION_DESIGN`

日期：2026-09-20

`IA_SCOPE=HIGH_FIDELITY_VISUAL_AND_INTERACTION_SPEC_ONLY`

`LOW_FIDELITY_BASELINE=doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md`

`LOW_FIDELITY_SEMANTIC_ASSET=doc/plans/platform/assets/2026-09-19-ter-admin-console-non-login-ia-wireframes.html`

`WIREFRAME_ASSET=doc/plans/platform/assets/2026-09-19-ter-admin-console-non-login-ia-wireframes.html`

`HIGH_FIDELITY_ASSET=doc/plans/platform/assets/2026-09-19-ter-admin-console-non-login-ia-high-fidelity.html`

`IMPLEMENTATION_AUTHORITY=false`

`IMPLEMENTATION=NOT_AUTHORIZED`

`IA_SOURCE_PRIORITY=frame inventory 是用户旅途、可见字段、状态、文案和动作的语义正本；本稿是同一 IA-ID 的位置、尺寸、形状、颜色、图标、字体和视觉 token 的视觉正本；冲突先修两份 IA，不由详设或实施择一`

`DEXTER_LOW_FIDELITY_APPROVAL=CONFIRMED`

`DEXTER_HIGH_FIDELITY_APPROVAL=CONFIRMED_2026-09-20`

`INDEPENDENT_DESIGN_REVIEW=NOT_RUN_IN_THIS_DRAFT`

## 1. 设计目标与不变边界

这次高保真设计只处理 Admin console 的非登录区：共享 panel 框体、平台端口、合并后的运行状态和双机拓扑。登录、认证、虚拟键盘、业务 feature 页面、电源确认语义、topology kernel 和 Android 公共契约均不在本稿实施范围内。

核心目标是让登录前后的体验属于同一个产品：

- 复用登录框已经确认的圆角、细描边、层级阴影、标题比例、主操作渐变和语义状态灯；
- `admin-shell` 只消费语义 token，不持有 sample 的品牌色；`sample-console` 和 `sample-wallpaper-console` 分别注入自己的 token 值；
- laptop 使用侧边导航和并列信息，mobile 使用竖屏单列和顶部固定下拉 selector；mobile 不是把 laptop 压缩后换行；
- 所有状态先给用户结论，再给原因和下一步；技术字段只在用户任务需要时出现；
- 低保真线框 HTML 与 frame inventory 共同定义可见控件、文案、状态、动作和页面流转；高保真只补充视觉细节，不得新增、删除或改写这些语义元素；
- 高保真规格表定义视觉几何正本，后续详设必须以同一 IA-ID 将低保真语义、高保真视觉、primitive、token 和几何值逐项对账；发现冲突时先修正 IA，不允许由实施方自行择一。

语义与形态的优先级固定为：frame inventory 是用户旅途、可见内容、状态、文案和动作的正本；本稿是同一 IA-ID 的高保真位置、尺寸、形状、颜色、图标、字体和 token 正本。本稿不得改变 frame inventory 的字段分母；两份 IA 若冲突，先修 IA，再进入详设或实施。

## 2. 风格延续：登录框到已登录 Admin panel

### 2.1 共用视觉语法

| 语法 | 登录框现状 | 非登录区高保真延续 |
| --- | --- | --- |
| 外框 | `PrimitiveContainer` 的 login card，20 逻辑单位圆角、1 单位边框、elevated shadow | Admin shell 外框同样使用 20 圆角、1 单位边框和 elevated shadow；内容卡使用 16 圆角 |
| 主操作 | `login-primary` 使用 integration 提供的 action/gradient | 开启服务、直接配对、解除配对、重试等主要动作沿用同一 action/gradient；危险动作改用 error 语义，不复制红色常量 |
| 文字 | 标题 30/40、正文 16/24、辅助文字 16/24 | shell 标题 24/32；页面标题 22/30；卡片标题 16/22；正文 14/20；辅助文字 12/18；都保留清晰的重量层级 |
| 状态 | 点色 + 文字 | 所有状态继续点色 + 文字；不可只用颜色表达 |
| 间距 | login card 以 16/20/24 为主节奏 | shell 使用 12/16/20/24/32 的同倍数节奏，避免登录与登录后像两套产品 |
| 背景 | login surface 由 integration theme 决定 | header/nav 复用登录 surface 家族；正文使用 `surface` / `surface-elevated`；不在 shared base 写死深色或青色 |

### 2.2 主题策略

高保真图默认以 `sample-console` 主题渲染，并可在 HTML 顶部切换到 `sample-wallpaper-console`。表中 RGB 是当前仓内主题的静态映射，设计使用的文字永远写 token 名而不是颜色字面量。

| 语义 token | sample-console | sample-wallpaper-console | 用途 |
| --- | --- | --- | --- |
| `color-login-surface` / `color-admin-shell-surface` | `16 29 49` | `255 255 255` | 登录卡与 Admin shell header/nav 的主表面 |
| `color-login-foreground` / `color-admin-shell-foreground` | `245 248 255` | `15 23 42` | 深色/浅色 shell 上的标题与主要文字 |
| `color-login-muted` / `color-admin-shell-muted` | `160 180 208` | `71 85 105` | 辅助文字、说明、次要元数据 |
| `color-login-border` / `color-admin-shell-border` | `88 124 176` | `203 213 225` | shell、导航、卡片边框 |
| `color-login-action` / `color-admin-action` | `37 99 235` | `159 18 57` | 主操作背景与当前导航 |
| `color-login-action-start` / `color-admin-action-start` | `43 128 251` | `225 29 72` | 主操作渐变起点 |
| `color-login-action-end` / `color-admin-action-end` | `80 228 253` | `159 18 57` | 主操作渐变终点 |
| `color-focus` / `color-admin-focus` | `30 64 175` | `225 29 72` | 当前选择、键盘焦点、选中边框 |
| `color-surface` / `color-admin-content-surface` | `255 255 255` | `255 255 255` | 内容区背景 |
| `color-surface-inset` / `color-admin-inset` | `226 232 240` | `255 241 242` | 输入、分组行、表面内部凹槽 |
| `color-foreground` / `color-admin-content-foreground` | `15 23 42` | `15 23 42` | 内容区主要文字 |
| `color-muted-foreground` / `color-admin-content-muted` | `71 85 105` | `71 85 105` | 内容区辅助文字 |
| `color-ok-*` | 现有绿色语义值 | 现有绿色语义值 | 正常/可达/可用 |
| `color-warn-*` | 现有黄色语义值 | 现有黄色语义值 | 等待/重连/暂时不可用 |
| `color-error-*` | 现有红色语义值 | 现有红色语义值 | 失败/不可用/错误 |

高保真稿不新增固定青色；`sample-console` 的蓝青来自其 theme，`sample-wallpaper-console` 的红色来自其 theme。若后续实现需要新 token，应优先把 `admin-*` 作为语义别名接到当前主题值，而不是让 `admin-shell` 直接读取 `login-*` 或复制十六进制值。

## 3. 画板、断点与全局几何正本

### 3.1 画板基准

单位为逻辑单位（`lu`），1 `lu` 对应 React Native/Web 布局中的一个逻辑布局单位，不等同于 Android 物理像素。

| 形态 | 高保真画板 | shell 内容安全区 | 说明 |
| --- | --- | --- | --- |
| laptop | `1440 × 900 lu` | 左右 40、上下 32 | 横向导航与内容并列；内容最小宽 720 |
| mobile | `390 × 844 lu` | 左右 16、上下 16 | 竖屏单列；selector 固定在 header 下方，内容独立滚动 |

### 3.2 Shell 几何

| IA-ID | 位置 | 尺寸 | 形状/背景 | 文字/图标 | 间距 |
| --- | --- | --- | --- | --- | --- |
| `panel.shell` | 画板居中 | laptop 最大宽 1360、最小高 760；mobile 宽 358、最小高 812 | 20 圆角；1 `color-admin-shell-border`；`color-admin-shell-surface`；elevated shadow | 无 | 画板安全区 |
| `panel.header` | shell 顶部 | laptop 高 72；mobile 高 60 | 透明，继承 shell surface；底部 1 边框 | `panel.header.title` 24/32/700；关闭图标 `close` 20 | 左右 24；标题与 status gap 12 |
| `panel.header.overall-status` | 标题右侧 | 高 28，最小宽 112 | 14 圆角；状态背景 token | 12/18/600；8 圆点 | 与标题 gap 16 |
| `panel.nav.laptop` | header 下方左侧 | 宽 248；填满内容高 | 16 圆角；`color-admin-shell-surface`；选中项使用 action token | 14/20/600；选中项带 `terminal` 图标 | nav 内 padding 12；项高 44，gap 6 |
| `panel.nav.mobile` | header 下方固定 | 高 48；宽满 | 12 圆角；`color-admin-inset`；focus 2 边框 | 下拉 chevron 16；14/20/600 | 与内容 gap 12 |
| `panel.content` | nav 右侧或 selector 下方 | laptop flex 1；mobile flex 1 | `color-admin-content-surface`；内容滚动 | 继承内容文字 | laptop padding 24；mobile padding 16 |

### 3.3 通用控件几何

| IA-ID | 尺寸与形状 | token | primitive 对应 |
| --- | --- | --- | --- |
| `admin.page-title` | 22/30/700，单行 | `color-admin-content-foreground` | `PrimitiveHeading` |
| `admin.section-title` | 16/22/700 | `color-admin-content-foreground` | `PrimitiveHeading` 或 `PrimitiveText` |
| `admin.card` | 16 圆角；1 边框；padding 20；最低高 96 | `color-surface-elevated`、`color-border`、elevated shadow | `PrimitiveContainer layout="card" bounded elevated` |
| `admin.primary-action` | 最小高 44；12 圆角；左右 16 | `color-admin-action-start/end`、`color-action-foreground` | `PrimitiveButton appearance="login-primary"` 的视觉家族；后续可扩充 admin-primary appearance |
| `admin.secondary-action` | 最小高 44；12 圆角；透明/表面填充；1 边框 | `color-admin-border`、`color-admin-content-foreground` | `PrimitiveButton appearance="login-secondary"` 的视觉家族 |
| `admin.status` | 圆点 8；文字 14/20/600 | `color-ok-*` / `color-warn-*` / `color-error-*` / `color-info-*` | `PrimitiveStatus` / `PrimitiveBadge` |
| `admin.disclosure-row` | 最小高 52；padding 16；16 圆角 | `color-surface-elevated`、`color-border` | `PrimitivePressOption` 或新增 shared disclosure primitive |
| `admin.ratio-bar` | 高 12；圆角 6 | available/unavailable/undeclared status backgrounds | 新增 `PrimitiveRatioBar`，不能在两个 integration 复制 |
| `admin.surface-map` | 由真实宽高比计算；最短边 176（laptop）/120（mobile） | surface/status token | 新增 `PrimitiveSurfaceMap` 或由 primitive layout 组合，不能统一固定比例 |

## 4. 信息架构和 frame 视觉状态

以下 frame ID 沿用已确认的低保真清单，编号不重排。高保真 HTML 为每个 frame 提供完整视觉卡片；同一业务元素在 laptop/mobile 使用同一 IA-ID，只有布局与信息密度变化。高保真中的额外阴影、图标容器和装饰性图形不得变成新的业务控件或新的用户可见文案。

### 4.1 Panel 框体

| Frame | Laptop 视觉 | Mobile 视觉 | 关键状态 |
| --- | --- | --- | --- |
| `IA-01 PANEL-L-NORMAL` / `IA-02 PANEL-M-NORMAL` | 深色/浅色 themed header + 左侧导航 + 内容卡；选中 tab 为 action gradient | header + 固定下拉 selector + 单列内容卡 | `panel.header.overall-status=正常` |
| `IA-03 PANEL-L-EMPTY` / `IA-04 PANEL-M-EMPTY` | 内容区中央 empty card，保留导航和关闭入口 | 单列 empty card，selector 仍可切换 | `panel.empty` + 下一步 |
| `IA-05 PANEL-L-LOADING` / `IA-06 PANEL-M-LOADING` | skeleton 卡片、spinner、状态灯 | 纵向 skeleton，不能横向溢出 | `panel.loading` |
| `IA-07 PANEL-L-ERROR` / `IA-08 PANEL-M-ERROR` | error card + retry，header/nav 不消失 | 单列 error card + retry | `panel.error` |

### 4.2 平台端口

| Frame | 内容顺序 | 主要动作/反馈 |
| --- | --- | --- |
| `IA-09 PORTS-L-OVERVIEW` / `IA-10 PORTS-M-OVERVIEW` | 页面标题 → 总数摘要 → 12 单位比例条 → 五个分类行 | 分类行可展开；摘要固定在内容顶部 |
| `IA-11 PORTS-L-CATEGORY-EXPANDED` / `IA-12 PORTS-M-CATEGORY-EXPANDED` | 总览保留；一类展开为有限列表 | 每项显示名称、状态、原因/来源；展开状态用 chevron + 文字 |

视觉正本：比例条三段从左到右为可用、不可用、未声明；数字与条段颜色对应；分类状态不得只显示百分比。mobile 分类行全宽单列，展开明细不再套第二层横向卡片。

### 4.3 运行状态

| Frame | 内容顺序 | Surface 视觉 |
| --- | --- | --- |
| `IA-13 RUNTIME-L-SINGLE-SURFACE` / `IA-14 RUNTIME-M-SINGLE-SURFACE` | 页面标题 → 总体状态 → 环境/调试/设备/显示事实状态 → 物理屏数量 → 一块 surface map → 说明 | 矩形按真实逻辑宽高比；逻辑宽/高写在框内长/高边；物理宽/高写在框外长/高边；缺失值位置显示“未知”；mobile 多 surface 事实使用同一 frame 的 `display-facts-error` 变体，不生成第二块矩形 |
| `IA-15 RUNTIME-L-DUAL-SURFACE` | 页面标题 → 总体状态 → 环境/调试/设备/显示事实状态 → 物理屏数量 → 两块 surface map 并列 → 说明 | 主屏/副屏标题在框上方；两块矩形比例不同；当前 surface 用 focus 边框，非当前 surface 只显示存在性、角色和“该屏信息未提供”，不补分辨率/就绪态 |

### 4.4 双机拓扑

| Frame | 视觉主结构 | 主动作 |
| --- | --- | --- |
| `IA-16 TOPOLOGY-L-UNAVAILABLE` / `IA-17 TOPOLOGY-M-UNAVAILABLE` | 单一 gate card；状态灯、唯一结论、唯一原因 | 无操作；不画身份、地址、服务、配对或历史 |
| `IA-18 TOPOLOGY-L-ROLE-CHOICE` | 两个目标 card：主机服务 / 副机直接配对 | “开启主机服务”；输入 IP 后“直接配对” |
| `IA-19 TOPOLOGY-L-HOST-STARTING` | 主机目标 card + progress/status | 禁止重复提交，显示“正在开启” |
| `IA-20 TOPOLOGY-L-HOST-READY` | 主机状态 card + 本机 IP 地址 + 等待副机提示 | “关闭主机服务” |
| `IA-21 TOPOLOGY-L-HOST-ERROR` | error status + 原因 + 下一步 | 重试开启 / 返回目标选择 |
| `IA-22 TOPOLOGY-L-PAIRING` | 副机目标 card + 地址摘要 + progress/status | 禁止重复提交 |
| `IA-23 TOPOLOGY-L-PAIR-ERROR` | 保留 IP 输入 + error card | 直接重试 / 返回目标选择 |
| `IA-24 TOPOLOGY-L-MASTER-PAIRED-REACHABLE` | 主机身份、已配对、可达、服务状态、对端摘要 | 解除配对；服务开关作为独立次级生命周期动作 |
| `IA-25 TOPOLOGY-L-MASTER-PAIRED-RECONNECTING` | 保留已配对主机 card，状态灯转 warning | 解除配对；不回未配对表单 |
| `IA-26 TOPOLOGY-L-UNPAIRING-MASTER` | 主机 card 保留，解除操作进入 progress | 禁止重复提交；完成后回目标选择 |
| `IA-27 TOPOLOGY-L-SLAVE-PAIRED-REACHABLE` | 副机身份、已配对、可达、对端摘要 | 解除配对 |
| `IA-28 TOPOLOGY-L-SLAVE-PAIRED-RECONNECTING` | 保留已配对副机 card，状态灯转 warning | 解除配对；不显示查询身份 |
| `IA-29 TOPOLOGY-L-UNPAIRING-SLAVE` | 副机 card 保留，解除操作进入 progress | 完成后回目标选择 |

失败不额外造一个“恢复页”：配对失败使用 `IA-23`，主机服务失败使用 `IA-21`，解绑/服务切换失败在当前角色 frame 的 `topology.operation-feedback` 内联显示，并保留当前事实。

## 5. Surface map 的高保真规则

### 5.1 Laptop 双屏

- 主屏与副屏卡片并列；宽高比严格来自各自权威尺寸，不能用统一 `16:10` 占位；
- 当前 surface：矩形内显示逻辑宽、高、就绪/可用；矩形外显示物理宽、高；
- 非当前 surface：显示角色、存在性和“该屏信息未提供”，不显示分辨率和就绪态；
- 主/副标题位于矩形上方，当前标记用 focus border + “当前”文字双重表达；
- 物理值缺失时仍保留外侧数字锚点，文字为“未知”，不移动布局、不复制另一块 surface。

### 5.2 Mobile 单屏

- 只显示 PRIMARY/current surface；不画副屏 placeholder；
- 矩形最大宽度为内容列宽减 32，最小高度 120；逻辑/物理标注改为沿框边的紧凑标注；
- 物理数据缺失仍显示“未知”；若事实声称 mobile 多 surface，显示 display facts 异常，不生成第二块矩形。

## 6. Mobile 与 laptop 的交互差异

| 事项 | Laptop | Mobile |
| --- | --- | --- |
| 页面切换 | 左侧垂直导航，当前项 action 背景 + 左侧 focus bar | 顶部固定单个下拉 selector，展开时覆盖在内容上方，不横向滚动 |
| 摘要与明细 | 端口摘要与分类可左右分组；运行状态可并列 surface | 所有摘要、分类、明细单列；先摘要后明细 |
| 双机拓扑 | 单物理屏可进入完整旅途 | 始终只显示不可用 gate：`mobile 形态不支持双机拓扑` |
| Surface | 单屏/双屏按真实比例展示 | 只展示一块实际 surface |
| 操作按钮 | 主要动作右对齐或卡片底部并列 | 主要动作全宽垂直排列，次要动作随后 |

## 7. Primitive 与 theme 对接清单

| 高保真元素 | 首选 primitive | 若不足的最小扩充 |
| --- | --- | --- |
| shell/card/header | `PrimitiveContainer`、`PrimitiveGrid`、`PrimitiveHeading` | 增加 `admin-shell` appearance/token，不复制 Admin shell |
| laptop nav/mobile selector | `PrimitivePressOption`、`PrimitiveSelect` | 只补统一的 selected/focus token |
| 状态灯/标签 | `PrimitiveStatus`、`PrimitiveBadge` | 补 `admin` status density，不添加业务 reason parser |
| 端口比例条 | `PrimitiveProgress` | 增加能表达三段状态分布的 `PrimitiveRatioBar` |
| 展开分类 | `PrimitivePressOption` + `PrimitiveStack` | 若需统一展开动画，增加 shared disclosure primitive |
| surface map | `PrimitiveContainer` + `PrimitiveText` | 增加只负责几何与标注的 `PrimitiveSurfaceMap`；不读 state/store |
| 拓扑 action card | `PrimitiveCard`、`PrimitiveFormField`、`PrimitiveButton` | 补 action-card appearance；不在 primitive 里判断角色/配对 |

任何扩充都必须保持 presentation-only：不持有 state、store、command、认证、topology evaluator 或业务文案 owner。

## 8. 高保真对账合同

交 Dexter 确认前，主 agent 自查必须逐 frame、逐 IA-ID 对比低保真线框、高保真 HTML 与本表。低保真线框负责回答“有什么、叫什么、何时出现、能做什么”，高保真负责回答“如何呈现”；三者不得互相矛盾：

1. 位置：相对 shell/header/nav/content 的锚点和逻辑偏移；
2. 尺寸：宽、高、最小尺寸与不溢出边界；
3. 形状：圆角、边框宽度、阴影层级；
4. 颜色：只使用语义 token，且能在两个 integration 主题表中查到；
5. 图标：名称、方向和逻辑尺寸；
6. 字体：字号、行高、字重、对齐和单行/多行规则；
7. 背景：填充 token、透明或 inset；
8. 间距：父 padding、相邻 gap、列表行高；
9. 状态：正常/等待/警告/错误/选中/展开/进行中必须与对应 frame 和文案同时存在；
10. 事实边界：mobile 无拓扑操作；双屏非当前 surface 不出现分辨率和就绪状态；不可用 gate 不出现次级拓扑数据。

### 8.1 语义对账硬规则

1. 每个 frame 的可见标题、状态文案、字段标签、字段值、按钮文案、错误原因、展开/收起文案和返回路径，必须在低保真线框与高保真 HTML 中一一对应；高保真可以改变排版、字体、颜色、阴影和图标容器，但不能另造一套内容。
2. 每个 IA-ID 必须在两份 HTML 中都有唯一对应；一个低保真控件被拆成多个高保真节点时，只允许是视觉包裹，不得增加新的操作或状态。
3. low-fi 与 high-fi 的 mobile selector 数量必须均为一个；laptop 导航必须均为“平台端口 / 运行状态 / 双机拓扑”三个项目；不得恢复已删除的 `ADMIN CONSOLE` 侧栏标签或 generic `Admin console` 页面标题。
4. 端口摘要、五个分类、展开明细、运行状态的 surface 字段、双机拓扑各角色动作和不可用 gate，必须逐项核对可见文字；尤其不得在高保真中重复绘制分辨率，或把非当前 surface 补成完整事实卡片。
5. 对账记录至少包含 frame ID、IA-ID、low-fi 文案/控件、高-fi 文案/控件、结果；任一项不匹配时状态为 `OPEN`，不得进入详设或实施。

### 8.2 本轮语义对账结果

本轮修订后已完成一次静态与渲染级自查，结果如下；这些结果只证明 IA 资产之间一致，不代表实现完成：

| 对账项 | 结果 | 说明 |
| --- | --- | --- |
| Frame 集合与顺序 | `MATCHED` | low-fi 与 high-fi 均为 30 个 frame，`IA-01` 至 `IA-29` 与 `IA-32` 顺序一致；其中 29 个 production frame、1 个跨 tab 对照工件 |
| Panel / 端口 / 运行状态 / 拓扑语义 | `MATCHED` | 标题、状态、字段、动作、错误原因、展开明细与返回路径逐类对应；高保真只增加视觉包裹、图标和阴影 |
| Mobile 导航 | `MATCHED` | 两份资产的每个 mobile frame 均只有一个顶部下拉 selector；laptop 均只有“平台端口 / 运行状态 / 双机拓扑”三项导航 |
| Surface 事实边界 | `MATCHED` | 当前 surface 显示逻辑/物理尺寸和就绪态；非当前 surface 只显示角色、存在性与“该屏信息未提供”；mobile 使用竖屏比例，物理值缺失显示“未知” |
| 双机拓扑可达范围 | `MATCHED` | mobile 只有不可用 gate；laptop 才有主机服务、直接配对、已配对、重连和解绑动作，主机与副机动作不混用 |
| 页面运行自检 | `PASS` | 两份 HTML JavaScript 解析通过，headless 渲染无 page error；未启动应用、Metro、Android 或设备 |

高保真画廊中的 `T` 品牌标记、状态图标、卡片阴影、比例条圆角、展开 chevron 和 frame 说明属于视觉表达或设计标注，不是低保真之外新增的业务控件、用户操作、状态或文案。若后续对账发现这些元素承载了新的业务含义，必须回到本节重新登记，不得直接进入详设。

## 9. 暂不进入的阶段

- 不修改源码、测试、依赖、脚本、theme 或 primitive；
- 不写 implementation-facing 详设与实施计划；
- 不启动 Web、Metro、Android、设备、DEV、seed、UAT 或部署；
- 高保真 IA 通过 Dexter 确认后，才进入 implementation-facing 详设；
- 若 Dexter 要求改变用户旅途、拓扑动作或 display facts 范围，需回到需求/IA 重新记录，不在详设阶段悄悄扩大。
