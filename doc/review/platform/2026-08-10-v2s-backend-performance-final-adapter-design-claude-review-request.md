REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-review-round2.md

## 背景

最终动态验收此前被安全阻断：现有 final runner 只是 callback 计划器，不能拥有本机进程、隧道、最小夹具、快照和 cleanup 生命周期。现已形成一个独立、静态优先的 final-adapter 详设，限定唯一公开入口、单一七阶段 adapter 与 396 条 source-bound fixture catalog。Claude 前一轮确认 396/16 surface 等分母，但以 M-01 阻止：设计错误要求 trim exit 不可能诚实产生的 receipt/hash equality。现已按 `POST_REMEDIATION_V1` 改为绑定成功的 trim `validate-package-exit` 证据，并明确仅证明批准面子集；当前机械绑定状态是 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，没有第三轮 Codex 对抗审查。

## 评审目标

请独立确认该详设能在不复用 RM1/R5 runtime、不引入 callback 注入或手工 SSH/SQL 的前提下，安全实现一次受管的最终性能 workload；并确认修复后的设计输入和 future dynamic input 不会提前赋予 implementation 或 runtime 权限。

## 需阅读文件

- `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md`：adapter、396 分母、静态到动态串行准入和嵌套技术验证的详设；
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-granularity-manifest.json`：精确 16 条静态 implementation surfaces 与 POST_REMEDIATION_V1 绑定；
- `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-adapter-design-input.md`：design-only authority input（从历史 `.json` 更名，内容不变）；
- `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-dynamic-package-input.json`：未来动态包的 canonical fixture authority；
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-review-claude.md`、`doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-review-round2.md`、`doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-author-intake.md`：Claude finding、Round 2 的作者结构化摘要与不可恢复原件的诚实留存处置；
- `scripts/dev/backend-performance-runtime-runner.mjs`、`scripts/dev/http-diagnostic-runner.mjs`、`scripts/dev/r5-dev-runner.mjs`、`scripts/test/r5-remote-testcontainers.mjs`：当前 fail-closed runner 与不得复用的边界；
- `contracts/policy/backend-performance-final-workload.json`、`scripts/test/backend-performance-workload.mjs`、`scripts/test/backend-performance-final-acceptance.mjs`：396 workload 与最终快照准入的现状。

## 独立核验重点

1. `implementationAuthority:false` 是否同时存在于设计与设计 authority input，且未来 dynamic input 仅使用 `minimalFixtureAuthority:true`；两者均不构成 runtime 授权。
2. immutable `final-dynamic-admission.json` 是否绑定静态 implementation exit、成功的 trim `validate-package-exit` stdout/log digest、Round 2 static review、policy digest 与动态包身份；并且只声称声明 changed paths 是批准面的子集，绝不伪称 receipt/after-hash 集合相等。
3. 396 行 fixture catalog 是否必须逐行绑定 `sourceAnchor`+hash、closed `materializerKind`、typed path parameters、prerequisite/readback，以及 recipe/实际路径一致性；不得退化成泛化 callback 或默认 ID。
4. 嵌套 remote Testcontainers 是否只能作为 adapter-owned 技术证明，并被 parent final-run、固定 task、host fingerprint、child manifest、child business PASS 与 cleanup PASS 同时绑定；不得复用 `.runtime/r5`。
5. POST_REMEDIATION_V1 是否只修复 authority、trim-exit predicate、原件留存诚实性与文件扩展名问题，没有改变 16 条 implementation surfaces、396 分母、任何 runtime authority 或动态执行状态。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 给出精确文件与行号、影响面、最小修复建议和是否需要 Dexter 产品裁决。若 `GO`，请明确其仅允许创建独立的 final-adapter 静态 implementation package，不能据此执行动态环境。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次最终 backend-performance dynamic adapter 的 implementation-facing design。

背景：最终动态验收尚未运行；此前 final runner 是 callback 计划器，已 fail-closed。现在形成了一个静态优先的单一 final adapter 详设。您上一轮确认 396/16 surface 等分母，但以 M-01 指出设计错误要求 trim exit 产生不可能诚实存在的 receipt/hash equality；现已改为绑定真实 trim validate-package-exit 证据，当前字节尚待您的独立复核。
目标：请独立核验该设计是否能以唯一受管入口完成静态→动态串行准入、396 条 source-bound fixture materialization、嵌套 Testcontainers 技术证明、最终快照与独立 cleanup，而不复用 RM1/R5 runtime 或引入 callback/手工编排绕过。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md：完整 adapter 设计；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-granularity-manifest.json：16 条静态 implementation surfaces 与 POST_REMEDIATION_V1；
- doc/evidence/platform/2026-08-10-v2s-backend-performance-final-adapter-design-input.md：design-only authority（历史 .json 已更名）；
- doc/evidence/platform/2026-08-10-v2s-backend-performance-final-dynamic-package-input.json：future dynamic fixture authority；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-review-claude.md、doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-review-round2.md、doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-author-intake.md：Claude finding、Round 2 结构化摘要与作者处置；
- scripts/dev/backend-performance-runtime-runner.mjs、scripts/dev/http-diagnostic-runner.mjs、scripts/dev/r5-dev-runner.mjs、scripts/test/r5-remote-testcontainers.mjs：真实 runner 边界；
- contracts/policy/backend-performance-final-workload.json、scripts/test/backend-performance-workload.mjs、scripts/test/backend-performance-final-acceptance.mjs：工作负载和快照准入现状。

请重点独立核验：design/input 均为 implementationAuthority:false；dynamic 仅使用 minimalFixtureAuthority:true；immutable admission 是否绑定静态 exit、成功 trim validate-package-exit 的 stdout/log digest、review/policy，且只称 approved-surface 子集、绝不伪称 receipt/after-hash equality；396 行是否逐行 source/materializer/path/readback 闭合；嵌套 Testcontainers 是否 parent/task/host/child business+cleanup 完整绑定；POST_REMEDIATION_V1 是否没有增加 surface、分母或 runtime 权限。另请确认 Round 2 原 Markdown 已不可恢复的披露是否诚实充分，且 JSON 不被误称为独立原件。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO 仅允许创建独立的 final-adapter 静态 implementation package；不授权动态环境、DEV、reset、seed、L2/UAT、部署、手工 SSH/SQL、RM1/R5 runtime 复用，亦不代表任何 SQL 数值优化成功。谢谢。
```
