REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-remediation-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-remediation-round2.json

## 背景

本轮是“测试健康闭环整改”的 implementation-facing 详设审查，不是实施交付。原详设将 C1–C4（写了会执行、红了是真的坏、绿了是真的好、失败看得懂）收束为一个串行 implementation package。此前独立审查先后发现 design-only field 格式、ACTIVE receipt 单次执行/防重放、HMAC reuse owner 与 manifest self-surface 的问题；其中 HMAC 已在前 cycle 定向关闭，最后两个设计阻断项已在 remediation cycle round-2 静态 GO。BPF Testcontainers active package 仍暂停。

## 评审目标

请 Claude 独立判断当前详设是否足以防止实施偏离：不新增平行 execution map/gate，不把日常 verify 扩成 L2，不以静态结果冒充动态证据；并核验 root→U12 的 one-execution receipt 和 196 HMAC reuse owner 是否可按现有源码最小落地。

## 需阅读文件

- `doc/plans/platform/2026-08-11-v2s-test-delivery-and-process-remediation-implementation-design-codex.md`：完整 C1–C4、THCL-01…07 单批串行实施设计。
- `doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-requirements-claude.md`：权威需求、四项验收条件与 B0a–B5 边界。
- `doc/review/platform/2026-08-11-v2s-test-scripts-health-audit-codex.md`：Codex 静态审计的原始问题分母。
- `doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-adversarial-review-round1.json`、`doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-adversarial-review-round2.json`：前 cycle NO-GO 根因及已关闭 HMAC finding。
- `doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-remediation-granularity-manifest.json`、`doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-remediation-round2.json`、`doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-remediation-author-intake.md`：当前 hash-bound remediation GO 与作者处置。
- `tools/verify-gates/verify.mjs`、`scripts/check/standards-coverage`、`contracts/policy/standards-enforcement-execution-catalog.json`：root、catalog、U12 当前 owning sources。
- `scripts/test/backend-performance-final-acceptance.mjs`、`scripts/test/backend-performance-testcontainers-196.mjs`：既有 HMAC owner 与 format-only consumer。

## 独立核验重点

1. `implementationAuthority: false` 是否同时存在于 design 与 authorization，且 remediation manifest 的两份 hash 可由现有 checker 机械验证。
2. `VERIFY_ROOT` 是否唯一执行 11 个 `VERIFY_CHILD`；`rootRunId` 是否在 child 前生成、导出 receipt path，并以同次 `--expected-root-run-id` 让 U12 纯校验，足以拒绝有效旧 receipt；`ARCHUNIT_SELECTOR` 是否仍与 GATE child 分母分离。
3. 196 completion/database HMAC 是否只抽取一个 shared owner，保持既有 canonical bytes 与 `V2S_DB_OPERATIONS_HMAC_KEY` boundary，不退回 43 字符格式检查或复制实现。
4. assertion-ledger 删除、explicit glob、fixture migrate-before-delete、runner first-failure 等单元是否仍受单一串行 package 和 red mutation 约束；不应以此详设宣称 Testcontainers、DEV、L2、seed、业务、cleanup 或性能已成功。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。若 GO，请明确它仅接受设计，不能自动激活 implementation package 或动态环境。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次“测试健康闭环整改” implementation-facing 详设。

背景：本轮只完成静态 DESIGN 收口。详设目标是让写了的测试会执行、红了是真的坏、绿了是真的好、失败看得懂；BPF Testcontainers active package 仍暂停。此前独立审查发现 authority 格式、receipt 单次执行/防重放、HMAC reuse 与 manifest self-surface 问题；当前 remediation round-2 已静态 GO，但尚未实施或运行动态环境。
目标：请独立核验当前设计能否以一个串行 implementation package 关闭 C1–C4，特别是 root→U12 receipt 的唯一执行与 freshness、196 HMAC 的唯一 reusable owner，以及不扩展日常 verify/L2 的边界。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-11-v2s-test-delivery-and-process-remediation-implementation-design-codex.md：完整详设与 THCL-01…07 串行实施计划；
- doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-requirements-claude.md：权威验收与范围；
- doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-remediation-granularity-manifest.json、doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-remediation-round2.json：当前 hash-bound 静态 GO；
- tools/verify-gates/verify.mjs、scripts/check/standards-coverage、contracts/policy/standards-enforcement-execution-catalog.json：root/catalog/U12 owning sources；
- scripts/test/backend-performance-final-acceptance.mjs、scripts/test/backend-performance-testcontainers-196.mjs：HMAC owner/consumer。

请重点独立核验：design 与 authorization 的 implementationAuthority: false 及 hash binding；rootRunId→derived receipt path→--expected-root-run-id 的同次调用是否可拒绝有效旧 receipt，且 U12 不会重复执行 child；ARCHUNIT_SELECTOR 是否仍独立；HMAC 是否保持唯一 canonical owner 与 key boundary；以及 assertion ledger、explicit glob、fixture 迁移和 runner diagnostics 是否不被文本/重试/静态假绿替代。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次仅审查静态 implementation-facing DESIGN；GO 不授权实际实施、Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署，也不代表动态、业务、cleanup 或性能成功。谢谢。
```
