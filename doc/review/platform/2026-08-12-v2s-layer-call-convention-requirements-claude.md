# 分层调用规范：skill + ArchUnit + agent 三件套需求（Claude）

> **本文替代**：`2026-08-12-v2s-transaction-boundary-static-gate-requirements-claude.md` 与 `2026-08-12-v2s-database-interaction-boundary-standard-requirements-claude.md` 中的**检查设计部分**。那两份里的点状检查（逐条红线、逐条对账、逐条基线）**不再执行**，只保留其中的欠账清单。
>
> 原因：那两份是**逐个堵漏**——每发现一个问题加一条规则、一套判据、一组红变异、一个分母。规则数随问题数增长。本文改为**定规矩**：四条分层调用规范一旦成立，那些问题在结构上不可能发生。

- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行任何动态环境。
- 亲验声明：下列全部数字由我独立扫描源码得出。

---

## 1. 现状事实（先摆事实，规范才有依据）

| 事实 | 数字 | 含义 |
|---|---|---|
| operation adapter 命名一致性 | **196/196** 以 `Operation` 结尾，**196/196** 在 `application` 包 | 分层标识稳定，规则挂得住 |
| edge 层事务标注 | **0 处** | edge 已经干净，规范化只是防回归 |
| 事务 propagation 分布 | 裸 `@Transactional` 289 + `readOnly=true` 237 + 显式 `REQUIRED` 72；**`REQUIRES_NEW` / `NOT_SUPPORTED` / `NEVER` / `MANDATORY` 各 0** | **全仓统一 REQUIRED**，嵌套调用都 JOIN 现有事务 |
| `@Transactional` 按层分布 | `*Operation` **68 处 / 68 文件**（恰好每类 1 处）；`*OwnerService` 85/3；其他 `*Service` 402/42；其他 43/1 | adapter 层非常干净；量在下游 |
| 既有 ArchUnit 规则 | 28 条，**无一涉及事务** | 新地，不冲突 |

**一个必须更正的推测**：我此前推测 `createOperationsOrganizationStore` 的 4 个连接来自"跨 owner 各自开事务"。propagation 全仓统一 `REQUIRED` 这个事实**不支持该推测**——嵌套调用会 JOIN 而非新建起点。那 4 个连接的成因**静态判不了**，需运行时归因，登记欠账。不要把这个推测写进任何实施依据。

---

## 2. 四条分层调用规范（规矩本身）

层的定义按仓内既有事实，不新造概念：

| 层 | 标识 | 职责 |
|---|---|---|
| **edge** | `..app.edge..` 包 | HTTP 出入、wire 类型 |
| **operation** | 类名 `*Operation`（196/196） | 一次操作的**事务边界**与跨模块编排 |
| **owner api** | `*Api` / `*Lookup` 接口 | 模块之间**唯一**的调用契约 |
| **owner service** | `*Service` 实现 | 本模块业务与持久化 |

**四条规范：**

> **L1** edge 只能调 `*Operation`，不得直接依赖 owner service 或持久化类型。
> **L2** 事务**起点**只由 `*Operation` 声明；其他层只允许 JOIN（`REQUIRED`），不得使用 `REQUIRES_NEW` / `NOT_SUPPORTED` / `NEVER` 改变起点语义。
> **L3** 跨模块调用只能经 `*Api` 接口；owner service 之间不得直接依赖。
> **L4** 持久化类型只能被本模块的 owner service 依赖。

**这四条成立后，先前那些点状问题结构上不可能发生**：edge 成为事务起点（L1+L2）、跨 owner 未声明（L3 使跨模块依赖在 `*Operation` 构造注入处可数）、校验读跑错层（L4）。

**当前违规量**（我已扫描，这是迁移工作量，不是估计）：

- L1：**0**（edge 已干净）
- L2：**0** 起点违规（零 `REQUIRES_NEW` 等）；但有 **3 处**读入口在声明 `OUTSIDE_TRANSACTION` 的路径上带 `@Transactional(readOnly = true)`——`CatalogOwnerService` / `InventoryOwnerService` / `ProductionTagOwnerService` 的 `read(String operationId, ...)`
- L3：**5 条** adapter 实际注入 owner 数 > matrix 声明的 `ownerCount`：`createOperationsOrganizationStore`、`updateOperationsOrganizationStore`、`transitionOperationsOrganizationStoreStatus`（均 contract+organization）、`releaseOperationsCatalogStagedAsset`（catalog+platform.asset）、`transitionOperationsCatalogItemStatus`（catalog+inventory）
- L4：未扫描，实施时先测量再定迁移批次

**对齐方向必须逐条判断，不得默认改代码。** L2 的 3 处：`readOnly=true` 常是为保证一次读的快照一致性，若确有依赖，该改的是 matrix 声明而非摘注解。L3 的 5 条同理：可能是 `ownerCount` declared 写窄了。**门只负责"不一致就红"，改哪边是业务判断。**

---

## 3. skill：编写期指南（最省的一环）

**这是三件套里唯一能让问题不发生的部分**，其余两个都只是发现问题。

新建 `.agents/skills/` 下一个 skill，内容是**照着写就对**的模板，不是规则罗列：

- 新增一个 operation 时：adapter 叫什么、放哪、事务标在哪、跨模块怎么调、owner service 里能做什么不能做什么
- 每条给**正例与反例**，反例直接用 §2 的当前违规（真实代码，不编造）
- 明确"需要停下来问人"的情形：需要跨模块、需要读一致性快照、需要新的调用形态

**skill 不做检查，不产出结论**，它只降低写错的概率。

---

## 4. ArchUnit：结构阻断（确定性的那一半）

四条规范逐条落成 ArchUnit 规则，加进**既有** `BackendModuleBoundariesTest`（已是 catalog 里的 `ARCHUNIT_SELECTOR`）：

- **不新建门**、不新建契约、不碰 Testcontainers、秒级
- 规则**键在结构**（包名、类型依赖、注解、接口实现），**不得键在清单**——新增第 4 个 owner 只要符合形态就自动纳入，写成清单则新增者静默逃逸
- L3 的判据必须是**构造注入字段**，**不得用 import 扫描**：我实测 import 判据会把 29 条判红，逐条核对后真实违规只有 5 条，**高估 24 条**（例：`CreateOperationsCatalogItemOperation` import 了 `organization.api.CatalogScopeLookup`，但那只是类型引用）

**反馈时机在 verify，明确不进 per-edit 门**：ArchUnit 需编译；更重要的是 per-edit 门失败会阻塞 post receipt 造成控制面自锁，`sql-merge-coverage` 已吃过这个亏。

---

## 5. skill agent：非阻断审查（结构合规但设计不合理的那一半）

**能力边界必须先说死**：LLM 不能当阻断门——非确定（同输入两次可能不同结论）、不可红变异证明、不可审计。这三条与本仓的 receipt 模型直接冲突。

**它的合法位置**：产出 **finding 集合**，机械门只检查**每条 finding 都有处置**。判断非确定，义务是确定的。**仓内已有此范式**：`problem-family-discovery` 证据就是"LLM 找 + 机械校验分母与处置齐备"。

agent 的审查清单对准 ArchUnit 看不见的东西：

- 循环内的查询调用（N+1 形态）
- 一个方法内对同一事实的重复加载
- 先查再写的成对模式是否可折叠
- 结构上合规但对该业务任务明显过重的调用序列

处置只有三种，必须写进证据：**改实现** / **改声明** / **显式接受并说明理由**。

---

## 6. 无感：新功能如何自动带上

- **规则键在结构** → 新增同形态自动纳入，无人需要记得加清单（§4）
- **`*Operation` 命名与 bindings 由生成器维护** → 新 operation 自动进入分母
- **`UNRESOLVED` 棘轮** → 新增**异形态**（不符合四层任一标识）解析不到，`UNRESOLVED` 上升即红。开发者不需要知道规范存在，走偏会自己撞上来
- **红了只有三条出路**：扩规则（让规范跟着业务长）/ 改实现 / 显式豁免并归因。**把 `UNRESOLVED` 从输出里去掉不是出路**，配红变异

---

## 7. 静态到此为止（诚实边界）

**四条规范 + ArchUnit 管不了的**：

- **用量**。`createOperationsOrganizationStore` 41 次里那 24 次 QUERY、`selectOperationsWorkspaceSessionDataNode` 的 24 查询比 1 写，做完这套一次都不会少
- **`selectOperationsWorkspaceSessionDataNode` 连结构检查都覆盖不到**——它的 adapter 类不存在（读走 owner switch 分派），落进 `UNRESOLVED`
- **覆盖面**：L3 的静态解析当前 `RESOLVED=68 / UNRESOLVED=128`，**只覆盖 35%**。不得把"68 条里 5 条红"表述为"跨 owner 边界已受控"
- **那 4 个连接的真实成因**（见 §1 更正）

这些登记 `HANDOFF.md` 欠账。原两份文档里的运行时对账设计**保留备查，本次不做**。

**仓内已有一个可复用的资产值得记下**：`P4SqlOperationBudgetTest` 是**方法级 SQL 预算 harness**，用 `CountingDataSource` 数真实语句执行，已覆盖 25 个方法级操作（如 `WorkspaceUserService#page`）。将来真要治用量，**扩它的操作映射**比新建东西便宜得多。

---

## 8. 批次

| 批次 | 内容 | 验收 |
|---|---|---|
| **L0** | 写 skill（§3） | 四条规范各有正反例；反例取自 §2 真实违规 |
| **L1** | 逐条判断 8 项对齐方向（L2 的 3 处 + L3 的 5 条），写进证据 | 8 项各有明确结论与理由，**不得空着** |
| **L2** | 按 L1 结论执行对齐 | 代码与 `transactionMode`、`ownerCount` 一致 |
| **L3** | 四条规范落成 ArchUnit 规则 | 规则键在结构；输出 `RESOLVED` / `UNRESOLVED`，后者不得计入通过 |
| **L4** | agent 审查清单 + 处置齐备的机械校验（§5） | 每条 finding 有处置；处置只能三选一 |

**红变异**：edge 加 `@Transactional` 必红；owner 读入口加回 `@Transactional` 必红；adapter 注入新 owner 而不改 `ownerCount` 必红；**判据退回 import 扫描必红**（样本 `CreateOperationsCatalogItemOperation`）；新增不符合四层标识的形态，`UNRESOLVED` 上升必红；`UNRESOLVED` 被隐藏或计入通过必红；finding 无处置必红。

---

## 9. 授权边界

本文档是需求分析，不是实施授权，也不是评审结论。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器；文中数字为静态扫描与既有 seed 报告重算。不得据此宣称任何动态、业务、cleanup 或性能结果。
