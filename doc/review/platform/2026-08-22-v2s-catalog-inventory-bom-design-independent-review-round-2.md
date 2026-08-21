# 商品库存与 BOM 业务模型 · 独立 DESIGN 对抗审查 Round 2

```text
REVIEW_CYCLE_ID=CIB-BUSINESS-MODEL-DESIGN-2026-08-22
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
blindReviewDeclaration=先独立 verdict、后对照作者材料
authorMaterialReadAfterIndependentVerdict=true
```

> 本文件忠实记录 fresh 独立 reviewer 的最终 Round 2 只读 verdict。

## A · 输入清单

`reviewerInputChecklist={path,sha256,read}`：

| path | sha256 | read |
|---|---|---|
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md` | `8217f5da12ef77714b763348075607b1775691174c70cf78e3e6df43e86c1b48` | true |
| `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md` | `35912491840e713974c3f2b5827360cddf1a1227d0f681579f6ede4557c1caf1` | true |
| `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md` | `c2c872d1707f9776c8406fe514a61ce5c8b4f1a8a8e91b6884e310c4511637ae` | true |
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md` | `85ed86ac447f16ceb4004fe2240d9a260eaa894f2ec62806fb819af978767382` | true |
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md` | `71887417b3d2f69f0d4f29138f1d9664ba6b5391fd31e950a8e678d7d8331ab3` | true |
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md` | `68e6925545da9a0a46b3ac5fa0c1dce281048cd490de60f9f70e6ff469fce337` | true |
| `doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-independent-review-round-1.md` | `4cfecd6ddf9a2ba249847416d09e4d78eb4fdce11c7a863a9bd4b36cb0093e7e` | true-after-independent-verdict |
| `doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-review-intake-codex.md` | `4d369744a25ecac38ee6f42bab9adae91883b12990457c73fce2af53f3c8949b` | true-after-independent-verdict |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql` | `bb3e76ad21a99afb0e15b0b250211d2fb8a2b308a2f2a62005add0472ec4acaf` | true |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260808_160000_000__inventory_opaque_catalog_identity_refs.sql` | `4a9425faa1f02386751f263998c1c41f40fee04d745ce17c535d651a07c2384c` | true |
| `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java` | `7ae962e3d30cbbcf6210a03750f36d9bb1f2b83cee8baf9875c06d054a975d3b` | true |
| `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java` | `1fd8a8d62b93c3ad742bb26f8e61db50e020062cc4b9f33582af0f01a8b4b168` | true |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `e6dd0742c9f7ce37626b2476b0f2e864b232a8a96a7a2e6eca48c5c812fd2204` | true |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java` | `0cc2ffc060c647e545f2b7f13383e86942cd345d3a8899d85ddc4239fc5f588d` | true |
| `scripts/generate/catalog-inventory-p1.mjs` | `dbf6683a31aa2221f964a3f8ca9123218dffc722f46d4352affc0e89af9d0299` | true |
| `scripts/dev/catalog-inventory-seed-plan.mjs` | `50390e800595a07eed6e3ac68a57ac311c8640222b4c9d64ea75545a18d863e0` | true |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | `7d44d4f467c2b1b83d865e193a62c5ea86ffc6834f5043fcaf3319ab838b545a` | true |

Admission 另含：AGENTS/CLAUDE/PLATFORM/README、registry 的 `programId=V2S_W0_W4_EXECUTION` 与 exact authorization、全部 kernel、deterministic-context-only、六维 `task-kind=design` recall、confirmed business corpus、decisions 标题扫描及相关 decision、Journey/UI/IA/implementation templates、backend/frontend standards、foundation charter、backend acceptance standard，均已只读核验。

## B · Findings

无阻断 finding，`M/S/N=0/0/0`。

- A-05 已把历史依赖精确为此前成功方式切换保留的停用旧 StockTarget/ProductBom definition；首次切换可通过，第二次自动切换拒绝，且不开放 force/governance 新动作。
- 现有 owner 两表与 opaque identity unique index 可承载新增 `definition_status`/active partial index；无需第三 truth。
- `BALANCE/LEDGER/BOM_REFERENCE/HISTORICAL_DEFINITION` 的 PRESENT/ABSENT、差异、fixture、锁定/执行顺序已闭合；当前命令新 DISABLED 不计为本次 blocker。
- migration 只把旧行回填 ENABLED，不猜历史；上线后 DISABLED 行保存 configuration/rows/unit snapshots/version。
- CP-07 RECALL 真正把首败修复路由回触发 CP 的双读与 proof 归属，不是形式补字。

## C · Round 1 处置对照

- M-01：接受作者 `PARTIALLY_CONFIRMED`；可执行化是已裁定语义的直接落地，不是新增“第二次永远拒绝”的产品语义。
- S-01：接受作者 `CONFIRMED`；CP-07 缺口已真实关闭。

## D · 最终 verdict

```text
GO_OR_NO_GO=GO
M/S/N=0/0/0
ROUND_FINAL_DECISION=SELF_DECIDED
```

Clarity、Verifiability、Completeness、Big Picture、Principle/Option Consistency、Alternatives Depth、Risk/Verification Rigor 均通过；没有第三 truth、fallback、owner 越界、迁移猜历史或授权扩张。

## E · 授权边界

本轮仅完成只读 DESIGN Round 2 review。未改代码、未 Git、未测试、未运行 DEV/reset/seed/browser/UAT/部署/数据操作；本 verdict 不授权 implementation 或动态验证。
