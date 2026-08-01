---
id: decisions.business-entity-list-detail-action-standard
title: 业务实体列表、详情与动作统一交互标准
type: decision
status: active
layer: routed
scope: all-v2 current and future admin business iterations
createdAt: 2026-07-15
taskKinds: [frontend-implementation, journey-design, ui-design, ui-review]
domains: [admin-ui]
consumerFaces: [platform-admin, operations-admin]
owners: [frontend-platform, product]
impacts: [component, feedback, navigation, state]
triggers: [admin-page, new-page, review, ui-change]
sourceRefs:
  - doc/platform/admin-consumer-chrome-standard.md
  - doc/platform/user-journey-first-design-standard.md
  - doc/review/platform/2026-07-15-four-domain-31-scenario-design-self-review.md
  - doc/review/platform/2026-07-15-four-domain-journey-design/d02-s03-business-entities.md
  - doc/review/platform/2026-07-15-four-domain-journey-design/detail-form-field-review-matrix.md
---

# 业务实体列表、详情与动作统一交互标准

本规则是 all-v2 的长期产品交互不变量，不只适用于当前四域或当前 30 个有效 Scenario。后续新增迭代中的任何**可独立寻址、可独立查看详情的持久业务记录**均默认适用，包括集团空间、组织节点、经营主体、门店、合同、角色、账号、成员、邀请、扩展字段适用实体目录和平台技术管理员。

1. 实体列表不得设置“操作”列，也不得在行尾放查看、编辑、停用、初始化、复制、取消或重发等动作。
2. 列表的主识别列使用用户可理解的名称链接；没有自然名称的实体使用稳定业务标识链接，例如合同编号。不得用内部 ID 充当链接文案。
3. 点击主识别链接后，从右侧打开该实体的详情 Drawer。详情 Drawer 左上角必须有明确关闭按钮，右上角只显示当前状态、当前主体授权和当前数据范围下真正可执行的动作。
4. 用户点击详情 Drawer 右上角动作时，必须先关闭详情 Drawer，再进入下一载体：凡需填写业务字段的创建、编辑、维护或初始化使用独立表单 Drawer；不需额外业务输入的启停、撤销、取消、重发等纯确认动作使用 Modal。禁止把详情 Drawer 留在后面叠加第二个 Drawer/Modal。
5. 只读实体仍使用名称链接和详情 Drawer；没有合法动作时，右上角动作区为空，不显示伪按钮、禁用按钮或“无操作”占位。
6. 新建动作仍可位于页面页头，不属于列表操作列。
7. Drawer/Modal 使用遮罩承载，打开期间后台 Shell 的菜单、Content Tabs、集团空间/角色/可视数据节点等上下文选择器不可操作。上下文切换只发生在这些载体关闭后的基础页面状态，因此不设计跨上下文携带或放弃抽屉表单草稿的分支。

任何当前或未来业务实体的详情、新建和编辑还必须逐字段明确：业务分组与顺序、展示或表单控件、必填/只读、owner 与候选来源、级联关系、选项限制、校验、空值和 unresolved 表达。禁止用“必要字段”“其他信息”“按 contract 展示”等占位。关系字段必须区分页面范围、直接关系、选择来源和快照：门店关系是项目+租户+品牌；项目分期是 JSON Array{name}；合同从项目分期列表选择但只保存名称 string 快照，并由门店带出租户。项目分期变化不得回写历史合同。

重复项表单必须同时设计数量、空值、去重、显示顺序和增删交互。例如合同货号为一到多条，使用 `+/-` 增删，剩最后一条时不得删为空，规范化后合同内不得重复，列表只做有界摘要而详情必须显示全量。

任何采用“上方搜索、下方列表”的实体页，在 JG3/JG4 必须按**具体实体**提交以下三张设计矩阵，禁止复制一套通用字段或依赖 ProTable 默认行为：

1. **搜索控件矩阵**：逐项写明业务字段、Text/Select/SearchSelect/Cascader/DateRange 等控件、精确/前缀/模糊/关系查询语义、选项来源、业务价值，以及为什么不采用其他控件。关联对象只有在真实关系筛选有用户价值时才使用 SearchSelect；只有真实层级选择才使用 Cascader。
2. **排序矩阵**：逐列声明可排序或不可排序、业务原因、服务端 sort key、默认顺序和稳定次排序。不得给没有业务顺序的状态、多值关系或稀疏辅助字段增加排序图标；不得只排序当前分页。
3. **单元格展示矩阵**：逐列声明普通文本、名称链接、语义 Tag、关系摘要、时间、金额、编码的展示层级、字体/字重/数字形态、空值和省略策略及业务原因。状态/分类才能使用 Tag；业务编码不得因“看起来技术”而自动做成彩色标签。

这些矩阵不是评审附件。正式派生时必须逐项进入 interaction spec、owner query/contract draft、Step Delivery Map、Memory Obligation Map 和 L2 task。最终 L2 必须通过真实请求与 owner readback 证明搜索语义、允许和禁止的排序、名称链接、详情、单元格语义及 capability/status/source 驱动的动作；只断言控件或列存在不算完成。

以下表面不自动适用：选择器/候选项、权限矩阵或配置矩阵、纯只读概览聚合结果、登录/公开/结果流程，以及不能独立寻址的嵌入子行。平台只读概览若展示的仍是可独立寻址业务实体，而非聚合结果，则仍须使用名称/业务标识链接打开只读详情 Drawer。扩展字段编辑 Drawer 内的字段定义是当前适用实体配置的嵌入子项，固定使用 Ant Design Pro `EditableProTable` 完成新增、修改和删除；所有行级变化只进入 Drawer 本地草稿，底部“保存”一次提交完整集合并由 owner 原子保存，不得逐行即时 mutation，也不得反向在外层实体目录恢复操作列。

对后续相似的“单次维护多行、每行包含多个属性、owner 以带版本完整集合替换”的嵌入配置，可优先采用同一 `EditableProTable + Drawer 统一提交` 模式；只有正式 Journey 证明 owner 的真实事务是独立行命令时才允许逐行保存。项目分期、合同货号等每行只有一个主要值的短列表继续使用 `+/-` 表单列表；不得为了组件统一牺牲用户任务密度。

任何例外必须在目标 Journey 的 JG0/JG3 明确说明为何该记录不是独立实体，或为何 Drawer 无法承载真实任务，并经 Dexter 评审；实现者不得临场增加操作列或行内动作。像组织架构这种以层级选择为主任务的页面可以经批准使用“左树右侧固定详情”，但仍须遵守业务化动作名称、遮罩表单、纯确认 Modal 和真实 readback，不得借例外恢复通用列表或抽象术语。
