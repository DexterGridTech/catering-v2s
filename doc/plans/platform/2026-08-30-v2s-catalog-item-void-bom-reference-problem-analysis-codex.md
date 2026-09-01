# 商品作废与库存 BOM 引用问题分析

```text
DESIGN_STATUS=DRAFT_FOR_REVIEW
REVIEW_TARGET=DESIGN
JOURNEY_ID=J-CIB-001
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_EXECUTION=NOT_RUN
```

## 1. 用户真正要解决的问题

用户看到商品 A 配置了用料，页面因此提示“已配置用料，不能作废”。但业务关系是：A 是 BOM 的拥有者，B 才是被 A 的用料定义引用的商品。正确的生命周期语义应当是：

- A 可以因为自己拥有一份 BOM 定义而作废；作废 A 时，库存 owner 在同一事务中停用 A 自己的有效库存定义，保留余额、流水和历史定义，不把历史事实删除或重新解释。
- B 在仍被某个有效 BOM 行作为组件引用时不能作废；这是入向用料引用阻断。
- A 若同时存在商品自身的规格、条码、生产标签或 catalog 组合引用，仍按这些已有规则阻断；本问题不取消这些真实的 catalog 依赖。
- “商品关联（0）”仍表示 catalog 组合关系为零，不等于库存 BOM 关系为零。若存在入向库存 BOM，应在作废限制中明确显示“被其他商品用料引用”，而不是把两种关系混成一项。

这不是把文案从“已配置用料”改成别的文字即可解决的 UI 问题，而是作废判定把“我拥有的定义”和“别人引用我的目标”混为同一类事实。

## 2. 当前仓内事实

| 事实 | 当前 owning source | 结论 |
| --- | --- | --- |
| `stock_target.item_ref` | `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java` 的 `catalogItemVoidDependencies` | 这是商品自己的库存对象，属于 owner fact，不是别人引用该商品。 |
| `stock_bom.item_ref` | 同上 | 这是 BOM owner（A），不是 BOM component（B）。当前却被作为作废依赖计数。 |
| BOM 组件关系 | `inventory.stock_bom.rows[*].targetRef`；路径矩阵 C02 | `targetRef` 指向被消耗的 `stock_target`，才是 B 的入向用料引用。 |
| 已有入向 BOM 读取能力 | `InventoryOwnerService.references` | 已能展开 `rows[*]` 并按 `targetRef` 找到 source item，但没有接入商品作废 owner judgement。 |
| 商品作废命令 | `CatalogOwnerService.transitionItemState` / `requireItemRetirementUnreferenced` | 调用 generic `catalogReferenceDependencies(CATALOG_ITEM, itemRef)`，因此消费的是 R13/R15 的 owner 列，而不是 C02 的 payload component path。 |
| 详情作废可用性 | `CatalogOwnerService.requireInventoryVoidDependencies` / `appendItemVoidBlockingReasons` | 详情同样把 `stockTargetCount`、`productBomCount` 作为 `HAS_STOCK_CONFIGURATION`、`HAS_BOM_CONFIGURATION` 阻断，和命令保持了错误的一致性。 |
| 定义状态边界 | `V20260822_010000_000__catalog_inventory_rule_definition_status.sql`、`V20260827_010000_000__base1_three_state_lifecycle.sql` 与 `InventoryOwnerService` 的 current/mutation/resolver 路径 | `ENABLED` 是当前定义，`DISABLED` 是不可变历史快照；现有 target 查询、部分 mutation、legacy BOM resolver 未统一带 active/status guard。若本方案把自有定义退休为 `DISABLED`，这条同根泄漏必须一并收口。 |
| BOM 引用与候选 status | `InventoryOwnerService.references`、`consumptionTargetCandidates`、`contracts/openapi/components/inventory/inventory-workbench.schemas.json` 及生成 TS | reference 读取 BOM row 的 `status` 并在缺失时默认 `ACTIVE`，但当前 BOM writer 不写该字段；contract/generated union 只有 `ENABLED|DISABLED|VOIDED`。候选查询只证明 target definition 为 `ENABLED` 却硬编码 `status=ENABLED`，而 contract 将它描述为 component catalog status。这是两个不同 status 维度的 contract/runtime/source 冲突，不能靠补一个 enum 值掩盖。 |
| 前端展示 | `CatalogItemGovernanceView.tsx`、`catalogManifestLabels.ts` | 只能忠实展示后端错误的阻断原因；单改前端会留下命令仍拒绝、A 的定义未退休、B 仍漏判等问题。 |

## 3. 关系模型与根因

用最小关系图表达当前问题：

```text
A.catalog_item
  └─ inventory.stock_bom.item_ref = A        # BOM 所有者，自有定义
       └─ rows[*].targetRef = B.stock_target.target_ref
                                              # B 的库存对象，入向组件引用
```

当前实现实际做的是：

```text
作废 A -> 查 stock_target.item_ref = A 或 stock_bom.item_ref = A
       -> 只要 A 有自有库存定义就拒绝
```

应当做的是：

```text
作废 A -> 查是否有其他有效 BOM 的 rows[*].targetRef 指向 A 的有效 target
       -> 无入向引用：停用 A 自己的有效定义，再作废 A

作废 B -> 查是否有其他有效 BOM 的 rows[*].targetRef 指向 B 的有效 target
       -> 有入向引用：拒绝 B，并返回来源商品的业务摘要
```

这里的“其他”是生命周期上的 owner 身份，不是 SQL 中简单加一个 `item_ref <> ?`：当前
subject 自己拥有的 active BOM 属于本次作废的可退休定义集合，不是阻断自己的入向引用；若
自己的 BOM 行错误地指向自己已拥有的 target，也必须随 own-definition retirement 一起处理，
不能靠忽略该行制造 false-green。相反，active BOM 行命中当前 subject 的 `DISABLED` target
或无法在当前 scope 唯一解析时，是数据不变量失败，必须 fail closed。

根因在“引用路径/生命周期分类”层，不在某一个 SQL 条件或某一个页面 label：

1. R13/R15 的 owner columns 与 C02 的 component payload path 在模型上是两种方向，但作废路径复用了只支持 declared column 的 `catalogReferenceDependencies`。
2. 库存 owner 只有“自有定义计数”读回，没有同时返回“自有定义可退休”和“入向 BOM 引用不可退休”的分离判断。
3. 详情与 mutation 虽然都声称消费 owner judgement，实际消费的是同一组错误的 own-definition counts，因此错误被同时固化到 API、前端和测试。
4. 没有 inventory-owned 的作废退休命令；即使把阻断去掉，也会把 A 的有效库存定义留在库中，形成已作废商品仍可被扣料候选命中的脏状态。
5. `DISABLED` 历史快照与当前 operational target/BOM 读取边界未在所有路径统一；legacy BOM 解析和部分 target mutation 仍可能把已退休定义当作当前对象，自动退休若不同时修复会把错误从“不能作废”转成“作废后仍可操作”。
6. reference status 没有被已批准业务语料赋予稳定的 owner、写入来源、历史边界和闭集；读取路径却自行引入 `ACTIVE` 默认值，候选路径又把 target definition eligibility 冒充 catalog item lifecycle。根因是跨边界 contract/source governance 缺失，不是文案或单个 union 成员遗漏。
7. `ResolvedBomTargets` 目前只做当前 scope 下的存在性校验。它确实允许新增/改变的 BOM 行指向已 `DISABLED` 的 target；但把查询无条件改成 `definition_status='ENABLED'` 也会拒绝未改变的既有引用，违反既有 `EXISTING_REFERENCE_EXEMPT_FROM_STATUS_CHECK` 编辑豁免。真正的修复必须在保存时区分“新增/改变引用”和“未改变既有引用”。

## 4. 同根扫描范围

本次以 `stock_bom.item_ref` / `rows[*].targetRef` 为问题族入口，不能只改一条 warning。实施前后都必须重新核对下面的有限范围：

| 层 | 需要核对的对象 | 本批要求 |
| --- | --- | --- |
| 语义/路径 | `contracts/policy/catalog-inventory-reference-path-matrix.json` 的 R13、R15、C02 | 明确 owner 与 component 两个方向；不新增第二份隐含路径正本。 |
| 生成链 | `scripts/generate/catalog-inventory-p1.mjs`、生成的 `InventoryCatalogReferenceDeclarations.java`、edge registry/contract | generic column declarations 不能继续冒充 JSON component judgement；所有生成物由 owning generator 刷新。 |
| inventory owner | `InventoryOwnerApi`、`InventoryOwnerService.catalogItemVoidDependencies`、`references`、`consumptionTargetCandidates`、definition status 写入路径、`target`/list/mutation、`ResolvedBomTargets` | 提供同一份入向 judgement；当前 operational path 只接受 `ENABLED`，legacy/canonical BOM component 解析共用 status/eligibility 边界；保存 resolver 还必须按新增/改变与未改变既有引用分流，并提供同事务退休自有定义的 command。 |
| catalog owner | `CatalogOwnerService.transitionItemState`、batch preflight、detail read model、`CatalogInventoryCoordinator` | item detail、单项作废、批量作废使用同一 owner 语义；不在 catalog 直接读 inventory 表。 |
| contract/前端 | `voidAvailability`、blocking reason enum、reference/candidate status shape、`CatalogItemGovernanceView`、model decoder、label manifest | 只展示业务原因；不暴露 UUID/raw JSON；`商品关联` 与库存入向引用分开；按已裁决结果删除两个 status 字段及其全链路依赖，不生成替代字段。 |
| 测试 | inventory integration、catalog lifecycle/operation/acceptance、frontend model/view、`ResolvedBomTargets` | 增加 A 自有 BOM 可作废、B 入向 BOM 被阻断、inactive/history/scope/concurrency、disabled target 不可作为 current 被读取/修改、legacy/canonical resolver parity，以及新/改变引用拒绝 disabled、未改变既有引用可保留的反例。 |
| seed | `contracts/policy/catalog-inventory-fixture-catalog.json`、`scripts/dev/catalog-inventory-seed-plan.mjs`、executor | 用 owner HTTP 建立 A→B，不能直接写库；对账最终状态与 detail/transition readback。 |
| browser L2 | `contracts/policy/catalog-inventory-l2-*`、fixture/locator/runtime | 在真实页面验证 A 的作废入口和 B 的业务阻断，不能用 seed/API 报告替代。 |
| 旧空间 | 当前旧库存/商品详情入口及其重复阻断逻辑 | 实施后只保留一个权威入口；发现重复旧入口时下线，不保留 fallback。 |

### 同根 sibling 的边界

- `PRODUCT_SKU` 也使用 inventory owner-column dependency path。实施时必须复核 `requireSkuRetirementUnreferenced`；若同样把自有 `stock_target.product_sku_ref` / `stock_bom.product_sku_ref` 当作入向引用，则同批按相同方向修复，不能留下同根回归。
- `CATALOG_ORDER_OPTION_DEFINITION_VALUE` 有自己的选项值 BOM 删除/级联路径；当前没有证据表明它使用本 item void 判定。保留现行语义，并加入反例测试，除非回源发现它也复用了同一错误判断。
- A-05 的余额、流水、历史快照规则是“扣减方式切换”规则，不因本问题自动扩张成新的商品作废规则。本批不放宽 CP05、不增加预算例外；backend acceptance 场景总数不设历史 80 条 cap，按业务 oracle 需要覆盖。

## 5. 方案比较

| 方案 | 做法 | 为什么不作为推荐 |
| --- | --- | --- |
| A. 只改前端 | 隐藏 `HAS_BOM_CONFIGURATION` 或改 label | 命令仍会拒绝 A；A 的有效定义不会退休；B 的入向引用仍可能漏判，是止血。 |
| B. 保留阻断，要求用户先手工删除 A 的 BOM | 用户先进入库存页处理，再作废商品 | 把生命周期一致性转嫁给用户，容易删除历史/产生中间态；也不能保证 B 的入向关系被准确判断。 |
| C. owner-aware judgement + 同事务退休（推荐） | inventory owner 分离 own/inbound；无入向引用时原子停用自有有效定义，catalog 再更新 VOIDED；有入向引用时 typed fail closed | 需要补一个 owner command 和跨层 read model，但一次关闭方向、事务、历史保留、详情与命令一致性四个根因，复杂度与收益匹配。 |

推荐 C，但“作废商品时自动停用其自有库存定义”是对现有生命周期语义的明确补充，须由 Dexter/Claude 在本轮设计 review 后确认；在确认前不写生产代码。

## 6. 关系方向可证伪失败条件

以下任一条件成立，设计或实施不能收口：

1. A 仅因 `stock_bom.item_ref=A` 或 `stock_target.item_ref=A` 被拒绝，且没有其他已批准 blocker。
2. B 存在有效 `stock_bom.rows[*].targetRef=B.stock_target.target_ref`，但 B 的作废命令成功。
3. A 作废成功后仍有 A 自有 `definition_status=ENABLED` 的库存定义。
4. 详情显示可作废，但 mutation 因另一份隐藏的 inventory scan 被拒绝，或反过来详情显示不可作废却没有业务原因。
5. 只更新生成文件/label，未更新 owning source；或手工编辑 generated contract/registry。
6. inactive/disabled BOM、跨 scope/brand 的同 UUID、历史 DISABLED 定义被误判为当前入向引用；反过来，active BOM row 指向已 DISABLED 的 subject target 时被静默忽略而放行，或 subject 自己的 active BOM 被误当成自己的 inbound blocker，也属于数据一致性失败；前者必须 fail closed，后者必须进入 own-definition retirement 集合。
7. 业务测试通过但没有验证同一事务 rollback、CAS、幂等、最终 owner readback，或 L2 仍看到旧空间/旧文案。

## 7. 评审 finding intake 与根因闭合（2026-08-31）

本节只处置本次外部设计评审输入，不把 reviewer 的结论直接当作事实，也不改变 `IMPLEMENTATION_AUTHORITY=false`。

| Finding | 独立核对后的分类 | 处置 |
| --- | --- | --- |
| M-1：reference/candidate status 与 runtime、contract 不绑定 | `CONFIRMED`；Dexter 已裁决两个 status 字段均不保留 | 已确认 `references` 的 `ACTIVE` fallback、BOM writer 缺失字段、contract/generated 三态 union，以及候选路径硬编码 `ENABLED` 与“component catalog status”描述不一致。按裁决，implementation 必须从唯一 contract source 删除 reference `entries[].status` 与 candidate `items[].status`，同步移除 runtime reader/fallback、candidate hardcode、generated output、frontend model/view/label 和测试依赖；不得新增 `ACTIVE` 或替代 status。 |
| S-1：BOM resolver 只校验存在性 | `PARTIALLY_CONFIRMED` | 新增/改变引用未受 `ENABLED`、component eligibility、消费单位快照约束，问题成立；但无条件加 `ENABLED` 会破坏既有引用编辑豁免。最小根因修复是 state-aware resolver：在同一版本/CAS 保存边界内取得现有关系，未改变的既有引用按 scope 存在性放行，新增/改变引用按 current eligibility admission，统一保留 typed fail-closed。 |
| N-1：`targetRef` 需要两跳解析 | `CONFIRMED` 且不构成缺陷 | 保留 `targetRef -> stock_target -> catalog item` 两跳，不把 JSON payload path 改写成直接 item 引用。 |
| N-2：同批 A/B 是否允许拓扑释放 | `DEXTER_DECISION` 已裁决为“不允许” | 批量以 batch-start graph 为线性化观察点；若 A 的 active BOM 引用 B，即使 A、B 同批，B 仍 fail closed，不通过排序、预加载或先退休 A 释放 B。CP-03 按该固定语义实施，不再把它作为未决产品选择。 |

本轮抽象出的通用失败模式是：只读取字段名、enum 或单个查询就为跨 owner 的业务事实定语义，未同时核对 writer、reader、contract、generated output、候选投影和保存 admission。其根因层是 contract/source governance 与 state-aware write admission；有限反例包括：缺失 row status 被默认成 `ACTIVE`、候选 target 已启用但 catalog item status 不是 enabled、未改变的既有 disabled 引用被编辑误拒、新增 disabled 引用被误放行。CP-01/CP-02 的 change-surface 和本节的逐项 failure condition 是防再犯位置，不新增一个只看字符串的机器门。

## 8. 可证伪失败条件（修订）

除上文关系方向的失败条件外，以下任一条件成立，设计或实施不能收口：

1. reference `entries[].status` 或 candidate `items[].status` 在 contract、runtime、generated TS、frontend model/view/label 或测试中残留，或实现以 `ACTIVE`/`ENABLED` 作为替代 status。
2. 删除 status 字段后，任一层仍把 target definition status、catalog item status 或 BOM row 缺省值投影成用户/接口 status。
3. 新增/改变的 BOM target 指向 `DISABLED`、不具备 component eligibility 或缺少有效消费单位时保存成功。
4. 仅为修复 S-1 而无条件拒绝未改变的既有引用，导致商品无法修改无关字段；或 canonical/legacy resolver 的 state admission 不一致。
5. 以补 `ACTIVE` enum、复制旧 run 产物、手工编辑 generated 文件或改变 label 代替 status owner/source 决策。

## 9. 本文不宣称的事项

本文只提出问题分析与待评设计方向：没有修改源码、契约、生成物、seed、L2、DEV、reset 或数据；没有把 `NO-GO` 变成产品取舍，也没有授权后续动态执行。当前 review cycle 的独立审查已达到两轮上限，不以本次修订召集第三轮；后续只能依据已记录的 finding 处置、必要的 Dexter 裁决和明确的实施授权进入源码阶段。
