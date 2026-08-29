# base-1 实施独立评审(第二次)· NO-GO(M=1 / S=0 / N=3)

```text
BLIND_REVIEW=FALSE            ← 见下方「必须先声明的两件事」,我不能诚实地写 TRUE
REVIEW_TARGET=IMPLEMENTATION
reviewerKind=EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE
REVIEW_CYCLE_ID=NOT_ISSUED    ← 上一轮报告内不存在该字段,我不编造
REVIEW_ROUND=NOT_APPLICABLE_TO_CLAUDE_EXTERNAL_REVIEW
REVIEW_ROUND_LIMIT=2          ← 该上限约束的是 INDEPENDENT_SUBAGENT 两轮,不是本文
VERDICT=NO-GO
M/S/N=1/0/3
```

## 必须先声明的两件事

**一 · 我不是 blind reviewer,不能签 `BLIND_REVIEW=TRUE`。**
上一份 NO-GO 报告、base-1 需求稿、附件与合并稿**都是我写的**。本轮我确实从当前字节重新独立核验、
未复用任何既有结论(下文多处推翻了我自己上一轮的判断),但这不等于盲审。签 TRUE 会是假声明。

**二 · `REVIEW_CYCLE_ID` / `REVIEW_ROUND` / `REVIEW_ROUND_LIMIT=2` 属于另一个流程。**
`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` 明写:
「Claude review 继续是该流程之后的独立外部 review,**不得替代这两轮**」。
两轮上限、`reviewerKind=INDEPENDENT_SUBAGENT`、`blindReviewDeclaration`、`reviewerInputChecklist{path,sha256}`
是子 agent 两轮对抗审查的字段。把它们套到 Claude 外部评审上会**混淆两个流程**,
并可能造成「Claude 已用掉一轮」的错误记账。本文按 CLAUDE.md 的 Claude review 格式给结论。
上一轮报告内确实没有 cycle ID,我不为满足格式而编造一个。

---

## 结论

**NO-GO** · `M=1` `S=0` `N=3`

**分寸必须说清楚:唯一的 M 是一次机械的生成物未刷新,不是业务或架构错误。**
本轮实质内容我逐项亲验后**大面积通过**,而且**推翻了我自己上一轮的多条判断**。
若把那一个生成物重生成并复跑链,按当前证据我看不到其他阻断项。

---

## M-1 · 生成链漂移:`edge-route-face-registry.json` 内嵌的 calibration digest 已过期

**等级** M · **CONFIRMED**

**owning source**:`apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`
(`calibrationReportDigest` 字段);生成器 `scripts/generate/edge-codegen.mjs` 第 29 行。

**本会话新鲜运行**:

```
scripts/check/edge-codegen        → R5_EDGE_CODEGEN_DRIFT:…/edge-route-face-registry.json   退出码 1
scripts/check/openapi-contracts   → R4_GATE=FAIL
   REASON=R4_OPENAPI_GENERATED_DRIFT:R5_EDGE_CODEGEN_DRIFT:…/edge-route-face-registry.json  退出码 1
```

**仓内事实(根因,已精确定位)**:

- registry 内嵌 `calibrationReportDigest = 899d3be106d79612c8b19a349c2ce00191d0910094891681398ef190da77cffc`
- `contracts/policy/backend-performance-cp05-calibration-report.json` 的实际 sha256 是
  `74b2f5e0362d10b120a05e9d7ce9c411f86aafe9ea32611443261342129df2f9`
- 两者不等。时间线解释了原因:registry 生成于 **2026-08-28T14:53:51Z**,
  而 CP05 report 重生成于 **2026-08-29T05:01:45Z**(晚 14 小时)。
- **两个生成 registry 只刷新了一个**:`catalog-inventory-edge-route-registry.json`
  已于 **2026-08-29T05:46:10Z** 重生成,`edge-route-face-registry.json` 没有。

**推论**:本轮候选证据里「generated chain … 均已通过」这一条**与当前磁盘字节不符**。
按 Dexter 裁决第 5 条「必须跑通适用的静态测试,任何失败都必须回到 owning source 做根因修复」,
静态门当前是红的,不具备接受条件。

**可证伪的失败条件**:重生成 `edge-route-face-registry.json` 后,其 `calibrationReportDigest`
必须等于当前 CP05 report 的 sha256,且 `scripts/check/edge-codegen` 与 `scripts/check/openapi-contracts`
必须同时退出码 0;若仍红,则根因不止 digest 一项。

**最小修复**:按 owning generator 重新生成该 registry,再整链复跑。这是机械动作,不是设计改动。

**为什么更小的替代不足**:把 digest 手工写进 registry 能让门变绿,但那是**手改 generated**,
会让 registry 与生成器解耦,下一次任何上游变更都不会再被这道门发现 —— 恰好毁掉这道门的全部价值。

**是否需要 Dexter 裁决**:否。

---

## 逐项独立确认(本轮全部亲验,含多条推翻我自己上一轮的结论)

### P3 受控例外 —— 全部成立

- **恰好 12 条,集合与 Dexter 清单相等**:report `categories.P3` 长度 12,集合相等判定为 True。
- **12 个数字逐个吻合**:每条的 `databaseOperationBudget.max` 与裁决清单值一一相等(26/29/29/28/29/28/30/28/28/26/28/26)。
- **operation-scoped 且不可扩散**:`scripts/generate/backend-performance-budget.mjs` 第 79–81 行,
  该 decisionRef 的 scope 直接取自 `Object.keys(INVITATION_ASSIGNMENT_P3_MEASURED_MAX_BY_OPERATION)`,
  **与那 12 个实测值同源于一个冻结对象,不可能漂移**;第 438–443 行强制
  `decisionRef` 已知且其 scope **必须包含该 operationId**,否则 `DECISION_SCOPE_MISMATCH`。
- **不能凭空抬**:第 445 行强制 `record.to === to.max === measuredMax` —— 例外值只能等于实测最大值。
- **不能自授**:第 442 行,`authority === 'IMPLEMENTATION_AGENT'` 时 scope 长度必须为 1;
  本例外 `authority: 'DEXTER'`,decisionRef 与裁决给定的字符串逐字符一致。
- **未泄漏到其他 operation 或类别**:其余 decisionRef 均为 2026-08-26 的既有条目,
  指向 reorder/inventory/promotion/brand-copy,与本例外无交集;
  `OPERATION_DATABASE_CEILINGS` 只有三条既有 catalog copy/save 特例(48/35/45),未被本轮触碰。

### 我上一轮担心的「用重分类绕过」—— `REJECTED_WITH_EVIDENCE`

我上一轮明确写过「不建议用重分类去解这 23 条」。本轮读分类器后**这个担心不成立**:
`scripts/test/backend-performance-cp05-reclassification.mjs` 第 122–139 行的
`classifyCurrentTreeOperation` 是**纯实测函数** —— `maxDatabaseOperationCount >= 25` 才是 P3,否则 P5。
**类别是实测值的函数,不是可以手工改写的标签;想进 P5 必须真把 DB 操作数降下去。**

实测证据也支持这是真整改而非改名:
`executeOperationsTemporaryCatalogItemPromotion` 62 → 16;`deleteOperationsOwnerBinding` 47 → 22;
`createOperationsBusinessChannel` 30 → 19;`transitionWorkspaceAccountStatus` 28 → 20。
23 − 12 = 11 条全部落到 25 以下,与「12 条走例外、11 条真整改」的说法一致。

### 未纳入例外的操作仍受原边界控制 —— 成立

`createOperationsBusinessChannel` 现为 P5、`FIXED max 19`;`deleteOperationsOwnerBinding` 现为 P5、
`FIXED max 22`。二者都不在任何 decisionRef 的 scope 内,预算即其三次实测最大值,
未获得任何例外豁免。

### 邀请/任职的业务事实保留 —— 我在 owner 源码亲验,不采信记录里的字面量

⚠️ 必须指出:`businessFactsPreserved: true` 与 `sharedMechanismsReused: true` 是
`backend-performance-budget.mjs` 第 108、113 行的**硬编码字面量**,evidence 是手写字符串;
校验只验它们存在且为 true,**不验 owner 源码里真的有这些机制**。所以我自己去读了源码:

`WorkspaceInvitationService.java` 实测:`@Transactional` 26 处、idempotency 12 处、`FOR UPDATE` 1 处、
audit 37 处、readback 42 处;typed problem 以独立异常类承载 ——
`InvitationStateException` 26、`InvitationValidationException` 18、`InvitationNotFoundException` 6、
`AccountNotBindableException` 1(即裁定 19/20 的 `ACCOUNT_NOT_BINDABLE`)。
**事务、幂等、锁、typed problem、审计、权威 readback 均在源码中实证存在**,该例外的前提成立。

### browser L2 —— 24/24 成立,分母处置正确

- `l2-execution-manifest.json`:`discovered=24 / selected=24 / results=24`,
  `business=PASS`、`cleanup=PASS`、`cleanupErrors=[]`、`firstFailure=None`、
  `brokenBoundary=None`、`lastKnownGood=L2_24_CASES_PASS`。
- `readiness-manifest.json`:`businessStatus=PASS`、`setupCleanupStatus=PASS`、
  `cleanupStatus=PENDING_HELD`(run 期间正确挂起)、`lifecycle=HELD_FOR_BROWSER_L2_RUN`。
  **BUSINESS 与 CLEANUP 在两层都分开跟踪,没有混用。**
- **分母未被偷换**(裁决第 6 条):readiness 的 `denominators` 明确写
  `{scenarios: 26, policyCases: 65, activeCases: 24, …}`;
  `scripts/check/catalog-inventory-p2` 本轮输出 `L2_SCENARIOS=26/65` 与 `L2_ACTIVE_CANDIDATE=8/24`
  **分两行报**。24 没有被当成整个分母。
- **不是「页面能打开」**:24 个 caseId 是 8 个 workbench 场景各 ×3 ——
  `catalog-find/view/create/edit/config/batch/copy/governance` 各有
  `success / failure / recovery`。失败与恢复路径都在分母内。
- **HTTP 与 DB 关联存在**:`http-request-events.jsonl` 与 `db-operation-events.jsonl` 各自成文件,
  另有 165KB 的 `l2-join-artifact.json` 承载关联。
- 拓扑记录为 `LOCAL_SPRING_LOCAL_VITE_LOCAL_PLAYWRIGHT_REMOTE_DB_ASSET_TUNNEL`,与所述一致。
- **未见把 L2 或 Testcontainers 称作 UAT** 的表述。

### 上一轮 findings 逐条判定

| 上轮 finding | 本轮判定 | 依据 |
| --- | --- | --- |
| M-1 oracle 红夹具名不副实 | **RESOLVED_WITH_EVIDENCE** | 门名已改为 `BASE1_STRUCTURED_FIELD_ORACLE_STATIC_RED_MUTATION=PASS`,不再声称运行时;且 run `r5-tc-1787979726169-53281` 是**真实受管运行**,`business=FAIL`、`cleanup=PASS`,JUnit XML 内恰好各一次 `CONTRACT=PASS BUSINESS=FAIL` 与 `FAILURE_CATEGORY=BUSINESS_ORACLE` —— 正是我上轮要求的可证伪信号 |
| M-2 CP05 23 条阻断 | **RESOLVED**(非豁免) | `blockedCount` 0,12 条走受控例外、11 条实测降到 25 以下;未抬阈值、未改名绕过 |
| M-3(a) SKU 中文字面量判据 | **RESOLVED** | `catalog-inventory-p2` 本轮 `CATALOG_INVENTORY_P2_STATIC=PASS` |
| M-3(b) L2 分母 18 vs 26 | **RESOLVED** | 同上,且分母改为 `26/65` 与 `8/24` 分报 |
| S-1 后端写展示句、`problemCode` 被弃用 | **RESOLVED** | `CatalogBatchOutcome.tsx` 第 67 行现为 `catalogBatchFailureReasonLabel(result.problemCode, result.reason)` —— 按 code 出文案、reason 兜底 |
| N-1 `50vh` 魔数与断言样式字面量 | **RESOLVED** | 组件与测试内 `50vh` 均已零命中;第 42 行新增 `tabIndex={0}`,滚动区已键盘可达 |
| N-2 12 个 pointer 未逐一复核 | **PARTIALLY_CONFIRMED** | 见下 N-3 |
| N-3 我方假阴性 | **已作废并公开更正** | 本文再次记录 |

### Catalog / SKU 生命周期

`CatalogSkuFacts.java`(533 行)实测:`readByItemRefs(Collection<UUID>)` 为**批量 set-read**,
入口 `new LinkedHashSet<>(itemRefs)` 去重(无 N+1、无重复读);
`result.getObject(n, UUID.class)` 为**强类型 UUID 取值**,不是递归扫描任意 `id`/`ref`;
第 50 行与第 96 行均带 `status <> 'VOIDED'`,VOIDED SKU 在普通读取中被隐藏。
契约侧 `canVoid`(26)、`blockingReasons`(20)、`skuRef`(4)、`targetStatus`(18)均存在。
**未见 fallback、默认字段或只改 fixture 的伪造痕迹。**

---

## N-1 · P3 阈值 25 与 P3 上限 20 之间存在 21–24 的死区(模型属性,非本批缺陷)

**等级** N · **DEXTER_DECISION**(仅需知晓,不阻断)

分类器以 `>= 25` 判 P3,而 P3 的 ceiling 是 20。落在 **21–24** 的操作被判为 P5,
其预算即实测值、**不受任何 class ceiling 检验**。本轮有六条整改后正落在该区间:
`updateOperationsCommercialGroup` 24、`transitionOperationsBusinessChannelStatus` 23、
`updateOperationsBusinessChannel` 23、`updateOperationsBusinessChannelTemplate` 23、
`createOperationsOwnerBinding` 22、`deleteOperationsOwnerBinding` 22。

这是 CP05 模型自身 threshold(25)/ceiling(20) 的间隙,**按现行设计它们确实合规**,
不是 base-1 引入的缺陷,我不将其列为阻断。是否收窄该死区属于预算模型的产品判断。

## N-2 · L2 manifest 内的绝对路径指向本机不存在的工作副本

**等级** N · **UNVERIFIED_REQUIRES_EVIDENCE**

`readiness-manifest.json` 的 `credentialsFile` 与 `ownerFixturePath` 指向
`/Users/dexter/Documents/workspace/idea/catering-v2s/…`,该目录在本机**不存在**,
而本仓位于 `/Volumes/idea/catering-v2s`(实测非符号链接)。
run 目录内的 fixture 文件本身存在且 manifest 自洽,`runBinding` 以 runId/namespace/database/assetPrefix
绑定,不依赖该路径。

**我无法判定**这只是执行环境的路径记法差异,还是该 run 出自另一份工作副本 ——
后者会影响「证据绑定当前字节」。请补一条能把该 run 绑到本仓当前字节的凭据。
顺带:仓规禁止交付物含本机绝对路径,manifest 也应改为仓库根相对路径。

## N-3 · 例外记录的「业务事实已保留」是自声明,无门验证

**等级** N · **PARTIALLY_CONFIRMED**

如上所述,`businessFactsPreserved: true` 是生成器里的硬编码字面量。**本轮我已在 owner 源码亲验其成立**,
所以不构成缺陷;但**没有任何门**会在将来有人削弱事务、锁或审计时把它变红 ——
届时该字面量仍是 true。同理,上一轮 N-2 的 12 个结构化字段指针,本轮 oracle 门
`OPERATIONS=93 POINTERS=240` 通过,但那是**存在性与形态**校验;
我未逐一打开 12 个指针比对生成链前后值域,标记 `UNVERIFIED_REQUIRES_EVIDENCE`,
建议交付时给出逐 pointer 的前后对照。

---

## 证据分层声明

`static/generated/focused` 与真实 HTTP 分开记录;真实 HTTP(backend-acceptance)与 browser L2 分开记录;
`business` 与 `cleanup` 逐层分开;production mutation 的红失败(run `r5-tc-1787979726169-53281`,
`business=FAIL` / `cleanup=PASS`)**只证明业务断言有效,本文不将其计为产品失败**。
本轮**未执行也未声称** DEV、reset、seed、UAT。未使用任何已退役控制面。

## 授权边界

本文只是独立外部评审结论。`NO-GO` 不构成产品否决,也不构成产品取舍、Journey 变更、Roadmap 推进、
DEV/reset/seed/UAT/deploy、数据操作或任何仓库控制动作的授权。
静态与门层面的结论**不等于**动态 GO。Dexter 保留最终产品决策、严重性裁决、运行环境授权与交付接受权。
