# 商品库工作台实施—详设逐维对账（作者源码核验）

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEWER_KIND=AUTHOR_SOURCE_RECONCILIATION
STATUS=STATIC_RECONCILIATION_COMPLETE_DYNAMIC_OPEN
SCOPE_LIMIT=STATIC_SOURCE_AND_FOCUSED_PROOF_ONLY
GOVERNING_REQUIREMENTS=doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md
GOVERNING_JOURNEY=doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md
GOVERNING_IA=doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md
GOVERNING_INTERACTION=doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md
GOVERNING_IMPLEMENTATION=doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md
RULE=每个适用条款必须同时核对行为、形态、动作、关系、位置、文案、限制、状态所有权、控件级联、失败与恢复、可访问/焦点、数据来源与失效边界；任一维未核或不一致即 OPEN。
```

## 当前核验记录

| 范围 | 行为 | 形态 | 动作 | 关系/级联 | 位置 | 文案 | 限制 | 状态所有权 | 失败/恢复 | 可访问/焦点 | 数据/失效 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| J-CATUI-02 查看商品与规格 | 已读 owner detail、纯只读 facts 与规格读模型 | 独立 `CatalogItemViewDrawer` + View section；无 Form | header 只消费 owner actionAvailability；规格详情不含作废入口 | 规格从商品 readback 派生，不替代父商品 | 工作台点击父/子行进入同一查看抽屉 | 首区段现为“商品概览” | 无写能力仍维持只读，不开禁用编辑器 | 服务端事实是 RTK detail；瞬态 tab 是组件本地 | detail error 有原位重试，后续 L2 需动态核验 | `closeDetail` 回焦原行；后续 L2 核验 | typed detail/currentData，查询 identity 绑定 itemCode | `MISMATCH_FIXED_AND_REREAD`：拆分 view/editor 首区段文案；规格治理按钮仅编辑调用传入；focused DOM PASS。 |
| J-CATUI-03 新建商品 | 最小身份原子创建后进入编辑 | 中档 Modal，vertical Form | 新建并继续完善 | 商品形态不清空名称/编码/分类；分类由树候选提供 | 工作台主按钮 | “商品形态”“商品分类”“新建并继续完善”“商品未新建” | 商品形态/编码在创建后不可改；权益壳不可选 | Form 仅属创建 Modal；候选 hook 只保留本 scope identity | typed problem 留在 Modal；candidate load fail 阻断创建 | foundation lifecycle；L2 待核验关闭/焦点 | owner create、manifest、category candidate 由 contract 提供 | `PENDING_DYNAMIC_AND_L2`：源码逐维已读，需完整 focused/L2 证明。 |
| J-CATUI-04 编辑与草稿恢复 | 整单草稿、一次保存，按区段标脏/错误 | 超宽编辑 Drawer，左锚点 tabs + sticky footer；草稿恢复为第二层 Modal | 保存、取消、恢复/放弃草稿、配置绕行 | scope/brand/item/version 改变清候选；配置绕行先 persist，再关闭编辑，关闭配置后提供继续编辑 | 工作台唯一 first-level task；编辑内部子任务只开 Modal | “基础资料”“检测到…未保存内容”“上次停留在…” | dirty/submit 阶段三径受 lifecycle 控制；不分区提交 | draft 只在 sessionStorage；server facts 只在 RTK；UI 瞬态在组件 | restore/stale/corrupt 有分支；save typed problem 指向区段 | problem 主动聚焦；关闭焦点后续 L2 核验 | `useCatalogItemEditorSession` whole-save + manifest/detail readback | `MISMATCH_FIXED_AND_REREAD`：Alert 改为详设的 Restore Modal，且恢复文案绑定保存区段；focused/typecheck PASS，L2 待执行。 |
| J-CATUI-05 商品配置与分类候选 | 六库在一套配置任务中；分类按树层级选择 | first-level 超宽配置 Drawer，左六库导航，右栏三种复杂度 | 选择库、创建/编辑/启停；从编辑返回继续入口 | usage/scope/brand/current category 清树、cursor、搜索；不可选节点的原因来自 owner | 编辑关闭后才开配置；配置关闭后工作台显示继续编辑 | “商品配置”“生产标签”等业务文案 | 配置 Drawer 上不得叠 Drawer；候选最多 100/页后加载更多 | `useCatalogConfigLibrary`/candidate hook 负责局部 state，workbench reducer 负责 first-level task | 候选失败显示业务错误；商品草稿保持 | navigation region 有 aria label；恢复焦点待 L2 | dictionary/candidate owner read，旧 identity 不复用 currentData | `PENDING_FOCUSED_AND_L2`：源码已读，需运行全前端 suite 与 L2 配置三路径。 |
| J-CATUI-01 查找、树表与十列表格 | 父商品分页，按需展开 SKU；父 total 不含 SKU；分类/商品标签/生产标签筛选分离 | 固定工作台、树表/仅表格入口和同表头 SKU 子行；精确十列、横滚 | 搜索、树节点筛选、展开/收起、加载更多、打开查看 | TreeSelect 只以 category treeData 驱动；切节点清 cursor/selection/stale expanded；SKU 行不可进入父批量选择 | Dexter 冻结的顶栏/结果域保持；表格在右侧结果域 | 商品列四行、SKU 两行；价格多单位标业务类型；摘要空态为中性业务文案 | 每格最多四行，SKU 规格最多四行；溢出省略+Tooltip；禁复合斜杠列/colSpan 第二列模型 | RTK `currentData` 为服务端列表；筛选/展开/scroll 是 workbench local state | SKU 读取失败只占该父展开区；加载中/失败/继续加载均独立子行 | 子行/详情关闭回原行焦点为 L2 oracle | owner summary + SKU page，严格 envelope；刷新只失效当前结果域 | `STATIC_MATCHED_DYNAMIC_OPEN`：前端 118/118、架构门 PASS；L2 再核父 total、十列逐格、scroll/tooltip/focus。 |
| J-CATUI-06 批量三态 | 逐项尽力的完整 receipt，成功、失败和未提交项都可读 | 同层 Batch task，提交前摘要→提交中进度→有界结果列表 | 分类移动/标签/状态批量操作；关闭、刷新重试 | 只允许父商品选择；结果按 owner item result 映射，不以 refresh 伪造 receipt | 列表批量动作进入同一工作台 task，不另开 first-level Drawer | 成功 N 项、失败 M 项、每行显示业务原因；无 raw code/内部 ref | 100 项有界滚动；协议空/非法不伪造成功；非业务故障继续抛出 | receipt/local result 仅组件状态；列表权威事实仍 RTK | receipt 成立但刷新失败可见，重试只刷新列表 | 键盘/焦点归还留 L2 | owner batch result + refreshAfterBatch 精确失效 items/navigation | `STATIC_MATCHED_DYNAMIC_OPEN`：完整 receipt 和 rejected-value 可见性已 focused；L2 复验逐项提交、负例不变与焦点。 |
| J-CATUI-07 本地/品牌复制 | preflight→确认→execute 的 token 边界完整；兼容理由经 contract reasonCode 翻译为业务说明 | 独立 Copy Drawer；结果与阻断定义分区呈现 | 选择来源/范围、预检、确认、执行、返回修改 | source/target/range 变更立即作废旧 token；reasonCode 不能由 canonical tuple 或 raw code 推断 | 工作台 first-level copy task | 显示“商品结构不兼容”等映射文案；未知码安全降为“当前内容需要进一步确认” | 不能展示 canonical tuple、raw business code、owner internals；冲突不可执行 | preflight/result 属 copy state；权威 readback 仍 generated query | typed conflict 原位显示，返回修改后要求重新预检 | close/return focus 留 L2 | generated response 直接严格 decode `reasonCode`；无第二套浏览器兼容解析 | `MISMATCH_FIXED_AND_REREAD`：原实现错误从 canonical tuple 派生业务码；现 contract→projector→UI 单向映射，前端 114/114 PASS，L2 待执行。 |
| J-CATUI-08 治理与商品级单一生产标签 | actionAvailability 决定可见动作；生产标签为商品级 nullable 0..1，SKU/选项不可拥有 | View 只读与 Editor 分壳；生产标签单选可清除 | 启用/停用/归档/作废并重建与单选/清除生产标签 | action 禁用原因来自 contract；停用既有绑定可见而新候选拒绝 | 生产标签与商品标签并列树一级节点，编辑制作信息区为商品级 | “商品形态”唯一术语；“生产标签”而非技术字段或旧“制作处理标签” | View 零 disabled Form；SKU/选项 Editor 零标签控件；partial unique/owner 拒绝双标签 | server facts 在 RTK；draft 仅 sessionStorage；action task 本地 | typed problem 定位；版本冲突/引用拒绝不改事实 | lifecycle close/return focus 留 L2 | contract nullable ref→owner→relation partial unique→seed/readback；无 array/fallback | `STATIC_MATCHED_DYNAMIC_OPEN`：术语扫描、owner/contract/migration red guard、114/114 PASS；L2/80 acceptance 仍需真实执行。 |

## 已修复的不一致

1. 查看和编辑原先共用“基础”标签，违背查看用“商品概览”、编辑用“基础资料”的用户任务语义；现由 `catalogViewTabLabel` / `catalogEditorTabLabel` 分别消费。
2. 查看规格矩阵原先仍会渲染 disabled “作废规格”按钮；现只有编辑面传入 `onVoidSku` 才渲染治理动作，查看 DOM 没有该按钮。
3. 草稿恢复原先是编辑 body 内 Alert；现按交互稿作为第二层 Modal，明确恢复、放弃与关闭保留草稿的分支。
4. Copy compatibility 原先忽略契约 `reasonCode`、从 canonical tuple 推导并显示内部码；现严格解码 `reasonCode`，经唯一业务文案 projector 显示，未知值 fail-safe 为可理解的通用说明。
5. L2 locator binding 原先保留已退役的 `catalog-production-tag-quick-manage-drawer`；现只绑定实际 `catalog-dictionary-drawer`，生产标签管理由其独立 control 绑定。
6. 架构测试原先把保存请求的业务语义与单行排版、媒体操作与旧宿主文件耦合；现断言严格字段投影和真实 media-action 边界，红线仍可证伪。

## 静态源码复核（无限制对账规则下的第二轮）

| 复核面 | 覆盖维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| Contract→model→UI copy reason | 行为、关系、文案、限制、数据来源 | `MATCHED_STATIC` | `catalogModel.ts` 只接受 `reasonCode`；两个 Copy Drawer 只消费 `catalogCopyReasonLabel`；不存在 tuple 反推或 raw code 渲染。 |
| 十列表格与查看/编辑分壳 | 行为、形态、动作、位置、文案、限制、状态所有权、可访问 | `MATCHED_STATIC` | 组件静态词汇/禁用 Form/测试 id 架构门、114 个前端测试与生产 build 均 PASS；动态 scroll、tooltip 和焦点仍未声称通过。 |
| 单一生产标签与导航/筛选 | 行为、关系、限制、级联、失败恢复、数据失效 | `MATCHED_STATIC` | P1→P3/self-test PASS；owner contract/migration red guard、L2 locator vocabulary、strict item-only editor 边界均有静态 proof。 |
| Batch、Copy、治理失败与恢复 | 行为、动作、文案、限制、状态所有权、失败恢复、失效边界 | `MATCHED_STATIC` | receipt 不靠刷新伪造、copy token 作废、typed problem 映射、action availability 与 strict query invalidation 已回读；真实 HTTP/L2 尚待执行。 |

先前一轮 `scripts/verify --validate-only` 为 `R5_VERIFY_VALIDATE_ONLY=PASS (15/15)`；本次源码继续变更后已完成 Node health `198/198, 28/28` 与 frontend `118/118`，最终静态全链须在本文件当前修订、独立复核闭合后重新执行并记录。上述均为静态/聚焦证据，不能替代下一阶段的 80/80 Testcontainers、迁移真实执行或 24 case browser L2。

## L2 readiness 首败根因记录

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

- **Run：** `l2-1787612629033-45688-9913f72b-770a-4d89-9c37-d60d0479cae3`。
- **首败：** `L2_OWNER_FIXTURE_PRIMARY_ITEM_REF_MISSING`。
- **最后已知正常：** `LOCAL_RUNTIME_STARTED`。
- **断裂边界：** L2 owner fixture 的 command-readback decoder，在任何浏览器 case 启动之前。
- **Business：** `FAIL`；**cleanup：** `PASS`（本机进程树与远端隔离 namespace 均已释放）。
- **证据与根因：** `CatalogItemCommandReadback` 只在 `result.resourceRef` 声明商品身份。三个 L2 fixture 路径却读取已退役的 `itemRef`/`id`/`ref` 别名。命令实际返回 HTTP 200，但 fixture 无法把新建商品绑定到后续 save/readback 图。
- **同根有限分母：** 全部三个 `createOperationsCatalogItem` fixture consumer：门店主商品、门店依赖商品、总公司来源商品。其它 command family 各有其契约声明的资源字段，未混入此 schema。
- **修复：** 用严格 `requiredCatalogItemCommandResourceRef` 仅消费 `result.resourceRef`；红变异证明遗留 top-level alias 会被拒绝。没有递归兼容搜索、fallback、删 fixture、延长 timeout 或 owner 语义修改。
- **下一证据：** 重跑 runtime unit/static 链后，在全新隔离 namespace 重跑 managed readiness。

### Follow-up root cause: detail action projection level

- **Run:** `l2-1787613063352-49269-90bc2c15-3fa0-4e6c-b5e0-6c955572c96a`; **first failure:** `L2_OWNER_FIXTURE_REFERENCE_ABSENT_NOT_VOIDABLE`; **cleanup:** `PASS`.
- **Evidence:** `CatalogOwnerService.detail()` emits `data.item` and its item-level `data.actionAvailability` as separate sibling facts. The L2 governance fixture incorrectly read `item.actionAvailability.voidAvailability`, so every absent/present/released reference oracle was structurally incapable of seeing the owner result.
- **Finite same-root denominator:** the three lifecycle reference-state readbacks: absent, blocked, released. They now use one strict detail-root decoder. A red mutation with an old nested `item.actionAvailability` projection fails.
- **Boundary:** this is an L2 contract-consumer projection repair only; catalog lifecycle semantics, the reference fixture graph, and the negative cases are unchanged.

## 未闭合项

- 全部行都必须完成 80/80 Testcontainers 与授权 L2 的动态 evidence 后才可改为 `MATCHED`；本轮任何 `STATIC_MATCHED_DYNAMIC_OPEN` 都不是动态通过声明。
- 本文件不是独立 adversarial verdict，不能代替实施完成后的 fresh independent review。

## L2 动作链静态复核（本轮根因修复后）

| 声明到消费链 | 行为/形态/动作 | 关系、位置与状态所有权 | 文案与限制 | 失败、恢复、可访问/焦点 | 数据来源与失效边界 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| FIND | P1 `actionInput.find` 声明成功与失败查询；Playwright 在同一筛选输入执行，不再以未变值触发空请求 | fixture 将语义 fixture code 解析为每 run 物理商品编码；筛选是工作台 local state | 不向用户显示 case/code；业务 UI 仍只显示搜索值 | 失败动作确实发请求并保留父列表；恢复仍由业务重试控件承担 | P1→generated fixture→`facts.actionInput`；不读 DEV seed | `MATCHED_STATIC_DYNAMIC_OPEN` |
| CREATE | 成功输入唯一 `successCode`，失败输入已存在商品编码；两者不再颠倒 | code/name/shape/category 都属于 Create Modal 草稿；创建成功进入 Editor，拒绝停在 Modal | 重码只显示业务问题，不造“假编辑态” | 失败后字段值保留，成功动作进入编辑面 | P1 语义 code 在 fixture materialization 解析为 run identity；owner 是唯一重复校验来源 | `MATCHED_STATIC_DYNAMIC_OPEN` |
| BATCH | 三个父商品的 fixture identity 在 P1 声明；实际选择只在当前无过滤结果域执行 | selection 属工作台局部 state；SKU 仍不可选；owner receipt 才是结果权威 | 不显示 fixture code/技术状态；业务结果仍使用成功/失败项文案 | stale 通过真实 owner version 更新制造，不伪造浏览器失败；刷新失败与 receipt 分离 | 语义 fixture code→物理 item code；不依赖当前搜索结果或 DEV 数据 | `MATCHED_STATIC_DYNAMIC_OPEN` |
| COPY | P1 指定来源 fixture；L2 先写来源搜索控件再等待候选/预检/执行 | Copy Drawer 自有 preflight/token state；来源变更只允许产生当前 token | UI 仅投影业务兼容性说明，禁止内部 ref/code 泄漏 | stale 使旧 token 失效后要求重新预检，不能静默继续 execute | 语义 source fixture code→物理 item code；token/readback 均取 owner HTTP | `MATCHED_STATIC_DYNAMIC_OPEN` |
| VIEW failure/recovery | 失败前 reload 清除 RTK detail cache，确保故障绑定真实 GET；恢复成功后关闭 Drawer | reload 后取得的 `trigger` 是唯一可回焦的现行 DOM 行；不再使用 reload 前的失效 Locator | 不新增用户文案 | retry 保持列表事实；关闭严格断言焦点回本次真实触发行 | detail 请求、retry 和 readback 皆由 generated operation 记录 | `MATCHED_STATIC_DYNAMIC_OPEN` |
| Tab/confirm controls | 每个编辑 tab 由 `catalogItemTabTestId(tabKey)` 生成；lifecycle binding 指向实际确认按钮而非 retained Modal root | tabKey 是 contract/section identity；confirm 由可交互 Button 消费，不把隐藏 overlay 当作动作面 | 不把 testId 或状态码显示给用户 | tab click 后由对应业务区段控件证明激活；confirm 仅点击可见可用按钮 | `catalogTestIds`→component→locator binding→L2 同源，禁止自由 selector | `MATCHED_STATIC_DYNAMIC_OPEN` |

本表逐维对账后没有发现新的静态不一致；但六行都仍需在 fresh 24-case managed L2 中取得业务、join 与两侧 cleanup 证据，才能改为 `MATCHED`。本轮执行的静态证据为：frontend `114/114`、production build PASS、browser-L2 runtime unit `25/25`、Node health `186/186`、`scripts/verify --validate-only` `15/15`。

## 2026-08-25 增量根因修复逐维对账

这次对账针对外部 review 的 M-01/S-02，以及 Dexter 在真实页面上指出的五个同根现象；不把单个截图症状当成孤立 CSS 问题。所有路径均在写入前后按 formal requirements §4.2、§4.8、§12.4、IA 的分类候选条款、implementation design §9c/RCP-03 逐条回读。

| 根因族与适用面 | 行为、形态、动作与关系 | 位置、文案与限制 | 状态/级联/失败恢复 | 数据来源、失效与可访问 | 当前静态证据与结论 |
| --- | --- | --- | --- | --- | --- |
| 分类层级漂移：创建、挪动、候选与 seed | `CatalogOwnerService` 以 `CATALOG_CATEGORY_MAX_DEPTH=3` 在创建和 reparent 同一 owner 入口拒绝第四层；P1、OpenAPI typed problem、frontend TreeSelect 同一上限。第三层可选作商品分类，不能再创建子分类；第四层请求返回 `CATEGORY_DEPTH_EXCEEDED` 且不改版本。 | 用户只看到“最多只能建立三级分类”及“商品分类最多只能建立三级”，不暴露 depth/owner；新建、编辑、批量挪动均为树形候选，禁用节点有同一原因。 | 后端锁定分类路径后计算，不接受浏览器自报层级；`useCatalogCategoryActionController` 持有分类任务/表单，切换 scope/brand 清候选；typed problem 原位保留表单。 | 树由 owner navigation/candidate 读取，前端不自行数层或平铺；`CATEGORY_DEPTH_EXCEEDED` 走 generated problem→field binding。TreeSelect 与返回焦点由 L2 留作动态 oracle。 | owner acceptance 正反例、P1 self-test、前端 focused/architecture 均覆盖；`MATCHED_STATIC_DYNAMIC_OPEN`。 |
| SKU 展开缺失：所有有 SKU 的父商品 | `CatalogItemListTable` 为有 SKU 的父行渲染显式可操作 expander；展开按需取 SKU page，子行与父行共用十列表头，SKU 子行不进入父级批量选择。无 SKU 行不渲染伪加号。 | 入口在商品列第一列控制，符合树表语义；加载/失败/继续加载只占父行下的一条子行，不改变列宽或伪造结果。 | 展开键与 SKU cursor/page cache 只在 `useCatalogSkuRows`；换树、筛选、页码或 refresh 使对应 cache stale/clear；展开失败可重试，不影响父列表。 | SKU 只来自 `getOperationsCatalogItemSkus` 的 strict envelope；`aria-label` 由显式展开控件提供，最终键盘和焦点在 L2 断言。 | `CatalogItemListTable.test.tsx` 正反例，controller 只组装 `useCatalogSkuRows`；`MATCHED_STATIC_DYNAMIC_OPEN`。 |
| 商品列内容被宽度、缩略图和 Tag 排版互相挤压 | 商品列固定 240px；父商品图 72px、SKU 图 60px；标签仅一枚时占整行可用宽度，两枚时才分配空间。完整标签保留 Tooltip，非短标签也不无意义截断。 | 父商品仍为名称、编码、分类、标签四行；SKU 仍为名称、编码两行；每单元格上限和文字省略规则保持正式需求，不用价格/库存列吸收内容。 | 这是纯展示派生，不改变筛选、批量、详情、草稿或行 identity；图片缺失沿既有 fallback，而非新增数据分支。 | 行 key 仍是业务码；图片与标签来自 list summary，零额外详情请求。Tooltip 的真实 hover/读屏行为归 L2。 | list focused tests 断言 240/72/60、单 Tag 全宽、Tooltip；`MATCHED_STATIC_DYNAMIC_OPEN`。 |
| 工作台宿主过载：筛选、分类、批量、SKU cache 与视觉混在一个文件 | 路由宿主 `CatalogWorkbenchWorkspace.tsx` 仅装配 `CatalogWorkbenchController`；读模型/筛选/游标/SKU cache 只在 `useCatalogWorkbenchReadModel`，first-level task transition 只在 `useCatalogWorkbenchTaskCoordinator`，分类与批量各由专用 command controller 管理，树、内容、任务 surface 是纯 presenter。 | 页面仍是同一个工作台和同一 first-level surface，不引入新路由/平行状态；presenter 仅接收业务 props，不自行改 owner 事实或复制 user copy。 | server facts 继续仅 RTK `currentData`；整单草稿继续仅 draft/session store；任务、category、batch、SKU 与 list-local 状态各有一个住址，回调刷新仍由现有 foundation lifecycle。 | locator bindings 同时指向 `catalogTestIds.ts` 定义与实际消费组件；刷新只失效精确 items/navigation，SKU GET 的 cache 生命周期由专用 hook 管理。 | `CatalogWorkbenchWorkspace.tsx` 20 行、`CatalogWorkbenchController.tsx` 288 行；读模型 268 行、任务协调 157 行，前端 118/118 PASS。Round 2 S-02 已从“文件迁移”升级为职责/状态拆分；静态总门已 fresh PASS，待动态验收。 |
| 性能防增量失效：新 GET 未用只读 scope、全量 acceptance 预算门可被环境开关跳过 | 两个 task GET 被收进 `ReadOnlyTaskConnectionScopeInterceptor` 的闭集，复用性能批只读连接作用域；无跨 schema 写或 budget 上调。完整 backend acceptance 必定执行 exact-set、DB budget 和 GET connection≤1，不再需要 env opt-in。 | 无用户可见文案或操作变化；失败为受管运行的明确性能代码，而非静默放行。 | 连接 scope 只包 GET task read；写路径不改。run-level verifier 消费 completion event，不污染单场景 business；超预算红变异必须失败。 | P2 HTTP recipes、生成预算和 Testcontainers verifier 共用 operation identity；动态 manifest 必须出现 `budgetEvidence` 与 `connectionBudgetEvidence`。 | Node health 已覆盖“complete run always enforces budgets”与超额 mutation；真实 80/80 仍须测得两 GET 借连接为 1、ItemSkus 不超 12，故 `MATCHED_STATIC_DYNAMIC_OPEN`。 |
| 选项 effect 重新泄漏生产标签语义：P1 rule、OpenAPI schema 与未来 consumer | option effect 只声明非负制作时长增量和制作说明；`tagOperation` 与 `x-tagOperation` 已从 P1 运行期输出删除。 | 用户界面没有“选项改变生产标签”的入口或提示；生产标签仍只在商品级单选。 | 生产标签的写状态仍只在商品 draft/owner singular reference；选项 effect 不承担任何标签状态。 | P1 self-test 将任一已退役字段重新出现判为失败；全 contract/generated/runtime scan 只允许 self-test 的反向 guard 命中。 | Round 2 S-01 `CONFIRMED` 后已根因删除；新的 P1 红变异分别注入 rule/schema 的已退役字段并必须失败。P1 write/check、tokens、M1、P3/self-test 与静态总门均 fresh PASS，待动态验收。 |

### Testcontainers 首败的同根修复

```text
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
RUN_ID=r5-tc-1787668546628-50274
FIRST_FAILURE=PERFORMANCE_OPERATION_EXACT_SET_MISMATCH:missing=106:extra=0:drift=0
LAST_KNOWN_GOOD=80_SCENARIO_TEST_EXECUTION_PASS_AND_REMOTE_CONTAINERS_VOLUMES_CLEANUP_PASS
BROKEN_BOUNDARY=MANAGED_WHOLE_SUITE_OPERATION_COVERAGE_FIXTURE_ACTIVATION
BUSINESS=FAIL
CLEANUP=PASS
```

- **通用失败模式：** run-level verifier 把完整生成 operation 集合设为强制分母，但产生补足 event 的现有非业务 calibration fixture 仍由调用方环境变量决定，造成全量产品场景成功却天然缺 operation event。
- **有限分母与反例：** 仅 `backendAcceptanceEnvironment(runId, operation)` 的 `operation=all` 可以是 240-operation workload；所有非 `all` 聚焦 operation 必须继续不启用 coverage，避免把它们伪装为全量测量。`BackendPerformanceOperationCoverage` 已是唯一补足 fixture，80 条 `@AcceptanceScenario` 业务分母不变。
- **根因修复：** 受管 runner 在且仅在 `operation=all` 时自行导出 `V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true`；删除 caller-controlled opt-in。静态 red proof 同时断言 all 必有该导出、聚焦 run 必无该导出，并保留 exact-set/超预算/GET connection 的既有红变异。
- **反例边界：** 不通过抬预算、降低 exact-set、删 coverage fixture 或把它计入业务场景分母解决；也不对聚焦 operation 施加 240-operation 伪分母。
- **当前结论：** `r5-remote-testcontainers` 与 budget focused tests `21/21` PASS；本次失败的动态证据仍保留为 FAIL/PASS，必须在 fresh all run 中重新取得 240/240、预算和连接 evidence。

### 当前静态判据与动态未完成边界

- 当前树已实跑：详设 §9b `20/20` 锚点唯一；Node health `198/198`、登记文件 `28/28`；operations-admin focused/static + Vitest `118/118`；P1 `--write --check` 为 59 operations、26/99 API scenarios、26/65 L2 scenarios；`scripts/verify --validate-only` 为 `PASS 15/15`。
- Round 2 处置后的作者回读：S-01 的运行期 contract/frontend/backend 扫描为零，仅 P1 自检反向 guard 与红变异保留字段字面；S-02 的服务端读模型、first-level task、命令 controller 与纯 presenter 已各自一住址，route host 20 行、controller 288 行。此处为作者全维静态核验，非独立 verdict；动态 80/80、24/24 L2、reset/start/seed 仍是未完成条件。
- 作者本轮的工具调用首败是 Vitest 不支持 `--runInBand`，不是测试或产品失败；已用原生 `yarn --cwd apps/frontend/operations-admin test` 重跑并以 exit 0 取得上述 118/118。

## 2026-08-26 增量对账：三级分类、SKU 展开与列表呈现

本次只核对 Dexter 新点名的五项。每项均以正式需求 §4.2/§11、IA 与 implementation design 为准，不以旧 DEV 截图的运行时字节作为设计真相；下列为源码和聚焦证据，真实浏览器呈现仍进入后续 L2/DEV 证据。

| 点名事实 | 行为、关系与数据来源 | 形态、位置、文案与限制 | 状态/控制与失败恢复 | 静态结论 |
| --- | --- | --- | --- | --- |
| 分类最多三级 | `CatalogOwnerService` 的 create/move 在 owner 层复核三级；P1 seed 与 executor 同以三级为上限；navigation 和 category candidate 读同一 owner hierarchy | 所有新建、编辑、挪动分类入口使用 TreeSelect；第三级仍可见但不可选，统一文案“商品分类最多只能建立三级” | 前端只消费 `selectable/disabledReason`，不得自行放行；owner 拒绝时保留已填事实 | `MATCHED_STATIC` |
| SKU 父行展开 | parent page 是 `hasSkuChildren` 的唯一来源；catalog owner 由 SKU facts 投影该字段，SKU child page 按 itemCode 懒读 | 同一 AntD Table 的父/子行、同表头；有 SKU 的父行显示明确加/减展开控件，无 SKU 父行不显示无意义控件 | `expandedItemCodes` 与 `skuPageByItemCode` 只属 workbench local state；展开读失败只占该父行子区且可重试，切换 query identity 清展开 | `MATCHED_STATIC` |
| 短商品标签 | owner summary 提供完整 `tagSummary`，不在浏览器拼接或重命名 | 一个短标签（含“招牌推荐”）整行显示，不套省略；只有溢出才截断并以 Tooltip 给出完整业务文字 | 无额外业务状态；纯 presenter 仅按可视宽度决定截断 | `MATCHED_STATIC` |
| 商品列与图片 | 十列均常显并由 table 宽度表统一计算；不删除列、不建第二套卡片列 | 商品列 240px、父商品图 72px、SKU 图 60px；表体横向滚动，商品列固定左侧。该宽度为 Dexter 已确认的“紧凑且保留四行信息”值，非截图中选择/展开两列叠加后的视觉宽度 | 宽度是模块单一常量；文案超长以省略+Tooltip 处理，四行上限不变 | `MATCHED_STATIC` |
| 生产标签命令性能预算 | typed create/update/transition 三条写命令各自原子领取回执、锁定事实并返回 readback；不回落 legacy JSON writeCore | 仅内部命令链变更，不改变生产标签单值用户模型、页面位置或用户文案 | update/transition 恢复 CP-05 已校准 FIXED=9；查询边界静态 red mutation 覆盖锁、回执和预算回退 | `MATCHED_STATIC_DYNAMIC_PENDING` |

本增量不宣称旧 DEV 截图已被验证或修复；它证明当前源码与已批准设计一致。下一步必须以 fresh Testcontainers 证明预算、连接和 HTTP 行为，再以授权 browser L2 与新 DEV 证明展开控件、标签显示、列宽、图片尺寸及 TreeSelect 的真实浏览器行为。
