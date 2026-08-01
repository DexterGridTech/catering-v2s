---
title: R5 全范围 implementation-facing design Claude review request
status: CLOSED_NO_FURTHER_REVIEW_BY_DEXTER
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewCycleId: R5-W3-DESIGN-20260725
reviewTarget: DESIGN
implementationAuthority: false
---

# R5 全范围 implementation-facing design review request

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-07-25-v2s-r5-design-adversarial-review-round-2.json

> 本 request 已由 Dexter 在 Part R2 后关闭：Codex 完成 `0 M / 2 S / 4 N` owning 修订即
> 直接收口 DESIGN `GO`，不再发起复核。最终状态见
> `doc/decisions/2026-07-26-v2s-r5-whole-scope-design-final-acceptance.md`。

## 背景

Dexter 已授权形成 R5 全范围设计，但未授权实施。R5 范围为 all-v2 当前 source-backed 的
32 个场景与现有前端功能；后端按 v2s 单 deployable、单库多 owner schema、单 Flyway
history、owner command/task-join 规范重构。R5 作为一个设计、一个实施、一个 review target；
12 个 unit 只是开发顺序，不产生独立 verdict。

请 Claude 对 post-round-2 修订后的完整设计包重新做独立语义审查，重点不是确认材料齐全，
而是尝试证伪：业务任务是否被误造/漏掉，v2 有价值资产是否正确取舍，v2s 架构/业务语料
是否守住，以及开发 agent 是否能按正向详设实现而不是依赖末端 gate 猜测。

## 评审目标

对 Part R 后再次修订的当前字节做终验：确认 Part R 的 `2 M / 9 S / 12 N` 已按 owning
source 关闭，同时前一轮 `23 M / 36 S / 10 N` 的 62 CLOSED 项无回退；本次不重开第三轮
Codex 对抗审查，也不产生实现授权。

## 需阅读文件

1. `AGENTS.md`、`CLAUDE.md`；
2. `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` 当前 `CURRENT_*`；
3. project-memory 全部 kernel、六维 recall 全部命中原文、confirmed business corpus；
4. Journey 与 interaction：
   - `doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md`
   - `doc/decisions/2026-07-25-v2s-r5-whole-scope-interaction-design.md`
5. owning decision 与三类精确数据：
   - `doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md`
   - `doc/plans/platform/2026-07-25-v2s-r5-edge-operation-inventory.md`
   - `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-dialectical-assessment.md`
   - `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`
   - `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`
   - `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`
   - `contracts/policy/frontend-asset-carryover-manifest.json`
   - `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`
6. 详设：
   - `doc/plans/platform/2026-07-25-v2s-r5-development-agent-execution-blueprint.md`
   - `doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md`
   - `doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-granularity-manifest.json`
   - `doc/review/platform/2026-07-25-v2s-r5-whole-scope-manifest-chapter-hit-map.md`
7. 两轮独立审查与作者 intake：
   - `doc/review/platform/2026-07-25-v2s-r5-design-adversarial-review-round-1.json`
   - `doc/review/platform/2026-07-25-v2s-r5-design-round-1-finding-intake.md`
   - `doc/review/platform/2026-07-25-v2s-r5-design-adversarial-review-round-2.json`
   - `doc/review/platform/2026-07-25-v2s-r5-design-round-2-finding-intake.md`
   - `doc/review/platform/2026-07-26-v2s-r5-whole-scope-design-review-claude-resolution.md`
8. 反向审计：
   - `doc/review/platform/2026-07-25-v2s-r5-v2-value-and-v2s-constraint-audit-codex.md`

## 独立核验重点

- 重算 `32 scenarios ↔ 104 operations = 38 platform + 55 operations + 11 public` 双向闭合；
- 核对 page-guard/role-candidate 删除与 platform assignment revoke 新增，不允许旧 component
  从 baseline 复活；
- 核对每个 operation 的 owner/page/security/request/response/status/idempotency/CAS/error/test；
- 核对 G-01～G-10：`groupWorkspaceKey`、邀请链、四维不互推、品牌授权不扩权、门店启停不
  推合同、货号 `{code,name}` 与三态；
- 核对 backend foundation 白名单，确认没有把 messaging/proof/internal service/downstream
  translator 搬回；核对 frontend foundation 的旧 `workspaceKey` 已成为明确实施改动；
- 核对所有后台时间点固定为 Java long/Long + PostgreSQL BIGINT epochMillis，合同纯业务
  日期例外没有被误用；
- 核对 OpenAPI source 按 face+capability、owner+schema family 分类，根入口不内联、手写
  单文件不超过 500 非空行；
- 核对 22 个 frontend surface、180 个 source files 的 hash/target/foundation/generated
  slice/route/evidence，以及 7 项 `NOT_CARRIED` 负向闭包；
- 核对 `r5-full` 的 32 行正负前提、15 个 secret/purpose、精确 reset allowlist、固定
  clock/date、business/cleanup 分账是否足以让 Dexter 无手工补数据测试；
- 判断 12 unit 的 package/class/table/transaction/page/test/seed 路径是否足够让开发 agent
  少走偏，而不是只在最后 gate 才发现结构错误。

## 4. 已知审查历史与机械结果

- round 1 历史 verdict：`NO_GO(3 M / 4 S / 0 N)`，已 intake/remediate；
- round 2 终局历史 verdict：`NO_GO(3 M / 4 S / 0 N)`，已 intake/remediate；
- 两轮上限已到，禁止第三轮 Codex 对抗审查；
- Claude 首轮全范围 verdict：`NO-GO(23 M / 36 S / 10 N)`；逐 finding intake 与 owning
  修订见 2026-07-26 resolution 文件；
- Claude Part R 复核 verdict：`NO-GO(2 M / 9 S / 12 N)`，确认前轮 69 项中
  `62 CLOSED / 7 PARTIAL / 0 NOT_CLOSED`；本轮已逐项补齐 Part R 23 项；
- post-remediation：standards coverage R5、granularity self-test/production、
  Roadmap registry、agent lifecycle、project-memory、handoff 与 104/32/22 数据核验均须
  fresh PASS；
- production granularity checker 通过 `POST_REMEDIATION_V1` 明示输出
  `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`。它只证明历史 review 与当前修订 provenance
  闭合，不声称独立子 agent 看过当前字节，也不把历史 NO-GO 改写成 GO。

## 期望结论

请输出 `GO` 或 `NO-GO`，并给出 `M/S/N` 计数；每个 finding 必须给 owning path/anchor、
反例、最小修复与是否需要 Dexter 产品裁决。review 文件建议落：

`doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-review-claude.md`

本次只审 DESIGN。不得创建/修改正式 contract、app、数据库、Flyway、测试或业务源码；
不得启动 DEV、连接远端中间件、执行 seed/reset 或动态业务运行。即使设计 GO，也不产生
R5 implementation authorization。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 R5 全范围 implementation-facing design 的 Part R 修订包做终验。

背景：首轮结论为 NO-GO(23 M / 36 S / 10 N)；Part R 复核确认 62 CLOSED、7 PARTIAL，
并给出 NO-GO(2 M / 9 S / 12 N)。Codex 已逐项重开 owning source，完成 Part R 全部
23 项表格级/行级修订；两轮独立子 agent 对抗审查上限已到，本次不重开第三轮。
production granularity 继续以 POST_REMEDIATION_V1 诚实输出
DECLARED_POST_REMEDIATION_AWAITING_CLAUDE，只证明 provenance，不宣称你看过当前字节。

目标：独立核验 Part R 的 2 M / 9 S / 12 N 是否全部关闭、前一轮已关闭项是否零回退，
并判断当前 R5 全范围详设能否给出 GO；若仍 NO-GO，请给每项 finding 的 owning
path/anchor、可复现反例与最小修复。

请从 catering-v2s 仓根重点阅读：
- doc/review/platform/2026-07-26-v2s-r5-whole-scope-design-review-claude-resolution.md
- doc/decisions/2026-07-26-v2s-r5-claude-review-five-point-resolution.md
- doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md
- doc/plans/platform/2026-07-25-v2s-r5-development-agent-execution-blueprint.md
- doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json
- doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json
- doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json
- contracts/policy/frontend-asset-carryover-manifest.json
- doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json
- doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-granularity-manifest.json
- doc/review/platform/2026-07-25-v2s-r5-whole-scope-manifest-chapter-hit-map.md

请重点独立核验：84 个 Heritage/R3 active target + 22 个 v2s-native code 是否全部 wire
可达且无未登记码；R3 init 是否只发六个兼容码；139 resolved + 1 NOT_CARRIED component
是否零歧义；frontend 是否零 foundationPrimitives shadow、两密码 Drawer/route/text/hash/
scaffold 是否闭合；R3 四项 FORCE RLS disposition、workspace_uuid 复合 unique/FK、
storeStatus、phase snapshot、34-action catalog 与 asset reset 语义是否一致；并确认
104/38/55/11/32 与 22/180 分母未漂移。

烦请给出明确 GO 或 NO-GO，并按 M / S / N 计数。评审文件仍落
doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-review-claude.md。

授权边界：本次只复核 DESIGN。不得开始或授权 R5 implementation，不得创建/修改正式
contract、app、数据库、Flyway、测试或业务源码，不得启动 DEV、连接远端中间件或执行
seed/reset。即使 GO，也只可交 Dexter 接受和另行决定 implementation exact authorization。
谢谢。
```
