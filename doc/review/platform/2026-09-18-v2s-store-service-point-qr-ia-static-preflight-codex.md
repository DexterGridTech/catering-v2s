# 门店桌台与二维码管理：IA 逐控件静态前置比对

```text
REVIEW_TARGET=IMPLEMENTATION
PREFLIGHT_KIND=IA_CONTROL_STATIC_PREFLIGHT
REVIEWER=MAIN_CODEX
DATE=2026-09-18
IA_SOURCE=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md
INTERACTION_SOURCE=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md
BASELINE=apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx
PRODUCTION_SOURCE=apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx
TESTID_SOURCE=apps/frontend/operations-admin/src/features/store-service-point/storeServicePointTestIds.ts
IA_CONTROL_REVIEW=PASS_STATIC_PREFLIGHT
TESTID_REVIEW=PASS_STATIC_BINDING
BROWSER_L2=NOT_AUTHORIZED
VISUAL_L2=NOT_RUN
```

## 1. 范围与判定口径

本记录是进入 Browser L2 前的静态前置门，不是 Browser L2、UAT 或运行验收。按 IA `IA-SPQ-01` 至 `IA-SPQ-03`，逐个复核真实生产控件的：

- 位置是否位于 IA 指定的页面 surface、主从容器、列表头部、行末菜单或 Drawer；
- 形态和样式是否沿用销售菜单基线及仓内 Foundation primitive；
- 行为是否实现 IA 声明的选中、排序、边界禁用、动态用户术语、权限/读取稳定性、失败恢复和统一 dirty guard；
- 每个真实动作是否绑定 `storeServicePointTestIds.ts` 的稳定业务身份，而不是用文本、索引或隐藏菜单项冒充。

静态源码能够确认 JSX 容器、组件组合、属性、状态分支和 testId 绑定；实际浏览器像素与动态 HTTP 行为仍未运行，继续保持 `BROWSER_L2=NOT_AUTHORIZED`。

## 2. 逐 IA-ID 对账

| IA-ID | IA 要求 | 当前真实实现与位置/样式 | 行为与边界 | testId / 结论 |
| --- | --- | --- | --- | --- |
| `IA-SPQ-01` 页面与主从列表 | 页面单一纵向 surface；上方二维码只读区；下方左区域 master、右桌台/扫码点 dependent；销售菜单式选中和“…”操作 | `StoreServicePointPage.tsx:1028-1075` 先处理 scope/gate，再按 IA 顺序渲染二维码 Card 与双栏 grid；区域 Card 在 `1076-1159`，从属 Card 在 `1160-1214`；区域行使用 text Button、浅色主色背景、左侧强调线、`aria-current`，与 `SalesMenuPage.tsx:230-275` 的 master pattern 同族 | 无区域选择时右侧只有“请选择区域”；区域切换由 `selectedAreaRef` 控制，从属请求使用当前区域；`currentData` 防止旧集合回显；从属表使用 Foundation `adminListState`，失败清空 rows 并保留重试；表格操作位在最后一列 | `page`、`qrConfig`、`areaList`、`areaRow(ref)`、`areaMenu(ref)`、`pointList`、`pointRow(ref)`、`pointMenu(ref)`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-01` 区域新增与选择 | “新建区域”只能在区域列表头部；不自动选中首个或新建结果 | `StoreServicePointPage.tsx:1076-1091` 将新增 Button 放在区域 Card `extra`；`388-395` 仅清理失效选择，不自动选择第一条；`461-500` 新建成功不写入选中状态 | 区域读取成功且稳定、具备编辑能力才展示新增；区域行整行可选；点击“…”不改变 master 选择 | `areaCreate`、`areaRow`、`areaMenu`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-01` 动态从属列表 | 选桌台区只显示桌台/新建桌台；选扫码区只显示扫码点/新建扫码点；不得出现“服务点” | `StoreServicePointPage.tsx:1160-1177` 使用 `titleForArea` 动态标题和按钮；`model/storeServicePointModel.ts:87-97` 是用户术语唯一映射；表头、行菜单、反馈文案同样取该映射 | 创建上下文固定为选中区域类型；区域非启用时不提供新建从属动作；扫码点分支不渲染桌台字段或图片 | `pointCreate`、`pointRow`、`pointMenu`、`pointMenuAction`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-01` 列表状态与恢复 | loading/empty/failed 不互相伪装；失败可重试；排序后以 owner readback 为准 | 区域状态分支在 `1093-1104`；从属表在 `1181-1211`，失败 Alert 和重试在 `1185-1192`，Table 的 loading/empty/failed 统一由 `adminListState` 在 `1193-1205` 提供；排序命令在 `531-553`、`744-764` 后调用统一刷新 | 不使用上一门店/上一选区的 rows；失败时 dataSource 为 `[]`；CursorPagination 仍由 Foundation 提供；首/末行 `canMoveUp/canMoveDown` 进入菜单 disabled | `areaMenuAction(ref, up/down)`、`pointMenuAction(ref, up/down)`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-02` 区域 Drawer | 右侧 Drawer；资料字段；固定 footer；关闭/Esc/遮罩/提交中由 Foundation dirty lifecycle | Drawer 与 footer 在 `1226-1303`；`adminDrawerSurfaceProps`、`useDrawerFormLifecycle`、固定 footer Button 均实际组合；字段 testId 在 `1274-1300` | `onClose`、`afterOpenChange`、`maskClosable`、`keyboard`、`closable`、submitting 均接 lifecycle；Form 只在 `onValuesChange` 把变化交给统一 lifecycle，不自行弹保存提示 | `areaDrawer`、`areaName`、`areaCode`、`areaType`、`areaStatus`、`areaCancel`、`areaSave`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-03` 桌台 Drawer | 桌台才有容纳人数、形态、预约和图片；扩展字段同一表单；不出现顺序字段 | `StoreServicePointPage.tsx:1305-1433` 使用同一 Drawer surface；桌台属性条件渲染在 `1383-1421`，扩展字段在 `1423-1430`，没有 order 控件；图片复用 `AdminImageCollectionEditor`（`169-233`） | `pointEditor.areaType` 固定决定字段集合；扫码点不挂载桌台属性和 `PointImageEditor`；保存由统一 point lifecycle 管理 | `pointDrawer('table')`、`pointName`、`pointCode`、`pointCapacity`、`pointShape`、`pointReservable`、`pointImageUpload`、`pointExtension`、`pointCancel`、`pointSave`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-04` 扫码点 Drawer | 与桌台同一 Drawer 族；仅核心资料和扩展字段；没有图片和桌台空位 | `StoreServicePointPage.tsx:1383-1430` 的桌台条件分支包住全部专属控件，扫码分支仅保留名称、编码和扩展字段；`pointDrawer` 按 `scan` 生成 | 用户标题和字段标签为扫码点；保存仍由 owner 重新校验类型，前端不提供技术类型选择 | `pointDrawer('scan')`、共享 `pointName`/`pointCode`/`pointExtension`/`pointCancel`/`pointSave`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-02` 详情 Drawer | 只读信息，不使用 disabled Form；类型标题正确；二维码结果只读 | `StoreServicePointPage.tsx` 使用 `adminDetailDescriptionsProps`、`Descriptions`、`AssetPreview` 和只读二维码 Card；标题从 `detailValue.pointType` 经 `areaTypeForPointType` 派生；二维码使用统一 `qrDisplayValue` | 详情编辑按钮从对象自身类型建立 editor，不从当前选区推断；详情失败有重试；扫码点不显示桌台属性；不可用对象只显示边界文案；可用合法 URL 只显示“查看二维码”入口，不显示原始 URL | `detailDrawer`、`detailAction`、`qrResult`、`qrResultLink(ref)`；`MATCHED_STATIC_PREFLIGHT` |
| `IA-SPQ-03` 二维码主页面区 | 主页面只有一个只读配置区；编辑打开独立 Drawer；不存在第二个二维码详情页 | 主页面二维码 Card 只读 `Descriptions` 与独立编辑 Drawer；服务点二维码由列表/详情统一展示函数消费 | 编辑入口仅在权限具备、配置读取成功且非 fetching 时出现；不可用对象不展示二维码入口；可用合法 URL 展示“查看二维码”入口；未开启/未选渠道和生成占位保持 owner 语义；保存后统一 refresh | `qrConfig`、`qrEdit`、`qrDrawer`、`qrEnabled`、`qrChannel`、`qrChannelOption`、`qrCancel`、`qrSave`、`qrResultLink(ref)`；`MATCHED_STATIC_PREFLIGHT` |

## 3. 销售菜单基线对照

| 对照项 | 销售菜单基线 | 本页实现 | 结论 |
| --- | --- | --- | --- |
| 左侧 master 选中 | 整行 Button、浅色选中背景、左侧强调线、`aria-current`、行末更多菜单（`SalesMenuPage.tsx:230-275`） | 区域行 `StoreServicePointPage.tsx:1108-1148` 同样组合 | `MATCHED` |
| 右侧表格 | `Table`、固定操作列、名称 link action、Foundation `adminListState`、CursorPagination（`SalesMenuPage.tsx:388-435`） | 服务点表 `StoreServicePointPage.tsx:1193-1211`；名称 link、固定操作列和 `adminListState` | `MATCHED` |
| 排序边界 | 上移/下移按行能力 disabled，点击不改变选中上下文 | 区域/服务点菜单 `817-917`，由 `canMoveUp/canMoveDown` 和 `canEdit` 控制 | `MATCHED` |
| Drawer 生命周期 | Foundation `useDrawerFormLifecycle`、固定 footer、提交中锁定 | 区域/服务点/二维码分别在 `353-383` 注册，Drawer 在 `1226-1588` 使用 | `MATCHED` |
| 失败恢复 | 错误面带真实重试动作，失败集合不冒充空态 | 区域 `1093-1101`、服务点 `1185-1192`、配置/详情/扩展定义 `1058-1067`、`1347-1356`、`1461-1469`、候选 `1542-1549` | `MATCHED` |

## 4. 本次对比发现并修复的偏差

以下不是为了补证据而改写的结论，而是对真实生产 JSX 与 IA 的行为偏差做的根因修复：

1. 删除首次加载自动选择第一条区域，以及新建区域成功后自动选择；现在选择是用户动作，符合 `IA-SPQ-01` 默认无选择状态。
2. 新增/编辑动作不再在权限缺失、主读取未稳定或二维码配置读取失败时以 disabled 控件误导用户；符合 IA 的动作可见性边界。
3. 区域非启用时，服务点状态除生命周期标签外明确显示“不可用”，但保留 owner 返回的存储值，不把后代改写为停用。
4. 详情编辑入口从详情对象自身 `pointType` 派生类型，消除切换区域后把对象送入错误表单的上下文漂移。
5. 二维码保存/取消和共享未开通 surface 补齐真实 testId 绑定；右侧服务点表改接 Foundation `adminListState`，统一 loading/failed/empty 状态并在失败时清空 rows。

## 5. 静态门结论

```text
IA_CONTROL_REVIEW=PASS_STATIC_PREFLIGHT
TESTID_REVIEW=PASS_STATIC_BINDING
IA_SCOPE=IA-SPQ-01,IA-SPQ-02,IA-SPQ-03
STATIC_POSITION_CHECK=PASS
STATIC_STYLE_BASELINE_CHECK=PASS
STATIC_BEHAVIOR_CHECK=PASS
CREATE_DRAWER_CHECK=PASS
EDIT_DRAWER_CHECK=PASS
SELECTION_CHECK=PASS
ORDERING_BOUNDARY_CHECK=PASS
FAILURE_RECOVERY_CHECK=PASS
DIRTY_GUARD=useDrawerFormLifecycle_ONLY
BROWSER_L2=NOT_AUTHORIZED
VISUAL_L2=NOT_RUN
```

该记录只解除“尚未完成 IA/testId 静态前置比对”的内部实现阻断，不授权 Browser L2；后续若 Dexter 单独授权 L2，仍须以当前字节执行动态控件与行为验证。
