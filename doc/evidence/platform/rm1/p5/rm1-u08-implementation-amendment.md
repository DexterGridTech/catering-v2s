# RM1-U08 P5 实施补充：业务问题与最小方案

## 1. 为什么做

本包不创造新 Journey 或新页面操作。它服务既有后台用户已经在执行的管理任务：

- `G-03` 要求运营用户在登录后进入与其任职匹配的角色首页；
- `G-05` 要求用户切换任职时切换相应页面与权限上下文；
- `G-10` 固定 platform-admin 与 operations-admin 为两个独立后台及各自 URL。

原文分别见 `project-memory/decisions/confirmed-business-language-corpus.md` 的
`G-03 / G-05 / G-10`，并以 `doc/review/platform/2026-07-25-v2s-business-corpus-draft.md`
的对应条目为业务语义 owning source。对用户而言，成功结果是：会话撤销、网络失败、翻页失败或
迟到响应发生时，当前任务能显示真实失败、保留可恢复的已成功数据，且不会继续使用失效会话、无限
请求或覆盖正在填写的草稿。

直接问题来源是 `doc/review/platform/2026-07-28-v2s-r6-problem-inventory-claude.md`：
`P-E4`、`P-Q2/P-Q3/P-Q4/P-Q9`、`P-R1` 至 `P-R6`、`P-X3` 与 `ST-9`。这些条目不是新增产品
语义；它们是既有后台任务在失败恢复、上下文切换与写后读回方面的可靠性缺口。

## 2. 方案与边界

冻结的 `B.4` 前端规则（`doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`）规定：
server fact 由 RTK Query 管理；每个 app 保有自己的 shell/router/store/baseApi/session/context/
invalidation；foundation 只能提供 wire-agnostic 机械 primitive，且依赖方向只能是 app 到
foundation。`RM1-P5` 详设同时要求先 foundation、再双 app thin consumer，禁止在 app 复制
shared HTTP/context/overlay/observability。

因此采用最小方案：foundation 提供稳定 Drawer lifecycle、请求 generation 与 Error Boundary 等
中立机制；两个 app 分别把 401 清理、会话恢复、路由与 RTK cache/tag policy 接到自身 baseApi/
session。feature 不再各自维护 reload 计数或直接重拉。平台 transport 的 `P-X3` 必须抛出
`Error` 子类/实例，不得把裸 Problem 对象交给 React error/recovery 机制。

比较过的更小替代是逐页增加 `try/catch`、`load()` 或 active boolean。它不能消除 14 个已登记
ST-9 consumer 的三套刷新权威，也会继续把共同的生命周期与过期响应处理复制到 app/feature，故拒绝。
另一替代是把 session/router/baseApi 上提到 foundation；这会违反双 app 各自 owner 的 B.4 边界，故拒绝。

## 3. 交互与验证

UI 形状和用户操作不变，故 P5 的 `uiAndTerms` 为 NOT_APPLICABLE；但错误、恢复、会话清理和
翻页保留是既有任务的可用性语义，必须用 focused tests/red mutations 验证。真实受控变更必须覆盖：

1. Drawer return identity 稳定，去掉 memo 时 repeat-request proof 变红；
2. generation guard 拒绝迟到响应；
3. 401 清掉 app-owned session/cache 并中止当前请求；
4. logout remote failure 后仍清本地会话；
5. Error Boundary fallback/retry 与保留上一成功页；
6. ST-9 的唯一 cache invalidation authority 及所有登记 consumer trace；
7. foundation 与 hooks lint 覆盖，移除 hooks plugin 或排除 library 时精确变红。

本补充仅解释并落实已批准的 `RM1-U08`；不授权新 UI、API、数据模型、DEV、seed 或 reset。

## 4. 独立复核后的实施补正（已实施，独立复核已 GO）

独立 implementation 盲审确认：以 `subscribe:false` 调用一个通用 `wireQuery`，再由
`RefreshSignal` 触发页面本地 load，不能满足 `ST-9/P-Q2` 的“真实 RTK query/tag consumer”
要求；它只是另一种手动重拉。根因是 generated `*-edge.ts` 只生成 Promise client，未生成操作
级的 RTK endpoint/hook，feature 因而无法在不手写路径、不越过 transport 边界的前提下订阅 owner
read model。

最小正确补正不是把 raw RTK API 暴露给 feature，也不是把 app 的 cache/session 上提 foundation；两者
分别违反 raw import boundary 与 B.4 owner 边界。它需要在 edge codegen 为每个 generated `GET` 产生
operation-shaped `build.query`，为命令产生 `build.mutation`，由 app-owned transport 绑定，再将现有
登记 consumer 逐一迁移为这些 generated query 的订阅者。只有这一形状能让 mutation tag invalidation
触发真实 active query 的 refetch；`RefreshSignal` 仅可作为迁移期间的兼容层，不能再作为 P5 的完成
证据。每个 consumer 同时必须以 generation guard 保护异步 owner readback，防止先发请求覆盖后发
请求。

这项补正继续服务第 1 节所述既有用户任务，不增加 Journey 或页面操作；实现已扩展到 code generator、
generated output 与每个已登记 read consumer。生成器默认写入口现 fail-closed；只有显式受控写会记录
exact generated-output pre/post receipt。当前生产源码、red proof 与独立 implementation review 已完成；其结论为
`GO (M=0 / S=0 / N=2)`，对应工件为 `doc/review/platform/2026-07-29-v2s-rm1-p5-implementation-review-round1-codex.md`。
该 verdict 不代替 package exit；后者仍须以实际变更路径、receipt 和 source-compliance 分母完成独立对账。
