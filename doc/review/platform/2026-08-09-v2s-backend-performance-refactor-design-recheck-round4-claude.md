# 后台性能重构 implementation-facing 详设 —— Claude 第四次复核

`VERDICT=NO-GO`　`M=1`　`S=1`　`N=2`

## 0. 会话出处与独立性

1. 本会话**不是 fresh v2s-rooted 会话**，是续接；冻结输入之一（方案）由我产出。
2. 所有 hash、门、registry 计数、语料聚合与**源码调用点**均在本会话 fresh 复算。
3. 本仓评审期间零写入，除本文件。
4. manifest 全部声明 hash（design、authorization、intake、7 个 unit 的全部 approvedSources）**本会话复算一致**；`implementation-design-granularity` fresh 复跑 **PASS**（UNITS=7）。

---

## 1. 你点名要核验的两条

### 1.1 「当前已认证 operations task read 没有被性能批次暗改为 disabled→403」—— **核验通过**

- 详设 line 87：`OPERATIONS_SCOPED` 固定加载 `WorkspaceReadAuthorizationFacts + VisibleOrganizationFacts`（cap=2），**已移除 `EnabledGroupWorkspaceFact`**；
  `OPERATIONS_SCOPED_WITH_ENABLED_WORKSPACE` 是 opt-in，且「仅在已有 source-bound 启用状态门且行为契约允许时」才可采用。
- line 87 末句新增「**不得把 operation 升为严格超集 kind 来换取更大 cap**」；line 302 新增「strict-superset kind 必须因缺少 source/行为依据而失败」。
- §9 行为变更登记表**没有**新增任何 disabled→403 行。

**结论：这个性能包没有暗改任何已认证 operations task read 的拒绝语义。** 上一轮我提的症状 A 已关闭。这两句同时也关闭了我上一轮的 N-03（升 kind 逃逸）。

### 1.2 「这 38 条并非整张 group_workspace 表的读取分母」—— **声明对，但集合错**

这句话本身没错：38 确实不该是整表读取分母。**但详设给出的这 38 条，既不是整表分母，也不是启用状态门的正确集合。**

**[源码]** `isEnabled` 是 `WorkspaceStatusLookup` 的接口方法（`organization/api/WorkspaceStatusLookup.java:7`），`WorkspaceAdministrationService:88` 只是**实现**。真正的**调用点有 8 处，分布在两个模块**：

- organization 模块 **3 处**：`OrganizationHierarchyService:363`、`BusinessEntityService:647`（`requireActiveWorkspace`）、`OrganizationCommandService:276` 与 `:308`
- workspace-iam 模块 **5 处**：`WorkspaceAccountService:44`、`WorkspaceAuthenticationService:66` 与 `:243`、`WorkspaceRoleService:190`、`WorkspacePasswordRecoveryService:63` 与 `:162`、`WorkspacePasswordResetService:42`

详设 line 283 把来源写成「`WorkspaceAdministrationService` 的启用状态门」——**按实现类找消费者，必然漏掉通过 `WorkspaceStatusLookup` 接口调用的那些**，而 organization 模块那 3 处正是 operations-admin 业务命令的路径。

---

## 2. Findings

---

### M-01

**`SQL-M4 当前启用状态门 exact set` 的 38 条与源码调用点及实测均不符：与实测集合交集仅 8/32，漏掉 24 条实测命中的 operation**

**证据：** 详设 `#### SQL-M4 当前启用状态门 exact set`（line 281-283）；实现与调用点见 §1.2。

**[实测]** 本会话按 `callSite` 精确匹配 `WorkspaceAdministrationService#isEnabled`（与该表的其它读取——`require:75`、`detail:50`、`audit:159`——分开统计）：

- 语料中走**启用状态门**的 operation = **32 条**（30 条命令 + 2 条 GET）
- 语料中命中**整张 `group_workspace` 表**的 operation = **39 条**（本轮字节；上一轮字节为 38）
- 详设声明 38 条 ∩ 实测启用门 32 条 = **8 条**

**[实测] 漏掉的 24 条**（详设未列但实测确实走 `isEnabled`），其中 **23 条 operations-admin + 1 条 public**：

`createOperationsOrganizationBrand` **6.00/请求**、`createOperationsOrganizationTenant` **6.00/请求**、`createOperationsOrganizationHeadCompany` **6.00/请求**、`transitionOperationsOrganizationBrandStatus` 5.00、`transitionOperationsOrganizationTenantStatus` 5.00、`createOperationsOrganizationRegion` 4.00、`selectOperationsWorkspaceSessionDataNode` 3.00、`createOperationsOrganizationStore` 3.00、`operationsWorkspacePasswordLogin` 3.00、`createOperationsContract` 2.00、`createOperationsOrganizationProject` 2.00、`transitionOperationsOrganizationStoreStatus` 2.00、`invalidateOperationsContract` 2.00、`getOperationsWorkspaceSessionEntry` 1.67、`saveOperationsCatalogItem` 1.00、`createOperationsCatalogItem` 1.00、`createOperationsCatalogDictionaryEntry` 1.00、`createOperationsCatalogCategory` 1.00、`stageOperationsCatalogAsset` 1.00、`createOperationsProductionTag` 1.00、`transitionOperationsOrganizationNodeStatus` 1.00、`transitionOperationsOrganizationHeadCompanyStatus` 1.00、`addOperationsOrganizationHeadCompanyBrandAuthorization` 1.00、`completePublicInvitation` 0.27。

**注意前三条是全语料该表最高的单请求重复（各 6.00 次/请求），它们完全落在 M4 面外。**

**[推论]** 上一轮我指出 M4「按 consumer face 整体指派给 134 条 operations-admin」是错的；本轮改为 source-bound exact set，**方向正确**，但推导时只扫了 `WorkspaceAdministrationService` 的直接消费者，于是从"几乎全 operations-admin"翻到了"几乎全 platform-admin"——**又翻过头了**。

**另有 30 条**详设列出但语料未覆盖（其中 24 条 platform-admin）。我无法用语料证伪，源码调用点（`WorkspaceRoleService:190`、`WorkspaceAccountService:44`）支持其中一部分，但**它们同样需要逐条 source-bound 举证**，不能因为语料没跑到就默认成立。

**有限影响面：**
- 漏列 **24 条**（23 operations-admin + 1 public），其中 `getOperationsWorkspaceSessionEntry` 属 B=78 —— 它实测走 `isEnabled` 1.67 次/请求，若被归入 `OPERATIONS_SCOPED`（cap=2，不含该事实），这条读会产生**无归属 component** → `UNCLASSIFIED>0` → 门必失败。这是 M-01 的一个可立即触发的后果实例。
- 声明的 38 条中，**30 条无语料支撑**，需静态举证。
- M4 的合并收益（上一轮实测该表可省 169 条 / 7.0s）大部分落在漏列的那 24 条上。

**最小修复（不扩大为全局重构）：**
1. 把 exact set 的推导基准从「`WorkspaceAdministrationService` 的消费者」改为「**`WorkspaceStatusLookup.isEnabled` 的全部调用点**」，逐点向上解析到 operation：organization 3 处 + workspace-iam 5 处，一处不能漏。
2. 每条 operation 标注其命中的**调用点**（`sourcePath#method`），使 `factImplementations[].applicableOperationIds` 可被独立复算而不是人工枚举。
3. 把「读该表但非启用门」的调用点（`require:75`、`JdbcGroupWorkspaceRepository#detail:50`、`audit:159`、`PlatformWorkspaceService#initializeCommercialGroup:67`）**显式排除并列名**——它们读的是被操作对象本身（CAS 前置 / 详情投影），**不得用共享的 `EnabledGroupWorkspaceFact` 替代**。当前 38 条里的 `createPlatformGroupWorkspace`、`transitionPlatformGroupWorkspaceStatus`、`updatePlatformGroupWorkspaceDisplay`、`initializeCommercialGroup` 恰属此类，混入即有以陈旧 fact 替代 CAS 前置读的风险。

**Dexter 决策：不需要。** 这是可由源码复算的事实，不涉及产品语义。

---

### S-01

**覆盖矩阵的 `SQL-M4` 适用面变为 0 行，与详设声明的 38 条直接矛盾，M4 回到空分母**

**证据：** 覆盖矩阵第 9 列本轮分布为 `{'-': 68, 'SQL-M1,SQL-M2': 92, 'SQL-M1,SQL-M2,SQL-M3': 25, 'SQL-M1,SQL-M2,SQL-M6': 11}` —— **`SQL-M4` 出现 0 次**（上一轮为 134 次）。而详设 line 283 声明 M4 适用面为 38 条具名 operation。

**影响面：** BP-U07 的成功判据是「每个 SQL-M 成功声明都要求结构适用 operation 全部不为 `UNMEASURED_BLOCKS_OPTIMIZATION`」。矩阵里 M4 适用面为空 → 该判据**恒真** → M4 可以零工作量通过。这与我上一轮对 SQL-M5 提出的"空分母恒真"是同一形态，只是换成了 M4。

**最小修复：** 按 M-01 修正后的 exact set 回填矩阵第 9 列；或在矩阵显式声明「M4 的适用面由详设 SQL-M4 小节与 applicability 文件承载，本列不表达 M4」，并让覆盖门从该处读取——两者取一，不能两边都空。

**Dexter 决策：不需要。**

---

### N-01

**矩阵第 11 列仍是 196 × `M5_PENDING_STATIC_OWNER_MAPPING`（上一轮 N-01 未关闭）**

证据：矩阵 col10 分布 `{M5_PENDING_STATIC_OWNER_MAPPING: 196}`；详设 SQL-M5 六表小节收尾句明写「不得保留 `PENDING`」。
影响面：矩阵一列；实质分母已由详设 SQL-M5 小节承载。
最小修复：删除该列，或改为指向详设 SQL-M5 六表小节的固定值。与 S-01 同一处置逻辑，建议一并做。
Dexter 决策：不需要。

### N-02

**`getPublicInvitationView` 在 38 条内、`completePublicInvitation` 不在，但后者实测走 `isEnabled` 0.27/请求**

证据：详设 line 283 的「非 B 协议入口」只列了 `getOperationsWorkspaceLoginEntry` 与 `getPublicInvitationView`；实测 `completePublicInvitation` 命中 `isEnabled` 0.27 次/请求（11 个请求）。
影响面：1 条 public operation；属 M-01 漏列 24 条之一，单列是因为它是唯一的 public 侧遗漏，修 M-01 时容易被"public 只有 view"的直觉再次漏掉。
最小修复：随 M-01 的调用点复算一并纳入。
Dexter 决策：不需要。

---

## 3. 上一轮 findings 关闭核验

| 上一轮 | 结论 | 依据 |
|---|---|---|
| **M-01 症状 A**（`OPERATIONS_SCOPED` 平白多查、暗改 read 语义） | **已关闭** | line 87 移除 `EnabledGroupWorkspaceFact`（cap 2）、strict kind opt-in、§9 无 disabled→403 行。见 §1.1 |
| **M-01 症状 B**（M4 按 face 指派） | **方向已修，集合错** | 改为 source-bound exact set 是对的；集合本身见本轮 M-01 |
| **S-01**（矩阵为 live evidence 声明 sha256） | **已关闭** | 矩阵第 16 行已改为「its digest is intentionally not frozen here and is recorded only by the later BP-U01 snapshot manifest」。处置正确——该输入本就不该有稳定 hash |
| **N-01**（矩阵 M5 列 PENDING） | **未关闭** | 见本轮 N-01 |
| **N-02**（`legacyAllowedImplementations` 无上限） | **已关闭，且比我要求的更好** | line 277 现要求每项含 `owner`、`sourcePath#method`、`reason`、`usedByOperationIds`、`disposition=RETAINED_WITH_REASON\|REMOVE_IN_BP_U06`，且「**实际 legacy-loader/reference scan 与此表必须 exact-set 相等**，后者须有 BP-U06 的 source-absence 退出证明」。exact-set 相等 + 退出证明强于我提的"加个上限" |
| **N-03**（升 kind 逃逸） | **已关闭** | line 87 与 line 302 两处 |
| **N-04**（我自己的 §15 / §14.7.3 待更正） | 待办 | 我的文件，我改，不占 Codex 范围 |

---

## 4. Dexter 的产品问题：任务读要不要校验工作区启用

> 「我觉得是不是在登录获取 session 的时候校验就可以了，其他就没必要了」

**先纠正一个前提**：今天的实际行为不是"只有登录校验"，而是 **登录校验 + 写命令校验 + 任务读不校验**。

**[源码 + 实测]**

- **登录 / 凭证流校验**：`WorkspaceAuthenticationService:66`（密码登录）、`:243`（OTP 取账号）、`WorkspacePasswordRecoveryService:63`/`:162`、`WorkspacePasswordResetService:42`。实测 `operationsWorkspacePasswordLogin` 3.00 次/请求。
- **写命令校验**：`OrganizationHierarchyService:363`、`BusinessEntityService:647`、`OrganizationCommandService:276`/`:308`、`WorkspaceAccountService:44`、`WorkspaceRoleService:190`。实测 `createOperationsOrganizationBrand` 6.00、`saveOperationsCatalogItem` 1.00 等 30 条命令。
- **任务读不校验**：7 个 operations-admin 业务 GET 实测 **0.00 次/请求**。

**所以"其他就没必要了"这半句若照字面执行，要删掉写侧的校验**——那比"给读加校验"改动更大，方向也相反。

**我的建议：保持现状，一行都不用改。**

1. **读不校验是对的，你的直觉对。** 禁用工作区给一个已认证用户返回他本来就能看的数据，不产生新的授权面，窗口被会话生命周期限定；而给读加校验要为 58 条读各加一条 SQL——正是这个包要消灭的东西。
2. **但写必须继续校验。** 禁用的工作区若还能接受新写入，会在一个已停用的租户里持续产生业务数据，事后要么清理要么留下不该存在的记录，比陈旧读难收拾得多。而且写侧本来就要付前置代价，SQL-M4 合并之后它复用同一条 fact，边际成本接近 0。
3. 这条也与 manifest **B.1.13**（会话真相在 owner，缓存只作可丢弃加速）一致：写路径的即时校验保留，读路径不引入新的每请求校验。

**结论：这个性能包不需要引入任何 disabled→403 的行为变更，也不需要单独发起产品/安全行为变更评审。** Codex 本轮的处置（`OPERATIONS_SCOPED` 不含该事实、strict kind 需 source 依据、§9 无新增行）正是这个结论的正确落地，我确认。

**唯一的连带要求**：`getOperationsWorkspaceSessionEntry` 今天实测走 `isEnabled` 1.67 次/请求，它是 B=78 的 task read。**它必须归入 `OPERATIONS_SCOPED_WITH_ENABLED_WORKSPACE`**（有 source 依据：会话装配路径确实校验），否则它的这次读会成为无归属 component 而使门失败。这是"保持现状"的必然结果，不是新增校验。

---

## 4.1 追加裁定输入：Dexter 2026-08-09「停用极罕见，没必要为它加很多逻辑」

Dexter 补充：工作区停用**几年也做不了一次**，不该为它加逻辑。
我按这条重新算账，结论是**方向正确，但今天的现状与它相反，且正确做法是减法不是加法**。

### 4.1.1 现状：为一件几年一次的事，每个请求都在付钱

**[实测]** 全语料 `WorkspaceAdministrationService#isEnabled` 共 **673 次查询 / 37.8 秒**，落在 550 个请求上，平均 56.1ms/次。按会话类型拆分：

| 归属 | 次数 | 耗时 | 占比 |
|---|---:|---:|---:|
| **workspace session 覆盖得到的**（operations-admin 读写） | **598** | **35.1s** | **89%** |
| platform-admin（走 platform session，另算） | 63 | 2.2s | 9% |
| 预认证/凭证流（登录、OTP、密码恢复，发生在 session 之前） | 12 | 0.4s | 2% |

### 4.1.2 Dexter 原推理的事实核验：方向对，前提错

> 「登录的时候，有效的 workspace 才会生成 session，读和写都依赖 session，是不是就已经防止了对无效 workspace 的读写了？」

**[源码]** 三条事实：

1. **停用工作区不撤销已有 session**。`WorkspaceAdministrationService.transitionStatusNew:139-145` 只做 `UPDATE group_workspace SET status=...` 加一条 audit，**完全没有触碰 `workspace_iam.workspace_session`**。
   对照：改密码 `WorkspaceAuthenticationService:237` 会 `UPDATE workspace_session SET status='REVOKED' WHERE account_id=?`，登出 `:223` 同样撤销——**撤销机制存在，只是停用没有使用它**。
2. **session TTL = 8 小时**（`WorkspaceAuthenticationService:36`，`SESSION_TTL_MILLIS = 8 * 60 * 60 * 1000L`）。
3. 因此今天存在一个**最长 8 小时的窗口**：停用之后，已登录用户的读照常返回（读侧无校验），写被 per-command 的 `isEnabled` 兜住。

**所以原推理描述的是应然，不是实然。**

### 4.1.3 但修复是减法，且零额外往返

**[源码]** session 校验 `WorkspaceAuthenticationService#require:244` 的 SQL **已经 JOIN 了这张表**：

```sql
... JOIN platform_workspace.group_workspace gw
      ON gw.workspace_uuid = s.workspace_uuid
     AND gw.group_workspace_key = s.group_workspace_key
WHERE s.token_hash = ? AND s.status = 'ACTIVE' AND s.expires_at_epoch_millis > ?
```

它 JOIN 进来只是为了取 `gw.name`、`gw.operations_title`、`gw.logo_asset_ref` 三个展示字段，
**WHERE 里没有 `gw.status`**。

因此：**在这条已存在的 JOIN 上加一个 `AND gw.status = 'ENABLED'` 谓词，不增加任何一次数据库往返**，
然后把 organization 的 3 处（`OrganizationHierarchyService:363`、`BusinessEntityService:647`、
`OrganizationCommandService:276`/`:308`）与 workspace-iam 的 2 处（`WorkspaceAccountService:44`、
`WorkspaceRoleService:190`）的 per-command `isEnabled` **删除**。

净效果：

- **598 次查询 / 35.1 秒消失**（89%），代码是删的不是加的；
- 语义反而**更强**：读也被挡住，窗口从 8 小时变成 0——**Dexter 原推理由此真正成立**；
- 预认证/凭证流的 12 次**必须保留**（它们发生在 session 之前，没有 session 可依赖）；
- platform-admin 的 63 次走 platform session，不在此谓词覆盖内，**仍由 SQL-M4 处理**。

**与 Codex 现方案的对比**：SQL-M4 是"同请求内多次 `isEnabled` 合并成一次"，最多省 **123 次**；
本方案让其中 598 次**根本不发生**，是前者的近 5 倍，且不需要 `EnabledGroupWorkspaceFact` 这个共享事实
去覆盖 operations-admin 侧。

### 4.1.4 这条对本轮 M-01 的影响

**M-01 的最优修复因此改变。** 若采纳 4.1.3，`EnabledGroupWorkspaceFact` 的适用面从"需要精确到 38 条 / 32 条"
收缩为**只剩 platform-admin 的 63 次那一小块**——M-01 那个"漏了 24 条 organization 侧命令"的问题
**不再需要靠把集合数对来解决，而是那 24 条本身就不该有这次查询**。

因此建议 Codex 的修订顺序是：**先裁定 4.1.3，再回头定 M4 的 exact set**；
否则会先花力气把一个即将大部分消失的集合数准。

### 4.1.5 Dexter 裁定（2026-08-09）：**自然过期即可**

> 「停用之后，自然过期即可。」

**裁定内容**：不给 `require:244` 增加 `gw.status='ENABLED'` 谓词；停用后已存在的 session
在其剩余生命期内（最长 8 小时）继续有效，靠自然过期收口。

**据此确定的处置**：

1. **删除 session 之后的全部 `isEnabled` 校验**——organization 3 处
   （`OrganizationHierarchyService:363`、`BusinessEntityService:647`、`OrganizationCommandService:276`/`:308`）
   与 workspace-iam 2 处（`WorkspaceAccountService:44`、`WorkspaceRoleService:190`）。
   实测消除 **661 次查询 / 37.3 秒**（598 次 workspace session 侧 + 63 次 platform-admin 侧）。
2. **保留登录与凭证流的 12 次**（`WorkspaceAuthenticationService:66`/`:243`、
   `WorkspacePasswordRecoveryService:63`/`:162`、`WorkspacePasswordResetService:42`）——
   它们发生在 session 之前，是"有效 workspace 才发 session"这条规则的唯一执行点，**不得删**。
3. **不加 session 谓词**，`require:244` 的 WHERE 保持原样。

**必须登记进 §9 的行为变更（这是一次放宽，须明写）**：

停用工作区后，已存在的 session 在剩余生命期内**不仅可读，而且可写**。
今天写是被 per-command `isEnabled` 挡住的，删除后不再挡。窗口上界 = `SESSION_TTL_MILLIS` = 8 小时。
登录侧不变：停用后无法建立新 session，因此窗口是**单调收敛**的，不会因为新登录而延长。

**Dexter 已在知情下裁定接受**，理由是该动作几年一次；我记录该判断的适用条件与反例边界：

- 适用条件：停用的动机是**商业性**的（停止合作、欠费、租户退出）。此时让在场操作员在剩余会话内
  完成手头工作，代价可接受且可能是期望行为。
- **反例边界**：若将来出现「因安全事件紧急停用」的需求，**正确做法是撤销 session**——
  该机制已存在（`WorkspaceAuthenticationService:223` 登出、`:237` 改密码均执行
  `UPDATE workspace_session SET status='REVOKED'`），只需在 `transitionStatusNew` 里按 workspace 撤销即可，
  **而不是回头给每个命令重新加 `isEnabled` 校验**。本条写入设计以防未来退回原路。

### 4.1.6 对本轮 M-01 / S-01 的影响

采纳 4.1.5 后，`EnabledGroupWorkspaceFact` 在 **operations-admin 与 platform-admin 两侧都不再需要**——
那 661 次查询直接消失，不是"合并成一次"。因此：

- **M-01 由"把 38 条集合数准"变为"把这些调用点删掉"**，不再需要精确 exact set；
- **SQL-M4 应当整体重写或撤销**：它原本的目标（同 key/request 一次 owner-local load）在删除之后无对象。
  若仍保留 SQL-M4 编号，其内容应改为「`isEnabled` 调用点退役 + 登录/凭证流 5 处保留举证」，
  适用面为被删除的 5 个调用点及其覆盖的 operation，而不是一个共享事实的适用面；
- **S-01（矩阵 M4 列为 0 行）随之自然消解**——M4 若改为退役项，本就不需要 per-operation 适用面列。

**修订顺序建议**：先落 4.1.5 的退役处置，再回头处理 M-01 与 S-01；否则会先花力气去数一个即将消失的集合。

### 4.1.7 原「需要 Dexter 拍的一句」（已裁定，存档）

**停用之后，已登录用户是立即失效（401 重登），还是等 8 小时自然过期？**

我建议**立即失效**，理由三条：它是免费的（谓词加在已有 JOIN 上）；它正是 Dexter 原话描述的语义；
停用几年一次，行为变更的实际影响面接近零。

这仍然是一项**行为变更**（禁用工作区下已认证会话由"读照常/写被拒"变为"读写统一 401"），
须登记进 §9 并同步 API/L2 negative case。它**不属于**性能优化的暗改——是 Dexter 明确要的语义，
按第三轮的约定作为独立的产品/安全变更登记，只是它恰好与性能收益同向。

---

## 5. 结论与授权边界

**NO-GO**（M=1，S=1，N=2）。

本轮关闭了上一轮的症状 A、S-01、N-02、N-03，其中 `legacyAllowedImplementations` 的处置（exact-set 相等 + BP-U06 source-absence 退出证明）比我提的方案更强。「已认证 operations task read 未被暗改为 disabled→403」经我核验**属实**，这一点可以放心。

剩下的 M-01 是一处可由源码复算的集合错误：`isEnabled` 是 `WorkspaceStatusLookup` 的接口方法，调用点分布在 organization（3 处）与 workspace-iam（5 处）两个模块，而 exact set 是按 `WorkspaceAdministrationService` 的直接消费者推的，因此漏掉了 organization 侧的全部 operations-admin 命令路径——包括三条 6.00 次/请求、全语料该表最高的单请求重复。修复是把推导基准换成"接口方法的全部调用点"，并把"读该表但非启用门"的四条显式排除。

**需 Dexter 决策：无，已裁定**。见 §4.1.5：Dexter 裁定「自然过期即可」。
据此，session 之后的全部 `isEnabled` 校验（5 个调用点、实测 661 次 / 37.3 秒）**退役**，
登录与凭证流的 5 处保留，`require:244` 不加谓词。
放宽后果（停用后剩余会话最长 8 小时内可读**且可写**）须登记进 §9；
安全事件场景的正解是撤销 session（机制已存在），不得回头给命令重加校验。

注意 §4 与 §4.1 的结论并不矛盾：§4 说的是"不要给任务读**新增** per-request 校验"，
§4.1 说的是"把已有的 per-command 校验**上移到已存在的 session JOIN 上并删除**"。两者都指向更少的 SQL。

**授权边界**：本结论仅为 DESIGN 复核，只决定是否可申请下一步 implementation authorization。它**不**授权代码实施、契约变更、数据库或迁移、运行环境、DEV、reset/seed、L2/UAT 或任何仓库控制动作。
