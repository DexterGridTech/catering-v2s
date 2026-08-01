---
REVIEW_KIND: IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST: doc/review/platform/2026-07-25-v2s-r4-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT: doc/review/platform/2026-07-25-v2s-r4-design-adversarial-review-round-2.json
title: R4 whole-scope implementation-facing design Claude review request
type: review
status: READY_FOR_CLAUDE
reviewTarget: doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md
reviewer: Claude
createdAt: 2026-07-25
---

# R4 whole-scope implementation-facing design Claude review request

## 背景

R3 已关闭。Dexter 已明确授权 Codex 开启 R4 详设和实施计划；R4 是 Roadmap W2 的
机器门、`scripts/verify`、red fixtures、数据库/契约/边界/退役验证，不是业务 Journey。
本 packet 只形成 implementation-facing design，`R4_IMPLEMENTATION_AUTHORIZED=false`。

## 评审目标

请独立核验八个 R4 implementation units 是否完整覆盖 Roadmap R4 交付物、是否符合
单 deployable/单 PostgreSQL/单 Flyway/双 admin app/foundation wire-agnostic 边界，
以及每个 machine rule 是否具备 production validator、真实 red mutation、分钟级
`scripts/verify` 接线和 business/cleanup 分账。请特别检查 R4 是否误造业务 Journey、
恢复 J02/C-02、引入 TDP/MQ/outbox/第二真相，或把语义判断偷换成关键词 checker。

## 需阅读文件

- `doc/decisions/2026-07-25-v2s-r4-design-authorization.md`：本轮仅设计授权；
- `doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md`：全范围详设和实施顺序；
- `doc/review/platform/2026-07-25-v2s-r4-design-granularity-manifest.json`：八单元、路径、证据和 Part B-D 映射；
- `doc/review/platform/2026-07-25-v2s-r4-design-manifest-chapter-hit-map.md`：章节级命中对照；
- `doc/review/platform/2026-07-25-v2s-r4-design-codex-self-review-round-2.md`：Codex 第二轮最终自审；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` §10：R4 现行 Roadmap 分母；
- `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`：服务/模块/数据库/契约冻结 ADR；
- `doc/decisions/2026-07-24-v2s-verification-governance.md`：机器门三问、真红和效率边界；
- `contracts/policy/standards-coverage-matrix.json` 与 `project-memory/decisions/deterministic-context-only.md`：标准分母和确定性执行规则。

## 独立核验重点

1. `R4-U01–U08` 是否覆盖 Roadmap §10 的 11 项交付物并保持严格依赖顺序；
2. B.1–B.6、Part C normative groups、D.1–D.8 是否每章都有规则 ID + 设计位置或明确 N/A；
3. `scripts/verify` 是否只编排 owning validator，且每个 gate 的 red fixture 真能抵达 production `run()`；
4. Testcontainers 是否与 DEV/seed/reset 隔离，business 与 cleanup 是否不会互相冒充；
5. OpenAPI face、server registry、两个 app generated slice、foundation 反向依赖和可达闭包是否有单一真相；
6. R4 是否明确不新增业务用户、UI、operations 登录、TDP、MQ、outbox 或 R5 scope；
7. 后续任何 UI 设计是否被强制要求先对照 all-v2 对应页面/交互并记录 `CARRY / ADAPT / NOT_CARRIED`，优先消费 `libraries/frontend/admin-ui-foundation`，而非重复实现既有基础能力；
8. R4 standards coverage 当前 FAIL 是否被诚实解释为未实施，而非由文档或 status-only 修改伪绿。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有问题请按 `M` / `S` / `N` 标注精确文件与行号、
影响面、最小修复、是否需要 Dexter 产品/范围裁决；finding 必须先重开 owning source，
不要仅凭关键词或文件存在作语义结论。

## 授权边界

本次 review 的 GO 只代表 R4 全范围 implementation-facing 设计可交 Dexter 接受；不
授权创建或修改 R4 app、contract、数据库、Flyway、测试/业务源码，不授权 DEV、动态
运行、seed/reset，也不改变 R3/J02/C-02/TDP 边界。R4 实施必须另获精确授权。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 catering-v2s 的 R4 全范围 implementation-facing 详设与实施计划。

背景：R3 已关闭；Dexter 已授权本轮形成 R4/W2 的一次性详设和实施计划。R4 是机器门、scripts/verify、red fixtures、数据库/契约/边界/退役验证，不是业务 Journey；本轮仍未授权 R4 实施。
目标：请独立核验 R4-U01–U08 是否完整覆盖 Roadmap §10、Part B.1–B.6、Part C normative groups、Part D.1–D.8，并核对 production validator、真红 mutation、分钟级 verify、Testcontainers 隔离、business/cleanup 分账及无范围膨胀。

请从 catering-v2s 仓库根阅读：
- doc/decisions/2026-07-25-v2s-r4-design-authorization.md：仅设计授权；
- doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md：全范围详设；
- doc/review/platform/2026-07-25-v2s-r4-design-granularity-manifest.json：八单元、路径、证据、标准映射；
- doc/review/platform/2026-07-25-v2s-r4-design-manifest-chapter-hit-map.md：Part B-D 章节命中对照；
- doc/review/platform/2026-07-25-v2s-r4-design-codex-self-review-round-2.md：Codex round-2 final self-review；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md §10：R4 交付物；
- doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md：服务/模块/数据库/契约边界；
- doc/decisions/2026-07-24-v2s-verification-governance.md：建门三问、真红、分钟级 verify；
- contracts/policy/standards-coverage-matrix.json、project-memory/decisions/deterministic-context-only.md：标准分母与确定性规则。

请重点独立核验：R4 是否误造业务 Journey、恢复 J02/C-02、引入 TDP/MQ/outbox/第二真相；每个 gate 是否真正接入 production run() 并有行为变异 red fixture；face/generated/foundation、Flyway/FK/query、日志/retirement/handoff、affected-L2 与 business/cleanup 是否闭合；当前 standards-coverage R4 FAIL 是否被诚实保留为未实施状态。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M/S/N 标注精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品/范围裁决。

授权边界：本次结论只评价 R4 全范围 implementation-facing 设计是否可交 Dexter 接受，不授权任何 R4 app、contract、数据库、Flyway、测试/业务源码、DEV、动态运行、seed/reset，也不改变 R3/J02/C-02/TDP 边界。谢谢。
```
