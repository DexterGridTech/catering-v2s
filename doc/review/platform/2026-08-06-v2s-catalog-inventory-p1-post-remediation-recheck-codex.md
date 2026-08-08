---
title: 商品目录与门店轻库存 P1 implementation post-remediation 作者处置
reviewTarget: IMPLEMENTATION
reviewKind: AUTHOR_POST_REMEDIATION_INTAKE
status: READY_FOR_CLAUDE_RECHECK
reviewCycleId: CATALOG-INVENTORY-P1-IMPLEMENTATION-20260806
historicalReview: doc/review/platform/2026-08-06-v2s-catalog-inventory-p1-implementation-review-claude.md
historicalVerdict: NO-GO_M=2_S=2_N=1
authorizationBoundary: 仅静态 P1 current-byte implementation recheck；不授权 owner runtime、数据库/schema/migration、reset/seed、DEV/UAT/L2、部署或 Git
---

# 1. 目的与诚实边界

Claude 的历史实现评审原文与 `NO-GO — M=2 / S=2 / N=1` 不改写。本文件是作者对修复后当前字节的
处置记录，不是第三轮 Codex 独立对抗审查，也不把当前字节冒充为历史 reviewer 已审阅。当前状态只可写为
`READY_FOR_CLAUDE_RECHECK`；外部结论仍待 Claude 对 current bytes 独立核验。

# 2. Findings 逐条处置

| 历史 finding | 当前处置 | 当前证据与最小闭合面 |
|---|---|---|
| M-01：读模型/whole-save 业务载荷缺失 | `CONFIRMED_REMEDIATED_PENDING_CLAUDE` | `contracts/policy/catalog-inventory-design-byte-coverage.json` 绑定详设 §3.4 的 25 个 read model 与 `CatalogItemSaveRequest`，共 608 个字段路径；生成器从该矩阵生成 OpenAPI、Java/TypeScript wire，覆盖价格/定价粒度/缺价数、库存摘要、复制闭包/版本/映射/兼容/引用重写、库存六区与 whole-save sections。`scripts/check/catalog-inventory-p1` 做 nested path/type/required exact-set。 |
| M-02：四处 `voidAvailability` 未落实现字节 | `CONFIRMED_REMEDIATED_PENDING_CLAUDE` | coverage rows 与 generated OpenAPI 同时覆盖 `CatalogItemDetail` action availability、`CatalogNavigationView` category node、`CatalogDictionaryView` entry、`ProductionTagPage` row；结构为 `canVoid/blockingReferences/dependentFacts`，并由 closed-finding regression 逐站点检查。 |
| S-01：`occurredAt` 为 string，金额缺字段 | `CONFIRMED_REMEDIATED_PENDING_CLAUDE` | 类型矩阵将事件时间固定为 epoch-millis integer，数量为 decimal string，金额字段为 integer cents；生成物与 checker 均校验这些约定，`RED_TIME_TYPE_CONVENTION` 为 PASS。 |
| S-02：15 个门只有结构检查，没有设计字段分母 | `CONFIRMED_REMEDIATED_PENDING_CLAUDE` | 增加 source-bound design-byte coverage、608-path exact-set、generated hash/digest、closed finding regression 与真实红变异；evidence 拆分 `schemaShape`、`designFieldCoverage`、`typeConventions`、`generatedDesignCoverage`，不再以 `typedSchemas` 代替业务载荷证明。 |
| N-01：媒体 namespace cleanup/readback 只在声明层 | `ACCEPTED_WITH_BOUNDARY` | P1 仍未执行 reset/seed/runtime；媒体清理及不存在 readback 保留为 P2/P3 受管运行义务，business/cleanup 不被静态 PASS 冒充。 |

# 3. 当前静态分母与证据

- operations `42`；shape `7`；design models `25`；design field paths `608`；closed finding rows `4`；type conventions `5`。
- API scenarios `26/100`，L2 scenarios `18/43`，IA IDs `89`；这些分母未被本次修复缩减或重写。
- 代表 seed dataset `5` 与媒体绑定 key `8` 仍只是 P1 定义图；v4 `73` 商品与 `34` 媒体的完整 parity 仍属于 P2 seed，未在本轮假称已执行。
- generated edge wire 携带 design coverage hash 与 field digest，供后续阶段对账；不代表 owner/runtime 已实现。

# 4. 已实跑命令

```text
node --check scripts/generate/catalog-inventory-p1.mjs                         PASS
node --check tools/catalog-inventory-p1/cli.mjs                                PASS
node scripts/generate/catalog-inventory-p1.mjs                                 PASS
node tools/catalog-inventory-p1/cli.mjs --self-test                            PASS
node tools/catalog-inventory-p1/cli.mjs                                       PASS
node tools/catalog-inventory-p1/cli.mjs --write-evidence                       PASS
scripts/check/catalog-inventory-p1 --self-test                                 PASS
scripts/check/catalog-inventory-p1                                             PASS
scripts/check/standards-coverage --phase RM1-P6-3                             PASS
scripts/check/project-memory                                                   PASS
scripts/check/code-layout                                                       PASS
javac CatalogInventoryShapeManifest.java CatalogInventoryEdgeWire.java         PASS
tsc generated catalog wires                                                     PASS
```

`self-test` 的红变异包含：删除设计必需字段、删除四处 `voidAvailability`、把 `occurredAt` 改回 string、
以及把 `CatalogItemSaveRequest.sections` 退回元字段空壳；这些变异必须真实失败后恢复为 PASS。

# 5. Claude current-byte recheck 重点

请不要只复跑结构门。请从详设 §3.4、`catalog-inventory-design-byte-coverage.json` 和当前 OpenAPI
独立导出 expected nested field/type/required 集合，并重点挑战：

1. 25 个 read model 与 whole-save 的字段是否真的来自详设，而不是 generator 自己发明的最小字段；
2. 四个 `voidAvailability` 站点是否逐层携带同一语义且没有漏掉数组 item；
3. epoch-millis、integer cents、decimal string 的类型与 nullable/required 是否与仓内约定一致；
4. coverage matrix、OpenAPI、generated Java/TypeScript wire 的 hash/digest 和 exact-set 是否一致；
5. 设计字段门是否存在可绕过的合法空壳、free-map 误放宽或重复 path 覆盖；
6. 历史 N-01 是否仍被诚实地留给 P2 cleanup，而不是被静态证据掩盖。

Claude 的输出请仍按 `GO/NO-GO — M=<数量> / S=<数量> / N=<数量>`，每条 finding 标注仓内事实、推论或产品判断，
并区分 current-byte recheck 与 runtime/DB/seed/L2 未授权边界。
