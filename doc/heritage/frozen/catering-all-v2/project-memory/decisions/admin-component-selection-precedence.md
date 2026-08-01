---
id: decisions.admin-component-selection-precedence
title: Admin 组件选择优先级
type: decision
status: active
layer: routed
scope: admin-web
createdAt: 2026-07-13
lastUpdatedAt: 2026-07-16
taskKinds:
  - ui-design
  - frontend-implementation
  - ui-review
domains:
  - admin-ui
consumerFaces:
  - platform-admin
  - operations-admin
owners:
  - frontend-platform
impacts:
  - component
  - accessibility
  - l2
triggers:
  - antd
  - procomponents
  - component-choice
sourceRefs:
  - doc/decisions/2026-07-16-admin-ui-ant-design-experience-governance.md
  - doc/platform/admin-ui-interaction-and-ant-design-usage-standard.md
---

# Admin 组件选择优先级

两个管理后台的业务 feature 不得自行挑选、包装或重造控件。顺序固定为：

1. 先使用锁定版本的成熟 `@ant-design/pro-components`；
2. 只有 ProComponents 经 API、真实交互或可访问性核验不能满足当前 Journey task 时，才使用锁定版本的 `antd` 非 Pro 组件；
3. 例外必须在当前 interaction spec 记录缺口与 L2 证据；
4. 禁止 deep import、复制 Pro 能力、业务 feature 自建皮肤或为了“统一”再包一层无平台语义 wrapper。
5. 编码前用锁定版本的 Ant Design CLI 执行 `antd info/doc/demo/token/semantic --format json`，核对官方 API、demo、semantic styles 与 tokens；修改后运行 `antd lint`。CLI 只提供官方知识、脚手架和静态检查，不能覆盖 Journey、生成第二套 Shell 或把通用布局/CSS 写回各 feature。

已由 PKG-1.5 真实验证、可以直接继承的组合只有：

- 登录：`LoginForm + ProFormText + ProFormText.Password`；
- 已登录最小 shell：`ProLayout`，具体色调只从当前 app-owned theme config 注入，不进入业务 Journey；
- Problem feedback：页面只消费 app-owned feedback 结果，具体 `Alert/Result/Button` 是窄承载，不形成第二映射入口。

标准后台页面还必须优先组合成熟 Pro 容器：`PageContainer` 承担页头与内容边界，标准搜索列表使用 `ProTable`，表单/详情优先 `DrawerForm/ProForm/ProDescriptions`；只有 Pro 没有合适承载时才退到 AntD。业务 feature 不得为列表满高、内容滚动、页边距或表格高度各写 CSS；这些机械布局由一个 app/foundation 语义容器和集中 token/CSS 入口拥有。跨 app 的同一列表布局只有 platform-admin 与 operations-admin 两个真实页面都消费并有 focused evidence 后才进入 `admin-ui-foundation`，否则先留在首个 app。

AntD fallback 也不是自由发挥。每个相关 interaction Step 必须按 `doc/platform/admin-ui-interaction-and-ant-design-usage-standard.md` 明确 surface、信息层级、组件决策、Pro 缺口、键盘/焦点、loading/empty/error/recovery、token/layout owner 和 L2。按钮、表单、Tree、Tabs、Steps、Modal、Result、Alert、Tooltip 等必须使用锁定版本 CLI 核对真实 API/semantic；组件存在或官方 demo 不能新增产品按钮、字段、排序、Tag、确认方式或状态。

官方设计原则只做 `KEEP/ADAPT/REJECT` 输入：保留清晰层级、直接反馈、可恢复和一致性；历史固定栅格、画布、默认色调和研究结论必须适配当前 `antd 6.5.0` token 与批准 Journey；拒绝操作列、硬编码视觉值、`.ant-*` 覆盖、复制 demo CSS 和用上游文档替代产品设计。

旧 PKG-2 的 GroupWorkspace、role/access 和 workspace IAM 页面组合已经撤销，不再属于“当前应用”或可复用证明。后续列表、详情、表单、工作台必须从批准 Journey 的信息层级和控件任务重新选择；v4/all-v1 已验证组合可作为 Heritage 输入，但不能覆盖当前 consumerFace、owner 或用户路径。

这条决议不是 shared runtime UI package 或组件 DSL。跨 app 共用能力必须先有两个真实消费者和可证明收益。
