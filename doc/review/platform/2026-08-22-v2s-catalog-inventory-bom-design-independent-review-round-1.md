# 商品库存与 BOM 业务模型 · 独立 DESIGN 对抗审查 Round 1

```text
REVIEW_CYCLE_ID=CIB-BUSINESS-MODEL-DESIGN-2026-08-22
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_STATEMENT=先从正式需求、模板规范和 owning source 独立构造预期，再审设计稿；不把作者自检、既有 review 或 prompt 中结论当证据。
blindReviewDeclaration=<先独立 verdict、后对照作者材料>
authorMaterialReadAfterIndependentVerdict=true
AUTHOR_FINDING_MATERIAL_PROVIDED=false
```

> 本文件忠实记录 fresh 独立 reviewer 的 Round 1 只读 verdict。作者处置不写入本文件。

## A · 输入清单与 admission

- Roadmap：`programId=V2S_W0_W4_EXECUTION`；`ROADMAP_SCOPE=AUTHORIZATION_ONLY`；本轮 exact authorization 是 Dexter 直接授权的 DESIGN review。已删除的 `CURRENT_*` 不作为授权。
- `doc/decisions/`：扫描 92 个 Markdown 标题，打开 verification、carry-over、acceptance、coordination、observability、collection/owner/transaction、foundation、catalog/unit/option/copy 相关 decision。
- confirmed business corpus：以“商品/库存/BOM/SKU/点单选项/单位”检索命中 14 行，主要锚点 G-11/G-12。
- 六维 recall：按 `task-kind=design` 读取 kernel、全部命中原文及 source refs。
- 作者 finding/intake 未提供；被审六份工件是 review object。

`reviewerInputChecklist={path,sha256,read}`：

| path | sha256 | read |
|---|---|---|
| `AGENTS.md` | `586dedb45f1d657770aa9e0579157e96597dafcad88647e168ce7a1b5935dc54` | READ |
| `CLAUDE.md` | `ef611507ceadff37484cb51692413fb61af364170a60f2c3df061b263fb6e2e4` | READ |
| `PLATFORM-BLUEPRINT.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74` | READ |
| `doc/platform/README.md` | `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` | READ |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | READ |
| `project-memory/index.md` | `bcf5f11f9ef0a27e27d71f8d3dc92accc7511127b684d2838b83ea1df6b4837e` | READ |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | READ |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | READ |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | READ |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | READ |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | READ |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | READ |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | READ |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` | READ |
| `doc/platform/backend-coding-standard.md` | `033a288acd6241c33c10228ac2aec71b5827f8bbf5d43eb2b1c6eeae5ba7c6f6` | READ |
| `doc/platform/frontend-coding-standard.md` | `40ef85e729522069498928c6d7c91be7220776ffe3ef67f2c635630552e9a397` | READ |
| `doc/platform/foundation-charter.md` | `4a1bd6510d3ac9c17f19ed60bd626791f532e920d2a73a5193612a0978628de7` | READ |
| `doc/platform/review-standard.md` | `31dad2139bae7fec8d3891a66069c3c225ef63f7520993a45ca8f10a8783775a` | READ |
| `doc/decisions/templates/journey-decision-template.md` | `57a99ca1fea405cd04857779b0661c7fcfed66b9f5095450f2cd73cc8441230d` | READ |
| `doc/decisions/templates/ui-interaction-design-template.md` | `75cb8c22042f2d9e0f8a8b121e96952d226a7efc4e73184d2b75ecfd8e642e51` | READ |
| `doc/decisions/templates/ia-design-template.md` | `062925f8aa4b3446e06e74d8bad4166f3b3b3e8b18ebe403df7184acd5cd358f` | READ |
| `doc/decisions/templates/implementation-design-template.md` | `2dbe4071db0b3489a0dffee9b7dae6cc293bd4b0b080b5d38751b489123b18f7` | READ |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | READ |
| `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md` | `ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568` | READ |
| `doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md` | `afeafcf0373bbaaa921c1de7f9ac797af71d95f1540fe5953458ef8dbe63c991` | READ |
| `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md` | `c475ac4514281ddd2d2a66a2c66b85bf6804aa08b1e62775211cbcbe50958d44` | READ |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | READ |
| `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` | `fee1f6a0417916d5fa6e38c2f5925c65eb2d26f9bb112d375216f96250ab0777` | READ |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `cc2373d1d3dc3d329e549acf22048a6e063832878787ee953f2bd4bd85b6a9c9` | READ |
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md` | `d26c57eebbba3f8ad7bb6420f53d5cde8d206ee3fa97f19bfbe34cad01d97851` | READ |
| `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md` | `3e441538ef127fa6ca585b9db66a040e31920fcba0affc9c27ba024352fd869f` | READ |
| `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md` | `0e0b3cbaae5d2aeaaf5fef60eec02e800887504d6ecdce346ec60f69adba6ed9` | READ |
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md` | `9ff483187922d370cdfee6958b05fbf768a5435d9698fe4984914a0c8c009c5c` | READ |
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md` | `85b382d5fb5bc998f0b8fa5072cc0dc2f918d30cf89e4b5b8d0a133794efe328` | READ |
| `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md` | `0c25d59f16475b5574d16e97ce3769aaa080a7abf77a1bd2fbbe5686e57f589c` | READ |
| `scripts/generate/catalog-inventory-p1.mjs` | `dbf6683a31aa2221f964a3f8ca9123218dffc722f46d4352affc0e89af9d0299` | READ |
| `contracts/catalog/CatalogInventoryShapeManifest.java` | `bf33ddf6a459d38aad4bcda72a383d7c56e10ed1b5813af3b321c731e91f321e` | READ |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `e6dd0742c9f7ce37626b2476b0f2e864b232a8a96a7a2e6eca48c5c812fd2204` | READ |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java` | `ec430baa7adb7ec9a6dd5e39d9ebf094b95a0d10140995b6b412f869d1bc172d` | READ |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | `579cf3b70cd8260a4ee9289f835fbfd563493d896b00d24c8b83e32a4798794c` | READ |
| `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java` | `7ae962e3d30cbbcf6210a03750f36d9bb1f2b83cee8baf9875c06d054a975d3b` | READ |
| `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java` | `1fd8a8d62b93c3ad742bb26f8e61db50e020062cc4b9f33582af0f01a8b4b168` | READ |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java` | `07e598a552eeea9e8b17735c2da27767c5f98911a5d0fac2885c0d068f4a885d` | READ |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `65ca4416583f2e3147230f5317340fd23e92d8be8108b87df8de6260909af561` | READ |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql` | `bb3e76ad21a99afb0e15b0b250211d2fb8a2b308a2f2a62005add0472ec4acaf` | READ |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260807_100000_000__catalog_inventory_option_value_bom.sql` | `5b15bc29db619e41137d099d52f495f6e775eddfa329b8220d6b01baf85983f8` | READ |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260821_090000_000__catalog_inventory_unit_model.sql` | `24cce4eedbef1ed386ac294a05c0b32406e6f641ef4c150527d0af37c9ba8592` | READ |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java` | `0cc2ffc060c647e545f2b7f13383e86942cd345d3a8899d85ddc4239fc5f588d` | READ |
| `contracts/policy/catalog-inventory-assertion-matrix.json` | `a0d1a5f1bd2c1833509b14094366c7e04e6fcfb3e0f40756d6f5a905cdbc92bf` | READ |
| `contracts/policy/catalog-inventory-fixture-catalog.json` | `ae893f7fde8a91331a484a60f711f8f37a6f91ac15e1c7f1207eb5afca22a8ff` | READ |
| `contracts/policy/catalog-inventory-fixture-catalog.schema.json` | `479c7a17caca63f8324dc3eaa374c23190668607beff40622ebea0c843712e10` | READ |
| `contracts/policy/catalog-inventory-reference-path-matrix.json` | `b026c14108a2bf1183d13cb79d3aacb856c7fd741b6a8d00b45d47cdd838f34f` | READ |
| `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json` | `5c03fbfee77be85e85402338f43bb1b2a45b635944ec108495d602a8c57a0ee8` | READ |
| `scripts/dev/catalog-inventory-seed-plan.mjs` | `50390e800595a07eed6e3ac68a57ac311c8640222b4c9d64ea75545a18d863e0` | READ |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | `7d44d4f467c2b1b83d865e193a62c5ea86ffc6834f5043fcaf3319ab838b545a` | READ |
| `scripts/dev/catalog-inventory-seed-executor.test.mjs` | `ff8d22b51f0d44bc24f53ca87c0928a6298a52847d70a98035929b18dcee15c9` | READ |
| `scripts/test/catalog-inventory-definition-seed.test.mjs` | `60415a4169dd86c740da5055dc1a91d50f63c554736bc0e00083f2f8fe973319` | READ |
| `scripts/test/catalog-inventory-seed-identity.test.mjs` | `de49565f2a8b7cbb58b04e0afe1a403237f8a86c854a9eebf2ffe4675022aba0` | READ |
| `scripts/test/test-health-entry-runner.mjs` | `03468fe0546879569a57e16c265686bb3f7e5811b9d6194a8849c70fd2fa9ce7` | READ |

## B · Findings

### M-01 · A-05 历史快照 blocker 没有可执行权威事实源

- 证据：正式需求要求余额/流水/BOM引用/历史快照四维；详设直接写成 `disabled definition snapshot`，但当前 owner source 没有 `definition_status` 或同名历史事实，现有表只明确拥有 balance、ledger、stock_bom 与单位快照。
- 后果：实施者无法判断历史维度是 ledger/BOM unit snapshot、未来 disabled definition、copy/promotion 记录还是其他事实，可能误放行或误拒绝切换。
- 最小修复：详设 CP-02、§7/§8/§10/§11 与 serial CP-02/CP-05 加权威事实表，明确 table/column/API/query、与另三维差异、空/存在、fixture 与 problem details；没有事实源则升级为产品缺口。

### S-01 · CP-07 缺少自己的 RECALL

- 证据：serial plan 总则要求每个改点重开“该 CP 的 RECALL”；CP-00..06 都有，CP-07 允许首败修 owning source/fixture，却无 RECALL。
- 后果：静态闭合阶段可能脱离原业务/owner上下文局部修门。
- 最小修复：CP-07 增加触发 CP 原 RECALL、需求/IA/详设、owning source、首败日志、runner denominator、self-test/red fixture，并要求修复回流所属 CP 双读记录。

N=0。

## C · 测试矩阵与 seed 分母

- 当前 `@AcceptanceScenario` 精确 77；设计 `77+3=80` 一致。
- 两个 helper 名命中扣除定义后共 20 个非法普通/称重+SKU调用点。
- 3 个 scenario 的 63 matrix、8 switch、6 component red、3 option 分支形式上可执行；M-01 使历史 PRESENT/ABSENT 暂无独立真值。
- seed 10b 的唯一 source、executor、plan、generated outputs、三 static tests 与 runner 列举充分；同样只受 M-01 阻断。

## D · Verdict

```text
GO_OR_NO_GO=NO-GO
M/S/N=1/1/0
```

主干、三种布局、component candidate、acceptance 与 seed 大多闭合；A-05 权威事实源和 CP-07 双读缺口阻断本轮 GO。

## E · 授权边界

本轮仅做只读 DESIGN review；未修改文件、未执行 Git、测试、DEV、reset、seed、browser、UAT、部署或数据操作，不授权实施。
