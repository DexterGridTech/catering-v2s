# 后台性能重构 implementation-facing 详设 —— Claude 第五次复核

`VERDICT=GO`　`M=0`　`S=0`　`N=1`

## 0. 会话出处与独立性

1. 本会话**不是 fresh v2s-rooted 会话**，是续接；冻结输入之一（方案）由我产出，且本轮 `BP-U07` 已 pin 到我修订后的字节。
2. 所有 hash、门、registry 计数、语料聚合与**源码方法级归属**均在本会话 fresh 复算，未采信任何文档自报值。
3. 本仓评审期间零写入，除本文件。

**门与 hash**：`implementation-design-granularity` fresh 复跑 **PASS**（UNITS=7）；
manifest 的全部声明 hash（design、authorization、intake、7 个 unit 的全部 approvedSources）**逐个复算一致**；
`BP-U07` pin 的方案 hash = `b9126afa2640ef15…`，**与我交付的修订版一致**。

---

## 1. SQL-M4 收缩的逐项核验（本轮重点）

### 1.1 5 个 post-auth call-site group / 6 个直接表达式 —— **精确正确**

我按 `workspaces.isEnabled` 在主源逐行定位并解析其**外层方法名**，与详设 line 283 的点名逐条对撞：

| 详设点名 | 实际方法名 | 行 | 结论 |
|---|---|---:|---|
| `OrganizationHierarchyService#requireWorkspace` | `requireWorkspace` | 363 | 一致 |
| `BusinessEntityService#requireActiveWorkspace` | `requireActiveWorkspace` | 647 | 一致 |
| `OrganizationCommandService#isEnterableCommercialGroup` | `isEnterableCommercialGroup` | 276 | 一致 |
| `OrganizationCommandService#requireEnabledWorkspace` | `requireEnabledWorkspace` | 308 | 一致 |
| `WorkspaceAccountService#requireEnabledWorkspace` | `requireEnabledWorkspace` | 44 | 一致 |
| `WorkspaceRoleService#requireWorkspace` | `requireWorkspace` | 190 | 一致 |

**5 个 service group、6 个表达式，方法名一处不差。**

### 1.2 5 个 pre-auth 表达式 / 7 条 credential-flow operation —— **精确正确**

| 详设点名 | 实际方法名 | 行 |
|---|---|---:|
| `WorkspaceAuthenticationService#authenticatePassword` | `authenticatePassword` | 66 |
| `WorkspaceAuthenticationService#accountByMobile` | `accountByMobile` | 243 |
| `WorkspacePasswordRecoveryService#start` | `start` | 63 |
| `WorkspacePasswordRecoveryService#enabledAccount` | `enabledAccount` | 162 |
| `WorkspacePasswordResetService#reset` | `reset` | 42 |

**6 + 5 = 11，与主源 `workspaces.isEnabled` 的表达式总数完全相等**——退役集与保留集**穷尽且不相交**。

7 条 credential-flow operation 逐条在 196 分母中存在：
`operationsWorkspacePasswordLogin`、`sendOperationsWorkspaceOtp`、`verifyOperationsWorkspaceOtp`（operations-admin POST），
`startOperationsPasswordRecovery`、`verifyOperationsPasswordRecoveryOtp`、`completeOperationsPasswordRecovery`（public POST），
`requestWorkspaceCredentialReset`（platform-admin POST）。

**`sendOperationsPasswordRecoveryOtp` 被排除是对的**——我验了 `WorkspacePasswordRecoveryService#sendOtp:78`：
它走 `requireActive` 与 `otpLimits.beforeSend`，**全程没有 `isEnabled` 调用**。
（上一轮详设的 38 条里曾包含它，本轮剔除，剔得对。）

### 1.3 不得误归的三类 —— **区分正确**

- **`WorkspaceAdministrationService#requireEnabled:80-82`** 是**另一个方法**（`if (!"ENABLED".equals(workspace.status())) throw new WorkspaceDisabledException();`），
  生产调用点全部在 platform edge controller：`PlatformOrganizationOverviewController`、`PlatformContractOverviewController`、
  `PlatformWorkspaceAccountController`、`PlatformWorkspaceInvitationController`、`PlatformExtensionDefinitionController`、
  `PlatformWorkspaceRoleController`、`PlatformAuditHistoryController`、`ManagedInvitationBootstrap`。
  详设 line 287 把它排除在 M4 之外并保留既有 `403 PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED`——**正确**。
- **session display join**：`WorkspaceAuthenticationService#require:244` 的 JOIN 只取
  `name` / `operations_title` / `logo_asset_ref`，WHERE 无 `gw.status`；详设明写保持现状——**正确**。
- **CAS 前置 / 详情投影的 group_workspace 读取**（`createPlatformGroupWorkspace`、
  `transitionPlatformGroupWorkspaceStatus`、`updatePlatformGroupWorkspaceDisplay`、`initializeCommercialGroup`）
  已被 line 287 末句显式排除——**这正是我上一轮警示的反向坑，本轮堵住了**。

### 1.4 `completePublicInvitation` —— **Codex 对，我上一轮的 N-02 措辞错了**

我核了 `WorkspaceInvitationService`：**全文 0 处 `workspaces.isEnabled`**。
我上一轮实测到它 0.27 次/请求命中 `isEnabled`，那是**间接经由被退役的 group**（`roles.require` 链路）产生的运行时事实，
**不是它自己的直接调用**。因此它**不应**被塞进 pre-auth 保留集——退役后自然消失，无需任何条目。

**这一条我记为自己的错**：上一轮 N-02 写「随 M-01 的调用点复算一并纳入」而未区分"纳入哪个集合"，
措辞会诱导把一条运行时间接命中当成需要保留的直接调用。Codex 的纠正准确。

### 1.5 完成判据的形状 —— **比枚举 operation 更强**

详设 line 277 把 SQL-M4 从 `factImplementations[]` 中**剥离**，改为独立
`sourceRetirements[]`：`retiredPostAuthCallSiteGroups`（5 group / 6 direct expressions）与
`retainedPreAuthExpressions`（5 direct expressions），完成条件分别是
**production source scan 为零** 与 **exact-set 相等**。

这个形状解决了我第三、四轮反复提的问题：**判据不再依赖"把适用 operation 集合数准"**，
而是"这 6 个表达式在生产源码中不存在、那 5 个原样存在"——按构造保证覆盖，任何调用链路都无法遗漏。
矩阵第 9 列因此**不再需要承载 M4**，我上一轮的 S-01（M4 适用面 0 行 = 空分母恒真）**随之消解**，
不是被绕过。

---

## 2. 平台侧 403 未被裁定波及 —— 逐条核验通过

Dexter 的裁定只覆盖 operations session，详设正确地没有外溢：

- `EnabledSelectedWorkspaceFact = {workspaceUuid, groupWorkspaceKey, status=ENABLED}`（line 87），
  命名由 `EnabledGroupWorkspaceFact` 改为 `EnabledSelectedWorkspaceFact`，**主源零残留旧名**——
  改名让"平台 selected-workspace 解析"与"operations 状态门"在语义上不再可能混淆。
- **15 条平台 B read** 逐条核验：全部为 `GET` / `platform-admin` / `TASK_READ`，一条不差。
- **未覆盖的 5 条平台 B read** 我独立列出，与详设的反例声明一致：
  `getPlatformGroupWorkspaceDetail`（可查看 DISABLED workspace）、`listPlatformGroupWorkspaces`（无 selected workspace）
  是详设点名的反例；`getPlatformAdminDetail`、`getPlatformAdminPage` 是平台管理员自身、本无 workspace scope；
  `getPlatformEntityAuditHistory` 按 line 87 只在
  `WORKSPACE_ROLE|WORKSPACE_ACCOUNT|WORKSPACE_INVITATION|EXTENSION_DEFINITION|STORE_CONTRACT`
  **5 个 conditional branch** 使用。**20 = 15 + 4 反例 + 1 条件使用**，闭合。
- 「详情/列表反例不得被强行加门」由 line 306「其余平台读取不能被强制加 enabled gate」承接。
- audit 的条件分支与 `ReadContextKind` 的 cap 语义相容：cap 是上限，非条件分支下实际值低于 cap 是正确结果（line 87 末句）。

---

## 3. 其余点名项

| 核验项 | 结论 | 依据（本会话复算） |
|---|---|---|
| SQL-M1～M6 抽象层级 | **通过** | 「owner 内的有限事实 loader / 批量 judgment → 具名 operation adapter → edge binding」保留；`factImplementations[]` 七元组保留；**M1 两 mode 并集恰为 128、M2 恰为 128**；「128 个 adapter 不得直接 JDBC，也不得引用 legacy loader」保留 |
| 196 行覆盖矩阵 | **通过** | 196 行；`MEASURED_SEED` 55 / `MEASURED_HISTORICAL` 105 / `UNMEASURED` 36 / `MEASURED_NEW_FIXTURE` 0；`NOT_GET` 113 / `TASK_READ` 78 / `PROTOCOL_READ_EXEMPT` 5；未测 GET = 15 |
| M5 placeholder 物理移除 | **通过** | 矩阵由 11 列降为 **10 列**，`M5_PENDING_STATIC_OWNER_MAPPING` 整列消失；六表逐行处置仍在详设 SQL-M5 小节 |
| C5 两个 POST 未新增第 80 条 | **通过** | line 239 与 line 243：两 command 已在 74 条 workspace normal rows，「C5/C6 新增第 80 条数值行均为红」；**79 = 74 + 5 未变** |
| B.6.6 request-scope / ReadContext / EXISTS | **通过** | request-scope 冻结；`ReadBudgetComponent` 闭集精确相加、越 cap 或 `UNCLASSIFIED>0` 即失败；「祖先/范围使用 `EXISTS` 融入主语句」保留 |
| 授权 / CAS / readback / BOM 语义 | **通过** | SQL-M1 的 `r.status='ENABLED'` 等七条保留项在；SQL-M3「不得将写后 readback 与 CAS 合并为同一个陈旧 snapshot」在；SQL-M6「原行序第一个 failure、scope/版本/CAS、同一 `REQUIRED`、catalog 不直查 inventory」与 **BOM 行数 ≥10 的具名 fixture** 在 |
| live evidence digest 仅由未来 snapshot 冻结 | **通过** | 矩阵第 16 行：「its digest is intentionally not frozen here and is recorded only by the later BP-U01 snapshot manifest」 |
| budget kind 不可升格逃逸 | **通过** | line 87「不得把 operation 升为严格超集 kind 来换取更大 cap」+ line 306「strict-superset kind 必须因缺少 source/行为依据而失败」 |
| §9 行为变更登记 | **通过** | 新增行明写「会话剩余至多 8 小时内**可读且可写**」「停用后不能创建新 operations session，窗口因自然过期单调收敛」「平台 selected-workspace 既有 403 不变」，并含适用条件与安全事件反例边界 |
| §8 红夹具覆盖 | **通过** | `SQL merge target` 行新增「SQL-M4 恢复任一 post-auth guard、删除任一 pre-auth guard 或把 platform `requireEnabled` 误列为 M4」 |
| design-only | **通过** | `EnabledSelectedWorkspaceFact`、`WorkspaceReadAuthorizationFacts`、`VisibleOrganizationFacts`、`ResolvedBomTargets`、`sourceRetirements`、`backend-performance-budget`、`backend-performance-sql-merge-applicability` 在 `apps/backend` / `contracts` / `scripts` 命中 **0** |

## 3.1 我上一轮四项 findings 的关闭

| 上一轮 | 结论 |
|---|---|
| **M-01**（38 条 exact set 与源码/实测交集仅 8） | **已关闭**。改为 6 + 5 的表达式级分解，方法名逐条核验一致，且 11 = 主源表达式总数，穷尽不相交 |
| **S-01**（矩阵 M4 适用面 0 行 = 空分母恒真） | **已关闭**。M4 剥离为 `sourceRetirements[]`，判据是 source scan 为零 / exact-set 相等，矩阵本就不需承载 |
| **N-01**（矩阵 M5 placeholder 列） | **已关闭**。整列物理移除 |
| **N-02**（`completePublicInvitation`） | **已关闭，且我错**。见 §1.4 |

---

## 4. Finding

### N-01

**`isEnterableCommercialGroup` 退役后语义变化未留标记，未来 pre-auth 调用者可能误用**

**证据**：`OrganizationCommandService#isEnterableCommercialGroup:274-282`——
它是一个**返回 boolean 的判断**而非抛异常的 guard，当前实现第一行即
`if (!workspaces.isEnabled(workspaceUuid, groupWorkspaceKey)) return false;`。
生产消费者只有 `OrganizationTaskPathService:142`（task path 可用性计算），属 post-auth，在裁定范围内。

**有限影响面**：1 个方法、当前 1 个消费者。**不影响本轮任何完成判据**——
退役后 `availableAssignments` 与 `selectContext:125` 的行为变化都落在
「已有 operations session 剩余窗口内可继续」的裁定内；登录侧由保留的
`authenticatePassword:66` 阻断，不受影响（我已核验登录路径在 `authenticatePassword` 之后才用到 enterable）。

**风险**：退役后该方法对已停用工作区将返回 `true`。方法名 `isEnterableCommercialGroup`
读起来像是包含"工作区是否可进入"的完整判断；**将来若有 pre-auth 调用者接进来，会静默得到错误答案**。

**最小修复**：删除该行时一并在方法上留一行契约注释（或重命名为
`isExistingCommercialGroupInScope` 之类去掉 "enterable" 的暗示），写明
「本判断不含工作区启用状态；启用状态由 `authenticatePassword` / `accountByMobile` 在 session 建立前把关」。
一行注释即可，不需要额外结构。

**Dexter 决策：不需要。**

---

## 5. 结论与授权边界

**GO**（M=0，S=0，N=1）。

这一轮的核心——SQL-M4 的收缩——我按**方法级**而非 operation 级逐条复算：
6 个 post-auth 表达式与 5 个 pre-auth 表达式，方法名一处不差，且 **6 + 5 = 11 恰等于主源
`workspaces.isEnabled` 的表达式总数**，退役集与保留集穷尽且不相交。
`requireEnabled`、session display join、CAS/详情投影读取三类误归全部排除。
`sendOperationsPasswordRecoveryOtp` 的剔除与 `completePublicInvitation` 的不纳入，我独立验证后确认 Codex 对、我上一轮的 N-02 措辞错。

更值得记的是**判据形状的改进**：把 SQL-M4 从 `factImplementations[]` 剥离为独立 `sourceRetirements[]`，
判据从"把适用 operation 集合数准"变成"这 6 个表达式在生产源码中不存在、那 5 个原样存在"。
这按构造保证覆盖，任何调用链路都无法遗漏——它同时消解了我第三、四轮反复提的空分母与集合错配问题，
是本设计三轮以来最实质的一次结构性改进。

平台侧 403 未被裁定波及：15 条平台 B read 逐条核验，20 = 15 + 4 反例 + 1 条件使用，闭合。
§9 把「可读**且可写**」这个放宽明写而非含糊，并带上适用条件与安全事件反例边界。
196 分母、C5 的 79、B.6.6 三机制、抽象层级、live digest、升格逃逸、design-only —— 逐项复算通过。

唯一的 N 是一行注释级别的建议，不阻断。

**需 Dexter 决策：无。**

**授权边界**：本结论仅为 DESIGN 复核，**只决定可以申请下一步 implementation authorization**。
它**不**授权代码实施、契约变更、数据库或迁移、运行环境、DEV、reset/seed、L2/UAT
或任何仓库控制动作；静态 review 不授权下一 Roadmap step。
实施仍须由 Dexter 单独授权，且授权后第一批交付（`BP-U01`）必须先产出内容寻址 evidence snapshot，
之后的覆盖状态才可离开 `UNMEASURED_BLOCKS_OPTIMIZATION`。
