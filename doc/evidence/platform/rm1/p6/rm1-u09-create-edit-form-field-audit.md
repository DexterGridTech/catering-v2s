---
title: RM1 P6 全部新建编辑表单独立全量审计
status: NO_GO
reviewTarget: DESIGN
implementationAuthority: false
---

# P6 新建/编辑表单全量审计

## 1. 范围、方法与结论

**结论：NO-GO，M=7 / S=5 / N=4。** 本文是只读审计，不授权 contract、owner、前端或 runtime 改动。

审计按 `R5` 原始 Journey、IA、OpenAPI request、edge controller、owner command service 的顺序进行；
不把 UI 文案、生成 client 或 OpenAPI 参数单独当作字段边界事实。核心实体新建/编辑分母为 **24**：
IA01 邀请 1、IA02 集团空间 3、IA03 平台治理 5、IA04 运营组织/合同 15。`C` 的核心新建/编辑分母仍为
**24**；本次 S2/N4 同根复算另核对 **11** 个 status/void、**20** 个 authenticated credential/assignment/
invitation action 与 **1** 个 Logo staging precondition。它们不混入“新建/编辑=24”的算术，却必须在全 P6
action ledger 中有且仅有一行；公开 invitation/password-reset security flow 与已退役 platform invitation
controller 另有显式处置，不能默默漏掉。

| 表单族 | variants | 固定只读或隐藏 owner 事实 | 用户可编辑 / 条件可编辑 | 结论 |
| --- | ---: | --- | --- | --- |
| IA01 运营邀请创建 | 1 | endpoint 固定的 target 类型、空间、context version、idempotency | 手机号；任职机构与角色为条件可选 | 既有候选仅单机构 `GAP` 已诚实保留 |
| IA02 集团空间创建 / 初始化 / 编辑 | 3 | 创建后状态、版本；编辑 key；初始化目标空间 | 基础显示资料；Logo 仅 KEEP/REMOVE/REPLACE 条件编辑 | 资产 staging/source 仍为 S |
| IA03 管理员、角色、扩展字段 | 5 | 管理员初始状态；编辑登录名；角色类型/当前状态；版本 | 各表单资料、授权、受规则限制字段 | 扩展字段 key/type 两项 M；角色状态、管理员细化为 S |
| IA04 组织、经营实体、品牌授权、门店、合同 | 15 | 归属/类型/状态/版本/不可变业务标识与合同项目等 | 对应资料、关系、分期、商品明细、受控扩展字段 | M1–M5、S1–S2 |
| 状态/作废确认 | 11 | 目标对象、目标状态、版本、提交 proof | 无业务资料字段 | 含 platform workspace account status；必须作为 `HIDDEN_OWNER_FACT`，不可当自由状态表单 |
| 已认证 credential / assignment / invitation action | 20 | 目标对象、版本、context、固定 target、submission proof | 只有 source 明示的 credential secret；其余为确认动作 | 平台/运营本人改密、两类 credential reset、平台/运营 assignment revoke、五 target invitation cancel/reissue 均独立保留 |
| Logo staging 前置 | 1 | `usage`、file、header idempotency proof | 文件选择 | 只消费 asset owner 返回的 ref/grant；不是集团空间 create/edit 的重复计数 |
| Public security flow | 8 | public token/grant/OTP 步骤 | security-flow 独立字段 | `NOT_APPLICABLE_WITH_REASON`：非管理者 entity mutation；公开恢复新自助发起协议另由 recovery 详设关闭 |

## 2. 每类固定与可编辑边界

### 2.1 IA01 运营邀请创建

业务来源为 R5 `D04-S05O`、G-07。固定的是页面 target 类型、集团空间、context version 与幂等键；
手机号可编辑，任职机构和角色只能来自同一 target 的 owner candidate readback。`scopeRef` 是条件可编辑
的 owner task input，不是用户可自由键入的范围。当前候选服务只返回一个解析出的机构，故 IA01 的多机构
搜索选择仍是 `GAP`；不得伪称已实现。

### 2.2 IA02 集团空间

- 创建：编码仅创建时可写；名称、运营管理后台标题、备注、Logo 是可编辑输入；状态 `ENABLED`、版本、
  `logoAssetRef`、`logoBindGrant`、幂等键均为隐藏 owner 事实。
- 商业集团初始化：目标空间固定，只有未初始化前提成立时可编辑集团编码/名称。
- 编辑：集团空间编码固定只读；名称、标题、备注可编辑；Logo 仅在 `KEEP/REMOVE/REPLACE` 模式下条件编辑，
  `REPLACE` 必须由 asset owner 返回 ref 与 bind grant。

### 2.3 IA03 平台治理

- 管理员创建：登录名、姓名、密码必填且可编辑；手机号可选；初始启用状态为隐藏 owner 事实。
- 管理员编辑：登录名固定只读；姓名、手机号可编辑；版本/幂等键隐藏。
- 角色创建/编辑：创建时任职机构类型决定两棵授权树；编辑时类型固定。当前状态必须作为 latest detail 的
  隐藏回传事实，不能因独立状态 Modal 而从 update request 消失。
- 扩展字段：新增行必须有可实施的稳定 key 来源；已有行的字段类型固定，只允许新增行选择类型及其选项级联。

### 2.4 IA04 运营组织与合同

- 大区：集团归属、类型和初始状态固定；名称、编码、备注可编辑。
- 项目：所属大区、类型和初始状态固定；名称、编码、备注及项目分期动态列表可编辑。编辑 request 的
  `parentId/phases/version` 必须完整回传；所属大区不可变。
- 品牌：编码、名称、别名、备注、受控扩展字段是其专有编辑集合。
- 经营租户、总公司：除编码/名称/备注/扩展字段外，法定名称、统一社会信用代码是必需业务字段；不得复用
  品牌三字段表单。
- 门店编辑：项目、品牌、经营租户、**编码**、版本固定；仅名称、总公司、备注、受控扩展字段可编辑。
- 合同创建/编辑：项目、门店、经营租户、合同编号、状态和版本等固定事实依阶段区分；商品必须是至少一项的
  `code + name` 动态明细数组，不能以单一“货号”代替。项目分期可空，不可由 IA 擅自强制。

## 3. 已确认 finding

| id | severity | 结论 |
| --- | --- | --- |
| M1 | M | 品牌、经营租户、总公司错误共用表单；后两者缺法定名称和统一社会信用代码。 |
| M2 | M | 合同 `items[]` 被错误缩成单一货号输入。 |
| M3 | M | 项目编辑漏掉强制回传且会全量替换的分期列表。 |
| M4 | M | 组织、门店、合同表单缺少受控扩展字段、规则版本与失败恢复。 |
| M5 | M | 合同候选、查询、创建与编辑没有当前任职/数据范围的 owner 再授权，却被 IA 声称已再验。 |
| M6 | M | 新增扩展字段没有 `key` 的合法来源。 |
| M7 | M | 已有扩展字段类型被误画为可改，owner 实际拒绝。 |
| S1 | S | 总公司经营品牌“多选草稿整体保存”与现有单条 add/remove command 不一致。 |
| S2 | S | 多数 IA04 表单缺逐控件依赖表，无法完整审阅固定/可编辑/条件边界。 |
| S3 | S | 角色编辑漏 status 隐藏回传事实。 |
| S4 | S | Logo asset staging、ref/grant 与 intent 映射未精确到实际 operation。 |
| S5 | S | 管理员创建/编辑未逐字段写明创建专属与隐藏 owner 事实。 |

## 4. 证据锚点与下一步

关键 source：IA01 `#IA01-USER-INVITATION-CREATE-DRAWER`；IA02
`#IA02-PLATFORM-WORKSPACE-CREATE-DRAWER` / `#IA02-PLATFORM-WORKSPACE-EDIT-DRAWER`；IA03
`#IA03-ADMIN-CREATE`、`#IA03-ROLE-EDIT`、`#IA03-EXTENSION-EDIT`；IA04
`#IA04-PROJECT-CREATE`、`#IA04-BUSINESS-CREATE`、`#IA04-STORE-EDIT`、`#IA04-CONTRACT-CREATE`、
`#IA04-CONTRACT-EDIT`。命令真相以对应 OpenAPI schema、edge controller 和 owner service 为准。

下一步不是实施：先以本审计分母重画/重写 IA 表单详设，逐字段声明
`FIXED_READONLY / EDITABLE / CONDITIONAL_EDITABLE / HIDDEN_OWNER_FACT / GAP`，再做新的设计审查。

## 5. S2/N4 action 分母补审（2026-07-29）

Claude whole-scope review 将“唯一 command 分母”当作问题族入口后，本审计重新枚举了 edge 同根所有
`Post/Patch/Put/Delete` mapping，并从 P6 的 IA action surface 找反例，而不是只在原 24 个 Drawer 里补行。
精确 source-to-set 对账在 `rm1-u09-form-command-variant-ledger.md`：

| 发现的命令族 | 真实 edge source | 设计处置 |
| --- | --- | --- |
| 空间账号启停、凭据重置、任职撤销 | `PlatformWorkspaceAccountController#status/requestCredentialReset/revoke` | `S11`、`K04`、`K05`；分别保留 account/assignment、expectedVersion、proof，不能合并成“账号操作” |
| 运维管理员凭据重置 | `PlatformAdminGovernanceController#resetCredential` | `K03`；request 的 `password` 已在 IA03 明确为“新登录密码/确认新登录密码” Drawer 字段；秘密只在提交时传递，失败/关闭/成功均清空，不把 current contract 伪画成链接发放 |
| 五类运营用户撤销 | `OperationsWorkspaceUserController#{group,region,project,headCompany,store}Revoke` | `K06..K10`；目标类型是 endpoint 固有事实，不能由 session/current assignment 推导 |
| 五类邀请取消、重发 | `OperationsWorkspaceInvitationController#{group,region,project,headCompany,store}{Cancel,Reissue}` | `K11..K20`；每条有固定 target、invitation、context/version 与 header/body 同一 idempotency key |
| Logo 暂存 | `PlatformAssetController#stage` | `P01`；是 C02/C04 的前置，不是可被隐藏的上传实现；owner staging disposition GAP 保持 |
| 平台 invitation controller | `PlatformWorkspaceInvitationController#create/cancel/reissue` | `X01..X03 RETIRED_BY_R5_CURRENT_P6_SCOPE`；保留反例记录，不因 source 存在恢复 platform invitation UI |
| public invitation / password reset | `PublicInvitationController#*`、`PublicWorkspacePasswordResetController#*` | `X04..X11 NOT_APPLICABLE_WITH_REASON`；未认证 security-flow 不是管理员 entity mutation。Dexter 已裁定的双后台自助 recovery 是另一个 public protocol 设计任务，现有 token-bound completion 不能冒充它 |

因此当前严格有限分母是 `C=24 / S=11 / K=20 / P=1 / X=11 explicit exclusions`。任何新增或恢复
screen、public protocol 或 edge mutation 都必须先重新跑该同根枚举，再允许修改计数；不允许只给 Claude
点名的一条 controller 加一行。
