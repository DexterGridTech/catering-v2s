# 前端 finding 台账 · 2026-08-16

> **这是工作台账,不是交付物。** 供我自己做去重、证伪、规范沉淀与计划制定。
> 未经第二步验证的条目**不得**直接进入交给 Codex 的任何材料。

**分母**:212 个手写 ts/tsx(operations-admin 114 · platform-admin 67 · foundation 29,已排除 generated 与 node_modules)
**来源**:六路独立盲查,每路逐文件读完不采样
**ID 规则**:`FE-###` 稳定不变,**不编码严重度** —— 严重度是字段,可随验证改判(后台 `M-05=S-19` 的重复计数教训)

## 验证状态取值

| 状态 | 含义 |
|---|---|
| `亲验✓` | 我自己打开源码/实跑确认过 |
| `待验` | 仅 agent 报告,我尚未复算 |
| `已证伪` | 我复算后推翻,保留记录说明为什么 |
| `锚点已修` | 主张成立但 agent 给的行号有偏差,已更正 |

## 来源路代号

`C`=catalog-management · `O`=operations 其余 11 feature · `A`=operations app/store/transport
`P`=platform-admin · `F`=foundation · `X`=横切官方用法

---

# 第一部分 · 已亲验证实

| ID | 源 | 位置锚点 | 事实 | 业务场景 | 初判 |
|---|---|---|---|---|---|
| **FE-001** | O | `InventoryDetailDrawer.tsx:37` `const path = {targetRef: wireUuid(targetRef ?? '')}` | 组件体顶层无条件求值,前面无 early return;`app/api/wireUuid` re-export foundation 的**抛错版**;列表页 `targetRef={detail.isOpen ? detail.target : undefined}` 无条件渲染 | **门店库存页首屏白屏**。点菜单即 `AdminErrorBoundary`「页面暂时无法显示」,一条库存都看不到 | 阻断 |
| **FE-002** | O | `WorkspaceInvitationCreateDrawer.tsx:165` `pattern: /^1\\d{10}$/` | `od -c` 确认源码字节是两个反斜杠;实跑 `test('13812345678')` = **false**;登录页同一条是单反斜杠 = true | **五个用户管理页的「发出邀请」永远提交不了**,新员工无法入职 | 阻断 |
| **FE-003** | X | `CatalogItemDrawer.tsx:947`+950 · **:1017**+1019 · `:860`+子树 | 三处 React `key` 由用户正在编辑的字段拼成,同子树内就是编辑该字段的 `<Input>`;`updateSku` 同步无防抖 | **每敲一个字符输入框被销毁重建、焦点丢失**。新建 SKU 敲 `LATTE-L` 要点 7 次。三处**都在创建路径**(已落库 SKU 编码是 disabled 的) | 阻断 |
| **FE-004** | P | `RolesPage.tsx:56-65` `finally{...await loadDetail()}` + `:45` `loadDetail` 首句 `setProblem(undefined)` | `setProblem(undefined)` 在第一个 await **之前**同步执行,与 catch 的 `setProblem(错误)` 同批,最终值 undefined | **角色停用失败,页面无任何提示**。管理员以为没点中,反复点击,每次静默失败 | 高 |
| **FE-005** | P | `PlatformInvitationPanel.tsx:118` `const latest = await getWorkspaceInvitation(...)` → `expectedVersion: latest.revision` | 全仓 13 处 `expectedVersion`:11 处用「用户当时看到的那版」(`admin.version`3/`workspace.version`2/`role.revision`2/`account.revision`2/`definition.revision`1/`action.assignment.revision`1),**仅这 2 处重读** | A 打开邀请详情准备取消,B 同时重发了它。A 的客户端重读拿到 B 的新 revision,**取消掉自己从未看见的那条新邀请**。乐观并发保护被客户端删除 | 高 |
| **FE-006** | F | `useDrawerFormLifecycle.ts:126` 与同文件 `:106` · `useSubmissionLifecycle.ts:11` | **4 处有保护 2 处没有**,其中两处在同一文件相隔 20 行。`:106` 是 `globalThis.crypto?.randomUUID?.() ?? fallback`,`:126` 是裸 `crypto.randomUUID()` | `crypto.randomUUID` 是 `[SecureContext]`。localhost 不受影响;LAN 明文访问 dev server 时抛错。vite 确认 `host:'0.0.0.0'` 无 https。**生产侧 `UNVERIFIED`(无部署配置)** | 中(一致性) |
| **FE-007** | A+P | `platform-admin` 7 文件 81 处 · `operations-admin` 6 文件 94 处 `assert.match`,全部 `readFileSync` | **13 个文件 175 处正则断言**,断的是源码文本长什么样。P 路实测:对一个 JSX 标签**纯换行**(属性不变行为不变)立即变红 | 无业务后果。但**制度性锁死当前排版** —— 直接决定前端 format 批的排序约束 | 高(流程) |
| **FE-008** | C | `CatalogWorkbenchPage.tsx` `okButtonProps={{disabled: batchSubmitting \|\| selectedItemRows.length===0}}` + `okText={batchResults.length ? '关闭' : '执行'}` + `:319 setSelectedRows([])` | 批量成功后清空选择 → `selectedItemRows.length===0` → 按钮 disabled;而此时 okText 已是「关闭」 | **批量操作结果弹窗的「关闭」永远是灰的**,100% 复现,只能点「取消」或 × | 中 |
| **FE-009** | C | `CatalogWorkbenchPage.tsx` `pagination={{current:cursorStack.length, pageSize, total:page.total, showSizeChanger:true}}` + onChange 只认 ±1 | 传了 `total` → AntD 渲染完整可点页码条;handler 只处理 `nextPage<` / `nextPage>` 各一步 | 翻到第 5 页点「1」→ 落在第 4 页;从第 1 页点「3」→ 落在第 2 页 | 中 |
| **FE-010** | C | `CatalogItemDrawer.tsx:423 voidSku` → `:438 detailQuery.refetch()` → `:222` effect deps `[detail, form]` | 重置 effect 内**只有** `initializedProductionItem`/`initializedMediaItem` 两个 ref 护栏;其余 13 个 `set*Draft` 全部无条件重置。`lifecycle.dirty` 仍为 true | 编辑态改了 5 个 SKU 价格 + 加了两个点单选项,顺手作废一个过期 SKU → **全部未保存修改无声消失**,关闭时还弹「放弃当前填写内容?」 | 高 |

---

# 第二部分 · 待验证(按来源路)

## C · catalog-management(19 文件)

| ID | 位置 | 事实 | 业务场景 | 初判 |
|---|---|---|---|---|
| FE-011 | `CatalogItemDrawer.tsx:1285/1298/1275` `serializeAttributeDraftRows`/`AttributesKeyValueEditor` | 每行做 `JSON.parse`,失败才回退字符串;effect 与 Form 值双向回环,改任一行触发全部行 serialize→parse 往返 | 属性 `{"note":"true","id":"1234567890123456789"}`,只改别的行 → `note` 变布尔 `true`、`id` 精度丢失成 `...800`。用户没碰过这两行 | 高 |
| FE-012 | 同上 | `Record<string,JsonValue>` 同名 key 后写覆盖先写 | 已有 `origin=直营`,新增行 key 敲到同名那刻,**上一行连值整行无提示消失** | 高 |
| FE-013 | `CatalogWorkbenchPage.tsx:305-310` + `catalogModel.ts:259` | 批量改分类/标签逐条 `getOperationsCatalogItem` 取 detail 再 save;`dispatchWire` 用 `initiate` 不传 `forceRefetch`/`subscribe:false` 也不 `unsubscribe()`;生成端点零 tag | 勾 30 个商品批量改分类(成功),十分钟后同一批改标签 → detail 来自会话缓存的旧 version → **30 条全部 VERSION_CONFLICT**,而列表显示的版本号是新的。只能刷整页 | 高 |
| FE-014 | `CatalogItemDrawer.tsx:250` effect deps `[detailQuery.error, mediaProblem, problem]` → `problemRef.current?.focus()` | `mediaProblem` 由异步 stage/release 失败设置,与用户当前操作无关 | 在 SKU 页签填名称时图片上传失败 → **焦点跳到顶部错误条,后续击键落空** | 中 |
| FE-015 | `LocalCatalogCopyDrawer.tsx:25` Props `sourceItemCode` + `:58 const targetItemCode = sourceItemCode` | 对外叫 source,对内当 **target**(会被覆盖的那个);`:158` 请求体 `{sourceItemCode: selectedSourceItemCode, targetItemCode}` 证实语义反了 | 当前唯一调用点传对了。**任何新增调用点按名字传参就会覆盖错的商品且不可逆** | 中(延迟雷) |
| FE-016 | `CatalogWorkbenchPage.tsx:305` `Promise.all(selectedItemRows.map(...))` | 每行 2 次 HTTP,无并发上限;`showSizeChanger` 可到 100 | 勾 100 个 → 瞬间 200 个请求 → 超时行显示 `RESULT_UNKNOWN`,运营无法判断改成功没有,只能重跑 → 重跑又撞 FE-013 | 中 |
| FE-017 | `CatalogWorkbenchPage.tsx:169` `decodeNavigation(...)` 无 useMemo,被 `:328 treeData` `:373 columns` 当依赖;`:67 itemReferenceSummary` 每行 `navigation.tree.find` | 依赖恒变 → memo 完全失效;O(行数×每行分类数×树规模) 线性查找无索引 Map。`CatalogItemDrawer.tsx:748` 同反模式 | 在搜索框打字,每个按键重建整棵分类树 React 元素 + 全部列定义。分类几百个的门店有可感知输入延迟 | 中 |
| FE-018 | `CatalogItemDrawer.tsx:404/415/426` `CatalogDictionaryDrawer.tsx:206/228` `CatalogWorkbenchPage.tsx:211` | 6 处静态 `Modal.confirm`,绕过 `App.useApp()`。`main.tsx:15` 配了自定义主色 `#1E40AF`+compactAlgorithm+cssVar | 确认框用 AntD 默认蓝和默认尺寸,与同屏其他弹层视觉不一致 | 低 |
| FE-019 | `CatalogItemDrawer.tsx:359` vs `:190/395/437/463/500/555/619` | 同一抽屉:保存走稳定幂等键,资产 stage/release、状态流转、SKU 作废、晋级预检/执行走**每次新 UUID**;`markBusinessIntentChanged` 在本 feature 零调用 | 见 FE-062(foundation 单 key 模型是根因) | 高 |
| FE-020 | `CatalogItemDrawer.tsx` 1311 行 · `:655 tabItems` 单行约 4000 字符 · `:744 CatalogTabContent` props 类型单行约 4000 字符 | 一个文件承担抽屉外壳+9 个页签读写双形态+媒体状态机+SKU 矩阵+点单选项+生产提示+库存 BOM+套餐+转正 Modal+属性 KV+金额格式化 | 无业务后果。**可维护性真实瓶颈是那两行,不是 1311 行** —— 新人改任一页签都要先在 4000 字符里找自己的 prop | 中 |
| FE-021 | `catalogModel.ts` 874 行 | 混四类职责:视图类型/请求构造器/响应解码器/纯业务判定 | 无业务后果 | 低 |
| FE-022 | `catalogModel.ts:804` 第二个 `wireUuid` | 与 `app/api/wireUuid`(校验失败**抛错**)同名但语义相反(**静默放行** `text(value) as Uuid`)。注释已承认 | 当前无误用(逐文件核过 import)。IDE 自动补全选错就静默绕过 UUID 校验。**FE-001 正踩在这上面** | 中 |
| FE-023 | `decodeDetail` `:688/:693` | `item.orderOptions`/根 `orderOptions`、composite、inventoryBom 各留两份镜像互相 fallback;初始化时三兄弟取三个不同镜像(`:230` 取 item、`:233/:234` 取根),只读视图三个都取根 | 只在服务端同时非空且不一致时分叉,无法证明后端会产生。**待验后端是否可能** | 低 |
| FE-024 | `CatalogItemDrawer.tsx:131 void surface;` | prop 从 `CatalogWorkbenchPage.tsx:438` 一路传进来后显式丢弃 | 死参数,让人误以为抽屉有 store/brand 分支 | 低 |
| FE-025 | `CatalogItemDrawer.tsx:648 const onOrderOptionsChange = updateOrderOptions;` | 纯别名无差异 | — | 低 |
| FE-026 | `CatalogItemDrawer.tsx:1273 money()` · `catalogModel.ts:622 catalogPriceLabel` · `CatalogWorkbenchPage.tsx:470` 内联 · `CatalogItemDrawer.tsx:1032` 内联 | 金额格式化 4 份 | — | 低 |
| FE-027 | `CatalogItemDrawer.tsx:655` `Object.values([...] as DictionaryKind[]).map(...)` | 对数组调 `Object.values` 是恒等操作 | 纯噪声 | 低 |
| FE-028 | `CatalogItemDrawer.tsx:760` 与 `:782` | 同一个 `Form` 实例被两个 `<Form>` 元素同时绑定,Tabs 默认不销毁已访问面板,两者同时挂载 | agent 尝试构造后果失败。**`submit()` 里 `:288-295` 手写重复 JSON 校验的存在本身就是这个结构问题的化石** | 低 |
| FE-029 | `CatalogItemDrawer.tsx:770` standardSalePrice 无 `name` 的 Form.Item 包手动受控 InputNumber;identifiers/SKU/点单选项/BOM 全在 Form 之外 | 导致 `submit()` `:296-330` 手写约 35 行分页签校验,错误以顶部 Alert 而非字段内联呈现 | SKU 那部分靠 `SkuFieldFeedback` 补了内联,**其余没有** | 中 |
| FE-030 | `ui/CatalogManagementPage.test.tsx` 298 行 | **仓内不存在 `CatalogManagementPage`**(页面叫 `CatalogWorkbenchPage`);298 行里没有一个组件测试,全是 `model/` 纯函数测试,放错目录 | — | 低 |
| FE-031 | `LocalCatalogCopyDrawer.tsx:520` 导出 `copyScopeTabKey` · `CatalogDescriptorPicker.tsx:25` 导出 `visibleDescriptorOptions` | 纯逻辑却从 ui 层导出,被 `model/` 层测试反向 import,**ui→model 依赖方向被打破** | — | 低 |
| FE-032 | `model/dictionaryOrdering.ts` `DictionaryOrderingRow = {status: string}` | 死类型,函数只做边界检查从不读 `status` | — | 低 |
| FE-033 | `LocalCatalogCopyDrawer.tsx:466` 用 `copyConfirmationKey(row)` vs `BrandCatalogCopyDrawer.tsx:148` 用 `candidate.row === row` 引用相等;全选一个循环 N 次 `onToggle`(`:437`)一个一次 `setState`(`:112`) | 同一概念两套写法 | — | 低 |
| FE-034 | `CatalogDictionaryDrawer.tsx:252 moveRow` 引用 `:265` 才声明的 `rows` | 运行时安全(只在渲染后调用),阅读时易误判 | — | 低 |
| FE-035 | `CatalogDictionaryDrawer.create()` | 先 `checkCodeAvailability`(内含一次 refetch)→ 创建 → 再 refetch,**创建一个字典条目打 3 次列表请求** | — | 低 |

## O · operations 其余 11 feature(64 文件)

| ID | 位置 | 事实 | 业务场景 | 初判 |
|---|---|---|---|---|
| FE-036 | `ContractEditDrawer.tsx:37` `catch { setProblem('合同已更新...'); onConflict(contract); }` + `ContractManagementPage.tsx:124` `setEditing(undefined)` | catch 不区分错误码,**任何**失败都当版本冲突;`onConflict` → Drawer open=false → `destroyOnHidden` 卸载表单 | 改完分期+起止日期+5 条货号明细,保存时网线抖一下 → **抽屉直接关掉、内容清零**,还被告知「合同已更新」但没人动过。**对照:同目录 `ContractCreateDrawer.tsx:41` 保留抽屉保留输入** | 高 |
| FE-037 | `HeadCompanyBrandAuthorizationDrawer.tsx:84-86` + `BusinessEntityManagementPage.tsx:117` | `act()` 每次 add/remove 成功都调 `onUpdated`,页面 handler 把 `authorizing` 置空 → 抽屉关闭 | 总公司要授权 6 个品牌:选第一个点添加 → **抽屉唰地关了跳到详情**。加 6 个要来回 6 趟,移除同理 | 高 |
| FE-038 | `StoreCreateDrawer.tsx:86-88`+`:116` · `StoreEditDrawer.tsx:52-54`+`:80` · `ContractCreateDrawer.tsx:44`+`:48` | `ready` 含 `!candidate.isFetching`,`onSearch` 无 debounce 直接进 query → `isFetching:true` → `<Form disabled>` 经 DisabledContext 禁用**包括正在输入的那个 Select 在内**的全部控件;rc-select 在 disabled 时强制关下拉并清 `searchValue` | 新建门店搜「星巴克」,打完「星」下拉就灰掉收起、输入被清空。网越慢越明显 | 高 |
| FE-039 | `WorkspaceUserPage.tsx:152` 用 `activeDetailQuery.data` 而非 `currentData` + `:155-162` effect | 已核 RTK 2.12.0 源码:`data = isSuccess ? data : lastResult?.data`,`isLoading` 有旧数据时永不为 true | 先看张三详情,关掉,再点李四 → **抽屉里列的是张三的姓名、账号、任职机构和角色**,一个往返后才跳变。撤销任职按钮此刻挂在张三的 assignment 上 | 高 |
| FE-040 | 7 处 `loading={...isLoading...}`:`BusinessEntityManagementPage.tsx:94` `StoreManagementPage.tsx:58` `ContractManagementPage.tsx:98` `WorkspaceUserPage.tsx:246` `WorkspaceInvitationPanel.tsx:141` `StoreProfilePage.tsx:96` `InventoryManagementPage.tsx:81` | `isLoading` 只在「从来没有过数据」时为真;`&& !list.data` 恒真冗余。**全仓零处用 `isFetching`** | 翻页/换排序/切筛选:表格纹丝不动无转圈,几百毫秒后行内容突然跳变。**更严重**:`StoreProfilePage` 四个合同状态 tab 共用一个 query,点「已作废」时 data 还是「当前」那批 → **「已作废」tab 下列着当前生效的合同** | 高 |
| FE-041 | `InventoryManagementPage.tsx:85-92` | 传了 `total` 渲染完整页码,handler 只处理 ±1。**同 feature 的 `InventoryDetailDrawer.tsx:129/134/139` 用 `slice(0,page)` 向后跳是对的** | 200 个库存对象每页 20,点「7」只到第 2 页;从第 5 页点「1」只回第 4 页 | 中 |
| FE-042 | `ProjectCreateDrawer.tsx:41-43` · `OrganizationEditDrawer.tsx:40-43` `form.setFields([{name:'phaseDrafts', errors:[...]}])` | `ProjectPhaseFieldList.tsx:6-7` 的内层 `Form.Item` **没有 `name`**,render prop 丢弃了第三个 `{errors}`,全仓无 `Form.ErrorList`。空值那条被各输入框自己的 required 挡住,**所以这行代码只在「重名」时触发,而重名恰好是唯一看不见提示的情况** | 填了两个「一期」点创建 → 按钮不转圈、抽屉不关、页面无任何红字 | 高 |
| FE-043 | `OperationsPasswordRecoveryVerifyPage.tsx:120-121` 两个 Form.Item 无 `rules` + `:53-55` 手写判断读镜像 state + `:106` 失败只把同一句提示变红 | 校验既不在 Form 规则也不走 `validateFields`;失败文案完全不变 | 手机号少打一位点「获取验证码」→ 只是把「如果信息匹配,验证码将发送到该手机号」变红。用户不知道是自己填错、账号不匹配、还是系统故障 | 中 |
| FE-044 | `BusinessEntityDetailDrawer.tsx:165-168` · `ContractDetailDrawer.tsx:27` · `StoreDetailDrawer.tsx:57` · `FixedStoreContractDetailDrawer.tsx:42` | 四个详情抽屉把 prop 已有对象再镜像进本地 `useDetailDrawer`,渲染读镜像 `open` 读 prop;关闭时先 `close()` 清镜像 | 每次关闭合同/门店/品牌详情,**内容先「唰」地消失再滑走一个空壳** | 中 |
| FE-045 | 扩展字段渲染 7 份实现 2 种日期控件:`OrganizationExtensionFields.tsx:28-41`(DatePicker) · `BusinessEntityCreate/EditDrawer.tsx:56-80`(`Input type=date`) · `ContractCreate/EditDrawer.tsx:14-19` · `StoreCreate/EditDrawer.tsx`(DatePicker) | 已证伪数据影响:两边写库值一致(`serializeOrganizationExtensionValues` 与 `dayjs.format` 结果相同) | 「新建大区」扩展日期是中文 AntD 选择器,切到「新建品牌」同类字段变成浏览器原生 `input type=date`,样式割裂暗色下可读性差 | 中 |
| FE-046 | `useOrganizationCandidates.ts:15` · `useContractStoreCandidates.ts:17-26` · `useWorkspaceInvitationCandidates.ts:27-38` | 全仓无 debounce | 搜「星巴克」发 3 次请求;配合 FE-038 前两次响应还各禁用一次表单 | 中 |
| FE-047 | 根因 `useDetailDrawer.ts:24` 返回对象**无 useMemo** → `ContractManagementPage.tsx:89` 13 个列对象每渲染重建 · `StoreManagementPage.tsx:40-43` · `InventoryManagementPage.tsx:49` · `WorkspaceUserPage.tsx:202` · `WorkspaceInvitationPanel.tsx:131` · `StoreManagementPage.tsx:34` memo 外算 context | 写了 memo 拿不到 memo | 无直接业务后果(RTK 按序列化 arg 缓存不会多发请求),无谓重渲染 | 低 |
| FE-048 | `StoreProfilePage.tsx:33-35` `queryIssue` + `:62`/`:91` | 同一句话在告警框 title 和 description 里**显示两遍** | — | 低 |
| FE-049 | `StoreProfilePage.tsx:79-121` | 只有一个 item 的外层 Tabs 包着内层四态 Tabs,页面多出一条只有「合同」一个标签的 tab 条 | — | 低 |
| FE-050 | `InventoryActionModal.tsx:203` | 名字叫 Modal 实际渲染 `<Drawer>`,testId 也叫 `inventory-action-modal`;同目录 `WorkspaceInvitationActionModal` 是真 Modal | — | 低 |
| FE-051 | `inventoryManagementModel.ts:82/78/92/86` | `shouldRequestInventoryDiagnostics(x)` 直接 `return x` 却有专门单测;`hasCapability` 就是 `.includes`(别处 11 个 feature 直接写);`jsonBody<T>` 恒等函数;`matchesStockView` **全仓无调用** | — | 低 |
| FE-052 | `OperationsPasswordChangeDrawer.tsx:24` | `useOverlayLock(open)` 与 `useDrawerFormLifecycle` 内部重复注册;**13 个用 lifecycle 的抽屉里 12 个都这么重复** | 见 FE-061 | 低 |
| FE-053 | `ContractManagementPage.tsx:43` 页面级聚合锁 vs `StoreManagementPage.tsx:33` 只为 statusTarget 注册 | 全仓仅有的两处「页面替子组件注册」,且规则各不相同 | — | 低 |
| FE-054 | `OperationsAuditHistoryModal.tsx:41,54` | `lastSuccessful` 存了 `{page,data}` 但 `page` 从未被读 | — | 低 |
| FE-055 | `BusinessEntityManagementPage.tsx:65` `as unknown as BusinessEntity[]` | 双重断言绕过类型系统 | — | 低 |
| FE-056 | `InventoryManagementPage.tsx:12` → `catalog-management/model/...` · 4 个文件 → `organization-structure/model/...` | 跨 feature 直接 import 内部实现;12 个 feature 里只有 4 个有 `index.ts` barrel,而跨 feature 引用**全都绕过 barrel** | — | 低 |
| FE-057 | `InventoryManagementPage.tsx:76` `{!scopeReady && <Alert title="请选择管理范围"/>}` | 死代码,`OperationsRequiredScopeSurface` 已挡住;contract 和 store 都写了注释说明「不重复提示」,inventory 没跟上 | — | 低 |
| FE-058 | `InventoryDetailDrawer.tsx:143-148` `...([{key:'diagnostics',...}])` | 展开单元素字面量数组,条件渲染删剩的残骸 | — | 低 |
| FE-059 | `WorkspaceUserPage.tsx:225-227` `catch(error){ void error; ... }` · `WorkspaceInvitationCreateDrawer.tsx:118` · `WorkspaceInvitationActionModal.tsx:66` | 显式丢弃服务端原因,而同文件 `:27-33` 就定义了 `issue()` 并在 `:142` 用于查询错误 | 撤销任职失败只说「撤销任职未完成,请检查后重试」,真因丢失 | 中 |
| FE-060 | `WorkspaceInvitationPanel.tsx:111-112` 未传 `enabled` vs `WorkspaceUserPage.tsx:138` 传了 | 已证伪业务影响(scope 门已挡住,两处都是冗余防御)。但**两个文件对同一件事给出不同答案,读者无法判断哪个是规范** | — | 低 |

## A · operations app/store/transport(44 文件)

| ID | 位置 | 事实 | 业务场景 | 初判 |
|---|---|---|---|---|
| FE-061 | `OperationsApp.tsx:316` `const entry = entryOverride ?? sessionEntryQuery.data ?? null;` | `entryOverride` 由登录/角色选择写入,只在登出和 groupWorkspaceKey 变更时清空 ⇒ **任何一次成功登录后恒非 null,`sessionEntryQuery.data` 再也不被读取**;而该 query 仍订阅且因全局 tag 每次写后真实重取,取回即丢。`session.contextVersion` 来自这个冻结 entry,喂给每页 `expectedContextVersion` | 开两个标签,A 切换管理范围 → 后端 `context_version+1` → B 此后每条命令都返回「页面资料已更新,请刷新当前页面后重试」;点「刷新当前页」只 `setPageReload` **不清 entryOverride**,结果完全相同。**解药就在 RTK 缓存里被 `??` 丢掉了**。整页重载可自愈 ⇒ 同一界面因进入路径不同有两种运行行为 | 高 |
| FE-062 | `OperationsTransport.ts:110` `return {...operationsProblemFeedback('NETWORK_ERROR'), ...}` | `problem()` 只分 `typeof data === 'object'` 一支,其余全落 NETWORK_ERROR。但 RTK `fetchBaseQuery` 的 `PARSING_ERROR` 时 data 是**字符串**,空体错误时 data 是 **null**。正确兜底桶 `PLATFORM_COMMON_RESULT_UNKNOWN` 已存在且用于 object 分支;`FetchBaseQueryError.status` 完全没看 | 后端重启或网关返回 HTML 502/504 期间,**全公司运营在登录页和每次保存看到的都是「暂时无法连接服务/请检查网络连接后重试」**。他们去查 WiFi、换网络、给 IT 报网络故障 | 高 |
| FE-063 | `OperationsTransport.ts:36-47` `dispatch(endpoint.initiate(...))` 在 `try {` **之前** | 三次无校验断言;`operationId` 是裸 `string`,生成 client catalog 与生成 RTK endpoints 是两份独立产物。endpoint 缺失时抛裸 `TypeError` 不在 try 里,绕过 `ApiFailure` 契约,再叠加 FE-062 | 传入未就绪路径参数 → 用户被告知「检查网络连接」→ 无限重试;beacon 日志里连一条 `frontend.request.*` 都没有(异常在发请求之前) | 高 |
| FE-064 | `OperationsApp.tsx:52` `satisfies Partial<Record<OperationsPageDesignKey, ReactNode>>` + `:94 accessiblePages.filter(({key}) => menuIconByKey[key])` | `pageRegistry.tsx:59` 用的是**穷尽** `satisfies Record<>`,而图标表用 `Partial` ⇒ 漏配不是错误 ⇒ 该页从菜单滤掉但仍在 `accessiblePages`、仍可路由、仍可成为默认落地页,`selectedKeys` 指向不在 items 里的 key。名叫 "icon-mapped" 的架构测试 `static-boundary.test.mjs:150-156` **一个字都没碰图标表** | 新增 catalog 页面并授权 → 编译通过、typecheck 通过、16 条架构测试全绿、L2 全绿 → **项目经理登录后根本找不到这个功能**。若该页 menuOrder 排第一还会成为落地页而侧边栏什么都不高亮 | 高 |
| FE-065 | `OperationsApi.ts:67 tagTypes:['wire']` + `OperationsTransport.ts:39 initiate` 无 `.unsubscribe()`/`.reset()` | 通读 1132 行生成 RTK:**每条** query provides `[{wire,opId},{wire,'LIST'}]`,**每条** mutation invalidates 同一对 ⇒ `LIST` 是单一全局 tag。query 默认 `subscribe=true` 从不释放,mutation 默认 `track=true` 从不 reset(`reset` 是唯一能让条目离开 `state.operationsApi.mutations` 的动作) | `getOperationsWorkspaceLoginEntry` 的订阅在登录页卸载后仍存活,**此后整个会话每次写操作都在后台重发 `GET .../login-entry`**;每次写在 mutations 里永久留一条(含完整响应体)。用户管理页批量邀请 20 人,每次提交触发约 12–15 个 GET 而不是 2 个 | 高 |
| FE-066 | `OperationsApi.ts:14` + `OperationsTransport.ts:42,82` | 每次非 GET 都 `publish()`,但 operations 内**零订阅者**(`useRefreshVersion` 零调用);platform-admin 确有消费 | 无业务后果。读代码的人会认为存在两套刷新机制,必须自己证明其中一套是死的 | 低 |
| FE-067 | `app/state/OperationsScopeContext.ts` 全文件 + `OperationsApp.tsx:324-326` + 唯一消费者 `DataScopeSelector.tsx:42-43` | slice 唯一写入者原样赋 `entry?.scopeContext`;唯一读者已通过 prop 拿到同一个 `entry`。`??` 永远不可能选到更好的值,只可能选到**更旧**的(镜像写在 effect,prop 在同一 commit 已更新) | 确认门店后有一帧侧边栏 trigger 仍显示上一个门店。**主要是工程维护性**:整个 slice + store 接线 + 类型只服务一个读取组件本已持有之值的 `useSelector` | 低 |
| FE-068 | `OperationsApp.tsx:365-368` boundary 无 `resetKeys`;platform-admin 传了 `resetKeys={[session?.sessionVersion]}` | `AdminErrorBoundary.tsx:41-43` 的自动 reset 永不触发 | 合同页某列渲染器遇 null 抛错 → **整个 shell(页头/侧边栏/Tab/范围选择器/退出菜单)被 Result 取代**。无法切页、改范围、登出;点「重试页面」立刻再抛。唯一出路是浏览器重载,重载又回同一路由 | 中 |
| FE-069 | `OperationsApi.ts:16-18 recordOperationsRenderError(_error: Error)` | 形参下划线且未使用,签名甚至不接 `ErrorInfo`(而 `AdminErrorBoundary.tsx:38` 传了)。事件是常量,无 name/message/component stack。platform-admin 有同样空壳 | 用户报「页面暂时无法显示」,服务端唯一证据是带 correlation id 的 `UI_RENDER_ERROR`,**无人能判断是二十来个页面中的哪一个** | 中 |
| FE-070 | `OperationsApp.tsx:223 defaultOpenKeys={selectedCatalogPage ? [...] : []}` | AntD Menu 的 `defaultOpenKeys` 只在 mount 消费一次;从 `/operations/<key>` 无 segment 挂载时为 `[]`,随后重定向不会让 Menu 重新推导 | 管理员输入或收藏裸 workspace 地址(最自然的收藏方式)→ 落到首页后**侧边栏所有分组折叠**,高亮藏在关闭的子菜单里 | 中 |
| FE-071 | `OperationsApp.tsx:171 key={session.contextVersion}` vs `:273 key={pageBodyKey}`(已含 contextVersion) | 外层 div 的 key 已强制整体 remount,内层组件 key 不可能独立生效。靠 `operations-context-view-reset.test.mjs` 存活,而该测试的红夹具删的正是它自己 grep 的字面量 —— **同义反复** | — | 低 |
| FE-072 | `src/tests/architecture/*.mjs` 6 文件 | 全部 `readFileSync` + `assert.match(源码文本, /regex/)`,从不断言行为。`rp07-rp08-second-package.test.mjs:9-11` 断言字符串 `[submitting, setSubmitting]` 的**缺席** | 见 FE-007。假绿(FE-064)与假红(重命名局部变量会打断无关测试)双向具体 | 高(流程) |
| FE-073 | operations `OperationsScopeContext`(Redux slice)/ `entryOverride`(组件 state)/ platform `WorkspaceScope.tsx:19-49`(React Context + 手写取数,**完全绕开 RTK Query**) | 一个关注点三套机制。目录形态也分叉:operations 有 `app/components/` 与 `app/routing/model.ts`,platform 两者皆无 | 任一 App 的范围处理修复只能靠重写才能迁到另一个 | 中 |
| FE-074 | `OperationsApp.tsx:337-348` + `:318` | `clearLocalSession()` 派发 `resetApiState()` 时 session-entry hook 仍订阅 → 立刻重取 → cookie 已清 → 401 → 才导航到 `/login`。空档期 `sessionEntryLoaded` 为 false → 渲染「正在恢复运营上下文」 | 点「退出登录」后看到的是**系统正在恢复其运营上下文**——与刚才的意图相反——持续一个网络往返。慢网下超过一秒。服务端每次登出固定多一条 401 | 中 |

## P · platform-admin(66 文件)

| ID | 位置 | 事实 | 业务场景 | 初判 |
|---|---|---|---|---|
| FE-075 | `PlatformTransport.ts:42` + `PlatformApi.ts:50-64` 未设 `refetchOnMountOrArgChange` | 实测 RTK 2.12.0:相同 arg 第二次 `initiate` 直接 resolve 缓存,**0 次 HTTP**;3 次读+1 写=4 次 HTTP,30 次详情读+1 写=**31 次**;仅加 `{subscribe:false}` 对照组=1 次 | **「刷新当前页」按钮不发请求** —— 实现是 `setPageReload` 改 key 强制重挂,arg 不变 → 命中缓存 → **界面数据一个字都不会变**。运维点刷新、数据不变、再点还是不变,会判断成后端没更新 | 高 |
| FE-076 | `WorkspaceStatusModal.tsx:21-25` · `AdministratorStatusModal.tsx:20` · `AccountsPage.tsx:109-110`+`WorkspaceAccountActionModal.tsx:37-48` | 三处失败后把 problem 交给**父页面**的 Alert,弹窗既不关闭也不渲染错误;AntD Modal 带遮罩,Alert 在遮罩之下不可见 | 点「停用」→ 后端返回 `STATUS_TRANSITION_INVALID` → **弹窗保持打开、loading 消失、文案不变、无任何新信息**。只能再点一次(同样静默失败)或先关掉弹窗才看见顶部红条 | 高 |
| FE-077 | `PlatformReadPage.tsx:113-125` + `:168` | HIERARCHY 分类下只 `setHierarchyNodeId`(立即高亮)**不进 loading 态**;详情要等请求回来。失败时右侧仍是上一个节点。**同文件品牌/租户/门店页签走 `openLoading()` → 骨架屏** | 点「华东大区」,左侧高亮已跳到华东,**右侧仍显示「华北大区」的编码和备注**。请求慢或失败时会把华北资料当成华东核对 —— 而这个页面存在的唯一意义就是核对组织资料 | 高 |
| FE-078 | `PlatformAuditHistoryModal.tsx:25-27` `if (boundaryFailure) { onClose(); return; }` | 边界类失败直接调父级 `onClose`,父级只 `setAuditTarget(undefined)`,无任何提示。**非边界失败有 Alert+重试(`:36`/`:38`)** | 合同详情点「操作历史」,若审计读被判 403/404 → **弹窗一闪即关**;按钮还在,再点还是一闪即关,没有任何可上报信息 | 中 |
| FE-079 | 9 处 `onSearch: set...`:`WorkspaceScope.tsx:73` `AccountsPage.tsx:142,143` `PlatformInvitationPanel.tsx:77,78,182,183` `PlatformReadPage.tsx:231,233` | 每次 keystroke 直接 setState → 新 query args → 新缓存键 → 真实 HTTP。全仓无 debounce | 输入「上海静安店」6 字 = 6 次 candidates 请求,输入法逐字上屏更多。集团空间选择器挂在 shell 头部对所有页面生效 | 中 |
| FE-080 | `WorkspaceScope.tsx:34-46` 依赖数组含 `selectedGroupWorkspaceKey` | effect 体内只在 `shouldReconcileSelection` 为真时读它;用户点选时该标志为 false,effect 仍重跑,重拉 `pageSize=100` 列表。`:72 onSelect` 还同时 `setSearch('')`,搜索框非空则**再触发一次** | 切换集团空间是这个后台最高频动作(8 个页面里 6 个要求先选空间),每切一次多一次 100 条列表请求,最多两次 | 中 |
| FE-081 | `PlatformApp.tsx:35 Object.values(...).sort(...)` 每渲染新数组,是 `:38 menuItems` memo 的依赖;`AccountsPage.tsx:132-135` 同理是 `:136 columns` 的依赖 | 写了 memo 拿不到 memo | — | 低 |
| FE-082 | `PlatformApp.tsx:56 useEffect(..., [workspaceContextKey])` | 挂载时也会跑,key 从 `-0` 变 `-1` 触发整个路由子树重挂;切空间时 key 连变两次。**已证伪**会不会发两次请求(被 FE-075 缓存挡住) | 首屏与切空间时整页多挂载一次的渲染开销 | 低 |
| FE-083 | `PlatformApp.tsx:52-54` · `WorkspaceAdministrationPage.tsx:21` · `ExtensionsPage.tsx:38` · `PlatformReadPage.tsx:91` | `contextScopedQueryArgs` 构造对象只为把刚传进去的字段读回来,等价于 `selectedGroupWorkspaceKey ?? 'GLOBAL'`;该函数的价值(`expectedContextVersion`/`identityKey`/`scopeRef`)platform-admin 一处都没用。且 `commercial-group-boundary.test.mjs` 有断言把这个空壳固定住 | — | 低 |
| FE-084 | `AccountsPage.tsx:58`(非空断言+skip)· `CommercialGroupInitializationDrawer.tsx:33`(空串哨兵+skip)· `PlatformAuditHistoryModal.tsx:22`(undefined+断言+skip) | 同一件事三种写法。RTK 官方为此提供 `skipToken`,**两个 App + foundation 零使用** | — | 低 |
| FE-085 | `PlatformPasswordChangeDrawer.tsx:57` | 全 App **32 个 error Alert 中唯一**不带 `description={problem.detail}` 的。无防泄露理由(detail 是自有文案) | 修改密码失败只显示标题 | 低 |
| FE-086 | `PlatformAuditHistoryModal.tsx:39` 写死 `#e6f4ff` | 该值是 AntD 默认蓝,而本 App 主题把 `colorPrimaryBg` 定成灰蓝 `#eaecef` | 审计历史选中行是全站唯一一处默认蓝 | 低 |
| FE-087 | `styles.css:108-117 .brand` 全仓无人使用(在用的是 `.platform-brand`);反向 `auth-login-page`/`platform-sider-collapsed-button`/`platform-organization-hierarchy-tree-panel`/`-detail-panel` 挂在 TSX 上但 CSS 无对应规则 | 死 CSS 与无样式 className | — | 低 |
| FE-088 | `platformAdminTheme.test.ts` 68 行 | 把源文件 50 个 token 原样再抄一遍,不可能发现行为问题,任何合法调整要机械改两处 | — | 低 |
| FE-089 | `tests/l2/organization-overview.spec.ts:7 const headCompanyLabel = '极光餐饮总公司(HC-A)'` | 硬编码,同文件其余 6 个 fixture 全走 `requiredL2Env` | — | 低 |
| FE-090 | `PlatformReadPage.tsx` 250 行,最长行 **1442 字符** | 用 `kind: 'organization' \| 'contracts'` 把两个互不相干的页面塞进一个组件,组织页内部还有 master-detail 与 ProTable 两种形态;22 个状态里合同相关的 7 个在组织页永远是死状态,6 个 RTK query 全靠 `skip` 互相关闭。路由层已分开注册(`pageRegistry.tsx:20-21`) | 无业务后果。`kind` 分支不是「少写代码」,是把两页代码压进同一行 | 中 |

## F · admin-ui-foundation(29 文件)

| ID | 位置 | 事实 | 业务场景 | 初判 |
|---|---|---|---|---|
| FE-091 | `useDrawerFormLifecycle.ts:157 modal.confirm({title:'放弃当前填写内容?'})` | 返回值(含 `.destroy()`)没被接住,hook 无任何卸载清理。confirm 由 `App` 的 modal holder 渲染,宿主卸载不会带走它。而 `PlatformApp.tsx:105 Menu onClick` **没有任何 `locked` 判断**(对比 `OperationsApp.tsx:104` 是 `disabled: locked`) | 在「新建集团空间」抽屉填一半点关闭 → 弹「放弃当前填写内容?」→ 此时点左侧菜单 → 页面子树连 Drawer 卸载 → **确认框孤零零悬在一个毫无关系的新页面上**,点哪个按钮都没反应 | 高 |
| FE-092 | `overlayLock.tsx:47/59/71` 三个读取口 + platform-admin **0 处** `useShellInteractionLock` | `useOverlayLock(open?)` 一函数两语义(传参=注册+读,不传=只读);`useDirtyFormLock` 名字说 dirty 返回的是合并值;`useShellInteractionLock` 返三元组。platform 用 `const locked = useOverlayLock()`,**无法区分「有 Drawer 开着」与「有草稿没保存」** | 在「新建管理员」抽屉填一半,点顶部「刷新当前页」(`PlatformApp.tsx:113` 无 locked 判断)→ **Drawer 连同已填内容一起消失,没有任何确认和提示**。同一操作在 operations 是被禁掉的且顶栏有 dirty-guard 警告 | 高 |
| FE-093 | `useDrawerFormLifecycle.ts:10-15/104-110/119…212`(`onDiagnosticEvent`+8 处 emit)· `:42-47/87/90/93/217/233`(`closedSessionKey`)· `:194-198`(`handleOpenChange`) | 三块机制**消费者全为 0**(apps/frontend 全域 grep)。连带 `safeLogger.ts:89 parentEventByOperationInstance` 永远为空,`parentEventId` 恒 undefined,整条 parent-event 链是死的。**而 29 个 Drawer 都传了 `diagnosticOperationId`,看起来诊断已接线,实际一个事件都没出去** | 无直接业务后果。杠杆在于:后续想加前端诊断的人会先读到这套「已存在」的机制并基于它扩展,而它从未跑通过一次 | 中 |
| FE-094 | `useDrawerFormLifecycle.ts:164-170` `onOk: () => { bypassClose.current = true; reset(); }` 而 `reset()`(`:134-142`)内 `:138` 无条件 `bypassClose.current = false` | `bypassClose` 恰恰在它唯一该起作用的窗口里失效。agent 尝试构造 reproducer **未成功**(`:155 if (dirtyGuardOpen.current) return` 已挡住双击,`handleOpenChange` 无人接线) | **当前无可复现场景**,属被掩盖的顺序缺陷。但同一个 `bypassClose` 在 `closeAfterSuccess`(`:177`)路径上是**真正承重**的,不是可整体删除的死变量 | 低 |
| FE-095 | `useDrawerFormLifecycle.ts:83` 内部已 `useOverlayLock(open)`,**23 个调用方**在同一组件又显式调一次(如 `StoreCreateDrawer.tsx:50` 与 `:57` 相隔 7 行) | 两次 `useId()` 产生两个 registration。功能无害(两条 cleanup 都会释放) | 无业务后果。暴露的是**契约不清**:hook 到底管不管注册?文档没说,23 个调用方选择「不确定就都加上」 | 低 |
| FE-096 | catalog 15 处直接写 `'Idempotency-Key': globalThis.crypto.randomUUID()`。**根因在 foundation**:`useDrawerFormLifecycle`/`useSubmissionLifecycle` 每实例只提供**一个** key(`:94` 单个 ref),而 `CatalogItemDrawer` 一个抽屉要发 7 类不同命令;共用一个 key 会更糟(第二条命令被后端当第一条的重放吞掉) | agent 先假设是 app 偷懒,然后自己证伪了(`:221` 明明拿到了 lifecycle,`:359` 主保存用的就是它) | 点「暂存图片资产」网关超时但服务端已处理,用户重试 → 新 UUID → **MinIO 多一份孤儿 staged 资产**;新建字典条目同理 → **两个同名标签/销售单位** | 高 · **需 Dexter 裁定**幂等边界按命令类型还是按用户意图划 |
| FE-097 | `adminListState` JSDoc 声称保证 loading/failed/empty 互斥,但 operations 只有 **1 个**文件用它(platform 5 个)。绕过:`StoreManagementPage.tsx:75` 无条件 `emptyText:'暂无门店'` · `StoreProfilePage.tsx:112` · `InventoryManagementPage.tsx:93` 手写 | 顺带:6 个真正用它的调用方全部重复写同一段 `loading: isLoading && !result && !error`,互斥判断其实还在调用方 | 门店列表请求失败(5xx/网络抖动),用户看到干净的**「暂无门店」**,与「这个项目确实还没建门店」完全无法区分 → 去点「新建门店」→ 编码冲突时才发现 | 高 |
| FE-098 | `descriptorRenderer.tsx:81-98` `:83` 的 `continue` 发生在 `:85 descriptorKeys.add()` **之前**,随后 `:94-98` 完备性循环抛 `DESCRIPTOR_FIELD_RULE_MISSING`。**对照 `:86` 的 tab 过滤是在 add 之后 continue 的** | agent 解析了唯一真实 manifest:10 field × 7 shape,`visible` **全为 True**(94 条规则无一 false),MISSING_RULE 均为空集 | **今天不可复现,是潜伏陷阱**。契约上 `FieldRule.visible?: boolean` 明确允许 false,后端一旦下发就抛错 → `AdminErrorBoundary` → 该形态的任何商品都打不开 | 中 |
| FE-099 | `foundation.test.ts` 168 行 26 断言,import 列表里**没有任何 hook**;`AdminErrorBoundary` 只测静态方法 | 根因是**没有 DOM 环境**:实测无 `@testing-library`、无 `jsdom`/`happy-dom`,渲染测试走 `renderToStaticMarkup`(effect 不跑)。`overlayLock.tsx:13-19` 额外导出 `updateOpenRegistrations`/`updateDirtyRegistrations` 正是为绕开 DOM 测 reducer | 无直接业务后果。**但 FE-091/092/094/098 全部落在无测试的那部分**,而这是两个 App 共 29/78 文件调用的杠杆点 | 高 |
| FE-100 | 死导出 7 个:`formatCodeNamePath` · `formatNameCode` · `assertDescriptorSlotBindingSet` · `DESCRIPTOR_CONTROL_KINDS` · `createAsyncGenerationGuard` · `useDirtyFormLock` · `platformHttpProtocol`+`PlatformHttpProtocolKey` | 全部只有自身测试引用 | — | 低 |
| FE-101 | `overlayLock.tsx:68 useDirtyFormLock` return `context?.locked` | 名字说 dirty,返回 `overlayLocked \|\| dirtyLocked`。0 调用方所以无活影响 | 留给下一个人的陷阱 | 低 |
| FE-102 | `useSubmissionLifecycle.ts:16-20` 专门写注释说明为什么要 memo · `useDrawerFormLifecycle.ts:223` 也 memo · **`useDetailDrawer.ts:24` 直接返回每次 render 新建的对象字面量** | 同一个库三个同类 hook 两种契约。已 grep 确认目前无人把 `useDetailDrawer` 结果放进依赖数组 | 见 FE-047(它正是那串 memo 失效的根因) | 中 |
| FE-103 | `descriptorRenderer.tsx:177-180` 域控件缺 slot 时**显式报警**,而 `:126-127` 的 `treeData`/`tableColumns` 缺失时**静默默认成 `[]`** | `CatalogDescriptorPicker.tsx:103` 就没传 `treeData`,今天不触发(已核:它只用于 select/multiSelect;唯一 treeSelect 字段 `categoryRefs` 走 `CatalogItemDrawer.tsx:847` 另一个本地包装,那里传了) | 潜伏:谁把 `fieldKey="categoryRefs"` 交给 `CatalogDescriptorPicker`,就得到一棵**静默的空树** | 中 |
| FE-104 | `descriptorRenderer.tsx:165-168` `editableTable` 与 `detailTable` 两个 case 逐字符一致,都是只读 `<Table>` 都不调 `onChange`;`upload`(`:164`)同样从不调 `onChange`。`DESCRIPTOR_CONTROL_KINDS` 声明 **16 种**控件,唯一真实 manifest 只用到 **4 种** | 12 种未验证的抽象 | — | 中(过度设计) |
| FE-105 | `descriptorRenderer.tsx:116 assertDescriptorSlotBindingSet` 要求 `required.size === provided.size` 且逐项匹配 —— 多传一个用不上的 slot 也抛错;**0 调用** | 契约敌意:调用方必须精确知道当前 shape 需要哪几个域控件才能通过,比它想防的问题更难 | — | 低 |
| FE-106 | `observedBaseQuery.ts:72-73` `operationId` 与 `routeTemplate` 两个字段都是 `routeTemplate(String(args.url))` | 同一事实存两份。URL 脱敏今天是覆盖住的(已枚举 generated 全部 public 路径,`:14`/`:15`/`:13` 三条规则都命中),属逐路由硬编码正则,脆但当前无泄漏 | — | 低 |
| FE-107 | `EllipsisTooltip.tsx:8-10` 就是 `<Tooltip title={title}>{children}</Tooltip>`,**无任何截断检测** | 4 处调用都配 `ellipsis:{showTitle:false}` | 没被截断的短文本悬停也弹 tooltip(如合同编号 "HT-001" 完整可见仍弹 "HT-001")。名字承诺的条件行为不存在 | 低 |
| FE-108 | `behavior/index.ts` 漏 `useSubmissionLifecycle` · `src/index.ts:17` 漏 `FrontendLogSink`(而 `createBeaconLogSink` 的返回类型正是它,App 想标注 sink 变量类型就没名字可用)· `ObservedBaseQueryOptions` 完全未从根 barrel 导出 | barrel 不一致 | — | 低 |
| FE-109 | `OrganizationExtensionFields.tsx:31,33,35,37,38` · `CatalogAssetPreview.tsx:25,26,27` 写裸 `data-testid` 不走 `testId()`。对照 `StoreCreateDrawer.tsx:27-34` 同类扩展字段渲染走的是 `testId()` | 漏网不是刻意例外 | — | 低 |
| FE-110 | `toWireRequest` + `expandPath`(路径展开/query 拼装/Accept 头/body 序列化)在 `PlatformApi.ts:31-47,66-71` 与 `OperationsApi.ts` **逐字重复**,约 25 行 × 2;foundation 只共享了 `serializeJsonOrMultipartBody` | 按当前阶段标尺**不建议现在抽**(抽了会引入配置参数),仅登记 | — | 低 |
| FE-111 | `logger.snapshot()` 在两个 App **0 处调用**(100 条环形缓冲区从未被读);若 `VITE_FRONTEND_LOG_SINK_URL` 未配置,`createBeaconLogSink` 返回 `undefined` | 生产环境的 WARN/ERROR 既不进 console(`enabled=false`)也不出网,**完全落地即丢** | 中 |

## X · 横切官方用法

| ID | 位置 | 事实 | 业务场景 | 初判 |
|---|---|---|---|---|
| FE-112 | 全仓 `main.tsx` × 2 无 `<StrictMode>`;仓内 9 处 render 期写 ref(`useDrawerFormLifecycle.ts:72/91/92/93/102` · `AccountsPage.tsx:43` · `RolesPage.tsx:39` · `WorkspaceManagementPage.tsx:48` · `AdministratorsPage.tsx:41`) | 这些写法目前都幂等,React 19 StrictMode 双调用正是用来暴露这类不幂等回归的 | 无直接业务后果。**归 `HANDOFF.md` 欠账** | 低 |
| FE-113 | `catalogFieldRuntime.ts:84 export const catalogOptionResolver = createCatalogOptionResolver()` | **零消费者**(穷举 grep) | — | 低 |

---

# 第三部分 · 已证伪 / 已剔除

| 原主张 | 来源 | 为什么推翻 |
|---|---|---|
| `CatalogItemDrawer.tsx:1032` 的 key 也导致失焦 | X | **我亲验**:该 key 所在元素是 `<Space><Tag>`,只读无输入框。真正的可编辑点在 `:1017` 的 Card key + `:1019` 输入框 —— 已并入 FE-003 |
| `${group.groupCode}-${index}` 也导致失焦 | X | agent 自己证伪:组编码输入框在右侧 Col span 12,不在被重建的 `List.Item` 子树内 |
| 点「新增属性」空行会立刻消失 | X | agent 自己实测:空 key 行 serialize 后字符串**不变** → effect 不触发 → 行留存 |
| 先填值后填 key 会丢值 | X | 同上,key 为空期间序列化结果恒定 |
| 静态 `Modal.confirm` 会导致文案变英文 | X | 7 处全部显式给了 `okText`/`cancelText`,locale 不受影响 |
| 候选搜索无防抖会导致显示错乱 | P | RTK 按 args 分缓存键,组件读当前 args 对应条目 —— 纯请求量问题不是正确性问题 |
| `catalogOptionResolver` 单例导致多个下拉互相作废 | X | 两个调用点都是 `useMemo(() => createCatalogOptionResolver(), [])`,各自独立 token;`catalogFieldRuntime.test.ts:71-78` 专门锁了这条隔离 |
| headers 里的 correlation/request/trace id 撑爆 cacheKey | X | 三个 header 在 `observedBaseQuery` 内部生成,**不进 query arg**,不影响 cacheKey |
| `WorkspaceInvitationPanel` 未传 `enabled` 有业务影响 | O | scope 门已挡住未选范围,两处都是冗余防御 |
| 扩展字段两种日期控件会写坏数据 | O | `serializeOrganizationExtensionValues` 与 `dayjs.format` 结果一致,**只是 UI 不一致** |
| `debugVerificationCode` 自动填充是前端泄露 | P | 后端 `OtpDispatchWireSerializationConfigurationTest` 断言该字段在对应 profile 下不被序列化,**保护点在服务端且有测试** |
| `PlatformApp` 整页多挂载会发两次请求 | P | 被 FE-075 的缓存挡住,后果只有一次白挂载渲染开销 |

---

# 第四部分 · 跨路重叠(去重用)

| 组 | 同一缺陷 | 各路 ID | 路数 |
|---|---|---|---|
| **G1** | RTK 订阅永不释放 + 全局 `LIST` tag | FE-065(A) · FE-075(P) · X-P1 · 部分 FE-013(C) | **4 路** |
| **G2** | `AttributesKeyValueEditor` 往返有损 | FE-011(C 类型改写) · FE-012(X 重复键吞行) | 2 路,**症状不同需合并** |
| **G3** | 静态 `Modal.confirm` 绕过 `App.useApp()` | FE-018(C 6 处) · F 路第 5 条(7 处) · X-P5(7 处) | **3 路,计数不一致需对账** |
| **G4** | `refreshSignal` 死机制 | FE-066(A) · O-M7 · X-P3 | 3 路 |
| **G5** | 架构测试源码正则 | FE-007/FE-072(A 6 文件) · FE-007(P 7 文件) | 2 路,**P 路做了变异实验** |
| **G6** | `WorkspaceScope` effect 依赖自己写的 state | FE-080(P) · X-P6 | 2 路 |
| **G7** | 候选搜索无防抖 | FE-046(O) · FE-079(P) · X 提及 | 3 路 |
| **G8** | overlay lock 重复注册 | FE-052(O) · FE-095(F 23 处) | 2 路 |
| **G9** | 三套并行数据层 | FE-073(A) · X-P3 | 2 路 |
| **G10** | `useDetailDrawer` 无 memo 导致的 memo 失效串 | FE-047(O) · FE-102(F 根因) | 2 路,**F 路给出根因** |

⚠️ **需交叉证伪的一处**:`refreshSignal`,C 路把「有 publish 无订阅」用作**证伪另一条 finding 的前提**,而 A/O/X 三路把它当**独立 finding**。前提和结论不能是同一件事。

---

# 第五部分 · 规范素材 ——「同一件事的 N 种写法」

来自 O 路横向比较,**每一行直接对应缺哪条规范**:

| # | 同一件事 | 几种写法 | 缺的规范 | 能根除的 finding |
|---|---|---|---|---|
| 1 | 表格 loading | 4 种,**0 处用 `isFetching`** | 列表 loading 一律 `isFetching`,读数据一律 `currentData` | FE-039 · FE-040 |
| 2 | 候选 hook 放哪 | 3 个位置(`app/queries/` · `feature/ui/` · `feature/application/`) | 非组件 hook 放 `feature/application/`,跨 feature 放 `app/queries/` | FE-046 |
| 3 | 无限滚动候选累积 | 3 份近乎逐行相同的实现 | 一个 `useCursorCandidates` 原语 | FE-046 |
| 4 | 扩展字段渲染 | 7 份实现 2 种日期控件 | `OrganizationExtensionFields` 是唯一入口 | FE-045 |
| 5 | Form.List 校验错误显示 | 2 种(contract 对 / org-structure 错) | 一律 `rules` + `Form.ErrorList` | FE-042 |
| 6 | 抽屉打开时重置表单 | 2 种**相反方向** | 一律 open 时重置 | — |
| 7 | 提交失败怎么处理 | 3 种(保留 / 强关丢稿谎报 / `void error` 丢因) | 失败一律保留抽屉,文案来自 `problemOf` | FE-036 · FE-059 |
| 8 | overlay 锁谁注册 | 3 种 + 12/13 重复注册 | overlay 自己注册;用了 lifecycle 就不再调 | FE-052 · FE-095 |
| 9 | 详情抽屉数据来源 | 2 种(直接用 prop / 镜像本地) | 详情抽屉不得镜像 prop | FE-044 |
| 10 | cursor 分页栈 | 2 套,同一 feature 内只有一套向后跳正确 | 一个 `useCursorStack` | FE-009 · FE-041 |
| 11 | RTK request 要不要 memo | 2 种(行为等价) | 二选一写下来即可 | FE-047 |
| 12 | 手机号正则 | 3 处各写一遍,**1 处写错** | 共享 `MOBILE_PATTERN` 常量 | **FE-002(阻断)** |
| 13 | `wireUuid` | 2 个同名函数,一个抛错一个静默 | 一个名字一种失败语义 | **FE-001(阻断)** |
| 14 | feature barrel | 12 个里 4 个有,跨 feature 引用全绕过 | 要么都有并强制走,要么都不要 | FE-056 |
| 15 | skip 查询的表达 | 3 种,**`skipToken` 零使用** | 统一 `skipToken` | FE-084 |
| 16 | `expectedVersion` 取哪一版 | 2 种(11 处对 / 2 处重读) | 一律取用户当时看到的那版 | **FE-005** |

---

# 第六部分 · 负面结论(证伪掉的模式 —— 这些地方不用写规范)

X 路穷举后确认**不构成模式**,写规范是浪费:

| 模式 | 实测 |
|---|---|
| Redux 放派生数据 / selector 未 memo | 全仓 **1 个 `useSelector`**、**1 个 `createSlice`**、0 个 `createSelector`、0 个 `createAsyncThunk`;store 只有 api reducer + 一个 scope slice,immer 写法标准 |
| 手写 thunk 取数 | 0 个 `createAsyncThunk` |
| AntD Form 受控/非受控混用 | **0 处** `<Form initialValues>`;137 个 `Form.Item name=` 全走 `setFieldsValue`/`resetFields` |
| `destroyOnClose` 残留 | **0 处**(v6 已 deprecated),全部用新名 `destroyOnHidden`;5 处显式 `false` 的都配了 reset effect |
| Table `rowKey` 缺失或用 index | 14 处**全部有 rowKey**;4 处 index 派生都是只读表无 rowSelection/expandable/行内编辑 |
| AntD 废弃 API(按 6.5.0) | 穷举 `bodyStyle`/`headerStyle`/`dropdownRender`/`dropdownMatchSelectWidth`/`dropdownClassName`/`visible=`/`TabPane`/`overlay=`/`filterDropdownVisible`/`onDropdownVisibleChange` —— **0 命中**。反向确认正确用了 v6 形态。**全仓最干净的一块** |
| hook 依赖数组缺项 | `exhaustive-deps` 设为 error,三处 fresh 跑全 exit 0。缺项不存在;「多项」的真实危害是 FE-080 |
| 组件内定义组件 | 3 个疑似是模块级一次性调用的工厂函数,引用恒定 |
| 卸载后 setState / 泄漏 | 定时器 1 处有清理;abort listener 在 finally 显式移除;21 个命令式取数点里 18 个有 guard,剩 3 个中 1 个有自己的 token 守卫 |
| TS 逃逸 | 全仓 1 个 `any`(测试)、3 个 `@ts-expect-error`(故意的负向类型断言)、**0 个 `@ts-ignore`/`eslint-disable`**;生产代码双重断言仅 2 处 |

---

# 第七部分 · 版本基线(所有「官方用法」判断的前提)

从 `node_modules` 实测安装版本,非 package.json 声明:

| 包 | 版本 |
|---|---|
| react / react-dom | **19.2.5** |
| @reduxjs/toolkit | **2.12.0** |
| react-redux | 9.3.0 |
| antd | **6.5.0** |
| react-router | 7.18.1 |
| @ant-design/pro-components | 3.1.12-0 |
| typescript | 6.0.3 |
| eslint / eslint-plugin-react-hooks | 9.39.5 / 7.0.1 |

⚠️ 版本对不上的结论一律作废。

---

# 第八部分 · 已知的顺序约束

1. **FE-007/FE-072(源码正则测试)必须排在格式化之前。** 175 处 `assert.match` 断的是源码文本;P 路实测纯换行即变红。**后台没有这个约束,前端有。**
2. **FE-102(`useDetailDrawer` 无 memo)是 FE-047 的根因**,先修根因。
3. **FE-096(foundation 单 key 模型)是 FE-019 的根因**,且需 Dexter 裁定幂等边界后才能动。
4. **G1(订阅泄漏)是 FE-013 的成因土壤**,X 路建议与 FE-073/X-P3 一起收敛而非单独修。
5. **FE-099(foundation 零 hook 测试)** —— FE-091/092/094/098 都落在无测试区。若要防回归,DOM 环境要先有。

---

# 第九部分 · 交给 Codex 的交付物形态(Dexter 2026-08-16 指定)

**三块,缺一不可:**

## 一 · 如何建立和执行前端开发规范

不只是"写一份规范",要含**执行机制**。后台那轮的教训摆在这:规范写了 22 天、门一道没建、超长行反涨 54%。
前端的处境相反(44 条断言已是门、但无正本),所以这一块要回答的是:
- 正本放哪(对应后台 `doc/platform/backend-coding-standard.md` 的前端版)
- 哪些能成门、哪些只能 review(**别把语义伪装成关键词匹配**)
- **现有 175 处源码正则断言怎么处置** —— 它们是假门,且锁死排版

## 二 · 该抽象到 foundation 的现在就抽

**Dexter 裁定原文**:「该抽象到 foundation 的需要抽象,现在这个阶段不抽象,后面走的会更乱。」

⚠️ **不要套用后台 2-E**(「只接受工具类合并,不接受为消除少量重复而造抽象」)。
前端 foundation **已经是现成的家**且复用密度已证明(`testId` 104 处 · `useOverlayLock` 78 处 · 两个 lifecycle 59 处),
7 份扩展字段渲染不是"提前造抽象",是**该回家的没回家**。

**候选清单直接来自第五部分**,已知至少:

| 该抽的 | 现状 | 关联 |
|---|---|---|
| `MOBILE_PATTERN` 常量 | 3 处各写一遍,1 处写错 | 根除 FE-002(阻断) |
| `wireUuid` 统一失败语义 | 2 个同名函数,一抛错一静默 | 根除 FE-001(阻断) |
| `useCursorStack` | 2 套实现,同 feature 内只有一套向后跳正确 | FE-009 · FE-041 |
| `useCursorCandidates` | 3 份近乎逐行相同 | FE-046 |
| 扩展字段渲染唯一入口 | 7 份实现 2 种日期控件 | FE-045 |
| 列表 loading/data 读取原语 | 4 种写法,0 处用 `isFetching` | FE-039 · FE-040 |
| `useDetailDrawer` 补 memo | 无 memo,是一串 memo 失效的根因 | FE-047 · FE-102 |
| 多命令幂等键模型 | 单 key 不覆盖多命令抽屉 | FE-096 · FE-019 · **需 Dexter 先裁边界** |
| `toWireRequest`/`expandPath` | 两个 App 逐字重复 25 行 × 2 | FE-110(原判"不建议现在抽",**按本裁定改判为该抽**) |

## 三 · 按顺序的逐项修改内容

每项含**三段,缺一不可**:
1. **当前问题详细描述** —— 事实 + 锚点 + 业务场景
2. **整改方案**
3. **验收标准** —— 必须**自带反例**(判断不了对错的不算判据)

顺序约束见第八部分。

---

# 第十部分 · 验证结果(113/113 全验完)

| 路 | CONFIRMED/ANCHOR_FIXED | DOWNGRADE | REFUTED |
|---|---|---|---|
| P(FE-075~090) | 15 | 1 | 0 |
| C(FE-011~035) | 19 | 0 | 1 |
| F/X(FE-091~113) | 19 | 2 | 0 |
| O(FE-036~060) | 24 | 1 | 0 |
| A(FE-061~074) | 11 | 1 | 1 |
| **合计** | **88** | **5** | **2** |

## 10.1 被推翻的 2 条

**FE-064(菜单图标表 Partial → 页面静默隐身)· REFUTED —— 编译器实验**
拷贝到 scratchpad 加第 21 个页面 key 不给图标 → `tsc` 在 `OperationsApp.tsx(94,79)`/`(104,49)` 报 **TS7053**,另三处 TS2345。
`satisfies Partial<>` 买不到宽松 —— `menuIconByKey[key]` 在**索引处**、`strict:true` 下重新强加穷尽性。**场景不可达。**
残留:注解误导 + 测试名 `icon-mapped` 过誉(该测试确实零图标断言)→ 降 N。

**FE-023(decodeDetail 双镜像分叉)· REFUTED —— 后端结构**
根与 item 两份来自**同一个 `sections` JsonNode、同一个纯函数、同一次 `detail()` 调用**
(`CatalogOwnerService.java:1531` 与 `:3103`;composite 1532/3104;inventoryBom 1526-1528/3105 共用 `bomEntry`)。分叉前提不可达。
附:根 `inventoryBom` 是裸取**没有**回退到 item,「互相 fallback」对它不成立。

## 10.2 降级的 5 条

| ID | 原判 | 新判 | 挡住它的是什么 |
|---|---|---|---|
| FE-063 | 高 | **N** | ①`edge-codegen.mjs:808/811` **一次 pass 出两份产物**+`R5_EDGE_RTK_ENDPOINT_MISSING` 门 → endpoint 缺失不可达(台账"两份独立产物"的前提是错的);②RTK **会 catch** 抛错的 `query()`,`.unwrap()` 在 try **内**抛出,`ApiFailure` 契约完好 |
| FE-080 | 中 | **低** | 切空间重跑发的 arg **与挂载时完全相同** → 落进缓存分支 → 0 次 HTTP。台账在 FE-082 用了这条推理却没回头套用 |
| FE-097 | 高 | **低** | `StoreManagementPage.tsx:57` **有红色错误横幅**;`StoreProfilePage.tsx:62` 更彻底(early-return 带重试的 Alert)。且台账第三个"绕过"举例是错的——`InventoryManagementPage.tsx:93` 判了 `!list.error`。真实缺陷降为「7 处无条件 emptyText 造成错误横幅下仍写『暂无门店』的双重信号」 |
| FE-111 | 中 | **HANDOFF 欠账** | `safeLogger.ts:117` 是 `if (sink && (enabled \|\| level==='WARN' \|\| level==='ERROR'))` —— WARN/ERROR **本来就绕过 `enabled` 直发**。缺的是 `VITE_FRONTEND_LOG_SINK_URL`,仓内连 `.env` 都没有 |
| FE-044 | 中 | **低** | 机制只在 **2/4** 成立,而台账举的业务场景恰好点名了**不成立的那两个**:`ContractDetailDrawer` 渲染读 `detailQuery.data` 不读镜像;`BusinessEntityDetailDrawer` 的镜像是**纯只写死状态**(`target` 全文件从不读取) |

## 10.3 关键计数/措辞更正

| ID | 台账写的 | 实测 |
|---|---|---|
| FE-040 | 「**全仓零处**用 `isFetching`」 | **30 余处在用**;`CatalogWorkbenchPage.tsx:424` 正是 `adminListState({loading: itemsQuery.isFetching && scopeReady})` |
| FE-042 | 「**全仓无** `Form.ErrorList`」 | **4 处在用**(两个合同抽屉 + platform 两处) |
| FE-019 | 「`markBusinessIntentChanged` 本 feature 零调用」 | **6 处**(两个复制抽屉);正确说法是「**CatalogItemDrawer** 从不调用」 |
| FE-102 | 「已 grep 确认无人放进依赖数组」 | **8 文件 13 处都放了** —— 用来降级的 grep 方向完全反了(结论侥幸不变:13 处全是 `useCallback`/`useMemo` 无 `useEffect`) |
| FE-100 | 「全部只有自身测试引用」 | **6/8 不成立**,5 个有真实生产内部消费者 → 只能删 barrel 行不能删函数 |
| FE-073 | 「**完全绕开** RTK Query」 | 走的是**同一条** RTK 路径(`PlatformTransport.ts:39-41` dispatch `initiate`);绕开的是 **hook/缓存订阅模型** |
| FE-018 | 6 处 | **7 处跨两 App**(operations 6 + `ExtensionDefinitionEditDrawer` 1) |
| FE-066 | 「死机制零订阅」 | **1 个订阅者**在 `platform-admin/WorkspaceScope.tsx:26`;operations 侧零订阅 |
| FE-093 | 29 个 Drawer 传 `diagnosticOperationId` | **27 个**(29 是调用 lifecycle 的文件数) |
| FE-020 | 两行「各约 4000 字符」 | `:744`=**3729** · `:655`=**2737**;未列出的 `:981`=2533 是第三长 |
| FE-104 | 16 种控件用 4 种 | ✅ 两数精确 |
| FE-096 | 15 处绕过 | ✅ 精确 |
| FE-098 | manifest `visible` 全 true | ✅ 10 field × 7 shape × **94 条 rule,0 条 false** |
| FE-065 | 每条 query/mutation 都挂 LIST | ✅ **43/43 query · 49/49 mutation**,归一后各只有一种形状 |

## 10.4 两条被加重

**FE-075** —— 重挂点在 `<Routes>` 外层,「刷新当前页」不仅不取新数据,**还清空用户已设好的筛选、排序、分页、展开的组织树**。
**FE-077** —— 失败时 `hierarchyLoading ? Spin : problem ? null : …` 让**整棵组织树渲染成 null**,而右侧还留着旧节点资料。

## 10.5 FE-061 根因被重述(重要)

台账写「解药就在 RTK 缓存里被 `??` 丢掉了」—— **这个框架是错的**。
scope 是服务端 per-session 的,丢掉 `entryOverride` 会让标签 A **静默采用标签 B 的门店**,而不是响亮失败。

**真正的缺陷是缺 CONTEXT_STALE 恢复路径**:
- `PLATFORM_COMMON_CONTEXT_STALE` 全前端**只作为文案出现**(`operationsProblemFeedback.ts:48`),无任何处置逻辑
- 两个本可自愈的选择器**自己也发陈旧值**(`RoleContextSelector.tsx:37` · `DataScopeSelector.tsx:79` 都传 `requiredContextVersion: entry.contextVersion`)
- **文案说「请刷新当前页面后重试」,而按钮 aria-label 正是「刷新当前页」——指向唯一修不好它的那个控件**

触发面也更准:`context_version` 只在 `selectContext`(`:132`)与 `selectDataNode`(`:148`)两条语句递增。
**单标签也可达**:`selectDataNode` 服务端提交成功但响应丢失 → 行是 N+1 而 `entryOverride` 停在 N → 永久砖化。

## 10.6 方法论结论

**被推翻的 7 条无一例外是否定式全称命题**:「全仓无 X」「无人使用」「被 X 挡住」「两份独立产物」。

原因:证明"存在"只需一个实例,证明"不存在"要穷举,而写免责时往往只搜了一种形式。
**声称缺陷成立的部分基本都对,声称缺陷不成立的部分错得最多。**

⚠️ **这条要写进规范的评审纪律部分。**

## 10.7 转向:规范应指向仓内已有的正确写法

三条全称命题被推翻后,finding **反而更硬**:

- 不是「应该用 `isFetching`」,是「**`CatalogWorkbenchPage.tsx:424` 已经这么写了**,另外 7 处照它改」
- 不是「应该用 `Form.ErrorList`」,是「**`ContractCreateDrawer.tsx:56` 已经这么写了**,`ProjectPhaseFieldList` 照它改」
- 不是「应该 memo」,是「**`useSubmissionLifecycle.ts:16-20` 专门写了注释说明为什么要 memo**,`useDetailDrawer.ts:24` 照它改」

**规范自带正例,Codex 不用猜标准长什么样,而且标准是这个仓自己定的。**

---

# 当前状态

- 第一步 **收集** ✅ 113 条,6 路,212 文件
- 第二步 **验证** ✅ 113/113 全验完 —— 88 成立 · 5 降级 · 2 证伪 · 14 处计数措辞更正
- 第三步 **沉淀规范** ⬜ 素材见第五、六、十部分
- 第四步 **修复计划** ⬜ 顺序约束见第八部分
