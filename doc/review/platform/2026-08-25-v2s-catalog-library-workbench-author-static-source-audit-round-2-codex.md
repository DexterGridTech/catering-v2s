# 商品库工作台优化：作者静态源码审查 Round 2

`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_STATIC_AUTHOR_AUDIT_20260825`  
`REVIEW_ROUND=2`  
`reviewerKind=AUTHOR_STATIC_SOURCE_AUDIT`  
`STATUS=SOURCE_RECONCILIATION_READY_FOR_MACHINE_GATES_NOT_A_DYNAMIC_VERDICT`

本轮在 Round 1 的修复后重新打开 owning source；不是对上轮结论的采信。以下结论只表示
源码结构已通过作者静态审查，仍须经 generator、编译、focused、Testcontainers、L2 和受管 runtime 证伪。

## 1. 十二维对账结果

| 维度 | 设计约束 | 当前 source 复核 | 结论 |
| --- | --- | --- | --- |
| 行为 | View/Edit 分壳；编辑→配置持久化后恢复；商品生产标签 0..1 | `CatalogItemDrawer` 路由两个独立 surface；`useCatalogItemEditorWorkspaceState` 在跳配置前 `persistCurrentDraft`；draft 为 `selectedProductionTagRef` 单值 | 静态一致 |
| 形态 | 仅一个第一层 Drawer；查看不是 disabled Form；九事实族独立 View/Editor | `CatalogItemViewDrawer` 消费 `CatalogItemViewSections`；`CatalogItemEditorWorkspace` 消费九个 `*Editor`；View 不复用 editor form | 静态一致 |
| 动作 | 新建/编辑/批量/复制/生命周期的业务动词和确认语义明确 | surface 对应 `CatalogWorkspaceTask`、drawer lifecycle 和 typed problem feedback；不以技术 code 面向用户 | 静态一致，待 L2 操作证据 |
| 关系 | 父商品与 SKU 同表头；单商品单标签；copy 可跨多商品闭包 | `CatalogItemListTable` 使用 children 行；DB partial unique；copy plan 仅以 `productionTagDefinitionRefs` 表示多商品定义闭包 | 静态一致 |
| 位置 | 十列固定顺序、横向滚动；查看/编辑/配置同层互斥 | 列顺序为商品→商品形态→价格和单位→规格或选项→商品属性→制作信息→库存与 BOM→更新时间→状态→来源；`scroll.x` 为列宽和 | 静态一致，待浏览器布局 |
| 文案 | 业务语言；统一“商品形态”“生产标签”；未实现路由不得暗示已经路由 | `CatalogUserVisibleCopy` 覆盖 catalog UI source；生产标签说明改为“供后厨识别”；禁词表含“商品类型” | 静态一致，待门执行 |
| 限制 | 每格最多四行；集合第四行/Tooltip；规格列四条真实值；单位候选/分类资格 owner 决定 | `businessLines` 对通用集合和规格列分支；TreeSelect 候选带 `selectable/disabledReason`；单位只取 active candidate | 静态一致 |
| 状态所有权 | server=RTK currentData；draft=`useCatalogItemDraft`；瞬态=local | `useCatalogItemEditorSession/useCatalogItemDraft` 与 configuration reducer 没有 server mirror；切换 scope/brand/drawer identity 清上下文 | 静态一致 |
| 控件级联 | 分类四场景 TreeSelect；筛选/游标/范围切换清旧上下文 | 新建、编辑、批量移动、挪父全部 TreeSelect；普通树/搜索树“加载更多”均可展开、不可选 | 静态一致，待 focused/L2 |
| 失败与恢复 | 写失败保留草稿；版本旧草稿不可覆盖；关闭三径处理脏态 | draft restore 有 RECOVERABLE/STALE/CORRUPT 分支；错误聚焦，资源释放失败可重试关闭 | 静态一致，待行为运行 |
| 可访问/焦点 | 问题可聚焦；状态不只颜色；关闭恢复 trigger | error ref 带 `tabIndex=-1`；tab/status 有文本；workbench 维护 detail trigger focus | 静态一致，待 browser L2 |
| 数据来源与失效 | 表格摘要 owner set-based；无客户端过滤/acceptedPage；精确失效 | list 消费 `currentData` owner summary；分类候选 task read；字典 query 的 cursor resetKey 含 scope/brand/filter | 静态一致，待 HTTP/DB count |

## 2. Round 1 修复的反向扫描

1. 正向运行模块与前端 source 已无 `tagKind/tag_kind/productionTagKind`。历史 migration、新 retirement migration
   及 red fixture 是唯一允许的历史证据。
2. `productionTagRefs/addProductionTagRefs` 在正向运行中只剩 owner 的“拒绝已退役输入”边界；迁移与负向测试
   继续点名旧字段。跨商品 copy closure 显式命名为 `productionTagDefinitionRefs`，不能再被误读为单商品数组。
3. catalog UI 生产组件没有 raw `testId(\`catalog-…\`)` 散写；动态 BOM 行由 owner identity 或仅前端 `editorId`
   标识，后者不会进入 save body。
4. 所有分类赋值控件都是 TreeSelect；没有发现把分类候选平铺为 Select 的正向入口。
5. 十列表格的 SKU 状态 source 复读为单次枚举渲染；Round 1 所见的重复文本不是当前 source 事实。

## 3. 允许残留与禁止残留

| 字符串/事实 | 允许位置 | 禁止位置 |
| --- | --- | --- |
| `productionTagRefs` / `addProductionTagRefs` | migration 的旧数据清理、P1 red mutation、owner reject、负向测试 | contract 正向 schema、owner 正向 save/read/copy payload、frontend draft/UI、seed/L2 正向 fixture |
| `productionTagDefinitionRefs` | 内部多商品 copy/preflight 定义闭包 | 商品 save/detail/page、SKU profile、选项 effect、用户可见文案 |
| `tagKind` / `tag_kind` | 历史/retirement migration 与 P1 red mutation | 现行 contract、owner definition、UI、seed、L2、copy comparisons |

## 4. 本轮静态结论与下一门

`FIRST_FAILURE=STATIC-04`（分类树分页节点被禁用）；`LAST_KNOWN_GOOD=Round 1 修复前的 owner-backed
TreeSelect 和单值标签设计`；`BROKEN_BOUNDARY=树控件的加载节点状态`。该问题已同根修复，并在 Round 2
重新读取 source。

`BUSINESS=NOT_RUN_STATIC_SOURCE_RECONCILIATION_ONLY`  
`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`

下一步才可执行 CP-03 的受管生成链与静态/编译门。任何门失败仍须回到本对账表的十二维重新定位，
不得摘场景、降低 oracle、增加 fallback 或以局部修补冒充收口。
