# TER sample UI 能力与体验 IA 详设

## 0. 元数据与授权边界

IA_DESIGN=2026-09-05-v2s-terminal-ui-capability-and-experience
IA_SCOPE=IA-SAMPLE-AUTH-LOGIN,IA-SAMPLE-AUTH-NOTICE,IA-SAMPLE-AUTH-SYSTEM-NOTICE,IA-SAMPLE-DESK-MEMBER-LIST,IA-SAMPLE-DESK-MEMBER-FORM,IA-SAMPLE-DESK-WAITING-CONFIRM,IA-SAMPLE-DESK-REGISTRY-NOTICE,IA-SAMPLE-DESK-DISCARD-CONFIRM,IA-SAMPLE-DESK-WITHDRAW-CONFIRM,IA-SAMPLE-DESK-SYSTEM-NOTICE,IA-SAMPLE-DESK-CUSTOMER-WELCOME,IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW,IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM,IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM,IA-SAMPLE-HOST
BUSINESS_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md
JOURNEY_REFS=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md#13-我替-Dexter-做的裁定
UI_INTERACTION_REF=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-design-codex.md
INTERACTION_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md
BASELINE_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
JOURNEY=SAMPLE-MEMBER-REGISTRATION
CONSUMER_FACE=terminal sample; primary operator / secondary customer
AUTHORIZED=写 IA、逐屏可复核结构、testID 与 owner 矩阵、交叉对账和实施输入
NOT_AUTHORIZED=生产代码、依赖、测试、Android、Web、浏览器自动化、DEV、seed、UAT、部署
IMPLEMENTATION_AUTHORITY=false
DEXTER_WIREFRAME_REVIEW=UNSET
IA_STATUS=READY_FOR_STATIC_REVIEW_WITH_SOURCE_INPUT_GATE

本工件把交互裁定转换为可实现的 IA，不重新裁决 Journey。交互源仍有一个必须在
进入实施前修正的计数错误：它把 layer 的“类型数”和“partKey 数”混写。本文不
静默改需求文件，而是把可由正式 partKey 直接复算的结果写成唯一实现输入。

## 1. 业务任务与 IA 总览

用户任务是：店员登录后查看已登记会员、发起一条新登记、让顾客在副屏确认，
再把成功、拒绝、撤回、退出和基础设施失败都带回一个可继续的状态。

### 1.1 分母先决：类型、partKey、catalog 与 IA-ID

| 分母 | 数量 | 计算 | 说明 |
|---|---:|---|---|
| layer 语义类型 | 6 | auth.notice、desk.waiting-confirm、desk.registry-notice、desk.discard-confirm、desk.withdraw-confirm、system-notice | system-notice 是一个语义类型 |
| layer partKey | 7 | 上述前五类各一，加 sample.auth.system-notice 与 sample.desk.system-notice | 两个 feature 互不 import，因此 system-notice 必须各持一份 |
| catalog part | 12 | 8 个 v13 part + discard-confirm + withdraw-confirm + 两个 system-notice | customer-member 三种 mode 仍是一个 part |
| IA-ID | 15 | 12 个 catalog part 的视图，其中 customer-member 一项拆成 3 个 mode，再加 technical host | IA-ID 是观察单元，不等于新增 catalog part |

因此，v13 S-15 的“层部件”分母不是六个也不是八个，而是 **7 个
partKey**。若判据统计的是 layer 语义类型，才写 6；两者必须在报告中分列。
交互源 §11.1 和 §12.1 的“三增至六”只能保留为历史记录，不能作为实现分母。

### 1.2 IA-ID 全集

| IA-ID | surface | 正式 partKey / 身份 | owner | display |
|---|---|---|---|---|
| IA-SAMPLE-AUTH-LOGIN | screen | sample.auth.login | sample-staff-auth | PRIMARY |
| IA-SAMPLE-AUTH-NOTICE | layer | sample.auth.notice | sample-staff-auth | PRIMARY |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | layer | sample.auth.system-notice | sample-staff-auth | PRIMARY |
| IA-SAMPLE-DESK-MEMBER-LIST | screen | sample.desk.member-list | sample-member-desk | PRIMARY |
| IA-SAMPLE-DESK-MEMBER-FORM | screen | sample.desk.member-form | sample-member-desk | PRIMARY |
| IA-SAMPLE-DESK-WAITING-CONFIRM | layer | sample.desk.waiting-confirm | sample-member-desk | PRIMARY |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | layer | sample.desk.registry-notice | sample-member-desk | PRIMARY |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | layer | sample.desk.discard-confirm | sample-member-desk | PRIMARY |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | layer | sample.desk.withdraw-confirm | sample-member-desk | PRIMARY |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | layer | sample.desk.system-notice | sample-member-desk | PRIMARY |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | screen | sample.desk.customer-welcome | sample-member-desk | SECONDARY，双屏 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | screen view | sample.desk.customer-member | sample-member-desk | SECONDARY，双屏 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | screen view | sample.desk.customer-member | sample-member-desk | SECONDARY，双屏 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | screen view | sample.desk.customer-member | sample-member-desk | PRIMARY，单屏 |
| IA-SAMPLE-HOST | technical host | 非 catalog 身份 | sample-console / test-expo | Web / Android host |

customer-member 的三个 IA-ID 是三个可独立观察的 mode，不是三个注册 part。
IA-SAMPLE-HOST 只描述装配宿主，不进入 catalog，也不作为用户 Journey 节点。

## 2.1 可见维度逐项声明

下表是实现前的可见事实分母。文案是业务可读的设计文案，不暴露 command、
layer、actor、runtime 或 request 等技术词。实际视觉 token 和尺寸由段 3/4 的
theme 与部件实现承接；固定 Web 画布与内部比例边界见第 4 节。

| IA-ID | businessTask / actorAndScenario | entryAndSurface | controlType 与 USER_VISIBLE_COPY | validationAndError | accessibilityAndTestId | empty/loading/error | containerBehaviorUnderLoad |
|---|---|---|---|---|---|---|---|
| IA-SAMPLE-AUTH-LOGIN | 店员进入会员登记工作台；尚未登录 | 初始 PRIMARY main screen | 姓名“店员登录”；输入“工号”“密码”；按钮“登录” | 输入可为空时由 owner 返回业务失败；失败开 auth.notice | 输入均可聚焦；label 通过 nativeID 关联；testID 见第 5 节 | 登录中显示“登录中”并禁用字段；无集合空态 | 单一纵向内容；唯一滚动祖先为 surface 内内容区，按钮不出视口 |
| IA-SAMPLE-AUTH-NOTICE | 店员看到登录业务失败后知道原因并关闭 | PRIMARY alert layer | 文本“工号或密码不正确”或“登录未完成，请重试”；按钮“关闭” | dismissible，关闭后回登录；不改写 owner 原因 | alert 角色；关闭按钮可达；testID :message、:dismiss | 只有消息和关闭；没有重试业务动作 | 遮罩覆盖登录；卡片内容不溢出；层内不产生第二滚动祖先 |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | 登录/退出基础设施失败后得到可诊断出口 | PRIMARY alert layer | 文本“操作没有完成，请重试”；按钮“知道了” | dismissible；只关闭本层，原表单状态保留，用户可重新发起 | alert 角色；testID :message、:dismiss | 观察失败只显示一层；观察命令失败不能递归开层 | 遮罩覆盖底层；短消息固定在卡片内，不横溢出 |
| IA-SAMPLE-DESK-MEMBER-LIST | 店员查看会员并开始新增或退出 | 登录成功后 PRIMARY main screen | 标题“已登记会员”；行显示姓名、电话；空态“暂无会员”；按钮“新增”“退出” | 行数据来自 member registry；空态只在零条记录时出现 | 行、空态、按钮均有稳定 testID；滚动列表保持动作可见 | 读取中由 render 现有快照策略处理；空态提供“新增会员”主动作 | 只有会员列表区域滚动；标题与底部动作不随列表横溢出；不用 FlatList |
| IA-SAMPLE-DESK-MEMBER-FORM | 店员录入待确认会员 | 点击新增后 PRIMARY main screen | 标题“新增会员”；输入“姓名”“电话”；按钮“提交”“取消” | 提交中锁定输入；失败保持输入并开 desk system notice；取消有值时开 discard-confirm | label 与输入关联；submit/cancel 真实按钮节点有 testID | 提交中“提交中”；失败不清空草稿；空字符串由 owner 最终判定 | 表单纵向滚动，操作区在可见区域；不得出现页面与表单双滚动 |
| IA-SAMPLE-DESK-WAITING-CONFIRM | 店员知道提交已发出并能撤回 | 双屏提交后 PRIMARY standard layer | “已提交，等待顾客确认”；显示姓名、电话；按钮“撤回” | standard；撤回先开 withdraw-confirm；顾客确认/拒绝先到者赢 | :message、:member-name、:member-phone、:withdraw | 等待不增加退出入口；撤回确认关闭后回可继续状态 | 层覆盖 member-list；内容短时不滚动；底层不可交互 |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | 顾客拒绝后店员选择下一步 | PRIMARY alert layer | “顾客拒绝了登记”；按钮“修改后重试”“放弃本次” | decisive；不可点遮罩或返回键绕过；retry 保留草稿，abandon 清理草稿 | :message、:retry、:abandon；不再有 :dismiss | 两个出口均关闭本层并产生确定去向 | 层卡片内两动作始终可见；顺序为修改后重试、放弃本次 |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | 店员确认是否放弃未完成录入或退出 | PRIMARY alert layer | intent=cancel-form 时“放弃本次录入？”；intent=logout 时“退出登记工作台？”；按钮“继续填写”“放弃” | decisive；确认后清理相应草稿/层并执行命令；保留则回原表单或列表 | :message、:keep、:discard；遮罩/返回键不关闭 | 无加载；命令失败保留层并显示系统失败层，不静默 | 短卡片覆盖当前主屏；动作区不折叠、不横溢出 |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | 店员确认撤回顾客确认中的登记 | PRIMARY alert layer | “撤回这次登记？”；按钮“继续等待”“撤回” | decisive；与顾客确认竞态先到者赢；pending 不存在时撤回 no-op | :message、:keep、:withdraw | 命令失败保留 pending 与层，并开 system notice | 只在双屏等待路径出现；单屏不出现该层 |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | 提交/确认/拒绝/退出基础设施失败后继续操作 | PRIMARY alert layer | “操作没有完成，请重试”；按钮“知道了” | dismissible；不暴露原始 error、payload、手机号；关闭后回原业务状态 | alert；:message、:dismiss | 观察失败只记结构化诊断；原动作 loading 先清 | 遮罩覆盖主屏；不出现在 SECONDARY |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | 顾客等待店员开始操作 | SECONDARY main，hasSecondarySurface=true | “欢迎，请等待店员操作” | 无业务动作 | 状态文本可读；无店员动作 testID | 无 loading/error 业务面 | SECONDARY 独立 surface 固定逻辑尺寸，内部内容按比例 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | 顾客核对店员正在录入的信息 | member-form 后 SECONDARY screen | 标题“请核对会员信息”；姓名、电话；“等待店员提交登记” | 只读，不显示确认/拒绝 | :title、:name、:phone、:waiting | 变量为空仍显示占位状态，不自行补造数据 | 唯一内容列；无操作区、无副屏 layer |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | 顾客确认或拒绝待登记会员 | pending 后 SECONDARY screen | 标题“请确认登记”；姓名、电话；按钮“确认”“拒绝” | pending 不存在时无动作；一方成功后另一方 no-op | :title、:name、:phone、:actions、:confirm、:reject | 提交中禁用两按钮；不展示店员退出或技术错误 | 竖向居中；动作区不横溢出；无 alert layer |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | 单屏顾客确认并把控制权交还店员 | pending 后 PRIMARY screen，仅无副屏 | 标题“请确认登记”；姓名、电话；按钮“确认”“拒绝”“交还店员” | hand-back 与确认/拒绝共享 pending 先到者规则；无 withdraw-confirm | :title、:name、:phone、:actions、:confirm、:reject、:hand-back | 请求中锁定动作；失败保留 pending 并显示 desk system notice | 单屏无 SECONDARY 列；页面只有一个 PRIMARY surface |
| IA-SAMPLE-HOST | 开发宿主切换单/双屏并提供 platform ports | test-expo 宿主，不是业务 screen | 切换“单屏/双屏”；固定画布上呈现一或两棵 surface | 只验证 assembly 不重建；宿主不读业务语义 | 宿主控制 testID 与业务控件分开 | 端口错误由宿主诊断；不在业务部件补 fallback | Web 外壳按 terminalSurfaces 固定画布；surface 之间间距对称 |

## 2.2 不可见维度：每个 IA-ID 的可执行观察

本专题是本地 runtime sample，没有 HTTP operation、权限系统、迁移或 seed。
这些维度写 N/A 并给原因，不把“没有后端”误写成已验证授权。

| IA-ID | stateAndPermission（可执行观察） | navigationAndRefresh（可执行观察） | collectionShapeAndScale（可执行观察） | dataSourceAndCascade（可执行观察） | forbiddenUI（可搜索证伪） |
|---|---|---|---|---|---|
| IA-SAMPLE-AUTH-LOGIN | `[静态]` login actor 是唯一 login command owner；`[focused]` anonymous session 下成功才产生 authenticated read，其他 session 状态不进入工作台 | `[focused]` 成功后出现 member-list；业务失败只出现 auth.notice；基础设施 failure 走 auth.system-notice；runtime/assembly 不重建 | `[N/A_WITH_REASON]` login 不读取集合；两个文本字段是有界输入，不创建分页/候选查询 | `[静态]` operator/passcode 只经 ui-state variable 进入 command；`[focused]` logout/失败清理规则后不得残留旧密码 | `[静态]` `StaffLogin` 不渲染 requestId、raw error、session token；任一命中即缺陷 |
| IA-SAMPLE-AUTH-NOTICE | `[静态]` 只由 staff-auth 的业务失败 actor 开启；`[focused]` 非 auth failure 不得打开此 part | `[focused]` 关闭后仍在 login；不重建 runtime，不改变 session owner 状态 | `[N/A_WITH_REASON]` 只有固定错误消息，无集合 | `[focused]` reasonCode 只在 feature 内映射文案，关闭不清未提交登录字段以外的 owner 事实 | `[静态]` source 与 rendered props 不得出现 error name、stack、requestId |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | `[静态]` 只接受 auth feature 的观察命令；`[focused]` 非 auth actor 无法开启该 part | `[focused]` dismiss 后回原 login/session 状态；不制造第二层、不递归派观察命令 | `[N/A_WITH_REASON]` 只有一条固定提示和 dismiss | `[静态]` operation 只能来自 auth allowlist；`[focused]` 原表单状态仍由 ui-state 读回 | `[静态]` notice props/树中不得出现 raw error、payload、手机号或设备标识 |
| IA-SAMPLE-DESK-MEMBER-LIST | `[静态]` authenticated session 才能由 desk actor 进入；member registry selector 是唯一读点，command owner 是唯一写点 | `[focused]` 新增进入 member-form；logout 依 intent 清层回 login；confirm/abandon 成功后重新读 selector，未受影响的事实不复制 | `[focused]` 造 0、1、many 行；`[静态]` 无分页参数、无抽干循环；达到 many 时只有列表区域滚动 | `[静态]` 行数据只来自 member-registry selector；`[focused]` 成功新增后列表读到 owner 新值，ui draft 被清理 | `[静态]` feature tree 不出现数据库、slice、command 名；`[focused]` 不把 raw error 渲染到空态/列表 |
| IA-SAMPLE-DESK-MEMBER-FORM | `[静态]` authenticated operator 才能写 draft；submit 最终由 member-registry owner 复核；`[focused]` 未认证调用不产生 pending | `[focused]` 成功回 list；customer reject 开 registry-notice；system failure 保留 form；cancel/abandon 按 intent 回 list/login | `[N/A_WITH_REASON]` 姓名/电话是有界文本输入，不是增长集合 | `[focused]` 改输入只更新 ui-state draft；submit rejection 后 draft 原值仍可读；cancel/abandon 清理规则由 actor 统一 | `[静态]` 不出现屏数条件、store、raw error；`[focused]` 错误消息不替换输入值 |
| IA-SAMPLE-DESK-WAITING-CONFIRM | `[focused]` pending 存在且为当前登记时才有 waiting layer；`[static]` layer state 由 ui-state 持有，不从 props 复制姓名电话 | `[focused]` 双屏 confirm 成功回 list、reject 开 registry-notice；withdraw 进入恢复链；单屏不注册该 layer | `[N/A_WITH_REASON]` 只显示一个 pending，不是集合视图 | `[focused]` name/phone 从 pending selector 实时读取；pending 清除后 layer 关闭或 no-op | `[静态]` layer tree 不出现副屏 alert、request internals 或 raw payload |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | `[静态]` 只有 member-desk rejected actor 可开启；`[focused]` 无当前 rejection 的 open 请求不得产生本层 | `[focused]` retry 回 form 且保留 draft；abandon 清 draft 回 list；不存在 dismiss 分支 | `[N/A_WITH_REASON]` 固定消息和两个动作，无集合 | `[focused]` reasonCode 来 registry owner；retry/abandon 后由 actor 读回相应 state | `[静态]` source 与树中不得有 `:dismiss` 或“关闭”无去向动作 |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | `[focused]` 只有 dirty draft 或 logout 规定的未完成状态可达；actor 决定 intent，通用控件不读业务事实 | `[focused]` keep 回原面；discard 按 intent 清 draft 并回 list/login；命令失败保持层并开 system notice | `[N/A_WITH_REASON]` 固定确认卡片，无集合 | `[focused]` intent 只在 actor 路由中消费；DialogSurface props 不含 intent | `[静态]` feature-local DialogSurface 不渲染内部 intent 字符串、command 名或 raw error |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | `[focused]` 仅双屏且 pending 存在时可达；`[static]` 单屏 source 零注册/零 render | `[focused]` keep 回 waiting；withdraw 触发 memberSubmissionWithdrawn；pending 已不存在时迟到命令 no-op | `[N/A_WITH_REASON]` 固定确认卡片，无集合 | `[focused]` pending selector 是唯一幂等判断，撤回后 pending 清除而 draft 仍可读 | `[静态]` 单屏树不得出现 withdraw-confirm、SECONDARY 或副屏动作 |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | `[static]` 只由 member-desk 自有 observation command 开启；无跨 feature read/import | `[focused]` dismiss 回原业务状态，不清 member draft/pending；观察命令自身失败不递归开层 | `[N/A_WITH_REASON]` 固定提示和 dismiss | `[static]` operation 来 desk allowlist；`[focused]` 原动作 loading 清除后再观察 | `[静态]` 不得出现 raw Error、payload、手机号、设备信息 |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | `[focused]` 只有 secondary surface 存在且 actor 选择 secondary 才渲染；single topology 不产生该 node | `[focused]` 店员登录/退出/登记状态改变时由 actor 替换 screen；宿主切换不重建 assembly | `[N/A_WITH_REASON]` 固定等待文案，无集合 | `[focused]` 无业务数据源；不从主屏复制会员或错误状态 | `[静态]` 不出现店员姓名、会员电话、alert、logout 或技术诊断 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | `[focused]` 双屏且 form 已打开时 actor 才给 preview；component 只消费 mode/variables | `[focused]` submit 后切 confirm；cancel/abandon 后回 welcome；不创建 confirm action | `[N/A_WITH_REASON]` 单一待核对对象 | `[focused]` name/phone 来 ui-state variables，更新后实时读；不建 component local mirror | `[静态]` 不出现 confirm/reject/hand-back、screen-count 或副屏 alert |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | `[focused]` 双屏且 pending 存在时才给 confirm；registry owner 最终判断先到者 | `[focused]` confirm 成功回 welcome；reject 回 preview + desk registry-notice；迟到动作 no-op | `[N/A_WITH_REASON]` 单一 pending 对象 | `[focused]` name/phone 来 pending selector；不在 customer component 保存 pending 副本 | `[静态]` 不出现撤回、退出、技术诊断或 raw error |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | `[focused]` 无 secondary 时 actor 给 handheld-confirm；component 不读 display-context；pending 仍由 registry owner 约束 | `[focused]` confirm 成功回 list；reject 回 member-form + registry-notice；hand-back 进入撤回链；返回键不绕过 | `[N/A_WITH_REASON]` 单一 pending 对象 | `[focused]` pending selector 是唯一来源；hand-back 清 pending 但保留 draft | `[静态]` 不出现 SECONDARY、双屏提示、withdraw-confirm 或 screen-count 条件 |
| IA-SAMPLE-HOST | `[static]` host 只拥有 platform ports/display toggle；不持有业务 selector/store；`[focused]` toggle 后 assembly identity 不变 | `[focused]` toggle 只重建 surface；业务 state 与 assembly 不重建 | `[N/A_WITH_REASON]` host 只呈现固定一/两棵 canvas，无业务集合 | `[static]` canvas 尺寸来自 integration `terminalSurfaces`；`[focused]` 外壳端口错误由 host 诊断 | `[静态]` host 不把诊断写入业务 layer、不复制 store、不让 assembly 感知 surfaceMode |

### 2.2.1 失败语义全集

| 失败类别 | owner | 展示 | 恢复 |
|---|---|---|---|
| invalid-credentials | sample-staff-session | auth.notice | 关闭回登录 |
| customer-rejected | sample-member-registry | registry-notice | retry 或 abandon |
| ledger/storage/timeout/actor dispatch rejection | 发起动作的 ui/feature 观察点 | 对应 feature 的 system-notice | 关闭后重试原业务动作 |
| resolved `CommandDispatchResult` 非 completed | runtime result；按 actor error category 与已发 domain event 分类 | 已知业务失败走 auth/registry notice；SYSTEM/timeout/unknown 走 feature system-notice | 先清 loading；不得把 fulfilled failure 当成功 |
| systemFailureObserved 自身 rejection | render diagnostic + feature logger | 不再递归开层 | 保留原失败，结构化记录 |
| runtime unavailable/render fallback | ui-base-render | 既有 render fallback | 由宿主/运行时处理，不冒充业务 notice |

## 3. 共用信息架构规则

以下规则适用于全部 IA-ID；它们不是视觉偏好，而是实现与 review 必须能重新观察的
行为边界。

| 规则 | 本批固定形态 | 最低可证伪观察 |
|---|---|---|
| 事实唯一住址 | 会员、pending、session 只由各自 kernel owner/state selector 提供；feature 不私有镜像 | [静态] 搜索 feature 生产源码，不得出现裸 slice/store 读取；[focused] 变更 owner 值后同一 surface 读到新值 |
| 屏数与 mode | actor 读取 `hasSecondarySurface` 选择 mode；部件只消费 `mode`，不读屏数 | [静态] CustomerMember 与四个 feature-local control 零 `display-context`/屏数条件；[focused] 1/2 两个 topology 各只得到批准 mode |
| 副屏边界 | SECONDARY 只承载顾客信息与确认；业务 alert/店员退出动作留在 PRIMARY | [focused] 双屏路径不出现副屏 alert、logout、withdraw-confirm；单屏不存在 SECONDARY 节点 |
| failure 文案 | system notice 只消费 allowlist operation，不消费 raw Error、payload、手机号或设备信息 | [focused] 必然 rejection 只呈现固定业务文案；静态搜索 system notice props 无 error/payload/phone/device 字段 |
| 可寻址路径 | 所有动作经 primitives 的强制 testID；业务 feature 不提供绕过控件层的 native/className 路径 | [静态] feature 零裸 RN、零 `className`、零字符串控件；[focused] 空/空白 testID 仍抛错 |
| 容器滚动 | member-list 只有列表区域滚动；member-form 只有表单内容区滚动；surface 与操作区不承担第二滚动祖先 | [focused] 0/1/many 与长字段夹具下，只有声明的滚动祖先变化；[静态] 生产树不存在第二滚动容器 |
| Web/Android 尺寸 | Web 外壳固定 `terminalSurfaces` 目标画布；部件内部按 theme/比例适配 | [静态] host 消费 terminalSurfaces；[focused] flex-to-fit mutation 使固定画布判据变红；不得把两者合并为全局固定尺寸 |

## 4. 错误语义与界面映射

本专题没有 HTTP problem；错误均发生在本地 runtime/actor/port 边界。以下是
完整错误类别分母，不把路径字符串或“Promise rejected”本身冒充业务断言。

| problem code / 类别 | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---|---|---|---|
| invalid-credentials | N/A：本地 session owner | 凭据未通过 owner 校验 | auth.login / staff-session | auth.notice 显示“工号或密码不正确”，关闭回登录 |
| customer-rejected | N/A：本地 registry owner | 顾客拒绝待登记会员 | customer-member / member-registry | registry-notice 给“修改后重试”或“放弃本次”，不提供无去向 dismiss |
| infrastructure-rejection | N/A：本地 storage/ledger/timeout/actor dispatch | 发起动作未完成但不得静默 | 发起动作的 ui/feature 观察点 | 先清 loading，再开所属 feature 的 system-notice；关闭后可重新发起 |
| observation-rejection | N/A：观察命令自身失败 | 不得递归制造第二个业务失败层 | feature observer + render diagnostic | 不新增层；保留原 rejection，写结构化 operation 诊断 |
| runtime-unavailable/render-fallback | N/A：render/host 边界 | 业务层不冒充 runtime 错误 | ui-base-render / host | 沿既有 render fallback/宿主诊断处理，不写入业务 notice |

## 5. 交叉对账

| 检查 | 判据 | 当前结果 |
|---|---|---|
| IA ↔ 交互工件 | 15 个 IA-ID 的 surface、入口、可见文案、mode 与 testID 均能在交互工件逐项找到 | `SOURCE_INPUT_GATE`：仅 layer type=6 与 partKey=7 的源文案仍待修订；其余逐项一致 |
| IA ↔ implementation-facing 详设 | owner、命令、失败/恢复、尺寸边界、CP 落点与本 IA 相同 | `SOURCE_INPUT_GATE`：同上；详设已按正式 partKey 记录 7 |
| IA-ID ↔ Journey | 每个 user-facing IA-ID 回指 interaction map/roster；IA-SAMPLE-HOST 明确为技术宿主而非 Journey 节点 | `PASS_BY_STATIC_REVIEW` |
| 计数自证 | IA-ID=15；catalog part=12；layer type=6；layer partKey=7；表格实际行数与声明相等 | `PASS_BY_STATIC_REVIEW` |

交互源计数修正完成后，需把前两项从 `SOURCE_INPUT_GATE` 改成 `PASS`；不能
用本工件的正确数字掩盖冻结输入的矛盾。

## 5.1 交互与 IA 的固定接缝

### 5.1.1 Part 与 IA 对账

| partKey 集 | IA 覆盖 | 结论 |
|---|---|---|
| sample.auth.login / sample.auth.notice / sample.auth.system-notice | 3 个 auth IA | 一对一 |
| sample.desk.member-list / member-form / waiting-confirm / registry-notice / discard-confirm / withdraw-confirm / system-notice / customer-welcome / customer-member | 9 个 desk part；customer-member 派生 3 个 IA mode | 一对多只发生在 mode 视图，不新增 part |
| 非 catalog 的 sample host | IA-SAMPLE-HOST | 明确不进 catalog |

### 5.1.2 testID 总原则

每个可操作控件都挂在真实动作节点上；业务 feature 不调用裸 React Native 控件，
不提供绕过 primitives 强制 testID 的路径。className 只允许在 primitives 内部。
完整逐屏动作 roster 见交互详设第 5 节，实施时由 feature focused test 与静态门分别
证明真实树干净、模型红向量可命中。

### 5.1.3 需求与实现的未决输入

| 项目 | 当前判定 | 进入实施前必须做的事 |
|---|---|---|
| S-15 layer 计数 | CONFIRMED_BY_PARTKEY=7；交互文档仍写六 | 修订需求/交互的计数文字，保留 type=6 与 partKey=7 双分母 |
| 单屏顾客拒绝去向 | `interaction map` 的旧行写成 reject→list，但现有 `createDeskRejectedActor` 与 registry-notice/retry/abandon 链落在 member-form + registry-notice | 修订冻结输入文字；详设不静默采用直接回 list |
| §9 比例静态门 | DEXTER_DECISION | 未裁定前不建门；实现只按比例设计并接受人工 review |
| NativeWind/Tailwind 版本 | UNVERIFIED_REQUIRES_EVIDENCE | 段 1 用本机解析值证明，不以教程替代 |
| 具体 visual token 数值 | 设计输入，不是 IA 业务事实 | 段 3/4 theme 设计确定并做 token red vector |

## 6. 完成判定

IA_DIMENSIONS=15 IA-ID；每项均有可见维度、不可见维度、surface owner、testID 与状态边界
LAYER_TYPE_DENOMINATOR=6
LAYER_PARTKEY_DENOMINATOR=7
CATALOG_PART_DENOMINATOR=12
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是；本地 runtime/无 HTTP 的 N/A 均有理由
FORBIDDEN_UI=显式列出 raw error、token、command/store/runtime、错误的副屏动作与单屏 SECONDARY
TYPED_PROBLEMS=5 类，均映射到 owner 与用户可见处理
CROSS_CHECK_WITH_INTERACTION=SOURCE_INPUT_GATE：type=6/partKey=7 与单屏 reject 去向的源文案待修正；其余逐项静态对账 PASS
CROSS_CHECK_WITH_DESIGN=SOURCE_INPUT_GATE：同一计数与单屏 reject 修正完成后再置 PASS
DEXTER_WIREFRAME_REVIEW=UNSET
IA_STATUS=READY_FOR_STATIC_REVIEW_WITH_SOURCE_INPUT_GATE
IMPLEMENTATION_ADMISSION=BLOCKED_BY_SOURCE_INPUT_GATE；本工件不构成 implementation authorization
