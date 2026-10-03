# TDP 数据变化通知与远程运维 · 正式需求

```text
DOC_KIND=FORMAL_REQUIREMENTS
AUTHOR=Claude
DATE=2026-10-03
STATUS=READY_FOR_REQUIREMENTS_REVIEW
BUSINESS_SOURCE=Dexter 本会话原始需求及逐项补充裁决；讨论稿 §1、本文 §10
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_REQUIREMENTS_2026-10-03
REVIEW_TARGET=DESIGN
EVIDENCE_TIER=需求整理与仓内静态源码；新能力动态 NOT_RUN
IMPLEMENTATION_AUTHORITY=false
CURRENT_BYTE_REVIEW=两轮已关闭；Dexter业务feature刷新、启动顺序及同步验收补充后的字节尚未独立评审
```

## 0 · 用户目标、范围与效力

本期让终端业务包及时获知 CBS 数据变化并主动更新自己拥有的数据；让 CBS 的内部业务模块
通过一项纯能力向在线终端发送 command，查询其执行过程和结果。基础设施须以实际业务消费者
形成闭环，不能只交付消息协议。本期没有前台页面、管理页面或权限产品功能。

本文将讨论中已确认行为整理为正式需求正本，不将作者建议升级为 Dexter 裁决。
已接受业务语汇与开发约束仍回读各自正本；讨论稿用于追溯，不再作为第二份可并行修改的需求。
本次授权仅为文档与两轮独立静态审查；需求评审 GO 不授权实施或动态运行。
正在实施的《终端激活交互与双机拓扑优化专项》保持其自身范围与授权。

### 0.1 · 包含与排除

包含：共享 topic/远程操作契约；CBS 变化发布、范围缓存与 terminal-control 能力；
TDS 订阅/变化通知/远程转发；TDC 通用订阅、通知、远程执行及记录补报；
两个新增 kernel/feature 的真实 HTTP 消费、持久化、订阅和主副机同步；
无业务副作用的 helloWorld 远程闭环；相关原始更新时间盘点与必要接线。

排除：订单、会员等未有业务的实现；全部 CBS 模块一次性接入；管理 HTTP 暴露面或页面；
角色/权限模型；离线 command 排队或补执行；本期CBS远程脚本业务接入；新的业务 deployable/数据库；
MQ、通用 outbox、通用持久消息队列、常态轮询；Doris 新业务用途；生产 HA/长期容量承诺。
本期持久远程执行事实补报是具名能力，不扩展为其他消息的通用投递系统。

B及两个数据feature只建设、验收业务数据取得/通知/刷新/持久化/订退/主副同步，
不新增TER对门店停用、经营规则、合同有效性或服务点状态的业务决策/联动。
例如门店被停用，TER需同步其真实DISABLED数据，但本期不要求据此登出、停机、阻断业务或取消激活。
集合条件、成员增退和时间确认属于同步正确性，仍须验证；不改变CBS既有业务约束、鉴权及已批准会话行为。
此边界不撤回C的helloWorld、远程过程/结果持久化及补报验收。

### 0.2 · 成功判据与简单方案

成功体现为：当前主机业务数据与相关范围成员得到正确刷新，成员退订不影响其他消费者；
副机仅消费主机同步的业务数据；在线远程操作可查，断链后实际保存的执行事实可以补报，
没有重复执行、虚构成功或跨绑定污染。

采用既有 CBS owner、PostgreSQL、TDS/TDC 会话、TER command/request/selector、
持久化与主副机同步能力。无需人工递增版本、通用搜索引擎、业务 HTTP 重试框架或完整 ledger 持久化。
具体代码结构和接口签名由后续详设决定；本需求固定的是职责、业务语义与可验收行为。

## 1 · 统一术语与唯一 owner（R-01～R-03）

### R-01 · 术语及既有在线能力

| 名称 | 定义与路径 | 本期职责 |
| --- | --- | --- |
| CBS | Catering Business Server；`apps/backend/catering-business-server` | 业务事实、HTTP 读取、变化发布、远程操作能力 |
| TDP | Terminal Data Platform；TDS + TDC 长连接整体 | A 在线互知；B 数据变化通知；C 远程指令。本期建设 B/C |
| TDS | `apps/backend/terminal-data-server` | 已鉴权连接、订阅、通知、转发，不拥有业务写入 |
| TDC | `apps/terminal/kernel/base/terminal-data-client` | 凭证与业务协议 owner，通用 topic/远程操作基础能力 |
| feature | TER kernel/feature 业务包 | 自己的业务 HTTP、数据、状态、持久化、订阅意图与同步 |

统一用语的规范正本为 `doc/platform/terminal-coding-standard.md` §4-F；项目记忆只保留其指针。
本期沿用激活、SESSION_READY、心跳、PG 跨节点会话权威，不重建 A，不启用旧 TDP placeholder。

### R-02 · 事实与接口闭包

CBS 业务 owner 保有原始业务数据与写命令主权，范围派生缓存也由相应业务 owner 负责一致性；
TDS 不建立自己的业务正文或每节点范围事实。Doris 继续仅承载连接/断开/RTT 历史。
CBS terminal-control 拥有远程操作记录；TDC 拥有协议订阅时间与终端远程记录；
业务 feature 拥有实际业务数据及原始时间，不能把 TDC 的已接受通知时间写成实体 updatedAt。

TER 业务动作必须经 command/actor，读数据或状态必须经公开 selector；事件进入业务方亦为 command。
不发明第二事件总线、业务回调协议或直接跨包读 state/persistence。CBS 仍使用其公开 command/read API。
feature 不读取/复制 credentialSecret；业务 HTTP 认证由 TDC 凭证 owner 与既有公开接线闭合。
server-config 管地址/代理，transport 管可靠通信与连接切换；二者不接管 topic 业务。

### R-03 · 契约与真实身份

contracts 是 topic 类型、有限 scope/条件、消息和 CBS 可下发 command 定义的 canonical 来源；
生成到 TDC，不由各 feature 手抄字符串。生成输入须满足仓根与符号链接 fail-closed 约束。
同一 topic 的身份包含类型与完整 scope；不能仅凭实体 UUID 区分集团/门店。
CBS/TDS 根据现有终端绑定、集团空间、门店与当前 session 核验目标/读取/订阅；客户端 ref 不是授权。
topic 注册不授予之后 HTTP 写入/读取权，旧绑定/旧会话消息和回包不能污染新身份。

## 2 · 原始时间与范围事实（R-04～R-06）

### R-04 · 更新时间语义、统一盘点及可靠性边界

topic 时间使用业务记录**原始更新时间 long**，不使用自然数 version、人工单调水位、收包时间、
心跳时间或 revision。现有乐观锁版本和发布 revision 保持自己的含义。
本期盘点 CBS 各业务实体：时间字段、单位、赋值来源、创建/更新/状态退出/删除、聚合影响范围，
明确本期十一类 topic 的来源及 terminal HTTP 所需字段。其余模块记录候选与缺口，不据此全仓迁移。
wire 必须明确单位并可无损表达；统一单位与整数校验方案在详设中确定，不改写真实记录时刻。

初次订阅与重连核对使用时间**不相等**触发刷新，不只比较 remote > local。
在线实际业务变化通知当前订阅者，即便原始时间相等；未订阅者不接收。
同毫秒、时钟回拨/提交倒序使时间不足以证明内容顺序；时间相等的漏通知不能靠重连比较发现。
不承诺每次漏失最终补齐，不因此添加轮询、持久消息队列或新版本机制。

硬删除后不能虚构该行新的时间；聚合缺时间不能以 revision 冒充。本期既有状态退出路径复用真实时间，
候选 topic 的删除/聚合/权限衍生缺口须在启用前明确来源；不启用来源不成立的 topic。

### R-05 · 范围 topic 的有限条件和更新时间

范围是 scope 内根据一个或几个明确状态属性搜索出的**无序、去重 refIds 集合**；
contract 定义条件闭集，不接受自由 SQL/任意搜索表达式，不增加排名/排序语义。
实体创建、状态变化及业务owner原本允许的scope变化均核验相关范围，不仅监听名称为status的字段。
本条不新增实体移店、改项目、服务点移区等业务command，不解除既有不可变关系。

A＝触发实体已生效的原始更新时间；B＝新非空集合成员原始更新时间最大值。

| 旧/新 refIds | topic 时间与行为 |
| --- | --- |
| 集合相等，包括空→空、返回顺序不同 | 保持已缓存时间，不发布范围更新 |
| 空→非空 | 时间 B，替换集合 |
| 非空→空 | 时间 A，保留空集合与 A |
| 两边非空且成员不同 | 时间 A，替换集合 |

成员内容更新但 refIds 不变，不更新范围时间，使用成员精确 topic。
实际成员改变即使 A 等于旧时间，在线仍按变化通知；离线同值比较仍受 R-04 限制。
合同 valid 采用当前 ACTIVE 状态，排除 INVALID；自然过期不进入范围条件，
不复用 CURRENT/PENDING/HISTORY 的日期筛选，不改名数据库枚举。

### R-06 · PostgreSQL 缓存与一致快照

CBS 侧在现有 PostgreSQL 持久保存 `(topic 类型 + scope, refIds, topic 时间)`，不存业务正文。
原始写入与相关范围更新须有一致提交/失败语义，并发重算不能让旧集合覆盖新集合。
提交后才通知；TDS listener 建立/重建须核对当前有效订阅的权威状态，通知只作唤醒。
可复用现有 PG 通知，不推导其具有离线持久可靠性；具体最小接线由详设核实。

缓存重启读回空集合与 A，不重算成 0。首次从无缓存初始化的空集合表示及批量触发时 A 的选择，
属于 §8 明列的详设准入项，不能无依据宣称本期已作产品裁决。
HTTP 范围读取须得到完整 refIds 与首次计算时间所需的真实成员时间，不能把第一分页当全集；
数据与其时间须对应可观察的一致快照，不能拼接不同快照页面后声称最新。
WS 通知只携带 topic/时间和必要关联，不把无限集合正文塞入现有 65,536 字节消息。

## 3 · 订阅与 feature 更新链（R-07～R-10）

### R-07 · 初始加载、已激活启动与 ready

主机feature按各自批准的启动前提请求HTTP：store-basic由激活成功command启动，
store-service-point须等R-11/R-12的门店基础信息获取成功command，不由激活或TDC ready直接查询。
前提满足后，以当前绑定身份经自己的刷新command请求HTTP，
应用并持久保存业务 slice，然后经 TDC command 登记订阅及**初始**本地时间。
精确实体取原始时间；范围取已取得成员原始时间最大值，空结果取 **0**。
不论旧本地版本是否存在/为空均执行初始加载；已经激活的应用重启或晚安装 feature，
须从公开selector核对激活及本包业务前提后，经command复用该刷新链，不要求重新激活。
store-service-point不能仅凭已激活或持久化的旧门店数据绕过本次门店基础信息成功获取前提。

TDC 未 ready 时保留合法订阅意图，SESSION_READY 后发送；已 ready 则登记后立即提交。
ready 广播为主机 command，不能宣称 feature 数据已取得，也不等待所有 feature HTTP 成功才 ready。
ready 早于/晚于 HTTP、激活事件与 ready 交错均不得漏登记或重复建立业务入口。

业务slice按业务任务组织，与TDC topic不要求一一对应。一次业务集合/组合HTTP读取可服务多个topic，
feature复用已返回的完整数据，不因订阅多个topic就拆成相同数量的HTTP请求或重复业务事实。
具体长期约束回读终端规范§4-F“使用TDC的业务feature加载与刷新”；数据仍只由本包actor提交。

### R-08 · 更新接受确认与共享订阅

TDS 向当前订阅会话发topic最新时间；TDC广播主机command；相关feature复用本包刷新command，
按范围或精确详情topic选择集合或单实体HTTP，不强制每次重拉初始全量业务数据。
HTTP成功且应用/持久化成功后确认**该条更新已接受**。TDC采用该服务端时间，不让feature重算覆盖。
例：首次空集合为0，TDS 通知100，再取仍空，feature 确认接受，TDC 时间成为100。
业务记录仍保留自己的时间，范围通知100不是成员数据 updatedAt。

接受确认须关联 topic、绑定及具体通知；旧100确认不得确认200，不得回滚已接受的后续通知。
重复确认、退订后确认、旧身份/旧 HTTP 结果不能污染当前数据或订阅。
业务时间不必递增，通知的本地处理关联不能靠时间数值大小排序；具体有限关联由详设定义。
HTTP 或持久化失败不发成功确认，当前数据/加载/失败通过 feature selector 可见。

多个 feature 可订阅同 topic；退订只解除自己的意图，最后一个解除才停止通道订阅。
初始化之后不用多包计算时间互相覆盖，不保留旧“最后收到版本覆盖并 WARN”建议。
X 成功确认不等于 Y 成功；Y 的刷新失败、旧数据与后续处理由 Y 本包负责。
不增加 TDP 统一业务恢复/重试、全包屏障或服务端 per-feature 版本。

### R-09 · 目录与详情的增退闭包

范围 `{A,B}→{A}`：保留 A 详情订阅，解除本包 B 详情订阅，并移除当前集合中的 B。
范围通知后先查询最新完整业务结果，与本slice旧数据按业务ref比较成员和已返回内容；
更新、持久化本地后，再经TDC公开command为新增成员登记详情订阅、为移出成员解除本包订阅。
保留成员不重复退订重订。集合已返回完整详情时直接复用，不重复查各成员；只有ref/摘要或所需字段
不足时才补查必要缺失详情，不能把不完整结果当完整业务数据。空集合解除本包全部成员详情，但保留范围订阅。
其他 feature 的 B 订阅不受影响。范围与详情自身时间分开，不能用一个范围时间标记全部正文。
仍有效成员的精确详情topic通知必须调用单实体详情HTTP，更新同一slice中的该成员，不能因其已在列表中
而跳过，也不为该通知默认重拉整个集合。详情显示成员已退出范围时更新成员及订阅，不重新插回失效对象。
迟到 B 响应/通知不能重新插入已移出的成员或恢复退订。
范围应用成功但个别详情失败，不伪造所有详情成功，不回滚已经接受的范围；本包保留可见的成员失败。
旧绑定/旧 ref 关系链失效后，取消旧相关订阅，新身份重新初始化，迟到结果不写新身份数据。

### R-10 · 主机与副机

副机 SLAVE 不独立连接 TDS，不登记订阅，不收到 TDC ready/topic 广播，不独立 HTTP 刷新本期 TDP 数据。
主机 MASTER feature 持久化后，经既有 owner 同步把业务数据和原始时间同步到副机，副机用 selector 消费。
继承既有断链/重连与身份隔离；不另建副机通知系统。
本条不覆盖本机 BRANCH 输入、壁纸等已获批本地状态，不以业务更新时间替代拓扑 revision/session 顺序。

## 4 · 本期真实 topic/HTTP 消费清单（R-11～R-12）

### R-11 · `kernel/feature/store-basic`

计划路径 `apps/terminal/kernel/feature/store-basic`，只承担本包业务数据，不提供 UI。

本包取得当前绑定门店基础信息、经actor应用并持久化成功后，广播主机
`storeBasicInformationLoadedCommand`（能力名可在详设中等义确定）。该command表示门店基础信息
已成功取得，不是激活发起、HTTP开始或整个store-basic包全部数据ready；不等待项目/大区/集团/合同
等其他查询全部完成。广播携带必要绑定/门店身份，消费者用本包公开selector读取基础信息及本次加载状态，
不把整份门店事实复制进另一包或另造callback/事件总线。门店查询或持久化失败不广播成功。

| 订阅事实 | 类型与 scope | 真实来源/边界 |
| --- | --- | --- |
| 门店基础信息 | 精确，当前 storeRef | organization store 原始 updatedAt |
| 项目基础信息 | 精确，当前 projectRef | PROJECT 自身 updatedAt |
| 大区基础信息 | 精确，当前 regionRef | REGION 自身 updatedAt |
| 集团基础信息 | 精确，当前 commercialGroupRef | commercial_group；不是集团空间配置或 GROUP 组织节点 |
| 门店经营规则 | 精确，当前 storeRef | store 根 JSON 与原始时间；独立 topic 身份，可复用门店 HTTP |
| 门店 valid 合同结果集 | 范围，storeRef + ACTIVE | 全集，无自然到期筛选；R-05/R-06 |
| 合同详情 | 精确，每个当前 contractRef | 合同本身原始时间；成员增退 R-09 |

scope 来自当前激活摘要及 CBS 权威复核；真实组织链为 store.projectId → PROJECT.parentId(REGION)。
集团由已验证集团空间解析，不能沿REGION.parentId猜集团。门店项目、经营租户、品牌仍按既有规则锁定。
绑定合法切换至另一门店时，退订旧门店关系链的project/region等topic，并初始化新绑定的相关实体；
不通过修改原门店的不可变关系制造订阅切换。
任务型组合读取可复用既有 owner read，但每实体保留自己的时间，不用门店时间代表其他实体。
合同初始化以一个门店ACTIVE合同查询取得全部有效合同的完整业务资料及各自原始时间，保存为本包合同列表；
据此登记合同范围和全部成员详情topic，不再逐个补查已完整取得的合同。范围变化复用该集合查询并按R-09
差量订退；单合同详情通知查询该合同详情并更新同一列表，不另建按topic复制的合同事实。
补齐所需 terminal 读取契约/原始时间；不强迫复用 operations-admin 登录或凭证泄露接口。

### R-12 · `kernel/feature/store-service-point`

计划路径 `apps/terminal/kernel/feature/store-service-point`。激活后只等待门店业务前提，不主动查询；
本包actor接收store-basic的门店基础信息获取成功command，核对当前有效绑定及公开门店selector后，
才发起本包区域/服务点查询，应用持久化成功后登记本包topic。TDC ready不能绕过此前提。
门店基础信息失败时不查询；点位查询失败由本包处理，不回滚门店基础信息成功，也不要求全包ready屏障。

已激活重启仍先由store-basic完成本次门店基础信息HTTP获取及成功广播；不能用旧持久化缓存代替。
晚加载若错过广播，可从store-basic公开selector确认当前绑定在本次启动已成功获取门店信息，
再经同一初始化command启动；selector补读不是绕过前提的第二业务入口。重复成功command在初始化
进行中不重复查询，当前绑定已初始化成功时不重做初始全量；失败不能标为已初始化。
已初始化后的topic更新按本包刷新链处理，不因普通门店信息再次刷新而重做区域/点位全量查询。
换绑定或取消激活使旧启动前提失效，旧门店成功command及迟到响应不能启动/污染新门店数据。

| 订阅事实 | 类型与 scope | 边界 |
| --- | --- | --- |
| 服务点区域目录 | 范围，全门店 area.status=ENABLED | 排除 DISABLED/VOIDED；完整无序 areaRefs |
| 服务点区域详情 | 精确，每个当前 areaRef | Area 自身原始 updatedAt |
| 服务点目录 | 范围，全门店 point.status=ENABLED | 排除 DISABLED/VOIDED；不是按区域的目录 |
| 服务点详情 | 精确，每个当前 pointRef | Point 自身原始 updatedAt，包含自身 areaRef 等本期事实 |

不复用“非 VOIDED”运营目录谓词，不把 effectiveAvailable/父区域可用性偷加到范围条件。
当前point所属areaRef不通过updatePoint/movePoint改变，本期不新增移区能力。
同店ENABLED point名称等允许修改的内容变化，目录refIds不变，由精确详情通知；
既有movePoint只在原区域重排，顺序不成为范围成员变化。
区域停用使区域目录成员退出，不伪造 point 自身状态改变。二维码/衍生关联数据不自动新增 topic。
两个包各自拥有业务 slice/公开 command 与 selector、持久化与主机同步；共性先复用已有基础能力，
少量重复不作为新增通用框架理由。

## 5 · 远程运维能力（R-13～R-17）

### R-13 · terminal-control 与通用 command/request 链

CBS 新增纯能力 owner `terminal-control`，计划位于 CBS `modules/terminal-control`，
内部公开 command 发起、read API 查询；不新增管理面、角色/capability 或权限产品流程。
它持久保存操作身份、发送记录、执行过程、执行结果与未知状态，使用现有 PostgreSQL/单一 Flyway。
其他业务模块未来调用本 owner 的公开 API；不跨 schema 写记录。

CBS terminal-control → 当前权威目标 TDS session → TDC → 既有 runtime command → owning actor；
执行过程/结果经 TDC → TDS → CBS terminal-control，CBS 用公开 read API 查询。
TDS/TDC 不按业务类别硬编码允许表；可执行已有注册 command，CBS 实际下发范围/参数/结果由 contract 约束。
本期CBS不接入远程脚本业务，不远程安装新command定义；TDS/TDC不另设已注册command类别禁令，
不撤回既有scripts.execute裁决。仍不绕过runtime owner，双方校验契约与真实身份。
unknown command、未安装能力、非法参数、协议不支持、失效身份须可区分，不算成功执行。
远程目标是在线 MASTER；runtime peer 是已配对副机，不是服务器。若现有命令自身路由 peer，
沿命令 owner 的已批准规则，不由服务器伪造拓扑事实。

### R-14 · 在线投递、有限关联及未知结果

离线拒绝且记录未送达，不排队；已发送不代表已执行。超时/断链允许结果未知，
未知不等于未执行、失败或回滚；不自动重发任何有副作用 command。
相同 operation 的重复投递不重复执行，wire request 与本地 request/parent/root 保持关联；
有限记录范围内识别重复，不能以“重连补报”恢复旧 actor 或重新派发原 command。
不承诺跨系统 exactly-once。超时不保证底层动作停止，取消激活/重启可断开自己的回传。

CBS 发起意图先持久保存，在线检查/投递失败也保存真实状态。
日志、内存 ledger、response 都不能替代发送/过程/结果记录；结果未知本身须可查询。
只保留实际观测的 request/actor 生命周期及必要子 command 关联，不要求各业务实现百分比进度。
参数/结果按 contract 有限 schema 保存，不导出全部 ledger、业务 state、凭证或原始敏感 payload。

### R-15 · 终端持久记录与重连补报

TDC 仅对远程操作相关 request 保存实际接收/开始/执行阶段/结果、操作身份、绑定身份、
wire/local request 关联及原发生时间，复用现有持久化，不改变所有本地 command 的 ledger 策略。
持久失败可观察，不宣称记录可靠保存；已存在记录在应用重启后可读回。
恢复只恢复记录及待补报事实，不恢复 actor 执行，不凭空重建崩溃前未保存的阶段。

在线回传和重连补报复用同一 command 链；补报当前有效连接下的旧操作事实，保留原身份，
不能重绑到新门店/集团操作。CBS 对重复/乱序事实幂等接纳，旧阶段不得覆盖完成阶段。
CBS 持久接收确认后终端才标记对应事实已回传；WS send 成功不是该确认。
确认丢失重报同一事实，不重执行 command。未知可被晚到实际结果解释，仍保留曾超时/未知的历史。
失效绑定、取消激活/换店后历史记录的保存与接纳边界须按 §8 明确，不静默丢弃也不放宽现有鉴权。

### R-16 · 有界、故障可见及记录清理

注册、待处理通知、远程 inflight、单记录/结果体、补报批次与持久记录均须有明确界限，
复用既有 full/decompressed 65,536 字节协议边界；不将无限正文或日志流放入 WS。
具体数值、期限和释放条件由详设基于既有能力/规模证据确定，不伪装为 Dexter 已批准数值。
不能安全保存远程操作记录时，不假装已经接受可靠执行；容量拒绝/存储失败须有可查结果。
记录何时删除须有明确策略与准入，不能静默删除未获持久确认的事实；详设前闭合 §8。
补报/通知积压不得饿死心跳或阻塞 WS/业务 HTTP 主流程；故障可隔离、可关联且脱敏。
不为每个 feature 额外建设统一业务重试或为通用运维建设离线执行队列。

### R-17 · 无业务副作用闭环

在 kernel/base 以已注册 `helloWorldCommand`（最终能力名由详设确定）验证通用下发与 request 结果，
返回 contract 允许的安全终端信息，不激活/取消、不改地址、不登出、不改业务数据。
通过 terminal-control 纯能力及真实 TDS/TDC/runtime 执行，不为验收新增公开管理 endpoint。
身份/来源校验仍适用；“不涉及权限功能”不等于匿名任意执行。

## 6 · 当前/未来 CBS topic 清单与源码依据（R-18）

本期 topic 是 R-11/R-12 的十一类，具体名称与 scope schema 待 contract 详设，不以表格展示名代替生成值。
下列候选仅完成业务映射/原始时间盘点，不实现消费者或宣称全部支持：

| 候选业务事实 | 精确/范围用途 | 本期之外的必要闭合 |
| --- | --- | --- |
| 品牌、渠道及经营配置 | 实体/门店或品牌范围 | 实体/集合时间与真实业务读取身份 |
| 菜单及发布投影、商品/价格/识别/生产规则 | 实体/生效集合 | 聚合 updatedAt 缺口；不能复用 revision 当时间 |
| 优惠、积分、库存与其他交易前规则 | 实体/状态范围 | 实际聚合来源、删除与衍生依赖范围 |
| 账号、角色、用户有效权限 | 动态精确/相关范围 | 多实体依赖与授权读回，不能只看 account.updatedAt |
| 会员、订单及未完成订单范围 | 未来精确/范围 | CBS 当前无对应订单模块，不新增业务 |

全面时间盘点入口为讨论稿 §9 的十八个 CBS owner 分类；后续以真实 owning source 复核，
不能把静态清单当成已迁移或已实现。历史 newPOSv1 POC 只作经验来源：WS 通知、HTTP 拉取可复用思路，
旧命名/RTKQuery/SSE/本地 ledger 不直接成为本仓实施输入或 fallback。

## 7 · 验收需求、执行面与证据等级（R-19）

以下均为**计划/NOT_RUN**。场景 ID 是需求追踪，不命名生产类/目录；
详设/计划必须为每项落实当前受管入口、fixture、真实断言、资源身份/预算/cleanup，不发明不存在的入口。
非 adapter TER 行为先 ui/integration Expo Web，再 application VM/device，用同一场景清单证明一致。
后台真实业务走 backend-acceptance 的 HTTP/容器；TDS WS 协议独立 CONTRACT，能力断言不冒充 HTTP。

| V / 对应 R | 场景与业务 oracle | 计划执行面 |
| --- | --- | --- |
| V-01 / R-01～03 | canonical/生成 topic、scope/command schema；未知/非法输入拒绝，包依赖和 secret owner 不漂移 | 生成所属自测/静态检查，TDS/TDC focused |
| V-02 / R-03,11 | 正常与跨集团/门店 ref HTTP、订阅身份；不能借公开 ref 读外店数据 | 真实 terminal HTTP + WS |
| V-03 / R-04 | 同值真实在线变化仍通知；不同/倒退时间重读；同值漏失限制如实记录 | CBS/TDS + TER focused |
| V-04 / R-05,06 | 空空不动、空非空 B、非空空 A、非空非空 A、返回顺序不改变；内容变化只精确通知 | PG 真实容器 + WS |
| V-05 / R-05,11 | ACTIVE 自然过期仍在 valid；INVALID 移出；日期变化不造范围更新 | 真实合同 HTTP/PG + feature |
| V-06 / R-06 | 并发创建/状态退出、不同门店scope隔离、提交失败、listener重建与缓存重启，空缓存A不丢；不制造合同移店 | 真实 PG/TDS，确定性 barrier |
| V-07 / R-06,11,12 | 完整refIds/业务资料/同快照时间，不能第一分页或跨快照拼集；完整集合数据复用于多个topic，摘要不足只补必要详情；大结果不塞WS | terminal HTTP + bounded focused |
| V-08 / R-07,11,12 | 新激活/已激活启动：store-basic成功取得并保存门店后广播，store-service-point此前HTTP为0；不等待其他store-basic查询全部成功；TDC ready交错不绕前提；门店失败不启动，晚加载selector补读走同一command、重复成功不重复初始化，旧绑定成功被拒 | Expo Web → VM/device；真实 DEV TDS |
| V-09 / R-08 | 首次空0、远程100、再次空确认后 TDC100；业务时间未被冒写 | 同上 + focused |
| V-10 / R-08 | T1 HTTP 中收到 T2、倒序/重复/退订后/旧绑定回包，不能错误确认或覆写 | TER 确定性 focused + Web/VM |
| V-11 / R-08 | X/Y 共订、X退订Y仍订；X成功Y失败可见且由Y处理；无版本互相覆盖 | TER focused + Web/VM |
| V-12 / R-07,09,11 | 初始一次完整合同集合查询登记范围及各详情，不逐个重复读取；A/B→A/C比较并更新同一列表，只退B/订C，C已完整返回不另查；单A通知查A详情，失效不重插；全空/迟到B/详情与集合交错及部分失败，增退身份正确 | CBS HTTP/WS + Web/VM |
| V-13 / R-11 | 门店→项目→大区/集团真实关系；绑定切换另一门店时退旧订新，不修改锁定关系；各实体保留自身原始时间，经营规则topic身份独立但使用门店根时间 | CBS HTTP + feature + DEV |
| V-14 / R-09,12 | 门店基础信息成功后加载全店ENABLED区域/点目录；本包失败不回滚store-basic成功，成功后按自身topic刷新；既有创建/启停/作废/内容更新/详情增退及原区域内排序，非VOIDED不能替代；不新增移区 | CBS HTTP/WS + Web/VM |
| V-15 / R-10 | MASTER下载持久并同步、SLAVE只读；断链/重连和换身份不混数据、不另连接/订阅/拉取 | paired Web → 双机 VM/device |
| V-16 / R-13,17 | terminal-control→TDS→TDC→helloWorld→request结果→CBS读回；无业务副作用 | 纯能力 + 真实 WS/TER/PG，DEV |
| V-17 / R-13,14 | unknown/uninstalled/参数非法、离线、发送失败：结果可区分、发送记录真实 | 能力/WS + TER focused |
| V-18 / R-14 | operation重复、request关联、执行中断链/超时：不重执行，未知不伪装失败/回滚 | 真实 WS + runtime focused/DEV |
| V-19 / R-15 | 终端保存过程/结果，应用重启后读回，仅补报不重启actor；CBS重启读回 | TER persistence 双断言 + PG |
| V-20 / R-15 | 重连补报、CBS确认丢失重报、乱序/重复不回退、晚到结果保留未知历史 | 真实 PG/WS + TER/DEV |
| V-21 / R-15,16 | 终端存储失败/达到界限，不能伪称持久成功或删除未确认记录 | 确定性 persistence/协议红例 |
| V-22 / R-03,15 | 换绑定/取消激活/旧session补报，按获批接纳规则保留原身份、不泄露跨店记录 | §8先闭合后能力/WS/TER |
| V-23 / R-16 | 消息/记录/补报有界、慢接收/积压不饿死心跳；故障日志关联脱敏 | focused + 受管真实 WS/DEV |
| V-24 / R-18 | CBS时间清单逐 owner 有来源/缺口，未接入候选与本期分母明确 | 静态 source-to-contract 对账 |

每个动态场景须单列 business/contract 与 fixture/runner cleanup，首败日志保留并诊断。
本阶段没有编译、生成、测试、verify、DEV、acceptance、reset/seed、L2、UAT 或部署证据。
历史批次运行证明仅适用于其原字节/场景；本期不得继承为PASS。已有DEV管理后台用于真实数据修改，
不代表新增前台功能；该DEV→TER验证不冒称隔离Browser L2或UAT，本请求仍不授权任何动态运行。

### 7.1 · DEV数据同步必测清单（详设必须包含且不限于此）

下表为B及两个数据feature的最低场景分母，全部为计划/NOT_RUN。详设§11a与实施计划须逐项映射
到真实执行入口、fixture、管理后台操作、CBS/TDS/TDC/feature日志与断言、TER公开selector、
持久化及主副同步证据、失败诊断和fixture/runner cleanup；不能用笼统“覆盖数据同步”替代。
场景编号只作需求追踪，不进入生产或测试类/目录命名；可在同一受管run组合执行，不要求重复全量运行。

DEV-DATA-01～12由DEV运营管理后台现有控件发起获批修改并经真实CBS owner提交，
TER必须通过真实TDS通知、TDC广播、feature HTTP和command/actor更新业务数据。
详设须选择当前实际可编辑字段/合法状态，不新增移店/改项目/移区业务；运行前建立合法测试资料。
不得以直接改PG、写本地slice、手动广播或mock替代该DEV链路，也不能用HTTP成功或WS收包代替数据断言。

| 必测场景 / 对应V | DEV操作或输入 | 必须证明的数据事实 |
| --- | --- | --- |
| DEV-DATA-01 / V03,13 | 管理后台修改当前门店名称/备注等真实可编辑资料 | store-basic门店数据刷新、原始时间正确、持久化成功；无手动TER刷新 |
| DEV-DATA-02 / V03,13 | 后台停用/重新启用测试门店 | TER同步真实状态及原始时间；只验数据同步，不要求TER新增停用业务处理 |
| DEV-DATA-03 / V13 | 修改当前关联项目的可编辑资料 | 项目数据刷新，保留项目自身时间，不用门店时间代替、不修改锁定关联 |
| DEV-DATA-04 / V13 | 修改当前关联大区的可编辑资料 | 大区数据刷新，保留大区自身时间，不依赖门店topic变化才刷新 |
| DEV-DATA-05 / V13 | 修改当前商业集团的可编辑资料 | commercialGroup数据刷新；不把集团空间或组织GROUP节点当集团资料 |
| DEV-DATA-06 / V13 | 后台修改门店经营规则配置 | 规则数据同步，规则topic身份独立而时间沿用store根；不测试规则对订单/经营的业务效果 |
| DEV-DATA-07 / V04,05,12 | 后台新建ACTIVE合同、失效合同，使集合经历空→非空、非空→非空不同、非空→空 | 完整有效合同列表更新、A/B规则及详情差量订退正确；不测试合同对经营资格的业务处理 |
| DEV-DATA-08 / V03,12 | 修改一个仍ACTIVE合同的可编辑正文，范围成员不变 | 单合同详情topic触发单详情HTTP，更新同一列表；不假定有范围通知，不重复读取所有合同 |
| DEV-DATA-09 / V04,14 | 后台创建/启停/合法作废区域，改变全门店ENABLED区域集合 | 区域列表及成员详情订退正确；空集仍保留范围订阅，不额外推导点状态改变 |
| DEV-DATA-10 / V03,14 | 修改一个仍ENABLED区域的可编辑详情，集合成员不变 | 精确区域详情通知和单详情读取更新同一数据；不把内容修改当范围成员改变 |
| DEV-DATA-11 / V04,14 | 后台创建/启停/合法作废服务点，改变全门店ENABLED点集合 | 点列表及详情增退正确，不按area拆范围、不新增移区业务或父区状态筛选 |
| DEV-DATA-12 / V03,14 | 修改一个仍ENABLED服务点名称等可编辑详情，集合成员不变 | 精确点详情通知、单详情HTTP与本地更新正确；不测试可用性对下单等业务影响 |
| DEV-DATA-13 / V08,14 | 新激活、已激活重启；门店查询延迟/失败、其他store-basic资料尚未完成、晚加载/重复广播 | store-service-point只在当前门店基础信息成功后查询；不提前查询、不等待全包、不重复初始化 |
| DEV-DATA-14 / V03,09,10 | TER断开期间后台修改数据，变化时间与本地不同，再恢复连接；另覆在线同值变化 | 重登记/差异通知/HTTP刷新/接受确认闭合；在线同值仍通知，不升级为离线同值必恢复承诺 |
| DEV-DATA-15 / V15 | 主副配对拓扑中执行上述十一类topic的后台修改 | 主机数据与副机公开selector投影一致；副机无独立TDS订阅或同份业务HTTP；断链恢复不串身份 |
| DEV-DATA-16 / V07,08,10,11,12 | 确定性HTTP/持久化失败、范围与详情交错、迟到/重复/退订后消息、共订者单包失败 | 不虚构确认、不复活移出成员、不互相退订；完整响应复用、缺详情才补查，失败由本feature可见处理 |

DEV-DATA-13/16中的故障注入与竞态可由相应focused执行面辅助证明，但不得替代01～12的真实DEV后台
修改链路和15的配对同步。非adapter TER逻辑仍按同一清单先Expo Web再application VM/device。
每项记录后台写入前后权威值、topic身份/通知关联、实际HTTP查询种类及feature/主副selector最终数据，
并证明正确持久化；使用已有数据字段及安全诊断，不以新增业务页面承载验证。
详设必须确定可复验的观察/超时判据及受管资源身份/清理，不以魔法等待或无新日志的反复重试冒充成功。

“仅数据同步”不免除scope/身份、完整集合、原始时间、持久化、订退、失败可见和并发正确性断言。
它排除的是TER据业务状态新增业务command、路由或资格判断；CBS现有管理操作的合法准入仍遵守原规则。
远程运维V16～23继续按各自要求验证，不以本数据清单替代。该清单只固定将来必测要求，不授权现在
启动DEV/浏览器/终端、改业务数据、reset/seed或执行L2/UAT。

## 8 · 详设准入与未决事项（R-20）

下列事项不能留到动态验收才发现；它们不是要求本阶段编写详设，也不是隐含实施授权。
后续详设交审前须落成最小方案与异常验收；只有涉及改变既定产品语义才回 Dexter：

| 项目 | 必须明确的内容 | 当前性质/裁决边界 |
| --- | --- | --- |
| 原始时间与初始化 | wire单位/无损范围；CBS无缓存空集合如何初始化；一次批量触发A来源 | 技术设计OPEN；不引入新时钟/逻辑版本，改变A/B须Dexter |
| HTTP/契约生成 | 实际terminal身份读取、DTO原始时间/完整合同集合资料/单合同详情、canonical→materialize/codegen→feature接线；集合/详情更新同一slice并复用已返回字段 | 技术设计OPEN；不直接复用管理员会话，不泄露凭证，不把现有readback冒充完整terminal接口 |
| feature启动前提 | store-basic门店成功command/公开selector、本次有效加载与当前绑定、store-service-point初始化command、晚加载与重复/失败隔离 | 技术设计OPEN；不把门店加载变成全包屏障，不凭旧缓存或TDC ready启动，不新增统一调度框架 |
| DEV同步场景 | §7.1最低分母逐项映射真实后台控件/合法操作、受管DEV→TDS/TDC→feature→副机、数据/持久化/cleanup断言 | 技术设计OPEN；不以mock替真实链，不新增TER业务状态判断，不将DEV验收称L2/UAT |
| 事务与通知 | 业务owner/schema、缓存事务/并发、启动/重建读回、各TDS会话与通知路径 | 技术设计OPEN；不新增MQ/outbox/轮询 |
| 生命周期观察 | runtime公开观察与command链取得实际过程/晚到结果，TDC remote-only持久记录、actor/result关联 | 技术设计OPEN；当前ledger不持久且late-completed不携带result，不能仅复制selector就宣称接通；不暴露私有ledger或持久全部本地历史 |
| 容量与留存 | 具体界限、拒绝/故障可见、CBS和终端保存/确认后清理；容量证据 | 技术值待详设；删除未确认记录/保存期限产品取舍须Dexter，不默认无限保存 |
| 失效绑定历史补报 | 取消激活/换店后原记录保存与合法回传时机、CBS原操作接纳；核对当前仅保留server-config的取消激活/reset规则 | 接纳及留存冲突OPEN；不自行新增reset保留例外，不放宽鉴权/新身份重绑，产品冲突交Dexter |
| 既有能力及第三方 | 真实注册/持久化/同步/PG listener与writer复用；实际解析版本官方依据 | 技术设计OPEN；不得凭历史POC/相似API推导实现 |

本期文档是正式需求，Journey/IA/交互/implementation-design 四模板在此阶段
`NOT_APPLICABLE_WITH_REASON`：无前台任务且当前只授权需求，不将模板全文复制成未授权实施设计。
后续详设与计划仍必须使用适用模板和实施要求；本表不是免除其必填项。

## 9 · 原始材料与当前源码导航

1. 原始需求及讨论裁决：`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-requirements-discussion-claude.md` §1、§9；本文 §10 保留关键原话。
2. 规范/记忆：`doc/platform/terminal-coding-standard.md` §4-F；`project-memory/operations/terminal-coding-standard.md`；`project-memory/decisions/confirmed-business-language-corpus.md` 对应组织、门店、启停、合同条目。
3. 协议与生成：`contracts/protocol/terminal-connection-protocol.json`；`contracts/policy/terminal-client-generation.json`；`scripts/generate/terminal-client-api.mjs`。
4. TER：`apps/terminal/kernel/base/terminal-data-client/src/`；`runtime/src/types/execution.ts`、`runtime/src/features/slices/requestLedger.ts`、`runtime/src/selectors/selectRequestExecutionView.ts`、`runtime/src/application/createRuntime.ts`（均以 runtime 包根解析）；`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts`。
5. CBS：organization 的 StoreServicePointService/组织及集团 public read；store-contract 的 ContractTaskReadServiceSql/ContractCommandServiceSql/typed readback；`apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/time/SystemTimeProvider.java`。
6. TDS：TdsBindingRevocationListener、TdsConnectionStateRepository、TdsWebSocketConnection：既有权威/监听/有界通道，不推导已经实现新topic。
7. 历史POC：`doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` 及讨论稿 §6 引用；Heritage 只读，不做runtime/build输入。

源码仅说明可复用能力与缺口；TER 并发专项仍在变更，后续设计必须重开当时真实字节。
本节不宣称以上新包、topic、远程协议已存在，不以作者静态分析代替独立核验。

## 10 · Dexter 关键原话与裁决来源

以下是本会话业务输入摘录，按发生顺序保留；后句明确修正前句时，以后句为准。

> “本次需求范围不涉及前端功能，均为底层基础设施建设。”

> “只用业务记录原始更新时间，讨论其限制”

> “如何通知，取决于feature包订阅不订阅，以及feathre包发送的本地版本”

> “基础设施＋门店资料/合同范围真实闭环”

> “每个topic其实是一个搜索结果集（依据某个或某几个状态属性作为搜索条件，不排序，自然过期的合同不在搜索条件范围内）”

> “如果缓存的结果集（refIds）与新结果集无异，则topic不需要更新，如果缓存结果集是空，新结果集不是空，则以B作为topic更新时间，如果缓存结果集非空，新结果集是空，则以A作为topic更新时间。”

对非空→非空且集合不同的补充：

> “你的问题，明确用时间A，继续”

> “TER副机不会连TDS，TDC的广播也仅在主机广播，所有feature包的业务数据，都是从主机同步到副机的。”

两新feature消费清单与激活启动来自本会话逐项输入；服务点目录范围补充：

> “全门店仅启用集合”

> “feature包，比如门店valid合同集合有A和B，就需要订阅A和B的详情，如果集合变成了A，则要取消订阅B的详情”

后续时间确认修正原先多包最后时间覆盖提议：

> “feature包首次通过http服务拿到业务数据的时候是自己算的topic版本时间，如果结果集是空，则版本时间是0。”

> “这个时候再通知TDC的时候，应该通知topic更新已接受即可，然后TDC就自己把100当成是本地topic的时间，不需要用feature包的时间覆盖TDC的时间，也就不存在多个feature包时间冲突的问题”

> “远程 command 只接受在线执行、无离线补发、超时/断链允许结果未知，发送记录、执行过程、执行结果都需要持久化保存。CBS 需要新建一个terminal control的owner，不涉及前台管理，不涉及权限，是一个纯能力的模块，后续会集成到其他业务模块中。”

对可行性讨论的最终四项回复（1指在线同值变化通知、初次/重连差异核对及原始时间限制）：

> “1，同意
> 2，这个Y自己去处理，不需要上升到机制
> 3，终端也保存过程和结果，重连后补报，增加终端持久化及回传工作。
> 4，同意范围缓存建议直接在 PostgreSQL 保存 refIds＋topic时间”

正式需求与两轮审查授权：

> “请整理并生成正式的需求文档并完成两次对抗性review”

两轮结束后的业务feature通用刷新补充（本次仅维护需求与规范，不重开旧review cycle）：

> “业务slice里的业务数据和TDC的topic数据不一定是一一对应的，比如合同结果集，激活后，feature一个查询接口就获取了所有有效合同，保存成了一个列表。这个时候去订阅合同结果集与单一合同详情的多个topic。”

> “如果合同结果集topic变化了，feature需要拿到最新的结果，然后与slice中的旧数据进行比较，更新本地，然后再去订阅或取消订阅topic，尽量减少接口调用，但是当某个合同变化推送过来了，该查也还是要查单个合同详情的接口。”

后续启动顺序修正，以本条取代旧R-12独立从激活摘要启动的表述：

> “store-service-point包在激活后，不主动查询，等store-basic包已经获取到门店基础信息并广播门店基础信息获取成功command后，再执行查询”

后续必测场景与数据测试边界补充：

> “需求中还有明确必测试的场景（详设必须包含但不仅限于），比如通过DEV的管理后台更新了门店信息，TER要能同步更新等等。仅做各种数据同步的测试，不做业务逻辑判断，比如门店被停用，不需要TER业务处理”
