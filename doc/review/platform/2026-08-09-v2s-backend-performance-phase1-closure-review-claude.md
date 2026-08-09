# 后台性能重构第一阶段（BP-U01 / BP-U02）实施收口 —— Claude 独立评审

`VERDICT=GO`　`M=0`　`S=1`　`N=3`

**S-01 必须在下一次受管运行被用作 BP-U07 输入之前关闭**——它不影响本期已交付的证据，但会在下一次真实运行里以错误理由阻断。

## 0. 会话出处与一处无法亲验

续接会话，非 fresh；本仓零写入（除本文件）。所有计数、hash、join、section/phase 分布、
门结果、源码调用点均在本会话 fresh 复算，未采信任何自报值。

**`scripts/check/operation-handler-bindings` 本会话仍无法完整复跑**：它需要 JDK 编译生成 Java，
本机 `/usr/bin/java` 是 stub，输出 `BP_U02_COMPILE_UNVERIFIED`（EXIT=1，与真编译失败已分码，正确）。
因此 BP-U02 的 **javac 跨 context 负编译证明与 11 条红夹具我没有执行**，只能从生成代码形态推断。
我在前几轮用 scratchpad 独立重生成 24 个产物逐字节比对补了"产物可复现"那一半。见 N-03。

---

## 1. 你点名的五项独立核验

### 1.1 snapshot `a296fc19…` —— **逐项复算通过**

我重算而非读取 manifest：

| 项 | 声明 | 我的独立复算 |
|---|---|---|
| 目录名 == `contentDigest` | — | ✓ |
| 逐输入 sha256 / byteSize | 5 项 | **5/5 一致** |
| DB 操作数 | 4177 | **4177** |
| request events | 173 | **event tuple 173** |
| DB tuple | — | **173** |
| **孤立 tuple** | — | **0** |
| runId 单一性 | `rm1-seed-e91d3f07-…` | DB 侧 runId 集合 = 该单值，**同 run** |
| `missingPhases` | `[]` | 8 个必需 phase **并集全覆盖** |
| `unclassifiedRatio` | 0 | **UNCLASSIFIED 实算 = 0** |
| `ownerCommandPhaseMissingRequests` | `[]` | 见 §1.3 |

`sourceSha256` / `sourceByteSize` 保留了原始整文件（db 41,504,570 B → 切片 3,157,354 B），
按 run-manifest 的 runId 切片，provenance 未丢。

**section 归因是真归因，不是兜底吞并**——我把本轮与上一轮（同为 4177 条）逐段对比：

```
SESSION 701→701   SCOPE 466→466   TRANSACTION 630→630
CONNECTION 335→335   AUTHZ 68→68        （更窄的段一条未动）
UNCLASSIFIED 1977→0  ⇒  OWNER_READ 1346 + OWNER_WRITE 615 + READBACK 16 = 1977（精确）
```

### 1.2 44 历史门 + 4 一期新增门 —— **exact-set 成立**

- `scripts/check` 下可执行门（排除 3 个 `.mjs` 模块）实算 **48**
- 声明 44 基线 + 4 新增 = 48，**并集与磁盘集合完全相等**，双向零差集，基线与新增零重叠
- 门本体 fresh 复跑：`backend-performance-gate-dispositions=PASS`、`BASELINE_GATES=44`

**处置诚实**：44 条里 `PASS` 24、`FAIL` 14、`USAGE_REQUIRED` 6。
14 条红门全部登记了 `futureUnit`（`OUT_OF_SCOPE_EXISTING` / `BP-U06` / `BP-U04/BP-U05` / `OUT_OF_SCOPE_HISTORICAL`），
**没有一条被伪称为绿**。其中 `code-layout → BP-U06`、`database-operation-budget → BP-U04/BP-U05`
与设计的门 disposition 一致。

### 1.3 `EXISTING_VERIFY` == `verify.mjs` 的 10 条 —— **精确相等**

我从 `tools/verify-gates/verify.mjs` 正则抽取实际调用的 `scripts/check/*`，与声明为
`EXISTING_VERIFY` 的门集合对撞：

```
affected-l2, backend-boundaries, contract-face, database-boundaries, edge-codegen,
flyway-layout, frontend-architecture, openapi-contracts, retirement, standards-coverage
```

**两侧各 10 条、逐条相同、双向零差集。**

### 1.4 replay 与异常 readback 不伪造 phase —— **通过**

**readback**（`OwnerOperationDiagnostics.readback`）：

```java
try (var ignored = pushSection(READBACK)) {
    T result = readback.get();
    markPhase(READBACK_END);   // 只在 get() 正常返回之后
    return result;
}
```

`markPhase(READBACK_END)` **不在 finally**，supplier 抛出时该行不可达。✓

**replay**：`beginCommand()` 全仓共 **11 个生产调用点**（9 个 owner receipt service +
`OrganizationCommandService:133` + `PlatformAssetService:93`），我**逐个**回看其前置语句，
**11/11 都在 replay 早退之后**：

- `ContractCommandReceiptService:25`、`PlatformCommandReceiptService:28`、`WorkspaceIamCommandReceiptService:45`
  前置均为 `if (prior != null) { … return …; }`
- `OrganizationHierarchyCommandReceiptService:45`、`CommercialGroupCommandReceiptService:41`、
  `WorkspaceCommandReceiptService:37`、`ExtensionCommandReceiptService:34` 前置为 `return deserialize(existing…)`
- `BusinessEntityCommandReceiptService:35/:48` 前置为 `if (existing != null) return …`
- **两处点名修复我单独确认**：`OrganizationCommandService:133` 的 scope 在 `:122` 的
  `return readback(existing.commercialGroupId(), …)` 之后；`PlatformAssetService:93` 在 `:90` 的
  replay 返回之后。

`CommandScope.close()` 无条件标 `OWNER_COMMAND_END`（含异常路径）——这是**区间边界**而非成功声明，
与 `READBACK_END` 的"完成声明"语义区分正确，不构成伪造。

### 1.5 196 binding 与 U06 deferred —— **通过**

- 196 条与两 registry 并集**完全相等**；`adapter` 196/196 唯一
- `contextCounts` 自报 == 实算：`READ_CONTEXT 83 / WORKSPACE_EXECUTION_CONTEXT 68 /
  WORKSPACE_PROTOCOL_CONTEXT 7 / PLATFORM_COMMAND_CONTEXT 29 / PUBLIC_PROTOCOL_CONTEXT 9`
  —— Dexter 对自助改密的裁定（68/7）**仍然保持**
- `runtimeIntegration.status = DEFERRED_TO_BP_U06`，并由生成器作为不变量校验

### 1.6 越权检查 —— **零越权**

`CommandExecutionContextResolver`、`OwnerScopeKind`、`CatalogAuthorizationScope`、
`WorkspaceCommandAuthorizationFacts`、`VisibleOrganizationFacts`、`ResolvedBomTargets`、
`CatalogTaskReadService`、`backend-performance-budget`、`backend-performance-sql-merge-applicability`、
`task-read-surface-policy`、`performance-refactor-command-baselines` —— 全部命中 0。

唯一命中的 `WorkspaceExecutionContext`（9 处）经核为 BP-U02 生成的**空 marker**
（`public static final class WorkspaceExecutionContext { private WorkspaceExecutionContext() {} }`）
与生成器本身，**不是 BP-U03 实现**。

package exit 的 **43 条 changedPaths 全部存在于工作树**，分布为 java-main 20 / scripts 10 /
doc 6 / java-test 4 / contracts 2 / active-package 1；
**无一条触及 catalog / inventory owner service、task reader 或 SQL 合并**。

---

## 2. Findings

### S-01｜10 条平台凭据/会话协议命令落进逐请求 owner-command 门的分母，其中约 8 条是潜伏误判

**path:line**

- `scripts/check/backend-performance-evidence-snapshot:13`
  `const AUTHENTICATION_PROTOCOL_OPERATIONS = Object.freeze(new Set(["platformPasswordLogin"]));`
- 同文件 `:25-33` `ownerCommandOperationIds()`：
  `mode === "COMMAND" && !contextKind.endsWith("PROTOCOL_CONTEXT") && !AUTHENTICATION_PROTOCOL_OPERATIONS.has(id)`

**根因**：workspace 与 public 侧有 `WORKSPACE_PROTOCOL_CONTEXT` / `PUBLIC_PROTOCOL_CONTEXT` 两个 kind，
所以协议命令被规则自然排除；**platform-admin 侧没有 PROTOCOL kind**，一切平台命令都是
`PLATFORM_COMMAND_CONTEXT`，于是平台的凭据/会话协议命令被判为 owner command。
唯一的硬编码例外只补了 `platformPasswordLogin` 一条——**这本身说明分类规则不完整，是按跑到的个案打补丁**。

**[实算] 96 条非协议 command 分母中，名称呈凭据/会话协议特征的有 10 条**（全部 platform-admin）：

`changeCurrentPlatformPassword`、`platformLogout`、`sendPlatformLoginOtp`、`verifyPlatformLoginOtp`、
`startPlatformPasswordRecovery`、`sendPlatformPasswordRecoveryOtp`、`verifyPlatformPasswordRecoveryOtp`、
`completePlatformPasswordRecovery`、`resetPlatformAdminCredential`、`requestWorkspaceCredentialReset`。

其中后两条经本轮运行验证是**真 owner command**（`requestWorkspaceCredentialReset` 实测 begin=end=1），
**前 8 条是协议命令**，不会有 owner receipt / command boundary。

**注意一处语义不一致**：`changeCurrentPlatformPassword` 是 Dexter 刚裁定为凭据协议的
`changeCurrentWorkspacePassword` 的平台孪生，却因平台无 PROTOCOL kind 落进了 owner-command 分母。

**有限影响面**：本轮**未触发**——那 8 条一条也没跑（唯一跑到的平台登录正是被硬编码排除的那条）。
但下一次受管运行只要命中其中任意一条（`platformLogout` 在任何真实会话流里都会走到），
`ownerCommandPhaseMissingRequests` 就会非空，`optimizationStatus` 翻成
`UNMEASURED_BLOCKS_OPTIMIZATION`，**以错误理由阻断 BP-U07**。

方向是安全的（阻断而非放行），所以是 S 不是 M。

**最小修复（推荐第一个）**

1. **把协议/owner-command 的判别下沉为契约数据**：在 `operation-handler-bindings.json` 每行加一个
   闭集字段（如 `commandBoundary: OWNER_COMMAND | PROTOCOL`），由生成器校验、由门读取，
   替换掉 `AUTHENTICATION_PROTOCOL_OPERATIONS` 这个硬编码单例。
   **不动 196 exact-set、不动 `contextCounts`**，且分类可被评审。
2. 或新增 `PLATFORM_PROTOCOL_CONTEXT` 第六个 kind 并重分类——语义更干净，但会改动已冻结的
   196 binding 与 29/9/68/7 的 context 分档。
3. 不建议靠"是否存在 owner receipt service"隐式推导——脆弱且不可复算。

**是否需要 Dexter 裁决**：**第 1 种不需要**（纯工程分类，且有 `changeCurrentWorkspacePassword` 的先例可循）。
**若 Codex 提议第 2 种，需要 Dexter 裁决**——它触及 BP-U02 已冻结的 196 契约与分档计数。

### N-01｜逐请求 command 门在本 run 只覆盖 96 条分母中的 29 条，manifest 未记录覆盖率

`ownerCommandPhaseMissingRequests=[]` 是**真的**——我逐 operation 复核，29 条被覆盖的
non-protocol command 全部 `begin 次数 == end 次数 == 请求数`，无一例外。

但本 run 只有 **173 个请求 / 41 个 operation**，其中命中该分母的是 **29 / 96（30%）、87 / 173 个请求**。
`optimizationStatus: MEASURABLE` 的代码定义是三个条件的合取，**并不声称覆盖率**；
但 manifest 里没有任何字段记录"适用 96 / 实测 29"，读者容易把 `MEASURABLE` 读成"归因已完成"。

按设计，逐 operation 的阻断由 196 行覆盖矩阵承担（`MEASURED_NEW_FIXTURE=0`，BP-U07 填充），
所以覆盖缺口本身是**设计内的延期**，不是缺陷。

**最小修复**：manifest 增加 `ownerCommandOperationsApplicable` / `ownerCommandOperationsObserved`
两个数字（本 run 为 96 / 29），让 `MEASURABLE` 自带限定。

### N-02｜14 个 section 中有 5 个从未出现；`unclassifiedRatio=0` 表示"已归 owner"而非"已细分"

`Section` 枚举含 `IDEMPOTENCY`、`CAS`、`AUDIT`、`REFERENCE_CHECK`、`EXTENSION`，
本 run 的 4177 条里**一条都没有**（实际只出现 CONNECTION / TRANSACTION / OWNER_READ /
OWNER_WRITE / SESSION / READBACK / AUTHZ / SCOPE 八种）。

原因是 `DatabaseOperationTracker.defaultSection:365-376` 的兜底把"owner 实现发出、无显式 section"的
QUERY 归为 `OWNER_READ`、UPDATE/BATCH 归为 `OWNER_WRITE`。

**兜底本身是受限且正确的**，我在代码层确认了两点：
`:293` `sections.isEmpty() ? defaultSection(...) : sections.peek()` —— **显式 push 永远优先，兜底吞不掉更窄的段**；
`isOwnerImplementation:378-382` 排除 `com.catering.v2s.app.`（edge）与 `com.catering.v2s.platform.foundation.`，
edge / foundation 调用者仍可见地保持 UNCLASSIFIED。

但后果是：receipt / CAS / audit / 引用校验 / 扩展字段这五类工作目前都落在 OWNER_READ / OWNER_WRITE 里，
**BP-U04（C4 五分支、asset claim/release）与 BP-U05 不能假定这些细分桶已经存在**。

**最小修复**：不必本期改；建议在 BP-U04 的设计里显式声明这五个 section 的落点，
或在 evidence 报告里注明"本期 section 粒度到 owner 读/写为止"。

### N-03｜BP-U02 门需要 JDK，本会话无法完整亲验（复发披露）

见 §0。门在无 JDK 时输出独立的 `BP_U02_COMPILE_UNVERIFIED`（这一点是对的，上一轮已关闭）。
**建议一期证据报告里附上有 JDK 环境下 `--check` 的完整输出（含 `CONTEXT_KIND_NEGATIVE=PASS`）**，
使这条断言在没有 JDK 的评审会话里也可被引用而不必重跑。

---

## 3. 结论

**GO**（M=0，S=1，N=3）。

一期的四项交付我逐项独立复算通过：
snapshot 同 run、173/4177、孤立 tuple 0、`missingPhases` 空、`unclassifiedRatio` 实算为 0；
44+4 门与磁盘 exact-set 双向零差集，14 条红门诚实登记未伪绿；
`EXISTING_VERIFY` 与 `verify.mjs` 的 10 条精确相等；
11 个 `beginCommand()` 生产调用点全部在 replay 早退之后，`READBACK_END` 不在 finally；
196 binding 完好、Dexter 的 68/7 裁定保持、`DEFERRED_TO_BP_U06` 由生成器守住；
BP-U03～U07 的产物零越权，43 条 changedPaths 无一越界。

**section 归因是真归因**：1977 条 UNCLASSIFIED 精确拆成 OWNER_READ 1346 + OWNER_WRITE 615 + READBACK 16，
而 SESSION / SCOPE / AUTHZ / TRANSACTION / CONNECTION 五段与归因前**逐个数字未动**——兜底没有吞并更窄的段，
代码层的 `sections.isEmpty()` 优先级也印证了这一点。

**S-01 的处理时点**：它不影响本期任何已交付证据（那 8 条一条没跑），
但**必须在下一次受管运行被用作 BP-U07 输入之前关闭**——否则第一次跑到 `platformLogout`
就会以错误理由把 `optimizationStatus` 打成 `UNMEASURED_BLOCKS_OPTIMIZATION`。

**需 Dexter 裁决**：仅在 Codex 选择第 2 种修复（新增 `PLATFORM_PROTOCOL_CONTEXT` 第六个 context kind）时需要，
因为那会改动已冻结的 196 binding 契约与分档计数。选第 1 种（契约加 `commandBoundary` 字段）则不需要。

**授权边界**：本结论仅覆盖第一阶段 BP-U01 / BP-U02 的实施与验收。
不授权进入 BP-U03～BP-U07、不授权 SQL 合并或业务优化、不授权 DEV / reset / seed / L2 / UAT、
不授权任何仓库控制动作。
