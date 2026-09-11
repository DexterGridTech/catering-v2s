---
IA_SCOPE=O2,O4,O5
BUSINESS_SOURCE=doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md
JOURNEY_REFS=doc/decisions/2026-08-19-v2s-business-channel-management-journey.md; doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md
UI_INTERACTION_REF=doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=UNSET
IMPLEMENTATION_AUTHORITY=false
---

# 到店点餐允许外部接入 · IA amendment

## 1. 共用信息架构规则

- 外部 `DINE_IN` 的业务事实是外部 provider 能力，不是内部终端形式；`dineInForm` 必须为空，界面显示“外部系统不使用 POS、扫码或自助机点餐形式”。
- `STORE` 才允许 `EXTERNAL + DINE_IN`；`PROJECT + EXTERNAL + DINE_IN` 返回 `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED`。
- provider 候选按 `DINE_IN` 精确能力读取；不得省略 capability 参数，不得把 TAKEAWAY 候选作为替代。
- O5 的“门店主体经营渠道”是全部门店渠道事实；销售菜单读取是另一个 `usage=SALES_MENU` 任务，只返回 `STORE + INTERNAL + DINE_IN/TAKEAWAY`。外部渠道可以在 O5 看见，但不在销售菜单页出现。
+ 只读详情按业务解释呈现空的外部 `dineInForm`，不得将其显示为“未设置”；不得显示 token、authorization reference、原始 payload 或机器 enum 作为用户文案。
- readback 仍以 machine code 为事实，operations-admin 只使用既有 `collaborationCodeLabels.ts` 的闭集 label map 加 `closedCodeLabel` 转成中文；本批在该既有 map 补齐 `DINE_IN`，不新增 contract displayNames 或第二份 label 字典。

## 2. IA-O2：渠道模板新建/编辑

```text
businessTask=定义项目维护的渠道模板，并为门店外部到店点餐选择真实可用的 DINE_IN provider。
actorAndScenario=项目运营者在项目渠道管理页创建或编辑模板；目标是 STORE 模板时允许门店自有小程序等外部系统承载到店消费。
entryAndSurface=operations-admin 的项目经营渠道管理页打开 BusinessChannelTemplateDrawer；模板编码创建后只读；保存/取消在 Drawer footer。
controlType=四维模板字段按基本信息→经营范围→接入方式→承载配置排列：模板名称、模板编码、经营主体、订单类型、接入类型；INTERNAL+DINE_IN 显示必填到店点餐形式 Select；EXTERNAL 显示 provider Select；EXTERNAL+DINE_IN 显示只读外部系统说明而不显示到店点餐形式控件。
validationAndError=PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED 指向经营主体/接入方式；DINE_IN_FORM_MISMATCH 指向到店点餐形式；BUSINESS_SCOPE_EXCEEDED/PROVIDER_NOT_ENABLED/CATALOG_NOT_FOUND 指向 provider；VERSION_CONFLICT 读取最新模板后要求重新确认；错误保留其它输入。
accessibilityAndTestId=所有实际动作节点使用 businessChannelTemplateTestIds.ts 的唯一键：表单、接入类型选项、经营主体、订单类型及其选项、内部点餐形式及其选项、provider及动态provider选项、空态/错误/重试、保存/取消。Radio、Select option、Button 不使用复合控件锚点。
emptyLoadingErrorStates=provider 加载中显示“正在读取可用的外部接入档案”并禁用选择；空集显示“当前没有可用的外部到店点餐接入档案”并阻断保存；失败显示“外部接入档案读取失败，请重试”及 Retry，保留其它输入；模板列表失败保留上一次结果。
containerBehaviorUnderLoad=Drawer 内容区滚动，footer 始终在视口内；长 provider 名称/编码换行或截断并保留可读提示，不撑宽容器；Select 下拉在 Drawer 视口内滚动；与 UI interaction 的四段顺序和文案逐字一致。
stateAndPermission=[acceptance] 以仅有项目模板编辑能力的项目运营身份读/写当前项目；将 projectRef 或 workspace 替换为同空间另一项目，模板列表、provider 候选、模板详情和保存均不得返回或写入越权数据；owner 在命令事务内再次验证 STORE/PROJECT、scope 和 provider。
navigationAndRefresh=[静态] 保存成功只失效当前项目模板列表及依赖的门店模板候选；不刷新销售菜单或无关项目列表；失败不关闭 Drawer、不清理用户输入；字段变化只清理其下游 stale value。
collectionShapeAndScale=provider 与门店模板候选为 Cursor，服务端按 providerCode/templateRef 推进，前端使用 collectCursorPages 内部收集；预期 provider 数量与项目模板数量均为低频配置集合，增长驱动是 workspace 接入档案/项目模板数量，用户不直接操作 cursor；O2 表单不做客户端分页。
dataSourceAndCascade=模板四维事实来自 business-channel owner；provider 来自 collaboration candidate read，查询 capability 必须等于当前 orderKind；operatorKind/orderKind/accessKind 变化清理 provider、dineInForm 和门店范围等下游值。
forbiddenUI=不得出现外部DINE_IN的POS、QR、KIOSK选择；不得出现“自动创建菜单”开关、SalesMenu capability、外部菜单配置、token、authorizationRef、原始 provider payload；不得把 PROJECT 外部 DINE_IN 伪装成可保存。
```

## 3. IA-O4：经营渠道详情

```text
businessTask=理解一条渠道由谁承载、适用于什么订单类型、是否完成外部接入，以及它是否属于本平台销售菜单范围。
actorAndScenario=项目运营者或门店运营者从项目/门店主体经营渠道表进入，只读读取最新 owner readback。
entryAndSurface=operations-admin 右侧只读详情 Drawer；按身份→承载→状态展示；编辑/绑定动作仍打开独立的既有表单 surface。
controlType=只读业务字段、绑定状态、渠道状态和停用原因；外部DINE_IN显示provider与“外部系统不使用 POS、扫码或自助机点餐形式”；显示“外部渠道不在本平台销售菜单范围内”；不提供手工有效化。
validationAndError=读取失败显示 typed problem；BINDING_NOT_EFFECTIVE 显示未完成接入并引导既有 binding；VERSION_CONFLICT 重新读取；出现敏感字段属于缺陷，不由 UI 修剪继续显示。
accessibilityAndTestId=Drawer标题、关闭、详情内容和既有编辑/绑定动作均有业务可读 label；外部DINE_IN详情内容使用 businessChannelExternalDineInDetail；焦点关闭后回到触发按钮。
emptyLoadingErrorStates=详情加载中不显示旧渠道身份；读取失败保留来源列表并显示 retry；无 binding 显示“未完成接入”，不是空白或“正常”。
containerBehaviorUnderLoad=详情内容区滚动，footer/关闭区不溢出视口；长 provider 名称、停用原因和绑定说明换行；信息块按身份、承载、状态三段纵向对齐。
stateAndPermission=[acceptance] 使用当前项目/门店 scope 读取渠道详情；将 channelRef 替换为同 workspace 另一 owner 节点的 ref 时返回授权拒绝且不泄露详情；详情 owner 再复核 channel target 与 session scope。
navigationAndRefresh=[静态] 关闭详情只恢复来源列表；外部 binding 状态变化后只刷新该渠道详情、来源渠道列表和绑定区；不把外部渠道加入 sales-menu query；编辑失败停留在表单。
collectionShapeAndScale=详情是单实体 Detail 聚合，不分页、不设人为字段上限；关联 binding 是单个可选 owner read，不展开无界 binding 集合；预期每次只读一条渠道及其当前绑定。
dataSourceAndCascade=channel detail 来自 business-channel owner；provider/binding 来自 collaboration read；binding 无效只改变渠道有效状态，不删除渠道；外部DINE_IN永远不产生销售菜单关系。
forbiddenUI=不得显示空外部dineInForm为“未设置”；不得显示POS/QR/KIOSK作为外部形式；不得出现外部菜单编辑入口、内部销售菜单操作、token、authorizationRef或raw payload。
```

## 4. IA-O5：门店经营渠道管理页

```text
businessTask=查看门店可接入的渠道模板，并维护该门店已经创建的全部经营渠道。
actorAndScenario=门店运营者从当前门店数据节点进入；模板候选受项目可见范围与模板有效状态控制，渠道事实读取不按销售菜单资格裁剪。
entryAndSurface=operations-admin 的门店经营渠道管理页；上方“门店可接入经营渠道模板”，下方“门店主体经营渠道”；渠道首列进入 O4 详情；不承载模板CRUD。
controlType=模板候选表显示模板名称/编码/接入类型/订单类型；门店主体经营渠道表显示已有渠道及状态/绑定状态；新建渠道沿用既有 Drawer；不在门店页显示模板可见范围编辑控件。
validationAndError=候选读取失败显示 Alert+Retry并保留旧结果；创建失败按 PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED、BUSINESS_SCOPE_EXCEEDED、BINDING_NOT_EFFECTIVE、VERSION_CONFLICT 等 typed problem 映射；销售菜单不适用不是创建门店渠道的错误。
accessibilityAndTestId=模板候选表使用 storeBusinessChannelTemplateCandidateTable；全部渠道表使用 storeBusinessChannelList；首列详情使用既有 owner-node 稳定 ref testId；表格表头、状态和绑定状态有文字，不只靠颜色。
emptyLoadingErrorStates=模板空态显示“当前门店暂无可选的渠道模板”；全部渠道空态显示“当前门店暂无经营渠道”；两个区域各自加载/失败，失败不清空另一块的已读结果；外部DINE_IN渠道若已创建必须在全部渠道区可读。
containerBehaviorUnderLoad=模板候选和全部渠道在各自表格内容区滚动或按既有 owner bounded read 结果展示；表头与操作区不撑破视口；长名称/编码换行或截断；两个区域不通过客户端 slice 互相替代。
stateAndPermission=[acceptance] 使用门店 scope 读取当前门店的候选模板与全部渠道；请求同项目另一门店的 ref 时四条读路径均返回授权拒绝；候选 owner 验证项目/门店关系与模板可见性，全部渠道 owner 验证 STORE target。
navigationAndRefresh=[静态] 门店渠道创建成功后只刷新全部渠道表；模板候选变化只刷新候选表；销售菜单页面的 SALES_MENU query 保持独立；详情关闭恢复原列表上下文与排序。
collectionShapeAndScale=模板候选为 Cursor，服务端过滤项目、STORE、模板状态和门店可见性，前端仅用 collectCursorPages 收集；全部门店渠道为 Bounded，服务端 business-channel owner 使用固定 BOUNDED_READ_LIMIT，预期规模是单门店配置渠道集合，超过上界必须由 owner typed invariant reject；销售菜单读取仍为 Cursor/固定 page size 20 的独立形态。
dataSourceAndCascade=模板候选来自 business-channel owner 的 project/store visibility read；全部渠道来自 business-channel pageChannels；销售菜单使用 listSalesMenuEligibleChannels；模板可见性或provider状态变化不删除既有渠道，外部DINE_IN仍保留在全部渠道读取。
forbiddenUI=门店经营渠道页不得显示模板可见范围列、范围编辑器、外部菜单编辑入口或POS/QR/KIOSK外部形式；销售菜单页不得因为全部渠道读取而出现外部DINE_IN。
```

## 5. Error mapping

| problem code | HTTP | 业务规则 | 触发面 | 用户处理 |
| --- | ---: | --- | --- | --- |
| `PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED` | 422 | D-02 | O2 模板/渠道创建 | 指向经营主体与接入方式，改为 STORE 或 INTERNAL |
| `DINE_IN_FORM_MISMATCH` | 422 | 外部DINE_IN无内部形式；内部DINE_IN必须有形式；其他订单不得有形式 | O2 | 清理不兼容字段并按条件重新选择 |
| `BUSINESS_SCOPE_EXCEEDED` | 422 | provider 不含目标订单能力 | O2/绑定 | 重新选择精确能力 provider |
| `PROVIDER_NOT_ENABLED` | 422 | provider 当前 workspace 未启用 | O2 | 重读候选或由有权限者启用 |
| `CATALOG_NOT_FOUND` | 404 | provider 不存在 | O2/渠道创建 | 不允许保存，重新读取候选 |
| `VALIDATION_ERROR` | 422 | 缺少必填字段或非法组合 | O2/O5 | 保留输入，指向具体字段 |
| `BINDING_NOT_EFFECTIVE` | 409 | 外部渠道绑定未完成 | O4/O5 | 引导既有授权路径，不手工有效化 |
| `VERSION_CONFLICT` | 409 | CAS 版本冲突 | 所有写 surface | 读取最新事实并要求重新确认 |
| `SALES_MENU_CHANNEL_INELIGIBLE` | 422/404 | 外部DINE_IN不属于本平台销售菜单 | 销售菜单 edge/owner | 保持渠道可见，说明只能由内部渠道设置菜单 |
| `PLATFORM_COMMON_ACCESS_DENIED` | 403 | workspace/节点越权 | 所有读写 | 不泄露目标数据，保留当前页面 |

`DINE_IN_MUST_BE_INTERNAL` 不再是活动错误码；它的全局含义已不成立，实施时必须从 source error catalog 和生成链同步退役，不能只删除生成物。

## 6. IA 交叉对账与完成状态

| 检查 | 结论 |
| --- | --- |
| IA ↔ UI interaction | OPEN：两份已声明同一矩阵、同一外部说明、同一 O5 双读取；待独立 DESIGN review 复核逐字一致 |
| IA ↔ implementation design | OPEN：详设完成后逐字段复核，尤其是 `dineInForm=null`、PROJECT typed problem、`BUSINESS_CHANNEL` 与 `SALES_MENU` 两种读取 |
| IA-ID ↔ Journey | MATCHED：O2、O4、O5 均可追溯到既有 Journey amendment |
| collection shape | MATCHED：provider/template candidate=Cursor；全部门店渠道=Bounded；详情=Detail |
| forbidden UI | explicit：内部形式、外部菜单、敏感值和门店页模板可见范围均列出 |
| dynamic evidence | UNVERIFIED_REQUIRES_EVIDENCE：真实 HTTP、数据库 migration、provider fixture、浏览器 L2 尚未执行 |

```text
IA_DIMENSIONS=O2,O4,O5；每个 IA-ID 均包含可见维度与不可见维度
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=true
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=10 mapped
CROSS_CHECK_WITH_DESIGN=OPEN_UNTIL_IMPLEMENTATION_DESIGN_IS_WRITTEN_AND_RECHECKED
DEXTER_WIREFRAME_REVIEW=UNSET
IA_STATUS=PROPOSED_FOR_DESIGN_REVIEW; 不构成 implementation authorization
```
