---
id: practices.external-collaboration-readback-display-and-detail-surface
title: 外部协作读回显示、绑定表格与详情面规范
type: practice
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["platform", "admin-ui", "contract", "backend"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["platform", "frontend-platform", "product"]
impacts: ["contract", "architecture", "governance"]
triggers: ["implementation", "review", "failure"]
assertions: ["OWNER_BINDING_DISPLAY_FACTS_ARE_COMPLETE", "OWNER_BINDING_ADMISSION_FOLLOWS_AUTH_KIND", "DETAIL_ACTIONS_USE_HEADER_EXTRA"]
sourceRefs: ["project-memory/practices/external-collaboration-readback-display-and-detail-surface.md"]
---

# 外部协作读回显示、绑定表格与详情面

## 1. 读回事实必须能直接被用户理解

契约中的 code/enum 负责机器匹配和命令提交；用户可见处的实体名称仍由 owner readback 提供，代码闭集的
业务文案由两个前端各自复用本地字典，不能要求 owner 重复传输 `*DisplayName`、scope label 或 descriptor
payload。能力属性只返回结构化的 typed `attributeValues`；前端按“属性 / 当前值 / 说明”三列展示，说明与
控件元数据来自本地 presentation map。`capabilityClass` 对 `INTERNAL_MAPPING` 和 `NO_MAPPING` 应为空，
业务列必须显示 provider 的业务范围名称，不得因为该字段为空就显示 `—`。

外部主体编号的空值按认证类型解释：`EXTERNAL_GRANT` 是“待外部授权回填”；`NO_MAPPING` 是“无需主体映射”；
`INTERNAL_MAPPING` 的空值是脏数据/无效状态，必须由 owner 校验或报告问题，不得伪装成外部授权待回填。

## 2. 新建绑定是业务准入，不是权限替代

“新建绑定”只在 provider 已启用且认证类型为 `INTERNAL_MAPPING` 或 `NO_MAPPING` 时出现并可执行；
`EXTERNAL_GRANT` 的绑定由外部授权流程产生。后端仍必须独立校验：内部映射必须有外部主体编号，
无需映射不得接收外部主体编号，非外部授权不得接收 capabilityClass。前端隐藏入口不是校验。

## 3. 列表与详情面

绑定关系使用仓内标准 ProTable：绑定名称和绑定节点分开的搜索项，服务端分页，服务端排序，`scroll.x` 保证
完整列可左右查看；首列是可点击的绑定名称。详情使用标准窄 Drawer surface，实体操作统一放 Drawer 右上角
`extra`，编辑和表单使用另一套标准 Drawer，不把动作塞回详情正文底部。

启用/停用使用标准按钮并在命令前确认，不使用 Switch/radio 作为实体状态命令。详情基础字段属于详情 Tab，
绑定关系属于独立绑定 Tab；内部实现说明不直接暴露给用户。

## 4. 根因与防再犯

根因是把机器枚举当作用户文案、把认证状态当作统一的“外部授权”流程、把 owner read projection 当作可选
字段，以及按局部 Card/Table 拼装页面而没有复用标准 surface。代码闭集只保留 raw enum union 与前端字典；
业务实体名、历史快照和结构化属性事实仍由 owner 返回。修改时必须同时扫描 contract schema、checked-in
catalog、owner mapper/edge、两个管理后台、生成 wire、acceptance fixture 和空值/状态反例；只改单个渲染
分支不算根因修复。

最小回归集合：每种认证类型各一条绑定；内部与无需映射各验证一条成功和一条错误输入；外部授权验证平台
创建被拒绝；绑定列表验证独立搜索、分页、排序、横向滚动；详情验证 action header、显示名称和空值文案。
