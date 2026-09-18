SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 门店桌台与二维码管理 implementation-facing 详设

```text
DATE=2026-09-17
DOC_KIND=IMPLEMENTATION_DESIGN
STATUS=IMPLEMENTATION_COMPLETE_AWAITING_REVIEW
BUSINESS_SOURCE=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md
IA_REF=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md
AUTHORIZED=Dexter 本轮直接授权按本详设与实施计划进入实施，并在实施完成后执行受管 reset、DEV、seed
NOT_AUTHORIZED=Browser L2、UAT、部署、Git
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=MANAGED_RESET_DEV_SEED_ONLY
```

本文件把需求正本、已接受 Journey、IA、交互线框和当前源码收敛成可实施的技术不变量；它不是生产代码，不把文档中的未来路径伪装成当前已存在的能力，也不提供任何运行通过结论。

## 0. 设计准入与事实边界

已重新打开并作为本详设输入的正本：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、当前程序 Roadmap 授权字段；
- `project-memory/index.md` 全部 kernel 与六维 recall 命中原文；
- `scripts/README.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`；
- `doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md`；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md`；
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md`；
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`。

当前 Roadmap 给出 R5 implementation/runtime/reset-seed 的授权字段；Dexter 已在本轮直接指派本批进入实施，并将受管 reset、DEV、seed 纳入实施完成后的运行收口。该直接指派是当前批次实施 authority；Browser L2、UAT、部署和 Git 仍不在授权内。

本批三个用户界面事实与 IA、交互工件逐字一致：

1. 区域列表头部是“新建区域”；未选区域时从属列表没有新增动作；桌台区显示“桌台/新建桌台”，扫码区显示“扫码点/新建扫码点”。
2. 区域列表和桌台/扫码点列表采用 `SalesMenuPage` 的 master/detail 列表、选中态、行末“…”菜单和上移/下移动作；顺序不属于任何创建/编辑表单。
3. 主页面只有二维码配置只读信息区与“编辑”；编辑内容进入独立二维码配置 Drawer；详情 Drawer 只读；所有编辑 Drawer 的 dirty、关闭确认、提交中锁定由 `useDrawerFormLifecycle` 管理，子控件不得自行提示“请先保存”。

“服务点”只作为文档、契约和 owner 的技术术语；用户可见文案只用“区域”“桌台”“扫码点”“二维码配置”。

## 1. 真实业务目标与方案比较

### 1.1 结构性问题

门店现在没有一套能同时表达“区域—桌台/扫码点”、门店二维码配置和可审计扩展值的 owner 事实；如果只在前端拼页面，权限、类型级联、三态保留、渠道状态边界和 URL 派生都会变成可绕过的展示逻辑。真正要解决的是：由组织 owner 保存三类门店事实，由渠道 owner 保存 URL 规则，由资产 owner 保存图片生命周期，由前端只呈现各 owner 的权威 readback。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 把区域、服务点、二维码配置全部塞进门店经营规则 JSON | 少建表，但把集团/项目对门店的开关授权与门店自己的二维码配置混成一个事实住址；无法自然表达区域/服务点生命周期、排序和服务点审计 | 拒绝 |
| B. 复用现有 business-channel 两个用途之一，前端自行补 URL 规则和二维码筛选 | 改变既有用途语义；现有候选 read 不携带 URL 规则，前端过滤会绕过 owner；D-10/D-12 的候选层和生成层边界无法成立 | 拒绝 |
| C. 组织 owner 保存区域、服务点和 QR 单例；business-channel 提供 QR 专用 bounded read 与单一 URL composer；asset 复用现有生命周期核心；两个前端复用 foundation 和销售菜单交互 | 新增的边界只承担本批事实，保留已有 owner 主权，不复制既有页面/资产/dirty 行为，能对每个反例做直接验证 | **采用** |

我选了 C 而不是 A/B，因为它把每个事实放回实际拥有该事实的模块，只增加必要的三个组织实体、一个渠道属性和一个资产 target 关联，不用前端或一个过宽的通用框架替代 owner 判定。

排序是本批明确的运营维护语义，虽然通用记忆的默认红线是“只为消费者展示对象排序”，但本批 Dexter 已明确要求区域、桌台和扫码点使用销售菜单式上移/下移；实现仅保留相邻移动和边界禁用，不引入拖拽、全局排序框架或额外排序模型。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 契约、目录、生成声明 | contracts / 生成脚本 owner | OpenAPI、Problem、admin catalog、gate/type/asset declarations | 需求 R-5、R-6、R-7；当前生成链 |
| CP-1 | 区域、服务点、QR 单例与审计 | organization | 三张组织表、owner API、三态/类型/排序/扩展值/二维码配置 readback | CP-0；organization persistence/audit |
| CP-2 | 渠道模板 URL 规则、候选与 URL composer | business-channel | 模板 URL rule、QR 专用 bounded candidate、状态无关生成读取 | CP-0；现有 business-channel owner |
| CP-3 | 桌台图片资产 | platform-asset | 新 usage 与 typed target adapter；沿用 stage/release/claim | CP-0；现有 staged_asset 核心 |
| CP-4 | Operations edge 与权限/gate | operations edge + workspace-iam | 新页面/写操作 HTTP edge、scope/grant/token、typed problem | CP-0、CP-1、CP-2、CP-3 |
| CP-5 | 两个后台前端 | operations-admin + platform-admin | 门店桌台与二维码页面、各类 Drawer/surface、SERVICE_POINT 定义入口 | CP-0、CP-4；foundation、SalesMenuPage |
| CP-6 | seed、acceptance、focused、三维/逐代码对账 | 主 agent | 真实 HTTP 场景、固定夹具、owner readback、P9 对账 | CP-1–CP-5；运行另需 Dexter 明确授权 |

## 3. 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时必须符合的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java` 的 `resolveTaskScope`；`organization/application/OrganizationTaskPathLookup.java` 的 selected-store 任务路径 | 静态核对每个新 read operation 将 `STORE` 类型目标和 path `storeRef` 传到同一 scope resolver；acceptance 用 PROJECT 与 STORE 两个 assignment 读同一门店 | 若新 owner 没有现成 read API，必须像 `resolveTaskScope` 一样由服务端解析祖先路径、校验会话与 assignment，不接受前端 scope 或 list row 推导身份 | CP-1 的 area/point/QR reads、CP-2 的 QR candidate read、CP-3 的 asset read、CP-4 全部 operations reads |
| 写授权与 grant 复核 | 组织域使用 `organization/api/StoreOperatingRuleGate` 的按键 API；上一批 token 链继续使用 `workspace-iam/application/CommandExecutionContextResolver.java` 与 `execution-context/.../WorkspaceCommandOperationToken.java`；两者都复核 `organization/api/OperationsOwnerScopeGrant.java` | 新组织 owner 先解析 selected-store scope，再直接调用按开关键的 gate，之后才进入目标/邻居锁与 mutation；既有 36 条 command token（33 条 gate=true、3 条 preflight=false）的 token/resolver 链把布尔标志泛化为稳定 `storeOperatingRuleKey`，只在该链路消费；sales-menu 的 19 个写入口本来就不在 token 链，泛化后直接调用按键 gate；acceptance 直接绕过前端调用每类 mutation | `StoreOperatingRuleGate` 新增按规则键的窄方法；既有 `requireCatalogManagementForStoreTarget` 保留并委托到 `catalogManagementEnabled`，以保持上一批错误与调用语义；新组织 operation 不伪造 command token，也不把 organization 塞入 `catalog-inventory` token 分母；所有 gate key 均来自 catalog/生成声明，禁止复制桌台专用实现 | CP-1 所有区域/服务点/QR 写操作；CP-4 既有 36 条 operation token 与 19 条 sales-menu 直调的通用化回归；上一批 catalog/inventory/asset token 与 sales-menu owner 直调的既有语义必须保持 |
| 跨 owner 写与事务 | `organization` owner API；`platform-asset/api/SalesMenuAssetCommandApi.java`；`PlatformAssetService` 的 claim 事务边界；`@Transactional` owner command | 静态核对组织 owner 是唯一业务事务入口，模板/资产只经公开 API；focused/acceptance 使 owner 写失败并检查没有组织半写和 staged 孤儿 | typed asset adapter 必须保持现有 stage 在对象 I/O、claim 与目标绑定在同一 REQUIRED 事务、失败 release 的形态；跨 owner 禁止直写对方表 | CP-1 服务点+扩展值+图片 claim、CP-1 QR config、CP-2 模板 URL rule、CP-3 image target |
| 集合形态与分页 | `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`；`SalesMenuPageRequest`、`SalesMenuCursorIdentity`；`BusinessChannelPersistence.BOUNDED_READ_LIMIT` | 静态核对区域和从属列表都以 `cursor/pageSize=20` 接口和 owner sort order 读，candidate 不接受 cursor/pageSize；focused 验证错误 cursor、边界移动和 bounded overflow | 区域/从属集合无产品固定总上限，采用 opaque cursor、固定 20、order+ref tie-breaker；QR 候选采用 bounded 100、取 101 检测超限并 typed problem，禁止静默截断 | CP-1 area page、point page；CP-2 QR candidate bounded read；CP-5 两个对应前端 collection |
| 缓存失效 / 改完刷新什么 | `libraries/frontend/admin-ui-foundation/src/behavior/refreshSignal.ts` 的 `createRefreshSignal/useRefreshVersion`；SalesMenu read model 的 cursor reset | 静态核对成功 create/update/status/order 后只发 signal 并重新取 owner readback；scope/area 变化 reset 对应 cursor；不把 draft 写回 list state | new feature 只持有 query identity、selected ref 和 refresh signal；排序/写入成功后刷新 area 或当前 point collection、QR summary、detail；未选区域不发 point query | CP-5 区域、桌台、扫码点、QR 配置、详情及 definition consumers |
| RTK 数据读取与加载判定 (`currentData` / `isFetching`) | `doc/platform/frontend-coding-standard.md` §3-B；`apps/frontend/operations-admin/src/features/store-operating-rules/model/useStoreOperatingRuleGate.ts` | focused/static 核对切换门店或区域时旧 `currentData` 不被当作新 scope，loading 使用 `isFetching`，失败清空 dataSource；变化后重取 | 页面 model 必须把 query identity 绑定 groupWorkspaceKey/storeRef/areaRef/cursor；不使用旧 data 与新 scope 混合渲染 | CP-5 所有区域/point/QR/detail/candidate/definition reads |
| 同一事实只有一个住址（不把服务端数据镜像进本地 state） | `doc/platform/frontend-coding-standard.md` §3-E；`StoreManagementPage.tsx`、`useSalesMenuReadModel.ts` | 修改渠道模板 URL 规则后重新读 QR projection，已有点的二维码变化而不是从本地缓存拼接；刷新/切 Tab 不改变 owner readback | 本地 state 只存 selected ref、Drawer open、form draft 和 cursor；区域/点/QR/extension/asset 事实只来自 generated RTK `currentData` | CP-5 全部业务事实与 QR 派生结果 |
| 失败可见且原因不得改写 | `frontend-coding-standard.md` §3-D；`backend-coding-standard.md` §2-B/§1-D；现有 `operationsProblemFeedback.ts` | 静态核对 list/definition/candidate/detail 各失败 surface 的真实 problem 映射与重试动作；acceptance 不把失败响应当空集合 | 本批固定文案：区域/桌台/扫码点/二维码配置各有准确失败文案；URL 不合规只在生成位置显示“暂未生成二维码”；候选空态指向门店渠道页 | CP-1/CP-2 owner problem、CP-4 edge problem、CP-5 所有可见失败与恢复 |
| owner 错误到 HTTP 的映射与注册处 | `contracts/openapi/components/common/problem.schemas.json`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java`；`scripts/generate/r5-edge-materialize.mjs` | 静态核对每个新 operation 的 `x-error-codes`、active error catalog、generated `EdgeProblemCode` 与 advice 映射一致；focused 用每个 typed problem 触发 HTTP | 若错误码是新业务错误，先在 disposition catalog 登记，再在 edge catalog/register 与 path `x-error-codes` 闭环；不得只返回字符串或复用错误含义不符的通用码 | CP-1 类型冲突、编码冲突、状态/版本冲突、gate denied；CP-2 URL-rule 维度错误、candidate overflow、candidate not eligible；CP-3 asset problems；CP-4 all new HTTP paths |
| 幂等键构成与重放语义 | `frontend-coding-standard.md` §3-G；`organization/application/BusinessEntityCommandReceiptService.java`；`business-channel` command receipt；`SalesMenuAssetCommandApi` | focused/acceptance 对每个 command 重发同一 key+same payload，得到同一 readback；same key+different payload 被拒；失败补偿不产生第二行 | 新 organization commands 采用 workspace+store+operation+target+canonical request 的 receipt scope；asset stage/claim/release 延续 typed target/idempotency 形态；reads 禁止 Idempotency-Key | CP-1 area/point/QR create/update/status/order、CP-2 template update、CP-3 stage/release/claim |
| 该用生成物的地方不得手搓字符串 | `backend-coding-standard.md` §2-D；`scripts/generate/edge-codegen.mjs`；`scripts/generate/store-operating-rule-catalog.mjs`；`scripts/generate/catalog-admin-p3.mjs` | 静态核对 Java/TS edge DTO、operation IDs、catalog page/action、rule types 均来自 source + generator；生成物修改后能被 `--check` 发现 | OpenAPI/schema、admin-catalog、store-rule catalog 和 token source 是唯一声明；owner 领域内部值用 Java enum/constant；前端 label 只在 dictionary；不手写 generated DTO/operation string | CP-0/CP-4/CP-5 所有 contract/catalog/rule/token changes |
| 日志落点与脱敏字段 | `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`；`AGENTS.md` logging boundary；现有 structured operations logger | acceptance/受管 run 读取带 phase、operation、scope hash、correlation/request id 的结构化日志；静态核对不记录 cookie、token、raw payload 或图片内容 | 记录 workspace/store/service-point/channel 的不可逆 ref/hash 与结果/耗时/失败码；不记录 URL 规则原文、二维码最终 URL、extension raw value、Authorization、手机号 | CP-1–CP-6 backend commands、asset stage/claim/release、edge reads/writes、acceptance |
| 迁移回填与可逆性 | `db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql`；`V20260901_000000_000__sales_menu_owner.sql`；`V20260803_080000_000__organization_extension_hosts.sql` | 静态核对迁移先建表/约束/索引再启用 owner；migration dry-run/acceptance 验证旧组织 rows 可读、部分唯一索引释放 VOIDED code；无 destructive drop | 新表使用 additive Flyway；现有 store 为 QR singleton 插入默认 false/null；既有模板 URL rule nullable；服务点无存量回填；没有 down migration 或物理删除 | CP-0 schema source、CP-1 三张组织表、CP-2 URL rule、CP-3 asset usage/target |
| 前端共享行为（Drawer/列表/表单生命周期） | `libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts`、`list/adminListState.tsx`、`overlay/detailActionMenu.tsx`、`presentation/AdminImageCollectionEditor.tsx`；`SalesMenuPage.tsx` | static/focused 核对真实 Button/MenuItem/input/file input 都有 app `*TestIds.ts`；Drawer dirty 由 foundation 唯一触发，详情无 disabled Form | 新 UI 只组合 foundation；table image 用 `AdminImageCollectionEditor maxImageCount=1`；scan point 不渲染该组件；任何子控件不得自行 dirty 或“请先保存” | CP-5 `OPS-SPQ-01` 至 `OPS-SPQ-06` 的页面、列表、详情/编辑 Drawer、资产上传、扩展字段控件 |
| 候选/下拉数据源 | `BusinessChannelOwnerApi` 的现有 `listSalesMenuEligibleChannels/requireSalesMenuChannel`；`OperationsBusinessChannelController`；`BusinessChannelQuerySupport.BOUNDED_READ_LIMIT` | focused/acceptance 验证四维+双方 ENABLED 的候选分母；同名 URL rule 变化不影响候选，内部未绑定不被排除；超出 100 不是静默截断 | 新增 `listQrChannelCandidates` 专用 owner API/operation；既有 BUSINESS_CHANNEL、SALES_MENU 两用途的 contract、SQL、sort/cursor 语义不变；保存再次调用 `requireQrChannel` | CP-2 QR channel Drawer；CP-5 QR config select |
| 编码与名称呈现 | `project-memory/decisions/confirmed-business-language-corpus.md`；`BusinessEntityValueSupport.text/optional`；现有 `NameCodeText` 与 status dictionaries | 静态核对用户可见代码/名称均按 dictionary/status label 输出；同门店 active code 冲突由 owner/partial unique index 触发 | area/point code 在 store 内 active 非 VOIDED 唯一；UI 使用“区域/桌台/扫码点”，状态只显示中文字典；技术 `SERVICE_POINT` 不下沉到业务文案 | CP-1 persistence/owner、CP-4 DTO、CP-5 all surfaces |
| 会同时坏的东西是否已声明为原子组 | `doc/platform/foundation-charter.md` §5-C；organization owner transaction；asset claim boundary | focused/acceptance 制造 extension 校验、asset claim、organization write、audit write 任一失败，检查 readback 无半成品且 staged asset 可释放 | 一个服务点保存是一个组织 owner command：核心字段、扩展 JSON、image target/ref、audit 和 receipt 同事务；对象存储 stage 是事务前置，失败走 release；QR config 不与模板更新跨 owner 伪装成一个事务 | CP-1 point create/update/status/order、CP-3 image lifecycle；模板 URL 更新与 QR config 更新是两个独立 owner 原子组 |

## 3a. L2 脚本开发前 UI/testId 前置复核

```text
UI_DESIGN_REVIEW=PASS（Dexter 2026-09-17 已确认 IA/交互低保真线框）
IA_CONTROL_REVIEW=PASS_STATIC_PREFLIGHT（主 agent 已按 IA-SPQ-01 至 IA-SPQ-03 完成真实 JSX 的位置、样式组合与行为逐控件对照；记录见 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-ia-static-preflight-codex.md`）
TESTID_REVIEW=PASS_STATIC_BINDING（真实 Button/MenuItem/input/file input/Drawer 节点已与 `storeServicePointTestIds.ts` 逐项对照；同上记录）
L2_SCRIPT_ADMISSION=BLOCKED（本批当前未授权 Browser L2；静态 testId 绑定已完成，但不得据此执行浏览器验证）
```

下表是实施前置分母，不是已存在的 testId 证据。进入 L2 脚本前必须先逐个 IA-ID 对照真实控件在指定 surface/container 中的位置、样式（以 SalesMenu 基线为准）和行为（选中、排序、边界禁用、失败恢复、创建/编辑 Drawer），再按 `storeServicePointTestIds.ts` 的实际常量、真实 Button/MenuItem/input/file input 节点和 binding 逐项补齐；任何一项 IA 对照不一致都必须先修复。只有 UI focused/static proof 与 fresh 独立复核都通过，才能把 `IA_CONTROL_REVIEW`、`TESTID_REVIEW` 改为 `PASS` 并解除 L2 阻断。

| case/action | 用户控件与动作 | 计划 owning source | 计划 testId 唯一源 | 实际动作节点要求 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| 页面进入 | scope 切换、gate loading/failed/disabled | `features/store-service-point/ui/StoreServicePointPage.tsx` | `storeServicePointTestIds.page/feedback/operatingRuleGate` | 页面真实 root、Alert retry、shared disabled surface | MATCHED_STATIC_PREFLIGHT |
| 区域 | 新建、选择、编辑、上移、下移、状态/作废 | `StoreServicePointPage.tsx` | `areaCreate/areaRow/areaMenu/areaMenuAction` | 行按钮与 Dropdown MenuItem，不用文本/CSS 替代 | MATCHED_STATIC_PREFLIGHT |
| 桌台/扫码点 | 新建、详情、编辑、上移、下移、状态/作废 | `StoreServicePointPage.tsx` | `pointCreate/pointRow/pointMenu/pointMenuAction/detailDrawer` | 当前区域下真实表格行和行末菜单 | MATCHED_STATIC_PREFLIGHT |
| QR 配置 | 编辑、开关、候选选择、保存/取消 | `StoreServicePointPage.tsx` | `qrConfig/qrEdit/qrDrawer/qrEnabled/qrChannel/qrChannelOption/qrSave/qrCancel` | Button、Switch、Select option、Drawer footer | MATCHED_STATIC_PREFLIGHT |
| 区域 Drawer | code/name/type/status、保存/取消 | `StoreServicePointPage.tsx` | `areaDrawer/areaCode/areaName/areaType/areaStatus/areaSave/areaCancel` | 真实 input/select/button | MATCHED_STATIC_PREFLIGHT |
| 桌台 Drawer | code/name/capacity/shape/reservable/image/extension、保存/取消 | `StoreServicePointPage.tsx` | `pointDrawer/pointCapacity/pointShape/pointReservable/pointImageUpload/pointExtension/pointSave/pointCancel` | image file input 必须挂真实 file node；扫码点没有 image 节点 | MATCHED_STATIC_PREFLIGHT |
| 扫码点 Drawer | code/name/extension、保存/取消 | `StoreServicePointPage.tsx` | `pointDrawer('scan')/pointCode/pointName/pointExtension` | 桌台专属 input 与 image node 不得存在 | MATCHED_STATIC_PREFLIGHT |
| 详情 | 名称链接、详情 action、QR 结果、关闭 | `StoreServicePointPage.tsx` | `detailDrawer/detailAction/qrResult` | 只读 content，不使用 disabled Form | MATCHED_STATIC_PREFLIGHT |

## 4. 每个 CP 的门控

### CP-0 契约、目录与生成

- Gate-0.1：新 operation 的 path、face、owner module、page/action key、security、idempotency、error list 和 schema source 均在 source 文件登记；generated wire 只由脚本产生。
- Gate-0.2：`ExtensionHostTypes.VALUES` 与 `ExtensionDefinitionService.MANAGEMENT_HOST_TYPES` 增加 `SERVICE_POINT`，但 `FLAT_VALUES` 不增加；extension definition 主键仍为 workspace + host type。
- Gate-0.3：`tableManagementEnabled` 的 key、父子关系和默认值不变，只改标签为“是否启用桌台和二维码管理”。
- Gate-0.4：gate/token 的 source 传递的是 key，不是新的桌台专用布尔；上一批 operation 的既有生成结果和行为不变。
- Gate-0.5：channel template 的 URL rule 只在四维 target template 有意义；非 target template 写入被 owner 拒绝，target 允许空。

### CP-1 组织 owner 与数据

- Gate-1.1：三张表均带 workspace/group/store identity、version、created/updated、三态；无物理 delete path。
- Gate-1.2：area type `TABLE_AREA`/`SCAN_AREA`；point type `TABLE`/`SCAN`；owner 在 create/update 读取所属 area 的当前类型并校验；DB check 作为第二层。
- Gate-1.3：area code 在同门店 `status <> VOIDED` 范围唯一；point code 同门店 `status <> VOIDED` 范围唯一；部分唯一索引释放 VOIDED code。
- Gate-1.4：区域 type 变更只有在未作废 point 数量为零时成立；点逐个 `VOIDED` 后可变更；历史 VOIDED point 原 type/ext/image 保留且不进 current collection。
- Gate-1.5：area 非 `ENABLED` 时所有后代在 readback 中标为不可用，但不改 point 存储 status、extension 或 image；`DISABLED`/`VOIDED` 两种区域各成立。
- Gate-1.6：point 的 `TABLE` 属性（capacity、shape、reservable、image）只在 TABLE 生效；SCAN 请求不能带 table attributes 或 image；预约开关与 store operating rule 不联动。
- Gate-1.7：point save 的核心、扩展值、image target/ref、审计、receipt 是同一 owner transaction；stage 失败/owner 失败不会留 staged orphan。
- Gate-1.8：QR config 是 store singleton，初始 `enabled=false, channelRef=null`；关闭可空，开启必须有 owner 重新校验的 candidate；status 后续变化不清空 stored channelRef。
- Gate-1.9：QR list/detail projection 不存 URL；每个 point 的 URL 由 business-channel owner composer 读取当前模板规则派生；生成层不检查 channel/template/store 等状态。区域或 point 的不可用展示仍按 R-2.8 单独由 organization projection 判定，不把该展示边界改写成 URL composer 的状态谓词。

### CP-2 business-channel URL 与候选

- Gate-2.1：现有 `BUSINESS_CHANNEL` 和 `SALES_MENU` operation 的 path/query/SQL/collection shape 不改变；新 QR operation 独立登记。
- Gate-2.2：QR candidate SQL/owner 只使用 store relation、模板四维、channel status、template status；内部 binding `NOT_REQUIRED` 不构成过滤；不使用 URL rule、`statusDimensions`、`blockers`、store/tenant/brand 状态过滤。
- Gate-2.3：candidate collection 为固定上限 100；读取 101 行抛 `PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION`，不截断、不返回游标。
- Gate-2.4：save QR config 重读当前 store relation、四维和双方 `ENABLED`；已存失效值不能被读接口或前端悄悄清空；enabled=true 且提交失效 channel 时返回业务 problem 并保留原值。
- Gate-2.5：URL composer 与 legality checker 在 business-channel 一个代码住址；按 URL 的 query/fragment 结构追加/替换两个固定参数 `groupWorkspaceKey`、`servicePointRef`，值使用标准百分号编码；空或非法 URL 返回“不合规”结果，不抛到候选/配置保存。
- Gate-2.6：合法形态覆盖无 query、已有 query、fragment、`?`/`&` 结尾、同名参数、编码值；同名目标参数先移除再追加一份 canonical 值，避免重复参数语义不确定；fragment 始终保持最后。
- Gate-2.7：生成层查询可读取已选 channel/template 的 URL rule 而不按 status 过滤；channel/template 状态变化不成为第四种“不出码”原因。URL 不合规统一投影为“暂未生成二维码”。

### CP-3 asset

- Gate-3.1：新增 `STORE_SERVICE_POINT_IMAGE` usage 与 service-point typed target；只扩展现有 `platform_asset.staged_asset` usage closed set，业务关联唯一落在 organization point 的 `image_asset_ref`，不新增 `platform_asset.*_target` 或其他资产表，也不建新的 object storage/asset storage 机制。
- Gate-3.2：桌台上传最多一张图；`AdminImageCollectionEditor` 使用 `maxImageCount=1`；扫码点没有 image request field、upload entry、stage/claim path。
- Gate-3.3：stage 在事务外只做对象 I/O，成功得到 bind grant；organization owner 在 save transaction 内先锁定并校验 point，再以 typed target 调 asset core claim，保存 point 的 `image_asset_ref` 和 audit；任一失败 release staged asset，不以 asset target 表补偿关联。
- Gate-3.4：point `VOIDED`、区域 disabled 或 point disabled 不释放历史 image ref；replacement 按资产 owner 的既有 prior target 释放/保留规则处理，并以 owner readback 验证无孤儿。

### CP-4 operations edge / authorization

- Gate-4.1：新页面/action 与 `PG-CATALOG-STORE-ITEMS`、`PG-INVENTORY-STORE-STATUS`、`PG-SALES-MENU-STORE` 的 roles `GROUP/REGION/PROJECT/STORE`、data node `STORE`、selected-store scope 一致；新增 capability 仅用于编辑。
- Gate-4.2：所有新读写 path 使用 `operations-admin` face；页面只允许当前 selected store，服务器从 path `storeRef` 解析并校验 scope，不使用 query/cache/list row 身份。
- Gate-4.3：`tableManagementEnabled=false` 时页面不发 area/point/QR/candidate/detail 列表请求；每一个写 operation 在 edge/command context 与 organization owner 都拒绝。
- Gate-4.4：读失败清空对应 dataSource，显示准确 problem 与 retry；不把失败变成空态；definition read 失败不阻止打开已具备事实的详情但要保持定义缺失的准确提示，依交互工件判定。
- Gate-4.5：成功 command 回传 owner readback；前端刷新对应 collection/summary/detail，不手写 response 合并。

### CP-5 frontend

- Gate-5.1：主页面 `OPS-SPQ-01` 采用 sales menu section list + item table 的布局与 interaction；区域/point order 动作不出现在 form；首次进入或区域新建后不擅自选中区域，保留“请选择区域”，已有区域选择在从属对象保存后保持不变。
- Gate-5.2：`OPS-SPQ-02`/`03`/`04`/`06` 是编辑 Drawer，`OPS-SPQ-05` 是只读详情 Drawer；二维码 main summary 不是另一个详情页。
- Gate-5.3：所有 Drawer 用 foundation lifecycle；子控件不保存 dirty、不发“请先保存”；details 使用 descriptions/read-only display。
- Gate-5.4：QR 结果只显示在 point list/detail；在可用区域/point 的生成投影内，未开启、未选渠道、URL 不合规是三种且仅三种生成层不出码状态；区域或 point 非 ENABLED 是 R-2.8 的独立不可用展示边界，不增加生成层状态原因；不因已选 channel 后续状态变化隐藏/清空。
- Gate-5.5：用户可见文案不出现“服务点”；SCAN point 不出现 capacity/shape/reservable/image 的空位或禁用 Form。
- Gate-5.6：platform-admin 扩展字段定义新增 SERVICE_POINT host；operations-admin 只取定义并写 values，不接 dynamic columns/type search。

### CP-6 acceptance / 对账

- Gate-6.1：每个新增/修改 HTTP operation 都有 real HTTP scenario，scenario 的 `identity`、`fixture`、`request`、`businessOracle` 非空；oracle 验证实际字段/副作用，不只看 status。
- Gate-6.2：V-1 至 V-16 逐条落入场景或 focused test；V-2 本域所有 mutation 逐行对账，不能抽样；V-5、V-7、V-8、V-9、V-10、V-12、V-13、V-14、V-16 同时有正/反对照。
- Gate-6.3：全部步骤完成后先做整体三维对账，再做全量测试；测试前不得留设计—实现偏移。
- Gate-6.4：全部 evidence 关闭后做“逐代码与详设对账”，结果只能 `MATCHED` 或 `OPEN`；有 OPEN 时报告“实施未就绪”，不得交 Dexter/Claude 做 implementation review。

## 5. operation / path / face / 集合形态

以下是计划中的稳定能力名和 HTTP 形态。它们在实现前仍需由 contract source 和现有 operation registry 再次校验；若 source 发现已有同义 operation，停止新增并回到“能力按意图检索”处理。

### 5.1 organization / operations-admin

| capability / operationId | method/path | face / owner | request/response | shape / 预期增长 |
| --- | --- | --- | --- | --- |
| `getOperationsStoreServicePointAreas` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas` | operations-admin / organization | `cursor`, fixed `pageSize=20`; `StoreServicePointAreaPage` | Cursor；门店区域无产品固定总数，按 `displayOrder, areaRef` 稳定排序 |
| `getOperationsStoreServicePoints` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/service-points` | operations-admin / organization | cursor, fixed pageSize=20; `StoreServicePointPage` | Cursor；按区域展示 point，按 `displayOrder, pointRef` 排序 |
| `getOperationsStoreQrConfiguration` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration` | operations-admin / organization | singleton `StoreQrConfigurationView` | Detail/singleton；一个 store 一行 |
| `getOperationsStoreServicePoint` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}` | operations-admin / organization | `StoreServicePointView` | Detail；只读详情 Drawer，按 ref 重新 owner read |
| `postOperationsStoreServicePointArea` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas` | operations-admin / organization | create request + Idempotency-Key; area readback | Command；要求 page gate |
| `patchOperationsStoreServicePointArea` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}` | operations-admin / organization | name/code/type/expectedVersion; area readback | Command；type change 做未作废 child 复核 |
| `postOperationsStoreServicePointAreaStatus` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/status` | operations-admin / organization | targetStatus/expectedVersion | Command；三态，与 organization status transition 同形 |
| `postOperationsStoreServicePointAreaOrder` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/order` | operations-admin / organization | direction/expectedVersion | Command；同 store 相邻移动，成功回 area readback |
| `postOperationsStoreServicePoint` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}/service-points` | operations-admin / organization | type/core/table attrs/ext/image bindings | Command；point type 从 area 带入但 owner 重验 |
| `patchOperationsStoreServicePoint` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}` | operations-admin / organization | core/table attrs/ext/image bindings/expectedVersion | Command；SCAN 不接受桌台属性/image |
| `postOperationsStoreServicePointStatus` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}/status` | operations-admin / organization | targetStatus/expectedVersion | Command；不清除 ext/image |
| `postOperationsStoreServicePointOrder` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}/order` | operations-admin / organization | direction/expectedVersion | Command；同 area 相邻移动 |
| `patchOperationsStoreQrConfiguration` | PATCH `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration` | operations-admin / organization | enabled/channelRef/expectedVersion + Idempotency-Key | Singleton command；enabled=true 时 owner recheck |

组织 owner 的 area/point list 只返回非 VOIDED 的 current rows；详情按授权可读真实状态，但 current page 不把 VOIDED 历史点放进当前类型分组。区域 disabled/voided 的后代可在 owner projection 中标记 unavailable，不能把标记回写到 point status。

### 5.2 business-channel

| capability / operationId | method/path | owner | shape |
| --- | --- | --- | --- |
| `getOperationsStoreQrChannelCandidates` | GET `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-channel-candidates` | business-channel | bounded 100，接口不接受 cursor/pageSize；返回 `items` 与 `nextCursor=null` 的专用 candidate page |
| `requireQrChannelCandidate` | organization 调用 `BusinessChannelOwnerApi` 的 typed owner method | business-channel | 在 QR config save 事务前/内重新校验 store relation、四维、channel/template ENABLED；不改变现有 `requireSalesMenuChannel` |
| `deriveQrServicePointUrl` | organization 调用 business-channel owner composer | business-channel | 以 channelRef+storeRef+groupWorkspaceKey+servicePointRef 读取模板 URL rule；不按状态过滤；返回 valid URL 或 invalid result |
| `createOperationsBusinessChannelTemplate` | 既有模板 POST 的 `BusinessChannelTemplateCreateRequest` 增加 nullable `urlRule` | business-channel | 目标四维模板可为空/合法；非目标四维必须为 null；模板 own create/audit/receipt 不受 store gate |
| `updateOperationsBusinessChannelTemplate` | 既有模板 PATCH 的 `BusinessChannelTemplateUpdateRequest` 增加 nullable `urlRule` | business-channel | 目标四维模板可为空/合法；非目标四维必须为 null；模板 own update/audit/receipt 不受 store gate |

`getOperationsStoreQrChannelCandidates` 不复用现有 `/business-channels?usage=BUSINESS_CHANNEL|SALES_MENU` 的 response 或 filter。现有两个 usage 的行为保持字节级语义不变；二维码专用读取是新的用途边界。

### 5.3 platform-admin / extension

| capability | path | 说明 |
| --- | --- | --- |
| `getExtensionDefinition`（`entityType=SERVICE_POINT`） | GET `/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}` | platform-admin / extension；复用既有 definition owner 与编辑权限，集团空间级一套定义；沿用既有 `getExtensionDefinition` operation |
| `replaceExtensionDefinition`（`entityType=SERVICE_POINT`） | PUT `/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}` | platform-admin / extension；只增加 host 闭集消费，不为 service point 新建 definition operation；沿用既有 `replaceExtensionDefinition` operation |

### 5.4 asset

| capability | path | 说明 |
| --- | --- | --- |
| `stageStoreServicePointImage` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-assets/stage` | 新 typed edge path；复用 object stage 与 bind grant；新建或编辑均先以 store-scoped stage 返回 bind grant，point owner save 时绑定 point target；不改变既有 catalog/sales-menu usage |
| `releaseStagedStoreServicePointImage` | POST `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-assets/stage/{assetRef}/release` | 对应 typed release path；save 失败/取消时释放 staged asset |
| `claimStoreServicePointImage` | organization owner transaction 内调用 `StoreServicePointAssetCommandApi` 的 typed claim，不暴露独立 HTTP path | 组织 owner 在同一 REQUIRED 事务内锁 point、校验 target、claim asset 并写入 point 的 `image_asset_ref`；asset owner 只保有生命周期 metadata |

图片 URL/对象 key 不进入 organization readback；只返回现有 `AssetPreview` 所需的 opaque asset ref/metadata。

这里的 `StoreServicePointAssetTarget` 仅是跨 owner command 的内存 typed boundary，不是持久化表或第二份业务事实。organization owner 负责在同一事务内锁定并确认 point、store 与当前编辑版本，再把已确认的 target 和 bind grant 交给 asset owner；asset owner 只校验 usage、workspace/store scope grant、point ref 与 staged/active 生命周期，并把必要的 `claimed_by_type/id` 写回既有 `staged_asset`。最终业务关联只由 organization point 的 `image_asset_ref` 表达，实施不得照搬销售菜单的 `platform_asset.*_target` 表。

## 6. 跨 owner 写矩阵

| 写入事实 | 命令主权 | 调用方 | 事务 | 失败处置 |
| --- | --- | --- | --- | --- |
| area core/status/order | organization | operations edge → organization owner | organization REQUIRED | version/type/code problem；无半写 |
| point core/table attrs/ext values | organization | operations edge → organization owner | organization REQUIRED | 校验失败返回 typed problem；ext 审计同步回滚 |
| point image stage | asset | operations edge 先调用 asset stage | object I/O + staged row；不假设业务事务 | owner command 未成功则 release staged asset |
| point image claim/ref | asset + organization | organization owner 调 asset typed API | 同一 REQUIRED transaction | claim/organization/audit 任一失败 rollback，staged 资产 compensation release；业务关联只回写 organization point ref |
| QR singleton enabled/channelRef | organization | operations edge → organization owner | organization REQUIRED；candidate owner read 不写 | 不满足 gate/candidate/version 不写且保留旧 config |
| template URL rule | business-channel | business-channel edge → channel owner | business-channel REQUIRED | 非目标四维拒绝；不触发 store gate |
| extension definition | extension | platform-admin edge → extension owner | extension REQUIRED | 既有 definition problem；不改任何 service point value |

禁止跨 owner 直接写表：organization 不写 channel/template/asset 表，business-channel 不写 QR config/point 表，frontends 不写任何业务事实。

## 7. 声明—传递—消费矩阵

| 事实/机制 | 声明源 | 后端传递 | edge/generated | 前端消费 |
| --- | --- | --- | --- | --- |
| store operating gate | `contracts/catalog/store-operating-rule-switches.json` key `tableManagementEnabled`；`StoreOperatingRuleGate` 按键 API；既有 token source 的 `storeOperatingRuleKey` | 新组织 owner：selected-store scope → `StoreOperatingRuleGate` keyed call → owner mutation；既有 36 条 token operation（33 条 gate=true、3 条 preflight=false）：token → `CommandExecutionContextResolver` → keyed gate；sales-menu 19 条 owner 直调 keyed gate；两条链不混用 | path/action operation metadata 不复制 business rule；generated token 仅保留既有 command 闭集；新组织 operation 不进入 catalog-inventory token chain | `useStoreOperatingRuleGate` 读取同一 key，未开通跳 shared disabled surface |
| service point type | organization enum/schema | area owner read → point owner write recheck → DB check | generated `StoreServicePointType` | UI 由 selected area 决定 label；不让用户直接改 type |
| three-state | organization policy/schema | status command/readback | generated enum | 中文 status dictionary；voided 不进入 current list |
| order | owner persistence `display_order` + move command | transactional neighbor swap/resequence | generated direction/response | sales-menu row menu; boundary action disabled |
| collection shape | sales-menu cursor precedent / fixed page size 20 | opaque cursor identity includes scope, parent, sort and page size | generated cursor/page DTO | `CursorPagination`; reset on scope/parent/write |
| QR candidate four dimensions | business-channel owner predicate | dedicated bounded owner read and save recheck | candidate DTO contains only needed selectable identity + display; no front-end filter | Select consumes owner items; no client-side four-dimension filter |
| channel/template status | candidate owner | candidate only `ENABLED/ENABLED`; generation owner read ignores status | generated status enums | candidate list excludes disabled/voided; existing selected config not cleared; generation not gated by status |
| binding status | business-channel model | internal candidate explicitly accepts `NOT_REQUIRED` | not exposed as a UI gate | no binding checkbox/filter |
| URL rule | business-channel template schema | template owner → candidate/generation composer | `urlRule` generated field only where contract needs it | not edited on this page; only derived QR result displayed |
| URL append/legality | business-channel `QrServicePointUrlComposer` | one method returns valid/invalid projection | no duplicate front-end implementation | shows URL/placeholder only; no local URL parse |
| QR config singleton | organization table and owner | owner read/write readback | generated config DTO | main summary read-only; Drawer form draft only |
| extension host | `ExtensionHostTypes`, definition management host set | definition lookup by workspace + `SERVICE_POINT` | generated host enum/schema | platform definition page only; operations form renders returned fields |
| extension values | organization point JSONB + `ExtensionSubmission` | definition validation + owner update + explicit audit changes | generated typed extension wire | form only; no dynamic list column/search |
| audit representation | `AuditChange` explicit state/label/value; `OrganizationAuditHistoryService` | point core/ext/image changes in same transaction | audit DTO/read API | detail/history uses stored label snapshot; unknown key does not erase history |
| image lifecycle | existing asset core + new typed target usage | stage → bind grant → claim/target/ref | generated asset operation DTO | `AdminImageCollectionEditor(maxImageCount=1)` for TABLE only |
| failure mapping | problem disposition + `x-error-codes` | owner typed problem → `ContractProblemAdvice` | generated problem enums | `problemMessage` preserves operation-specific meaning and retry |
| refresh/invalidation | foundation refresh signal | command readback is source of truth | RTK tags/request identity | refresh area/point/QR/detail/definition precisely; no local fact mirror |
| idempotency | owner receipt services + contract header | canonical request + scoped receipt | generated header typing | lifecycle supplies key; reads forbid key |
| logging/masking | observability standard | structured event at real boundary | correlation headers unchanged | UI does not log raw payload/URL/value |

## 8. 业务规则 → owner 判定点

本表使用闭区间表示，区间包含两端及其间的全部需求条目；例如 `R-6.10–R-6.14` 代表 `R-6.10`、`R-6.11`、`R-6.12`、`R-6.13`、`R-6.14`。需求第 4–7 节的 67 个 R 条目全部覆盖，未映射项为 0；字母后缀条目按其完整 ID 单独计入，不因区间缩写而省略。

| 需求条目 | 唯一 owner 判定点 | 结果/反例 |
| --- | --- | --- |
| R-1.1 / R-1.9 | `StoreServicePointAreaOwner` create + area schema | store identity、name/code/type/order；新建 status=ENABLED |
| R-1.2 / R-1.6 | `updateArea` locked child count `status <> VOIDED` | 有未作废 child 拒绝；全部 point VOIDED 才允许改型 |
| R-1.3 | area partial unique index + owner normalized code | active duplicate reject；VOIDED 后可复用 |
| R-1.4 | area status command + tri-state policy | ENABLED/DISABLED/VOIDED；无 physical delete |
| R-1.5 | area/point projection `effectiveAvailable=area.status==ENABLED && point.status==ENABLED` | area disabled/voided 下点均 unavailable；point status/ext/image 不改 |
| R-1.7 / R-1.8 | point status command and current list predicate | clear 是逐 point VOIDED；历史 type/ext/image 仍可 read/audit，不进 current group |
| R-2.1 / R-2.2 | point FK + owner create/update | point 必有 area；存 `pointType`，不只依赖 join |
| R-2.3 | locked area read + point owner validation + DB check | 两种错误组合都拒绝；两种合法组合都成功 |
| R-2.3a / R-2.4 | point default/status partial unique index | 新建 ENABLED；store active code unique，voided code release |
| R-2.5 / R-2.9 | point command/schema and projection | TABLE 才有 capacity/shape/reservable/image；SCAN 不接受/不展示；status 不清值 |
| R-2.6 | point tri-state command | 和 area 一致，VOIDED 不物理删除 |
| R-2.7 | schema/table projection exclusion | point/QR table 不有 URL/QR entity ref |
| R-2.8 | QR projection owner | area 或 point 非 ENABLED 不出二维码位置/出边界文案，不改数据 |
| R-3.1–R-3.3 | asset owner stage/claim/release + organization point save | TABLE image 可保存；SCAN 无 image；失败无孤儿 |
| R-4.1 / R-4.2 | point schema/owner only | reservable 是 point scalar；不读、不校验 operating-rule reservation key |
| R-5.1–R-5.5 | admin catalog + operation scope resolver | page/action 与三门店页四类角色一致；PROJECT/STORE 两向可用 |
| R-5.6–R-5.9 | frontend page gate + organization owner keyed gate；上一批 52 条 gate 分母由 token gate=true 的 33 条与 sales-menu owner 直调的 19 条组成；其中既有 36 条 token（另含 3 条 preflight=false）按键泛化，sales-menu 19 条直接调用 keyed gate | off 不发 list；本域 11 个 HTTP mutation entry 全部 fail；claim 只作为 point owner 事务内步骤；本域 gate 分母与上一批独立 |
| R-5.10–R-5.12 | store operating catalog label source | 只改 label；key/parent/default unchanged |
| R-6.1–R-6.3 | QR singleton table/owner | one row/store；独立于 operating-rule JSON；off+null legal |
| R-6.2a / R-6.4–R-6.4c / R-6.5 / R-6.6 | QR config owner + dedicated candidate owner | enabled requires current eligible channel；owner 在读取与保存两处落实门店归属、四维谓词和状态；empty candidate points to channel page |
| R-6.5 / R-6.5a / R-6.5b | candidate SQL predicate | channel/template ENABLED；internal NOT_REQUIRED accepted；only four dimensions+2 statuses |
| R-6.7–R-6.7b | URL generation projection | only off/no channel/invalid URL no code；selected channel later status does not block generation or clear config |
| R-6.8–R-6.9e | business-channel template owner + composer | URL rule string; non-target empty; target empty/invalid remains candidate/saveable; generation shows placeholder |
| R-6.10–R-6.14 | single composer | append/replace fixed params before fragment; all five legal shapes and invalid paths; no URL persistence |
| R-7.1–R-7.4 | extension definition owner + organization value/audit owner | SERVICE_POINT management host; not FLAT; group-workspace definition; same four-state audit |

## 9. owner API 与消费者清单

### 9.1 organization API

新增或扩展 `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationOwnerApi.java`，或在该模块新增稳定命名的 `StoreServicePointOwnerApi`（若当前接口职责已过宽，优先新增窄接口，避免让既有 `OrganizationOwnerApi` 成为无边界总线）。必须提供：

- `pageStoreServicePointAreas(scope, cursor, pageSize)`；
- `pageStoreServicePoints(scope, areaRef, cursor, pageSize)`；
- `readStoreQrConfiguration(scope)`；
- `readStoreServicePoint(scope, pointRef)`；
- area create/update/transition/move；
- point create/update/transition/move；
- `saveStoreQrConfiguration(scope, enabled, channelRef, expectedVersion)`。

每个 command 方法都先解析 selected-store scope，再直接调用 `StoreOperatingRuleGate.requireStoreOperatingRuleForStoreTarget(workspaceUuid, groupWorkspaceKey, targetType, storeId, ruleKey)`（本域使用 catalog 中的 `tableManagementEnabled`），之后才锁定目标/邻居并做归属、状态、类型和 version 校验，写入后返回 owner readback。新组织 operation 不经过 `CommandExecutionContextResolver`，也不伪造 `WorkspaceCommandOperationToken`。既有 catalog/inventory/asset command 链的 36 条 token 仍按独立的 token→resolver→keyed gate 路径运行：其中原 gate=true 的 33 条改为 `storeOperatingRuleKey="catalogManagementEnabled"`，3 条 preflight 保持 null；sales-menu 的 19 个写入口本来就不在 token 链，泛化后各自直接调用 `StoreOperatingRuleGate` keyed gate 并传 `catalogManagementEnabled`。上一批 52 条 gate 分母仍只是 33+19，不得把 sales-menu 重新造进 token。旧 `requireCatalogManagementForStoreTarget` 作为兼容入口委托 `catalogManagementEnabled`。不能出现“只检查 page 的 controller”或“没有消费者的 owner method”。

### 9.2 business-channel API

在 `BusinessChannelOwnerApi.java` 增加窄的 QR 方法，不修改 `listSalesMenuEligibleChannels` 与 `requireSalesMenuChannel` 的既有谓词：

- `listQrChannelCandidates(workspaceUuid, groupWorkspaceKey, storeRef)`；
- `requireQrChannel(workspaceUuid, groupWorkspaceKey, storeRef, channelRef)`；
- `readQrUrlRuleForStoreChannel(...)`；
- `deriveQrServicePointUrl(...)`。

`deriveQrServicePointUrl` 的 owner SQL 只确认 channel/template/target relation 属于指定 workspace/store，读取当前 URL rule，不按 status 过滤；若 row/ref 缺失则返回 invalid result，不把状态当作生成阻断。

### 9.3 extension / asset API

- extension：复用 `ExtensionDefinitionLookup.requireDefinition`，新增 `SERVICE_POINT` host 闭集消费；不在 organization 中复制定义校验器。
- asset：新增 `StoreServicePointAssetCommandApi`/`StoreServicePointAssetTarget` typed adapter，内部复用 `PlatformAssetService` 的 stage/release/claim 核心；adapter 只在 command 边界绑定 service-point target identity 和 `STORE_SERVICE_POINT_IMAGE` usage，不持久化新的 asset target 表，organization point 的 `image_asset_ref` 是唯一业务关联。该 target 是内存 scope proof，不得形成第二份业务事实。

### 9.4 前端消费者

- `apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx`：页面 shell、gate、master selection、dependent collection、QR summary；
- `AreaDrawer.tsx`、`ServicePointDrawer.tsx`、`QrConfigurationDrawer.tsx`、`ServicePointDetailDrawer.tsx`：四类 Drawer surface，均使用 foundation；
- `storeServicePointTestIds.ts`：唯一 testId 源；
- `features/store-operating-rules/model/useStoreOperatingRuleGate.ts`：泛化为按开关键读 effective rule，保持现有 catalog/sales-menu 调用语义；
- `apps/frontend/platform-admin` 的既有 extension definition 页面：消费 generated `SERVICE_POINT` host，无新平行页面。

## 9a. 实施前全链同步变更清单

| 业务事实 | owning source | generated/consumer/focused/seed 全链 | disposition |
| --- | --- | --- | --- |
| area/point/QR schema | `contracts/openapi/components/organization/store-service-point-qr.schemas.json` | edge generated TS/Java、organization wire mapper、operations RTK、acceptance | 需同步修改 |
| area/point/QR paths | `contracts/openapi/paths/operations-admin/store-service-point-qr.paths.json` | `r5-edge-materialize`、`edge-codegen`、controller/operation binding、RTK | 需同步修改 |
| template URL rule | `contracts/openapi/components/business-channel/business-channel.schemas.json` 的 `BusinessChannelTemplateCreateRequest` 与 `BusinessChannelTemplateUpdateRequest` | business-channel create/update projection/persistence/query、generated edge、template acceptance | 需同步修改；两个 request 都允许 nullable `urlRule`，不能只靠创建后 PATCH |
| QR candidate response | new organization/business-channel component | candidate controller, owner API, bounded overflow focused test, acceptance | 需同步修改 |
| problem codes | disposition catalog → active edge catalog | `EdgeProblemCode.java`, `ContractProblemAdvice`, generated TS, paths `x-error-codes`, feedback dictionaries | 需同步修改 |
| `SERVICE_POINT` host | `ExtensionHostTypes.java`、`ExtensionDefinitionService.MANAGEMENT_HOST_TYPES`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs`、seed fixture contract | platform generated enum/schema, platform UI host dictionary, extension acceptance, host-set consistency assertion | 需同步修改；实施后 host set 为 9，`FLAT_VALUES`/flat seed set 明确仍为 5；`SERVICE_POINT` 的 flat flags 为 `null` |
| table management gate | rule catalog + `StoreOperatingRuleGate`/`BusinessEntityService`；既有 token generator source 仅负责上一批 command 闭集 | 新组织 owner keyed gate、既有 token Java/resolver keyed marker、existing catalog/inventory/sales-menu/asset regression、operations owner mutation mapping | 需同步修改；新组织不进入旧 token chain，旧 gate semantics 不变 |
| organization tables | new Flyway migrations | persistence SQL/row mappers, constraints/index focused tests, seed executor | 需同步修改 |
| asset usage/typed target | `SalesMenuAssetUsage`/asset usage source + new typed target | staged_asset check, asset service adapter, organization point `image_asset_ref`, asset acceptance | 需同步修改；不新建资产表 |
| admin page/action | `contracts/catalog/admin-catalog.json` | `catalog-admin-p3`, `generatedAdminCatalog`, page registry, `OperationsApp` icon, capability | 需同步修改 |
| UI model/surfaces | new `features/store-service-point` | foundation consumers, test IDs, focused/static tests, no L2 until admission | 需同步修改 |
| audit | `AuditChange` explicit state + `OrganizationAuditHistoryService` | audit projection/read labels, organization point producer, existing organization audit regression | 需同步修改 |
| seed | `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`；`scripts/dev/r5-seed-plan.mjs`；`scripts/dev/owner-command-seed-executor.mjs`；`scripts/dev/r5-complete-seed-executor.mjs` | host set/fixture shape、stage order、reset/seed report、owner readback assertions、acceptance fixture identities | 需同步修改；baseline host 8 → 9，`FLAT_VALUES` 仍为 5；QR config 在渠道阶段 post-step 写入；只设计不执行 |

本表是当前设计的完整同步分母；任何实施前新发现的同根 consumer 必须先补表再改代码。generated 文件一律判为“由生成链派生”，不得手改。

## 9b. 变更定位

实施者按稳定锚点定位，不按本文件未来行号：

- OpenAPI：`operationId`、path、schema key、`x-owner-module`、`x-consumer-faces`；
- catalog：`PG-STORE-SERVICE-POINT-QR`、`EDIT_STORE_SERVICE_POINT_QR`（与既有门店页的域前缀 + STORE 形态一致，最终 key 仍需保持 source 唯一）；
- organization：`StoreServicePointOwnerApi`、`StoreServicePointArea`、`StoreServicePoint`、`StoreQrConfiguration`、`page...`/`save...` 方法；
- channel：`BusinessChannelOwnerApi.listQrChannelCandidates`、`deriveQrServicePointUrl`、template `urlRule` projection；
- asset：`STORE_SERVICE_POINT_IMAGE`、`StoreServicePointAssetTarget`；
- frontend：`StoreServicePointPage`、`AreaDrawer`、`ServicePointDrawer`、`QrConfigurationDrawer`、`ServicePointDetailDrawer`、`storeServicePointTestIds`；
- seed/acceptance：fixture keys、scenario `id`、`OrganizationAcceptanceScenarios` methods。

## 10. 数据迁移

迁移文件名是实施时的唯一新文件名；执行前先搜索同版本，发现冲突停在 source reconciliation，不自行改历史 migration。

### 10.1 组织表迁移

拟新增：`apps/backend/catering-business-server/src/main/resources/db/migration/V20260917_000000_000__store_service_point_qr.sql`。

表与约束：

1. `organization.store_service_point_area`：`area_ref`、workspace/group/store identity、`code`、`name`、`area_type`、`display_order`、`status`、`version`、timestamps；FK 带 workspace/store；check type/status/order；active code partial unique；排序查询索引。
2. `organization.store_service_point`：`service_point_ref`、workspace/group/store identity、`area_ref`、`code`、`name`、`point_type`、`display_order`、`status`、`seat_capacity`、`table_shape`、`reservable`、`image_asset_ref`、`extension_values JSONB NOT NULL DEFAULT '{}'`、`extension_rule_revision`、version/timestamps；FK 带 workspace/store/area；active store code partial unique；`(area_ref, display_order)` index/unique；TABLE/SCAN nullability check。
3. `organization.store_qr_configuration`：`store_ref` primary key、workspace/group identity、`enabled BOOLEAN NOT NULL DEFAULT FALSE`、`channel_ref UUID NULL`、version/timestamps；store FK；不存 URL。

对既有 store 逐行插入默认 QR singleton（false/null），新建 store 的 organization owner 同一事务插入 singleton；不为既有 service point 回填，因为当前仓不存在该实体。若当前 organization store table 的真实 FK/identity 形态与此表述有差异，实施者必须以当前 persistence 为准停下并更新详设，不创建隐式跨 schema FK。

### 10.2 渠道/资产迁移

拟新增：

- 同一迁移中的 `url_rule`：给 `business_channel.business_channel_template` 添加 nullable `url_rule`，目标模板为空合法；现有 rows 不回填业务值。
- 同一迁移中的 asset usage 变更：仅把 `STORE_SERVICE_POINT_IMAGE` 加入现有 staged asset usage closed set；不创建 `platform_asset.store_service_point_asset_target` 或任何新的资产表，service point 的 `image_asset_ref` 承担唯一业务关联。

迁移顺序必须先于对应 owner 使用；不得修改或删除已有 sales-menu/catalog asset target 表，不得把 URL 或 QR entity ref 加进 point 表。

## 10b. seed 数据（只设计，不执行）

### 10b.1 受影响 seed 全集

| source/executor | 必须同步的事实 |
| --- | --- |
| `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | stable fixture 正本增加 `SERVICE_POINT` definition；本功能写入的 store 显式设置 `catalogManagementEnabled=true` 与 `tableManagementEnabled=true`；声明区域、TABLE/SCAN point、QR singleton、一个合法 QR template/channel、URL rule shape、TABLE image fixture 元数据 |
| `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs` | 同步 extension host 从 8 到 9，`FLAT` 仍为 5，`SERVICE_POINT` 的 `listDisplay/searchable` 为 `null`；owner-command 通过 operations owner commands 按“定义 → organization store → areas → points → status transitions”顺序写入，不在渠道存在前写 enabled QR config；不以直接 SQL 替代业务 owner |
| `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` 与 executor | 让合法 QR template/channel 先满足 business-channel owner 前提；内部渠道 binding 明确 `NOT_REQUIRED` |
| `scripts/dev/r5-complete-seed-executor.mjs` / `scripts/dev/r5-seed-bootstrap.mjs` | 保持既有四阶段及顺序，不把 service-point 数据塞进 bootstrap root SQL；`external-collaboration-business-channel` 阶段完成 channel owner readback 后执行 organization owner 的 QR config save post-step，不新增第五阶段 |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java` fixtures | acceptance 使用隔离 fixture identity，不依赖 DEV seed 中的 ref；必要时抽出稳定 fixture builder |
| `scripts/dev/r5-seed-plan.test.mjs`、各 executor tests | red mutation：缺少合法 QR candidate、SCAN 带 image、point/area type mismatch、QR enabled 无 channel、operating gate 未开启 |

### 10b.2 两类改动分开写

- 业务 seed：区域、桌台/扫码点、QR singleton、channel/template、extension definition、桌台图片 stage/claim/readback；必须由 owner command 产生审计/receipt/readback。
- 清理/报告：由现有 reset/seed runner 负责隔离 namespace、staged asset cleanup、报告和受管资源闭合；本批不添加退役的 compliance-control 台账。

### 10b.3 覆盖判据

- 至少有 `TABLE_AREA + TABLE` 与 `SCAN_AREA + SCAN` 正向组合；两种反向组合由 acceptance 构造并拒绝。
- 至少有区域 ENABLED、DISABLED、VOIDED 与 point 三态矩阵；关闭/重新启用保留 point storage。
- QR 有 false/null 初始；在 `external-collaboration-business-channel` 阶段完成合法 channel owner readback 后，再由 organization owner 写入 true/合法 channel；URL empty/invalid candidate、selected channel status mutation 由 acceptance 覆盖。
- TABLE 有成功图片 claim 与失败 release；SCAN fixture 和 request 均没有 image。
- seed owner readback 以真实 store/area/point/QR refs 断言，不把文件存在当作业务成立。

### 10b.4 同步项

任何新增 fixture 字段必须同时更新 fixture schema/plan、executor、executor test、acceptance fixture builder 和报告 readback；任何 URL rule/host/type/operating-rule 字段不得只写在 seed JSON 而不经过 owner。host consistency proof 必须比较 `ExtensionHostTypes.VALUES`、`ExtensionDefinitionService.MANAGEMENT_HOST_TYPES`、`r5-seed-plan.mjs` 与 `owner-command-seed-executor.mjs` 的集合：实施后均为 9，管理有序列表为既有顺序追加 `SERVICE_POINT`，`FLAT` 仍为 5；同步清单逐一核对 `scripts/dev/r5-seed-plan.mjs` 与 `scripts/dev/owner-command-seed-executor.mjs` 的 `definitions.length !== 9` guard，并保持为 9；分别删除任一声明中的 `SERVICE_POINT` 或把任一长度 guard 改回 8 的 red mutation 都必须失败。

### 10b.5 边界

本阶段已按 Dexter 的运行授权执行受管 reset、DEV、seed；DEV start/restart 仍未 seed。执行结果、manifest、日志与 cleanup 分开记录在实施收口对账中：`doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md`。

## 11. 验收场景设计

本节遵循 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`。场景必须落在已有 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/OrganizationAcceptanceScenarios.java`、`BusinessChannelAcceptanceScenarios.java`、`AssetAcceptanceScenarios.java`、`ExtensionAcceptanceScenarios.java`、`AuditAcceptanceScenarios.java`；不把 Journey ID 写进 runtime/test 名称。每条场景的四个字段必须非空：`identity`、`fixture`、`request`、`businessOracle`。

### 11.1 HTTP operation → scenario 精确矩阵

本批新增或语义发生变化的 HTTP operation 分母固定为 20：organization 13 个、business-channel candidate 1 个、template create/update 2 个、platform extension 既有读写 2 个、asset stage/release 2 个。下表逐个 operationId 绑定至少一个 owning scenario；一个 operation 可由多个场景共同覆盖，但不得出现未登记 operation 或只按能力名抽样。`requireQrChannel`、`deriveQrServicePointUrl`、`claimStoreServicePointImage` 是内部 owner/事务方法，没有独立 HTTP path，不计入本表；它们必须由对应场景的 `businessOracle` 单独观察。

| operationId | owning scenario id |
| --- | --- |
| `getOperationsStoreServicePointAreas` | `storeServicePointAreaLifecycle`, `storeServicePointAreaAvailability` |
| `getOperationsStoreServicePoints` | `storeServicePointAreaAvailability`, `storeServicePointOrdering` |
| `getOperationsStoreQrConfiguration` | `storeQrConfigurationLifecycle`, `storeQrGenerationStateIndependence` |
| `getOperationsStoreServicePoint` | `storeServicePointTableAttributes`, `storeServicePointExtensionHost`, `storeServicePointAudit`, `storeQrUrlDerivation` |
| `postOperationsStoreServicePointArea` | `storeServicePointAreaLifecycle`, `storeServicePointGateAndRoles` |
| `patchOperationsStoreServicePointArea` | `storeServicePointAreaLifecycle`, `storeServicePointAreaAvailability`, `storeServicePointGateAndRoles` |
| `postOperationsStoreServicePointAreaStatus` | `storeServicePointAreaAvailability`, `storeServicePointGateAndRoles` |
| `postOperationsStoreServicePointAreaOrder` | `storeServicePointOrdering`, `storeServicePointGateAndRoles` |
| `postOperationsStoreServicePoint` | `storeServicePointTypeCompatibility`, `storeServicePointTableAttributes`, `storeServicePointExtensionHost`, `storeServicePointTableAssetLifecycle`, `storeServicePointGateAndRoles` |
| `patchOperationsStoreServicePoint` | `storeServicePointTableAttributes`, `storeServicePointExtensionHost`, `storeServicePointAudit`, `storeServicePointTableAssetLifecycle`, `storeServicePointGateAndRoles` |
| `postOperationsStoreServicePointStatus` | `storeServicePointAreaAvailability`, `storeServicePointAudit`, `storeServicePointGateAndRoles` |
| `postOperationsStoreServicePointOrder` | `storeServicePointOrdering`, `storeServicePointGateAndRoles` |
| `patchOperationsStoreQrConfiguration` | `storeQrConfigurationLifecycle`, `storeQrConfigurationOwnerRecheck`, `storeQrGenerationStateIndependence`, `storeServicePointGateAndRoles` |
| `getOperationsStoreQrChannelCandidates` | `storeQrChannelCandidatePredicate`, `storeQrChannelBoundedRead` |
| `createOperationsBusinessChannelTemplate` | `businessChannelTemplateQrUrlRule` |
| `updateOperationsBusinessChannelTemplate` | `businessChannelTemplateQrUrlRule` |
| `getExtensionDefinition` | `storeServicePointExtensionHost` |
| `replaceExtensionDefinition` | `storeServicePointExtensionHost`, `storeServicePointAudit` |
| `stageStoreServicePointImage` | `storeServicePointTableAssetLifecycle`, `storeServicePointGateAndRoles` |
| `releaseStagedStoreServicePointImage` | `storeServicePointTableAssetLifecycle`, `storeServicePointGateAndRoles` |

| 场景能力名 | owning scenario group | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| `storeServicePointAreaLifecycle` | Organization | PROJECT session + STORE target | one store, two areas, no active points then one point | create area, update/status, page read | area ref/store identity/type/status/order/version；VOIDED code reuse；无物理 delete |
| `storeServicePointTypeCompatibility` | Organization | PROJECT and STORE sessions | TABLE_AREA/SCAN_AREA + both point types | four create requests | 两合法组合 readback success；两不合法 owner problem；DB unchanged |
| `storeServicePointOrdering` | Organization | STORE session | three ordered areas and points | move first/last/middle up/down | order readback adjacent swap；first up/last down rejected/disabled；同门店隔离 |
| `storeServicePointAreaAvailability` | Organization | PROJECT session | two areas; each with ENABLED/DISABLED/VOIDED point | area status transitions + reads | all descendants effective unavailable under parent; point stored status/ext/image unchanged; re-enable restores |
| `storeServicePointTableAttributes` | Organization | STORE edit capability | TABLE + SCAN points | table attrs update and scan forbidden body | table values read back; scan no table field accepted/stored; reservation rule not queried |
| `storeQrConfigurationLifecycle` | Organization | PROJECT and STORE sessions | QR singleton false/null + eligible channel | get/patch off/null and on/channel | singleton version/readback; on requires channel; off null legal; config independent from rule JSON |
| `storeQrChannelCandidatePredicate` | BusinessChannel | current store owner session | four one-dimension mismatch channels + enabled valid + internal unbound | dedicated candidate GET | only exact four dimensions + both ENABLED returned; internal NOT_REQUIRED included; no client filtering |
| `storeQrChannelBoundedRead` | BusinessChannel | operations session | 100 and 101 eligible candidates | candidate GET | exact 100 returns nextCursor null; 101 typed invariant problem, no truncation |
| `storeQrConfigurationOwnerRecheck` | Organization | STORE session | eligible channel, foreign channel, changed-status channel | patch with each channelRef | store relation/four dimensions/status rechecked; invalid rejected; old config retained |
| `businessChannelTemplateQrUrlRule` | BusinessChannel | project template editor | target/non-target templates | create/update URL rule | target empty/valid accepted; each of four non-target dimensions rejected; audit/readback contains rule |
| `storeQrUrlDerivation` | Organization + BusinessChannel | read-capable PROJECT session | point + templates for six URL forms | update URL rule then read point | five legal forms + percent encoding exact URL before fragment; same-name params canonical; no URL persisted; rule change changes read result |
| `storeQrGenerationStateIndependence` | Organization | STORE session | QR enabled selected channel then channel/template disabled/voided | status mutations + point read | QR still generated when final URL valid; config not cleared; no fourth state block |
| `storeServicePointExtensionHost` | Extension + Organization | platform-admin definition editor then STORE operations | SERVICE_POINT group-workspace definition and TABLE/SCAN points | define/read/write extension values | definition host visible; point values persisted/read; no dynamic columns/search; key/label snapshot |
| `storeServicePointAudit` | Audit/Organization | authorized operations session | point core/ext/image changes, missing/null/clear/value | create/update/clear/status/detail/history | four states, label snapshot, truncation; historical row readable after definition change; no unknown-key loss |
| `storeServicePointTableAssetLifecycle` | Asset + Organization | STORE edit capability | one image, one failed save, one SCAN | stage/claim/release via real HTTP | success asset active/readable and organization point `image_asset_ref` is bound; failure no orphan; SCAN path has no image; gate-off stage/release are separately rejected by `storeServicePointGateAndRoles` |
| `storeServicePointGateAndRoles` | Organization | GROUP/REGION/PROJECT/STORE sessions | enabled/disabled store rule + stable rows | reads and every mutation direct HTTP | all four roles read/write per capability; direct all mutations rejected; reopen retains data |

V-1 的前端 focused proof 单独验证 disabled page sends no list request；该观察不混入 HTTP 场景的 `businessOracle`，避免把页面请求行为误计为 owner operation 的业务断言。

Focused commands, to be run only after implementation authority and step-level/overall three-dimensional reconciliation are complete:

```text
scripts/test/backend-acceptance --operation storeServicePointTypeCompatibility
scripts/test/backend-acceptance --operation storeQrChannelCandidatePredicate
scripts/test/backend-acceptance --operation storeQrUrlDerivation
scripts/test/backend-acceptance --operation storeServicePointTableAssetLifecycle
scripts/test/backend-acceptance --operation storeServicePointGateAndRoles
scripts/test/backend-acceptance --all
scripts/verify
```

每次受管动态运行必须单独报告 `CONTRACT`、`BUSINESS`、`DB_OPERATIONS` 和 cleanup；不得把 scenario status、response.ok 或无异常当作 business oracle。若出现同一 `failureCategory` 第二次，先停止该失败族并回到日志/owner broken boundary。

## 12. 未决项处置

当前没有待 Dexter 产品裁决项；以下实现选择已经把需求开放项收口为最小形态：

1. 区域与 point 都采用 cursor/固定 20，复用 SalesMenuPage；不新增拖拽或全局排序。
2. QR candidate 采用独立 bounded operation，不改变两个既有 channel usages。
3. URL 参数名固定为 `groupWorkspaceKey`、`servicePointRef`；同名已有参数移除后 canonical 追加；fragment 保持末尾。
4. `SERVICE_POINT` 加入管理 host/闭集但不加入 `FLAT_VALUES`；本批不做动态列和类型化搜索。
5. TABLE 图片单值采用既有 collection editor `maxImageCount=1` 与 typed command target；organization point 的 `image_asset_ref` 是唯一关联，不新建 asset storage 或 target association table。
6. 扫码点不含图片；其 Drawer 不渲染 image field 或 disabled placeholder。
7. “清空区域”通过 point 行的独立作废命令完成，不新增一个未被用户明确要求的批量删除/清空 operation；区域类型更新仍由 owner 以未作废 child count 最终裁决。若 Dexter 另要求一键批量作废，必须创建新的产品/范围裁决并重算 gate 分母。

以下不是未决，而是实现时的硬停机条件：真实源码若没有可以安全扩展的 asset stage/claim/release core、organization owner 无法在同一事务锁定 point 并以 `STORE` target 完成 claim、无法让 PROJECT/STORE 两类角色读取，或现有 URL parser 无法同时满足 D-10/D-12 的单一谓词，不能由实施者自行新增 asset target 表或 fallback；回到 Dexter/设计 review。

## 13. 停机条件

只有下列情况可以停在本批，不以“实现工作量大”停机：

- 需求、IA、交互、详设不变量互相冲突，且不能在已授权文档范围内消除；
- owning source 与设计前提不符，修复会改变已裁决产品语义、既有 operation 语义或 owner 边界；
- 完成某条硬约束必须触碰 `AGENTS.md` 明令禁止的 Heritage、退役 compliance-control、Git、运行边界；
- 运行阶段的网络/远端主机等硬约束确实不可达，且已保留 first failure、日志、PID/manifest、broken boundary 和 cleanup 结果。

不因为 reviewer、旧文档或上游数字而直接采信；先按源码、生成器、编译器和可复现实验核验。可在本批文档/实现授权内修复的不变量冲突是修复任务，不是停机理由。

## 13b. 实施节奏与三维对账

未来获得实施授权后按实施计划 P0–P9 执行。每个 CP 完成后、进入下一个 CP 前，由 fresh 独立子 agent 做三维证伪式对账，三个维度必须同时覆盖：

1. 需求正本：业务目标、裁决、范围和不做边界；
2. 详设/IA/交互：本 CP 的 RECALL、动作、位置、文案、状态、失败/恢复、owner、集合形态和 focused proof；
3. project-memory：六维 recall 命中的全部设计规范与反例边界。

对账要逐条比较行为、形态、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界。任一 OPEN 先由主 agent 做根因修复，再由新的 fresh reviewer 复查；不能把 OPEN 累积到全链测试。

全部 CP 完成后、第一次整体测试前，再做一次全批整体三维对账；这不是各 CP 对账的汇总，专门检查跨 CP 的 gate、URL、asset、audit、generated wire 和 UI 事实是否出现漂移。

## 13c. 逐代码与详设对账（交付前置门）

这是实施后交 Dexter/Claude review 前的最后一道门，不等同于三维对账。主 agent 逐行打开所有本批实际修改/新增的生产代码、测试、契约、生成物、migration、seed 和前端代码，与本详设逐条对账，范围不得抽样，至少覆盖：

- 每个 operation 的 path、face、owner、scope、集合形态、参数、成功 readback、problem/error registration；
- 每个 organization/channel/asset write 的 owner、事务、锁、receipt、version、audit 和失败补偿；
- area/point type、tri-state、code reuse、order、gate、QR candidate/status/generation、URL forms、extension host/value/audit、TABLE-only image；
- 每个 UI screen 的位置、动作、业务文案、真实 testId、foundation lifecycle、loading/empty/failed/disabled、invalidation 和 focus；
- seed/fixture/acceptance 的 identity、request、businessOracle、正反例和 cleanup 分离。

执行者：主 agent。结论只允许：

```text
逐代码与详设对账=MATCHED
```

或

```text
逐代码与详设对账=OPEN
```

有任何 `OPEN` 必须先修根因并重新逐代码对账；不得以“测试已通过”替代。当前本批逐代码与详设对账结果为 `MATCHED`，逐项记录见 `doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md`；全仓 `scripts/verify` 的既有 backend Spotless 基线失败另行单列，不改写为本批功能 PASS。

## 14. 交付前自查

- [x] 真正业务问题、至少三个方案、采用理由已写。
- [x] CP、owner、事务、失败与恢复、读写边界已写。
- [x] 模板要求的横切机制行集全部保留，且每行有精确能力、可执行观察、无现成能力时的先例形态与本批适用全集。
- [x] IA 与交互工件的二维码主页面、Drawer、销售菜单列表、顺序位置、业务术语、扫码点无图片、统一 dirty guard 口径一致。
- [x] R-1.1 至 R-7.4 逐条映射到 owner 判定点。
- [x] 新 HTTP operation 已绑定 `identity/fixture/request/businessOracle` 和 owning acceptance group；动态命令只在授权后运行。
- [x] `SERVICE_POINT` 未加入 flat host；QR generation 与 candidate status predicate 分离；URL 不落库。
- [x] seed、migration、generated chain、organization point asset ref、audit regression 与 P9 逐代码对账均有计划落点。
- [x] Claude 静态 DESIGN review：上一轮 NO-GO 的 M-01、S-01、S-02、N-01 已按当前字节处置并纳入实施；本文件不把处置记录当作独立 verdict。
- [x] fresh 独立 IMPLEMENTATION review：Hubble 已基于当前字节完成 fresh 只读复审，结论为 `GO/M/S/N=0/0/0`；Browser L2、UAT、部署仍为 `NOT_AUTHORIZED/NOT_RUN`，不以主 agent 收口替代独立 reviewer。
- [x] Dexter 本轮直接授权实施及受管 reset/DEV/seed；Browser L2、UAT、部署和 Git 仍未授权。

## 15. 实施后状态（当前字节）

本详设对应的生产代码、契约/生成物、migration、测试、受管 backend acceptance、reset、DEV 与 `r5-full` seed 已完成；`doc/review/platform/2026-09-18-v2s-store-service-point-qr-implementation-reconciliation-codex.md` 记录当前逐代码与详设对账为 `MATCHED`，并保留业务与 cleanup 的分层结果。

修复前 fresh 独立 reviewer 的 `REVIEW_TARGET=IMPLEMENTATION` 结论为 `NO-GO`、`M/S/N=1/2/1`；四条 finding 已按 owning source 修复，处置记录见对账 §4.4。该修复前结论不作为当前最终 verdict；Hubble 已对修复后的当前字节完成 fresh 独立静态 implementation review，结论为 `GO/M/S/N=0/0/0`。

当前运行状态为受管 DEV 已 PASS 启动并完成最终 seed；Browser L2、UAT、部署和 Git 仍未授权。全仓 `scripts/verify` 的既有 backend Spotless 基线首败与本机 Docker-backed 测试入口 guard 失败均已按失败纪律单列，不升级为本批功能失败或 PASS。

最新 fresh 静态 reviewer Faraday 对当前字节提出 `NO-GO/M/S/N=1/0/0`：QR 展示没有落实 `effectiveAvailable=false` 时不展示二维码，且把合法 URL 当作普通文本。该 finding 已由主 agent 按 R-2.8、R-6.14、IA/交互 §4.3/§10、Gate-1.9/Gate-5.4 重开确认并修复；当前 renderer 先处理不可用边界，可用合法值复用 Ant Design `Typography.Link` 作为「查看二维码」入口，列表与详情共用，D-12 生成事实保持不变。新增静态边界测试。

Hubble 对该修复后的当前字节完成 fresh 独立静态 implementation review，结论为 `GO/M/S/N=0/0/0`；确认列表/详情统一 availability 门控与入口、D-12 后端生成事实、`qrResultLink` 绑定以及其余 owner/权限/资产/审计闭包均无新的阻断 finding。Browser L2、UAT、部署仍为 `NOT_AUTHORIZED/NOT_RUN`。
