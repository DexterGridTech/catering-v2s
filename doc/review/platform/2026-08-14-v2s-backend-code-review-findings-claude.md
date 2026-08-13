# v2s 后端代码审查 · 已确认问题登记(持续更新)

- 性质:问题登记册。来源为多个独立审查 agent + Claude 亲验。**未亲验的条目已显式标注。**
- 范围:`apps/backend/catering-business-server`,571 个生产 `.java` / 33562 行。
- 状态:**进行中**——已归档 3 份(健壮性与过度设计、重复代码、数据持久化),另 4 份进行中(契约生成、分层命名、跨模块同构、过度设计交叉验证)。

---

## 0. 亲验状态说明

| 标记 | 含义 |
|---|---|
| ✅ **亲验** | Claude 已打开源码逐字确认,行号与内容一致 |
| ⚠️ **未验** | agent 报告,Claude 尚未独立确认 |

本会话已发生 4 次"只看大概就下结论"的错误(F-41 判 CONFORM、197 provider 误判、X-04 误判必 422、JSONB 全表扫无依据),故未验条目一律不得当作事实引用。

---

## 1. M 级 · 会导致生产故障或数据错误

### M-01 ✅ 亲验 · MinIO 网络 I/O 跑在数据库事务内,且持有两把事务锁

**位置**:`modules/asset/.../PlatformAssetService.java`

```
:97   @Transactional                                    ← 事务开始
:128  lockReceipt(...)          pg_advisory_xact_lock  ← 事务级锁
:146  lockObjectReference(...)  pg_advisory_xact_lock  ← 事务级锁
:150  // Object I/O deliberately happens outside a database transaction  ← 注释说在事务外
:162  objects.exists(objectKey)                        ← 网络 I/O
:163  objects.put(...)                                 ← 上传整个文件
```

**代码与注释相反**。`pg_advisory_xact_lock` 是事务级锁,它的使用本身就证明事务是开着的。唯一调用方 `StageOperationsCatalogAssetMultipartOperation.java:28` 也是 `@Transactional(REQUIRED)`,该文件内无 `NOT_SUPPORTED` / `REQUIRES_NEW` / `TransactionTemplate`。

**MinIO client 无任何超时**:`MinioAssetObjectStorage.java:35` 只有 `endpoint().credentials().build()`。

**后果**:每次上传商品图片占用一个池化数据库连接 + 两把事务锁,直到 MinIO 传完。MinIO 慢或挂 → 连接池耗尽 → **整个后台所有接口一起不可用**,不限于资产相关。相同内容并发上传还会在对象锁上串行等待网络 I/O。

**根因(重要)**:写路径跨 `生成的 binding → 手写 Operation → 接口 → Service` 四层,每层各带 `@Transactional`,**在任何单一位置都看不出"这里有网络 I/O 跑在事务里"**。那句写反的注释就是证据。

**最小修复**:把 `objects.exists`/`objects.put` 移出事务方法(先落盘再开事务记录行),或对该步骤标 `Propagation.NOT_SUPPORTED`;独立地给 MinioClient 设连接/读/写超时;**并改掉那句注释**。

### M-02 ✅ 亲验 · 全仓唯一一条无租户谓词的 SQL,每次删图片触发

**位置**:`modules/catalog/.../CatalogOwnerService.java:951`

```java
jdbc.query("SELECT sections::text FROM catalog.catalog_item WHERE status <> 'VOIDED'", …)
```

拉取**全平台每个租户每一行商品**的完整 `sections` JSONB 到 Java 解析。调用链:`:940 assetReferencedAnywhere` / `:962 requireAssetUnreferencedAnywhere` ← `CatalogInventoryCoordinator.java:548` 与 `:1317`,即**每次资产释放/删图片都执行**。

**双重后果**:
- **性能**:唯一一条成本随**全平台**数据增长的语句;
- **正确性**:判断"资产还有没有被引用"时看的是**所有租户的数据**。

**最小修复**:调用链上游(`PlatformAssetService`)本就持有 scope,加谓词即可。**一行。**

### M-03 ✅ 亲验 · 商品保存对整个品牌加锁

**位置**:`CatalogOwnerService.java:1892-1907` `skuOwnerByRef`

```sql
SELECT item_ref, sections::text FROM catalog.catalog_item
WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' FOR KEY SHARE
```

每次商品保存(`:1865` 调用)对该 scope **全部非作废商品逐行加 key-share 锁**,同时 detoast + 解析全 scope 的 JSONB。

**后果**:两个运维编辑同品牌下**不同的两个商品**会互相排队;任何并发的改 code 操作(`:1540 updateItem`)或复制路径的 `ON CONFLICT` 探测(`:757`)必须等待。100 倍商品 = 单品牌写吞吐直接塌掉。

**最小修复**:调用方 `:1858-1873` 已持有精确的 `ownSkuRefs` 与 `skuRelations` 集合,把扫描与锁限制到这些 UUID。

### M-04 ✅ 亲验 · 分页静默截断,第 5001 项永远取不到

**位置**:`CatalogOwnerService.java:1092-1093`

```java
long offset   = itemCodesOnly ? 0    : parseCursor(request, "cursor");
int  pageSize = itemCodesOnly ? 5000 : parsePageSize(request, "pageSize", 20);
```

`parsePageSize`(`:2338-2341`)上限为 100,该分支硬编码 5000 绕过,并**强制 offset=0**;而 `:1150` 照常计算 `hasNext` 并吐出 cursor,下次调用 offset 又被重置为 0。

**后果**:商品超过 5000 的品牌**静默返回被截断的编码列表**。该分支喂的是跨 owner 编码列表,**截断会传播到 inventory 与 production 的协调逻辑**。另外该分支 SQL(`:1142`)仍 SELECT 了 `attributes` 与 `sections`——只要编码却 detoast 了 5000 份完整 JSONB。

**最小修复**:去掉 limit(该分支只选 code 且已按 scope 收敛),或 `total > 5000` 时抛 typed problem 让截断变响。

### M-05 ⚠️ 未验 · 幂等回执协议实现 11 遍且已分叉成三种互斥并发方案

**位置**(agent 报告,待逐条亲验):

| 方案 | 位置 |
|---|---|
| advisory lock | `OrganizationHierarchyCommandReceiptService:31`、`CommercialGroupCommandReceiptService:28`、`ContractCommandReceiptService:21`、`WorkspaceCommandReceiptService:28`、`PlatformCommandReceiptService:22` |
| insert-first claim + `state='SUCCEEDED'` | `BusinessEntityCommandReceiptService:62`、`ExtensionCommandReceiptService:25` |
| `ON CONFLICT DO NOTHING`(无 state 列) | `CatalogOwnerService:2385`、`InventoryOwnerService:1411`、`ProductionTagOwnerService:476` |
| 已泛型化(现成目标形态) | `WorkspaceIamCommandReceiptService:26` |

**后果(agent 报告)**:catalog 路径对**尚不存在的行**做 `SELECT … FOR UPDATE`(锁零行=没锁),两个同幂等键并发请求都执行,输的一方 receipt 在副作用已提交后被静默丢弃 → 第三次同键重试 replay 出**第一次**的响应,而数据是应用了两次的状态。inventory/production 用裸 INSERT,输的一方对**写入已成功**的请求返回 500。

**待亲验重点**:`FOR UPDATE` 锁零行这条推断;catalog 双重执行的真实可达性。

### M-06 ⚠️ 未验 · `workspace_uuid` 不唯一,而它是 15 张表的租户键

**位置**:`db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:50`

只有 `UNIQUE (workspace_uuid, group_workspace_key)`,而 `group_workspace_key` 本身已唯一 → 该复合唯一**逻辑上蕴含,约束不了新东西**。数据库层面不阻止两行 group_workspace 共用同一 `workspace_uuid`。

**后果(agent 报告)**:`workspace_uuid` 是 `organization_command_receipt` / `workspace_command_receipt` / `contract_command_receipt` 与六张 `audit_event` 的租户键。若某次恢复/导入让两个 workspace 复用同一 uuid,**两个租户共享幂等键命名空间,租户 B 的命令会 replay 出租户 A 的 `response_json`**。

**最小修复**:`ADD CONSTRAINT uq_group_workspace_uuid UNIQUE (workspace_uuid)` —— 一行 DDL。

### M-07 ⚠️ 未验 · 热路径缺索引

| 缺失 | 触发点 | 后果 |
|---|---|---|
| `workspace_iam.invitation (workspace_uuid, group_workspace_key, mobile_normalized)` | `PlatformWorkspaceAccountTaskReadService:166,195` LATERAL | 该表除 PK 与 `token_hash` 外**无任何索引**;账号列表每行触发一次全表扫 |
| `workspace_iam.workspace_session (account_id, status)` | `WorkspaceAccountService:38` UPDATE | 每次撤销分配对**全平台所有 session** 做全表扫描 |
| `workspace_iam.role_assignment (role_id)` | `WorkspaceUserService:217` | FK 为 `ON DELETE RESTRICT`,角色键变更触发扫描 |
| `platform_asset.staged_asset (workspace_uuid, group_workspace_key)` | FK 无对应索引 | workspace 键更新/删除全表扫资产 |

---

## 2. S 级 · 会导致维护困难、误导或潜在 bug

### S-01 ✅ 亲验 · 一个事实三种拼写(JSONB 纵容的止血叠加)

`sections->>'source'` / `'sourceType'` / `'ownershipSource'` **三重 COALESCE 回退链,出现在七处 SQL**:`CatalogOwnerService.java:1062, 1066, 1114, 1124, 1128, 1137, 1138`。

**这不是设计,是三次改名都没清理旧的**。如果它是列,改名必须写迁移,就会被迫做完;JSONB 让"再加一层回退"的成本为零。

**这是"止血式修改"最清楚的实证**,也是支持本次做完整建模整改的直接理由。

### S-02 ✅ 亲验 · 吞异常并伪装成 403

`modules/catalog/.../CatalogInventoryCoordinator.java:721-728`

```java
} catch (RuntimeException failure) {
    throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "复制来源不属于当前品牌与目标门店的组织授权范围");
}
```

`failure` 被捕获后**从未使用**。DB 抖动、NPE、`resolveCatalogCopySource` 内的任何 bug,都被报成"你的品牌没有该复制来源的授权"——把排查者引向权限模型,而真实堆栈在任何地方都不存在。

`CatalogOwnerApi.Problem` 已有 `(code, status, message, Throwable cause)` 构造器(`CatalogOwnerApi.java:208`)。**修复=加一个参数**,并把 catch 收窄到 scope 解析异常类型。

### S-03 ⚠️ 未验 · 阈值格式错误 → 低库存告警永久静默

`modules/inventory/.../InventoryOwnerService.java:1585-1587`:非数字 `lowStockThreshold` 被 catch 成 `BigDecimal.ZERO`,而后 `signum() > 0` 为假 → 该库存对象**永远报 "OK"**。配置损坏的门店从此不再有低库存告警,且没有任何东西暴露这个错误配置。词表里已有 `UNKNOWN` 可用。

### S-04 ⚠️ 未验 · 客户端 header 可选择服务端故障行为

`src/main/.../app/edge/session/EdgeRequestContextArgumentResolver.java:49` 读取请求头 `X-Catalog-Test-Failure-Point`,穿过约 12 个生产签名传到 `CatalogInventoryCoordinator:1350` 与 `StageOperationsCatalogAssetMultipartOperation:35`,注入 422/500。

**agent 已核实防护**:另需 `V2S_CATALOG_TEST_FAULTS=true`,该变量只由三个 dev/test 脚本设置,**从不由部署配置设置**。故当前**不是线上漏洞**,评为 S。

问题在于:故障注入路径**随生产二进制发布、可由公开 header 到达**,唯一屏障是一个未设的环境变量,无 profile 检查;并且污染了三个模块的生产 API 签名。

### S-05 ⚠️ 未验 · 测试脚手架混入生产类型

- `modules/organization/.../OrganizationTaskPathLookup.java:17,26,46,55,64,72`:五个 `default` 方法体为 `throw new UnsupportedOperationException("... not provided by this test double")`。唯一生产实现全部 override,**这些默认值只为测试替身存在**——代价是生产契约不再强制要求它们,未来实现漏掉一个,编译错误变成**授权路径上的运行时异常**。
- `modules/workspace-iam/.../WorkspaceInvitationService.java:62,67,71,76`:四个伸缩构造器,短的传 `null` 给 `user`/`taskPaths`/`candidates`/`commandAuthorization` → **生产 `@Service` 可被构造成半 null 实例**。

### S-06 ⚠️ 未验 · 遗留 grant 写路径已不可达,可直接删除

`OperationsCatalogInventoryController.java:295` 的 `command(...)` 桥接方法——遗留路径进入 edge 的**唯一入口**——在该文件内**零调用**。所有写路由走 `m1Bindings.bind*Operation`,17 处 `application.` 调用全是读路径。

涉及:`CatalogOwnerApi` 2 个 / `InventoryOwnerApi` 5 个 / `ProductionTagOwnerApi` 3 个遗留重载,及 `CatalogInventoryCoordinator:1289 stageAsset` vs `:255 stageWorkspaceAsset`、`:1313 releaseAsset` vs `:545 releaseWorkspaceAsset`(前 5 行逐字节相同)。

**这不是重构是删除**,一次砍掉约一半重复面,零设计负担。**建议排在所有抽取动作之前**。

### S-07 ⚠️ 未验 · audit history 读服务 6 模块同构,`projection()` 逐字节相同

`OrganizationAuditHistoryService:36`、`ExtensionAuditHistoryService:21`、`ContractAuditHistoryService:27`、`PlatformIamAuditHistoryService:22`、`WorkspaceIamAuditHistoryService:55`、`PlatformWorkspaceAuditHistoryService:56`。agent 用 diff 确认其中三份 `projection` 逐字节相同。另各自并存一份遗留两查询版。预计净减约 350 行。

### S-08 ⚠️ 未验 · owner 守卫与 JSON 工具成套复制 3–5 处

`requireOwnerScopeGrant` / `requireTypedContext` / `catalogCapabilityForTarget`(三处 switch 完全相同)/ `copySourceDataNodeRef` / `canonical`+`json`+`hash` / `envelope`+`command` / `required`+`optional`,分布于 catalog、inventory、production、asset 四个 owner。差异仅为 Problem 类型与中文文案。四模块已共同依赖 `modules/execution-context`。

### S-09 ⚠️ 未验 · SHA-256 摘要 13 个命名 helper / 17 处计算点,其中 2 处手搓 Hex

`CommercialGroupCommandReceiptService:96-98` 与 `OrganizationCommandService:411-412` 用 `StringBuilder`+`String.format("%02x")` 手拼,而**同一个包里** `BusinessEntityCommandReceiptService:104` 已在用 JDK 17 的 `HexFormat.of().formatHex(...)`。

### S-10 ⚠️ 未验 · 手搓 Base64+正则 JSON 编解码,同包已在用 Jackson

`OrganizationHierarchyCommandReceiptService:79-160`(约 80 行)、`CommercialGroupCommandReceiptService:63-116`(约 55 行)、`WorkspaceCommandReceiptService:54`、`PlatformCommandReceiptService:35-36`:把 record 序列化成 `{"k":"<base64>"}` 再用正则读回。同包 `BusinessEntityCommandReceiptService:81-95` 对同类对象直接用 Jackson。**无任何"Jackson 不可用"的理由。**

⚠️ 切换会改变**已落库回执的物理格式**,属数据迁移动作,需 Dexter 裁定时机。

### S-11 ⚠️ 未验 · 数据完整性四项

| # | 问题 |
|---|---|
| a | **作废编码永不可回收**:`catalog_item` 用 `status='VOIDED'` 软删,但 `UNIQUE (data_node_ref, brand_ref, code)` **无 `WHERE status <> 'VOIDED'`**。作废后该编码永久占用,而所有列表都过滤 VOIDED → 运维界面上找不到它却被告知"编码已存在"。同样存在于 `dictionary_entry` 与 `production_tag_definition`。对照:`catalog_category` 选择物理删除以允许回收(`V20260808_140000:1-3` 注释说明)。**仓内两种策略并存,只在分类上做了裁决** |
| b | **裸 `ON CONFLICT DO NOTHING` 把空操作报成成功**:`InventoryOwnerService:446` 的 `copied` 作为 receipt 的 `version` 返回,全冲突时返回 `{"status":"COMMITTED","version":0}`;`ProductionTagOwnerService:351` 同形 |
| c | **`stock_ledger` 无 scope 列、无 FK**:资金级审计轨迹只靠裸 `target_ref UUID` 挂着 |
| d | **`organization_node.parent_id` 无 FK、无索引、无环守卫**:五处递归 CTE(`OrganizationHierarchyService:434,473` 等)全是 `UNION ALL` **无深度上限**,一旦出现环即语句超时;也不阻止 parent 指向另一 workspace 的节点 |

### S-12 ⚠️ 未验 · 冗余与死索引

- `ix_stock_target_scope_item_ref` 与 `ix_stock_bom_scope_item_ref` 是各自唯一索引的**严格前缀**,只放大写成本;
- `ix_stock_bom_option_value`、`ix_production_tag_scope_status`、`ix_platform_password_recovery_flow_active` **无任何查询会用到**。

### S-13 ⚠️ 未验 · 版本化 migration 里用 `IF NOT EXISTS`

Flyway 的 `V…` 只执行一次,这些守卫**永远不可能防重复执行**,唯一效果是"对象已存在但形状不同时静默成功"。最危险的一处:`V20260808_160000:154` 靠 Postgres **自动生成的约束名**去 `DROP CONSTRAINT IF EXISTS`,名字差一字符即静默跳过,留下"看起来已迁移、实际允许重复无 SKU 库存对象"的表。

### S-14 ⚠️ 未验 · 循环里发 SQL

`CatalogOwnerService:1474` 重排字典每条一次 UPDATE;`:743-759` 复制每个对象一条 INSERT;`InventoryOwnerService:443-455` 每 target 一条 INSERT + **第二个循环**每 target 一条 SELECT 回读自己刚写的 ref + 每 BOM 一条 copy;`OrganizationHierarchyService:297,581` 每阶段名一条 INSERT。**200 商品的品牌复制约 600 次往返。**

### S-15 ⚠️ 未验 · OFFSET 分页,cursor 就是 offset

`CatalogOwnerService:1092/1142/1150`、`InventoryOwnerService:1040/1048/1119-1121`、`PlatformWorkspaceAccountTaskReadService:145`、`PlatformWorkspaceInvitationTaskReadService:95`、`WorkspaceInvitationService:168`。叠加 `aggregate` CTE 每页物化整个过滤集与 JSONB 谓词,第 N 页成本 = 第 1 页 + 丢弃成本。

---

## 3. 格式化(✅ 全量实测)

| 指标 | 值 |
|---|---|
| 生产 `.java` | 571 |
| 总行数 | 33562 |
| **>120 字符的行** | **5154**(15%) |
| >200 字符 | 1864 |
| >400 字符 | 480 |
| **最长单行** | **2812 字符**(`CatalogOwnerService.java:1056`) |
| **一行内多语句**(`;` 后仍有 40+ 字符) | **约 5867 处** |

超 500 行的文件 **11 个**:`CatalogOwnerService` 2826、`InventoryOwnerService` 1597、`CatalogInventoryCoordinator` 1367、`BusinessEntityService` 861、`PlatformAssetService` 769、`WorkspaceInvitationService` 746、`OrganizationHierarchyService` 609、`PlatformAuthenticationService` 600、`OrganizationOverviewTaskReadService` 587、`WorkspaceAuthenticationService` 554、`ProductionTagOwnerService` 541。

---

## 4. 已确认干净的项(不要在整改中破坏)

健壮性 agent 逐项排查后报告无问题,**这些是真功夫**:

- **金额精度**:33562 行内**零个 `double`/`float`**,金额与数量全部 `BigDecimal`;
- **SQL 注入**:所有插值标识符均为白名单闭集(`switch`/`Set.of`),值全部 `?` 绑定;`WorkspaceAdministrationPageRequest:21-22` 还用 `Math.multiplyExact` 防 offset 溢出;
- **Optional**:无 `.get()` 裸用,`orElse(null)` 处均立即判空;
- **资源**:try-with-resources + `finally` 清理临时文件;
- **鉴权**:`requireOwnerScopeGrant` 的 `catch(RuntimeException ignored)` 均落到抛 403,是 **fail-closed**;
- **N+1**:批量读一致使用 `IN (placeholders)`;
- **时间**:`SystemTimeProvider:9` 是全仓唯一 `System.currentTimeMillis()` 来源,foundation 能力未被绕开;
- **Spring 能力未重造**:零 `TransactionTemplate`、零 `ApplicationEventPublisher`、零 `@Cacheable`;
- **分类并发**:删分类与保存商品在分类行上经 `FOR UPDATE` 串行化,无"检查通过后被并发加引用"窗口。

---

## 5. 明确不该合并的重复(警示后来者)

重复审查 agent 判定以下**不是 finding**,合并会造成错误抽象:

1. **五个类型词表类**(`ServiceNodeTypes` / `BusinessEntityTypes` / `OrganizationNodeTypes` / `ExtensionHostTypes` / `AuditEntityTypes`)——字面量高度重叠,但每个类的 Javadoc 都显式写了边界意图("intentionally narrower than service-node types"、"STORE is a separate managed entity path")。它们是**演化规则不同的独立闭合词表**,合并会把 owner 词表焊死到 service-node 契约上;
2. **每模块自有异常类**——owner 边界要求不互相 import;正解是加**标记接口**让 advice 挂接口,不是共用异常类;
3. **domain record vs wire record**(`audit-model/AuditHistoryItem` vs `generated/wire/AuditHistoryItem`)——分层刻意;
4. **69 个 `*Operation` 各自的 `Invocation` record**——一操作一份入参契约,是设计意图;重复的是其内部 helper;
5. **catalog/inventory/production 三份 `command_receipt` 表**——每 owner 自有表是隔离要求;重复的是访问它的 Java 代码(M-05),不是表结构。

**Dexter 裁定:本次只接受工具类合并**——无业务语义、无状态、可单独单测、抽走后任何 owner 都不少一条业务规则。四条缺一即不动。

---

## 6. 总体判断(健壮性 agent 结论,Claude 认可)

> **不是欠健壮,是过度设计。而且唯一那条 M 级缺陷正是过度设计造成的。**

写路径跨生成 binding → 手写 Operation → 接口 → Service 四层,每层各带 `@Transactional`,所以没有任何单一位置能看出 MinIO 上传跑在事务里。**那句写反的注释就是证据。**

过度设计的具体载体:69 个手写 Operation 类、253 个签入的 wire DTO、约 880 行自建 DB/HTTP 观测设施、每模块缝一个接口(40 个接口中 38 个只有单一实现)、故障注入参数穿透三个模块的生产签名。而实际业务逻辑约为六个 service。

---

## 7. 待补

- 4 份 agent 结果未归档:契约生成链、分层命名与可接手性、跨模块同构、过度设计交叉验证;
- 全部 ⚠️ 未验条目需 Claude 逐条亲验后方可作为整改依据;
- **SKU 拆表方案须先参照 v4 已运行模型**(Dexter 指示),不得凭 v2s 现状凭空设计;
- 数据库 agent 声明未做:未跑 EXPLAIN、未测真实行数、未审 `CatalogInventoryShapeManifest` 是否在 Java 侧额外堵住了价格与 skuCode 的洞(**这条会影响 S-11a 与 JSONB 相关定级**)。

---

## 8. 授权边界

本文为只读审查登记,不授权实施。所有 ✅ 条目为 Claude 亲验;⚠️ 条目为 agent 报告未经独立确认。整改批次与顺序另行裁定。
