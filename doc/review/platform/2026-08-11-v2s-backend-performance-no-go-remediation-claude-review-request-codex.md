# Backend-performance static remediation — Claude independent review request

REVIEW_STATUS=READY
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_NO_GO_REMEDIATION_IMPLEMENTATION_20260811

## 背景

上一轮 Claude 静态复核为 `NO-GO (M=1/S=3/N=2)`；本轮已按问题族关闭
canonicalJson owner readback 的 fail-closed 消费、全部 catalog GET 的严格信封和消费者类型、
cleanup ownership、manifest payload 命名、typed Problem cause 以及 BPF package admission。
两轮 fresh independent implementation review 的当前结论分别为 round 1 `GO (M=0/S=0/N=1)`、
round 2 `GO (M=0/S=0/N=0)`。所有证据均为静态；动态阶段尚未开始。

## 评审目标

请独立判断当前 bytes 是否真正关闭上轮 M/S/N 及其同族分母，特别是不得把实例修复误当成类修，
不得接受宽松类型、静默 fallback、虚假 cleanup owner 或 package admission bypass。

## 需阅读文件

- `doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-recheck-claude.md`：上轮 finding 与边界；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`：跨 owner canonicalJson readback 与 cause preservation；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/SaveOperationsCatalogItemOperation.java`：edge save readback cause preservation；
- `scripts/check/backend-performance-sql-merge-coverage`：canonical consumer 的有限分母和真实 red mutation；
- `scripts/generate/catalog-inventory-p3-frontend.mjs`、`apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`、`apps/frontend/operations-admin/src/features/catalog-management/`：16 个 GET strict envelope 及生产消费点；
- `scripts/test/catalog-inventory-query-envelope.test.mjs`：strict envelope、manifestRevision 和 typed-cause 分母 proof；
- `scripts/test/backend-performance-testcontainers-196-remote-workload.mjs`、`apps/backend/catering-business-server/src/test/java/dynamic/BackendPerformanceTestcontainers196Test.java`：truthful cleanup ownership；
- `tools/compliance-control/cli.mjs`、`.runtime/compliance-control/active-package.json`、`doc/evidence/platform/2026-08-11-v2s-backend-performance-testcontainers-196-remote-package-input.json`：BPF package admission；
- `doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-implementation-review-round1-codex.md`、`doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-implementation-review-round2-codex.md`：两轮独立审查证据，不能替代你的判断。

## 独立核验重点

- canonicalJson 跨 owner 消费是否精确覆盖 7 个 copy-preflight + 2 个 catalog-save readback，且均为 `readTree → data object → typed binding`；缺 data、whole-envelope binding、readValue 和空字符串 fallback 是否真红；
- 是否所有 16 个 GET 都生成 `CatalogQueryEnvelope<T>`，而 26 个 command 仍保留原协议；所有 production catalog-management GET consumer 是否未 cast 回宽松 envelope；
- `CatalogShapeManifestView.manifestRevision` 是否在 producer、read model、OpenAPI、generated type 和 UI 一致；
- readback translator 的有限分母是否全部保留 Throwable cause；
- workload 是否诚实把 cleanup 归属 Testcontainers 与 managed runner，而非无 cleanup hook 的 Java test；
- BPF active package 是否只能在 `CURRENT_STEP=BACKEND_PERFORMANCE_FINAL_CLOSURE`、input authority 和 predecessor static 196/196 hash 同时成立时准入。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 Backend-performance 静态 NO-GO 整改。

背景：上一轮静态复核为 NO-GO（M=1/S=3/N=2）。本轮已对 canonicalJson fail-closed 消费、16 个 GET 严格信封和生产消费、cleanup ownership、manifestRevision、typed Problem cause 及 BPF package admission 做了同族修复；两轮独立 implementation review 当前为 GO（round 1 M=0/S=0/N=1，round 2 M=0/S=0/N=0）。
目标：请独立确认当前源码、契约、生成器、测试和控制面是否真实关闭上述问题族，而非仅让局部测试通过。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-recheck-claude.md：上轮 findings；
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java：canonicalJson readback 与 cause；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/SaveOperationsCatalogItemOperation.java：save readback cause；
- scripts/check/backend-performance-sql-merge-coverage：9 个 cross-owner canonical consumer 分母与 red mutation；
- scripts/generate/catalog-inventory-p3-frontend.mjs、apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts、apps/frontend/operations-admin/src/features/catalog-management/：16 个 GET strict envelope 与消费点；
- scripts/test/catalog-inventory-query-envelope.test.mjs：静态 regression 分母；
- scripts/test/backend-performance-testcontainers-196-remote-workload.mjs、apps/backend/catering-business-server/src/test/java/dynamic/BackendPerformanceTestcontainers196Test.java：cleanup owner；
- tools/compliance-control/cli.mjs、.runtime/compliance-control/active-package.json、doc/evidence/platform/2026-08-11-v2s-backend-performance-testcontainers-196-remote-package-input.json：package admission；
- doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-implementation-review-round1-codex.md、doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-implementation-review-round2-codex.md：独立审查证据。

请重点独立核验：9 个 canonicalJson consumer 是否全部 fail-closed 且验红；16 个 GET 是否无宽松类型回退；manifestRevision 是否全链路一致；所有直接 readback 异常转换是否保留 cause；cleanup owner 是否真实；BPF package admission 是否能拒绝 authority/predecessor hash 漂移。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次仅授权静态源码、契约、生成器、测试、控制与证据复核；不授权 Testcontainers、L2、DEV、reset、seed、UAT、部署、手工 SQL 或任何动态/性能成功结论。谢谢。
```
