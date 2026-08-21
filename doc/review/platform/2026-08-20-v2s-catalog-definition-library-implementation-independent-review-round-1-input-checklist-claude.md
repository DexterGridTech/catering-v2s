# CATALOG_DEFINITION_LIBRARY implementation blind-review input checklist — round 1

```text
REVIEW_CYCLE_ID=CATALOG_DEFINITION_LIBRARY_IMPLEMENTATION_20260820
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
```

This checklist was completed in a fresh subagent context. The reviewer first tried to falsify
the current implementation, and did not read an author self-review or finding disposition before
the independent verdict recorded in the paired review artifact.

| Required input | Path / command | SHA-256 / result | Read |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `586dedb45f1d657770aa9e0579157e96597dafcad88647e168ce7a1b5935dc54` | READ_FULL |
| Claude entry | `CLAUDE.md` | `ef611507ceadff37484cb51692413fb61af364170a60f2c3df061b263fb6e2e4` | READ_FULL |
| Platform entry | `PLATFORM-BLUEPRINT.md`, `doc/platform/README.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74`; `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` | READ_FULL |
| Registry / authorization | `doc/platform/roadmap-program-registry.json`; selected `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`; direct Dexter task authority | registry `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ; Roadmap was not used to infer scope |
| All kernel | `project-memory/kernel/01-workspace-and-roadmap.md@f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63`; `02-service-shape-and-owner.md@45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032`; `03-transaction-data-and-dependencies.md@f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44`; `04-contract-consumer-and-admin.md@1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d`; `05-evidence-runtime-and-git.md@254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8`; `06-heritage-and-change.md@5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | complete set | READ_ALL |
| Six-dimension route | `scripts/context/recall-memory --task-kind review --domain backend --consumer-face operations-admin --owner backend --impact contract --trigger review` | `/tmp/catlib-route.json@69acf2d82511668fc66b7dca9fe75586da75e1aa871c2bcd5564cfe165f96c9c` | RUN |
| Routed memory | all 20 returned routed entries (the exact path/sourceRef inventory is the command output above) | route output preserved; all returned `.md` paths opened | READ_ALL |
| Corpus search | `CatalogItem`, `SKU`, `点单选项`, `BOM`, `StockTarget`, `属性` in `project-memory/decisions/confirmed-business-language-corpus.md@3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` | G-11, G-12; no inference beyond their stated scope | READ |
| Batch requirements/design | `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md@0e887bcdff297237593598d6d09fcfa345ef8ae77ec9ee63cf366324075736f5`; `...implementation-design.md@086493ee22c9b6bb1a93f4f1589824f66bccb2ddcacdbd773a3ce4c2b04eb659`; `...serial-plan.md@3a022822d99ea9819e0c77462ef6a920e78844503181911f26cd23223b172363`; discussion `...requirements-discussion-codex.md@89008cfeabd134e364e5b241b2132925efd0dc154a84879b4a1c3d6cd19da073` | complete | READ_FULL |
| Journey / IA / UI | `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md@6063321beb732c647f72bad72caff6cbbd94eb20382ec444f00d561b7f92b9bd`; IA `...-ia.md@b1f09464dc636798ee4c7182b0fd06f279d289d5b5ba04ddd32e2a8b575e8384`; UI `...-ui-interaction.md@82c94d14a2cda534d5100a6232d393dfe4ddf42ed605c9d8a6944a229f9544fc` | complete | READ_FULL |
| Decisions titles / relevant decisions | full `doc/decisions/` title inventory | `/tmp/catlib-decision-titles.txt@30e051253c01509dcb32ca8fae46286f813138172a5fdcb18e077bc8e0919ece`, 87 titles; relevant 2026-07-24 verification, 2026-07-25 independent review, 2026-08-08 catalog owner, 2026-08-14 acceptance, 2026-08-17 metadata modal, 2026-08-20 three batch decisions opened | TITLES_REVIEWED / READ_RELEVANT |
| Standards / charter / review | `doc/platform/backend-coding-standard.md`; `doc/platform/frontend-coding-standard.md`; `doc/platform/foundation-charter.md`; `doc/platform/review-standard.md`; `doc/decisions/2026-07-24-v2s-verification-governance.md` | opened in full | READ_FULL |
| Production / contract / migration | catalog owner, inventory owner/coordinator, definition operations, `V20260820_010000_000__catalog_item_definition_libraries.sql`, OpenAPI catalog shards, generated Java/TS wire, generated operations client, `CatalogItemDrawer.tsx`, `CatalogItemCreateDrawer.tsx`, `CatalogDefinitionLibraries.tsx`, `BrandCatalogCopyDrawer.tsx`, `CatalogAcceptanceScenarios.java` | source-first code extraction and same-root scans recorded in paired review | READ_FULL_FOR_REVIEW_SCOPE |
| Dynamic evidence boundary | task-provided `.runtime/r5/run-manifest.json` resource-budget result for `scripts/test/backend-acceptance --operation catalog.attribute-definition-create-update` | `LOCAL_MANAGED_RESOURCE_BUDGET_EXCEEDED`; execution NOT_RUN; cleanup FAIL; resources are not this review's ownership | READ_ONLY_BOUNDARY |

Per-change prewrite/post-proof double-read records were not available as a complete current-batch
ledger. This is recorded as finding `M-03`; generic preparation and static source reading were not
accepted as a substitute.

