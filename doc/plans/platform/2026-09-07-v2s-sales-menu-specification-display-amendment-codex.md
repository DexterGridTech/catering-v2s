# v2s 销售菜单商品形态与销售规格展示修订

- 日期：2026-09-07
- 状态：`IMPLEMENTATION_AUTHORIZED_BY_DEXTER`
- 原始反馈：销售菜单表移除“商品形态”列；商品形态放在首列编码下方；“销售规格”列同时展示 SKU 规格和普通销售商品的 Catalog 点单选项。
- 适用页面：`operations-admin` 销售菜单草稿与前台销售项表。

## 1. 用户可见行为

1. 草稿、前台表均保留首列“菜单商品”和第二列“挂牌价”；删除独立“商品形态”列。
2. 首列按“名称 → 编码 → 商品形态”三行展示；名称仍是既有销售项详情/编辑入口，编码和商品形态使用既有 presenter，不暴露 raw enum。
3. “销售规格”列统一读取同一条 SalesMenu item read model：
   - `SKU_SELECTION` 展示已选择的 SKU 名称，每项单独一行；
   - 普通销售商品等无 SKU 的形态，如果 Catalog 配置了点单选项，按“选项名称：选项值”逐项展示；
   - 没有 SKU 或点单选项时才显示“无规格”；称重销售继续显示“按称重数量”。
4. 点单选项的名称和值来自 Catalog owner 既有 `orderOptionConfigs` 事实；不在 SalesMenu schema、数据库或 seed 中复制其定义，不新增逐行 Catalog HTTP 请求。
5. 选项值的默认态与加价事实保留在 typed readback 中；列表展示保持紧凑，只显示用户理解所需的名称和值及非零加价。

## 2. owning source 与变更面

| 层 | owning source | 本次变更 |
| --- | --- | --- |
| Catalog owner facts | `CatalogOwnerApi.SalesMenuItemFacts`、`CatalogOwnerService.readSalesMenuFactSnapshot` | 复用 `CatalogItemDefinitionFacts.readOrderOptionConfigs(Collection<UUID>)` 的 set read，转换为 typed SalesMenu order-option facts |
| SalesMenu owner readback | `SalesMenuReadback`、`SalesMenuOwnerService` | draft/front item view 透传 `orderOptions`；published list/detail 使用同一批当前 Catalog owner facts，保持表格两种模式展示一致 |
| Edge contract | `contracts/openapi-source/sales-menu.schemas.json` | 新增 `SalesMenuOrderOption` 与 `SalesMenuOrderOptionValue`，加入 draft/published item view；不新增 operation |
| Generated output | edge-codegen 产物 | 由 source contract 重生成，不手改 |
| Frontend presenter | `salesMenuUiShared.ts`、`SalesMenuPage.tsx` | 选项逐项换行；商品形态并入首列；draft/front 两表统一 |
| Fixture/test | Catalog sales-menu task read test、SalesMenu owner API test、frontend static/unit test | 覆盖 ordinary + order option、SKU + existing behavior、column denominator 与 shape placement |
| Docs | 本修订、sales-menu IA/requirements/implementation design/plan | 将旧“独立商品形态列”标记为历史形态，记录当前有效展示契约 |

## 3. 不变边界

- 不新增 HTTP operation、数据库表/字段、Flyway migration、SalesMenu 写入字段、Catalog 写入行为、Journey 或权限语义。
- 不把 Catalog order option 定义复制进 SalesMenu；SalesMenu 只消费 Catalog owner 的 typed task read。
- 不将点单选项与 SKU 规格合并为一个布尔值或不透明字符串；两类事实在 read model 中仍可区分。
- 不改变价格、图片、库存、人工沽清、发布快照与分页行为。
- 前端不按行调用 Catalog detail；每页商品由一次有界 set-based owner read 返回选项事实。

## 4. 验证与对账

静态/单元验证必须证明：

- Catalog set read 对 `orderOptionConfigs` 有一次有界读取并正确映射 definition/value/name/selection/加价事实；空配置返回空数组；
- SalesMenu draft/front readback 与 edge generated type 同步；contract exact set 无多余字段；
- UI 两张表都没有独立“商品形态”列，首列包含 presenter 输出，销售规格 helper 能区分 SKU、点单选项和无规格；
- ordinary item with options 的 helper 产出选项名称和值，SKU 现有逐项展示与价格行为不回归。

动态浏览器验证（获得对应授权后）逐项确认：普通销售商品存在点单选项时“销售规格”不再显示“无规格”，名称/编码/商品形态三行出现，草稿和前台模式均没有独立“商品形态”列。静态或单元 PASS 不替代该动态边界。

## 5. 失败族与最小预防

失败模式：UI 需求说“显示选项”，但 read model 只返回商品形态与 SKU，导致普通商品被错误显示为“无规格”。

根因层：跨 owner task-read projection 漏掉了 Catalog 已有的有界事实，而不是 UI 文案或表格列本身。

最小预防：每个跨 owner 列表展示字段必须在实施计划的 change surface 中同时列出 owner fact、typed readback、contract/generated、presenter、fixture 和 focused proof；禁止以调用 Catalog detail 的 N+1 请求临时补数据。

### 6. 2026-09-07 表格密度修订

针对浏览器逐项反馈，草稿与前台销售项表的同名列同步收窄，保持模式切换后的视觉密度一致：

- `挂牌价`：草稿 `160px → 108px`，前台 `120px → 80px`，按约减少三分之一；
- `销售规格`：草稿 `180px → 120px`，前台 `220px → 147px`，按约减少三分之一；
- 草稿 `销售约束`：`220px → 110px`，减少二分之一；
- 普通销售商品的销售约束固定以“起售量”“订购倍数”两行展示，称重销售仍只显示“不适用”；展示复用既有 `SalesMenuStackedCell`，不新增表格组件或业务字段。
- 两张销售项表复用仓内既有精确列宽模式 `tableLayout="fixed"`，并令 `scroll.x` 等于各自列宽总和（草稿 `620px`、前台 `652px`），避免浏览器按过大的横向基准重新分配列宽，使上述像素收窄在实际页面生效。

实施计划：先修改共享 presenter 与两张表列定义，再补充 presenter 单测和列宽静态断言，最后完成“逐代码与详设对账”。该对账范围覆盖本节全部 changed lines，由主 agent 执行；每一行只允许记录 `MATCHED` 或 `OPEN`，存在 `OPEN` 时实施未就绪，不进入交付。
