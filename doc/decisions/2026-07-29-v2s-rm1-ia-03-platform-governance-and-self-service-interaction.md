---
title: RM1 P6 IA-03 平台治理与本人安全交互
status: DEXTER_ACCEPTED_FOR_IMPLEMENTATION_FACING_REFREEZE
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# IA-03 平台治理与本人安全交互

```text
JOURNEY_DECISION=doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md#scenario-d04-s01-s02
BUSINESS_REQUIREMENT_SOURCE=doc/decisions/2026-07-29-v2s-rm1-p6-interaction-preparation-and-refreeze-design.md#10-22-surface-25-pagedesignkey-交互总台账dexter-指令2026-07-29
BUSINESS_PROBLEM=平台人员需要在已选择集团空间的边界内治理管理员、角色、空间账号和字段配置，并只读查看组织/合同；同时每位已登录平台人员必须安全地修改本人密码。R5 粗线框不足以让实施者知道每个用户任务、面和依赖。
BUSINESS_USER_OR_OWNER=具有相应平台治理资格的运维管理员；最终事实分别由 platform-IAM、workspace-IAM、platform-workspace、organization、contract owner 读回。
CURRENT_TASK=补齐 PLATFORM-ADMIN-USERS、PLATFORM-ORGANIZATION-OVERVIEW、PLATFORM-CONTRACT-OVERVIEW、PLATFORM-ROLES、PLATFORM-WORKSPACE-ACCOUNTS、PLATFORM-EXTENSION-FIELDS、PLATFORM-PASSWORD 的严格 IA。
SUCCESS_OUTCOME=管理员仅通过其获准的页面和上下文动作完成治理或只读核对；无授权/冲突/失败不被伪装为成功或空数据。
UI_BEARING=true
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=platform-admin（运维管理后台）
```

## 1. 原始来源、基线与不可扩展边界

| surface | 原始业务来源 | Heritage 静态基线 | 本稿边界 |
| --- | --- | --- | --- |
| PLATFORM-ADMIN-USERS | D04-S11 | `PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd`、详情/表单 Drawer | 禁止 default/root；列表名称→详情→上下文动作 |
| PLATFORM-ORGANIZATION-OVERVIEW | D02-S06 | `OrganizationOverviewPage.tsx@72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829` | 只读搜索与详情，不变成组织管理页 |
| PLATFORM-CONTRACT-OVERVIEW | D03-S06 | `ContractOverviewPage.tsx@932784738052ab15f1733900b6d47e29718e0334b8f3e0a32fac8b76f363dfe0` | 只读合同，不新增失效/编辑 |
| PLATFORM-ROLES | D04-S01/S02 | `RoleManagementPage.tsx@45111b3d93310ffdbe7a3700822bf76a3d0630ac3917b21ede091996dea7efe0` | 页面准入与动作能力两棵树独立、一次原子保存 |
| PLATFORM-WORKSPACE-ACCOUNTS | D04-S03 | `WorkspaceAccountManagementPage.tsx@f91df607180aebc2354e7e811c9abcb316121f24bc121b711314280cb207011e` | 单一账号内容页；邀请任务仅由 IA01 的 operations-admin target-specific 页面承接 |
| PLATFORM-EXTENSION-FIELDS | D01-S07P | `ExtensionFieldManagementPage.tsx@4d23ecd15dcfe641c38c3292076c1ebb452f309fb36a4e1d59c9729ee554cc4e` | 整组定义一次保存，禁止逐行 mutation/操作列 |
| PLATFORM-PASSWORD | D04-S12P | `PlatformPasswordChangeDrawer.tsx@7f628b6e14e5b4965d59db9282b6e3aa78a85cf851b823e2f182f381c143dc57` | 只改本人密码；成功后重新登录 |

所有列表遵循名称/业务标识链接→详情 Drawer→关闭详情后才打开下一 Drawer/Modal；筛选、分页、排序、刷新仅在原始页面已存在且表中明确时保留。未选择集团空间时，受该上下文约束的页面显示业务提示且不发任务读取；不以 URL 或本地猜测补足上下文。

## 2. Screen 准入与线框

下表每行是一个独立 screen；`F` 为 foundation primitive，`O` 为最终 owner/readback。所有错误、冲突、超时均保留最后确认数据，显示业务提示并让用户重试或关闭，绝不显示 contract/error-code。

| screen | surface/形态/入口 | actor、场景、业务目标 | 用户可见文案与低保真线框 | F / 技术边界 / O |
| --- | --- | --- | --- | --- |
| IA03-ADMIN-LIST | 内容页；平台管理员管理菜单 | 平台治理者查找或新建管理员 | `运维管理员管理 [新建管理员]`；筛选“姓名/登录账号/状态”；表“姓名(链接)/账号类型/登录账号/状态/最近登录/更新时间” | `contextScopedQueryArgs,testId`；分页/筛选参数不展示；platform-IAM list |
| IA03-ADMIN-DETAIL | Drawer；点击管理员姓名 | 先核对资料和审计，再决定下一动作 | `管理员详情 [编辑][重置登录凭据][启用/停用]`；姓名、账号、手机号、状态、最近登录、审计摘要 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；id/version 不展示；platform-IAM detail |
| IA03-ADMIN-CREATE | Drawer；列表页头新建 | 创建独立管理员，不预设根账号 | `新建管理员`；登录账号、姓名、手机号、初始密码、确认密码、取消/创建 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；密码不回显；platform-IAM create |
| IA03-ADMIN-EDIT | Drawer；先关闭详情后打开 | 修正管理员资料 | `编辑管理员资料`；登录账号只读、姓名、手机号、取消/保存 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；version 不展示；platform-IAM update |
| IA03-ADMIN-CREDENTIAL | Drawer；先关闭详情后打开 | 为无法登录的管理员设置新的登录密码 | `重置登录凭据`；目标账号、新登录密码、确认新登录密码、确认/取消 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,useOverlayLock,testId`；秘密不回显或进入草稿/日志；platform-IAM credential reset |
| IA03-ADMIN-STATUS | Modal；详情上下文动作 | 明确确认启用或停用管理员 | `确认启用/停用“<姓名>”？ [取消][确认]` | `useOverlayLock,useSubmissionLifecycle,testId`；状态枚举不展示；platform-IAM transition |
| IA03-ORG-OVERVIEW | 内容页；组织概览菜单 | 平台人员只读检索经营组织事实 | `组织概览`；Tab“组织架构/品牌/经营租户/总公司/门店”，当前 Tab 的业务搜索与列表 | `contextScopedQueryArgs,testId`；查询条件不展示；organization task read |
| IA03-ORG-HIERARCHY | 内容页内固定左右 panel；组织 Tab | 通过集团/大区/项目树核对组织详情 | 左“集团/大区/项目”；右“组织详情：名称、编码、所属机构、状态、备注、更新时间” | `testId`；内部类型不展示；organization task read |
| IA03-ORG-DETAIL | Drawer；其他四类列表名称链接 | 只读核对品牌、经营租户、总公司或门店 | `<业务对象>详情`；owner 返回的业务字段后直接显示当前启用的定义字段；无编辑按钮 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；owner ids 不展示；organization task read |
| IA03-CONTRACT-OVERVIEW | 内容页；合同概览菜单 | 只读筛选并核对合同 | `合同概览 [刷新]`；筛选“合同编号/门店/分期/经营租户/货号/状态”；表“合同编号(链接)/门店/分期/经营租户/货号摘要/状态/更新时间” | `contextScopedQueryArgs,testId`；分页/排序不展示；contract task read |
| IA03-CONTRACT-DETAIL | Drawer；合同编号链接 | 核对一份合同的当前或历史事实 | `合同详情`；合同编号、状态、门店、分期、经营租户、起止日期、货号、备注、创建/更新时间及其后当前启用的定义字段 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；版本/解析诊断不展示；contract task read |
| IA03-ROLE-LIST | 内容页；角色管理菜单 | 查找、新建业务角色 | `业务角色管理 [新建业务角色]`；名称(链接)、任职机构类型、状态、说明、更新时间 | `contextScopedQueryArgs,testId`；page/capability key 不展示；workspace-IAM list |
| IA03-ROLE-DETAIL | Drawer；角色名称链接 | 先核对角色与两类授权摘要 | `业务角色详情 [编辑][启用/停用]`；名称、任职机构类型、状态、说明、可使用功能菜单摘要、可执行动作摘要 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；key/version 不展示；workspace-IAM detail |
| IA03-ROLE-CREATE | Drawer；先关闭详情后打开或页头新建 | 建立适用于一种任职机构的角色 | `新建业务角色`；名称、任职机构类型、说明、可使用的功能菜单、可执行动作、取消/创建 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；catalog key 不展示；workspace-IAM atomic create |
| IA03-ROLE-EDIT | Drawer；详情编辑 | 在同一保存中修订资料和两套独立授权 | `编辑业务角色`；任职机构类型只读、名称、说明、两棵独立选择树、取消/保存 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；version/key 不展示；workspace-IAM atomic replace |
| IA03-ROLE-STATUS | Modal；详情动作 | 确认变更角色可用状态 | `确认启用/停用“<角色名>”？` | `useOverlayLock,useSubmissionLifecycle,testId`；状态枚举不展示；workspace-IAM transition |
| IA03-ACCOUNT-TAB | 内容页；空间账号页 | 查找该集团空间内账号并打开详情 | `账号`；姓名(链接)、登录账号、状态、任职机构、业务角色、更新时间 | `contextScopedQueryArgs,testId`；候选引用不展示；workspace-IAM list；不提供邀请入口 |
| IA03-ACCOUNT-DETAIL | Drawer；账号姓名链接 | 核对账号及每条任职结果，再决定账号或任职动作 | `账号详情 [重置登录凭据][启用/停用]`；姓名、登录账号、状态；“任职”表：任职机构、业务角色、状态、每条可撤销任职的“撤销任职”链接 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；assignment ids 不展示；workspace-IAM detail |
| IA03-ACCOUNT-ACTION | Modal；详情的账号或某条任职上下文动作 | 确认状态变更、凭据恢复或撤销一条任职 | `确认启用/停用“<姓名>”？`、`重置登录凭据` 或 `确认撤销“<姓名>”在“<任职机构>”的任职？`；取消/确认 | `useOverlayLock,useSubmissionLifecycle,testId`；撤销由 `revokePlatformWorkspaceAssignment` 对该任职重新核验；workspace-IAM readback |
| IA03-EXTENSION-PAGE | 内容页；扩展字段菜单 | 先选择业务对象类别再阅读当前字段定义 | 左“品牌/经营租户/总公司/门店/合同”；右“<类别>字段配置 [编辑]”及名称、类型、必填、状态、选项、显示顺序 | `contextScopedQueryArgs,testId`；entityType/key/revision 不展示；extension owner task read |
| IA03-EXTENSION-EDIT | Drawer；先关闭详情再打开 | 在一份草稿中维护完整字段定义集合 | `编辑<类别>字段配置`；字段名称、字段类型、是否必填、是否启用、选项、显示顺序；添加/删除/拖动、取消/保存 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；revision/key 不展示；extension atomic replace |
| IA03-EXTENSION-SAVE | Modal；保存后的冲突或成功反馈 | 明确下一步是重读或确认已保存 | `字段配置已更新` 或 `字段配置已变化，请查看最新配置后重试` | `useOverlayLock,testId`；CAS/version 不展示；owner readback |
| IA03-PASSWORD-DRAWER | Drawer；用户菜单“修改密码” | 修改本人密码 | `修改密码`；当前密码、新密码、确认新密码、取消/保存 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,useOverlayLock,testId`；session version/密码值不展示；platform-IAM command |
| IA03-PASSWORD-RESULT | Modal；密码 Drawer 成功关闭后 | 了解需重新登录并前往登录页 | `修改成功`；“密码已修改，请使用新密码重新登录。” `[重新登录]` | `useOverlayLock,testId`；其他会话失效为 owner 后果；platform-IAM session |

## 3. 表单依赖与不可合并约束

| screen | 级联关系与 owner 再核验 |
| --- | --- |
| IA03-ADMIN-CREATE | 新密码改变即重新校验确认新密码；两者不等不能提交；owner 复核账号唯一性、密码规则和治理资格。 |
| IA03-ROLE-CREATE/EDIT | 先选择“任职机构类型”；加载并限制“可使用的功能菜单”和“可执行动作”两棵独立树；改类型即清空不适用选择；owner 复核类型适配、两集合独立性和版本。 |
| IA03-EXTENSION-EDIT | 先选字段类型；仅“单选”可编辑选项，切走单选需确认并清理选项；删除/拖动仅改草稿，保存时 owner 在 revision CAS 下替换整组。 |
| IA03-ACCOUNT-ACTION（撤销任职） | 只能从详情中 owner 标为可撤销的一条任职打开；确认后 owner 重新核验该任职、账号、空间资格和版本。失败或状态未知时关闭 Modal 并重新读取详情，不伪装为已撤销。 |
| IA03-PASSWORD-DRAWER | 确认新密码依赖新密码；失败、取消和成功均清除三项秘密；owner 复核当前密码与会话。 |

## 4. 状态、操作与 ownership 结论

所有列表的 loading/empty/failed 分别显示“正在加载”“暂无…”和“暂时无法获取，请重试”；筛选候选失败不等于列表为空。只读详情无写操作；任何编辑/状态/恢复均从详情关闭后进入独立面。可见操作的批准来源分别为 D04-S11、D02-S06、D03-S06、D04-S01/S02、D04-S03、D01-S07P、D04-S12P；没有来源的“批量、删除、跳转或列表操作列”均不画入本稿。

每一行的可见元素均归属于该行声明的 surface；页面不混画 header、侧栏或 sibling Drawer。所有 screen 使用业务词“任职机构类型”“可使用的功能菜单”“可执行动作”“经营租户”，不向用户展示 node、pageKey、capability、schema、revision 或 candidate。

## 5. 接受前检查

本稿的接受不是“页面看起来齐全”：实施者必须逐 screen 回读 R5 业务任务、对应静态基线、下列
surface ownership roster 与 §10 的表单事实矩阵。列表只能用业务标识链接打开详情，写动作只能从详情
进入独立 Drawer 或 Modal；公开、已登录本人安全、平台治理和只读概览不可因为字段相似而合并。

#### Surface ownership roster（24 个可实施 screen）

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | ownership / copy 对账 | 结论 |
| --- | --- | --- | --- | --- |
| IA03-ADMIN-LIST | 内容页 | 标题、新建、筛选、名称链接表格 | 不画行尾写操作；全部元素属于列表 | PASS |
| IA03-ADMIN-DETAIL | Drawer | 标题、资料、状态、关闭、上下文动作 | 写动作只在详情上下文进入独立面 | PASS |
| IA03-ADMIN-CREATE | Drawer | 标题、字段、取消/创建 | 全部属于创建 Drawer | PASS |
| IA03-ADMIN-EDIT | Drawer | 标题、资料字段、取消/保存 | 全部属于编辑 Drawer | PASS |
| IA03-ADMIN-CREDENTIAL | Drawer | 标题、目标账号、新密码/确认密码、取消/确认 | 只承载平台管理员凭据重置 | PASS |
| IA03-ADMIN-STATUS | Modal | 标题、状态说明、取消/确认 | 只承载状态确认 | PASS |
| IA03-ORG-OVERVIEW | 内容页 | 标题、筛选、只读汇总/链接、刷新 | 不画管理或写入动作 | PASS |
| IA03-ORG-HIERARCHY | 内容页 | 标题、树、只读详情入口 | 不画组织写操作 | PASS |
| IA03-ORG-DETAIL | Drawer | 标题、只读事实、定义字段槽位、关闭 | 定义字段在原生事实后直接显示；不承载编辑/状态 | PASS |
| IA03-CONTRACT-OVERVIEW | 内容页 | 标题、筛选、只读汇总/链接、刷新 | 不画合同写操作 | PASS |
| IA03-CONTRACT-DETAIL | Drawer | 标题、只读事实、定义字段槽位、关闭 | 定义字段在原生事实后直接显示；不承载编辑/作废 | PASS |
| IA03-ROLE-LIST | 内容页 | 标题、新建、筛选、名称链接表格 | 无行尾写操作 | PASS |
| IA03-ROLE-DETAIL | Drawer | 标题、资料、两类授权、上下文动作 | 编辑/状态拆入独立面 | PASS |
| IA03-ROLE-CREATE | Drawer | 标题、资料和两类授权控件、取消/创建 | 全部属于创建 Drawer | PASS |
| IA03-ROLE-EDIT | Drawer | 标题、资料和两类授权控件、取消/保存 | 全部属于编辑 Drawer；状态不在此面 | PASS |
| IA03-ROLE-STATUS | Modal | 标题、状态说明、取消/确认 | 只承载状态确认 | PASS |
| IA03-ACCOUNT-TAB | 内容页 | 标题、筛选、账号链接 | 不画行尾写操作，也不提供邀请入口 | PASS |
| IA03-ACCOUNT-DETAIL | Drawer | 标题、账号/任职事实、上下文动作 | 凭据/撤销/状态拆入确认面 | PASS |
| IA03-ACCOUNT-ACTION | Modal | 标题、对象、确认/取消与状态 | 一次只承载一个确认动作 | PASS |
| IA03-EXTENSION-PAGE | 内容页 | 标题、对象类别、字段列表、名称链接 | 不画操作列 | PASS |
| IA03-EXTENSION-EDIT | Drawer | 标题、字段草稿、取消/保存 | 只承载整组编辑 | PASS |
| IA03-EXTENSION-SAVE | Modal | 标题、保存结果/恢复动作 | 不混入编辑字段 | PASS |
| IA03-PASSWORD-DRAWER | Drawer | 标题、当前/新密码、取消/保存 | 只承载已登录本人改密 | PASS |
| IA03-PASSWORD-RESULT | Modal | 标题、重新登录说明/动作 | 不混入密码输入 | PASS |

## 6. 逐 screen Heritage 对应矩阵

`H-ADMIN`、`H-ORG`、`H-CONTRACT`、`H-ROLE`、`H-ACCOUNT`、`H-EXTENSION`、`H-PASSWORD`
分别是 §1 同名行中**完整 path@SHA-256** 的静态来源。`PARTIAL_COUNTERPART` 不表示可随意扩展：仅以原页的视觉与操作顺序为摹本，差异必须有当前 Journey 来源。无对应的成功/冲突反馈沿用 owner 结果，不得凭 UI 自创业务后果。

| screen | 对应关系 / 静态摹本 | 差异与原因 |
| --- | --- | --- |
| IA03-ADMIN-LIST | EXACT_COUNTERPART / H-ADMIN | 保持名称链接而非列表操作列。 |
| IA03-ADMIN-DETAIL | PARTIAL_COUNTERPART / H-ADMIN | 将列表后的详情明确为独立 Drawer，防止“查看/编辑”混成一个动作。 |
| IA03-ADMIN-CREATE | PARTIAL_COUNTERPART / H-ADMIN | 新建是 D04-S11 的治理任务；不预设任何默认管理员。 |
| IA03-ADMIN-EDIT | EXACT_COUNTERPART / H-ADMIN | 固定为详情关闭后的独立 Drawer。 |
| IA03-ADMIN-CREDENTIAL | PARTIAL_COUNTERPART / H-ADMIN | 当前 owner contract 要求管理员为目标账号明确设置新密码；秘密仅在提交时传入，不进入详情、日志或后续 readback。 |
| IA03-ADMIN-STATUS | EXACT_COUNTERPART / H-ADMIN | 启停只从详情进入确认 Modal。 |
| IA03-ORG-OVERVIEW | EXACT_COUNTERPART / H-ORG | 维持平台侧只读入口。 |
| IA03-ORG-HIERARCHY | PARTIAL_COUNTERPART / H-ORG | 组织树只用于核对，不引入运营侧写动作。 |
| IA03-ORG-DETAIL | EXACT_COUNTERPART / H-ORG | 其余对象都以名称进入只读 Drawer。 |
| IA03-CONTRACT-OVERVIEW | EXACT_COUNTERPART / H-CONTRACT | 维持平台侧只读筛选。 |
| IA03-CONTRACT-DETAIL | EXACT_COUNTERPART / H-CONTRACT | 不新增编辑、作废或状态操作。 |
| IA03-ROLE-LIST | EXACT_COUNTERPART / H-ROLE | 保留角色列表和名称入口。 |
| IA03-ROLE-DETAIL | PARTIAL_COUNTERPART / H-ROLE | 把两类授权摘要明确为独立业务信息，避免相互推导。 |
| IA03-ROLE-CREATE | PARTIAL_COUNTERPART / H-ROLE | D04-S01/S02 允许新建；两个选择树的边界见 §3。 |
| IA03-ROLE-EDIT | EXACT_COUNTERPART / H-ROLE | 同一次保存更新资料与两类独立授权。 |
| IA03-ROLE-STATUS | EXACT_COUNTERPART / H-ROLE | 仅确认状态变化，不附加无出处后果。 |
| IA03-ACCOUNT-TAB | EXACT_COUNTERPART / H-ACCOUNT | 账号页不重复 IA01 的 operations invitation 子流。 |
| IA03-ACCOUNT-DETAIL | PARTIAL_COUNTERPART / H-ACCOUNT | 任职结果先在详情核对，再发起上下文动作。 |
| IA03-ACCOUNT-ACTION | PARTIAL_COUNTERPART / H-ACCOUNT | 状态和凭据恢复分别以业务化确认呈现。 |
| IA03-EXTENSION-PAGE | EXACT_COUNTERPART / H-EXTENSION | 保持按业务对象类别查看完整字段集合。 |
| IA03-EXTENSION-EDIT | PARTIAL_COUNTERPART / H-EXTENSION | 只允许整组草稿保存，排除逐行写与操作列。 |
| IA03-EXTENSION-SAVE | NO_V2_COUNTERPART / H-EXTENSION | 明确 owner 冲突/成功反馈，D01-S07P 需要可恢复的整组配置。 |
| IA03-PASSWORD-DRAWER | EXACT_COUNTERPART / H-PASSWORD | 平台已登录本人改密，不与公开恢复合并。 |
| IA03-PASSWORD-RESULT | PARTIAL_COUNTERPART / H-PASSWORD | D04-S12P 要求改密后重新登录，故独立结果 Modal。 |

## 7. 严格 screen sheets（第一组：平台管理员）

所有 `H-ADMIN` 均摹自 `all-v2/apps/frontend/platform-admin/src/features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd`；D04-S11 是每项原始业务来源。

<a id="IA03-ADMIN-LIST"></a>
### Screen: IA03-ADMIN-LIST
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=平台管理员管理菜单；已进入运维管理后台
ACTOR=具有平台管理员治理资格的运维管理员
BUSINESS_SCENARIO=需要查找或新建运维管理员
BUSINESS_GOAL=找到正确管理员或开始创建
USER_VISIBLE_COPY=标题“运维管理员管理”；筛选“姓名”“登录账号”“状态”；按钮“新建管理员”；列“姓名”“账号类型”“登录账号”“状态”“最近登录”“更新时间”
TECHNICAL_BOUNDARY=分页、筛选协议、内部标识由 platform-IAM 核验且不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd
```
```text
运维管理员管理  [新建管理员]
姓名 [____] 登录账号 [____] 状态 [全部] [查询]
姓名（链接） | 账号类型 | 登录账号 | 状态 | 最近登录 | 更新时间
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 姓名/登录账号/状态 | 输入/选择 | 用户输入/固定状态词 | 页面加载完成 | 改任一项重置页码 | 不显示内部状态枚举 | 加载/失败可重试 | platform-IAM 以查询条件读取 |

<a id="IA03-ADMIN-DETAIL"></a>
### Screen: IA03-ADMIN-DETAIL
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=点击 IA03-ADMIN-LIST 的管理员姓名
ACTOR=具有平台管理员治理资格的运维管理员
BUSINESS_SCENARIO=决定是否修改资料、恢复凭据或启停前
BUSINESS_GOAL=核对一名管理员的真实资料
USER_VISIBLE_COPY=标题“管理员详情”；“姓名”“账号”“手机号”“状态”“最近登录”“审计摘要”；按钮“编辑”“重置登录凭据”“启用/停用”
TECHNICAL_BOUNDARY=内部标识与版本不显示；详情关闭后才可打开后续面
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd
```
```text
管理员详情                         [关闭]
姓名 / 账号 / 手机号 / 状态 / 最近登录 / 审计摘要
[编辑] [重置登录凭据] [启用/停用]
```

<a id="IA03-ADMIN-CREATE"></a>
### Screen: IA03-ADMIN-CREATE
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA03-ADMIN-LIST 的“新建管理员”
ACTOR=具有平台管理员治理资格的运维管理员
BUSINESS_SCENARIO=新增独立平台管理员
BUSINESS_GOAL=创建可登录的管理员而不预设默认管理员
USER_VISIBLE_COPY=标题“新建管理员”；字段“登录账号”“姓名”“手机号”“初始密码”“确认密码”；按钮“取消”“创建”
TECHNICAL_BOUNDARY=密码不回显；账号唯一性和密码规则由 platform-IAM 核验
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd
```
```text
新建管理员
登录账号 [______] 姓名 [______] 手机号 [______]
初始密码 [______] 确认密码 [______]     [取消] [创建]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 登录账号/姓名/手机号 | 输入 | 用户填写 | Drawer 打开 | 无 | 格式提示 | 提交中禁编辑 | 唯一性/资格 |
| 初始密码/确认密码 | 密码输入 | 用户填写 | 非空资料 | 改初始密码即重验确认密码 | 不一致不可提交 | 关闭/失败后清空秘密 | 密码规则 |

<a id="IA03-ADMIN-EDIT"></a>
### Screen: IA03-ADMIN-EDIT
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭 IA03-ADMIN-DETAIL 后选择“编辑”
ACTOR=具有平台管理员治理资格的运维管理员
BUSINESS_SCENARIO=管理员资料需要修正
BUSINESS_GOAL=保存正确的姓名和手机号
USER_VISIBLE_COPY=标题“编辑管理员资料”；字段“登录账号（只读）”“姓名”“手机号”；按钮“取消”“保存”
TECHNICAL_BOUNDARY=版本不显示，owner 处理并发变化
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd
```
```text
编辑管理员资料
登录账号（只读） [admin]  姓名 [____] 手机号 [____]
                                               [取消] [保存]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 姓名/手机号 | 输入 | 详情 readback/用户编辑 | Drawer 打开 | 无 | 格式提示 | 冲突后回详情重读 | owner 版本与资格 |

<a id="IA03-ADMIN-CREDENTIAL"></a>
### Screen: IA03-ADMIN-CREDENTIAL
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭 IA03-ADMIN-DETAIL 后选择“重置登录凭据”
ACTOR=具有平台管理员治理资格的运维管理员
BUSINESS_SCENARIO=管理员无法使用当前凭据
BUSINESS_GOAL=为无法登录的管理员设置一项新的登录密码，并在提交前避免误把密码赋给错误账号
USER_VISIBLE_COPY=标题“重置登录凭据”；说明“请为“<登录账号>”设置新的登录密码”；字段“新登录密码”“确认新登录密码”；按钮“取消”“确认重置”
TECHNICAL_BOUNDARY=目标管理员标识、版本、幂等证明、秘密值、恢复材料和诊断码均不显示；秘密不进入草稿、日志或详情 readback
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd
```
```text
重置登录凭据
请为“<登录账号>”设置新的登录密码
新登录密码 [____________]  确认新登录密码 [____________]
                                    [取消] [确认重置]
```

| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 新登录密码 | 密码 `Input` | 用户输入 | Drawer 已从 latest detail 打开 | 改变即重新校验确认密码 | 至少 8 位；不回显 | 失败、关闭或成功后立即清空 | `resetPlatformAdminCredential` 以目标、版本、资格和密码规则重验 |
| 确认新登录密码 | 密码 `Input` | 用户输入 | 已输入新登录密码 | 新密码变化即清空并重验 | 必须与新登录密码相同 | 不一致不可提交 | 仅用于客户端防误输；owner 仍以新密码核验 |

<a id="IA03-ADMIN-STATUS"></a>
### Screen: IA03-ADMIN-STATUS
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA03-ADMIN-DETAIL 的“启用/停用”
ACTOR=具有平台管理员治理资格的运维管理员
BUSINESS_SCENARIO=准备改变管理员可用状态
BUSINESS_GOAL=明确确认目标和操作
USER_VISIBLE_COPY=“确认启用/停用“<姓名>”？；按钮“取消”“确认”
TECHNICAL_BOUNDARY=状态枚举、版本及服务端资格不显示
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/platform-admin-governance/ui/PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd
```
```text
确认启用/停用“<姓名>”？
                         [取消] [确认]
```

本稿是已获 Dexter 接受、等待 implementation-facing re-freeze 的静态 IA：`DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29`，仍不授权 implementation。final P6 详设才绑定每个 screen 的 exact path、Heritage hash、foundation import 与 focused evidence；`FOUNDATION_PRIMITIVE` 的 import equality 在此阶段尚未执行。

## 8. 严格 screen sheets（第二组：组织与合同概览）

`H-ORG` 是 `all-v2/apps/frontend/platform-admin/src/features/organization-overview/ui/OrganizationOverviewPage.tsx@72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829`；`H-CONTRACT` 是 `all-v2/apps/frontend/platform-admin/src/features/contract-overview/ui/ContractOverviewPage.tsx@932784738052ab15f1733900b6d47e29718e0334b8f3e0a32fac8b76f363dfe0`。原始来源分别为 R5 `#scenario-d02-s06` 与 `#scenario-d03-s01-s04` 的 D03-S06。

<a id="IA03-ORG-OVERVIEW"></a>
### Screen: IA03-ORG-OVERVIEW
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=组织概览菜单；已选择集团空间
ACTOR=有组织只读资格的运维管理员
BUSINESS_SCENARIO=需要在一个集团空间内核对经营组织事实
BUSINESS_GOAL=按对象类别找到正确组织资料
USER_VISIBLE_COPY=标题“组织概览”；Tab“组织架构”“品牌”“经营租户”“总公司”“门店”；“筛选功能准备中”；列表、空态“暂无<对象>”与失败提示“暂时无法获取，请重试”
TECHNICAL_BOUNDARY=集团空间、分页、筛选和 owner 查询条件不显示；未选择集团空间不发读取
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/organization-overview/ui/OrganizationOverviewPage.tsx@72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829
```
```text
组织概览
[组织架构] [品牌] [经营租户] [总公司] [门店]
名称/编码 [待补服务端筛选，暂不可用] [查询（不可用）]
名称（链接） | 编码 | 状态 | 更新时间
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 对象类别 Tab | Tab | 固定五类业务对象 | 已选集团空间 | 切换即清空旧搜索/页码并读取当前 Tab | 不通过 Tab 改写对象 | 加载中防止旧响应覆盖 | organization task read |
| 名称/编码搜索 | 待补服务端筛选；当前禁用 | `GAP-PLATFORM-ORG-OVERVIEW-FILTER-SEMANTICS` 与候选 GAP 解除后才可输入 | 当前 Tab 就绪且 owner 已实现同条件过滤/total | 解除后改查询重置页码 | 仅当前对象字段 | 当前显示“筛选功能准备中”；不得伪装空结果 | owner 按空间/对象与同条件 total 查询 |

<a id="IA03-ORG-HIERARCHY"></a>
### Screen: IA03-ORG-HIERARCHY
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=IA03-ORG-OVERVIEW 的“组织架构”Tab
ACTOR=有组织只读资格的运维管理员
BUSINESS_SCENARIO=核对集团、大区和项目的层级归属
BUSINESS_GOAL=从树中找到一项组织并阅读其详情
USER_VISIBLE_COPY=左侧“集团 / 大区 / 项目”；右侧标题“组织详情”；字段“名称”“编码”“所属机构”“状态”“备注”“更新时间”
TECHNICAL_BOUNDARY=内部类型、内部标识和任务路径不显示
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/organization-overview/ui/OrganizationOverviewPage.tsx@72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829
```
```text
集团 / 大区 / 项目        组织详情
▾ 集团                    名称：____
  ▸ 大区                  编码：____ 状态：____
                           所属机构 / 备注 / 更新时间
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 组织树项 | Tree | 当前集团空间 owner readback | 树加载成功 | 选中即换右侧详情 | 仅集团/大区/项目三层 | 加载、空、失败分开显示 | organization task read |

<a id="IA03-ORG-DETAIL"></a>
### Screen: IA03-ORG-DETAIL
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA03-ORG-OVERVIEW 中品牌、经营租户、总公司或门店名称链接
ACTOR=有组织只读资格的运维管理员
BUSINESS_SCENARIO=需要核对某项经营对象的资料
BUSINESS_GOAL=读取 owner 返回的完整业务事实
USER_VISIBLE_COPY=标题“<品牌/经营租户/总公司/门店>详情”；owner 返回的业务资料；其后按 displayOrder 升序直接显示由运维管理后台定义且当前启用的字段，字段标签由 definition 返回，缺失值显示“—”，无独立分组标题；按钮“关闭”
TECHNICAL_BOUNDARY=内部标识、版本、查询诊断不显示；无编辑、启停或授权按钮
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/organization-overview/ui/OrganizationOverviewPage.tsx@72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829
```
```text
<对象>详情                                      [关闭]
名称 / 编码 / 状态 / 归属 / 备注 / 更新时间
当前启用的定义字段（按顺序直接显示，无分组标题）
```

<a id="IA03-CONTRACT-OVERVIEW"></a>
### Screen: IA03-CONTRACT-OVERVIEW
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=合同概览菜单；已选择集团空间
ACTOR=有合同只读资格的运维管理员
BUSINESS_SCENARIO=按合同、门店或经营关系核对合同事实
BUSINESS_GOAL=找到正确合同并进入其只读详情
USER_VISIBLE_COPY=标题“合同概览”；按钮“刷新”；“筛选功能准备中”；筛选项“合同编号”“门店”“分期”“经营租户”“货号”“状态”；列“合同编号”“门店”“分期”“经营租户”“货号摘要”“状态”“更新时间”
TECHNICAL_BOUNDARY=分页、排序、范围和版本不显示；未选择集团空间不发读取
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/contract-overview/ui/ContractOverviewPage.tsx@932784738052ab15f1733900b6d47e29718e0334b8f3e0a32fac8b76f363dfe0
```
```text
合同概览 [刷新]
合同编号 [待补服务端筛选] 门店 [待补服务端筛选] 分期 [待补服务端筛选] 经营租户 [待补服务端筛选] 货号 [待补服务端筛选] 状态 [待补服务端筛选] [查询（不可用）]
合同编号（链接） | 门店 | 分期 | 经营租户 | 货号摘要 | 状态 | 更新时间
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 筛选与刷新 | 筛选当前禁用；刷新可用 | `GAP-PLATFORM-CONTRACT-OVERVIEW-FILTER-SEMANTICS` 解除后才接收用户输入与固定状态词 | 已选集团空间 | 当前刷新只重读；解除后改条件重置页码并重读 | 只作过滤不构成授权 | 当前显示“筛选功能准备中”；刷新失败可重试 | contract task read 必须同条件过滤/total |

<a id="IA03-CONTRACT-DETAIL"></a>
### Screen: IA03-CONTRACT-DETAIL
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA03-CONTRACT-OVERVIEW 的合同编号链接
ACTOR=有合同只读资格的运维管理员
BUSINESS_SCENARIO=需要核对当前或历史合同资料
BUSINESS_GOAL=读取一份合同的 owner 事实
USER_VISIBLE_COPY=标题“合同详情”；“合同编号”“状态”“门店”“项目分期”“经营租户”“起止日期”“货号”“备注”“创建时间”“更新时间”；其后按 displayOrder 升序直接显示由运维管理后台定义且当前启用的字段，字段标签由 definition 返回，缺失值显示“—”，无独立分组标题；按钮“关闭”
TECHNICAL_BOUNDARY=版本、解析诊断、内部标识不显示；无编辑、作废或状态动作
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/features/contract-overview/ui/ContractOverviewPage.tsx@932784738052ab15f1733900b6d47e29718e0334b8f3e0a32fac8b76f363dfe0
```
```text
合同详情                                      [关闭]
编号 / 状态 / 门店 / 项目分期 / 经营租户 / 起止日期
货号 / 备注 / 创建时间 / 更新时间
当前启用的定义字段（按顺序直接显示，无分组标题）
```

## 9. 严格 screen sheets（第三组：角色、账号、字段和本人安全）

`H-ROLE`=`all-v2/apps/frontend/platform-admin/src/features/role-management/ui/RoleManagementPage.tsx@45111b3d93310ffdbe7a3700822bf76a3d0630ac3917b21ede091996dea7efe0`；`H-ACCOUNT`=`all-v2/apps/frontend/platform-admin/src/features/workspace-account-management/ui/WorkspaceAccountManagementPage.tsx@f91df607180aebc2354e7e811c9abcb316121f24bc121b711314280cb207011e`；`H-EXTENSION`=`all-v2/apps/frontend/platform-admin/src/features/extension-field-management/ui/ExtensionFieldManagementPage.tsx@4d23ecd15dcfe641c38c3292076c1ebb452f309fb36a4e1d59c9729ee554cc4e`；`H-PASSWORD`=`all-v2/apps/frontend/platform-admin/src/features/authentication/ui/PlatformPasswordChangeDrawer.tsx@7f628b6e14e5b4965d59db9282b6e3aa78a85cf851b823e2f182f381c143dc57`。原始来源：R5 D04-S01/S02、D04-S03、D01-S07P、D04-S12P。

<a id="IA03-ROLE-LIST"></a>
### Screen: IA03-ROLE-LIST
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=角色管理菜单；已选择集团空间
ACTOR=具有角色治理资格的运维管理员
BUSINESS_SCENARIO=查找或新建适配任职机构的业务角色
BUSINESS_GOAL=进入正确角色详情或创建流程
USER_VISIBLE_COPY=标题“业务角色管理”；按钮“新建业务角色”；列“名称”“任职机构类型”“状态”“说明”“更新时间”
TECHNICAL_BOUNDARY=页面准入与动作能力 key 不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-ROLE
```
```text
业务角色管理 [新建业务角色]
名称（链接） | 任职机构类型 | 状态 | 说明 | 更新时间
```

<a id="IA03-ROLE-DETAIL"></a>
### Screen: IA03-ROLE-DETAIL
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA03-ROLE-LIST 的角色名称链接
ACTOR=具有角色治理资格的运维管理员
BUSINESS_SCENARIO=修改前核对角色与两类授权摘要
BUSINESS_GOAL=确认该角色适用于谁、可使用哪些功能、可执行哪些动作
USER_VISIBLE_COPY=标题“业务角色详情”；“名称”“任职机构类型”“状态”“说明”“可使用的功能菜单”“可执行动作”；按钮“编辑”“启用/停用”
TECHNICAL_BOUNDARY=内部 key、版本不显示；两类授权不相互推导
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-ROLE
```
```text
业务角色详情 [编辑] [启用/停用]
名称 / 任职机构类型 / 状态 / 说明
可使用的功能菜单摘要 / 可执行动作摘要
```

<a id="IA03-ROLE-CREATE"></a>
### Screen: IA03-ROLE-CREATE
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA03-ROLE-LIST 的“新建业务角色”
ACTOR=具有角色治理资格的运维管理员
BUSINESS_SCENARIO=建立一种任职机构可用的角色
BUSINESS_GOAL=在一次保存中定义资料、功能菜单与动作
USER_VISIBLE_COPY=标题“新建业务角色”；字段“名称”“任职机构类型”“说明”“可使用的功能菜单”“可执行动作”；按钮“取消”“创建”
TECHNICAL_BOUNDARY=能力 key 不显示；owner 原子保存两套独立集合
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-ROLE
```
```text
新建业务角色
名称 [____] 任职机构类型 [选择]
说明 [________________]
可使用的功能菜单 [树]  可执行动作 [树]       [取消] [创建]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 任职机构类型 | Select | 固定业务类型 | Drawer 打开 | 改类型清空两树选择并重读 | 只能选一种 | 加载中禁提交 | 角色类型适配 |
| 两棵授权树 | 独立 Tree | owner catalog | 先选类型 | 改类型全清空 | 两集合不能互推 | 候选失败禁选择 | 独立集合/版本 |

<a id="IA03-ROLE-EDIT"></a>
### Screen: IA03-ROLE-EDIT
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭 IA03-ROLE-DETAIL 后选择“编辑”
ACTOR=具有角色治理资格的运维管理员
BUSINESS_SCENARIO=修订既有角色
BUSINESS_GOAL=一次保存资料及两类独立授权
USER_VISIBLE_COPY=标题“编辑业务角色”；“任职机构类型（只读）”“名称”“说明”“可使用的功能菜单”“可执行动作”；按钮“取消”“保存”
TECHNICAL_BOUNDARY=版本与内部 key 不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-ROLE
```
```text
编辑业务角色
任职机构类型（只读） 名称 [____] 说明 [____]
可使用的功能菜单 [树] 可执行动作 [树]          [取消] [保存]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 两棵授权树 | 独立 Tree | 当前角色/readback | Drawer 已读详情 | 互不清空 | 不可由一树推导另一树 | 冲突回详情重读 | 原子替换/版本 |

<a id="IA03-ROLE-STATUS"></a>
### Screen: IA03-ROLE-STATUS
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA03-ROLE-DETAIL 的“启用/停用”
ACTOR=具有角色治理资格的运维管理员
BUSINESS_SCENARIO=准备改变角色可用状态
BUSINESS_GOAL=明确确认目标角色和状态动作
USER_VISIBLE_COPY=“确认启用/停用“<角色名>”？；按钮“取消”“确认”
TECHNICAL_BOUNDARY=状态枚举、版本和内部 key 不显示
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-ROLE
```
```text
确认启用/停用“<角色名>”？                 [取消] [确认]
```

<a id="IA03-ACCOUNT-TAB"></a>
### Screen: IA03-ACCOUNT-TAB
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=空间账号页的“账号”Tab；已选择集团空间
ACTOR=具有空间账号治理资格的运维管理员
BUSINESS_SCENARIO=查找集团空间内的账号和任职结果
BUSINESS_GOAL=进入一名账号的详情
USER_VISIBLE_COPY=账号；列“姓名”“登录账号”“状态”“任职机构”“业务角色”“更新时间”
TECHNICAL_BOUNDARY=候选引用和任职内部标识不显示；不提供 platform invitation 子流或入口
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-ACCOUNT
```
```text
[账号]
姓名（链接） | 登录账号 | 状态 | 任职机构 | 业务角色 | 更新时间
```

<a id="IA03-ACCOUNT-DETAIL"></a>
### Screen: IA03-ACCOUNT-DETAIL
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA03-ACCOUNT-TAB 的账号姓名链接
ACTOR=具有空间账号治理资格的运维管理员
BUSINESS_SCENARIO=核对账号和每条任职后决定下一动作
BUSINESS_GOAL=在正确账号及任职上发起恢复、启停或撤销
USER_VISIBLE_COPY=标题“账号详情”；“姓名”“登录账号”“状态”；“任职”表列“任职机构”“业务角色”“状态”“撤销任职”；按钮“重置登录凭据”“启用/停用”
TECHNICAL_BOUNDARY=账号、任职和版本标识不显示；仅 owner 标记可撤销项出现撤销链接
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-ACCOUNT
```
```text
账号详情 [重置登录凭据] [启用/停用]
姓名 / 登录账号 / 状态
任职机构 | 业务角色 | 状态 | 撤销任职
```

<a id="IA03-ACCOUNT-ACTION"></a>
### Screen: IA03-ACCOUNT-ACTION
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA03-ACCOUNT-DETAIL 的账号动作或某条“撤销任职”
ACTOR=具有空间账号治理资格的运维管理员
BUSINESS_SCENARIO=执行前确认账号状态、为该集团空间账号发起凭据恢复或撤销一条任职
BUSINESS_GOAL=让目标账号、动作和（撤销时的）任职清晰可核对后再提交
USER_VISIBLE_COPY=状态时“确认启用/停用“<姓名>”？”，凭据恢复时“确认向“<登录账号>”发起重置登录凭据？”，撤销时“确认撤销“<姓名>”在“<任职机构>”的任职？”；按钮“取消”“确认”
TECHNICAL_BOUNDARY=每次只呈现一个 action variant；凭据恢复、撤销与状态的对象、版本和幂等证明均取 latest detail/lifecycle；撤销以 `revokePlatformWorkspaceAssignment` 重新核验任职/版本；内部字段不显示
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-ACCOUNT
```
```text
确认撤销“<姓名>”在“<任职机构>”的任职？ [取消] [确认]
```

<a id="IA03-EXTENSION-PAGE"></a>
### Screen: IA03-EXTENSION-PAGE
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=扩展字段菜单；已选择集团空间
ACTOR=具有字段配置资格的运维管理员
BUSINESS_SCENARIO=运维管理员需要为某一类实体确定该实体在运营管理后台录入和查看时应出现的字段
BUSINESS_GOAL=维护可用字段定义，使运营管理后台能在实体原生表单和详情中无感录入、查看这些字段
USER_VISIBLE_COPY=左侧“品牌”“经营租户”“总公司”“门店”“合同”；标题“<类别>字段配置”；按钮“编辑”；列“字段名称”“字段类型”“是否必填”“是否启用”“选项”“显示顺序”
TECHNICAL_BOUNDARY=对象 key、规则版本不显示；无逐行操作列
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-EXTENSION
```
```text
品牌 / 经营租户 / 总公司 / 门店 / 合同 | <类别>字段配置 [编辑]
字段名称 | 字段类型 | 是否必填 | 是否启用 | 选项 | 显示顺序
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 对象类别 | 侧栏选择 | 固定五类 | 已选集团空间 | 切换重读整组字段 | 不混合不同类别 | 失败不显示旧类别为成功 | extension task read |

<a id="IA03-EXTENSION-EDIT"></a>
### Screen: IA03-EXTENSION-EDIT
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭 IA03-EXTENSION-PAGE 后选择“编辑”
ACTOR=具有字段配置资格的运维管理员
BUSINESS_SCENARIO=维护一个业务对象类别的完整字段定义集合
BUSINESS_GOAL=以一次保存提交完整、可用的字段配置
USER_VISIBLE_COPY=标题“编辑<类别>字段配置”；“字段名称”“字段类型”“是否必填”“是否启用”“选项”“显示顺序”；按钮“添加字段”“删除”“取消”“保存”
TECHNICAL_BOUNDARY=规则版本和内部 key 不显示；只允许整组替换，不逐行写
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-EXTENSION
```
```text
编辑<类别>字段配置 [添加字段]
字段名称 [__] 类型 [选择] 必填 [开关] 启用 [开关] 选项 [__] 顺序 [__] [删除]
                                                     [取消] [保存]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 字段类型/选项 | Select/输入 | 固定字段类型/用户填写 | 草稿行存在 | 切离“单选”需确认并清空选项 | 只有单选可填选项 | 无效行不能保存 | 完整集合/规则版本 |
| 添加/删除/排序 | 按钮/拖动 | 当前草稿 | Drawer 打开 | 只改草稿 | 不产生逐行提交 | 冲突回读整组 | 原子替换 |

<a id="IA03-EXTENSION-SAVE"></a>
### Screen: IA03-EXTENSION-SAVE
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA03-EXTENSION-EDIT 保存后的 owner 结果
ACTOR=具有字段配置资格的运维管理员
BUSINESS_SCENARIO=保存结束或 owner 返回变化冲突
BUSINESS_GOAL=知道已更新或回到最新配置后重试
USER_VISIBLE_COPY=“字段配置已更新”或“字段配置已变化，请查看最新配置后重试”；按钮“确认”“查看最新配置”
TECHNICAL_BOUNDARY=CAS、版本和规则 key 不显示
FOUNDATION_PRIMITIVE=useOverlayLock,testId
HERITAGE_COUNTERPART=NO_V2_COUNTERPART; H-EXTENSION
```
```text
字段配置已变化，请查看最新配置后重试。 [查看最新配置]
```

<a id="IA03-PASSWORD-DRAWER"></a>
### Screen: IA03-PASSWORD-DRAWER
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=运维管理后台用户菜单“修改密码”
ACTOR=已登录的运维管理员
BUSINESS_SCENARIO=需要更新本人登录密码
BUSINESS_GOAL=安全修改本人密码
USER_VISIBLE_COPY=标题“修改密码”；字段“当前密码”“新密码”“确认新密码”；按钮“取消”“保存”
TECHNICAL_BOUNDARY=密码、会话版本与诊断不显示；仅本人命令
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,useOverlayLock,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-PASSWORD
```
```text
修改密码
当前密码 [____] 新密码 [____] 确认新密码 [____] [取消] [保存]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 三个密码字段 | Password | 用户填写 | Drawer 打开 | 改新密码重验确认密码 | 不一致不可提交 | 失败/关闭/成功清空 | 当前密码/规则/会话 |

<a id="IA03-PASSWORD-RESULT"></a>
### Screen: IA03-PASSWORD-RESULT
```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA03-PASSWORD-DRAWER 保存成功且关闭后
ACTOR=已登录的运维管理员
BUSINESS_SCENARIO=本人密码已修改
BUSINESS_GOAL=了解需重新登录并前往登录页
USER_VISIBLE_COPY=标题“修改成功”；“密码已修改，请使用新密码重新登录。”；按钮“重新登录”
TECHNICAL_BOUNDARY=其他会话失效是 owner 后果，细节不显示
FOUNDATION_PRIMITIVE=useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-PASSWORD
```
```text
修改成功
密码已修改，请使用新密码重新登录。 [重新登录]
```

## 10. P6 搜索与候选选择详设（2026-07-29）

`SEARCH_CAPABILITY_DENOMINATOR=6`。原始业务任务是 R5 `D04-S11`（平台管理员治理）、D02-S02/S03
（跨 owner 的组织全景）、D03-S01（合同全景）、D04-S01/S02（角色定义）和 D02-S07（扩展字段）。
每个搜索只帮助平台人员回答相应治理问题，不能从概览页/当前 workspace/已加载行猜候选。其余 IA03
screen 为详情、创建确认、状态操作或本人密码，`NOT_APPLICABLE_WITH_REASON`：没有独立的查找业务任务。

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- |
| `IA03-ADMIN-LIST` / 平台管理员 / 在治理前定位管理员账户 | “姓名”“登录名”“状态” | 姓名/登录名为文本 `Input`；状态为固定 `Select` | `getPlatformAdminPage`，platform-IAM | 无级联；清空回 owner 默认页 | list、详情和状态 command 都由 platform-IAM 重验 | 姓名/登录名是业务可识别文本；状态有限，不能做自由输入；不按内部 principal 查找 | 无 |
| `IA03-ORG-OVERVIEW` / 组织全景记录 / 在选定集团空间审看组织、品牌或经营租户 | “类型”“名称/编码”“状态”“来源”“项目”“品牌”“经营租户” | 类型 Tabs；名称/编码文本；状态/来源固定 `Select`；项目/品牌/经营租户设计为 owner searchable `Select` | OpenAPI `getPlatformOrganizationOverviewPage` 声明 `name/code/status/source/projectId/brandId/tenantId`，但 current `PlatformOrganizationOverviewController.page` 只接 category/page/pageSize，且没有候选 task read | 切类型清不适用实体条件；改集团空间由 IA02 清空全部条件并重读 | organization owner 未来必须对 workspace、全部条件和相同 total 谓词重验 | 引用实体会增长/重名，正确形态必须是 owner 候选选择；编码是明确文本查询，不伪装成候选服务 | `GAP-PLATFORM-ORG-OVERVIEW-FILTER-SEMANTICS` + `GAP-PLATFORM-ORG-OVERVIEW-CANDIDATES`：必须同时补 controller/task-read 条件转发、服务端过滤/total 和候选 readback；不能拿 OpenAPI 或列表缓存假称已支持 |
| `IA03-CONTRACT-OVERVIEW` / 合同全景记录 / 依合同编号、门店名称、项目分期、经营租户名称或货号核查跨 owner 合同事实 | “合同编号”“门店”“项目分期”“经营租户”“货号”“状态” | 合同编号、门店名称、分期、经营租户名称、货号均为 contract 文本 `Input`；状态固定 `Select` | OpenAPI `getPlatformContractOverviewPage` 声明 `contractNo/storeName/phaseName/tenantName/itemCode/status`，但 current `PlatformContractOverviewController.page` 与 `ContractTaskReadService.platformOverview` 只分页、不接筛选 | 选集团空间清全部；各文本条件独立重读 | contract owner 未来必须重验 context、全部条件和相同 total 谓词 | 此 contract 以用户可读名称/编号检索，故不虚构 storeId/tenantId 候选；状态有限不使用文本 | `GAP-PLATFORM-CONTRACT-OVERVIEW-FILTER-SEMANTICS`：补 controller/task-read 的服务端条件与同条件 total 前，UI 显示“筛选功能准备中”，不得提供可工作的筛选或 client-side filter |
| `IA03-ROLE-CREATE` / 新角色授权范围 / 先确定任职机构类型，再选择可授予菜单与动作 | “任职机构类型”“可使用的功能菜单”“可执行的操作” | 类型为固定 `Select`；菜单与动作为 owner catalog `Tree` 多选，不允许键入 capability/key | platform authorization catalog readback | 改类型立即清空两棵树并按该类型重载；失败禁用提交 | role command 以类型、菜单/动作 ref 再验闭包 | 类型是冻结有限业务词；菜单/动作需保持层级解释，Tree 比文本或扁平远程搜索适合 | 无；若 catalog 不返回类型候选，不能以 UI 猜出权限 |
| `IA03-ROLE-EDIT` / 已有角色的授权范围 / 在不改变角色身份的前提下修订获准菜单与操作 | “可使用的功能菜单”“可执行的操作” | owner catalog `Tree` 多选；任职机构类型为只读 | 当前 role readback + authorization catalog | 无类型切换；重读时以最新 role 覆盖过期草稿 | update command 重验角色版本、类型和 action/menu refs | 既有类型不可改，避免把编辑做成另一个角色；树保留父子语义，拒绝文本 key | 无 |
| `IA03-EXTENSION-PAGE`、`IA03-EXTENSION-EDIT` / 扩展字段定义 / 先定位适用业务对象，再选择合法字段类型与选项 | “适用对象”“字段类型”“选项” | 五类适用对象为固定侧栏项；字段类型为固定 `Select`；选项仅在单选类型显示动态输入列表 | extension owner readback 与冻结字段类型词表 | 改类型清空不适用选项；非单选不加载/保留旧选项 | extension owner 重验对象、字段类型与选项规则 | 这些是受控定义，不是可搜索业务实体；固定枚举避免输入内部 type；不新增自由检索 | 无；没有原始业务要求的扩展对象不得画出 |

## 11. 创建、编辑与确认表单事实矩阵修订（2026-07-29）

`FORM_MUTATION_DENOMINATOR=5 core variants + 3 status confirmations + 3 credential/assignment confirmations + 1 adjacent security mutation`。业务来源为 R5
`D04-S11`（治理平台管理员）、`D04-S01/S02`（一次保存角色资料、菜单和独立动作能力）、
`D01-S07P`（按五类实际值宿主管理完整扩展字段集合）与 `D04-S12P`（本人改密）。本节覆盖
`IA03-ADMIN-CREATE/EDIT`、`IA03-ROLE-CREATE/EDIT`、`IA03-EXTENSION-EDIT`，并对 status/本人改密
补齐不能遗漏的 hidden facts；既有详情、列表和搜索 screen 不因本修订变成 mutation form。

| variant / 业务事实 | 用户可见控件 | 分类 | request 取值与唯一来源 | 级联、约束与 owner 复核 | 失败/恢复 |
| --- | --- | --- | --- | --- | --- |
| 新建运维管理员：登录名、姓名、初始密码、手机号 | 四个输入（手机号可选） | `EDITABLE` | 用户输入 | 登录名仅创建时可写；owner 校验唯一性、密码规则和资料格式 | 失败保留非密码字段；密码从内存清除后重新输入 |
| 新建运维管理员：初始启用状态、idempotency proof | 不显示 | `HIDDEN_OWNER_FACT` | platform-IAM owner 默认 ACTIVE；submission lifecycle | 不让 UI 选择初始状态；header/body 使用同一 proof | 未知结果按 proof/readback 确认 |
| 编辑运维管理员：登录名 | “登录名（只读）” | `FIXED_READONLY` | latest `PlatformAdminDetail.loginName` | 不存在改登录名 command；owner 仍以对象与版本复核 | detail 变化时重读 |
| 编辑运维管理员：姓名、手机号 | 两个输入 | `EDITABLE` | latest detail 预填 + 用户修改 | profile command 仅允许这两项；expectedVersion/idempotency 隐藏取 latest detail/lifecycle | 冲突回详情，手机号展示保持脱敏边界 |
| 编辑运维管理员：对象、版本、proof | 不显示 | `HIDDEN_OWNER_FACT` | latest detail + lifecycle | 不由列表行或路由猜测 | 冲突不得覆盖更新 |
| 新建业务角色：名称、任职机构类型、说明、功能菜单集合、可执行动作集合 | Input、固定 Select、TextArea、两棵 Tree | `EDITABLE` | 用户输入 + owner authorization catalog | 必须先选任职机构类型；变更类型清空两树并重读；菜单和动作互不推导 | owner 以类型、catalog refs 与完整两集合原子复核 |
| 编辑业务角色：任职机构类型 | “任职机构类型（只读）” | `FIXED_READONLY` | latest role detail | G-07 规定创建后不可改；不把编辑变相做成新角色 | 需要换类型时另建角色并撤销旧任职 |
| 编辑业务角色：名称、说明、两类授权集合 | Input、TextArea、两棵 Tree | `EDITABLE` | latest detail + owner catalog | status 不是自由表单字段；两树仍独立并一并保存 | owner 校验 type、version、catalog refs；冲突重读 |
| 编辑业务角色：当前状态 | 不显示 | `GAP` | latest detail 只能用于显示与 S03 的状态确认，**不能**作为 generic update body 的 status | current `WorkspaceRoleUpdateRequest.status` 可写且 owner generic update 会持久化它，存在绕过 S03 的反例 | `GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY`：implementation-facing design 前从 generic update contract 去除 status、owner 保留 latest value；仅 S03 接受 target status，并有 red mutation |
| 编辑业务角色：对象、版本、proof | 不显示 | `HIDDEN_OWNER_FACT` | latest detail + lifecycle | 不由列表行或路由猜测 | conflict 回详情；不覆盖更新 |
| 扩展字段：既有字段的稳定标识与类型 | 不显示标识；类型显示为只读 | `FIXED_READONLY` | existing extension definition readback | 已有 key/type 不允许变；改 label、必填、启用、选项、显示顺序仍要整组保存 | owner 复核既有 key/type 不变、完整 revision |
| 扩展字段：新增字段的名称、类型、必填、启用、选项、显示顺序 | EditableProTable 的业务列 | `EDITABLE` | 用户输入 + 固定类型词表 | 只有“单选”显示选项；切离单选必须清空选项；名称、选项、顺序分别去空/去重 | `GAP-EXTENSION-OWNER-KEY-DERIVATION`：现有 request 强制 technical key，UI 不得让管理员填写或浏览器生成。最小后续 contract 是 owner 对 `new field` 生成并回传稳定 key、对 existing field 保留 readback key；在该 owner 设计落地前，新增行不可提交 |
| 扩展字段：完整集合版本、既有 key、idempotency proof | 不显示 | `HIDDEN_OWNER_FACT` | latest definition revision / readback / lifecycle | 仅底部“保存”原子替换；不逐行 mutation；未知历史值不删除或改写 | 规则冲突关闭草稿、回读完整集合；不能本地重试旧 revision |
| 管理员/角色状态确认 | 名称与“启用/停用”确认文案 | `HIDDEN_OWNER_FACT` | latest detail 的对象、状态、version + lifecycle | 纯确认 Modal 无可编辑资料字段；不加入未证实的业务后果 | owner conflict/denied 回详情 |
| 平台管理员凭据重置 | “新登录密码”“确认新登录密码” | `EDITABLE` | latest `PlatformAdminDetail` 的目标/版本 + 用户输入密码 | `PlatformAdminCredentialResetRequest.password` 是当前 contract 的必要事实；新密码变化即重验确认密码；不得把管理员重置误画成无字段的链接发放 | 失败保留非秘密上下文、清空两项秘密；成功关闭 Drawer 并从 owner detail 重读 |
| 集团空间账号状态、凭据恢复或任职撤销 | 对应的单一确认文案，无自由业务字段 | `HIDDEN_OWNER_FACT` | latest account/assignment detail 的对象、target（状态时）、expectedVersion + lifecycle proof | 每次只执行一个 command；凭据恢复不携带或显示 resetGenerationKey；撤销固定 assignment；不得把三种操作合为一条无对象的“确认” | owner conflict/denied 回详情；未知结果先读回 account/assignment |
| 本人修改密码 | 当前密码、新密码、确认新密码 | `EDITABLE` | 用户输入 | 新密码变化立即重验确认；密码、session/version 不持久化到草稿或日志 | owner 成功后按已定义结果清会话并重新登录 |

扩展字段的 “key” 是 owner 内部稳定身份而非用户心智中的业务字段；本修订明确禁止把它显示为
“字段编码”、从标签拼接，或由浏览器静默产生。`GAP-EXTENSION-OWNER-KEY-DERIVATION` 是 implementation-facing
设计前必须闭合的 contract/owner 缺口，不能被当前前端线框掩盖。

本节的 exact command set、状态分母和两个本人密码路径以
`doc/evidence/platform/rm1/p6/rm1-u09-form-command-variant-ledger.md` 为唯一对账台账；本 IA 的紧凑
矩阵只描述此处 screen 的业务事实，不能再把不同 owner command 合并计数。

本 IA 出现的增长型业务对象 searchable Select（集团空间及组织概览引用对象）统一经 P6 `CandidateQuery`
consumer protocol；角色 catalog Tree 与固定类别/状态不是候选搜索，不被伪装成该协议。adapter 只统一
wire/lifecycle，仍将每个 `subjectType` 路由回正确 owner public task read，并保留已登记的 overview candidate GAP。
