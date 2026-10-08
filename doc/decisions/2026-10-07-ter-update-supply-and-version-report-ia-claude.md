# TER 更新供给与主机版本报告：阶段 B IA

### 2026-10-07 Dexter 最新裁决（覆盖旧报告方案）

1. 报告存 CBS PostgreSQL，由 `terminal-update` owner 写入；运营右 Tab 可按门店和当前实际版本查询。Dexter 最终更正“仅包含启用”：范围为当前项目 **启用门店下的启用终端**，停用/作废均排除；未报告终端仍有列表行。显示门店名、终端名、实际版本、最新升级报告状态，点击终端打开标准详情 Drawer，显示最新报告及历史报告。
2. 上传成功且解析校验成功后才可保存；按钮名称统一“保存”，之前禁用。HOT 还必须选定与声明五事实完全匹配的最小 FULL。换文件、解析失败、stage 过期或上下文改变立即撤销旧保存资格。
3. 升级报告经 CBS HTTP 上报；失败正文缓存到升级 owner 的持久化 state。TDC 对有效匹配 PONG 发公开本机广播 command，业务 actor 消费后重试自己的未发送内容。TDC 不保存其他 owner 的失败正文，广播不证明 CBS HTTP 成功，不通过报告失败重连 TDS。
4. N/M 界面单位为分钟；InputNumber 正整数分钟 1～1440 为本设计的有限参数，canonical/API/持久字段仍明确为秒，提交乘 60、读取除 60，服务端检查 60～86400 且为 60 的倍数；正常 DEV 用 N=5/M=10 分钟，边界值只进 acceptance fixture。
5. 运维保留 APK、JS、runtime、构建号、applicationId、publicationId、摘要等真实技术字段；不得暴露凭证、下载 grant 或原始异常。
6. 规则详情增加“操作历史”，复用标准审计能力，不新建审计流水/弹窗容器/operation。

后续直接确认：“每个更新任务一条报告”。阶段变化更新同一任务记录，历次任务保留；每次 HTTP 重送与心跳不新增历史行。此前“包含启用和停用”的答复已被“仅包含启用”覆盖，不作为当前输入。

正式需求 R-15 中旧双后台、最后值而无任务历史、TDS 上报路径由上述直接裁决覆盖。本轮只改 B 设计包及 intake；需求正本、开发规范、项目记忆、A、源码均不修改。未来实施授权须覆盖正式来源同步与终端标准唯一正本中的心跳触发重试条款；当前仍无实施或运行授权。大致 IA 已确认，本次新增历史/筛选/审计细节为修订设计，未冒充逐控件看图或动态 PASS。

## 1 · 元数据

```text
STATUS=PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
IA_SCOPE=PKG-LIST,PKG-UPLOAD,PKG-DETAIL,RULE-LIST,RULE-CREATE,RULE-DETAIL,RULE-STATUS,PROJECT-REPORT,PROJECT-REPORT-DETAIL,RULE-AUDIT
BUSINESS_SOURCE=doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md
UI_INTERACTION_REF=doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-10-07_SCOPE_APPROXIMATE_IA_DYNAMIC_NOT_RUN
IMPLEMENTATION_AUTHORITY=false
```

## 1.1 · 页面与页内交互的层级（Dexter明确）

本批只新增两个管理后台内容页、两个页面路由。IA-ID是评审定位用的页内交互标识，不是独立页面；规则审计是新增的标准附属Modal。

| 新增内容页 | 内部层级 | 页面路由 |
| --- | --- | --- |
| 运维管理后台：终端更新包 | 包列表；上传/保存Drawer；包详情Drawer | /platform/terminal-update-packages |
| 运营管理后台：项目终端版本管理 | 左“更新规则”Tab及新建Drawer/〈规则目标标题〉 · 版本规则详情Drawer/启停确认Modal；右“终端更新状态”Tab及报告详情Drawer | /operations/:groupWorkspaceKey/terminal-update-rules |

Tab、Drawer、Modal均依附宿主内容页，不另建页面、菜单或路由。控件/权限/线框仍逐交互描述，不能从交互标识数推导新增页面数。

## 2 · 逐交互面后台、页面位置、控件与权限（Dexter确认面）

下表是拟实施的完整导航，不表示菜单已存在。运维管理后台=platform-admin；运营管理后台=operations-admin，不互换。后台职责与运营双Tab安排已由Dexter确认，2026-10-07 Dexter确认大致IA，继续详设/计划；当前页面与交互安排按已展示工件执行，实际UI仍NOT_RUN，IA_ACCEPTANCE=CONFIRMED_BY_DEXTER。

**共用权限准入：**

- P：有效platform session＋enabled platform administrator；集团空间由现有WorkspaceScope唯一选择并验证。平台不新增workspace capability。选择空间只定位，owner仍复核真实空间；未选择提示“请先选择集团空间”，身份/范围拒绝显示结构化错误。
- O-P：有效operations workspace session＋新页面 `PG-PROJECT-TERMINAL-VERSION-RULES` 的页面访问授权＋当前实际PROJECT读节点；requiredDataNodeType=PROJECT，grantableRoleNodeTypes为GROUP/REGION/PROJECT，服务端workspace-read及目标项目范围复核。无页面授权不显示菜单且直接导航拒绝；有页面授权无项目时由既有左下角数据节点选择器引导，页面不再造项目选择器。规则写W-P另要求具名 `MANAGE_PROJECT_TERMINAL_VERSION`、SELECTED_PROJECT_SCOPE与owner当前grant复核；页面读权限不能由写cap代替。


| 交互ID（非页面数） | 管理后台、菜单/页面、完整用户入口 | 宿主与实际控件/复用 | 页面/内容读权限 | 每个写动作权限与无权限表现 |
| --- | --- | --- | --- | --- |
| PKG-LIST | 运维管理后台→新增一级菜单“终端更新包”→更新包内容页；`/platform/terminal-update-packages`，pageKey `PLATFORM-TERMINAL-UPDATE-PACKAGES`，紧随组织/合同总览，同级平面导航，不另造分组壳 | 现有ProTable（自带标准查询/列表）、类型Select、应用/运行版本Input、查询/重置/上传Button；useCursorStack/CursorPagination/adminListState；标题Button打开详情 | P；当前空间包page | “上传更新包”仅P可用；无有效身份整页拒绝；无空间阻止请求，非隐藏成空包库 |
| PKG-UPLOAD | 运维管理后台→终端更新包→“上传更新包”→保存Drawer | 现有Drawer/Form/Alert/Descriptions、真正input type=file、FULL候选Select、取消/保存Button；adminDrawerSurfaceProps/useDrawerFormLifecycle/createContentIdempotencyKey/digestFileContent/useCursorCandidates | P；解析结果和同空间最小FULL关联候选 | 上传/保存/释放旧stage均P＋本actor/空间stage ownership；未解析/不匹配禁保存；scope变立即失效，释放只针对旧自有stage，不写新空间 |
| PKG-DETAIL | 运维管理后台→终端更新包→点击目标标题→只读详情Drawer | Drawer＋Descriptions＋关闭Button；adminWideDrawerSurfaceProps/adminWideDetailDescriptionsProps/useDetailDrawer | P＋artifact实际空间复核 | 无mutation；不增加编辑/替换/删除/空“操作”菜单 |
| RULE-LIST | 运营管理后台→既有“门店经营”分组→新增“项目终端版本管理”；稳定 `/operations/:groupWorkspaceKey/terminal-update-rules`；pageKey PG-PROJECT-TERMINAL-VERSION-RULES，NAV-STORE-OPERATIONS，order=315，置于现有门店终端管理（order=310）之后；项目仅来自queryContext；同页左“更新规则”Tab，右“终端更新状态”Tab | Tabs/ProTable、状态Select、应用Input、创建时间RangePicker、查询/重置/新建Button、CursorPagination；contextScopedQueryArgs/adminListState | O-P；规则page/detail GET不要求W-P | 新建需W-P，无W-P隐藏新建入口但保留读列表/详情；直接写请求仍由owner拒绝 |
| RULE-CREATE | 运营管理后台→门店经营→项目终端版本管理→“更新规则”Tab→“新建规则”→Drawer | Drawer/Form、目标类型Select、包候选Select、门店范围Radio.Group、分页门店多选Select、初始状态Select、N/M InputNumber、HOT策略Radio.Group、说明Input.TextArea、保存/取消Button；wideDrawer/useDrawerFormLifecycle/useCursorCandidates | O-P；工件候选是同空间关联读取、不要求W-P；门店候选实际当前project PagePaged | 新建/保存需W-P；打开后grant撤销，保存失败留输入、零事实；包和范围变化清失效字段；已展示默认停用，IA整体已确认 |
| RULE-DETAIL | 运营管理后台→门店经营→项目终端版本管理→“更新规则”Tab→点击目标标题→只读Drawer | Drawer/Descriptions、指定门店Table＋CursorPagination、header AdminDetailActionMenu、关闭Button | O-P＋rule真实归属；固定refs读使用详设第15个operation，非候选过滤 | 启用/停用入口需W-P且符合当前状态；无W-P隐藏启停，保留可读的操作历史入口；无编辑/delete |
| RULE-STATUS | 运营管理后台→上述详情→“操作”→启用/停用→确认Modal | 现有StatusChangeConfirm，actionLabel=启用/停用，按钮“确认启用/确认停用”与“取消”；面内Alert，提交锁与焦点归还 | O-P＋rule当前读取 | 确认需W-P＋revision/CAS，服务端授权先receipt；拒绝/状态过期留Modal并读回，不自动重派 |
| PROJECT-REPORT | 运营管理后台→门店经营→项目终端版本管理同页右Tab，当前项目启用门店下启用终端 | 标准Tabs/ProTable、门店分页Select、终端名与实际APK/JS/runtime Input、查询/重置、标题Button、CursorPagination | O-P真实PROJECT读，无W-P；NO_REPORT启用终端亦返回 | 无mutation/副机/运维报告入口；actual查询在SQL，不用target |
| PROJECT-REPORT-DETAIL | 运营右Tab点击终端名称→标准只读Drawer | Drawer＋Descriptions＋历史Table/CursorPagination＋关闭Button/useDetailDrawer | O-P＋启用门店/启用终端真实PROJECT归属；detail与history GET无W-P | 最新/历次任务报告、未知/无任务/旧绑定分开；无安装/手工retry |

### 2.1 · 与现有两后台规范/目录的可核对关系

| 约束 | 每屏落点与检查 |
| --- | --- |
| frontend §3-H、corpus G-10路由/上下文 | platform新路由无空间编码；operations可带groupWorkspaceKey但无project/storeRef；既有壳唯一空间/数据节点选择器，query含session/context identity；两个内容页及全部页内交互换scope清旧读模型/overlay |
| §3-B/3-D/3-E | 所有读屏currentData/isFetching，空/加载/拒绝/错误不同；写拒绝在当前Drawer/Modal，服务器实体只有RTK读模型，无第二镜像 |
| §3-F、foundation charter、§3-K | 上述所列真实foundation导出逐交互面消费，不复制dirty/overlay锁/分页/HTTP/确认面。surface尺寸、按钮位置/危险色、状态文字、键盘/focus/TestId遵UI §1.2，不能从旧页面的不规范控件推导豁免 |
| §3-G、3-I、3-J | 内容幂等键；包/规则首列为application/目标版本可辨标题并打开详情；所有内容Tab接shell统一刷新，已开只读详情同步回读，不重置未提交表单 |
| §3-K编辑/只读差异 | 编辑Drawer统一useDrawerFormLifecycle，dirty/关闭提示唯一owner；详情仅header操作菜单、标准Descriptions；报告详情复用同标准readonlyDrawer，不自建Card/行展开 |
| catalog/routing/权限生成 | contracts/catalog/admin-catalog.json为页面/导航/动作正本；platform pageRegistry.tsx、operations pageRegistry.tsx与generatedAdminCatalog由本批owning输入同步；页面访问与动作cap分开，PROJECT页面不照搬STORE capability |

当前源码依据：platform `src/app/routing/pageRegistry.tsx` 的组织总览、`OrganizationOverviewDetailDrawer.tsx`；operations `src/app/routing/pageRegistry.tsx` 的organization/store-terminals与现有PROJECT页；foundation `src/index.ts` 的上述导出。新菜单位置是本IA提出的产品安排，大致IA已获Dexter确认，尚未写catalog/源码。

## 2.2 · 逐交互面业务与容器维度

所有交互面 的共同可见约束：键盘可达，字段有label；状态为文字＋颜色，拒绝/加载不当空集合；生成文案不暴露principal、grant、对象key、rawpayload。`doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10 逐交互面适用范围见UI §1.2；列表首列展示标题非技术ref。下面每行与同ID线框相对应，不将Drawer/Modal混为宿主。

| IA-ID | businessTask/actorAndScenario | entryAndSurface/controlType | validationAndError/accessibilityAndTestId | emptyLoadingErrorStates/containerBehaviorUnderLoad |
| --- | --- | --- | --- | --- |
| PKG-LIST | 运维管理员寻找可用工件 | `/platform/terminal-update-packages`内容页；筛选Select、目标标题Button、上传Button、cursor | 已验证空间；PKG_LIST族label/aria；拒绝原位显示 | 尚无更新包/加载/重试；表格分页，长标题省略可展开，表头/分页不越视口 |
| PKG-UPLOAD | 运维管理员上传并核验ZIP | list→上传Drawer；真实file input、readonly解析、HOT FULL候选、保存/取消 | ARTIFACT_INVALID原位原因；实际file input有TestId；键盘选择文件 | 无文件/解析中/拒绝/已解析；单正文滚动，footer固定，文件名换行不撑宽 |
| PKG-DETAIL | 运维管理员确认不可变实际事实 | 标题→readonlyDrawer；Descriptions/关闭 | 不存在/读取失败原位；PKG_DETAIL与close | 读取中/重试；单正文滚动，长摘要换行；无编辑/空操作菜单 |
| RULE-LIST | 业务管理员查看当前项目规则 | `/operations/:groupWorkspaceKey/terminal-update-rules`固定页面；project取context，筛选/标题/新建/cursor | PROJECT主读；无写cap仍读；RULE_LIST族 | 先选项目/尚无规则/加载/错误重试；分页正文不抽干 |
| RULE-CREATE | 有写权限业务管理员表达一次目标 | list→Drawer；包/范围/门店/状态/策略Select、N/M InputNumber、说明Input、保存/取消 | 正整数分钟，提交换算秒、配对/refs拒绝；字段错误聚焦，真实候选控件TestIds | 上游选择清无效下游；提交中锁；失败留输入；单正文滚动footer固定 |
| RULE-DETAIL | 业务管理员读取规则与创建时间 | 标题→readonlyDrawer；Descriptions、“操作”菜单及操作历史 | 主对象读；启停独立cap，历史不要求写cap；RULE_DETAIL族 | 当前data加载/失败；不可编辑；长说明换行 |
| RULE-STATUS | 有写权限管理员启用/停用 | detail操作→Modal；确认/取消 | STALE_STATE刷新实际detail后重选，不自动重派；焦点在Modal | 提交锁，失败留确认面；内容固定无额外长列表 |
| PROJECT-REPORT | 业务管理员查启用门店下启用终端版本/最新任务状态 | 同页右Tab，store/name/actual APK/JS/runtime字段/查询/分页 | O-P；PROJECT_REPORT族真实Input/Button/Text | NO_REPORT仍是有终端行；enabled过滤；读取失败非空，标准单正文滚动 |
| PROJECT-REPORT-DETAIL | 业务管理员读最新及历次任务 | 标准Drawer/Descriptions/Table/CursorPagination/关闭，PROJECT_REPORT_DETAIL族 | 同PROJECT/启用目标；未知原因合法 | 历史页≤100，每task一行；历史错误独立，正文单scroll/footer标准 |

### 2.3 · 不可见维度与执行观察

| IA-ID | stateAndPermission（最低证伪层） | navigationAndRefresh | collectionShapeAndScale | dataSourceAndCascade/forbiddenUI |
| --- | --- | --- | --- | --- |
| PKG-LIST | [acceptance] W1请求W2包page/detail拒绝；platform无需新cap | [组件] 空间切换关闭原详情/暂存，query含session/contextidentity | CursorPaged，page≤100，业务数量无上限；[acceptance]101条能翻页 | owner page；kind/app/runtime条件服务器过滤；禁rawkey/publicURL |
| PKG-UPLOAD | [acceptance] stageRef不是本会话/空间不得claim/release | [组件]替换文件先释放旧stage；保存成功仅失效本空间包/候选 | stage单文件技术256MiB；[owner]超限拒绝不截断 | parser结果readonly；HOT换FULL必须五事实相符；禁用户版本输入/类型猜测/安装包 |
| PKG-DETAIL | [acceptance]真实space+artifact授权，不从旧列表推导 | [组件]关闭不刷新不相关列表，重新打开取currentData | 单对象；文件清单诊断不在屏幕全量铺8192行 | owner事实；禁编辑、替换、手工重试、token |
| RULE-LIST | [acceptance]PROJECT A读B拒绝；无写cap可读A与关联候选 | [组件]project/context变清detail/cursor，不清未变空间包缓存 | CursorPaged；101条，不伪Bounded | rule owner；filters=status/app/创建时间范围；禁drag优先级、用途/机型 |
| RULE-CREATE | [acceptance]撤grant后create零rule/audit；关联candidate无写cap仍合法 | [组件]FULL-only隐藏并清hotStrategy/M；范围ALL清refs，STORE_REFS清旧空值 | 包候选CursorPaged/门店候选PagePaged，不能抽干成全量select；[组件]两页选择回显 | 同空间已校验工件/当前project门店；禁自由ref输入、从主机版本过滤目标 |
| RULE-DETAIL | [acceptance]rule项目归属复核，detail GET不要求写cap | [组件]启停成功只refetch当前project list+detail | 单规则/有界target；指定store refs多时服务器分页关联只读（不以UI截断事实） | createdAt不变；无编辑/delete；配对minFULLreadonly |
| RULE-STATUS | [acceptance]CAS旧revision不写、不审计；重放同payload一事实 | [组件]失败留Modal；成功关Modal、list/detail精准刷新 | 单对象 | owner status command；禁止把启用提示写为设备已升级 |
| PROJECT-REPORT | [acceptance]异PROJECT拒绝，无W-P可读；门店或终端任一DISABLED都排除，未报告ENABLED仍有行 | 切project清Tab/filters/cursor/详情，shell精准刷新 | CursorPaged启用门店＋启用终端LEFT JOIN；101多门店终端/跨页actual过滤 | terminal_report实际值非target；未知/旧binding明确；无假在线/副机 |
| PROJECT-REPORT-DETAIL | [acceptance]PROJECT/启用门店/启用终端真实验证；无W-P可读 | 已开详情遇停用或scope变化清旧事实，历史query绑定同context | 最新单对象＋每task历史CursorPaged；101行分页不抽干 | latest/history不当每阶段流水；actual与历史时点actual分开，无副机 |

新建门店候选复用getOperationsOrganizationCandidates的真实PagePaged模式（queryText/page/pageSize/selectedId/projectId）。固定规则refs详情消费明确的新getOperationsProjectTerminalUpdateRuleStorePage CursorPaged任务读，既有停用/作废refs仍呈现；不能用可选集合过滤固定事实。两页选择/回显及非当前候选引用均有组件/HTTP断言，详设§5冻结DTO/授权/排序。

## 3 · 共用信息规则（与详设同一事实）

snapshot只返回启用规则，但包含项目所有app/platform，不提前按主机过滤。

同project锁先于集合查询，唯一采用事务级PG advisory lock（复用foundation AdvisoryLock.acquire(JdbcTemplate,int,UUID)，传本owner namespaceTag及已验证projectRef；碰撞只串行不越权），不新增跨owner project行锁。

包/规则/项目终端报告/固定refs/工件候选是CursorPaged；复用的organization门店候选是PagePaged，两者分别消费真实协议，不因useCursorCandidates名称改写HTTP事实。数量无业务上限，page≤100，超限typed拒绝；不抽干全量。读节点授权与写cap分开；成员collectionHash同时用于HTTP分页一致性，执行投影排除可变CAS/revision/updatedAt，topic原始时间单列；不是TDP人工version。

集合正常规模与增长驱动逐行按附件§18 G1–G6：PKG-LIST/DETAIL/UPLOAD→G1，RULE-LIST/CREATE/DETAIL/STATUS→G2/G4/G5，PROJECT-REPORT/DETAIL→G3，TER完整snapshot→G6。数字是normal设计输入，不是业务cap。

## 4 · 错误语义/界面

| family | 展示/恢复 | 不可做 |
| --- | --- | --- |
| ARTIFACT_INVALID | 显示有限校验原因，清可用目标；重选文件 | 展示工具stderr或照样保存 |
| PUBLICATION_CONFLICT/MINIMUM_FULL_INVALID | 同内容版本冲突/最小完整更新不匹配，留输入 | 透露其他空间资料/替换旧工件 |
| access/scope拒绝 | 原位禁止本操作、当前读取无旧授权事实 | GET跟着写cap消失、切URL绕权 |
| PLATFORM_COMMON_VERSION_CONFLICT | 原位“状态已变化，请重新确认”并读回detail | 自动重派旧启停 |
| DEPENDENCY_UNAVAILABLE/BUSY | 当前请求失败可重发同内容/幂等键 | 无限任务排队或fake success |
| UNKNOWN/NO_REPORT | 字段未知附原因/尚无报告/无最近更新任务信息分别呈现；后者只表示已收到观察没有recent | 目标当actual、“实时”字样 |


### 4.1 · 实际code的完整恢复映射

精确共同基础文案唯一消费platform `src/app/api/platformProblemFeedback.ts::PLATFORM_PROBLEM_FEEDBACK/platformProblemFeedback` 与operations `src/app/api/operationsProblemFeedback.ts::OPERATIONS_PROBLEM_FEEDBACK/operationsProblemFeedback`，二者Record类型覆盖各自generated闭集。基础码仅取本批AUTHZ_READ/OWNER_COMMAND/TERMINAL_DATA_READ实际闭集，状态对照ContractProblemAdvice（包括owner-invariant/result-unknown为500），不把旧兼容或登录专用码带入本批operation。本批CP-05同步新code中文映射及其focused test；不能把工具stderr/rawpayload/principal/grant打印给用户。基础errorSetRef与新增code完整集合在附件11，表中短family只作说明，不新造code。D§5的ARTIFACT_NOT_FOUND/PROJECT_NOT_FOUND/RULE_NOT_FOUND都使用PLATFORM_COMMON_RESOURCE_NOT_FOUND；STALE_STATE使用PLATFORM_COMMON_VERSION_CONFLICT，不另注册假alias。

| 实际problem code/HTTP | surface/owner与条件 | 保留/失效事实 | 用户反馈/合法恢复 |
| --- | --- | --- | --- |
| PLATFORM_COMMON_AUTHENTICATION_REQUIRED/401 | 各后台所有本批请求；沿各face errorSet真实可达子集 | identity失效，原space/context查询和提交不可再用；原secret不回显 | 复用统一登录恢复，重新进入当前页；不在新身份自动派旧write |
| PLATFORM_COMMON_ACCESS_DENIED/403 | 当前read/write无授权；operations read/writecap分别判断 | 清被拒当前read/选项，不用旧权限提交；write拒绝留非秘密draft但禁当前submit | 统一“没有操作权限”；不把GET随writecap删掉，不换URL绕过 |
| PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403；PLATFORM_COMMON_RESOURCE_NOT_FOUND/404（空间不存在） | 沿各face闭集；全部后台空间前置 | 失效space的stage/选包/旧read不能提交，release仅原identity可验证owner | 统一空间反馈，回既有空间选择；不迁移draft到别空间 |
| PLATFORM_COMMON_CONTEXT_STALE/409 | operations context变化/失效 | 关闭旧context面/失效epoch，不把旧query当current | 统一上下文已变化；重新进入当前项目，不静默改project再派旧请求 |
| PLATFORM_COMMON_VALIDATION_FAILED/422 | 任一表单/query/cursor及平台minimumFull组缺项 | 留当前用户输入、标字段；坏cursor不保留为可继续页 | 统一填写错误；query重置cursor或纠正字段显式提交；仅列表筛选显式query；候选按250ms防抖＋加载更多（不能把一次键入当mutation提交） |
| PLATFORM_COMMON_IDEMPOTENCY_CONFLICT/409 | stage/register/create/status同key异payload | 留本次非秘密draft，不复用冲突key/旧attempt；旧结果不能伪当前成功 | 统一操作请求变化；由既有submission lifecycle为修正内容建新key；非终端工件手工失败重试 |
| PLATFORM_COMMON_RESOURCE_NOT_FOUND/404 | 包/rule/reportdetail/fixedrefs真实目标不存在或异scope | 当前detail变不存在态，不渲染current旧事实；draft失效目标清选项；未知fixedref按DTO原因保留 | 统一资料不存在；列表/候选显式重查，不能制造同ref对象 |
| PLATFORM_COMMON_VERSION_CONFLICT/409 | RULE-STATUS revision已变化 | 保留Modal失败态，读回实际detail，旧revision失效 | “状态已变化，请重新确认”；按真实新status重选动作，不自动重派 |
| PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION/500；PLATFORM_COMMON_RESULT_UNKNOWN/500 | 仅catalog基础集实际暴露；owner状态或提交不明 | 保留原操作identity，未知不标成功；不造第二失败存储 | 统一暂不可用/待确认，按原idempotency operation读回/重放；不执行已禁止的终端任务retry |
| PLATFORM_DEPENDENCY_UNAVAILABLE/503；TERMINAL_UPDATE_BUSY/503 | parse/storage/tool/page/grant；列入实际operation错误集 | 未保存stage不是可用工件；可重放write保持同内容key；grant只owner可见失败 | 当前请求反馈“服务暂时不可用/处理繁忙”；显式重发本请求，无后台无限队列 |
| TERMINAL_UPDATE_ARTIFACT_INVALID/422 | PKG-UPLOAD parse/保存真实文件错 | 此file不能保存，清可提交stage/候选，留原因；资源仅ownedcleanup | “更新包校验未通过”，重选文件，原因有限，不打印工具原文 |
| TERMINAL_UPDATE_PUBLICATION_CONFLICT/409 | PKG-UPLOAD register同runtime同JS不同pub | 留file/解析事实，目标不可保存；不透露其它space | “同版本的发布内容不一致”，更换合法开发工件；不替换已保存包 |
| TERMINAL_UPDATE_MINIMUM_FULL_INVALID/422 | PKG-UPLOAD register五事实不匹配 | 留HOT解析/声明，失效所选FULL及提交资格 | “最小完整更新不匹配”，重新查五事实候选；不得修改readonly声明 |
| TERMINAL_UPDATE_STAGE_NOT_OWNED/403 | register/release旧stage非当前actor/space | 不可claim/release，清本面stage可用资格但不删除未知owner对象 | “暂存文件不可使用”，当前file重新上传stage；旧identity只能回收其确有所有权对象 |
| TERMINAL_UPDATE_STAGE_EXPIRED/409 | register stage到期 | 保留原file引用，旧stage/grant失效，保存禁用 | “暂存文件已过期，请重新上传”，以新stage显式保存；不自动派原请求 |
| TERMINAL_UPDATE_RULE_TARGET_INVALID/422；TERMINAL_UPDATE_SCOPE_MISMATCH/403 | RULE-CREATE/STATUS目标或refs当前不合法，report storefilter越project | 留draft/实际拒绝；清失效目标/跨scope选项，阻止submit；GET旧结果不当当前 | “更新目标不可用/数据范围不匹配”，重查合法候选/项目，不放宽权限或替用户改refs |
| TERMINAL_UPDATE_SNAPSHOT_TOO_LARGE/413 | 后台page或TER完整snapshot技术超限 | 后台错误态不当空；TER保留旧完整快照并标非当前 | 后台“查询结果超出技术容量”及可见请求失败；TERowner reason，无手工安装页/截断，实施侧评估资源 |
| TERMINAL_UPDATE_SNAPSHOT_CHANGED/409 | TER跨页hash变化 | 丢本candidate，旧完整snapshot仍在 | owner有限3次完整重读；耗尽可见失败等下一ready/topic，非后台按钮 |
| TERMINAL_UPDATE_GRANT_EXPIRED/403；TERMINAL_UPDATE_ARTIFACT_NOT_AUTHORIZED/403 | terminal content/grant | transientgrant/attempt失效；持久固定任务仍按A回读，不暴露secret | owner typedreason；仅A有限同工件授权重取/合法失败；不增加admin手工retry |
| STORE_TERMINAL_DISABLED/409；TERMINAL_BINDING_CREDENTIAL_INVALID/403 | TERMINAL_DATA_READ闭集；终端snapshot/grant/report当前credential verification拒绝；状态沿TerminalDataReadProblem而非猜测 | 不接受新快照/不发行grant；旧完整快照保留但非当前；凭证是否清理由TDC既有owner规则决定，不由UI或update包删改 | TDC/update owner可见typed拒绝；report持久暂停，普通PONG/重连不重发，绑定/配置变化清旧pause及pending；后台仍只显示最后真实报告，不增加激活或任务重试入口 |
| TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT/409（拟新增HTTP code） | POST同seq/key/id/body冲突 | 升级owner仅移出identity仍匹配的被拒报告，保留同slice最近递送失败摘要；下一PONG发送后续合法项，旧receipt不能删新项 | 业务失败不触发transport.invalid/stop/connect；后台只观察真实报告，无执行入口 |
| NETWORK_ERROR（无HTTP code） | 后台请求传输失败/响应未知 | query有明确错误不空；write保留原identity/key，不推断已提交 | 复用各face统一网络文案及既有submission未知恢复；no raw异常 |

表中共同码是否由某face/operation暴露完全以canonical errorSetRef＋augmentations为准，不为文案新增无业务拒绝码；CP-01逐op取精确集合并复验状态，CP-05Record闭集＋失效stage/context/详情消失/cap撤销/容量的focused反例守住全映射。HTTP4xx/5xx不得拿来为纯设计缺陷造返回值。

## 5 · 交叉对账

原九个IA-ID＋RULE-AUDIT与UI各自交互surface对应；同一权限、分页、refresh、前置失效条款在设计与计划不另定口径。控件在UI roster，API在详设 §5，生成/test消费在附件 §4。当前仅静态设计，未有组件/acceptance/browser结果。

## 6 · 完成判定

```text
IA_IDS_COMPLETE=10/10（两个内容页内交互面，非十个独立页面）
VISIBLE_DIMENSIONS=§2.2与UI1.1/1.2逐行，非动态PASS
INVISIBLE_DIMENSIONS=§2.3最低执行面，NOT_RUN
ERROR_MAPPING=§4.1逐码＋UI4.2报告值
CROSS_DOCUMENT_READBACK=作者静态回读，非独立verdict
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-10-07_SCOPE_APPROXIMATE_IA
OPEN_PRODUCT_DECISIONS=NONE_FOR_CURRENT_RULINGS（设计仍需外部复核）
IMPLEMENTATION_AUTHORITY=false
```

文档候审完整不等于Journey接受/看图/实施/运行通过。A工程前置、API候选可复用性与targettool版本在实施前准确关闭；新增产品歧义回Dexter，不借接口缺口发明业务入口。

项目页面：左Tab更新规则，右Tab终端更新状态；两Tab都要求O-P读授权，只有规则创建/启停额外W-P。右Tab以organization当前项目终端集合为分母，不以report表为分母；报告缺失返回NO_REPORT。门店筛选候选复用getOperationsOrganizationCandidates当前PROJECT的PagePaged读取；选中storeRef必须再次核实项目归属。编辑Drawer dirty/关闭确认仍只有useDrawerFormLifecycle，Tab/上下文切换消费其locked，不另造dirty提示。运维后台不扩organization-overview报告Tab。

## 7 · 标准控件容器裁定（2026-10-07 Dexter）

“所有的控件都要使用标准的查询、列表、分页、详情抽屉、编辑抽屉等现成控件容器，不得自己再发明”。包库、规则、报告列表使用现有@ant-design/pro-components ProTable及其查询表单；cursor API复用foundation useCursorStack/CursorPagination，禁用ProTable内置页码分页以免双pager。查询字段/列/formatter业务自有，不能新建QueryPanel/ListPanel/分页引擎。上传/新建复用现有Drawer/Form及useDrawerFormLifecycle；包/规则/报告详情复用Drawer+useDetailDrawer+Descriptions；启停用StatusChangeConfirm；Tab用现有AntD Tabs。每屏的标准来源/实际参数及测试落点见附件§10。

## 8 · Dexter确认记录

2026-10-07 Dexter：“大致IA内容已经确认了，可以下一步了”。两个新增内容页及其Tab/Drawer/Modal、后台职责、标准容器与上述权限安排进入后续详设；不是实际UI动态PASS。无新增实施/环境授权。只有后续发现具体产品冲突才另列裁决，不能重复申请相同IA确认。

## 8 · RULE-AUDIT与报告查询/历史的差量维度

| IA-ID | 后台/入口与容器 | 读/写权限 | 可见/失败/刷新 | 最低执行观察 |
| --- | --- | --- | --- | --- |
| RULE-AUDIT | 运营规则标准详情header“操作历史”→OperationsAuditHistoryModal，现成审计控件/页码/字段变化详情 | O-P PROJECT主对象读，无W-P亦可看；复用getOperationsEntityAuditHistory新增TERMINAL_UPDATE_RULE type | 既有中文操作类型与人名快照；无记录/加载/失败分开；切context关闭并拒旧结果 | owner CREATE/ENABLE/DISABLE各真实audit，重放不重复，异PROJECT拒绝，无写cap可读 |
| PROJECT-REPORT（修订） | 两内容页之一的右Tab，标准query/table/pager | 启用门店＋启用终端，不合并成effectiveStatus新字段；O-P | store/name/currentApkVersion/currentJsVersion/runtimeVersion，各query语义有可见列；显式查询 | 两个停用维度分别排除、作废排除、NO_REPORT保留；SQL跨页过滤actual非target |
| PROJECT-REPORT-DETAIL（修订） | 原标准Drawer中最新Descriptions＋历史Table/CursorPagination，无新路由 | 相同启用目标＋PROJECT范围；history读无W-P | latest未知/无任务/旧binding/历史错误分别显示 | 同task阶段更新不增行、两task两行、重复不改receivedAt、101历史分页 |

IA_SCOPE包含上述RULE-AUDIT，十个评审交互标识仍仅两个内容页；标准审计附属面直接复用现有布局/TestIds，不能据旧“九屏”删除新义务。UI§14与附件§9.1逐输入/动作补充分母。规则现有固定refs的停用/作废显示是另一读取任务，不随报告启用过滤而隐藏。
