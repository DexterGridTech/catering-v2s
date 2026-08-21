# 商品属性库、点单选项库与两步新建 — Claude IMPLEMENTATION review intake

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SOURCE=doc/review/platform/2026-08-20-v2s-catalog-library-implementation-review-claude.md
CLAUDE_VERDICT=GO_WITH_UNVERIFIED_UI
CLAUDE_M/S/N=0/0/2
INTAKE_STATUS=ACCEPTED_NONBLOCKING

## 结论 intake

Claude 的 `ACTION_1_VARIANT=1-A`、`L1_ENGINEERING=PASS`、`L2_USER_VISIBLE=PASS`、真实 backend-acceptance 时序对账和 `GO_WITH_UNVERIFIED_UI` 结论已与当前源码及最新受管证据逐项复核，接受为本批 IMPLEMENTATION 复核结论。

最新 run `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787230542611-7994/run-manifest.json` 仍为 `status=PASS`、`firstFailure=null`、business/cleanup 均 PASS；结果文件 72 条均为 `CONTRACT=PASS`、`BUSINESS=PASS`、`HAND_WRITTEN_BUSINESS_ORACLE`。当前工作树的商品工作台 `CatalogWorkbenchPage.tsx` 无 `<Tabs`、`catalogArea` 或独立定义库入口；`CatalogDefinitionLibraries` 的唯一消费者是 `CatalogDictionaryDrawer`，商品元数据 Modal 维护六个并列页签。

## N-1：组件测试欠账

处置：`CONFIRMED_RETAINED_FOLLOW_UP`，不阻断本批，不在本批扩展测试面。

Claude 指出的四个最小组件测试目标登记为后续批次欠账：

1. 列表首列为业务名称并能进入详情；
2. 首步 Modal 只显示编码、名称、分类、形态四项；
3. 点单选项三栏中不同可选项的原料不混排；
4. 最大可选数为 1 时仍显示“多选（最多 1 项）”。

当前模型/静态测试与真实 acceptance 已覆盖对应事实，但没有把九屏渲染全部提升为组件测试；不把模型测试或 backend acceptance 冒充浏览器 UI 证据。

## N-2：preflight 污染修复留痕

处置：`REJECTED_WITH_EVIDENCE`（不改生产代码）。Claude 所称“源码没有修复注释”与当前工作树不符：

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java:378-381` 已说明 `mergeCopyPreflight` 会原地追加 owner facts，并在合并前保存 catalog-only compatibility rows；
- 同文件 `:499-501` 对 brand copy 也保留同一边界说明；
- local copy 使用快照行 `:393-394`，brand copy 使用快照行 `:515-516`，过滤 catalog disposition 不再读取已合并库存处置。

该处置不否认历史失败的运行证据：`r5-tc-1787229384842-88619` 的 422 首败与 `r5-tc-1787229777851-95550` 的 focused PASS 仍是日志驱动修复链；只是当前源码已经有足够的精确注释和修复点，故不追加无必要的代码改动。

## 明确保留的撤回结论

不得删除或统一套餐组件域的 `selectionRule=FIXED`。`CatalogItemDrawer.tsx` 约 `:4241`、`:4297` 属于 `catalog-item-composite-groups-editor`；本批点单选项使用 `selectionMode`，只允许 `SINGLE`/`MULTIPLE`。两者是不同业务域，当前实现保持正确隔离。

## L3 未验证清单

以下事实只完成静态/契约/后端证据，未执行浏览器 L2，不能声称已验证：

1. 商品元数据 Modal 中两个库的实际渲染与切换；
2. 定义库嵌套表单在浏览器中的动态表现；
3. 首步 Modal 关闭后打开 Drawer 的真实点击衔接；
4. 九屏容器宽高、唯一滚动容器与视口不溢出；
5. 1280px 以下三栏及嵌套原料表的实际布局；
6. 501 条超限时前端实际呈现的业务错误文案。

这些是本批明确未授权的浏览器 L2 证据，不是本批阻断缺陷。

## 复核边界

本 intake 不授权新的代码、契约、数据库、测试、数据、DEV、seed、reset、浏览器 L2、UAT、发布或仓库控制动作。后续若 Dexter 进行体验并提出问题，应按 `EXPERIENCE_RETROSPECTIVE` 动作 1-A 重新从源码提取用户可见事实，并枚举同族全集后再修复。
