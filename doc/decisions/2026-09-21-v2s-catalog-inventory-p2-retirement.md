# catalog-inventory-p2 退役登记

状态：RETIRED

日期：2026-09-21

## 决策

`tools/catalog-inventory-p2/cli.mjs` 与 `scripts/check/catalog-inventory-p2` 已退役并移除，不再作为当前实施、验证、评审或门链输入。

## 原因

ProductionTagDefinition 已迁入 `catalog`，该检查器仍依赖已删除的
`fulfillment-production` 模块、旧 owner API、旧 schema 及历史 evidence 载体，继续保留会把已不存在的运行对象伪装成当前治理门。

## 边界

- 当前活动门链不调用 `catalog-inventory-p2`，也不以其退出码或输出决定 GO/NO-GO。
- 当前活动扫描根不包含已移除的 P2 文件；历史 review、evidence 与历史迁移中的文字只保留为历史记录，不重新解释为活动输入。
- P2 原来覆盖的 catalog/inventory 结构检查由现有 P1、verify-gates、capability-invariants、模块测试和 acceptance 分别承载；本登记不新增兼容 wrapper 或替代门。

## 复核要求

任何未来恢复同名检查器都必须先重新取得产品/验证范围授权，并以当前 owner、当前契约与当前 evidence 规范重新设计；不得从历史文件复制旧路径后直接启用。
