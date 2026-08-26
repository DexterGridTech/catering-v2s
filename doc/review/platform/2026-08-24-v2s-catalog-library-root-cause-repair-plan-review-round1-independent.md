# 商品库根因修复计划 · 独立计划审查 Round 1

- `REVIEW_CYCLE_ID=CATALOG_LIBRARY_ROOT_CAUSE_REPAIR_PLAN_20260824`
- `REVIEW_TARGET=PLAN`
- `REVIEW_ROUND=1`
- `REVIEW_ROUND_LIMIT=2`（Dexter 于 2026-08-24 额外授权：仅在 Round 2 仍有 confirmed 计划缺口时可进行一次 PR-03 最终定向审查。）
- `reviewerKind=INDEPENDENT_SUBAGENT`
- verdict：`REJECT`，`M/S/N = 1 / 2 / 1`
- 盲审声明：reviewer 先读取 owning source 后以证伪立场审查计划；未采信历史 verdict 或作者自述。

## 输入清单

`AGENTS.md`；根因修复计划；商品库正式需求、Journey、interaction、IA、implementation design、serial plan；CIPG 正式需求及其已覆盖边界；`scripts/generate/catalog-inventory-p1.mjs`；`scripts/test/browser-l2-runtime.mjs`；`apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`；以及相关 owner/frontend/seed sources。

## Findings

### M-01 · L2 activation/readiness 的执行顺序形成循环

`scripts/generate/catalog-inventory-p1.mjs` 的 `readL2ActivationManifest` 只有读到 PASS held readiness manifest 才生成 `INCREMENTAL` 且写入 24 active cases；但 `scripts/test/browser-l2-runtime.mjs` 的 `readiness()` 在建立 fixture 前调用 `requireActivatedCatalogLibraryExecution(execution)`，`FRAMEWORK_ONLY` 会立即 fail。因此“先 readiness PASS，再生成 active profile”不能由当前路径执行。

最小方案是拆为 candidate → readiness → final execution profile 三阶段：candidate 只表达 approved exact set/static input；readiness 消费 candidate，产出带 binding 的 held manifest；P1 再消费 PASS manifest 写 final profile；browser run 只消费 final profile。不得以手改 profile、固定常量或 runtime 覆盖止血。

### S-01 · Playwright spec 仍有第二份 active case exact-set

`apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` 的 `EXPECTED_ACTIVE_CASE_IDS` 复制了 P1 的 exact set。计划应明确退役该常量，spec 只消费 generated final execution profile；candidate 也只能有 P1 一份 producer。

### S-02 · 计划缺少精确正式输入清单

仓内同时存在 catalog-library 与 catalog-identification-production-guidance 两套相近日期文档；若计划仅写“正式需求/Journey/IA/详设”，实施者必须猜材料。计划应逐路径列明输入，并标示 CIPG 的被覆盖和仍有效范围。

### N-01 · “static readiness”用语不准确

readiness manifest 含 TEST fixture、远端 namespace、本地 process、secret、business/setup cleanup/readback，是受管运行准备结果，不是纯 static validator。应改称“static candidate gates + managed readiness manifest”。

## 运行边界

`FIRST_FAILURE=PLAN_L2_ACTIVATION_READINESS_CYCLE`

`LAST_KNOWN_GOOD=AGENTS/cs-review/plan/source read-only reconciliation complete`

`BROKEN_BOUNDARY=P1 generated execution profile ↔ browser-l2 readiness manifest ordering`

`BUSINESS=NOT_RUN_STATIC_PLAN_REVIEW_ONLY`

`CLEANUP=NOT_APPLICABLE_READ_ONLY_NO_RUNTIME`
