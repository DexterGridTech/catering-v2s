---
title: RM1 P6 IA-05 运营用户、公开恢复、本人安全与首页路由交互
status: DEXTER_ACCEPTED_FOR_IMPLEMENTATION_FACING_REFREEZE
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# IA-05 运营用户、公开恢复、本人安全与首页路由交互

```text
JOURNEY_DECISION=doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md#scenario-d04-s01-s02；另见本文件 D04-S10、D04-S12O、D04-S08/S09 的同一 Journey 表
BUSINESS_REQUIREMENT_SOURCE=D04-S04（五类任职目标的用户查询/撤销）、D04-S05O（邀请子流，已由 IA01 覆盖）、D04-S10（公开验证后重设密码）、D04-S12O（运营用户本人改密）、D04-S08/S09（登录或切任职后的五个路由落点）；Dexter 2026-07-29 产品裁决：两个管理后台均支持未认证“账号+手机号+验证码”自助重置密码。
BUSINESS_PROBLEM=运营管理后台的用户管理不是一个泛化页面：集团、大区、项目、总公司和门店对应不同的任职对象及可用角色。公开找回和本人改密也不能因为都涉及密码而合并成同一个已登录流程；五个首页只是路由落点，不能被臆想成仪表盘。现有公开恢复只接受管理员签发的 resetGenerationKey，不能满足 Dexter 已裁决的登录页自助入口；新设计必须保留管理员链，同时以 workspace-IAM owner 的匿名账号+手机号+OTP 流程满足用户任务。
BUSINESS_USER_OR_OWNER=运营管理后台中具有各目标管理资格的用户；未登录的受邀/恢复用户；最终任职、凭据和导航事实分别由 workspace-IAM、登录 owner 与导航 owner 返回。
CURRENT_TASK=补齐 PUBLIC-ACCESS-RECOVERY、OPERATIONS-PASSWORD、OPERATIONS-USERS 的五个用户页及 OPERATIONS-FIVE-HOME-BOOTSTRAPS 的逐 screen 严格 IA。
SUCCESS_OUTCOME=用户只在其已批准的用户管理目标或安全流程中完成任务；公开流程不创建登录会话；首页只承载正确路由与 Shell 内容出口。
UI_BEARING=true
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin（运营管理后台；公开恢复属于其未登录入口）
```

## 1. 业务来源、现有批准子流与边界

| surface / pageDesignKey | 原始任务 | Heritage 静态摹本来源 | 本稿边界 |
| --- | --- | --- | --- |
| PUBLIC-ACCESS-RECOVERY | D04-S10 + Dexter 2026-07-29 自助恢复裁决 | `AccessRecoveryPage.tsx@2c7d8ecde8aeb446734a2606e563260a58195a01b4a05731b99236361d1e6bd6` | 公开入口，不创建登录会话、不进入后台 Shell；继承已品牌化集团空间上下文，不额外输入集团空间。 |
| OPERATIONS-PASSWORD | D04-S12O | `OperationsPasswordChangeDrawer.tsx@eeaf97cdbe180f5855ac68932c62e22caa8615cdb51861db797faa0243fa0432` | 已登录本人改密；成功后回到登录页。 |
| OPERATIONS-USERS / five user pageDesignKeys | D04-S04 | `UserManagementPage.tsx@c811961086741b0da5a53f8a38dcc4ef7d7df9a3589be466bb95ea58e7f44265` | 五个目标分别设计；邀请 Tab/Drawer/复制/取消/重发只引用已接受 IA01。 |
| OPERATIONS-FIVE-HOME-BOOTSTRAPS / HOME-GROUP、HOME-REGION、HOME-PROJECT、HOME-HEAD-COMPANY、HOME-STORE | D04-S08/S09 | `OperationsAdminSeed.tsx@535e7b1d7c1550f45491a3f49a96af0399d71d1450a83caf0a908028c9d93cb9` | 只保留路由、Shell 和内容出口；不新增“首页数据”或控制台。 |

五类用户页的目标来自已批准的 operation/capability 绑定，而非页面名称、当前任职类型或用户提交的机构。界面只表达业务目标（集团、大区、项目、总公司、门店），不展示任何内部映射。

## 2. 逐 screen 声明与低保真线框

| screen | surface、形态、入口 | actor / 场景 / 业务目标 | 用户可见内容与低保真线框 | F / 技术边界 / O |
| --- | --- | --- | --- | --- |
| IA05-RECOVERY-VERIFY | PUBLIC-ACCESS-RECOVERY；独立公开页；已品牌化运营登录页“忘记密码” | 未登录运营用户验证本人账号与手机号 | `<集团空间 LOGO> <集团空间名称>`；`<运营管理后台标题>`；`找回<运营管理后台标题>密码`<br>`步骤：验证身份 — 设置新密码 — 完成`<br>`登录名 [________] 手机号 [________] 验证码 [______][获取验证码]`<br>`当前为测试环境，验证码：<code>`（仅 owner 返回非空时）<br>`[下一步] 返回登录` | `testId`；不读取后台 session，不显示账号匹配/错误代码；workspace-IAM public recovery owner verification |
| IA05-RECOVERY-PASSWORD | 独立公开页第二步；验证成功后 | 已完成本人验证的用户设置新密码 | `<集团空间 LOGO> <集团空间名称>`；`<运营管理后台标题>`；`设置新密码`；新密码、确认新密码、上一步/提交 | `testId`；确认密码依赖新密码；秘密不回显；workspace-IAM public recovery owner reset |
| IA05-RECOVERY-COMPLETE | 独立公开页第三步 | 知道重设完成并返回运营登录 | `<集团空间 LOGO> <集团空间名称>`；`<运营管理后台标题>`；`密码已重设`；“请使用新密码登录<运营管理后台标题>。” `[返回登录]` | `testId`；不创建 session；workspace-IAM public recovery owner outcome |
| IA05-PASSWORD-DRAWER | OPERATIONS-PASSWORD；Drawer；运营后台用户菜单“修改密码” | 已登录运营用户修改本人密码 | `修改密码`；当前密码、新密码、确认新密码、取消/保存 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,useOverlayLock,testId`；不展示会话或密码值；login owner command |
| IA05-PASSWORD-RESULT | Modal；成功后关闭密码 Drawer | 知道已修改且需要重新登录 | `修改成功`；“密码已修改，请使用新密码重新登录。” `[重新登录]` | `useOverlayLock,testId`；其他会话失效是 owner 结果；login owner session |
| IA05-GROUP-USERS | PG-IAM-GROUP-USERS；独立内容页 | 集团用户管理员查看集团任职用户 | `集团用户`；姓名(链接)、登录账号、业务角色、状态、更新时间；页头 `邀请用户` 进入 IA01 已批准子流 | `contextScopedQueryArgs,testId`；目标固定为集团；workspace-IAM list |
| IA05-REGION-USERS | PG-IAM-REGION-USERS；独立内容页 | 大区用户管理员查看当前大区任职用户 | `大区用户`；姓名(链接)、登录账号、业务角色、状态、更新时间；`邀请用户` → IA01 | 同上；目标固定为大区；workspace-IAM list |
| IA05-PROJECT-USERS | PG-IAM-PROJECT-USERS；独立内容页 | 项目用户管理员查看当前项目任职用户 | `项目用户`；姓名(链接)、登录账号、业务角色、状态、更新时间；`邀请用户` → IA01 | 同上；目标固定为项目；workspace-IAM list |
| IA05-HEAD-COMPANY-USERS | PG-IAM-HEAD-COMPANY-USERS；独立内容页 | 总公司用户管理员查看当前总公司任职用户 | `总公司用户`；姓名(链接)、登录账号、业务角色、状态、更新时间；`邀请用户` → IA01 | 同上；目标固定为总公司；workspace-IAM list |
| IA05-STORE-USERS | PG-IAM-STORE-USERS；独立内容页 | 门店用户管理员查看当前门店任职用户 | `门店用户`；姓名(链接)、登录账号、业务角色、状态、更新时间；`邀请用户` → IA01 | 同上；目标固定为门店；workspace-IAM list |
| IA05-USER-DETAIL | 五类用户页的详情 Drawer；姓名链接 | 在正确目标中先核对一条任职，再决定撤销 | `用户任职详情 [撤销任职]`；姓名、登录账号、任职机构、业务角色、状态、加入时间；标题随进入页显示“项目用户任职详情”等 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；任职标识和 capability 不展示；workspace-IAM detail |
| IA05-USER-REVOKE | Modal；详情“撤销任职” | 明确撤销该目标内的一条任职 | `确认撤销“<姓名>”在“<任职机构>”的任职？`；“撤销后该用户将不能以此任职进入相应功能。”取消/确认 | `useOverlayLock,useSubmissionLifecycle,testId`；动作由目标绑定，不由当前任职类型推导；workspace-IAM revoke |
| IA05-HOME-GROUP | HOME-GROUP；route/bootstrap；集团任职登录/切换完成 | 进入由 navigation owner 决定的首个可访问业务页 | `v2 bootstrap 内容出口`（无新增首页内容） | `testId`；只消费 navigation readback，不画 Shell；navigation owner |
| IA05-HOME-REGION | HOME-REGION；route/bootstrap | 进入由 navigation owner 决定的首个可访问业务页 | `v2 bootstrap 内容出口`（无新增首页内容） | `testId`；不画 Shell；navigation owner |
| IA05-HOME-PROJECT | HOME-PROJECT；route/bootstrap | 进入由 navigation owner 决定的首个可访问业务页 | `v2 bootstrap 内容出口`（无新增首页内容） | `testId`；不画 Shell；navigation owner |
| IA05-HOME-HEAD-COMPANY | HOME-HEAD-COMPANY；route/bootstrap | 进入由 navigation owner 决定的首个可访问业务页 | `v2 bootstrap 内容出口`（无新增首页内容） | `testId`；不画 Shell；navigation owner |
| IA05-HOME-STORE | HOME-STORE；route/bootstrap | 进入由 navigation owner 决定的首个可访问业务页 | `v2 bootstrap 内容出口`（无新增首页内容） | `testId`；不画 Shell；navigation owner |

## 3. 表单、目标与级联说明

| screen | 级联与提交规则 |
| --- | --- |
| IA05-RECOVERY-VERIFY | 先填写登录名和本人手机号，才可请求验证码；成功验证两者匹配后才可到“设置新密码”。发送/验证对不存在、停用或不匹配返回同一提示“如果信息匹配，验证码将发送到该手机号”，不泄露账号是否存在。运营入口已由 owner 品牌 readback 定位集团空间，不额外填写或选择集团空间。 |
| IA05-RECOVERY-PASSWORD | 新密码改变即重新校验确认新密码；不一致不可提交；取消、失败和成功后都清除秘密字段。 |
| IA05-PASSWORD-DRAWER | 确认新密码依赖新密码；提交由 owner 核验当前密码与密码规则，成功或失败均不保留三个秘密。 |
| IA05-{GROUP,REGION,PROJECT,HEAD-COMPANY,STORE}-USERS | 该页只读取其既有目标及当前已批准的数据范围；不可由选择列表改变目标。若没有权限，显示“你暂时无法查看<目标>用户”，不降级为其他对象的人群。 |
| IA05-USER-REVOKE | 详情中显示的任职机构和业务角色只用于用户核对；确认后 owner 以该页固有目标重新校验撤销资格与任职事实。 |

## 4. 明确不可合并的用户任务

1. 五个用户列表共有视觉骨架，但它们是五个目标固定的业务页面；不能以“用户管理 + 任意机构参数”实现或设计。
2. IA01 已覆盖邀请及其令牌、复制、取消、重发；本稿的“邀请用户”只作不重复的入口引用。
3. 公开恢复在未登录状态以“登录名+本人手机号+验证码”完成身份验证与密码设置；本人改密在已登录运营后台的 Drawer 中完成。两者不能合并，也不互相创建 session。
4. 五个首页仅是可审计的路由和内容出口，不因“首页”一词创作数据卡片、指标或管理操作。

## 5. 接受条件

1. 五类用户页保持 target 固定；用户只能通过姓名链接进入详情，再从详情进入撤销确认，不增加表格行尾操作列。
2. 运营自助恢复严格使用“登录名+手机号+验证码”，且从已品牌化集团空间登录入口进入；不增加集团空间输入或 client-side 品牌推导。
3. 管理员签发 `resetGenerationKey` 链保留为平台空间账号治理，不可伪装为登录页入口；公开恢复与已登录本人改密不合并。
4. `GAP-OPERATIONS-SELF-SERVICE-RESET-ENTRY`、`GAP-PUBLIC-RESET-BRANDING-READBACK` 和用户列表筛选 GAP 是 implementation-facing 阻断项；当前仅为可审阅静态详设。

## 6. 逐 screen Heritage 对应矩阵

`H-RECOVERY`、`H-PASSWORD`、`H-USERS`、`H-HOME` 分别是 §1 同名行的**完整 path@SHA-256**。
公开、已登录、五个目标及五条首页路由虽然有相似视觉，不共享未经批准的行为。

| screen | 对应关系 / 静态摹本 | 差异与原因 |
| --- | --- | --- |
| IA05-RECOVERY-VERIFY | PARTIAL_COUNTERPART / H-RECOVERY | 保留验证阶段；Dexter 新裁决把入口由仅 `resetGenerationKey` 改为登录页自助恢复。 |
| IA05-RECOVERY-PASSWORD | PARTIAL_COUNTERPART / H-RECOVERY | 保留验证成功后才出现新密码输入；自助入口变化见上一行。 |
| IA05-RECOVERY-COMPLETE | PARTIAL_COUNTERPART / H-RECOVERY | 明确完成后仅回到登录，不创建 session。 |
| IA05-PASSWORD-DRAWER | EXACT_COUNTERPART / H-PASSWORD | 已登录运营用户的本人改密。 |
| IA05-PASSWORD-RESULT | PARTIAL_COUNTERPART / H-PASSWORD | D04-S12O 要求重新登录，故独立结果面。 |
| IA05-GROUP-USERS | PARTIAL_COUNTERPART / H-USERS | 固有目标为集团，不能由用户改成其他机构。 |
| IA05-REGION-USERS | PARTIAL_COUNTERPART / H-USERS | 固有目标为大区，保持独立页面。 |
| IA05-PROJECT-USERS | PARTIAL_COUNTERPART / H-USERS | 固有目标为项目，不能退化成当前任职人群。 |
| IA05-HEAD-COMPANY-USERS | PARTIAL_COUNTERPART / H-USERS | 固有目标为总公司，保持独立页面。 |
| IA05-STORE-USERS | PARTIAL_COUNTERPART / H-USERS | 固有目标为门店，保持独立页面。 |
| IA05-USER-DETAIL | PARTIAL_COUNTERPART / H-USERS | 从五类页面进入，并保留目标名称以供用户核对。 |
| IA05-USER-REVOKE | PARTIAL_COUNTERPART / H-USERS | 撤销资格由该页固有目标重核，不从当前任职推导。 |
| IA05-HOME-GROUP | EXACT_COUNTERPART / H-HOME | 仅集团路由、Shell 和内容出口。 |
| IA05-HOME-REGION | EXACT_COUNTERPART / H-HOME | 仅大区路由、Shell 和内容出口。 |
| IA05-HOME-PROJECT | EXACT_COUNTERPART / H-HOME | 仅项目路由、Shell 和内容出口。 |
| IA05-HOME-HEAD-COMPANY | EXACT_COUNTERPART / H-HOME | 仅总公司路由、Shell 和内容出口。 |
| IA05-HOME-STORE | EXACT_COUNTERPART / H-HOME | 仅门店路由、Shell 和内容出口。 |

本稿为已获 Dexter 接受、等待 implementation-facing re-freeze 的静态详设，`DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29`，仍不授权 implementation。实施者必须先从表 1 回读原始业务需求与静态基线，再按表 2 的目标固定性、公开/已登录边界、Drawer/Modal surface 与表 3 的级联实施；任何新增用户操作、首页内容或公开品牌规则必须回到 Dexter 决策，不能从当前源码推断。

## 7. 严格 screen sheets（公开恢复与本人安全）

`H-RECOVERY`=`all-v2/apps/frontend/operations-admin/src/features/access-recovery/ui/AccessRecoveryPage.tsx@2c7d8ecde8aeb446734a2606e563260a58195a01b4a05731b99236361d1e6bd6`；`H-PASSWORD`=`all-v2/apps/frontend/operations-admin/src/features/work-context/ui/OperationsPasswordChangeDrawer.tsx@eeaf97cdbe180f5855ac68932c62e22caa8615cdb51861db797faa0243fa0432`。原始来源 R5 D04-S10、D04-S12O。

<a id="IA05-RECOVERY-VERIFY"></a>
### Screen: IA05-RECOVERY-VERIFY
```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=operations-admin（运营管理后台）；未认证公开入口，不是已登录 shell/session
UI_SURFACE=独立页面
HOST_AND_ENTRY=已品牌化运营登录页“忘记密码”；路由已经携带所属集团空间上下文，不额外填写集团空间
ACTOR=无法登录的运营用户
BUSINESS_SCENARIO=忘记密码但仍可证明本人账号与手机号
BUSINESS_GOAL=完成账号、本人手机号与验证码验证并进入设置新密码
USER_VISIBLE_COPY=品牌区“<集团空间 LOGO> <集团空间名称>”与“<运营管理后台标题>”；标题“找回<运营管理后台标题>密码”；步骤“验证身份—设置新密码—完成”；“登录名”“手机号”“验证码”“获取验证码”“下一步”“返回登录”；统一提示“如果信息匹配，验证码将发送到该手机号”；仅当 owner 返回本次非空测试验证码时显示提示“当前为测试环境，验证码：<code>”
TECHNICAL_BOUNDARY=账号存在性、账号与手机号匹配、验证码、恢复 flow、令牌和诊断不显示；不创建 session；品牌只消费 owner-approved readback，绝不从 URL 或 asset ref 推导；测试验证码提示仅由服务端非生产配置决定，生产不存在，页面不能推导
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-RECOVERY。保留 Heritage 的验证、设新密码、完成与不创建 session；Dexter 已裁定新增“忘记密码”自助入口，替换原先仅能由 resetGenerationKey 进入的前置条件
```
```text
<集团空间 LOGO> <集团空间名称>
<运营管理后台标题>
找回<运营管理后台标题>密码  验证身份 — 设置新密码 — 完成
登录名 [____] 手机号 [____] 验证码 [____] [获取验证码] [下一步] [返回登录]
当前为测试环境，验证码：<code>（仅 owner 返回非空时）
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 登录名 | `Input` | 用户填写 | 页面打开 | 改变即清空验证码和已发送状态 | 仅本地格式 | 统一失败提示 | workspace-IAM 重新匹配账号 |
| 手机号 | `Input` | 用户填写 | 登录名和手机号格式通过才可请求 | 改变即清空验证码和已发送状态 | 仅本地格式 | 统一发送/失败提示 | workspace-IAM 以账号绑定手机号、账号状态和限频重新核验 |
| 验证码 | `Input` | 用户填写 | 当前登录名+手机号的 owner send 成功 | 登录名或手机号改变即失效 | 仅本地格式 | 验证失败清空验证码但保留非敏感输入 | workspace-IAM 重新核验同一账号、手机号、OTP、一次性 flow 和有效期 |
| 获取验证码/下一步 | 次要按钮/主按钮 | 当前表单与 owner flow | 前置字段格式通过；验证成功后才可下一步 | 不携带 flow/品牌/账号内部事实 | 不显示账号匹配结论；仅 owner 返回本次非空测试验证码时显示测试提示 | 发送/验证中禁重复；未知结果由 owner flow readback 确认 | workspace-IAM public recovery owner |

<a id="IA05-RECOVERY-PASSWORD"></a>
### Screen: IA05-RECOVERY-PASSWORD
```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=operations-admin（运营管理后台）；未认证公开入口，不是已登录 shell/session
UI_SURFACE=独立页面
HOST_AND_ENTRY=IA05-RECOVERY-VERIFY 验证成功后
ACTOR=已完成本人验证的运营用户
BUSINESS_SCENARIO=在 owner 已验证账号、本人手机号和验证码后继续公开密码恢复
BUSINESS_GOAL=设置符合规则的新密码
USER_VISIBLE_COPY=品牌区“<集团空间 LOGO> <集团空间名称>”与“<运营管理后台标题>”；标题“设置新密码”；“新密码”“确认新密码”“上一步”“提交”
TECHNICAL_BOUNDARY=恢复 flow、一次性完成 grant、规则诊断和 session 不显示；品牌只消费 owner-approved readback
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-RECOVERY。保留 Heritage 的验证、设新密码、完成与不创建 session；Dexter 已裁定新增“忘记密码”自助入口，替换原先仅能由 resetGenerationKey 进入的前置条件
```
```text
<集团空间 LOGO> <集团空间名称>  <运营管理后台标题>
设置新密码  新密码 [____] 确认新密码 [____] [上一步] [提交]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 新密码/确认新密码 | Password | 用户填写 | owner 已验证的同一恢复 flow | 改新密码重验确认 | 不一致不可提交 | 离开/失败清除秘密 | workspace-IAM complete 重验 flow、grant、账号状态、密码规则和一次性使用 |

<a id="IA05-RECOVERY-COMPLETE"></a>
### Screen: IA05-RECOVERY-COMPLETE
```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=operations-admin（运营管理后台）；未认证公开入口，不是已登录 shell/session
UI_SURFACE=独立页面
HOST_AND_ENTRY=IA05-RECOVERY-PASSWORD 提交成功后
ACTOR=刚完成公开密码恢复的运营用户
BUSINESS_SCENARIO=知道恢复已完成
BUSINESS_GOAL=回到登录页使用新密码
USER_VISIBLE_COPY=品牌区“<集团空间 LOGO> <集团空间名称>”与“<运营管理后台标题>”；“密码已重设”；“请使用新密码登录<运营管理后台标题>。”；“返回登录”
TECHNICAL_BOUNDARY=不创建登录 session
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-RECOVERY
```
```text
<集团空间 LOGO> <集团空间名称>  <运营管理后台标题>
密码已重设  请使用新密码登录<运营管理后台标题>。 [返回登录]
```

<a id="IA05-PASSWORD-DRAWER"></a>
### Screen: IA05-PASSWORD-DRAWER
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=运营后台用户菜单“修改密码”
ACTOR=已登录运营用户
BUSINESS_SCENARIO=更新本人密码
BUSINESS_GOAL=安全修改本人登录密码
USER_VISIBLE_COPY=“修改密码”；“当前密码”“新密码”“确认新密码”；“取消”“保存”
TECHNICAL_BOUNDARY=密码、会话、诊断不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,useOverlayLock,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-PASSWORD
```
```text
修改密码 当前密码 [____] 新密码 [____] 确认新密码 [____] [取消] [保存]
```

<a id="IA05-PASSWORD-RESULT"></a>
### Screen: IA05-PASSWORD-RESULT
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA05-PASSWORD-DRAWER 保存成功后
ACTOR=已登录运营用户
BUSINESS_SCENARIO=本人密码已经修改
BUSINESS_GOAL=重新登录继续运营工作
USER_VISIBLE_COPY=“修改成功”；“密码已修改，请使用新密码重新登录。”；“重新登录”
TECHNICAL_BOUNDARY=其他会话失效细节不显示
FOUNDATION_PRIMITIVE=useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-PASSWORD
```
```text
修改成功  密码已修改，请使用新密码重新登录。 [重新登录]
```

## 8. 严格 screen sheets（五类用户与 route/bootstrap）

`H-USERS`=`all-v2/apps/frontend/operations-admin/src/features/user-management/ui/UserManagementPage.tsx@c811961086741b0da5a53f8a38dcc4ef7d7df9a3589be466bb95ea58e7f44265`；`H-HOME`=`all-v2/apps/frontend/operations-admin/src/app/OperationsAdminSeed.tsx@535e7b1d7c1550f45491a3f49a96af0399d71d1450a83caf0a908028c9d93cb9`。原始来源 R5 D04-S04、D04-S08/S09。

<a id="IA05-GROUP-USERS"></a>
### Screen: IA05-GROUP-USERS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=集团用户菜单
ACTOR=具有集团用户管理资格的运营用户
BUSINESS_SCENARIO=查看集团任职用户
BUSINESS_GOAL=在集团目标中找到一条任职
USER_VISIBLE_COPY=“集团用户”“邀请用户”；筛选“姓名”“手机号”“业务角色”“状态”；按钮“查询”“重置”；列“姓名”“登录账号”“业务角色”“状态”“更新时间”
TECHNICAL_BOUNDARY=目标固定为集团，内部能力映射不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-USERS
```
```text
集团用户 [邀请用户] 姓名 [待补服务端筛选] 手机号 [待补服务端筛选] 业务角色 [待补服务端筛选] 状态 [待补服务端筛选] [查询][重置]
姓名（链接） | 登录账号 | 业务角色 | 状态 | 更新时间
```

<a id="IA05-REGION-USERS"></a>
### Screen: IA05-REGION-USERS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=大区用户菜单
ACTOR=具有大区用户管理资格的运营用户
BUSINESS_SCENARIO=查看当前大区任职用户
BUSINESS_GOAL=在大区目标中找到一条任职
USER_VISIBLE_COPY=“大区用户”“邀请用户”；筛选“姓名”“手机号”“业务角色”“状态”；按钮“查询”“重置”；列“姓名”“登录账号”“业务角色”“状态”“更新时间”
TECHNICAL_BOUNDARY=目标固定为大区，不能由当前任职推导
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-USERS
```
```text
大区用户 [邀请用户] 姓名 [待补服务端筛选] 手机号 [待补服务端筛选] 业务角色 [待补服务端筛选] 状态 [待补服务端筛选] [查询][重置]
姓名（链接） | 登录账号 | 业务角色 | 状态 | 更新时间
```

<a id="IA05-PROJECT-USERS"></a>
### Screen: IA05-PROJECT-USERS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=项目用户菜单
ACTOR=具有项目用户管理资格的运营用户
BUSINESS_SCENARIO=查看当前项目任职用户
BUSINESS_GOAL=在项目目标中找到一条任职
USER_VISIBLE_COPY=“项目用户”“邀请用户”；筛选“姓名”“手机号”“业务角色”“状态”；按钮“查询”“重置”；列“姓名”“登录账号”“业务角色”“状态”“更新时间”
TECHNICAL_BOUNDARY=目标固定为项目；不可退化为当前任职人群
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-USERS
```
```text
项目用户 [邀请用户] 姓名 [待补服务端筛选] 手机号 [待补服务端筛选] 业务角色 [待补服务端筛选] 状态 [待补服务端筛选] [查询][重置]
姓名（链接） | 登录账号 | 业务角色 | 状态 | 更新时间
```

<a id="IA05-HEAD-COMPANY-USERS"></a>
### Screen: IA05-HEAD-COMPANY-USERS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=总公司用户菜单
ACTOR=具有总公司用户管理资格的运营用户
BUSINESS_SCENARIO=查看当前总公司任职用户
BUSINESS_GOAL=在总公司目标中找到一条任职
USER_VISIBLE_COPY=“总公司用户”“邀请用户”；筛选“姓名”“手机号”“业务角色”“状态”；按钮“查询”“重置”；列“姓名”“登录账号”“业务角色”“状态”“更新时间”
TECHNICAL_BOUNDARY=目标固定为总公司
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-USERS
```
```text
总公司用户 [邀请用户] 姓名 [待补服务端筛选] 手机号 [待补服务端筛选] 业务角色 [待补服务端筛选] 状态 [待补服务端筛选] [查询][重置]
姓名（链接） | 登录账号 | 业务角色 | 状态 | 更新时间
```

<a id="IA05-STORE-USERS"></a>
### Screen: IA05-STORE-USERS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=门店用户菜单
ACTOR=具有门店用户管理资格的运营用户
BUSINESS_SCENARIO=查看当前门店任职用户
BUSINESS_GOAL=在门店目标中找到一条任职
USER_VISIBLE_COPY=“门店用户”“邀请用户”；筛选“姓名”“手机号”“业务角色”“状态”；按钮“查询”“重置”；列“姓名”“登录账号”“业务角色”“状态”“更新时间”
TECHNICAL_BOUNDARY=目标固定为门店
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-USERS
```
```text
门店用户 [邀请用户] 姓名 [待补服务端筛选] 手机号 [待补服务端筛选] 业务角色 [待补服务端筛选] 状态 [待补服务端筛选] [查询][重置]
姓名（链接） | 登录账号 | 业务角色 | 状态 | 更新时间
```

<a id="IA05-USER-DETAIL"></a>
### Screen: IA05-USER-DETAIL
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=五类用户页的姓名链接
ACTOR=具有当前目标用户管理资格的运营用户
BUSINESS_SCENARIO=撤销前核对一条任职
BUSINESS_GOAL=确认用户、任职机构和业务角色
USER_VISIBLE_COPY=“<集团/大区/项目/总公司/门店>用户任职详情”“姓名”“登录账号”“任职机构”“业务角色”“状态”“加入时间”“撤销任职”
TECHNICAL_BOUNDARY=目标映射、任职内部标识不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-USERS
```
```text
<目标>用户任职详情 姓名 / 登录账号 / 任职机构 / 业务角色 / 状态 / 加入时间 [撤销任职]
```

<a id="IA05-USER-REVOKE"></a>
### Screen: IA05-USER-REVOKE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA05-USER-DETAIL 的“撤销任职”
ACTOR=具有当前目标用户管理资格的运营用户
BUSINESS_SCENARIO=准备撤销一条任职
BUSINESS_GOAL=明确确认该用户与任职机构
USER_VISIBLE_COPY=“确认撤销“<姓名>”在“<任职机构>”的任职？”；“撤销后该用户将不能以此任职进入相应功能。”；“取消”“确认”
TECHNICAL_BOUNDARY=撤销按页面固定目标重新核验；不显示内部能力或标识
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-USERS
```
```text
确认撤销“<姓名>”在“<任职机构>”的任职？ [取消] [确认]
```

<a id="IA05-HOME-GROUP"></a>
### Screen: IA05-HOME-GROUP
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=集团任职登录/切换后的 HOME-GROUP route
ACTOR=已完成集团任职选择的运营用户
BUSINESS_SCENARIO=登录或切任职后进入获准业务页
BUSINESS_GOAL=由 navigation owner 导向首个可访问业务页
USER_VISIBLE_COPY=v2 bootstrap 内容出口（无新增首页内容）
TECHNICAL_BOUNDARY=Shell 归 IA02；route/context/navigation 由 owner 处理
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-HOME
```
```text
[v2 bootstrap 内容出口；无新增业务卡片或首页标题]
```

### 8.1 未认证自助恢复的 owner、品牌与令牌边界

`GAP-OPERATIONS-SELF-SERVICE-RESET-ENTRY`：当前
`PublicWorkspacePasswordResetController` 与 `access-recovery.paths.yaml` 的三条 public operation 都要求
`resetGenerationKey`，它只能由已认证运维管理员通过 `requestWorkspaceCredentialReset` 发起后生成，因而不能
作为运营登录页“忘记密码”的入口。Dexter 已明确裁决需要自助恢复；final P6 必须由 workspace-IAM 新增匿名
start/send/verify/complete readback/command family，输入为**当前已品牌化运营入口上下文 + 登录名 + 手机号**，
不允许用户额外填写或搜索集团空间。

`GAP-PUBLIC-RESET-BRANDING-READBACK`：当前 public reset operation 不带集团空间展示 readback，且当前
operations login-entry 对 LOGO 仍只有 ref/fixed null。恢复页的“<集团空间 LOGO>”“<集团空间名称>”和
“<运营管理后台标题>”必须由 workspace-IAM/gateway owner 的 approved branding readback 提供；客户端不得从
URL、`resetGenerationKey`、asset ref 或缓存猜测。最终闭环必须同时声明 contract、owner readback、generated
client、共享 public header 与三屏测试，缺一项则恢复页保持不可实施。

**retain / replace**：保留现有“已认证运维管理员发起 → `resetGenerationKey` → 本人手机号验证 → 设置密码”
管理恢复链，供平台空间账号治理使用；它不再被当成登录页自助入口。新增的运营自助链在 owner 的匿名 start
后建立短时、不可展示的 recovery flow（secure HttpOnly cookie 或等价 owner-bound opaque handle），验证码验证
仅对同一 flow 释放一次性 complete grant。禁止在 URL、页面、日志可见文案或品牌 readback 中泄露 raw
`resetGenerationKey`、flow、grant、账号是否存在或账号—手机号匹配结论。

共同安全规则：start/send 对账号不存在、停用、手机号不匹配的响应和文案一致；workspace-IAM 按所属集团空间、
规范化账号、手机号和 HMAC 化来源限频；verify/complete 在 owner 事务中重验账号、手机号、OTP、flow、
账号状态、过期和一次性使用，成功后撤销该账号所有有效 session。页面只做格式、倒计时和秘密清理；未知结果先
读 owner flow 状态，不能盲目重发或把浏览器状态当作授权事实。

### 8.2 IA05 表单 mutation 分母（本 IA 局部对账，不替代 canonical ledger）

`FORM_MUTATION_DENOMINATOR=3 family / 7 existing-or-approved-variant`；canonical command 总分母与最终命名
只引用 `doc/evidence/platform/rm1/p6/rm1-u09-form-command-variant-ledger.md`，本表不新建第二份 ledger。
空的“接受条件”不能替代这张矩阵；每个确认面即使没有可编辑业务字段，也必须列出 hidden facts 和 owner
recheck。

| local family | screen / 有限 variant | 用户可修改事实 | 固定或隐藏事实 | 提交 owner、版本/幂等和再核验 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| SELF_SERVICE_RECOVERY_OPERATIONS | `IA05-RECOVERY-VERIFY/PASSWORD/COMPLETE` × 1 | 登录名、手机号、验证码、新密码 | 运营入口已读品牌与集团空间上下文；owner-bound flow；一次性 complete grant；发送/验证冷却 | workspace-IAM anonymous recovery owner；send/verify/complete 分别有幂等和一次性重验；重验账号+手机号+OTP+flow+账号状态 | `GAP-OPERATIONS-SELF-SERVICE-RESET-ENTRY` + `GAP-PUBLIC-RESET-BRANDING-READBACK`，不能以现有 resetGenerationKey 链伪称可用 |
| CURRENT_PASSWORD_OPERATIONS | `IA05-PASSWORD-DRAWER` × 1 | 当前密码、新密码、确认新密码 | 当前 session、session version、账号身份 | workspace-IAM current-password command 重验当前密码、密码规则、预期 session version；成功撤销 session | 已有 D04-S12O 业务任务；以 canonical ledger 的 P02 行为准 |
| ASSIGNMENT_REVOKE_OPERATIONS | `IA05-USER-REVOKE` × 5（集团/大区/项目/总公司/门店） | 无业务字段，仅确认 | 当前 target 固有、详情 readback 的 assignment、机构/角色展示、expected version、context version、idempotency | workspace-IAM target-specific revoke command 重验 target、范围、任职事实和版本 | 已有 D04-S04；在 canonical ledger 的 credential/assignment family 逐端点对账，不可合并为“用户管理 + 参数” |

### 8.3 Surface ownership roster（本稿 17 个 screen）

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | owner 对账 | USER_VISIBLE_COPY 对账 | 结论 |
| --- | --- | --- | --- | --- | --- |
| IA05-RECOVERY-VERIFY | 独立公开页 | 三项品牌、步骤、账号/手机号/验证码、按钮、统一提示、测试验证码提示 | 仅恢复验证页；品牌来自 owner readback | 全部有位置 | REVISE：等待两个 GAP 的 contract/owner 闭环 |
| IA05-RECOVERY-PASSWORD | 独立公开页 | 三项品牌、步骤、新密码/确认、按钮 | 仅恢复设置页 | 全部有位置 | REVISE：等待同一 GAP 闭环 |
| IA05-RECOVERY-COMPLETE | 独立公开页 | 三项品牌、完成提示、返回登录 | 仅恢复完成页 | 全部有位置 | REVISE：等待同一 GAP 闭环 |
| IA05-PASSWORD-DRAWER | Drawer | 标题、三个密码字段、取消/保存 | 仅 Drawer | 全部有位置 | PASS |
| IA05-PASSWORD-RESULT | Modal | 成功提示、重新登录 | 仅 Modal | 全部有位置 | PASS |
| IA05-{GROUP,REGION,PROJECT,HEAD-COMPANY,STORE}-USERS | 内容页 × 5 | 搜索、邀请入口、表格、姓名链接 | 各自固定 target 内容页；不画详情/撤销字段 | 全部有位置 | PASS（列表筛选语义仍按 §9 GAP） |
| IA05-USER-DETAIL | Drawer | 任职事实、撤销入口 | 仅详情 Drawer | 全部有位置 | PASS |
| IA05-USER-REVOKE | Modal | 确认标题、影响说明、取消/确认 | 仅确认 Modal | 全部有位置 | PASS |
| IA05-{HOME-GROUP,HOME-REGION,HOME-PROJECT,HOME-HEAD-COMPANY,HOME-STORE} | 内容页 × 5 | content outlet 说明 | 仅 route/bootstrap 内容出口；Shell 属 IA02 | 全部有位置 | PASS |

### 8.4 接受条件与待确认事实

1. Dexter 的自助恢复裁决已写入本稿：两个后台均使用“账号+手机号+验证码”验证本人后重置密码；这不等于当前契约已实现。
2. 运营恢复从已品牌化集团空间入口进入，不显示也不新增集团空间输入；三屏均显示 owner-approved 集团空间 LOGO、名称和运营管理后台标题。
3. 管理员签发的 `resetGenerationKey` 链保留为账号治理的反例边界，不能被登录页利用、猜测或显示。
4. 本稿仍为静态详设；`GAP-OPERATIONS-SELF-SERVICE-RESET-ENTRY`、`GAP-PUBLIC-RESET-BRANDING-READBACK` 或 §9 的用户列表筛选 GAP 未闭合前，不得请求 implementation-facing GO。

## 9. P6 搜索能力不适用声明（2026-07-29）

`SEARCH_CAPABILITY_DENOMINATOR=5`。五个固定 target 用户页都要让管理者在**已经固定的 target 人群内**
定位某一任职，业务依据 R5 `D04-S05O` 与 G-05/G-07；固定 target 不等于不能搜索人。密码恢复、本人密码、
用户详情/撤销和五类 HOME 没有查询业务任务，仍为 `NOT_APPLICABLE_WITH_REASON`。不得添加可输入的机构/
target 筛选，也不得以当前任职推导目标。邀请创建中的“任职机构/业务角色”候选选择属于 IA01。

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- |
| `IA05-GROUP-USERS` / 集团任职用户 / 在集团固定人群内定位任职 | “姓名”“手机号”“业务角色”“状态” | 姓名、手机号、角色为文本 `Input`；状态固定 `Select` | OpenAPI 声明 `getOperationsWorkspaceGroupUser.userName/mobile/roleQuery/status`，但当前 `WorkspaceUserService.pageForOperations` 未接收/应用它们 | 条件互不级联；重置清条件和页码 | workspace-IAM 必须以固定 GROUP target、scopeRef、context version 并在服务端过滤后重验 | 人名/手机号/角色是已知检索词；无候选 read，不虚构下拉或从当前行生成候选 | `GAP-WORKSPACE-USER-LIST-FILTER-SEMANTICS`：同一 owner read 必须接收四字段，在固定 target+resolved scope 后服务端过滤，且 total 使用同条件；禁止 client-side filter |
| `IA05-REGION-USERS` / 大区任职用户 / 在大区固定人群内定位任职 | 同上 | 同上 | OpenAPI 声明 `getOperationsWorkspaceRegionUser` 同名参数；当前 service 同样未应用 | 同上 | workspace-IAM 以固定 REGION target、scopeRef、context version 重验 | 同上 | 同一 `GAP-WORKSPACE-USER-LIST-FILTER-SEMANTICS` |
| `IA05-PROJECT-USERS` / 项目任职用户 / 在项目固定人群内定位任职 | 同上 | 同上 | OpenAPI 声明 `getOperationsWorkspaceProjectUser` 同名参数；当前 service 同样未应用 | 同上 | workspace-IAM 以固定 PROJECT target、scopeRef、context version 重验 | 同上 | 同一 `GAP-WORKSPACE-USER-LIST-FILTER-SEMANTICS` |
| `IA05-HEAD-COMPANY-USERS` / 总公司任职用户 / 在总公司固定人群内定位任职 | 同上 | 同上 | OpenAPI 声明 `getOperationsWorkspaceHeadCompanyUser` 同名参数；当前 service 同样未应用 | 同上 | workspace-IAM 以固定 HEAD_COMPANY target、scopeRef、context version 重验 | 同上 | 同一 `GAP-WORKSPACE-USER-LIST-FILTER-SEMANTICS` |
| `IA05-STORE-USERS` / 门店任职用户 / 在门店固定人群内定位任职 | 同上 | 同上 | OpenAPI 声明 `getOperationsWorkspaceStoreUser` 同名参数；当前 service 同样未应用 | 同上 | workspace-IAM 以固定 STORE target、scopeRef、context version 重验 | 同上 | 同一 `GAP-WORKSPACE-USER-LIST-FILTER-SEMANTICS` |

<a id="IA05-HOME-REGION"></a>
### Screen: IA05-HOME-REGION
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=大区任职登录/切换后的 HOME-REGION route
ACTOR=已完成大区任职选择的运营用户
BUSINESS_SCENARIO=登录或切任职后进入获准业务页
BUSINESS_GOAL=由 navigation owner 导向首个可访问业务页
USER_VISIBLE_COPY=v2 bootstrap 内容出口（无新增首页内容）
TECHNICAL_BOUNDARY=Shell 归 IA02；route/context/navigation 由 owner 处理
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-HOME
```
```text
[v2 bootstrap 内容出口；无新增业务卡片或首页标题]
```

<a id="IA05-HOME-PROJECT"></a>
### Screen: IA05-HOME-PROJECT
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=项目任职登录/切换后的 HOME-PROJECT route
ACTOR=已完成项目任职选择的运营用户
BUSINESS_SCENARIO=登录或切任职后进入获准业务页
BUSINESS_GOAL=由 navigation owner 导向首个可访问业务页
USER_VISIBLE_COPY=v2 bootstrap 内容出口（无新增首页内容）
TECHNICAL_BOUNDARY=Shell 归 IA02；route/context/navigation 由 owner 处理
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-HOME
```
```text
[v2 bootstrap 内容出口；无新增业务卡片或首页标题]
```

<a id="IA05-HOME-HEAD-COMPANY"></a>
### Screen: IA05-HOME-HEAD-COMPANY
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=总公司任职登录/切换后的 HOME-HEAD-COMPANY route
ACTOR=已完成总公司任职选择的运营用户
BUSINESS_SCENARIO=登录或切任职后进入获准业务页
BUSINESS_GOAL=由 navigation owner 导向首个可访问业务页
USER_VISIBLE_COPY=v2 bootstrap 内容出口（无新增首页内容）
TECHNICAL_BOUNDARY=Shell 归 IA02；route/context/navigation 由 owner 处理
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-HOME
```
```text
[v2 bootstrap 内容出口；无新增业务卡片或首页标题]
```

<a id="IA05-HOME-STORE"></a>
### Screen: IA05-HOME-STORE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=门店任职登录/切换后的 HOME-STORE route
ACTOR=已完成门店任职选择的运营用户
BUSINESS_SCENARIO=登录或切任职后进入获准业务页
BUSINESS_GOAL=由 navigation owner 导向首个可访问业务页
USER_VISIBLE_COPY=v2 bootstrap 内容出口（无新增首页内容）
TECHNICAL_BOUNDARY=Shell 归 IA02；route/context/navigation 由 owner 处理
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-HOME
```
```text
[v2 bootstrap 内容出口；无新增业务卡片或首页标题]
```
