# v2s 后台性能重构与治理方案

状态：`PROPOSAL_AWAITING_REVIEW` —— 交 Dexter 与 Codex 评审。未实施任何改动。

本文是**结论稿**，是 Codex 详设的输入。所有仓内事实标注 `文件:行号`；
所有运行时数字来自 `.runtime/r5/evidence/db-operations.jsonl` 的独立复算。

---

## 0. 目标

**回到已裁决的设计目标，并建立防止再次偏离的门。**

`doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md` **§3.5「任务型读取」**
已批准「默认每个 surface `databaseOperationCount <= 3`」。

**该预算的适用范围限于任务型 read model surface，不适用于 command。**
（前一版本把它套到全部 196 个 operation 并用 `saveOperationsCatalogItem` 31.1 条/请求举证——
那是 command，不在 §3.5 管辖内。此处更正。）

- **任务型读取**：`getOperationsCatalogItem` 15.0 条/请求，对 `<=3` **超标 5 倍**，属确凿违规；
- **command**：无统一硬阈值。改为**逐 operation 按正常 fixture 实测声明**，
  以「同一 fixture 下不得回归」为门，而非统一上限。

**读侧论据不受部署拓扑影响**——同机部署同样超标。性能改善是副产品，不是目标。

**预期（C7 撤回、C4 降级为候选后重算）**：

| 项 | 状态 | 收益 |
|---|---|---|
| C1 事务合并 | 可承诺 | 71–134ms/请求 |
| C2 会话读四合一 | 可承诺 | 74,431ms（8.6%） |
| C3 capability/scope 合一 | 可承诺 | ≈17,600ms（2.0%） |
| C5 满分母去重 | 可承诺 | 40,676ms（4.7%） |
| C6 字典 N→1 | 可承诺 | 0.42%（随条目数放大） |
| C4 catalog 保存 | **候选** | 上限 6.7%，**实际待逐分支对账** |
| ~~C7~~ | **撤回** | 原计 5.6%，**已从总账剔除**（§9 J2） |

**可承诺区间 −25% ~ −30%**（隧道拓扑）；C4 对账结果确定后上修，上限不超过 −35%。
**不再沿用前一版本的 −35% ~ −42%。** 同机拓扑下按 §10 缩水。

> **2026-08-09 补充口径**：上表是**按项**的估算。§14 用 `statementId`/`callSite` 级证据
> 对**同一件事换了个分母重算**：以 196 条接口为分母、按"同请求内同一张表被读几次"聚合，
> 结论是**一个 operations-admin 业务请求约 40% 的 SQL 是重复读**（中位 20 条里有 9 条）。
> 两者不矛盾——上表是分项估算，§14 是自底向上的实测上界。
> **验收一律以 §14.5 的"必须达到声明目标值"为准，不以本表的百分比为准。**

---

## 1. 病因与优先级

**排序：事务边界 > 跨层重复取数 > 单条 SQL 效率。**

| 连接作用域类别 | n | 均值 |
|---|---:|---:|
| 事务作用域·首条语句 | 3,850 | 62.49 ms |
| 事务作用域·后续语句 | 13,279 | 34.50 ms |
| autocommit 作用域·首条语句 | 519 | 35.05 ms |

autocommit 首条无溢价，且溢价在请求内第 1..8 个作用域均匀分布不衰减
→ 排除连接冷启动与隧道 Nagle，**溢价绑定在 `BEGIN` 上**。

**每多开一个只读事务 ≈ 64ms（BEGIN 28.9 + COMMIT 34.8），与它跑几条语句无关。**
实测每请求 4.71 个连接作用域。**合并一条 SQL 值 34.5ms，合并它所在的事务值 64ms。**

**计数不是延迟的代理指标**：`GET_CONNECTION` 4,515 次共 994ms（0.2ms/次，连接池健康）、
`SET_AUTO_COMMIT` 3,996 次共 3ms，二者占次数 28.6%、占耗时 0.1%。
**后续排序与验收一律以耗时为主指标**；历史的 44/36 与本轮的 69/61 口径已变、不可比。

**evidence 必须先冻结**：同一文件曾被测得 29,714 / 31,082 / 31,214 / 31,458 行，
request 数 872 / 1,019 / 1,034——它是活的追加目标。**未冻结前任何占比口径的门都是空的。**

---

## 2. 方向

**不做 greenfield 重写。** 理由是知识风险而非工作量：18 条 v6 差异、C-16/C-17/C-19 裁定、
七形态派生、九类兼容矩阵，是评审换来的**决策**而非代码，重写意味着逐条重新推导，
每次推导都是一次静默丢失的机会。

**做法：就地按新模式逐 operation 重构，以现有 100 条 API + 43 条 L2 为安全网。**
重写结构、保留语义，每步有测试兜底。

- **保留**：contract、前台、各 owner 的业务语义实现。
- **推倒重做**：edge→owner 之间的授权前置层。它不承载业务语义、被所有功能共享、
  且每加一个功能都会复制现有模式。
- **外科手术**：`CatalogOwnerService` 拆解、8 receipt + 6 audit 收敛、catalog 保存路径、
  字典全表扫、三道现红的门。

---

## 3. 服务写法：operation-per-handler

### 3.1 现状

`CatalogOwnerApi:10`：

```java
JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId);
```

全字符串与无类型 JSON；`CatalogOwnerService` 内 **65 个 `case "..."` 分支、2,007 行、
最长一行 2,816 字符、超 200 字符的行 126 条**。

项目同时拥有生成的 route registry、assertion matrix（每 operation 的
`logicSteps`/`callChain`/`conditionToProblem`/`normalPathDbOperations`）与生成的 wire 类型——
**契约层类型齐备，到 owner 边界全部丢弃**。后果：编译器无法校验（「42 operation exact-set」
那道门存在的唯一理由就是补编译器的缺）；**没有位置挂 per-operation 约束**
（这正是 `normalPathDbOperations` 从 P2 挂到 P4 从未被执行的根本原因）；
单个 operation 无法独立测试。

### 3.2 目标形态

```java
// 读 handler：使用轻量读上下文，声明 BUDGET（§3.5 适用）
final class GetCatalogItems implements CatalogReadOperation<CatalogItemPageQuery, CatalogItemPage> {
    static final OperationBudget BUDGET = OperationBudget.of(3);
    CatalogItemPage handle(ReadContext context, CatalogItemPageQuery query) { ... }
}

// 命令 handler：使用 command-only 的 ExecutionContext（§3.3），声明的是实测基线而非上限
final class SaveCatalogItem implements CatalogCommandOperation<CatalogItemSaveRequest, CatalogItemSaveReadback> {
    static final MeasuredBaseline BASELINE = MeasuredBaseline.fromFixture("FIXTURE-...");
    CatalogItemSaveReadback handle(ExecutionContext context, CatalogItemSaveRequest request) { ... }
}
```

**绑定形态（硬约束）**：`operationId → handler` 必须是**生成期静态绑定、owner-local、exact-set**——
由代码生成产出编译期可见的绑定表，**每个 owner 只绑定自己的 operation**。

**明令禁止**：运行期动态 registry、service locator、反射查找、
以及任何跨 owner 的全局编排点。理由有二：动态查找会把「编译器接管 exact-set」这一核心收益
直接抵消回去；跨 owner 的全局编排点会形成新的隐式耦合中心，
与 `MODULE_OWNER_SOVEREIGNTY` 冲突。

由此：

- **门从量外形变为量结构**：「registry 中每个 operationId 恰有一个 handler，
  且无 handler 处理多于一个 operation」——机器可判、**无法通过拆文件作弊**；
- **预算门变得平凡**：`BUDGET` 就在 handler 上；
- **scope 作为 typed 参数传入**，handler 没有理由自己查库。
  与被否决的请求作用域上下文的区别是：**不是所有层都要认识的上下文袋子，是一个边界上的显式参数**；
- 编译器接管 exact-set。

**handler 迁移范围：全量 196**（分母 A）。但**数值声明按三分母分治**（§13.1）：
read handler 声明 `BUDGET`（分母 B）；本轮触及的 command handler 声明具名 fixture 的
`MeasuredBaseline`；**未触及的 command 不声明任何数值**。三者各自 exact-set 对账，禁止互相套用。

### 3.3 `ExecutionContext`：完整定义（`CatalogScope` 不足以替代）

§3.6 明文要求「command 签名必须接收 `ExecutionContext`，禁止以裸 boolean 传递
`allowed/authorized/filtered`」。前一版本写的 `CatalogScope` 只是范围投影，
承载不了可信来源与重核契约，**予以更正**。

**创建时机**：**在命令事务内、作为该事务的首批读**创建（§3.6 第 1 条字面要求）。
不得在事务外创建后带入，不得复用页面加载期的任何快照。

**不可变性**：创建后 immutable，无 setter、无 rebuild；任何需要"更新"的场景一律视为设计错误。

**适用范围：command-only。** 任务型 read 使用更轻的读上下文，不承载 grant 绑定，
两者不得互相替代，也不得共用同一类型。

**字段与可信来源**（每个字段必须标注来源，非可信来源一律拒绝进入）：

| 字段 | 可信来源 | 禁止来源 |
|---|---|---|
| `workspaceUuid` / `groupWorkspaceKey` | 会话行（服务端） | 请求体、header、路径参数 |
| `accountId` | 会话行 | 同上 |
| `assignmentId` / `roleId` | 会话行 + `role_assignment` 活跃校验 | 客户端提交 |
| `pageAccessKeys` / `capabilityKeys` | `workspace_role`（须带 `status='ENABLED'` 谓词） | 客户端提交、缓存快照 |
| `scopeNodeType` / `scopeNodeId` | `role_assignment` 的活跃 scope | 客户端提交 |
| `taskPath` | organization owner 的 judgment 结果 | 跨 schema join |
| `resolvedAt` | 事务内时钟 | — |
| `consumerFace` | 生成期 route registry 的 `consumerFaces`（服务端解析路由后得出） | 请求 header、客户端声明 |
| `operation` | 生成期静态绑定的 operationId（非字符串参数） | 请求体、路径中的自由字符串 |
| `contextVersion` | 会话行的 `context_version` | 客户端提交 |
| `authorizationRevision` | 本次解析所依据的 assignment/role 版本号 | 客户端提交、缓存 |
| `correlationId` / `requestId` | edge 诊断链（服务端生成） | 客户端提交的可覆盖值 |
| **`ownerGrant`** | **见下** | **任何客户端来源** |

**`ownerGrant` 的不可伪造要求**：`ExecutionContext` 必须携带**当前 owner grant 的
requirement / capability / target 三元绑定**，且该绑定**不可由调用方构造或篡改**：

- 它是**封装类型**（非 record 裸字段、非 map、非 boolean），只能由授权解析组件在事务内创建；
- 它同时绑定 **requirement**（本次 operation 声明需要什么）、
  **capability**（当前 role 实际持有什么）与 **target**（本次操作指向哪个对象/范围）——
  三者缺一即无法判定，**不允许只传 capability 而由 owner 自己推 target**；
- owner 只能**读取并校验**该绑定与自身对象事实是否一致，**不能重建或放宽**它；
- 类型系统上不提供任何从外部数据构造该绑定的公开入口。

**receipt replay 与重核的顺序（硬约束）**：
幂等回执命中、走 replay 分支时，**owner 仍必须先完成对象事实重核，再返回回执**。
理由：回执记录的是「上次执行的结果」，不是「本次调用者仍被授权」——
跳过重核会让一个已失去授权或对象已变更的调用者拿到历史成功结果。
**红夹具 RF-13 覆盖此项**：授权已变更 / 对象状态已变更的前提下重放同一 idempotencyKey，
必须先失败于重核，而不是返回历史回执。

**逐 owner 迁移矩阵**（详设产出，本文给出必须填的列）：
每个 owner 一行，列出：当前接收的参数形态 → 迁移后的 `ExecutionContext` 字段依赖、
该 owner 需要重核的对象事实清单、该 owner 现存的 IAM 查询（迁移后必须为零）、
receipt replay 分支的重核顺序改造点、以及旧签名的退出批次。


**传递**：作为 command/query 签名的**显式首参**逐层传递。
**禁止** ThreadLocal、请求作用域 bean、上下文袋子等隐式通道——
那正是被否决的 RequestFacts 形态。

**owner 的 object-fact recheck 契约**：owner 收到 `ExecutionContext` 后
**不得再查 IAM**（§3.6 明文），但**必须**基于该 context 重核**对象事实**：
目标对象是否存在、状态是否允许该操作、来源归属是否匹配、
`revision`/`version` 是否与请求一致、以及本 owner 的业务不变量。
**这两件事不可互相替代**：跳过对象重核 = 信任了 edge 的对象判断；
增加 IAM 重查 = 制造同一命令内的授权快照撕裂。

**旧路径退出**：`ExecutionContext` 落地后，以下旧形态必须删除而非并存——
owner API 中接收裸 `dataNodeRef`/`brandRef` 字符串对的签名、
以 boolean 传递授权结论的参数、以及 owner 内部对 IAM 表的任何查询。
退出以「旧签名在代码库中不存在」为准，不以「没人调用」为准（见 §7.1 的旧路径消失门）。


#### 3.3.1 `CatalogAuthorizationScope`：catalog 的服务端品牌范围（不可省略）

**问题**：今天 `brandRef` 由 `CatalogScopeLookup.requireCatalogBrand(...)` 这个
**judgment API** 在服务端解析得出——它不是请求参数，是判定结果。
若按 §7.1 删除裸 `dataNodeRef`/`brandRef` 字符串对签名而不给该判定安排落点，
**这个服务端判定就丢失了**，brandRef 会退化成"从哪儿来都行"的字符串。

**因此 command-only 的 `ExecutionContext` 必须封装一个不可变的
`CatalogAuthorizationScope`**，由授权解析组件在事务内创建：

| 字段 | 内容 | 可信来源 |
|---|---|---|
| `dataNodeType` / `dataNodeId` | 本次操作的数据节点 | 会话 scope（服务端） |
| `brandRef` | **`requireCatalogBrand` 的判定结果** | organization owner 的 judgment API |
| `judgmentSource` | 产出该 brandRef 的 judgment 标识与其 revision | judgment API 返回值 |
| `copyRole` | `NONE` / `COPY_TARGET` / `COPY_SOURCE` | 由 operation 的静态语义决定，非请求字段 |
| `copySourceDataNodeId` | 仅当 `copyRole=COPY_TARGET` 时存在，**由 `resolveCatalogCopySource` 判定得出** | organization owner 的 judgment API |

**构造约束（硬性）**：

- **禁止**从 header、body、path 直接构造或覆盖其中任何字段——
  包括 `brandRef` 与 `copySourceDataNodeId`；
- 只能由授权解析组件在**命令事务内**创建，无公开构造入口、无 setter；
- `copySourceDataNodeId` **必须**来自 organization owner 的判定，
  不得取自请求（这正是 P2 M-01 修复过的缺陷，不得因本次重构而回退）；
- owner 拿到该 scope 后只能**读取并与自身对象事实比对**，不得重建、放宽或改写。

**与 §7.1 退出表的衔接**：裸 `dataNodeRef`/`brandRef` 字符串对签名的退出，
**必须以 `CatalogAuthorizationScope` 先行落地为前提**；
两者不得分批——先删签名后补 scope 会在中间态丢失服务端判定。
退出判据仍是「旧签名在代码库中不存在」，但**增加一条前置**：
该 owner 的所有 catalog 相关 command 已改为接收 `CatalogAuthorizationScope`。

**红夹具 RF-15**：尝试用 header / body / path 提供的 `brandRef` 或 `copySourceDataNodeId`
覆盖判定结果 → 必须失败（编译期不可达或运行期 typed failure），且门必红。

---

## 4. 六问裁定

### 4.1 合并

| # | 项 | 位置 | 收益 | 保留的正确性成本 |
|---|---|---|---|---|
| C1 | 前置链 3 个真事务 → 1 | 6 个 edge 控制器 + `WorkspaceCapabilityScopeResolver` | 134ms/请求 | 见 §9 J1 |
| C2 | 会话读四查合一 | `WorkspaceAuthenticationService:244/:162/:298` + `WorkspaceRoleService:145` | 74,431ms（8.6%），最大单笔 | §4.1.1 三格判定表 |
| C3 | capability 重核与 assignment scope 合一 | `WorkspaceCapabilityScopeResolver:180` + `:123` | ≈17,600ms（2.0%） | 只在 resolver 内加私有方法，**不改 `requireActiveScope` 本身** |
| C4 | catalog 保存的 `loadItems`×3 / `generation`×2 **削减候选** | `CatalogOwnerService:1504/:1622`、`CatalogInventoryApplicationService:115-117/:660` | 上限 58,196ms（6.7%），**拓扑无关**；**实际削减量待逐分支、逐 fixture 实测对账后确定，本文不给目标值** | 第 2 次是 CAS 前置必须保留；重放分支单独对账 |
| C5 | 满分母去重 | `OrganizationVisibilityService:97` 吃 `:169`（720/720）、`:116` 吃 `:187`（478/478） | 40,676ms（4.7%） | 候选顺序与 scopeContext 逐字段不变 |
| C6 | 字典 `dictionaryReferenced` N→1 | `CatalogOwnerService:531` 循环内调 `:1192` | 0.42%，**随条目数线性放大** | `voidAvailability`/`blockingReferences` 逐字段不变 |
| ~~C7~~ | ~~`isEnabled` 全消、`requireCatalogBrand` 折入发布视图~~ | — | **撤回** | 见 §9 J2：二者均位于写路径前置校验，§3.4 禁止写事务内跨 schema join。改为走 owner typed judgment API 的调用次数优化，收益另行实测 |

#### 4.1.1 C2 的三格判定表

| `s.current_assignment_id` | join 出的 `ra.id` | join 出的 `r.id` | 判定 |
|---|---|---|---|
| NULL | — | — | **200，空 page/capability** |
| NOT NULL | NULL | — | **401 SessionInvalid**（今天抛 `EmptyResultDataAccessException` → 500，改 401 属修正，须登记行为变更） |
| NOT NULL | NOT NULL | NULL | **401 SessionInvalid**（若直译成「capability 为空的 200」即放宽授权面） |

四条不可省：`LEFT JOIN workspace_role r ... AND r.status='ENABLED'` **不能漏**
（漏了 DISABLED 角色的 capability 进 readback = 安全级错误）；谓词取 `:298` 的强谓词
而非 `:162` 的弱谓词；`password_change_required` 判定必须**先于** assignment 缺失的解释；
`page_access_keys`/`capability_keys` 必须复用 `WorkspaceRoleService:174-211` 同一 mapper，
否则 `RoleCapabilityCatalogDriftException`（409）静默消失。

### 4.2 分开

**不得合并**：`WorkspaceAssignmentScopeService.requireActiveScope` 必须与 resolver 内的合并版并存
（前者还被 `WorkspaceUserService:52/:77/:91` 与 `WorkspaceCommandAuthorizationService:63` 使用，
其 `AssignmentScopeNotFoundException` 是可观察 typed failure）；
capability 重核**不得上提进会话读**（`WorkspaceCapabilityScopeResolver:170-174` 的注释写明理由：
防止页面加载与命令执行之间的撤销被陈旧快照绕过）。

**应当分开**：`CatalogOwnerService` 按**读 / 写 / 复制**三类拆开，再落到 §3.2 的 handler 形态。

### 4.3 抽象

**8 个 `CommandReceiptService` + 6 个 `AuditHistoryService`** 收敛为共享组件；
`required()`（10 处）与 `envelope`（4 处）上提 foundation。

**正当性是可维护性与一致性，不是性能**——幂等回执可触及部分仅 51 op / 0.25%。
**不要用性能理由包装它。**

### 4.4 SQL 合并

见 §4.1。**明确不做**：`head_company` 去重——`OrganizationVisibilityService:116`
没有对应的第二次读，该项基于错误前提。

### 4.5 接口删除

**不删。** 196 个 operation 中仅 2 个无前端调用点，且该依据不足：
前端未调用不等于可删（可能是未实现 Journey、L2 用、或后续阶段预留）。

**注意与 §7.1 的区别**：此处指 HTTP operation；§7.1 下线的是 Java 内部 API 与旧实现，两者不冲突。

### 4.6 目录迁移

**做**：`code-layout` 门当前 FAIL 的两条——
`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application`
目录不被允许（910 行的 `CatalogInventoryApplicationService` 在此）；仓根多余的 `results` 目录。

**不做**：跨模块迁移（会造成 Gradle 循环 / 破坏模块主权 / 引入未登记的反向模块边）。

---

## 5. 明确不做（附理由，防止重复提出）

| 项 | 不做的理由 |
|---|---|
| `requireTaskPath` 委托批量 CTE | **方向判反，会放宽授权面**（`OrganizationTaskPathService:220`） |
| 删 `BusinessEntityService:591` 的重复 `requireProjectId` | 三次调用全在同一 `@Transactional` 内，「有兜底」的前提是错的 |
| ~~**BOM 逐行 `target()` 批量化**~~ | **本条已撤回（Dexter 2026-08-09 裁定）**。原理由是 DEV seed 实测每请求 N 分布 `{1:39, 2:11, 3:1}`、max=3、均值 1.25；Dexter 确认**真实经营的 BOM 组分数远大于 seed 造数**，故它是真实 N+1，**必须批量化**。落点见 §14.3 SQL-M6 |
| `assetReferencedAnywhere` 批量化 | 语料中 **0 次执行** |
| `CatalogOwnerService#skuOwnerByRef:1142` 加早退 | 早退条件实际几乎不成立 |
| `markPhase` 顺序对调 | 实测 phase 序列本就正确 |
| 用「前置链占 53.5% 耗时」论证 | **口径混用**：分母一个是「含该 section 的请求」、一个是「全部请求」，两者不可相减相除 |

---

## 6. 治理

### 6.1 为什么这些问题能长期存在

**现有 44 道门检查的全部是契约表面**——operation 在不在、locator 解不解析、分母对不对、
哈希新不新。**没有任何一道门问过「这个类多少行」「这一行多少字符」「这个事务包了几条查询」。**

证据：`CatalogOwnerService` 中四处致命的 `ON CONFLICT` 写法在多轮评审中未被发现，
直到用脚本单独抽出打印。**2,816 字符的一行人读不了——可读性直接决定评审能否发挥作用。**

### 6.2 项目记忆（写入 `project-memory/decisions/`）

1. 分层过细导致 SQL 效率低是红线，领域划分不得凌驾于业务性能。
2. DB 往返成本是延迟主因，次数不是代理指标。
3. BEGIN 溢价：每个只读事务约 64ms，与其中语句数无关。
4. 门必须能拒绝错误行为；只断言字符串存在的门是假绿。
5. evidence 必须冻结快照后再分析。
6. 架构前提：交易规则 + 交易结果 = 同一 App 同一库、不拆；交易结果未来分表（同库内）；
   真缝只有 TDP 与外部对接两条。**前提变了，本方案的松绑结论要回滚。**
7. 可读性即评审能力。

每条须写「如何应用」，不只写「是什么」。

### 6.3 开发规范（写入 `AGENTS.md`）

1. **DB 往返的数值声明按三分母分治，不存在「所有 operation 统一预算」**（§13.1）：
   - **任务型 read model surface**：声明 `BUDGET`，默认 `databaseOperationCount <= 3`（§3.5）；
   - **本轮触及的 command**：**不声明 BUDGET**，仅以**具名 fixture** 的 `MeasuredBaseline` 对账，
     判据为「同一具名 fixture 下不得回归」，非上限；
   - **本轮未触及的 command**：**禁止任何数值声明**（填入未实测的数字即假精度，比不填更危险）。
2. 上述三类各自 exact-set 对账，**禁止互相套用**；每一类必须指定执行它的门（§6.4 四道门）。
3. 禁止在循环内发 DB 查询。
4. 跨层必须传递已取回的事实；owner 的重核范围见 §9 J1。
5. 新增只读事务必须论证为何不能并入已有事务作用域。
6. 跨 schema `SELECT/JOIN` **仅允许在事务外的任务型 read model 中**；
   **写事务内一律禁止**，跨模块前置校验只走目标 owner 的 typed judgment API；写一律 owner-local。
7. 交易结果类表的查询必须带分区键，禁止 `COUNT(*) OVER()` 等必须全扫的形态。
   现存违例：`InventoryOwnerService:572/:657`。
8. 一个 operation = 一个 handler 类，约束就地声明。
9. ES 是读模型，不进写路径、不作唯一真相；可读 ES 与必须回源的判断边界须在设计时划清。
10. **任何写进详设规范的可量化约束，必须同时指定执行它的门，否则不允许写进规范。**

### 6.4 门

**元规则（优先级最高）**：任何新门必须先用真实错误行为的红变异证明它能拒绝；
只测字符串存在的门不许合入。并设**元门**校验其他门都登记了红变异。

**A 类·量契约表面**

| 门 | 位置 | 检查 | 红变异 |
|---|---|---|---|
| **read 预算声明门** | 静态 | **仅分母 B（任务型 read handler）**：每个 read handler 有 `BUDGET`；**command handler 上不得出现 `BUDGET`** | 删掉某 read handler 的 BUDGET；或给某 command handler 加 BUDGET |
| **read 预算实测对账门** | 受管轮次 | **仅分母 B**：实测 ≤ 声明（`<=3`） | 在某 read handler 加一条无用查询 |
| **command 基线对账门** | 受管轮次 | **仅「本轮触及的 command」**：在**具名 fixture** 下实测值与 `MeasuredBaseline` 一致，判据是**不得回归**（非上限） | 在某触及 command 加一条无用查询 → 相对基线回归必红 |
| **未触及 command 免声明门** | 静态 | 未触及的 command **不得**声明任何数值（防止填入未实测的假精度） | 给某未触及 command 填一个数值 → 必红 |
| evidence 冻结门 | 受管轮次 | 分析前后快照 SHA 一致 | 分析中途追加一行 |
| 跨 schema 写禁止门 | 静态 | 写路径不跨 schema；读限受控组件 | 加一条跨 schema UPDATE |
| 旧路径消失门 | 静态 | 迁移后旧类/方法/目录**必须不存在** | 把已删的旧签名加回来 |
| 无引用 public 面检测 | 静态 | 零调用点的 public 方法须登记豁免或删除 | 加一个无人调用的 public 方法 |

**B 类·量实现质量（当前一道都没有）**

| 门 | 检查 | 红变异 |
|---|---|---|
| operation-handler 结构门 | 每 operationId 恰一个 handler，无 handler 处理多于一个 | 两个 operation 塞进一个 handler |
| 循环内 jdbc 门 | for/while/stream 内不得出现 jdbc 调用 | 把 `dictionaryReferenced` 放回循环 |
| 事务作用域观测门 | **以事务作用域为单位**：某个已开启的事务作用域内若零条语句执行，则该作用域为多余。**不要求 coordinator 直接发 JDBC**——协调器开事务、owner 发语句是正当形态，判据是「该作用域内是否有任何语句」而非「被注解的方法自己是否发语句」 | 给 `isScopeAllowed` 加回注解（其作用域内确实零语句） |
| 全扫形态门 | 交易结果类表禁止 `COUNT(*) OVER()` 与无分区键谓词 | 加回 `:572` 的形态 |
| 行长度兜底 | 单行 ≤ 200 字符 | —（兜底信号） |

**门优先量结构，行数与字符数只作兜底**——结构门无法通过拆文件作弊。

### 6.5 每道门必须自带五段元信息

缺一不许合入，且**必须同时出现在门脚本文件头与失败输出中**
（只写在文件头无用，撞门的人看到的是终端输出）：

| 段 | 内容 |
|---|---|
| `WHY` | 保护什么不变量，两三句话 |
| `EVIDENCE` | 立门时的具体实测/事故，**带数字与 `文件:行号`**。无具体事故的门不许立 |
| `ANCHOR` | routed link 指向记忆条目与决策文档章节 |
| `EXEMPTION` | 合法豁免的申报方式与必须写明的内容。**无豁免出口的门最终会被删掉** |
| `RED` | 真实错误行为的红变异 |

示例：

```
FAIL:LOOP_JDBC_CALL
  位置: CatalogOwnerService.java:531（循环体内调用 dictionaryReferenced → :1192）
  WHY:  单次 DB 往返约 41ms 且与 SQL 复杂度无关。循环内查询使往返数随数据量线性增长，
        且该退化不会在种子数据上暴露。
  EVIDENCE: getOperationsCatalogDictionary 单请求内同一 statementId + 同一 paramsHash
        的全表扫描执行 51 次（无 code 过滤），参数完全相同。
  ANCHOR: project-memory/decisions/db-roundtrip-is-the-latency-driver.md
        doc/decisions/2026-07-24-...-service-shape.md §3.5
  EXEMPTION: 登记 {callSite, 理由, 为什么不能批量化, 预期最大迭代次数, 复核日期}。
        仅登记「暂时」不构成豁免。
  RED:  把 dictionaryReferenced 放回循环 → 本门必须失败（已验证）
```

### 6.6 存量 44 道门全部回填（批次一交付物）

**分母 44 道可执行的门**（`scripts/check/` 下另有 3 个 `.mjs` 是被 import 的模块、无执行权限，不计）。
**当前带背景说明的 0 个。**

**比回填更严重的问题：44 道门里只有 10 道在 `scripts/verify` 链上，34 道不在。**
不在链上的门只有人想起来手动跑才会跑——**门写了没进链，等于没建**。
这与「规范定了没门执行」是同一个病，只是上升了一层。

**这直接解释了三道红门里为什么两道长期无人发现**：`openapi-contracts` 在链上，
所以它的红是已知的、被标成 baseline；而 `code-layout` 与 `database-operation-budget`
**都不在链上**，红了也没人看见。不在链上的还包括
`security-boundaries`、`query-boundaries`、`capability-invariants`、
`implementation-design-granularity`、`project-memory` 等。

因此 disposition 表必须多一列：**是否上 `verify` 链**。
只回填元信息而不解决上链，44 道门里仍有 34 道不会真正执行。

Codex 须先通读 §6.5 再逐门回填，
产出 disposition 表，每道门两列：
**处置**（`保留 / 回填后保留 / 重命名 / 降级观察 / 删除`）与
**上链**（`进 verify 链 / 受管轮次 / 手动按需 + 理由`）。

回填必然筛出三类，均须如实登记：**说不出 `EVIDENCE` 的**（补真实案例或登记待撤）；
**说不出 `RED` 的**（按元规则不许留在链上）；**名不副实的**。

**已发现的名不副实实例**：`scripts/check/database-operation-budget` 实际检查的是
`R4_DATABASE_SELECT_STAR`（禁止 `SELECT *`），**与往返预算无关**。
危害大于没有门——看门清单的人会认为预算已被执行，从而不会去建真正的预算门。
处置：重命名为它实际做的事，真正的预算门另立。

**当前三道红门，批次一全部处理，不登记 HANDOFF**：

| 门 | 失败原因 | 处置 |
|---|---|---|
| `openapi-contracts` | `R5_STRICT_OPENAPI_UNRESOLVED=110` | 修 |
| `code-layout` | `app/application` 目录不被允许；仓根多余 `results` | 修 |
| `database-operation-budget` | `SELECT *` 命中**测试文件** `DatabaseOperationTrackerTest.java` | 先判定测试文件该不该在分母内 |

**一道长期红着且原因无关紧要的门，会教育所有人忽略红色**——副作用大于它拦不住东西。

### 6.7 过期门的删除举证

删门与建门同等举证。每道拟删的门须写清：**它当初保护什么**；
**为什么那个东西现在不可能回归**；**它的 `EVIDENCE` 迁移到哪里**
（若被更强的门取代，历史事故记录须并入新门，**不许随门消失**——
否则删掉的不是门，是这个项目踩过坑的记忆）。

**构成删除理由**（须附证据）：保护对象已不存在；被更强的门完全覆盖；
约束的是一次性迁移且源形态已从代码库消失；阶段性门且阶段已收口
（`gate-0`、`rp12-final-state`、`remediation-compliance`、`roadmap-control-plane-transfer`、
`baseline-closure` 等名字带阶段性，**须逐个举证，不预判结论**）。

**不构成删除理由**：「一直是绿的」（绿说明它在起作用，或从没被真正测过——该补红变异）；
「没人撞过」；「跑得慢」（该优化或移到受管轮次）；
**「看不懂它在拦什么」——这是要补五段的信号，看不懂就删等于把无知转成技术债**。

**说不出来源的门**：降级为 warning 并设复核期，门里写明
「来源待考，复核期内无人认领则于该日期删除」。

---

## 7. 批次划分

> **2026-08-09 更新**：本节原为三个批次。Dexter 追加要求后，**§14 新增一个专做 SQL 合并的批次**，
> 全程共**四批**。**批次归属以 §14.4 的表为准**（该表按 Codex 详设的 `BP-U01…BP-U06` 交付单元表述，
> 与本节的叙述性划分是同一件事的两种写法，冲突时以 §14.4 为准）。

**硬约束：门必须在第一批就位。** 先改代码后建门，后两批只能靠人读 diff 验收，
而这次的教训正是「人读不了 2,816 字符的一行」。

### 批次一 —— 地基、止血、建门

冻结 evidence 快照；修 `DatabaseOperationTracker:290-291` 的重复检测桶 key
（含 `section`/`callSite` 导致跨 phase 相同语句分入不同桶，**须在冻结之后做**）；
补 organization 的 `OWNER_COMMAND_BEGIN/END` 与 `READBACK_END`/`EDGE_OUT`；
修三个真缺陷（字典码/UUID 形态不匹配、production tag `LIMIT 100` 截断、
两个 receipt service 写同一张表同一 PK）；修三道红门；
`isScopeAllowed` 去 `@Transactional`（**实测 0ms，整洁项非性能项**）；
**上线 A 类静态门与全部 B 类门**；44 道门 disposition 表。

**验收**：每道新门附真实错误行为的红变异记录；快照 SHA 前后一致；
三个缺陷各有先红后绿的 focused test；`scripts/verify` 仍在分钟级。

### 批次二 —— 查询与事务合并

C4 catalog 保存路径（**最高收益/风险比且拓扑无关**）、C5 满分母去重、C6 字典、
C1 前置链事务合并、organization 命令路径与前端扇出
（`InventoryDetailDrawer` 停发 3 个 changeSummary，**Edit 抽屉的重读保留**）。

**验收**：C4 按**逐分支、逐 fixture 的实测前后对照**验收——
对每个分支（正常保存 / 幂等重放 / 资产新增 / 资产移除且无他引 / 资产移除但他引存在）
分别给出改动前后的 `loadItems`、`generation` 实测调用数，**不设预设目标值**，
以「每个分支的语句数不增加、且被消除的调用有逐分支论证」为通过标准；
`GET_CONNECTION` 4.71→≤3.0、`COMMIT` 4.10→≤2.5；
**事务合并这一步每个 operationId 的语句总数必须逐条不变**（只消除边界不消除语句）；
契约生成物 diff 为空；C4 三条红夹具（幂等重放不释放资产 / 移除且无引用则释放 /
移除但他用则不释放）。

### 批次三 —— 结构重塑

> **注**：C2 + C3 已升级为独立批次的强制项，见 **§14.3 SQL-M1**（含声明目标值与七条不可省约束）。
> 本节保留其红夹具要求；实施顺序按 §14.4。

C2 + C3（触及授权路径，**先写红夹具再改**）；operation-per-handler 全量迁移；
handler 迁移覆盖分母 A 全量 196；**数值声明按三分母**——read handler 补 `BUDGET`、
本轮触及 command 补具名 fixture 的 `MeasuredBaseline`、未触及 command 不声明；
`CatalogOwnerService` 拆解与 8+6 收敛。

**验收**：§4.1.1 三格逐格有测试；五条红夹具（role DISABLED → 401、
`current_assignment_id` NULL → 200 空权限、assignment 撤销 → 401、
目录漂移 → 409 且**同时覆盖 ENABLED 与 DISABLED 两种 role 状态**、待改密码分支）；
结构门全绿；`EXPLAIN (ANALYZE, BUFFERS)` 对照。

### 7.1 老代码下线（每批次的 exit 条件）

**exit 是「旧实现已删除」，不是「新实现已上线」。新旧并存只允许在单批次内部，不得跨批次。**

**批次一**：仓根 `results` 目录；两个 receipt service 之一
（`OrganizationHierarchyCommandReceiptService:34-49` 与 `BusinessEntityCommandReceiptService`
写同一张表同一 PK——这是缺陷不是重复，修完只能留一个）。

**批次二**：协调器自有的 `catalogAssetRefs`（`CatalogInventoryApplicationService:828`，
与 owner 的 `CatalogOwnerService:1195` 重复**且行为不一致**——前者读 detail 投影，`itemDetail:1426` 对
`sku.mediaRefs` 只做 `asText()`，对象形态变空串，少识别的资产永不释放。C4 后只留 owner 一份）；
被吃掉的 `OrganizationVisibilityService:169`、`:187`（**若仍有调用点说明合并没做干净**）；
字典循环内的旧调用形态。

**批次三**：65 个 `case "..."` 的 switch 分发；
`(String operationId, ObjectNode) -> JsonNode` 旧签名（保留它等于保留一条绕过类型系统的后门）；
8+6 收敛后的多余实现；`app/application` 目录；各 owner 自造的 `required()`/`envelope`。

### 7.2 每次 review 的固定动作

不采信任何自报数字；所有门 fresh 复跑并**独立做红变异**；逐条核对声明的语句/事务计数变化；
检查有无为降低计数而削减 §8 的正确性成本；**明确声明哪些结论是静态的、哪些需 runtime 才能背书**。

---

## 8. 不得优化的正确性成本

**授权判定分支**——允许合并查询与消除重复解析（见 §9 J1），
**不允许跳过任何判定分支或放宽任一判定结果**；
幂等回执（`replay:1618` + `saveReceipt:1619`）；CAS（`UPDATE ... WHERE version=?`）；审计写入；
锁（`PlatformAssetService:249-262` 的 advisory lock 必须保住 `sorted()` 加锁顺序防死锁）；
typed failure 的具体错误码与错误对象；
**必要 readback**——在 `READBACK_END` phase 缺口修好之前，不得对任何 readback 做削减。

「当前无需优化」：连接池（0.2ms）与 `SET_AUTO_COMMIT`（0.0ms）。

---

## 9. 已裁定事项

Dexter 授权 Claude 按「最优、最合理、最长远」代为裁定，以下均为已裁定，不再是待决问题。

### J1 —— `OWNER_RECHECKS_COMMAND` 的语义边界

**裁定：命令入口开一个事务，授权在该事务的首批读中解析一次、命令内复用；
目标 owner 重核的是对象事实（范围、状态、来源、revision、不变量），不是 IAM 事实。
该事务不是 `readOnly`。**

依据（`doc/decisions/2026-07-24-...-service-shape.md` §3.6 原文）：
顶层 command「**在事务内首批读中解析一次** immutable trusted `ExecutionContext`」；
目标 owner「基于**同一 context** 复查**对象范围、状态、来源、revision 与不变量**」；
「**目标 owner 不在同一事务再次查询 IAM**」；
「事务入口授权已通过后发生的普通撤权**不承诺**取消在途事务」。

**当前实现是朝相反方向偏离**——它把 `isEnabled`、`requireActiveScope`、`requireTaskPath`
这组查询在一个请求里跑了两遍，做的比断言要求的更多，而断言恰恰说不要。
**合并不是松绑，合并才是回到断言。**

`WorkspaceCapabilityScopeResolver:170-174` 的注释与此不矛盾：它防的是**复用页面加载时的快照**，
不是禁止命令内复用。**命令入口新鲜解析一次，命令内复用**，两者同时成立。

Spring 的机制约束（外层 `readOnly=true` 会让内层写失败）不是反对共用事务的理由，
而是**反对把外层标成 readOnly**——命令事务本来就该可写。
锁的顾虑不成立：锁在写发生时获取，授权读全部发生在任何写之前。

**收益**：恢复 5.6%，另加事务合并的 134ms/请求。

### J2 —— 跨 schema JOIN 的读写边界（修订）

**裁定：发布视图只服务页面读，绝不进入写路径授权，也不用于 `requireCatalogBrand` 这类判断。
写事务中的跨模块前置校验一律走目标 owner 的 typed judgment API。**

§3.4 原文：「写事务中的跨模块前置校验**只走 judgment API，禁止在写事务内执行跨 schema join**。
页面读允许跨 schema join，但不得获得写主权、锁或业务规则解释权。」

**前一版本的错误**：把 `requireCatalogBrand`、`isEnabled` 折进发布视图。
二者都是**写路径前置校验**，直接违反 §3.4。**已撤回（见 §4.1 的 C7）。**

**并且要注意 J1 与本条的连锁**：J1 裁定前置链并入命令事务后，
**整条前置链都位于写事务内**，于是 §3.4 对它全面生效——
前置链中不再允许任何跨 schema join，跨 owner 事实一律经 judgment API 获取。
这使原 C7 的 5.6% 收益归零，**该收益不得再计入总账**。

**发布视图仍然可做，但范围限定**：仅供任务型 read model 使用（§3.4 允许），
用于消除页面读中的跨 schema 拼装。它同时是未来 TDP / 外部对接那条缝的契约雏形——
但那是读侧契约，不能推广到写侧。

**写侧的优化方向**：不是消除跨 owner 校验，而是**减少 judgment API 的调用次数**——
同一命令内对同一 owner 的多次 judgment 合并为一次批量 judgment（typed 入参、typed 闭集结果）。
收益需另行实测，本轮不预设数字。

### J3

| 事项 | 裁定 | 理由 |
|---|---|---|
| assignment 撤销分支 **500 → 401** | 采纳 | 今天的 500 是 `ContractProblemAdvice` 缺 handler 的意外；`:298` 对同一情形本就给 401 |
| DISABLED role × 目录漂移 **409 → 401** | **不采纳，保留独立漂移探测** | 目录漂移是数据完整性告警，掩盖成「会话无效」会让真实 bug 无法诊断 |
| `getOperationsStoreProfile` 与 `getOperationsOrganizationStore` 合并 | **不合并** | 载荷相同但**授权形态不同**（「我的门店」vs「那个门店」），合并会迫使调用方传入未必有权选择的 storeId。**授权语义不同即不同 operation** |
| `opaqueProjectionRef:755-759` 改为「以 owner 值为准，不一致即 `REFERENCE_MAPPING_UNRESOLVED`」 | 采纳，**单列不混进 C4** | 安全增强 + 可观察行为变更，混入性能批次会让回归定位困难 |
| `getPublicInvitationCompletion` | **补接线** | 按「不带病运行」标准，未接线即带病；数量仅 1 个 |

---

## 10. 同机拓扑下的价值缩水

当前 41ms/往返是本机经 SSH tunnel 到远端 PostgreSQL 的综合往返。同机部署下：

- **拓扑相关（缩水到近乎零）**：C1 事务合并的 134ms、C2/C3/C5 的往返削减。
  同机下 30 次往返约 15ms，本不构成用户可感问题。
- **拓扑无关（同机同样成立）**：C4 省的是两次完整 detail read model 组装与 JSON 序列化；
  §3.5 预算超标 5–15 倍这一事实；`COUNT(*) OVER()` 的容量退化；全部治理与结构改造。

**正当性主线必须是「回到已裁决的设计目标 + 结构可持续」，不是「省了 40% 延迟」**——
后者随拓扑变化失效，前者不会。

批次一同时做：`SELECT 1` × 100 的预热基线 p50/p95、旁路 tunnel 直连对照、同机对照。
没有这三个数，「41ms 归因于隧道还是远端 PG」是未决的。

---

## 11. 对 Codex 详设的要求

本文是详设的输入。详设须通过 `scripts/check/implementation-design-granularity`。

**文档载体按 owner 切分**：catalog / inventory 的 operation 更新
`contracts/policy/catalog-inventory-assertion-matrix.json`（它只承担这两个 owner 的真相）；
跨 workspace-iam / organization / platform-workspace 等 owner 的部分，
**允许新增一份跨 owner implementation-facing 详设 / manifest** 承载，
条件是边界声明清楚、**同一 operation 不得出现在两处**、且各自可独立对账。

**重构详设比新功能详设多出四项**：

1. **逐 operation 前后对照**：`logicSteps`/`callChain`/`normalPathDbOperations` 的改动前后，
   其中 DB 往返数**必须是实测值**。批次二事务合并一步须预先声明
   「每个 operationId 的语句总数前后逐条相等」并在实施后对账。
2. **行为变更登记表**：逐条列出 typed failure 的变化、触发条件、是修正还是取舍、
   前端/L2 是否需同步。**未登记的行为变更一律视为缺陷。**
3. **不变量保持证明（逐分支）**：§4.1.1 的三格判定表是最低标准。
   **只写「合并后语义不变」不构成证明。**
4. **红夹具清单（先红后绿）**：先写测试证明当前实现失败，再改代码让它绿。
   顺序反了则测试只是把新实现的行为固化下来。

**详设自带三张表**：下线表（§7.1 每项的删除对象、批次、依据、删除后如何验证旧路径确实不存在）；
门 disposition 表（44 道，含举证）；回滚点表（三批次各自可独立回退）。

**详设阶段就要定死的两件事**（原第三件「J2 发布视图命名规范」已并入第二件，C7 撤回后二者是同一个读侧组件）：
operation-per-handler 的具体接口形态（泛型签名、registry 绑定方式、
`OperationBudget` 与 `MeasuredBaseline` 各自的声明位置——按 §6.3 三分母分治，
**不是每个 operation 都声明预算**；一旦铺开 196 个 operation 就很难改）；
**任务型 read model 的受控跨 schema read 组件**的边界、命名与维护责任
（散开就收不回来；它是未来那条缝的**读侧**契约雏形）。
**该组件严格限定于事务外的任务型 read**：
不得进入命令写事务，不得用于 `requireCatalogBrand`、`isEnabled` 或任何写前置判断——
写事务内的跨模块前置校验一律走目标 owner 的 typed judgment API（§3.4 / §9 J2）。

**详设先经 Claude 独立评审**，重点核：前后对照的往返数是否实测、
分支验算表是否偷懒写成「语义不变」、下线表与门 disposition 表的举证是否成立
（尤其「为什么不可能回归」）。**详设通过后再开批次一。**

---

## 12. 置信度

**源码亲验**：全部 `文件:行号` 引用；`CatalogOwnerApi:10` 签名；65 个 case；
2,007 行 / 2,816 字符 / 126 条超 200 字符；8 receipt + 6 audit；44 道门与其中 0 道带背景说明；
三道红门及其失败原因。

**独立复算**：BEGIN 溢价三组数；前置段 9,773 条语句全读零写；
四 schema 分布（organization 5,210 / workspace_iam 3,938 / platform_workspace 512 / platform_iam 113）；
1,067 个请求中 867 个触及 ≥3 个 schema；每请求 4.71 个连接作用域。

**推论（实施前需再核）**：各项收益的毫秒换算；批次二/三的语句数预测。

**`UNVERIFIED`（需新的受控测量）**：6 表 LEFT JOIN 与 4 次点查的执行计划对比；
同机拓扑下的实际 p50/p95；`SELECT 1` 基线。

**本轮未做**：前端渲染路径的完整审查。

> **2026-08-09 更新**：原写"196 个未执行 operation 的逐个 disposition"未做——
> 现已在 §14.1.1 / §14.6 完成覆盖矩阵与 36 条 `UNMEASURED` 的点名，
> 但**逐条 disposition 仍是 `BP-U07` 的交付物**，本方案只给出分母与规则。

---

## 13. 修订后的四张交付表

### 13.1 三个互不相同的分母（不得混用）

**196 个 operation 的 owner 切片**（我从两个 generated registry 复算，两组不相交）：

| owner | 数量 | owner | 数量 |
|---|---:|---|---:|
| workspace-iam | 76 | contract | 10 |
| organization | 39 | platform-workspace | 7 |
| catalog | 25 | fulfillment-production | 4 |
| platform-iam | 16 | extension | 3 |
| inventory | 11 | platform-asset | 3 |
| | | asset | 2 |
| | | **合计** | **196** |

face 分布（两 registry 分别）：edge registry 154 = operations-admin 92 / platform-admin 50 / public 12；
catalog-inventory registry 42 全部为 operations-admin。
**并集口径**：operations-admin **134** / platform-admin 50 / public 12 = 196；
method 分布 POST 95 / GET 83 / PATCH 15 / DELETE 2 / PUT 1 → 非 GET 113。
其中**走完整 workspace 会话前置链的 = 134 − 6 登录协议 = 128 条**（§14.1.3），
这 128 条是 SQL-M1 / SQL-M2 的整改范围。

**三个分母各自独立，禁止互相套用：**

| 分母 | 范围 | 生成输入 → 输出 | exact-set 对账 |
|---|---|---|---|
| **A. handler 迁移分母** | 全部 196 | 两个 route registry → 生成期静态绑定表 | 绑定表 operationId 集合 **≡** 两个 registry 的并集；每 owner 只绑定自己的切片 |
| **B. 预算声明分母** | **仅任务型 read model surface**（子集，确切枚举由详设产出） | read model 契约 → handler 上的 `BUDGET` | 声明集合 **≡** read surface 枚举；command **不在此分母内** |
| **C. 门启用分母** | 按门逐个界定，见 §6.6 disposition 表 | 各门自身的适用面 | 每道门声明自己的分母与 exact-set 依据 |

**A 与 B 的关系**：所有 196 个都要迁 handler（A），但只有 read surface 需要声明 `BUDGET`（B）。
command 的 handler 上声明的是**实测基线**而非预算上限，字段名须与 `BUDGET` 区分。

**旧 §13.1 的三类切分（保留，作为 B 与基线声明的判定规则）：**

| 类别 | 数量 | 判定来源 | 本轮动作 |
|---|---:|---|---|
| **任务型 read model surface** | 由 `catalog-inventory-read-models.json` 的 25 个模型 + 各 owner 读 surface 界定，**须由 Codex 在详设中给出确切枚举** | §3.5 适用 | `<=3` 硬门；超标者逐个给整改或具名豁免 |
| **command** | 本轮触及的 operation（C1–C6 涉及者） | 无统一阈值 | 按正常 fixture **实测声明**，门为「同一 fixture 下不得回归」 |
| **本轮未触及** | 其余 | — | 仅登记，**不设门、不要求声明**，避免制造未实测的假精度 |

**分母的确切枚举由详设产出并经评审**；本文不预设数字。

### 13.2 事务 / owner / API 边界

| 场景 | 事务 | 允许的跨 owner 通道 | 禁止 |
|---|---|---|---|
| 任务型 read model | 事务外 | 跨 schema `SELECT/JOIN`（含发布视图） | 写主权、锁、业务规则解释权 |
| 命令的跨 owner 前置校验 | **命令写事务内** | **仅** 目标 owner 的 typed judgment API（typed 入参、原因码、闭集结果） | 跨 schema join、返回实体载荷、伪装 `getById` |
| 命令的状态变更 | 命令写事务内 | 目标 owner command API（同事务 typed command/result） | 跨 schema DML、listener 隐式写 |
| `ExecutionContext` 创建 | 命令写事务内的**首批读** | 会话行 + 活跃 assignment + role（见 §3.3 来源表） | 事务外创建后带入、复用页面加载快照 |
| owner 收到 context 之后 | 同一事务 | 重核**对象事实** | **再查 IAM**（§3.6 明文） |

### 13.3 红夹具（先红后绿；每条须先证明当前实现失败）

| 编号 | 覆盖 | 断言 |
|---|---|---|
| RF-1 | C2 三格判定 | `current_assignment_id` NULL → 200 空权限 |
| RF-2 | C2 三格判定 | assignment 撤销 → 401（今天 500，登记为行为变更） |
| RF-3 | C2 三格判定 | role DISABLED → 401，且其 capability **不得**进入 readback |
| RF-4 | C2 目录漂移 | 漂移 → 409，**且同时覆盖 ENABLED 与 DISABLED 两种 role 状态** |
| RF-5 | C2 密码分支 | 待改密码判定**先于** assignment 缺失的解释 |
| RF-6 | C4 幂等 | 同 idempotencyKey 二次提交 → 响应逐字节相同**且不释放任何资产** |
| RF-7 | C4 资产 | 图片被移除且无其他引用 → 释放 |
| RF-8 | C4 资产 | 图片被移除但他处仍引用 → **不释放** |
| RF-9 | §3.3 context | owner 内出现任何 IAM 查询 → 门必红 |
| RF-10 | §13.2 边界 | 写事务内出现跨 schema join → 门必红 |
| RF-11 | 绑定形态 | 引入运行期动态查找/service locator → 门必红 |
| RF-12 | C6 字典 | 零条目字典 → 查询数为 1（不是 2） |
| RF-13 | receipt replay 重核顺序 | 授权已变更或对象状态已变更后重放同一 idempotencyKey → **必须先失败于重核**，不得返回历史回执 |
| RF-14 | `ownerGrant` 不可伪造 | 尝试从外部数据构造 grant 绑定 → 编译期不可达 / 门必红 |
| RF-15 | `CatalogAuthorizationScope` 不可伪造 | 用 header/body/path 覆盖 `brandRef` 或 `copySourceDataNodeId` → 必须失败，门必红 |

### 13.4 过渡与退出表（旧路径以「不存在」为准，非「无人调用」）

| 旧路径 | 退出批次 | 退出判据 | 若未退出的后果 |
|---|---|---|---|
| `(String operationId, ObjectNode) -> JsonNode` owner API | 三 | 签名在代码库中不存在 | 保留一条绕过类型系统的后门 |
| 65 个 `case "..."` switch 分发 | 三 | 分发块整体删除 | 两套路由并存 |
| owner 内的 IAM 查询 | 二 | `grep` 零命中 + RF-9 红变异 | 授权快照撕裂 |
| 裸 `dataNodeRef`/`brandRef` 字符串对签名 | 三 | 签名不存在，**且前置条件为 `CatalogAuthorizationScope` 已落地**（两者不得分批） | context 契约被绕过；若先删签名后补 scope，中间态会丢失服务端 brand 判定 |
| 协调器自有 `catalogAssetRefs`（`:828`） | 二 | 方法不存在，只留 owner 一份 | 资产泄漏持续 |
| 两个 receipt service 之一 | 一 | 类不存在 | 同表同 PK 双写 |
| `app/application` 目录 | 三 | 目录不存在 | `code-layout` 持续红 |
| 各 owner 自造 `required()`/`envelope` | 三 | 零命中 | 行为漂移 |

---

## 14. SQL 合并清单（新增批次，Dexter 2026-08-09 追加要求）

> **本节的存在理由**：前 13 节把"少发几条 SQL"分散在 C1–C6 里，且验收判据只有「不得回归」。
> Dexter 裁定：**本轮必须实现 SQL 合并**，要有专门的清单说明哪些必须合并。
> 本节是那份清单，**判据不是"不得回归"，是"必须下降到声明值"**。

### 14.1 分母：196 条，不是 seed 的 55 条

> **Dexter 2026-08-09 纠正**：清单必须以**全部 196 条接口**为分母，不能只看 seed 跑到的那些。
> 本节据此重做。结论是——**seed 口径低估了合并收益，不是高估**。

#### 14.1.1 196 条的实测覆盖矩阵

| 覆盖来源 | operation 数 |
|---|---:|
| 历史全量 HTTP diagnostic 与本轮 seed **都有** | 39 |
| **仅**历史全量 diagnostic | 105 |
| **仅**本轮 seed | 16 |
| **两者都无（`UNMEASURED`）** | **36** |
| 合计 | **196** |

- 历史全量：`.runtime/rm1/http-diagnostic/rm1-http-diagnostic-1785592416417-9e221440/evidence/http-diagnostic-report.json`，
  147 条 operationProfiles（144 `PASSED` + 3 `EXPECTED_REJECTED`），其中 144 条仍在当前 registry 内、3 条已退役。
  它**只有聚合计数、没有 callSite**，因此用于判断"面有多大"，不用于定位"哪一行代码"。
- 本轮 seed：`.runtime/r5/evidence/db-operations.jsonl`，55 条 operation，
  **有 `statementId` / `paramsHash` / `callSite` / `seq`**，因此用于定位到具体调用点。
- 两者的 measurement basis 不同，**不可直接相减相除**；下文分别标注口径。

#### 14.1.2 全量口径：问题有多普遍（历史 diagnostic，144 条 PASSED）

| consumerFace | n | DB 操作数 中位 | 均值 | max | `>3` 占比 |
|---|---:|---:|---:|---:|---:|
| **operations-admin** | 89 | **17** | 17.0 | 34 | **98%** |
| platform-admin | 43 | 8 | 7.6 | 20 | 79% |
| public | 12 | 8 | 8.6 | 16 | 75% |
| 全体 | 144 | 12 | 13.5 | 34 | 90% |

**这不是 seed 造数的产物**：在覆盖当时全部通用 registry 的独立运行里，
operations-admin 的中位就是 17 次/请求、98% 超过读预算 3。

#### 14.1.3 结构性适用面：合并项覆盖多少条接口（静态，不依赖实测）

`SQL-M1` / `SQL-M2` 的落点在**所有已认证请求共享的前置链**上，与具体 operation 无关：

- 15 个 operations-admin controller 全部注入 `OperationsSessionResolver` → `WorkspaceAuthenticationService`；
- `OrganizationVisibilityService` 由 `WorkspaceAuthenticationService` 的会话装配调用（`:112/:137/:212/:265/:279/:287`）。

因此结构性适用面 = **134 条 operations-admin − 6 条登录/协议**
（`operationsWorkspacePasswordLogin`、`operationsWorkspaceLogout`、`getOperationsWorkspaceLoginEntry`、
`sendOperationsWorkspaceOtp`、`verifyOperationsWorkspaceOtp`、`changeCurrentWorkspacePassword`）
= **128 条**。

**交叉验证**：seed 覆盖到的 29 条 operations-admin 业务 operation 中，
**29/29（100%）**同时命中 `WorkspaceAuthenticationService` 与 `OrganizationVisibilityService`。
前置链是共享的，不是某几条接口的特性。

#### 14.1.4 单请求口径：一个 operations-admin 业务请求里有多少是重复读

用 seed 的 callSite 级数据，只取 operations-admin 业务请求（717 个请求 / 29 个 operation）：

| 指标 | 中位 | 均值 |
|---|---:|---:|
| 每请求 SQL 条数 | 20 | 22.2 |
| **其中可合并的多余读** | **9** | 8.86 |
| 占比 | — | **40%** |
| 每请求 SQL 耗时 | 817ms | 888ms |
| **多余读耗时** | **319ms** | 350ms |
| 占比 | — | **39%** |

**结论：一个 operations-admin 业务请求约 40% 的 SQL，是同一请求内已经读过的表被再读一遍。**
适用面是结构性的 128 条，不是 seed 的 29 条。

#### 14.1.5 复算方法（Codex 必须能独立重跑）

1. 取 `kind ∈ {QUERY, UPDATE, BATCH}` 且有 `statementId` 的记录 → 19,616 条 SQL / 1,998 个请求 / 273 种语句。
2. 从语句文本提取 `schema.table`；按 `requestId` 分组，找出**同一请求内同一张表被读多次**的组，首条之外记为"多余读"。
3. 按 `seq` 顺序判断两次读之间**是否存在对该表的写**：无写 → **可合并**；有写 → **必须保留**（CAS 前置 / 写后 readback）。

seed 语料上的复算结果：

| 口径 | 条数 | 耗时 | 占比 |
|---|---:|---:|---:|
| 全语料 DB 总耗时（2,011 请求） | — | **1,153.5s** | 100% |
| ├ QUERY | 19,077 | 784.7s | 68.0% |
| ├ TRANSACTION（COMMIT） | — | 254.0s | 22.0% |
| ├ UPDATE | 539 | 59.7s | 5.2% |
| └ CONNECTION | — | 55.1s | 4.8% |
| **可合并的多余读** | **6,539** | **257.8s** | **22.4%** |
| 必须保留的读-写-读 | 471 | 18.3s | 1.6% |

（全语料 22.4% 低于单请求口径的 40%，是因为语料里有 762 次 `getOperationsWorkspaceLoginEntry`
等轻量协议请求把分母摊薄。**按 128 条结构适用面看，40% 才是代表值。**）

检测器的自证：`catalog.catalog_item` 被判为"必须保留"的 191 条，
恰等于 `saveOperationsCatalogItem` 的请求数——它精确命中写后 readback，没有误伤。

**上界声明**：以上是**上界**，不是承诺值。逐项仍须按语义证明（见 14.3 每项的"必须保留"栏）；
凡证明不能合并的，写 `SQL_MERGE_REJECTED` 并给理由，不得静默省略。

### 14.2 必须合并的六项（按可省耗时排序）

口径说明：「seed 命中请求 / 可省条数 / 可省耗时」来自本轮 seed 语料；
**「结构适用面」是静态推导的 196 分母内的接口数，才是本轮真正的整改范围。**

| ID | 目标 | **结构适用面（196 内）** | seed 命中请求 | seed 可省条数 | seed 可省耗时 |
|---|---|---:|---:|---:|---:|
| **SQL-M1** | `workspace_iam.role_assignment` 会话链四查合一 | **128** | 739 | 1,737 | **73.0s** |
| **SQL-M2** | `organization` 可见范围一次装载（node / store / head_company 三表） | **128** | 735 | 3,225 | **123.1s** |
| **SQL-M3** | `catalog.catalog_item` 同请求多读收敛 | **25**（catalog owner 全部） | 394 | 1,142 | **45.5s** |
| **SQL-M4** | `platform_workspace.group_workspace` 请求内一次 | **128 + 7**（凡校验工作区启用者） | 81 | 169 | **7.0s** |
| **SQL-M5** | 长尾统一规则（六表） | 各 owner 内全部 | — | 266 | **≈9.1s** |
| **SQL-M6** | `inventory.stock_target` BOM 逐行校验批量化 | **11**（inventory owner 全部） | 51 | 13 | 0.5s |
| | **合计** | **128 条接口为主体** | | **6,552** | **258.3s** |

### 14.3 逐项设计约束

#### SQL-M1｜会话链四查合一（= §4.1 的 C2 + C3）

**现状**（739 个命中请求的每请求平均次数）：

| callSite | 次/请求 | 读什么 |
|---|---:|---|
| `WorkspaceAuthenticationService#requireAssignment:298` | 0.97 | assignment JOIN role（强谓词 + `r.status='ENABLED'`） |
| `WorkspaceAuthenticationService#loadSession:162` | 0.97 | 仅 `role_id`（弱谓词） |
| `WorkspaceAssignmentScopeService#requireActiveScope:24` | 0.69 | `service_node_type/id` |
| `WorkspaceCapabilityScopeResolver#hasCurrentCapability:180` | 0.68 | capability 判定 |
| 合计 | **3.31** | 同一 assignment 行，被读 3–4 次 |

外加 `WorkspaceAuthenticationService#require:244`（session 行）与 `WorkspaceRoleService#require:145`
（role + `page_access_keys`/`capability_keys`）——**同一 schema，可并入同一条语句**。

**目标**：`CommandExecutionContextResolver`（详设 §5.1）内**一条语句**产出
session + assignment + role + page/capability keys；声明值 **1 条**（今天 3.31 + 2）。

**必须保留（漏一条即缺陷）**：
1. `LEFT JOIN workspace_role r … AND r.status='ENABLED'` **不能漏**——漏了 DISABLED 角色的 capability 会进 readback，**这是安全级错误，不是性能细节**。
2. 谓词取 `:298` 的**强谓词**（`account_id` + `workspace_uuid` + `group_workspace_key` + `status='ACTIVE'`），不得退回 `:162` 的弱谓词。
3. `password_change_required` 的判定必须**先于** assignment 缺失的解释。
4. `page_access_keys`/`capability_keys` 必须复用 `WorkspaceRoleService:174-211` **同一 mapper**，否则 `RoleCapabilityCatalogDriftException`（409）静默消失。
5. §4.1.1 的**三格判定表**逐格实现，含 `EmptyResultDataAccessException`→500 改 401 的行为变更登记。
6. `WorkspaceAssignmentScopeService.requireActiveScope` **本身不删**——它还被 `WorkspaceUserService:52/:77/:91` 与 `WorkspaceCommandAuthorizationService:63` 使用，其 `AssignmentScopeNotFoundException` 是可观察 typed failure。合并版只作为 resolver 内的私有方法并存（§4.2）。
7. capability 重核**不得上提进会话读**（`WorkspaceCapabilityScopeResolver:170-174` 注释写明理由：防止页面加载与命令执行之间的撤销被陈旧快照绕过）。合并只允许发生在**同一命令事务的一次解析内**，不得跨请求、不得用页面快照。

#### SQL-M2｜organization 可见范围一次装载（= §4.1 的 C5，范围比原 C5 大一倍）

**现状**（735 个命中请求）：

| 表 | callSite | 次/请求 | 可省耗时 |
|---|---|---:|---:|
| `organization_node` | `listVisibleDataNodeCandidates:97`（全表） | 1.00 | 50.5s |
| | `hierarchy:169`（**同 WHERE，仅少 ORDER BY**） | 0.99 | |
| | `OrganizationTaskPathService#node:346`（单行，已在上面的全表结果里） | 0.98 | |
| `store` | `listVisibleDataNodeCandidates:116`（全表） | 1.00 | 59.5s |
| | `storeContext:187`（单行） | 0.65 | |
| | `BusinessEntityService#requireCatalogBrand:351`（单行） | 0.65 | |
| | `OrganizationTaskPathService#storePath:234`（单行） | 0.46 | |
| `head_company` | `headCompanyContext:203` / `:142` / `entity:356` | 0.94 / 0.35 / 0.19 | 13.1s |

**原 §4.1 的 C5 只写了 `:97`↔`:169` 与 `:116`↔`:187` 两组；本次复算发现还有
`requireCatalogBrand:351`、`storePath:234`、`node:346`、`entity:356` 四个单点重读，
它们读的行都已在同请求的全表结果内。C5 的实际规模是原估计的约两倍（123.1s）。**

**目标**：organization owner 内建立**请求内一次性的已验证可见范围事实**，
`describeScopeContext`、`requireCatalogBrand`、`storePath`、`node`、`entity` 一律从中取；
三表各声明 **1 条**（今天 node 2.97、store 2.76、head_company 1.48）。

**必须保留**：
1. 候选**顺序**逐字段不变（`ORDER BY node_type, code` / `ORDER BY code`）；`scopeContext` 逐字段不变。
2. status 过滤、workspace/group 谓词、每一个 typed failure（`AssignmentScopeNotFoundException`、`SessionInvalidException` 等）原样。
3. **它是请求内事实，不是缓存**：不跨请求、不进任何 cache 组件、不参与失效逻辑。
4. **不得跨 schema join**；它完全在 `organization` schema 内。
5. **不得替代写事务内的对象重核**——命令仍按详设 §5.3 顺序重核对象事实。
6. `requireCatalogBrand` 的**判定语义**不变：它仍是 organization owner 的 judgment，只是不再回表（对应详设 §5.3 的 `brandRef` 来源，不得退化为客户端字符串）。

#### SQL-M3｜`catalog.catalog_item` 同请求多读收敛（= §4.1 的 C4 + C6，与详设 BP-U04 合并到一处）

**现状**（394 个命中请求，1,142 可合并 / 191 必须保留）：
`loadItems:1504` 767 次、`generation:1622` 577 次、`skuOwnerByRef:1171` 191 次、
`dictionaryReferenced:1192` 112 次、`validateCatalogRelationRefs:1139` 57 次。

**目标**：
1. `generation:1622` 的 `SELECT COALESCE(MAX(version),0)` **折进 `loadItems` 的窗口函数**——它查的是同一张表同一范围。
2. `dictionaryReferenced` 的循环按详设 C6 的 owner-local `DictionaryReferenceSnapshot` 一次 set-based 取得。
3. `skuOwnerByRef` / `validateCatalogRelationRefs` 复用同一次 `loadItems` 结果。

**必须保留**：
1. **191 条写后 readback 一条不动**（检测器已把它们判为读-写-读）。
2. CAS 前置读不动（§8）。
3. `voidAvailability` / `blockingReferences` / dictionary status/kind/scope 逐字段不变。
4. 本项与详设 BP-U04 的 C4/C6 是**同一件事**，不得出现两套设计。

#### SQL-M4｜`platform_workspace.group_workspace` 请求内一次

`WorkspaceAdministrationService#isEnabled:89` 在一个请求内以同参数被调 3 次（纯重复 123 条 / 6.9s）；
`#require:75` 另有 0.66/请求。合并为 owner 内一次读。

**注意**：这**不是** §9 J2 撤回的 C7。C7 撤回的是"折入跨 schema 发布视图"；
**owner 内同请求去重**始终是安全的，不涉及任何跨 schema join。

#### SQL-M5｜长尾统一规则（不逐条设计）

`organization.commercial_group` 3.4s、`organization.project_phase_name` 1.0s、
`extension.extension_definition` 0.8s、`catalog.catalog_category` 0.8s、
`workspace_iam.invitation_assignment_intent` 0.8s、`contract.store_contract` 0.6s。

**统一规则**：同一 owner invocation 内，**同一实体、同一 key 的第二次读一律改为传递已读事实**。
不为每条建独立设计段，但每条要在 evidence 里出现前后计数。

**明确不动**：`platform_asset.staged_asset` 的 `require:266` ×2 被 claim 写入分隔，
属读-写-读，**保留**。

#### SQL-M6｜BOM 逐行 target 校验批量化（Dexter 2026-08-09 裁定纳入）

**seed 口径的实测**：`InventoryOwnerService#target:` 全语料 64 次，落在 51 个请求上，
每请求分布 `{1:39, 2:11, 3:1}`、max=3、均值 1.25；批量化最多省 13 条 = 语料的 0.034%。

**为什么仍然必做**：Dexter 裁定**真实经营的 BOM 组分数远大于 seed 造数**（真实配方常见 10–30 行）。
因此 seed 分布是造数产物、不是业务事实；按 seed 口径否决该项，等于**用不代表性的样本否决真实 N+1**。
本方案前一版 §5 的否决据此撤回。

**目标**：inventory owner 对本次 rows 的 distinct `targetRef` 去重后**一次 bounded lookup**；
声明值 **1 条 / 请求，与 BOM 行数无关**。

**必须保留**：
1. 逐行 scope 校验、存在性判定与**首个** `REFERENCE_MAPPING_UNRESOLVED` 的原始行序不变。
2. BOM 版本 CAS 与同一 `REQUIRED` 事务边界不变。
3. **不得由 catalog 直查 inventory schema**——批量 lookup 必须发生在 inventory owner 内。

**与详设的关系**：详设 §7 line 199 与 §8 的 `BOM rows` 门分母**予以保留**；
本节把它并入统一的 SQL 合并验收，不再单列一套。

**验收特例**：seed 语料下的收益（13 条）不足以作为验收信号。
本项必须**另建具名 fixture，BOM 行数 ≥10**，证明合并后仍为 1 条且三条不变量全绿；
不得用 seed 的 max=3 充当证明。

### 14.4 批次归属（我的裁定）

**新增一个批次，插在原批次二与原批次三之间**；原批次三顺延。

按 Codex 详设的交付单元表述（`BP-U01…BP-U06` 不变，只在中间插入一个新单元）：

| 批次 | 交付单元 | 内容 | 与 SQL 合并的关系 |
|---|---|---|---|
| 一 | BP-U01、BP-U02 | 证据/计量基线、196 静态 binding | 提供 `statementId`/`paramsHash`/前后计数的计量能力 |
| 二 | BP-U03、BP-U04 | `ExecutionContext` / grant / catalog scope / receipt 顺序；C4/C6 owner-local 去重 | **SQL-M1 的前置**：四条会话读今天分散在三个事务作用域里，不先并成一个事务就无法并成一条语句 |
| **三（新）** | **BP-U07（新增）** | **本节 SQL-M1…M6** | ← 本批次 |
| 四（原三） | BP-U05、BP-U06 | task readers、B=78 读预算开门、adapter 落地、旧路径退役与证据闭环 | **依赖本批次**：不先做 SQL-M1/M2，78 条读预算一开就全红（实测 10/10 超标 4–16 倍） |

新单元命名为 **`BP-U07`**（不复用已被两轮独立盲审绑定的 U01–U06 编号），
需在 granularity manifest 中新增一条 delivery unit，并配独立的 `approvedSources` / `detailDesign` 唯一锚点。

**为什么不塞进原批次三**：
1. 原批次三的 exit 条件是"旧路径在代码库中不存在"，与"合并前后实测对账"是两类判据，混在一起会互相阻塞——退役证明不该等合并实测，合并实测也不该等退役。
2. **本批次是四个批次里唯一一个以"耗时下降"为验收判据的**。单列出来，"效率到底有没有上去"才是一个可以独立 GO/NO-GO 的事情；混进结构批次就会重新变成"门全绿即通过"。
3. 它必须在读预算开门之前，否则批次四第一天就要写 78 条豁免。

**为什么不提前到批次二**：SQL-M1 的合并对象横跨三个事务作用域，
必须先有"授权事实在一个事务内解析一次"才能合并；提前会做成半成品。

### 14.5 验收判据（与前三批不同）

1. **每项声明目标值**：SQL-M1 每请求 1 条；SQL-M2 三表各 1 条；SQL-M3 写前 1 条 + 写后 readback 保留；SQL-M4 每请求 1 条；SQL-M6 每请求 1 条且与 BOM 行数无关。
   **判据是"必须达到声明值"，不是"不得回归"。**
2. **同一具名 fixture 前后对账**：每项给出合并前/后的 per-request 该表读取次数与耗时，
   附 `measurementSchemaVersion`、`measurementBasis`、run manifest digest、fixture digest。
3. **红夹具（先红后绿）**：把合并后的语句改回两条 → 该项的门必须红；
   删掉 SQL-M1 的 `r.status='ENABLED'` → 授权红夹具必须红（这条比性能门重要）。
4. **拒绝项必须显式**：任何一项若证明不能合并，写 `SQL_MERGE_REJECTED` + 理由 + 保留的正确性成本，
   不得静默省略；拒绝项之和与 257.8s 的差额要能对上。
5. **不得**用总耗时下降掩盖单项未做：六项各自独立对账。
6. **抽象粒度**：按 §14.7 的三道机器门 + 三个语义问题验收。
   **静态 SQL 语句去重数不得超过基线 465**；关键表独立 SELECT 点数降到声明值；
   `r.status='ENABLED'` 类授权谓词出现点数等于声明的唯一处数。
   **每接口一条独有大 SQL 与全局 query 层同为不通过。**
7. **分母是 196，不是 seed 的 55**：
   - SQL-M1 / SQL-M2 的证明必须覆盖 **128 条结构适用面**——至少包含若干条 seed 未跑过的接口；
   - 每项的前后对照报告里，`MEASURED_*` 与 `UNMEASURED_BLOCKS_OPTIMIZATION` 的和必须等于 196；
   - **只在 seed 跑过的接口上证明合并成功，本批次不通过。**

### 14.6 未实测的 36 条：必须逐条 disposition，不得推定达标

196 条里有 **36 条既不在历史全量 diagnostic、也不在本轮 seed 语料内**。
按问题描述的既定规则，它们只能标 `UNMEASURED`，**不得因"seed 没跑到"就推定低于阈值**。

| owner | 条数 | operation |
|---|---:|---|
| `catalog` | 16 | `deleteOperationsCatalogCategory`(DELETE)、`getOperationsBrandCatalogCopyCandidates`(GET)、`getOperationsCatalogShapeManifest`(GET)、`getOperationsLocalCatalogCopyCandidates`(GET)、`updateOperationsCatalogCategory`(PATCH)、`updateOperationsCatalogDictionaryEntry`(PATCH)、`executeOperationsBrandCatalogCopy`(POST)、`executeOperationsLocalCatalogCopy`(POST)、`executeOperationsTemporaryCatalogItemPromotion`(POST)、`moveOperationsCatalogCategory`(POST)、`preflightOperationsBrandCatalogCopy`(POST)、`preflightOperationsLocalCatalogCopy`(POST)、`preflightOperationsTemporaryCatalogItemPromotion`(POST)、`reorderOperationsCatalogDictionaryEntry`(POST)、`transitionOperationsCatalogDictionaryEntryStatus`(POST)、`transitionOperationsCatalogItemStatus`(POST) |
| `inventory` | 10 | `getOperationsInventoryTarget`(GET)、`getOperationsInventoryTargetBusinessHistory`(GET)、`getOperationsInventoryTargetChangeSummary`(GET)、`getOperationsInventoryTargetConsumptionReferences`(GET)、`getOperationsInventoryTargetDiagnostics`(GET)、`getOperationsInventoryTargetLedger`(GET)、`updateOperationsInventoryTargetConfiguration`(PATCH)、`adjustOperationsInventoryTarget`(POST)、`countOperationsInventoryTarget`(POST)、`increaseOperationsInventoryTarget`(POST) |
| `organization` | 4 | `getOperationsOrganizationCandidates`(GET)、`getOperationsOrganizationHierarchyExtensionDefinition`(GET)、`getPlatformOrganizationCandidates`(GET)、`updateOperationsCommercialGroup`(PATCH) |
| `workspace-iam` | 3 | `getWorkspaceInvitation`(GET)、`getWorkspaceInvitationCandidates`(GET)、`getWorkspaceInvitations`(GET) |
| `fulfillment-production` | 2 | `updateOperationsProductionTag`(PATCH)、`transitionOperationsProductionTagStatus`(POST) |
| `asset` | 1 | `releaseOperationsCatalogStagedAsset`(POST) |

**注意这 36 条里有 15 条 GET**，它们属于 B=78 读预算分母；**没有实测就不能开预算门**。
另外 `reorderOperationsCatalogDictionaryEntry`（C6 的命令面，详设 line 222 指定的 fixture）也在其中——
**详设指定的 C6 命令 fixture 目前没有任何实测数据支撑**，这一点须一并补齐。

**要求**：`BP-U07` 的证据里，196 条必须各有一行，取值只能是
`MEASURED_SEED` / `MEASURED_HISTORICAL` / `MEASURED_NEW_FIXTURE` / `UNMEASURED_BLOCKS_OPTIMIZATION` 之一。
其中：

1. 36 条 `UNMEASURED` 中，**凡结构上走 128 条前置链的，SQL-M1/M2 的改动自然覆盖它们**——
   但仍须至少建**一个**最小 fixture 证明前置链条数确实下降，不能只在 seed 跑过的接口上证明。
2. **15 条**未实测的 GET，在 B=78 预算开门前必须补最小 fixture（否则预算门是空的）。
   逐条为：catalog 3（`getOperationsBrandCatalogCopyCandidates`、`getOperationsCatalogShapeManifest`、`getOperationsLocalCatalogCopyCandidates`）、
   inventory 6（`getOperationsInventoryTarget` 及其 `BusinessHistory`/`ChangeSummary`/`ConsumptionReferences`/`Diagnostics`/`Ledger`）、
   organization 3（`getOperationsOrganizationCandidates`、`getOperationsOrganizationHierarchyExtensionDefinition`、`getPlatformOrganizationCandidates`）、
   workspace-iam 3（`getWorkspaceInvitation`、`getWorkspaceInvitationCandidates`、`getWorkspaceInvitations`）。
3. 其余按 owner 归并，可用一个 fixture 覆盖同一 owner 的同形态 operation，但**必须显式声明归并关系**，
   不得以"同 owner 应该差不多"跳过。
### 14.7 抽象粒度红线：不许从一个极端走到另一个极端（Dexter 2026-08-09 追加）

> **Dexter 原话**：「绝不能完全不抽象，为每个接口设计唯一一个 SQL，从一个极端走到另一个极端。」
> 这条比"合并"本身更容易做砸，因此写成设计红线 + 机器门，而不是只留给评审事后抓。

#### 14.7.1 两端都要挡

**左端（今天的病）**：同一份事实被拆成多次往返，一个请求读同一张表 3 次。

**右端（合并可能走到的新病）**：**每个接口一条独有的合并大 SQL**。后果比左端更难修——

1. 前置链对 **128 条接口是同一份事实**。每接口一条，就是同一个 JOIN 被抄 128 遍。
2. `LEFT JOIN workspace_role r … AND r.status='ENABLED'` 这类**安全级不变量会散落 128 处**，
   丢一处就是 DISABLED 角色的 capability 进 readback，而且不会有任何门发现——
   因为每处看起来都"有自己的语句"。
3. 授权模型任何一次变更 = 改 128 处。
4. 静态 SQL 数量暴涨，`code review` 与 `EXPLAIN` 都失去可行性。

**同时禁止的另一种"抽象"**：全局 query 层、动态 SQL builder、查询 DSL、万能候选 DTO。
manifest **B.6.5**（不建全局组合查询层）、**B.2.13**（弱类型受限）、**B.5.14**（禁动态查询 DSL 与字段袋）
已明令禁止，本节不放宽。

#### 14.7.2 正确粒度：**合并的粒度是「事实」的粒度，不是「接口」的粒度**

判据一句话：**同一份事实，在代码里只能有一个查询实现；一个查询实现，应当服务多个 operation。**

分三层，各有各的正确粒度：

| 层 | 正确粒度 | 全系统数量级 | 反例 |
|---|---|---|---|
| **共享前置事实**（会话 / 任职 / 角色 / 能力 / 可见范围） | 每个 `(owner, context kind)` **一条** | **个位数** | 128 条各自的合并 SQL |
| **owner 内聚合读取**（`catalog_item`、`store`、`organization_node` 等） | **每个聚合一个参数化 loader**（by ref / by refs / by scope），同 owner 多 operation 复用 | 每 owner 数条 | `saveItem` 一条、`copyItem` 一条、`promoteItem` 一条各写一遍 |
| **任务型 read model** | **以独立决策 surface 为粒度**（manifest B.5.14 已定），多个 operation 可共享同一 surface | 按 surface | 每接口一条；或反过来一页压成一条 |

具体到本轮六项：

- **SQL-M1** 的产物必须是 **2 条**（command 前置 1 条 + read 前置 1 条），不是 128 条。
- **SQL-M2** 的产物必须是 **1 份**请求内可见范围事实，`describeScopeContext` / `requireCatalogBrand` /
  `storePath` / `node` / `entity` 全部从它取，**不是每个调用点各写一条合并查询**。
- **SQL-M3** 的产物是 `catalog_item` 的**参数化 loader**，`save` / `copy` / `promote` / `dictionary`
  共用，不是每个 command 一条。
- **SQL-M6** 是 inventory owner 的 **一个** bounded lookup，与 BOM 行数和调用方都无关。

#### 14.7.3 机器门（静态、分钟级、可复算）

**基线（本会话对当前主源复算，不含测试）**：

- 扫描 `apps/backend/catering-business-server` 主源 453 个 `.java`；
- **去重后静态 SQL 语句字面量 465 条，出现点 516 处**；
- 按模块出现点：workspace-iam 128、organization 125、catalog 69、platform-admin-iam 62、
  inventory 38、store-contract 29、asset 25、workspace 16、extension 12、fulfillment-production 12。

关键表当前的独立 SELECT 语句数（即合并的靶子）：

| 表 | 今天的独立 SELECT 语句数 | 合并后目标 |
|---|---:|---|
| `workspace_iam.role_assignment` | 10 | 由 SQL-M1 声明并下降 |
| `workspace_iam.workspace_role` | 11 | 同上 |
| `workspace_iam.workspace_session` | 2 | 同上 |
| `organization.organization_node` | 21 | 由 SQL-M2 声明并下降 |
| `organization.store` | 26 | 同上 |
| `organization.head_company` | 14 | 同上 |
| `catalog.catalog_item` | 21 | 由 SQL-M3 声明并下降 |
| `platform_workspace.group_workspace` | 10 | 由 SQL-M4 声明并下降 |

**三道门**（`BP-U07` 交付，进 `scripts/verify`）：

> **2026-08-09 修订（第三轮复核后）**：下述第 1 道与第 3 道门的原始写法有缺陷，Codex 在详设中提出了
> 更准的形式，我确认它对、我错。修订后的版本以详设 line 277/279 的 `factImplementations[]` 机制为准，
> 本节保留基线数字作为其中一道粗粒度护栏的取值来源。

1. **静态 SQL 语句总数不得上升**：去重后 ≤ **465**。
   **它只是一道粗粒度的不回归护栏，不能单独证明抽象正确**——合并做对了它会下降（四条会话读变一条 = 4→1），
   给每个接口写独有大 SQL 会让它上涨，但它对"抽象是否真的被复用"没有分辨力。
   红夹具**两条**：新增一条与既有语句仅参数不同的 SELECT 必红；
   **删除若干无关 SQL 以抵消新增、使总数不变** —— 也必红（否则这道门可以被凑数绕过）。
2. **关键表的独立 SELECT 点数必须降到各项声明值**，且声明值写进 `BP-U07` 的设计，不得实施期再定。
   红夹具：把合并后的一条拆回两条 → 门必须红。
3. **安全级不变量按 `factLoaderId + statementTemplateHash + allowlist` 校验，不按整张表全局计数**。
   ~~原写法「`r.status='ENABLED'` 在主源的出现点必须等于 1」是错的~~：它会**误伤
   `requireActiveScope` 等合法 typed failure 路径**——那些路径本来就要按 role 状态过滤，
   出现点数大于 1 是正确行为，不是抽象散落。
   正确形式：每个 `factLoaderId` 声明自己的 `statementTemplateHash` 与 `securityPredicateId`，
   门校验「该 loader 的语句模板未变 + 谓词未被删改」，并对 allowlist 内的合法非 loader 路径豁免。
   红夹具：删改某个 loader 的 `ENABLED` 谓词必红；把 loader 的 SQL 复制进某个 adapter 必红；
   把模板改成动态拼接必红。

#### 14.7.4 评审时我会问的三个问题（Codex 详设阶段自查用）

1. **这条合并查询服务几个 operation？** 只服务 1 个，且它读的事实别处也在读 → 过度定制，退回。
2. **这份事实在代码里有几个查询实现？** 大于 1 → 没合并干净，退回。
3. **安全级过滤谓词落在几处？** 大于 1 → 抽象层次错了，不是补一处就能修，要重划边界。

三问任一不过，`BP-U07` 不通过。**门全绿但三问不过，同样不通过**——这三问是语义判断，
不是机器门能替代的（对应 manifest **D.3**「门只判客观事实，不宣称理解业务语义」）。

---

## 15. 读预算的形状裁决：分解式，不是常量（Dexter 2026-08-09 授权我拍板）

> **Dexter 原话**：「3 只是我之前随便想的，当然需要按照实际情况的最优方式来确定这个数字，而不是一个固定数字。」
> 本节替换 §14.5 中"B=78 一律 `OperationBudget.requestScope(3)`"的写法。

### 15.1 为什么常量是错的形状

B.6.6 原文本来就**不是常量**，是分解式：「≤3（**上下文解析 1 + 主查询 1 + 可选计数 1**）」。
被简化成单个数字之后，它必然要么太松（放过该管的），要么太紧（逼出一堆豁免）——
本轮详设把它写成 `requestScope(3)` 后立刻算不平，就是这个原因。

**正确的判据是：实测 request-scope 计数 = 该 surface 声明的分解之和，且每个分量不超过其上限。**
数字由 surface 的形态推出来，不是拍出来的。

### 15.2 上下文解析的物理下限：**2**（实测推导，非估算）

**operations-admin 读**（`getOperationsCatalogItem`，194 请求，SESSION 段真实 SQL = 9.0/请求）：

| schema | 今天的语句 | 可合并到 |
|---|---|---:|
| `workspace_iam` | `require:244`、`loadSession:162`、`WorkspaceRoleService#require:145`、`requireAssignment:298` | **1** |
| `organization` | `listVisibleDataNodeCandidates:97`、`:116`、`hierarchy:169`、`headCompanyContext:203`、`storeContext:187`(0.7)、`:142`(0.3) | **1** |

**platform-admin 读**（`getCurrentPlatformSession` 327 请求 = 1.0；`getExtensionDefinition` 8 请求 = 3.0；`getWorkspaceAccounts` 6 请求 = 13.3）：

| schema | 今天的语句 | 可合并到 |
|---|---|---:|
| `platform_iam` | `PlatformAuthenticationService#requireActiveSession:203` | **1** |
| `platform_workspace` | `WorkspaceAdministrationService#require:75`、`isEnabled:89`（同表两读，即 SQL-M4） | **1** |

**两个 face 都落在 2。** 取 1 需要跨 schema join——§2.3/§6 对事务外任务读是允许的，
但那会把两个 owner 的 schema 焊进同一条语句，owner 主权很难再拆回来。**不取。**

> **2026-08-09 修订（第三轮复核后）**：上面这个"两个 face 都落在 2"的观察是对的，
> 但由此得出的**「按 consumerFace 定一个固定常量 2」是错的**，Codex 在详设 line 87 提出的
> 闭集 `ReadContextKind` 更准，我确认它对、我错。两处错法：
>
> 1. **consumerFace 太粗**。platform-admin 内部还要分档：`getCurrentPlatformSession` 实测只读
>    `PlatformAuthenticationService#requireActiveSession:203` **1 条**（无工作区范围），
>    而 `getExtensionDefinition` 是 platform_iam 1 条 + platform_workspace 1 条 = 2 条。
>    按 face 一律定 2，会逼前者平白多查一条。
> 2. **「固定常量」是错的语义，应为 cap**。常量意味着实际值必须等于它；
>    正确的是上限，实际值可以更低。详设 line 87 末句「不得强迫实际值等于某种最大上下文 cap
>    而平白多查」正是对此的纠正。
>
> **修订后以详设的三档闭集为准**（见 §15.3 修订版）。

### 15.3 裁决：`OperationBudget` 改为四分量声明

```
requestScopeBudget = contextResolution + primaryQuery + optionalCount + declaredExtras
```

**`contextResolution` 由闭集 `ReadContextKind` 决定（2026-08-09 修订，采纳详设 line 87）**，
不是按 consumerFace 定的常量，也不由 operation 自行声明 SQL：

| `ReadContextKind` | 固定加载的事实 | 事实 cap |
|---|---|---:|
| `OPERATIONS_SCOPED` | `WorkspaceReadAuthorizationFacts` + `VisibleOrganizationFacts` | **2** |
| `PLATFORM_WORKSPACE` | `PlatformReadSessionFacts` + `EnabledGroupWorkspaceFact` | **2** |
| `PLATFORM_GLOBAL` | `PlatformReadSessionFacts` | **1** |

**cap 是上限不是目标值**：实际值低于 cap 是正确结果，不得为了"用满 cap"而多查；
也不得把某个 operation 升为严格超集 kind 来换取更大 cap。

| 分量 | 取值 | 由谁决定 | 上限 |
|---|---|---|---:|
| `contextResolution` | 由 `ReadContextKind` 静态确定 | **闭集 kind，operation 只能选 kind、不能声明 SQL 或条数** | **随 kind：2 / 2 / 1** |
| `primaryQuery` | 默认 1 | 该 surface 的任务型 read model | **1**（例外见 15.5） |
| `optionalCount` | 0 或 1 | 列表类 surface 是否需要 total | **1** |
| `declaredExtras` | **恒为 0** | —— | **0** |

`declaredExtras` 保留字段但上限为 0：它的作用是让"想加一条"这个动作**必须显式改门**，而不是在某个 operation 里悄悄多发一条。

### 15.4 由此推出的每形态目标值

按 §15.3 修订后的三档 kind 重算（**上限值，实际可更低**）：

| `ReadContextKind` | surface 形态 | 上下文 | 主查询 | 计数 | **合计上限** |
|---|---|---:|---:|---:|---:|
| `OPERATIONS_SCOPED` | 详情 / 表单支持 | 2 | 1 | 0 | **3** |
| `OPERATIONS_SCOPED` | 列表 | 2 | 1 | 1 | **4** |
| `PLATFORM_WORKSPACE` | 详情 / 表单支持 | 2 | 1 | 0 | **3** |
| `PLATFORM_WORKSPACE` | 列表 | 2 | 1 | 1 | **4** |
| `PLATFORM_GLOBAL` | 详情 / 表单支持 | 1 | 1 | 0 | **2** |
| `PLATFORM_GLOBAL` | 列表 | 1 | 1 | 1 | **3** |

**原来的「3」对详情类是对的，对列表类少了 1；而对 `PLATFORM_GLOBAL` 类则多了 1。**
这两个方向的偏差正是"固定常量"这种形状必然带来的——太紧的把列表逼进豁免，太松的允许平白多查。

实测校准三例：

- `getCurrentPlatformSession` 今天 **1.0**（只有 `requireActiveSession:203`）——它是 `PLATFORM_GLOBAL`，
  上限 2 而实测 1，**低于 cap 是正确结果**，不得为凑满 cap 多查（这条是"cap 不是目标值"的实测例证）；
- `getExtensionDefinition` 今天就是 **3.0**（会话 1 + 工作区 1 + `requireDefinition:52` 1）——**已达标**，是正例；
- `getOperationsCatalogItem` 今天 15.0 → 目标 3（上下文 2 + 一条跨 schema 任务读 1）。
  它今天的 OWNER_READ 6.0 是 catalog / inventory / fulfillment-production **三 owner 各查各的**，
  按 **B.6.5**「页面读路径由发起该用户任务的模块持有任务型 query，以显式 SQL 跨 schema join 完成，不逐模块调 API 各查各的」应合成 1 条；
- `getWorkspaceAccounts` 今天 13.3 → 目标 4（上下文 2 + 主查询 1 + 计数 1）。
  它今天的 `WorkspaceUserService#page:153/:155/accounts:239/assignments:244/latestAuthenticationByAccount:250` 是列表 + 计数 + 三次扇出。

### 15.5 `primaryQuery > 1` 的例外与全局上限

允许某些 surface 的主查询大于 1（例如表单支持页需要两个互不相交的聚合），但：

1. 必须逐条写明：用户任务、**为什么不能合并**、基数上限、具名 workload、到期复核日期；
2. **全局上限：不超过 8 条 operation**（约 B=78 的 10%）。
   这个 8 是工程判断不是实测推导——它要大到装得下真实例外，小到不能变成默认逃逸口；
3. 超过 8 条即门红，且**不得用拆 endpoint 的办法绕过**（B.6.6 原文已禁）。

### 15.6 与"永久豁免上限 0"的关系

**保持 0，不放宽。** 声明分解**不是**豁免：分解仍然被门逐分量校验，且每个分量有硬上限。
豁免是"我就是超了且不解释"——这一类仍然是 0 条。

### 15.7 这条裁决顺手锁住了抽象粒度（§14.7 / M-03）

把 `contextResolution` 定成**由闭集 `ReadContextKind` 静态确定、operation 只能选 kind 不能声明 SQL**，
就等于机器地禁止了"每个接口手写自己的上下文查询"：
**谁手写，谁的 `contextResolution` 实测值就会超出该 kind 的 cap，门直接红。**
这比事后数 SQL 字面量更早、更准，与 §14.7.3 的静态门互补而不重复。
（配套还须禁止"升 kind 换更大 cap"，见 §15.3 与详设 line 87 末句。）

### 15.8 对详设的具体要求

> **2026-08-09 状态更新**：以下三条**详设均已落实**（第三轮复核核验通过），本节保留为需求出处。
>
> 1. `OperationBudget` 已改为 `(ReadContextKind, requiredFactSet, primaryQueryCap, optionalCountCap, declaredExtrasCap=0)`；
>    `task-read-surface-policy.json` 每行声明最小 kind 与两个可变 cap，不得声明 SQL 或条数。
> 2. read-side 具名抽象已建：`WorkspaceReadAuthorizationFacts`（workspace-iam）与
>    `VisibleOrganizationFacts`（organization），各有归属 owner。
> 3. 逐分量对账已落地：封闭 `ReadBudgetComponent` 集合，request snapshot 必须与 components 精确相加，
>    任一越 cap 或 `UNCLASSIFIED>0` 即失败；并已补"不得升 kind 换更大 cap"。

---

## 16. 工作区启用状态门的退役裁定（Dexter 2026-08-09）

> 触发：Dexter 在第四轮复核中问「登录时校验有效 workspace 才生成 session，读写都依赖 session，
> 是不是就已经防住了？」，随后补充「工作区停用是非常罕见的动作，可能几年也做不了一次，
> 所以没必要为这个加很多逻辑」，最后裁定「停用之后，自然过期即可」。

### 16.1 三条源码事实（本会话复算）

1. **停用工作区不撤销已有 session。** `WorkspaceAdministrationService.transitionStatusNew:139-145`
   只做 `UPDATE platform_workspace.group_workspace SET status=...` 加一条 audit，
   **完全没有触碰 `workspace_iam.workspace_session`**。
   对照：改密码 `WorkspaceAuthenticationService:237` 与登出 `:223` 都执行
   `UPDATE workspace_session SET status='REVOKED'`——**撤销机制存在，停用没有使用它。**
2. **`SESSION_TTL_MILLIS = 8 * 60 * 60 * 1000L`**（`WorkspaceAuthenticationService:36`），即 8 小时。
3. **session 校验 `require:244` 已经 JOIN 了 `group_workspace`**，但只取
   `name` / `operations_title` / `logo_asset_ref` 三个展示字段，**WHERE 里没有 `gw.status`**。

因此「登录校验 + 读写依赖 session」这条推理**描述的是应然不是实然**：
停用后存在一个最长 8 小时的窗口，窗口内读照常（读侧无校验）、写被 per-command `isEnabled` 挡住。

### 16.2 实测：为一件几年一次的事按请求付费

全语料 `WorkspaceAdministrationService#isEnabled` = **673 次 / 37.8 秒**，落在 550 个请求上，
平均 **56.1ms/次**。按会话类型拆分：

| 归属 | 次数 | 耗时 |
|---|---:|---:|
| workspace session 之后（operations-admin 读写） | **598** | **35.1s** |
| platform-admin（platform session 之后） | 63 | 2.2s |
| **预认证 / 凭证流**（登录、OTP、密码恢复；发生在 session 之前） | **12** | 0.4s |

### 16.3 裁定与处置

**Dexter 裁定：自然过期即可**——不给 `require:244` 加 `gw.status='ENABLED'` 谓词。

据此：

1. **退役 session 之后的全部 5 个 `isEnabled` 调用点**，实测消除 **661 次 / 37.3 秒**：
   - organization：`OrganizationHierarchyService:363`、`BusinessEntityService:647`（`requireActiveWorkspace`）、
     `OrganizationCommandService:276` 与 `:308`
   - workspace-iam：`WorkspaceAccountService:44`（`requireEnabledWorkspace`）、`WorkspaceRoleService:190`（`requireWorkspace`）
2. **保留预认证 / 凭证流的 5 处**（`WorkspaceAuthenticationService:66` 与 `:243`、
   `WorkspacePasswordRecoveryService:63` 与 `:162`、`WorkspacePasswordResetService:42`）。
   它们是「有效 workspace 才发 session」这条规则的**唯一执行点，不得删**。
3. `require:244` 的 WHERE **保持原样**。

### 16.4 必须登记的行为变更（这是一次放宽）

停用工作区后，已存在的 session 在其剩余生命期内**不仅可读，而且可写**——
今天写是被 per-command `isEnabled` 挡住的，退役后不再挡。窗口上界 = 8 小时。

登录侧不变（停用后无法建立新 session），因此该窗口**单调收敛**，不会因新登录而延长。

**Dexter 在知情下裁定接受**，理由是该动作几年一次。适用条件与反例边界一并登记：

- **适用条件**：停用动机是**商业性**的（停止合作、欠费、租户退出）。此时让在场操作员在剩余会话内
  完成手头工作，代价可接受，甚至可能是期望行为。
- **反例边界**：若将来出现「**因安全事件紧急停用**」的需求，**正解是撤销 session**——
  机制已存在，只需在 `transitionStatusNew` 内按 workspace 执行与 `:223` 同形的
  `UPDATE workspace_session SET status='REVOKED'`。
  **不得回头给每个命令重新加 `isEnabled` 校验**；本条写入设计以防未来退回原路。

### 16.5 对 SQL-M4 的影响

退役之后 `EnabledGroupWorkspaceFact` 在 operations-admin 与 platform-admin 两侧**都不再需要**——
那 661 次是**直接消失**，不是"合并成一次"。因此：

- **SQL-M4 应整体重写或撤销**。原目标「对同 key/request 一次 owner-local load」在调用点删除后无对象。
- 若保留 `SQL-M4` 编号，内容改为「`isEnabled` 调用点退役 + 预认证/凭证流 5 处保留举证」，
  适用面是**被删除的 5 个调用点及其覆盖的 operation**，不是一个共享事实的适用面。
- 量级对比：原 SQL-M4（同请求内多次合并成一次）实测最多省 **123 次**；退役省 **661 次**，
  是前者的 5 倍多，且代码是**删的不是加的**。
- `PLATFORM_WORKSPACE` 这一档 `ReadContextKind`（§15.3）仍含 `EnabledGroupWorkspaceFact`——
  若 platform-admin 侧的 63 次也一并退役，该档应同步降为只含 `PlatformReadSessionFacts`（cap 1），
  与 `PLATFORM_GLOBAL` 合并；**这一点需详设按源码逐点确认后再定，本节不预判。**

**修订顺序**：先落 16.3 的退役处置，再回头定 SQL-M4 的形态与分母；
否则会先花力气去数一个即将消失的集合。
