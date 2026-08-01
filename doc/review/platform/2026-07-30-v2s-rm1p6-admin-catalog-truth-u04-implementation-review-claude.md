---
title: RM1P6-ADMIN-CATALOG-TRUTH-U04 implementation 复审（Claude）
reviewTarget: IMPLEMENTATION
scope: U04 静态 catalog / generator / generated-output / backend role-home migration current bytes
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 只评审 U04 静态迁移；不构成 P6-3 UI、动态业务、DEV、seed/reset、L2 或 historical GO
createdAt: 2026-07-30
---

# U04 implementation 复审

## 0. 结论

**GO**，`M=0 / S=1 / N=2`。六项核验逐项通过（我按真实 schema 重算，不采信自报数字）。
`S1` 是 U04 的再生成把 `operations-admin` 留在不可 typecheck 状态，且归因表述把触发因素写成了纯遗留代码。

## 1. 六项核验（独立复算）

**① 单向投影** — `admin-catalog.json` 顶层已只有
`schemaVersion / kind / authority / sourcePolicy / nodes`，**legacy tuple/map 全部移除**。
`nodes = 67`，`kind` 分布 `PAGE 25 / ACTION 34 / NAVIGATION_GROUP 4 / ACTION_GROUP 4`。
PAGE 内 `ROLE_HOME 5 + BUSINESS 20`（20 = operations 12 + platform 8）。
`consumerFace` 分布 `operations 55 / platform 8 / 缺省 4`（缺省恰为 4 个 ACTION_GROUP，face 由 child 推导）。
operations PAGE 的 `navigation.groupKey` 全部落在 4 个 NAVIGATION_GROUP 内；
platform PAGE **无** `groupKey`（flat + `iconKey`）；ACTION 的 `action.groupKey` 全部落在 4 个 ACTION_GROUP 内。
用户管理关系由 `action.userManagement{targetOrganizationType,purpose}` 承载：
**5 个 pageKey × 2**，`purpose` 域 `{INVITE, ROLE_REVOKE}`，且每条的 target
**等于**目标 PAGE 的 `pageAccess.userManagementTargetOrganizationType`。
`edge-codegen.mjs:310` 强制顶层键**恰为这 5 个**（legacy 表无法回归），
`:313-323` 的四个集合**全部从 `nodes` filter 派生** → 单向成立。

**② ROLE_HOME 拒绝 + 只替换 homePage** — 5 个 ROLE_HOME 节点字段为
`{consumerFace, display, experience, key, kind, navigation, page}`，
**无 `pageAccess`、无 `workspaceRequirement`**；`page.roleHomeForNodeType` 五值互异（1:1 全函数）。
`edge-codegen.mjs:354` 对 `pageAccess || workspaceRequirement !== undefined` fail-closed，
`:342` 断言 roleHome 集合基数为 5；**两条真红**在 `:1157`（ROLE_HOME access）与
`:1162`（workspaceRequirement），`--self-test` 实跑列出
`R5_ADMIN_CATALOG_ROLE_HOME_INVALID`、`R5_ADMIN_CATALOG_ROLE_HOME_WORKSPACE_REQUIREMENT_RED`。
`WorkspaceAuthenticationService:234` 的手写 5 臂 switch **已消失**，改为
`WorkspaceAuthorizationCatalog.homePageForRoleNodeType(type).orElseThrow(SessionInvalidException::new)`。
同文件 `enterable(...)` 与按类型取组织路径描述这两个 **owner 分派 switch 仍保留**（实测 2 处）
—— 与既有 allowlist 边界一致，**未越界吞并动态 owner 事实**。

**③ ACTION fail-closed** — 34/34 单一 `targetPageKey` 且全在 25 PAGE 内；
`consumerFace` 与 target PAGE **全部一致**（0 不符）；
`action.grantableRoleNodeTypes` **非空且全部 ⊆ 目标 PAGE 的 `pageAccess.grantableRoleNodeTypes`**（0 违规）；
**无任何 ACTION 指向 ROLE_HOME**。

**④ facade 未成为真相源** — 两个前端 facade 与
`WorkspaceAuthorizationCatalog.java` 头部均为
`// Generated from contracts/catalog/admin-catalog.json; do not edit.`；
Java 文件由 `edge-codegen.mjs:421-429` 生成并在 `:884` 写出（`:83` 为输出路径），
即后端目录亦是**投影而非第二真相**。全部 16 个消费点均为 `import`（只读）。

**⑤ frozen inventory 88** — 实跑 `capability-invariants`：
`P3_A_TYPED_PROBLEM_OWNER_CONSUMPTION=MAPPED=88:NOT_REACHABLE=0:UNMAPPED=0`、
`P3_A_TYPED_PROBLEM_OWNER_EXACT_INVENTORY=EXACT_SET=88`，**UNMAPPED=0** → 全量 typed owner mapping 支撑。

**⑥ 未把静态当 business/L2** — amendment `:43` 明写"不得把类型、生成或静态检查称为 business PASS；
动态 P6-2 L2 仍须在 38 个物理…"；round-2 review 的 GO 亦限定
"only for U04 static implementation-source"。**无越级表述。**

> **披露我自己的三次误判**：首轮探测用了猜测字段名
> （`selectedRoleNodeTypes`、`userManagementBinding`、对 platform PAGE 期望 `groupKey`），
> 一度得出"34 条角色子集违规、0 条用户管理关系、导航组引用越界"。
> 读取真实节点 schema 后全部为**我的字段名错误**，非缺陷，已按真实字段
> （`action.grantableRoleNodeTypes`、`action.userManagement`、platform flat navigation）重算。

## 2. S1 ｜U04 的再生成使 operations-admin 不可 typecheck，且归因表述不完整

**owning source / 反例**

- `replaceOperationsOrganizationHeadCompanyBrandAuthorizations` 在
  `contracts/openapi`、`operations-admin/src/app/api/generated`、
  以及 catalog 的 operation-id 常量中**均已不存在**（三处 grep 皆空）。
- 但 `features/head-company-management/ui/HeadCompanyManagementPage.tsx:216,239` **仍在调用它**
  （`:216` 用于 `diagnosticOperationId`，`:239` 为实际提交）。

因此 `operations typecheck FAIL` 不是与本次迁移无关的既有问题——
**是 U04 把该 operation 从契约/生成物中退役所直接触发的**。
来件把它归因为"旧 P6-3 head-company bulk-replace 调用与现有 generated contract 不一致"，
描述了违规代码，但**未说明触发方是 U04 的再生成**。

**影响面**：两个生产 app 之一在本包结束时不可 typecheck。
同时"operations tests: PASS"与"operations typecheck FAIL"并存，说明测试链未含 typecheck，
静态证据集内部口径不一致。

**严重性理由（S 而非 M）**：Dexter 已在"已知未决"中前置披露该项，不构成隐瞒；
无任何动态/业务主张；违规代码本就已被 P6-3 设计裁定为 removal-only。故不阻塞 U04 的静态 GO，
但**不应带过 U04 边界**。

**最小修复（二选一）**：
(a) 在 U04 的 receipt set 内做 removal-only：删除 `:216`/`:239` 两处调用与其多选 Drawer
（P6-3 corrective design 已裁定这两处为 removal 对象，删除不引入新行为）；
(b) 在生成物中暂留该退役 operation，直到 P6-3 删除调用方。
**(a) 更小且与既有裁定一致**；若因 P6-3 未授权而不能动该文件，则应至少把归因改写为
"U04 再生成退役该 operation → 遗留调用点失配"，并把它登记为 U04 的显式出口欠账。
**不需要 Dexter 产品裁决。**

## 3. N

**N1 ｜`homePageForRoleNodeType` 用 `findFirst()` 承载 1:1 关系**

`WorkspaceAuthorizationCatalog.java:138` 为
`roleHomeCatalog().stream().filter(...).map(...).findFirst()`。
1:1 由生成期保证（`edge-codegen.mjs:342` 断言基数 5）且文件带
`do not edit` 头 + `edge-codegen --check` 可测漂移，故当前安全。
但 Java 侧本身对"出现两条同 roleNodeType"是**静默取第一条**，不是 fail-closed。
建议改为"恰好一条否则抛"，使后端独立于生成期也 fail-closed。

**N2 ｜authority ledger FAIL 的边界须显式绑定到本 GO**

`ST-11 historical consumer denominator` 当前 FAIL，来件已披露并指向后续基线 package。
本 GO 不覆盖该项；建议在 U04 amendment 中显式写明
"authority ledger FAIL 未被本包关闭，且不得以 U04 的 static admission PASS 掩盖"，
以免后续会话把 U04 的 PASS 读成 ledger 已恢复。

## 4. 处置

- `S1` 与 `N1`/`N2` 均在既有批准边界内，**无需 Dexter 产品裁决**。
- 已验证为真的部分**不得回退**：单一 `nodes` 真相与 legacy 表移除、
  `edge-codegen.mjs:310` 的顶层键封闭、ROLE_HOME 两条真红、
  `homePageForRoleNodeType` 替换手写 switch 且保留两个 owner 分派 switch、
  ACTION 的 target/face/角色子集三重 fail-closed、三处 generated 头部、
  `MAPPED=88/UNMAPPED=0`、以及 `§⑥` 的非越级表述。
- **本 GO 不构成**：P6-3 UI、动态业务、DEV、seed/reset、L2 或 historical GO；
  38 screen 最终 IA、受管 L2 与 business/cleanup 仍未执行。
