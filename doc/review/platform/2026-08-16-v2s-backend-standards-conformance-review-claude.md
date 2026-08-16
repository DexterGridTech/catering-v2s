# 后台开发规范符合性复核 · 执行序列 · 2026-08-16

**结论:`NO-GO` · M 3 · S 5 · N 6 · 全部纳入一条串行序列,共 13 步**

> **授权边界**:静态 review。不授权下一 Roadmap step、不授权 DEV、不授权数据操作。
> 每条 finding 都做过证伪尝试;**证伪成功的已删除或降级,过程在 §4**。

---

## 0 · 怎么用这份文件

**这是一条严格串行的执行序列,不是批次划分。** 从第 1 步做到第 13 步,做完一步再做下一步。

**为什么串行就不冲突**:唯一的冲突源是「全仓重排会作废行号坐标」。
把重排放在第 13 步(最后),前 12 步做完时已不需要任何行号坐标 —— 冲突消失。

**关于行号漂移**:前面的修改会让后面的行号往下推(核查期间 `CatalogOwnerService` 就从 3985 涨到 3997 行)。
因此**本文所有定位都用「方法名 + 特征字符串」,不用裸行号**。行号只在括注里给个大概位置,漂了以内容为准。

**排序依据**(来自 `doc/platform/backend-coding-standard.md` §3):
删死代码 → 合并工具类;改 generator → 前端消费侧;机械改动(拆包/改名/重排)一律最后。

---

## 1 · 执行序列

| # | 条 | 做什么 | 定位锚点 | 门 |
|---|---|---|---|---|
| 1 | M-A | 契约第二根降级为纯产物 | `catalog-inventory.openapi.yaml` + 5 处下游 | — |
| 2 | S-e | 迁移不再靠自动约束名 | `V20260808_160000_000` 两处 `DROP CONSTRAINT IF EXISTS` | — |
| 3 | S-c | 字典/生产标签作废码可回收 | 两张表的 `UNIQUE (data_node_ref, brand_ref, code)` | — |
| 4 | S-b | 自由 JSON 字段加上限 | `attributes` · `productionProfiles.*` | — |
| 5 | S-a | 拆掉 5000 悬崖 | `INVENTORY_CATALOG_PREFILTER_LIMIT` | — |
| 6 | S-d + N-d | catalog 复制批量化 + 租户谓词补回 | `executeCopy` · `assetRefsStillReferenced` | — |
| 7 | N-f | 回执改用 Jackson | 四个 `*CommandReceiptService` | — |
| 8 | N-c | 死索引处置 | 三条索引 | — |
| 9 | S-07 残 | 删死代码 → 合并三份能力 switch | `readGroupWorkspace` · `catalogCapabilityForTarget` | — |
| 10 | 门二 | PMD `PreserveStackTrace` + 修掉它报的违规 | 四个 gradle 文件 | ✅ 建门 |
| 11 | N-b | 61 个 `.yaml` 改 `.json` | `contracts/openapi/` | — |
| 12 | N-a | 拆 6 个跨模块同名包 | 见第 12 步 | ✅ 门四 |
| 13 | M-B | Spotless 引入 + 全量重排 + 接门 | 全仓手写 Java | ✅ 门三 |

**M-C(规范无传导机制)不单列为一步** —— 它的处置就是第 10、12、13 步各带一道门。
门跟着它守护的那批工作一起落地,而不是攒到最后建三道。

---

## 2 · 逐步施工说明

### 第 1 步 · M-A · 契约第二根降级为纯产物

**事实**:`contracts/openapi/catalog-inventory.openapi.yaml` 12,375 非空行,39 path + 75 schema **全部内联**。
它自己头部 `x-shard-placement` 列出 16 个分片文件,**那 16 个确实存在且逐字节重复**
(实测 `catalog-workbench.schemas.yaml` 24 个 schema 与内联版 24/24 byte-identical)。

它是 `scripts/generate/catalog-inventory-p1.mjs`(约 863 行,搜 `writeFileSync` + 该文件名)的产物,却被 **5 处当输入读**:

```
scripts/generate/catalog-inventory-p3-frontend.mjs      ← 前端类型从它生成
tools/capability-invariants/cli.mjs
tools/verify-gates/strict-openapi-resolver.mjs
scripts/test/catalog-inventory-query-envelope.test.mjs
scripts/test/catalog-p3-model-migration.test.mjs
```

**业务场景**:工程师照工单打开这个 12,375 行文件改 schema,`scripts/verify` 全绿。
但 `edge-codegen` 消费的是分片树,两棵树从此分叉;**前端类型从大文件生成、后端校验走分片树**,
同一个字段前后端两个形状,直到某页面拿到 `undefined` 才暴露 —— 那时没人会想到契约有两个根。

**验收判据(自带反例)**:只改分片、不改大文件,跑一次全量生成 ——
大文件必须自动跟随变化;**若大文件纹丝不动而 verify 仍绿,则未修复**。

**归属**:`2026-08-15-v2s-p3-2-work-order-claude.md` 那句「契约文件是 catalog-inventory.openapi.yaml」是我写的,这条我担一半。

---

### 第 2 步 · S-e · 迁移不再靠 Postgres 自动生成的约束名

**事实**:`V20260808_160000_000__inventory_opaque_catalog_identity_refs.sql` 两处
`DROP CONSTRAINT IF EXISTS stock_target_data_node_ref_brand_ref_item_code_sku_code_key` /
`…stock_bom_…_key` —— 这是 Postgres **自动生成**的名字。
全 51 个 migration 共 **48 处 `IF NOT EXISTS`**,且规范定下后新加的三个文件仍在用
(`V20260815_020000_000` 2 处、`V20260816_010000_000` 4 处、`V20260816_020000_000` 2 处)。

**业务场景(条件性)**:某套库里那个自动名差一个字符(表被重建过、或走过不同建表路径),
`DROP … IF EXISTS` **静默跳过**,Flyway 照样记为已应用,旧唯一约束与新的并存。
运营改了 SKU 编码后再建库存对象,收到界面解释不了的重复冲突,
而工程师查表看到「迁移明明成功了」—— **没有机制告诉你名字对没对上**。

**为什么排第 2**:第 3 步要加新迁移。**先让迁移机制确定,再往上加迁移。**

**验收判据**:约束的存在性由显式命名保证,不由自动名猜测;
DROP 未命中时**必须失败而不是静默跳过**。实际约束名 `UNVERIFIED` —— 我无权连 DEV 库验证。

---

### 第 3 步 · S-c · 字典与生产标签的作废码可回收

**事实**:商品与 SKU 已修(`V20260815_010000_000`、`V20260816_020000_000` 改成
`WHERE status <> 'VOIDED'` 的部分唯一索引),但两张表**全仓无任何 DROP**:

- `dictionary_entry` · `UNIQUE (data_node_ref, brand_ref, dictionary_kind, code)`
- `production_tag_definition` · `UNIQUE (data_node_ref, brand_ref, code)`

**业务场景**:运营建了个 SKU 属性值 `SPICY`,发现建错,作废。想重建正确的 `SPICY` ——
报「字典编码已存在」409,只能叫 `SPICY_2`。
**更难解释的是不一致**:同一个"作废"动作,商品和 SKU 的码能拿回来,字典和生产标签的拿不回来,界面无任何区分提示。

**⚠️ 登记册这条的后果描述是错的,已更正**:原文写「界面上找不到它却被告知编码已存在」。
实测两个列表读端点(`CatalogOwnerService` 字典列表、`ProductionTagOwnerService` 第 49 行标签列表)
**都不过滤 VOIDED**,作废行仍可见。所以是**"看得见、也永远抢不回来"**,不是"查无此物却被拒"。

**验收判据**:作废后用同一编码重建成功;且**作废行仍在列表可见**(现状行为,不要顺手改掉)。

---

### 第 4 步 · S-b · 自由 JSON 字段加上限

**事实**:`sections` 顶层已由生成 record 封闭(Jackson 丢弃未知键),
但 `attributes` 与 `productionProfiles.{item,sku,optionValue}` 是 `CanonicalJsonDocument`
—— **任意对象,无白名单、无大小上限**;`productionProfiles` 直接落进 `sections`。
后端**未配置** `max-request-size`。

**业务场景**:运营在「生产提示」里粘了一段从 Word 拷来的富文本(带样式,几百 KB)。
系统返回 200,保存成功,界面无任何提示。此后**同门店所有人打开商品列表都变慢** ——
`sections` 是列表/详情读路径要整体解析的对象。没人能从界面看出是哪条商品干的,运营自己也不知道是那次粘贴。

**验收判据**:超限时返回 typed problem 且**说明是哪个字段超了多少**;
不得静默截断(截断即回到 M-04 的老毛病)。

---

### 第 5 步 · S-a · 拆掉 5000 悬崖

**事实**:`CatalogInventoryCoordinator` 的 `INVENTORY_CATALOG_PREFILTER_LIMIT = 5000`,
超限抛 `VALIDATION_ERROR 422 "inventory catalog prefilter exceeds 5000 items; narrow the keyword or category filter"`。

**业务场景**:一个 6,000 商品的品牌,运营进「库存目标」页想按关键词找一个物料。
页面报 422,提示"缩小关键词或分类筛选" —— 但**他本来就是想用关键词筛选才进来的**,
而且这个数字与他要找的那一个物料毫无关系。唯一出路是猜一个更窄的关键词。

**同时**:该页每次筛选把最多 5,000 行完整商品(含两坨 JSONB)拉出、水化、丢掉,只为取 `itemRef`。

**⚠️ 这一步不是打补丁,是改结构。** 当前形态是「先把所有匹配商品的编码捞出来,再拿去过滤库存」——
**这个形态本身是无界的**,5000 只是给无界加了个盖子。把盖子调大或去掉都不解决问题。
`itemCodesOnly` 分支内还留着"强制 `offset=0` 却照吐 `cursor`"的死逻辑(今天外部客户端传不进来,不可达)。

**验收判据**:品牌商品数增长时,该页的**查询成本不随商品总数线性增长**;
且不存在任何一个商品数会让页面从"能用"跳到"报错"。

---

### 第 6 步 · S-d + N-d · catalog 复制批量化 + 租户谓词补回(同文件,一次动完)

**S-d 事实**(我亲验):`CatalogOwnerService` 与五个 `Catalog*Facts` 类
**`batchUpdate` 命中数为 0**。`executeCopy`(约 889 行起)内三个 `for` 循环逐条 `jdbc.update`
(分类、字典条目、商品),循环体内又对每个商品逐个调五个 `Facts.replace`。
**inventory 侧与 organization 侧已批量化,catalog 侧没有。**

**业务场景**:运营给新门店从品牌复制 200 个商品的目录。数百到上千次往返压在一个事务里,
而这段时间**同时握着品牌级锁**(M-03 收敛的是锁范围,不是持有时长)。
复制方看到抽屉长时间无响应,**同品牌下其他运营保存任何商品都在转圈**,而他们根本不知道有人在做复制。

**N-d 事实**:`assetRefsStillReferenced`(约 1259 行)调 `itemMediaFacts.referenced(null, null, ref)` ——
两个 `null` 让租户谓词串为空,SQL 仍扫全平台。**今天不可达**(上游 `requireCatalogAssetInWorkspace`
+ 资产按 workspace 唯一),但顺带的可测量代价是:一次换 20 张图会发 **40 条 EXISTS** —— 名字叫 batch 实为 N+1。

**为什么合并成一步**:两条在同一个文件,分开做要动两次。

**验收判据**:复制 200 商品的 SQL 往返数**不随商品数线性增长**;
`assetRefsStillReferenced` 对 N 个 ref 发的查询数**不是 2N**。

---

### 第 7 步 · N-f · 回执改用 Jackson

**事实**:四处把 record 序列化成 `{"k":"<base64>"}` 再用正则读回
(`OrganizationHierarchyCommandReceiptService` · `CommercialGroupCommandReceiptService` ·
`WorkspaceCommandReceiptService` · `PlatformCommandReceiptService`),
而同包 `BusinessEntityCommandReceiptService` **已经直接用 `ObjectMapper`** —— 正确写法就在隔壁。

**业务场景**:今天自洽(自己写自己读),没有用户可见故障。真实风险在幂等重放:
回执解析靠正则而非解析器,任何一个业务字段值里出现 `"`,`read()` 就抛 `missing receipt field`,
运营重试同一操作时拿到 500 而不是原回执。**Base64 恰好屏蔽了引号问题,所以缺陷被掩盖着。**

**⚠️ 这一步改变已落库回执的物理格式,是数据动作。**
登记册原本标注需 Dexter 裁定时机 —— **Dexter 已裁定「全都做了」,视为已授权**。
但请在设计里明确:已存回执如何读(兼容读一轮,还是一次性转换)。
按 CLAUDE.md「不为向后兼容长期保留废弃方案」,倾向一次性转换而非长期双读。

**验收判据**:字段值含 `"` 与 `\` 时写入再读回等值;已存回执不丢失。

---

### 第 8 步 · N-c · 死索引处置

**事实**:三条索引在册 —— `ix_stock_bom_option_value`、`ix_production_tag_scope_status`、
`ix_platform_password_recovery_flow_active`。两条严格前缀索引已在 `V20260814_090000_000` 删掉。

**业务场景:无。** 只放大写入成本,用户感知不到。

**⚠️ 判据不是"看起来没人用"**。分流文档已明令用 `pg_stat_user_indexes` 运行证据判死索引,
理由是静态论证会误删(索引可能被非显然的查询形态用上)。
**没有运行数据时,可接受的替代判据是:证明不存在任何能用上该索引前缀列的查询形态**,
并把论证写下来 —— 而不是"grep 没搜到"。

---

### 第 9 步 · S-07 残项 · 先删死代码,再合并三份能力 switch

**顺序是硬的**(`backend-coding-standard.md` §3):**删死代码必须在合并工具类之前** ——
否则会去合并将死的代码。

**先删**:`PlatformWorkspaceAuditHistoryService` 的遗留三查询版 `readGroupWorkspace(AuditReadScope, ...)`
**零生产调用方**(唯一调用点走的是 String 重载)。

**再合并**:`catalogCapabilityForTarget` 在 `CatalogOwnerService`、`ProductionTagOwnerService`、
`PlatformAssetService` **三份,switch 体逐字节相同**
(`HEAD_COMPANY -> "EDIT_HEAD_COMPANY_CATALOG"` / `STORE -> "EDIT_STORE_CATALOG"` / `default -> null`)。
`requireOwnerScopeGrant` / `requireTypedContext` / `copySourceDataNodeRef` 同样各三份。

**业务场景**:今天正确,属延迟型风险 —— 将来新增一种数据节点类型(如区域级目录)时,
三份 switch 必须同步改,**漏改哪一处,对应 owner 就在新节点类型上静默返回 `null` 能力**,
授权判定从"拒绝"退化成绕过分支。

**⚠️ 边界(Dexter 已裁)**:**只接受工具类合并,不接受为消除少量重复而造抽象。**
反面对照:六个 `CreateOperationsOrganization*` 组内差异 12–36 行 / 共 20–39 行,**不该合并**。

---

### 第 10 步 · 门二 · PMD `PreserveStackTrace`

**事实**:全仓 `PreserveStackTrace` 仅 2 处命中,**都在我自己写的规范文档里**。
四个 gradle 文件对 `pmd|checkstyle|errorprone` 零命中;根 `build.gradle.kts` 的 plugins 块只有 `java`。

**规则**:`catch` 之后不得丢弃 cause,也不得把捕获到的异常改写成不相干的原因。
**反例**:`catch (SQLException e) { throw new Problem("VALIDATION_ERROR", "参数不合法"); }`。

**⚠️ 只上 `PreserveStackTrace` 这一条规则,不上整个 PMD 规则集。**
规则集要 curate,三万行存量上会产出几百条待分诊 —— 那会淹掉这一步。

**这一步含"修掉它报出的违规"**,门才能变绿。已知一处相关残留:
`OperationsCatalogInventoryController` 两处仍是 `catch (RuntimeException)`(cause 已挂上,但 catch 未收窄)。

---

### 第 11 步 · N-b · 61 个 `.yaml` 改 `.json`

**事实**:`contracts/openapi/` 下 **61 个 `.yaml` 文件,61 个首字符是 `{`** —— 全部实为 JSON。

**业务场景:无。** 扩展名说谎 + diff 噪声 + 按 YAML 习惯改会写出混合语法。

**为什么排在这**:机械改动,且**会改变文件路径**,所有引用它们的脚本要同步改。
放在语义修改之后、拆包之前。

---

### 第 12 步 · N-a + 门四 · 拆 6 个跨模块同名包

**事实**(今日亲验,两侧包路径求交):**6 个叶子包仍跨 Gradle 模块共用**

```
com/catering/v2s/catalog/application
com/catering/v2s/fulfillment/production/application
com/catering/v2s/inventory/application
com/catering/v2s/organization/application
com/catering/v2s/platform/asset/application
com/catering/v2s/workspace/iam/application
```

app 侧清一色 `*Operation`,module 侧是 `*Service`/`*Facts`。与登记册数字精确吻合,一个没拆。

**业务场景:无。** split package 在模块化下是未定义行为,且让"这个类在哪个模块"无法从包名判断。

**门四**:文件系统级判据 —— 拆完后 `src/main` 与 `modules/*/src/main` **无同名包**。
⚠️ 现有 `code-layout` 的 `validateBackendJavaPackagePaths` **不是这道门** ——
它只比对 package 声明与目录路径是否一致,那是 Java 编译器本就保证的不变量。

---

### 第 13 步 · M-B + 门三 · Spotless 引入 + 全量重排 + 接门

**事实**(今日亲验,排除 `build/` 与 `app/edge/generated/wire/`):

| | 2026-08-14 基线 | 今天 | 变化 |
|---|---|---|---|
| >120 字符的行 | 5,207 | **8,008** | **+54%** |
| >200 字符的行 | 1,881 | **2,497** | +33% |
| 含超长行的文件 | 313 | 353 | +13% |

手写 Java 463 个文件,单行最长 **1,967 字符**(`WorkspaceAuthenticationService`),前五名全部超 1,600。
全仓 `spotless` **零命中** —— 工具从未引入。

**规范定了 22 天,方向是反的。**

**业务场景**:这条没有"用户看到什么"的场景,代价落在**评审与协作**上 ——
一行 1,967 字符意味着任何 diff 都是整行替换,review 时看不出改了哪个分支。
本轮五路核查里有三路报告过因此导致的定位困难。**它不产生 bug,它产生"看不见 bug"。**

**为什么必须是最后一步**:全仓重排会作废所有「文件:行号」坐标。前 12 步做完后,不再需要坐标。

**⛔ 单独成批,不与任何语义修改混提。**

**验收判据(自带反例)**:

| 判据 | 反例 |
|---|---|
| 格式化前后各编译一次,`javap -c -p` 去掉 `LineNumberTable` 后逐字节相同 | 有差异 → 改到了逻辑 |
| 重新跑一次代码生成后 `spotlessCheck` 仍绿 | 生成后变红 → 生成物没排全 |
| 排除生成物后 >120 字符**归零** | 仍有长行 → target 路径没覆盖全 |

---

## 3 · 三十三条的完整状态(背景)

| 状态 | 数 | 条目 |
|---|---|---|
| **FIXED** | 13 | M-01 M-03 M-08 M-09 M-11 · S-02 S-05 S-06 S-09 S-17 S-19 S-20 · N-01 |
| **PARTIAL** | 9 | M-02 M-04 M-10 M-12 · S-01 S-07 S-11 S-12 S-14 |
| **NOT_FIXED** | 8 | S-03 S-04 S-08 S-10 S-13 S-15 S-16 S-18 |
| 改判去重 | 3 | M-05=S-19 · M-06=N-01 · M-07=S-20 |

**修得好的部分是真的好**:M-11 跨租户泄露四环全闭、M-01 网络 I/O 出事务、
M-03 品牌级宽锁收敛到请求内、M-08 `format: uuid` 真的传导进生成物。

**没修的高度集中在一处**:凡**需要新建工具链**的(格式、门、拆包、拆文件)一条没动;
凡**改一段代码就能完成**的基本都动了。这不是执行力问题,是 §5 那件事。

### 3.1 未进序列的两条,及理由

| 条 | 为什么不做 |
|---|---|
| **S-04** 故障注入 header | 生产二进制带 `X-Catalog-Test-Failure-Point`,唯一屏障是未设的环境变量 `V2S_CATALOG_TEST_FAULTS`。**当前无部署设置该变量,不是现网可利用漏洞**。但它污染三个模块的生产签名。**未列入序列,登记为待定** —— 要不要现在拆,取决于测试链是否还依赖它,这个我没核。`DEXTER_DECISION` |
| **S-15** OFFSET 分页 | 40 处 `LIMIT ? OFFSET ?`。翻页时若他人正在增删,用户会**跳过或重复看到行**,界面无提示。**这是真实后果**,但改 cursor 分页要动 40 处读路径 + 契约,**规模超过本序列其余各步之和**。建议单独立项而不是塞进这一轮。`DEXTER_DECISION` |

---

## 4 · 我证伪并删除/降级的条目(过程留档)

按「场景不真实存在或不合理就去掉」执行。三条子 agent 报为有业务后果,**我复算后推翻**:

### 4.1 S-01「复制后选项值编码与页面显示对不上」—— 证伪,删除

**优先级相反是真的**:`orderOptions()` 投影用 `firstText(value,"code","valueCode")`,
`optionValueCodeForRef()` 用 `firstText(value,"valueCode","attributeValueCode","code","name")`。

**但业务后果不成立**。契约里 orderOptions 值对象是 `additionalProperties: false`,
properties 只有 `['code','default','extraPrice','name','productionEffects']`,`required` 含 `code`:

- `valueCode` **不是该对象的合法字段**,永远不会出现
- `attributeValueCode` **全契约零出现**
- `code` 必填,所以第四档 `name` 回退也不可达

两处**都只能落到 `code`**。那条多键链实际是**服务两种形状的多态**(`valueCode` 属 `attributeValueRefs`),不是缺陷。

### 4.2 M-12【4】「两个租户撞 Idempotency-Key」—— 场景不成立,降为 N

**仓内事实成立**:释放路径 `requestHash` 不含 workspace,而 stage 路径含 `workspaceUuid + groupWorkspaceKey`;
`GLOBAL_RECEIPT_SCOPE = "global"` 全平台共用命名空间。

**但业务场景不成立**:前端幂等键是 `ui-${crypto.randomUUID()}`(`useSubmissionLifecycle`),**122 位随机**。
跨租户撞键概率为零;"探测面"同理不可用(要探测得先猜中一个随机 UUID)。

剩下的真实价值只是 **2-A 同类路径一致性**,**不是用户会遇到的缺陷**,未列入序列。

### 4.3 S-03「低库存永不告警」—— 措辞过重,降级

**代码事实成立**:非数字阈值被吞成 `BigDecimal.ZERO` → 恒返回 `"OK"`。

**但触发路径被堵死**:写入侧 `normalizeConfiguration` 对非数字**直接 422 拒绝**,
列表 SQL 做 `::numeric` 强转(脏值会 500 而非静默)。
要触发需**绕过 owner 写入的脏数据** —— 与 Dexter 上轮裁定「确实没有你说的这种迁移场景」同类。降为防御性硬化项。

---

## 5 · 根因:规范写进文档到变成门,这个仓里没有传导机制

**四个独立实例**:

| 规范 | 写于 | 至今 | 门 |
|---|---|---|---|
| 契约单文件 ≤500 行(D-02) | 2026-07-25 | 22 天 | 无 |
| 格式 >120 归零 | 2026-08-14 | 2 天,分母 +54% | 无 |
| 错误不得伪造原因 | 2026-08-14 | 2 天 | 无 |
| 跨模块同名包 | 2026-08-14 | 2 天 | 无 |

四道门只建成一道,**而那道(`edge-codegen`)是本来就存在的**,且在 `runtimeCommands` 里 ——
`scripts/verify --validate-only` 快通道**跑不到它**。

**且最新写的那批契约恰好是最严重的违反者**:12,375 行的第二根不是历史遗留,是规范写下之后新产生的。

**本序列的处置**:第 10、12、13 步各带一道门。**门跟着它守护的工作落地,不攒到最后。**

### 5.1 已落地:规范正本 + 指针(Codex 不用做)

| | |
|---|---|
| **正本** | `doc/platform/backend-coding-standard.md` —— 十类规则,每条自带反例,附执行顺序依赖图 |
| **指针** | `project-memory/operations/backend-coding-standard.md` —— 只放指针,不复述内容 |
| **登记** | `required-inventory.json` + `build-index` → `PROJECT_MEMORY=PASS` · ENTRIES 23→24 |
| **路由实证** | `--task-kind implementation --domain platform` 18 条命中含 `backend-coding-standard` |

**此前规范没有正本**,只散在三份日期命名的评审文档里,两套记忆系统均零条目 ——
上表「22 天无人执行」的直接原因就是这个。**规范失效不是因为没写,是因为找不到。**

**顺带的证据**:`build-index` 第一次拦下了我(`sourceRefs drift` ——
frontmatter、inventory、assertionSources 三处必须一致)。
**project-memory 自己有传导机制,编码规范没有** —— 这就是本节说的那件事。

---

## 6 · 跨轮观察

**同一失效模式,第三次出现**:

| 轮次 | 表现 |
|---|---|
| P3-1 | 契约约定了控件,前端如何消费没约定 |
| P3-2 C1-2 | 同一事实被陈述两次而两次不一致,门是绿的 |
| **本轮** | 规范写进文档,门没建;最新一批代码是最严重的违反者 |

三次都是**"声称"与"行为"之间缺一条传导链**。前两次当个案修,这次以第四个实例出现 ——
所以 §5.1 建正本时我要求了三处一致的校验,而不是只放一个 markdown。

**一条自省**:本轮五路核查里有两路给出了业务场景听起来完整、复算后不成立的 finding(§4.1、§4.2)。
直接采信的话这份文档会有两条误报。**agent 的产出是输入不是结论 —— 这条对我自己同样适用。**

---

## 7 · 结论

`NO-GO` · **M 3** · **S 5** · **N 6** · **13 步串行序列**

**授权边界**:静态 review,不授权下一 Roadmap step、不授权 DEV、不授权数据操作。
S-e 的实际约束名为 `UNVERIFIED`(需 DEV 库)。S-04 与 S-15 未列入序列,为 `DEXTER_DECISION`。

**处置**:13 步按既有批准边界直接自主执行,不需再授权。
第 7 步(回执格式)涉及已落库数据物理格式,Dexter 已以「全都做了」授权,但设计里须写明已存回执如何处理。
