# 经营渠道与外部系统管理 · 设计文档规范符合性评审

- 日期:2026-08-20 · 评审者:Claude(独立子 agent,fresh v2s-rooted 会话)
- 依据动作:`doc/platform/review-standard.md` §1 五个动作 · 入口 skill `cs-review`
- 判据取自(按 review-standard §0 的顺序,本文只引用不复述):本批三份设计文档 →
  `doc/platform/frontend-coding-standard.md` / `backend-coding-standard.md` →
  `doc/platform/foundation-charter.md` → `doc/decisions/templates/` 四份模板 → `project-memory/`
- 被审对象(四份):
  - `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`
  - `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`
  - `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`
  - `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`
- 授权边界:本文只是**设计文档的规范符合性**结论。不授权 implementation、DEV、seed、reset、L2、UAT 或任何仓库控制动作。

---

## 0 · 动作 1 在文档评审下的适配(本轮被要求单独说明)

评审正本 §1 动作 1 的脚本硬编码 `apps/frontend/*/src/features/<FEATURE>/ui/*.tsx`,
前提是**被审对象是代码**。本轮被审对象是文档。我的适配是把一趟提取拆成三趟:

| 趟 | 做什么 | 本轮实际产出 |
|---|---|---|
| **1a 文档侧提取** | 从设计文档机械提取它**声称**的可见事实 | 12 个 `### Screen` 的 `USER_VISIBLE_COPY` / `UI_SURFACE` / `FOUNDATION_PRIMITIVE`;线框里 26 个 `[...]` 控件;IA 11 个 IA-ID 的 `controlType` |
| **1b 代码侧提取** | 正本原样的 .tsx 脚本**照跑** | 17 个 `.tsx`,提取出表格列、可见标签、表单字段、校验提示、长中文串、前端自造枚举文案 |
| **1c 双向对账** | 1b 的每条渲染事实拿去四份文档搜;1a 的每条声明拿去代码搜 | 见 L2 |

**1b 之所以能跑,是因为本批已经实施了。** 这不是我预设的:实测 `@AcceptanceScenario` 全仓 60 条,
其中 `CollaborationAcceptanceScenarios.java` 9 条、`BusinessChannelAcceptanceScenarios.java` 7 条已在仓内,
正好等于详设 §7.1 写的 `CURRENT_SOURCE_COUNT=44 + PROPOSED_NEW_COUNT=16 = PROJECTED_COUNT=60`。
两个 feature 目录 17 个 `.tsx` 都已存在。

**⚠️ 1c 的"双向"是本轮才补上的,单向会漏一半。**
只做「代码→文档」会漏掉**声明了却没实现**的(如交互工件 P2 的 `适配器状态` / `适配器尚未部署`、IA-P2 的「确认 Modal」);
只做「文档→代码」会漏掉**实现了却没声明**的(17 条空/失败/校验文案)。本轮两类都出现了。

### 正本在这一点够不够用:**不够**

`review-standard.md` §1 动作 1 只给了一个面向 `.tsx` 的脚本,没有说:

1. 被审对象是**文档**时这个动作怎么做(它此时不是空转 —— 文档自身就承载可见事实声明,该被同样机械地提取);
2. 当设计文档**对应的代码已经存在**时,应该反过来把代码当对账基线,并且**必须双向**。

这两条都不该我在评审里就地立规则(§2),所以进 `DESIGN_GAPS`。

---

## 1 · 结论

```text
VERDICT=NO-GO
M/S/N=3/9/4
```

`NO-GO` 的理由集中在两点,都不是"可以更好":

- **M-1**:交互工件与 IA/详设在 O1/O3/O5 的集合形态上**互相矛盾**。这正是 `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md` 记的 R5 最贵那条缺陷(「IA 写 bounded、详设写 Page」)的原样复现,只是这次矛盾的两方换成了 IA 与交互工件。
- **M-2 / M-3**:Bounded 上界与预期规模在四份文档中零处,详设整张 §3 横切机制对照表缺失。两者都已经在生产代码里留下可点名的后果。

---

## 2 · L1_ENGINEERING

```text
L1_ENGINEERING=findings(M-2 · M-3 · S-4 · S-5 · S-6 · S-8 · S-9)
```

### M-2 · Bounded 集合形态没有上界来源与预期规模;实施期自选 100,第 101 条返回 HTTP 500

- **位置**:IA `### IA-O1` 的 `dataSourceAndCascade`(「owner 固定上限由服务端提供」)· IA `### IA-O3` 的 `dataSourceAndCascade`(「不承诺当前行数上限」)· 详设 `### 5.2 operationId/path 设计` 表(5 列:业务意图 / operationId / method/path / face / collection)
- **违反哪一条**:
  - `doc/platform/foundation-charter.md` §1-J,Bounded 的固定义务是「**写出上界来源**;断言 exact set;不拿当前行数当上界」
  - `doc/decisions/templates/ia-design-template.md` §2.2 —— `collectionShapeAndScale` 必填「四形态之一 + **预期规模** + 上界来源」,并明写「写不出预期规模,说明形态还没定 —— **此时不许往下写**」
  - `doc/decisions/templates/implementation-design-template.md` §5 —— 该表必须有「**预期规模与增长驱动**」列,并明写「预期规模写不出来 ⇒ 集合形态还没定,不许往下写」
- **影响面(全集)**:4 条 bounded read —— 项目模板、项目渠道、门店可接入模板候选、门店渠道。四份文档中「上界 / 上限 / 预期规模」的全部命中只有 2 处(IA 行 151、行 179),两处都是属性描述,没有数值也没有来源。
- **一个能打红的反例**:`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java` 锚点 `static final int BOUNDED_READ_LIMIT = 100;` —— 这个 100 出自实施期,四份设计文档没有一处提到它。同文件锚点 `"bounded business-channel template read exceeded its fixed source limit"` 与 `"bounded business-channel read exceeded its fixed source limit"` 两处在超界时抛 `PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION` / **HTTP 500**。该 code 不在 IA §3 的 16 个 typed problem 里;第 101 条渠道出现时,用户在项目渠道页看到的是 `BusinessChannelList.tsx` 的「经营渠道读取失败」,没有任何恢复路径,而这条路径在设计里根本不存在。
- **另一半反例(验收侧假绿)**:详设 §7.2 的 16 条场景没有一条造过量数据。`collaboration.binding-page-searches-node-name` 的 fixture 是「a real store binding」(1 条)去验一个 Page;bounded 侧无任何 >100 的 fixture ⇒ 上面那两个 500 分支零覆盖。这正是 `implementation-design-template.md` §11「**夹具必须造出超过单页/超过边界的数据量** —— 不过量的场景必然假绿」。
- **最小修复**:在 IA 每个 O 段补 `collectionShapeAndScale`(形态 + 预期规模 + 上界来源 = 源码常量 `BOUNDED_READ_LIMIT`);在详设 §5.2 表补「预期规模与增长驱动」列;为 bounded 溢出补一条 >100 的 acceptance 场景。
- **需 Dexter 产品裁决**:**是**。「一个项目预期有多少条经营渠道」是产品事实,它决定 100 是否正确、以及形态是否应当从 Bounded 改成 Page。在裁决前不应固化 100。

### M-3 · 详设缺整张 §3 横切机制对照表(模板明令不得删行);其中「编码与名称呈现」全集未枚举,已在生产里造成三处手写枚举文案

- **位置**:详设全文(`## 0.` ~ `## 12.`,13 个二级节,无该表)
- **违反哪一条**:`implementation-design-template.md` §3 ——「**行集由本表给定,作者只能填值、不得删行**」;该节 ④ 列「**全集不是举例,是清单**」;并见 `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md` 成因 ②「规范存在但详设没点名 ⇒ 修法:横切机制表行集固定,只能填值不能删行」
- **实测(先跑搜索再写)**:15 个机制关键词在详设中的命中数 —— 读侧节点授权 0 · 写授权与 grant 0 · 跨 owner 写与事务 0 · 集合形态与分页 0 · 缓存失效 0 · currentData 0 · isFetching 0 · 同一事实 0 · 幂等键 0 · 手搓字符串 0 · 脱敏 0 · 迁移回填 0 · 原子组 0 · 候选/下拉 0 · 编码与名称呈现 0。换拼写复核(charter §3-B):`idempot` 0 · `cache` 0 · `invalidat` 0 · `redact` 0 · `原子` 0 · `迁移` 0 · `幂等` 1(仅 §3.3「审计/幂等 receipt」,后端回执侧)· `migration` 1 · `Flyway` 2。
- **一个能打红的反例**:详设 §2.2a 自己立了不变量「只读显示、Tag、详情描述和候选选项的辅助文案**不得从 enum literal 临时反推**;**不新增第二份前端 enum-label 字典**」,但它的 readback 表**没有 workspace enablement status 这一行**。实测生成契约里 `enablementStatusDisplayName` **零命中**,而三个文件各写了一遍同一个映射:
  - `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx` 锚点 `system.enablementStatus === 'ENABLED' ? '已启用' : '已停用'`
  - `apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx` 锚点 `enablementStatus === 'ENABLED' ? '已启用' : '已停用'`
  - `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalCollaborationPage.tsx` 锚点 `status === 'ENABLED' ? '已启用' : '已停用'`

  这同时命中前端规范 **2-B**(同一常量/映射多处各写一遍)。对照组:`catalogStatusDisplayName` **在生成物里有 4 处**,§2.2a 表里也有,可 `ExternalSystemDetail.tsx` 锚点 `system.catalogStatus === 'AVAILABLE' ? '可用' : '计划中'` 仍然反推 —— 说明这条不变量在本批**没有任何东西在守**,而 §3 表的 ④ 列(本批适用全集)正是唯一会强迫作者把所有需要中文名的枚举数一遍的地方。
- **⚠️ 诚实边界(避免把缺表说成全表都坏)**:同一张缺表里的三行,实施期**没有**走偏,不计 finding ——
  - 前端规范 §3-B:两个 feature 只用 `currentData`(4 处)与 `isFetching`(3 处),`isLoading` **0 处**;
  - 前端规范 §3-G:`useDrawerFormLifecycle({idempotencyKey: true})` 配 `markBusinessIntentChanged()` 成套出现在 5 个抽屉,`ProjectBusinessChannelPage.tsx` 的状态流转用的是内容派生键 `` `business-channel-template:${template.templateRef}:${status}` ``,与 Dexter 2026-08-16 裁定的「设值类用内容派生键」一致;
  - 前端规范 §3-E:未见服务端事实被镜像进本地 state。

  所以本条的实质影响是「已证坏的一族(名称呈现)+ 侥幸没坏的一族」,不是全表失效。
- **最小修复**:补全 §3 表 17 行;`编码与名称呈现` 行的 ④ 列枚举本批**全部**需要中文名的枚举(至少含 enablement status),并让 §2.2a 表与之逐字一致。
- **需 Dexter 裁决**:否。

### S-4 · 详设与串行计划的 CP 编号互相冲突,同一个 `CP-03`/`CP-05`/`CP-06` 指不同的东西

- **位置**:详设 `## 1. CP 总览` 表 vs 串行计划 `## 3.` ~ `## 12.` 的节标题
- **两套编号**:

  | id | 详设 §1 | 串行计划 |
  |---|---|---|
  | CP-01 | contract catalogue 与 descriptor | 契约 descriptor 与 collaboration 领域模型 |
  | CP-02 | collaboration runtime owner | business-channel owner 模型与业务状态 |
  | CP-03 | business-channel runtime owner | edge policy、权限与跨 owner 事务 |
  | CP-04 | edge face、capability、跨域 policy | 生成链与后端/前端 wire |
  | CP-05 | generated wire 与**双** admin UI | **platform-admin** UI |
  | CP-06 | seed plan、acceptance、全范围静态证明 | **operations-admin** UI |

- **违反哪一条**:`foundation-charter.md` §7-A 判别式「读完这一条,两个不同的人做出来的东西一样吗?不一样 ⇒ 失格」;§5-A「定位必须唯一」
- **影响面**:两份文档的全部 CP 引用(详设 6 个 + 串行计划 10 个)
- **反例**:一条指令「按 CP-06 的门控实施」——在详设里是 seed/acceptance/静态证明,在串行计划里是 operations-admin UI。两个执行者会做两件不同的事。
- **最小修复**:串行计划改用与详设**同一套** CP 编号;若确实是更细的切分,改用不同前缀(如 `STEP-xx`)并在 §2 给出 `STEP → CP` 映射表。
- **需 Dexter 裁决**:否。

### S-5 · 同一批内对 DEV 授权与 UI 视觉准入门有两条互相冲突的指令

- **位置一(DEV)**:串行计划开头引用块「仍不授权 seed 执行、reset、**DEV**、L2、UAT、外部联调或 Git 操作」 vs 详设 §0.3 `NOT_AUTHORIZED=seed execution + reset + L2 + UAT`(**不含 DEV**),且详设末节写「**受管 DEV restart 已执行**,Flyway `V20260819.230000.003` 与 `V20260819.230000.004` 已应用」。
- **位置二(视觉准入)**:串行计划 `## 3. CP-00` 失败条件「Dexter 已裁定按文字版 IA/interaction 实施;**不得再把另行视觉 review 作为本批 UI 实施准入门**」 vs 同一份文档 `## 8. CP-05` 实现顺序第 1 条「**未完成 visual review 不进入 UI implementation**」,以及 `## 9. CP-06` 第 1 条「复核 O1–O5 的 Journey 与 visual review」。
- **违反哪一条**:`foundation-charter.md` §8-B(「两条指令冲突」是**必须停机**的情形)· §7-A(不允许"看起来像指令、实际没想清楚"的第四种状态)
- **影响面**:授权边界 1 处、UI 准入门 1 处;两处都在同一批的两份文档之间。
- **反例**:执行者读串行计划会停在 visual review 上不动;读详设会认为 DEV 可用且已用过。两条都在本批,都写着"已授权"。
- **需 Dexter 产品/授权裁决**:**是** —— DEV 到底授不授权,只有 Dexter 能定。我不对已执行的 DEV/Flyway 本身下判断,只报告两份文档互相否定。

### S-6 · `scripts/check/ui-wireframe-traceability` 被列为本批验证意图,但它与本批线框无关,是存在性假门

- **位置**:详设 `## 12. Verification intent` 的命令清单
- **本会话 fresh 亲验**:`./scripts/check/ui-wireframe-traceability` ⇒ `EXIT=0`,输出 `R4_UI_WIREFRAME_TRACEABILITY=PASS`。打开实现:`tools/verify-gates/cli.mjs` 锚点 `function traceability(base = root) {` —— 它只读两份 **2026-07-25** 的固定文档,做 `/CARRY\s*\/\s*ADAPT\s*\/\s*NOT_CARRIED/` 与 `/admin-ui-foundation/` 两个**存在性**正则,与本批的 screen、线框、`USER_VISIBLE_COPY` 没有任何关系。
- **违反哪一条**:`foundation-charter.md` §3-C「存在性判据不算判据」· §6-A 四件套的「反例栏」· 前端规范 §1-0「存在性断言不得单独承载约束」· `project-memory/pitfalls/green-by-existence-check.md`
- **现成的反例栏**:本批 12 个 screen、17 条实现文案在四份文档中零声明(见 L2/S-1),该门依然绿。
- **最小修复**:从本批 Verification intent 删掉这一行;或原地加一句「该门不覆盖本批线框↔文案对账,该对账由 review 承担」。
- **需 Dexter 裁决**:否。

### S-8 · 详设 §9 声明—传递—消费矩阵缺模板强制的三行机制行,错误映射行没有注册处精确类路径

- **位置**:详设 `## 9. declaration-transfer-consumption matrix`(9 行)
- **违反哪一条**:`implementation-design-template.md` §7 —— 该表强制含机制行,并列出常见项:**集合形态**、授权执行点、**缓存失效**、错误映射、**日志与脱敏**;附注写明「R5 之前这张矩阵九行全是业务事实、零机制事实,于是机制类缺陷整体逃逸」
- **实测**:现有 9 行中 7 行是业务事实(catalog / capability attribute / enablement / binding identity / node candidate / template four dimensions / channel status),机制行只有 `operation authorization` 与 `typed problems` 两行;**集合形态、缓存失效、日志与脱敏三行零存在**。`typed problems` 行的 transfer 写的是 `owner exception → edge problem mapping → generated client`,模板要求的是「**注册处的精确类路径**」,没有给。
- **反例(这一行本来能挡住 M-1)**:「集合形态」行的三列正是 declaration=IA 的 `collectionShapeAndScale` / transfer=契约参数列表有没有 cursor/page/filter / consumption=前端 total 取自哪、有没有客户端 slice。有这一行,IA 写 bounded 而交互工件写 Page 就会在交付前撞在同一行里。
- **需 Dexter 裁决**:否。

### S-9 · 详设缺模板的 §9(owner API 消费者清单)、§9b(锚点定位)、§10(数据迁移)、§14(交付前自查);CP-06 无门控

- **逐节对照**(`implementation-design-template.md` 的必填节 → 详设):

  | 模板节 | 详设 | |
  |---|---|---|
  | §0 元数据与授权边界 | §0.3 | 有(字段形态见 N-3) |
  | §1 业务目标与方案比较 | §0.1 / §0.2 | **有,且质量好**(见 §5) |
  | §2 CP 总览 | §1 | 有 |
  | §3 横切机制对照表 | — | **缺**(M-3) |
  | §4 每个 CP 的门控 | §2.1 §3.1 §4.1 §5.1 §6.1 | **6 个 CP 只有 5 个有**;CP-06(§7 验收与 seed)无 |
  | §5 operation/path/face/集合形态 | §5.2 | 有,**缺"预期规模与增长驱动"列**(M-2) |
  | §6 跨 owner 写矩阵 | §5.4 | 有 |
  | §7 声明—传递—消费矩阵 | §9 | 有,**缺三行机制行**(S-8) |
  | §8 业务规则 → owner 判定点 | §8 | 有,34 行,与自称一致 |
  | §9 owner API 与消费者清单 | — | **缺** |
  | §9b 变更定位(锚点非行号) | — | 缺(实际未用行号,无实害) |
  | §10 数据迁移 | — | **缺且适用** |
  | §11 验收场景设计 | §7.2 | 有(过量夹具问题见 M-2) |
  | §12 未决项处置 | §10 | 有 |
  | §13 停机条件 | §11 | 有 |
  | §14 交付前自查 | — | **缺** |

- **§10 为什么"适用"**:详设 §0.4 明写「对历史上『内部 + 无绑定 + 无停用原因 + DRAFT』的遗留行由一次性 Flyway repair 提升为 `EFFECTIVE`」,末节又写两条 Flyway 版本已应用。模板 §10 的四问(加/改什么 · 旧行回填取什么值 · **为什么那是唯一可恢复的事实** · 可否回滚)一个都没答。第三问在这里是实打实的:把 DRAFT 提成 EFFECTIVE 是不可逆的业务状态变更。
- **§9 缺失的可点名后果**:详设 §3.3 声明的 `CollaborationBindingReadApi.findBindingsForChannelReference`、`CollaborationCommandApi.applyAuthorizationCallback`、`applyRevocationCallback` 三个方法,在 §5.2 的 operation 表里找不到消费者,而 §5.2 正文又明写「OP-11/OP-12 adapter callback paths are not exposed to either admin app… no external integration is implemented in this batch」。按模板「⛔ **零调用者的方法当场删**。声明了没人调的 command 是设计噪音,会被误读为『已支持』」,这三个要么删、要么写出精确调用者 —— 现在两者都没有。
  ⚠️ 我**没有**断言它们是死代码:`collaboration.adapter-unbind-required` 场景用到了 callback 路径,消费者可能是测试。正因为分不清,才需要那张表。标 `UNVERIFIED_REQUIRES_EVIDENCE`。
- **需 Dexter 裁决**:否。

---

## 3 · L2_USER_VISIBLE

```text
L2_USER_VISIBLE=findings(M-1 · S-1 · S-2 · S-3 · S-7 · N-1 · N-2)
```

### M-1 · 交互工件与 IA/详设在 O1/O3/O5 的集合形态上互相矛盾(bounded vs Page)

- **三方原文**:

  | 文档 | 位置 | 说的是 |
  |---|---|---|
  | IA | `### IA-O1` controlType | 「两个 bounded 结果表格;**不提供搜索、查询、重置或分页**,仅提供表头临时排序」 |
  | IA | `### IA-O3` controlType | 「bounded 结果表格;**不提供名称/编码搜索、查询、重置或分页**」 |
  | IA | `### IA-O5` controlType | 「均使用 ProTable 结果表格(**不提供搜索或分页**,表头支持临时排序)」 |
  | 详设 | §6.3 表行 `P4 Page / O1-O3-O5 bounded` | 「O1/O3/O5 使用 ProTable **关闭 search/pagination**」 |
  | **交互工件** | `### Screen O3` | `UI_SURFACE=内容页下半区的**标准分页表格**`;`FOUNDATION_PRIMITIVE=**usePageQuery, createPageQueryIdentity**`;`TECHNICAL_BOUNDARY=**Page query**` |
  | **交互工件** | `### Screen O3` 线框 | `│ [搜索渠道名称或编码] [查询] [重置] [新建渠道] │` |
  | **交互工件** | `### Screen O5` 线框 | `│ [搜索渠道名称或编码] [查询] [重置]          [新建渠道]   │` |
  | **交互工件** | `### Screen O1` | `FOUNDATION_PRIMITIVE=… **usePageQuery** …` |
  | **交互工件** | §1.1 交互地图第 7/9 行 | `business-channel **Page**/Detail` · `business-channel **Page**` |
  | **交互工件** | §1.4 搜索与候选分母表 | `O1/O3/O5 | APPLICABLE | 找模板/渠道;**需要远程 Page** | business-channel owner Page;名称/编码为主实体搜索` |

- **违反哪一条**:
  - `ia-design-template.md` §5 交叉对账 ——「IA ↔ 交互工件:同一 screen 的形态、入口、**可见文案逐字一致**」「不一致即缺陷,⛔ **不许留给实施期弥合**」
  - `implementation-design-template.md` §14 ——「详设 ↔ IA 交叉对账:同一事实逐字一致」
  - `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md` 成因 ③,原文就是「IA 写 `bounded`、详设写 `Page` —— **两份设计文档在实施开始前就自相矛盾**」
- **影响面(全集)**:3 个 screen(O1 / O3 / O5)· 4 张用户可见表 · 交互工件里 4 处独立表述(screen 声明、线框、§1.1、§1.4)
- **一个能打红的反例**:实现按 IA + 详设走,`ProjectBusinessChannelPage.tsx` 锚点 `search={false}` 与 `pagination={false}`、`BusinessChannelList.tsx` 同样两个锚点 —— 交互工件要求的搜索框 / 查询 / 重置 / 分页器在实现中**零存在**。对照组 `OwnerBindingList.tsx` 锚点 `placeholder="搜索绑定名称或业务节点名称"` 与 `pagination={{`,P4 三份文档一致、实现也一致。**所以问题不是"实现没跟上",是交互工件这一处已经过时,而它恰恰是 UI 实施者读线框与文案的那一份。**
- **最小修复**:把交互工件 O1/O3/O5 的 `UI_SURFACE`、`FOUNDATION_PRIMITIVE`、线框控件行、§1.1 第 7/9 行、§1.4 行改成 bounded + 表头临时排序,与 IA 和详设逐字一致。
- **需 Dexter 裁决**:否(纯文档一致性;"该不该有搜索"已由 IA 与详设一致裁定为不该有)。

### S-1 · IA 的不可见维度没有一个写成可执行观察;`emptyLoadingErrorStates` 与 `collectionShapeAndScale` 两个维度整体缺失

- **位置**:IA `## 2. 十一个 IA-ID 九维度` 及其下 11 个 `### IA-` 小节
- **实测**:IA 全文 `[静态]` / `[acceptance]` / `[组件 test]` / `[浏览器]` 证据档位标注**命中 0**;维度名 `collectionShapeAndScale` / `emptyLoadingErrorStates` / `forbiddenUI` 命中 **0**。11 个 IA-ID 一律只写 9 个维度,标题自称也是「九维度」。
- **违反哪一条**:`ia-design-template.md` §2 ——「维度(分可见/不可见两组;**每个 IA-ID 逐项填写,不得省略**)」共 12 项;§2.2 ——「不可见维度**必须写成一个能做的观察**,属性式描述一律不接受」「**每个观察句必须声明它在哪一档证据上执行**,并选能证伪它的最低档」。模板给的 ❌ 范例是 `stateAndPermission=读按 role node scope`,IA-P1 写的是 `stateAndPermission=platform session + owner recheck;无 operations capability;…` —— 同一形态。
- **⚠️ 不计为缺项的一个**:`forbiddenUI` 由 IA `### 1.3 通用禁止 UI` 集中承担。模板 §3 明确允许把「通用禁止 UI」写进共用信息架构规则,且 IA §1.3 的每一条都可被搜索证伪(token / `authorizationRef` 值 / `nodeRef` UUID / 原始 enum literal / 停用对象的删除按钮…)。**这一项没有问题。**
- **一个能打红的反例(`emptyLoadingErrorStates` 被临场发明,已实测)**:实现渲染出 13 条空态/加载/失败文案,逐条拿去四份设计文档搜索,**命中数全部为 0**:

  `暂无经营渠道模板` · `暂无门店可接入经营渠道模板` · `当前没有可选的渠道模板` · `当前模板没有可用于绑定的外部接入档案` · `渠道模板读取失败` · `经营渠道读取失败` · `门店渠道模板读取失败` · `外部系统接入配置读取失败` · `绑定关系读取失败` · `请先选择项目数据节点` · `请先选择门店数据节点` · `业务节点名称暂不可用` · `外部接入档案名称暂时无法获取`

  反向验证:交互工件 P1 声明的 `暂无外部系统` 是**唯一**被实现的一条(`ExternalCollaborationPage.tsx` 锚点 `<Empty description="暂无外部系统"`)。**一条写了的落地了,十三条没写的被现场发明** —— 这正是模板那句「⚠️ 不写就会被临场发明」。
- **最小修复**:给 11 个 IA-ID 各补 `emptyLoadingErrorStates` 与 `collectionShapeAndScale`;不可见维度改写成带档位标注的观察句。
- **需 Dexter 裁决**:否(文案本身可由作者按 corpus 定;若某条空态文案涉及业务称谓歧义再单提)。

### S-2 · 交互工件缺三个 screen、一个 IA-ID 无对应、一个已声明的确认 Modal 既无线框也无实现

- **位置**:交互工件 `## 1.2 逐 screen 九维度` 下 12 个 `### Screen` · IA `IA_SCOPE=P1-P6 + O1-O5`
- **实测全集(同族全扫)**:

  | 面 | 实现 surface | 交互工件 screen | 判定 |
  |---|---|---|---|
  | platform-admin | 6 个 `.tsx`(Page / SystemDetail / ProfileDetail / BindingList / BindingDetailDrawer / BindingFormDrawer) | P1–P6 六个 | **6/6 对上,该侧无问题** |
  | operations-admin | 9 个 `.tsx` | O1 / O1-T / O2 / O3 / O4 / O5 六个 | **3 个无 screen** |

  无 screen 的三个:`BusinessChannelCreateDrawer.tsx`(新建渠道表单)· `BusinessChannelEditDrawer.tsx`(编辑渠道表单)· `BusinessChannelBindingDrawer.tsx`(运营侧绑定维护抽屉)。其中编辑抽屉只在交互工件正文一句话里被提到(锚点 `O4 的“编辑”不在详情内容区域内嵌表单`),没有 screen id、没有九项声明、没有线框、没有 `USER_VISIBLE_COPY`。
- **另一半**:`### Screen O1-T`(渠道模板详情抽屉)在 IA 里**没有对应的 IA-ID** —— `IA_SCOPE` 是 `P1-P6 + O1-O5`,11 个。
- **违反哪一条**:`ui-interaction-design-template.md` §1.1 ——「一个 `### Screen` 只能表达一种 `UI_SURFACE`。若 header 控件打开 Drawer/Modal,或内容页内有 Drawer/Modal/Tab,**宿主与被打开面必须拆成各自 screen id,各自提供线框、状态与上列声明**」;§1.2.1 ——「每个创建、编辑、凭据、状态/作废或集合替换 screen,必须先按**一个真实 command variant 一行**声明 `FORM_MUTATION_DENOMINATOR`,再给该 variant 的**每个 request fact 一行**」;`ia-design-template.md` §5「计数自证」与「IA ↔ 交互工件」
- **一个能打红的反例**:这三个抽屉渲染的 10 条校验提示 —— `请选择渠道模板` · `请输入渠道编码` · `请输入渠道名称` · `请输入模板名称` · `请输入模板编码` · `请选择到店点餐形式` · `请选择外部接入档案` · `请选择绑定节点类型` · `请选择绑定节点` · `请输入外部主体编号` —— 在四份文档中**命中数全部为 0**。IA 模板对 `controlType` 的警告是「⚠️ **编辑态最容易被偷工**,只读与编辑必须分别写」。
- **另一个反例(方向相反)**:IA `### IA-P2` 的 `controlType` 声明了「确认 Modal」。交互工件没有对应 screen(P2 线框直接画 `[保存状态]`),实现里 `Modal.confirm` / `<Modal` / `Popconfirm` 在两个 feature 目录中**零命中**。一个被声明的用户可见面,既没有线框也没有实现,而三份文档都自称已交叉对账。
- **需 Dexter 产品裁决**:**部分是** —— 「启停外部系统该不该有二次确认」是产品语义,我不代裁;文档层面的缺 screen 不需要裁决。

### S-3 · 六个 screen 的 `FOUNDATION_PRIMITIVE` 声明了非 foundation 的名字,其中两个是 app-local hook

- **位置**:交互工件 12 个 `### Screen` 的 `FOUNDATION_PRIMITIVE=` 行
- **违反哪一条**:`ui-interaction-design-template.md` §1.1 ——「每个名称**必须能在 `libraries/frontend/admin-ui-foundation/src/index.ts` 重新打开**」;「实际 import 集合与声明不等,或**以 app-local 机制重做已声明原语,均为 NO-GO**」
- **实测(逐名对照 `index.ts`,12 个 screen 全扫)**:

  | screen | 非 foundation 的名字 | 实际住址 |
  |---|---|---|
  | P1 · O1 · O5 | `WorkspaceScope` | foundation `src/` **全目录零命中** |
  | P2 | `Ant Design Table` | 第三方组件,不是 foundation export |
  | P6 | `usePlatformOrganizationCandidates` | `apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts` |
  | O2 | `useOrganizationCandidates` | `apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts` |

  **其余 6 个 screen(P3 · P4 · P5 · O1-T · O3 · O4)的每个名字都能在 `index.ts` 打开,已逐名核对。**
- **一个能打红的反例**:P6 与 O2 各自声明的候选 hook 是**两个 app 里的两份 app-local 实现**,正是模板那句 NO-GO 的字面情形;而 `WorkspaceScope` 出现在三个 screen 上,连 foundation 源码目录里都不存在这个符号。
- **最小修复**:三处 `WorkspaceScope` 改写成它真实的 owner 路径或删除;`Ant Design Table` 按模板改成 `NONE_WITH_REASON:<理由>`;两个候选 hook 标为 app-local 并写明**为什么不回 foundation** —— 前端规范 §3-F 的判别口径是「目的地要新造、且只有 1–2 个调用点 ⇒ 不抽」,这个理由要写出来,不能靠误标成 foundation 掩盖过去。
- **需 Dexter 裁决**:否。

### S-7 · 交互工件缺三张模板强制表:surface ownership 自检表、状态与边界表、可见操作分母表

- **位置**:交互工件全文
- **违反哪一条**:
  - `ui-interaction-design-template.md` §1.1「**Surface ownership 自检(每个线框强制)**」表 —— 交互工件零命中
  - 同模板 §5「状态与边界表」(屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | **timeout/unknown** | owner/face 边界)—— 交互工件 §1.5 是**逐控件**的表单依赖表,不是逐 screen/动作的状态表;全文 `timeout` / `超时` **零命中**
  - 同模板 §6「**可见操作分母(强制)**」——「每一个线框、`USER_VISIBLE_COPY` 或状态表中出现的按钮、文字链接、行点击、Select 变更、Tab、菜单项、刷新/重试和确认/取消,**都必须逐项在下表拥有一行,并回指批准 Journey 的原始 anchor**」。交互工件 §1.8 是 **5 条散文 bullet**,不是表,且没有一条回指 Journey anchor。线框里可数出的括号控件就有 26 个(编辑×3、新建渠道×3、关闭×3、停用×3、查询×2、重置×2、取消×2、保存×2、新建模板、新建绑定、维护绑定、删除绑定、保存状态、三个搜索框、若干 Select),另加 Tab 切换、树节点展开/选择、首列行点击。
- **能打红的反例(surface ownership 表本来会抓到的三条)**:
  1. `### Screen O1` 的线框把 `### Screen O3` 的「项目主体经营渠道」标题、5 列表头与 `[新建渠道]` 一起画进了 O1 —— 模板明写「相邻内容页不得画进该 screen;应由自己的 screen id 单独画出」。
  2. `### Screen O5` 的 `USER_VISIBLE_COPY` 声明了「可选门店模板」,而 O5 线框里**只有一张渠道表,没有模板表** —— 模板的判据是「任何 `USER_VISIBLE_COPY` 没有实际呈现位置,均为 `REVISE`,不得交 Dexter 看图」。实现里这张表确实存在(`StoreBusinessChannelPage.tsx` 表格列 `模板名称/模板编码/接入类型/订单类型`),标题是**四份文档中零命中**的「门店可接入经营渠道模板」。
  3. `### Screen O4` 的线框画了「绑定状态 有效」,而 O4 的 `USER_VISIBLE_COPY` 没有「绑定状态」这一项。
- **需 Dexter 裁决**:否。

### N-1 · 计数自证三处不符

- IA `## 3. 错误语义与界面映射(**15 个** typed problem 全量)` vs 该表实际 **16 行** vs IA §4 `TYPED_PROBLEMS=16 total` —— 标题与另外两处差 1。
- 交互工件 §1.10 正文「低保真文字线框已覆盖**十一个** surface」vs 实际 **12 个** `### Screen`。
- 违反 `ia-design-template.md` §5「计数自证:文中自称的 IA-ID 个数 = 实际小节数」· `implementation-design-template.md` §14「计数自证:文中自称的数字 = 实际条数(**先跑搜索再写**)」。
- **反向核对,这三处没问题**:IA「十一个 IA-ID」= 11 个 `### IA-` 小节 ✓;详设 §8「34 条 BR」= 34 行 ✓;详设 §7.1 `CURRENT_SOURCE_COUNT=44` 的 7 个分项相加 = 44 ✓。

### N-2 · `UI_SURFACE` 用了模板枚举外的复合描述

- P2 `内容页右侧详情面板` · P4 `内容 Tab 内的标准分页表格` · O1-T `标准只读详情 Drawer` · O3 `内容页下半区的标准分页表格`。
- 模板枚举是 `独立页面 | 内容页 | 内容 Tab | Drawer | Modal | Popover | Header 控件 | 侧栏底部控件 | 表单控件`,并明写「『当前页面』『弹窗』**不是合法形态说明**」。
- 其余 8 个 screen 用的是合法枚举值,已核对。

---

## 4 · L3_UNVERIFIED

```text
L3_UNVERIFIED=非空(5 条)
```

以下用户可见/行为事实,本轮**无人验证**,不得当作已证:

1. **两个 admin 的实际渲染**:所有渲染事实来自静态提取 `.tsx`,**未跑浏览器 L2 / DEV**。`ExternalSystemDetail` 的能力卡片与「属性/当前值/说明」三列表格在真实布局下是否如线框所示,未看过。
2. **IA 各 screen 的 `navigationAndRefresh`**(「成功后只刷新哪张表、哪些不发请求」):未验。这是 pitfall `invisible-dimension-drifts-at-implementation` 点名会走偏的三个维度之一,本轮既没有 IA 观察句可依,也没有运行证据。
3. **后端 owner 的 grant / CAS / 跨 owner 事务真实行为**:我只打开了 `BusinessChannelOwnerService` 的两段 bounded read。`OPERATIONS_OWNER_SCOPE_GRANT` 是否在每个写入口 CAS 前真的复核,**未验**(详设 5.3a 是声称,不是行为 —— charter §4)。
4. **backend acceptance 16 条场景的实际断言强度**:两个 `*AcceptanceScenarios.java` 已在仓内(9 + 7),但本轮**未运行** `scripts/test/backend-acceptance`(需容器,且本轮未授权动态执行),也未逐条打开断言体。详设 §7.2 表格里的 `businessOracle` 文字是声称。
5. **文案对账的分母**:我对 17 条实现文案 + 交互工件 12 个 screen 的声明做了双向搜索,**不是全集**。四份文档与 17 个 `.tsx` 的逐字全量对账没有做完。

> 按 `review-standard.md` §1 动作 5,`L3_UNVERIFIED` 非空时不得给出裸 `GO`。本轮 VERDICT 是 `NO-GO`,比该约束更强 —— 但该条的字面写法有问题,见 `DESIGN_GAPS-2`。

---

## 5 · 明确没问题的(不凑数)

以下逐项亲验过,**符合规范,不构成 finding**:

1. **前端规范 §3-I(列表首列是业务名称且可点进详情)** —— IA-O1/O3、交互工件 O1/O3/O5/P4 都把业务名称放首列、编码放次列;实测 `BusinessChannelList.tsx` 首列 `渠道名称<-channelName`、`ProjectBusinessChannelPage.tsx` 模板表首列 `模板名称<-templateName`、`OwnerBindingList.tsx` 首列 `绑定名称<-bindingDisplayName`。**这一条是 2026-08-20 从本批的旧缺陷里裁出来的,现在设计与实现都改对了。**
2. **前端规范 §3-H / 后端规范 §2-G(浏览器路由不是数据 scope、不是授权依据)** —— IA-O1/O5 与交互工件 O1/O5 都明写「`projectRef`/`storeRef` 只存在于 owner API 请求与服务端授权复核,不作为浏览器路由 scope」;实测 `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx` 锚点 `routeSegment: 'business-channels/project' | 'business-channels/store'`,旧 UUID 路由只作重定向匹配。详设 5.3a 逐 operation 给了 `OPERATIONS_OWNER_SCOPE` resolver 与 `RED_OPERATIONS_SCOPE` 红夹具,§7.2 有 `business-channel.cross-node-read-authorization` 跨节点拒绝场景。**这是本批做得最完整的一条,四层(browser route / query context / API owner ref / edge recheck)职责分开写清楚了。**
3. **IA §1.3 通用禁止 UI 集中承担 `forbiddenUI`** —— 模板 §3 允许,且每条可被搜索证伪。**不计缺项。**
4. **详设 §0.2 方案比较** —— 三个方案 A/B/C + 一句「我选了 C,而不是 A/B,因为…」,另有 4 个 CP 各带一句形态理由(「我选了 X 而不是 Y,因为 Z」)。**完全符合 `implementation-design-template.md` §1.2,是四份文档里最扎实的一节。**
5. **前端规范 §3-B / §3-E / §3-G 在实现里没有被违反** —— 尽管详设缺了点名它们的那张表(M-3),实测两个 feature `currentData` 4 处、`isFetching` 3 处、`isLoading` **0 处**;`useDrawerFormLifecycle({idempotencyKey: true})` 配 `markBusinessIntentChanged()` 成套出现在 5 个抽屉;状态流转用内容派生键。**这三条我不写成 finding。**
6. **详设 §8 业务规则 → owner 判定点** —— 34 行,与自称一致,BR-33 缺号有显式声明,一条不漏。
7. **P4(绑定关系列表)的 Page 形态** —— IA / 交互工件 / 详设 / 实现四方一致(真实服务端 `queryText/page/pageSize` + `metadata.total`)。**M-1 只发生在 O 侧,不发生在 P 侧。**

---

## 6 · SAME_ROOT_SCAN

每条 finding 的本批全集与逐个判定:

| finding | 全集 | 判定 |
|---|---|---|
| **M-1** 集合形态矛盾 | 本批 6 个用户可见列表面:P4 · O1 模板表 · O1/O3 渠道表 · O5 模板表 · O5 渠道表 | O1 / O3 / O5(4 张表)命中;**P4 四方一致,不命中**。交互工件内 4 处独立表述(screen 声明 / 线框 / §1.1 / §1.4)全部要改,其余已核对 |
| **M-2** Bounded 上界 | 4 条 bounded read:项目模板 / 项目渠道 / 门店模板候选 / 门店渠道 | **4/4 全部缺上界来源与预期规模**。Page 形态的 P4 与 cursor 形态的两条候选不适用,已逐条排除 |
| **M-3** §3 机制表 | 模板固定 17 行 | 表整体缺失。逐行判:名称呈现**已证坏**;RTK 读取 / 幂等键 / 同一事实**实测未坏**;缓存失效 / 日志脱敏 / 迁移回填 / 原子组**无人守且无证据**;其余在正文散落覆盖 |
| **S-1** 不可见维度 | 11 个 IA-ID × 5 个不可见维度 = 55 格 | 证据档位标注 **0/55**;`collectionShapeAndScale` 与 `emptyLoadingErrorStates` **0/11**;`forbiddenUI` 由 §1.3 集中承担,**11/11 已覆盖,不计** |
| **S-2** 缺 screen | 实现 15 个 surface(platform 6 + operations 9) | platform **6/6 有 screen**;operations **6/9 有**,缺 Create / Edit / Binding 三个抽屉。另 O1-T 有 screen 无 IA-ID;IA-P2 的确认 Modal 有声明无 screen无实现 |
| **S-3** FOUNDATION_PRIMITIVE | 12 个 screen | **6 个命中**(P1 · P2 · P6 · O1 · O2 · O5);**其余 6 个(P3 · P4 · P5 · O1-T · O3 · O4)逐名可在 `index.ts` 打开,已核对** |
| **S-4** CP 编号 | 详设 6 个 CP + 串行计划 10 个 CP | CP-01 语义相近但范围不同;**CP-02 / CP-03 / CP-04 / CP-05 / CP-06 五个 id 在两份文档里指不同的东西**;CP-00 / CP-07 / CP-08 / CP-09 只在串行计划存在 |
| **S-5** 指令冲突 | 本批授权类声明 3 处 + UI 准入门声明 3 处 | DEV:串行计划禁 / 详设未禁且已执行 —— **冲突**;seed · reset · L2 · UAT 两份一致 —— 不命中。视觉准入:CP-00 说不再是门 / CP-05 · CP-06 说是门 —— **冲突** |
| **S-6** 假门 | 详设 §12 列出的 9 条命令 | 只对 `ui-wireframe-traceability` 打开了实现并 fresh 跑过,判定为存在性假门;**其余 8 条本轮未逐条打开,标 `UNVERIFIED_REQUIRES_EVIDENCE`,不宣称它们没问题** |
| **S-7** 缺表 | 模板强制的 8 张表/节 | surface ownership 自检 · §5 状态与边界 · §6 可见操作分母 **三张缺**;§1.2 控件依赖(§1.5 部分覆盖,缺"可选项约束"列)· §1.3 搜索分母(§1.4 覆盖,缺 4 列)· §1.2.1 mutation 矩阵(§1.7 是"摘要",缺逐 fact 行与 3 列)**三张不完整**;§3 v2 盘点(§1.3)· §7 face/owner(§1.9)**两张完整**。§8 Manifest B.4/B.5 见 `DESIGN_GAPS-3`,**不计** |
| **S-8** 矩阵机制行 | 模板列出 5 类机制行 | 授权执行点 ✓ · 错误映射 △(缺注册处类路径)· 集合形态 ✗ · 缓存失效 ✗ · 日志与脱敏 ✗ |
| **S-9** 缺节 | 模板 15 个必填节 | 10 个有(其中 2 个不完整)· 5 个缺(§3 · §9 · §9b · §10 · §14);CP 门控 **5/6** |
| **N-1** 计数 | 文中自称的数字 6 处 | 3 处不符(15 vs 16 · 十一个 vs 12 个 screen)· **3 处相符(11 个 IA-ID · 34 条 BR · 44 条 source count),已逐个数过** |
| **N-2** UI_SURFACE 枚举 | 12 个 screen | **4 个越界**(P2 · P4 · O1-T · O3)· 8 个合法 |

---

## 7 · DESIGN_GAPS(正本里缺判据的条目,交回设计侧;⛔ 未在本文就地立规则)

1. **`review-standard.md` §1 动作 1 没有文档评审的形态,也没有"双向对账"的要求。**
   现文只给了一个面向 `apps/frontend/*/src/features/<FEATURE>/ui/*.tsx` 的脚本。被审对象是**设计文档**时该怎么做,正本没说;
   而当设计文档对应的代码**已经存在**时(本批就是),必须**两个方向都跑** —— 只跑「代码→文档」会漏掉"声明了没实现"(本批 2 例),只跑「文档→代码」会漏掉"实现了没声明"(本批 17 例)。
   建议:动作 1 改写成「产出一张可见事实清单,来源可以是 `.tsx`、也可以是设计文档自身的声明;两侧都存在时必须双向对账」,脚本降为其中一种取法。

2. **`review-standard.md` §1 动作 5 的措辞在字面上排除了 `NO-GO`。**
   原文:「`L3_UNVERIFIED=<空 / 逐条列出>` ← 非空时 VERDICT **只能是** `GO_WITH_UNVERIFIED_UI`」。
   按字面,只要有未验证项就不能给 `NO-GO`,这显然不是本意。§1 动作 5 的另一处写的是「`L3_UNVERIFIED` 非空**强制** `GO_WITH_UNVERIFIED_UI`,never a bare `GO`」——后一句才对。
   建议:统一成「`L3_UNVERIFIED` 非空时**不得给出裸 `GO`**」。

3. **`ui-interaction-design-template.md` §8 与 `CLAUDE.md` 冲突。**
   模板 §8 仍强制「Manifest B.4/B.5 命中对照」,并写「不适用时写明理由,不得以『未填写』假装不适用」;
   而 `CLAUDE.md` 明令 manifest Part B/C/D 属**已退役** compliance-control,「Claude 不得将它们列为评审输入、finding 或 GO/NO-GO 条件」。
   本轮按 review-standard §0「冲突时更高/更具体的那份优先,并把冲突本身记为 finding」处置:**交互工件缺 §8 不计为本批 finding**,冲突记在这里。建议删掉模板 §8。

4. **没有任何正本规定"同一批设计文档之间的 CP/步骤编号必须唯一且一致"。**
   S-4 的判据是我从 charter §7-A / §5-A 推出来的,不是直接条文。这类跨文档标识符碰撞会反复发生。
   建议进 `implementation-design-template.md` §2:「CP 编号是本批的唯一标识;串行计划、evidence、派活话术只能引用同一套编号,不得另起一套」。

5. **两份模板的 `DEXTER_WIREFRAME_REVIEW` 枚举互相不一致,且都缺一个合法值。**
   `ia-design-template.md` §1 写 `<UNSET | ACCEPTED@日期>`;`ui-interaction-design-template.md` §1 写 `UNSET | ACCEPTED | REVISE`。
   两者都没有"Dexter 裁定按文字描述实施、不再另行看图"这个状态,于是本批被迫自造了 `ACCEPTED_TEXTUAL_DESCRIPTION`(三份文档 5 处)。
   这不是作者失误,是枚举缺一个值。建议两份模板统一,并加 `ACCEPTED_TEXTUAL@日期`。

6. **「不得从 enum literal 反推用户可见文案」这条规则在前端规范里没有住址。**
   `review-standard.md` §1 动作 2 的对账表把「前端自造枚举文案」的判据住址指向 `frontend-coding-standard.md`,
   但实测(`枚举` / `enum` / `文案` 三种写法穷举该文件)**该规则不在里面**;它目前只住在**本批详设 §2.2a**。
   后果就是本条 M-3 的样子:规则在一份批次文档里,下一批没人读得到,而它已经有 8 个现成反例
   (`ExternalSystemDetail.tsx` 2 处 · `ProviderProfileDetail.tsx` · `ExternalCollaborationPage.tsx` ·
   `BusinessChannelCreateDrawer.tsx` · `BusinessChannelDetailDrawer.tsx` · `BusinessChannelTemplateDetailDrawer.tsx` ·
   `OwnerBindingDetailDrawer.tsx`)。
   按前端规范 §7「新规则由实例产生,写在修完之后」「每条规则必须有反例」,反例已经够了。
   建议进 `frontend-coding-standard.md` §3;⛔ **不在本评审里立**。

---

## 8 · EVIDENCE_TIER

```text
EVIDENCE_TIER=静态读源码 + 机械提取 + 本会话 fresh 跑 1 条既有门
```

- **本会话 fresh 执行的**:`./scripts/check/ui-wireframe-traceability`(`EXIT=0`,输出 `R4_UI_WIREFRAME_TRACEABILITY=PASS`);对 17 个 `.tsx` 跑 `review-standard.md` §1 动作 1 的原样提取脚本;对四份文档与两个 feature 目录跑的全部计数与字符串对账(每条断言前都先跑了搜索)。
- **打开读过的源码**:`libraries/frontend/admin-ui-foundation/src/index.ts` · `tools/verify-gates/cli.mjs` 的 `traceability` 函数 · `BusinessChannelOwnerService.java` 的两段 bounded read · `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx` 的路由段 · 两个 feature 目录 17 个 `.tsx` 的提取结果。
- **未执行**:编译 · `scripts/verify` · `scripts/test/backend-acceptance` · 任何 reset / seed / DEV / L2 / UAT / Git 动作。
- **未提升档位**:所有"实现里是这样"的陈述都基于静态源码读取,**不等于运行时行为**(charter §4)。凡涉及运行时的判断已进 `L3_UNVERIFIED`。
- **会话出处**:fresh v2s-rooted 独立子 agent 会话,非续接;未先读既有 review 结论再反推 —— `doc/review/platform/` 下 2026-08-19 / 2026-08-20 的既有评审文档在本轮**完全没有打开**,结论全部从规范正本独立推导后再与被审文档对照。
- **写入边界**:本会话只写了本文件一处,仓内其余路径只读。

---

## 9 · 处置建议

按 `CLAUDE.md` 的 findings 处置约定,以下直接交 Codex 在既有批准边界内自主修复,不构成再授权门槛:
M-1 · M-3 · S-1 · S-2(文档层)· S-3 · S-4 · S-6 · S-7 · S-8 · S-9 · N-1 · N-2。

以下需 Dexter 单独裁决,裁决前不应收口:

- **M-2**:一个项目预期有多少条经营渠道?这决定 `BOUNDED_READ_LIMIT = 100` 是否正确,以及 O1/O3/O5 的形态是否应从 Bounded 改成 Page。
- **S-5**:本批 DEV 到底授不授权 —— 串行计划禁、详设未禁且记录已执行,两份文档互相否定,只有 Dexter 能定哪一份算数。
- **S-2 的一半**:外部系统/接入档案的启停,产品上该不该有二次确认 Modal(IA 声明了,交互工件没画,实现里没有)。

`DESIGN_GAPS` 五条交回设计侧补进各自正本,**不在本文立规则**。

---

## 10 · 机制本身可不可靠(按 `review-standard.md` + `cs-review` 走完一遍之后的诚实回答)

### 10.1 真的帮我找到问题的动作

| 动作 | 找到了什么 | 为什么起作用 |
|---|---|---|
| **动作 1(提取)** | 17 条无人声明的文案 · 8 处前端自造枚举文案(⚠️ 这是脚本那一种三元式写法的命中数,是**下界不是全集**)· 3 个无 screen 的抽屉 · 每张表的真实列集 | **它是本轮唯一一个"我不必事先知道要找什么"的动作。** 其余动作都要我先有假设;这一个是先出事实、再看事实往哪撞。M-3 的名称呈现、S-1 的空态、S-2 的缺 screen 三条全部出自它,而且三条我事先都没想到 |
| **动作 3(同族全集)** | 把 S-3 从"P6 写错了"变成"12 个 screen 里 6 个命中、其余 6 个已核对";把 M-1 从"O3 有问题"变成"O 侧 4 张表命中、P4 不命中" | 它逼我**先数再说**。而且好几次结论被它反转:我原以为"FOUNDATION_PRIMITIVE 普遍乱写",全扫后发现一半是干净的;原以为"缺 screen 是通病",全扫后发现 platform-admin **6/6 全有**,只有 operations-admin 缺 3 个 |
| **动作 4(未验证清单)** | 逼我承认后端 grant/CAS、acceptance 断言体、渲染布局全都没验 | 没有这一栏,我会把"读了 5.3a 那张表"写成"授权已验" —— 那正是 charter §4 的声称≠行为 |
| **判据回正本取** | M-2 的三重判据(charter §1-J + IA 模板 §2.2 + 详设模板 §5)、S-2 的模板原文 | 见 10.2 |

### 10.2 判据回正本取,这个分层顺不顺

**大部分时候顺,而且比我预期的更有用。** 具体好处有两个,都不是"少写点字":

1. **同一条判据在三本正本里被说了三遍,这个冗余本身是信号。** M-2 的"预期规模写不出来就是形态没定"同时出现在 charter §1-J、IA 模板 §2.2、详设模板 §5,三处措辞不同但指向同一件事。三本都写了而四份文档一处都没有 —— 这个对比比任何一本单独说都有力。如果判据被复制进评审正本,我读到的就只有一份措辞,拿不到这个信号。
2. **它挡住了我就地立规则。** 我至少有两次想直接写"CP 编号应当跨文档唯一""设计文档应当声明空态文案"。前一条查遍五处确实没有正本 ⇒ 按 §2 进了 `DESIGN_GAPS`;后一条查到 IA 模板 `emptyLoadingErrorStates` 已经有 ⇒ 直接引用。**没有这个分层,我会把两条都写成 finding,其中一条是我发明的。**

**三处不顺:**

- **正本之间自己冲突,而评审正本没说冲突怎么判。** §0 只写了"冲突时更具体的那份优先,并把冲突本身记为 finding"。但本轮真实的冲突是 `ui-interaction-design-template.md` §8 vs `CLAUDE.md`(manifest 已退役)——这不是"具体 vs 笼统",是**层级**冲突,`CLAUDE.md` 高于模板。我按层级处理了,但那是我自己补的规则,§0 的措辞不覆盖这种情况。
- **`cs-review` 的判据顺序和 `review-standard.md` §0 的表不完全同构。** skill 写的是「本批设计文档 → coding standard → charter → project-memory」;正本的表是按"要判的是什么"索引的。两者结论一样,但 skill 那份把 `doc/decisions/templates/` **漏掉了** —— 而本轮一半以上的 finding 判据出自模板。我是从正本 §0 的表里找到它的;只读 skill 会漏。
- **找不到判据的一次**:"设计文档里描述了一个面,但既没有线框也没有实现"该判多重?正本里没有严重度尺度,`M/S/N` 的定义在任何一本里都找不到。我按影响面自己定的档。

### 10.3 空转的动作 / 对文档评审不适用的

- **动作 1 的脚本本体,对纯文档评审是空转的。** 本轮它能跑,纯粹因为这批**已经实施了**(`@AcceptanceScenario` 60 = 44 + 16,17 个 `.tsx` 都在)。如果这批还没实施,`glob` 会返回空,动作 1 产出零行事实,而正本没有 fallback。**这不是"我适配了一下就好",是正本在这个场景确实没有内容。** 见 `DESIGN_GAPS-1`。
- **动作 2 的对账表有一行指错了住址。** 该行是「提取到的=前端自造枚举文案 | 对账对象=—— | 判据住址=`frontend-coding-standard.md`」。
  实测(换 `枚举` / `enum` / `文案` 三种写法穷举 `frontend-coding-standard.md`):该文件里**没有**"不得从 enum literal 反推用户可见文案"这条规则;最接近的是 §3-D 的仓内正例 `operationsProblemFeedback.ts`(对生成的 problem code 闭集做全量文案覆盖),那是 problem code 的正例,不是通用枚举显示名的禁止句。
  本轮这条的真实判据住在**本批详设 §2.2a**(「不得从 enum literal 临时反推」「不新增第二份前端 enum-label 字典」)。所以动作 2 把我指去了一个没有该判据的正本,我是靠读详设自己找到的。
  ⇒ 要么前端规范补这条规则(它有现成反例:本批 8 处),要么动作 2 那一行的住址改成"本批详设"。
- **§3「三层的分工」那张表,对本轮没有产生任何判断。** 它是解释性的,不是可执行的。读它不亏,但它不是动作。

### 10.4 正本里最该改的三条(已进 `DESIGN_GAPS`,这里只说优先级)

1. **动作 1 必须写成"产出可见事实清单",而不是"跑这个脚本"。**(`DESIGN_GAPS-1`)
   顺带把"两侧都存在时必须**双向**对账"写进去 —— 本轮两个方向各抓到一类问题,少跑一个方向就漏一半。
2. **动作 5 的 `L3_UNVERIFIED` 措辞是错的,字面上禁止了 `NO-GO`。**(`DESIGN_GAPS-2`)
   这条会误导人:一个尽职的评审者有未验证项时,按字面只能给 `GO_WITH_UNVERIFIED_UI`,哪怕他手里有 3 条 M。
3. **`cs-review` skill 的判据清单漏了 `doc/decisions/templates/`。**
   skill 是入口,多数人只读它。本轮 finding 里 M-1 · S-1 · S-2 · S-3 · S-7 · S-8 · S-9 · N-1 · N-2 —— **九条的判据都在模板里**。

### 10.5 一句总结

**机制可靠,但它的可靠性几乎全部来自动作 1 和动作 3 这两条"先出事实/先数一遍"的硬约束,以及"判据不在评审正本里"这条分层。**
其余部分(§3 的分层解释、动作 2 的对账表)是脚手架,不产生判断。
最大的一处不可靠是:**动作 1 假定被审对象是代码**。本轮侥幸能跑,是因为这批已经实施了;换一批只有设计文档的,这个机制最有效的一条会静默地产出零行,而流程不会报错 —— 这正是 `foundation-charter.md` §6-A 说的"反例栏写不出『无』以外的东西,这道门就是纸糊的"。这一条现在能写出反例了。
