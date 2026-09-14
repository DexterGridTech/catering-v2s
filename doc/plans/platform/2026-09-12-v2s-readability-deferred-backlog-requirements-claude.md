# 可读性整改欠账立项 · 问题分析与方案设计

- **日期**：2026-09-12 · **作者**：Claude · **版次**：**第五版（定稿）**
- **版本沿革**：399 行（一）→ 588（二）→ 661（三）→ 679（四，⚠️ 头部漏改仍写"第三版"，由 Codex 指出）→ 本版（五）。三轮 fresh 独立子 agent 盲审 + 两轮 Codex 独立 review，**五轮 verdict 全为 `NO-GO`**，逐条处置见 §16。
- **裁决状态**：**§14 六条范围裁决已由 Dexter 2026-09-12 授权作者按「最优最长远的方向」裁定**，结果见 §14，本文因此定稿。
- **性质**：立项需求，含问题分析与方案设计。⛔ **本文不含详设与实施计划**，按 Dexter 2026-09-12 指示停在方案层。
- **来源**：2026-09-11 后端可读性整改需求分析中被挑出并移出该批的问题。⚠️ 七项中只有项一是该批明确标记「单独立项」的；项二、三、七是分析过程中发现的**新问题**，其来源见 §15。
- **判据住址**：后端怎么写才算对 = `doc/platform/backend-coding-standard.md`（尤其 §2.5 `R-READ-01…08`）；评审动作 = `doc/platform/review-standard.md`；范围权 = `doc/platform/foundation-charter.md`。⛔ 本文不复述这些规则，只引用。
- **数字纪律**：见 §2，按 `R-READ-08` 执行。

---

## 0. 第一性目标

Dexter 2026-09-11 的授权原话是唯一方向：**「后续有很强的人类的阅读性和可维护性，但不能过度设计和增加系统复杂度」**。

| 要达到什么 | 判别式（人的动作，不是指标） | 涉及 |
| --- | --- | --- |
| **门真的在跑，且判对** | 随手写一处违规，`scripts/verify` 会红；随手写一处正确写法，它保持绿 | 项二、三（⚠️ 项七按 §14 建议走 B「只进正本、不建门」，对这一行贡献为零 —— 它服务的是「规则有住址」而不是「门在跑」） |
| **业务判断与持久化细节分开读** | 打开一个 `application/` 类，想知道"这条业务规则是什么"时不必跨过 SQL 字符串 | 项一、四 |
| **单个文件能在一次注意力内读完** | 找一个 surface 的实现，不必在两千行里搜 | 项五、六 |

⚠️ **反向约束同等重要**：任何一项若需要新建工具、新建豁免清单、新建棘轮或新增抽象层才能成立，**代价已经超过收益**。

⚠️ **第二版的最大改动来自这条约束本身**：第一版为项一选了「建 `persistence/` 搬 SQL 执行」，两轮盲审各自独立指出 —— **达成上表第二行的判别式并不需要搬执行**，而搬执行的代价高一个量级。见 §3。

---

## 1. 这些项为什么不在上一批

上一批的第一性目标是「打开任一后端 owner 服务，不必读完上万行就知道它负责什么」，最终只保留一条需求：按聚合拆五个 God class。

| 类 | 项 | 理由 |
| --- | --- | --- |
| **上一批明确标记「单独立项」** | 一 | 全量 SQL 归位，改执行边界，不是搬位置 |
| **分析过程中新发现的控制面缺陷** | 二、三、七 | 门未接线 / 门的分母缺层 / 门的作用域不覆盖要判的层。⚠️ 与可读性无关，是**新范围**（§15） |
| **判据或收益当时不成立** | 四、五、六 | 无可用机器判据，或收益低于风险 |

⚠️ 七项的执行形态由 §14 六条裁决确定（Dexter 2026-09-12 授权作者裁定）：项一走两步、项五拆三个、项六只修门、项七只进正本，项四与第八项推迟。

---

## 2. 口径与数字纪律（按 `R-READ-08`）

`R-READ-08` 原文要求：任何「全量/唯一/零/只有」或候选规模数字必须绑定**可复现的当前源全集和明确口径**；无法可靠复算的必须标 `UNVERIFIED_REQUIRES_EVIDENCE`；**未具备完整分母和真实 red mutation 的判据只能保持 review 规则，不能伪装成机器门**。

第一版在这条上塌了九处（§16 记录）。本文据此定三条：

1. **每个数字后面写清判据**，判据必须能被评审者从仓根一行复跑；
2. **本文不承载需要精确枚举才能成立的决策**。凡决策依赖精确清单的只给规则，清单在详设阶段按详设固定的**唯一判据**一次性产出；
3. ⛔ **本文任何数字都不得被下游当成验收分母。** 验收分母由详设定义并按 `R-READ-08` 自建。

---

## 3. 项一 · 后端持久化归位

### 3.1 问题

**判据**：`apps/backend/catering-business-server/modules/*/src/main/java` 下，路径中任一目录段为 `api`/`application`/`domain` 的 `.java` 文件，含以 SQL 语句关键字（`SELECT`/`INSERT INTO`/`UPDATE … SET`/`DELETE FROM`/`WITH … AS`/`MERGE INTO`，**带词边界**）起始的字符串字面量或 text block。

**判据变动下稳定的事实**：

- 命中 **13 个 module**：`asset`、`business-channel`、`catalog`、`collaboration`、`extension`、`fulfillment-production`、`inventory`、`organization`、`platform-admin-iam`、`sales-menu`、`store-contract`、`workspace`、`workspace-iam`；
- **`catalog` 与 `organization` 在两个量纲下都在最重的前三**；⚠️ 第三名随量纲变（文件数下 `workspace-iam`，SQL 条数下 `sales-menu`，两者差 1 条）⇒ 第二版写「最重三个恒为…」**不成立**，已改。前三的精确集合标 `UNVERIFIED_REQUIRES_EVIDENCE`；
- `audit-model`、`audit-read`、`execution-context` 零 SQL；`foundation` 只在自己的 `persistence/` 段内有真 SQL（`AdvisoryLock` 的 2 条 `SELECT pg_advisory_xact_lock`）。

⚠️ **per-module 精确文件数与 SQL 行数标 `UNVERIFIED_REQUIRES_EVIDENCE`**：两套判据分别得 `87 文件 / 1,483 行` 与 `101 文件 / 1,024 行`，差异**双向**（`sales-menu` 1↔6、`workspace-iam` 28↔18）⇒ 判据由详设固定后一次性产出。

### 3.2 问题的真实规模（第二版新增，它改变了方案选择）

**判据一**（字面量口径，可一行复跑）：`modules/*/src/main/java` 下路径含 `api`/`application`/`domain` 段的 `.java` 文件，取长度 ≥8 的字符串字面量，分两类 ——
- **起始类**：以 `SELECT`/`INSERT INTO`/`UPDATE `/`DELETE FROM`/`WITH `/`MERGE INTO` 起始（即 §3.1 判据）；
- **续接类**：不以上述起始，但含 `FROM`/`WHERE`/`JOIN`/`VALUES`/`ORDER BY`/`GROUP BY`/`ON CONFLICT`/`RETURNING`/`SET `/`LIMIT`/`OFFSET` 子句词。

| | 作者实测 | Codex 2026-09-12 独立复算 |
| --- | --- | --- |
| 起始类字面量 | 1,058 | 1,095（词边界口径 1,100） |
| 续接类字面量 | 1,875 | 1,808（词边界口径 2,015） |
| **抓不到的占比** | 63% | **62.3%** |

⚠️ **这三个数标 `UNVERIFIED_REQUIRES_EVIDENCE`**：两次独立测量方向一致而绝对值不同 ⇒ 当前文档给不出唯一可复算口径。⛔ **不得作为验收分母**，唯一 extractor 由详设定义（§10 批 3 判据 1）。**唯一稳定的结论是方向：续接类占大头，只禁起始类会让大部分 SQL 文本原地不动。**

⚠️ **这一条改变了验收判据的写法**：SQL 在本仓是**跨多个字面量拼接**的，只抓"以关键字起始"会漏掉大部分。⚠️ 而**词表也不能充当判据** —— 实测存在既非起始类、也不含任何候选子句词的真实片段（§10 批 3 判据 1 的反例）。⇒ 提取口径由详设唯一定义。

**判据二**（体量口径）：段名为 `application` 的 `.java` 文件。

| 事实 | 数 |
| --- | --- |
| 文件总数 | **130** |
| 其中 ≥1,000 行 | **26** |
| 最大者 `catalog/CatalogItemService.java` | **6,625 行**（上一批拆 God class 时新建的 target 类） |
| 含 `JdbcTemplate` 的文件 | **86**，合计 **67,624** 行 |

⚠️ **SQL 片段字面量的总量，相对这些文件的总行数是小头 —— SQL 不是它们难读的主因，文件体量才是。**（⛔ 此处刻意不给百分比：分子来自上表已标 `UNVERIFIED_REQUIRES_EVIDENCE` 的两组测量，给出比值等于让一个未验证的数承载论证。）而体量问题**不在本立项七项之内**（§14 第四条）。

⚠️ 第二版在这里写「SQL 文本 3,174 行（4.7%）/ 映射 154 行」，按其自述口径复算不出（变体得 1,379 / 2,835 / 3,778 与 96 / 113）。⇒ 已换成上面两套自带完整口径的判据。**结论方向（SQL 只占小头）在所有变体下都成立**，未变。

### 3.3 方案设计

⚠️ **前四版把「只搬字面量」（A0）与「搬执行」（A）当成互斥的两条路，那是错的。** A0 建 `persistence/` 并把 SQL 文本放进去，A 再把执行搬进**同一个**已建好的段 —— **A0 是 A 的第一步，不是 A 的替代品。** 下面据此重写。

**方案 A · 分两步走**【已裁定，§14 第一条】

- **第一步（原 A0）· 全部 13 个 module，一批**：在每个 module 建 `persistence/`，把该 module 的 SQL 片段字面量（起始类与续接类一并）抽成**纯常量持有类** —— 只有 `static final String`，无 Spring import、无 `JdbcTemplate`、非 bean、无方法。调用点保持 `query(XxxSql.FIND_BY_REF, …)`。**事务注解、传播、自调用、锁顺序、`REQUIRES_NEW`、readback 时机一处不动。**
- **第二步（原 A）· 逐 module，13 批**：把 SQL 执行方法搬进**已经建好**的 `persistence/`，`application/` 不再直接调五个执行方法。

**为什么分两步优于直接做 A**（这是本次裁决的实质内容）：

1. **结构先就位、文本先离场，再动最危险的那部分。** 第一步零执行边界变化，可用 diff + 有效值等价证明收口；第二步动的才是事务拓扑。直接做 A 则两件事在同一批里互相掩盖 —— 一个 `@Transactional` 语义偏差要在"文件变了、SQL 也变了"的 diff 里定位；
2. **§0 第二行判别式在第一步结束时就已达成。** 后续 13 批是为"执行归属"付的钱，而不是为"能不能读"付的；
3. **第一步给第二步造了落点。** 第二步不需要再讨论目录形态，`persistence/` 已经在那里、已经过一轮词表与门的检验。

**方案 B · 一次性全量搬执行** —— 13 个 module 的事务拓扑同时在飞。**不取。**

**方案 D · 只对最重的三个 module 做 A** —— **不取**：它会让 10 个 module 长期停在"SQL 文本在 `persistence/`、执行在 `application/`"，而另 3 个是完整形态。**两种形态长期并存是本项所有选项里最差的一个** —— 既拿不到统一的心智模型，又让后来者每进一个 module 都要先判断"这个是哪种"。（Dexter 的长期主义标尺在这里是决定性的：省下的 10 批不构成否决 A 的理由，形态分裂才是。）

**方案 E · 不做** —— **不取**。列出它是因为 §3.2 表明本项动的是这些文件的小头，而 §14 第四条那个问题动的是大头；但"有更大的问题"不是"这个问题不做"的理由，两者不互斥。

### 3.4 裁决与理由

**裁定：走方案 A，分两步。**（Dexter 2026-09-12 授权作者按「最优最长远的方向」裁定，§14 第一条。）

作者在第三、四版建议的是「先做第一步，再据新字节重估要不要做第二步」。**本次裁决把"重估"去掉了**，理由是长期方向本身已经清楚：

- 只做第一步，`application/` 仍然直接持有 `JdbcTemplate` 并调用五个执行方法 —— **持久化执行没有归属**，这正是"职责清晰"的反面；
- 把"要不要做第二步"留给未来重估，等于让形态分裂状态长期存在，而重估的时点没有任何人负责触发；
- 成本差别（1 批 ↔ 14 批）是真实的，但按 Dexter 一贯的标尺，**成本不是否决理由，无效才是**。第二步不是无效的：它是 `application/` 只剩编排与业务规则的唯一路径，也是项四（`domain/` 分层）能否成立的前提。

⚠️ **但两步各自独立收口**：第一步的判据⛔不得要求第二步的证明（§10 批 3），第二步按 `R-READ-01/03/04/05/06` 的完整要求（§10 批 4 起）。⚠️ 若第一步实测代价达到预估三倍，按 §15 停下来报告。

### 3.5 必须保持的不变量

**正本住址是 `doc/platform/backend-coding-standard.md` §2.5** —— `R-READ-03` 列的就是这组：`@Transactional` 全部属性、`TransactionTemplate` 传播、锁顺序、幂等回执、CAS、审计、权威 readback 的调用顺序，以及 bean-to-bean 调用改变代理边界时必须有行为证据。

⚠️ 第一版把 `doc/plans/platform/2026-09-11-…-requirements-claude.md` §4 标为「正本住址」，那是错的 —— 那是一份需求文档，不是正本。

**方案差异**：A0 **不触发** `R-READ-03`/`R-READ-05`（零执行边界变化，用 diff 即可证明）；A 与 D **完整触发**两条。

---

## 4. 项二 · `query-boundaries` 门未接线，且当前是红的

### 4.1 问题（本轮亲验当前字节，⛔ 不引历史文档状态）

`scripts/check/query-boundaries` 执行 `cli.mjs budget`，该函数承载 `R4_DATABASE_SELECT_STAR` 与 `compatibilitySelectStarPaths`。

**实测一：从未接线。** `tools/verify-gates/verify.mjs` 中 `query-boundaries` 命中 **0** 次。

**实测二：它今天是红的，不是绿的。** 按门自己的判据（`sourceFiles(modules)+sourceFiles(appRoot)`，`.filter(file => /\.java$/)`，命中 `/SELECT\s+\*/i`）实算，**实际集合 12 个文件，白名单 9 个**，超出三个：

- `catalog/application/CatalogItemService.java`
- `catalog/application/CatalogWorkbenchReadService.java`
- `inventory/application/InventoryBomService.java`

⇒ `R4_DATABASE_SELECT_STAR` 与 `R4_DATABASE_SELECT_STAR_COMPATIBILITY_SET_DRIFT` **两个 `fail()` 都会触发**。按现状接线，`scripts/verify` 立刻变红。

⚠️ **第一版写「仓内 2026-08-17 的文档已登记『未接线、绿』」，那是采信了一份历史文档的状态。** 这正是 `CLAUDE.md` 亲验纪律第一条禁止的事，也让第一版的「成本最低」判断失去依据。

### 4.2 两个连带子问题

**判据过宽。** 门禁的是字符串 `SELECT *` 本身，正确写法被误伤（全集见 §4.3）。

**白名单是违规基线。** `compatibilitySelectStarPaths` 定义在 `cli.mjs` 第 928 行，列 9 个路径、4 处引用，第 940–951 行要求实际集合与白名单**完全相等** ⇒ 修好一个文件必须同步改门。

### 4.3 目标全集（按门自己的分母枚举）

⚠️ **口径修正**：门的分母是 `.filter(file => /\.java$/)` ⇒ **`.sql` 与 `.mjs` 不在扫描范围**。第一版把 migration 里的 `pg_temp.*` 当成判据反例，而它根本进不了这道门。

`.java` 分母内的 12 个文件，形态分五类：

| 形态 | 例 | 门该怎么判 |
| --- | --- | --- |
| 同查询内 CTE / 别名投影 | `audit_rows`、`ranked`、`events`、`filtered`、`matching` | 绿 |
| **派生表** `FROM (SELECT …)` | `InventoryBomService` 第 2023 行 `) SELECT * FROM (SELECT 'TARGET' AS row_kind,` | 绿 |
| 物理表 | 当前 12 个里没有 | **红** |
| 测试夹具字面量 | `DatabaseOperationTrackerTest` 的 `select * from item where id = ?` | 改字面量（Dexter 已裁：⛔ 不排除测试源） |
| **Java 注释** | 门自己的红夹具 `cli.mjs` 第 1973 行写的是 `'// SELECT * FROM organization.commercial_group\n'` | 见下 |

⚠️ **第一版据不完整扫描下的断言「含点即违规」不成立**，已删。派生表与注释两类是第一版完全漏掉的形态。

⚠️ **实测：`.java` 分母内 13 处 `SELECT *`，对物理表零处。** 目标逐个是 `audit_rows`(2)、`filtered`(5)、`ranked`、`events`、`matching`(2)（全是同查询内 CTE 或别名）、1 处派生表 `(`、1 处测试夹具 `item`。⇒ **收窄判据阻止的是一件今天不存在的事，本项价值全在防增量。** 这一点改变了方案比较，见 §4.5。

⚠️ 分类重叠说明：测试夹具那处 `select * from item where id = ?` 形态上就是物理表（只是那张表不存在），由 §4.5 第 4 条处置。

⚠️ **注释那一类是收窄判据的硬约束**：门的自测红夹具本身是一行 Java 注释。任何把注释排除掉的实现都会让这条自测由红变绿；保留注释匹配则「判据过宽」只修了一半。**详设必须先解决这个自指问题。**

### 4.4 需求层只钉门的行为，不规定正则

四条可证伪的夹具约束，全部落在 `.java` 分母内：

1. 对**物理表**写 `SELECT *` ⇒ **必须红**；
2. 同查询内 **CTE 或别名**投影 ⇒ **必须保持绿**；
3. **派生表** `FROM (SELECT …)` ⇒ **必须保持绿**；
4. 门**自己的红夹具**在收窄后仍必须能把门变红（形态由详设定：改夹具为真 SQL，或明确判据包含注释）。

⚠️ 按 `R-READ-08`，判据的实现形态必须自带完整分母与真实 red mutation；做不到的部分只能保持 review 规则，⛔ 不得伪装成机器门。

### 4.5 方案设计（两选一）

两案共同的前置：**裁决超白名单的三个文件**（`CatalogItemService`、`CatalogWorkbenchReadService`、`InventoryBomService`）—— 这是本项的第一件事，不是收尾。

**方案 A · 收窄判据后接线**（Dexter 2026-09-11 已裁的路 A）

1. 按路 A 收窄 `R4_DATABASE_SELECT_STAR`，满足 §4.4 四条夹具约束；
2. 删除 `compatibilitySelectStarPaths` 及其集合相等断言；
3. 测试夹具改字面量，⛔ 不排除测试源；
4. 把 `query-boundaries` 接进 `verify.mjs` 的 staticCommands。

⚠️ 代价集中在 §4.3 那条「注释自指」：门自己的红夹具是一行 Java 注释，收窄后必须重新造出一个能让门变红的真实形态。

**方案 B · 删除该条断言，规则降级为 review 规则**

1. 删除 `R4_DATABASE_SELECT_STAR` 与 `compatibilitySelectStarPaths` 及集合相等断言；
2. `budget` 的其余断言（含 `R4_DATABASE_LOOP_IO`）照原样接进 staticCommands —— **门本身仍然开始跑**；
3. 按 `R-READ-08` 把「⛔ 不得对物理表 `SELECT *`」写进 `doc/platform/backend-coding-standard.md` §2「只能靠 review 的类」，自带反例栏。

**这两案的差别只在防增量的守法**：实测今天真阳性为零（§4.3），而 CTE / 派生表 / 注释三类上下文都需要解析 SQL 才能正确区分 —— 按 `R-READ-08`「未具备完整分母和真实 red mutation 的判据只能保持 review 规则」，方案 B 与本文 §9 对项七两个谓词的处置**同形**。

⚠️ **作者建议方案 A，但它是条件性的。** 理由：Dexter 2026-09-11 已就路 A 裁决过，且 §4.4 四条夹具都能落在 `.java` 分母内 —— 项七那两个谓词做不到这一点，这就是两者处置不同的理由。

⛔ **但方案 A 的成立尚未被证明，进入实施前必须先闭合这一条**：把门的自测 mutation 由 Java 注释改为**真实 Java 字符串形式**，并逐个证明四种形态 —— 物理表红、CTE/别名绿、派生表绿、注释按裁定形态一致。**做不到就按本文自己的规则转方案 B**（§15）。⚠️ 在该证明产出之前，⛔ 不得把项二记为"低成本"。

### 4.6 代价与收益，以及"为什么只接这一道"

代价：**不是「一行接线」** —— 先要处置三个红文件，再改 checker 与夹具，再接线。

⚠️ **实测：`scripts/check/` 下 41 个非 `.mjs` 条目里，24 个在 `verify.mjs` 零引用**，含 `admin-boundaries`、`security-boundaries`、`capability-invariants`、`module-dependency-registry`、`production-conformity` 等。第一版写「唯独没有它」是错的。

**本项只接这一道的理由**：它是这 24 道里唯一同时满足三条的 —— 判据本身是错的（误伤正确写法）、带一份需长期同步的违规基线、且已有 Dexter 裁决未落地。其余 23 道按阶段标尺进 `HANDOFF.md` 欠账登记，⛔ 本立项不处理。

---

## 5. 项三 · 写路径禁令的分母缺层

### 5.1 问题（第二版已更正前提）

`R4_BACKEND_WRITE_PATH_EXTERNAL_OR_EVENT_CHAIN`（`tools/verify-gates/cli.mjs` 第 998 行）的分母是：

```
moduleSources.filter(file => /\/(?:application|domain)\//.test(file))
```

⚠️ **第一版说「上一批已在 `catalog`、`inventory`、`sales-menu` 建立 `persistence/`」—— 这是假的。** 实测全 `apps/backend` 下名为 `persistence` 的目录只有两个，都属 `foundation`。上一批建的是 facade + target bean，**target 类全部落在 `application/`**。

**JDBC 的真实落点**：

| 层 | module × 文件 |
| --- | --- |
| `application/` | 12 个 module、**86 个文件**（已在分母内） |
| `sales-menu/infrastructure/` | 1（`JdbcSalesMenuRepository`，3 处 `JdbcTemplate`） |
| `workspace/adapter/` | 1（`JdbcGroupWorkspaceRepository`，3 处 `JdbcTemplate`） |
| `foundation/persistence/` | 1（`AdvisoryLock`） |

⇒ **今天真实的分母缺口是 `infrastructure` 与 `adapter` 两层、共 2 个业务文件**，不是 `persistence`。

⚠️ **但补完这两层，分母仍不完整**：该门禁的是 `Kafka|WebClient|RestTemplate|@EventListener|@TransactionalEventListener|outbox|@Scheduled`，与 JDBC 无关 —— 用 JDBC 落点当分母是**代理谓词**。按门的真实分母算，套上 §5.2 的新正则后仍有约 119 个 module 主源 `.java` 在分母外，其中约 43 个**根本没有层段**（含 §9.3 登记的 5 个模块包根 `*Boundary`，以及 `audit-read` 的两个 TaskReadService）。今天这些文件都不含禁令 token，门的结论不变。⇒ **本项只宣称"补两层"，⛔ 不宣称"分母已完整"**；残余缺口登记为已知敞口（§13）。

### 5.2 方案设计

把分母改为 `/\/(?:application|domain|persistence|infrastructure|adapter)\//`。

- `infrastructure|adapter` 今天就覆盖 2 个真实业务文件 ⇒ **红夹具种在 `sales-menu/infrastructure/`**，⛔ 不种在 `persistence/`（那里今天只有 `foundation`，证明不了业务写路径被覆盖）；
- `persistence` 预先加入：⚠️ **无论项一走 A0 还是 A / D，该段都会在各 module 出现** —— A0 在其中放 SQL 常量持有类，A / D 在其中放执行。（第二版写「若走 A0 该段仍只含 foundation」，与 §3.3 更正后的 A0 落点冲突，已改。）

### 5.3 代价与收益

代价：一行正则 + 一条红夹具。
收益：补上两层的覆盖缺口。⚠️ 第一版称本项是「上一批的直接后果」，不成立 —— 上一批没有建 `persistence/`，这两层是更早就存在的。

---

## 6. 项四 · `domain/` 分层

### 6.1 问题

**判据**：同 §3.1 的目录遍历，段名为 `domain`。**17 个 module 中只有 3 个有 `domain/`** —— `sales-menu` 38、`workspace` 2、`organization` 1，合计 41。

没有 `domain/` 就没有地方放业务规则与不变量，规则只能留在 `application/` 的命令编排里。

### 6.2 为什么是架构重构

`R4_BACKEND_DOMAIN_FRAMEWORK_DEPENDENCY` 禁止 `domain/` 出现 `org.springframework|java.sql`。而 `application/` 130 个文件中 **112 个提到 `org.springframework`**（其中 111 个有真 import 行；`workspace-iam/WorkspaceTaskReadService` 用全限定注解）。每一条被移入 `domain/` 的规则都要先剥离 Spring 与 JDBC 耦合 ⇒ 触发 `R-READ-03` 与 `R-READ-05` 全套。

### 6.3 方案设计

**A · 只对新写的业务规则要求 `domain/`** —— 存量不动。⚠️ 无可接线的门（判定"新写的"需历史对比），按 `R-READ-08` 只能保持 review 规则。
**B · 逐 module 迁移** —— 代价与项一方案 A 同量级，且两项会在同一批文件上冲突。
**C · 不做** —— 只靠项一把 SQL 分出去。

### 6.4 处置【已裁定，裁决丁】

**最后一个持久化批次完成后重新评估，现在不选方案。** ⚠️ 项四**不是**词表门的前置，理由见 §9.4。

---

## 7. 项五 · 前端可读性

### 7.1 问题（四类）

**巨型文件。判据**：`apps/frontend/*/src/**/*.{ts,tsx}`，排除 `.test.`/`.spec.`/`/test/`/`/__tests__/`**以及路径中含 `generated` 目录段的文件**（该条件第一版漏写）⇒ 分母 **271**。不加最后一个条件则分母 279。

手写文件 ≥1,200 行的**恰好四个**：

| 文件 | 行 | L2 覆盖实况（按真实 case ID 核过） |
| --- | --- | --- |
| `catalog-management/model/catalogModel.ts` | 2,229 | 无直接 case；59 个引用者**全部在 `catalog-management` 内** |
| `sales-menu/ui/SalesMenuPage.tsx` | 2,013 | `sales-menu.spec.ts`（路由级真实行为） |
| `catalog-management/ui/CatalogDictionaryDrawerState.tsx` | 1,675 | `catalog-inventory.spec.ts`：`CI-L2-008-01`、`CI-L2-008-02`、`catalog-config-success`、`catalog-config-failure`、`catalog-config-recovery` |
| `catalog-management/ui/LocalCatalogCopyDrawer.tsx` | 1,295 | 同 spec：`CI-L2-005-04`、`CI-L2-010-01`、`CI-L2-015-02` |

⚠️ **口径**：`catalog-inventory.spec.ts` 共 **41 个 `CI-L2-xxx-xx` case**，每个是驱动 switch 里的 `case 'ID':`，含真实登录、导航、点击与控件等待。

⚠️ **本文在这一列错过两次，记录在此以免第三次**：第一版用 grep 命中数（`DICTIONARY_ENTRY` 4 处），其中 3 处落在无关标识符 `..._DICTIONARY_ENTRY_INVALID`/`_MISSING` 内部；第二版据盲审改成「只有 1 条真实 case（第 866 行）」，而**第 866 行是 owner readback 事实种类的 switch 分支，根本不是 case**（Codex 2026-09-12 亲验）。

⇒ **覆盖是真实存在的，薄的是它相对本批风险的深度** —— 这些 case 验的是建条目、改配置、本地复制这些完整路径的 owner readback，⛔ **没有一条验「Drawer 关闭再打开时未提交输入的存续」**，而那正是拆分会动的东西（§10 批 2 判据 3）。

⚠️ 未入选者与判据更正：**排除生成产物的谓词是文件头标记，不是路径段** —— `app/catalog/generatedAdminCatalog.ts`（1,831 行）路径里没有 `generated` 目录段，靠文件头 `// Generated from contracts/catalog/admin-catalog.json; do not edit.` 与 `scripts/generate/catalog-admin-p3.mjs` 的产出归属排除；`app/api/generated/**` 的 `operations-edge.ts`（8,132）与 `platform-edge.ts`（3,769）两条谓词都命中。手写第五大是 `platform-admin/.../PlatformReadPage.tsx` 1,103 行。**1,200 行这个切点是作者判断，⛔ 不是门**（§13）。

⚠️ **`SalesMenuPage.tsx` 于 2026-08 从 3,209 行拆到 1,541 行，现在 2,013 行。一次性搬迁会退化。**

**扁平巨目录**：`catalog-management/ui/` 下 **75 个文件 + 1 个子目录**（`controllers/`）。⚠️ 上表后两个文件就在这个目录里 ⇒ **拆分产物若继续平铺，本批会加重这一类问题**（处置见 §10 批 2 判据 4）。

**目录词表漂移**：23 个 feature（`operations-admin` 14 + `platform-admin` 9）。**判据「子目录只有 `ui/` 一个」⇒ 15 个（8 + 7）**；若再加「且 feature 根下无顶层文件」⇒ 11 个（5 + 6）。⚠️ 第一版写 11 但印的是前一个判据。

**⚠️ 第四类是真正的障碍：没有可用的机器判据。**

### 7.2 判据困境（三轮尝试的记录）

| 判据 | 结果 |
| --- | --- |
| `ui/` 不得含 HTTP 调用（按 client 名枚举） | **漏报** —— 漏 `catalogInventoryClient`（14 处 / 3 个文件），任何未枚举标识符都能绕过 |
| 非 `.tsx` + 导出 `use*` + 含 HTTP | **漏报** —— 仓内两个数据模块导出的是 `readX()`（`business-channel/application/queries.ts`、`external-collaboration/application/queries.ts`） |
| 是否 import 自 `app/api` | **过度捕获** —— 多数只引生成类型。⚠️ 具体数标 `UNVERIFIED_REQUIRES_EVIDENCE`：第一版写 31，重测按不同变体得 34/36/136/160，无一为 31 |

⇒ 三轮下来没有一个既完整又不过度捕获的判据。按 `R-READ-08`，**位置门不具备门资格**。

### 7.3 方案设计

**A · 只做巨型文件拆分，不设位置门**【已裁定，裁决甲】
⛔ 不引入目录词表门，⛔ 不引入 AST 检查工具。
⚠️ 防退化只有 review 约定，**这一条没有门**（§13 已知敞口）。

**A' · 只拆便宜的那一半**（第三版新增）
`catalogModel.ts` 是**非 React 的模型模块**，59 个引用者全在 `catalog-management` 内，拆它不改变任何组件挂载/卸载或 state 生命周期 ⇒ 不触发 `R-READ-05` 的行为钉住。三个 React surface 是贵的那一半。
⚠️ 且 `SalesMenuPage.tsx` **已经在"只靠 review 防退化"这同一套机制下从 1,541 长回 2,013**（3,209 → 1,541 的历史值见 `doc/review/platform/2026-09-04-v2s-sales-menu-implementation-review-round2-claude.md` 第 95–97 行）⇒ 把批 2 最贵的行为钉住工作量花在一个已知会退化的目标上，收益可疑。
**这与 §3.4 为 A0 立论的方法同构**：先做便宜的一半，再拿新字节判断贵的那一半还要不要。

**B · 先解决判据，再设位置门** —— 需 AST 级判定。**不取**：新基建，与「不过度设计」直接冲突。
**C · 不做前端** —— **不取**：`catalogModel.ts` 的拆分收益确定且零行为风险。

**裁定：拆三个文件 —— `catalogModel.ts` + `CatalogDictionaryDrawerState.tsx` + `LocalCatalogCopyDrawer.tsx`；`SalesMenuPage.tsx` 推迟。**（§14 第五条）

理由（最优最长远）：

- 三个文件都在 `catalog-management` 内、都有 `catalog-inventory.spec.ts` 的真实 case 覆盖、且拆分后按职责建子目录能**顺带缓解那个 75 文件的扁平目录**（§7.1 第二类问题）—— 一次动作解两类问题；
- `SalesMenuPage.tsx` 是四个里**唯一有退化实证**的：2026-08 从 3,209 拆到 1,541，在"只靠 review 防退化"这同一套机制下又回到 2,013。**在机制没变的情况下再手工拆一次，大概率是第三次拆同一个文件** —— 重复一个已知会失败的操作，不是长期最优；
- ⇒ `SalesMenuPage.tsx` 推迟到**项五能给出新增 surface 的落点规则**（或前端目录词表在正本里有住址）之后再拆。这与项四、第八项的处置同构：**先让判断依据到位，再动手**。

⚠️ 推迟⛔不等于放弃：它进 §13 待评估，触发条件是"落点规则有住址"。

---

## 8. 项六 · 后端验收测试文件切分

### 8.1 问题（第二版已更正前提）

**判据**：`…/app/acceptance/*Scenarios.java`，`wc -l`。

| 文件 | 行 |
| --- | --- |
| `CatalogAcceptanceScenarios.java` | 9,409 |
| `SalesMenuAcceptanceScenarios.java` | 5,230 |
| `BusinessChannelAcceptanceScenarios.java` | 3,380 |

⚠️ **实测该目录已有 11 个 `*Scenarios.java`，且已按业务域分**：Iam / Organization / CommercialContract / Asset / Catalog / Audit / Extension / Collaboration / BusinessChannel / SalesMenu / P2ReadConnectionScope。

⇒ **第一版的方案 B「新 scenario 按业务域建新文件」等于描述现状**：一条新 Catalog scenario 的业务域就是 Catalog，它仍然落进那个 9,409 行文件。**方案 B 对触发本项的问题不产生任何影响。**

⚠️ `CLAUDE.md` 的原文是「业务断言按 IAM、ORG、商业合同、asset、Catalog **分别扩展对应的** `*AcceptanceScenarios.java`」。**同域内再切子域文件是否违反这条，是推论不是文本** —— 标为推论，不作为否掉方案 B 的独立理由。

### 8.2 切分的真实约束

- `CatalogAcceptanceScenarios` 有 **135 个 private 方法声明**（125 个不同名，9 名重载）；`readItem` 有 **119 个调用点**；
- `SalesMenuAcceptanceScenarios` 第 42 行持有 `private final CatalogAcceptanceScenarios catalog`，通过它调用 **11 个方法、49 处** —— **这个形态在仓内已经跑通**；
- ⚠️ **`BackendAcceptanceScenarioCatalog.discover()` 的 group 列表是硬编码 `List.of(...)` 十项**（`P2ReadConnectionScopeScenarios` 不在其中，由 `BackendAcceptanceTest` 单独调）。**新文件漏注册 ⇒ 其 scenario 静默不被发现，而 `discovered == selected` 依然自洽**（分子分母同时变小）。

⚠️ **更正（第三版）：校验这件事的门已经存在，而且已经漂了。** `scripts/test/backend-acceptance-structure.test.mjs`（36 行）的测试名是 `backend acceptance discovers all real scenarios through explicit domain groups`，**自称覆盖全集**，但第 13–20 行**硬编码 6 个** scenario 文件（缺 Audit、Extension、Collaboration、BusinessChannel、P2ReadConnectionScope），而实存 11 个；且它**已接线** —— `tools/verify-gates/verify.mjs` 第 66 行 `THCL-04-node-tests` → `scripts/test/test-health-entry-runner.mjs` 第 27 行。

⇒ 真实问题不是「没有门」，是**一道自称全集、实际只看 6/11 的绿门**。第二版写「仓内没有任何门校验」是错的，且方案 B 的「加一道门」会造第二个真相源 —— **应当修这道门，不是新建**。

⇒ **第一版称方案 B「零风险」不成立。**

### 8.3 方案设计

**A · 不做** —— 零改动。scenario 由 `@AcceptanceScenario` 注解发现、按 id 排序，找一个 scenario 靠 id 不靠文件位置，可读性收益本来就低。
**B · 按业务子域拆，新文件持旧类实例** —— 把 Catalog 内部按子域（item / category / copy / dictionary）拆出文件，新文件持一个 `CatalogAcceptanceScenarios` 实例（§8.2 已验证该形态跑通）。**必须同时**：把新类注册进 `discover()`，并**修** `scripts/test/backend-acceptance-structure.test.mjs` 那道已存在的门 —— 把硬编码的 6 个文件改为从目录枚举全集，⛔ 不新建第二道门。
**C · 提共享基类后切分** —— **不取**：需解除「不引入基类」约束，收益不足以换这个例外。

**裁定：不拆任何测试文件；但那道假绿门必须修，并入批 1。**（§14 第二条）

拆分与修门是两件事，前四版把它们捆在方案 B 里，导致"要么都做要么都不做"：

- **不拆**：scenario 由注解发现、按 id 排序，定位不靠文件位置 ⇒ 可读性收益低；而 scenario 分母是后端 business 判定的承重结构，`CLAUDE.md` 另有分域明文 ⇒ 风险与收益严重不配。**长期看，按 id 定位这个机制本身是对的，文件大不构成方向错误。**
- **必须修门**：`scripts/test/backend-acceptance-structure.test.mjs` 今天**自称覆盖全集而只看 6/11，且已接线** —— 它是一道**正在撒谎的绿门**。这与拆不拆文件无关，是独立的控制面缺陷，**长期危害远大于文件行数**：任何人新建一个 scenario 文件而忘记注册，它一条都不跑，而这道门会说"全都发现了"。
- ⇒ **修法**：把第 13–20 行的硬编码 6 个文件改为**从 acceptance 目录枚举全集**，并断言枚举出的每一个都出现在 `BackendAcceptanceScenarioCatalog.discover()` 的 groups 里。红夹具：新建一个 `*Scenarios.java` 不注册 ⇒ 必须红。

⚠️ 该修复归入**批 1**（控制面修复），⛔ 不单独成批。

---

## 9. 项七 · 目录词表在机器层没有门

### 9.1 问题

`tools/code-layout/cli.mjs` 第 19 行 `allowedRepositoryRootDirectories` 管**仓库根**，第 17 行 `allowedBackendAppChildren = {bootstrap, configuration, edge}` 管 **backend app 的直接子目录**。**它不管 module 内部，也不管 feature 内部。**

⚠️ **更要紧的一条（第一版完全漏掉）**：实测 `doc/platform/backend-coding-standard.md` 全文 **`persistence` 零处、「词表」零处**。§1「能变成门的十类」与 §2「只能靠 review 的九类」都没有目录词表。

⇒ **后端四段词表在正本里不存在。** 它只出现在 2026-09-11 那份**已作废**的需求里，接替它的终稿没有继承。按 `review-standard.md` §2：**记为设计侧缺口，补进正本，⛔ 不得就地立规则。**

### 9.2 这解释了"防增量做不成"

上一批接受了「防增量只有 review 防线」。技术原因有两条，第一版只写了第一条：唯一能承担词表判定的工具作用域不够；**而且这条规则本身没有正本。**

### 9.3 入列时的违规全集（已枚举）

**判据**：每个 module 取其全部 java 路径的公共目录前缀，前缀之后的第一段即层名；词表 = `{api, application, domain, persistence}`。**13 个业务 module 内违规 8 个文件**：

| 形态 | 文件 | 处置 |
| --- | --- | --- |
| 模块包根的边界类（5） | `PlatformAssetBoundary`、`ExtensionBoundary`、`PlatformIamBoundary`、`ContractBoundary`、`WorkspaceIamBoundary` | 见下 ⚠️ |
| `sales-menu/infrastructure/`（2） | `SalesMenuRepository`（接口）、`JdbcSalesMenuRepository` | 项一归位（**仅方案 A / D**；A0 不动它们） |
| `workspace/adapter/`（1） | `JdbcGroupWorkspaceRepository` | 同上 |

⚠️ 另有 4 个平台库 module 不适用业务四段词表：`foundation`（10 个内部段）、`execution-context`（`access`/`command`）、`audit-model`、`audit-read`（包根文件）。

⚠️ **两个谓词都还没有机器形态**：
- 「模块包根的边界类保持绿」—— 按 `*Boundary` 名枚举，正是 §7.2 判为「漏报」的按名枚举形态；放行「包根任意散文件」则豁免无法收窄；
- 「门按 module 分类判定」—— 业务/平台库的划分需要一份来源，而硬编码 17 个 module 的分类与 §4.2 批判的 `compatibilitySelectStarPaths` 是同一形态。

⇒ 按 `R-READ-08`，**这两个谓词在取得机器形态之前只能保持 review 规则**，⛔ 不得伪装成门。

### 9.4 方案设计

**A · 扩 `code-layout` 覆盖 module 内部**
前置**三条**：

1. **先把后端目录词表写进 `doc/platform/backend-coding-standard.md`**（今天正本零处）；
2. 项一走方案 A 或 D 并完成（把 §9.3 后两行的 3 个文件归位）；⚠️ 若项一走 A0，这 3 个文件不动 ⇒ 本项必须单独处置它们或放弃；
3. §9.3 两个谓词取得可机器判定的形态，否则按 `R-READ-08` 只能留 review 规则。

⚠️ **更正**：第一版写「必须先完成项一与**项四**」是错的。词表判的是「**出现的段必须在表内**」，不是「四段必须齐全」⇒ `domain/` 缺失不构成违规，**项四不是前置**。
⚠️ `code-layout` 第 **174** 行 `EMPTY_SOURCE_DIRECTORY`：不得先建空目录再搬。（第一版写 165–167，错。）

**B · 不扩，词表进正本后只作 review 条文** —— 收益：规则有了住址，防增量靠 review。代价：零。

⚠️ **方案 A 今天造不出来**：§9.3 两个谓词都没有机器形态，而它的判据要求它们有 ⇒ 选 A 会让详设第一步撞死。⇒ **A 改写为「待两个谓词取得机器形态后重估」**，不作为本次可选项。

**裁定：走 B，现在做，并入批 1。**（§14 第三条）

理由（最优最长远）：**规则没有住址是本仓最贵的长期债**。仓内已有一条同源教训（后端编码规范曾长期无正本，导致同一条规则在多处漂移）。今天后端四段词表在 `backend-coding-standard.md` 里**零处**，而本文、上一批需求、`code-layout` 的实现、以及项一的整个方案都在默认它存在 —— **一条被四处引用却没有正本的规则，是随时会各自解释的**。补进正本成本接近零，且它是后续任何词表讨论（含将来建门）的前提。

⚠️ 与上一批「本批不新增任何门」的接受不冲突：**B 不建门**，只把一条已被普遍默认的规则写进它该在的地方，并按正本 §5 自带反例栏。

---

## 10. 验收判据（可证伪）

⛔ 「门全绿」不是判据。⛔ 「规范文档里有这句话」只能作为交付物存在性，不单独构成本项通过。
**全部 acceptance 相关判据直接引 `doc/platform/backend-coding-standard.md` §2.5，⛔ 本文不自造。**
⚠️ `review-standard.md`「实施步骤级独立对账」与 `R-READ-06` 对**每一个已批准实施步骤**都生效，与走哪一支方案无关 —— 下列各批的清单⛔不是对它的豁免。

### 批 1 · 控制面修复（项二 + 项三 + 项六修门 + 项七词表进正本）

**项二走方案 A 时**：

1. 对**物理表**写 `SELECT *` ⇒ **必须红**；
2. 同查询内 CTE / 别名投影 ⇒ **必须保持绿**；
3. **派生表** `FROM (SELECT …)` ⇒ **必须保持绿**；
4. 门自己的红夹具在收窄后仍能把门变红（⚠️ 今天它是一行 Java 注释，见 §4.3）。

**项二走方案 B 时**：`R4_DATABASE_SELECT_STAR` 与白名单已删除，`budget` 其余断言（含 `R4_DATABASE_LOOP_IO`）各自仍有真实 red mutation；「⛔ 不得对物理表 `SELECT *`」已进 `backend-coding-standard.md` §2 且**自带反例栏**。

**两案共同**：

5. `query-boundaries` 出现在 `scripts/verify` 的**实际执行序列**中（⛔ 核执行序列，不核源码里有这个字符串 —— 本项的问题恰恰是「装了但没跑」。⚠️ 删去第二版的「且非 skip」：`verify.mjs` 没有 skip 机制，`staticCommands` 条目一律执行并须命中其 expected marker）；
6. **实际执行闭包中不存在任何由源文件路径派生的豁免**。
   ⚠️ 禁的不只是 `Set` 与集合相等断言 —— **集合、`switch`、正则、单路径 `endsWith`/`contains`/`startsWith` 判断，一律禁止**（Codex 2026-09-12 M-02）。只禁 `Set` 时下面这种写法能整条绕过，而它既不用 `Set` 也不用集合相等：

   ```
   if (file.endsWith("WorkspaceRoleService.java")) { return true; }
   ```

   闭包范围含 `cli.mjs` **及其 import 的全部 helper** ——仅核 `cli.mjs` 不成立：把豁免逻辑移进被 import 的 helper，`cli.mjs` 本身不含这些标识符而 gate 仍按旧白名单放行。同样⛔不写成「某标识符零引用」（改名即绿）。
   **正向证明**：用**真实物理表 `SELECT *`**（⛔ 不是注释、不是 CTE）的 mutation，逐一种进**全部 9 个历史白名单路径**，**9 处必须全部变红**；再加一个门此前未见过的文件，同样必须红。⚠️ 只测其中一两个不足以证明"所有路径型豁免已删除"；
7. §4.1 三个超白名单文件已按裁决处置，且处置后实际集合与判据一致。

**项三**：

8. §5.2 新增的**每一个**分母段都有自己的红夹具 —— `persistence/`、`infrastructure/`、`adapter/` 各植入一次 `RestTemplate` 引用，**三条都必须红**。⚠️ 判据数必须等于新增段数：第二版只种 `infrastructure/` 一处，实现成 `application|domain|infrastructure` 也能全绿，而 `workspace/adapter/JdbcGroupWorkspaceRepository`（§5.1 立论的两个文件之一）仍在分母外；
9. 交付里写明**残余分母缺口**（§5.1 的约 119 个无层段或非五段文件），⛔ 不得宣称"分母已完整"。

**项六 · 修那道假绿门**：

10. `scripts/test/backend-acceptance-structure.test.mjs` 不再硬编码文件名，改为**从 acceptance 目录枚举 `*Scenarios.java` 全集**，并断言每一个都出现在 `BackendAcceptanceScenarioCatalog.discover()` 的 groups 里；
11. 红夹具：**新建一个 `*Scenarios.java` 而不注册 ⇒ 必须红**（真实 red mutation，⛔ 非只改正向样本）；
12. ⛔ **本批不切分任何既有测试文件**（§14 第二条）。

**项七 · 词表进正本**：

13. `doc/platform/backend-coding-standard.md` 含后端四段目录词表条目，按该文 §2 归入「只能靠 review 的类」，且**自带反例栏** —— 该正本 §5 原文「每条规则必须自带反例，否则它不是规范，是口号」；
14. 条目须写明 §9.3 的两条既有豁免（模块包根的模块边界类、4 个平台库 module 不适用）及其可推翻条件；
15. ⛔ **本批不建任何新门**（§14 第三条）。

### 批 2 · 前端三个文件拆分（项五，范围已裁 §14 第五条）

**`UI_BEARING=false`，来源**：本批不新增、不删除、不修改任何 user-facing route / page / Drawer 入口或交互语义，四个文件在 IA 与交互工件里对应的控件形态与文案不变 ⇒ 不产出新 IA 与交互工件。
⚠️ **但拆 React surface 不是「纯结构拆分」**：按 Drawer 边界拆会改变挂载/卸载时机、重渲染范围与 Drawer 关闭后 in-progress 表单 state 的存续 —— 这是**执行边界变化**，按 `R-READ-05` **必须先行为钉住再移动结构**。
⚠️ `catalogModel.ts` 不在此列：非 React 模型模块，59 个引用者全在 `catalog-management` 内 ⇒ 拆它**不触发** `R-READ-05`（判据：diff 证明无组件、无 hook、无 JSX 变更）。
⚠️ **范围：三个文件** —— `catalogModel.ts`、`CatalogDictionaryDrawerState.tsx`、`LocalCatalogCopyDrawer.tsx`。⛔ **`SalesMenuPage.tsx` 不在本批**，推迟到落点规则有住址之后（§7.3 裁决、§13）。

1. `sales-menu.spec.ts` 与 `catalog-inventory.spec.ts` **两者保持绿**；
2. ⚠️ **覆盖缺口必须先补**：§7.1 的 case 验的是完整业务路径，**没有一条覆盖本批要动的那类行为**（组件挂载/卸载、重渲染范围、未提交输入的存续）⇒ 按 `R-READ-05`，每个被拆的 React surface 在动结构**之前**必须为这类行为补上真实 fixture、正负 business oracle 与写入后的权威 readback；⛔ 编译通过、测试名命中、控件存在性、既有 case 保持绿都不算关闭了这个缺口；
3. **in-progress 表单 state 存续行为逐 Drawer 对账**：拆分后关闭再打开 Drawer，未提交的输入其存续/清空行为必须与拆分前一致，交付里逐 Drawer 写明。⚠️ 这是本批自己点名的风险，缺这一条即不通过（第二版点了风险却没有判据）；
4. 逐 Drawer / 逐 surface 对账用户可见文案与控件形态，事实来源按 `review-standard.md` 动作 1-A 从代码提取；
5. 拆出的文件**不得继续平铺进 `catalog-management/ui/`**（该目录已 75 个文件）⇒ 按职责建子目录，形态参照已存在的 `controllers/`；
6. 每个拆出文件有表达职责的名字 —— ⛔ `SalesMenuPage2`、`Part1`、`Helpers` 即不通过；
7. 拆分产物落进按职责建立的子目录后，`catalog-management/ui/` 的顶层文件数**必须下降**（⛔ 不设具体数值，只要求方向：本批不得让该目录更平）。

⚠️ **删除了第二版的「不再位于行数前四」** —— 数值代理判据，与 §17 冲突，且新增四个更大文件即可零工作量通过。

### 批 3 · 项一第一步 · 全部 13 个 module 的字面量归位（一批）

**判据**（形态已裁：§14 第一条，走 A 的第一步）：

1. 该 module 的 `api`/`application`/`domain` 三层文件中，**不再有任何字符串字面量参与 SQL 构造**。
   ⚠️ **词表不能充当这条判据。** 反例（Codex 2026-09-12 亲验）：`catalog/application/CatalogSkuMediaFacts.java` 第 104、125 行的
   `" AND item.data_node_ref=? AND item.brand_ref=?"`
   是真实 SQL 拼接片段，却**不含任何**候选子句词（`SELECT`/`FROM`/`WHERE`/`JOIN`/`VALUES`/`ORDER BY`/`GROUP BY`/`ON CONFLICT`/`RETURNING`/`SET `/`LIMIT`/`OFFSET`）⇒ 搬走所有被列出的字面量、留下它，判据仍绿而目标未达成。反向地，把 `AND`/`OR` 加进词表又会误报普通业务文案。
   ⇒ **详设必须定义唯一的 SQL fragment 提取口径**，**至少覆盖**：`AND`/`OR` 续接、跨行字符串拼接、text block、转义、注释剔除、**helper 方法返回值**、**字段常量**、`StringBuilder`、`String.format`、`String.join`、**条件拼接**。
   ⚠️ helper 返回值这一类在仓内真实存在（`CatalogSkuMediaFacts` 就是 `String scope = cond ? "" : " AND …"` 再参与拼接），浅层 extractor 会整条漏掉：

   ```
   private String scope() { return " AND item.status=?"; }
   jdbc.query(BASE_SQL + scope(), …);
   ```

   ⇒ 按 `R-READ-08`，**无法可靠语义识别的构造必须输出显式清单并逐项完成 review，⛔ 不得静默作为通过**，也⛔不得伪装成机器门；
2. **有效 SQL 值与拼接顺序前后一致。证明方式被收窄为两种之一**：
   - **捕获比较**：捕获搬迁前后每个执行点的**运行时有效 SQL 字符串**与多片段拼接顺序，逐个比对相等；或
   - **完整数据流的源码级等价证明**：能解析到最终拼接结果，⛔ 不是"看起来一样"。

   ⛔ **普通业务 oracle 不得单独满足这条**（Codex 2026-09-12 M-01）：把 `BASE_SQL + " WHERE item_ref=?"` 改成 `BASE_SQL + " WHERE status=?"`，若 fixture 只有一行、断言只看返回对象或 readback，业务测试仍可能通过，而 receiver、方法名、实参顺序、`@Transactional`、`TransactionTemplate` 全部不变 ⇒ 结构判据与业务判据**双绿而 SQL 事实已改**。业务测试只能作为**补充**。
   ⛔ 该证明不得以恢复 hash-chain 或合规台账的形式满足（`R-READ-08`）；
3. 常量持有类落在该 module 的 `persistence/`，且**只有 `static final String`** —— 无 Spring import、无 `JdbcTemplate`、非 bean、无方法（可静态判定）；
4. **零执行边界变化，逐文件 diff 核**：每个执行调用点（`query`/`update`/`queryForObject`/`batchUpdate`/`queryForList`）的**接收者、方法名、实参顺序**逐处不变；`@Transactional` 的位置与全部属性不变；`TransactionTemplate` 调用不变。
   ⚠️ ⛔ **不得用任何总数作为判据**：A0 的全部内容就是把内联字面量换成常量引用，「内联字面量调用点数」这个量会被改动本身销毁（第二版用的 809 正是这个量）。也⛔不适用 §2 第 3 条禁止的"拿本文数字当验收分母"；
5. 收口：编译 + 类型 + 既有测试 + 一次 `R-READ-07` 全量 acceptance + `R-READ-06` 的步骤级独立对账。
   ⚠️ 「不触发 `R-READ-03`/`R-READ-05`」是**结论不是判据** —— 它由第 4 条的 diff 证明推出；若 diff 出现任何执行边界变化，该批立即按 A / D 支的完整要求处理。

### 批 4 至批 16 · 项一第二步 · 逐 module 搬执行（13 批）

**判据**（每批）：

1. 同上第 1、2、3 条（第 3 条改为：`persistence/` 含执行，`application/` 不再直接调五个执行方法）；
2. 按 **`R-READ-01`** 对候选范围内的 service / coordinator **逐个分类并写出纳入或排除理由**，⛔ 不得按规模数字决定边界。
   ⚠️ 与 §11 排序规则的关系：`R-READ-01` 管**纳入边界**，§11 的规模升序只管**先后顺序** —— 两者不冲突，但⛔ 不得用排序规则替代逐候选理由；
3. 按 `R-READ-03` 逐方法族枚举 self-call 及其外层事务属性，并证明代理边界变化后语义仍成立；
4. 按 `R-READ-05` 每个被移动的 public method family 先有真实 fixture、正负 business oracle 与写入后权威 readback，缺口在动结构**之前**补齐；
5. 按 `R-READ-04` 显式分类协调器 / task-read / support，⛔ 不得为消除重复新增带 JDBC / 事务 / 锁 / 回执的万能 support；
6. 按 `R-READ-06` 每一步结束后由 fresh 独立 reviewer 做三维对账，结果只能 `MATCHED` 或 `OPEN`。

### 全范围收口 · 直接引 `R-READ-07`

⚠️ **全立项只有一次全量 backend acceptance，在批 16 之后**。中间各批用编译 + 类型 + 既有测试 + 该批的 focused proof 收口。（⛔ 不是每批一次 —— 那是第一版自造的要求，比正本贵十三倍。）

- **最后一次**全量 backend acceptance 晚于**所有**生产与测试代码改动；
- 分开报告 `CONTRACT`、真实 `BUSINESS` oracle、信息性 `DB_OPERATIONS` 与 cleanup；
- ⛔ focused proof、静态检查、预算 verifier 或旧 run 不能代替；⛔ 多个单场景 run 不得拼成「全量通过」。

⚠️ **第一版在这里自造了两条要求，均已删除**：「每批一次全量 acceptance」（`R-READ-07` 要的是最后一次，一次）与「用内容哈希证明字节先后」（`R-READ-08` ⛔ 禁止创建已退役的 hash-chain 台账，且内容哈希只能确立同一性、不能确立先后）。

### 项七的词表条目已并入批 1（§14 第三条），此处只保留将来建门时的判据

⚠️ 本立项**不建这道门**（§14 第三条）。下列判据供将来两个谓词取得机器形态后重估时使用，⛔ 本立项不执行：

1. 在任一**业务 module** 造一个词表外目录 ⇒ **必须红**（真实 red mutation，⛔ 非只改 checker 正向样本）；
2. 4 个**平台库 module** 的现有结构 ⇒ **必须保持绿**，且业务/平台库的分类有**非硬编码**的来源（⛔ 硬编码 17 个 module 的清单与 §4.2 批判的白名单同形，也与 §17「不建豁免清单」冲突）；
3. 模块包根的边界类 ⇒ **必须保持绿**，且该判定有机器形态（⛔ 按 `*Boundary` 名枚举不算 —— 那正是 §7.2 判为漏报的形态）；
4. 入列后 `scripts/verify` 全绿且仍在分钟级。
   ⚠️ 已知噪声源：`code-layout` 以文件系统而非版本状态为判据，未跟踪的空目录会触发 `EMPTY_SOURCE_DIRECTORY`（第 174 行）。

## 11. 批次计划

### 11.0 ⚠️ 批次是执行顺序，不是交付单元

**来源：Dexter 2026-09-12 会话原话** ——「不管多少个批次，都是一份需求文档，要整体判定需求文档是否 go，然后进入详设和实施计划，最终按照顺序实施。所以没有所谓单独拿批 1 来 handoff」。（⚠️ 这不是 §12 裁决戊 的内容，戊 只记了「同意分多批次顺序执行，不限批数」。）

- 本需求文档整体接受一次 `GO` / `NO-GO`；
- 通过后出**一份**详设与**一份**实施计划，覆盖全部批次；
- 详设与计划整体接受评审与实施授权；
- 实施按批次顺序推进，每批产出自己的证据；
- 最终对**全范围**做一次实施后复核。

⛔ 不得把任何单批单独交出去评审或单独申请授权。⛔ 不得按 module、按门、按 App 拆成独立 review cycle。

### 批次与依赖

| 批 | 内容 | 依赖 |
| --- | --- | --- |
| **1** | 控制面修复：项二（收窄 + 接线，⚠️ 条件性，见 §4.5）、项三（分母扩五段）、项六（修那道假绿门，⛔ 不拆文件）、项七（四段词表进正本，⛔ 不建门） | 无 |
| **2** | 前端三个文件拆分：`catalogModel.ts`、`CatalogDictionaryDrawerState.tsx`、`LocalCatalogCopyDrawer.tsx` | 与后端无耦合，批 1 之后 |
| **3** | 项一第一步：**全部 13 个 module** 建 `persistence/` 并把 SQL 片段字面量归位，零执行变化 | 批 1 之后（词表已进正本，`persistence/` 的落点才有依据） |
| **4 – 16** | 项一第二步：**逐 module** 把执行搬进已建好的 `persistence/`，13 批 | 批 3 之后 |
| **收口** | 全范围**一次**全量 backend acceptance（`R-READ-07`） | 批 16 之后 |

**总计 16 批。** ⚠️ 这个数字来自裁决（1 + 1 + 1 + 13），⛔ 不来自任何本文拒绝冻结的清单。

**批 4–16 的 module 排序规则**（⛔ 不冻结顺序表）：

1. 按该 module 的命中规模**升序**，量纲与清单由详设按其固定判据一次性产出；
2. 第一批取规模最小者，用于走通完整形态（含 `R-READ-05` 行为钉住与 `R-READ-03` 事务证明），再进下一批；
3. ⛔ **不点名任何 module** —— 顺序完全由规则 1 的统一量纲产出。⚠️ 第二、三版曾写「`catalog`、`organization`、`workspace-iam` 恒为最重、排在最后」，与 §3.1 已更正的事实（第三名随量纲变）自相矛盾，已删。

⚠️ 批 3 与批 4–16 的关系：批 3 一次性建好全部 13 个 `persistence/` 段并放入常量，批 4 起才逐个搬执行。**这样批 4–16 的每一批都不再需要讨论目录形态，只处理事务语义。**

## 12. 已裁决事项（Dexter 2026-09-12）

| # | 问题 | 裁决 |
| --- | --- | --- |
| 甲 | 项五的位置门是否值得引入 AST 检查工具 | **不引入**（当前有效）。三轮文本判据均不可用（§7.2），AST 工具属新基建。⚠️ 该裁决当时附带「只做四个文件拆分」，**这半句已被 §14 第五条改写为三个文件**（`SalesMenuPage.tsx` 推迟） |
| 乙 | 项六是否解除「不引入基类」对测试脚手架的约束 | **不解除**（当前有效）。§14 第二条已据此裁定：⛔ 不拆任何测试文件，只修那道假绿门 |
| 丙 | 项一走逐 module 还是一次性 | **逐 module（当前有效，适用于第二步）**。§14 第一条已裁定走方案 A 分两步：第一步是全量一批（不搬执行，不适用本裁决），**第二步逐 module 13 批，即本裁决** |
| 丁 | 项四现在决定还是等项一之后 | **等项一最后一个批次完成后再评估** |
| 戊 | 批次数量 | 同意分多批次顺序执行，不限批数 |

---

## 13. 未决与边界

按 `R-READ-08` 的记号。作者决策依 Dexter 2026-09-11 的授权作出，逐条给理由与可推翻条件。

| 档 | 条目 | 理由 / 可推翻条件 |
| --- | --- | --- |
| `UNVERIFIED_REQUIRES_EVIDENCE` | 项一的 per-module 精确清单与规模 | 判据未固定（§3.1），两套判据双向漂移。详设固定唯一判据后产出 |
| `UNVERIFIED_REQUIRES_EVIDENCE` | §7.2 第三行「import 自 `app/api`」的命中数 | 重测按不同变体得 34/36/136/160，第一版写的 31 复现不出。⚠️ 方向（过度捕获）在所有变体下都更强，故裁决甲不受影响 |
| `UNVERIFIED_REQUIRES_EVIDENCE` | 项二收窄后的判据实现形态 | 需求层只钉 §4.4 四条夹具行为 |
| **作者已决** | 词表**允许**「模块包根的模块边界类」形态，5 个文件不搬 | 搬它要给它造一个新段名；它恰是表达模块边界的那一个类，搬进 `api/` 会与对外契约类混住。⚠️ 但该形态**没有机器判定式**（§9.3）⇒ 按 `R-READ-08` 只能是 review 规则。可推翻条件：若出现第二类包根文件，豁免立即收窄 |
| **作者已决** | 4 个平台库 module 不适用业务四段词表 | `foundation` 的 10 个内部段是它作为平台库的合理结构。⚠️ 该分类同样缺机器来源（§9.3） |
| **作者已决** | 前端巨型文件切点 1,200 行（手写非测试） | 只用于圈定范围，⛔ 不进任何 checker、不是门。手写第五大是 1,103 行，落线外是自觉取舍 |
| **已知敞口** | 项五方案 A 的防退化只有 review 约定，没有门 | 三轮判据均不可用。`SalesMenuPage.tsx` 拆过一次又长回来，是这个敞口的既有证据 |
| **已知敞口** | 项六无论走 A 还是 B，「新 scenario 必须注册进 `discover()`」今天没有门 | §8.2 实测。方案 B 把补这道门作为组成部分；方案 A 则该敞口保留 |
| **已知敞口** | 项五第二、三类问题（扁平巨目录、词表漂移）本批只做到"不加重" | 判据不可用（§7.2）。⚠️ 前端词表在机器层同样无门，项七方案 A 只覆盖后端 |
| **已知敞口** | 项三补完两层后，写路径禁令分母仍有约 119 个 module 主源文件在外（约 43 个无层段），含 5 个模块包根 `*Boundary` 与 `audit-read` 两个 TaskReadService | §5.1。今天这些文件都不含禁令 token，门的结论不变 ⇒ 本项只宣称"补两层" |
| **已知敞口** | `scripts/test/backend-acceptance-structure.test.mjs` 自称覆盖 scenario 全集，实际硬编码 6/11，且已接线 | §8.2。项六走 B 则修它；走 A 则该假绿保留 |
| **已知敞口** | 其余 23 道未接线的 `scripts/check` 条目 | §4.6。按阶段标尺进 `HANDOFF.md`，⛔ 本立项不处理 |
| **待评估** | 项四（`domain/` 分层） | 批 16 完成后重估（裁决丁）。届时 `application/` 只剩编排与业务规则两类，判断依据才清楚 |
| **待评估** | `SalesMenuPage.tsx` 的拆分 | 触发条件：**新增 surface 的落点规则在正本里有住址**（或前端目录词表有住址）。⚠️ 它已在只靠 review 的机制下退化过一次，在机制没变之前再拆是重复一个已知会失败的操作（§7.3） |
| **待评估** | 第八项：`application/` 层 26 个 ≥1,000 行的文件 | 本立项**全部完成后单独立项**（§14 第四条）。届时 SQL 与执行都已搬走，这些文件的体量与形态都变了，那时再定拆分轴才是对的 |

---

## 14. 六条范围裁决（已裁定）

**授权**：Dexter 2026-09-12 ——「待裁决的内容，你根据最优最长远的方向来裁决」。⇒ 下列六条由作者按该方向裁定，逐条给出理由与可推翻条件。⚠️ 按 `foundation-charter.md` 第 520 行，范围权本属 Dexter；本次是**显式授权下的代行**，⛔ 不构成作者对后续范围问题的一般性授权。

| # | 问题 | **裁定** | 理由（最优最长远） |
| --- | --- | --- | --- |
| **一** | 项一走 A0（只搬字面量）还是 A / D（搬执行） | **走 A，分两步**：第一步全量一批搬字面量并建 `persistence/`，第二步逐 module 13 批搬执行 | A0 是 A 的第一步而非替代（§3.3）。只做第一步则持久化执行没有归属；把第二步留给"未来重估"没有人负责触发，形态分裂会长期存在。成本差不是否决理由，**形态统一才是长期价值**。分两步比直接做 A 更安全：结构与文本先就位，再动事务拓扑 |
| **二** | 项六走 A（不做）还是 B（按子域拆 + 补门） | **拆分不做；那道假绿门必须修，并入批 1** | 前四版把两件事捆在一起。拆分：定位靠 id 不靠文件位置，收益低而 scenario 分母是承重结构 ⇒ 不做。修门：`backend-acceptance-structure.test.mjs` 今天**自称覆盖全集而只看 6/11 且已接线**，是一道正在撒谎的绿门 —— **它的长期危害远大于文件行数**，且与拆不拆无关 |
| **三** | 项七走 B（词表进正本）还是推迟 | **走 B，现在做，并入批 1** | 规则没有住址是本仓最贵的长期债，仓内已有同源教训。四段词表今天在正本里零处，而本文、上一批需求、`code-layout` 实现与项一整个方案都在默认它存在 —— 一条被四处引用却没有正本的规则随时会各自解释。补进成本接近零，且是将来一切词表讨论（含建门）的前提。⛔ 不建门，与上一批「本批不新增任何门」的接受不冲突 |
| **四** | `application/` 层 26 个 ≥1,000 行的文件（最大 `CatalogItemService` 6,625 行）是否立第八项 | **立项，但单独立项，本立项全部完成后启动**；现在记 `HANDOFF.md` | 它是实测出来的、比 SQL 片段更大的可读性问题，且是上一批交付**新产生的** ⇒ 不立项等于承认这笔债没人管。但它需要自己的需求文档；且项一走完之后 SQL 与执行都已搬走，这些文件的体量与形态都会变，**那时再定拆分轴才是对的**。与项四的处置同构 |
| **五** | 批 2 范围：四个文件还是只做 `catalogModel.ts` | **拆三个**：`catalogModel.ts` + 两个 Drawer；**`SalesMenuPage.tsx` 推迟** | 三个文件同在 `catalog-management`、有真实 case 覆盖，且拆分后建子目录可**顺带缓解 75 文件的扁平目录**。`SalesMenuPage.tsx` 是唯一有退化实证的（3,209 → 1,541 → 2,013），在防退化机制没变之前再拆是**重复一个已知会失败的操作** ⇒ 推迟到落点规则有住址（§13） |
| **六** | 项二、项三作为新范围是否纳入 | **纳入** | 门装了没跑、门的分母缺层，都是持续腐蚀的来源，且两者都是分钟级、零业务代码迁移、可独立证伪的控制面修复 |

⚠️ **可推翻条件**：任一条裁定若在详设中被证明代价远超预估（§15 的三倍触发），或被证明技术上不成立（如项二的注释自指无法闭合），⇒ 停下来报告 Dexter，⛔ 实施者不得自行改裁。

## 15. 范围裁决权与停机条件

沿用上一批需求 §8 的同一条，正本依据 `foundation-charter.md` 第 520 行：

- **若详设完成后发现代价超过可读性收益**，应把完整矩阵、成本与收益证据**报告给 Dexter**，由 Dexter 决定停止、推迟或缩小范围；
- ⛔ **实施者不得自行缩小范围后报完成**；
- ⛔ 实施者不得自行扩大范围。任何超出本文的工作项按 §14 第四条的形态先记 `HANDOFF.md`；
- **停机点**：任一批次的实测代价达到该批预估的**三倍**时，停下来报告，⛔ 不得继续推进后续批次。
  ⚠️ **预估基线必须在每批开始时定义，否则这条规则不可执行**（两个实施者会对同一成本作出不同的停机判断）：该批开工前，在实施计划里写明**成本单位**（建议：需改动的文件数 + 需新增或补齐的行为测试数）、**估算时点**（该批第一次写入之前）与**记录位置**；批次之间⛔不复用上一批的基线。
  ⚠️ 「三倍」这个阈值本身是作者判断；⛔ 不作为门，只作为**必须停下来报告**的触发条件 —— 是否继续由 Dexter 决定。

⚠️ 第一版删掉了这一整节，并反向写了「本文不再向 Dexter 索取任何裁决」。这是第二版恢复的 —— 上一批需求的 §8 正是因为同一个错误才被专门写入的。

⚠️ 本文来源声明的更正：§1 表已区分「上一批明确标记单独立项」（项一）与「分析过程中新发现」（项二、三、七）。第一版把七项统称「被明确移出该批并标记单独立项」，不成立 —— 项三更是上一批定稿时还不存在的问题。**三项属新范围，其纳入已由 §14 第三、六条裁定**。

---

## 16. 三轮独立盲审与处置

第一版（399 行）与第一次重写版（519 行）分别经作者标准对账与 **两个 fresh `INDEPENDENT_SUBAGENT` 盲审**（各自先独立测量 / 先读正本与先例，后读被审文档）。

| 轮 | reviewer | verdict | M/S/N |
| --- | --- | --- | --- |
| 作者标准对账 | 作者 | —— | 12 / 4 / 2 |
| 盲审一（数字与判据可复现性） | `INDEPENDENT_SUBAGENT` | `NO-GO` | 4 / 11 / 7 |
| 盲审二（方案合理性与内部一致性） | `INDEPENDENT_SUBAGENT` | `NO-GO` | 14 / 11 / 7 |
| 盲审三（对第二版全维度） | `INDEPENDENT_SUBAGENT` | `NO-GO` | 5 / 11 / 10 |
| Codex 独立 review（第三版） | Codex | `NO-GO` | 3 / 6 / 1 |
| Codex follow-up（第四版字节） | Codex | `NO-GO` | 2 / 1 / 1 |

**第三轮（两轮硬上限已用尽，`SELF_DECIDED` 收口）找到一条第二版的逻辑矛盾**：A0 的落点被写成「同包」，而 §3.1 的判据是**路径段**判据 ⇒ 常量类留在 `application/` 则判据恒红，而 `persistence/` 被 A0 自己排除、新建第五段又违反四段词表 —— 三条路全堵。第三版把 A0 的落点定为 `persistence/`（只含常量持有类、不含执行），矛盾消解。第三轮另外两条 M 同样已改：判据只禁"起始类"会让 63% 的 SQL 文本空转通过；「809 个执行调用点不变」这个分母会被 A0 本身销毁。第三轮也重算了本文 40 余处"实测"并**逐位命中**绝大多数，其判定是「测量纪律过关，塌在方案自身的内部可执行性」。

**前两个盲审独立落在同一条核心 finding 上**：项一的验收判据「三层 SQL 降为 0」被一个便宜十倍、不碰执行边界的做法完整满足，而 §3.2（原）的风险论证只在「搬执行」这个从未被论证的选择下成立。第二版据此新增方案 A0 并把选择交回 Dexter（§14 第一条）。

**Codex 两轮的核心贡献**：第一轮指出 A0 的验收闭包仍可"判据全绿而目标未达成"（词表漏报真实片段、未证明有效 SQL 值不变、白名单删除只核 `cli.mjs`）；第二轮进一步指出**普通业务 oracle 不能证明运行时 SQL 字符串等价**（fixture 只有一行时 `WHERE item_ref=?` 改成 `WHERE status=?` 仍可通过），以及**只禁 `Set` 挡不住路径派生的单路径分支**。两条都已收窄进 §10 批 1 判据 6 与批 3 判据 1、2。

逐条处置见 `doc/review/platform/2026-09-12-v2s-readability-deferred-backlog-requirements-adversarial-review-claude.md`。

---

## 17. 明确不在本立项范围

- 不含详设与实施计划（Dexter 2026-09-12 指示）；
- **不设行数门，不设数值代理门** —— 含 §7.1 的 1,200 行切点、原「行数前四」判据；
- 不建违规基线、豁免清单或棘轮（项二恰恰要删掉已有的那一份）；
- **L2 spec**：⛔ 不得修改既有断言以让拆分通过；✅ **允许为 §10 批 2 判据 2 的覆盖缺口新增用例** —— 按 `R-READ-05`，缺口不补就没有行为钉住，而钉住是该批的前置。
  ⚠️ 第二版写「⛔ 不动任何 L2 spec」，与 §10 批 2 判据 2 互斥（缺口只能写在 spec 里）；冻结约束的原意是「⛔ 不得改动既有证据链」，不是「⛔ 不得新增覆盖」。
- ⛔ **不创建 hash-chain 或合规台账**（`R-READ-08` 已退役控制）；
- 不做统一格式化、import 排序、命名大扫除；
- 不搬生成产物 —— `app/api/generated/**` 与 `app/catalog/generatedAdminCatalog.ts`；
- 不处理其余 23 道未接线的 `scripts/check` 条目（§13）；
- 不含部署与切流；
- ⛔ **本文任何数字都不得被下游当成验收分母**（§2 第 3 条）。

---

## 18. 文档性质

本文是立项需求，含问题分析与方案设计，**不含详设与实施计划**。

**本文已定稿。** §14 六条范围裁决已由 Dexter 2026-09-12 授权作者按「最优最长远的方向」裁定完毕，全部写入 §14 并落进 §10 的判据与 §11 的批次。

本文作为**一个完整交付单元**整体接受评审（§11.0，Dexter 2026-09-12）。通过后出一份详设与一份实施计划覆盖全部批次，整体接受评审与实施授权；实施按批次顺序推进，最终对全范围一次性复核。

⛔ 本文不构成实施授权。⛔ 任何单批不得单独评审、单独授权或单独收口。
