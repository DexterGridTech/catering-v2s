# Admin UI 交互与 Ant Design 使用标准

- **Type**：normative
- **Status**：active
- **Scope**：`platform-admin`、`operations-admin` 当前和未来迭代
- **Decision**：[2026-07-16 Admin UI 的 Ant Design 体验治理裁决](../decisions/2026-07-16-admin-ui-ant-design-experience-governance.md)
- **Locked runtime**：`antd 6.5.0`、`@ant-design/pro-components 3.1.12-0`

## 1. 真相优先级

冲突时按以下顺序裁决：Dexter 最新裁决 → 批准 Journey/线框/矩阵 → all-v2 本地 UI 与业务标准 → 当前 interaction spec → 锁定版本官方 API/token/semantic → 上游通用设计原则 → v4/v1 Heritage。官方示例不能新增业务字段、按钮、排序、状态、页面或授权。

本标准只约束 UI 组合和交互质量，不建立页面 DSL、组件注册表、视觉 scanner 或新的 runtime UI package。

Journey Scenario/Step 只负责需求和 evidence 追踪，不是 runtime 目录或组件边界。Interaction Spec 必须按真实 Page/业务 module/state owner 给出实现组合，再把 Step 映射到已有 page/task surface；禁止一 Scenario 一 feature、一 Step 一组件或以 Journey ID 命名 Page/hook/store/slice/selector/test file。

## 2. 编码前的固定决策流程

每个 UI Step 必须依次完成：

1. 先从 Packet 确认 actor、完整 surface、入口、最终 readback、页面准入、查看范围和 capability；
2. 先选成熟 ProComponents 页面模式，再判断缺失能力；
3. 降到 AntD 时记录“Pro 缺口、选择的 AntD 组件、替代方案、交互/可访问性风险、L2 证明”；
4. 用锁定版本 CLI 查询真实 API，不从记忆或搜索摘要写 prop；
5. 明确 loading/empty/error/disabled/unresolved/partial/success 与关闭/返回落点；
6. 明确 layout/theme/style 的唯一 owner，禁止 feature 自写机械页面 CSS；
7. 先登记 L2 的用户动作、焦点、请求、readback 和失败恢复，再编码。

标准查询形态：

```bash
antd --version 6.5.0 --lang zh --format json info Button
antd --version 6.5.0 --lang zh --format json doc Form
antd --version 6.5.0 --lang zh --format json demo Select basic
antd --version 6.5.0 --lang zh --format json token Table
antd --version 6.5.0 --lang zh --format json semantic Drawer
antd lint <target>
```

只查询当前真实使用的组件；升级版本时重跑查询和 L2，不把旧 prop/semantic 名永久化。

## 3. 页面与信息层级

- 每个真实 Page 只有一个业务命名的 composition root，拥有唯一 route/Content Tab/PageContainer/query 与页面状态；多个 Scenario 的 task/Drawer/Modal 由该 Page 组合，Shell 不直接 import Scenario module。
- 两个 app 的 state owner 固定分层：RTK Query=server state，router=可分享导航，app state=session/Shell/context，page/feature model=真实跨 surface workflow，ProForm/component local=单 overlay 草稿。统一 typed Redux hooks；slice/selector/custom hook 按共享范围和生命周期准入，不按 Step 创建。

- Shell 使用 `ProLayout`，页面使用 `PageContainer`；页面标题、副标题、页头主动作、正文和辅助信息的层级由统一容器控制。
- 当前任务的主信息在第一屏可见；次要说明放在邻近位置，不用独立 Card/Divider 制造无意义层级。
- 相关字段和动作按用户决策顺序分组；对齐同类标签、控件与数值，避免锯齿式布局。
- 一个决策 surface 只有一个主动作。其他动作使用 default/link/text 或进入详情动作区；危险动作不得仅靠红色区分。
- 页面满高、内容 flex、滚动、sticky 边界、页边距和标准列表高度只由 app 的唯一 layout/style 入口或合格 foundation 控制。
- 当前产品是 desktop Web；不要为未批准的 mobile viewport 压缩信息层级或增加移动专用导航。

## 4. 组件选择矩阵

| 用户任务 | 首选 | 可采用的 AntD 补充 | 禁止 |
| --- | --- | --- | --- |
| 已登录页面外壳 | `ProLayout + PageContainer` | `Tabs/Dropdown/Result/Spin` 等窄承载 | feature 自建 Shell/Page chrome |
| 搜索与列表 | `ProTable` | 经批准的 `Tree/TreeSelect/Cascader/Tag/Tooltip` | 操作列、默认全列排序、当前页本地冒充服务端排序 |
| 详情 | `ProDescriptions` + 右侧 Drawer | `Skeleton/Empty/Alert/Result` 状态 | 整页详情替代批准 Drawer、详情后叠第二 Drawer |
| 新建/编辑 | `DrawerForm/ProForm` | 当前字段所需的锁定版 AntD input | Modal 塞复杂表单、页面内散落 mutation form |
| 简短重复值 | `ProFormList` 或等价 Pro 模式 | `Button` 的 `+/-` 窄动作 | 为单值短列表强上 EditableProTable |
| 多属性整组配置 | `EditableProTable` + Drawer 统一提交 | 必要的字段控件 | 行级即时 mutation、外层恢复操作列 |
| 组织层级浏览 | 批准的左树右详情组合 | `Tree + ProDescriptions` | 用户文案出现“节点/父节点/子节点” |
| 单次纯确认 | all-v2 统一 Modal | `Alert` 展示影响/风险 | 行内 Popconfirm 恢复业务动作 |
| 多步公开流程 | `Steps + ProForm/Result` | `Alert/Spin` | 与已登录 Shell 混画、自动跳过完成态 |

组件只是载体。字段、按钮、Tab、Tag、排序、筛选、分组与状态都必须由批准设计给出。

## 5. 按钮、链接与动作

- 用动词和业务对象命名，如“新建项目”“设置失效”；避免“确定”“处理”“操作”等脱离上下文的词。
- Primary 只给当前 surface 最重要且安全可预期的下一步；取消/关闭不得伪装成 Primary。
- 链接用于导航或打开批准详情，按钮用于改变状态或发起命令。不要用无 href 的链接模拟按钮。
- 仅图标按钮必须有稳定可访问名称和可发现的 Tooltip；高频、关键或危险动作默认保留文字。
- disabled 只用于用户仍需理解但当前不可用的动作，并就近解释原因；无权动作按批准矩阵隐藏，不能用 disabled 泄露不可见能力。
- pending 时按钮 loading，相关 Form 整体 disabled，并阻断关闭和重复提交；loading 不是业务步骤。

## 6. 表单与数据录入

- 字段顺序按用户完成任务的决策顺序，不按 DTO、数据库列或技术 owner 排列。
- 标签使用业务词；placeholder 只给格式/示例，不重复标签，也不替代字段说明。
- 必填、只读、候选来源、级联、选项限制、默认值、空值、校验和 unresolved 必须来自字段矩阵。
- Text/Select/SearchSelect/Cascader/DateRange/Switch/Radio/Checkbox 各自按真实数据类型和决策方式选择：自由文本不塞 Select；单次二选一不滥用多选；层级关系才使用 Cascader；远程大集合使用可搜索候选并定义加载/无结果/失败。
- 校验靠近字段，说明如何修复；跨字段/owner 失败还要在表单级显示，不把 raw Problem 直接摊给用户。
- 编辑表单的初始 owner 值和程序化 readback 不计 dirty；dirty guard、提交反馈和成功/失败顺序统一服从 Drawer 生命周期标准。
- 密码、OTP、token 和其他 secret 不回显、不写日志/trace/storage；开发/UAT 验证码明文能力只按专门安全裁决工作。

## 7. 列表、表格、树与详情

- 标准列表严格消费已批准的搜索、排序、单元格三张矩阵；ProTable 的默认能力不能扩大产品分母。
- 每列都要有明确识别价值。名称/稳定标识为主识别链接；编码、状态、关系摘要、时间和空值按矩阵选择普通文本、次级字形或语义 Tag。
- Tag 只表达有限、稳定的状态/分类，不把编码、名称或任意文本彩色化。颜色之外还要有文本语义。
- 长文本先保证关键识别信息；省略时只有确有查看价值才提供 Tooltip，完整内容优先在详情中呈现。
- 空列表区分“当前查询无结果”和“系统尚无数据”；错误、owner unavailable 或 unresolved 不能显示为空列表。
- Tree 节点显示用户可理解的对象名称和状态。键盘选中、展开与当前详情应保持明确；右侧详情的动作按角色能力/状态变化。
- 详情字段按业务分组和阅读顺序展示，不能只给“必要字段”占位；引用不可解析时 fail-visible，不用内部 ID 冒充名称。

## 8. Drawer、Modal 与其他浮层

- 详情 Drawer、表单 Drawer、纯确认 Modal 各自只有一种职责；禁止嵌套同类浮层或在详情未关闭时叠加下一载体。
- 浮层打开时遮罩阻断后台 Shell 菜单、Content Tabs 和上下文选择器；焦点进入浮层，关闭后回到发起控件或等价稳定位置。
- Drawer 左上提供明确关闭；详情动作在右上。表单提交/取消位置在两个后台同类页面中保持一致。
- Modal 只承载短决策、影响说明和确认；复杂字段、候选、重复项或需要恢复草稿的任务使用 DrawerForm。
- Popover/Tooltip 只补充轻量说明，不承载关键事实、唯一操作入口或可恢复错误。

## 9. Loading、Empty、Error、Feedback

- 初次载入使用与目标结构相符的 `Spin/Skeleton`；刷新时保留可安全保留的当前结构并明确刷新状态，但上下文已切换时必须立即清除旧范围事实。
- 空态说明发生了什么和用户可执行的下一步；没有合法动作时不制造空态按钮。
- 错误分为字段、当前表单/区域、整页/依赖失败和跨步骤失败，反馈放在离原因最近且能恢复的位置。
- 成功提示只有在 owner readback 成立后出现。Drawer mutation 必须先关闭 Drawer，再显示成功 Modal；失败保留安全草稿和可展开的清洗技术详情。
- 页面概览的部分依赖失败必须显示每块来源状态和 `asOf`，不能用 `0` 或空集合掩盖失败。
- 用户需要等待时给出进行中状态并防重复操作；不要同时叠加 message、notification、Alert 和 Modal 表达同一事实。

## 10. 文案、可访问性与动效

- 菜单、标题、字段、按钮、空错态、恢复提示和可访问名称统一使用业务语言；“诊断”及 node/scope/principal 等抽象词继续受项目禁用矩阵约束。
- 所有交互必须可用键盘完成；可见焦点不得移除。Tab 顺序跟随阅读/操作顺序，Enter/Space/Escape 行为服从组件语义和 dirty/submitting 规则。
- 表单 label、description、error 与控件建立可访问关联；图标、颜色、位置不是唯一信息来源。
- 每个批准 UI Surface Inventory 中的可操作控件必须有 app-owned typed locator，按 `{surface}.{controlOrState}` 命名并绑定 `data-testid`。L2 用 typed locator 进入动作，再用精确 accessible name 单独验证用户语义；不得用 name-only、文本包含或正则名称取代稳定 locator。legacy/不适用例外必须在当前 interaction spec 和 evidence 中写明 rationale、designRef 与退出条件；Batch 验收对缺登记、缺绑定或缺证据 fail closed。
- 文本和交互状态需要足够对比；若 app 主题改变，通过 token/组件 token 整体校正，不在页面局部补颜色。
- 动效只解释进入、退出、层级和状态变化；时长和曲线来自 token，支持 reduced motion，不能阻断提交或掩盖最终 readback。

## 11. Theme、Token 与 CSS

- 两个后台各自只有一个 app-owned theme config；具体颜色可调整，业务文档和 feature 不绑定 light/dark/blue。
- 优先全局 token、component token 和 semantic styles；禁止 deep import、裸颜色、散落 magic spacing、`.ant-*` 内部覆盖和复制官方 demo CSS。
- feature 允许写仅属于本业务内容布局的最小样式，但不得拥有 Shell/Page 高度、标准列表满高、滚动、统一间距、主题色或通用浮层样式。
- 只有 platform-admin 与 operations-admin 两个真实消费者共享同一机械 invariant、失败语义和演进原因时，才可晋升到 `admin-ui-foundation`；否则留在 app/feature。

## 12. Interaction Spec 与 L2 最小分母

每个相关 Step 至少记录：

| 决策 | 必填内容 |
| --- | --- |
| Surface | Shell/Page/Tab/Drawer/Modal/Inline 与打开、关闭、返回落点 |
| Information | Primary/Secondary/隐藏信息和业务分组 |
| Component | Pro 首选；若 AntD fallback，写真实缺口与 CLI 查询组件 |
| State | loading/empty/error/disabled/unresolved/partial/success |
| Interaction | pointer/keyboard/focus/dirty/pending/遮罩/重复提交 |
| Styling owner | app theme/layout/style 或有证据的 foundation |
| Evidence | 真动作、真实 request、owner readback、失败恢复、a11y/禁用词断言 |

实现 review 必须检查实际 component decision 与 Packet surface 一致；`antd lint`、typecheck、截图或控件存在都不能替代 L2。L2 至少覆盖当前 Step 的主路径、一个承重失败/恢复路径、键盘/焦点、loading/disabled、遮罩阻断和 owner readback。跨端主链仍按 Journey 风险使用 L3。

页面 L2 建立 route/mock/expectation 前，必须先登记该页面加载时稳定发生的 bootstrap requests，再追加当前 task 的专属 request/readback。未登记或未 mock 的 bootstrap `404`、依赖失败或 unexpected request 必须 fail-visible，不能作为“背景噪音”忽略；这项登记只属于当前页面和当前 Batch，不建立全 app 请求扫描器。

## 13. 版本升级

升级 `antd`、ProComponents 或 CLI 前，先记录 changelog/组件 API/token/semantic 差异，核对本标准中涉及的组件族，并重跑真实浏览器 L2。上游原则文件变化只触发 source ledger 复审；未改变当前产品任务或本地规则时，不批量改写 Journey。发现本标准与锁定版本真实 API 冲突时，优先修正文档和 memory，不为追求文档一致而写兼容 wrapper。
