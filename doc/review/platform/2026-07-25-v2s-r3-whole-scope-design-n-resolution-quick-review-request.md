---
title: R3 全范围详设 N 项修订 Claude 快速复核请求
status: READY_FOR_CLAUDE_QUICK_REVIEW
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewKind: IMPLEMENTATION_FACING_DESIGN
implementationAuthority: false
---

# R3 全范围详设 N 项修订 Claude 快速复核请求

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-adversarial-review-round-2.json
MANIFEST_CHAPTER_HIT_MAP=doc/review/platform/2026-07-25-v2s-r3-whole-scope-manifest-chapter-hit-map.md

## 背景

Claude 已对 R3 全范围 implementation-facing 详设给出 `GO(0 M / 0 S / 5 N)`。Dexter 接受
N-1 的推荐处置：operations-admin 的用户可见静态边界页已补进 C-01 interaction artifact 附录并
接受看图。N-2 至 N-5 与制度化要求也已按最小范围回补。本次仅复核这些修订，不能重开 R3 scope，
不能把 retained implementation-acceptance N 扩写成新产品 Journey。

## 评审目标

请独立确认五项 N 和制度化修订是否忠实、最小且闭合：U06 可见 boundary route 有明确线框但不伪造
operations 登录；U04/U07 的 DB 往返预算进入 integration/L2；U03/U05 的 Problem code generation 与
穷尽文案映射可使遗漏在 typecheck 暴露；C-01 四屏业务文案受 L2 约束；skill 回执正确；任何后续
design/implementation-facing Claude review 都附 manifest Part B、Part C 规范性条款与 Part D 章节级命中对照。

## 需阅读文件

- `doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md`：N-2 至 N-5 的总设计落点；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json`：七 unit 的 source/UI/evidence 绑定；
- `doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md`：四屏与 `operations-r3-boundary` 附录线框、Dexter 看图接受；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-codex-self-review-round-2.md`：同一 cycle 的最终定向自审；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-adversarial-review-round-2.json`：当前 manifest hash 对应的七 unit verdict；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-manifest-chapter-hit-map.md`：必附的 Part B/B.1–B.6、Part C 规范性条款与 Part D 章节级命中对照；
- `CLAUDE.md` 与 `contracts/policy/standards-coverage-matrix.json`：新设评审材料完整性要求；
- `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`：B.3.3、B.6.6、D.2 的冻结原文。

## 独立核验重点

- 对 U06 重新从使用者视角判断：静态边界文案是否足以避免“独立 app = 可真实登录”的误解，同时又未
  创造账号、session、endpoint、菜单或业务页面；
- 重开 B.6.6，确认 list/detail 各 `databaseOperationCount ≤3`、initialize write `≤5` 已进入 U04/U07
  integration/L2，而非只写在 prose 或被拆 endpoint 绕过；
- 重开 B.3.3/D.2，确认 Problem code 是 OpenAPI components 闭集、双端由 codegen 生成 typed 常量、
  前端是 `switch` + `never` 穷尽映射，并不允许手写错误码字符串；
- 确认 U07 对 C-01 四屏的正向术语和禁用术语断言是局部 L2，不是新关键词式语义 checker；
- 核对总详设头部 `SKILL_USED=cs-writing-plans@72190c88…` 与本仓适配 skill 一致；
- 以 `doc/review/platform/2026-07-25-v2s-r3-whole-scope-manifest-chapter-hit-map.md` 核对 Part B 的 B.1–B.6
  与 Part D 的每一章都有“命中条目号 + 设计落点”或 `NOT_APPLICABLE + 理由`；缺表则不出 verdict；
- fresh 运行 `scripts/check/codex-self-review --file ...round-2.md`、
  `scripts/check/implementation-design-granularity --manifest ... --review ...round-2.json`、
  `scripts/check/standards-coverage --phase R3`，并对需要的 hash/结构结论独立复算。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，使用 `M` / `S` / `N` 计数。finding 必须给精确文件/行、影响面、最小
修复建议，以及是否需要 Dexter 产品裁决。请单列：这次修订是否仍保持 R3 不授权 implementation、
contract、数据库、DEV、动态运行、seed/reset 或 Git。

## 授权边界

本次快速复核只评价 N 项修订及其设计一致性；无论 `GO` 或 `NO-GO`，均不授权 implementation、
contract、数据库、DEV、动态运行、seed/reset、Git 或 Roadmap 完成。只有 Dexter 在接受复核后才能
另行给出 R3 implementation exact authorization。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 R3 全范围 implementation-facing 详设的 N 项修订做一次快速独立复核。

背景：你此前给出 GO(0 M / 0 S / 5 N)。Dexter 已接受 N-1 的最小处置：operations-admin 的用户可见静态边界页已补进 C-01 交互工件附录并看图接受；N-2 至 N-5 和“每次设计类评审必须附 manifest Part B、Part C 规范性条款与 Part D 章节级命中对照”也已回补。本次只核这些修订，不重开 R3 范围，仍不恢复 operations 真实登录。
目标：请独立确认修订是否忠实、最小、可实施且不把设计约束偷换成伪语义 checker；特别核验 U06 静态边界页、DB 往返预算、OpenAPI Problem code 双端生成与前端穷尽文案映射、四屏业务文案 L2、skill 回执和 Part B/Part C/Part D 章节对照。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json
- doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-codex-self-review-round-2.md
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-adversarial-review-round-2.json
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-manifest-chapter-hit-map.md
- CLAUDE.md、contracts/policy/standards-coverage-matrix.json、doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md

请重点独立核验：boundary 页只说明“本阶段未开放运营业务”而没有登录/session/业务假象；list/detail 各 databaseOperationCount≤3、初始化写≤5 已进入 integration/L2；Problem code 是 OpenAPI 闭集且由 codegen 为双端生成，前端 switch+never 遗漏即 typecheck 红；四屏正向“集团空间/商业集团/编码/名称”与禁用 workspaceKey/aggregate/内部错误/诊断是局部 L2；Part B(B.1–B.6)、Part C 规范性条款组与 Part D 每章均有命中条目号+设计落点或 NOT_APPLICABLE+理由。请 fresh 运行 round-2 self-review、granularity 和 R3 standards checks，并独立复算必要 hash。

请给出明确 GO 或 NO-GO，并报告 M / S / N 数量。若有 finding，请标精确文件与行、影响面、最小修复建议、是否需 Dexter 产品裁决。

授权边界：本次结论只评价 N 项修订及设计一致性，不授权 implementation、contract、数据库、DEV、动态运行、seed/reset、Git 或 Roadmap 完成；后续实施仍须 Dexter 另行精确授权。谢谢。
```
