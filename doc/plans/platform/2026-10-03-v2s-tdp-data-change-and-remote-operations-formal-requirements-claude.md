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
CURRENT_BYTE_REVIEW=原两轮已关闭；当前后续修订只完成作者全文一致性校正，尚无当前字节独立整批verdict
SCOPE_AMENDMENT=Dexter明确补齐REGION父关系及已有数据，并将两个feature合并为store-basic；订阅范围不变，无实施授权
```

## 0 · 用户目标、范围与效力

本期让终端业务包及时获知 CBS 数据变化并主动更新自己拥有的数据；让 CBS 的内部业务模块
通过一项纯能力向在线终端发送 command，查询其执行过程和结果。基础设施须以实际业务消费者
形成闭环，不能只交付消息协议。本期没有前台页面、管理页面或权限产品功能。

本文将讨论中已确认行为整理为正式需求正本，不将作者建议升级为 Dexter 裁决。
已接受业务语汇与开发约束仍回读各自正本；讨论稿用于追溯，不再作为第二份可并行修改的需求。
当前授权仅为需求文档维护与静态核查；原两轮独立审查已关闭，本次全文一致性校正不重开该cycle。
需求评审GO不授权实施或动态运行。
正在实施的《终端激活交互与双机拓扑优化专项》保持其自身范围与授权。

### 0.1 · 包含与排除

包含：共享 topic/远程操作契约；CBS 变化发布、范围缓存与 terminal-control 能力；
TDS 订阅/变化通知/远程转发；TDC 通用订阅、通知、远程执行及记录补报；
一个新增 kernel/feature/store-basic 的真实 HTTP 消费、持久化、十一类topic订阅和主副机同步；
无业务副作用的 helloWorld 远程闭环；相关原始更新时间盘点与必要接线。
Dexter后续明确补充：CBS补齐REGION.parentId到真实商业集团的必填关系、已有数据及读写链，
TER统一沿Store→PROJECT→REGION→CommercialGroup取得引用，具体边界见R-11.1。

排除：订单、会员等未有业务的实现；全部 CBS 模块一次性接入；管理 HTTP 暴露面或页面；
角色/权限模型；离线 command 排队或补执行；本期CBS远程脚本业务接入；新的业务 deployable/数据库；
MQ、通用 outbox、通用持久消息队列、常态轮询；Doris 新业务用途；生产 HA/长期容量承诺。
本期持久远程执行事实补报是具名能力，不扩展为其他消息的通用投递系统。

B及store-basic数据feature只建设、验收业务数据取得/通知/刷新/持久化/订退/主副同步，
不新增TER对门店停用、经营规则、合同有效性或服务点状态的业务决策/联动。
例如门店被停用，TER需同步其真实DISABLED数据，但本期不要求据此登出、停机、阻断业务或取消激活。
集合条件、成员增退和时间确认属于同步正确性，仍须验证；不改变CBS既有业务约束、鉴权及已批准会话行为。
此边界不撤回C的helloWorld、远程过程/结果持久化及补报验收。

### 0.2 · 成功判据与简单方案

成功体现为：当前主机业务数据与相关范围成员得到正确刷新，成员退订不影响其他消费者；
副机仅消费主机同步的业务数据；在线远程操作可查，断链后实际保存的执行事实可以补报，
在R-14规定的有效关联/记录范围内不重复执行，不虚构成功或跨绑定污染。

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
feature指定订阅对象使用生成的`topicKey + ownerRef`：项目详情的ownerRef是项目ID，
门店有效合同集合的ownerRef是门店ID；这里ownerRef是该topic对象/集合归属的业务引用，
不是feature包名或后台模块名。有限集合条件由topicKey的contract定义，不由feature发送自由搜索条件。
集团空间及允许的关联范围由当前绑定/会话和业务owner事实解析、核验；内部完整身份仍包含这些范围，
不是仅把裸UUID当隔离键。A店合同变化只重算、更新并通知A店集合实例，不影响B店缓存或订阅。
这两个字段描述的是订阅对象，不表示完整协议只有两个字段：首次登记仍按R-07附带本地topic时间，
后续接受确认仍按R-08关联具体通知；多feature的订退归属及有效绑定关联也须保留。
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

| 旧/新结果集（通过collectionHash判定） | topic 时间与行为 |
| --- | --- |
| 集合相等，包括空→空、返回顺序不同 | 保持已缓存时间，不发布范围更新 |
| 空→非空 | 时间 B，替换collectionHash |
| 非空→空 | 时间 A，保存空集合collectionHash与 A |
| 两边非空且成员不同 | 时间 A，替换collectionHash |

成员内容更新但 refIds 不变，不更新范围时间，使用成员精确 topic。
实际成员改变即使 A 等于旧时间，在线仍按变化通知；离线同值比较仍受 R-04 限制。
合同 valid 采用当前 ACTIVE 状态，排除 INVALID；自然过期不进入范围条件，
不复用 CURRENT/PENDING/HISTORY 的日期筛选，不改名数据库枚举。

### R-06 · PostgreSQL 缓存与一致快照

CBS侧在现有PostgreSQL持久保存`(完整topic身份, collectionHash, topic时间)`，
不保存refIds集合、业务正文或额外memberCount。完整身份由topicKey、ownerRef及服务端核验范围组成。
collectionHash只对完整、去重refIds按固定规则排序与无歧义编码后计算；不包含成员内容、更新时间，
不作为终端版本或替代topic时间。排序仅用于稳定摘要，不增加业务排序语义。
优先由范围查询SQL保证成员唯一性，并按该topic实际成员引用列显式排序以计算稳定摘要：
合同为`ORDER BY id`，区域为`ORDER BY area_ref`，服务点为`ORDER BY point_ref`，见§4.1a。
主键唯一且查询不引入重复行时，不额外使用`DISTINCT`；确有重复行时在SQL中消除。
SQL已保证唯一、有序后，应用层直接按该顺序编码并计算collectionHash，不再重复去重、排序，
不为此新增通用集合处理框架。该内部排序不改变范围topic的无序集合语义或feature业务列表呈现。
空集合有固定collectionHash，用其识别空/非空；不存在缓存记录与已有空集合缓存必须区分。
hash算法、编码与固定空值须在CBS范围缓存定义和详设中统一，不能使用进程随机hash或依赖未显式排序的SQL返回顺序。
collectionHash是CBS内部成员摘要，不要求将它生成到TDC或作为通知/接受确认中的数据版本。
CBS重算时取得真实完整结果集并比较摘要；feature仍经HTTP取得真实业务列表，自己比较成员并管理详情订退，
不从hash还原列表，也不要求CBS持久保存旧refIds。摘要减少缓存存储，不宣称免除结果集重算成本。
原始写入与相关范围更新须有一致提交/失败语义，并发重算不能让旧集合覆盖新集合。
提交后才通知；TDS listener 建立/重建须核对当前有效订阅的权威状态，通知只作唤醒。
可复用现有 PG 通知，不推导其具有离线持久可靠性；具体最小接线由详设核实。

缓存重启读回空集合collectionHash与 A，不重算成 0。首次从无缓存初始化的空集合时间及批量触发时 A 的选择，
属于 §8 明列的详设准入项，不能无依据宣称本期已作产品裁决。
HTTP 范围读取须得到完整 refIds 与首次计算时间所需的真实成员时间，不能把第一分页当全集；
数据与其时间须对应可观察的一致快照，不能拼接不同快照页面后声称最新。
WS 通知只携带 topic/时间和必要关联，不把无限集合正文塞入现有 65,536 字节消息。

## 3 · 订阅与 feature 更新链（R-07～R-10）

### R-07 · 初始加载、已激活启动与 ready

本期主机store-basic由激活成功command启动门店基础信息HTTP加载，首次门店查询不要求已有门店成功状态。
门店基础信息取得、应用并持久化成功后，才经本包command启动R-12的服务点区域/服务点查询；
服务点查询不能由激活或TDC ready直接绕过此前提，也不等待其他资料全ready。
各项查询以当前绑定身份经对应刷新command发起；取得、应用并持久保存对应业务数据后，
经TDC command登记该数据支持的topic及**初始**本地时间，不等待整个包所有查询成功。
精确实体取原始时间；范围取已取得成员原始时间最大值，空结果取 **0**。
不论旧本地版本是否存在/为空均执行初始加载；已经激活的应用重启或晚安装 feature，
须从公开selector核对激活及本包业务前提后，经command复用该刷新链，不要求重新激活。
本包服务点加载不能仅凭已激活或持久化的旧门店数据绕过本次门店基础信息成功获取前提。
同一有效绑定下仅TDC连接断开/重连，不是新的feature初始化周期：TDC重发当前有效订阅及
已接受时间，不能用旧初始计算值或空集合0覆盖已接受时间。应用重启、重新激活/换绑定或
本包首次安装须执行上述本次HTTP初始化；详设须明确与持久化恢复的接线，不把重连与重启混为一类。

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
后加入的消费者仍按R-07首次HTTP和初始时间登记；不能因该topic已有通道就跳过它的初始差异核对，
也不能用它的初始时间回滚该topic已经接受的服务端时间。该核对不变成持续上报feature版本、
服务端per-feature版本或等待全部消费者确认的屏障。
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
范围所需的完整集合数据已应用持久化，才能确认对应范围更新；当响应仅提供成员ref/摘要时，
保存集合成员与保存完整成员详情须区分，不能把缺失详情标为已加载。个别详情查询失败不回滚
已正确保存的集合，失败详情不确认成功，本包保留可见的成员失败；本期合同集合仍须满足R-11完整资料要求。
数据接受确认也不替代新增/解除订阅成功，订退失败须单独可见，不能把未登记的成员标为已订阅。
旧绑定/旧 ref 关系链失效后，取消旧相关订阅，新身份重新初始化，迟到结果不写新身份数据。

### R-10 · 主机与副机

副机 SLAVE 不独立连接 TDS，不登记订阅，不收到 TDC ready/topic 广播，不独立 HTTP 刷新本期 TDP 数据。
主机 MASTER feature 持久化后，经既有 owner 同步把业务数据和原始时间同步到副机，副机用 selector 消费。
继承既有断链/重连与身份隔离；不另建副机通知系统。
本条不覆盖本机 BRANCH 输入、壁纸等已获批本地状态，不以业务更新时间替代拓扑 revision/session 顺序。

## 4 · 本期真实 topic/HTTP 消费清单（R-11～R-12）

### R-11 · `kernel/feature/store-basic`

本期只新增 `apps/terminal/kernel/feature/store-basic`，统一拥有下表七类资料与R-12四类服务点数据，
合计十一类topic的业务slice、command/actor、selector、持久化与主副机同步，不提供UI。
不另建store-service-point包、第二owner或包间启动桥接；资料和服务点可在包内保持清晰的职责与局部加载状态，
不要求强行合成一个巨型actor或单个slice。TDC仍只提供通用基础服务，不承担上述业务逻辑。

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

scope来自当前激活摘要及CBS权威复核；本期补齐后的统一关系为store.projectId→PROJECT，
PROJECT.parentId→REGION，REGION.parentId→CommercialGroup；TER沿真实引用读取/订阅，不另建按集团空间
选择集团的平行规则。集团空间继续承担隔离及关系校验，不替代这条持久化关系。门店项目、经营租户、品牌仍锁定。
绑定合法切换至另一门店时，退订旧门店关系链的project/region等topic，并初始化新绑定的相关实体；
不通过修改原门店的不可变关系制造订阅切换。
任务型组合读取可复用既有 owner read，但每实体保留自己的时间，不用门店时间代表其他实体。
合同初始化以一个门店ACTIVE合同查询取得全部有效合同的完整业务资料及各自原始时间，保存为本包合同列表；
据此登记合同范围和全部成员详情topic，不再逐个补查已完整取得的合同。范围变化复用该集合查询并按R-09
差量订退；单合同详情通知查询该合同详情并更新同一列表，不另建按topic复制的合同事实。
补齐所需 terminal 读取契约/原始时间；不强迫复用 operations-admin 登录或凭证泄露接口。

#### R-11.1 · REGION商业集团父引用必填（Dexter范围补充）

REGION.parentId必须非空，指向同一集团空间的真实CommercialGroup公开UUID引用
（CommercialGroupReadback.id，当前持久字段commercial_group_uuid），不是集团空间ID、商业编码、
内部自增id或另造的GROUP组织节点。PROJECT.parentId继续指向同空间REGION；不增加多级大区。

CBS的organization owner在createRegion及其既有create重载的真实INSERT核心，复用当前已验证的
CommercialGroupLookup取得同空间商业集团引用并保存parent_id，不让客户端自由选择其他集团。
不存在有效商业集团、引用不存在或跨空间时拒绝创建/写入；禁止继续保存null，或在返回DTO时临时补一个
parentId掩盖数据库缺失。数据库须按node_type对REGION落实父引用非空约束；目标存在/同空间完整性
的具体最小约束与owner复核接线由详设确定，不把整张表的所有parent_id一律设NOT NULL。

updateNode及旧update重载须按持久关系核验既有父引用，不能继续要求REGION.parentId为空；
普通编辑、状态切换不得清空父引用，也不新增换集团、换项目/大区等关系变更command。
PROJECT与REGION保持各自原始updatedAt，关系补齐不能用集团时间覆盖子实体时间。

已有REGION记录在单一Flyway history下经新增迁移补齐：按该行workspace_uuid/group_workspace_key
匹配唯一真实CommercialGroup并写入其公开UUID。零匹配、多匹配、非法或跨空间旧引用必须显式失败，
不跳过、不猜测、不以reset/seed代替迁移。涉及实际数据修正的时间/version和topic缓存/通知处理
按既有owner事实及原始时间规则在详设明确；不得伪造历史更新时间。

必须同时核验CBS创建/更新API及generated DTO、现有后台表单、typed与旧参数写入、任务型读取/路径查询、
适用范围判断、seed/fixture以及TER HTTP/selector链。旧源码的REGION根节点处理应按本裁决调整，
不要求新增后台功能或集团选择控件，不放宽当前终端、运营及owner授权。
TER取得REGION后直接用parentId作为集团topic的ownerRef；父引用缺失/错误时显示可观察加载失败，
不退回另一条按集团空间找集团的客户端fallback。CBS创建和迁移时按空间复核集团属于关系建立，
不等于TER另建集团发现规则。

当前静态基线：OrganizationHierarchyService.createRegion:84在:101将parentId传null；
validateParent:1178对REGION要求null。这是需修正的旧实现，不是新关系已经成立的证据。
代码路径均为apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java。
本条是本期需求范围的明确补充，只授权文档维护，未授权修改源码/契约/迁移或运行任何环境。

### R-12 · `store-basic`包内服务点数据职责

本条保留R编号及四类topic，服务点区域/服务点由R-11的同一store-basic包拥有，不另新增源码包。
本包门店基础信息HTTP取得、应用并持久化成功后，经同包command启动区域/服务点查询，
核对当前有效绑定及本包selector中的本次门店加载成功状态；查询应用持久化成功后登记相关topic。
R-11定义的门店成功command按原要求广播成功事实；服务点启动是包内command衔接，不依赖另一个feature的
安装顺序、跨包订阅或转发桥。TDC ready不能绕过此前提，不要求项目/大区/集团/合同全部ready。
门店基础信息失败时不查询服务点；服务点查询失败保留已成功的门店资料，局部失败可见且由本包处理。

已激活重启或晚安装store-basic，仍先完成本次当前绑定的门店基础信息HTTP及应用持久化，
不能用旧缓存代替。服务点初始化command须复核当前前提；重复command在初始化进行中不重复查询，
在同一本次启动及当前绑定的初始化周期内已成功时不重做初始全量；失败不能标为已初始化。
跨应用重启或绑定失效后，不能复用持久化的旧成功标记跳过本次加载。
已初始化后的topic更新走相应刷新command，不因普通门店信息再次刷新而重做区域/点位全量查询。
换绑定或取消激活使旧启动前提失效，旧成功command及迟到响应不能启动/污染新门店数据。

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
本包统一拥有资料及服务点业务数据；包内共性复用已有加载、持久化和同步能力，
不为这次合并新增通用启动调度、跨feature恢复框架或topic正文缓存。

### 4.1 · 十一类topic计算与CBS写command接线（R-03～06、R-11/R-12补充）

本节将本期topic的计算与触发责任固定在需求中，不以“详设时再梳理”代替已明确的业务逻辑。
表中topic使用业务名称；topicKey最终生成值由contract确定，但不得改变以下ownerRef、条件或时间来源。
本节引用的是当前生产源码定位，要求的是后续新增环节，不声称这些topic已经实现。

#### 4.1a · 逐topic计算定义

共同隔离条件为服务端核验的workspace_uuid/group_workspace_key及业务关联范围；ownerRef不是授权。
精确topic从权威实体直接读取原始时间，不另存一份实体版本或为其计算collectionHash。
精确topic发生真实数据写入后通知当前合法订阅者，同毫秒写入仍通知；订阅/重连按R-04比较时间。

| topic业务名称 | ownerRef / CBS事实owner | 时间或集合计算 | 触发command组（见4.1b） |
| --- | --- | --- | --- |
| 门店基础信息 | store ID / organization | organization.store.updated_at_epoch_millis；自身门店记录，不用合同衍生经营状态作为这条时间来源 | STORE |
| 项目基础信息 | PROJECT ID / organization | organization.organization_node中对应PROJECT行的updated_at_epoch_millis；不借用门店或REGION时间 | NODE-PROJECT |
| 大区基础信息 | REGION ID / organization | organization.organization_node中对应REGION行的updated_at_epoch_millis | NODE-REGION |
| 集团基础信息 | commercialGroup ID / organization | organization.commercial_group.updated_at_epoch_millis；不是GROUP组织节点或集团空间时间 | GROUP |
| 门店经营规则 | store ID / organization | 门店root经营规则数据与organization.store.updated_at_epoch_millis共用来源；门店root真实更新后两条精确topic均唤醒，可复用一次业务HTTP | STORE |
| 门店valid合同结果集 | store ID / store-contract | contract.store_contract按当前空间、store_id及status='ACTIVE'取得完整id/updated_at_epoch_millis；ORDER BY id，计算collectionHash及非空B；不加日期筛选 | CONTRACT-CREATE、CONTRACT-INVALIDATE |
| 合同详情 | contract ID / store-contract | contract.store_contract.updated_at_epoch_millis；包括本合同状态、正文及同次保存的扩展值；INVALID不能冒充硬删除 | CONTRACT-CREATE、CONTRACT-UPDATE、CONTRACT-INVALIDATE |
| 服务点区域目录 | store ID / organization | organization.store_service_point_area按当前空间、store_ref及status='ENABLED'取得完整area_ref/updated_at_epoch_millis；ORDER BY area_ref，计算collectionHash及非空B | AREA-CREATE、AREA-UPDATE、AREA-STATUS |
| 服务点区域详情 | area ID / organization | organization.store_service_point_area.updated_at_epoch_millis；自身字段，包括自身status/display_order | AREA-CREATE、AREA-UPDATE、AREA-STATUS、AREA-MOVE |
| 服务点目录 | store ID / organization | organization.store_service_point按当前空间、store_ref及status='ENABLED'取得完整point_ref/updated_at_epoch_millis；ORDER BY point_ref，计算collectionHash及非空B；全门店，不按area_ref拆分，不加入父区域可用性 | POINT-CREATE、POINT-UPDATE、POINT-STATUS |
| 服务点详情 | point ID / organization | organization.store_service_point.updated_at_epoch_millis；自身字段，包括area_ref/status/display_order、图像ref及同次保存的扩展值 | POINT-CREATE、POINT-UPDATE、POINT-STATUS、POINT-MOVE |

三个集合统一按R-05四种hash/空非空转换计算topic时间：hash相同保持旧值；空→非空用B；
非空→空或非空→非空且hash不同用A。A必须取本次实体写入的原始updated_at_epoch_millis，
不是另取audit时间、通知时间或再次调用时钟。无缓存初始化及一次批量触发的A选择仍按§8明确。
完整结果和B来自一致快照，SQL负责唯一性与稳定顺序；只缓存collectionHash与时间，不持久成员列表。

本期terminal精确topic覆盖实体自身事实；既有运营readback中的关联名称、effectiveAvailable、qrUrl、
canMoveUp/canMoveDown等派生/管理字段不能默认为实体自身updatedAt已经覆盖。
区域状态从区域事实同步；区域停用不批量改写point状态/时间、不重算point自身ENABLED集合。
二维码配置不新增topic；terminal读取契约须按本期原始事实投影，不直接照搬管理DTO宣称时间闭包。
这不新增TER可用性判断或业务处理，不改CBS现有运营读模型。

#### 4.1b · 真实command与新增环节

新增环节位于事实owner实际mutation成功分支内，在全部正文/扩展值/必要关联写入完成后、事务提交前。
幂等receipt回放、command拒绝、CAS失败、无实际写入的越界重排不得触发新增环节；
不能在controller/HTTP完成监听器重复接线，也不能只修改某个参数重载而漏掉其他真实调用路径。

以下相对路径缩写只为避免表格重复长路径，源码定位以方法为锚，行号为本次静态读取位置：

- `ORG`＝`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/`。
- `CTR`＝`apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/`。

| command组 | 当前公开command/方法及源码 | 在真实写入分支增加的环节 |
| --- | --- | --- |
| STORE | OperationsStoreCommandApi.createStore/updateStore/transitionStoreStatus；ORG application/StoreService.java:83、129、162 | createNow:458、updateNow:541、transitionNow:609完成门店root及扩展值后，按同一store ID登记门店基础信息与经营规则两条精确变化；共用实际持久化root时间，不构造独立规则时间 |
| GROUP | InitializeCommercialGroupCommand.execute；OperationsCommercialGroupCommandApi.update；UpdateCommercialGroupCommand.execute；ORG application/OrganizationCommandService.java:137、160、107、257、280 | 初始化INSERT:223、updateOnce:345中UPDATE:358及完整值保存后，登记commercialGroup ID精确变化；不通知GROUP组织节点或集团空间配置 |
| NODE-PROJECT | OperationsOrganizationHierarchyCommandApi.createProject/updateNode/transitionNodeStatus；ORG application/OrganizationHierarchyService.java:112、148、175 | create:302/INSERT:320、updateWithSubmission:916/UPDATE:927、transitionStatusFromCurrent:717/UPDATE:730之后，按权威node_type=PROJECT登记对应node ID精确变化；项目分期先保存完成再登记 |
| NODE-REGION | OperationsOrganizationHierarchyCommandApi.createRegion/updateNode/transitionNodeStatus；同文件:84、148、175 | create及既有重载先按R-11.1保存必填商业集团parent_id；update/状态路径保留、核验该关系；按REGION登记node ID精确变化，不改写子项目/门店时间 |
| CONTRACT-CREATE | OperationsStoreContractCommandApi.create；CTR application/ContractCommandService.java:99 | createSubmission:165内INSERT:185及完整扩展值保存后登记新合同详情变化；按权威store_id重算该店ACTIVE集合，计算hash/B并按R-05更新范围缓存 |
| CONTRACT-UPDATE | OperationsStoreContractCommandApi.update；同文件:126 | updateSubmission:230内UPDATE:243及replaceValues:255完成后登记该合同详情变化；当前command不修改status/store_id，不重算ACTIVE集合，合同日期变化也不改变本范围 |
| CONTRACT-INVALIDATE | OperationsStoreContractCommandApi.invalidate；同文件:154，经invalidate:803 | 状态UPDATE:811成功后登记本合同INVALID详情变化，并仅重算existing.storeId对应ACTIVE集合；A取该次写入原始时间:810，不用剩余成员最大时间替代退出A |
| AREA-CREATE | StoreServicePointOwnerApi.createArea；ORG application/StoreServicePointService.java:332 | INSERT:357成功，完整保存后登记新area详情，并重算该店area自身ENABLED集合 |
| AREA-UPDATE | StoreServicePointOwnerApi.updateArea；同文件:393 | UPDATE:425含status，登记area详情；比较before/after自身ENABLED成员资格，资格变化时重算该店区域目录，不能把整表单更新当成仅改名称 |
| AREA-STATUS | StoreServicePointOwnerApi.transitionArea；同文件:458 | UPDATE:474成功后登记area详情；自身ENABLED资格变化时重算区域目录；DISABLED↔VOIDED均不在集合时不制造目录变化，不级联修改point |
| AREA-MOVE | StoreServicePointOwnerApi.moveArea；同文件:501，swapOrders:1402 | 顺序交换:1403/1409实际更新的两条area都登记详情变化；不重算区域成员集合，不通知仅被读取而未修改的area |
| POINT-CREATE | StoreServicePointOwnerApi.createPoint；同文件:542 | INSERT:587及图像/扩展值等现有command工作完成后登记新point详情，重算该店point自身ENABLED集合；不是仅当前area的集合 |
| POINT-UPDATE | StoreServicePointOwnerApi.updatePoint；同文件:638 | UPDATE:675含status、image_asset_ref及extension_values，完整保存后登记point详情；自身ENABLED资格变化时重算该店服务点目录；图像/内容单改只通知详情 |
| POINT-STATUS | StoreServicePointOwnerApi.transitionPoint；同文件:726 | UPDATE:741成功后登记point详情；自身ENABLED资格变化时重算全店服务点目录，不用父区域状态作为成员资格 |
| POINT-MOVE | StoreServicePointOwnerApi.movePoint；同文件:768，swapOrders:1418 | 原area内顺序交换:1419/1425实际修改的两条point均登记详情变化；不重算成员集合、不新增移区能力 |

“登记精确变化”表示由owner提交后可发布的有限topic/ownerRef关联，不是另存一份业务实体或通用outbox。
业务状态更新同时涉及精确详情和范围变化时，两者都须覆盖，不能只通知范围而漏掉其他仍订该详情的feature。
集合资格未改变的内容写入无须额外全量重算；仍以真实精确变化通知本对象，不人为更新范围时间。

同根现有写入入口必须复用同一新增环节：

- StoreService的旧createStore/createStoreWithOperatingRuleSwitches/updateStore/transitionEntityStatus重载
  （:177、210、284、376）汇入上述createNow/updateNow/transitionNow，不能漏接。
- OrganizationCommandService的execute初始化/更新重载汇入同一初始化及updateOnce，不给不同调用面重复发布。
- OrganizationHierarchyService的旧create/update/transitionStatus重载（如:231、871、699）有实际INSERT/
  UPDATE核心，与typed入口同样覆盖；内部replaceProjectPhaseNames:664经updateProjectPhaseVersion:681
  修改PROJECT时间，也要登记该PROJECT精确变化。该内部能力当前仅测试调用，不新增HTTP/API或页面。
- ContractCommandService旧参数create/update/invalidate重载的实际核心为create:373（INSERT:394及
  replaceValues:411）、update:627（UPDATE:644及replaceValues:656）、invalidate:803；
  在真实mutation核心复用相同topic环节，保留现有鉴权/事务/幂等边界，不为本节另增业务入口。

边界清单：Store/Contract的扩展值在所属create/update根写入同事务保存，使用该根原始时间；
Point图像提交通过现有createPoint/updatePoint，不另建图像topic。updateQrConfiguration
（StoreServicePointService.java:807）只更新store_qr_configuration，不更新上述实体时间，不属本期topic。
现有受管seed经业务HTTP/owner command写入时自然经过相同核心；历史migration、只读查询、audit/receipt
不是新的在线变化触发源，不用直接改库或手动通知作为真实业务验收。本期未发现生产物理删除command，
不新增删除/移店/移区，也不把测试夹具SQL当新增业务command。

源码依据：ORG application/persistence/StoreServiceSql.java:16—32、OrganizationCommandServiceSql.java:15—35、
OrganizationHierarchyServiceSql.java:16—30/63—83及上述StoreServicePointService实际SQL；
CTR application/persistence/ContractCommandServiceSql.java:6—45。原始时间均为对应实体行的long毫秒值。
StoreServicePointService.pointReadback:877—900使用point时间却另派生父状态/二维码/移动能力，
证明4.1a的原始事实投影限定不能省略。后续详设必须重开届时字节确认方法位置，不能只按历史行号修改。

#### 4.1c · 事务、通知及反例闭包

CBS以显式、有限的owner接线确定受影响topic，不扫描所有实体/所有门店，不引入通用动态规则引擎。
需要改变成员资格的command，由相应业务owner在同一事务维护目标范围缓存；不把主流程正确性留给异步listener。
重算前须协调同一完整topic实例的并发，旧计算不能覆盖新集合；具体最小锁/并发方案由详设选择并给出反例。
同事务失败全部回滚；成功提交后才唤醒TDS。TDS权威读回并投递，不拥有集合SQL或每节点缓存事实。
缓存维护与当前是否存在终端订阅分开，避免离线时成员退出丢失A；通知投递才按有效订阅匹配。
原始实体同毫秒变化或集合hash变化而topic时间同值，在线仍通知；本节不改变离线同值漏失限制。

明确反例：A店合同作废不改B店缓存/通知；改合同备注不重算valid成员；单改area/point内容或重排
不改变目录hash/时间；整表单updateArea/updatePoint若改status则必须核验目录；交换排序实际修改的
两条详情均通知；父区域停用不使自身ENABLED的point退出目录；receipt回放/回滚不伪造变化。
V-01/V-02/V-04/V-06/V-12/V-14及§7.1必须承接这些反例，不能只测独立transition入口。
后续详设逐项映射源方法、实际原始时间、缓存/通知接线及focused和真实DEV场景；不要求重做未受影响的全量运行。

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

**阶段 B 更新报告补充（Dexter 2026-10-07）**：升级业务 owner 持有待发送报告正文，并通过 TDC 公开 command 发起 CBS HTTP 上报；CBS 在 `terminal-update` owner 持久保存每任务报告，阶段变化更新同一任务记录，不因重送或心跳重复新增历史。有效且匹配的 PONG 完成 TDC 存活/RTT 处理后，TDC 广播不含业务正文的本机 command，供持有待发送项的业务 owner 各自消费；TDC 不持有其他 owner 的失败正文、不替 owner 重试，也不因报告失败重连。普通断线重连保留业务 owner 的待发送项；配置或绑定身份变化时按详设清理不再适用的本地缓存。该补充只限定阶段 B 报告链，不引入 outbox、通用恢复机制或阶段 C 自动更新行为。

### R-16 · 有界、故障可见及记录清理

注册、待处理通知、远程 inflight、单记录/结果体、补报批次与持久记录均须有明确界限，
复用既有 full/decompressed 65,536 字节协议边界；不将无限正文或日志流放入 WS。
具体数值、期限和释放条件由详设基于既有能力/规模证据确定，不伪装为 Dexter 已批准数值。
不能安全保存远程操作记录时，不假装已经接受可靠执行；容量拒绝/存储失败须有可查结果。
记录何时删除须有明确策略与准入，不能静默删除未获持久确认的事实；详设前闭合 §8。
提交后的通知投递、远程结果回传/补报积压不得饿死心跳或阻塞WS/业务HTTP主流程；故障可隔离、可关联且脱敏。
本条不免除R-06/§4.1c的CBS同事务范围缓存维护：相关缓存维护失败时按事务语义回滚，
不能为隔离投递故障而允许业务写入成功、范围事实未更新。
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
| V-01 / R-01～03,11,12 | canonical/生成topic、scope/command schema；§4.1十一类计算和typed/既有mutation核心接线覆盖，无遗漏/重复发布；未知/非法输入拒绝，包依赖和secret owner不漂移 | 生成所属自测/静态检查，CBS/TDS/TDC focused |
| V-02 / R-03,11 | topicKey/ownerRef正常与跨集团/门店 HTTP、订阅身份；服务端解析当前绑定范围，不能借公开ref读外店数据 | 真实 terminal HTTP + WS |
| V-03 / R-04 | 同值真实在线变化仍通知；不同/倒退时间重读；同值漏失限制如实记录 | CBS/TDS + TER focused |
| V-04 / R-05,06 | collectionHash稳定编码/去重/顺序无关；空空不动、空非空 B、非空空 A、非空非空 A；内容或时间变化不改变成员hash，只精确通知；范围缓存不保存refIds/memberCount | PG 真实容器 + WS |
| V-05 / R-05,11 | ACTIVE 自然过期仍在 valid；INVALID 移出；日期变化不造范围更新 | 真实合同 HTTP/PG + feature |
| V-06 / R-06 | 并发创建/状态退出、不同门店scope隔离、提交失败、listener重建与缓存重启，空缓存A不丢；不制造合同移店 | 真实 PG/TDS，确定性 barrier |
| V-07 / R-06,11,12 | 完整refIds/业务资料/同快照时间，不能第一分页或跨快照拼集；完整集合数据复用于多个topic，摘要不足只补必要详情；大结果不塞WS | terminal HTTP + bounded focused |
| V-08 / R-07,11,12 | 新激活/已激活重启/晚安装store-basic：门店成功应用持久化后经同包command启动服务点，此前服务点HTTP为0；不等待其他资料全部成功；TDC ready交错不绕前提，仅连接重连不重置已接受时间；门店失败不启动，初始化command复核本次绑定/前提，重复不重复初始化，旧绑定成功被拒 | Expo Web → VM/device；真实 DEV TDS |
| V-09 / R-08 | 首次空0、远程100、再次空确认后 TDC100；业务时间未被冒写 | 同上 + focused |
| V-10 / R-08 | T1 HTTP 中收到 T2、倒序/重复/退订后/旧绑定回包，不能错误确认或覆写 | TER 确定性 focused + Web/VM |
| V-11 / R-08 | X/Y 共订、后加入者初始差异核对不因通道已有而跳过、不回滚已接受时间；X退订Y仍订；X成功Y失败可见且由Y处理；无版本互相覆盖 | TER focused + Web/VM |
| V-12 / R-07,09,11 | 初始一次完整合同集合查询登记范围及各详情，不逐个重复读取；A/B→A/C比较并更新同一列表，只退B/订C，C已完整返回不另查；单A通知查A详情，失效不重插；全空/迟到B/详情与集合交错及部分失败，增退身份正确 | CBS HTTP/WS + Web/VM |
| V-13 / R-11,11.1 | Store→PROJECT→REGION→CommercialGroup真实持久引用，REGION父引用非空/同空间；新建、旧数据迁移及读取一致；缺失/跨空间/清空父引用拒绝，无客户端fallback；换绑定退旧订新，各实体自身时间，经营规则用门店根时间 | CBS HTTP/真实PG迁移focused + feature + DEV |
| V-14 / R-09,12 | 门店成功后加载全店ENABLED区域/点目录；服务点局部失败不回滚已成功门店资料，重启后不能沿用旧初始化成功跳过加载；按对应topic刷新；独立状态command与整表单update状态均覆盖；原区域内重排通知实际交换的两条详情、目录不变，无邻居/receipt回放不发变化；父区域停用不排除自身ENABLED point；不新增移区或衍生可用性判断 | CBS HTTP/WS + Web/VM |
| V-15 / R-10 | MASTER下载持久并同步、SLAVE只读；断链/重连和换身份不混数据、不另连接/订阅/拉取 | paired Web → 双机 VM/device |
| V-16 / R-13,17 | terminal-control→TDS→TDC→helloWorld→request结果→CBS读回；无业务副作用 | 纯能力 + 真实 WS/TER/PG，DEV |
| V-17 / R-13,14 | unknown/uninstalled/参数非法/协议不支持/失效身份、离线、发送失败：结果可区分、发送记录真实 | 能力/WS + TER focused |
| V-18 / R-14 | 有效记录保留范围内operation重复、request关联、执行中断链/超时：不重执行，未知不伪装失败/回滚；不升级为无限期exactly-once | 真实 WS + runtime focused/DEV |
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

下表为B及store-basic数据feature的最低场景分母，全部为计划/NOT_RUN。详设§11a与实施计划须逐项映射
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
| DEV-DATA-13 / V08,14 | 新激活、已激活重启/晚安装store-basic；门店查询延迟/失败、其他资料尚未完成、重复初始化command | 同包服务点查询只在本次当前门店基础信息成功应用持久化后启动；不提前查询、不等待全包、不重复初始化；服务点失败不回滚门店成功 |
| DEV-DATA-14 / V03,09,10 | TER断开期间后台修改数据，变化时间与本地不同，再恢复连接；另覆在线同值变化 | 沿用有效订阅及已接受时间重登记，差异通知/HTTP刷新/接受确认闭合；在线同值仍通知，不升级为离线同值必恢复承诺 |
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
| 原始时间与初始化 | wire单位/无损范围；collectionHash算法/稳定编码/固定空值，CBS无缓存空集合时间如何初始化；一次批量触发A来源 | 技术设计OPEN；不引入新时钟/逻辑版本，改变A/B须Dexter |
| HTTP/契约生成 | 实际terminal身份读取、DTO原始时间/完整合同集合资料/单合同详情、canonical→materialize/codegen→feature接线；集合/详情更新同一slice并复用已返回字段 | 技术设计OPEN；不直接复用管理员会话，不泄露凭证，不把现有readback冒充完整terminal接口 |
| REGION父关系补齐 | R-11.1必填真实CommercialGroup UUID、typed/旧create/update、数据库约束/存量迁移、CBS读模型/范围与现有后台/seed/fixture、TER读取/生成全链影响；数据修正原始时间/version及topic处理 | 必填关系和本期范围已由Dexter裁决；技术接线OPEN，不新增换集团动作或客户端fallback，不授权现在实施/迁移/seed |
| feature启动前提 | 单一store-basic owner；本次加载与当前绑定、包内服务点初始化command、重启/晚安装与仅连接重连的区别、重复/局部失败及集合数据/详情/订退结果区分 | 技术设计OPEN；不把门店加载变成全包屏障，不凭旧缓存或TDC ready启动，不新增统一调度框架 |
| DEV同步场景 | §7.1最低分母逐项映射真实后台控件/合法操作、受管DEV→TDS/TDC→feature→副机、数据/持久化/cleanup断言 | 技术设计OPEN；不以mock替真实链，不新增TER业务状态判断，不将DEV验收称L2/UAT |
| 事务与通知 | 按§4.1固定的逐topic计算与真实command补齐实现接线、缓存schema/事务并发、启动/重建读回、各TDS通知路径；CBS事务维护与提交后投递隔离不得互相替代 | 计算/触发责任已明确；具体技术接线OPEN，不新增MQ/outbox/轮询 |
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

后续范围缓存与订阅对象修正，取代上文历史原话中的PG持久refIds；不改变原始A/B时间规则：

> “好，修改吧，数据库只保存resultHash或collectionHash，名字你定。另外，feature包发订阅的时候，只会发topic的key和 topic ownerRef把？ 比如订阅项目详情 topic_project_detail + 项目ID， 或 topic_valid_contract_collection + 门店ID， 是这样吧？”

本次字段选名为collectionHash；两个示例topicKey只说明对象身份，最终生成值由contract详设确定。
对象身份与首次时间、后续具体通知确认等协议关联的分工见R-03、R-07/R-08。

后续SQL实现约束补充：Dexter指出refId去重、固定排序可由简单SQL完成，并要求写入需求。
R-06据此明确优先SQL唯一性/显式排序，查询已保证时不重复DISTINCT或应用层去重排序；
本次仅补充需求，不授权源码实施或动态运行。

后续逐topic计算与写command清单补充：

> “所以，初期我们约定好的这几个topic，每个topic的计算逻辑，尤其是集合topic的计算逻辑，在需求里都应该约定好，在哪个command里面增加环节都要列出来”

§4.1按当前owning source列明十一类计算、三个集合条件及真实command/核心写入位置；
后续详设负责具体接线与异常证明，不能把已明确计算/触发责任重新留空，也不由此获得实施授权。

后续商业集团父关系裁决，取代旧按集团空间独立解析集团的终端规则，并补充本期CBS关系调整范围：

> “我建议不要单独一套规则，就用REGION.parentId就好了。”

在说明当前REGION.parentId为空、需要CBS关系及已有数据一起补齐后，Dexter确认：

> “对，这个要补齐，REGION的parentID不可以为空”

实施需求见R-11.1；原两轮review不覆盖这项后续范围补充，不把旧源码根节点行为当现行裁决。


后续包结构裁决（Dexter 2026-10-04）：

> “修改一下需求文档吧，两个feature包合成一个吧，不需要那么多”

本期统一为store-basic一个包，原R-12服务点职责并入R-11的owner；十一类topic、HTTP资料、订退、
持久化、主副同步及必测范围不缩减。门店成功后再查询服务点的前提保留为包内command顺序，
取代前述历史原话中的两个包及跨包启动依赖。旧两轮review不覆盖当前修订；本次仅授权文档修改。
