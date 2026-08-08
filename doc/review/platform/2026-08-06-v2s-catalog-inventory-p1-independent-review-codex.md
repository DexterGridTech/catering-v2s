---
title: 商品目录与门店轻库存 P1 implementation 独立对抗审查 Round 2
REVIEW_CYCLE_ID: CATALOG-INVENTORY-P1-IMPLEMENTATION-20260806
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
verdict: NO-GO
findings: M=4 / S=2 / N=1
authorizationBoundary: 仅静态 P1 implementation 定向复核；不授权 owner runtime、数据库/schema/migration、seed/reset、DEV/UAT/L2、部署或 Git
createdAt: 2026-08-06
---

# P1 implementation 独立对抗审查 Round 2

## 0. 盲审与输入

本轮为同一 review cycle 的第二轮、最终一轮。fresh independent subagent 直接读取修复后的真实 artifact，
独立执行集合/结构实验，不依据作者“已修复”陈述接受 finding，也未读取作者 disposition。没有执行 HTTP、
数据库、seed、浏览器或任何 runtime。

主要当前输入 SHA-256：

| 输入 | SHA-256 |
|---|---|
| `contracts/openapi/catalog-inventory.openapi.yaml` | `7f6a43d800320045bb432c97290b06c7720e207d1b119a95fd764ccfff151a90` |
| `contracts/catalog/catalog-item-editor-manifest.json` | `2a3241a871f674042063d951169f0174331a135f45ac5c458b445c02a7594f1f` |
| `contracts/catalog/CatalogInventoryShapeManifest.java` | `e3d8b143db5c6f9508f77f0ea23ed4f8c17f1c321b0868b50ad72e15b3722696` |
| `contracts/catalog/catalogInventoryShapeManifest.ts` | `0255f87e35dfc95b6c0a5690158028ac0439866420dbefcf02056696bf5faef0` |
| `contracts/catalog/CatalogInventoryEdgeWire.java` | `c6a209f1f354ef6f0e49dbbcbbd7be6e1cc43ae8676eafa95274d765e2241bdf` |
| `contracts/catalog/catalogInventoryEdgeWire.ts` | `a82ed40b6aa677b50aeb8b9874f3f3dadd9be07b41ef0a5a922e2c54bb6418f8` |
| `contracts/policy/catalog-inventory-fixture-catalog.schema.json` | `be71f2ae3adba33edb3e50079c0a3c0a09cbe97b0894aeb6bf9f02b5322668d9` |
| `contracts/policy/catalog-inventory-fixture-catalog.json` | `d55321bfe9a0e32ab2e88a1263f37a05b1414094a64a1344a61017218b2b7e26` |
| `contracts/policy/catalog-inventory-api-scenarios.json` | `ec0cfbe204c436040702f05ca1101ccb5ac313c31a26f7787a688e38f7a11eea` |
| `contracts/policy/catalog-inventory-l2-scenarios.json` | `cb49844bfb177026619c657dbe893df486820ffe6cb5bc45561014dcc0e20692` |
| `contracts/policy/catalog-inventory-copy-policy.json` | `5f5e66ab29d2ab5b082c9cfdb210aeacd7003e0dc51ccb8366246167b42a752f` |
| `scripts/generate/catalog-inventory-p1.mjs` | `0092dfbe38d567cc3208bda606fd239c5e25c64b3f945c2b8ad30aafc601186c` |
| `tools/catalog-inventory-p1/cli.mjs` | `93c314229276928a620bf073b06472d8416ebc0863ba0d40be0f2347247a8474` |
| `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p1-implementation-evidence-codex.json` | `e6364ad7160f8ed8936f67a5e2e2ac23668e533190c64341af9efbc56f13d77b` |

本轮实跑 generator `--check`、P1 checker、self-test 均 PASS。以下结论来自对 PASS 之后字节的独立
语义核验。

## 1. 结论

**NO-GO — M=4 / S=2 / N=1。ROUND_FINAL_DECISION=SELF_DECIDED。**

Round 1 的 route collision 已真实关闭；request 中客户端 scope/payload/body idempotency 已清除，26 个写
operation 都有 `Idempotency-Key` header；五个 seed 的显著缺项也补了。其余几项只关闭了机械外形，仍未
达到“P2/P3 不再发明契约与测试数据”的 P1 完成条件：OpenAPI 用 60 个空 closed object 代替真实类型，
fixture schema 与自身 catalog 不相容且十余个场景仍是空图占位，Java “wire”只是 JSON 字符串，八类 shape
surface 中的 tab/field 语义仍与 IA 不符。

## 2. Round 1 disposition

| Round 1 finding | disposition | 独立证据 |
|---|---|---|
| M-01 typed OpenAPI / scope | `PARTIALLY_CONFIRMED_CLOSED` | 42 request/query 已无 `scopeRef/payload/idempotencyKey`，26 写均有 header；但 60 个 nested object 是空 closed schema，业务形状仍未定义 |
| M-02 29/42 route | `CONFIRMED_CLOSED` | root 42/42、unique 42；七个 shard 合计按 placement 可达 42，路径不再覆盖 |
| M-03 fixture/scenario | `PARTIALLY_CONFIRMED_CLOSED` | case↔fixture ID 集合现可对上，五 seed 补图；但 schema 自身无效、scenario-specific fixture 仍空图/空 expected，case 仍懒映射 |
| M-04 八 surface/generated | `PARTIALLY_CONFIRMED_CLOSED` | 八 key 均出现；但 tab/field 内容不符合 IA，Java 只嵌 JSON 字符串而非 typed semantic wire |
| S-01 copy policy SoT | `PARTIALLY_CONFIRMED_CLOSED` | generator 已只读 policy；checker 仍硬编码 `20/500`，调整 policy 不会自动跟随 |
| S-02 checker/evidence | `PARTIALLY_CONFIRMED_CLOSED` | 新增 reachability/schema/fixture/surface red；但检查只认 `type` 存在和 ID membership，未发现本轮空类型、schema/catalog 矛盾和空 fixture |
| N-01 通用 logic steps | `NOT_REOPENED_INFORMATIONAL` | assertion matrix 仍有通用三步；P2 必须以 operation design contract 为语义源，不以“字段非空”代替链路复核 |

## 3. Findings

### M-01｜OpenAPI 42/42 已可达，但 60 个“typed”节点是不可承载事实的空 closed object

**依据类型**：当前 artifact 可复算。

所有 property 现在都有 `type/$ref`，但继续递归检查发现 **60 个 object schema 没有任何 properties 且
`additionalProperties:false`**。代表项包括：

- `CatalogWorkbenchContext.data`；
- `CatalogNavigationView.tree[]/smartViews[]/shapeCounts[]`；
- `CatalogItemPage.items[]`；
- `CatalogItemDetail.item/tabs[]/references[]/inventoryBom[]/productionTags[]/governance[]`；
- `BrandCatalogCopyPreflight.closure[]/targetVersions[]/mappings[]/compatibilityResults[]/summary`；
- `InventoryTargetCurrentView` 的 target/balance/configuration/state/summary/references/ledger/diagnostics；
- history/reference/ledger entries、diagnostics queries/timings/warnings。

这些不是“过泛”，而是只能合法返回 `{}` 的空封闭对象。P2 无法返回 IA 要求的名称/编码、query identity、
六区数据、完整闭包、双侧 version、映射预览、九类兼容、引用重写与 typed recovery。唯一批准的自由 map
`CatalogItemCreateRequest.attributes` 是当前唯一 open object，方向正确，但不能为其余 60 个空壳辩护。

**影响**：前后端 codegen 即使成功也只会得到 `{}`，P2/P3 必须越过契约另造字段。

**最小修复**：逐个展开 25 个 read model 和 42 request/response 的真实 nested component；数组 item 必须
typed `$ref`，闭包/version/mapping/rewrite/problem details 不得是空 object；checker 增加“非批准 free-map
的 object 必须有 properties 或 typed additionalProperties schema”红变异。

### M-02｜fixture schema 按规范会拒绝当前 catalog，scenario-specific fixture 仍是空图

**依据类型**：JSON Schema 结构审查 + 当前数据实算。

fixture schema 的 `sourceBindings/scenarioCatalog/denominators/consumerBindings` 都声明
`type:object, additionalProperties:false`，却没有定义任何 properties；当前 fixture catalog 在这些对象中
实际写了内容。因此按 draft 2020-12 真校验，schema 会拒绝自己的 canonical catalog。dataset 的
`ownerScopes/generatorRecipe/expected/entities` 又全部 `additionalProperties:true`，恰好真正需要 typed 的
业务图没有约束。

此外新增的 `FIXTURE-SCENARIO-CI-API-003/004/005/008/022` 和多项 L2 fixture 均为：

```text
objects=[]; edges=[]; expected={}
purpose="该场景的最小 typed owner graph"
```

这不是可执行数据。例如 API-003 必须构造树节点+keyword+cursor/generation，API-004 必须构造六智能视图，
API-008 必须构造生命周期/CAS/idempotency，API-022 必须构造 replay 与中途 owner failure；空图无法产生
任一事实。checker 只核对 fixture ID 与 scenarioId membership，所以仍 PASS。

**影响**：P2 loader 无法使用所谓 canonical fixture，后续实现者仍会自行造数。

**最小修复**：先让 schema 真正定义并验证 root binding/denominator/consumer 和 typed ownerScope/object/
edge/recipe/expected；所有 scenario fixture 必须含能产生该 case 的最小对象图与可观察 expected，禁止空
objects+edges+expected。self-test 加 schema validation red 和 empty-business-fixture red。

### M-03｜143 个 case 虽然 ID exact-set 通过，仍存在按场景复制一句结果的懒映射

**依据类型**：scenario catalog 实算。

case 数已是 100/43，fixture ID 也都存在，但每个 scenario 内所有 case 的
`expectedBusinessResult` 仍完全相同。典型错误：

- API-002 七 case 全绑定 `SEED-WEIGHED`，无法分别证明七形态；
- API-006 十 case 只有两个 void fixture，八类对象成功 case 没有逐对象前置图；
- API-018 十八 case 全绑定一个 SKU conflict fixture，无法表达九类 confirmable reuse、六类 structural
  block 和三类 N/A；
- API-026 case 顶层列六个 fixture，但五 case 只是轮流 seed，未给每图独立 expected count/readback；
- L2 的角色×节点、七形态、四动作、五步预检同样大量复用单句 expected。

这正是“有数量、无判别力”的懒映射。membership exact-set 只能证明没漏 ID，不能证明每个 case 可执行。

**影响**：100/43 仍不能作为后两阶段验收分母，任何单一成功实现都可能让整组假绿。

**最小修复**：每个 parameterized case 固定独立 parameter object 与 expected fact；七形态逐 shape、八类
void 逐 object type、18 compatibility 逐 matrix row/outcome、六区逐 operation、四库存动作逐 command。
checker 可机械要求同 scenario case 的 parameter key 唯一、expected assertion key 唯一，并对专属 fixture
object type exact-set 做红变异。

### M-04｜八类 manifest surface 已出现，但语义内容与 IA 不符，Java 也不是 typed full wire

**依据类型**：manifest/IA 对照 + generated 字节。

八个 surface key 现均存在，计数为 7/7/7/4/4/3/2/4。但 `tabRules` 把六个可创建 shape 基本全部设成
同一七页签：

- `SKU_VARIANT_SALE_COUNTED` 没有 IA 明定的“SKU 规格与价格”专属页签；
- `COMPOSITE` 没有“套餐内容”专属页签；
- `SERVICE` 仍出现 production-prompts 与 inventory-bom，和 shape admission “节点不能存在”冲突；
- `shapeKey` field 在 update rules 中仍 `readonly:false`，违反形态创建后固定；
- code 在 create 也统一 `readonly:true`，与“创建必填可输入、创建后不可修改”混成一态。

TS 生成物是完整对象 `as const`，但 Java 只提供 `MANIFEST_JSON`/`OPERATIONS_JSON` 两个巨型字符串和几个
常量；没有 shape/tab/field/mode/operation 的 typed records/enums/accessors。编译 PASS 仅证明字符串合法，
不是 Java semantic wire 完整。

**影响**：后端不能编译期消费形态约束，前端按 manifest 会显示错误页签/可编辑状态。

**最小修复**：按 IA 逐 shape 重建 tab/field state（至少区分 create/update/view）；SERVICE/BENEFIT 的
node/tab admission 与 modeRules 一致；Java 生成与 TS 等价的 typed records/enum/封闭集合，不得依赖运行期
解析 JSON 字符串。checker 对 SKU 专属页、套餐页、SERVICE 禁止页、shape immutable 和 Java typed symbols
做真实 red。

### S-01｜copy policy 的 generator 隐藏副本已关闭，但 checker 仍是第二数值声明点

generator 已改为读取 policy，不再写 policy，Round 1 根因主体关闭。但
`tools/catalog-inventory-p1/cli.mjs` 仍直接断言
`selectedItemCount === 20 && closureItemCount === 500`。这意味着未来按 policy 的 adjustmentRule 调值时，
必须同步改 checker；“只改 policy，消费者自动跟随”仍不成立。

**最小修复**：checker 只验证 policy shape、批准 revision/hash 和所有 consumer 引用同一 pointer；若 20/500
是当前不可变产品裁决，应在 decision catalog 绑定 policy hash，而不是在 checker 再写一份数值。

### S-02｜新增 static gates 仍把空壳类型、无效 schema 与空 fixture 判为 PASS

reachability red 已有效，route finding 真关闭。其余新增门只查：property 有 `type`、surface key 存在、
fixture ID membership 成立，因此本轮 60 空 object、schema/catalog 不相容、空图 fixture、同句 case 和 Java
JSON string 全部通过。evidence 仍把 `typedSchemas/fixtureScenarioExactSet/shapeSurfaces` 声称为 PASS，语义
大于实际证明范围。

**最小修复**：按 M-01..M-04 增加一行可说清的结构门和真实 mutation；evidence 分别记录 empty-object
count、schema validation result、nonempty fixture denominator、case discriminator count、Java typed symbol
count。修复前 package status 不应为 PASS。

### N-01｜五个 seed 图的显著业务内容已补齐，但 fixture schema 尚未约束这些成果

凯撒沙拉现在有三个 option group/三个 value/四条 BOM；材料有咖啡豆、外带盒、沙拉基底、培根、鸡蛋、
鸡胸肉、餐具；五图均加总部+品牌/门店+品牌与总部零余额流水事实。这些是真实改进，不应回退。

但 schema 的 `entities` 仍是任意 object，删除第三 option group、四条 BOM 或 ownerGraph 不会 schema fail。
建议把五图的结构和 expected counts 纳入 typed seed dataset/red mutation，而不是仅靠 generator 常量。

## 4. 已确认关闭、不应返工

- root operation **42/42、unique 42**，不再有 path overwrite；
- 七个 path shard 按批准分组可达完整 operation 集；
- 42 request/query 中 `scopeRef/payload/idempotencyKey` 均为零；
- 26 写 operation 全有 `Idempotency-Key` header；
- copy generator 改为只读 policy；limit fixture 使用 policy pointer；
- case→fixture ID 与 fixture→scenarioId 当前双向集合无 missing/mismatch；
- shape manifest 八个 surface key 均已实际出现；
- Round 1 指出的五个 seed 内容缺口已补齐；
- assertion matrix 的 42 operation、problem/condition exact-set 与 DB count 字段未回退。

## 5. 最终轮处置

本 cycle 已达到 `REVIEW_ROUND_LIMIT=2`，不得召集第三轮。作者应按
`ROUND_FINAL_DECISION=SELF_DECIDED` 对上述当前字节 findings 做 disposition；四个 M 未关闭前 P1 不应进入
P2/P3。若修复后需要外部确认，交 Dexter/Claude 做 package acceptance，不得用第三个 Codex reviewer
重置轮次。

## 6. 授权边界

本 `NO-GO` 仅是 P1 静态 implementation finding，不授权 owner runtime、数据库/schema/migration、
seed/reset、DEV/UAT/L2、部署或 Git。
