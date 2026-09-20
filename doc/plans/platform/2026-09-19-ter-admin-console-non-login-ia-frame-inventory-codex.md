# TER Admin console 非登录区 IA 线框清单

状态：`DEXTER_CONFIRMED_FOR_HIGH_FIDELITY_AND_IMPLEMENTATION_DESIGN`

日期：2026-09-19

`IA_SCOPE=FRAME_INVENTORY_AND_LOW_FIDELITY_WIREFRAMES_ONLY`

`BUSINESS_SOURCE=doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`

`UI_INTERACTION_REF=doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md#3-用户旅途分析`

`IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md`

`DEXTER_FRAME_LIST_REVIEW=CONFIRMED_2026-09-20`

`DEXTER_WIREFRAME_REVIEW=CONFIRMED_2026-09-20`

`IMPLEMENTATION_AUTHORITY=false`

`IMPLEMENTATION=NOT_AUTHORIZED`

`IA_SOURCE_PRIORITY=本清单是用户旅途、可见字段、状态、文案和动作的语义正本；high-fidelity IA 仅负责同一 IA-ID 的位置、尺寸、形状、颜色、图标、字体和视觉 token；冲突先修两份 IA，不由详设或实施择一`

`SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f; ui-ux-pro-max@local`

## 1. 本工件的目的与修订边界

本工件先交付**线框图和 frame 清单**，让 Dexter 在进入高保真 IA 之前能看清每个状态的完整内容、移动端真实方向和双机拓扑的用户逻辑。它不冻结最终颜色、字体、像素、primitive props 或实现批次。

本轮根据 Dexter 的产品澄清做三处硬修订：

1. mobile 所有 frame 都是竖屏单列；导航是内容顶部固定的**单个下拉 selector**，展开后承载全部页面选项，不能横向并排展示两套 panel，也不能把 laptop 的左右栏压缩后当作 mobile。
2. 线框不是占位方块图。每个 frame 必须把用户能看到的标题、状态灯及状态文字、计数、字段、按钮、输入框、展开行、原因和结果画出来；规格表在下一阶段再补逻辑单位和精确尺寸，但线框不得隐藏这些内容。
3. topology 采用目标导向旅途：未配对时用户先选择“作为主机”或“作为副机”；主机目标是开启主机服务，副机目标是输入主机 IP 后直接配对；不画“查询主机身份”用户步骤。主机和副机都能主动解除配对；副机解除后直接回到目标选择，不单独生成“恢复主机”页面。

IA 正本优先级：本清单负责用户旅途、可见内容、状态、文案和动作的语义分母；高保真 IA 负责同一 IA-ID 的位置、尺寸、形状、颜色、图标、字体和视觉 token。高保真不得新增、删除或改写本清单的语义元素；发生冲突时先修两份 IA，详设和实施不得自行择一。

线框 HTML：[`assets/2026-09-19-ter-admin-console-non-login-ia-wireframes.html`](assets/2026-09-19-ter-admin-console-non-login-ia-wireframes.html)

该 HTML 是仓内静态设计资产，不启动 Web/Metro/Android，不读取运行时数据，也不代表实现授权。

## 2. Frame 总表

生产 frame 共 29 个，跨 tab 对照板 1 个，共 30 个视觉工件；Panel/ports/runtime 的单屏 frame 有 laptop 与 mobile 两个版本，runtime 双屏与双机拓扑可用旅途仅为 laptop，mobile topology 只有不可用 frame。`L` 表示 laptop 横向 panel，`M` 表示 mobile 竖向 panel。

### 2.1 Panel 框体：8 个生产 frame

| frame ID | 形态 | 状态 | 线框必须画出的可见内容 |
| --- | --- | --- | --- |
| `PANEL-L-NORMAL` / `PANEL-M-NORMAL` | laptop / mobile 竖屏 | 正常 | 面板标题、全局状态灯与文字、关闭入口；laptop 侧边导航；mobile 顶部单个下拉 selector、当前页面标记、内容滚动区 |
| `PANEL-L-EMPTY` / `PANEL-M-EMPTY` | laptop / mobile 竖屏 | 空态 | 同一框体；内容区明确“暂无可显示内容”、原因/下一步；mobile 仍保持顶部 selector 固定 |
| `PANEL-L-LOADING` / `PANEL-M-LOADING` | laptop / mobile 竖屏 | 载入 | 同一框体；载入状态灯、文字、骨架/进度占位；禁止显示尚未得到的数据 |
| `PANEL-L-ERROR` / `PANEL-M-ERROR` | laptop / mobile 竖屏 | 错误 | 同一框体；错误状态灯、可读错误结论、原因、重试动作；关闭入口仍可达 |

Panel 线框约束：laptop 为侧边导航区 + 内容区；mobile 为**顶部固定单个下拉 selector + 单列内容区**，selector 不随内容滚动，展开选项可容纳未来新增页面，内容不能横向溢出。

### 2.2 平台端口：4 个生产 frame

| frame ID | 形态 | 状态 | 线框必须画出的可见内容 |
| --- | --- | --- | --- |
| `PORTS-L-OVERVIEW` / `PORTS-M-OVERVIEW` | laptop / mobile 竖屏 | 分类收起 | tab 标题、总体状态灯、可用/不可用/未声明三项数量、同一分母的横条比例图、分类名称/数量/状态/展开图标 |
| `PORTS-L-CATEGORY-EXPANDED` / `PORTS-M-CATEGORY-EXPANDED` | laptop / mobile 竖屏 | 分类展开 | 上述总览不消失；至少一类展开；每条端口画名称、可用性、原因/来源（若有）、收起图标；其它分类仍是汇总行 |

mobile 端口 frame 中比例条、分类行和明细行都是单列；不把五类分类拆成并排小卡片，不用无限长全量列表替代展开。

### 2.3 运行状态：3 个生产 frame

| frame ID | 形态 | 状态 | 线框必须画出的可见内容 |
| --- | --- | --- | --- |
| `RUNTIME-L-SINGLE-SURFACE` / `RUNTIME-M-SINGLE-SURFACE` | laptop / mobile 竖屏 | 单屏 | 总体运行状态灯与文字、物理屏数量为 1、当前屏标题、按 surface 比例绘制的矩形；逻辑分辨率标在矩形内部长边/高边，物理分辨率标在矩形外长边/高边，就绪/可用状态在矩形内部 |
| `RUNTIME-L-DUAL-SURFACE` | laptop 横向 | laptop 单机双屏 | 总体运行状态、两块物理屏的矩形；每块先在矩形上方显示主屏/副屏标题，矩形按各自 surface 宽高比绘制；当前 surface 显示逻辑/物理分辨率和就绪/可用状态，非当前 surface 只显示存在性、主/副角色和“该屏信息未提供”，不显示分辨率或就绪状态 |

laptop 可以并列或主从展示两块屏；mobile 形态只有单屏 frame，不生成副屏卡片，也不把拓扑副屏冒充物理屏。若 mobile 输入事实声称存在多个 surface，`RUNTIME-M-SINGLE-SURFACE` 复用一个明确的 `display-facts-error` 变体：保留运行状态页、顶部 selector 和单列布局，显示 typed 异常/未提供原因，不生成第二块矩形。

### 2.4 双机拓扑整页不可用：2 个生产 frame

| frame ID | 形态 | 必须可见 | 严禁出现 |
| --- | --- | --- | --- |
| `TOPOLOGY-L-UNAVAILABLE` | laptop | 拓扑 tab、唯一结论“当前功能不可用”；双屏时原因是“**双机拓扑要求本机只有一个物理屏**” | 身份、地址、主机服务、配对结果、payload、历史操作、无关按钮 |
| `TOPOLOGY-M-UNAVAILABLE` | mobile 竖屏 | 拓扑 tab、唯一结论“当前功能不可用”；原因是“**mobile 形态不支持双机拓扑**”；顶部 selector 固定，结论与原因在单列内容中完整可见 | 身份、地址、主机服务、配对结果、payload、历史操作、无关按钮 |

### 2.5 双机拓扑可用旅途：12 个 laptop 生产 frame

下表只为 `laptop` 出可用旅途 frame。`mobile` 不支持双机拓扑，不生成主机/副机、IP、配对、解绑或角色恢复交互；mobile 仅保留 §2.4 的 `TOPOLOGY-M-UNAVAILABLE` 单一不可用 frame。状态名按用户目标命名，不把内部 `query-host` 画成用户步骤。

| 状态 | laptop frame ID | 必须画出的用户逻辑与动作 |
| --- | --- | --- |
| 未配对、选择目标 | `TOPOLOGY-L-ROLE-CHOICE` | 当前未配对；“作为主机”卡片含“开启主机服务”；“作为副机”卡片含主机 IP 输入与“直接配对”；两张卡片说明各自含义 |
| 主机服务启动中 | `TOPOLOGY-L-HOST-STARTING` | 目标为主机、服务启动中、不可重复提交、等待结果；不画身份查询或副机配对表单作为当前主动作 |
| 主机服务已可用 | `TOPOLOGY-L-HOST-READY` | “当前机器是主机/服务已开启”、本机 IP 地址、等待副机配对、服务状态；提供“关闭主机服务”，关闭后回到 `TOPOLOGY-L-ROLE-CHOICE`；不伪造已配对 |
| 主机服务失败 | `TOPOLOGY-L-HOST-ERROR` | 服务失败结论、可读原因、重试/回到目标选择；不显示已配对结果 |
| 副机直接配对中 | `TOPOLOGY-L-PAIRING` | 用户已提交主机 IP；显示输入过的安全摘要、配对进行中、不可重复提交；不出现“先查询身份” |
| 副机直接配对失败 | `TOPOLOGY-L-PAIR-ERROR` | IP/连接/协议失败的用户文案、保持输入可修正、重试直接配对、回到目标选择 |
| 主机已配对且可达 | `TOPOLOGY-L-MASTER-PAIRED-REACHABLE` | 主机角色、已配对、对端可达、服务状态、对端摘要、唯一主要动作“解除配对” |
| 主机已配对但重连中 | `TOPOLOGY-L-MASTER-PAIRED-RECONNECTING` | 已配对保持不变、重连状态灯与文字、服务状态、解除配对；不退回未配对表单 |
| 主机解除配对中 | `TOPOLOGY-L-UNPAIRING-MASTER` | 解除配对进行中、禁止重复提交、当前角色事实保留、结果反馈位置 |
| 副机已配对且可达 | `TOPOLOGY-L-SLAVE-PAIRED-REACHABLE` | 副机角色、已配对、对端可达、对端摘要、唯一主要动作“解除配对”；不显示开启主机服务作为当前配对动作 |
| 副机已配对但重连中 | `TOPOLOGY-L-SLAVE-PAIRED-RECONNECTING` | 已配对保持不变、重连状态灯与文字、解除配对；不显示查询身份或重新配对表单 |
| 副机解除配对中 | `TOPOLOGY-L-UNPAIRING-SLAVE` | 解除配对进行中、禁止重复提交、结果反馈位置；不可把状态先画成未配对 |
这 12 个状态均为 laptop 生产 frame。副机解除配对后直接回到 `TOPOLOGY-L-ROLE-CHOICE`，不单独生成恢复页面。主机和副机的“已配对/重连/解绑”分别成帧；未配对目标选择是共同入口，但其中两个目标卡片的动作集合必须明确不同。mobile 不进入这条可用旅途。

### 2.6 双机拓扑状态机对账：页面、变体与不可达项

本节把“画一个状态 frame”与“源码中确实存在一个可观察状态”分开。`TopologyFacts` 的持久事实是 `surfaceForm`、`displayCount`、`instanceMode`、`displayRole`、`paired`、`peerReachable`、`hostDesired`、`hostActual` 和错误/传输失败；`busy`、命令结果和局部错误属于操作中的短暂 UI 变体，不是新的拓扑页面。

| 状态机节点 | 源码条件/来源 | IA 处理 | 结论 |
| --- | --- | --- | --- |
| 全局不可用 | `evaluateTopologyOperation` 在非 laptop 或 `displayCount !== 1` 时拒绝操作 | `TOPOLOGY-L-UNAVAILABLE` / `TOPOLOGY-M-UNAVAILABLE` | 可达；这是整页闸，不进入角色旅途 |
| 未配对目标选择 | laptop、单物理屏、`paired=false`；通常为主机模式、服务停止 | `TOPOLOGY-L-ROLE-CHOICE` | 可达；主机服务与直接 IP 配对是两个目标 |
| 主机服务启动/运行/失败 | `hostActual` 的 `starting` / `running` / `error` | `HOST-STARTING` / `HOST-READY` / `HOST-ERROR` | 可达；是 host 生命周期变体，不改变配对事实 |
| 副机直接配对中/失败 | 一次 `pair` 命令的 busy/result；失败仍回到未配对事实 | `PAIRING` / `PAIR-ERROR` | 设计目标可达；当前 UI 仍强制先 `query-host`，这是实施契约差距，不是 IA 新页面 |
| 主机已配对可达/重连 | `instanceMode=MASTER` 且 `peerIdentity != null`；`peerReachable` 独立变化 | `MASTER-PAIRED-REACHABLE` / `MASTER-PAIRED-RECONNECTING` | 可达；重连不清除配对事实 |
| 主机解绑中 | `unpair` 的 busy 变体；成功应清除主机的对端事实 | `UNPAIRING-MASTER` | 用户目标必须保留，但当前 actor 在 `masterLocator === null` 时直接报“未配对”，因此成功边是源码阻断项，不能宣称当前已达 |
| 副机已配对可达/重连 | `masterLocator != null`、`instanceMode=SLAVE`；副机拥有 locator 并持续重连 | `SLAVE-PAIRED-REACHABLE` / `SLAVE-PAIRED-RECONNECTING` | 可达；断线仍保持已配对 |
| 副机解绑中及完成 | `unpair` busy 变体；actor 成功切回 `MASTER/CHIEF`、清 locator | `UNPAIRING-SLAVE` → `ROLE-CHOICE` | 可达；不需要、也不保留“副机恢复”独立页 |
| 操作失败/恢复 | capability 返回 `error`/`partial-failed`/`timed-out`，或 facts 的 `hostErrorCode`/`payloadFailure`；没有 `failureState` | 作为触发失败的源 frame 内联 `operation-feedback` / `failure.reason` / `retry` | 不生成独立页；`FAILURE-RECOVERY` 是无 owning state 的冗余抽象，已从本批生产 frame 删除 |

两个正交事实需要特别保留：`hostDesired/hostActual` 与 `paired/peerReachable` 不是一个枚举。主机即使已配对也可能被允许关闭主机服务，此时不应回到 `ROLE-CHOICE`，而应在主机已配对 frame 内显示服务的独立停止/异常变体；本轮不为它再造页面。`peerReachable=false` 也只表示已配对但暂时不可达，不能转成未配对。

源码差距登记：

1. `evaluateTopologyOperation` 按 `paired` 允许主机解绑，但 `apps/terminal/kernel/base/topology/src/features/actors/actors.ts` 的解绑 actor 先检查 `masterLocator`；真正的 MASTER 以 `peerIdentity` 表示配对而 `masterLocator` 为空，所以 `UNPAIRING-MASTER` 的成功转移当前不可达。该 frame 保留为已批准用户旅途的实现阻断，不把它误删为“无用页”。
2. IA 目标要求输入 IP 后直接配对；当前 `TopologySection` 仍将“查询身份”作为用户按钮，并在没有 identity 时禁用 pair。`query-host` 从 IA 页面删除是用户旅途收口，不代表当前实现已经满足，详设/实施必须闭合这一契约差距。

### 2.7 跨 tab 对照板：1 个非生产视觉工件

| frame ID | 形态 | 左侧运行状态语料 | 右侧拓扑语料 | 用途 |
| --- | --- | --- | --- | --- |
| `CROSS-TAB-L-DUAL-PHYSICAL` | laptop | 检测到两块物理屏；当前 surface 的逻辑/物理分辨率与状态可见，非当前 surface 只显示存在性、角色和“该屏信息未提供” | 当前功能不可用；双机拓扑要求本机只有一个物理屏 | 核对两处语义不冲突；mobile 不建立该对照帧，因为 mobile 不支持副屏 |

### 2.8 页面编号索引

线框 HTML 中每个 frame 卡片标题都会显示稳定编号。当前可见编号为 `IA-01` 至 `IA-29`、`IA-32`；原 `IA-30`（已撤销的副机恢复页面）与 `IA-31`（已撤销的泛化失败恢复页面）均不复用。编号按既有 frame ID 固定，后续详设、实现和 review 均使用该编号加 frame ID 指代页面；不要按浏览器当前滚动位置重新编号。

| 编号 | frame ID | 形态 |
| --- | --- | --- |
| `IA-01` | `PANEL-L-NORMAL` | laptop |
| `IA-02` | `PANEL-M-NORMAL` | mobile |
| `IA-03` | `PANEL-L-EMPTY` | laptop |
| `IA-04` | `PANEL-M-EMPTY` | mobile |
| `IA-05` | `PANEL-L-LOADING` | laptop |
| `IA-06` | `PANEL-M-LOADING` | mobile |
| `IA-07` | `PANEL-L-ERROR` | laptop |
| `IA-08` | `PANEL-M-ERROR` | mobile |
| `IA-09` | `PORTS-L-OVERVIEW` | laptop |
| `IA-10` | `PORTS-M-OVERVIEW` | mobile |
| `IA-11` | `PORTS-L-CATEGORY-EXPANDED` | laptop |
| `IA-12` | `PORTS-M-CATEGORY-EXPANDED` | mobile |
| `IA-13` | `RUNTIME-L-SINGLE-SURFACE` | laptop |
| `IA-14` | `RUNTIME-M-SINGLE-SURFACE` | mobile |
| `IA-15` | `RUNTIME-L-DUAL-SURFACE` | laptop |
| `IA-16` | `TOPOLOGY-L-UNAVAILABLE` | laptop |
| `IA-17` | `TOPOLOGY-M-UNAVAILABLE` | mobile |
| `IA-18` | `TOPOLOGY-L-ROLE-CHOICE` | laptop |
| `IA-19` | `TOPOLOGY-L-HOST-STARTING` | laptop |
| `IA-20` | `TOPOLOGY-L-HOST-READY` | laptop |
| `IA-21` | `TOPOLOGY-L-HOST-ERROR` | laptop |
| `IA-22` | `TOPOLOGY-L-PAIRING` | laptop |
| `IA-23` | `TOPOLOGY-L-PAIR-ERROR` | laptop |
| `IA-24` | `TOPOLOGY-L-MASTER-PAIRED-REACHABLE` | laptop |
| `IA-25` | `TOPOLOGY-L-MASTER-PAIRED-RECONNECTING` | laptop |
| `IA-26` | `TOPOLOGY-L-UNPAIRING-MASTER` | laptop |
| `IA-27` | `TOPOLOGY-L-SLAVE-PAIRED-REACHABLE` | laptop |
| `IA-28` | `TOPOLOGY-L-SLAVE-PAIRED-RECONNECTING` | laptop |
| `IA-29` | `TOPOLOGY-L-UNPAIRING-SLAVE` | laptop |
| `IA-32` | `CROSS-TAB-L-DUAL-PHYSICAL` | laptop (cross artifact) |

## 3. 稳定 IA-ID 注册表

ID 跨 laptop/mobile 复用；`L/M` 只属于 frame ID。每个 ID 必须在 HTML 线框中有可见代表，在下一阶段规格表中补精确逻辑尺寸、token、primitive 和交互事件。

### 3.1 Panel 与导航

`panel.header.title`、`panel.header.overall-status`、`panel.header.close`、`panel.nav.selector`、`panel.nav.active`、`panel.content.scroll-region`、`panel.empty`、`panel.loading`、`panel.error`、`panel.retry`。

### 3.2 平台端口

`ports.title`、`ports.overall-status`、`ports.summary.available`、`ports.summary.unavailable`、`ports.summary.undeclared`、`ports.summary.ratio-bar`、`ports.category.row`、`ports.category.status`、`ports.category.count`、`ports.category.expand`、`ports.item.name`、`ports.item.status`、`ports.item.reason`、`ports.item.source`。

### 3.3 运行状态与 surface map

`runtime.title`、`runtime.overall-status`、`runtime.physical-display-count`、`runtime.surface-map`、`runtime.surface.shape`、`runtime.surface.aspect-ratio`、`runtime.surface.role`、`runtime.surface.current`、`runtime.surface.logical-size`、`runtime.surface.physical-size`、`runtime.surface.ready-state`、`runtime.surface.legend`、`runtime.mobile.single-surface-boundary`。

### 3.4 双机拓扑

本节除 `topology.page-gate` 与 `topology.page-gate.reason` 外的交互 ID 只适用于 laptop 可用旅途；mobile 不绑定 `topology.goal.*`、`topology.host-ip`、`topology.pairing` 或 `topology.unpair`，只呈现不可用结论与原因。副机解绑后的回到目标选择是既有 `topology.goal-choice`，不新增恢复页面 ID。

`topology.page-gate`、`topology.page-gate.reason`、`topology.role`、`topology.goal-choice`、`topology.goal.host`、`topology.goal.slave`、`topology.host-service`、`topology.host-service.state`、`topology.host-ip`、`topology.pairing`、`topology.pair-result`、`topology.pair-state`、`topology.reachability`、`topology.counterparty`、`topology.unpair`、`topology.action-group`、`topology.action`、`topology.operation-feedback`、`topology.failure.reason`、`topology.retry`。

`topology.identity-query` 不再是 IA-ID，也不得在生产 frame 中出现。内部 `query-host` 如为实现闭合仍须在详设 action matrix 中登记，但不拥有用户画面。

## 4. 线框完整属性合同

HTML 线框中不再只画灰条。每个生产 frame 至少要把以下属性画出来或以可读文字写在对应控件内：

1. Panel：标题、全局状态灯、状态文字、关闭入口；laptop 的导航项；mobile 的单个下拉 selector、当前页面名称、展开指示和滚动边界。
2. Ports：三类总数、分母提示、比例条、每个分类的名称/状态/数量/展开状态；展开时每条能力的名称、状态、原因/来源占位。
3. Runtime：物理屏数量、每块实际屏幕矩形、矩形上方的主/副标题、当前标记；当前 surface 的逻辑分辨率写在矩形内部对应的长边和高边，物理分辨率写在矩形外对应的长边和高边，就绪/可用状态写在矩形内部；非当前 surface 只显示存在性、角色和“该屏信息未提供”，不显示分辨率或就绪状态；当前物理值缺失时数字位置显示“未知”。mobile 只画一块屏；多 surface 事实复用 mobile runtime 的 display-facts-error 变体，不画副屏占位。
4. Topology：当前角色、配对状态、可达状态、服务状态、目标卡片说明、主机 IP 输入、动作按钮、进行中文字、成功结论、失败原因和恢复动作。不可用帧仅画结论与原因。
5. 每个按钮必须画出动作名称和当前状态（可用、进行中或禁用及原因）；不能只画无文字矩形。
6. mobile 所有 frame：竖屏外框；顶部固定的单个下拉 selector（不是横排 tab）；内容按标题 → 总结 → 状态 → 主要动作 → 细节/恢复的单列顺序；不出现并排的 panel、双列 action group 或横向溢出。
7. laptop 所有 frame：横向 panel；导航与内容有明确边界；需要比较的 surface 或状态可并列，但不得牺牲字段完整性。

这些是线框阶段的内容完整性要求，不是最终视觉 token 或精确尺寸承诺。下一阶段 IA 规格表必须再逐个 IA-ID 给出位置、逻辑尺寸、形状、语义 token、图标、字体、背景、层级与 gap。

## 5. 不可越过的事实边界

- laptop 双屏 frame 必须画出两块真实 surface；当前 surface 标注逻辑/物理分辨率与就绪/可用状态，非当前 surface 只标真实存在性、主/副角色和“该屏信息未提供”，并按真实 surface 宽高比绘制。两块 surface 都必须表达，不得复制或补全 non-current 的分辨率/状态。mobile 不生成双屏 frame。
- 拓扑整页不可用 frame 只画一条结论和一条可读原因，不画身份、地址、服务、配对结果、payload 或历史。
- `MASTER/SLAVE`、`CHIEF/VICE` 在画面中翻译成用户语言；不得把内部 union、locator、JSON 或 reason code 当主要文案。
- 未配对时画“作为主机 → 开启主机服务”和“作为副机 → 输入主机 IP → 直接配对”两个目标；不画“查询主机身份”。
- 已配对主机与副机都画“解除配对”；副机解除后的下一步回到既有目标选择 frame，由该 frame 提供“作为主机/开启主机服务”入口。
- 当前源码的 `pair` 仍要求 identity payload、actor 仍以 MASTER/CHIEF 进入配对；这是详设必须闭合的契约差距，线框不能把它伪装成当前已实现。
- 不能为了 IA 完整而扩展 display facts、topology owner、Android 公共契约或业务 feature；如确需扩展，按需求 §9.3 停止并报告 Dexter。

## 6. Frame inventory 静态自检

`PRODUCTION_FRAME_COUNT=29`

`CROSS_TAB_ARTIFACT_COUNT=1`

`TOTAL_WIREFRAME_COUNT=30`

`LAPTOP_AND_MOBILE_COVERAGE=Panel/ports/runtime 单屏 frame 有 L/M；runtime 双屏和 topology 可用旅途仅有 laptop；mobile topology 只有 unavailable frame`

`MOBILE_NAVIGATION=顶部固定单个下拉 selector，可承载全部页面，不是横向 tab，不是桌面布局换行`

`TOPOLOGY_GLOBAL_STATE=unavailable`

`TOPOLOGY_USER_FLOW=laptop-only: role-choice -> host-service OR direct-ip-pair -> paired -> reconnect/unpair -> role-choice; mobile=unavailable-only`

`TOPOLOGY_QUERY_HOST_UI=REMOVED`

`TOPOLOGY_UNPAIR=MASTER_AND_SLAVE`

`TOPOLOGY_SLAVE_AFTER_UNPAIR=ROLE_CHOICE_VISIBLE`

`TOPOLOGY_STATE_MACHINE=global-unavailable -> role-choice -> host-lifecycle OR direct-ip-pair -> master/slave paired -> reachable/reconnecting -> unpair -> role-choice; operation failures are inline source-state variants`

`WIREFRAME_CONTENT=all visible labels, statuses, fields, counts, reasons and actions are drawn`

`IMPLEMENTATION=NOT_AUTHORIZED`

## 7. Dexter 确认点

请 Dexter 先确认这份修订后的 frame inventory 与低保真线框是否进入下一阶段。特别请确认：

1. mobile 统一采用竖屏 panel，单个下拉 selector 固定在内容顶部，并可承载未来新增到十个页面的选项；mobile 运行状态只画一个屏幕；
2. 线框中已画出完整的用户可见字段、状态、原因和动作，而不是用占位条代表未知内容；
3. topology 按“作为主机开启/关闭服务 / 作为副机输入主机 IP 直接配对 / 主副机均可解除 / 关闭服务或副机解除后回到未配对目标选择”组织；
4. `query-host` 从用户旅途与生产 frame 中移除；
5. 当前 surface 必须在矩形内显示逻辑分辨率的长边/高边标注，矩形外显示物理分辨率的长边/高边标注和状态；非当前 surface 只显示存在性、主/副角色和“该屏信息未提供”，不显示分辨率或就绪状态；矩形比例跟随真实 surface；当前公开 display-facts owner 不足时，物理数字位置显示“未知”，并登记为详设 blocker，不在 IA 阶段伪造数据或修改源码。

确认前不生成高保真 IA 规格，不写 implementation design，不写实施计划，不修改源码、测试、依赖、脚本或构建产物。
