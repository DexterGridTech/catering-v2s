---
id: decisions.admin-page-catalog-navigation-and-access-owner-boundary
title: 双后台页面目录、菜单导航与准入最小 owner 边界
type: decision
status: active
layer: routed
scope: both admin page catalog navigation and access current and future iterations
createdAt: 2026-07-20
lastUpdatedAt: 2026-07-20
taskKinds: [architecture-design, contract-design, frontend-implementation, backend-implementation, implementation-review, journey-design, spec-design, ui-design, ui-review]
domains: [admin-ui, iam, platform]
consumerFaces: [operations-admin, platform-admin]
owners: [frontend-platform, iam, product]
impacts: [navigation, page-access, authorization, ownership, state, shell]
triggers: [admin-page, frontend, contract, role, scope, shell]
sourceRefs:
  - doc/specs/platform/2026-07-19-admin-page-catalog-navigation-and-access-evolution-design.md
  - doc/specs/platform/global-consistency-remediation/rb-01-03-security-authorization-detail.md
  - doc/review/platform/2026-07-20-global-consistency-remediation-granularity-manifest.json
---

# 双后台页面目录、菜单导航与准入最小 owner 边界

2026-07-20，Dexter 将 `2026-07-19-admin-page-catalog-navigation-and-access-evolution-design.md` 的最小模型提升为最新设计需求。该裁决 supersede 旧 frontend runtime memory 中“operations frontend page registry 独自投影 menu/title/scope”的部分；runtime 尚未整改，不能冒充当前已实现。

## Operations-admin

1. `contracts/catalog/admin-catalog.yaml` 是 platform 静态页面与 operations page/action/业务命令 binding 的唯一静态 contract；其 generated registry 向 workspace IAM 提供批准静态页面事实：`pageDesignKey/businessTitle/menuGroup/menuOrder/kind/pageAccessManaged/supportedOrganizationTypes/requiredDataScope/lifecycle`。platform-admin 的角色定义/页面授权 form options 也只消费该 generated catalog；PagePolicy 只是 owner-local typed view，不得手写第二 catalog。
2. IAM 基于 active identity、role status、page grant、context/revision 返回 owner-confirmed navigation projection。
3. operations app Page Loader Registry 只持 `pageDesignKey -> route + lazy loader`，不复制 title/menu group/role/scope/action ALLOW。
4. Shell 用 pageDesignKey typed join；未知 current/home key fail-visible，不动态创建 route/menu/tab。
5. PagePolicy 不持 action keys。当前会话可持有由 workspace-IAM exact catalog 解析的 context-bound action grant snapshot，但它不是实体字段、逐行 `ALLOW` 或命令授权；业务实体/树节点/list row/detail entity 不得携带当前用户的 action availability。UI 只将该会话 grant 与批准的业务事实相交；每个 bounded-context command owner 仍按真实目标、范围、状态和版本重新校验。若未来确有具体目标的动态可操作性需求，只能由该 owner 返回独立、明确命名的 authorization/read-model projection，不能并入实体，也不能由 PagePolicy、前端或第二 catalog 推导。
6. 五类 intrinsic role home 不写 page grant；12 个业务页按批准 page grant。

## Platform-admin

platform 没有 operations role/page-grant/action 模型。每位有效平台管理员都是 platform-super-admin；app-owned typed registry 同时持 pageDesignKey/title/menu group/order/route/loader/workspace requirement/lifecycle，menu/router/tab/direct guard 只消费 registry selector。gateway 与 backend owner只验证 platform session，不再按 PlatformCapability 区分平台命令；operations session 永不得进入。

## Page access 与角色

- page access 是 page grant 唯一写入口：按 menu group 展示，名称进详情，详情右上配置；
- role detail 只读展示有效页面摘要；role form 不复制 page grant 写入；
- page grant 决定页面 read，capability/action 决定 mutation，identity/scope/status/source 继续独立；
- 禁止标题/route/capability 前缀推断、第二 menu catalog、feature self-registration、platform principal 混入 operations grant。

## 当前冲突与激活

当前 operations frontend registry、Shell 手写 menu、IAM catalog 与 business authorization switch 尚未按该模型收敛；W0-W11 整改 RB-02/RB-03 负责 contract/owner/runtime/gate。authorizationRevision 尚待 contract/schema review，当前不得伪造。设计要求 active 不等于 runtime active。
