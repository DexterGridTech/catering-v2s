# 销售菜单 implementation-facing DESIGN 评审(Claude 外部独立)

```text
REVIEW_TARGET=DESIGN
VERDICT=GO
M/S/N=0/2/1
EVIDENCE_TIER=STATIC_DESIGN
```

**会话出处**:fresh v2s-rooted。按要求**先独立核验并形成初步 verdict,再读两轮 review 与作者 intake**。
**动态证据边界**:Testcontainers、browser L2、DEV reset/seed、UAT、部署**均未运行**,本文全部结论为静态。
**利益边界**:需求稿由我撰写,对其不构成独立评审;本轮被审对象是 IA、交互、详设与实施计划,那部分是独立的。

---

## 结论

**GO。** 这份详设的质量明显高于本仓此前几批。我独立复算的五个分母全部吻合,
业务规则对需求与 Dexter 裁定的还原忠实,并且**它自己挖出了两个真实的仓内缺口**(见下)。

两条 S 都是"补一样东西"而非"改错了",不影响设计成立,但应在实施开始前补上。

---

## 独立复算(先于读两轮 review)

| 声明 | 我的复算 | 结论 |
| --- | --- | --- |
| 31 operations | 表内编号行 31,operationId 去重 31 | ✅ |
| 19 commands | 12 个 `get*` + 19 个写 = 31 | ✅ |
| 38 owner rules | `SM-nn` 去重 38 | ✅ |
| 15 acceptance(13+1+1) | `sales-menu.*` 13 + `business-channel.sales-menu-eligible-cursor` + `asset.sales-menu-image-lifecycle` | ✅ |
| 16 L2 cases | `sales-menu-*` 去重 16 | ✅ |

⚠️ 我第一次按 `sales-menu.` 前缀数得 13,以为与自报 15 不符;
**是我的探针窄了**,表内另有两条跨模块场景。已更正。

## 业务规则的还原度(逐条亲验)

- **范围强制**:`SM-02 requireSalesMenuChannel` 要求 targetNodeType=STORE、accessKind=INTERNAL、
  orderKind∈{DINE_IN,TAKEAWAY};第 318 行给出 typed problem `SALES_MENU_CHANNEL_INELIGIBLE` 422,
  文案明说"当前只处理门店内部堂食/外带入口"。✅
- **多菜单**:第 355 行「list 返回多个 activation,**不返回 selected/effective-one 字段**」;
  第 207 行「多菜单可同时 enabled,不做互斥」;第 524 行 DB「不设 channel 唯一」。
  **完全落实 D-01「菜单域不解析现在生效哪一份」。** ✅
- **两个可售维度**:第 365 行库存维度「Inventory set-read → 原样独立呈现;**menu DB 不存**」,
  第 492 行「只派生」;第 198 行两次独立 set-read。**派生不存储、两维度不合并,忠实 D-03/D-04。** ✅
  第 35 行还把"两者被合并导致用户分不清该找谁恢复"列为本批要解决的问题,理解到位。
- **copy 边界**:SM-19/SM-20 精确 —— 只复制 current draft 的定义与时段;
  不复制 published versions/publications、operation records、inventory facts、manual status、source activation;
  新 activation disabled。✅
- **G-08**:第 319 行 `SALES_MENU_STORE_DISABLED` 422「**仅发布阻断;编辑、保存、复制不阻断**」——
  这是对 G-08「停用阻断菜单发布」的精确读法,没有过度扩张。✅

## 设计自己挖出的两个真实缺口(我独立验证,均成立)

**一 · `edge-codegen.mjs` 的第二计数住址。**
`scripts/generate/edge-codegen.mjs` 第 24 行 `const canonicalOperationCount = 180;`,
第 49 行以 `R5_EDGE_BUDGET_OPERATION_COUNT` fail。新增 31 个 operation 必然触发。
详设第 258 行不止步于"把数字改掉",而是要求**删除该 JS 第二住址、改读 source catalog 的
`denominator.operations` 并双向校验**。实施计划把它排在 SM-01 §3.2,顺序正确。
`[推论]` 这是根因修复而非止血,评价为本批最有价值的判断之一。

**二 · seed 里没有任何菜单能挂的渠道。**
`scripts/dev/external-collaboration-business-channel-seed-plan.mjs` 第 69–71 行有三个
INTERNAL DINE_IN **模板**,但第 73 行起的三个 channel **实例**分别是
`CHANNEL-STORE-TAKEAWAY-MEITUAN`(EXTERNAL)、`CHANNEL-STORE-TAKEAWAY-ELEME`(EXTERNAL)、
`CHANNEL-STORE-GROUP-BUY-MEITUAN`。**INTERNAL DINE_IN/TAKEAWAY 实例数为零。**
详设第 584 行准确指出这点,并明令**不得把 EXTERNAL TAKEAWAY 改名冒充 INTERNAL**。
`[推论]` 这条如果漏了,acceptance 与 L2 会在无渠道可挂的环境上全绿或全红,两种都无意义。

**三 · 父编排的位置假设。**
`scripts/dev/r5-complete-seed-executor.mjs` 第 72 行 `const catalog = stages[1];`。
新增 stage 会静默绑错 validator。详设第 599 行要求退休两阶段数组与 `stages[1]` 假设、
改按 stage id 绑定四个 owner validator。**问题真实,修法正确。**

---

## Dexter 指定的五个重点

### 一 · 功能权限 —— ✅ 完全符合运营后台既有体系,且克制

`[仓内 实测]` `contracts/registry/iam-org-governance-manifest.json` 中**全部功能权限只有三个**:
`EDIT_HEAD_COMPANY_CATALOG`、`EDIT_STORE_CATALOG`、`EDIT_STORE_INVENTORY`。
**没有任何 `VIEW_*` 或 `MANAGE_*`。**

设计:**只新增一个 `EDIT_STORE_SALES_MENU`**,与 `EDIT_STORE_CATALOG`/`EDIT_STORE_INVENTORY` 同形;
**读侧零新增功能权限**,沿用 selected STORE 节点范围 + owner store judgment(第 78、114 行)。
`[推论]` 这是正确且克制的 —— 一份弱一点的设计会顺手加一个 `VIEW_STORE_SALES_MENU`,
而仓内根本没有这种前例。

写侧另有 `OWNER_RECHECK_SALES_MENU`,要求每条 command 在 receipt/CAS/audit **之前**
复核 workspace + STORE + capability + 实际 aggregate(第 79 行),
与 base-1 已确立的「决定授权的维度留在接口身份里」一致。

**图片两条 Asset command 的授权设计是全篇最扎实的一段**:
第 276 行 `SalesMenuAssetTarget` 只由 URL + owner readback 形成,
明写"不以 channel 或 ambient UI state 代替";第 278 行 release **body 不接受 store/menu/item/usage/status**;
第 286 行"body 无权覆盖 target";第 288 行两层复核(SalesMenu owner 判 URL 关系 →
Asset owner 复核 server-minted STORE grant、同一 target、usage/status)。
这正是 Round 2 的 F-M-201 所要的,**已彻底闭合**。

### 二 · 测试覆盖 —— ⚠️ 形态对,但缺可证伪的分母(见 S-2)

15 acceptance + 16 L2 + focused/static + 红夹具(§11.4)齐备;
场景按业务闭环而非按 route 机械生成,这与仓内 acceptance 标准一致,**形态正确**。
但**没有 operation → 场景的覆盖矩阵**,§11 的失败条件里也没有"某 operation 无场景"这一条。
详见 S-2。

### 三 · Seed 丰富度 —— ✅ 很丰富,且精准打在边界上

第 598 行新功能 seed 覆盖:两份门店内部渠道;**同入口至少两份同时 enabled menu**(打多菜单);
全天/每日时段;draft/published diff;copy 后 disabled;多真实 section;
**同一 section 21 items**(打 20+1 分页);**同商品重复项**(打"一个商品多个销售项");
五类中文 shape;SKU 逐项价;INHERIT/CUSTOM 图片;两个约束键与 weighted N/A;
**两个状态维度**;21 records。
`[推论]` 每一条业务规则都有对应种子,不是凑数量。第 599 行对既有 plan 的调整也诚实
(补真实 INTERNAL 实例、executor 从"静态报告"升级为真实 owner HTTP stage)。

### 四 · 重复造轮子 —— ✅ 未发现

前端引用 foundation 原语 **12 处**(`useCursorStack`、`CursorPagination`、`useDrawerFormLifecycle`、
`useSubmissionLifecycle`、`useOverlayLock`、`EllipsisTooltip`、`adminDrawerSurfaceProps` 等),
第 91 行明写"菜单图片编辑**只抽取业务适配,不复制 foundation 生命周期**"。
候选/分类树复用 Catalog owner 既有读能力,第 92 行明写"不复制 CatalogItem"。
`SalesMenuAssetCommandApi` 与既有 `CatalogAssetCommandApi` 并列 —— 后者本就是 catalog 专属
(`stageCatalogAsset` 等,带 `WorkspaceExecutionContext<CatalogAuthorizationScope>`),
**owner 授权作用域类型不同,并列是既有形态而非重复**。

### 五 · 项目习惯 —— ✅ 一处例外(S-1)

capability 命名、receipt/CAS/audit 顺序、cursor keyset + 禁 OFFSET/抽干/客户端 slice、
typed problem 命名、生成链单向、禁手改 generated —— 均合仓内习惯。
唯一不合的是 S-1 的引用问题。

---

## S-1 · 引用了一个不存在的 project-memory 决策

**等级** S · **仓内事实** · `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md` 第 78 行

该行把读侧节点授权的权威写为
`project-memory/decisions/workspace-page-entry-role-node-scope-authorization.md`。

**亲验:该文件不存在。** `project-memory/decisions/` 共 10 个文件,无同名者。
按我自己的纪律做了反向检索(换 `selected node`、`所选门店`、`页面入口`、`node scope`、
`节点范围授权` 等多种措辞),仅命中两个不相干文件,**均非该名称的决策**。

**同行引用的另一个前例是真的**:`requireScopedStore` 确实存在于
`OperationsBusinessChannelController.java` 第 420 行。

**影响面**:读侧授权**模型本身是对的**(我已对照 manifest 验证:仅三个 `EDIT_*`,无 `VIEW_*`),
所以这不是行为错误;但实施者被要求"复用"该决策时**无文件可开**,
且设计对"这是既有前例"的主张无法被独立验证。RECALL 清单里的失效条目会让后续对账落空。

**可证伪失败条件**:若 `project-memory/decisions/` 下确实存在该文件,则本条不成立。

**最小修复**:把该引用改为真实存在的出处 —— 要么指向
`OperationsBusinessChannelController` 的既有实现,要么指向 manifest 中"仅三个 `EDIT_*`、
无读侧 capability"这一可核事实;若确需一条 decisions 级正本,应先创建再引用。
**为什么更小的替代不足**:仅删除该引用会让读侧授权失去声明的权威来源,
而这恰是本批唯一不新增功能权限的地方,最需要可核依据。

**需要 Dexter 裁决**:否。

## S-2 · 测试覆盖缺可证伪的分母

**等级** S · **仓内事实(文档)** · 详设 §11(第 620 行起)

**亲验**:把表内 31 个 operationId 与 §11 全文比对,**31 个全部未在验收/L2 章节内被点名**。
场景以业务闭环命名(如 `sales-menu.ordered-sections-and-items`),
这与仓内 acceptance 标准一致、**形态正确**;但由此产生的后果是:
**没有任何东西能证明 31 个 operation 都被至少一条场景走到**。

§11 CP-03 的失败条件列了"只断言 2xx/Problem 形状""fixture 不超过一页""直接调 service"
"负向不证明未写"四条,**唯独没有"某个 operation 没有任何场景覆盖"**。

**影响面**:实施者可以写满 15 条业务闭环场景而恰好漏掉某个写操作
(例如 `moveOperationsSalesMenuSection` 或 `releaseOperationsSalesMenuStagedAsset`),
门与场景计数都会全绿。31 个 operation 的批次里,这个风险不小。

**可证伪失败条件**:补矩阵后,若存在任一 operationId 不出现在任何 acceptance 或 L2 case 的
覆盖列中,则覆盖不完整。当前**无法做此判定**。

**最小修复**:补一张 operationId → 覆盖它的 acceptance/L2 case 的矩阵(31 行),
并把"任一 operation 无覆盖即失败"加进 §11 的失败条件。
**为什么更小的替代不足**:改成按 route 逐条生成场景会破坏业务 oracle 的跨操作证明能力,
是更差的方案;矩阵是在保留现有场景形态的前提下补上分母的唯一方式。

**需要 Dexter 裁决**:否。

## N-1 · 两轮对抗审查的文件命名使评审台账归属不清

**等级** N · **治理/可追溯性**

`doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-claude.md` 与
`-round-2-claude.md` 的文件名主体以 `-claude` 结尾,但其内部声明
`reviewerKind=INDEPENDENT_SUBAGENT`,**不是我写的**。

`[仓内]` `-claude` 后缀在本仓的既有含义是"Claude 新建的文件"。
子 agent 复用该后缀后,**Dexter 无法从文件名判断某份 review 出自外部 Claude 还是 Codex 的内部子 agent**,
必须逐个打开看 `reviewerKind`。

**影响面**:仅影响评审台账的可读性,不影响本轮任何技术结论。
**最小修复**:子 agent 的 review 用可区分的后缀(如 `-subagent`),或在文件名中带轮次与角色。
**需要 Dexter 裁决**:是 —— 命名约定归他。

---

## 两轮 review 治理判断

`[仓内 实测]` 两份 review 均声明 `reviewerKind=INDEPENDENT_SUBAGENT` 与 `blindReviewDeclaration`;
Round 2 由**该轮子 agent 自己**写入 `ROUND_FINAL_DECISION=SELF_DECIDED`,
符合 `independent-subagent-adversarial-review` 治理对两轮上限与 SELF_DECIDED 写入方的要求。
**未见作者自审替代子 agent,未见换 reviewer 或局部修订重置轮次。**

**Round 2 两条 M 我已在当前字节验证均真实闭合**:
F-M-201(Asset target 复核契约)由第 276/278/286/288 行的完整 target + 两层复核闭合;
F-M-202(channel/menu/candidate 的"全部"与 cursor 矛盾)由 IA 第 86–95 行的可达性澄清
与详设第 229–233 行四处显式 `CursorPagination` 闭合,并给出 21 项可观察判据。

**本文是该 cycle 之后的独立外部 review,不替代那两轮,也不重置轮次上限。**

---

## 方案合理性

**问题对不对**:是。第 33–35 行列的四个问题(菜单被当成商品的附属、发布与生效混淆、
多菜单被压成唯一当前菜单、两个可售维度被合并)都是真实且已被 v4 验证过的痛点。

**方案优不优**:详设第 45–49 行列了 A/B/C/D 四个候选并说明为何选 C,
其中 B(页面实时拼菜单)的否决理由"无法证明发布冻结,把有效销售视图变成现场推导"判断准确。
**替代方案是被比较过的,不是事后合理化。**

**代价配不配**:31 个 operation 对一个从零起的域不算多 —— 12 读中 6 个是 draft/published 镜像,
由 G-11 的"草稿可改、发布冻结"直接推出;19 写对应 IA 的具体用户动作。
**未见为未来需求预留的抽象。** 后置项(合同货号、门店编辑策略、入口动作能力、
独立展示策略、整单/桌台约束、外部三路径)在详设中保持后置,**范围没有在详设阶段悄悄长回来**。

**UI 合理性**:IA 的"全部"被定义为"用户能沿显式控件到达每一项,不是后台自动抽干"(第 88 行),
并给出 21 项的可执行观察(第 95、143 行);七套 Cursor 各自独立页栈与清栈条件明确;
禁自动抽干/OFFSET/客户端 slice/总数/任意跳页。
`[推论]` 这是把 v4「只加载第一份菜单」「本地乐观排序不以服务端读回为准」两条教训落到了判据上。

---

## 动态证据边界

**本轮全部结论为静态。** Testcontainers、browser L2、DEV reset/seed、UAT、部署**均未运行**,
详设自身也声明这些以后续动态授权为前提(第 134、645 行)。
15 acceptance、16 L2、seed 各项目前**仅为设计承诺,无运行证据**;
S-2 的覆盖判定在补出矩阵后仍需一次真实运行才能确认。

`[仓内]` 已确认 design-granularity manifest/check 属已退役控制面,本文未将其列为输入或条件。

---

## 授权边界

本文只是外部独立 DESIGN review。`GO` 表示当前 implementation-facing 设计**可以进入
由 Dexter 单独指派的实施**,两条 S 应在实施开始前补上。
**不授权**生产实现、契约生成物写入、Testcontainers、browser L2、DEV start/stop/reset/seed、
UAT、部署或任何其他外部动作。评审期间除本文外仓库只读。
N-1 的命名约定需 Dexter 裁决。
