---
title: RM1 P5 Claude S1 整改后复审请求
reviewTarget: IMPLEMENTATION
scope: RM1-P5 current bytes after Claude S1 remediation
authorizationBoundary: 仅复审 P5 S1 整改与 P-R6 直接证明；不授权 P6/P3-D、新 Journey/UI、后端/契约/数据变更、DEV、seed、reset 或动态环境
createdAt: 2026-07-29
---

# RM1 P5 Claude S1 整改后复审请求

## 背景与目标

P5 的业务背景不是新增页面：它保证 `G-03/G-05/G-10` 所定义的既有双后台管理任务在会话、候选加载、翻页和写后恢复失败时保持诚实、可恢复的状态。Claude 上轮结论为 `NO-GO（M=0 / S=1 / N=3）`，S1 是两个 P5-changed candidate drawer 的 8 个失败后永久 loading Select。

本次整改仅：

1. 将这 8 处转为 `loading={!candidates && !problem}`；
2. 在既有 frontend architecture gate 增加同类失败态机械控制及真实红变异；
3. 补 P-R6 "remote logout 失败仍清本地会话"的两个 app root 直接控制与红变异；
4. fresh 重跑 focused frontend proof。

## 请独立核验

1. 35 个前端 TSX 的全部 loading prop 中，S1 的有限分母是否已为零；确认错误态不再 loading，且空成功结果不被误判。
2. `tools/verify-gates/cli.mjs` 的新控制是否只约束“candidate 被清空 + catch 写 problem”的失败模型，而非变量名特化或 scanner 自测；把实际 StoreManagementPage 的一处改回裸 `loading={!candidates}` 是否精确红。
3. `PlatformApp.tsx` 与 `OperationsApp.tsx` 的主动 logout 是否都是 `try/await remote logout/finally clearLocalSession`；分别移除 finally 内清理是否精确红。
4. 确认 N1 未被伪装为已修：它的无 subscriber residue 被如实登记为最小整改外的 `NOT_APPLICABLE_WITH_REASON`，无功能行为改变。
5. 重新核算 package-exit 的 actualChangedPaths / incrementalChecks exact-set、focused source hashes，以及当前验证命令结果。

## 关键材料（均相对仓根）

- `doc/review/platform/2026-07-29-v2s-rm1-p5-implementation-review-claude.md`
- `doc/review/platform/2026-07-29-v2s-rm1-p5-post-remediation-intake.md`
- `doc/evidence/platform/rm1/p5/rm1-u08-claude-s1-problem-family.json`
- `doc/evidence/platform/rm1/p5/rm1-u08-focused-frontend-recovery-evidence.json`
- `doc/evidence/platform/rm1/p5/rm1-u08-package-exit.json`
- `apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`
- `apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`
- `apps/frontend/platform-admin/src/app/PlatformApp.tsx`
- `apps/frontend/operations-admin/src/app/OperationsApp.tsx`
- `tools/verify-gates/cli.mjs`

## 结论格式与授权边界

请给出 `GO` 或 `NO-GO`，并按 `M=<n> / S=<n> / N=<n>` 分类。每条 finding 需写 owning source、全量同根分母、反例与可复现证据。**授权边界：仅复审 P5 当前字节；不授权后续 P、任何新业务范围、后端/契约/数据、DEV、seed、reset 或动态环境。**
