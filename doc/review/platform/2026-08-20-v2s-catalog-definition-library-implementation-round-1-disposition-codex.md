# 商品属性库、点单选项库与两步新建 — implementation 独立盲审第 1 轮处置

```text
REVIEW_CYCLE_ID=CATALOG_DEFINITION_LIBRARY_IMPLEMENTATION_20260820
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
AUTHOR_DISPOSITION_OWNER=Codex
INDEPENDENT_VERDICT=doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-independent-review-round-1-claude.md
```

本文件只记录独立 finding 产生后的 owning-source 重开、反例核对与处置；不代写独立 verdict，
不把静态证明提升为 HTTP、浏览器或运行环境证明。

| Finding | 复核结论 | owning-source 复核与反例 | 处置 |
| --- | --- | --- | --- |
| M-01：点单选项库的 same-code 复制语义无可执行身份 | `DEXTER_DECISION` | `V20260820_010000_000__catalog_item_definition_libraries.sql` 及当前 generated wire 对点单组和值都没有 code。属性定义的同编码冲突已可比对；不能把点单定义的显示名或 UUID 当作“同编码”的替代。反例成立：不同名称可被人为改成相同，UUID 又跨 scope 不稳定。 | 等待 Dexter 裁定点单组选项组和值的业务编码及可变性，或另行裁定可比较的业务身份。此裁定前不扩展 copy closure，也不伪造 hard BLOCKED。 |
| M-02：自由 JSON/商品内联点单仍在运行时链路 | `CONFIRMED`，已根治，待第 2 轮核验 | 新增 `V20260820_010000_001__retire_item_attribute_json_and_order_option_relations.sql` 删除旧列和 item-owned 表；`CatalogOwnerService` 不再读写/复制这些事实，旧 raw 输入被 422 拒绝。前端 `catalogModel.ts`、`CatalogItemDrawer.tsx`、`CatalogWorkbenchPage.tsx` 已改为 `categoryRef`、`attributeAssignments`、`orderOptionConfigs`；SKU `attributeValueRefs` 是独立规格轴，保留作为反例。受控 shape manifest 同步重生。 | 静态复证已通过：backend `compileJava`/`compileTestJava`；operations-admin typecheck、65 个 unit、33 个 architecture tests。第二轮独立审查必须重开这些路径确认无残留。 |
| M-03：逐变更点前读/后读留痕缺失 | `CONFIRMED` | 第一轮独立 checklist 的确没有可审计的逐点前读/后读记录。事后从概览、聊天或静态成功倒推会形成伪证，不能补造。 | 保留为本批治理缺口；从本 finding 后的 M-02 修复开始，已按 owning source、需求/IA/详设、同根扫描与静态 proof 记录。该措施只防后续再犯，不能撤销既有 M-03。 |

## 当前可证实边界

- 静态编译和前端测试均通过，但受管 `scripts/test/backend-acceptance` 因现有、非本任务拥有的 DEV manifest 资源触发 `LOCAL_MANAGED_RESOURCE_BUDGET_EXCEEDED`；`testExecution=NOT_RUN`、`cleanup=FAIL`。它不构成 HTTP 业务 PASS。
- 未执行 DEV、seed、reset、浏览器 L2、UAT 或 Git 操作。
- 在 U-02 未裁定及受管资源预算未解除前，不能诚实发起第 2 轮独立审查并宣布本批完成。
