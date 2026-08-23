---
title: 商品库唯一工作区 UI 交互工件
status: ACCEPTED_FOR_IA_DETAIL_COMPLETION
journeyRef: doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md
---

# 交互工件：J-CATUI-001 商品库唯一工作区

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md#journey-j-catui-001
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md
BUSINESS_PROBLEM=用户无法在商品库中稳定区分查找、查看、编辑、配置、批量、复制与治理，禁用表单和叠层使事实难读、任务易丢
BUSINESS_USER_OR_OWNER=总部/门店商品资料维护者、门店店长、后厨、库存员、治理处理人及 catalog/inventory/fulfillment-production owner
CURRENT_TASK=在商品库唯一工作区完成八类任务，并在失败、关闭、刷新或配置绕行后恢复原上下文
SUCCESS_OUTCOME=父商品与每个规格可直接比较；详情纯只读；编辑整单可恢复；配置按复杂度完成；专题任务结果可对账
UI_BEARING=true
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f;ui-ux-pro-max;antd@6.5.0
DEXTER_WIREFRAME_REVIEW=ACCEPTED_FOR_IA_DETAIL_COMPLETION@2026-08-23
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin
```

本工件逐字引用 `doc/platform/frontend-coding-standard.md#3-K` 的七族一致性规范，不复制第二份规则。

<a id="ui-detailed-design-admission"></a>

## 1.1 UI 详设强制声明

### Screen `CATUI-WB` · 商品库工作台

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页
HOST_AND_ENTRY=/operations/:workspaceKey/catalog/store-items 或总部商品库入口；通过商品与服务导航进入
ACTOR=全部商品库 actor
BUSINESS_SCENARIO=用户需要先缩小范围、比较父商品与规格，再选择下一任务
BUSINESS_GOAL=不离开商品库页面完成查找、比较与所有第一层任务发起
USER_VISIBLE_COPY=树表视图；仅表格；商品元数据；从品牌复制；新建商品；当前结果域：〈当前树节点或视图〉；在当前结果域搜索：编码/名称/短名；状态；来源；重置；生产标签；商品形态；价格和单位；规格或选项；商品属性；制作信息；库存与 BOM；更新时间；已选择 N 项；批量操作；继续编辑〈商品名〉；当前条件下还没有商品
TECHNICAL_BOUNDARY=U-CATUI-06 冻结顶部工具区和结果域筛选区；范围、父列表分页、hasSkuChildren、categoryPathLabels、规格懒加载、actionAvailability、十列结构化摘要与批量父行选择均由 contract/owner；生产标签筛选使用专用单值 query；规格子行不改变父结果分母；不存在列显隐偏好
FOUNDATION_PRIMITIVE=adminListState,useCursorStack,CursorPagination,useRefreshVersion,testId,EllipsisTooltip,NameCodeText,useOverlayLock
CONTAINER_LAYOUT=工作台占内容区满宽；顶部工具区与右侧结果域筛选区保持当前两段 Card 结构、控件顺序和相对位置；左树 240px 可收起，间距 16px，右表 min-width 0；页面不得横向溢出，表格是唯一横向滚动区；树与表为并列滚动区而非嵌套滚动祖先；商品列固定左侧；父子行共享表头；十个业务列全部常显且不为避免横向滚动压缩
```

### 1.2 `CATUI-WB` 列与单元格视觉正本

本节以 V4 的“父商品/规格同表、身份列固定、父行选择、展开后懒加载”为可复用基线，但不复制 V4 的技术列、
风险文案、原始 `SKU` 术语或额外 range 滚动条。V2S 使用 Ant Design 6.5.0 `Table` 的 `scroll.x`、fixed column、
`sticky`、`childrenColumnName` 与受控展开；横向滚动是预期行为，不是需要通过删列解决的异常。

| 列 | 父商品单元格 | 规格单元格 | 视觉规则 |
| --- | --- | --- | --- |
| 商品 | 严格四行：商品名、商品编码、完整分类路径、最多 2 个商品标签 + `+N` | 严格两行：规格名、规格编码 | 360px、固定左侧；名称 14px/600/链接色，编码与分类 12px/次级色；名称不带编码；每个省略项均有 `EllipsisTooltip` |
| 商品形态 | 业务形态名称 | “规格”；默认规格下一行显示中性 Tag | 176px；不出现内部 key、粒度或 `SKU` |
| 价格和单位 | 价格/“未设置”；逐行“销售单位：X”“基础计量：Y” | 规格价格/“未设置”；逐行显示生效销售单位与基础计量单位 | 208px；多种单位逐项标类型；无销售单位合法；盘点单位不在此列 |
| 规格或选项 | 按规格商品逐行列维度与可选值；非规格商品逐行列实际点单选项及值 | 每行“规格名称：规格值” | 280px；不使用“共 N 个”替代内容；最多四行，第四行可显示“还有 N 项” |
| 商品属性 | 每行“属性名：业务值” | 本规格有效属性；没有规格专属值时“同商品” | 240px；不显示内部键；最多四行 |
| 制作信息 | 单一生产标签、制作单显示名称、预计制作时长、说明摘要；按规格内容不同时说明“各规格制作内容不同” | 同一商品生产标签 + 本规格有效名称/时长/说明 | 220px；生产标签最多一个；无内容中性“未设置”；不显示 profile/source/override |
| 库存与 BOM | 不参与库存、直接扣当前商品、按用料扣减 · N 项或各规格分别设置 | 该规格方式；可补消费单位或 N 项用料 | 240px；不得显示 target、ref、库存对象数量或技术 code |
| 更新时间 | 商品自身 `YYYY-MM-DD HH:mm` | 规格自身时间；缺失为 `—`，不猜父值 | 176px；Tooltip 补秒与时区；父排序只作用父列表 |
| 状态 | 中文商品状态 Tag | 中文规格状态 Tag | 112px；状态不只靠颜色；不显示 raw enum |
| 来源 | 自主维护、从品牌复制、外部临时等业务来源 | 灰色“同商品” | 160px、默认常显；只显示业务来源 |

表头高 44px；父行与规格行的内容高度都以最多四行文字为上限，并用极浅底色、层级引导线和缩进表达从属，不用更小字号。
选择列与展开列各 40px 且固定左侧：规格行的选择位为空白占位，无规格父行不显示展开入口。加载、失败、重新加载、
加载更多各是一条规格行，只在商品列显示文案/动作，其它单元格留空，列宽不变。

表格按十列最小宽度求 `scroll.x`，不把列压入视口；商品列固定，表头与表体同步，使用 Ant Design 原生/sticky
横向滚动条。窄屏仍是同一张树形表，不转卡片、不删除业务列、不增加 V4 那种第二条 range 滚动控件。用户滚动后
打开再关闭查看抽屉，应恢复原横向与纵向位置、展开状态和触发焦点。

标准价是可选商品资料，不是商品完整性指标：商品与规格都允许不设置，空值使用与其它普通空资料一致的中性
“未设置”，不出现红色、告警图标、缺失数量或动作阻断。菜单项进入销售时必须有价，但该规则只在菜单/销售集合
任务中出现并由对应 owner 复核；商品库不得提前把无价商品解释成不可用。

目录树在“商品标签”同层增加一级“生产标签”，二级为全部生产标签及父商品去重计数。启用与停用标签都可筛选
既有绑定；停用项附“已停用”文本。选择生产标签进入父列表 query identity，展开后仍显示父商品全部规格。

商品编辑中的“生产标签”是可清空单选；它属于商品，不出现在规格覆盖或点单选项制作变化中。规格只可单独设置
制作单显示名称、预计制作时长和制作说明；选项只可增加非负时长、追加说明。本期不显示或暗示生产路由状态。

### Screen `CATUI-CATEGORY` · 分类原子任务

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-WB 目录树节点的“更多”→新建下级/改名/移动/删除
ACTOR=总部或门店商品资料维护者
BUSINESS_SCENARIO=用户在当前树上下文维护分类结构
BUSINESS_GOAL=以最少输入完成分类动作，并在移动/删除前理解影响
USER_VISIBLE_COPY=新建分类；编辑分类名称；移动分类；删除分类；分类名称；分类编码；上级分类；当前路径；受影响子分类 N 个；受影响商品 N 个；取消；新建/保存/移动/删除
TECHNICAL_BOUNDARY=上级分类使用 owner-returned 单选树形候选；可移动父级、当前节点及后代不可选原因、排序、引用计数、版本与删除准入由 catalog owner
FOUNDATION_PRIMITIVE=useSubmissionLifecycle,testId,useOverlayLock,NameCodeText
CONTAINER_LAYOUT=输入 Modal 小档 480px；移动 Modal 中档 720px；正文单一滚动，页脚右下固定；确认面不嵌表单
```

### Screen `CATUI-BATCH` · 批量任务

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-WB 选择一个或多个商品父行后点击“批量操作”
ACTOR=总部或门店商品资料维护者、门店店长
BUSINESS_SCENARIO=用户要对当前选择集执行同一种整理动作
BUSINESS_GOAL=提交前看清对象与影响，提交中知道进度，提交后逐项知道成功与失败
USER_VISIBLE_COPY=批量改分类；批量改标签；批量改状态；批量归档；已选择 N 个商品；目标分类；分类路径；目标标签；目标状态；正在处理 N/M；成功 N 项；失败 M 项；商品；结果；原因；结果已保存，列表暂未更新；重新加载；关闭
TECHNICAL_BOUNDARY=目标分类使用 owner-returned 单选树形候选；分类单值、标签多值、逐项尽力 receipt、失败 code 与事实未变由 owner/contract
FOUNDATION_PRIMITIVE=useSubmissionLifecycle,useRefreshVersion,testId,useOverlayLock,NameCodeText
CONTAINER_LAYOUT=中档 720px；结果超过 8 行时只有结果表 body 滚动，摘要与页脚固定；提交中 X/Esc/遮罩不可关闭
```

### Screen `CATUI-VIEW` · 商品查看抽屉

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=CATUI-WB 点击商品父行名称，或点击规格子行名称后定位规格区段
ACTOR=全部商品库 actor，重点是后厨/出品、库存员与店长
BUSINESS_SCENARIO=用户只想回答商品是什么、怎么做、怎样扣库存、被谁使用
BUSINESS_GOAL=用业务陈述快速读完当前事实，不进入编辑器
USER_VISIBLE_COPY=〈商品名〉 · 查看商品；编辑商品；更多；商品概览；规格与价格；条码与标识；点单选项；商品属性；制作信息；库存扣减与用料；套餐内容；引用关系；还没有 X；在编辑中维护；重新加载
TECHNICAL_BOUNDARY=详情 typed readback、有效制作合成、库存摘要、引用计数和动作可用性来自 owner；详情 DOM 零 Form/disabled input
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,adminWideDetailDescriptionsProps,useDetailDrawer,useRefreshVersion,testId,NameCodeText,EllipsisTooltip,useOverlayLock
CONTAINER_LAYOUT=超宽 Drawer 使用 adminWideDrawerSurfaceProps；header/动作区/footer 不出视口，body 是唯一纵向滚动；概览四块在 >=768px 两列，窄屏单列；关闭后焦点回父行/规格行触发点
```

### Screen `CATUI-IMAGE` · 商品图片预览

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-VIEW 媒体区点击图片
ACTOR=查看商品的任意用户
BUSINESS_SCENARIO=用户需要辨认主图或查看图片细节
BUSINESS_GOAL=在不离开详情上下文的情况下查看当前图片
USER_VISIBLE_COPY=〈商品名〉 · 查看图片；第 N 张/共 M 张；图片不可用；重试；关闭
TECHNICAL_BOUNDARY=资产 URL、加载失败与主图身份来自 asset readback，不显示对象存储地址
FOUNDATION_PRIMITIVE=testId,useOverlayLock
CONTAINER_LAYOUT=宽档 960px，图片区域最大高度 calc(100vh - 180px) 且自身不产生页面滚动；关闭回到原缩略图
```

### Screen `CATUI-LIFECYCLE` · 生命周期与危险确认

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-VIEW header“更多”中的启用/停用/归档/作废并重建
ACTOR=有相应动作能力的商品资料维护者或店长
BUSINESS_SCENARIO=用户要改变当前商品生命周期或用新身份替代受保护事实
BUSINESS_GOAL=确认对象、动作、影响和不可恢复部分后再提交
USER_VISIBLE_COPY=停用〈商品名〉；启用〈商品名〉；归档〈商品名〉；〈商品名〉 · 作废并重建；当前影响；不可恢复部分；取消；停用/启用/归档/作废并重建
TECHNICAL_BOUNDARY=最新版本、引用、状态和动作准入由 owner 在提交事务内重验
FOUNDATION_PRIMITIVE=useSubmissionLifecycle,testId,useOverlayLock,NameCodeText
CONTAINER_LAYOUT=普通确认 480px，危险确认 720px；无表单；页脚右下；失败原位显示且保留 Modal
```

### Screen `CATUI-CREATE` · 新建商品

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-WB 主按钮“新建商品”
ACTOR=总部或门店商品资料维护者
BUSINESS_SCENARIO=用户要建立最小商品身份，再继续完善
BUSINESS_GOAL=用最少必填事实原子创建草稿，成功后进入编辑抽屉
USER_VISIBLE_COPY=新建商品；商品名称；商品编码；商品类型；商品分类；分类路径；取消；新建并继续完善；商品未新建，请修改标出的内容后重试
TECHNICAL_BOUNDARY=商品分类使用 owner-returned 单选树形候选；类型闭集、编码规则、范围、默认状态、idempotency 与 owner 最终校验来自 contract/owner
FOUNDATION_PRIMITIVE=useSubmissionLifecycle,testId,useOverlayLock
CONTAINER_LAYOUT=中档 720px；vertical Form，中宽字段；无内部滚动；提交中三径不可关闭
```

### Screen `CATUI-EDIT` · 超宽商品编辑抽屉

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=CATUI-VIEW“编辑商品”、CATUI-CREATE 成功、CATUI-WB“继续编辑〈商品名〉”
ACTOR=总部/门店商品资料维护者、门店库存维护者
BUSINESS_SCENARIO=用户跨多个适用事实族修改一个商品并整单保存
BUSINESS_GOAL=随时知道当前区段、未保存区段、错误区段和保存结果；关闭/刷新/配置绕行后能恢复
USER_VISIBLE_COPY=〈商品名〉 · 编辑商品；基础资料；条码与标识；规格与价格；点单选项；商品属性；制作信息；库存扣减与用料；套餐内容；引用关系；未保存；有错误；取消；保存商品；维护商品共用设置；检测到未保存草稿
TECHNICAL_BOUNDARY=shape admission、字段可改性、latest detail、expectedVersion、whole-save 与 typed problems；UI 不分区提交、不猜准入
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,useRefreshVersion,testId,useOverlayLock,useCursorCandidates,NameCodeText,EllipsisTooltip
CONTAINER_LAYOUT=超宽 Drawer 使用 adminWideDrawerSurfaceProps；header 和 sticky footer 固定，body 内左锚点 184px、右内容 min-width 0；右内容是唯一纵向滚动；scroll-padding-bottom 避免 footer 遮住焦点；窄屏锚点折叠为顶部下拉但不新增滚动祖先
```

### Screen `CATUI-RESTORE` · 草稿恢复

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=打开 CATUI-EDIT 时命中同商品编码+原版本的 sessionStorage 草稿
ACTOR=商品编辑者
BUSINESS_SCENARIO=上次编辑因刷新、意外关闭或配置绕行中断
BUSINESS_GOAL=明确选择恢复原任务或放弃草稿
USER_VISIBLE_COPY=检测到〈商品名〉的未保存内容；上次停留在“〈区段〉”；放弃未保存内容；恢复编辑
TECHNICAL_BOUNDARY=草稿键、原版本、区段 dirty/error 与过期判定由 draft owner；不把 sessionStorage 当服务端事实
FOUNDATION_PRIMITIVE=testId,useOverlayLock
CONTAINER_LAYOUT=小档 480px；无表单、无滚动；主动作“恢复编辑”最右；关闭等同保留草稿并退出编辑
```

### Screen `CATUI-DIRTY` · 放弃修改确认

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-EDIT 或配置原子 Modal 通过 X/Esc/遮罩/取消关闭且 dirty=true
ACTOR=当前编辑者
BUSINESS_SCENARIO=用户可能意外离开未保存任务
BUSINESS_GOAL=继续编辑或明确放弃，三条关闭路径结果一致
USER_VISIBLE_COPY=还有未保存的修改；继续编辑；放弃修改
TECHNICAL_BOUNDARY=dirty 只来自 draft 与表单生命周期，不比较序列化 payload 猜测
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,testId,useOverlayLock
CONTAINER_LAYOUT=小档 480px；无表单；危险次动作“放弃修改”，主动作“继续编辑”
```

### Screen `CATUI-CHILD` · 编辑专注子任务

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-EDIT 的规格行、BOM 组件、套餐组件或选项值物料入口
ACTOR=当前商品编辑者
BUSINESS_SCENARIO=用户需要在一个事实族内完成超出行内编辑的信息或候选选择
BUSINESS_GOAL=在一个子任务面内完成目标、候选、选择和确认，不再叠选择 Drawer
USER_VISIBLE_COPY=〈规格名〉 · 编辑规格；选择用料；选择套餐商品；设置选项用料；搜索名称或编码；已选择 N 项；加载更多；取消；应用到商品草稿
TECHNICAL_BOUNDARY=有限/搜索候选二形态、候选 scope、状态、单位与 typed draft mapping；应用只改前端整单草稿，不调用分区保存
FOUNDATION_PRIMITIVE=useCursorCandidates,useSubmissionLifecycle,testId,useOverlayLock,NameCodeText,EllipsisTooltip
CONTAINER_LAYOUT=宽档 960px；目标摘要和页脚固定，body 唯一滚动；搜索结果与已选摘要同面，不开第二 Drawer；第三层只允许 confirm
```

### Screen `CATUI-CONFIG` · 商品配置抽屉

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=CATUI-WB“商品元数据”，或 CATUI-EDIT 配置绕行关闭编辑后打开
ACTOR=总部或门店商品资料维护者
BUSINESS_SCENARIO=用户维护六类被商品复用的配置事实
BUSINESS_GOAL=按简单、父子、复杂三种形态完成配置，不离开工作台、不叠 Drawer
USER_VISIBLE_COPY=商品元数据；维护商品共用的标签、单位、规格、生产标签、属性和点单选项；商品标签；计量单位；规格维度；生产标签；商品属性；点单选项；搜索名称或编码；正在使用；新建；编辑；启用；停用；删除；返回列表；还没有 X
TECHNICAL_BOUNDARY=各 owner 列表、引用状态、更新准入与 typed problem；六库同壳不合并 owner
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,useCursorCandidates,useRefreshVersion,useSubmissionLifecycle,testId,useOverlayLock,NameCodeText,EllipsisTooltip,adminListState
CONTAINER_LAYOUT=超宽 Drawer 使用 adminWideDrawerSurfaceProps；左导航 184px 固定，右栏唯一纵向滚动；简单列表、父子两列、复杂同栏切换均在右栏内；配置 Drawer 上禁止任何 Drawer
```

### Screen `CATUI-CONFIG-ATOM` · 配置原子输入/确认

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-CONFIG 的简单字典、规格维度和值的“新建/编辑/启用/停用/删除”
ACTOR=商品配置维护者
BUSINESS_SCENARIO=用户只需填写少量事实或确认一个状态动作
BUSINESS_GOAL=以与内容匹配的输入面完成任务，关闭后回到原库原行
USER_VISIBLE_COPY=新建 X；〈对象名〉 · 编辑 X；名称；编码；类别；精度；取消；新建/保存/启用/停用/删除；正在使用，不能删除
TECHNICAL_BOUNDARY=不可改字段、引用状态、单位精度/维度与 owner 最终校验
FOUNDATION_PRIMITIVE=useSubmissionLifecycle,useDrawerFormLifecycle,testId,useOverlayLock
CONTAINER_LAYOUT=少字段 480px，复杂选择 720px；vertical Form；无双滚动；关闭焦点回原行操作
```

### Screen `CATUI-COPY` · 复制向导抽屉

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=CATUI-WB“从品牌复制”或 CATUI-VIEW“更多→复制其他商品设置”
ACTOR=门店商品资料维护者
BUSINESS_SCENARIO=用户要从品牌建立门店独立商品，或用来源商品覆盖当前商品的选定设置
BUSINESS_GOAL=在执行前持续看见来源、目标、范围和冲突，在执行后逐项对账
USER_VISIBLE_COPY=从品牌复制到门店；复制其他商品设置；来源商品；当前目标；选择商品；选择复制内容；检查影响；差异与冲突；确认复制；成功 N 项；失败 M 项；上一步；下一步；复制；完成
TECHNICAL_BOUNDARY=两个 variant 的候选、preflight token、覆盖范围、逐项结果与 actionAvailability 由 contract/owner；总部变化不自动同步
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,useCursorCandidates,useSubmissionLifecycle,useRefreshVersion,testId,useOverlayLock,NameCodeText
CONTAINER_LAYOUT=超宽 Drawer；步骤条/header/footer 固定，body 唯一滚动；候选、影响检查和结果各自稳定占位；关闭 dirty 向导需确认
```

### Screen `CATUI-GOVERNANCE` · 外部临时商品治理

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CATUI-VIEW 的外部临时商品下一步动作
ACTOR=治理处理人
BUSINESS_SCENARIO=临时商品缺少正式资料，需要先检查是否可转正，再补全并确认
BUSINESS_GOAL=先看缺口和阻断，再补全最少事实，成功后读回正式商品
USER_VISIBLE_COPY=〈商品名〉 · 转为正式商品；待补资料；检查是否可以转为正式商品；商品名称；商品编码；商品类型；重新检查；确认转正；商品尚未转正，请按提示补全或处理阻止项
TECHNICAL_BOUNDARY=来源快照、编码可用性、类型映射、版本和 promotion command 由 catalog owner；不改历史快照
FOUNDATION_PRIMITIVE=useSubmissionLifecycle,testId,useOverlayLock,NameCodeText
CONTAINER_LAYOUT=宽档 960px；缺口摘要固定，补全表单 body 唯一滚动，footer 固定；第三层只允许转正确认
```

### 1.1.1 Surface ownership 自检

| screen id | 声明 UI_SURFACE | 可见元素分母 | 属于当前 surface | 文案均有位置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `CATUI-WB` | 内容页 | 范围/树/筛选/父子表/分页/入口 | 是 | 是 | PASS |
| `CATUI-CATEGORY` | Modal | 分类字段/影响摘要/按钮 | 是 | 是 | PASS |
| `CATUI-BATCH` | Modal | 摘要/输入/进度/逐项结果 | 是 | 是 | PASS |
| `CATUI-VIEW` | Drawer | header/概览/九区段/动作 | 是 | 是 | PASS |
| `CATUI-IMAGE` | Modal | 图片/序号/失败/关闭 | 是 | 是 | PASS |
| `CATUI-LIFECYCLE` | Modal | 对象/影响/确认 | 是 | 是 | PASS |
| `CATUI-CREATE` | Modal | 最小身份/按钮/错误 | 是 | 是 | PASS |
| `CATUI-EDIT` | Drawer | header/锚点/区段/footer | 是 | 是 | PASS |
| `CATUI-RESTORE` | Modal | 草稿摘要/恢复/放弃 | 是 | 是 | PASS |
| `CATUI-DIRTY` | Modal | 离开后果/继续/放弃 | 是 | 是 | PASS |
| `CATUI-CHILD` | Modal | 目标/搜索/候选/已选/footer | 是 | 是 | PASS |
| `CATUI-CONFIG` | Drawer | 六库导航/三类右栏/动作 | 是 | 是 | PASS |
| `CATUI-CONFIG-ATOM` | Modal | 少量字段或确认 | 是 | 是 | PASS |
| `CATUI-COPY` | Drawer | 步骤/来源/目标/影响检查/结果 | 是 | 是 | PASS |
| `CATUI-GOVERNANCE` | Modal | 缺口/影响检查/补全/确认 | 是 | 是 | PASS |

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 会话与范围成立 | `CATUI-WB` | 查找与比较 | 冻结工具区、目录树、冻结结果域筛选区、父商品/规格子行 | context/navigation/items | 留在工作台 | 保留筛选，原地重试 |
| 2 | 父行有规格 | `CATUI-WB` | 查看每个规格 | 展开父行，每 SKU 一行 | lazy SKU row page | 同表展开 | 错误子行重试，不影响其它行 |
| 3 | 点击父/规格名称 | `CATUI-VIEW` | 读商品事实 | 概览与适用区段 | latest detail + cross-owner summary | 关闭回原行；或进入编辑 | 错误 Drawer 保持，重试 |
| 4 | 有创建能力 | `CATUI-CREATE` | 建最小商品 | 名称、编码、类型 | create readback | 关闭 Modal，打开 `CATUI-EDIT` | 不创建半成品，保输入 |
| 5 | 有编辑能力 | `CATUI-EDIT` | 整单编辑 | 区段锚点、dirty/error、保存栏 | latest detail + shape rules | 保存后关闭到 `CATUI-VIEW` | 保草稿；未知先读回 |
| 6 | 有同版本草稿 | `CATUI-RESTORE` | 恢复中断任务 | 草稿对象、原区段 | local draft identity + latest version check | 恢复 `CATUI-EDIT` | 放弃仅清本地草稿 |
| 7 | 区段需专注任务 | `CATUI-CHILD` | 编辑规格/选择组件 | 目标、候选、已选 | owner candidates | 应用到整单草稿 | 保当前选择，原位错误 |
| 8 | 缺复用配置 | `CATUI-EDIT`→`CATUI-CONFIG` | 创建缺少的定义 | 先持久化草稿，配置完成后继续编辑入口 | dictionary readback | 回 `CATUI-WB` 后恢复编辑 | 草稿仍在，配置失败不改草稿 |
| 9 | 维护六库 | `CATUI-CONFIG` | 列表/主从/复杂定义 | 六库左导航、三类右栏 | dictionary/definition owner | 留在原库原行 | 右栏重试，跨库状态不漂移 |
| 10 | 选择父商品 | `CATUI-BATCH` | 批量整理 | 摘要→进度→结果 | per-item receipts | 关闭回刷新列表 | 失败项事实未变，结果保留 |
| 11 | 复制能力成立 | `CATUI-COPY` | 从品牌复制或覆盖设置 | 来源、目标、范围、影响检查、结果 | candidates/preflight/receipt | 回工作台定位结果 | 上一步可改；执行后结果权威 |
| 12 | 临时商品 | `CATUI-GOVERNANCE` | 转正式商品 | 缺口、影响检查、补全 | promotion preflight/readback | 关闭回正式详情 | 历史快照与原商品不变 |

### 2.1 八条 Journey 的连续操作与退出路径

| Journey | 入口与初始焦点 | 用户主动作 | 成功后的可见结果与去向 | 已知失败 | 结果未知/读取失败 | 取消、关闭与焦点归还 |
| --- | --- | --- | --- | --- | --- | --- |
| 查找 | 冻结筛选区；焦点在用户触发的树节点或筛选控件 | 应用筛选/展开父商品 | 原位更新父商品集合；规格在父行下逐行出现 | 失败只占当前结果区或规格子行，保留已确认列表 | 显示“暂时无法加载…/重新加载”，不显示旧范围数据 | 无弹层；清筛选回当前结果域，不改变树选择 |
| 查看 | 商品或规格名称；Drawer 标题 | 阅读/进入“编辑商品” | 关闭回原行；进入编辑时 View 先关闭，焦点交给 Edit 标题 | Drawer 内说明“商品内容暂时无法加载”，保工作台 | 原位重新加载，不跳整页 | X/Esc/遮罩均关闭；焦点回原商品或规格名称 |
| 新建 | “新建商品”；名称字段 | “新建并继续完善” | 原子创建后关闭 Modal，打开同商品 Edit | “商品未新建，请修改标出的内容后重试”；保输入 | “结果正在确认”，读回前不打开编辑 | 取消零写，焦点回“新建商品” |
| 编辑 | View“编辑商品”或“继续编辑”；目标区段标题 | “保存商品” | 权威 readback 成功后清草稿，打开最新 View | 定位字段/行/区段并保草稿 | 显示“结果正在确认”，按同一意图读回 | 四径共用 dirty confirm；放弃后回 View/触发点 |
| 配置 | “商品元数据”或编辑绕行；当前库标题 | 新建/保存/启停/删除对应事实 | 留在原库原行并显示最新事实；绕行时出现“继续编辑” | 当前库原位说明，商品草稿不变 | 重读当前定义，不关闭配置 | 脏定义先确认；关闭回入口或继续编辑入口 |
| 批量 | “批量操作”；摘要标题 | 确认当前批量动作 | 原位展示成功 N/失败 M 与逐项结果 | 失败项说明原因和事实未变，先前成功项保留 | receipt 权威；列表未更新单独提示“重新加载” | 提交前可取消；提交后关闭回批量入口 |
| 复制 | “从品牌复制”或“复制其他商品设置”；来源步骤 | “检查影响”后“复制” | 逐项结果与目标 readback 一致，回工作台定位目标 | 差异与冲突原位列出，目标不变 | 保来源/目标/范围并确认结果，不盲重试 | 执行前可上一步/取消；关闭回原入口 |
| 治理 | View 当前动作；缺口标题 | “检查是否可以转为正式商品”后“确认转正” | 最新正式商品 View | “商品尚未转正”，列阻止项与下一步，原事实不变 | 保已填内容并读回状态 | 取消回同商品 View 和原动作 |

### 2.2 失败与恢复逐字文案基线

下表与 IA §6 的 46 个 typed problem 逐项映射。对象名、字段名和数量可以插值；标题、事实是否改变、下一步
动作与按钮动词不得临场改写。技术 code、raw detail 和 exception 永不显示。

| 失败类 | 标题/正文基线 | 主动作 | 次动作 | 焦点 |
| --- | --- | --- | --- | --- |
| 字段或集合可修正 | 不另起技术标题；字段下显示 IA §6 对应业务原因；“商品尚未保存，其他已填内容已保留。” | 修改后再次保存 | 取消 | 首个错误字段/行 |
| 读取失败 | “暂时无法加载〈内容〉。已确认的其他内容没有改变。” | 重新加载 | 关闭 | 原位重试按钮 |
| 无权限/越范围 | “你目前不能查看或修改这里的商品。原商品内容没有改变。” | 返回当前范围 | 关闭 | 当前范围入口 |
| 版本冲突 | “商品已被其他人更新。你的未保存内容仍在。” | 查看最新内容 | 放弃修改后重开 | 冲突摘要 |
| 结果未知 | “结果正在确认，请不要重复提交。已填内容仍在。” | 查看确认结果 | 关闭后稍后查看 | 结果确认区 |
| 引用阻止删除/作废 | “〈对象〉正在使用，不能〈删除/作废并重建〉。现有内容没有改变。” | 查看影响/停用（适用时） | 取消 | 阻止原因 |
| 复制/治理影响检查未通过 | “还不能继续。请先处理下面的差异或缺少内容；目标商品没有改变。” | 返回修改 | 取消 | 第一条差异/缺口 |
| 批量部分失败 | “已完成 N 项，M 项未完成。已完成项保持生效，未完成项没有改变。” | 只重试未完成项 | 关闭 | 第一条失败行 |
| 业务结果已保存但页面未更新 | “结果已保存，列表暂未更新。” | 重新加载 | 关闭 | 重新加载 |
| 脏关闭 | “还有未保存的修改。放弃后无法恢复本次修改。” | 继续编辑 | 放弃修改 | 继续编辑 |

IA §6 每个 code 必须落入恰好一个失败类，并保留该行更具体的业务原因；若 code 无法落类或需要新的用户语义，
实施必须停机回设计，不得直接展示服务端 detail。

## 3. 静态参照盘点

`catering-all-v2` 与冻结 Heritage 中未检出当前商品工作台的可复用 user-facing source，因此本批不是
carry-over-first 的页面搬运。V4 仅作为只读取证，且 Dexter 明确要求 SKU 列表表达与其一致。

| screen | 对应关系 | Heritage path@SHA-256 | 静态基线 | 差异及原因 |
| --- | --- | --- | --- | --- |
| `CATUI-WB` | `NO_V2_COUNTERPART`；V4 部分参照 | `catering-server-v4 frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemListTable.tsx@bc40a5ddae58a4c4749ab89c45ebecfdd68e1811de5d44eb01e7e1731ee3add8` | 本工件线框 1；V4 tree Table 是 SKU 表达基线 | 保留父/子同表、懒加载、父行选择；删除 V4 旧菜单/风险/技术字段 |
| `CATUI-VIEW` | `NO_V2_COUNTERPART` | `NOT_APPLICABLE_NO_HERITAGE_COUNTERPART` | 本工件线框 1 | 从当前 V2S 反例重画纯只读详情 |
| `CATUI-EDIT` | `NO_V2_COUNTERPART` | `NOT_APPLICABLE_NO_HERITAGE_COUNTERPART` | 本工件线框 2 | Dexter 裁定抽屉里的工作区，放弃独立路由 |
| `CATUI-CONFIG` | `NO_V2_COUNTERPART` | `NOT_APPLICABLE_NO_HERITAGE_COUNTERPART` | 本工件线框 3 | Dexter 裁定工作台内配置 Drawer，按三种复杂度重画 |
| `CATUI-BATCH`/`CATUI-COPY` | `PARTIAL_COUNTERPART` 仅流程证据 | `NOT_APPLICABLE_NO_HERITAGE_COUNTERPART` | 本工件线框 4 | 保留“检查影响后再确认”的心智，统一三态和逐项结果 |

## 4. 低保真线框

五张图都是可审阅的设计工件，不是实现截图，也不授权把 SVG 复制进应用代码。

| 线框 | 覆盖范围 | 文件 |
| --- | --- | --- |
| 1 | 工作台、目录树、父商品/规格子行同表、纯只读查看抽屉 | `doc/plans/platform/wireframes/2026-08-23-catalog-library-workbench-and-view.svg` |
| 2 | 超宽编辑抽屉、区段锚点、错误/脏标记、常驻保存栏、规格子任务面 | `doc/plans/platform/wireframes/2026-08-23-catalog-library-edit-drawer.svg` |
| 3 | 配置抽屉、六库导航、简单列表、主从两列、复杂定义同栏切换 | `doc/plans/platform/wireframes/2026-08-23-catalog-library-config-drawer.svg` |
| 4 | 批量提交前/中/后与逐项结果、复制向导与影响检查 | `doc/plans/platform/wireframes/2026-08-23-catalog-library-batch-copy.svg` |
| 5 | 新建、编辑、批量移动和分类挪父共用的商品分类树形选择器 | `doc/plans/platform/wireframes/2026-08-23-catalog-category-tree-select.svg` |

线框中的示例商品、规格、分类、标签、价格和库存扣减文案均来自当前 seed/已确认业务语料；紫色“设计注释”
只解释替代状态，不是用户界面文案。第一张图同时作为 `U-CATUI-05` 与 `U-CATUI-06` 的视觉判据：
顶部工具区和结果域筛选区保持现状；其下父商品是父行，每个 SKU 是共享同一表头的独立子行，
不再使用 `expandedRowRender` 放置一整块文本。第五张图是 `U-CATUI-07` 的视觉判据：四类分类赋值任务
使用同一单选树形选择器，不存在平铺分类下拉。

### 4.1 表单控件依赖图

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 工作台范围 | 只读范围摘要 | session/context readback | 有有效会话与已选管理范围 | 范围变化清空父页、展开、选择和旧候选 | 仅当前授权范围 | 范围无效显示下一步，不伪装空表 | 每次 read/command 均复核范围 |
| 搜索商品名称、编码或规格 | 包含文本 Input，防抖提交 | 用户输入 | 范围成立 | 改变后回父商品第一页并清失效展开 | 不把 UUID/内部 ref 作为搜索词 | 原列表保留到新结果确认；失败可重试 | list owner 按同一谓词计算 items/total |
| 状态/来源/目录树 | 固定 Select + 树节点 | 冻结状态词表 + navigation owner | 范围与品牌成立 | 任一改变取消旧请求、回第一页、清选择 | 规格子行不成为筛选分母 | 当前筛选无结果显示业务空态 | list owner 复核 scope/filter |
| 生产标签树筛选 | “生产标签”一级节点 + 标签二级节点 | navigation 的 `productionTags` | 范围与品牌成立 | 选择标签以专用参数重取父页，清游标/选择/失效展开 | 启用与停用标签都可筛选既有绑定；计数按父商品去重 | 空标签仍显示 0；读取失败只占树区 | list owner 复核 `productionTagRef`，不得复用商品标签参数 |
| 商品分类路径 | 商品列第三行灰色副信息 | 父商品页 `categoryPathLabels` | 父列表行已确认 | 随新的 list `currentData` 更新 | 按 owner 顺序显示完整路径；空分类显示“未分类” | 路径缺失视为 contract/readback 缺陷，不从可见树猜 | list owner 按 scope/category 计算 |
| 新建商品名称/编码/类型 | Input/Input/有限候选 | 用户输入 + shape manifest | 有创建能力 | 类型变化裁剪后续编辑区段；新建面只收最小身份 | 名称、编码规则、类型闭集来自 contract | 创建失败原位显示，不制造半成品 | create owner 复核唯一性、范围与类型 |
| 新建商品分类 | searchable single TreeSelect | catalog category hierarchy task read | 当前范围成立 | 范围变化清空并重取；选择不清其它身份字段 | 显示完整路径；是否可选由 owner 返回 | loading 保字段；空树解释；失败原位重试 | create owner 复核 scope/category |
| 编辑商品分类 | searchable single TreeSelect | latest detail + category hierarchy task read | 商品可编辑、当前范围与版本成立 | 范围/上游事实变化清失效选择并标 dirty | 单值；显示当前完整路径与 unknown-old 边界 | 失败保草稿旧值，不退平铺列表 | whole-save owner 复核 scope/category/version |
| 分类挪父的上级分类 | searchable single TreeSelect | category hierarchy task read | 当前分类与影响摘要已读取 | 当前分类变化重取树；旧目标清空 | 当前节点及后代不可选并显示原因 | 失败保当前树和输入，可重试 | move owner 拒绝自环/后代环/越范围/版本漂移 |
| 编辑区段字段 | 分区表单，按事实选择控件 | latest detail + owner candidates | 商品类型、粒度、动作能力与版本成立 | 上游变化只清理该区段已失效下游，标 dirty/error | 不显示不适用区段；不可改事实用文本展示 | 区段候选失败不清其它草稿 | whole-save owner 复核整单不变量 |
| 商品生产标签 | 可清空单选搜索 Select | production tag cursor；当前绑定与候选合并显示 | 商品制作区段适用且可编辑 | 清空只清商品单值；切标签不改规格制作草稿或选项制作变化 | 0..1；停用既有值可见但不能新选 | 候选失败保当前绑定与其它草稿 | whole-save/production owner 复核单值、scope 与可绑定状态 |
| 规格制作内容 | “使用商品默认/单独设置” + 名称/时长/说明 | 商品制作内容 + 当前规格覆盖 readback | 当前商品按规格管理 | 切回默认清规格覆盖，不清商品生产标签 | 不提供生产标签控件；规格始终显示商品标签 | 失败保当前规格 working copy | whole-save 拒绝规格内任何标签字段 |
| 点单选项制作变化 | 非负时长 + 追加说明 | 当前选项值 effect readback | 该商品与选项值允许制作变化 | 清空一项不影响另一项 | 不提供生产标签增删控件 | 失败保当前选项值 working copy | whole-save 拒绝任何选项标签字段与负时长 |
| 规格/组件/选项值目标 | 子任务 Modal；有限或搜索候选 | 当前草稿 + owner candidate task read | 先定位父商品/当前 SKU/当前选项值 | 切换目标清空不属于新目标的候选与已选草稿 | 只保留有限候选、搜索候选两种形态 | 候选失败留当前已选，可原位重试 | 应用只写草稿，whole-save 再复核 |
| 批量目标分类 | searchable single TreeSelect | catalog category hierarchy task read | 已选择至少一个父商品 | 改动作清空目标；目标改变更新影响摘要 | 恰零或一个分类；显示完整路径 | 候选失败保留已选商品，不退平铺列表 | 每个 item 的 save 重新读取并复核版本/分类 |
| 批量目标标签 | 多值有限/搜索候选 | catalog tag dictionary | 已选择至少一个父商品 | 改动作清空目标；去重并保业务顺序 | 标签多值，不携带分类关系 | 候选失败不清选择 | 每个 item 的 save 复核标签可用性 |
| 批量目标状态 | 固定 Select | action availability + 状态闭集 | 已选择至少一个父商品 | 改动作清空旧目标 | 只显示当前批次中可发起的动作 | 无公共合法动作时解释原因 | batch/逐项 owner 逐项复核 |
| 配置库搜索 | 包含文本 Input | 当前库 owner list read | 选中六库之一 | 切库取消旧查询并清旧库分页，不清左导航 | 只搜名称/编码等已声明字段 | 失败只占右栏，可重试 | list owner 按同谓词计算 total |
| 配置新建/编辑字段 | 小 Modal 或右栏内复杂编辑 | dictionary/definition latest readback | 当前库与动作可用性成立 | 类型/选择方式变化只清其从属动态集合 | 编码、维度、精度等由各 owner 约束 | 失败保输入；冲突重读当前对象 | 对应 dictionary/definition owner 复核 |
| 复制来源/目标 | 搜索候选 | local/brand copy candidate reads | 先选复制类型和当前范围 | 来源/目标变化清空 preflight、范围选择与旧结果 | 不允许来源等于目标；只列合法候选 | 候选失败保留已选类型 | preflight 与 execute 均复核当前事实 |
| 复制内容范围 | Checkbox 组 | preflight 可复制分区 | 来源和目标均已选 | 改范围立即使旧 preflight 失效 | 至少一项；不可复制项显示原因 | 无可复制项则不能继续 | execute 用 preflight token 并重验 |
| 临时商品补全字段 | 最小补全表单 | promotion preflight gaps | 仅外部临时商品且有转正能力 | 补全后必须重新检查 | 只显示 owner 影响检查点名的业务缺口 | 失败保输入和来源摘要 | execute 复核来源、编码、类型与版本 |

主从动态集合统一规则：规格维度→可选值、点单选项→选项值→关联物料、商品规格→属性组合均必须先选中
一个明确主项；从属区只显示当前主项的数据。切主项时切换从属集合，不混排；空、已有、待删除三态互斥；
商品编辑内的子任务只“应用到整单草稿”，配置库复杂定义按其现有 owner command 保存，二者不得混用。

### 4.2 新建、编辑与确认 mutation 的字段事实矩阵

`FORM_MUTATION_DENOMINATOR=CURRENT_COMMAND_VARIANTS_33`。当前 33 个真实 command variant 是 item
management 8、dictionary/category management 18、copy 4、production tag management 3。父商品下规格摘要懒读取是 task-read GAP，
不混入 mutation 分母。批量分类/标签继续逐项调用 `saveOperationsCatalogItem`，每项展示该 command 的真实
response/problem；UI 可以汇总展示 N/M，但不得猜测单项结果，也不因此新造第二个 batch command。

| # | command variant | 事实族 / surface |
| --- | --- | --- |
| 1 | `createOperationsCatalogItem` | 新建商品 |
| 2 | `saveOperationsCatalogItem` | 整单编辑；批量分类/标签逐项保存 |
| 3 | `transitionOperationsCatalogItemStatus` | 单商品生命周期 |
| 4 | `preflightOperationsTemporaryCatalogItemPromotion` | 临时商品转正影响检查 |
| 5 | `executeOperationsTemporaryCatalogItemPromotion` | 临时商品转正执行 |
| 6 | `stageOperationsCatalogAsset` | 图片暂存 |
| 7 | `releaseOperationsCatalogStagedAsset` | 图片取消/清理暂存 |
| 8 | `batchTransitionOperationsCatalogItemStatus` | 批量状态/归档 |
| 9 | `createOperationsCatalogCategory` | 新建分类 |
| 10 | `updateOperationsCatalogCategory` | 编辑分类 |
| 11 | `deleteOperationsCatalogCategory` | 删除分类 |
| 12 | `moveOperationsCatalogCategory` | 移动分类 |
| 13 | `createOperationsCatalogDictionaryEntry` | 新建标签/销售属性/处理标签条目 |
| 14 | `updateOperationsCatalogDictionaryEntry` | 编辑字典条目 |
| 15 | `reorderOperationsCatalogDictionaryEntry` | 排序字典条目 |
| 16 | `transitionOperationsCatalogDictionaryEntryStatus` | 启停字典条目 |
| 17 | `createOperationsCatalogAttributeDefinition` | 新建商品属性 |
| 18 | `updateOperationsCatalogAttributeDefinition` | 编辑商品属性 |
| 19 | `deleteOperationsCatalogAttributeDefinition` | 删除商品属性 |
| 20 | `createOperationsCatalogOrderOptionDefinition` | 新建点单选项 |
| 21 | `updateOperationsCatalogOrderOptionDefinition` | 编辑点单选项 |
| 22 | `deleteOperationsCatalogOrderOptionDefinition` | 删除点单选项 |
| 23 | `createOperationsCatalogUnit` | 新建计量单位 |
| 24 | `updateOperationsCatalogUnit` | 编辑计量单位 |
| 25 | `disableOperationsCatalogUnit` | 停用计量单位 |
| 26 | `deleteOperationsCatalogUnit` | 删除计量单位 |
| 27 | `preflightOperationsLocalCatalogCopy` | 本地复制影响检查 |
| 28 | `executeOperationsLocalCatalogCopy` | 本地复制执行 |
| 29 | `preflightOperationsBrandCatalogCopy` | 从品牌复制影响检查 |
| 30 | `executeOperationsBrandCatalogCopy` | 从品牌复制执行 |
| 31 | `createOperationsProductionTag` | 新建生产标签 |
| 32 | `updateOperationsProductionTag` | 编辑生产标签 |
| 33 | `transitionOperationsProductionTagStatus` | 启停生产标签 |

| command variant / 业务事实 | 用户可见文案/控件 | 分类 | request 取值与唯一来源 | 变更、级联与校验 | command owner 最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- |
| `createOperationsCatalogItem`：名称/编码/类型/分类 | 新建商品；商品分类树 | `EDITABLE` | 用户输入 + manifest 候选 + category hierarchy candidate | 分类单值且保留层级身份；创建成功才进入编辑 | 范围、唯一性、类型、分类、默认状态 | 留在 Modal；不创建半成品 |
| `saveOperationsCatalogItem`：整单商品 draft | 保存商品；商品分类树 | `EDITABLE` + `HIDDEN_OWNER_FACT` version/scope | draft store + latest detail/session + category hierarchy candidate | 一次提交九类适用事实；分类单值；区段错误聚合 | shape、粒度、分类、引用、版本、跨 owner command | 409 保草稿并给重读；unknown 先读回 |
| `stage/releaseOperationsCatalogStagedAsset`：商品图片 | 上传/移除图片 | `CONDITIONAL_EDITABLE` | 用户文件 + staging receipt | 文件检查通过才入草稿；取消释放 staging | 文件类型/大小/归属与 release token | 失败不改当前图片；释放结果可见 |
| `transitionOperationsCatalogItemStatus` | 启用/停用/归档/作废并重建 | `HIDDEN_OWNER_FACT` object/version/action | 详情动作 + latest readback | 危险动作先显示影响 | 当前状态、引用、版本、能力 | 失败事实不变并重读详情 |
| `batchTransitionOperationsCatalogItemStatus` | 批量改状态/批量归档 | `EDITABLE` target state | 父行选择 + 用户目标 | 逐项尽力；显示进度与 receipt | 每项在自身事务内重验 | 已成功项保留，失败项不伪回滚 |
| `preflight/executeOperationsTemporaryCatalogItemPromotion` | 转为正式商品 | `CONDITIONAL_EDITABLE` | preflight gaps + 用户补全 + token | 任一补全变化使旧 preflight 失效 | 来源、编码、类型、版本 | execute 失败不改历史快照 |
| `create/update/move/deleteOperationsCatalogCategory` | 新建/编辑/移动/删除分类；上级分类树 | `EDITABLE` + hidden version | 当前 owner-returned tree + 用户输入 | 移父显示路径、子分类与商品数；当前节点及后代不可选 | 父级、自环/后代环、排序、引用与版本 | 树不变；原位重试 |
| `create/update/reorder/transitionOperationsCatalogDictionaryEntryStatus` | 新建/编辑/排序/启停字典项 | `EDITABLE` | 当前库 latest readback + 用户输入 | 禁止跨库串值；停用不改既有绑定 | 编码、引用、状态、版本 | 当前库右栏保留，重读该项 |
| `create/update/deleteOperationsCatalogAttributeDefinition` | 新建/编辑/删除商品属性 | `EDITABLE` + hidden definition identity | 用户字段 + latest definition | 填写方式改变处理动态候选 | 引用、类型、候选闭集、版本 | 失败保右栏草稿 |
| `create/update/deleteOperationsCatalogOrderOptionDefinition` | 新建/编辑/删除点单选项 | `EDITABLE` 动态主从集合 | 当前定义 + 用户输入 + material candidates | 选项值归当前组；排序、去重、正负用量 | 选择方式、引用、物料资格、单位、版本 | 失败不拆分保存，仍定位原子项 |
| `create/update/disable/deleteOperationsCatalogUnit` | 新建/编辑/停用/删除计量单位 | `CONDITIONAL_EDITABLE` | 用户输入 + latest unit readback | 被引用后只允许改名称；停用不改既有绑定 | 上限、引用、编码/维度/精度、版本 | typed problem 映射业务文案 |
| `preflight/executeOperationsLocalCatalogCopy` | 从已有商品复制配置 | `EDITABLE` source/target/sections | candidate read + 用户选择 + preflight token | 来源/目标/范围变更令 token 失效 | 目标能力、最新事实、覆盖范围 | 回上一步修正；结果逐项可见 |
| `preflight/executeOperationsBrandCatalogCopy` | 从品牌复制到门店 | `EDITABLE` source/target/sections | brand candidate read + 用户选择 + token | 始终说明门店事实独立 | 当前品牌、目标门店、版本 | 失败不暗示总部自动同步 |
| required UI gap：父商品规格摘要 | 展开/收起 | `GAP` | 需要 catalog task read，不能拿 full detail 代替 | 父页分母不变；按父 ref 懒读 | scope、父子关系、可见字段、cursor | 子区行内失败，不污染父表 |

## 5. 业务驱动的搜索、状态与边界

`SEARCH_CAPABILITY_DENOMINATOR=12`：工作台商品搜索、目录树搜索、配置库搜索、新建商品分类树、编辑商品分类树、
分类挪父目标树、批量分类候选树、批量标签候选、编辑子任务候选、复制本地来源、复制品牌来源、临时商品
预检补全候选。其余 screen 均为
`NOT_APPLICABLE_WITH_REASON`：查看/确认/结果面回答当前对象事实，不应再引入搜索。

| screen / 业务对象 / 用户问题 | 用户可见条件 | 匹配语义与控件 | 值/候选唯一来源 | 级联与重载 | owner 核验 | 排除替代 / contract gap |
| --- | --- | --- | --- | --- | --- | --- |
| `CATUI-WB` / 商品 / 找到要维护的商品 | 名称、编码或规格 | 服务端 contains Input | `getOperationsCatalogItems` query | 改变即回第一页、取消旧请求 | catalog list 同谓词 items/total | 禁止只筛当前页；规格词仍返回父商品 |
| `CATUI-WB` / 导航 / 缩小业务集合 | 分类或标签 | 树内 contains Input | `getOperationsCatalogNavigation` | 切范围清理 | navigation owner | 不把自由文本当分类 ref |
| `CATUI-CONFIG` / 当前库事实 | 名称或编码 | 服务端 contains Input | 各库 list read | 切库取消/重取 | 各 dictionary owner | 当前部分接口若无 query/total，IA 标 GAP |
| `CATUI-CREATE` / 商品分类 | 商品分类 | searchable single TreeSelect，搜索名称/编码并保留祖先路径 | category hierarchy task read | 范围变化清空并重取 | create owner | 禁止平铺 Select；task read 未提供 hierarchy 时标 GAP |
| `CATUI-EDIT` / 商品分类 | 商品分类 | searchable single TreeSelect，显示当前完整路径 | category hierarchy task read + latest detail | 范围变化清空并重取 | whole-save owner | 禁止从 navigation 当前节点猜商品分类 |
| `CATUI-CATEGORY` / 上级分类 | 上级分类 | searchable single TreeSelect | category hierarchy task read | 当前分类变化重取并清旧目标 | category move owner | 当前节点/后代 disabledReason 必须来自 owner |
| `CATUI-BATCH` / 分类 | 目标分类 | searchable single TreeSelect | category hierarchy task read | 动作改变清空 | 每项 save owner | 禁止多选、平铺或用树当前节点猜目标 |
| `CATUI-BATCH` / 标签 | 目标标签 | multi Select | tag dictionary | 去重；动作改变清空 | 每项 save owner | 不把分类 relation 复制进 tag draft |
| `CATUI-CHILD` / 组件或关联对象 | 合法候选 | cursor searchable Select | 统一 candidate protocol 的 owner adapter | 目标/依赖变更清空并取消请求 | whole-save owner | 不得全量预载、客户端过滤或自由字符串 |
| `CATUI-COPY` / 本地来源 | 来源商品 | cursor searchable Select | `getOperationsLocalCatalogCopyCandidates` | 范围变化清空 | copy owner | 不从当前页拼候选 |
| `CATUI-COPY` / 品牌来源 | 品牌商品 | cursor searchable Select | `getOperationsBrandCatalogCopyCandidates` | 品牌/范围变化清空 | copy owner | 不把总部数据当门店事实 |
| `CATUI-GOVERNANCE` / 缺口关联事实 | preflight 指定业务对象 | 有限或 cursor searchable Select | owning candidate task read | preflight 变化清空旧补全 | promotion owner | contract 未提供候选时保持 GAP，不退自由输入 |

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 工作台 list/expand | 保留已确认结果，局部骨架 | query 约束原位 | 不适用 | 原位替换并维护有效展开 | 范围/权限说明 | 保旧结果并可重试 | catalog read 最终权威；SKU 子读不改父分母 |
| 查看详情 | Drawer skeleton | 不适用 | 不适用 | 纯只读区段 | 无写能力只隐藏写入口 | Drawer 内错误/重试 | 跨 owner 只读摘要，不取得写主权 |
| 整单编辑 | latest detail 后建 draft | 区段与字段双层错误 | 保存栏锁定，内容可读 | readback 后清草稿、回详情 | 409 保草稿并定位冲突 | 先读回判断是否已成功 | owner 最终校验；sessionStorage 不是事实库 |
| 配置原子写 | 右栏/Modal 局部 loading | 字段原位 | 只锁当前动作 | readback 后回当前行 | typed problem 原位映射 | 重读当前对象 | 每库 owner 独立，不因同壳合并 |
| 批量 | 摘要可读 | 无合法目标不得提交 | 进度 N/M，不能关闭 | receipt 表 + 列表精确失效 | 逐项失败原因 | receipt 保留，刷新失败另报 | 逐项结果权威，不由 UI 猜 |
| 复制/治理 | 候选和 preflight 分步 | token/缺口失效时回前步 | 当前步骤锁定 | result/readback 后定位对象 | 业务原因可恢复 | 先查结果/readback | copy/promotion owner 最终权威 |

## 6. 逐操作任务合理性

可见操作分母按操作族列全；同一族内每个动态行/业务码使用同一语义与 locator 模板，不以数组 index 造操作。

| 操作 | 批准 Journey 来源 | 用户为何此时操作 | 更短路径与取舍 | 约束归因 | 需 Dexter 再裁决 |
| --- | --- | --- | --- | --- | --- |
| 搜索、树节点、状态、来源、分页 | `J-CATUI-01` | 缩小父商品集合 | 同页完成最快；不加高级搜索页 | product + list contract | 否 |
| 展开/收起父商品 | `J-CATUI-01`/U-CATUI-05 | 逐规格比较 | 同表子行优于文本展开或另页 | Dexter + V4 verified pattern | 否 |
| 点击父商品/规格名称 | `J-CATUI-02` | 查看完整事实或定位规格 | 统一先查看再动作，避免行内动作泛滥 | Journey | 否 |
| 父行勾选/取消、清空选择 | `J-CATUI-06` | 形成批量对象集 | SKU 不属于商品批量 | product | 否 |
| 新建商品 | `J-CATUI-03` | 建立最小身份后继续编辑 | 小 Modal 比空白超宽抽屉认知更低 | Journey | 否 |
| 打开商品元数据 | `J-CATUI-05` | 维护跨商品复用定义 | 工作台内互斥 Drawer，拒绝独立页面 | Dexter | 否 |
| 从品牌复制/从已有商品复制 | `J-CATUI-07` | 分步确认覆盖影响 | Drawer 向导保留上下文；不做一次性大表单 | Journey/owner | 否 |
| 查看抽屉关闭、区段切换、图片预览 | `J-CATUI-02` | 阅读并回到原上下文 | 区段导航优于禁用表单 Tab | Journey | 否 |
| 编辑商品、生命周期动作 | `J-CATUI-04/08` | 从事实进入合法写任务 | 一个主动作，其余按普通/危险分组 | owner action availability | 否 |
| 编辑区段锚点、去商品元数据、继续编辑 | `J-CATUI-04/05` | 定位错误、补定义、恢复草稿 | 绕行关闭第一层 Drawer，遵守互斥 | Dexter | 否 |
| 编辑规格/组件/选项值、应用到草稿 | `J-CATUI-04` | 专注动态集合的一项 | 一层子任务面；不再开选择 Drawer | Dexter + product | 否 |
| 保存商品、取消、关闭、恢复、放弃 | `J-CATUI-04` | 控制整单草稿生命周期 | 常驻保存栏 + 三径脏确认 | frontend standard | 否 |
| 六库切换、库内搜索、新建、编辑、启停、删除、排序 | `J-CATUI-05` | 维护配置事实 | 三种右栏形态覆盖复杂度；无独立详情 | Dexter/owner | 否 |
| 批量动作选择、提交、结果筛选、关闭 | `J-CATUI-06` | 知情执行并理解逐项结果 | 同一 Modal 三态最短且不丢 receipt | product/owner | 否 |
| 复制类型、来源、目标、范围、上一步、继续、执行 | `J-CATUI-07` | 逐步消除覆盖风险 | 不能压成一步，因为 preflight 是必要事实 | owner | 否 |
| 重新检查、确认转正 | `J-CATUI-08` | 补齐临时商品后转正 | 当前对象 Modal 即最短 | owner | 否 |
| 重试/重新读取 | 全 Journey 失败路径 | 从可恢复失败继续 | 原位恢复，禁止整页刷新止血 | observability/owner readback | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation / gap | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| 工作台上下文/导航/父列表 | operations-admin | 商品库读能力 | `getOperationsCatalogWorkbenchContext` / `getOperationsCatalogNavigation` / `getOperationsCatalogItems` | catalog task reads | scope、品牌、过滤与父页 total |
| 规格子行展开 | operations-admin | 父列表可读 | `GAP: lightweight SKU row task read` | catalog SKU read | 父子归属、字段可见性与 cursor |
| 商品查看/编辑 | operations-admin | read / edit capability | `getOperationsCatalogItem` / `saveOperationsCatalogItem` | catalog owner + 同事务目标 owner commands | shape、粒度、版本、引用与整单不变量 |
| 图片 | operations-admin | edit capability | `stageOperationsCatalogAsset` / `releaseOperationsCatalogStagedAsset` | asset/catalog boundary | 文件资格、staging 所有权与 release |
| 生命周期/批量状态 | operations-admin | action availability | `transitionOperationsCatalogItemStatus` / `batchTransitionOperationsCatalogItemStatus` | catalog owner | 每项当前状态、版本和引用 |
| 分类与字典 | operations-admin | configuration capability | catalog category/dictionary operation exact-set | catalog dictionary owners | 引用、状态、排序、版本 |
| 商品属性/点单选项/单位 | operations-admin | configuration capability | attribute/option/unit operation exact-set | 对应 catalog owners | 动态集合、候选资格、单位不变量 |
| 本地/品牌复制 | operations-admin | copy capability | local/brand preflight + execute | catalog copy coordinator | 来源、目标、范围、token 和逐项结果 |
| 临时商品治理 | operations-admin | promotion capability | promotion preflight + execute | catalog owner | 来源快照、编码、类型、版本 |

## 8. Manifest B.4/B.5 命中对照

`NOT_APPLICABLE_WITH_REASON`：AGENTS.md 已明确 compliance-control 与 manifest Part B/C/D 退役；本批不得
恢复旧 B.4/B.5 控制面。前端状态与交互的当前唯一正本是 `doc/platform/frontend-coding-standard.md#3-K`、
本 Journey、正式需求、项目记忆业务语料与真实 foundation exports。本节保留，是为了显式证明“不适用”
而不是漏读模板。

## 9. 高保真静态 demo

`NOT_APPLICABLE_WITH_REASON`：本批没有需要高保真才能裁决的新视觉语言；四张低保真已足以裁决结构、层级、
控件关系和信息密度。视觉 token 与最终组件由 implementation-facing design 对接 Ant Design/foundation，
不能由一次性 SVG 反推。

## 10. Dexter 看图结论

- 看图日期：`2026-08-23`
- 低保真线框结论：`ACCEPTED_FOR_IA_DETAIL_COMPLETION`。Dexter 已确认 IA 的整体交互方向；目录树、顶部操作区、当前结果域与筛选区保持不变，父商品与规格独立行、四类互斥第一层抽屉、超宽编辑抽屉、全高配置抽屉、批量与复制专题形态进入 IA 细化。后续 `U-CATUI-08/09` 又确认库存扣减默认常显，并允许表体横向滚动承载完整列；以本节逐列正本覆盖线框中的简化列宽表达。
- IA 准入：`true`。本次准入要求 IA 必须把每个控件的上游依赖、级联清理、状态唯一住址、状态控制者、消费者、失效与恢复边界逐项写死，实施者不得自行改成交互推断或组件局部镜像。
- 授权边界：仅授权继续 Journey/交互/IA/implementation-facing design 与实施计划工件；不授权契约、代码、测试、DEV、reset、seed、browser L2、UAT 或数据操作。
