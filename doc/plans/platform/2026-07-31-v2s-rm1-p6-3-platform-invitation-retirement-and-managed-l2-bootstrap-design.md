---
title: RM1 P6-3 平台邀请面退役与远端受管 L2 引导依赖详设
status: DESIGN_FOR_INDEPENDENT_REVIEW
programContext: V2S_RM1_REMEDIATION
decisionOwner: Dexter
implementationAuthority: true
---

# 目标与已裁定业务边界

IA01 已裁定旧的 platform-face invitation management 必须退役；新任职只由运营管理后台五个 target-specific 用户页发起、取消和重发邀请。平台空间账号页保留账号查询、详情、状态、凭据与任职撤销，但不保留邀请 Tab。此修订不创建新用户任务、不删除 operations/public invitation flow，也不把 L2 便利性变成 runtime HTTP 面。

IA03 `IA03-ACCOUNT-TAB` 中“邀请 Tab / 进入子流”是与 IA01、physical import contract 和 final roster 冲突的 accepted-byte 残留。重冻结只修改该 selector：账号页为单一内容页，包含账号筛选、名称链接、详情及已批准账号/任职上下文动作；邀请仅存在于 IA01 的 operations 五个 target-specific 页面。它不改 IA01、Account detail 或 operations invitation screen。

# 原子退役分母

同一 implementation receipt set 必须处理下列闭包；不得单点删页面、OpenAPI 或 allowlist。

1. `platform-admin`：AccountsPage 去除旧邀请 import/state/Tab/render；删除 InvitationsPage、其唯一依赖 PlatformAuditHistoryModal 及 barrel。
2. platform HTTP face：删除两个 platform invitation controller；从 platform workspace-access OpenAPI 移除 get/create/candidate/cancel/reissue 五 operation；从治理 manifest 移除三条 platform mutating requirement；保留 target-specific operations 与 public invitation contracts。
3. audit：保留平台 audit endpoint 和 workspace-IAM audit owner；仅从 platform controller dispatch 与 platform audit enum 移除 `WORKSPACE_INVITATION`，operations audit 同类能力不动。
4. generator inputs：从 R5 edge catalog 的五个 operation entry（其 `scenarioIds: ["D04-S05P"]`）、`operationErrorAugmentations` 的两个实际 key（`createWorkspaceInvitation`、`cancelWorkspaceInvitation`），以及 placement report 的同五条 entry 同时删去；分母 `119→114`、platform face `48→43`。generator 实际还读取 error disposition catalog、admin catalog、frontend carry-over manifest 与 face-reachable OpenAPI；它们是输入完整性反例，本退役不虚构 `scenarioCrosswalk`、第三个 augmentation 或未存在的 error-selection key。随后只能通过 controlled edge-codegen receipt 写入真实输出 diff。
5. generated outputs：实际 diff 才是最终分母；预期受影响的是 platform API/RTK、route/capability projections，但 receipt 必须给出完整非空精确集合。共享 invitation schemas、`WorkspaceAccount.invitationHistory` 与 operations/public wire 不是本退役对象，除非生成器的实际可达性计算证明某文件只属于已退役 platform face。

每个删除前必须先枚举 production importer；AccountsPage、PlatformAuditHistoryController、operations/public flow 和 operations audit 是明确反例，必须保留。

# L2 首个 operations 账号引导：当前依赖边界

旧 managed fixture row 7 通过即将退役的 platform `createWorkspaceInvitation` 建立第一个 operations account，因此不能在退役后继续调用它，也不能改为直接 SQL 或保留兼容 HTTP。

`WorkspaceInvitationService.create(UUID, String, String, List<AssignmentIntent>, String, AuditActor)` 是唯一可接受的 bootstrap write owner API；其既有 `@Transactional` 与 command receipt 不得被 SQL、Controller 或兼容 platform HTTP 替代。首个 intent 必须在 owner re-read 后为单一 GROUP intent，并由 role/group-root/workspace-enabled owner API 证明。

但现有 `r5-remote-testcontainers.mjs` 只在隔离 Testcontainers 数据库执行单个 Gradle test；现有浏览器 L2 则是本机 DEV/`127.0.0.1` runner。两者不能共享数据库或安全交接 invitation token。因此本 static retirement package 不实现、也不假称已设计完成 `WebApplicationType.NONE` launcher、stdout frame 或远端 token 交接。它只把 fixture 的旧 platform HTTP 调用登记为后续独立 remote managed-L2 package 的硬前置债务；该 package 必须先给出同一远端数据库/进程边界、test-only context、私有 input/output channel、run manifest/log redaction、owner readback、failure/cleanup 的可执行设计和真实 red proof，才可以写 bootstrap 或执行 L2。

# 准入、验证和状态

active package 必须一次纳入上述 handwritten、contract、catalog/report、generator-owned actual output、IA03 refreeze evidence 和 focused tests；每一个 target 绑定 IA01、IA03（待冻结）、六维命中 memory、reachability problem family、roster/import contract 与当前 source 的 prewrite readback。平台手写前端路径不能只靠 generated API allowlist 放行。

静态顺序：OpenAPI/face/capability gates → controlled edge-codegen receipt → platform and operations typecheck/focused tests → dual-admin production import scan → U03 final control-alignment exact set。全部 UI 控件逐项 IA alignment PASS 前，L2 仍禁止。联合 L2 的结果必须独立记录 business 与 cleanup；本设计不把静态结果说成二者任一 PASS。

## 实施分母、receipt 与 manifest 补充

本设计落地前，`rm1-u09-implementation-design-granularity-manifest.json#RM1P6-U03` 必须增加一个由本设计 hash 绑定的 serial sub-unit，而不是以现有 broad `changeSurfaces` 代替。它的六类 package-exit source denominator 是：

| 类别 | exact source denominator | owning source / 证明 |
| --- | --- | --- |
| IA 与产品 | IA01 platform-face retirement；IA03 `IA03-ACCOUNT-TAB` selector；IA03 refreeze receipt | IA01 operations-only invite；IA03 old/new hash 与 roster selector |
| hand-written consumer | AccountsPage、AccountsPage test、InvitationsPage、PlatformAuditHistoryModal、audit-history barrel | production importer exact scan；AccountsPage retained |
| contract/edge | two platform invitation controllers；platform workspace-access + audit-history paths；IAM governance manifest | `x-consumer-faces`/controller mapping；operations/public counterexample scan |
| generator source | R5 edge contract catalog and placement report | exact five `operationId` removal and `119→114`/`48→43` closure |
| generator output | `edge-codegen --check` derived exact diff (current clean denominator is 246 outputs) | controlled `--write-receipt` only; no predicted output list may replace actual diff |
| L2 dependency | managed L2 design, fixture, runner, affected-L2 registry/carry-over manifest | current fixture row 7 must not retain retired platform HTTP; its replacement belongs to a later remote managed-L2 package with its own executable design, proof and cleanup |

The first five categories are the static retirement receipt set. The L2 dependency category is a later serial set: it begins only after static retirement and final control alignment PASS. Its existing `scripts/check/affected-l2` red (`OPERATIONS-PASSWORD` still names the old work-context directory) is a pre-L2 admission defect that must be corrected from the current authentication Drawer physical path in the same L2 design set; it is not waived by this platform retirement.

The later package must reject direct SQL, controller/route/OpenAPI exposure, bootstrap output in logs or evidence, missing managed/fresh/private inputs, wrong role/root, multiple intents, duplicate idempotency key, and any restoration of fixture row 7's platform HTTP operation. Those are future executable red criteria, not evidence claimed by this static package.

## 2026-08-02 Dexter superseding product correction

本详设的“平台邀请面退役”结论已被 Dexter 永久业务裁决推翻。平台管理员必须保有跨任意组织节点的邀请中心；不能以 operations-admin 五个局部用户页或 L2 owner bootstrap 替代。该裁定意味着本文件不是当前可执行设计，U07 的删除分母、五 operation removal、无邀请 Tab 的 IA03 refreeze 和相关 package-exit 均不得继续作为实现依据。

后续必须新建 serial implementation design，恢复并核验 platform 五 operation、平台账号页邀请 Tab、任意节点候选级联、邀请列表与动作闭环；同时保留 operations/public invitation flow。旧 U07 仅作为历史误判记录，不能用于删除或证明平台邀请缺失。
