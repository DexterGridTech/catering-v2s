# 后台性能重构第二阶段（BP-U03 / BP-U04）实施 —— Claude 独立评审

`VERDICT=GO`　`M=0`　`S=1`　`N=2`

## 0. 会话出处与一处无法执行的核验

续接会话，非 fresh；本仓零写入（除本文件）。所有 exact-set、hash、源码调用顺序、门结果均本会话 fresh 复算。

**`scripts/generate/catalog-inventory-workspace-command-tokens.mjs --check` 我无法完整执行**：
本机 `/usr/bin/java` 是 macOS stub，门在 `verifyContextForgeryDoesNotCompile()` 前置检测后输出
`BP_U03_CONTEXT_NEGATIVE_COMPILE_UNVERIFIED`（EXIT=1，与真失败已分码，正确）。
**因此你点名的"token 门必须实际运行跨模块同包伪造负编译"，我没有执行过。** 见 §1.1 与 N-02。

---

## 1. 五项独立核验（逐条标注）

### 1.1 sealed / 不可伪造 —— `PARTIALLY_CONFIRMED`

**源码层已确认（我逐个读了声明）**：

| 类型 | 声明 |
|---|---|
| `OwnerGrant` | `public abstract sealed class OwnerGrant permits WorkspaceCommandContextMint.ResolvedOwnerGrant` |
| `WorkspaceExecutionContext<S>` | `public abstract sealed class … permits WorkspaceCommandContextMint.ResolvedWorkspaceExecutionContext` |
| `CatalogAuthorizationScope` | `public abstract sealed class … permits WorkspaceCommandContextMint.ResolvedCatalogAuthorizationScope` |

三者各**只允许一个**实现；三个 `Resolved*` 都是 `WorkspaceCommandContextMint` 内的 package-private
`static final class`，且构造器均为 `private`。`WorkspaceCommandContextMint` 自身构造器 private。
**subclass 伪造被 `permits` 编译期堵死，直接实例化被 private 构造器堵死。**

**铸造入口是运行时守卫**：`mintCatalog` 是 `public static`，由 `requireResolverCaller()` 用
`StackWalker` 取第一个非本类调用帧，与硬编码 FQCN
`com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver` 比较，不符即
`IllegalStateException("WORKSPACE_COMMAND_CONTEXT_MINT_FORBIDDEN")`。
**这一层是运行时而非编译期**，应如实这样描述，不宜笼统称"不可伪造"。

**但静态面被两道门补强了，我复核为有效**：

- `BP_U03_CONTEXT_MINT_CALLER_SET_DRIFT`：断言 `WorkspaceCommandContextMint.mintCatalog(` 在
  resolver + mint 两个文件中**恰好出现 1 次**且必须在 resolver 内。我独立 grep 全仓：
  **生产调用点确实只有 `CommandExecutionContextResolver.java:106` 一处。**
- `BP_U03_CONTEXT_MINT_PACKAGE_SET_DRIFT`：`commandPackageFiles()` 从
  `apps/backend/catering-business-server`（**整个后端根**，不是单模块）递归收集所有声明
  `package com.catering.v2s.platform.command;` 的 `.java`，要求集合等于 5 条 allowlist。
  **我一度怀疑它只扫单模块、看不见跨模块 split package，复核后确认怀疑不成立**——
  根目录是所有 module 的祖先，任何模块新增同包文件都会触发该红码。
- `BP_U03_CONTEXT_OPACITY_DRIFT`：逐字断言三处 `sealed … permits` 声明与 package-private 无参构造器，
  并禁止把它们改成 `public interface`。

**负编译片段构造正确**（我读了源）：门在临时目录写
`package com.catering.v2s.platform.command; public final class ForgedOwnerGrant extends OwnerGrant {…}`
——**同包、异模块、直接 extends**，与真实源一起编译并要求 `status !== 0`。这正是你要求的形态。
**但我没跑过**，故本项 `PARTIALLY_CONFIRMED` 而非 `CONFIRMED`。

### 1.2 三类 copy 的 receipt 顺序与 fail-closed —— `CONFIRMED`

三个 owner 我逐个读了控制流，顺序一致且正确：**当前事实判断 → digest/blocker → 才 receipt lookup**。

**catalog（`CatalogOwnerService.executeCopy`）**：
`requireScope(source)` / `requireScope(target)` → selected 数量上限 → `closureGraph(...)` →
selected ⊆ source 校验 → closure 上限 → `sourceVersion = scopeVersion(graph)` →
`targetVersion = targetScopeVersion(...)` → `currentDigest = copyDigest(source, target, selected, graph, sourceVersion, targetVersion)`
→ preflight 早退 → `validateCopyCompatibility(...)` + `assertNoOwnerReferenceLeak(...)`
→ **然后才** `replay(...)` → `replayCopyIfCurrent(replay, currentDigest)`。
**source、target、双向 version、digest、兼容性阻断全部在 receipt 之前。**

**inventory / production（`copyCore`，形状相同）**：
`requireScope` ×2 → `authorization.run()` → `recheckCopySourceFactsBeforeReceipt(...)` →
`preflightCopyCore(...)` → `currentFingerprint = judgement.digest` →
`blocker = judgement.firstBlockingProblem`，非空即抛 422 → **然后才** `replay(...)` →
`replayCopyIfCurrent(replay, currentFingerprint)`。

**`recheckCopySourceFactsBeforeReceipt` 是真重核不是空壳**：
inventory 版重算源闭包并要求 `closure.itemRefs().size() == refs.size()`，否则
`REFERENCE_MAPPING_UNRESOLVED` 422；production 版逐个 `findByRef` 并对 `null` 或 `VOIDED` 抛同码。

**旧 receipt 遇到事实变更 fail closed**：三个 owner 的 `replayCopyIfCurrent` 均为

```java
if (!currentFingerprint.equals(replay.path("receiptObjectFingerprint").asText()))
    throw new …Problem("STALE_COPY_PREFLIGHT", 409, "…对象事实已变化，请重新预检");
```

**不是放行、不是静默返回旧结果，而是 409 拒绝。**

### 1.3 U06 runtime cutover 仍为 deferred —— `CONFIRMED`

`operation-handler-bindings.json` 的 `runtimeIntegration.status = "DEFERRED_TO_BP_U06"` 保持，
`legacyDispatcher` 仍指名 `CatalogInventoryApplicationService.dispatch(String,...)`。
交叉印证：`CatalogOwnerService` 现有 **70 个 `case "`** 旧分发分支（一期为 65，本轮随 typed copy 增加），
`CatalogOwnerApi` 仍保留 3 处 `String operationId` 旧签名。
**没有一边声称已切换、一边留着旧路径。**

### 1.4 U04 分母与数值 —— `CONFIRMED`

我不读自报，从两份 registry 重算后对撞：

- `numericBaselines` **79 条 = 74 `NORMAL` + 5 `SAVE_BRANCH`**
- 74 条 NORMAL 的 operationId 集合 **精确等于** registry 中
  `consumerFaces=["operations-admin"] 且 method≠GET` 的 75 条**减去** `saveOperationsCatalogItem`
  —— 双向零差集
- 5 条 SAVE_BRANCH 全部 `saveOperationsCatalogItem`，branch 恰为
  `NORMAL_SAVE` / `IDEMPOTENT_REPLAY` / `ASSET_ADD` / `ASSET_REMOVE_UNREFERENCED` / `ASSET_REMOVE_STILL_REFERENCED`；
  且 save **未同时出现在 NORMAL** 中（无重复计入）
- `contextParity` **38 条 = platform-admin 29 + public 9**，**精确等于** registry 中非 GET 的
  platform+public 集合；与 `numericBaselines` **零重叠**
- 74 个 op + 1 个 save op + 38 parity = **113**，与 command 总分母一致
- **全部 79 条 `measurementStatus = UNMEASURED_BLOCKS_OPTIMIZATION`**
- **整个 registry 中数值型字段为空集**（我扫过所有 `int`/`float` 值）；`contextParity` 行不含任何
  `baseline` / `count` / `value` 字段 —— **没有填入任何伪造数值**
- `denominators` 自报（196 / 113 / 75 / 79 / 74 / 5 / 38）与我的实算逐项一致
- 门 fresh 复跑：`BP_U04_BASELINE_CHECK=PASS`、`NUMERIC_BASELINES=79`、`CONTEXT_PARITY=38`

### 1.5 受管证据 —— `CONFIRMED`

`.runtime/r5/evidence/remote-testcontainers/r5-tc-1786248007727-55729/run-manifest.json`：
`business = {status: PASS, remoteGradleStatus: 0}`、`cleanup = {status: PASS, reaped: true}`、
`firstFailure = null`、`task = :modules:catalog:test`。

JUnit XML 我读了原件：
`CatalogCategoryOwnerIntegrationTest` **tests=7 failures=0 errors=0**、
`InventoryCopyReplayIntegrationTest` **tests=1 failures=0 errors=0** —— 与自报一致。

### 1.6 越权检查 —— `CONFIRMED`

`backend-performance-budget`、`sql-merge-applicability`、`task-read-surface-policy`、
`ReadContextKind`、`ReadBudgetComponent`、`WorkspaceReadAuthorizationFacts`、
`VisibleOrganizationFacts`、`ResolvedBomTargets`、`sourceRetirements` —— **全部命中 0**。

`TaskReadService` 有 25 处命中，经核**全部是既有的 `ContractTaskReadService` /
`OrganizationOverviewTaskReadService`**（设计里点名的既有正例）；
`CatalogTaskReadService` / `InventoryTaskReadService` **未创建**。无 BP-U05～U07 越权。

---

## 2. Findings

### S-01｜package exit 声明了一条不存在的 changedPath，且其空目录残留在 sealed 类型所在的包上

**证据**

`doc/evidence/platform/2026-08-09-v2s-backend-performance-phase2-package-exit.json` 的
`changedPaths` 共 **40 条**，其中一条在工作树中**不存在**：

```
apps/backend/catering-business-server/modules/workspace-iam/src/main/java/
  com/catering/v2s/platform/command/WorkspaceIamCommandContextMint.java
```

该文件的目录 `…/workspace-iam/src/main/java/com/catering/v2s/platform/command/`
**确实存在且为空**（无任何 `.java`）。

**判读**：这是一个被放弃的中间设计的残留——曾打算在 workspace-iam 模块内再放一个
共享 `com.catering.v2s.platform.command` 包的 mint（**跨模块 split package**），
后来改为 execution-context 单一 mint，但 exit 的路径清单与空目录都没清掉。

**影响面**（两条，都不是当前可利用的缺陷）：

1. **exit 集合不实**：40 声明 / 39 实存，破坏 package exit 的 changed-path 集合相等对账。
   一期 exit 是 43/43 全实存，这是本期的回退。
2. **空目录位置敏感**：它正落在三个 sealed 类型所在的包上。当前无害
   （`BP_U03_CONTEXT_MINT_PACKAGE_SET_DRIFT` 从后端根递归扫，任何模块**新增文件**都会被抓到，
   空目录本身不产生文件故不触发），但 manifest **D.1**「空目录、红夹具脚手架不留源码树」明令不留；
   留着它等于在安全边界上留一个现成的落点。

**最小修复**：从 `changedPaths` 移除该条（或若确实应存在则补上文件并说明为何需要 split package），
并删除那个空目录。

**标注**：`CONFIRMED`。**是否需要 Dexter 裁决**：不需要。

### N-01｜生产路径经过一个名为 `…ForTest` 的方法

`CommandExecutionContextResolver.java:68`：公共生产入口 `resolveCatalog(...)` 的最后一步是

```java
return resolveCatalogResolvedSessionForTest(session, token, target.dataNodeType(), …);
```

该方法（`:72`）是 package-private、**名字带 `ForTest` 后缀**，同时确实被
`CommandExecutionContextResolverTest` 直接调用 3 次。

功能无害（同类内、逻辑真实、可见性受限），但**生产控制流经过一个自称"测试用"的方法**，
会让后来者误判它可以被削弱或删除。建议改名为中性的内部步骤名
（如 `resolveCatalogFromResolvedSession`），测试照常调用即可——名字变了，语义不变。

**标注**：`CONFIRMED`。**是否需要 Dexter 裁决**：不需要。

### N-02｜token 门的跨模块同包伪造负编译，本会话无法执行

`scripts/generate/catalog-inventory-workspace-command-tokens.mjs --check` 在无 JDK 时输出
`BP_U03_CONTEXT_NEGATIVE_COMPILE_UNVERIFIED`（分码正确）。
因此 §1.1 的 `permits` 编译期阻断我只做了源码层确认，**负编译未执行**。

**建议**：在二期证据里附上有 JDK 环境下该门的完整输出（含负编译通过的红码名），
使这条断言在无 JDK 的评审会话里可被引用。这与一期 N-03 是同一条，尚未闭合。

**标注**：`UNVERIFIED_REQUIRES_EVIDENCE`。**是否需要 Dexter 裁决**：不需要。

---

## 3. 结论

**GO**（M=0，S=1，N=2）。

二期两个核心目标我复核为**真正达成**：

**BP-U03 的可伪造面被实质关闭**——三个类型 `sealed` 且各只允许一个实现，
实现类 package-private + 私有构造器；铸造入口只有 resolver 一处调用（我全仓 grep 独立确认），
且有三道门分别守住"包内文件集合""铸造调用点集合""sealed 声明字面量"。
运行时的 `requireResolverCaller()` 是补充层，我按其真实性质（运行时而非编译期）如实记录。

**"receipt 先于对象事实重核"的漏洞已消除**——catalog / inventory / production 三条 copy 路径
的顺序完全一致：scope → 源事实重核 → 目标事实与双向 version → digest/blocker → **才** receipt lookup；
且旧 receipt 遇到 digest 变化一律 `STALE_COPY_PREFLIGHT` 409 拒绝，不是放行。

**BP-U04 的分母是冻结且精确的**——74 + 5 = 79 与 38 parity 我都从 registry 重算对撞、双向零差集、
零重叠、合计 113；79 条全部 `UNMEASURED_BLOCKS_OPTIMIZATION`，**整个 registry 里没有一个数值字段**。

**U06 仍诚实 deferred**，BP-U05～U07 零越权。

唯一的 S 是残留清理：exit 声明了一条不存在的路径，其空目录还留在 sealed 类型所在的包上。
不是可利用的缺陷，但破坏了 exit 的集合对账，且违反 D.1 的空目录禁令，**建议在二期 exit 定稿前清掉**。

**需 Dexter 裁决**：无。

**授权边界**：本结论仅覆盖 BP-U03 / BP-U04 的实施与验收。
不授权 BP-U05～BP-U07、不授权 SQL 合并或性能数值优化、不授权 reset / seed / DEV / L2 / UAT、
不授权任何仓库控制动作。
