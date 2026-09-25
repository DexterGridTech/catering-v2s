# Claude 评审交接

REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=IMPLEMENTATION
REVIEW_CYCLE_ID=V2S_STORE_TERMINAL_IMPLEMENTATION_20260924
REVIEW_ROUND=N
REVIEWER_KIND=CLAUDE_REVIEW_AFTER_BASELINE_RECONCILIATION

## 背景

本轮承接 `doc/review/platform/2026-09-25-v2s-store-terminal-management-implementation-review-r2-claude.md` 的
`NO-GO / M/S/N=0/1/2`。N-1（L2 准入实现重复）与 N-2（停用门店 IA 状态码）已修复并由 fresh
独立只读复核确认；本轮只复核这两项的当前字节处置，以及上一轮 S-1 的性能基线、商品目录/库存
契约生成链和对账分母。

Dexter 已授权 Codex 按长期可追溯方向选择并实施基线。当前选择是 A：采用三次受管运行的
`293` operation exact-set、逐 operation 取最大值、不取平均值；不猜造无法从当前字节恢复的
`286` 报告；保留生产标签作废引用保护分支的真实 `9` 次预算。决定引用为
`DEXTER-2026-09-25-V2S-STORE-TERMINAL-CP05-BASELINE-293`，已落在
`doc/decisions/2026-09-25-v2s-store-terminal-cp05-baseline-293.md`。

当前只完成静态/生成链核验，没有因本轮修复新增 Browser L2、backend-acceptance、reset、DEV 或
seed 动态运行。旧动态 evidence 不得被升级为当前字节的新增 PASS。Heritage materialize 因当前
工作区缺少 `../catering-all-v2/contracts/openapi/platform-admin-edge.openapi.yaml` 而单独失败；
全量 `scripts/verify --validate-only` 首败为既有 7 个 Java UTF-8 行宽文件并报告 SQL 构造 OPEN，
未以本轮基线修复掩盖。

## 评审目标

请独立复核：

1. S-1：293/三次运行基线是否有真实、完整、可重放的证据；`transitionOperationsProductionTagStatus`
   的 7→9 是否确由 VOIDED 引用保护分支新增两次权威读取，而非测量波动；当前预算是否只通过报告
   与明确决定引用进入生成链；报告与商品目录/库存契约、edge generated outputs 的对账分母是否完整。
2. N-1：终端 admission 是否只声明 suite 配置并复用共享 strategy，且所有套件均走共享准入与失败族门。
3. N-2：停用门店在 IA 中是否为 HTTP 404，403 是否只保留权限/页面访问拒绝。
4. 机器约束是否真正阻断无决定引用的三次报告，是否保留单次 current-program result 的既有语义且不混用。

## 需阅读文件

请从仓库根打开：

- `doc/review/platform/2026-09-25-v2s-store-terminal-management-implementation-reconciliation-r3-codex.md`：当前字节对账、基线选择、37 项 S-1 分母与静态/动态证据边界；
- `doc/decisions/2026-09-25-v2s-store-terminal-cp05-baseline-293.md`：本轮基线决定、三次 run digest 与 293/9 的理由；
- `scripts/test/backend-performance-cp05-reclassification.mjs`：三次重分类命令的 `--baseline-decision-ref` 要求及报告写入；
- `scripts/generate/backend-performance-budget.mjs`：三次报告消费前的 `baselineDecisionRef` 校验与单次 current-program 分支；
- `scripts/test/backend-performance-budget.test.mjs`：缺决定引用的真实 red test 与既有预算校验；
- `contracts/policy/backend-performance-cp05-calibration-report.json`：唯一 build-time budget input、三次来源、293 exact-set、replay digest 与 operation maxima；
- `scripts/generate/catalog-inventory-p1.mjs`：36 个商品目录/库存契约、fixture、scenario 与 manifest 生成住址；
- `tools/catalog-inventory-p1/cli.mjs`：P1 静态闭合检查；
- `scripts/generate/edge-codegen.mjs`：429 个 edge generated outputs 的唯一生成/检查入口；
- `scripts/test/l2-suite-admission.mjs`、`scripts/test/store-terminal-l2-admission.mjs`、`scripts/test/browser-l2-runtime.mjs`：N-1 共享 suite 准入与失败族边界；
- `scripts/test/l2-suite-admission.test.mjs`、`scripts/test/store-terminal-l2-admission.test.mjs`：当前 6/6 focused admission tests；当前 fresh admission digest 为 `4ef6b254aba32a131a19ff7738a3aa2f17e4a1e9ef2312d5421b1373e75f8d36`，独立记录见 `doc/review/platform/2026-09-25-v2s-store-terminal-l2-admission-review-codex.md`；
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` 第 129–140 行：N-2 停用门店 HTTP 语义；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/TransitionOperationsProductionTagStatusOperation.java` 第 44–57 行：作废引用保护的 owning source；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790242049278-98426`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790241202555-53818`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790241588769-69115`：三次 CP-05 受管来源；
- `.runtime/browser-l2/l2-1790308744297-70522-56d5fd5a-efe6-4874-bdd4-e4678c6206ab/l2-execution-manifest.json`：最后一次动态 L2 evidence，仅作历史证据并核对其与当前字节不一致边界。

## 独立核验重点

- 复算三次 run 的 manifest/events digest、293/293 exact-set、`business=PASS` 与 `cleanup=PASS`，并核对报告 `replayIdentity.contentDigest=06138adb5cb2b1d478eda213534474ac0182076e4a78220e52cc9aac7f18b065`。
- 逐代码核对 293 基线决定、报告字段、校验器、重分类 CLI、P1 生成器和 edge-codegen 的单一住址；特别确认不能仅改 `expectedOperations`、预算数字或 `generatedAt` 绕过决定引用。
- 独立验证缺 `budget.baselineDecisionRef` 的三次报告会失败，且单次 `CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF` 路径没有被三次规则污染。
- 复核 S-1 对账分母至少包含校准报告、P1 生成闭集 36 个文件以及 edge-codegen 的 429 输出闭集；若认为“实际内容变化”仍缺证据，请明确指出缺口，不以 `--check` 通过替代逐文件对账。
- 复核 `transitionOperationsProductionTagStatus` 的正常 7 次与 VOIDED 引用保护 9 次是否对应当前 owning source 的两次事实读取，并判断保留 9 是否为业务正确性所必需。
- 复核 N-1 的策略工厂、`screens[].caseId` 分母、所有套件的 admission/failure-family 调用与 focused red cases；复核 N-2 的 404/403 文字与实现、验收是否一致。
- 单列动态边界：本轮没有新增 L2、backend-acceptance、reset、DEV、seed；Heritage materialize 缺输入和全量 verify 的既有 OPEN 不得被写成 PASS，也不应无证据归咎于本轮基线修改。

## 期望结论

请给出明确的 `VERDICT=GO` 或 `VERDICT=NO-GO`，并报告 `M`、`S`、`N` 三档数量。

每条 finding 请标明 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DESIGN_GAPS`，带仓库相对路径与第 X 行、影响、最小修复，
并说明是否需要 Dexter 产品/范围裁决。若对账分母或动态证据仍不足，请优先指出证据闭合缺口，
不要用旧动态 evidence 代替当前字节证明。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对「门店终端管理」实施结果第 3 轮做独立 REVIEW_TARGET=IMPLEMENTATION。

背景：上一轮结论是 NO-GO，M/S/N=0/1/2。N-1（终端 L2 admission 自建逻辑）与 N-2（停用门店 IA 状态码）已修复；本轮只请复核这两项的当前字节处置，以及上一轮 S-1 的 CP-05 性能基线、商品目录/库存契约生成链和对账分母。

目标：独立核验 293/三次运行基线决定与机器门、商品目录/库存及 edge 生成链、N-1 共享准入、N-2 404/403 语义，并区分当前静态结果与未新增的动态 evidence。

Dexter 已授权我按长期可追溯方向选择并实施基线。我选择 A：接受三次受管运行的 293 operation exact-set，逐 operation 取最大值，不取平均值；不猜造当前字节无法恢复的 286 报告；保留生产标签作废引用保护分支的真实 9 次预算。决定文件是 `doc/decisions/2026-09-25-v2s-store-terminal-cp05-baseline-293.md`，decisionRef 是 `DEXTER-2026-09-25-V2S-STORE-TERMINAL-CP05-BASELINE-293`。

请从仓库根阅读：
- `doc/review/platform/2026-09-25-v2s-store-terminal-management-implementation-reconciliation-r3-codex.md`：当前字节对账和证据边界；
- `doc/decisions/2026-09-25-v2s-store-terminal-cp05-baseline-293.md`：基线决定与 run digest；
- `scripts/test/backend-performance-cp05-reclassification.mjs`、`scripts/generate/backend-performance-budget.mjs`：三次报告生成与消费校验；
- `scripts/test/backend-performance-budget.test.mjs`：缺 decisionRef 的 red test；
- `contracts/policy/backend-performance-cp05-calibration-report.json`：293 exact-set、三次来源、9 次 transition 与 replay digest；
- `scripts/generate/catalog-inventory-p1.mjs`、`tools/catalog-inventory-p1/cli.mjs`、`scripts/generate/edge-codegen.mjs`：单一生成/检查链；
- `scripts/test/l2-suite-admission.mjs`、`scripts/test/store-terminal-l2-admission.mjs`、`scripts/test/browser-l2-runtime.mjs` 及两份 admission test：N-1 共享准入；
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md:129-140`：N-2 404/403 语义；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/TransitionOperationsProductionTagStatusOperation.java:44-57`：生产标签作废引用保护；
- 三个 CP-05 来源目录：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790242049278-98426`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790241202555-53818`、`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790241588769-69115`。

请重点核验：三次 run 的 manifest/events digest、293/293 exact-set、business/cleanup PASS、报告 replay digest；`budget.baselineDecisionRef` 是否成为三次报告的强制机器门；P1 36 文件闭集与 edge-codegen 429 输出是否都进入实际对账分母；transition 的 7→9 是否确是 VOIDED 引用保护新增两次事实读取；N-1 是否所有套件都经过共享 admission/failure-family 策略；N-2 是否停用门店为 404、403 只用于权限拒绝。

本轮没有新增 Browser L2、backend-acceptance、reset、DEV 或 seed 动态运行。最后一次动态 L2 是 `l2-1790308744297-70522-56d5fd5a-efe6-4874-bdd4-e4678c6206ab`，与当前字节不一致；Heritage materialize 因当前工作区缺少 `../catering-all-v2/contracts/openapi/platform-admin-edge.openapi.yaml` 未通过；全量 `scripts/verify --validate-only` 另有既有行宽和 SQL 构造 OPEN。请把这些分别报告，不要升格成当前动态 PASS，也不要把与本轮无关的既有 OPEN 误归因。

请给出 `VERDICT=GO` 或 `VERDICT=NO-GO` 与 `M/S/N`。每条 finding 请写明状态、仓库相对路径与第 X 行、影响、最小修复，以及是否需要 Dexter 裁决。

授权边界：本轮只授权对门店终端管理实施结果的静态/证据独立复核；不授权生产部署、UAT、真实设备激活、真实打印或 TDP。谢谢。
```
