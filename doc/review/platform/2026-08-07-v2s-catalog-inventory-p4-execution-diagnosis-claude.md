# P4 执行链路独立诊断（Claude）

诊断对象：`doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-execution-diagnosis-codex.md`
及其涉及的执行链路当前字节。

会话出处：fresh v2s-rooted 评审会话。本轮**只做静态与证据诊断**，
未启动任何 API、L2、DEV、seed、reset、数据库或部署动作。
唯一的运行时观察是只读的本机进程列举（§1.6）。

---

## 0. 结论

**NO-GO — M=2 / S=1 / N=1**

十小时被放大的根因不是单点，而是**三层叠加**，且三层互相掩盖：

1. `--catalog-l2-only` **仍然完整执行 100 条 API 用例**（M-01）——每次"只跑 L2"都在付全额 API 代价；
2. 四处 `ON CONFLICT` 在 PostgreSQL 上**必然报错**（M-02）——BOM 写入无论跑几次都不可能成功；
3. API 单条失败不中断，**一个根因被放大成最多 100 条失败记录**（S-01）——真因被噪声淹没。

三者叠加的效果是：每轮尝试都跑满全程、失败点被冲淡、而"独立性 checker 是绿的"给了错误的安全感。
**先修 M-01 与 M-02，第三层的噪声会自然减半以上。**

---

## 1. 六个核验点的独立结论

### ① `--catalog-l2-only` 仍执行 API —— `CONFIRMED`（与 Codex 结论一致，但成因更严重）

`scripts/test/r5-joint-remote-l2-fixture.mjs` 的调用顺序是：

- 第 457 行：`P4_CONTROL_RECONCILIATION_BEFORE_API_L2`
- 第 464 行：`command(... 'scripts/test/catalog-inventory-api.mjs')`，**没有任何 `catalogStage` 守卫**
- 第 484 行：`if (catalogStage === 'API') process.exit(0);` ——**API 跑完之后才退出**
- 第 488 行：L2 fixture
- 第 506 行：`if (catalogStage === 'L2') { writeCatalogOnlyPrivateEnvironment(); process.exit(0); }`

所以 `--catalog-l2-only`（`catalogStage='L2'`）的实际路径是
**对账 → 跑满 100 条 API → 建 L2 fixture → 退出**。API 一条都没少跑。

更需要指出的是父进程 `scripts/test/r5-joint-remote-l2.mjs` 第 346 行：
`phase('CATALOG_L2_ONLY', 'PASS', {seedRuntimeDependency: false, apiRuntimeDependency: false})`——
**`apiRuntimeDependency: false` 与事实相反**，这条 phase 记录会让后续读证据的人误判。

### ② 独立性 checker 无法拒绝该缺陷 —— `CONFIRMED`

`scripts/check/catalog-inventory-test-independence.mjs` 全文 76 行，全部是源码文本存在性断言。
与本缺陷相关的只有一条：
`requireText(fixture, "if (catalogStage === 'L2') {", 'L2_ONLY_TERMINATION_MISSING')`。
该字符串位于第 506 行，**在 API 调用之后**，与"L2 模式跳过 API"没有任何关系。
checker 从未断言 `catalog-inventory-api.mjs` 的调用点处于 stage 守卫内。

self-test 只有一个红变异——把 `label: 'CATALOG_INVENTORY_API'` 改成 L2 的 label，
触发 `COMBINED_STAGE_ORDER_NOT_API_THEN_L2`，测的是**联合模式的顺序**，不是**分层模式的跳过**。

我 fresh 复跑二者，均为绿：
`{"status":"PASS", ... "combinedOrder":"API_THEN_L2"}` 与
`CATALOG_INVENTORY_TEST_INDEPENDENCE_SELF_TEST=PASS / RED_MUTATION=ORDER_REJECTED`。
**门绿着而缺陷存在，这本身就是假绿的实证**，无需再构造变异。

Codex 在其诊断 §2.1 已如实写明"尚未检查 L2 分支是否实际跳过 API 调用"——这一点诚实，我确认属实。

### ③ `saveCatalogProductBom` 的 `ON CONFLICT` —— `PARTIALLY_CONFIRMED`，机制与提问前提不同

提问设定为"`ON CONFLICT DO UPDATE` 与 BOM identity/表达式唯一索引不匹配"。
**实际情况更基础**：我枚举了 `InventoryOwnerService` 的全部 5 处 `ON CONFLICT`，

- 第 123 行 `stock_target`：裸 `ON CONFLICT DO NOTHING` —— 合法；
- 第 317 行 `stock_target`：`ON CONFLICT (data_node_ref,brand_ref,item_code,sku_code) DO NOTHING`，
  而其唯一索引是 `ux_stock_target_identity (…, COALESCE(sku_code,''))`（V20260806 迁移）——
  **裸列清单无法推断表达式索引，PostgreSQL 报 42P10**；
- 第 356 / 391 / 411 行 `stock_bom`（分别在 `saveCatalogProductBom`、`copyLocalConfiguration`、
  `copyRewrittenBom`）：**裸 `ON CONFLICT DO UPDATE SET …`，完全没有推断目标**——
  PostgreSQL 报 `ON CONFLICT DO UPDATE requires inference specification or constraint name`（42601），
  这是语法层硬失败，**不是索引不匹配**。

我另检索了全部迁移：`stock_bom` 在整个历史中**唯一的 unique index 就是** V20260807 新建的
`ux_stock_bom_owner_identity (…, COALESCE(sku_code,''), COALESCE(option_value_code,''))`，
没有旧的列索引可供退化匹配。

**最小合法修复**：四处冲突目标改为与索引定义**逐字一致的表达式**：

- `stock_bom` ×3 → `ON CONFLICT (data_node_ref, brand_ref, item_code, COALESCE(sku_code, ''), COALESCE(option_value_code, ''))`
- `stock_target` ×1 → `ON CONFLICT (data_node_ref, brand_ref, item_code, COALESCE(sku_code, ''))`

**不要试图改用 `ON CONFLICT ON CONSTRAINT`**：`ux_stock_bom_owner_identity` 是 unique **index** 而非 constraint，
而 PostgreSQL 不允许在表达式上建 UNIQUE **constraint**，所以表达式推断是此处唯一可行写法。

### ④ API 失败后继续跑 100 case —— `CONFIRMED`

`scripts/test/catalog-inventory-api.mjs` 第 740–753 行的 `runCase` 捕获所有异常、
记 `status: 'FAIL'`、写日志后返回；第 756 行 `for (const entry of allCases)` 无条件继续。
**没有共享 fixture barrier，也没有 fail-fast。**

`firstFailure ??= …`（第 749 行）正确保留了首败，这一点在改造时必须保留。

**最小修复**：在共享 fixture 构造完成后加一个显式 barrier——
barrier 断言失败即写 `firstFailure`、跳过整个 case 循环、直接进入 cleanup 与报告；
逐 case 的 try/catch 保留给**真正的单例业务断言**，不再兼作基础设施失败的兜底。

### ⑤ API/L2 是否读 DEV seed 或对方 report —— `CONFIRMED` 未越界（我修正了自己的初判）

我先按文件名统计得到非零命中，逐条打开后确认**全部不是跨层读取**：

- 三个文件 import 的 `./seed-report.mjs` 只提供 generated operation registry 工具函数
  （`loadGeneratedOperationRegistry` 等），是**共享代码模块**，与 seed 运行报告无关；
- `catalog-inventory-api.mjs` 第 109 / 1090 行的 `catalog-inventory-api-runtime-report.json`
  是它**自己写出**的报告；
- `catalog-inventory-l2-test-fixture.mjs` 第 19 行同理是自己写出；
  L2 spec 第 28 行读的是**自己 fixture 产出的 sidecar**，属层内，不跨层。

关于 `seedDatasets`：`catalog-inventory-api.mjs` 第 346 行确实遍历 `fixtures.seedDatasets`，
但读的是 **fixture catalog 的静态定义**，随后经 owner HTTP 自建事实。
按 P4 范围登记中 Dexter 的追加裁决——「`consumerBindings` 仍可共享契约/场景定义，
但不再表示共享数据库状态」——**这属于允许范围**。
静态 fixture 中的 `seedDatasets` 确实只是定义，不是 runtime seed。

### ⑥ 最短可验收顺序 —— `CONFIRMED`，但有前置条件

提问给出的顺序（backend unit/contract → API-only HTTP → L2-only → DEV reset→seed，
每层分别记 business/cleanup）我认为正确，与 Dexter 的两链独立裁决一致。

**但它在 M-01 修好之前不成立**：当前 `--catalog-l2-only` 会跑 API，
"L2-only"这一层根本不独立。修 M-01 之后该顺序才真正可用。

### ⑦ 旧 run 的 cleanup 证据 —— `PARTIALLY_CONFIRMED` / 部分 `UNVERIFIED_REQUIRES_EVIDENCE`

我只做了只读观察：当前本机**没有残留的 playwright / vite / catering-business-server 进程**。
`scripts/test/r5-joint-remote-l2.mjs` 侧有 `pre-cleanup-local-evidence.json` 快照机制
（第 257–259 行）与 `cleanupFailures` 收集（第 361–374 行），结构上是齐的。

但**远端 namespace 的 cleanup 证据我未能核实**——本轮授权不含启动任何远端动作，
我也未在 `.runtime` 下找到可对账的 run-level business/cleanup 汇总。
因此：**本机进程无残留可以说；远端 namespace 清理不能宣称 PASS**，
该项应保持 `UNVERIFIED_REQUIRES_EVIDENCE`，待有授权的一次运行后按 run manifest 逐条对账。

---

## 2. Findings

### M-01｜`--catalog-l2-only` 完整执行 100 条 API，且 phase 记录声明与事实相反

- **章节/证据**：`scripts/test/r5-joint-remote-l2-fixture.mjs:464`（API 调用无守卫）、
  `:484`（API 之后才退出）、`scripts/test/r5-joint-remote-l2.mjs:346`
  （`CATALOG_L2_ONLY` 标记 `apiRuntimeDependency: false`）。
- **影响范围**：这是十小时放大的**首要来源**。每一次"只跑 L2"的迭代都完整支付了 API 的
  fixture 构造与 100 条用例的墙钟；在 M-02 导致 BOM 必失败的前提下，
  这段时间**全部是无效消耗**。同时 phase 记录的 `apiRuntimeDependency: false`
  会让证据读者误以为两层已解耦。
- **最小修复**：把第 464 行的 API 调用包进 `if (catalogStage !== 'L2') { … }`；
  同步修正父进程 `CATALOG_L2_ONLY` 的 phase 字段，使其反映真实依赖。
- **是否需 Dexter 裁决**：否。

### M-02｜四处 `ON CONFLICT` 在 PostgreSQL 上必然报错，BOM 写入不可能成功

- **章节/证据**：`InventoryOwnerService.java:356 / 391 / 411`（裸 `ON CONFLICT DO UPDATE`，
  缺推断目标，42601）、`:317`（裸列清单 vs 表达式索引，42P10）；
  索引定义见 `V20260807_100000_000__catalog_inventory_option_value_bom.sql`
  与 `V20260806_120000_000__catalog_inventory_backend.sql:86`。
- **影响范围**：`saveCatalogProductBom`、`copyLocalConfiguration`、`copyRewrittenBom`
  三条写路径全部不可用；凡触及 BOM 的 API 用例与 seed dataset 必失败，
  且失败发生在 owner SQL 层，错误信息不会指向业务原因——这正是"弯路"的来源。
- **最小修复**：见 §1.③ 的四条表达式冲突目标。改完建议补一条最小 focused 断言
  （对同一 identity 连续写两次，第二次应更新而非报错），否则同类回归无门可挡。
- **是否需 Dexter 裁决**：否。

### S-01｜API 无共享 fixture barrier 与 fail-fast，单一根因放大为最多 100 条失败

- **章节/证据**：`scripts/test/catalog-inventory-api.mjs:740–753`（`runCase` 全捕获）、
  `:756`（无条件遍历 `allCases`）。
- **影响范围**：噪声放大与墙钟浪费。在 M-02 存在时，一个 SQL 缺陷会产出大批
  互相无关的 case 失败，掩盖首败；`firstFailure` 虽保留了第一条，
  但报告里其余数十条会诱导逐条排查。
- **最小修复**：共享 fixture 之后加显式 barrier，barrier 失败即 fail-fast、
  跳过 case 循环、仍写 `firstFailure` 并正常进入 cleanup 与报告。
  **保留** `firstFailure ??=` 语义与 cleanup 分账。
- **是否需 Dexter 裁决**：否。

### N-01｜共享工具模块名为 `seed-report.mjs`，易被误读为 seed 运行时依赖

- **章节/证据**：`catalog-inventory-api.mjs:15`、`catalog-inventory-l2-test-fixture.mjs:12`
  从 `./seed-report.mjs` 导入 generated operation registry 工具。
- **影响范围**：不构成越界（我已确认它不读任何 seed 运行报告），
  但它使"API/L2 是否依赖 seed"这一判断每次都需要打开文件确认；
  独立性 checker 里 `forbidText(…, 'seed-report.json', …)` 与该模块名仅一字之差，
  日后极易写错或误判。
- **最小修复**：把该模块更名为能力名（如 `generated-operation-registry.mjs`），
  或至少在独立性 checker 中加一条注释说明二者区别。
- **是否需 Dexter 裁决**：否。

---

## 3. 对 Codex 诊断结论的独立判定

- 「`--catalog-l2-only` 仍执行 API」：`CONFIRMED`。
- 「独立性 checker 尚未检查 L2 分支是否实际跳过 API」：`CONFIRMED`，且我补充了它连红变异也不覆盖该维度。
- 「`saveCatalogProductBom` 的 `ON CONFLICT DO UPDATE` 是真实 owner SQL 首败」：
  `PARTIALLY_CONFIRMED`——是首败，但成因是**缺推断目标**而非索引不匹配，
  且同族缺陷共有四处（含 `stock_target` 一处），不止 BOM。
- 「API/L2 不读 DEV seed 或对方 report」：`CONFIRMED`。
- 「catalog seed 是独立的最终 DEV 动作、不是 API/L2 前置」：`CONFIRMED`，与 Dexter 裁决一致。
- 「远端 namespace cleanup 已清理」：`UNVERIFIED_REQUIRES_EVIDENCE`——不得宣称 PASS。

## 4. 建议的最短收敛路径

按依赖顺序，前两步是解锁性的，做完再跑第一次完整验收：

1. 修 M-02（四处冲突目标）——不修则任何 BOM 相关运行都不可能绿；
2. 修 M-01（L2 分支跳过 API）+ 修正 phase 字段——不修则每轮迭代仍付全额 API 代价；
3. 修 S-01（barrier + fail-fast）——让下一次失败在几分钟内暴露真因而不是几小时；
4. 补两条门：独立性 checker 断言"API 调用点在 stage 守卫内"并配删守卫必红的变异；
   BOM upsert 的重复写 focused 断言；
5. 然后再按 backend unit → API-only → L2-only → DEV reset/seed 逐层跑，每层分别记 business/cleanup。

前三步都是小改动，但顺序不能颠倒：先修 SQL 再修分层，否则分层修好了仍然全红。

## 5. 授权边界

本轮只做静态与证据诊断，未启动任何 API、L2、DEV、seed、reset、数据库或部署动作。
本文不构成新的运行授权；后续修复与运行仍按 Dexter 已授予的 P4 范围执行。
M-01、M-02、S-01、N-01 均为既有批准边界内的实现修复，不需要 Dexter 裁决。
远端 namespace cleanup 在取得对账证据前，**不得在任何 evidence 中标为 PASS**。
