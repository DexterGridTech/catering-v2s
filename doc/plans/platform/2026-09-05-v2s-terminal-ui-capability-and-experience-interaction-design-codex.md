# TER sample UI 能力与体验：交互详设

## 1. 工件元数据

JOURNEY_DECISION=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md#13-我替-Dexter-做的裁定
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md
BUSINESS_PROBLEM=让门店会员登记在单屏与双屏、成功与失败、确认与撤回之间都可继续
BUSINESS_USER_OR_OWNER=店员与顾客；sample-member-registry / sample-staff-session owner
CURRENT_TASK=完成一条可反悔、可恢复、可观察的门店会员登记旅途
SUCCESS_OUTCOME=店员和顾客始终知道下一步；单屏不出现副屏动作；失败不静默
UI_BEARING=true
SKILL_USED=cs-spec-to-plan@本仓冻结版本；cs-writing-plans@本仓冻结版本
DEXTER_WIREFRAME_REVIEW=UNSET
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=terminal sample

本文是 implementation-facing 交互输入，不重新修改需求正本，也不把视觉 token 伪装成
产品裁决。X-8 保持撤回结论：waiting-confirm 是 layer，新增姓名、电话、撤回；其
layer 覆盖与模态行为由 render 详设承接。

## 1.1 UI 详设强制标准

本工件对每个 user-facing screen、layer 和 technical host 都逐项给出：
UI_SURFACE、HOST_AND_ENTRY、ACTOR、BUSINESS_GOAL、USER_VISIBLE_COPY、
TECHNICAL_BOUNDARY、FOUNDATION_PRIMITIVE、CONTAINER_LAYOUT、状态边界和动作
testID。一个 screen 不画 sibling surface；副屏动作不会出现在单屏线框。

本专题的 `CONSUMER_FACE` 不是两个管理后台，也不是 public Web 后台；统一写作
`terminal-sample (NOT_APPLICABLE_WITH_REASON: TER sample host)`。`FOUNDATION_PRIMITIVE`
逐屏写 TER 自有 `ui/base/primitives` export；admin-ui-foundation 对该 consumer face
不适用，不以名字相近的后台原语冒充复用。

### 1.1.1 逐屏 surface contract

| IA-ID | CONSUMER_FACE / UI_SURFACE | HOST_AND_ENTRY | ACTOR / BUSINESS_SCENARIO | BUSINESS_GOAL | USER_VISIBLE_COPY | TECHNICAL_BOUNDARY | FOUNDATION_PRIMITIVE | CONTAINER_LAYOUT |
|---|---|---|---|---|---|---|---|---|
| IA-SAMPLE-AUTH-LOGIN | terminal-sample / 独立 screen | 初始 PRIMARY main | 店员 / 尚未登录 | 进入工作台 | 店员登录、工号、密码、登录、登录中 | session owner 最终核验凭据；不显示 session/request | PrimitiveContainer、Heading、Label、Input、Button、Status | 单一纵向内容区；输入与操作区不溢出；无 sibling surface |
| IA-SAMPLE-AUTH-NOTICE | terminal-sample / Modal layer | login rejection 后 PRIMARY overlay | 店员 / 凭据被拒 | 理解并关闭业务提示 | 工号或密码不正确、关闭 | reasonCode 在 auth feature 映射；不显示 raw error | feature DialogSurface/DialogActions + PrimitiveText/Button | render 覆盖全 surface；层内无第二滚动祖先 |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | terminal-sample / Modal layer | auth dispatch system failure 后 PRIMARY overlay | 店员 / 操作未完成 | 得到可继续的设施失败出口 | 操作没有完成，请重试、知道了 | operation allowlist；不显示 raw error/payload | feature DialogSurface/DialogActions + PrimitiveText/Button | 短卡片居中；遮罩覆盖底层；不横溢出 |
| IA-SAMPLE-DESK-MEMBER-LIST | terminal-sample / 独立 screen | login success/restore 后 PRIMARY | 店员 / 已进入工作台 | 查看、开始新增或退出 | 已登记会员、暂无会员、新增、新增会员、退出 | registry selector 是唯一读取；session owner 处理退出 | PrimitiveContainer、Heading、Text、Button、Actions、Status；feature ScrollArea | 仅列表区域滚动；表头与操作区固定；长行不撑宽 |
| IA-SAMPLE-DESK-MEMBER-FORM | terminal-sample / 独立 screen | memberFormOpenedCommand 后 PRIMARY | 店员 / 新增会员 | 录入待确认资料 | 新增会员、姓名、电话、提交、取消、提交中 | registry owner 最终校验；draft 在 ui-state | PrimitiveContainer、Heading、Label、Input、Button、Status；feature ScrollArea | 表单内容唯一滚动祖先；操作区可见；不出现页面+表单双滚动 |
| IA-SAMPLE-DESK-WAITING-CONFIRM | terminal-sample / standard layer | pending+secondary 后 PRIMARY layer | 店员 / 等待顾客确认 | 查看待确认资料并撤回 | 已提交，等待顾客确认、姓名、电话、撤回 | pending selector 唯一来源；撤回由 registry owner 判定 | feature DialogSurface/DialogActions + PrimitiveText/Button | 覆盖 member-list；底层不可交互；短内容不滚动 |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | terminal-sample / alert layer | customer rejected 后 PRIMARY layer | 店员 / 顾客拒绝登记 | 选择下一步 | 顾客拒绝了登记、修改后重试、放弃本次 | reasonCode/registry event 由 owner 产生；不可 dismiss | feature DialogSurface/DialogActions + PrimitiveText/Button | decisive 卡片覆盖主屏；两个动作始终可见 |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | terminal-sample / alert layer | dirty cancel/logout 后 PRIMARY layer | 店员 / 有未完成草稿 | 明确是否丢弃 | 放弃本次录入？或退出登记工作台？继续填写、放弃 | intent 只由 actor 路由；通用控件不接 intent | feature DialogSurface/DialogActions + PrimitiveText/Button | decisive 卡片不被遮罩/back 关闭；动作区不溢出 |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | terminal-sample / alert layer | 双屏 waiting 的 withdraw 后 PRIMARY layer | 店员 / 顾客尚未决策 | 明确是否撤回 | 撤回这次登记？继续等待、撤回 | 仅双屏可达；pending 存在性由 owner 复核 | feature DialogSurface/DialogActions + PrimitiveText/Button | 只在 PRIMARY；单屏不注册、不渲染 |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | terminal-sample / alert layer | desk dispatch system failure 后 PRIMARY layer | 店员 / 命令未完成 | 获知失败并继续 | 操作没有完成，请重试、知道了 | desk operation allowlist；观察失败只诊断 | feature DialogSurface/DialogActions + PrimitiveText/Button | dismissible 遮罩覆盖主屏；不出现在 SECONDARY |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | terminal-sample / 独立 screen | authenticated/idle 且有 secondary | 顾客 / 等待店员 | 知道当前在等待 | 欢迎，请等待店员操作 | 无业务写入；host 不复制 store | PrimitiveContainer、Text、Status | SECONDARY 固定逻辑画布；内容按比例；无动作列 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | terminal-sample / 独立 screen view | form opened 且有 secondary | 顾客 / 核对录入信息 | 核对资料 | 请核对会员信息、姓名、电话、等待店员提交登记 | ui variables 实时读取；只读 | PrimitiveContainer、Heading、Text、Status | SECONDARY 单一内容列；无 alert/操作区 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | terminal-sample / 独立 screen view | pending 且有 secondary | 顾客 / 做最终决定 | 确认或拒绝 | 请确认登记、姓名、电话、确认、拒绝 | registry owner 判定 pending 与竞态 | PrimitiveContainer、Heading、Text、Actions、Button | SECONDARY 竖向居中；动作区不横溢出 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | terminal-sample / 独立 screen view | pending 且无 secondary | 顾客/店员 / 单屏设备交接 | 决定或交还 | 请确认登记、姓名、电话、确认、拒绝、交还店员 | actor 给 mode；component 不读屏数 | PrimitiveContainer、Heading、Text、Actions、Button | 只有 PRIMARY；不生成 SECONDARY、不显示 withdraw-confirm |
| IA-SAMPLE-HOST | terminal-sample / technical host | Expo App entry | 开发者 / 观察单/双 surface | 观察同一 runtime 的 surface 切换 | 单屏、双屏、切换屏幕形态（宿主文案） | host 只持 platform ports/toggle，不持业务 state | NONE_WITH_REASON: technical host 不消费业务 primitive；surface 内部仍用 TER primitives | 外壳按 terminalSurfaces 固定画布；一/两棵 surface 宽度在画布内对齐 |

### 1.1.2 Surface ownership 自检

| IA-ID | 线框可见元素分母 | 每项是否属于当前 surface | USER_VISIBLE_COPY 是否有位置 | 结论 |
|---|---|---|---|---|
| IA-SAMPLE-AUTH-LOGIN | 标题、2 输入、登录、loading | 是 | 是 | PASS |
| IA-SAMPLE-AUTH-NOTICE | 消息、关闭 | 是 | 是 | PASS |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | 消息、知道了 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-MEMBER-LIST | 标题、行、空态、3 操作 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-MEMBER-FORM | 标题、2 输入、2 操作、loading | 是 | 是 | PASS |
| IA-SAMPLE-DESK-WAITING-CONFIRM | 消息、姓名、电话、撤回 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | 消息、重试、放弃 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | 消息、继续、放弃 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | 消息、继续、撤回 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | 消息、知道了 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | 等待文案 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | 标题、姓名、电话、等待状态 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | 标题、姓名、电话、2 操作 | 是 | 是 | PASS |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | 标题、姓名、电话、3 操作 | 是 | 是 | PASS |
| IA-SAMPLE-HOST | 宿主切换控件与固定画布 | 是 | 是 | PASS |

## 2. Interaction map

| 顺序 | 前提 | route / surface | 用户目的 | 可见信息与操作 | owner/readback | 成功去向 | 失败/退出恢复 |
|---:|---|---|---|---|---|---|---|
| 1 | anonymous | PRIMARY / auth.login | 店员登录 | 工号、密码、登录 | staff-session owner | member-list | 业务失败 auth.notice；基础设施失败 auth.system-notice |
| 2 | authenticated | PRIMARY / member-list | 查看会员或开始新增 | 会员行、新增、退出 | member-registry selector | member-form 或 login | 空态新增；退出有值时 discard-confirm |
| 3 | authenticated | PRIMARY / member-form | 录入姓名电话 | 两个输入、提交、取消 | ui-state draft + registry command | 双屏 waiting layer + customer preview/confirm；单屏 customer handheld | 取消/退出走 discard-confirm；设施失败 system-notice |
| 4 | form submitted + secondary | PRIMARY layer waiting-confirm + SECONDARY customer-member preview→confirm | 店员等待，顾客确认 | 姓名电话、撤回；顾客确认/拒绝 | pending selector + registry owner | confirmed→list/welcome；rejected→registry-notice | withdraw-confirm；竞态先到者赢 |
| 5 | form submitted + no secondary | PRIMARY customer-member handheld-confirm | 顾客确认或交还店员 | 确认、拒绝、交还店员 | pending selector + registry owner | confirm→list；reject→member-form + registry-notice；hand-back→form/recovery | 无副屏层；设施失败 desk.system-notice |
| 6 | customer rejected | PRIMARY registry-notice | 选择修改或放弃 | 修改后重试、放弃本次 | member-desk actor | form 或 list | 不允许 dismiss；命令失败 system-notice |
| 7 | any decisive layer | PRIMARY modal | 做出必须选择的决定 | keep/discard、keep/withdraw | feature actor + ui-state layer | 原 screen 或下一个 owner state | 遮罩/返回键不绕过 |
| 8 | any dismissible layer | PRIMARY alert | 读懂告知并继续 | 关闭/知道了 | feature actor | 原 screen | 观察失败只记诊断 |
| 9 | authenticated + no pending | PRIMARY member-list | 退出工作台 | 退出 | staff-session owner | login | 有未完成草稿先确认；waiting 中无退出入口 |

### 2.1 L2/automation 前控件分母

本批没有 L2、浏览器自动化或 automation backend 授权；因此不创建 locator binding，
也不虚构 app `*TestIds.ts` 文件。下表仍冻结真实动作节点与稳定 testID，供未来另行
授权时从组件 contract 生成/对账；所有动作必须落在 primitives 真实节点上。

```text
UI_DESIGN_REVIEW=PASS
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:本批不授权L2/浏览器自动化；以下testID只冻结交互身份
L2_SCRIPT_ADMISSION=BLOCKED
```

| case/action | 用户控件与动作 | UI owning surface | 稳定 testID 分母 | 实际动作节点 | UI focused/static proof | 结论 |
|---|---|---|---|---|---|---|
| login | 填工号、填密码、登录 | IA-SAMPLE-AUTH-LOGIN | `:operator-name`、`:passcode`、`:submit` | PrimitiveInput/PrimitiveButton native node | StaffLogin focused + feature static | DESIGN_ONLY_L2_BLOCKED |
| auth failure | 关闭业务提示、关闭设施提示 | IA-SAMPLE-AUTH-NOTICE / AUTH-SYSTEM-NOTICE | `:dismiss` 各一 | DialogActions 内 PrimitiveButton native node | layer focused + guard static | DESIGN_ONLY_L2_BLOCKED |
| member list | 新增、空态新增、退出、读取会员行 | IA-SAMPLE-DESK-MEMBER-LIST | `:add`、`:empty-action`、`:logout`、`:row` | PrimitiveButton/row native action node | list focused + selector static | DESIGN_ONLY_L2_BLOCKED |
| member form | 填姓名、填电话、提交、取消 | IA-SAMPLE-DESK-MEMBER-FORM | `:name`、`:phone`、`:submit`、`:cancel` | PrimitiveInput/PrimitiveButton native node | form focused + draft static | DESIGN_ONLY_L2_BLOCKED |
| pending | 撤回、继续等待、确认撤回 | IA-SAMPLE-DESK-WAITING-CONFIRM / WITHDRAW-CONFIRM | `:withdraw`、`:keep`、`:withdraw` | layer DialogActions 内 native node | guard/竞态 focused | DESIGN_ONLY_L2_BLOCKED |
| rejected | 修改后重试、放弃本次 | IA-SAMPLE-DESK-REGISTRY-NOTICE | `:retry`、`:abandon` | PrimitiveButton native node | rejection focused | DESIGN_ONLY_L2_BLOCKED |
| customer decision | 确认、拒绝、交还店员 | customer-member three mode | `:confirm`、`:reject`、`:hand-back` | PrimitiveButton native node | mode/actor focused | DESIGN_ONLY_L2_BLOCKED |
| host | 切换单双屏 | IA-SAMPLE-HOST | host-specific control IDs | host native/web control node | host focused/static | DESIGN_ONLY_L2_BLOCKED |

## 3. screen/layer surface roster

每个 screen/layer 都必须有自己的 surface owner。线框只画当前 surface，不把 sibling
screen 或另一层画进来。以下是实现时必须保持的 15 个 IA-ID；partKey 分母见 IA 详设。

| screen id | UI_SURFACE | HOST_AND_ENTRY | ACTOR | BUSINESS_GOAL | CONTAINER_LAYOUT |
|---|---|---|---|---|---|
| IA-SAMPLE-AUTH-LOGIN | 独立 screen | 初始 PRIMARY main | 店员 | 进入工作台 | 单一纵向内容区；输入与登录操作不溢出 |
| IA-SAMPLE-AUTH-NOTICE | Modal layer | login rejection | 店员 | 读懂登录失败并关闭 | render 覆盖全 surface；层内无二级滚动 |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | Modal layer | auth request rejection | 店员 | 知道操作未完成并可重试 | 同上；短文案卡片 |
| IA-SAMPLE-DESK-MEMBER-LIST | 独立 screen | login success / restore | 店员 | 查看、添加、退出 | 仅列表区滚动；操作区不随集合滚走 |
| IA-SAMPLE-DESK-MEMBER-FORM | 独立 screen | memberFormOpenedCommand | 店员 | 录入待确认会员 | 表单唯一滚动祖先；提交/取消可见 |
| IA-SAMPLE-DESK-WAITING-CONFIRM | Standard layer | pending + secondary | 店员 | 看到待确认对象并撤回 | render 覆盖；底层不可交互 |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | Alert layer | memberRejected | 店员 | 选择修改或放弃 | decisive 卡片；两个动作不折叠 |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | Alert layer | cancel/logout with draft | 店员 | 明确是否丢弃 | decisive；遮罩/返回键不关闭 |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | Alert layer | waiting withdraw | 店员 | 明确是否撤回 | 仅 hasSecondarySurface 分支 |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | Alert layer | desk request rejection | 店员 | 获知设施失败 | dismissible；只在 PRIMARY |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | 独立 screen | authenticated/idle secondary | 顾客 | 知道等待店员 | SECONDARY 固定逻辑尺寸 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | 独立 screen | form opened + secondary | 顾客 | 核对信息 | 只读信息列 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | 独立 screen | pending + secondary | 顾客 | 确认/拒绝 | 信息列+两个动作 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | 独立 screen | pending + no secondary | 顾客与店员 | 确认、拒绝或交还 | 单一 PRIMARY，不生成 SECONDARY |
| IA-SAMPLE-HOST | technical host | Expo App entry | 开发者 | 切换一/两棵 surface 观察同一 runtime | 固定 terminalSurfaces 画布；外壳不拥有业务状态 |

## 4. v2 对应页面盘点

本专题是当前 TER terminal sample 的新增能力，未从 all-v2 继承业务 screen。
按 carry-over-first 的检查范围检索 all-v2 后，本批每一项均为
NO_V2_COUNTERPART；不选择 all-v2 页面作为 runtime/build fallback。v13 current source
只作为 terminal sample baseline，不冒充 heritage 摹本。

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
|---|---|---|---|---|
| 全部 15 个 IA-ID | NO_V2_COUNTERPART | `PENDING_HERITAGE_REGISTRATION`（检索范围：`doc/heritage/registry.json`、已选 frozen Heritage 目录、v13 terminal source；未发现对应 screen） | 以 v13 terminal source 与本工件文本线框为基线 | 新专题；不得从 admin UI 或 POS 原型反推；没有 counterpart 就不伪造 path@hash |

## 5. 低保真线框与可见契约

以下文本线框只表达当前 surface 的可见元素。它们不是高保真视觉稿；theme token
与响应比例在段 3/4 详设落地。每个 layer 的卡片由 feature-local DialogSurface
组合 existing primitives，不把业务 props 下沉到 primitives。

### 5.1 登录与登录提示

IA-SAMPLE-AUTH-LOGIN

    店员登录
    工号       [________________]
    密码       [________________]
               [登录]
    (提交中)   登录中

USER_VISIBLE_COPY=店员登录、工号、密码、登录、登录中
UI_SURFACE=独立 screen; ACTOR=店员
testID=sample.auth.login:operator-name、:passcode、:submit、:loading
STATE=anonymous→submitting→authenticated 或 auth.notice/auth.system-notice

IA-SAMPLE-AUTH-NOTICE / IA-SAMPLE-AUTH-SYSTEM-NOTICE

    [提示卡]
    工号或密码不正确       [关闭]
    或
    操作没有完成，请重试     [知道了]

USER_VISIBLE_COPY=业务失败“工号或密码不正确/登录未完成，请重试”；设施失败“操作没有完成，请重试”
GUARD=两者 dismissible；遮罩与返回键可以关闭
testID=sample.auth.notice:message、:dismiss；sample.auth.system-notice:message、:dismiss

### 5.2 店员列表与表单

IA-SAMPLE-DESK-MEMBER-LIST

    已登记会员
    ┌──────────────────────────────┐
    │ [姓名]  [电话]                │  ← 唯一滚动区域
    │ ...                          │
    │ 空态：暂无会员 [新增会员]      │
    └──────────────────────────────┘
    [新增]                         [退出]

testID=sample.desk.member-list:row、:add、:empty、:empty-action、:logout
ACTION_DENOMINATOR=新增、退出；空态新增只在零条记录时出现

IA-SAMPLE-DESK-MEMBER-FORM

    新增会员
    姓名       [________________]
    电话       [________________]
               [提交] [取消]
    (提交中)   提交中

testID=sample.desk.member-form:name、:phone、:submit、:cancel、:loading
STATE=草稿在 ui-state；submit 进入 pending；cancel/exit 有值时开 discard-confirm

### 5.3 等待、拒绝与决定层

IA-SAMPLE-DESK-WAITING-CONFIRM

    [等待确认]
    已提交，等待顾客确认
    姓名：【会员姓名】
    电话：【会员电话】
    [撤回]

testID=sample.desk.waiting-confirm:message、:member-name、:member-phone、:withdraw
SURFACE=PRIMARY standard layer；只有双屏路径可以到达撤回确认

IA-SAMPLE-DESK-REGISTRY-NOTICE

    [登记未完成]
    顾客拒绝了登记
    [修改后重试] [放弃本次]

testID=sample.desk.registry-notice:message、:retry、:abandon
GUARD=alert + decisive；没有 dismiss

IA-SAMPLE-DESK-DISCARD-CONFIRM

    [请确认]
    放弃本次录入？ 或 退出登记工作台？
    [继续填写] [放弃]

testID=sample.desk.discard-confirm:message、:keep、:discard
PROPS=只由 feature actor 读取 intent；DialogSurface 不接收 intent

IA-SAMPLE-DESK-WITHDRAW-CONFIRM

    [请确认]
    撤回这次登记？
    [继续等待] [撤回]

testID=sample.desk.withdraw-confirm:message、:keep、:withdraw
REACHABILITY=仅 hasSecondarySurface=true；单屏不注册、不渲染

IA-SAMPLE-DESK-SYSTEM-NOTICE

    [系统提示]
    操作没有完成，请重试
    [知道了]

testID=sample.desk.system-notice:message、:dismiss
GUARD=alert + dismissible；raw Error、payload、手机号均不可见

### 5.4 顾客三种 mode

IA-SAMPLE-DESK-CUSTOMER-WELCOME

    欢迎，请等待店员操作

IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW

    请核对会员信息
    姓名：【姓名值】
    电话：【电话值】
    等待店员提交登记

testID=sample.desk.customer-member:title、:name、:phone、:waiting

IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM

    请确认登记
    姓名：【姓名值】
    电话：【电话值】
    [确认] [拒绝]

testID=sample.desk.customer-member:title、:name、:phone、:actions、:confirm、:reject
DISPLAY=SECONDARY，仅双屏

IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM

    请确认登记
    姓名：【姓名值】
    电话：【电话值】
    [确认] [拒绝] [交还店员]

testID=sample.desk.customer-member:title、:name、:phone、:actions、:confirm、:reject、:hand-back
DISPLAY=PRIMARY，仅单屏

## 6. 表单控件依赖图

| screen | 控件 | 初始值 | 上游依赖 | 级联清理 | loading/failed | owner 最终复核 |
|---|---|---|---|---|---|---|
| auth.login | 工号 | sample.login.operator-name | 无 | logout/anonymous 由 session actor 清理 | login 中禁用；失败 auth notice | staff-session |
| auth.login | 密码 | sample.login.passcode | 无 | 登录失败清除密码；设施失败保留 | login 中禁用 | staff-session |
| member.form | 姓名 | sample.member.name | 无 | confirmed/abandon 清理；retry 保留 | submit 中禁用；设施失败保留 | member-registry |
| member.form | 电话 | sample.member.phone | 无 | 同上 | 同上 | member-registry |
| customer.member | 姓名/电话 | pending selector 或 ui variable | mode 由 actor 给定 | pending 终结后由 actor 清理 | confirm/reject 中禁用 | member-registry |

## 7. Mutation fact matrix

| command variant | 用户动作 | request facts | 变更与失败恢复 |
|---|---|---|---|
| login | 登录 | operatorName、passcode、显式 requestId | 成功 session；业务失败 auth notice；设施失败 auth system notice |
| submitMember | 提交 | name、phone、显式 requestId | pending；失败保留 draft |
| confirmMember | 确认 | pending identity、显式 requestId | member confirmed；竞态晚到 no-op |
| rejectMember | 拒绝 | pending identity、显式 requestId | registry notice；draft 仍可 retry |
| memberSubmissionWithdrawn | 撤回/交还 | pending identity、显式 requestId | pending 清除；双屏回 form，单屏回 operator recovery |
| memberRegistrationRetryRequested | 修改后重试 | reason context、显式 requestId | 关闭 notice，保留 draft，回 form |
| memberRegistrationAbandoned | 放弃本次 | 显式 requestId | 关闭 notice，清 draft，回 list |
| memberDraftDiscarded | 确认放弃 | intent 由 actor 读取，不进通用控件 | 清 draft 或执行 logout |
| authSystemFailureObserved | 登录/退出设施失败观察 | operation、显式 requestId；不带 raw error/payload | 由 staff-auth actor 开 auth.system-notice；原业务状态保留 |
| authSystemFailureDismissed | 关闭 auth system notice | 显式 requestId；不带原失败对象 | 关闭 auth.system-notice；不清 session/form |
| deskSystemFailureObserved | 提交/确认/拒绝/退出设施失败观察 | operation、显式 requestId；不带 raw error/payload | 由 member-desk actor 开 desk.system-notice；原 draft/pending 按动作规则保留 |
| deskSystemFailureDismissed | 关闭 desk system notice | 显式 requestId；不带原失败对象 | 关闭 desk.system-notice；允许用户重新发起原动作 |

## 7.1 SEARCH_CAPABILITY_DENOMINATOR

| screen / business object / user question | 判定 | 原因与最低观察 |
|---|---|---|
| 15 个 IA-ID 全集 | `NOT_APPLICABLE_WITH_REASON` | 本 Journey 没有搜索框、筛选、候选选择或级联候选；member-list 是 bounded sample 的直接 readback，姓名/电话是新会员输入而不是查询条件，customer surface 只读单一 pending。`[静态]` 搜索 feature/integration 生产源码不得出现 search/filter/candidate query 协议；`[focused]` 0/1/many fixture 只改变列表渲染，不产生候选查询或客户端搜索分支。 |

不得因为 member-list 有多行就新增搜索能力；如果未来业务引入按姓名/电话查找，
须先有 owner task-read 与 Dexter 裁定，再另起设计，不在本批把全量列表伪装成搜索。

## 8. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner |
|---|---|---|---|---|---|---|---|
| login | fields editable | owner validation | loading text + disabled | member-list | auth.notice | auth.system-notice | staff-session |
| submit | draft visible | owner validation | waiting path | pending | registry notice | desk system notice | member-registry |
| customer decision | pending visible | pending must exist | buttons disabled | confirm→list/welcome；reject→member-form + registry-notice | late action no-op | desk system notice | member-registry |
| cancel/logout | form/list | only dirty draft needs guard | command | list/login | decisive stays | system notice | member-desk |
| withdraw | waiting layer | pending must exist | confirmation layer | form/list | first arrival wins | system notice | member-desk + registry |
| retry/abandon | registry notice | decisive choice | command | form/list | no dismiss | system notice | member-desk |

## 9. 逐操作任务合理性

| 操作 | 来源 | 用户为何此时操作 | 更短路径 | 不选替代的理由 | 归因 |
|---|---|---|---|---|---|
| 新增 | v13 主路径 | 列表后开始登记 | 空态直接新增 | 不增加第二个入口 | Journey |
| 取消/退出 | X-3/X-7 | 防止丢失草稿 | 只有 dirty 时确认 | 无值无需打扰 | 产品语义 |
| 撤回 | X-1/X-6 | 顾客确认前纠错 | 双屏确认，单屏 hand-back | 单屏无第二个操作者 | display topology |
| 确认/拒绝 | v13 主路径 | 顾客最终决定 | 直接动作 | 顾客刚拒绝后不再二次确认 | registry owner |
| 重试/放弃 | X-2/X-7 | 拒绝后给明确去向 | 两出口直接决定 | dismiss 会留下无去向状态 | 产品语义 |
| 系统提示关闭 | §6 | 设施失败后继续 | 关闭后再次点原动作 | 不保存 command/payload 做自动重试 | 状态边界 |
| 返回键 | §7 | Android 习惯 | 只关闭 top dismissible | decisive 不能绕过 | render |

## 10. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | owner command/readback | 前端不可替代判定 |
|---|---|---|---|
| login | terminal sample | staff-session login | 凭据正确性 |
| member list/form | terminal sample | member-registry selectors/commands | 成员事实 |
| customer decision | terminal sample | pending selector + confirm/reject | pending 存在、先到者赢 |
| layers | terminal sample | ui-state open/close + feature commands | tier、guard、displayMode |
| theme/canvas | terminal sample | integration theme / terminalSurfaces | 应用身份与预览尺寸 |

## 11. v13 修订影响

| v13 条目 | 本详设落点 |
|---|---|
| 场景 8 | registry-notice 改为 retry/abandon；无 dismiss |
| §4.4 四处差异 | waiting withdraw 与 handheld hand-back；都在 actor 分支 |
| §6.9 testID | 第 5 节完整 roster |
| S-15 | type=6、partKey=7；不得写成单一数字 |
| S-16 / props | customer-member 三 mode；组件不读屏数 |
| P-11 | 每个 feature-owned public command 显式 requestId |
| P-12 | 新业务/观察/关闭命令加入 allowed-list；旧 noticeDismissed 删除 |
| layer 契约 | discard、withdraw、auth system、desk system 逐一声明 |
| actor/listener/link | implementation design 的 CP-4 表逐项实现 |
| layerId | 每个 layerId 等于正式 partKey；system 两个 key 分开 |

## 11. Manifest B.4/B.5 命中对照

| manifest 条文 | 本 Journey 的命中或不适用理由 | 遵循方式 / 待裁决 | Heritage 原文（冻结路径@hash） |
|---|---|---|---|
| B.4 管理后台 foundation | NOT_APPLICABLE_WITH_REASON：本专题是 terminal sample，不属于 platform-admin 或 operations-admin | 使用 TER 自有 ui/base/primitives 与 render | `PENDING_HERITAGE_REGISTRATION`：无对应 all-v2 screen |
| B.5 登录页专用 LoginFormPage | NOT_APPLICABLE_WITH_REASON：不是 Web admin 登录页 | 使用 terminal primitive Input/Button | `PENDING_HERITAGE_REGISTRATION`：无对应 all-v2 screen |
| B.4 状态/失败可见 | APPLICABLE | feature-owned system notice + render diagnostic | `PENDING_HERITAGE_REGISTRATION`：新 terminal 能力，无对应 all-v2 screen |
| B.5 automation | APPLICABLE_WITH_BOUNDARY | primitives 强制 testID；automation backend 本批押后 | `PENDING_HERITAGE_REGISTRATION`：新 terminal 能力，无对应 all-v2 screen |

Heritage path@hash 结论：本专题所有 screen 均为 `NO_V2_COUNTERPART`，因此没有可供
引用的 frozen all-v2 path@hash；上表的 `PENDING_HERITAGE_REGISTRATION` 是明确的
不适用结果，不是遗漏。v13 terminal source 只作为当前 TER 行为基线，不进入 Heritage
或 runtime/build fallback。

## 12. 完成判定

SCREEN_COUNT=15 IA-ID；其中 1 个是 technical host
ACTION_ROSTER=每个 user-facing surface 单独列出；single/double 分支不共享含糊断言
SECONDARY_RULE=所有“副屏回”只在 hasSecondarySurface 分支；单屏无 SECONDARY
LAYER_GUARD=6 种语义类型逐一声明，7 个 partKey 逐一注册
DEXTER_WIREFRAME_REVIEW=UNSET
INTERACTION_STATUS=READY_FOR_IMPLEMENTATION_INPUT；implementation-facing 设计已形成
INPUT_SOURCE_RESOLUTION=DEXTER_2026_09_05_RESOLVED：双屏与单屏通知出现后的屏切换已写入源交互设计；实现使用 `reject→member-form + registry-notice`，再由 retry/abandon 分流

## 13. Dexter 看图结论

- 看图日期：未发生；本轮只交低保真文本线框
- 低保真线框结论：`UNSET`
- 高保真 demo 结论：`NOT_REQUIRED`
- 允许进入 implementation-facing 实施：输入接缝已由 Dexter 解除；本工件仍不替代代码实施授权
