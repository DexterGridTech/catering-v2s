# B1 实施独立评审

- 评审人:Claude(独立评审侧)
- 日期:2026-08-17
- REVIEW_TARGET:`IMPLEMENTATION`
- 会话出处:fresh v2s-rooted 会话;本仓零写入,唯一写入是本文件

## 结论

**`GO`(仅限批准范围) · M=0 · S=0 · N=4**

⚠️ **2026-08-17 更正:原 S-1 已全条撤回,结论由 `S=1` 改为 `S=0`。**
撤回原因见 §5「S-1(已撤回)」—— **是我的检索错误,不是实施缺陷**。
实施对已批准 CP 忠实,无 M 无 S。

---

## 0 · 证据等级与我的可信度

全文结论均为本会话内亲验:打开源码、跑命令、逐条对照需求与详设。

⚠️ **本轮我的测法失误五次**,均已发现并纠正,列出以便你判断可信度:
① `timeout` 在本机不存在,导致一轮门循环空跑而我读成「全绿」;
② 用 `bash` 跑 node 脚本、用 `node` 跑 bash 脚本各一次;
③ 把信息输出行当成失败标识;
④ zsh 把 `--include=*.java` 当 glob 展开,grep 全部落空;
⑤ 从源码读出的 `\\s` 直接塞进 `RegExp`,导致正则测试全判「不匹配」。

下文数字是**纠正后**用退出码与逐字比对重测的结果。

## 1 · fresh 运行

| 项 | 结果 |
|---|---|
| `./gradlew compileJava compileTestJava` | **通过**(退出码 0) |
| B1 触及的门(database-boundaries · code-layout · backend-boundaries · logging-boundaries · retirement · flyway-layout · flyway-test-locations · query-boundaries · project-memory) | **全绿** |
| `provider-free-context` · `foundation-standard-actions` | **红**,见 N-2(既有,非 B1 引入) |

## 2 · 逐项核验(全部亲验)

| CP | 核验结论 | 依据 |
|---|---|---|
| CP-01 `AdvisoryLock` | ✅ 用 `pg_advisory_xact_lock`,事务级 | `AdvisoryLock.java` 第 12、19 行 |
| CP-03 六处魔数 | ✅ 推导逻辑已收进 `AdvisoryLock`,与迁移前逐字节等价;`AdvisoryLockTest` 有一致性测试 | 见 N-1 |
| CP-04 `replay()` 加锁 | ✅ **锁在读之前**(第 6291 行 acquire,6292 行 query),`FOR UPDATE` 已移除 | `CatalogOwnerService` |
| CP-05 `saveReceipt` | ✅ `ON CONFLICT DO NOTHING` 已移除,现为裸 INSERT | 第 6305–6318 行 |
| CP-11 编码校验 | ✅ `validateCatalogCode` 现**只拒 null/blank**,无格式、无大小写、无长度;测试同步改为接受 `latte-formal-001`、`拿铁 / 热`、`A` | 第 4493–4496 行 |
| CP-12 `dictionary_kind` CHECK | ✅ 取值恰为后台 5 元集,**不含 `PRODUCTION_TAG`**(未误用前端 union) | `V20260817_010000_000__catalog_dictionary_kind_closed_set.sql` |
| CP-15 gradle | ✅ 共享 resolver 存在,4 个调用方,**直接拼 gradle 命令处为 0** | `scripts/lib/gradle-runtime.mjs` |
| CP-18 `@Transactional` | ✅ `transitionCatalogItemStatuses` 已加 | 第 422–423 行 |
| CP-19 schema 正则 | ✅ 见下 | |
| CP-19 分母收窄 | ✅ `!file.includes("/src/test/")`,只对生产源码断言 | `cli.mjs` 第 593 行 |
| CP-20 排序退役 | ✅ UI 侧 0 命中;**数据库 `display_order` 仍在 5 个迁移、Reorder 契约仍在 3 处** | 符合决策非目标 |
| D-3 | ✅ 未改 `promotionExecute`,未新增关系门 | |
| CP-INV | ✅ 保持未实施 | |

### CP-19 正则:我实测了四种写法,不是读代码推断

把第 589 行的模式取出、还原转义后逐个测:

| 输入 | 结果 |
|---|---|
| `CREATE SCHEMA catalog;` | 匹配 ✅(七个既有裸写法**未被放过**) |
| `CREATE SCHEMA IF NOT EXISTS catalog;` | 匹配 ✅ |
| `CREATE  SCHEMA   IF  NOT  EXISTS  catalog;` | 匹配 ✅ |
| `CREATE SCHEMA IF NOT EXISTS catalogx;` | **不匹配** ✅(词边界有效,无误命中) |
| `CREATE SCHEMA IFNOTEXISTS catalog;` | **不匹配** ✅ |

正则写法正确,`IF NOT EXISTS` 是可选分组而非必需。

### 三条链的自洽性

`saveReceipt` 去掉 `ON CONFLICT` 之后,是否会在生产路径上抛,取决于三件事同时成立。
逐条验过:锁是**事务级**(`pg_advisory_xact_lock`)· 锁在 `replay()` **读之前** ·
入口方法有 `@Transactional`。同一事务内「先锁 → 读 → 有则返回 → 无则执行 → 写回执」,
并发重放者阻塞到对方提交后读到回执并返回,不会走到 `saveReceipt`。**这条链成立。**

三个 owner service(catalog · inventory · production-tag)**全部**满足:
`replay` 内有 `AdvisoryLock`、无 `FOR UPDATE` 残留、`saveReceipt` 无 `ON CONFLICT` 残留。

---

## 3 · 方案合理性(不是闭环核验)

**问题对不对**:对。`SELECT ... FOR UPDATE` 对不存在的行不加任何锁,
这是机制层面的真缺陷,不是风格问题。用它防首次创建的重放,保护是空的。

**方案优不优**:B1 用的是「advisory lock 放进 `replay()`」。
另一个可用方案是「insert-as-claim」(唯一约束 + 用 `ON CONFLICT` 的返回值判执行权)。
两者都正确,选哪个取决于**串行点的位置**:要保护的是「读—判断—写」整段且行还不存在 ⇒ 用锁;
执行权与「谁先写进去」天然一致且已有唯一约束 ⇒ 用 claim。
B1 的场景是前者,**选型正确**。

**代价配不配**:配。`modules/foundation` 加 JDBC 依赖是这条修复的前置位置问题,
不加则锁助手无处安放、只能六处各写一遍。加了之后,推导逻辑单点化并可被一致性测试覆盖。

## 4 · UI 与交互

`NOT_APPLICABLE` —— B1 的 UI 面只有 CP-20 的「退役排序入口」,
它是**减少**用户可见操作,且直接来自 2026-08-17 决策的明文交互约束
(「元数据没有用户排序语义」)。无新增用户任务、无新增页面操作、无交互歧义。

---

## 5 · findings

### S-1(已撤回)· 原判「三个回执服务无并发保护」不成立

⛔ **本条全条撤回。原判是错的,九个实现全部有并发保护。**

**我实际核到的**:`ContractCommandReceiptService` 第 31 行、`WorkspaceCommandReceiptService`
第 35 行、`PlatformCommandReceiptService` 第 32 行,**三者都在 SELECT 之前取
`pg_advisory_xact_lock`**。保护完整。

**我为什么会判错**:我 grep 的是 `AdvisoryLock` 这个**辅助类名**,而这三个服务用的是
**内联 SQL 直接调 `pg_advisory_xact_lock`**,不经过那个 helper。命中 0,我就写下了
「既无锁也无 `ON CONFLICT`」。

**这一次犯的是两条我当天刚登记的坑**:

- `pitfalls.claim-versus-behavior` —— 拿**标识符是否出现**判行为,而不是打开读写路径
- `pitfalls.negative-universal-claim` —— 用**一种写法**的检索,下「既无 A 也无 B」的否定式全称命题

⚠️ 更讽刺的是,`practices.insert-as-claim-ownership` 里我自己写着「两种机制并存」,
却只按其中一种的**实现形态**去搜。**机制可以有多种写法,搜写法就会漏。**

**残留的、真实的观察(降级为 N-4)**:见下。

### N-4 · 锁的取法在仓内有两种写法,共 6 处内联

`AdvisoryLock` 辅助类由本轮 CP-01 建立,三个 owner service 已改为调用它;
但三个 `*CommandReceiptService` 仍是内联 `pg_advisory_xact_lock` SQL。
**行为都正确**,只是同一件事两种写法,且推导逻辑各写一遍。

不构成缺陷,登记即可。若将来要统一,注意需求正本已裁定「回执统一推迟」,
本条不构成推翻那条裁定的理由。

---

#### 原 S-1 正文(保留供追溯,结论已作废)

**仓内事实(亲验)**:全仓有九处幂等回执实现,分两族。

| 族 | 实现 | 保护形态 |
|---|---|---|
| 私有方法(B1 范围) | `CatalogOwnerService` · `InventoryOwnerService` · `ProductionTagOwnerService` | ✅ advisory lock |
| 专用 service 类 | `OrganizationHierarchyCommandReceiptService` · `CommercialGroupCommandReceiptService` · `WorkspaceIamCommandReceiptService` | ✅ advisory lock |
| 同上 | `BusinessEntityCommandReceiptService` · `ExtensionCommandReceiptService` | ✅ insert-as-claim(`int claimed = ...; if (claimed == 1)`,**返回值被使用**) |
| 同上 | **`ContractCommandReceiptService` · `WorkspaceCommandReceiptService` · `PlatformCommandReceiptService`** | ❌ **裸 SELECT → INSERT,既无锁也无 `ON CONFLICT`** |

**失败形态(推论,已尽量收窄)**:三张表都有 PRIMARY KEY。并发重放时第二个事务在
INSERT 处阻塞,对方提交后拿到主键冲突,自身业务写随之回滚。
⇒ **不产生重复业务副作用**,但**并发重放拿不到幂等响应,而是拿到一个错误**。
客户端重试因此得不到幂等语义,这正是回执机制存在的理由。

⚠️ `UNVERIFIED`:我没有逐条读这三个服务的调用方事务边界。
若某条路径的业务副作用**不在**同一事务内(例如对象存储写),则可能产生重复副作用。
这一条需要单独核,我不下结论。

**根因定位(不是实施失败)**:需求正本第 121 行给的分母是
「receipt replay / save **私有方法** | 3 模块 | 6 方法」,第 353 行明写「回执统一推迟」。
**Codex 实施的正是这个批准分母,忠实无误。**
缺口在于:§2 的形态枚举只识别了「私有方法」这一种写法,
**没有枚举「专用 receipt service 类」这一族** —— 那是我写需求时的分母错误。

**为什么不是更小的修法**:不建议现在统一回执实现(需求已裁定推迟,且租户键形态未定)。
最小动作是**只补那三个的并发保护**,两种既有机制任选其一(照抄同族里已有的写法即可),
不动其余六个,不建新抽象。

**适用条件与可能反例**:若这三个服务的命令路径在产品上不可能被并发重放
(例如只由单线程 seed 调用),则无需修。我没有核实其调用面,请 Codex 先答这一点。

### N-1 · CP-03 的 namespace 字面量仍在两侧调用点

详设 AFTER 写的是「三个 namespace **常量**与推导逻辑收进 AdvisoryLock」。
现状:推导逻辑已收进 ✅,但三个 tag 仍以字面量出现在调用点
(`AdvisoryLock.acquire(jdbc, 0x43534B55, ref)`),catalog 与 inventory 各出现一次。

**承重的不变量已满足**(推导单点化、逐字节等价、有一致性测试),
剩下的只是字面量重复 2 份。**不构成缺陷**,登记为待办即可。

### N-2 · 交付时仓内有两道红门,与 B1 无关

`provider-free-context` 与 `foundation-standard-actions` 均红,同一根因:
`tools/capability-invariants/cli.mjs` 用了相对 import,而 `provider-free-context` 的
依赖白名单只允许 `node:` 内置与 `typescript`。

**这是既有问题**(我在 B1 交付前的同一会话内已测到相同失败),不在 B1 范围。
但它意味着「B1 交付」这句话不等于「仓内门全绿」。
⚠️ 这是**门与门冲突**:一道门禁止的写法,正是另一道门实现里在用的。

### N-3 · 同一件事在仓内有两种正确实现,未登记为有意差异

advisory lock 与 insert-as-claim 都正确,但九个回执实现里两种并存且无任何说明。
下一个人加第十个回执时,没有依据判断该照哪一种。
建议在 `project-memory/practices/insert-as-claim-ownership.md` 已有的选型判据基础上,
补一句「本仓两种都在用,按串行点位置选」——**一行指针,不需要统一实现**。

---

## 6 · 明确不背书

- **不背书** DEV、reset、seed、L2、UAT、浏览器或任何动态验收。本轮只跑了编译与静态门。
- **不背书** CP-INV 各未定项、D-3 修复、P-7。
- ⚠️ **本条已随 S-1 撤回而更正**。原写「九分之三仍未闭」是基于已被证伪的 S-1,**作废**。
  实际:**九个回执实现全部有并发保护**(六个 advisory lock、两个 insert-as-claim、
  三个内联 `pg_advisory_xact_lock`)。
  可以说「批准分母内的 3 模块 6 方法已闭」,也可以说「现存九个实现均有保护」;
  但仍**不背书**「这一缺陷类已永久关闭」—— 新增第十个实现时无机制强制它带保护(见 N-4)。

## 7 · 授权边界

本 `GO` 只覆盖:已批准的 CP-01～CP-20 的实施正确性,以及 CP-INV-3 的静态盘点。

**不授权**:下一个 Roadmap step · D-3 代码修改 · 新增关系门 · CP-INV 其余项 ·
DEV / reset / seed / L2 / UAT · 任何范围扩展。

⚠️ **原此处关于 S-1 处置的段落已作废** —— S-1 已被证伪撤回,三个服务保护完整,
**无需任何修复,也不需要回答并发可达性问题**。⛔ 不得修改那三个服务。

---

# 追加 · CP-INV-7 与 N-3 批次评审(2026-08-17 第二批)

按「评审按批次合并,不按轮次新增文件」,本批结论追加于此,不另开文件。

## 结论

**`GO` · M=0 · S=0 · N=3**

## 逐项判定

| 项 | 判定 |
|---|---|
| CP-INV-7 盘点与负变异证明 | **CONFIRMED** |
| S-1 撤回 | **REJECTED_WITH_EVIDENCE**(即:原 S-1 被证伪,撤回成立) |
| N-3 记忆一行 | **CONFIRMED** |
| 范围边界 | **CONFIRMED** |

## 亲验记录

**范围(机械确认)**:按文件修改时间,本批只触及两个文件 ——
`doc/review/platform/INVENTORY-JSONFIELD-claude.md`(17:50)与
`project-memory/practices/insert-as-claim-ownership.md`(17:52)。
**零代码改动**;生成器、契约、`runtime-environment-keys`、三个回执服务、
`ManagedInvitationBootstrap` 全部未动。符合授权边界。

⚠️ 方法说明:我最初用 `git status` 核范围是**错的** —— 它显示的是对 HEAD 的全部差异,
含 B1 前面所有批次,分不出本批。改用修改时间做机械代理后才得到上述结论。

**S-1 撤回**:我本人再次打开三个文件确认 ——
`ContractCommandReceiptService` 第 31 行、`WorkspaceCommandReceiptService` 第 35 行、
`PlatformCommandReceiptService` 第 32 行,**均在 SELECT 之前内联调用 `pg_advisory_xact_lock`**。
原 S-1 判「裸 SELECT → INSERT」不成立,撤回成立。⛔ 三个服务不得修改。

**N-3**:`insert-as-claim-ownership.md` 第 19 行只新增了约定的那一句,无其他改动。

**负变异证明**:盘点文件含 10 个样本的抽样规则、scratchpad 路径、
以及 20 次 `typecheck` 的 `RESULT sample=NN app=XX exit=0` 真实输出行。
证据边界表述正确 —— 它只证明**当前编译期生成类型链的保护缺失**,
未被扩大解释为 HTTP / DEV / seed / L2 / UAT。

## N-1 · 我原来给的 304 是错的,根因已定位

**这是本批最重要的一条,而且是我的错。**

详设原写「生成 TS 只声明 294 个字段名 ⇒ 304 个跨界字段名零编译器保护」。
我数了四个生成物文件的字段声明:

| 文件 | 字段声明数 |
|---|---|
| `operations-admin/.../generated/operations-edge.ts` | **294** |
| `platform-admin/.../generated/platform-edge.ts` | 258 |
| `operations-admin/.../generated/public-edge.ts` | 63 |
| `operations-admin/.../generated/catalog-inventory-edge.ts` | 43 |

**294 正好是其中一个文件的数** —— 我把**单文件**当成了整个生成面。

⇒ 实施方的四文件联合口径正确,**未覆盖是 26 而不是 304,小一个数量级**。
旧的 `381 / 77 / 304` 全部作废,以本次 `409 / 383 / 26` 为准。

⚠️ **这条改变了 CP-INV-7 的价值判断**:原本被描述为「全部裸 string 里最大的一类」,
实际剩余风险面是 26 个字段名 —— 是一份小而可处理的清单,不是一个需要扩生成器的大工程。

## N-2 · 本次分母只测了「后端↔前端」这一对跨界

盘点自己在文中写明:`ManagedInvitationBootstrap` 的五个 `Map.of` 字段被扩展扫描抓到,
但**它的消费者是脚本,不在前端 generated edge 交集内**,因此不进那 26。

**这个判断是对的**,但它暴露:本次三方取交测的是**后端 × 前端 × 生成 TS**,
而「后端 → 脚本」是**另一对跨界,本次完全未测**。

⚠️ 不建议现在扩范围。登记为已知未覆盖即可 —— 但**不得**表述为「跨界字段名已全部盘清」。

## N-3 · 测试目录的 JSON shape 计入了分母

盘点说明理由是「原始 ObjectNode 盘点也覆盖测试目录」。口径**一致**,不构成缺陷。
但按「谁必须达成一致」判据,测试内部的字段名写错只导致测试红,不跨产物边界。
若将来要收窄分母,这是第一个该切掉的部分。

## 不背书

- 不背书任何动态验收:本批只有静态盘点与 typecheck。
- 不背书「跨界字段名已盘清」—— 见 N-2。
- 不授权据此扩生成器或改契约(详设 FORBID 明写,本批亦未做)。
