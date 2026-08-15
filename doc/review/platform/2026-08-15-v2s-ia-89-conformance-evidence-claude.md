# IA 89 条逐条核验证据 · 面向 P3-2

> **这是证据文件,不是工单。** 它承载 2026-08-15 一轮六路并行核验的原始结论,
> 供 P3-2 工单引用。此前 P3-2 分析稿反复引用"扫描产物"却没有路径,实施者打不开——本文补上。
>
> **核验方法**:六路并行,每路先从 IA 规范源抄出本族条款原文,再打开当前树的实际组件核形态;
> **明令不先读任何评审文档或旧清单**(那些材料含大量已撤回与已过期结论,先读会被带偏)。
>
> **分母**:89,机器源 `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` §11.3,
> 另有三份 JSON 实例(`contracts/policy/catalog-inventory-assertion-matrix.json` 的 `iaIdCount: 89`)。五路独立复算收敛。
> ⚠️ **`76` 是已撤回口径**,来自三段式正则漏掉 13 条四段式 ID;76 + 13 = 89 闭合。
>
> **读这份文件要注意的三件事**
> 1. 标 `CONFORM` 的条目要求给出"实际打开了哪个组件的哪一段",**"看到组件存在"不算核过**
> 2. 各面的"我没能覆盖的部分"是**诚实声明**,不要当成已核
> 3. 部分结论已被后续裁定推翻(治理维度整套删除、挂牌价归销售集合域、`ordering` 页签删除等),
>    **以 `2026-08-15-v2s-p3-corrective-batches-claude.md` 的裁定为准**
>
> **归属统计说明**:此前分析稿写的「纯 P3-2 33 / 跨越两者 55 / 已被 P3-1 覆盖 13」三数相加 101 ≠ 89,
> 那是**按标记出现次数**统计的,不是按条目去重。**归属需以本文逐条为准重算。**

---


# 面 · 列表与状态

**范围**:IA-CAT-LIST-* 13 + IA-STATE-* 10,共 23 条

---

仓库根 `/Volumes/idea/catering-v2s`，以下路径均为仓库根相对路径。主要落点文件缩写：
- **WB** = `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx`
- **DRW** = `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- **MODEL** = `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`
- **OWNER** = `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- **COORD** = `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- **GEN** = `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`
- **FND-LIST** = `libraries/frontend/admin-ui-foundation/src/list/adminListState.tsx`

---

## 一、逐条对账（23 条）

**IA-CAT-LIST-001** | 三段左树(智能视图/形态/分类)、节点带计数、零计数仍显示；分类支持本地搜索、未分类、**启停**与层级维护 | ✅ WB:L218-226 三个 root(`smart-root`/`shape-root`/`category-root`)；计数经 `CatalogTreeLine count` WB:L50；零计数仍出 — OWNER:L1052-1053 用 `List.of(六个 viewKey)`+`CatalogOwnerTypes.SHAPES` 全量 `getOrDefault(...,0L)` 输出；树内搜索 `Input.Search` WB:L266 只喂 `treeData`/`searchExpandedKeys` 两个 useMemo，不进 `listQuery`；未分类节点 WB:L223；层级维护下拉 WB:L210-214 = 新建子分类/重命名/更换父分类/向上移动/向下移动/**删除分类** | **无"启停"**：下拉里没有停用/重新启用，改用"删除分类"；生成的 rtk 操作集只有 create/update/move/delete（`catalog-inventory-edge.rtk.ts:L14-17`），后端也无分类状态迁移端点。另：`全部商品` 被挂在「商品分类」root 下(WB:L222)，与 §5.1 线框把它放在树顶不一致 | **S** | 跨越两者（后端补分类 status transition；前端换控件） |

**IA-CAT-LIST-002** | 智能视图六项(待治理/外部临时/停用/归档/最近修改/自动同步)全部保留，**并解释只读、禁编、转正语义** | ✅ OWNER:L1052 `for (String key : List.of("GOVERNANCE_PENDING","EXTERNAL_ORDER_TEMP","INACTIVE","ARCHIVED","RECENTLY_UPDATED","AUTO_SYNC"))` 六项齐备；WB:L36 `smartLabels` 六项中文；WB:L219 渲染。运行期可用：OWNER:L2377 `validateItemPageQuery` 接受集恰为这六项+`ALL` | **无任何"只读/禁编/转正"说明**：选中「自动同步」或「外部订单临时」后工作台不出 banner（WB 全文无此元素），语义只在打开单个商品 Drawer 后才出现（DRW:L521 `sourceLocked`、DRW:L529 治理转正）。契约侧 `smartViewKey` 三方枚举不一致（GEN:L82 声明 `ALL/ENABLED/DISABLED/AUTO_SYNC/TEMPORARY/NEEDS_ATTENTION`，与 owner 实际集合不交）| **S**（banner 缺失）| banner 归 **P3-2**；枚举漂移 **已被P3-1覆盖(X-06)** |

**IA-CAT-LIST-003** | 左树节点先限定结果域；**显式显示"当前结果域"**；**冲突筛选禁用并解释原因** | ✅ WB:L122-131 `listQuery` 按 `treeSelection.kind` 分派 `smartViewKey`/`shapeKey`/`categoryRef+includeSubCategories`/`uncategorized`；结果域标签在 WB:L270 `Card title={`当前分类：${treeSelection.label}`}` | ①标签写死"当前分类"，选形态/智能视图时显示成「当前分类：普通销售商品」，不是 IA 的"当前结果域"。②**冲突筛选既不禁用也不解释**：WB:L195 仅在 SMART 分支静默 `setFilters({keyword: current.keyword})`，三个 Select(WB:L273-275) 之后仍可自由选，无 `disabled`、无原因文案。③**治理状态筛选选任一值必 422**：WB:L274 选项写死 `['READY','NEEDS_ATTENTION','BLOCKED']`，经 WB:L129 进 query，边缘层 `OperationsCatalogInventoryController.java:L110` 原样透传 `read.request()`，落到 OWNER:L2374 `if (governanceStatus != null && !CatalogOwnerTypes.STATUSES.contains(...) && !Set.of("GOVERNANCE_TODO").contains(...)) throw Problem("VALIDATION_ERROR",422)`，而 `CatalogOwnerTypes.STATUSES`(`.../catalog/api/CatalogOwnerTypes.java:L11`)=`DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED` — 三个选项无一命中；同时列表治理列(WB:L246)渲染的 `row.governanceStatus` 由 OWNER:L2109-2113 产出，取值域是 sections 值∪`GOVERNANCE_TODO`∪生命周期状态，与筛选词表零重叠 | **M** | ①②归 **P3-2**；③归 **跨越两者**（治理状态权威词表需裁定→`DEXTER_DECISION`，前端换选项、后端放行该词表）|

**IA-CAT-LIST-004** | 主列＝缩略图+名称+编码/**短名**+分类+**标签** 分层；编码小一号且弱化；标签最多 2 个 `+N` 收口；§5.3 复合主列内部**必须用 foundation `NameCodeText`** | ✅ WB:L242 单列内：`CatalogAssetPreview` 48×48 或"无图"；名称 `<Button type="link">`；编码 `<Typography.Text type="secondary" style={{fontSize:12}}>`；第三行 `itemReferenceSummary` WB:L66-76 做 `slice(0,2)` + `+${remaining}` 收口 | ①**主列没用 `NameCodeText`**：名称与编码是两个独立元素，不是 `名称(编码)`；同文件左树节点(WB:L214)、SKU 展开行(WB:L312)都用了，唯独主列没用。②**短名从未渲染**：`shortName` 在 GEN:L57 与 MODEL:L401 都有，WB 无读取点。③**第三行的"标签"不是商品标签**：`itemReferenceSummary` 拼的是分类名 + `生产标签 N` 计数；列表契约(GEN:L57)整体无商品标签字段，§5.3「标签筛选→主列分类/标签行」链路不存在 | **M** | ①②归 **P3-2**；③归 **跨越两者**（与 P3-1 的 X-07 tags 查询参数相邻但不是同一条）|

**IA-CAT-LIST-005** | 形态+SKU摘要；**区间价**+粒度+缺价；库存/BOM+**风险**，风险具备可解释 tooltip/跳转 | ✅ WB:L243 形态列 = shapeLabel + `${skuEnabledCount}/${skuNonArchivedCount} 个 SKU · 维度` 或"无 SKU"；WB:L244 价格列 = 单值或 `—`，副行 `priceGranularity` + `缺价 N`；WB:L245 = `N 个库存对象 / M 个 BOM` + `riskFlags.map(<Tag color="warning">)` | ①**无区间价**：GEN:L57 列表项只有 `standardSalePrice/listedSalePrice/standardPriceDelta/standardExtraPrice` 四个标量，无 min/max，SKU 粒度商品在列表只能显示单值或 `—`；§5.1 线框明写 `¥28~34`。②**风险恒为空**：全后端唯一写入点是 OWNER:L2084 `item.putArray("riskFlags")`（空数组），`COORD.enrichCatalogItems`(COORD:L814-841) 只回填 `stockTargetCount`/`bomCount`，不碰 `riskFlags`；全仓再无第二处 `riskFlags` 写入 → 风险 Tag 永不渲染，tooltip/跳转无落点 | **M** | 均 **跨越两者** |

**IA-CAT-LIST-006** | 删除菜单与渠道/套餐引用列，且不得从列设置恢复 | ✅ WB:L239-247 列 exact-set = SELECTION、EXPAND、商品、形态/规格、价格/粒度、库存/BOM(品牌页为「库存对象/BOM 定义」)、状态/治理、来源、更新时间、版本(hideInTable)。`ColumnSetting` 的候选就是这个 `columns` 数组（`node_modules/@ant-design/pro-components/es/table/components/ToolBar/index.js:L51-57` 把 `columns` 原样传给 ColumnSetting），不存在的列无法恢复 | 无 | **CONFORM** | — |

**IA-CAT-LIST-007** | SKU 展开行懒加载；loading/空/失败显式；子行不批选；补持久错误与重试 | ✅ WB:L301-318 `CatalogSkuExpandedRow`：仅展开时挂载 + `skip: !dataNodeRef || !itemCode` → 懒加载；WB:L305 `Skeleton`；WB:L306 `Alert type="error"` + `重试` Button（持久，非 toast）；WB:L308 空态文案；行内用 `Space`/`Typography`/`Tag` 渲染，非嵌套 Table，无 checkbox → 子行不批选 | 无（形态成立）| **CONFORM**（N 级备注：WB:L279 `rowExpandable: row.skuNonArchivedCount > 0` 使 L308 空态分支近乎不可达；展开行拉的是整份商品详情 `getOperationsCatalogItem` 而非 SKU 子资源）| — |

**IA-CAT-LIST-008** | 导入/导出本期 Out，不渲染 | ✅ WB:L258-262 全局工具行仅 `商品字典`/`从品牌复制`/`新建商品`；`catalog-management` 全目录无 import/export 控件 | 无 | **CONFORM** | — |

**IA-CAT-LIST-009** | 门店由 workspace 数据节点选定、页面不重复 owner selector；商品字典只读可进入；无导入导出；**新建商品仅按写 capability 隐藏**；从品牌复制须额外满足门店来源事实，不满足则不占位不置灰 | ✅ 门店面无 owner selector（WB:L256 的 Select 有 `surface === 'brand'` 守卫）；scopeRef 来自 Shell `selectedScopeRef`(`apps/frontend/operations-admin/src/app/OperationsApp.tsx:L137-141`)；商品字典 Button WB:L259 无 capability 条件，`canWrite` 只下传给 Drawer → 只读可进入；从品牌复制 WB:L260 条件含 `context.headCompanyRef && context.brandRef && context.copySourceAvailable && context.actionAvailability.canCopy`，这三项由 `COORD.enrichWorkbenchContext`(COORD:L464-475) 调 `catalogScopes.resolveCatalogCopySource` 真实判定后覆盖 → 不占位不置灰 ✅ | **新建商品把业务可执行性也做成了隐藏**：WB:L261 `canWriteCatalog && context?.actionAvailability.canCreate && <Button…>`。今天不可见（OWNER:L1039 `workbenchContext` 把 `canCreate/canEdit` 硬写 `true`，enrich 只覆盖 `canCopy`），但接线方向与 IA-STATE-007 相反；`actionAvailability.reasons`（MODEL:L253 已解码）全仓无渲染点 | **S** | **P3-2** |

**IA-CAT-LIST-010** | 先 session 选 HEAD_COMPANY，再页内选已授权品牌；品牌切换器在全局工具行紧随视图切换、是 owner 上下文不是表格筛选；品牌变化原子重建全部上下文并受 generation guard 保护 | ✅ WB:L112 `headCompanyQuery` 带 `skip: surface !== 'brand' || !queryContext.scopeRef`；WB:L113 只取 `status === 'ENABLED'` 的授权品牌；WB:L256 `<Select>` 与 WB:L255 `<Segmented>` 同一个 `<Space>`，位置紧随其右；WB:L188-191 `changeBrand` 先 `generation.begin()` 再重置 treeSelection/keyword/filters/cursorStack/selectedRows/expandedRows/treeExpandedKeys；WB:L118 headers 带 `X-Workspace-Brand-Ref`，context/navigation/items 三个 request 全 memo 在 headers 上；WB:L140-141 用 `currentData`（并有注释说明为何不能用 `data`）→ 切换期间不显示旧品牌数据 | 无（形态成立）| **CONFORM**（N 级备注：WB:L114-117 自动选中 `brands[0]`，用户从不经历"未选品牌"；`brands` 为空时的落态见 IA-STATE-002 差异 C）| — |

**IA-CAT-LIST-011** | 品牌页列表只显示"库存对象/BOM 配置摘要"，不得出现当前库存或库存状态 | ✅ WB:L245 列标题 `surface === 'brand' ? '库存对象 / BOM 定义' : '库存 / BOM'`，内容 `${row.stockTargetCount} 个库存对象 / ${row.bomCount} 个 BOM`；GEN:L57 列表项无 balance/stockState 字段，WB 无余额或库存状态渲染点；COORD:L814-841 回填只取 `targetCount`/`bomCount` 两个字段，不取余额 | 无 | **CONFORM** | — |

**IA-CAT-LIST-012** | 查询参数 = 树节点 + keyword + status + governance + source + **tags** + cursor；分类含后代；切节点保留关键词、清空分页/选中/展开并取消旧请求；节点点击不防抖、按 generation 只接纳最后响应、相同有效查询去重；关键词只在 Enter/搜索按钮提交；切智能视图时状态/治理/来源按系统视图规则**清除或锁定**；左树搜索与结果域搜索不共用 state/placeholder/locator | ✅ WB:L122-131 参数齐（除 tags）；`includeSubCategories: true` WB:L128 + OWNER:L1091-1095 `WITH RECURSIVE category_scope` 真实取后代；WB:L192-196 `selectTree` 保留 keyword、清 `cursorStack/selectedRows/expandedRows`、`generation.begin()`；WB:L132 `queryGeneration` 随请求发出(WB:L133)，WB:L148 校验 `next.queryGeneration !== queryGeneration` 且 `generation.isCurrent(...)` 才接纳，OWNER:L1089 及分页出口回写该值；相同查询由 RTK arg 缓存去重（`queryGeneration` 是查询的确定性函数）；WB:L272 `Input.Search` 的 `onChange` 只写 draft、`onSearch` 才提交；左树搜索独立 state `treeSearch`、独立 placeholder「搜索分类名称/编码」、独立 testId `catalog-inventory-tree-search` vs `catalog-inventory-local-search` | ①**tags 参数与 tags 控件双缺**（GEN:L82 `CatalogItemPageQuery` 无 tags；WB 筛选行无标签控件）。②**只"清除"不"锁定"，且对「全部商品」也清**：WB:L195 对所有 `kind === 'SMART'`（含 `ALL`）一律清空 status/governance/source，用户在"全部商品"下设的筛选会因再次点"全部商品"而丢失 | **S** | ①契约侧 **已被P3-1覆盖(X-07)**、前端控件侧 **P3-2**；②**P3-2** |

**IA-CAT-LIST-013** | 全局工具行与结果域工具行不混排；第一行左视图切换、右字典/复制/新建；第二行在结果域内含当前节点、局部关键词、其余筛选、**批量操作**、列设置；视图切换不改结果域或查询条件 | ✅ 第一行 Card WB:L253-263（左 `Segmented`+品牌 Select，右三个 Button）；第二行 Card WB:L270-278（当前节点标题 + 局部搜索 + 三个筛选 Select + 重置）；列设置由 ProTable 默认提供 — 页面只传 `options={{reload: refresh, density: false}}`(WB:L279)，`node_modules/@ant-design/pro-components/es/table/components/ToolBar/index.js:L94-110` 的合并是 `{...defaultOptions, fullScreen:false, ...propsOptions}`，`setting: true` 保留，L51-57 渲染 `<ColumnSetting/>`；视图切换只出现在 WB:L255 setter 与 WB:L265 条件渲染，不进 `listQuery` ✅ | **批量操作缺失**：WB:L279 有 `rowSelection`，但 `toolBarRender` 只回一个「已选择 N 项 + 取消选择」摘要，无任何批量动作。另：列设置落在 ProTable 自己的 toolbar（第三条），不在第二行 Card 内 | **S** | **P3-2**（本期批量动作集合需裁定 → `DEXTER_DECISION`）|

**IA-STATE-001** | 三页均先显示当前管理范围；门店两页落到门店，品牌页先落总公司再选品牌 | ✅ `apps/frontend/operations-admin/src/app/components/OperationsRequiredScopeSurface.tsx:L14-19` 在 children 之前渲染 `OperationsDataScopeContextBar`；后者 `.../OperationsDataScopeContextBar.tsx:L43` 输出「当前门店：大区 / 项目 / 门店」或「当前总公司：X」，全部走 `NameCodeText`；未选时 L42 出 Alert「请在左下角选择要管理的门店。」品牌页在此之上再由 WB:L256 页内 Select 选品牌 | 无 | **CONFORM** | — |

**IA-STATE-002** | 八态互斥：首次加载、**局部刷新**、失败、**无权限**、**无候选节点**、未选范围、真实空数据、**大结果拒绝**；失败不得只 toast 后伪装成空列表 | ✅ 失败为持久 Alert + 重试（WB:L249 `failed`、WB:L252），不是 toast；未选范围由 Shell 的 `OperationsRequiredScopeSurface` 拦住整页 | **FND-LIST:L12-17 `adminListState` 只提供三态**（loading / failed / empty），导致四态缺位：①**局部刷新伪装成真实空数据**：WB:L197 `refresh()` 与 WB:L142-145 的 effect 都执行 `setAcceptedPage(undefined)` → `page.items=[]`；而 loading 判据是 `itemsQuery.isLoading && !itemsQuery.currentData`(WB:L279)，refetch 时 RTK 的 `isLoading` 为 false、`currentData` 仍在 → loading=false、failed=false、dataSource=[] → 渲染 `<Empty description="当前结果域暂无商品"/>`；保存成功回调 `onChanged={refresh}`(WB:L282)、错误 Alert 的重试、ProTable reload 三条路径都会闪空态。②**无权限未与失败分离**：`SCOPE_FORBIDDEN`(GEN:L4 已有该 code) 落进同一个 `failed` 布尔，显示通用「暂时无法获取…请重试」，列表层不读 problem code。③**无候选节点未与真实空数据分离（品牌页）**：`brands` 为空 → `brandRef` 恒 undefined → WB:L119 `scopeReady` false → 三查询全 skip → 同样落「当前结果域暂无商品」。④**大结果拒绝不存在**：GEN:L4 的 TOO_LARGE 只有 `COPY_CLOSURE_TOO_LARGE`/`COPY_SELECTED_ITEMS_TOO_LARGE` 两个复制态；列表侧只有 OWNER:L2396-2400 的 `pageSize` 1..100 夹取，无"结果过大→请缩小筛选（不截断）"typed failure，前端无对应分支 | **M**（①为 M；②③④为 S）| ①②③ **P3-2**；④ **跨越两者** |

**IA-STATE-003** | 切门店、品牌、左树节点或形态时，旧异步响应不得覆盖新上下文 | ✅ 三条通道都亲验：**树节点/形态** — `queryGeneration` 回声校验 WB:L146-150 + `useAsyncGenerationGuard` 计数(`libraries/frontend/admin-ui-foundation/src/behavior/asyncGeneration.ts:L14-21`)；**品牌** — WB:L188 先 `generation.begin()`，headers 变导致三个 request memo 全变，WB:L140-141 用 `currentData` 而非 `data`（源码内有注释说明该选择）；**门店** — `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java:L148` 的 selectDataNode SQL 带 `context_version=context_version+1`，Shell 用 `<registration.Component key={session.contextVersion}>`(OperationsApp:L171) → 换门店整页重挂载，旧响应无处可写（我原先怀疑"旧门店的 categoryRef 会带进新门店"，据此实际执行**证伪**）| 无 | **CONFORM** | — |

**IA-STATE-004** | 所有 Drawer/Modal 注册 overlay lock；编辑 dirty 时关闭、切查看、切范围均**二次确认** | ✅ 五个 catalog Drawer 全走 `useDrawerFormLifecycle`，其内部 `libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts:L83-85` 调 `useOverlayLock(open)` + `useDirtyFormLock(open && dirty)`；同文件 L144-173 `requestClose` 在 dirty 时弹 `modal.confirm`「放弃当前填写内容？」 | ①**分类 Modal 未注册 overlay lock**：WB:L286 是裸 `<Modal open={Boolean(categoryAction)}>`，无 `useOverlayLock`/`useDrawerFormLifecycle`；内含分类编码/名称输入(WB:L291-292)，`onCancel={closeCategoryAction}` 直接关闭无二次确认，且它打开时 Shell 的菜单/Tab/范围选择器不锁。②切范围是"禁用"而非"二次确认"，且触发条件是 `locked = overlayLocked \|\| dirtyLocked`(OperationsApp:L79-80/104/197/242/253) — 仅打开一个**未 dirty 的只读查看抽屉**就把整个 Shell 菜单、Tab、范围选择器全部置灰，比 IA 要求更重 | **M**（①）/ **N**（②，偏保守非放行风险）| **P3-2** |

**IA-STATE-005** | 紧凑表格、**sticky 工具栏**、**固定主列**、列设置、横向滚动；默认列只放高频事实，技术列经列设置开启 | ✅ WB:L279 `size="small"`（紧凑）、`scroll={{x: 1120}}`（横向滚动）；列设置见 IA-CAT-LIST-013 的 ProTable 默认合并证据；WB:L247 `{title:'版本', dataIndex:'version', hideInTable: true}` → 技术列默认隐藏、可经列设置开启 | **sticky 工具栏与固定主列都缺**：WB 全文无 `sticky` prop、无 `fixed: 'left'`（对该文件 grep `sticky\|fixed` 命中 0），`apps/frontend/operations-admin/src/styles.css` 也无 sticky 规则。1120px 横向滚动下主列会滚出视野 | **S** | **P3-2** |

**IA-STATE-006** | 列表用 v4 式复合主列；关联实体、范围标签、层级路径用"名称 + 弱化小号编码" | ✅ 主列在形态上确为复合（图 + 名 + 码 + 摘要行，WB:L242）；范围标签走 `NameCodeText`(`OperationsDataScopeContextBar.tsx:L43`)；左树分类节点(WB:L214)与 SKU 展开行(WB:L312)走 `NameCodeText` | ①主列自身不走 `NameCodeText`（同 IA-CAT-LIST-004 差异①）。②主列第三行的关联实体是**裸名称无编码**：WB:L67-69 `itemReferenceSummary` 只取 `navigation.tree.find(...)?.name`，同一对象上的 `node.code` 就在手边却未使用 | **M** | **P3-2** |

**IA-STATE-007**（按 2026-08-08 裁决解释）| 缺页面读权限→不注册/不可进入；有读权限但无对应 scope 写 capability→写按钮**不渲染**；有写 capability 但因状态/引用/owner/字段事实不可执行→**disabled + 具体原因** | ✅ 读权限：`session.pageAccessKeys` ← 服务端 `entry.selected.pageDesignKeys`，`accessiblePages`(OperationsApp:L90-93) 据此构造菜单/Tab/路由解析，未命中落 `<Alert title="当前角色没有该页面准入"/>`(OperationsApp:L172)。scope 专属能力：WB:L105-106 `editCatalogCapability = surface === 'brand' ? 'EDIT_HEAD_COMPANY_CATALOG' : 'EDIT_STORE_CATALOG'`，与裁决一致；`canWriteCatalog` 控制新建/复制/分类维护入口(WB:L210/221/260/261)→ 不渲染 ✅ | **业务阻断被做成隐藏而非 disabled+原因**：DRW:L524-526 的 编辑/启用/停用/归档 四按钮条件都是 `mode==='view' && canWriteCatalog && action?.canEdit(canEnable/canDisable/canArchive)`，不满足即不渲染；而**同一个 `<Space>` 里** DRW:L527 的「作废并重建」却是正确形态 `disabled={!action?.voidAvailability?.canVoid} title="存在 owner 阻断事实，暂不能作废"`。工作台侧 WB:L261 同样把 `canCreate` 并进渲染条件；`actionAvailability.reasons` 全仓无渲染点 | **M** | **P3-2** |

**IA-STATE-008**（原文已被 2026-08-08 裁决 supersede：高级诊断是已进入库存页且 owner scope 有效时的**普通第六区读取，不因 capability 隐藏**）| ✅ `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx:L139-144` 的「⑥ 高级诊断」直接写在 `zoneItems` 数组里（`...([{...}])` 只是对字面量单元素数组的展开，无任何条件），只要 `currentView` 存在且身份未阻断(L157)即渲染；请求条件是 `shouldRequestInventoryDiagnostics(zoneLoaded('diagnostics'))`(L67)，而 `.../inventoryManagementModel.ts:L77-79` 该函数只 `return drawerOpen` — 即"用户展开该区才拉"；该文件对该区无 capability 判断，无锁图标、无空壳、无占位 | 无（对裁决后的形态成立）| **CONFORM**（N 级备注：空展开 `...([...])` 与恒等函数 `shouldRequestInventoryDiagnostics` 是旧 capability 门拆除后的残留，读代码时易被误认为"还有条件"）| — |

**IA-STATE-009** | Drawer/Modal 在加载、空结果、失败、版本冲突、重试后保持输入/步骤；**成功关闭后焦点回到触发按钮**；列表保持原筛选、树节点、分页与**展开行** | ✅ 保持输入：`useDrawerFormLifecycle` 只在 dirty 放弃确认后或 `itemCode` 清空后 `reset()`；失败路径 DRW:L312-314 只 `setProblem(...)`+`setSubmitting(false)`，不动表单；分类 Modal 失败 WB:L185 只 `setCategoryProblem` 不 `resetFields`。列表保持：WB:L197 `refresh()` 不动 `filters/treeSelection/cursorStack/expandedRows` | ①**焦点不回触发按钮**：`catalog-management` 全目录 `.focus()` 只有一处（DRW:L192 的错误摘要自聚焦），`libraries/frontend/admin-ui-foundation/src/list/useDetailDrawer.ts:L1-25` 完全不管焦点；对照组 `InventoryDetailDrawer.tsx:L86-93` 用 `actionTriggerRef.current?.focus()` 做了正确回焦，说明能力已存在只是未用。②**"保持展开行"在视觉上不成立**：`refresh()` 的 `setAcceptedPage(undefined)` 使 `expandedRowKeys` 保留但对应行被清空（与 IA-STATE-002 差异①同根因）| **S**（①）/ **M**（②，与 IA-STATE-002① 合并计一处修复）| **P3-2** |

**IA-STATE-010** | 键盘顺序先标题/范围→页签/主操作→表单；错误摘要可聚焦并**跳到首个错误页签/字段**；Esc 只在无 dirty、无未提交预检且 overlay lock 允许时关闭 | ✅ Esc：DRW:L522 `onClose={lifecycle.requestClose}`，antd Drawer 默认 `keyboard` 开启 → Esc 走 `requestClose` → dirty 时弹确认(`useDrawerFormLifecycle.ts:L146-172`)；同行 `maskClosable={!lifecycle.dirty}`。错误摘要可聚焦：DRW:L535 `<div ref={problemRef} tabIndex={-1}>` + DRW:L189-192 `requestAnimationFrame(() => problemRef.current?.focus())`。跳首个错误页签：手写校验分支会 `setActiveTab(...)` + 具体文案（DRW:L214-216、L229-234）→ **部分成立** | ①**antd Form 的 `validateFields()` 路径没有页签跳转**：DRW:L218 `const values = await form.validateFields();` 直接 await，拒绝时异常上抛，`submit()` 外层未把 `errorFields` 映射到页签/字段（对照分类 Modal WB:L184 也只是 `if ('errorFields' in error) return`）；全文件无页签错误计数徽标（grep `errorCount\|Badge` 命中 0）。②**键盘顺序本身未实测**：页面无显式 tabIndex 编排，DOM 顺序为 错误Alert→全局工具行→左树→筛选→表格，与要求大体一致，但"当前范围"由 Shell 在 tab body 之外渲染，焦点序列**未验证** | **S** | **P3-2** |

---

## 二、本面覆盖确认

| 分组 | 总数 | CONFORM | 有差异 | 未验证 |
| --- | --- | --- | --- | --- |
| `IA-CAT-LIST-001..013` | 13 | 5（006、007、008、010、011） | 8（001、002、003、004、005、009、012、013） | 0 |
| `IA-STATE-001..010` | 10 | 3（001、003、008） | 7（002、004、005、006、007、009、010） | 0 |
| **合计** | **23** | **8** | **15** | **0** |

8 + 15 + 0 = 23 ✅。每条 CONFORM 均给出了实际打开的组件与行号段落，未以"组件存在"作判。`IA-STATE-010` 计入"有差异"（差异①已实证），其中的键盘顺序子项单独标注为**未验证**，不另计一条。

严重度分布：**M = 7**（LIST-003、LIST-004、LIST-005、STATE-002、STATE-004、STATE-006、STATE-007，其中 STATE-009② 与 STATE-002① 同根因合并）· **S = 8** · **N = 3**（含在 CONFORM/差异条目内的备注）。
归属分布：**P3-2 = 11 条** · **跨越两者 = 5 条**（LIST-001 分类启停、LIST-004③ 商品标签字段、LIST-005 区间价与 riskFlags、STATE-002④ 大结果拒绝、LIST-003③ 治理状态词表）· **已被P3-1覆盖 = 2 条**（LIST-002 的 smartViewKey 枚举漂移 X-06、LIST-012 的 tags 查询参数 X-07）。

---

## 三、我没能覆盖的部分（诚实清单）

1. **未跑任何测试、容器、构建或迁移**（按约束）。全部结论来自静态读源码 + 契约生成物 + 后端 SQL/校验分支，没有一次真实 HTTP 往返。IA-CAT-LIST-003③ 的「治理状态筛选必 422」是三段静态链路推出的（前端选项集 → 边缘透传 → owner 白名单），**未经运行时证实**；反例条件是：若存在我没读到的边缘层参数改写或 owner 侧另一条 items 入口，则该结论不成立。
2. **视觉层面未看过一次真实渲染**：紧凑度、编码"小一号且弱化"的实际视觉权重、`+N` 收口在窄列下的截断、`ellipsis`/tooltip 表现，全部只按代码判形态，**未做像素或 live 核验**。
3. **IA-STATE-010 的键盘 tab 序**只按 DOM 顺序推断，未实测；`aria`/焦点陷阱、Drawer 打开时的初始焦点位置未验。
4. **`IA-STATE-002` 的"首次加载"骨架**只核了 `adminListState` 的 loading 分支存在，未核 `contextQuery`/`navigationQuery` 首次加载时左树是否有独立骨架（§4.3 要求"首次骨架"），左树在 `navigation` 未到时的形态未单独判定。
5. **`IA-CAT-LIST-002` 的"零计数仍显示"只核了 smartViews 与 shapeCounts**（owner 用固定 `List.of` 全量输出），**分类节点的零计数未核** — 分类来自 SQL 行，本身不存在的分类自然不出现，但"存在但计数为 0 的分类是否仍渲染"我核了 `renderCategory` 无计数过滤（WB:L215/L224 只按 `categoryMatches` 名称过滤），判为成立，**但未验证 SQL 是否会漏出零计数分类行**。
6. **`itemRef` 在列表响应中缺失**是我顺带发现的事实（OWNER 的 `itemSummary`(L2072-2085) 无 `put("itemRef",...)`，只有 `itemDetail`(L2128) 有；GEN:L57 却声明为必填）。它不落在我这 23 条的任何一条形态要求上，也不在 P3-1 已列的五条漂移里，**我不确定它是否已被别的面认领**，在此仅登记不计入分母。
7. **未读任何评审文档或旧清单**（按要求）。因此若某条差异已被其他工单认领，我不知情；`归属` 列的去重只对照了提示中明列的 P3-1 五条漂移 + 三类覆盖面。

---

## 四、最值得先修的三条

**1. `IA-CAT-LIST-003③`：治理状态筛选选任一值即 422，整张列表挂掉。**
前端 `['READY','NEEDS_ATTENTION','BLOCKED']`(WB:L274) 与 owner 白名单 `DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED ∪ {GOVERNANCE_TODO}`(OWNER:L2374 + `CatalogOwnerTypes.java:L11`) **零交集**，且治理列渲染的取值域(OWNER:L2109-2113)与筛选选项也零交集。这是三条里唯一让用户**用不了页面**的：不是显示不完美，是点一下筛选就白屏报错，而且报的是通用「暂时无法获取…请重试」，重试永远失败。修它之前，这一面的其他任何验收都跑不完整。它同时暴露一个更深的问题——**治理状态的权威词表到底是什么**（生命周期状态？还是独立的治理维度？）——这需要 Dexter 一句裁定（`DEXTER_DECISION`），否则前端改成什么都是猜。放第一是因为"阻断 + 需裁定"两项叠加，越晚裁越贵。

**2. `IA-STATE-002①` / `IA-STATE-009②`：局部刷新被伪装成真实空数据。**
IA-STATE-002 是**逐字禁止**这件事的（"失败不得只 toast 后伪装成空列表"，同句列出"局部刷新"与"真实空数据"必须互斥）。当前每一次保存成功(WB:L282 `onChanged={refresh}`)、每一次点重试、每一次 ProTable reload，用户都会看到自己刚编辑完的商品库变成"当前结果域暂无商品"再闪回。根因单一且集中：`refresh()`(WB:L197) 与 WB:L142-145 的 effect 无条件 `setAcceptedPage(undefined)`，而 `adminListState`(FND-LIST:L12-17) 的 loading 判据 `isLoading && !currentData` 在 refetch 场景恒为 false。这条同时把 IA-STATE-009 的"列表保持展开行"一并证伪。放第二是因为**代价与收益比最好**：一处判据 + 一处清空时机，修完同时闭两条 IA，且 foundation 侧的三态是两个 App 共用的，修在 foundation 收益外溢。

**3. `IA-STATE-007`：有写 capability 但业务阻断时按钮直接消失，用户无从分辨"我没权限"和"这个商品现在不能改"。**
DRW:L524-526 的 编辑/启用/停用/归档 全部隐藏式，而**同一个 `<Space>` 的下一行** DRW:L527「作废并重建」已经是正确形态（`disabled` + `title` 具体原因）——所以这不是能力缺失，是四个按钮漏改，正确样板就在旁边一行。业务后果是实打实的：一个有 `EDIT_STORE_CATALOG` 的门店店长打开一个被引用锁住的商品，看到的是一个**没有任何按钮的抽屉**，他会去找管理员要权限，而他本来就有权限——问题出在这个商品的状态上，而这句话页面一个字都没说。`actionAvailability.reasons` 后端已经在传、前端已经在 decode(MODEL:L253)、就是没有渲染点。放第三是因为它**修起来最小**（四个条件从 `&& canX &&` 改成 `disabled={!canX} title={reason}`），但对"用户能不能自己走下去"的影响最大。

紧随其后的是 `IA-CAT-LIST-005②` riskFlags 恒空（OWNER:L2084 唯一写入点就是空数组，整个"风险"半列是死的，而这半列正是 IA 给复合列的全部理由——"把问题放在决策点"）与 `IA-CAT-LIST-004①`/`IA-STATE-006` 主列不走 `NameCodeText`（DEC-IA-02 与 name-code-density 的直接落点，同文件另外两处都用对了）。这两条我没放进前三，是因为前者要先定"风险事实由谁产出"（跨 owner，比一次前端修复重），后者不阻断用户完成任务。


# 面 · 商品抽屉页签与详情与图片

**范围**:IA-CAT-TAB-* 9 + IA-CAT-DETAIL-* 4 + IA-CAT-MEDIA-* 3,共 16 条

---

核完 16 条。以下逐条记录（每条 IA-ID 一条，无合并、无抽样，符合的也列出）。

---

## 逐条对账

**IA-CAT-DETAIL-001** | 严重度 **N** | 归属 **P3-2**
- IA 要求：`min(1024px, calc(100vw - 48px))`；view/edit 同 Drawer 切换（§4.2 表，行 213）
- 当前实际：✅ `libraries/frontend/admin-ui-foundation/src/overlay/drawerSurface.ts:16-19` `adminWideDrawerSurfaceProps = {...adminDrawerSurfaceProps, width: 1024}`——固定像素，无 max-width/calc。✅ `CatalogItemDrawer.tsx:522` 展开该 props；✅ view↔edit 确在同一 Drawer 内由 `mode` 切换（`:85` `useState<'view'|'edit'>`、`:524` 编辑按钮、`:532` 保存按钮）
- 差异：窄视口不收缩，无 `calc(100vw - 48px)` 下限保护；「同 Drawer 切换」这半 CONFORM

**IA-CAT-DETAIL-002** | 严重度 **S** | 归属 **P3-2**
- IA 要求：可编辑性、blocked reason、关闭/切态/切范围确认（行 214）；§6.4 保存失败＝首错摘要＋页签错误计数＋字段聚焦
- 当前实际：✅ 关闭 dirty 确认成立——`useDrawerFormLifecycle.ts:157-172` `modal.confirm('放弃当前填写内容？')`，`CatalogItemDrawer.tsx:164` 接线。✅ 切范围以「禁用」代替「确认」：`OperationsApp.tsx:79-80,184` `RoleContextSelector disabled={locked}`，`overlayLock.tsx:41` `locked = overlayLocked || dirtyLocked`。✅ 保存失败只有一个 Alert（`:535`）＋ `problemRef.focus()`（`:190-193`）
- 差异：① **编辑→查看的「切态」不存在**——编辑态唯一的退出控件「取消」`:531` `onClick={lifecycle.requestClose}`，走的是关闭整个 Drawer，§6.4 状态机里的 `编辑 ──切查看──> 查看` 无实现；② 无页签错误计数、无字段聚焦（客户端前置校验只做 `setActiveTab` ＋「第 N 行」文案，`:231/235/247/257/261`）；③ 可编辑性只覆盖两字段——`deniedFields` 仅用于 `:599` name、`:600` shortName，而 owner 侧 `CatalogOwnerService.java:2103-2108` 的 denied 集合可以是 `sections.deniedFields` 里任意声明值，命中 images/attributes/orderOptions 时 UI 全可编辑、保存被 `:2111-2119` 422 拒。**适用条件**：③ 仅在声明了非默认 denied 集合时发生；AUTO_SYNC 默认集合是 `{name, code}`，此时 UI 正确

**IA-CAT-DETAIL-003** | 严重度 **M** | 归属 **跨越两者**
- IA 要求：标题区缩略图＋名称；名称/编码/短名为独立事实；**顶部显示形态、状态、治理、来源**；动作按 capability 显示/禁用**并给原因**（行 438）
- 当前实际：✅ `CatalogItemDrawer.tsx:522` 标题 = 缩略图 `CatalogAssetPreview` ＋ `NameCodeText(name, code)` ＋ `<Tag>{shapeKey}</Tag>` ＋ `<Tag color={detail.item.status==='ENABLED'?'green':'default'}>{detail.item.status}</Tag>`。✅ 短名/编码作为独立事实在基础资料只读网格 `:603`
- 差异：① **状态徽章恒为空字符串**——owner 的 `CatalogOwnerService.java:2127-2159 itemDetail()` 从不 put `status`/`governanceStatus`（只 put `lifecycle.status` 与 `source`），生成契约 `catalog-inventory-edge.ts:58` 的 `data.item` 也无这两字段，而前端 `catalogModel.ts:401` 用同一个 `decodeItemSummary` 读 `row.status` → `text(undefined)` = `''`。**对照证据**：同文件 `:2069 itemSummary()`（列表投影）**确实** put 了 `status` 与 `governanceStatus`——两个投影不对称，列表正常、详情空。连带：`:528` `status !== 'VOIDED'`、`:529` `status !== 'ARCHIVED'` 恒真，Tag 永不变绿；② 顶部无治理、无来源（来源只有 AUTO_SYNC/TEMPORARY 两条 Alert `:536/:538`，SELF_MANAGED/COPIED 无任何显示）；③ 动作是**条件渲染隐藏**而非 disabled＋原因（`:524-527`），且 owner `:1184-1188` 的 actionAvailability 四个布尔位**没有任何 reason 字段**可供渲染
- 归属拆分：前端改读 `lifecycle.status`／`governance.status` ＋ 补顶部来源徽章＝P3-2；actionAvailability 增 reason ＝ 契约新增，**不在 P3-1 五条漂移内**

**IA-CAT-DETAIL-004** | 严重度 **S** | 归属 **跨越两者**
- IA 要求：查看态不是整体 disabled；每页签独立只读表达；与编辑页签同顺序；逐页签空态与风险表达（行 462 及其表）。§6.2 形态—页签矩阵
- 当前实际：✅ 十个页签均有独立只读分支，逐一亲验：`:602`基础 `:609`条码 `:611`SKU `:613`ordering `:615`属性 `:617`点单选项 `:626`生产提示 `:630`库存BOM `:632`套餐 `:633`治理，**没有一处是把编辑表单 disabled**。✅ 顺序同源——编辑与只读共用 `:516` 的同一份 `detail.tabs` 数组
- 差异：① 基础资料只读缺 IA 明列的「描述属性仅显示『已维护 N 项』及跳转」（`:602-607` 无属性摘要、无跳转），缺「未分类」「缺标签」提示（无图 → `:987` `'未配置图片'` ✅）；② 治理只读缺生命周期/版本/来源/外部身份/禁止动作原因（见 TAB-008）；③ SKU 只读无「缺价/重复/停用逐行标记」（`:737` 只列事实）；④ **页签矩阵有一处偏离**：`contracts/catalog/catalog-item-editor-manifest.json` `tabRules` 中 `STANDARD_SALE_COUNTED` 与 `STANDARD_SALE_WEIGHED` 的 `visible` 为 8 项，多出 `ordering`；IA §6.2 该两形态只列 7 项且把标准价放在基础资料内。其余 5 个形态（SKU/MATERIAL/COMPOSITE/SERVICE/BENEFIT_SHELL）与 IA **逐项一致**

**IA-CAT-TAB-001 基础资料** | 严重度 **M** | 归属 **跨越两者**
- IA 要求（`:479-491` 原文）：商品形态\*（仅创建可选；编辑只读）· 编码\*（创建即时校验；编辑只读）· 名称\* · 短名 · **分类 [饮品 ▼]** · **商品标签 [招牌 ×][快速维护]** · **销售单位 [杯(CUP)▼][快速维护]** · **标准价 [按粒度激活]** · itemKind/measureMode/usageCapabilities 只读派生摘要 · **MATERIAL 时 materialRole** · 图片多图上传/排序/主图 · **属性摘要 [转到属性页]**
- 当前实际：✅ 编辑态 `CatalogItemDrawer.tsx:597-601` 全部内容＝ Alert「商品编码与形态创建后不可修改」＋ 名称 `<Input>` ＋ 短名 `<Input>` ＋ `<CatalogAssetEditor>`，共三个控件。✅ 只读态 `:602-607` ＝ 名称/短名/编码/形态/状态/itemKind/计量模式/使用能力/版本 ＋ 图片 gallery
- 差异（逐项落点）：
  - **分类无任何写入控件**：全仓 `categoryRefs` 仅两处——`CatalogItemDrawer.tsx:274` 原样回传、`CatalogWorkbenchPage.tsx:67` 只读展示。即商品分类在前端**既不能设置也不能修改**
  - **商品标签/销售单位三方全断**：契约 `catalog-inventory-edge.ts:58/85` 详情与保存都声明了 `tagRefs`/`salesUnitRefs`（详情侧声明为 required）；owner `itemDetail()` **从不 put** 这两键；前端 `catalogModel.ts` 的 `CatalogItemSummary` 与 `decodeItemSummary` **不解码**，`submit()` **不发送**。三层都没有
  - **规范源本身就缺**：manifest `fieldRules` 七个形态是同一组 9 个字段（name/code/shapeKey/itemKind/measureMode/usageCapabilities/attributes/images/productionTagRefs）——没有 shortName、categoryRefs、tagRefs、salesUnitRefs、materialRole、价格。且商品抽屉**完全不消费 manifest**（`getOperationsCatalogShapeManifest` 唯一消费方是 `CatalogItemCreateDrawer.tsx:35-41`，只取 `shapeKeys`）
  - materialRole：owner `:2131` **有** put，生成契约无（＝P3-1 X-09），前端不解码不渲染
  - 编辑态无 itemKind/measureMode/usageCapabilities 派生摘要；无属性摘要跳转；标准价被挪到独立 `ordering` 页签
  - **已排除的风险（亲验后否定）**：`saveItem` 从库中 sections `deepCopy` 起步、只覆盖 draft 出现的 key（`CatalogOwnerService.java:1287-1298`）→ 前端不发 tagRefs/salesUnitRefs **不会清空**已有值。是「看不见也改不了」，不是「一保存就丢」
- 归属拆分：materialRole 契约缺失＝**已被P3-1覆盖**(X-09)；manifest fieldRules 补声明＝后台新增（P3-1 未覆盖）；分类/标签/销售单位/标准价的控件与 model 解码＝P3-2

**IA-CAT-TAB-002 SKU 规格与价格** | 严重度 **S** | 归属 **大部分已被P3-1覆盖 / 余下 P3-2**
- IA 要求（`:492-502`）：销售属性 ＋ [维护销售属性字典] ＋ [刷新矩阵]；SKU 矩阵表（属性组合｜SKU编码｜名称｜识别码｜标准价｜默认｜状态｜图片）；缺编码/价格/重复组合**逐格标红**；不另显示条码页签
- 当前实际：✅ `SkuMatrixEditor :668-731` 是嵌套 Card 列表（维度 Card ＋ SKU Card），**不是矩阵表格**；✅ SKU 行控件齐：编码/名称/条码/标准价/状态 Select/默认 Switch/图片上传（`:702-714`）；✅ `:719-725` 「新增属性值引用」push 三个自由文本框；✅ 同组件 `:674` Alert 写「属性值只能引用已存在的销售属性字典」——**提示语与控件直接冲突**；✅ 校验只有 submit 时一条字符串（`:247-248`）；✅ 只读 `SkuMatrixReadOnly :733-739` 有维度摘要＋SKU 明细
- 差异：无矩阵引擎/刷新矩阵、无「维护销售属性字典」入口、无逐格标红、非表格形态；顶部 `skuSummary` 恒 0/0/0
- 归属：矩阵引擎、手填属性值控件消失、字典 picker 接线、skuSummary 恒 0 ＝ **已被P3-1覆盖**（§12.3、§4.3、§12.2 及其 P3-2 对照表）；**本轮新增未登记**：矩阵表格列集合＋逐格标红、「维护销售属性字典」入口 → P3-2

**IA-CAT-TAB-003 条码与识别** | 严重度 **S** | 归属 **跨越两者**
- IA 要求（`:504-511`）：[新增识别码] 类型｜识别码｜绑定范围（商品）｜**状态**｜操作
- 当前实际：✅ `IdentifierEditor :637-651` Card 列表 ＋ 新增/移除；三个自由文本 `<Input addonBefore>`：类型/编码/识别码（`:645-647`），**无状态控件**。✅ 只读 `:609` `<Tag>绑定范围：商品</Tag>` 正确，`<Tag>状态：当前契约未提供</Tag>`——**亲验属实**：契约 `identifiers: Array<{kind; code; value}>` 三字段，owner `:2138` 也只 put 这三个。✅ 空态 `EmptySection「未维护条码与识别码」`，不显示新增占位
- 差异：状态列在契约层就不存在；识别码「类型」是自由文本而非受控词表
- 归属：identifiers 增 status ／ kind 词表＝后台，**不在 P3-1 五条漂移内，属新增**；表格形态＋状态列渲染＝P3-2

**IA-CAT-TAB-004 点单选项** | 严重度 **S** | 归属 **跨越两者**
- IA 要求（`:513-521`）：三栏；组＝组名/单选多选/必选/**min/max**/**≡排序**；值＝编码/名称/**小票后厨名**/加价/制作影响/**状态**/**排序**；预览＋具体失败原因＋**跨页签修复提示**
- 当前实际：✅ 三栏成立——`OrderOptionsEditor :757-793` `<Row><Col span={6}>分组列表 <Col span={12}>详情 <Col span={6}>预览/校验`。✅ 组控件：组编码/组名/`<Select>`(单选·多选·固定包含)/必选 `<Switch>`（`:766-769`）。✅ 值控件：值编码/值名称/加价/制作影响 `<Input>`(逗号分隔)/默认 `<Switch>`（`:775-779`）。✅ 预览区逐条列出具体失败原因（`:747-752`, `:789`）
- 差异：组无 min/max、无排序控件；值缺小票名、后厨名、状态、排序；预览无跨页签修复提示/跳转
- 归属：min/max·小票名·后厨名·状态·排序的**契约字段＝已被P3-1覆盖（X-08）**；控件与排序交互、跨页签跳转＝P3-2

**IA-CAT-TAB-005 属性** | 严重度 **S** | 归属 **P3-2**
- IA 要求（`:523-524`）：自由 map，无属性定义/字典，**用户逐项维护键和值**，纯展示不做 schema 校验
- 当前实际：✅ 编辑态 `:614` 是**单个 `<Input.TextArea rows={12}>` 让用户手写 JSON**，校验器只判「必须是 JSON 对象」；提交时再 `JSON.parse` 一次，失败给「描述属性必须是 JSON 对象。」（`:220-227`）。✅ 只读态 `:615` `FactMap` → `:993` Descriptions 键值表，符合「自由 map 键值表」
- 差异：只读态 CONFORM；编辑态不是「逐项维护键和值」。**产品判断**（非命名论证，判据＝IA 原文＋失败模式）：运营改一条「产地=直营」需要先懂 JSON 语法；漏一个逗号整块属性保存失败，且错误信息不指到具体键。IA 特意写「用户逐项维护键和值」正是在排除这种形态

**IA-CAT-TAB-006 生产提示** | 严重度 **S** | 归属 **跨越两者**
- IA 要求（`:526-540`）：节点 `[商品｜SKU：中杯｜SKU：大杯｜选项值：加奶油]`；商品处理标签＋[快速创建]；打印名称｜打印标签｜预计制作秒数｜生产备注｜过敏原；说明「标签描述处理方式，不代表岗位、设备、队列或单个商品」；quickManage 调 production-tag owner；**品牌页不写「当前门店」**（行 217）
- 当前实际：✅ 五个字段全在 `profileFields :51-58`。✅ 商品处理标签 `:623` `<Select mode="multiple">` ＋ `:624`「快速创建商品处理标签」。✅ 切节点不丢草稿（三键同在 `productionProfilesDraft` 内存），任何修改触发 `onDirty`。✅ quickManage → `:552` `CatalogDictionaryDrawer initialKind="PRODUCTION_TAG" quickManage`
- 差异：① **节点是三个固定层而非实例节点**——`:821` `<Select>` 选项来自 `profileLayerLabels :41` 的 `{item, sku, optionValue}`；数据形态同样三键（契约 `productionProfiles: {item; sku; optionValue}`，owner `:2154` 也只 put 三键）→ 同一商品的「中杯」「大杯」**共用同一份 sku profile，无法分别维护**，IA 线框明确要求逐 SKU/逐选项值节点；② `profileFields` 里另有一个 `stationTags` 字段标签写作「**处理标签**」（`:53`），是逗号分隔自由文本，与上方「商品处理标签」Select 构成**同名双控件**；③ IA 明写的「标签描述处理方式，不代表岗位、设备、队列或单个商品」说明未出现（现有 Alert `:822` 讲的是继承语义）；④ `CatalogDictionaryDrawer.tsx:187` Alert 打印 `当前作用域：${queryContext.scopeRef || '未选择门店'}`——**裸 UUID 直接展示给用户**，且 fallback 文案「未选择门店」在品牌页出现即违反行 217 的裁定
- 归属：productionProfiles 从三键改为按节点＝契约＋owner，**P3-1 未覆盖**；节点列表控件、双控件去重、文案＝P3-2

**IA-CAT-TAB-007 库存与 BOM** | 严重度 **M** | 归属 **跨越两者**
- IA 要求（`:542-555`）：左节点树＋右节点配置；允许模式[无][独立库存][BOM]；独立库存＝消耗单位/**外部码**/**阈值**/**负库存**/**盘点单位与换算**；BOM＝组件库存对象｜每份消耗；不准入形态不出现节点；**lineSign 显式可见**；不显示余额流水
- 当前实际：✅ `InventoryBomEditor :836-857` 是「新增独立库存对象」「新增 BOM 组件」两个按钮 ＋ **平铺 Card 列表，无左树**；节点由用户手工 push，不是从商品结构派生。✅ 允许模式 `:846` `<Select>` 三值。✅ 独立库存只有 `:851` 「消耗单位」一个 Input。✅ 不显示余额流水
- 差异：
  - **阈值/负库存/盘点单位/换算无任何控件**：`configuration` 全仓唯一写入点是 `:840` 新增行时的一组字面量默认值，无第二处；**外部码完全没有**
  - **配置与消耗单位只写不回读**：保存走 `:294-302` `inventoryConfiguration.nodes[].configuration`，而详情响应 `inventoryBom[]` 的契约字段集是 `{nodeType, mode, targetRef, quantity, unit, version, itemCode, itemRef, productSkuRef, optionValueRef, skuCode, optionValueCode}`（`catalog-inventory-edge.ts:58`）——**没有 configuration、没有 consumptionUnit**，owner `bomEntry(...)` 同样不产出。用户填的值保存后再打开就不见了
  - **lineSign 是假字段**：`grep -c lineSign catalog-inventory-edge.ts` = **0**，契约里根本不存在；`CatalogInventoryBomEntry.lineSign` 是 `catalogModel.ts:134` 前端自造的 optional，`decodeInventoryBom :466` 读 `row.lineSign` 永远 undefined。编辑态 `:845` 显示 `entry.lineSign ?? entry.nodeType` → 恒为 nodeType；只读态 `:861` 更直接：`title={`lineSign：${entry.nodeType}`}`——**把 nodeType 冠上 lineSign 的名字给用户看**
  - BOM「已有库存对象」`:849` 是手打 UUID 的 `<Input>`，同组件 `:839` Alert 写「BOM 组件必须引用已有库存对象」——提示语与控件冲突
- 归属：configuration/consumptionUnit 详情回读、lineSign 是否为真字段＝后台，**P3-1 未覆盖**；BOM picker 接线＝**已被P3-1覆盖**（§12.2 明列为 P3-2）；左树＋配置控件＝P3-2

**IA-CAT-TAB-008 治理与引用** | 严重度 **M** | 归属 **跨越两者**
- IA 要求（`:557`）：生命周期/治理/版本/形态/来源；外部身份；**全图引用反查**及**被引用后的禁止动作原因**；不显示菜单与渠道/套餐引用业务列
- 当前实际：✅ `:633` 全部内容＝一个 Descriptions **两行**——「治理状态」`detail.governance.status`、「引用关系」`entry.referenceKind:entry.code` 拼串。✅ 不显示菜单与渠道
- 差异：
  - 缺生命周期、版本、形态、来源、外部身份、禁止动作原因（TEMPORARY 的外部身份另有 `:539` Card，但那是来源横幅，且只有 TEMPORARY 走）
  - `references[].direction` 被解码（`catalogModel.ts:320`）却从不显示
  - **反查方向没有数据源**：owner `CatalogOwnerService.java:1156-1159` 只对当前商品自己的 outbound refs 生成行，且写死 `.put("referenceKind","ITEM").put("direction","OUTBOUND")`——「被谁引用」这一半后台不产出
  - **禁止动作原因结构上恒空**：`:1191-1192` `voidAvailability.putArray("blockingReferences")` 与 `dependentFacts` 是空数组、从不填充，而 UI `:528` 的 title 写「存在 owner 阻断事实，暂不能作废」——**又一处提示语声称有事实、实际永远给不出**
- 归属：inbound 反查 ＋ blockingReferences 实际填充＝后台，**P3-1 未覆盖**；页签补齐生命周期/版本/来源/外部身份＝P3-2

**IA-CAT-TAB-009 套餐内容** | 严重度 **S** | 归属 **跨越两者**
- IA 要求（`:559-568`）：左分组列表（+新增、≡排序）＋右分组详情（固定包含/单选/多选；**min/max**；**排序**）；组件商品｜数量｜默认｜加价｜状态｜操作；[添加商品] → 二级 Drawer：分类树＋搜索＋游标加载；库存/BOM 提醒只提示
- 当前实际：✅ **二级 Drawer 三件齐全，逐一亲验** `CompositeCandidatePicker :884-898`：`<Tree treeData={buildCategoryTree(navigation.tree)}>` ＋ `<Input.Search>` ＋ `page.cursor` → 「加载下一页」；并排除自身 `:891` `item.code !== currentItemCode`。✅ 组件控件齐：picker/数量/单位/加价/状态 Select/默认 Switch/移除（`:929-936`）。✅ 只读 `CompositeGroupsReadOnly :943-950`
- 差异：① `CompositeGroupsEditor :916-941` 是平铺 Card 列表，**非左分组列表＋右详情**；② 无 min/max、无分组排序；③ 组件的 SKU 是自由文本 `<Input>`（`:930`）而紧邻的商品用了完整 picker；④ **库存/BOM 提醒既无数据源也无渲染**——只有 `:917` 一条 Alert 说「不在此跨 owner 修改」；⑤ 只读态「组件停用/不可见保留快照并标风险」未实现，只显示 status 字符串
- 归属：套餐组件 SKU picker＝**已被P3-1覆盖**（§12.2 明列 P3-2）；min/max 契约字段、组件停用风险快照＝后台新增（P3-1 未覆盖）；布局/排序/提醒＝P3-2

**IA-CAT-MEDIA-001** | 严重度 **N** | 归属 **跨越两者**
- IA 要求（`:632-643`）：主图 1＋附图最多 5，总数默认 6 且**上限来自配置**，单张 ≤2MB；列表只返回主图、详情返回全部；本期不生成缩略图；`3/6` 计数；**拖动调整顺序**；删除后仍有图片须先选新主图；唯一图片可删除为空
- 当前实际：✅ `:35` `MAX_MEDIA_COUNT = 6`、`:39` `MAX_MEDIA_BYTES = 2*1024*1024` 均为**前端硬编码常量**；`contracts/` 与 catalog/asset 后端模块搜 `maxImages|imageLimit|mediaLimit|maxAssetCount|maxImageCount` **零命中**。✅ 计数 `:956` `{mediaDraft.length}/{MAX_MEDIA_COUNT}（1 张主图 + 5 张附图）· 单张上限 2MB`。✅ 列表只返回主图（`primaryImageAssetRef`）/详情全部（`images[]`）。✅ 不生成缩略图（`CatalogAssetPreview` 直接用 publicUrl ＋ width/height）。✅ 删主图守卫 `:440`「仍有其他图片时，请先指定新的主图。」；唯一图片可删（同条件反面）
- 差异：① 上限无配置源，且后端不参与该上限；② 排序是 `:975-976` 「上移/下移」按钮，不是拖动
- 归属：上限下发＝后台（P3-1 未覆盖）；读配置＋拖拽＝P3-2

**IA-CAT-MEDIA-002** | 严重度 **N** | 归属 **P3-2**
- IA 要求（`:644-646`）：上传中/失败/重试/替换/移除/排序/设主图/超数量/超 2MB/**无上传权限**分别有独立状态；保存失败不丢已完成 assetRef 或排序草稿
- 当前实际：✅ 九个状态逐一亲验存在且互不复用——上传中 `:968`「上传中/处理中」、失败 `:968` danger＋`asset.error`、重试 `:974`、替换 `:971-973`、移除 `:978`、排序 `:975-976`、设主图 `:977`、超数量 `:411`＋`:958-959` disabled、超 2MB `:412`。✅ **保存失败不丢草稿属实**——`:313-316` catch 分支只 `setProblem` ＋ `setSubmitting(false)`，`mediaDraft`/`skuStagedMedia` 一律不动，`bindGrant` 保留可重试。✅ 超出 IA 的额外保护：关闭时逐个 release staged 资产，release 失败**阻止关闭并给「重试关闭」**（`:146-163`, `:535`）
- 差异：**「无上传权限」无独立状态**——`CatalogAssetEditor` 只在 `:601` `tabKey==='basic' && editing` 渲染，无权限时控件整体消失，没有可读表达；且 `deniedFields` 若含 `images`，编辑态仍全可上传，保存被 owner `:2111-2119` 422 拒

**IA-CAT-MEDIA-003** | **CONFORM（前端半）** | 归属 **—**
- IA 要求（`:647-650`）：业务事实只存 `assetRef`，URL 由读边界现算，**前端不拼接/持久化 URL**；复制复用相同 assetRef 不重复 claim；claim 表示字节生命周期；移除/删除前引用保护；切 CDN 只换配置
- 当前实际（我实际打开的那一段）：✅ `CatalogAssetPreview.tsx:18-27` —— `publicRtkRequest.getPublicAssetContent({assetRef: wireUuid(assetRef)})` 取 `assetQuery.data?.publicUrl` 直接喂 `<Image src={publicUrl}>`，**无任何字符串拼接**，无 localStorage/持久化，`:22` `useEffect` 在 assetRef 或 publicUrl 变化时重置失败态。✅ 保存只发 assetRef：`:272` `images: mediaDraft.filter(...).map(asset => wireUuid(asset.assetRef))`、`:491` `mediaRefs`。✅ claim 生命周期由 `:286-289` `X-Catalog-Asset-Bind-Grants` ＋ stage/release 两个 operation 承载
- 差异：前端半无差异。复制复用 assetRef / 引用保护 / CDN 切换属 asset owner 后台事实，本轮**未验证**（见第 2 段）

---

## 1 · 本面覆盖确认

| 项 | 数 |
|---|---|
| 本面 IA-ID 总数 | **16**（DETAIL-001..004 ＝4、TAB-001..009 ＝9、MEDIA-001..003 ＝3，与 §11.3 exact-set 行 `IA-CAT-DETAIL-001..004`／`IA-CAT-TAB-001..009`／`IA-CAT-MEDIA-001..003` 一致） |
| 已核 | 16 |
| CONFORM | **1**（MEDIA-003，仅前端半） |
| 有差异 | **15** |
| 未验证 | **0** |

1 + 15 + 0 = 16 ✅

严重度分布：**M ＝ 4**（DETAIL-003、TAB-001、TAB-007、TAB-008）· **S ＝ 8**（DETAIL-002、DETAIL-004、TAB-002、TAB-003、TAB-004、TAB-005、TAB-006、TAB-009）· **N ＝ 3**（DETAIL-001、MEDIA-001、MEDIA-002）

归属分布：P3-2 ＝ 4 · 跨越两者 ＝ 10 · 已被P3-1覆盖（整条）＝ 0（TAB-002、TAB-004 的**主要项**已被覆盖，但各自仍有未登记的余项，故计入跨越/P3-2）

---

## 2 · 我没能覆盖的部分（诚实列出）

1. **未运行任何东西**。全部结论来自静态阅读源码、生成契约与 manifest JSON；没有跑构建、测试、容器或页面。所有「用户可见后果」（空状态徽章、配置回读丢失）是从读写路径推出的，**未经运行验证**。
2. **MEDIA-003 的后台半未验证**：复制商品复用 assetRef 不重复 claim、移除/删除前的引用保护、CDN 切换只换配置——这三条落在 asset owner 与 catalog 复制路径，我只读了 `lockCatalogAssetRefs(...)` 的调用点（`CatalogOwnerService.java:1307`）没有读实现。
3. **`sections.deniedFields` 的真实取值分布未验证**：DETAIL-002 差异③的「适用条件」我写清了，但我没有确认现实数据中是否真的出现过 name/code 之外的 denied 字段。若从不出现，该项应降为 N。
4. **platform-admin 侧未看**。本面按提示只核了 operations-admin 的商品抽屉；若 IA 的某条也落在 platform-admin，我漏了。
5. **`ordering` 页签是否为 Dexter 事后裁定的合法增补，我无法判定**。我只能确认它不在 IA §6.2 的形态—页签矩阵里；如果有后续裁定把标准价独立成页签，则 DETAIL-004 差异④ 应撤回。标 `DEXTER_DECISION`。
6. **TAB-006 的节点粒度是我按线框推的**。§6.3 正文写「商品、SKU、选项值各自维护独立 typed production profile」，字面可读成「按层」也可读成「按实例」；我按同段线框里明确列出的 `SKU：中杯｜SKU：大杯｜选项值：加奶油` 判为按实例。若 Dexter 的原意是按层，则 TAB-006 差异① 应撤回，仅余 ②③④。标 `DEXTER_DECISION`。
7. **未核 P3-1 §1 拆表对本面读模型的连带影响**。拆表后 `sections` 白名单化会改变 `itemDetail` 的取数路径，我的很多「owner 从不 put X」的结论是对**当前**实现的，拆表后需重核。

---

## 3 · 最值得先修的三条

**第一 · IA-CAT-TAB-001 的分类/商品标签/销售单位（M）**
不是「少了几个控件」，是一条业务链整段缺失。分类没有写入点意味着新建的商品**永远进不了左树的任何分类节点**——而左树分类导航、`categoryRef` 筛选、分类删除阻断计数这一整套 IA-CAT-LIST/CATEGORY 能力全部依赖它，现在它们只能对复制或 seed 进来的数据生效。`tagRefs`/`salesUnitRefs` 更彻底：契约声明了（详情侧还是 required）、owner 不产出、前端不解码，三层同时空转，而 `CatalogDictionaryDrawer` 里「商品标签」「销售单位」两个字典页签**已经能建条目**——用户建完了没有任何地方能用。修它同时解锁其他人的面，且 manifest `fieldRules` 的补声明是所有基础资料字段的共同前置。

**第二 · IA-CAT-TAB-007 的配置只写不回读 ＋ lineSign 假显示（M）**
这条是唯一一处**用户的输入会静默消失**：消耗单位、低库存阈值、负库存、盘点换算填了、保存成功了、重新打开全没了，因为详情响应的 `inventoryBom[]` 字段集里根本没有这些键。用户不会怀疑系统，只会以为自己没保存，然后反复填。同一页签的 `lineSign` 把 `nodeType` 冠上另一个名字显示，是把「声称」当「行为」的教科书案例——契约里 `lineSign` 出现 0 次。两者都在同一个读模型上，一次改完。

**第三 · IA-CAT-DETAIL-003 的状态徽章恒空（M）**
成本最低、可见度最高。owner 的列表投影 `itemSummary` put 了 `status`/`governanceStatus`，详情投影 `itemDetail` 没 put，而前端两处共用同一个 `decodeItemSummary` —— 结果是列表里状态好好的，点开详情标题上挂一个空徽章，基础资料「状态」一栏空白。连带 `status !== 'VOIDED'`／`!== 'ARCHIVED'` 两处判断恒真，已归档商品仍显示「从已有商品复制配置」。前端改读已有的 `lifecycle.status`／`governance.status` 即可闭合，不必等契约；若要保留 `item.status` 语义则 owner 补一行 put。修完之后 IA-CAT-DETAIL-003 的「顶部显示状态」与 TAB-001 只读态的状态行一起变绿。


# 面 · 字典分类生命周期来源导航

**范围**:IA-CAT-DICT-* 5 + CATEGORY 2 + LIFECYCLE 3 + SOURCE-* 4 + NAV 3,共 17 条

---

仓库根 `/Volumes/idea/catering-v2s`,以下路径均为仓根相对路径。会话性质:fresh v2s-rooted 只读核验,未写入任何仓库文件,未运行测试/构建/容器。

## 逐条对账(17 条,一 IA-ID 一行)

**IA-CAT-DICT-001** | 「商品目录字典」组**固定三个页签**(商品标签/销售单位/SKU 销售属性),属性值在「SKU 销售属性」的主从详情内维护(线框:左侧属性树 `杯型 → 中杯/大杯`,右侧属性详情含`[新增属性值]`与属性值表、`仅同级拖动排序`);并列一个**独立入口**「商品处理标签 · 生产履约域」打开独立标题与独立 surface;不存在「商品属性」字典,分类不入字典载体 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx:40-45` 的 `dictionaryTabs` 是**四个平铺 Tab**:`TAG/SALES_UNIT/SKU_ATTRIBUTE/SKU_ATTRIBUTE_VALUE`(第四个 label「属性值」),`:189` 用 `<Tabs>` 平铺渲染,属性值 Tab 无任何父属性选择器;创建走 `:98` `createOperationsCatalogDictionaryEntry({dictionaryKind: kind}, body:{dataNodeRef,dictionaryKind,code,name})`,契约 `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts:95` `CatalogDictionaryEntryCreateRequest` 无父属性字段,`:59` `CatalogDictionaryView.entries` 亦无父属性字段;库表 `apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql:44-54` `catalog.dictionary_entry` 无 parent 列,唯一键 `UNIQUE(data_node_ref,brand_ref,dictionary_kind,code)`;P3-1 在建的 `V20260814_100000_000__catalog_p3_model.sql:102-119` 把「属性→值」的归属只建在**单个商品的 SKU 轴** `catalog_sku_variant_axis(_value)` 上,字典层仍平铺 ✅;页面级入口只有一个按钮 `CatalogWorkbenchPage.tsx:259`「商品字典」→ `setDictionaryKind('TAG')`,**launcher 里没有并列的「商品处理标签」入口**,该 surface 唯一入口是 `CatalogItemDrawer.tsx:625` 商品详情「生产提示」页签(只读态)里的文字链;进入 PRODUCTION_TAG 后 `CatalogDictionaryDrawer.tsx:186-188` 用 `<Tag>商品处理标签独立入口</Tag>` **顶替了 Tabs**,无法在同一载体切回字典;无「商品属性」Tab ✅,无分类 Tab ✅ | ①三 Tab exact-set 被做成四 Tab;②属性值与其所属属性在 UI、契约、库表三层都**没有归属关系**,「仅同级排序」无从谈起,`:167-178` 的上移/下移在整张平铺表内换位(推论:两个属性无法拥有同名/同码的值,且 `C-19`「属性值叠加父级编码」在唯一约束上不成立);③从页面进不去商品处理标签 surface,必须先打开某个商品 | **M** | **跨越两者**:字典层父属性建模+契约字段属后端(不在 P3-1 五条漂移清单内,但与 P3-1 正在改的 `catalog_p3_model` 迁移同一处,须并轨);Tab 收敛为三、主从形态与 launcher 并列入口属 **P3-2**

**IA-CAT-DICT-002** | 四类对象均支持列表/创建/改展示名/同级排序/停用/重新启用/version conflict/owner readback;编码创建后固定;**创建输入时即时校验格式与当前 owner scope 唯一性,并显示具体占用对象**;录错只允许零引用整条作废重建,不提供改码入口;新增动作位于表单与列表之间,不用 Modal 默认「确定」冒充保存 | 列表 `CatalogDictionaryDrawer.tsx:190-200` ✅、创建 `:201-206` ✅、改名 `:111-125`(行内 Input+保存/取消)✅、同级排序 `:167-178` ✅、停用/重新启用 `:126-140`(状态列 Tag 点击互切 ENABLED↔DISABLED)✅、`expectedVersion` 全部下发 ✅(`:119/:121/:134/:136`)、作废并重建 `:141-166` 带 `Modal.confirm` 与 `voidAvailability.canVoid` 门 ✅、无改码入口 ✅、新建按钮在 Form 内非 Modal 页脚 ✅;**校验只有本地正则** `:203` `/^[A-Z0-9][A-Z0-9_-]*$/`,**无任何唯一性预检调用**,契约 `catalog-inventory-edge.ts:18-22` 五个字典 op 里没有可用的编码可用性查询,唯一性只能在提交后由 `CatalogOwnerService.java:1480` 的 `DuplicateKeyException → DUPLICATE_CODE 409` 冒泡到 `:105` 的通用 Alert ✅;创建成功后只 `:101 dictionaryQuery.refetch()`,不消费 `CatalogDictionaryEntryReadback` ✅;停用**无二次确认**(`:126-140` 直接发命令),而 IA 线框写明「停用确认:历史引用继续显示;新选择时不再出现」 | ①无即时唯一性校验、更无「显示具体占用对象」(临时商品转正已有 `formalCodeAvailable` 同类能力,说明模式可行);②停用缺二次确认与后果说明;③新增动作位于列表**之下**而非「表单与列表之间」(N 级排版差异) | **S** | **跨越两者**:唯一性预检需要新的 owner 只读能力(不在 P3-1 五条内);停用确认与文案属 **P3-2**

**IA-CAT-DICT-003** | 字段级 quickManage 只允许商品标签、销售单位、SKU 销售属性和值;创建成功只刷新当前字段候选并自动选中,不刷新无关树和字典;分类用左树维护、不提供 quickManage | 全仓 `CatalogDictionaryDrawer` 只有两处使用:`CatalogWorkbenchPage.tsx:284`(页面级,不带 quickManage)与 `CatalogItemDrawer.tsx:552`(`initialKind="PRODUCTION_TAG"` + `quickManage`)✅;`CatalogDictionaryDrawer.tsx:87-96` 的 `onCreated?.()`/`if(quickManage) onClose()` **只在 `isProduction` 分支内**,`:97-102` 的字典分支既不回调也不关闭;更根本地,商品标签/销售单位在商品 Drawer 里**根本没有字段**:契约 `catalog-inventory-edge.ts:58/85` 有 `tagRefs`、`salesUnitRefs`,而全前端(除 generated 外)对 `tagRefs`/`salesUnitRefs` 的引用数为 **0**(`catalogModel.ts` 未解码,`CatalogItemDrawer.tsx:267-275` 组 `catalogDraft` 时未写入);分类无 quickManage ✅,分类在左树维护 ✅ | IA 允许的四类字段级 quickManage 一个都不存在;商品标签、销售单位字段本身缺位(字段存在于契约但无读点也无写点),所以「创建后自动选中」无处可落 | **M** | **P3-2**(五处 picker 的后端端点保证已在 P3-1;前端字段与接线明确属 P3-2)

**IA-CAT-DICT-004** | 商品处理标签不作字典第四 tab、事实由 production-tag owner 提供;必须覆盖六种 contract `tagKind`、编码、名称、状态、**版本**、引用计数、创建、改名、停用、重新启用;停用不删除历史引用但禁止新选择(线框列头:名称 编码 类型 状态 引用商品数 **版本** 操作,并有停用确认) | 独立 surface 非第四 tab ✅(`CatalogDictionaryDrawer.tsx:183` 独立标题、`:186-188` 独立区块);数据取自 production owner ✅(`:59-60` `getOperationsProductionTags`);六种 tagKind ✅(`:34-37` 与契约 `catalog-inventory-edge.ts:60` `"PRODUCTION"|"PACKAGE"|"LABEL"|"HANDOFF"|"REVIEW"|"OTHER"` 完全一致,创建为 `Select` 形态 `:204`);编码/名称 ✅(`:191` `NameCodeText`);状态 ✅(`:193`);引用计数 ✅(`:181` 映射 `linkedProductCount`,契约提供);创建/改名/停用/重新启用 ✅;**列定义 `:190-199` 只有 名称+编码 / 类型 / 状态 / 引用数 / 操作五列,没有版本列**(`version` 只被 `:119/:134` 当作 expectedVersion 使用,从不展示);**停用无二次确认**(`:126-140`);状态列直接渲染裸枚举 `ENABLED`/`DISABLED` 文本 | ①IA 逐项列举里的「版本」在只读展示中缺失(编辑态用得到、用户看不到,版本冲突时无从对照);②停用确认与「现有 N 个商品仍保留显示」的后果文案缺失 | **S** | **P3-2**(版本列与停用确认均为前端;裸枚举中文标签由 shape-manifest 下发已被 **P3-1** 覆盖)

**IA-CAT-DICT-005** | 生产提示字段旁的「快速创建商品处理标签」打开**独立 production-tag quickManage,不复用商品目录字典组件**;创建携带当前总公司+品牌或门店 owner;成功后回填当前字段 | 入口存在且位置正确 ✅ `CatalogItemDrawer.tsx:624`(编辑态、`canWriteCatalog` 门内,紧邻 `:623` 处理标签选择器);但它复用的正是同一个组件 `:552 <CatalogDictionaryDrawer initialKind="PRODUCTION_TAG" quickManage .../>`,靠 `CatalogDictionaryDrawer.tsx:55` `isProduction` 分支切换标题/表格/表单 ✅;owner 携带 ✅(`:89` 传 `dataNodeRef` + `X-Workspace-Brand-Ref`);回填链路存在 ✅(`:91-92` → `CatalogItemDrawer.tsx:404-409`),但回填写入的是 **`candidate.code`**;而字段初值来自 `:179 detail.item.productionTagRefs`(契约 `catalog-inventory-edge.ts:58` 类型为 `Array<Uuid>`),下拉选项 `:621` 的 `value` 也是 `tag.code`,`:120` 组装候选时**丢弃了契约已给的 `entry.tagRef`**,保存 `:273` 又把这些值当 `Array<Uuid>` 发出(后端 wire 记录为 `java.util.List<java.util.UUID> productionTagRefs`) | ①「不复用商品目录字典组件」被字面违反(行为上基本等价,单列为 N);②**真实缺陷**:已保存标签在只读/编辑态都匹配不上候选(渲染成裸 UUID),一旦用户改选或快速创建即把 code 写进 UUID 数组,保存会在边界解析失败——`tagRef` 字段存在、已解码(`catalogModel.ts:322`)却在写入点未被使用 | **M** | **P3-2**(若 owner 实际接受 code,则是契约类型说谎,转 **P3-1**;当前仓内证据指向前端)

**IA-CAT-CATEGORY-001** | 分类由左树维护;根部「新建分类」与节点「新建子分类」是不同入口;父分类由入口确定,弹窗内不得任意跨树改父级 | **CONFORM**。核过 `CatalogWorkbenchPage.tsx:221` 根节点 action = `<Button>新建分类</Button> → setCategoryAction({mode:'CREATE'})`(**不带 node**);`:210-214` 节点 `Dropdown` 菜单项 `create-child`「新建子分类」→ `setCategoryAction({mode:'CREATE', node})`(**带 node**);`:170` 提交时 `parentCategoryRef: node?.categoryRef ?? null` —— 父级完全由入口决定;`:289` 弹窗在 CREATE 且有 node 时把父分类渲染成 `<Typography.Text>` **只读文本**,`:290` 的「目标父分类」`Select` 只在 `mode==='REPARENT'` 时渲染,CREATE 态没有任何跨树选父控件 | 无 | — | — |

**IA-CAT-CATEGORY-002** | 改名、同级排序/层级移动、**停用/重新启用**;停用不删除历史商品引用;最多两级,二级节点**不显示**「新建子分类」;移动预检超两级则阻断并返回 typed failure;编码即时校验格式与 owner-scope 唯一性、创建后不可改、录错仅零引用整条作废重建;搜索分类只过滤树展示;所有写入带 expectedVersion,冲突保留输入并提示刷新后重试 | 改名 ✅(`:174`)、同级上/下移 ✅(`:176-177` action `UP`/`DOWN`,`:206-207` 首末位禁用并给 title)、层级移动 ✅(`REPARENT`,`:290` 候选已过滤自身与后代且只列根级);**停用/重新启用完全不存在**:菜单项只有 新建子分类/重命名/更换父分类/上移/下移/**删除分类**(`:211-213`),契约 `catalog-inventory-edge.ts:14-17,88-93` 的分类 op 只有 create/update(仅 name)/move/delete,`CatalogNavigationView` 树节点无 `status` 字段,`catalogModel.ts:41-51` 亦无;后端 `CatalogOwnerService.java:1447-1462` 的 delete 是**硬删** `DELETE FROM catalog.catalog_category`(整棵子树),仅在 `categoryReferencedItems` 非空时 `REFERENCE_BLOCKS_DELETE 422`;两级上限 ✅ 但 `:211` 是 `disabled: Boolean(node.parentCategoryRef)` + title「分类最多支持两级」,**不是不显示**;编码格式 ✅ `:291` `/^[A-Z0-9][A-Z0-9_-]{1,63}$/` + 自动大写,**唯一性无即时校验**;树搜索只过滤展示 ✅(`:202` `categoryMatches` 仅作用于 `treeData`,与 `filters.keyword` 完全分离);写入均带 `expectedVersion` ✅(`:174/:177/:179`);失败保留输入 ✅(`:185` 只设 problem,Modal 不关) | ①IA 明列的「停用/重新启用」在 UI、契约、owner 三层都不存在,而 delete 被引用即阻断 ⇒ **一个已被商品用过的分类永远无法从树/候选里退休**(推论,基于 `:213` 的 `canDelete` 与后端 `REFERENCE_BLOCKS_DELETE`);②「不显示」被做成 disabled(N);③无编码唯一性即时校验(与 DICT-002 同源);④版本冲突文案未提示「刷新后重试」(N) | **M** | **跨越两者**:分类状态列 + 停用/启用 op 与导航投影属后端(不在 P3-1 五条内);菜单项、二级隐藏、冲突文案属 **P3-2**

**IA-CAT-LIFECYCLE-001** | 动作由当前状态、写 capability、owner scope、引用事实与后端 blockedAction 共同决定;**不可执行时优先禁用并显示具体原因**;无读取权限则不渲染对象;状态矩阵:草稿{编辑 是/启用 是/停用 否/归档 按引用规则}、启用{是/否/是/按引用规则}、停用{是/是/否/按引用规则}、已归档{否 只读/否/否/否} | `CatalogItemDrawer.tsx:524-528`:编辑/启用/停用/归档四个按钮全部是**条件渲染**(`action?.canEdit && ...`),不可执行时**直接不渲染**,只有「作废并重建」`:528` 做了 `disabled + title` 原因;契约 `catalog-inventory-edge.ts:58` 的 `actionAvailability` 只有 `{canEdit,canEnable,canDisable,canArchive,voidAvailability}`,**没有任何 reason/blockedAction 字段**,`catalogModel.ts:325` 解码同样无 reason;后端 `CatalogOwnerService.java:1184-1188`:`canEdit=status∉{ARCHIVED,VOIDED}` ✅、`canEnable=status∉{ENABLED,ARCHIVED,VOIDED}` ✅、`canDisable=status=='ENABLED'` ✅、**`canArchive=="DISABLED".equals(status)`**;写 capability 门 ✅(`canWriteCatalog`,`CatalogWorkbenchPage.tsx:105-106` 按 surface 取 `EDIT_HEAD_COMPANY_CATALOG`/`EDIT_STORE_CATALOG`) | ①「优先禁用+具体原因」在四个生命周期按钮上全部退化为隐藏,用户看不到为什么不能启用(契约层也没给原因位,同处 `CatalogWorkbenchPage.tsx:150` 解码了页面级 `actionAvailability.reasons` 却全程未渲染);②矩阵不符:草稿与启用态按 IA 应「按引用规则」可归档,实际 owner 只允许 DISABLED→ARCHIVED,且 canArchive 完全不看引用事实 | **M** | **跨越两者**:per-action 原因位与 canArchive 状态/引用规则属后端(不在 P3-1 五条内);disabled+原因的渲染属 **P3-2**

**IA-CAT-LIFECYCLE-002** | 启用前执行 shape/priceGranularity 激活校验(ITEM 商品价齐、SKU 每个启用 SKU 有价),**首错摘要、页签错误数和字段定位复用保存错误模式**;停用只影响后续;**归档有引用时 fail closed 并列出阻断类型**;启用/停用/归档均**二次确认**且写后 owner readback | 后端激活校验存在 ✅ `CatalogOwnerService.java:1384-1399` `validateItemActivation`(SKU 粒度逐个启用 SKU 校价+至少一个启用 SKU;ITEM 校 `standardSalePrice`);前端 `CatalogItemDrawer.tsx:318-329` `changeStatus` **无任何前置校验、无 Modal.confirm**,失败只 `:328 setProblem(detail)` 落到顶部通用 Alert——不切页签、不定位字段、无首错摘要,而保存路径本身是有该模式的(`:229-262` 逐页签校验 + `setActiveTab` + 行号提示),即「复用」的对象存在却未被复用;Tabs 项 `:516` 也没有页签错误计数;二次确认只有「作废并重建」`:330-339` 有;归档:`CatalogOwnerService.java:1371-1382` 的引用检查(`itemReferencedByOtherItems`/`hasItemDependencies`)**只对 `VOIDED` 生效**,`ARCHIVED` 直接 UPDATE,前端亦无阻断类型清单;写后 `:325 detailQuery.refetch()` 视作 readback ✅ | ①启用/停用/归档三个写动作无二次确认;②启用失败不走首错摘要/页签错误数/字段定位;③归档对引用**不 fail closed**、也没有阻断类型列表(被引用的已停用商品可被静默归档) | **M** | **跨越两者**:归档 fail-closed 与 typed 阻断清单属后端(不在 P3-1 五条内);二次确认与错误定位复用属 **P3-2**

**IA-CAT-LIFECYCLE-003** | 总部商品**停用后不再作为新复制候选**,但不影响已复制门店商品;不自动下发、不自动生成差异、不自动通知门店 | 候选来源 `CatalogOwnerService.java:1229-1240` `copyCandidates` 的 SQL 过滤条件只有 `status <> 'VOIDED'`(品牌复制与本库复制共用此方法),**DISABLED 商品照常返回**;前端 `BrandCatalogCopyDrawer.tsx:68-69` 用 `Checkbox.Group` 列出全部候选,只渲染 `name/code/shapeKey`,**既不按状态过滤也不展示状态**;不自动下发/生成差异/通知 ✅(复制全程由 `:23-26` 用户发起的预检+执行驱动,无任何订阅或推送路径) | 「停用后不再作为新复制候选」端到端未实现:门店用户可把总部已停用商品复制过去,且界面上看不出它已停用 | **M** | **跨越两者**:候选 SQL 状态过滤属后端(不在 P3-1 五条内);候选列表状态展示属 **P3-2**

**IA-CAT-SOURCE-AUTO-001** | 选择「自动同步」后显示来源治理 banner;字段锁定来自服务端 field ownership/deniedFields,不在前端硬编码全只读;**同步字段显示锁与上游来源**(线框:`来源:集团 ERP / 记录 ERP-8891 [查看映射]`、字段带 🔒);本地补充字段仍可编辑;**映射失败/来源不可用显示持久错误与重试,不把读取失败伪装成可编辑** | 智能视图入口存在 ✅(`CatalogWorkbenchPage.tsx:36` `AUTO_SYNC:'自动同步'`,owner `CatalogOwnerService.java:1075` 确实产出 `AUTO_SYNC` 视图);banner 存在 ✅ `CatalogItemDrawer.tsx:536`;锁来自服务端 ✅(`detail.deniedFields`,后端 `CatalogOwnerService.java:2103-2109` `sourceDeniedFields`,AUTO_SYNC 缺省 `{"name","code"}`,并在 `:2111-2118` 写入侧再校验),**未硬编码全只读** ✅(`:518-521` 注释与实现一致);但 `deniedFields` 在整个 Drawer 只被用在**两处**:`:599` 商品名称、`:600` 短名,其余全部编辑控件不查该集合;banner 文案直接把 `name、code` 这类**英文字段名**拼给用户看;**没有任何锁图标**;`fieldOwnership`(契约有、`catalogModel.ts:328` 已解码,含 AUTO_SYNC 时 `catalog:"SOURCE"`)全前端零渲染;`externalIdentity` 只在 `:537-549` 的 TEMPORARY 分支渲染,AUTO_SYNC 分支**不展示任何上游来源/记录**,更无「查看映射」;无映射失败/来源不可用的持久错误+重试态 | ①上游来源与映射入口缺失(契约已有 `externalIdentity`/`fieldOwnership` 承载位却未用);②锁只体现为 2 个 `disabled`,无锁标识,其余字段不查 deniedFields(推论:owner 若下发更大的 denied 集,UI 仍放行,靠 422 兜底);③banner 暴露裸字段名;④映射失败态缺失 | **S** | **跨越两者**:AUTO_SYNC 的上游来源/映射事实与「来源不可用」状态位需后端明确(不在 P3-1 五条内);锁形态、来源展示、deniedFields 全字段接线属 **P3-2**

**IA-CAT-SOURCE-AUTO-002** | 本期只建模型/视图/字段主权解释,不建同步执行链,**因此没有「立即同步/重跑同步」按钮** | **CONFORM**。对 `apps/frontend/operations-admin/src` 全量 `.ts/.tsx`(排除 generated)穷举「同步」二字,命中仅两处且都不是动作控件:`CatalogItemDrawer.tsx:536` 的只读 banner 文案、`CatalogWorkbenchPage.tsx:36` 的 `smartLabels.AUTO_SYNC` 标签;两个 Drawer 的 `extra` 动作区(`CatalogItemDrawer.tsx:523-532`)与页面工具栏(`CatalogWorkbenchPage.tsx:258-262`)逐个按钮核过,无任何同步触发入口 | 无 | — | — |

**IA-CAT-SOURCE-TEMP-001** | 外部订单临时商品前端可见但**整体不可编辑**,不可创建销售项或发布;显示来源订单/来源记录和原始快照摘要;历史订单永远按原快照回放 | 可见 ✅(智能视图 `EXTERNAL_ORDER_TEMP` + 列表来源列);只读 banner ✅ `CatalogItemDrawer.tsx:537-538`;来源与原始快照 ✅ `:539-548`(来源订单/来源记录/来源商品/快照名称/规格/价格,取自 `externalIdentity`);`:521 sourceLocked = source==='TEMPORARY'` 只被用在**一处**——`:524` 隐藏「编辑」按钮;同一 `extra` 区里 `:529`「从已有商品复制配置」的渲染条件是 `surface==='store' && mode==='view' && canWriteCatalog && status!=='ARCHIVED'`,**不查 `sourceLocked`**,而 `LocalCatalogCopyDrawer.tsx:39` 明确 `const targetItemCode = sourceItemCode;`(当前商品是**写入目标**),即该向导会把配置写进这个临时商品;`:528`「作废并重建」同样不查 `sourceLocked` | 「整体不可编辑」只挡住了「编辑」按钮:临时商品上仍可发起一整套五步本库复制写入,与 IA 的整体只读语义冲突(前端侧无门,是否被 owner 拒绝未在本轮核验) | **S** | **P3-2**(前端把 `sourceLocked` 覆盖到全部写入口;若 owner 也未拒绝则另属后端,标 `UNVERIFIED`)

**IA-CAT-SOURCE-TEMP-002** | 转正不是直接改状态,而是资料补齐与校验流程;若正式编码冲突、来源快照已变化或 owner/version 过期,typed failure 要求重新预检,**不得半转正** | **CONFORM**。核过 `CatalogItemDrawer.tsx:530` 入口(仅 TEMPORARY+写权限)、`:553-592` 预检 Modal:`:558` 正式编码(带格式规则)、`:561/564` 名称/短名、`:568-570` 形态 `Select`(BENEFIT_SHELL disabled)、`:571-573` MATERIAL 时必填物料角色;`:340-362` 先 preflight 再回显 `:582 formalCodeAvailable`(「已占用(含历史记录)」)、`:583 canPromote`、`:587 blockedReasons`;`:553` OK 按钮 `disabled: !promotion?.canPromote`;执行 `:376-392` 同时携带 `expectedSourceVersion`+`expectedVersion`+`preflightDigest`;`:401` 对 `STALE_COPY_PREFLIGHT` 给出「必须重新预检」并保留表单,`:590` 提供「重新预检」;`:556` 任一输入变更即清空既有预检结果,不可拿旧 digest 提交 | 仅 N 级:线框把转正描述成四步序列,实现是单 Modal(TEMP-002 正文未要求分步,不判为差异) | — | — |

**IA-NAV-001** | `BRAND` 不是服务数据节点;品牌切换器是选定总公司之后的**页面内 owner 候选**,不能扩充 `requiredDataNodeType` | **CONFORM**。核过 `apps/frontend/operations-admin/src/app/catalog/generatedAdminCatalog.ts` 三个页面节点:`PG-CATALOG-STORE-ITEMS`(`:499` `requiredDataNodeType:"STORE"`)、`PG-INVENTORY-STORE-STATUS`(`"STORE"`)、`PG-CATALOG-BRAND-ITEMS`(`:571` `"HEAD_COMPANY"`,`cascadeLevelLabels:["总公司"]`),**闭集内没有 BRAND**;品牌是页面内候选 ✅ `CatalogWorkbenchPage.tsx:111-117`(先按 `scopeRef`=总公司读 `getOperationsOrganizationHeadCompany`,再取 `authorizedBrands` 中 `status==='ENABLED'`)+ `:256` 页内 `Select`(`catalog-inventory-brand-switch`),`:118` 只作为 `X-Workspace-Brand-Ref` 头下发,不参与数据节点选择 | 无 | — | — |

**IA-NAV-002**(按 2026-08-08 裁决解释) | 页面访问只表示「可进入」;写 UI 按 scope 由 `EDIT_HEAD_COMPANY_CATALOG`(品牌页)/`EDIT_STORE_CATALOG`(门店页)/`EDIT_STORE_INVENTORY`(门店库存写)控制;只读角色可以有页面访问而 capability 为空 | **CONFORM**(本面范围内)。核过 `OperationsApp.tsx:90-93` 菜单与可进入页面**只由 `session.pageAccessKeys` 决定**,`:171` 把 `session.actionCapabilityKeys` 作为独立 props 传入页面(`:295/:299` 分别来自 `entry.selected.pageDesignKeys` 与 `entry.actionGrants`,两条链互不影响);`generatedAdminCatalog.ts:1405/1427/1453` 三个 actionKey 齐备;`CatalogWorkbenchPage.tsx:105-106` 按 surface 精确取一个 key,不做 any-of;写控件一律在该门内:`:259` 商品字典按钮**无门(只读可进)**符合 `C-03`、`:260-261` 复制/新建、`:210/:221` 分类写动作、`CatalogItemDrawer.tsx:524-530`、`CatalogDictionaryDrawer.tsx:201/:208`(无权限时不渲染表单并给只读提示) | 无(「有 capability 但上下文阻断时 disabled+原因」的失败已记在 IA-CAT-LIFECYCLE-001,不重复计) | — | — |

**IA-NAV-003** | 注册须原子调整 generator 计数/图标闭集/router exact-set;**目标一级导航图标闭集精确为 `{ACCESS, CATALOG, ORGANIZATION, STORE_OPERATIONS, WORKBENCH}`**,采用 `iconKey: CATALOG`;IA §3 注册体给出的组 key 是 `NAV-CATALOG` | 图标闭集已扩到五个 ✅,但第五个字面量是 **`CATALOG_SERVICES`** 不是 `CATALOG`:`generatedAdminCatalog.ts` 全量 `menuGroupIconKey` 去重结果 = `{ACCESS, CATALOG_SERVICES, ORGANIZATION, STORE_OPERATIONS, WORKBENCH}`,组 key 为 `NAV-CATALOG-SERVICES`(IA §3 写的是 `NAV-CATALOG`);该 key **确实被消费**,`OperationsApp.tsx:54-60` `navigationIconByKey.CATALOG_SERVICES = <TagsOutlined/>`,不会落空;三页 `menuOrder` 510/520/530 与 `C-01` 顺序一致 ✅;router exact-set 已含三页 ✅(`routing/pageRegistry.tsx:56-58`,`catalog/store-items`、`catalog/brand-items` 及库存页) | 仅字面量与 IA exact-set 不符(`CATALOG_SERVICES`/`NAV-CATALOG-SERVICES` vs `CATALOG`/`NAV-CATALOG`),无行为后果;需 Dexter 或 Codex 决定改 IA 文本还是改 key(两处都是 exact-set 声明,不能两边都留) | **N** | **P3-2**(或改 IA 文本;`DEXTER_DECISION`:以哪边为准)

---

## 1. 本面 IA-ID 总数与逐条覆盖确认

本面 **17** 条(DICT 5 + CATEGORY 2 + LIFECYCLE 3 + SOURCE-AUTO 2 + SOURCE-TEMP 2 + NAV 3),**17 条全部逐条核过,无抽样**。

- **CONFORM 5 条**:`IA-CAT-CATEGORY-001`、`IA-CAT-SOURCE-AUTO-002`、`IA-CAT-SOURCE-TEMP-002`、`IA-NAV-001`、`IA-NAV-002` —— 每条都注明了实际打开的组件与行段(不是「组件存在」)。
- **有差异 12 条**:M 7(`DICT-001`、`DICT-003`、`DICT-005`、`CATEGORY-002`、`LIFECYCLE-001`、`LIFECYCLE-002`、`LIFECYCLE-003`)、S 4(`DICT-002`、`DICT-004`、`SOURCE-AUTO-001`、`SOURCE-TEMP-001`)、N 1(`NAV-003`)。
- **未验证 0 条**。
- 5 + 12 + 0 = **17** ✅

## 2. 我没能覆盖的部分(诚实列出)

1. **未运行任何代码**:全部结论来自源码、生成契约与迁移的静态亲验。所有「渲染成什么样」的判断是对 JSX 与条件表达式的直读,未跑浏览器、未跑测试、未起容器(任务禁止)。
2. **owner 是否兜底拦截未核**:`IA-CAT-SOURCE-TEMP-001` 里「临时商品上仍可发起本库复制」我只证明了**前端无门**;`saveCatalogLocalCopy` 一侧是否对 `source=TEMPORARY` fail closed **未核**,标 `UNVERIFIED`。
3. **P3-1 在建迁移的最终形态未核**:`V20260814_100000_000__catalog_p3_model.sql` 正在实施中,我只读到当前落盘版本;若 P3-1 后续给 `dictionary_entry` 加父属性列,`IA-CAT-DICT-001` 的建模半边可能自愈,须并轨复核。
4. **platform-admin 侧未看**:`apps/frontend/platform-admin/src/app/catalog` 未打开(本面 IA 均落在 operations-admin;若有分类/字典镜像实现会被漏掉)。
5. **未做变异实验**:没有在 scratchpad 拷贝上验证「删掉某控件是否有门变红」,因此无法判断这些差异是否被现有 gate 覆盖。
6. **IA §11.3 分母**:我按任务给定的 89 条 exact-set 只取了我这 17 条,未复核 89 这个总数。

## 3. 最值得先修的三条及理由

1. **`IA-CAT-DICT-005` 的处理标签写入串号(code 当 UUID 用)** —— 这是三条里唯一**已经会让用户操作直接失败**的:`CatalogItemDrawer.tsx:120/:404-409/:621` 用 `tag.code` 当选项值,而 `:179` 的初值和 `:273` 的提交都走 `Array<Uuid>`。后果是已保存标签显示成裸 UUID、任何改选或快速创建后保存都会在边界解析失败。契约已经给了 `tagRef`(`:322` 甚至已解码),修法就是把选项值换成 `tagRef`,代价最小、收益最直接。
2. **`IA-CAT-LIFECYCLE-003` 停用总部商品仍是复制候选 + `IA-CAT-LIFECYCLE-002` 归档不 fail closed** —— 这两条是**数据会被真正做脏**的一类:前者让门店把已停用商品复制成正式在售商品(`CatalogOwnerService.java:1229-1240` 只滤 VOIDED),后者让被其他商品引用的商品被静默归档(`:1371-1382` 的引用检查只挂在 VOIDED 上)。都是一行 SQL/一个判断的量级,却直接决定总部停用动作是否有业务意义。
3. **`IA-CAT-DICT-001` 属性值没有父属性** —— 唯一一条**越晚改越贵**的:UI 四 Tab、契约 create 请求、`dictionary_entry` 唯一键三层一致地把属性值做成平铺记录,而 `C-19` 要求属性值判同叠加父级编码。等 P3-1 的 `catalog_p3_model` 落定、真实数据进来之后再加父列,就要动唯一约束、digest 与复制预检;现在与 P3-1 并轨改是最便宜的窗口。(`IA-CAT-DICT-003` 的商品标签/销售单位字段缺位同样是 M,但它是「还没做」而不是「做错了」,可以排在其后。)


# 面 · 复制向导

**范围**:IA-COPY-* 8 + IA-CAT-COPY-LOCAL-* 4,共 12 条

---

# 复制向导面 · IA 逐条对账（IA-COPY-001..008 + IA-CAT-COPY-LOCAL-001..004 = 12 条）

会话出处：fresh v2s-rooted 只读会话；未跑测试/构建/容器；全部结论来自本轮直接打开的源码与生成契约文件。

---

## 逐条记录

```
IA-ID | IA 要求的形态 | 当前实际形态 | 差异 | 严重度 | 归属
```

**IA-COPY-001** | 入口只在门店商品管理；来源由 organization owner 的 `headCompanyRef+brandRef` 唯一确定；无来源选择器；前端不得自行推导；条件不满足则**完全不渲染**（非置灰/点击报错） | ✅ `CatalogWorkbenchPage.tsx:260` 五个条件短路渲染按钮「从品牌复制」，无 disabled 分支；✅ `:285` 抽屉挂载同受 `surface==='store'` 约束；✅ `BrandCatalogCopyDrawer.tsx:66` 来源/目标是只读 `Descriptions`（非 Select），`:74` 明示不提供来源改写；✅ `:23/:36` 请求体只发自身 `dataNodeRef`，来源由 edge 侧 `OperationsCatalogInventoryController.java:331-343 resolveBrandCandidateSource` 注入 | 无 | **CONFORM** | —
- 亲验落点：`.../ui/CatalogWorkbenchPage.tsx:260`、`:285`；`.../ui/BrandCatalogCopyDrawer.tsx:62-77`。`:256` 的品牌 `Select` 只在 `surface==='brand'` 出现，不参与门店复制来源。

**IA-COPY-002** | 正向闭包到不动点；`visited=(objectType,sourceRef)`；反向引用与 `CatalogItemRelation` 不扩张 | ✅ 前端不参与闭包计算，只渲染服务端 `closureItems`（`BrandCatalogCopyDrawer.tsx:81` → `ClosureItemList:105-108`）；后端 `CatalogOwnerService.java:2332-2350` `closureGraph` 用 `LinkedHashSet<String> visited` 按 **item code** 去重，只对 `expandsCatalogItemClosure(referenceKind)` 与 `PRODUCT_SKU` 扩张 | 前端无差异；后端 visited 键是 code 而非 `(objectType,sourceRef)`（推论：队列只含 CATALOG_ITEM，当前等价，但不是 IA 字面）；`CatalogItemRelation` 仓内 grep 零命中 → **未验证**该实体是否以别名存在 | **N** | 跨越两者（前端无事）

**IA-COPY-003** | 两个上限；超限整体返回 `COPY_CLOSURE_TOO_LARGE(实际,上限)`，绝不截断 | ✅ `BrandCatalogCopyDrawer.tsx:79/:91` 显示 `selectedCount/selectedLimit`、`closureCount/closureLimit`；✅ `:36` 整体提交不截断；超限文案经 `:40/:64` 落进 Alert | 选择阶段拿不到上限（候选契约 `BrandCopyCandidatePage`（generated `catalog-inventory-edge.ts:66`）无 `selectedLimit`），只能预检后整体被拒；错误仅以后端原始字符串呈现 | **N** | 跨越两者

**IA-COPY-004** | 「闭包总览」按商品/SKU/分类/标签/销售单位/SKU属性(值)/生产标签/StockTarget/BOM(行)**九组**分组，可展开查看**从哪条批准边进入** | ❌ 无分组、无展开。`BrandCatalogCopyDrawer.tsx:80-85` 的四个页签是「商品与结构/引用映射/库存与BOM/生产提示」；`:81`→`ClosureItemList:105-108` 把全部 `closureItems` 平铺成一个 `List`（Tag+code+name+action） | 分组与「进入边」均缺；owner 其实算了 `closureEdges`（`CatalogOwnerService.java:1611`），但被 `CopyPreflightWireShape.java:19-22` 的 `DATA_FIELDS` 白名单投影丢弃（`:85-87` 只 copy 白名单字段）；SKU 与 BOM/BOM行 也不在 `closureItems` 的 objectType 里 | **M** | 跨越两者（契约放行 closureEdges + 补 SKU/BOM 分组事实；前端做分组与展开）

**IA-COPY-005** | 「执行预览」必须逐类显示商品/SKU/StockTarget/BOM/BOM行的 outbound 引用重写 | ❌ `BrandCatalogCopyDrawer.tsx:90-94` 的「确认执行」步只有三格 `Descriptions`＋一个确认框＋两个按钮，**零引用重写清单**；`:82`→`ReferenceMappingList:115-118` 只渲染 `objectType/targetCode/targetSkuCode/targetOptionValueCode`，丢掉契约里已有的 `sourceRef`，也没有分类/标签/销售单位/属性维度/生产标签/套餐组件这层 referenceKind | 全缺；owner 的 `referenceRewritePreview`/`mappingPreview` 同样被 `CopyPreflightWireShape` 白名单丢弃 | **M** | 跨越两者

**IA-COPY-006** | 「结构冲突」严格用九类判别位；必须在「判同编码」列显示真实 canonical matching tuple，不能只显示模糊"同编码" | ❌ 无「结构冲突」页签、无「判同编码」列（全仓 grep「结构冲突/字段差异/闭包总览/执行预览/判同编码」零命中）；仅 `CompatibilityList:110-113` 渲染 `objectType/result/reason`。**且兼容行被过滤丢行**：`:83` 只收 `objectType.includes('STOCK')||includes('BOM')`，`:84` 只收 `includes('PRODUCTION')` | owner 实际产出的 objectType 含 `CATALOG_ITEM`（`CatalogOwnerService.java:1628`，**唯一驱动 blockingCount 的一类**）、四类字典（`:1634`）、`STOCK_TARGET`（`InventoryOwnerService.java:619`）、`PRODUCTION_TAG`（`ProductionTagOwnerService.java:427`）→ CATALOG_ITEM 与字典的判定行**在任何页签都不显示**，用户看到「阻断 1」却找不到任何一行解释 | **M** | 跨越两者（前端：停用字符串 includes 分桶、补结构冲突页签与判同 tuple 列；契约：tuple 字段当前不存在）

**IA-COPY-007** | 相同直接复用；非结构差异**必须用户确认后**复用；结构不兼容阻断，禁止"接受并忽略" | ✅ 阻断半边成立：`BrandCatalogCopyDrawer.tsx:86` 确认框 disabled、`:88` 下一步 disabled、`:93` 执行 disabled，无任何绕过控件；❌ 逐项确认半边不成立：只有一个总括 Checkbox「我已核对所有可确认差异与引用映射」（`:86/:92`），IA §8.2 线框里每行的 `[确认复用]` 处置不存在；`confirmationRequiredCount` 只作为数字展示（`:79`），不绑定任何逐项动作 | 一次勾选放行全部待确认项，且此时用户看不到差异内容（无字段差异视图） | **S** | P3-2（逐项处置是前端形态；差异内容依赖 IA-COPY-006 的契约补齐）

**IA-COPY-008** | 执行携带 digest 与 expected versions；漂移返回 typed `STALE_COPY_PREFLIGHT` 并**要求重做预检** | ✅ `:51` 执行体带 `preflightDigest`＋两个 expected version，header 走 submission lifecycle；✅ `:58` 识别 typed `STALE_COPY_PREFLIGHT`；❌(1) **不要求重做**：`:58` 只 `setConfirmed(false)+setStep(2)`，`preflight` 原样保留，用户重勾一次即可拿**同一失效 digest** 再次执行 → 必然失败循环（同仓正确样板：`LocalCatalogCopyDrawer.tsx:161-170`）；❌(2) **expected versions 由前端拼**：`:46-49` 用 `catalogCopyVersionRows`（`catalogModel.ts:171-182` 硬编码 6 类 objectType）取 `Math.max` | 后端比对的是 scope 级 `plan.sourceVersion()/targetVersion()`（`CatalogOwnerService.java:695-699`，聚合见 `:2519-2520`），preflight data 顶层本就有 `sourceVersion/targetVersion`（`:1605`）却被白名单删掉；当前数值等价只因前端复刻了 owner 内部聚合规则，闭包一旦出现第七类 catalog 对象即产生假 STALE | **S** | 跨越两者（(1) 纯 P3-2；(2) 契约把两个 scope version 放回 data，前端停止自造）

**IA-CAT-COPY-LOCAL-001** | 入口在单个商品 Drawer，名称固定「从已有商品复制配置」；只从**同形态**来源商品复制到当前目标商品；不建新商品、不跨 owner、不展开闭包 | ✅ `CatalogItemDrawer.tsx:529` 文案与门控（view＋canWriteCatalog＋非 ARCHIVED）；✅ 方向正确——prop 名虽叫 `sourceItemCode`，`LocalCatalogCopyDrawer.tsx:40` 实为 `targetItemCode = sourceItemCode`，请求体 `{sourceItemCode: 选中候选, targetItemCode: 当前商品}`（`:110/:140`）；✅ `:70` 候选剔除当前商品；✅ 后端本地闭包恒 1 条 | ❌ **"同形态"既不过滤也不显示**：后端候选 SQL 无 shape 谓词（`CatalogOwnerService.java:1238`，仅 `status<>'VOIDED'`，停用/归档商品也进候选），`compatibilityHint` 恒为常量 `"REVIEW_REQUIRED"`（`:1239`）；前端 `:261` `<Tag>{item.compatibilityHint \|\| item.shapeKey}</Tag>` —— hint 恒非空 → **shapeKey 永远不显示**，每行都是同一个英文常量。IA 线框的「同形态」与「可复制：基础资料/SKU/点单选项/BOM」提示均不存在 | **M** | 跨越两者
- 附 **N**：单选用 Checkbox 实现（`:260 checked={selectedSourceItemCode===item.code}`），控件类型应为 Radio。

**IA-CAT-COPY-LOCAL-002** | 九类 contract scope；依赖项自动联选；**形态不适用或下游锁定时禁用并解释原因**；编码/owner/来源/生命周期/版本/外部身份永不复制；基础资料预览逐字段展开 | ✅ 九项齐全（`catalogModel.ts:203-214`）；✅ 依赖联选双向实现（`LocalCatalogCopyDrawer.tsx:32-35`＋`277-299`）；✅ 不复制不可复制事实——后端只合并选中 section key，仅 BASIC_INFO 时换 `attributes`（`CatalogOwnerService.java:781`），UPDATE 不触碰 code/status/source | ❌ 一：**从不 disabled、从不解释**——`:306` `Checkbox.Group options` 无 `disabled` 字段，全仓无消费 `shapeKey`/下游锁的分支，契约也不下发 per-section 适用性事实；❌ 二：**默认九项全选**（`:30/:44`），覆盖式写入默认帮用户勾满最大破坏面（产品判断：破坏性动作默认应空选或仅「基础资料」）；❌ 三：逐字段展开缺失 → 见 -004 | **S** | 跨越两者（禁用依据要契约给，默认值与禁用呈现是 P3-2）；后端 7 个死 section key 与 `skipped` 原因码 = **已被P3-1覆盖**（§6.1）
- 需 Dexter 裁决：P3-1 §6 提出「删 `PRINT_NAME`」，与本条 IA 的九类字面冲突。

**IA-CAT-COPY-LOCAL-003** | BOM 映射逐行显示来源 owner、目标候选、匹配方式与 `matched/unresolved/skippable/blocked`；每个 unresolved/skippable 必须有「映射到…」或「跳过并确认」；blocked 不清零不能进预览 | ✅ blocked 闸门成立：`LocalCatalogCopyDrawer.tsx:331-332` 红 Alert＋下一步 disabled；❌ 其余全缺：`:329` 只渲染「引用映射」（`renderReferenceMappingRow:383-390`＝objectType+targetCode+两个 Tag）与「闭包对象」，**无来源 owner 列、无目标候选选择器、无匹配方式、无四态、无任何逐行处置控件** | 结构上也拿不到 BOM 行：本地预检 `referenceMappings` 只有 1 条 CATALOG_ITEM→CATALOG_ITEM（`CatalogOwnerService.java:810`）；`CatalogInventoryCoordinator.java:599-613 appendOwnerArrays` 合并 closureItems/mappingPreview/objectVersions/compatibilityResults/referenceRewritePreview，**唯独不合并 referenceMappings**；而 mappingPreview/referenceRewritePreview 又被 `CopyPreflightWireShape` 丢弃 → 名为「BOM映射」的第 4 步永远没有 BOM 内容 | **M** | 跨越两者

**IA-CAT-COPY-LOCAL-004** | 预览分「将覆盖/BOM映射/已跳过/不可复制」**四组**，字段级 before→after；提交带目标 expectedVersion＋idempotencyKey；冲突保留选择并要求刷新预览；成功保持 Drawer 与页签并展示 owner readback | ✅ 提交侧完全成立：`:138-141` 带 digest＋两版本＋`Idempotency-Key`；`:124-130` 取 `code===selectedSourceItemCode` 那行的 source/target version，与后端 `copyLocal` 的 `expectedSource!=source.version()\|\|expectedTarget!=target.version()`（`CatalogOwnerService.java:749/758-760`）一致，且本地预检确实只产出这一行（`:807`）→ 注释属实、行为正确；✅ 冲突处置成立：`:161-170` 清 preflight、保留来源/范围/上次映射快照、置 stale、给「重新生成预检」（`:322-325`）；✅ 成功后 readback 留在预览步（`:353-359`、`:406-413`），关闭后 `CatalogItemDrawer.tsx:188` 保留当前 tabKey → 页签不跳 | ❌ 一：**只有三组**——`:350-352` 将覆盖/引用映射/「已跳过 · 不可复制」（后两类被合并）；❌ 二：**零字段级 before→after**——「将覆盖」渲染的是 `closureItems`（`:379-381`），本地恒为 1 行 `CATALOG_ITEM/<code>/<name>/REPLACE`，正是 IA 明禁的"一个总开关隐藏覆盖范围"；❌ 三：**预览里的「已跳过」不是 owner 的 skipped**——owner 预检算了 `skipped`（`CatalogOwnerService.java:818`）但被 `DATA_FIELDS` 丢弃，UI 只能用 compatibilityResults 顶替；`skipped` 只在执行后的 readback 才有（`:409`），用户提交前看不到会跳过什么 | 二 **M**；一、三 **S** | 跨越两者（字段级 diff 与 preflight `skipped` 要契约先放行；分组呈现是 P3-2；`skipped` 原因码本身 = **已被P3-1覆盖**）
- 附 **N**：`:127` 用 `objectVersions.find(row => row.code === ...)` 在**跨 owner 合并后的数组**里按 code 匹配、不校验 objectType；当前无碰撞（inventory 行带的是目标商品码），属潜在脆弱点。

---

## 1. 覆盖确认

- 本面 IA-ID 总数：**12**（IA-COPY-001..008 = 8；IA-CAT-COPY-LOCAL-001..004 = 4），与 §11.3 exact-set 一致。
- **CONFORM 3 条**：IA-COPY-001（完全符合）、IA-COPY-002、IA-COPY-003（前端面符合，各带 1 条 N 级注记）。
- **有差异 9 条**：IA-COPY-004/005/006、IA-CAT-COPY-LOCAL-001/003/004（M，共 6）＋ IA-COPY-007/008、IA-CAT-COPY-LOCAL-002（S，共 3）。
- **整行未验证 0 条**。3 + 9 + 0 = 12 ✓
- 严重度合计：**M 6 · S 3 · N 4**（N 为附注，不单独占行）。

## 2. 我没能覆盖的部分（诚实清单）

1. 未在浏览器里跑过这两个抽屉：渲染顺序、`adminWideDrawerSurfaceProps` 展开后的宽度/焦点、dirty guard 弹窗的真实交互 —— **未验证**。
2. 品牌复制 **preflight/execute** 在 edge 侧如何注入 `sourceDataNodeRef`：走 `m1Bindings.bindPreflightOperationsBrandCatalogCopy`（`OperationsCatalogInventoryController.java:213-214`），该类是构建期生成物，本轮未打开 → 后端来源解析半边 **未验证**（候选接口那一半已亲验）。
3. `IA-COPY-002` 的「反向引用与 `CatalogItemRelation` 不扩张」：仓内 grep 对 `CatalogItemRelation` 零命中，无法证实/证伪它是否以别名存在 → **未验证**。
4. BASIC_INFO 时整体替换 `attributes`（`CatalogOwnerService.java:781`）是否会带过 IA 禁复制的事实（外部身份等）→ **未验证**。
5. 九个 section 里 P3-1 所述「7 个死键」我只亲验了 `has(key)` 静默跳过这一半，未逐 key 亲验目标侧变化。
6. 未核这些形态是否已有 e2e/单测覆盖（不在本次范围，且本轮禁跑测试）。

## 3. 最值得先修的三条

1. **IA-COPY-006 的兼容行过滤丢行**（`BrandCatalogCopyDrawer.tsx:83-84`）。这是本面唯一会让用户**彻底卡死且无从下手**的缺陷：`blockingCount` 由 `CATALOG_ITEM` 行驱动，而该类行不落入任何页签，界面显示「阻断 1」却零解释行、零可操作对象。修复不依赖任何契约变更 —— 去掉 `objectType.includes(...)` 分桶、全量渲染并按对象类分组即可。
2. **IA-COPY-008(1) STALE 后不清预检**（`BrandCatalogCopyDrawer.tsx:58`）。同样纯前端、同一仓已有正确样板（`LocalCatalogCopyDrawer.tsx:161-170`）；不修就是"重勾一次 → 再报 409"的必然失败循环，且用户毫无线索该回哪一步。修法与样板对齐即可，成本极低。
3. **IA-CAT-COPY-LOCAL-001 的 `compatibilityHint` 恒 `REVIEW_REQUIRED` 且吃掉 shapeKey**（`CatalogOwnerService.java:1239` ＋ `LocalCatalogCopyDrawer.tsx:261`）。「选哪个商品作来源」是整个覆盖式写入的**唯一决策点**，用户在这一步拿不到形态、拿不到兼容判定、只看到一串同样的英文常量。前端一处 `||` 误用可立刻改（并列显示形态与 hint），后端补真实同形态判定与过滤 —— 与前两条不同，这条决定的是"用户会不会把配置复制错商品"，一旦错了要靠 -002/-004 缺失的字段级预览才能发现，而那两处正好也缺。

相关文件（绝对路径）：
- `/Volumes/idea/catering-v2s/apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`
- `/Volumes/idea/catering-v2s/apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx`
- `/Volumes/idea/catering-v2s/apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx`
- `/Volumes/idea/catering-v2s/apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- `/Volumes/idea/catering-v2s/apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`
- `/Volumes/idea/catering-v2s/apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`
- `/Volumes/idea/catering-v2s/apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `/Volumes/idea/catering-v2s/apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- `/Volumes/idea/catering-v2s/apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/CopyPreflightWireShape.java`
- `/Volumes/idea/catering-v2s/apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java`


# 面 · 契约面

**范围**:IA-CONTRACT-* 11,共 11 条

---

# 契约面 · IA-CONTRACT-* 逐条对账（11 条）

规范源 `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` §9.1（`IA-CONTRACT-001..008`）+ §9.1 横切表（`009..011`）+ §6.2 页签矩阵 + §9.2 modeRules。
前置亲验：`contracts/catalog/catalog-item-editor-manifest.json` 的 `sourceBindings.ia.sha256=68492c61…e0f36` / `requirements.sha256=9c80dc61…159fd`，与两份文件实测 `shasum -a 256` **逐字符相符** —— manifest 确实声称派生自我读的这一版 IA。三份形态生成物（`catalog-item-editor-manifest.json` / `catalogInventoryShapeManifest.ts` 的 `catalogInventoryShapeManifest` 常量 / `CatalogInventoryShapeManifest.java` 的 `MANIFEST_JSON`）解析后逐 key 比对**无差异**。

---

```
IA-ID | IA 要求的形态 | 当前实际形态(✅带落点) | 差异 | 严重度 | 归属
```

**IA-CONTRACT-001** | 七形态全集+稳定 key+**展示文案**；权益壳左树恒列零计数、新建形态可见但 disabled、原因"权益域尚未开放" | ✅ key 全集与零计数**成立**：`catalog-item-editor-manifest.json` `shapeKeys` 7 值；`CatalogOwnerService.java:1076` `for (String shape : CatalogOwnerTypes.SHAPES) counts.addObject()…getOrDefault(shape, 0L)` 无条件出 7 行；`CatalogWorkbenchPage.tsx:220` 直接铺 `navigation.shapeCounts`。✅ 不可创建成立：`CatalogOwnerService.java:1262` `if (!rule.createAllowed() \|\| rule.visibleButDisabled()) throw 422`。✗ 展示文案：`shapes[].label`（manifest 里唯一带中文处）**不下发** —— `shapeManifest()` `:1250-1252` 只 set `shapeKeys/capabilityValues/modeRules/shapeRules/fieldRules/tabRules/linkageRules/typeEffects/saveSections/detailSections`，`shapes` 与 `shapeAdmission` 不在列。✗ `disabled+原因`被契约剥掉：`CatalogShapeManifestView.shapeRules.items` 是 `additionalProperties:false` 且只声明 6 属性，`createAllowed/visibleButDisabled/disabledReason` 全丢；生成类型 `catalog-inventory-edge.ts:79` 同样没有。✗ 前端三份互异硬编码：`CatalogWorkbenchPage.tsx:35`(SERVICE='服务'/COMPOSITE='套餐')、`CatalogItemCreateDrawer.tsx:21-29`(同左)、`CatalogItemDrawer.tsx:42-50`(SERVICE='服务费'/STANDARD_SALE_WEIGHED='普通销售商品（称重）')，与 manifest 的 '服务/费用商品'/'商品型套餐'/'称重销售商品' 均不同；disabled 与 '（权益域尚未开放）' 也是硬编码（`CatalogItemCreateDrawer.tsx:41,76`） | 文案无下发路径 + disabled/原因被契约 schema 剥离 + 同一形态三种叫法 | **S** | 跨越两者：**标签来源** = 已被 P3-1 §12.1 覆盖（明确挂 shape-manifest）；**shapeRules 被剥掉 createAllowed/visibleButDisabled/disabledReason** = P3-1 未列，属契约面；前端删映射表 = P3-2

**IA-CONTRACT-002** | 四字段派生；`usageCapabilities` 精确 `{SELLABLE,STOCK_MANAGED,BOM_COMPONENT,PRODUCIBLE}`，PRODUCIBLE 保留枚举位但本期不派生/不展示；请求不接收派生值 | ✅ **CONFORM**，四处亲验：① `capabilityValues` 四值含 PRODUCIBLE，`CatalogInventoryShapeManifest.java:8` `enum Capability { SELLABLE, STOCK_MANAGED, BOM_COMPONENT, PRODUCIBLE }`，`typeEffects.producible={"retainedInCapabilityEnum":true,"derivedByShapes":[]}`，7 个 shape 的 `usageCapabilities` 无一含 PRODUCIBLE；② 派生是现算不是存值：`CatalogOwnerService.itemDetail` `:2135-2137` 每次 `shapeRule(row.shapeKey())` 后 `put("itemKind"…)/put("measureMode"…)/rule.usageCapabilities().forEach(...)`；③ 只读摘要：`CatalogItemDrawer.tsx:605-606` view 态用 `Descriptions` 纯文本渲染三字段，edit 态 basic 页签 `:597-601` **只有 name/shortName 两个 Input**，无 checkbox/select；④ 请求不接收：`CatalogItemCreateRequest` `additionalProperties:false` 属性仅 `dataNodeRef/name/code/shapeKey/attributes`，`catalogDraft` `additionalProperties:false` 的 17 个属性中**无** itemKind/measureMode/usageCapabilities/skuMode | **CONFORM** | — | —

**IA-CONTRACT-003** | 形态→页签集（§6.2） | ✅ 5/7 与 §6.2 逐项一致（我逐形态打印 `tabRules[*].visible`）：SKU_VARIANT 6 项、MATERIAL 5 项、COMPOSITE 5 项、SERVICE 4 项、BENEFIT_SHELL 无实例。✗ `STANDARD_SALE_COUNTED` 与 `STANDARD_SALE_WEIGHED` 是 **8 项**，比 §6.2 的 7 项多一个 `ordering`；`CatalogOwnerService.detailTabs` `:1201-1206` 原样把 `tabRules[shape].visible` 铺成 `tabs[]`（全 `visible=true,disabled=false,reason=null`），前端 `CatalogItemDrawer.tsx:516/550` 原样渲染，`tabLabels:27` 标为「**点单与定价**」。同时 `IA-CAT-TAB-001` 把「标准价[按粒度激活]」放在基础资料，而基础资料编辑态 `:597-601` **无价格控件** —— 价格被搬进 IA 不存在的第 8 页签。✗ `tabs[].tabKey` 在 OpenAPI 是无 enum 的 `string`（`catalog-item.schemas.yaml:847`、`catalog-workbench.schemas.yaml:1503`），页签闭集不受契约约束 | 两个形态多一个 IA 无对应的页签；基础资料丢失标准价；tabKey 闭集未声明 | **S** | 跨越两者：tabRules 收敛 = 契约面（P3-1 未列）；tabLabels/渲染 = P3-2；tabKey 枚举闭合落进 P3-1 §12.1 分母

**IA-CONTRACT-004** | 形态→字段可见/必填/只读 与 **priceGranularity 激活** | ✗ `fieldRules` **七个形态逐字节相同**（程序比对 `all(json.dumps(v,sort_keys=True)==base)` = True），都是同一 9 字段 `[name,code,shapeKey,itemKind,measureMode,usageCapabilities,attributes,images,productionTagRefs]`：无 materialRole、无 benefitTargetRef、无价格、无 categoryRefs/tagRefs/salesUnitRefs/shortName/identifiers —— "形态→字段"在 fieldRules 这层是**退化的**（真正按形态区分的事实在 `typeEffects.shapeToFields`，同一规则两份表达，空的那份被当作契约面）。✗ `fieldRules` **零消费**：`CatalogItemDrawer.tsx`/`CatalogWorkbenchPage.tsx` 各 0 次出现；整个 catalog-management 只有 `CatalogItemCreateDrawer.tsx:35-40` 取 manifest 且**只用 `shapeKeys`**。✗ **priceGranularity 未与形态绑定**：`applyDerivedShapeFields` `:1335` 写 `sections.priceGranularity`，但全模块 `grep priceGranularity` 仅 6 处 —— 1335 写、1344 校验 draft **顶层**、1387/2083/2145 三处读 **`ordering.priceGranularity`**，即**派生值写入后从不被读**，生效的是客户端送来的 `catalogDraft.ordering.priceGranularity`（OpenAPI enum `[ITEM,SKU]` 且 required），前端 `OrderingEditor:653-665` 用 **Select** 让用户直选，仅当当前已是 SKU 才 disabled。且 `:1344` 校验的顶层键被 `catalogDraft` 的 `additionalProperties:false` 禁止 → 该守卫对契约合法请求**恒不触发**。✗ materialRole **无写路径**：`typeEffects.shapeToFields.MATERIAL.materialRoleRequired=true`，但 `catalogDraft` 属性集无 materialRole；前端只有临时转正表单硬编码 `shapeKey === 'MATERIAL'`（`CatalogItemDrawer.tsx:572`）。✗ `tagRefs/salesUnitRefs` 在 `CatalogItemDetail.data.item.required` 里，但 `itemDetail` `:2131-2160` **从不 put**；`catalogDraft` 声明了它们而 catalog-management 全目录 **0 次写入** → 商品标签与销售单位在商品编辑器里无写入面 | 形态→字段规则空转且无消费方；priceGranularity 实为客户端自由值 | **M**（可达死锁：`STANDARD_SALE_COUNTED` 无 `sku-specifications-pricing` 页签，一旦被存成 `SKU`，`validateItemActivation:1387-1395` 走 SKU 分支要求"至少一个启用 SKU 且都有价"，抽屉里**没有维护 SKU 的页签** → 商品永久无法启用且无可达修复面） | 跨越两者：priceGranularity 归属与 fieldRules 补全 = 契约/后端（P3-1 §4.3 只列了 `skuSummary`/`ordering.missingPriceCount`/`skus[].version` 三个派生字段，**未列 priceGranularity**，不显式补进去就会漏）；`tagRefs/salesUnitRefs` required 不输出 = 已被 P3-1 §4.2「required 字段实际输出」通用用例覆盖（但那里只点名了 `smartViews.label`，此落点需写进去）；标签/单位控件与 picker = P3-2

**IA-CONTRACT-005** | 形态→库存/BOM 节点准入矩阵（节点是否存在） | ✅ 第一层准入**成立**：`tabRules` 里 COMPOSITE/SERVICE/BENEFIT_SHELL 的 `visible` **无 `inventory-bom`**，与 `typeEffects.shapeNodeAdmission[*].inventoryBom=false` 一致，与 §9.2「服务/费用商品、权益商品壳等在第一层不生成库存节点」一致；前端 `CatalogItemDrawer.tsx:516` 只渲染 `detail.tabs` 里 `visible` 的项 → 不准入形态**确实不出现节点**，不是 disabled 假装支持。✗ 但同一份 manifest 的两张表自相矛盾：`shapeNodeAdmission.COMPOSITE.inventoryBom=false` 却给 `modeEligibilityByShape.COMPOSITE.CATALOG_ITEM=[NONE,INDEPENDENT_STOCK,BOM]`；MATERIAL/SERVICE/BENEFIT_SHELL 的 `allowedNodeTypes` 只有 `["CATALOG_ITEM"]`，却都给了 `OPTION_VALUE:[NONE,BOM]`。（我已 grep 确认 `modeEligibilityByShape`/`shapeNodeAdmission` 在 apps/ 下**零业务消费方**，仅 `CatalogOwnerService.java:1252` 整块透传 + 生成 TS 的无类型 `typeEffects`，故当前是**潜伏**契约缺陷而非活跃行为缺陷） | 准入两张表互相打架，接线者会按哪张都能"自洽" | **S** | 跨越两者：P3-1 §9 已裁定 `inventoryBom[]` 从 catalog 契约删除，删除时必须同批收敛这两张表，否则矛盾原样搬到 inventory 侧；BOM 编辑器 = P3-2

**IA-CONTRACT-006** | 四条 node modeRules；右侧**可选模式及 disabled reason** | ✅ manifest `modeRules` 恰四条，`nodeType/condition/allowedModes` 与 §9.2 表逐行相符（`CATALOG_ITEM+HAS_SKU→[NONE]`；`CATALOG_ITEM+NO_SKU→三态`；`SKU→三态`；`OPTION_VALUE→[NONE,BOM]`），且每条带 `disabledModes[{mode,reason}]` 与 `defaultMode`。✗ **契约把 reason 剥掉**：`CatalogShapeManifestView.modeRules.items` 是 `additionalProperties:false`，只声明 `nodeType/condition/allowedModes`，`defaultMode/disabledModes/description` 无处安放；生成类型同样没有 → **IA 明确要的 disabled reason 在契约里无载体**。✗ **响应违反自身 schema**：`CatalogOwnerService.java:1252` `data.set(key, manifest.path(key))` 把 modeRules/shapeRules **原样**塞进响应（带 `disabledModes`/`createAllowed` 等），而 items 是 `additionalProperties:false`；`OperationsCatalogInventoryController.java:187-190` 的 `shapeManifest` 是 `readResponse(application.readCatalogShapeManifest(...))` **直接返回 JsonNode，无裁剪**。✗ 前端 `InventoryBomEditor:836-857` 是**平铺行列表不是节点树**，`mode` 用**无条件三选 Select** `:846`，不按 modeRules 过滤、无 disabled、无 reason；`nodeType` 由"用户是否手打了选项值编码"反推 `:848` | disabled reason 无契约载体 + 响应超出自身 schema + 前端零 modeRules 约束 | **M** | 跨越两者：契约补 `disabledModes/defaultMode` 并与 owner 输出对齐 = 契约面（P3-1 未列）；BOM 库存对象 picker 后端保证 = 已被 P3-1 §12.2 覆盖；节点树与模式禁用交互 = P3-2

**IA-CONTRACT-007** | 固定性与锁定：形态仅创建可选、**引用后动作禁用原因** | ✅ 形态仅创建可选**成立**（四处）：`fieldRules[*].shapeKey.readonlyWhen={create:false,update:true,view:true}`；`validateClientDerivedFields:1351-1354` 对 shapeKey 变更抛 `SHAPE_DERIVATION_CONFLICT`；`CatalogItemCreateDrawer:76` 有形态 Select，`CatalogItemDrawer` 编辑态 basic 页签 `:597-601` **无形态控件**且顶部 Alert `:598` 写"商品编码与形态创建后不可修改"。✗ **禁用原因无契约载体**：`CatalogItemDetail.data.actionAvailability` 是 `additionalProperties:false`，属性仅 `canEdit/canDisable/canEnable/canArchive` 四个裸 boolean + `voidAvailability`，**没有任何 reason/blockedReason**；owner `:1183-1187` 也只按 `status` 算这四个布尔（`canEdit = !Set.of("ARCHIVED","VOIDED").contains(status)` 等），**完全不看引用事实**。IA-CONTRACT-007 与 `IA-STATE-007`、`IA-CAT-LIFECYCLE-001` 都要求"disabled 并显示具体原因" | 只有 void 一条动作有 blockingReferences/dependentFacts，其余四个动作既不看引用也无原因字段 | **S** | 跨越两者：契约加 reason 载体 + owner 按引用计算 = 契约/后端（P3-1 未列）；渲染原因 = P3-2

**IA-CONTRACT-008** | typed JSON/封闭集合/错误恢复/金额分与数量精度；**自由 map 仅显式豁免** | ✅ **金额 CONFORM**：遍历 catalog+inventory 全部 schema，`standardSalePrice/listedSalePrice/extraPrice/standardPriceDelta/standardExtraPrice/price` 共 27 处**全部** `type:[integer,null] + format:cents`，无例外；前端 `InputNumber precision={0}` + 标签"（分）"（`:660-662`）、`(extraPrice/100).toFixed(2)` 显示（`:788`）。✅ **数量 CONFORM**：`quantity/balance/conversionFactor/lowStockThreshold/threshold/gap/increase/decrease/netChange/countedQuantity` 共 76 处**全部** `string + format:decimal`，无浮点。✗ **封闭集合**：按闭集字段名遍历统计 —— **有 enum 15 处、裸 string 260 处**；`status` 46 处**全裸**、`objectType` 32 全裸、`ownerType` 22 全裸、`shapeKey` 19 处仅 2 处有 enum（都在临时转正请求 `catalog-copy.schemas.yaml:1397/1629`）、`usageCapabilities` 4 处全裸、`stockState` 7、`nodeType` 8、`mode` 7、`selectionMode` 5、`tabKey` 2 全裸。✗ **自由 map 超出唯一豁免**：除 IA 显式豁免的 `attributes` 外，`productionProfiles.{item,sku,optionValue}` 三处 `additionalProperties:true, properties:{}`；`CatalogShapeManifestView` 的 `fieldRules/tabRules/linkageRules/typeEffects/saveSections/detailSections` **六处同样是无类型对象** —— 整份形态契约在 wire 上是六个 opaque map。✗ **错误恢复**：`SHAPE_DERIVATION_CONFLICT`（`:1348/:1353/:1366` 抛出）不在 `catalog-inventory-edge-contract.json` `typedProblemCodes`（25 个）里，全 `contracts/` 零命中 | 闭集未声明；自由 map 从 1 处扩到 10 处；一个真实抛出的错误码未进闭集 | **S** | 跨越两者：**枚举闭合** = 已被 P3-1 §12.1 覆盖（"OpenAPI 枚举由规范源生成或构建期集合相等断言"）；**自由 map 超豁免 + manifest 六字段无类型 + 未声明错误码** = P3-1 未列，属契约面

**IA-CONTRACT-009** | 商品/分类/标签/字典/库存对象/BOM **统一**携带 `ownerType+ownerRef+brandRef`，品牌必填 | ✅ 已带且三项全 required（遍历全 schema 命中 21 处）：`CatalogWorkbenchContext.data`、`CatalogDictionaryView.data.entries[]`、`ProductionTagPage.data.entries[]`、四个 copy 的 `sourceScope/targetScope`、`InventoryConsumptionReferencePage.entries[].ownerScope`。✗ **未带**：`CatalogItemDetail.data.item`（商品，28 个属性无一是 owner 三元组）、`CatalogNavigationView.data.tree[]`（分类，属性仅 `categoryRef/code/name/parentCategoryRef/version/displayOrder/count/countSemantics/deletionAvailability`）、`InventoryTargetPage.data.items[]` 与 `InventoryTargetCurrentView.target`（库存对象）、`item.inventoryBom[]`（BOM）—— 恰是 IA 点名六类里的**四类**。✗ tuple 用词不统一：库存对象用 `productCode`，BOM/商品侧用 `itemCode`，而 §8.5 要求"UI、owner API、数据库唯一约束、mapping preview、digest canonicalization 与复制预检必须**逐字符**采用同一套 tuple" | "统一携带"在契约里不成立，携带与否呈 6:4 分裂；同一 tuple 两个字段名 | **S** | 跨越两者：BOM 那一半 P3-1 §9 已裁定从 catalog 契约删除（需落到 inventory 侧）；**商品/分类/库存对象三处 + productCode/itemCode 统一** P3-1 未列，属契约面

**IA-CONTRACT-010** | production profile 分别属于**商品/SKU/选项值**的 **typed JSON**，不相互折叠 | ✅ 三层不互折：契约 `catalogDraft.productionProfiles` 与 `item.productionProfiles` 都是 `{item,sku,optionValue}` 三个独立对象且全 required；owner `:2151` 逐层 `objectOrEmpty` 取、无继承回填；前端 `ProductionProfileEditor:811-826` 按 layer 独立编辑、切换不合并。✗ **不是 typed**：三层都是 `additionalProperties:true, properties:{}`；前端类型 `Record<string, JsonValue>`（`catalogModel.ts:94`）；编辑器把 6 个字段当**约定键**写进自由 map（`:813-819` `delete nextProfile[key]` / `nextProfile[key]=value`），并把任何未知键渲染成"其他 **typed** 字段：…"（`:824`）。**同组件 Alert 文案 `:822` 写"商品、SKU、选项值分别维护 typed production profile"—— 文案与实际控件/契约冲突。**✗ **无 per-SKU / per-选项值 身份**：契约里 `sku` 与 `optionValue` **各只有一个对象**，不按 skuCode / optionValuePath 分键；前端节点 Select `:821` 只有「商品 / SKU / 选项值」三项。`IA-CAT-TAB-006` 线框要求 `节点：[商品｜SKU：中杯｜SKU：大杯｜选项值：加奶油]` → 一个 3 SKU 的商品，三个 SKU **共用同一份**生产提示 | typed 只在文案里；实例维度缺失，"分别属于 SKU"退化为"所有 SKU 一份" | **M** | 跨越两者 + **需 Dexter 裁决**：P3-1 §9 明确裁定「生产提示…v2s 契约本来就是开放 map，**逐实例今天就能表达**；零反查」且「`productionProfiles` 自由内容与 `attributes` 不拆」。按当前契约与 UI，"逐实例今天就能表达"**不成立**（无实例维度），且"开放 map"正是 IA-CONTRACT-008 只给 `attributes` 的那一个豁免 —— P3-1 的撤回理由与 IA-CONTRACT-008/010 相反

**IA-CONTRACT-011** | 商品/分类/标签/单位/SKU 属性与值/SKU/处理标签编码**创建后不可修改**；库存对象以 `(targetType,itemCode,skuCode?)` 为身份；**统一 terminal VOIDED**；owner 先返回 `canVoid+blockingReferences+dependentFacts`；作废重建换新码、**旧码永久保留** | ✅ 商品编码不可写：`catalogDraft` 无 `code` 属性；`saveSections.immutable=["code"]`；`saveItem` 按 path 上的 code 定位。✅ `canVoid` 三件套已在三处且全 required，结构均为 `{canVoid, blockingReferences[{referenceKind,referenceRef}], dependentFacts[{factKind,factRef}]}`：`CatalogItemDetail.data.actionAvailability.voidAvailability`、`CatalogDictionaryView.data.entries[].voidAvailability`、`ProductionTagPage.data.entries[].voidAvailability`。✅ VOIDED 在 owner 闭集：`CatalogOwnerTypes.STATUSES=[DRAFT,ENABLED,DISABLED,ARCHIVED,VOIDED]`；VOIDED 行 save/transition 均抛 `VOIDED_RECORD_IMMUTABLE`（`:1286`/`:1374`）。✅ **旧码永久保留成立**：`V20260806_120000_000__catalog_inventory_backend.sql:22` `UNIQUE (data_node_ref, brand_ref, code)` **无状态谓词**，前端作废确认文案 `CatalogItemDrawer.tsx:334`"永久保留原编码…**旧编码不会释放**"与之一致。✅ 库存对象身份：`InventoryTargetPage.data.items[]` 与 `InventoryTargetCurrentView.target` 的 `required` 含 `targetType+productCode+skuCode`，未另造库存对象编码。✗ **分类走删除不是作废**：`CatalogCategoryDeleteRequest/DeleteReadback` + `deletionAvailability{canDelete,subtreeSize,blockingReferenceCount,blockingReferenceLabels}`，既不是 VOIDED 也不是 canVoid 三件套，删除即释放编码。✗ **SKU 编码无服务端不可变**：`skus[].skuCode` 是普通可写 string；`saveItem` 对 `sections.skus` **整体覆盖**（`:1292-1298` `draft.fields().forEachRemaining` 逐键 set），全模块 15 处 skuCode 命中**无一处**比对 `productSkuRef` 对应的 skuCode 是否变化；唯一防线在前端（`:702 disabled={Boolean(sku.productSkuRef)}`、`:244 seenSkuCodes`）。SKU 也**没有 VOIDED**（前端状态 Select `:706` 只有 ENABLED/DISABLED/ARCHIVED）。✗ 各处 `status` 是裸 string（46 处），VOIDED 不在任何契约闭集里 | 分类用删除路径、SKU 编码只有前端锁、VOIDED 未进契约闭集 | **M** | 跨越两者 + **需 Dexter 裁决**：**P3-1 §3.2 裁定「VOIDED 释放（编码可被新商品复用）」，与 IA-CONTRACT-011「编码永久保留…新记录编码必须重新输入」正面互斥**；当前实现（无状态谓词的唯一约束）与前端文案都站在 IA 这一侧，而 P3-1 §3.1/§3.3/§3.4 一整批都建在"释放"这个前提上。**编码释放** = 已被 P3-1 §3 覆盖；**分类契约形态、SKU 编码不可变的服务端强制、status 闭集含 VOIDED** = P3-1 未列

---

## 1 · 本面覆盖确认

| | 条数 |
|---|---|
| 本面 IA-ID 总数（§9.1 两张表 `001..011`） | **11** |
| 已核 | **11** |
| CONFORM | **1**（`IA-CONTRACT-002`） |
| 有差异 | **10**（M 4 条：`004`/`006`/`010`/`011`；S 6 条：`001`/`003`/`005`/`007`/`008`/`009`） |
| 未验证 | **0** |

1 + 10 + 0 = 11 ✓。11 条全部逐条打开了实际组件源码或 schema 对象，无一条靠文档/注释/testId 判定。

## 2 · 我没能覆盖的部分（诚实列出）

1. **"响应超出自身 schema"是推论不是观察。** 禁令下我未跑任何 HTTP/容器/测试。该结论由 `CatalogOwnerService.java:1252` 的 `data.set(key, manifest.path(key))`（整块透传）+ `OperationsCatalogInventoryController.java:187-190` 的 `readResponse(application.readCatalogShapeManifest(...))`（直接返回 JsonNode，我逐行确认无裁剪）推出。若 `readResponse` 或 Jackson 配置里另有我没找到的序列化裁剪，`006`/`001` 的"违 schema"半条会被推翻（**"契约剥字段导致前端拿不到 reason"那半条不受影响** —— 生成 TS 类型 `catalog-inventory-edge.ts:79` 里确实没有这些字段）。
2. **`manifestDigest` 未验证。** 声明值 `27b0b0fd…6ae5a`；我试的两种规范化（去 digest / 去 digest+sourceBindings 后 sorted-compact JSON）都对不上，但**我没找到 canonicalization 的定义处**，因此不作为 finding，标 `未验证`。
3. **`contracts/policy/*` 分片未核**（assertion-matrix / l2-locator-bindings / api-scenarios 等）—— 不是 openapi 分片，且按 CLAUDE.md 覆盖矩阵类控制已退役。
4. **`catalogInventoryEdgeWire.ts` / `CatalogInventoryEdgeWire.java` 未逐行核**，只用到 `catalog-inventory-edge-contract.json` 的 `typedProblemCodes`。
5. **`linkageRules` / `saveSections` / `detailSections` 只做了"有无消费方"的 grep**（结论：零业务消费方），未逐条核其语义与 IA 的对应。
6. **`platform-admin` 侧只确认 `apps/frontend/platform-admin/src/app/catalog` 目录存在，未逐文件核**；本族条款的消费面在 operations-admin。
7. **inventory 侧 schema 只做了字段名级扫描**（金额/数量/owner 三元组/枚举），未逐 operation 核 —— `IA-INV-*` 不属本族。
8. **P3-1 工单我是在自己结论成型后才读的**，只读了 §3/§4/§9/§12 与 §11 的 P3-2 对照表，未通读全部 1453 行；若 §1/§5/§6/§7 里另有与我某条重叠的裁定，我的"P3-1 未列"判断在该条上可能偏保守。

## 3 · 最值得先修的三条

**① `IA-CONTRACT-004` 的 priceGranularity 归属（M）** —— 唯一一条我能给出**可达且不可自救**的用户后果：`STANDARD_SALE_COUNTED` 的形态契约说 `priceGranularity=ITEM` 且**不给 `sku-specifications-pricing` 页签**，但「点单与定价」页签的 Select（`CatalogItemDrawer.tsx:658`）允许把它改成 `SKU`，改完 `validateItemActivation:1387-1395` 立刻走 SKU 分支要求"至少一个启用 SKU 且都有价"，而这个形态**没有任何维护 SKU 的入口** → 商品永久无法启用。根因是派生值 `sections.priceGranularity` 写了从不被读、真正生效的是嵌套的客户端值，而顶层守卫 `:1344` 被契约的 `additionalProperties:false` 挡死、永不触发。P3-1 §4.3 已经立好了"派生字段从请求契约里移除、只出现在响应"的不变量族，**但它的三字段清单里没有 priceGranularity** —— 不显式补进去，这条就会被漏掉。

**② `IA-CONTRACT-011` 与 P3-1 §3.2 的编码释放冲突（M，需 Dexter 一句裁定）** —— IA 写"编码永久保留、新记录编码必须重新输入"，P3-1 §3.2 写"VOIDED 释放，可复用编码"，两者互斥。当前仓内**三处证据都站在 IA 这一侧**：无状态谓词的 `UNIQUE (data_node_ref, brand_ref, code)`、`createItem` 的 `DUPLICATE_CODE`、前端作废文案"旧编码不会释放"。而 P3-1 §3.1（inventory 停用 item_code 关联）、§3.3（转正行改置 VOIDED）、§3.4（按编码装载去歧义）**整批**都以"释放"为前提。裁定方向不同，P3-1 §3 的实施范围会差一个数量级；而按现方案实施完，实现就会反向违反 IA-CONTRACT-011。**先裁定再动 §3，比修任何一行代码都省。**

**③ `CatalogShapeManifestView` 的 shapeRules/modeRules 剥字段（M，`001`+`006`+`007` 三条的共同根因）** —— `additionalProperties:false` 把 `createAllowed/visibleButDisabled/disabledReason/defaultMode/disabledModes` 全部挡在契约外，于是"权益域尚未开放"、形态可否创建、模式为何 disabled 这三类**IA 明文要求的原因文案**在前端只能硬编码（`CatalogItemCreateDrawer.tsx:41,76` 与三份互异的 shapeLabels）。它同时是 `IA-CONTRACT-001` 文案漂移、`IA-CONTRACT-006` 无 disabled reason、`IA-CONTRACT-007` 无禁用原因的共同根因。**排它第三而不是第一，是因为 P3-1 §12.1 已经决定要往同一个 `shape-manifest` 端点加标签字典** —— 这两件事必须同批做，否则该端点的契约要改两次、生成物要重出两次。


# 面 · 门店轻库存

**范围**:IA-INV-* 5 + IA-INV-ACTION-* 5,共 10 条

---

仓库根 `/Volumes/idea/catering-v2s`（只读，无写入，未运行任何测试/容器/构建）。下列落点为仓库根相对路径。

## 逐条对账（IA-INV-* 5 条 + IA-INV-ACTION-* 5 条 = 10 条）

| IA-ID | IA 要求的形态 | 当前实际形态（✅带落点） | 差异 | 严重度 | 归属 |
|---|---|---|---|---|---|
| `IA-INV-001` | 复合主列；身份行 `NameCodeText`（编码小一号且弱化）；**对象形态/分类/物料标记在次级行可见**；**每个筛选语义均有对应可见事实**；不展示来源筛选但来源作为结果事实可见 | ✅ 复合主列在 `InventoryManagementPage.tsx:52-56`（`Space` 竖排：Button>NameCodeText 身份行 + `Typography.Text` 次级行 + SKU 行）；✅ 弱化规则在 `libraries/frontend/admin-ui-foundation/src/presentation/nameCode.ts:14,19`（`font-size-sm` + `color-text-tertiary`）；✅ 来源列 `:62` 常量「内部轻库存」，search 列只有 keyword/categoryRef 两项，无来源筛选；✅ 次级行取 `[targetType, categoryName, materialRole]` `:54`；分类筛选为 `ProColumns` 默认文本 `Input` `:51` + `wireUuid(categoryRef)` `:29` | 见下【D-1】【D-2】【D-3】【D-4】：分类筛选是自由文本且传 UUID 会渲染期抛错；名称关键词必定 0 结果；分类事实渲染成 UUID；对象形态在列表不存在 | **M** | D-1/D-3 **P3-2**；D-2/D-4 **跨越两者**（详见下） |
| `IA-INV-002` | 「需处理」由低/无/负/未知等派生，**只是视图，不进入 `stockState`** | ✅ `StockView` 含 `NEEDS_ATTENTION`（`inventoryManagementModel.ts:5`），但状态列映射 `stateLabels`（`InventoryManagementPage.tsx:14`）**不含** `NEEDS_ATTENTION`；✅ 后端 SQL `CASE` 只产出 `UNKNOWN/NEGATIVE/OUT/LOW/OK`（`InventoryOwnerService.java:1127`）；✅ 计数来自 `page.counts`，Segmented 带计数 `:69` | 无 M/S。**N**：`matchesStockView`（`inventoryManagementModel.ts:81-85`）全仓无调用（grep `apps/frontend` + `libraries/frontend` 仅命中定义），且其派生规则 `unknown\|\|stale\|\|[LOW,OUT,NEGATIVE,UNKNOWN]` 与服务端 `stock_state <> 'OK'` 不一致——一份不执行且分叉的第二定义 | **CONFORM**（附 1 N） | P3-2 |
| `IA-INV-003` | 保留今日/7天/30天结构，**统一叫「库存变化」**；消耗单位/每份消耗术语正确 | ✅ 列表列头「今日 / 7天 / 30天」+ 副标「库存变化」`InventoryManagementPage.tsx:60`；✅ 详情 ② 标题「② 库存变化」`InventoryDetailDrawer.tsx:119`，周期行 今日/7天/30天 `:79-81`；✅「每份消耗」列 `:131`；✅「消耗单位」用于列表/详情/动作面；前端全仓无「消耗趋势」残留 | 无 | **CONFORM** | — |
| `IA-INV-004` | 门店库存对象**没有独立创建按钮** | ✅ `InventoryManagementPage.tsx:70` 的 `ProTable` 只给 `options={{density:false,fullScreen:false,reload}}`，无 `toolBarRender`；全文件仅 4 个 Button：行内打开 `:53`、查询/重置 `:71`、重试 `:67` | 无 | **CONFORM** | — |
| `IA-INV-005` | 六区不可合并；③盘点/增加子集、⑤全部流水、④全域反查；①含**最近变化**；⑥「普通用户完全不渲染，**不出现标题、占位或锁图标**」 | ✅ 六个独立 Collapse item + 六个独立 testId（`InventoryDetailDrawer.tsx:107,119,124,129,134,139`），③⑤走不同端点（`business-history` vs `ledger`）→ 不合并；✅ ④五列齐（来源对象/来源层级/每份消耗/时机/状态 `:131`）；❌ ⑥ 由无条件数组字面量展开 `:139`，无任何权限判断 | 见下【D-5】【D-6】【D-7】【D-8】 | **M**（另 3 S） | D-5 **跨越两者**；D-6 **P3-2**；D-7 **跨越两者**；D-8 **P3-2** |
| `IA-INV-ACTION-COUNT-001` | 显示当前库存与盘点换算；**录入单位可选消耗单位或已启用盘点单位**；实盘允许 0，但**覆盖为 0 必须额外确认**；备注可填；提交前实时 before→after 预览 | ✅ 当前库存+换算 Alert `InventoryActionModal.tsx:217`；✅ 录入单位是真 `Select`（`:211`，options 来自 `:102-105`）——**形态正确，是选择器不是自由文本**；✅ 实盘 0：`InputNumber min={0}` `:210` + validator `value >= 0` `:186`；✅ 零确认 Checkbox 仅 `isZeroCount` 时出现 `:213`，未勾选时提交被拦并回填字段错误 `:143-146`；✅ 备注非必填 `:216`；✅ 预览 `:110-118,192` | 见下【D-9】：两个单位选项的 label 只有裸单位名（`{label: value, value}` `:104`），丢失「消耗单位/盘点单位」限定语，选错单位会静默乘以换算因子 | **S** | P3-2 |
| `IA-INV-ACTION-INCREASE-001` | 明确「只增加轻库存数量，不代表采购、收货、WMS 入库、成本或应付」；数量必须大于 0；可用消耗/盘点单位；显示换算与 before+change=after | ✅ 数量 >0：validator `value > 0` `:186` + `min={0.0001}` `:210`；✅ 单位同一 Select；✅ 预览 `after = before + normalized` `:116`，文案 `:192`；✅ 免责语在 `:217` | **N**：免责语作「仅影响轻库存数量，不代表采购、收货或 WMS 入库」，缺 IA 明列的「成本或应付」；**N**：该句写在 `!isConfiguration` 公共块，盘点/人工调整也照样显示，非 INCREASE 专属 | **CONFORM**（附 2 N） | P3-2 |
| `IA-INV-ACTION-CONFIG-001` | 只调整低库存阈值、允许负库存、**盘点单位**及正数有限换算；不改余额、不维护 BOM；详情加载完成前显示「正在读取独立库存配置」，不先渲染默认空表单 | ✅ 恰好四项：`Switch` `:222`、阈值 `InputNumber` `:223`、盘点单位 `Select` `:224`、换算 `InputNumber min=0.000001` `:225`（正数有限 ✅）；✅ 无余额输入，余额只在只读 `Descriptions` `:227`；✅ 加载态 Alert `:196` + `action && current &&` 表单门 `:207` | 见下【D-10】：盘点单位候选集退化为单一项，**从未配过盘点单位的对象永远配不出来** | **M** | 跨越两者 |
| `IA-INV-ACTION-ADJUST-001` | 方向增加/减少；数量+录入单位；**原因由契约给受控候选**；备注必填；预览负库存按 `allowNegative` 阻断或警告 | ✅ 方向是 `Radio.Group`（`:214`，非下拉，形态与 IA `[增加｜减少]` 一致）；✅ 数量+单位 `:210-211`；✅ 原因是 `Select` `:215`，6 个 value 与生成契约 `InventoryAdjustmentRequest.reasonCode` 枚举**逐值相同**（`catalog-inventory-edge.ts:122`）→ 受控成立；✅ 备注 `action==='ADJUST' ? [{required:true}]` `:216`；✅ 负库存：`negativeAfter/negativeBlocked` `:119-120`，error/warning 双形态 `:218`，阻断时提交按钮 `disabled` `:194` | 无 M/S。**N**：6 个中文标签硬编码在 `:28-35`——标签来源问题**已被 P3-1 覆盖**，删前端映射表属 P3-2 | **CONFORM** | 已被P3-1覆盖（标签来源）/ P3-2（删表） |
| `IA-INV-ACTION-RESULT-001` | 四类提交复用结果 Drawer，显示库存对象/业务结果/调整前/变化量/调整后/流水 ref/成败原因；失败保留输入；成功刷新列表·详情·变化记录并将焦点返回发起按钮；用统一 lifecycle + expectedVersion/idempotency，冲突不盲重试 | ✅ 四类共用同一结果块 `:197-206`，CONFIGURE 走合成结果 `:73-86`；✅ 七行字段 `:199-205`；✅ 失败只 `setProblem`、不 reset 表单 `:177-180`；✅ 焦点回发起按钮 `InventoryDetailDrawer.tsx:86-89`；✅ `expectedVersion` + `Idempotency-Key` `:148-150`，无重试循环 | 见下【D-11】【D-12】：结果面会被自身触发的刷新擦除；同一 effect 也会清空用户在填的表单 | **M**（另 1 S） | P3-2 |

---

## 差异明细（每条区分 仓内事实 / IA 要求 / 推论 / 产品判断）

**【D-1】分类筛选是自由文本，且填入「编码」会在渲染期抛异常 — M — P3-2**
仓内事实：`InventoryManagementPage.tsx:51` 用 `ProColumns` 默认文本 `Input`，`title: '商品分类编码'`、`placeholder: '商品分类编码（可选）'`；`:29` 对该值调 `wireUuid(categoryRef)`；`libraries/frontend/admin-ui-foundation/src/http/wireUuid.ts:8` 为 `if (!UUID.test(candidate)) throw new Error('WIRE_UUID_REQUIRED')`；该调用位于 `useMemo`（`:26-33`）内，即**组件渲染期**。契约 `InventoryTargetPageQuery.categoryRef?: Uuid`（`catalog-inventory-edge.ts:113`）确认传输需要 UUID。
推论：用户按提示语键入真实分类编码（如 `CAT-DRINK`）→ `wireUuid` 在 render 中抛错 → 该页崩溃，而不是给出表单校验提示。只有键入 36 位 UUID 才不崩。
IA 要求：§7.1 线框为 `[分类]`，§7.3 要求「分类 → 分类/物料标记行」的可见对应。
产品判断：提示语要「编码」、传输要 UUID、控件是自由文本——三者互斥；这正是「提示语与控件冲突本身就是 finding」。修法方向（分类树 picker vs 由后端接受 code）属 P3-1 已保证的「五处 picker 后端端点」范围内的前端接线，**归 P3-2**。

**【D-2】关键词按名称检索必定返回 0 条 — M — 跨越两者（实为后端独有，不在 P3-1 已覆盖五条内）**
仓内事实：`CatalogInventoryCoordinator.java:105-116` 在有 keyword 时先走 `catalog.readItems` 前置过滤，把命中 itemRef 塞进 `catalogItemRefs`，但**没有移除 `keyword`**（只 `remove("categoryRef")`）；catalog 侧谓词是 `i.name ILIKE ... OR sections->>'shortName' ILIKE ... OR i.code ILIKE ...`（`CatalogOwnerService.java:1118`）；inventory 侧随后又追加 `AND st.item_code ILIKE '%'||?||'%'`（`InventoryOwnerService.java:1125`），与 `AND st.item_ref IN (...)`（`:1126`）落在同一 `base` CTE 的 WHERE 内，二者取交集。
推论：搜「咖啡豆」→ catalog 命中 itemRef ✅ → inventory 再要求 `item_code ILIKE '%咖啡豆%'` ✗ → 0 行。只有搜编码才通。前端 placeholder 明写「库存对象名称/编码」（`InventoryManagementPage.tsx:50`）。
各做哪一半：**前端无需改动**；后端应在 coordinator 已解析 `catalogItemRefs` 时不再重复施加 keyword 谓词。需新开后端项，P3-1 未覆盖。

**【D-3】次级行的「分类」渲染成分类 UUID — M — P3-2 + 跨越两者**
仓内事实：`CatalogInventoryCoordinator.java:743` 写入 `row.put("categoryName", catalogItem.path("categoryRefs").get(0).asText())`；`CatalogOwnerService.java:2067/2132` 的 `categoryRefs` 数组元素来自 `sections.categoryRefs` 原样文本，而该 JSON 以 `category_ref::text`（UUID）为键（`:1063` 的 `jsonb_exists(i.sections->'categoryRefs', c.category_ref::text)`）；前端 `InventoryManagementPage.tsx:54` 直接把 `row.categoryName` 拼进次级行。
推论：字段名叫 `categoryName`，值却是 UUID——**命名不构成证据的又一例**；用户在分类槽位看到一串 UUID。另：只取 `[0]`，多分类商品丢失其余分类。
各做哪一半：后端应回填真实分类名（catalog 已有 `category` 表的 `name`，`:1063`）；前端在拿到真名后无需改动，但若产品要显示多分类需前端定形态。

**【D-4】列表次级行没有「对象形态」，占位的是常量 `PRODUCT` — S — 跨越两者**
仓内事实：列表次级行第一段取 `row.targetType`（`InventoryManagementPage.tsx:54`）；`InventoryOwnerService.java:1461` 把 `targetType` 硬编码为字面量 `"PRODUCT"`，且 `enrichInventoryTargets`（`CatalogInventoryCoordinator.java:736-747`）只回填 `productName/categoryName/materialRole/skuName`，**不碰 targetType**；生成契约的列表行类型也**没有 `productShape` 字段**（`catalog-inventory-edge.ts:69`），只有详情有（`:70`，且由 `enrichInventoryTarget` 用 `item.shapeKey` 回填）。
IA 要求：`IA-INV-001`「对象形态…在次级行可见」。
推论：列表次级行恒为 `PRODUCT｜<uuid>｜<materialRole>`，对象形态实际缺席。各做哪一半：后端列表行需补 `productShape`（详情已有同源 `shapeKey`）；前端改渲染字段。

**【D-5】⑥ 高级诊断对所有人无条件渲染，且两个端点自相矛盾 — M — 跨越两者**
仓内事实：`InventoryDetailDrawer.tsx:139` 是 `...([{key:'diagnostics', ...}])`——从**无条件数组字面量**展开，无任何权限分支；`diagnosticsAvailability` 在契约（`catalog-inventory-edge.ts:70`）和本地类型（`inventoryManagementModel.ts:55`）都有声明，但全仓 grep（`apps/frontend` + `libraries/frontend`）显示**从未被任何组件读取**；`shouldRequestInventoryDiagnostics`（`inventoryManagementModel.ts:77-79`）名字像权限门，函数体是 `return drawerOpen` 的恒等透传，其单测（`inventoryManagement.test.ts:6-7`）断言的也只是 `f(true)===true / f(false)===false`。后端两处自相矛盾：详情写死 `diagnosticsAvailability = {canRead:false, reason:"permission_required"}`（`InventoryOwnerService.java:1193`），诊断端点却写死 `permission.granted = true` 并返回三个空数组（`:1338`）。
IA 要求：`IA-INV-005` 线框原文「普通用户：第⑥区块完全不渲染，不出现标题、占位或锁图标」。
推论：任何用户展开详情都能看到 Collapse 头「⑥ 高级诊断」；展开后 `diagnosticsView` 为真值、`warnings` 为空 → 渲染一张只有表头的空表。**标题 + 占位两条禁令同时被违反**。
各做哪一半：后端要给出真实权限判定并让两端点一致；前端要按 `diagnosticsAvailability.canRead` 决定是否把该 item 放进 `zoneItems`（而不是渲染后再隐藏）。

**【D-6】① 当前状态缺「最近变化」 — S — P3-2**
仓内事实：IA ① 要求「对象名｜编码｜形态｜余额｜状态｜阈值｜来源｜盘点单位｜**最近变化**」；`InventoryDetailDrawer.tsx:108-117` 的 `Descriptions.items` 实为 identity/sku/shape/balance/state/threshold/source/counting 八项，**无最近变化**。`recentChanges` 在契约（`catalog-inventory-edge.ts:70`）和本地类型（`inventoryManagementModel.ts:52`）都存在，后端也真实填充（`InventoryOwnerService.java` 的 `recentChanges(targetRef)`，取 ledger 近 20 条），但前端无任何读取点——**字段存在但无消费点**。

**【D-7】⑥ 的内容与 IA 指定的五项诊断完全不同 — S — 跨越两者**
仓内事实：IA ⑥ 要求「数据状态｜余额生成｜最近流水｜变化数｜同步水位」；实际渲染的是「查询 / 数据库操作数 / 耗时(ms)」三列（`InventoryDetailDrawer.tsx:142`）。契约 `InventoryDiagnosticsView` 只提供 `permission/queries/timings/warnings`（`catalog-inventory-edge.ts:75`），后端返回三个空数组（`InventoryOwnerService.java:1338`）。
推论：这五项诊断事实当前**在契约层就不存在**，不是前端漏渲染。后端补字段、前端补呈现，各做一半。

**【D-8】④ 的「来源层级」是常量，且 rowKey 会撞键 — S — 跨越两者**
仓内事实：前端 `InventoryDetailDrawer.tsx:131` 渲染 `row.ownerScope?.ownerType ?? '—'`；`CatalogInventoryCoordinator.enrichInventoryConsumptionReferences` 对每行写死 `ownerScope.ownerType = "DATA_NODE"`。同处 `timing`/`status`：分页端点的 `timing` 有 DB 列来源、缺省回落 `"BOM"`（`InventoryOwnerService.java:1272`），`status` 由 catalog item 状态真实回填（coordinator 内），这两项可接受。
另（**N/S**）：`rowKey="sourceCode"`（`:130`），而 `sourceCode` 只取 `item_code`，同一商品的 ITEM/SKU/OPTION_VALUE 三类行会共享同一 `sourceCode`（`InventoryOwnerService.java:1486-1493` 中 `sourceKind` 才区分三态）→ 同一目标被同商品多 SKU 消耗时**必然重复 key**。
IA 要求：④「来源层级｜来源对象+编码｜每份消耗｜时机｜状态」，且「保留 v4 最好的全域反查设计」。常量 `DATA_NODE` 不构成「层级」事实。

**【D-9】录入单位两个选项丢失「消耗单位/盘点单位」限定语 — S — P3-2**
仓内事实：`InventoryActionModal.tsx:102-105` 生成 `{label: value, value}`，label 就是裸单位名（如「千克」「袋」）；IA §7.4 线框为 `录入单位：[消耗单位(千克)｜盘点单位(袋)]`。
推论：用户只看到两个单位名，无法判断哪个是盘点单位；选错时 `configuredConversionFactor`（`:62-71`）会静默按换算因子放大/缩小数量，且预览也按同一因子显示，**错误不会在界面上暴露**。这是三个写操作（盘点/增加/调整）共用的输入口，风险面最大。
附 **N**：`inputUnits` 取 `current.target.countingUnit`，而换算因子取 `current.configuration.countingUnit ?? current.target.countingUnit`（`:64`）——同一概念两个来源；今日两者同源（`InventoryOwnerService.java:1468` 的 `targetDetail` 也用 `config.countingUnit` 回落 `measureMode`），故**当前无实际故障**，只是潜在重复定义。

**【D-10】快捷配置的「盘点单位」候选退化为单一项，无法首次配置 — M — 跨越两者**
仓内事实：`InventoryActionModal.tsx:106-109` 的 `countingUnits = unique([target.consumptionUnit, target.countingUnit])`；后端 `targetDetail` 里 `countingUnit = config.countingUnit ?? row.measureMode()`（`InventoryOwnerService.java:1468`），而 `consumptionUnit` 同样 `= row.measureMode()`。
推论：从未配置过盘点单位的对象，两个来源同值 → `Set` 去重后 `Select` **只有一个选项**（且等于消耗单位）→ 换算输入框被 `disabled`（`:225`）→ `IA-INV-ACTION-CONFIG-001` 明列的四项能力中「盘点单位」这一项在 UI 上不可达。
补充事实：全仓契约无单位字典/候选端点——`measureMode` 在 shape manifest 中是自由 `"type": "string"`（`contracts/openapi/catalog-inventory.openapi.yaml:8458`），不是受控枚举。
`DEXTER_DECISION`：修法应是「后端提供单位候选字典」还是「盘点单位改自由文本输入」，属产品裁定，我不替裁。但「当前形态下这项配置能力不可达」是确定的仓内事实。

**【D-11】提交成功后结果面会被自身触发的刷新擦除 — M（推论，机制已定位到行级；未运行验证） — P3-2**
仓内事实：`InventoryActionModal.tsx:123-137` 的 `useEffect` 依赖 `[action, current, form, lifecycle]`，函数体**无条件**执行 `lifecycle.reset(); setProblem(undefined); setResult(undefined); form.resetFields();`。`submit` 成功路径为 `setResult(readback)` → `onCompleted()`（`:173,176`）→ `InventoryDetailDrawer.tsx:159` 的 `onCompleted={refreshAll}` → `refreshAll` 首行 `void current.refetch()`（`:95`）。`current` prop 即 `envelopeData(current.data)`（`:68`），随 RTK Query 刷新换新对象身份（写操作后 `balance`/`version` 必变，内容亦不同）。依赖数组另三项均稳定：`lifecycle` 由 `useMemo` 固定身份（`libraries/frontend/admin-ui-foundation/src/behavior/useSubmissionLifecycle.ts:20`，注释正是为此），`form` 来自 `Form.useForm()`，`action` 未变。
推论：refetch 落地后 effect 重跑 → `setResult(undefined)` → 结果面消失、退回空白表单。`IA-INV-ACTION-RESULT-001` 要求的「四类提交都复用结果 Drawer 显示…」在成功路径上只能短暂出现。**未运行验证**（本轮禁止运行），但触发链每一环都有行级落点。

**【D-12】同一 effect 会清空用户正在填写的表单 — S — P3-2**
同因于 D-11：`current` 任何一次身份变化都会触发 `form.resetFields()`（`InventoryActionModal.tsx:127`）。动作抽屉与详情抽屉同时挂载（`InventoryDetailDrawer.tsx:159` 无条件渲染），详情侧任一刷新都会波及填写中的表单。
附 **N**：`refreshAll`（`:94-102`）只 refetch 当前展开的分区；曾展开又折叠的 ③/⑤ 在写操作后不刷新，`apps/frontend/operations-admin` 与 foundation 全仓未配置 `refetchOnMountOrArgChange`/`refetchOnFocus`（grep 无命中，即 RTKQ 默认 false），故再次展开时先呈现旧缓存。这与「成功刷新列表、详情、变化记录」有落差。**推论，未运行验证。**

---

## 1. 本面 IA-ID 总数与逐条覆盖确认

- 分母：**10 条**（`IA-INV-001..005` 5 条 + `IA-INV-ACTION-COUNT/INCREASE/CONFIG/ADJUST/RESULT-001` 5 条），与 §11.3 exact-set 两行逐字一致（`doc/plans/platform/2026-08-06-...-information-architecture-codex.md:991-992`）。5 条四段式 ID 已逐条单独核实，无一遗漏。
- 已核 **10 条**：CONFORM **5**（`IA-INV-002`、`IA-INV-003`、`IA-INV-004`、`IA-INV-ACTION-INCREASE-001`、`IA-INV-ACTION-ADJUST-001`；其中 002 附 1 N、INCREASE 附 2 N、ADJUST 附 1 N，均不改变判定）；有差异 **5**（`IA-INV-001`、`IA-INV-005`、`COUNT-001`、`CONFIG-001`、`RESULT-001`）；未验证 **0**。5 + 5 + 0 = 10 ✅
- CONFORM 判据（均已打开源码逐段核对，非「组件存在」）：002 核的是 `stateLabels`（`:14`）不含 NEEDS_ATTENTION + 后端 CASE 只出五态（`InventoryOwnerService.java:1127`）；003 核的是三处标题字符串 + 每份消耗列；004 核的是 `ProTable` 无 `toolBarRender` 且全文件仅 4 个 Button；INCREASE 核的是 validator `value > 0` 与 `after = before + normalized`；ADJUST 核的是 `Radio.Group` 形态 + 6 个 value 与生成契约枚举逐值比对 + 备注 required 分支 + `disabled={negativeBlocked}`。

## 2. 我没能覆盖的部分（诚实列出）

- **未运行任何东西**。D-11/D-12 的擦除链、D-1 的渲染期抛错、D-2 的 0 结果，都是从源码与 SQL 推出的**推论**，没有浏览器/测试证据。三者的每一环我都给了行级落点，但「实际跑起来是否如此」未验证。
- **未核 IA-STATE-\*、IA-CONTRACT-\* 与 IA-NAV-\***。⑥ 高级诊断的权限语义正源在 `IA-STATE-008`（不在本面），我只判了 `IA-INV-005` 明文规定的**渲染行为**；权限模型本身是否另有设计，`UNVERIFIED`。
- **未核 §7.3 对账表以外的筛选路径**，也未核 `platform-admin` 侧是否有第二套库存界面（本轮只走 `operations-admin`）。
- **未核 shape-manifest 是否已能下发库存侧枚举标签**（`stockState`/`materialRole`/`ownerType`/`action`/`reasonCode`/`source` 等裸枚举）。我按交办边界一律记为「标签来源已被 P3-1 覆盖」，但**没有独立验证 P3-1 的覆盖是否真的含库存面这批枚举**——若不含，会漏。
- **未核 D-10 的产品意图**：盘点单位到底该是字典选择还是自由文本，我只证明了当前形态不可达，未替 Dexter 裁定。
- **未核**：⑤ ledger 的 `reasonCode` 对盘点/增加类写入为空串（`InventoryOwnerService.java` 的 `ledgerEntries` 中 `r.getString(6)==null ? "" : ...`）会让「原因」列空白，这是否符合产品预期未判定。

## 3. 最值得先修的三条及理由

1. **D-1 分类筛选（M）** — 唯一一条会让**页面直接崩**的缺陷，且触发方式正是照着界面提示语操作：字段写「商品分类编码」，填编码即 `wireUuid` 在 render 抛错。破坏性最高、触发概率最高、修复边界最清晰（P3-1 已保证候选端点，只差前端接线）。
2. **D-5 ⑥ 高级诊断无权限门（M）** — 违反的是 IA 里少见的**显式禁令**（「不出现标题、占位或锁图标」），且防线是三重虚假的：前端有个名叫 `shouldRequest*` 的恒等函数、有个从不被读的 `diagnosticsAvailability`、后端两个端点对权限的答案互相矛盾。任何只看命名或只看单测的复核都会判它绿——这类假绿越早拆越好。
3. **D-11 结果面被自身刷新擦除（M）** — 打掉的是四个写操作**唯一的结果确认面**：用户提交后看不到「调整前/变化量/调整后/流水号」就回到空表单，无法确认写入是否生效，极易诱发重复提交（幂等键此时已被 `lifecycle.reset()` 清掉，重提会变成第二条命令）。修点集中在 `InventoryActionModal.tsx:123-137` 一个 effect 的依赖与守卫，代价小、收益大。

（D-2 名称搜索 0 结果同为 M，但根因纯在后端且需新开后端项，不与上述三条竞争前端修复顺位；建议与 D-3 分类名回填一并作为后端一批。）
