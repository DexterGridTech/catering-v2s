# 第零批 · 缺陷与验收判据(4 条)· **v3(文档形态已更换)**

## 本文的形态,以及为什么换

**v1 / v2 指定了精确的 SQL、超时值与测试设计。两轮独立对抗审查累计抓出四条实质错误,全部集中在这一层**:锁查询会造成生产回归、修的方法生产不可达、漏了两层调用链、BP-U06 语义说反。根因相同——**作者在没有走完调用链、没有确认调用方实际提交什么的情况下写了修法**,而这些细节作者静态验证不了(不能编译、不能运行、不知道测试设施的能力)。

反过来,**作者亲验过的部分——缺陷在哪、为什么是缺陷——两轮下来一条未被推翻。**

故 v3 只写两样:

1. **缺陷事实**:是什么、在哪、为什么是缺陷。逐条亲验,含两轮审查追加的事实。
2. **验收判据 + 反例**:可证伪,且**不依赖具体实现手法**。

**修法、SQL 形态、参数绑定、测试如何搭建,由 Codex 在仓内决定**——那里能编译能运行。下一轮作者只核"判据是否被满足",不核"是否按作者设想的方式实现"。

**Dexter 2026-08-14 裁定采用本形态。**

---

## 0. 全批硬约束(不可由实施方自行放宽)

| # | 约束 | 为什么不可放宽 |
|---|---|---|
| **H1** | **0-4 的锁定/校验查询不得带 `status <> 'VOIDED'` 过滤** | 有明确的生产回归先例,见 §4「已知的坑」。这是判据不是手法 |
| **H2** | **每条负向用例必须先在修复前跑并看到失败** | 否则无法区分"修好了"与"用例没测到东西"。两轮审查中已有三条用例被证明"修复前就是绿的" |
| **H3** | **四条各自独立提交,可单独评审** | 混提会让任一条的回归无法定位 |
| **H4** | **本批不改 `contracts/` 下任何文件** | 契约变更属第三部分,需单独裁定 |
| **H5** | **不得为测试在生产代码里开暂停点/测试缝** | 与 H3 的可评审性冲突 |
| **H6** | **降级掉的测试必须写进 `HANDOFF.md` 欠账** | 静默降级等于没修 |

---

## 1. 【0-1】库存台账跨租户数据泄露

### 缺陷事实(逐条亲验)

**这是本轮唯一确认的跨租户数据泄露。** 任一租户的已认证运营用户,只要会话自身具备任意 STORE scope,对**任意** `targetRef` 即可读到完整库存流水(`/ledger`,可分页全量)、时间窗聚合(`/changes`)、业务变更历史(`/business-history`)。

| # | 事实 | 位置 |
|---|---|---|
| F1 | typed 读路径是**四层**,中间两层**同样缺 scope**;同族的 `consumptionReferences` 四层都带 `dataNodeRef, brandRef` | `OperationsCatalogInventoryController` → `CatalogInventoryCoordinator` 第 151–165 行 → `InventoryTaskReadService` 第 22–40 行 → `InventoryOwnerApi` 第 27–31 行 |
| F2 | 控制器在**同一行**解析出 scope 后不传 | `OperationsCatalogInventoryController` 第 160 / 166 / 178 / 184 行 |
| F3 | 三条读路径的 SQL 无租户谓词 | `InventoryOwnerService` 第 1204 / 1109 / 1119 行 |
| F4 | `inventory.stock_ledger` **无任何租户列**,DB 层无兜底 | `V20260806_120000_000__catalog_inventory_backend.sql` 第 88–98 行 |
| F5 | `requireScope(scope, brand)` **只判空,不做授权** | `InventoryOwnerService` 第 1497 行 |
| F6 | owner 内部另有一条 legacy 分发器,**直接调私有 helper,绕过 public 方法** | `InventoryOwnerService` 第 88–97 行 |

**F6 的处置(v2 说反了,已更正)**:该分发器**当前无生产调用方**(`CatalogInventoryCoordinator` 第 52 行的 `INVENTORY_READS` 是死常量)。v2 称"BP-U06 切流当天会激活它"——**错**;`doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` 第 212 行写的是 BP-U06 要 **retire 旧签名/dispatcher**。故它是**待删除项**而非待启用项。

**暴露面的准确口径**:`stock_ledger` 共 12 处 SQL,但其中 `ledgerEntries` / `recentChanges` / `loadChangeSnapshots` 只能经已 scope 化的入口到达,**不构成独立暴露面**。真正的暴露面是上面 F3 的三条。

### 需要一个决策(不由实施方单方定)

**`readTargetDiagnostics` 纳不纳入本批?** 它返回常量外壳、零 DB 访问,**确认不泄露**。纳入的收益是路径一致性;代价是**行为变更**——任意 `targetRef` 从"常量成功"变成"不存在则 404"。若认为 target-scoped 是该端点应有的契约则纳入,否则应作为独立的契约决策另行处理。**请实施方给出建议并请 Dexter 拍板,不要默认纳入。**

### 验收判据(自带反例,不指定手法)

| 判据 | 反例(出现即不成立) |
|---|---|
| **所有能到达 `stock_ledger` 的入口,在取数之前都已解析 targetRef 的归属** | 存在任一入口只凭 `targetRef` 就能取到数据 |
| 四层调用链上**没有任何一层**丢失 scope | 任一层的签名不携带 scope,却把 `targetRef` 传给了下一层 |
| 跨租户请求返回 404(不是 403) | 返回 403 → 向调用方确认了"这个 UUID 存在但你没权限" |
| 跨租户、跨门店的负向用例覆盖 F3 的三条路径**与 F6 的 legacy 入口** | 任一路径无负向用例 |
| 负向用例**修复前跑是红的** | 修复前即绿 → 重写用例 |
| 同租户正向读**不回归**,返回条目数与写入数一致 | 正向用例缺失或只断言状态码 |
| **只调 `requireScope` 不算满足任何一条上述判据** | 实现里以 `requireScope` 作为唯一的隔离手段 |

### 明确不指定

签名如何改;用既有的三谓词查询还是新增存在性校验;`InventoryTaskReadService` 与 `CatalogInventoryCoordinator` 两层的具体形态;既有 focused test(如 `CatalogInventoryReadTransactionTopologyTest`)如何同步;legacy 分发器是就地加守卫还是随 BP-U06 一并删除——**后者由实施方按 BP-U06 的排期决定,但本批不得让它继续以无守卫状态存在**。

---

## 2. 【0-2】MinIO 调用无上界,叠加事务内持锁

### 缺陷事实

| # | 事实 | 位置 |
|---|---|---|
| F1 | minio 8.5.17 的默认超时是 connect / write / read **各 5 分钟**(不是"无超时",v1 的说法是错的) | `modules/asset/build.gradle.kts` 第 10 行声明版本;默认值已由 Codex 对**实际解析到的 jar** 确认 |
| F2 | minio **不设 `callTimeout`**,即没有调用级硬上界;socket 级超时在慢速滴流下永不触发 | 同上 |
| F3 | 对象存储调用在 `@Transactional` 边界内,且持有两把 `pg_advisory_xact_lock` | `PlatformAssetService` 第 68–79 / 141–164 行 |
| F4 | 一次 stage 最多串起 **5 次**网络往返:`ensureBucket` 内的 `bucketExists` +(可能)`makeBucket` + **每次都执行的** `setBucketPolicy`,再加 `exists` 与 `put`;`bucketPrepared` 只在成功后置真,失败即每请求重来 | `MinioAssetObjectStorage` 第 45–56 / 78 行 |

### 口径限定(**必须遵守**)

**本批只能声称"独立的 fail-fast 缓解",不得声称已关闭事务持锁风险。**

理由:调用级超时约束的是**单次**调用,而 F4 说明一次 stage 是多次调用的串联,事务持锁时长的上界是它们之和。**真正关闭该风险需要 stage 级 deadline 或事务改造(M-01),不在本批。**

**本批与 M-01 可以分离**——这一点经独立盲审专门攻击且未被推翻:超时触发 → unchecked 异常 → 穿出 `@Transactional` → 默认回滚 → 两把 advisory lock 释放;且对象清理注册在 `afterCompletion`(事务**完成之后**才发网络调用)、临时文件在 `finally` 删,**清理不会二次拖长持锁**。
**但这条分离性依赖"超时确实会触发"**——所以调用级硬上界是本批成立的前提,不是可选项。

### 验收判据(自带反例,不指定手法)

| 判据 | 反例 |
|---|---|
| 对象存储调用存在**调用级**硬上界,慢速响应下也会失败 | 只设了 socket 级超时 → 对端持续滴流时调用不终止 |
| 有一条用例证明**慢速滴流**下调用在有限时间内失败 | 无此用例,或用例只验证连接不可达 |
| 有一条用例证明**连接不可达**时快速失败,且**修复前是红的** | 用例使用"关闭的端口"(回 RST,毫秒级失败,修前修后一样绿) |
| 用例的时间断言钉死**具体上界**,且该上界按 F4 的多次往返计算 | 断言写成"在超时时限内失败"(修复前也满足,不可证伪) |
| 结论陈述中**没有**"已关闭事务持锁风险"一类表述 | 出现该表述 → 违反口径限定 |

### 明确不指定

具体秒数;走哪条 API 注入上界;慢速桩与不可达端点用什么设施构造(受控 proxy / container / socket 桩由实施方按仓内测试设施选)。

---

## 3. 【0-3】`SCOPE_FORBIDDEN` 吞掉原因,且堆栈不存在于任何地方

### 缺陷事实

| # | 事实 | 位置 |
|---|---|---|
| F1 | `resolvedBrand` 捕获 `RuntimeException` 后**丢弃 `failure`**,一律报 403「当前会话没有已授权品牌」。它被 `readRequest` 调用,即**每一个 catalog-inventory 读端点都跑** | `OperationsCatalogInventoryController` 第 385–388 行;调用点第 319 行 |
| F2 | 同形的第二处,被 `/copy/brand/candidates` 调用 | 同文件第 350–352 行 |
| F3 | 全局异常映射的日志**不传 throwable**,只打 cause 的类名 | `ContractProblemAdvice` 第 66–68 行 |
| F4 | 四参构造器(带 `Throwable cause`)**已存在**,无需新增 | `CatalogOwnerApi.Problem` 第 198–212 行 |
| F5 | v1/v2 原本要改的 `resolveBrandCopySource`,**唯一调用方是单元测试**,生产不可达 | `CatalogInventoryCoordinator` 第 715 行;调用方 `CatalogInventoryCoordinatorCopySourceAuthorityTest` 第 32 行 |

**F3 是本条的关键**:只把 cause 传给 `Problem` 而不动日志,**堆栈仍然不会出现在任何地方**,排查者拿到的只是一个类名。**本条的目标是"真实堆栈可被查到",不是"cause 字段非空"。**

### 验收判据(自带反例,不指定手法)

| 判据 | 反例 |
|---|---|
| 经过 F1 / F2 两处路径抛出的 403,其**原始异常堆栈可在日志中查到** | 日志里只有异常类名,没有堆栈 |
| 对外响应的状态码与文案**无变化** | 任一既有测试因状态码或文案变化而失败 → 说明顺手收窄了 catch 范围(属第一部分,不在本批) |
| 日志**不含**原始请求体、凭据或其他敏感字段 | 记录了 raw payload 或含敏感信息的 message |
| 用例走**真实 controller 调用路径**并捕获日志,**修复前是红的** | 用例退化为"直接构造 `Problem(code,status,message,cause)` 并断言 cause 可取回"——该构造器早已存在,此用例现在跑就是绿的 |

### 明确不指定

在哪一层传 cause;日志如何改造;用什么设施捕获日志断言。`resolveBrandCopySource`(F5)可顺手一并改,但**不计入本条收益**,且它属于"只被测试调用"的死代码范畴,归第一部分处理。

---

## 4. 【0-4】字典重排并发交错

### 缺陷事实

| # | 事实 | 位置 |
|---|---|---|
| F1 | 逐条 UPDATE,**无 version 谓词** | `CatalogOwnerService` 第 1474 行 |
| F2 | 前置 recheck 只是**不加锁**的 `SELECT COALESCE(MAX(version),0)` | 同文件第 555 行 |
| F3 | `display_order` 上**无唯一约束**,数据库不会拦重复值 | `V20260806_120000_000__catalog_inventory_backend.sql` 的 `dictionary_entry` 建表 |
| F4 | 契约里**没有 `expectedVersion`**,required 只有 `dictionaryKind` / `orderedCodes` / `dataNodeRef`,且 `additionalProperties: false` | `contracts/openapi/catalog-inventory.openapi.yaml` 第 9920–9945 行 |

**后果**:两个并发重排的逐行 UPDATE 交错,产生重复的 `display_order`,排序被写坏。**F4 决定了本批不能靠乐观版本解决**——那需要契约变更,属第三部分。

### 已知的坑(**H1 的依据,必须避开**)

**锁定/校验查询若带 `status <> 'VOIDED'`,会把线上正常的重排全部变成 404。** 三环链路逐条亲验:

1. 字典读 SQL 的 `WHERE` 只有 `data_node_ref` / `brand_ref` / `dictionary_kind`,**不过滤 status**,VOIDED 条目照样返给前端 —— `CatalogOwnerService` 第 1933 行;
2. 前端 `rows` 直接映射返回的 entries,**不过滤 status** —— `CatalogDictionaryDrawer.tsx` 第 179–181 行;
3. 提交的 `orderedCodes` 由 `rows.map` 生成,即**含 VOIDED 的完整列表** —— 同文件第 169 行。

今天这条路径是通的:现有 UPDATE 的 `status <> 'VOIDED'` 让 VOIDED 的 code 静默跳过、其余照排。**任何引入"按非 VOIDED 集合做数量校验"的实现都会造成回归。**

### 需要定义的契约缺口

**当前实现对 `orderedCodes` 里的重复 code、遗漏 code 没有任何拒绝。** 仅比较集合大小不足以证明提交的是完整且无重复的字典集合。**请实施方明确 owner 层契约**:是要求提交完整无重复集合(则重复/遗漏应拒绝),还是允许 partial reorder(则最终不变量要重新定义)。**这一项定完才能定用例的最终断言。**

### 验收判据(自带反例,不指定手法)

| 判据 | 反例 |
|---|---|
| 两个并发的、顺序不同的重排完成后,`display_order` **无重复值**,且最终顺序等于其中某一次提交的完整顺序 | 出现重复值,或出现两次提交的混合顺序 |
| 并发用例是**确定性**的,不依赖线程竞速 | 用例靠 sleep 或线程调度制造交错 → 红绿两个方向都不稳 |
| 并发用例经过**真实事务边界** | 直接构造 owner service 绕过事务代理 → `FOR UPDATE` 证明不了跨完整重排持锁 |
| 并发用例**不要求在生产代码里开测试缝** | 为测试在生产代码加暂停点 → 违反 H5 |
| **正向用例的 fixture 含至少一条 VOIDED 条目,且按前端行为提交完整列表** | fixture 无 VOIDED → 守不住 H1 |
| 重复 code / 遗漏 code 的行为**已定义且有用例覆盖** | 契约未定义,或定义了但无用例 |
| 负向用例**修复前是红的** | 修复前即绿 |
| **契约文件未被改动** | `contracts/` 出现在本批 diff |

### 明确不指定

用什么并发控制手段;SQL 形态与参数绑定方式;确定性并发用例如何构造(双连接 + barrier / 数据库触发器 / 其他,由实施方按仓内设施选)。

---

## 5. 作者亲验状态与审查历史

**已亲验(打开源码逐字确认)**:全部四条的缺陷事实(§1–§4 的 F 列),包括两轮审查追加的四层调用链、BP-U06 语义、字典 VOIDED 三环链路、`resolveBrandCopySource` 的唯一调用方。

**未亲验、依赖他方**:minio 8.5.17 的默认超时值(由 Codex 对实际 jar 确认,作者未验);`CatalogInventoryReadTransactionTopologyTest` 的具体内容(由 Codex 指出,作者未打开)。

**作者全程未做**:编译、运行任何测试、任何数据库或环境操作。前端只查了 operations-admin 的字典抽屉一个重排入口,**platform-admin 侧未查**;未核 `scripts/verify` 的实际门集合。

**审查历史**:
- v1 → fresh 独立子 agent 两阶段盲审(阶段一禁读 `doc/` 自行推导修法,阶段二攻击):`NO-GO`,2 M / 6 S / 5 N;
- v2 → Codex 只读评审:`NO-GO`,3 M / 5 S / 2 N;
- **两轮累计四条实质错误全部出自作者的"修法"部分,缺陷事实部分零推翻** —— 这是本次更换文档形态的直接依据。
- 按两轮硬上限,本 v3 以 `SELF_DECIDED` 收口。

---

## 6. 授权边界

本文只给缺陷事实与验收判据,**不给修法,也不授权实施**。修法、SQL、测试设计由实施方在仓内决定。§0 的六条硬约束与各条的验收判据不可由实施方单方放宽;§1 的 `readTargetDiagnostics` 纳入与否、§4 的重复/遗漏 code 契约,需实施方给建议后由 Dexter 拍板。实施范围与时机由 Dexter 裁定。
