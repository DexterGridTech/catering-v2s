---
title: v2s 经营渠道模板门店可见范围 IA 详设
status: PROPOSED_FOR_REVIEW
createdAt: 2026-09-08
decisionOwner: Dexter
implementationAuthority: false
journeyRef: doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md
interactionRef: doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md
baselineIa: doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md
---

# 经营渠道模板门店可见范围 · IA 详设

```text
IA_SCOPE=IA-BCV-O1,IA-BCV-O2,IA-BCV-O1T,IA-BCV-O5,IA-BCV-O5C
BUSINESS_SOURCE=doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md
BASELINE_IA=doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md
UI_INTERACTION=doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md
DEXTER_WIREFRAME_REVIEW=UNSET
IMPLEMENTATION_AUTHORITY=false
```

本工件只修订既有 O1/O2/O1-T/O5 的门店可见范围维度；未重定义渠道四维、session、scope、binding、template status 或既有门店渠道 owner。所有集合形态都按“候选 Page / 选中关系 Page / 模板 bounded read / 渠道 bounded read”写明，不能以客户端数组长度代替服务端集合事实。

## 1. 共用不可见行为

### 1.1 范围与所有权

- 项目页面的模板读写仍以项目数据节点和 `OperationsOwnerScopeGrant` 为边界；普通 GET 不新增 read capability。
- `business-channel` owner 持有 `store_visibility_scope` 与可见关系表；organization 仅提供同 workspace、同 project 的门店 task read。
- 门店候选 query 由 edge 校验 project/store pair，再由 owner 追加范围谓词；前端只能呈现 owner 返回集合。
- 门店渠道 list/detail 只以已创建 `business_channel` 为主实体，不读取或计算“当前是否仍在模板可见关系”来隐藏它。

### 1.2 集合形态与预期规模

| 集合 | 形态 | 服务端边界 | 前端行为 |
| --- | --- | --- | --- |
| 项目模板列表 | `Bounded` | 沿用 `BusinessChannelOwnerService.BOUNDED_READ_LIMIT`；超界返回 owner invariant，不截断 | 不客户端分页/过滤；表头排序触发重读 |
| 门店模板候选 | cursor `Page` | 沿用候选 `pageSize` 上限、`nextCursor`、`total` | 门店页可用 `collectCursorPages` 汇总现有候选表；新建选择器只消费同一返回集合 |
| 已选门店关系 | cursor `Page` | 同一个 owner visible-store read 通过 `storeStatusFilter=NON_VOIDED|ALL` 服务两个读取面；携带 `nextCursor`/`total`；不返回 raw ref-only 行 | 只读详情使用 `NON_VOIDED`；编辑 Drawer 使用 `ALL` 并显示状态，跨页添加/删除不丢本地草稿 |
| 门店候选选择区 | page + query | 复用 organization STORE candidate 的候选形态；项目过滤、当前 ENABLED 门店门禁、debounce、selected identity | foundation `useCursorCandidates` 累加去重；不手写分页协议 |
| 门店渠道列表 | 既有 owner bounded/cursor read | 不增加 visibility predicate | 范围变化后仍刷新并保留既有渠道行 |

`SELECTED_PROJECT_STORES` 关系数量不在本 IA 中人为发明业务上限；若实现需要批量参数或 response 上限，必须在 owner/契约 review 中给出可执行的拒绝条件，而不是静默截断。

## 2. IA-ID 九维度

### IA-BCV-O1：项目模板列表的可见范围摘要

```text
businessTask=项目管理员确认每个渠道模板对门店的可见范围，并进入模板详情或编辑。
actorAndScenario=已认证项目范围 operations-admin 用户，打开既有项目经营渠道管理页。
entryAndSurface=既有项目经营渠道管理页 O1 的“经营渠道模板” bounded table；不新增 route。
controlType=模板名称详情入口；新增“门店可见范围”只读列；详情 Drawer 的 Popup action menu 仍是唯一对象动作入口。
dataSourceAndCascade=business-channel template bounded read 返回 operatorKind、storeVisibilityScope、visibleStoreCount；PROJECT 显示“不适用”，STORE 显示两种业务文案；SELECTED 的 count 只统计非 VOIDED 关系行，不由前端用关系长度推断 scope。
validationAndError=读失败保留旧表与上下文；unknown enum 显示不可识别状态并禁止进入编辑；SELECTED 零家显示“当前项目部分门店可见（0 家）”，不把空集合自动显示成“全部”。
stateAndPermission=读由页面/session scope 控制；无独立 read capability；DISABLED/VOIDED 模板仍依既有规则显示，不因范围变更隐藏。
navigationAndRefresh=模板创建/编辑成功后刷新 O1、O1T 与相关候选 query；失败不清空当前表；上下文变更重置所有 query identity。
accessibilityAndTestId=表格有 aria region/标题；范围列使用完整中文文本；新列的可点击动作不另造；未来详情入口 TestId 必须来自 operations-admin *TestIds.ts。
```

### IA-BCV-O2：模板创建/编辑 Drawer

```text
businessTask=创建或修改 STORE 模板的门店可见范围，并与模板基础四维一起提交为一个版本化命令。
actorAndScenario=项目管理员已拥有项目模板写 grant；创建时填写四维，编辑时模板基础四维只读而范围可编辑。
entryAndSurface=既有渠道模板表单 Drawer；沿用 adminDrawerSurfaceProps、useDrawerFormLifecycle、useSubmissionLifecycle、useOverlayLock。
controlType=operatorKind=STORE 时显示 Radio：当前项目全部门店可见/当前项目部分门店可见；部分模式显示已选门店列表、添加门店候选区、逐行删除；项目模式隐藏整个分组并清空 stale 草稿。
dataSourceAndCascade=模板行提供 scope/count；编辑读取同一个 visible-stores operation 的 `storeStatusFilter=ALL` cursor Page，详情读取使用 `NON_VOIDED`；添加区使用 organization STORE candidate 的 projectId 过滤；保存使用 owner template command 的 desired scope + 最终 `visibleStoreRefs` 集合。
validationAndError=foreign store、最终数组重复、VERSION_CONFLICT 与模板不可编辑分别映射 typed problem；SELECTED 空集合允许保存，错误不因门店状态触发；错误在 Drawer 内呈现并保留用户输入；不由前端假设 owner 成功。
stateAndPermission=只有项目模板 owner grant 可保存；VOIDED/unknown 禁止编辑；提交中锁定关闭/键盘/遮罩，候选和删除动作禁用；scope 变更不触碰既有渠道。
navigationAndRefresh=保存成功以最新 readback 更新 O1/O1T、invalidate store candidate queries；取消恢复原 readback；失败保持草稿和旧版本。
accessibilityAndTestId=Radio、添加、删除、候选搜索、保存、取消均需落真实动作节点，并由唯一 businessChannelTemplateTestIds.ts 提供常量；删除按钮需带门店 NameCode 文本和 aria-label；焦点不跳出 Drawer。
```

### IA-BCV-O1T：模板详情 Drawer

```text
businessTask=只读核对模板的经营维度、门店可见范围和已选门店，在同一对象 action menu 进入编辑或状态动作。
actorAndScenario=项目管理员从 O1 模板名称进入；详情必须使用最新模板 readback，并在部分模式读取 selected store identity。
entryAndSurface=既有“渠道模板详情” Drawer；操作入口仍是 AdminDetailActionMenu，不增加详情内容内嵌按钮。
controlType=只读 Descriptions；门店可见范围 summary；部分模式下已选门店 cursor Page/list；编辑、启停在统一 Popup Menu。
dataSourceAndCascade=模板 view 的 scope/count 加 visible-stores Page 的 `storeStatusFilter=NON_VOIDED`、storeName/storeCode/storeStatus；不显示 raw UUID 作为业务文本；模板 status 与门店状态独立显示。
validationAndError=visible-stores 读取失败显示局部 warning，不把模板范围降级为“不适用”；unknown scope 禁止编辑；刷新后以最新 response 替换旧 detail。
stateAndPermission=只读详情不因门店范围变更改变既有 channel；VOIDED 沿用既有无编辑动作；无 scope 的 PROJECT 模板显示“不适用”。
navigationAndRefresh=编辑成功关闭旧 detail 并重新打开/刷新最新 detail；内容 tab refresh 只失效受影响 template/candidate query，不清空其它 Drawer 脏表单。
accessibilityAndTestId=scope 区域有标题和零门店空态；门店列表 row 有业务 NameCode；对象操作仍复用现有 detail action TestId，新增加载/列表仅在真实控件需要时新增唯一 TestId。
```

### IA-BCV-O5：门店模板候选列表

```text
businessTask=门店管理员确认当前门店可新建的 STORE 模板，并从同一候选集合发起新建渠道。
actorAndScenario=已认证门店范围 operations-admin 用户，目标 storeRef 与 projectRef 由 session/queryContext 提供。
entryAndSurface=既有门店经营渠道管理页 O5 的“门店可接入经营渠道模板”表；不承载模板 CRUD。
controlType=模板名称/code/范围摘要只读列；模板列详情可读；新建渠道 Drawer 的 template Select 只消费同一候选结果；不增加项目模板候选。
dataSourceAndCascade=operations edge `business-channel-template-candidates` → owner `pageStoreTemplateCandidates`；谓词为 project + STORE + template ENABLED + target store ENABLED + ALL/EXISTS visibility；target store ENABLED 必须由候选 edge/owner 明确调用 organization owner/task read 实施，不能把当前 project/store pair 校验误当状态门禁，也不能由 store channel list 反推候选。
validationAndError=候选 query 失败保持旧列表；陈旧模板创建被 owner 拒绝后显示 typed visibility stale 并刷新候选；空集显示“当前门店暂无可选的渠道模板”，不显示未知模板。
stateAndPermission=候选 read 依 store/project pair scope，并明确拒绝或返回空给 DISABLED/VOIDED target store；模板 DISABLED/VOIDED 不进候选但既有 channel 仍可读；目标门店状态是候选资格门禁，不由前端补过滤。
navigationAndRefresh=项目管理员范围更新成功后通过 refresh signal 失效受影响门店候选；门店创建成功刷新渠道 list，不改变候选 owner predicate。
accessibilityAndTestId=表格标题和空态可读；新建 Drawer 的 Select、保存、取消按既有页面 TestId 规则；未来新增范围相关动作不允许内联字符串 TestId。
```

### IA-BCV-O5C：门店渠道创建与既有渠道列表

```text
businessTask=从当前可见模板创建门店渠道，并在模板范围后来变化时继续看到已经创建的渠道。
actorAndScenario=门店管理员打开新建渠道 Drawer 或既有渠道详情；可能持有模板候选旧页面。
entryAndSurface=既有 O5 渠道列表/新建渠道 Drawer/渠道详情 Drawer；不新增“范围恢复”入口。
controlType=模板 Select、渠道编码/名称字段、保存/取消；既有渠道列表首列进入详情；模板不可见不提供补救按钮。
dataSourceAndCascade=新建 Select 取 O5 candidate response；POST create channel 由 owner 再校验；已创建 list/detail 取 business_channel owner readback，不带 visibility EXISTS 过滤。
validationAndError=模板撤销可见性返回 typed stale visibility problem；保存失败不创建 channel；既有 list/detail 读失败保留旧内容；不把模板不可见显示为渠道已停用。
stateAndPermission=新建需要 STORE channel grant；既有 channel 的 status、template status、store status 分开显示；范围变更不改 channel version/status。
navigationAndRefresh=新建成功刷新 channel list；范围更新只刷新候选 query，不清除既有 channel；详情以 owner readback 重取模板和渠道状态维度。
accessibilityAndTestId=保存/取消/模板选择均落真实节点；不为既有渠道添加第二个“可见性状态”伪字段；L2 必须覆盖 stale rejection 与 existing channel retention 的用户可见结果。
```

## 2.1 模板强制维度逐 IA-ID 补全

以下四项与前述九项共同组成每个 IA-ID 的完整十三维声明；它们不是全局约定，必须按各个 surface 的数据形态分别核验。

### IA-BCV-O1

```text
emptyLoadingErrorStates=[组件] 模板集合为空显示“暂无经营渠道模板”；加载中保留表头并显示表格 loading；读取失败保留上一份成功列表和页面上下文，仅显示“渠道模板读取失败”与“重试”；unknown scope 保留行但显示“范围不可识别”。
containerBehaviorUnderLoad=[静态] 模板 bounded 上界达到 BusinessChannelOwnerService.BOUNDED_READ_LIMIT 时由 owner 返回明确 invariant/problem，不由前端静默截断；模板名称、编码和范围摘要换行，不撑宽表格；页面内容区是唯一纵向滚动祖先，表头和操作区不得横向溢出；表格列按表头基线对齐。
collectionShapeAndScale=Bounded；预期规模为项目模板通常 1–50 条；上界来源为 owner 的 BOUNDED_READ_LIMIT；超界必须拒绝或明确 owner problem，不做客户端切页/抽干。
forbiddenUI=[静态/组件] DOM 不得出现 store UUID、session/token、authorization 或 relation table 名称；表格不得出现范围写按钮、由范围推导的渠道停用状态或把 PROJECT null 显示为“全部门店”。
```

### IA-BCV-O2

```text
emptyLoadingErrorStates=[组件] 初始表单按模板 readback 填充；selected-store Page 加载时已加载的草稿不消失；候选空集显示“当前项目暂无可添加的门店”；候选读取失败保留已选草稿并提供重试；保存失败保留草稿、旧版本与错误上下文；取消恢复原 readback。
containerBehaviorUnderLoad=[静态] Drawer body 使用 adminDrawerSurfaceProps 的唯一纵向滚动区，footer sticky 且不被内容挤出；已选列表与候选列表随 body 流式换行，不各自建立嵌套滚动；长门店名称/编码换行，删除动作列保持可见；Drawer 外框、Radio 和 footer 不得横向溢出。
collectionShapeAndScale=已选门店与候选门店均为 cursor Page；预期规模为项目门店 1–1000 条；上界/页大小来自 owner cursor contract 与 foundation useCursorCandidates；草稿按 storeRef 去重保留，不能以当前已加载页代替最终集合，也不能静默截断。
forbiddenUI=[静态/组件] 不得有直接写 organization.store 的动作、按“已创建渠道”生成已选门店、把删除草稿立即写成渠道删除、把空 selected 显示为“全部门店”、或在用户可见区域显示 raw UUID/权限字段。
```

### IA-BCV-O1T

```text
emptyLoadingErrorStates=[组件] 模板详情读取失败保留上一份详情并提示重试；selected-store Page 使用 `storeStatusFilter=NON_VOIDED`，加载中保留模板身份和范围摘要；无非作废门店显示“暂无可见门店，当前不会出现在任何门店的新建候选中”；局部门店读取失败显示局部 warning，不把范围降级为“不适用”。
containerBehaviorUnderLoad=[静态] Drawer body 使用 adminDrawerSurfaceProps 的唯一纵向滚动区，footer/操作入口固定在不溢出视口的位置；adminDetailDescriptionsProps 的 label 宽度和单列基线保持一致；门店列表内容换行，操作菜单不被长文本推出。
collectionShapeAndScale=模板详情为 Bounded；selected 门店为 cursor Page；预期选中门店 1–1000 条，total/nextCursor 由 owner 返回；达到页边界显示真实分页/加载更多，不做前端全量假设。
forbiddenUI=[静态/组件] 详情内容不得出现第二套编辑/启停按钮、raw UUID、由 visibility 推导的渠道状态，或把 disabled/voided 门店从已选 readback 静默移除。
```

### IA-BCV-O5

```text
emptyLoadingErrorStates=[组件] 候选为空显示“当前门店暂无可选的渠道模板”；加载中保留表头并显示 loading；读取失败保留上一份候选和门店上下文并提供“重试”；不得以空集文案暗示模板被删除。
containerBehaviorUnderLoad=[静态] 候选表的唯一纵向滚动区由既有 operations-admin 内容 shell 承载；候选表列按表头对齐，模板名/编码/范围摘要换行；表头和新建入口不得横向溢出；候选与既有渠道区在同一页面中不互相撑宽。
collectionShapeAndScale=候选为 cursor Page；预期当前门店可选模板 0–100 条；页大小、total、nextCursor 来自 owner candidate contract；新建选择器消费同一候选 identity，不在客户端抽干或重新过滤。
forbiddenUI=[静态/组件] 候选表不得出现 PROJECT 模板、DISABLED/VOIDED 模板、对不可见模板的补偿按钮、以 channel list 反推模板、或把 template visibility 显示成渠道停用状态。
```

### IA-BCV-O5C

```text
emptyLoadingErrorStates=[组件] 新建 Drawer 的模板候选为空时显示“当前没有可选的渠道模板”；加载失败保留既有页面并显示重试；保存遇到 stale visibility 显示“该模板已不再对当前门店开放，请刷新模板列表后重试”，保留用户上下文且不清空既有渠道列表。
containerBehaviorUnderLoad=[静态] 新建 Drawer body 使用 adminDrawerSurfaceProps 的唯一纵向滚动区，sticky footer 的取消/保存按钮不溢出视口；Select 长标签省略或换行但不撑宽 Drawer；既有渠道列表/详情沿用各自 baseline container，不因模板范围增加第二个滚动祖先。
collectionShapeAndScale=新建模板 Select 为当前 O5 candidate cursor Page 的归并结果；预期 0–100 条，total/nextCursor 由 owner 返回；既有渠道 list/detail 继续沿用 baseline 的 bounded/cursor 形态，二者不合并为一个数组。
forbiddenUI=[静态/组件] 新建 Drawer 不得显示候选接口未返回的模板、绕过 owner visibility revalidation、提供“恢复不可见模板”按钮，或把已创建渠道隐藏成“不可见”伪状态。
```

IA_DIMENSIONS=IA-BCV-O1,IA-BCV-O2,IA-BCV-O1T,IA-BCV-O5,IA-BCV-O5C;VISIBLE_AND_INVISIBLE_DIMENSIONS=COMPLETE;INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=YES;FORBIDDEN_UI=EXPLICIT

## 3. IA 与 baseline 的衔接

- O1/O2/O1T/O5 的 session、URL、owner、status、binding、基础四维沿用 `2026-08-19` baseline；本稿只新增门店范围事实与边界。
- O5 的“模板候选 cursor Page、门店渠道独立读取”是不可删除的两个集合边界；实现不得把二者合并为一个前端数组。
- 既有 IA 中关于“门店停用不被本批推导为禁止创建绑定/渠道”的历史语义仍不由本需求重裁；本稿只对本批模板候选明确要求目标门店当前为 ENABLED。现有 business-channel 候选路径的 project/store pair 校验本身不证明该状态，实施时必须在候选 edge/owner 的 named organization task read 边界显式补齐；任何冲突交 Dexter。

## 4. Cross-check

| 事实 | Journey | IA | 后续实现设计必须出现 |
| --- | --- | --- | --- |
| 两个范围选项 | BCV-01 | O2/O1/O5 文案 | enum/owner validation/contract |
| 部分范围列表增删 | 4.1 | O2 selected list + candidate Page | final `visibleStoreRefs` + CAS |
| 候选只含可见模板 | BCV-06 | O5 source/cascade | EXISTS/ALL predicate |
| 已有渠道不受影响 | BCV-08/09 | O1T/O5C | channel list SQL 不加 visibility；acceptance red mutation |
| owner 最终复核 | BCV-07 | O2/O5C error | same REQUIRED transaction + typed problem |
| 已裁决产品边界 | Journey §6 | collection/status notes | 整体替换、空集合、关系保留和双过滤必须逐字一致；当前仅待 Claude 对修订字节复核 |

本文是 review 输入，不是实施授权。
