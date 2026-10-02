# 终端激活交互与双机拓扑优化专项 · 需求讨论稿

```text
DOC_KIND=REQUIREMENTS_DISCUSSION
AUTHOR=Claude
STATUS=DISCUSSION_NOT_APPROVED_FOR_IMPLEMENTATION
BUSINESS_SOURCE=Dexter 2026-10-02 本会话原始需求及补充裁决（§9）
EVIDENCE_TIER=当前仓内静态源码与原始需求；本轮动态验证 NOT_RUN
AUTHORITY=需求讨论稿、术语规范与项目记忆指针维护；不授权生产源码实施或动态运行
```

## 0 · 真实目标、已明确与待讨论的边界

本专项要让使用终端的人能够按顺序完成设备激活、店员登录和业务操作；同一业务在 mobile、
laptop 主屏、主机副屏内容与副机独立主屏内容中有明确入口和适当的页面。双机配对不能制造第二份
终端激活身份或第二条 TDS 连接，会员可以两端分别录入，壁纸可以两端分别选择。

本稿标记约定：**已明确**来自 Dexter 原话；**静态事实**来自当前源码；**建议**是待确认的最小方案；
**待裁决**是尚未确定的用户行为，不得由实施方自行补成产品事实。

已明确：

1. 四个界面内容简称的唯一映射正本为 `doc/platform/terminal-coding-standard.md` §4-E；
   项目记忆只通过 `project-memory/operations/terminal-coding-standard.md` 路由到该正本。
2. 新包按后文明确名称理解为 `apps/terminal/ui/base/terminal-activation`；原话中的「¥包」不作为包名。
3. terminal-activation 负责激活交互与状态页，terminal-data-client 仍拥有凭证、激活/取消激活及 TDS 业务。
4. 副机不能独立连接 TDS，不能是本机激活态；已连接 TDS 的机器不能作为副机。
5. LSP 新增会员在自己的页面完成顾客确认；供电变化仍经确认后切换 LMS/LSP。
6. 副机配对后只能作为主机扩展，本身不作为独立终端；LSP 是独立页面，不是第二个独立终端。
7. 两个 integration 均集成 terminal-data-client、terminal-activation，并负责业务模块的阶段路由。
8. 最终实施要覆盖四种虚拟机部署场景；现在只讨论需求，不执行任何运行。
9. LSP 沿用主机店员登录资格；主机登出后副机退出业务并显示登录提示，不同步店员口令。
10. 已配对副机断链时，integration 在所有业务屏幕上统一显示「配对连接中，请稍后」，禁止继续业务；
    左上角 admin console 仍可本地打开，管理员可取消配对或切换配对主机地址。
11. LMS 背景跟随主机；LSP 保存副机自己的背景，切回 LSP 后恢复，两端选择互不干扰。
12. 新建 `apps/terminal/ui/base/server-config-panel`，扩展 admin console 的服务配置 tab，
    编辑 kernel/base/server-config 提供的配置；它是 UI，不接管配置事实或网络 provider。
13. terminal-activation 激活表单**仅输入 8 位数字激活码**；集团空间编码、设备身份、机型、版本、
    operationId 与秘密都不要求激活用户输入。其自动来源逐字段见 §2.4。
14. server-config 配置的是 **server URL 前缀**，该前缀包含集团空间路径；终端业务包 generated API
    提供后续请求路径，如 `/activation`。二者组合为完整 URL，激活调用不再另外提供集团空间路径值。
15. MMP/LMP 激活页在 8 位激活码输入区域明确显示当前「服务空间：名称」，让用户在提交前知道
    激活所用的服务环境；名称为只读配置展示，不增加用户输入。
16. 配对副机同步并存储主机的 server-config 配置与 terminal-data-client 状态信息，一切以主机为准。
    副机 admin「服务配置」tab 不可编辑，「设备激活状态」tab 不可取消激活；也不代发主机修改命令。
17. 代理密码按普通字符串明文存储并同步给副机，不作加密或 protected persistence；副机可使用主机
    同步的服务地址及代理配置独立发送后台业务 HTTP 请求。这不赋予副机独立激活或连接 TDS 的身份。
18. 取消激活公开命令统一命名为 `cancelTerminaActivationCommand`（Dexter 指定的准确拼写）；
    当前源码旧名为 `cancelTerminalOnlineCommand`，本专项后续实施统一重命名，不保留旧名兼容入口。
19. server-config 内置服务空间允许像 `terminalSurfaces` 一样在终端入口包的 `package.json` 中以
    `serverSpaces` 声明，启动读取、打包随应用内置，作为 server-config 的内置 defaults；不在业务包重复硬编码。
20. 发业务指令一律使用 owner 公开 command；读业务数据或状态一律使用 owner 公开 selector。
    不新增 service/getter/callback/event bus/snapshot 或 capability 业务入口来替代二者。
    正本见 `doc/platform/terminal-coding-standard.md` TR-01、TR-03、TR-11、TR-15。

**全文接线解释**：下文当前源码中的 capability/provider/snapshot 名称是静态盘点，不是新业务机制的授权。
本专项新增 UI/integration/helper 只能组合公开 command 派发与公开 selector 读取；现有底层 adapter、
transport 和 state 同步/持久化能力保持基础设施职责，业务不能借这些入口绕过 command/selector。
composition 注入的配置 provider 应读取 config owner selector 再供 network adapter 消费，client 仍只调
通用 transport command，不直接读 config。副机独立 HTTP 业务同样由具名业务 command 发起，结果写 owner
state 后经 selector 读取；component 不直接请求 API，也不通过私有回调取得业务数据。

原 Q-1～Q-3 均已裁决，其中 Q-2 以统一阻断业务的遮罩替代“本地壁纸继续操作”的推荐方案。
§10 明确 state/command 责任和当前静态链路缺口；新增字段名与内部接线是待详设的最小建议，
不能把业务裁决或静态盘点当作实现已经完成。
Dexter 已纠正：集团空间编码是激活 URL 的路径内容，不是 body/query 中的单独请求字段。
Dexter 随后明确前缀+后缀规则（§2.5/§9.8）；剩余是该规则的生成/通信接线缺口，
不是要求用户另填集团空间或修改激活码规则。
不新增集团空间 body 字段、不删除现有 URL 语义、不根据激活码跨空间查找，也不恢复集团空间输入框。

## 1 · 界面场景与当前代码核对

四个内容简称及设备/内容两轴映射**不在本稿另建第二份定义表**，统一回读规范 §4-E。
本稿使用 MMP、LMP、LMS、LSP 时均沿用该定义。

| 静态核验项 | 当前 owning source | 判断 |
| --- | --- | --- |
| 显示模式与 workspace | `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:14–20` | 双机副机 VICE 对应 SECONDARY/MAIN，CHIEF 对应 PRIMARY/BRANCH；不能把双机 LMS 的承载实例写成 MASTER |
| catalog 的各轴 | `apps/terminal/kernel/base/ui-state/src/types/catalog.ts:11–35`；`apps/terminal/ui/base/render/src/foundations/createCatalogContext.ts:7–20` | 现有 ui-state 并没有名为 master+primary 的独立枚举；按内容地址、机型与承载实例分别判断 |
| 写入 owner | `apps/terminal/kernel/base/ui-state/src/foundations/workspaceOwnership.ts:5–28`；规范 §4-D | MAIN 主机写，BRANCH 副机写；渲染主机投影不产生副机的 MAIN 写权 |
| 供电切换 | `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:61–67`；`src/features/actors/powerRoleChangeActor.ts:95–114` | 供电变化产生待确认状态，确认后切角色；本专项沿用 |
| 当前组件划分 | 三个 sample UI 包的 `src/components/laptop/`、`mobile/` 及 `src/parts/parts.ts` | 已有机型轴，但 LSP 的独立页面与注册不完整，不能仅加目录就声称支持 |

配对存在、peer 可达、实际供电和已生效角色应分开看：短暂断链不自动解除配对，也不自动提升副机为主机；
未知供电或未确认切换不能被当成已进入另一内容场景。

## 2 · 终端激活交互

### 2.1 新包的责任与入口

**已明确**：terminal-activation 是可复用的 UI base 包，拥有自己的 UI command/actor、parts 和交互；
不保存第二份凭证，不实现 HTTP/WS 策略，不成为业务后端 owner。

保留入口名 `needToActivateTerminalCommand`。它请求展示本包交互，**不等于调用后台激活**。
用户在表单中提交后才调用 terminal-data-client 的 `activateTerminalCommand`。

| 内容场景 | 主机尚未激活时 | 主机已激活时，显式收到该 UI 入口 command |
| --- | --- | --- |
| MMP | mobile 激活页 | 仅显示「设备已激活成功」 |
| LMP | laptop 激活页 | 仅显示「设备已激活成功」 |
| LMS | 提示页：「请在主屏幕上完成设备激活」 | 仅显示「设备已激活成功」 |
| LSP | 提示页：「请先在主机上完成设备激活」 | 仅显示「设备已激活成功」；这里指主机，不能标记副机自身已激活 |

普通 integration 路由在主机已激活时进入登录/业务，不再反复调用激活 UI 入口；显式外部请求的成功
提示与普通业务路由是不同触发。成功提示的停留/继续方式留给交互稿，不在需求阶段凭空添加自动计时。

**已明确的唯一输入**：8 位数字激活码，按字符串保留前导零；没有集团空间、设备身份、机型、版本或秘密输入框。
**服务空间展示（Dexter 已明确）**：MMP/LMP 激活页在激活码输入区域显示「服务空间：名称」。
通过 integration 注入 server-config 公开 selector 的脱敏展示信息，随生效配置更新；terminal-data-client
不因此直接读取 server-config。展示对应本次激活采用的服务配置，不能保留旧名称却向新环境提交。
服务空间名称与 URL 中的集团空间编码是不同信息，不能拿 `mixc` 这类路径编码冒充服务环境名称。
当前配置已有 `selectedSpace` 与 `spaces[].name`，优先复用；其服务覆盖跨环境共享，详设需核对
显示名称与实际生效 URL 的一致性，不能仅凭 selectedSpace 标签声称覆盖后的地址一定属于该环境。
设备身份、机型、应用版本与安全随机秘密沿用 owner/adapter 来源；服务地址来自 server-config。
集团空间已经包含在配置的服务 URL 前缀中，业务 generated API 只给后缀；不先解析集团编码再拼完整路由，
不能用配置环境名替代，也不能从未授权的 default/fallback 猜取。
错误按业务原因显示；提交中避免重复制造独立操作，失败可重试，沿用现有同次激活秘密复用规则。
已激活不再次发起激活；后台拒绝、网络失败、身份或能力缺失不能被显示成成功。

**取消与恢复**：沿用 client 的取消、保留/清除、应用 reset/restart 行为及可见失败，不把“取消完成”
简单等同于所有本地清理完成。取消期间不进入登录/业务；离线取消仍是既有独立语义，本稿不默认为
admin 新增第二个危险按钮。与重启相关的用户提示在交互/IA 中补齐。

### 2.2 admin console 的「设备激活状态」tab

**已明确**：terminal-activation 自带状态 section，两个 integration 将其并入共享 admin-shell catalog。
复用现有隐藏入口、tab/section、renderer 与权限承载，shell 不反向 import 新包，也不复制一套管理台。

状态内容至少显示本机是否激活、对应终端/门店/集团空间信息、连接状态、最近延时与可恢复的错误原因。
只显示业务信息，不显示凭证、激活码、代理密码、raw payload 或内部错误堆栈。

主机已激活时提供「取消激活」，调用 `cancelTerminaActivationCommand`（本专项目标名称）；失败保留准确状态与重试反馈。
该 tab 没有激活表单或激活动作。副机本机从不显示已激活；展示主机摘要时必须标明「主机」，
同时区分 peer 当前可达与最近收到的信息。配对副机该 tab 只读，即使主机显示已激活也不可取消激活，
不提供本机或代主机取消的 command 入口；修改与取消一切以主机为准。

可复用入口：`apps/terminal/ui/base/admin-shell/src/foundations/adminSectionSelection.ts:58–83` 的额外 section 枚举，
`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:37–52` 的真实 section part 注册。
不得把 section 的受限导航 boundary 当成任意业务命令都已可执行；详设需核实具体取消 command 通道。

### 2.3 server-config-panel 与 admin「服务配置」tab（新增已明确范围）

新建 `apps/terminal/ui/base/server-config-panel`，拥有自己的 mobile/laptop 管理页面、UI 草稿/提交反馈、
section parts 与公开配置 command 派发/selector 读取接线；两个 integration 将它并入现有 admin catalog。
复用 admin-shell，不新建管理台；LMS/LSP 副机仍按 §4.1 使用本机 admin 控制面。

以下编辑能力仅适用于主机或未配对本机；配对副机整个「服务配置」tab 只读，不提供环境切换、
地址/代理编辑、保存、清除覆盖或恢复默认操作，不能通过 peer command 代改主机配置。
当前可编辑的能力边界以 config owner 为准：

- 选择已声明的配置环境；编辑已声明服务的完整地址列表（1～4 个地址、地址名、完整 URL、正超时）。
- 编辑该服务的可选 HTTP 代理、用户名和密码设置意图；可设置新密码、保持已有密码或移除认证。
- 清除某个服务的覆盖，或显式恢复全部默认；不直接修改只读 defaults，不任意新增环境/服务。
- 表单只有草稿；保存经 `setServerOverrideCommand`，环境经 `selectServerConfigSpaceCommand`，
  清除/恢复经 `clearServerOverrideCommand`/`restoreServerDefaultsCommand`。不得直接 dispatch slice action
  或读取/写入 persistence；非法完整配置由 owner 整次拒绝。

当前 overrides 和密码按服务名存储，跨配置环境共享；切换环境不会清除覆盖，UI 不得呈现为每个环境
各自保存一份覆盖。修改此作用域不属于新增 panel 的隐含要求。
**代理密码裁决已明确**：代理密码为普通字符串，进入 server-config state、明文持久化及主→副同步，
无需加密或 protected persistence。副机收到后同样明文存储，交给本机网络 adapter 用于后台业务请求。
这项裁决限定代理密码，不改变 terminal-data-client 激活凭证及 pending activation 秘密的 owner/保护边界。
当前管理 selector 只显示 `passwordConfigured`，网络 snapshot 提供实际密码；是否沿用密码控件遮蔽不影响
上述明文存储/同步要求。“保持”当前只保留已设置的 override 密码，不能根据 defaults 的
passwordConfigured=true 就声称可保持默认密码；配置读取和同步必须包含实际生效的代理配置，不能漏掉默认代理。
日志及错误内容仍不输出密码；无需为本项另建密码加密、密钥或传输封装能力。
command 返回后回读 owner selector，并区分当前生效与持久化失败，不能仅按按钮点击显示已保存。
当前 config actor 同步写内存后返回，immediate persistence 是异步 autoflush；保存完成判据须复用
现有 flush/health 能力，由保存 command 的 actor 等待现有持久化生命周期完成；UI 通过 selector 读取
保存/失败状态，不能把 completed 当成已落盘，也不另增 save service、flush callback 或查询 getter。
配置切换只改变后续请求/建连使用的配置，不自动取消激活、改写凭证或假定当前长连接已经切换。

**已裁决的主副写入路径**：仅主机或未配对本机管理页调用本机 config command。
配对副机展示并存储主机同步的配置，tab 只读；副机只接受主机 authoritative apply，不自行改配置，
也不发送修改主机配置的 peer command。断链仍只读，保留取消配对/修改 topology 主机 host 的本地恢复入口。
这两个“地址”分别属于不同 tab/owner，不把 backend 服务地址或代理写入 topology locator。

**当前静态事实**：config 完整脱敏 selector/公开 commands 已存在，panel/tab 与 capability 注入尚不存在；
默认 admin section boundary 拒绝任意 dispatch，不能只注册 tab 就声称编辑链路已通。
配置中的 `selectedSpace` 是 DEV/PROD 等服务环境，当前没有独立 `groupWorkspaceKey` 字段；
本专项不因此新增集团空间 body 字段或要求管理员另填集团空间字段。

### 2.4 激活参数的自动来源与现有缺口

| 参数/信息 | 当前 owning source 或拟议发送方 | 用户输入与边界 |
| --- | --- | --- |
| `activationCode` | 激活表单 → UI submit → client `activateTerminalCommand` | **唯一激活输入**：8 位数字字符串；不作 Number 转换 |
| 服务空间名称（页面展示） | server-config 公开脱敏 selector → integration → 激活 UI | 只读显示本次激活使用的服务环境名称；不进入激活 body，不要求用户输入，不由 client 读配置 |
| `groupWorkspaceKey`（URL 路径内容） | 本专项在 server-config 的 URL 前缀中配置；generated 激活后缀不包含/再替换此参数 | 不在 body/query 中，不要求 UI或调用方另提供编码，不从 selectedSpace 替代；当前完整路径生成仍需调整 |
| `operationId` | 激活 UI/controller 为一次激活操作生成并沿现有重试约定复用 | 自动，不向用户展示或要求填写；不另造幂等框架 |
| `surfaceForm` | integration/application 的真实机型声明 → client payload | 自动，不能按屏数或用户表单猜机型 |
| `appVersion` | application/composition 的应用版本元数据 → client payload | 自动；不是用户可编辑字段 |
| `deviceId` | client actor 经 DevicePort 读取设备身份 | 自动；能力缺失显示可恢复错误，不能用固定假身份通过验收 |
| `credentialSecret` | client 的 `createCredentialSecret` 来源，沿现有同次操作秘密复用 | 自动且唯一由 client 持有；UI/config-panel 不接触它 |
| `terminalRef/storeRef/bindingGeneration` | 服务端激活结果 → client 凭证提交 | 不输入、不配置为请求值；服务端返回后才成立 |
| 凭证内部 `groupWorkspaceKey` | 新方案由激活成功响应字段自动进入 client 凭证；当前源码仍取 pending 中的请求路径值 | 保留 TDS/取消等现有凭证所需身份，不要求用户填写；这是待改 owner 接线，不能说当前已取响应 |
| 业务服务名、服务地址、代理 | composition 注入的 server-config provider → transport；client 调通用 transport command | 激活表单不编辑；管理员在配置页维护。client 不直接读 config selector/snapshot/state/persistence |

静态证据：`apps/terminal/kernel/base/terminal-data-client/src/types/client.ts:83–89` 当前 payload 仍含
集团空间、机型、版本和 operationId；`src/features/actors/terminalDataClientActor.ts:329–344` 从 payload
取得集团空间并生成 pathParameters；`src/generated/terminalApi.ts:33,60–64` 的激活路径为
`/api/terminal/group-workspaces/{groupWorkspaceKey}/activation`。
canonical `contracts/openapi/paths/terminal/activation.paths.json:34–44` 明确标为 `in:path`；
`contracts/openapi-source/terminal-binding.schemas.json:7–13` 的五个请求体字段不含集团空间。
这里的 `pathParameters` 是 generated client 生成 URL 的内部元数据，不能称为用户必须输入的独立 body 参数。

**实际接线缺口**：当前 client 先由内部集团路径值生成以 `/` 开头的完整 operation path，
受管 Node 真实 adapter 再用 `new URL(pathAndQuery, baseUrl)` 发请求
（`apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts:195,371–378`）。
因此即使把带集团空间的完整激活 URL 填入当前 baseUrl，其 pathname 也会被 generated path 替换，
现有代码不会自动从 baseUrl 取得该集团路径值。
例如配置地址含 space-A，但内部 pathParameters 仍给 space-B，现有受管 Node 会请求 space-B；
这是按源码和根相对 URL 解析规则形成的静态推导，没有运行动态实验，也不推成 Android 已具备相同接线。

后续详设按 Dexter 明确规则实现 **配置 URL 前缀 + generated 相对后缀 → 完整请求 URL**。
撤去“先解析集团空间再传 pathParameters 拼完整路由”的候选方向；保留接口生成源闭环、
client/config owner 边界与通用 transport，transport 只组合地址，不解析集团或激活业务语义。
若涉及多地址，不能重试时静默改到另一集团路径；字段表达、验证与 composition 输入须一并定稿。
当前方案不需要后端只凭码跨集团查找或新增查询接口，也不要求激活用户补齐内部 pathParameters。

### 2.5 server URL 前缀 + generated API 后缀（Dexter 已明确）

以本次原话为例：

| 住址与责任 | 配置/生成结果 |
| --- | --- |
| server-config 的业务服务 URL 前缀，由配置管理页编辑 | `http://127.0.0.1:7890/api/terminal/group-workspaces/mixc` |
| terminal-data-client 的 generated 激活 API 路径 | `/activation` |
| 最终激活请求 URL | `http://127.0.0.1:7890/api/terminal/group-workspaces/mixc/activation` |
| generated 取消 API 路径 | `/terminals/{terminalRef}/activation/cancel`，terminalRef 自动来自 client 凭证 |

这是 URL 表达例子，不授权本机 Java/后端运行，不替代受管远端运行拓扑。
server-config 仍只保存地址前缀/代理，不新增独立集团空间业务字段；UI 表单不复制集团空间配置。
生成器只从 canonical 完整 OpenAPI route 按具名消费策略派生后缀，不在业务手写完整路径/删改 generated 文件。
共享 OpenAPI 继续描述后端完整 URL 路由及路径身份；只调整终端 consumer 的生成投影，不能把所有后台或
其他 consumer 的契约全局改成 `/activation`。取消后缀里的 terminalRef、原 Authorization 与 deviceId 语义保留。

地址组合必须**保留前缀 pathname**：显示出来的 `/activation` 在这里是附加后缀，不能直接采用
`new URL('/activation', prefix)` 的根路径替换语义。前缀尾斜杠/后缀首斜杠与 query 的处理须在通用通信
能力中清晰归一化并复用；不能重复添加 `/api/terminal/group-workspaces/...` 或丢掉 `mixc`。
可复用的当前同族示例为受管 Node WS 接线
`apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts:360–362`，已做前缀尾斜杠和
后缀前导斜杠归一。HTTP 尚未接同一语义；详设需让公共通信能力复用该规则，而不是每业务包复制 URL 拼接。
同步改生成策略、typed client 内部参数、请求构造与实际 adapter 消费；不能只改管理页输入文案。

当前变化还涉及 client 的同次激活上下文与凭证提交：原 pending 用显式集团编码隔离同码操作，
取消/凭证也保留集团身份。详设须在采用前缀后保持原同次激活秘密复用与目标范围隔离，不因多地址重试
换集团，不因修改配置偷偷改绑已有凭证。成功响应已提供集团编码，新方案由 client 自动接收该身份。
这些是当前需求及原激活 owner 的适配点，不引入独立集团输入、跨集团查码或新的同步/仲裁框架。

### 2.6 package.json 声明内置 serverSpaces（Dexter 已明确）

**需求**：允许在 package.json 声明各个 `serverSpace`，字段统一为 `serverSpaces`，在启动或打包时
成为应用内置的 server-config 服务空间。声明包含服务空间名称、该空间下各服务的 URL 前缀/地址列表、
超时及可选代理配置，并明确默认选中空间；代理密码仍按 §2.3 的普通字符串裁决处理。
具体 JSON 形状在详设中复用现有 `TransportServerConfig` 的 `selectedSpace/spaces/servers` 结构与校验能力，
不另造不兼容的配置模型，也不根据构建模式暗猜用户应连接哪个服务空间。

**接线与单一来源**：沿用 terminalSurfaces 的入口模式，两个 integration 包的 package.json 提供其 Expo Web
入口内置声明；实际 application 包的 package.json 提供该应用启动/打包的内置声明，经 application
composition 显式传给 integration，再注入 `createServerConfigModule`。一个运行入口最终只使用一份
明确选定的内置声明，不把 application 与 integration 两份空间列表偷偷合并；kernel 不反向读取 UI/app 文件。
解析/校验能力放在可复用 owner/base 能力中，不能在两个 sample 复制解析逻辑，不要求另造生成框架。

**内置与运行时关系**：package 声明是只读内置 defaults；主机/未配对本机 admin panel 仍通过 config commands
选空间、设服务覆盖或恢复默认。启动先用内置声明构建 owner，再按现有 hydration 校验恢复配置；不能每次
启动用 package 默认值覆盖已保存的合法用户配置。恢复默认以本应用选定的内置声明为准。
无效声明应由既有 defaults 校验拒绝并报告准确原因，不悄悄换用另一个环境。

**副机规则**：配对后副机以主机同步并存储的服务空间及实际配置为准，不能因自己的 package 内置声明
不同而改用另一环境；服务配置 tab 仍只读。同步须包含消费所需的主机内置空间/实际生效配置，不能仅
复制 overrides 却再用副机不同的 defaults 算出不同地址或代理。
激活页服务空间名称与 panel 的空间列表由同一生效配置来源提供。

**静态事实与差量**：`terminalSurfaces` 已在 integration 的
`src/application/terminalSurfaces.ts:1,35–38` 读取本包 package.json；Android application 的
`src/assembly/platformPorts.ts:1,10–17` 显式传本包声明，integration assembly 以输入优先。
`createServerConfigModule` 当前已经接收并校验外部注入的 immutable defaults，但两个 sample 入口尚无
serverSpaces 声明/注入接线。本项是待实施需求，未运行启动、打包或生成验证。

## 3 · 三个 sample UI 包的统一入口与四面覆盖

建议仅将原名 `needToLoginStuffCommand` 更正为 `needToLoginStaffCommand`（staff＝店员）；
`startMemberDeskCommand`、`startWallpaperPickerCommand` 保留。三个 UI 包各自拥有入口 command，
integration 只调用公开入口，不硬编码其他包的 partKey。

| 包 | MMP/LMP | LMS | LSP |
| --- | --- | --- | --- |
| sample-staff-auth | 各机型的店员登录交互 | 建议显示「请在主屏幕上完成店员登录」 | 显示主机登录提示，不独立登录；建议文案「请先在主机上完成店员登录」 |
| sample-member-desk | 会员列表、录入、顾客确认；主机可登出 | 沿用顾客欢迎/核对/可选年龄/确认或拒绝 | 独立会员列表与录入页面，在本页完成顾客确认；没有店员登出动作 |
| sample-wallpaper-picker | 选择自己使用的背景；主机可登出 | 展示主机已确认壁纸 | 独立壁纸选择页面，只改 LSP 背景，切回后恢复；没有店员登出动作 |

MMP/LMP 的工作台通过已有 staff-session command 执行登出，不直接改会话 slice。LSP 独立组件的
公开操作集合中不含登出，不以同一页面的 `if (isSlave)` 分支或隐藏按钮充当独立页面。
共享字段、列表呈现、输入 hook 等可以复用；独立页面不意味着复制 kernel 业务逻辑。

### 3.1 同一会员列表、两个独立录入过程

**已明确**：LMP/LSP 看见同一已登记会员集合，两端可以分别添加；LSP 自己完成顾客确认。
保留现有 sample 的姓名、电话和顾客可选年龄语义，不扩大成正式会员中心或后台会员主数据系统。

可验收的业务约束：

- 两端分别创建草稿和提交时，不覆盖另一端的草稿、待确认资料或结果；允许两端各自有一个未完成录入。
- 确认只作用于所核对的那一次录入，不能用旧确认误提交另一端较新的 pending；拒绝/撤回同样隔离。
- 提交成功后，两端从同一事实 owner 获得列表；失败不增添半条会员，也不误报列表已同步。
- LMP 的顾客确认沿用现有 LMS 路径；没有副屏的主机仍按既有单屏流程完成确认。LSP 在自身页面确认。

**静态缺口**：`sample-member-registry/src/features/slices/slice.ts:9–55` 目前只有一个 pending；
`src/features/actors/actors.ts:37–63` 的 submit/confirm 围绕单 pending 工作。仅开放 LSP renderer 会覆盖
另一端录入，不满足新需求。

**建议**：已登记列表保持主机上的一个 owner，两端的草稿/确认交互按发起端隔离；复用已有 peer
通信与 state 投影。LSP 的 BRANCH UI 由副机写，不能据此把公共会员集合变成两份可独立合并的事实。
当前 `topology/src/foundations/resolveCommandTarget.ts:24–30` 只将 SECONDARY 的 peer-intent 交给主机，
PRIMARY 的 LSP 留本地；详设必须明确共享会员提交的具名 owner 路由，不能假设所有 command 都自动过 peer。
不引入多主合并、CRDT、通用任务队列或新同步框架。断链时统一遮罩，录入、确认和提交都暂停；
可以保留未提交草稿但不能继续操作，重连后先核验主机资格和精确 pending 再恢复。

以上 sample/kernel 路径均相对 `apps/terminal/kernel/feature/`，UI 路由涉及的 topology 路径相对
`apps/terminal/kernel/base/`；实际 UI 包保持主/副的独立页面。

### 3.2 壁纸彼此独立

**已明确**：LMP 选择不改变 LSP，LSP 选择不改变 LMP；每一端显示自己的已确认背景。
取消选择不改变任何已确认背景。换供电并确认切换后，再次进入 LSP 应能取回该副机自己的选择。
Dexter 已确认此恢复语义；LMS 始终跟随主机已确认壁纸，不读取副机自己的 LSP 选择。

**静态事实**：`apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts:30–43`
已有 isolated state，可复用；当前背景在整个本机 assembly 读取同一 selector，因此还不能声称已做到
内容场景隔离。LMS 是显示主机内容的场景，不能让副机本地 LSP 壁纸覆盖该场景。
断链遮罩期间 LSP 壁纸操作也被阻断；保存旧选择不等于允许断链继续业务。

## 4 · integration 是业务阶段路由 owner

两个 sample integration 均集成 server-config、transport、terminal-data-client、terminal-activation 和
server-config-panel 及所需 sample 包。地址/代理 provider 仍由 composition 注入 transport adapter；client 不直接读
server-config 的 selector/snapshot/state/persistence。kernel 不依赖 UI。

**主机已明确路由**：

| owner selector 所见事实 | sample-console 调用 | sample-wallpaper-console 调用 |
| --- | --- | --- |
| 本机未激活 | needToActivateTerminalCommand | needToActivateTerminalCommand |
| 本机已激活，店员未登录 | needToLoginStaffCommand | needToLoginStaffCommand |
| 本机已激活，店员已登录 | startMemberDeskCommand | startWallpaperPickerCommand |

“持续 select”表示启动 hydrate/initialize 后以及相关事实变化后重新判定，不是 setInterval 轮询。
integration 拥有阶段优先级，UI 包拥有本阶段内部呈现和导航。当前 feature 与 wallpaper integration
存在监听登录结果后直接跳业务页的路径（§8），必须消除竞争，避免未激活时旧登录恢复事件把激活页盖掉。
重复的同阶段输入不重置正在填写的表单，不因每次 RTT/PONG、无关 state 更新而反复切首屏。

**副机已明确路由**：副机本机激活态始终为未激活；业务前提读的是明确标记为主机的投影，不能机械套用
上表第一行，否则会永远卡在激活提示。MAIN 的 LMS placement 由主机写并投影；BRANCH 的 LSP
交互由副机持有。配对副机沿用主机店员准入，主机登出后退出业务，不能继续以旧投影执行共享业务命令。
首次投影未到、同步断链、主机取消中分别显示准确的等待/不可达/处理状态，不能把
“还没收到主机状态”当成“主机未激活”，更不能给副机提供激活按钮。只投影必要会话事实，不复制店员口令。

不新增 `currentBusinessStage` 等导航事实副本；阶段由 owner selector 派生，页面位置仍由 ui-state
管理。采用 TR-11 的事件→command→actor 形态，复用现有 framework 订阅/派发，避免通用路由引擎。

### 4.1 已配对副机的统一断链阻断（已裁决）

此策略由两个 integration 统一决策，不能让每个 feature 自己决定断链后是否还能操作。
不论 LMS/LSP 当前处在激活提示、店员登录提示、会员列表/表单/顾客确认、壁纸页或业务弹层，
断链时均显示「配对连接中，请稍后」，屏蔽业务触摸、鼠标、键盘与残留焦点；壁纸本地操作也不例外。
现有页面/草稿可保留在遮罩下，不借此新增离线提交、队列或合并。

本地 admin 控制面位于业务阻断面之外：左上角入口、管理员认证及其输入、管理页、关闭操作始终可用。
关闭 admin 后若尚未恢复，仍显示遮罩；不能通过 admin 关闭动作解除业务阻断。
共享 base 只提供遮罩/本地控制面承载与输入隔离机制，具体阻断策略仍由 integration 拥有。

断链保留配对关系和主机摘要，但摘要不再作为当前业务准入。重连只有 peer accepted 还不够：
该连接的主机激活、店员及当前业务所需投影应用完成后，重新按最新事实路由；
主机已登出进入登录提示，主机已取消激活进入主机激活提示，不能只隐藏遮罩回到旧工作台。
配对/退配未完成或失败也保持业务不可操作，admin 可继续恢复；不得在角色提前变为 MASTER 时放行。

**静态反例**：当前 LMS 的 admin open/close 使用 peer-intent，会发送主机；断链时不可用。
单改 local 又会被 ui-state 的 MAIN 写入归属拒绝。当前渲染层也未区分本地 admin 与业务 layer。
因此本专项必须补本地管理状态/渲染通道，保持 SLAVE 不可写 MAIN 业务内容；具体来源与发送表见 §10。

## 5 · 主副机准入、配置与状态同步

### 5.1 Dexter 已裁定的主副机约束

副机配对后只作为主机扩展，不建立独立终端身份或独立后台业务 owner。
Dexter 随后明确 LSP 沿用主机店员准入；这是本专项的单独裁决，不是由「扩展」一词自行推导。
副机不能拥有本机激活身份，不能独立连接 TDS；LSP 的独立业务页面不改变该限制。
已激活的机器即使暂时断开 TDS，也不能成为副机；要转换角色，必须先按现有明确取消激活流程完成，
不能由配对动作偷偷取消激活或只断开 socket。已经连接 TDS 的机器更不能进入副机角色。

该约束要在切角色/接受配对、激活/建连、启动 hydrate 和异步完成提交处一致成立。需覆盖
“开始激活后切 SLAVE”“开始配对后恢复旧凭证”“连接中改角色”等竞态；以最终 owner 复核为准，
不能仅依赖 UI 按钮禁用。发现持久化副机角色与本机凭证冲突时，明确拒绝进入副机运行，不自动清秘密，
不假装已断开且可配对；具体恢复提示在详设确定。

### 5.2 两个包向副机同步的实际含义

| owner | 需求理解与最小建议 | 不应传播为副机自身事实的内容 |
| --- | --- | --- |
| server-config | 主机的已选服务空间、实际生效服务地址及代理配置（含普通字符串明文代理密码）同步并存储到副机；主机唯一配置写 owner，副机消费这些配置独立发送后台业务 HTTP 请求 | 配对副机管理 tab 只读；不向主机反向写配置，不独立连接 TDS；代理密码同步不等于同步激活凭证 |
| terminal-data-client | 主机的激活身份摘要、连接/延时状态同步并存储到副机；owner 公共 selector 显式区分本机状态与主机信息，管理 tab 只读 | credentialSecret、pending activation 秘密、socket、ping seq/deadline、重连任务不复制；主机状态存储不能使副机本机变 active，不提供取消激活 |

**已明确**是两个包的主机信息均同步并存储到副机，其中代理密码明文同步/存储，不再作为讨论项。
详设补齐同步字段、持久化接线与公开 selector；配置不能只传 UI 脱敏摘要而漏掉副机 HTTP adapter 所需代理密码。
client 的主机状态与本机凭证/运行资源仍分开。连接/延时标明属于主机；pair 可达性来自 topology，
不得混称成副机 TDS 在线。副机重启后可读取已存主机信息，但未确认当前配对连接/同步就绪前仍遵循
§4.1 等待遮罩，不用旧缓存放行业务，也不能将旧主机信息提升为本机独立终端身份。

静态事实：两个包当前均 `syncIntent=isolated`；topology/state 已有 descriptor、authoritative apply、
方向和 revision 判断能力。同步采用既有机制与 composition 注册，不能再造第二份事实 owner。
当前 server-config 代理密码仍使用 protected persistence，这是与本次明文裁决的实际差量，后续实施需调整。
副机直接使用同步的服务地址/代理发送后台业务 HTTP 请求已获需求裁决；业务 command 的具体 owner 和
API 身份仍按各具名业务定义，本稿不因此把主机终端凭证复制给副机或为 sample 会员事实建立第二个写 owner。

## 6 · component 目录与 base helper 的最小规划建议

**目录只是候选方案，尚未成为开发规范新增目录规则**：保持 surfaceForm 两大类，在 laptop 内
按内容场景划分；共有呈现放 shared。例如：

```text
src/components/
  mobile/                  # MMP
  laptop/
    master-primary/        # LMP
    master-secondary/      # LMS；兼容主机副屏与副机投影承载
    slave-primary/         # LSP
  shared/                  # 确有复用的字段、列表、提示等叶组件
```

component 文件继续遵守 TR-14，单机型文件显式包含 Laptop/Mobile；目录名中的 master/slave 沿用
内容场景意义。partKey/rendererKey 的兼容与收口按真实 catalog 判断，不机械按目录复制整个包。
共享 hook 与 kernel 能力可复用；不能用一个“万能页面”通过角色分支替代独立 LMP/LSP 入口组件。

| 重复开发需求 | 先复用的当前能力 | 本专项可能需要的最小补充 |
| --- | --- | --- |
| 场景 part 注册 | render 的 definePart/definePartPair 与 catalog 资格 | 显式表达四面的一小组注册 helper；不新增第二个 catalog 或持久化场景枚举 |
| tracked command/失败呈现 | render 的 useTrackedCommand、requestId 与现有系统提示 | 仅抽出确有重复且语义相同的调用/结果适配；业务失败文案由 UI owner 定义 |
| 内容位置与主副资格 | display-context、ui-state、topology 的公开 selector/owner evaluator | 不用物理屏数 helper 代替配对资格；不复制角色判定 |
| 输入、滚动、键盘与基础控件 | input、primitives | 新表单按现有输入框架接入，不各自做键盘或测量 |
| admin section 与 surface assembly | admin-shell、integration-assembly | activation 状态页、server-config-panel 配置页经 catalog 扩展；注入具名 owner 能力，不重建入口或 overlay |
| 双机数据投影 | state/topology descriptor 与 peer channel | owner 声明消费字段和命令权限；不增加通用同步框架 |

helper 只覆盖本专项中实际重复的职责；可复用能力的 public export、README、invariant 和测试在后续
实施同步。拒绝为潜在更多 feature 预建插件系统、任意流程引擎或全局仲裁层。

### 6.1 四种虚拟机部署场景的最终验收目标

| 部署场景 | 必须观察的内容 | 关键业务行为 |
| --- | --- | --- |
| mobile 单机 | MMP | 激活→店员登录→两个 sample 各自业务；状态 tab 与取消；输入/错误/重启 |
| laptop 单机单屏 | LMP | 同上；会员在同屏完成顾客确认 |
| laptop 单机双屏 | LMP+LMS | 激活/登录提示，顾客确认和两屏 UI owner/输入隔离 |
| laptop 双机双屏 | 主机 LMP；副机经确认切 LMS/LSP | 主机唯一激活/TDS；同步、配对准入、两个独立录入、同一列表、独立壁纸、断链/重连、切角色与重启 |

四种是**验收拓扑**，不等于必须同时占用恰好四个 VM；双机场景本身需两个真实独立实例。
详设/计划登记实际 VM identity、屏幕承载、供电事件能力和运行资源，不能用单 store Web preview
假冒双机。尚未查询 VM 实时 inventory，本稿不声称这些运行资源已经就绪。

后续动态顺序按 TR-16：不依赖 adapter 的行为先在两个 integration Expo Web 通过，再以同一场景
在 application/VM 验证；真实双屏、设备身份、安全存储、供电和网络 adapter 行为另列。
必须实际观察截图、交互和 owner readback，分别报告业务与 cleanup；focused test 不代替页面或设备。

**本专项新增的真实交付前提**：此前激活批次 R-9.1 明确未接 UI/application、真机不能激活连线。
本次要求在 VM 完成激活，后续需核实/补齐设备身份、安全随机、持久化、HTTP/WS/代理 adapter 及
composition 接线；不能因 Node client 通过就声称 Android 已可用。真实网络状态能力是否仍只不可用，
应按本专项实际场景决定，不能把旧批次的延期当成此次全功能 PASS。本轮没有实现或验证这些前提。

## 7 · 原讨论问题的裁决记录

| 编号 | 原问题 | Dexter 当前裁决 | 实施边界 |
| --- | --- | --- | --- |
| Q-1 | LSP 的店员资格与主机登出影响 | 沿用主机资格；主机登出后退出业务并显示登录提示 | 主机唯一会话写 owner；不传口令，不建立副机独立登录 |
| Q-2 | 已配对副机断链交互 | 任意业务画面统一遮罩「配对连接中，请稍后」，所有业务不可继续；本机 admin 仍可取消配对/切地址 | 不允许断链选择壁纸；不清配对/草稿，不新增离线写入；管理恢复例外必须为本地通道 |
| Q-3 | LMS 背景与 LSP 恢复 | LMS 跟主机；LSP 保存自己的背景，切回恢复 | 主机 confirmed 投影与副机 local confirmed/pending 分开，不同步覆盖副机选择 |

已关闭的讨论项：副机身份/连接与扩展边界（§5.1）、LSP 本页顾客确认（§3.1）、供电确认后切换（规范 §4-E）。
这些不再重复请求裁决。

**前缀+后缀的技术接线仍 OPEN**：集团空间位于配置前缀，激活用户只输 8 位码，generated API 只给后缀。
此前 Q-4 把“生成 URL 所需路径值”和“用户请求体字段”混在一起的提问已撤回，不要求 Dexter 在
独立集团配置/后端跨空间查码之间重作产品裁决。详设需要解决的是 §2.4/§2.5 已核实的消费投影与地址组合差异。

## 8 · 现有来源、差异与本轮证据限制

| 原始/当前材料 | 本专项使用方式 |
| --- | --- |
| `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` §0、R-1.2/R-1.6、R-9～R-11 | 复用激活协议、取消/reset、身份/配置/连接 owner；本专项新增 UI/application 接入，不回写旧批次历史 |
| `doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md` | 复用 pair、peer 可达性与内容 owner、供电确认；新增激活/建连准入，不重建配对框架 |
| `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md` §4 | 保留 sample 会员录入与顾客确认；扩展独立 LSP 录入，不推导正式会员域 |
| `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md` §0/§3 | 原本两屏同背景；本专项仅取代双机 LSP 的背景来源：LMS 继续跟主机，LSP 独立保存/恢复；不回写旧需求历史或泛化为所有屏幕的独立背景 |
| `apps/terminal/ui/integration/sample-console/src/application/module.ts:18–35` | 现仅 startup-ready actor；未实现新的阶段路由 |
| `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:159–204`、`apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:57–78` | 登录/恢复事件现直接导航；新阶段路由需要归位，而非叠加第二套导航 |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts:54–86` | 已有 placement actor，但未按激活优先级判断 |
| `apps/terminal/kernel/base/server-config/src/features/slices/serverConfig.ts:23–40`、`apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts:84–90` | 当前 isolated，没有本专项同步；仍需后续 owner 声明 |
| `apps/terminal/kernel/base/terminal-data-client/src/selectors/selectTerminalDataClientState.ts:16–36`、`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:280–286` | 本机 active 依凭证判断、有凭证启动会自动 connect；不能向副机灌凭证假装投影 |
| `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts:132–191,308–346` | 已有方向/revision/authoritative apply，复用该机制 |
| `apps/terminal/kernel/feature/sample-staff-session/src/features/slices/slice.ts:28–37` | 当前会话 isolated；主机店员资格投影已获裁决，但尚未实现 |

本轮从六维路由 `design/platform/backend/platform/architecture/task-start` 回读 kernel 与匹配记忆。
当前路由词表没有 terminal consumer-face，TER 规则以 all faces 命中；backend 是词表已有路由值，
不把终端误定义为 backend 用户界面。标准唯一内容源、规则指针及 deterministic-only 边界保持。

本轮只进行了源码/文档盘点、术语与记忆登记、记忆导航生成/一致性检查。
没有生成业务 API、修改生产实现、构建、测试、全仓 verify、Expo Web、VM、DEV、reset/seed、L2、UAT 或部署。
两个只读子 agent 分别核对同步/凭证和 sample/admin owner，主 agent 汇总；不把该盘点写成 DESIGN GO。
本稿仍为讨论稿，Q-1～Q-3 已裁决，尚无本专项 Journey、交互/IA 或实施详设批准。

## 9 · Dexter 原话与本轮补充裁决

### 9.1 新专项原始输入（2026-10-02，保留原拼写）

> 接下来我们做一个新的需求，终端激活交互与双机拓扑优化专项。我们先出需求讨论稿，确定需求合理性。
>
> 我们先对终端的界面场景进行定义，你把定义写到项目记忆和开发规范中，后面我们依据此统一措辞。
> 终端类型首先分为laptop和mobile两类机型，laptop，又分为单机单屏，单机双屏，双机双屏情况。
> 之前我们在做TER的component的时候已经按目录分为了laptop和mobile，但laptop没有再去细分。
> mobile情况下，我们把屏幕内容称之为MMP，对应的ui state应该是 master + primary
> 单机单屏，我们把屏幕内容称之为LMP，对应的ui state应该是 master + primary
> 单机双屏，我们把屏幕内容称之为LMP+LMS，对应的ui state应该是 master + primary和 master + secondary
> 双机双屏已配对的情况下，主机屏幕内容是LMP，对应的ui state应该是 master + primary；副机在充电情况下屏幕内容是LMS，对应的ui state应该是 master + secondary；副机在电池供电情况下屏幕内容是LSP，对应的ui state应该是 slave + primary。
> 以上内容你结合代码确认一下。
>
> 我的需求是：
> 一，在terminal/ui/base中建立¥包，专门处理终端激活的交互。
> 内置一个needToActivateTerminalCommand(你可以重命名)。当有外部发起的时候，MMP显示设备激活的mobile页面，LMP显示设备激活的laptop页面，LMS显示页面和文案“请在主屏幕上完成设备激活”，LSP显示页面和文案“请先在主机上完成设备激活”。（如果当前已经是激活态，所有屏幕只显示文案“设备已激活成功”）
> 用户激活的时候调用terminal/kernel/base/terminal-data-client完成激活动作并反馈结果
> terminal-activation需要扩展admin console，增加一个“设备激活状态”的tab页，内容显示激活和连接信息，如果设备已经激活，在内容页中提供取消激活的按钮，点击调用terminal-data-client取消激活。但是不能在内容页中完成激活。
>
> 2，sample-staff-auth包、sample-member-desk包、sample-wallpaper-picker包也要跟terminal-activation类似，内置一个needToLoginStuffCommand、startMemberDeskCommand和startWallpaperPickerCommand(你可以重命名)。每个包同样要完善MMP、LMP、LMS、LSP。
> 在sample-member-desk包、sample-wallpaper-picker包中component调用店员登出的命令。
> sample-member-desk包、sample-wallpaper-picker包中LSP要提供跟LMP类似的页面功能（不要用一个页面做条件判断），但是没有店员登出的命令。
> sample-member-desk包的的LMP和LSP可以共同看到一个member列表，但是可以分别添加member。
> sample-wallpaper-picker包的的LMP和LSP，只选自己页面的背景，互相不干扰。
>
> 3，terminal/ui/integration包需要集成terminal-data-client和terminal-activation。两个sample的terminal/ui/integration包，不光是简单的其他包的集成，还需要起到业务逻辑路由的作用，以下我仅以sample-console举例子。
> sample-console应该一直保持select激活状态和店员登录状态。
> 当终端未激活的时候，调用needToActivateTerminalCommand，由terminal-activation包控制界面提供终端激活交互。
> 当终端已激活但店员未登录的时候，调用needToLoginStuffCommand，由sample-staff-auth包控制界面提供店员登录交互。
> 当终端已激活但店员已登录的时候，调用startMemberDeskCommand，由sample-member-desk包控制业务交互。
>
> 4，server-config包和terminal-data-client包在双机拓扑的情况下，state需要能同步到slave设备上。因为slave设备也需要这个数据。
>
> 5，关于component目录需要重新设计规划。同时必须要考虑更多base包的helper帮助feather包简化重复开发。
>
> 6，最终实施交付，需要在四中类型的设备（均为虚拟机）中完成所有功能的动态验证
>
> 请你对我的需求做仔细分析和理解，并生成需求讨论稿，有问题我们一起讨论

### 9.2 主副机与 TDS 边界（已裁决）

> 副机不能独立连接TDS，不能是激活态，如果一台机器连接了TDS，就不能作为副机

### 9.3 LSP 会员确认与供电切换（已裁决）

> LSP 自己页面完成顾客确认
>
> 沿用确认后切换

### 9.4 配对副机的产品身份（已裁决）

> 副机，配对后，只能作为主机的扩展，本身不作为独立终端

### 9.5 店员资格、断链管理通道与壁纸（已裁决）

> 1，就是这样的。2，是不是应该在integration包中需要有逻辑，如果是副机配对又断开了，不管当前在哪个业务屏幕，都应该在屏幕上有个遮罩或什么的，显示“配对连接中，请稍后”，不允许继续做业务，但是也要能通过左上角唤起admin console，让admin可以取消配对或切换地址。3，就是这样的。        这里面的业务比较复杂，你要明确标记出每个state应该如何设置，每个command应该如何发送，并通过静态代码的分析验证链路的正确性。

上述「1/3」对应 §7 的 Q-1/Q-3。§10 对应最后一句的 state/command 静态分析要求。

### 9.6 服务配置管理包与激活唯一输入（已裁决）

> sorry，还忘了一个重要的，也需要加入到这次的需求中，就是在在terminal/ui/base中建立server-config-panel的包，需要扩展admin console的tab，在里面可以编辑terminal/kernel/base/server-config中的内容。这样在激活的时候就不需要指定集团空间。terminal-activation的激活页面仅仅需要用户输入8位激活码，其他的激活接口需要的内容都不需要用户输入

### 9.7 激活集团空间的 URL 位置纠正

> 这个不对，groupWorkspaceKey应该是激活接口的URL的内容，不是一个单独的request参数。你确认一下

### 9.8 服务 URL 前缀与请求后缀

> server-config是配置server URL前缀的，所以前缀中就要把groupWorkspaceKey配置进去，比如http://127.0.0.1:7890/api/terminal/group-workspaces/mixc，在业务包中生成的API是后面的请求，如/activation。 应该是这样的吧？

### 9.9 激活页显示服务空间名称

> 在激活页面，用户输入8位激活码的时候，页面上应该显示服务空间的名称，这个你也加上，这样用户就知道自己激活的是哪个服务环境了

### 9.10 配对副机同步存储与管理只读

> 还有，副机配对后的server-config和terminal-data-client都是会同步并存储主机的内容。所以副机server-config-panel 在 admin「服务配置」tab，不可编辑。「设备激活状态」如果已经激活也不可取消激活。一切以主机为准

### 9.11 代理密码明文与副机后台请求（已裁决，不再讨论）

> 不对，代理秘密不应该加密，而且应该同步给副机，因为副机后续也会独立向后台发送业务请求。代理秘密完全不需要加密处理，按普通字符串明文即可。按我的裁决，这个不需要再讨论

### 9.12 取消激活命令名称（已裁决）

> “cancelTerminalOnlineCommand”这个名字取的不好，取消激活就用cancelTerminaActivationCommand

### 9.13 package.json 内置服务空间声明

> 还有，server-config的机制也要改一下，像terminalSurfaces一样允许在package.json中定义各个serverSpace，启动或打包的时候作为内置的server-config serverSpaces

### 9.14 业务 command 与 selector 唯一通路

> 明确发业务指令必须都用command，读数据或读状态都用selector，不得发明其他机制

## 10 · state 设置、command 发送与静态链路核验

本节是需求阶段的责任与链路分析，**不是获批详设**。既有字段/command 用当前源码名称；
新增投影、UI 入口与本地管理命令标为「拟新增」，名称可在详设中收敛。
每条链区分已核实的现有机制与尚需接线的能力；静态可行不等于已实现或动态 PASS。

### 10.1 state 归属与设置矩阵

| state/字段 | 写 owner、设置时机与值 | 持久化/同步/副机使用边界 | 当前状态 |
| --- | --- | --- | --- |
| runtime `instanceMode` | runtime 的角色 command 写；配对成功流程设 SLAVE，显式退配按既有流程回 MASTER | 不由 integration 或遮罩直接改；角色变化不授予激活身份 | 既有；须补激活/建连互斥准入 |
| display-context `displayRole` | display-context owner；配对现设 VICE，供电变化先请求确认再设 CHIEF/VICE | 只改变内容地址；不重写凭证、店员资格、壁纸选择 | 既有；确认后切换保留 |
| topology `masterLocator`、`peerIdentity` | topology owner 经身份查询/配对设置；显式退配清理 | locator 本机持久化；瞬时断链不清 locator。TDS 地址不是此 locator | 既有 |
| topology `peerReachable`、`peerConnectionRevision` | accepted 设 true；close/error/unreachable 设 false 并递增连接修订 | reachable 不持久化；true 仅代表 peer 接纳，不代表所需业务投影全部齐备 | 既有 |
| topology `repairPending` | 配对/退配开始设 true；当前配对成功走持久化→runtime reset，并未直接清 false，重建临时 state 后初值 false；退配在 clear locator 后、await flush 前先设 false，catch 才恢复 true | 不能单凭 false 判断操作完成；角色提前变 MASTER 或 flush 未结束时仍禁业务，admin 可恢复 | 既有临时字段且不持久化；必须结合命令未终结状态，integration 准入未接 |
| client 本机 `credential`、`pendingActivations`、`activationStatus` | 仅 terminal-data-client actor 写；成功提交凭证后 active，取消开始 cancelling，清凭证后 inactive | 凭证 protected 本机持久化；副机不保存自己的凭证、不从主机投影生成 credential | 既有；须补 SLAVE 互斥与 UI 接线 |
| client 本机 `connection`、RTT、ping 状态 | 仅 client/transport 现有 owner 写，SESSION_READY 后 connected；TDS 失败沿原重连策略 | 心跳、seq、deadline、socket、秘密不下行复制；副机本机保持 stopped/inactive | 既有 |
| client `masterActivation/Connection/Latency` 摘要（拟新增投影） | 主机 client 从公共 selector 生成主机状态；副机只能 authoritative apply，并存储主机信息 | 单向主→副；不变成本机凭证/激活事实。缓存缺失/断链不能放行业务；副机状态 tab 只读、不可取消 | 未实现 |
| package `serverSpaces` 内置声明（拟新增） | 启动/打包入口读取自己的 package.json，经共享解析校验与 composition 注入 config owner defaults | 应用内置只读；不是每次启动覆盖用户 state 的命令。配对副机以主机同步配置为准，不拿不同本机 defaults 重算主机地址 | terminalSurfaces 接线可复用；serverSpaces 读取/注入未实现 |
| server-config `selectedSpace`、`overrides`、`proxyPasswords` 及实际生效配置 | 主机 config 公共 command/actor 写；副机 authoritative apply 并存储主机配置；composition provider 注入本机 transport adapter | 地址/代理含明文密码主→副同步并明文持久化；副机可独立业务 HTTP，配置 tab 不可编辑/反向写，仍禁止副机 TDS | 既有 isolated；密码 protected 与本次裁决不符，同步/存储未接线 |
| server-config-panel 服务草稿与提交状态（拟新增 UI） | 主机/未配对本机 panel actor 管配置草稿及提交，config command 唯一写配置；配对副机仅展示主机内容 | 草稿不作为配置事实广播；已保存代理密码为普通字符串进入 state/persist/sync。副机无编辑/保存/恢复或 peer 改配置入口 | panel 不存在；须接 selector、具名 capability 与 flush/readback |
| staff `status`、`operatorName` | 主机 login actor 设 authenticated，logout actor 设 anonymous，再发结果 command；副机消费主机投影 | 主机持久化；不传口令。副机旧本地 authenticated 不能作为准入，副机不自行 login/logout | 当前 isolated；须补安全同步/注册与主机准入 |
| member `members` | 主机 registry owner 唯一追加；confirm 精确 pending 成功后两端读同一列表 | 沿既有主→副同步；副机不把本地列表写回覆盖主机 | 既有列表；LSP owner 路由未接 |
| member `pendingByOrigin`（拟替换 single pending） | 主机 registry 维护主端/当前配对副端两个有界槽；submit 设置 origin+submissionId+资料，confirm/reject/withdraw 只改精确槽 | pending 本来不持久化；不建离线队列。确认资料按消费所需投影；不能把另一端 pending 导航成本端表单 | 当前仅一个 pending，有真实并发覆盖缺口 |
| member UI 草稿、dirty、页面/确认层 | 主机 MAIN UI actor 管主端；副机 BRANCH UI actor 管 LSP；顾客确认对应精确 submissionId | 未提交的输入草稿不随共享成员列表广播；断链保留但禁止继续编辑/确认 | 有既有草稿能力；两端隔离及身份需补 |
| wallpaper 本机 `wallpaperId`、`pendingWallpaperId` | 各端本机 wallpaper owner 经 select/confirm 写；主机写自己的值，副机只写 LSP 自己的值 | 本机持久化/isolated。供电确认切角色不清原值。断链后禁止业务选择/确认 | 既有字段与 local 链；LSP 页面/准入未补 |
| wallpaper `masterConfirmedWallpaper`（拟新增只读投影） | 主机只投影已确认 wallpaperId；副机 authoritative apply，不把它写成本机 wallpaperId | LMS 读主机 confirmed，LSP 读副机 local confirmed；主机 pending 不传播为已确认背景 | 未实现；当前背景只读本机 selector |
| UI screen/layer placement | UI 包收到阶段入口后，由本机合法 workspace 的 ui-state actor 写；主机写 MAIN，副机写 BRANCH | 主机 MAIN/SECONDARY 下行到 LMS；LSP 本地 BRANCH/PRIMARY。不把 LSP showScreen 命令远送主机 | 既有 owner 规则；四面入口/parts 尚需扩展 |
| integration 业务阶段/遮罩（派生值） | 订阅 runtime 初始化、topology 与本机或主机投影 facts；按 §10.2 纯派生 | 不新增持久化 currentBusinessStage、不把遮罩当配对事实；重复同阶段不重置表单 | 未实现 |
| 所需投影的本连接应用状态（拟补最小 runtime 标记） | 在当前 accepted peer 的 authoritative apply 完成时记录对应接收情况；断链/新连接/退配后旧标记失效 | 复用连接身份/既有 revision，不另建 ACK 协议；只检查当前业务所需的有限投影，不能凭旧缓存放行 | 有 apply/revision 机制，尚无暴露给 integration 的完整准入 |
| 本地 admin 开关、认证、选中 section、操作反馈 | admin-shell 拥有本机 ephemeral UI state；local open/close/login，不写主机 MAIN 业务 placement | 不持久化认证、不与主机同步；与业务遮罩分层，管理员认证键盘仍可用 | 既有 admin 认证/section；LMS 本地控制面缺失 |
| admin 配对/退配/换地址运行状态（拟接入最小 UI 操作状态） | 本地 admin 在调用前设 running；单独 unpair 等完整结果，换地址串行 unpair→readback→pairByHost；结束按真实结果/事实设成功或失败 | 复用 tracked command/capability 的生命周期，仅当前操作，不持久化、不建框架；覆盖 repairPending 提前 false 与中间 MASTER/locator 已清窗口 | 既有 command result；integration 尚未接入该准入，paired 换地址入口未建 |

### 10.2 路由与遮罩的判定顺序

1. runtime hydrate/initialize 或配对/退配/换地址流程未完成：阻断业务，保留可用的本地 admin 恢复面；
   不把初始 selector 缺失解释成未激活。`repairPending` 的失败也属于未完成。
   单独取消配对也必须看本地管理命令是否已终结并成功 readback，不能只看 repairPending；
   现有 actor 会在 await flush 前先清此字段。命令 running 时优先禁止普通业务阶段导航。
2. 已配对 SLAVE 且 `peerReachable=false`：显示「配对连接中，请稍后」；不修改业务事实，不清草稿。
3. 已配对 SLAVE 已 accepted，但本连接所需主机投影尚未应用：继续等待，不因旧 authenticated 缓存放行。
4. 副机取**当前主机**激活/店员摘要；主机取**本机 owner** selector。inactive→激活交互/提示，
   active+anonymous→店员交互/提示，active+authenticated→对应业务；activating/cancelling 保持本阶段处理态。
5. TDS 暂时断连不等于未激活；本需求没有新增“主机只要 TDS 不在线就退出所有 sample 业务”的规则。
6. 每次恢复按最新事实重判；更新 RTT、成员列表或壁纸投影不应重复发送同阶段入口重置表单。
   角色/内容地址变化则更新对应四面 placement；真正退出阶段时按现有脏表单/登出约定处理。

严格区分“业务不可操作”与“管理不可操作”。遮罩不能通过 alert layer 压住 admin，不能全局禁用
RenderProvider dispatch，也不能把 AdminLauncher 手势祖先一起设为不可交互。
业务输入 scope 暂停并避免残留焦点继续派命令，admin scope 保持；返回业务时先复核准入。
UI 阻挡以外，相关业务 actor 在执行与异步提交前再次读当前事实，主机 registry 还须复核自己当前
激活/店员资格和当前配对发起者。先到主机且已经成功提交的会员事实不能因随后断链回滚或谎称未发生；
恢复后依据精确提交身份/权威列表回读，不盲重发为第二条会员。

### 10.3 command 发送矩阵

| 触发 | 发送方 → command → 执行方/目标 | 设置与结束依据 | 现有能力/待补 |
| --- | --- | --- | --- |
| hydrate 完成或准入事实变化 | integration 订阅 bridge → 自己的具名重判 command/actor（拟新增，local）→ 四个 UI 入口 | 重判派生状态；只在阶段或内容地址变化时发送入口 | 复用 TR-11/现有订阅；集中阶段路由尚未实现 |
| 需要激活交互 | integration/外部 → `needToActivateTerminalCommand`（拟新增）→ terminal-activation UI actor | MAIN 的主/副屏由主机 placement；BRANCH 的 LSP 由本机 placement；副机不执行后台 activate | 新 UI 包/入口未实现 |
| 主屏激活提交 | MMP/LMP **仅8位码** → UI/integration 自动补 operationId/机型/版本 → client `activateTerminalCommand`（local，去掉单独集团路径输入）→ transport 合成配置前缀 + generated `/activation` | client 自动读设备/生成秘密；集团只在前缀，不进 body；成功响应自动提交凭证身份；integration 等 owner selector | client command 既有；payload/pending/凭证来源及前缀后缀生成/通信待适配 |
| 主机 admin 取消激活 | activation status section → 公开 `cancelTerminaActivationCommand` 派发（local，目标名称）→ client actor | 先 cancelling，失败可见；成功及清理由 owner selector readback；副机无此动作 | 当前源码旧名待统一重命名；普通 section boundary 不可用，须接公开 command，不新增业务 capability 方法 |
| 店员登录交互/提交 | integration → `needToLoginStaffCommand`（拟新增）；MMP/LMP → 现有 `loginCommand`（local）→ 主机 staff actor | authenticated 由 staff owner 设置；副机只看到主机结果投影/提示 | 现有 login 链；新入口/集中路由/投影待补 |
| 主机店员登出 | MMP/LMP 工作台 → `logoutCommand`（local）→ staff actor | anonymous 生效后两端退出业务；LSP 页面无 logout；脏会员流程沿既有放弃/登出命令 | member 原链可复用；wallpaper 登出与副机投影待补 |
| 进入会员/壁纸业务 | integration → `startMemberDeskCommand` / `startWallpaperPickerCommand`（拟新增）→ 各 UI owner actor | 只管理本阶段 UI；禁止旧 login-restored listener 自行越过阶段导航 | 新入口与旧导航归位待补 |
| LMP 录入会员 | MAIN 表单 UI command → 主机 `submitMemberCommand`（local，补 origin/submissionId） | 主机写主端槽；LMS 顾客核对该槽与 identity | 原 submit 路径已有，single pending 需替换 |
| LMS 顾客确认/拒绝 | 顾客 UI command → 具名 `confirmMemberCommand`/`rejectMemberCommand` → 主机 registry | 单机 local；已配对副机 SECONDARY 复用 peer-intent。断链不派业务 command | 现有 route 可复用；精确槽/身份和准入待补 |
| LSP 录入/本页确认/拒绝/撤回 | LSP 本地 UI command → BRANCH UI actor → 主机具名 registry command，显式 `{target:'peer'}` | UI 本地、共享事实在主机；携带精确提交身份，只改副端槽；结果/status 与主机权威投影共同反馈 | runtime 支持 peer；PRIMARY peer-intent 不会自动到主机，待接 |
| 两端选择/确认壁纸 | 各自 picker UI command → 本地 UI actor → `selectWallpaperCommand` / `confirmWallpaperCommand`（local） | 只改自己 confirmed/pending；主机 confirmed 再向 LMS 投影；配对断链时两端中副机的本地业务也拒绝 | local 链已有；LSP part、来源切换与投影待补 |
| 供电变化/用户确认 | power owner → `requestPowerRoleChangeCommand` → 用户 `confirmPowerRoleChangeCommand` 或 `cancelPowerRoleChangeCommand` → display-context owner | 未确认保持原角色；确认后重新选择 LMS/LSP 内容/背景，不自动激活、不清副机背景 | 沿用现有确认链；属于本地系统角色控制，须与业务遮罩隔离 |
| peer close/accept/state apply | transport/topology → `topologyHostEventCommand`/authoritative apply → topology/sync owner | reachable/revision/apply 状态变化后 integration 重判；不为遮罩自己造重连 timer | 现有重连/状态 apply；业务同步准入桥待补 |
| 左上角打开/关闭 admin | AdminLauncher → 本地 admin 具名 open/close（拟补 LMS 控制面）→ 本机 admin owner | 不发 peer、不改 MAIN 业务 UI；关闭后业务遮罩仍按 facts 存在 | LSP 有 local 路径，LMS open/close 当前依赖 peer，需补 |
| admin 取消配对 | 本机已认证 admin → 公开 `unpairTopologyCommand`（local）→ topology actor | repairPending→CHIEF→MASTER→clear locator→flush/close；失败保留恢复状态；成功经 topology selector readback 后重判 | 当前 capability 是 command 适配；本专项统一公开 command 派发，LMS 必须先解决 admin 承载 |
| admin 切换配对主机地址 | 本机 admin 输入新 host → local 操作串行 `unpair()`→成功 readback→`pairByHost({host})` | 过程中始终禁止业务；退配失败不继续配对；新配对失败如实展示当前未配对/修复事实，不恢复旧投影 | **建议最小方案**：复用既有命令，不新增通用地址切换协议；当前没有此入口 |
| 修改后台服务地址 | 主机/未配对本机 admin 的 config section → config 公开 `selectServerConfigSpaceCommand`/`setServerOverrideCommand` 等（local）→ provider/transport，再主→副同步存储 | 与 topology host 输入分开；配对副机配置 tab 只读，不发本地或 peer 修改配置 command | 原 command 已有，UI capability/同步存储需接 |
| 配置页保存/恢复 | 主机/未配对本机 server-config-panel submit UI actor（local）→ `setServerOverrideCommand {serverName,addresses,proxy}` / `clearServerOverrideCommand {serverName}` / `restoreServerDefaultsCommand {}` → config owner，再收取现有 flush 结果、回读 selector | 已保存代理密码普通字符串明文存储/同步；持久化失败如实反馈，不谎称回滚或保存成功；配对副机不执行该链 | owner command/flush 能力已有，panel actor/capability及密码明文存储适配未建 |

上述“切换地址”在配对断链恢复页优先指**配对主机 host**，属于 topology；后台 HTTP/TDS 地址属于
server-config，必须另标字段和 owner，不能让一个输入框或 command 同时改两者。
已有 paired 状态下 `pairByHost` 拒绝直接再配，故不能虚构当前已存在原位更新 locator command。
显式退配终态沿旧需求为 MASTER+CHIEF+locator 清空；这不等于设备已激活。断链本身不会退配/升主。

### 10.4 当前源码链路的静态验证结果

| 编号 | 仓根相对路径与精确行号 | 已核实事实与判定 |
| --- | --- | --- |
| SC-01 | `apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts:38–49`；`apps/terminal/kernel/base/topology/src/features/actors/actors.ts:695–708` | paired 与 reachable 独立；断链只置不可达并递增修订。**现有机制可复用**，不会凭断链自动升主 |
| SC-02 | `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx:210–218`；`apps/terminal/ui/base/admin-shell/src/components/AdminLayerFrame.tsx:49–53,94–99`；`apps/terminal/kernel/base/topology/src/foundations/resolveCommandTarget.ts:24–30` | LMS 的 open/close 都走 peer-intent，断链不能依赖此链。**现有缺口** |
| SC-03 | `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:144–159`；`apps/terminal/kernel/base/ui-state/src/selectors/selectContent.ts:23–43` | SLAVE+VICE 当前内容是 MAIN，local 写 MAIN 拒绝；故仅改 target 不正确。**需本地 admin 独立控制面，不能放宽业务写权** |
| SC-04 | `apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx:770–795`；`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:14–27`；`apps/terminal/ui/base/render/src/components/LayerStack.tsx:57–82,194–228` | 当前 content 含 screen+全部 layer；alert 在 standard 之上。把遮罩作为最上层 alert 或全局 wrapper 会挡 admin。**承载/输入隔离待实现** |
| SC-05 | `apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts:122–163`；`apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts:26–44` | 具名 capability 调本地 topology；unpair 不要求 peer 可达，paired 再 pair 拒绝。**退配机制可复用，换地址 UI 需编排** |
| SC-06 | `apps/terminal/kernel/base/topology/src/features/actors/actors.ts:578–679`；`doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md:443,548` | 退配先 CHIEF/MASTER，再 clear locator/repairPending=false，随后 await flush；失败 repairPending=true。**角色或该字段都不能独自证明终结；须接入命令运行/结果与 readback** |
| SC-07 | `apps/terminal/kernel/base/runtime/src/types/command.ts:75–92`；`apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:528–537`；`apps/terminal/ui/base/render/src/hooks/useTrackedCommand.ts:16–22,47–53` | runtime 显式 target 优先且 actor 可用 peer；UI hook 目前只提供 routeIntent。**LSP 本地 actor 转发具名 kernel command 可复用，不需全 UI 任意远端路由** |
| SC-08 | `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:49–59,116–121,158–165,193–205` | peer 不可达拒绝；远端 local/null route 执行；回包只保留 status。**不能远送 LSP UI placement，也不能假设错误详细内容自动回传**；失败与回读方案待详设 |
| SC-09 | `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts:149–189,280–349` | 声明方向、revision、authoritative apply 真实存在，但 accepted 不代表所有所需 slice 已应用。**复用同步，补当前连接所需投影就绪暴露** |
| SC-10 | `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:105–125`；`apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:95–109`；`apps/terminal/ui/base/integration-assembly/src/foundations/stateSyncSlices.ts:11–16` | 仅声明并不自动注册；console 当前注册 ui-state/member，wallpaper 只 ui-state。**两个 composition 必须登记安全 client/config/staff/wallpaper 投影** |
| SC-11 | `apps/terminal/kernel/feature/sample-staff-session/src/features/actors/actors.ts:64–85`；`apps/terminal/kernel/feature/sample-staff-session/src/features/slices/slice.ts:8–36` | login/logout owner 写 status 后通知；当前 isolated。**原主机命令可复用，副机投影未实现** |
| SC-12 | `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:9–55`；`apps/terminal/kernel/feature/sample-member-registry/src/features/actors/actors.ts:37–78`；`apps/terminal/kernel/feature/sample-member-registry/src/features/commands/commands.ts:7–24` | single pending 与命令均无 origin/identity，第二次 submit 覆盖第一次。**两槽及精确身份是当前并发需求必需，不是未来预设计** |
| SC-13 | `apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts:8–43`；`apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:71–97`；`apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperBackground.tsx:8–19`；`apps/terminal/ui/feature/sample-wallpaper-picker/src/parts/parts.ts:8–22` | 本机选择链存在，但背景只读本机且 picker 仅 MAIN/PRIMARY/MASTER。**LSP 独立 part/主机背景投影未实现** |
| SC-14 | `apps/terminal/ui/base/admin-shell/src/foundations/adminSectionSelection.ts:96–104`；`apps/terminal/ui/base/admin-shell/src/hooks/useAdminSectionBinding.ts:43–59` | 默认 section boundary 拒绝 dispatch，当前专门 capability 仅 topology section。**activation/config 页需具名能力注入，不能直接假设 section 任意 command 可用** |
| SC-15 | `apps/terminal/kernel/base/server-config/src/selectors/selectServerConfiguration.ts:30–41,50–60,70–79`；`apps/terminal/kernel/base/server-config/src/features/actors/serverConfigActor.ts:68–97,212–274` | override 按服务跨环境共享；keep 只保留 override 密码；配置 command 同步返回。**panel 必须忠实此编辑范围，保存持久化结果另行接线** |
| SC-16 | `contracts/openapi/paths/terminal/activation.paths.json:3,34–44`；`contracts/openapi-source/terminal-binding.schemas.json:7–13`；`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:155–184,339–349`；`apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts:195,371–378` | 集团空间是 URL 路径内容，不是 body；当前 adapter 使用 generated 根相对 path，不能把 full baseUrl 当成已自动供给集团上下文。**自动地址链尚需详设/实施** |
| SC-17 | `scripts/generate/terminal-client-api.mjs:79–105,189–192,297–315`；`contracts/policy/terminal-client-generation.json`；`apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts:33–34,63,76`；`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:352–362` | 当前生成器核验 canonical/catalog 完整 route，再全量输出 path 参数；credential 集团取 pending 而非响应。**后缀投影、typed 参数及响应身份接收需要同步适配；不手改 generated 或削弱完整契约校验** |
| SC-18 | `apps/terminal/kernel/base/server-config/src/features/slices/serverConfig.ts:23–40`；`apps/terminal/kernel/base/server-config/src/selectors/selectServerConfiguration.ts:30–60` | 当前代理密码 protected 持久化、配置 isolated；网络 snapshot 已提供实际生效代理含密码。**按裁决改为明文存储及主→副同步存储，副机 adapter 消费实际配置；管理只读不等于网络 snapshot 无密码** |
| SC-19 | `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts:1,35–38`；`apps/terminal/application/android/sample-terminal/src/assembly/platformPorts.ts:1,10–17`；`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:60–65,88`；`apps/terminal/kernel/base/server-config/src/application/createServerConfigModule.ts:16–20`；`apps/terminal/kernel/base/server-config/src/foundations/validateServerConfigDefaults.ts:66–77` | terminalSurfaces 已有 package 读取及 application 显式传入优先路径，config owner 已支持注入/校验 defaults；**复用同类接线新增 serverSpaces，不复制空间事实/解析器，不以启动内置默认覆盖合法保存配置** |

静态盘点结论：现有 owner、command dispatcher、peer channel、同步与确认机制可以支撑最小方案；
**新增业务完整链路尚未闭合**，上表缺口必须进入后续统一详设，不能用文档表格代替源码实现。
本轮两个只读盘点者分别检查遮罩/admin 与 sample/shared-owner，主 agent 回读源码裁决；
其中“退配后仍 SLAVE”的推论已按 SC-06 原需求与源码拒绝，保留原显式退配终态，不继承盘点者说法。

### 10.5 后续必须证明的有限反例（当前全部 NOT_RUN）

- LMS/LSP 分别在每个业务页面及业务确认弹层断链：文案正确，触摸/鼠标/键盘/已聚焦输入不再派业务命令；
  遮罩上左上角仍能打开本机 admin，认证键盘、退配、换地址、关闭可用。
- 两端并发录入且响应倒序：两个 pending 不覆盖；旧确认/撤回不能处理新 identity；已提交但回包丢失不增第二条。
- 主机登出或取消激活发生在副机断链期间：重连后先应用当前投影，再显示正确登录/激活提示，不闪回旧业务。
- peer accepted 先到而主机状态晚到；旧连接投影迟到；换地址/退配中提前切 MASTER；
  repairPending 已 false 但 flush 尚未结束或失败：均不能提前放行业务。
- 两端选不同背景，副机确认 LMS↔LSP 切换：LMS 读主机 confirmed，LSP 恢复副机 confirmed；断链禁止副机继续选。
- 已激活/连接中/正在激活的设备尝试配对或异步切 SLAVE：owner 最终提交处拒绝冲突，不偷清凭证。
- 配置页切环境后覆盖仍按现有作用域生效；默认密码不能被“keep”复制；持久化失败如实显示已生效/未保存状态。
- 激活表单只有8位码；配置前缀 mixc + 后缀 /activation 得到预期完整 URL，末尾斜杠不重复/覆盖集团路径；
- MMP/LMP 激活页显示当前服务空间名称；配置变化后显示与实际激活目标一致，不将集团空间路径编码当作环境名称；
- 主机代理密码以普通字符串明文存储，同步并存储至配对副机；副机后台业务 HTTP adapter 使用同步的实际生效地址/代理（包括默认代理），而不独立连接 TDS。
- 配对副机两个管理 tab 只读；主机已激活时副机无取消入口；无本地/peer 修改配置或取消主机激活路径，重启/断链缓存不放行业务。
- Web integration 与 application 启动/打包使用各自入口选定的 package serverSpaces；保存的合法配置重启不被默认值覆盖，恢复默认回本应用内置声明；主副声明不同时副机仍使用主机同步的地址/代理。
- 逐条核对业务触发落到公开 command、业务数据/状态读取落到公开 selector；helper/admin/provider 不形成另一套写/读入口，副机后台请求也不由 component 直接发起。
  body只有既有五字段，取消后缀保留terminalRef，成功凭证身份自动取响应；多地址切换不漂移集团路径。

该清单用于防止同根再犯：**内容地址不等于设备控制面；可达不等于最新业务准入；UI 隐藏不等于命令拒绝；
command 完成不等于所需投影已到；角色中间值不等于操作终态。** 最小复用解为明确 owner、当前连接投影、
具名 local/peer command 与最终 readback；不新增全局仲裁、持久队列、重连框架或通用路由引擎。
配置页补充同根检查：URL 路径元数据不等于 body 字段或用户输入；配置里有一个 URL，不证明其路径
已经被实际消费。审查必须沿配置前缀、generated 后缀、adapter 最终请求三处回读，SC-16 的
space-A/space-B 反例由后续既有 URL/adapter focused 测试承接；本轮仅文档静态分析，未运行该反例。

## 11 · 下一步与授权边界

原三个产品问题与配置页/激活唯一输入已按本轮裁决记录。下一步形成正式需求与 Journey，明确四面交互/IA，
并在统一详设中闭合配置前缀+generated 后缀、client 参数/凭证适配、panel 持久化反馈等当前缺口，再完成实施计划。
不得把本讨论稿的 state/command 建议、静态可行性、历史批次授权或未来验收目标当成当前实施授权。
术语、扩展身份与断链管理原则已落规范；本专项生产源码未改，未运行构建/测试/verify/Web/VM/DEV/reset/seed。
