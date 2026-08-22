# 商品库存与 BOM 优化 · Implementation Review Request

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=V2S-CATALOG-INVENTORY-BOM-IMPLEMENTATION-20260822
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
REVIEWER_REQUEST=FRESH_INDEPENDENT_CLAUDE_REVIEW
DESIGN_VERDICT=CLAUDE_GO_M0_S2_N2_TEXT_FINDINGS_REMEDIATED
IMPLEMENTATION_AUTHORITY=Dexter_ACCEPTED
RUNTIME_STATUS=FINAL_SEED_INTERRUPTED_BY_DEXTER
```

## 背景

本轮把已接受的「商品库存与 BOM 业务模型正式需求」、Journey、UI/IA 与 implementation-facing design 落成实现。目标是让商品 shape、库存 owner 节点和扣减方式在 contract、catalog owner、inventory owner、operations-admin、acceptance 与 seed 中使用同一份准入矩阵，消灭旧的 flat inventory/BOM payload、第三真相、伪准入和单位漂移。

此前需求与设计评审已经 GO；上一轮设计 review 的文本 finding 已折入需求/详设，不能替代本轮 implementation review。请把当前源码和本轮新鲜证据当作唯一核验对象，本文件不是 verdict，也不预设 GO。

业务边界已由 Dexter 接受：

- `STANDARD_SALE_COUNTED` / `STANDARD_SALE_WEIGHED` 是商品级 owner；普通/称重商品不创建 SKU。
- `SKU_VARIANT_SALE_COUNTED` 只有 SKU 级库存/BOM owner；商品 shell 只保留 shape 允许的 `NONE`。
- `MATERIAL` 只能有商品级 `NONE`/`DIRECT`，原料可以没有销售单位，但必须有基础计量单位才可成为库存/BOM 组件。
- `OPTION_VALUE` 只能 `NONE`/`BOM`，不产生独立 StockTarget；选项正负行和实际用量归库存 BOM 事实。
- `COMPOSITE`、`SERVICE`、`BENEFIT_SHELL` 不建立本品库存/BOM owner；套餐内容不冒充库存 BOM。
- 计量单位单值；SKU 可以覆盖或清除覆盖并继承商品默认；库存消费单位来自商品/SKU 基础计量单位快照；盘点单位只服务录入换算。
- 源数量按源单位 precision 向零截断，目标消费数量按目标消费单位 precision 向零截断；不使用任意单位两两换算引擎。
- 被引用单位不可删除但可停用；停用只影响后续候选，不改变既有配置和历史快照。
- 基础计量单位变更沿用 U-UNIT-DESIGN-01 的安全守卫：已有 StockTarget 且新快照会漂移时，在 catalog 保存事务内拒绝，不能静默改写既有库存对象。

## 评审目标

请独立确认以下内容是否已经真实落地，尤其要找出“代码闭环但业务方向不对”“readback 看似通过但事实不一致”“测试/seed 没覆盖核心矩阵”的问题：

1. contract 是否是唯一准入真相，七种 shape × 三类 owner node × `NONE`/`DIRECT`/`BOM` 的正反例是否完整；catalog、inventory 和前端是否都遵守同一矩阵，是否仍存在旧字段、自由字符串、JSON fallback 或第二处准入声明。
2. owner 边界、同一 `REQUIRED` 事务、跨 owner command、锁与版本检查是否足以保证 catalog 保存、inventory target/BOM、单位快照和历史事实不漂移。
3. BOM 组件候选五条件、`component_eligible`、自引用/跨 scope/无基础单位/无 StockTarget/停用候选等边界是否在 owner 真实拒绝，而不是只在 UI 过滤。
4. 单位 precision、盘点单位回落、向零截断、`0.3567kg -> 356g`、历史快照不重解释是否由后端权威执行，前端是否没有第二套进位语义。
5. operations-admin 的库存/BOM UI 是否真的按 shape 展示最短、最自然的任务路径；是否误伤商品标签、SKU 销售属性或点单选项；`CatalogItemDrawer`、库存动作、单位库和候选列表是否与 IA/interaction artifact 一致。若 UI 事实无法从静态与运行证据确认，请明确列为未验证，不要推断。
6. acceptance、静态门和 rich seed 是否覆盖全部需求场景，而不是只覆盖 happy path；尤其是 63-case shape×node×mode admission matrix、SKU 独立 BOM、选项正负 BOM、公共组件、多 scope、单位停用、counting unit 有/无、A-05 四维守卫和历史快照。
7. 最近修正的 seed executor BOM 快照 readback 比较是否合理：BOM rows 落在 PostgreSQL JSONB 中，当前按 `unitRef/code/name/unitDimension/precision` 逐字段比较，而不是按 JSON key 顺序比较。请确认这是最小且正确的 readback 修复，不要把它误判为业务 owner 绕过。

请同时判断方案合理性：以当前轻库存边界看，contract shape 矩阵 + catalog 派生 owner + inventory 原子事实是否比保留旧 flat payload、兼容 fallback 或增加通用 BOM/单位引擎更简单可靠；若发现复杂度与收益不匹配，请作为 finding，而不是因为实现忠于详设就默认通过。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`：仓库边界、owner/事务、DEV 与 review 规则；
- `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json`：授权入口与 Roadmap 授权字段；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md`：正式业务需求；
- `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md`：已接受 Journey 与 shape/node/mode 前提链；
- `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md`：交互事实与用户可见语义；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md`：IA 与不可见行为判据；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md`：实现边界、owner、事务、测试与 seed 判据；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md`：CP-00 至 CP-08 顺序与停机条件；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-instruction-codex.md`：本次实施入口与禁止项；
- `doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-review-claude.md`：上一轮设计 review 与已接受文本处置；
- `scripts/generate/catalog-inventory-p1.mjs`：唯一 contract/shape/seed 生成源；
- `scripts/dev/catalog-inventory-seed-plan.mjs`、`scripts/dev/catalog-inventory-seed-executor.mjs`、`scripts/dev/catalog-inventory-seed-executor.test.mjs`：seed plan、HTTP 物化/readback、最近 JSONB snapshot 修复与 regression test；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/`：catalog item、SKU、单位、BOM 派生与跨 owner coordinator；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/`：StockTarget/BOM owner、组件资格、快照、数量归一化、生命周期守卫与 readback；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260821_090000_000__catalog_inventory_unit_model.sql`、`apps/backend/catering-business-server/src/main/resources/db/migration/V20260822_020000_000__catalog_inventory_bom_component_eligibility.sql`：单位模型与组件资格迁移；
- `apps/frontend/operations-admin/src/`：商品库存/BOM、库存动作、单位库和候选组件页面/组件；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`：真实 HTTP/Testcontainers acceptance 场景；
- `apps/backend/catering-business-server/modules/catalog/src/test/java/` 与 `apps/backend/catering-business-server/modules/inventory/src/test/java/`：owner/integration 语义测试；
- `scripts/test/test-health-entry-runner.mjs`、`scripts/verify`：静态 Node 分母与仓内静态门。

## 已有证据与证据边界

这些是 Codex 交接的可复核线索，不是请 Claude 直接采信的结论：

- contract/generator chain：P1 `OPERATIONS=57`、shape=7；tokens、M1 bindings、operation-handler bindings、P3 generate/self-test、P1 CLI self-test 均曾 fresh exit=0。
- 静态：`node scripts/test/test-health-entry-runner.mjs --node` 最近一次为 `DISCOVERED_TEST_FILES=21`、`EXECUTED_TEST_FILES=21`、108 tests pass；operations-admin typecheck pass，15 files/72 tests pass，ArchUnit 15/15 pass；`scripts/verify --validate-only` 为 `EXECUTED=15/15`、`R5_VERIFY_VALIDATE_ONLY=PASS`。
- 真实 acceptance：`r5-tc-1787357296043-49946` 曾得到 `DISCOVERED=80 SELECTED=80 HTTP_SUCCESS=80 REAL_BUSINESS_ASSERTIONS=80 STUB_ONLY=0 DIRECT_FAILURES=0`、business/cleanup PASS；证据目录为 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787357296043-49946`。请重新判断该 run 是否覆盖当前 production bytes，以及是否需要新的 full run。
- 关键 focused acceptance：A-05 mode-switch guard `r5-tc-1787351700505-38784`；无 counting unit 精度保持 `r5-tc-1787349578304-35344`；0.3567kg 截断 `r5-tc-1787350081777-36247`；组件/选项/单位语义 `r5-tc-1787350833075-37345`；63-case admission matrix `r5-tc-1787353427492-42295`。这些证据必须按代码 mtime 与运行时间重新判断，不得只按文件名采信。
- 受管 runtime：最近 reset `r5-reset-2900839a-8648-4900-b4da-a2cf7d07239e` 与 start run `rm1-seed-27219cd7-052c-4155-b1f0-ad0fddfb70c4` 均 PASS；随后 final seed 因 Dexter 要求停止，在 owner-command heartbeat 阶段受控中止。该 parent run 为 `complete-seed-a097bdfe-fe9b-4d1f-a62e-e22ee0c1d173`，只有 plan PASS，没有完整 seed business/cleanup PASS，不能作为最终 seed 成功证据。
- 之前一次完整 seed 曾在 `SEED_BOM_READBACK_FACT_MISMATCH:HEAD_COMPANY:LATTE-001:LATTE-SKU-S` 失败；结构化事件显示 HTTP 200 和 owner readback 已发生。当前修复是 executor 对 JSONB snapshot 改为逐字段语义比较；请独立确认修复与残余同族比较。
- 本轮未执行 browser L2、UAT、部署；DEV 页面可达或已有截图都不能替代这些层级。

## 独立核验重点

请按源码和新鲜证据逐项复核：

1. 从 generator 的 shape/node/mode manifest 重新列出 63 个 admission case，检查 acceptance 是否每项都有合法/非法 oracle，并检查 owner 是否拒绝篡改请求。
2. 对 catalog whole-save → coordinator → inventory command 的写路径做 owner/事务/锁/版本追踪；确认单位快照只在允许的创建/配置路径产生，既有余额/流水/BOM/历史快照不会被静默重解释。
3. 对 `InventoryOwnerService` 的 `TargetRow`、BOM normalize/readback、`component_eligible` 和无 counting unit 回落做空值、scope、N+1 与历史 snapshot sibling scan；指出尚未覆盖的反例。
4. 对 `scripts/dev/catalog-inventory-seed-executor.mjs` 的 `sameUnitSnapshot` 以及所有 snapshot comparison 做同根检查；确认没有留下依赖 JSON key order 的同族断言，也没有把业务字段比较降级为只比较 targetRef/quantity。
5. 复核 `CatalogAcceptanceScenarios.java` 的 15 条需求场景、shape×node×mode 全矩阵、BOM 候选五条件、选项正负行/实际用量、A-05 四维守卫和 0.3567kg 判据；报告真实 discovered/selected/执行时间边界。
6. 复核 operations-admin UI 是否遵循 accepted IA/interaction，特别是普通/称重无 SKU、SKU 商品无商品级并存、MATERIAL 无 BOM、option value 无独立 target、单位库“正在使用”、零引用单位可编辑与 precision 提示。
7. 把所有 user-visible/runtime facts 分成 `L1_STATIC`、`L2_TEST`、`L3_UNVERIFIED`；当前受控中止的 final seed、browser L2、UAT 必须保持在未验证组。

## 期望结论

请给出明确结论：

```text
GO 或 NO-GO
M/S/N = <major>/<significant>/<note>
```

每条 finding 请给：

- `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`；
- 仓库相对路径和精确行号；
- 对业务、owner、contract、数据、用户任务或证据层的影响；
- 最小修复建议及适用边界；
- 是否需要 Dexter 产品/Journey/范围裁决；
- 对同根 sibling 的枚举与已检查数量，避免只修复点名文件。

如 `L3_UNVERIFIED` 非空，请按 review 标准明确披露，不要把它写成无条件 bare `GO`。本轮 review 不要求你执行 reset、seed、DEV 生命周期、browser L2、UAT、部署或任何 Git 操作；若认为必须新增动态证据，请标注为证据缺口并说明最小授权动作。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 catering-v2s 本轮「商品库存与 BOM 优化」做一次独立 implementation review。

背景：本轮已按 Dexter 接受的正式需求、Journey、UI/IA 和 implementation-facing design 完成 CP-01 至 CP-07 的 contract、generated chain、catalog/inventory owner、operations-admin、acceptance、seed source/executor 与静态验证实现。此前设计 review 已 GO，但那不替代本轮 implementation review。最近一次受管 final seed 在 owner-command heartbeat 阶段因 Dexter 要求停止，只有 plan PASS，没有完整 seed business/cleanup PASS；请不要把它当作最终 seed 成功证据。

目标：请独立核验 shape×node×mode contract 准入、catalog/inventory owner 与事务/锁/版本边界、BOM 组件资格、单位快照和 precision/truncation、operations-admin 用户任务、acceptance/seed 覆盖与证据真实性。请特别检查最近的 seed executor 修复：BOM 快照存于 PostgreSQL JSONB，readback 现在按 unitRef/code/name/unitDimension/precision 逐字段比较，避免 JSON key order 导致假失败；请确认没有遗漏同族断言，也没有把业务校验降级为只比较 targetRef/quantity。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md：正式业务需求；
- doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md：已接受 Journey 与 shape/node/mode 前提；
- doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md：交互与用户可见语义；
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md：IA；
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md：owner、事务、测试和 seed 设计；
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md、doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-instruction-codex.md：实施范围与停机条件；
- scripts/generate/catalog-inventory-p1.mjs：唯一 contract/seed 生成源；
- scripts/dev/catalog-inventory-seed-plan.mjs、scripts/dev/catalog-inventory-seed-executor.mjs、scripts/dev/catalog-inventory-seed-executor.test.mjs：seed plan/executor/readback 修复；
- apps/backend/catering-business-server/modules/catalog/src/main/java/：catalog owner/coordinator；
- apps/backend/catering-business-server/modules/inventory/src/main/java/：StockTarget/BOM owner、快照、精度与生命周期守卫；
- apps/frontend/operations-admin/src/：库存/BOM、库存动作和单位库 UI；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java：真实 HTTP/Testcontainers acceptance；
- scripts/test/test-health-entry-runner.mjs、scripts/verify：静态验证入口。

请重点独立核验：
1. 七种 shape × 三类 node × 三种 mode 的完整正反准入矩阵，以及 owner 对篡改请求的真实拒绝；
2. catalog whole-save → coordinator → inventory command 的同一 REQUIRED 事务、锁、版本和 U-UNIT-DESIGN-01 守卫；
3. BOM 候选五条件、component_eligible、自引用/跨 scope/无基础单位/停用候选、空 BOM 和 SKU/option owner 边界；
4. 源单位 precision、目标消费单位 precision、向零截断、无 counting unit 回落、0.3567kg→356g、历史 snapshot 不重解释；
5. 普通/称重商品无 SKU、SKU 商品不出现商品级并存、MATERIAL 无 BOM、OPTION_VALUE 无独立 StockTarget，以及 UI 是否符合 IA 且没有误伤标签/SKU 销售属性/点单选项；
6. acceptance 是否覆盖需求稿十五条、63-case admission matrix、A-05 四维、选项正负/实际用量、公共组件、单位停用和 rich seed；
7. 证据层级：静态、Testcontainers、managed DEV/seed、browser L2/UAT 必须分开，当前 final seed 受控中止与 browser L2/UAT 未验证必须如实保留。

请给出明确结论：GO 或 NO-GO，并按 `M/S/N = major/significant/note` 报告数量。每条 finding 请给出 CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION、精确仓库相对路径与行号、影响面、最小修复建议、是否需要 Dexter 产品裁决，以及同根 sibling 的检查范围。若 L3_UNVERIFIED 非空，请明确披露，不要给无条件 bare GO。

授权边界：本次请求只授权对现有实施做独立 review，不授权新增产品语义、不解除任何未决裁定、不授权下一 Roadmap step、reset、seed、DEV 生命周期、browser L2、UAT、部署或任何 Git 操作。谢谢。
```
