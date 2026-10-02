# 终端激活交互与双机拓扑优化专项 · 正式需求

```text
DOC_KIND=FORMAL_REQUIREMENTS
AUTHOR=Codex
STATUS=PREPARED_FOR_REQUIREMENTS_REVIEW
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_REQUIREMENTS_2026-10-02
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_AUTHORITY=false
EVIDENCE_TIER=STATIC_SOURCE_AND_DEXTER_DECISIONS
```

## 0 · 用户任务、来源与授权

让使用终端的店员只输入 8 位激活码即可在明确的服务空间完成设备激活，随后自然进入登录与
sample 业务；管理员通过共享 admin console 查看状态、维护服务配置和恢复配对。双机中的副机
始终是主机扩展，在 LMS/LSP 两种内容场景下正确显示、独立交互，并遵守主机资格与配对连接边界。

原始用户需求、逐字补充和产品裁决的来源为
`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md`
§9.1～§9.14；该稿 §0、§7 是裁决导航，§10 是前期静态盘点。本正式需求从这些输入整理，
不将讨论稿中的目录候选、内部字段建议或作者静态结论提升为已实施事实。

本轮 Dexter 授权原文：“好的，请根据需求讨论稿生成正式需求文档，并完成两次对抗性review”。
本轮仅编写需求和两轮独立静态审查；不授权 Journey/交互/IA/详设/实施计划的编写或后续实施推进，
也不授权源码、契约、依赖、生成、编译、测试、verify、DEV、reset/seed、L2、UAT 或部署。
此处“正式”指需求载体，并非产品验收通过或源码实施授权。

当前专项作为一个完整交付范围。后续交互、IA、详设及实施计划须覆盖全文，不能按包分别交付。
当前文档不替代这些工件：UI 线框、控件分母、详细配置形状、完整异步状态机、具体 VM 与 runner
准入留给后续获授权设计；已有明确产品行为不得在后续设计中重新解释为未决。

### 0.1 适用规范和业务语言

- 入口：`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`。
- 终端标准唯一正本：`doc/platform/terminal-coding-standard.md`；本稿引用 TR-01/03/11/14/15/16/17、§4-D/4-E。
- 审查：`doc/platform/review-standard.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`。
- 原激活语义：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`
  及 `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、
  `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`。
- 原配对与解除：`doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md`。
- corpus 命中 `G-01/G-10`：集团空间编码位于 URL，不是授权或服务环境名称。
  命中 `G-03/G-05` 的门店/用户边界只用于区分概念；终端 sample 店员不因此变成运营后台 IAM 用户。
  sample 会员不启动 parked 正式会员域，不新增会员主数据、营销、权限或业务 HTTP 接口。

最新专项裁决优先于旧批次关于 UI/application 延期、standalone slave 或代理密码保护的旧限定。
代理密码明文例外只覆盖 server-config 的代理配置，不扩大到终端激活凭证或店员口令。

## 1 · 范围与合理性

纳入两个新 UI base 包 `apps/terminal/ui/base/terminal-activation`、
`apps/terminal/ui/base/server-config-panel`，以及两个 sample integration、三个 sample UI feature、
相应 kernel owner、配置声明/生成消费、现有同步/通信/设备 adapter 和受管验证接线的必要变更。
三个 sample UI 包为 `sample-staff-auth`、`sample-member-desk`、`sample-wallpaper-picker`。

选择“既有 owner + command/selector + 四面 UI + integration 阶段路由”的最小方案：
只完成当前激活、配对扩展和两个 sample 任务，复用共享输入、admin、state、transport。
替代方案是由 integration 直接画所有页面并调 HTTP；它会重复 owner、绕过公开入口且难以复用。
另一个替代是建设通用流程引擎/全局仲裁；当前只有两个 sample 和一主一副，不具备相应收益。

不建设第二套 command/read 机制、通用工作流、CRDT、多主合并、持久业务队列、离线业务、常态轮询、
多 peer 网络、正式会员中心或新的后台产品功能；不重做原批次的 TDS 协议/跨节点/Doris 实现。
配置和终端 UI 命令不是新增后台权限，不改变后端权威授权。

## 2 · 统一术语与四种设备拓扑（R-01）

唯一映射正本在 terminal-coding-standard §4-E。本稿只给本专项使用的内容地址摘要：

| 部署拓扑 | 屏幕内容 | UI 内容归属 | 实际承载实例 |
| --- | --- | --- | --- |
| mobile 单机 | MMP | master + primary | 主机 |
| laptop 单机单屏 | LMP | master + primary | 主机 |
| laptop 单机双屏 | LMP、LMS | master + primary、master + secondary | 同一主机、同一 store |
| laptop 双机双屏 | 主机 LMP；配对副机 LMS 或 LSP | LMS 为 master + secondary；LSP 为 slave + primary | 副机承载 LMS 时仍是 SLAVE；不会因显示主机内容成为 MASTER |

双机副机外部供电时使用 LMS、电池供电时使用 LSP，沿既有**确认后切换**规则；尚未确认时维持
当前生效内容场景。MAIN 业务 UI 由主机写并投影，BRANCH 的 LSP UI 由副机写。不得从 UI 内容
简称、物理屏数或供电直接推导独立终端身份、凭证、业务 owner 或已确认角色。

## 3 · 模块职责与唯一业务通路（R-02）

所有业务指令必须使用目标 owner 公开 command；所有业务数据与状态读取必须使用 owner 公开
selector。UI、integration、helper、admin、主副通信都遵守；selector 纯读，React 通过现有
selector-aware hook 订阅。端口事件经既有 bridge 翻译为 command，再由关心它的 actor 处理。
不新增 service/getter/callback/event bus/snapshot 或 capability 方法替代业务读写。

| 包/层 | 唯一职责 | 业务边界 |
| --- | --- | --- |
| terminal-data-client | 本机激活凭证、激活/取消 command、TDS 协议和激活/连接/延时 selectors；副机存储主机状态信息 | 只有主机拥有可用凭证/TDS 会话；UI 不接触秘密 |
| server-config | 服务空间、URL 前缀/地址、代理配置及其 commands/selectors | 主机配置权威，副机同步存储并只读消费；不做激活或 TDS 业务 |
| transport | 通信、稳定性、重试与连接切换等通用机制 | 不识别集团空间业务、激活状态或店员资格 |
| terminal-activation | 四面激活交互和激活状态 tab | 不持有第二份凭证，不直接 HTTP，不拥有取消事实 |
| server-config-panel | 服务配置 tab 的展示、编辑草稿和反馈 | 修改只派配置 command；副机只读 |
| sample UI/kernel | UI 拥有本阶段交互；kernel owner 拥有店员、会员与壁纸事实 | 阶段入口公开 command；跨包读 selector，写 command |
| 两个 integration | 组合模块、持续读取准入 facts 并派发阶段入口、统一断链阻断 | 不复制激活/登录事实，不直接写其他包 slice |

composition 注入 transport network adapter 的配置读取路径必须落到 server-config 的公开 selector；
provider 只作既有基础设施接线，不成为新业务读 API。client 只调用通用 transport command，不直接
读取 server-config selector/state/snapshot/persistence。component 不直接请求 generated API；
副机的后台业务 HTTP 也必须由业务 command 发起、结果进入 owner state 后由 selector 读取。
state/topology 既有 authoritative apply 与持久化保持基础设施职责，不把同步投影重放为业务 command。

## 4 · 终端激活交互与管理（R-03～R-05）

### R-03 · 激活入口和四面表现

新包 terminal-activation 提供 `needToActivateTerminalCommand`；这是显示交互的 UI command，
不自动发起后台激活。普通阶段路由在未激活时调用；显式外部调用已激活终端时显示成功提示。

| 内容场景 | 主机未激活 | 主机已激活且显式要求显示激活交互 |
| --- | --- | --- |
| MMP | mobile 激活页面 | “设备已激活成功” |
| LMP | laptop 激活页面 | “设备已激活成功” |
| LMS | “请在主屏幕上完成设备激活” | “设备已激活成功” |
| LSP | “请先在主机上完成设备激活” | “设备已激活成功” |

副机文案中的已激活指主机，不能把副机本机标记为 active。主机状态未到不等于未激活；
配对/同步未就绪按 R-11 等待。成功提示后如何返回业务在交互设计确定，不在需求里加自动计时。

### R-04 · 只有 8 位码与服务空间名称

MMP/LMP 激活表单只有 8 位数字激活码，按字符串保留前导零。输入区域同时显示只读
“服务空间：名称”，来源为本次使用的生效配置，通过 selector 读取；集团编码与服务空间名称不同。
配置切换时显示与提交目标保持一致，不让旧名称对应新请求；服务覆盖实际生效时不得隐藏该事实。

用户不输入集团空间、设备身份、机型、版本、operationId 或 credentialSecret。自动来源为：

| 参数/信息 | 来源与责任 |
| --- | --- |
| groupWorkspaceKey 路径内容 | server-config URL 前缀；不再另作为激活调用的集团输入，不进入 body/query |
| operationId | UI/actor 一次操作身份，沿现有重试规则复用 |
| surfaceForm、appVersion | application/composition 的真实机型和版本元数据 |
| deviceId | client 经既有设备端口读取，不使用固定假身份 |
| credentialSecret | client 既有安全随机来源，只有 client 持有；同次激活复用规则保留 |
| 终端/门店/绑定/集团凭证身份 | 激活成功响应，由 client 提交为凭证，不由 UI 或配置猜测 |

激活提交使用 client `activateTerminalCommand`。提交中避免重复制造不同操作；失败显示业务原因并
允许合规重试。后台拒绝、网络失败、缺失能力或身份不得被显示为成功；已激活不再次激活。
配置变化、响应倒序与异步角色变化不能把旧激活结果提交到错误目标或副机角色。

### R-05 · 设备激活状态 tab 和取消命名

terminal-activation 扩展共享 admin console 的“设备激活状态”tab，显示激活、终端/门店/集团空间、
连接及延时事实和可恢复错误；只显示可用真实信息，不编造当前 owner 尚未提供的名称。
不得在该 tab 完成激活。主机已激活可派发 `cancelTerminaActivationCommand`；拼写按 Dexter 指定。
当前旧名 `cancelTerminalOnlineCommand` 在后续实施统一重命名，不保留废弃兼容入口。

取消开始即进入 cancelling，期间不进入登录/业务或重新连接；失败可观察。后台取消、清理、
持久化与 reset/restart 的结果分别按既有 owner 语义处理，不把部分成功等同完整结束。
本项不新增离线取消按钮或改写原取消协议。
配对副机 tab 仅显示标注为主机的同步信息，即使主机 active 也无本机或代主机取消入口。

## 5 · 服务配置、内置声明与 URL 消费（R-06～R-08）

### R-06 · server-config-panel 与配置权限

新包 server-config-panel 扩展共享 admin console 的“服务配置”tab；主机或未配对本机可选
已声明服务空间，编辑已声明服务的地址列表/名称/URL 前缀/超时及 HTTP 代理、用户名和密码，
清除服务覆盖、恢复内置默认。现有地址上界 1～4、校验和配置 command 能力沿用；不新增任意空间/服务。

编辑通过公开 `selectServerConfigSpaceCommand`、`setServerOverrideCommand`、
`clearServerOverrideCommand`、`restoreServerDefaultsCommand`；不直接改 state/defaults/persistence。
当前 override 按服务跨空间共享，切换空间不清覆盖，不把它显示成每空间各一份保存；变更该作用域
不是本专项隐含需求。保存后通过 selector 显示实际生效与持久化状态，不把 command 返回等同落盘；
内存已生效但持久化失败须准确反馈。

配对副机整个服务配置 tab **不可编辑**：不切空间、不改地址/代理、不保存/清除/恢复默认，
也不代发修改主机配置的 peer command。只读应同时体现在 UI 与业务 command 准入中。
断链仍只读；管理员恢复配对的主机 host 属 topology，不是此 tab 的后台服务地址。

代理密码按普通字符串进入配置 state，**明文持久化并主→副同步、存储**；不使用加密/protected
persistence，也不额外建设密码密钥体系。主机的默认代理与实际生效密码也必须供副机正确消费，
不能仅同步 override 而遗漏 defaults。密码不写日志或错误内容；明文存储不要求在激活状态页展示它。
本例外不涉及激活凭证/店员口令。保留当前 set/keep/none 的实际语义，不能将 passwordConfigured
视为“keep 默认密码”的依据。

配置变化作用于后续请求/连接，不隐式取消、改绑终端或声称当前 socket 已换目标。
本机是否已激活不能阻断必要的 admin 恢复入口。

### R-07 · package.json 内置 serverSpaces

像 terminalSurfaces 一样，终端入口包 package.json 可声明 `serverSpaces`，在启动读取与打包时
成为本应用内置的 server-config defaults。包含空间名称、默认选中空间以及服务地址前缀、超时、
可选代理；JSON 形状在详设中复用现有配置类型和校验，不建立第二个配置模型。

两个 integration 的 Expo Web 入口使用其包声明；application 启动/打包使用其自身入口包声明，
经 composition 显式传入 integration/config owner。一个运行入口只有一份明确选定的 defaults，
不隐式合并两份列表，kernel 不反向读取 UI/app package 文件。
内置 defaults 只读；启动恢复已保存的合法配置，不每次以默认值覆盖；恢复默认回本应用内置声明。
无效声明拒绝，不悄悄选另一环境。副机配对后以主机同步配置为准，不由本机不同 defaults 重算地址。

### R-08 · 配置前缀 + generated 后缀

server-config 配置 server URL 前缀，包括集团空间路径；终端业务包 generated API 提供请求后缀。
例如前缀 `http://127.0.0.1:7890/api/terminal/group-workspaces/mixc` + `/activation`
得到 `http://127.0.0.1:7890/api/terminal/group-workspaces/mixc/activation`。
取消后缀保留 `/terminals/{terminalRef}/activation/cancel`，terminalRef 自动来自凭证。

generated 后缀从 canonical 完整 OpenAPI route 和具名终端消费策略派生；共享后端契约、catalog
仍为完整路径，不手改 generated、不在业务手写完整路由、不将其他 consumer 全局改成后缀。
通用通信层拼接必须保留 prefix pathname，统一处理斜杠、参数编码及 query；不能让后缀的 `/`
覆盖前缀、重复添加集团段或丢掉集团路径。client/transport 不先解析集团编码再重建完整路由。
多个候选地址和重试不得改变本次操作所属集团，取消与 TDS 仍使用正确凭证身份；机型闭集、
设备/版本/秘密、取消 Authorization/deviceId 等既有契约语义不弱化。
该 loopback 地址仅为 URL 表达例子，不授权本机 Java 或改变受管远端执行拓扑。

## 6 · sample 四面交互（R-09）

三个 UI 包分别提供公开阶段入口 `needToLoginStaffCommand`、`startMemberDeskCommand`、
`startWallpaperPickerCommand`；staff 替代原意向名中的 Stuff。入口控制各包内部交互，
integration 不直接拼其他包的 partKey。四面均须完整注册并真实可达。

| UI 包 | MMP/LMP | LMS | LSP |
| --- | --- | --- | --- |
| sample-staff-auth | 按机型呈现店员登录 | 引导在主屏完成登录 | 引导在主机登录；不独立登录 |
| sample-member-desk | 列表、录入、顾客确认流程；提供店员登出 command | 既有顾客欢迎、姓名/电话核对、可选年龄、确认/拒绝 | 独立页面，列表、录入并在本页顾客确认；不提供店员登出 |
| sample-wallpaper-picker | 选择本页背景；提供店员登出 command | 显示主机已确认背景 | 独立选择页面，只改 LSP 背景；不提供店员登出 |

LSP 与 LMP 采用独立页面组件，不用一个页面的角色条件判断或仅隐藏登出按钮替代。
共同的叶组件、字段、列表、输入与 kernel 逻辑可以复用。LSP 沿用主机店员资格，主机登出后
副机退出业务并显示主机登录提示；不复制口令、不建立副机独立登录。

### R-09a · 会员共享集合、独立录入

LMP/LSP 看到同一个主机 owner 的已登记列表，各自可以添加，允许两端各自一个未完成录入。
两端的草稿、待确认和结果互不覆盖；确认/拒绝/撤回绑定准确发起端与这一次录入，不处理另一端
或较新的内容。LMP 有 LMS 时沿既有副屏确认，无 LMS 时在本页完成；LSP 始终在本页完成。
保留 sample 姓名/电话核对及年龄的既有可选语义，不新增正式会员 HTTP/主数据系统。

共享集合只由主机 registry command 写，副机 UI 用本地 BRANCH command，再显式路由主机
具名业务 command；不能从 PRIMARY 位置假定 peer-intent 会自动到主机。断链不接受新业务，
可以保留草稿；已经在主机提交成功但回包丢失的事实，恢复后按准确操作/列表 selector 回读，
不得回滚、重复添加或盲重发。无需通用持久队列或多主合并。

### R-09b · 壁纸独立与恢复

LMP 和 LSP 各选本页背景，互不影响；LMS 跟随主机已确认背景。取消选择不改变已确认值。
副机经确认切 LMS 再切回 LSP，恢复其自己的已确认背景；主机 confirmed 投影不能覆盖副机
local confirmed/pending。断链期间 LSP 本地壁纸选择也被阻断。

## 7 · integration 阶段路由与断链（R-10～R-11）

### R-10 · 持续 selector 与阶段优先级

两个 integration 完整集成 client、activation、server-config-panel 和所需 sample 模块。
启动 hydration/initialize 完成后及相关事实变化时，持续按 owner selector 重判，不常态轮询。

| 资格事实 | sample-console 派发 | sample-wallpaper-console 派发 |
| --- | --- | --- |
| 主机未激活 | needToActivateTerminalCommand | needToActivateTerminalCommand |
| 主机已激活、店员未登录 | needToLoginStaffCommand | needToLoginStaffCommand |
| 主机已激活、店员已登录 | startMemberDeskCommand | startWallpaperPickerCommand |

初始化/修复未完成优先等待；配对副机断链/当前连接所需同步未到优先 R-11；取消中等待 owner
终结；随后按激活→登录→业务路由。副机读取当前主机状态，本机 inactive 不触发副机激活。
未知、缓存、失效、未激活须可区分。重复同阶段或 RTT/PONG 更新不重置表单或反复切首屏。
已有各 feature 的 login-restored 自跳业务不得越过 integration 激活准入；不另存业务阶段事实副本。
UI 隐藏之外，相关业务 actor 在执行/异步提交处复核当前资格和操作身份，迟到事件不能绕过阻断。

### R-11 · 所有业务画面断链遮罩，本机 admin 可恢复

配对副机断链，不论当前激活/登录提示、会员列表/表单/确认、壁纸或业务弹层，统一显示
“配对连接中，请稍后”；触摸、鼠标、键盘和已有焦点都不能继续派业务指令，所有业务暂停。
不自动退配、不清草稿、不提升主机、不引入离线提交。

左上角本地 admin 入口、认证及输入、管理页、关闭必须仍可用；可取消配对或修改配对主机 host。
不能依赖 peer 打开/关闭 admin，不能以本地 admin 需要为由放宽副机写 MAIN 业务权限。
admin 关闭后未恢复仍显示遮罩；服务配置与激活状态 tab 仍只读。

恢复需当前配对身份/连接的主机资格及当前业务所需同步已经应用，peer accepted 不等于业务就绪。
旧连接迟到投影、换主机后旧缓存不能解锁；主机在断链期间已登出/取消，重连后路由到当前提示，
不闪回旧业务。配对/退配/换地址进行中或失败仍阻断；不能凭中间 MASTER 或 repairPending=false
宣告成功。退配明确成功后沿既有 MASTER+CHIEF、清 locator 语义，不自动获得激活身份。
换地址最小路径复用既有退配/配对 commands，退配未完整成功不继续新配对；不另造切换协议。

## 8 · 副机身份、同步存储与 HTTP（R-12）

已配对副机仅作为主机扩展：无本机激活凭证、不独立连接 TDS。已有本机激活资格或正在连 TDS
不能切副机；已激活但 socket 暂断同样不允许，必须先显式完成取消，配对不偷偷清凭证。
约束覆盖启动恢复、配对/切角色、激活、连接及异步完成提交；异常持久状态明确拒绝冲突运行，
不自行清秘密或把冲突假装成合法副机。

主机 server-config 和 client 状态同步并存储到副机：配置含服务空间、实际地址和完整代理密码，
client 含激活身份及连接/延时状态。副机显示与配置均以主机为准，不能反向编辑/取消。
client 的 credentialSecret、pending activation 秘密、socket、seq/deadline 和重连任务不复制；
主机信息持久缓存与本机 credential/state 必须可区分，缓存不授予本机 active 或独立 TDS。

重启先展示等待/缓存语义并禁止业务，当前配对连接同步就绪后按最新主机信息路由。
本机不同 package defaults 不得替换主机配置；同步 fields、revision、authoritative apply 与
持久化复用既有 state/topology，并由两个 composition 显式注册，不假设声明即自动启用。

副机可用同步配置/明文代理独立发送后台业务 **HTTP**，这项能力属于本需求；仍通过具名业务
command 和 selector，不直接 component HTTP，不因此使用主机终端凭证或新增后台接口。
现有两个 sample 的共享会员仍走主机 registry，壁纸仍本机 owner，不为证明 HTTP 改写 sample
的业务事实住址。具体获准 HTTP operation、请求身份与 adapter 证明在详设列明，不能凭配对或
URL 获得后端授权；新增业务身份/接口若确有需求另交 Dexter 裁决。

## 9 · state 与 command/selector 的必要闭包（R-13）

下表规定行为与归属，新增内部字段名、状态枚举及 JSON 布局在详设确定。所有观察统一公开 selector。

| state 类别 | 设置者与何时成立 | 存储/同步与读侧边界 |
| --- | --- | --- |
| 本机角色/供电显示角色 | runtime/display owner commands；用户确认后切显示角色 | 不由 integration 擅改；供电/内容不产生凭证 |
| 配对身份、可达、当前连接/应用修订 | topology/state 原 owner | 身份持久、可达瞬态；应用就绪区别于可达 |
| 本机激活/pending/取消 | client actor 成功提交后 active，取消开始 cancelling，清理按原语义终结 | 只有主机凭证 protected 本机保存；副机不持凭证 |
| 本机 TDS 连接/RTT/心跳 | client/transport 原 owner | 副机不建连接；主机摘要与本机状态分开 |
| 主机激活/连接/延时投影 | 主机 client selector 产生；副机 authoritative apply | 副机存储，绑定当前主机；缺失/失效非 inactive，缓存不放行业务 |
| 内置 serverSpaces | package 启动/打包输入，经 composition 注入 config defaults | 只读内置；不覆盖合法 hydration 配置 |
| 已选空间/地址/代理（含密码） | 主机 config commands；副机 authoritative apply | 副机同步并明文存储代理密码；配对期间只读消费 |
| panel 草稿/保存结果 | 主机/未配对本机 UI command/actor | 草稿非配置事实；selector 区分生效/持久化失败；副机无编辑草稿 |
| 店员会话/主机投影 | 主机 staff commands，副机 apply | 副机资格读主机，不自行 login/logout、不复制口令 |
| 会员集合及两端待确认 | 主机 registry commands，UI 本地 commands | 主机唯一列表；两端过程隔离、操作身份精确 |
| 壁纸本地 confirmed/pending 与主机 confirmed 投影 | 各端本机 wallpaper commands，主机 confirmed 下行 | LSP 本地值保存/恢复；LMS 只取主机 confirmed |
| screen/layer placement 与本地 admin | MAIN 主机写/投影，BRANCH 副机写；admin 本机 commands | 本地 admin 不写 MAIN 业务 placement，遮罩不挡 admin |
| 配对恢复操作状态 | 本地管理 command 的真实运行/结束状态 | 不持久、不造仲裁；完整成功 + selector readback 才重新判准入 |

必须能逐条静态追踪以下命令链，不能只给 command 名或目录：

| 触发 | command 到 owner/目标 | 读取/结束依据 |
| --- | --- | --- |
| 初始化、资格变化 | bridge → integration 重判 command → actor → 四类 UI 阶段入口 | owner selectors；去重不重置同阶段 |
| 激活表单提交 | UI command → client activateTerminalCommand（local）→ 通用 transport command | client/config selectors 与请求目标，终端秘密只在 client |
| 主机取消 | 状态页 → cancelTerminaActivationCommand（local）→ client | selector 观察 cancelling、失败、清理终态；副机禁止 |
| 登录/登出 | UI command → staff login/logout command（主机） | staff selectors；副机跟随主机资格 |
| LMP 会员录入/LMS 确认 | 本地 UI command → 主机具名 registry commands | 精确端/操作的 pending 与共享列表 selectors |
| LSP 会员录入/本页确认 | 本机 BRANCH UI command → 主机 registry command（明确 peer target） | 主机事实 selector 投影，失败与回包丢失不得冒充成功 |
| 两端壁纸选择/确认 | 本机 UI command → 本机 wallpaper commands | 各自 selector；主机 confirmed 投影供 LMS |
| admin 打开/认证/关闭 | 本机 admin commands（含双机 LMS） | 本机 admin selectors，不依赖 peer |
| 退配/换 host | 本机 topology commands（换址串行退配→配对） | 完整命令终结与 topology selectors；中间角色不解锁 |
| 配置选择/保存/清除/恢复 | 主机或未配对本机 config commands | 生效 config/保存状态 selectors；副机不能执行 |
| 副机后台 HTTP | 具名业务 command → 通用 transport command → 本机 adapter | config selector 的主机同步配置；结果通过业务 selector |
| peer apply/持久化/供电事件 | 复用既有基础设施，事件转 command 后触发业务重判 | 现有 owner selectors；不发明其他业务机制 |

## 10 · component 与 helper（R-14）

重新规划 mobile/laptop 组件目录，laptop 明确区分 LMP/LMS/LSP 的页面入口；单机型文件继续
遵守 TR-14。目录名称在详设收敛，不将讨论稿候选自动升级为 code-layout 新白名单。
LMP/LSP 必须独立入口组件；共同的叶组件可以复用，不能复制整个 kernel 业务逻辑。

先复用 render 的 part/catalog、tracked command、selector hook，input/primitives 的输入/键盘/
滚动，admin-shell/integration-assembly 的共享承载，state/topology 的同步与 peer 路由。
base helper 只抽实际重复且语义一致的机械工作，不另造场景枚举/store、插件系统、路由引擎、
角色判定或业务 command/read 面。public exports、README、invariants 与依赖方向在详设列同步面。

## 11 · 验收场景与证明边界（R-15）

最终获授权实施交付须覆盖四种 VM 拓扑及两个 sample；双机必须两个真实独立实例，不用单 store
preview 代替。四种拓扑不等于必须同时占用四台 VM。依 TR-16，非 adapter 行为先在两个 integration
Expo Web 通过，再用同一场景清单到 application/VM；双屏/供电/身份/持久化/HTTP/WS/代理
adapter 单独证明，Node client/focused tests 不升级为 Android 页面或业务 PASS。

| 场景 | 最低可观察结果 |
| --- | --- |
| V-01 四面与供电确认 | MMP/LMP/LMS/LSP 映射正确；确认前不切内容，不因 LMS 承载变主机 |
| V-02 激活输入/环境 | 只输8位码、保留前导零；名称与生效配置一致，无其他表单参数 |
| V-03 URL 消费 | 前缀+后缀保留集团段；斜杠/编码/query、多地址与取消后缀正确 |
| V-04 激活失败/竞态 | 缺能力、拒绝/网络、并发/倒序、配置或角色变化不误提交，不误报成功 |
| V-05 激活管理 | 主机可取消、tab不能激活；取消中/失败/清理真实反馈；副机无取消路径 |
| V-06 配置管理 | 主机各公开 command 的生效与保存/失败 readback；跨环境覆盖实际语义 |
| V-07 内置声明 | Web/application 各入口生效，打包内置；hydration保留、恢复默认、无效声明拒绝 |
| V-08 配置同步/HTTP | 主→副实际配置含明文代理密码，存储重启可恢复；副机业务command使用正确配置发HTTP，无TDS |
| V-09 副机管理只读 | LMS/LSP在线与断链、主机active/inactive均无本地/peer配置修改或取消入口 |
| V-10 integration路由 | 冷启动/恢复/取消/登出/迟到事件遵循优先级，同阶段更新不重置表单 |
| V-11 sample登录/登出 | 主端两个工作台均可登出，LSP无登出且随主机资格退出 |
| V-12 两端会员并发 | 两端待确认不覆盖、旧确认不处理新录入；同一列表，失败/丢回包不重复添加 |
| V-13 顾客确认 | 有LMS主端在LMS、单屏主端在本页、LSP在本页，核对身份/电话/可选年龄正确 |
| V-14 独立壁纸 | 主副互不影响；LMS跟主机；确认切换后LSP恢复旧选择；取消选择不改confirmed |
| V-15 全业务断链 | 激活/登录提示、会员/确认、壁纸及业务弹层均遮罩、输入不穿透、禁止业务command |
| V-16 本地admin恢复 | LMS/LSP断链仍可打开/认证/退配/换host/关闭；两个tab只读，关闭不解除遮罩 |
| V-17 重连/换主机 | accepted先到、旧投影迟到、不同主机缓存、主机断链期间登出/取消均不错误解锁 |
| V-18 角色与恢复中间态 | 激活/TDS/配对竞态拒绝；退配中间MASTER或flush失败不解锁、不偷偷清凭证 |
| V-19 命令与读取全集 | 全部触发落公开command，业务读取落selector；无component HTTP或新getter/callback入口 |
| V-20 四拓扑交付 | 两个sample及所有适用场景在Web/VM有对应证据；不适用项逐项说明，业务与cleanup分列 |

全部场景当前为 **NOT_RUN**，不是此次需求 review 的动态证明。详设应冻结控件/场景、执行面、
反例、真实 VM identity 和受管 runner，保留首败/日志、business 与 cleanup，不能用重跑未受影响
全量或额外生产化框架代替最小 focused 证明。后续动态运行仍须单独授权及适用准入。

## 12 · 当前静态事实、缺口与后续设计（R-16）

本节是当前源码观察导航；reviewer 必须重开源码，不能继承讨论稿或本节结论。

| owning source（仓根相对） | 当前事实 / 本专项差量 |
| --- | --- |
| `apps/terminal/kernel/base/server-config/src/features/slices/serverConfig.ts` | 代理密码当前 protected、sync isolated；尚不符合本专项明文同步裁决 |
| `apps/terminal/kernel/base/server-config/src/selectors/selectServerConfiguration.ts` | config view 与网络取值已有；新读路径须收敛公开 selector，避免新snapshot读面 |
| `apps/terminal/kernel/base/server-config/src/application/createServerConfigModule.ts` | 已支持注入 defaults 与 hydration 校验；serverSpaces入口未接 |
| `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts`、`apps/terminal/application/android/sample-terminal/src/assembly/platformPorts.ts` | terminalSurfaces已有package读取/显式传入，可复用接线形态 |
| `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`、`src/generated/terminalApi.ts`（同包） | 当前完整路径参数/凭证提交来源需适配；现有cancel公开名仍旧 |
| `scripts/generate/terminal-client-api.mjs`、`contracts/policy/terminal-client-generation.json`、`contracts/openapi/paths/terminal/activation.paths.json`、`contracts/openapi-source/terminal-binding.schemas.json` | 完整canonical/catalog及请求五字段存在；新后缀投影尚未生成 |
| `apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts` | Node HTTP当前根相对path覆盖base pathname；不是设备HTTP/代理证明 |
| `apps/terminal/kernel/base/topology/src/foundations/resolveCommandTarget.ts`、`src/features/actors/actors.ts`（同包） | PRIMARY peer-intent留本地；退配中间角色/repairPending不能代表完整成功 |
| `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`、`src/components/AdminLayerFrame.tsx`（同包） | 双机LMS当前打开/关闭依赖peer，需本地admin承载 |
| `apps/terminal/kernel/base/ui-state/src/foundations/workspaceOwnership.ts` | MAIN主机写、BRANCH副机写；不能为admin放宽MAIN业务归属 |
| `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts`、`apps/terminal/ui/base/integration-assembly/src/foundations/stateSyncSlices.ts` | 已有同步修订机制；两个composition须显式注册所需同步 |
| `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts`、`src/features/actors/actors.ts`（同包） | 当前single pending不满足两端独立未完成录入 |
| `apps/terminal/kernel/feature/sample-staff-session/src/features/slices/slice.ts`、`apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts` | staff当前isolated；壁纸本地owner已有，主机投影与LSP呈现待接 |

待后续设计完成而非新增产品讨论：唯一 Journey 与四面交互/IA、command和selector的真实公开接线、
同步存储与当前主机身份绑定、异步失败/结果反馈、package JSON形状、component路径/helper有限复用、
Web/设备 adapter闭包、每场景执行面/VM资源与准入。设计依赖第三方 API/运行行为时须核实实际解析
版本和版本匹配官方依据，不在需求里凭记忆钉版本或宣称可用。

本轮只读静态资料不能证明 UI 已实现、VM 已就绪、启动/打包/代理/双屏行为通过。旧激活/拓扑批次
的运行仅是历史证据，不变成本专项 PASS。需求审查通过仅表示可进入后续获授权设计。

### 12.1 有限复评清单：防止需求整理由同根漂移

1. 原始六项需求及补充逐项对应 R-01～R-16，区分用户裁决、现有事实和待详设形态。
2. 主机与副机、内容与实例、缓存与当前资格、HTTP与TDS、服务空间与集团空间分别核对。
3. 四个内容场景、两个integration、两个admin tab的资格与失败路径全部扫描，不只修命名实例。
4. 全部command触发与selector读取链收敛；helper/provider不成为另一套业务机制。
5. prefix/generated/adapter三处一致；明文代理、凭证保护、内置配置、同步实际defaults各有边界。
6. 并发会员/响应倒序、断链遮罩/admin、异步退配中间态、迟到投影均有可执行反例。
7. 当前只静态、未来Web优先和四VM拓扑目标、历史动态档位、两轮授权边界分别表达。

该清单是本轮需求差错的最小预防住址，不新增机器门、hook、台账或要求未获授权动态运行。
