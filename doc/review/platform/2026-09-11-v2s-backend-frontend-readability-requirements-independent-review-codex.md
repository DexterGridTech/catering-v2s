# apps/backend 与 apps/frontend 可读性整改正式需求独立评审（Codex）

评审日期：2026-09-11  
评审对象：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md`  
评审范围：只评正式需求；不评详设、实施计划、源码改动或运行结果。  
评审方式：当前字节、source-first、证伪式 DESIGN review。未启动 DEV、reset、seed、backend acceptance、browser L2、UAT；未修改生产代码、契约、测试或脚本。

## 0. 结论摘要

```text
REVIEW_CYCLE_ID=20260911-READABILITY-REQUIREMENTS-DESIGN
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=3/4/2
L1_ENGINEERING=NO-GO：SQL范围与检测闭合不成立、前端HTTP位置门可假绿、operation budget验收引用不存在且被本文禁止的整改前基线。
L2_USER_VISIBLE=NOT_APPLICABLE：本批没有用户界面或用户任务变更；前端目录规则仍需静态可执行性闭合。
L3_UNVERIFIED=存在：本轮只做需求与源码静态核验，未执行任何动态验收；不得把未执行项升级为实现失败。
SAME_ROOT_SCAN=完成：后端语义段、SQL形态、模块清单/注册表、根目录边界类、前端features、测试发现器、verify-gates、预算生成/消费路径均已重开。
DESIGN_GAPS=存在：迁移分母、SQL/HTTP判据、机器门四件套、模块边界、预算oracle及选择性domain/test可读性处置仍需收窄。
EVIDENCE_TIER=本轮仅static；没有focused、Web、Android、DEV、L2、backend acceptance、seed或UAT证据。
```

这不是沿用作者的两轮 NO-GO，也不把作者自报数字当事实。影响结论的数字在下文说明了重数方法；不能可靠复算的动态分母不被写成 PASS。

## 1. 独立事实基线与方法

### 1.1 已重开的输入与边界

已按仓内入口重开 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、Roadmap 授权字段、`project-memory/index.md` 全部 kernel、六维 `recall-memory` 返回原文、`scripts/README.md`、`CLAUDE.md`、backend/frontend coding standard、review standard、foundation charter、verify-gates、module registry、Gradle module 清单、TER 可读性需求的 §7.1a/§9.1，以及相关 owning source。

六维路由为：

```text
scripts/context/recall-memory \
  --task-kind review \
  --domain platform \
  --consumer-face operations-admin \
  --owner product \
  --impact governance \
  --trigger task-start
```

快速分母先确认了 `.runtime/browser-l2/l2-1789078202608-83963-ca17e791-715e-4b9f-9eae-04a17eb620d6/repository-byte-binding.json` 的 `scope` 为 `apps-backend-and-apps-frontend-input-files-excluding-managed-runtime-and-build-output`，其 `files` 长度为 1,491。该清单只用于排除构建产物的入口，未替代按语义路径、生成源和 owning source 的扫描。

### 1.2 重数与当前字节事实

- `settings.gradle.kts:20-36` 的 backend leaf module 为 17 个；目标文档列出的 4 个豁免名为 `foundation`、`execution-context`、`audit-model`、`audit-read`，所以按目标文档自己的范围应为 13 个业务 module，而非 `:60`、`:148` 的 14 个。
- `contracts/policy/module-dependency-registry.json:5-84` 的 `modules` 数量为 13；它没有覆盖 `foundation`、`audit-read`、`fulfillment-production`、`collaboration` 等当前 Gradle module，不能单独作为全量范围 source。
- backend `src/main/java` 总 Java 文件数按 `rg --files apps/backend/catering-business-server/modules | rg '/src/main/java/com/catering/v2s/.+\\.java$' | wc -l` 重数为 262。目标表的 94/76/41/5/2/1 语义段数字之和为 219；其余是目标文档另行豁免或未按这些段计入的路径，因而 checker 必须明确排除/包含规则，不能只给一个总数。
- 当前纯 `domain` 文件未发现 Spring/JDBC/HTTP transport 依赖；`persistence` 的 5 个文件在 `foundation`，其中有 JDBC/事务基础设施，但静态扫描没有发现 `@Transactional` 注解。
- `CatalogAcceptanceScenarios.java` 当前 `wc -l` 为 9,299，`@AcceptanceScenario` 出现 38 次；`BackendAcceptanceScenarioCatalog.java:9-28` 通过 annotation group 反射发现并按 id 排序。运行时不依赖文件位置，但不等于人类导航成本为零。
- 按目标文档的前端词法口径，在两个 app 的 `features` 非测试 `.ts/.tsx` 上重数得到 `application=4`、`model=3`、`ui/*.ts=3`、`ui/*.tsx=95`；这些摘要数字本身一致，但词法遗漏 `catalogInventoryClient` alias。
- `tools/verify-gates/cli.mjs:928-939` 的 `SELECT *` compatibility 集合字面量为 9 个；同一 gate 的当前实际 Java 文件集合为 11 个，另外命中 `CatalogOwnerService.java` 与 `InventoryOwnerService.java`。

### 1.3 fresh 独立子 agent intake

```text
REVIEW_CYCLE_ID=20260911-READABILITY-REQUIREMENTS-DESIGN
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=Kant
result=completed, read-only, no runtime, no git, no file writes
independentVerdict=NO-GO
```

Kant 独立找出的核心问题是：SQL 前缀判据漏掉 `WITH RECURSIVE`/CTE 列名等形态；前端 HTTP 判据可被 alias/re-export/generator 绕过；语义段扫描可能漏掉 module-root boundary marker；新 checker 没有明确接入 `scripts/verify`。本评审逐条重开后确认前三类事实，另确认 operation budget 的基线矛盾；将 SQL范围与SQL判据合并为一个 M，将其余问题与本 agent 的 domain/test 观察按同根去重后计为 `M/S/N=3/4/2`。独立 verdict 保留，不以作者会话自审替代它。

## 2. Findings：M（3）

### M-01：全局 SQL 禁令、实际迁移分母与 SQL 检测闭合互相矛盾

- 状态：`CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:133-144,150-154,162-172,252-257,317-320`
- owning source 反例：
  - `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java:443-449`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCompositeFacts.java:36-44`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogDefinitionFacts.java:30-38,91-98`
  - `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java:388-397`
  - `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java:1954-1964`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java:3984-3990,4684-4690`
- 事实一：`:133` 禁止所有业务 module 的 `api/`、`application/`、`domain/` 出现 SQL 字面量；`:162`、`:170`、`:317` 却只把四个 owner service 的约 791 行列为 step 1 迁移面。前四个 owning source 都在业务 module 的 `application/` 且不属于那四个目标服务。四个服务迁完后，若全局门接线，仍会因这些字节变红；若不搬，又违反全局禁止句。`:255` 又写成从 49 个带 `@Transactional` 的 application 文件迁 SQL，和“四个 owner service”没有唯一对应关系。
- 事实二：`:140` 的 `WITH <ident> AS` 仍不匹配当前 `WITH RECURSIVE`、CTE 列名、`MATERIALIZED`、多个 CTE；`UPDATE <ident> SET` 不覆盖表别名；`INSERT INTO ` 不覆盖关键字后的换行。当前 owning source 已有这些形态。仅去掉首部空白/换行解决的是 text block 存储形态，不是 SQL 语法集合。
- 可复现反例：将 `CatalogCompositeFacts.java` 的 SELECT 或 `CatalogDefinitionFacts.java` 的 INSERT 留在 `application/`，按目标规则迁完四个 owner service 后，终态仍违反全局禁令；将 `WITH RECURSIVE`、`UPDATE schema.table g SET` 或 `INSERT INTO\n` 放入同一 checker 的输入，目标前缀集合可假绿。SQL 注释、`MERGE`、`TRUNCATE`、`CALL` 也未定义处理。反方向，一个以 `SELECT ` 开头但只是普通文本的 Java 字符串可能被误报，因为判据没有限定 JDBC/SQL 执行上下文。
- `doc/platform/foundation-charter.md:420-427` 要求每道机器门有不变量、真实 red fixture、negative control、能通过门但违反命题的 surviving counterexample。拼接与 text block 两个 fixture 只覆盖存储形态，不能覆盖上述语法族、普通文本负控制和绕过反例。
- 影响：实施范围没有唯一答案，SQL 门又可能在错误输入上 PASS；“强制约束”会变成不能收绿或 false-green 的文档口号。
- 最小修复：在实施授权前二选一并写死：
  1. 将 step 1 扩展为完整 SQL-bearing violation inventory，逐文件/方法列出 owning source、事务边界和验证范围，同时定义 token/lexer 或足够闭合的 SQL 形态 checker；或
  2. 将本批禁止句收窄到四个已批准迁移面，明确其余 application SQL 是后续批次，并把 SQL 判据改成该明确集合的核验。
  无论选择哪种，逐门补 canonical checker、默认命令、negative control 和 surviving counterexample；不要用延后接线掩盖集合矛盾。
- 是否需要 Dexter 决策：**需要**。这是本批迁移成本/范围的产品与工程边界；checker 细节本身不需要产品裁决。

### M-02：前端“非 tsx HTTP 入口必须在 application”可被现有 alias 绕过

- 状态：`CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:209-236`
- owning source：
  - `apps/frontend/operations-admin/src/app/api/OperationsTransport.ts:97-105` 导出 `catalogInventoryClient`
  - `apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogBatchActionController.ts:3,109-112,130-133`
  - `apps/frontend/operations-admin/src/features/catalog-management/model/catalogFieldRuntime.ts:18,180-188,223-226,251-264,279-337`
- 事实：这两个 feature 文件都是非 `.tsx`，并从 app transport 引入 `catalogInventoryClient` 后直接调用 HTTP operation。`:213`/`:215` 的入口词表没有该 alias；它依赖有限变量名而不是 transport 边界。作者已经用 `readX()` 反例证明 `use*` 命名条件不可靠，但删掉命名条件没有解决 alias/re-export/generated client factory。
- 可复现反例：在 `ui/*.ts` 或 `model/*.ts` 中调用 `catalogInventoryClient`，位置门保持绿而 HTTP 已发生；再以 `import { operationsRtk as api }`、re-export 为 `catalogApi` 或 generated request factory 的形式改名，同一绕过继续成立。
- 影响：`:219-236` 的“6 个文件完整整改分母”和“红夹具后门闭合”均不可靠；新数据 client 采用不同导出名时会持续假绿。
- 最小修复：以 `app/api` transport/client 的 import、re-export 和调用闭包定义 HTTP 入口，或明确承认静态门无法可靠闭合而将它降为 review-only。若保留机器门，至少加入 `catalogInventoryClient`、alias、re-export、generated factory 的正/负 fixture，并写明 checker owner、输入 scope 与默认 verify 接线。
- 是否需要 Dexter 决策：不需要；这是同一“非组件数据访问归位”目标下的判据闭合问题。

### M-03：最终 operation budget 验收要求不存在且被本文禁止的“整改前基线”

- 状态：`CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:286-306,320`
- owning source：
  - `scripts/test/backend-performance-operation-reconciliation.mjs:143-212`
  - `scripts/test/r5-remote-testcontainers.mjs:339-346,598-600,620-640,1402-1412`
  - `scripts/generate/backend-performance-budget.mjs:90-93,668-721,809-819`
  - `contracts/policy/backend-performance-operation-counts.json:2-8`
- 事实：`:294` 要求 per-operationId 计数与“整改前基线一致”，`:306` 又禁止建立违规基线/台账。当前 `assertPerformanceOperationBudgets` 消费 generated `databaseOperationBudget` 并验证 fixed/linear 上限；`requireClosedPerformanceCount` 验证 declared/observed/exceeded 的闭合；两者都不读取或比较整改前快照。当前 active operation count policy 是 269（reads 114、commands 155），不是一份本批整改前的逐 operation 快照。
- 可复现反例：某 operation 当前 observed count 与旧值不同但仍低于 generated `max` 时，现有 verifier 会通过；严格执行 `:294` 却无法判定，因为没有 baseline identity、采集时点或比较规则。只跑一次全量 acceptance 不能凭空证明“一致”。
- 影响：最终验收没有可执行 oracle，实施者会被迫重新发明被本文禁止的 baseline，或把 budget ceiling 冒充历史基线。
- 最小修复：删掉“与整改前基线一致”，改为当前系统实际可证明的闭合：全量 `operation=all`、generated registry exact set、active database budget、connection budget、normal sample matrix 与业务结果分别 PASS。预算变化按仓内既有 operation-scoped decision/测量规则处理，不新增第二份 baseline。
- 是否需要 Dexter 决策：不需要产品裁决；若要改变现行 budget policy，才需另行授权。

## 3. Findings：S（4）

### S-01：模块分母、技术模块类别与 module-root boundary marker 未闭合

- 状态：`CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:56-67,114-129,148`
- owning source：`settings.gradle.kts:20-36`；`contracts/policy/module-dependency-registry.json:5-84`；以下 root marker：
  - `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/PlatformAssetBoundary.java:3-5`
  - `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/ExtensionBoundary.java:3-5`
  - `apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/PlatformIamBoundary.java:3-5`
  - `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/WorkspaceIamBoundary.java:3-5`
  - `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/ContractBoundary.java:3-5`
- 事实：Gradle 17 个 leaf 减去四个当前技术豁免应为 13；目标文档写 14。四个硬编码名本身当前没有找到第五个同类漏项，且 `platform-iam`、`platform-workspace`、`platform-asset` 等有 owner/schema/API 的模块不应因名称带 platform 被豁免。但按“路径中第一个语义段”扫描时，module-root boundary marker 不落在 `api/application/domain/persistence`，需求没有说明它们是合法边界例外还是必须归入某段。
- 可复现反例：维护者按 14 或按 platform 前缀更新范围，会漏扫 `fulfillment-production`/`collaboration` 或误豁免 `asset`/`workspace`；checker 若只按语义目录，则上述 root marker 会成为未分类字节，若强制四段，则会把边界声明类误判为业务语义。
- 影响：全量 denominator 与未来 module 增量规则不可稳定复算；不是当前四个名字“错”，而是范围定义会诱发实施漂移。
- 最小修复：把 14 改为 13；将“平台 module”改为“当前四个横切无 owner API 的技术 module”；范围明确为 `settings.gradle.kts` 当前 leaf 减去四者，并写明 module-root boundary marker 的允许/排除规则。模块清单变化时重新分类，但不要恢复不完整 registry 作为唯一 source。
- 是否需要 Dexter 决策：不需要产品裁决。

### S-02：新增机器门没有定义 canonical owner、默认 verify 接线与完整四件套

- 状态：`CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:123-154,209-236,240-273,279-280,316-320`
- 规范依据：`doc/platform/foundation-charter.md:420-427` 要求不变量、真实变红 red fixture、negative control、能通过门但违反命题的 surviving counterexample；`tools/verify-gates/verify.mjs:13-60` 是当前静态命令清单。
- 事实：目标文档列了若干禁止句和部分 red fixture，但没有按规则给出唯一 checker path、命令/输出、输入 scope、默认链路激活点、negative control 与 surviving counterexample。`:253` 还规定整改中会红的门暂不进 `verify.mjs`，`:273` 又要求 `scripts/verify` 静态链始终完整执行；两者没有一个可复核的激活协议。
- 可复现反例：实现者写一个只扫描列举 alias/列举 SQL 形态的 checker，或把新 checker 写在 standalone script 但不接 `verify.mjs`，静态链仍可绿而命题被违反；也无法从文档区分“门未接线”和“已接线但源码违规”。
- 影响：强制约束可能退化为文档口号，前两轮已发现的 false-green 会被推迟到 implementation review。
- 最小修复：在 implementation-facing 详设前增加 gate table：`ruleId`、invariant、checker owner/path、canonical command、expected output、input scope、red mutation、negative control、surviving counterexample、activation step。保留 TER §9.1 的步末入列思想，但写清入列前如何运行 self-test、入列后如何由 `verify.mjs` 执行；不恢复 hash-chain/退役 compliance ledger。
- 是否需要 Dexter 决策：不需要产品裁决。

### S-03：删除“每个 module 强制 domain”成立，但排除选择性 domain 归位的理由过宽

- 状态：`PARTIALLY_CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:19-21,112-123,326-330`
- owning source：
  - `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java:13-20,30-71,77-126`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogJsonDocumentSizePolicy.java:7-23,25-59`
- 事实：强制每个 module 都创建 `domain/` 会制造空壳和假分层，删除该原需求成立；但以上 policy 是依赖轻、无 Spring/JDBC/HTTP transport 的纯规则/校验，当前字节不支持“把业务规则放入 domain 必须先剥离 Spring/JDBC”这一普遍断言。
- 可复现反例：只调整上述纯 policy 的 package/import，不改变 owner service 的事务、JDBC 或 API 边界，就能给不变量更固定的阅读位置；它不是先做执行边界架构重构的必然前置。
- 影响：本批仍可从 SQL 归位和 God class 拆分取得主要收益，但作者把低风险选择性收益说成不存在，导致 `:328` 的收益损失没有被准确决策。
- 最小修复：不恢复“每 module 必建 domain”；改为允许/列出已有纯 policy/value object 的选择性归位机会，明确不移动 owner orchestration。若本批完全不做，应登记为有意延期及收益损失，而不是用绝对的 Spring/JDBC 理由覆盖所有情况。
- 是否需要 Dexter 决策：澄清延期不需要；若恢复为新的领域边界重构，需要 Dexter 另定范围。

### S-04：删除测试文件切分的理由只证明运行时 discovery，不足以证明源级可读性无需改善

- 状态：`PARTIALLY_CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:18,45,176-205`
- owning source：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java:1-40`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java:9-28`。
- 事实：annotation id discovery 与共享 helper fan-in 确实说明“提基类/复制 helper”不是唯一方案；但 9,299 行、38 个 scenario annotation 的单文件仍有明显源级定位成本。运行时按 id 发现不等于人类按业务族理解 fixture 与断言的成本为零。
- 可复现反例：把两个业务族放进独立 package-private scenario class，抽出测试专用 package-private support/context 供组合使用，同时保留 annotation id/host；runtime discovery 仍可工作，不需生产基类、不需复制 helper。由此可否定“只有提基类、全量改调用点、复制 helper 三条路”的绝对表述。
- 影响：测试文件本身是行为说明；完全删除源级分组目标，会使接手者继续在超大文件中搜索。不是业务运行缺陷，但与本文“在固定目录找具体事情”的第一性目标有张力。
- 最小修复：把结论改为“本批暂不拆，待职责→测试覆盖表与测试专用 composition 设计后再拆”，或恢复不改变 runtime/id 的小范围按场景族切分。恢复已删除的 Dexter 范围裁决需要重新确认成本边界。
- 是否需要 Dexter 决策：只澄清延期不需要；恢复实施范围需要 Dexter 确认。

## 4. Findings：N（2）

### N-01：`SELECT *` 移出本批可以成立，但当前事实登记不准确

- 状态：`CONFIRMED`（只针对事实陈述；不否定移出本批的范围选择）
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:17,48,101-107`
- owning source：`tools/verify-gates/cli.mjs:924-951`；`scripts/check/query-boundaries:1-4`。
- 事实：`query-boundaries` 是可执行入口，直接调用 `cli.mjs budget`；它只是没有接入 `verify.mjs:13-60` 默认静态链。按同一 gate 文件集合重数为 11，而 compatibility set 为 9，额外有 `CatalogOwnerService.java`、`InventoryOwnerService.java`。
- 影响：`:17` 的“代码不执行”和“9 处全是正确写法”会让后续读者误判 gate 状态。`SELECT *` 是否属于本批可读性范围仍可回答为否，因为它是独立 DB 卫生/预算规则。
- 最小修复：改成“本批不改变该独立规则；当前 standalone gate 未接入默认 `verify.mjs`，且 compatibility set 有 drift，另由其 owning check 处理”，不要登记成已绿事实。
- 是否需要 Dexter 决策：不需要产品裁决；修该既有 gate 另开范围。

### N-02：规模防退化“没有第三种办法”应改成受现有 source 限定的表述

- 状态：`PARTIALLY_CONFIRMED`
- 目标位置：`doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md:260-268,304-306`
- 事实：当前仓内没有可诚实推导“事务入口→聚合”的机器可读声明源；用 `@Transactional` 数量、行数或文件位置推断聚合会成为数值/位置代理门。理论上可新增 aggregate-membership declaration 并做 exact reverse coverage，但那是新增语义 source、维护成本和新的范围决策。
- 结论：拒绝入口数阈值是正确的 KISS 取舍；不成立的是把“没有第三种办法”写成无条件事实。准确说法应是“在现有 source 下，没有无需新增语义 source 的非代理机器门”。
- 最小修复：保留规模维度 review-only，并把声明式映射列为未采用的复杂替代；不要恢复数字代理门。
- 是否需要 Dexter 决策：不需要；若未来新增 aggregate source，另行扩大范围。

## 5. 独立推导出的、作者文档没有写全的要求

这些不是新增产品语义，而是让当前方向可实施、可复核的最小技术条件：

1. 全局禁止句必须绑定完整 violation inventory，或明确收窄到四个已批准迁移面；“约 791 行”不能替代文件/方法集合。
2. 每道机器门必须有 invariant、red fixture、negative control、surviving counterexample、唯一 checker owner、canonical command、输入 scope 与 activation step；standalone script 未接 `verify.mjs` 不能被写成默认门已存在。
3. SQL 判据必须声明是 token/lexer、JDBC 执行上下文，还是当前迁移集合；至少要说明注释、CTE/RECURSIVE、别名、列名、跨行、拼接、大小写、非 SQL 普通文本的处理。
4. 前端位置门必须覆盖 transport alias、re-export 和 generated client factory，或诚实降为 review-only；不能靠当前变量名白名单维持长期闭合。
5. operation budget 验收必须消费当前 canonical oracle：全量 operation exact set、active generated budget、connection budget、normal sample matrix 与业务结果分开；不能同时禁止 baseline 又要求 baseline 一致。
6. 重构前行为钉住必须同时覆盖 runtime contract 与 source-level responsibility→test navigation；对大型 acceptance file 还要说明 shared test support 的组合方式。
7. 目录词表应按内容处理：不强制空 `domain/`，但识别已有纯 policy/value object 的低风险归位机会；若不做需登记真实收益损失。
8. SQL 抽取必须写清 caller/callee 事务责任：`persistence/` 禁 `@Transactional` 时，outer application command 保留事务边界，并由 focused proof 覆盖抽取前后行为。
9. semantic segment checker 必须明确 module-root boundary marker 的合法边界，避免把 owner boundary 声明类误判为第五段或遗漏为未扫描字节。

## 6. 尝试过但不成立的攻击

### 6.1 “`SELECT *` 必须收回本批，否则需求不完整”——不成立

它是独立 DB 卫生/预算规则，当前已有 `scripts/check/query-boundaries` 与 `cli.mjs budget`。未接入默认 `verify.mjs` 是其自身现状问题，不自动把它变成 readability batch 的必要内容。成立的是修正事实登记，不是把它拉回本批。

### 6.2 “四个技术豁免名一定漏了第五个”——当前字节不支持

按 `settings.gradle.kts`、registry、owner/schema/API 事实及 memory 交叉检查，没有找到第五个与 `foundation`、`execution-context`、`audit-model`、`audit-read` 同类的横切技术 module。`asset`、`workspace`、`platform-admin-iam` 虽有 platform 前缀/历史命名，但有业务 owner、schema 或 API，不能据此豁免。

### 6.3 “text block 红夹具本身是错误要求”——攻击不成立，但充分性不成立

作者关于旧 `SELECT` 判据漏掉 Java text block 的观察成立；当前 application Java 确有 text block SQL，新增 text block red fixture 是必要的。问题是它只证明存储形态，不能证明 SQL 语法闭包、负控制和 surviving counterexample。

### 6.4 “前端 4/3/3/95 分布一定算错”——不成立

按目标文档给出的词法口径，在两个 app 的 `features` 非测试 `.ts/.tsx` 上重数，四类数字一致。真正的缺陷是该口径遗漏 `catalogInventoryClient` alias，不是摘要数字本身。

### 6.5 “persistence 禁事务注解今天已经红，所以全程为绿分类一定错误”——不成立

当前 `persistence` 的 5 个文件都在 `foundation`，静态扫描没有发现 `@Transactional`；它不是空目录，但对“今天是否有注解”这条规则确实为绿。步 1 抽取期间暂不把该门接入默认链、在该步骤末尾入列，符合 TER §9.1 的时点思想；实施时必须保留 application caller 的事务边界。

### 6.6 “删除每个 module 的 domain 强制要求必然违背可读性目标”——不成立

强制每个 module 建满目录会制造空壳；当前主要理解成本确实来自 SQL 与多聚合 owner service。选择性提取纯 policy 可以补收益，但不存在“每个 module 必须有 domain”这一必要条件。

### 6.7 “不拆测试文件就一定违反第一性目标”——不成立

测试切分可改善导航，但也可能引入 composition/发现器改造成本；当前材料足以说明它是可选的后续重构，不足以证明本批必须做。finding 针对的是作者把“运行时按 id 发现”当作“源级可读性已解决”的推理跳跃。

## 7. 是否值得做

值得做，但当前正式需求不能 GO。

四个主要 owner service 的 SQL 与业务判断交织、多个事务入口覆盖多个聚合、少量前端非组件数据模块分散在 `ui/model/application`，这些都直接增加接手者的定位和上下文切换成本。SQL 归入已有职责目录、按事务入口族拆分明确的 God class、把确有 HTTP 入口的非 `.tsx` 模块归位，收益与“强可读性、不过度设计”的方向一致；不需要为了完整分层强造空 `domain/`，也不需要为规模发明数字代理门。

作者列出的三条局限基本诚实：规模维度可以只留 review，前端页面/扁平目录可留后续，规则不必全部 domain 化。它们不抵消本批收益；真正阻断的是 M-01/M-02/M-03 的闭合性。先修复范围与 oracle，再在 implementation-facing 详设中收窄 S-01/S-02，才值得进入实施。

## 8. 未验证项与边界

- 本轮没有运行 `scripts/verify`、Gradle、backend acceptance、browser L2、DEV、reset、seed 或 UAT；任何动态行为均为 `UNVERIFIED_REQUIRES_EVIDENCE`。
- 本轮没有修改目标需求、生产代码、契约、迁移、测试、seed 或脚本；唯一写入是本 review artifact。
- 不做部署、切流、产品验收或 UAT 判断。
- 本轮独立子 agent 已完成且为只读；没有发起第二轮，因为第一轮已给出足以定向处置的 findings，且仓规将同一 review cycle 上限设为两轮。

## 9. 给 Dexter / Claude 的可复制结论

```text
背景：请对当前 formal requirements 做独立 DESIGN 证伪，不进入实施。
对象：doc/plans/platform/2026-09-11-v2s-backend-frontend-readability-requirements-claude.md
范围：apps/backend 与 apps/frontend 可读性整改需求；只读，不运行 DEV/reset/seed/backend acceptance/browser L2，不改生产代码、契约、测试或脚本。
结论：VERDICT=NO-GO，M/S/N=3/4/2。
阻断：M-01 SQL 全局禁令与四 owner service 迁移面不一致，且 SQL checker 仍有真实语法 false-green；M-02 前端 HTTP 位置门被 catalogInventoryClient alias/re-export 绕过；M-03 operation budget 要求整改前 baseline，但当前 verifier没有该 oracle，文档又禁止建立 baseline。
必须补：完整 migration/violation inventory 或收窄规则；canonical checker、verify 接线、四件套；当前 budget oracle；模块 17-4=13、root boundary marker 处理；前端 transport alias 闭包。
非阻断：SELECT * 移出本批可成立但事实需改；四个技术豁免名当前无第五个；domain 全量强制和测试拆分可延期，但理由需收窄；规模维度应声明“现有 source 下无非代理机器门”。
授权边界：本轮不授权任何代码、契约、迁移、测试、seed、reset、DEV、acceptance、L2、UAT、部署或切流。
```
