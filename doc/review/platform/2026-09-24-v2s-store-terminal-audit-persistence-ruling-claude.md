# 门店终端审计持久化 · 实施期方案（Claude）

```text
TRIGGER=Codex 在 CP-02 owner 写命令前暂停：详设要求审计与终端写入同事务，却只规划了终端表与回执表
REQUESTED_BY=Dexter 2026-09-24：「请你来给完整方案，然后回复codex，使其继续完成整体交付任务」
SESSION_PROVENANCE=续接会话，Claude 主会话；静态只读核对，未运行任何命令
AUTHORIZATION=沿用 Dexter 已给的实施授权（见 2026-09-24-v2s-store-terminal-management-design-review-r2-claude.md §5 原话），本方案不新增授权门槛
```

## 1 · 结论

采用「store_terminal 自有审计表 + 审计读取路由」，照 store-contract 的先例实现。

- 不写 organization 的审计表：那是跨 owner 写入。
- 不新建公共审计写入接口：仓内没有先例，还会造出一条跨 owner 写入路径。

Codex 暂停的判断是对的。

## 2 · 仓内依据（均已回源码核对）

- **写入 SPI 由各 owner 自己落地**：`modules/audit-model/.../AuditEventWriter.java` 第 3 行写明，表和事务内的持久化适配器都由 owner 提供；组织域适配器 `OrganizationAuditEventWriter.java` 第 12 行只写 `organization.audit_event`。
- **每个 owner 各有一张审计表，共 8 张**：
  - `V20260726_210000_000__canonical_owner_audit_events.sql` 里 6 张：platform_iam、platform_workspace、organization、extension、workspace_iam、contract；
  - `V20260819_230000_001__business_channel_owner.sql` 第 83 行的 business_channel；
  - `V20260819_230000_000__collaboration_owner.sql` 第 76 行的 collaboration。
- **最贴近的先例是门店合同**：它不属于组织 owner，但按门店授权读取审计。
  - `ContractAuditHistoryService.java` 第 40 至 51 行、`ContractAuditHistoryPersistence.java` 第 88 至 112 行：一条 SQL 先找到目标对象所在门店，再判断该门店是否在可见门店内，最后分页取事件；对象找不到返回 404，无权返回 403。
  - `OperationsAuditTaskReadService.java` 有 `StoreContract` 分支；`OperationsAuditHistoryController.java` 第 58 行按 `STORE_CONTRACT` 分派；审计读取模块在 build 文件第 13 行依赖 store-contract 模块。
- **字段白名单由各 owner 自己声明**：`AuditChangePolicy` 是值对象，每个 owner 按「实体 + 动作」各自构造，例如 `StoreServicePointService.java` 第 660 行。
- **参照页的验收经 HTTP 读回审计**：`StoreServicePointAcceptanceScenarios.java` 第 334 至 341 行调用 `/api/operations/audit-history`，传 `entityType=STORE_SERVICE_POINT`。
- **审计历史接口的实体类型枚举有既有漂移**：
  - 边缘契约目录 `2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 中 `getOperationsEntityAuditHistory` 的 `entityType` 只有 9 个值；
  - 控制器实际分派 12 个，桌台区、桌台、二维码配置这 3 个类型不在枚举里，而参照页验收却在用。

## 3 · 方案

### 3.1 存储与写入（并入 CP-02）

1. **加审计表**：在尚未发布的 `V20260924_000000_000__store_terminal_owner.sql` 里新增 `store_terminal.audit_event`。
   - 列、约束、索引与 `organization.audit_event` 一致（canonical 迁移第 38 至 55 行）。
   - 本批最后会整库 reset，所以直接改这个未发布的迁移即可；若它已进入任何不会被 reset 的数据库，改为另起一个迁移。
2. **写入适配器**：`StoreTerminalAuditEventWriter implements AuditEventWriter`，放在 store-terminal 的 persistence 层，与终端写入共用同一个 `JdbcTemplate` 和同一个 `REQUIRED` 事务。
   - 新建、编辑、状态变更每次成功各写一条事件，位置在详设事务序列第 ⑦ 步。
   - 任何一步失败，终端、回执、审计一起回滚。
3. **实体类型**：`AuditEntityTypes` 增加 `STORE_TERMINAL`，`entity_ref_text` 存终端 ref。
4. **动作与字段白名单**：由 store-terminal owner 按动作分别声明 `AuditChangePolicy`。动作命名照桌台现有用法对齐。
   - 基本信息逐字段记录前后值：名称、设备类型、状态。
   - 新建时记录 `activationCode`，值固定为「已签发」，手填与自动两条路径相同，绝不写原码。
   - 打印机、功能与范围、逐场景订单类型与打印机集合按段写前后摘要，超长按 `AuditChange` 现有规则截断。
   - 连接标识在摘要里只记「已变更」，不写原值（详设第 133 行）。

### 3.2 读取路由（并入 CP-03）

1. **owner 侧读取**：store-terminal 新增 `StoreTerminalAuditHistoryService.readOperationsAuditProjection(scope, visibleFacts, target, page, pageSize)` 及其持久化实现，照 `ContractAuditHistoryPersistence` 用一条 SQL 完成。
   - 按 ref 找到终端（含已作废）及其门店，门店在可见门店内才放行，再分页取 `store_terminal.audit_event`。
   - 复用 `AuditHistoryResultSetReader`。找不到返回 404，无权返回 403。
2. **审计读取模块**：
   - `OperationsAuditTaskReadService` 增加 `StoreTerminal` 变体与分支，构造器注入上述服务；
   - `audit-read` 的 build 文件增加对 store-terminal 模块的依赖（先例：store-contract）；
   - `OperationsAuditHistoryController` 增加 `STORE_TERMINAL` 分派。
3. **契约**：在边缘契约目录的 `getOperationsEntityAuditHistory.entityType` 枚举里加 `STORE_TERMINAL`，经生成链重新生成。同一处顺带补上桌台区、桌台、二维码配置 3 个已在用却缺失的值，一次消除既有漂移。
4. **授权语义**：与门店合同、桌台相同，只看门店是否可见，不检查终端页面权限。需求 §7.4 与 R-8.9 正是因此把激活码排除出审计。
5. **UI**：终端页不新增历史入口，IA 不变。
6. **读取预算**：读取保持一条 SQL，应落在该 operation 现有的读取预算内；若 run 级预算校验报超，同步更新预算登记。

### 3.3 回执的附加约束（看了已写的迁移后补充）

- `store_terminal.command_receipt.response_json` 只能存终端 ref、version、status（详设第 123 行），不得存详情 DTO：详情里有激活码。
- `request_hash` 不含激活码（详设第 121 行）。

### 3.4 测试与验收

- **迁移集成**：`to_regclass('store_terminal.audit_event')`、索引定义、外键与三条检查约束都要实际核验。
- **owner focused**：
  - 在审计写入之后、提交之前注入失败，终端、回执、审计三表都无残留；
  - 每个命令恰好写一条事件；
  - 超出白名单的字段被拒绝。
- **V-25（真实 HTTP，经 `/api/operations/audit-history`，`entityType=STORE_TERMINAL`）**：
  - 新建事件含「已签发」，且整页响应里搜不到本终端的 8 位码（手填、自动各验一次）；
  - 改名有前后值；
  - 给某场景增删打印机，有前后集合；
  - 启用、停用、作废各有一条事件；
  - 作废终端的历史仍可读；
  - 门店不可见的账号得到 403；
  - 不存在的 ref 得到 404。
- **泄漏扫描（focused）**：`audit_event.changes_json`、`command_receipt` 的两列、日志里都不出现激活码。

### 3.5 设计文档同步

以「实施期设计修订（Dexter 要求 Claude 定方案）」为题，同步以下位置，IA 不改：

- 详设 §1 方案 B：两张表改为三张表；
- 详设 CP-02：写入适配器；
- 详设 CP-03：读取路由与契约枚举；
- 详设 §9a：新增审计一行；
- 详设 §10：三张表；
- 详设 §11：V-25 的判据；
- 实施计划 CP-02、CP-03、CP-05 三行。

## 4 · 为什么不是其他做法

- **写 organization 的审计表**：跨 owner 写入，违反 SPI 的归属约定。
- **公共审计写入接口**：没有先例，会引入跨 owner 写路径与新耦合，收益为零。
- **只写不接读取**：V-25 无法像参照页一样经 HTTP 验证，审计成了不可验的死数据。
