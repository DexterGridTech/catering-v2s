SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER sample 验证切片 IA 详设（v13 全量重做）

## 1. 元数据与边界

~~~text
IA_SCOPE=IA-AUTH-LOGIN, IA-AUTH-NOTICE, IA-MEMBER-LIST, IA-MEMBER-FORM,
         IA-WAITING-CONFIRM, IA-REGISTRY-NOTICE, IA-CUSTOMER-WELCOME,
         IA-CUSTOMER-MEMBER-PREVIEW, IA-CUSTOMER-MEMBER-CONFIRM,
         IA-SAMPLE-HOST
BUSINESS_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
JOURNEY_REFS=上述需求 §4.1 门店会员登记旅途；§6.3-§6.8 owner 与命令链路
UI_INTERACTION_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=UNSET
IMPLEMENTATION_AUTHORITY=false
~~~

本文件只定义 IA，不授权源码、测试、依赖、真机、DEV、seed、L2、UAT 或部署。
本次以 v13 需求为新基线重建，旧版六包图、旧的预挂载异步协议、旧的精确依赖白名单和单 Provider 双 Surface 形态均不作为设计输入。

## 2. 统一 IA 规则

### 2.1 业务与身份

业务结果是：店员登录后查看和新增会员；顾客在副屏确认后，且仅在确认成功后，会员进入已登记列表。
部件身份、surface 身份、准入维度和放置维度分开：

| 事实 | 正本 | IA 约束 |
| --- | --- | --- |
| surface 身份 | display-context 的 DisplayMode 与需求 §5.1 | 读侧由 createSurface(displayMode) 显式传入；写侧命令载荷显式带 displayMode |
| 放置 | showScreenCommand 的 containerKey | 这是单个目标容器；IA 不把它与 catalog 的 containerKeys 混用 |
| 准入 | ui-state 的 UiCatalogEntry.containerKeys | 只过滤 part 是否可在容器出现；允许空数组表示 layer-only |
| 屏数 | 注入的 DevicePort 经 readDisplayInfo 与 resolveSecondarySurfaceAvailable | 只由 actor/宿主适配器消费；部件不读原始 displayCount |
| 共享事实 | runtime 单一 store | 两个 surface 读取同一 runtime；Web 是一个 React root 下两个兄弟 Provider；Android 的目标形态是两个 Root Surface 共享一个 JS VM／一个 store，但具体承载方式由 D-6 真机 spike 决定；单屏 confirm 可临时在 PRIMARY 呈现 customer-member |

### 2.2 共同可见限制

所有 screen 或 layer 都必须有稳定的 partKey、显式 displayMode、对应 renderer 和可断言的 testID。
业务组件不得出现具体屏数判断、平台判断、store 读取、dispatch 或裸业务 slice 读取。
空态不是一个可注册 part；runtime-unavailable、container-empty、catalog-missing、renderer-missing、invalid-props 是五种不同语义结果，即使底层布局可以复用，testID 与诊断类型也必须不同。

### 2.3 共享加载与失败策略

这是内存中的 TER sample，不引入 HTTP、分页、后端加载或自动化 provider。runtime 未 started 时 render 返回 runtime-unavailable；started 后才读取 root。容器为空不是 runtime 不可用，必须返回独立 container-empty。
业务失败不伪装成成功：login 校验失败保持 anonymous、request ledger 记失败并显示 auth notice；confirm 无 pending 是业务错误，不写入 members。

## 3. IA 画面全集

下表逐 IA-ID（含技术宿主）填满模板要求的八个可见维度。精确线框、控件布局与文案在交互工件中定义；业务 part 的 partKey、displayMode、容器和 testID 必须一致。`IA-SAMPLE-HOST` 是可见的 test-expo 验证宿主，不是 catalog part，不进入业务 partKey 或 placement 分母。

| IA-ID / canonical partKey or view | businessTask | actorAndScenario | entryAndSurface | controlType | validationAndError | accessibilityAndTestId | emptyLoadingErrorStates | containerBehaviorUnderLoad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IA-AUTH-LOGIN / sample.auth.login | 店员完成登录并进入会员登记工作台 | 店员在开机 PRIMARY 看到登录入口 | PRIMARY；screen；main；输入 operator-name、passcode 和 submit | 两个文本输入、一个提交按钮；提交后进入 loading | 任一字段无效保持登录页并显示可见错误；不把异常文本直出 | label 与 input 关联；按钮键盘可达；状态不只靠颜色；testID 为 sample.auth.login:operator-name、sample.auth.login:passcode、sample.auth.login:submit | 初始显示表单；提交显示 request loading；失败保留输入；成功由 member-list 替换 | 表单在固定 logical surface 内，不横向溢出；错误在字段附近换行 |
| IA-AUTH-NOTICE / sample.auth.notice | 让店员知道登录失败原因并能关闭提示 | 登录失败后，店员处理提示 | PRIMARY；layer；containerKeys 为空；alert layer | 只读提示和 dismiss 按钮 | 保留 owner 给出的失败原因分类；dismiss 只清当前提示 | 提示有语义角色；dismiss 可聚焦；testID 为 sample.auth.notice:dismiss | 无提示时不存在；登录失败时出现独立 alert 变体；不与 container-empty 混淆 | 提示文本换行，不盖住主要表单操作；多个提示按 layer 规则排布 |
| IA-MEMBER-LIST / sample.desk.member-list | 店员查看已登记会员并开始新增 | 登录成功后店员回到登记工作台 | PRIMARY；screen；main；list 与 add | 只读会员列表、add、logout 按钮 | members 是 owner selector 的当前值；没有独立网络错误改写；runtime 不可用走独立兜底 | 行内容可读；add/logout 可键盘达；testID 为 sample.desk.member-list:add、sample.desk.member-list:logout | 空列表显示业务空说明；没有独立异步 loading；runtime-unavailable 是另一个事实 | 列表区滚动；长列表不撑破 surface；add/logout 固定可达 |
| IA-MEMBER-FORM / sample.desk.member-form | 店员录入待顾客确认的姓名和电话 | 店员从 member-list 发起新增 | PRIMARY；screen；main；name、phone、submit | 两个可编辑字段和 submit | 空值/格式错误留在表单；提交失败不清输入；双屏完成后进入 waiting-confirm，单屏由 customer-member confirm 占 PRIMARY | 输入语义、label、焦点顺序明确；testID 为 sample.desk.member-form:name、sample.desk.member-form:phone、sample.desk.member-form:submit | 初始为空；提交 loading；失败可重试且保留变量 | 内容在固定 canvas 内；字段错误换行，按钮不被推出视口 |
| IA-WAITING-CONFIRM / sample.desk.waiting-confirm | 告知店员登记已提交，等待顾客确认 | 双屏提交成功后店员等待副屏操作 | PRIMARY；layer；containerKeys 为空；standard layer | 只读等待提示；不提供伪造确认按钮 | 只有 pending 存在时出现；确认/拒绝结果后消失 | 语义提示不依赖颜色；testID 为 sample.desk.waiting-confirm:message | 无 pending 不存在；pending 时显示等待；失败由 registry-notice 承载 | 固定层不阻塞副屏；文本不溢出，层级由 layerTier 决定 |
| IA-REGISTRY-NOTICE / sample.desk.registry-notice | 让店员知道登记被顾客拒绝或业务失败 | 顾客拒绝或登记业务失败后 | PRIMARY；layer；containerKeys 为空；alert layer | 只读结果/错误提示和 dismiss | rejected/失败不伪造 members；dismiss 不改业务事实；confirmed 走列表成功路径，不强行显示此层 | alert 有可读名称；dismiss 可达；testID 为 sample.desk.registry-notice:dismiss | 不存在、出现、关闭三态独立；不把错误当空列表 | alert 排在 standard 之后；文本换行，不遮蔽必要操作 |
| IA-CUSTOMER-WELCOME / sample.desk.customer-welcome | 让顾客知道副屏可开始确认流程 | 双屏开机或店员尚未提交时，顾客看到待机 | SECONDARY；screen；main；无业务输入 | 只读欢迎内容 | 不由顾客触发店员导航；双屏不可用时不渲染该 surface | 可读标题；无伪按钮；testID 为 sample.desk.customer-welcome:content | 双屏成立时显示；单屏不创建 SECONDARY tree；runtime 不可用是另一个兜底 | 欢迎内容按 SECONDARY logical size 居中；不影响 PRIMARY |
| IA-CUSTOMER-MEMBER-PREVIEW / sample.desk.customer-member（mode=preview） | 让顾客看到店员正在录入的姓名和电话 | 店员点击新增后，顾客在副屏等待提交 | SECONDARY；screen；main；preview mode | 只读会员预览，无确认动作 | pending 尚未产生时不显示确认语义；提交后才进入 confirm mode | 内容可读且不只靠颜色；testID 为 sample.desk.customer-member:name、sample.desk.customer-member:phone | preview 时显示共享变量；没有有效值时不造数据；runtime-unavailable 另行处理 | 内容按 SECONDARY canvas 换行；只读内容不溢出 |
| IA-CUSTOMER-MEMBER-CONFIRM / sample.desk.customer-member（mode=confirm） | 让顾客确认或拒绝待登记会员 | 双屏时顾客在副屏作出决定；单屏时店员将主屏交给顾客作出决定 | 单屏 PRIMARY、双屏 SECONDARY；screen；main；confirm mode | 只读姓名/电话、confirm 按钮、reject 按钮 | pending 缺失时不显示可确认的业务数据；两个动作分别派 confirm/reject；双屏 confirmed 回 customer-welcome、rejected 回 customer-member preview；单屏 confirmed 回 member-list、rejected 回 member-form | 两个按钮均可达且不只靠颜色区分；testID 为 sample.desk.customer-member:confirm、sample.desk.customer-member:reject | pending 时显示确认操作；confirmed/rejected 后由事件导航离开；不与 runtime-unavailable 共用诊断 | 数据与动作在对应 PRIMARY/SECONDARY logical canvas 内固定可达，不横溢 |
| IA-SAMPLE-HOST / test-expo 技术宿主（非 catalog part） | 让验证者在 Web 上切换单屏/双屏形态并重跑旅途 | validation operator 在 sample-console 的 test-expo 外壳操作 | Web host；不进入业务 screen、catalog 或 placement | surfaceMode toggle button；只在干净态切换 | 同一 shell state 同时驱动 DevicePort 与一/两棵 surface tree；不改业务事实、不重建 runtime；对应 S-25 | 有可见 label；按钮键盘可达；testID=`sample-console:test-expo:surface-toggle`（宿主控件 ID，不是 partKey） | 不定义业务 empty/loading；unavailable device 属于 S-13a fixture，不复用 runtime-unavailable 表现 | 按 terminalSurfaces 固定逻辑尺寸挂载一/两棵树；同一 React root 下两个 Provider |

## 4. 不可见维度：可执行观察

以下观察句是本 IA 的验收定义。每条都声明最低证据档位，不以“看起来正确”代替；技术宿主的观察不等同于业务 part 的 catalog/placement 观察。

| IA-ID | stateAndPermission | navigationAndRefresh | collectionShapeAndScale | dataSourceAndCascade | forbiddenUI |
| --- | --- | --- | --- | --- | --- |
| IA-AUTH-LOGIN | focused test：匿名 runtime 可写 login；部件不能直接 dispatch；login actor 才能改变 session | focused test：loginSucceeded 只触发 member-desk 导航；loginFailed 只出现 auth notice，不重置表单变量 | N/A：表单是单值变量，不是集合 | owner 是 staff-session；login success 令 member-list 可见，failure 不改 session | static：sample auth 部件不得出现 store.dispatch、getStore、裸 request ledger |
| IA-AUTH-NOTICE | focused test：notice 只由 auth actor 写入；dismiss 只清本包呈现状态 | focused test：dismiss 只清 notice，不刷新 members 或 pending | N/A：单层提示 | owner 是 auth ui feature 的呈现 slice；业务 session 事件是来源 | static/focused：不出现 token、密码、raw error payload；不把空容器变成业务 screen |
| IA-MEMBER-LIST | focused test：owner selector selectMembers 是唯一读取路径 | focused test：confirmed 后仅 member list 的 owner selector 反映新成员；不依赖 dispatch 返回值 | 集合为内存 readonly members；sample 规模至少覆盖空与多行，长列表只在 list 区滚动 | owner 是 sample-member-registry；logout 清呈现层但不凭 UI 直接清 owner members | static：不读 registry slice 字符串键、不读原始 displayCount、不出现具体平台 API |
| IA-MEMBER-FORM | focused test：只有 staff-auth UI actor 可发起本包呈现命令；业务写入由 uiVariable reader/owner actor 完成 | focused test：提交成功只切 waiting/pending 与副屏 preview；失败保留变量 | N/A：两个声明式 uiVariable；值不存在时读声明 default | owner 是 sample-member-desk；提交后 customer view 依赖同一变量/root | static：字段不得放本地 useState；requestId 瞬时句柄除外，不可把业务值塞入 command payload |
| IA-WAITING-CONFIRM | focused test：只在 pending 存在且双屏判定为 true 时由 desk actor 显示 | focused test：confirm/reject 都清 waiting；不以 UI 本地状态推断结果 | N/A：单层呈现 part，containerKeys 为空 | owner 是 member-registry 的 pending；confirm/reject event 是唯一级联来源 | static：不出现第二套容器键拼接、不提供伪确认命令 |
| IA-REGISTRY-NOTICE | focused test：registry event 由 desk actor 转为本包 notice；失败路径不写 members | focused test：dismiss 不触发 member list 重取，不改变 pending | N/A：单层提示 | owner 是 registry event；notice 只是 UI 呈现事实，不进入业务 owner slice | static：不展示 error 原文中的凭据或 raw payload |
| IA-CUSTOMER-WELCOME | focused test：只有 createSurface(SECONDARY) 且 screen 可用时存在；PRIMARY 读不到该 part | focused test：双屏/单屏切换只由宿主挂卸 tree；runtime 与 members 引用保持 | N/A：只读欢迎内容 | 来源是 runtime status 与宿主显式 displayMode；不从 routeContext 猜 surface | static：不出现 displayCount、Platform.OS、window 嗅探、具体容器常量 |
| IA-CUSTOMER-MEMBER-PREVIEW | focused test：登记变量经 module-bound reader 读取；部件不直接写业务 slice | focused test：新增后 preview 出现，submit 后进入 confirm；confirmed/rejected 后不保留旧 preview | N/A：单条暂存值，非分页集合 | owner 是 desk uiVariable；pending/结果由 member-registry event 驱动 | static：不直接读别包 state、不自造 screen navigation、不向 kernel feature import UI key |
| IA-CUSTOMER-MEMBER-CONFIRM | focused test：只有 pending 且 desk actor 已进入 confirm mode 时才出现 confirm/reject 控件 | focused test：confirm/reject event 后离开 confirm mode；不读 dispatch 返回值决定结果 | N/A：单条 pending | 来源是 registry pending 与 desk uiVariable；confirmed/rejected event 负责后续导航 | static：不显示不存在的 pending、不调用 platform port、不在部件判断屏数 |
| IA-SAMPLE-HOST | acceptance：真实 assembly 返回 started runtime，两个 Provider 各自只收到 getStatus/getState/subscribe、dispatchCommand、module-bound reader 等窄函数；toggle 是 test-expo 宿主真实 action | acceptance：单屏/双屏由同一 shell state 驱动；Web 一 root 两兄弟 Provider；Android 两 Root Surface；不重建 runtime；S-25 只在干净态切换后重跑 | N/A：surface tree 数量最多两棵；members 集合由 owner 管理 | DevicePort 是屏数唯一来源；Web test-expo 与挂载数共享同一状态；Android initialProps 给 displayIndex/displayCount | static：sample-console 库侧零具体 part/container/dimension；zero getStore/dispatch/Platform sniff；toggle 不进入 catalog |

## 5. 错误语义与界面映射（全量）

本切片没有 HTTP 请求或 HTTP reject code；`HTTP` 列全部为 `N/A_WITH_REASON:本轮是本地 runtime/adapter 旅途，transport 尚未纳入范围`。以下同时覆盖 render 不能画、业务失败、确认边界和 native 屏数未知，不把技术异常原文直接交给用户。

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
| --- | --- | --- | --- | --- |
| render.runtime-unavailable | N/A_WITH_REASON | Runtime status 非 `started`；不得调用 getState | RenderProvider/SurfaceRoot | 显示独立 runtime-unavailable 兜底，不冒充 container-empty |
| render.container-empty | N/A_WITH_REASON | Runtime 可用但目标容器没有可用 part | SurfaceRoot/render resolver | 显示独立 container-empty 兜底，不记录 part 级错误 |
| render.missing-catalog-entry | N/A_WITH_REASON | 请求的 partKey 不在真实 UiCatalog 中 | render resolver | 显示 missing-catalog-entry 兜底并记录带 partKey 的 RenderPartDiagnostic |
| render.missing-renderer | N/A_WITH_REASON | catalog 有 part 但 rendererKey 没有 renderer | render resolver | 显示 missing-renderer 兜底并记录带 partKey 的 RenderPartDiagnostic |
| render.invalid-props | N/A_WITH_REASON | props 字段存在但不是普通对象；业务组件不得被调用 | render resolver | 显示 invalid-props 兜底并记录带 partKey 的 RenderPartDiagnostic；不把值包装进 `value` |
| session.invalid-credentials | N/A_WITH_REASON | staff-session login actor 校验失败；session 保持 anonymous，request 失败 | sample-staff-session owner → sample-staff-auth authResult | 显示 auth notice 的 reasonCode 文案并清 passcode；不显示 raw exception |
| registry.customer-rejected | N/A_WITH_REASON | member-registry reject actor 清 pending，不写 members | sample-member-registry → sample-member-desk deskRejected | 显示 registry-notice；双屏回 preview，单屏回 member-form |
| registry.confirm-without-pending | N/A_WITH_REASON | confirm actor 在 pending 为 null 时抛错，不写 members | sample-member-registry owner | 不显示确认成功、不伪造 members；保持当前业务面并由 request failure 可观察 |
| registry.request-failed | N/A_WITH_REASON | 登记相关命令未完成名义动作时按失败处理，不把失败当 confirmed | registry owner/desk notice actor | 显示 registry-notice 的 reasonCode；不显示 raw payload |
| display.secondary-unknown | N/A_WITH_REASON | readDisplayInfo 为 unavailable 或 malformed；纯函数按 unknown-to-single 降级 | display-context → sample-member-desk actor/宿主 | 继续单屏路径，不抛错、不复用 runtime-unavailable 表现 |

## 6. 交互与 IA 的固定接缝

### 6.1 读写对称但身份显式

RenderProvider 的每个实例接收窄只读 stateSource：

~~~ts
{
  getStatus: () => RuntimeStatus,
  getState: () => Root,
  subscribe: (listener: () => void) => () => void
}
~~~

同时从 integration 注入 dispatchCommand 与 module-bound selectUiVariable reader。read path 的 useUiStateSelector(selector) 只对 root 引用和 selector 身份做缓存；selector 必须是 root 的纯函数。write path 的 useDispatchCommand() 只暴露函数，部件自行生成并显式传 displayMode、requestId、业务 payload。

### 6.2 Web 与 Android surface 关系

Web 是一个 React root，包含两棵兄弟树：

~~~text
Shell state(surfaceMode)
├── RenderProvider(PRIMARY) ── SurfaceRoot(PRIMARY)
└── RenderProvider(SECONDARY) ─ SurfaceRoot(SECONDARY)
~~~

每棵树有独立 reader、snapshot 与 diagnostic reporter；卸载 SECONDARY 不得影响 PRIMARY。
Android 的目标是两个 Root Surface、一个 JS VM、一个 store；具体由何种 Activity／surface carrier 承载仍由 D-6 `OPEN-DUALSCREEN-SINGLE-VM-CARRIER` 的真机 spike 解决。主屏与副屏必须使用同一个已注册组件，Kotlin 同步传 displayIndex 与 displayCount；POC 的独立 secondary process 与自建 React 实例都不是可照抄形态。同进程 Presentation 只有在复用同一 ReactHost／ReactSurface 且实证单 VM／单 store 时才可作为候选。D-6 spike 需 Dexter 另行授权；若当前 Expo/RN 无法保持 TER 的单 VM/单 store/多 surface 事实，必须停下交 Dexter，不得退回第二 VM、独立进程、独立 store 或独立 React 实例。

### 6.3 五种不可画结果

| 结果 | testID 语义 | 诊断类型 | 与其它结果的差异 |
| --- | --- | --- | --- |
| runtime-unavailable | runtime-unavailable | RenderRuntimeObservation | status 非 started，不调用 getState |
| container-empty | container-empty | 无 part 诊断 | runtime 可用但目标容器为空 |
| missing-catalog-entry | missing-catalog-entry | RenderPartDiagnostic(error, partKey) | catalog 没有该 part |
| missing-renderer | missing-renderer | RenderPartDiagnostic(error, partKey) | catalog 有 part 但 renderer 无 |
| invalid-props | invalid-props | RenderPartDiagnostic(error, partKey) | props 存在但不是普通对象，业务组件不调用 |

这些是语义不同的观察，不要求五套完全独立的底层布局，但不准复用同一 testID、诊断类别或错误原因。

## 7. 规模、尺寸与状态边界

members 是 owner slice 中的 readonly 集合；本 sample 不做分页、HTTP 加载或客户端镜像。测试必须覆盖空列表、至少两条成员及长列表滚动，不把条数上限虚构成产品契约。

集成包 package.json 唯一声明：

~~~json
{
  "terminalSurfaces": {
    "layout": "row",
    "scaleToFit": true,
    "surfaces": {
      "PRIMARY": { "width": 1920, "height": 1080 },
      "SECONDARY": { "width": 1024, "height": 600 }
    }
  }
}
~~~

library 侧读取自身 package.json 并导出带类型的只读常量；test-expo 消费该常量。浏览器 resize 只等比缩放整体，不改逻辑宽高比。内部 content 用 flex 还是绝对定位未由本文件裁定，必须在实现前由 Dexter 单独决定，不能在详设里偷选。

持久化的 visible consequence 只有重启后成员与 operator-name 保留、passcode 和登记 uiVariable 消失。值的具体编码由 persist-kv adapter 的实现设计负责，不进入 IA。

## 8. IA 交叉对账、完整性与验证分层

| 目标 | 最低证据 | 本批状态 |
| --- | --- | --- |
| 每个 screen/layer 具有业务结果、身份、入口、控件、错误、可访问性、空/加载/失败、超载行为 | 静态逐项对账 | READY_FOR_DESIGN_REVIEW |
| 五种不可画结果互不混淆 | render focused test 设计 + testID/诊断表 | READY_FOR_DESIGN_REVIEW |
| 两个 Provider 独立 | sample-console integration focused test | READY_FOR_DESIGN_REVIEW |
| Web 与 Android 的宿主形状都被声明 | 详设静态 + 后续 Web/真机分段 acceptance | READY_FOR_DESIGN_REVIEW |
| 真机 dual-screen、真实 display info、MMKV | 真机段 acceptance；Web 不可代证 | NOT_EXECUTED_BY_AUTHORIZATION |
| L2/人眼视觉 | 不在本批授权范围 | NOT_APPLICABLE_WITH_REASON:本批只写 IA/交互/详设/计划，无 L2 |

本文件没有把“浏览器启动成功”或“人眼看过”当作 IA 证据。

### 8.1 模板交叉对账

| 检查 | 判据 |
| --- | --- |
| IA ↔ 交互工件 | 同一业务 screen 的形态、入口、可见文案、单屏/双屏 confirm surface 与 testID 一致；`customer-member.confirm` 为单屏 PRIMARY / 双屏 SECONDARY；`IA-SAMPLE-HOST` 的 toggle、label、宿主 testID 一致 |
| IA ↔ 详设 | `containerKeys`、五种 fallback、两个 Provider、窄 reader、screen/layer owner、Android/Web 边界逐项一致；差异只保留 D-6 与 flex/absolute 等已显式 OPEN |
| IA-ID ↔ Journey | 9 个业务 IA-ID 可追溯到需求 §4.1 的 1–9 步，`IA-SAMPLE-HOST` 可追溯到宿主组装步骤与需求 §6.7a |
| 计数自证 | IA_SCOPE 的 10 个 ID = 表格中的 10 个 ID；可见/不可见两组逐项覆盖 |

### 8.2 完成判定

~~~text
IA_DIMENSIONS=IA-AUTH-LOGIN,IA-AUTH-NOTICE,IA-MEMBER-LIST,IA-MEMBER-FORM,IA-WAITING-CONFIRM,IA-REGISTRY-NOTICE,IA-CUSTOMER-WELCOME,IA-CUSTOMER-MEMBER-PREVIEW,IA-CUSTOMER-MEMBER-CONFIRM,IA-SAMPLE-HOST
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=YES
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=10 mapped
CROSS_CHECK_WITH_DESIGN=READY_FOR_INDEPENDENT_STATIC_REVIEW
DEXTER_WIREFRAME_REVIEW=UNSET
IA_STATUS=READY_FOR_DESIGN_REVIEW;不构成 implementation authorization
~~~

## 9. v13 输入一致性标记

v13 已将 D-B 与 §2.5.4／§6.8 对齐：`assembly/android/sample-terminal` 不增加 `display-context`，保留 5 个 adapter、`platform-ports`、`sample-console` 共 7 条依赖。v12 曾残留的「直接加依赖」是前提撤销后的历史矛盾，不再作为设计输入。

本 IA 按 v13 已收口的「initialProps 送达、assembly 不判断屏数、7 条依赖」形态记录；`sample-terminal` 不消费 `display-context`，也不为凑依赖添加空边。

另一个实现可行性闸门是 D-6：Android 当前 POC 的 secondary process 与自建 React 实例都不满足 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`。六项与承载机制正交的周边规格仍写入 IA，但承载 carrier 必须由一次单独授权的真机 spike 证明；本 IA 不执行 spike，也不把 POC 形态当成最终架构结论。
