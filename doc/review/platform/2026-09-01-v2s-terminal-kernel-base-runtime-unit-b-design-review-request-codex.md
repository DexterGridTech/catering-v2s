## 背景

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN

TER `kernel.base.runtime` 单元 A 已完成实现和静态复核；Dexter 已把 S-7 选项 C 定为冻结输入：A 公开面从 57 收口为 58，只导出 `RuntimeRoleChangeEffect`，不导出 `RuntimeRoleChangeSignal`。单元 B 的需求冻结输入来自 runtime 需求文档 §0-A、§4.7、§4.8b、§6 第一/二组与 §8 B-1/B-2。本轮交付是单元 B 的 implementation-facing 详细设计与实施计划，尚未进入实现。

Codex 侧已按仓内治理完成同一 cycle 的两轮 fresh 独立子 agent 预审：Round 1 `NO-GO，M=2 S=1 N=0`，
三条经回源确认后全部闭合；Round 2 对冻结的 792 行、SHA-256 `ba399513…` 字节给出
`GO，M=0 S=0 N=0`。该预审不替代 Claude 的独立判断，本轮请从当前字节重新判断方案是否成立。

## 评审目标

请 Claude 以 DESIGN review 立场，独立判断这份单元 B 详设是否成立：方案是否右尺寸、是否忠实覆盖冻结需求分母、是否正确复用单元 A 的五个接点、是否把 contracts 两组变更、ledger slice、selector、淘汰、角色翻转清账和验证门写到实施 agent 不容易走偏的程度。

## 需阅读文件

- `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md`：runtime 总需求，特别是 §0-A、§4.7、§4.8b、§6、§8、§9。
- `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-a-implementation-design-codex.md`：单元 A 已批准设计，核对五个 A/B 接点与 A 公开面。
- `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-design-codex.md`：本轮评审对象。
- `doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-design-review-round1-codex.md`：Codex 侧 Round 1 原始 findings，仅作已知风险索引，不得采信其结论。
- `doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-design-review-round2-codex.md`：Codex 侧最终定向复核，仅作处置边界索引，不替代本轮独立评审。
- `apps/terminal/kernel/base/runtime/src/foundations/createLifecycleEmitter.ts`：单一 lifecycle fact 产生点与 B 写账接入点。
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`：dispatch options、request 链路、releaseCommand 与命令数上限接入点。
- `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts`：runtime 装配、limits、internal module 与资源注册入口。
- `apps/terminal/kernel/base/runtime/src/types/execution.ts`：A 已有 actor/command record 与聚合类型。
- `apps/terminal/kernel/base/contracts/src/types/request.ts` 与 `apps/terminal/kernel/base/contracts/src/types/command.ts`：contracts 第一/二组当前形状。
- `apps/terminal/kernel/base/state/src/types/runtime.ts`、`apps/terminal/kernel/base/state/src/types/sync.ts`、`apps/terminal/kernel/base/state/src/supports/sync.ts`：state sync 与 record state 公开能力。
- `tools/terminal-contracts/check-static.mjs` 与 `tools/terminal-runtime/check-static.mjs`：本设计涉及的静态门落点。
- `doc/platform/terminal-coding-standard.md`：TR-01、TR-02、TR-03、TR-04、TR-09、TR-10。
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：单 VM 多 surface、主副屏与 runtime 相关裁定。

## 独立核验重点

1. Unit B 的方案 C（两个单写者 slice + state sync + 读侧合并）是否比 POC 内存 Map / 单 shared slice / journal-only 更右尺寸。
2. 公开面从 runtime 58 增至 63 是否合理，5 个新增导出是否过多或漏掉必要命名；contracts 是否保持 69 导出名只改既有类型。
3. B 是否只触碰 A 的已登记接点：lifecycle emitter 写账、`displayMode` 单点赋值、role effect 清旧账、dispatch options、`aggregateCommandStatus` 复用。
4. request 命令数上限是否严格遵守冻结语义：首次超限经既有 lifecycle transition 写一条 budget fact 后 typed reject，后续超限 typed reject 且零写；guard 在普通 `command.started` 与 actor/peer 之前，且不建独立 count Map。
5. selector 的本机优先、peer 降级、timeSource、displayMode、route filter 与按 requestId 分片记忆化是否足够且不过度。
6. 淘汰规则是否真的防住“store 无界”，同时诚实保留“对端永久离开时界面症状可能只由进程重启兜底”的边界。
7. `state.applyAuthoritativeSync` 不校验 sync direction 被登记为跨包欠账而本批不修，这是否足以支撑单写者主张的边界表述。
8. 测试矩阵与右尺寸验证是否能证伪核心假绿路径：payload/raw route 入账由唯一新增的 ledger-shape 机器门覆盖；selector cache、单一事实产生点与 request API 缺失保持 focused test/人工源码核验，不冒充 machine PASS。
9. 请特别核 R1 三处是否真闭合而没有旁路：三个 selector 签名统一；contracts、platform-ports、runtime 五个 route fixture 的映射完整且原断言不弱化；runtime 4+1=5 道 rule gate、20 条 owner rules 与最终证据 denominator 一致。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请写精确文件与行号、事实、后果、最小修复建议，以及是否需要 Dexter 产品裁决。请区分仓内事实、外部事实、推论、产品判断与尚缺证据的假设。若仍有 M 级 finding，请说明是否阻断进入单元 B 实施。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 TER kernel.base.runtime 单元 B implementation-facing 详细设计与实施计划。

背景：kernel.base.runtime 单元 A 已完成实现和 TER-local 收口；Dexter 已裁定 S-7 采用选项 C，A 当前公开面为 58，只导出 RuntimeRoleChangeEffect，不导出 RuntimeRoleChangeSignal。单元 B 的冻结输入来自 runtime 需求文档 §0-A、§4.7、§4.8b、§6 第一/二组与 §8 B-1/B-2。本轮只交付单元 B 详设与实施计划，尚未进入实现。Codex 侧已完成同一 cycle 两轮 fresh 独立预审：Round 1 NO-GO（2M/1S/0N）后逐条回源修订，Round 2 对 792 行、SHA-256 前缀 ba399513 的冻结字节给出 GO（0/0/0）。请不要采信预审结论，从当前需求、详设与源码独立重建判断。

目标：请以 DESIGN review 立场独立判断这份详设是否成立，重点核方案是否右尺寸、是否覆盖冻结需求分母、是否正确复用单元 A 的五个接点，以及 contracts 两组变更、两个单写者 ledger slice、读侧合并 selector、淘汰、角色翻转清账、测试与静态门是否写到实施 agent 不容易走偏的程度。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md：runtime 总需求，重点 §0-A、§4.7、§4.8b、§6、§8、§9；
- doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-a-implementation-design-codex.md：单元 A 已批准设计，用于核对五个 A/B 接点；
- doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-design-codex.md：本轮评审对象；
- doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-design-review-round1-codex.md：Codex 侧 Round 1 原始 findings，仅作风险索引；
- doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-design-review-round2-codex.md：Codex 侧 Round 2 处置复核，仅作边界索引；
- apps/terminal/kernel/base/runtime/src/foundations/createLifecycleEmitter.ts：单一 lifecycle fact 产生点与 B 写账接入点；
- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts：dispatch options、request 链路、releaseCommand 与命令数上限接入点；
- apps/terminal/kernel/base/runtime/src/application/createRuntime.ts：runtime 装配、limits、internal module 与资源注册入口；
- apps/terminal/kernel/base/runtime/src/types/execution.ts：A 已有 actor/command record 与聚合类型；
- apps/terminal/kernel/base/contracts/src/types/request.ts 与 apps/terminal/kernel/base/contracts/src/types/command.ts：contracts 第一/二组当前形状；
- apps/terminal/kernel/base/state/src/types/runtime.ts、apps/terminal/kernel/base/state/src/types/sync.ts、apps/terminal/kernel/base/state/src/supports/sync.ts：state sync 与 record state 公开能力；
- tools/terminal-contracts/check-static.mjs 与 tools/terminal-runtime/check-static.mjs：静态门落点；
- doc/platform/terminal-coding-standard.md：TR-01、TR-02、TR-03、TR-04、TR-09、TR-10；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md：单 VM 多 surface、主副屏与 runtime 相关裁定。

请重点独立核验：
1. 两个单写者 slice + state sync + 读侧合并，是否比 POC 内存 Map、单 shared slice、journal-only 更简单且足够；
2. runtime 公开面 58→63 的 5 个新增导出是否合理，contracts 是否保持 69 导出名只改既有类型；
3. B 是否只触碰 A 的已登记接点：lifecycle emitter 写账、displayMode 单点赋值、role effect 清旧账、dispatch options、aggregateCommandStatus 复用；
4. request 命令数上限是否严格做到“首次超限经既有 lifecycle transition 写一条 budget fact 后 typed reject，后续超限 typed reject 且零写”，guard 是否在普通 started/actor/peer 之前，且没有独立 count Map；
5. selector 的本机优先、peer 降级、timeSource、displayMode、route filter 与按 requestId 分片记忆化是否足够且不过度；
6. 淘汰规则是否真正保证 store 有界，同时诚实保留对端永久离开时界面症状可能只由进程重启兜底；
7. state.applyAuthoritativeSync 不校验 sync direction 仅登记跨包欠账、本批不修，是否足以支撑单写者边界表述；
8. 验证是否右尺寸：payload/raw route 入账由唯一新增的 ledger-shape 机器门覆盖；selector cache、单一事实点与 request API 缺失由 focused test/人工源码核验，不冒充 machine PASS；
9. 请定向核 R1 三处：三个 selector 签名是否统一；contracts、platform-ports、runtime 五个 route fixture 是否全部纳入且不弱化原断言；runtime 4+1=5 道 rule gate、20 条 owner rules 与最终证据 denominator 是否一致。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请写精确文件与行号、事实、后果、最小修复建议，以及是否需要 Dexter 产品裁决。请区分仓内事实、外部事实、推论、产品判断与尚缺证据的假设。若仍有 M 级 finding，请说明是否阻断进入单元 B 实施。

授权边界：本轮 GO/NO-GO 只覆盖单元 B 详设与实施计划是否可作为后续实施输入；不授权单元 B 实施，不授权修改 TER 源码、contracts、测试或验证工具，不授权动态运行、设备、DEV、seed、reset、浏览器 L2、UAT、部署或仓级 normal verify。谢谢。
```
