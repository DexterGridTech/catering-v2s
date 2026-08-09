# 后台性能重构详设｜Claude 评审请求

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round2.json

## 背景

本轮是后台数据库往返治理的 implementation-facing 详设，不实施代码。它把 196 条 route 的 owner-local 静态 binding、workspace/platform/public 三类 command context、catalog 品牌/复制 judgment、任务型 read 的 78 条预算分母，以及性能候选的 fixture 基线固定下来。

独立盲审已完成两轮：Round 1 发现三项 M；Round 2 验证其中一项关闭并留下两项 M。依照两轮上限，Codex 已用 `POST_REMEDIATION_V1` 做最小设计修订，故当前 bytes **尚未经独立 reviewer 复核**，只能请求 Claude recheck，不宣称历史 GO。

## 评审目标

请独立判断当前 post-remediation 详设是否可进入后续实施授权：既减少可证明的重复 DB 往返，又不削弱 owner 主权、授权重核、receipt replay、CAS、审计、必要 readback 或 platform/public 协议边界。

## 需阅读文件

- `doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md`：原始性能现象、测量口径与根因边界。
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md`：已接受的重构方向与 C1–C6。
- `doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md`：Dexter 的 design-only 授权。
- `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`：当前详设。
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json`：6 个 delivery unit 与 post-remediation binding。
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round1.json`、`doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round2.json`：独立审查证据。
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-post-remediation-intake.md`：Round 2 后最小修订及其状态。

## 独立核验重点

1. 196 registry 分母是否只由两份 generated registry 决定；113 command 是否完整分为 operations-admin 75、platform-admin 29、public 9，且没有 default/fallback context。
2. kind-specific public binding interface 是否真的让错误 context 在编译期不可调用，而非留下 `CommandContext` 超类型/运行时 cast 逃逸口。
3. `CatalogAuthorizationScope` 是否仍由同一 command transaction 内的 server judgment 创建，brand/copy source 未退化为请求字符串，且 owner replay 始终先做对象事实重核。
4. B=78 是否只适用于 task read；五项 protocol/content GET 豁免是否仍有 DB completion evidence；任务型 reader 是否不会进入 command transaction。
5. 79 条 numeric baseline（74 个 workspace normal + 5 个 save branch）是否精确；C6 是否正确覆盖 `reorderOperationsCatalogDictionaryEntry` command readback，同时不把 TaskReadService 引进 write transaction。
6. 独立审查后的 `POST_REMEDIATION_V1` 是否诚实声明“当前 bytes 未被独立审查”，且仍为 design-only。

## 期望结论

请给明确 `GO` 或 `NO-GO`。若有 finding，请用 `M` / `S` / `N`，并附精确文件与行号、有限影响面、最小修复建议、以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次后台性能重构的 implementation-facing 详设。

背景：本轮只完成详设，不实施代码。目标是在不削弱 owner 主权、授权重核、receipt replay、CAS、审计或必要 readback 的前提下，治理可证明的重复数据库往返。两轮独立盲审已完成；Round 2 后有两项 M 被 Codex 以最小设计修订处理，但当前字节尚未由独立 reviewer 复核，因此需要您作 recheck，不能把它当作历史 GO。
目标：请独立核验静态 handler binding、三类 command context、catalog server judgment、read budget 与 C6 command readback 的边界是否足以安全进入后续实施授权。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md：原始性能证据与口径；
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md：已接受方案；
- doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md：本次 design-only 授权；
- doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md：当前详设；
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json：6 个 delivery unit 与 post-remediation binding；
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round1.json、doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round2.json：独立审查；
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-post-remediation-intake.md：Round 2 后修订。

请重点独立核验：196/113/78/79 的 exact-set；kind-specific binding 是否让跨 context 调用编译不可达；CatalogAuthorizationScope 与 replay 重核顺序；五项 GET 豁免；以及 C6 是否在 reorder command readback 内用 owner-local snapshot、没有调用 TaskReadService。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M/S/N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 仅决定是否可申请下一步 implementation authorization；不授权代码实施、运行环境、DEV、reset/seed、L2/UAT 或仓库控制动作。谢谢。
```
