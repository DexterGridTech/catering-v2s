# Final catalog contract / fixture-DAG design —— Claude POST_REMEDIATION_V1 定向静态复核

`VERDICT=GO`　`M=0`　`S=0`　`N=1`

**设计的两条核心结论我在三侧（OpenAPI / owner 源码 / 前端消费者）逐一独立证实，全部成立。**
delete 与 promotion 的偏离是真实存在的、且方向判断正确；replay 风险被诚实保留为实施必须证明的事项；
六条路径的集合是自洽的、不多不少。唯一的 N 是一个通用问题未登记，不阻断。

**本 GO 仅允许创建独立的静态 implementation package。**
不授权动态环境、DEV、seed/reset、Testcontainers、L2/UAT、部署、手工 SSH/SQL、RM1/R5 runtime 复用，
**也不构成任何 SQL 数值优化成功声明**。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。
所有 hash、分母、schema、源码行为均本会话独立复算，未采信自报值。

**上一轮我造成的残渣已清**：`.runtime/backend-performance/` 现为空目录，
`backend-performance-final-1234567891-abcdef12` 已不存在。谢谢处置。

---

## 1. 六项重点核验

### 1.1 POST_REMEDIATION 是否只修 stale anchor —— **是**

manifest 引用三处 anchor，我逐个验证其**唯一解析**：

| anchor | 命中 |
|---|---|
| `## Finite executable-DAG follow-on boundary` | 设计文档 `:30`，全文 **1 次** |
| `## Owner-contract correction delivery unit` | 设计文档 `:69`，全文 **1 次** |
| `export function CatalogItemDrawer` | tsx 中 **1 次** |

其余未扩大：
`status: PROPOSED_REVIEW_ONLY`、`implementationAuthority: False`、`authorization.scope: design-only`；
**surface 恰 6 条**（update 4 全 present / create 2 全 absent）；
design 与 authorization 的 sha256 我复算**均相符**。
`postRemediationDeclaration` 的 `reviewSha256` = round2 JSON 实际 sha **相符**，
`intake` sha **相符**；manifest 现字节 `331fe824…` ≠ 所审 `33c3d9c6…`，
并以 `currentBytesNotReviewedByAdversarialReviewer: true` + `claudeRecheckRequired: true` 如实标注。

`implementation-design-granularity` fresh 复跑：**`PASS`**，
`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，
`VERDICT=NO_GO`——**绑定的 Round 2 原始 NO_GO 未被改写。**

Round 1 / Round 2 均为 `INDEPENDENT_SUBAGENT`、`blindAfter=true`、
Round 2 为 `2/2` + `SELF_DECIDED`。
**两轮的 `.md` 原件与 `.json` 转写并存**——上一轮我提的"转写一律新增不覆盖"前向规则已落实，
覆盖原件的问题没有重演。

### 1.2 六条路径是否覆盖 owner → operations edge → grant/context → owner —— **是，且集合自洽**

| 路径 | 承担的环节 |
|---|---|
| `CatalogOwnerService.java` | owner 侧两处响应更正 + 显式 delete replay 策略 |
| `CatalogCategoryOwnerIntegrationTest.java` | owner subtree 响应与 replay/stale/reference 红验 |
| **新** `CatalogTemporaryPromotionOwnerIntegrationTest.java` | owner 侧 promotion 单层信封与 digest 一致性 |
| **新** `CatalogTemporaryPromotionEdgeIntegrationTest.java` | operations edge：selected-node / capability / grant / owner handoff |
| `CatalogItemDrawer.tsx` | 消费者改读 `response.data` |
| `CatalogManagementPage.test.tsx` | 消费者侧红验 |

**tsx 必须在集合内，这一点我是从源码证实的**（见 §1.3）：
UI 目前正在迁就 owner 的双层信封，owner 一改，UI 不改就会断。**六条不多不少。**

### 1.3 delete 与 promotion 的结论是否与 OpenAPI / owner / consumer 一致 —— **三侧全部证实**

**delete**：

- **OpenAPI**：`CatalogCategoryDeleteReadback.result` 为 `additionalProperties: false`，
  `required = [categoryRef, deletedSubtreeSize, deletedCategoryCodes]`；
- **owner `:926`**：`result` 实际是
  `.put("categoryRef", …).put("deletedCount", subtree.size())`
  —— **多出 schema 禁止的 `deletedCount`，且缺两个必填字段**；
- 可行性：`:918-919` 已持有 `subtree` 与 `locked`（`CategoryRow` 带 `code()`），
  `deletedSubtreeSize` 与 `deletedCategoryCodes` **无需新查询即可产出**。

**promotion preflight**：

- **OpenAPI** `TemporaryPromotionPreflight` = `{revision, requestId, data:{item,…}}`，
  **两层都 `additionalProperties: false`**——`data` 里再套 `{revision,requestId,data}` 直接违约；
- **owner `:986-987`**：先造 `model = {revision, requestId, data: detail}`，
  再 `envelope(requestId, model)`；而 `envelope`（`:1441`）本身就是
  `{revision, requestId, data:<arg>}` —— **实际产出 `data.data` 双层**；
- **consumer `CatalogItemDrawer.tsx:351`**：
  `(response as CatalogInventoryEnvelope<TemporaryPromotionPreflight>)?.data?.data`
  —— **UI 正在迁就这个双层**。

设计称其为"owner 实现缺陷，而非 OpenAPI 或产品能力缺陷"，**与三侧证据完全一致**。

### 1.4 IDEMPOTENT_SAME_KEY 是否被诚实保留 —— **是，而且处置比我预期的更严谨**

**事实核验**：catalog 中 `deleteOperationsCatalogCategory` 恰 **2 行**，
两行 `fixturePlan.replayPolicyId` **均为 `IDEMPOTENT_SAME_KEY`** —— 设计的事实陈述属实。

设计 `:76-80` 没有把它当已解决，而是列为**实施必须二选一并证明**的事项：
「safe same-key receipt after typed grant/context recheck」或「truthful `SAME_KEY_ONLY` policy」，
并加了一条硬约束：**「must never globally move receipt lookup ahead of owner recheck」**。

**这条约束我认为是本设计最有价值的一句，而且它有安全含义**，我顺着查了对照实现来确认：
`BusinessEntityCommandReceiptService:33-34` 的
`executeAuthorizationAcknowledgement` 是 **receipt 查找在 `command.run()` 之前短路**，
`claim()` 只按 `workspaceUuid + idempotencyKey + canonicalRequest` 命中，**不做任何能力/grant 复核**。
也就是说"receipt 前置"这种写法会让一次 replay **绕过授权复核**。
设计拒绝把它全局推广，是对的。

**我另外做了范围检查，确认设计没有漏掉同构实例**：
catalog 全表非 GET 行的 replay 分布为 `IDEMPOTENT_SAME_KEY 202 / SAME_KEY_ONLY 8 / OTP_GRANT_ONE_TIME 20`；
`DELETE` 方法共 **4 行、2 个操作**——除 catalog delete 外只有
`removeOperationsOrganizationHeadCompanyBrandAuthorization`。
我读了它的 owner（`BusinessEntityService:271-283`）：body 里 `:274` 的
`authorized(headCompanyId, brandId)` 在删除后确会 false → 抛 NotFound，
**机理看似同构**；但因为该 owner 的 receipt 查找在 body 之前短路（上一段），
**replay 根本不会进入 body**，其 `IDEMPOTENT_SAME_KEY` 是诚实的。
**结论：不是同一问题，设计把范围收在 catalog delete 两行是正确的，不是漏收。**

### 1.5 临时商品生命周期的边界 —— **保持**

设计 `:10-14` 明文：
「platform administrators **do not hold** workspace capability；operations writes require an
authenticated operations session、explicit selected data node、live `EDIT_STORE_CATALOG` or
`EDIT_HEAD_COMPANY_CATALOG` capability、server-minted scope grant and catalog-owner recheck
inside its `REQUIRED` transaction」。
`:17-19` 另明确临时外部订单商品是"正常受治理的 catalog 状态，不是 terminal fixture"，
准备过程**只走正常 owner HTTP**（create → save → detail → preflight → execute）。
新增的 edge 集成测试正是承接 selected-node / capability / grant / owner-handoff 的红验。

`CatalogItem` 不被当作菜单或库存替代品这一句也在（`:16`），产品语义没有被工程需要带偏。

### 1.6 是否把静态 gate 或分母冒充动态成功 —— **没有**

- `.runtime/backend-performance/` **为空**，无任何 final run
- manifest `implementationAuthority: False`、`scope: design-only`、`status: PROPOSED_REVIEW_ONLY`
- 设计 `:30` 明确把完整 592-binding / 113-builder fixture-DAG 与 catalog/checker/materializer/
  workload/adapter 转换**拆为后续单元**，不作本轮完成声明
- `standards-coverage --phase R5` = `PASS`（RULES=150）
- 分母复述一致：396 = 78+5+79+38+196；route value 592 = 462 path + 130 required query；命令 113
  （我在前几轮已独立复算过 396 与 113，本轮未见改动）

**全文未出现任何"性能已改善/SQL 优化成功"性质的声称。**

---

## 2. Finding

### N-01｜replay 政策的诚实性是一个 202 行的有限问题族，但未被登记

**证据**：catalog 非 GET 行的 `replayPolicyId` 分布为
**`IDEMPOTENT_SAME_KEY` 202 / `SAME_KEY_ONLY` 8 / `OTP_GRANT_ONE_TIME` 20**。
本设计把其中 **2 行**（catalog delete）识别为"声称与 owner 真实行为可能不符"，
并要求实施时证明。

但 `2026-08-10-…-false-green-problem-family.json` 我全文检索：
**`replay` / `IDEMPOTENT` / `SAME_KEY` / `receipt` 出现次数均为 0。**
FFDG-01…FFDG-08 覆盖了 stateKey 绑定、bootstrap 凭据、模板变体、builder 前驱、
公共恢复流、**响应字段/信封形状（FFDG-07）**、临时商品可达性等，
**唯独没有"replay 政策是否与 owner 的 receipt/recheck 顺序相符"这一族。**

**为什么值得登记**：本轮的 catalog delete 恰恰是靠人读 owner 源码才发现的；
判定它是否诚实，需要知道该 owner 的 **receipt 查找与 owner recheck 的先后**——
我在 §1.4 就是这样判掉组织那条 DELETE 的。这个判据对另外 200 行同样适用，
且**没有任何机器门在看它**。不登记的话，它只会在下一次有人恰好读到某个 owner 时再被发现一次。

**为什么只是 N、且不应现在做**：本轮是一个刻意做小的 6 路径单元，
把 202 行的复核塞进来会把它撑坏，违背"小批量、冻结即审"。
而且当前**没有任何虚假声称**——delete 那两行的问题已被显式标注为未决。

**最小修复**：在 problem-family 文件里加一条（例如 `FFDG-09`），
写明有限分母 `202 / 8 / 20`、判据（"该 operation 的 owner 是否在 receipt 查找之前执行
grant/context recheck"）、以及**在 assembler 实施时逐条讨清**的处置。
不改本轮任何 surface、分母或结论。

**是否需要 Dexter 裁决**：不需要。

---

## 3. 方案合理性

**问题对不对**——对。这不是为了凑 GO 而做的修补：
delete 少两个必填字段、promotion 多套一层信封，都是**会让 fixture-DAG 在动态跑起来时假绿**的真问题，
而且是我在三侧独立证实的，不是作者自述。

**方案优不优**——这个单元的取舍我认同，有两点特别值得说：

其一，**它选择改 owner 而不是改 OpenAPI**。两条偏离都可以"用改契约去迁就实现"来消除，那样更省事，
但会把一个实现缺陷固化成契约。设计明确判定为"owner implementation defect,
not an OpenAPI or product capability defect"，方向是对的。UI 那处 `?.data?.data` 也随之从
"迁就"回到"直读"，是连带的正确后果，不是额外范围。

其二，**它拒绝用"receipt 前置"这种最省事的方式消灭 replay 问题**。
我查了对照实现后确认这不是洁癖：receipt 前置会让 replay 绕过 grant/capability 复核。
宁可保留一个"实施时必须证明"的未决项，也不引入一个安全捷径——这是正确的优先级。

**代价配不配**——配。6 条路径、2 个新测试，是一次能审完的批量；
完整 592/113 的 assembler 被明确拆走，没有借这个小单元夹带。

**UI 与交互**：本轮**触碰 UI 但不改用户任务**。
`CatalogItemDrawer` 的改动是把 `response.data.data` 改为 `response.data`，
用户可见行为、页面路径、操作步骤零变化，属契约对齐而非交互设计。
临时商品的 create → save → detail → preflight → execute 是**已存在的 Journey**，
本设计只是要求 final run 走它而不是走 fixture 后门，没有新增或改变任何用户操作。
按这一点，UI 维度记为**已核验且无异议**，不是 `NOT_APPLICABLE`。

---

## 4. 结论

**GO**（M=0，S=0，N=1）。

设计的两条核心结论我在三侧独立证实，**全部成立且方向正确**：
delete 在 owner `:926` 发 `deletedCount`，而 OpenAPI 的 `result` 是 `additionalProperties:false`
且必需 `categoryRef`/`deletedSubtreeSize`/`deletedCategoryCodes`——所需数据在 `:918-919` 已在手，
无需新查询；promotion 在 owner `:986` + `:1441` 实际产出 `data.data` 双层，
而 OpenAPI 两层都 `additionalProperties:false`，前端 `CatalogItemDrawer.tsx:351` 正用 `?.data?.data`
迁就它——**这也证明了六条路径里必须含 tsx，集合不多不少。**

replay 的处置是诚实的：两行确实都标 `IDEMPOTENT_SAME_KEY`（我实查），
设计把它列为实施必须二选一并证明的未决项，并禁止"全局把 receipt 查找前置于 owner recheck"。
我顺着查了对照实现，确认这条禁令有安全含义——receipt 前置会让 replay 绕过授权复核。
**我还做了范围检查：全表只有 4 条 DELETE、2 个操作，另一条（组织移除品牌授权）因其 owner 的
receipt 查找在 body 之前短路而不会进入 NOT_FOUND 分支，`IDEMPOTENT_SAME_KEY` 对它是诚实的。
所以设计把范围收在 catalog delete 两行是正确的，不是漏收。**

POST_REMEDIATION 只修 anchor：三处 anchor 均唯一解析，6 条 surface 状态准确，
两个 hash 复算相符，权限与分母未动，binding mode 诚实且绑定的 Round 2 `NO_GO` 未被改写。
两轮的 `.md` 原件与 `.json` 转写并存，上一轮的覆盖问题没有重演。
`.runtime/backend-performance/` 为空，无任何动态成功声称。

唯一的 N 是 replay 政策的诚实性——它是一个 202 行的有限问题族，本轮只覆盖了其中 2 行，
而 problem-family 文件里 `replay`/`IDEMPOTENT`/`SAME_KEY`/`receipt` 出现次数均为 0。
登记一条 `FFDG-09`（含 202/8/20 分母与判据）即可，不必现在展开。

**授权边界**：本 GO 仅允许创建独立的**静态** implementation package。
不授权动态环境、DEV、seed/reset、Testcontainers、L2/UAT、部署、手工 SSH/SQL、
RM1/R5 runtime 复用或仓库控制，**也不构成任何 SQL 数值优化成功声明**——
最终动态验收尚未进入动态环境，静态 gate、396/592/113 分母与既有 R5 技术证据
都不得被表述为动态性能成功。
