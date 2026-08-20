# QG-01～QG-15 实施 · 第二轮独立复核(整改后)

- 日期:2026-08-18 · 评审:Claude · 会话:续接(非 fresh,已声明)
- 前轮:`doc/review/platform/2026-08-18-v2s-query-granularity-implementation-review-claude.md`(NO-GO · M=2 · S=1 · N=2)
- 结论:**GO** · **M=0 · S=0 · N=1**

---

## 0 · 上轮三条阻断是否真关闭

### M-1(证据档位被抬高 + acceptance 从未在本批代码上跑)—— **已关闭**

`r5-tc-1787016898822-83594` 是真 backend-acceptance run,与上轮被驳回的两次有本质区别:

| | 上轮被驳回的两次 | 本次 |
|---|---|---|
| `backend-acceptance-result.jsonl` | **无** | **有** |
| `http-request-events.jsonl` | 无 | **有** |
| `task` | `:modules:inventory:test` / `:modules:fulfillment-production:test` | `:apps:backend:catering-business-server:test` |
| business verdict | manifest 无该键 | 33 条逐条 `contract`/`business` |

亲验 jsonl:34 行 = 1 行 discovery(`discovered:33, selected:33`)+ 33 条场景。
**CONTRACT 非 PASS:0 条;BUSINESS 非 PASS:0 条**;`businessMode` 唯一取值 `REAL`;
`businessAssertion` 唯一取值 `HAND_WRITTEN_BUSINESS_ORACLE`。
模块分布 ASSET 2 / CATALOG 14 / CONTRACT 3 / IAM 8 / ORG 6 = 33。

**时序**(epoch 统一口径):run `startedAt` 2026-08-18T01:34:58Z;本批最新改动源码
`OrganizationAcceptanceScenarios.java` 2026-08-18T01:31:28Z。**run 晚于全部改动 3 分钟。**

附带解除上轮 N-2:远端 Gradle test 任务成功执行本身即证明 `compileJava`/`compileTestJava` 通过,
本机无 Java 不再构成该项未验。

### M-2(§7 自订完成条件未达成)—— **已关闭**

上轮点名缺失的三条已存在并真跑通过,QG-10 已按要求扩充:

| CP | 场景 | 本次结果 |
|---|---|---|
| QG-06 | `org.commercial-group-workspace-initialization` | PASS / PASS |
| QG-07+08 | `inventory-page-and-detail-readback` | PASS / PASS |
| QG-12 | `inventory-consumption-reference-isolation` | PASS / PASS |
| QG-11 | `inventory.current-readback-separates-lazy-zones` | PASS / PASS |
| QG-10 | `catalog.sku-removal-blocked-by-inventory`(扩充至 11986 字符) | PASS / PASS |

QG-10 三类 blocker 逐条核过:**stock_target**(断言 detail 含「库存对象」)、
**catalog composite**(`composite` 53 处,含独立 fixture 与 owner item)、**BOM**(`bom` 17 / `BOM` 6)。
逐 SKU 归属有两条明文断言:「blocker is attributable to the requested SKU ref」
「blocker identifies its owning source」。
⚠️ `stock_bom` 字面量为 0 是**正确行为**,场景恰恰断言拒绝信息不得泄露 schema 与列名。

### S-1(QG-12 零业务断言)—— **已关闭**

`inventory-consumption-reference-isolation` 的 BUSINESS 断言覆盖 Codex 点 5 要求的全部六项:
source A/B/C 真实创建 · 同 scope 干扰项 · 「total excludes other scopes and targets」·
「reference endpoint enforces one-entry pages」· 「cursor pages do not repeat a reference entry」·
「current target returns all matching row shapes and no same/cross-scope distractor」。

### N-1(ledger 死代码)—— **已关闭**

`ledgerReadbacks` 与 `InventoryLedgerEntryReadback` 全仓 **零命中**,方法与孤儿类型均已删除。

---

## 1 · 重点核验九条逐项结论

| # | 事项 | 结论 | 依据 |
|---|---|---|---|
| 1 | raw catalog digest 在原地修改前保存并传给 owner | `CONFIRMED` | 见下 |
| 2 | 临时 digest 调试代码删除、stale 恢复正式错误码 | `CONFIRMED` | catalog 主源无 `System.out`/`printStackTrace`/`TODO_DEBUG`/`TEMP_`;`STALE_COPY_PREFLIGHT` 在 coordinator 第 268/379 行与 owner 第 1489/1756/1772/2098/4099 行为正式抛出,测试同步断言 |
| 3 | QG-06/07/08/12 场景真实四要素 | `CONFIRMED` | 33 条全部 `HAND_WRITTEN_BUSINESS_ORACLE` + `businessMode=REAL`,非 stub |
| 4 | QG-10 三类来源 + 精确 SKU 归属 | `CONFIRMED` | 见 M-2 段 |
| 5 | QG-12 六项覆盖 | `CONFIRMED` | 见 S-1 段 |
| 6 | ledger 死 API 删除且无残留消费者 | `CONFIRMED` | 全仓零命中 |
| 7 | QG-13/14 不得把静态说成运行期 | `CONFIRMED` | 交接未作此声称;`http-request-events.jsonl` 是 acceptance 自身 HTTP,**不构成** RTK/浏览器请求集证据,边界维持 |
| 8 | QG-0.5 currentTyped 固定开销仍记为本轮不做 | `CONFIRMED` | `currentTyped` 仍为 target 1 + `changePeriodReadback` 3 + `recentChangeReadbacks` 1;未合并,亦未误报关闭 |
| 9 | Testcontainers 重复失败升级诊断的记忆规则 | `CONFIRMED` | `project-memory/pitfalls/log-first-failure-retry.md` 载 `TESTCONTAINERS_REPEAT_FAILURE_ESCALATES_TO_STRUCTURED_DIAGNOSTICS`,含两次上限、第三次前加可关联诊断、根因后最小修复再撤诊断,并禁止以重跑/延时/轮询/改响应码/吞错替代 |

**第 1 条的行级依据**:`mergeCopyPreflight` 第 974 行 `data.put("preflightDigest", combined)`
确为**原地覆盖**入参。两条执行路径都在覆盖前取值:

- local:第 265–266 行取 `catalogDigest` → 第 270 行 merge → 传给 `catalog.executeLocalCopy` 的是原始值
- brand:第 375–376 行取 `catalogDigest` → 第 381 行 merge → 传给 `catalog.executeBrandCopy` 的是原始值

**同根扫描已做**:`mergeCopyPreflight` 四个调用点(第 246/269/347/381 行)全部核过,
两条 preflight 路径的 `combined` 亦在 merge 前独立计算。**未发现同族问题。**

## 2 · 主动排查项(非交接点名)

**`failForManagedTestPoint`(coordinator 第 400 行调用 / 第 1648 行定义)—— 非本批残留,不计。**
双重门控:request 的 `testFailurePoint` 等于 `"owner-failure"` **且** 环境变量
`V2S_CATALOG_TEST_FAULTS` 为 `true` 才抛 `RESULT_UNKNOWN`。
`V2S_CATALOG_TEST_FAULTS` 在 `contracts/policy/runtime-environment-keys.json` 第 9 行**已登记**;
`scripts/dev/r5-dev-runner.mjs` 第 244–250 行校验该 flag 且默认传 `'false'`;
`testFailurePoint` 是契约级 operation 参数,由 `scripts/generate/catalog-inventory-p1.mjs` 的
CI-API-022 用于验证 owner failure 的 `RESULT_UNKNOWN`。属受控测试缝,非夹带调试代码。

**QG-15 补验(上轮 `UNVERIFIED`)—— `CONFIRMED`。**
`OrganizationOverviewTaskReadService` 中 `SELECT *` / `item.*` / `target.*` **零命中**;
四个 task-read 方法(第 137/383/441/494 行)均在;`MATERIALIZED` 保留。

## N-1 · 每场景 DB 调用数首次进入在册证据(note,非缺陷)

本次 jsonl 逐场景记录 `dbOperations`(区间 4–38)。按 CLAUDE.md 这是**不设门的诊断打印**,
本轮不作任何通过条件,交接也未据此声称成效 —— 处理正确。

值得登记的是:这是 2026-08-13 裁定「`QUERY/次` 必须单独 disposition」以来**第一批在册的读取次数数据**,
是将来重启「共享读管线固定开销」disposition 时的原材料。

⚠️ **不可直接对照那条裁定的「7–10 条 SQL 读一个条目」**:acceptance 场景是多步业务流
(创建 + 保存 + 读取 + 拒绝路径),`dbOperations` 是整场景累计,不是单次读取计数。
要回答那个问题仍需针对单个 GET 的定向测量。

---

## 证据边界

| 档位 | 本轮 |
|---|---|
| 真实容器 + 真实 HTTP business | **已取得**:33/33 CONTRACT+BUSINESS PASS,`REAL`,cleanup PASS,run 晚于全部改动 |
| Java 编译 | **已间接取得**:远端 Gradle test 任务成功执行 |
| 源码亲验 | digest 次序(两路)、`mergeCopyPreflight` 原地语义、QG-10/QG-12 场景断言、QG-15 投影、死代码清除、测试缝登记 |
| 浏览器 L2 / UAT / RTK 请求集 | **未取得,未授权,不得声称** |

## 范围越界

**未发现。** 未见 migration、新表/FK/新 read model、reset/seed/DEV 入口改动。

## 授权边界

本结论覆盖 QG-01～QG-15 当前实施的独立复核。**不授权**下一 Roadmap step、DEV、浏览器 L2、UAT
或范围扩展。`GO` 表示本批交付达成其自订完成条件,不表示对未来批次的任何授权。
