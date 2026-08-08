---
title: 商品目录与门店轻库存 P1 implementation 独立审查处置
REVIEW_CYCLE_ID: CATALOG-INVENTORY-P1-IMPLEMENTATION-20260806
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
reviewerKind: AUTHOR_DIALECTICAL_INTAKE
independentReport: doc/review/platform/2026-08-06-v2s-catalog-inventory-p1-independent-review-codex.md
authorizationBoundary: 仅静态 P1 implementation artifact；不授权 owner runtime、数据库/schema/migration、seed/reset、DEV/UAT/L2、部署或 Git
---

> **后续纠偏（2026-08-06）**：本文件中对 Round 2 findings 的 `CONFIRMED_CLOSED` 只覆盖当时的结构性
> 修复，不能作为当前契约语义完整性的 GO。Claude 后续 fresh implementation review 已确认 M-01/M-02 与
> S-01 仍未落到当前字节；本文件的历史处置不覆盖详设 §3.4 的 design-to-byte 字段分母。当前权威状态以
> `doc/review/platform/2026-08-06-v2s-catalog-inventory-p1-implementation-review-claude.md` 与
> `doc/review/platform/2026-08-06-v2s-catalog-inventory-p1-contract-design-byte-prevention-codex.md` 为准。

# P1 独立审查处置

独立 reviewer 的 Round 2 是本 cycle 的最终 Codex 对抗轮次，原报告结论为 `NO-GO — M=4 / S=2 / N=1`。
本文件不是第三轮复核，不改写独立报告；只对每条 finding 重新打开 owning source、修改后的 artifact 和
focused proof，记录最小修复与剩余边界。外部 package acceptance 交 Dexter/Claude。

| Finding | 处置 | 证据与最小修复 |
|---|---|---|
| M-01 空 closed object | `CONFIRMED_CLOSED` | `scripts/generate/catalog-inventory-p1.mjs` 为 read-model nested object 生成具体 properties；`tools/catalog-inventory-p1/cli.mjs` 递归拒绝非空业务闭集空壳；`scripts/check/catalog-inventory-p1 --self-test` 与普通 check PASS。批准的自由 map 仅为商品描述属性。 |
| M-02 fixture schema/catalog 不相容与空业务图 | `CONFIRMED_CLOSED` | fixture schema root/defs 已显式定义，checker 对 canonical catalog 运行 schema instance validation；`testGraphFor` 对无业务边的场景注入 typed `ScenarioState`，图节点/边要求带 type/code 或 from/to；P1 checker PASS。 |
| M-03 case 懒映射 | `CONFIRMED_CLOSED` | 每个 case 具有独立 `parameter` 与 `expected.assertionKey`，expected 复述同一参数；checker 要求 scenario 内 assertion key 唯一且参数 exact binding；P1 checker PASS。语义充分性仍交 Claude 抽样审查。 |
| M-04 shape semantics / generated Java | `CONFIRMED_CLOSED` | 七形态 tabRules、create/update/view readonly、SERVICE/BENEFIT shape admission 与 mode eligibility、SKU/套餐专属页签均在 manifest；Java 生成 typed `Capability/ShapeKey/ShapeRule/ModeRule` 与 typed operations；Java/TS compile PASS。 |
| S-01 copy limit 第二数值声明 | `CONFIRMED_CLOSED` | checker 不再内嵌 20/500，只校验 policy shape/source/response shape 和生产 artifact 无数字副本；policy 是唯一声明点，fixture 以当前 policy pointer 描述边界；`--self-test`/check PASS。 |
| S-02 门与 evidence 语义过宽 | `CONFIRMED_CLOSED` | empty closed schema、fixture schema validation、typed graph、case discriminator、shape semantics、Java typed symbol、媒体 hash 与 multipart route 均有可执行检查及 red mutation；evidence 分项记录 PASS，不宣称 runtime/DB/seed/L2。 |
| N-01 seed schema 对代表图约束不足 | `ACCEPTED_WITH_BOUNDARY` | P1 schema 约束通用 typed dataset/object/edge，代表图的精确业务语义仍由 seed graph、scenario assertion 和 P2 owner readback 负责；五个代表图的关键计数有 checker。P2 必须继续以 canonical fixture 运行，不能把 schema 宽松处当作 SQL/自由造数授权。 |

## 新增的媒体与完整 seed 口径收口

- v4 只读源核实为 73 个商品、34 个媒体资产；P1 已复制并 hash 对账 34/34 图片。
- P1 的 5 个 seed dataset、8 个绑定媒体 key 是契约定义所需的代表业务图，不是最终 DEV seed 分母；不能把早期 9 张误称为 v2s 最终 seed。
- `contracts/policy/catalog-inventory-media-assets.json` 的 coverage 固定 v4 `73/34` parity，`seedExecutionPlan.fullCatalogParity.requiredIn=P2` 且 `reductionIsNotFinalSeedPolicy=true`。P2 完整 seed 必须在适配 v2s 禁止结构后保留这套业务覆盖，不能以代表图替代。
- `stageOperationsCatalogAsset` 已是 `multipart/form-data`，请求字段 `content` 为真实二进制；`createOperationsCatalogItem` 必须使用返回的 assetRef；禁止 SQL fallback。
- reset/run cleanup 必须清空 run-scoped media namespace 并读回资产不存在，business 与 cleanup 分开判定；P1 未执行 reset/seed。

## 当前静态证据

```text
node scripts/generate/catalog-inventory-p1.mjs                         PASS
scripts/check/catalog-inventory-p1 --self-test                         PASS
scripts/check/catalog-inventory-p1                                     PASS
scripts/check/catalog-inventory-p1 --write-evidence                    PASS
javac CatalogInventoryShapeManifest.java CatalogInventoryEdgeWire.java PASS
tsc generated catalog wires                                             PASS
scripts/check/code-layout                                                PASS
scripts/check/standards-coverage --phase RM1-P6-3                       PASS
scripts/check/project-memory                                             PASS
```

以上只证明静态 P1 implementation artifact；不证明 HTTP、数据库、seed runtime、DEV/UAT 或浏览器 L2。
