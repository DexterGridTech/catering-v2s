# P3 current-byte 独立 implementation review（Claude）

会话出处：fresh v2s-rooted 评审会话，非续接、非它仓。
本文是**新增复核记录**，不改写任何既有历史：
`2026-08-07-v2s-catalog-inventory-p3-static-implementation-review-claude.md`（我上轮 `NO-GO M=6/S=4/N=1`）
与两轮独立对抗复核（第二轮为该 review cycle 硬上限）均原样保留。
本文不因换文件名或换哈希重置 review 上限。

授权边界：仅 P3 当前字节静态 implementation、直接授权的 TemporaryPromotion 上游修复、
生成物、IA 控件对账与静态 evidence。**不授权也不背书** P1/P2 HTTP/API runtime、
Testcontainers、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、
媒体 cleanup。

---

## 0. 结论

**GO — M=0 / S=2 / N=3**

GO 的范围严格限定为**静态 implementation 与 IA 控件对账**。
business 与 cleanup 均为 `NOT_STARTED`，managedL2 为 `NOT_EXECUTED_REMOTE_GUARD`，
89 个控件 `runtimeStatus` 全部 `UNVERIFIED_REQUIRES_EVIDENCE`——这些本文一律不背书，
已按 Dexter 2026-08-07 裁定转入 P4 登记。

我上一轮的 6 M / 4 S / 1 N **逐条亲验确认闭合**，且都是行为修复而非文字搬运。
本轮两条 S 中，一条是对账表的字段语义问题，一条是自 P2 起挂账、已披露的门 FAIL；
均不构成静态实现的功能缺口。

---

## 1. 五个重点核验项的结论

### ① 临时商品来源事实的 owner 白名单与 Drawer 只读 —— **通过**

- **owner 白名单**：`CatalogOwnerService.externalIdentityFact()`（约 1022–1038 行）是严格 allowlist：
  只逐字段 `copyOptionalText` 放行 `sourceOrderRef` / `sourceRecordRef` / `sourceItemRef`，
  嵌套 `snapshot` 只放行 `name` / `specification` / `price`；
  `price` 走 `isIntegralNumber()` 判定后 `asLong()`，非整数显式置 null——**符合金额分制约定**。
  非 object 直接返回 null。**无任何 raw payload 穿透路径。**
- **两处读回一致**：详情（约 1011–1012 行）与治理块（约 451–452 行）都经同一个 fact 方法，
  治理块用 `deepCopy()` 避免共享可变节点。
- **契约声明**：`externalIdentity` 在 `catalog-inventory.openapi.yaml`（4 处）与
  `catalog-inventory-design-byte-coverage.json`（16 处，含三个 ref 各 2 处、snapshot 8 处）均有字段级声明。
  `catalog-inventory-read-models.json` 未出现该字段**不构成漂移**——该契约是模型名级
  （`name`/`required`/`recovery`/`ownerFactsAreReadOnly`），本就不列业务字段。
  （我最初据此怀疑契约缺声明，检查该文件结构后**证伪，结论以纠正后为准**。）
- **前端只读**：`CatalogItemDrawer.tsx:452–457` 是 `Descriptions` 六项只读渲染
  （来源订单/来源记录/来源商品/原始快照名称/规格/价格），价格经 `money()` 格式化；
  `catalogModel.ts` 的 `decodeExternalIdentity` 是 typed 解码，非 raw 展开。

### ② R2-M01 / M02 / M03 是否真行为修复 —— **三条均为真修复**

- **R2-M01 品牌复制库存 BOM 闭包**：协调器改为
  `combinedClosureCodes(codesFrom(catalogPreflight), owners.inventoryJudgement())`，
  把 inventory 侧预检判定出的 BOM 关联商品**并回闭包**，并同时写入
  `catalogRequest.closureItemCodes` 与 `ownerRequest.closureItemCodes`。
  即 catalog 与 inventory 两个 owner 拿到同一份合并后的闭包，
  修掉了"库存 BOM 引用的商品没被 catalog 复制过去"这一类断链。预检路径亦用同一合并函数。
- **R2-M02 分类作废与父级**：分类树查询（约 336 行）为每个节点计算
  `hasChildren`（非 VOIDED 子分类计数）并写入 `voidAvailability.dependentFacts` 的
  `CHILD_CATEGORY`，`canVoid` 同时要求无引用且无子级；
  `moveCategory`（647 行）有 `createsCategoryCycle` 与 `validateCategoryDepth` 双校验，
  自引用与环路抛 `HIERARCHY_CYCLE/422`。
- **R2-M03 TemporaryPromotion**：见 ①，上游契约（`TemporaryPromotionPreflightRequest`/
  `TemporaryPromotionExecuteRequest`/`TemporaryPromotionPreflight`）、owner typed 读回与
  前端 typed 消费三层齐备。

### ③ 五步复制 / 闭包重写 / 形态页签 / 库存四动作 / quickManage / 临时商品转正 —— **通过**

- **五步向导**：`LocalCatalogCopyDrawer.tsx` 85→434 行，`LOCAL_COPY_STEPS` 为
  `来源范围 / 来源商品 / 复制范围 / BOM映射 / 预览确认`，第四步有独立 `BomMappingStep` 组件（204 行处）。
  **我上轮 M-02 判的"三步骨架"已闭合。**
- **库存四动作**：`InventoryActionModal.tsx` 78→225 行。
  我上轮 M-05 指出的 `CONFIGURE` 死按钮（旧 36 行 `未发送请求` 直接 return）**已消失**，
  改为真实分支（145 行）；`FormValues` 补齐 `unit`、`note`、`zeroConfirmation`，
  并有零值确认校验（138–139 行：盘点数量为 0 且未确认时报"请输入 0 后确认现场实盘为 0"）。
- **quickManage**：`CatalogDictionaryDrawer` 新增 `quickManage` 模式（标题"快速创建商品处理标签 · 生产履约域"，
  quickManage 下不渲染完整字典表格），`CatalogItemDrawer:463` 以
  `initialKind="PRODUCTION_TAG"` + `onCreated={onProductionTagCreated}` 接入回填。
  **我上轮 M-06 判的"零实现"已闭合。**
- **临时商品转正**：`PromotionFormValues` 由 generated `TemporaryPromotionPreflightRequest` 派生
  （`formalCode`/`shapeKey`/`name`/`shortName`/`materialRole`），预检与执行分离。

### ④ 89 IA-ID / 43 L2 / 42 operations / 25 read models exact-set —— **通过（一处字段语义问题见 S-01）**

我独立复算，不采信自报：

- **89 IA-ID**：`controls` 数组 89 条，`iaIdCount` 89，一致。
  状态分布 `IMPLEMENTED_STATIC=86` + `OUT_OF_SCOPE_STATIC=3`（上轮为 29/40/7/10/3）。
- **locator 实证**：86 条已实现控件共声明 **180 个 locator**，我逐个回其声明的 `sourceFile` 检索：
  **169 个命中；在别的文件=0；文件不存在=0**。
  我上轮 S-03（18 个 locator 映射到错误文件）与 S-04（1 个 locator 全仓不存在）**均已闭合**。
  余 11 个见 S-01。
- **42 operations**：generated route registry 42 条（去重 42）vs OpenAPI operationId 42 条，
  **双向差集均为空**。
- **25 read models**：`catalog-inventory-read-models.json` 的 `models` 恰为 25 条。
- **43 L2**：`catalog-inventory-l2-scenarios.json` 中 `caseId` 43 个，
  `l2-locator-bindings.json` 的 `caseCount` 43，一致。
- **evidence 哈希**：`artifacts` 33 条，逐条独立复算 SHA-256，**33/33 命中当前字节，零漂移**。

### ⑤ 新的静态遗漏 / owner 越界 / 静默错误 / runtime 误报 —— **未发现新的功能性缺口**

我上轮两条"静默错误结果"逐条复验，确认真修：

- **列表筛选跨层断链（上轮 M-03）**：`CatalogItemPageQuery` 已扩为
  `smartViewKey / shapeKey / categoryRef / uncategorized / includeSubCategories /
  status / governanceStatus / source / cursor / pageSize / queryGeneration`；
  generated operation map 的 `query` 已由 `Record<string, JsonValue>` 改为 typed
  `CatalogItemPageQuery`（上轮 S-01 一并闭合）；
  后端 `items()` 先 `validateItemPageQuery(request)`（allowlist 见约 1226 行），
  再以 `WITH RECURSIVE category_scope` 做真实子树过滤。**不再是前端发、后端丢。**
- **库存计数冒充全量（上轮 M-04）**：SQL 结构为
  `classified → aggregate(COUNT(*) FILTER ...) → paged(OFFSET/LIMIT)`，
  **聚合开在分页之前的全集上**，末尾 `FROM aggregate a LEFT JOIN paged p ON TRUE`；
  前端 `InventoryManagementPage` 改用 `page?.counts`。计数口径正确。
  空页时 `LEFT JOIN … ON TRUE` 会产生一行 p.* 全 NULL 的幽灵行，
  代码在 410 行以 `if (row.target() != null)` 显式过滤，408 行同样 `filter(Objects::nonNull)`——**已正确处理**。

**两处我主动构造的静默错误假设，均被证伪，如实记录**：

1. 协调器 `lookup.put("pageSize", Math.min(codes.size(), 100))` 疑似在 codes>100 时静默截断商品富化。
   实测 catalog 与 inventory 两侧 `parsePageSize` 均强制 `1..100` 否则 422，
   codes 源自库存页故必 ≤100，**`Math.min` 不会触发截断**。
2. `itemCodesOnly` 路径 `pageSize=5000` 疑似上限截断。该路径仅用于复制闭包取码，
   而复制闭包本身有 `CLOSURE_OBJECT_LIMIT=500` 硬门在前，5000 不可达。

**runtime 误报**：未发现。`businessStatus`/`cleanupStatus` 均为 `NOT_STARTED`，
`managedL2: NOT_EXECUTED_REMOTE_GUARD`，89 控件 runtimeStatus 全为 `UNVERIFIED_REQUIRES_EVIDENCE`，
三个门的 FAIL 也如实标注未伪称 PASS。**作者未把静态或 fixture PASS 写成业务 PASS。**

---

## 2. Findings

### S-01｜`IA-CONTRACT-001..011` 把 locator 字段填成描述语句，阻断"locator 必须可解析"机械门

- **文件**：`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`，
  11 条 `IA-CONTRACT-001` … `IA-CONTRACT-011`。
- **依据类型**：仓内事实。这 11 条 `implementationStatus=IMPLEMENTED_STATIC`，
  但 `locator` 值为散文 `generated CatalogInventory operation/client types`，
  在全部前端源码中零命中。
- **影响范围**：这些是契约级 IA-ID，本就没有 UI 控件，locator 概念不适用——
  **不是实现缺失**。但用散文占据 typed 字段，使得"每个 IMPLEMENTED 控件的 locator 必须在仓内可解析"
  这条机械校验无法建立；我上轮 S-04（locator 不存在却报已实现）正需要这条门来防复发。
- **最小修复**：这 11 条的 `locator` 改为 `NOT_APPLICABLE`（或另立 `contractArtifact` 字段承载该描述），
  然后在对账生成环节加一条断言：`locator != NOT_APPLICABLE` 时必须在仓内可解析。
- **需 Dexter 裁决**：否。

### S-02｜`edge-codegen` 门 FAIL 自 P2 起跨两个包未收，且就落在本域

- **文件/证据**：`scripts/check/edge-codegen` fresh 复跑 exit=1，
  `P3_CAPABILITY_INVARIANTS:CAPABILITY_OPERATION_IDENTITY_DUPLICATE:preflightOperationsLocalCatalogCopy|POST|/operations/catalog-inventory/copy/local/preflight|operations-admin`。
  P2 evidence 已记为 `contractFace: KNOWN_BASELINE_FAIL; historical duplicate operation identity for preflightOperationsLocalCatalogCopy`，
  P3 evidence 记为 `edgeCodegen: FAIL_DUPLICATE_STANDALONE_CATALOG_COPY_OPERATION`。
- **依据类型**：仓内事实 + 门输出。
- **影响范围**：我已独立确认**不影响 42 operations exact-set**（registry 42 = OpenAPI 42，双向差集空），
  属 capability 面的身份重复登记，不是功能缺陷。但它是**本域内一条持续红着的机器门**，
  已跨 P2、P3 两个包，且我在 P4 登记里已列为 D-2「归属需 Dexter 裁定」。
- **最小修复**：在 capability 声明中去掉 `preflightOperationsLocalCatalogCopy` 的重复条目，
  保留 standalone 与 grouped 之一。预计是单文件单条目改动。
- **需 Dexter 裁决**：**是**——不是技术上难，而是**归属与时机**：
  是本轮顺手收掉、并入 P4，还是登记 HANDOFF。若你要求"进入 P4 前本域零红门"，本条须先修。

### N-01｜`frontend-architecture` 门仍 FAIL，但本域部分已清零

- **证据**：fresh 复跑 exit=1，`R4_GATE=FAIL`，7 条 `REQUIRED_EXPRESSION` 缺失全部落在
  `platform-contract-overview`、`operations-stores`、`operations-contracts`、
  `operations-head-company-brand-selector` —— **均为既有页面**。
- 我上轮 N-01 指出的两条 `UNREGISTERED_TABLE`（`CatalogWorkbenchPage.tsx`、
  `InventoryManagementPage.tsx`）**已从门输出中消失**，确认已注册。
- **最小修复**：剩余为全仓 baseline 债，建议登记 `HANDOFF.md`，不并入本域 P4。
- **需 Dexter 裁决**：否（除非你希望并入）。

### N-02｜43 个 L2 case 的用例级区分度仍偏弱

- **文件**：`apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`（142 行）。
- **依据类型**：仓内事实。上轮 468 行逐 case 复制的生成式代码已重构为
  `test.describe` + `for (const binding of locatorPolicy.bindings)` 数据驱动，
  上轮指出的"把 caseId 硬编码成字面量做 regex"痕迹**已修**（现用 `scenarioId` 变量）。
  分支内已有可证伪断言：`CI-L2-005` 断言无可信总公司来源时复制入口 `toHaveCount(0)`；
  `CI-L2-018` 断言"导入""导出" `toHaveCount(0)`；`CI-L2-014` 断言四个库存动作各存在且能打开盘点弹窗。
- **残余**：分支按 `scenarioId`（18 个）划分，同一 scenario 下的多个 case 走同一分支、
  仅 `binding.locator` 不同，末尾统一落到 `assertBoundControl`。
  即 **case 级差异主要体现为"换一个控件看是否可见"**。
- **最小修复**：不要求 43 条全部加深。P4 跑 L2 前，把承载业务判定的
  （复制向导逐步、库存四动作提交后回读、临时商品转正失败保留）补到状态级断言即可。
- **需 Dexter 裁决**：否。

### N-03｜P1 查询契约扩展的授权出处，本轮材料中未见记录（`UNVERIFIED`）

- **仓内事实**：`CatalogItemPageQuery` 现含 9 个新增筛选/分页字段，后端同步实现，
  这是修复我上轮 M-03 的正解路径（我当时给的选项①"重开 P1 补齐字段"）。
- **未验证部分**：本轮授权边界表述为「仅 P3 当前字节静态 implementation、
  **直接授权的 TemporaryPromotion 上游修复**」，未提及查询契约扩展；
  而 `git diff --stat HEAD -- contracts/` 显示 `catalog-inventory.openapi.yaml`
  不在当前未提交改动中，说明该扩展发生在更早的批次。
  **我无法从本轮材料确认它是否单独获批**，故标 `UNVERIFIED`，不作为 finding 计数依据之外的指控。
- **最小处置**：Dexter 一句确认即可闭合（若当时已批准，请在 P3 evidence 的
  `authorizationBoundary` 补一句该扩展的授权出处，便于后续审计）。
- **需 Dexter 裁决**：**是**（仅需一句确认）。

---

## 3. 方案合理性

- **问题对不对**：对。本轮修复都指向真实用户后果——库存 BOM 断链会让复制到门店的商品缺料，
  分类作废不校验子级会产生孤儿分类，临时商品来源事实缺失会让店员无法追溯外部订单来的商品。
- **方案优不优**：**明显优于上一轮**。三处特别值得肯定：
  ① `combinedClosureCodes` 把 inventory 判定并回闭包，而不是在 catalog 侧硬编一份 BOM 规则——
  owner 主权没有被绕过；
  ② 库存计数用 `aggregate/paged` 两个 CTE 分离，而不是在应用层再查一次全表——
  一次查询同时给出全量口径与当页数据；
  ③ L2 spec 从 468 行生成式复制重构为 142 行数据驱动，**代码变少而断言质量变高**。
- **代价配不配**：配。我上轮担心的"平铺 89 个控件会得到 89 个半成品"没有发生——
  本轮是按缺口纵向补齐，`CatalogItemDrawer` 822 行虽大但对应商品详情多页签的真实复杂度，
  未见为凑门而生的抽象。

## 4. UI 与交互强制自问

- **该操作是否来自用户明确要求/批准 Journey**：是，89 控件可回溯 IA 与 v4 实地。
- **用户在此时这样操作是否合逻辑**：是。上轮"可点击但永不响应"的 `CONFIGURE` 已修；
  盘点填 0 需显式确认，符合"零值是高风险输入"的现场语义。
- **是否有更短路径**：quickManage 正是那条更短路径，本轮已实现（创建后回填当前字段，不跳出）。
- **不合理之处归因**：本轮未发现需要归因的不合理项；上轮三条源自 P1 契约缺字段的，
  已由契约扩展从根上解决，而非在前端打补丁。

## 5. 明确不背书的部分（转 P4）

已登记于 `doc/review/platform/2026-08-06-v2s-catalog-inventory-p4-scope-registry-claude.md` F 类：
P3 的 18 definitions / 43 cases 受管 L2 实跑、P3 business evidence、P3 cleanup evidence、
89 控件的 runtime 验证。连同 A 类（P2 的 100 条 API 用例等 8 项）、B 类（seed 三项）、
C 类（URL 不持久化无门）、D 类（含本文 S-02）、E 类（P2 遗留三个 N）一并在 P4 收口。

**本文的 GO 不覆盖上述任何一项。**

## 6. 授权边界

本文仅授权「P3 current-byte 静态 implementation 与 IA 控件对账」这一件事。
不授权进入 P4 实施、不授权 P1/P2 HTTP/API runtime、Testcontainers、数据库/migration、
seed/reset、DEV/UAT、managed L2、runtime deployment、媒体 cleanup。

S-01、N-01、N-02 在既有批准边界内，可交 Codex 自主处置；
S-02（红门归属与时机）与 N-03（契约扩展授权出处确认）需 Dexter 各一句裁定。
