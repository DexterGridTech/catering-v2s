---
title: 商品条码与标识、制作信息优化交互工件
status: DEXTER_ACCEPTED
createdAt: 2026-08-23
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# 交互工件：J-CIPG-001 维护商品识别与制作差异

> `PARTIALLY_SUPERSEDED_BY`：`doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md`。
> 生产标签改为商品级可清除单选；SKU 制作覆盖与点单选项制作变化不显示标签控件；旧多选文案与交互不得继续实施。

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-journey.md#catalog-identification-production-guidance-journey
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md#catalog-identification-production-guidance-formal-requirements
BUSINESS_PROBLEM=商品维护者无法确认当前识别码或制作信息究竟属于商品、具体规格还是具体选项值，容易保存到错误对象并产生无法解释的制作结果
BUSINESS_USER_OR_OWNER=总部或门店商品资料维护者
CURRENT_TASK=在一个商品编辑会话内维护商品或具体规格的识别码，并维护商品默认、规格差异和具体点单选项的制作变化
SUCCESS_OUTCOME=每项事实都显示具体业务对象和来源，所有草稿仍由商品 Drawer 一次保存，非法归属和非法类型由 owner 可定位拒绝
UI_BEARING=true
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_AUTHORIZATION=DEXTER_CIPG_DESIGN_GO_CP00_CP13_20260823
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-23
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin
```

<a id="ui-detailed-design-admission"></a>

### Screen CIPG-01：商品 Drawer 宿主

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=/operations/:workspace/catalog/store-items；商品工作台点击商品名称或“新建商品”进入；有商品页读取准入且当前 dataNode/brand 完整
ACTOR=总部或门店商品资料维护者
BUSINESS_SCENARIO=用户正在查看或编辑一个商品，需要在不离开商品上下文的情况下维护识别与制作事实
BUSINESS_GOAL=确认正在维护的商品及商品类型，在分层页签中完成草稿并一次保存
USER_VISIBLE_COPY=商品名称/编码与商品类型摘要；“基础”“条码与标识”或“规格与商品编码”“点单选项”“商品属性”“制作信息”“库存与 BOM”“引用关系”；“取消”“保存”；“有未保存的修改，确定放弃吗？”
TECHNICAL_BOUNDARY=当前 dataNodeRef、brandRef、itemRef、shape、catalogVersion、写 capability、whole-save payload 与 owner readback 不向用户展示；按 SKU shape 不显示独立“条码与标识”Tab，而在用户可见的“规格与商品编码”中维护
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,useDrawerFormLifecycle,useOverlayLock,useDirtyFormLock,createRefreshSignal,useRefreshVersion,testId
CONTAINER_LAYOUT=宽度完全采用 adminWideDrawerSurfaceProps，即 min(1024px,calc(100vw - 48px))；header、tabs 与 footer 不超视口，body 是唯一纵向滚动容器；页签栏可横向滚动但页面不得出现横向滚动；表单标签列沿用 164px，操作按钮右对齐
```

### Screen CIPG-02：商品级条码与标识

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CIPG-01 内“条码与标识”；普通、称重、物料、套餐、服务/费用商品可进入；按 SKU 商品改由 CIPG-03，权益壳不提供入口
ACTOR=商品资料维护者
BUSINESS_SCENARIO=用户要让扫码、称重键码或助记输入准确找到当前商品
BUSINESS_GOAL=只维护当前商品允许的识别类型和值，理解商品编码不需要重复录入
USER_VISIBLE_COPY=标题“条码与标识”；说明“识别码用于扫码、称重键码或快速检索。商品编码无需在此重复维护。”；“添加识别码”；列“类型”“识别值”“操作”；类型“条码”“称重键码（PLU）”“助记码”；“移除”；空态“尚未维护识别码”；错误“当前商品类型不支持这种识别方式”“该识别码已被同一品牌下的其他商品或规格使用”“请填写识别值”“识别值不能包含不可见字符”“识别值最多 160 个字符”；助记码说明“助记码不区分大小写”；服务/费用提示“服务与费用商品只支持助记码”“条码和称重键码不适用于此类商品”
TECHNICAL_BOUNDARY=identifierRef、ownerType/ownerRef、normalizedValue、dataNodeRef+brandRef 唯一域、shape×type 准入、catalog version 与具体 problem code 不显示；服务/费用 BARCODE/PLU 即使篡改请求也由 contract/owner 拒绝
FOUNDATION_PRIMITIVE=DescriptorFieldRenderer,FieldDescriptor,testId
CONTAINER_LAYOUT=随 CIPG-01 body 滚动，不创建嵌套纵向滚动；说明与“添加识别码”上下排列；动态行采用 160px 类型列+minmax(280px,1fr) 值列+64px 操作列，窄于 760px 时一行字段改为纵向堆叠；行和按钮不得造成 Drawer 横向滚动
```

### Screen CIPG-03：规格与商品编码中的识别/制作摘要

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CIPG-01 内“规格与商品编码”；仅按 SKU 管理商品进入
ACTOR=商品资料维护者
BUSINESS_SCENARIO=用户面对多个规格，需要先确认具体规格，再维护它的识别码或制作差异
BUSINESS_GOAL=逐行看清规格、规格编码、识别码摘要和制作设置，从目标行进入维护
USER_VISIBLE_COPY=标题“规格与商品编码”；列“规格”“规格编码”“识别码”“制作信息”“操作”；识别摘要“未维护”或“条码 2 个 · 助记码 1 个”；制作摘要“使用商品默认”或“已单独设置”；按钮“维护识别码”“维护制作信息”；提示“按规格管理的商品应为每个规格维护识别码，商品本身不设置识别码”
TECHNICAL_BOUNDARY=productSkuRef、itemRef、sku version、identifier rows、override mode 与 effective source 不直接显示；按钮只能从当前行产生目标 identity，客户端不可提交任意 skuRef
FOUNDATION_PRIMITIVE=useAsyncGenerationGuard,testId
CONTAINER_LAYOUT=随 CIPG-01 body 滚动，不增加内层纵向滚动；表格最小列宽合计 760px，Drawer 低于该宽度时每个 SKU 退化为纵向卡片，禁止外层横向滚动；规格/SKU 编码左对齐，摘要和操作与各自行基线对齐
```

### Screen CIPG-04：维护具体规格的识别码

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CIPG-03 具体规格行点击“维护识别码”；仅当该规格仍属于当前商品草稿
ACTOR=商品资料维护者
BUSINESS_SCENARIO=用户已选定一个规格，需要为它维护一个或多个条码/助记码
BUSINESS_GOAL=在始终可见的规格名称下编辑识别码，并把修改带回商品草稿
USER_VISIBLE_COPY=标题“维护识别码 · {规格名称}”；只读“规格编码”；说明“这些识别码只识别当前规格”；“添加识别码”；列“类型”“识别值”“操作”；类型“条码”“助记码”；“移除”“取消”“确定”；提示“返回商品页面后仍需点击保存才会生效”；错误文案同 CIPG-02
TECHNICAL_BOUNDARY=确定只更新父 Drawer 草稿，不发独立保存命令；parent itemRef/productSkuRef、normalizedValue、唯一域、version 和 problem code 不显示；PLU 与父商品识别码由 contract/owner 拒绝
FOUNDATION_PRIMITIVE=useOverlayLock,testId
CONTAINER_LAYOUT=Modal 宽度 min(720px,calc(100vw - 48px))、最大高度 calc(100vh - 96px)；Modal body 是唯一滚动容器，header/footer 固定；动态行布局与 CIPG-02 一致，窄屏纵向堆叠；footer 操作右对齐
```

### Screen CIPG-05：商品默认与各规格制作摘要

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CIPG-01 内“制作信息”；仅普通、称重和按 SKU 销售商品进入
ACTOR=商品资料维护者
BUSINESS_SCENARIO=用户要维护所有销售规格通常采用的制作信息，并确认哪些 SKU 或点单选项存在差异
BUSINESS_GOAL=维护商品默认制作信息；按 SKU 商品逐行查看继承/单独设置；普通/称重商品查看选项影响摘要并去具体选项维护
USER_VISIBLE_COPY=标题“制作信息”；分组“商品默认制作信息”；字段“制作处理标签”“制作单显示名称”“预计制作时长（秒）”“制作说明”；帮助“制作单显示名称最多 120 个字符”“制作说明最多 1000 个字符”“预计制作时长请填写零或正整数”；placeholder“选择已有制作处理标签”“例如：大杯热拿铁”“留空表示未维护”；停用标签标记“已停用（保留既有设置）”；规格分组“各规格制作信息”，列“规格”“当前设置”“制作单显示名称”“操作”，设置“使用商品默认”“已单独设置”，按钮“维护制作信息”；选项分组“点单选择带来的制作变化”，摘要“{N} 个选项值已设置制作变化”，按钮“去点单选项维护”；空态“尚未设置制作信息”
TECHNICAL_BOUNDARY=productionTagRefs、item profile、SKU override mode/profile、effective profile/source、option definition/value refs、displayOrder、version 与 problem code 不显示；商品页不快速创建标签、不配置打印/KDS/路由；不准入 shape 的篡改请求由 owner 拒绝
FOUNDATION_PRIMITIVE=useCursorCandidates,useAsyncGenerationGuard,DescriptorFieldRenderer,FieldDescriptor,testId
CONTAINER_LAYOUT=随 CIPG-01 body 单一滚动；默认表单使用 164px 标签列；SKU 摘要表在窄屏退化为卡片；选项摘要只占一行并可换行；候选下拉由 overlay 承载，不形成第二纵向页面滚动；页面和 footer 不横向溢出
```

### Screen CIPG-06：维护具体规格的制作信息

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CIPG-03 或 CIPG-05 具体规格行点击“维护制作信息”
ACTOR=商品资料维护者
BUSINESS_SCENARIO=某个规格需要沿用商品默认或明确使用一整套不同制作信息
BUSINESS_GOAL=在“使用商品默认”和“单独设置”之间明确选择；清除单独设置后立即恢复默认预览
USER_VISIBLE_COPY=标题“维护制作信息 · {规格名称}”；选项“使用商品默认”“单独设置”；说明“使用商品默认时，会随商品的默认制作信息一起变化”“单独设置时，将使用本规格自己的一整套制作信息”；默认预览“当前商品默认”；字段同 CIPG-05；按钮“清除单独设置并恢复商品默认”“取消”“确定”；提示“返回商品页面后仍需点击保存才会生效”
TECHNICAL_BOUNDARY=INHERIT_ITEM/OVERRIDE、完整 override profile、effective source、productSkuRef 与版本不显示；确定只写父 Drawer 草稿；OVERRIDE 不做逐字段继承，owner 保存时复核完整结构
FOUNDATION_PRIMITIVE=useOverlayLock,useCursorCandidates,useAsyncGenerationGuard,testId
CONTAINER_LAYOUT=Modal 宽度 min(720px,calc(100vw - 48px))、最大高度 calc(100vh - 96px)；body 唯一滚动，header/footer 固定；模式选择横排，窄屏纵向；字段标签列 164px，按钮右对齐，不产生横向滚动
```

### Screen CIPG-07：具体点单选项值的制作变化

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CIPG-01 内“点单选项”；普通/称重商品存在选项组和值时，在具体选项值卡片内展开“制作变化（可选）”；CIPG-05“去点单选项维护”切换到此 Tab 并定位首个已设置值
ACTOR=商品资料维护者
BUSINESS_SCENARIO=加珍珠、换燕麦奶等具体选择会增加处理标签、制作时间或一句制作说明
BUSINESS_GOAL=在具体选项值旁维护只增不减的制作变化，始终知道变化来自哪个选择
USER_VISIBLE_COPY=选项组与选项值现有业务名称；分组“制作变化（可选）”；字段“增加制作处理标签”“增加制作时长（秒）”“追加制作说明”；说明“这些变化会添加到商品或规格的制作信息中”“多项制作说明会按点单选项在页面中的顺序依次呈现”“追加制作说明最多 1000 个字符”；placeholder“只可选择要增加的标签”“填写零或正整数”“例如：最后加冰”；空态“不设置制作变化”；不得出现“移除标签”“减少时长”
TECHNICAL_BOUNDARY=definitionRef、definitionValueRef、组/值 displayOrder、addProductionTagRefs、preparationSecondsDelta、instruction 与合并顺序不显示；owner 拒绝负数、remove、完整 profile 与越商品 valueRef；说明最终按组 displayOrder、值 displayOrder、definitionValueRef 追加
FOUNDATION_PRIMITIVE=useCursorCandidates,useAsyncGenerationGuard,testId
CONTAINER_LAYOUT=沿 CIPG-01 body 滚动，选项组/值现有容器不新增嵌套滚动；每个值的制作变化使用可折叠区，字段按 164px 标签列对齐；窄屏纵向堆叠；定位后仅滚动 Drawer body，不滚动页面；候选下拉不得造成横向溢出
```

### 1.2 Surface ownership 自检

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | 每项是否属于当前 surface | USER_VISIBLE_COPY 是否全有位置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| CIPG-01 | Drawer | 商品摘要、tabs、取消、保存、dirty 说明 | 是；tab 内容由各自 screen 拥有 | 是 | PASS |
| CIPG-02 | 内容 Tab | 说明、添加、类型/值动态行、空态/错误 | 是 | 是 | PASS |
| CIPG-03 | 内容 Tab | SKU 表/卡片、两个摘要、两个维护入口 | 是 | 是 | PASS |
| CIPG-04 | Modal | 当前 SKU、动态行、取消/确定 | 是；不画父 Drawer | 是 | PASS |
| CIPG-05 | 内容 Tab | 默认表单、SKU摘要、选项摘要与跳转 | 是 | 是 | PASS |
| CIPG-06 | Modal | 当前 SKU、继承/单独设置、默认预览、完整表单 | 是；不画父 Drawer | 是 | PASS |
| CIPG-07 | 内容 Tab | 具体选项值、制作变化字段与说明 | 是 | 是 | PASS |

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 商品页准入、dataNode/brand 完整 | CIPG-01 | 打开目标商品 | 商品摘要、shape、可用 tabs、保存/取消 | catalog detail、version、写能力 | 按 shape 进入对应 Tab | 读取失败可重试；无写能力保持只读 |
| 2A | 非 SKU identifier shape | CIPG-02 | 维护商品识别码 | 类型/值动态行 | item identifiers、allowedTypes | 留在 Tab，等待整体保存 | 本地错误定位当前行；候选不可用不开放自由 type |
| 2B | SKU shape | CIPG-03→CIPG-04 | 维护具体规格识别码 | 规格摘要、目标规格 Modal | SKU identifiers | 确定写回父草稿 | 取消丢弃 Modal 改动；目标已删除则阻断 |
| 3A | 可制作商品 | CIPG-05 | 维护商品默认 | 标签、显示名称、时长、说明 | item profile、停用标签 readback | 留在 Tab | 候选失败保留当前草稿并重试，不退自由文本 |
| 3B | SKU shape | CIPG-03/05→CIPG-06 | 继承或单独设置 | 模式、默认预览、完整表单 | SKU mode、effective source/profile | 确定写回父草稿 | 清除覆盖恢复默认预览；取消不改父草稿 |
| 3C | 普通/称重商品有选项 | CIPG-05→CIPG-07 | 维护具体选项影响 | 具体组/值、只增字段 | option value effects、displayOrder | 回到制作信息或继续编辑 | 非法负数/移除不进入草稿；owner仍终判 |
| 4 | 表单合法且有写能力 | CIPG-01 | 一次保存全部修改 | 保存中锁定、定位错误 | whole-save readback、effective source | 按既有成功路径刷新商品与列表 | validation 定位行/SKU/选项；conflict 保留草稿；unknown 先读回不盲重试 |

## 3. v2 对应页面盘点

all-v2 在 `../catering-all-v2/apps`、`packages`、`libraries` 对商品目录、商品识别码、SKU 条码与制作信息进行有限静态检索，没有业务页面；`contracts/catalog/admin-catalog.yaml` 的 catalog 指后台页面目录，不是商品目录。因此本专题没有 `EXACT_COUNTERPART`。V4 只作静态业务心智和负面基线，不构成 runtime/build fallback。

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| CIPG-01 | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION`；all-v2 `apps/frontend/operations-admin/src/app/routing/pageRegistry.ts@cc4a57b85ef84fe9eb6ec71a6cdc1fbd3776915dac26866e26ed72312a9464fd` 无商品页 | 当前 v2s `CatalogItemDrawer.tsx@8d1497160ff61a7fbe9c18a14cb0a4cdc184514f1bbc200248605c715b74c27e` 仅作宿主基线 | 保留 whole-save 与 wide Drawer，重组页签与对象入口 |
| CIPG-02/CIPG-04 | `NO_V2_COUNTERPART` | 同上 | 本工件线框；V4 `CatalogEditableTables.tsx@219df5ed014a12bc059f56d8d09c8e81d7debd5d92026e4557e2ffb0ab447ebd` 为 `PARTIAL_COUNTERPART` | 删除独立状态/重复 scope/自由三元组；SKU 支持多识别码 |
| CIPG-03 | `NO_V2_COUNTERPART` | 同上 | 本工件线框；V4 `CatalogSkuMatrixTable.tsx@0429b30d65059340f778adc242e88ce34f1f584854836228480370a014f28c7c` 为 `PARTIAL_COUNTERPART` | 从 SKU 单条码改为识别码摘要与具体维护入口 |
| CIPG-05/CIPG-06/CIPG-07 | `NO_V2_COUNTERPART` | 同上 | 本工件线框；V4 `CatalogEditableTables.tsx@219df5ed014a12bc059f56d8d09c8e81d7debd5d92026e4557e2ffb0ab447ebd` 为 `PARTIAL_COUNTERPART` | 删除打印/过敏原/营销标签混装；分离 item 默认、SKU 完整覆盖、option 增量 effect |

## 4. 低保真线框

唯一视觉工件：`doc/plans/platform/wireframes/2026-08-23-v2s-catalog-identification-production-guidance.svg`。

- “A 商品 Drawer 宿主”对应 CIPG-01；
- “B 商品级条码与标识”对应 CIPG-02；
- “C 规格与商品编码摘要”对应 CIPG-03；
- “D SKU 识别码 Modal”对应 CIPG-04；
- “E 制作信息”对应 CIPG-05；
- “F SKU 制作信息 Modal”对应 CIPG-06；
- “G 选项值制作变化”对应 CIPG-07。

### 4.1 表单控件依赖图

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 识别类型 | 固定 Select | contract 当前 shape/owner allowedTypes | shape 与 item/SKU identity 已加载 | 类型改变保留原值但立即重校验；不自动转换 | BARCODE/PLU/MNEMONIC 的业务映射；服务只助记码，SKU无PLU | contract 未就绪不提供自由类型 | 闭集、shape、owner 粒度 |
| 识别值 | 原始字符串 Input | 用户输入 + current readback | 已选类型 | 类型变化按新规范校验；始终保留前导零 | trim 后 1..160；三类拒绝控制字符；条码/称重键码大小写敏感，助记码比较不区分大小写但保留录入形式 | 空值或不可见字符定位当前行；重复须 owner 返回 | normalizedValue、唯一域、归属 |
| 制作处理标签 | searchable 多选 Select，连续加载 | fulfillment-production owner 候选 task read + 既有引用 readback | 当前 scope/shape/profile 可编辑 | scope/target 改变取消旧请求，清除不再成立的新选项；既有停用值保留显示 | 只允许当前可供新绑定标签；不允许自由文本/快速创建 | 独立 loading/empty/failed+重试，不丢草稿 | scope、状态、引用资格 |
| 制作单显示名称 | Input | item/SKU profile readback | profile 可编辑 | SKU 切回继承时丢弃未确认 Modal 草稿 | 最多 120 个字符 | 空为未维护，超限显示业务提示 | 长度、结构、target |
| 预计制作时长（秒） | 整数输入 | profile readback | profile 可编辑 | SKU切换模式重建对应草稿 | 非负整数；空与0不同；无业务上限 | 非法定位字段 | 范围、整数、shape |
| 制作说明 | TextArea | profile readback | profile 可编辑 | 同上 | 最多 1000 个字符 | 空为未维护，超限显示业务提示 | 长度、target |
| 规格制作设置 | Radio | SKU override readback | 具体规格存在且属于商品 | 切至继承显示 item 默认；切至单独设置初始化明确完整草稿，不做隐式逐字段合并 | 继承/单独设置二选一 | item默认未加载时不能建立伪覆盖 | mode、完整 profile、归属 |
| 选项增加标签 | searchable 多选 | 同 production tag owner | 具体 option value 存在且 shape 准入 | value 删除时删除该草稿；不影响其他 value | 只增不减 | 同标签候选 | target、add-only、状态 |
| 增加制作时长 | 非负整数输入 | effect readback | 具体 option value | 无 | 不得负数 | 非法定位值 | 非负、target |
| 追加制作说明 | Input/TextArea | effect readback | 具体 option value | 组/值顺序变化不改文本，effective readback 重排 | 最多 1000 个字符 | 空为无追加，超限显示业务提示 | target、三级排序 |

### 4.2 FORM_MUTATION_DENOMINATOR

`FORM_MUTATION_DENOMINATOR=ITEM_IDENTIFIER_STANDARD,ITEM_IDENTIFIER_WEIGHED,ITEM_IDENTIFIER_MATERIAL,ITEM_IDENTIFIER_COMPOSITE,ITEM_IDENTIFIER_SERVICE,SKU_IDENTIFIER,ITEM_PREPARATION_STANDARD,ITEM_PREPARATION_WEIGHED,SKU_PREPARATION_INHERIT,SKU_PREPARATION_OVERRIDE,OPTION_EFFECT_NONE,OPTION_EFFECT_ADD`。

| 事实 | 用户可见控件 | 分类 | request 唯一来源 | 级联与校验 | command owner 最终复核 | 失败恢复 |
| --- | --- | --- | --- | --- | --- | --- |
| shape 与 allowed types | 页面提示/类型候选 | `FIXED_READONLY` | contract + latest catalog draft | shape 变化重派生全部准入，非法旧草稿进入阻断态 | catalog owner 重派生 | 不猜迁移、不开放自由值 |
| identifier owner identity | 当前商品或 SKU 标题 | `HIDDEN_OWNER_FACT` | 商品结构产生，不由用户输入 | SKU 删除时对应新 identifier 草稿删除 | item/SKU归属、shape | 定位目标已失效 |
| identifier type/value | 类型/识别值 | `EDITABLE` | 用户输入 | 行增删与规范校验 | 闭集、格式、唯一域、重复 | 定位当前行，整体不部分写 |
| item profile | 商品默认制作信息 | `CONDITIONAL_EDITABLE` | 用户输入 + tag candidates | 只对准入 shape | 字段、tag、shape | 字段级错误，草稿保留 |
| SKU override | 继承/单独设置 | `CONDITIONAL_EDITABLE` | 当前 SKU Modal 草稿 | 清除恢复 item 默认；SKU隔离 | 归属、完整覆盖、版本 | 定位 SKU，整体不部分写 |
| option effect | 具体选项值制作变化 | `CONDITIONAL_EDITABLE` | 当前 value 草稿 | 只增标签/时长/说明；value 隔离 | target、add-only、非负、排序 | 定位组和值，整体不部分写 |
| dataNode/brand/version/grants | 不显示 | `HIDDEN_OWNER_FACT` | session + current context + readback | 上下文变化关闭或重载 Drawer | owner scope、权限、CAS | denied/conflict/unknown 分类恢复 |

### 4.3 SEARCH_CAPABILITY_DENOMINATOR

- CIPG-01/CIPG-02/CIPG-03/CIPG-04：`NOT_APPLICABLE_WITH_REASON`。识别类型是三值闭集，识别行属于当前 detail 聚合；商品定位和 SKU 结构由宿主既有任务负责。
- CIPG-05/CIPG-06/CIPG-07：`APPLICABLE`，唯一搜索对象是制作处理标签。

| screen / 用户问题 | 匹配语义与控件 | 唯一来源 | 级联 | owner 核验 | contract 缺口 |
| --- | --- | --- | --- | --- | --- |
| CIPG-05/06/07 选择制作处理标签 | 按名称/编码搜索的多选 Select，连续加载；既有停用值单独回显 | fulfillment-production owner task read | scope、target 或 generation 变化取消旧请求并重取；不清除合法既有停用绑定 | scope、状态、可绑定性、引用存在 | `GAP_TECHNICAL_CONTRACT`：implementation-facing design 必须核对现有 `getOperationsProductionTags` 是否提供 query/cursor；不足时扩展 owner candidate task read，不得退成本地全量或自由字符串 |

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CIPG-01 打开/关闭/保存 | detail 骨架，完成后 hydrate | dirty 关闭统一确认 | 全 Drawer 锁定，防重复提交 | latest readback 后清 dirty 并刷新 | denied 保持只读；conflict 保留草稿 | unknown 先读 detail 与version，不盲重发 | operations-admin + catalog whole-save |
| identifier 动态行 | contract/allowedTypes 未就绪不伪默认 | 空/格式先定位行，唯一性以 owner 为准 | 随宿主锁定 | readback 返回规范值 | type/shape/owner/duplicate 可定位 | unknown 随 whole-save 处理 | catalog owner |
| SKU Modal | 打开时复制该 SKU 当前草稿 | 仅验证当前 SKU | 确定不发网络 | 写回父草稿并标 dirty | SKU 已删除则拒绝确定 | 无独立 unknown | app draft；owner 最终保存 |
| production tag candidate | 独立 loading | 失效/停用新选项不可选 | 随宿主锁定 | 已选与既有停用引用明确区分 | owner 拒绝越 scope/停用新绑定 | 候选失败可重试且不丢草稿 | production task read + catalog command |
| option effect | value 级 hydrate | 负数/remove/完整profile不成立 | 随宿主锁定 | effective readback 按业务序 | 越 value/shape 拒绝 | 随 whole-save 处理 | catalog owner + production ref validation |

## 6. 逐操作任务合理性

| 操作 | Journey 来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 在商品页维护商品识别码 | Journey §2 | 正在维护当前商品 | 无 | 独立识别页会切断商品与版本上下文 | 产品/owner | 否 |
| 从 SKU 行维护识别码 | Journey §2 | 必须先确认具体规格 | 无 | 抽象“SKU节点”无法说明目标；全部行内会过密 | 产品/IA | 否 |
| 维护商品默认制作信息 | Journey §2 | 大多数销售项共享默认做法 | 无 | 与 SKU/选项混成一份会丢 target | 产品 | 否 |
| 为 SKU 选择继承或单独设置 | 正式需求 §4.3 | 某规格确有完整差异 | 无 | 逐字段合并不可见且难解释 | 产品 | 否 |
| 去点单选项维护 effect | Journey §2 | 影响属于具体选择 | 从制作页直接编辑更短但错误 | 必须先显示选项组和值的业务上下文 | 产品/IA | 否 |
| 添加/移除 identifier 行 | 正式需求 §3 | 一个对象可有多个同类型值 | 单值字段不够 | 现实中多包装码/助记输入并存 | 产品 | 否 |
| 保存 | Journey §2 | 一次提交商品整体草稿 | 子 Modal 独立保存更短但破坏原子性 | 保持 whole-save/CAS/统一失败恢复 | owner/transaction | 否 |
| 取消/关闭 | Journey §2 | 放弃未保存修改 | 无 | 统一 dirty guard 防丢失 | foundation | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| CIPG-01 打开/保存 | operations-admin | 既有商品页读取/写 capability | `getOperationsCatalogItem` + `saveOperationsCatalogItem` | catalog owner initiating command；production owner ref validation | 实时 grant、CAS、事务整体性 |
| CIPG-02/04 identifier | operations-admin | 随商品页；shape 控制可见候选 | 随 detail/save；本批不新增按值解析 HTTP/task read，未来销售 Journey 另行设计 | catalog identifier facts | type/shape/归属/规范化/唯一域 |
| CIPG-03/06 SKU | operations-admin | 随商品页，SKU shape | 随 detail/save | catalog SKU structure + override readback | SKU 属于当前 item、完整覆盖、source |
| CIPG-05/07 production | operations-admin | 随商品页，制作 shape | detail/save + production-tag candidate read | catalog profile/effect + production tag owner | shape、tag资格、target、非负/add-only/排序 |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 本 Journey 的命中或不适用理由 | 遵循方式 | Heritage 原文 |
| --- | --- | --- | --- |
| B.4 管理后台状态与共享 foundation | Drawer 生命周期、Modal overlay、候选 generation、刷新、generated HTTP 和自动化定位均适用 | 本工件已逐 screen 声明 exact exports；implementation-facing design 再绑定 exact import path 并核对当前消费者 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/frontend-runtime-and-admin-architecture-standard.md` |
| B.5 商品目录交互 | all-v2 无商品目录对应 screen；V4 只有局部基线且旧 identifier/profile 模型与本期裁决冲突 | 只继承“商品档案 Drawer + 具体对象就地维护”的静态心智；新 contract/owner/shape 裁决优先，不作 runtime/build fallback | V4 path@hash 见 §3 |

## 9. 高保真静态 demo

`NOT_APPLICABLE_WITH_REASON`：本专题重构既有商品 Drawer 中的信息归属、页签和局部 Modal，低保真线框已足以让 Dexter 判断“在哪个对象上改什么”以及保存边界；不需要高保真视觉稿替代业务确认。

## 10. Dexter 看图结论

- 看图日期：`2026-08-23`
- 低保真线框结论：`ACCEPTED`
- 高保真 demo 结论：`NOT_REQUIRED`
- 修改意见/已接受的操作顺序：`接受全部交互结构；新增强制条件：用户界面只用业务用户能理解的语言；contract、界面与 owner 的约束责任必须分层设计，隐藏/disabled 不能替代 owner 复核。`
- 允许进入 IA 与 implementation-facing design：`是；仅允许设计工件，不构成实施授权`
