# Backend-performance final-closure design Claude review request

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-10-v2s-backend-performance-final-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round2.md

## 背景

本次是后台性能优化最终收口的 implementation-facing design。它在不复用旧 BP-U05 package 的前提下，
精确设计 BP-U06 的旧路径退出、BP-U07 的 final immutable snapshot 测量准入，以及后续受管动态验收。
独立 DESIGN 评审已完成两轮；Round 2 为 `GO`（M=0/S=0/N=4），但该结论不授予生产实施或动态环境权限。

## 评审目标

请独立判断最终收口设计是否能同时做到：

- 以合法 module dependency 迁出两个 app/application audit coordinator；
- 用 42 条精确 generated-token route mapping 原子替换 catalog 的 String operation dispatch；
- 仅由 final-run immutable snapshot 将 `BLOCKED_UNMEASURED` 受控提升为 measured，且拒绝历史 R5 snapshot；
- 保持 design-only authority，后续 static implementation 与 dynamic acceptance 必须是独立串行 package。

## 需阅读文件

- `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`：BP-U06 与 final-closure 有约束详设。
- `doc/decisions/2026-08-10-v2s-backend-performance-final-closure-authorization.md`：三段 serial authority、RM1-P6-3 暂停和禁止范围。
- `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-design-source-inventory.json`：BP-U06/U05/U07 与动态验收的精确分母和 source surfaces。
- `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-catalog-route-binding-map.json`：16 GET + 26 COMMAND 的完整 direct route/token mapping。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-granularity-manifest.json`：实施前设计 manifest、六类 exit 对账分母与 design-only authority。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round1.md`：第一轮独立反证与四项问题。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round2.md`：第二轮独立定向核验与最终 verdict。

## 独立核验重点

1. audit-read 仅接收公开 `PlatformSessionReadback`，不 import `app` 或 edge-private session fact；selected-workspace read/measurement 保持 owner-local。
2. 从 generated binding/constant 独立重算 42 routes；删除、重复或调换任一 COMMAND token 都必须不满足 design 的 exact mapping。
3. 检查 final snapshot admission 是否同时固定 runner kind、final implementation-manifest digest、workload-policy digest、unique run ID 与 same-run request/DB tuple；历史 `.runtime/r5` snapshot 不得合格。
4. 检查 `implementationAuthority: false` 是否同时出现在 design manifest 与 authorization，并确认本轮没有 BP-U06 代码、DEV、seed/reset、L2/UAT、部署或数值成功声明。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。finding 请按 `M` / `S` / `N` 列出精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次后台性能优化最终收口的 implementation-facing design。

背景：本轮设计为 BP-U06 旧路径退出、BP-U07 final immutable snapshot 测量准入及后续受管动态验收建立精确实施边界。独立 DESIGN 评审已完成两轮，Round 2 为 GO（M=0/S=0/N=4），但该结论仍只是 design-only。
目标：请独立核验 module/owner 边界、42 条 catalog 直连路由与 generated token 身份、final snapshot provenance，以及串行授权是否足以防止把历史或未测量证据误报为优化成功。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md：BP-U06 与 final-closure 详设；
- doc/decisions/2026-08-10-v2s-backend-performance-final-closure-authorization.md：串行 authority 与禁止范围；
- doc/evidence/platform/2026-08-10-v2s-backend-performance-final-design-source-inventory.json：精确分母与 source surfaces；
- doc/evidence/platform/2026-08-10-v2s-backend-performance-final-catalog-route-binding-map.json：42 条 route/token mapping；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-design-granularity-manifest.json：设计 manifest；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round1.md 与 doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round2.md：独立审查证据。

请重点独立核验：audit-read 不得 import app/edge-private fact；42 条 mapping 的删、重、换 token 反例；历史 .runtime/r5 snapshot 是否因 runner kind、两个 final digest、run ID 和 same-run tuple 被拒绝；以及 implementationAuthority:false 是否真实限制本轮仅为设计。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO 仅允许创建独立的静态 implementation package；不授权直接复用旧 BP-U05 package、不授权动态环境、DEV、seed/reset、L2/UAT、部署、BP-U06 之外的范围，亦不构成任何 SQL 数值优化成功声明。谢谢。
```
