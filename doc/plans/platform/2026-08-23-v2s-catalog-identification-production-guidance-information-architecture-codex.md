# 商品条码与标识、制作信息优化信息架构

> `PARTIALLY_SUPERSEDED_BY`：`doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md`。
> 生产标签的控制权、基数、控件形态、级联与可见文案以新 IA 为准；旧多选、SKU 标签与选项标签条款均退役。

<a id="catalog-identification-production-guidance-information-architecture"></a>

## 1 · 元数据

```text
IA_SCOPE=IA-CIPG-01,IA-CIPG-02,IA-CIPG-03,IA-CIPG-04,IA-CIPG-05,IA-CIPG-06,IA-CIPG-07
BUSINESS_SOURCE=doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md#catalog-identification-production-guidance-formal-requirements
JOURNEY_REFS=doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-journey.md#catalog-identification-production-guidance-journey
UI_INTERACTION_REF=doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-ui-interaction.md#ui-detailed-design-admission
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-23
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_AUTHORIZATION=DEXTER_CIPG_DESIGN_GO_CP00_CP13_20260823
```

本 IA 只固化已接受的商品识别与制作信息任务。它特别落实 Dexter 的新增裁定：**用户界面只使用业务用户能理解的语言；机器约束、界面约束和 owner 复核不得混成一层。** 本文不授权修改 contract、代码、数据库或环境。

## 2 · 维度

### 2.1 IA-CIPG-01 · 商品编辑宿主

#### 可见维度

| 维度 | 本屏取值 |
| --- | --- |
| `businessTask` | 在一个商品编辑上下文中完成商品资料、识别码和制作信息的整体保存，并在失败时知道需要核对哪一项业务内容。 |
| `actorAndScenario` | 总部或门店商品资料维护者正在新建或编辑一个商品，需要继续维护这个商品或其规格的识别与制作差异。 |
| `entryAndSurface` | `/operations/:workspace/catalog/store-items` 商品工作台；点击商品名称或“新建商品”打开右侧商品编辑抽屉。 |
| `controlType` | 查看态：商品名称/编码、商品类型摘要、只读页签和关闭；编辑态：按商品类型显示允许的业务页签、取消、保存。保存是整个商品编辑页唯一提交入口，子弹窗没有独立服务端保存。 |
| `validationAndError` | 字段、识别码行、规格或点单选项错误定位到对应可见对象；设置已被其他操作更新时保留草稿并提示重新加载核对；结果无法确认时保留草稿并先读回，不自动重复提交。 |
| `accessibilityAndTestId` | 抽屉标题由 `aria-labelledby` 关联；页签、取消、保存、关闭可键盘到达；忙碌、禁用和错误不能只靠颜色；错误容器 `role=alert`。定位符使用 `catalog-item-drawer`、`catalog-item-tabs`、`catalog-item-save`、`catalog-item-problem`、`catalog-item-dirty-discard`。 |
| `emptyLoadingErrorStates` | 首次读取显示商品编辑骨架；读取失败显示持续可见的业务提示与重试，不用空表单冒充商品；重试保留目标商品身份。某类商品没有识别或制作入口是合法准入结果，不显示错误页签。 |
| `containerBehaviorUnderLoad` | **宽度完全采用 `adminWideDrawerSurfaceProps`，即 `min(1024px,calc(100vw - 48px))`；header、tabs 与 footer 不超视口，body 是唯一纵向滚动容器；页签栏可横向滚动但页面不得出现横向滚动；表单标签列沿用 164px，操作按钮右对齐。** 数据达到商品详情实际长度时只由 body 纵向增长；长商品名/编码截断并提供完整提示，不能挤压取消/保存。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[静态]` 商品详情与制作处理标签候选两条读边界都从已确认的当前工作范围取得数据节点与品牌，不从浏览器地址或隐藏字段自证授权；保存由 catalog command 在事务内复核范围、写能力和版本。`[backend-acceptance]` 用只授权 A 门店的身份读取或保存 B 门店商品，两条读边界和保存命令均拒绝；任一返回 B 的详情/标签或写入成功即缺陷。 |
| `navigationAndRefresh` | `[静态]` 本批新增事实保存成功后只沿既有商品 whole-save policy 刷新当前商品详情与当前商品列表身份；制作标签候选、单位、分类、属性和点单选项定义不因本批字段变化而重取。`[组件 focused test]` 保存失败、冲突或结果未知时，上述成功失效链不触发，当前草稿仍在。统一“刷新当前页”只刷新读模型，不覆盖已打开的脏表单。 |
| `collectionShapeAndScale` | 商品详情是 `Detail aggregate`：一个商品一次读回 item、SKU、选项、identifier 与制作事实；预期 SKU/选项为 1 至几十项，增长由规格和点单选项配置驱动。本批不发明新的业务硬上限、不分页、不客户端 slice、不静默截断；如 owning contract 已有上限则原样消费，没有则由商品整体请求资源边界保护而不伪造产品上限。`[静态]` detail/save 不出现 cursor/pageSize 或抽干分页再拼详情。 |
| `dataSourceAndCascade` | `[组件 focused test]` 切换 dataNode、brand 或 item identity 后取消旧请求，清空旧商品草稿、已打开子弹窗和选中页签的目标，再由新 detail hydrate；旧响应晚到不得覆盖。页签切换只切换视图，不复制服务端 detail 为第二份事实。 |
| `forbiddenUI` | `[静态/组件 focused test]` 可见文本、`aria-label`、`title`、placeholder 和错误消息出现以下任一词即缺陷：`shape`、`dataNodeRef`、`brandRef`、`itemRef`、`owner`、`scope`、`contract`、`CAS`、`profile`、`effect`、`source`、`readback`、`payload`、`problem code`、`capability`、`grant`、`UUID`、raw exception。商品编辑内出现局部服务端保存按钮或失败后自动关闭同样是缺陷。 |

### 2.2 IA-CIPG-02 · 商品级条码与标识

#### 可见维度

| 维度 | 本屏取值 |
| --- | --- |
| `businessTask` | 为当前商品维护用于扫码、称重键码或快速检索的识别值，同时知道商品编码不需要重复录入。 |
| `actorAndScenario` | 商品资料维护者已经打开普通、称重、物料、套餐或服务/费用商品，准备维护商品本身的识别码。 |
| `entryAndSurface` | IA-CIPG-01 内“条码与标识”内容页签；按规格管理商品改由 IA-CIPG-03/04，权益商品不显示入口。 |
| `controlType` | 查看态：识别方式和值的只读行；编辑态：“添加识别码”、类型 Select、原始字符串 Input、“移除”。类型显示“条码”“称重键码（PLU）”“助记码”；服务/费用商品只显示“助记码”。 |
| `validationAndError` | 空值显示“请填写识别值”；超过 160 个字符显示“识别值最多 160 个字符”；控制字符显示“识别值不能包含不可见字符”；助记码提示“不区分大小写”；不适用显示“当前商品类型不支持这种识别方式”；重复显示“该识别码已被同一品牌下的其他商品或规格使用”。错误必须定位当前行。 |
| `accessibilityAndTestId` | 每行类型和值有可读 label；移除按钮包含当前识别方式和值的可访问名称；新增行后焦点进入类型。定位符：`catalog-item-identifiers`、`catalog-item-identifier-add`、`catalog-item-identifier-type-{rowKey}`、`catalog-item-identifier-value-{rowKey}`、`catalog-item-identifier-remove-{rowKey}`。稳定 `rowKey` 不取用户可编辑值。 |
| `emptyLoadingErrorStates` | 空集合显示“尚未维护识别码”；contract 能力未就绪时显示骨架而不是自由类型输入；服务/费用商品显示“服务与费用商品只支持助记码”“条码和称重键码不适用于此类商品”。 |
| `containerBehaviorUnderLoad` | **随 IA-CIPG-01 body 滚动，不创建嵌套纵向滚动；说明与“添加识别码”上下排列；动态行采用 160px 类型列+`minmax(280px,1fr)` 值列+64px 操作列，窄于 760px 时一行字段改为纵向堆叠；行和按钮不得造成抽屉横向滚动。** 识别码数量增长时逐行纵向增长；超长值单行截断并可查看完整值，操作区不被挤出视口。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[静态]` 可见类型来自 generated shape capability，不由组件复制矩阵；保存时 owner 从当前商品类型重新派生。`[backend-acceptance]` 对服务/费用商品和普通商品篡改提交不准入类型，对按规格商品提交父商品识别码，均返回 typed problem 且版本不变。 |
| `navigationAndRefresh` | `[组件 focused test]` 新增、编辑、移除只改变父商品草稿，不触发 HTTP 或列表刷新；whole-save 成功后的刷新完全由 IA-CIPG-01 负责。 |
| `collectionShapeAndScale` | identifier 是 `Detail aggregate` 子集合，实际数量由包装条码、称重键码和助记码驱动；无已批准业务硬上限，不在客户端截断或分页。`[静态]` contract 若声明 `maxItems`，前端从 generated constraint 读取且 owner 同值复核；contract 未声明时前端不得发明 10/20/99 之类限制。 |
| `dataSourceAndCascade` | `[组件 focused test]` 类型改变后保留用户已填字符串并按新规则重新校验，不自动转换或丢前导零；移除行只移除当前草稿行；商品类型变化时不合法行进入可见阻断态，不自动猜成其他类型。 |
| `forbiddenUI` | `[静态/组件 focused test]` 可见 DOM 不出现 `kind/code/value` 三元组、identifierRef、normalizedValue、ownerType、独立“启用/停用”、内部类型值 `BARCODE/PLU/MNEMONIC` 原文（“称重键码（PLU）”的业务缩写说明除外）。 |

### 2.3 IA-CIPG-03 · 规格与商品编码摘要

#### 可见维度

| 维度 | 本屏取值 |
| --- | --- |
| `businessTask` | 先找到具体规格，再查看该规格的识别码数量与制作设置，并从当前行进入维护。 |
| `actorAndScenario` | 商品资料维护者正在编辑按规格管理的商品，需要逐个规格确认识别和制作差异。 |
| `entryAndSurface` | IA-CIPG-01 内“规格与商品编码”内容页签；仅按规格管理商品显示。 |
| `controlType` | 查看态：规格、规格编码、识别码摘要、制作信息摘要；编辑态：每行“维护识别码”“维护制作信息”。没有父商品识别入口，也不让用户在弹窗中重新选择规格。 |
| `validationAndError` | 规格已经被删除或结构已变化时，行显示“该规格已发生变化，请重新加载后核对”；识别码/制作错误回到对应行并标明“识别码”或“制作信息”。 |
| `accessibilityAndTestId` | 表头和数据单元语义关联；两个按钮的可访问名称包含规格名称；卡片退化后阅读顺序仍为规格→编码→识别码→制作信息→操作。定位符：`catalog-item-sku-row-{skuKey}`、`catalog-item-sku-identifiers-{skuKey}`、`catalog-item-sku-preparation-{skuKey}`。 |
| `emptyLoadingErrorStates` | 商品结构加载中显示规格骨架；0 个规格是商品结构 validation，不伪装成“暂无数据”；某规格 0 个识别码显示“未维护”，制作未覆盖显示“使用商品默认”。 |
| `containerBehaviorUnderLoad` | **随 IA-CIPG-01 body 滚动，不增加内层纵向滚动；表格最小列宽合计 760px，抽屉低于该宽度时每个规格退化为纵向卡片，禁止外层横向滚动；规格/规格编码左对齐，摘要和操作与各自行基线对齐。** 规格达到当前商品实际数量时由 body 滚动；长规格名/编码最多两行并可查看完整值，操作按钮不溢出。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[静态]` 规格行完全来自当前 catalog detail，不接受独立查询参数中的任意规格引用；`[backend-acceptance]` 用当前商品请求提交另一个商品的规格引用，识别与制作两条路径都拒绝且当前商品版本不变。 |
| `navigationAndRefresh` | `[组件 focused test]` 打开或关闭两种规格弹窗不重新读取商品；确定只更新对应行摘要和父草稿；取消不改变摘要。 |
| `collectionShapeAndScale` | SKU 是 `Detail aggregate` 子集合，预期 1 至几十项，增长由规格属性组合驱动；上界只来自既有商品结构 contract，不在本批另设、不分页、不客户端 slice。`[组件 focused test]` 40 行时仍可到达最后一行，摘要与目标不串行。 |
| `dataSourceAndCascade` | `[组件 focused test]` 删除规格后立即关闭该规格已打开的弹窗并移除未提交 identifier/制作草稿，不影响其他规格；重排规格只改变展示顺序，不用可编辑规格编码作 React key。 |
| `forbiddenUI` | `[静态/组件 focused test]` 不出现父商品识别码编辑、抽象“SKU节点”“制作节点”、任意规格选择器、skuRef/version/source 等技术文本。 |

### 2.4 IA-CIPG-04 · 具体规格识别码弹窗

#### 可见维度

| 维度 | 本屏取值 |
| --- | --- |
| `businessTask` | 为标题中已经确认的具体规格维护一个或多个条码和助记码。 |
| `actorAndScenario` | 用户从规格行点击“维护识别码”，当前规格名称与规格编码已确定。 |
| `entryAndSurface` | IA-CIPG-03 当前行打开 Modal；标题“维护识别码 · {规格名称}”。 |
| `controlType` | 查看态：规格编码与识别码只读；编辑态：添加、类型 Select、值 Input、移除、取消、确定。确定只把修改带回商品草稿。 |
| `validationAndError` | 错误文案与 IA-CIPG-02 相同；PLU 不提供候选；目标规格失效显示“该规格已发生变化，请重新加载后核对”。 |
| `accessibilityAndTestId` | 打开后焦点进入标题/首个控件；焦点锁在弹窗；Esc 与关闭走取消语义；关闭后焦点回到发起行按钮。定位符：`catalog-sku-identifier-modal` 及 IA-CIPG-02 的行定位符前缀。 |
| `emptyLoadingErrorStates` | 初始直接复制父草稿，不发 loading 请求；0 行显示“尚未维护识别码”；父规格失效时禁用确定并显示业务原因。 |
| `containerBehaviorUnderLoad` | **Modal 宽度 `min(720px,calc(100vw - 48px))`、最大高度 `calc(100vh - 96px)`；Modal body 是唯一滚动容器，header/footer 固定；动态行布局与 IA-CIPG-02 一致，窄屏纵向堆叠；footer 操作右对齐。** 行达到实际数量时只滚动 body；标题、取消、确定始终可见。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[组件 focused test]` 弹窗目标只能由当前规格行产生，组件没有可写的 productSkuRef 输入；真正保存时仍由 owner 复核归属。 |
| `navigationAndRefresh` | `[组件 focused test]` 确定和取消均产生 0 次 HTTP；确定更新父草稿并标记 dirty，取消销毁本次弹窗副本；关闭后焦点回到原按钮。 |
| `collectionShapeAndScale` | 与 IA-CIPG-02 相同：当前规格 identifier 为 `Detail aggregate`，数量由该规格真实识别方式驱动，无本批新增硬上限；Modal body 承担增长。 |
| `dataSourceAndCascade` | `[组件 focused test]` 弹窗打开后父草稿中该规格被删除，弹窗立即进入失效态且不能确定；其他规格变化不替换当前目标。 |
| `forbiddenUI` | `[组件 focused test]` 不出现称重键码候选、父商品识别入口、规格切换器、skuRef、version、problem code、“单独保存到服务端”等技术说明。可见提示必须是“返回商品页面后仍需点击保存才会生效”。 |

### 2.5 IA-CIPG-05 · 商品默认与各规格制作信息

#### 可见维度

| 维度 | 本屏取值 |
| --- | --- |
| `businessTask` | 维护商品通常使用的制作信息，并看清各规格是否使用商品默认，以及哪些点单选项会增加制作变化。 |
| `actorAndScenario` | 商品资料维护者正在编辑普通、称重或按规格销售商品，需要维护制作人员实际看到和执行的内容。 |
| `entryAndSurface` | IA-CIPG-01 内“制作信息”内容页签；物料、套餐、服务/费用和权益商品不显示入口。 |
| `controlType` | 商品默认表单：制作处理标签多选、制作单显示名称 Input（最多 120 个字符）、预计制作时长非负整数输入（无业务上限）、制作说明 TextArea（最多 1000 个字符）；按规格商品显示规格摘要及“维护制作信息”；有点单选项的普通/称重商品显示“点单选择带来的制作变化”摘要和“去点单选项维护”。 |
| `validationAndError` | 时长必须为空、0 或正整数；标签不可新绑定时显示“所选制作处理标签已不可使用，请重新选择”；既有停用标签显示“已停用（保留既有设置）”；字段错误不改写成网络问题。 |
| `accessibilityAndTestId` | 表单 label 与控件关联；停用状态有文字；规格摘要按钮包含规格名称；跳转按钮说明目标为点单选项。定位符：`catalog-item-preparation`、`catalog-item-production-tags`、`catalog-item-production-name`、`catalog-item-production-seconds`、`catalog-item-production-notes`、`catalog-item-option-preparation-link`。 |
| `emptyLoadingErrorStates` | 详情未就绪显示骨架；制作标签候选独立 loading/empty/failed/retry，失败不清空已填草稿；无 item profile 显示空字段和“尚未设置制作信息”，不造伪默认；既有停用标签始终读回。 |
| `containerBehaviorUnderLoad` | **随 IA-CIPG-01 body 单一滚动；默认表单使用 164px 标签列；规格摘要表在窄屏退化为卡片；选项摘要只占一行并可换行；候选下拉由 overlay 承载，不形成第二纵向页面滚动；页面和 footer 不横向溢出。** 标签很多时在控件内换行并设置合理最大高度后内部滚动；长名称/说明换行，规格操作区不溢出。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[静态]` 制作入口可用性来自 generated shape capability，标签只从 fulfillment-production owner candidate read 获取；`[backend-acceptance]` 对物料、套餐、服务/费用、权益商品提交制作信息，以及新绑定停用/越范围标签，均拒绝且商品版本不变。 |
| `navigationAndRefresh` | `[组件 focused test]` 标签候选翻页/重试只重取自身 query；切到其他页签不重取 detail；“去点单选项维护”只切换当前 Drawer 页签并定位，不发保存或列表请求。 |
| `collectionShapeAndScale` | item profile 是单值 `Detail aggregate`；规格摘要与选项摘要跟随商品详情。标签候选是 `Cursor`，当前 owning operation 已有 cursor/pageSize，预期每范围十几个至几百个，增长由共享制作标签库驱动；实现设计补 query 搜索参数，默认 20、最大 100，不抽干所有页再本地搜索。`[acceptance]` 造 101 个可用标签时第二页可达且无重复遗漏。 |
| `dataSourceAndCascade` | `[组件 focused test]` dataNode/brand/item 变化取消旧候选 generation 并清除不再成立的新选择；既有停用绑定保留。商品默认变化立即更新所有“使用商品默认”的本地预览，不改写“已单独设置”的规格草稿。 |
| `forbiddenUI` | `[静态/组件 focused test]` 不出现“快速创建制作标签”、打印名称/标签/模板/打印机、KDS、队列、工作台、过敏原、营销标签、stationTags、printTags、materialRole、profile/source 等技术文案。 |

### 2.6 IA-CIPG-06 · 具体规格制作信息弹窗

#### 可见维度

| 维度 | 本屏取值 |
| --- | --- |
| `businessTask` | 为标题中已确认的具体规格选择“使用商品默认”或“单独设置”一整套制作信息。 |
| `actorAndScenario` | 用户从规格行或制作信息摘要进入，需要解释该规格为什么与其他规格相同或不同。 |
| `entryAndSurface` | IA-CIPG-03 或 IA-CIPG-05 的具体规格行打开 Modal。 |
| `controlType` | 二选一 Radio：“使用商品默认”“单独设置”；默认预览；单独设置时显示与商品默认相同的四个字段；“清除单独设置并恢复商品默认”“取消”“确定”。 |
| `validationAndError` | 字段错误沿用 IA-CIPG-05；“单独设置”必须形成整套本规格制作信息；目标规格失效显示业务提示并禁用确定。 |
| `accessibilityAndTestId` | Radio 使用 fieldset/legend；默认预览可被屏幕阅读器识别；焦点锁定、Esc/关闭、焦点归还同 IA-CIPG-04。定位符：`catalog-sku-preparation-modal`、`catalog-sku-preparation-use-default`、`catalog-sku-preparation-custom`、`catalog-sku-preparation-clear`。 |
| `emptyLoadingErrorStates` | 打开时使用父草稿，无独立详情 loading；商品默认尚未 hydrate 时不允许建立伪预览；标签候选状态同 IA-CIPG-05；清除后立即显示当前商品默认。 |
| `containerBehaviorUnderLoad` | **Modal 宽度 `min(720px,calc(100vw - 48px))`、最大高度 `calc(100vh - 96px)`；body 唯一滚动，header/footer 固定；模式选择横排，窄屏纵向；字段标签列 164px，按钮右对齐，不产生横向滚动。** 标签和说明很长时只滚动 body，标题、取消、确定始终可达。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[组件 focused test]` 弹窗没有任意规格选择或可写 identity；`[backend-acceptance]` 提交其他商品规格的 override、半份 override 或不准入 shape，均拒绝且版本不变。 |
| `navigationAndRefresh` | `[组件 focused test]` 确定/取消产生 0 次 HTTP；确定只更新当前规格摘要并标记父草稿 dirty；清除后摘要改为“使用商品默认”；保存与刷新由 IA-CIPG-01 统一执行。 |
| `collectionShapeAndScale` | 当前规格 override 是单值 `Detail aggregate`；production tag 候选沿用 IA-CIPG-05 的 Cursor，不另建第二套列表或本地全量副本。 |
| `dataSourceAndCascade` | `[组件 focused test]` 切换到“使用商品默认”丢弃未确认的单独设置弹窗副本并显示最新商品默认；切换到“单独设置”建立显式整套草稿，不把空字段暗中继承。父商品默认变化只更新默认预览。 |
| `forbiddenUI` | `[组件 focused test]` 可见 DOM 不出现 `INHERIT_ITEM`、`OVERRIDE`、profile、source、“逐字段继承”“隐式合并”等术语；不得提供每个字段独立的“继承”开关。 |

### 2.7 IA-CIPG-07 · 具体点单选项值的制作变化

#### 可见维度

| 维度 | 本屏取值 |
| --- | --- |
| `businessTask` | 在具体点单选项值旁维护会增加的制作处理标签、时长和说明。 |
| `actorAndScenario` | 普通或称重商品已有“加珍珠”“换燕麦奶”“加冰”等选项，用户要说明选择后增加什么制作工作。 |
| `entryAndSurface` | IA-CIPG-01 “点单选项”内容页签内的具体选项值卡片；IA-CIPG-05 跳转后切换到此页签并定位。 |
| `controlType` | “制作变化（可选）”折叠区；“增加制作处理标签”多选、“增加制作时长（秒）”非负整数输入（无业务上限）、“追加制作说明”Input/TextArea（最多 1000 个字符）；无“移除标签”或“减少时长”。 |
| `validationAndError` | 时长提示“填写零或正整数”；标签只允许新增；非法内容显示“点单选项只能增加制作标签、时长和说明”；目标选项已变化时提示重新加载核对。 |
| `accessibilityAndTestId` | 折叠区按钮说明选项组和值名称；字段 label 包含当前值上下文；错误关联当前值；跳转定位后焦点进入该值标题。定位符：`catalog-option-value-preparation-{valueKey}`、`catalog-option-value-tags-{valueKey}`、`catalog-option-value-seconds-{valueKey}`、`catalog-option-value-instruction-{valueKey}`。 |
| `emptyLoadingErrorStates` | 没有变化显示“不设置制作变化”；标签候选状态同 IA-CIPG-05；选项值删除时不显示孤儿折叠区；候选失败不丢其他选项值草稿。 |
| `containerBehaviorUnderLoad` | **沿 IA-CIPG-01 body 滚动，选项组/值现有容器不新增嵌套滚动；每个值的制作变化使用可折叠区，字段按 164px 标签列对齐；窄屏纵向堆叠；定位后仅滚动抽屉 body，不滚动页面；候选下拉不得造成横向溢出。** 选项值很多时依赖 body 纵向滚动；长组名/值名/说明换行，折叠按钮和字段操作不溢出。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[静态]` 制作变化入口来自 generated shape capability 和当前 option structure；`[backend-acceptance]` 提交越商品 option value、负时长、标签移除或完整 profile，均拒绝且版本不变。 |
| `navigationAndRefresh` | `[组件 focused test]` 在选项值间编辑不发 HTTP；从 IA-CIPG-05 跳转只改变当前页签与定位；whole-save 后由 IA-CIPG-01 精确刷新。 |
| `collectionShapeAndScale` | option effect 是 `Detail aggregate` 子集合，预期 0 至几十个已设置值，增长由点单选项值数量驱动；无本批新增硬上限，不分页、不客户端 slice。production tag 候选沿用同一 Cursor。 |
| `dataSourceAndCascade` | `[组件 focused test]` 删除选项值只删除该值未提交的制作变化，不影响其他值；重排选项组或值不改写说明文本，只改变 effective readback 的说明顺序；旧异步标签响应不能写入已删除值。 |
| `forbiddenUI` | `[静态/组件 focused test]` 可见 DOM 与提交草稿不出现移除标签、负时长、完整 profile、priority、UUID 排序说明；用户只看到“多项制作说明会按点单选项在页面中的顺序依次呈现”。 |

## 3 · 共用信息架构规则

### 3.1 Contract、界面与 owner 三层分工

| 约束族 | generated contract / manifest 定义 | operations-admin 界面定义 | owner 最终复核 |
| --- | --- | --- | --- |
| 字段和枚举 | 字段结构、类型、required/nullable、枚举、格式、长度、数组与数值范围 | 中文字段名、帮助文案、控件形态和字段顺序；从 generated 约束做即时提示 | 对同一字段结构、范围和枚举重新校验 |
| 商品类型准入 | item/SKU/option 粒度与 allowed identifier/preparation capability | 决定显示哪个页签、按钮和候选；不复制一份 shape 矩阵 | 从当前真实商品结构重新派生；篡改请求照样拒绝 |
| 识别唯一与归属 | normalized 规则、唯一域入参、typed problem 与定位结构 | 不显示唯一域/ref；把拒绝映射到当前行的业务文案 | 计算 normalized value，校验 dataNode+brand+type/value 唯一和 item/SKU 归属 |
| 制作合并 | item 默认、SKU 完整覆盖、option add-only 与排序的 typed schema/readback | 显示“使用商品默认/单独设置”“增加/追加”；处理草稿与预览 | 校验完整覆盖、add-only、非负、target 和业务顺序 |
| 制作标签候选 | candidate 字段、query/cursor/pageSize、状态与既有引用 readback | 搜索、连续加载、停用标记、loading/empty/failed；不提供自由文本/快速创建 | production owner 校验范围、状态与新绑定资格；既有停用引用继续可读 |
| 错误 | 稳定 problem code、reason code、field path、row/target locator 和安全详情字段 | problem/reason exact-set 穷尽映射为业务文案；保留原因，不展示 raw code/detail | 在真实命令边界产生正确拒绝，失败不改变版本或部分事实 |
| 权限与版本 | operation consumer face、授权元数据、expectedVersion 字段 | 无写能力显示只读；冲突/未知结果提供恢复路径 | edge/owner 实时复核范围、grant、状态、版本和事务整体性 |
| 布局与交互 | 不定义 | Drawer/Modal/Tab、响应式、键盘路径、testId、草稿生命周期、精确刷新 | 不决定页面结构或中文文案 |

不可互换的判据：

1. **隐藏或 disabled 只改善体验，不构成业务防线。** 每个不显示的非法组合都有 backend-acceptance 篡改请求反例。
2. **即时校验只改善输入，不构成事实真相。** contract 给机器约束，owner 用同值复核，界面不得自创另一套正则或范围。
3. **错误码不是用户文案。** contract/owner 返回稳定 code 和定位，UI exact-set 映射成业务语言；raw exception、内部 enum、ref 和 payload 永不显示。
4. **可用性不是布局。** contract/manifest 说“当前商品允许哪些事实”，交互/IA 决定它显示在页签、行或弹窗哪里。

### 3.2 数据来源、级联与只读原则

1. detail/readback 是已保存事实唯一住址；组件 state 只保存未提交草稿、当前页签和弹窗副本，不把服务端集合镜像成第二份事实。
2. 级联顺序：当前工作范围与商品 → generated capability + detail → 商品/SKU/option target → identifier/profile/effect 草稿 → production tag candidates。上游变化取消旧 generation 并清理不再成立的下游草稿。
3. identifierRef、normalizedValue、owner/ref、版本、权限和 effective source 是隐藏技术事实；用户看到的是商品、规格、选项值、“使用商品默认/已单独设置”和可理解失败原因。
4. 商品整体保存是唯一服务端写入口；两个规格 Modal 的“确定”只写父草稿。

### 3.3 通用禁止 UI（可搜索证伪）

可见文本、placeholder、tooltip、`aria-label`、错误横幅与确认提示不得出现以下技术语：

```text
shape dataNodeRef brandRef itemRef productSkuRef definitionRef definitionValueRef
owner ownerRef ownerType scope contract CAS identifierRef normalizedValue profile effect
source readback payload problem code capability grant generation candidate fallback UUID
INHERIT_ITEM OVERRIDE BARCODE MNEMONIC
```

`PLU` 只允许出现在用户文案“称重键码（PLU）”中；`SKU` 和 `BOM` 是仓内既有业务词，但本专题新增页面优先使用“规格”“规格编码”，不得继续扩散为技术字段名。

## 4 · 错误语义与界面映射（全量）

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
| --- | ---: | --- | --- | --- |
| `SCOPE_FORBIDDEN` | 403 | 当前账号不能读取或修改目标范围 | 全部读/保存；edge+owner | “你当前不能查看或修改这个商品。”不渲染其他范围事实。 |
| `NOT_FOUND` | 404 | 商品、规格、选项值或制作标签已不存在/不属于当前商品 | 详情、候选、保存 | “相关商品内容已发生变化，请重新加载后核对。”定位当前行/规格/选项。 |
| `VERSION_CONFLICT` | 409 | 用户看到的商品版本已经变化 | whole-save | “商品资料已被其他操作更新，请重新加载后核对。”保留草稿，不自动覆盖。 |
| `CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED` | 422 | 当前商品类型/归属不允许该识别类型 | IA-CIPG-02/04；catalog owner | “当前商品类型不支持这种识别方式。”定位当前行。 |
| `CATALOG_IDENTIFIER_VALUE_INVALID` | 422 | 识别值为空或不符合该类型的格式/长度 | IA-CIPG-02/04；catalog owner | 按类型提示“请填写有效的条码/称重键码/助记码”，不显示正则或内部规则名。 |
| `CATALOG_IDENTIFIER_DUPLICATE` | 409 | 同一数据节点、品牌和类型下规范化值已归其他对象 | IA-CIPG-02/04；catalog owner | “该识别码已被同一品牌下的其他商品或规格使用。” |
| `CATALOG_IDENTIFIER_OWNER_MISMATCH` | 422 | 父商品/SKU粒度或跨商品归属不成立 | IA-CIPG-02/04；catalog owner | “识别码对应的商品或规格已经发生变化，请重新加载后核对。” |
| `CATALOG_PREPARATION_NOT_ALLOWED` | 422 | 当前商品类型不允许商品默认/SKU覆盖/option变化 | IA-CIPG-05/06/07；catalog owner | “当前商品类型不能设置这项制作信息。” |
| `CATALOG_PREPARATION_TARGET_MISMATCH` | 422 | SKU/option target 不属于当前商品或已删除 | IA-CIPG-06/07；catalog owner | “对应的规格或点单选项已经发生变化，请重新加载后核对。” |
| `PRODUCTION_TAG_NOT_BINDABLE` | 422 | 新标签不存在、已停用或越当前范围 | IA-CIPG-05/06/07；production+catalog owner | “所选制作处理标签已不可使用，请重新选择。”既有停用引用不触发此提示。 |
| `CATALOG_PREPARATION_DURATION_INVALID` | 422 | item/SKU 时长或 option delta 非整数/负数/越范围 | IA-CIPG-05/06/07；catalog owner | “请填写零或正整数。”定位时长字段。 |
| `CATALOG_OPTION_PREPARATION_CHANGE_NOT_ALLOWED` | 422 | option 请求移除标签、减少时长或提交完整 profile | IA-CIPG-07；catalog owner | “点单选项只能增加制作标签、时长和说明。” |
| `CATALOG_PREPARATION_UNKNOWN_FIELD` | 422 | 旧自由字段或未知 profile 字段仍在请求 | whole-save；catalog owner | “当前制作信息包含不再支持的内容，请重新加载后核对。”不显示字段内部名。 |
| `VALIDATION_ERROR` | 422 | 其他字段必填、长度、集合结构错误 | 当前字段/行；owner | 使用 safe field path 定位并显示已批准业务文案；不得直接显示 path。 |
| `RESULT_UNKNOWN` | 503 | 保存结果暂时无法确认 | whole-save edge | “保存结果暂时无法确认。系统将先重新读取商品资料，请核对后再决定是否重试。”保留草稿。 |

所有 code 名称在 implementation-facing design 中与 catalog 生成源现有 namespace 对账；若现有 code 能准确表达同一语义则复用，不为改名造第二套。无论最终 code 名为何，UI 业务文案和定位语义必须与上表逐字一致。

## 5 · 交叉对账

| 检查 | 结果 |
| --- | --- |
| IA ↔ 交互工件 | PASS：7 个 screen、入口、surface、可见文案、滚动容器和业务操作逐项一致；新增业务语言替换已同步回交互稿与 SVG。 |
| IA ↔ 详设 | PASS：implementation-facing design §3/§7/§14 已逐项复用七个 screen 的不可见观察、三层分工、15 个错误映射与用户文案禁区。 |
| IA-ID ↔ Journey | IA-CIPG-01 对应入口/整体保存；02 对应商品 identifier；03/04 对应具体规格 identifier；05 对应 item 默认与摘要；06 对应规格完整覆盖；07 对应 option add-only。 |
| 计数自证 | IA-ID 共 7 个；typed problem 映射共 15 个；读边界共 2 条；三层责任共 8 个约束族。 |

## 6 · 完成判定

```text
IA_DIMENSIONS=IA-CIPG-01,IA-CIPG-02,IA-CIPG-03,IA-CIPG-04,IA-CIPG-05,IA-CIPG-06,IA-CIPG-07；可见与不可见两组逐项齐全
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=15 mapped
CROSS_CHECK_WITH_DESIGN=PASS@2026-08-23
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-23
IA_STATUS=DEXTER_ACCEPTED；不构成 implementation authorization
```
