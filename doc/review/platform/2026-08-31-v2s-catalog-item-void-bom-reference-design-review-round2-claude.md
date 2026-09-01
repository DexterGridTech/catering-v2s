# 商品作废与库存 BOM 引用语义 · 修订后 DESIGN 复评(第二轮)

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
IMPLEMENTATION_AUTHORITY=false
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO
M/S/N=0/0/3
BLIND_REVIEW=FALSE
```

**利益边界**:上一轮 NO-GO 报告由我撰写。本轮按要求**不继承**该报告结论,从当前文档与当前源码事实重新核验;
下文多处推翻或收窄了我自己上一轮的表述。**本轮为静态 DESIGN review,未运行**任何 DEV、reset、seed、
browser L2、acceptance、UAT、部署或数据操作。

---

## 结论

**GO。** 四条旧 finding 全部得到正确处置,其中 **M-1 的重新定性比我上一轮更准**,
**S-1 的可实施性疑虑被详设预先化解**。无 M、无 S。三条 N 均为增强项与残留提示,不阻断。

---

## L1_ENGINEERING

### 1 · M-1 确为三类 status 事实混用,不是"少一个 enum 成员" —— `CONFIRMED`

我独立复核了三处运行时事实,与处置记录第 31 行的结论一致:

- **BOM reference row status**:`InventoryOwnerService.java` 第 5019 行
  `COALESCE(entry->>'status','ACTIVE')`、第 5055 行 Java 同样兜底 `"ACTIVE"`;
  全文件仅 3 处 `put("status"`,持久化 BOM row 的构造(`targetRef`/`ownerRef`/`productSkuRef`/
  `optionValueRef`/`itemCode`/`quantity`/`lineSign`/`consumptionUnitSnapshot`)**不含 `status` 键**。
- **stock target definition status**:`InventoryOwnerService.java` 第 4509 行
  `put("status", "ENABLED")` 是**硬编码字面量**,不读任何列。
- **catalog item lifecycle status**:三值 `ENABLED|DISABLED|VOIDED`,即契约 enum 实际描述的那一个。

三者在 `inventory-workbench.schemas.json` 里被声明为**同一个三值 enum**。
**因此这不是缺一个成员,是三种不能互相冒充的事实共用了一个声明。**
我上一轮只找到第一处,把它写成"恒发 enum 外的值";**本轮修订的定性更完整,我据此收回上轮的窄化表述**。

**reference status 的业务含义能否从已批准材料推出:不能。**
我通读 `2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md`(`DEXTER_ACCEPTED`)与
`-ui-interaction.md`(`DEXTER_WIREFRAME_ACCEPTED`),两份只定义了:组件候选五条件(同 scope、状态可用、
`BOM_COMPONENT`、已有 StockTarget、单位完整、非自引用)、生命周期四维(余额/流水/BOM 引用/历史定义快照)、
单位状态、商品状态。**没有任何一条赋予单条 BOM row 自己的生命周期。**
故 `DEXTER_DECISION` 应当保留;详设第 177 行「不得只把 runtime 的 `ACTIVE` fallback 加入 enum」
与处置记录第 39 行「裁决前不新增 `ACTIVE`、不缩窄/扩展 union、不改 label、不手工编辑 generated」
是正确处置。**猜测性补 `ACTIVE` 会把一个默认值固化成契约事实。**

### 2 · candidate `items[].status` 的定性与最小正确 owning fact —— `CONFIRMED`

`InventoryOwnerService.java` 第 4509 行硬编码 `"ENABLED"`;而该查询第 4477 行起的 WHERE 已经过滤
`target.definition_status='ENABLED' AND target.component_eligible=TRUE AND target.consumption_unit_ref IS NOT NULL`。
**所以该值是构造上恒真,不是"撒谎"** —— 但它挂在一个商品形状的投影上
(`itemRef`/`itemCode`/`itemName`/`productSkuRef`/`skuCode`),契约 enum 又是**商品**的三值集,
消费方会把它读成商品状态。处置记录第 37 行「不得继续用 target definition eligibility 硬编码冒充
catalog item status;若保留,必须从 catalog owner fact 读取,target eligibility 仍作为独立 admission 条件」
**定性准确**。

**最小正确 owning fact(本轮实测,可直接采用)**:该查询第 4468 行已经
`JOIN catalog.catalog_item item`,因此读商品状态是**在既有 JOIN 上加一列 `item.status`**,
不需要新 join、新查询、新 operation。target eligibility 保持为独立 admission 条件不进该字段。
详见 N-1。

### 3 · S-1 的 state-aware resolver 可由现有 BOM JSON / command contract / CAS 实现 —— `CONFIRMED`

**我先独立找出了实施缺口,再发现详设已经点名了它。**

缺口:`saveCatalogProductBomCore`(`InventoryOwnerService.java` 第 3402 行起)当前只
`SELECT version FROM inventory.stock_bom ...` 做 CAS,**不读既有 `rows` JSON**;
`ResolvedBomTargets.load`(第 3398 行处调用点、`ResolvedBomTargets.java` 第 24 行)只接收
请求中的 targetRefs。**因此当前保存路径没有可比对的基线**,若不补既有关系读取,
"state-aware" 无法落地,实施方极可能退回无条件 `ENABLED` 过滤 —— 即 S-1 原缺陷。

详设 §2.2 第 87 行已明写:「在同一版本/CAS 保存边界内**先取得当前 BOM 关系**,
再计算提交关系与当前关系的差集」。**这正是所需的那一步,且被放在同一 CAS 边界内。**

**是否必须改 contract:否。** 持久化 row 已带 `targetRef`(矩阵 C02:objectType `STOCK_TARGET`,
sourceLookup `stock_target.target_ref`),`submittedTargetRefs - existingTargetRefs` 可直接由
既有 rows 的 targetRef 集合算出,不需要新增 row id 或另造关系主键。
详设第 91 行「若当前 contract 无法表达『改变』的判断,先停在 contract/design decision,
不用无条件 enabled filter 止血」是正确的保守写法;**按本轮实测,该 stop 条件不会触发**(见 N-2)。

### 4 · 三个反例的构造与详设覆盖 —— 全部闭合

| 反例 | 详设覆盖 | 判据出处 |
| --- | --- | --- |
| 新增指向 disabled target 被错误接受 | 第 89 行:对 `submittedTargetRefs - existingTargetRefs` 及关系身份改变的行执行 `definition_status='ENABLED'` + component eligibility + 有效消费单位 + scope/brand 统一 admission,缺失/跨 scope/非组件/无单位/`DISABLED` 一律 `REFERENCE_MAPPING_UNRESOLVED`,不得 fallback | 详设第 89 行 |
| 未改变的既有 disabled target 被错误拒绝 | 第 90 行:只做存在性与关系一致性校验,即便后续 `DISABLED` 也保留编辑豁免;同时明确它不得重回候选列表、不得当成新的 current operational target | 详设第 90 行 |
| canonical 与 legacy 结果不一致 | 第 124 行:canonical 与 legacy `saveCatalogProductBom` **共用同一个 state-aware component resolver** | 详设第 124 行 |

第 93 行的自陈判断正确:「只修查询条件的更小替代会在其中一个边界上制造新的错误」。
第 226 行给出可证伪验收边界(new/changed disabled target + unchanged existing disabled target,
canonical/legacy 双入口)。

**该豁免有已批准材料背书**,不是本设计自创:`-ui-interaction.md` 第 105 行
「已有停用绑定仍可见」、第 135 行「已有停用绑定单独 readback」;
平台侧另有后台编码规范 1-N「保存时只对本次新增或改变的引用做必须启用校验;未变更的既有引用一律放行」。

### 5 · A/B 方向、own-BOM exclusion、自引用、active/disabled/history、scope/brand、唯一映射、eligibility、单位、fail-closed —— 闭合

本轮重新独立推导 A/B 方向(不复用上轮):
`contracts/policy/catalog-inventory-reference-path-matrix.json` 的 **R15**
(`stock_bom.item_ref`,jsonPath `/rows/*/ownerRef`,objectType `CATALOG_ITEM`)= **A**;
**C02**(jsonPath `/rows/*/targetRef`,objectType `STOCK_TARGET`)= 指向 stock_target。
`ResolvedBomTargets.java` 第 15–16 行 SQL 印证。**两跳解析在详设第 48、52 行保留正确**(N-1 保留项成立)。
own-BOM exclusion、自引用、all-status 三分、disabled 命中 typed failure、无法唯一解析 fail closed
均在详设第 77、79 行,一次 set-based 查询不 N+1。

### 6 · 自动退休、入向阻断、详情与 mutation 同源、事务/CAS/幂等/rollback/readback —— 合理

详设第 102 行:无入向引用时把自有 `ENABLED` 定义转 `DISABLED`,不 delete、不改余额、不改 ledger、
不重写历史 JSON;第 25 行不变约束保留「跨 owner 写在同一 `REQUIRED` 事务」「catalog 不直接读写 inventory 表」;
§2.3 收口 DISABLED 不得被通用 `target()` 或版本检查当 current 返回。

### 7 · change surface —— 完整

唯一链路(详设第 159–177 行):contract source / `catalog-inventory-p1` input → edge contract +
route registry + backend wire → 生成 TS;禁止手改 `apps/frontend/operations-admin/src/app/api/generated/*`
与 backend generated registry;acceptance 要求真实 fixture/request/business oracle/owner readback/
unchanged-on-failure;seed 走 owner HTTP 不直写 DB;L2 用独立 TEST fixture 不消费 DEV seed/API report;
旧空间入口下线检查;第 223 行收口判据可证伪(任一层面仍消费旧 `HAS_BOM_CONFIGURATION` 即不得交付)。
第 177 行另加一条本轮关键约束:**status 决策完成前不得刷新相关 generated status shape**。

### 8 · 五个更小方案的比较 —— 详设的取舍正确

| 更小方案 | 为什么不足(本轮独立判断) |
| --- | --- |
| 只增加 `ACTIVE` enum | 在未判定业务含义前把一个**默认值**固化成契约事实;且完全不触及 candidate 硬编码那一处 |
| 只改 candidate/reference label | 文案改动不改变"三类事实共用一个声明"的结构,违规原样存在 |
| 只给 resolver 加 `ENABLED` | 会在"未改变的既有 disabled 引用"边界上制造新错误,与 1-N 及已批准 UI 的"已有停用绑定仍可见"直接冲突 |
| 删除无业务含义的 reference status | **可能是正解,但前提是先判定它确实无业务含义** —— 该判定属产品范畴,未裁前删除同样是猜测 |
| 保留 status 但补齐 owner/source/闭集 | **同上,需要 Dexter 先给出业务含义** |

后两项互为镜像,共同指向同一个 `DEXTER_DECISION`。详设保留该决策而不二选一,**处置正确**。

### 9 · 无意新增 —— 未发现

详设第 25 行:不添加新 HTTP operation;不改变 CP05 operation/DB budget ceilings 或放宽业务事实;
第 177 行:无新 endpoint、无新增 operation identity、无预算/CP05 变化;
第 126 行:不新增 `VOIDED` 到 inventory definition status、不物理删除;
第 192–193 行:优先不新增 migration,只有在源码核对发现某类定义无可逆 owner command 时才提最小 migration;
第 188 行:不新增按钮/中间确认流程/不把 UUID 放进用户文案;
第 148 行与处置记录第 63 行:batch 拓扑规则维持 `DEXTER_DECISION`,未裁前不实施、
且**不把该项混入 M-1/S-1 修复**。**均未发现无意新增。**

---

## L2_USER_VISIBLE

`NOT_RUN`。本轮为静态 DESIGN review,未运行 browser L2 或任何用户可见验证。
详设第 216–217 行自陈「本详设阶段不宣称任何 L2/seed/DEV 已通过」,该自律正确并应保持。

---

## L3_UNVERIFIED

- **reference status 的业务含义** —— `DEXTER_DECISION`,现有已批准材料无法推出 owner/source/闭集。
- **同批 A/B 是否允许拓扑释放** —— `DEXTER_DECISION`,维持不实施。
- **M-1 两处的运行时取值** —— 源码路径静态可判(必然产出 `ACTIVE` 与硬编码 `ENABLED`),
  但**实际 HTTP 返回值本轮未运行验证**,标 `UNVERIFIED_REQUIRES_EVIDENCE`。
- **`CatalogOwnerService.java` 第 2941 行 `put("status","IDENTITY")`** 是否落在带 enum 的 wire 字段上 —— 见 N-3。
- 详设内所有 acceptance/seed/L2 条目 —— 仅为设计承诺,无运行证据。

---

## SAME_ROOT_SCAN

**根因定义**:字段的运行时取值与其声明闭集不相交,或一类事实的 status 冒充另一类事实的 status。

我扫描了两个 owner 的全部 status 字面量写入与 `COALESCE(...status...)`,全集与判定:

| 位置 | 判定 |
| --- | --- |
| `InventoryOwnerService.java` 第 5019/5055 行(reference `ACTIVE`) | **同根,已在设计范围内** |
| `InventoryOwnerService.java` 第 4509 行(candidate 硬编码 `ENABLED`) | **同根,已在设计范围内** |
| `CatalogOwnerService.java` 第 4133 行(unit 投影 NULL→`ENABLED`) | **非同根**。`ENABLED` 在该字段 enum 内(base-1 已取齐三值),属集合内防御性默认 |
| `CatalogOwnerService.java` 第 3925/3928 行(`COALESCE(sales_unit.status,'ENABLED')`) | **非同根**,同上 |
| 第 2641/2832 行 `COMMITTED` | **非同根**。`ownerReadbacks[].status` 自有 enum `COMMITTED|CONFLICT` / `COMMITTED` |
| 第 2924 行 `REUSE`、第 7507 行 `REUSE_OR_CREATE` | **非同根**。`mappingPreview[].status` 自有 enum `BLOCKED|CREATE|REUSE|REUSE_OR_CREATE|REWRITE` |
| 第 2941 行 `IDENTITY` | **未闭合** —— 全契约 enum 扫描未命中该字面量,见 N-3 |

**结论:M-1 的同根实例恰为 2 个,均已在设计范围内;无未扫描的第三个同根实例**,
唯一残留是第 2941 行的归属未定(N-3),且不属本设计范围。

---

## DESIGN_GAPS

**无阻断级 gap。** 三处正本层面的判据缺口如下,均已被详设正确地"停在决策"而非猜测填补:

1. **reference row status 的 owner/source/闭集**在任何已批准 Journey/UI/需求中都不存在判据 ——
   这是**正本缺口**,不是详设缺口。详设保留 `DEXTER_DECISION` 是唯一正确处置。
2. **同批 A/B 拓扑释放**同样无正本判据,维持 `DEXTER_DECISION`。
3. **candidate `status` 字段是否应当存在**:若商品状态已可从 `catalog_item` 读取,
   该字段在候选列表语境下是否有独立业务价值,正本未答。详设给了"若保留则从 catalog owner fact 读取"
   的条件式处置,已足够;是否保留仍宜由 Dexter 一并裁。

---

## EVIDENCE_TIER

| 档位 | 本轮状态 |
| --- | --- |
| **静态已证** | M-1 三类事实的源码路径(第 5019/5055/4509 行)、candidate WHERE 过滤、BOM row 无 `status` writer、`saveCatalogProductBomCore` 只 `SELECT version`、candidate 已 `JOIN catalog.catalog_item`、矩阵 R15/C02 与 `ResolvedBomTargets` SQL、同根扫描全集 |
| **测试已证** | 无。本轮未运行任何 focused test 或 acceptance |
| **动态/无人验证** | 全部 acceptance、seed、browser L2、DEV、reset、UAT;M-1 两处的实际 HTTP 返回值 |

**未把文档自洽当作实现证据**:上表"静态已证"各项均来自打开源码与契约核对,
不来自详设的自述。

---

## 实际打开核对的文件

`AGENTS.md`、`CLAUDE.md`;详设、实施方案、问题分析、处置记录、Journey 修订、
`2026-08-22` 的 BOM configuration journey 与 ui-interaction;
`contracts/policy/catalog-inventory-reference-path-matrix.json`;
`contracts/openapi/components/inventory/inventory-workbench.schemas.json` 及全 `contracts/openapi/components/**` 的 enum 扫描;
`ResolvedBomTargets.java`、`InventoryOwnerService.java`、`CatalogOwnerService.java`。

**未逐行通读**:`InventoryOwnerApi.java`、`CatalogInventoryCoordinator.java`、
`InventoryDetailDrawer.tsx`、`catalogModel.ts`、`CatalogItemGovernanceView.tsx`、
`catalog-inventory-p1.mjs` 全文、`CatalogAcceptanceScenarios.java`、
`InventoryCatalogReferenceDependenciesIntegrationTest.java` —— 本轮仅按关键符号检索命中处核对,
未做逐行覆盖,相应结论限于所引行号。

---

## N 级 finding

**N-1 · candidate status 的最小 owning fact 已可直接给出** · `CONFIRMED` · 增强项。
`InventoryOwnerService.java` 第 4468 行该查询已 `JOIN catalog.catalog_item item`,
故"从 catalog owner fact 读取"落地为**在既有 JOIN 上加一列 `item.status`**,
无需新 join/新查询/新 operation。建议把这一句写进详设,免得实施方误以为需要新增读路径。
**为什么更小的替代不足**:不写明来源,实施方可能新建一次 catalog 读或继续硬编码。
**需要 Dexter**:该字段是否保留(见 DESIGN_GAPS 第 3 条)。

**N-2 · "改变"的判断可由现有 contract 表达,详设的 stop 条件不会触发** · `CONFIRMED` · 增强项。
详设第 91 行保守地写了"若当前 contract 无法表达『改变』的判断,先停在 contract/design decision"。
本轮实测:持久化 row 已带 `targetRef`(矩阵 C02),`submittedTargetRefs - existingTargetRefs`
可直接算出,**不需要新增 row id 或关系主键**。建议在详设注明这一实测结论,
**否则实施方可能因保守而不必要地停下来**。
**需要 Dexter**:否。

**N-3 · 同根扫描的唯一残留** · `UNVERIFIED_REQUIRES_EVIDENCE` · 不属本设计范围。
`CatalogOwnerService.java` 第 2941 行 `put("status","IDENTITY")`,
全契约 enum 扫描未命中 `IDENTITY` 字面量。两种可能:该字段无 enum 声明(则属规范 1-O 范畴),
或其 enum 在本次扫描分母之外。**本设计不需要处理它**,记录以免同根扫描被误认为已全闭。
**需要 Dexter**:否。

---

## 授权边界

本次仅为只读 DESIGN review。`GO` **不授权**修改源码、contract、generated 文件、migration、测试,
也不授权 DEV、reset、seed、browser L2、UAT、部署、数据操作或任何仓库控制动作。
`GO` 表示"当前设计材料可以进入实施",**不等于**实施结果的接受;实施后仍需按详设 CP-08 的顺序
完成动态验证并另行评审。两处 `DEXTER_DECISION`(reference status 业务含义、同批 A/B 拓扑释放)
未裁前不得自行固化。
