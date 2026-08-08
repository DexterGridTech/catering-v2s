# 商品库存域 P4 范围登记（Claude）

> 依据 Dexter 2026-08-06 指示：「你看看原本的需求范围里，还有哪些没有在 P1、P2、P3 里实现的，
> 统一放到 P4 吧，你先列出并记录下来，等 codex 做完 P3 之后，再一次性收尾 P4」。
>
> 本文只做登记，不构成对 Codex 的授权。P4 的启动时机由 Dexter 在 P3 收口后决定。

会话出处：fresh v2s-rooted 评审会话。本登记基于当前字节，未执行任何 runtime 动作。

---

## 0. 结论摘要

商品库存域原本只规划了三个阶段（P1 契约+seed数据+测试用例、P2 后台/API、P3 前端/L2），
**全仓无任何 `CATALOG-INVENTORY-P4` 编号**。经核查，**P4 的主体不是"漏做的功能"，
而是"设计已写明必须收、但因始终未获 runtime 授权而收不了的那一批验收"**，
外加 seed 实跑这一件当前明确无主的事。

共登记 **17 项**，分五类。其中 A 类（8 项）与 B 类（3 项）是主体，
性质高度一致——**都需要一次带 runtime 授权的轮次才能收**，适合合成一个 P4 包一次性做完，
这与 Dexter「一次性收尾」的意图吻合。

---

## A 类｜设计已声明为 P2 exit、因无 runtime 授权未收（8 项）

出处：三阶段设计 §4.6「P2 exit」逐条 vs `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p2-implementation-evidence-codex.json` 实际状态。
这批不是 Codex 偷懒——P2 的 `authorizationBoundary` 原文写明
「No Flyway execution, seed/reset, DEV/UAT/HTTP/L2 execution or runtime deployment was authorized」，
在该边界下这些条目物理上无法完成，作者也如实标注而非伪称 PASS。

| # | 项 | 设计原文要求 | 当前状态 |
|---|---|---|---|
| A-1 | 26 definitions / 100 cases API 全绿 | P2 exit「26 definitions / 100 cases 全绿；每个 expected error 是 typed problem」 | `api100CaseRuntime: NOT_APPLICABLE_WITH_REASON; runtimeAuthority=false` |
| A-2 | 42 operation 实测 DB 次数 | P2 exit「42 个 operation 的正常 fixture 实测 `databaseOperationCount` 与逐 operation 设计值精确相等」 | 分母 42 已声明，实测未做；即我历轮的 N-03，`UNVERIFIED_REQUIRES_EVIDENCE` |
| A-3 | 事务与幂等的真实 red | P2 exit「transaction rollback、idempotency replay/mismatch/result-unknown、version conflict 有真实 red」 | 静态实现已核，真实 red 需 runtime |
| A-4 | 代表 seed 图 readback 验证 | P2 exit「代表 seed 图经 owner command 创建和 readback count 验证」 | 未执行 |
| A-5 | P2 business evidence | 六类 package-exit source 表：P2 的 `BUSINESS_EVIDENCE` = 「26/100 API report」 | `businessStatus: NOT_APPLICABLE_WITH_REASON` |
| A-6 | P2 cleanup evidence | P2 exit「若使用受管测试数据库，cleanup evidence 单独 PASS」 | `cleanupStatus: NOT_APPLICABLE_WITH_REASON` |
| A-7 | 两个 focused test 实跑 | `CatalogCopySourceAuthorityTest`、`ContractProblemAdviceTypedOwnerMappingTest` | `COMPILED; NOT_EXECUTED_REMOTE_GUARD`；我第二轮 GO 明确声明不对其执行结果背书 |
| A-8 | generated registry test 执行 | — | `generatedOperationRegistryTestExecution: NOT_RUN_RUNTIME_GUARD` |

**归属判断**：这 8 项全部由 `scripts/test/r5-remote-testcontainers.mjs` 一类的受管远端 runner 承载，
共用同一套 runtime 前置。**建议合成 P4 的第一个交付单元，一次授权一次收完**，
不要拆成八次小授权——那样每次都要重建 runtime 前置，成本远高于收益。

---

## B 类｜seed 实跑与全量对齐（3 项，当前明确无主）

| # | 项 | 依据 | 为什么无主 |
|---|---|---|---|
| B-1 | 商品库存域 seed 装载器 | `contracts/policy/catalog-inventory-fixture-catalog.json` 已定义 5 个 seedDatasets、39 个 testDatasets 与 `seedExecutionPlan`（`transport: HTTP`、`noDirectDatabaseWrites: true`） | 既有 `scripts/dev/seed` 只认 `--profile r5-full`，其 executor 与 r5 fixture 契约对 catalog / inventory / fulfillment-production **零覆盖**；该 fixture 全仓消费方只有 P1 的 checker 与 generator 两个静态工具，无任何运行时装载器 |
| B-2 | 全量目录对齐 73 商品 / 34 图 | fixture 的 `fullCatalogParity` 明确写 `expectedCatalogItemCount: 73`、`expectedMediaAssetCount: 34`、**`requiredIn: "P2"`**、`reductionIsNotFinalSeedPolicy: true` | 计划排在 P2，但 P2 授权禁止 seed；域内又无 P4 可接，形成撞车 |
| B-3 | 真实字节资产上传链路 | `seedExecutionPlan.assetUpload` 要求经 `stageOperationsCatalogAsset` 走 HTTP_MULTIPART、`contentMustBeRealBytes: true` | 同上，需 runtime |

**边界更正（Dexter 追加裁决）**：API 与 L2 是两条独立验收链。API 只用自己的 owner-HTTP fixture，
L2 只用自己的浏览器可见 fixture；两者不得读取对方报告或共享运行时对象。catalog-inventory seed 只服务最终 DEV
体验，不是 API/L2 前置。`consumerBindings` 仍可共享契约/场景定义，但不再表示共享数据库状态。

---

## C 类｜需求范围内、但无强制落点（1 项）

| # | 项 | 依据 | 现状 |
|---|---|---|---|
| C-1 | 「任何地方不持久化 URL」无门 | 需求 §5.4 结论一：切 CDN 就是换配置零代码，**前提是守住三条**，第一条即「任何地方不持久化 URL」，并特别点出「未来菜单发布冻结快照时冻结 assetRef 而不是 URL」最易踩 | 全仓无任何 gate、断言或 checker 覆盖该约束。当前实现正确（业务侧存 ref，URL 由 `MinioAssetObjectStorage.publicUrl` 读时现算），但**无回归保护** |

最小收口：一条机械门即可——断言业务 schema 与 owner 写路径不出现持久化的 URL 字面量/字段。
属"反复发生、纯机械、维护成本小于返工"三问都过的门，成本分钟级。

---

## D 类｜既有 baseline 债（2 项，归属需 Dexter 裁定）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| D-1 | strict OpenAPI 未解析 | `openapiContracts: KNOWN_BASELINE_FAIL; R5_STRICT_OPENAPI_UNRESOLVED=110` | P2 notes 明确记为 pre-existing baseline failure，未被静默重分类为 P2 成功 |
| D-2 | contract-face 历史重复 operation identity | `contractFace: KNOWN_BASELINE_FAIL; historical duplicate operation identity for preflightOperationsLocalCatalogCopy` | 同上 |

**我的判断**：这两条是**全仓既有债，不是商品库存域引入的**，塞进本域 P4 会把 P4 撑成杂物间。
建议登记到 `HANDOFF.md` 或 R6 相应包，**不默认并入 P4**。但 D-2 的重复 identity 恰好落在本域的
`preflightOperationsLocalCatalogCopy` 上，若 Dexter 认为顺手收掉更划算，也说得通——**这一条请你定**。

---

## E 类｜历轮 review 未闭的 N（3 项）

来自 `doc/review/platform/2026-08-06-v2s-catalog-inventory-p2-implementation-review-claude.md` §7.4，
均在既有批准边界内、可由 Codex 自主处置，不必等 P4：

| # | 项 | 最小修复 |
|---|---|---|
| E-1 | `dictionaryKindMatches` 无行为测试覆盖 | 在 `CatalogDictionaryKindTest` 追加一条断言，一行 |
| E-2 | evidence 的 DB 次数分母缺 `UNVERIFIED_REQUIRES_EVIDENCE` 标记 | 补标记（与 A-2 同源，A-2 收掉后本条自然消解） |
| E-3 | `CatalogOwnerService:199` 序列化后子串匹配 | 改为遍历数组元素 equals 比较 |

---

## 1. 已核实**有**落点、不进 P4 的项（负空间说明）

为避免把已覆盖的东西重复塞进 P4，以下逐项核实过确有落点：

- **O-07 库存变化（Dexter 裁定「改造而非二选一」）** —— 已落地。三阶段设计 §3.4.3 读模型明确含
  「今日/7日/30日变化、最近变化 source/time」，且「销售消耗趋势」被列入必红 mutation 清单，
  正确实现了「改名为库存变化 + 展示真实流水聚合 + 不造伪销售指标」的裁定。
- **左树能力 / 智能视图（§5.6.8 从 v4 保留项升格为明确需求）** —— IA 文档已收（多处落点），属 P3 实现面。
- **18 条 v6 差异 D-01…D-16** —— 三阶段设计 §3.8 有「18 条差异与 fixture/red 对账」，
  §5 必红清单逐条点名（项目级 production tag、总公司 balance/ledger、SalesStockView、
  PreparationProfile entity、共享 OptionGroup、四个 plan command 等）。
- **C-16 / C-17 / C-19 三条 Dexter 裁定** —— 设计 §7 有终态与三阶段强制验证列。
- **89 IA-ID 判 CLOSED** —— 设计 §2.2 明确「三阶段完成后才可判 CLOSED」，由 P3 收，不属 P4。

## 2. 有意 Out of scope、**不是** P4 的项

以下是需求文档中经裁定明确排除的，不得因"看着没做"而扫进 P4：

- Excel 批量导入导出（未证明该用户任务）；
- 菜单与渠道摘要、套餐引用列（06 域不在本期，展示会造出不存在的事实）；
- v4 右上角「导出库存现状」；
- 库存扣减/恢复的执行逻辑（表按模型完整原则建，逻辑本期不建）；
- 外部 ERP 与权益服务权威（整体延后，承 v1 Q4）；
- 四个 plan command 与计划创建执行逻辑（interface-reserved，明确不暴露 API）；
- 商品上的「卖不卖」字段（本期不做菜单即不产生销售项，该概念不存在）。

---

## 3. 本登记的置信边界（如实声明）

- A 类、B 类、D 类、E 类：**逐条打开 evidence 与设计原文核对**，出处已在表内标明，置信高。
- C 类：基于对 CDN 三条约束的定向检索得出「无门」，检索为负面结论，已换多种字段惯例复核。
- **未做穷举**：我没有把需求 §5.3 的 40 条业务事实与 89 个 IA-ID 逐条对实现做全量 sweep，
  而是对高风险项（资产/CDN、库存变化、左树、复制、差异登记）做了定向核验。
  **若 Dexter 要求 P4 范围必须是穷举结论，需要单独再开一轮全量对账**——本文不冒充那个结论。
- 本文不含任何 runtime 判断；A/B 两类的"未做"是依据 evidence 自报状态与授权边界，不是我实跑所得。

---

## F 类｜2026-08-07 追加：P3 的运行时验收（Dexter 裁定转入）

依据 Dexter 2026-08-07 指示：「第二阶段的接口测试和第三阶段的 L2 测试都没做，
你把他们都放到 P4 里面吧，本次就只做静态验收」。
出处：`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json`
与 `...-p3-ia-control-reconciliation-codex.json`，均为当前字节复核所得。

| # | 项 | 当前状态 |
|---|---|---|
| F-1 | P3 的 18 definitions / 43 cases 受管 L2 实跑 | `managedL2: NOT_EXECUTED_REMOTE_GUARD` |
| F-2 | P3 business evidence | `businessStatus: NOT_STARTED` |
| F-3 | P3 cleanup evidence | `cleanupStatus: NOT_STARTED` |
| F-4 | 89 个 IA 控件的 runtime 验证 | 89/89 全部 `runtimeStatus: UNVERIFIED_REQUIRES_EVIDENCE` |

**与 A-1 的关系**：F-1..F-4 与 A 类同属「需一次 runtime 授权才能收」，
建议与 A 类合并为 P4 的同一个交付单元，一次授权把 P2 的 API 与 P3 的 L2 一起收完。

**重要限定（不得混淆）**：本次转入 P4 的**只有运行时验收**。
P3 的静态实现缺口（89 控件仅 29 条完整实现、五步复制、quickManage、库存筛选与动作等）
**不属于 P4**，仍是 P3 本身未完成的工作，详见
`doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-static-implementation-review-claude.md`。

## 4. 授权边界

本文仅为范围登记，**不授权**任何实施动作，也不授权 P4 启动。
P4 何时做、是否接纳 D 类、是否需要先补穷举 sweep，均由 Dexter 裁定。
