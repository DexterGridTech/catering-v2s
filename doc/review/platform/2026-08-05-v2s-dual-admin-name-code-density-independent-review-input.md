# 独立实现复核输入

`REVIEW_CYCLE_ID=DUAL-ADMIN-NAME-CODE-DENSITY-20260805`
`REVIEW_TARGET=IMPLEMENTATION`
`REVIEW_ROUND=1`
`REVIEW_ROUND_LIMIT=2`
`reviewerKind=INDEPENDENT_SUBAGENT`

## 盲审声明

复核者在形成 findings 前不得把作者的 focused proof 当作结论；必须重新扫描真实生产源码、共享 foundation 和测试结果，以证伪为先。

## 最小输入清单

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/decisions/2026-08-05-v2s-dual-admin-name-code-density-standard.md`
- `doc/plans/platform/2026-08-05-v2s-dual-admin-name-code-density-implementation-design.md`
- `doc/review/platform/2026-08-05-v2s-dual-admin-name-code-density-focused-proof.json`
- `libraries/frontend/admin-ui-foundation/src/presentation/nameCode.ts`
- `libraries/frontend/admin-ui-foundation/src/index.ts`
- `scripts/check/name-code-density.mjs`
- 两后台 `apps/frontend/platform-admin/src` 与 `apps/frontend/operations-admin/src` 的全部生产 `.ts/.tsx`

## 独立核验重点

1. 77 个 producer sites / 31 个文件的分母是否覆盖表格、树、Drawer、Descriptions、Tag、Select、Modal、审计标题和范围栏，是否有漏网手拼或误把非视觉字符串纳入视觉规则。
2. `NameCodeText` 是否确实保持名称主层级、编号使用 `fontSizeSM` 与 `text-tertiary`，缺失值语义是否稳定，路径分段是否不反转 code/name。
3. ReactNode 选项、确认 Modal、审计标题、Tag 去重和 `.ts` filter helper 是否类型安全、不会把 ReactNode 当 canonical string 传给 owner/API。
4. 旧 formatter 与 `${name}(${code})` 的机器门是否真实扫描生产源码，并以真实红 mutation 失败。
5. 是否越界修改 owner、契约、generated wire、runtime、seed/reset、数据库或未授权产品行为；是否存在过度设计或回归。
6. 重新运行 foundation/platform/operations typecheck 与 Vitest；把平台既有 architecture baseline failure 与本包 focused evidence 分开判断。

## 输出要求

请写 `doc/review/platform/2026-08-05-v2s-dual-admin-name-code-density-independent-review-round1.md`，声明 `REVIEW_ROUND=1`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`，逐条给出 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE`、证据路径与优先级，并给出 `GO`/`NO-GO` 和 `M/S/N`。若有 finding，作者只能基于重新打开的 owning source 定向修复后再请求 Round 2；禁止第三轮。
