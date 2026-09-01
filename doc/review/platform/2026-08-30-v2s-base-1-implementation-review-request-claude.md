# base-1 implementation review request

REVIEW_TARGET=IMPLEMENTATION

## 背景

本轮是 base-1 在当前 `catering-v2s` 字节上的完整实施复核请求。此前外部只读复核因 browser L2 业务结果与 repository byte binding 不在同一 run 而给出 `NO-GO, M=1 / S=0 / N=3`；随后已修复生成链的重复写入/HMR 根因、L2 execution profile 未绑定 readiness 的执行顺序问题，以及 catalog seed canonical report 未传递 `cleanupStatus` 的证据契约问题。

本轮已按授权完成当前字节的静态检查、生成链，并在测试前执行仓内 `./scripts/verify --validate-only`；随后 catalog、inventory、application 三组受管后端单元测试均以真实 Testcontainers 运行通过，当前测试汇总见 `.runtime/r5/results/catalog-inventory-backend-unit-tests.json`。此前的 browser L2、reset、DEV、`r5-full` seed 证据属于 brief 变更前的历史运行；由于 repository byte binding 覆盖本 review brief，最终 L2 必须在本文件冻结后重新生成，之后再按 L2 → reset → DEV → seed 顺序建立新的动态证据。该文件只请求 Claude 重新独立判断，不把 Codex 的通过结果当作评审结论。

## 评审目标

请独立核验当前实现是否同时满足批准的 base-1 详设、owner/事务/读回/状态边界、前后端生成链、受管运行拓扑、browser L2 用户行为、reset/DEV/seed 生命周期和证据完整性；重点确认本轮修复是否真正消除了根因，是否仍有重复失败族、未覆盖反例或会使后续复核重新进入“修一个、暴露另一个”的结构性缺口。

## 需阅读文件

- `AGENTS.md`：仓库执行入口、授权边界、动态运行与 review 约束；
- `PLATFORM-BLUEPRINT.md`：平台架构、owner、consumer face 与运行拓扑；
- `doc/platform/review-standard.md`：review 必须执行的五个动作与固定 verdict block；
- `doc/plans/platform/2026-08-27-v2s-base-1-implementation-design-codex.md`：base-1 implementation-facing 详设；
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md`：CP-06/CP-07/CP-08 的实施与动态验证顺序；
- `contracts/policy/catalog-inventory-l2-execution.json`：当前 L2 readiness 绑定和 active case profile；
- `scripts/generate/catalog-inventory-p3-frontend.mjs`：生成物同字节幂等写入与前端生成边界；
- `scripts/dev/catalog-inventory-seed-executor.mjs`：catalog seed owner HTTP、生命周期、业务 readback 与报告构造；
- `scripts/dev/owner-command-seed-executor.mjs`：owner-command seed 与 canonical report 构造；
- `scripts/test/seed-report.mjs`：seed report canonical business/cleanup/completeness 语义；
- `scripts/dev/r5-complete-seed-executor.mjs`：完整 r5-full seed 的组件编排与 parent 证据；
- `scripts/dev/r5-reset.mjs`、`scripts/dev/r5-dev-runner.mjs`：受管 reset/DEV 生命周期与 cleanup；
- `scripts/test/browser-l2-runtime.mjs`：readiness、repository byte binding、24-case execution 与 cleanup；
- `.runtime/r5/results/catalog-inventory-backend-unit-tests.json`：当前测试前 verify 闸门之后的三组受管后端单元测试汇总；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788035102201-22614/run-manifest.json`：catalog owner module 测试与 cleanup；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788035280879-22827/run-manifest.json`：inventory owner module 测试与 cleanup；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788035371857-22988/run-manifest.json`：application 测试与 cleanup；
- `.runtime/browser-l2/l2-1788035759833-23472-fe934b98-fbe8-4869-ada0-f917b17b1a23/` 下的 `readiness-manifest.json`、`l2-execution-manifest.json`、`repository-byte-binding.json`、`l2-cleanup-manifest.json`：本 brief 冻结后新建的最终 L2 业务/cleanup 与字节绑定；
- `.runtime/r5/reset/` 下最终时间链对应的 `run-manifest.json`：L2 完成后新建的最终 reset 结果；
- `.runtime/r5/run-manifest.json`：L2 完成后新建的最终 DEV manifest、进程身份与拓扑；
- `.runtime/r5/seed/complete/` 下最终时间链对应的 `run-manifest.json` 与 `seed-report.json`：最终完整 seed parent manifest/report；
- `.runtime/r5/catalog-inventory/seed/` 与 `.runtime/r5/seed/` 下最终时间链对应的 child `seed-report.json`：最终两个 child canonical reports；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788031506396-60760/run-manifest.json`：本轮最新 backend acceptance 与 Testcontainers cleanup 结果。

## 独立核验重点

- 以当前 owning source 为准，确认生成器幂等写入确实阻止相同字节的 generated RTK 触发 HMR，并检查同族 generated writer 是否存在未修复的重复写入路径；
- 独立重算/核对当前 L2 binding 的 file count、byte count、digest、runId 与 execution manifest，确认 24/24、business PASS、cleanup PASS 与同一 run binding 同时成立；
- 检查 L2 的 readiness → P1 INCREMENTAL execution profile 顺序，确认没有 framework-only 证据被混入正式 execution；
- 检查 reset 的目标 allowlist、远端 database/asset 删除回读、DEV 的远端 Java + 本机双 Vite + HTTP/asset tunnel 拓扑、PID/start token 和 cleanup；
- 检查 seed plan 的 73/72/1/34 分母、owner HTTP/DB 关联、无 unmatched、生命周期与 VOIDED 状态、业务 readback，以及 parent/两个 child 的 run 关联；
- 特别核对 catalog child report 的 `businessStatus=PASS`、`cleanupStatus=PASS_PRESERVED_DEV_STATE` 与 child manifest 的 `cleanup` 一致，确认这不是由 markdown 投影或 parent 重写制造的假象；
- 核对测试前 verify 的 PASS 与三组受管测试 manifest 的 PASS/cleanup PASS 是否属于同一当前字节；重点复核本轮修复的两类根因：旧 `resolveGeneratedOperation` stub 与当前 `resolveGeneratedCatalogOperation` 调用不一致，以及 application route/测试 wrapper 的 selector 漂移；确认修复没有通过删除业务路由、放宽断言或引入 fallback 止血；
- 逐条检查详设声明的 seed invariants 是否在 executor/owner API/readback 中真正闭合，而不是只存在于 fixture、plan 或硬编码 report 字段；
- 完成 review-standard 的 1-A 事实提取、设计对账、same-root 全集扫描、L3 未验证清单，并区分 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 与 `DEXTER_DECISION`；
- 不把尚未重跑的 remote Testcontainers 历史失败债务、产品取舍或 UAT/部署能力误报为本轮动态 GO；这些若影响结论请明确列为未完成项或决策项。

## 期望结论

请给出明确的 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO`，并使用 `M/S/N=<数量>`。每条 finding 请带精确仓库相对路径与行号、影响面、可证伪失败条件、最小根因修复、为什么更小替代不足，以及是否需要 Dexter 产品/Journey 决策。请完整输出 `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS` 和 `EVIDENCE_TIER`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 catering-v2s base-1 implementation。

背景：本轮是 base-1 在当前字节上的完整实施复核。此前外部复核因 browser L2 业务结果与 repository byte binding 不在同一 run 而给出 NO-GO；本轮已修复 generated writer 的同字节幂等/HMR 根因、L2 readiness 到 INCREMENTAL execution 的绑定顺序、catalog seed canonical report 未传递 cleanupStatus 的证据契约问题，并修复了测试夹具 API 漂移与 application route/selector 漂移。测试前已执行仓内 `./scripts/verify --validate-only`，随后 catalog、inventory、application 三组受管测试均 PASS。最终 browser L2 readiness run 已建立为 `l2-1788035759833-23472-fe934b98-fbe8-4869-ada0-f917b17b1a23`，将在本 brief 冻结后完成生成链、verify、byte binding 与 24-case execution；最终 reset、DEV、`r5-full` seed 将严格按 L2 完成后的顺序建立。请以该 L2 run 及 `.runtime/r5/reset/`、`.runtime/r5/`、`.runtime/r5/seed/` 中与本次最终时间链对应的 manifest 为准，不采信本 brief 之前的历史 run。

目标：请从当前 owning source 与当前 evidence 独立判断 base-1 的 architecture、contract、owner/事务/读回/状态边界、生成链、运行拓扑、browser L2 用户行为、reset/DEV/seed 生命周期和证据绑定是否真实闭合；重点判断这些修复是否消除了根因，以及是否还存在重复失败族、未覆盖反例或会导致后续反复修补的结构性缺口。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md：执行入口、架构和授权边界；
- doc/platform/review-standard.md：评审动作和固定 verdict 格式；
- doc/plans/platform/2026-08-27-v2s-base-1-implementation-design-codex.md：base-1 详设；
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md：实施与动态验证顺序；
- contracts/policy/catalog-inventory-l2-execution.json：L2 readiness 与 active case profile；
- scripts/generate/catalog-inventory-p3-frontend.mjs：generated writer 幂等边界；
- scripts/dev/catalog-inventory-seed-executor.mjs、scripts/dev/owner-command-seed-executor.mjs、scripts/test/seed-report.mjs：seed owner/readback/report 真实实现；
- scripts/dev/r5-complete-seed-executor.mjs、scripts/dev/r5-reset.mjs、scripts/dev/r5-dev-runner.mjs：seed/reset/DEV 生命周期；
- scripts/test/browser-l2-runtime.mjs：L2 readiness、字节绑定、24-case execution 与 cleanup；
- .runtime/r5/results/catalog-inventory-backend-unit-tests.json：verify 闸门之后的三组受管后端单元测试汇总；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1788035102201-22614/run-manifest.json、.runtime/r5/evidence/remote-testcontainers/r5-tc-1788035280879-22827/run-manifest.json、.runtime/r5/evidence/remote-testcontainers/r5-tc-1788035371857-22988/run-manifest.json：三组当前测试子 run；
- .runtime/browser-l2/l2-1788035759833-23472-fe934b98-fbe8-4869-ada0-f917b17b1a23/readiness-manifest.json、l2-execution-manifest.json、repository-byte-binding.json、l2-cleanup-manifest.json：本 brief 冻结后新建的最终 L2 证据；
- .runtime/r5/reset/、.runtime/r5/run-manifest.json、.runtime/r5/seed/complete/、.runtime/r5/catalog-inventory/seed/、.runtime/r5/seed/：L2 完成后新建的最终 reset、DEV 与 seed 证据；
- .runtime/r5/seed/complete/、.runtime/r5/catalog-inventory/seed/、.runtime/r5/seed/：最终 r5-full parent 与两个 child canonical reports；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1788031506396-60760/run-manifest.json：最新 backend acceptance manifest。

请重点独立核验：测试前 ./scripts/verify --validate-only 是否真实 PASS，且三组受管测试的当前 manifest 是否同时 PASS/cleanup PASS；同一最终 L2 run 是否同时具备 24/24、business PASS、cleanup PASS、repository byte binding 与零 HMR/reload 信号；P1 是否确实消费 PASS readiness 而非 framework-only profile；reset/DEV 拓扑与 PID/start token/cleanup 是否闭合；seed 的 73/72/1/34 分母、API/DB completeness、生命周期/readback、parent/child run 关联与 canonical cleanupStatus 是否真实成立；并对详设中所有 seed invariants 做同根全集扫描。请按 review-standard 完成 1-A、逐条设计对账、same-root scan、L3 unverified inventory，区分 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE、DEXTER_DECISION。不要把静态通过、历史 Testcontainers 结果或作者自报值当作本轮动态证明。

烦请给出明确 GO、GO_WITH_UNVERIFIED_UI 或 NO-GO。若有问题，请按 M/S/N 标注精确仓库相对路径与行号、影响面、可证伪失败条件、最小根因修复、为什么更小替代不足，以及是否需要 Dexter 产品/Journey 裁决；请完整给出 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS 和 EVIDENCE_TIER。

授权边界：本次评审只代表对当前 base-1 implementation 的独立评审结论，不授权产品或 Journey 变更、Roadmap 推进、Git、reset、seed、DEV 重启、browser L2、UAT、部署、数据操作或任何仓库控制动作。谢谢。
```
