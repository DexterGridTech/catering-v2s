---
id: decisions.admin-frontend-runtime-architecture-must-not-follow-journey-ids
title: Admin 前端 runtime 架构不得按 Journey ID 组织
type: decision
status: active
layer: routed
scope: both admin frontend design and implementation
createdAt: 2026-07-16
lastUpdatedAt: 2026-07-20
taskKinds: [frontend-implementation, implementation-review, spec-design, ui-design, ui-review]
domains: [admin-ui, platform]
consumerFaces: [operations-admin, platform-admin]
owners: [frontend-platform, product]
impacts: [architecture, evidence, journey, navigation, ownership, package-layout, state]
triggers: [admin-page, feature, frontend, implementation, new-page, review, ui-change]
sourceRefs:
  - doc/decisions/2026-07-17-runtime-source-organization-must-not-follow-journey-ids.md
  - doc/review/platform/2026-07-16-admin-ui-step-page-surface-model-reflection.md
  - doc/review/platform/2026-07-16-admin-ui-page-surface-traceability-remediation-design.md
  - doc/review/platform/2026-07-16-admin-ui-page-surface-traceability-remediation-plan.md
  - doc/review/platform/2026-07-16-four-domain-admin-frontend-page-module-state-test-map.md
  - doc/platform/user-journey-first-design-standard.md
  - doc/platform/admin-ui-interaction-and-ant-design-usage-standard.md
---

# Admin 前端 runtime 架构不得按 Journey ID 组织

> 2026-07-20 状态 owner 修订：本文关于“当前页可分享 query/platform workspace 选择意图由 router/search params 持有”的旧条款已被 `admin-routing-and-tab-query-state-must-follow-v4-style.md` supersede。router 只持稳定页面入口；业务 query 归 Content Tab snapshot；workspace/identity/scope 归 owner-confirmed Shell context。其他源码组织与 owner 规则继续有效。

> 2026-07-20 页面目录修订：本文关于“operations frontend exhaustive registry 单独向 menu/title/scope 投影”的旧条款已被 `admin-page-catalog-navigation-and-access-owner-boundary.md` supersede。operations IAM PagePolicy/navigation projection 持业务导航事实，app registry 只持 route/loader；platform registry 仍为 app-owned 全量目录。

本决议是全工程 `decisions.runtime-source-organization-must-not-follow-journey-ids` 在两个 admin 前端的专门化约束；后端遵循同一总规则，但其受保护路径重绑与机器门属于 R8 恢复前置，不在当前 R4 中实施。

## 永久边界

Scenario/Step 是产品、设计、测试和 evidence 的追踪 ID，不是前端软件架构单元。两个 admin 的 runtime 源码必须按 app、route/page、稳定业务能力、组件职责和 state owner 组织。

禁止以 Scenario/Step ID 命名或划分：

- `src/features` 目录、runtime 文件；
- Page/组件/hook/store/slice/selector/exported symbol；
- route、菜单、Content Tab、locator、CSS class；
- API adapter、owner client 或测试文件边界。

Scenario/Step ID 只允许出现在 Journey/Spec/Plan/Coverage/obligation 文档、`tests/traceability` registry、test title/tag/attachment、runner manifest 和 evidence metadata。

## 派生规则

1. admin 设计派生必须先把批准 Scenario/Step 编译到 `pageDesignKey + taskKey + moduleKey + stateOwnerKey + implementationTargets + testCaseId`；多个 Scenario/Step 可以共享同一 page/module/file/test。`pageDesignKey` 直接复用批准产品 closed catalog，不再另造 runtime page key 命名空间；无页面 Step 明确写 `N/A`。
2. Module Delivery Batch permit 只授权 Pack/Batch Map 批准的 included Steps 与 exact paths，不产生源码所有权，也不要求创建新目录、组件、hook、slice 或测试文件；Step permit 仅保留为批准的原子兼容例外。
3. Shell 只组合业务命名的 route/page registry；不得直接 import Scenario module。
4. Page composition root 拥有页面 query、基础区域、overlay、合法动作和 teardown；Scenario task 只能向该页面贡献行为，不得复制 PageContainer、route、Content Tab 或同一 server query state。
5. 测试按真实页面/用户任务组织；一个 test file 可覆盖多个 Scenario/Step，case metadata 保留直接追踪。

## 状态架构

状态必须按事实来源、共享范围和生命周期归唯一 owner：

| 状态 | owner |
| --- | --- |
| server fact/cache/mutation，以及 owner-confirmed session/identity/view scope/contextVersion | generated RTK Query |
| active pageDesignKey 与稳定 route | app router；不承载业务 query/context/authorization |
| Shell、Content Tabs、每 Tab 非敏感 search/filter/page/sort resume snapshot | app-owned state；不得复制 owner context |
| 跨多个 surface 且需保持的 page workflow | page/feature model，必要时 slice/reducer |
| 单 Drawer/Form 草稿、dirty、临时展开 | ProForm/component local state |
| 稳定业务派生 | collocated typed selector 或纯函数 |

两个 app 必须提供统一 store 入口与 typed `useAppDispatch/useAppSelector`。`createSlice`、`createSelector` 和 custom hook 只在真实共享、生命周期或派生价值成立时使用；禁止“Redux 只接 RTK Query但其他共享状态随意散落”，也禁止把所有 local/form state 全局化。

## Router、catalog 与 context cache

1. 两个 app 统一使用单例 Data Router；URL 只表达 stable active page/route，不携带业务 search/filter/sort/page、platform workspace selection、operations identity/scope 或 authorization；operations stable keyed route 可按批准入口保留 `workspaceKey` path，但该 path 不是授权 owner。每 Tab 非敏感查询由 app-owned resume snapshot 持有，刷新不恢复后台 Tabs且当前页查询回安全默认；platform workspace 与 operations identity/scope 由唯一 Shell context owner 持有并经 owner 确认。
2. operations 的 17 个批准 `pageDesignKey` 由 IAM typed PagePolicy/navigation projection 与 app Page Loader Registry 以 key join，loader registry 是唯一 lazy import owner但不复制 title/menu/role/scope；platform 的 9 个批准 `pageDesignKey` 由 app-owned exhaustive registry 单向投影 router/menu/Tabs/direct guard。
3. 所有上下文相关 RTK Query arg、cache key 与 tag 必须携带适用的 workspace/identity/scope/contextVersion。每个 app 只有一个 context lifecycle listener 负责 workspace/identity/scope 切换的 invalidate/reset、Tab 和 route 协调；迟到响应只能写旧 key，不能进入新上下文 DOM。
4. operations 身份切换使用 replace 进入新角色首页并关闭旧业务 Tabs；随后浏览器 Back/popstate 命中旧 URL 时必须在新 owner context 下重新 guard，旧 DOM/cache/header 不得闪回。

## 与 Module Delivery 的关系

- Frontend Page/Module/State Map 决定长期源码、页面 composition 和状态 owner；它是前端唯一 module/page catalog。
- Module Architecture Pack 描述跨前后端系统设计，可以引用同一 `moduleKey`，但不能建立第二套 page/module registry。
- Module Delivery Batch 只决定本轮实施事务、included Steps 和 exact paths，不决定 feature/page/hook/store 文件结构。
- 多个 Step 可进入同一前端 module、同一测试文件和同一 Batch；一个 Batch 也可以只消费已经存在的前端 module。

## 验证

- `scripts/check/code-layout`
- `scripts/check/code-structure`
- project-memory clean/self-test
- page/module/state ownership review
- focused L2/L3 与 business/cleanup 分账

机器门只检查路径、命名、引用和 owner 唯一性等客观事实，不生成 runtime UI，不建立全仓 consumer graph。
