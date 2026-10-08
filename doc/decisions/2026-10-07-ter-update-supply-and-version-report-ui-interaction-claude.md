# TER 更新供给与主机版本报告：阶段 B 低保真交互

### 2026-10-07 Dexter 最新裁决（覆盖旧报告方案）

1. 报告存 CBS PostgreSQL，由 `terminal-update` owner 写入；运营右 Tab 可按门店和当前实际版本查询。Dexter 最终更正“仅包含启用”：范围为当前项目 **启用门店下的启用终端**，停用/作废均排除；未报告终端仍有列表行。显示门店名、终端名、实际版本、最新升级报告状态，点击终端打开标准详情 Drawer，显示最新报告及历史报告。
2. 上传成功且解析校验成功后才可保存；按钮名称统一“保存”，之前禁用。HOT 还必须选定与声明五事实完全匹配的最小 FULL。换文件、解析失败、stage 过期或上下文改变立即撤销旧保存资格。
3. 升级报告经 CBS HTTP 上报；失败正文缓存到升级 owner 的持久化 state。TDC 对有效匹配 PONG 发公开本机广播 command，业务 actor 消费后重试自己的未发送内容。TDC 不保存其他 owner 的失败正文，广播不证明 CBS HTTP 成功，不通过报告失败重连 TDS。
4. N/M 界面单位为分钟；InputNumber 正整数分钟 1～1440 为本设计的有限参数，canonical/API/持久字段仍明确为秒，提交乘 60、读取除 60，服务端检查 60～86400 且为 60 的倍数；正常 DEV 用 N=5/M=10 分钟，边界值只进 acceptance fixture。
5. 运维保留 APK、JS、runtime、构建号、applicationId、publicationId、摘要等真实技术字段；不得暴露凭证、下载 grant 或原始异常。
6. 规则详情增加“操作历史”，复用标准审计能力，不新建审计流水/弹窗容器/operation。

后续直接确认：“每个更新任务一条报告”。阶段变化更新同一任务记录，历次任务保留；每次 HTTP 重送与心跳不新增历史行。此前“包含启用和停用”的答复已被“仅包含启用”覆盖，不作为当前输入。

正式需求 R-15 中旧双后台、最后值而无任务历史、TDS 上报路径由上述直接裁决覆盖。本轮只改 B 设计包及 intake；需求正本、开发规范、项目记忆、A、源码均不修改。未来实施授权须覆盖正式来源同步与终端标准唯一正本中的心跳触发重试条款；当前仍无实施或运行授权。大致 IA 已确认，本次新增历史/筛选/审计细节为修订设计，未冒充逐控件看图或动态 PASS。

## 1 · 工件元数据

STATUS=PROPOSED_FOR_DEXTER_CLAUDE_REVIEW；UI_REVIEW=ACCEPTED@2026-10-07_SCOPE_APPROXIMATE_IA_DYNAMIC_NOT_RUN；IMPLEMENTATION_AUTHORITY=false。
JOURNEY_DECISION=doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md
BUSINESS_PROBLEM=管理员无法供给更新包、管理项目规则并观察主机最后版本与最近更新状态。
BUSINESS_USER_OR_OWNER=运维管理员、业务管理员、terminal-update owner。
CURRENT_TASK=两后台包供给与项目规则/终端状态观察。
SUCCESS_OUTCOME=实际校验的包可保存、不可编辑规则可启停、启用门店下启用终端含尚无报告可读。
UI_BEARING=true；SKILL_USED=NONE；DEXTER_HIFI_REVIEW=NOT_REQUIRED。
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-10-07；接受范围仅大致IA，不等于本轮新增文案/控件逐项确认。

需求/Journey/IA/详设为同批2026-10-07文件；正式需求正本仍2026-10-05。两个新增内容页，包含两个Tab、五个Drawer、一个启停确认Modal和复用的标准审计Modal，无TER新增手工更新页。B规则未自动应用，按钮文案不得声称已升级。

### 1.1 · canonical 声明

| 交互ID（非页面数） | CONSUMER_FACE/UI_SURFACE | HOST_AND_ENTRY | ACTOR/BUSINESS_SCENARIO/BUSINESS_GOAL | USER_VISIBLE_COPY | TECHNICAL_BOUNDARY | FOUNDATION_PRIMITIVE | CONTAINER_LAYOUT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PKG-LIST | platform-admin/内容页 | /platform/terminal-update-packages菜单 | 运维管理员找已保存更新包 | 更新包；上传更新包；类型/应用/版本/保存时间；还没有更新包；终端暂时没有可用更新目标；通过包新建入口添加校验合规的ZIP。读取失败则重试，不当空集合 | 已验证space，cursor非业务页码 | useCursorStack,CursorPagination,adminListState,contextScopedQueryArgs | shell剩余宽高；表格正文唯一滚动，header/分页固定；标题截断可展开，列齐表头 |
| PKG-UPLOAD | platform-admin/Drawer | list“上传更新包” | 运维管理员验证并保存一个ZIP | 上传更新包；选择ZIP；解析结果；最小完整更新；保存/取消；校验未通过 | stageRef、digest、签名/包身份后台验证，非自由输入 | adminDrawerSurfaceProps,useDrawerFormLifecycle,createContentIdempotencyKey,useCursorCandidates | 标准Drawer宽度；正文唯一滚动/footer固定；长文件名换行；标签列与规范对齐 |
| PKG-DETAIL | platform-admin/Drawer | 包标题 | 运维管理员核对发布事实 | 〈应用 · 类型 · 版本〉 · 更新包详情；完整/热更新；APK版本/构建号/JS版本/runtime/applicationId/publicationId/摘要/保存时间；关闭 | readonly owner事实，无grant | adminWideDrawerSurfaceProps,adminWideDetailDescriptionsProps,useDetailDrawer | 标准wideDrawer；正文唯一滚动，摘要换行，footer固定；列名对齐 |
| RULE-LIST | operations-admin/内容页左Tab | 稳定terminal-update-rules路由；project取scope | 业务管理员读当前项目规则 | 项目终端版本管理；更新规则/终端更新状态；新建规则；状态/目标/门店范围/创建时间；先选择项目；还没有更新规则；本项目终端暂时没有项目更新供给；有权限者新建规则，无写权限者联系拥有项目终端版本管理权限的业务管理员 | PROJECT读范围；cap只限制写 | useCursorStack,CursorPagination,adminListState,contextScopedQueryArgs | shell剩余宽高；表格正文滚动，header/pager不越视口；列齐表头 |
| RULE-CREATE | operations-admin/Drawer | list新建 | 有项目权限管理员表达新规则 | 新建规则；目标/门店范围/指定门店/初始状态/完整更新提醒间隔（分钟）/热更新策略/闲时等待（分钟）/说明；保存/取消 | app/runtime/pub来自工件；N/M界面1..1440分钟、API60..86400秒；refs真实project | adminWideDrawerSurfaceProps,useDrawerFormLifecycle,createContentIdempotencyKey,useCursorCandidates | wideDrawer；正文唯一滚动/footer固定，候选popup限制视口；标签列规范对齐 |
| RULE-DETAIL | operations-admin/Drawer | 规则标题 | 业务管理员核对已创建规则 | 〈规则目标标题〉 · 版本规则详情；不可编辑；创建时间；操作→启用/停用；关闭 | 写cap/状态CAS；target不可变 | adminWideDrawerSurfaceProps,adminWideDetailDescriptionsProps,useDetailDrawer,AdminDetailActionMenu | wideDrawer唯一正文滚动；操作固定header；说明换行/门店分页；字段列齐 |
| RULE-STATUS | operations-admin/Modal | detail操作菜单 | 有权限管理员启停供给 | 启用/停用“〈规则目标标题〉”？；只改变规则供给，不表示设备已更新。；确认启用/确认停用/取消 | revision/幂等键/授权在owner | StatusChangeConfirm | 规范Modal尺寸；短正文无嵌套滚动；footer确认右侧；超长标题换行 |
| PROJECT-REPORT | operations-admin/同内容页右Tab | RULE-LIST同页；PROJECT来自context | 业务管理员查询启用门店下启用终端 | 门店/终端名称/当前APK版本/JS版本/runtime；查询/重置；门店名/终端名/实际版本/最新升级报告状态/接收时间 | SQL enabled范围/actual filters；无写cap/副机 | ProTable/useCursorStack/CursorPagination/adminListState/contextScopedQueryArgs | 标准列表单正文滚动；标题打开标准Drawer |
| PROJECT-REPORT-DETAIL | operations-admin/标准只读Drawer | 右Tab终端名称 | 业务管理员核对最新及历次任务 | 〈终端名称〉 · 终端更新状态详情；实际版本/最新报告/任务历史/阶段/原因/发生时间/接收时间；尚无报告/还没有升级报告/关闭 | PROJECT启用目标验证；最新actual非target；history按task分页 | adminWideDrawerSurfaceProps/adminWideDetailDescriptionsProps/useDetailDrawer/Table/CursorPagination | 一个正文滚动，详情＋历史表，同一标准footer；不加页面/嵌套Drawer |
| RULE-AUDIT | operations-admin/标准Modal | RULE-DETAIL操作菜单“操作历史” | 业务管理员查创建/启停的操作人与字段变化 | 操作历史；操作时间/操作人/操作类型；暂无操作历史；关闭 | PROJECT读取；不要求规则写cap；非升级任务历史 | OperationsAuditHistoryModal既有标准表格/页码/明细 | 复用现有Modal尺寸和正文布局，scope变化关闭 |

### 1.2 · 管理后台交互一致性

每行引用 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10。适用：K1/2/3/7/8/9（业务文案、控件/一致性/反馈/访问性）；K4/5/6/10按surface。承载形态无新豁免；包提交明确“保存”，运维技术字段由Dexter批准保留；其余文案遵K3，不扩展秘密/raw异常例外。规则ENABLED=“启用”/success绿、DISABLED=“停用”/warning橙；最近更新为任务观察，普通中文Text＋任务图标，不复用生命周期五色Tag。

| 交互ID（非页面数） | surface特定条款/例外 | 可执行观察 |
| --- | --- | --- |
| PKG-LIST/RULE-LIST | 内容页/Table/分页；无例外 | 首列目标标题可键盘打开，空/失败不混；窄屏无横向整体溢出 |
| PKG-UPLOAD/RULE-CREATE | 编辑Drawer全条款、唯一dirty；无例外 | 保存忙锁、不离开、关闭确认只由lifecycle；报错聚焦真实字段 |
| PKG-DETAIL/RULE-DETAIL | 只读Drawer/详情动作；无例外 | 禁编辑，RULE单header操作菜单，PKG无空菜单 |
| RULE-STATUS | Modal状态确认；无例外 | 确认在面内、失败保留、focus返回操作控件 |
| PROJECT-REPORT | 内容页右Tab，与RULE-LIST同宿主；无例外 | Tab文字＋选中态；pager固定，不产生第二scroll；左/右Tab切换消费既有overlay locked |
| PROJECT-REPORT-DETAIL | 标准只读详情Drawer，无例外 | Descriptions，状态中文Text＋任务图标；关闭/错误重试用标准按钮；无空操作菜单 |
| RULE-AUDIT | 现有标准审计Modal；无例外 | 操作历史真实GET，scope变化关闭、旧结果拒绝；只读用户可用 |

## 2 · Interaction map

| 顺序 | 前提 | route/交互面（宿主路由见IA2） | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | P有效身份/空间 | PKG-LIST | 找包 | 三个过滤/标题/新建入口 | artifactPage | 打开上传/详情 | 拒绝原位/缺空间引导 |
| 2 | 有本仓A ZIP | PKG-UPLOAD | 校验后保存 | file/解析/最小FULL/提交 | stage/register | 关闭后列表/详情 | 失败留输入、仅ownedrelease |
| 3 | P＋真实artifact | PKG-DETAIL | 核对发布事实 | 结构化事实/关闭 | artifactDetail | 父列表 | 404/失败原位 |
| 4 | O-P＋PROJECT | RULE-LIST | 找项目规则 | filters/标题/新建/Tab | rulePage | create/detail或右Tab | 无cap读不消失 |
| 5 | O-P＋W-P | RULE-CREATE | 表达不可编辑规则 | 目标/scope/N/M/状态/保存 | createRule | 关闭并读回 | 字段/撤权失败留输入 |
| 6 | O-P＋rule | RULE-DETAIL | 核对固定事实 | 详情/header操作/refs分页 | ruleDetail/ruleStorePage | 确认面或关闭 | 旧context失效 |
| 7 | W-P＋currentrevision | RULE-STATUS | 启停供给 | 对象名/影响/确认/取消 | changeRuleStatus | 详情/list读回 | CAS失败不重派 |
| 8 | O-P＋PROJECT | PROJECT-REPORT | 按门店及当前实际版本找启用终端 | 门店/名称/APK/JS/runtime查询/标题/分页 | reportPage | 标准详情 | NO_REPORT仍有行、disabled排除 |
| 9 | O-P＋terminal | PROJECT-REPORT-DETAIL | 读最新与历次任务报告 | Descriptions/历史Table/页前后/关闭 | reportDetail/reportHistory | 父右Tab | 历史失败独立重查，旧scope回包拒绝 |
| 10 | O-P＋合法当前规则 | RULE-AUDIT | 核对谁创建/启停规则 | 标准审计表格/分页/字段变化明细/关闭 | getOperationsEntityAuditHistory | 关闭回规则详情 | 当前PROJECT重验；加载/空/失败分开，不复用旧scope |

## 3 · v2 页面盘点

仓内注册冻结frontend集合只包含 workspace-management 的 WorkspaceManagementPage、CommercialGroupInitializationDrawer、WorkspaceDetailDrawer（hash见附件）。该集合没有更新包、项目更新规则或版本报告对应页：NO_V2_COUNTERPART，未推断所有旧仓从不存在。静态基线取本仓现有WorkspaceCreateDrawer、ProjectBusinessChannelPage、StoreTerminalDetail的控件结构；下面ASCII是新需求摹本，不依赖外仓运行或拷贝输入。没有新增高保真demo。

## 4 · 两个内容页及页内交互线框

### 页内交互 PKG-LIST
```text
更新包                         [上传更新包]
[类型▽] [应用输入] [runtime检索] [查询] [重置]
目标（点击标题）          类型  构建/JS/runtime  保存时间
sample-terminal · JS2.0.0 HOT   2 / 2.0.0 / R2    ...
                       [上一页] [下一页]
```
roster：仅引用附件§9.1的PKG-LIST行：PKG_PAGE、PKG_UPLOAD、PKG_FILTER_KIND、PKG_FILTER_APP、PKG_FILTER_RUNTIME、PKG_QUERY、PKG_RESET、PKG_TITLE(ref)、PKG_PREVIOUS、PKG_NEXT、PKG_RETRY。动态key/DOM挂点依该表；不创建别名常量。

### 页内交互 PKG-UPLOAD
```text
上传更新包                                      [×]
ZIP [选择文件] 文件名
解析结果：类型/应用/原生版本/构建/JS/runtime/内容身份
HOT：[最小完整更新候选▽] （声明的五项身份只读）
校验未通过：结构化原因；此文件尚未保存
                                      [取消] [保存]
```
roster：仅引用附件§9.1的PKG-UPLOAD行：PKG_UPLOAD_DRAWER、PKG_FILE、PKG_PARSE_STATE、PKG_PARSE_REASON、PKG_MIN_FULL、PKG_MIN_FULL_QUERY_TEXT、PKG_MIN_FULL_OPTION(ref)、PKG_MIN_FULL_NEXT、PKG_SAVE、PKG_CANCEL、PKG_CLOSE、DIRTY_CONFIRM、DIRTY_CANCEL。动态key/DOM挂点依该表；不创建别名常量。

### 页内交互 PKG-DETAIL
```text
〈应用 · 类型 · 版本〉 · 更新包详情                                     [×]
应用/类型     原生版本/构建    JS/runtime
发布内容摘要  ZIP摘要         实际签名证书摘要
最小完整更新（仅HOT）         保存时间
                                               [关闭]
```
roster：仅引用附件§9.1的PKG-DETAIL行：PKG_DETAIL、PKG_FACT(field)、PKG_DETAIL_CLOSE、PKG_DETAIL_RETRY。动态key/DOM挂点依该表；不创建别名常量。

### 页内交互 RULE-LIST
```text
[ 更新规则（左Tab，当前选中） ] [ 终端更新状态（右Tab） ]
终端版本规则     当前项目：...                 [新建规则]
[状态▽] [应用输入] [创建时间范围] [查询] [重置]
目标（标题）          状态   门店范围      创建时间
FULL2 + HOT2.0.0      停用   全部门店      ...
                               [上一页] [下一页]
```
roster：仅引用附件§9.1的RULE-LIST行：RULE_PAGE、PROJECT_RULES_TAB、PROJECT_REPORT_TAB、PROJECT_SCOPE_GUIDANCE、RULE_CREATE、RULE_FILTER_STATUS、RULE_FILTER_APP、RULE_FILTER_CREATED_RANGE、RULE_QUERY、RULE_RESET、RULE_TITLE(ref)、RULE_PREVIOUS、RULE_NEXT、RULE_RETRY。动态key/DOM挂点依该表；不创建别名常量。

### 页内交互 RULE-CREATE
```text
新建规则                                       [×]
目标：[完整更新 / 配对热更新▽] [已保存包候选▽]
完整更新...  热更新...  （固定配对，只读）
门店范围：[项目全部门店 / 指定门店▽]
指定门店：[搜索/分页多选] （仅指定模式）
初始状态：[停用 / 启用▽]（默认停用）
完整更新提醒间隔（分钟）：[N]
热更新策略：[立即 / 闲时▽]（仅配对）
闲时等待（分钟）：[M]（仅闲时）
说明：[最多1000字符]
                                         [取消] [保存]
```
roster：仅引用附件§9.1的RULE-CREATE行：RULE_CREATE_DRAWER、RULE_TARGET_MODE、RULE_CANDIDATE、RULE_CANDIDATE_QUERY_TEXT、RULE_CANDIDATE_OPTION(ref)、RULE_CANDIDATE_NEXT、RULE_FIXED_FULL、RULE_FIXED_HOT、RULE_STORE_SCOPE、RULE_STORE_SEARCH、RULE_STORE_OPTION(ref)、RULE_STORE_NEXT、RULE_INITIAL_STATUS、RULE_N、RULE_HOT_STRATEGY、RULE_M、RULE_DESCRIPTION、RULE_FIELD_ERROR(field)、RULE_SAVE、RULE_CANCEL、RULE_CLOSE、DIRTY_CONFIRM、DIRTY_CANCEL。动态key/DOM挂点依该表；不创建别名常量。
字段矩阵：targetMode新建可写、不持久该UI字段，决定full/hotRef；包决定app/platform/runtime不可写；scope可写ALL/REFS；refs只在REFS必填；N整数必填；策略仅hot必填；M仅IDLE必填；status选择ENABLED/DISABLED；createdAt/ref服务端给定；说明可选。切FULL-only清hot/M；切ALL清refs；新包重校配对不保留stalecandidate。热包已经固定minFULL，用户不再选不同FULL。

### 页内交互 RULE-DETAIL
```text
〈规则目标标题〉 · 版本规则详情                               [操作▽] [×]
目标/固定配对     状态       创建时间（不随启停变化）
门店范围         N/策略/M   说明
指定门店（必要时分段）：[上一段] [下一段]
                                               [关闭]
```
roster：仅引用附件§9.1的RULE-DETAIL行：RULE_DETAIL、RULE_FACT(field)、RULE_DETAIL_ACTION、RULE_AUDIT_OPEN、RULE_ENABLE、RULE_DISABLE、RULE_STORES_PREVIOUS、RULE_STORES_NEXT、RULE_DETAIL_CLOSE、RULE_DETAIL_RETRY。动态key/DOM挂点依该表；不创建别名常量。

### 页内交互 RULE-STATUS
```text
启用 / 停用“〈规则目标标题〉”？
只改变规则供给，不表示设备已更新。
结构化失败原位
                              [取消] [确认启用/确认停用]
```
roster：仅引用附件§9.1的RULE-STATUS行：RULE_STATUS_MODAL、RULE_STATUS_REASON、RULE_STATUS_CANCEL、RULE_STATUS_CONFIRM。动态key/DOM挂点依该表；不创建别名常量。

### 页内交互 PROJECT-REPORT
```text
项目终端版本管理     [更新规则] [终端更新状态·当前]
仅当前项目启用门店下的启用终端
门店：[候选▽] 终端名：[      ] 当前APK版本：[      ]
JS版本：[      ] runtime：[      ]                 [查询] [重置]
门店名    终端名(可点击)    实际APK / JS / runtime    最新升级报告状态  接收时间
A门店     收银终端           ...                    等待用户安装      ...
B门店     手持终端           尚无报告                尚无报告          —
                                                    [上一页] [下一页]
```
roster 仅引用附件§9.1 PROJECT-REPORT 的全部同名常量；版本三字段单独TestId，不能仅挂外层容器。门店候选防抖＋加载更多，列表全部查询条件显式查询/回车才提交；版本值为报告实际值精确匹配，不比较目标，不本地过滤当前页。

### 页内交互 PROJECT-REPORT-DETAIL
```text
〈终端名称〉 · 终端更新状态详情                         [×]
门店 / 终端：...                当前实际版本：APK / JS / runtime
最新升级报告：规则 / 工件 / 状态 / 阶段 / 原因
状态发生时间：...               服务端接收时间：...
未知（原因）/尚无报告/上次绑定报告
历史升级报告（每任务一条，阶段变化更新同一条）
任务目标    最新阶段    状态/原因    报告时实际版本    接收时间
...         ...         ...          ...              ...
                                     [上一页] [下一页]
                                                     [关闭]
```
历史为空：“还没有升级报告；该终端尚未产生更新任务。”读取历史失败只在历史标准区显示重试，不能把最新报告清成空或编造历史。history首次在已开合法详情后加载；page≤100，Table/CursorPagination真实服务器分页，不全量拉取、不嵌自创容器。roster仅引用附件§9.1 PROJECT-REPORT-DETAIL行，历史正文/行/前后页/重试均有具名常量。

### 附属交互 RULE-AUDIT（复用标准能力，不新增内容页）
```text
〈规则目标标题〉 · 版本规则详情    [操作▽]
菜单：启用/停用（有写权限且适用） · 操作历史（有读范围）
    → 既有 OperationsAuditHistoryModal
操作历史 [关闭]
时间       操作人       操作类型       字段变化
...        ...          创建/启用/停用   标准审计明细
               [标准分页] [选择某行查看标准字段前后值]
```
直接复用现有Modal/表格/详情/页码控件，不重造审计UI。O-P PROJECT主对象读取即可，无W-P也可打开；scope/context变化关闭并拒旧回包。入口常量RULE_AUDIT_OPEN，Modal使用现有审计TestIds；附件§9.1为唯一新入口表，不另复制审计内部常量。


### 4.1 · 控件与提交/搜索协议

全roster常量在两个app `terminalUpdatePackageTestIds.ts`/`terminalUpdateRuleTestIds.ts` （项目报告与详情同属后者），动态引用UUID以固定helper；不把上述screen/Journey IDs做runtime包/测试文件名。Upload真实input/parse结果、Modal按钮、候选下一页均在分母内。

列表筛选初始一次请求，查询按钮/回车显式提交，reset清字段/游标；候选独立复用既有250ms防抖搜索＋“加载更多”按钮，不设置候选查询/重置/上一页。包filter(kind/app/runtime)，规则filter(status/app/创建区间)，候选queryText＋声明兼容约束；server query不以写cap或当前主机版本裁剪。多选门店已选值由规范的分页选择回显，不枚举整个项目。

stage替换/退出释放旧自有资源，cleanup失败可见；会话/空间变化清stage引用后异步释放只对旧identity，不写新空间。表单dirty只有useDrawerFormLifecycle，shell只消费locked。无实体编辑面，因规则/工件不可编辑。

RULE-LIST无写cap只隐藏新建/写操作，保留列表/详情；空态明确“请联系拥有项目终端版本管理权限的业务管理员新建规则”，不显示伪可用按钮。

### 4.2 报告唯一业务文案与呈现字典

有限值来源仅附件§11.4；本表是frontend字典，不新增后台displayName或执行状态机。列表/详情同字典，任务状态用普通中文Text＋图标：等待=时钟、执行=进度、完成=勾、失败=提示、未知=问号；颜色不承担语义，不挪用草稿/启用/停用/归档/作废五色Tag。规则自身启停仍严格绿/橙。代码/rawreason不直接展示。

| 字段/值 | 唯一可见中文 |
| --- | --- |
| recentState.IDLE | 未发生更新 |
| recentState.FIXED | 更新任务已确定 |
| recentState.PREPARING | 正在准备更新 |
| recentState.APPLYING | 正在应用更新 |
| recentState.WAITING_USER | 等待用户安装 |
| recentState.WAITING_IDLE | 等待空闲更新 |
| recentState.REJECTED | 更新准入被拒绝 |
| recentState.PARTIALLY_SUCCEEDED | 完整更新已完成，热更新尚未完成 |
| recentState.SUCCEEDED | 更新已完成 |
| recentState.FAILED | 更新失败 |
| recentState.ROLLED_BACK | 更新失败，已恢复上次成功发布 |
| recentState.UNKNOWN | 更新结果待确认 |
| phase.null | — |
| phase.fixed | 目标已固定 |
| phase.preparing-full | 准备完整更新 |
| phase.preparing-hot | 准备热更新 |
| phase.applying-full | 应用完整更新 |
| phase.applying-hot | 应用热更新 |
| phase.waiting-user | 等待安装确认 |
| phase.waiting-idle | 等待空闲 |
| phase.unknown | 阶段待确认 |
| phase.succeeded | 执行完成 |
| phase.failed | 执行失败 |
| reasonCode.null | 无 |
| reasonCode.TARGET_REJECTED | 当前更新目标不满足准入条件 |
| reasonCode.IDENTITY_CONFLICT | 更新身份已变化 |
| reasonCode.SOURCE_UNAVAILABLE | 更新内容暂不可获取 |
| reasonCode.RESOURCE_BUSY | 更新资源正在使用 |
| reasonCode.PERSISTENCE_FAILED | 更新状态保存失败 |
| reasonCode.PREPARE_FAILED | 更新内容准备失败 |
| reasonCode.APPLY_FAILED | 更新应用失败 |
| reasonCode.OPERATION_TIMED_OUT | 更新操作超时，需确认实际结果 |
| reasonCode.PORT_UNAVAILABLE | 本机更新能力暂不可用 |
| reasonCode.OPERATION_CANCELLED | 本次更新操作已取消 |
| reasonCode.ACTION_UNKNOWN | 本机安装或加载结果待确认 |
| reasonCode.ACTION_IDENTITY_MISMATCH | 本机执行身份不匹配 |
| reasonCode.USER_CANCELLED | 安装尚未完成，继续等待用户确认 |
| reasonCode.INSTALLATION_FAILED | 系统安装未完成或失败 |
| reasonCode.BOOT_UNCONFIRMED | 更新发布启动未确认 |
| reasonCode.RECOVERY_FAILED | 上次成功发布恢复未完成 |
| reasonCode.UNCLASSIFIED_REASON | 更新原因暂未分类 |
| unknownReason.null | 无 |
| unknownReason.ACTUAL_READ_UNAVAILABLE | 实际版本暂不可读取 |
| unknownReason.ACTUAL_IDENTITY_INCOMPLETE | 实际发布身份不完整 |
| unknownReason.UNCLASSIFIED_REASON | 实际版本未知原因暂未分类 |
| entryKind.embedded | 安装包内嵌发布 |
| entryKind.hot | 热更新发布 |
| entryKind.file-recovery | 恢复发布 |
| entryKind.unknown | 发布来源待确认 |

R-15四类分别WAITING_USER/WAITING_IDLE、REJECTED、PARTIALLY_SUCCEEDED、FAILED/ROLLED_BACK。部分成功/已回退必须满足附件11.4真实readback前提，file-recovery入口本身不证明本次回退。B不调度闲时，WAITING_IDLE由C事实或协议/组件合法fixture覆盖。NO_REPORT显示“尚无报告”；recent=null显示“未发生更新”；关联rule/artifact缺失显示“关联更新资料暂不可读取”，不得显示UUID。标题只用owner结构化应用/类型/版本或终端名称组装，三个详情为“〈包标题〉 · 更新包详情”“〈规则目标标题〉 · 版本规则详情”“〈终端名称〉 · 终端更新状态详情”。

## 5 · 状态与边界表

| 交互面 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PKG-LIST | 缺scope引导；有scope取currentData，加载不当空 | 查询/游标校验 | 只读，无mutation | 打开上传/详情 | 拒绝原位/缺空间引导 | 当前读取失败可重查，不假成功 | artifactPage唯一事实；P有效身份/空间 |
| PKG-UPLOAD | 缺scope引导；有scope取currentData，加载不当空 | 字段/当前身份校验 | 忙锁，禁止双击/离开 | 关闭后列表/详情 | 失败留输入、仅ownedrelease | 保留当前attempt/key，不自动重复提交；按operation幂等事实处理 | stage/register唯一事实；有本仓A ZIP |
| PKG-DETAIL | 缺scope引导；有scope取currentData，加载不当空 | 查询/游标校验 | 只读，无mutation | 父列表 | 404/失败原位 | 当前读取失败可重查，不假成功 | artifactDetail唯一事实；P＋真实artifact |
| RULE-LIST | 缺scope引导；有scope取currentData，加载不当空 | 查询/游标校验 | 只读，无mutation | create/detail或右Tab | 无cap读不消失 | 当前读取失败可重查，不假成功 | rulePage唯一事实；O-P＋PROJECT |
| RULE-CREATE | 缺scope引导；有scope取currentData，加载不当空 | 字段/当前身份校验 | 忙锁，禁止双击/离开 | 关闭并读回 | 字段/撤权失败留输入 | 保留当前attempt/key，不自动重复提交；按operation幂等事实处理 | createRule唯一事实；O-P＋W-P |
| RULE-DETAIL | 缺scope引导；有scope取currentData，加载不当空 | 查询/游标校验 | 只读，无mutation | 确认面或关闭 | 旧context失效 | 当前读取失败可重查，不假成功 | ruleDetail/ruleStorePage唯一事实；O-P＋rule |
| RULE-STATUS | 缺scope引导；有scope取currentData，加载不当空 | 字段/当前身份校验 | 忙锁，禁止双击/离开 | 详情/list读回 | CAS失败不重派 | 保留当前attempt/key，不自动重复提交；按operation幂等事实处理 | changeRuleStatus唯一事实；W-P＋currentrevision |
| PROJECT-REPORT | 缺scope引导；有scope取currentData，加载不当空 | 查询/游标校验 | 只读，无mutation | 标准报告详情 | NO_REPORT仍有行 | 当前读取失败可重查，不假成功 | reportPage唯一事实；O-P＋PROJECT |
| PROJECT-REPORT-DETAIL | 缺scope引导；有scope取currentData，加载不当空 | 查询/游标校验 | 只读，无mutation | 父右Tab | 未知/旧binding分开 | 当前读取失败可重查，不假成功 | reportDetail/reportHistory唯一事实；O-P＋启用门店及启用terminal |
| RULE-AUDIT | 标准Modal加载，空记录独立 | target/scope校验 | 只读，无mutation | 标准分页/明细/关闭 | 原位typed拒绝 | GET可重查；context变化关闭、拒迟到结果 | 标准audit owner与PROJECT task read；无写cap |

长标题/备注/两页候选不越视口；Tab不双scroll。NO_REPORT、recent=null、unknown和oldbinding分别呈现；完整空快照替换旧事实；失败不能使用旧currentData伪当前成功。

## 6 · 逐操作任务合理性

| 操作（每个可触发动作一行） | Journey来源 | 用户为何此时操作 | 更短路径 | 不选替代理由 | 约束归因 | Dexter裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| PKG-LIST：类型筛选 | Journey§4(1)（同日期同前缀文档） | 缩小更新包查询范围 | 不提供该筛选 | 需在分页数据中定位目标，不能只筛当前页 | 仅改查询draft，显式查询才请求；后端过滤 | 否 |
| PKG-LIST：应用输入 | Journey§4(1)（同日期同前缀文档） | 缩小更新包查询范围 | 不提供该筛选 | 需在分页数据中定位目标，不能只筛当前页 | 仅改查询draft，显式查询才请求；后端过滤 | 否 |
| PKG-LIST：runtime输入 | Journey§4(1)（同日期同前缀文档） | 缩小更新包查询范围 | 不提供该筛选 | 需在分页数据中定位目标，不能只筛当前页 | 仅改查询draft，显式查询才请求；后端过滤 | 否；Dexter已确认运维保留技术细节 |
| PKG-LIST：查询 | Journey§4(1)（同日期同前缀文档） | 提交本次更新包过滤条件 | 每次输入自动查列表 | 列表采用标准显式查询/Enter，避免无意请求 | 清cursor后读当前scope，不写事实 | 否 |
| PKG-LIST：回车查询 | Journey§4(1)（同日期同前缀文档） | 提交本次更新包过滤条件 | 每次输入自动查列表 | 列表采用标准显式查询/Enter，避免无意请求 | 清cursor后读当前scope，不写事实 | 否 |
| PKG-LIST：重置 | Journey§4(1)（同日期同前缀文档） | 恢复更新包默认过滤 | 逐字段手工清空 | 标准重置一次清条件与cursor更直接 | 只重置当前列表上下文 | 否 |
| PKG-LIST：上一页 | Journey§4(1)（同日期同前缀文档） | 查看更新包尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| PKG-LIST：下一页 | Journey§4(1)（同日期同前缀文档） | 查看更新包尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| PKG-LIST：包标题 | Journey§4(1)（同日期同前缀文档） | 核对该更新包完整事实 | 行内展开详情 | 复用标准只读Drawer，避免第二详情容器 | 按当前ref/scope读detail；标题由结构化事实组成 | 否 |
| PKG-LIST：新建入口 | Journey§4(1)（同日期同前缀文档） | 准备增加更新包 | 列表行内表单 | 复用编辑Drawer及统一dirty生命周期 | 当前身份/写权限，不自动提交 | 否；保存已由Dexter确认 |
| PKG-LIST：读取失败重试 | Journey§4(1)（同日期同前缀文档） | 重新读取失败的更新包 | 留用旧响应 | 旧响应不能冒充当前scope事实 | 仅重查GET，不重派业务mutation | 否 |
| PKG-UPLOAD：选择ZIP | Journey§4(1)（同日期同前缀文档） | 提交开发人员产物供解析 | 粘贴远端URL | 需求指定本地ZIP；实际bytes必须由server校验 | stage API写暂存，非可用工件保存 | 否 |
| PKG-UPLOAD：替换ZIP | Journey§4(1)（同日期同前缀文档） | 纠正所选产物 | 保留并使用旧stage | 选择与parsed identity必须属于同attempt | 只释放确有所有权旧stage；release失败可见 | 否 |
| PKG-UPLOAD：最小FULL搜索 | Journey§4(1)（同日期同前缀文档） | 找到当前合法候选供待保存更新包使用 | 全量下拉/显式查询按钮 | 现有候选250ms防抖＋服务端过滤 | 候选query按space/project/兼容五事实隔离 | 否 |
| PKG-UPLOAD：加载更多FULL | Journey§4(1)（同日期同前缀文档） | 查看FULL下一批候选 | 全量下载/新分页状态 | 复用既有loadNext；一次只取下一页 | hook拥有页状态，选中事实与候选页分离 | 否 |
| PKG-UPLOAD：选择FULL | Journey§4(1)（同日期同前缀文档） | 指定待保存更新包对应的候选 | 自由填写ref | 需展示合法候选；不把UUID当可见内容 | 只改draft/filter；owner提交/查询再次核实归属 | 否 |
| PKG-UPLOAD：提交保存 | Journey§4(1)（同日期同前缀文档） | 确认解析身份与最小FULL后保存工件 | 选ZIP即保存 | 管理员需先核对解析结果，坏stage不变可用包 | register当前授权/ownedstage/五事实/receipt；asset同事务 | 否；保存已由Dexter确认 |
| PKG-UPLOAD：取消 | Journey§4(1)（同日期同前缀文档） | 退出待保存更新包交互 | 直接丢弃未保存输入 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| PKG-UPLOAD：×关闭 | Journey§4(1)（同日期同前缀文档） | 退出待保存更新包交互 | 直接丢弃未保存输入 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| PKG-UPLOAD：dirty放弃 | Journey§4(1)（同日期同前缀文档） | 明确放弃未提交draft | 无确认丢输入 | 由既有lifecycle提供唯一确认 | 放弃后释放ownedstage；不能回滚已保存事实 | 否 |
| PKG-UPLOAD：dirty继续 | Journey§4(1)（同日期同前缀文档） | 保留当前draft继续处理 | 另建dirty提示 | 已有确认框足够，不产生第二dirty owner | lifecycle保持surface和draft | 否 |
| PKG-DETAIL：关闭 | Journey§4(1)（同日期同前缀文档） | 退出更新包交互 | 留在弹层 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| PKG-DETAIL：×关闭 | Journey§4(1)（同日期同前缀文档） | 退出更新包交互 | 留在弹层 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| PKG-DETAIL：读取失败重试 | Journey§4(1)（同日期同前缀文档） | 重新读取失败的更新包 | 留用旧响应 | 旧响应不能冒充当前scope事实 | 仅重查GET，不重派业务mutation | 否 |
| RULE-LIST：状态筛选 | Journey§4(2)（同日期同前缀文档） | 缩小项目规则查询范围 | 不提供该筛选 | 需在分页数据中定位目标，不能只筛当前页 | 仅改查询draft，显式查询才请求；后端过滤 | 否 |
| RULE-LIST：应用输入 | Journey§4(2)（同日期同前缀文档） | 缩小项目规则查询范围 | 不提供该筛选 | 需在分页数据中定位目标，不能只筛当前页 | 仅改查询draft，显式查询才请求；后端过滤 | 否 |
| RULE-LIST：创建时间范围 | Journey§4(2)（同日期同前缀文档） | 缩小项目规则查询范围 | 不提供该筛选 | 需在分页数据中定位目标，不能只筛当前页 | 仅改查询draft，显式查询才请求；后端过滤 | 否 |
| RULE-LIST：查询 | Journey§4(2)（同日期同前缀文档） | 提交本次项目规则过滤条件 | 每次输入自动查列表 | 列表采用标准显式查询/Enter，避免无意请求 | 清cursor后读当前scope，不写事实 | 否 |
| RULE-LIST：回车查询 | Journey§4(2)（同日期同前缀文档） | 提交本次项目规则过滤条件 | 每次输入自动查列表 | 列表采用标准显式查询/Enter，避免无意请求 | 清cursor后读当前scope，不写事实 | 否 |
| RULE-LIST：重置 | Journey§4(2)（同日期同前缀文档） | 恢复项目规则默认过滤 | 逐字段手工清空 | 标准重置一次清条件与cursor更直接 | 只重置当前列表上下文 | 否 |
| RULE-LIST：上一页 | Journey§4(2)（同日期同前缀文档） | 查看项目规则尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| RULE-LIST：下一页 | Journey§4(2)（同日期同前缀文档） | 查看项目规则尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| RULE-LIST：规则标题 | Journey§4(2)（同日期同前缀文档） | 在当前范围核对项目规则 | 沿用当前标准控件 | 已采用最小现成路径，不加新容器 | 当前scope/currentData与只读API | 否 |
| RULE-LIST：新建规则 | Journey§4(2)（同日期同前缀文档） | 准备增加项目规则 | 列表行内表单 | 复用编辑Drawer及统一dirty生命周期 | 当前身份/写权限，不自动提交 | 否 |
| RULE-LIST：读取失败重试 | Journey§4(2)（同日期同前缀文档） | 重新读取失败的项目规则 | 留用旧响应 | 旧响应不能冒充当前scope事实 | 仅重查GET，不重派业务mutation | 否 |
| RULE-LIST：左规则Tab | Journey§4(2)（同日期同前缀文档） | 切换当前项目的规则/终端状态任务 | 新增第二内容页 | Dexter指定同页左右Tab | 统一宿主；编辑锁阻断切换，换Tab不改规则 | 否 |
| RULE-LIST：右报告Tab | Journey§4(2)（同日期同前缀文档） | 切换当前项目的规则/终端状态任务 | 新增第二内容页 | Dexter指定同页左右Tab | 统一宿主；编辑锁阻断切换，换Tab不改规则 | 否 |
| RULE-CREATE：目标类型 | Journey§4(2)（同日期同前缀文档） | 选择仅FULL或配对HOT | 自由组合FULL/HOT | HOT固定最小FULL，不能形成无效组合 | 切变体清失效字段；server重核pair | 否 |
| RULE-CREATE：工件搜索 | Journey§4(2)（同日期同前缀文档） | 找到当前合法候选供新规则使用 | 全量下拉/显式查询按钮 | 现有候选250ms防抖＋服务端过滤 | 候选query按space/project/兼容五事实隔离 | 否 |
| RULE-CREATE：加载更多工件 | Journey§4(2)（同日期同前缀文档） | 查看工件下一批候选 | 全量下载/新分页状态 | 复用既有loadNext；一次只取下一页 | hook拥有页状态，选中事实与候选页分离 | 否 |
| RULE-CREATE：选择工件 | Journey§4(2)（同日期同前缀文档） | 指定新规则对应的候选 | 自由填写ref | 需展示合法候选；不把UUID当可见内容 | 只改draft/filter；owner提交/查询再次核实归属 | 否 |
| RULE-CREATE：门店范围 | Journey§4(2)（同日期同前缀文档） | 选择动态全部门店或固定refs | 把ALL复制为当前门店快照 | ALL需自然覆盖以后新门店 | ALL不传refs，STORE_REFS非空同project | 否 |
| RULE-CREATE：门店搜索 | Journey§4(2)（同日期同前缀文档） | 找到当前合法候选供新规则使用 | 全量下拉/显式查询按钮 | 现有候选250ms防抖＋服务端过滤 | 候选query按space/project/兼容五事实隔离 | 否 |
| RULE-CREATE：加载更多门店 | Journey§4(2)（同日期同前缀文档） | 查看门店下一批候选 | 全量下载/新分页状态 | 复用既有loadNext；一次只取下一页 | hook拥有页状态，选中事实与候选页分离 | 否 |
| RULE-CREATE：选择门店 | Journey§4(2)（同日期同前缀文档） | 指定新规则对应的候选 | 自由填写ref | 需展示合法候选；不把UUID当可见内容 | 只改draft/filter；owner提交/查询再次核实归属 | 否 |
| RULE-CREATE：初始状态 | Journey§4(2)（同日期同前缀文档） | 明确创建后是否供给规则 | 创建即隐式启用 | 当前默认停用已展示，显式选择避免误供给 | ENABLED/DISABLED闭集；尚未安装任何包 | 否 |
| RULE-CREATE：N输入 | Journey§4(2)（同日期同前缀文档） | 配置安装提醒间隔 | 统一硬编码间隔 | 需求规定按规则配置；B仅保存，C执行 | 界面分钟；提交×60、回显÷60，API秒与倍数校验 | 否；Dexter已确认分钟 |
| RULE-CREATE：热更新策略 | Journey§4(2)（同日期同前缀文档） | 指定立即或闲时应用HOT | 让终端任选策略 | 这是规则内容；FULL仍只有立即安装邀请 | IMMEDIATE禁止M，IDLE必须M；B不重启 | 否 |
| RULE-CREATE：M输入 | Journey§4(2)（同日期同前缀文档） | 配置闲时无点击间隔 | 统一硬编码间隔 | 需求规定按规则配置；B仅保存，C执行 | 界面分钟；提交×60、回显÷60，API秒与倍数校验 | 否；Dexter已确认分钟 |
| RULE-CREATE：说明输入 | Journey§4(2)（同日期同前缀文档） | 给管理员保留此规则说明 | 新增描述系统 | 现有TextArea与1000字符上限足够 | 只存当前说明，不以备注替代结构化事实 | 否 |
| RULE-CREATE：保存 | Journey§4(2)（同日期同前缀文档） | 一次创建不可编辑规则 | 输入时逐字段写入 | 一次明确提交全部目标/范围/策略，失败保留draft | create当前grant/条件字段/scope/幂等/审计同事务 | 否 |
| RULE-CREATE：取消 | Journey§4(2)（同日期同前缀文档） | 退出新规则交互 | 直接丢弃未保存输入 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| RULE-CREATE：×关闭 | Journey§4(2)（同日期同前缀文档） | 退出新规则交互 | 直接丢弃未保存输入 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| RULE-CREATE：dirty放弃 | Journey§4(2)（同日期同前缀文档） | 明确放弃未提交draft | 无确认丢输入 | 由既有lifecycle提供唯一确认 | 放弃后释放ownedstage；不能回滚已保存事实 | 否 |
| RULE-CREATE：dirty继续 | Journey§4(2)（同日期同前缀文档） | 保留当前draft继续处理 | 另建dirty提示 | 已有确认框足够，不产生第二dirty owner | lifecycle保持surface和draft | 否 |
| RULE-DETAIL：操作菜单 | Journey§4(2)（同日期同前缀文档） | 访问有权限的规则启停操作 | 多按钮散布正文 | 复用AdminDetailActionMenu；无启停权限仍可看历史 | 当前状态/cap决定可见项；操作历史已明确接入标准审计 | 否 |
| RULE-DETAIL：启用 | Journey§4(2)（同日期同前缀文档） | 准备启用此规则供给 | 点击即写入 | 标准确认展示对象与直接影响 | 只打开确认；尚未执行status mutation | 否 |
| RULE-DETAIL：停用 | Journey§4(2)（同日期同前缀文档） | 准备停用此规则供给 | 点击即写入 | 标准确认展示对象与直接影响 | 只打开确认；尚未执行status mutation | 否 |
| RULE-DETAIL：上一段门店 | Journey§4(2)（同日期同前缀文档） | 查看已固定规则尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| RULE-DETAIL：下一段门店 | Journey§4(2)（同日期同前缀文档） | 查看已固定规则尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| RULE-DETAIL：关闭 | Journey§4(2)（同日期同前缀文档） | 退出已固定规则交互 | 留在弹层 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| RULE-DETAIL：×关闭 | Journey§4(2)（同日期同前缀文档） | 退出已固定规则交互 | 留在弹层 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| RULE-DETAIL：读取失败重试 | Journey§4(2)（同日期同前缀文档） | 重新读取失败的已固定规则 | 留用旧响应 | 旧响应不能冒充当前scope事实 | 仅重查GET，不重派业务mutation | 否 |
| RULE-STATUS：确认启用 | Journey§4(2)（同日期同前缀文档） | 确认启用指定规则供给 | 自动重派失败旧提交 | CAS冲突必须回读后重新决定 | status当前grant/revision/receipt/审计/topic同事务 | 否 |
| RULE-STATUS：确认停用 | Journey§4(2)（同日期同前缀文档） | 确认停用指定规则供给 | 自动重派失败旧提交 | CAS冲突必须回读后重新决定 | status当前grant/revision/receipt/审计/topic同事务 | 否 |
| RULE-STATUS：取消 | Journey§4(2)（同日期同前缀文档） | 退出此规则交互 | 留在弹层 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| PROJECT-REPORT：门店搜索 | Journey§4(4)（同日期同前缀文档） | 找到当前合法候选供项目终端使用 | 全量下拉/显式查询按钮 | 现有候选250ms防抖＋服务端过滤 | 候选query按space/project/兼容五事实隔离 | 否 |
| PROJECT-REPORT：加载更多门店 | Journey§4(4)（同日期同前缀文档） | 查看门店下一批候选 | 全量下载/新分页状态 | 复用既有loadNext；一次只取下一页 | hook拥有页状态，选中事实与候选页分离 | 否 |
| PROJECT-REPORT：选择门店 | Journey§4(4)（同日期同前缀文档） | 指定项目终端对应的候选 | 自由填写ref | 需展示合法候选；不把UUID当可见内容 | 只改draft/filter；owner提交/查询再次核实归属 | 否 |
| PROJECT-REPORT：终端名称输入 | Journey§4(4)（同日期同前缀文档） | 缩小项目终端查询范围 | 不提供该筛选 | 需在分页数据中定位目标，不能只筛当前页 | 仅改查询draft，显式查询才请求；后端过滤 | 否 |
| PROJECT-REPORT：查询 | Journey§4(4)（同日期同前缀文档） | 提交本次项目终端过滤条件 | 每次输入自动查列表 | 列表采用标准显式查询/Enter，避免无意请求 | 清cursor后读当前scope，不写事实 | 否 |
| PROJECT-REPORT：回车查询 | Journey§4(4)（同日期同前缀文档） | 提交本次项目终端过滤条件 | 每次输入自动查列表 | 列表采用标准显式查询/Enter，避免无意请求 | 清cursor后读当前scope，不写事实 | 否 |
| PROJECT-REPORT：重置 | Journey§4(4)（同日期同前缀文档） | 恢复项目终端默认过滤 | 逐字段手工清空 | 标准重置一次清条件与cursor更直接 | 只重置当前列表上下文 | 否 |
| PROJECT-REPORT：终端标题 | Journey§4(4)（同日期同前缀文档） | 核对该项目终端完整事实 | 行内展开详情 | 复用标准只读Drawer，避免第二详情容器 | 按当前ref/scope读detail；标题由结构化事实组成 | 否 |
| PROJECT-REPORT：上一页 | Journey§4(4)（同日期同前缀文档） | 查看项目终端尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| PROJECT-REPORT：下一页 | Journey§4(4)（同日期同前缀文档） | 查看项目终端尚未展示的记录 | 一次下载全量 | 真实分页，不以首100条冒称全集 | 列表/固定refs专用cursor API；标题事实不重选 | 否 |
| PROJECT-REPORT：读取失败重试 | Journey§4(4)（同日期同前缀文档） | 重新读取失败的项目终端 | 留用旧响应 | 旧响应不能冒充当前scope事实 | 仅重查GET，不重派业务mutation | 否 |
| PROJECT-REPORT-DETAIL：关闭 | Journey§4(4)（同日期同前缀文档） | 退出此终端报告交互 | 留在弹层 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| PROJECT-REPORT-DETAIL：×关闭 | Journey§4(4)（同日期同前缀文档） | 退出此终端报告交互 | 留在弹层 | 编辑面仅统一dirty确认；只读/确认面直接关闭 | useDrawerFormLifecycle/useDetailDrawer；确认取消零业务写 | 否 |
| PROJECT-REPORT-DETAIL：读取失败重试 | Journey§4(4)（同日期同前缀文档） | 重新读取失败的此终端报告 | 留用旧响应 | 旧响应不能冒充当前scope事实 | 仅重查GET，不重派业务mutation | 否 |

表内与§14合为当前完整动作，只设计本批最新裁决内控件；规则操作历史使用现有标准Modal。本批包含每task报告历史，不含手工终端更新、任务重试或每阶段流水。


## 7 · Face / owner对齐矩阵

| 交互面/动作 | consumer face | 页面准入 | server operation（精确ID，契约见附件§11） | owner readback/command | 不可由frontend替代的判定 |
| --- | --- | --- | --- | --- | --- |
| PKG-LIST（动作全集§6） | platform-admin | P有效身份/空间 | getPlatformTerminalUpdateArtifactPage | terminal-update task read | 空间、参数与当前身份；UI筛选不是授权 |
| PKG-UPLOAD（动作全集§6） | platform-admin | P＋本仓A ZIP | stagePlatformTerminalUpdateArtifact、releasePlatformTerminalUpdateArtifactStage、registerPlatformTerminalUpdateArtifact；HOT候选getPlatformTerminalUpdateArtifactPage | terminal-update command；asset stage/claim/release公开API同事务 | 实际bytes/manifest、owned stage、五事实/receipt；parsed UI不是可用工件 |
| PKG-DETAIL（动作全集§6） | platform-admin | P＋真实artifact | getPlatformTerminalUpdateArtifactDetail | terminal-update task read | 跨空间拒绝，不暴露秘密下载定位 |
| RULE-LIST（动作全集§6） | operations-admin | O-P＋PROJECT | getOperationsProjectTerminalUpdateRulePage | terminal-update PROJECT task read | 真实project/context；无写cap仍可读 |
| RULE-CREATE（动作全集§6） | operations-admin | O-P＋W-P | createOperationsProjectTerminalUpdateRule；候选getOperationsTerminalUpdateArtifactCandidatePage；门店候选复用既有organization generated operation | terminal-update rule command；organization只读任务query | 当前grant、pair/scope/refs/条件字段与幂等重放；候选不能取代提交复核 |
| RULE-DETAIL（动作全集§6） | operations-admin | O-P＋rule | getOperationsProjectTerminalUpdateRuleDetail、getOperationsProjectTerminalUpdateRuleStorePage | terminal-update PROJECT task read | 已固定refs与当前候选资格分离；createdAt/内容不可编辑 |
| RULE-STATUS（动作全集§6） | operations-admin | W-P＋current revision | changeOperationsProjectTerminalUpdateRuleStatus | terminal-update rule command | 当前授权/CAS/审计/topic同事务；旧revision不能自动重派 |
| PROJECT-REPORT（动作全集§6） | operations-admin | O-P＋PROJECT | getOperationsProjectTerminalVersionPage；门店候选复用既有organization generated operation | terminal-update PROJECT task read | 项目全部主机含NO_REPORT；binding提示、actual/recent/两时间保真 |
| PROJECT-REPORT-DETAIL（动作全集§6） | operations-admin | O-P＋terminal | getOperationsProjectTerminalVersionDetail、getOperationsProjectTerminalUpdateReportHistoryPage | terminal-update PROJECT task read | 真实项目归属、null/unknown、有限归一；目标不当实际版本 |
| RULE-AUDIT（动作全集§14） | operations-admin | O-P＋rule | getOperationsEntityAuditHistory（既有operation） | audit-read＋terminal-update PROJECT task read | 复用标准实体类型与Modal；创建/启停同事务审计，幂等不重复 |

TER只经公开command/selector，B无新增人工更新页面。报告taskread按PROJECT，不借STORE页面/cap或旧组织Card。门店候选的确切既有operation由useOrganizationCandidates调用链消费，附件§12点名复用，不新增第17个operation。

## 8 · Heritage 条文适用

不复算退役manifest/compliance分母。主动规范为当前frontend §3及corpus；assetcarryover本仓freeze边界见§3。旧仓只读，无runtime/build fallback；currentfoundation优先，不复制局部Drawer/列表/HTTP/overlay实现。

## 9 · 高保真demo

N/A：本批先交完整低保真，没有新的交互范式或虚构账号/业务数据。

## 10 · Dexter 看图

ACCEPTED@2026-10-07（范围：大致IA）。2026-10-07 Dexter已确认大致IA并允许继续下一步；不继承A历史GO。仅确认当前B页面/页内交互安排，实际UI/功能仍NOT_RUN。

## 11 · IA确认与控件落点

两个内容页及全部页内交互所属后台、菜单/页面、完整入口、控件类型、读权限与具名写权限逐交互面见IA§2，线框必须与该表同一安排。运营现有门店终端管理位于“门店经营”；新增项目终端版本规则同分组其后（order315）。Dexter已确认大致IA（运维菜单、运营同页双Tab及后台职责）；当前工件继续作为详设输入，不重复申请同一确认，不假称现有。应用筛选用Input；门店范围/HOT策略用Radio.Group；说明用Input.TextArea；启停使用StatusChangeConfirm的确认启用/确认停用文案。新建候选PagePaged，固定refs详情CursorPaged，两页回显不依赖当前候选资格。

每个实际控件的owning source、TestIds常量、DOM挂点、事件/command/API、focused反例及不可见提交变体见同批source-and-api-appendix§9；该表为落点权威，本文roster不得被用作省略候选搜索/分页/关闭等节点的理由。当前全部PLANNED/NOT_RUN。

## 12 · 逐输入/搜索/真实提交与动作的规范分母

附件§12为每个输入控件的source/API/匹配、上游/级联、loading/empty/failed、提交再核验表；§13为每个真实mutation variant每个request fact的visible/readonly/server-derived/协议身份/秘密分类，§13.1逐动作绑定用户任务。UI roster与真实DOM按附件§9保持同一常量来源，不能只读分组摘要。所有目标path/query/response/error以附件§11单operation为准，body/header不能由未分类字段补造。该引用是唯一表格分母，不再维护另一份会漂移的复本。当前component/L2均NOT_RUN。

## 13 · 逐线框 surface ownership 静态自检

元素完整分母以各线框紧邻roster及附件§9逐动作、§12输入、§13事实为唯一清单，本表不创建第二套TestId。下列PASS只针对候审线框归属/copy位置，真实UI/节点/运行仍NOT_RUN。后台/菜单/页面定位在IA，不画作当前surface控件；PROJECT-REPORT只画右Tab正文，不复制父页Tabs或另一Drawer正文。RULE-LIST是唯一内容页宿主，自己的Tabs trigger属于该宿主，并不画右Tab正文。

| screen id | 声明UI_SURFACE | 线框可见元素分母 | 每项属于当前surface | USER_VISIBLE_COPY呈现位置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| PKG-LIST | 内容页 | 标题/上传、3筛选、query/reset、4列/标题链接、pager；错误重试按同roster条件态 | 是；无shell/sidebar/其它页 | UI1.1文案在标题/筛选/列/空错误态/按钮 | PASS_STATIC_DESIGN |
| PKG-UPLOAD | 编辑Drawer | 标题/×、file、parsed事实、HOT候选/5事实、原因、取消/保存；dirty确认属既有lifecycle附属surface | 是；不嵌父列表 | 文案在fieldlabel/readonly描述/原因/footer；dirty确认按lifecycle自身Modal | PASS_STATIC_DESIGN |
| PKG-DETAIL | 只读Drawer | 标题/×、版本/两摘要/签名/最小FULL/时间、关闭/读取失败重试 | 是；无父列表/编辑面 | 标题/Descriptions/失败态/footer | PASS_STATIC_DESIGN |
| RULE-LIST | 项目内容页宿主/左正文 | 本宿主2Tab trigger、标题/项目说明/new、3过滤/query/reset、4列/pager/范围引导 | 是；Tab trigger属唯一宿主，只画当前左正文；无shell导航 | UI1.1补齐“更新规则/终端更新状态”在宿主Tab；其余字段/按钮/提示 | PASS_STATIC_DESIGN |
| RULE-CREATE | 编辑Drawer | 标题/×、目标/pair/scope/refs/status/N/strategy/M/description、取消/保存/fielderror | 是；不嵌list或readonly详情 | labels/只读配对/条件字段/错误/footer | PASS_STATIC_DESIGN |
| RULE-DETAIL | 只读Drawer | 标题/×/操作、目标/status/time/scope/N/M/说明/fixedrefs pager、关闭/失败重试 | 是；确认Modal只写行为，不嵌Modal正文 | header/Descriptions/门店分页/footer | PASS_STATIC_DESIGN |
| RULE-STATUS | 确认Modal | 标题/业务提示/失败、取消/确认启用或停用 | 是；不嵌Drawer或shell | title/body/原因/footer | PASS_STATIC_DESIGN |
| PROJECT-REPORT | 同内容页右Tab正文 | 标题说明、门店候选/终端名/实际APK/JS/runtime输入/query/reset、5列/终端链接/NO_REPORT/pager | 是；父页Tabtrigger和菜单不重画，详情只给点击行为 | UI1.1文案在标题/columns/状态/条件提示，不渲染相邻Drawer全文 | PASS_STATIC_DESIGN |
| PROJECT-REPORT-DETAIL | 只读Drawer | 标题/×、终端/门店状态/actual/recent/两time/未知原因/任务历史表/分页/重试、关闭/详情失败重试 | 是；无列表/Tab/安装控件 | title/Descriptions/状态/footer | PASS_STATIC_DESIGN |
| RULE-AUDIT | 标准审计Modal | 标题/时间/操作人/类型/字段变化/标准页码/明细/关闭/失败重试 | 是；直接复用现有审计surface，不重画规则Drawer | 原标准审计中文和字段显示 | PLANNED_STATIC_DESIGN |

## 14 · 最新裁决的逐动作与状态补充

| 动作 | Journey用户目的 | 控件/真实读取或提交 | 失败与最低反例 |
| --- | --- | --- | --- |
| 当前APK/JS/runtime输入＋查询/重置 | 找到当前版本的启用终端 | 三个Input；query/currentactual SQL过滤，列可核对 | 没点查询不改前沿；跨页/NO_REPORT/切scope旧回包；不拿target过滤 |
| 历史上一页/下一页/失败重试 | 查历次任务报告 | 标准Table＋CursorPagination；getOperationsProjectTerminalUpdateReportHistoryPage | 同task两阶段只有一行、两task两行、101行分页不抽干；停用读回失败清旧内容 |
| 规则“操作历史” | 查谁创建/启停规则 | AdminDetailActionMenu入口→OperationsAuditHistoryModal→既有通用audit GET | 无写cap可读；异PROJECT拒绝、幂等一次审计、切scope关闭 |
| 保存更新包 | 确认已上传/解析的真工件 | 唯一PKG_SAVE Button；同stage/file/context的成功解析，HOT五事实通过才enabled | parsing/upload失败/换file/过期禁用；后台独立重验，不以按钮为授权 |

历史与最新共用UI4.2有限字典；技术细节保留的是APK/JS/runtime等实际字段，秘密与原异常从未获准展示。新增附属审计Modal依旧只有两个管理后台内容页、两个路由。
