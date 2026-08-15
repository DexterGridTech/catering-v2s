# 第二部分 · 与商品域无关的具体缺陷 · **v2(已过一轮独立盲审 + 14 条断言逐条亲验)**

- **形态**:承第零批 v3 裁定——**只写缺陷事实与验收判据,不写实施手法**。
- **审查状态**:v1 交 fresh 独立子 agent 两阶段审查(阶段一逐条亲验 14 条 ⚠️ 断言,阶段二攻击批次计划),verdict **`NO-GO`,3 M / 6 S / 7 N**。**三条 M 均经 Claude 复核成立。**
- **本文不授权实施。**

---

## 0. v1 那条"进批次前必须亲验"的纪律,本轮已执行完毕

v1 说本部分几乎全是 ⚠️ 未验条目、每批第一步必须亲验。**盲审把这件事一次性做完了,结论印证了那条先验并且更狠:14 条断言里 4 条完全不成立、另有 5 条需要重大限定或部分推翻,只有 5 条原样成立。**

**同时纠正 v1 的一处结构错误**:亲验应当是**组批的前置**,不是**每批的第一步**。理由:按批亲验会把并行变串行、成本前置到无法排期,而且看不见跨批的关联——这一轮正是因为一次性验完,才发现 S-11b 与 S-14 改的是同一个 for 循环、M-02 与资产条目有顺序依赖。**这两条按批亲验永远看不见。**

### 14 条亲验结果

| 断言 | 判决 |
|---|---|
| 资产 early-return 可跨租户**认领** | ✅ 成立,已追到 HTTP 入口 |
| 同两条 UPDATE 可让 A 的图片**失效** | ❌ **不成立**——生产路径不可达 |
| 内容寻址复用改写 `workspace_uuid` | ✅ 成立(但只在 `status='RELEASED'` 时触发,故只影响历史归属;见 §1 M-2 与 §2.I) |
| owner 回执缺 `brand_ref` | ✅ **升为亲验**,限定:只有 `create*` 完全暴露 |
| `platform_workspace.workspace_command_receipt` 主键 | ✅ 事实成立,**但定性不成立**——调用方是全局运维管理员,不存在第二个租户 |
| asset 回执 `legacy` 通配 | ✅ 成立,**但规模高估一个数量级**——代码里没有任何地方写 `'legacy'`,只影响 2026-08-11 前历史行 |
| `invitation` 缺三列索引 | ✅ 成立(「每行一次全表扫」未跑 EXPLAIN,标 `UNVERIFIED`) |
| `workspace_session` 缺 `(account_id, status)` | ✅ 成立,**但 v1 的"不是第 38 行"是过度更正**——`:38` 同样 `account_id` 打头,同一条索引一并服务 |
| 两条严格前缀索引 | ✅ **升为亲验**,且精确定位为 `ix_stock_target_scope_item_ref` 与 `ix_stock_bom_scope_item_ref` |
| 三条死索引 | ⚠️ **静态无法确认**;且 `ix_production_tag_scope_status` 有静态反证(`ProductionTagOwnerService` 第 45 行前两列完全匹配) |
| `stock_ledger` 无 scope 列无 FK | ✅ 成立 |
| `organization_node.parent_id` | ❌ **危害不可达**——`validateParent` 钉死树深恒为 2 且 parent_id 创建后不可变;另"五处"实为 **≥13 处** |
| 版本化迁移用 `IF NOT EXISTS` | ✅ 成立(最危险处的候选与 v1 不同) |
| 低库存告警永久静默 | ❌ **两条推论都不成立**,前提不可达(见 §3.1) |
| 循环里发 SQL | ✅ 成立,**且被低估**(还有第三个循环、第二处同形) |
| OFFSET 分页且 cursor 就是 offset | ❌ **四条里三条没有 cursor**,是诚实的页码分页 |

---

## 1. v1 → v2 的三条阻断级更正

### M-1 · v1 推荐的死索引判据**会删掉活索引**

v1 写:用 backend-acceptance 的 8 条场景当 workload,然后 `SELECT … FROM pg_stat_user_indexes WHERE idx_scan = 0`,并称"这是运行证据不是推论""零成本",反例列写"靠静态论证判定"。

**这条判据是错的,而且错的方式正是仓内刚退役那套控制面的失败模式。** 按 `CLAUDE.md`,那 8 条场景是 **IAM、ORG、商业合同和 asset**;而 S-12 的三条嫌疑索引分别在 **inventory** 与 **fulfillment-production**——**这 8 条场景一次都不会碰到它们**。于是这两个 schema 下的**每一条**索引都会显示 `idx_scan = 0`,包括真正被生产路径使用的。

**照这条判据执行会删掉活索引,而且删完之后门是绿的。** 我把一个不完备的静态论证,换成了一个**系统性偏置**的动态证据,反例还指错了方向。

**处置**:`idx_scan = 0` 只能作**必要条件**。完整判据需要"该索引前导列在全仓生产 SQL 中不出现在任何 WHERE / ORDER BY / JOIN" **且** "覆盖该表的 acceptance 场景存在"。第三项当前不满足 → **S-12 现在判不了,进 `HANDOFF.md`,不进批次。**

### M-2 · 裁定 A 之下真正的跨租户路径不在 v1 里(**阻塞已由裁定甲解除,见本节末**)

**v1 记的 early-return 需要租户 B 先知道 A 的 assetRef(UUID)。而有一条门槛低得多的路径 v1 完全没提。**

`PlatformAssetService` 第 623–626 行:

```java
private ExistingAsset findCatalogByStorageKey(String objectKey) {
    return jdbc.query(
        "SELECT asset_ref, usage, status, content_type, size_bytes, sha256 FROM platform_asset.staged_asset WHERE storage_key=? AND usage='CATALOG_ITEM_IMAGE'",
```

**无 workspace 谓词。** 而 `objectKey`(第 146 行)是 `objects.objectKey("static/" + digest + suffix(contentType))` —— **纯内容派生**。调用点在第 159 行(stage 主路径)与第 196 行(DuplicateKey 兜底)。

**后果:租户 B 只要手上有一份与租户 A 现役商品图字节相同的文件,上传后就会拿到 A 的 assetRef 加一把全新的 bind grant。** 门槛从"知道 UUID"降到"有同一张图"。而 `issueBindGrant` 的 `ON CONFLICT (asset_ref) DO UPDATE … consumed_at_epoch_millis=NULL` 还会清掉 A 那把 grant 的消费记录。

**DDL 层的硬约束**(裁定甲要求改的就是它):`V20260812_130000_000` 第 14–16 行

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_asset_catalog_bucket_object
    ON platform_asset.staged_asset (bucket_name, object_key)
    WHERE usage = 'CATALOG_ITEM_IMAGE';
```

**不含 workspace 列。** 裁定 A 要求"每 workspace 一份逻辑资产",而这条唯一索引在物理上禁止它:两个租户上传同一张图,第二个必然撞唯一约束,兜底逻辑又会把他导回第一个租户的行。

> ### ✅ `DEXTER_DECISION` 已裁定(2026-08-14):**甲 —— 各得一份独立逻辑资产,共用一份物理对象**
>
> 即:**逻辑资产按 workspace 隔离,物理对象按内容去重、跨 workspace 共用。** 2.I 解除阻塞。

#### 甲的实现面(Claude 亲验后:比预想小,两条关键机制已经现成)

**已经现成、不需要新建的两条**:

1. **物理对象的跨 workspace 引用计数已存在。** `deleteUnreferencedObjectAfterRollback`(第 604–611 行)是
   ```sql
   SELECT EXISTS(SELECT 1 FROM platform_asset.staged_asset WHERE bucket_name=? AND object_key=?)
   ```
   **无 workspace 谓词——只要还有任何一行指着它就不删。** 今天它看起来是一对一,只因为那条唯一索引保证了每个对象只有一行;甲之下变成 N 行,**这个检查本来就是对的形态**。
2. **内容去重已存在且与 workspace 无关。** 第 162–165 行:
   ```java
   if (!storageValue("object.stat", () -> objects.exists(objectKey))) {
       storageAction("object.put", () -> objects.put(objectKey, contentType, materialized.sizeBytes(), upload));
   ```
   租户 B 上传相同字节 → `exists` 为真 → 跳过 `put` → 只建自己的逻辑行。**存储去重的收益自动保留,不需要额外设计。**

**需要改的四处**:

| # | 改什么 | 为什么 |
|---|---|---|
| 1 | `uq_platform_asset_catalog_bucket_object` 加 workspace 维度 | 当前 `(bucket_name, object_key)` 在物理上禁止"每 workspace 一份" |
| 2 | `findCatalogByStorageKey`(第 623 行)加 workspace 谓词 | 它是跨租户拿到他人 assetRef 的入口;加谓词后它的语义变成"我这个 workspace 对这份字节的逻辑行" |
| 3 | `restageReleasedCatalogContent`(第 647 行)不再改写 `workspace_uuid` | 甲之下它只应重新启用**自己 workspace 已释放的行**,而不是把别人的行改成自己的 |
| 4 | 第 167–171 行那段注释重写 | 它逐字记录的正是被甲推翻的那条决定——"catalog alone elects **one** reusable logical row for those bytes" |

**一条 N 级副作用(登记,不必处理)**:重复内容的上传会跳过 `put`,因此**明显更快**。理论上租户 B 能由此推断"这份字节已被某人上传过"。这是时序侧信道,信息量极低(不暴露是谁、不暴露内容),且甲之下 B 拿不到对方的 assetRef。**记录在案,不作为 finding。**

### M-3 · v1 的 GIN + `@>` 建议技术上不成立

v1 写"建 `GIN (sections jsonb_path_ops)` 并把谓词改写成 `@>` 包含查询,**语义完全不变**",还标了"不需要裁定、可以先做"。

**不成立。** 那条 SQL 的实际语义(`CatalogOwnerService.catalogAssetRefs`)是:资产引用**既可能是裸字符串、也可能是带 `assetRef` 的对象**,**既可能在 `images`、也可能在 `skus[*].mediaRefs`** —— 四种形态。一个 `@>` 只能表达其中一种;**按 v1 字面(单数"包含查询")实现必然漏掉三种**。

漏掉意味着 `assetRefsStillReferenced` 返回的集合变小,意味着**仍被引用的资产被释放**——**正是 v1 自己在 2.A 判据里列的反例**「悄悄把 fail-safe 的过度保守语义改成可能误释放」。这是踩中自己反例最快的一条路。

另外两点:它是**集合查询**(N 个候选 × 4 种形态 = 4N 个析取项,计划随 N 膨胀);`catalog_item` 当前行数极少,而 GIN 会给**每次商品保存**加写放大,触发端却是"每次资产释放/删图片"这种低频运维动作。**按右尺寸标尺,这条应该是"先不做",不是"可以先做"。**

**并且 M-02 的分类是错的**:那条全平台全表扫**恰恰是当前唯一阻止跨租户释放的保险**(它是"能让 A 的图片失效"不可达的原因)。**它不是隔离缺陷,是隔离保险。** 只有在裁定 A 落地、跨 workspace 引用不再可能之后,收窄它才是安全的——**这条顺序依赖必须显式登记。**

---

## 2. 三个批次(v1 的四批已合并)

**合并理由**:v1 把 M-01 单条成批(v1 的 2.B),理由是"风险最高须单独评审"。但 v1 的 2.B 要改的 `stageContent` 与 v1 的 2.A 资产条目要改的 `restageReleasedCatalogContent` **是同一条执行路径**(前者在第 174 / 200 行调用后者)。两批改同一条路径,先做的评审结论会被后做的推翻。**"能被单独评审"只需要单独成 commit,不需要单独成批。**

> **命名提示**:v1 用 `2.A / 2.B / 2.C / 2.D`,v2 改为 `2.I / 2.II / 2.III`。本文凡出现 `2.A` / `2.B` 均指 **v1 的旧批次**,仅为说明合并理由;当前批次一律用罗马数字。

### 2.I 资产生命周期 —— ✅ 裁定甲已下,无阻塞

**装什么**:跨租户认领(early-return)、`findCatalogByStorageKey` 无 workspace 谓词(M-2)、两条 ACTIVE 释放 UPDATE 无谓词、内容寻址复用的归属改写、**M-01 网络 I/O 在事务内**。

**为什么在一起**:同一个文件、同一条 stage / claim / release 路径、同一组不变量。事务边界改动会移动对象 I/O 相对两把 `pg_advisory_xact_lock` 的位置,而 lock 顺序正是归属判定的前提。

**缺陷事实(✅ 亲验)**
- `findCatalogByStorageKey`(第 623 行)无 workspace 谓词,`objectKey` 纯内容派生,调用点第 159 / 196 行;
- early-return(第 260 行)在"该资产是否属于调用方 workspace"的校验之前,**且在 bindGrant 非空校验之前**;
- 第 421 / 440 行两条 ACTIVE 释放 UPDATE 无 workspace 谓词,而同文件第 290 行的 STAGED 释放**有**;
- 第 647 行的内容寻址复用会 `SET workspace_uuid=?`,但**只在 `status='RELEASED'` 时触发**——作为**当前时刻的授权锚点**该列仍可信,不可信的只是历史归属;
- M-01:第 97 行 `@Transactional` 开始,第 128 / 146 行两把 `pg_advisory_xact_lock`,第 150 行注释称 *Object I/O deliberately happens outside a database transaction*,而第 162 / 163 行紧接着就是 `objects.exists` 与 `objects.put`。**代码与注释相反**;
- 一次 stage 最多串起 5 次网络往返(`ensureBucket` 内 `bucketExists` + 可能的 `makeBucket` + **每次都执行的** `setBucketPolicy`,再加 `exists` 与 `put`)。第零批的 60 秒 `callTimeout` 只是缓解,事务持锁上界是它们之和。

**已被推翻、不要修的**:「能让 A 的图片失效」在生产路径不可达——那两条无谓词 UPDATE 的活调用点被 `assetRefsStillReferenced` 的全平台扫描挡死,HTTP 释放端点走的是有谓词的分支。

**验收判据(自带反例)**

| 判据 | 反例 |
|---|---|
| 所有能读取或改写 `staged_asset` 的路径,归属由 **workspace 锚定或一次性 grant 证明**二者之一提供 | 存在路径只凭 `assetRef` 或只凭内容摘要就能取到他人资产行(**注意:`releaseStaged` 的一次性 grant 是正确授权,不算违规**) |
| 上传与他人现役资产字节相同的文件,**不会返回他人的 assetRef,也不会重置他人的 bind grant** | 能构造出该用例 |
| **差分测试**:改动前后,对同一 DB 状态 `assetRefsStillReferenced` 返回**同一集合** | 集合变小 → fail-safe 被改成可能误释放 |
| 对象存储的网络调用**不在任何持有数据库连接的事务边界内** | 有用例证明"对象存储长时间无响应时数据库连接不被占用"跑不过。**注意这条用例需要可挂起的 stub + 连接池断言,成本明显超分钟级,是本批唯一的重成本项** |
| 那句写反的注释已改 | 注释仍称 I/O 在事务外 |
| 失败路径的清理与临时文件删除行为不变——**具体指 `PlatformAssetServiceTest` 中覆盖 `afterCompletion` 清理与 `finally` 删临时文件的用例仍绿且未被修改** | 那几条用例被改动 |
| 每条都有**修复前是红的**负向用例 | 修复前即绿 |

**明确不指定**:谓词加在哪一层;唯一索引加 workspace 维度的**具体列组合与命名**;`restageReleasedCatalogContent` 改成建新行还是只重启自己的行;事务隔断用什么形态。**方向已由裁定甲确定(见 §1 M-2 的四处改动表),形态由实施方定。**

### 2.II 回执与一行级修复

**装什么**:owner 回执缺 `brand_ref`、`platform_workspace.workspace_command_receipt` 主键、asset 回执 `legacy` 通配、N-01 补 `UNIQUE (workspace_uuid)`。

**为什么在一起**:四条互不相干、每条都是一行或一条迁移、**共用同一套"重放不得命中他人回执"的负向用例**。

**缺陷事实**
- **owner 回执缺 `brand_ref`(✅ 亲验)**:三张 `command_receipt` 唯一键均为 `(data_node_ref, idempotency_key)`;回执 request 由 `mapper.valueToTree(command)` + `dataNodeRef` 构成,**三处都没有 brandRef**。**限定:只有 `create*` 路径完全暴露**——客户端收到 200 + 另一品牌的 readback,而新品牌里一行都没写;`update` / `transition` 被 pre-receipt recheck 挡住。
- **`platform_workspace.workspace_command_receipt`(✅ 事实亲验,定性下调)**:主键仅 `idempotency_key`,此后无 ALTER;Service 的 advisory lock 与 SELECT 均无 workspace 分量。**但唯一调用方是运维平台管理员这个全局角色,不存在"另一个租户"**,且 requestHash 含 groupWorkspaceKey 故不会回放错误响应。**这是"回执键空间卫生",不是租户隔离。** 同名的 `workspace_iam.workspace_command_receipt` 已做过同样修复,照抄即可。
- **asset 回执 `legacy` 通配(✅ 成立,优先级下调)**:`scope_key IN (?, 'legacy')` 使任何 scope 匹配历史行;释放路径 requestHash 不含 workspace 而 stage 路径含。**但代码里没有任何地方写入 `'legacy'`** —— 唯一来源是迁移的 `DEFAULT 'legacy'`,**只影响 2026-08-11 之前的历史行**,清库或新建库后暴露面为零。
- **N-01(✅ 亲验)**:纯纵深防御,无可达危害,顺带做。

**验收判据(自带反例)**

| 判据 | 反例 |
|---|---|
| 跨品牌 / 跨 workspace 重放同一幂等键**不会 replay 出别人的 response,也不会返回 200 而实际没写** | 能构造出该用例 |
| 每条都有**修复前是红的**负向用例 | 修复前即绿 |
| 契约文件未被改动 | `contracts/` 出现在本批 diff |

### 2.III DDL、索引与成本

**装什么**:`invitation` 三列索引、`workspace_session` 的 `(account_id, status)`、两条严格前缀索引、`stock_ledger` 无 scope 列无 FK、循环里发 SQL、`InventoryOwnerService` 的 offset-as-cursor、**S-11b 拉回本批**。

**S-11b 拉回的理由**:登记册把它整条划给第三部分"商品域",但它的两个证据点是 `InventoryOwnerService` 与 `ProductionTagOwnerService`,**零个 catalog**。按 v1 自己对 S-14 / S-15 用的按模块拆分规则,它应留在本部分;**而且它与 S-14 改的是同一个 for 循环**。

**缺陷事实**
- **两条严格前缀索引(✅ 亲验,精确定位)**:`ix_stock_target_scope_item_ref` ⊂ `ux_stock_target_catalog_identity_ref`;`ix_stock_bom_scope_item_ref` ⊂ `ux_stock_bom_catalog_owner_identity_ref`。(注意 `ix_stock_target_scope_item` 用的是 `item_code`,唯一索引已换成 `item_ref`,**不算前缀**。)
- **`invitation`(✅)**:表只有 PK 与 `UNIQUE(token_hash)`;`PlatformWorkspaceAccountTaskReadService` 的 `LEFT JOIN LATERAL` 谓词三列相关、按外层每行执行。
- **`workspace_session`(✅)**:`account_id` 无任何索引;触发点是第 35 行**与第 38 行**(后者同样 `account_id` 打头,同一条索引一并服务)。
- **`stock_ledger`(✅)**:无 `data_node_ref` / `brand_ref`,`target_ref` 无 `REFERENCES`。**与第零批 M-11 同源**——那条是止血(靠 `target(...)` 解析归属),这条是建模。
- **循环里发 SQL(✅,被低估)**:`InventoryOwnerService` 除"每 target 一条 INSERT""第二个循环每 target 一条 SELECT 回读"外,**还有第三个循环**逐 BOM 复制;`OrganizationHierarchyService` 每阶段名一条 INSERT **另有同形第二处**。
- **S-11b(✅)**:全部冲突时返回 `{"owner":"inventory","status":"COMMITTED","version":0}` —— 空操作报成功。
- **offset-as-cursor(限定)**:**只有 `InventoryOwnerService` 成立**(5 组 `parseCursor` / `offset + pageSize`)。另三个服务用的是显式页码分页,**没有 cursor 字段,不存在契约谎言**。

**验收判据(自带反例)**

| 判据 | 反例 |
|---|---|
| 每条"缺索引"都有**该索引被查询计划选中**的证据,**且说明造数规模或使用 `SET enable_seqscan=off`** | 只凭谓词列名匹配就加索引;或在几十行的种子数据上跑 EXPLAIN(必选 seq scan,判据不可满足) |
| S-11b 修复后,全冲突的复制**不再返回 COMMITTED** | 仍返回 `version: 0` 的成功 |
| 循环改批量后有**改动前后的查询次数对比**(`DatabaseOperationTracker` 已在用) | 只说"改成批量了",无对比 |
| 每条都有**修复前是红的**用例 | 修复前即绿 |

**明确不指定**:索引定义;`stock_ledger` 加列还是保持靠上游解析;批量化形态;分页改动的具体做法(注意 `InventoryOwnerService` 的 cursor 语义变更**会碰契约**,若如此则该条移入需契约裁定的范畴)。

---

## 3. 关闭与移出的条目

### 3.1 关闭 —— 前提被推翻,不是缺陷

| 条目 | 关闭理由 |
|---|---|
| **S-03 低库存告警永久静默** | **两条推论都不成立**:`state(...)` 全文件只有一个调用点(mutation readback),列表页状态是**在 SQL 里算的**(`::numeric`,非数字文本会让整个列表查询报错而不是静默);`decimalNode` 在三处详情读路径上**不 catch**、会抛出。**且前提不可达**:写路径有 key 白名单 + `decimalValue` 对非数字直接抛 422,**通过 API 无法写入非数字阈值**。<br>**残留一个不同的 finding**:同一语义在 SQL 与 Java 里实现了两遍且不一致(一个 catch 成 0、一个抛 500)。这属于"同类路径一致性",**归第一部分的规范实例,不单独排批**。 |
| **`organization_node.parent_id` 无 FK / 无索引 / 无环守卫** | **危害不可达**:`validateParent` 钉死 REGION 的 parent 必须为 null、PROJECT 的 parent 必须是 REGION,**树深恒为 2**;且更新路径对任何改动 parentId 的请求直接抛异常,**parent_id 创建后不可变**。成环在应用层不可达。("五处递归 CTE"实为 ≥13 处,但深度上界是 2。)<br>剩余有价值的只有"parent 可指向另一 workspace 的节点"半句,而 `validateParent` 的 `requireNode(workspaceUuid, key, parentId, parentType)` **已经带了 workspace**。**降 N,不排批。** |
| **另三个服务的"OFFSET 分页"** | **没有 cursor 字段**,是诚实的页码分页。原 finding 的严重性全部来自"把 offset 伪装成 cursor",这三条不适用。 |

### 3.2 移入 `HANDOFF.md` 欠账

| 条目 | 理由 |
|---|---|
| **S-12 三条死索引** | **现在判不了**:静态论证不可靠(有前科),而 `idx_scan = 0` 的 workload 覆盖不到相关 schema(见 §1 M-1)。等 acceptance 场景覆盖 inventory / production 之后再判。 |
| **S-13 版本化迁移用 `IF NOT EXISTS`** | 单人阶段库随时重建,"迁移在形状不符时失败"**既测不了也无收益**。<br>登记最危险处的候选:`V20260812_130000_000` 第 5 行对 `staged_asset_storage_key_key`(自动生成名)的 `DROP CONSTRAINT IF EXISTS` —— 若静默跳过,第二个内容相同的 **workspace logo** 上传会撞 `DuplicateKeyException` 并被原样抛成 500。 |
| **M-02 全平台全表扫** | **裁定甲落地后降为纯性能项**(甲之下全扫与按 workspace 收敛答案相同,只是慢)。且收窄不是一行——`catalog_item` 无 `workspace_uuid` 列,按 workspace 收敛要跨 schema 枚举数据节点。**与 S-12 同列,等有真实成本数据再定。v1 的 GIN + `@>` 建议已作废。** 详见 §4 |
| **Postgres 行级安全(RLS)** | 2.I / 2.II 这一整类的结构性正解。**本部分做完点修之后,剩余风险仍然是"下一条新写的 SQL"**——这一点不因点修完成而关闭。 |

### 3.3 已由 Dexter 裁定关闭

| 条目 | 裁定 |
|---|---|
| 保存商品时写库存的 capability 边界 | 维持现状(商品权限包含库存配置)。**要求:界面上让用户知道"保存商品会同时写入库存配置"** |
| `X-Catalog-Test-Failure-Point` 故障注入 | 可以接受 |

---

## 4. 批次顺序与阻塞

```
2.I  资产生命周期      ✅ 裁定甲已下,阻塞解除
2.II 回执与一行级       无阻塞
2.III DDL / 索引 / 成本  无阻塞,可与 2.II 并行

M-02(全表扫)          不在任何批次内 —— 已移入 HANDOFF(见 §3.2)
                         若将来要动,必须排在 2.I 之后
```

**三批全部无阻塞,可立即开工。** 2.II 与 2.III 互不依赖可并行;2.I 独立。

### 裁定甲改变了 M-02 的性质

**M-02 从"正确性 + 性能"降为"纯性能"。**

现状之所以是正确性问题,是因为**别的 workspace 的商品可能引用同一个 assetRef**,所以那条全平台扫描既是过度保守、又是唯一保险。

**甲落地之后,一个 assetRef 只属于一个 workspace,别的 workspace 的商品在物理上不可能引用它。** 于是全平台扫描**返回的答案与按 workspace 收敛后完全相同**,只是慢——它从"语义上必须全扫"变成"没必要全扫"。

**这带来两个结果**:
1. 收窄它**不再有误释放的风险**(因为收窄前后答案相同),裁定阻塞解除;
2. 但**收窄仍不是一行**——`catalog_item` 上没有 `workspace_uuid` 列,只有 `data_node_ref` / `brand_ref`,按 workspace 收敛需要枚举该 workspace 的数据节点集合,而现有设计明确禁止跨 schema 外键。

**处置(已定,见 §3.2)**:M-02 **移入 `HANDOFF.md`,不进任何批次**,与 S-12 同列,等 acceptance 场景覆盖到相关路径、有真实成本数据之后再决定值不值得动。若将来要动,**必须排在 2.I 之后**。**v1 那个 GIN + `@>` 的建议已作废,不要采纳。**

---

## 5. 授权边界与亲验状态

**Claude 本会话亲验**:`findCatalogByStorageKey` 无 workspace 谓词与其纯内容派生的 key、`uq_platform_asset_catalog_bucket_object` 不含 workspace 列、`InventoryOwnerService` 写路径对阈值的校验与列表 SQL 的 `::numeric`。

**盲审亲验、Claude 未逐条复核**:其余 9 条断言的判决。盲审自述**全程零运行验证**——无编译、无测试、无容器、无 EXPLAIN;凡涉及查询计划、实际耗时、索引是否被选中的结论均不在其证据范围内。**「LATERAL 每行一次全表扫」标 `UNVERIFIED`。**

**一处行号提示**:`PlatformAssetService` 的行号对 HEAD 与工作树差 1(工作树有一个未提交的 import)。本文用的是工作树行号。

**阻塞项**:**无。** 原 §1 M-2 的 `DEXTER_DECISION` 已由 Dexter 于 2026-08-14 裁定为**甲**,三批全部可开工。

本文只给缺陷事实与验收判据,**不给修法,也不授权实施**。范围与时机由 Dexter 裁定。**按两轮硬上限,本 v2 尚可再过一轮;若不过则以 `SELF_DECIDED` 收口。**
