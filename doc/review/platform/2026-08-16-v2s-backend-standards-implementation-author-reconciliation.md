# v2s backend standards implementation author reconciliation

> `AUTHOR_RECONCILIATION=true`
> `reviewerKind=AUTHOR_RECONCILIATION`
> `independentReviewerVerdict=false`
> `date=2026-08-16`

## 1. 目的与授权边界

本文件是作者依据 `doc/review/platform/2026-08-16-v2s-backend-standards-conformance-review-claude.md` 的 13 步串行执行序列，对当前仓代码、契约、迁移、生成物、测试和证据做的逐项实施对账。Dexter 已明确授权作者自行完成该对账。

它不是独立子 agent 的 adversarial verdict，也不替代 Claude review。此前尝试的独立 subagent 未产生可审计 artifact，因此不把那些尝试计为独立 review 轮次。

本轮范围只包括原 review 的 13 步：M-A、S-e、S-c、S-b、S-a、S-d/N-d、N-f、N-c、S-07 残项、PreserveStackTrace 门、N-b、N-a、M-B。S-04、S-15 仍是原文标注的 `DEXTER_DECISION`，不在本轮扩展；本文件也不授权 DEV、seed、reset、浏览器 L2、UAT 或下一 Roadmap step。

## 2. 判定口径

- `CONFIRMED`：当前源码/契约/迁移与 owning source 对齐，且已有适用的 focused proof 或机械门。
- `PARTIALLY_CONFIRMED`：实现主体已对齐，但原验收仍有明确的动态、数据库或严格证据缺口。
- `REJECTED_WITH_EVIDENCE`：重新打开 owning source 后，原 finding 的事实或业务后果不成立；本轮 13 步没有以此状态推翻原序列。
- `UNVERIFIED_REQUIRES_EVIDENCE`：缺少被授权的 DEV/HTTP/L2/UAT 或严格成对证据，不能用静态结果代替。
- `DEXTER_DECISION`：产品、Journey、范围或授权取舍；本轮未新增此类决定。

## 3. 13 步逐项对账

| 步骤 | 当前判定 | owning source / 当前实现 | 已取得证据与剩余边界 |
|---|---|---|---|
| 1 · M-A 契约第二根降级为产物 | `CONFIRMED` | `contracts/catalog/catalog-inventory-edge-contract.json`、`scripts/generate/catalog-inventory-p1.mjs`、`contracts/openapi/catalog-inventory.openapi.json`；resolver、capability invariant、query-envelope test 已改为同一生成链 | `scripts/check/catalog-inventory-p1`、`R5_OPENAPI_CONTRACTS`、edge-codegen check PASS；strict resolver 61 documents / 2079 references，missing file/pointer 为 0。 |
| 2 · S-e 迁移显式约束名 | `PARTIALLY_CONFIRMED` | `V20260808_160000_000__inventory_opaque_catalog_identity_refs.sql`、`V20260815_010000_000__catalog_voided_item_code_release.sql`、`V20260816_020000_000__catalog_sku_voided_code_release.sql`、`V20260816_030000_000__catalog_dictionary_tag_voided_code_release.sql` 均对 legacy constraint 使用显式 `DROP CONSTRAINT`，不再静默 `IF EXISTS` | `scripts/test/catalog-p3-model-migration.test.mjs` 13/13 PASS。实际 DEV 库中这些约束是否按 owning DDL 存在仍为 `UNVERIFIED_REQUIRES_EVIDENCE`；本轮没有 DEV 授权，不能把静态约束名检查写成迁移已在 DEV 成功。 |
| 3 · S-c 作废码可回收 | `PARTIALLY_CONFIRMED` | 两张表改为 `status <> 'VOIDED'` 部分唯一索引；`CatalogOwnerService` 字典列表与 `ProductionTagOwnerService.readTags` 保留 VOIDED 行，不增加列表过滤 | 迁移/source-contract focused test 13/13 PASS，production-tag/catalog module evidence PASS。完整 HTTP 的“作废→同码重建→列表仍可见”闭环未运行，归 `UNVERIFIED_REQUIRES_EVIDENCE`，不是静态失败。 |
| 4 · S-b 自由 JSON 字段上限 | `CONFIRMED` | `CatalogJsonDocumentSizePolicy` 以 UTF-8 256 KiB 为限，错误包含字段路径、实际字节数、上限和超出量；`CatalogInventoryCoordinator.canonicalSaveRequest` 先透传 `CatalogOwnerApi.Problem`，避免 composition catch 把字段诊断降级为泛化错误 | `CatalogJsonDocumentSizePolicyTest` 及新增 composition-boundary regression 由受管 `modules:catalog:test` PASS；同族 owner/coordinator catch 已扫描。没有把这项 unit proof 写成完整 HTTP proof。 |
| 5 · S-a 拆掉 5000 悬崖 | `CONFIRMED` | `CatalogInventoryCoordinator` 改为 inventory owner 的集合读取链，移除按商品总量 materialize 的 5000 prefilter cliff；保留 owner 边界与请求语义 | `CatalogInventoryCoordinatorCopySourceAuthorityTest`、managed catalog/inventory unit wrapper PASS；没有受控性能 study，因此不声称 p95/吞吐或数据库资源 PASS。 |
| 6 · S-d/N-d catalog 复制批量化与租户谓词 | `PARTIALLY_CONFIRMED` | `CatalogOwnerService.executeCopy` 使用 catalog batch facts；`assetRefsStillReferenced` 恢复 data-node/brand 租户谓词并走集合化引用检查 | catalog module、inventory module、application wrapper 的 managed Testcontainers run PASS，cleanup 全部 PASS。完整 HTTP 复制场景与受控 SQL/性能 study未运行，故仍保留动态证据边界。 |
| 7 · N-f Jackson 回执 | `PARTIALLY_CONFIRMED` | 四个 `*CommandReceiptService` 使用 Jackson canonical write/read，并在适用 owner replay path 通过 `LegacyReceiptJson` 处理旧格式；正则字段读取已移除 | Java compile、focused owner tests 和 managed Testcontainers 证据 PASS；旧库回执、引号/反斜杠/null/list/map 的完整真实 HTTP replay 未运行，不能宣称数据迁移/UAT PASS。 |
| 8 · N-c 死索引处置 | `CONFIRMED` | 删除无可用前缀/谓词证明的 `inventory.ix_stock_bom_option_value`；保留 production-tag 与 password-recovery 查询可使用其 leading prefix 的索引 | migration/source proof 明确检查 index prefix、predicate 和生产 query shape；`scripts/test/catalog-p3-model-migration.test.mjs` PASS。没有 DEV `pg_stat_user_indexes` 或 `EXPLAIN (ANALYZE, BUFFERS)`，所以不声称运行态索引使用率。 |
| 9 · S-07 残项 | `CONFIRMED` | 删除无调用方的 `PlatformWorkspaceAuditHistoryService.readGroupWorkspace(AuditReadScope, ...)`；逐字节相同的 catalog target capability 收口至 `CatalogTargetCapability`，owner-specific grant/context/copy 逻辑保留 | capability invariant、架构门、compile 与 focused owner tests PASS；同族 owner 扫描没有发现应继续合并的语义差异。 |
| 10 · PreserveStackTrace 门 | `CONFIRMED` | 仅启用 curated PMD PreserveStackTrace；四个 receipt/catch 家族保留真实 cause，`OperationsCatalogInventoryController` 的宽 catch 未丢 cause，未凭借门要求做无依据的业务收窄 | `backendPmdPreserveStackTrace`、`scripts/verify --validate-only`、compile PASS；不把 PMD PASS 说成完整错误路径 HTTP/UAT PASS。 |
| 11 · N-b 61 个 `.yaml` 改 `.json` | `CONFIRMED` | `contracts/openapi/` 当前 61 个持久契约为 `.json`；脚本、resolver、generator、evidence path 和 scratch semantics 已同步，Heritage YAML 仅走显式只读适配 | edge-codegen check、strict resolver、OpenAPI verify PASS；仓内 contracts/openapi 无残余 `.yaml`。 |
| 12 · N-a 六个跨模块同名包 | `CONFIRMED` | app-owned operation 类型迁入六个精确的 `application.operations` closed set；owner read/protocol/未迁移 adapter 未被泛化搬迁 | 文件系统 split-package gate、operation binding 69/69、generated binding 24 files、compile PASS；未新增跨 owner 抽象。 |
| 13 · M-B Spotless/全量格式/接门 | `PARTIALLY_CONFIRMED` | Spotless 7.0.2 + palantir-java-format、UTF-8 120-byte gate、PMD/根任务 wiring 和精确 generated exclusions 已落地；生成器已按同一规则重跑且 check 通过 | `gradle spotlessCheck --no-daemon`、UTF-8 line gate、compile、`scripts/verify`、generator checks PASS。原 review 要求的“格式化前后 `javap -c -p` 去掉 `LineNumberTable` 后逐字节相同”没有一份与最终源码严格成对且新鲜的证据：现有 `.runtime/r5/evidence/formatting/bytecode-before.json` 早于后续 source changes，历史比较已有 3 个 stale-source mismatches，最终 S-b 修复又改变了 coordinator。因此该项不能升级为 `CONFIRMED`，也不能用 Spotless/compile 代替。 |

## 4. 作者结论

`NO-GO` · **M 1 · S 0 · N 0**（作者 reconciliation，非独立 reviewer verdict）

唯一仍阻断整体 GO 的实现级严重项是第 13 步的严格 bytecode 成对证据不完整；这不是把格式门、编译门或生成门的 PASS 降级，而是按原验收判据拒绝把它们冒充 bytecode proof。第 2、3、6、7 步的未运行项是明确的动态/数据库证据边界，不是已观察到的代码失败；它们保持 `PARTIALLY_CONFIRMED`/`UNVERIFIED_REQUIRES_EVIDENCE`，不能被写成 DEV、完整 HTTP、L2、seed 或 UAT PASS。

本轮还发现并修复了一个原 review 未单列、但属于同一异常翻译问题族的缺口：composition boundary 的宽泛 catch 会把 owner typed size problem 变成泛化错误。修复已写入 `CatalogInventoryCoordinator`，回归测试已受管运行，并将通用判据补入 `project-memory/decisions/http-crud-efficiency-design-redlines.md` 的 `BACKEND_PRESERVE_STACK_TRACE_SCOPE`。

## 5. 证据清单与未执行范围

已通过：

- `./scripts/verify --validate-only`：12/12，cleanup=`NOT_APPLICABLE_STATIC_ONLY`。
- `gradle spotlessCheck --no-daemon`：PASS；UTF-8 120-byte gate、PMD PreserveStackTrace 均 PASS。
- `gradle :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava --no-daemon`：PASS。
- `node --test scripts/test/catalog-p3-model-migration.test.mjs`：13/13 PASS。
- `yarn --cwd apps/frontend/operations-admin vitest run ...`：6 files / 52 tests PASS，覆盖 brand copy、dictionary picker、inventory display。
- 受管 Testcontainers：catalog/inventory/application wrapper PASS；7 个 targeted backend selectors PASS；新增 `CatalogJsonDocumentSizePolicyTest` module run PASS，所有对应 cleanup PASS。manifest 位于 `.runtime/r5/evidence/remote-testcontainers/`。
- edge-codegen、operation bindings、backend-performance bindings、catalog-inventory-p1 checks PASS。

未执行且未宣称：完整 HTTP denominator、浏览器 L2、DEV start/重启、DEV constraint/`pg_stat_user_indexes`、seed、UAT、远端完整业务数据验收。当前授权边界不允许用本机 build、受管 module test 或静态 generator result 代替这些证据。

