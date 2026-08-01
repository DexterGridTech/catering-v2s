# RM1 P6 表单、确认动作与前置 command variant 唯一台账

`STATUS=DESIGN_REPAIR_DRAFT`  
`IMPLEMENTATION_AUTHORITY=false`

## 1. 业务问题与唯一分母

R5 `D01-S02/S03/S04/S05`、`D02-S02/S03/S04`、`D03-S01/S02/S03` 与
`D04-S01/S02/S05O/S11/S12P` 要求用户仅从明确的业务任务面修改 owner 允许的事实。若把不同命令、状态
确认或本人密码合并为“相似表单”，会遗漏 immutable fact、候选约束或越过专用状态路径。

以下是唯一 command 分母。分母不是只看“新建/编辑 Drawer”，而是覆盖 P6 已画出的每一条**已认证管理
mutation、已认证本人安全 mutation、确认 Modal、以及表单提交不可缺的前置 mutation**。每一行都是一条
实际业务 action variant；一个业务 action 可依固定 target family 映射多条 edge endpoint，或多个独立业务
surface 可映射同一 endpoint。字段明细仍以 IA01 §9、IA02 §14、IA03 §11、IA04 §12 及 IA05 后续补齐的矩阵
为准。

为避免再次把“命令名相似”当作“同一命令”，本台账把集合分成互斥的 `C`（实体 create/edit）、`S`
（状态/作废）、`K`（凭据/任职/邀请动作）和 `P`（表单前置）。`C/S` 是 entity mutation，`K` 是经过
认证的 credential / assignment / invitation action，不能倒灌为 entity create/edit；`P` 不是实体编辑，
但其输出是创建/编辑表单的受控输入，故必须可追溯。当前所有在 scope 的 edge variants 总数为
**24 + 11 + 20 + 1 = 56**；其中 entity mutation 为 **35**，已认证 credential/assignment/invitation
action 为 **20**，提交前置为 **1**。公开恢复完成路径与已退役的平台邀请 edge 在 §4 明确列为不计入项，
不得用“没有放进 C/S/K”掩盖它们。

| id | IA | command variant | owning source | 字段矩阵 / 处置 |
| --- | --- | --- | --- | --- |
| C01 | IA01 | 创建固定 target 的用户邀请（一个邀请 Drawer 业务 action） | `OperationsWorkspaceInvitationController#{groupCreate,regionCreate,projectCreate,headCompanyCreate,storeCreate}` → `WorkspaceUserService#createInvitation` | IA01 §9；固定 GROUP/REGION/PROJECT/HEAD_COMPANY/STORE 五 endpoint 的显式 family 映射；仍是一个 UI action variant，不能退化为“任意机构” |
| C02 | IA02 | 新建集团空间 | `PlatformWorkspaceAdministrationController#create` | IA02 §14；core |
| C03 | IA02 | 初始化商业集团 | `PlatformCommercialGroupController#initialize` | IA02 §14；core |
| C04 | IA02 | 编辑集团空间展示资料 | `PlatformWorkspaceAdministrationController#update` | IA02 §14；core |
| C05 | IA03 | 新建平台管理员 | `PlatformAdminGovernanceController#create` | IA03 §11；core |
| C06 | IA03 | 编辑平台管理员资料 | `PlatformAdminGovernanceController#updateProfile` | IA03 §11；core |
| C07 | IA03 | 新建业务角色 | `PlatformWorkspaceRoleController#create` | IA03 §11；core |
| C08 | IA03 | 编辑角色资料、菜单及动作集合 | `PlatformWorkspaceRoleController#update` → `WorkspaceRoleService#update` | IA03 §11；`GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY` |
| C09 | IA03 | 原子替换一类扩展字段定义 | `PlatformExtensionDefinitionController#update` → `ExtensionDefinitionService` | IA03 §11；core |
| C10 | IA04 | 新建大区 | `OperationsOrganizationHierarchyController#createRegion` | IA04 §12.1；core |
| C11 | IA04 | 新建项目及分期数组 | `OperationsOrganizationHierarchyController#createProject` | IA04 §12.1；core |
| C12 | IA04 | 编辑大区或项目；项目时连同完整分期数组 | `OperationsOrganizationHierarchyController#update` | IA04 §12.1；一个真实 update command，type/parent/phases 来自 latest detail |
| C14 | IA04 | 新建品牌 | `OperationsBusinessEntityController#createBrand` | IA04 §12.2；core |
| C15 | IA04 | 编辑品牌 | `OperationsBusinessEntityController#updateBrand` | IA04 §12.2；core |
| C16 | IA04 | 新建经营租户 | `OperationsBusinessEntityController#createTenant` | IA04 §12.2；core |
| C17 | IA04 | 编辑经营租户 | `OperationsBusinessEntityController#updateTenant` | IA04 §12.2；core |
| C18 | IA04 | 新建总公司 | `OperationsBusinessEntityController#createHeadCompany` | IA04 §12.2；core |
| C19 | IA04 | 编辑总公司 | `OperationsBusinessEntityController#updateHeadCompany` | IA04 §12.2；core |
| C20 | IA04 | 添加总公司可经营品牌 | `OperationsHeadCompanyAuthorizationController#add` | IA04 §12.2；core |
| C21 | IA04 | 移除总公司可经营品牌 | `OperationsHeadCompanyAuthorizationController#remove` | IA04 §12.2；core |
| C22 | IA04 | 新建门店 | `OperationsStoreManagementController#create` | IA04 §12.2；`GAP-STORE-CREATE-CASCADE` |
| C23 | IA04 | 编辑门店允许资料 | `OperationsStoreManagementController#update` | IA04 §12.2；core |
| C24 | IA04 | 新建立即有效合同 | `OperationsContractController#create` | IA04 §12.3；contract GAPs |
| C25 | IA04 | 编辑有效合同 | `OperationsContractController#update` | IA04 §12.3；contract GAPs |

`CORE_CREATE_EDIT_SET=C01..C12,C14..C25`，即 **24** 条。C12 是同一 hierarchy update command 的两种
业务 surface，不可为同一 wire/owner command 虚增第二条；C01 的五条固定 target endpoint 是同一 invitation
Drawer 的一个业务 action，端点展开见 §4。计数以此 exact set
为准，不删除、合并或新增产品功能来迁就旧计数。

| id | IA | 确认 command variant | owning source |
| --- | --- | --- | --- |
| S01 | IA02 | 启用/停用集团空间 | `PlatformWorkspaceAdministrationController#transitionStatus` |
| S02 | IA03 | 启用/停用平台管理员 | `PlatformAdminGovernanceController#transitionStatus` |
| S03 | IA03 | 启用/停用业务角色 | `PlatformWorkspaceRoleController#status` |
| S04 | IA04 | 启用/停用大区（与 S05 为同一 endpoint 的两个业务 surface） | `OperationsOrganizationHierarchyController#transitionStatus` |
| S05 | IA04 | 启用/停用项目（与 S04 为同一 endpoint 的两个业务 surface） | `OperationsOrganizationHierarchyController#transitionStatus` |
| S06 | IA04 | 启用/停用品牌 | `OperationsBusinessEntityController#brandStatus` |
| S07 | IA04 | 启用/停用经营租户 | `OperationsBusinessEntityController#tenantStatus` |
| S08 | IA04 | 启用/停用总公司 | `OperationsBusinessEntityController#headCompanyStatus` |
| S09 | IA04 | 启用/停用门店 | `OperationsStoreManagementController#transitionStatus` |
| S10 | IA04 | 作废合同且保留历史 | `OperationsContractController#invalidate` |
| S11 | IA03 | 启用/停用集团空间内账号 | `PlatformWorkspaceAccountController#status` |

`STATUS_VOID_SET=S01..S11`，即 **11** 条。每条只从详情进入独立确认 Modal，且没有自由业务字段；
`S11` 的 hidden facts 是账号对象、latest detail 的 expectedVersion、目标状态及同一次提交 proof，不能因
IA03 将三个账号动作画在同一 Modal 而漏掉。

| id | IA | credential / assignment / invitation action variant | owning source | request 的固定事实 / 处置 |
| --- | --- | --- | --- |
| K01 | IA03 | 平台管理员修改本人密码 | `PlatformAuthenticationController#changePassword` | 当前密码、新密码、expected session version、同一 idempotency proof；秘密不进入草稿/日志 |
| K02 | IA05 | 运营用户修改本人密码 | `OperationsCatalogAuthenticationController#changePassword` | 当前密码、新密码、expected session version、同一 idempotency proof；秘密不进入草稿/日志 |
| K03 | IA03 | 运维管理员重置另一运维管理员登录凭据 | `PlatformAdminGovernanceController#resetCredential` | path 的管理员对象、request `password`、确认密码、expectedVersion、header/body 相同 idempotency key；IA03 已按 current contract 画为秘密输入 Drawer，提交/关闭/失败均清空秘密 |
| K04 | IA03 | 运维管理员为集团空间账号发起凭据重置 | `PlatformWorkspaceAccountController#requestCredentialReset` | path 的账号对象、expectedVersion、header idempotency key；owner 返回 delivery/readback，不把 resetGenerationKey 交给管理页 |
| K05 | IA03 | 运维管理员撤销集团空间账号的一条任职 | `PlatformWorkspaceAccountController#revoke` | path 的账号与 assignment、expectedVersion、header idempotency key；owner 重验空间和任职 |
| K06 | IA05 | 撤销集团目标用户任职 | `OperationsWorkspaceUserController#groupRevoke` | 固定 `GROUP` target、assignment、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K07 | IA05 | 撤销大区目标用户任职 | `OperationsWorkspaceUserController#regionRevoke` | 固定 `REGION` target、assignment、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K08 | IA05 | 撤销项目目标用户任职 | `OperationsWorkspaceUserController#projectRevoke` | 固定 `PROJECT` target、assignment、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K09 | IA05 | 撤销总公司目标用户任职 | `OperationsWorkspaceUserController#headCompanyRevoke` | 固定 `HEAD_COMPANY` target、assignment、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K10 | IA05 | 撤销门店目标用户任职 | `OperationsWorkspaceUserController#storeRevoke` | 固定 `STORE` target、assignment、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K11 | IA01 | 取消集团目标邀请 | `OperationsWorkspaceInvitationController#groupCancel` | 固定 `GROUP` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K12 | IA01 | 取消大区目标邀请 | `OperationsWorkspaceInvitationController#regionCancel` | 固定 `REGION` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K13 | IA01 | 取消项目目标邀请 | `OperationsWorkspaceInvitationController#projectCancel` | 固定 `PROJECT` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K14 | IA01 | 取消总公司目标邀请 | `OperationsWorkspaceInvitationController#headCompanyCancel` | 固定 `HEAD_COMPANY` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K15 | IA01 | 取消门店目标邀请 | `OperationsWorkspaceInvitationController#storeCancel` | 固定 `STORE` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K16 | IA01 | 重发集团目标邀请 | `OperationsWorkspaceInvitationController#groupReissue` | 固定 `GROUP` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K17 | IA01 | 重发大区目标邀请 | `OperationsWorkspaceInvitationController#regionReissue` | 固定 `REGION` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K18 | IA01 | 重发项目目标邀请 | `OperationsWorkspaceInvitationController#projectReissue` | 固定 `PROJECT` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K19 | IA01 | 重发总公司目标邀请 | `OperationsWorkspaceInvitationController#headCompanyReissue` | 固定 `HEAD_COMPANY` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |
| K20 | IA01 | 重发门店目标邀请 | `OperationsWorkspaceInvitationController#storeReissue` | 固定 `STORE` target、invitation、expectedContextVersion、expectedVersion、header/body 相同 idempotency key |

`CREDENTIAL_ASSIGNMENT_SET=K01..K20`，即 **20** 条。`K06..K20` 必须按五个固定 target 独立保留，
不得退化成“用户任职动作 + 当前节点类型”或拿一个泛化端点计数。每个纯确认面仍须在对应 IA 矩阵列出
对象、目标/动作、expectedVersion、context 与 idempotency 等 hidden facts。

| id | IA | form precondition variant | owning source | 输出与处置 |
| --- | --- | --- | --- |
| P01 | IA02 | 暂存集团空间 Logo 文件 | `PlatformAssetController#stage` | request 为 `usage`、file 与 header idempotency key；只消费 owner 返回的 `assetRef + bindGrant`，不由浏览器拼 URL 或自行解绑；`GAP-WORKSPACE-LOGO-STAGING-DISPOSITION` 保持阻断 |

`FORM_PRECONDITION_SET=P01`，即 **1** 条。它不是“编辑集团空间”的替代计数，也不是 `C04` 的隐含实现；
它是 C02/C04 Logo 分支的真实前置 command，故必须和实体 mutation 一起审计。

## 2. 角色状态边界

`C08` 的当前 wire `WorkspaceRoleUpdateRequest.status` 可写，且 generic owner update 会写入它；这与
“编辑资料/授权不改变状态，状态只由 S03”矛盾。最小正确形状是：**从 C08 通用更新 contract 移除 status，
owner 从 latest role 保留当前值；仅 S03 接受 target status。** 在 contract、edge、owner 同步收敛并有
red mutation 前，`GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY` 阻断 implementation-facing 设计。UI 不能以
隐藏 status 假称已经重验。

## 3. 统一候选搜索查询设计（Dexter 指令）

增长型、可能重名、受权限或上游关系约束的业务对象选择，一律使用一个 **consumer-side candidate-query
protocol**，而不是由每张表单各自定义查询接口：

```text
CandidateQuery { subjectType, queryText?, page?, pageSize?, consistencyToken?, dependencies[] }
CandidatePage  { items[{ref,label,secondaryLabel?,disabledReason?}], total?, nextPage? }
```

- `subjectType` 是固定业务对象词：集团空间、任职机构、业务角色、项目、品牌、经营租户、总公司、门店、项目分期；
  不传 owner/module/class 名。
- `dependencies[]` 只携带已确认上游 ref。例如项目+品牌→经营租户、品牌+经营租户→总公司、项目→门店。任一
  上游变化即取消旧请求、清空下游候选和值并重读。
- `consistencyToken?` 只从该 owner 已返回的 context/version/revision 映射；workspace-IAM 候选使用当前
  context version，platform selector 若 owner 没有相应 token 则字段缺省。不得生成 app-local version。
- 一个 candidate-query adapter 按 `subjectType` 路由到各 owner 的 public task read。统一的是 consumer
  wire shape、分页、搜索、取消、loading/empty/error 与缓存生命周期；**绝不统一 owner 数据、授权或关系判断**。
- 固定枚举（状态、任职机构类型、字段类型）、latest detail 的只读事实、用户已知的文本过滤词、合同商品明细，
  都不使用候选查询。
- 现有具体 candidates endpoint 仅是 adapter 背后的过渡实现。`GAP-STORE-CREATE-CASCADE`、邀请机构候选、
  `GAP-INVITATION-ROLE-CANDIDATE-QUERY`、合同租户 readback、平台概览候选和 extension definition read 仍须分别由正确 owner 补齐；统一协议不能凭空补事实。

业务上，用户应在所有相似选择里获得一致的搜索、级联清理与失败恢复；同时“什么可选”继续由正确 owner
和当前上下文决定。这避免每个 Drawer 重造查询行为，也不把安全边界合并成万能候选表。

## 4. S2/N4 全量同根扫描与反例边界（2026-07-29）

本轮以 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/**` 下所有
`@PostMapping`、`@PatchMapping`、`@PutMapping`、`@DeleteMapping` 为同根有限搜索面；再以 P6 当前 IA 的
screen/action roster 筛选。扫描不是以某一个 Claude 点名 controller 为分母：C/S/K/P 的 **56 个业务 action 行**
与 edge endpoint 是显式多对多对照，不宣称一一映射。现有对照为 C=24 行→28 endpoint（仅 C01 展开为五条）、
S=11 行→10 endpoint（仅 S04/S05 共用一条）、K=20 行→20 endpoint、P=1 行→1 endpoint，合计 59 条。
下面是其余 19 条 endpoint 的明确处置。

| exclusion id | 已重开 source / variant | 处置与边界 |
| --- | --- | --- |
| X01–X03 | `PlatformWorkspaceInvitationController#create/cancel/reissue` | `RETIRED_BY_R5_CURRENT_P6_SCOPE`：当前 P6 将平台 invitation management 退役，邀请管理仅保留 IA01 的五个 operations target 页面。source edge 仍存在不等于可在 P6 线框中偷偷恢复；若将来恢复平台 invitation surface，必须新建 screen、字段矩阵和 K 分母行，不能复用 operations 的 target 语义。 |
| X04–X08 | `PublicInvitationController#accept/sendOtp/verifyOtp/credentials/complete` | `NOT_APPLICABLE_WITH_REASON`：它是未认证的受邀人 enrollment completion，不是管理者对既有实体的 create/edit/status/credential action；应由 IA01 public invitation 四步 security-flow ledger 约束，不能计入 C/S/K 来凑“管理表单”数。 |
| X09–X11 | `PublicWorkspacePasswordResetController#sendOtp/verifyOtp/complete` | `NOT_APPLICABLE_WITH_REASON`：当前源码以 `resetGenerationKey` 为公开恢复 completion 的 locator；send/verify/complete 是未认证 security-flow，不是管理者 entity mutation，也不进入 C/S/K。Dexter 已裁定两后台均需“账号 + 手机号 + 验证码”自助重置，因此新自助**发起**协议必须在 recovery 详设另列 public security-flow / owner-contract GAP；不得把旧 token completion path 误记为管理员凭据重置或以它假称新入口已存在。 |
| X12–X14 | `OperationsCatalogAuthenticationController#passwordLogin/sendOtp/verifyOtp` | `OUT_OF_P6_MANAGEMENT_ACTION_DENOMINATOR`：运营登录与 OTP 是未认证 authentication security-flow；IA01 已画登录任务，但它不修改既有管理实体、凭据、任职或邀请事实，不能计入 C/S/K/P。 |
| X15 | `OperationsCatalogAuthenticationController#selectContext` | `OUT_OF_P6_MANAGEMENT_ACTION_DENOMINATOR`：IA02 已画首次任职/顶部切换的已认证工作上下文提交；它以 session、Idempotency-Key 与 context version 重验，但只选择本次任职，不修改业务实体、凭据、任职或邀请事实，故不并入 K。 |
| X16 | `OperationsCatalogAuthenticationController#selectDataNode` | `OUT_OF_P6_MANAGEMENT_ACTION_DENOMINATOR`：IA02 已画“可查看范围”的已认证工作上下文提交；它只选择本次可查看范围并由 owner 重验，不是 C/S/K/P 的业务 mutation。 |
| X17 | `OperationsCatalogAuthenticationController#logout` | `OUT_OF_P6_MANAGEMENT_ACTION_DENOMINATOR`：Shell 用户菜单的会话结束 security-flow，不是管理表单/确认动作。 |
| X18–X19 | `PlatformAuthenticationController#login/logout` | `OUT_OF_P6_MANAGEMENT_ACTION_DENOMINATOR`：运维管理后台登录/退出 security-flow；IA01/IA02 已各自声明其 surface，但不属于 P6 管理 action denominator。 |

`X01..X19` 已被枚举而非忽略。它们不改变 `P6_FORM_AND_ACTION_DENOMINATOR=56`；`59 + 19 = 78` 可复算，
且 K04、X09–X11 与总数 56 均按 Dexter 裁决 retain。每次 P6 scope 或
public security protocol 变更都必须重开本表的 source scan 与对应分母，禁止把“retired / public”作为永久
豁免。
