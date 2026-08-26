# 商品库十项观测问题根因整改方案

`PLAN_KIND=IMPLEMENTATION_REMEDIATION`

## 1. 目的、边界与判定

本方案处理 2026-08-26 运营管理后台商品库实机观测到的十项问题。它不是视觉微调清单：每一项都从
owner 事实、契约投影、seed、工作台 state 和用户可见呈现的完整链路定位，禁止仅以 CSS、前端猜测或
seed 例外掩盖矛盾。

不改变已确认的十列表格、工具区和结果域筛选区、普通 AntD `Table` tree-data、父商品批量选择、SKU
独立行、分类三级上限、库存/BOM owner 边界或单一生产标签。动态验证不在本方案的实施授权内。

| 问题族 | 用户可见现象 | 根因 | 唯一修复层 |
| --- | --- | --- | --- |
| 智能视图 | “未启用商品”显示 0，而草稿商品存在 | owner 的计数和查询都把 `INACTIVE` 错收窄为 `DISABLED` | catalog owner 同时修正 count 与 filter；P1 生成源补语义测试 |
| 父子生命周期 | 草稿商品下显示“启用”规格 | 商品与 SKU 是两条独立生命周期事实；体验 seed 却把完成配置的父商品都留在草稿，制造不具代表性的组合 | 保留 owner 的真实两类状态；唯一 seed 源按体验状态转移父商品 |
| 树表密度 | 计数飘到行尾、首行字号突兀、展开按钮分散、SKU 无层级 | 同一个共享 presenter 把“首行”硬编码为 14px；使用了 AntD 默认 expand column，未落实已批准的层级视觉规约 | 专用 tree-table presenter，保留 table state，取消可见 expand 工具列 |
| 库存对象选择 | 左侧是大面积蓝色按钮堆叠 | 将“切换当前配置对象”的导航状态误渲染为主要危险/提交动作 | 保留本地 `selectedKey`，以紧凑、可访问的配置对象导航列重渲染 |
| 引用与作废 | “无引用”与“有依赖不可作废”同时出现 | `references` 仅是关联对象投影，`voidAvailability` 只返回技术事实；UI 将两个不等价集合写成相互矛盾的文案 | owner 输出用户可读 `blockingReasons`，detail contract 传递，治理 View/Editor 分组呈现 |

## 2. 逐项整改设计

### R-01 未启用商品的 owner 语义

“未启用商品”表示还不能作为启用商品使用的父商品，精确集合为 `DRAFT ∪ DISABLED`；`ARCHIVED` 仍只属于
“已归档商品”，`VOIDED` 永不出现在导航或列表。

- `CatalogOwnerService.navigation` 的 `INACTIVE` count 改为 `status IN ('DRAFT','DISABLED')`。
- `CatalogOwnerService` 的 `INACTIVE` page predicate 同样改为上述集合；计数与结果页不能分叉。
- P1 对该智能视图的 schema 文字、acceptance 和 focused 红夹具同步声明草稿与停用各一条正例，归档反例。
- 前端只显示 contract 返回的 count 和 owner 过滤后的页，不本地加草稿，也不把“未启用”翻译成“停用”。

### R-02 父商品与规格的有效状态

`catalog_item.status` 与 `catalog_sku.status` 继续分别表示商品和规格自身的生命周期，不能为了视觉一致性
把两条事实改写成同一状态或创造第二个“有效状态”。后台规范已经明确：规格“启用”不等于商品已发布、可售或
有库存；列表状态 Tag 必须如实显示所在行事实。

- 正常体验 seed 中，完成配置并用于浏览的父商品在最终 whole-save 后通过公开 owner transition 进入
  `ENABLED`，因此其启用/停用/归档规格形成可理解的真实组合；仅生命周期、外部临时或失败边界 fixture 保持
  草稿/停用/归档。
- 若业务用户正在编辑一个草稿商品，草稿父行与启用规格是合法且有意义的配置中间态；UI 不伪造状态，也不把
  SKU 启用翻译为“可售”。状态 Tag 的 Tooltip 仅解释“规格状态独立维护；商品尚未启用时不会作为启用商品使用”。
- 体验 seed 增加明确的父商品目标生命周期。完成配置且用于正常浏览的商品 transition 至 `ENABLED`；仅为
  生命周期、外部临时或失败边界服务的 fixture 保持草稿/停用/归档。执行器必须通过公开 owner transition
  command，不直写数据库，也不手改 generated fixture。

### R-03 导航树计数和长名称

所有树节点的 count Tag 紧随标签文字，而不是以 `margin-inline-start:auto` 推到容器右边。标签文本仍有
`min-width:0`，长名称以 `EllipsisTooltip` 补全；Tag 不收缩，动作菜单仍在最右且不改变 tree selection。
此规则作用于智能视图、商品形态、商品标签、生产标签与商品分类，不能只改一个“81”。

### R-04 至 R-07 十列表格的统一层级呈现

保持商品身份列的已确认信息层级（商品名称可点击、名称/编码/分类/标签四行），其余结构化事实列不再以
“第一行 14px、其余行 12px”制造伪主次。`businessLines` 的每一行使用相同 12px 行高、同一颜色档位；
“未设置”仍是中性提示。此范围不改变商品名作为导航入口的可点击性。

- `Table` 保持 `childrenColumnName`、受控 expanded keys 与 `onExpand`，但隐藏 AntD 的可见展开工具列。
  自定义可访问展开按钮放在商品名称同一行、名称左侧；没有 SKU 的父行没有按钮。
- SKU 商品列实现已批准的 24px 缩进、极浅层级底色和连续层级引导；规格子行仍为两行，选择列只保留空白对齐。
- 短商品标签必须完整可见；多标签才截断并 Tooltip。不能让 `flex` 容器或外层单行截断再次吃掉短 Tag。
- `catalogTableColumnWidths` 删除纯可见的 expand 工具列，`scroll.x` 由实际列宽计算；十项业务列、选择列和商品固定列不变。

### R-08 库存与 BOM 的配置对象导航

仅在多对象形态保留左侧导航。它表示“当前正在配置哪个商品/规格/选项值”，不是提交动作：

- 查看态与编辑态必须消费**同一个**配置对象导航呈现件；不得分别维护两份按钮、选中样式、对象命名或
  `selectedKey` 回退规则。此前只改编辑态而查看态仍保留 primary 按钮，正是这条要求要消除的漂移。
- 用语义 `nav`/原生 `button` 列表呈现。商品行显示商品名称及“商品 · 〈扣减方式〉”；规格行显示规格名称、
  规格编码及“规格 · 〈扣减方式〉”；点单选项值行显示选项值名称、选项组名称及“点单选项 · 〈扣减方式〉”。
  名称由当前商品 detail 已有的规格与选项配置事实解析，编码只作次要识别，不能因节点投影只有编码就把编码
  当作用户主名称；解析不到名称才回落为该节点的业务类型。
- 选中态采用显式浅色填充、左侧 3px 指示和正文色文字，不使用 AntD `primary`、危险或提交样式；未选中项
  保持无填充。规格与选项值行相对商品行缩进，所有行可用键盘聚焦和 Enter/Space 切换。
- `selectedKey` 仍是 `CatalogInventoryBomWorkbench` 本地 UI state；节点事实、允许方式与当前方式来自
  whole-save draft slice。查看态与编辑态各自持有本地选中项，但共同的 key 与节点消失回退规则必须相同；
  节点集合改变且已选 key 消失时只回退到首个 owner；切换不写入草稿也不请求候选。
- 右侧详情由当前 owner 的 `allowedModes` 继续控制入口，owner command 仍是最终准入；本改动不改变库存/BOM
  业务方式、候选 hook 或单位规则。

### R-09 与 R-10 引用关系和作废限制

`references` 与作废阻断不能再各自输出孤立片段。详情 contract 在现有 `voidAvailability` 下增加
`blockingReasons[]`，每行是业务 read model：`label`、`count` 与可选 `relatedItemCodes[]`；不传 UUID、
raw kind、ref 或内部 JSON。

- inbound 商品关系按“被〈商品编码〉使用”列出；outbound 关系按“使用〈商品编码〉”列出，空时明确“没有与其他商品的关联”。
- owner 将当前作废阻断的全部 owner 事实同步投影为可理解项：catalog 自有的“包含规格”“已设置条码与标识”
  “已设置生产标签”，以及 inventory owner 已有 task-read 返回的“已配置 N 个库存对象”“已配置 N 条用料”。
  catalog detail 必须调用 inventory 的既有 `catalogItemVoidDependencies` owner judgement，不能从库存定义 JSON 或前端
  猜测；不能创建“有依赖”而无可理解项的虚假告警。
- Governance View 与 Editor 分成“商品关联”和“当前不能作废的原因”。当没有关联但有自有阻断时只显示后者，
  不再写“仍存在关联或依赖”。存在多个原因时逐项显示，相关商品编码可打开现有商品详情入口。
- `canVoid` 的既有 authoritative 判断不改，`dependentFacts` 若仍被命令 readback 使用则不移除；新增摘要只服务
  详情用户表达，不能成为新的写入事实或前端自行推导。
- `canVoid` 与 `blockingReasons[]` 必须从同一 owner blocking-facts 集合派生；禁止一处用裸 boolean、另一处
  重新扫描 sections。任何让 `canVoid=false` 的事实都必须至少产生一条业务阻断项，反之无阻断项时不得仅凭
  技术残留将作废入口置灰。

## 3. 控制权与状态表

| 事实/状态 | 住址 | 控制者 | consumer |
| --- | --- | --- | --- |
| 未启用的集合、作废阻断摘要 | catalog owner read model / contract；inventory 阻断经 owner API 读取 | catalog owner 汇总，inventory owner 保有库存事实 | navigation、Governance View/Editor |
| 商品/SKU自身 status、关联、SKU/条码/生产标签 | catalog persisted facts | catalog owner command | owner 派生阻断与 whole-save/readback |
| 父行展开、规格 cursor、加载失败 | Table local state | `CatalogItemListTable` 上层 controller | tree-data 子行 |
| 树展开、当前结果域 | workspace local state | workspace reducer | navigation/query identity |
| 库存对象当前选中项 | workbench local `selectedKey` | `CatalogInventoryBomWorkbench` | 右侧同一 draft 的 detail presenter |
| 库存/BOM 节点方式与编辑值 | typed whole-save draft | `useCatalogItemDraft` | owner command/readback |

## 4. 可证伪验收

1. 同 scope 内草稿 2、停用 1、归档 1 时，`INACTIVE` navigation count=3，选择该视图只返回前 3；归档不进入。
2. 正常浏览用的按规格 seed 商品完成最终 whole-save 后父商品为启用，规格保持各自启用/停用/归档事实；草稿
   父商品与启用规格的专用生命周期 fixture 仍能 readback 两个原始 status，列表不伪造或合并状态。
3. 树任一 count 在其文本之后，长名称有完整 Tooltip，动作菜单位置不影响 count；没有 `margin-inline-start:auto`
   的 count Tag。
4. SKU 父行的展开控件仅在商品名称行左侧；无 SKU 父行无控件；SKU 子行具 24px 缩进、层级背景和引导；
   选择列仍无 checkbox。
5. `businessLines` 中普通结构化事实的各可见行统一字号；短标签 `招牌推荐` 的完整字符串在标记 DOM 中可见。
6. 多 owner 库存配置时，查看态和编辑态渲染相同的配置对象导航：商品、规格与点单选项值均以业务名称为主、编码
   为辅；选中项没有 primary 整块按钮堆叠。切换只改变当前详情，不改变其他节点 draft；当前节点消失回退首节点。
7. 无 inbound/outbound 关联但包含 SKU 的详情显示“没有与其他商品的关联”与“包含规格，暂不能作废”，不出现
   “无引用却存在关联或依赖”；有 inbound 关联时显示相关商品编码。
8. seed readback 至少一组正常按规格商品父级为启用、规格含启用/停用/归档三态；临时商品草稿保留。

## 5. 实施顺序

1. 修改 P1 生成源的 detail/SKU page contract、智能视图语义与 self-test，再跑生成链。
2. 修改 catalog owner 的 count/query、原始商品/SKU生命周期展示、作废摘要，并补 owner/HTTP acceptance 判据。
3. 修改唯一 catalog seed source 和 executor 的公开生命周期 transition，并做 seed 静态 readback 测试。
4. 修改 model decode、navigation tree、table presenter、治理 View/Editor、库存 workbench 和 focused tests。
5. 对照本方案与既有 formal/IA/implementation design 逐维回读：行为、形态、动作、关系、位置、文案、限制、
   state/control、失败恢复、数据源和失效边界。任何偏差先修复再进入静态门。

## 6. 非目标与禁止项

- 不把 SKU 自身状态改写为父状态，不增加新生命周期命令，不直写 seed 数据库。
- 不以 CSS 隐藏 AntD expand column后再留一枚第二按钮；只保留一个可访问展开入口。
- 不从前端拼作废阻断、分类路径、未启用计数或可选性。
- 不创建库存专用导航框架、第二候选 hook、第二套表格列模型或新的关系 owner。
- 不因十列宽度、树 count 或短标签而删除业务信息、缩成技术缩写或改变冻结工具区/筛选区。
