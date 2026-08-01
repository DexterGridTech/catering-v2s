---
id: decisions.admin-routing-and-tab-query-state-must-follow-v4-style
title: 双后台路由与 Tab 查询状态采用 v4 式边界
type: decision
status: active
layer: routed
scope: both admin frontend current and future iterations
createdAt: 2026-07-20
lastUpdatedAt: 2026-07-20
taskKinds: [frontend-implementation, implementation-review, journey-design, spec-design, ui-design, ui-review, ui-test]
domains: [admin-ui, platform, iam]
consumerFaces: [operations-admin, platform-admin]
owners: [frontend-platform, product]
impacts: [navigation, state, workspace-entry, data-scope, invitation, session]
triggers: [admin-page, frontend, scope, scope-change, login, invitation, session, redirect]
sourceRefs:
  - doc/specs/platform/2026-07-19-admin-page-catalog-navigation-and-access-evolution-design.md
  - doc/specs/platform/global-consistency-remediation/rb-04-06-ui-public-flow-detail.md
  - doc/review/platform/2026-07-20-global-consistency-remediation-granularity-manifest.json
  - doc/review/platform/2026-07-20-w0-w11-requirement-implementation-gap-register.md
---

# 双后台路由与 Tab 查询状态采用 v4 式边界

## Dexter 最新裁决

2026-07-20，Dexter 明确要求两个已登录管理后台采用 v4 式路由心智，不再把页面搜索、筛选、排序、页码等业务查询放进 URL。本裁决直接 supersede 以下旧规则中的 URL query ownership 部分：

- `admin-frontend-runtime-architecture-must-not-follow-journey-ids.md` 中“当前页可分享查询由 router/search params 持有”；
- `admin-frontend-implementation-standard.md` 中同义规则；
- `cross-cutting-foundation-and-equivalent-refactor-governance.md` 中“新页面必须使用 useUrlFilters”的新增消费要求。

其他关于 app-owned registry、generated RTK Query、Content Tabs、context cache、typed hooks 和 overlay 生命周期的规则继续有效。

## 唯一状态 owner

| 状态 | owner |
| --- | --- |
| 当前稳定页面入口 `pageDesignKey/route` | app router；只表达页面，不表达业务查询或授权 |
| 当前 Tab 的 search/filter/sort/page/pageSize | app-owned Content Tab resume snapshot，经 page registry 的 typed adapter 读写 |
| server fact/cache/mutation | generated RTK Query |
| workspace/identity/scope/contextVersion/authorizationRevision | owner-confirmed session/app context；URL 不得成为事实 |
| 单 overlay 草稿 | ProForm/component local state |
| 跨 surface workflow | feature model |

每个页面只能提供 typed query default/normalize adapter，不能自行使用 `useSearchParams`、history query 或 route query 建第二 owner。Tab 切换恢复该 Tab snapshot；关闭 Tab 删除；刷新保留当前页面入口但查询回安全默认。后台 Tabs 不要求跨刷新恢复。

## Route 边界

1. 已登录 platform/operations 页面 URL 不携带 search、filter、sort、page、pageSize、identity、role、scope、platform workspace selection、contextVersion、authorizationRevision 或 action availability。operations 的 stable keyed app route 可按批准入口保留 `workspaceKey` path，但该 path 只定位 app/owner workspace，不成为授权事实。
2. direct URL 仍走 registry + page-entry guard；route 不是授权事实。
3. platform 当前集团空间由 Shell 唯一 workspace context owner 持有并经 owner 校验，不再通过 URL query adapter 表达选择意图。
4. operations identity/scope 同样只来自 owner-confirmed context。
5. keyed login 路径只带 `workspaceKey`，没有 route token；表单仍提交 password 或 `otpCode`。
6. invitation acceptance 才使用 `workspaceKey + invitationToken`；`invitationToken` 属于 invitation generation，重发后旧 `invitationToken` 与 invitation-purpose `otpVerificationGrant` 失效。
7. S02-S04 的 page/action/data/session 拒绝在原 surface 恢复，不创建 public token；S05-S06 使用 `/operations/password-recovery/{resetGenerationKey}`，该 `resetGenerationKey`、reset-purpose `otpVerificationGrant` 与 `passwordResetGrant` 均归 credential owner，不复用 `invitationToken/sessionCookie`，也不进入普通后台 Tab snapshot；workspace 由 reset owner 解析，客户端不另传 workspaceKey 作授权事实。

## 迁移与门

- `useUrlFilters` 与现有 URL filter foundation 标为 `DEPRECATED_PENDING_RB03_MIGRATION`；不得有新消费者。
- 旧页面迁移必须先建立各 app 唯一的 typed per-tab snapshot owner，并用至少两个真实页面验证后再退出 URL adapter，不能先删除造成状态丢失。它是 app-owned kernel，不因多页消费自动提升为跨 app shared foundation；若以后提取跨 app 包，仍须额外满足共同不变量、同构失败语义、共同演进原因与 focused evidence。
- `scripts/check/cross-cutting-foundation` 的 FE-6 规则必须在 RB-03/RB-04 中从“强制 useUrlFilters”改为“禁止业务 query URL、强制 tab query adapter”；当前旧 gate PASS 不代表符合本裁决。
- L2 红夹具：地址栏不出现业务 query；两个 Tab 查询互不污染；切换恢复；关闭释放；刷新默认；URL 注入 scope/role/query 不进入 owner request。
