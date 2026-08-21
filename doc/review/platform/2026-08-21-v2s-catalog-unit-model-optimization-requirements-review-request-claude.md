# Claude 评审请求：商品计量、销售单位与库存单位优化需求分析

## 背景

本轮交付是“商品计量、销售单位与库存单位优化”的正式需求分析。Dexter 已确认：每个可销售商品或 SKU 只有一个有效销售单位；不同售卖规格应由 SKU 或独立商品表达，不能以一个商品的销售单位多选代替。

该文档在进入 Journey、交互、IA、implementation-facing 详设与实施之前，先冻结业务模型、典型场景、既有材料对照以及 v2s 前后台缺口。它不是上述后续工件，也不授权代码、契约、数据库、seed、DEV 或数据操作。

## 评审目标

请独立审查需求分析是否：

1. 正确区分销售单位、基础计量单位、库存消耗单位、盘点单位、`measureMode`、SKU 与 BOM；
2. 对“单一销售单位 + SKU/独立商品承载规格差异”的业务结论论证充分，且没有把 UI 单选当作完整方案；
3. 用餐饮业务例子说明了配方型销售、直接库存销售、包装规格、称重销售、服务与点单加料的正确边界；
4. 与 v4、v6、v2s 原需求、当前前端、契约、catalog/inventory owner、复制和 seed 的冲突/缺口完整且可追溯；
5. 未擅自进入未授权的实现设计，且没有把历史实现或技术便利倒灌成产品规则。

## 需阅读文件

- `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md`：被审正式需求分析与唯一新产品模型；
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`：v2s 原单位三层、称重与库存边界；
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`：原商品资料销售单位交互语义；
- `project-memory/decisions/confirmed-business-language-corpus.md`：G-11/G-12 的商品、SKU、库存/BOM 术语边界；
- `scripts/generate/catalog-inventory-p1.mjs`：当前 `salesUnitRefs[]` 与多选 manifest 的源码事实；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`、`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDescriptorPicker.tsx`：当前前端数组型销售单位消费；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`：当前商品引用、保存与复制路径；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：当前 `measureMode`/库存消耗单位路径；
- Heritage（只读）：`../catering-server-v4/contracts/registry/catalog-item-editor-manifest.json`、`../requirement-doc/design-v6/01.领域设计/05-商品目录域.md`、`../requirement-doc/design-v6/01.领域设计/07-销售库存与物料扣减域.md`：v4 单销售单位与 v6 单位/库存模型的对照材料。

## 独立核验重点

1. 验证“销售单位多选”是否确为当前 v2s 的端到端数组模型，而 v4/v6 是否为单值模型；不要仅查一个前端控件。
2. 针对凯撒沙拉、330ml/500ml 可乐、面粉、称重牛肉、按次服务、点单加料六个例子，逐一检查：销售口径、库存真相、BOM、SKU 与盘点换算是否被错误混同。
3. 核对“库存消耗单位来自商品/SKU 基础计量快照”“盘点单位只服务录入”“`measureMode` 不是实际单位”是否同时保留 catalog/inventory owner 边界。
4. 核对 FE-UNIT-01..09、BE-UNIT-01..13 是否覆盖真实同根路径：契约/generator、前端 model/draft/renderer、catalog 引用/保存/复制、inventory StockTarget/BOM、seed 和测试；若认为遗漏，请给精确文件/符号与遗漏的业务后果。
5. 主动寻找两个反例：
   - 把“份菜→多种物料”错误建成一个单位换算；
   - 把“330ml 瓶”和“500ml 瓶”塞回同一商品的多个销售单位。
   评估本需求是否确实排除了这两种错误。
6. 不得将尚未开始的 Journey、交互、IA、详设、实施或数据迁移写成本文缺失；它们是本需求分析之后、另行授权的阶段。若需求分析本身存在尚未裁定的产品语义，请明确标为需要 Dexter 决定。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。findings 采用 `M` / `S` / `N`，每项必须带：精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

本件属于需求分析审查，不是 implementation-facing design 审查：请不要以缺 Journey/IA/详设模板栏目作为 finding；只审查本分析文件应承担的业务模型、来源对照、范围边界和现状缺口。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次《商品计量、销售单位与库存单位优化》正式需求分析。

背景：Dexter 已确认：每个可销售商品或 SKU 只有一个有效销售单位；不同售卖规格必须由 SKU 或独立商品表达，不能用一个商品多选“杯、瓶、份、箱”等单位代替。本轮先冻结业务模型、典型场景与 v2s 前后台缺口，尚未进入 Journey、交互、IA、implementation-facing 详设、实施或数据操作。

目标：请独立核验该分析是否正确区分销售单位、基础计量单位、库存消耗单位、盘点单位、measureMode、SKU 与 BOM；是否论证了“单一销售单位 + SKU/独立商品承载规格差异”；是否完整梳理了当前 v2s 的前端、契约、catalog/inventory owner、复制与 seed 缺口，而非停留在把多选框改为单选框的止血方案。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md：被审正式需求分析与唯一新产品模型；
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md：v2s 原单位三层、称重与库存边界；
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md：原商品资料销售单位交互语义；
- project-memory/decisions/confirmed-business-language-corpus.md：G-11/G-12 商品、SKU、库存/BOM 边界；
- scripts/generate/catalog-inventory-p1.mjs：当前 salesUnitRefs[] 和多选 manifest 的真实来源；
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx、apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDescriptorPicker.tsx：当前前端数组模型；
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java：当前商品引用、保存与复制；
- apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java：当前库存消耗单位路径；
- Heritage 只读对照：../catering-server-v4/contracts/registry/catalog-item-editor-manifest.json、../requirement-doc/design-v6/01.领域设计/05-商品目录域.md、../requirement-doc/design-v6/01.领域设计/07-销售库存与物料扣减域.md。

请重点独立核验：
1. 当前 v2s 是否端到端把销售单位实现为数组，而 v4/v6 是否为单值；
2. 凯撒沙拉、330ml/500ml 可乐、面粉、称重牛肉、按次服务、点单加料六个场景的销售、库存、SKU、BOM 与盘点边界；
3. FE-UNIT-01..09、BE-UNIT-01..13 是否覆盖 generator/契约、前端、catalog、inventory、复制与 seed 的真实同根路径；
4. 本文是否明确排除了“把一份菜换算成某个总克数”和“把不同可乐规格塞进同一商品多选单位”两种错误；
5. 是否存在本文遗漏且需要 Dexter 裁决的产品语义。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 只评价正式需求分析的业务合理性、现状冲突覆盖与范围边界；不授权 Journey、交互、IA、implementation-facing 详设、实施计划、代码、契约、数据库、seed、DEV、数据操作或任何仓库控制动作。请不要把上述后续工件尚未存在作为本分析文件的缺项。谢谢。
```
