---
title: 商品计量、销售单位与库存单位优化 · 串行实施计划
status: ACCEPTED_FOR_IMPLEMENTATION
---

# 商品计量、销售单位与库存单位优化 · 串行实施计划

```text
SERIAL_PLAN_KIND=ONE_BATCH_INTERNAL_SERIAL_CP
BUSINESS_SOURCE=doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#unit-formal-model
JOURNEY=doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#unit-model-journey
UI=doc/decisions/2026-08-21-v2s-catalog-unit-model-ui-interaction.md
IA=doc/decisions/2026-08-21-v2s-catalog-unit-model-ia.md
IMPLEMENTATION_DESIGN=doc/plans/platform/2026-08-21-v2s-catalog-unit-model-implementation-design.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED
IMPLEMENTATION_AUTHORITY=true
```

## 1. 目标、唯一输入、设计输出与结束条件

目标是把“销售单位多选 + 库存以计量方式冒充单位”的现状替换为一套 catalog 单位定义、商品/SKU的两种单值角色、inventory 的消耗单位快照与仅录入用盘点换算。唯一输入是上列五份工件和后续 Dexter 对线框、§12基础单位变更边界的裁决；不得以旧页面、旧请求字段或 seed 作为语义来源。

本计划是**未来实施顺序**，不是实施命令。本批结束条件是五份设计工件彼此一致并完成独立设计盲审/Claude handoff；之后才可能由 Dexter 单独授权实施。

## 2. 总体串行边界图

```text
CP-00 设计冻结（线框、target 基础单位安全拒绝、源/目标单位精度）
  ↓
CP-01 catalog 单位定义/生命周期/Bounded list
  ↓
CP-02 contract+generated+商品/SKU单值模型
  ↓
CP-03 inventory snapshot/盘点换算/截断
  ↓
CP-04 whole-save、BOM、option material 的 REQUIRED 编排
  ↓
CP-05 copy/promotion 的 closure、mapping、BLOCKED
  ↓
CP-06 operations-admin UI、refresh、lifecycle
  ↓
CP-07 seed、backend acceptance、focused/static、动态验收（另行授权）
```

CP 只能顺序完成：没有新 owner readback 的前端不得假造字段；没有 snapshot 的数量动作不得改输入；没有 mapping 的复制不得执行。

## 3. CP-00 · 设计冻结与 admission

**目标**：把仍属产品/交互裁量的事项先交给 Dexter，而不是让后续实现者选择。

| 动作顺序 | 必须使用的现成能力/规范 | 如何验证 | 禁止/失败条件 |
| --- | --- | --- | --- |
| 1. 由 Dexter 整体查看 Journey/UI/IA/详设/本计划 | `ui-interaction-design-template.md`、`ia-design-template.md` | 人工线框结论写回 `DEXTER_WIREFRAME_REVIEW` | 未 ACCEPTED 不进入任何写代码 CP |
| 2. 记录已存在非零余额 target 的基础单位安全守卫 | 详设 §12 `U-UNIT-DESIGN-01` | Dexter 已接受：catalog 保存事务内返回 `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED`；回填需求/IA/详设同一事实 | 不得静默转余额、改快照或建立新 target |
| 3. 记录源数量与目标精度关系 | 详设 §12 `U-UNIT-DESIGN-02` | Dexter 已接受：源单位输入按源 precision 向零截断，转换结果按目标消耗 precision 向零截断；回填输入控件规则 | 不得把目标 precision 当源输入，或使用四舍五入 |
| 4. 冻结错误码/operation 名称/collection形态 | 详设 §4/§5/§7 | 静态文本交叉检查 | 不能临场把 Bounded 改 cursor/page 或加 fallback |

## 4. CP-01 · catalog 单位定义、生命周期与 Bounded list

**owner**：catalog。**目标**：建立统一计量单位库及已裁生命周期。

1. 建立 `catalog.unit_definition`，scope+brand+code 唯一，含名称、类别、precision、status、version；不扩展既有 `SALES_UNIT` 通用 dictionary。
2. 建立 owner typed `list/create/update/disable/deleteUnit`。`list` scoped ordered `LIMIT 100`；第100条抛 typed limit。list coordinator 一次合并 catalog usage 与 `InventoryOwnerApi#readCatalogUnitUsageSummaries(unitRefs)`；`delete/update` 在同一 REQUIRED 调 `InventoryOwnerApi#validateCatalogUnitLifecycle(unitRef,intendedChange)` 锁定式核验两侧引用，零引用可全改删，已引用仅改名、可停用。
3. 新 HTTP contract/edge generated chain只暴露 operations-admin；默认列表只启用，`includeInactive` 仅元数据维护。

**验证**：catalog focused owner tests + `CatalogAcceptanceScenarios` 真 HTTP：100条、重复编码、零引用全改删、被引用禁删/锁定义/仅改名、停用对候选影响。**禁止**：软删除回退、重新启用操作、前端计算引用数、分页或静默截断。

## 5. CP-02 · 商品/SKU单值单位与跨层声明闭合

**owner**：catalog，edge/generated 为传递层。**目标**：从数组模型迁移为明确角色。

1. 新 catalog item/SKU关系事实为 item `salesUnitRef/baseMeasureUnitRef`、SKU两个 nullable override；retire `salesUnitRefs[]` JSON/关系/manifest/reference matrix同根路径。
2. 更新 P1 generator源、OpenAPI schema/path、edge DTO/controller/operation adapter、generated Java/TS/RTK、shape manifest、frontend model。生成物不手改。
3. `CatalogOwnerService#saveCatalogItem` 解析 effective SKU→item；对可销售/库存/BOM用途做 owner validation，并投影 unit label、precision、status和继承来源。

**验证**：生成 self-test/red mutation；types/compile；acceptance：两个销售单位拒绝、SKU覆盖优先与清除继承、material无销售单位但有基础单位。**禁止**：把标签多选改掉、保留数组 fallback、从 UI 必填推断 owner规则。

## 6. CP-03 · inventory 消耗单位快照、盘点换算与截断

**owner**：inventory。**目标**：让余额和流水有稳定单位真相。

1. Flyway 建 target/ledger/BOM/unit snapshot字段；保留 `measureMode` 只作计量方式，删除其作为消费单位的读取和写入。
2. 变更 `InventoryOwnerApi#ensureCatalogItemSaveTarget`、BOM command/readback 接收并持久有效基础单位 snapshot；库存不向 catalog read edge 推导。
3. inventory configuration 只可存 counting snapshot+正有限 factor；count/increase/adjust按目标precision向零截断；历史读只用行/target快照。

**验证**：owner focused math tests与 acceptance：g precision0 的356.7→356；盘点配置不改变余额/消耗单位；单位/换算定义后来变化不重解释 target/ledger/BOM。**禁止**：HALF_UP、前端计算、自由文本单位、固定6位输入、库存页改消耗快照。

## 7. CP-04 · whole-save、BOM 与点单强制原料

**owner边界**：catalog拥有有效商品/SKU单位；inventory拥有 target/BOM/余额。**目标**：使保存闭合而不反向跨 owner。

1. 在 `CatalogInventoryCoordinator#saveCatalogItem` 的既有 `@Transactional(REQUIRED)` 组合中，catalog save 后调用 public inventory snapshot/BOM commands。
2. BOM行和点单强制原料只使用 material StockTarget consumption snapshot，商品销售单位/盘点单位永不传入。
3. 任一 inventory owner validation失败即整个 atomic group rollback；正常/临时转正/每条 option-value路径同形。

**验证**：真实 HTTP fixture 同时含 item/SKU、target、BOM、option material；故意制造 inventory失败并证明 catalog没有半写。**禁止**：catalog跨schema DML、inventory从 catalog read edge推断写入、前端补偿重试。

## 8. CP-05 · 品牌复制、本地复制与临时转正

**目标**：复制后不存在 source scope unit ref，也不以人类名称猜测语义。

1. reference matrix、closure、digest、preflight、execute、rewrite均加入 `CATALOG_UNIT` 与 snapshot引用。
2. 同编码类别/precision不同生成BLOCKED `CATALOG_COPY_UNIT_CONFLICT`，不进确认清单；execute重新preflight。
3. local/brand copy、temporary promotion都通过target mapping和 public inventory command重写 target/BOM snapshot。

**验证**：acceptance造source/target同码冲突和成功复制两套fixture，断言BLOCKED/no write、成功target无sourceRef且snapshot语义相同。**禁止**：名称模糊复用、源UUID残留、只验证preflight不验证execute。

## 9. CP-06 · operations-admin 交互、统一生命周期与刷新

**目标**：按已接受线框落实现有商品元数据 Modal、商品/SKU和库存surface。

1. `CatalogDictionaryDrawer` 将现销售单位改为“计量单位”Tab；Tab不会在商品工作台顶层、库存页或platform-admin出现。
2. 单位列表行编辑/confirmation、CatalogItemDrawer、SKU展开、InventoryDetailDrawer/ActionModal全部复用既有 lifecycle 与 overlay foundation；不新增单位详情页或详情 Drawer，关闭/dirty/submit/reset统一。
3. 单位候选读 Bounded active list；商品/SKU 单选继承/覆盖；库存消耗只读、盘点可选；使用generated hooks和统一refresh signal。

**验证**：focused component/model tests：单选、继承、停用候选消失/已选保留、源/目标 precision 向零截断提示、关闭后草稿清空、无第二单位库和单位详情入口；未来另行授权的浏览器L2核验既有 IA surface 容器。**禁止**：三种 `maskClosable` 写法、自由文本、新增本地轮询或“刷新”按钮、手写HTTP路径。

## 10. CP-07 · seed、真实HTTP验收和后续运行

**目标**：体验数据及业务证据覆盖真实单位模型。

1. 更新 `scripts/dev/catalog-inventory-seed-executor.mjs` 和其 static test：十几个单位、销售/基础单值、SKU覆盖、无销售单位物料、StockTarget snapshot、盘点换算、BOM、copy source/target；不能再输出数组或旧 dictionary value。
2. 所有详设§11场景加入 `CatalogAcceptanceScenarios.java`，每个真实 route/fixture/request/businessOracle，达到第100条、两个SKU、历史快照等红夹具真实存在。
3. 只有未来获得明确运行授权后，按受管入口执行 reset→start→seed→acceptance/DEV，并分开读取business和cleanup日志；本计划不启动它们。

## 11. 静态/动态退出层次

| 层次 | 可在未来实施期证明 | 本批现状 |
| --- | --- | --- |
| 静态 | generated闭合、compile/typecheck、focused red/green、同根扫描 | 仅设计目标，未授权执行 |
| backend acceptance | 真实HTTP的§11业务oracle | 仅场景设计，未授权执行 |
| DEV/seed | 新seed readback、受管日志、business/cleanup | 未授权 |
| 浏览器L2/UAT | 九surface实际渲染、窄视口、交互/异常 | 未授权 |

## 12. 硬停止清单

- UI 线框未整体确认；
- 已有非零余额 target 的基础单位变更政策未裁；
- 源数量与目标精度关系未裁；
- 任何 migration/contract/UI 试图保留旧数组、fallback、双写或历史重解释；
- 任一生成物被直接修改、owner边界被绕过或库存页获得创建/改消费单位入口；
- 任何动态/reset/seed/DEV 动作未获得单独授权。

## 13. 设计期交接

实现授权前的阅读顺序：正式需求 → Journey → UI交互 → IA → implementation-facing详设 → 本计划 → `CatalogAcceptanceScenarios.java` 和 owning source。实现后必须 fresh independent `REVIEW_TARGET=IMPLEMENTATION`，再由 Dexter 转 Claude；不以“按此计划实现”替代真实用户行为复核。
