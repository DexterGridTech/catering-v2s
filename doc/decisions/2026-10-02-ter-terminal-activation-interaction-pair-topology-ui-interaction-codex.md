---
title: 终端激活交互与双机拓扑优化 · 低保真交互提案
status: ACCEPTED_DIRECTION_LOW_FIDELITY_DESIGN
---

# 交互工件：终端激活交互与双机拓扑优化

```text
JOURNEY_DECISION=doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md#TERMINAL_ACTIVATION_INTERACTION_PAIR_TOPOLOGY
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md#R-03
BUSINESS_PROBLEM=终端无法仅凭当前入口安全地激活、进入 sample 业务并在双机断链时恢复；用户需要在正确内容面上完成自己的业务操作。
BUSINESS_USER_OR_OWNER=店员、终端本地管理员、顾客
CURRENT_TASK=激活终端、进入两种 sample 业务、在主副屏和主副机上正确完成交互，并在断链时保持业务阻断与本地恢复入口。
SUCCESS_OUTCOME=激活与配置结果由 owner selector 读回；每一内容面显示其规定的交互；无权限的副机状态不能启动、修改或继续业务。
UI_BEARING=true
SKILL_USED=cs-spec-to-plan@1e909f3a92fb4ecff9b4eafb360129bdbf4dad5900a49443b0ece0bc434cda9c
DEXTER_WIREFRAME_REVIEW=ACCEPTED
WIREFRAME_ACCEPTANCE_SCOPE=整体交互方向（四面激活/登录、admin、断链本地恢复、LSP独立会员/壁纸、LMS主机投影）；R2已review修订前字节；S-1～S-6/N-1已按主agent intake修订，当前完整设计包待Dexter/Claude独立静态复评；运行细节未验证
PACKAGE_OWNERSHIP=terminal-activation与server-config-panel按正式需求R-03位于apps/terminal/ui/base，是跨两个integration复用的UI呈现包；它们调用现有owner command/selector，不拥有业务事实。三个sample包仍位于apps/terminal/ui/feature。
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（本地 TER 终端用户界面；不是 platform-admin 或 operations-admin 登录会话）
```

> Dexter 已于 2026-10-02 接受整体交互方向。本文保留逐屏低保真设计供详设与独立设计 review 对账；它不是高保真稿或运行证据。

## 1. Interaction map

| 次序 | 前提 | screen | 用户目标 | 可见信息/操作 | owner readback | 成功/失败去向 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | hydration 完成；主机资格已读 | ACT-01～04 | 激活或了解如何在主机激活 | 未激活主面显示8位码、副面显示引导；显式调用且已激活时四面显示“设备已激活成功” | activation/config selectors | 不加继续按钮或计时；integration随后按当前owner selector交给业务包路由；断链遮罩优先；拒绝保留输入与原因 |
| 2 | 已激活，店员未登录 | AUTH-01～04 | 登录或知道应在哪登录 | 主面登录；副面说明 | staff session selector | 登录后进入对应 sample；失败留在当前面 |
| 3 | 业务资格与副机同步 ready | SAMPLE-01～10 | 完成会员/壁纸任务 | 依终端内容面呈现 | member/staff/wallpaper selectors | 每次确认只影响本次操作与本端壁纸 |
| 4 | 本地管理员打开 admin | ADMIN-01～04 | 看状态、配置或恢复双机 | 登录后本地 tab | client/config/topology selectors | command 完成且 selector readback 后反馈 |
| 5 | 副机业务未 ready | MASK-01 | 防止误做业务并恢复配对 | 全业务遮罩；admin 可用 | topology + projection selectors | 只在当前连接及所需投影 ready 后解除 |

## 1.1 UI 详设强制标准（逐屏声明索引）

本节是 `doc/decisions/templates/ui-interaction-design-template.md` §1.1 的标准落点。每个屏幕和独立交互面均在对应的 `### Screen` 块逐项声明：`CONSUMER_FACE`、`APPLICATION_AFFILIATION`、`UI_SURFACE`、`HOST_AND_ENTRY`、`ACTOR`、`BUSINESS_SCENARIO`、`BUSINESS_GOAL`、`USER_VISIBLE_COPY`、`TECHNICAL_BOUNDARY`、`FOUNDATION_PRIMITIVE`、`CONTAINER_LAYOUT`。可见元素与文案位置由 §4.1 逐行核对，控件及 testId 全集见 §4。

本工件是独立 TER public UI，不是 React 后台。每个 screen 的 `FOUNDATION_PRIMITIVE` 记录 TER 实际 `@catering-v2s/ui-base-*` export；不适用时须逐屏说明 `NONE_WITH_REASON`。不使用 `@catering-v2s/admin-ui-foundation`，因其面向后台 React UI，与 `apps/terminal` 的 React Native surface 不同；依据 `doc/platform/terminal-coding-standard.md` §4-D、§4-E 及当前 `apps/terminal/ui/base` 包结构。该说明不豁免实施时核对精确 export 与消费者。

| screen id | 单一 screen 声明锚点 | 强制字段声明 | Surface roster |
| --- | --- | --- | --- |
| ACT-01-MMP | `### Screen: ACT-01-MMP` | 完整 | §4.1 |
| ACT-02-LMP | `### Screen: ACT-02-LMP` | 完整 | §4.1 |
| ACT-03-LMS | `### Screen: ACT-03-LMS` | 完整 | §4.1 |
| ACT-04-LSP | `### Screen: ACT-04-LSP` | 完整 | §4.1 |
| ADMIN-SHELL | `### Screen: ADMIN-SHELL` | 完整 | §4.1 |
| ADMIN-01 | `### Screen: ADMIN-01` | 完整 | §4.1 |
| ADMIN-02 | `### Screen: ADMIN-02` | 完整 | §4.1 |
| ADMIN-03 | `### Screen: ADMIN-03` | 完整 | §4.1 |
| ADMIN-04 | `### Screen: ADMIN-04` | 完整 | §4.1 |
| ADMIN-00 | `### Screen: ADMIN-00` | 完整 | §4.1 |
| ADMIN-AUTH | `### Screen: ADMIN-AUTH` | 完整 | §4.1 |
| AUTH-01-MMP | `### Screen: AUTH-01-MMP` | 完整 | §4.1 |
| AUTH-02-LMP | `### Screen: AUTH-02-LMP` | 完整 | §4.1 |
| AUTH-03-LMS | `### Screen: AUTH-03-LMS` | 完整 | §4.1 |
| AUTH-04-LSP | `### Screen: AUTH-04-LSP` | 完整 | §4.1 |
| SAMPLE-01-MMP | `### Screen: SAMPLE-01-MMP` | 完整 | §4.1 |
| SAMPLE-02-LMP | `### Screen: SAMPLE-02-LMP` | 完整 | §4.1 |
| SAMPLE-03-LSP | `### Screen: SAMPLE-03-LSP` | 完整 | §4.1 |
| SAMPLE-04-MMP | `### Screen: SAMPLE-04-MMP` | 完整 | §4.1 |
| SAMPLE-05-LMP | `### Screen: SAMPLE-05-LMP` | 完整 | §4.1 |
| SAMPLE-06-LMS | `### Screen: SAMPLE-06-LMS` | 完整 | §4.1 |
| SAMPLE-07-MMP | `### Screen: SAMPLE-07-MMP` | 完整 | §4.1 |
| SAMPLE-08-LMP | `### Screen: SAMPLE-08-LMP` | 完整 | §4.1 |
| SAMPLE-09-LMS | `### Screen: SAMPLE-09-LMS` | 完整 | §4.1 |
| SAMPLE-10-LSP | `### Screen: SAMPLE-10-LSP` | 完整 | §4.1 |
| MASK-01 | `### Screen: MASK-01` | 完整 | §4.1 |

`SCREEN_DENOMINATOR=26`。索引覆盖本工件全部 26 个 `### Screen`；各 screen 块仍是强制字段具体值的唯一住址，本表不代替逐屏声明。

## 1.2 管理后台交互一致性引用

本工件没有 `platform-admin` 或 `operations-admin` screen。26 个 screen 的 `CONSUMER_FACE=public`、`APPLICATION_AFFILIATION=独立 public 能力`；“本机 admin”是 TER 本地管理面，不属于任一后台 app。因此模板要求的逐后台 screen §3-K 表为 `NOT_APPLICABLE_WITH_REASON`，不伪造后台 screen，也不把 `doc/platform/frontend-coding-standard.md` §3-K 的后台控件形态套用于 TER。TER 本机 admin 的输入、手势、焦点、承载与 MAIN/BRANCH 边界按 `doc/platform/terminal-coding-standard.md` TR-16、TR-17、§4-D、§4-E 处理，逐屏观察见 screen 块与 §4.1。

| screen id | 管理后台 surface / 容器 | §3-K 适用范围 | 已接受的后台承载例外 | 可执行观察 |
| --- | --- | --- | --- | --- |
| N/A（26 个 screen 均非 `platform-admin` / `operations-admin`） | N/A | `NOT_APPLICABLE_WITH_REASON`：独立 TER public runtime | 无；不是后台形态例外 | 查看 26 个 screen 的 `CONSUMER_FACE` 和 `APPLICATION_AFFILIATION`；TER 控件、surface 与焦点观察见 §4.1，当前不要求 L2 或运行证据 |

## 2. 逐屏低保真草图

每个屏幕以 `screen-id` 独立登记。`CONSUMER_FACE=public` 指本机无后台会话的终端面，不代表新增公共 HTTP operation。
TER 的共享基础组件不属于 `libraries/frontend/admin-ui-foundation`（React Web 后台 foundation）；下列组件复用均指仓内 `@catering-v2s/ui-base-*` 精确终端 API。

### Screen: ACT-01-MMP

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端独立业务页
HOST_AND_ENTRY=integration在主机未激活时派needToActivateTerminalCommand；显式调用且已激活时显示成功状态后按最新阶段交给业务包路由
ACTOR=店员
BUSINESS_SCENARIO=店员首次在移动终端进入 sample
BUSINESS_GOAL=未激活时提交唯一8位码；显式调用且已激活时确认成功状态并由integration按当前阶段路由
USER_VISIBLE_COPY=设备激活；服务空间：<当前生效名称>；激活码；激活；激活失败原因；设备已激活成功
TECHNICAL_BOUNDARY=设备/版本、operationId、集团空间URL段与credentialSecret不显示、不输入；已激活时显式UI command展示成功文案后由integration按selector路由，不增加返回控件/计时；断链遮罩优先
ACTIVE_SUCCESS_STATE=“设备已激活成功”；无按钮、无计时；路由由integration按当前selector交给业务包
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveStatus
CONTAINER_LAYOUT=mobile PRIMARY 360×640（入口 package terminalSurfaces）；标题与服务空间固定在滚动表单上方，唯一滚动区为激活输入区，底部提交按钮不出视口；全宽单列。
```

```text
┌────────────────────────┐
│ 设备激活               │
│ 服务空间：<当前服务空间名称>     │
│                        │
│ 激活码                 │
│ [ _ _ _ _ _ _ _ _ ]    │
│ 输入面板 / 数字键盘     │
│ [激活]                 │
│                        │
│ [校验/提交失败原因]     │
└────────────────────────┘
```

<!-- SCREEN-CLOSURE:ACT-01-MMP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 填写激活码 | terminal.activation.code | 真实数字输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 提交激活 | terminal.activation.submit | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 显示激活结果 | terminal.activation.result | 真实状态文本节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 激活码 | 8位数字文本；不搜索 | 店员输入；前导零按字符串保留 | 仅LMP主机未激活且配置与hydration已就绪 | 配置/角色改变时清除待提交请求，不把旧结果应用到新目标 | 长度8、字符0-9；不接受集团编码等附加字段 | 等待期间禁提交；owner拒绝显示原因；结果未知先读selector | client重新读生效配置、设备身份、角色和激活状态 |
| 服务空间名称 | 只读状态 | server-config有效selector | config hydration完成 | 有效配置改变时名称与待提交URL目标一起更新 | 来自当前选中的package serverSpaces | 未就绪显示等待，不显示旧名称配新目标 | server-config owner与激活client在提交前核对同一有效配置 |

FORM_MUTATION_DENOMINATOR=1个业务mutation：activateTerminalCommand；needToActivateTerminalCommand只打开本screen，不提交激活。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| activationCode | 8位数字激活码输入框 | EDITABLE | R-04；本screen激活码 | 用户输入原样传入，保留前导零 | 校验8位数字；不和身份/空间字段拼接 | terminal-data-client在当前角色、设备和配置下重核 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| operationId | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | client一次业务操作身份 | 由既有client操作路径创建并在同次重试复用 | 不得从控件输入或重试时另造 | client actor按同次业务操作规则确认 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| groupWorkspaceKey | 不显示；路由身份不是用户输入 | HIDDEN_OWNER_FACT | 成功响应的凭证身份；当前选中空间的prefix仅用于路由 | activation command不收集团编码；generated后缀负责只产生operation suffix与path参数；composition注入server-config network provider，由transport network adapter将suffix追加到当前选中地址的addresses[].baseUrl（该baseUrl就是完整URL前缀） | 请求始终使用当前选中的服务空间；切换空间后按新prefix发起；owner拒绝时保留凭证、不伪造成功 | groupWorkspaceKey只取验证成功响应，不从URL解析或重建；client不读server-config selector/state | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| surfaceForm / appVersion | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | application composition设备元数据 | 当前运行入口真实值 | 身份变化令旧请求不得提交 | client校验闭集与当前运行身份 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| deviceId / credentialSecret | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | DevicePort / terminal-data-client安全随机来源 | 分别由设备端口读取、client生成；只在client保存 | 不得进入DOM、日志或配置投影 | client唯一持有并验证；UI不接触秘密 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ACT-02-LMP

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端独立业务页
HOST_AND_ENTRY=integration在主机未激活时派needToActivateTerminalCommand；显式调用且已激活时显示成功状态后按最新阶段交给业务包路由
ACTOR=店员
BUSINESS_SCENARIO=店员首次在笔记本主屏进入 sample
BUSINESS_GOAL=未激活时提交唯一8位码；显式调用且已激活时确认成功状态并由integration按当前阶段路由
USER_VISIBLE_COPY=设备激活；服务空间：<当前生效名称>；激活码；激活；激活失败原因；设备已激活成功
TECHNICAL_BOUNDARY=同ACT-01；不暴露凭证或后台请求技术字段
ACTIVE_SUCCESS_STATE=“设备已激活成功”；无按钮、无计时；路由由integration按当前selector交给业务包
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveStatus
CONTAINER_LAYOUT=laptop PRIMARY 1280×720（入口 package terminalSurfaces）；居中单列表单，宽度不超过现有 720px 内容宽；唯一滚动区为表单内容，标题、服务空间与提交操作保持可见。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                         设备激活                                 │
│                 服务空间：<当前服务空间名称>                               │
│                                                                  │
│                  激活码 [ _ _ _ _ _ _ _ _ ]                     │
│                                                                  │
│                         [激活]                                   │
│                   [失败原因 / 重试提示]                            │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ACT-02-LMP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 填写激活码 | terminal.activation.code | 真实数字输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 提交激活 | terminal.activation.submit | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 显示激活结果 | terminal.activation.result | 真实状态文本节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 激活码 | 8位数字文本；不搜索 | 店员输入；前导零按字符串保留 | 仅LMP主机未激活且配置与hydration已就绪 | 配置/角色改变时清除待提交请求，不把旧结果应用到新目标 | 长度8、字符0-9；不接受集团编码等附加字段 | 等待期间禁提交；owner拒绝显示原因；结果未知先读selector | client重新读生效配置、设备身份、角色和激活状态 |
| 服务空间名称 | 只读状态 | server-config有效selector | config hydration完成 | 有效配置改变时名称与待提交URL目标一起更新 | 来自当前选中的package serverSpaces | 未就绪显示等待，不显示旧名称配新目标 | server-config owner与激活client在提交前核对同一有效配置 |

FORM_MUTATION_DENOMINATOR=1个业务mutation：activateTerminalCommand；needToActivateTerminalCommand只打开本screen，不提交激活。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| activationCode | 8位数字激活码输入框 | EDITABLE | R-04；本screen激活码 | 用户输入原样传入，保留前导零 | 校验8位数字；不和身份/空间字段拼接 | terminal-data-client在当前角色、设备和配置下重核 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| operationId | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | client一次业务操作身份 | 由既有client操作路径创建并在同次重试复用 | 不得从控件输入或重试时另造 | client actor按同次业务操作规则确认 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| groupWorkspaceKey | 不显示；路由身份不是用户输入 | HIDDEN_OWNER_FACT | 成功响应的凭证身份；当前选中空间的prefix仅用于路由 | activation command不收集团编码；generated后缀负责只产生operation suffix与path参数；composition注入server-config network provider，由transport network adapter将suffix追加到当前选中地址的addresses[].baseUrl（该baseUrl就是完整URL前缀） | 请求始终使用当前选中的服务空间；切换空间后按新prefix发起；owner拒绝时保留凭证、不伪造成功 | groupWorkspaceKey只取验证成功响应，不从URL解析或重建；client不读server-config selector/state | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| surfaceForm / appVersion | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | application composition设备元数据 | 当前运行入口真实值 | 身份变化令旧请求不得提交 | client校验闭集与当前运行身份 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| deviceId / credentialSecret | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | DevicePort / terminal-data-client安全随机来源 | 分别由设备端口读取、client生成；只在client保存 | 不得进入DOM、日志或配置投影 | client唯一持有并验证；UI不接触秘密 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ACT-03-LMS

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端内容面
HOST_AND_ENTRY=内容为 MAIN/SECONDARY 时由激活阶段路由选择
ACTOR=店员
BUSINESS_SCENARIO=双屏主机副屏尚未激活
BUSINESS_GOAL=主机未激活时引导至主屏；显式调用且主机已激活时显示成功状态，由integration按当前阶段路由
USER_VISIBLE_COPY=请在主屏幕上完成设备激活；设备已激活成功
TECHNICAL_BOUNDARY=只投影当前host内容；已激活成功提示不代表副机active；不读取或生成副屏凭证；断链遮罩优先
ACTIVE_SUCCESS_STATE=收到显式UI command且当前host已激活时显示“设备已激活成功”；之后由integration按当前selector路由
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-primitives:PrimitiveContainer,PrimitiveText
CONTAINER_LAYOUT=laptop SECONDARY 1280×720；单一居中说明文本，无独立滚动区，不含提交控件。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              请在主屏幕上完成设备激活                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ACT-03-LMS -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 主屏激活引导 | terminal.activation.guide | 只读文本节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：本screen只有引导文本，无mutation。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ACT-04-LSP

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端内容面
HOST_AND_ENTRY=配对副机当前为 SLAVE/PRIMARY/BRANCH，激活阶段路由选择
ACTOR=店员
BUSINESS_SCENARIO=副机本地没有主机已激活投影
BUSINESS_GOAL=主机未激活时引导至配对主机；显式调用且主机已激活时显示成功状态，由integration按当前阶段路由
USER_VISIBLE_COPY=请先在主机上完成设备激活；设备已激活成功
TECHNICAL_BOUNDARY=副机不保存凭证、不显示本机active、不发起激活；仅在当前host投影显示已激活成功；断链遮罩优先
ACTIVE_SUCCESS_STATE=收到显式UI command且当前host已激活时显示“设备已激活成功”；之后由integration按当前selector路由
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-primitives:PrimitiveContainer,PrimitiveText
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；单一居中说明文本，无独立滚动区，不含提交控件。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              请先在主机上完成设备激活                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ACT-04-LSP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 配对主机激活引导 | terminal.activation.guide | 只读文本节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：本screen只有引导文本，无mutation。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ADMIN-SHELL 本机管理导航壳

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER本机管理层；不是platform-admin或operations-admin后台会话）
UI_SURFACE=本机admin console导航区域
HOST_AND_ENTRY=ADMIN-AUTH认证成功后显示；从导航项进入ADMIN-01..04对应内容screen
ACTOR=终端本地管理员
BUSINESS_SCENARIO=在本机状态、服务配置与双机拓扑管理任务间切换
BUSINESS_GOAL=在同一个本机管理层内打开所需管理内容并随时返回终端
USER_VISIBLE_COPY=本机管理；设备激活状态；服务配置；双机拓扑；关闭
TECHNICAL_BOUNDARY=导航只切换本地AdminSection；关闭只关闭本地层，不清理terminal/config/topology事实
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-admin-shell:AdminSectionComponent,adminShellAssembly; @catering-v2s/ui-base-primitives:adminGeometry
CONTAINER_LAYOUT=复用AdminShellFrameLaptop/AdminShellFrameMobile现有geometry；laptop以左侧导航列表展示三项，mobile以既有下拉导航展示同三项；标题与关闭保持可见，导航区域本身不滚动。
```

```text
laptop：
┌──────── 本机管理 ──────────────────────────────── [关闭] ┐
│ 导航列表          │ 当前选择的内容由ADMIN-01..04承载       │
│ • 设备激活状态    │                                      │
│ • 服务配置        │                                      │
│ • 双机拓扑        │                                      │
└───────────────────┴──────────────────────────────────────┘

mobile：
┌──────── 本机管理 ───────────────────── [关闭] ┐
│ [选择管理页面：设备激活状态／服务配置／双机拓扑 ▼] │
└──────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ADMIN-SHELL -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 选择设备激活状态 | adminTestIds.section(terminal-activation) | 真实导航项节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 选择服务配置 | adminTestIds.section(server-config-panel) | 真实导航项节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 选择双机拓扑 | adminTestIds.section(topology) | 真实导航项节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 关闭本机管理 | terminal.admin:close | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：section导航与关闭只改变本地admin layer，不修改业务事实。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ADMIN-01 设备激活状态

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=本机 admin console 内容 Tab
HOST_AND_ENTRY=本机 admin launcher → 本机认证 → “设备激活状态” tab
ACTOR=终端本地管理员
BUSINESS_SCENARIO=排查当前设备是否已激活及 TDS 是否在线
BUSINESS_GOAL=看清激活/连接/延时并可从合格主机取消激活
USER_VISIBLE_COPY=设备激活状态；激活状态；终端；门店；集团空间；连接状态；连接延时；主机状态待同步；上次主机状态（待同步）；等待主机状态；取消激活；取消中；错误说明
TECHNICAL_BOUNDARY=MASTER读取terminal-data-client本机selectors；SLAVE只显示sourceNodeId匹配当前peer的持久status projection；projection revision未ready或断链时标“上次主机状态（待同步）”，无匹配缓存时显示等待；status projection只用于展示，不授予业务资格
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-admin-shell:adminShellAssembly; @catering-v2s/ui-base-render:useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-primitives:PrimitiveCard,PrimitiveButton,PrimitiveStatusRow,PrimitiveText
CONTAINER_LAYOUT=仅画“设备激活状态”当前内容区，不把共享 admin 壳、其他 tab 或关闭按钮画入本 screen；laptop 内容宽不超 admin-shell 现有内容区，mobile 单列；唯一纵向滚动在本 tab 内容区，取消按钮保持可见。
```

```text
┌──────────── 设备激活状态 ──────────────────────────────────┐
│ ┌ 激活状态 ──────────────────────────────────────────────┐ │
│ │ 激活状态：已激活 / 未激活 / 正在取消                    │ │
│ │ 上次主机状态（待同步） / 主机状态待同步                 │ │
│ │ 终端：…  门店：…  集团空间：…                            │ │
│ │ 连接：已连接/连接中/断开；延时：…或等待主机状态          │ │
│ │ 最近可恢复错误：…                                         │ │
│ │ [取消激活]（仅有权威主机且已激活）                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ADMIN-01 -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 展示激活状态 | terminal.activation.admin.status | 状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 取消激活 | terminal.activation.admin.cancel | 真实按钮节点，仅合格主机可见 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 显示取消结果 | terminal.activation.admin.result | 真实状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=一个状态mutation：cancelTerminaActivationCommand（按需求公开拼写）；状态展示不是mutation。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| groupWorkspaceKey | 不显示；路由身份不是用户输入 | HIDDEN_OWNER_FACT | server-config当前有效URL前缀 | 从当前selector读取 | 不允许手输 | client取消路径重读当前配置 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| terminalRef/generation | 设备/代次只读状态文本 | HIDDEN_OWNER_FACT | terminal-data-client当前凭证 | 从唯一credential owner取得 | 副机不持有、不代填 | client按当前凭证和主机资格校验；副机command拒绝 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ADMIN-02 服务配置（主机/未配对本机）

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=本机 admin console 内容 Tab
HOST_AND_ENTRY=本机 admin launcher → 本机认证 → “服务配置” tab
ACTOR=终端本地管理员
BUSINESS_SCENARIO=设置当前应用声明的服务空间和其服务地址
BUSINESS_GOAL=配置候选地址（每个addresses[].baseUrl就是该地址的完整URL前缀）、超时与代理
USER_VISIBLE_COPY=服务配置；服务空间；服务；地址名称；地址URL（完整URL前缀）；超时；HTTP代理；用户名；代理密码；已配置/未配置；保存；清除服务覆盖；恢复内置默认；当前覆盖作用于该服务的所有服务空间
TECHNICAL_BOUNDARY=只调用公开配置 commands；selector 读回实际配置及持久化结果；密码由配置 owner 明文持久化并同步但界面不回显、日志不出现；不把集团路径从 URL 前缀拆出
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-admin-shell:adminShellAssembly; @catering-v2s/ui-base-render:useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveStatus
CONTAINER_LAYOUT=仅画主机/未配对本机可编辑的服务配置内容区；服务空间与服务选择在表单上方；地址最多四条；唯一滚动区是配置表单，保存/清除/恢复按钮保持可见并不横向溢出。
```

```text
┌──────────── 服务配置 ──────────────────────────────┐
│ 服务空间 [当前生效空间 ▼]                                      │
│ 服务 [当前服务名称 ▼]                                      │
│ 当前覆盖作用于该服务的所有服务空间                          │
│ 地址 1 名称 [____] 地址URL（完整前缀） [https://…____] 超时 [____] │
│ 地址 2 名称 [____] 地址URL（完整前缀） [https://…____] 超时 [____] │
│ 地址 3 名称 [____] 地址URL（完整前缀） [https://…____] 超时 [____] │
│ 地址 4 名称 [____] 地址URL（完整前缀） [https://…____] 超时 [____] │
│ 每个地址的URL都包含该地址的完整path前缀；地址2..4可留空；有效地址最多四条                            │
│ HTTP 代理 [启用] 主机 [____] 端口 [____] 用户名 [____]       │
│ 代理密码 [输入新密码________________] [已配置/未配置]       │
│ [保存] [清除服务覆盖] [恢复内置默认]                        │
│ [生效/持久化结果与可恢复错误]                               │
└─────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ADMIN-02 -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 选择服务空间 | terminal.server-config.space | 真实Select节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 选择服务 | terminal.server-config.service | 真实Select节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 地址1名称 | terminal.server-config.address.1.name | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 地址1 URL（即该地址完整URL前缀，addresses[].baseUrl） | terminal.server-config.address.1.url | 同一真实baseUrl输入节点；不得另画URL前缀输入 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 地址1超时 | terminal.server-config.address.1.timeout | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 地址2名称/URL/超时 | terminal.server-config.address.2.name / .url / .timeout | 三个独立真实输入节点；槽位可留空 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 地址3名称/URL/超时 | terminal.server-config.address.3.name / .url / .timeout | 三个独立真实输入节点；槽位可留空 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 地址4名称/URL/超时 | terminal.server-config.address.4.name / .url / .timeout | 三个独立真实输入节点；槽位可留空 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 切换HTTP代理 | terminal.server-config.proxy-enabled | 真实Toggle节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 输入代理主机 | terminal.server-config.proxy-host | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 输入代理端口 | terminal.server-config.proxy-port | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 输入代理用户名 | terminal.server-config.proxy-user | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 输入新代理密码 | terminal.server-config.proxy-password | secure真实输入节点；已有秘密不回显 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 保存覆盖 | terminal.server-config.save | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 清除服务覆盖 | terminal.server-config.clear | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 恢复内置默认 | terminal.server-config.restore | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 显示生效/持久化/同步结果 | terminal.server-config.result | 真实状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 服务空间 | 固定声明select；不搜索 | 当前入口package.json的serverSpaces | 配置初始化已通过且当前为主机或未配对本机 | 切换空间更新有效配置readback；override按服务跨空间共享，不伪装成每空间独立保存 | 只选当前应用声明的有限空间 | 加载失败保留等待/错误，不用旧值覆盖当前选择 | selectServerConfigSpaceCommand校验owner声明集合 |
| 服务 | 固定声明select；不搜索 | 当前selected space的server declaration | 先选择服务空间 | 改变服务后清除不属于新服务的表单草稿并重读override | 只能从该space的已声明services选择 | 候选未加载时禁编辑/保存 | server-config owner按当前space/serverName重核 |
| 地址1..4 | address list fields；不搜索 | 当前服务override或内置defaults | 先选space与service | 地址编辑只影响当前service的草稿；提交整组地址 | 1..4项；每项name、baseUrl、timeoutMs；URL前缀不可丢集团路径 | 校验失败保留草稿；存储失败显示effective与persisted不同 | setServerOverrideCommand重核地址数、URL与超时 |
| 代理启用/host/port/username/password | fixed toggle + inputs；不搜索 | 当前服务配置与用户输入 | 先选space与service；host/port在启用时必填 | 禁用代理将proxy置null；密码set/keep/none按现有输入协议，不回显既有秘密 | 仅HTTP代理；不增加协议、代理发现或另一密码owner | 失败保留非秘密草稿；密码不回显/不进入日志 | server-config owner核验字段与set/keep/none，并按裁决明文保存/同步 |

FORM_MUTATION_DENOMINATOR=4个真实command variant：selectServerConfigSpaceCommand、setServerOverrideCommand、clearServerOverrideCommand、restoreServerDefaultsCommand。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| spaceName | 服务空间选择器 | EDITABLE | 有限package serverSpaces | 选择器返回的已声明值 | 切换后重读selectedSpace | server-config校验声明集合 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| serverName | 服务选择器 | EDITABLE | selected space内server声明 | 服务选择控件 | 作为override/clear目标 | server-config校验服务存在 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| addresses[].addressName/baseUrl/timeoutMs | 地址名、完整URL前缀、超时输入 | EDITABLE | 所选服务现值或内置defaults | 配置表单，整组提交；每个baseUrl承载该地址的完整URL前缀 | 1..4完整集合；不再存在独立URL前缀输入或第二事实 | server-config校验并返回effective config | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| proxy.protocol/host/port/username | HTTP代理开关及主机/端口/用户名输入 | EDITABLE / CONDITIONAL_EDITABLE | 现值或用户输入 | HTTP代理开关打开时填写 | 关闭代理提交null；不产生多套代理配置 | owner校验HTTP协议、host/port | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| proxy.password | 密码安全输入框（已有秘密不回显） | CONDITIONAL_EDITABLE | 只可输入新秘密；现有密码只暴露configured状态 | set/keep/none输入形态由现有owner协议保持 | 不回显、不进入DOM值/日志；变更只送server-config owner | owner唯一处理密码持久化与同步 | 认证/保存失败时清除敏感输入，不记录或回显秘密；保留非敏感表单并显示owner错误 |
| clear/restore target | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 当前selected service或当前app默认 | UI不可输入技术标识 | clear按服务清override；restore恢复当前应用package defaults | command owner复核目标及应用defaults | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ADMIN-03 服务配置（配对副机）

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=本机 admin console 内容 Tab
HOST_AND_ENTRY=副机本地 admin launcher → 本机认证 → “服务配置” tab
ACTOR=终端本地管理员
BUSINESS_SCENARIO=查看副机从当前主机同步的网络配置
BUSINESS_GOAL=识别当前主机服务配置；所有编辑须回到主机处理
USER_VISIBLE_COPY=服务配置（主机）；当前服务空间/地址/代理信息；配对副机只读
TECHNICAL_BOUNDARY=selector 读副机已同步持久化投影；任何配置 command 均在 actor 拒绝；密码显示已配置状态不回显
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-admin-shell:adminShellAssembly; @catering-v2s/ui-base-render:useUiStateSelector; @catering-v2s/ui-base-primitives:PrimitiveText,PrimitiveStatusRow
CONTAINER_LAYOUT=仅画副机只读配置内容区；与 ADMIN-02 共用容器宽度、列顺序与唯一滚动区；不含选择器、输入框或写入按钮；容器不超出 1280×720 viewport。
```

```text
┌──────────── 服务配置（主机） ──────────────────────┐
│ 服务空间：<当前服务空间名称>                                         │
│ 当前服务地址   https://…   超时 …                         │
│ 代理：已配置（密码不回显）                                 │
│ 配对副机只读；请在主机修改服务配置                         │
└─────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ADMIN-03 -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 显示主机配置状态 | terminal.server-config.read.status | 只读状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 显示空间/服务/地址 | terminal.server-config.read.* | 只读文本节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 显示代理是否配置 | terminal.server-config.read.proxy-status | 只读状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：本screen没有输入或mutation；branch任何配置command均须由owner拒绝。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ADMIN-04 双机拓扑恢复

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=本机 admin console 内容 Tab
HOST_AND_ENTRY=副机本地 admin launcher → 本机认证 → “双机拓扑” tab，即使业务遮罩可见
ACTOR=终端本地管理员
BUSINESS_SCENARIO=副机配对断开、换主机或退配中
BUSINESS_GOAL=通过本机 topology command 恢复到明确可验证的配对状态
USER_VISIBLE_COPY=双机拓扑；主机；配对状态；连接状态；主机地址；连接主机；取消配对；正在取消/连接中；失败原因
TECHNICAL_BOUNDARY=只调用 topology owner commands/selectors；完成与当前身份 readback 前不解除业务遮罩
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-admin-shell:adminShellAssembly; @catering-v2s/ui-base-render:useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveStatus
CONTAINER_LAYOUT=仅画“双机拓扑”当前内容区；laptop 状态/操作双栏，mobile 单列；唯一滚动区是 topology 内容区；连接/退配操作区始终可见。
```

```text
┌──────────── 双机拓扑 ────────────────────────────────────┐
│ 当前状态：连接中 / 已连接 / 正在退配 / 未配对             │
│ 主机：[已绑定主机]                                         │
│ 新主机地址 [____________________] [连接主机]               │
│ [取消配对]                                                 │
│ 说明：验证新连接身份并完成配置/状态同步后，业务才恢复        │
│ [失败原因 / 当前恢复阶段]                                  │
└─────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ADMIN-04 -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 输入新主机地址 | terminal.admin:topology:host-ip | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 连接主机 | terminal.admin.topology.pair | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 取消配对 | terminal.admin.topology.unpair | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 显示恢复阶段/失败 | terminal.admin.topology.operation-feedback | 真实状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 新主机地址 | host text input；不搜索 | 本地管理员输入 | 本机admin已认证；仅副机拓扑恢复时可用 | 换主机必须先完整unpair，再pair-by-host；退配未成功保留遮罩并不提交新host | 单一host地址，按现有topology host解析规则 | 失败保留输入和当前拓扑事实；中间MASTER不显示恢复成功 | topology owner重核当前role、pair identity与host可达/配对结果 |

FORM_MUTATION_DENOMINATOR=2个真实command variant：unpairTopologyCommand；pairByHostTopologyCommand(host)。切换host固定先unpair成功再pair。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| host | 主机地址输入框与连接主机按钮 | EDITABLE | 本机管理员输入 | pair-by-host command参数 | 改变目标时旧peer投影失效并保持业务遮罩 | topology owner校验host与当前拓扑 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| current peer identity/role | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | topology selector | UI不构造身份 | 退配→新配串行；中间role不解锁业务 | topology owner核实完整结果 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| unpair completion | 退配阶段与结果状态 | HIDDEN_OWNER_FACT | unpair owner结果+topology selector readback | 无用户可编辑值 | 失败不得继续pair-by-host | 当前peer已明确清理后方可下一command | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ADMIN-00 本机管理入口（左上角交互区）

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=Header 控件
HOST_AND_ENTRY=integration-assembly 的 AdminLauncher 包住当前 screen；在任一本机内容面左上角重复点击既有入口区域，打开当前实例的本机 admin layer
ACTOR=终端本地管理员
BUSINESS_SCENARIO=查看本机状态、配置或恢复本机配对
BUSINESS_GOAL=不依赖远端 peer 打开本机管理
USER_VISIBLE_COPY=无可见文字；沿用 AdminLauncher 既有左上角多击手势
TECHNICAL_BOUNDARY=必须派 openLayerCommand 且 target=local；副机断链不能禁用该入口；不把入口动作路由给 peer
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-admin-shell:AdminLauncher,ADMIN_CONSOLE_LAYER_ID,ADMIN_CONSOLE_PART_KEY; @catering-v2s/kernel-base-ui-state:openLayerCommand
CONTAINER_LAYOUT=现有逻辑画布范围不变；入口位于本机左上角，手势观察不拦截其余内容触摸；无新增滚动区域。
```

```text
┌（左上角本机管理手势区；无新增可见图标）───────────────┐
│ 当前业务内容继续使用整张画布                        │
└──────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ADMIN-00 -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 打开本机管理 | terminal.admin:launcher | AdminLauncher真实手势节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：本地打开操作只派openLayerCommand(target=local)。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: ADMIN-AUTH 本机管理员认证层

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=Modal
HOST_AND_ENTRY=ADMIN-00 的本机 openLayerCommand 打开 admin console layer；首次进入或本地认证失效时显示本机口令表单
ACTOR=终端本地管理员
BUSINESS_SCENARIO=打开本地管理功能
BUSINESS_GOAL=在本机验证本地管理员身份
USER_VISIBLE_COPY=本机管理；管理员口令；验证；关闭；认证失败
TECHNICAL_BOUNDARY=使用现有 admin password owner/DeviceIdentity 校验，不复用平台后台会话；失败只留在本机，不读取 peer
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-admin-shell:adminShellAssembly; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveStatus
CONTAINER_LAYOUT=复用终端 admin layer laptop/mobile frame；对话内容居中且不超出画布；表单只有自身一段滚动；验证与关闭操作保持可见。
```

```text
┌──────────────── 本机管理 ────────────────┐
│ 管理员口令 [____________________]         │
│ [验证]                         [关闭]     │
│ [认证失败原因]                            │
└───────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:ADMIN-AUTH -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 管理员口令 | terminal.admin:password-input | 真实安全输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 验证本机管理员 | terminal.admin:verify | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 关闭 | terminal.admin:close | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 管理员口令 | secure password input；不搜索 | 用户在本机输入 | 本机管理layer已打开且认证失效/未认证 | 失败清口令并留在当前本机认证层；关闭只关本机layer | 由现有admin password owner核验，不复用后台session | 失败显示本机认证失败；身份读取失败不套用fallback成功 | admin-shell现有verifyAdminPassword路径按DeviceIdentity与本地时间校验 |

FORM_MUTATION_DENOMINATOR=本机口令验证一项本地mutation；不访问后台IAM或peer。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| attempt | 密码安全输入框（已有秘密不回显） | EDITABLE | 本机管理员认证表单 | 只送入现有admin password owner | 不保存成业务状态，不记录日志 | 现有DeviceIdentity/admin password owner判定；认证失败保持未认证 | 认证/保存失败时清除敏感输入，不记录或回显秘密；保留非敏感表单并显示owner错误 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: AUTH-01-MMP 主屏店员登录

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端独立业务页
HOST_AND_ENTRY=client active 且主机 staff selector 未登录，由 integration 派 needToLoginStaffCommand
ACTOR=店员
BUSINESS_SCENARIO=设备已经激活，店员开始当前 sample 工作
BUSINESS_GOAL=登录当前主机上的 sample 店员会话
USER_VISIBLE_COPY=店员登录；姓名；密码；登录；登录中；认证失败原因
TECHNICAL_BOUNDARY=不显示运营管理后台账号或服务端权限字段；登录状态只由 staff owner selector 判定
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveStatus
CONTAINER_LAYOUT=mobile PRIMARY 360×640；输入区唯一滚动，标题与登录按钮可见，表单单列。
```

```text
┌────────────────────────┐
│ 店员登录               │
│ 姓名 [____________]    │
│ 密码 [____________]    │
│ [登录]                 │
│ [失败原因]             │
└────────────────────────┘
```

<!-- SCREEN-CLOSURE:AUTH-01-MMP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 店员姓名 | sample.auth.login:operator-name | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 店员口令 | sample.auth.login:passcode | 真实安全输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 登录 | sample.auth.login:submit | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 登录状态 | sample.auth.login:loading | 真实状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 店员姓名 | text input；不搜索 | 店员输入 | 主机active且本机primary具备资格 | 失败保留姓名、清空口令 | 仅作为sample login输入 | 加载禁重复提交；认证失败显示稳定可读错误 | sample-staff-session loginCommand以当前凭据核验 |
| 店员口令 | password input；不搜索 | 店员输入 | 与姓名字段同属有效登录表单 | 失败清空口令，不清姓名 | 仅作为本次登录凭据，不持久化、不投影 | 未提交或认证中禁重复提交；失败后可重新输入 | sample-staff-session loginCommand以当前凭据核验 |

FORM_MUTATION_DENOMINATOR=一个业务mutation：loginCommand。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| operatorName | 姓名/电话输入框 | EDITABLE | 店员登录表单 | 用户输入 | 失败保留姓名 | staff owner核验 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| passcode | 密码安全输入框（已有秘密不回显） | EDITABLE | 店员登录表单 | 安全输入 | 失败清空；不得持久化/投影/日志 | staff owner核验且不会复制到副机 | 认证/保存失败时清除敏感输入，不记录或回显秘密；保留非敏感表单并显示owner错误 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: AUTH-02-LMP 主屏店员登录

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端独立业务页
HOST_AND_ENTRY=client active 且主机 staff selector 未登录，由 integration 派 needToLoginStaffCommand
ACTOR=店员
BUSINESS_SCENARIO=设备已激活，店员在笔记本主屏开始 sample 工作
BUSINESS_GOAL=登录主机上的 sample 店员会话
USER_VISIBLE_COPY=店员登录；姓名；密码；登录；登录中；认证失败原因
TECHNICAL_BOUNDARY=不显示后台 IAM 账号或权限字段；由 staff owner selector 确认登录
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveStatus
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；表单居中且宽度不超过现有 720px 内容宽；唯一滚动区为输入内容，标题与登录操作可见。
```

```text
┌────────────────────────────────────────────┐
│                  店员登录                  │
│       姓名 [________________________]       │
│       密码 [________________________]       │
│                  [登录]                    │
│                 [失败原因]                 │
└────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:AUTH-02-LMP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 店员姓名 | sample.auth.login:operator-name | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 店员口令 | sample.auth.login:passcode | 真实安全输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 登录 | sample.auth.login:submit | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 登录状态 | sample.auth.login:loading | 真实状态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 店员姓名 | text input；不搜索 | 店员输入 | 主机active且本机primary具备资格 | 失败保留姓名、清空口令 | 仅作为sample login输入 | 加载禁重复提交；认证失败显示稳定可读错误 | sample-staff-session loginCommand以当前凭据核验 |
| 店员口令 | password input；不搜索 | 店员输入 | 与姓名字段同属有效登录表单 | 失败清空口令，不清姓名 | 仅作为本次登录凭据，不持久化、不投影 | 未提交或认证中禁重复提交；失败后可重新输入 | sample-staff-session loginCommand以当前凭据核验 |

FORM_MUTATION_DENOMINATOR=一个业务mutation：loginCommand。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| operatorName | 姓名/电话输入框 | EDITABLE | 店员登录表单 | 用户输入 | 失败保留姓名 | staff owner核验 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| passcode | 密码安全输入框（已有秘密不回显） | EDITABLE | 店员登录表单 | 安全输入 | 失败清空；不得持久化/投影/日志 | staff owner核验且不会复制到副机 | 认证/保存失败时清除敏感输入，不记录或回显秘密；保留非敏感表单并显示owner错误 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: AUTH-03-LMS 主屏登录引导

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端内容面
HOST_AND_ENTRY=登录阶段路由依据 MAIN/SECONDARY 选择
ACTOR=店员
BUSINESS_SCENARIO=当前内容面不拥有主机店员登录入口
BUSINESS_GOAL=去主机完成登录并等待主机状态投影
USER_VISIBLE_COPY=请在主屏幕上完成店员登录
TECHNICAL_BOUNDARY=不展示/复制登录口令；不调用 staff login/logout command
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-primitives:PrimitiveContainer,PrimitiveText
CONTAINER_LAYOUT=laptop 1280×720；单一居中提示，无滚动与操作按钮。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                 请在主屏幕上完成店员登录                         │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:AUTH-03-LMS -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 主屏登录引导 | sample.auth.guide | 只读文本节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：只读主屏引导，无登录command。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: AUTH-04-LSP 主机登录引导

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=副机内容面
HOST_AND_ENTRY=配对副机处于 SLAVE/PRIMARY/BRANCH 且主机 staff 投影未登录时
ACTOR=店员
BUSINESS_SCENARIO=副机继续沿用主机店员资格
BUSINESS_GOAL=知道必须先在主机登录
USER_VISIBLE_COPY=请先在主机上完成店员登录
TECHNICAL_BOUNDARY=副机不复制口令、不调用 staff login/logout command
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair; @catering-v2s/ui-base-primitives:PrimitiveContainer,PrimitiveText
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；单一居中提示，无滚动与操作按钮。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                  请先在主机上完成店员登录                         │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:AUTH-04-LSP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 主机登录引导 | sample.auth.guide | 只读文本节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：只读主机引导，无副机登录command。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-01-MMP 移动主屏会员工作台

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端业务内容页与表单控件
HOST_AND_ENTRY=sample-console 主机登录成功 → startMemberDeskCommand
ACTOR=店员
BUSINESS_SCENARIO=店员查看会员名单或发起登记
BUSINESS_GOAL=读取主机会员集合、发起独立待确认录入并退出主机登录
USER_VISIBLE_COPY=已登记会员；暂无会员；新增；姓名；电话；提交；取消；退出
TECHNICAL_BOUNDARY=业务通过 sample-member-desk command；列表 selector 读主机 member-registry；没有 member backend HTTP
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveEmptyState
CONTAINER_LAYOUT=mobile PRIMARY 360×640；单列内容；唯一滚动为列表/表单内容，底部操作固定且不被软键盘遮挡。
```

```text
┌────────────────────────┐
│ 已登记会员                   │
│ 姓名 · 电话               │
│ …                        │
│ [新增]                   │
│ [退出]                   │
└────────────────────────┘
```

表单态（与列表态同一业务内容页）

```text
┌────────────────────────┐
│ 新增会员               │
│ 姓名 [____________]    │
│ 电话 [____________]    │
│ [提交]       [取消]    │
└────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-01-MMP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 会员列表/空态 | sample.desk.member-list:* | 列表/空态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 新增 | sample.desk.member-list:add | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 姓名 | sample.desk.member-form:name | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 电话 | sample.desk.member-form:phone | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 提交/取消 | sample.desk.member-form:submit/cancel | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 退出 | sample.desk.member-list:logout | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 姓名 | text input；不搜索 | 店员本次录入 | host资格已就绪 | 取消仅清本次草稿；重复/倒序结果不覆盖另一pending | owner所定义name字段 | 验证失败保留当前草稿；读取失败不显示空列表 | member owner校验当前operation与host资格 |
| 电话 | text input；不搜索 | 店员本次录入 | 与姓名同一草稿 | 同草稿一起提交 | owner所定义phone字段 | 错误时保留输入，不清其他pending | member owner校验 |

FORM_MUTATION_DENOMINATOR=memberFormOpenedCommand、submitMemberCommand、memberFormCancelledCommand、logoutCommand；顾客确认由SAMPLE-04-MMP / SAMPLE-05-LMP承载。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| name/phone | 姓名/电话输入框 | EDITABLE | 店员新增会员表单 | submitMemberCommand payload | 本次pending隔离；失败不覆盖其他端pending | member owner核验格式和当前准入 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| operation identity/initiator | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | member registry当前pending owner事实 | 自动从本次pending读取 | 迟到响应不得确认较新pending | owner按操作身份最终核验 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| reject/withdraw target | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 当前端current pending identity | command无业务字段但必须由owner绑定当前操作 | 只终结本次pending | owner拒绝过期/不匹配操作 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-02-LMP 笔记本主屏会员工作台

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端业务内容页与表单控件
HOST_AND_ENTRY=sample-console 主机登录成功 → startMemberDeskCommand
ACTOR=店员
BUSINESS_SCENARIO=店员查看会员名单或发起登记
BUSINESS_GOAL=读取主机会员集合、发起独立待确认录入并退出主机登录
USER_VISIBLE_COPY=已登记会员；暂无会员；新增；姓名；电话；提交；取消；退出
TECHNICAL_BOUNDARY=sample-member-desk commands；selector 读取主机 member-registry；无 member backend HTTP
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveEmptyState
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；内容宽不超过现有 960px 列表宽；唯一滚动为列表/表单内容，页面操作固定。
```

```text
┌──────────────────────────────┐
│ 已登记会员                   │
│ ┌ 姓名 · 电话 ─────────────┐ │
│ │ …                        │ │
│ └──────────────────────────┘ │
│ [新增]                 [退出] │
└──────────────────────────────┘
```

表单态（与列表态同一业务内容页）

```text
┌────────────────────────────────────────────┐
│                  新增会员                  │
│       姓名 [________________________]       │
│       电话 [________________________]       │
│                  [提交] [取消]             │
└────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-02-LMP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 会员列表/空态 | sample.desk.member-list:* | 列表/空态节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 新增 | sample.desk.member-list:add | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 姓名 | sample.desk.member-form:name | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 电话 | sample.desk.member-form:phone | 真实输入节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 提交/取消 | sample.desk.member-form:submit/cancel | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |
| 退出 | sample.desk.member-list:logout | 真实按钮节点 | DESIGN_PROPOSAL / NOT_IMPLEMENTED |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 姓名 | text input；不搜索 | 店员本次录入 | host资格已就绪 | 取消仅清本次草稿；重复/倒序结果不覆盖另一pending | owner所定义name字段 | 验证失败保留当前草稿；读取失败不显示空列表 | member owner校验当前operation与host资格 |
| 电话 | text input；不搜索 | 店员本次录入 | 与姓名同一草稿 | 同草稿一起提交 | owner所定义phone字段 | 错误时保留输入，不清其他pending | member owner校验 |

FORM_MUTATION_DENOMINATOR=memberFormOpenedCommand、submitMemberCommand、memberFormCancelledCommand、logoutCommand；顾客确认由SAMPLE-04-MMP / SAMPLE-05-LMP承载。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| name/phone | 姓名/电话输入框 | EDITABLE | 店员新增会员表单 | submitMemberCommand payload | 本次pending隔离；失败不覆盖其他端pending | member owner核验格式和当前准入 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| operation identity/initiator | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | member registry当前pending owner事实 | 自动从本次pending读取 | 迟到响应不得确认较新pending | owner按操作身份最终核验 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| reject/withdraw target | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 当前端current pending identity | command无业务字段但必须由owner绑定当前操作 | 只终结本次pending | owner拒绝过期/不匹配操作 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-03-LSP 副机会员工作台

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=副机独立业务页面
HOST_AND_ENTRY=副机连接且所需成员/资格投影 ready → 本机 BRANCH 命令进入 sample-member-desk 独立 LSP 组件
ACTOR=店员
BUSINESS_SCENARIO=副机店员为顾客录入会员，确认在本屏完成
BUSINESS_GOAL=读主机共享列表，并持有与主机待确认互不覆盖的本地录入过程
USER_VISIBLE_COPY=已登记会员；暂无会员；新增；姓名；电话；可选年龄；提交；取消；请核对姓名与电话；确认；信息有误
TECHNICAL_BOUNDARY=LSP独立页面组件；列表、录入与顾客确认是同一页面的状态；提交后在本页显示顾客确认；BRANCH command显式发送主机member owner command；没有店员登出入口
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-input:InputScrollArea; @catering-v2s/ui-base-primitives:PrimitiveInput,PrimitiveButton,PrimitiveEmptyState
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；独立 LSP 页面；内容宽不超过 960px；唯一滚动为列表/表单内容，提交/确认操作固定。
```

```text
┌──────────────────────────────┐
│ 已登记会员                   │
│ ┌ 姓名 · 电话 ─────────────┐ │
│ │ …                        │ │
│ └──────────────────────────┘ │
│ [新增]                       │
│                              │
└──────────────────────────────┘
```

副机本地表单态（仅输入姓名和电话；提交后在同一 LSP 页面切换为顾客确认态）

```text
┌────────────────────────────────────────────┐
│                  新增会员                  │
│       姓名 [________________________]       │
│       电话 [________________________]       │
│                  [提交] [取消]             │
└────────────────────────────────────────────┘
```

顾客确认态（仍在 SAMPLE-03-LSP 页面内）

```text
┌──────────────────────────────┐
│ 请核对姓名与电话             │
│ 姓名：…   电话：…            │
│ 年龄（可选）[______]         │
│ [确认]          [信息有误]   │
└──────────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-03-LSP -->

#### 逐屏操作控件与 testId roster

LSP 控件已由独立 BRANCH/SLAVE parts 实现，并复用相同叶组件与 owner commands；表内列出当前源码节点。本专项无 Browser L2 授权，未来非 adapter 行为按 TR-16 先 Expo Web，再以同一场景清单对照 VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 读取主机已登记会员集合及空态 | sample.desk.branch.member-list:title / row:<memberId> / empty | BranchMemberList中的真实列表与空态节点 | IMPLEMENTED_FOCUSED_ONLY；Expo Web/VM NOT_RUN |
| 打开新增表单 | sample.desk.branch.member-list:add | BranchMemberList中的真实按钮节点 | IMPLEMENTED_FOCUSED_ONLY；Expo Web/VM NOT_RUN |
| 输入姓名、电话 | sample.desk.branch.member-form:name / phone | BranchMemberForm中的真实输入节点 | IMPLEMENTED_FOCUSED_ONLY；Expo Web/VM NOT_RUN |
| 提交或取消本机草稿 | sample.desk.branch.member-form:submit / cancel | BranchMemberForm中的真实按钮节点 | IMPLEMENTED_FOCUSED_ONLY；Expo Web/VM NOT_RUN |
| 确认态读取姓名/电话/年龄并输入可选年龄 | sample.desk.branch.customer-member:name / phone / age | BranchCustomerMember中的只读文本与真实输入节点 | IMPLEMENTED_FOCUSED_ONLY；Expo Web/VM NOT_RUN |
| 确认或标记信息有误 | sample.desk.branch.customer-member:confirm / reject | BranchCustomerMember中的真实按钮节点 | IMPLEMENTED_FOCUSED_ONLY；Expo Web/VM NOT_RUN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权 Browser L2；本屏未来先做 Expo Web 与同场景 VM 验证，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 主机会员列表 | 只读窗口化列表；不搜索 | 当前 peer 的 member-registry projection | 当前 peer 身份与该集合投影均 ready | peer/revision 变化时先清旧投影并遮罩业务 | 完整 owner 集合；不分页、不设新总量上限 | 空集合显示暂无会员；未 ready 不伪装为空 | 只由 host member-registry selector 提供 |
| 姓名 | text input；不搜索 | 店员本次 branch 草稿 | 合法店员会话、配对及所需投影 ready | 仅清理本次未提交草稿；不覆盖 host 或另一端 pending | 沿用 member owner 字段校验 | 验证失败保留草稿；断链阻止提交 | branch command 检查当前身份，之后显式路由到 host command |
| 电话 | text input；不搜索 | 与姓名同一 branch 草稿 | 与姓名相同 | 随当前草稿提交或取消 | 沿用 member owner 字段校验 | 错误只影响当前 draft | host owner 最终校验本次 operation |
| 年龄 | 可选数字输入；不搜索 | 顾客确认时的本地输入快照 | 仅当前 branch pending 的确认态 | 不写入 submit payload；仅随当前确认 command 提交 | 沿用当前年龄输入约束与可选语义 | 无 pending 不呈现可确认身份；确认失败保留当前态 | member owner 用本次 pending identity 绑定确认 |

FORM_MUTATION_DENOMINATOR=memberFormOpenedCommand、submitMemberCommand、memberFormCancelledCommand、confirmMemberCommand、rejectMemberCommand；可选age只随confirmMemberCommand提交；BRANCH 先记录本机草稿/待确认，再显式发送 host owner command；本 screen 无 logout command。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| name / phone | 姓名/电话输入框 | EDITABLE | LSP 本次录入表单 | 当前 branch draft 后提交至 host member owner | operation 与另一端 pending 隔离；失败不覆盖 host 集合 | host owner 校验字段与本次操作 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| age? | 年龄可选输入框（仅确认态） | CONDITIONAL_EDITABLE | LSP 同页顾客确认 | confirmMemberCommand 的可选 age；不并入 submitMember payload | 只应用当前 branch 发起的 operation | host owner 绑定精确 pending identity | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| branch operation identity | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 本地 BRANCH member feature | owner command 创建并追踪；不由 UI 输入 | 迟到响应不得确认新 pending | branch owner 与 host operation 结果共同确认 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| logout | 不显示；本屏禁止该控件与command | FORBIDDEN | R-09a：LSP 不提供店员登出 | N/A | N/A | LSP 无 logout 控件、command 或消费者 | 控件/command不得出现；若误派由owner拒绝并记录非敏感错误 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：本屏展示完整只读 owner 集合和精确用户输入，不需要候选搜索。

### Screen: SAMPLE-04-MMP 移动单屏本页顾客确认

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=主屏内的顾客确认业务页
HOST_AND_ENTRY=MMP 主机 member-desk 提交本次待确认会员后，在同一移动 PRIMARY 面切换到顾客确认 part
ACTOR=顾客（店员将移动终端交给顾客核对本次录入）
BUSINESS_SCENARIO=单屏移动主机没有独立 LMS，顾客需在本机核对本次会员登记
BUSINESS_GOAL=确认或拒绝当前准确的待确认登记；可选年龄仅随确认提交
USER_VISIBLE_COPY=请确认登记；姓名；电话；年龄（可选）；确认；拒绝；交还店员（仅当前 handheld-confirm 模式）
TECHNICAL_BOUNDARY=身份来自当前 host member-registry pending selector；operation identity、发起端与任何凭证不显示；年龄只在 confirmMemberCommand 中提交
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand,useTrackedCommand; @catering-v2s/ui-base-input:InputScrollArea,useInputField,useInputSnapshot; @catering-v2s/ui-base-primitives:PrimitiveContainer,PrimitiveHeading,PrimitiveText,PrimitiveActions,PrimitiveButton,PrimitiveInput,PrimitiveLabel
CONTAINER_LAYOUT=mobile PRIMARY 360×640；确认信息与年龄输入位于唯一 InputScrollArea；确认/拒绝/交还店员动作位于滚动区外的单列操作组；不增加第二个滚动祖先，键盘覆盖时以当前 virtual keyboard 行为验证关键动作可达。
```

```text
┌────────────────────────┐
│ 请确认登记             │
│ 姓名：…                │
│ 电话：…                │
│ 年龄（可选）[______]   │
│ [确认]                 │
│ [拒绝]                 │
│ [交还店员]（条件显示） │
└────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-04-MMP -->

#### 逐屏操作控件与 testId roster

现有 mobile 组件实际使用以下字面量；它们是当前实现事实，不代表本专项新增 binding。未来集中到所属 feature 唯一 `*TestIds.ts` 时，须保留语义并挂到真实节点。

| 用户动作/观察 | testId 当前源码字面量 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 当前 pending 姓名/电话/标题 | sample.desk.customer-member:title / name / phone | Heading 与只读文本节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 输入可选年龄 | sample.desk.customer-member:age-label / age | Label 与真实输入节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 确认或拒绝 | sample.desk.customer-member:confirm / reject | 两个真实按钮节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 单屏模式交还店员 | sample.desk.customer-member:hand-back | handheld-confirm 条件下真实按钮 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项未授权 Browser L2；未来按 TR-16 先 Expo Web 再同场景 VM，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 姓名与电话 | 只读文本；不搜索 | 当前 MMP host member-registry pending selector | 顾客确认面仅在本次 pending 存在时显示 | pending identity 变化时旧内容立即失效 | 不允许编辑本次姓名/电话 | pending 未就绪时不显示旧身份或空成功态 | confirm/reject command 按 owner 当前 pending identity 复核 |
| 年龄 | 可选数字输入；不搜索 | 当前顾客输入快照；初始为空 | 仅当前 pending identity 有效时可编辑 | 身份变化/流程退出清理本地输入；不写入 submit payload | 沿用现有年龄输入限制与可选语义 | 输入无效保留确认面并显示字段错误 | confirmMemberCommand 只携带可选 age，owner 校验当前 pending |

FORM_MUTATION_DENOMINATOR=confirmMemberCommand、rejectMemberCommand、memberSubmissionWithdrawnCommand（交还店员）；只对当前 MMP host pending 生效。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| age? | 年龄可选输入框（仅确认态） | CONDITIONAL_EDITABLE | 当前顾客确认面的可选年龄字段 | confirmMemberCommand payload；不进入 submitMemberCommand | 只随当前 operation 确认 | member-registry 按当前 pending identity 复核 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| operation identity / initiator | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | member-registry 当前 pending | 由 owner selector/read path 提供，不由 UI 传入 | 迟到响应不得消费后续 pending | owner 以当前 operation 和发起端校验 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| reject target | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 当前 pending identity | rejectMemberCommand 不接受 UI 自造目标 | 只终结本次待确认，不改变其他端 pending | member-registry 最终判定 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| hand-back target | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 当前 MMP 当前 pending | memberSubmissionWithdrawnCommand 只用于 handheld-confirm | 撤回仅作用当前单屏 pending | owner 校验当前 pending | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：本屏只读取一条精确 owner pending 并接受可选年龄输入，没有候选集合。

### Screen: SAMPLE-05-LMP 单屏本页顾客确认

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=主屏内的顾客确认页
HOST_AND_ENTRY=笔记本主机没有 LMS 时，LMP member-desk 自身待确认录入
ACTOR=顾客
BUSINESS_SCENARIO=顾客在单屏主机核对店员发起的本次登记
BUSINESS_GOAL=确认或拒绝准确的本次录入
USER_VISIBLE_COPY=请确认登记；姓名；电话；年龄（可选）；确认；拒绝；交还店员（仅 handheld-confirm 模式）
TECHNICAL_BOUNDARY=仅处理本机 owner 中当前 operation identity；年龄仅随confirm提交；不触碰其他端 pending
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand,useTrackedCommand; @catering-v2s/ui-base-input:InputScrollArea,useInputField,useInputSnapshot; @catering-v2s/ui-base-primitives:PrimitiveText,PrimitiveButton,PrimitiveInput,PrimitiveLabel
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；姓名/电话与可选年龄在唯一 InputScrollArea；确认/拒绝/条件性交还店员位于滚动区外的操作组；无第二滚动祖先。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                    请核对本次登记信息                            │
│                    姓名：…  电话：…                              │
│                    年龄（可选）[________]                          │
│               [确认]            [拒绝]                             │
│                    [交还店员]（条件显示）                          │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-05-LMP -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 标题及当前pending姓名/电话 | sample.desk.customer-member:title / name / phone | Heading与只读文本节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 输入可选年龄 | sample.desk.customer-member:age-label / age | Label与真实输入节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 确认或拒绝 | sample.desk.customer-member:confirm / reject | 两个真实按钮节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 单屏模式交还店员 | sample.desk.customer-member:hand-back | handheld-confirm条件下真实按钮 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 年龄 | 可选数字输入；不搜索 | 当前顾客输入快照，初始为空 | 当前pending identity有效时可编辑 | identity变化或流程结束时清理旧输入 | 沿用现有年龄输入限制与可选语义 | 验证失败保留确认态 | confirmMemberCommand只携带可选age，owner复核pending |

FORM_MUTATION_DENOMINATOR=confirmMemberCommand、rejectMemberCommand，以及 handheld-confirm 时的 memberSubmissionWithdrawnCommand；均只作用当前 host pending operation。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| age? | 年龄可选输入框（仅确认态） | CONDITIONAL_EDITABLE | 顾客确认表单可选年龄 | confirmMemberCommand payload；不进入submitMember payload | 仅本operation确认 | owner按当前pending复核年龄 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| operation identity | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 当前host member-registry pending | owner selector，不由UI输入 | 迟到确认不消费新pending | member owner核验当前身份 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| 拒绝目标 | 不显示；目标从owner当前pending取得 | HIDDEN_OWNER_FACT | 当前pending identity | reject command使用当前owner事实 | 拒绝不写入列表且不影响其他pending | member owner复核身份 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| 交还店员目标 | 不显示；目标从owner当前pending取得 | HIDDEN_OWNER_FACT | 当前pending identity | memberSubmissionWithdrawnCommand只在handheld-confirm显示 | 撤回仅当前pending | member owner复核身份 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-06-LMS 主机副屏顾客确认

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=副屏顾客确认内容页
HOST_AND_ENTRY=单机LMS为MASTER+SECONDARY并消费本机host pending；双机LMS为SLAVE+VICE，消费绑定当前peer的hostPending projection
ACTOR=顾客
BUSINESS_SCENARIO=顾客核对本次登记姓名、电话和可选年龄
BUSINESS_GOAL=确认或拒绝准确的本次录入
USER_VISIBLE_COPY=欢迎；请确认登记；姓名；电话；年龄（可选）；确认；拒绝
TECHNICAL_BOUNDARY=单机LMS读取MASTER本机host pending并本地确认/拒绝；双机SLAVE+VICE的LMS读取带operationId的hostPending projection，确认/拒绝以显式peer target发回MASTER owner；branchPending只供LSP本机页面消费，投影apply不得覆盖
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand,useTrackedCommand; @catering-v2s/ui-base-input:InputScrollArea,useInputField,useInputSnapshot; @catering-v2s/ui-base-primitives:PrimitiveText,PrimitiveButton,PrimitiveInput,PrimitiveLabel
CONTAINER_LAYOUT=laptop SECONDARY 1280×720；姓名/电话与可选年龄在唯一 InputScrollArea；确认/拒绝位于滚动区外操作组；无第二滚动祖先。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                            欢迎                                  │
│                  请核对本次登记信息                              │
│                  姓名：…   电话：…                               │
│                  年龄（可选）：…                                  │
│            [确认]                     [信息有误]                 │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-06-LMS -->

#### 逐屏操作控件与 testId roster

以下均为设计提案；当前没有新增控件、testId绑定、L2 binding或focused proof。本专项未来按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId提案 | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 标题及当前pending姓名/电话 | sample.desk.customer-member:title / name / phone | Heading与只读文本节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 输入可选年龄 | sample.desk.customer-member:age-label / age | Label与真实输入节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |
| 确认或拒绝 | sample.desk.customer-member:confirm / reject | 两个真实按钮节点 | CURRENT_SOURCE / NOT_REVIEWED_FOR_THIS_DESIGN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 年龄 | 可选数字输入；不搜索 | 当前顾客输入快照，初始为空 | 当前host pending identity有效时可编辑 | identity变化或流程结束时清理旧输入 | 沿用现有年龄输入限制与可选语义 | 验证失败保留确认态 | confirmMemberCommand只携带可选age，owner复核pending |

FORM_MUTATION_DENOMINATOR=单机LMS：confirmMemberCommand/rejectMemberCommand由本机host owner执行；双机SLAVE+VICE LMS：同一命令带host pending operationId并显式target=peer返回MASTER owner。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| age? | 年龄可选输入框（仅确认态） | CONDITIONAL_EDITABLE | 顾客确认表单可选年龄 | confirmMemberCommand payload | 仅本operation确认 | owner按当前pending复核年龄 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| operation identity | 不显示；仅owner用于绑定本次操作 | HIDDEN_OWNER_FACT | 当前host member-registry pending | owner selector，不由UI输入 | 迟到确认不消费新pending | member owner核验当前身份 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |
| 拒绝目标 | 不显示；目标从owner当前pending取得 | HIDDEN_OWNER_FACT | 当前pending identity | reject command使用当前owner事实 | 拒绝不写入列表且不影响其他pending | member owner复核身份 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-07-MMP 主机移动面选择壁纸

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端独立业务页
HOST_AND_ENTRY=sample-wallpaper-console 登录后由 startWallpaperPickerCommand 路由到本机 PRIMARY 壁纸选择页
ACTOR=店员
BUSINESS_SCENARIO=店员选择移动终端本屏背景
BUSINESS_GOAL=选择并确认本机已列出的屏幕壁纸
USER_VISIBLE_COPY=选择屏幕壁纸；无壁纸；山景；湖景；海滩；确认；店员登出
TECHNICAL_BOUNDARY=壁纸选择/确认使用sample-wallpaper owner；店员登出复用sample-staff-session现有logoutCommand，由integration按staff selector回登录阶段；待选值与已确认值区分，登出失败留在当前页且显示错误
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-primitives:PrimitiveScrollView,PrimitiveCard,PrimitiveRadio,PrimitiveImage,PrimitiveButton
CONTAINER_LAYOUT=mobile PRIMARY 360×640；沿用现有 120×72 缩略图；唯一滚动区为选项列表及确认操作，确认按钮在列表末尾且不被软键盘遮挡。
```

```text
┌────────────────────────┐
│ 选择屏幕壁纸           │
│ ◉ 无壁纸               │
│ ○ 山景   [预览]        │
│ ○ 湖景   [预览]        │
│ ○ 海滩   [预览]        │
│ [确认]                 │
│ [店员登出]             │
└────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-07-MMP -->

#### 逐屏操作控件与 testId roster

MMP壁纸页的当前源码已绑定选项、确认、店员登出testId；focused package test覆盖四个Radio和logout command dispatch。Expo Web/VM仍NOT_RUN。

| 用户动作/观察 | testId（当前源码） | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 选择无壁纸/山景/湖景/海滩 | sample.wallpaper.picker:options:<wallpaperId> | 真实Radio option节点 | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; EXPO_WEB_VM_NOT_RUN |
| 确认壁纸 | sample.wallpaper.picker:confirm | 真实按钮节点 | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; EXPO_WEB_VM_NOT_RUN |
| 店员登出 | sample.wallpaper.picker:logout | 真实按钮；复用现有staff logoutCommand | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; ROUTE_CP06_PENDING; EXPO_WEB_VM_NOT_RUN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 本机壁纸 | 四项Radio；不搜索 | 固定wallpaperCatalogData.json | 进入primary wallpaper screen后加载完成 | 改变待选不修改confirmed；取消/返回保留confirmed | none/w1/w2/w3固定四项 | 目录加载失败显示中性占位并禁确认 | wallpaper owner核验wallpaperId属于目录 |

FORM_MUTATION_DENOMINATOR=selectWallpaperCommand、confirmWallpaperCommand与既有staff logoutCommand；logout成功后staff selector使integration返回登录阶段。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| wallpaperId | 四项壁纸Radio选择 | EDITABLE | 固定四项壁纸目录 | Radio选择 | 先形成pending选择，confirm后读回confirmed | owner校验ID属于目录 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| confirmed/pending | 当前已确认壁纸与待选壁纸状态 | HIDDEN_OWNER_FACT | 当前设备wallpaper owner selectors | UI只消费owner状态 | 取消选择不覆盖confirmed | owner最终决定生效值 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-08-LMP 主机笔记本面选择壁纸

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端独立业务页
HOST_AND_ENTRY=sample-wallpaper-console 登录后由 startWallpaperPickerCommand 路由到本机 PRIMARY 壁纸选择页
ACTOR=店员
BUSINESS_SCENARIO=店员选择笔记本主屏背景
BUSINESS_GOAL=选择并确认本机已列出的屏幕壁纸
USER_VISIBLE_COPY=选择屏幕壁纸；无壁纸；山景；湖景；海滩；确认；退出选择；店员登出
TECHNICAL_BOUNDARY=退出选择只结束当前picker页，不改变staff session；店员登出是独立动作并复用现有staff logoutCommand，由integration按staff selector返回登录阶段；壁纸仅本机生效，选择/确认通过公开wallpaper commands
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-primitives:PrimitiveScrollView,PrimitiveCard,PrimitiveRadio,PrimitiveImage,PrimitiveButton
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；选项列表唯一滚动；网格卡片宽沿用现有 220px，不小于视口时换行；确认与退出操作保持在可见内容底部。
```

```text
┌────────────────────────────────────────────────────────┐
│ 选择屏幕壁纸                                            │
│ [无壁纸]       [山景 预览]       [湖景 预览] [海滩 预览] │
│ [确认]             [退出选择] [店员登出]              │
└────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-08-LMP -->

#### 逐屏操作控件与 testId roster

LMP壁纸页的当前源码已绑定选项、确认、退出选择、店员登出testId；focused package test覆盖退出事件与logout command dispatch。exit的integration目标由CP-06接线，Web/VM仍NOT_RUN。

| 用户动作/观察 | testId（当前源码） | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 选择无壁纸/山景/湖景/海滩 | sample.wallpaper.picker:options:<wallpaperId> | 真实Radio option节点 | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; EXPO_WEB_VM_NOT_RUN |
| 确认壁纸 | sample.wallpaper.picker:confirm | 真实按钮节点 | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; EXPO_WEB_VM_NOT_RUN |
| 退出选择 | sample.wallpaper.picker:exit | 真实页面导航动作；不调用logoutCommand | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; ROUTE_CP06_PENDING; EXPO_WEB_VM_NOT_RUN |
| 店员登出 | sample.wallpaper.picker:logout | 真实按钮；复用现有staff logoutCommand | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; ROUTE_CP06_PENDING; EXPO_WEB_VM_NOT_RUN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 本机壁纸 | 四项Radio；不搜索 | 固定wallpaperCatalogData.json | 进入primary wallpaper screen后加载完成 | 改变待选不修改confirmed；取消/返回保留confirmed | none/w1/w2/w3固定四项 | 目录加载失败显示中性占位并禁确认 | wallpaper owner核验wallpaperId属于目录 |

FORM_MUTATION_DENOMINATOR=selectWallpaperCommand、confirmWallpaperCommand与既有staff logoutCommand；LMP另有页面导航动作exit（不改变owner状态，且不等于logout）。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| wallpaperId | 四项壁纸Radio选择 | EDITABLE | 固定四项壁纸目录 | Radio选择 | 先形成pending选择，confirm后读回confirmed | owner校验ID属于目录 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| confirmed/pending | 当前已确认壁纸与待选壁纸状态 | HIDDEN_OWNER_FACT | 当前设备wallpaper owner selectors | UI只消费owner状态 | 取消选择不覆盖confirmed | owner最终决定生效值 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-09-LMS 主机副屏壁纸展示

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=终端内容面
HOST_AND_ENTRY=单机 LMS 由 MASTER+SECONDARY 同一 runtime 在 SECONDARY 内容位显示主机已确认 wallpaperId；双机 LMS 由 SLAVE+VICE 实例在 SECONDARY 内容位显示当前 peer 的主机已确认 wallpaperId 投影
ACTOR=顾客
BUSINESS_SCENARIO=主机选定壁纸后，顾客观看主机副屏
BUSINESS_GOAL=看到主机当前已确认背景
USER_VISIBLE_COPY=无额外文字；显示主机已确认壁纸
TECHNICAL_BOUNDARY=单机 LMS 用 MASTER+SECONDARY 同一 runtime 的 host confirmed selector；双机 LMS 用 SLAVE+VICE 当前 peer 绑定的 host-confirmed projection selector；两者均不显示 pending，不读取副机 LSP 本地 wallpaper，不新增可写事实
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:useUiStateSelector; @catering-v2s/ui-base-primitives:PrimitiveImage
CONTAINER_LAYOUT=laptop SECONDARY 1280×720；背景铺满声明画布，保持 cover；无滚动，不绘制其他内容、控件或状态值。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                  （主机已确认壁纸全画布展示）                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-09-LMS -->

#### 逐屏操作控件与 testId roster

LMP壁纸页的当前源码已绑定选项、确认、退出选择、店员登出testId；focused package test覆盖退出事件与logout command dispatch。exit的integration目标由CP-06接线，Web/VM仍NOT_RUN。

| 用户动作/观察 | testId（当前源码） | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 显示主机已确认背景 | sample.wallpaper.background | 只读canvas节点 | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; EXPO_WEB_VM_NOT_RUN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：只读呈现主机已确认壁纸，不派本机选择command。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: SAMPLE-10-LSP 副机独立选择壁纸

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=副机独立业务页面
HOST_AND_ENTRY=SLAVE/PRIMARY/BRANCH 经当前连接与投影 readiness 放行后，startWallpaperPickerCommand 打开独立 LSP 壁纸选择页
ACTOR=店员
BUSINESS_SCENARIO=副机店员只更换本机 PRIMARY 背景
BUSINESS_GOAL=选择、取消或确认副机本地壁纸；与主机已确认值互不覆盖
USER_VISIBLE_COPY=选择本机壁纸；无壁纸；山景；湖景；海滩；确认；退出
TECHNICAL_BOUNDARY=LSP 是独立页面入口；本机 wallpaper state 持久；当前状态不与主机壁纸覆盖同步；断链时页面被业务遮罩覆盖
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:definePartPair,useUiStateSelector,useDispatchCommand; @catering-v2s/ui-base-primitives:PrimitiveScrollView,PrimitiveCard,PrimitiveRadio,PrimitiveImage,PrimitiveButton
CONTAINER_LAYOUT=laptop PRIMARY 1280×720；采用与 LMP 相同卡片宽和列表布局；唯一滚动为壁纸列表；确认/退出保持可见；LSP component 独立，不以角色条件复用 LMP 页面。
```

```text
┌────────────────────────────────────────────────────────┐
│ 选择本机壁纸                                            │
│ [无壁纸]       [山景 预览]       [湖景 预览] [海滩 预览] │
│ [确认]                         [退出选择] │
└────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:SAMPLE-10-LSP -->

#### 逐屏操作控件与 testId roster

LSP独立SLAVE/BRANCH壁纸页的当前源码已绑定本地选项、确认、退出testId且无logout控件；focused package test覆盖选项和确认command dispatch。exit的integration目标由CP-06接线，Web/VM仍NOT_RUN。

| 用户动作/观察 | testId（当前源码） | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 选择无壁纸/山景/湖景/海滩 | sample.wallpaper.branch.picker:option.<wallpaperId> | 真实Radio option节点 | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; EXPO_WEB_VM_NOT_RUN |
| 确认壁纸 | sample.wallpaper.branch.picker:confirm | 真实按钮节点 | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; EXPO_WEB_VM_NOT_RUN |
| 退出选择 | sample.wallpaper.branch.picker:exit | 真实页面导航动作；不调用logoutCommand | CURRENT_SOURCE_ID; FEATURE_FOCUSED_PASS; ROUTE_CP06_PENDING; EXPO_WEB_VM_NOT_RUN |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 本机壁纸 | 四项Radio；不搜索 | 固定wallpaperCatalogData.json | 进入primary wallpaper screen后加载完成 | 改变待选不修改confirmed；取消/返回保留confirmed | none/w1/w2/w3固定四项 | 目录加载失败显示中性占位并禁确认 | wallpaper owner核验wallpaperId属于目录 |

FORM_MUTATION_DENOMINATOR=selectWallpaperCommand与confirmWallpaperCommand；本屏不提供staff logout。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| wallpaperId | 四项壁纸Radio选择 | EDITABLE | 固定四项壁纸目录 | Radio选择 | 先形成pending选择，confirm后读回confirmed | owner校验ID属于目录 | owner拒绝时保留该字段草稿并显示非敏感原因；只以owner readback宣告成功，迟到结果不得覆盖新操作 |
| confirmed/pending | 当前已确认壁纸与待选壁纸状态 | HIDDEN_OWNER_FACT | 当前设备wallpaper owner selectors | UI只消费owner状态 | 取消选择不覆盖confirmed | owner最终决定生效值 | 冲突/迟到结果不覆盖当前owner状态；按selector重新读回并显示当前错误/等待状态，不把unknown报成功 |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


### Screen: MASK-01 配对连接遮罩

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=独立 public 能力（TER 终端运行时页面；不是 platform-admin 或 operations-admin 后台会话）
UI_SURFACE=业务全屏遮罩层
HOST_AND_ENTRY=副机失联、正在换 host、退配未完成或业务所需状态未同步时覆盖所有业务 screen/layer
ACTOR=副机上的店员或顾客
BUSINESS_SCENARIO=副机当前连接身份或业务投影尚未 ready
BUSINESS_GOAL=知道业务暂不可用且仍可打开本机 admin 恢复
USER_VISIBLE_COPY=配对连接中，请稍后
TECHNICAL_BOUNDARY=遮罩只消费 topology/readiness selector；业务 commands 在 owner actor 处再次拒绝；admin layer 留在本机
FOUNDATION_PRIMITIVE=@catering-v2s/ui-base-render:SurfaceRoot,LayerStack; @catering-v2s/ui-base-admin-shell:AdminLauncher; @catering-v2s/kernel-base-ui-state:openLayerCommand
CONTAINER_LAYOUT=覆盖当前业务 viewport 1280×720；遮罩吸收鼠标/触摸、键盘焦点及业务 action；左上角本地 admin launcher 位于遮罩上层且可点击；无滚动。
```

```text
┌──────────────────────────────────────────────────────────────────┐
│ （沿用左上角本机管理多击手势；无额外可见文案）                    │
│                    配对连接中，请稍后                            │
│       当前业务页与业务弹层被遮住；不接收业务输入                  │
└──────────────────────────────────────────────────────────────────┘
```

<!-- SCREEN-CLOSURE:MASK-01 -->

#### 逐屏操作控件与 testId roster

遮罩状态与提示 testId 已由 integration-assembly 的 `pairReadinessInterlockTestIds` 实现；本 screen 尚无 Browser L2 binding，focused proof 仅证明组件装配/焦点与可访问性，不证明 Expo Web 或 VM 行为。本专项仍按 TR-16 先Expo Web，再以同一场景清单对照VM。

| 用户动作/观察 | testId（当前源码） | 实际动作节点 | 当前证据状态 |
| --- | --- | --- | --- |
| 本机管理手势入口 | terminal.admin:launcher | 真实AdminLauncher手势节点 | 当前源码常量；既有手势节点 |
| 断链遮罩状态 | terminal.pair.mask:status | 遮罩容器节点 | 当前源码常量；`PairReadinessInterlock` |
| 断链遮罩提示 | terminal.pair.mask:message | 真实提示文本节点 | 当前源码常量；`PairReadinessInterlock` |

L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本专项当前未授权Browser L2；该screen的非adapter行为按未来Expo Web及VM验收，不虚构空分母。

#### 表单控件依赖图

| 用户可见控件 | 控件形态/搜索 | owner候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时owner再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | 本screen没有输入控件 | 无候选或初始输入值 | 不适用 | 不适用 | 不适用 | 只读内容或状态失败按screen元数据处理 | 无mutation；owner selector仍为事实来源 |

FORM_MUTATION_DENOMINATOR=N/A_WITH_REASON：遮罩不接受业务输入；admin launcher只开本机layer。

#### Mutation字段事实矩阵

| 业务字段或command事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request取值与唯一来源 | 变更、级联与校验 | command owner最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A_WITH_REASON | N/A_WITH_REASON：本屏无mutation控件 | N/A | N/A | N/A | 本screen无mutation | 无command owner写入 | N/A_WITH_REASON：本屏无mutation |

SEARCH_CAPABILITY=NOT_APPLICABLE_WITH_REASON：依 IA §2.1.2 本screen属于有限固定项/精确输入/只读投影，不引入候选搜索。


## 3. Legacy 页面对应关系与线框依据

逐screen检索记录统一范围：`../catering-all-v2/apps` 的 backend/frontend terminal、device、wallpaper、sample-member、sample-staff 路径；执行 `rg --files ../catering-all-v2/apps | rg -i '(terminal|device|wallpaper|sample-member|sample-staff)'`，旧 review 记录为 0 命中；本仓冻结副本 `doc/heritage/frozen/catering-all-v2/apps` 文件数为 0。下表每一行均为 `NO_V2_COUNTERPART`，没有用本仓既有实现冒充 Heritage 静态摹本。

| screen id | 关系 | Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| ACT-01-MMP · MMP移动主屏激活 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2 未检索到终端激活页 |
| ACT-02-LMP · LMP笔记本主屏激活 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2 未检索到终端激活页 |
| ACT-03-LMS · LMS主屏激活引导 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2 未检索到终端激活引导 |
| ACT-04-LSP · LSP主机激活引导 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2 未检索到终端激活引导 |
| ADMIN-SHELL · 本机admin导航壳 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓admin-shell，不是Heritage摹本；all-v2无TER admin页面 |
| ADMIN-00 · 本机admin入口手势 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓admin-shell，不是Heritage摹本；all-v2无TER admin入口 |
| ADMIN-AUTH · 本机管理员认证层 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓admin-shell，不是Heritage摹本；all-v2无TER admin认证页 |
| ADMIN-01 · 设备激活状态tab | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按需求新画；all-v2未检索到终端状态tab |
| ADMIN-02 · 本机服务配置tab | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按需求新画；all-v2未检索到终端配置页 |
| ADMIN-03 · 副机服务配置只读tab | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按需求新画；all-v2未检索到副机配置页 |
| ADMIN-04 · 双机拓扑恢复tab | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按需求新画；all-v2未检索到终端配对管理页 |
| AUTH-01-MMP · MMP店员登录 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓sample-auth能力；非Heritage摹本 |
| AUTH-02-LMP · LMP店员登录 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓sample-auth能力；非Heritage摹本 |
| AUTH-03-LMS · LMS主屏登录引导 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2未检索到TER登录引导 |
| AUTH-04-LSP · LSP主机登录引导 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2未检索到TER登录引导 |
| SAMPLE-01-MMP · MMP会员工作台 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓sample-member-desk；all-v2未检索到TER会员页 |
| SAMPLE-02-LMP · LMP会员工作台 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓sample-member-desk；all-v2未检索到TER会员页 |
| SAMPLE-03-LSP · LSP独立会员页 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2未检索到TER副机会员页 |
| SAMPLE-04-MMP · MMP单屏顾客确认 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓handheld-confirm叶组件；all-v2未检索到TER顾客确认页 |
| SAMPLE-05-LMP · LMP单屏顾客确认 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓handheld-confirm叶组件；all-v2未检索到TER顾客确认页 |
| SAMPLE-06-LMS · LMS顾客确认 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓customer-member叶组件；all-v2未检索到TER顾客确认页 |
| SAMPLE-07-MMP · MMP壁纸选择 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓sample-wallpaper-picker；all-v2未检索到TER壁纸页 |
| SAMPLE-08-LMP · LMP壁纸选择 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 复用本仓sample-wallpaper-picker；all-v2未检索到TER壁纸页 |
| SAMPLE-09-LMS · LMS主机壁纸投影 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2未检索到TER壁纸投影 |
| SAMPLE-10-LSP · LSP独立壁纸选择 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2未检索到TER副机壁纸页 |
| MASK-01 · 副机业务断链遮罩 | `NO_V2_COUNTERPART` | N/A：上述同一精确检索范围未找到对应 TER 页面；冻结 apps 副本为0文件 | 按本仓现有终端组件及正式需求绘制低保真框图；不是 all-v2 摹本 | 按正式需求新画；all-v2未检索到TER双机断链遮罩 |

静态摹本免除：无。heritage只作只读检索；不复制、构建或运行旧仓资产。

## 4. 每个 screen 的 owner、控件与 testId roster

“当前来源ID”是本仓当前源码中实际出现的 testID 字符串/常量，不表示已经集中在唯一 `*TestIds.ts`；“后续唯一TestIds提案”是设计建议，尚未创建。新增 screen 与控件的ID必须在实施时由所属 app/feature 的唯一 TestIds 源导出，并挂在真实动作节点；复用旧控件时同步迁移现有字面量，不允许用外层容器代替按钮、输入或Radio节点。

| screen id | owner/source | 逐控件与动作 | 当前来源ID / 后续唯一TestIds提案 | command / readback链 |
| --- | --- | --- | --- | --- |
| ACT-01-MMP | `apps/terminal/ui/base/terminal-activation（新）` | 8位数字输入、提交、激活结果 | `当前无；提案：terminal.activation.code / terminal.activation.submit / terminal.activation.result` | needToActivateTerminalCommand → activateTerminalCommand；service space/target只读owner selector |
| ACT-02-LMP | `apps/terminal/ui/base/terminal-activation（新）` | 8位数字输入、提交、激活结果 | `当前无；提案：terminal.activation.code / terminal.activation.submit / terminal.activation.result` | 同ACT-01；仅PRIMARY允许提交 |
| ACT-03-LMS | `apps/terminal/ui/base/terminal-activation（新）` | 主屏激活引导，只读 | `当前无；提案：terminal.activation.guide` | 读取host activation projection；不派激活command |
| ACT-04-LSP | `apps/terminal/ui/base/terminal-activation（新）` | 配对主机激活引导，只读 | `当前无；提案：terminal.activation.guide` | 读取当前peer host projection；不派本机激活command |
| ADMIN-00 | `apps/terminal/ui/base/admin-shell` | 本机96 logical px内5次/1800ms手势 | `当前常量：terminal.admin:launcher` | openLayerCommand(target=local) |
| ADMIN-SHELL | `apps/terminal/ui/base/admin-shell` | 本机管理标题、设备激活状态/服务配置/双机拓扑导航项、关闭 | 当前常量：`terminal.admin:shell` / `terminal.admin:navigation`；既有adminTestIds.section(partKey)生成导航项ID；新增section须登记稳定partKey | 本地section navigation；关闭dispatch local target |
| ADMIN-AUTH | `apps/terminal/ui/base/admin-shell` | 本机管理员密码、验证、关闭 | `当前常量：terminal.admin:password-input / terminal.admin:verify / terminal.admin:close` | 本机admin认证owner；closeLayerCommand(target=local) |
| ADMIN-01 | `apps/terminal/ui/base/terminal-activation（新）` | 状态行、仅host可见的取消激活、结果 | `当前无；提案：terminal.activation.admin.status / terminal.activation.admin.cancel / terminal.activation.admin.result` | client selectors + cancelTerminaActivationCommand（需求指定公开拼写） |
| ADMIN-02 | `apps/terminal/ui/base/server-config-panel（新）` | 服务空间/服务、地址1..4各自的baseUrl（完整URL前缀）、超时、代理字段、保存/清除/恢复/结果 | `当前无；提案：terminal.server-config.space / service / address.<slot>.name / address.<slot>.url / address.<slot>.timeout / proxy-enabled / proxy-host / proxy-port / proxy-user / proxy-password / save / clear / restore / result` | server-config公开commands/selectors；密码secure输入、不回显 |
| ADMIN-03 | `apps/terminal/ui/base/server-config-panel（新）` | 主机配置只读状态；无输入与写按钮 | `当前无；提案：terminal.server-config.read.status / space / service / address / proxy-status` | 绑定current peer identity的config projection；不提供写command |
| ADMIN-04 | `apps/terminal/ui/base/admin-shell + kernel/base/topology` | 拓扑状态、host地址、连接/配对、退配、错误阶段 | `当前常量：terminal.admin:topology:host-status / host-ip / pair / unpair / operation-feedback / failure:reason` | topology owner local commands |
| AUTH-01-MMP | `apps/terminal/ui/feature/sample-staff-auth` | 姓名、密码、登录、错误/进行中 | `当前字面量：sample.auth.login:operator-name / passcode / submit / loading；sample.auth.notice:message` | loginCommand → staff-session owner |
| AUTH-02-LMP | `apps/terminal/ui/feature/sample-staff-auth` | 姓名、密码、登录、错误/进行中 | `同AUTH-01（移动/笔记本语义一致）` | 同AUTH-01 |
| AUTH-03-LMS | `apps/terminal/ui/feature/sample-staff-auth/src/components/AuthGuide.tsx` | 请在主屏登录；无输入/提交 | `当前testID：sample.auth.guide:message；part=sample.auth.guide.lms` | 只读staff qualification projection；不派login/logout |
| AUTH-04-LSP | `apps/terminal/ui/feature/sample-staff-auth/src/components/AuthGuide.tsx` | 请先在主机登录；无输入/提交 | `当前testID：sample.auth.guide:message；part=sample.auth.guide.lsp` | 只读host staff projection；不派login/logout |
| SAMPLE-01-MMP | `apps/terminal/ui/feature/sample-member-desk` | 会员列表/行/空态/新增、姓名/电话输入、提交/取消、退出、店员登出 | `当前字面量：sample.desk.member-list:title / row / empty / empty-action / add / logout；sample.desk.member-form:name / phone / submit / cancel；该表单无年龄输入，年龄仅在customer-member确认面` | 现有member-desk commands → host member-registry |
| SAMPLE-02-LMP | `apps/terminal/ui/feature/sample-member-desk` | 与SAMPLE-01相同笔记本布局 | `同SAMPLE-01；实施时集中为该feature唯一TestIds源` | 同SAMPLE-01 |
| SAMPLE-03-LSP | `apps/terminal/ui/feature/sample-member-desk/src/components/branch` | 读host会员列表；本机新增草稿；同页顾客确认/拒绝；无登出 | `当前ID：sample.desk.branch.member-list:* / member-form:* / customer-member:*` | BRANCH本机pending→显式host member owner command；不提供logout |
| SAMPLE-04-MMP | `apps/terminal/ui/feature/sample-member-desk` | 本机pending姓名/电话、可选年龄、确认/拒绝/条件性交还店员 | `当前字面量：sample.desk.customer-member:title / name / phone / age-label / age / confirm / reject / hand-back` | current host pending selector→confirm/reject/withdraw owner commands |
| SAMPLE-05-LMP | `apps/terminal/ui/feature/sample-member-desk` | 单屏主机pending姓名/电话、可选年龄、确认/拒绝/条件性交还店员 | `当前字面量：sample.desk.customer-member:title / name / phone / age-label / age / confirm / reject / hand-back` | 本机host当前operation identity → member owner |
| SAMPLE-06-LMS | `apps/terminal/ui/feature/sample-member-desk` | 欢迎、姓名/电话、可选年龄输入、确认/拒绝 | `当前字面量：sample.desk.customer-member:title / name / phone / age-label / age / confirm / reject；无hand-back（mode=confirm）` | 单机LMS走同runtime host member owner；双机SLAVE+VICE走显式peer目标的MASTER owner；LMS只消费hostPending projection，不读branchPending |
| SAMPLE-07-MMP | `apps/terminal/ui/feature/sample-wallpaper-picker` | 壁纸none/w1/w2/w3选择、确认、店员登出 | `当前源码常量：sample.wallpaper.picker:title / options:scroll / options / options:<wallpaperId> / confirm / logout` | 壁纸owner commands及既有staff logoutCommand；登出后integration按staff selector路由 |
| SAMPLE-08-LMP | `apps/terminal/ui/feature/sample-wallpaper-picker` | 壁纸选择/确认、退出选择、店员登出 | `当前源码常量：sample.wallpaper.picker:title / options:scroll / options / options:<wallpaperId> / confirm / exit / logout` | wallpaper owner；exit只结束选择页，logout复用既有staff logoutCommand并由integration按selector路由 |
| SAMPLE-09-LMS | `apps/terminal/ui/feature/sample-wallpaper-picker` | 只显示host已确认壁纸，无操作 | `当前源码常量：sample.wallpaper.background` | 单机MASTER+SECONDARY读取本机host confirmed selector；双机SLAVE+VICE读取绑定当前peer的host-confirmed projection selector；不显示pending或副机本地壁纸 |
| SAMPLE-10-LSP | `apps/terminal/ui/feature/sample-wallpaper-picker（LSP独立页面）` | 选择/确认/退出副机本地壁纸；无登出 | `当前源码常量：sample.wallpaper.branch.picker:title / options:scroll / options / option.<wallpaperId> / confirm / exit；不登记logout` | branch本机wallpaper owner；host projection不得覆盖；R-09禁止LSP登出 |
| MASK-01 | `两个integration composition + topology` | 断链提示与业务全屏遮罩；保留本机admin launcher | `当前常量：terminal.pair.mask:status / terminal.pair.mask:message；launcher继续terminal.admin:launcher` | topology current connection/projection readiness selectors |

当前 L2 不适用且无运行授权；此表是实施时的静态/test-expo/VM 控件分母，不宣称已绑定L2。
### 4.1 Surface ownership 自检

下表逐屏核对线框里的可见元素均归属该屏声明的单一 `UI_SURFACE`，且 `USER_VISIBLE_COPY` 均有草图位置。R2 对修订前字节完成了静态复核；S-1～S-6/N-1 修订后的当前字节尚无独立 review。本表是静态自查，不是运行证明。

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | 元素属于当前surface | 文案均有位置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| ACT-01-MMP | 终端独立业务页 | 标题、空间名称、激活码、输入、提交、失败/已激活成功提示 | 是 | 是 | SELF_CHECKED_STATIC |
| ACT-02-LMP | 终端独立业务页 | 标题、空间名称、激活码、输入、提交、失败/已激活成功提示 | 是 | 是 | SELF_CHECKED_STATIC |
| ACT-03-LMS | 终端内容面 | 主屏引导/已激活成功状态二选一，不同时显示 | 是 | 是 | SELF_CHECKED_STATIC |
| ACT-04-LSP | 终端内容面 | 主机引导/已激活成功状态二选一，不同时显示 | 是 | 是 | SELF_CHECKED_STATIC |
| ADMIN-SHELL | 本机admin导航壳 | 标题、三导航项、关闭 | 是 | 是 | PASS_STATIC |
| ADMIN-00 | Header左上本机admin手势控件 | 单一不可见手势区及accessibility label | 是 | 是 | PASS_STATIC |
| ADMIN-AUTH | 本机管理员认证层 | 标题、密码输入、验证、关闭、错误 | 是 | 是 | PASS_STATIC |
| ADMIN-01 | admin内容tab | 激活/连接状态、条件取消、反馈 | 是 | 是 | PASS_STATIC |
| ADMIN-02 | admin内容tab | 服务空间、服务、地址baseUrl（完整URL前缀）、代理字段、保存/恢复动作 | 是 | 是 | PASS_STATIC |
| ADMIN-03 | admin内容tab | 主机配置只读字段及投影状态 | 是 | 是 | PASS_STATIC |
| ADMIN-04 | admin内容tab | 当前拓扑、host地址、配对/退配/改连、反馈 | 是 | 是 | PASS_STATIC |
| AUTH-01-MMP | 终端内容页 | 姓名、密码、提交、失败提示 | 是 | 是 | PASS_STATIC |
| AUTH-02-LMP | 终端内容页 | 姓名、密码、提交、失败提示 | 是 | 是 | PASS_STATIC |
| AUTH-03-LMS | 终端内容面 | 单条主屏登录引导 | 是 | 是 | PASS_STATIC |
| AUTH-04-LSP | 终端内容面 | 单条主机登录引导 | 是 | 是 | PASS_STATIC |
| SAMPLE-01-MMP | 终端会员业务内容页 | 列表、空态、新增、姓名电话年龄、提交/取消、退出 | 是 | 是 | PASS_STATIC |
| SAMPLE-02-LMP | 终端会员业务内容页 | 列表、空态、新增、姓名电话年龄、提交/取消、退出 | 是 | 是 | PASS_STATIC |
| SAMPLE-03-LSP | LSP独立会员内容页 | host列表、新增表单、同页确认/拒绝；无logout | 是 | 是 | PASS_STATIC |
| SAMPLE-04-MMP | MMP单屏顾客确认页 | 姓名、电话、年龄、确认、拒绝、条件性交还店员 | 是 | 是 | PASS_STATIC |
| SAMPLE-05-LMP | LMP单屏顾客确认页 | 姓名、电话、年龄、确认、拒绝、条件性交还店员 | 是 | 是 | PASS_STATIC |
| SAMPLE-06-LMS | 副屏顾客确认内容页 | 欢迎、姓名、电话、年龄、确认、拒绝 | 是 | 是 | PASS_STATIC |
| SAMPLE-07-MMP | 主机壁纸选择页 | 四项单选、预览、确认、店员登出 | 是 | 是 | SELF_CHECKED_STATIC |
| SAMPLE-08-LMP | 主机壁纸选择页 | 四项单选、预览、确认、退出选择、店员登出 | 是 | 是 | SELF_CHECKED_STATIC |
| SAMPLE-09-LMS | 副屏主机壁纸投影 | 单一背景 | 是 | 是 | PASS_STATIC |
| SAMPLE-10-LSP | LSP独立壁纸选择页 | 四项单选、确认、退出；无登出 | 是 | 是 | SELF_CHECKED_STATIC |
| MASK-01 | 全屏业务遮罩层 | 断链提示、本机admin launcher | 是 | 是 | PASS_STATIC |

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-01/02 submit | hydration未完成显示等待 | 只接收8位数字 | 禁重复提交 | 显式派needToActivateTerminalCommand且当前已激活时显示“设备已激活成功”；integration随后按最新selector将路由交给业务包，不加按钮/计时 | 保留输入并显示owner原因 | unknown先查activation selector；断链遮罩高于成功提示 | 仅MMP/LMP主机；credential只在client |
| ADMIN-02 save/clear/restore | 显示当前effective、持久化与同步状态 | 校验拒绝不dispatch | 仅host可编辑 | 内存effective变化与selector一致后显示生效；另读持久化与同步结果 | 持久化失败保留新effective并明确“未持久化”；同步失败主机仍用当前effective、副机保持未ready | timeout/unknown先读owner selector，不报成功 | server-config command唯一写入口；副机只读；不得默认恢复旧effective |
| ADMIN-04 pair/unpair/change-host | 当前peer与阶段由topology selector驱动 | 校验角色、目标与当前状态 | topology owner顺序执行 | 完整成功且当前peer/projections ready才解除mask | 保持业务遮罩并显示失败阶段 | 先读selector，不依据命令回包猜成功 | topology owner判定；本机admin可在本机操作 |
| AUTH-01/02 login | staff selector未就绪则等待 | owner按现有登录规则拒绝错误输入 | 密码不回显、不持久化在UI状态 | staff selector确认后进当前样例 | 姓名或密码失败留在登录页 | 重新读取staff selector | 仅host登录；副面引导 |
| SAMPLE-01/02/03 submit | 配对/资格/所需投影未ready不可提交 | owner校验name/phone | 当前端pending独立 | 本operation入待确认并精确路由顾客确认面 | 错误只保留当前draft，不清另一端pending | selector回读精准operation，不盲目重发 | host registry集合唯一；LSP本机草稿后显式peer command |
| SAMPLE-04/05/06 confirm/reject/hand-back | 无pending时不渲染旧身份 | 可选年龄按现有范围验证 | 禁重复决定；只作用当前pending identity | 确认/拒绝/撤回完成后selector切回对应状态 | 过期身份显示失效，不影响新pending | 回读当前pending与成员集合 | 不跨LMP/LSP pending；年龄只进confirm |
| SAMPLE-07/08/10 wallpaper confirm | 目录未ready使用中性提示 | 只能选四个内置id | 单个owner command | selector确认值后更新画面 | 保留当前confirmed | 先readback；unknown不替换背景 | 每设备local owner；host投影不覆盖LSP |
| MASK-01解除遮罩 | connection或required projection未ready保持遮罩 | 只允许当前peer/revision | 恢复由topology command完成 | current peer+connection+required projections全ready后解遮罩 | 任一失败/旧投影继续遮罩 | 重新读取当前身份与revision | 遮罩拦业务动作但本机admin可用 |

## 6. 逐操作任务合理性

以下逐项列出各线框里的每个输入、选择器、按钮、导航和手势；只读屏幕另标 N/A，不折叠不同控件。共同Journey依据为已接受Journey §3 对应步骤；具体 owner 与拒绝边界见详设 §6/§7。

| 操作/控件（一个动作一行） | 已接受Journey来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因 | Dexter裁决必要 |
| --- | --- | --- | --- | --- | --- | --- |
| ACT-01-MMP · 输入8位激活码 | Journey §3.2 | MMP店员首次激活终端 | 当前主屏单字段输入 | 副面没有激活权限，后台输入会绕开设备身份与当前服务空间 | 产品/owner | 否 |
| ACT-01-MMP · 提交激活 | Journey §3.2 | MMP店员完成终端激活 | 当前页提交并读回owner状态 | 不把输入完成当成功；只以client selector确认 | 产品/owner | 否 |
| ACT-02-LMP · 输入8位激活码 | Journey §3.2 | LMP店员首次激活终端 | 当前主屏单字段输入 | 副面没有激活权限，后台输入会绕开设备身份与当前服务空间 | 产品/owner | 否 |
| ACT-02-LMP · 提交激活 | Journey §3.2 | LMP店员完成终端激活 | 当前页提交并读回owner状态 | 不把输入完成当成功；只以client selector确认 | 产品/owner | 否 |
| ADMIN-SHELL · 打开设备激活状态tab | Journey §3.7 | 本机管理员在同一console切换维护任务或返回业务 | 共享导航壳内直接操作 | 另建入口会重复管理壳；关闭只关本地layer | 产品/owner | 否 |
| ADMIN-SHELL · 打开服务配置tab | Journey §3.7 | 本机管理员在同一console切换维护任务或返回业务 | 共享导航壳内直接操作 | 另建入口会重复管理壳；关闭只关本地layer | 产品/owner | 否 |
| ADMIN-SHELL · 打开双机拓扑tab | Journey §3.7 | 本机管理员在同一console切换维护任务或返回业务 | 共享导航壳内直接操作 | 另建入口会重复管理壳；关闭只关本地layer | 产品/owner | 否 |
| ADMIN-SHELL · 关闭本机管理层 | Journey §3.7 | 本机管理员在同一console切换维护任务或返回业务 | 共享导航壳内直接操作 | 另建入口会重复管理壳；关闭只关本地layer | 产品/owner | 否 |
| ADMIN-00 · 使用左上角既有多击手势打开本机管理 | Journey §3.7 | 管理员从当前终端面进入本机维护 | 复用既有AdminLauncher | 新增悬浮按钮会改变既有触摸布局和手势owner | 产品/owner | 否 |
| ADMIN-AUTH · 输入本机管理员口令 | Journey §3.7 | 通过本机维护认证 | 当前认证层输入 | 不能复用店员或后台账号口令 | 产品/owner | 否 |
| ADMIN-AUTH · 提交口令验证 | Journey §3.7 | 授权本机管理员打开维护内容 | 输入后在同层验证 | 验证结果由本机认证owner判定 | 产品/owner | 否 |
| ADMIN-AUTH · 关闭认证层 | Journey §3.7 | 放弃本次本机管理进入 | 当前层关闭 | 不清除业务、配置或拓扑事实 | 产品/owner | 否 |
| ADMIN-01 · 取消激活 | Journey §3.7 | 合格主机管理员终止本机激活 | 状态tab内单次command | 副机不能取消；不在业务页增加第二入口 | 产品/owner | 否 |
| ADMIN-02 · 选择服务空间 | Journey §3.7 | 管理员定位当前应用已声明的配置对象 | 两个有限selector按先后选择 | 不增加搜索或手输技术标识 | 产品/owner | 否 |
| ADMIN-02 · 选择服务 | Journey §3.7 | 管理员定位当前应用已声明的配置对象 | 两个有限selector按先后选择 | 不增加搜索或手输技术标识 | 产品/owner | 否 |
| ADMIN-02 · 编辑地址baseUrl（完整URL前缀） | Journey §3.7 | 为所选服务维护准确请求前缀 | 表单字段编辑 | 不拆出集团空间路径或改成另一个owner | 产品/owner | 否 |
| ADMIN-02 · 地址槽位1：编辑地址名称 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位1：编辑地址URL | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位1：编辑地址超时 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位2：编辑地址名称 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位2：编辑地址URL | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位2：编辑地址超时 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位3：编辑地址名称 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位3：编辑地址URL | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位3：编辑地址超时 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位4：编辑地址名称 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位4：编辑地址URL | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 地址槽位4：编辑地址超时 | Journey §3.7 | 管理员维护所选服务的有序地址候选 | 当前配置表单编辑 | 保留需求规定的最多四条；不引入额外发现或负载均衡语义 | 产品/owner | 否 |
| ADMIN-02 · 切换HTTP代理启用状态 | Journey §3.7 | 管理员选择是否经已配置HTTP代理连接 | 当前表单内切换 | 代理协议与密码owner不变 | 产品/owner | 否 |
| ADMIN-02 · 输入代理主机 | Journey §3.7 | 管理员提交所需代理配置 | 同一配置表单字段 | 密码只输入新值/按owner既有保留协议，不回显已有秘密 | 产品/owner | 否 |
| ADMIN-02 · 输入代理端口 | Journey §3.7 | 管理员提交所需代理配置 | 同一配置表单字段 | 密码只输入新值/按owner既有保留协议，不回显已有秘密 | 产品/owner | 否 |
| ADMIN-02 · 输入代理用户名 | Journey §3.7 | 管理员提交所需代理配置 | 同一配置表单字段 | 密码只输入新值/按owner既有保留协议，不回显已有秘密 | 产品/owner | 否 |
| ADMIN-02 · 输入代理密码 | Journey §3.7 | 管理员提交所需代理配置 | 同一配置表单字段 | 密码只输入新值/按owner既有保留协议，不回显已有秘密 | 产品/owner | 否 |
| ADMIN-02 · 保存服务覆盖 | Journey §3.7 | 管理员显式提交所选服务配置变更 | 当前配置tab命令 | 不在切换selector时隐式持久化 | 产品/owner | 否 |
| ADMIN-02 · 清除当前服务覆盖 | Journey §3.7 | 管理员显式提交所选服务配置变更 | 当前配置tab命令 | 不在切换selector时隐式持久化 | 产品/owner | 否 |
| ADMIN-02 · 恢复本应用内置默认 | Journey §3.7 | 管理员显式提交所选服务配置变更 | 当前配置tab命令 | 不在切换selector时隐式持久化 | 产品/owner | 否 |
| ADMIN-03 · 查看同步后的服务配置 | Journey §3.7 | 副机管理员核对当前主机配置 | 只读tab | 不提供本地写入口，避免副机更改主机配置 | 产品 | 否 |
| ADMIN-04 · 输入主机地址 | Journey §3.4 | 副机管理员在本地指定配对主机 | 当前恢复tab的单一输入 | 断链时外部配置页不可达；本机owner校验完整地址 | 产品/owner | 否 |
| ADMIN-04 · 连接或改连主机 | Journey §3.4 | 建立/切换当前双机配对关系 | 同一tab提交目标主机 | 阶段和结果由topology owner复核，不凭回包解除业务遮罩 | 产品/owner | 否 |
| ADMIN-04 · 取消配对 | Journey §3.4 | 管理员结束当前双机关系 | 同一tab内显式取消 | 不把关闭tab或断链误当作退配完成 | 产品/owner | 否 |
| AUTH-01-MMP · 输入店员姓名 | Journey §3.3 | MMP店员识别本次登录账号 | 当前主屏登录表单 | 副面不登录，不复制账号状态 | 产品/owner | 否 |
| AUTH-01-MMP · 输入店员密码 | Journey §3.3 | MMP店员验证登录资格 | 当前主屏登录表单 | 密码不持久化到UI状态或同步 | 产品/owner | 否 |
| AUTH-01-MMP · 提交店员登录 | Journey §3.3 | MMP店员进入sample业务 | 输入后在当前页提交 | 只以staff owner selector进入业务 | 产品/owner | 否 |
| AUTH-02-LMP · 输入店员姓名 | Journey §3.3 | LMP店员识别本次登录账号 | 当前主屏登录表单 | 副面不登录，不复制账号状态 | 产品/owner | 否 |
| AUTH-02-LMP · 输入店员密码 | Journey §3.3 | LMP店员验证登录资格 | 当前主屏登录表单 | 密码不持久化到UI状态或同步 | 产品/owner | 否 |
| AUTH-02-LMP · 提交店员登录 | Journey §3.3 | LMP店员进入sample业务 | 输入后在当前页提交 | 只以staff owner selector进入业务 | 产品/owner | 否 |
| AUTH-03-LMS · 阅读主屏登录说明 | Journey §3.3 | 顾客/店员了解登录位置 | 单条只读说明 | 无需增加按钮；LMS不独立登录 | 产品 | 否 |
| AUTH-04-LSP · 阅读主机登录说明 | Journey §3.3 | LSP店员了解登录位置 | 单条只读说明 | 不让副机独立创建会话 | 产品 | 否 |
| SAMPLE-01-MMP · 查看已登记会员/空态 | Journey §3.5 | MMP店员核对主机会员集合 | 当前列表 | 不增加候选搜索或独立读入口 | owner | 否 |
| SAMPLE-01-MMP · 打开新增会员表单 | Journey §3.5 | MMP店员发起本次会员登记 | 当前member desk内切换 | 不跳转正式会员中心 | 产品/owner | 否 |
| SAMPLE-01-MMP · 输入会员姓名 | Journey §3.5 | MMP店员登记本次会员 | 当前新增表单 | owner负责最终字段校验 | 产品/owner | 否 |
| SAMPLE-01-MMP · 输入会员电话 | Journey §3.5 | MMP店员登记本次会员 | 与姓名同一表单 | 不把电话输入混入后台IAM | 产品/owner | 否 |
| SAMPLE-01-MMP · 提交会员登记 | Journey §3.5 | MMP店员把当前操作送入待确认流程 | 当前表单提交 | 年龄不在登记请求，避免与确认语义混淆 | 产品/owner | 否 |
| SAMPLE-01-MMP · 取消会员草稿 | Journey §3.5 | MMP店员放弃未提交录入 | 当前表单取消 | 只清本次草稿，不影响另一端pending | 产品/owner | 否 |
| SAMPLE-01-MMP · 退出会员工作台 | Journey §3.5 | MMP店员结束本次主机工作台会话 | 当前工作台提供的退出动作 | 只调用staff owner，不在UI另建会话副本 | 产品/owner | 否 |
| SAMPLE-02-LMP · 查看已登记会员/空态 | Journey §3.5 | LMP店员核对主机会员集合 | 当前列表 | 不增加候选搜索或独立读入口 | owner | 否 |
| SAMPLE-02-LMP · 打开新增会员表单 | Journey §3.5 | LMP店员发起本次会员登记 | 当前member desk内切换 | 不跳转正式会员中心 | 产品/owner | 否 |
| SAMPLE-02-LMP · 输入会员姓名 | Journey §3.5 | LMP店员登记本次会员 | 当前新增表单 | owner负责最终字段校验 | 产品/owner | 否 |
| SAMPLE-02-LMP · 输入会员电话 | Journey §3.5 | LMP店员登记本次会员 | 与姓名同一表单 | 不把电话输入混入后台IAM | 产品/owner | 否 |
| SAMPLE-02-LMP · 提交会员登记 | Journey §3.5 | LMP店员把当前操作送入待确认流程 | 当前表单提交 | 年龄不在登记请求，避免与确认语义混淆 | 产品/owner | 否 |
| SAMPLE-02-LMP · 取消会员草稿 | Journey §3.5 | LMP店员放弃未提交录入 | 当前表单取消 | 只清本次草稿，不影响另一端pending | 产品/owner | 否 |
| SAMPLE-02-LMP · 退出会员工作台 | Journey §3.5 | LMP店员结束本次主机工作台会话 | 当前工作台提供的退出动作 | 只调用staff owner，不在UI另建会话副本 | 产品/owner | 否 |
| SAMPLE-03-LSP · 查看host会员列表/空态 | Journey §3.5 | LSP店员核对共享已登记集合 | 当前独立页面只读列表 | 本机branch不得直接写host集合 | owner | 否 |
| SAMPLE-03-LSP · 打开本机新增会员表单 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-03-LSP · 输入会员姓名 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-03-LSP · 输入会员电话 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-03-LSP · 提交本机会员登记 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-03-LSP · 取消本机会员草稿 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-03-LSP · 输入顾客确认的可选年龄 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-03-LSP · 确认本次登记 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-03-LSP · 标记本次信息有误 | Journey §3.5 | LSP店员在独立页面完成本机登记并由顾客确认 | 同一独立LSP页面按当前operation切换状态 | pending由branch隔离；年龄只随确认command，不进入submit payload | 产品/owner | 否 |
| SAMPLE-04-MMP · 输入可选年龄 | Journey §3.5 | 顾客核对MMP移动主屏本次登记时补充年龄 | 当前确认页字段 | 不把年龄提前写入登记请求 | 产品/owner | 否 |
| SAMPLE-04-MMP · 确认本次登记 | Journey §3.5 | 顾客确认MMP移动主屏当前姓名和电话 | 当前确认页按钮 | owner按operation identity复核，不按当前屏上残留文本猜目标 | 产品/owner | 否 |
| SAMPLE-04-MMP · 拒绝本次登记 | Journey §3.5 | 顾客指出MMP移动主屏当前登记信息有误 | 当前确认页按钮 | 仅终结当前pending，不删除已有成员 | 产品/owner | 否 |
| SAMPLE-04-MMP · 交还店员（仅handheld-confirm） | Journey §3.5 | 单屏顾客要求返回店员继续处理 | 同一确认页条件按钮 | 只在既有单屏模式出现，owner绑定当前操作 | 产品/owner | 否 |
| SAMPLE-05-LMP · 输入可选年龄 | Journey §3.5 | 顾客核对无LMS的LMP主屏本次登记时补充年龄 | 当前确认页字段 | 不把年龄提前写入登记请求 | 产品/owner | 否 |
| SAMPLE-05-LMP · 确认本次登记 | Journey §3.5 | 顾客确认无LMS的LMP主屏当前姓名和电话 | 当前确认页按钮 | owner按operation identity复核，不按当前屏上残留文本猜目标 | 产品/owner | 否 |
| SAMPLE-05-LMP · 拒绝本次登记 | Journey §3.5 | 顾客指出无LMS的LMP主屏当前登记信息有误 | 当前确认页按钮 | 仅终结当前pending，不删除已有成员 | 产品/owner | 否 |
| SAMPLE-05-LMP · 交还店员（仅handheld-confirm） | Journey §3.5 | 单屏顾客要求返回店员继续处理 | 同一确认页条件按钮 | 只在既有单屏模式出现，owner绑定当前操作 | 产品/owner | 否 |
| SAMPLE-06-LMS · 输入可选年龄 | Journey §3.5 | 顾客在LMS确认主机当前待确认会员 | 当前host secondary确认面 | 只处理host pending，不读取LSP pending | 产品/owner | 否 |
| SAMPLE-06-LMS · 确认本次登记 | Journey §3.5 | 顾客在LMS确认主机当前待确认会员 | 当前host secondary确认面 | 只处理host pending，不读取LSP pending | 产品/owner | 否 |
| SAMPLE-06-LMS · 拒绝本次登记 | Journey §3.5 | 顾客在LMS确认主机当前待确认会员 | 当前host secondary确认面 | 只处理host pending，不读取LSP pending | 产品/owner | 否 |
| SAMPLE-07-MMP · 选择壁纸单选项（无/山景/湖景/海滩） | Journey §3.6 | MMP管理员/店员选择当前物理内容面的壁纸 | 当前picker单一Radio组 | 选项来自固定目录，主副机各写本机owner | 产品/owner | 否 |
| SAMPLE-07-MMP · 确认当前壁纸 | Journey §3.6 | MMP用户提交本端壁纸选择 | 同页确认 | 以本地wallpaper selector读回，不由LMS或peer猜测 | 产品/owner | 否 |
| SAMPLE-07-MMP · 店员登出 | Journey §3.6及需求R-09 | 店员结束本机staff session | 同一壁纸页独立登出按钮 | 复用staff logoutCommand；退出页不代替登出；失败保留当前session与页面并显示错误 | 需求/owner | 否 |
| SAMPLE-08-LMP · 选择壁纸单选项（无/山景/湖景/海滩） | Journey §3.6 | LMP管理员/店员选择当前物理内容面的壁纸 | 当前picker单一Radio组 | 选项来自固定目录，主副机各写本机owner | 产品/owner | 否 |
| SAMPLE-08-LMP · 确认当前壁纸 | Journey §3.6 | LMP用户提交本端壁纸选择 | 同页确认 | 以本地wallpaper selector读回，不由LMS或peer猜测 | 产品/owner | 否 |
| SAMPLE-08-LMP · 退出壁纸选择 | Journey §3.6 | LMP用户结束当前选择流程 | 当前页退出选择 | 只结束picker，不改变已确认壁纸且不登出staff | 产品/owner | 否 |
| SAMPLE-08-LMP · 店员登出 | Journey §3.6及需求R-09 | 店员结束本机staff session | 同页独立登出按钮 | 复用staff logoutCommand；不得用exit替代；失败保留当前session与页面并显示错误 | 需求/owner | 否 |
| SAMPLE-10-LSP · 选择壁纸单选项（无/山景/湖景/海滩） | Journey §3.6 | LSP管理员/店员选择当前物理内容面的壁纸 | 当前picker单一Radio组 | 选项来自固定目录，主副机各写本机owner | 产品/owner | 否 |
| SAMPLE-10-LSP · 确认当前壁纸 | Journey §3.6 | LSP用户提交本端壁纸选择 | 同页确认 | 以本地wallpaper selector读回，不由LMS或peer猜测 | 产品/owner | 否 |
| SAMPLE-10-LSP · 退出壁纸选择 | Journey §3.6 | LSP用户结束当前选择流程 | 当前页退出 | 退出不改变已确认壁纸 | 产品/owner | 否 |
| SAMPLE-09-LMS · 查看主机已确认壁纸 | Journey §3.6 | 顾客查看主机已确认画面 | 全画布只读显示 | LMS不显示待选值或新增操作 | owner | 否 |
| MASK-01 · 触发本机admin launcher | Journey §3.4、§3.7 | LSP失联后管理员仍需修复配对 | 遮罩上层保留现有launcher手势 | 不解除遮罩、不放行业务操作 | 产品/owner | 否 |

只读引导 AUTH-03/AUTH-04、只读配置 ADMIN-03、只读壁纸 SAMPLE-09 与遮罩状态文本没有 mutation；它们已单列为 `N/A`，未把只读观察伪装成可执行操作。

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| ACT-01/02 | public独立TER | 主机未激活且hydration ready | terminal activation edge operations | terminal-data-client activate command / activation selector | server凭证、设备绑定和结果身份 |
| ACT-03/04 | public独立TER | 未激活副显示面 | 无 | integration引导selector | 是否主机/副机由device+topology owner判定 |
| ADMIN-01 | public独立TER admin | 本机admin认证且host资格 | 既有activation API | client cancel command / activation selector | 只有host可取消且业务错误由owner定 |
| ADMIN-02/03 | public独立TER admin | local admin；编辑仅host或未配对机 | 无后台HTTP | server-config commands/selectors | 配置校验、持久化、密文/明文策略由config owner决定 |
| ADMIN-04 | public独立TER admin | local admin认证 | 无 | topology commands/selectors | pair身份、并发、ready与退配边界由topology owner决定 |
| AUTH-01/02 | public独立TER | host active、topology ready | sample staff login endpoint | sample-staff-session command/selector | 登录资格与会话由staff owner判定 |
| AUTH-03/04 | public独立TER | 副面或副机 | 无 | projected staff selector | 副机不独立登录 |
| SAMPLE-01/02/04/05 | public独立TER | 当前host staff session | 无member HTTP | member commands/selectors | pending identity、并发与集合写入由member owner判定 |
| SAMPLE-03 | public独立TER | LSP host資格 projection、连接与投影ready | 无member HTTP | branch local command + explicit host member command | 当前peer身份、pending发起端与迟到结果由owner判定 |
| SAMPLE-06 | public独立TER | 有效host staff session与host pending | 无 | host member command/selector | 当前operation identity与年龄业务规则 |
| SAMPLE-07/08/10 | public独立TER | 当前端staff/admin准入及ready | 无 | local wallpaper command/selector | 设备本地confirmed/pending归属 |
| SAMPLE-09 | public独立TER | LMS当前host workspace | 无 | host confirmed wallpaper selector | 不读取pending、不接受写操作 |
| MASK-01 | public独立TER overlay | LSP且连接/投影未ready | 无 | topology readiness selectors；本机admin launcher | 当前peer/revision是否足以解除遮罩 |

## 8. Manifest B.4/B.5 命中对照

该Journey不是 platform-admin 或 operations-admin app；manifest 中针对后台HTTP、RTK Query、后台登录页 ProComponents 与后台Drawer的逐条条款均不适用。适用于本专项的终端架构与交互要求由 `doc/platform/terminal-coding-standard.md` TR-16/TR-17 和 `doc/platform/frontend-coding-standard.md` 中终端边界引用覆盖；本表保留 manifest 检索事实，供 reviewer 检查未遗漏。

| manifest条文 | 命中或不适用理由 | 遵循方式 / 待Dexter裁决 | Heritage原文（冻结路径@hash） |
| --- | --- | --- | --- |
| B.4 | 本工件是 `apps/terminal` 独立 public runtime，不属后台 app；后台 data fetching、Drawer lifecycle、登录壳条文N/A | 终端selector/command按TER coding standard与owner boundaries | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md@597a87741247b7abf600486087539d614f501e7b53ff031a635f387213b2e03b` |
| B.5 | 后台后台交互治理不直接适用；TER为原生/Expo与adapter场景 | 逐screen低保真、TR-16相同场景Web→VM及owner可见状态 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/runtime-source-organization-must-not-follow-journey-ids.md@f88855cc3583026ad6edf7afb3e729c46705ea5f30fa7d635acd6784db9c236a` |

## 9. 可选：高保真静态 demo

```text
HIGH_FIDELITY_DEMO=NOT_REQUIRED
REASON=当前已获Dexter接受整体方向，争议集中在owner、权限和状态时序；低保真ASCII线框足以审查路径和surface边界。没有新交互范式或需用视觉稿裁决的文案；制作高保真demo会提前消耗review时间且不能代替owner/selector判据。
DEMO_PATH=N/A
DEMO_DATA=N/A
```

## 10. Dexter 看图结论

- 看图日期：2026-10-02
- 低保真线框结论：`ACCEPTED_DIRECTION`（整体交互方向已接受；不是逐屏细节接受）
- 高保真 demo 结论：`NOT_REQUIRED`
- 已接受方向：四面激活/登录、共享本机admin状态/配置/拓扑tab、断链时本机admin恢复、LSP独立会员与壁纸、LMS显示主机投影。
- 仍待Dexter与Claude复核：R2已review修订前的26屏静态设计；本次S-1～S-6/N-1处置及其同步修订后的整体文档尚未取得独立 verdict。真实渲染、控件/testId、状态运行和owner行为仍未验证；不得将方向接受读作实现授权或动态PASS。
- 允许进入 implementation-facing design：是；允许源码实施/运行：否。

## 10.1 前端管理一致性适用性

`MANAGEMENT_UI_CONSISTENCY=NOT_APPLICABLE_WITH_REASON`：26个 screen 均属于独立TER public UI，不属于 `platform-admin` 或 `operations-admin`，不使用 admin-ui-foundation 的后台登录、Drawer或RTK Query模式。本机admin console 使用 `apps/terminal/ui/base/admin-shell`，其输入、手势、焦点与容器按 `doc/platform/terminal-coding-standard.md` TR-16/TR-17、§4-D/§4-E约束；不得套后台§3-K例外。

## 11. 明确不画或不新增的内容

- 不增加公开登录后台、HTTP 管理页、终端组/门店输入、设备型号编辑器、主副机切换按钮或副机激活/取消入口。
- 不把密码回显、会员草稿、peer cache 或 admin 状态添加成一份独立的 UI-owned state。
- 不在断链时放行业务操作；不把 admin 关闭当成配对恢复。
- 不新增确认弹层来包裹已裁决 command；是否已有必须确认的既有 owner 流程，以当前 source 核对后在详设精确说明。

## 12. 已接受方向与仍待审的细节

Dexter 已接受整体交互方向。R2 对修订前字节的 verdict 为 NO-GO；本轮按 intake 修订 S-1～S-6/N-1 并同步相关设计文档。修订后字节仍交 Dexter 与 Claude 独立复核；真实渲染、控件/TestId 及运行行为均未验证。

```text
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-10-02（仅整体方向；逐屏细节仍待审）
DEXTER_HIFI_REVIEW=NOT_REQUIRED
```
