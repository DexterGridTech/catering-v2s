---
id: practices.content-tab-unified-refresh-lifecycle
title: 内容 Tab 必须接入管理后台统一刷新生命周期
type: practice
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["platform", "admin-ui", "backend"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["frontend-platform", "platform", "product"]
impacts: ["architecture", "contract", "governance"]
triggers: ["implementation", "review", "failure"]
assertions: ["CONTENT_TAB_REFRESH_REACHES_ALL_READ_MODELS", "CONTENT_TAB_REFRESH_PRESERVES_DIRTY_FORMS"]
sourceRefs: ["project-memory/practices/content-tab-unified-refresh-lifecycle.md"]
---

# 内容 Tab 统一刷新生命周期

## 1. 规则

两个管理后台的每个内容 Tab 必须接入所属 App Shell 的统一“刷新当前页”生命周期。刷新动作必须同时覆盖：

- RTK 查询对应的 LIST tag；
- 命令式 `platformClient`/`operationsClient` 或 `read*` 查询；
- 服务端分页、排序列表；
- 刷新时仍打开的只读详情读回。

统一刷新信号是唯一跨页面通知点。页面不可另造并行的全局刷新事件，也不可只刷新标题、局部数组或当前
可见行。Tab 的视图切换不是刷新，不应为了切换树表视图而重新请求不受影响的读模型。

## 2. 交互边界

刷新只能覆盖读模型，不能重置未提交的创建/编辑表单、脏 Drawer 或用户正在进行的筛选输入。详情 Drawer
若打开，应在信号变更后重新读取并保持当前实体定位；若实体已被删除/失效，应显示 owner 的最新事实和明确
错误，不用旧快照继续渲染。

## 3. 根因与最小防再犯解

根因是把 Shell 的刷新按钮当成 UI 装饰，而没有把“内容 Tab 中的所有读边界”列成同一生命周期；RTK query
能自动失效并不意味着命令式读请求或打开的详情会自动重读。最小解是 App 层各维护一个 content-tab
refresh signal，列表和详情使用 foundation `useRefreshVersion` 接入，RTK 继续沿用既有 LIST tag 失效。

新增内容 Tab 时，implementation review 必须列出它的 RTK query、命令式读请求、分页/排序请求和打开详情，
并用一次真实变化→点击刷新→逐项读回的 focused test 或浏览器证据证明覆盖。任何一项没有订阅或没有
对应 tag，即为缺口。

## 4. 反例

经营渠道项目/门店页面、外部协作绑定关系 Tab 曾存在统一刷新按钮，但列表和详情分别使用局部刷新信号或
命令式请求，导致刷新后仍显示旧数据。该反例要求同根扫描两个 App 的所有内容 Tab，不得只修复被用户点
到的页面。
