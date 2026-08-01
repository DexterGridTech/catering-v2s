---
title: R3 全范围 implementation-facing 详设 Claude 评审请求
status: READY_FOR_CLAUDE_REVIEW
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewKind: IMPLEMENTATION_FACING_DESIGN
implementationAuthority: false
---

# R3 全范围 implementation-facing 详设 Claude 评审请求

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-adversarial-review.json

## 背景

Dexter 已接受 C-01 的 carry-over-first 交互线框，并明确把交付要求从“仅 C-01 详设”扩大为
“一次性完成整个 R3 的详设与实施计划，完成 Dexter/Claude review 后可进入开发”。C-01 仍是
唯一业务 Journey；R3-TECH 只作为其运行骨架。本次设计不恢复历史 J01/J02，也不恢复 C-02 的
operations-admin 真实登录。

设计已经通过 `scripts/check/implementation-design-granularity`、其 self-test/red fixtures、
Codex solution-reasonableness self-review、project-memory、R3 standards coverage 和 Roadmap
registry 检查。当前仍无 implementation authority。

## 评审目标

请独立核验这份总详设是否真的足以在后续获得 implementation exact authorization 后指导整个 R3
开发：外部受控前提是否没有被偷换成虚构登录/seed；单体 owner/REQUIRED transaction/schema FK
是否正确；C-01 contract、前端交互和 readback 是否忠实；operations-admin 是否只证明独立 app；
Gate 0、代码生成、五命令、测试、dynamic business/cleanup 是否有可执行且不越界的闭环。

## 需阅读文件

- `doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md`：七个串行实施单元、owner/事务、契约、数据、双 app、脚本和 evidence 总设计；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json`：路径级单位、批准来源、依赖顺序、evidence 与 red controls；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-codex-self-review.md`：Codex 从业务用户与 Dexter 立场的第一轮对抗自审；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-adversarial-review.json`：七单位逐项 verdict 和两个 N；
- `doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-journey-inventory.md`：C-01 任务、四项外部前提、禁推；
- `doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md`：Dexter 已接受的四屏交互和 carry-over 对照；
- `project-memory/decisions/confirmed-business-language-corpus.md`：G-01/G-03/G-10 业务语言与禁推；
- `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`：单 deployable、owner、事务、schema、edge face 的架构权威；
- `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md`：前端 source freeze-before-carry 纪律；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：R3 当前授权状态、R3 交付/验收和 J02/C02 停止线；
- `contracts/policy/standards-coverage-matrix.json`：R3 review checklist 和机械/语义边界。

## 独立核验重点

- 从 C-01 真实用户任务独立推导是否应为“外部受控 platform access → 列表 → 详情 → 初始化 → owner readback”；确认没有擅自加入账号/空间创建、组织树、门店或 operations 真实登录；
- 外部 `X-Edge-Auth`/既有 group workspace 前提是否被设计成 fail-closed、可记录的部署/run input，而非默认 root、test seed 或从 UI 偷建数据；若该选择应改为产品登录 Journey，请明确标 Dexter 裁决；
- `platform-workspace`/`organization` owner 分界、public command、同一 REQUIRED、composite FK、unique conflict 和 audit 是否符合 ADR，且没有 internal HTTP/client、outbox、跨 schema DML 或先查后写竞态；
- OpenAPI 三个 platform operation、`groupWorkspaceKey`、`x-consumer-faces` 生成 closure、operations empty receipt 是否与 C-01 和双 app 边界一致；
- Gate 0 是否仅包含 R3 必须的机械门且真的先于 business source；R4 的完整验证是否没有被偷报为已完成；
- 前端 carry-over 是否先 registry/frozen 再 ADAPT，交互是否仍是 Dexter 看过的四屏，成功是否真正 owner readback；
- evidence 是否把 static/L2/L3/business/cleanup 分账，dynamic 是否经 proxy 而非直连 app，cleanup 是否是完成条件；
- 复跑 `scripts/check/implementation-design-granularity --manifest ... --review ...`、`scripts/check/standards-coverage --phase R3`，并按 CLAUDE.md 在 scratchpad 对 red controls 做独立变异，不把 self-test 或文档自报当作语义证明。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。请单列判断：N-01（外部前提 adapter）和 N-02（Heritage freeze-before-carry）是否足以保持为 N，或应升级。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 R3 全范围 implementation-facing 详设与实施计划。

背景：Dexter 已接受 R3-C01 的 carry-over-first 交互线框，并要求一次性完成整个 R3 的详设与实施计划，完成 Dexter/Claude review 后可进入开发。C-01 仍是唯一业务 Journey；R3-TECH 只作其运行骨架。此次不恢复历史 J01/J02，也不恢复 C-02 的 operations-admin 真实登录。当前材料仅为设计评审，尚未授权任何实现。
目标：请独立核验该总设计能否在后续精确 implementation authorization 后指导 R3 开发，特别是外部受控前提、单体 owner/事务/schema、C-01 契约与交互、双 app 边界、Gate 0、脚本、测试和 business/cleanup evidence 是否既完整又不扩权。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md：R3 总详设和七个串行实施单元；
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json：路径级交付/依赖/evidence/red-control 分母；
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-codex-self-review.md：Codex 第一轮对抗自审；
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-adversarial-review.json：七单位 verdict 与 N-01/N-02；
- doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-journey-inventory.md：C-01 前提与禁推；
- doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md：Dexter 已接受交互；
- project-memory/decisions/confirmed-business-language-corpus.md：G-01/G-03/G-10；
- doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md：owner/事务/schema/edge face 权威；
- doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md：前端搬运纪律；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md：R3 当前状态与停止线；
- contracts/policy/standards-coverage-matrix.json：R3 review checklist。

请重点独立核验：外部 platform access/既有空间是否是可执行且 fail-closed 的前提输入，而没有变成 root、seed、默认账号或 C-01 偷建空间；platform-workspace/organization 的 command、REQUIRED、FK、unique conflict/audit 是否忠实于单体 ADR；三项 platform OpenAPI/face/codegen 与 operations 空 slice 是否没有伪造 operations 登录；Gate 0 是否只做 R3 最小机械门且先于 source；C-01 页面是否仍遵守列表→详情→Drawer→owner readback，且 Heritage 先冻结再搬运；dynamic evidence 是否经 proxy、business/cleanup 是否分账。请 fresh 复跑 granularity 与 R3 standards checks，并在 scratchpad 独立验证 red controls。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决；请明确判断 N-01（外部前提 adapter）和 N-02（Heritage freeze-before-carry）维持 N 是否合理。

授权边界：本次 GO/NO-GO 仅评价 R3 全范围 implementation-facing 设计。它不授权实际 implementation、任何 app/contract/database/migration 写入、代码搬运、DEV、动态运行、seed/reset、Git 或 Roadmap step 完成；实施仍须 Dexter 在接受评审后另行精确授权。谢谢。
```
