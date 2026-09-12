# apps/backend 与 apps/frontend 可读性整改 · 需求分析稿

- **日期**：2026-09-11 · **作者**：Claude
- **性质**：**讨论稿,不是正式需求**。不构成设计或实施授权。目的是把现状量清楚、把候选要求摆出来,供 Dexter 裁剪。
- ⚠️ 本文所有数字均为 2026-09-11 对当前字节实测,未运行任何构建或测试。

---

## 1. 第一性目标(沿用 TER,但换了主要痛点)

TER 那轮的目标是「打开任一包,从目录名就知道每个文件该在哪」。对 backend/frontend 来说同一句话仍然成立,但**最贵的痛点不同**。

TER 当时的痛是**散**:35 个散文件不知道该归哪。
backend/frontend 当前的痛是**聚**:一个文件把整个模块吃掉了。

所以本轮的第一性目标应当是:

1. 打开任一模块,**不必读完一个一万四千行的文件才知道它在干什么**;
2. 找一件事(某个查询、某条策略、某个命令),**在固定的目录里找,而不是在一个大文件里搜**;
3. 同一种东西在不同模块里**叫同一个名字、放同一个位置**。

⚠️ 仍然不是为了「看起来整齐」。下面每条候选要求都写了「不这样做,读代码的人会多付出什么」。

---

## 2. 现状实测

### 2.1 规模

| | 文件数 | 行数 |
| --- | --- | --- |
| `apps/backend` | 643 | 169,442 |
| `apps/frontend` | 343 | 74,140 |

（均已排除 `build/`、`node_modules/`、`dist/`、`generated/`。）

### 2.2 后端:不是方法太长,是 God class

| 文件 | 行数 | 方法数 | 行/方法 |
| --- | --- | --- | --- |
| `CatalogOwnerService.java` | **14,228** | 628 | 22.6 |
| `InventoryOwnerService.java` | 7,140 | 294 | 24.2 |
| `SalesMenuOwnerService.java` | 4,091 | 257 | 15.9 |
| `BusinessChannelOwnerService.java` | 2,692 | — | — |
| `BusinessEntityService.java` | 3,358 | — | — |
| `CatalogInventoryCoordinator.java` | 2,504 | — | — |

**这组数字里最重要的是第三列。** 22.6 行每方法是健康的 —— 单个方法并不臃肿,内部是有纪律的。问题是 **628 个方法挤在一个类里**。

这个区分决定整改方向:**不是"把长方法拆短",而是"把一个类按职责切开"**。前者是机械操作,后者需要先讲清职责边界。任何按行数下门的规则在这里都会失效,因为它会鼓励把 14,228 行切成 15 个 950 行的文件而职责照旧混在一起。

测试侧同样:`CatalogAcceptanceScenarios.java` 9,299 行、`CatalogCategoryOwnerIntegrationTest.java` 5,121 行、`SalesMenuAcceptanceScenarios.java` 5,230 行。

### 2.3 后端目录词表:`application/` 是万能垃圾桶

全部 module 的目录段频次:

```
application 48    api 26    domain 7    infrastructure 3
```

`domain/` 只在 `organization`、`sales-menu`、`workspace` 三个 module 出现;`infrastructure/` 只有 3 处。其余 module 的结构就是 `api/` 加 `application/` 两层。

**这直接解释了 14,228 行。** 没有 `domain/` 就没有地方放业务规则,没有 `persistence/` 就没有地方放 SQL,于是全部堆进 `application/` 里的一个 Service。

### 2.4 后端:手拼 SQL 的体量

四个 owner service 里含 SQL 关键字的字符串行:

| 文件 | 行 |
| --- | --- |
| `CatalogOwnerService` | 301 |
| `InventoryOwnerService` | 201 |
| `SalesMenuOwnerService` | 174 |
| `BusinessChannelOwnerService` | 115 |

约 791 行手工拼接的 SQL 片段散在业务方法之间。读一个业务判断时要跨过几十行字符串拼接,这是 God class 之外的第二重阅读成本。

### 2.5 前端:词表存在,但没有判据

`operations-admin` 14 个 feature 的二级目录频次:`ui` 14、`model` 4、`application` 3。
`platform-admin`:`ui` 9、`model` 2、`application` 1。

**14 个 feature 里 8 个只有 `ui/`** —— 查询、状态、业务判断、呈现全在同一层。

更要紧的是:同一种东西落在四个不同位置。以「候选/读模型 hook」为例:

| feature | 该类文件所在 |
| --- | --- |
| `business-channel` | `application/queries.ts` |
| `catalog-management` | `ui/useInventoryConsumptionTargetCandidates.ts` |
| `contract-management` | `ui/useContractStoreCandidates.ts` |
| `sales-menu` | `model/useSalesMenuReadModel.ts` |
| `workspace-user` | `application/useWorkspaceInvitationCandidates.ts` |

**同一类文件,四个位置:`application/`、`ui/`、`model/`、`application/`。** 这是本轮最硬的一条证据。

`business-channel` 同时有 `model/` 与 `application/`,而且区分是清楚的 —— `model/` 放 policy 与 code labels,`application/` 放 queries 与 types。也就是说**词表本来是对的,只是没有绑定到判据上**,于是其他 feature 各自发挥。

### 2.6 前端:拆过又长回去

`SalesMenuPage.tsx` 上个月按 Drawer 边界从 3,209 行拆到 1,541 行,当前是 **2,013 行**。

这条比任何静态数字都重要:**一次性整改会退化**。如果本轮只做「搬一遍」而不留可判定的约束,几周后会回到原点。

其余较大文件:`catalog-inventory.spec.ts` 2,921、`sales-menu.spec.ts` 2,529、`catalogModel.ts` 2,229、`CatalogDictionaryDrawerState.tsx` 1,675、`LocalCatalogCopyDrawer.tsx` 1,295。

### 2.7 既有规范的容量与已有规则

| 规范 | 行数 | 与本轮相关的既有内容 |
| --- | --- | --- |
| `backend-coding-standard.md` | 367 | `1-H · 分层命名与 split package` |
| `frontend-coding-standard.md` | 724 | `1-0 · 门只写禁止句`、`3-A · 同一件事只能有一种写法`（归在"做不成门"） |

两份都自设上限:「本文超过『半小时读完』,或门超过『分钟级』,就是在重建刚退役的那套控制面。」

**两个结论直接从这里出来:**

一,**本轮能加的规则数量很少。** TER 那轮加了 7 条(`TR-R01`–`TR-R07`)。backend/frontend 各加 3 到 5 条是上限,再多就违反规范自己的元规则。

二,**前端那条规则已经存在了。** `3-A · 同一件事只能有一种写法` 正是 2.5 节测到的问题,它现在归在"只能靠 review"那一类。所以本轮**不是加新规则,是给一条已有规则配一个可机器判定的判据** —— 目录词表就是那个判据。

---

## 3. 从 TER 能直接搬的与不能搬的

| TER 要求 | 能否搬 | 理由 |
| --- | --- | --- |
| 一 · 全局目录词表(闭合) | **能,且是本轮核心** | 2.3 与 2.5 都指向它;前端还能顺带把 `3-A` 变成可判定 |
| 二 · 可读性规则集 | **能,但必须极少** | 受 2.7 的容量上限约束 |
| 三 · 存量结构归位 | **能,但量级不同** | TER 是 12 包 35 文件;这里是 169k + 74k 行,必须分批 |
| 四 · 必拆单元 | **能,但判据要换** | TER 用行数硬顶;这里 22.6 行/方法说明行数门会误导,判据要用职责 |
| 五 · 启动结构化日志 | **不搬** | 后端已有 Spring 启动日志与 operation record;前端是浏览器应用,没有对应痛点 |

**必须新增、TER 没有的:**

| # | 候选 | 出处 |
| --- | --- | --- |
| 六 | SQL 承载位置 | 2.4 节的 791 行 |
| 七 | 防退化判据 | 2.6 节 `SalesMenuPage.tsx` 拆完长回去 |
| 八 | 测试文件的规模与归属 | 2.2 节 9,299 行的验收文件 |

---

## 4. Dexter 2026-09-11 已裁事实

| # | 裁决 |
| --- | --- |
| 甲 | 后端词表**引入 `persistence/`** |
| 乙 | 整改范围**全量**,不是先做两个样板 |
| 丙 | 目标是**改存量 + 防增量**,要求给出能同时做到的方案（见第 5 节） |
| 丁 | **一次性按顺序完成**,不接受"留到下一批" |
| 戊 | 测试文件（9,299 行验收）**在范围内**；仅指后端 Java 测试 |
| 己 | **L2 spec 不在范围内**（2,921 与 2,529 行）——与 policy 分母耦合，动它等于动证据链 |
| 庚 | 拆 `CatalogOwnerService` **之前必须先证明行为被测试钉住**（沿用 TER 需求 §7.1a 的前置） |

---

## 5. 「改存量 + 防增量」怎么做到 —— 我原来那三个方案都不行

先说结论:**(a)(b)(c) 没有一个能同时做到。**

- (a) 只靠 review:存量与增量都防不住,`SalesMenuPage.tsx` 从 1,541 长回 2,013 就是证据;
- (b) 新增设门、存量豁免:防住增量,但存量一行不动;
- (c) 行数只降不升的棘轮:能压存量,但它需要一个基线文件,而且行数是 2.2 节已经证伪的判据。

**但裁决乙(全量)把这道题解开了。** 全量整改之后**没有存量需要豁免**,于是门不需要例外、不需要基线、不需要棘轮 —— 它退化成一条普通的禁止句,而禁止句是本仓 `frontend-coding-standard.md` `1-0` 已经规定的门形态。

### 5.1 这不是新机制,是删掉一个已有的违规基线

`tools/verify-gates/cli.mjs` 第 928–938 行有一个 `compatibilitySelectStarPaths`,列了 **9 个允许出现 `SELECT *` 的文件**,第 947–950 行还要求实际集合与期望集合**完全相等**——修好一个文件必须同时改门。这 9 个里有 8 个位于 `application/` 下。

这就是「违规基线」的实物,连变量名都写着 compatibility。

所以本轮的防线不是"新增一个门",而是:

> SQL 搬进 `persistence/` 之后,把 `compatibilitySelectStarPaths` **删空并删掉**,让 `R4_DATABASE_SELECT_STAR` 变成无例外的禁止句。

**这比 (b)(c) 都强**:存量被真实改掉(不是豁免)、增量被无例外的门挡住(不是棘轮)、且仓里少一份需要长期维护的违规名单。同时它符合 `CLAUDE.md` 的「不要为了保持向后兼容而长期保留废弃方案」。

### 5.2 必须避开 2026-07-26 那次的失败模式

上一次结构整改(`doc/review/platform/2026-07-26-v2s-r5-s0-s4-structure-checkpoint-review-claude.md`)的失败原因记录得很清楚:

> S0 诚实地把控制标为 PENDING、承诺随 S1-S3 激活,但 S1-S3 完成了搬迁而控制没激活——绿灯因此部分空转。

当时我给出的对策是蓝图硬停「**控制不得以 PENDING 跨越它守卫的工作**」。本轮必须照此执行,并且因为裁决丁要求一次性按顺序完成,顺序只能是:

**每个维度:先激活门并用红夹具验真红 → 再搬 → 门转绿。** 不允许"先搬完,门随后补"。

这一条是本轮唯一的硬顺序要求,也是我建议写进实施计划准入的唯一一条。

### 5.3 Dexter 两条长期硬要求仍然适用

同一份记忆里登记的两条口头硬要求,本轮继续生效:

1. **搬 + 修必须同一遍**——纯 package move 不够,职责不清要一起修。放到本轮就是:`CatalogOwnerService` 不能只是被切成几个文件放进新目录,切的依据必须是职责。
2. **必须有强制约束,以后不能让开发 agent 再犯**——即 5.1 的无例外门。

---

## 6. 候选要求（按裁决更新）

### 要求一 · 后端目录词表（裁决甲）

闭合词表:`api` / `application` / `domain` / `persistence`。

- `api` —— 对外契约与 DTO;
- `application` —— 命令编排与事务边界,**不承载业务规则,不承载 SQL**;
- `domain` —— 业务规则、不变量、值对象;
- `persistence` —— 所有 SQL 与行映射。

**门的形态(禁止句):** `application/` 与 `domain/` 下的文件不得含 SQL 关键字字符串;`api/` 不得引用 `JdbcTemplate`。

**不这样做的代价:** 业务规则与 791 行 SQL 无处安放,继续堆进 `application/` 的 Service,下一个 14,228 行必然出现。

### 要求二 · 前端目录词表

闭合词表:`ui` / `model` / `application`。

**门的形态(禁止句):** `ui/` 下的文件不得含 HTTP 调用;`application/` 下不得含 JSX。

这句可机器判定,因此 `frontend-coding-standard.md` 的 `3-A · 同一件事只能有一种写法` 从"只能靠 review"升级为可成门。**本轮不新增规则条目,是给已有条目配判据。**

**不这样做的代价:** 2.5 节那张"同一类文件四个位置"的表会继续扩大。

### 要求三 · 必拆单元的判据用职责

**一个类只能有一个事务入口族。** `CatalogOwnerService` 的 628 个方法覆盖 item、category、sku、attribute、option、bom、inventory 协同等多个聚合,这才是拆的理由。

**不设行数门。** 理由见 2.2:22.6 行/方法说明方法本身健康,按行数拆会得到 15 个 950 行文件而职责照旧混着,读的人更难找。行数只作为 review 时要求说明单一职责的粗筛信号。

### 要求四 · SQL 只在 `persistence/`,并删掉违规基线

见 5.1。交付判据包含 `compatibilitySelectStarPaths` 被删除、`R4_DATABASE_SELECT_STAR` 无例外。

### 要求五 · 测试文件（裁决戊）

`CatalogAcceptanceScenarios.java` 9,299 行、`CatalogCategoryOwnerIntegrationTest.java` 5,121 行、`SalesMenuAcceptanceScenarios.java` 5,230 行在范围内。

⚠️ **这一条风险与其余四条不同。** 验收文件拆分会动到 scenario 注册与分母,而 scenario 分母是后端 business 判定的承重结构。**建议判据只允许"文件切分 + scenario 集合逐条不变"**:拆完之后 `discovered`/`selected` 必须仍是同一个数、同一组 id。不得借拆分之机增删或改名任何 scenario。

### 要求六 · 词表落地位置

写进 `backend-coding-standard.md` 与 `frontend-coding-standard.md`。两份分别 367 与 724 行,且都自设「半小时读完」上限,因此**各只允许新增 3 到 4 条**,并优先改写既有条目而非新增(要求二就是改写 `3-A`)。

---

## 7. 我认为不该做的

- **不做统一格式化 / import 排序 / 命名大扫除。** 巨量 diff、零理解成本收益,且会让所有历史证据的字节绑定作废。
- **不为可读性引入新抽象层或框架。** 本轮只搬位置、划边界、拆职责。
- **不搬 `generated/` 与 `contracts/` 产物。** 形状由生成器决定。
- **不动 L2 spec 的 2,921 与 2,529 行。** 它们与 policy 分母耦合,动它等于动证据链;裁决戊覆盖的是后端测试文件,不含 L2 spec。若要一并做,需你另行确认。
- **不追求两个前端 App 结构对称。** 109 文件的 `catalog-management` 与 2 文件的 feature 不该套同一套细分;词表是闭合的,但不要求每个 feature 都建满三个目录——只要求"有的话必须叫这个名字、放这个位置"。

---

## 8. 建议顺序（裁决丁:一次性按顺序完成）

每一步的内部顺序都是 **门先红 → 再搬 → 门转绿**。

| 步 | 内容 | 门 |
| --- | --- | --- |
| 0 | 两份 coding standard 写入词表与判据;`code-layout` 扩到 module 内部 | 新门先以红夹具验真红 |
| 1 | 后端 `persistence/` 建立,791 行 SQL 迁入;删 `compatibilitySelectStarPaths` | `R4_DATABASE_SELECT_STAR` 无例外转绿 |
| 2 | 后端 `domain/` 补齐(现仅 3 module 有),业务规则迁入 | `application/`+`domain/` 禁 SQL 门转绿 |
| 3 | `CatalogOwnerService` 14,228 行按聚合拆;`InventoryOwnerService` 7,140 行同法 | 单一事务入口族(review 判据) |
| 4 | 其余 module 按同一词表归位 | 同上 |
| 5 | 前端 14 + 若干 feature 按 `ui`/`model`/`application` 归位 | `ui/` 禁 HTTP 门转绿 |
| 6 | 后端测试文件切分,scenario 集合逐条不变 | `discovered`/`selected` 分母与 id 集合不变 |

每步验收判据是「打开某个目录能不能找到某类东西」与「对应门是否无例外转绿」,不是「行数降了多少」。

---

## 9. 两处已确认（2026-09-11）

- **L2 spec 不做。** `catalog-inventory.spec.ts` 2,921 行与 `sales-menu.spec.ts` 2,529 行不在本轮范围；裁决戊的"测试文件"仅指后端 Java 测试。
- **拆分前置成立。** 步 3 拆 `CatalogOwnerService` 之前，必须先证明该类的行为被测试钉住，再动结构。628 个方法不先钉住就拆，回归风险显著高于 TER 那轮。该前置会让步 3 明显变长，已接受。

因此步 3 的内部顺序是:**行为钉住 → 门先红 → 拆 → 门转绿**，比其余各步多一段。

---

## 10. 文档性质

本文是讨论稿,已并入 Dexter 2026-09-11 五项裁决。数字可引用;要求一至六尚未经独立评审,不构成实施授权。
