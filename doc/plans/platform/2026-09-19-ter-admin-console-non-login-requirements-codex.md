# TER Admin console 非登录区视觉与交互重构需求

状态：`PROPOSED_FOR_DEXTER_AND_CLAUDE_REVIEW`

日期：2026-09-19

评审对象：需求与范围（`REVIEW_TARGET=DESIGN`）

实现授权：`false`

动态验证授权：`false`

独立审查：`INDEPENDENT_SUBAGENT_REVIEW=ROUND_1_COMPLETE`

独立审查留痕：`doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-independent-review-codex.md`

## 0. 这份文档解决什么问题

本批只处理 TER Admin console 登录成功之后的非登录区域。当前 Admin console 能够展示和操作一些真实的诊断与拓扑事实，但界面仍主要按源码字段逐行输出：用户需要自己从多行技术值中推断“现在是否正常、哪里不可用、下一步该做什么”。mobile 形态基本是 laptop 结构的换行版本，不能视为针对窄屏重新设计的交互。

本批的目标不是把技术字段换一套颜色，也不是把所有信息搬进新的卡片，而是建立一套面向现场操作人员的观察与操作路径：

1. 用户打开 Admin console 后，先得到当前终端是否正常、有哪些问题、问题是否影响操作的结论。
2. 用户可以先看总量和状态，再按需要展开小范围细节，不必阅读一条无层次的长列表。
3. 用户能同时理解当前终端的主屏、副屏和运行状态；单机双屏不能只显示当前 surface 的一面。
4. 双机拓扑先回答“本机是否支持、当前角色是什么、当前配对和连接处于什么状态”，再提供当前角色真正能执行的操作；不相关信息不占据页面。
5. laptop 与 mobile 是同一业务语义的两种交互形态。mobile 不是把 laptop 的列布局压缩或简单换行。
6. shared Admin shell 不持有 sample 应用身份色；基础控件与语义 token 由 primitives/foundation 提供，具体颜色由各 integration theme 注入。

这是一份需求稿，不冻结组件树、CSS 类名、hook 形态、具体像素值或实现批次。那些内容在本稿获得评审通过后进入 IA、详设和实施计划。

## 1. 权威范围与现状事实

### 1.1 本批权威输入

当前源码是事实源。以下旧文档只用于理解历史背景，不构成本批的行为授权，也不能覆盖当前源码：

- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md`
- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md`
- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md`
- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md`
- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md`

本稿的源码核验入口：

- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`
- `apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx`
- `apps/terminal/kernel/base/contracts/src/types/topology.ts`
- `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`
- `apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts`
- `apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts`
- `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts`
- `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`
- `apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt`
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
- `apps/terminal/ui/base/primitives/`
- `apps/terminal/ui/integration/sample-console/theme/`
- `apps/terminal/ui/integration/sample-wallpaper-console/theme/`

### 1.2 当前 Admin console 的组成

`admin-shell/src/parts/parts.ts` 当前注册了以下非业务 section：

| 当前 part | 当前标题 | 本批处理 |
| --- | --- | --- |
| `admin.console.platform-ports` | 平台端口 | 保留为用户 tab，重做信息层级与状态摘要 |
| `admin.console.runtime` | 运行状态 | 与显示上下文合并为一个用户 tab |
| `admin.console.display-context` | 显示上下文 | 与运行状态合并，不再作为独立用户 tab |
| `admin.console.topology` | 双机拓扑 | 保留为用户 tab，按资格、角色和旅途重做 |

因此，本批**源码上覆盖四个现有 part，用户可见上收口为三个 tab**：平台端口、运行状态、双机拓扑。`runtime` 与 `display-context` 的重复导航入口必须消失，但二者承载的事实不能因合并而丢失。

以下对象不属于四个 tab 的内容：

- `admin.console` 的登录页及登录流程；
- feature 注入到 Admin panel 中的业务页面；
- `admin.console.power-confirmation` 这一独立的电源角色确认 alert/layer；
- member、wallpaper、staff-auth 等业务 feature 的页面、数据和命令；
- 双机拓扑 kernel、transport、Android host、协议和持久化机制本身。

### 1.3 已确认的架构边界

1. Admin shell 通过 section catalog 与 typed capability 消费事实和操作，不得直接读取 topology 的内部 state，也不得让 UI 自己重算 `paired`、`peerReachable` 或操作资格。
2. `TopologyAdminCapability` 是双机拓扑 UI 的操作边界；`selectTopologyFacts` 和 `evaluateTopologyOperation` 是现有事实/资格 owner。后续若本批所需事实不足，必须在详设中指定 owner 与公开 read model，不能让 Admin shell 反向绕过边界。
3. `peerReachable` 与“是否已配对”是两个正交事实。已配对但暂时不可达，应显示重连状态，不能被 UI 改写成未配对，也不能因此把副屏语义降级。
4. 双机 feature 的写入归属正本是：`MAIN` 只能由主机 actor 执行 command 写入 slice，`BRANCH` 只能由副机 actor 执行 command 写入 slice。Admin UI 不得借重排版重做这条机制。
5. `resolveSecondarySurfaceAvailable` 的物理显示语义不是本批可随意替换的 Admin UI 判据。拓扑的“拓扑副屏可用”与物理显示信息必须分开呈现。
6. 当前 primitives 已有 container、card、stack、grid、tabs、status、data row、list、table、progress、badge、alert、skeleton、spinner 等能力。若本批缺少聚合比率、可展开分组或 surface map 的通用表现能力，应扩充 shared primitive/token，而不是在 admin-shell 或两个 integration 各自复制一套。

### 1.4 已确认的 surface 口径变更记录

Dexter 于 2026-09-28 明确裁定并取代此前“非当前 surface 不显示尺寸与状态”的限制：单机双屏必须读取并显示副屏信息。此后所有真实 surface（包括非当前 surface）均显示各自的角色、应用逻辑画布分辨率、物理分辨率及就绪/可用状态；任何字段只能来自该 surface 自己的事实，不得从另一块屏复制。设备逻辑显示区域仍逐屏读取，但仅用于矩形外形比例，不显示“设备显示区域：宽×高”数值字段。

术语也在此冻结：**逻辑画布就是逻辑分辨率**，其唯一值源是应用传入的逐 surface `terminalSurfaces` 声明；不得把 Android `Display.getRealMetrics()` 的像素除以 density 所得设备逻辑显示区域冒称应用逻辑分辨率。设备逻辑显示区域与物理像素是独立事实；设备逻辑显示区域仅用于矩形比例，不显示数值标签。当前两个 Android application package 的横屏 PRIMARY、SECONDARY 画布均为 `1280×720`；当前真机设备逻辑区域为 `1280×720`、物理尺寸为 `1920×1080`，不得互相覆盖。

## 2. 用户与用户任务

### 2.1 主要用户

本批面向需要在终端现场快速判断设备状态、平台能力和双机连接状态的管理员或维护人员。用户不应被要求知道 `surfaceForm`、`instanceMode`、`displayRole`、`hostActual`、`payloadFailure` 等内部术语才能做出判断。

### 2.2 用户真正需要回答的问题

打开 Admin console 后，用户按优先级需要回答：

1. 终端现在是否可用？如果不可用，影响在哪里？
2. 平台能力中有多少可用、多少不可用、多少尚未提供？不可用项属于哪类，名称是什么，原因或来源是什么？
3. 当前运行环境和调试状态是什么？当前设备有几个屏幕，每个屏幕的主/副身份、画面状态和分辨率是什么？
4. 双机拓扑是否适用于这台机器？如果适用，本机是主机还是副机，是否已配对，是否可达，下一步能执行什么？
5. 如果不能执行某个动作，原因是产品资格限制、当前状态限制、暂时不可达，还是实际失败？

### 2.3 不应要求用户完成的推理

- 不应要求用户从十几行端口能力中自行统计总数。
- 不应要求用户把 `MASTER/SLAVE`、`CHIEF/VICE` 直接翻译成主机/副机和屏幕角色。
- 不应把“承载几何”“实例模式”“画布模式”作为主文案让用户自行理解。
- 不应把当前 surface 的一行尺寸当作整台设备的显示上下文。
- 不应在拓扑不支持时让用户先阅读身份、端口、locator、payload 或历史操作结果。
- 不应让副机看到只能由主机执行的服务开关，也不应让未配对状态看到只对已配对状态有意义的操作。

## 3. 用户旅途分析

### J-0：打开 Admin console

**触发**：用户完成登录并打开 Admin layer。

**用户目标**：确认面板已经处于可操作状态，并选择要诊断的方向。

**当前问题**：`AdminShellFrame` 主要只有标题、关闭按钮和 children；laptop 有侧边导航，mobile 主要是可换行 tab。两者没有共同的状态摘要层，mobile 也没有为窄屏建立独立的信息优先级。

**目标体验**：

1. 面板头部明确显示“终端管理”和当前整体状态摘要；关闭入口始终可见，不被滚动内容遮挡。
2. laptop 采用清晰的导航区与内容区层级；mobile 采用竖屏单列内容流，并在内容顶部固定一个下拉 selector。selector 展开后可以选择全部可用页面，不把所有 tab 横向铺开，也不是把 laptop 的宽度规则压缩后换行。
3. 首次进入时的默认 tab、已选 tab、滚动位置和关闭后的焦点/层状态必须在 IA 与详设中明确；不能因视觉改造破坏现有 layer、surface 和输入焦点生命周期。
4. feature 注入页继续由 catalog/renderer 负责，非登录框重构不得把业务 feature 的页面内容塞进 Admin shell 基础布局。

### J-1：查看平台端口

**触发**：用户选择“平台端口”。

**用户目标**：先知道平台能力总体健康度，再定位不正常的一小组端口。

**当前问题**：`PlatformPortsSection` 把 capability 展成一张平面长列表；用户要自己统计 `real/unavailable/missing`，来源和类型也没有按任务分组。

**目标体验**：

1. 顶部先显示能力总览：可用、不可用、未提供/未声明的数量，并用横条比例图表示分布。分母必须明确，不能把端口数量与 capability 数量混成一个百分比。
2. 下面显示有限数量的用户任务分类，例如日志与诊断、设备与系统、连接与拓扑、存储与状态、脚本与更新；最终分类名称与每个端口的归属在 IA/详设中冻结，十个现有端口必须各归一处、不得重复或漏掉。
3. 分类默认显示汇总状态和数量；展开后只显示该分类下的端口/能力名称、状态和必要的来源或原因。收起后不保留长列表占据主要空间。
4. 点击“不可用”或“未提供”类别时，应直接得到对应名称集合和可读说明，不需要在全量列表中人工寻找。
5. 当没有 capability 或 descriptor 缺失时，摘要必须诚实显示“未提供/未声明”，不能渲染成“可用”或把缺失静默过滤掉。
6. 平台端口的原始能力和来源仍需可追溯，但来源不应压过用户首先关心的可用性结论。

### J-2：查看运行状态与显示上下文

**触发**：用户选择“运行状态”。

**用户目标**：判断终端运行是否正常，并理解整台设备的显示布局。

**当前问题**：`RuntimeSection` 与 `DisplayContextSection` 分成两个 section；前者是状态行，后者只描述当前 surface，且包含面向实现的“承载几何”等术语。单机双屏时，用户看不到另一块屏的完整情况。

**目标体验**：

1. 一个“运行状态”tab 同时承载总体运行状态、环境/调试/设备可用性和所有相关 display surface 的状态；导航中不能出现重复的“运行状态/显示上下文”两个入口。
2. 顶部先给出总体运行结论和红/黄/绿/灰状态含义；详细信息按用户问题分组，而不是把原始字段逐行堆叠。
3. laptop 单机双屏必须同时呈现 PRIMARY 主屏和 SECONDARY 副屏；mobile 设备按本批支持形态只有一个屏幕，不得画副屏卡片或把拓扑副屏冒充 mobile 的物理屏。单屏设备只呈现真实存在的屏幕，不能伪造副屏；双机副屏场景仍必须按当前 topology/display facts 区分物理屏与拓扑副屏语义。
4. 每个实际显示屏以可识别且符合该 surface 设备显示区域宽高比的矩形/卡片表现其形状和角色。矩形内标注该 surface 的逻辑画布分辨率（即应用配置的逻辑分辨率）及就绪/可用状态；物理像素分辨率标在矩形外。设备逻辑显示区域由对应 display-facts owner 提供，仅用于矩形比例，不显示为数值字段。主屏和副屏都展示角色、逻辑分辨率、物理分辨率和状态，不能因 current/non-current 隐藏字段，也不能从另一块屏复制字段。应用逻辑分辨率必须来自逐 surface `terminalSurfaces` 声明；缺失时显示“未声明/未知”，不得用另一类尺寸或推算值冒充。
5. 画面状态用用户语言表达，例如主屏/副屏、已就绪/正在准备/不可用/暂时不可达；不得把 `surfaceKey`、`displayIndex`、`instanceMode` 或“承载几何”直接作为主要文案。
6. 运行状态与显示上下文的合并不能改变既有生命周期语义：runtime 未 started、资料未就绪、数据缺失和实际错误必须可区分；不能仅凭某个 selector 返回 `undefined` 推断 runtime 生命周期。
7. laptop 下应优先使用足够大的并列或主从视觉关系，让两个屏幕、各自逻辑/物理分辨率和运行摘要可以同时阅读；mobile 下只展示一个实际屏幕，使用竖屏单列/紧凑分区，不得生成副屏卡片，不得把矩形压到不可辨认或产生横向溢出。

### J-3：进入双机拓扑

**触发**：用户选择“双机拓扑”。

**用户目标**：知道当前机器能不能使用双机拓扑；如果能，知道自己处于哪一步并完成下一步操作。

**当前问题**：`TopologySection` 目前把形态、物理屏数、配对、连接、服务、地址、身份查询、配对、解绑、服务开关和多个原因行全部平铺。用户难以判断当前状态，也容易看到不适用于本机角色的控件；其中“查询主机身份”还是一个实现步骤，不是用户要完成的目标。

**目标体验**：

1. tab 永远可见，但全局资格不可用时必须先呈现一个单一、清楚的“功能不可用”状态和原因；当本机不满足全局拓扑资格时，不展示身份、地址、服务、配对结果或 payload 等次级信息和操作。角色或当前状态导致某一个 operation 不可用，不等于整页拓扑不可用；只要 owner 判定仍有合法操作，页面必须保留该操作所需的最小状态与动作。
2. 拓扑资格的事实必须由 topology owner 提供。UI 不得自己根据字段拼出另一套资格结论。资格限制、当前状态暂不允许、暂时不可达、实际操作失败必须使用不同的用户语言。
3. 支持范围必须尊重既有裁定：拓扑只适用于 laptop + 单物理屏；mobile 和 laptop 双物理屏不提供拓扑操作。tab 仍显示，原因可读，不能通过隐藏 tab 假装不存在。
4. 允许进入拓扑旅途后，第一屏先显示当前节点的用户角色、配对状态、连接状态和主机服务状态，并给出“我要把当前机器作为主机/副机”的目标选择，而不是先列原始身份字段。
5. 主机与副机的操作集合必须按 owner eligibility 分开决定，不能显示同一套选项。任何当前角色不能执行的操作不得作为看似可用的按钮出现。若为了保持一致性必须保留一个不可用动作，必须在动作旁显示原因，且不能让用户误以为点击会改变状态。具体哪一个角色显示哪一个动作，必须由详设按当前 topology capability 与源码逐 operation 冻结，不能在需求层猜测。详设必须逐一分类 `TopologyOperation` 当前 union 中的每个 operation：它是用户动作、仅用于资格判断、还是明确不属于本批；不能因为 capability 当前没有同名 command 方法而静默遗漏。
6. 未配对状态应让用户直接选择目标：作为主机时开启主机服务；作为副机时输入主机 IP 并直接提交配对。用户旅途中不得出现“查询主机身份”这一独立按钮、独立步骤或必须先确认身份的中间页；配对结果由一次提交后的进行中/成功/失败状态直接反馈。已配对状态应显示对端身份和当前连接/重连状态；连接暂时不可达不能改写为“未配对”。
7. 配对、解绑、开启/关闭主机服务等操作要有明确的进行中、成功、失败和恢复路径。失败信息必须给出下一步可执行建议；固定端口、地址、协议错误等内部 reason 不得直接作为用户文案。
8. 断线重连是状态的一部分，不是把页面退回未配对。用户应看到“已配对、正在重连/暂时不可达”等结论，且不会看到与当前状态无关的配对初始化表单。
9. 拓扑页面不得暴露原始协议 payload、内部 locator、JSON、状态 union 或调试日志作为主信息；必要的地址/身份信息必须在明确的上下文中以用户可识别方式呈现。

## 4. 需求条目

以下条目是本批范围冻结的“必须成立什么”。它们不规定实现机制。

### R-1 范围与导航收口

本批必须覆盖 Admin shell 的非登录 panel 框体、`platform-ports`、`runtime`、`display-context`、`topology` 四个现有非业务 part 的用户呈现；用户导航必须收口为三个页面：平台端口、运行状态、双机拓扑，其中 runtime 与 display-context 不能继续以两个独立页面出现。laptop 可使用侧边导航；mobile 必须使用内容顶部固定的单个下拉 selector，selector 选项集合可容纳后续新增页面。

### R-2 登录与业务边界保持

本批不得改变 Admin 登录、认证判断、密码输入、虚拟键盘、Admin layer 打开/关闭、feature 注入页面、业务 feature owner/command/actor/state 或电源确认 alert 的业务语义。任何为了承载新视觉而改变这些边界的方案均属 scope drift。

### R-3 Panel frame 的用户层级

panel 必须提供稳定且可识别的头部、关闭入口、导航区、当前内容区和全局状态提示层级。内容滚动不得覆盖关闭入口，空态、加载态、错误态和正常态必须有不同的可读表现。laptop 与 mobile 必须分别满足其屏幕约束，不能以单一桌面布局压缩为 mobile；mobile 的导航必须是顶部固定的单个下拉 selector，而不是一排横向 tab。

### R-4 两种形态的交互等价与差异化

laptop 与 mobile 必须展示相同的业务事实、状态、文案语义和可执行操作；布局、导航、展开方式、内容流和操作触达方式可按屏幕形态不同而不同。laptop 可用侧边导航，mobile 用顶部固定的单个下拉 selector 选择当前页面；mobile 方案必须针对窄屏完成信息优先级设计，不得仅凭 `flexWrap` 或缩小字号声称完成适配。

### R-5 共享 primitives 与 integration theme

Admin shell 的公共面板、导航、摘要、状态、可展开分组、比例图和显示 surface 表现必须优先使用 `ui/base/primitives` 的现有能力；缺少的通用能力应扩充 primitives 和语义 token。admin-shell 不得写死 sample 的品牌色、十六进制色或单一 integration 的固定青色/红色/蓝色。两个 integration 必须能为同一组语义 token 注入各自 theme 值，且不因本批新增 UI 而在两个 app 内复制一套 Admin 控件。

### R-6 平台端口聚合优先

平台端口页面必须在明细前提供可读的状态总览，至少区分可用、不可用和未提供/未声明，并用横条比例图表达数量分布。比例条采用统一的能力单位分母：每个真实 capability 一个单位，缺失 descriptor/空 capability 的 port 恰好一个合成“未声明”单位；分类和展开必须沿用同一单位模型。不能以一个不明口径的百分比冒充健康度。

### R-7 平台端口分类与有限展开

平台端口明细必须按稳定的用户任务分类呈现，而非全量平面列表。每个现有 port/capability 只能归入一个明确分类；分类默认展示数量和总体状态，用户主动展开后才显示该分类的有限明细、名称、状态和必要来源/原因。不得因为当前数量小就取消层级，也不得引入无上限的嵌套列表。

### R-8 运行状态与显示上下文合并

用户必须通过一个“运行状态”入口同时获得 runtime status、环境/调试/设备可用性和显示上下文。既有事实不能因导航合并而丢失；重复的 runtime/display-context 入口、重复标题和重复状态摘要必须消除。

### R-9 全 surface 的显示表达

运行状态页面必须表达当前设备上下文中所有真实相关的 surface。单机双屏时必须读取并同时显示主屏与副屏的逐屏信息；单屏时不得伪造第二屏。

- 每个 surface 都必须显示主/副角色、该屏逻辑画布分辨率、物理像素分辨率和就绪/可用状态；不得按 current/non-current 隐藏尺寸字段。应用逻辑分辨率来自该屏的 `terminalSurfaces` 声明，设备逻辑显示区域与物理像素来自同一个 surface 的 display facts；设备逻辑显示区域只用于矩形宽高比、不显示数值字段。任一 surface 都不得复制另一块的值。矩形宽高比使用该 surface 的设备逻辑显示区域，缺失时使用该 surface 物理像素尺寸；不得以应用画布比例冒充设备外形。
- mobile 形态只呈现一个实际 surface；如果输入事实声称 mobile 有多个 surface，页面必须在同一“运行状态”页显示 typed display-facts 异常/未提供态（复用 `IA-14` 的 error variant），而不是画第二块屏。
- 任一 surface 的物理分辨率/物理尺寸只有在权威数据可用时才能显示；不得把另一块 surface 的值复制过来，也不得为了填满矩形而伪造数据。缺失时，物理分辨率对应的数字位置必须显示“未知”。

### R-10 显示图形与语言

显示上下文不得以“承载几何”等面向实现的术语作为用户主信息。必须用主屏、副屏、逻辑分辨率、物理分辨率、画面状态等用户可理解的语言，并用矩形/卡片让用户比较屏幕。每块矩形按本屏设备逻辑显示区域宽高比绘制；框内标注应用逻辑画布分辨率（即逻辑分辨率）和状态，框外标注该屏物理像素尺寸。设备逻辑显示区域只决定矩形比例，不显示数值标签。当前与非当前 surface 字段相同，区别仅为当前标记和视觉强调。缺失的应用画布显示“未声明”，缺失的物理事实显示“未知”，不得复制或推算。

### R-11 运行状态的分层与状态灯

运行状态页面必须先给出总体状态，再给出环境、调试、设备和 surface 细节。状态灯颜色必须由稳定的语义状态映射而来，并提供文字，不得只靠颜色；至少区分正常、进行中/等待、警告/暂时不可用和错误/不可用。runtime 生命周期、数据缺失、业务空值和错误不能合并成一个“未就绪”。

### R-12 双机拓扑资格闸

双机拓扑 tab 必须始终可见。若当前形态、物理屏数、拓扑 capability 缺失或其它**全局**资格不满足拓扑操作条件，页面必须只显示“当前功能不可用”和可读原因，不展示不相关的身份、配对、主机服务、payload 或历史操作明细。mobile 形态是不支持双机拓扑的独立原因，用户文案应为“mobile 形态不支持双机拓扑”；laptop 双物理屏则使用“**双机拓扑要求本机只有一个物理屏**”。角色、配对状态、连接状态和其它 operation-level 条件只限制对应动作，不得把仍有合法动作的整页折叠为不可用。全局资格与 operation eligibility 均由 topology owner 提供，UI 不得重算。全局资格必须通过 topology owner 提供的整页可用性 read model 或等价的 page-level reason 输出；在该 owner 之前，Admin shell 不得读取代表性 operation 的 reason 或 raw facts 自行拼出整页 gate。

### R-13 拓扑角色与操作分层

双机拓扑在可用时必须按本机角色和当前状态提供不同的用户信息与操作集合。主机与副机不能显示同一套选项；已配对、未配对、正在重连、服务启动中、操作失败等状态只能显示与当前状态有意义的动作。操作可用性和原因必须来自 typed owner capability，不能由页面组件自行拼接布尔值。

### R-14 拓扑状态旅途

双机拓扑的可用用户旅途只适用于 laptop，必须覆盖未配对目标选择、主机服务启动/可用/失败、主机服务已可用时主动关闭服务、输入主机 IP 直接配对、配对进行中、配对完成、已配对可达、已配对重连、主机解绑、副机解绑和操作失败/恢复等用户状态。主机服务关闭后回到 `TOPOLOGY-L-ROLE-CHOICE`；副机解除配对后也不单独进入“恢复主机”页面，而是回到 `TOPOLOGY-L-ROLE-CHOICE`，用户可从未配对目标选择重新决定开启主机服务或直接输入主机 IP 配对。每个状态必须有唯一的主结论、下一步和必要的反馈；不得让用户从一堆互相独立的状态行自行推断当前步骤。mobile 不提供“作为主机/作为副机”、输入 IP、配对、解绑或角色恢复交互，只显示整页“当前功能不可用”及“mobile 形态不支持双机拓扑”。`query-host` 可以作为内部实现能力存在，但不得作为用户可见旅途步骤。

### R-15 拓扑不可达与失败语言

拓扑页面必须把资格不可用、未配对、已配对但暂时不可达、主机服务异常、身份失败、协议/超时/地址错误等内部 reason 转译为用户可理解的状态和下一步。对端暂时不可达不得显示为已解除配对；持续重连时页面应保持已配对语义。用户不应直接看到 `MASTER`、`SLAVE`、`CHIEF`、`VICE`、`TOPOLOGY_*` 或 wire payload 作为主要文案。

### R-16 数据来源与 owner 不漂移

所有可见状态、计数、surface 信息和拓扑操作结果必须来自其现有 owner 或详设中明确的公开 read model/capability。Admin shell 不得直接读取 kernel 私有 slice，也不得复制 topology/display-context 的判定逻辑。业务 feature 页面仍按原 owner 渲染，不能因 Admin panel 改造而把业务写入权移入 UI。拓扑 action matrix 的分母必须同时覆盖 `TopologyOperation` union、`TopologyAdminCapability` 实际 command surface 和 owner 提供的 eligibility/reason；laptop 用户动作必须覆盖“开启主机服务”“输入主机 IP 直接配对”“解除配对”，且主机与副机都必须有解除配对路径。mobile 不生成这些用户动作，只显示形态不可用原因。缺少 command 的 operation 必须显式标为非本批或资格-only，而不能由 UI 自行补一条 command；`query-host` 即使暂时保留在内部 command surface，也只能作为直接配对内部实现细节，不能生成用户按钮或独立状态帧。整页资格 read model 也属于 topology owner 的公开边界，不能由 Admin shell 从 operation 结果反推。

### R-17 响应式内容可达性

两种形态下，panel、页面 selector、摘要、展开明细和 surface map 都必须可到达、可滚动、可关闭；laptop 的拓扑操作也必须满足这一点。mobile 的 topology 页面只显示不可用结论与原因，不出现拓扑操作控件；mobile 其它内容必须有明确的单列优先级和折叠策略，顶部下拉 selector 固定可达；laptop 必须利用宽度建立导航/内容和并列信息层级。具体尺寸和像素值留给 IA。

### R-18 展开与反馈交互

端口分类、运行状态细节和 laptop topology 步骤的展开/收起必须有明确的当前状态，展开后不会无故重置用户正在看的组。进行中的 topology 操作必须防止重复触发，并反馈成功、失败和恢复；mobile 不出现 topology 操作；面板切换和关闭不能破坏既有 command/layer/input 生命周期。

### R-19 订阅与渲染边界

实现必须继续遵守终端 selector 订阅规范：页面只订阅自身需要的窄事实，派生摘要与展开状态保持可预测的 identity，不能用全 root 订阅或每次通知都新建等价对象把整个 Admin panel 重渲染。详设必须列出每个 tab 的完整订阅分母（selector、render context 值、capability/context identity 和 equality），并为全 root 订阅、等价对象漂移和无关 slice 变更分别指定可证伪的 red mutation 或说明为何属于非适用。此条只冻结订阅边界，不在本需求中声称性能提升幅度。

### R-20 数据诚实与证据边界

没有权威来源的数据必须显示未提供/未知，而不是从逻辑尺寸、当前 surface 或其它字段推导出物理事实。设计阶段的结构测试不能宣称视觉美观、像素一致或真实设备可用；后续 IA/详设必须为用户可见的布局、颜色、状态灯、surface map 和拓扑步骤指定可复核的观察方式。

## 5. 业务语义与事实边界

### 5.1 平台端口的计数对象

当前 `PlatformPortsSection` 的真实输入是 `runtimeFacts.platformPortCapabilities`，每个 snapshot 可能有多个 capability，也可能是缺失 descriptor/空 capability。本需求冻结**能力单位分母**：每个真实 capability 是一个计数单位；`missing-descriptor` 或空 capability 的 port 各贡献恰好一个合成的“未声明”单位，并进入同一根比例条的分母。一个 port 不能同时因为缺失 descriptor 贡献多个单位。

因此后续详设必须遵守以下不变量：

- `可用`、`不可用` 和 `未提供/未声明` 使用同一个能力单位分母；真实 capability 按其状态计数，缺失/空 port 按合成“未声明”单位计数；
- 合成单位不得静默归入可用或不可用，必须能在分类展开中以对应 port 名称和“未声明”状态出现；
- 摘要、分类和展开明细必须使用同一单位模型，展开所有分类后的单位数量之和必须等于摘要分母；
- 来源字段是诊断追溯信息，不得代替状态结论。

本稿提出的初始用户分类方向是日志与诊断、设备与系统、连接与拓扑、存储与状态、脚本与更新。这个方向用于冻结用户信息架构，不冻结最终中文名或组件形式；详设必须回源码逐一映射当前 port/capability，找不到合理归属的条目须在评审前提出。

### 5.2 运行状态与 display facts

当前 display-context 已通过公开 `DisplayInfo.surfaces[]` 为每块实际屏幕提供 `logicalSize`（Android real metrics 除以该屏 density 得到的设备逻辑显示区域）、`physicalSize`（该屏物理像素尺寸）和 readiness；旧 Admin 投影只描述当前 surface，导致已有副屏事实被 UI 隐藏。应用逻辑画布则来自 integration assembly 已解析的逐屏 `surfaceDeclarations`，不属于 display facts；应用 package 配置 `1280×720` 是这项事实的来源。此前 render runtime facts 未承载画布声明，且 Admin 把设备逻辑显示区域误标为逻辑分辨率，故本次修复补齐应用画布数据流并明确区分两种尺寸。

需求不允许实现方：

- 复制一份不受 owner 管理的 display state；
- 用当前 surface 的尺寸填充另一块屏；
- 把逻辑分辨率当成物理分辨率；
- 为了让图形看起来完整而伪造第二个 surface。

当前 surface 的逻辑尺寸可以复用现有公开事实；物理尺寸/分辨率与其它 surface 的成套数据必须由 display-facts owner 以公开 read model 提供。详设不得直接读取 Android 日志、复制当前 surface 数据或在 Admin shell 内推算；若需要扩展 kernel display facts 或 Android public device contract，必须停在 §9.3 报告 Dexter，而不能把扩展偷偷并入 Admin UI。

surface 的主/副角色与宽高必须来自 display-facts owner；不得用当前 surface 的 `displayMode` 与 `displayCount` 推算另一块屏的分辨率或宽高。mobile 不接受多 surface 事实作为正常 UI 输入；`displayCount` 超出该形态支持范围时进入 display-facts 异常/未提供态。

### 5.3 双机拓扑的业务状态

当前 topology contract 已有 `TopologyFacts`、`TopologyOperationEligibility`、typed reason、命令结果和 `TopologyAdminCapability`。其中 `paired`、`peerReachable`、`hostDesired/hostActual`、`instanceMode`、`displayRole`、`hasTopologySecondarySurface` 各自有不同含义，不能在 UI 中合并为一条“连接状态”。

本批只重构用户观察与操作路径，不修改这些 owner 语义：

- laptop + 单物理屏是当前拓扑可操作范围；mobile 和 laptop 双物理屏显示不可用原因；
- tab 永远显示；
- 断线保留已配对语义并继续重连；
- 主机/副机角色由 base topology 能力决定，不由 app 自己伪造；未配对时 UI 可以让用户选择目标角色，选择只触发 owner 提供的主机服务或直接配对动作；
- Admin UI 只调用 capability，不直接调 actor、slice、host 或 transport。

当前源码事实还必须被记录在详设的 action matrix 中：`TopologyOperation` union 含 `switch-role`，但 `TopologyAdminCapability` 没有对应执行 command，且现有 evaluator 没有专门的 `switch-role` 分支，可能在满足基础形态时返回 `allowed: true`。这个 `allowed` 只表示当前 eligibility 结果，不构成用户可执行授权；在没有 owner command 之前，`switch-role` 必须显式标为资格-only 或非本批，不能由 UI 自行添加按钮或把它当成已支持操作。当前源码的另一个契约差距是 `pair` payload 需要带已查询的 identity，actor 也按 MASTER/CHIEF 进入配对；本需求要求用户直接输入主机 IP 后完成配对，因此详设必须在不暴露 `query-host` 的前提下闭合 identity 获取、owner 归属和失败回滚，未闭合前不得宣称现有 capability 已满足本旅途。

### 5.4 角色文案不是事实改名

UI 可以把 `MASTER/SLAVE` 翻译成“主机/副机”，把 `CHIEF/VICE` 翻译成“主屏/副屏”或更符合用户旅途的文案，但翻译不等于改变内部事实。详设必须建立内部值到用户语言的单一映射，并覆盖未知、转换中和错误状态；不能在不同 tab 各自翻译一套。

“物理副屏存在”与“双机拓扑可用”也必须使用不同语料。laptop 双物理屏时，运行状态 tab 应同时表达两块物理屏各自的逻辑画布分辨率、物理分辨率、角色与就绪/可用状态；设备逻辑显示区域只用于矩形比例、不显示数值。逻辑画布分辨率就是逻辑分辨率，取自应用逐屏声明；设备逻辑显示区域和物理分辨率取自该屏的 display facts。任何缺失的可见字段显示“未声明/未知”，不得借用另一屏数值。双机拓扑 tab 在 mobile 形态必须表达“当前功能不可用”及“**mobile 形态不支持双机拓扑**”；laptop 双物理屏则表达“当前功能不可用”及“**双机拓扑要求本机只有一个物理屏**”。前者不代表后者可用，不能把 `hasTopologySecondarySurface` 当成 topology operation eligibility。

## 6. 范围边界

### 6.1 本批包含

- Admin shell 的非登录 panel frame、header、navigation、content surface、空/载入/错误/正常状态层级；
- laptop 与 mobile 的独立布局和交互组织；
- 平台端口的聚合摘要、任务分类和有限展开；
- runtime 与 display context 的用户 tab 合并；
- 全 surface 的显示状态表达需求，包括单机双屏主副屏；
- 双机拓扑的资格闸、角色/状态分层、用户旅途、状态反馈和可执行操作呈现；
- shared primitives 与语义 token 的增补需求；
- 两个 integration theme 对 Admin shell 语义 token 的取值接入；
- 后续 focused/static/visual/native 证据应证明的性质。

### 6.2 本批不包含

- Admin 登录框、密码、键盘、认证算法和登录 backend；
- admin panel 中由 feature 自己提供的业务页面和业务旅途；
- 电源角色确认 alert 的业务语义；
- topology kernel、Android server、WS/HTTP transport、持久化、配对协议、重连算法和 feature 写入归属；
- 改变 `resolveSecondarySurfaceAvailable`、`hasTopologySecondarySurface` 或既有 topology owner 语义；新增 page-level availability read model 属于 §9.1 已登记的 blocker，处置走 §9.3，不属于本条排除范围；
- 通过隐藏 topology tab 规避不支持形态；
- 直接读取私有 state、在 UI 中复制 operation evaluator 或新增 parallel command path；
- 后端 API、数据库、seed、部署或 release 配置；
- 本需求阶段的 IA 图片、精确像素、CSS/className、具体 primitive props、测试文件名和实施批次；
- 以截图差分、结构测试或静态文案检查冒充设备视觉/交互验收。

## 7. 后续 IA/详设必须回答的问题

以下是范围冻结后的设计输入，不是让实现方自行忽略的开放项：

1. panel header、整体状态摘要、关闭入口和导航在 laptop/mobile 的信息层级与尺寸如何保持可读；
2. 三个用户 tab 如何与现有四个 part/catalog entry 映射，旧 part key、testID 和 feature 注入边界如何保持；
3. 平台端口五类初始分类的完整 port/capability 对账、已冻结的能力单位分母、合成“未声明”单位表达和展开层级；
4. 运行状态 surface map 的事实边界与视觉呈现：每个 surface 都显示自己的逻辑画布分辨率、物理分辨率、主/副角色和就绪/可用状态；设备逻辑显示区域只用于该 surface 的矩形比例，不显示数值标签。current/non-current 只影响当前标记与视觉强调，可见字段集合相同；矩形比例跟随该 surface 的设备显示区域；不得复制另一 surface 或用推算值填充。mobile 只允许一个实际 surface，多 surface 事实进入 `IA-14` 的 display-facts error variant。display-facts owner 已提供逐屏设备逻辑显示区域、物理尺寸与状态，应用逻辑画布来自 integration assembly 的逐屏声明；如果真实 surface 的某项可见数据缺失，应明确显示未声明/未知，不得跨屏补值；
5. laptop 并列 surface map 与 mobile 单列/紧凑 map 的最小尺寸、滚动和折叠规则；
6. 状态灯 token、文字、图例和 theme 语义；两个 integration 必须保留的可识别差异；
7. laptop topology 的不可用单态、未配对目标选择、主机服务启动/可用/失败、主机服务关闭、输入主机 IP 直接配对、配对、已配对可达、已配对重连、主机解绑、副机解绑、关闭/解绑后回到目标选择和失败恢复的完整状态图；mobile 只设计不可用单态，不设计任何拓扑角色或配对交互；不得把 identity-query 画成用户步骤。其中整页不可用必须消费 topology owner 的 page-level availability/read model，不得用代表性 operation reason 或 raw facts 在 UI 重组；
8. laptop 下主机与副机分别可见的 action matrix，逐一覆盖 `TopologyOperation` union、capability command surface 和 eligibility/reason owner；明确 capability 当前没有执行方法的 operation 是资格-only 还是非本批，并记录 `switch-role` 当前可能 `allowed:true` 但没有 command 的事实；laptop 的主机与副机均必须有“解除配对”，副机解除后必须有“开启主机服务”的恢复路径；mobile 不显示这些动作；
9. laptop topology 的主机 IP 输入、直接提交、进行中和错误恢复；mobile 不显示主机 IP 输入或配对表单；任何形态都不生成“查询身份”页面或按钮；
10. 端口分类展开、topology 状态切换和 runtime surface map 的完整订阅分母：每个 selector、每个 render context/capability 输入、equality/stable identity、无关 slice red mutation 和全 root/新对象反例；
11. 旧 Admin 结构测试和 testID 的迁移原则；哪些行为应保持不变，哪些用户可见行为由本批重新定义；
12. 用户可见中文语料与技术术语替换表，确保“不可用”“未提供”“重连中”“未就绪”等语义不漂移；
13. visual/native/device 证据如何分别证明 laptop/mobile 形态、颜色/状态灯、surface map、拓扑动作与键盘/inset 不遮挡。

## 8. 需求级验收性质（不等同实施 PASS）

后续详设与计划必须为以下性质指定真实执行体；本需求阶段不运行命令，也不把它们记为已验证：

| 性质 | 必须能证明什么 | 不能冒充的证据 |
| --- | --- | --- |
| P-1 导航闭合 | 四个现有非业务 part 在用户面收口为三个 tab，runtime/display-context 不重复出现 | 只改标题或只删一个入口 |
| P-2 panel 响应式 | laptop/mobile 均可打开、导航、滚动、关闭，mobile 不是桌面布局换行 | 只通过 JSX 结构断言 |
| P-3 端口聚合 | 以能力单位为分母，`可用 + 不可用 + 未声明 = 总单位数`；分类和展开明细与同一单位集合守恒，missing descriptor/空 capability 不被吞掉 | 测试只断言有一个 list，或只按 port 数量计算百分比 |
| P-4 端口旅途 | 用户可从总览定位不可用/未提供类别和具体名称/原因 | 只断言字符串存在 |
| P-5 运行状态合并 | runtime 与 display context 的事实全保留且只通过一个用户入口获得 | 只移除 tab 名称 |
| P-6 双屏表达 | 单机双屏同时读取并显示主屏、副屏各自的逻辑画布分辨率、物理分辨率、角色和就绪/可用状态；设备逻辑显示区域仅用于各自矩形比例，不显示数值标签；单屏不伪造第二屏；矩形按各自设备显示区域宽高比绘制；mobile 只显示一个实际 surface，多 surface 事实进入 IA-14 的 display-facts error variant；任何字段不跨屏复制 | 把设备逻辑显示区域冒充应用逻辑分辨率或显示已裁定移除的“设备显示区域：宽×高”字段，隐藏非当前屏字段，用当前屏数据复制另一块屏，使用统一固定比例，或填入未经 owner 提供的事实 |
| P-7 状态诚实 | lifecycle、loading、缺失、暂时不可达、错误和正常可区分 | 用 undefined 或颜色单独代表生命周期 |
| P-8 拓扑资格闸 | 不支持时只显示不可用原因，不展示无关 topology 细节；tab 不隐藏 | 只把按钮 disabled 但保留所有细节 |
| P-9 拓扑角色旅途 | 主机/副机、未配对/配对/重连/失败的内容和动作不同且由 owner 给出 | UI 自行拼装 paired/reachable 布尔 |
| P-10 owner 边界 | UI 不读私有 state、不复制 evaluator、不改变 feature/topology command owner | 仅按 import 路径检查 |
| P-11 theme/primitive | 公共控件和语义 token 在 shared primitive/admin-shell，实际色值由两个 integration theme 提供 | 只检验 token 名称或一个 app |
| P-12 selector 边界 | 聚合/展开不会退化成全 root 订阅或每次通知新建等价对象 | 只看 selector 函数被调用 |
| P-13 用户可见证据 | laptop/mobile 的布局、surface map、状态灯、展开和拓扑操作在对应设备/运行环境可观察 | 结构测试、截图差分单独宣称业务通过 |

## 9. 明确开放项与需 Dexter 裁决项

### 9.1 需要设计解决、但不改变本批产品范围

- 当前 display-facts owner 已按 `DisplayInfo.surfaces[]` 提供逐屏 `logicalSize`、`physicalSize` 与 readiness；Android adapter 的 `getRealMetrics()`/display mode 是设备显示区域与物理像素的来源。此前误把这些 `logicalSize` 当作应用逻辑画布，是投影口径错误。应用逻辑画布的来源是 integration assembly 已解析的 `surfaceDeclarations`，但该配置此前未进入 `RenderRuntimeFacts`，故 UI 无法展示。此次实现将声明尺寸作为独立逐屏只读事实传至 admin-shell，并修正字段标签与双屏投影；若真实 surface 缺少其自身事实，只显示该字段未提供，不借用另一块屏数据。
- topology 全局资格的 owner 尚未闭合：当前 `evaluateTopologyOperation` 只返回 operation-level eligibility，`TopologyAdminCapability` 也没有整页 availability 方法。进入 IA/详设前必须由 topology owner 提供 page-level availability/read model 或明确的 page-level reason 输出；Admin shell 不得读取 raw facts、挑一个 operation 或维护 reason 清单来重算整页 gate。若该 owner 变化需要改动 topology contract/kernel，必须按 §9.3 停止并报告 Dexter。
- 当前 Admin catalog 有四个 part，目标用户 tab 是三个；保留哪些旧 part key、如何让 catalog/renderer 对账，需要详设明确，不由实现时临时删除。
- 端口分类的最终用户中文名、能力单位到分类的映射和合成“未声明”单位的视觉表达需要在 IA/详设冻结；摘要分母与缺失 descriptor/空 capability 的计数方式已经由 §5.1 冻结。
- 现有 topology capability 的操作矩阵需要按当前源码逐 operation 核对，并把主机/副机 UI 行为映射成可审查的表。

### 9.2 需要 Dexter 明确的产品语义

以下事项会改变用户旅途或破坏性操作语义，不在需求阶段替 Dexter 默决：

1. “解除配对”是否必须增加二次确认；当前代码有解除能力，但本稿不假定是否新增确认层。
2. 双机拓扑资格不满足时，本稿已经冻结为只显示“当前功能不可用”和可读原因，不展示身份、地址、服务、payload 或历史操作等其它拓扑信息；IA 只需决定这条原因在卡片中的排版，不得重新打开信息范围。
3. 端口状态为 `unavailable` 但没有可读原因时，是否统一显示“不可用，原因未提供”，还是允许只显示状态；本稿默认前者。

### 9.3 非本批、不得借设计名义偷偷扩大

如果为了满足 R-9 发现必须改动 kernel display facts、Android public device contract、topology state 或 feature projection，详设必须把它作为明确的跨包落点并报告影响；不能把它伪装成 Admin shell 的纯视觉改动。若该改动改变既有业务语义，应暂停并交 Dexter。

## 10. 设计替代方案比较

### A：继续四个平面 tab，只做视觉换肤

不采用。它无法解决 runtime/display-context 的重复心智模型，也不能解决端口总览和双机拓扑状态推断成本。

### B：保留三个用户 tab，按任务聚合事实，并为 laptop/mobile 做不同信息编排

采用。它直接对应用户要回答的问题，能在不移动 owner 的前提下重组呈现，并允许共享语义 token 与 primitives。

### C：Admin shell 自己读取所有 kernel slice，追求一次性拿全数据

不采用。它会反转 owner 边界、复制 topology/display-context 判定，并使后续双机和 feature 语义漂移。

### D：每个 integration 复制一套 Admin shell 以便自由设计

不采用。它会让登录后 panel、状态语言、拓扑动作和 testID 分叉；应由 shared primitives/admin-shell 承担结构，由 integration theme 提供色值。

### E：只做一个响应式布局，在 mobile 上自动换行

不采用。当前 mobile 已证明这只是应付式适配；窄屏需要独立的信息优先级、折叠与操作触达设计。

### F：在拓扑页展示所有 raw facts，交给用户自己判断

不采用。拓扑的业务意义是“能不能用、我是谁、是否配对、能否操作、下一步是什么”，原始字段不能代替状态机和旅途。

## 11. 主 agent 自审与证据声明

### 11.1 当前已核对

- 当前 four-part roster 与目标 three-tab 收口关系；
- panel laptop/master-detail 与 mobile/flex-wrap 的现状差异；
- platform ports 的 capability 平面列表和 missing descriptor 分支；
- runtime/display-context 的重复入口与 current-surface-only 数据边界；
- topology facts、eligibility、typed reason、capability owner、paired/reachable 正交关系；
- primitives、theme 和前端能力复用边界；
- 双机 feature 写入归属与 topology UI 不得越过 owner 的项目规则。

### 11.2 尚未执行

- 未启动 Web、Metro、Android、设备、DEV、seed、UAT 或部署；
- 未运行构建、测试或截图；
- 未进入 IA、详设或实施计划；
- 未声称任何 static/focused/Web/Android/native/device/visual/release/cleanup PASS；
- `INDEPENDENT_SUBAGENT_REVIEW=ROUND_1_COMPLETE`：两名 fresh 只读子 agent 的 round 1 审查已留痕在 `doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-independent-review-codex.md`；该记录不是 Claude review，也不产生 GO。当前修订稿仍需 Claude/Dexter 做需求 DESIGN review；不得把本状态改写为“独立审查未执行”或“设计已通过”；
- display-facts owner 尚未提供每个 surface 的 logical/physical/role/status 与权威宽高；当前公开数据不足的字段必须在对应数字位置显示“未知”，不能复制或推导；topology page-level availability owner 仍是进入 IA/详设的 admission blocker；二者都不是已具备的实现能力。

### 11.3 反例自检

1. 如果只把 `RuntimeSection` 的标题改成“运行状态”而保留 `DisplayContextSection` 独立入口，P-1 会红。
2. 如果把任一 surface 的 logical/physical/ready 数据复制给另一块 surface、用统一固定比例绘制，或在 mobile 画出第二块屏，P-6/P-7 会红；缺少权威事实时必须显式显示对应字段未提供。
3. 如果只把 topology 的所有按钮 disabled 而保留身份、地址和 payload 行，P-8 会红。
4. 如果 UI 用 `paired && peerReachable` 自己推断副屏可用，P-9/P-10 会红。
5. 如果 integration 只换背景色而 primitives 没有通用 ratio/expand/surface 能力，P-3/P-6/P-11 会红。
6. 如果端口摘要直接用 list length 作为可用数量，或让 missing/empty port 不产生合成“未声明”单位，P-3 会红。

### 11.4 当前结论

本稿可以作为 IA 设计的输入候选，但尚未获得 Dexter/Claude 的范围批准；当前不允许进入 IA、详设、实施或动态验证。任何评审 finding 必须先回到本稿的源码事实、用户旅途和范围边界处理；产品/Journey 语义不能由实现方静默改写。
