# 商品库观察问题整改方案对抗审查

`REVIEW_TARGET=PLAN`  
`REVIEW_CYCLE_ID=CATALOG_WORKBENCH_OBSERVED_REMEDIATION_20260826`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

## 输入

- `doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-plan-codex.md`
- `CatalogOwnerService`、`InventoryOwnerService`、`InventoryOwnerApi`
- `CatalogItemListTable`、`CatalogWorkbenchNavigationTree`、`CatalogItemGovernanceView`、`CatalogInventoryBomWorkbench`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md`

## 盲审结论

原方案 `NO-GO (M=1/S=2/N=1)`：

1. **M（已由 Dexter 的本轮直接 UI 裁定覆盖）**：旧 formal 将展开控件固定在 40px 工具列，方案要移至商品名称左侧。作者必须把直接裁定写为 formal、交互稿、IA 与 implementation design 的 addendum，不能悄然偏离。
2. **S（确认）**：`voidAvailability` 若只投影 catalog 自有事实，库存对象与用料仍会在提交时才暴露阻断原因。inventory owner 已有 `catalogItemVoidDependencies` judgement，detail 应调用它并形成同一用户可见摘要。
3. **S（确认）**：不得再产生或残留“SKU effective status”；父商品和 SKU 的生命周期是两条独立事实，正常 seed 要把体验商品父级转为启用。
4. **N**：保持 AntD expand column 的旧规则与用户的最新明确操作位置冲突，必须以 addendum 消解。

## 作者 intake

- M：`CONFIRMED_DIRECT_USER_SUPERSEDES_OLDER_FORMAL`。不保留旧工具列；写明 addendum 后实施。
- S（inventory）：`CONFIRMED`。`CatalogOwnerService.requireItemRetirementUnreferenced` 已用 inventory 的 owner judgement，detail 却未复用；修复必须让两条路径消费同一 inventory 事实。
- S（有效状态术语）：`CONFIRMED`。已从计划删除该模型；后续扫描不得保留该术语或第二状态。
- N：`CONFIRMED`，通过 addendum 一并关闭。

## 第二轮独立复核

`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

第二位 fresh reviewer 重开方案、附录和 owner/UI/seed source 后结论为 `GO (M=0/S=0/N=0)`：

- 商品名称左侧的唯一展开入口是 Dexter 本轮直接裁定；`showExpandColumn=false` 使选择列仍只服务批量选择。
- 详情的作废原因复用 inventory owner 的 `catalogItemVoidDependencies` judgement，不从 JSON 或前端推断。
- parent/SKU 生命周期仍为各自 persisted fact；体验 seed 仅经公开 lifecycle command 启用已完成配置的可售父商品。

## 实施后的静态证据

- `node scripts/generate/catalog-inventory-p1.mjs --write --check`：PASS（59 operations）。
- tokens、M1 bindings、P3 generation/self-test：PASS。
- operations-admin focused tests：3 files / 22 tests PASS；`yarn typecheck` PASS。
- catalog `compileJava` 与 `compileTestJava`：PASS；新增 owner regression 覆盖 DRAFT→未启用计数及 inventory 作废原因 readback。
- `node scripts/test/test-health-entry-runner.mjs --node`：PASS（28/28 files, 215 tests）。
- `node scripts/dev/catalog-inventory-seed-executor.mjs --self-test`：PASS，包含 experience lifecycle 红变异。

动态 Testcontainers、browser L2、reset、DEV start 与 seed 未在本观察整改轮运行；本轮没有它们的授权，静态 PASS 不替代动态证据。

## 实施后第二轮独立复核与处置

`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_CYCLE_ID=2026-08-26-CATALOG-OBSERVED-REMEDIATION`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

第二轮 reviewer 重新打开生成源、owner、generated wire、治理 View/Editor、表格、导航树、库存工作台、focused tests 与同根状态 surface：首轮 M（`INACTIVE = DRAFT + DISABLED` 的 fixture/red mutation）和 S（治理编辑态的泛化“引用/依赖”文案）均确认关闭；但发现生命周期状态 Tag 的颜色、SKU 解释 Tooltip 与多个 surface 尚未共享。

主代理按 `doc/platform/frontend-coding-standard.md` §3-K-7 处置该静态 finding，未变更任何 lifecycle 事实或命令：

- 新增 `CatalogLifecycleStatusTag` 为唯一 item/SKU lifecycle Tag presenter：草稿/default、启用/success、停用/warning、归档/processing、作废/error；显示 manifest 的业务中文而非枚举。
- 列表、查看抽屉、编辑抽屉、基础/治理详情、SKU 详情、套餐候选和复制候选均改为消费该 presenter；SKU 在父商品非启用时显示“规格状态独立维护；商品尚未启用时不会作为启用商品使用。”。
- 同根扫描确认 catalog-management UI 不再保留手写 lifecycle 颜色、旧“无引用/引用关系”或泛化“关联或依赖”作废原因；focused 测试增加五种状态颜色及 SKU 原始事实 Tooltip 判据。

处置后的静态证据：P1→tokens→M1→P3 PASS（59 operations）；operations-admin focused 3 files/23 tests PASS、`yarn typecheck` PASS；`THCL_NODE_TEST_ENTRY=PASS`（28/28 files、215 tests）。本 cycle 的独立 review 轮次已达到 2，依规则不启动第三轮；以上是主代理对 reviewer 具体 finding 的源码回读与静态验证处置，不把它表述为新的独立 GO。

本整改轮未获授权也未运行 Testcontainers、browser L2、DEV、reset 或 seed；`business=PASS_STATIC_ONLY`，`cleanup=NOT_APPLICABLE_STATIC_ONLY`。
