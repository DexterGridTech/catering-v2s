---
title: RM1 P3-A+B+C implementation review request for Claude
reviewTarget: IMPLEMENTATION
scope: RM1 P3-A + P3-B + P3-C only
priorIndependentReview: RM1-P3-ABC-IMPLEMENTATION round 2 GO M=0/S=0/N=2
authorizationBoundary: Review only; no source changes, DEV, seed, reset, migration, Roadmap-state mutation, P1, or third independent-review round.
createdAt: 2026-07-28
---

# RM1 P3-A+B+C implementation review request

## 背景

Dexter 要求 P3-A、P3-B、P3-C 完成后先由 Dexter 与 Claude 复核，再进入下一 P。P3-C 第一轮独立 implementation review 为 `NO-GO (M=1/S=1)`，已按 owning sources 完成最小整改；第二轮已 hard stop 并给出 `GO (M=0/S=0/N=2)`。请 Claude 重新从生产源码、契约、generated outputs 与 package evidence 独立判断，不采信作者或独立 reviewer 的结论作为前提。

## 评审目标

核验 P3-A+B+C 是否真实完成 approved implementation scope：operations workspace 的 server-derived task scope 是否不能被客户端扩大；组织 owner 的 task-path 是否正确用于成员可见性；`scopeRef` 是否只保留在真实选择端点；OpenAPI、generated Java/TypeScript、edge controller 与 owner command 是否一致；以及 generated-output receipt 缺口是否以可审计重放闭合。

## 需阅读文件

- `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md`：批准范围与完成条件。
- `doc/evidence/platform/rm1/p3-a/rm1-u02-package-exit.json`、`doc/evidence/platform/rm1/p3-b/rm1-u03-package-exit.json`：P3-A/B exit。
- `doc/evidence/platform/rm1/p3-c/rm1-u04-package-input.json`、`doc/evidence/platform/rm1/p3-c/rm1-u04-implementation-amendment.json`、`doc/evidence/platform/rm1/p3-c/rm1-u04-package-exit.json`：P3-C 范围、整改与 exit。
- `doc/evidence/platform/rm1/p3-c/rm1-u04-generated-output-receipt-discovery.json`、`doc/evidence/platform/rm1/p3-c/rm1-u04-generated-output-replay.json`：generated 输出基线发现与精确重放。
- `doc/evidence/platform/rm1/p3-c/rm1-p3-abc-implementation-review-round1-independent.md`、`doc/evidence/platform/rm1/p3-c/rm1-p3-abc-implementation-review-round2-independent.md`：两轮独立审查记录；第二轮已 hard stop。
- `libraries/backend/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceMembershipService.java`、`libraries/backend/organization/src/main/java/com/catering/v2s/organization/api/OrganizationTaskPathLookup.java`：成员可见性与 owner task-path API。
- `contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml`、`contracts/openapi/paths/operations-admin/workspace-access.paths.yaml`、`scripts/generate/edge-codegen.mjs`：P3-C 契约与 codegen。

## 独立核验重点

1. 反证 M1 是否真正闭合：针对 `GROUP`、`REGION`、`PROJECT` 和 peer branch，确认 membership page 由 server-derived `TaskPath` ancestor relation 决定，客户端没有 page-design/target-org 注入面。
2. 全量同根搜索 `scopeRef`，确认它仅留在真实选择端点；action/detail/revoke 的 OpenAPI、wire、controller、test 均不再接受或忽略它。
3. 对照 five target page identities 与 eight operations，核验 OpenAPI、generated Java/TypeScript、controller 及 owner command 的 exact surface；`node scripts/generate/edge-codegen.mjs --check` 应一致。
4. 核验 `doc/evidence/platform/rm1/p3-c/rm1-u04-generated-output-replay.json`：它必须保留已证实旧基线到当前权威生成字节的 receipt 链，而非删除后未记录的再生成。
5. 区分静态门与动态业务证据：P3-C 完整 library suite 的一次受管尝试被历史 fixture 失败阻断，未被伪称为 P3 business PASS。请明确判断这是否构成阻断。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，使用 `M= / S= / N=` 汇总。每项 finding 要有精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品裁决。第二轮独立 review 已硬停止；不得将本请求解释为授权第三轮独立子 agent 审查。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 RM1 P3-A+B+C implementation closure。

背景：Dexter 已要求 P3-A+B+C 完成后先由 Dexter 与 Claude 复核，再进入下一 P。P3-C 第一轮独立实现审查曾为 NO-GO（M=1/S=1），整改后第二轮独立审查已硬停止并给出 GO（M=0/S=0/N=2）；请不要采信该结论，直接重开生产源码、契约和证据独立判断。
目标：请独立核验 server-derived task scope、组织 owner task-path 成员可见性、scopeRef 契约收敛、OpenAPI/generated/controller 一致性，以及 generated-output receipt 缺口是否以可审计精确重放闭合。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md：批准范围与完成条件；
- doc/evidence/platform/rm1/p3-a/rm1-u02-package-exit.json、doc/evidence/platform/rm1/p3-b/rm1-u03-package-exit.json：P3-A/B exit；
- doc/evidence/platform/rm1/p3-c/rm1-u04-package-input.json、doc/evidence/platform/rm1/p3-c/rm1-u04-implementation-amendment.json、doc/evidence/platform/rm1/p3-c/rm1-u04-package-exit.json：P3-C 范围、整改与 exit；
- doc/evidence/platform/rm1/p3-c/rm1-u04-generated-output-receipt-discovery.json、doc/evidence/platform/rm1/p3-c/rm1-u04-generated-output-replay.json：generated 输出基线发现与精确重放；
- doc/evidence/platform/rm1/p3-c/rm1-p3-abc-implementation-review-round1-independent.md、doc/evidence/platform/rm1/p3-c/rm1-p3-abc-implementation-review-round2-independent.md：已完成的两轮独立审查记录；
- libraries/backend/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceMembershipService.java、libraries/backend/organization/src/main/java/com/catering/v2s/organization/api/OrganizationTaskPathLookup.java：成员可见性及 owner task-path；
- contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml、contracts/openapi/paths/operations-admin/workspace-access.paths.yaml、scripts/generate/edge-codegen.mjs：契约与生成边界。

请重点独立核验：GROUP/REGION/PROJECT/peer-branch 的 ancestor 可见性是否由服务器确定；全量 scopeRef 是否仅留在真实选择端点且不再被 action/detail/revoke 接受；five target page identities 与 eight operations 是否在 OpenAPI/generated/controller/owner command 精确一致；以及 replay 是否保留基线→最终字节链。可运行 node scripts/generate/edge-codegen.mjs --check；并请区分静态门结论与动态业务证据——完整 library suite 的一次受管尝试被历史 fixture 失败阻断，不能被写成 P3 business PASS。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次仅授权 RM1 P3-A+B+C 的只读 implementation review 与 verdict；不授权修改源码、DEV、seed、reset、migration、Roadmap 状态变更、启动 P1 或重开第三轮独立子 agent 审查。谢谢。
```
