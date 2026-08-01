---
id: decisions.admin-frontend-implementation-standard
title: Admin 前端实现标准
type: decision
status: active
layer: routed
scope: admin-web implementation
createdAt: 2026-07-15
lastUpdatedAt: 2026-07-20
taskKinds: [frontend-implementation, ui-design, ui-test]
domains: [admin-ui]
consumerFaces: [operations-admin, platform-admin]
owners: [frontend-platform]
impacts: [component, l2, navigation, state, wire]
triggers: [admin-page, frontend, new-page, playwright, procomponents]
sourceRefs:
  - doc/reports/platform/2026-07-15-v4-v1-code-lessons-and-v2-memory-candidate-audit.md
  - doc/review/platform/2026-07-15-v4-v1-code-lessons-memory-candidates-claude-review.md
  - doc/decisions/2026-07-16-admin-ui-ant-design-experience-governance.md
  - doc/platform/admin-ui-interaction-and-ant-design-usage-standard.md
  - project-memory/decisions/business-entity-list-detail-action-standard.md
  - project-memory/decisions/business-user-facing-language-standard.md
  - project-memory/decisions/admin-drawer-form-lifecycle-and-feedback-standard.md
  - project-memory/decisions/admin-frontend-runtime-architecture-must-not-follow-journey-ids.md
  - project-memory/decisions/admin-routing-and-tab-query-state-must-follow-v4-style.md
  - project-memory/decisions/admin-page-catalog-navigation-and-access-owner-boundary.md
  - doc/review/platform/2026-07-16-four-domain-admin-frontend-page-module-state-test-map.md
---

# Admin 前端实现标准

> 2026-07-20 路由修订：页面 search/filter/sort/page 与 platform workspace 选择意图不再由 URL/search params 持有，统一服从 `admin-routing-and-tab-query-state-must-follow-v4-style.md`。router 只持 stable page entry；业务 query 归当前 Content Tab snapshot。

## 状态只归一个 owner

Scenario/Step 是 trace metadata，不是 runtime module。目录、文件、Page、hook、slice、selector 和测试文件按业务页面/能力与 state owner 组织；Shell 只消费业务命名 page registry。多个 Scenario/Step 映射同一页面时必须复用同一 composition root，不得复制 route、Content Tab、PageContainer、query 或 store。

| 状态 | 唯一归属 |
| --- | --- |
| server fact/cache/mutation，以及 owner-confirmed session/identity/view scope/contextVersion | generated RTK Query endpoint |
| active pageDesignKey 与稳定 route | router；不承载业务 query/context/authorization |
| 单表单草稿、展开、临时输入 | component/ProForm local state |
| 跨 panel 且有生命周期的 workflow | feature model/slice |
| Shell、Content Tabs、每 Tab 非敏感筛选/页码/sort resume snapshot | app kernel slice；不复制 owner context |

禁止同一事实同时进入 hook local state、slice、localStorage 和 component state。与 workspace/node/session 绑定的请求必须带 context identity；只有仍匹配当前上下文的响应才能落地。所有修改使用带遮罩的 Drawer/Modal，打开期间 Shell 上下文选择器不可操作；上下文切换只发生在载体关闭后的基础页面，并清理其拥有的 query cache、分页、筛选和 Tab 读状态，不设计切换时的 draft/dirty guard 分支。

两个 app 提供 app-owned store、`RootState/AppDispatch` 与 typed `useAppDispatch/useAppSelector`。generated RTK Query 管 server state 与 owner-confirmed session/context；router 只管 stable active page/route；app state 管 Shell、Content Tabs 和每 Tab 非敏感 query resume snapshot；page/feature model 只管真实跨 surface workflow；ProForm/component local state 管单 overlay 草稿。slice、memoized selector 和 custom hook 需要真实共享/生命周期/派生理由，禁止为了形式包装 generated hook，也禁止让共享 app/page state 散落在 Scenario 组件的 `useState` 中。

operations 的 17 页与 platform 的 9 页直接复用批准 `pageDesignKey`，不得另造 runtime key。operations 的 IAM PagePolicy/navigation projection 拥有 title/menu/supported organization/required scope，app Page Loader Registry 只拥有 route/lazy；platform app registry 统一拥有自身 menu/router/Tabs/direct guard/lazy。上下文相关 query arg/cache key/tag 必须带适用 workspace/identity/scope/contextVersion；每个 app 由唯一 context lifecycle listener 处理 invalidate/reset、Tab 和 route，禁止 feature 自行发明切换清理。

## Render 与 mutation

- React render 必须是纯函数。禁止在 render 分支调用 `setState`、`history.replaceState`、router navigate、session/logout 或其他可观察副作用。
- 路由与会话副作用只能由用户事件或依赖完整、可清理的 effect 驱动，并在 StrictMode/并发渲染下幂等。
- mutation 的一次提交尝试持有稳定 idempotency key；pending 时禁止重复提交。只有得到确定结果或用户明确开始新尝试时才创建新 key。
- UI 防双击不能代替 owner 端幂等校验。

## Drawer 表单生命周期

新建、编辑、维护、初始化、重置等可修改业务数据的 Drawer 表单统一消费 `admin-drawer-form-lifecycle-and-feedback-standard.md`。初始 owner 数据、候选加载和程序化 readback 不计 dirty；所有关闭入口共用 guard。提交中 Form 整体 disabled、提交按钮 loading/Spin、关闭与重复提交均被阻断。成功只在 owner readback 后成立，必须先关闭 Drawer 再显示成功 Modal；失败保持 Drawer 与安全草稿，显示用户原因和可展开的白名单技术详情。只读 Drawer、纯确认 Modal、登录/公开流程、搜索和选择器不自动适用。

## Wire、分页与页面

- 页面只消费 generated typed endpoint/client；base API 只拥有 base URL、cookie/header、Problem 映射和 trace。
- 分页 mode、参数名和 response shape 由 endpoint type 决定；禁止猜 `limit/pageSize/pageNumber/cursor` 或把错误静默变空列表。
- adapter 只把控件值转换为 generated request；禁止 transport DTO、字符串 operation key 和动态 hook 名查找。
- required owner 字段缺失必须 fail-visible；禁止 `name || id`、未知状态默认 ACTIVE、缺值默认 `0/[]`。
- 同一页面只有一个 route-to-component 真相；public route 由 app router 显式拥有。

## 组件与证据

先使用锁定版本的成熟 ProComponents 和 v1/v4 已被真实页面/L2 证明的组合。feature 可以直接组合官方组件；foundation 只包装稳定平台语义，不能吸收业务页面/workflow。L2 必须执行真实 action 并断言 owner-backed readback；mock 不证明 backend，保存截图不等于 visual comparison。

组件编码前必须用锁定版本的 Ant Design CLI 以 JSON 输出核对 `info/doc/demo/token/semantic`，不得靠模型记忆猜 API；修改后运行 `antd lint`。CLI 生成或示例代码仍需服从批准 Journey、app-owned Shell 和集中式 layout/style 入口，不能直接成为业务真相或复制页面 CSS。

实际编码与 review 还必须回读锁定版本组件的本地 type/runtime 实现或对应官方 API，不能仅凭组件名推断 `onFinish`、`transform`、`dateFormatter` 或 deprecated prop。界面值到 OpenAPI wire 值的转换只能放在组件明确提供的 adapter 边界，页面业务 handler 只消费 generated request type；发现一处成熟组件 API 误用时，只有限扫描当前 app 的同类调用并统一退出仍在使用的旧 API，不扩大为全仓组件 scanner。

每个 UI Step 还必须落实正式 AntD 体验标准：一个决策 surface 只有一个主动作；按钮/链接语义、表单字段顺序和级联、列表/Tree/详情层级、浮层职责、loading/empty/error/partial/unresolved、键盘/焦点、reduced motion 和 accessibility 都要在 interaction spec 与 L2 中可定位。AntD fallback 必须写明 ProComponents 不能满足的真实缺口；官方默认主题、历史栅格和 research 结论不进入业务真相。

每个批准页面的 UI Surface Inventory 还必须为每个可操作控件登记 app-owned typed locator，命名遵循 `{surface}.{controlOrState}`，并由页面把同一常量绑定到 `data-testid`。L2 进入动作必须优先使用该 typed locator（`getByTestId`）；可访问名称只用于独立断言用户可感知语义，不能作为唯一动作定位。只有明确登记为 legacy/不适用且带 rationale、designRef 和退出条件的控件，才允许暂时例外；用正则放宽名称、依赖文本包含或在测试中临时拼接 test id 都不能关闭例外。Batch 关闭前，included 页面控件的 locator 登记、绑定、动作使用、精确可访问名称与真实 request/state/readback 必须在同一份 evidence 中闭合；缺 locator、缺绑定或以 name-only 代替 locator 的页面按验收门 fail closed。该门是有限的 Journey/Page/Step 分母，不建设全仓 DOM/test-id 扫描器。

所有后台页面先选择成熟 Pro 容器：Shell=`ProLayout`、页面=`PageContainer`、标准列表=`ProTable`、表单/详情优先 `DrawerForm/ProForm/ProDescriptions`。业务 feature 不得拥有页面高度、内容区 flex、列表满高、滚动边界、通用间距或主题颜色 CSS；这些机械规则由 app `src/app` 的唯一 layout/theme/style 入口管理。两个 admin 的真实列表页都证明同一布局 invariant 后，可把不含业务词和主题色的语义容器提升到 `libraries/frontend/admin-ui-foundation`；两个 app 仍分别提供 theme token。列表页“上下填满可用内容区”必须通过该唯一容器或 token 调整，禁止每页 `calc(...)`。

每个 Step obligation 至少包含：state ownership、wire adapter boundary、context invalidation、render side-effect boundary、mutation idempotency、component decision、Pro fallback reason（若适用）、loading/empty/error/recovery、keyboard/focus、统一 layout/theme 入口和 L2 readback。

标准搜索列表页的实现还必须逐项对照批准的搜索、排序和单元格展示矩阵：控件值只在明确 adapter 边界转换为 generated query；排序只提交批准的服务端 sort key；名称、编码、状态、来源、多值关系和时间按矩阵渲染。L2 必须覆盖每类控件的一次真实查询、每个允许 sort key、禁止列无排序入口、名称链接详情、动作矩阵与 owner readback。控件/列存在、mock 命中或当前分页本地排序均不算证据。

所有用户可见文案必须读取 `business-user-facing-language-standard.md` 的业务语言矩阵。内部 enum/type/error 不得直接渲染；页面、Drawer/Modal、空态、错误态和可访问名称都要经过业务词映射。L2 对当前 Journey 明确禁用的抽象词增加可见文本负向断言，但不得把通用字符串扫描器升格为业务正确性证明。
