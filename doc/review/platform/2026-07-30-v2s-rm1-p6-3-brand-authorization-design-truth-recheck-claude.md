---
title: RM1 P6-3 总公司品牌授权 corrective design 现状表述整改复审（Claude）
reviewTarget: DESIGN
scope: P6-3 corrective design、roster、三步计划、granularity manifest、CP-U15 package exit、对抗审查件 current bytes
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态 implementation-facing design 复审；不授权 production implementation、contract/generation、动态运行、DEV、seed/reset、Roadmap 状态或仓库控制操作
createdAt: 2026-07-30
---

# P6-3 品牌授权 corrective design 现状表述整改复审

## 0. 结论

**GO**，`M=0 / S=1 / N=2`。**本 GO 仅代表静态 implementation-facing design admission。**

上一轮我提的 `M1`（分页被误述为 owner 侧）与 `S1`（in-use 映射被误述为已存在）
**均已改为准确的现状陈述 + 明确的 P6-3 未来义务**，且顺带关闭了我那两条 N
（bulk 断言未指名、adapter 无 import 契约）。五项核验**逐项通过**。

`S1` 是我本轮独立发现的**上游**问题：已 `ACCEPTED` 的 IA04 内部自相矛盾，
其 §3 那一行仍写着多选草稿语义——**正是本 slice 要消灭的那个形状**。
不在本次被审设计之内，但会在实施期把人带回旧路。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。

---

## 1. 五项核验逐项结论

### ① brands 分页：现状表述准确，义务范围收窄 —— `CONFIRMED`

**现状陈述已改对**。design `:29-33`：

> Candidate search is **not yet owner-paginated in current bytes**. The contract accepts `name`, `status`,
> `expectedContextVersion`, `page` and `pageSize`, but `BusinessEntityService#listEntities` **currently returns an
> unfiltered `List`** and `OperationsBusinessEntityController#page(...)` **filters, sorts, counts and slices it at
> the edge**. Record this as `GAP-BRAND-CANDIDATE-OWNER-PAGINATION`; it is **neither a candidate-ready claim** nor a
> reason to fetch a full browser list.

与我上一轮独立复核的事实**逐字吻合**（owner 侧仅 `listEntities(entityType, workspaceUuid, groupWorkspaceKey)`，
无第二重载；edge `#page(...)` 承担全部谓词）。roster `:125-126` 同口径。

**义务范围恰好是我建议的最小面**（`:49-57`）：只改
`OperationsBusinessEntityController#brands` 与该 operation 所用的 owner `List` 读，
owner query 的精确谓词枚举为 `entityType=BRAND`、workspace、group key、`name`、`code`、
`status`、`sort`、`direction`、`page`、`pageSize`——**与契约声明的 query 参数集一一对应，无遗漏**；
结果须含当前页 items 与 total；edge 只透传，**不得 materialize/filter/sort/slice**。

**focused test 与红都点名到文件**：
`…/app/edge/operations/organization/OperationsBusinessEntityControllerTest.java`
须证明 exact predicate pass-through 与 exact owner `items/total`，
且"**restoring local `page(...)` must fail**"；`:98` 的红清单亦含
"restore edge-local candidate `page(...)`"。

### ② in-use 映射：现状与义务表述准确，红变异是真的 —— `CONFIRMED`

design `:38-42`：

> Current `ContractProblemAdvice` handles its subclass **through the generic `OrganizationConflictException`
> fallback**, so the declared OpenAPI code is **not yet the current edge result**.
> P6-3 must add an explicit **most-specific** owner-exception → edge 409 generated-code mapping
> **before the superclass fallback**; generic conflict mapping is not sufficient.
> The operation contract **already declares** the safe code.

与我复核的事实一致（`HeadCompanyBrandAuthorizationInUseException extends OrganizationConflictException`，
落到 `conflict` handler 三元链末端的 `PLATFORM_COMMON_VERSION_CONFLICT`；契约 `:717` 已声明
`ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE`）。

**红变异满足"真实子类 + generic fallback"两条**（`:92-95`）：
"The typed projection test **throws the actual subclass** and **fails if it falls through to
`PLATFORM_COMMON_VERSION_CONFLICT`**"，并进一步要求
"the capability-invariant check must likewise **select the most-specific thrown exception** rather than accept its
mapped superclass"——**这条正是我上一轮 `N1` 指出的门盲区，已被采纳为义务**。

### ③ 遗留分母与 adapter 契约 —— `CONFIRMED`（已独立验证到字节）

**遗留分母现在点名到文件与行为**（`:68-71`）：
`features/head-company-management/ui/HeadCompanyManagementPage.tsx` 与
`src/tests/architecture/static-boundary.test.mjs`，二者"removed or rewritten **together**"。

我逐一重开确认这两个目标**真实存在且形状如所述**：

| 目标 | 当前字节 |
| --- | --- |
| `static-boundary.test.mjs:49` | `assert.match(headCompany, /operationsClient\.replaceOperationsOrganizationHeadCompanyBrandAuthorizations/)` —— 一条**要求**已退役 bulk operation 存在的静态断言 |
| `HeadCompanyManagementPage.tsx:239` | `operationsClient.replaceOperationsOrganizationHeadCompanyBrandAuthorizations(… body:{brandIds: value.brandIds ?? [], expectedVersion …})` |
| 同文件 `:247` | `<Select mode="multiple" …/>`，字段名 `brandIds` |
| 同文件 `:216` | `dirtyMessage: '已修改的品牌授权不会保存。'` —— 典型"草稿 + 整体保存"语义 |

这关闭了我上一轮的 `N2`（移除目标未指名）。

**adapter 契约精确且自证边界**（`:62-68`）：nonvisual、
"**deliberately outside the physical-screen table**"（并给出理由——关闭我上一轮 `N3`）、
Drawer 是其唯一 UI 消费者、只消费既有 `OperationsTransport` 的 generated-client / error-code 边界
与四个已声明 operation、**不创建 API slice、不 import `OperationsApi`/`operationsRtk`、
不发原始 HTTP、不含第二查询机制**，并以 focused adapter test 作 import/consumer 证明。
receipt identity `(workspaceUuid, idempotencyKey)` + method/path/body 规范化哈希，
因此"a key cannot be reused for another brand, another method, or an add/remove pair"。

### ④ IA04 §12.2 逐项即时增删 —— `CONFIRMED`（设计侧）

design `:14-17`："a searchable candidate Select plus an **immediate single add**, and current rows plus an
**immediate single remove**; it is explicitly **not a multi-select draft or a『save all』action**"。

与 IA04 的三处一致：
`:52`（screen 表）"可选品牌搜索选择、**逐项添加或移除**已授权品牌、关闭"；
screen `USER_VISIBLE_COPY`「标题『经营品牌』；『可选品牌』『添加』；**每项已授权品牌的『移除』**；『关闭』」；
`:741`（§12.2 字段矩阵）"当前授权列表的**逐项『移除』**；候选品牌 searchable Select + 『添加』"。

**但 IA04 自身另有一行与此矛盾——见 `S1`。**

### ⑤ granularity 诚实性 —— `CONFIRMED`

```
postRemediationDeclaration: POST_REMEDIATION_V1 | reviewRound=2
  currentBytesNotReviewedByAdversarialReviewer = True
  claudeRecheckRequired = True
  implementationAuthority = False
units: RM1P6-U01, RM1P6-U02, RM1P6-U03          ← 未新增 unit
checker 实跑: UNITS=3 / FINDINGS=2 / VERDICT=NO_GO
             REVIEW_ROUND=2 / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
```

**round-2 未被改写**：`rm1-u09-implementation-design-adversarial-review-round2.json` 实测 sha
`06a723c5ed3fe542a2e6…` 与 manifest 声明的 `reviewSha256` **一致**，
文件内 `reviewRound` 仍为 `2`，**无第三轮**。
P6-3 对抗审查件亦为 `ROUND_FINAL_DECISION=SELF_DECIDED`、`GO M=0/S=0/N=2`，
并明写"不得在这个 DESIGN cycle 再开第 3 轮"。

**CP-U15 package exit 复算**：`actualChangedPaths 10 == incrementalChecks 10`，exact-set `True`，
`afterSha256` 逐条复算 **0 不符**；`status=PASS`、`cleanup=PASS`、
`business=NOT_APPLICABLE`（design-only 阶段的正确取值）。

---

## 2. S1 ｜已 ACCEPTED 的 IA04 内部自相矛盾：§3 那一行仍是多选草稿语义 —— `CONFIRMED`

**owning source**：`doc/decisions/2026-07-29-v2s-rm1-ia-04-…-interaction.md:72`
（§3「表单级联、选择规则与提交边界」表）：

> `IA04-HEAD-COMPANY-BRANDS` | 搜索与**多选**候选只来自 owner；**保存前可移除已选品牌**，
> 提交时 owner 再核验总公司和品牌仍可用。

**反例（同一份 IA 的另外三处说的是相反的事）**：`:52`「**逐项**添加或移除」、
screen `USER_VISIBLE_COPY`「每项已授权品牌的『移除』」、`:741`「当前授权列表的**逐项**『移除』」。
本 corrective design 与 Dexter 裁决取的都是"逐项即时"这一支。

**为什么这不是措辞小事**：
`:72` 所在的 §3 正是"表单级联与提交边界"章——实施者查表单提交语义**最自然会去的那一节**；
而它描述的"多选 + 保存前移除 + 提交"恰好**逐字等于** legacy 页当前的实现
（`mode="multiple"` + `brandIds` + `replace…Authorizations` + "已修改的品牌授权不会保存。"）。
也就是说：本 slice 花力气删掉的那个形状，在**已接受的交互权威**里仍有一行明文要求它。
IA04 的 hash 已被 roster `§1` 绑定，任何按该 hash 回读 §3 的人都会重建它。

**适用边界**：这**不是**本次被审 corrective design 的缺陷——design、roster、字段矩阵三处都正确。
它是上游 accepted 字节的内部矛盾，不影响 `§1` 五项核验的结论。

**严重性理由**：无当前实现错误，但它是"删掉的东西被权威文档要求恢复"的直接来源，
且落在实施者最可能查阅的章节，故 S。

**最小修复**：把 `:72` 改写为与 `:52`/`USER_VISIBLE_COPY`/`:741` 一致的逐项即时语义
（例如"候选来自 owner 的可搜索单选；『添加』与每行『移除』各为一次即时 command，
不存在多选草稿或整体保存"）。
这会改动**已 ACCEPTED** 的 IA04 字节，因此 `DEXTER_AWARENESS`：
它是把该 IA 内部对齐到 Dexter 已裁决的方向，**不是新的产品决策**，
但会使 roster `§1` 绑定的 IA04 hash 变化，需同步重冻结。

---

## 3. N（观察项，不阻塞）

**N1 ｜同形缺陷在两个兄弟列表上保留且未登记 GAP**

`OperationsBusinessEntityController` 的三个列表是同一形状：
`:85` brands、`:92` tenants、`:99` head-companies，全部为
`page(entities.listEntities(<TYPE>, workspaceUuid, groupWorkspaceKey), name, code, status, sort, direction, page, pageSize)`。

P6-3 有意只收窄到 `#brands`（design `:49-51` 明说，范围克制是对的），
但 `GAP-BRAND-CANDIDATE-OWNER-PAGINATION` 只覆盖 brands；
**tenants 与 head-companies 的 edge-local 分页没有任何 GAP 登记**。
结果是同一控制器内将出现两套分页语义，而只有一套被追踪。
建议追加一条 `GAP-BUSINESS-ENTITY-LIST-OWNER-PAGINATION`（或在现有 GAP 里注明
"tenants/head-companies 同形，未在本 slice 范围，另行登记"），
避免下一轮又出现"同类缺陷两套标准"。

**N2 ｜`business=NOT_APPLICABLE` 的口径差异值得写明**

CP-U14（P6-1 整改）为 `business=PASS`（有三个受管 task 的动态证据），
CP-U15（本 design-only slice）为 `business=NOT_APPLICABLE`。
对 design-only 阶段这是**正确取值**，但两份相邻 exit 的同名字段取值不同，
建议在 CP-U15 加一句 `notApplicableReason`（如"design-only；无 production byte 变更，
业务证据在 P6-3 实施包提供"），与 `dataEvolution/uiAndTerms` 的既有 `notApplicableReason` 体例一致。

---

## 4. 处置

`M=0 / S=1 / N=2` → **GO**（仅限静态 implementation-facing design admission）。

- **`S1` 需 Dexter 知情**（改动已 ACCEPTED 的 IA04 字节并重冻结其 hash），
  但方向是把该 IA 内部对齐到他已裁决的"逐项即时"，**不是新产品决策**。
  建议在 P6-3 开工前完成，否则实施者按 §3 回读会重建被删掉的多选草稿。
- `N1`/`N2` 在既有批准边界内，Codex 可自主处理。
- **本 GO 不代表**：P6-3 implementation authority、contract/generation 变更许可、
  或跨越 P6 串行门。`DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` 与
  `VERDICT=NO_GO` 仍是 P6 主 manifest 的当前事实，应保留。
- 已验证为真的部分**不得回退**：现状陈述（brands 未 owner 分页、in-use 走 generic fallback）、
  `GAP-BRAND-CANDIDATE-OWNER-PAGINATION`、最具体异常映射义务与两类红、
  遗留分母的两个具名目标、adapter 的 nonvisual/单消费者/仅 generated transport 约束、
  逐项即时增删交互、round-2 未改写与无第三轮。

**本复核不授权**：production implementation、contract/generation、动态运行、DEV、
seed/reset、Roadmap 状态变更或任何仓库控制操作。
