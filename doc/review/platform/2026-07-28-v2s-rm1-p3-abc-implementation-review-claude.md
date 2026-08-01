---
title: RM1 P3-A+B+C implementation closure 独立评审（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P3-A + P3-B + P3-C
verdict: NO-GO
findings: M=3 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅只读 implementation review 与 verdict；不授权修改源码、DEV、seed、reset、migration、Roadmap 状态变更、启动 P1 或重开第三轮独立子 agent 审查
createdAt: 2026-07-28
revision: 2（按 Dexter 指出的方案合理性问题重写；见 §6）
---

# RM1 P3-A+B+C implementation closure 独立评审

## 0. 结论

**NO-GO**，`M=3 / S=1 / N=3`。

按要求未采信已完成两轮独立审查的结论（round-2 为 GO），直接重开生产源码、契约与证据判断。

| # | finding | 类别 |
| --- | --- | --- |
| **M1** | 八个 operation 把**五个各自独立的用户管理能力**塌成一个通用能力；目标类型从"你是谁"（session assignment）推出，而非"你在管什么"（capability） | **模型错误（根因）** |
| **M2** | generated-output replay 的 baseline→final 链在最后一跳断开；`GENERATED_WRITE_CHANNEL_BYPASS` 已复发 | 证据链 |
| **M3** | 三个 exit 一律 `business: NOT_APPLICABLE`；被阻断的 library suite 尝试零记录；静态检查与动态测试结果混淆 | 证据表述 |
| S1 | exit 对本次闭环的核心授权语义零记录 | 证据完整性 |

**M1 是本次 NO-GO 的实质原因。** M2/M3/S1 均为机械缺口。

授权语义中**已亲验正确、不得在整改中回退**的部分见 §2——
`isScopeAllowed` 的祖先包含与叶子精确身份、peer-branch 排除、
scopeRef 的契约收敛、codegen 三侧一致，都是对的，M1 的修复不应触碰它们。

**会话出处**：fresh v2s-rooted 只读会话，非续接、非它仓。仓库零写入（本文件除外）。

**授权边界**：仅 RM1 P3-A+B+C 只读 implementation review 与 verdict。
不授权修改源码、DEV、seed、reset、migration、Roadmap 状态变更、启动 P1，
或重开第三轮独立子 agent 审查。

---

## 1. M（必须修复）

### M1 ｜五个用户管理能力被塌成一个通用能力

**owning source**
- `contracts/openapi/paths/operations-admin/workspace-access.paths.yaml`（8 个 operation 的 `x-required-capability` 与 `x-page-key`）
- `libraries/backend/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceMembershipService.java:32`、`:43`
- 对照：`contracts/catalog/admin-catalog.json` 的 `operationsPages`、`userManagementActionBindings`
- 对照：`libraries/backend/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java:135`

#### 1.1 契约与 catalog 早已把五页分开（仓内事实）

`admin-catalog.json.operationsPages` 为位置元组，末位是 `userManagementTargetOrganizationType`：

| pageDesignKey | requiredDataNodeType | supportedRoleNodeTypes | target |
| --- | --- | --- | --- |
| `PG-IAM-GROUP-USERS` | `NONE` | `[GROUP]` | **GROUP** |
| `PG-IAM-REGION-USERS` | `REGION` | `[GROUP, REGION]` | **REGION** |
| `PG-IAM-PROJECT-USERS` | `PROJECT` | `[GROUP, REGION, PROJECT]` | **PROJECT** |
| `PG-IAM-HEAD-COMPANY-USERS` | `NONE` | `[GROUP, HEAD_COMPANY]` | **HEAD_COMPANY** |
| `PG-IAM-STORE-USERS` | `STORE` | `[GROUP, REGION, PROJECT, STORE]` | **STORE** |

`admin-catalog.json.userManagementActionBindings` 为 10 条 = 5 target × 2 action：

```
PG-IAM-GROUP-USERS         GROUP         INVITE       BC-IAM-GROUP-INVITE
PG-IAM-GROUP-USERS         GROUP         ROLE_REVOKE  BC-IAM-GROUP-ROLE-REVOKE
PG-IAM-REGION-USERS        REGION        INVITE       BC-IAM-REGION-INVITE
PG-IAM-REGION-USERS        REGION        ROLE_REVOKE  BC-IAM-REGION-ROLE-REVOKE
PG-IAM-PROJECT-USERS       PROJECT       …            BC-IAM-PROJECT-…
PG-IAM-HEAD-COMPANY-USERS  HEAD_COMPANY  …            BC-IAM-HEAD-COMPANY-…
PG-IAM-STORE-USERS         STORE         …            BC-IAM-STORE-…
```

`WorkspaceAuthorizationCatalog:135` 的
`requiredUserManagementCapabilityForTarget(targetOrganizationType, action)` 已实现该映射。

**v2 同形**（外部对照）：`catering-all-v2/contracts/catalog/admin-catalog.yaml:301-342`
逐页声明 `userManagementTargetOrganizationType`、`supportedRoleNodeTypes`、
`requiredDataNodeType`、`cascade` / `dataNodeCascaderLabel` / `cascadeLevelLabels`；
动作为 `BC-IAM-REGION-ROLE-REVOKE`（"撤销大区用户运营角色"）等按节点类型分的能力。

#### 1.2 P3 交付的实现（仓内事实）

- 8 个 operation 的 `x-page-key` **全部**为单一值 `OPERATIONS-FIVE-USER-PAGES`；
- `x-required-capability` 只有 **4 个通用值**——
  `REQ_CREATE_OPERATIONS_WORKSPACE_INVITATION`、`REQ_CANCEL_OPERATIONS_WORKSPACE_INVITATION`、
  `REQ_REISSUE_OPERATIONS_WORKSPACE_INVITATION`、
  `REQ_REVOKE_OPERATIONS_WORKSPACE_MEMBERSHIP_ASSIGNMENT`——
  **无任何 GROUP/REGION/PROJECT/HEAD_COMPANY/STORE 维度**；
- 目标类型因此无处可取，实现退回到 session：
  `WorkspaceMembershipService.java:32`（`resolveCurrentTaskScope`）与 `:43`（`resolveTaskScope`）
  均以 `assignment.serviceNodeType()` 作为目标类型。

#### 1.3 后果一：语义错人群（更严重，且不报错）

按 catalog，`PG-IAM-PROJECT-USERS` 的 `supportedRoleNodeTypes` 含 `REGION`
——**大区管理员本就应当能打开「项目用户管理」**，看到在**项目节点**上任职的人。

当前实现算出的 scope 是 **REGION**，返回的是在**大区节点**上任职的人。
**服务端不区分这五个页面，它们塌成了一个。**
撤销动作同理：本应校验 `BC-IAM-PROJECT-ROLE-REVOKE`，
实际校验的是与节点类型无关的 `REQ_REVOKE_OPERATIONS_WORKSPACE_MEMBERSHIP_ASSIGNMENT`。

**这类失败不会报错**——页面正常渲染、返回一份人员列表，只是那是错的人群。

#### 1.4 后果二：类型不匹配时返回 404（可见症状）

`scopeRef` 携带的节点类型与 session assignment 类型不同时直接抛错。完整链条：

1. **数据范围候选本就包含下级节点。**
   `OrganizationVisibilityService.listVisibleDataNodeCandidates:78-100` 扫全部
   `organization_node` 与全部 `store`，逐个过 `isVisibleDataNodeAllowed:71+`：
   `GROUP` assignment → 任意 enabled 节点或门店；
   `REGION` assignment → 递归 `ancestry` 检查，**本区下 PROJECT/STORE 允许**；
   `PROJECT`/`HEAD_COMPANY`/`STORE` assignment → 仅自身。
   候选记录的 `dataNodeType` 是**节点自身的类型**。
2. **会话持久化它。** `WorkspaceAuthenticationService.selectDataNode:108-112`
   校验候选命中后 `UPDATE workspace_iam.workspace_session SET visible_data_node_id=?` 并 bump `context_version`。
3. **前端逐请求回传。** `apps/frontend/operations-admin/src/app/OperationsApp.tsx:47`；
   `WorkspaceMembershipPage.tsx:49/85`、`WorkspaceInvitationPanel.tsx:56/65/108/137`。
4. **服务端用 assignment 的类型解释它。** `WorkspaceMembershipService.java:43`。
5. **抛错并映射为 404。** `OrganizationTaskPathService.requireTaskPath:27-34`
   （`GROUP` 分支要求 `groupId.equals(targetId)`；`REGION` 分支要求该 id 确为 REGION）
   抛 `TaskPathNotFoundException`，经
   `apps/backend/…/edge/problem/ContractProblemAdvice.java:44` 映射为
   **HTTP 404 `PLATFORM_COMMON_RESOURCE_NOT_FOUND`**。

受影响：**集团管理员与大区管理员**切换数据范围到下级节点后，用户列表与邀请列表 404。
项目/总公司/门店管理员不受影响（候选仅自身，类型必然匹配）。

**安全性说明**：本症状 fail-closed，不放松授权、不泄漏数据。
但 §1.3 的错人群**没有** fail-closed 保护。

#### 1.5 正确形状

**目标类型必须来自 capability**——既不来自 `pageDesignKey`（R-17 禁止后端判页面），
也不来自 session assignment（当前的错处）。
能力是 operation 的固有属性（R-19），capability → `targetOrganizationType`
的映射已存在于 `userManagementActionBindings` 的 10 条绑定中。

1. 8 个 operation 的 `x-required-capability` 改为**按 target 分**，取自那 10 条既有绑定；
2. **读操作同样需要 target 维度**——五个列表是五个不同的读，不是"一个读 + 一个参数"；
3. 服务端由 capability 得 `targetOrganizationType`，由 `scopeRef` 得该类型下的具体节点；
4. 授权判定仍为 `isScopeAllowed(assignment.type, assignment.id, requestedNode)` 的祖先包含
   ——**这部分不改**，已亲验正确（§2.2）。

**明确排除的错误修法**：按 `scopeRef` 的 id 反查目标自身类型（`requireTaskPathById` 之类）。
那会让目标类型由用户挑中的节点决定，端点仍是通用的，仍分不清"管项目用户"与"管大区用户"，
只是把 404 换成 §1.3 的静默错人群。**不得采纳。**

#### 1.6 必配测试（当前为零）

非空 `scopeRef` 的解析路径**全仓无覆盖**：
`WorkspaceMembershipTaskScopeTest` 覆盖 `scopeRef = null`；
`OperationsWorkspaceMembershipServerScopeTest` / `OperationsWorkspaceInvitationServerScopeTest`
使用 `when(fixture.membership.pageForOperations(...))` **mock**，不触达真实解析。

1. **大区管理员打开「项目用户管理」** → target=PROJECT，返回在项目节点任职的人，**不是大区的人**；
2. 集团管理员打开「门店用户管理」 → target=STORE；
3. 大区管理员对 peer 区的项目 → 拒绝；
4. 跨集团 id → 拒绝；
5. 门店任职传非自身 id → 拒绝；
6. 撤销动作校验 `BC-IAM-<target>-ROLE-REVOKE`，非通用 capability。

**红变异**：把目标类型改回 `assignment.serviceNodeType()`，第 1、2、6 条必须红。

**影响面**：契约（8 个 operation 的 capability 与暴露形状）、codegen 产出、controller、
owner command 的能力校验、前端五个页面的调用。**这是 P3-A/B/C 的核心交付面。**

**是否需要 Dexter 产品裁决**：**否**。五页语义、target 映射与能力清单在 v2 与 v2s 的 catalog
中均已冻结，属实现未遵循既有契约，不是新的产品决策。

---

### M2 ｜generated-output replay 的 baseline→final 链在最后一跳断开

**owning source**
- `doc/evidence/platform/rm1/p3-c/rm1-u04-generated-output-replay.json`（`outputs[]`、`generatorBaseline`）
- `.runtime/compliance-control/hook-events/rm1-u04-generated-authoritative-replay-013.post.json`
- `doc/evidence/platform/rm1/p3-c/rm1-u04-package-exit.json`（`incrementalChecks`）

**复现实证（本会话独立复算全部 SHA-256）**：

| 产物 | replay.finalSha256 | exit.afterSha256 / 当前字节 | 判定 |
| --- | --- | --- | --- |
| `…/wire/WorkspaceMembershipRevokeRequest.java` | `f0716ecd6fb101` | `51496cddd20902` | **不符** |
| `…/wire/WorkspaceOperationsInvitationActionRequest.java` | `2366215e66104c` | `723e4ec4f4fdb9` | **不符** |
| `…/wire/WorkspaceOperationsInvitationCreateRequest.java` | `b2505072c6a42c` | `b2505072c6a42c` | 一致 |
| `…/generated/operations-edge.ts` | `1df75cfb5efb64` | `c09b37ff604bf4` | **不符** |

```
generatorBaseline 声明 : 97a0e770092d1a99…   (scripts/generate/edge-codegen.mjs)
当前实际               : 3f369faa5700b590…   ← 漂移
```

replay 证据与其 post receipt **互相自洽**，四个 receipt 文件也都存在——
**问题不在 replay 本身，而在 replay 之后**：generator 变更并重新生成，
**从 replay 的 final 到交付 final 之间没有任何 receipt 边**。

`rm1-u04-generated-output-receipt-discovery.json` 自己把该缺陷类命名为
`GENERATED_WRITE_CHANNEL_BYPASS`，定义即「generator 在 package baseline 之后改动了生成产物，
**而没有从 baseline hash 到 final hash 的 pre/post receipt 边**」——**该缺陷已复发一次**。

**反例边界**：`…CreateRequest.java` 一条一致，证明本会话哈希口径正确，非系统性误算。
另：`node scripts/generate/edge-codegen.mjs --check` 当前 **PASS（FILES=218，REAL_EXIT=0）**
——交付字节与契约**是**一致的。**这不能替代 receipt 链**：
codegen 一致性证明"输出匹配输入"，receipt 链证明"每次变更都走受管通道"。

**最小修复**：
1. 为这 3 个产物补 `baseline = replay.finalSha256 → final = 当前字节` 的 pre/post receipt 边，
   并把 `generatorBaseline` 更新为当前哈希；
2. replay 证据显式记录**两段链**，不得以覆盖 `finalSha256` 抹平中间态；
3. **加机械控制**：`replay.outputs[].finalSha256` 必须与同包 exit 的
   `incrementalChecks[].afterSha256` 逐条相等，不等即具名红。
   红变异 = 改动任一生成产物而不更新 replay，控制必须红。缺这条，每次 generator 变更都会复发。

**是否需要 Dexter 产品裁决**：**否**。

---

### M3 ｜`business: NOT_APPLICABLE` + 被阻断的 suite 零记录 + 静态/动态混淆

**owning source**
- `doc/evidence/platform/rm1/p3-a/rm1-u02-package-exit.json`
- `doc/evidence/platform/rm1/p3-b/rm1-u03-package-exit.json`
- `doc/evidence/platform/rm1/p3-c/rm1-u04-package-exit.json`（均为顶层 `business`）
- `doc/evidence/platform/rm1/p3-c/rm1-u04-implementation-amendment.json`

**复现实证**：

```
p3-a/rm1-u02 : status=PASS  business="NOT_APPLICABLE"  cleanup="PASS"  incrementalChecks=52
p3-b/rm1-u03 : status=PASS  business="NOT_APPLICABLE"  cleanup="PASS"  incrementalChecks=44
p3-c/rm1-u04 : status=PASS  business="NOT_APPLICABLE"  cleanup="PASS"  incrementalChecks=38
```

在 P3-C 的 exit 与 amendment 中检索
`blocked` / `not_run` / `fixture` / `library suite` / `historical` / `attempt`：**命中 0**。

**问题**：
- `business: NOT_APPLICABLE` 的正当用法是 **P0**（控制先行、不改业务代码）。
  P3-A/B/C 改变的正是生产授权行为，宣称"业务不适用"与包自身范围矛盾。
- 来件明确要求「被历史 fixture 阻断的 library suite 尝试不能写成 business PASS」。
  **当前确实没写 PASS**，但写 `NOT_APPLICABLE` 使这次尝试**连同阻断原因一起消失**，
  读者无从得知"曾尝试、被阻断、缺口仍在"。
- **静态/动态混淆**：P3-C 的 `incrementalChecks` 含 **7 条**指向测试文件、带 `result: PASS` 的行。
  按 P0 已确立的约定，`incrementalChecks` 是**变更文件的静态合规检查**，
  `result: PASS` 意为静态检查通过，**不是"该测试已执行"**。
  无独立动态字段时，7 条 "test … PASS" 极易被读作 suite 已绿。

**最小修复**：
1. `business` 改为如实状态（如 `BLOCKED_ON_HISTORICAL_FIXTURE`），
   记录受管尝试的 run id、被阻断的 fixture、发生在哪个 suite、缺口承接方；
2. 新增独立字段 `dynamicEvidence`，与 `incrementalChecks` 分离；
3. compliance-control 增一条：**业务面非空的包不得声明 `business: NOT_APPLICABLE`**
   ——"业务面非空"可由 `actualChangedPaths` 是否触及
   `libraries/backend/**/src/main` 或 `contracts/openapi/**` 机械判定。
   红变异 = 给触及 owner 源码的包写 `NOT_APPLICABLE`，必须红。

**是否需要 Dexter 产品裁决**：**否**。
但**承接方选择**（RM2 补跑 vs P8 transfer manifest 登记）建议 Dexter 一句确认。

---

## 2. 亲验通过、不得在整改中回退的部分

### 2.1 客户端不能选择目标类型

`WorkspaceMembershipService.java:38-48` 的 javadoc 与实现均确保：客户端只提供 id，
类型由服务端派生。**M1 的修复必须保持这一性质**——
把类型来源从 session assignment 换成 capability，**而不是**换成客户端输入或 id 反查。

### 2.2 `isScopeAllowed` 的判定逻辑正确

`OrganizationTaskPathService.java:39-47`：

```java
if (... || target.ancestorIds().isEmpty() || !target.ancestorIds().contains(target.targetId())) return false;
return switch (assignmentType) {
  case "GROUP", "REGION", "PROJECT" -> target.ancestorIds().contains(assignmentId);
  case "HEAD_COMPANY", "STORE"      -> assignmentType.equals(target.targetType()) && assignmentId.equals(target.targetId());
  default -> false;
};
```

祖先包含 + 叶子精确身份 + `ancestorIds` 自包含不变量。
peer-branch：REGION `r1` 请求 peer `r2` 时 `r2.ancestorIds=[groupId,r2]` 不含 `r1` → 拒绝，
`WorkspaceMembershipTaskScopeTest:34` 以真实 fixture 覆盖。**M1 的修复不应触碰本方法。**

### 2.3 scopeRef 在契约上的收敛成立

`scopeRef` 仅出现在 3 个真实选择端点
（`getOperationsWorkspaceInvitations`、`getOperationsWorkspaceInvitationCandidates`、
`getOperationsWorkspaceMembership`）；detail / revoke / create / cancel / reissue **均无**。
controller 侧一致：`OperationsWorkspaceMembershipController:35` 收，`:36`/`:37` 不收。

### 2.4 codegen 三侧一致

`node scripts/generate/edge-codegen.mjs --check` → `R5_EDGE_CODEGEN_CHECK=PASS`，
`FILES=218`，`REAL_EXIT=0`。OpenAPI → generated wire / TS client 无漂移。

### 2.5 pageKey 授权推导已消除

`apps/backend/…/edge/operations/` 与 `workspace-access.paths.yaml` 中 `pageDesignKey` 命中 4 处，
**全部**位于 `edge/operations/session/WorkspaceSessionWireMapper.java:24/27/30/33`
——session 下发给前端的菜单/导航 payload，**无一进入授权判定链**，符合 R-17。
P3-C 的 5 个 `PG-IAM-*` 端点侧为 0。

> **注意**：M1 的修复**不得**以恢复 pageKey 判定的方式实现。
> 目标类型来自 **capability**（operation 的固有属性）；`x-page-key` 仍只供前端使用。

---

## 3. S（应修复）

### S1 ｜exit 对本次闭环的核心授权语义零记录

**owning source**：`doc/evidence/platform/rm1/p3-c/rm1-u04-package-exit.json`

在该 exit 全文中检索 `peer` / `ancestor` / `GROUP` / `REGION` / `PROJECT` / `narrow` / `scopeRef`
——**命中全为 0**。本次被要求核验的属性，exit 无法作为其证据来源。

**最小修复**：增 `authorizationSemanticsEvidence[]`，逐条绑定
断言 → 测试类 → 断言方法，并给出红变异描述。M1 修复后须包含
"大区管理员开项目用户管理返回项目人群"这一条。

---

## 4. N（观察项）

**N1** `OperationsWorkspaceMembershipController` 仍用 `Membership` 命名——
`Membership → User`（R-23）归 **P2**，不在 P3 范围。登记以免 P8 误判为 P3 遗漏。

**N2** `WorkspaceMembershipService.pageForOperations:65-78` 为内存分页 + 逐账号解析
（全量取出 → 逐个判定 → `subList`），属 P-E6/P-E7 家族。整改归 **P4**，
**不得由本次 P3 结论关闭**；建议在 P4 的 canonical ledger 中登记该 call-path 已被 P3 触碰。

**N3** 本评审未采信 round-2 的 GO（按来件要求）。就所见事实，round-2 的 GO 与 M1/M2 不相容
——建议作者复核 round-2 是否 (a) 打开过 `admin-catalog.json` 的五页 target 定义，
(b) 做过 `replay.finalSha256` 与交付字节的逐条比对。

---

## 5. 处置与再评审条件

| finding | 性质 | 处置 |
| --- | --- | --- |
| M1 | 契约与能力模型错误（根因） | Codex 自主修复；不需要 Dexter 裁决 |
| M2 | 证据链缺口（机械） | Codex 自主修复 |
| M3 | 证据表述 + 门规则（机械） | Codex 自主修复；承接方选择建议 Dexter 一句确认 |
| S1 | 证据完整性（机械） | Codex 自主修复 |
| N1–N3 | 观察 | 不阻塞 |

**再评审条件**：M1（8 个 operation 按 target 分能力 + 服务端由 capability 取 target
+ 六条测试与红变异）、M2（两段 receipt 链 + replay↔exit 逐条相等的机械控制并验红）、
M3（`business` 如实 + `dynamicEvidence` + 业务面非空控制）、S1 闭合后可复评。

**本评审不授权**：修改源码、DEV、seed、reset、migration、Roadmap 状态变更、
启动 P1、重开第三轮独立子 agent 审查。

---

## 6. 作者失误披露

本评审 revision 1 曾把 M1 的症状（404）判为 `S` 并挂 `DEXTER_DECISION`，
且提出 `requireTaskPathById`（按 id 反查目标类型）的修法。
经 Dexter 指出后重查 v2 与 v2s catalog，确认：

- 该修法**错误**——它让目标类型由用户挑中的节点决定，端点仍是通用的，
  只是把 404 换成静默的错人群；
- 该 finding **不需要产品裁决**——五页语义与 target 映射在两个仓的 catalog 中均已冻结。

两条纪律违反：

1. **方案合理性优先于闭环正确**——revision 1 只核了 `isScopeAllowed` 是否 fail-closed，
   未先问"这个模型对不对"；
2. **不得从现有接口反推用户任务**——revision 1 以 `resolveTaskScope` 的方法签名
   反推 `scopeRef` 的语义，而非从五个页面的业务任务出发。
   正确的第一步是打开 `admin-catalog.json` 看这五页各自是什么。

revision 2 以根因重写；revision 1 的编号与修法建议全部作废。
