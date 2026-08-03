---
title: RM1 P6-3 平台邀请面原子退役实施授权与边界
status: ACTIVE_IMPLEMENTATION_DESIGN
packageId: RM1P6-PLATFORM-INVITATION-RETIREMENT-U07
---

# 问题、目的与业务边界

IA01 将邀请新任职的发起、取消与重发限定为运营管理后台五个 target-specific 用户页；平台账号页不是邀请管理入口。当前 platform-admin 仍保留邀请 Tab、独立 `InvitationsPage`、五个 platform invitation operation 与其 audit dispatch，构成重复且未批准的用户路径。此 package 原子退役该 platform face，保留账号页的账号查询、详情、状态、凭据和任职撤销任务，并保留 operations/public invitation 闭包。

IA03 的 `IA03-ACCOUNT-TAB` 中邀请 Tab 是与 IA01、物理 import contract 和 roster 冲突的 accepted-byte 残留。本 package 只重冻结该 selector 为单一账号内容页、无 invitation Tab/entry，并将 IA03、physical import contract、roster、U02 baseline 和 U09 link 同一 receipt 更新。

# 精确范围

实施只能改写 `rm1p6-u07-platform-invitation-retirement-manifest.json` 的 exact `changeSurfaces`。删除对象是 `InvitationsPage`、其仅由该页使用的 `PlatformAuditHistoryModal`/barrel、两个 platform invitation controller、五个 platform OpenAPI/catalog/report operation 与 platform audit 的 invitation dispatch。所有 generated output 只能由 controlled `edge-codegen --write-receipt` 写出，receipt 的真实非空 path set 是唯一输出分母。

`AccountsPage` 是明确保留反例：仅移除旧 invitation import/state/Tab/render。平台 audit 还必须保留账号/角色目标；operations-admin 的五个 target-specific invitation task、operations audit 和 public acceptance 是跨 face 保留反例。不得按类名删除 shared schema、owner service 或 operations/public generated projection。

# 受管 L2 的明确不越级

当前 fixture 仍经即将退役的 platform HTTP 建立第一个 operations account；这是后续 L2 的硬依赖，不能留作兼容面、直接 SQL 或伪造 static PASS。现有远端 Testcontainers runner 与本机浏览器 L2 不共享数据库，故本 package 不写 test-only bootstrap、不改 fixture、不运行动态环境。后续独立 remote managed-L2 package 必须在同一远端 runtime/database 边界证明 owner re-read、单 GROUP intent、`WorkspaceInvitationService.create(...)`、私有 token 交接、日志脱敏、business 与 cleanup；在那之前 L2、business 和 cleanup 均不是本 package 的结果。

# 验证与禁止项

逐个写点必须先重开 IA01/IA03、全部六维 memory 命中、当前源码、physical/roster 和本详设；focused proof 后同样逐点回读。静态顺序是 IA/hash refreeze → handwritten/contract retirement → controlled generation → platform/operations typecheck and focused proof → dual-admin production importer scan → final control-level IA alignment。静态通过不得称为 business、cleanup 或 L2 PASS。

禁止只隐藏 Tab、仅删 UI、为 fixture 保留 production HTTP、吞并 operations/public flow、更新 IA03 而不更新所有 hash-bound consumer，或以历史 U03 receipt 伪造 U07 receipt。U07 从新 baseline 开始；U03 历史 receipt-chain finding 保持独立未被掩盖。

## Dexter 2026-08-02 permanent correction

本 U07 退役裁定被 Dexter 永久产品决策 supersede：平台管理员必须能够从空间账号页的永久邀请 Tab 对任意组织节点发起、查询、取消和重发邀请，首个运营用户也必须沿同一真实产品链路产生。U07 不再是当前实施授权或删除依据；其历史 receipt、hash、无邀请 IA selector 和“仅 operations invitation”结论均不得被引用为当前 PASS。后续 serial package 必须以新的 IA/contract/owner/readback/source set 重新冻结，不得把历史 U07 的删除结果隐式恢复或伪装成未发生。
