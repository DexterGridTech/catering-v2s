# 20 倍业务量的健壮底座 · 需求分析

> **状态**:`DRAFT` —— 待对抗式 review 定稿。定稿后才写详设与实施计划。
> **本文只回答三件事**:目标是什么 · 现状问题有哪些 · 优化方案是什么。
> **不写详设,不写实施步骤** —— 那是第二份文档。

| | |
|---|---|
| **提出人** | Dexter,2026-08-16 |
| **原话** | 「我一直一直很反对重复造轮子,有的造的一样有的造的还有缺陷」「规范不要变成纸糊的,项目里应该有个统一的地方或者脚本一键能执行检测,并且开发完新功能也要强制检测」 |
| **交付上限** | 最多三个批次完成全部目标 |
| **阶段前提** | **无业务数据**;每次 **reset + seed**。迁移不可逆、数据回填、向后兼容读**均不构成本轮约束** |
| **证据来源** | 七路独立评估 + 我逐条亲验;所有数字均实测,非估算 |

---

## 0 · 一句话定义

> **底座 = 让"再加 20 倍业务功能"的单位成本不随功能数增长。**

不是性能底座 —— **访问量的横向扩展已经就位**(见 §1.4),这次要解的是**功能量**。

---

## 1 · 目标

### 1.1 两个目标,不是三个

Dexter 在 2026-08-16 亲自收敛过:「实际上就只是两个」。

| | 目标 | 可证伪的达成判据 |
|---|---|---|
| **G1 · 公共能力** | 横切关注点**统一提供**,不由各 owner / 各 feature 自实现 | **⚠️ 原判据「不需要再写一遍」不可判定**(是对假想作者的反事实陈述),已改为禁止句:<br>① 下一个新增 owner 模块内 `INSERT INTO .*command_receipt` 与 `pg_advisory` **必须为 0**<br>② 下一个新增 feature 内**不得出现**与既有 feature **md5 相同**的文件<br>**失败判据**:B2 落地后新增一条命令仍需手改 ≥10 处(§2.1 P-7 实测 M=12),则 G1 选错了抽象层 |
| **G2 · 强制自动检测** | 一键跑、开发完必跑、**真能拦住** | 对每条声称有门的规则,**人为制造一次违反必须变红**;红夹具未验过的门不算数 |

### 1.2 ⛔ G2 不是并列的第二件事,是前面每一维的**收尾条件**

Dexter 2026-08-16:「分了这么多维度的统一化的规范,最终如果不落到强制检测的话,
后面随着迭代,肯定还会长歪。」

**⚠️ 原证据已撤回(对抗审查)**:原文写「门一道没建,22 天里超长行从 5207 涨到 8008」。
**两处都不成立**:

1. **门建了** —— `build.gradle.kts` 有 `backendJavaUtf8LineLimit`(UTF-8 字节 >120)
   且 `spotlessCheck dependsOn` 它。与本文 §2.2 E-1「**门存在但没接线**」自相矛盾。
2. **5207/8008 复现不出来** —— 独立复算:按该门自己的阈值与排除项,**门管的范围内 >120 字节 = 0**;
   放宽到 backend java 全量是 164(全在生成物里)。原数字没声明文件类型、阈值、字符还是字节、排除项,
   **它自己就是一条不可证伪的存在性断言**。

**真实因果**:拦的东西在 gradle 里,而 **verify 跑不到 gradle**(无 wrapper、本机未装)。
⇒ 导出的行动是**给 verify 接上 gradle**,不是"再建一批门"。**方向差一格。**

所以本文的**结构性约束**:

> **§2 里的每一条问题,都必须在 §3 里带一条「它的检测形态」。**
> 三选一,不得留空:
>
> | 形态 | 含义 |
> |---|---|
> | **可门化** | 写出门的判据(必须是禁止句)· 说明**人为制造一次违反会怎样变红** · **并声明一条它预期抓不到的变异(负控制)** |
> | **编译器已覆盖** | 不需要门 —— 举出覆盖它的那个类型/约束(如 `satisfies Record<>` 的穷尽性) |
> | **只能 review** | 说明**为什么**判据需要理解上下文;做成关键词匹配会变成"门全绿而功能是坏的" |
>
> **写不出这三者之一的条目,不算完成分析。**

**⚠️ 原「分维度可门化预判」表已删除 —— 它被 §3.1 的实际结果全面推翻。**

预判说「S 组高、X 组零消费者可门化、P 组尺寸与重复度门可机械化」,而对抗审查逐条证明:
S 组的字面量门**与本文 §2.7 S-3 直接矛盾**(1722 条中文文案会被误伤)· 
X 组的 export 门**被 24 条 barrel re-export 击穿** · P 组的重复度门**每写一个新 CRUD feature 就红一次**。

**教训**:可门化程度**不能在看到问题之前预判** —— 预判会变成后面填格子的压力。
实际结果见 §3.1:**22 条提议里 10 条被砍,5 条改判为「编译器已覆盖」**。


⚠️ **反面教训(本轮已发生)**:门存在 ≠ 门有效。实测 8 条声称有门的规则里,
1 条是**假门**(我写的正则漏了个 `}`,对真实违规恒 false)、1 条**没接线**、1 条**守的是另一个命题**。
**所以「可门化」这一档必须附带红夹具验证,未验过会红的门不算数。**

⛔ **再加一条:红夹具证明的是"接线",不是"守对了命题"。**
对抗审查构造了四条绕过,证明本文 §3.1 里有关键词门:
`_error` 改名 `error` 继续不读 → O-4 那道门绿 ·
25 个 handler 各加一行 `log.debug("")` → O-3 那道门绿 ·
共享常量改成另一个值、两边一致但与历史数据不一致 → P-3 那道门绿。

**所以每道门必须同时声明「它预期抓不到什么」** —— 不写负控制,「红夹具验过」
就退化成 §2.2 E-2 痛斥的那种存在性断言。

### 1.3 两个目标有先后,不是并列

**G2 里有一半必须等 G1。**

典型:`CatalogOwnerService` 7435 行,加一条 `max-lines` 立刻红 —— **但红了之后代码往哪搬?**
回执与锁的位置还没建好,门只会逼人把代码挪进另一个同样不该放的地方。

所以 G2 拆两半:

- **G2-a 现在就能接**(不依赖 G1):`spotlessCheck` 接线、修假门正则、补单点定义门、acceptance 接进 verify
- **G2-b 必须等 G1**:尺寸门、重复度门

### 1.4 明确不在本次范围

| | 为什么 |
|---|---|
| **访问量横向扩展** | **代码面已就位,部署面缺一项**。实测:static 非 final 集合 0、缓存框架 0、后台任务 0、会话在 DB、25 处 advisory lock + 19 处 `FOR UPDATE` 全是 DB 级锁、资产走 MinIO。加节点不需改代码、不需粘性会话、不需预热。两个天花板:① Hikari 默认池 10(约 10 节点打满 Postgres)—— 但**真实上限是「池大小 ÷ 连接持有时长」,而持有时长是代码形状**,只调池大小是把排队从 Hikari 挪到 Postgres;② **无 `/actuator/health`**(actuator/micrometer/OTel/prometheus 全仓命中 0)⇒ **负载均衡无法判断节点是否可用**。⚠️ **第二项已从 HANDOFF 收回本轮**(见 §3.2 B1)—— 它是一行依赖 + 一行配置,与 `spotlessCheck` 接线同量级,**不属于 CI/备份/轮换那一档** |
| **浏览器 L2 重建** | **Dexter 已裁定暂缓**:旧 L2 建在错误的前后端逻辑上,「基于错误逻辑的 L2 比没有 L2 更坏」——它会把错的行为固化成"通过"。等产品体验确认后重新规划 |
| **生产化运维基建** | CI 平台、备份演练、密钥轮换、**OTel/Prometheus/告警** —— 进 `HANDOFF.md`。<br>⚠️ **健康端点不在此列**,已收回本轮 |

---

## 2 · 现状问题(全量,不删减)

**分七组**(P/E/D/O/T/X/S)。每条含:**事实**(实测锚点)· **20 倍时的代价** · **归属目标**。

### 2.1 P 组 · 公共能力缺位(归 G1)

#### P-1 · `modules/foundation` 没有 JDBC 依赖 —— 这是后台一切重复的根

**事实**:`modules/foundation` 的 `build.gradle.kts` 无任何 JDBC 依赖,只有 `TimeProvider`、`Sha256Hex`、`DatabaseOperationTracker`、`ServiceNodeTypes`。
回执服务与锁助手**因此无处安放**。

**⚠️ 2026-08-16 对抗审查更正 —— 归因写反了。**

原文写「没有共享的家 ⇒ 所有人只能复制」。**实测不是这样**:

仓内**已有既定形态** —— 每个 owner 一个专用 `*CommandReceiptService` 类,**共 8 个**。
而 **catalog / inventory / fulfillment-production 三家把回执内联进了 owner 服务,绕过了这个形态**。

**所以病灶不是"无处安放",是"有形态而三家没跟"。** 这个差别决定修法:
**把 8 个类合成 1 个,拦不住第 4 个 owner 再内联写一遍** —— 那正是已经发生的事。
⇒ **门比合并更重要**:新 owner 模块内 `INSERT INTO .*command_receipt` 必须为 0。

**分歧比原文记的多一档**(我亲验 8 个类):
6 个用 advisory lock · `BusinessEntityCommandReceiptService` 用 `ON CONFLICT` **不用锁** ·
**`ExtensionCommandReceiptService` 两样都没有**。

**直接后果(实测)**:

| | 实测 |
|---|---|
| `*CommandReceiptService` | **8 个类 · 918 行 · 约 95% 逐字相同** |
| 回执表的 scope-key 约定 | **11 张表 6 种**:`(data_node_ref,key)` / `(workspace_uuid,key)` / `(group_workspace_key,key)` / `(scope_key,key)` / 光 `key` |
| advisory lock 写法 | **5 种**:`hashtext(?)` / `hashtext(?\|\|':'\|\|?)` / `hashtext(CAST(? AS text))` / 裸 `(?,?)` / **完全没有** |

**20 倍代价**:第 10 个 owner 时是 10 份各自略有不同的幂等实现。

#### P-2 · 回执并发语义三家分歧 —— **这已经是真 bug,不是隐患**

**事实**(我亲验):

```
CatalogOwnerService        ON CONFLICT 3 · DO NOTHING 3
InventoryOwnerService      ON CONFLICT 4 · DO NOTHING 2
ProductionTagOwnerService  ON CONFLICT 1 · DO NOTHING 1
```

catalog 的回执写入带 `ON CONFLICT ... DO NOTHING`,inventory 与 production **没有**。
三者用**同样的表形状、同样的 `replay()` + `FOR UPDATE`**。

**业务后果**:两个请求同时首次使用同一幂等键 → catalog 正确重放;
inventory 与 production 抛 `DuplicateKeyException`,而 `ContractProblemAdvice` 没有
`DataIntegrityViolation` 处理器 → **用户拿到 500**。

**没有任何机制能发现这个分歧。** 它是 P-1 的必然产物。

#### P-3 · 跨 owner 锁常量靠 Javadoc 维持

**事实**:三个锁命名空间 `0x43534B55` / `0x4349544D` / `0x43534156` 在
`CatalogOwnerService` 与 `InventoryOwnerService` **手工复制**。源码注释写着:

> `/** Must stay byte-for-byte compatible with InventoryOwnerService's item lifecycle lock. */`

**`grep tools scripts` 命中 0** —— 唯一的强制力就是这句注释。
注释自己还写明了原因:`foundation` 故意没有 JDBC 依赖,所以助手不能共享。**P-1 的直接自白。**

#### P-4 · 前端骨架未进 foundation

**⚠️ 原文的 71.2% 与「门在生产重复」两处都已撤回(对抗审查,两路独立证明)。**

**撤回一 · 百分比不可复现**:分母 718 在任何自然口径下都不存在
(raw 1085 / 非空非注释 1056 / 实质 543)。重复率随过滤器在 **6.5%–46.9%** 之间摆动,
而「CRUD 55–71% vs 新业务 13–23% 的**分裂**」在两种口径下**都是连续梯度不是分裂**。
原文还漏了 18 个 feature 里的 10 个。**删掉百分比,保留可核的事实。**

**撤回二 · 因果讲反了**:原文说 `assertNoPrivateFeatureUiImports`「机械地生产重复代码」。
**不成立** —— `StoreCreateDrawer.tsx:23` **本身就在跨 feature import** `../../organization-structure/model/...`;
那道门**只挡 `ui/`**,`model/` 一直通,而 CLAUDE.md 指定的正解位置 `admin-ui-foundation` **完全没被挡**。
**7 份拷贝的成因是没往 foundation 放,不是门逼的。** 把责任推给门会导出「该改门」的错误处置。

**可核的事实(保留)**:

- 扩展字段渲染 **7 份局部拷贝**,其中 **2 组两两 md5 相同**(Contract Create=Edit;BusinessEntity Create=Edit)
  ⚠️ 原文说「3 份 md5 相同」且归属写错(漏了 business-entity 整组)
- foundation 覆盖**机制**不覆盖**形状**:有生命周期、幂等键、overlay lock、`adminListState`(24 行)、`useDetailDrawer`;
  **没有** ProTable 页面骨架、Drawer 表单骨架、扩展字段渲染器
- 正确实现**已经写出来了** —— `OrganizationExtensionFields.tsx`,只是位置在 feature 私有目录下

#### P-5 · 尺寸失控,零刹车

| | 实测 | 刹车 |
|---|---|---|
| `CatalogOwnerService` | **7435 行 · 258 方法 · 29 个 `@Transactional`** | `tools/code-layout/cli.mjs` 全文 324 行,**无任何尺寸/方法数/复杂度判据**;8 条 ArchUnit 全是依赖方向规则 |
| `CatalogItemDrawer.tsx` | **5174 行**,本体 1686 行 + 同文件约 25 个顶层组件 | `eslint.config.mjs` 全文 55 行,**无 `max-lines`/`complexity`/`max-depth`** |

**唯一的刹车是评审注意力,而评审注意力不随业务量扩展。**

⚠️ **依赖关系**:尺寸门必须等 P-1/P-4 完成 —— 门红了之后代码得有地方搬。

#### P-6 · 跨 owner 协作是位置化 hub,arity 随 owner 数线性增长

**事实**:`CatalogInventoryCoordinator` 1713 行 / 100 方法,持有 7 个 owner 依赖。
合并机制是**每 owner 一组具名字段**,不是列表:

- `record OwnerPreflight(String inventoryDigest, String productionDigest, JsonNode inventoryJudgement, JsonNode productionJudgement)`
- `combinedDigest(String catalogDigest, String inventoryDigest, String productionDigest)`
- `record CopyReferencePlan(closureItemRefs, productionTagRefs, referenceMappings)` —— **catalog 模块的记录里带着 fulfillment-production 的概念名**

**20 倍代价**:owner #4 进入复制流程 = 改 5 个签名。
另一个 owner 家族(organization/workspace/IAM)**根本没有 coordinator**,跨 owner 工作直接写在 2885 行的服务里。

#### P-7 · 契约链每条命令有一个手写环节

**事实**:新增一个业务命令要动 **N=3 新建 / M=12 手改 / K≈20 重生成**。M 里有四处不是代码:

- `doc/plans/platform/2026-08-06-...-design-codex.md` 的**一行 markdown 表格** ——
  `catalog-inventory-p1.mjs` 正则解析这份文档当权威操作清单,数量漂移即 `P1_OPERATION_ROW_PARSE_MISMATCH`
- `backend-performance-m1-command-execution-bindings.mjs` —— 要**手写一个新的 emitter 函数**并注册。
  当前已有 **69 个手写 emitter**,197 个操作

**20 倍代价**:约 1400 个 emitter 函数塞在一个 380 行文件里。**加一条命令不是声明式的,是手写一段代码生成器。**

#### P-8 · 生成器里的冻结计数

**事实**:`edge-codegen.mjs:243` 的 `operationsNodes.length !== 20` 等 —— 加第 21 页 → 生成器拒绝运行 →
前后端全链路生成物无法再生。同族另有 `!== 8` / `!== 5`(×2) / `!== 4` / `!== 10` / `!== 22`(×3) / `!== 43`。

**⚠️ 处置已定(Dexter 2026-08-16)**:**直接删,不替换**。
它防的"手滑改坏 catalog"场景已由编译器覆盖(`pageRegistry.tsx` 用**非 Partial** 的
`satisfies Record<OperationsPageDesignKey, Registration>`,少一页多一页都是编译错误,
且错误信息**比哨兵精确**)。
**这一条不属于 G1 也不属于 G2 —— 它是删几行,不是能力。**

### 2.2 E 组 · 强制检测缺位(归 G2)

#### E-1 · 规范目前主要是纸面的

**事实**(变异实验实测,不是看门存不存在):

| 状态 | 条数 | 实例 |
|---|---|---|
| 完全无门 | 3 | 跨模块同名包(造一个同名包 → `code-layout` **PASS**);单点定义(`features/` 下再写一个 `wireUuid` 或手机号正则 → **全绿**) |
| **假门** | 1 | React key 那条 —— **正则漏了第一个插值的收尾 `}`**,对真实违规 `false`、对非法 TS `true` |
| 门存在但没接线 | 1 | `spotlessCheck` —— `grep verify.mjs` **命中 0** |
| 门守的是另一个命题 | 1 | `edge-codegen --check` 守「产物 == 生成器输出」,**不守**「声明的类型约束必须传导」(改 generator 再重生成即 PASS) |
| 本环境跑不起来 | 1 | PMD(无 JVM/gradle) |
| 部分有效 | 1 | prettier —— 长字符串(165 字符)、长正则(137)、长注释(283)、长 import(128)**全部逃逸** |

**真正能机械拦住人的接近于零。** 而无门的那两条对应的是**已经真炸过**的两个缺陷
(门店库存页首屏白屏、五个用户管理页发不出邀请)。

#### E-2 · 存在性断言占绝对多数,防的是重构不是回归

**事实**:

| | 禁止性 | 存在性 |
|---|---|---|
| `verify-gates/cli.mjs`(真门) | 34 | 7 |
| `tests/architecture/*.mjs` | 42–49 | **169–175** |

**完全倒置。** 218 处 `assert.match` 对着 `readFileSync` 读来的源码文本做正则匹配 ——
**改个变量名它红,逻辑写错它绿**。

⚠️ **不能简单归零**:实测 `default-list-page-size.test.mjs` 是**配对使用**的
(`assert.match(/useState\(10\)/)` + `assert.doesNotMatch(/useState\(20\)/)`),
归零存在性那半只剩「不是 20」,`useState(50)` 就过了。**必须逐条处置。**

#### E-3 · 28 条真业务闭环默认关闭

**事实**:`backend-acceptance` 的 28 条场景(IAM 8 / ORG 5 / CONTRACT 3 / ASSET 2 / CATALOG 10)
是**真实业务闭环** —— 例如完整走 invitation → login → 建合同 → CAS 版本编辑 → 作废 → 历史回读,
真 HTTP + 真容器。**这是全仓质量最高的资产。**

但 `@EnabledIfEnvironmentVariable` 默认关闭,而 **`verify.mjs` 里 `backend-acceptance` 命中数 = 0**。
实证:最近一次后台 test 的 XML 里 7 个 suite / 26 个 test / **0 个 acceptance suite**。

#### E-4 · 不写测试没有代价

**事实**:新增一个 feature 写零个测试,`scripts/verify` **全绿**。
`affected-l2` 是**选择门不是执行门**(打印 `SELECTED=...` 就结束);
`test:unit` 显式带 `--exclude "**/*.spec.ts"`;全仓无任何脚本调用 Playwright。

前端 106 个单元用例**总耗时 357 毫秒** —— 全是纯函数;
`CatalogManagementPage.test.tsx` 有 36 个用例、**0 次渲染**。

#### E-5 · 规范正本的可达性依赖单侧 hook

**事实**:两份规范已注册进 `project-memory`,路由查询能命中(19 条 ref 里第 18、19 条)。
但读到要**三跳**(SessionStart hook → `index.md` → 指针 → 正本),
而**这个 hook 只有 Codex 侧有**;`AGENTS.md` / `PLATFORM-BLUEPRINT.md` / `HANDOFF.md` 对两份规范**零引用**。

#### E-6 · 我的指针文件曾与正本对着干(已修,登记为教训)

指针写「找不到正例的规则**不进规范**」,正本 §7 当天已放宽为「标 `未验证`,**仍进规范**」——
**同一条规则两处相反指令**,发生在为防止此事而建的文件里。已修正。

### 2.3 D 组 · 数据库与迁移层

**家底(对抗审查后重算)**:52 个迁移 · 10 个 schema · **活表 72 张**。

**原文写「92 张表」是错的,这一个错连塌了 D 组四条。**
92 是 `CREATE TABLE` 条数;同时有 **20 条 `DROP TABLE`**。被污染的四条已逐条更正。

#### D-1 · 租户列有 4 种家族,50 张表一个都没有

| 家族 | 表数 | owner |
|---|---|---|
| `workspace_uuid` + `group_workspace_key` | 26 | organization · contract · extension · workspace_iam · platform_workspace · platform_asset |
| `data_node_ref` + `brand_ref` | 9 | catalog · inventory · fulfillment_production |
| `group_workspace_key` 单列 | 3 | — |
| `scope_key` | 1 | `platform_asset.asset_command_receipt` |
| **无** | **30**(原文 50 —— 把 20 张已删表算了进来) | 只靠 FK/JOIN 继承 |

**而这 30 张里有 11 张是 `platform_iam.*` 平台全局表,本就不该有租户列。**
所以「50 个例外」这个修辞基本消解 —— 真实需要归位的约 19 张。

**后果不是"名字乱",是判据写不出来**:想写「新查询是否带租户谓词」这道门,
**有四个正确答案和五十个例外** —— 这正是现有的门只能查文件名和 `SELECT *` 的原因。

#### D-2 · 同一概念 5 种物理形态 —— 与 P-1 是同一件事在 DB 侧的投影

`command_receipt` **12 张表**:
`platform_iam` PK 单 `idempotency_key` · `workspace_iam`/`organization`/`extension`/`contract` PK `(workspace_uuid, key)` ·
`platform_workspace` PK `(group_workspace_key, key)` · `platform_asset` PK `(scope_key, key)` ·
`catalog`/`inventory`/`fulfillment_production` PK `receipt_ref UUID` + UNIQUE `(data_node_ref, key)` + 多一列 `operation_id` + 用 `TEXT` 不用 `VARCHAR`。
另有 `organization.commercial_group_idempotency` —— **同一概念的另一个名字**。

#### D-3 · 租户隔离 100% 靠 Java 纪律,DB 无兜底、无门

**RLS 引入后一天即撤除**:`V20260725_170000_000` 建了 4 条策略,`V20260726_090000_000` 全部删除。
而且**撤除被焊死** —— `cli.mjs:570` 在撤除文本消失时报 `R5_DATABASE_RLS_RETIREMENT_MISSING`。

两个真实查询的对照:
- **靠 JOIN 兜住**:`CatalogOwnerService` 查 `catalog_sku` 必须 JOIN `catalog_item` 才有 scope ⇒ **约 26 处 SKU 查询各自要记得 JOIN**
- **完全没有谓词**:`CatalogItemCategoryFacts` 的 SELECT/DELETE/INSERT 只按 `item_ref`,隔离全靠调用方已预先 scope

**而 DB 拦不住**:catalog P3 表用**单列 FK**,结构上不阻止把 A 租户的 item 连到 B 租户的 category。
**这个模式本来是有的** —— `V20260726_090000_000` 给 organization 系列加了 scope 复合 FK,**但没带进最新的 owner**。

⚠️ **门自己也漏**:`cli.mjs:569` 硬编码的 7 个 schema **不含 catalog / inventory / fulfillment_production** ——
三个最新 owner 在门的视野之外。

#### D-4 · 无迁移模板,匿名约束的代价已付两次

- `IF NOT EXISTS` 48 处,集中在 **52 个文件里的 10 个**;其余 42 个用裸 DDL
- **命名 CHECK 81 vs 匿名 49;命名 UNIQUE 28 vs 匿名 24**
- 索引前缀 **3 种**:`ix_`(44)· `ux_`(12)· `uq_`(7),后两者都表示唯一

**代价已经付了**:三个迁移不得不 `DROP CONSTRAINT <Postgres 自动名>`,其中
`dictionary_entry_data_node_ref_brand_ref_dictionary_kind_co_key` **恰好 63 字符 —— 被 Postgres 标识符上限截断**。
为了钉住这个名字,专门写了一个 Testcontainers 类回放 ~50 个迁移再查 `pg_constraint`。

**没有可照抄的模板迁移** —— 最接近的三个候选各自用了已废弃的做法(bigserial / TIMESTAMPTZ / RLS、跨 7 schema 修正、`TEXT`+匿名约束)。

#### D-5 · 三处真实缺索引(原「8 张死审计表」整条撤回)

**原文第一条已证伪**:那 8 张 `*_audit` 表**早在 2026-07-27 就被删了**
(`CREATE` 8 次 / `DROP` 8 次,DROP 在 `V20260727_010000_000` 且带 `R5_LEGACY_AUDIT_NOT_EMPTY` 空表守卫)。
「引用为 0」是因为**表根本不存在**。

**Dexter 2026-08-16 裁定:历史垃圾不留,直接下线。** 我核过可行性:

**Dexter 补充裁定**:「完全不需要迁移数据,现在根本没有业务数据,有 seed 可以重建」「**每次我都 reset 再 seed**,不涉及迁移数据的问题」。

**这是本文一整类顾虑的前提更正**:reset+seed 是**常规工作流**,不是应急手段。
所以迁移不可逆、数据回填、向后兼容读,在本阶段**都不是约束**。

⇒ 处置比我原先写的更简单:

- 涉及**三个文件**:建表 · `V20260726_210000_000`(原本把数据迁进 canonical `audit_event`)· `V20260727_010000_000`(删表 + 空表守卫)
- **三个一起整体摘掉** —— 那个数据迁移步骤和那个空表守卫,**保护的都是不存在的数据**
- **只删其中一两个必炸**:守卫与 DROP 会对不存在的表执行
- **验收**:reset + 全量迁移回放 + seed 跑通 —— 本来就是常规动作,不额外增加成本

**真实的索引缺失(逐条验过,与死表无关)**:

- `organization.store.brand_id` / `.tenant_id` **未索引**,而**同一条谓词列表里**的 `.project_id` / `.head_company_id` 有索引 —— 4 个里 2 个
- `contract.store_contract.tenant_id` 未索引
- `workspace_iam.role_assignment.role_id` 未索引(「谁持有这个角色」是核心 IAM 读)

#### D-6 · 20 倍时最先垮的三堵墙

| | |
|---|---|
| **一 · 每个列表页都是一次全租户扫描** | `filtered` CTE 被引用两次 ⇒ PG12+ 默认物化 ⇒ **每翻一页都重建该租户全部非作废条目再丢弃**;叠加每页 `COUNT(*)` 与 `OFFSET`(19 个文件在用),游标就是 `offset + pageSize`。**读量先于写量到达,所以这堵墙最先撞** |
| **二 · 约 25 张只增不删的表,而加保留策略的手被门绑住** | 6 张 `audit_event` + 8 张死 audit + 12 张回执/幂等 + ledger/session/history/限流。**原文「37 张」含 8 张不存在的表;「main 里零 DELETE」已证伪 —— 实测 18 条 `DELETE FROM`,其中 4 张限流桶表正是被误划进只增不删的那类**。而 `cli.mjs:614` 禁 `application/`/`domain/` 里用 `@Scheduled`、`:620` 禁 quartz ⇒ **加保留要先改架构门** |
| **三 · 迁移回放成本(校验和脆性已降级)** | 21 个 `PostgreSQLContainer`、**零 `withReuse`**,每个回放全部 52 个迁移 ⇒ 一次完整 verify 约 2 万条 DDL。**校验和脆性已降级(Dexter 2026-08-16)**:「现在根本没有业务数据,都是开发测试中的数据,有 seed 可以重建」——
环境可丢弃**是当前的设计前提,不是侥幸**。所以「编辑已应用的迁移」在这个阶段是**被允许的**,
这也正是死表能被整体摘掉的原因。
**真正留下的只有回放成本**:21 个容器 × 52 个迁移、零 `withReuse`。
而且这个成本**每次 reset 都在付**,不是将来才疼。
⚠️ **该前提失效的那一天**(第一个不能 drop 的环境)要重新评估 —— 但那属于 `HANDOFF.md`,不在本轮。 |

#### D-7 · 一个已经烂掉的门(与 E 组同族)

`flyway-test-locations`(`cli.mjs:768-790`)硬编码 **11** 个期望测试文件,而按它自己的判据扫今天是 **20** 个。
**它不报警,因为它根本没接进 `scripts/verify`。**

#### D 组的最小起点

**先给所有租户表一个统一的租户键,再让 FK 带上它。**

不是因为名字难看,而是因为**它是其他所有修复的前提** —— 现在有 4 种家族、50 个例外、零 RLS、零门,
**"新查询是否带租户谓词"这道门根本写不出来**。

顺序:① 定一套词汇并改名 → ② 把 `V20260726_090000_000` 已建立的 scope 复合 FK 模式带进 catalog P3 表,
让跨租户连接**结构上不可能**而非靠 Java → ③ **然后**谓词门才写得出来。

**D-2 那 5 种回执形态与"没有模板迁移"会随之消解** —— 模板的头两列是什么,取决于租户键先定下来。

#### `UNVERIFIED`

迁移墙钟时间(未跑数据库)· CTE 物化(依据是 PG12+ 引用计数规则与仓内自己显式写的 `AS MATERIALIZED`,**非 `EXPLAIN`**)。

### 2.4 O 组 · 可观测性

**这一组的结论最尖锐:20 倍时,「用户报告 → 定位到代码行」这条链的两端同时是断的。**

#### O-1 · 后台业务层零日志(我亲验)

**事实**:后台 `src/main` + 全部 14 个 `modules/*` 里,`LoggerFactory.getLogger` **只有 4 处**:

```
Slf4jSecurityDiagnosticRecorder   ← 每请求那一行
ContractProblemAdvice             ← 约 25 个 handler 里只有 3 个写日志
PlatformAssetService              ← 一条 rollback WARN
ManagedInvitationBootstrap        ← dev CLI
```

catalog · inventory · organization · workspace-iam · store-contract · extension **逐个查都是 0**
(另加 platform-admin-iam / audit-model / audit-read / fulfillment-production / execution-context 等)。

**业务层不存在任何日志。**

#### O-2 · 唯一那条请求日志缺租户,而租户身份就在手边

每请求行有:correlationId · requestId · operationId · routeTemplate · owner · consumerFace ·
outcome · durationMillis · status · errorCode · databaseOperationCount · databaseDurationMillis。

**缺的**:
- **租户** —— 无 `workspaceUuid` / `groupWorkspaceKey` / `accountId`。这里的 `owner` 是**代码模块归属**(如 `catalog`),不是租户
- **实体** —— 无 itemRef / entityRef
- **节点身份** —— 多节点时日志行说不出自己来自哪个 JVM
- `outcome=FAILED` **也记在 INFO** —— 一个 500 打出来是 INFO 行

⚠️ **而数据就在收口点上**:`WorkspaceExecutionContext` 在同一个对象上暴露
`workspaceUuid()` / `groupWorkspaceKey()` / `accountId()` / `consumerFace()` / `correlationId()` / `requestId()`,
每个已认证命令铸一次、被 27 个 operation 类消费。**不需要打通任何管道,只需要把它写下来。**

#### O-3 · 约 22/25 个异常 handler 一行不写

`ContractProblemAdvice` 里只有 3 个 handler 写日志,且各缺一半:

| handler | 有 | 缺 |
|---|---|---|
| `catalogInventory` WARN | `.setCause()` → **完整栈** | **无 correlationId / requestId / operationId** |
| `assetInvariantViolation` ERROR | correlationId + requestId + operationId | **无 `.setCause()` → 没有栈** |

**两行拼不起来。** 其余全部接住异常对象后一行不写:`notFound` · `conflict`(全部幂等/版本冲突)·
`invalid`(全部校验失败)· `accessDenied` · `rateLimited`,以及后果最重的
**`ownerResultUnknown` —— 返回 HTTP 500,零日志输出**。

#### O-4 · 前端错误上报确认是空壳,且生产下完全不出网

```
AdminErrorBoundary 把 (error, errorInfo) 都传出去
  → recordOperationsRenderError(_error)   ← 形参下划线,声明即丢弃;errorInfo 连形参都没有
  → 发出的事件是编译期常量               ← 任何页面任何崩溃,载荷逐字节相同
  → FrontendLogEvent 里没有 message/stack/componentStack/componentName 任一字段
```

**出网条件全断**:`createBeaconLogSink` 在 endpoint 空时返回 `undefined`;
仓内**无任何 `.env*` 文件**,`scripts/` 与 `tools/` 全域 **0 处**设置 `VITE_FRONTEND_LOG_SINK_URL`;
`enabled: import.meta.env.DEV` ⇒ 生产为 false ⇒ console 也被短路;
`snapshot()` **0 处调用** ⇒ 100 格环形缓冲是只写的。

**另**:全域无 `window.onerror` / `unhandledrejection` —— 事件处理器、async 回调、
未捕获 Promise 里抛的错**根本不进 ErrorBoundary,连计数都没有**。

#### O-5 · 指标是测试仪表,不是生产遥测

`HttpRequestMetricsInterceptor` 的 Javadoc 自己写着 "Non-production ... for isolated Seed and
backend-acceptance runs"。生产下 `scopeActive` 为 false,`preHandle` 直接 return ⇒ **彻底空转**。
输出是**本地文件 JSONL**,各节点各写各的,无导出无汇聚。

`DatabaseOperationTracker` 生产不激活 ⇒ 每条请求日志里那两个 DB 字段**硬编码为 0** ——
**长得像数据,不是数据**。

**依赖面(我亲验)**:`actuator` / `micrometer` / `opentelemetry` / `prometheus` **命中数全为 0**。
⇒ **没有 `/actuator/health` 供负载均衡探活**,无 JVM/GC/堆指标,无连接池指标,无任何可告警的东西。

⚠️ **这一条与 §1.3 的"横向扩展已就位"有交互**:扩节点在**代码上**没问题,
但**没有健康端点意味着负载均衡无法判断某个节点是否可用**。这不是代码债,是部署面缺口。

#### O-6 · 用户手上没有可引用的凭据

`correlationId` 被解析出来后**从未渲染给用户** —— 前端只按 errorCode 返回固定 `{title, detail}`。

**所以「用户报告 → 定位」这条链两端同时断**:用户说不出是哪次请求,客户端也没发出任何内容。

#### 三个真实场景的可定位性

| 场景 | 结论 |
|---|---|
| 某租户商品保存 1% 偶发失败 | **部分可定位,唯独"哪个租户"不可**。catalog 的 `RESULT_UNKNOWN` 路径有栈(覆盖最好的一条),但那条 WARN 无 correlationId、请求行无栈,**两行只能靠线程名+时间猜**;若这 1% 是类型化失败(校验/冲突),**一行日志都没有** |
| 某页面特定数据下白屏 | **完全不可定位**。端到端零信号 |
| 表锁等待不知业务来源 | **不可定位**。JDBC URL 未设 `ApplicationName`、无 Hikari 配置 ⇒ `pg_stat_activity.application_name` 所有节点长一个样;SQL 里无携带 operationId 的注释 |

#### O 组的最小起点

**把租户与操作人写进已有的那条 per-request 行,并让失败以 ERROR 记录、带上 cause。**

**为什么是它而不是上 OTel/Prometheus**:那是平台工程,解决量与趋势;
**没有租户维度就加 tracing,只会得到更多匿名 span**。而这条的数据已经在 `WorkspaceExecutionContext` 里。

**验收判据(可证伪)**:取一个失败的已认证命令,**仅凭日志、不查库、不问报障人**,
说出 (a) 租户 (b) 操作人 (c) 操作 (d) 节点 (e) 抛出点栈帧。
**今天:类型化失败 0/5;catalog `RESULT_UNKNOWN` 路径 1/5。**

顺手带的两项近乎零成本:`outcome=FAILED` 从 INFO 改 ERROR;给请求上下文加节点/实例字段
(**没有它,多节点日志无论再加什么都无法归属**)。

#### `UNVERIFIED`

部署管线是否注入 `VITE_FRONTEND_LOG_SINK_URL`、stdout 是否被采集 —— **仓内无证据可支持或否定**。
若 collector 已就位,O-4 的严重度下降,但"载荷是无内容常量"不因此改善。

### 2.5 T 组 · 构建与验证循环

**CLAUDE.md 的约束**:「`scripts/verify` 必须保持分钟级,变慢时先砍最弱门而不是接受变慢」。

#### T-0 · 今天 `scripts/verify` 根本跑不完(两个 blocker)

1. **本机没装 gradle,且仓内无 `gradlew` wrapper** ⇒ 2 条 static gradle 门 + 15 条 remote 门**全部 spawn 失败**
2. **`THCL-04-node-tests` 是红的** —— `THCL_NODE_TEST_ENTRY_DENOMINATOR_MISMATCH`,0.50 秒内失败,一个测试都没跑

#### T-1 · 实测耗时(warm)

**13 static + 28 runtime(其中 15 条是 remote-gradle)。**

| | warm | 20 倍推算 |
|---|---|---|
| static 小计(11 条可测) | **79.4 秒** | **~45 分钟** |
| runtime 小计 | **~1190 秒** | **~6–13 小时** |
| **合计** | **~22 分钟**(cold ~42–47 分钟) | **~8–16 小时** |

**最贵的单项**:15 条 remote gradle 门 = **654 秒实测**(依据是 `.runtime/` 下 **506 次记录**的
`startedAt`/`completedAt`,不是估算)· `backend-boundaries` **38.8 秒** · `U01-codegen` **20.24 秒 / FILES=253**。

#### T-2 · ⚠️ 更尖锐的一条:`--validate-only` 快通道也超标

static 一条 lane 从 **2.4 分钟 → 45–50 分钟**。
**Dexter 每次改动真正会跑的那条路,是最先死的。**

#### T-3 · 增量能力基本为零

| | 实测 |
|---|---|
| gradle build cache | `gradle.properties` 设了 `org.gradle.caching=true`,但 `r5-remote-testcontainers.mjs:296` 用 **`--no-daemon --rerun-tasks`**。**506/506 次记录全是 `N actionable tasks: N executed`,零 `from cache`、零 `up-to-date`** |
| remote 工作区 | 每条门**打包上传整棵源码树**、在全新 `/tmp` 里跑、**跑完删掉**。15 条门 = **15 次完整上传 + 15 次冷编译** |
| tsc | **没有任何 tsconfig 设 `incremental` / `composite` / `tsBuildInfoFile`** ⇒ 每次全量,×2 个 App |
| verify 自身 | 41 条门**严格串行**,无并行、无 changed-path 收敛 |

#### T-4 · ⛔ 最重要的发现:CLAUDE.md 那条规则在这里不适用

**砍掉最弱的三道门只省 ~52 秒 / ~1334 秒 = 4%。**

因为**前两大成本不是门**:

| | 实测 |
|---|---|
| **仓在 SMB 网络挂载上**(`//dexter@…/idea`) | 单次读 **1.49ms vs 本地 0.04ms = 42.6 倍**;`walk("apps")` **冷 130,753ms → 热 3,879ms = 34 倍** |
| **`--no-daemon --rerun-tasks` + 一次性远端工作区** | 15 条 remote 门占 warm 总量 **51%**,且是最差的 20 倍 scaler |

> **把仓搬到本地 SSD,收益大于砍掉所有门的总和** —— 它会把整个 O(files) 类降约 40 倍。

**这条要写进结论**:CLAUDE.md 说「变慢时先砍最弱门」,但本轮实测表明
**这个循环的快慢由文件系统和 `--rerun-tasks` 决定,不由门决定**。先砍门是把力气用错地方。

#### T-5 · 仍然该砍的三道(即使只值 4%)

| 门 | 为什么 |
|---|---|
| **`U01-retirement`** | 走遍 1016 个文件只为跑 **2 条正则**,而两条**都已被 `backend-boundaries` 覆盖**(`forbiddenRuntimeTokens` 含 `org.apache.kafka` 与 `WebClient`)。冷跑 367 秒,20 倍时 **2 小时**。**全仓成本/收益比最差** |
| **重复的 `edge-codegen --check`** | **一次 verify 跑两遍** —— `openapi-contracts` 内 spawn 一次,`U01-codegen` 又跑一次,20.24 秒 × 2,**零增量覆盖**。同样地 `frontend-architecture` **跑 3 次**(static 一次 + 每个 App 的 `build` 脚本各一次) |
| **`U02-flyway`** | 27 秒 warm / **786 秒 cold**。它的 `R3_*` 码是 R3 时代"目录必须为空"的引导前提;`R5_CONTRACT_FACE_*` 与 `U01-face` 重叠(那条只要 5 秒);真正承重的迁移版本单调与禁 CASCADE **已由 `database-boundaries` 断言**(2.82 秒) |

#### T-6 · 20 倍时跨过"分钟→小时"的门

`backend-boundaries` 39 秒→13 分 · `edge-codegen` 20 秒→6.7 分 · `retirement` 冷 367 秒→**2 小时** ·
`flyway` 冷 786 秒→**4 小时** · `operations-ui-test` 107 秒→36 分 · 两个 UI build 各→35–45 分 ·
`foundation-tests` 57 秒→19 分。

#### T 组的最小起点

**不是砍门。按收益排:**

1. **把仓从 SMB 挪到本地 SSD** —— 整个 O(files) 类降约 40 倍,收益大于所有门之和
2. **去掉 `--rerun-tasks`,让 build cache 真的生效** —— 它占 warm 总量 51%
3. **给 tsconfig 加 `incremental`** · **verify 并行化** · **`backend-boundaries` 别再 4 次重走 appRoot**
4. **然后**才是砍 T-5 那三道门

### 2.6 X 组 · 过度设计(Dexter 2026-08-16 追加)

**这个仓的过度设计是系统性的,不是零星的**,而且有一个稳定的生成模式:

> **先建能力,再找消费者;找不到消费者,就建一个校验器来证明它存在。**

#### X-1 · 「删了没有任何人会发现」的清单(约 790 行)

| # | 位置 | 内容 | 行 |
|---|---|---|---|
| 1 | `ProductionTagOwnerService` + Api | JSON write 全链 + `copy`/`preflightCopy` 宽参重载 —— **1350 行文件里 17% 是没人走的第二条路** | ~260 |
| 2 | `descriptorRenderer.tsx` | 12 个零 manifest 生产者的 case + `recordRows` + `displayDescriptorValue` + 4 个 kind 类型别名 | ~109 |
| 3 | `useDrawerFormLifecycle` + 27 个 drawer | 整条 diagnostics 链 + 27 行 `diagnosticOperationId:` | ~72 |
| 4 | `OperationsScopeContext` + Store + App | 整个 Redux slice 及接线 | ~37 |
| 5 | `descriptorRenderer.tsx` | `assertDescriptorSlotBindingSet` + `isDomainControlKind` | ~21 |
| 6 | `useDrawerFormLifecycle` | `closedSessionKey` + `handleOpenChange` | ~21 |
| 7 | `inventoryManagementModel.ts` | `matchesStockView`(0 引用)+ 三个恒等函数 + 其单测 | ~18 |
| 8 | `contracts/policy/` | `r4-gate-catalog.json` + `r4-evidence.schema.json`(**全仓 0 引用**) | ~100 |
| 9 | `required-inventory.json` ×2 | **我的 6 个 assertion key + 12 个 assertionSources** | ~100 |
| 10 | `OperationsApi`/`OperationsTransport` | `operationsRefreshSignal` 发布线(**0 订阅者**) | ~4 |
| 11 | carryover manifest | `byPageDesignKey` 的 8 条 `k===v` 恒等项 | ~8 |
| 12 | foundation `index.ts` | 38 个零 App 消费者的类型导出 | ~38 |

**绝对安全零判断的三项**:`matchesStockView`(6 行,全仓 1 次出现)· 两个 r4-* 文件(0 引用)· `operationsRefreshSignal` 发布线(0 订阅者)。

#### X-2 · 三个最典型的「把简单问题复杂化」

**一 · `ProductionTagOwnerService` 双实现** —— 问题是"创建/更新/流转一个生产标签",
方案是**同一批业务事实写两遍**:一遍 typed record,一遍 JSON `ObjectNode` + `switch(operationId)`,
各配一套幂等回执、recheck、校验器。JSON 那套 **226 行零调用方**,代码自己标注 `legacy … remains isolated`。
**直接违反 CLAUDE.md**「不要为了向后兼容长期保留废弃方案」。

**二 · diagnostics 链:27 个调用点喂一个空洞** —— `onDiagnosticEvent` 消费者 **0**,
而 **27 个 drawer 传 `diagnosticOperationId`**,hook 每次打开铸 UUID、组装完整 event、
`onDiagnosticEvent?.({...})` **可选链短路,对象丢弃**,8 处 emit 一个字节没出去。
**死代码里最贵的一种:不是没人碰,是 27 个地方在为它付维护税。**
而 foundation 已有 2 个 App 真实接入的 observability 模块 —— 违反「引入新方案前先检查已有能力」。

**三 · `contextScopedQueryArgs({}, {groupWorkspaceKey}).groupWorkspaceKey`** ——
把一个字段包进对象再取出同一个字段,等价于 `selectedGroupWorkspaceKey`。
**而这个恒等式被 `commercial-group-boundary.test.mjs:127` 的源码正则焊死** ——
想改回去要先改测试。**过度设计 + 用源码正则把它固化成"边界",两个问题互相加固。**

#### X-3 · 我自己造的那套,按同样判据审下来是零消费者

我发明的 **6 个 assertion key** 全仓只出现在三处:两个 md 的 front-matter(自我声明)、
`required-inventory.json`(自我声明)、`index.json`(前者的生成副本)。
**没有任何 checker 断言它们,没有任何 skill 按它们路由,没有任何文档引用它们。**

而后台那 3 个 key 里有 **2 个指向同一个 anchor** —— 3 个 key 只对应 2 个不同检查。

**这两条记忆的真实价值**是让人 grep 得到正本(条目自己写着「规范失效不是因为没写,是因为找不到」)。
**这个价值由 `sourceRefs` 一个字段 100% 提供。** 6 个 key + 12 个 assertionSources + 4 个 anchor 的增量价值是 **0**。

⚠️ **我犯的是本文正在批评的同一个错**:把"能被机械校验"当成了"被验证过"。
**三处一致证明的是三处一致,不证明规范被执行** —— 而记忆条目记录的失败恰恰是
「格式规范定了没人执行,超长行 5207→7998」,**三处一致校验拦不住那个失败,一次也拦不住**。

**处置**:删掉 `requiredAssertions` 与 `assertionSources`,校验只留一条「`sourceRefs` 里的文件必须存在」。

#### X-4 · 可门化程度

- **零消费者的导出** → **可门化**:「每个 export 必须有 ≥1 个非测试消费者」,机械可查
- **「把简单问题复杂化」的判断** → **只能 review**,做成关键词匹配必然误伤

---


### 2.7 S 组 · 散落的裸 string(Dexter 2026-08-16 追加)

> ⏳ 待补 —— 独立评估进行中。

**Dexter 的判断(2026-08-16)**:「20 倍业务量的底座,如果到处都是散落的裸 string,最后一定会混乱不堪。」

**这不是"看情况判"的事,是一条硬线:**

> **裸 string 只在一处合法 —— 它的定义处。出现在第二处,必须是引用,不是重复。**

**为什么在 20 倍时是硬线而不是偏好**:一个出现在 N 处的裸 string 有 N(N-1)/2 个分叉机会,
而**分叉是静默的**。手机号正则就是证明:三处写法,一处多了个反斜杠,
`tsc` 绿、所有门绿、`od -c` 才看得出来 —— **暴露方式是五个页面的用户发不出邀请**。
今天 106 个文件手写 testId,20 倍后是两千个;今天 11 张表 6 种 scope-key 约定,20 倍后没人能说清哪种是对的。

**✅ 修正:本组与 X 组不冲突。**

原文写「把所有裸 string 都契约化本身就是过度设计」—— **这个说法是错的,已撤回**。它会给实施者
留出「这条不满足判据所以不用改」的口子。真实的成本结构是:

| | 成本 | 是否过度设计 |
|---|---|---|
| 抽成常量,第二处引用它 | **接近零** | **不是** |
| 围绕常量再建注册表 + 校验门 + 对账台账 | 高 | **可能是** |

**冲突的从来不是"抽常量",是"围绕常量再造一层机器"。**
所以本组的产出是**常量与生成物**,不是新的 manifest 或对账门 —— 后者归 X 组审查。

**唯一的例外**(仍要在报告里明确列出):**只出现一次**、或**写错立刻编译失败**的字面量不必动。

#### 归位标准(Dexter 2026-08-16 定,加一档边界)

Dexter 原话:「string 如果只是后台用或者只是前台用,就用常量。如果前后台都用,那就得是 contract。」

**标准成立,但「单侧」还要再分一档** —— 因为后台栽的正是这一跤:

| 用在哪 | 放哪 | 反例 / 正例 |
|---|---|---|
| **单侧、单模块** | 本地常量 | — |
| **单侧、跨模块** | **共享模块的常量**<br>后台 `modules/foundation` · 前端 `admin-ui-foundation` | ❌ 三个锁常量 `0x43534B55` / `0x4349544D` / `0x43534156` 是后台单侧的,但要在 `modules/catalog` 与 `modules/inventory` 保持一致,而**前者的常量后者够不着** ⇒ 手工复制 + Javadoc 维持 |
| **跨前后台** | **契约 + 生成物** | ✅ `EDGE_PROBLEM_CODES` —— 契约生成闭集,前端 `Record<EdgeProblemCode, ProblemFeedback>` 漏一个即编译错误<br>❌ 字典 kind `SKU_ATTRIBUTE_VALUE` / `ORDER_OPTION_VALUE` —— 后台 owner 校验 + DB CHECK、前端展示、seed 脚本、契约,**四处各写裸串** ⇒ seed 首败的直接原因 |

**⚠️ 中间那档就是 P-1**:`foundation` 无 JDBC 依赖 ⇒ 回执与锁常量无处安放 ⇒ 只能复制。
**归位标准是对的,但落不了地,因为第二档的位置还没建好。** 本组依赖 G1-a。

#### 判据再收一刀:不是「谁在用」,是「谁必须达成一致」

**待验的两条**(不得凭推测归档):

**已验(2026-08-16)**:

| 案例 | 结果 | 归属 |
|---|---|---|
| **手机号格式正则** | 后台**未找到格式校验正则**(搜了 `^1\d{10}$` / `MOBILE_PATTERN` / `mobile.*Pattern` / `1[0-9]{10}` 四种形式)<br>⚠️ 措辞要准:**是"未找到格式正则",不是"后台不校验"** —— 后台有 `mobile_normalized` 列,说明它做**归一化**;归一化 ≠ 格式校验 | **单侧 → 常量**。`MOBILE_PATTERN` 放 `admin-ui-foundation` **正确** |
| **锁常量** | 确认 `0x43534B55` 出现在 `modules/catalog` 与 `modules/inventory` **两个模块** | **单侧跨模块 → 共享模块常量**。当前无处放(P-1) |
| **用户可见中文** | 后台 Java 中文串 **487 处** vs 前端文案表 **72 条** | **需先拆分,见下** |

**⚠️ 487 不能直接当"要契约化 487 条"** —— 它混了三类,**必须先拆再判**,否则会把日志和夹具
一起塞进契约,那正是 X 组要挡的过度设计:

| 类 | 归属 |
|---|---|
| 真正返回给用户的错误消息(如 `"字典编码已存在"`) | **跨前后台 → 契约** |
| 日志消息(只给运维看) | 单侧 → 常量即可 |
| 测试夹具 / seed 标签(如 `"大杯"` `"七分熟"`) | 非运行时文案,不动 |

**真正要查的不是数量,是**:同一个失败,后台抛 `"字典编码已存在"`,前端文案表里对应 code
**另有一条中文** —— **两条都存在时,用户看到哪一份?** 这是"必须达成一致"的实质。

#### 顺带登记的一条(不属 S 组,性质不同)

**手机号格式校验只在前端** ⇒ 直接调 API 可绕过。这是**数据完整性**问题,不是字符串组织问题。
单独登记,**不混进 S 组**,避免把两类问题的修法搅在一起。

**仓内正例(当标尺用)**:`app/api/operationsProblemFeedback.ts` 用生成的 `EDGE_PROBLEM_CODES` 做
`Record<EdgeProblemCode, ProblemFeedback>` —— **漏一个 code 就是编译错误**。
这就是"契约化做对了"的样子,不用发明新形态。

**教科书反例(a+b 同时成立)**:手机号正则三处各写一遍,其中一处 `/^1\\d{10}$/` 多了个反斜杠
⇒ 五个用户管理页的「发出邀请」**永远提交不了**。`od -c` 确认源码字节即为两个反斜杠,
而 tsc 与所有门**全绿** —— 因为正则字面量语法合法,只是语义错了。

**已知候选(待独立核实计数)**:

| 类 | 已观察到的 |
|---|---|
| testId 字面量 | **106 个文件手写,无注册表**;L2 spec 按字面量引用 ⇒ 改一个 testId 会静默弄坏 L2 |
| 环境变量名 | **49 个 `R5_L2_*`**,未找到集中声明 |
| 字典 kind | `SKU_ATTRIBUTE_VALUE` / `ORDER_OPTION_VALUE` 在前端、后台、seed 脚本、契约里各自手写 —— seed 首败的直接原因之一就是 executor 把订单选项值写成了 `SKU_ATTRIBUTE_VALUE` |
| 锁常量 | `0x43534B55` / `0x4349544D` / `0x43534156` 在两个 owner **手工复制**,靠 Javadoc 维持 |
| scope-key 约定 | 11 张回执表 **6 种写法** |
| operationId | 消费侧手写字符串的处数待测(生成物是否已提供常量待核) |
| capability 字符串 | `R5_FRONTEND_CAPABILITY_LITERAL` 这道门守的是什么、有没有效,待核 |

**本组必须同时产出「明确不该契约化的」清单** —— 与"该契约化的"同等重要,
否则这件事会做成新的过度设计。

---

#### S 组实测结果

#### S-1 · 必须契约化的三类(实测规模)

| 类 | 规模 | 为什么 |
|---|---|---|
| **字典 kind 词汇** | **356 处跨 5 层**(后台 main 102 / 后台 test 110 / 脚本 72 / 前端 39 / 契约 33);`SKU_ATTRIBUTE_VALUE` 149 · `ORDER_OPTION_VALUE` 70 · `SALES_UNIT` 54 | **全仓没有任何 enum 或常量**。`CatalogOwnerService` 里同一个闭集在相隔 6 行处写了两遍(`Set.of(...)` 与并列 `switch`)。而 `catalog-inventory-copy-policy.json` 自称 `sourceOfTruth` 并列出前端为 consumer —— **前端从 `contracts/` 零 import**,那个消费关系是散文 |
| **后台 problem code** | **334 处 7 个码**(`VALIDATION_ERROR` 195 · `VERSION_CONFLICT` 38 · `SCOPE_FORBIDDEN` 33 · `RESULT_UNKNOWN` 31 · `NOT_FOUND` 23 · `DUPLICATE_CODE` 9 · `IDEMPOTENCY_MISMATCH` 5) | **消费侧(前端)是生成闭集且穷尽校验,生产侧(后台)零常量**。后台写错一个码 → `isOperationsProblemCode` 拒绝 → 回落 `RESULT_UNKNOWN` ⇒ **具体指引被静默降级成"操作结果待确认"**,任何一层都不报错 |
| **testId** | 源码 683 个字面量(672 唯一)+ L2 spec 342 个(171 唯一),**161 个 id 跨源码/spec 边界重复且无任何东西链接** | 组件里改名不会让 spec 编译失败,**只会变成选择器超时**。仓内已有先例:两个 spec 已经在 import 生成物 |

**外加一条最划算的**:`0x43534B55` —— **仅 2 处**(catalog + inventory),
两者必须约定同一命名空间否则**不再互斥**;改一处**无报错、无测试失败、无门失败**,
只是并发下静默丢失互斥。**约 30 秒的活,严重度/字节比全仓最高。**

#### S-2 · 已经分叉的三处(这是"会不会乱"的实证)

| | 分叉 |
|---|---|
| **`DISABLED` 的中文**(我亲验) | `WorkspaceUserPage.tsx:70` 与 `:361` 渲染成 **「禁用」**,而 store-management 等页面用 **「停用」**。**同一个后端枚举,两个中文词,`tsc` 绿、所有门绿** |
| **商品编码正则** | `/^[A-Z0-9][A-Z0-9_-]*$/`(无长度上限,字典抽屉与创建抽屉)vs `/^[A-Z0-9][A-Z0-9_-]{1,63}$/`(2–64,商品抽屉与工作台),**四种不同提示语**。⇒ 1 字符编码在字典抽屉过、在商品抽屉挂;100 字符在创建抽屉过、在工作台挂 |
| **advisory lock 键约定** | **6 种**。其中形式 1(`hashtext(a\|\|':'\|\|b)`)与形式 3(`hashtext(a), hashtext(b)`)**占用不同的 Postgres advisory lock 空间 ⇒ 永远不会互相阻塞**。是否有意 → `DEXTER_DECISION` |

#### S-3 · 明确不该契约化(与"该做的"同等重要)

| | 理由 |
|---|---|
| **operationId** | **已经做对了** —— 148 处引用生成常量,仅剩 4 个字面量在 `as const` 位置(打错即编译失败) |
| **前端 capability key** | 零手写字面量,全部生成或服务端目录驱动 |
| **~480 / 545 个 `R5_*`** | 是**门的失败标记**,每个只在一处打印。**输出串,不是共享键** |
| **~40 / 65 个 `R5_L2_*`** | 单读者、仓内无生产者、`requiredL2Env` 失败即响 |
| **~1000 个单次使用的中文页面文案** | **inline 是对的**。只有枚举→标签那一小撮够格;为其余建文案目录是大成本零收益 |
| **SQL 表名/列名** | 拼错会在该语句首次执行时**响亮且一致地**抛 `relation does not exist`,而 schema 的单一来源已经是迁移文件。Java 侧表名常量牺牲 SQL 可读性,只保护表名 token 不保护周围列名。**建议不做,但属 Dexter 可裁** |
| **`group_workspace_key=?`(243 处)** | 风险是**漏掉**租户谓词不是拼错,**字符串常量抓不到遗漏** —— 要的是带 scope 的查询助手,不是契约。**归 D 组不归 S 组** |

#### S-4 · 结论

**不是系统性的** —— 仓里**已经拥有一套可用的契约化机制**(edge codegen → 闭集 → `Record<K,V>` 穷尽性),
而且在**前端消费侧**用得很彻底。裸 string 问题是**同一套机制停在三个边界上**:
**后台生产侧 · catalog 字典词汇 · 源码/测试边界**。

**所以修法是"多几个生成器目标 + 导出常量",不是新机器。** —— 与 X 组不冲突。

---

---

## 3 · 优化方案

### 3.0 Dexter 已裁定(2026-08-16)

| # | 裁定 | 含义 |
|---|---|---|
| 冻结计数 | **直接删,不替换** | 编译器已覆盖(`satisfies Record<>` 穷尽性),新增判据是加机器 |
| 抽象边界 | **该抽的现在就抽** | 目的地已存在且被广泛使用 ⇒ 抽;要新造且只有 1–2 个调用点 ⇒ 不抽 |
| 裸 string 归位 | **单侧→常量;跨前后台→契约** | 加一档:**单侧跨模块→共享模块的常量** |
| L2 重建 | **暂缓** | 建在错误逻辑上的 L2 比没有更坏,等产品体验确认 |
| 幂等边界 | **设值类→内容派生键;增减类→意图轮换键** | 逐条判定命令属性,不按目录一刀切 |
| tag 粒度 | **先修泄漏,不做更细** | 退订修好后浪费自消;只补 catalog-inventory 那处零 tag |
| **租户可追溯性** | **甲 —— 只补 scope 复合 FK** | 不加冗余 workspace 列,不加跨 owner 外键。**保持 owner 不透明原则** |
| **两种 lock 空间** | **不需要互斥** | ⇒ 现状**无害**,只是写法不统一 ⇒ **归 S 组统一常量,不升 P 组** |
| **SQL 表名常量化** | **不做** | 拼错立刻抛 `relation does not exist`,响亮一致;常量化只保护表名不保护列名 |
| 构建循环(T 组) | **本轮不关注** | 结论保留在 §2.5 备查 |

### 3.1 每条问题的处置与检测形态(对抗审查后重定)

**⛔ 上一版 22 条「可门化」里,10 条被判定为条件反射,已砍。** 判据是三条:
① 编译器/现有门是否已覆盖 · ② 门能否被一句话绕过 · ③ 误伤面是否远大于收益。

#### 砍掉的 10 条门,及各自的反证

| 原提的门 | 为什么砍 |
|---|---|
| P-1「禁 `*CommandReceiptService` 在 owner 模块内定义」 | 那 8 个类**全在 organization/workspace/extension 等**,catalog/inventory/production **一个都没有** —— 它们是把回执 SQL **内联进 owner service**。**这道门对真正的肇事者恒绿** |
| P-3「禁 8 位十六进制魔数」 | 全仓就 6 处,抽成共享常量后**永远绿**;真实风险(第 4 个 owner 造新命名空间撞号)它抓不到 |
| P-4 重复度门 | 55–71% 是**结构相似度不是拷贝**;逐行比对到 55% 就报警 ⇒ **每写一个新 CRUD feature 就红一次**,而 CRUD 页面结构相似本来就是对的 |
| P-5 尺寸门(无阈值) | **没有阈值的门等于没有门**;而且排序前提被推翻:P-1 从 `CatalogOwnerService` 只能搬走约 115 行(**1.5%**)、P-4 从 `CatalogItemDrawer` 约 120 行(**2.3%**),**B2/B3 做完这两个文件依然全红** |
| O-2「日志字段必须含租户与节点」 | 字段是 Java **`record`**,加一个 component **所有构造点当场编译失败**。**与冻结计数被 `satisfies Record<>` 覆盖是字面同构的复发** |
| O-3「handler 必须调用 logger」 | 25 个 handler 全部 `return problem(...)`,而 `problem()` **只有 2 个重载**。这道门要求 25 处各写一遍日志 —— **正面违反 G1** |
| O-4「禁形参下划线丢弃」 | `eslint.config.mjs:29` **本仓刻意配置**了 `argsIgnorePattern: '^_'`;`(_x` 实测约 **199 处**。**用 199 处误伤修 1 处** |
| S-1「消费侧禁止字面量」 | **与本文 §2.7 S-3 直接矛盾** —— 那里写明「~1000 个单次中文文案 inline 是对的」,而 features 下含中文字面量实测 **1722 个** |
| S-2「同一枚举标签映射只允许一处」 | 判定两个 `Record<XxxStatus,string>` 是不是「同一枚举」需要类型解析;做成正则就是匹配标识符名,**改名即绿** |
| X-1「每个 export 必须有消费者」 | foundation `index.ts` 有 **24 条 barrel re-export**;朴素计数要么把 barrel 后面全判死要么全判活。而 foundation 是**库**,「今天 0 个 App 消费」是设计问题不是死代码 |

#### 保留的处置(12 项真需要)

| 问题 | 处置 | 检测形态 |
|---|---|---|
| **P-2** 真 500 | **先修本身**:inventory/production 的回执 insert 补 `ON CONFLICT DO NOTHING` + `ContractProblemAdvice` 加第 26 个 handler。⚠️ **catalog 的现状不是正例** —— `ON CONFLICT DO NOTHING` 是**静默双执行**;正解是仓内 6 个服务在用的「先拿 advisory lock 再 replay」 | **只能 review**(语义正确性) |
| **P-1** 回执统一 | **降级并推迟** —— 见 §3.2 | **只能 review** |
| **P-3** 锁常量 | 提为共享常量(30 秒) | **编译器已覆盖**(共享文件里唯一性一眼可见) |
| **P-4** 扩展字段渲染 | 只提升 **md5 相同**的那组进 foundation | **可门化**:禁止同一文件名在两个 feature 的 `ui/` 下同时存在<br>**负控制**:抓不到"内容略有差异的近似拷贝" |
| **P-8** 冻结计数 | **删** | **编译器已覆盖** |
| **E-1** 假门/没接线 | 修正则 · `spotlessCheck` 接线(**前置:补 gradle wrapper**) | **可门化 + 红夹具 + 负控制** |
| **E-2** 218 处存在性断言 | **逐条处置,不归零**(配对的保留) | **可门化** |
| **E-3** 28 条 acceptance | 接进**显式可跑路径**,或只在后台变更时触发。⚠️ **不能默认进 verify** —— 它是全仓最贵的运行时,而 T 组本轮不看 | **可门化** |
| **E-4** 不写测试没代价 | **⚠️ 上一版整条漏了 —— 这是唯一能改变行为经济学的一条。**<br>最小形态:去掉 `test:unit` 的 `--exclude "**/*.spec.ts"`;让 `affected-l2` 从**选择门变执行门**。**零新基建** | **可门化** |
| **D-3** 跨租户连接 | catalog 的 item/category/sku 关系表补 scope 复合 FK。⚠️ **该模式已进 catalog**(`V20260816_010000_000:198` 的 `dictionary_entry`),只是**没跟到关系表** —— 不是"没带进最新 owner" | **可门化**:带租户的表禁止单列 FK |
| **D-5** 死表 + 3 处缺索引 | 三个迁移文件整体摘掉;补 3 条索引 | **可门化**(回放通过)· **只能 review**(索引取舍) |
| **O-2/O-3/O-4** 可观测性 | 日志字段加租户(record 加 component)· 在 **`problem()` 那 2 个重载**里记 cause · `FrontendLogEvent` 加必填字段让编译器抓 | **编译器已覆盖**(全部三项) |
| **S-1** 三类契约化 | **收窄**:problem code 生成 enum(生成物**已存在**,缺类型与消费者)· 字典 kind 只统一 **owner 校验器 ↔ seed 脚本 2 个点** · testId 只做 **161 个跨界 id** | **编译器已覆盖**(spec import 后改名即编译失败) |
| **S-2** DISABLED / 编码正则分叉 | 统一 | **编译器已覆盖**(`Record<Enum,string>` 漏 key 即编译错误) |
| **X-1** 零消费者 | **一次性用 `knip` 清理,不设常设门**。⚠️ 清单需重核 —— 已知 r4-* 两文件那条**已证伪**(有 6+ 处文档引用) | — |

### 3.2 三个批次(重定)

#### B1 · 删与接线

**删**:冻结计数 · X 组零消费者(**清单需重核**)· 我的 6 个 assertion key · 死表三文件 · `ProductionTagOwnerService` JSON 双实现(**须先确认 typed 路径有等价测试覆盖**)
**修**:**P-2 那个真 500**(2 条 SQL + 1 个 handler,**当天可关**)· 锁常量提取 · DISABLED 中文 · 编码正则
**接线**:补 **gradle wrapper**(前置)→ `spotlessCheck` · 修假门正则 · **E-4 去掉 `--exclude`** · **补 `/actuator/health`**(一行依赖 + 一行配置)

#### B2 · 后台契约化与可观测性

problem code enum(生成物已存在,加类型+消费者)· 字典 kind 统一那 2 个点 ·
日志 `Fields` record 加租户/节点 · `problem()` 2 个重载记 cause · catalog 关系表补 scope 复合 FK · 3 条缺失索引

⚠️ **P-1 回执统一不在 B2** —— 见下。

#### B3 · 前端形状与收尾

`OrganizationExtensionFields` 进 foundation · 161 个跨界 testId 常量化 · 218 处存在性断言逐条处置 ·
**尺寸门(必须先定阈值并给出红名单)**

### 3.2bis · P-1 为什么被推迟

**§3.0 已裁定租户列不统一命名**(甲方案)。DB 侧保留多种 scope-key 形态,
而统一的回执 helper 必须对这些形状**参数化** ⇒ **那不是「唯一实现」,是「一个实现 + 多路策略」**。

⇒ 「P-2 随 P-1 消解 / 编译器已覆盖」的论证**失效**。
⇒ **正确顺序**:B1 先修 P-2 本身;回执统一推迟到**租户键形态定下之后** ——
这与 §2.3「D 组的最小起点」自己写的顺序一致(模板的头两列取决于租户键先定)。

### 3.3 已排除的方案(记录理由,避免重议)

| 方案 | 排除理由 |
|---|---|
| 冻结计数改成"集合自洽"判据 | **Dexter 已裁:直接删**。编译器已覆盖;5 条新判据无实例支撑,违反「新规则由实例产生」 |
| 给三个 owner 加冗余 `workspace_uuid` 列 | **Dexter 已裁甲方案** —— 打破 owner 不透明原则,为今天不存在的需求动原则 |
| 给 `data_node_ref` 加跨 owner 外键 | 同上,且与模块边界冲突 |
| SQL 表名常量化 | **Dexter 已裁不做**。拼错立刻抛 `relation does not exist` |
| 上 OpenTelemetry / Prometheus | 是平台工程,解决量与趋势;**没有租户维度就加 tracing,只会得到更多匿名 span** |
| 新建单元层 DOM 环境 | 仓内已有 19 个 Playwright spec;未做比较就预授权新增基建 |
| 重建浏览器 L2 | **Dexter 已裁暂缓** |
| 改后端模型允许多父属性 | 为 2 个冲突值重做唯一约束/迁移/契约/前端,代价不配 |
| 到处补业务日志 | 业务层 0 logger,零散补只会制造**没有 join key 的噪声** |

## 4 · 待补与待裁

| | |
|---|---|
| **待补** | 无 —— 七组全部完成(P/E/D/O/T/X/S) |
| **待裁** | 暂无。冻结计数、L2 暂缓、抽象边界三条 Dexter 均已裁定 |
| **本文状态** | §2 已全量完成(七组)· **§3 待基于完整问题集重写** · 之后派对抗审查 |
| **P-2 语义** | ~~`DEXTER_DECISION`~~ **已撤回 —— 我问错了。这不是产品裁决,有正确答案,且仓内 6 个服务已在用** |
