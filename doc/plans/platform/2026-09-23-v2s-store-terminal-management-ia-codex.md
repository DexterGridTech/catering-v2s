# 门店终端管理 · IA（低保真看图阶段）

```text
DATE=2026-09-23
DOC_KIND=IA_DESIGN
IA_SCOPE=TER-P01,TER-C01,TER-C02,TER-E01,TER-A01,TER-M01
BUSINESS_SOURCE=doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md
JOURNEY_REFS=需求正本 §2、§5、§7、§12 与 Dexter 本轮直接授权；没有另行批准的 Journey 工件，不以作者自审替代裁决
UI_INTERACTION_REF=doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-24
DECISION_SOURCE=需求正本 D-28..D-35、§4.9、V-29；与本 IA 对应的裁决均已写回正本
IMPLEMENTATION_AUTHORITY=true（Dexter 2026-09-24 授权，按 R2 修订后直接进入实施）
```

本文件记录线框背后的读写、级联、规模、刷新与可证伪观察。可见形态和文案的唯一归属在同名交互工件 §4；本文件不另画一套相冲突的线框。Dexter 本轮五点修订优先于需求正本的冲突旧文，待同步清单见交互工件 §8。页面路线提案为运营管理后台当前集团空间下的 `routeSegment=organization/store-terminals`（不带门店 ref）；准确 page key/route 由后续详设冻结，不能让 URL 代替已确认的全局门店选择。

## 1. 六个 IA-ID 的可见与不可见维度

### TER-P01 · 左终端列表＋右所选详情

- `businessTask`：从门店的终端中认出一台，核对这台点位终端的完整规则与明文激活码。
- `actorAndScenario`：有页面访问权的集团、大区、项目、门店运营角色，进入已选门店；其中拥有“编辑门店终端”的人还可创建和修改。
- `entryAndSurface`：左侧“门店经营 / 门店终端管理”菜单进入 `organization/store-terminals` 内容页；左栏点终端名称选中，右栏是页面详情 Card；“新建终端”在左栏头部，“更多”在详情头部，Dexter 已确认。
- `controlType`：左栏名称选择按钮＋设备类型/状态 Tag＋CursorPagination，不显示激活码；右栏只读详情按基本信息（含完整 8 位激活码）→打印机信息→功能与范围排列；每个功能下的每条已选场景分别展示自己的订单类型和打印机，不展示功能级共用打印机；右上“编辑”；无写权限不渲染新建/更多/编辑。授权详情读取遇到 VOIDED 仍返回完整只读详情，不显示编辑/状态写入口；作废项不再出现在普通列表候选中。
- `validationAndError`：列表失败为“列表读取失败”并给“重试”；详情失败为“详情读取失败”且不展示先前终端的值；无门店沿用现有选择门店提示，停用门店不可读写；不将激活码放到审计或其他共享读取。
- `accessibilityAndTestId`：列表当前项 `aria-current` 与文本同表意；激活码只在右详情作为可选择文本供授权读者读取，不新增复制按钮，列表 DOM/响应不含原值；状态不只靠颜色；稳定业务身份驱动行 testId，左栏新建、名称选择、分页、右栏更多/编辑各有真实动作节点 testId。
- `emptyLoadingErrorStates`：无终端时左栏说“还没有终端”及下一步，右栏只放创建后显示详情的占位；只读空态改为联系有权限者；loading 不显示假空态；换选中项时 detail loading 不显示旧对象及其激活码；失败保留所选 ref 供重试，不保留旧对象详情。
- `containerBehaviorUnderLoad`：静态形态与交互工件 `TER-P01.CONTAINER_LAYOUT` 相同。内容区可用宽度 `≤992px` 时由左右两栏改为列表在上、详情在下；这是本页响应式约束，参照的桌台与组织结构页面暂无窄屏堆叠行为，原因是本页打印机/场景详情横向密度更高。Cursor 到末页停；长名称省略但可取全称，长详情值换行；列表操作区、分页、右栏头部不得横向越过视口；左右顶部对齐，两栏内容高度不等时由页面内容区一个纵向滚动承担。
- `interactionConsistency`：逐控件对照 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10，特别是 §3-K-3（动作名）、§3-K-5（空态）、§3-K-7（Tag）、§3-K-8（跨批）、§3-K-9（动作 testId）；§3-K-10 明确不适用，因为右侧是页面 Card 详情而不是详情 Drawer。实施前以交互工件 §7 的位置/样式/行为/失败/焦点观察为逐控件分母；本轮未实施、未做 L2。
- `stateAndPermission`：[静态源码＋backend-acceptance] 按页面访问权限和所选门店 scope 分别核对列表、详情；用仅授权门店 A 的身份访问 B 的两类读均拒绝；用无独立写权限身份请求全部写操作均拒绝；门店停用时与其他门店级页面一样不可读写。四类角色逐一验，不以页面隐藏按钮代替服务端授权。
- `navigationAndRefresh`：[组件 focused] 切换终端只取新终端详情，旧请求晚到也不能覆盖；Shell“刷新当前页”重读左列表与当前详情，未提交 Drawer 不被重置；创建后新对象选中，修改后同一对象仍选中，状态作废后选下一条或展示空态。列表数据模型不承载激活码；候选读取不随无关终端列表刷新全量重发。
- `collectionShapeAndScale`：左终端集合为 `Cursor`，门店常见十几台是业务例子而非硬上界；取“几十到数百台”为布局压力假设，允许继续翻到末页，不能静默截断。右详情为单终端 `Detail 聚合`，功能、打印机、场景无任意人为上限；功能种类固定 6、同终端厨打实例和打印机数量不定。测试至少以跨两页列表和大量详情项证明无丢项；具体 cursor wire 在详设定。
- `dataSourceAndCascade`：[静态源码＋acceptance] 列表/详情来自新终端 owner，所选门店来自会话数据节点，不来自 URL；详情里的旧区域/标签显示须用 organization/catalog 权威 ref 读取，不用浏览器现有列表回填。新选中终端时旧详情清空；来源对象被作废后，终端详情读回当前状态/类型而不改写已存范围。
- `forbiddenUI`：[静态源码＋focused] 本页不得渲染“在线”“已激活”“打印测试”“派发中心”“复制终端”“导出激活码”；无写权限时搜不到任何新建/编辑/状态动作的可点击节点；不得在右侧详情放不可编辑表单冒充展示；不得把扫码区/扫码点画为桌台范围。

### TER-C01 · 新建第一步：设备类型

- `businessTask`：先选未来承载这台点位终端的设备形态，以免配置不被支持的功能。
- `actorAndScenario`：有独立写权限的运营管理员，门店可用、尚无这台点位终端。
- `entryAndSurface`：`TER-P01` 左栏“新建终端”打开同一个新建 Drawer 第一步；下一步进入 `TER-C02`，不新增路由。
- `controlType`：单选“台式/手持”及各自支持功能的常驻说明；取消、下一步；没有保存按钮和激活码输入。
- `validationAndError`：未选类型不能进入下一步；字典失败不退回手写选项；关闭走统一 dirty guard，第一步不发创建命令。
- `accessibilityAndTestId`：Radio 组选项可键盘选择，说明文本不只靠颜色；两个 Radio 真实选项节点和底部动作按钮均预留唯一 testId。
- `emptyLoadingErrorStates`：固定两值由 contract 生成；若字典不可用，显示明确“设备类型读取失败”并阻止继续，不能空列表当成无设备类型。
- `containerBehaviorUnderLoad`：静态形态与交互工件 `TER-C01.CONTAINER_LAYOUT` 相同。固定两选项不分页；说明换行，不使 Drawer 底部按钮越界；关闭/下一步动作固定右侧，同一 Drawer 下一步不跳宽。
- `interactionConsistency`：对照 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10，尤其 §3-K-1 必填/帮助、§3-K-2 标题/宽度/关闭、§3-K-8、§3-K-9；§3-K-10 因新建 Drawer 不适用。按交互工件 §7 检查 Radio 位置、行为与关闭三路径。
- `stateAndPermission`：[backend-acceptance] 仅有页面访问而无“编辑门店终端”的身份，即使直发创建命令也被拒；仅门店 A 授权不能为门店 B 创建；停用门店不提供本入口。
- `navigationAndRefresh`：[组件 focused] 下一步只在本地保留设备选择，不刷新任何业务列表或详情；取消退出，若已输入则统一 dirty guard；回上一步仍保留本次选择。
- `collectionShapeAndScale`：设备字典为 `Bounded`，精确两值 `台式/手持`，上界来自需求 §4.2；不能借当前页数量推断业务上界。
- `dataSourceAndCascade`：[静态＋focused] 设备类型来源是单一 contract 生成字典；选择手持后，`TER-C02` 只能新增四种支持功能；若从第二步改设备类型，先保留用户输入并标出冲突，不自动删功能。
- `forbiddenUI`：[静态源码] 第一步不能出现激活码输入、终端在线测试、按业态套模板、打印机配置或“新建成功”反馈；没有单独持久化动作。

### TER-C02 · 新建第二步：完整规则

- `businessTask`：先登记终端基本信息和打印机，再将功能、范围、所属场景及场景打印机配成完整点位规则。
- `actorAndScenario`：已选设备类型的运营管理员，为例如“前台收银机”配置点餐收银和多个厨打。
- `entryAndSurface`：`TER-C01` 的“下一步”在同一新建 Drawer 内转到三区段正文；依次为基本信息→打印机信息→功能与范围，场景内嵌于所属功能；底部“保存终端”一次提交。
- `controlType`：基本信息区为终端名称 Input/设备类型，以及“激活码（选填）”8 位数字字符串 Input，原位帮助文案“不填写则自动生成”；不预填随机码，用户可清空已输入的码以改回自动生成。其后是打印机定义清单中的名称、品牌、依品牌型号、连接方式、条件参数、纸规格（该型号只有一个可用项时只读，多项时单选）；型号与连接方式均在品牌选定后可用：二者均未选时型号按品牌列出全部型号、连接方式列出允许方式并集；先选任一项后另一项按登记组合收窄。切品牌清空型号、连接方式、纸规格和参数；切型号或连接方式时只清不再兼容的依赖值和旧方式参数，不自动补选。之后是功能实例列表＋添加单例/厨打；当前功能的桌台区或标签为一个可搜索多选框（“全部”是互斥特殊项），无桌台/外卖 Checkbox；在当前功能下逐条显示场景卡，每张场景卡独立勾选、独立选择订单类型、独立从本终端纸型相容打印机中无序多选。功能本身没有打印机控件；同功能两条场景可选不同打印机。没有独立场景区或主备操作。
- `validationAndError`：名称、设备类型、至少一功能为真必填；激活码不填由 owner 自动生成，填写时必须恰好 8 位数字且在集团空间内包含作废记录唯一，重复码原位报错、不自动替换用户输入；桌台/标签范围、打印机、场景订单类型/绑定可空；硬约束字段与集合错误原位标出，区段导航定位；软约束不拦截也不加解释性提示；提交冲突/未知结果留在 Drawer。
- `accessibilityAndTestId`：三区段、当前功能及其每条场景有文字状态与键盘焦点；每条场景自己的订单类型和打印机控件以功能实例稳定身份＋场景键定位，不能只靠功能名或当前选中项；打印机品牌/型号级联、纸规格只读值或单选及条件参数有可读标签；移除按钮带对象名；多选项可键盘添加/移除；动态控件 testId 不用显示顺序号、名称、数组下标。
- `emptyLoadingErrorStates`：无功能显示添加功能的下一步；无打印机允许保存；桌台区/标签多选框的具体候选为空按交互工件原位指引且可不选；“全部”即使当前无具体候选也有效；候选失败单独重试并保持已选；无可用纸型打印机提示返回前一“打印机信息”区段添加，场景仍可不绑打印机保存。
- `containerBehaviorUnderLoad`：静态形态与交互工件 `TER-C02.CONTAINER_LAYOUT` 相同。多个厨打/打印机在正文唯一滚动区延长；长名称可读全称；场景无序打印机多选和页脚不得越出视口；功能列表与其范围/场景顶部对齐，窄宽时顺序堆叠但归属不丢。
- `interactionConsistency`：对照 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10，重点 §3-K-1 逐字段宽度/原位错误、§3-K-2 唯一 dirty owner、§3-K-5 空态、§3-K-8/9 逐控件分母；§3-K-10 不适用于编辑任务 Drawer。交互工件 §7 的所有输入、级联、失败、焦点观察必须逐项核对。
- `stateAndPermission`：[backend-acceptance] owner 对直发手持+KDS、错误纸型、跨店区域/标签、外门店终端与未授权写入均拒绝；对范围为空、重叠厨打、无场景打印机和无订单类型均成功并逐值读回。另用同一厨打的“制作单→票据机”与“标签制作联→两台标签机”证明按功能实例＋场景分别保存、分别回读，编辑其中一条不改另一条。前端候选限制不作权限证明。
- `navigationAndRefresh`：[组件 focused＋acceptance] 手填码清空后恢复自动生成语义，不在前端生成/预览候选码；设备类型切换不得静默清功能；同一范围框内选“全部”清具体 refs、选具体项清 all 标志；品牌改变清旧型号，连接方式改变清旧方式参数；切场景只切该场景卡的编辑焦点，修改/取消一条只改变这一条的订单类型和打印机；移除功能清所属全部场景而保留终端打印机；移除被引用的打印机先逐场景列影响再确认解绑；保存后列表选新对象，右详情读回最终激活码；失败不刷新为成功态。
- `collectionShapeAndScale`：完整终端规则为 `Detail 聚合`，无任意上界，整体原子保存；功能类型 `Bounded=6`，厨打实例、打印机、已选区域/标签数量不定；每个功能场景集合上界来自需求 §4.5 的 17 项全表，其中当前功能最多 6 项。区域/标签候选为 `Cursor`，不抽干；预期十几至数百条只是布局压力假设，非业务上界。
- `dataSourceAndCascade`：[静态源码＋focused＋acceptance] 固定枚举、品牌/型号、型号→纸规格/连接方式、场景矩阵来自单一 contract；区域由 organization、生产标签由 catalog task read。型号/连接方式级联：品牌未选时后两者禁用；品牌选定且型号/连接方式均未选时，型号显示该品牌全部登记型号、连接方式显示这些型号的允许方式并集；先选型号后方式按型号收窄，先选方式后型号按品牌与方式交集收窄；切换只清不再兼容的值和参数、不自动补选。型号×连接方式 12×5 的独立手写期望由 owner focused 验证。纸规格只有一个型号可用项时显示只读，多项时只能单选其一；改型号时旧规格若不在新型号候选中须清空重选。草稿及保存事实按“终端→功能实例→场景标识→该场景订单类型与打印机 refs”归属；功能只拥有范围和场景集合，不拥有共用打印机 refs。每条场景从本终端纸型相容打印机取候选，不含优先级；USB/蓝牙各用一个字符串配置标识，本期不冒称已物理绑定；最终全量关系由 owner 逐场景校验。
- `forbiddenUI`：[静态源码＋focused] 不能把扫码区/扫码点放入桌台范围；点餐收银不能出现外卖范围；KDS/接单确认不能出现空的场景表；排队叫号不能出现范围；功能层不得出现共用打印机多选或将一场景选择复制给全部场景；不得按业态给模板、自动阻止软约束、显示“会实际出单”、在子控件自建 dirty 提示或在前端自动生成激活码。自填码仅在新建第二步合法，编辑/状态面仍无此字段。

### TER-E01 · 已有终端编辑

- `businessTask`：修改既有终端的完整规则，同时维持终端、厨打、打印机和激活码的身份。
- `actorAndScenario`：有写权限的运营管理员，已在右侧核对目标终端。
- `entryAndSurface`：`TER-P01` 右侧详情头部“编辑”打开单独编辑 Drawer，标题“对象名 · 编辑终端”。
- `controlType`：同 `TER-C02` 三区段及先打印机后功能的顺序，从 owner latest detail 初始化；所属功能下每条场景仍有自己的订单类型和打印机多选，不因当前选中功能而合并成一组；设备类型可改，旧失效引用带文字状态；底部“取消/保存终端”。激活码不做 Form 控件，仅由页面详情展示。
- `validationAndError`：改设备类型时保留不兼容功能并在所属功能原位标错，允许同次保存中移除它们；旧失效引用可原样保留但不可当新候选；品牌改变后旧型号不得残留；连接方式切换不保留旧条件参数；改纸型若场景仍不相容则原位失败，不自动清；版本冲突与结果未知保留输入并提供核对。
- `accessibilityAndTestId`：当前功能/场景、旧引用状态均有文本；抽屉关闭三路径同一 lifecycle，错误后焦点到首错；动态身份稳定，姓名与顺序变动不使输入失焦。
- `emptyLoadingErrorStates`：详情读取失败不可打开带空表单的编辑；旧引用 task-read 失败时不伪造“已作废”，显示读取失败并保留原始标识待重试；候选空/失败与 `TER-C02` 一致。
- `containerBehaviorUnderLoad`：静态形态与交互工件 `TER-E01.CONTAINER_LAYOUT` 相同。无人工上限的厨打和打印机只延长 Drawer 正文唯一纵向滚动；区段导航与页脚固定，长旧引用名称换行/可读全称；当前功能/场景归属明确，按钮不出视口。
- `interactionConsistency`：对照 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10；逐项同 `TER-C02` 并追加 §3-K-2 的对象名前置标题、§3-K-4 的版本冲突与结果未知恢复；§3-K-10 不适用编辑 Drawer。实施前逐控件对照交互工件 §7。
- `stateAndPermission`：[backend-acceptance] 停用终端可改；作废终端不可改；门店停用不可改；无写权限、跨店、跨集团空间写入均拒绝；两个用同一版本并发保存只有一个成功。前端按钮不能替代最终校验。
- `navigationAndRefresh`：[focused] 编辑成功后同一 ref 留在列表选中态并只重读其详情及受影响列表；不把创建时的默认状态覆盖旧状态；失败保留整个 Draft；Shell 刷新当前内容 Tab 不覆盖未提交 Drawer。
- `collectionShapeAndScale`：既有终端也是 `Detail 聚合`，无人工上限；候选 `Cursor`，固定字典 `Bounded` 的上界与 `TER-C02` 相同；必须构造多个厨打、同场景多台同等地位打印机回读，不能只测一个实例。
- `dataSourceAndCascade`：[静态＋acceptance] 最新 detail 提供现存 refs/version；organization 按 ref 返回旧桌台区当前状态/类型，catalog 按 ref 返回旧标签状态；更改当前厨打只改其范围和所指向场景；更改该厨打的某个场景打印机不改同厨打其他场景或其他厨打；激活码在任何编辑请求中不存在。
- `forbiddenUI`：[静态＋focused] 不得把已作废旧引用默默移出，不得把它塞回新增候选；设备类型切换不自动删除功能，纸型切换不静默解绑；不得再生成/编辑/遮罩激活码；无逐段保存或第二个 dirty guard。

### TER-A01 · 状态动作菜单

- `businessTask`：在已选终端上找到此刻合法的状态变化，不操作错对象。
- `actorAndScenario`：有写权限的运营管理员，在右栏核对了当前终端和状态。
- `entryAndSurface`：`TER-P01` 右侧详情头部“更多” Popover，Dexter 已确认。
- `controlType`：启用态列“停用终端/作废终端”；停用态列“启用终端/作废终端”；作废终端不在列表、无菜单。没有写权限时不渲染触发按钮。
- `validationAndError`：菜单只是导航到确认面，不能代替 owner 状态/version/权限校验；失败由 `TER-M01` 原位显示。
- `accessibilityAndTestId`：触发按钮与可点击 MenuItem 分别有真实动作节点 testId；危险项不只靠红色，文本含“作废”；菜单关闭后焦点回触发按钮。
- `emptyLoadingErrorStates`：详情 loading/error 时无菜单；不存在“无可执行动作”的空菜单按钮；提交中菜单禁重复触发。
- `containerBehaviorUnderLoad`：静态形态与交互工件 `TER-A01.CONTAINER_LAYOUT` 相同。按状态最多两项，`Bounded`，不滚动；锚定详情头且不越视口，头部在窄屏可换行但不遮挡编辑。
- `interactionConsistency`：逐屏引用 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10；适用 §3-K-3/4/8/9；其余不适用理由见交互工件 §7。§3-K-10 仅管详情 Drawer，本页详情 Card 是明确排除 surface。
- `stateAndPermission`：[静态＋acceptance] 无写权限入口不存在且直发状态命令被拒；启用/停用合法转换正确，作废不能再启用；门店停用时入口不可用。
- `navigationAndRefresh`：[focused] 打开菜单不发写请求、不刷新列表；选择动作先关闭菜单再打开 `TER-M01`，取消后保留所选终端。
- `collectionShapeAndScale`：`Bounded`，最多两条状态动作，上界来自三态生命周期与作废终态；不把它做成可搜索列表。
- `dataSourceAndCascade`：[focused] 菜单内容来自当前所选终端 owner readback 的状态及独立写权限；切换列表选中时旧菜单必须关闭，不能在旧对象上执行新对象动作。
- `forbiddenUI`：[静态＋focused] 不出现“禁用/删除/重新激活”同义动作；不出现“作废后重新启用”；不得在列表行和详情头同时给两套状态入口。

### TER-M01 · 状态确认

- `businessTask`：知悉对象、动作、保留关系与不可恢复部分后，确认一次状态变更。
- `actorAndScenario`：有写权限的运营管理员，从所选终端状态菜单进入。
- `entryAndSurface`：`TER-A01` 对应项打开独立 Modal；与编辑 Drawer 不叠开。
- `controlType`：停用/启用普通确认，作废危险确认；仅“取消/确认停用（或确认启用、确认作废）”两个页脚按钮，没有可编辑业务字段。
- `validationAndError`：失败在 Modal 原位显示 owner 原因并保留确认面；版本冲突不偷换 expectedVersion；结果未知先读回再决定是否重试。文案不承诺设备即时停止工作。
- `accessibilityAndTestId`：标题含对象名与动作，正文明确恢复性；危险按钮文本和样式同为“作废”；确认/取消按钮为实际 testId 触点，关闭后焦点回“更多”。
- `emptyLoadingErrorStates`：确认前须有当前详情；提交中按钮锁定，失败原位可重试/取消；读回发现对象已变更时显示需重新核对，不能旧确认继续写。
- `containerBehaviorUnderLoad`：静态形态与交互工件 `TER-M01.CONTAINER_LAYOUT` 相同。单对象/两按钮，无列表与分页；长名称换行，正文不挤出视口，页脚右对齐；只在文案长度超出视口时按 Modal 自身滚动，不生成父子双滚。
- `interactionConsistency`：逐屏引用 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10，重点 §3-K-2/3/4/6/8/9；§3-K-10 因纯确认 Modal 不适用，其他不适用项见交互工件 §7。
- `stateAndPermission`：[backend-acceptance] owner 对目标状态、当前状态、当前门店与写权限再判；停用/启用/作废各带所见版本；无权限身份绕过 UI 直接提交仍拒绝。
- `navigationAndRefresh`：[focused] 取消不发请求、不改变选中详情；停用/启用成功刷新列表与当前详情，作废成功从列表移除并选下一条或显示空态；失败不刷新为成功态。
- `collectionShapeAndScale`：单对象确认，无集合；`Detail` 的当前状态与版本来自已选终端详情，不能由菜单文案推断。
- `dataSourceAndCascade`：[静态＋acceptance] 对象名和状态从最新 owner detail 进入确认，目标状态由用户所选动作产生；实际状态以 owner 回执和随后 readback 为准，不由 Modal 本地猜测。
- `forbiddenUI`：[静态＋focused] 确认面不得包含新表单字段、激活码原值、终端引用数、设备运行时承诺或“已通知 TDP”；作废确认不提供恢复入口。

## 2. 共用 IA 规则与错误映射

1. 会话的所选门店是唯一范围来源；route 不带 storeRef，读写均在服务端复核当前可见/可操作门店。新终端 owner 只保存规则，不激活设备、不派发打印、不通知 TDP。门店被停用后本页不读写，这是 D-26 的显式例外；门店经营规则开关不决定本页进入，也不决定已有区域/标签是否可读作候选。
2. 所有新引用按 ref，新增必须属于所选门店且启用；既有失效引用保留并标状态/类型。桌台范围只接受桌台区，不接受扫码区/扫码点；“全部桌台区/全部生产标签”与指定 refs 互斥且不展开。功能范围允许空，软约束不阻断、不提示。作废终端的授权详情读取照常可读且只读，列表过滤与写操作规则不变。
3. 页面只读不渲染写入口；表单 dirty/关闭确认只由 `useDrawerFormLifecycle` 持有，Shell 只消费锁而不重复提示。终端详情不是不可编辑表单。激活码只在所选终端详情出现，列表 DTO/DOM 均不含；不进编辑输入、审计、诊断或跨页面共享读取。
4. 可搜索证伪的全屏禁项：对 six screens 的 DOM/源码扫描，用户可见文本不得出现 `ref`、`scope`、`owner`、`schema`、`TABLE_AREA`、`laptop`、`mobile`、`ENABLED`、`DISABLED`、`VOIDED`；不得出现“打印测试”“终端在线”“激活设备”“复制终端”“派发中心”。技术说明中的词不算用户可见 DOM。

以下逐项冻结现有/本域 problem code 与 HTTP 语义；用户文案沿用业务表达，不暴露 code。标准未认证、未授权、对象不存在及基础设施失败走既有 HTTP/problem 处理，不另造本域码。

| problem code / HTTP | 业务规则映射 | screen / owner | 用户可见处理与恢复 |
|---|---|---|---|
| 既有 HTTP 403 | 页面/写权限、门店 scope 或停用门店拒绝 | P01/C02/E01/M01；edge＋owner | 页面无写入口；直发拒绝保留任务和服务端原因，不假装成功；停用门店沿用其他门店级页反馈 |
| 既有 HTTP 404 | terminal ref 不存在或不属于可见 scope | P01/E01/M01；新终端 owner | 不泄漏跨店对象存在性；仅不存在时清当前详情并重读列表 |
| 已知 ref 的 VOIDED 终端详情 | 200，只读 | P01；新终端 owner | 详情仍展示该终端保存的完整规则与激活码；无编辑/状态入口，普通列表仍过滤作废项 |
| `PLATFORM_COMMON_VERSION_CONFLICT` / 409 | 编辑/状态命令版本过期 | E01/M01；OWNER_COMMAND 基础 problem | 保留输入，说明资料已变化，先核对最新规则再重试；不自动覆盖 |
| `STORE_TERMINAL_STATUS_TRANSITION_INVALID` / 409 | 当前状态不允许该状态操作（含已作废终端） | M01；新终端 owner | 状态操作不落库；重新读取终端详情后按当前状态判断可用操作 |
| `STORE_TERMINAL_VOIDED_IMMUTABLE` / 409 | 编辑已作废终端 | E01；新终端 owner | 保存不落库；重新读取详情确认其已作废。作废终端只读，不提供恢复编辑入口 |
| `STORE_TERMINAL_RULE_INVALID` / 422 | 设备×功能、范围、型号×纸型、连接参数等硬约束失败 | C02/E01；新终端 owner | 指向具体区段/功能/场景/字段并聚焦，不能只在页面顶端报错 |
| `STORE_TERMINAL_REFERENCE_INVALID` / 422 | 新区域/标签/打印机引用不属于本目标或不可用 | C02/E01；organization/catalog/新终端 owner | 保留输入，具体引用旁说明已不可用或不属于当前门店；旧失效引用允许保留 |
| `STORE_TERMINAL_NAME_CONFLICT` / 409 | 同一门店未作废终端同名，或同终端打印机名冲突 | C02/E01；新终端 owner | 对应终端/打印机名称项原位错误，用户改名后可重试 |
| `STORE_TERMINAL_ACTIVATION_CODE_CONFLICT` / 409 | 手填码在集团全状态范围内已存在 | C02；新终端 owner | 输入项原位错误，保留草稿；绝不自动替换成随机码 |
| `STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED` / 409 | 自动生成候选撞码达到上限 | C02；新终端 owner | 不露候选码或 DB 冲突细节，明确此次新建未完成，可按同一意图重试 |
| `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT` / 409 | 同一幂等意图对应不同请求体 | C02/E01/M01；既有通用机制 | 不生成新幂等键静默重试；保留草稿并提示核对提交结果 |
| `PLATFORM_COMMON_RESULT_UNKNOWN` / 500 | 服务端明确返回 owner 结果无法确认 | C02/E01/M01；HTTP/owner | 保留任务与原幂等意图，按原对象或创建回执读取结果，不盲发新意图 |
| 浏览器传输中断（无 HTTP response/code） | 请求可能已到服务端，客户端未收到响应 | C02/E01/M01；浏览器 transport | 保留草稿与原幂等意图；恢复连接后读详情/回执或按原意图重试，不显示成 `PLATFORM_COMMON_RESULT_UNKNOWN` |
| `PLATFORM_COMMON_VALIDATION_FAILED` / 400/422 | 请求形态、游标等基础输入不合法 | P01/C02；既有 problem 处理 | 按字段/参数路径定位；不得改写为业务关系错误 |
| 既有 HTTP 500 | organization/catalog 候选来源无法读取或基础设施不可判定 | C02/E01；来源 owner/HTTP | 原位显示读取失败/重试，已选保持；不假装“没有候选”，不映射成引用无效 |

新 operation 的契约错误闭集由 edge 生成链推导，不直接登记生成的 `paths` 文件。每个 operation 的 `x-error-codes` 等于指定基础集合与该 operation 的增补集合并集（去重、按生成器规范排序）；基础集合及逐 operation 增补见详设 §4 CP-03。前端读取同一生成错误码闭集并由 `operationsProblemFeedback.ts` 提供全量文案，不另手写一套。

## 3. IA ↔ 交互工件 ↔ 后续详设对账

| 检查 | 本轮结果 |
|---|---|
| IA-ID 数 | 本文件六个 `TER-*` 小节，对应交互工件六个 Screen；初版逐项比对为 6/6。 |
| IA ↔ 交互工件 | 六屏的 surface、入口、主按钮、确认动词、激活码只在详情、先定义打印机后选功能、每个功能内每条场景各自选择订单类型和打印机、无功能级共用选择、无主备与范围单一多选逐项一致；新建/状态入口位置和 USB/蓝牙字符串标识语义已由 Dexter 确认。 |
| IA-ID ↔ 业务来源 | P01 源于 D-13 与本轮主从裁决；C01/C02/E01 源于 D-1、R-1..R-5、R-7；A01/M01 源于 R-6、R-9.6。Dexter 已指定当前需求正本为设计输入；未另立 Journey 工件。 |
| IA ↔ 详设 | `CONSISTENT_STATIC_RECHECK_2026-09-24_AFTER_REMEDIATION`：对 `Cursor/Detail/Bounded`、授权、刷新、旧引用、冻结错误码、六屏控件以及新建激活码两路径逐项核对；这是文档静态一致性，不是实现或动态通过。 |
| 证据档位 | 当前 IA 为静态设计输入；focused、backend-acceptance、Browser L2 在实施验证完成前均为 `NOT_RUN`。文内观察句是可证伪判据，不是运行结果。 |
| 需求来源 | 需求正本 D-28..D-35、§4.9、V-29 已同步；本 IA 不保留旧口径副本，后续以该正本为业务语义唯一来源。 |

```text
IA_DIMENSIONS=TER-P01,TER-C01,TER-C02,TER-E01,TER-A01,TER-M01；可见/不可见维度逐项填写
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是；每条标明最低证据档位
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=11 个 exact common/domain code 已冻结；标准 403/404/500 沿用既有处理，浏览器传输中断无 HTTP problem code
CROSS_CHECK_WITH_DESIGN=CONSISTENT_STATIC_RECHECK_2026-09-24_AFTER_REMEDIATION
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-24
IA_STATUS=WIREFRAME_ACCEPTED；实施授权见当前 Dexter 指派与需求正本头部
```
