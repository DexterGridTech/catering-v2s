# B1 · P-2 幂等首用并发

> 先读 `00-总纲-claude.md`。

| 字段 | 值 |
|---|---|
| CP 数 | **7** |
| 机制 | **advisory lock 放进私有 `replay()` 内**(第五版改;理由见 §2) |
| 版本 | **第五版**。第四版的 insert-as-claim 方案经独立核验发现**取舍表同时变了两个变量**,第三候选从未被构造 —— 见 §6 |
| 定位方式 | **方法签名或逐字锚点。⛔ 不用行号** |
| 交付性质 | **缺陷修复。不关闭需求正本的任一 G1 判据** |

---

## 1. 问题

### 1.1 两个缺陷,严重度差一个量级

**缺陷 A(今天每次重放都 500,不需要并发)** —— `ExtensionCommandReceiptService`:
`@Transactional` 方法内 INSERT 无 `ON CONFLICT`,冲突抛 `DuplicateKeyException`,
`catch` 之后**在同一个已 abort 的事务里** SELECT。
PG 语句报错即事务 abort(后续查询一律 `25P02`)⇒ **重放分支实际不可达**,任何一次同 key 重放都 500。

**缺陷 B(要并发才坏)** —— 三个 owner 的 `replay()`:
`SELECT ... FOR UPDATE` 后 `if (rows.isEmpty()) return null;`。
**首用时结果集为空 ⇒ `FOR UPDATE` 一行都没锁到**(行锁是写在 tuple 上的标记,不存在的行无处标记 ——
PostgreSQL `explicit-locking.html` §13.3.2:锁的是 "the rows **retrieved**")。
两个并发请求都拿到 `null`、都执行业务写。

⇒ **执行顺序按严重度:A 先于 B。**

### 1.2 分母:22 个入口

| owner | 经 `replayTyped` | 直接调 `replay()` | 小计 |
|---|---|---|---|
| catalog | 357 · 398 · 688 · 736 | **452(C4)** · 1018 · 1425 · 1713 | 8 |
| inventory | 212 · 249 · 285 · 321 · 1689 · 1723 | 633 · 717 | 8 |
| production | 145 · 172 · 199 | 385 · 565 | 5 |
| extension | — | — | 1 |

**修复全部落在私有 `replay()` / `saveReceipt()` 内部 ⇒ 22 个入口一行都不改。**

⚠️ 但入口数不是决定正确性的量。真正决定正确性的是**「每条建了锁的路径是否都在事务里」** ——
advisory `xact` 锁在无事务时语句结束即释放。见 §3.3。

---

## 2. 机制:advisory lock 放进 `replay()` 内

### 2.1 仓内先例就是本册自己认证为「已合规」的那一处

`CatalogOwnerService`:

```java
450:  lockBatchStatusReceipt(dataNodeRef, receiptKey);
451:  ObjectNode scopedRequest = receiptRequest(canonicalRequest, brandRef);
452:  JsonNode replay = replay(dataNodeRef, receiptKey, BATCH_STATUS_OPERATION_ID, scopedRequest);
```

`lockBatchStatusReceipt` 的实现是
`SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))`。

⇒ **「advisory lock 紧邻 replay 之前」这个形态,仓内不但有先例,而且 §1.2 把第 452 行标为「C4,已合规」。**
把它从调用点下沉到 `replay()` 内部,C4 与其余 21 个入口一次全覆盖。

### 2.2 三个候选同位置重比(第四版只比了两个,且同时变了两个变量)

| 判据 | **advisory lock 在 `replay()` 内**(选中) | insert-as-claim 在 `replay()` 内 | advisory lock 在 21 个调用点 |
|---|---|---|---|
| 调用点改动 | **0** | 0 | 21 |
| DDL / 新列 / 可空化 | **零** | 迁移 + `state` 列 + `response` 可空 + 2 条 CHECK | 零 |
| 返回契约 | **不变**(`JsonNode \| null`) | 需三态 | 不变 |
| 新错误码 | **不需要** | `RECEIPT_CORRUPT`(全仓 0 命中,须过整条契约链) | 不需要 |
| 无事务时 | **退化成今天的行为,不更坏** | **claim 行永久 `IN_PROGRESS` ⇒ 该幂等键永久 500** | 同左列 |
| 锁空间碰撞 | **已被 C4 回答** —— 它用 `hashtext(text,text)`,与六处业务魔数锁长期共存 | 不存在 | 同左列 |
| 死锁 | 与 C4 同形态 | 引入整条命令时长的行锁 | 需分析跨连接 |
| 仓内先例 | **有,本册自己认证为已合规** | 只有一句注释,`apps/backend` 全部测试零并发覆盖 | 有(同左列) |

⚠️ **第四版把「调用点归零」记在 insert-as-claim 头上,是错的** ——
那是「收进私有方法」带来的,三个候选里有两个都拿得到。**表格把位置的收益记在了机制上。**

### 2.3 为什么不是 insert-as-claim(它更贵,且在一处更坏)

insert-as-claim 本身是正确机制(`BusinessEntityCommandReceiptService` 在用),
但把它移植到三个 owner 要付:一条迁移、三张表加列、`response` 可空、两条 CHECK、
三态返回契约、一个新错误码 + 三个异常类 + `ContractProblemAdvice` 注册、
`saveReceipt` 从 INSERT 改 UPDATE 并新增一个抛出点。

**而它换来的唯一差异是「不依赖事务」—— 这一点恰恰是反的**:
无事务时 advisory `xact` 锁失效退化为今天的行为;insert-as-claim 的 claim 行会永久残留,
使该幂等键**永久 500**。

⇒ 对本轮问题,advisory lock 严格更小且无回归。

### 2.4 被否决的第四候选

**锁 scope 父行**(`SELECT ... FOR UPDATE` on scope row):更便宜,但把同 scope 的所有命令串行化。
今天免费,业务量上来即瓶颈 —— **否决理由恰是本项目的目标**。

---

## 3. 变更点

> **`LOCATE` 一律用方法签名或逐字锚点。行号在括号里仅供参考。**

### 第一梯队 · 缺陷 A

#### CP-P2-01 · extension 修 catch + 收尾补行数校验

```text
FILE      modules/extension/.../ExtensionCommandReceiptService.java
LOCATE    方法签名 private Receipt claim(...) (约 62 行)
          与收尾 UPDATE(锚点 "UPDATE extension.extension_command_receipt SET response_json=")
BEFORE    claim:INSERT 无 ON CONFLICT;`} catch (DuplicateKeyException duplicate) {` 之后发 SELECT
          收尾:jdbc.update("UPDATE ... AND state='IN_PROGRESS'", ...) **返回值未使用**
AFTER     ① INSERT 末尾追加 ON CONFLICT (workspace_uuid, idempotency_key) DO NOTHING
          ② 去掉 try/catch:int claimed = jdbc.update(...); if (claimed == 1) return null;
          ③ 原 catch 体内 SELECT 与终态检查**逐字保留**,成为 claimed==0 分支
          ④ 原 throw 的实参 duplicate 不再存在 ⇒ 传 new IllegalStateException("extension command receipt is not terminal")
          ⑤ 收尾 UPDATE 检查受影响行数,不为 1 抛 ExtensionReceiptCorruptException
ACTION    替换
FORBID    ⛔ 不得保留 catch (DuplicateKeyException) 兜底 —— 那正是缺陷
          ⛔ 不得用 SAVEPOINT 绕过
          ⛔ 不得新增无 cause 构造器 —— ExtensionReceiptCorruptException 只有 (Throwable) 一个
          ⛔ 「插入而非缺行锁是线性化点」那句注释保留
          ⛔ **不得新造错误码** —— ExtensionReceiptCorruptException 已在
             ContractProblemAdvice 的 @ExceptionHandler 列表内,统一映射 500 + PLATFORM_COMMON_RESULT_UNKNOWN
INVARIANT SELECT 语句、终态判定、异常类型逐字不变;对外方法签名不变
PROOF     档 2:**单线程顺序重放** —— 一个事务提交后,另开事务用同 key 再调一次。
          ⛔ 不需要并发即可复现;不得把 PROOF 写成「两独立事务并发」
DEPENDS   无
```

#### CP-P2-02 · 同根扫描的另一个成员

⚠️ `AGENTS.md` 第 58 行禁止单点修补。已扫,`catch (DuplicateKeyException)` 后仍发 SQL 的共 **2 处**:

| 位置 | catch 之后 | 判定 |
|---|---|---|
| `ExtensionCommandReceiptService` | 发 SELECT | 中招(`CP-P2-01` 修) |
| **`PlatformAssetService`**(约 349 行) | `findCatalogByStorageKey(...)` 发 SELECT | **同形态,须核事务上下文** |
| `ContractCommandService` ×2 · `OrganizationCommandService` · `BusinessEntityService` ×2 | 立刻 `throw` | 安全 |

```text
FILE      modules/asset/.../PlatformAssetService.java
LOCATE    锚点 `} catch (DuplicateKeyException race) {`
AFTER     第一步:上溯调用链确认是否在事务内(writeStagedContent ← stageContent,两者皆 private 无注解)
          - 在事务内 ⇒ 同缺陷,按 CP-P2-01 同形态修
          - 不在事务内 ⇒ 记录结论,本轮不动,写入 HANDOFF
FORBID    ⛔ 未确认事务上下文前不得改;⛔ 不得只修 extension 而不给本条结论
INVARIANT 解释「只有 catalog 有内容级唯一约束」的那段注释保留
DEPENDS   无
```

### 第二梯队 · 缺陷 B

#### CP-P2-03 · 三个 `replay()` 首行加 advisory lock

```text
FILE      CatalogOwnerService · InventoryOwnerService · ProductionTagOwnerService
LOCATE    **方法签名** private JsonNode replay(...) (分别约 6307 / 3341 / 1177 行)
BEFORE    三处方法体首条语句均为 jdbc.query("SELECT operation_id,request_hash,response::text FROM
          <schema>.command_receipt WHERE ... FOR UPDATE", ...)
          ⚠️ 三处 SQL 的**字符串切点各不相同**(catalog 有 "resp"+"onse";inventory 有
          "request_has"+"h,re"+"sponse";production 有 "operation_i"+"d,re")
          ⇒ **实施时以方法签名定位、逐字读当前源码,不得照抄本文引文**
AFTER     ① 在方法体**第一条语句之前**插入:
             jdbc.queryForList(
                     "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))",
                     <scopeArg>, <keyArg>);
             实参用该方法已有的两个形参(catalog 是 dataNodeRef/key;inventory 与 production 是 scope/key)
          ② SELECT 去掉 FOR UPDATE（缺行锁无效,且锁已由 ① 提供）
          ③ 其余逐字不变
ACTION    新增 + 删除
FORBID    ⛔ 不得改方法签名、返回类型、任何既有分支
          ⛔ 不得改成 pg_advisory_lock(非 xact 版,不随事务释放)
          ⛔ 不得抽到 foundation —— 那是 P-1,已裁定推迟(见 §5 的冲突登记)
          ⛔ 不得保留 FOR UPDATE 作「双保险」—— 它对不存在的行无效,留着让人误以为有保护
INVARIANT ① 返回值语义与当前逐字节相同(有回执返回 response,无回执返回 null)
          ② IDEMPOTENCY_MISMATCH 的触发条件与响应逐字不变
          ③ 方法的事务传播行为不变
PROOF     档 2:三个 owner 各一个并发测试类,用例见 CP-P2-06
DEPENDS   无
```

#### CP-P2-04 · 三处 `saveReceipt` 不再吞冲突

```text
FILE      同上三个文件
LOCATE    **方法签名** private void saveReceipt(...)
BEFORE    catalog:INSERT ... ON CONFLICT (data_node_ref,idempotency_key) DO NOTHING,**返回值被丢弃**
          inventory / production:INSERT 无 ON CONFLICT,返回值同样被丢弃
AFTER     ① catalog 删掉 ON CONFLICT 子句(锁已排除并发,吞冲突只会掩盖真实缺陷)
          ② 三处均改为检查 jdbc.update 的返回值,不为 1 抛该 owner 的 Problem
ACTION    删除 + 替换
FORBID    ⛔ **不得丢弃 jdbc.update 返回值** —— 丢返回值正是本缺陷的原始形态
          ⛔ 不得改成 upsert
          ⛔ **不得新造错误码** —— 复用该 owner 既有的 Problem 类型;
             若需「结果未确认」语义,定义 `<Owner>ReceiptCorruptException` 并加进
             `ContractProblemAdvice` 的 @ExceptionHandler 列表(该列表已有七个同族异常,
             统一映射 500 + `PLATFORM_COMMON_RESULT_UNKNOWN`)。**三行,不要裸码**
INVARIANT response 的 canonical JSON 序列化方式逐字不变
PROOF     档 2:并发用例「同 key 同请求 ⇒ 业务写只发生一次」
DEPENDS   CP-P2-03
```

⚠️ **为什么不能裸码**:全仓 `RECEIPT_CORRUPT` 命中 **0**;
前端 `EDGE_PROBLEM_CODES` 是**生成的闭集**并有精确集合相等测试;
契约侧还有逐 operation 的问题码闭集与 `P1_PROBLEM_EXACT_SET` 校验。
未登记的码 ⇒ 前端静默回落 `RESULT_UNKNOWN` —— **正是需求正本 S-1 亲手描述的失败模式**。

#### CP-P2-05 · C4 的外层锁退役

```text
LOCATE    锚点 `lockBatchStatusReceipt(dataNodeRef, receiptKey);`
          与方法签名 private void lockBatchStatusReceipt(...)
BEFORE    C4 在调用点先取锁,再调 replay()
AFTER     两处删除 —— CP-P2-03 已把同一把锁下沉进 replay(),外层重复
ACTION    删除
FORBID    ⛔ 必须在 CP-P2-03 通过并发用例后才删;⛔ 不得只删调用留方法体
INVARIANT C4 的 item-level REQUIRES_NEW 部分成功语义不变;锁键与粒度不变
PROOF     档 2:C4 并发用例在删除后仍绿
DEPENDS   CP-P2-03 · CP-P2-06
```

#### CP-P2-06 · 三个并发测试类

```text
AFTER     每 owner 至少三条:
            ① 两独立事务 · 同 key · 同请求 ⇒ **业务写只发生一次**
            ② 两独立事务 · 同 key · 不同请求 ⇒ IDEMPOTENCY_MISMATCH 409,不是 500
            ③ 业务失败回滚 ⇒ 无回执残留,同 key 重试可正常执行
          catalog 额外:C4 部分成功语义未变
          **前置断言**:SHOW transaction_isolation = 'read committed'
          **测试台**:两条 DriverManagerDataSource 各取一个 Connection、setAutoCommit(false)、交错调用;
                      service 构造时传入 DataSourceTransactionManager
FORBID    ⛔ 用例 ① 是**核心命题的唯一承载者**(见 §4),不得省略
          ⛔ 不得用单线程顺序调用冒充并发(CP-P2-01 的顺序重放是它的正确形态,不适用本条)
PROOF     档 2 本身
DEPENDS   CP-P2-03 · CP-P2-04
```

⚠️ inventory / production 的构造器**没有 `PlatformTransactionManager` 形参**,现有测试全裸 `JdbcTemplate`。
本 CP 须先把测试台改造做掉,否则用例 ③ 写不出来。

#### CP-P2-07 · 三个 receipt service 的 advisory key 构造性碰撞

```text
FILE      CommercialGroupCommandReceiptService · OrganizationHierarchyCommandReceiptService
          · WorkspaceIamCommandReceiptService
LOCATE    锚点 `pg_advisory_xact_lock(hashtext(? || ':' || ?))`
BEFORE    三处**逐字节相同**,实参均为 workspaceUuid.toString(), key
AFTER     各加模块前缀:hashtext('commercial-group:' || ? || ':' || ?) 等
FORBID    ⛔ 不得改成两参数形式;⛔ 不得动 WorkspaceCommandReceiptService(第一实参是 groupWorkspaceKey)
INVARIANT 锁粒度语义不变
DEPENDS   无
```

**性质**:同 workspace + 同幂等键在**三张不同回执表**上取到同一把锁,**构造性必然碰撞**。
⚠️ 不破坏正确性(唯一索引兜底),后果是跨模块过度串行化 + 三个模块耦合进同一张死锁图。
⚠️ `hashtext` 是**未文档化的内部函数**,collation 相关、无跨版本兼容承诺 ⇒ ⛔ 绝不能作持久化 key。

---

## 3.3 无事务路径:本轮不修,如实登记

`CatalogOwnerService` 两个便捷构造器把 `transactions` 传 `null`(约 65、75 行),
两处 `if (transactions == null)`(约 434、470 行)退化为不开事务;
`transitionCatalogItemStatuses`(约 421 行)**无 `@Transactional`**,靠那条分支。
inventory / production 的测试全裸 `JdbcTemplate`,`@Transactional` 无 Spring 代理即空注解。

⇒ 这些路径上 `pg_advisory_xact_lock` 语句结束即释放,**本轮修复不覆盖它们**。

**但它不构成回归** —— 今天这些路径同样无保护。
生产路径走 `@Autowired` 七参构造器 + `@Transactional`,**是安全的**;
那两个便捷构造器在仓内的调用点**全部在测试**。

⇒ 写入 `HANDOFF.md`:「catalog 的无事务便捷构造器与 `transitionCatalogItemStatuses` 缺 `@Transactional`」。
⛔ 本轮不删、不补 —— 删它会让 7 处测试编译失败,而收益是覆盖一条生产不可达的路径。

---

## 4. 门

⚠️ **本册不设静态文本门。**

理由:该仓的 SQL 被 `palantir-java-format` 自动断行(`"resp" + "onse"` 就是这么来的),
任何子串门都会被格式化器自发弄红或绕过。
**核心命题「业务写之前取得唯一执行权」完全由 `CP-P2-06` 的用例 ① 承载。**
档 2 行为证据比文本门强一个量级。**不粉饰。**

---

## 5. 需要 Dexter 知情的两处冲突(本轮不阻塞)

**一 · P-1 的立场冲突**
`doc/platform/backend-coding-standard.md` §2-E 记录了 Dexter 的原话:
「该抽象到 foundation 的需要抽象,**现在这个阶段不抽象,后面走的会更乱**」,
并给出根因:「**根因不是纪律,是位置**:`modules/foundation` 没有 JDBC 依赖…
**先给 foundation 加 JDBC 依赖,再谈『不要重复』才有意义。**」

而需求正本以「租户键形态未定」推迟 P-1,`00` 的全局禁止清单据此写「⛔ 新建跨 owner 抽象层」。

⇒ **本轮选 advisory lock 后,P-1 不再是本册的前置**(不需要共享 helper),冲突不阻塞。
但「给 foundation 加 JDBC 依赖」是一个**独立且便宜**的前置动作,值得单独裁。

**二 · `/actuator/health` 已有裁决**
`HANDOFF.md` 的 `HEALTH_READINESS` 记着「**不建第二端点**」,
激活条件是 `ORCHESTRATOR_REQUIRES_PROBES`,当前无编排器。
⇒ **撤回 2026-08-17 的「手写五行健康端点」裁决**,O-5 回到 HANDOFF,不在本轮做。

---

## 6. 未验项

- PostgreSQL 阻塞与锁语义:**官方文档级证据**,本轮未实跑
- 三处 `replay()`/`saveReceipt()` 的 SQL 字符串切点各不相同,本文只给方法签名 ⇒ **实施时必须读当前源码**
- `PlatformAssetService` 的事务上下文:**差一跳未确认**
- 测试台改造工作量:**未逐个打开确认**
- 全册零编译、零测试、零动态运行

---

## 7. 第四版为什么改机制

| 编号 | 第四版 | 本版 |
|---|---|---|
| **C-1** | 取舍表拿「advisory lock 在 21 个调用点」比「insert-as-claim 在 `replay()` 内」—— **同时变了机制与位置**,第三候选(advisory lock 在 `replay()` 内)从未构造 | §2.2 三候选同位置重比;**「调用点归零」是位置带来的,两个候选都拿得到** |
| **B-3** | 判 advisory lock「仓内先例:无」 | **错的。** C4 的第 450→452 行就是该形态,且本册自己标它「已合规」 |
| **B-3** | 判 insert-as-claim「已跑通」 | 证据只是一句注释;`apps/backend` 全部测试**零并发覆盖**该路径 |
| **C-2** | 判无事务时 insert-as-claim「照样正确」 | **反了。** 它会让幂等键永久 500;advisory lock 只是退化成今天的行为 |
| **E-2** | 新造裸码 `RECEIPT_CORRUPT` | 全仓 0 命中;前端是生成闭集且有精确集合相等测试 ⇒ 改用既有的 `*ReceiptCorruptException` + `ContractProblemAdvice` 注册 |
| **B-4/B-5/S-3** | 三态契约漏第四态;AFTER 与 INVARIANT 判定顺序互斥;AFTER 未写「读 `state` 要改 SELECT 列表 + 扩 `Receipt` record + 改行映射」 | **随机制更换整体消失** —— 本版不改返回契约、不加列 |
| **A-4** | 裁定手写 `/actuator/health` | **撤回** —— `HANDOFF.md` 的 `HEALTH_READINESS` 已裁「不建第二端点」 |
| **A-1** | 全局禁止清单写「⛔ 新建跨 owner 抽象层」,未处置仓内规范记录的 Dexter 相反立场 | §5 显式登记冲突 |
| — | 迁移 + state 列 + 三态 + 新错误码 + 收尾语义反转 | **全部不需要** ⇒ CP 从 13 降到 7 |
