# 可读性整改欠账立项 · 问题分析与方案设计

- **日期**：2026-09-12 · **作者**：Claude
- **性质**：立项需求，含问题分析与方案设计。⛔ **本文不含详设与实施计划**，按 Dexter 2026-09-12 指示停在方案层。
- **来源**：2026-09-11 后端可读性整改需求分析中被挑出、明确移出该批并标记「单独立项」的七项。
- **裁决状态**：Dexter 2026-09-12 **全部采纳作者建议**，并同意分多批次顺序执行。§9 已由待裁转为已裁；§8 已转为确定批次计划。
- ⚠️ 全部数字为 2026-09-12 对当前字节亲验，口径随项标注。

---

## 0. 这七项为什么被移出上一批

上一批的第一性目标是「打开任一后端 owner 服务，不必读完上万行就知道它负责什么」，最终只保留一条需求：按聚合拆五个 God class。

移出的七项分三类：

| 类 | 项 | 移出理由 |
| --- | --- | --- |
| **不是可读性问题** | 二、三 | 是控制面缺陷（门未接线、门的分母缺层），与可读性无关 |
| **是架构重构** | 一、四 | 改变执行边界，不是搬位置 |
| **判据或收益不成立** | 五、六、七 | 无可用机器判据，或收益低于风险 |

⚠️ **本文不主张七项都该做。** 每项给出问题、方案与代价，由 Dexter 决定做哪些、什么顺序。

---

## 1. 项一 · 后端持久化重构

### 1.1 问题

**口径**：L2 字节绑定 1,491 文件清单（已排除构建产物），取 `modules/*/src/main/java/**/{api,application,domain}/**/*.java`，判据为字符串字面量或 text block 以 SQL 语句起始关键字开头。

`api`、`application`、`domain` 三层仍有 **101 个文件、13 个 module** 含 SQL：

| module | 文件 |
| --- | --- |
| `workspace-iam` | 28 |
| `catalog` | 20 |
| `organization` | 15 |
| `inventory` | 8 |
| `store-contract` | 7 |
| `extension` | 4 |
| 其余 7 个 module | 19 |

读一个业务判断要跨过几十行字符串拼接；SQL 变更与业务变更在同一文件里互相掩盖。

⚠️ **上一批只处理了五个 God class 内部的 SQL，这 101 个文件一个没动。**

### 1.2 为什么是重构而不是搬位置

`application/` 层 94 个文件中 **80 个 import `org.springframework`**、49 个带 `@Transactional`（全层 573 处）。把 SQL 抽进独立持久化类会动到：事务代理边界、自调用行为、回执与幂等边界、锁顺序、`REQUIRES_NEW` 失败隔离、authoritative readback 时机。

### 1.3 方案设计

**方案 A · 按 module 逐个迁移（推荐）**
每个 module 独立成批：建 `persistence/`，把该 module 的 SQL 执行方法抽入，调用方不变、事务注解留在原处。以 module 为交付单元，每批一次全量 acceptance。

- 优点：13 个可独立验证的小批，失败面隔离在单 module；
- 代价：13 次全量 acceptance；
- 排序建议：从 `store-contract`(7)、`extension`(4) 这类小 module 起步验证形态，再做 `workspace-iam`(28)、`catalog`(20)。

**方案 B · 一次性全量迁移**
优点是一次收口；代价是 101 个文件同时在飞，任何一处事务语义偏差都要在全量 acceptance 里定位。**不推荐**。

**方案 C · 只迁移新写的 SQL，存量不动**
即"防增量不改存量"。但没有可接线的门能判定「这段 SQL 是新写的」，退化为 review 约定。**不推荐**，与项二的困境同源。

### 1.4 必须保持的不变量

与上一批同一组七条：对外 HTTP 契约与错误码、公开异常类型仍能被既有 advice 解析、事务传播语义（含 `REQUIRES_NEW` 失败隔离）、幂等与回执边界、锁顺序、owner readback 时机、所有调用方仍能解析。

### 1.5 代价与收益

代价：101 个文件 + 13 次或 1 次全量 acceptance + 每 module 的行为钉住。
收益：业务判断与 SQL 分离，这是 101 个文件的持续阅读成本。

**这是七项里最大的一项，也是收益最实的一项。**

---

## 2. 项二 · `query-boundaries` 门未接线

### 2.1 问题

`scripts/check/query-boundaries` 执行 `cli.mjs budget`，该函数承载 `R4_DATABASE_SELECT_STAR` 与 `compatibilitySelectStarPaths`。

**实测：`tools/verify-gates/verify.mjs` 中 `query-boundaries` 命中数为 0。** staticCommands 里有 `backend-boundaries`、`database-boundaries`、`logging-boundaries`，唯独没有它。

⇒ **这道门从未在 `scripts/verify` 中执行过。** 仓内 2026-08-17 的文档已登记「未接线、绿、接线候选」。

### 2.2 两个连带子问题

**判据过宽。** 门禁的是字符串 `SELECT *` 本身。白名单里 9 个文件逐个打开后，**8 个是 `SELECT * FROM <同一查询内刚定义的 CTE>`**（`audit_rows`/`ranked`/`events`/`filtered`），1 个是 N+1 检测测试的夹具字符串。**正确写法被误伤。**

**白名单是违规基线。** `cli.mjs` 中 `compatibilitySelectStarPaths` 仍有 4 处引用，且断言要求实际集合与白名单**完全相等** ⇒ 修好一个文件必须同步改门。

### 2.3 Dexter 已有裁决尚未落地

2026-09-11 Dexter 裁决**路 A**：把判据收窄为「禁止对物理表 `SELECT *`」，排除 CTE 投影；唯一残留的测试夹具**改字符串**，⛔ 不排除测试源。该裁决随上一批需求整条删除而**未落地**。

### 2.4 判据可机器判定（已验证）

实测仓内 `FROM <名>` 共 1,180 处：**schema 限定 913 处（110 个表名），裸标识符 267 处（81 个名，全是 CTE 或别名）**。而 `SELECT * FROM` 的 **12 个目标全部是裸标识符，schema 限定 0 个**。

⇒ 判据可简化为一句：**`SELECT * FROM <含点的名>` 才算违规。** 不需要解析 SQL，也不需要同文件 CTE 查找。

### 2.5 方案设计

1. 按路 A 收窄 `R4_DATABASE_SELECT_STAR` 判据为「目标含 schema 限定」；
2. 删除 `compatibilitySelectStarPaths` 及其集合相等断言；
3. 测试夹具那处改字面量（`"select * from item where id = ?"` → `"select id from item ..."`）；
4. 把 `query-boundaries` 接进 `verify.mjs` 的 staticCommands；
5. 红夹具两条：对物理表写 `SELECT *` 必须变红；写 `WITH x AS (...), y AS (SELECT * FROM x)` 必须**保持绿**。

### 2.6 代价与收益

代价：改一个 checker + 一处测试字面量 + 一行接线。**这是七项里成本最低的一项。**
收益：一道装了从未跑过的门开始生效，同时删掉一份需长期同步的违规名单，并落地一条已裁未落的决策。

**⚠️ 建议优先做这一项。**

---

## 3. 项三 · `persistence/` 层的 write-path 禁令缺口

### 3.1 问题

`R4_BACKEND_WRITE_PATH_EXTERNAL_OR_EVENT_CHAIN`（`cli.mjs` 第 998 行）的分母是：

```
moduleSources.filter(file => /\/(?:application|domain)\//.test(file))
```

它禁止 `Kafka|WebClient|RestTemplate|@EventListener|@TransactionalEventListener|outbox|@Scheduled`，**分母只含 `application` 与 `domain`**。

上一批已在 `catalog`、`inventory`、`sales-menu` 等 module 建立 `persistence/`（含 JDBC 执行）。**JDBC 所在的那一层恰好不在分母内** ⇒ 后端规范 2-C（网络 I/O 不得出现在 `@Transactional` 方法内）唯一的机械支撑，在最需要它的地方失去覆盖。

### 3.2 方案设计

把分母改为 `/\/(?:application|domain|persistence)\//`。红夹具：在任一 `persistence/` 文件植入 `RestTemplate` 引用，门必须变红。

### 3.3 代价与收益

代价：一行正则 + 一条红夹具。
收益：补上一个随上一批交付而新产生的覆盖缺口。

**⚠️ 这一项是上一批的直接后果，建议与项二同批做掉。**

---

## 4. 项四 · `domain/` 分层

### 4.1 问题

**实测：17 个业务 module 中只有 3 个有 `domain/`** —— `sales-menu` 38 个文件、`workspace` 2 个、`organization` 1 个。**其余 14 个一个没有。**

没有 `domain/` 就没有地方放业务规则与不变量，规则只能留在 `application/` 的命令编排里，与事务、SQL、回执混在一起。

### 4.2 为什么是架构重构

`R4_BACKEND_DOMAIN_FRAMEWORK_DEPENDENCY` 禁止 `domain/` 出现 `org.springframework|java.sql`。而 `application/` 94 个文件中 80 个 import Spring。**每一条被移入 `domain/` 的规则都必须先剥离 Spring 与 JDBC 耦合** —— 这是改变执行边界的重写，不是移动。

### 4.3 方案设计

**方案 A · 只对新写的业务规则要求 `domain/`（推荐）**
存量不动；新增业务规则必须落 `domain/`。这是唯一不需要先做 14 个 module 架构重构的路径。

⚠️ 但它**没有可接线的门**（判定"这是新写的规则"需要历史对比），退化为 review 约定与规范条文。

**方案 B · 逐 module 迁移**
以 `sales-menu` 的 38 个文件为样板，逐 module 抽取业务规则。代价与项一同量级，且两项会在同一批文件上冲突。

**方案 C · 不做**
接受业务规则住在 `application/`，只靠项一把 SQL 分出去。

### 4.4 建议

**建议先做项一，再评估项四。** 项一把 SQL 抽走之后，`application/` 剩下的就是编排 + 业务规则两类；届时再判断分不分，判断依据会比现在清楚得多。**现在不做决定。**

---

## 5. 项五 · 前端可读性

### 5.1 问题(四类)

**巨型文件**（口径：`wc -l`，非测试文件）：

| 文件 | 行 |
| --- | --- |
| `catalog-management/model/catalogModel.ts` | 2,229 |
| `sales-menu/ui/SalesMenuPage.tsx` | 2,013 |
| `catalog-management/ui/CatalogDictionaryDrawerState.tsx` | 1,675 |
| `catalog-management/ui/LocalCatalogCopyDrawer.tsx` | 1,295 |

⚠️ **`SalesMenuPage.tsx` 于 2026-08 按 Drawer 边界从 3,209 行拆到 1,541 行，现在是 2,013 行。一次性搬迁会退化。**

**扁平巨目录**：`catalog-management/ui/` 下 **76 个文件**。

**目录词表漂移**：实测 23 个 feature（operations-admin 14 + platform-admin 9），其中 **15 个只有 `ui/`**（8 + 7）。同一类数据 hook 落在 `application/`、`ui/`、`model/` 三个不同位置。

**⚠️ 第四类是真正的障碍：没有可用的机器判据。**

### 5.2 判据困境(三轮尝试的记录)

| 判据 | 结果 |
| --- | --- |
| `ui/` 不得含 HTTP 调用（按 client 名枚举） | **漏报** —— 漏掉 `catalogInventoryClient`（14 处），且任何未枚举的标识符都能绕过 |
| 非 `.tsx` + 导出 `use*` + 含 HTTP | **漏报** —— 仓内两个数据模块导出的是 `readX()` |
| 是否 import 自 `app/api` | **过度捕获** —— 命中 31 个，多数只引生成类型 |

⇒ 三轮下来没有一个既完整又不过度捕获的判据。

### 5.3 方案设计

**方案 A · 只做巨型文件拆分，不设位置门（推荐作为第一步）**
按 Drawer / 职责边界拆那四个文件，不引入目录词表门。可读性收益直接、判据是 review。

⚠️ 必须处理退化问题：`SalesMenuPage.tsx` 拆过一次又长回来。方案 A 需要在 review 层约定"新增 surface 另建文件"，但这**没有门**。

**方案 B · 先解决判据，再设位置门**
判据需要区分「引类型」与「发请求」。可行方向是 AST 级判定（是否存在对 client 对象的调用表达式），而不是文本匹配。

⚠️ 这会引入一个 AST 检查工具，属于新基建，与「不过度设计」张力明显。**需 Dexter 裁决是否值得。**

**方案 C · 不做前端**
接受现状。

### 5.4 建议

**建议只做方案 A 的四个文件拆分，位置门留白。** 理由：四个文件的拆分收益确定、判据靠 review 可行；而为位置门引入 AST 工具的代价，三轮下来我判断超过收益。

**⚠️ 若 Dexter 认为位置漂移必须机器守住，则方案 B 需要单独裁决是否接受新增 AST 工具。**

---

## 6. 项六 · 后端测试文件切分

### 6.1 问题

| 文件 | 行 |
| --- | --- |
| `CatalogAcceptanceScenarios.java` | 9,299 |
| `SalesMenuAcceptanceScenarios.java` | 5,230 |
| `CatalogCategoryOwnerIntegrationTest.java` | 5,121 |
| `BusinessChannelAcceptanceScenarios.java` | 3,380 |

### 6.2 为什么收益低于风险

`CatalogAcceptanceScenarios` 有 125 个 private helper，**其中 83 个被多处调用，`readItem` 被调 116 次**。`SalesMenuAcceptanceScenarios` 还持有 `CatalogAcceptanceScenarios` 实例并调用其 11 个 helper 共 48 处。

拆开只有三条路：提基类（增加复杂度，且上一批明令禁止）、持实例并限定调用（116 处调用点全改）、复制 helper（违反 DRY）。

而 **scenario 由 `@AcceptanceScenario` 注解发现、按 id 排序 —— 找一个 scenario 靠 id 不靠文件位置。**

### 6.3 方案设计

**方案 A · 不做（推荐）**
可读性收益低（定位靠 id）、风险高（scenario 分母是后端 business 判定的承重结构）。

**方案 B · 只约束新增**
新 scenario 按业务域建新文件，存量不动。零风险，但需接受长期两种形态并存。

**方案 C · 提共享基类后切分**
需要 Dexter 明确解除「不引入基类」对测试脚手架的约束。

### 6.4 建议

**建议方案 B。** 零风险、方向正确、不需要解除任何既有约束。

---

## 7. 项七 · `code-layout` 只管到 app 根

### 7.1 问题

`tools/code-layout/cli.mjs` 的白名单是：

- 第 19 行 `allowedRepositoryRootDirectories` —— 管**仓库根**；
- 第 17 行 `allowedBackendAppChildren = {bootstrap, configuration, edge}` —— 管 **backend app 的直接子目录**。

**它不管 module 内部，也不管 feature 内部。** 所以后端四段词表（`api`/`application`/`domain`/`persistence`）与前端三段词表在机器层**完全没有门**。

### 7.2 这解释了"防增量做不成"

上一批接受了「防增量只有 review 防线」这个削减。技术原因就在这里：**唯一能承担目录词表判定的工具，作用域不覆盖需要判定的那两层。**

### 7.3 方案设计

**方案 A · 扩 `code-layout` 覆盖 module 内部（后端）**
后端词表是四个固定段，判定是纯路径匹配，无语义歧义 ⇒ **可机器判定**。

⚠️ 前置：必须先完成项一与项四，否则门对当前字节恒红。按上一批的结论，整改门只能在其守卫的工作完成后入列。

⚠️ 另有一个已知细节：`code-layout` 第 165–167 行的 `EMPTY_SOURCE_DIRECTORY` 会让"先建空目录再搬"当场变红。

**方案 B · 不扩，词表只作规范条文**
维持现状，防增量靠 review。

### 7.4 建议

**建议方案 A，但排在项一之后。** 现在扩只会得到一道恒红的门。

---

## 8. 批次计划（已裁定）

### 8.0 ⚠️ 批次是执行顺序，不是交付单元

本文是**一个完整交付单元**。下列批次只表示**实施期的先后顺序与证据分段**，⛔ 不是可独立评审或独立授权的交付物。

具体地说：

- 本需求文档整体接受一次 `GO` / `NO-GO`；
- 通过后出**一份**详设与**一份**实施计划，覆盖全部十六批；
- 详设与计划整体接受评审与实施授权；
- 实施按批次顺序推进，每批产出自己的证据；
- 最终对**全范围**做一次实施后复核。

⛔ 不得把任何单批（含成本最低的批 1）单独交出去评审或单独申请授权。⛔ 不得按 module、按门、按 App 拆成独立 review cycle。


### 批 1 · 控制面修复（项二 + 项三 + 项六）

三项都不迁移业务代码，合并为一批。

内容：按路 A 收窄 `R4_DATABASE_SELECT_STAR` 判据为「目标含 schema 限定」；删除 `compatibilitySelectStarPaths` 及其集合相等断言；测试夹具改字面量；把 `query-boundaries` 接进 `verify.mjs`；把 write-path 禁令分母扩为 `application|domain|persistence`；后端规范写入「新增 acceptance scenario 按业务域建新文件」。

红夹具：对物理表写 `SELECT *` 变红；写 CTE 投影保持绿；在 `persistence/` 植入 `RestTemplate` 变红。

⚠️ 项六只改规范条文，⛔ 不切分任何既有测试文件。

### 批 2 · 前端四个文件拆分（项五方案 A）

按 Drawer 与职责边界拆 `catalogModel.ts`(2,229)、`SalesMenuPage.tsx`(2,013)、`CatalogDictionaryDrawerState.tsx`(1,675)、`LocalCatalogCopyDrawer.tsx`(1,295)。

⛔ 不设位置门，⛔ 不引入 AST 检查工具。防退化靠 review 约定「新增 surface 另建文件」。

⚠️ `SalesMenuPage.tsx` 拆过一次又长回来，该文件的拆分必须在 review 里说明新增 surface 的落点规则。

与后端无耦合，可在批 1 之后任意时点插入。

### 批 3 至批 15 · 持久化重构（项一方案 A，逐 module）

**口径**：L2 字节绑定文件清单，`modules/*/src/main/java/**/{api,application,domain}/**/*.java`，SQL 判据为字面量或 text block 以 SQL 语句起始关键字开头。

按文件数升序，先小后大，前两批用于验证迁移形态：

| 批 | module | 文件 | SQL 行 |
| --- | --- | --- | --- |
| 3 | `sales-menu` | 1 | 9 |
| 4 | `business-channel` | 2 | 9 |
| 5 | `fulfillment-production` | 2 | 19 |
| 6 | `asset` | 3 | 49 |
| 7 | `collaboration` | 3 | 34 |
| 8 | `extension` | 4 | 21 |
| 9 | `platform-admin-iam` | 4 | 69 |
| 10 | `workspace` | 4 | 14 |
| 11 | `store-contract` | 7 | 67 |
| 12 | `inventory` | 8 | 34 |
| 13 | `organization` | 15 | 177 |
| 14 | `catalog` | 20 | 305 |
| 15 | `workspace-iam` | 28 | 217 |
| | **合计** | **101** | **1,024** |

每批的交付判据：该 module 的 `api`/`application`/`domain` 三层 SQL 降为 0；§1.4 七条不变量逐条有证明；一次全量 backend acceptance，`CONTRACT` 与 `BUSINESS` 分别全绿、`businessMode=REAL`、`cleanup` 全绿、operation budget 作独立证据。

⚠️ **每批的 acceptance 必须晚于该批全部生产与测试代码改动。** 这一条在上一批交付时被违反过（验收跑在主要产物类诞生之前），必须逐批核对。

⚠️ 批 3 的 `sales-menu` 只有 1 个文件，适合先走通一遍完整形态（含行为钉住与不变量证明），再进批 4。

### 批 16 · 词表门入列（项七方案 A）

扩 `code-layout` 覆盖 module 内部，判定后端四段词表。

⚠️ 必须在批 15 完成后才入列，否则门对当前字节恒红。
⚠️ 注意 `code-layout` 第 165–167 行的 `EMPTY_SOURCE_DIRECTORY`：不得先建空目录再搬。

### 待评估 · 项四（`domain/` 分层）

批 15 完成后重新评估。届时 `application/` 剩下的是编排与业务规则两类，判断依据会比现在清楚。**现在不做决定。**

---

## 9. 已裁决事项（Dexter 2026-09-12）

| # | 问题 | 裁决 |
| --- | --- | --- |
| 甲 | 项五的位置门是否值得引入 AST 检查工具 | **不引入**。三轮文本判据均不可用（按 client 名枚举漏 `catalogInventoryClient`；按 `app/api` import 判过度捕获 31 个），AST 工具属新基建。只做四个文件拆分 |
| 乙 | 项六是否解除「不引入基类」对测试脚手架的约束 | **不解除**。走方案 B：只约束新增 scenario 建新文件，⛔ 不切分既有测试文件 |
| 丙 | 项一走 A（逐 module）还是 B（一次性） | **走 A**，13 批，按文件数升序。失败面隔离在单 module |
| 丁 | 项四现在决定还是等项一之后 | **等批 15 完成后再评估** |
| 戊 | 批次数量 | Dexter 同意分多批次顺序执行，不限批数 |

---

## 10. 明确不在本立项范围

- 不含详设与实施计划（Dexter 2026-09-12 指示）；
- 不设行数门，不设数值代理门；
- 不建违规基线、豁免清单或棘轮（项二恰恰要删掉已有的那一份）；
- 不动 L2 spec；
- 不做统一格式化、import 排序、命名大扫除；
- 不搬 `generated/` 与 `contracts/` 产物；
- 不含部署与切流。

---

## 11. 文档性质

本文是立项需求，含问题分析与方案设计，**不含详设与实施计划**。

Dexter 2026-09-12 已全部采纳作者建议并裁定批次计划（§8）。**七项均纳入执行**，其中项四推迟到批 15 之后重新评估。

本文作为**一个完整交付单元**整体接受评审。通过后出一份详设与一份实施计划覆盖全部十六批，整体接受评审与实施授权；实施按批次顺序推进，最终对全范围一次性复核。

⛔ 本文不构成实施授权。⛔ 任何单批不得单独评审、单独授权或单独收口。
