---
title: RM1 P3-A+B+C 整改后实现复核（Claude，第二轮）
reviewTarget: IMPLEMENTATION
scope: RM1-P3-A + P3-B + P3-C（RM1-U12）
verdict: NO-GO
findings: M=2 / S=2 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅实施复核；不进入下一 P、不改 Roadmap、不做 seed/reset
createdAt: 2026-07-28
---

# RM1 P3-A+B+C 整改后实现复核

## 0. 结论

**NO-GO**，`M=2 / S=2 / N=3`。

**上一轮的三条 M 全部真实关闭**（§2）：模型缺陷已修（target 由 endpoint 固定）、
六条测试到位、terminal replay 三者精确相等、动态证据 business/cleanup 均为 PASS 且可追。

两条新 M **都不是用户可见的功能缺陷**——授权行为经复核是正确的。
它们是**单一真相与受管通道**的缺口，会在下一步接线时变成功能缺陷。

| # | finding | 是否影响当前用户 |
| --- | --- | --- |
| **M1** | 生成物 `capability-operation-registry.json` 在最后一条 receipt 之后再次变更且无 receipt 边，U12 零登记 —— `GENERATED_WRITE_CHANNEL_BYPASS` 复发 | 否 |
| **M2** | 两套"能力真相"并存且**已漂移**：HEAD_COMPANY 的 8 处键 `BC-IAM-HEAD_COMPANY-*` 不在权威能力集合内 | 否（运行时用的是权威那套） |
| S1 | `WorkspaceCapabilityScopeResolver` 全仓零生产调用方；P3-A 设计声明的 resolver 未接入请求路径，exit 未披露 | 否 |
| S2 | historical receipt recovery 的分类谓词未定义，两侧口径不自洽 | 否 |

> **本轮撤回一条初判**：草稿曾判"16 个读 operation 绑定写能力 → 只读用户打不开列表"为 M。
> **实测证伪**：读路径根本不校验 capability（§3.1），该判断错误，已撤回并降为 N1。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。不采信历史 verdict 与作者结论。

**授权边界**：仅实施复核。不进入下一 P、不改 Roadmap、不做 seed/reset。

---

## 1. M（必须修复）

### M1 ｜`capability-operation-registry.json` 的 receipt 链在最后一跳断开且 U12 零登记

**owning source**
- `apps/backend/catering-business-server/src/main/resources/generated/capability-operation-registry.json`
- `scripts/generate/edge-codegen.mjs:69`（声明该文件为 codegen 产物）
- `doc/evidence/platform/rm1/p3-c/rm1-u12-package-exit.json`（`incrementalChecks`，54 条）
- `doc/evidence/platform/rm1/p3-c/rm1-u12-generated-output-terminal-replay.json`（`outputs`，1 条）

**可复现证据**（本会话遍历 `.runtime/compliance-control/hook-events/*.post.json` 并复算当前字节）：

```
该路径的全部 post receipt 边：
  pkg=RM1-U02  before=ABSENT        after=7791e530c51c
  pkg=RM1-U02  before=7791e530c51c  after=20037a51ffd7
  pkg=RM1-U03  before=20037a51ffd7  after=09f8960999e8
当前字节                            = 24feff04db15cdcf
最后一条 receipt 的 after 是否等于当前字节 : False
```

即：该文件在 U03 的 receipt 之后**又被改过一次**（`09f8960999e8 → 24feff04db15cdcf`），
**这一跳没有任何 receipt 边**。

且它在 U12 的证据中**完全没有登记**：

```
U12 exit incrementalChecks（54 条）中命中 : NONE
U12 terminal replay outputs（1 条）        : 仅 operations-edge.ts
遍历 doc/evidence/platform/rm1/p3-c/rm1-u12-*.json 检索该文件名 : 全部 0 命中
（对照：U02 与 U03 的 package-exit 都登记了它）
```

**为何是 M**：上一轮 M2 的缺陷类由作者自己命名为 `GENERATED_WRITE_CHANNEL_BYPASS`，
定义即「generator 在 package baseline 之后改动生成产物，而没有 baseline→final 的 receipt 边」。
`operations-edge.ts` 这一条本轮被正确纳入 terminal replay 并三者相等（§2.3），
**但同一次 codegen 的另一个产物既无 receipt 边、也未进任何证据**——同类缺陷换个产物再次发生。

**并且**：该文件正是承载 M2 那 8 个非权威能力键的生成物之一。它不在变更面内，
意味着若将来的门以 changed-path 为分母，**扫不到它**。

**最小修复**
1. 把该路径纳入 U12 的 `incrementalChecks` 与 terminal replay `outputs`，
   补 `09f8960999e8 → 24feff04db15cdcf` 这一跳的 receipt 边；
2. **加机械控制**：`edge-codegen.mjs` 声明的**全部**产物路径必须逐一出现在同包
   terminal replay 的 `outputs[]` 中，缺一即具名红。
   分母取自 generator 自身的声明，不靠人逐次登记。
   红变异 = 从 replay 删掉任一产物，门必须红。

**是否需要 Dexter 产品裁决**：**否**。

---

### M2 ｜两套"能力真相"并存且已漂移：HEAD_COMPANY 的 8 处键不在权威集合内

**owning source**
- 声明侧：`libraries/backend/workspace-iam/.../api/WorkspaceCapabilityRequirementCatalog.java:32`、`:46`、`:77` 等 8 条；
  `contracts/registry/iam-org-governance-manifest.json`（8 处）；生成物 `capability-operation-registry.json`（8 处）
- 执行侧：`libraries/backend/workspace-iam/.../api/WorkspaceAuthorizationCatalog.java:135`
  （`requiredUserManagementCapabilityForTarget`）
- 权威源：`contracts/catalog/admin-catalog.json` 的 `userManagementActionBindings`

**可复现证据**：

```
权威（admin-catalog.json.userManagementActionBindings）：
  BC-IAM-HEAD-COMPANY-INVITE        （连字符）
  BC-IAM-HEAD-COMPANY-ROLE-REVOKE   （连字符）

P3 声明（WorkspaceCapabilityRequirementCatalog.java:32/46/77 …）：
  "BC-IAM-HEAD_COMPANY-INVITE"       （下划线）
  "BC-IAM-HEAD_COMPANY-ROLE-REVOKE"  （下划线）
```

两种拼写的出现面**完全不相交**（全仓检索，排除 `node_modules`/`build`）：

| 拼写 | 出现文件 |
| --- | --- |
| `BC-IAM-HEAD_COMPANY-*`（下划线） | 仅 3 个文件、各 8 处：`WorkspaceCapabilityRequirementCatalog.java`、`contracts/registry/iam-org-governance-manifest.json`、生成物 `capability-operation-registry.json` |
| `BC-IAM-HEAD-COMPANY-*`（连字符） | `admin-catalog.json`、两个 `workspace-*.schemas.yaml`、`frontend-asset-carryover-manifest.json`、`WorkspaceAuthorizationCatalog.java`、`generatedAdminCatalog.ts`、`operations-edge.ts`、`platform-edge.ts`、seed fixture contract |

**为何今天不影响用户**（本会话逐层追踪执行链，务必与声明侧区分）：

```
revoke → OperationsWorkspaceMembershipController:55
       → WorkspaceAccountService.revokeAssignmentForOperations(..., expectedTargetType, ...)
       → WorkspaceCommandAuthorizationService.requireUserManagementAction(..., target.serviceNodeType(), ..., ROLE_REVOKE)
       → WorkspaceAuthorizationCatalog.requiredUserManagementCapabilityForTarget(targetOrganizationType, action)
         └─ 取自 userManagementActionBindings，**连字符，正确**
```

即：运行时用的是权威那一套，**总公司撤销可以正常工作**。
下划线那一套目前**没有任何生产消费者**（唯一消费 `resolveCapabilityKey` 的
`WorkspaceCapabilityScopeResolver` 未接线，见 S1）。

**为何仍是 M**
1. **声明的契约本身是错的**——`x-required-capability` 是本轮 P3-A/C 的核心交付面，
   其中 8 条指向一个全仓不存在的能力键。核验点 1 问的正是
   「是否真实来自既有 `BC-IAM-<TARGET>-<ACTION>`」：**4 个 target 是，HEAD_COMPANY 不是**。
2. **一旦 resolver 接线（P3-A 的既定意图），总公司 8 个 operation 立即全断。**
3. **无任何门交叉校验两套真相**——`scripts/check/capability-invariants` 本会话实跑 **EXIT=0**，
   未发现该不一致。这是 R-5 单一真相违反，且漂移已经发生、无人察觉。
4. 六条测试**无一覆盖 HEAD_COMPANY**（§2.1），所以测试也抓不到。

**最小修复**
1. 三个文件的 8 处改为连字符；生成物必须**改契约后重新生成**，不得手改；
2. **加机械控制**：`WorkspaceCapabilityRequirementCatalog` 引用的每个 capability key
   必须是 `admin-catalog.json` 权威能力集合的成员，不在集合内即具名红。
   红变异 = 把任一 key 改一个字符，门必须红。**缺这条，同类漂移会再来。**
3. 补 HEAD_COMPANY 目标测试（至少：总公司管理员开总公司用户管理返回总公司人群；
   总公司撤销校验 `BC-IAM-HEAD-COMPANY-ROLE-REVOKE`）。

**是否需要 Dexter 产品裁决**：**否**。权威拼写在 catalog 中已冻结。

---

## 2. 上一轮三条 M 的关闭核验（均已真实关闭）

### 2.1 模型缺陷已修 + 六条测试到位（对应核验点 1 前半、核验点 2）

`WorkspaceMembershipService.java:42-50`：

```java
public TaskPath resolveTaskScope(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef) {
    UUID effectiveScopeRef = requestedScopeRef == null ? session.visibleDataNodeId() : requestedScopeRef;
    if (expectedTargetType == null || effectiveScopeRef == null) throw new SessionInvalidException();
    TaskPath requested = taskPaths.requireTaskPath(ws, key, expectedTargetType, effectiveScopeRef);   // 目标类型来自参数
    if (!taskPaths.isScopeAllowed(ws, key, assignment.serviceNodeType(), assignment.serviceNodeId(), requested))
        throw new SessionInvalidException();                                                          // 锚点仍是 assignment
    return requested;
}
```

javadoc 原文：「An optional client scope selects an instance of the endpoint's already-fixed
target type. It never selects the target type or authority.」——与实现一致。

Controller 侧五条路由各自把类型**写死**（`OperationsWorkspaceMembershipController:35-51`）：
`"GROUP"` / `"REGION"` / `"PROJECT"` / `"HEAD_COMPANY"` / `"STORE"`，由 URL 段决定，
不从 pageKey、session assignment 或 scope id 推导。
`memberWithinTaskScope:130-133` 亦按 `expectedTargetType` 过滤任职。
写侧 `revokeAssignmentForOperations` 还额外校验
`!expectedTargetType.equals(target.serviceNodeType()) → AuthorizationDeniedException`。

`WorkspaceMembershipTaskScopeTest` 六条用例与要求精确对应：

```
regionOperatorOpeningProjectUserManagementReturnsProjectPersonnelAndExcludesPeerBranch
groupOperatorOpeningStoreUserManagementReturnsStorePersonnel
peerRegionProjectScopeIsDenied
crossGroupProjectIdIsDenied
storeAssignmentCannotSelectAnotherStore
projectRevokeRequiresProjectRoleRevokeCapability
```

**缺口**：无 HEAD_COMPANY 用例（见 M2）。

### 2.2 40 个 operation 与按 target 分的 requirement 集合成立

`workspace-access.paths.yaml` 有 **40** 个 `operationId`、**40** 个互不相同的
`x-required-capability`；对 catalog 的 97 个 requirement id 做差集，**yaml 侧无孤儿**。
写侧 16 条分布为 4 target ×（3×INVITE + 1×ROLE-REVOKE），
符合 `create/cancel/reissue → INVITE`、`revoke → ROLE-REVOKE`（HEAD_COMPANY 另 8 条见 M2）。

### 2.3 核验点 3：terminal replay 与 exit、当前字节三者精确相等

```
apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts
  replay.finalSha256 = 437e13a68e407cd2…
  exit.afterSha256   = 437e13a68e407cd2…
  当前字节            = 437e13a68e407cd2…              → OK
generator scripts/generate/edge-codegen.mjs
  declared = e44d71776aca8d69…  current = e44d71776aca8d69…  → 无漂移
```

`exitBinding.rule` 亦写明该等式。**对已登记的产物成立**；缺口是登记面不全（M1）。

### 2.4 核验点 4：动态证据明确 business PASS 与 cleanup PASS

`business = "PASS"`、`cleanup = "PASS"`，另有独立 `dynamicEvidence[]` 三条：

| suite | result | cleanup | 源码 hash | log |
| --- | --- | --- | --- | --- |
| `:libraries:backend:workspace-iam:test` | PASS | PASS | `WorkspaceMembershipService.java` **与当前字节一致** | 存在 |
| `:libraries:backend:contract:test` | PASS | PASS | 一致 | 存在 |
| `:libraries:backend:organization:test` | PASS | PASS | `operations-edge.ts` 一致 | 存在 |

三条 `.runtime/r5/evidence/remote-testcontainers/…/gradle.log` **均实际存在**。
上一轮的 `NOT_APPLICABLE` 与静态/动态混淆已消除。

### 2.5 recovery 的字节绑定扎实

51 条 entry 的 `currentSha256` 与当前字节 **0 不符**、**0 文件缺失**（逐条复算）。
`nonClaims` 三条措辞克制，未把历史恢复伪装成正常 receipt。缺陷只在分类谓词（S2）。

---

## 3. S（应修复）

### 3.1 前置说明：读路径的实测行为（用于界定 S1 与 N1）

本会话逐层打开 `OperationsWorkspaceMembershipController:53-54`：

```java
private WorkspaceMembershipPage page(request, key, expectedTargetType, scopeRef, page, pageSize, version) {
    var session = session(request, key, version);                       // 会话 + contextVersion
    return page(membership.pageForOperations(session, expectedTargetType, scopeRef, page, pageSize));
}
```

**读路径不调用任何 capability 校验**——只有会话有效性、`contextVersion` 一致、
以及 owner 侧的 scope 收敛。这**符合** R-22 第一层（读只判范围、不判 capability）。

### S1 ｜`WorkspaceCapabilityScopeResolver` 零生产调用方，且 exit 未披露该状态

**owning source**：`libraries/backend/workspace-iam/.../application/WorkspaceCapabilityScopeResolver.java:15-16`

**可复现证据**：全仓（含测试）检索 `WorkspaceCapabilityScopeResolver` 仅 **2 个文件**——
它自身与 `WorkspaceCapabilityScopeResolverTest`。它标了 `@Service`，
被 Spring 实例化，**但没有任何请求路径调用它**。
`resolveCapabilityKey` 的生产引用也只到两个 generated facade
（`CapabilityRequirementCatalog.java:12`、`CapabilityResolverRegistry.java:15`），
二者同样无 edge 层调用方。

**与设计的差距**：计划 §3 RM1-P3-A 要求
「resolver 输入为 authenticated workspace session、server-resolved resource type/id、assignment node；
**输出为 `ALLOW|DENY` 和第一层 owner query predicate**」。
当前该组件**建成并单测通过，但未接入任何请求路径**；
授权由 owner 侧的 `requireUserManagementAction` 独立实现（这条路径本身是正确的）。

**为何是 S 而非 M**：授权行为不缺失、用户不受影响。
缺的是**交付状态与设计声明的一致性披露**——U12 与 U02 的 exit 中
`resolver` / `A1` / `A2` 命中均为 **0**，读者无从得知该组件尚未接线。

**最小修复**：在 exit 中显式登记该组件的接线状态
（如 `componentWiringStatus: [{component, wired:false, reason, owningPackage}]`），
或按设计接线并补 edge 层测试。**二选一由作者定，但不得沉默。**

### S2 ｜historical receipt recovery 的分类谓词未定义，两侧口径不自洽

**owning source**：`doc/evidence/platform/rm1/p3-c/rm1-u12-dexter-authorized-historical-receipt-recovery.json`

51 条分为 `REPLAYED_RECEIPT_CHAIN_EXISTS`（31）与
`DEXTER_AUTHORIZED_HISTORICAL_RECOVERY`（20，`hookReceiptClaim: "NOT_RECORDED_BY_CLIENT"`）。
**工件未定义两者的判定谓词。** 本会话以最自然口径复算
（存在 post 边满足 `before == baselineSha256` 且 `after == currentSha256`）：

| 分类 | 精确 baseline→current 边 | 仅 after 命中 | 完全无边 |
| --- | --- | --- | --- |
| `DEXTER_AUTHORIZED_HISTORICAL_RECOVERY`（20，声称未记录） | **5** | 11 | 4 |
| `REPLAYED_RECEIPT_CHAIN_EXISTS`（31，声称有链） | **17** | 14 | 0 |

**两侧都不自洽**：recovery 侧 5 条的 baseline→current 边确被记录
（`RM1-U02` ×3、`RM1-U03` ×2，例如 `…/p3-b/rm1-u03-package-exit.json`）；
replay 侧 14 条并无精确边。
对那 5 条，`hookReceiptClaim: "NOT_RECORDED_BY_CLIENT"` 是**肯定断言**且与事实矛盾
——这与 `nonClaims[0]`（"No entry asserts that a hook ran"）的免责措辞不是一回事。

**影响**：不影响生产行为，但污染"哪些字节有链/无链"这一分母，P8 对账要用它。

**最小修复**：在工件中显式定义两个 disposition 的判定谓词（建议即上述精确边口径），
按该谓词重算 51 条，并加控制——`DEXTER_AUTHORIZED_HISTORICAL_RECOVERY` 的每条不得存在精确边，
存在即具名红。

---

## 4. N（观察项）

**N1 ｜读 requirement 的 `capabilityKey` 是写能力（元数据误导，当前不消费）**
16 条 `REQ_GET_*` 绑定到 `BC-IAM-<TARGET>-ROLE-REVOKE`（membership/account）
或 `BC-IAM-<TARGET>-INVITE`（invitations/candidates）。
**当前不构成缺陷**——读路径不消费 capability（§3.1）。
但若 S1 的 resolver 将来接线并对读也执行 capability，
**只读角色会立刻打不开列表**。建议在接线前先裁定读侧语义
（新增 `BC-IAM-<TARGET>-VIEW`，或读 requirement 不带 capability）。
**该裁定属能力清单的产品面，届时需 Dexter 一句确认。**

> 本条是本轮草稿中被撤回的 M：初判为"只读用户打不开列表"，
> 经打开 controller 实测证伪。记录于此以免后续会话重复误判。

**N2 ｜legacy 二参重载仍以 assignment type 作 target**
`WorkspaceMembershipService.java:53-58` 的 `resolveTaskScope(session, requestedScopeRef)`
内部仍用 `assignment.serviceNodeType()`，注释标为
「Legacy internal compatibility only; operations endpoints must pass their fixed type.」。
本会话确认 operations 端点均走三参版本，**当前不构成缺陷**；
但它是上一轮根因形状的残留通道。建议 P8 前删除或加静态断言禁止 edge 层调用。

**N3 ｜`capability-invariants` 抓不到 M1 与 M2**
本会话实跑 **EXIT=0**，输出为
`P3_A_OTP_OWNER_INTERNAL_DELIVERY=PASS`、`P3_A_TYPED_PROBLEM_ADVICE_SURFACE=PASS`、
`MAPPED=78:NOT_REACHABLE=0:UNMAPPED=0`——只校验 requirement 结构与 problem 映射，
**不校验 capability key 是否属权威集合，也不校验 generator 产物是否全登记**。
M1 与 M2 的修复建议中各含一条补门，两条合起来才封住缺口。

---

## 5. 处置与再复核条件

| finding | 性质 | 处置 |
| --- | --- | --- |
| M1 | 受管通道缺口 + 缺门 | Codex 自主修复；不需要 Dexter 裁决 |
| M2 | 单一真相漂移 + 缺门 | Codex 自主修复；不需要 Dexter 裁决 |
| S1 | 交付状态未披露 | Codex 自主处置（接线 or 登记，二选一） |
| S2 | 证据分类谓词未定义 | Codex 自主修复 |
| N1–N3 | 观察 | 不阻塞；N1 在 resolver 接线前需 Dexter 一句裁定 |

**再复核条件**：M1（补 receipt 边 + 纳入登记 + generator 产物全覆盖门与红变异）、
M2（8 处改连字符 + 能力键属权威集合的门与红变异 + HEAD_COMPANY 测试）闭合后可复评；
S1、S2 可并行处置。

**本复核不授权**：进入下一 P、修改 Roadmap、seed/reset、DEV、migration、动态业务环境。
