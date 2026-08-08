# P3 current-byte post-remediation 独立静态复核（Claude）

会话出处：fresh v2s-rooted 评审会话。历史全部保留、不改写：
两轮 independent-subagent 对抗复核（第二轮为该 cycle 硬上限）、
我的 `2026-08-07-...-p3-static-implementation-review-claude.md`（`NO-GO M=6/S=4/N=1`）、
我的 `2026-08-07-...-p3-current-byte-implementation-review-claude.md`（`GO M=0/S=2/N=3`）。
本文不因换文件名或换哈希重置 review 上限。

授权边界：仅 P3 current-byte 静态 implementation、IA 对账、生成物与 evidence。
不授权也不背书 API/L2 runtime、数据库/migration、seed/reset、DEV/UAT、runtime deployment、cleanup。

---

## 0. 结论

**NO-GO — M=1 / S=1 / N=1**

**上轮五条 finding（S-01/S-02/N-01/N-02/N-03）全部真实闭合**，逐条亲验见 §1。
NO-GO 不指向这五条，也不指向源码——**源码完好，上一轮验证过的实现一处都没退**。
NO-GO 指向一件事：**IA 控件对账 evidence 已不再描述当前字节，且失真方向是"把已完成的说成未完成"**。

这一条必须在 P4 规划前修掉，否则 P4 范围会把已经做完的上游工作再排一遍。

---

## 1. 五条整改的核验结果

**S-01 契约级 locator 语义 —— 真实闭合。**
11 条 `IA-CONTRACT-001..011` 的 `locator` 全部为 `NOT_APPLICABLE`（我独立复算，取值分布唯一）；
`position` 补为 `OpenAPI/generated source assertion; no rendered UI locator`，
`sourceFile` 指向 `contracts/openapi/catalog-inventory.openapi.yaml`，语义正确。
checker 侧我 fresh 复跑 `node tools/catalog-inventory-p3/cli.mjs --self-test`，
四类红变异全部触发：`LOCATOR_EXACT_SET`、`LOCATOR_SOURCE`、
`BUSINESS_ASSERTION_METADATA`、`TYPED_SCHEMA`；
主门 `CATALOG_INVENTORY_P3_STATIC=PASS`，`{pages:3, scenarios:18, cases:43, locatorBindings:43}`。
**「只接受 NOT_APPLICABLE、拒绝散文 locator」这条约束是有红变异背书的，不是声明。**

**S-02 projection 重复身份 —— 真实闭合。**
`scripts/check/edge-codegen` fresh 复跑 **exit=0**，`R5_EDGE_CODEGEN_CHECK=PASS`，`FILES=254`。
上轮的 `CAPABILITY_OPERATION_IDENTITY_DUPLICATE:preflightOperationsLocalCatalogCopy` 已消失。
处置方式（capability inventory 跳过 `P1_DEFINITION_ONLY` grouped definition 与
`catalog-inventory-openapi-path-shard` projection、保留 canonical IAM surface、
并为 projection 标记删除加真实红变异）是对的——**没有靠删门或放宽断言绕过**。

**N-01 七条 baseline 登记 —— 真实闭合。**
`HANDOFF.md` 第 28 行起以表格登记七条 `REQUIRED_EXPRESSION`，
逐条标注 `existing platform-admin baseline` / `existing operations-admin baseline` 归因。
本域两个新表已不在门失败集合中，未把旧债并入 P4，也未借机改旧页面。分寸正确。

**N-02 L2 状态级断言 —— 真实闭合。**
spec 由 142 行增至 200 行，`expect(` 由 22 增至 38。
新增的是真实状态推进而非可见性堆砌：复制向导 `catalog-copy-preflight` 点击后断言
`catalog-inventory-copy-preflight` 出现且 `catalog-brand-copy-preflight-next` 存在（source→selection→preflight）；
库存动作填入 `inventory-action-note` 后断言 readback；
临时商品断言 `catalog-temporary-promotion-re-preflight` 的失败后重预检路径。

**N-03 授权来源留痕 —— 真实闭合。**
P3 evidence 的 `authorizationBoundary` 已写明：
`the already-approved P1 CatalogItemPageQuery extension that repaired M-03
(consumed here, not introduced as a new P3 contract authorization)`。
来源、范围与"非本轮新增"的归因三者齐备，审计链完整。

---

## 2. Findings

### M-01｜10 条 `BLOCKED_UPSTREAM_CONTRACT` 的阻塞理由对当前字节为假

**路径**：`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`
（状态值由 `tools/catalog-inventory-p3/ia-reconciliation.mjs` 第 19–22 行的
`upstreamBlocked` 硬编码集合决定，第 116 行给出统一理由）。

**依据类型**：仓内事实，逐条源码亲验。

该集合含 `IA-CAT-LIST-003`、`IA-CAT-LIST-012`、`IA-CAT-LIFECYCLE-002`、`IA-INV-001`、`IA-INV-002`、
`IA-INV-ACTION-COUNT-001`、`IA-INV-ACTION-INCREASE-001`、`IA-INV-ACTION-CONFIG-001`、
`IA-INV-ACTION-ADJUST-001`、`IA-INV-ACTION-RESULT-001`，统一理由为
「当前 P1 契约未提供该控件所需的**服务端筛选、单位/备注/零值确认或配置字段**；P3 不擅自重开契约」。

**这三项理由在当前字节上都不成立**：

- **服务端筛选**：`contracts/openapi/catalog-inventory.openapi.yaml` 已含
  `smartViewKey`、`shapeKey`、`categoryRef`、`governanceStatus`；
  `CatalogOwnerService.items()` 已用 `WITH RECURSIVE category_scope` 做真实子树过滤（1 处命中）。
- **单位/备注/零值确认**：`InventoryActionModal.tsx` 第 11–20 行的 `FormValues` 含
  `unit`、`note`、`zeroConfirmation`、`countingUnit`、`allowNegative`、`lowStockThreshold`。
- **配置字段**：同文件第 145 行起，`CONFIGURE` 分支已真实提交
  `updateOperationsInventoryTargetConfiguration`，body 为 typed `InventoryTargetConfigurationRequest`
  （含 `allowNegative`、`lowStockThreshold`、`countingUnit`、`conversionFactor`）。
  **上一轮我确认过的"死按钮已修"仍然成立**，但对账表把它记成了契约未提供配置字段。

**影响范围**：这是 evidence 与当前字节的事实性冲突，方向是"把已完成的说成被上游阻塞"。
直接后果有两个：① P4 范围会把"重开 P1 补库存动作字段与列表筛选"当成待办再排一遍，
而这些工作已经完成并已由我上一轮 GO 核验；② `BLOCKED_UPSTREAM_CONTRACT` 在本项目里
是"需 Dexter 裁定是否重开契约"的信号，误报会触发不必要的裁决请求。

**最小修复**：把 `upstreamBlocked` 集合按当前字节重判——
`IA-INV-ACTION-*` 五条与 `IA-CAT-LIST-003/012` 的阻塞理由已消失，应移出该集合；
若认为它们仍未达 IMPLEMENTED 标准，请改归 `PARTIAL_STATIC` 并给出**具体**缺口（缺哪个状态、哪个 readback），
不要沿用「契约未提供字段」这条已被证伪的统一理由。

**是否需 Dexter 裁决**：否。这是事实订正，不涉及范围或产品语义。

### S-01｜`implementationStatus` 由硬编码 ID 集合声明，且本轮 86→29 的整体降级未披露

**路径**：`tools/catalog-inventory-p3/ia-reconciliation.mjs` 第 12–26 行
（`implementedStatic` / `outOfScopeStatic` / `upstreamBlocked` / `notImplemented` 四个字面量 Set），
第 116–119 行按集合归属返回状态与固定理由。

**依据类型**：仓内事实 + 我两轮复核的自有观测对比。

- 我上一轮 current-byte 复核对同一文件独立复算，得到
  `IMPLEMENTED_STATIC=86 / OUT_OF_SCOPE_STATIC=3`（文件 70838 字节）。
- 本轮同一路径复算为 `IMPLEMENTED_STATIC=29 / PARTIAL_STATIC=40 / NOT_IMPLEMENTED=7 /
  BLOCKED_UPSTREAM_CONTRACT=10 / OUT_OF_SCOPE_STATIC=3`（文件 68426 字节）。
- **源码未回退**：我逐项复验，`LOCAL_COPY_STEPS` 五步在、`zeroConfirmation` 在、
  `onProductionTagCreated` 回填在、`externalIdentityFact` 白名单在、
  `LocalCatalogCopyDrawer.tsx` 仍为 434 行。
- **disposition 记录对这次整体降级只字未提**，S-01 条目只描述了 locator 语义修改。

**影响范围**：状态不是从源码推导的，而是人工维护的 ID 名单——
**同一套名单这次产生了假红，同样也能产生假绿**，而假绿正是本项目 manifest Part 0.1 点名的失败模式。
更实际的问题是：两次复核对同一证据得到相差 57 条的结论，而变更未披露，
使得"evidence 描述当前字节"这一前提失效。

**最小修复**：两条二选一或并用——
① 让 `implementationStatus` 由可机检事实推导（locator 可解析 + 该控件的 focused test/断言存在），
硬编码名单只保留人工覆盖并要求写具体理由；
② 保留名单但在 disposition 与 evidence 中记录本次状态迁移的逐条 diff 与依据。
考虑到当前阶段标尺，我倾向②加上"名单变更必须在 disposition 列 diff"这一条纪律，成本最低。

**是否需 Dexter 裁决**：否。

### N-01｜7 条 `NOT_IMPLEMENTED` 的 locator 全部已存在于源码，理由需逐条复核

**路径**：同上，`notImplemented` 集合（第 23–26 行）含
`IA-CAT-LIST-007`、`IA-CAT-CATEGORY-001/002`、`IA-CAT-SOURCE-AUTO-001/002`、
`IA-CAT-TAB-004/009`，统一理由为「当前 feature 仍是 manifest/只读骨架，
尚无该控件的完整事件、owner request、错误恢复与 readback」。

**依据类型**：仓内事实。我把全部前端源码合并检索，对非 IMPLEMENTED 的控件逐个校验其 locator：
`BLOCKED_UPSTREAM_CONTRACT` 10 条、`NOT_IMPLEMENTED` 7 条、`PARTIAL_STATIC` 29 条、
`OUT_OF_SCOPE_STATIC` 3 条——**locator 全部在源码中命中，无一缺失**；
另 11 条 `PARTIAL_STATIC` 无 locator，即已改 `NOT_APPLICABLE` 的契约级条目。

**影响范围**：locator 存在**不等于**行为完整，所以 `NOT_IMPLEMENTED` 未必都判错——
这是本条只记 N 而非 M 的原因。但"只读骨架"这一理由与"控件已渲染"并存，至少需要逐条说明
缺的究竟是事件、owner request、错误恢复还是 readback 中的哪一项。

**最小修复**：这 7 条各写一句具体缺口，或据实上调状态。

**是否需 Dexter 裁决**：否。

---

## 3. 方案合理性

本轮五条整改的做法都克制且对路：S-02 用 typed 角色标记区分 canonical 与 projection、
并为标记删除补真实红变异，而不是把门放宽；S-01 把"只接受 NOT_APPLICABLE"做成红变异可拒；
N-01 把旧债登记 HANDOFF 而不顺手改旧页面；N-02 补的是状态推进断言而不是可见性堆砌。
`Generalized prevention` 四条也都指向机制而非个案，方向正确。

唯一的问题出在证据层：**修复本身是真的，但描述修复的那份对账反而退回了整改前的判定**。
这不是工程能力问题，是"生成物的状态由人工名单驱动"这一机制的必然风险。

## 4. 明确不背书

`businessStatus`、`cleanupStatus`、managed L2 与 89 个控件的 `runtimeStatus`
（本轮复算仍为 89/89 `UNVERIFIED_REQUIRES_EVIDENCE`）均未执行，本文一律不背书。
作者在这些位置如实标注、未升级为业务 PASS，这点确认无误。

## 5. 授权边界

本文仅授权「P3 current-byte 静态 implementation、IA 对账、生成物与 evidence」的复核。
不授权 API/L2 runtime、数据库/migration、seed/reset、DEV/UAT、runtime deployment、cleanup。
M-01、S-01、N-01 均为事实订正与机制加固，在既有批准边界内，可交 Codex 自主处置，
不需要 Dexter 裁决。
