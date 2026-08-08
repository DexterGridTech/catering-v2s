# 商品目录与门店轻库存三阶段设计 Round 1 finding intake

```text
REVIEW_CYCLE_ID=CATALOG-INVENTORY-THREE-STAGE-DESIGN-20260806
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=NOT_APPLICABLE_ROUND1_REPAIR
```

本文件只处置独立 reviewer 的待验证输入，不把 finding 自动当事实。逐条重开需求、IA、Dexter
裁决、主设计和 manifest 后，五条均确认；修复保持当前三阶段与九类兼容分母，不扩张业务范围。

| finding | disposition | 复核依据与最小处置 |
|---|---|---|
| `CI-3STAGE-DESIGN-M-001` | `CONFIRMED_FIXED` | 42 个 operation 只有全局 owner 口径，不能逐行机械重算。P1 新增单一规范源 `catalog-inventory-assertion-matrix.json`，每行冻结 face、initiating owner、coordinated owners、authorization、request/response、封闭错误、scenario 与 IA-ID；设计表只是生成视图。没有拆成多 owner catalogs，避免复制字符串。 |
| `CI-3STAGE-DESIGN-M-002` | `CONFIRMED_FIXED_WITH_EXISTING_CLASS_SUBCHECK` | C-19 的 SKU 判同 tuple 不足以证明相同 SKU 语义。没有增设第十类兼容对象；在既有“商品”结构位中加入 canonical SKU 结构指纹 `sorted(skuCode -> sorted(attributeCode,valueCode))`，同编码不同组合使用现有商品 structural-negative 阻断。判同身份不变，兼容判断补足。 |
| `CI-3STAGE-DESIGN-M-003` | `CONFIRMED_FIXED` | “零引用时作废重建”原先缺 terminal 状态和 owner judgment。现冻结 `VOIDED`、八类适用对象、StockTarget N/A、入站引用/依赖事实两类阻断、永久保留旧编码、transition/save typed command、API/L2 责任与证据。未增第 43 个 operation。 |
| `CI-3STAGE-DESIGN-S-001` | `CONFIRMED_FIXED` | manifest 的 `26/89` 是陈旧字符串。单一 `scenarioDenominator` 现为 26 definitions / 100 API cases（新增九条 C-17 实例）与 18/43 L2，并同步设计、manifest、review input。 |
| `CI-3STAGE-DESIGN-S-002` | `CONFIRMED_FIXED` | CRUD policy 只能由 P1 写一次；P3 改为只读核验 P1 entry 与真实页面一致，再写 admin catalog 页面注册，不再双写 policy。 |

## 分母变化说明

Round 1 的 91 API cases 已经覆盖 26 个 definition，但 C-17 的八类对象只写成一条抽象 case，不能证明
各 owner/aggregate 的可执行语义。`CI-API-006` 从 1 个 case 变为 10 个：八类 zero-reference 成功、
一条入站引用阻断、一条依赖事实阻断，因此最终 API 分母是 `26 / 100`。definition 数、42 operation、
18/43 L2、89 IA-ID、九类兼容矩阵与 17 differences 均不变。

## Round 2 定向核验要求

第二轮只核验上述五条是否真实闭合，并检查修订是否引入新 M/S：

1. 42-row assertion matrix 是否足以机械生成 operation/IU/stage/scenario 视图且没有两份真相；
2. SKU 结构指纹能否阻止同 `(itemCode,skuCode)` 不同属性组合的静默复用，同时不改变身份 tuple；
3. `VOIDED` 是否对八类对象可执行、错误封闭、旧编码不释放，且 StockTarget N/A；
4. `26/100 + 18/43` 在 design、manifest 与 review input 是否完全一致；
5. CRUD policy 是否确实只有 P1 单一 mutable owner。

第二轮是本 cycle 硬上限。作者在独立 verdict 后按证据 `SELF_DECIDED`，不得召集第三轮。

## Round 2 最终作者裁决

```text
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
INDEPENDENT_VERDICT=NO_GO_M2_S1_N0
THIRD_ROUND=FORBIDDEN
```

| Round 2 finding | disposition | 最终处置 |
|---|---|---|
| `CI-3STAGE-DESIGN-R2-M-001` | `CONFIRMED_FIXED_SELF_DECIDED` | Reviewer 的反例成立：摘要别名不能作为逐 operation 契约真相。保留一份 assertion matrix，但 canonical 行现在直接存 `pageKeys[]/capabilityKeys[]/problemCodes[]`；设计给出覆盖 1..42 一次且仅一次的授权 membership 与 exact typed problem expansion，并明确 checker 禁止 JSON 存 profileId 或宽泛 superset。 |
| `CI-3STAGE-DESIGN-R2-M-002` | `CONFIRMED_FIXED_SELF_DECIDED` | Reviewer 的前置决策点反例成立。既有四类 GET read model 全部加入 owner 产生的 typed `voidAvailability`；批量判断、无 N+1、无第 43 个 endpoint，transition 在事务中重算。 |
| `CI-3STAGE-DESIGN-R2-S-001` | `CONFIRMED_FIXED_SELF_DECIDED` | §2.1 旧矩阵单元已改为 P1 单写 policy；P3 只读核验 entry、写 admin catalog 页面注册。与 §5.1 和 manifest 一致。 |

三条修订均是已有批准语义的确定化，没有新增业务能力、operation、owner 或阶段。Round 2 后不再召集
独立 reviewer；最终状态由作者依据当前字节、机器检查与本 disposition 自行收口，Claude 后续 review
是外部复核，不冒充或重置本 cycle 的第三轮。
