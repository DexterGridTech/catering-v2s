SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# SAMPLE-MEMBER-REGISTRATION 门店会员登记交互工件（v13 重做与 D-6 修订）

## 1. 元数据、来源与授权

~~~text
JOURNEY_ID=SAMPLE-MEMBER-REGISTRATION
JOURNEY_DECISION=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md#§4.1
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md#§4.1
BUSINESS_PROBLEM=TER 各包单独通过但没有真实会员登记业务旅途，双 surface、命令、变量、屏数和持久化可能假绿
BUSINESS_USER_OR_OWNER=店员与顾客；sample-console integration owner
CURRENT_TASK=完成一次跨 PRIMARY/SECONDARY 的会员登记并在顾客确认后入已登记列表
SUCCESS_OUTCOME=顾客确认后 members 增加、pending 清空、店员列表更新、副屏回待机
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
IA_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-ia-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-implementation-design-codex.md
MOCKUP_DIR=NOT_APPLICABLE_WITH_REASON:本切片只需低保真交互工件，固定尺寸来自 sample-console 的 terminalSurfaces 声明
DEXTER_WIREFRAME_REVIEW=UNSET
DEXTER_HIFI_REVIEW=NOT_REQUIRED
IMPLEMENTATION_AUTHORITY=false
CONSUMER_FACE=public
L2_SCRIPT_ADMISSION=BLOCKED
~~~

本工件只回答用户看得见什么、在什么 surface 上、通过哪个控件完成什么动作，以及状态/失败/恢复的可见结果。
不授权实施，不授权 L2、DEV、seed、真机、UAT、部署；testID 是后续 focused test 与批准动作的稳定命名源，不是本轮创建脚本的授权。

用户旅途：店员登录 → 查看会员 → 录入姓名与电话 → 顾客在副屏核对并确认或拒绝 → 店员看到结果并继续。顾客确认是业务生效边界，未确认内容不能出现在已登记列表。

## 1.1 逐 screen/technical host surface 十项声明

本表把模板要求的十项声明落到每个业务 screen 及一个可见的 technical host surface。业务 screen 的 CONSUMER_FACE 都是 public；`sample-console.test-expo` 是验证宿主，不是产品 screen、catalog part 或业务 placement。APPLICATION_AFFILIATION 是独立的 TER sample 验证能力，不是已登录后台 shell。当前没有可复用的 admin-ui foundation Drawer/Modal/HTTP/候选组件；实现前仍需重开 foundation index 与实际消费者，若发现已有适用 export，详设必须改为真实复用。

| screen id | UI_SURFACE | HOST_AND_ENTRY | ACTOR | BUSINESS_SCENARIO | BUSINESS_GOAL | USER_VISIBLE_COPY | TECHNICAL_BOUNDARY | FOUNDATION_PRIMITIVE | CONTAINER_LAYOUT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sample.auth.login | 独立 screen | PRIMARY main；开机或 logout 后 | 店员 | 尚未认证 | 登录登记工作台 | 店员登录；工号；密码；登录；登录中；失败提示 | session actor、request ledger、uiVariable | NONE_WITH_REASON:无 Drawer/Modal/HTTP lifecycle，RN SurfaceRoot 无匹配 foundation export | PRIMARY logical canvas；表单与操作不横溢；唯一滚动为表单内容，标签与输入对齐 |
| sample.auth.notice | layer | PRIMARY；login failure 后打开 | 店员 | 登录失败 | 理解失败原因并关闭 | 登录失败原因；关闭 | reasonCode props；本包呈现 actor | NONE_WITH_REASON:轻量 layer，无共享 Drawer/Modal primitive | 覆盖在 PRIMARY canvas 内；提示换行；不遮 submit 操作 |
| sample.desk.member-list | 独立 screen | PRIMARY main；login success 后 | 店员 | 已认证 | 查看会员并开始新增 | 已登记会员；暂无会员；新增；退出 | owner selector selectMembers | NONE_WITH_REASON:无 HTTP/page lifecycle，列表在 runtime state 内 | fixed PRIMARY canvas；只有列表区纵向滚动；标题与 add/logout 固定可达 |
| sample.desk.member-form | 独立 screen | PRIMARY main；add 后 | 店员 | 开始新增 | 录入姓名与电话 | 新增会员；姓名；电话；提交；提交中 | desk variables；submit actor | NONE_WITH_REASON:无 Drawer/Modal/HTTP primitive | fixed PRIMARY canvas；字段错误换行；唯一滚动为表单区 |
| sample.desk.waiting-confirm | layer | PRIMARY；pending 双屏提交后 | 店员 | 等待顾客 | 知道提交已等待确认 | 已提交，等待顾客确认 | pending selector；standard layer | NONE_WITH_REASON:只读轻量 layer | layer 不产生第二滚动祖先；文本不溢出且不挡副屏 |
| sample.desk.registry-notice | layer | PRIMARY；rejected/业务失败后 | 店员 | 登记未成功 | 理解结果并关闭 | 登记未完成；原因；知道了 | reasonCode props；desk notice actor | NONE_WITH_REASON:只读轻量 layer | alert 在 standard 之后；文本滚动只在提示内容，不遮操作 |
| sample.desk.customer-welcome | 独立 screen | SECONDARY main；双屏开机或结果完成后 | 顾客 | 等待店员提交 | 知道可以继续等待 | 欢迎；请等待店员操作 | explicit displayMode；无业务写入 | NONE_WITH_REASON:无交互 surface/HTTP/lifecycle primitive | SECONDARY logical canvas；内容居中；无页面滚动 |
| sample.desk.customer-member.preview | 独立 screen | SECONDARY main；店员点新增后 | 顾客 | 店员正在录入 | 看到当前待登记信息 | 请核对会员信息；姓名；电话；等待店员提交登记 | uiVariable reader；props mode=preview | NONE_WITH_REASON:只读 screen，无共享 primitive | SECONDARY canvas；字段不横溢出；无滚动 |
| sample.desk.customer-member.confirm | 独立 screen | 双屏 SECONDARY、单屏 PRIMARY main；submit 后 | 顾客（单屏由店员将设备交给顾客） | pending 已产生 | 确认或拒绝登记 | 请确认登记；姓名；电话；确认；拒绝 | owner selector；public commands | NONE_WITH_REASON:无 Drawer/Modal/HTTP primitive | 按实际 displayMode 使用对应 logical canvas；动作区不横溢出；唯一滚动为信息区 |
| IA-SAMPLE-HOST / sample-console.test-expo | technical host surface（非业务 screen） | Web test-expo host；由 validation operator 进入 | validation operator | 比较单屏/双屏外壳形态 | 在干净态切换并重跑场景 4–7 | 单屏/双屏切换；不承载业务文案 | surfaceMode shell state；DevicePort binding；不进 catalog/placement | NONE_WITH_REASON:仅验证外壳，不是产品 UI primitive | 按 terminalSurfaces 固定逻辑尺寸挂一/两棵树；同一 root 下两个 Provider；`sample-console:test-expo:surface-toggle`；label 可见、按钮键盘可达 |

每个业务 screen 与 technical host 的公开面和应用归属单独逐项声明如下；本旅途是独立 public 能力，不是 `platform-admin` 或 `operations-admin` 的已登录 shell/session：

| screen id | CONSUMER_FACE | APPLICATION_AFFILIATION |
| --- | --- | --- |
| sample.auth.login | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.auth.notice | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.desk.member-list | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.desk.member-form | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.desk.waiting-confirm | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.desk.registry-notice | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.desk.customer-welcome | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.desk.customer-member.preview | public | 独立 public 能力；不是已登录后台 shell/session |
| sample.desk.customer-member.confirm | public | 独立 public 能力；不是已登录后台 shell/session |
| sample-console.test-expo | internal validation surface | sample-console test-expo 宿主；不是产品 screen、catalog part 或 public business face |

## 1.2 v2 对应页面盘点

本旅途是 TER 验证切片，不是既有 all-v2 业务页面的迁移。当前静态检索范围是本仓 v2s 的 terminal sample 需求、现有 render/ui-state source、用户指定的 newPOSv1 与 _old_ POC；未把 POC 当作 runtime/build fallback。以下均为 NO_V2_COUNTERPART，低保真线框由本需求 §4.1 的新旅途定义；若后续发现 frozen Heritage 页面，必须在实现前补 path@SHA 与差异说明。

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线/摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| sample.auth.login | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.1 | 新 sample 旅途登录，不继承 POC 运行形态 |
| sample.auth.notice | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.2 | 新 sample 失败呈现 |
| sample.desk.member-list | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.3 | 新会员事实 owner |
| sample.desk.member-form | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.4 | 新登记输入 |
| sample.desk.waiting-confirm | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.5 | 新跨 surface 等待层 |
| sample.desk.registry-notice | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.6 | 新业务失败层 |
| sample.desk.customer-welcome | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.7 | 新顾客 surface |
| sample.desk.customer-member.preview | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.8 | 新顾客预览 mode |
| sample.desk.customer-member.confirm | NO_V2_COUNTERPART | PENDING_HERITAGE_REGISTRATION | v13 §4.1 + 本工件 4.9 | 新顾客确认 mode |
| sample-console.test-expo | NO_V2_COUNTERPART | NOT_APPLICABLE_WITH_REASON | v13 §6.7a + 本工件 4.10 | 验证宿主，不是业务页面 |

## 1.3 SEARCH_CAPABILITY_DENOMINATOR

本旅途没有经批准的搜索、筛选、候选选择或远程候选任务；会员列表只读取 owner 已登记集合，不把展示行伪装成搜索能力。每个 screen 均明确标记为不适用，并回指本工件 §3 与需求 §4.1 的用户任务。

| screen id | SEARCH_CAPABILITY_DENOMINATOR | 原因 |
| --- | --- | --- |
| sample.auth.login | NOT_APPLICABLE_WITH_REASON | 登录任务只提交已知工号与密码，不寻找业务对象；无 search contract |
| sample.auth.notice | NOT_APPLICABLE_WITH_REASON | 失败提示只有关闭动作，不寻找或选择业务对象 |
| sample.desk.member-list | NOT_APPLICABLE_WITH_REASON | 本轮只展示 owner 的已登记 members，不提供筛选/搜索；需求 §4.1 未批准搜索任务 |
| sample.desk.member-form | NOT_APPLICABLE_WITH_REASON | 录入姓名和电话是直接编辑，不是从候选集合选择 |
| sample.desk.waiting-confirm | NOT_APPLICABLE_WITH_REASON | 等待层没有查询或候选控件 |
| sample.desk.registry-notice | NOT_APPLICABLE_WITH_REASON | 结果提示没有查询或候选控件 |
| sample.desk.customer-welcome | NOT_APPLICABLE_WITH_REASON | 待机欢迎面没有查询或候选控件 |
| sample.desk.customer-member.preview | NOT_APPLICABLE_WITH_REASON | 只读预览共享输入，不寻找或选择业务对象 |
| sample.desk.customer-member.confirm | NOT_APPLICABLE_WITH_REASON | 只确认当前 pending，不寻找或选择业务对象 |
| sample-console.test-expo | NOT_APPLICABLE_WITH_REASON | 外壳切换控件只改变验证形态，不寻找或选择业务对象 |

## 2. 统一视觉与交互规则

### 2.1 Surface 与容器

每一个 SurfaceRoot 接收显式 displayMode。PRIMARY 通常挂店员工作台；单屏 confirm 时按 actor 的明确放置临时呈现 customer-member，供店员将主屏交给顾客。SECONDARY 只挂顾客内容。普通 screen 的 catalog 准入为 main；layer part 的 containerKeys 为空，层由明确的 show/open/close 命令放置，不把空数组当成放置键。

Web 是一个 React root 下的两棵兄弟树，每棵树各自拥有 RenderProvider：

~~~text
sample-console test-expo
└── root
    ├── RenderProvider(displayMode=PRIMARY)
    │   └── SurfaceRoot(PRIMARY)
    └── RenderProvider(displayMode=SECONDARY)
        └── SurfaceRoot(SECONDARY)
~~~

单屏时只挂 PRIMARY；双屏时挂两棵。切换按钮只在 test-expo 外壳，干净态切换后重跑旅途；不模拟业务中的热插拔，不重建 runtime。

Android 的目标是两个 Root Surface、一个 JS VM、一个 store；主屏与副屏使用同一个已注册组件，Kotlin 同步传 displayIndex 与 displayCount。具体 carrier 由 D-6 `OPEN-DUALSCREEN-SINGLE-VM-CARRIER` 的单独真机 spike 决定。POC 的独立 secondary process 与自建 React 实例都不是可照抄形态；同进程 Presentation 只有在复用同一 ReactHost／ReactSurface 且实证单 VM／单 store 时才可作为候选。若当前 Expo/RN 无法保持单 VM/单 store/多 surface，必须停下来交 Dexter，不得自行退回第二 VM、独立进程、独立 store 或独立 React 实例。

### 2.2 固定逻辑尺寸

sample-console 的 package.json 是尺寸唯一来源：

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

外壳使用两个独立逻辑画布，resize 只等比缩放整体，不改变画布宽高比；layout 改为 column 时仅改变两个画布的排布。内部部件到底采用 flex 还是绝对定位仍是 Dexter 的产品/UI 决策，本工件不替他决定。

### 2.3 文案与诊断

文案属于 catalog 或部件定义，不进入 Redux state、命令载荷或持久化载荷。业务失败只展示可供用户行动的 reasonCode 对应文案，不显示 raw exception、token、密码、原始 payload。

五种画不出结果拥有不同 testID 语义：

| 结果 | 可见处理 | testID 语义 | 诊断族 |
| --- | --- | --- | --- |
| runtime-unavailable | 显示运行时暂不可用兜底 | runtime-unavailable | RenderRuntimeObservation |
| container-empty | 显示容器为空兜底 | container-empty | 无 part 诊断 |
| missing-catalog-entry | 显示部件不存在兜底 | missing-catalog-entry | RenderPartDiagnostic |
| missing-renderer | 显示 renderer 不存在兜底 | missing-renderer | RenderPartDiagnostic |
| invalid-props | 不调用业务组件，显示属性非法兜底 | invalid-props | RenderPartDiagnostic |

底层布局可共享，但五种结果不得共享相同 testID、错误原因或诊断类别。runtime-unavailable 与 container-empty 是两个事实，不能复用一个“空页面”语义。

## 3. 交互地图

| 步骤 | 用户与动作 | PRIMARY | SECONDARY | 业务结果 |
| --- | --- | --- | --- | --- |
| 0 | 开机 | staff-login | 双屏为 customer-welcome；单屏没有 SECONDARY | 尚未认证 |
| 1 | 店员提交错误凭据 | staff-login 与 auth notice | customer-welcome 保持 | session 仍 anonymous，request failed |
| 2 | 店员提交正确凭据 | member-list | 双屏 customer-welcome 保持 | session authenticated |
| 3 | 店员点击新增 | member-form | 双屏 customer-member preview | 变量开始承载登记输入 |
| 4 | 店员提交登记 | member-list 与 waiting-confirm layer（双屏）；customer-member confirm（单屏） | customer-member confirm（双屏 SECONDARY） | pending 已产生，等待顾客决定 |
| 5a | 顾客确认 | member-list，waiting 消失 | customer-welcome | members 增加，pending 清空 |
| 5b | 顾客拒绝 | 双屏为 member-list + waiting-confirm + registry notice；单屏为 member-form + registry notice | 双屏为 customer-member preview；单屏无 SECONDARY | pending 清空，members 不增加 |
| 6 | 店员关闭结果层 | 双屏回 member-form 并清 waiting/notice；单屏保持 member-form 并清 notice | 双屏保持 customer-member preview；单屏无 SECONDARY | 只关闭呈现层，不改已登记事实 |
| 7 | 店员退出 | login screen，所有 PRIMARY layer 清空 | 双屏 customer-welcome，SECONDARY layer 清空 | session anonymous，两个 displayMode 的层都清空 |

## 3.1 表单控件依赖图

| screen | 用户可见控件 | 控件形态 | 初始值来源 | 上游依赖与可用条件 | 变更后的级联 | loading/empty/failed | submit owner 最终复核 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sample.auth.login | operator-name | 文本输入 | sample.login.operator-name defaultValue | 无；anonymous 且 runtime started | 不清理 operator-name on login failure | loading 禁止重复 submit；失败保留值 | staff-session actor 校验 credentials |
| sample.auth.login | passcode | 密码输入 | sample.login.passcode defaultValue | 无；anonymous 且 runtime started | loginFailed 后清空 passcode | loading 禁止重复 submit；失败可重新输入 | staff-session actor 校验 credentials |
| sample.desk.member-form | name | 文本输入 | sample.member.name defaultValue | authenticated 且 member-form 在 PRIMARY | confirmed 后清空；rejected 保留供重填 | submit loading；失败保留值 | member-registry submit actor |
| sample.desk.member-form | phone | 文本输入 | sample.member.phone defaultValue | authenticated 且 member-form 在 PRIMARY | confirmed 后清空；rejected 保留供重填 | submit loading；失败保留值 | member-registry submit actor |
| sample.desk.customer-member.preview | name/phone | 只读文本 | module-bound uiVariable reader | SECONDARY tree 且 preview mode | submit 后转 confirm；结果后不保留旧 preview | pending 不存在时不造值 | 无写入；owner selector/reader 只读 |
| sample.desk.customer-member.confirm | confirm | 按钮 | 无 | pending 存在且 confirm mode | confirmed 后回 welcome | in-flight 禁止二次确认；失败保留 pending | member-registry confirm actor |
| sample.desk.customer-member.confirm | reject | 按钮 | 无 | pending 存在且 confirm mode | 双屏 rejected 后回 preview；单屏回 member-form | in-flight 禁止二次拒绝；失败保留 pending | member-registry reject actor |

## 3.2 mutation fact matrix

本旅途没有 HTTP request 或 OpenAPI request；下表以 owner command variant 为分母，不把相近的两个结果合并。

| FORM_MUTATION_DENOMINATOR / 业务事实 | 用户可见控件 | 分类 | 原始来源 | command 取值与唯一来源 | 变更/校验 | owner 最终复核 | 失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| loginCommand.operatorName | operator-name | EDITABLE | SAMPLE-MEMBER-REGISTRATION §4.1 | operator-name uiVariable reader | 不为空并由 staff-session 校验 | login actor | 保留输入、request failed |
| loginCommand.passcode | passcode | EDITABLE | SAMPLE-MEMBER-REGISTRATION §4.1 | passcode uiVariable reader | 不为空并由 staff-session 校验 | login actor | 清 passcode、显示 auth notice |
| submitMemberCommand.name | member-form:name | EDITABLE | SAMPLE-MEMBER-REGISTRATION §4.1 | name uiVariable | pending 生成前校验 | registry submit actor | 保留输入 |
| submitMemberCommand.phone | member-form:phone | EDITABLE | SAMPLE-MEMBER-REGISTRATION §4.1 | phone uiVariable | pending 生成前校验 | registry submit actor | 保留输入 |
| confirmMemberCommand | customer-member:confirm | FIXED_READONLY | SAMPLE-MEMBER-REGISTRATION §4.1 | 无业务字段，仅 requestId | pending 非 null；生成 memberId/registeredAt | registry confirm actor | 无 pending 抛错，不改 members |
| rejectMemberCommand | customer-member:reject | FIXED_READONLY | SAMPLE-MEMBER-REGISTRATION §4.1 | 无业务字段，仅 requestId | pending 非 null | registry reject actor | 不写 members，保留可重新登记路径 |

## 3.3 Surface ownership roster

业务线框中的元素只属于当前业务 screen；shell toggle 属于 `sample-console.test-expo` 技术宿主，不画入业务 screen，也不进入 catalog/placement 分母。

| screen | 元素分母 | 每项归属 | USER_VISIBLE_COPY 是否逐项有位置 | 结论 |
| --- | --- | --- | --- | --- |
| sample.auth.login | 标题、工号、密码、登录、loading | 当前 PRIMARY screen | 是 | PASS_FOR_STATIC_REVIEW |
| sample.auth.notice | message、dismiss | 当前 PRIMARY layer | 是 | PASS_FOR_STATIC_REVIEW |
| sample.desk.member-list | 标题、rows、add、logout、empty | 当前 PRIMARY screen | 是 | PASS_FOR_STATIC_REVIEW |
| sample.desk.member-form | 标题、name、phone、submit、loading | 当前 PRIMARY screen | 是 | PASS_FOR_STATIC_REVIEW |
| sample.desk.waiting-confirm | message | 当前 PRIMARY layer | 是 | PASS_FOR_STATIC_REVIEW |
| sample.desk.registry-notice | message、dismiss | 当前 PRIMARY layer | 是 | PASS_FOR_STATIC_REVIEW |
| sample.desk.customer-welcome | message | 当前 SECONDARY screen | 是 | PASS_FOR_STATIC_REVIEW |
| sample.desk.customer-member.preview | name、phone、waiting | 当前 SECONDARY screen | 是 | PASS_FOR_STATIC_REVIEW |
| sample.desk.customer-member.confirm | name、phone、confirm、reject | 单屏 PRIMARY / 双屏 SECONDARY screen | 是 | PASS_FOR_STATIC_REVIEW |
| sample-console.test-expo | surfaceMode label、surface toggle | test-expo technical host | 是；`sample-console:test-expo:surface-toggle` | PASS_FOR_STATIC_REVIEW |

## 4. 逐屏低保真工件

下列线框只声明元素、顺序、动作与状态，不决定部件内部 flex/absolute 方案。每个 testID 都按需求 §8 的 partKey 加冒号加 element 规则落成。

### 4.1 登录屏：sample.auth.login

~~~text
┌──────────────────────────────────────────────┐
│ 店员登录                                      │
│                                              │
│ 工号     [ sample.auth.login:operator-name ] │
│ 密码     [ sample.auth.login:passcode      ] │
│                                              │
│             [ sample.auth.login:submit      ] │
│             [ sample.auth.login:loading     ] │
└──────────────────────────────────────────────┘
~~~

- surface：PRIMARY；screen；容器 main；displayModes 仅 PRIMARY。
- submit 写两个 uiVariable 后派 loginCommand；public 命令显式带 requestId。
- loading 期间按钮不可重复触发；失败保留输入，显示 auth notice；成功由 desk actor 导航到 member-list。
- 初始值来自声明 defaultValue，不把 passcode 读成已持久化事实。

### 4.2 登录结果层：sample.auth.notice

~~~text
┌──────────────────────────────────────────────┐
│ 登录失败：请检查工号或密码                   │
│                 [ sample.auth.notice:dismiss ] │
└──────────────────────────────────────────────┘
~~~

- surface：PRIMARY；layer；containerKeys 为空；layerTier 为 alert。
- 文案由 reasonCode 映射；不显示 raw exception；dismiss 只派本包自有 authNoticeDismissedCommand。
- 无 notice 时 part 不存在；notice 不能被当作 container-empty。

### 4.3 会员列表：sample.desk.member-list

~~~text
┌──────────────────────────────────────────────┐
│ 已登记会员             [ sample.desk.member-list:logout ] │
│ ┌──────────────────────────────────────────┐ │
│ │ sample.desk.member-list:row × n           │ │
│ └──────────────────────────────────────────┘ │
│ [ sample.desk.member-list:add ]               │
│ [ sample.desk.member-list:logout ]            │
└──────────────────────────────────────────────┘
~~~

- surface：PRIMARY；screen；main；displayModes 仅 PRIMARY。
- rows 由 sample-member-registry 的 selectMembers 读取；部件不得按字符串键裸读 slice。
- 空列表有业务空说明；没有独立网络 loading/error，runtime-unavailable 是另一个事实。
- 长列表只在列表区域滚动，标题与 add/logout 操作仍可达。row 的稳定 testID 是 partKey 加冒号加 row，具体行索引不得成为身份。

### 4.4 登记表单：sample.desk.member-form

~~~text
┌──────────────────────────────────────────────┐
│ 新增会员                                      │
│ 姓名     [ sample.desk.member-form:name     ] │
│ 电话     [ sample.desk.member-form:phone    ] │
│                                              │
│         [ sample.desk.member-form:submit     ] │
│         [ sample.desk.member-form:loading    ] │
└──────────────────────────────────────────────┘
~~~

- surface：PRIMARY；screen；main；displayModes 仅 PRIMARY。
- name/phone 只写 sample.member.name 与 sample.member.phone uiVariable；不使用本地状态保存业务值。
- submit 派 submitMemberCommand，显式带 requestId；失败保留变量值和错误可见性。
- 双屏时提交成功导航由 desk actor 产生 waiting 与副屏 confirm；部件本身不决定 screen。

### 4.5 等待层：sample.desk.waiting-confirm

~~~text
┌──────────────────────────────────────────────┐
│ 已提交，等待顾客确认                          │
│        sample.desk.waiting-confirm:message    │
└──────────────────────────────────────────────┘
~~~

- surface：PRIMARY；layer；containerKeys 为空；layerTier 为 standard。
- 只在 pending 存在且双屏路径成立时出现；无 confirm/reject 控件，避免店员绕过顾客确认。
- 内容不挡住 SECONDARY；与 alert 同时出现时 standard 先于 alert。

### 4.6 登记结果层：sample.desk.registry-notice

~~~text
┌──────────────────────────────────────────────┐
│ 登记结果：reasonCode 对应提示                 │
│        sample.desk.registry-notice:message    │
│        [ sample.desk.registry-notice:dismiss ] │
└──────────────────────────────────────────────┘
~~~

- surface：PRIMARY；layer；containerKeys 为空；layerTier 为 alert。
- rejected 或业务失败才在此层呈现对应 reasonCode；confirmed 不创建此层而回到列表成功路径；dismiss 只关闭层，不改变 members/pending。
- standard 与 alert 同时在场时 alert 在后；单屏没有 waiting 层时不虚构排序。

### 4.7 顾客待机：sample.desk.customer-welcome

~~~text
┌──────────────────────────────────────────────┐
│                 欢迎                          │
│      sample.desk.customer-welcome:message     │
└──────────────────────────────────────────────┘
~~~

- surface：SECONDARY；screen；main；displayModes 仅 SECONDARY。
- 双屏时由 auth/desk 结果事件导航到此；单屏不创建 SECONDARY tree。
- 无动作控件，不通过顾客屏反推店员流程；不读 displayCount 或平台环境。

### 4.8 顾客会员预览：sample.desk.customer-member，mode=preview

~~~text
┌──────────────────────────────────────────────┐
│ 请核对会员信息                                │
│ 姓名     当前输入的姓名                       │
│ 电话     当前输入的电话                       │
│ 等待店员提交登记                              │
└──────────────────────────────────────────────┘
~~~

- surface：SECONDARY；screen；main；part 同时准入 PRIMARY/SECONDARY，但当前预览只由 SECONDARY 放置。
- 数据来自 owner selector 与登记 uiVariable；props 只携带 mode，不携带函数或业务实体。
- preview 只读展示已输入的共享变量；confirm/reject 只在 mode=confirm 的后续状态出现。
- pending 缺失时不造空会员，不显示过时值。

### 4.9 顾客确认操作：sample.desk.customer-member，mode=confirm

~~~text
┌──────────────────────────────────────────────┐
│ 请确认登记                                    │
│ 姓名     待登记姓名                           │
│ 电话     待登记电话                           │
│ [ sample.desk.customer-member:confirm ]       │
│ [ sample.desk.customer-member:reject  ]       │
└──────────────────────────────────────────────┘
~~~

- surface：单屏 PRIMARY、双屏 SECONDARY；screen；main；同一个 part 的 props mode 为 confirm。
- 待登记数据由 owner selector 与登记变量读取；两个按钮分别派 confirmMemberCommand 与 rejectMemberCommand。
- 顾客作出结果后由领域事件驱动离开此 mode；confirmed/rejected 不在此 part 内伪造成功文案。
- 未确认不得显示已登记成功；runtime-unavailable 使用自己的兜底 testID。

### 4.10 test-expo 技术宿主控制

~~~text
┌──────────────────────────────────────────────┐
│ TER sample verification host                 │
│ 形态：单屏 / 双屏                            │
│ [ sample-console:test-expo:surface-toggle ]  │
└──────────────────────────────────────────────┘
~~~

- 这是 `sample-console` 的 Web 验证宿主，不是业务 screen、catalog part、placement 目标或业务命令来源。
- 按钮只翻转宿主 `surfaceMode`；同一状态同时驱动 test-expo 的 `DevicePort.getDisplayInfo()` 和一/两棵 surface tree。切换在干净态执行，runtime、store 与已登记 members 保持，不承诺流程中途热插拔。
- label 可见、按钮键盘可达，真实 action node 使用 `sample-console:test-expo:surface-toggle`；S-25 通过该控制分别重跑单屏与双屏场景。

## 5. 交互状态与边界

| 状态 | PRIMARY | SECONDARY | 可执行动作 | 不得发生 |
| --- | --- | --- | --- | --- |
| runtime 未可用 | runtime-unavailable | runtime-unavailable 或未挂载 | 无业务动作 | 不调用 getState，不以空容器冒充 |
| anonymous 单屏 | login | 无 | 填写、登录 | 不出现顾客确认 |
| anonymous 双屏 | login | welcome | 店员登录 | 不由顾客屏发 login |
| login loading | login + loading | 保持当前待机 | 不能重复 submit | 不生成第二 request |
| authenticated | member-list | 双屏 welcome | add、logout | 部件不直接 dispatch |
| form | member-form | 双屏 preview | 填写、submit | 屏数判断不进部件 |
| pending 双屏 | list + waiting | member confirm | 顾客 confirm/reject | 店员不能绕过顾客 |
| confirmed | list + 可见结果 | confirm 后 welcome | 继续新增 | members 未确认即出现 |
| rejected | form + registry notice | 双屏为 customer-member preview；单屏无 SECONDARY | dismiss、重新编辑 | rejected 写入 members |
| logout | login，layers 清空 | welcome，layers 清空 | 重新登录 | 只清一个 displayMode |

五种渲染失败有独立的可见 variant；层级、文案、诊断类别与业务错误不可相互改写。

## 6. 控件与 testID roster

| part | 控件 | 稳定 testID | 动作 owner |
| --- | --- | --- | --- |
| sample.auth.login | 工号输入 | sample.auth.login:operator-name | uiVariable 写入 |
| sample.auth.login | 密码输入 | sample.auth.login:passcode | uiVariable 写入 |
| sample.auth.login | 登录 | sample.auth.login:submit | 部件经 useDispatchCommand |
| sample.auth.login | loading | sample.auth.login:loading | request observer |
| sample.auth.notice | 提示 | sample.auth.notice:message | 只读 |
| sample.auth.notice | 关闭 | sample.auth.notice:dismiss | 本包呈现命令 |
| sample.desk.member-list | 会员行 | sample.desk.member-list:row | owner selector 读取 |
| sample.desk.member-list | 新增 | sample.desk.member-list:add | 本包呈现命令 |
| sample.desk.member-list | 退出 | sample.desk.member-list:logout | dispatch facade |
| sample.desk.member-form | 姓名输入 | sample.desk.member-form:name | uiVariable 写入 |
| sample.desk.member-form | 电话输入 | sample.desk.member-form:phone | uiVariable 写入 |
| sample.desk.member-form | 提交 | sample.desk.member-form:submit | dispatch facade |
| sample.desk.member-form | loading | sample.desk.member-form:loading | request observer |
| sample.desk.waiting-confirm | 等待文本 | sample.desk.waiting-confirm:message | 只读 |
| sample.desk.registry-notice | 结果文本 | sample.desk.registry-notice:message | 只读 |
| sample.desk.registry-notice | 关闭 | sample.desk.registry-notice:dismiss | 本包呈现命令 |
| sample.desk.customer-welcome | 欢迎文本 | sample.desk.customer-welcome:message | 只读 |
| sample.desk.customer-member | 姓名/电话 | sample.desk.customer-member:name、sample.desk.customer-member:phone | owner selector/variables |
| sample.desk.customer-member | 确认 | sample.desk.customer-member:confirm | dispatch facade |
| sample.desk.customer-member | 拒绝 | sample.desk.customer-member:reject | dispatch facade |
| sample-console.test-expo | 单/双屏形态切换 | sample-console:test-expo:surface-toggle | test-expo shell state |

testID 必须落在真实输入、按钮或可观察元素上；后续若进入 L2，必须先有对应 app TestIds 常量、focused proof 和独立复核，禁止用文本、role、placeholder、索引或宽选择器替代。

## 7. 操作合理性与 owner

| 操作 | 用户任务关系 | 当前 surface | owner | 更小替代为何不取 |
| --- | --- | --- | --- | --- |
| 登录 | 进入登记工作台 | PRIMARY | sample-staff-auth UI + staff-session kernel | 直接改 session 会绕过 actor 与 request ledger |
| 新增 | 开始一次登记 | PRIMARY | sample-member-desk UI | 把表单塞进 kernel 会让 kernel 依赖界面 |
| 提交 | 产生 pending，等待顾客 | PRIMARY | member-desk 部件派 public command，registry kernel 写事实 | 部件直接写 slice 会破坏 TR-01 |
| 确认/拒绝 | 顾客明确作出结果 | 单屏 PRIMARY / 双屏 SECONDARY | customer-member 部件派两个独立命令 | boolean 命令会丢失领域结果语义 |
| 关闭提示 | 关闭当前呈现 | 产生提示的 UI feature | 本包呈现 actor | 跨包提供通用 navigation bridge 会扩大公共面 |
| 退出 | 结束店员 session | PRIMARY | staff-auth UI 发命令，kernel owner 写 session | 部件清业务状态会越过 owner |
| 单/双屏切换 | 开发外壳比较两种部署形态 | test-expo | shell state + injected DevicePort | 不是业务控件，放进 feature 会污染范本 |

## 8. Web/Android 交互验收边界

Web 段验证相同的业务树形状、双 Provider 独立、单/双屏外壳切换、固定 logical surface；test-expo 的 DevicePort 闭包与挂载树数量必须读同一 shell state。`sample-console.test-expo` 的 toggle 是宿主控制，不是业务 part。
Android 段才验证 D-6 收口后的双屏 carrier、目标 displayId、同步 initialProps、真实 getDisplayInfo 和 MMKV。Web 看到双 Surface 不代表 Android 双屏机制完成，也不替代单 VM／单 store 的真机证明。

这份工件不主张自动化或人眼视觉验收已完成。UI_DESIGN_REVIEW 与 TESTID_REVIEW 仍为 UNSET；实现前需按每个实际动作重新做 owning source 对账。

输入一致性已按 v13 收口：`sample-terminal` 保留五个 adapter、`platform-ports`、`sample-console` 共七条依赖，不增加 `display-context` 边；屏数/屏身份由 dual-screen adapter 的启动参数周边送达，assembly 不判断屏数。D-6 只阻塞单 VM/单 store carrier 与其真机接线，不重新打开依赖选择。

## 9. 交付状态

~~~text
INTERACTION_DESIGN_STATUS=READY_FOR_STATIC_REVIEW
OPEN_PRODUCT_DECISION=部件内部布局采用 flex 还是绝对定位
OPEN_IMPLEMENTATION_FEASIBILITY=D-6：单 VM/单 store/多 Root Surface 的 Android carrier 需 Dexter 另行授权真机 spike；不可由本工件推断或以双 VM替代
NOT_IN_SCOPE=屏幕缓存、screenReady/loading 机制、automation provider、navigation bridge、热插拔、双机/localWebServer、L2/DEV/UAT
~~~
