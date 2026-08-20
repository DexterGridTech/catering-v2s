---
id: pitfalls.browser-route-data-scope-drift
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["admin-ui","backend","platform"]
consumerFaces: ["backend","operations-admin","platform-admin"]
owners: ["backend","frontend-platform","platform"]
impacts: ["architecture","owner","session","contract"]
triggers: ["implementation","review","failure"]
assertions: ["BROWSER_ROUTE_NOT_DATA_SCOPE","BROWSER_ROUTE_NOT_AUTHORITY"]
sourceRefs: ["doc/platform/backend-coding-standard.md","doc/platform/frontend-coding-standard.md"]
---

# 浏览器路由与数据节点 scope 分离

- **失败模式**：页面把 project/store 等数据节点 UUID 拼进 canonical browser route，路由解析再把它回填到 query context；页面看似支持深链，实际把 URL 变成了数据范围选择器。
- **本次实例**：经营渠道项目页和门店页曾分别使用 `projects/:scopeRef/business-channels` 与 `stores/:scopeRef/business-channels`，并由 `OperationsApp` 优先采用 `routeMatch.scopeRef`。
- **根因**：没有区分三种 ref 的职责——浏览器 route 只定位页面/工作空间，WorkspaceScope 才确认当前数据节点，API owner ref 才选择资源聚合且必须由 edge 重新授权。把三者合成一条 URL 造成控制面漂移。
- **适用边界**：前端 canonical route、route parser、route builder、query-context 派生和 edge authorization 的连接处。API `/projects/{projectRef}`、`/stores/{storeRef}` 等资源路径仍可保留；它们不是 browser route，也不因路径存在而自动获得授权。
- **最小解**：页面采用稳定 route，scope 只从已确认会话上下文读取；旧 UUID route 仅作为忽略 UUID 的一次性迁移别名；edge 对每个 owner read/write 复核会话节点与目标 ref。测试必须同时覆盖 stable route、legacy redirect 不回填 scope、跨节点拒绝。
- **项目规则**：具体规范正文只维护在 `doc/platform/frontend-coding-standard.md` §3-H 与 `doc/platform/backend-coding-standard.md` §2-G；本条保留失败模式、反例边界和本次修复的记忆，不复制规范全文。
