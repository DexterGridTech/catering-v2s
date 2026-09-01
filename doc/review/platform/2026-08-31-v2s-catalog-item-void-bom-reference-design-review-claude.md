# 商品作废与库存 BOM 引用语义 · 设计独立评审 · NO-GO(M=1 / S=1 / N=2)

```text
VERDICT=NO-GO
M/S/N=1/1/2
```

**会话出处**:fresh v2s-rooted 只读设计评审。我先从 `contracts/policy/catalog-inventory-reference-path-matrix.json`
与 owner 源码**独立推导** A/B 方向,再读作者材料。**本轮不运行**任何 DEV、reset、seed、L2、acceptance
或动态测试;下文凡结论均为**静态设计结论**,已逐条标注。

---

## 结论

**方案方向是对的,四份材料的质量明显高于我的预期。** NO-GO 只卡在一条:
设计第 116 行点到了正确的字段族,却把那里的缺陷**说错了** ——
该字段当前的真实违规是恒发 `"ACTIVE"`,而设计描述的是 `VOIDED` 文案。
按设计原文实施**不会修好它,反而可能把它盖住**。

---

## 独立推导:A/B 方向(先于读作者结论)

`contracts/policy/catalog-inventory-reference-path-matrix.json`(`DEXTER_ACCEPTED_20260808`)给出:

- **R15** `inventory.stock_bom.item_ref`,jsonPath `/rows/*/ownerRef`,objectType `CATALOG_ITEM` —— **A(BOM owner)**
- **C02** jsonPath `/rows/*/targetRef`,objectType **`STOCK_TARGET`**,sourceLookup `inventory.stock_target.target_ref`

源码印证:`ResolvedBomTargets.java` 第 15–16 行
`SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND target_ref = ANY(?::uuid[])`。

**因此 `rows[*].targetRef` 指向的是 stock_target,不是商品。** 到组件商品 B 是**两跳**:
`rows[*].targetRef` → `stock_target.target_ref` → `stock_target.item_ref` = B。

**设计把这一跳做对了**(见下),但评审请求正文把它压成了"B 是 `rows[*].targetRef` 指向的组件商品",
见 N-1。

---

## 静态设计结论:逐项核验

### 1 · A/B owner/component 方向 —— **正确**

详设第 46–48 行三分清楚:`stock_target.item_ref` / `stock_bom.item_ref` 归为
「inventory owner 自有定义 · 统计后退休,**不是 inbound blocker**」;
只有「active `stock_bom.rows[*].targetRef` 指向 subject 的 active target **且 BOM owner 不是当前 subject**」
才是 blocker。第 52 行进一步锁死「`targetRef` 只能同 scope/brand 精确匹配 `stock_target.target_ref`;
不使用商品 code、SKU code、JSON label 作为关系值」—— 两跳关系被表达为集合成员判定,等价且更省一次 join。

### 2 · all-status 与 ENABLED/DISABLED 分流 —— **完整**

第 77 行强制 typed projection 分成 `ownedTargetRefsAllStatus`、`ownedActiveTargetRefs`、
`ownedDisabledTargetRefs`,并明写「不能只加载 active 集合后再声称能识别 disabled 命中」。
第 100 行要求锁定**含 `DISABLED`** 的 subject target rows,按 UUID 固定顺序,
「不能只锁 active rows 后再做 disabled/invariant 判断」。

### 3 · 四类 fail closed —— **齐全**

第 79 行逐条:命中 active 且 BOM owner 是 subject → own-definition retirement(**own-BOM exclusion**);
owner 不是 subject → `USED_BY_INVENTORY_BOM`;命中 `ownedDisabledTargetRefs` → typed failure,
**不得静默当成"无引用"**;无法唯一解析 → typed fail closed。并要求一次 set-based 查询,不 N+1。
self-reference 由 own-BOM exclusion 覆盖。

### 4 · A 退休 / B 阻断 —— **成立**

第 102 行:无入向引用时把 subject 自有 `ENABLED` 定义转 `DISABLED`,
「不 delete、不改余额、不改 ledger、不重写历史 JSON」;第 50 行把 `definition_status=DISABLED`
定性为 inventory history、保留。B 侧由第 48 行的 blocker 规则必然阻断。
第 191–192 行给了两条可证伪的验收断言。

### 5 · detail / mutation / batch / SKU sibling 同源 —— **成立**

第 35、67 行以 `subjectKind: CATALOG_ITEM | PRODUCT_SKU` 与 `sourceOwnerKind` 贯穿;
第 40 行明写 SKU 是同根 sibling **必须同一轮回源核对**,不能被 generic column scan 遗漏;
第 77 行按 subjectKind 分别读 `item_ref` / `product_sku_ref`;
第 136 行要求批量按稳定 UUID 顺序逐 subject judgement **并在每个 item 的实际写路径再次检查**。

### 6 · DISABLED 不被当作可操作对象 —— **成立,且是本设计最见功力的一节**

§2.3(第 109–118 行)把 auto-retirement 的必要反例一次收口:operational path 只接受
`definition_status='ENABLED'`;历史余额/ledger 必须走显式 historical read path;
**不得让通用 `target()` 或版本检查把 `DISABLED` 行当 current 返回**;
不新增 `VOIDED` 到 inventory definition status;不物理删除。第 118 行自陈「这不是另造一套库存生命周期」
——判断正确:它是退休语义能安全落地的前提。

### 7 · change surface —— **枚举完整**

第 159–165 行给出唯一链路 `contract source / catalog-inventory-p1 input → edge contract + route registry
+ backend wire → 前端生成 TS`,并禁止手改 `apps/frontend/operations-admin/src/app/api/generated/*`
与 backend generated registry;第 202 行要求 acceptance 场景带真实 fixture/request/business oracle/
owner readback/unchanged-on-failure;第 215–216 行要求 seed 走 owner HTTP(不直写 DB、不复制旧 run 产物)、
L2 用独立 TEST fixture(不消费 DEV seed/API report)并确认旧空间入口已下线;
第 217 行明写「本详设阶段不宣称任何 L2/seed/DEV 已通过」。
我已验证缺陷符号 `HAS_BOM_CONFIGURATION` 真实分布于生成 TS、前端 `catalogModel.ts` 第 26/44 行、
`catalogManifestLabels.ts` 第 26 行与后端测试 —— 与其列的 change surface 吻合。
第 223 行的收口判据可证伪:「任何一个层面仍消费旧 `HAS_BOM_CONFIGURATION` 作废语义都不能交付」。

### 8 · 验证顺序 —— **与要求逐条一致**

实施方案 CP-08(第 162–176 行):contract/source 修改 → owning generator 生成校验 →
`scripts/verify --validate-only` → focused tests → backend acceptance → browser L2 → reset/seed/DEV →
旧空间下线检查 → 三维回读。详设第 223 行另加一句关键约束:
**`scripts/verify` 必须位于所有测试之前,但不能在旧 generated 输出上先验。**

### 9 · 同批 A/B —— **正确隔离,标 `DEXTER_DECISION` 且 batch path 停止**

详设第 136 行与方案第 80、83、188 行一致:以 batch-start graph 为线性化观察点,
A 的 active BOM 引用 B 时**即使同批 B 仍 fail closed**,不通过排序或先退休 A 释放 B;
该产品语义标 `DEXTER_DECISION`,**未裁决前只实施单项 path,CP-03 batch 变化不是完成项**。

---

## M-1 · 设计第 116 行点对了字段族,但说错了缺陷;该字段当前恒发 enum 外的值

**等级** M · **仓内事实(非推论)** · 静态结论,无需动态证据即可证伪

**owning source**:
`apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`
第 5019 行与第 5055 行;
`contracts/openapi/components/inventory/inventory-workbench.schemas.json`
的 `/schemas/InventoryConsumptionReferencePage/properties/entries/items/properties/status`;
`apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts` 第 207 行。

**仓内事实**:

- owner SQL 第 5019 行:`COALESCE(entry->>'status','ACTIVE') AS status`;
- owner Java 第 5055 行:`.put("status", result.getString(13) == null ? "ACTIVE" : result.getString(13))`;
- **BOM row JSON 从不写 `status`** —— 全文件仅 3 处 `put("status"`,分别在第 1745 行(`CREATE`/`REUSE`,
  copy preflight)、第 4509 行(`ENABLED`,另一投影)与第 5055 行本身;
  持久化 row 的构造只写 `targetRef` / `ownerRef` / `productSkuRef` / `optionValueRef` / `itemCode` /
  `quantity` / `lineSign` / `consumptionUnitSnapshot` 等,**无 `status` 键**;
- 契约与生成 TS 都把该字段声明为三值:
  `status: "ENABLED" | "DISABLED" | "VOIDED"`(生成 TS 第 207 行)。

**因此该字段在运行时恒为 `"ACTIVE"`,恒不在自己的 enum 内。**
`InventoryConsumptionTargetCandidatePage.data.items[].status` 是同族第二处三值声明,须一并回源。

**影响面**:前端生成类型是三值联合,后端恒发第四个值。任何以
`satisfies Record<GeneratedUnion, string>` 建的字典对该值查不到,落成空白或裸码;
这正是后台编码规范 1-O 与 base-1 enum 治理要消灭的形态,而它就在本设计要动的读模型上。

**与设计的关系(这是它成为 M 的原因)**:详设第 116 行写
「现有 contract 中把库存对象描述为 terminal `VOIDED` 的文案/typed problem 必须回到 contract source
核对并与 `DISABLED` 历史快照语义对齐」。**字段族点对了,缺陷说错了。**
按该原文实施,实施方会去调整 `VOIDED` 的文案或把 enum 收窄为两值 ——
两种做法都**不会**让 `"ACTIVE"` 合法,收窄后反而与运行值差得更远,且改完门可能仍绿,
使这条违规被**盖住**而不是修好。

**可证伪的失败条件**:对任一存在 BOM 的 target 调用
`getOperationsInventoryTargetConsumptionReferences`,读取任一 `entries[].status`;
若返回值为 `"ACTIVE"`,则本条成立。反之若返回三值之一,则我错。
(该验证属动态,本轮**未运行**;但上述三处源码事实是静态可判的,不依赖运行即可确认代码路径必然产出 `"ACTIVE"`。)

**最小根因修复**:回到唯一 contract source 判定该字段的**业务含义** ——
它取自 BOM row JSON 的行级 status,与 `definition_status` 和 catalog item status 都不是一回事。
先定其真实闭集(至少含 `ACTIVE`),再由 owning generator 生成;或若该行级 status 本无业务含义,
则删除该字段而不是保留一个恒不合法的值。

**为什么更小的替代不足**:把 `"ACTIVE"` 直接加进 enum 能让类型对上,
但那是在没有判定业务含义的前提下把一个默认值固化成契约事实 ——
下一个读者仍无法回答"这个 status 到底描述谁"。只改文案则完全不触及违规。

**是否需要 Dexter 决策**:该字段的**业务含义**(行级 status 是否是一个真实业务事实)需要产品判断,
标 `DEXTER_DECISION`;若判为无业务含义则删除,不需要产品裁决。

---

## S-1 · BOM 保存侧的组件准入只验存在、不验状态,且未被列入 change surface

**等级** S · **仓内事实** · 静态结论

**owning source**:`ResolvedBomTargets.java` 第 15–16 行与第 39–43 行。

**仓内事实**:`requireResolved` 仅判断 `resolvedRefs.contains(targetRef)`,
其来源 SQL 无任何 `definition_status` 过滤。**今天可以把一条 BOM row 指向一个属于 DISABLED 定义的 target。**

**与设计的关系**:详设 §2.3 第 113 行要求「inventory 的 current/list/detail/配置/余额/调整等
operational path 只接受 `definition_status='ENABLED'`」,方向正确;但**BOM 保存的组件准入
(`ResolvedBomTargets`)未被点名**,而它恰是"新引用不得指向已退休定义"的把门处。
本方案会把自有定义批量退休到 `DISABLED`,退休后若该准入仍不看状态,
就会出现"作废流程刚把定义退休、随后仍可被新 BOM 引用"的回流。

**可证伪的失败条件**:A 作废后其 target 变为 `DISABLED`;
随后以另一商品保存 BOM 且 row 指向该 target;若保存成功,则本条成立。

**最小根因修复**:把 `ResolvedBomTargets` 的解析限定为 `definition_status='ENABLED'`,
未命中时沿用既有 `REFERENCE_MAPPING_UNRESOLVED` 或新增 typed reason,并把该类列入 change surface。
**为什么更小的替代不足**:只在详设文字里补一句"operational path 收口"不够 ——
该类是独立的准入点,不点名就会被 change surface 扫描漏掉(它不在 detail/list/mutation 任一常规路径命名里)。

**是否需要 Dexter 决策**:否。

---

## N-1 · 评审请求正文压掉了 targetRef 的那一跳

**等级** N · **口径提示,非缺陷**

请求正文写「B 是 `rows[*].targetRef` 指向的组件商品」。按矩阵 C02 与
`ResolvedBomTargets` 源码,`targetRef` 指向的是 **stock_target**,到商品 B 还需一跳
`stock_target.item_ref`。**详设本身没有犯这个错**(第 48、52 行正确)。
记录此条只为防止该措辞被当作实施 brief 传下去 —— 若实施方照字面把 `targetRef` 当商品 ref 解析,
会得到无法解析或解析到错误空间的结果。

## N-2 · 唯一需要 Dexter 的产品语义已被正确隔离

**等级** N · **`DEXTER_DECISION`,记录以免遗失**

同批 A/B 是否互相释放(拓扑释放)是本批唯一的产品/Journey 语义空白。
详设第 136 行与方案第 80、83、188 行**一致地**把它标为 `DEXTER_DECISION`,
并规定未裁决前只实施单项 path、CP-03 batch 变化不计为完成项。
处置方式正确,不构成缺陷;列在此处是为了让该裁决不因材料分散而丢失。
**建议的裁决问法**:批量作废 A 与 B 时,若 A 的 active BOM 引用 B,
是否允许"先退休 A 再释放 B"从而两者同批成功?当前设计选择"不允许",理由是
以 batch-start graph 为线性化观察点可避免顺序依赖;若允许则批量结果将依赖处理顺序。

---

## 证据分层声明

**本文全部结论为静态设计与源码结论。** 本轮**未运行** DEV、reset、seed、browser L2、
backend acceptance 或任何动态测试,**未把任何未运行命令当作证据**。
M-1 与 S-1 的失败条件中标注为动态的部分,本轮标记 `UNVERIFIED_REQUIRES_EVIDENCE`;
但两条的**源码事实**均可静态确认,不依赖运行。
设计材料自身也明确「本详设阶段不宣称任何 L2/seed/DEV 已通过」,该自律正确。

## 授权边界

本文只评审设计材料。`NO-GO` 不构成产品否决,只表示当前材料不宜直接进入实施。
**不授权**修改源码、generated 文件、migration,也不授权 DEV、reset、seed、L2、UAT、部署、
数据操作或任何仓库控制动作。M-1 的字段业务含义与 N-2 的同批语义两处需 Dexter 裁定,
未裁前不得自行固化。
