---
title: RM1 P6 管理后台目录单一真相模型实施授权与边界
status: ACTIVE_IMPLEMENTATION_DESIGN
packageId: RM1P6-ADMIN-CATALOG-TRUTH-U04
---

# RM1 P6 管理后台目录单一真相模型实施授权与边界

## 原始问题、目标与授权

原始业务问题不是页面标题散落，而是 `contracts/catalog/admin-catalog.json` 将 PAGE、导航组、ACTION、
ACTION_GROUP、用户管理 purpose relation 和 ROLE_HOME 关系拆为互相拼接的 tuple/map，并让
`WorkspaceAuthenticationService.homePage` 另行持有首页关系。这样会让平台角色编辑、operations 静态目录、
后端授权目录与 feature 消费出现局部真相。

`doc/decisions/2026-07-30-v2s-admin-catalog-semantic-copy-model.md` 是已审模型；
`doc/review/platform/2026-07-30-v2s-rm1-p6-2-admin-catalog-truth-model-recheck-claude.md` 给出模型/未来
package 的 DESIGN GO。Dexter 于 2026-07-30 明确授权建立 package 并按详设实施。本 amendment 只将该直接
授权收敛为可核验的静态目录迁移，不回写历史 U02 的边界或声明 historical GO。

## 有限实施范围

本 package 将唯一静态源迁为 `nodes: AdminCatalogNode[]`，并由 generator 无损投影既有 platform/operations
generated facade、`WorkspaceAuthorizationCatalog` 和从 catalog 派生的 role-node type → ROLE_HOME lookup。
允许的生产源码仅为 catalog、generator、两个 generated TypeScript output、`WorkspaceAuthorizationCatalog` 与
`WorkspaceAuthenticationService.homePage`。所有 PAGE/ACTION/群组/role/data-node/action-purpose 集合必须保持
25/34/4/4/5x2 的 exact set；两项冻结文案以 carry-over 优先规则校正。

P3 typed owner exception 的冻结分母只能在 current-tree 全量 inventory 与 edge handler inheritance mapping
都通过后更新。P1 authority ledger 的 current-tree consumer denominator 已另行读出为 P6 evidence debt；它在
U04 immutable baseline 之后才被发现，必须由下一 package 以正确 baseline 处理，不能补入本 package 或把
它的 FAIL 改写为 U04 PASS。该 ledger FAIL 仍独立存在，U04 static admission/implementation GO 不恢复
`ST-11`，也不构成 authority-ledger PASS。

`WorkspaceAuthenticationService.enterable(...)` 与组织路径描述 switch 仍是动态 owner 分派，禁止改动。
operations-admin 的 `WorkspaceUserPage.tsx`、`WorkspaceInvitationPanel.tsx` 和所有其他 `.tsx` 不属于此
package；它们在后续有独立 IA baseline 的 package 中改为 `userManagementFor(pageKey)`，本 package 仅保留从
单一 node source 派生的兼容 projection。因此本 package 不触及 P6-3 UI 行为。

U04 的 fresh regeneration 已按当前 OpenAPI 退役
`replaceOperationsOrganizationHeadCompanyBrandAuthorizations`；该 operation 在 contracts/openapi、operations
generated client 和 catalog operation-id constants 均不存在。遗留
`head-company-management/ui/HeadCompanyManagementPage.tsx` 仍有两个调用点，因此 operations-admin typecheck
的 first failure 是“U04 regeneration retired operation → legacy consumer mismatch”，不是与本次迁移无关的
既有问题。`operations-admin` 的 `test` 脚本只运行 architecture tests，不包含 `typecheck`，故其 PASS 不可与
typecheck FAIL 合并表述。P6-3 已把该 Page/collection-replace Drawer 列为同一 receipt 的精确 removal denominator；
U04 不得保留已退役 operation，也不得越过 P6-3 IA/package admission 删除该 `.tsx`。此项作为 U04 显式
出口欠账移交 P6-3，且不构成 business 结果。

## 验证顺序与禁止项

先完成 node shape 的静态分母、generator red mutation、生成物等价和 role-home lookup focused proof；再运行
静态 architecture/capability checks，并保留 authority-ledger 的独立 FAIL readback。它不启动 DEV、seed、reset、L2 或任何动态业务验证，也绝不把
类型、生成或静态检查称为 business PASS。动态 P6-2 L2 仍须在 38 个物理 screen 的最终 IA 对齐后，按受管环境
另行执行并分别报告 business 与 cleanup。

禁止：保留并读取旧顶层 tuple/map、把 dynamic grant/candidate/owner command 搬进 catalog、以标题替代关系键、
增加列表操作列、修改 operations `.tsx`、或把此 static package 伪称为 P6-2/P6-3 dynamic closure。

## Package exit

退出必须证明：精确 change surface/receipt set equality、node 关系 exact-set、generator 和两项新 red mutation、
生成输出 check、backend focused proof、capability static check、独立 implementation review 及 Claude
implementation review；authority-ledger current-tree debt 与 P6-3 legacy-consumer/typecheck debt 必须作为后续
package 输入，不得伪称 PASS。business 结论为 `NOT_APPLICABLE_STATIC_ONLY`；cleanup 为 `NOT_APPLICABLE_NO_MANAGED_RUNTIME`，
二者不得改写为 PASS。

execution binding 的 machine vocabulary 使用 `NOT_REQUIRED_CONTROL_ONLY`，表达同一 static-only 边界；
它不是 business PASS，也不要求或授权伪造动态 evidence。
