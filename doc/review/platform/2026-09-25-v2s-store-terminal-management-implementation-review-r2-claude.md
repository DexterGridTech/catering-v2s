# 门店终端管理 · 实施结果评审 第 2 轮（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
SESSION_PROVENANCE=续接会话（非 fresh v2s-rooted）；Claude 主会话评审，不是独立子 agent；本会话同时是需求正本作者、两轮设计评审方与第 1 轮实施评审方
EVIDENCE_TIER=静态只读：以第 1 轮与本轮 L2 的字节绑定逐文件求出改动全集，读取源码、契约、生成物、测试与 .runtime 已落盘产物；未运行任何命令
AUTHORIZATION=本评审不授权生产部署、UAT、真实设备激活、真实打印或 TDP
```

## 1 · 结论先行

第 1 轮的 5 条 S、5 条 N 全部修好，修法也对。动态证据这次都对应当前代码。本轮只剩一条新问题：本批顺带把商品库存的契约链和全局性能校准基线一起改了，并放宽了一个商品域接口的预算，对账没有披露。这一条需要 Dexter 拍板。

## 2 · 本轮改动全集与动态证据

**改动全集**：
- `apps` 下共 17 个文件：用第 1 轮 L2（00:55Z）与本轮 L2（04:00Z）的字节绑定逐文件对比得出，全部属于第 1 轮 findings 的修复范围。
- `apps` 之外有 63 个文件在本轮被写入（按修改时间）。其中约 35 个属于商品库存契约链，见 S-1。

**动态证据（逐项核对为当前字节）**：
- **Browser L2**：2026-09-25T04:00Z 完整六场景，business 与 cleanup 均 PASS；当前代码与其绑定的 1925 个文件逐字节一致，之后没有新运行。本轮 L2 都是先聚焦跑「编辑配置」、再跑完整六场景，共 3 轮，零失败。
- **seed**：2026-09-25T03:41Z 完整 seed PASS，终端后置步骤为 8 台建立、8 台详情读回、7 台列表读回。之后只改了前端 model 及其测试，这些改动已由 04:00Z 的 L2 覆盖。
  - 此前两次 seed 在 owner 阶段以同一失败码失败；第二次之后停下修复共享 seed 客户端，第三次通过，符合失败族规则。
- **后台验收**：2026-09-25T03:25Z PASS；之后后端没有改动。

## 3 · 第 1 轮 findings 的逐条核验

- **S-1 已修**：
  - 编辑与状态变更改用 `createContentIdempotencyKey`（`features/store-terminal/model/storeTerminalCommands.ts`）；
  - 新建时，留空激活码也用内容派生键，手填码用意图键，并在详设第 53 行以 `MANUAL_ACTIVATION_CODE_IDEMPOTENCY_EXCEPTION` 登记了 §3-G 例外；
  - 前端伪造的服务端问题对象已全部移除，改用本地 `LocalDrawerNotice`；
  - 「结果未知」「恢复中」两个状态已删除。
- **S-2 已修**：`StoreTerminalDetail.tsx` 第 132 行改用 foundation 的 `AdminDetailActionMenu`。
- **S-3 已修**：
  - 基础输入错误拆成 `InvalidTerminalInputException`，映射为 400 `PLATFORM_COMMON_VALIDATION_FAILED`，坏游标也在内；只有规则违反仍报 `STORE_TERMINAL_RULE_INVALID`（`ContractProblemAdvice.java` 第 722 至 755 行）；
  - 停用门店改走 `PLATFORM_COMMON_ACCESS_DENIED`；
  - 验收新增坏游标用例（`StoreTerminalAcceptanceScenarios.java` 第 178 至 187 行），版本冲突只断言一个码，停用门店断言精确的 404。
- **S-4 已修（上一轮点名的 4 个文件）**：3 份边缘目录与 `safeLogger.ts` 已纳入本轮增量对账；§7 逐个 operation 对账了声明码与实际发码；死分支已删除。但本轮又出现同根遗漏，见 S-1。
- **S-5 已修**：运行器通过 `L2_SUITE_CONFIGS` 的准入策略，对所有套件执行准入与失败族检查（`browser-l2-runtime.mjs` 第 200 至 208 行、第 8310 行）；商品库存、销售菜单各有策略文件。实现方式见 N-1。
- **N-1 至 N-5 已修**：
  - 审计摘要改为中文标签与名称；
  - 前端的功能键、范围键字面量清零，改用生成的 `STORE_TERMINAL_RANGE_KEYS`；后端的范围键字面量也已清零；
  - 按报错文字判断流程的写法与自造错误码已删除；
  - 五个 seed 执行器共用 `scripts/dev/seed-http-client.mjs`，正式执行器不再使用 `invocationKeyForTest`；
  - seed 角色：`role-group`、`role-project` 可看可改，`role-store` 只读，并与 `GROUP_SEED_CAPABILITIES`、`r5-seed-plan.mjs` 的断言同步。

## 4 · Findings

### S-1 · 本批顺带重建了全局性能校准基线，放宽了一个商品域接口的预算，对账没有披露（CONFIRMED；变化发生的具体时间点 UNVERIFIED_REQUIRES_EVIDENCE；需 Dexter 裁决）

**仓内事实**：

1. **基线被更换**：`contracts/policy/backend-performance-cp05-calibration-report.json` 在 2026-09-24T09:33Z（本批实施期间）被整体改写，相对已提交版本约 3.5 万行新增。

   | | 已提交版本 | 当前版本 |
   |---|---|---|
   | 运行次数 | 1 | 3 |
   | 接口数 | 286 | 293（多出的 7 个是终端接口） |
   | 授权 | 带 `DEXTER-2026-08-26-CURRENT_PROGRAM_RESULT_BUDGET` | 无授权编号，状态为 `NOT_YET_AUTHORIZED_BY_CP05;CP02_REQUIRES_REMEDIATED_SHAPE` |

2. **一个商品域接口的预算被放宽**：2026-09-25T02:58Z，本轮有一次生成把商品库存契约链约 35 个文件重写了一遍，范围包括 `contracts/catalog/*`、`catalog-inventory.openapi.json`、`production-tag-management.paths.json` 等 7 份 paths 文件，以及商品库存的 fixture 与 L2 策略。
   - 在已提交契约与当前契约之间，57 个带数据库预算的接口中只有一个被抬高：`transitionOperationsProductionTagStatus`（生产标签状态流转）从 7 次改为 9 次。
   - 说明文字随之从「current managed acceptance program maximum」变为「CP-05 maximum database operation count across three runs」。
3. **详设没有委托**：详设只写了「新增 operation budget 必须同步」（第 245 行），没有委托重跑全量校准、更换授权基线或放宽既有接口的预算。
4. **对账没有覆盖**：上述文件都不在本轮对账的 45 个增量文件里，对账正文也没有提到。这与第 1 轮 S-4 同根：分母不是「本轮实际写过的文件」。

**影响**：
- 性能预算是 run 级校验仍在生效的护栏。门店终端只读取生产标签，不应让标签自身的状态流转多出 2 次数据库操作；这个增量是代码变化还是测量波动，目前无人说明。
- 以本批的三次校准替换 Dexter 2026-08-26 的当期基线，属于性能基线的授权变更，不是门店终端功能的一部分。

**最小根因修复**：
1. 在对账中说明两件事：02:58Z 写入商品库存契约链的是哪条命令；本轮是否真的改变了这些文件的内容。
2. 对生产标签状态流转多出的 2 次数据库操作给出证据：新增了哪些 SQL，或者证明是测量波动。
3. 把校准报告与 35 个商品库存文件列入对账分母。
4. 请 Dexter 在两者中择一：接受以本批三次校准作为新的性能基线；或恢复已授权基线，只为 7 个新终端接口补预算。

**评审方自述**：校准报告在第 1 轮评审时就已改写，是我第 1 轮只比对了 `apps` 下的字节绑定而漏看的。

### N-1 · 门店终端的 L2 准入模块另写了一套，没有复用通用实现（CONFIRMED）

- 商品库存与销售菜单的准入各只有 19 行配置，调用 `scripts/test/l2-suite-admission.mjs` 的 `createL2SuiteAdmissionStrategy`。
- `scripts/test/store-terminal-l2-admission.mjs` 却有 190 行自有实现：第 23 至 70 行读文件、算摘要、校验用例集，第 135 至 175 行查失败族。
- 同一道门两份实现，以后修通用版时终端版不会跟着变。

**最小修复**：终端改为调用 `createL2SuiteAdmissionStrategy`，把 fixture 这类用例来源作为配置传入。需 Dexter 裁决：否。

### N-2 · IA 与实际行为不一致：停用门店是 404，不是 403

- IA 错误语义表把停用门店列在「既有 HTTP 403」下（`doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` 第 133 行一带）。
- 实现与验收都是 404（`StoreTerminalAcceptanceScenarios.java` 第 1328 至 1349 行），与其他门店级页面的范围边界一致。

**最小修复**：把 IA 这一行改为 404。需 Dexter 裁决：否。

## 5 · 同族全集扫描

- **S-1**：
  - 已提交与当前契约间，57 个带预算的接口逐一比较，只有 1 个被抬高、0 个被调低；
  - 本轮写入但未进对账的文件共 36 个：商品库存契约链约 35 个，另加校准报告；
  - 本轮还写入了两份 TER 设计文档（`2026-09-25-ter-package-layout-cleanup-*`），它们属于另一批次，不计入本批。
- **N-1**：3 个套件中只有门店终端是自有实现。

## 6 · 未验证清单

- 商品库存契约链的内容变化，是否发生在本轮（仅有修改时间证据）。
- 生产标签状态流转多出 2 次数据库操作的原因。
- 具体型号（例如 Epson TM-T88VII）允许的连接方式，是否有厂商资料支撑（第 1 轮遗留）。
- 「结果未知」后的恢复路径，L2 没有覆盖。

## 7 · 结论

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/1/2
L1_ENGINEERING=findings：S-1（校准基线被更换、商品域预算放宽、对账分母再次遗漏）
L2_USER_VISIBLE=PASS（详情操作菜单改用 foundation；不再伪造服务端问题；文案与 IA 一致）；另有 N-2 属文档
L3_UNVERIFIED=见 §6
SAME_ROOT_SCAN=见 §5
DESIGN_GAPS=预算系统在新增接口时会重测全部接口，并可能改变既有预算；这类基线更换应有明确的授权与披露步骤，目前没有正本规定
EVIDENCE_TIER=静态只读 + 已落盘运行产物（L2 字节绑定逐文件复核）
```

门店终端这个功能本身已达到交付标准：第 1 轮的 10 条全部修好，动态证据对应当前代码，本轮的动态执行也按规则走了。唯一的阻断是 S-1，它不是终端功能缺陷，而是性能基线被顺带更换且未披露；Dexter 在 S-1 第 4 点做出选择、Codex 补上说明与证据后即可收口。

本评审只是静态实施评审，不授权生产部署、UAT、真实设备激活、真实打印或 TDP。本会话是续接会话，由 Claude 主会话评审，不是独立子 agent。
