# 商品作废 BOM 引用语义：implementation-facing 详设草案

```text
DESIGN_STATUS=DRAFT_FOR_REVIEW
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
REVIEW_TARGET=DESIGN
JOURNEY_ID=J-CIB-001
IA=IA-CIB-VOID-01
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_EXECUTION=NOT_RUN
```

## 0. 适用输入与不变约束

本详设依赖并修订以下输入：

- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-problem-analysis-codex.md`；
- `doc/decisions/2026-08-30-v2s-catalog-item-void-bom-reference-journey-amendment.md`；
- 已接受的 `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md`、`...-ui-interaction.md`；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md` 与 `...-serial-plan.md`；
- `doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-plan-codex.md` 的 R-09/R-10；
- `contracts/policy/catalog-inventory-reference-path-matrix.json` 的 R13、R15、C02。

不变约束：inventory 事实仍由 inventory owner 持有；catalog 不直接读写 inventory 表；跨 owner 写在同一 `REQUIRED` 事务；active/disabled 历史定义不物理删除；不添加新 HTTP operation；generated contract/TS/registry 只能由 owning generator 生成；不改变 CP05 operation/DB budget ceilings 或放宽业务事实；backend acceptance 场景总数不设历史 80 条 cap，覆盖量按业务 oracle 决定。

## 1. 目标语义模型

### 1.1 统一的作废主题

inventory owner 内部用一个 typed subject 表达 catalog 生命周期对象：

```text
CatalogVoidSubject
  subjectKind: CATALOG_ITEM | PRODUCT_SKU
  subjectRef: UUID
  dataNodeRef / brandRef: typed execution scope
```

item 是当前用户问题的主交付面；SKU 是同根 sibling，必须在同一轮回源核对，不能被 generic column scan 悄悄遗漏。ORDER_OPTION_VALUE 沿用现有专门级联路径，除非回源证明复用同一错误。

### 1.2 owner 与 component 必须分栏

| 事实 | 查询地址 | 归属 | 对 subject 作废的作用 |
| --- | --- | --- | --- |
| 自有库存对象 | `stock_target.item_ref` 或 `stock_target.product_sku_ref` | inventory owner 自有定义 | 统计后退休，不是 inbound blocker。 |
| 自有 BOM | `stock_bom.item_ref` 或 `stock_bom.product_sku_ref` | inventory owner 自有定义 | 统计后退休，不是 inbound blocker。 |
| 别人的 BOM component | active `stock_bom.rows[*].targetRef` / legacy accepted alias `componentTargetRef` 指向 subject 的 active target，且 BOM owner 不是当前 subject | 其他 BOM owner 对 subject 的入向引用 | blocker。 |
| catalog composite | catalog composite component relation | catalog owner | 保持现有 blocker。 |
| DISABLED 历史定义 | `definition_status=DISABLED` | inventory history | 不属于 current active reference；保留。 |

`targetRef` 只能同 scope/brand 精确匹配 `stock_target.target_ref`。不使用商品 code、SKU code、JSON 中显示 label 作为关系值；不通过跨 schema read edge 推导写。

## 2. inventory owner API 与实现边界

### 2.1 读判断：替换错误的语义，不造第二份扫描

将现有 `InventoryOwnerApi.catalogItemVoidDependencies` 的实现改成显式 owner judgement。建议 typed shape：

```text
CatalogVoidDependencyReadback
  subjectKind
  subjectRef
  ownedActiveStockTargetCount
  ownedActiveProductBomCount
  inboundBomReferences[]
    sourceOwnerKind: ITEM | SKU | OPTION_VALUE
    sourceItemRef / sourceSkuRef / sourceOptionValueRef
    sourceCode / sourceName (name 由 catalog owner resolution 或已有 owner display fact 提供)
    count
```

`hasDependentFacts` 不能再作为 own-definition count 的别名。若保留兼容字段，只能由最终 `inboundBomReferences` 和其他已批准 blockers 派生，不能由 `ownedActive*Count` 派生；所有调用方要迁移到命名明确的字段，禁止保留 fallback 判断。

查询逻辑由 inventory owner 在一个 scoped set-based read 中完成：

1. 锁/读取 subject 在当前 scope/brand 下的**全部** target refs（item subject 读取 `stock_target.item_ref`，SKU subject 读取 `stock_target.product_sku_ref`），按 UUID 顺序；在 typed projection 中明确分成 `ownedTargetRefsAllStatus`、`ownedActiveTargetRefs` 与 `ownedDisabledTargetRefs`，不能只加载 active 集合后再声称能识别 disabled 命中。
2. 只对 `stock_bom.definition_status='ENABLED'` 的 BOM 展开 `rows`；只接受 row status 为 `ACTIVE`（缺省 status 的现有兼容语义若仍被设计接受，必须在 owner test 中显式锁定）。整条 BOM 或 row 已 inactive/history 才不产生 current blocker。
3. 在一次 scoped set-based projection 中把 active row 的 `targetRef`/accepted alias 与上述全状态 target 集合匹配：命中 `ownedActiveTargetRefs` 时，若 BOM owner 是当前 subject，则归入 own-definition retirement 集合，否则生成 `USED_BY_INVENTORY_BOM`；命中 `ownedDisabledTargetRefs` 时返回 mapping/invariant typed failure，不能静默当成“无引用”；无法唯一解析当前 scope 的关系也 typed fail closed。一次查询返回 source identity/count，不按 target 逐条 N+1 查询。
4. current scope/brand 是所有表和 source 的强制条件；source identity 也必须能唯一解析。不得用跨 scope/brand 的同 UUID、商品 code、SKU code 或 JSON label 作为关系值。
5. 复用 `InventoryOwnerService.references` 已证实的 JSON 展开语义，但作废判断必须拥有自己的 active-status、scope、owner-exclusion 和锁定边界；不能直接把 pageable task-read 当作 mutation precheck。

`catalogReferenceDependencies` 继续只负责 R13/R15 等 declared owner columns 的通用对账，不再被用作 BOM component lifecycle 判断；不得把 C02 塞进 `InventoryCatalogReferenceDeclarations` 的五条 column declaration。

### 2.2 BOM 保存 admission：新增/改变与既有引用分流

当前 `ResolvedBomTargets` 只按 scope/brand 做存在性查询。修复必须覆盖 canonical 与 legacy 两个保存入口，并在同一版本/CAS 保存边界内先取得当前 BOM 关系，再计算提交关系与当前关系的差集：

- 对 `submittedTargetRefs - existingTargetRefs` 以及实际改变了关系身份的行，执行 `definition_status='ENABLED'`、component eligibility、有效消费单位快照和 scope/brand 的统一 admission；缺失、跨 scope、非组件、无单位或 `DISABLED` 均返回现有 `REFERENCE_MAPPING_UNRESOLVED`（除非 contract source 已批准更细 typed reason），不得 fallback。
- 对未改变的既有 `existingTargetRefs`，只做当前 scope/brand 的身份存在性与关系一致性校验；即便 target 后续已 `DISABLED`，也按既有引用豁免保留，使用户仍能编辑商品的无关字段。它不得重新出现在候选列表，也不得被当成新的 current operational target。
- 当前源码与 C02 已证明持久化 row 带有 `targetRef`，其身份就是 `stock_target.target_ref`；在同一 CAS 边界内可直接用 `submittedTargetRefs - existingTargetRefs` 判断新增关系，不需要新增 row id 或另造关系主键。实现仍须核对重复 target、legacy alias 和关系顺序的真实 contract 约束，不能把该结论扩张成未证明的 row-level identity。

该分流同时满足“新引用不能指向已退休定义”和“历史既有引用不阻断普通编辑”两个相反反例；只修查询条件的更小替代会在其中一个边界上制造新的错误。

### 2.3 写命令：在同一事务退休自有定义

增加 inventory owner 的 typed command（名称可在 review 中微调，但能力边界不可改变）：

```text
retireCatalogVoidInventoryDefinitions(
  WorkspaceExecutionContext<CatalogAuthorizationScope> context,
  CatalogVoidSubject subject,
  String idempotencyKey
) -> CatalogVoidInventoryRetirementReadback
```

command 必须：

- 在当前 `REQUIRED` 事务中 recheck 入向 BOM 引用；不能只信详情阶段的旧 readback；
- 锁定 subject 的 catalog row 已由 catalog owner 先取得，inventory 自己按既有 owner lock helper 锁定用于 all-status 分流的 subject target rows（含 `DISABLED`）及相关 BOM rows；锁定顺序固定、按 UUID 排序，不能只锁 active rows 后再做 disabled/invariant 判断；
- 有入向引用时返回 typed `REFERENCE_BLOCKS_VOID`（或 review 接受的专用子码），不写任何 definition/status；
- 无入向引用时将 subject 自有 `ENABLED` 定义转为 `DISABLED`，不 delete、不改余额、不改 ledger、不重写历史 JSON；
- readback 必须证明 `retiredStockTargetCount`、`retiredProductBomCount` 与 `remainingActiveOwnedDefinitionCount=0`；
- 具有 idempotency receipt 与最终 owner readback；同 key 同 request replay，同 key 不同 request 拒绝；
- 任一步失败时 catalog item status 与 inventory definition status 一起 rollback。

这条 command 不是给 operations-admin 暴露的新 HTTP route，而是 catalog owner 调用 inventory owner 的内部 command boundary。

### 2.4 `DISABLED` 是历史快照，不是可操作的 current fallback

本方案会把自有库存定义从 `ENABLED` 退休到 `DISABLED`，因此必须同时收口同一状态边界：

- inventory 的 current/list/detail/配置/余额/调整等 operational path 只接受 `definition_status='ENABLED'`；读取历史余额或 ledger 必须走显式 historical read path，不能让通用 `target()` 或版本检查把 `DISABLED` 行当 current 返回。
- canonical 与 legacy `saveCatalogProductBom` 共用同一个 state-aware component resolver：新增或改变的组件 target 必须是当前 scope/brand 下的 `ENABLED`、可作为组件且具有有效消费单位快照；未改变的既有引用按当前 scope/brand 的存在性读取并保留编辑豁免，不得因 target 后续变成 `DISABLED` 而阻断商品修改。`ResolvedBomTargets` 不能只验证 UUID 存在，也不能用一个无条件 `ENABLED` 过滤替代这两个边界。
- 当前 `references` 只展开 `ENABLED` BOM 和 active row；active BOM row 若命中 subject 的 disabled target，不得被这条过滤静默隐藏，而要进入上文的 invariant/mapping fail-closed 分支。
- 不新增 `VOIDED` 到 inventory definition status，也不把历史定义物理删除。
- Dexter 已裁决不保留 `InventoryConsumptionReferencePage.entries[].status`。实现必须从唯一 contract source 删除该字段，并由 owning generator 同步 backend wire、edge contract、generated TS、frontend model/view/label 和测试；同时移除 runtime 对 BOM row status 的读取与 `ACTIVE` fallback，不以任何替代 status 表示该事实。
- Dexter 已裁决不保留 `InventoryConsumptionTargetCandidatePage.items[].status`。实现必须删除 candidate status 字段及其硬编码 `.put("status", "ENABLED")` 和 generated/frontend 依赖；现有 candidate 查询已经 JOIN `catalog.catalog_item`，该 JOIN 可继续服务于 item identity/name 等已有字段，但不得为 status 新增查询、operation 或把 catalog item status改成另一字段。`stock_target.definition_status='ENABLED'` 仍只作为候选 admission 条件。

这不是另造一套库存生命周期：它是 auto-retirement 能安全落地的必要反例闭合。余额、ledger、历史快照仍保留，只有 current operational projection 和 mutation admission 排除 `DISABLED`。

## 3. catalog owner 协调顺序

### 3.1 单商品作废

`CatalogOwnerService.transitionItemState` 在目标为 `VOIDED` 时采用以下顺序：

1. 锁定当前 catalog item 并校验 scope、expected version、`VOIDED` 不可逆规则。
2. 先执行 catalog 自有 blockers：SKU、identifier、production tag、catalog composite inbound 等现有事实。
3. 调用 inventory owner 的“入向判断 + 自有定义退休” command；不要再调用 generic `catalogReferenceDependencies(CATALOG_ITEM, ...)` 作为 BOM blocker。
4. inventory command 成功 readback 且无 active owned definition 后，更新 catalog item `status=VOIDED, version=version+1`。
5. 返回 owner readback；必要时在同一事务内按 authoritative owner source 生成 `voidAvailability`，不从旧 sections 猜测。

任何阻断、CAS 失败、owner mapping 失败或 readback 不一致都使整个事务失败；catalog 行保持原 version/status，inventory active definition 也保持原状态。

### 3.2 批量作废

批量 preflight 不能继续使用 `Map<UUID, CatalogReferenceDependenciesReadback>` 作为 inventory facts。应改为按稳定 UUID 顺序取得每个 subject 的明确 judgement，并在每个 item 的实际写路径再次检查。已裁决的批量规则是：以批量开始时的 graph 为线性化观察点；若 A 的 active BOM 引用 B，即使 A、B 同在本批，B 仍 fail closed，不能通过排序、预加载或先退休 A 释放 B；A 自身仍可按 own-definition 规则退休。CP-03 必须实现该固定语义，不得引入同批拓扑释放。

### 3.3 SKU sibling

`requireSkuRetirementUnreferenced` 需要同样区分 SKU 自有 definitions 与 inbound BOM rows。若 review 认定 SKU 生命周期暂不纳入本批，则必须在源码和测试中给出 `NOT_APPLICABLE_WITH_REASON`，并证明 item 修复没有改变 SKU 当前语义；不能让 SKU 继续误用扩展后的 item record。

## 4. detail read model 与 HTTP contract

### 4.1 详情与命令同源

`CatalogOwnerService.requireInventoryVoidDependencies` 改为消费 inventory owner 的明确 readback。`appendItemVoidBlockingReasons` 的规则：

- 删除 item void 场景下由 `stockTargetCount`/`productBomCount` 产生的 `HAS_STOCK_CONFIGURATION`、`HAS_BOM_CONFIGURATION`；
- 新增 `USED_BY_INVENTORY_BOM`，count 来自 active inbound component rows；
- 现有 catalog reason 原样保留；
- `canVoid = blockingReasons.isEmpty()`，不再允许技术 facts 有 count 但没有用户可理解 reason；
- `references` 仍是 catalog composite projection，不能为凑 count 把 inventory BOM 偷塞进该数组。

### 4.2 生成链

若现有 `voidAvailability` enum/union 未覆盖新 reason，或本次裁决要求删除 reference/candidate status，均只修改唯一 contract source 后按仓内 owning generator 生成：

```text
contract source / catalog-inventory-p1 input
  -> scripts/generate/catalog-inventory-p1.mjs
  -> edge contract + route registry + backend wire
  -> operations-admin generated TypeScript
```

不得手工编辑 `apps/frontend/operations-admin/src/app/api/generated/*` 或 backend generated registry。status 删除必须由 generator 同步完成，且不得以 `ACTIVE`/`ENABLED` 替代已删除字段。无新 endpoint、无新增 operation identity、无预算/CP05 变化。

## 5. operations-admin UI

修改面限定为现有 `CatalogItemGovernanceView`、model decoder 和 reason label：

- “商品关联”只保留 catalog composite count；
- “作废限制”使用“被其他商品用料引用”，显示 count/source names；
- A 只有自有 BOM 时，作废限制中不出现“已配置用料”，作废按钮由后端 `canVoid` 决定；
- B 有入向 BOM 时，按钮禁用/提交失败均由同一 `voidAvailability` 和 typed problem 驱动；前端不本地判断；
- 使用现有 foundation 的 detail surface、focus、error presentation，不在 app 内重复实现 Drawer/overlay/HTTP primitive；
- 不新增“先删除 BOM”按钮、不新增中间确认流程、不把 UUID/raw ref 放进用户文案。

## 6. 数据、迁移与生成物

- 现有 `definition_status ENABLED|DISABLED` 已能表达退休；优先不新增 migration。
- 如果源码核对发现某类定义没有可逆的 `ENABLED -> DISABLED` owner command，才提出最小 migration；在此之前不得通过物理删除或改枚举止血。
- 任何 policy/contract/manifest 改动必须由 generator 重生成并对比当前 owning source；生成物的 digest/registry/TS 同步验证。
- C02 已是 component path 正本，优先补它的 lifecycle consumer 语义或测试，不复制一个“void 专用 targetRef 矩阵”制造双真相。

## 7. 验证设计

### 7.1 backend owner / catalog integration

至少覆盖：

1. A 只有自有 `stock_target` + `stock_bom`，作废成功；两类 definitions 都为 `DISABLED`，catalog 为 `VOIDED`，历史/ledger/余额不被删除。
2. B 有 active target，A 的 active BOM row `targetRef` 指向 B；B 详情返回 `USED_BY_INVENTORY_BOM`，B 作废 typed fail，version/status/definition 不变。
3. A 的 BOM 为 `DISABLED` 或 row 非 active；B 不被这条历史关系阻断。
4. 同一 UUID 跨 data node/brand；只命中当前 scope 的关系。
5. 入向判断 query 结果为空、source mapping 缺失、target 非唯一；分别验证 success 或 typed fail-closed，不得 false-green。
6. 并发 BOM 写与 void、CAS 冲突、同 idempotency key replay；验证无半提交。
7. disabled target 的 current/list/config/balance/adjust mutation 全部 typed fail closed，balance、version、ledger 不变；legacy 与 canonical BOM resolver 对 disabled target、component eligibility、消费单位快照给出相同结果。
8. `ResolvedBomTargets` 对新增/改变的 disabled、非组件、缺单位、跨 scope target 拒绝；对未改变的既有 disabled 引用允许无关字段编辑；canonical/legacy 两入口结果一致。
9. reference `entries[].status` 与 candidate `items[].status` 在 contract、generated、runtime、UI、seed/L2 fixture 和测试中均无残留；没有 `ACTIVE`/`ENABLED` 替代字段或旧 label，candidate JOIN 不因删除 status 而新增查询/operation。
10. SKU sibling 与 option value counterexample 按第 3.3 节的最终裁决验证。

### 7.2 HTTP acceptance

没有新增 HTTP operation。若 `voidAvailability` reason enum 或 transition readback contract 变化，更新既有 Catalog acceptance 场景；每个新业务场景必须在 `CatalogAcceptanceScenarios.java` 中声明真实 fixture、真实 request、business oracle、owner readback 与 unchanged-on-failure，不把断言堆回入口。

重点场景：

| 能力 | fixture | request | business oracle |
| --- | --- | --- | --- |
| own BOM retirement | A 自有 target/BOM | `transitionOperationsCatalogItemStatus` → `VOIDED` | 200、A VOIDED、owner active definition=0、历史仍在 |
| inbound BOM block | A→B active row | B 同一 transition | 422 typed reference block、B version/status unchanged、reason 显示 A |
| inactive/history | disabled BOM / old snapshot | B transition | 不由历史引用阻断 |
| scope isolation | same code/ref across scopes | B transition in one scope | 只使用当前 scope facts |
| BOM admission state boundary | new/changed disabled target + unchanged existing disabled target | canonical/legacy save | 新/改变引用 typed reject；未改变既有引用可编辑且不进入候选 |
| status deletion boundary | reference/candidate status | detail/candidate read | 两个 status 字段均不存在于接口与 UI；无 `ACTIVE`/`ENABLED` 替代投影或 fallback |

### 7.3 seed 与 browser L2

- seed 以 owner HTTP 建立 A→B graph；不直接写数据库，不复制旧 run 产物；最终 readback 同时核对 A/B detail、transition、inventory definitions。
- L2 使用独立 TEST fixture，不消费 DEV seed/API report；至少真实浏览 A 的可作废治理状态和 B 的“被其他商品用料引用”阻断，并确认旧空间入口已下线/不再产生另一套语义。
- 动态执行须另按当前受管 runtime 授权；本详设阶段不宣称任何 L2/seed/DEV 已通过。

## 8. 失败、日志与对账

每个 owner command/transition/retrieval 保留 requestId、阶段、受控日志路径和 first failure；日志不得记录 token、cookie、Authorization、raw payload 或 UUID 以外的敏感身份信息。business 与 cleanup 分开。

实施收口前必须完成一次全批逐项三维回读：原始用户问题、J-CIB-001/本修订/IA、项目 memory 与 owning source；逐项对齐行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、焦点、数据来源/失效边界。当前三项 Dexter 裁决已完成，实施顺序为“contract/source 删除两个 status → owning generator 生成/校验 → `scripts/verify --validate-only` → focused tests → backend acceptance → L2 → seed/readback”；`scripts/verify` 必须位于所有测试之前，但不能在旧 generated 输出上先验。backend acceptance 场景总数不设历史 80 条 cap，覆盖量由业务 oracle 决定；任何一个层面仍消费旧 `HAS_BOM_CONFIGURATION` 作废语义、保留任一 status 残留、或把新增/改变与既有 BOM 引用混为一个 status admission，都不能交付。
