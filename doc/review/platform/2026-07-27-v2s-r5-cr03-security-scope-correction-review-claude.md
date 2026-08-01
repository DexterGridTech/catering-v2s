---
title: R5-CR03 安全 scope 冲突与最小 correction 边界 Claude review
reviewCycleId: R5-COMPLIANCE-REMEDIATION-20260727
reviewTarget: DESIGN
scope: CR03 correction necessity and change-surface boundary
verdict: NO-GO
counts: {M: 1, S: 2, N: 2}
reviewSessionProvenance: FRESH_V2S_ROOTED_THIS_SESSION
---

# R5-CR03 安全 scope 冲突与最小 correction 边界：Claude review

## 0. 结论

**NO-GO（M=1 / S=2 / N=2）**。

**必要性成立**——CR03 冻结 changeSurface 确实无法覆盖自身要求，这是已接受 manifest 的真实内部
不一致，不是实施偷懒。核验点 1、3、4 我均已在源码与已执行 migration 上亲验确认。

**但提议的边界不能照批**：四项新增 surface 中，**两项应改为 defer 而非扩面**，一项的理由不成立。
其中 migration 一项与已接受 manifest 的 U03 `dataEvolution` **直接冲突**——manifest 自己已经把
schema 演进明确路由到 U04。

另需说明：仓内**不存在 CR03 correction design 文件**，当前只有 reconciliation evidence
（`doc/evidence/platform/2026-07-27-v2s-r5-cr03-security-scope-reconciliation.json`）。
本结论评的是该 evidence 提出的 correction shape。

## 1. 五个核验点的独立结论

### 核验点 1｜last-admin 只能由 platform-iam owner 修复 —— **确认**

- 守卫在 `libraries/backend/platform-iam/.../PlatformAuthenticationService.java:272,274`
  （`AdministratorDeactivationForbiddenException`，`:274` 即 `activeCount <= 1` 判定）
- `libraries/backend/workspace-iam/` 中引用 `platform_admin` 的文件数 = **0**
- 在 workspace-iam 内建平台管理员事实会违反 kernel `MODULE_OWNER_SOVEREIGNTY`

**而 manifest 把它写错了**：U03 changeSurface #1 是
`libraries/backend/workspace-iam/ | update | rate limits, **last-admin lock** and durable receipts`
——把 last-admin 指派给了一个没有该事实的 owner。这是 manifest 自身缺陷，见 N-1。

⇒ `libraries/backend/platform-iam/` **必须新增**，无替代路径。

### 核验点 2｜invitation maskedMobile 是否必须覆盖 platform-admin feature —— **不成立（理由错误）**

事实：
- `PlatformWorkspaceInvitationController.java:24` 返回 `List<WorkspaceInvitationReadback>`
  （owner 内部类型，含 `mobileNormalized`）
- generated wire `WorkspaceInvitation` 用的是 `maskedMobile`
- 前端 `InvitationsPage.tsx:9,42` 声明并展示 `mobileNormalized`

**edge 在 U03 冻结 surface 内**。把 edge 改为映射到 generated wire 后，`mobileNormalized`
**不再下发**——安全断言 `raw mobile readback` 就此闭合。前端剩下的是一个**取不到值的空列**，
属显示缺陷，不是安全洞。

evidence 的措辞「the actual displayed raw field is in a forbidden frontend path」**不准确**：
修完 edge 之后前端已无 raw field 可显示。⇒ 前端 surface 不是 CR03 安全闭环的必要条件。
它的真正问题见 S-1。

### 核验点 3｜audit 必须有 page/action/assignment-data-scope predicate —— **确认，且这是最强的一条**

- `OrganizationOverviewTaskReadService.detail(UUID workspaceUuid, String key, String category, UUID itemId)`
  ——**只有 workspace 维度**，无 assignment / data-node / page capability 参数
- 全仓唯一带 assignment-scope 的读是
  `StoreCandidateTaskReadService.candidates(workspaceUuid, key, **assignmentId, visibleNodeId**, brandId)`

⇒ 仅仅「先调用宿主 detail read」**会原样保留 workspace-only 授权**，精确命中 U03 forbidden 项
`workspace-only audit authorization`。evidence 判断正确：**必须先规定 host-authorization
policy/API，代码才可能诚实拒绝一个"同工作空间内无权"的审计请求。**

**但这里有一个 evidence 没说的陷阱，见 S-2。**

### 核验点 4｜extension canonical receipt identity 与 asset bindGrant replay —— **确认**

- `V20260726_090000_000:153` 建 `extension.extension_command_receipt(idempotency_key PK,
  **definition_id UUID**, request_hash, response_json, created_at_epoch_millis)`
- `V20260726_160000_000:55-68` 已执行：`DROP COLUMN id`，PK 改为 `(group_workspace_key, entity_type)`
- ⇒ receipt 的 `definition_id` 指向一个**已不存在的身份**。任何正确实现都需要新增式 canonical
  identity 列 ⇒ **需要新 migration**
- `V20260726_090000_000:151` 的 `platform_asset.asset_command_receipt.response_json JSONB NOT NULL`，
  而 `contracts/openapi/components/platform-asset/asset.schemas.yaml:9,21` 中 **`bindGrant` 是 stage
  response 的 required 属性**。原样存 `response_json` 即**持久化一次性凭据**，replay 会二次披露。
  必须显式定义规则

**而 U03 changeSurfaces 不含任何 `db/migration` 路径**（实测四项：workspace-iam、app/edge、
extension、platform-asset）。所以 evidence 的结论「frozen package 内无法引入所需 additive shape」
**成立**。

### 核验点 5｜是否应允许四项最小新增 surface —— **两项批，两项应改为 defer**

| 提议 surface | 我的结论 |
| --- | --- |
| `libraries/backend/platform-iam/` | **批准**。核验点 1，无替代路径 |
| `apps/frontend/platform-admin/src/features/` | **有条件批准**，但理由须改（见 S-1）：不是安全必要，而是修完 edge 后必须同步字段名，否则留下空列。范围限定为字段名对齐，不得夹带任何其他 UI 变更 |
| `libraries/backend/platform-workspace/` | **不批，改为 defer 到 CR04**（见 M-1） |
| 新增 migration | **不批，改为 defer 到 CR04**（见 M-1） |

## 2. M-1｜提议边界与已接受 manifest 的 `dataEvolution` 直接冲突，且与 D-4 重叠

**（a）migration：manifest 自己已经把 schema 路由到 U04**

U03 的 `dataEvolution` 原文：

> `"notApplicableReason": "Any necessary schema is added later under U04 additive migration policy."`

这不是遗漏，是**已接受的显式处置**。给 CR03 加 migration surface 等于**推翻一条已接受的
manifest 条款**，且是静默推翻。

真正的内部不一致是：manifest 把「extension / platform-asset durable receipt」写进了 U03 的
changeSurface 与 approved assertion，却把它必需的 schema 路由到了 U04——**同一件事被劈成两包**。

两条自洽出路，我推荐第一条：

1. **把 extension / platform-asset 的 durable receipt 工作整体 defer 到 CR04**（migration 本就在那里），
   CR03 只闭合它在无 schema 变更前提下能闭合的部分（rate limit、edge 脱敏映射、audit 授权、
   workspace-iam receipt——`workspace_iam.workspace_command_receipt` 现有形状可用）。
   不改任何已接受字节，包边界自然收敛。
2. 走正式 manifest 修订，明确改写 U03 `dataEvolution` 并说明为何 U04 policy 提前适用。
   **这必须是显式修订 + 独立复核，不能以 correction evidence 代替。**

**（b）platform-workspace：与 D-4 裁决重叠，现在动就是白做**

`PlatformWorkspaceService.java:73` 在 organization command 返回后**无条件** INSERT
`platform_workspace.audit_event`（`COMMERCIAL_GROUP_INITIALIZED`，changes_json 还是手工拼串）。
replay 会二次写入——问题属实。

但 **D-4 已裁决为 A：organization 拥有该审计事实，platform-workspace 只可任务型读取**。
CR04 会把这个 writer 整体搬走。CR03 在此处打 replay 补丁，是 CR04 必然推翻的工作。

⇒ 应 defer 到 CR04，与 D-4 的 owner 迁移一次做完。若 Dexter 认为"双写审计"风险不可留到下一包，
可在 CR03 只做**最小抑制**（replay 分支不写），并在 receipt 中显式登记
`SUPERSEDED_BY_CR04_D4_OWNER_MOVE`——但这是取舍，不是默认。

**影响面**：若照 evidence 原样扩面，CR03 会同时（i）静默推翻一条已接受 manifest 条款、
（ii）产生一块 CR04 必然重做的实现。两者都与本轮 Roadmap"包级串行、前包 exit 真绿才进下一包"
的成本逻辑相悖。

**是否需 Dexter 裁决**：**是**——(a) 的两条出路之间、以及 (b) 是否接受"双写审计留到 CR04"，
属范围与风险取舍。

## 3. S-1｜前端 surface 的理由不成立，且它更像 CR02 逃逸

`doc/evidence/platform/2026-07-27-v2s-r5-cr02-package-exit.json` 存在，即 **CR02 已收口**。
而 CR02 的职责正是「两 app 从 face-specific generated endpoint 消费契约、消除
业务 `any/Record<string,unknown>`」。`InvitationsPage.tsx:9` 至今仍手写
`mobileNormalized?: string` 并直接 `dataIndex` 展示——**这说明该 feature 未被 CR02 typed 化，
或 edge 未返回 generated wire 导致 typed 化无从落地**。

把它记成"CR03 需要扩面"会**掩盖一次 CR02 逃逸**。正确处置：

- 在 CR03 correction 中把该项标注为 `CR02_ESCAPE`，说明为何 CR02 exit 仍绿（这本身是
  CR02 disposition 分母的漏洞，应回写 CR02 receipt 或在 CR03 input 中显式登记）；
- 前端改动范围严格限定为**字段名对齐**（`mobileNormalized` → generated wire 的 `maskedMobile`），
  不得夹带列、交互或样式变更——那些属 CR05/CR06。

**是否需 Dexter 裁决**：否。

## 4. S-2｜audit 谓词若照抄现有唯一路径，会实现一块 CR04 必须拆掉的跨 owner 直读

全仓唯一已实现的 assignment-scope 解析是
`StoreCandidateTaskReadService.java:17`：organization 用**裸 SQL 直读
`workspace_iam.role_assignment`**。而这条正是诊断件 M-18 / CR04 范围内要消除的未声明跨 owner 直读
（"未声明跨 owner schema 直读为零，代码事实与 dependency registry 双向对账"）。

CR03 若以它为范本实现 audit 的 assignment/data-scope predicate，等于在 CR03 新增一条 CR04
必须拆除的违规——而且它会被 CR04 的 registry 对账门抓红。

**最小修复**：correction design 必须明确规定该 predicate **经 workspace-iam 的公开 task API 解析**
（新增最小公开查询，属 workspace-iam，已在 U03 冻结 surface 内），
**禁止在 organization / edge 内直读 `workspace_iam.role_assignment`**。
建议把这一条直接写成 CR03 的 forbidden 项，并配一条红夹具。

**是否需 Dexter 裁决**：否。

## 5. N 级（2 条）

**N-1｜manifest 自身的 owner 错配应一并订正**
U03 changeSurface #1 把 `last-admin lock` 写在 `libraries/backend/workspace-iam/`。
无论采用哪条出路，修订时应把该 target 措辞改为正确 owner，否则 correction 关闭后
manifest 仍留着一条与事实矛盾的记录。

**N-2｜bindGrant 的 replay 处置需二选一并与旧 forbidden 项对齐**
`bindGrant` 是契约 required 属性，且旧 R5-U05 forbidden 项已含 `grant display/persistence`。
correction design 必须明确是（i）receipt 不存该字段、replay 时按 typed 规则省略或重新签发，
还是（ii）存储但在 replay 输出中脱敏。**不得以"存 response_json 原样"默认通过。**

## 6. 方案合理性

- **必要性**：成立且证据充分。这次不是实施方越界，而是**已接受 manifest 内部把一件事劈成两包**
  （receipt 要求在 U03、其 schema 在 U04）并**把 last-admin 指派给了错误 owner**。
  这类缺陷正是 package-exit 逐项 disposition 应当在 CR03 入口就暴露的——它确实暴露了，机制有效。
- **最小性**：evidence 提出的四项里有两项超出"最小"。真正最小的形态是
  **新增 1 项（platform-iam）+ 收窄 1 项（前端仅字段名）+ defer 2 项（platform-workspace、migration）**。
- **禁止伪闭环**：请求列出的三种伪闭环（workspace-only 查询、header 校验、旧 receipt 字段）
  我在本轮均未发现被采用，且 S-2 正是为防止第一种在实现期悄悄发生。

## 7. 授权边界

本轮仅审 CR03 correction 的必要性与边界。**NO-GO 表示：在 M-1 的范围二选一由 Dexter 裁定、
S-1/S-2 写入 correction design 之前，不得改动被排除的生产路径。**
不授权 DEV、seed、reset、远端运行，不授权进入 CR04–CR08。

`UNVERIFIED`：CR02 exit receipt 的 disposition 分母为何未覆盖
`InvitationsPage.tsx` 的手写字段（S-1 的成因），本轮未展开核验。
