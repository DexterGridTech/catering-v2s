---
title: RM1 P6 整包交互详设独立复审（Claude）
reviewTarget: DESIGN
scope: RM1-P6 全范围静态交互详设（IA-01…IA-05、统一 UI 详设标准、搜索/候选规则、表单台账）
verdict: NO-GO
findings: M=1 / S=4 / N=4
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅评审 P6 静态交互详设；不授权 implementation、契约/owner 改动、codegen、DEV、动态运行、seed/reset、Roadmap 状态变更或任何仓库控制操作
createdAt: 2026-07-29
---

# RM1 P6 整包交互详设独立复审

## 0. 结论

**NO-GO**，`M=1 / S=4 / N=4`。

**先说这项工作到底解决了什么、有没有解决。** P6 要解决的真问题是：R5 只有粗线框，
实施者无法知道每个 screen 的后台归属、面形态、用户任务、候选来源和 owner 边界，
于是会从"现有接口/旧页面/组件习惯"倒推 UI。**这个问题在 IA-01…IA-04 的主干上是真解决了的，
而且不是凑 GO**——本会话逐条重开 owner 源码后，作者登记的每一个 `GAP-*` 都命中真实缺口：

| 作者登记的 GAP | 本会话独立复核（重开源码） | 判定 |
| --- | --- | --- |
| `GAP-INVITATION-ROLE-CANDIDATE-QUERY` | `OperationsWorkspaceInvitationCandidateController:26-30` 只有 `scopeRef`+`expectedContextVersion`；contract `workspace-access.paths.yaml:194-204` 同样无 `query/page`；`WorkspaceUserService:99-102` 一次性返回全部 ENABLED role | **CONFIRMED** |
| 邀请"任职机构"候选缺口（IA01 :393-397） | `WorkspaceUserService:102` `List.of(new CandidateOrganization(scope...))` —— 字面只返回**一个**机构 | **CONFIRMED** |
| `GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY` | `PlatformWorkspaceRoleController#update` 透传 `body.status()`；`WorkspaceRoleService:66` 的 generic update SQL 直写 `status=?`，且审计成 `ROLE_PERMISSIONS_REPLACED`，**确实可绕过 S03** | **CONFIRMED** |
| `GAP-PLATFORM-ORG-OVERVIEW-FILTER-SEMANTICS` | OpenAPI 声明 `type/name/code/status/source/projectId/brandId/tenantId`；`PlatformOrganizationOverviewController:19` 只接 `category/page/pageSize` | **CONFIRMED** |
| `GAP-PLATFORM-CONTRACT-OVERVIEW-FILTER-SEMANTICS` | OpenAPI 声明 6 个筛选参数；`PlatformContractOverviewController:22` 只接 `page/pageSize` | **CONFIRMED** |
| `GAP-STORE-LIST-FILTER-SEMANTICS` / `GAP-STORE-CREATE-CASCADE` | `OperationsStoreManagementController:49` 只接 `expectedContextVersion/page/pageSize`；`:59` candidates 只接 `expectedContextVersion/brandId` | **CONFIRMED** |
| `GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION` | `OperationsContractController:48` 的 `checkedSession` 只把 `workspaceUuid` 装进 `record WorkspaceSession(UUID workspaceUuid)`；assignment / visibleDataNode **被丢弃**，故 contract 侧确实无法以当前任职/数据范围作最终授权 | **CONFIRMED** |
| `GAP-WORKSPACE-USER-LIST-FILTER-SEMANTICS` | 五个 user list OpenAPI 声明 `userName/mobile/roleQuery/status`；`WorkspaceUserService#pageForOperations:106-113` 签名里根本没有这四个参数 | **CONFIRMED** |

**这是本轮最有价值的产出**：这些不是文档层面的自洽，是把"OpenAPI 声明 ≠ owner 已实现"
这一类假绿逐个挖出来并诚实保留为 GAP，且明确禁止用 client-side filter 假装可用。
`GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION` 尤其是一条实打实的授权边界缺陷。

**但 NO-GO 的原因不在这些主干，而在被这套严格标准漏掉的那一角。**
P6 自己在 `§4.1` 立了强制 UI 详设标准，IA-01/IA-02 逐条执行；到 IA-03/IA-04/IA-05
时，`surface ownership roster`、`FORM_MUTATION_DENOMINATOR`、公开页品牌标准三项被整体略过，
而恰好在这个被略过的区域里，`IA05-RECOVERY-*` 凭空发明了一个 owner 侧根本不存在的自助入口
（M1）。也就是说：**这套标准是有效的——被执行的地方没出事，没被执行的地方立刻出事。**

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。本轮不改写、不重开
form-remediation cycle 的 round-2，也未启动其第三轮。

**授权边界**：仅评审 P6 静态交互详设。即使后续转 GO，也不授权 implementation、契约或
owner 改动、codegen、DEV、动态运行、seed/reset、Roadmap 状态变更或任何仓库控制操作。

---

## 1. M1 ｜`IA05-RECOVERY-*` 发明了一个 owner 侧不存在的自助入口，且未登记 GAP —— `CONFIRMED`

**owning source**

- `doc/decisions/2026-07-29-v2s-rm1-ia-05-...-interaction.md:38`、`:112`
  → `HOST_AND_ENTRY=运营登录页"忘记密码"`，第一步为"手机号 + 验证码"，
  §6 标 `EXACT_COUNTERPART / H-RECOVERY`。
- owner 协议：`contracts/openapi/paths/public/access-recovery.paths.yaml` —— 三个 public
  operation 全部以 `/{resetGenerationKey}` 为路径根，**没有任何**从手机号发起恢复的 operation。
- 唯一签发者：`WorkspacePasswordResetService#request:37-48`
  （`INSERT INTO workspace_iam.password_reset ... generation_key_hash`）。
- 其**唯一**调用点：`PlatformWorkspaceAccountController:41 requestCredentialReset`
  —— 已认证的**运维管理员**动作，即 IA03 的"重置登录凭据"。
- v2 基线（IA-05 自己引用的 `@2c7d8ec…`，本会话复算 hash 一致）：
  `AccessRecoveryPage.tsx:41` `const {resetGenerationKey = ''} = useParams();`；
  `:54` `if (!resetGenerationKey) return <Result title="凭证重置入口不完整"
  subTitle="请从有效的凭证重置入口进入。" />`；`:86` 标题是"设置新密码"。
- R5 `D04-S10`（`journey-decision.md:141`）："重置时本人验证手机号后设新密码"，
  处置为 `CREATE_FROM_V2_CARRY` —— **没有**授权新增登录页自助入口。

**反例（具体到用户一步）**：运营用户在登录页点"忘记密码"→ 前端没有 `resetGenerationKey`
→ 没有任何 public operation 可以用手机号换取它 → 该页只能落到 v2 已有的
"凭证重置入口不完整"。**这条 Journey 在当前 owner 下无法开始**，而 IA-05 把它画成了
可用的第一步，并且没有登记任何 `GAP-*`。

**这不是"接口暂缺"，是把恢复的触发权从管理员搬到了未认证用户**：
当前设计里恢复必须由运维管理员对某个账号发起（`requestCredentialReset` 需要
`expectedVersion` 与平台会话），链接再交付给本人。把入口改成登录页自助，是一个**产品/安全语义变更**，
不是交互细化。

**交叉矛盾**：IA-01 的 `IA01-OPERATIONS-LOGIN`
（`ia-01…md:144-148`）`USER_VISIBLE_COPY` 里**没有**"忘记密码"，
`LOGIN_FORM_PAGE_OFFICIAL_COMPOSITION` 明写 `actions:不使用`。
两份 IA 对同一个登录页的可见操作分母互相矛盾；模板
`§6 可见操作分母`要求每个链接都有一行并回指批准 Journey anchor——"忘记密码"两稿皆无此行。

**适用边界**：本条只针对"入口与触发权"。IA-05 的三步页面本身（验证手机号→设新密码→完成）
与 v2 基线一致，不必重画。

**最小修法（不是更大方案）**：把 `HOST_AND_ENTRY` 改回 v2 事实
"由 owner 交付的凭证重置链接（`/{resetGenerationKey}`）"，补上 v2 已有的
"入口不完整"守卫态；若 Dexter **确实**想要登录页自助恢复，则登记
`GAP-PUBLIC-SELF-SERVICE-RESET-ENTRY` 并标 `DEXTER_DECISION`，
说明它需要新增 public operation + 反枚举/限频语义，在裁决前不得画成既定交互。
两条路都不需要在本轮改任何代码或契约。

`DEXTER_DECISION`：是否要新增"登录页自助找回密码"这一业务能力。

---

## 2. S1 ｜公开恢复三屏未适用 P6 自定的公开页品牌强制标准，也未登记品牌缺口 —— `CONFIRMED`

**owning source**：`2026-07-29-v2s-rm1-p6-interaction-preparation-and-refreeze-design.md:149-152`：

> 运营管理后台所属的 public invitation/**recovery** 也必须逐页声明
> `APPLICATION_AFFILIATION=operations-admin`：……**却必须显示该集团空间的已配置 LOGO、名称和
> 运营管理后台标题**。公开 view 必须消费 owner-approved branding readback；任一缺失都要以
> contract、owner、generated client、共享 header 和四步页面测试闭环。

**当前字节**：`ia-05…md:107-170` 三屏确实写了 `APPLICATION_AFFILIATION`（这一半做到了），
但 `USER_VISIBLE_COPY` 只有固定串"找回运营管理后台密码"，**无 LOGO、无集团空间名称、
无 `<运营管理后台标题>`**，也没有任何 branding GAP。

**反例**：`access-recovery.paths.yaml` 的三个 operation 路径里**没有** `groupWorkspaceKey`，
readback 也不含 workspace 展示字段——即当前 contract 根本无法定位是哪个集团空间，
更谈不上返回其 LOGO。这正是标准要求登记为闭环缺口的情形。同一标准下
IA-01 对公开邀请就做对了（`ia-01…md:204` 明确要求 `PublicInvitationView` 返回
`workspaceName/operationsTitle/logoUrl`，并禁止 client fallback）。

而且"找回**运营管理后台**密码"这个写死串，正是标准在
`:153-154` 点名拒绝的形状（"不得保留固定'加入运营管理后台'文案"）。

**最小修法**：三屏 `USER_VISIBLE_COPY` 改为动态 `<运营管理后台标题>` 形式，
并登记 `GAP-PUBLIC-RESET-BRANDING-READBACK`（owner 需在 reset readback 或路径中提供
workspace 定位与已批准品牌展示值）。与 M1 是同一 screen family，可一并处置。

---

## 3. S2 ｜表单 mutation 分母不完整：整类"凭据恢复/任职撤销/邀请取消重发"缺席，且空间账号启停不在状态集 —— `CONFIRMED`

**owning source**：`doc/evidence/platform/rm1/p6/rm1-u09-form-command-variant-ledger.md:12`
自称"**以下是唯一 command 分母**"，并给出
`CORE_CREATE_EDIT_SET=C01..C12,C14..C25`（24）、`STATUS_VOID_SET=S01..S10`（10）、
`ADJACENT_SECURITY_SET=P01..P02`（2）。
模板 `ui-interaction-design-template.md:176-177` 明写分母类别为
"创建、编辑、**凭据**、状态/作废或集合替换"。

**本会话独立枚举**（`app/edge` 下全部 `@Post/@Patch/@Put/@Delete Mapping`）后的对账：

- 三个集合的算术自洽（12+12=24、10、2），C13 缺号已在 `:43-45` 说明，**这部分无误**。
- 但下列**已在 IA 中画出确认面**的真实 edge command，**三个集合都没有它的行**：

| 已画的 screen | 真实 edge command | 归属哪个集合？ |
| --- | --- | --- |
| `IA03-ACCOUNT-ACTION`「确认启用/停用"<姓名>"？」 | `PlatformWorkspaceAccountController#status` | **应属 S 集，缺席** |
| `IA03-ACCOUNT-ACTION`「重置登录凭据」 | `PlatformWorkspaceAccountController#requestCredentialReset` | 无 |
| `IA03-ACCOUNT-ACTION`「确认撤销…任职？」 | `PlatformWorkspaceAccountController#revoke` | 无 |
| `IA03-ADMIN-CREDENTIAL`「重置登录凭据」 | `PlatformAdminGovernanceController#resetCredential` | 无 |
| `IA05-USER-REVOKE`「确认撤销…任职？」 | `OperationsWorkspaceUserController#{group,region,project,headCompany,store}Revoke`（5 条） | 无 |
| `IA01-USER-INVITATION-ACTION-MODAL`「取消邀请/重新发送」 | `OperationsWorkspaceInvitationController#*Cancel` / `*Reissue`（10 条） | 无 |

**为什么这是 significant 而不是 note**：`IA03-ACCOUNT-ACTION` 的账号启停与 `S01…S10` 的九条
是同一类状态迁移，却因为分母不全而没有任何 hidden-fact 行（对象、目标状态、expectedVersion、
idempotency proof）。而这正是模板 `:190-192` 专门要求的
——"纯确认 Modal 也必须列出对象、动作、版本等 hidden facts"。凭据恢复这一类更敏感，
`resetCredential` 会作废旧凭据并签发一次性入口（见 M1 中的 `request:41` `SUPERSEDED`），
在整包详设里**一行都没有**。

**并列缺口**：IA-05 全文没有 `FORM_MUTATION_DENOMINATOR`，也没有任何字段事实矩阵，
但它承载 `IA05-RECOVERY-PASSWORD`（凭据）、`IA05-PASSWORD-DRAWER`（P02）、
`IA05-USER-REVOKE`（撤销确认）三个 mutation-bearing screen。IA-02/03/04 都有 `§14/§10` 矩阵，
IA-05 独缺。

**最小修法**：ledger 增设第四组 `CREDENTIAL_AND_ASSIGNMENT_SET`（凭据恢复 ×3、任职撤销 ×6、
邀请取消/重发 ×10），把 `PlatformWorkspaceAccountController#status` 补入 S 集；IA-05 补一个
`FORM_MUTATION_DENOMINATOR` 矩阵。不需要新增任何产品功能。

---

## 4. S3 ｜三份 IA 完全没有 surface ownership roster，且 IA-02 的两个 Shell 线框确有跨面元素 —— `CONFIRMED`

**owning source**：模板 `:81-86`「交付前逐屏填写并复核下表……不得交 Dexter 看图」；
P6 设计 `:162-166`「最终 P6 详设附逐屏 ownership roster，**任一跨面元素或无位置文案为 NO-GO**」。

**当前字节**：`grep -c "ownership roster\|Surface ownership"` →
IA-01 = 1，IA-02 = 1，**IA-03 = 0，IA-04 = 0，IA-05 = 0**。
IA-03（25 screen）、IA-04（25 screen）、IA-05（18 screen）合计 **68 个 screen 无 ownership 对账**。

**IA-02 的 roster 也不闭合**：`ia-02…md:518` 自称"本稿 13 个可实施 screen"并列 13 行，
但 `§12`（Dexter 2026-07-29 指令后追加）新增了
`IA02-PLATFORM-AUTHENTICATED-SHELL` 与 `IA02-OPERATIONS-AUTHENTICATED-SHELL`，
**两者都不在 roster 里**。

**而 roster 的缺失恰好掩盖了真实跨面**：

- `ia-02…md:639-645`（platform shell 线框）画进了 `[用户 v]`、页签栏 `[刷新][全屏]`，
  以及 `───── [集团空间：<名称> v]` —— 最后一项是独立 screen
  `IA02-PLATFORM-WORKSPACE-SIDER-CONTROL` 的可见元素。
- `:671-678`（operations shell 线框）画进了 `[运营角色 v]`（= `IA02-OPERATIONS-SHELL-HEADER`）
  与 `可查看范围：<当前机构> v`（= `IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER`），
  两者都是本稿另有 screen id、另有线框的独立面。
- 而 `:688` 自己声明"本节只定义宿主 chrome，**不把这些 sibling screen 混画或合并**"
  —— 声明与线框互相矛盾。

**适用边界**：我不认为 shell screen 完全不能出现 sibling 的**占位**；模板的规则是
"只能作为上下文存在的 sibling……不得画进该 screen"。若 Dexter 认为宿主 chrome 需要画出
插槽位置，正确做法是在 roster 里把这些元素显式标为"sibling 占位、owner=<该 screen id>"，
而不是没有 roster。

**最小修法**：IA-03/04/05 各补 roster（可用现有紧凑表格式）；IA-02 roster 补两行并对
两个 shell 线框的 sibling 元素显式标注 owner screen。

---

## 5. S4 ｜同一控件在同一份 IA 内有三套用户可见文案，且违反本稿自定的词表 —— `CONFIRMED`

**owning source**：`ia-02…md:51`（本稿自定规则）：
"技术接口中的角色归属字段在用户界面统一为'任职机构'，**可视数据节点统一为'可查看范围'或'可查看机构'**"。
模板 `:74`：线框每项元素"与其 `USER_VISIBLE_COPY` 一一可追溯"；
`§1.3` 要求搜索表的"条件的用户可见文案"就是该 screen 的实际文案。

**当前字节的三处不一致**：

| 控件 | `§4` screen 声明 | `§13` 搜索表 | `§12` shell 声明 |
| --- | --- | --- | --- |
| 任职切换器 | `:121` "**当前任职**" | `:702` "**当前角色**" | `:664` 顶部"**运营角色**" |
| 初次任职选择 | `:154` 字段"**可用任职**" | `:701` "**当前角色**" | — |
| 数据范围 | `:184` "**可查看范围**" | `:703` "**数据范围**" | `:664` 侧栏底部"可查看范围" |

`§13:703` 的"数据范围"直接违反本稿 `:51` 自定的词表；"运营角色"与"当前角色"则把
G-05 已裁定的"任职 ≠ 角色"语义重新混起来——而分离这两个概念正是 P-U4 的原始业务问题。

**这不是排版问题**：`§13` 表的第二列按模板就是"条件的用户可见文案"，
final 详设与 L2 会以哪一版为准是不确定的。

**最小修法**：`§13`、`§12` 统一改为 `§4` 的 `USER_VISIBLE_COPY` 原文
（"当前任职"/"可用任职"/"可查看范围"）。纯文本对齐，不改任何交互。

---

## 6. N（观察项，不阻塞）

**N1 ｜章节号重复，且 P6 设计以这些号作锚点引用**

IA-01 有两个 `## 9.`（`:500` 搜索复核、`:524` 高保真 demo）；
IA-04 有两个 `## 9.`（`:393` 门店 sheets、`:645` 搜索详设）和两个 `## 10.`。
IA-02 的节序是 10 → 12 → 13 → 11 → 14。
P6 设计 `:69-73` 用"IA01 §9""IA04 §9"作为搜索分母的指向，当前指代不唯一。
另外 IA-01 `§8` 的三行 Manifest 条文（B.4 async/error、B.5 任务顺序、B.5 双后台边界）
被误并进了 `§9` 的搜索表（`:511-513`），列语义不匹配；`§8` 实际只剩一行。

**N2 ｜三处强制小节是空标题**

`IA-03 §5 接受前检查`、`IA-04 §5 接受条件`、`IA-05 §5 接受条件` 均只有标题、无内容。
交 Dexter 看图时这三节正是"要确认什么"的入口。

**N3 ｜`IA01-USER-INVITATION-ACTIONS` 线框仍有行尾动作按钮**

`ia-01…md:345-346` 画的是
`邀请手机号 | 任职机构 | 业务角色 | 状态 | 有效期` 行后跟 `[查看详情]`。
模板 `:279-280`「实体列表默认遵循'名称/业务标识链接→详情 Drawer'」，
IA-02 `:267` 对集团空间列表已经正确执行（"表格**没有**'操作'列、行尾按钮"）。
邀请没有名称，正确形状应是"邀请手机号"作为业务标识链接。
`:353` 的散文（"Tab 只负责定位邀请和打开详情"）与线框不一致。

**N4 ｜ledger 缺两条处置记录**

`PlatformWorkspaceInvitationController`（R-5 已裁定平台面退役）与
`PlatformAssetController#stage`（IA02 `§14` 创建/编辑 Logo 的真实前置 mutation，
且已带 `GAP-WORKSPACE-LOGO-STAGING-DISPOSITION`）在"唯一 command 分母"中都无行。
前者应记 `RETIRED_BY_R-5`，后者应记为表单前置 mutation 或明确 `NOT_APPLICABLE_WITH_REASON`。

---

## 7. 本会话已亲验为"好"的部分（不得在整改中回退）

- **候选统一协议不是万能查询表**：ledger `:94` 明写"统一的是 consumer wire shape……
  **绝不统一 owner 数据、授权或关系判断**"，并在 `:97-98` 逐条保留各 owner 的 GAP。
  这条边界正确，不要在整改时为"统一"而合并 owner。
- **邀请创建的 owner 再核验确实存在**：`WorkspaceInvitationService:132`
  `user.resolveTaskScope(session, expectedTargetType, requestedScopeRef)`；
  `:115` 逐个 role 校验 `serviceNodeType`。IA-01 的"提交时 owner 再核验"不是空话。
- **五个 target 不合并**：IA-01 `:350-351`、IA-05 `§4.1`、`OperationsWorkspaceInvitationController`
  的 15 个 target-specific 端点三者一致，未退化成"用户管理 + 机构参数"。
- **IA-02 已按 Dexter 2026-07-29 裁决收敛**：`IA02-PLATFORM-WORKSPACE-SIDER-CONTROL`
  是唯一可实施 shape；Header 在 `:74`/`:326-332` 仅作已拒绝来源留档，不是 screen、不是线框、
  不是 foundation 分母。`:649` 另加了"不得移回 Header/列表操作列/总览"的约束。**这一项做对了。**
  （唯一残留：`§5:543` 仍写"物理位置待 Dexter 裁决"，属陈旧句，随 S4 一并清理即可。）
- **未把 import-equality 假称已执行**：P6 设计 `:179-187` 与模板 `:56-58` 都明确
  "当前 IA 还没有 final path，故本阶段只冻结此机械控制契约，**不能伪称 import check 已通过**"。
  本会话确认 `scripts/check/frontend-architecture` 当前不含任何 `FOUNDATION_PRIMITIVE` 对账逻辑，
  且没有任何工件声称它已跑过。**这一点没有假绿。**
- **总览只读 / 管理页写入**：IA-02 `:296` 明确总览"不提供创建、编辑、启用、停用、返回管理页
  或更换当前集团空间的入口"；IA-03 对 ORG/CONTRACT 两个概览同样只读。

---

## 8. 处置

`M=1 / S=4 / N=4` → **NO-GO**。

- **M1 需要 Dexter 一句裁决**（是否要"登录页自助找回密码"这一业务能力）；
  裁决前不得把它画成既定交互。
- **S1–S4 与 N1–N4 全部在既有批准边界内，可直接交 Codex 自主修复**，
  都是补分母、补 roster、对齐文案、改回 v2 已有事实，**不新增产品范围、不改代码或契约**。
- 本轮**不**开 form-remediation 的第三轮，也未改写其 round-2。

**本复核不授权**：implementation、契约或 owner 改动、codegen、DEV、动态运行、
seed/reset、Roadmap 状态变更、任何仓库控制操作。
