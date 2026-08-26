# 库存与 BOM 配置对象导航整改对抗审查

`REVIEW_TARGET=IMPLEMENTATION_REMEDIATION`  
`REVIEW_CYCLE_ID=CATALOG-INVENTORY-OWNER-NAV-20260826`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

## 输入

- `doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-plan-codex.md` §R-08
- `doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-design-addendum-codex.md` §A-05
- `CatalogInventoryBomView.tsx`、`CatalogInventoryBomWorkbench.tsx` 与现有 `CatalogDetail` 模型

## 盲审与结论

审查者先以截图中的查看态为准核查根因，再读取整改方案和实现。原问题确认：此前只重做了编辑态，查看态
仍以 AntD primary button 呈现配置对象，且两套组件分别维护对象命名、选中态和回退行为。因此此前称为
“已完成视觉整改”不成立。

结论：`GO`。共享 catalog-local 呈现件是最小且正确的收敛点：它复用现有详情中的商品、规格、选项值名称，
不增加契约、请求或候选生命周期；查看态和编辑态仅各自保有本地选择，不写入草稿。不得把该任务型呈现件
迁入 foundation，也不得重新引入 primary/提交式样式。

## 实施后必须核验

1. 查看态和编辑态均使用同一个 `CatalogInventoryRuleOwnerNavigation`；
2. SKU/选项行主文案是已加载的业务名称，编码仅为次要识别；
3. 当前项是浅色填充加左侧指示，不带 `ant-btn-primary`；
4. 节点删除后选中项回退首项，不写入 draft；
5. focused test、typecheck 与真实页面均证明上述四项。
