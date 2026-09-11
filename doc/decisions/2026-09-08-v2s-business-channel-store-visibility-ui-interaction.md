---
title: v2s 经营渠道模板门店可见范围 UI 交互设计
status: ACCEPTED_FOR_IMPLEMENTATION
createdAt: 2026-09-08
decisionOwner: Dexter
implementationAuthority: true
journeyRef: doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md
iaRef: doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md
---

# 经营渠道模板门店可见范围 · UI 交互设计

```text
UI_SCOPE=O1,O2,O1T,O5,O5C
CONSUMER_FACE=operations-admin
BASELINE_INTERACTION=doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md
FOUNDATION= libraries/frontend/admin-ui-foundation/
ALL_V2_COUNTERPART=NOT_FOUND_IN_HERITAGE_REGISTRY; baseline uses current v2s screen and accepted textual Journey
DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION
UI_DESIGN_REVIEW=GO
IMPLEMENTATION_AUTHORITY=true
```

## 1. 体验目标

用户先回答“这个门店模板给谁用”，再维护门店名单；模板状态、门店范围、已创建渠道三层信息必须分开。页面上的“部分门店可见”不能让用户误以为是在立即创建/删除门店渠道；范围变更的结果是“影响下一次新建”，而不是“回收已有渠道”。

## 2. Surface ownership roster

| surface | 所属页面/组件 | owner | 允许的用户动作 | 禁止的动作 |
| --- | --- | --- | --- | --- |
| O1 模板表 | `ProjectBusinessChannelPage.tsx` | business-channel read | 查看范围摘要、打开详情 | 直接在表格行上放状态/范围写按钮 |
| O2 模板表单 | `BusinessChannelTemplateDrawer.tsx` + `BusinessChannelTemplateStorePickerModal.tsx` | business-channel command | 选择 scope、打开门店选择弹窗、确认/取消临时选择、删除草稿门店、保存/取消 | 直接写 organization.store；把已创建 channel 当作选择结果 |
| O1T 模板详情 | `BusinessChannelTemplateDetailDrawer.tsx` | business-channel read + detail action menu | 查看 scope/门店清单、进入编辑、既有状态动作 | 在详情内容嵌入第二套编辑按钮 |
| O5 候选表 | `StoreBusinessChannelPage.tsx` | business-channel candidate read | 查看当前可见模板、进入渠道新建 | 显示不可见模板或用前端本地过滤补数据 |
| O5C 渠道创建 | `BusinessChannelCreateDrawer.tsx` | business-channel command | 选择候选模板、填写渠道、保存/取消 | 绕过 owner visibility revalidation |
| O5 existing list/detail | `BusinessChannelList.tsx` / detail | business-channel channel read | 查看已创建渠道 | 因模板不可见而隐藏/删除/停用渠道 |

## 2.1 逐 surface 强制声明

以下每个 user-facing surface 都独立声明 UI_SURFACE、入口、用户、业务目标、可见文案、技术边界、foundation 原语和容器行为；线框只绘制该 surface 自己拥有的元素。

### Surface O1-PROJECT-TEMPLATE-LIST

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页
HOST_AND_ENTRY=既有项目经营渠道管理页的“经营渠道模板”内容区；项目经营渠道 Tab 打开后进入，模板名称打开 O1T。
ACTOR=项目经营渠道管理员
BUSINESS_SCENARIO=项目管理员需要比较模板并确认哪些门店可以用来新建渠道。
BUSINESS_GOAL=快速看懂模板的门店可见范围，并能进入正确的只读详情。
USER_VISIBLE_COPY=标题“经营渠道模板”；列“模板名称、模板编码、接入类型、经营主体、订单类型、门店可见范围、状态”；按钮“新建模板”；空态“暂无经营渠道模板”；失败“渠道模板读取失败”“重试”；unknown scope“范围不可识别”。
TECHNICAL_BOUNDARY=模板 bounded read、scope enum、visibleStoreCount、project session scope；不显示 owner、schema、relation 或授权字段。
FOUNDATION_PRIMITIVE=adminListState、createRefreshSignal、useRefreshVersion、testId、NameCodeText（如范围摘要需要名称编码呈现）。
CONTAINER_LAYOUT=沿用 operations-admin 内容 shell 的唯一纵向滚动区；模板表按现有 ProTable/表头列对齐，长名称/编码/范围摘要换行；表头、新建模板按钮和列操作不得横向溢出，禁止额外 table-local 纵向滚动。
```

### Surface O2-TEMPLATE-FORM-DRAWER

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=O1 模板表“新建模板”或 O1T 的对象操作菜单“编辑”；仅项目模板 owner grant 可进入可保存状态。
ACTOR=项目经营渠道管理员
BUSINESS_SCENARIO=项目管理员创建 STORE 模板，或调整既有 STORE 模板的门店可见范围。
BUSINESS_GOAL=选择全部/部分门店范围，维护部分范围名单，并与模板变更一起可靠保存。
USER_VISIBLE_COPY=标题“新建渠道模板/编辑渠道模板”；字段“模板名称、模板编码、接入类型、经营主体、订单类型、到店点餐形式、门店可见范围”；选项“当前项目全部门店可见、当前项目部分门店可见”；分组“已选门店”；按钮“添加门店、删除、取消、保存”；添加弹窗标题“添加可见门店”、搜索提示“搜索门店名称或编码”、选择摘要“已选择 N 家门店”、按钮“取消、确定”；候选空态“当前项目暂无可添加的门店”；部分范围零家提示“保存后当前不会出现在任何门店的新建候选中，可稍后添加门店”；失败“保存失败”“重试”；冲突“模板已被他人更新，请关闭并重新读取”。
TECHNICAL_BOUNDARY=owner create/update command、desired scope、最终 visibleStoreRefs、expectedVersion、Idempotency-Key、同一个 visible-store operation 的 `storeStatusFilter=NON_VOIDED|ALL`、organization task read；这些字段不得成为用户文案。
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps、useDrawerFormLifecycle、useSubmissionLifecycle、useOverlayLock、useCursorCandidates、collectCursorPages、NameCodeText、createRefreshSignal、testId、Ant Design Modal/Checkbox。
CONTAINER_LAYOUT=Drawer body 使用 adminDrawerSurfaceProps 的唯一纵向滚动区，footer sticky；Drawer 内只展示已选门店，候选搜索/选择在独立 Modal 内完成，Modal 的候选列表使用自身可见滚动区承载 cursor continuation；长名称/编码换行而删除动作保持可见；Drawer、Modal、范围 Radio 和各自 footer 不得横向溢出。
```

### Surface O1T-TEMPLATE-DETAIL-DRAWER

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=O1 模板名称打开；O1T 右上角对象操作菜单提供“编辑/启用/停用”等既有动作。
ACTOR=项目经营渠道管理员
BUSINESS_SCENARIO=项目管理员在改范围前核对模板身份、经营维度、范围和已选门店。
BUSINESS_GOAL=确认模板对哪些门店开放，同时理解范围变更不会回收既有渠道。
USER_VISIBLE_COPY=标题“渠道模板详情”；分组“模板身份、经营维度、门店可见范围、已选门店、状态”；按钮/菜单“操作、编辑、启用/停用”；空态“暂无可见门店，当前不会出现在任何门店的新建候选中”；失败“门店范围读取失败”“重试”；帮助“范围变更只影响新建渠道选择，已创建渠道不受影响”。
TECHNICAL_BOUNDARY=template readback、同一个 visible-store cursor Page 的 `storeStatusFilter=NON_VOIDED`、template/store status parallel facts、detail action menu；不显示 raw UUID 或 relation table。
FOUNDATION_PRIMITIVE=useDetailDrawer、AdminDetailActionMenu、adminDetailDescriptionsProps、adminDrawerSurfaceProps、useOverlayLock、testId。
CONTAINER_LAYOUT=Drawer body 使用唯一纵向滚动区；adminDetailDescriptionsProps 的单列 label 宽度和基线保持一致；selected-store Page 随 body 流动，操作菜单和关闭区域不被长文本推出或横向溢出。
```

### Surface O5-STORE-TEMPLATE-CANDIDATE-PAGE

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页
HOST_AND_ENTRY=既有门店经营渠道管理页的“门店可接入经营渠道模板”内容区；门店渠道 Tab 打开后进入。
ACTOR=门店经营渠道管理员
BUSINESS_SCENARIO=门店管理员需要查看当前门店可以用哪些项目模板新建渠道。
BUSINESS_GOAL=只看到当前项目、当前门店、仍可用且对本店可见的 STORE 模板。
USER_VISIBLE_COPY=标题“门店可接入经营渠道模板”；列“模板名称、模板编码、接入类型、订单类型”；空态“当前门店暂无可选的渠道模板”；失败“门店渠道模板读取失败”“重试”；新建入口“新建经营渠道”。项目模板的门店可见范围只作为 owner 候选过滤事实，不在门店消费面展示；项目管理员仍在 O1 查看范围摘要。
TECHNICAL_BOUNDARY=store/project pair scope、owner candidate Page、模板 status/operatorKind、目标门店 status=ENABLED 与 ALL/EXISTS predicate；目标门店状态必须在 candidate edge/owner 的显式 organization owner/task read 中复核，前端不得用 channel list 反推候选或补齐状态门禁。
FOUNDATION_PRIMITIVE=adminListState、collectCursorPages、createRefreshSignal、useRefreshVersion、testId、NameCodeText。
CONTAINER_LAYOUT=沿用 operations-admin 内容 shell 的唯一纵向滚动区；候选表与既有渠道区按各自表头对齐，模板名称/编码换行；新建入口、表头和分页控制不得横向溢出，不能为候选表新增第二个页面滚动祖先。
```

### Surface O5C-STORE-CHANNEL-CREATE-DRAWER

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=O5 既有“新建经营渠道”按钮打开；仅消费 O5 已返回的候选模板。
ACTOR=门店经营渠道管理员
BUSINESS_SCENARIO=门店管理员从当前候选中选择模板并填写渠道基本信息。
BUSINESS_GOAL=从当前可见模板创建一个门店经营渠道；陈旧候选不能绕过 owner 复核。
USER_VISIBLE_COPY=标题“新建经营渠道”；字段“渠道模板、渠道编码、渠道名称”；按钮“取消、保存”；空态“当前没有可选的渠道模板”；失败“保存失败”“该模板已不再对当前门店开放，请刷新模板列表后重试”。
TECHNICAL_BOUNDARY=候选 response、createChannel owner revalidation、STORE grant、typed stale problem；不显示 templateRef、事务或权限实现字段。
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps、useDrawerFormLifecycle、useSubmissionLifecycle、useOverlayLock、testId、createRefreshSignal。
CONTAINER_LAYOUT=Drawer body 使用 adminDrawerSurfaceProps 的唯一纵向滚动区，sticky footer 的取消/保存按钮不溢出视口；Select 长标签换行/截断但不撑宽；不建立嵌套滚动。
```

### Surface O5E-STORE-CHANNEL-LIST

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页
HOST_AND_ENTRY=O5 门店经营渠道管理页的“门店主体经营渠道”内容区；在候选模板区下方展示。
ACTOR=门店经营渠道管理员
BUSINESS_SCENARIO=管理员查看已创建渠道，即使来源模板后来不再对本店开放。
BUSINESS_GOAL=持续看到已创建渠道及其自身状态，不把模板可见性变更伪装成渠道停用或删除。
USER_VISIBLE_COPY=标题“门店主体经营渠道”；列/详情入口沿用既有渠道字段；帮助“模板当前不再提供给新建渠道选择，已创建渠道不受影响”；失败沿用“渠道读取失败”“重试”。
TECHNICAL_BOUNDARY=business_channel owner channel list/detail read；不得追加 visibility EXISTS 过滤，也不得从 template status 推导 channel status。
FOUNDATION_PRIMITIVE=adminListState、createRefreshSignal、useRefreshVersion、useDetailDrawer、AdminDetailActionMenu、adminDetailDescriptionsProps、adminDrawerSurfaceProps、testId。
CONTAINER_LAYOUT=沿用既有渠道表和详情 Drawer 的 baseline 容器；页面只使用既有内容滚动区，详情 body 只使用 Drawer body 滚动区；列/详情 label 基线不因范围字段增加而漂移。
```

### Surface O5E-STORE-CHANNEL-DETAIL-DRAWER

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=O5E 渠道名称/详情入口打开；对象动作仍由右上角 AdminDetailActionMenu 提供。
ACTOR=门店经营渠道管理员
BUSINESS_SCENARIO=管理员核对已创建渠道、来源模板和各自状态。
BUSINESS_GOAL=明确区分渠道状态、模板状态、门店状态和可见范围，不因模板范围撤销而隐藏既有渠道。
USER_VISIBLE_COPY=标题“经营渠道详情”；分组“渠道身份、来源模板、渠道状态、模板状态、门店状态”；操作“操作、编辑/停用”等既有动作；失败“渠道详情读取失败”“重试”。
TECHNICAL_BOUNDARY=channel owner readback 与 template parallel facts；visibility 只解释新建候选，不作为 channel status 字段。
FOUNDATION_PRIMITIVE=useDetailDrawer、AdminDetailActionMenu、adminDetailDescriptionsProps、adminDrawerSurfaceProps、useOverlayLock、testId。
CONTAINER_LAYOUT=Drawer body 使用唯一纵向滚动区；详情 label 列、值列按既有基线对齐，长名称换行；操作菜单和关闭区域不横向溢出。
```

SURFACE_ADMISSION=O1-PROJECT-TEMPLATE-LIST,O2-TEMPLATE-FORM-DRAWER,O1T-TEMPLATE-DETAIL-DRAWER,O5-STORE-TEMPLATE-CANDIDATE-PAGE,O5C-STORE-CHANNEL-CREATE-DRAWER,O5E-STORE-CHANNEL-LIST,O5E-STORE-CHANNEL-DETAIL-DRAWER;CONTAINER_LAYOUT=DECLARED_PER_SURFACE;FOUNDATION_PRIMITIVE=DECLARED_PER_SURFACE;USER_VISIBLE_COPY=DECLARED_PER_SURFACE

## 3. Screen O2：模板表单 Drawer

### 3.1 字段与信息层次

```text
┌ 编辑渠道模板 ───────────────────────────────────┐
│ 基本信息                                         │
│ 模板名称                                         │
│ 模板编码                                         │
│ 接入类型 / 经营主体 / 订单类型 / 到店形式         │
│                                                  │
│ 门店可见范围（仅经营主体=门店）                   │
│ ○ 当前项目全部门店可见                            │
│   当前项目内符合门店候选条件的门店可新建此模板     │
│ ● 当前项目部分门店可见                            │
│   已选 2 家                                      │
│   [门店名称 / 编码]                         删除 │
│   [门店名称 / 编码]                         删除 │
│   [添加门店]                                     │
│                                                  │
│                              [取消] [保存]        │
└──────────────────────────────────────────────────┘
```

点击“添加门店”后打开独立弹窗：

```text
┌ 添加可见门店 ──────────────────────────────────┐
│ 选择需要使用此模板的项目门店。                  │
│ 搜索并选择门店                                  │
│ [搜索门店名称或编码                         ]  │
│ 已选择 2 家                                     │
│ ┌──────────────────────────────────────────┐   │
│ │ □ 门店 A（STORE-A）                       │   │
│ │ ☑ 门店 B（STORE-B）                       │   │
│ └──────────────────────────────────────────┘   │
│ 已选名单中的停用/作废门店继续保留，需回到 Drawer │
│ 删除；候选读取失败时在此处重试。                  │
│                                  [取消] [确定]   │
└────────────────────────────────────────────────┘
```

- 基础字段仍沿用现有四维级联；可见范围紧跟“经营主体”，避免把门店可见性误解为外部接入配置。
- `PROJECT` 模板不渲染该分组，也不保留隐藏的 scope/selected store 草稿。
- `ALL_PROJECT_STORES` 只显示范围说明，不显示逐店名单；说明明确“影响新建选择，不改变已创建渠道”。
- `SELECTED_PROJECT_STORES` 显示当前草稿集合；删除只从草稿集合移除，保存前不发请求；“添加门店”打开独立 Modal，Modal 内的勾选只维护临时集合，候选项已在草稿中时保持勾选。
- 部分模式无门店时，保存按钮仍可点击并允许提交；门店分组显示“保存后当前不会出现在任何门店的新建候选中，可稍后添加门店”。这不是错误，也不改变模板启停状态。
- 已选门店行使用 `NameCodeText` 或同等 foundation presentation；不显示 UUID。编辑 Drawer 不隐藏任何关系行，VOIDED 门店以次级 Tag 标注且仍可保留；门店状态不改变范围标签。

### 3.2 状态与恢复

| 状态 | 用户看到什么 | 可做什么 |
| --- | --- | --- |
| 初始 PROJECT | 无门店范围分组 | 编辑名称等既有允许字段 |
| 切换 STORE + ALL | 显示全部门店说明 | 可切换到部分；保存提交 scope |
| 切换 STORE + SELECTED | 显示选中名单和“添加门店”按钮 | 打开 Modal、删除、保存、取消 |
| 门店选择 Modal | 搜索框、已选数量、Checkbox 候选列表 | 勾选/取消勾选、确定或取消；不提交 owner command |
| 候选加载中 | Modal 候选列表加载提示；已选名单不消失 | 等待、继续搜索或取消 |
| 候选失败 | Modal warning + 重试；Drawer 草稿保留 | 重试、取消；不提交未知 ref |
| 保存失败 | 顶部 Alert 显示 typed problem，草稿和旧列表保留 | 修正后重试/取消 |
| VERSION_CONFLICT | 告知模板已被他人更新，禁止覆盖旧事实 | 关闭并重读；不静默合并 |
| 模板 VOIDED/unknown | 只读/禁止保存 | 关闭 |

### 3.3 控件与 TestId roster

实现须唯一维护 `apps/frontend/operations-admin/src/app/automation/businessChannelTemplateTestIds.ts`；本表是当前实现和 L2 admission 的控件分母。所有 TestId 必须绑定真实动作节点。

| 控件键 | testId | 所在真实动作节点 | 是否 `COMPOSITE_OPTION_ANCHOR` | L2 / 静态分母 |
| --- | --- | --- | --- | --- |
| `templateScopeSummary` | `business-channel-template-scope-summary` | O1 模板表“门店可见范围”列的实际 `Tag`/文本节点（只读状态） | 否 | 是 |
| `visibilityScopeGroup` | `business-channel-template-visibility-scope` | O2 `Radio.Group` 组合控件宿主 | 是；只作为组合锚点，点击必须落到下列 option | 是 |
| `visibilityScopeAllOption` | `business-channel-template-visibility-scope-all` | O2“当前项目全部门店可见”真实 `Radio` option | 否 | 是 |
| `visibilityScopeSelectedOption` | `business-channel-template-visibility-scope-selected` | O2“当前项目部分门店可见”真实 `Radio` option | 否 | 是 |
| `visibleStoreAdd` | `business-channel-template-visible-store-add` | O2“添加门店”真实 `Button` | 否 | 是 |
| `visibleStorePickerModal` | `business-channel-template-visible-store-picker-modal` | O2 “添加可见门店”真实 Modal 容器 | 否 | 仅实际渲染时 |
| `visibleStorePickerSearch` | `business-channel-template-visible-store-picker-search` | O2 门店选择 Modal 的真实搜索 `Input` | 否 | 仅实际渲染时 |
| `visibleStorePickerList` | `business-channel-template-visible-store-picker-list` | O2 门店选择 Modal 的候选滚动列表真实 `list` 节点 | 否 | 仅实际渲染时 |
| `visibleStorePickerOption(storeRef)` | `business-channel-template-visible-store-picker-option-${storeRef}` | O2 门店选择 Modal 候选行的真实 `Checkbox` | 否 | 仅实际渲染时 |
| `visibleStorePickerReadRetry` | `business-channel-template-visible-store-picker-read-retry` | O2 门店选择 Modal 候选读取失败提示中的真实“重试” `Button` | 否 | 仅实际渲染时 |
| `visibleStorePickerCancel` | `business-channel-template-visible-store-picker-cancel` | O2 门店选择 Modal footer 的真实“取消” `Button` | 否 | 仅实际渲染时 |
| `visibleStorePickerConfirm` | `business-channel-template-visible-store-picker-confirm` | O2 门店选择 Modal footer 的真实“确定” `Button` | 否 | 仅实际渲染时 |
| `visibleStoreRemove(storeRef)` | `business-channel-template-visible-store-remove-${storeRef}` | O2 已选门店行内真实 `Button` | 否 | 是 |
| `visibleStoreVoidedTag(storeRef)` | `business-channel-template-visible-store-voided-${storeRef}` | O2 编辑 Drawer 已选门店行的状态 `Tag`（只读事实） | 否 | 是 |
| `visibleStoreReadRetry` | `business-channel-template-visible-store-read-retry` | O1T 门店范围局部失败提示中的真实“重试” `Button` | 否 | 仅实际渲染时 |
| `visibleStoreEditReadRetry` | `business-channel-template-visible-store-edit-read-retry` | O2 编辑 Drawer 已选门店关系读取失败提示中的真实“重试” `Button` | 否 | 仅实际渲染时 |
| `visibleStorePageNext` / `visibleStorePagePrevious` | `business-channel-template-visible-store-page-next/previous` | O1T visible-store Page 的真实分页 `Button` | 否 | 仅实际渲染时 |
| `storeTemplateCandidateTable` | `business-channel-store-template-candidate-table` | O5 候选表真实 `Table`/region（只读集合锚点） | 否 | 是 |
| `storeTemplateCandidateCreate` | `business-channel-store-template-create` | O5/O5C“新建经营渠道”真实 `Button` | 否 | 是 |
| `storeTemplateSelect` | `business-channel-store-template-select` | O5C 模板选择器真实 `Select` 触发节点 | 否 | 是 |
| `formSubmit` | `business-channel-template-form-submit` | O2 footer 真实保存 `Button` | 否 | 是 |
| `formCancel` | `business-channel-template-form-cancel` | O2 footer 真实取消 `Button` | 否 | 是 |

`visibilityScopeGroup` 只有组合控件语义，不能被 L2 当作 option 点击；option-level 节点优先使用各自真实 `Radio`。除该明确标注的组合锚点外，不允许用 label、placeholder、row index、CSS、XPath 或列表文本代替上述 identity；Modal 容器 TestId 只作 surface 观察锚点，不能代替搜索、Checkbox 或 footer Button 的真实动作节点。`storeRef` 是稳定业务身份，不是位置。只读状态/表格锚点只有在真实 UI 渲染时计入观察分母。

## 4. Screen O1/O1T：范围摘要与只读详情

### O1 表格

新增一列“门店可见范围”：

| operatorKind | scope | 显示 |
| --- | --- | --- |
| PROJECT | null | 不适用 |
| STORE | ALL_PROJECT_STORES | 当前项目全部门店可见 |
| STORE | SELECTED_PROJECT_STORES | 当前项目部分门店可见（N 家，N 只统计非作废门店） |
| 任意 | unknown | 范围不可识别 |

`N` 来自服务端 `visibleStoreCount`，不是从当前页面行数计算；VOIDED 关系保留但不计入 N。N=0 时显示“当前项目部分门店可见（0 家）”，不显示为“不适用”。列表本身不展开门店名单。

### O1T Drawer

只读详情的信息顺序为：模板身份 → 经营维度 → 门店可见范围 → 已选门店（仅部分）→ 生命周期状态。只读 visible-store Page 使用 `storeStatusFilter=NON_VOIDED`，已选门店按 `NameCodeText` 展示；门店状态是独立事实。无非作废门店时显示“暂无可见门店，当前不会出现在任何门店的新建候选中”。详情右上角只保留既有 `AdminDetailActionMenu`，编辑/启停从 Popup Menu 进入，内容区不出现第二个“编辑范围”按钮。

## 5. Screen O5/O5C：候选与既有渠道

### O5 候选表

候选表标题为“门店可接入经营渠道模板”，表内只出现 owner 返回的当前门店候选。候选 edge/owner 在 candidate operation 中显式复核目标门店 `status=ENABLED`；DISABLED/VOIDED 目标门店不能取得候选。空态文案为“当前门店暂无可选的渠道模板”，不说明“模板已删除”。模板状态为 `DISABLED/VOIDED` 的历史模板不出现在候选；这不影响已创建渠道区读取其自身事实。

### O5C 新建渠道 Drawer

`BusinessChannelCreateDrawer` 的 STORE 分支只消费 candidate endpoint 的结果。选择器不再自行拼出另一份模板集合；前端保留 status/operator 的防御性展示校验，但 owner 是最终权威。保存遇到可见范围变化时显示“该模板已不再对当前门店开放，请刷新模板列表后重试”，并保留页面上下文。

### O5 existing list/detail

既有渠道列表继续展示渠道状态、来源模板状态和门店状态的独立列/详情区。不得增加一个由 visibility 推导的“不可见渠道”伪状态；如果需要帮助文案，应写“模板当前不再提供给新建渠道选择，已创建渠道不受影响”。

## 6. 交互与 foundation 消费

| 需要的行为 | 复用能力 | 页面保留的业务责任 |
| --- | --- | --- |
| Drawer 脏态、关闭确认、提交锁 | `useDrawerFormLifecycle`, `useSubmissionLifecycle`, `useOverlayLock` | scope 草稿、typed problem、owner callback |
| 门店候选搜索/滚动/去重 | `useCursorCandidates`, `collectCursorPages` + existing operations organization candidate request | projectId、subjectType=STORE、最终 visibleStoreRefs 草稿；Modal 内 Checkbox 选择只改本地临时集合，Drawer 删除只改最终草稿集合 |
| 门店选择弹窗与焦点回收 | Ant Design `Modal`、`Checkbox`、foundation `useOverlayLock`、`testId` | Modal 的打开/取消/确定、候选错误恢复和关闭后焦点回到“添加门店” |
| 详情 Drawer 操作入口 | `useDetailDrawer`, `AdminDetailActionMenu`, `adminDetailDescriptionsProps` | template scope readback、status、onEdit/onStatusChange |
| Name/code 业务身份展示 | `NameCodeText` | 门店 stale status 文案 |
| query refresh | `createRefreshSignal`, `useRefreshVersion` | 精确失效模板/候选/渠道 query，不重置无关表单 |
| automation identity | foundation `testId` helper + app-owned `businessChannelTemplateTestIds.ts` | 唯一业务键和 action binding |

## 7. 错误/焦点/可访问性闭环

- scope radio 的改变不会自动提交，也不会关闭 Drawer；焦点保持在当前控制，切换到部分模式后焦点进入“添加门店”按钮。点击后 Modal 打开并把焦点放到搜索框；Modal 关闭后焦点回到该按钮。
- Modal 的“确定”只提交临时选择到 Drawer，不调用 owner command；“取消”、遮罩关闭或 Escape 都丢弃临时选择。Drawer 的“保存”仍是唯一提交最终 `visibleStoreRefs` 的动作。
- 删除行在真实 Button 上执行，行删除后焦点回到相邻行或“添加门店”按钮；没有“点击文本删除”的隐形动作。
- candidate request 失败不清除 selected list；重试动作在门店选择 Modal 内有独立 identity，不能以刷新整个页面代替。
- Modal 候选列表使用 `role=list` 和真实 Checkbox，搜索框带可见标签与 `aria-label`；加载、空态和失败均有可读文案，候选列表滚动不改变已选数量。
- typed problem 不把 raw UUID、session、token、原始 payload 或组织越权 identity 放到 DOM/日志。
- scope 状态使用文字 + Tag，不只依赖颜色；列表空态、加载态、错误态均有 aria-live 或可读标题。

## 8. 动作分母与动态验证边界

本设计定义实现与 future L2 分母；当前 L2 尚未运行，不能把控件 roster 当作 L2 business PASS：

1. 项目模板创建 STORE + ALL。
2. 项目模板创建 STORE + SELECTED，打开添加门店 Modal，搜索并勾选两家，确定回到 Drawer 后再保存。
3. 在添加门店 Modal 内勾选/取消勾选后取消，确认 Drawer 名单未改变；再次确定后保存最终集合。
4. 编辑 SELECTED → ALL。
5. 编辑 ALL → SELECTED，添加一家并保存。
6. 空 SELECTED 保存成功并显示部分范围零家语义。
7. 门店候选只显示可见 STORE 模板。
8. 已创建渠道后撤销门店可见性，既有渠道仍在列表/详情。
9. 陈旧候选创建被 owner 拒绝并保留上下文。

当前 `apps/frontend/operations-admin/src/tests/l2/` 没有经营渠道模板门店范围的专用 spec；本次没有把 Modal 控件硬塞入不相关 L2 场景。完成 UI/TestId/static/typecheck 后，如新增独立 L2 case，必须按本表绑定真实 Modal、搜索、Checkbox、取消和确定节点，再走受管 runner admission；当前不把本次静态验证称为 L2 business PASS。

每个 future action 都要有唯一 TestId、L2 binding、真实动作节点和 business oracle；本 Journey 的动态执行授权记录在 Roadmap 与 implementation-facing 详设中，但本稿不自动触发 DEV/L2/seed/reset，只有当前任务明确要求时才可通过受管入口执行。

## 9. Review gate

`UI_DESIGN_REVIEW=GO`。Claude follow-up DESIGN review 已完成且 Dexter 已授权实施；生产 UI、契约、迁移、测试和受管运行仍必须按本稿、实施详设、实施计划及 fresh independent implementation review 执行。
