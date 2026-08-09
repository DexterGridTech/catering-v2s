# 后台性能重构 implementation-facing 详设 —— Claude 第三次复核

`VERDICT=NO-GO`　`M=1`　`S=1`　`N=4`

**这一轮只剩一项阻断，且它很小。** 上一轮三项 M、两项 S 我逐条核验为真实关闭，其中两处 Codex 还纠正了**我自己**裁决里的错误，纠正是对的。

## 0. 会话出处与独立性

1. 本会话**不是 fresh v2s-rooted 会话**，是续接。
2. 冻结输入之一（方案 `…-plan-claude.md`）由我产出，含我上一轮的 §15 裁决——**本轮 Codex 部分推翻了它，我确认它推翻得对**（见 §1 与 N-04）。
3. 三个声明 sha256 本会话复算**全部一致**：方案 `53c3492dee6507a1…`、详设 `6de994fd21a85a77…`、矩阵 `ef2df71601b02367…`。
4. 本仓评审期间零写入，除本文件。

---

## 1. 上一轮 findings 关闭核验

### M-01（plan hash 漂移）—— **已关闭**

`scripts/check/implementation-design-granularity` 本会话 fresh 复跑：

```
IMPLEMENTATION_DESIGN_GRANULARITY=PASS
UNITS=7  FINDINGS=2  VERDICT=NO_GO
REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
```

manifest 全部声明 hash（design、authorization、intake、7 个 unit 的全部 approvedSources）**本会话逐个复算一致**。`addedDeliveryUnitIds: ["BP-U07"]` 保留。

### M-02（读预算算不平）—— **已关闭，且 Codex 纠正了我的裁决**

详设 line 87 用闭集 `ReadContextKind` 取代了我 §15 的「`contextResolution` 由 consumerFace 决定、上限 2」：

- `OPERATIONS_SCOPED` = `WorkspaceReadAuthorizationFacts + VisibleOrganizationFacts + EnabledGroupWorkspaceFact`（cap=3）
- `PLATFORM_WORKSPACE` = `PlatformReadSessionFacts + EnabledGroupWorkspaceFact`（cap=2）
- `PLATFORM_GLOBAL` = `PlatformReadSessionFacts`（cap=1）

**它比我的裁决准，我确认三处**：

1. **consumerFace 太粗**。我把 platform-admin 一律定成 2；实测 `getCurrentPlatformSession` 只有 `PlatformAuthenticationService#requireActiveSession:203` **1.0 条**，`getExtensionDefinition` 是 platform_iam 1.0 + group_workspace 1.0 = **2 条**。确实要分 `PLATFORM_GLOBAL` 与 `PLATFORM_WORKSPACE` 两档。
2. **「固定常量」是错的措辞**。line 87 末句「**不得强迫实际值等于某种最大上下文 cap 而平白多查**」正是对我 §15 写法的纠正——把它写成常量会逼 `PLATFORM_GLOBAL` 类的读平白烧掉 2 条。cap 语义正确。
3. **`ReadBudgetComponent` 闭集对账**（BP-U05）：`{CONTEXT_WORKSPACE_IAM, CONTEXT_ORGANIZATION, CONTEXT_PLATFORM_IAM, CONTEXT_PLATFORM_WORKSPACE, PRIMARY_QUERY, OPTIONAL_COUNT, UNCLASSIFIED}`，request snapshot 必须与 components **精确相加**，任一越 cap 或 `UNCLASSIFIED>0` 即失败。这正是我要的逐分量对账，`UNCLASSIFIED` 桶的设计也对。

`declaredExtrasCap=0`、`primaryQueryCap=1`、`primaryQueryCap>1` 至多 8 条具名例外表——三项均保留。§9 已把「B read budget component 超 cap 或未归类」登记为行为变更。

### M-03（抽象只有规则没有控制）—— **已关闭，且比我要求的更严**

line 277 的 `factImplementations[]` 七元组 + line 279 的校验方式，逐条堵住了我列的漏法：

- `factLoaderId` **基数受限**：M1 只有 `COMMAND`/`READ` 两项、M2 一项、M4 一项 → 128 份副本不成立
- `applicableOperationIds` **并集必须恰为 128**（M1 两 mode 合并、M2 单项）→ 拆成一对一不成立
- `statementTemplateHash` → 复制 SQL 到 adapter、动态拼接模板均可检出
- `securityPredicateId` + allowlist → 删改 `ENABLED` 可检出
- **「128 个 adapter 不得直接 JDBC，也不得引用 legacy loader」** —— 这一条是关键，它从源头禁止 adapter 自带 SQL
- `legacyAllowedImplementations[]` 逐项标 `sourcePath#method + reason` → 合法遗留读可见而不隐形

**Codex 同时纠正了我 §14.7.3 的第三道门**：我写的「`r.status='ENABLED'` 出现点数 = 1」会**误伤 `requireActiveScope` 等合法 typed failure 路径**。line 279 改为按 `factLoaderId + statementTemplateHash + allowlist` 校验、并明说「不能按整张表全局误伤」——**这个纠正是对的**，我接受。

它还要求了一条我没想到的红夹具：**「删无关 SQL 试图抵消总数」**——正是对 `<=465` 这道粗粒度护栏的正确防御。line 279 同时把 `<=465` 自我降级为「只是一道粗粒度不回归护栏，不能单独证明抽象正确」，判断准确。

### S-01（evidence 未冻结）—— **实质已关闭**

line 212：BP-U01 必须**在同一受管 run 内原子产出内容寻址 snapshot**，路径 `<run-evidence>/snapshots/<sha256>/`，manifest 列出每个输入的原路径、sha256、byteSize、runId/requestId 范围、schema/basis、dictionary digest 与三类分母；`backend-performance-budget` 与覆盖门**只接受该 snapshot，明确拒绝 live 路径**。line 273：「覆盖值只可从 BP-U01 content-addressed snapshot 导入」。矩阵已把 live 输入降级标注为 `(live discovery only)` 并写明门必须拒绝它。**追加不再能改变覆盖状态。** 残留见 S-01（新，仅文档层面）。

### S-02（SQL-M5 空分母）—— **已关闭**

详设新增 `#### SQL-M5 六表逐行处置（非空分母）`，六张表全部落地：

- **合并 4 项**：`CommercialGroupPreState`、`ExtensionDefinitionPreState`、`InvitationAssignmentIntentFacts`、`DerivedStoreStatusFacts`，各有精确 operation 集、typed 输入/输出、保留语义与正反 fixture
- **`SQL_MERGE_REJECTED` 2 项**：`organization.project_phase_name`（被 phase/状态写入隔开或单读）、`catalog.catalog_category`（`FOR UPDATE` 锁与写后 projection 语义不同），均带 reason 与负向夹具
- 收尾句「不得保留 `PENDING`、空 operation 集或全 owner 泛化」

我把这六行点名的 **13 个 operationId 逐个对撞 196 分母，全部存在**，method/face 也对得上。

### N-01（`code-layout` 与 `app/application` 退出）—— **已关闭**

§7 批次表 BP-U06 行已含「`app/application` 旧布局」；line 219 的门 disposition 改为「**在 BP-U06 退出**」并写明完成判据；§10 退出表新增对应行。

### 其余核验

- **196 分母**：矩阵 196 行、唯一 operationId 196、与 registry 并集完全相同、逐行 owner/method/face 零不符；55/105/36/0；113/78/5 —— **全部独立复算通过**
- **C5**：两个 POST 在 74 条内，79 = 74 + 5 未变，「C5/C6 新增第 80 条数值行均为红」保留 —— **通过**
- **静态适用面**：M1 128、M2 128、M3 25、M6 11 —— 与我独立推导一致。M4 见 M-01（新）
- **未测阻断**：line 273「每个 SQL-M 成功声明都要求结构适用 operation 全部不为 `UNMEASURED_BLOCKS_OPTIMIZATION`」「仅在 seed 运行过的接口证明成功，必然失败」—— 保留

---

## 2. 方案合理性

**方向对，控制已经到位，剩下的是一处事实错误。** 这一轮把「效率」从口号变成了可对账的东西：闭集 `ReadContextKind` + `ReadBudgetComponent` 精确相加，让读预算既不是拍脑袋的常量、也不会被 handler-scope 偷换；`factImplementations[]` 让抽象粒度从"规则"变成"可判"；内容寻址 snapshot 让覆盖状态不再被 live 文件的追加漂移。

**两处 Codex 反过来纠正我的地方（consumerFace 太粗、ENABLED 全局计数会误伤），我确认它对、我错。** 这是好的评审循环，不是让步。

**UI**：`NOT_APPLICABLE`。§9 五行行为变更方向正确，但缺一行，见 M-01（新）。

---

## 3. Findings

---

### M-01

**`EnabledGroupWorkspaceFact` 的适用面与实测相反——一端平白多查，另一端漏保护**

**证据：**

- 详设 line 87：`OPERATIONS_SCOPED` **固定加载** `WorkspaceReadAuthorizationFacts + VisibleOrganizationFacts + EnabledGroupWorkspaceFact`（cap=3）
- 覆盖矩阵第 9 列：`SQL-M4` 指派给 **134 行 = 全部 operations-admin**，platform-admin **0 行**，public **0 行**
- 详设 line 87 同一行：`PLATFORM_WORKSPACE` 固定加载 `PlatformReadSessionFacts + **EnabledGroupWorkspaceFact**`

**[实测]** 本会话按 `callSite` 聚合 `WorkspaceAdministrationService`（`platform_workspace.group_workspace` 的唯一读取点）：

命中该表的 operation 共 38 个，按 face 分布是 **operations-admin 24 / platform-admin 13 / public 1**。其中：

- **7 个 operations-admin 业务 GET**（`getOperationsCatalogItem` 194 请求、`getOperationsCatalogDictionary`、`getOperationsCatalogItems`、`getOperationsCatalogNavigation`、`getOperationsCatalogWorkbenchContext`、`getOperationsInventoryTargets`、`getOperationsProductionTags`）对该表命中 **0.00 次/请求**
- **platform-admin 的两个 B=78 读命中**：`getWorkspaceAccounts` **2.50 次/请求**（全语料该表最大的单请求重复）、`getExtensionDefinition` **1.00 次/请求**

**两个方向都错：**

**症状 A（平白多查）**：`OPERATIONS_SCOPED` 若真是"固定加载"三个事实，会给 58 条 operations-admin 的 B 读**各加一条今天不存在的 `group_workspace` 查询**。这与同一行末句「**不得强迫实际值等于某种最大上下文 cap 而平白多查**」自相矛盾。且若确实要加，那是「禁用工作区下的读开始失败」——一项可观察行为变更，**§9 行为变更登记表没有这一行**。

**症状 B（漏保护）**：矩阵把 M4 指派给零条 platform-admin，而实测命中该表的 13 条 platform-admin 里有两条在 B=78 内。这也与设计自己的 `PLATFORM_WORKSPACE` 固定加载 `EnabledGroupWorkspaceFact` **直接冲突**——设计说 platform-admin workspace-scoped 读用 M4 的事实，矩阵说 M4 不适用于任何 platform-admin operation。

**有限影响面：**

- 症状 A：58 条 operations-admin `TASK_READ`（矩阵第 9 列标 `SQL-M1` 的 `TASK_READ` 行）
- 症状 B：14 条实测命中该表但未列入 M4 面的 operation（platform-admin 13 + public 1），其中 `getWorkspaceAccounts`、`getExtensionDefinition` 属 B=78
- M4 当前声明面 134 条中，至少 7 条实测为 0 命中

**最小修复（不扩大为全局重构）：**

1. `EnabledGroupWorkspaceFact` 的适用面改为**按实测命中 `platform_workspace.group_workspace` 的 operation 逐条列出**，写进 `factImplementations[].applicableOperationIds`；不再按 consumerFace 整体指派。矩阵第 9 列的 M4 标注同步重算。
2. `OPERATIONS_SCOPED` 的三事实由「固定加载」改为「**至多**」，或拆出一个不含 `EnabledGroupWorkspaceFact` 的 operations-admin kind（例如 `OPERATIONS_SCOPED_NO_WORKSPACE_GATE`），使 cap 与实际值解耦——这与 line 87 末句本来的意思一致。
3. 若裁定要给 operations-admin 读补加启用校验，**必须在 §9 登记为行为变更**（禁用工作区下读从 200 变为 typed 拒绝），并同步 API/fixture negative case。

**Dexter 决策：需要（仅第 3 点）。** 「operations-admin 的任务读是否应当校验工作区启用」是产品与安全语义，不是性能问题——**今天不校验**。我倾向应当校验（禁用的工作区不该继续供读），但它会产生可观察的行为变更，属产品裁决。第 1、2 点无论怎么裁都要做，且在 Codex 既有边界内。

---

### S-01

**矩阵仍为 live evidence 声明 sha256，且该值已再次漂移**

**证据：** 覆盖矩阵「Discovery input」一节仍写 `current seed DB evidence (live discovery only): .runtime/r5/evidence/db-operations.jsonl sha256 3b0f4a7afb39b7ef…`。
本会话实算 **`1f5644c778b57584…`**；行数 **41,058 → 42,190**（本轮又增 1,132 行）。

**实质已关闭**：该输入已明确降级为 discovery-only，且 line 212 / line 273 与矩阵本身都写明覆盖门**必须拒绝 live 路径、只接受 snapshot**。所以这个 hash 已经不 gate 任何东西。

**残留的是文档诚实性**：一个**永远对不上**的 sha256 留在冻结输入表里，会让后来者以为它是可校验的输入；而它按定义就不可能稳定。

**有限影响面：** 矩阵一行；不影响任何门与任何计数（55/105/36 我按当前字节重算仍全部一致）。

**最小修复：** 删除该行的 sha256，或改为「快照创建时由 BP-U01 记录」的占位说明；保留路径与 `(live discovery only)` 标注即可。

**Dexter 决策：不需要。**

---

### N-01

**矩阵第 11 列仍是 196 × `M5_PENDING_STATIC_OWNER_MAPPING`**

证据：矩阵 col10 分布 `{M5_PENDING_STATIC_OWNER_MAPPING: 196}`；而详设 `#### SQL-M5 六表逐行处置` 收尾句明写「不得保留 `PENDING`」。二者矛盾。
影响面：矩阵一列 196 行；实质分母已由详设 §SQL-M5 与 applicability 文件承载。
最小修复：删除该列，或改为指向详设 SQL-M5 六表小节的固定值。
Dexter 决策：不需要。

### N-02

**`legacyAllowedImplementations[]` 无基数上限与到期复核**

证据：详设 line 277 只要求「逐项标 `sourcePath#method + reason`」。
主要出口已被「128 个 adapter 不得直接 JDBC，也不得引用 legacy loader」堵住，所以风险有限；但列表本身可无限增长而不触发任何门。
最小修复：给该数组一个上限与逐项到期复核日期，与 `primaryQueryCap>1` 的 8 条例外表同构。
Dexter 决策：不需要。

### N-03

**§8 `read BUDGET` 行缺「升 kind 逃逸」红夹具**

证据：§8 该行 red mutation 是「删除静态 `ReadContextKind`；给 command 加 budget；漏 protocol reason」，未覆盖「把某个 operation 的 kind 从 `PLATFORM_GLOBAL` 改成 `OPERATIONS_SCOPED` 以换取更大 cap」。
影响面：78 条 B operation 的 kind 声明。
最小修复：补一条 red mutation——升 kind 而实际事实未变即红（可由 `ReadBudgetComponent` 实测值与 kind 定义比对得出）。
Dexter 决策：不需要。

### N-04

**我自己的 §15 与 §14.7.3 需按本轮更正（Claude 侧修订）**

- §15「`contextResolution` 由 consumerFace 决定、上限 2」应改为引用详设的三档 `ReadContextKind`（3/2/1），并把「固定常量」改为「cap」。理由见 §1 的 M-02 段。
- §14.7.3 第三道门「`ENABLED` 出现点数 = 1」应改为 `factLoaderId + statementTemplateHash + allowlist` 校验，避免误伤 `requireActiveScope`。
- §14.7.3 应补一句：`<=465` 只是粗粒度不回归护栏，需配「删无关 SQL 抵消总数」红夹具。

这三处是**我的文件**，由我修订，不占 Codex 的修复范围。
Dexter 决策：不需要。

---

## 4. manifest 章节级命中对照表（增量）

上一轮的逐条对照仍然成立，本轮只记变化：

- **B.6.6**：由 `ReadContextKind` + `ReadBudgetComponent` 精确承接，「上下文解析一次、授权走内存投影、祖先/范围以 `EXISTS` 并入主语句」三句机制均在 BP-U05 落点。**由"算不平"转为命中**，唯一残留是 M-01 的适用面。
- **B.6.1 / B.6.5**：`factImplementations[]` 与「128 个 adapter 不得直接 JDBC」使"模块边界不是数据访问边界"具备机器判据。**命中**。
- **D.1**：`app/application` 与 `results` 已进 BP-U06 退出与 §10 退出表。**由"部分命中"转为命中**。
- **D.3**：`implementation-design-granularity` 本会话 PASS；新门三件套要求写入 BP-U01；抽象粒度已具备 `run()` 层面控制。**由"未命中"转为命中**。
- **D.8**：内容寻址 snapshot 使证据冻结次序成立。**命中**，残留仅 S-01 的文档层面。

其余 Part B / C / D 条目维持上一轮结论。

---

## 5. 结论与授权边界

**NO-GO**（M=1，S=1，N=4）——**但这是三轮里最接近 GO 的一次，且阻断项很小。**

上一轮三项 M、两项 S 全部真实关闭；196 分母、C5、抽象机械防线、evidence snapshot、SQL-M5 六表处置、`code-layout` 退出，我逐项独立复算通过。Codex 在两处反过来纠正了我的裁决（consumerFace 粒度太粗、`ENABLED` 全局计数会误伤合法路径），**两处纠正都对**。

唯一阻断的 M-01 是一处可实测证伪的事实错误：`EnabledGroupWorkspaceFact` 的适用面与实测相反——被指派给 7 个实测 0 命中的 operations-admin 读，却漏掉了实测 2.50 次/请求的 `getWorkspaceAccounts`。它同时与详设自己的 `PLATFORM_WORKSPACE` 定义冲突。修复是重算一个 `applicableOperationIds` 集合、把「固定加载」改成「至多」，外加一项产品裁决。

**需 Dexter 决策**：仅一条——**operations-admin 的任务读是否应当校验工作区启用**。今天不校验；补加会让禁用工作区下的读从 200 变为 typed 拒绝，是可观察行为变更。我倾向应当补，但请 Dexter 裁定；无论怎么裁，适用面按实测重算这一步都要做。

**授权边界**：本结论仅为 DESIGN 复核，只决定是否可申请后续 implementation authorization。它**不**授权代码实施、契约变更、数据库或迁移、运行环境、DEV、reset/seed、L2/UAT 或任何仓库控制动作。静态 review 不授权下一 Roadmap step。
