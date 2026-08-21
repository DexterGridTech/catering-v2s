# 商品属性库、点单选项库与两步新建 — IMPLEMENTATION Claude 复核交接

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=CATALOG_DEFINITION_LIBRARY_EXTERNAL_IMPLEMENTATION_20260820
REVIEW_STATUS=READY_FOR_CLAUDE
EVIDENCE_MODE=FRESH_V2S_ROOTED_STATIC_AND_BACKEND_ACCEPTANCE
UI_L2_STATUS=NOT_RUN_BY_AUTHORIZATION

## 背景

本轮是商品属性库、点单选项库与两步新建的一批实施收口。Dexter 已授权实施；此前独立 IMPLEMENTATION 子 agent 的 Round 2 结论为 `NO-GO (M=2/S=4/N=1)`，作者已逐条重开源码、生成契约、验收与运行证据并形成处置记录。多原料保存、业务文案、detail 刷新、候选续载、编码/复制/BOM 红夹具和退役测试残留均已修复或以证据关闭；Round 2 保留的逐变更点历史 ledger 缺口不能追溯制造，仍单独标记为治理 finding。

本轮又根据 Dexter 的界面裁定移除了商品工作台整个顶层 Tab 容器：商品主面直接展示商品工作台；商品属性库与点单选项库只出现在既有“商品元数据”弹窗内，并与商品标签、销售单位、SKU 销售属性、商品处理标签并列。点单选项定义编辑采用按可选项分组的动态原料明细，原料使用业务语言，不把“组件、库存对象、BOM、target”等实现术语作为用户文案。

## 评审目标

请独立核验当前工作树是否已经满足正式需求、Journey、IA、implementation-facing 详设和串行计划，重点确认：

1. 新定义族是否真的替换了商品自由 JSON 与 item-owned 点单选项，而不是留下双真相、fallback 或静默兼容；
2. 属性定义与点单选项定义的 scope、稳定引用、编码唯一性/不可变规则、删除级联、StockTarget 前置、跨 owner `REQUIRED` 事务和 option-value BOM 身份是否一致；
3. 商品侧是否只保存定义引用与允许的覆盖：属性值、必选/最少/最多、默认、加价、每份实际用量；`MULTIPLE` 且最大值为 1 仍保持多选语义；
4. 品牌复制是否深复制并重写 definition/value/material/BOM 引用，同编码但类型、选择方式、可选项或强制原料不同是否为不可确认的 hard block；不得把“目标缺 StockTarget”误判为当前必然阻断；
5. 两步新建是否为 Modal 原子创建 `DRAFT`（可空单分类）后，在 Modal 关闭动画完成后打开可编辑商品 Drawer；关闭 Drawer 不删除草稿；
6. operations-admin 的工作台是否没有顶层“商品/商品属性库/点单选项库”Tab，两个库是否只在商品元数据 Modal 内；动态原料行是否绑定当前可选项、保留多行、使用业务语言并避免第二内容滚动面；
7. 生成客户端、RTK 缓存失效、typed problem、日志脱敏、acceptance 场景和旧生产模型清理是否与上述事实一致。

## 需阅读文件

请从 `catering-v2s` 仓库根按以下顺序独立读取，不先接受作者处置结论：

- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md`：正式需求、现状冲突、Dexter 裁定；
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md`：唯一 Journey、actor 前提与范围；
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md`：十个 screen 的入口、业务文案、动态布局与最新商品元数据 Modal 裁定；
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md`：不可见行为、集合规模、刷新/权限/级联观察；
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-implementation-design.md`：implementation-facing owner、事务、契约、机制表和 acceptance 设计；
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-serial-plan.md`：本批串行边界与停止条件；
- `doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-independent-review-round-2-claude.md`：独立 Round 2 原始 verdict，不得把它的旧 finding 当作当前事实；
- `doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-round-2-disposition-codex.md`：作者逐条 intake，需自行验证；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx`：商品主面是否已去除顶层 Tab、元数据入口与 Drawer 交接；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx`：商品元数据 Modal 的六个并列页签及两个库的宿主关系；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx`：两个库的列表、定义编辑、动态原料行、业务文案与基础能力接入；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`：商品属性与点单选项的 typed 配置、三栏关系和每份用量；
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogDefinitionForm.ts`：多原料 hydrate/serialize；
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`：typed detail/save/readback 与业务对象映射；
- `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`：生成类型、problem union、copy mapping；
- `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts`：定义 mutation 对商品详情及库列表的失效策略；
- `modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`：跨 owner 协调、复制合并、catalog-only snapshot 与事务边界；
- `modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`：定义族、商品 typed assignment/config、复制闭包与拒绝路径；
- `modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogDefinitionFacts.java`：定义列表上界、编码与级联；
- `modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemDefinitionFacts.java`：商品配置、MULTIPLE min/max、默认/加价/实际用量；
- `modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：原料 StockTarget 前置、option-value BOM 与复制 mapping；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`：真实 HTTP fixture/request/business oracle；
- `doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-round-2-disposition-codex.md` 中记录的日志诊断与修复摘要；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787230542611-7994/run-manifest.json`：最新受管 acceptance 的 business/cleanup 状态；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787230542611-7994/backend-acceptance-result.jsonl`：72 条真实场景的 contract/business 结果；
- `doc/platform/frontend-coding-standard.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/foundation-charter.md`：实现、owner、foundation 和证据边界。

## 独立核验重点

- **同根全集扫描**：对本批所有 operations-admin catalog UI、所有 catalog/inventory definition owner、全部新 edge operations 与全部 Catalog acceptance 场景逐族扫描；不要只验证一个文件或一个 endpoint。特别检查 `categoryRefs`、自由 `attributes`、普通商品 `orderOptions`、`attributeValueRef`、`FIXED` 和退役 item-owned 表是否仍有真实生产路径；SKU 销售属性的同名字段应区分为保留反例。
- **商品主面与元数据 Modal**：确认 `CatalogWorkbenchPage` 没有顶层 Tab 容器或独立库入口；确认“商品元数据”Modal 内六个页签中，两个库与既有四类元数据并列，且关闭宿主 Modal 会清理子 Drawer 状态。确认首列业务名称可进入详情，不以技术字段命名用户界面。
- **动态定义聚合**：点单选项详情应以当前选中的可选项为主，右侧只展示该可选项的原料行；新增、删除、排序、切换和多行保存必须不丢数据。不得把不同可选项的原料混成一张无归属清单，不能使用“组件/target/BOM/库存对象”替代业务词。
- **数据边界**：属性定义编码可改且同 scope 唯一；点单选项组和值编码创建后不可改；属性选项与点单值使用稳定 ref；商品只改自身配置；定义删除的级联止于商品赋值/配置/对应 option-value BOM，不删除商品、StockTarget 或原料商品。
- **库存前置**：建点单选项定义时原料商品必须已有有效 StockTarget；商品侧填写每份用量时不得再次以库存就绪度阻断。库存 owner 仍拥有 target/BOM，catalog 不直写 inventory 表。
- **复制 hard block**：same-code 语义差异必须出现在 preflight 的 `BLOCKED`/`CATALOG_COPY_DEFINITION_CONFLICT` 中且不可确认；execute 必须重新预检。核对 local/brand copy 的 closure、referenceMappings、digest 与 option-value BOM mapping，且不要把缺 target 的旧错误说法写回实现。
- **三次失败日志纪律**：复核 `r5-tc-1787229384842-88619` 的结构化 first-failure 诊断、`r5-tc-1787229777851-95550` focused PASS 与源码快照修复；确认根因是合并后 catalog compatibility 被库存处置污染，而不是通过增加等待、忽略错误或扩大兼容层掩盖。
- **证据分层**：最新完整受管 acceptance 应为 72/72 contract+business PASS、cleanup PASS；静态/类型/编译证据与 HTTP evidence 分开记录；浏览器 L2、DEV、seed、reset、UAT 未执行，不能写成已验证。

## 期望结论

请输出固定结论块：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS 或逐条 findings>
L2_USER_VISIBLE=<PASS 或逐条 findings>
L3_UNVERIFIED=<逐条列出；非空时 VERDICT 只能为 GO_WITH_UNVERIFIED_UI>
SAME_ROOT_SCAN=<每条 finding 的全集与判定>
DESIGN_GAPS=<正本缺判据的条目；没有则写空>
EVIDENCE_TIER=<静态、focused、backend-acceptance、浏览器 L2 各自的真实档位>
```

每条 `M`/`S`/`N` finding 请给出精确相对路径与行号、仓内事实、影响面、最小修复建议、适用边界，以及是否需要 Dexter 产品裁决。请先独立形成预期行为，再阅读作者 disposition；不要把上一轮旧 verdict、静态关键词命中或 acceptance 状态码当作业务结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审本次“商品属性库、点单选项库与两步新建”的 IMPLEMENTATION 当前源码。

背景：本批已获 Dexter 实施授权。上一轮独立 IMPLEMENTATION Round 2 曾给出 NO-GO，之后我们按源码、生成契约、真实 backend-acceptance 和日志逐条修复；最新 UI 裁定还要求删除商品工作台整个顶层 Tab，把商品属性库与点单选项库移入既有“商品元数据”Modal，与商品标签、销售单位、SKU 销售属性、商品处理标签并列。请把当前工作树当作唯一实现事实，不要直接接受作者 disposition 或上一轮旧 finding。

目标：请按 IMPLEMENTATION 评审动作 1-A 独立核验 owner/事务/契约/前端用户行为/复制与删除边界，并判断当前实现是否真正满足本批正式需求、Journey、IA、implementation-facing 详设和 acceptance oracle。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md：业务真相与裁定；
- doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md：Journey 与范围；
- doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md：交互、业务文案和最新 Modal/无顶层 Tab 裁定；
- doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md：不可见行为与集合形态；
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-implementation-design.md：实现边界与 owner/acceptance 设计；
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-serial-plan.md：串行实施边界；
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx：确认商品主面无顶层 Tab；
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx：确认商品元数据 Modal 的六个页签；
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx：确认两个库的动态原料结构与业务文案；
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx：确认商品 typed 配置、三栏点单选项和每份用量；
- apps/frontend/operations-admin/src/features/catalog-management/model/catalogDefinitionForm.ts：确认多原料 round-trip；
- apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts：确认 detail/save/readback 不再回退自由 JSON；
- apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts：确认 generated types/problem/copy mapping；
- apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts：确认 definition mutation 会失效商品详情；
- modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java：确认跨 owner REQUIRED、catalog-only preflight snapshot 与 copy；
- modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java：确认 owner 事实、删除、复制和拒绝；
- modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogDefinitionFacts.java：确认定义 bounded limit、编码与级联；
- modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemDefinitionFacts.java：确认商品覆盖与 min/max；
- modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java：确认 StockTarget 前置、BOM 和新 definition-value mapping；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java：确认真实 HTTP fixture/request/business oracle；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1787230542611-7994/run-manifest.json：确认 business/cleanup；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1787230542611-7994/backend-acceptance-result.jsonl：确认 72 条业务结果；
- doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-round-2-disposition-codex.md：仅作为作者处置输入，需独立复核。

请重点独立核验：商品主面是否无顶层 Tab、两个库是否只在商品元数据 Modal 内；动态原料是否按当前可选项归属且多行不丢失；定义/商品配置分层、编码和 scope 唯一性、删除级联、StockTarget 前置、跨 owner 事务、copy hard block 与 BOM mapping；FIXED 是否拒绝；MULTIPLE min/max（max=1 仍为多选）；生成 RTK detail invalidation；旧 JSON/item-owned 生产路径是否已清除；以及三次失败后通过结构化日志定位并修复的 preflight 污染根因。

请分别给出静态、focused、真实 backend-acceptance 与未执行浏览器 L2 的证据档位。浏览器 L2、DEV、seed、reset、UAT 本轮均未执行，不能声称已通过用户体验验证。

请输出：
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS 或逐条 findings>
L2_USER_VISIBLE=<PASS 或逐条 findings>
L3_UNVERIFIED=<逐条列出；非空时只能 GO_WITH_UNVERIFIED_UI>
SAME_ROOT_SCAN=<每条 finding 的全集与判定>
DESIGN_GAPS=<正本缺判据的条目；没有则写空>
EVIDENCE_TIER=<真实证据档位>

每条 finding 请标注精确仓根相对路径与行号、影响面、最小修复建议、适用边界，并明确是否需要 Dexter 产品裁决。

授权边界：本次只请求对当前实施进行独立 IMPLEMENTATION review，并不授权代码、契约、数据库、测试、数据、DEV、seed、reset、浏览器 L2、UAT、发布或任何仓库控制动作。谢谢。
```
