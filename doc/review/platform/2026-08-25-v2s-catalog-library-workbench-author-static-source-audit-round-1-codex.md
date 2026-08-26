# 商品库工作台优化：作者静态源码审查 Round 1

`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_STATIC_AUTHOR_AUDIT_20260825`  
`REVIEW_ROUND=1`  
`reviewerKind=AUTHOR_STATIC_SOURCE_AUDIT`  
`STATUS=IN_PROGRESS_NOT_A_VERDICT`

> 本文是进入任何编译、Testcontainers 或 browser L2 前的作者静态代码审查记录，不能代替
> fresh 独立审查，也不能代替动态证据。它执行 Dexter 要求的“先逐项对账、再做静态 review、
> 最后测试”。

## 1. 对账完成门（无轮次上限）

实现与下列已批准设计逐条对账：

- `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md`

只有以下十二维度全部一致，才可写“设计对账完成”：

1. 行为；2. 形态；3. 动作；4. 关系；5. 位置；6. 用户可见文案；7. 限制；8. 状态所有权；
9. 控件级联；10. 失败与恢复；11. 可访问/焦点；12. 数据来源与失效边界。

任一差异必须改代码或经 Dexter 重开设计；不得用局部测试、静态扫描、截图或“其余维度正确”降级。

## 2. 本轮已读 owning source

- `CatalogItemListTable.tsx`：十列、父/SKU 树行、四行截断、Tooltip、行身份、批量选择。
- `CatalogWorkbenchPage.tsx`、`useCatalogCategoryCandidates.tsx`、`CatalogItemCreateDrawer.tsx`、
  `CatalogItemBasicEditor.tsx`：四处分类 TreeSelect 与候选加载。
- `CatalogItemDrawer.tsx`、`CatalogItemViewDrawer.tsx`、`CatalogItemEditorWorkspace.tsx`、
  `useCatalogItemEditorWorkspaceState.tsx`、`useCatalogItemDraft.ts`、
  `CatalogItemEditorSectionAssembler.tsx`：View/Edit 分壳、九区段、草稿恢复、关闭与配置绕行。
- `useCatalogConfigLibrary.ts`、`CatalogDictionaryDrawerState.tsx`、
  `CatalogSimpleDictionaryLibrary.tsx`、`CatalogConfigurationDrawerSurface.tsx`：六库配置状态。
- `scripts/generate/catalog-inventory-p1.mjs`、`ProductionTagOwnerApi.java`、
  `ProductionTagOwnerService.java`、seed/L2 caller、迁移源码：生产标签单值与定义模型。

## 3. 发现与根因处置

| ID | 根因/影响面 | 处置 | 当前静态结论 |
| --- | --- | --- | --- |
| STATIC-01 | 动态 BOM 行曾使用数组 index 形成 testId；重排后控件、错误与 L2 locator 会指向另一行。 | BOM 草稿行增加只在编辑端存在、绝不序列化的 `editorId`；所有动态 testId 收敛到 `catalogTestIds`，由 owner 身份或 `editorId` 构造。 | 已改，待 Round 2 反向扫描与 focused proof。 |
| STATIC-02 | 通用多值表格单元格超过四行时仍显示四条事实，没有按 IA 显示剩余项；规格/选项列又不能照搬该规则。 | 通用集合改为前三条加“还有 N 项”及完整 Tooltip；规格/选项保留前四条实际业务事实，超出只在 Tooltip 展开。 | 已改，待 Round 2 逐列反查。 |
| STATIC-03 | 生产标签定义保留 `tagKind` 六值内部分类，既未获批准也没有已实现路由任务，形成第二分类事实。 | 从 P1、owner、持久化、copy、seed、L2 与 UI 退役；P1 对 create/update/readback 加精确零自检和 red mutation；新增严格 Flyway 移除列。 | 已改，尚未运行生成链/迁移。 |
| STATIC-04 | 分类候选的“加载更多分类”节点同时 `selectable:false` 与 `disabled:true`；作为树展开节点可能无法触发 `loadData`，长分类树无法继续读取。 | 保持 `selectable:false`，移除 `disabled`，使其只能展开加载、不能成为分类值；普通树与搜索树同改。 | 已改，待 focused/L2 验证。 |
| STATIC-05 | seed executor 的按编码查询标签 Map 沿用 `productionTagRefs` 旧集合命名，会与已退役 transport/path 混淆并弱化精确零审查。 | 改为 `productionTagByCode`；P1/self-test、迁移与测试里作为“必须拒绝的旧字段”的 red fixture 保留。 | 已改，待生成/seed readback 验证。 |

## 4. 已确认而不可越界的事实

- 商品详情使用 `CatalogItemViewDrawer` 与各 `*View` presenter；编辑使用独立
  `CatalogItemEditorWorkspace` 与各 `*Editor`，没有把禁用表单作为详情树。
- 编辑草稿的服务器事实、整单草稿、局部瞬态分别由 RTK、`useCatalogItemDraft`、最近组件/hook 持有；
  session key 包含 scope、brand、商品编码、version，关闭清空局部态，脏草稿不会被刷新覆盖。
- 新建商品、编辑商品、批量移动分类、分类挪父均是 TreeSelect，候选 `selectable/disabledReason` 来自
  owner task read；搜索结果也被重建为 path tree，未平铺成选择结果。
- 表格是同表头父/规格树表；十列顺序、最小宽度和 `scroll.x` 由表格组件明确声明，SKU 不参与父商品批量。

## 5. 本轮尚未关闭的审查项

- 九区段逐条 cascade、subtask working-copy、return-to-edit focus 和错误定位的行为级反查。
- 生产标签单值的 owner 七态、partial unique、preflight/Flyway 双 predicate、copy/seed 的全链对账。
- 生成链产物、类型/编译、focused、80/80、L2 readiness/24 case、动态 cleanup 均未执行。

因此本轮没有 BUSINESS 或 CLEANUP 动态结论；`FIRST_FAILURE` 为源码审查发现，
`LAST_KNOWN_GOOD` 为修改前已读取的现有 source，`BROKEN_BOUNDARY` 分别记录在上表，
不得写 PASS 或 GO。
