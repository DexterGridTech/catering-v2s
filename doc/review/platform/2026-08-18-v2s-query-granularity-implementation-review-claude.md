# QG-01～QG-15 实施 · 独立 implementation review

- 日期:2026-08-18 · 评审:Claude · 会话:续接同一会话(非 fresh,已声明)
- 本机限制:无 Java 运行时(`/usr/bin/java` 为 macOS 桩),**Java 侧门与编译我无法复核**,相关项一律记 `UNVERIFIED_REQUIRES_EVIDENCE`
- 结论:**NO-GO** · **M=2 · S=1 · N=2**

---

## 0 · 先答:这活到底修没修好那个真问题

**修好了,而且是本批最有价值的部分。** 亲验源码:

`InventoryOwnerService.currentTyped` 现在只发 target 读 1 条 + `changePeriodReadback` 3 条 +
`recentChangeReadbacks` 1 条 = **5 条**;改前为 7 条。

关键在于删掉的那一条:`referenceReadbacks` 的 SQL 是
`... FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=?`,**无 LIMIT 且 WHERE 不含
targetRef**,targetRef 过滤在 Java 结果循环里逐行 `continue`。即打开一个库存目标详情会读出整个
scope+brand 的全部 BOM 行、逐行解析 JSONB、在内存里筛。**该方法现已整体删除,全仓零调用点。**

QG-12 把分页 reference 端点的过滤下推到 SQL,新增 base-row 预筛选
`jsonb_path_exists(sb.rows, '$[*] ? (@.targetRef == $t || @.componentTargetRef == $t)')`。
逐条核过语义:精确谓词 `COALESCE(entry->>'targetRef', entry->>'componentTargetRef')=?` 保留,
预筛选是它的**安全超集**(精确匹配的两种情形必然通过预筛选),不漏结果;
`LIMIT ?/OFFSET ?`、`COUNT(*) OVER()`、`ORDER BY item_code,sku_code NULLS FIRST,ord`、
`data_node_ref/brand_ref` 隔离全部保留。

⚠️ 边界:预筛选**不减少 stock_bom 的扫描行数**,减少的是进入 `jsonb_array_elements` 展开的行数。
无 GIN 索引时仍是全 scope 顺序扫描 + 过滤。不得表述为索引级或吞吐结论。加索引属 migration,不在本批。

M-1(共享读管线固定开销)按上轮约定本轮不做,3 条 `changePeriodReadback` 仍未合并 —— **符合约定**,
不重复计为 finding。

## 1 · 逐项状态

| CP | 状态 | 依据 |
|---|---|---|
| QG-01 | `CONFIRMED` | 维持 `NO_ACTION_ALREADY_COMPLIANT`,无改码 |
| QG-02 | `PARTIALLY_CONFIRMED` | 场景 `catalog.save-asset-reference-lifecycle` 已写,**未运行**(见 M-1) |
| QG-03/04 | `CONFIRMED` | `frontend-transport-cache-lifecycle` 现跑 4/4 |
| QG-05 | `PARTIALLY_CONFIRMED` | 场景 `org.store-state-and-derived-status` 存在,**未运行** |
| QG-06 | `UNVERIFIED_REQUIRES_EVIDENCE` | §7 要求的 `org.commercial-group-workspace-initialization` **不存在**(见 M-2) |
| QG-07/08 | `PARTIALLY_CONFIRMED` | 静态 `catalog-inventory-query-envelope` 现跑 15/15;§7 要求的 `inventory-page-and-detail-readback` **不存在** |
| QG-09 | `CONFIRMED` | 深验通过,见下 |
| QG-10 | `PARTIALLY_CONFIRMED` | 仅有 `catalog.sku-removal-blocked-by-inventory`,覆盖不到「每个 blocker 精确归属到相应 SKU」 |
| QG-11 | `CONFIRMED`(owner 侧) | `InventoryTargetCurrentReadback` record 已无 references/ledger 字段;`currentTyped` 不再调用二者。契约链下游我只抽验,未穷举 |
| QG-12 | `PARTIALLY_CONFIRMED` | SQL 语义正确(上节);**无任何业务场景断言**(见 S-1) |
| QG-13 | `CONFIRMED` | `edge-codegen --check` 现跑 PASS,FILES=253 |
| QG-14 | `CONFIRMED` | 静态 disposition;动态成效未授权,按约定不宣称 |
| QG-15 | `UNVERIFIED_REQUIRES_EVIDENCE` | 需 Java 侧门,本机跑不了 |

**QG-09 深验(他点名的头号攻击面)——`CONFIRMED`,确在预检阶段阻断,不是执行兜底:**

`ProductionTagOwnerService.preflightCopyCore` 第 813 行命中 `"VOIDED".equals(source.status())` 即
置 `firstBlocking = REFERENCE_MAPPING_UNRESOLVED`、写 `result: "BLOCKED"` / `reason: "来源标签已作废"`,
随即 `continue` —— **走不到第 830 行的目标 CREATE/REUSE 规划**。
第 781 行还把 VOIDED 排除出 `sourceCodes`,连目标 `tagsByCode` 都不为它发。
execute 侧第 591 行重跑 preflight、先抛 422 blocker,再校验 `productionPreflightDigest` 抛
`STALE_COPY_PREFLIGHT` 409,**两道都在任何写入之前**。missing / duplicate / scope / stale typed
failure 均保留;`tagsByRef`/`tagsByCode` 为集合读取,未退化为逐项。

---

## M-1 · 证据档位被抬高:「business PASS」无对应证据,且 acceptance 从未在本批代码上运行

**位置**:交接报告「QG-09 受管 Testcontainers:business PASS」「QG-12 受管 Testcontainers:business PASS」

**事实(亲验)**

被引用的两次 run 目录内容只有 `gradle.log`、`run-manifest.json`、`test-results`,
**没有 `backend-acceptance-result.jsonl`**。其 manifest 的 `task` 分别为
`:modules:fulfillment-production:test` 与 `:modules:inventory:test`,即**模块 Gradle test**。
manifest 顶层键为 schemaVersion/kind/runId/task/startedAt/remote/sourceSync/gradleDistribution/
logPath/testExecution/cleanup/status/firstFailure/resourcePreflight/completedAt ——
**不存在 business 键**,只有 `testExecution.status: PASS` 与 `cleanup.status: PASS`。

远端最近 10 次 run **全部**是模块 `:test` 任务,无一次 backend-acceptance。

最近一次真 backend-acceptance 证据为 `r5-tc-1786946718092-74348`,`startedAt`
2026-08-17T06:05:18Z,且其 jsonl 只有 **2 行**。以 epoch 统一口径比对本批源码:

- `CatalogAcceptanceScenarios.java` 2026-08-17T14:48:16Z(晚 8 小时)
- `InventoryOwnerService.java` 2026-08-17T16:35:10Z(晚 10 小时)
- `ProductionTagOwnerService.java` 2026-08-17T17:11:08Z(晚 11 小时)

**后果**:详设 §7 自订「不能用本地 Docker、裸 Gradle Testcontainers 或 `response.ok` 替代」,
而本批提交的正是裸 Gradle Testcontainers,并以 backend-acceptance 专用词汇「business PASS」表述。
CLAUDE.md 规定后台动态验收唯一能力是 `backend-acceptance`,产出分离的 `CONTRACT/BUSINESS`。
本批 30 条场景**一条都未在当前代码上执行过**。

**证据档位**:静态 + 模块编译/测试。**不构成 HTTP、business、DEV、L2、UAT 任何一档。**

**最小整改判据**:对当前代码树运行 `scripts/test/backend-acceptance` 受管远端 runner,
产出含 `backend-acceptance-result.jsonl` 的 run,报告 `CONTRACT`/`BUSINESS`/`cleanup` 三项,
且该 run 的 `startedAt` 晚于本批全部源码 mtime。在此之前不得使用「business PASS」表述。

## M-2 · 详设 §7 自订的完成条件未达成:一半 CP 无对应场景

**事实(逐条核 30 个场景 id)**

§7 表格点名要求的场景,当前源码中:

- ✅ `catalog.save-asset-reference-lifecycle`(QG-02)
- ✅ `org.store-state-and-derived-status`(QG-05)
- ✅ QG-11 以 `inventory.current-readback-separates-lazy-zones` 落地(改名,认可)
- ❌ `org.commercial-group-workspace-initialization`(QG-06)**不存在**
- ❌ `inventory-page-and-detail-readback`(QG-07/QG-08)**不存在**
- ❌ `inventory-consumption-reference-isolation`(QG-12)**不存在**
- ⚠️ QG-10 仅有 `catalog.sku-removal-blocked-by-inventory`,覆盖不到 §7 要求的
  「每个 blocker 精确归属到相应 SKU」与 catalog composite / stock_target / stock_bom 三类来源

30 条总数与交接报告一致(Asset 2 / Catalog 12 / Contract 3 / IAM 8 / Org 5),但**增量未落在
本批 CP 需要的位置上**。

**后果**:§7 明写「所有触及后端行为的 CP 都必须同时具备:模块 focused proof **与**真实
PostgreSQL Testcontainers 场景」。当前只有前半。这是详设自订的完成条件,不是外部追加要求。

**最小整改判据**:QG-06、QG-07/08、QG-12 各补一条含非空 `identity`/`fixture`/`request`/
`businessOracle` 的场景;QG-10 扩充到三类 blocker 来源的逐 SKU 归属断言。随 M-1 一并运行。

## S-1 · QG-12 是本批唯一改写分页查询谓词的地方,却零业务断言

QG-12 在 `references()` 中新增 `jsonb_path_exists` 预筛选,同时保留精确谓词。SQL 语义我已逐条
核过是安全超集,**但这是静态阅读**。cursor 翻页边界、`COUNT(*) OVER()` 的 total、跨 scope 隔离
在新谓词下的实际行为,没有任何动态证据。

它同时是最容易悄悄出错的一类改动:预筛选与精确谓词若在某种 `rows` 形状下不一致(例如
`targetRef` 为 JSON null 而 `componentTargetRef` 有值的组合),表现为**少几条引用**,
不报错、不红门,只在用户看引用区时少东西。

**最小整改判据**:`inventory-consumption-reference-isolation` 场景需覆盖 —— 当前 target、
同 scope 其他 target、跨 scope target、超过一页的引用集,断言条目集合、cursor、total 与隔离。

## N-1 · 死代码未清理

`InventoryOwnerService.ledgerReadbacks`(第 565 行)全仓仅剩自身定义,**零调用点**。
其返回类型 `InventoryLedgerEntryReadback` 在 owner 公共 API `InventoryOwnerApi` 第 179 行仍有
record 声明,而 `InventoryTargetCurrentReadback` 已不含该字段 —— 该类型在公共 API 上成为孤儿。

CLAUDE.md 架构原则:「优先删除过时代码,而不是增加兼容层」。
(`InventoryReferenceReadback` 已彻底清除,做法正确,ledger 侧照做即可。)

## N-2 · 本轮无法复核的项

本机无 Java 运行时,`./scripts/verify --validate-only` 在我这里因
`Unable to locate a Java Runtime` 于 `backend-archunit` 中止。**这是我的环境限制,不是缺陷**;
作者报告的 verify 15/15、`compileJava`/`compileTestJava` PASS、QG-15 的五个 CTE 显式列
一律记 `UNVERIFIED_REQUIRES_EVIDENCE`,需由能跑 Java 的一侧提供新鲜输出。

---

## 证据边界

| 档位 | 本轮取得 |
|---|---|
| 静态 node 门 | `catalog-inventory-query-envelope` 15/15、`edge-codegen --check` PASS FILES=253、`frontend-transport-cache-lifecycle` 4/4 —— **均为本会话现跑** |
| 源码亲验 | currentTyped、referenceReadbacks 删除、QG-12 SQL、QG-09 preflight VOIDED 序位、30 条场景 id |
| Java 编译/门 | **未取得**(本机无 Java) |
| backend-acceptance business | **未取得,且本批从未运行** |
| HTTP / DEV / L2 / UAT | 未取得,未授权,不得声称 |

## 范围越界

**未发现越界。** 未见 migration、新表/FK/read model、reset/seed/DEV 入口改动。
QG-12 在现有 `stock_bom.rows` 模型上完成,未物化反向关系 —— 与授权一致。

## QG-12 是否需要 Dexter decision

**不需要。** Codex 在现有模型内以 SQL 谓词下推解决,未触发新数据模型,`DEXTER_DECISION` 未发生。
但其完成度受 S-1 限制:**方案成立,验证不足**。

## 授权边界

本结论为静态 + 本机可跑门的独立复核。不授权修改代码、契约、生成物、迁移、DEV、reset、seed、
L2、UAT 或下一 Roadmap step。M-1 与 M-2 的整改判据是「补场景并真跑 backend-acceptance」,
不改变本批已完成的生产代码结论。
