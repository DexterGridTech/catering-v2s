# 销售菜单图片与界面密度整改证据

日期：2026-09-07  
范围：`operations-admin` 销售菜单 Dev 页面  
状态：`DEV_BROWSER_VERIFIED`

## 1. 本次整改范围

逐项落实浏览器反馈：

1. 去掉重复的“门店销售菜单”页内标题；
2. “新建分区”使用主按钮样式；
3. 销售分区列表文字左对齐，并保持既有选中态语义；
4. 草稿销售项补齐商品主图展示；
5. 挂牌价放在第二列并收窄列宽。

## 2. 图片问题根因与修复

根因不在浏览器资源端口，也不在前端 `img` 渲染本身：销售菜单草稿 read model 原先没有把 Catalog 商品的 `defaultImageAssetRef` 投影到草稿项，继承商品图片的 UI 因而只能渲染占位内容。

本次按 owner → readback → wire → generated → frontend 的完整链路修复：

- `SalesMenuItemFacts.defaultImageAssetRef()` 作为 Catalog owner 的既有事实来源；
- `SalesMenuReadback.DraftItemView` 增加 nullable `catalogPrimaryImageAssetRef`；
- `SalesMenuOwnerService` 在草稿 readback 中传递该引用，published snapshot 保持既有边界，不反向读取 Catalog 当前图片；
- OpenAPI source、生成契约和 frontend generated API 同步更新；
- 新增 operations-admin 共享 `AssetPreview`，同时服务 Catalog 预览、销售菜单继承图片和自定义本地文件预览，未重复实现图片加载逻辑；
- 销售菜单草稿表在 `INHERIT_CATALOG` 模式读取 Catalog 主图，在 `CUSTOM` 模式读取菜单自己的展示图。

## 3. 代码与文档变更

- `apps/frontend/operations-admin/src/app/components/AssetPreview.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogAssetPreview.tsx`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemMediaEditor.tsx`
- `apps/backend/catering-business-server/modules/sales-menu/.../SalesMenuReadback.java`
- `apps/backend/catering-business-server/modules/sales-menu/.../SalesMenuOwnerService.java`
- `apps/backend/catering-business-server/modules/sales-menu/.../SalesMenuWireMapper.java`
- `contracts/openapi-source/sales-menu.schemas.json`
- `contracts/openapi/components/sales-menu/sales-menu.schemas.json`
- 销售菜单相关 unit/static/architecture tests、IA、交互设计、需求、实施设计、实施计划与 mockup。

旧的需求分析文档保留长期“总部参考菜单→门店本地复制”业务分析，并增加当前整改边界说明；本次没有新增 operation、数据模型或复制链路。

## 4. 静态与编译验证

- `scripts/check/sales-menu-contract`：PASS；`AFFECTED_OPERATIONS=31`、`SALES_MENU_OPERATIONS=30`、`SALES_MENU_COMMANDS=19`。
- `scripts/check/sales-menu-contract --self-test`：PASS。
- `scripts/generate/edge-codegen --write`：PASS，361 files。
- `scripts/generate/edge-codegen --check`：PASS，361 files。
- operations-admin typecheck：PASS。
- 销售菜单相关 operations-admin unit tests：37 test files、231 tests PASS。
- operations-admin architecture tests：44 tests，其中 40 PASS、4 TODO、0 FAIL。
- 本次变更前端文件 ESLint：PASS。
- 本次变更文件 Prettier check：PASS。
- `git diff --check`：PASS。
- backend catering-business-server `compileJava`：PASS。
- SalesMenu owner 单测：PASS。

全量 frontend architecture lint 仍受工作区既有的四个非本次销售菜单文件未使用 import 影响；本次目标文件 lint 已单独通过，未扩大范围修改无关模块。

## 5. Dev 浏览器逐项验证

受管 Dev manifest：

- manifest：`.runtime/r5/run-manifest.json`
- runId：`r5-dev-1788776271538-50745-aa4a5ecf-78b1-4254-b7bd-cea589c961d8`
- 拓扑：远端受信 Spring Boot + 远端数据库/对象存储，本机两个 Vite，经受管 HTTP/asset tunnel 访问。
- Spring Boot readiness：PASS。
- 本次未执行 reset、seed；Dev 保持运行用于体验。

浏览器页面：`http://127.0.0.1:5175/operations/aurora/catalog/sales-menus`

最终 DOM 与视觉核对结果：

- 页面内容区标题节点 `h1/h2/h3`：0；内容区不再出现重复“门店销售菜单”。
- “新建分区”：`data-testid=sales-menu-section-create`，Ant Design `primary/solid`，背景色 `rgb(30, 64, 175)`。
- 三个分区按钮：均为 `text-align:left`、`display:flex`、`justify-content:flex-start`；选中态使用现有列表选中语义。
- 草稿表头顺序：`菜单商品`、`挂牌价`、`商品形态`、`销售规格`、`销售约束`、`操作`。
- 挂牌价对应第二个 `col`，源码列宽为 `160px`；浏览器实际表格按 Ant Design 横向布局做比例分配，视觉上已收窄到第二列。
- 图片节点：20 个；20 个 `complete=true` 且 `naturalWidth/naturalHeight > 0`；资源来自受管资产端口 `127.0.0.1:29000`；页面没有“图片不可用”提示。
- 继承图片与自定义图片均复用共享 `AssetPreview`；打开“松露薯条”编辑抽屉时，继承商品主图真实显示，并显示“预览使用商品当前主图；菜单不会复制出另一份图片”。

## 6. 证据边界

以上证明当前销售菜单 Dev 页面和本次修改链路已完成浏览器可见性与图片加载验证。它不替代完整受管 L2、UAT、部署或切流证明；本次也没有声称生产 owner 逻辑已经完成全部真实 HTTP 覆盖。
