# 请 Claude 独立复核｜BP-U05 clean implementation

## 背景

BP-U05 已完成 owner-local typed task-reader 的静态实现收口：83 个 GET 中 78 个为 task read、5 个为协议/内容豁免；M1=126、M2=60。Cycle 3 的 fresh 独立 IMPLEMENTATION review 已在 Round 2/2 得出 `GO (M=0/S=0/N=4)`，package exit 也已静态通过。

这不是性能数值成功：`BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`，`BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`。本包 `runtimeAuthority=false`，没有启动 managed workload 或 Testcontainers。

## 评审目标

请独立复核当前 BP-U05 clean-package 实现是否真实满足 owner-local typed reader、审计分支和分页边界约束；确认 package exit 没有把静态 proof 误报成动态/性能成功，并给出 `GO` 或 `NO-GO`。

## 仓根相对路径与必读材料

1. `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-input.json`
2. `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-exit.json`
3. `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json`
4. `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-granularity-manifest.json`
5. `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-review-cycle3-input-checklist.md`
6. `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-review-cycle3-round1.md`
7. `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-review-cycle3-round2.md`
8. `contracts/registry/task-read-surface-policy.json` 与 `scripts/generate/task-read-surface-policy.mjs`
9. `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`

## 独立核验重点

1. 重新执行两个 `implementation-design-granularity` 命令，确认 rebaseline 与 remaining-owner 两个 binding 都 PASS，且 post-remediation 仍诚实为 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`。
2. 验证 83/78/5、58/15/4/1、十条 multi-owner exception、M1=126、M2=60 的分母；确认两项 status 都是 `BLOCKED_UNMEASURED`，不是数值优化成功。
3. 打开 `OperationsAuditHistoryController` 与 `PlatformAuditHistoryController`：`Long.MAX_VALUE` 配 pageSize=1 或 2 均须在 owner reader 前转为 typed invalid-page failure。
4. 打开 `OperationsAuditTaskReadServiceTest`：九种 closed variant 必须把 exact non-null scope、authorization/visible facts、target、page、pageSize 交给唯一命名 owner，且 `verifyNoMoreInteractions` 不允许额外 owner read。
5. 核对没有 operationId dispatch、global query bus、跨 schema DML、command 调 task reader、BP-U06 legacy retirement；package exit 声明 51 条 changed path，均已核验在批准面内。该 exit 使用 `TRIM_OBSERVATION_PATH_LIST_ONLY`，因此制品本身不声称 after-hash/receipt exact-set 对账。
6. 独立复跑：`gradle :apps:backend:catering-business-server:compileTestJava --no-daemon --console=plain`、`scripts/check/backend-performance-read-budget --check`、其 `--self-test`、SQL coverage check/`--self-test`、`scripts/check/standards-coverage --phase R5`。

## 期望结论格式

请给出 `GO` 或 `NO-GO`，并列出 `M/S/N`：每项须含严重度、精确路径/行或可复现命令、反例及最小修复建议。若没有 M，请明确说明这仅是静态 implementation review，不是运行时 SQL 优化成功验收。

## 授权边界

仅复核 BP-U05 clean-package 当前字节。**不授权** BP-U06、SQL 数值优化成功声明、DEV、reset/seed、L2/UAT、部署、仓库控制或任何动态环境操作。
