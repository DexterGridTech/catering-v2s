# TER UI 业务包可读性重构 · IA 保持与对账工件

元数据：

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
IA_SCOPE=15个既有sample IA-ID + 5个wallpaper保留记录（仅用于重构对账）
BUSINESS_SOURCE=doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md
JOURNEY_REFS=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md;doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md
UI_INTERACTION_REF=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md;doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED_BY_EXISTING_ARTIFACTS;本工件不新增视觉设计
IMPLEMENTATION_AUTHORITY=false

## 1. 工件性质与正本优先级

本工件不是新的视觉 IA，也不扩大 Journey。它把既有 screen/layer 的可见和不可见
事实重新列成重构期间的对账分母，防止“搬目录、拆 hook、抽 base”改变用户看到的
控件或业务语义。

正本优先级固定为：

1. 既有接受的交互工件负责可见形态、文案、surface、动作和布局；
2. 既有 IA 负责同一批 sample member-registration IA-ID 的不可见事实；
3. wallpaper 既有 requirements/implementation design 负责 wallpaper 的可见与失败语义；
4. 本工件只声明“保持原文事实”，implementation-facing 详设只增加代码归属、接口和
   验证，不得重新解释上述事实。

若实现计划、详设、本工件与上面正本出现不一致，状态必须为 OPEN，不能由实施者
临时选择一套。

## 2. 对账分母

### 2.1 既有 sample IA-ID（15）

| IA-ID | 正式 partKey / 身份 | 重构处理 |
| --- | --- | --- |
| IA-SAMPLE-AUTH-LOGIN | sample.auth.login | 只迁移 renderer 文件与 hook 入口，不改可见事实 |
| IA-SAMPLE-AUTH-NOTICE | sample.auth.notice | 只迁移 renderer 文件与 hook 入口，不改可见事实 |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | sample.auth.system-notice | 改用已有 base notice 的呈现骨架，保留 auth 文案和 dismiss 意图 |
| IA-SAMPLE-DESK-MEMBER-LIST | sample.desk.member-list | 只迁移 renderer 文件与 hook 入口，不改可见事实 |
| IA-SAMPLE-DESK-MEMBER-FORM | sample.desk.member-form | 只迁移 renderer 文件与 hook 入口，不改可见事实 |
| IA-SAMPLE-DESK-WAITING-CONFIRM | sample.desk.waiting-confirm | 只迁移 renderer 文件与 hook 入口，不改 layer 语义 |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | sample.desk.registry-notice | 只迁移 renderer 文件与 hook 入口，不改 decisive 语义 |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | sample.desk.discard-confirm | 只迁移 renderer 文件与 hook 入口，不改 intent 分支 |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | sample.desk.withdraw-confirm | 只迁移 renderer 文件与 hook 入口，不改双屏可达边界 |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | sample.desk.system-notice | 改用已有 base notice 的呈现骨架，保留 desk operation 与 dismiss 意图 |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | sample.desk.customer-welcome | 只迁移 renderer 文件与 hook 入口，不改 SECONDARY 语义 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | sample.desk.customer-member + preview mode | 只迁移 renderer 文件与 hook 入口，不改 mode |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | sample.desk.customer-member + confirm mode | 只迁移 renderer 文件与 hook 入口，不改 mode |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | sample.desk.customer-member + handheld-confirm mode | 只迁移 renderer 文件与 hook 入口，不改单屏边界 |
| IA-SAMPLE-HOST | test-expo 宿主 | 不改宿主 surface、尺寸和 assembly 生命周期 |

IA-SAMPLE-HOST 是技术宿主观察记录，不是 catalog part；customer-member 的三个记录
仍然是一个 part 的三个 mode，不新增注册项。

### 2.2 wallpaper 保留记录（5）

以下五行是对已有 wallpaper requirements/design 的 refactor preservation key，不是
新增 Journey、partKey 或产品 IA：

| 记录 | 现有 owner | 重构处理 |
| --- | --- | --- |
| IA-REF-SAMPLE-WALLPAPER-PICKER | ui.feature.sample-wallpaper-picker 的 sample.wallpaper.picker | laptop/mobile renderer 分目录，hook 和 wallpaper catalog 共用 |
| IA-REF-SAMPLE-WALLPAPER-SYSTEM-NOTICE | ui.feature.sample-wallpaper-picker 的 sample.wallpaper.system-notice | 两端 renderer 保留布局差异，body 使用 base notice |
| IA-REF-SAMPLE-WALLPAPER-BACKGROUND | WallpaperBackground 普通组件 | 留在 feature 根组件目录，使用 feature 自有 wallpaper catalog |
| IA-REF-WALLPAPER-CONSOLE-WAITING | ui.integration.sample-wallpaper-console | 仍为 laptop-only SECONDARY part，不创建 mobile 伪实现 |
| IA-REF-WALLPAPER-CONSOLE-WELCOME | ui.integration.sample-wallpaper-console | 仍为 laptop-only SECONDARY part，不创建 mobile 伪实现 |

## 3. 可见维度保持表

下表的可见事实逐字继承既有 IA/交互正本。实施只允许改变文件位置、import 路径、
part 注册辅助和重复 primitive 的承载方式；不可改变 surface、控件形态、文案、动作、
testID、失败层级、滚动祖先或双端布局差异。

| IA-ID / 记录 | businessTask / actorAndScenario | entryAndSurface | controlType 与 USER_VISIBLE_COPY | validationAndError | accessibilityAndTestId | empty/loading/error | containerBehaviorUnderLoad |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IA-SAMPLE-AUTH-LOGIN | 店员进入会员登记工作台；尚未登录 | 初始 PRIMARY main screen | 姓名“店员登录”；输入“工号”“密码”；按钮“登录” | 输入可为空时由 owner 返回业务失败；失败开 auth.notice | 输入均可聚焦；label 通过 nativeID 关联；testID 见既有 IA | 登录中显示“登录中”并禁用字段；无集合空态 | 单一纵向内容；唯一滚动祖先为 surface 内内容区，按钮不出视口 |
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
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | 顾客确认或拒绝待登记会员 | pending 后 SECONDARY screen | 标题“请确认登记”；姓名、电话、可选年龄输入；按钮“确认”“拒绝” | pending 不存在时无动作；一方成功后另一方 no-op | :title、:name、:phone、:age、:actions、:confirm、:reject | 提交中禁用两按钮；不展示店员退出或技术错误 | 竖向居中；动作区不横溢出；无 alert layer |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | 单屏顾客确认并把控制权交还店员 | pending 后 PRIMARY screen，仅无副屏 | 标题“请确认登记”；姓名、电话、可选年龄输入；按钮“确认”“拒绝”“交还店员” | hand-back 与确认/拒绝共享 pending 先到者规则；无 withdraw-confirm | :title、:name、:phone、:age、:actions、:confirm、:reject、:hand-back | 请求中锁定动作；失败保留 pending 并显示 desk system notice | 单屏无 SECONDARY 列；页面只有一个 PRIMARY surface |
| IA-SAMPLE-HOST | 开发宿主切换单/双屏并提供 platform ports | test-expo 宿主，不是业务 screen | 切换“单屏/双屏”；固定画布上呈现一或两棵 surface | 只验证 assembly 不重建；宿主不读业务语义 | 宿主控制 testID 与业务控件分开 | 端口错误由宿主诊断；不在业务部件补 fallback | Web 外壳按 terminalSurfaces 固定画布；surface 之间间距对称 |
| IA-REF-SAMPLE-WALLPAPER-PICKER | 店员在已登录的 PRIMARY 主屏选择并确认壁纸 | PRIMARY main screen；picker 为 sample.wallpaper.picker | 标题“选择屏幕壁纸”；四个选项“无壁纸”“山景”“湖景”“海滩”；按钮“确认” | pending ?? confirmed 决定选中；confirmed 不因选择改变；无变化时确认禁用 | radio、选项容器、缩略图、确认按钮继续使用 wallpaperPickerTestIds 与 wallpaperOptionTestId | 共享纵向滚动区承载选项与确认；写入前后失败由 wallpaper system notice 表达 | laptop 保留可读宽度排列；mobile 保留纵向选项与全宽确认；不得把两套布局合一 |
| IA-REF-SAMPLE-WALLPAPER-SYSTEM-NOTICE | 壁纸选择/确认失败后让店员知道是否可能已写入 | PRIMARY alert layer；sample.wallpaper.system-notice | 标题“系统提示”；phase/operation 映射既有提示文案；按钮“知道了” | before-write、after-write、unknown-write-phase 的文案和恢复含义不改 | alert、:message、:dismiss 保持真实动作节点与既有 testID | 关闭只派 feature-owned dismissal；不暴露 raw error、payload 或设备信息 | laptop 与 mobile 的 padding、卡片宽度和 action 方向保持当前差异 |
| IA-REF-SAMPLE-WALLPAPER-BACKGROUND | 两块实际 surface 显示 confirmed 壁纸 | SurfaceRoot children 中的普通组件，不是 part | 当前 confirmed source 作为背景；none 或缺失 source 返回空节点 | 只读 confirmed；pending 只影响 picker 选中和确认可用 | sample.wallpaper.background 和无障碍文案继续存在 | 不创建第二份 wallpaper state；两屏读取同一 selector | background 继续使用 layout=background，不占普通流、不盖住前景控件 |
| IA-REF-WALLPAPER-CONSOLE-WAITING | 顾客等待店员登录 | laptop SECONDARY main；sample.wallpaper-console.waiting | “等待店员登录” | 无业务动作；仍由 integration placement actor 选择 | sample.wallpaper-console.waiting:message 保持 | mobile 无 SECONDARY，不创建该 part 的 mobile renderer | 继续使用 integration 当前透明容器与 padding，不移动到 feature |
| IA-REF-WALLPAPER-CONSOLE-WELCOME | 顾客等待店员操作 | laptop SECONDARY main；sample.wallpaper-console.welcome | “欢迎，请等待店员操作” | 无业务动作；仍由 integration placement actor 选择 | sample.wallpaper-console.welcome:message 保持 | mobile 无 SECONDARY，不创建该 part 的 mobile renderer | 继续使用 integration 当前透明容器与 padding，不移动到 feature |

## 4. 不可见维度：逐记录可执行观察

| IA-ID / 记录 | stateAndPermission | navigationAndRefresh | collectionShapeAndScale | dataSourceAndCascade | forbiddenUI |
| --- | --- | --- | --- | --- | --- |
| IA-SAMPLE-AUTH-LOGIN | [静态] login actor 是唯一 login command owner；[focused] anonymous session 下成功才产生 authenticated read | [focused] 成功后出现 member-list；业务失败只出现 auth.notice；基础设施 failure 走 auth.system-notice；runtime/assembly 不重建 | [N/A_WITH_REASON] login 不读取集合；两个文本字段是有界输入 | [静态] operator/passcode 只经 ui-state variable 进入 command；失败清理规则后不得残留旧密码 | [静态] 不渲染 requestId、raw error、session token |
| IA-SAMPLE-AUTH-NOTICE | [静态] 只由 staff-auth 的业务失败 actor 开启；非 auth failure 不得打开 | [focused] 关闭后仍在 login；不重建 runtime | [N/A_WITH_REASON] 固定错误消息，无集合 | [focused] reasonCode 只在 feature 内映射文案 | [静态] source/tree 不出现 error name、stack、requestId |
| IA-SAMPLE-AUTH-SYSTEM-NOTICE | [静态] 只接受 auth feature 观察命令；非 auth actor 无法开启 | [focused] dismiss 后回原 login/session；不制造第二层或递归观察 | [N/A_WITH_REASON] 固定提示和 dismiss | [静态] operation 只来自 auth allowlist；原表单状态仍由 ui-state 读回 | [静态] notice props/tree 不出现 raw error、payload、手机号或设备标识 |
| IA-SAMPLE-DESK-MEMBER-LIST | [静态] authenticated session 才能进入；member registry selector 是唯一读点，command owner 是唯一写点 | [focused] 新增进入 member-form；logout 依 intent 清层回 login；成功后重新读 selector | [focused] 造 0、1、many 行；无分页参数、无抽干循环；只有列表区域滚动 | [focused] 成功新增后列表读到 owner 新值，ui draft 被清理 | [静态] feature tree 不出现数据库、slice、command 名或 raw error |
| IA-SAMPLE-DESK-MEMBER-FORM | [static] authenticated operator 才能写 draft；submit 最终由 member-registry owner 复核 | [focused] 成功回 list；reject 开 registry-notice；system failure 保留 form；cancel/abandon 按 intent 回 list/login | [N/A_WITH_REASON] 姓名/电话是有界文本输入 | [focused] submit rejection 后 draft 原值仍可读；clear 规则由 actor 统一 | [静态] 不出现屏数条件、store、raw error；错误消息不替换输入值 |
| IA-SAMPLE-DESK-WAITING-CONFIRM | [focused] pending 存在且为当前登记时才有 waiting layer；layer state 由 ui-state 持有 | [focused] 双屏 confirm/reject/withdraw 路径不变；单屏不注册该 layer | [N/A_WITH_REASON] 只显示一个 pending | [focused] name/phone 从 pending selector 实时读取 | [静态] layer tree 不出现副屏 alert、request internals 或 raw payload |
| IA-SAMPLE-DESK-REGISTRY-NOTICE | [静态] 只有 member-desk rejected actor 可开启 | [focused] retry 回 form 且保留 draft；abandon 清 draft 回 list；不存在 dismiss 分支 | [N/A_WITH_REASON] 固定消息和两个动作 | [focused] reasonCode 来 registry owner；retry/abandon 后由 actor 读回 state | [静态] source/tree 不出现 :dismiss 或无去向关闭动作 |
| IA-SAMPLE-DESK-DISCARD-CONFIRM | [focused] 只有 dirty draft 或 logout 未完成状态可达；actor 决定 intent | [focused] keep 回原面；discard 按 intent 清 draft 并回 list/login；失败保持层并开 system notice | [N/A_WITH_REASON] 固定确认卡片 | [focused] intent 只在 actor 路由中消费；组件 props 不含 command 内部字段 | [静态] 不渲染 intent 字符串、command 名或 raw error |
| IA-SAMPLE-DESK-WITHDRAW-CONFIRM | [focused] 仅双屏且 pending 存在时可达；单屏 source 零注册/零 render | [focused] keep 回 waiting；withdraw 触发 memberSubmissionWithdrawn；迟到命令 no-op | [N/A_WITH_REASON] 固定确认卡片 | [focused] pending selector 是唯一幂等判断，撤回后 pending 清除而 draft 仍可读 | [静态] 单屏树不得出现 withdraw-confirm、SECONDARY 或副屏动作 |
| IA-SAMPLE-DESK-SYSTEM-NOTICE | [静态] 只由 member-desk 自有 observation command 开启；无跨 feature read/import | [focused] dismiss 回原业务状态，不清 draft/pending；观察命令失败不递归开层 | [N/A_WITH_REASON] 固定提示和 dismiss | [静态] operation 来 desk allowlist；原动作 loading 先清 | [静态] 不出现 raw Error、payload、手机号、设备信息 |
| IA-SAMPLE-DESK-CUSTOMER-WELCOME | [focused] 只有 secondary surface 存在且 actor 选择 secondary 才渲染 | [focused] session/登记状态改变时由 actor 替换 screen；宿主切换不重建 assembly | [N/A_WITH_REASON] 固定等待文案 | [focused] 无业务数据源；不从主屏复制会员或错误状态 | [静态] 不出现店员姓名、会员电话、alert、logout 或技术诊断 |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-PREVIEW | [focused] 双屏且 form 已打开时 actor 才给 preview；component 只消费 mode/variables | [focused] submit 后切 confirm；cancel/abandon 后回 welcome；不创建 confirm action | [N/A_WITH_REASON] 单一待核对对象 | [focused] name/phone 来 ui-state variables；不建 component local mirror | [静态] 不出现 confirm/reject/hand-back、screen-count 或副屏 alert |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-CONFIRM | [focused] 双屏且 pending 存在时才给 confirm；registry owner 最终判断先到者 | [focused] confirm 成功回 welcome；reject 回 preview + registry-notice；迟到动作 no-op | [N/A_WITH_REASON] 单一 pending 对象 | [focused] name/phone 来 pending selector；不在 component 保存 pending 副本 | [静态] 不出现撤回、退出、技术诊断或 raw error |
| IA-SAMPLE-DESK-CUSTOMER-MEMBER-HANDHELD-CONFIRM | [focused] 无 secondary 时 actor 给 handheld-confirm；component 不读 display-context | [focused] confirm 成功回 list；reject 回 form + registry-notice；hand-back 进入撤回链 | [N/A_WITH_REASON] 单一 pending 对象 | [focused] pending selector 是唯一来源；hand-back 清 pending 但保留 draft | [静态] 不出现 SECONDARY、双屏提示、withdraw-confirm 或 screen-count 条件 |
| IA-SAMPLE-HOST | [静态] host 只拥有 platform ports/display toggle；不持有业务 selector/store | [focused] toggle 只重建 surface；业务 state 与 assembly 不重建 | [N/A_WITH_REASON] 固定一/两棵 canvas，无业务集合 | [静态] canvas 尺寸来自 integration terminalSurfaces | [静态] host 不把诊断写入业务 layer、不复制 store |
| IA-REF-SAMPLE-WALLPAPER-PICKER | [静态] picker 只读 wallpaper owner selector，命令经 feature actor 到 kernel owner | [focused] select 只更新 pending；confirm 成功更新 confirmed 并清 pending；失败沿既有 phase notice | [N/A_WITH_REASON] 固定四个 wallpaper option；无分页/抽干循环 | [静态] labels/assets 只有 feature catalog 一个住址；confirmed/pending 不复制到本地 store | [静态] 不出现 raw error、requestId、kernel slice 或设备信息 |
| IA-REF-SAMPLE-WALLPAPER-SYSTEM-NOTICE | [静态] 只接受 wallpaper feature 的 observation command | [focused] dismiss 只关闭当前层；不重新派发原 action、不递归开层 | [N/A_WITH_REASON] 固定消息和 dismiss | [focused] operation/phase 来 feature allowlist 与 actor result | [静态] 不渲染 raw error、payload、手机号或设备标识 |
| IA-REF-SAMPLE-WALLPAPER-BACKGROUND | [静态] 只读 confirmed selector；不拥有命令或写入 | [focused] confirmed 改变后两屏 background 读到同一新 source；pending 不改变 background | [N/A_WITH_REASON] 单值 source，不是集合 | [静态] source 只由 feature assetsById 解析；none/missing 返回空节点 | [静态] 不出现 picker 操作、pending 值、command 或 runtime 诊断 |
| IA-REF-WALLPAPER-CONSOLE-WAITING | [静态] placement actor 负责选择 part；组件不读 session/store | [focused] anonymous/restore 状态选择保持既有 waiting；mobile 无 SECONDARY | [N/A_WITH_REASON] 固定等待文案 | [静态] 不复制 wallpaper/session facts | [静态] 不出现 picker、登录表单、alert 或技术诊断 |
| IA-REF-WALLPAPER-CONSOLE-WELCOME | [静态] placement actor 负责选择 part；组件不读 session/store | [focused] authenticated 状态选择保持既有 welcome；mobile 无 SECONDARY | [N/A_WITH_REASON] 固定欢迎文案 | [静态] 不复制 wallpaper/session facts | [静态] 不出现 picker、登录表单、alert 或技术诊断 |

## 5. 共用信息架构规则

1. 会员、pending、session、wallpaper confirmed/pending 仍由各自 kernel owner 和 selector
   提供；feature 不私有镜像。
2. actor 继续决定 screen/layer、displayMode、workspace、instanceMode 与可达 mode；
   component 只消费 hook 返回值和 mode，不读取屏数、surface topology 或 integration 配置。
3. laptop/mobile 是两个显式 renderer，不在一个 renderer 内用 Platform.OS、窗口宽度或
   条件分支替换整套布局。
4. system notice 只呈现 feature 已经解释过的安全文案；base 呈现器不拥有 observed、
   dismissed、operation、phase 或业务恢复。
5. wallpaper 的 none、w1、w2、w3 标签和 asset identity 只在
   sample-wallpaper-picker 的 feature catalog 内有一个住址。
6. integration 的 package.json surface 配置仍由 integration 读取；base 只拥有无业务的
   shape 校验、orientation 选择、startup-ready 共用日志和显式 state-sync slice 筛选。

## 6. 错误语义全集

| 类别 | 正本 | 重构不可改变的用户处理 |
| --- | --- | --- |
| invalid-credentials | 既有 sample IA / staff-session requirements | auth.notice 显示“工号或密码不正确”，关闭回登录 |
| customer-rejected | 既有 sample IA / member-registry requirements | registry-notice 提供“修改后重试”和“放弃本次”，无无去向 dismiss |
| infrastructure-rejection | 既有 sample IA / D-14 | 先清 loading，再开所属 feature system notice；失败原因不改写 |
| observation-rejection | 既有 sample IA / D-14 | 不递归制造第二层；保留原失败并写结构化诊断 |
| runtime-unavailable/render-fallback | 既有 render boundary | 由 ui-base-render/host 处理，不冒充业务 notice |
| wallpaper before-write | sample2 wallpaper D-14 | “操作没有完成，请重试” |
| wallpaper after-write | sample2 wallpaper D-14 | 分 operation 表达“已写入但未确认”，不要求重复操作 |
| wallpaper unknown-write-phase | sample2 wallpaper D-14 | “操作结果未能确认，请以当前画面为准” |

## 7. 交叉对账与完成判定

| 检查 | 判据 | 当前状态 |
| --- | --- | --- |
| IA ↔ 交互工件 | 15 个既有 IA-ID 的 surface、入口、文案、mode、testID 不被重构改变 | OPEN_UNTIL_REVIEW |
| wallpaper 记录 ↔ wallpaper 正本 | 5 个保留记录只复述既有 requirements/design，不新增 UI 语义 | MATCHED_BY_STATIC_SOURCE_READ |
| IA ↔ implementation design | 详设只能引用本工件的保持规则；重复事实必须逐字一致 | OPEN_UNTIL_DESIGN_WRITTEN_AND_REVIEWED |
| IA-ID / preservation key ↔ owner | 所有记录均可追到现有 part、普通组件或宿主 owner | MATCHED_BY_STATIC_SOURCE_READ |
| 计数自证 | 15 个既有 IA-ID + 5 个 preservation key；14 个 feature logical parts、28 个双端 renderer、14 个旧兼容壳 | MATCHED_BY_STATIC_SOURCE_READ |

IA_DIMENSIONS=20 records;每条均有可见与不可见维度
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
TYPED_FAILURES=8 categories
CROSS_CHECK_WITH_DESIGN=OPEN_UNTIL_DESIGN_WRITTEN_AND_REVIEWED
IA_STATUS=REFACTOR_PRESERVATION_INPUT_ONLY
IMPLEMENTATION_ADMISSION=不由本工件单独授予；等待详设/计划 review
