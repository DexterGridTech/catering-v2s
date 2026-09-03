---
id: operations.l2-read-model-settle-before-control-binding
status: active
layer: routed
taskKinds: ["implementation","testing","review"]
domains: ["admin-ui","platform"]
consumerFaces: ["operations-admin"]
owners: ["frontend-platform"]
impacts: ["runtime","evidence","governance"]
triggers: ["failure","implementation","review"]
assertions: ["L2_WAITS_FOR_EXACT_OWNER_READ_MODEL","CONTROL_BINDING_FOLLOWS_RENDERED_DATA","NO_ARBITRARY_WAIT_FOR_UI_SETTLE","READ_MODEL_RACE_IS_NOT_FIXED_BY_TESTID_RELAXATION"]
sourceRefs: ["apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts","project-memory/operations/l2-read-model-settle-before-control-binding.md","project-memory/operations/ui-testid-preflight-before-l2.md"]
---

# L2 控件绑定前必须等待精确 owner read-model 收敛

当页面控件由异步 owner read-model 的 `currentData` 控制渲染时，L2 脚本必须先等待与当前业务身份、模式和资源路径精确匹配的 generated operation 完成，并记录结构化 checkpoint，再要求真实控件的 testId 或执行下一步动作。

适用范围包括菜单选择后的菜单详情→分区→商品列表、候选抽屉→目录导航、分页后的新页面数据等连续 read-model 链。等待必须基于受管 runtime 的精确 operation/path/status 观察，不得用固定 sleep、盲目增加 timeout、宽 locator、放宽 testID 或放宽业务断言掩盖未收敛的数据。

该模式首先是 L2/fixture 的时序边界诊断，不得在没有生产代码证据时修改 owner 逻辑；若精确 read-model 已成功完成而控件仍未按详设渲染，才转入 UI/生产 owner 的独立根因分析。
