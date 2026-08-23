# 商品条码与标识、制作信息优化 · DESIGN review(Claude 独立复核)

- 日期:2026-08-23 · 作者:Claude · 被审:正式需求 / Journey / 交互稿 / 线框 / IA / 详设 / 串行计划(七件)
- 会话出处:**续接会话**。按亲验纪律声明:本轮不冒充 fresh acceptance;
  全部数字由本轮**重开 owning source 独立复算**,**未继承作者 SELF_DECIDED,也未采信内部两轮 reviewer 的数字**。
- ⚠️ 话术给的仓根 `/Users/dexter/Documents/workspace/idea/catering-v2s` 与实际不符,
  本轮按实际仓根执行(同一问题上一批已提过,见 N-02)。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取(缺项/矛盾/无出处数值)
VERDICT=GO
M/S/N=0 / 0 / 2
```

---

## 0 · 方案合理性

**问题对不对** —— 对,且四条病灶我在上一轮需求评审里已于契约上亲验属实
(自由 `kind/code/value` 三元组、SKU 单值 `skuBarcode`、`productionProfiles` 的
`sku`/`optionValue` 分支**无 skuRef/optionValueRef 身份**、多类事实混入同一容器)。本轮不重复。

**方案优不优** —— 优。三处判断值得单独肯定:

1. **§11 的 operation identity 硬约束**:「每个 subcase 的 request 必须与其宿主
   `@AcceptanceScenario.operation` 完全一致;调用 `saveOperationsCatalogItem` 的子场景
   只允许落在 operation 同为 `saveOperationsCatalogItem` 的 annotation 下」——
   这条不只修了 Round 2 的 S,它把**同类错误在未来不可能再犯**变成了成文规则。
2. **迁移的三段式**:只读 preflight(不改数据,输出分类/数量/建议 disposition/`READY|DEXTER_DECISION_REQUIRED`)
   → 确定性等值折叠先行(nested `materialRole` 与顶层相同则保留顶层)→ 真 unknown 非零**不启动 Flyway**,
   交 Dexter 在显式数据操作边界内选 repair 或 reset。
   **⭐ 并且 Flyway 事务内再次执行同一 predicate 防止 preflight 与迁移之间漂移** ——
   这一条是我会主动要求而作者已自带的,写得比要求的更严。
3. **D-CIPG-03 的克制**:本批不新增 resolve HTTP operation、不建零调用者 owner method,
   只闭合存储/唯一索引/whole-save/readback 与未来查询边界。避免了"为未来可能的扫码提前建接口"。

**代价配不配** —— 配。§12 把五项非目标逐条钉死(多品牌扫码歧义、扫父码选 SKU、
EAN/UPC checksum、选项移除标签/负时长、browser L2/UAT),无过度设计。

---

## 1 · 独立复算(不继承任何自报数字)

| 声称 | 我的独立复算 | 判定 |
|---|---|---|
| §9b 恰 16 个锚点、逐个唯一命中 | 解析 §9b 表格得 **16** 行;逐行 `grep -cF` 实测 **16/16 唯一命中**;`basename`/「同上」残留 **0** | ✅ |
| acceptance annotation 分母 80 | `grep -rc "@AcceptanceScenario"` 全 acceptance 目录求和 = **80** | ✅ |
| 两个 save subcase 已迁至 `catalog.inventory-rule-admission-matrix` | §11 表格实读:`item-identifiers-and-default-preparation` 与 `whole-save-atomicity-with-identification-preparation` 均挂该场景;该场景的 `@AcceptanceScenario.operation` 实测为 **`saveOperationsCatalogItem`** | ✅ |
| 不再借 create 场景承载 save oracle | `item-create-draft-category` 在详设中仅剩 **1 处**,位于 §12 findings 处置表的**历史记录行**,非 §11 宿主挂靠 | ✅ |
| 42 格准入 | 7 shape × 2 grain × 3 type = **42**(另 7×3=21 为制作 target,不同维,未混算) | ✅ |
| catalog metadata operation 57 | `catalog-inventory-edge-route-registry.json` 实测 **57** | ✅ |
| 全平台 exact-set 238 | 三份 registry 去重实测 **238** | ✅ |
| USER_VISIBLE_COPY 技术词零命中 | 7 处声明合计 1280 字,对 13 个技术词全集扫描 **零命中**;`BOM` 出现 1 次,按语料为正式业务词**不计**(话术要求已遵守) | ✅ |
| D-CIPG-01/02/03 跨工件落地 | 前导零/大小写敏感/不区分大小写/控制字符、120/1000/非负整数/86400、57/238/resolve —— 逐词在需求·详设·IA 三处计数,**均有落点** | ✅ |
| IA 计数自证 | 自证「IA-ID 共 7 个」;实测 `IA-CIPG-01..07` = **7** | ✅ |

⚠️ **过程中我自己产生过三次测量假象,均已自查纠正,不构成 finding**:
①§9b 首次解析按四列切分得 0 行(实为三列)——按评审规范"零产出即停机"处理,重解析得 16;
②`### IA-` 匹配得 0(实为 `### 2.1 IA-CIPG-01 ·` 格式);
③`skuBarcode` 残留扫描初得 7 处,逐条开看**全部**是现状陈述/迁移来源/禁止保留语境,零处当目标形态。

---

## 2 · 六项重点核验

1. **用户界面语言** —— PASS。USER_VISIBLE_COPY 技术词零命中(见 §1);`BOM` 未误报。
   IA 七个 ID 的可见维度用业务语言表述,不可见维度带证据档位。
2. **contract / UI / owner 分层** —— PASS。IA §5 计数自证「三层责任共 8 个约束族」;
   §11 明写「manifest 只作为声明输入,**不承担 save oracle**」;
   红夹具要求「每个必须断言具体 problem、field/target locator 与 catalog version 不变」——
   即 UI 隐藏不作防线,owner 侧有可证伪判据。
3. **Identifier 模型** —— PASS。三类型闭集;42 格矩阵闭合且**不适用格也断言拒绝**;
   唯一域固定 `dataNodeRef + brandRef + identifierType + normalizedValue`;
   SERVICE 的 `BARCODE`/`PLU` 在红夹具 exact-set 中列明(contract/owner 层拒绝,非 UI 隐藏);
   §12 明写父码请求**明确拒绝**、⛔ 不得静默选默认 SKU;无 `skuBarcode`/`kind/code/value`/resolve fallback 残留。
4. **制作信息** —— PASS。商品默认 / SKU `INHERIT_ITEM` 与完整 `OVERRIDE` / option add-only 闭合;
   §11 红夹具含 `remove tags`、`负/小数 seconds`、`完整 option profile` 三类反例;
   instruction 排序**已按上一轮 S-01 的裁定**改为 displayOrder 业务序;
   parent 为 `catalog_item_order_option_value_override`(未复活退役表);
   production tag 的 `MANAGEMENT`/`BINDABLE_CANDIDATE` 双模式与 cursor identity 含 usage/query 已在 §11 断言。
5. **数据迁移** —— PASS,且优于要求(见 §0 第 2 点)。
6. **Acceptance** —— PASS(见 §1 逐项)。

---

## 3 · Findings

### N-01 · `86400` 的表述可能被读成上限,而裁定是"不设上限"

- **事实**:D-CIPG-02 裁定「制作时长只能为空或非负整数,**不设 86400 等业务上限**」;
  §11 红夹具写「另有**大于 86400** 的非负整数正例,证明没有 UI 隐式上限」。
- **判定:语义正确**(86400 出现在这里是**正例的取值来源**,不是阈值),
  但一个数字同时出现在"不设上限"和"大于它的正例"两处,实施者快速扫读时可能误建一个 86400 的门。
- **最小修复**:红夹具那句改为「一个显著大于一日秒数的非负整数正例(如 `100000`),
  证明不存在隐式上限」——**去掉 86400 这个数字本身**,只留"显著大"的语义。
- **需 Dexter 裁决?** 否。

### N-02 · 交接话术中的仓根绝对路径与实际不符(第二次)

话术给 `/Users/dexter/Documents/workspace/idea/catering-v2s`,实际为另一路径。
本轮按实际执行,不影响任何结论。**上一批已提过同一问题**,建议交接一律用仓库根相对路径。

---

## 4 · 内部两轮修复的独立判定

**不继承 SELF_DECIDED**,两条逐项重验:

- **Round 2 的 S(save subcase 错挂 create 场景)** —— **真实成立**。
  两个同根 subcase 已迁至 operation 为 `saveOperationsCatalogItem` 的场景;
  `item-create-draft-category` 仅剩历史记录行;annotation 总数仍为 80(实测);
  且**新增了 operation identity 硬约束**,把点状修复升级为规则。
- **Round 2 的 N(§9b 用 basename/「同上」)** —— **真实成立**。
  16 行全部为完整仓根相对路径,逐行实测唯一命中,零 basename 残留。

⇒ 两条修复经我独立复算**均成立**,不是文字性关闭。

---

## 5 · 收口

```text
REVIEW_TARGET=DESIGN
VERDICT=GO
M/S/N=0 / 0 / 2
L1_ENGINEERING=PASS —— §9b 16/16 唯一命中;annotation 80;operation 57/238 独立复算一致;42 格矩阵闭合;迁移三段式含 Flyway 事务内 predicate 重跑
L2_USER_VISIBLE=PASS —— USER_VISIBLE_COPY 13 词全集零命中(BOM 未误报);IA 7 个 ID 计数自证一致;不可见维度带证据档位
L3_UNVERIFIED=逐项如下(本轮为静态设计复核,以下全部未验证且设计中亦未声称已验证):
  1. 编译与 typecheck;2. 生成链 exact-set 实跑;3. migration 与 preflight 的真实执行;
  4. HTTP 与 80/80 acceptance 实跑;5. seed 物化与 readback;6. DEV 生命周期;
  7. browser L2 与 UAT(§12 明写不得用 render test 冒充键盘/焦点/真实滚动);8. cleanup
SAME_ROOT_SCAN=§9b 锚点 16/16 逐个数命中 · save subcase 同根 2/2 已迁 · 三份 registry 3/3 去重复算 · skuBarcode 残留 7/7 逐条开看定性 · IA-ID 7/7
DESIGN_GAPS=无需新增正本;N-01 为一句文本修订
EVIDENCE_TIER=静态读源码与设计文档 + 独立复算(registry 去重、annotation 计数、锚点唯一性、矩阵格数、技术词扫描)。⛔ 未运行任何门、未跑编译/生成链/migration/acceptance/seed/DEV/L2/UAT、未写入除本文件外任何路径
```

**授权边界**:本 GO 仅表示该设计可作为后续 implementation 授权的输入。
不授权实施、contract/code/generated 修改、测试执行、DEV、reset、seed、browser L2、UAT、部署、
数据操作或任何新增产品语义。N-01 建议在 CP-00 开工前以一句文本修订折入。
