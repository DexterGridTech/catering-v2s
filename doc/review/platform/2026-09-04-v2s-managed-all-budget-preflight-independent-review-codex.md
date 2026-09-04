# Managed all budget preflight independent review（Codex）

```text
REVIEW_CYCLE_ID=2026-09-04-V2S-MANAGED-ALL-BUDGET-PREFLIGHT-01
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
VERDICT=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS (NOT_UI_BEARING)
L3_UNVERIFIED=空
SAME_ROOT_SCAN=PASS
DESIGN_GAPS=空
EVIDENCE_TIER=STATIC_SOURCE_REVIEW + STATIC_NODE_SYNTAX_CHECK + PRIOR_DYNAMIC_MANIFEST_READBACK
```

## 结论

本轮只审查已完成的最小 implementation step：generated-budget preflight 补口。静态复核结论是 `GO`。该结论只说明当前代码已经把 `backend-acceptance --operation all` + `ACCEPTANCE` 的 generated budget registry 变成本地 fail-fast 前置条件，并且没有误拦 `CALIBRATION` 或 focused identity-only 路径；它不授权也不等价于动态 all 重跑。

本轮未修改业务源码、测试源码或 generated 文件；只写入本 review 文档。

## 输入清单

- `.agents/skills/cs-review/SKILL.md`
- `doc/platform/review-standard.md`
- `project-memory/operations/verification-governance.md`
- `.agents/skills/cs-managed-runtime-execution/SKILL.md`（仅用于确认 managed runtime 边界，不授予动态执行）
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md:83-101`
- `scripts/test/r5-remote-testcontainers.mjs`
- `scripts/test/r5-remote-testcontainers.test.mjs`
- `scripts/test/backend-performance-operation-reconciliation.mjs`
- `scripts/generate/backend-performance-budget.mjs`
- `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`
- `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788464852162-52875/run-manifest.json`

## Action 1-A：从代码提取事实

| 事实 | 当前源码证据 | 判断 |
|---|---|---|
| all + ACCEPTANCE 才要求 active budget | `scripts/test/r5-remote-testcontainers.mjs:246-255`：`requiresFullPerformanceVerification` 要求 backend acceptance run 且 operation 为 `all`；`requiresActiveBudgetVerification` 进一步要求 `verificationMode === 'ACCEPTANCE'`。 | MATCHED |
| active budget 在本地资源/远端 workload 前 fail-fast | `scripts/test/r5-remote-testcontainers.mjs:1348-1358`：先计算 `activeBudgetRequired`，再 `loadPerformanceOperationRegistry`，然后在 `mkdirSync(directory)`、manifest 创建、local lock、remote preflight、source sync 之前调用 `validateBudgetRegistry`。 | MATCHED |
| focused identity-only 不被误拦 | `scripts/test/r5-remote-testcontainers.mjs:204-227`：无 backendAcceptance run 且 operation 非 all、或 backendAcceptance focused operation，才导出 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`；all run 不导出 identity-only。 | MATCHED |
| CALIBRATION 不被 active budget 误拦 | `scripts/test/r5-remote-testcontainers.mjs:249-255` 与 `scripts/test/r5-remote-testcontainers.test.mjs:326-331`：CALIBRATION 的 `requiresActiveBudgetVerification` 为 false。 | MATCHED |
| current finite denominator 是两份 generated registry 合计 268 | `scripts/test/backend-performance-operation-reconciliation.mjs:14-15` 固定读取 `edge-route-face-registry.json` 与 `catalog-inventory-edge-route-registry.json`；`contracts/policy/backend-performance-operation-counts.json:6` 的当前 operation count 为 268。静态读数：edge 210、catalog-inventory 58，合计 268。 | MATCHED |
| budget registry 校验拒绝 null / placeholder / 非 exact set | `scripts/generate/backend-performance-budget.mjs:276-288` 对 null/undefined 抛 `BUDGET_NULL_REJECTED`；`scripts/generate/backend-performance-budget.mjs:427-448` 要求 operations exact set、每条含 `databaseOperationBudget`、且只有一个 linear batch operation。 | MATCHED |
| 旧 58 null 首败族真实存在 | `git show HEAD:apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json` 静态对照显示旧版 58/58 个 `databaseOperationBudget` 为 null；当前同文件 58/58 已有 budget。 | MATCHED |
| 首败 manifest 与该问题族一致 | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788464852162-52875/run-manifest.json:1-8` 为 `ACCEPTANCE`；同文件 `:40-44` 是 backend acceptance all；`:1981-1984` 记录 `status=FAIL`、`firstFailure=PERFORMANCE_OPERATION_BUDGET_INVALID:adjustOperationsInventoryTarget:BUDGET_NULL_REJECTED`、`brokenBoundary=MEASUREMENT_EVIDENCE`。 | MATCHED |
| red test 覆盖 null budget | `scripts/test/r5-remote-testcontainers.test.mjs:333-346` 直接读取当前 repository registry，先断言 `validateBudgetRegistry` 不抛，再把 `adjustOperationsInventoryTarget.databaseOperationBudget` 改成 null 并断言 `BUDGET_NULL_REJECTED`。 | MATCHED |

## Action 2：与本 step 计划逐条对账

`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md:83-101` 对 SM-05 的恢复算法要求：先判断 generated/runner/owner/环境边界，禁止 null/pending/sentinel 预算止血；15 条 focused 全闭合后才跑一次 all；all 后用真实 HTTP completion event 对 current operation 做 exact mapping；不能以 calibration PASS 代替。

本 step 没有声称完成 SM-05 全链，也没有授权动态 all rerun。它只补齐“all + ACCEPTANCE 在消耗当前 generated budget projection 前必须 fail-fast”的本地机械口。该机械口与计划要求一致：它删除了旧“identity-only registry 可进入 all dynamic run 后再在 measurement 阶段爆掉”的窗口，并保留 focused/CALIBRATION 的 identity-only 用途。

## Action 3：same-root finite denominator

- Denominator owner：`scripts/test/backend-performance-operation-reconciliation.mjs:14-15` 的两份 generated registry。
- Current expected count：`contracts/policy/backend-performance-operation-counts.json:6` = 268。
- Current static count：`edge-route-face-registry.json` 210 + `catalog-inventory-edge-route-registry.json` 58 = 268。
- Current null/missing budget：0/268。
- Budget kinds：267 `FIXED` + 1 `LINEAR_REQUEST_CARDINALITY`。
- Placeholder scan：0/268 命中 `NULL`、`SENTINEL`、`UNLIMITED`、`INFINITE`、`INFINITY`、`PENDING`、`CALIBRATION_PENDING`。
- The remaining 268 operations were checked through `validateBudgetRegistry({operations: registry})` using the same loader path as the runner.

`platform-route-face-registry.json` 被文件发现时辨认过，但它不是 `loadPerformanceOperationRegistry` 的 default denominator；本轮不把它混入 performance all denominator。

## Action 4：未验证清单

静态已证：

- all + ACCEPTANCE 的 active budget 条件。
- preflight placement 在 local run lock、resource preflight、remote workspace prepare、source sync 与 workload execution 之前。
- focused identity-only 与 CALIBRATION 不触发 active budget。
- current generated denominator 268/268 budget registry 静态有效。
- 旧 58 null budget 首败族与当前 red unit assertion 的 mechanical failure code 对上。

测试已证：

- 本轮没有运行 `node --test` 或任何动态/managed runner；不把测试文件里的断言文本声称为本轮执行结果。
- 只运行了 `node --check` 对四个 `.mjs` 文件做语法检查：`scripts/test/r5-remote-testcontainers.mjs`、`scripts/test/r5-remote-testcontainers.test.mjs`、`scripts/test/backend-performance-operation-reconciliation.mjs`、`scripts/generate/backend-performance-budget.mjs`。

无人验证 / 动态边界：

- 没有重跑 `backend-acceptance --operation all`。
- 没有证明新的 all run 会生成 `measurementEvidence.status=PASS`。
- 没有证明新的 all run 的 `budgetEvidence.observed=268`、connection budget、normal sample matrix 与 cleanup 在同一个新 run 中全部 PASS。
- run `r5-tc-1788464852162-52875` 只能证明旧失败边界：business PASS、cleanup PASS、measurementEvidence NOT_RUN、firstFailure 为 null budget。

## Action 5：verdict block

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS (NOT_UI_BEARING)
L3_UNVERIFIED=空
SAME_ROOT_SCAN=two generated registry files; 268/268 checked; null budget 0; placeholders 0; linear exact count 1
DESIGN_GAPS=空
EVIDENCE_TIER=STATIC_SOURCE_REVIEW + STATIC_NODE_SYNTAX_CHECK + PRIOR_DYNAMIC_MANIFEST_READBACK
```

## Findings

None.

## 最小更小替代判断

已比较的更小替代：

1. 只依赖 `assertPerformanceOperationBudgets` 在 measurement 阶段拒绝 null。
   - 结论：拒绝。它会复现 `r5-tc-1788464852162-52875` 的坏路径：远端 workload 已经启动、业务与 cleanup 已完成后，才在 `MEASUREMENT_EVIDENCE` 爆出 generated budget null。不是本地 fail-fast。
2. 只在 generator `buildBudgetProjection` 输出时校验。
   - 结论：不足。它能保护新生成输出，但不能保护 checked-in registry 被 identity-only 或手动漂移污染后仍被 managed all runner 消耗。
3. 在 runner preflight 用 `validateBudgetRegistry` 校验当前 loader 返回的 same-root denominator。
   - 结论：当前实现是最小有效修复。它复用 generator 已有校验，不新增 second registry，不改业务/test source，不引入 fallback，并在资源获取前挡住 malformed generated budget projection。

## Root-cause / fallback guard

本轮没有发现 masking fallback。`IDENTITY_ONLY` 仍只用于 focused/CALIBRATION identity projection；all + ACCEPTANCE 不导出 identity-only，并且现在必须先通过 checked-in active budget registry 校验。`NOT_READY` 路径在 generator CLI 中是 fail-closed 输出，不是 managed all acceptance 的 bypass。

## Authorization boundary

本 review 只把 generated-budget preflight 最小 step 判为静态 `GO`。它不授权动态重跑、DEV、seed、reset、L2、UAT、部署或任何仓库控制动作；主 agent 若继续推进，只能把本结论当作“本地 preflight 补口已过静态独立审查”，不能把它当成 all acceptance 动态 closure。
