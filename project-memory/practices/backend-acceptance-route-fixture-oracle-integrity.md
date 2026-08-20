---
id: practices.backend-acceptance-route-fixture-oracle-integrity
title: 后端 acceptance 必须同时证明路由身份、夹具可达性与断言对象
type: practice
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["backend", "contract", "admin-ui", "platform"]
consumerFaces: ["all"]
owners: ["backend", "contract", "frontend-platform"]
impacts: ["architecture", "contract", "evidence"]
triggers: ["task-start", "implementation", "review", "failure"]
assertions: ["ACCEPTANCE_ASSERTS_EXACT_NESTED_ROUTE", "ACCEPTANCE_FIXTURE_REACHES_TARGET_RULE", "ACCEPTANCE_ORACLE_EXCLUDES_TRANSPORT_METADATA"]
sourceRefs: ["project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md"]
---

# 后端 acceptance 的路由、夹具与断言完整性

## 1. HTTP 200 不等于命中了目标业务资源

后端 acceptance 场景必须从真实 route registry 或契约 operation 组装完整路径，并同时核对
`routeTemplate`/`operationId` 与预期资源。嵌套集合不能用父资源 detail 的短路径替代；短路径可能仍返回
HTTP 200，却读回了另一种语义对象，造成“空列表”“字段缺失”或错误权限结论。

这条规则适用于带父资源和子资源的 page/detail/binding 路径，例如 provider detail 与 provider
`owner-bindings` page。直接 detail endpoint 本身是反例边界：它不需要人为追加子资源段，但仍必须核对
operation identity 和响应 shape。

## 2. 夹具必须先到达被验证的规则

一个场景要验证解绑约束、状态级联、认证类型或跨节点授权，fixture 必须先满足创建目标实体的全部
前置字段，并在日志或业务结果中证明已经进入目标规则。缺少用户输入的编码、节点或绑定状态，导致请求在
更早的通用校验层失败时，该场景只能证明“前置校验拒绝”，不能证明目标规则；这应标为 fixture gap，不能
把它当作目标 owner policy 已覆盖。

最小要求是：创建链路使用与生产 contract 一致的必填字段；场景结果包含目标命令的业务断言；失败时保留
首个失败日志并定位 broken boundary。

## 3. 业务断言不能把传输元数据当作数据泄漏

对错误响应做跨 scope/身份断言时，必须针对公开 problem 的业务字段断言，排除合法的 transport metadata，
例如指向当前请求资源的 `instance` URI。不能用整段 JSON 字符串搜索资源 UUID 来判断越权泄漏，否则会把
错误响应的定位信息误判为 owner 数据泄漏。

这不放宽公开 problem 的脱敏要求：敏感字段仍不得返回；只是要求测试 oracle 明确区分业务 payload 与协议
定位元数据。

## 4. 最小防再犯闭环

每个新增或修改的 acceptance 场景至少复核三件事：

1. exact route/path 与 operationId 是否命中目标 owner/read model；
2. fixture 是否到达要验证的 policy/command，而不是在更早层失败；
3. oracle 是否只断言目标业务事实，并把 contract、business、日志首败和 cleanup 分开记录。

测试 review 应主动加入一个能打红的反例：把嵌套资源段删掉、删除一个目标规则所需的必填字段，或把合法
`instance` 放入响应后检查越权业务字段。只有反例真的失败，才说明防线在工作。
