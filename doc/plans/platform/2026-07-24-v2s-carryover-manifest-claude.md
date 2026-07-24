---
title: v2s 取舍清单与通用设计要求沉淀
status: active
author: Claude
createdAt: 2026-07-24
acceptedAt: 2026-07-24
acceptedBy: Dexter
freezeStatus: W0_FROZEN_INPUT
implementationAuthority: false
reviewStatus: GO_ACCEPTED_W0_FROZEN
reviewRef: doc/review/platform/2026-07-24-v2s-carryover-manifest-codex-review.md
serviceShapeAuthority: doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
---

# v2s 取舍清单与通用设计要求沉淀

## 文档性质与使用方式

本文与[新服务形态 ADR](../../decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md)共同构成 v2s 新仓的**第一批冻结输入**，均已由 Dexter 于 2026-07-24 接受为 `active / W0_FROZEN_INPUT`。本文回答两个问题:v2 的哪些资产带走、哪些不带(Part A);以及散落在 v2 六十余份决策、评审、规格、反思文档与**代码本身**中的设计要求,去场景化后沉淀为 v2s 的通用约束(Part B–D)。

**真相优先级**:已冻结 ADR 唯一拥有部署形态、模块协作、事务、任务型读取、跨 schema 完整性、全局迁移、事件/进程边界、边缘安全、consumer face 与重判 trigger；本文拥有资产取舍、通用设计要求和携带样板。两者冲突时以 ADR 为准，本文不得把缺失条款解释为放宽，也不得改变 all-v2 当前 Roadmap、运行时或授权状态。

**新仓地址**:`catering-v2s`,与 v2 仓同级的并行目录(不写绝对路径——共享挂载点在各机器不同)。只有未来 v2s 建仓入口另行确认冻结时，v2 才转为同级只读 Heritage；本文冻结本身不执行该动作。Part C 的样板指针以届时记录的 v2 冻结时点为准。

**Dexter 裁决记录(2026-07-24)**:
1. **业务 app = 1 个**(contract/IAM/organization/扩展/资产全部为模块并入)。此裁决**有意识地**比 v6 第 12 阶段映射(该范围 2 个业务服务)更进一步收敛,理由见 Part 0.3;这正是"偏离批准架构必须有决策记录"的正确示范——v2 的错不在偏离本身,在无记录地偏离。
2. **主数据维护来源枚举统一为 `EXTERNAL_SYNC`**(organization-overview 侧的 `SYSTEM` 在契约带入 v2s 前改拼写;新库清建,无数据迁移负担)。
3. **后端技术栈候选:Java 21 + Spring Boot 4.1 兼容性 spike + 依赖白名单制**(细则见 D.6)。4.1 是 W1 首选验证目标，不是未经 walking skeleton 验证的永久版本裁决；精确版本只有在兼容性证据通过后才冻结。

来源:四路全量文档/代码扫描(64 个决策文件、16 PAUX + 30 条反馈、G-01~30 + DG-01~13 差异登记、历次评审 M/S/N、三份系统性反思、全部标准文档、后端 316 文件 + 前端两 app 的代码金矿),由评审方逐条复核收编。规则后的方括号是溯源标签,原文当前在 all-v2 中按标签检索；未来冻结后继续作为只读 Heritage。

**拓扑前提**:v2s 边缘 = 标准基础设施反向代理(不自研 Java/Spring deployable)+ 业务 app(一库、schema 分域、门强制模块边界),TDP 显式延后。所有 v2 中"跨服务"条款已按新拓扑重判(Part F)。

本文不授权实施，也不改变 all-v2 当前状态。v2s 建仓、all-v2 冻结只读、迁移与任何代码/数据库/Git 动作均须各自的后续入口。

---

## Part 0. 背景叙事:v2 犯了什么错、我们怎么想的、v2s 要去哪

**给 Codex:先读完这一篇再看规则。** 后面的每条规则都是这里某个真实错误的沉淀;理解了错误,规则才不会被机械执行或在边缘情形下被错误地"灵活处理"。

### 0.1 v2 犯的错(诚实清单,按严重度)

**错误一:架构在无决策记录的情况下漂移出了 v6 的冻结裁决——这是最大的错,其余许多错是它的连锁。**
v6 第 12 阶段 02 号文件明确冻结:"生产级粗粒度微服务,不采用 20 领域对 20 小微服务;数据边界是独立逻辑 **schema**,第一期可共享 PostgreSQL 集群"。v2 的当前范围在 v6 里映射为 **2 个业务服务**;实际建成了 **7 个业务服务 + 7 个独立 database**(比 v6 要求严得多的物理隔离,跨库连 join 都不可能)。这次偏离在 doc/decisions 里找不到任何一条支持它的裁决——它不是被决定的,是滑进去的。
连锁代价:为了消灭 owner 间同步调用,建了整套 Ed25519 proof 签发/验证/防重放体系;为了跨库传播事实,建了 7 条 outbox→MQ→版本化投影→repair 流;每条流都要独立取证;合同引用投影上还复发了 N+1(同库本是一句 join);DEV 要拉 8 进程 + MQ + Redis + 隧道。**这些工程本身质量很高——但它们是为一个错误拓扑付的账。** 教训:部署拓扑是显式决策,任何偏离批准架构的"自然演进"都必须有决策记录,否则就是漂移。

**错误二:治理成本不随改动缩放。**
每个改动付同一套全额仪式:约 30 分钟手工准备(SHA、manifest、receipt、preflight)、几分钟改代码、30 分钟脚本测试;一个程序的对抗审查跑到 v21;有些 receipt 写完从未被任何门回读内容。门和测试是值钱的(见 0.2),但把最高风险等级的保费收到每一次三行改动上,是纯摩擦。教训:仪式的机械部分必须脚本化(已立项);对抗审查只用于 owner/契约/schema/安全/事务边界这些高风险类。

**错误三:假绿——形式合规冒充真实验证,出现过四种形态,全部被评审抓获而非被门抓获。**
(a) 一次只跑了单个 Step 的 run,为六个 Step 的 L2 证据背书(靠读 run 的 command.log 抓出);(b) V23 迁移已 drop 旧表,runtime 还在读写它——schema 与代码矛盾,清库重建必炸,而各种"绿灯"照常;(c) COSC 门的 self-test 打印四类字面量的 RED PASS,但那个断言 helper 从未接进 run() 的生产扫描;(d) 测试从实现反推 oracle,把"错误行为"固化成 L2 期望长期绿灯(oneTimeUrl:null 被冻结为预期就是实例)。教训:证据必须绑定字面展开的命令与目标 hash;门必须证明自己会红;测试与实现必须独立派生。

**错误四:同类问题只修被点名的一半。**
8 处失败静默修了 4 处,**运营后台最核心的身份/数据节点切换器连续两轮留在未修清单里**;术语三种 `ACTIVE` 译法在 presentation 契约建立后依然存活(契约只收了一半状态域);枚举分裂(`SYSTEM/EXTERNAL_SYNC`)指出后一轮未动。教训:任何修复必须对同类做闭集扫描并逐项处置(FIXED/ALREADY_CORRECT/NOT_APPLICABLE),"修了被点名的"不等于"修了"。

**错误五:页面从 CRUD 表格出发而不是从用户任务出发。**
组织树被做成分页表格、三类经营主体挤一张表取字段交集、详情用 disabled 表单冒充、页面准入拆成独立页面打断任务流、已知上下文反复要求重选——这是 Dexter 30 条反馈的共同根源。教训:先问"用户此刻要完成什么任务",再问"数据长什么样";实体有天然形状(层级=树、闭集=Tab、详情=只读描述),表格不是默认答案。

**错误六:前端两 app 的基础设施各写一遍并各自漂移。**
12 个同名文件(contentTabsSlice、pageRegistry、DrawerSubmissionFeedback……)内容全部不同;一侧有会话边界/错误映射/日志/404,另一侧没有;一侧修了 bug 另一侧原样。教训:对称能力要么共享同构底座,要么显式记录为何不对称;"复制后各自演进"是最贵的第三态。

**错误七:契约治理只走了半程就宣布胜利。**
后端字面量归零做得很好,但前端 error-code 裸 switch 无漂移保护、recovery 语义没有前端生成面、presentation 缺半数状态域——而门恰好不扫前端,于是半程状态长期"全绿"。教训:契约化的分母是"全部消费端",门的扫描面必须等于承诺面。

### 0.2 v2 做对的、必须原样继承的判断

不能只讲错。以下判断被反复验证是对的,v2s 不得动摇:
1. **契约驱动 + generated symbol 唯一真相**——catalog 的 count 断言、`satisfies` 绑定、`--check` 字节比对,多次在编译期拦住漂移;
2. **门 + 红夹具纪律**——本轮评审周期内,门和对抗审查至少抓获四次真问题(V23 矛盾、假绿背书、撤销能力与批准矩阵漂移、COSC 假保障);它们贵,但赔付过保费;
3. **owner readback、CAS、fail-closed、default-deny 的一贯性**——安全评审从未在这些点上抓到过原则性错误;
4. **业务语料的外化**——30 Scenario/124 Step、线框、术语矩阵让"重写不丢知识"成为可能,这是 v2s 敢于存在的前提;
5. **run-managed 受管运行**——启动令牌、双记账、自测夹具,是全仓质量最高的工具;
6. **教训必须抽象成通用失败模式**(阶段反思机制)——本文 Part B 本身就是该机制的最大一次执行。

### 0.3 决策推理:为什么是"单体 + TDP",而不是别的

这是一连串讨论收敛的结果,记录推理而不只是结论,因为将来一定会有人(或 AI)重新质疑:

- **"领域"是业务建模单位,不是部署单位。** v6 原文即如此(22 域→14 单元);v2 的错在把两者划了等号。但要精确:v6 明确拒绝过模块化单体,**v2s 的单业务 app 不是"回到 v6",而是继承 v6 领域边界(bounded context/owner/术语/不变量原样成立)、对部署/事务/数据访问边界做出的新 supersede 裁决**。裁决理由是:当前团队规模(一人+AI)、业务强耦合与同事务需求、页面查询形态(join 密集)、单服务器运维成本——**不是**"AI 开发所以协调免费"(AI 降低编码成本,但不消灭语义漂移、边界误用与审查成本,本会话的评审史就是证明)。
- **可伸缩性与微服务无关。** 无状态应用加副本即线性扩;真正的瓶颈是数据库,而 7 个库在同一实例上不比 1 个库能扛。数据库的扩展路径是:索引→读副本→按租户分片(全表 workspace_key 已埋好退路)——每一步都不需要按域拆库。
- **拆分线按风险,不按领域美学。** 将来可能值得独立业务进程的只有两类:资金(支付/账本——安全与合规)、吞吐放大器(TDP——1 变 N 扇出);安全边缘由标准基础设施反向代理承担,当前不自研 gateway 应用。TDP 不承载业务源事实,projection 可由 owner 重发/rebase,但 ingress 幂等、topic cursor、投递进度、ACK 水位和运维诊断是它自己的数据平面持久事实;因此它是低业务耦合的候选拆分点,不是"零代价拆分",也不是当前基线组成。只有 Dexter 明确要求启动 TDP 设计时才重新进入设计分母。
- **单体不是烂单体,前提是门先于代码。** "以后想拆随时能拆"的保险 = 模块边界 + schema 边界 + 契约接口三道门。v2 已证明这套门守得住(前端 feature 边界纯靠门,守住了)。
- **为什么重启 v2s 而不是原地改造 v2**:原地改造要在冻结 hash 的缝隙里做架构手术,每一步都与治理机器冲突;而 v2 从未上线、无数据迁移、知识全部外化、方向是做减法——四个条件同时成立,是重写风险最低的罕见时点。**v2 最有价值的产出从来不是那 8 个服务,而是业务语料、契约、授权模型和教训——全部可携带。**
- **Redis/MQ 的定位已议定**:缓存只存带版本的事实且版本进 key(条目不可变,零失效逻辑);MQ 只做通知不做真相(outbox 表保底);会话/限流/幂等/CAS 永不进缓存。MQ 只在获批真实进程边界出现时按需引入;搜索引擎作为外部基础设施依赖本身不构成我方新进程,也不自动触发 MQ。
- **搜索能力走证据阶梯**:PostgreSQL 索引/trigram/FTS/受控查询(默认)→外部搜索引擎(批准 Journey 需要 PG 不具备的搜索能力,或优化后实测 SLO 仍失败,并经 Dexter 白名单裁决)→无业务语义的 indexer worker(仅吞吐、隔离、独立扩缩或故障生命周期有实测证据时提取)。搜索引擎与 PG 同为基础设施依赖,不预设 `search-service` 或"业务↔搜索面"真进程边界;事务性列表永留主库(读后写一致性是管理后台的硬要求)。

### 0.4 未来方向(v6 完整版图在新形态下如何展开)

1. **近期**:v2s 以"标准基础设施反向代理 + 业务 app(现有 v2 范围各域为模块)"重建当前功能;门先行,契约与业务语料平移。
2. **中期**:商品目录/销售集合/库存(v6 05/06/07)、顾客与营销(08/10)、渠道与防腐(15/16)按 v6 的合并映射进入业务 app 作为**模块**——不是新服务。商品/发布域出现不自动触发 TDP 设计或建设;TDP 保持完全退出当前分母,仅在 Dexter 明确提出后另开设计讨论。
3. **远期触发式重判**:支付+权益账本进入批准范围且出现合规/风险隔离证据时重评是否提取独立进程(Part C 的 proof/信封样板只作候选通信基础,不预建);单库出现副本+配额解决不了的争抢时先按租户分片(Citus 路线),域拆库永远是最后手段;异地多活仅在真实业务要求出现后按已埋退路(workspace_key、无状态、outbox)展开。
4. **治理演进**:准备物脚本化先行;轻重车道待 v2s 稳定后再议(Dexter 已裁决本轮不做);对抗审查保留但只用于高风险类。

---

## Part A. 取舍清单

### A.1 带走(逐类)

| # | 资产 | 处置 | 说明 |
|---|---|---|---|
| 1 | **业务语料**:30 Scenario / 124 Step 旅程、批准线框、交互矩阵、业务语言矩阵、v6 领域文档 | 原样带 | v2s 的规格说明书,最高价值资产 |
| 2 | **契约**:edge OpenAPI + components schemas、admin-catalog、presentation、problems、http-headers/messaging protocol | 带 + 收敛 | 删 8 份 internal OpenAPI;`SYSTEM/EXTERNAL_SYNC` 枚举分裂**已裁决统一为 `EXTERNAL_SYNC`**(见文档头裁决记录),带入前完成改写 |
| 3 | **前端两 app**:结构、features、admin-ui-foundation、架构测试、L2 | 带 + 按所有权重判 | `platform-admin` 与 `operations-admin` 保持独立 app;只通过标准反向代理访问业务 app 的公开 API。Shell/menu/Content Tab/session/context/store/baseApi/theme/page/read model/workflow/catalog/业务文案与 L2/L3 均 app-owned;foundation 只承载两个真实消费者已证明同构的机械行为。禁止因目录同名或代码形似自动合并 |
| 4 | **后端领域逻辑**:各域 command/query service、repository、迁移 schema 设计 | 带 + 简化 | 合并进单 app;事务边界简化(跨模块改本地事务);迁移历史重开 V1(新库) |
| 5 | **门体系**:code-structure/layout、terminology、contract-owned-symbol、openapi-contracts、frontend-architecture 等 | 带 + 修缺口 | COSC 门必须先修 M-1(四类字面量断言接入 run()、扫描面含前端);contracts-layout self-test 补真 red fixture |
| 6 | **generator 全套** + `--check` 字节比对 + count 断言 | 带 | admin-catalog 的假 `--check` 顺带修复 |
| 7 | **run-managed 受管运行**(自测红绿 fixture、business/cleanup 双记账、进程身份令牌) | 原样带 | 全仓工具质量最高的一件 |
| 8 | **outbox→MQ→投影→repair 参考实现**(org→IAM 一条完整链) | 带一份作样板 | 单体内部不用;只在将来获批真实进程边界出现时作为阅读样板。外部搜索引擎激活不等于出现新进程,索引可靠更新优先使用 owner outbox + `AFTER_COMMIT` 即时索引 + recovery job,不自动引 MQ |
| 9 | **project-memory + decisions 语料** | 精选带 | 按本文 Part B–D 已完成去场景化;原文随 v2 只读留存 |
| 10 | **教训登记册**(本文 Part B 全部) | 带 | 即 Dexter 所要"避免 v2s 又走偏"的核心 |

### A.2 不带(拓扑专属或已被裁决淘汰)

| 资产 | 理由 |
|---|---|
| Ed25519 proof 签发/验证/receipt 体系 | 威胁模型是跨不可信进程边界;单体内消失。设计文档归档,资金域将来提取时复用 |
| 7 条内部投影流、各 MQ 配置、repair worker、STALE/GAP/POISON receipt(除样板一份) | 单体内坍缩为本地事务与 join |
| 8 份 internal OpenAPI、内部 generated client/configurer | 内部调用变方法调用 |
| owner-service-edge 清单、middleware-truth 门、跨服务边界门 | 分母消失 |
| 从源码 import/使用扫描反推 operation 消费者的 consumer graph | A5 禁令继续生效:消费关系必须从 OpenAPI operation 的闭集 `x-consumer-faces` 声明向服务端安全面和前端切片单向派生;禁止扫描实现后回写或补全契约 |
| 全局 generated model 包、共享 wire-model 库与跨目标 `importMappings` | 一份 OpenAPI schema 是 wire 真相,但服务端和各 consumer 只生成自身 operation 可达类型闭包;允许机械重复,禁止以去重为由重新制造跨 app/跨目标 generated 所有权 |
| 7 库 dev 工具链、隧道端口扇出 | 一库 |
| 逐次写许可等已被 supersede 的流程机器 | 见 D.5,治理右尺寸化后按新 ADR 重建 |

---

## Part B. 通用设计要求(去场景化沉淀)

### B.1 授权与会话安全

1. **四维不互推**:任职身份 / 页面准入 / 数据范围 / 动作能力四个独立维度,任一维不得推导另一维;`pageEnter` 与 `actionAllow` 两条判定公式永不合并。[E3/N2]
2. **双层拒绝**:入口层先按 OpenAPI operation 的闭集 `x-consumer-faces` 鉴别 consumer face,业务 owner 最终按 session/page/scope/capability/对象状态/来源 default-deny;前端隐藏、菜单不显示、路由 matcher 和 operation 标记都不是授权边界。multi-face 只表示同一 operation 获准出现在多个客户端切片并进入对应入口安全链,绝不免除 Q8 的任何检查。[G-01/N1/R17/本轮裁决]
3. **两套用户体系彻底分离**:平台 principal 永不消费业务角色/页面/动作;平台管理员不建复杂角色模型("已开放功能 + 平台会话"即其权限)。[E1/E2]
4. **角色两个独立 JSON**(页面准入 keys / 动作能力 keys),同一角色 revision 保护,不合并、不互相推导;owner 读取时按契约目录求交,未知/退役 key default-deny 且不破坏性清洗、不当兼容输入回写。[E8/E9/H11]
5. **拒绝授权 DSL**:数据范围由角色节点类型按固定业务规则推导,不建 `self/descendant` 策略串、范围表达式、scopePolicy。[E5]
6. **授权比较用稳定 ID**,不用可变展示 path;查询必须过滤 revoked。[G-26]
7. **账号与任职分离**:注册≠有角色,撤销角色≠停账号;零角色用户可登录见空工作台,不偷偷造默认角色。[E18/E19]
8. **新用户只经邀请链路**;管理员不代建号、不代设密码;邀请创建整单原子去重(owner 侧硬校验)。[E20/E21]
9. **凭证用途分离**:登录(`workspaceKey` 无 route token)/邀请(`invitationToken`)/找回(`resetGenerationKey`+分用途 grant)三链不合并不互认;一次性 token 非单独凭据(还须 OTP+短时 grant);verify 产出短时单用途可消费 grant。[N9/G8]
10. **恒定时间与防枚举**:账号不存在跑 dummy hash;未知账号与错密码同码同耗时;全部凭证比较常量时间;HMAC 指纹化限流键,库不存明文账号/IP。[G14/G13]
11. **限流 fail-closed 双桶**(账号+来源),达限 429+retryAfter,提示不暴露内部事实;限流不改账号生命周期。[G11/G15]
12. **来源指纹不信自报**:只在确来自受信代理时按受信链解析。[G12]
13. **会话**:HttpOnly/Secure/SameSite cookie;登出/改密/停用由 owner 服务端 revoke;会话真相在关系型 owner(事务+过期+CAS),缓存只作可丢弃加速。[G5/C18]
14. **contextVersion 与 authorizationRevision 分离**,双双进入 query arg/cache key/tag;revision 失鲜 owner 返回 typed stale,客户端清投影重读,绝不沿用旧按钮/菜单。[R14]
15. **自助改密与重置他人凭据严格分离**;root 内置(create-if-absent、已存在绝不覆盖)、可自改密、不可被他人变更。[PAUX-14/E27]
16. **秘密不落地**:password/OTP/token/cookie/授权头/完整凭证 URL 永不进日志/trace/错误详情/storage/埋点;DEV 验证码回显只能服务端受管配置开启,生产须有"字段不存在"负向证据。[F7/G7/PAUX-04]
17. **敏感动作五要素**:actor 来源、秘密存储、TTL、尝试/消费/撤销、失败语义逐项声明,负例覆盖跨账号重放、旧 grant、provider 宕机。[G10]

### B.2 数据与事务

1. **全实体 revision/CAS**:每个可变业务实体自带 revision;矩阵级 revision 只是并发元数据不是第二授权事实;不可变实体以固定初始版本参与 readback。[API/DB§8.4/E11]
2. **写与审计同一本地事务**;只有获批真进程边界需要 durable delivery 时,对应窄 delivery intent/outbox 才与业务 mutation 同事务。幂等回执与业务 mutation 同事务(预留→执行→回填);幂等指纹=范围+操作+规范化请求,同键不同指纹返回幂等冲突。[C4/H8]
3. **TOCTOU 禁令**:校验与写入合入同一条件语句(`INSERT...SELECT` 带状态条件、`on conflict ... returning`),不做先查后写。[代码金矿 7]
4. **迁移不可变、只加法**:已应用迁移禁改;additive + NOT VALID→VALIDATE 两阶段 FK;回填只对唯一匹配写入,歧义留空强制显式重选。[C6/金矿 11]
5. **全表 workspace_key + 复合唯一/复合 FK**(业务 id+范围键),数据库层强制租户引用完整性,红夹具证明跨范围引用被拒。[H12]
6. **租户隔离在数据层**:显式谓词 + FORCE RLS;分页在数据库,禁全量拉取 subList。[C5]
7. **闭集收敛**:实体/枚举类型收敛到批准业务闭集,不用泛化技术类型冒充;每个可扩展类型解析到唯一 host owner。[PAUX-03/F5]
8. **树/层级全量快照**:规模有上界的层级一次性全量返回(不分页/cursor/懒加载),产品显式声明上界;树节点不携带权限。[F6/F8]
9. **扩展字段**:定义单版本 JSON+格式版本+revision;禁改已有字段类型;读时归一宽容旧数据;值随实体同事务保存,定义 owner 与值 owner 分离;未知旧值不展示不阻断且原样保留。[F1/F2/F3/金矿 B]
10. **快照式引用**:结果实体存名称快照,上游改名/删除不回写历史;"不可解析引用"是一等结果,禁 `name || id`。[F10/F15]
11. **结果型实体轻量**:创建即有效+单向失效,owner 不替下游推导结论。[F11]
12. **时间统一 epoch-ms**,业务时间来自注入 UTC Clock,禁直调系统时钟。[C7/R15]
13. **弱类型受限**:`Map<String,Object>` 只允许显式声明的 schemaless 扩展位;其余 wire/command/row/事件全 typed。[C2]
14. **破坏性数据清理五要素**:单一授权目标、forward migration、先 drift 报告 PASS、迁移后聚合 readback、business/cleanup 分账;清理后仍见退役 key 保持 fail-closed。[H10/H11]
15. **主数据状态语义精确**:启用/停用只决定新业务候选资格,不冒充经营事实。[F12]

### B.3 后端结构(单体内)

1. **纵向链固定**:generated 接口 → web adapter → typed command → application(事务)→ domain(无框架依赖)→ typed repository;controller 只转换 wire。[C1]
2. **模块边界即门**:domain 不依赖 Spring/JDBC;模块间默认禁 import,唯一例外显式 `<module>.api`;禁 server/common/shared/core/util/helper/manager 包;测试包镜像源码包。[R12]
3. **错误分层**:domain 失败不带 HTTP 状态/文案;transport 映射 typed Problem;每种冲突唯一错误码(唯一约束/版本/资源绑定/幂等各自独立),分类按具名约束名映射、禁解析 DB 自然语言消息;恢复行为与码一一对应。[C9/H1/H2/H3]
4. **依赖有界**:外部调用显式 connect/read/overall 超时;依赖不可用单独 typed,owner 本地异常 typed 500 不降级。[C8/H13]
5. **无状态前提**:不依赖进程内 session/单机缓存/节点亲和;加速层永不成为第二真相或授权来源。[C16/C17]
6. **查询正确性**:详情用精确 key;列表明确分页;被裁决的小闭集全量返回;候选截断须批准上限或显式分页。[R9]
7. **锁纪律**:固定锁序(如 order by id / ACCOUNT→SOURCE);批量认领 `for update skip locked`;advisory lock 集中 namespace:key,标识符白名单防注入。[金矿 5/J]
8. **set-based 优先**:先批量/`RETURNING`/`unnest`,后缓存;循环内 IO 即缺陷;优化不得改变锁序/版本条件/唯一约束/错误分类。[API/DB§4.3]
9. **写事务内禁外部往返**(Redis/HTTP/MQ send);application/domain 禁止用事件编排业务主链。`AFTER_COMMIT` 只允许具名登记的传输/遥测副通道，永不修改业务状态，audit 也不得走 listener。[N-1/C12/已冻结 ADR §3.9]
10. **outbox 双通道**(适用于真进程边界):提交后事务事件唤醒即时 publisher,定时 recovery-poll 只补漏不做常态 dispatcher;maintenance job 不混入投递闭集。[C12/C13]
11. **多步凭证流**:advisory lock 锁主体 + OTP version 乐观并发 + 用途分离 grant + `noRollbackFor` 保计数 + 幂等完成 + CONSUMED→REPLAYED 专码。[金矿 C]
12. **媒资两段式**:浏览器 bindGrant 与后端 claim 分离;receipt 去重;文件与 DB 原子推进;流式嗅探 magic bytes、流中限额、不信客户端 Content-Type;release 把 NOT_FOUND 视为收敛。[G1-G4/金矿 A]

### B.4 前端架构与状态

1. **状态唯一 owner 分层**:server fact→RTK Query;页面入口→router;每 Tab 非敏感查询快照→app 状态;跨界面 workflow→feature model;单表单草稿→local;同一事实禁多副本,也禁全局化一切。[I16/I17/R13]
2. **v4 式路由**:已登录 URL 只表达页面入口;查询/身份/范围/授权不进 URL;刷新回安全默认;直达仍走 registry+guard;URL 注入不得进 owner 请求。[N8/I22-I24]
3. **页面目录单一真相**:注册表从 generated catalog 派生并 `satisfies Record<GeneratedKey,...>` 绑死;未知 key fail-visible,禁动态造 route/menu/tab;懒加载注册表不复制标题/菜单/范围。[N4/N10/金矿 14]
4. **Content Tab**:key=pageDesignKey,同页唯一,激活不重排;身份切换关旧 Tab 清 cache 进新首页;范围切换保留 Tab 清数据重读;Tab 工具区统一刷新/全屏。[N5/N6/PAUX-10/I27]
5. **上下文生命周期单点**:每 app 唯一 listener 负责切换失效/重置/路由;请求携带上下文身份,迟到响应只写旧 key;上下文选择器未选时相关请求为零。[I18/E26]
6. **tag 资源级分类学**:按资源+复合 id(workspaceKey:resourceId);每个被使用 endpoint 必有 tag;手工 reload 与 invalidatesTags 不并存;每 app 只注入自己消费的 endpoint。[P2-1~4/金矿 16]
7. **五态守卫**:401/403/409/网络/依赖失败分流,"未预期失败"绝不伪装成未登录;每 app 必有会话边界+显式登出;路由级 errorElement + 404/403 兜底。[P1-1~3/金矿 17]
8. **分页四件套**:查询参数、受控 current、total、onChange 回写,缺一即缺陷;排序 server 端且 sortOrder 受控;禁静默截断(上限须显式提示或服务端搜索)。[P0-1/P0-2/G-10]
9. **失败必有反馈**:所有 mutation catch+typed feedback;Modal promise 交还组件或显式 catch+失败态,禁 `void` 吞;版本号未就绪阻止提交,禁 `?? 0`;二级依赖失败显式表达,禁一律 `?? []`。[P0-3/P1-6/P1-7]
10. **Drawer 生命周期标准机**:PRISTINE→DIRTY→SUBMITTING→FAILED/SUCCEEDED;dirty 统一计算、全关闭入口共用 guard、双回调去重、提交中整表禁用+幂等键、成功 readback→关载体→再成功反馈、失败保留安全草稿+白名单技术详情;动画回调不是关闭意图,禁 DOM 轮询/猜时长。[I8-I14/金矿 12]
11. **render 纯函数**;副作用只由事件或可清理 effect 驱动,严格模式幂等。[I19]
12. **base query 单点**:401 跳转、correlation 头、Problem 映射、路由模板归一只在唯一 baseApi;禁 per-endpoint transformResponse、feature 私有 console。[I20/R26/金矿 I]
13. **typed locator**:`{surface}.{control}` as-const 表,绑 data-testid,L2 用 getByTestId;accessible name 只做语义断言。[I26/金矿 18]
14. **组件纪律**:Pro 成熟组件优先,降级须记录理由;禁 deep import/覆盖 `.ant-*`/裸色值/散落 spacing;布局机械量集中 app 唯一入口;编码前用锁定版本 CLI 核对 API。[I1-I7/U1-U5]
15. **双后台共享边界**:`platform-admin` 与 `operations-admin` 保持独立 app。允许共同消费同一 OpenAPI wire/operation metadata 真相,但 generated endpoint/type 仍按 face 进入各 app 自身切片;runtime 只允许共享不含业务语义的 transport primitive,以及两个真实消费者已经证明不变量、生命周期、失败语义和演进原因同构的 Drawer lifecycle/Problem/accessibility/locator/layout 等机械 foundation。Shell、menu、Content Tab、router registry、session/identity/workspace/employment/data-scope context、store、baseApi、context invalidation、theme、page/read model/form workflow、page grant/capability/action mapping、业务文案和 L2/L3 必须 app-owned;默认禁止跨 app 共享业务 Page/feature、万能实体组件和预建 `shared/*`。[P2-5/R4/B2/PAUX-16/DG-03/本轮裁决]
16. **相似但不共享也要登记理由**:两 app 各自实现形似能力时,必须在各自 Frontend Architecture Map 或相邻 ownership 文档以一行 `INTENTIONAL_DIFFERENCE: <与另一端不同的政策原因>` 说明差异;没有差异说明的重复不能验收,但差异登记也不自动证明设计正确。Content Tab 的已知正例是 operations 身份切换关闭旧 Tab,platform 空间切换只失效相关 Tab 数据。这样既阻止该共享不共享造成漂移,也阻止 AI 因外形相似抹掉真实政策差异。[本轮裁决]
17. **foundation 反向依赖机器拒绝且保持 wire-agnostic**:ESLint `no-restricted-imports` 阻止 foundation import `apps/*`、任一 app-owned store/router/theme/catalog/session/context/业务类型,以及 platform/operations 任一 generated endpoint/type 切片;package 依赖图只允许 `apps -> foundation` 和 app 自身 `app -> app-owned generated`,禁止 `foundation -> apps/generated`、app 间 generated 交叉 import 或通过 foundation 类型重导出绕行,并进入 `verify`。foundation 只持 `RequestFailure` 等自身中立机械类型,不能通过动态 import、类型重导出、callback service locator 或测试夹具绕过方向。[本轮裁决]
18. **generated endpoint 按 contract face 静态切片**:edge OpenAPI 是唯一 operation wire truth;每个 operation 必须声明非空闭集 `x-consumer-faces`(`PLATFORM_ADMIN / OPERATIONS_ADMIN / PUBLIC` 等批准值),允许 multi-face。codegen 按该元数据为每个 app 生成且只生成获准 endpoint,输出留在 app 内并注入 app-owned baseApi;禁止共享 RTK Query API 实例、前端 allowlist、运行时过滤或从源码 import 反推 face。generated 只拥有 method/path/typed arg-result/wire enum/hook;session/context/correlation/Problem/tag/invalidation/navigation/feedback/cache lifecycle 均 app-owned。少量 shared operation 的 generated 重复可接受,不以去重为由上提业务所有权。[P2-4/A5/本轮裁决]
19. **contract/security/client 三方精确对账**:`x-consumer-faces` 同时生成业务 app 内的封闭 route-face registry/SecurityFilterChain 输入和两个前端 endpoint 切片;`verify` 断言 `OpenAPI face metadata ≡ server face registry ≡ each app generated slice`,未知/缺失 face、手写 allowlist、额外或漏生成 endpoint 一律失败。face 只表达暴露面,不表达 session/page/action/scope 授权。endpoint 数量、codegen/类型检查耗时和 bundle 变化是工程证据,不能反向修改 wire face 真相。[本轮裁决]
20. **generated wire type 按目标生成可达闭包**:OpenAPI components schema 保持唯一 wire 真相,服务端及每个 consumer target 只生成其获准 operation 引用可达的 arg/result/model/enum 闭包;同一 schema 在多个 target 中出现机械 generated 重复是正确结果,不建立全局 generated model 包。禁止切片携带不可达 schema、跨 app import generated 目录、全局 `export *` barrel、手写复制 wire DTO/enum,以及通过 foundation 间接暴露另一 face 的模型面。`verify` 对每个 target 复算 operation→schema reachability、import 方向和生成字节;foundation 必须保持 wire-agnostic。[D.2/本轮裁决]

### B.5 交互与信息架构(PAUX 沉淀)

1. **任务模型优先**:页面按用户任务建模,不按 CRUD 实体表格;多类主体分 Tab 不挤一表取字段交集;层级实体左树右详情。[PAUX-05/06]
2. **详情只读语义**:bordered 只读详情,禁 disabled 表单冒充;不同实体字段矩阵各自批准,禁字段并集万能 DTO;可复用的是机械载体不是字段集合。[PAUX-13/16/J15]
3. **列表/详情/动作三定律**:列表无操作列;名称链接进右侧详情;动作只在详情右上且仅显示当前可执行;点动作先关详情再开下一载体;无动作留空不放伪按钮。[J6-J8/U10-U12]
4. **危险动作**:停用/删除/撤销/取消/失效统一 danger+确认 Modal;编辑不是危险动作。[PAUX-13/U27]
5. **已知上下文不重复**:Shell 已表达的上下文页面内不重复展示(但查询注入不省略);从详情发起的子任务不再要求选择父实体,父实体用上下文摘要不伪装 disabled 输入框。[PAUX-15/08]
6. **搜索区统一骨架 + 实体三矩阵**:统一 ProTable search 形态;每实体逐项批准搜索控件/排序/单元格矩阵,禁复制通用筛选。[PAUX-11/U23/J10]
7. **一次性凭证 UX**:链接长期可见(列表/详情/成功页)+复制;重发旧代失效;公开基址是后端部署配置,禁写前端源码;可见性不改变完成侧校验。[PAUX-04/G17]
8. **反馈分层与状态不冒充**:loading/真空/查询无结果/错误/冲突/无权各态独立;成功只在 owner readback 后;聚合页 per-source status+asOf;错误文案只说可行动原因,禁技术词。[E1-E9/U26]
9. **候选级联**:按上游最终类型过滤,切换清空失配项;owner 复查同一不变量。[PAUX-02/F10]
10. **Shell**:成熟 ProLayout;标题语义层级;上下文选择器右置;按上下文要求分组菜单;登录后落角色首页,不停在 spinner。[PAUX-09/G-05]
11. **单入口资源维护**:有图预览+更换/移除,无图上传,不设意图前置选择;详情直显资产缩略,不用"已配置"文字替代。[PAUX-08]
12. **可访问性**:全键盘可达、焦点可见且归还;仅图标按钮有 accessible name;disabled 仅用于需理解的不可用并就近解释,无权即隐藏。[U7/U8/U19/G-22]
13. **真实异步边界的 UX**:仅对未来逐 Journey 批准的真实异步资源,界面才可按明确契约使用 readback+有界重试处理短暂未就绪,禁单次 404 定死失败。单体内资源 claim、普通 owner 写入和外部搜索 watermark 均不得借此引入轮询、固定等待、双读或追平状态机。[J18/本轮裁决]
14. **任务型 read model 以独立决策 surface 为粒度**:列表首次加载、详情、表单支持以及拥有独立 loading/error/recovery 生命周期的 Tab/区域分别定义 task query/read model;不机械追求一页一请求,也不让一个 surface 并行调用多个 owner API 自行拼装。read model 归发起任务模块的 query 包,正向命名使用 `<业务任务>View` / `<业务任务>FormSupport`;禁止按数据库实体、Scenario/Step、React 组件或路由命名,禁止通用 `PageResponse<T>`、字段袋、万能候选 DTO 和动态查询 DSL。list/detail/form-support 只复用稳定小值类型,read model 不进入 command 参数或模块协作 API;两个后台可因 actor、信息层级和任务不同拥有不同 read model。[本轮裁决沉淀]
15. **detail 的可执行动作只能由 owner 判定**:组合 SQL 只允许 workspace/revoked/scope 等安全过滤谓词,禁止用 SQL `CASE` 或业务谓词推导动作可用性。装配 detail read model 时,调用目标 owner `<module>.api` 的纯判断函数,输入可信 `ExecutionContext` 与本次已读的 owner-defined 判断事实,输出 typed action availability/reason;零额外 DB/HTTP 往返。查询层不得复制 `grant ∩ 对象状态/来源` 规则,command 仍由 owner 在事务内重查。[本轮裁决沉淀]

### B.6 性能

1. N+1 即缺陷:循环内查询/请求一律批量化(`IN`/`unnest`/批量 resolve);同页同规则只取一次。[S-3/F4]
2. 先 set-based 后缓存;缓存 key 版本内嵌(不可变条目,零失效逻辑);会话/限流/幂等/CAS 永不进缓存。[B.2 系列]
3. 每请求 DB 操作计量(CountingJdbcTemplate 模式)作为常驻 N+1 探针。[金矿 9]
4. 断言性能问题须 SQL 文本+EXPLAIN,不凭次数猜索引;为性能删审计/幂等/CAS/限流是禁手。[API/DB§4.2]
5. **模块边界不是数据访问边界(防 v2/v4 往返病的核心条款)**:写路径归各模块 owner(一个事务、set-based);**页面读路径由发起该用户任务的模块持有任务型 query,以显式 SQL 跨 schema join 完成**,不建全局组合查询层,也不逐模块调 API 各查各的——"进程内 N+1"与跨服务 N+1 是同一种病。模块细分免费,数据访问细分才收费,二者必须解耦。[本轮裁决沉淀]
6. **每个独立决策 surface 的 DB 往返预算(默认值,超出须在评审说明理由)**:每个 task read endpoint ≤3(上下文解析 1 + 主查询 1 + 可选计数 1);列表、详情、表单支持以及延迟加载的独立 Tab/区域分别计量,不得把整个 React 页面强压成一个预算,也不得把同一 surface 拆端点绕过预算。简单写 ≤5(条件写含校验 1 + 审计/outbox 同事务 1-2 + readback 1);会话上下文每请求解析一次,授权判定基于已载入上下文内存完成,祖先/范围校验以 EXISTS 并入主语句。owner 纯动作判定是进程内计算,不增加 DB 次数。预算以 `databaseOperationCount` 断言进测试(H.1.4)。

---

## Part C. 代码级样板携带清单

以下模式以 v2(冻结)中的实现为**样板参考**——本表是指针不是搬运,v2s 重写时对照实现,file:line 以 v2 冻结时点为准。注意区分两类:多数条目**立即适用**;proof 幂等回执、HMAC 信封、STALE/GAP/POISON 投影、repair 快照四条属**触发时适用**(资金域提取、Dexter 重启 TDP 设计后批准其进程边界,或实测证据批准提取 indexer worker 等真实边界时才实现,单体与单纯外部搜索引擎接入均不建,见 Part E/F)。

| 样板 | v2 参考位置 | 防什么 |
|---|---|---|
| 幂等回执同事务(预留→执行→回填+常量时间指纹 replay) | organization `OwnerCommandProofReceiptService` | 重复变更/重放 |
| outbox 原子 CTE+基数断言;send 后 markPublished;指数退避 | organization `…ProjectionOutboxRepository/Publisher` | 丢消息/竞态误标 |
| STALE/GAP/POISON 三分类+repair 状态机 | workspace-iam `…ProjectionRepository/Consumer` | 坏消息打爆重试/静默漂移 |
| REPEATABLE_READ 修复快照 | `…ProjectionOutboxService.queueRepairSnapshot` | 撕裂视图 |
| 闭包增量 append+基数断言(全量仅 repair) | `OrganizationAuthorizationClosureRepository` | O(全树) 写+丢行 |
| on-conflict-returning 消 TOCTOU;幂等完成 returning | `WorkspaceInvitationAcceptanceRepository` | 并发双花 |
| dummy hash+双桶 fail-closed+HMAC 指纹 | `PlatformSessionService`/`PlatformLoginRateLimitPolicy` | 枚举/爆破/计时侧信道 |
| 封闭路由面+多链 denyAll | v2 gateway `GatewayRouteFaceClassifier`/`SecurityConfiguration` 只作行为样板;v2s 由 OpenAPI operation `x-consumer-faces` 生成业务 app 内 route-face registry,再驱动 `SecurityFilterChain`;与各 app generated endpoint 切片三方对账 | 忘加鉴权即可达、客户端切片与服务端暴露面分叉 |
| 内部命令 HMAC 信封(audience/operation/digest/TTL+lengthPrefixed) | platform-iam `…CommandEnvelopeVerifier`+`CryptoSupport` | 绕过网关/拼接歧义 |
| additive 迁移+唯一匹配回填 | workspace-iam `V18__…` | 长锁/猜错脏数据 |
| 媒资两段式 staging claim+流式嗅探 | platform-asset `PlatformAssetStagingService` | 盗绑/半成功/polyglot 文件 |
| definition JSON+格式版本+类型兼容守卫+读时归一 | extension `ExtensionDefinitionService` | schema 演进破坏历史值 |
| 多步凭证流(advisory lock+otp_version+分用途 grant+REPLAYED) | workspace-iam 邀请/找回两 service | 步骤跳跃/重放/双花 |
| useDrawerFormLifecycle 全部隐性坑 | admin-ui-foundation `behavior/` | 误关草稿/双回调/脏重挂 |
| navigation port 注入 store 工厂 | platform-admin `store.ts` | 状态层反依赖 router |
| satisfies 绑定 generated union | operations `pageRegistry.ts` | 漏配/多配页面 |
| 架构归属测试四件套 | `tests/architecture/*` | 归属约束文档化即漂移 |
| 五态会话守卫 | `PlatformSessionBoundary` | 500 伪装未登录 |
| run-managed(自测五 fixture+双记账+启动令牌+禁端口杀) | `scripts/test/run-managed` | 误杀/泄漏不可见/门不可信 |
| 门红夹具范本(expect_breaking_diff/临时违规目录) | `scripts/check/openapi-contracts`/`frontend-architecture` | 永不红的门 |
| generator `--check` 字节比对+count 断言+语义绊线 | `scripts/generate/admin-catalog`(修复后) | 生成物漂移/静默增删 |
| bundle 声明式 inputs/outputs 增量 | 根 `build.gradle`;只带增量构建模式,原同行的共享 wire `importMappings` 随多服务拓扑退役 | 输入未变仍重生成/输入已变却漏生成 |
| 消息信封 header/body 交叉校验+broker 失败落库 | workspace-iam consumer+`…BrokerFailureRepository` | 伪造 envelope/坏消息不可见 |

---

## Part D. 工程治理标准

### D.1 目录与布局
- 前端:`src/app`(kernel)+`src/features/<能力>/{ui,model,automation}`+`src/tests/{architecture,l2,l3,traceability}`;禁止根 `pages/components/shared/common/hooks/utils`;由 project-layout policy + 门强制。[R11]
- 后端:单 app 内 schema-per-domain、包边界按 B.3.2;runtime 命名永不跟随 Scenario/Step ID(它们只是 trace metadata)。[D1/D2]
- contracts 按真相类别分层:`openapi/`(wire)+`catalog/`(静态业务目录:页面/动作/presentation/problems)+`protocol/`(跨边界协议键)+`policy/`(门的分母);物理 topic/SQL/路由 path/日志模板/locator 不进契约。[H5/H6]
- 空目录、红夹具脚手架不留源码树;`__red__` 类 fixture 放测试专属位置。

### D.2 契约治理
- 契约是唯一真相:页面/动作/枚举/错误码/协议键/展示文案全部生成 typed symbol,生产代码禁裸字面量(测试保留白名单按精确路径登记);改名必须导致旧 Java 编译失败+旧 TS typecheck 失败,scanner PASS 不得替代编译证据。[H4/H7/M-1]
- 每个 generator:count 断言+唯一性+语义绊线+真 `--check`(字节比对);生成物带 Do-not-edit 头,禁手改。
- 契约变更影响分级:改 key/结构=业务授权变化,回 Journey 评估;纯展示字段变化=普通变更。[N12]
- presentation 契约必须覆盖**全部**状态域(含邀请/任职/账号),同一枚举唯一中文;术语门必须扫前端实际 label。[S-2/P0-4]

### D.3 门纪律
- 每个门三件套:production validator、`--self-test` 共用核心逻辑、至少一个真会失败的 red fixture;"self-test 展示未接线能力"是最高危假保障,新门验收必查 run() 实际执行面。[T8/L21/M-1]
- 门只判客观事实,不宣称理解业务语义;结构门绿≠业务完成。[B8]
- 机器门当前红时,任何以"门全绿"为前提的声明不成立。[M-3]

### D.4 文档治理
- decisions 一事一文,带 status 与 supersede 链;被 supersede 的条款显式标注,后来者优先。
- 文档三类物理分开:业务真相(Journey/线框/矩阵)/ 决策 / 评审与证据;evidence 只读归档,历史 closure 永不 fallback 为当前。[T11]
- active-document-index 唯一指向当前分母 owner;评审交接按六段模板并过检查脚本。
- Claude 产出文件名带 `-claude` 后缀。
- 状态诚实分级:架构验证≠证据就绪≠可切流≠产品可用;首败 manifest 保留。[L14]

### D.5 流程右尺寸化(带质量底线,弃仪式重建)
- **保留的质量底线**:设计先行(spec→实现)、批次有限边界、Step 断言/readback/各级证据、business 与 cleanup 分账、红夹具门、独立对抗审查用于高风险类(owner/契约/schema/安全/事务边界)、根因修复+同类闭集扫描(FIXED/ALREADY_CORRECT/NOT_APPLICABLE)。[L10/T12/R2]
- **准备物全部脚本化**(已批,见 2026-07-23 提案):机械字段生成、语义字段 NEEDS_AUTHOR 占位、门拒未填占位。
- **弃用重建**:逐次写许可(已被 preflight+收口审计 supersede)、per-Step receipt 目录、v2 批次专属的 obligation/reopen 机器——v2s 治理 ADR 另行定义,不照搬。[L8]
- 证据绑定必须字面展开(命令/selector/期望结果),禁占位符 run 背书多 Step。[L18/历史假绿教训]
- 测试与实现独立派生,禁从实现反推 oracle 固化缺陷为绿灯;高风险断言配 discriminator(貌似合理的错误实现被真实拒绝)。[T1/T2/G-24]

### D.6 后端技术栈候选与依赖白名单(Dexter 裁决 + ADR 评审收紧,2026-07-24)

**版本候选**:Java 21 + Spring Boot **4.1** 是 W1 compatibility spike 的首选目标,不是本 manifest 直接冻结的永久版本基线。理由:新仓应避免落在临近停服线,且本栈暴露面小(无 JPA/无 Spring Cloud),但 OpenAPI generator、Framework 7、Flyway、Testcontainers 与安全链必须先在 walking skeleton 中取得真实兼容证据。三个条件:(a) spike 锁定精确候选版本,AI 编码前按该版本官方文档核对 API,**禁凭 3.x 记忆写 4.x 代码**;(b) 白名单依赖逐项通过编译、启动、generated binding 与真库测试;(c) 证据通过后由 W1 决策冻结精确版本；遇硬阻塞时由新 decision 选择受支持版本,不得把回退静默实现为兼容双线。

**白名单(全部 v2 已在用 + 一个新增)**:

| 库 | 用途 |
|---|---|
| Flyway | 迁移历史(additive-only 载体) |
| OpenAPI Generator | 契约→代码 |
| Testcontainers + JUnit 5 | 真库测试 |
| PG 驱动 / Jackson | 基础 |
| **ArchUnit(新增)** | 模块边界规则写成 JUnit 测试(domain 无框架依赖、模块间只经 `<module>.api`、禁 shared/util 包),天然进 `scripts/verify`——前端 architecture tests 的后端对等物 |

**禁入清单(每条有因,新增依赖须 Dexter 裁决)**:
- **JPA/Hibernate**:懒加载是隐藏 N+1 头号来源,与 B.6.6 的 DB 往返预算直接冲突;SQL 必须显式(JdbcTemplate/JdbcClient);
- **Lombok**:Java 21 records 已覆盖;
- **Spring Cloud 全家**:那是多服务动态寻址的配套;v2s 扩节点 = 无状态副本 + LB 一行 upstream(K8s 时代 Service DNS 亦已取代服务发现),与库无关;
- **Redis/MQ 客户端**:按 Part E 触发条件进入,触发前不进依赖树;
- **外部搜索引擎/client/indexer**:PostgreSQL 是默认搜索承载;只有批准 Journey 需要 PG 不具备的相关性、纠错、同义词或多字段全文能力,或优化后真执行计划/压测证明 PG 无法满足 SLO,才可由 Dexter 裁决加入白名单。引擎是基础设施依赖,不自动产生 `search-service`、indexer worker 或 MQ;
- **Resilience4j/Quartz**:无内部跨服务调用;维护任务 `@Scheduled` + SKIP LOCKED 已多实例安全。

原则:**每少一个库,`verify` 快一分,AI 写错的方式少一类**。

### D.7 AI-first 底座迁移(v2s 仓内开会话的前提)

Dexter 迁移后将直接在 v2s 目录内开 AI 会话,底座必须随仓就位:

| 组件 | 处置 |
|---|---|
| `AGENTS.md` | **重写而非照搬**:按 Part H 阶段策略右尺寸化——保留红线(契约唯一真相、门、readback、`verify` 纪律、Git 归人),删除 v2 批次仪式条款(receipt/permit/obligation 流程);首条即指向本 manifest 为冻结输入 |
| `CLAUDE.md`(仓内) | 新写:评审方入口约束 + 指向 manifest 与 ADR;沿用"从仓根启动会话、skill/memory 以仓内为唯一真相"的既有规则 |
| `.agents/skills`(经 `.claude/skills` 符号链接发现) | 只带仍适用的 cs-* skill 并改写内部路径:memory-recall、code-structure-recall、failure-recall、spec-to-plan、managed-runtime-execution;批次交付类(delivery-verification)待新治理 ADR 定形后再改写 |
| `project-memory/` | 结构照搬(kernel + routed + Heritage 指针);**内容按已冻结服务形态 ADR + 本 manifest Part B–D 重新播种**(本文即最大的一次记忆重整);Heritage 指针指向未来冻结的 v2 与 v4/v6 原文 |
| context provider | **不带**——按 2026-07-24《语义上下文 Provider 彻底退役》裁决:记忆唯一路径 = project-memory 原文 + 封闭路由 + 逐文件回读;代码结构唯一路径 = rg/源码/compiler/LSP/focused build |
| hooks | 只带实测过事件的最小集(M11);Prompt hook 只推荐仓内 skill,不自动查询或注入 |
| roadmap 程序注册表 / active-document-index | 空表随仓初始化(A17/A18 规则不变);不复制 v2 的任何程序状态 |

**Claude 会话记忆连续性(重要)**:评审方的用户级自动记忆按**目录路径**绑定,v2s 目录 = 全新记忆空间,v2 会话记忆不自动跟随。两条关键个人约定须在 v2s 首会话重新播种(写入仓内 CLAUDE.md 即可):① Claude 产出文件名带 `-claude` 后缀;② 当前阶段标尺(solo+AI 快速迭代,建议按分钟级回归网过滤,生产化欠账进 HANDOFF.md)。

### D.8 日志与诊断
- 统一 correlation/request/trace 链;typed 结构化日志+集中脱敏(键黑名单+值 redact);禁 feature 私有 console/自由 logger。[K1/K2]
- log/audit/feedback 三分离;correlationId 是查找键不是信任边界。[K6/K5]
- 每请求 DB 计量常驻;>30s 受管运行 30s 进度+双记账;失败先读日志再重试,同 signal 二次尝试必须引用首败证据。[R19]

---

## Part E. 显式延后声明

1. **TDP 完全退出当前设计与建设分母**;商品/发布域设计不自动触发 TDP。只有 Dexter 明确要求开始 TDP 时,才依据真实终端 Journey 重新讨论其服务形态、激活条件、契约和基础设施。当前业务 app 不得预建 TDP app/module/schema/database/topic/contract/MQ/运维页面,也不得内置任何假设终端同步在线的逻辑。
2. **资金域(支付/权益账本)提取条款不预写**;模块边界纪律即全部前提,触发时(资金合规/独立凭据诉求)按 Part C 样板+归档 proof 设计提取。
3. **搜索能力按证据阶梯激活,不预设独立面**:
   - 默认只使用 PostgreSQL 的显式索引、trigram、FTS、受控分页/排序与必要读副本;先完成查询计划、索引和 SLO 证据,不得以"第二期"、数据量猜测或多模块使用为由引入搜索引擎;
   - 只有批准 Journey 需要相关性排序、容错纠错、同义词、多字段全文检索等 PG 不具备或不适合的能力,或优化后的 PG 经真实执行计划与压测仍无法满足已批准 SLO,才允许 Dexter 裁决激活外部搜索引擎;
   - 外部搜索引擎与 PostgreSQL 同属基础设施依赖,不构成我方新 deployable,不自动创建 `search-service`、indexer worker 或 MQ;发起用户任务的业务模块拥有 search adapter 和页面查询语义;
   - 索引文档是可丢弃、可重建的派生数据,必须携带 workspace、scope、visibility、sourceRef 与 watermark,不得保存 secret、raw payload、完整账单或未经批准的敏感原文;搜索结果只返回安全摘要、引用和水位,详情与任何业务动作回 owner 重读、重鉴权并复查状态/不变量;
   - 事务性列表、读后立即修改与授权敏感查询永留 PostgreSQL;搜索索引的最终一致性不得伪装成业务强一致;
   - 需要可靠索引更新时才建立 owner outbox,提交后即时索引挂入 Part B/Q4 唯一 `AFTER_COMMIT` 传输副通道白名单,recovery job 只补失败/崩溃,不做常态 dispatcher;此形态不自动引入 MQ;
   - 只有索引吞吐、资源隔离、独立扩缩容或故障生命周期已有实测证据,才允许另行裁决提取无业务语义的 indexer worker;
   - 搜索引擎激活验收必须提供“从 PostgreSQL owner facts 全量重建索引”的受管命令并至少演练一次;缺可执行重建与演练证据时,不得声称索引可重建或完成激活。
4. **异地多活延后**:单中心起步;全表 workspace_key+无状态应用已保留单元化与分片退路。
5. **多活/跨区条款**(v2 中 R8 等)转为"真进程边界出现时激活",见 Part F。

---

## Part F. 拓扑重判表([拓扑专属] 条款在 v2s 的处置)

| v2 条款 | v2s 处置 |
|---|---|
| owner 间禁同步 HTTP/调用无环/proof 传授权 | **收缩到获批真业务进程边界**;基础设施反向代理↔业务 app、外部搜索引擎↔业务 app 均是基础设施边,不自动成为业务 owner 或我方新 deployable;单体模块间=方法调用+同库事务,禁自造进程内"伪 RPC" |
| outbox+MQ+版本化投影+repair | 同上,仅真边界;单体内跨模块事实=同事务或直接查询;样板保留(Part C) |
| 跨服务 correlation/parentEventId 剥离 | 标准反向代理入口覆盖式写入 forwarded/correlation/parent 类头并注入边缘共享凭据;业务 app 只信任已通过边缘凭据校验的代理链,内部传播简化为线程上下文 |
| 服务间不共享业务 Java model | 模块间只经 `<module>.api` 接口;edge wire schema 一份真相,服务端与各 consumer target 分别生成 operation 可达类型闭包,不建共享 generated model 包 |
| 每服务独立 schema/迁移可裁判 | 保留 schema-per-domain 与模块 migration 目录组织,但由一个 deployable 的同一 Flyway lifecycle 聚合执行,只有一份全局 history 和 UTC 秒+毫秒严格单调版本;不保留每 schema 独立 history |
| 中间件兼容矩阵/broker 版本锁定 | 仅在获批真实 broker 使用场景出现时激活;外部搜索引擎接入本身不自动激活 broker/MQ |
| AI 底座 provider/记忆分档(M 系) | 记忆分层/只读回读原则保留;**provider 类条款已被 2026-07-24 退役裁决 supersede,不带** |

---

## Part G. 跨域同步的前端补偿清单——v2s 一律不再做

**背景**:v2 的多服务多库拓扑造成跨域数据要靠投影异步同步,于是前端长出了一批"为后端拓扑打工"的补偿代码。它们看起来像正常前端逻辑,**不标记出来 Codex 一定照抄**。本节逐项列出:v2 现状(带实证位置)→ 根因 → v2s 处置。

**总规则**:前端不得为后端的最终一致性做任何补偿(重试、轮询、双读、刷新兜底、"稍后再试"状态)。单体内一次查询返回完整、即时一致的结果是后端义务。获批的外部搜索能力可以把最终一致性作为该搜索 surface 的显式契约语义:结果必须携带 watermark,UI 可用批准业务语言标注“结果截至…”,但不得轮询、双读或猜测追平;打开详情与执行动作必须回 owner 重读、重鉴权。其他真进程边界若未来出现,其 UI 语义逐 Journey 裁决,不得从搜索例外泛化。

### G.1 Logo/资产链(Dexter 点名的例子,逐环节判)

| 环节 | v2 现状 | v2s 处置 |
|---|---|---|
| 上传 | 两段式:先传 asset 服务得 staging | **保留两段**(multipart 与 JSON 表单天然分离,与拓扑无关) |
| 表单提交 | wire 携带 `logoAssetRef + logoBindGrant`(platform-workspace.schemas.yaml:69/88)——跨 owner 授权舞步进了公开契约 | **`logoBindGrant` 从 wire 删除**;同 app 内保存与 claim 同一本地事务,无需跨 owner 凭证 |
| claim 生效 | workspace 保存后经 outbox→投影异步 claim,`logoUrl` 存在**短暂 404 窗口** | 同事务原子生效,**提交返回即有效** |
| 前端展示 | `WorkspaceLogoImage.tsx:19-38` 整套有界重试状态机(attempt/retryTimer/MAX_RETRY_ATTEMPTS,注释"transient 404") | **整个组件的重试逻辑删除**,`<Image src={logoUrl}>` 即可 |
| URL 来源 | `logoUrl` 由后端拼好、契约明令"clients must not derive it from logoAssetRef"(schemas:36) | **这条 v2 做对了,原样保留**——展示 URL 永远后端拼好带出 |
| 错误码 | PLATFORM_ASSET 跨 owner 绑定冲突码系 + 前端逐码文案 | 收敛为普通本地校验错误,冲突码系大幅缩减 |

### G.2 其余六类补偿(逐项)

| # | v2 前端补偿 | 实证 | 根因 | v2s 处置 |
|---|---|---|---|---|
| 1 | 上下文切换后 `session.refetch()` 补拉(mutation 明明已返回 entry) | OperationsContextShell ×3 处 | 投影可能未追平,双读保险 | **删除**;mutation readback 即完整事实,单次返回可信 |
| 2 | "数据暂不可用/请稍后"类投影滞后状态(REPAIR_REQUIRED、typed stale 的 UI 分支) | 扩展定义 stale 恢复、投影 fail-closed 提示 | 投影断链需修复窗口 | **删除**(同事务读无滞后);外部搜索 surface 只展示契约 watermark/“结果截至”,不建立前端重试、轮询、双读或追平状态机;其他真边界按未来 Journey 单独裁决 |
| 3 | 页面多 owner 查询扇出与前端拼装(business-entity 页 **9 个 query**:实体+品牌候选+扩展定义+会话,分属 3 服务;contract/store/user 页各 4 个) | 各 *Page.tsx | 跨库无法 join,只能前端并行拉+拼 | 后端**按独立决策 surface 出任务型组合查询**;列表、详情、表单支持及独立延迟加载区各自拥有 read model,既不机械一页一请求,也不让单个 surface 并行拉多个 owner API。任务型 query 归发起该用户任务的模块 application/read adapter,**零自有表、零 repository、零业务不变量**,不建全局组合查询/BFF 模块;mutation 仍调用目标 owner command。字段按批准 surface 矩阵定义,不是万能聚合 DTO(PAUX-05 教训) |
| 4 | candidates 类投影端点(门店候选、邀请组织候选)+ 其 tag 交叉失效网 | operationsApi 候选 tag 交叉失效 :127-134 | 候选事实在别的服务,靠投影复制 | owner 直查 + join,新鲜度问题消失;tag 网大幅简化 |
| 5 | 前端复算跨域不变量(候选按组织类型过滤等) | PAUX-02 一类 | owner 间难以同事务复查,前端先挡一层 | 前端过滤只留 UX 提示;**owner 同事务复查成为唯一防线**(本来就该如此,v2s 让它变便宜) |
| 6 | 概览页 per-source status/asOf 的"部分失败"拼装 | G-18/G-19 多来源 overview | 多 owner 各自可用性 | 单体内同库读,**per-source 降级态删除**;搜索结果只按其契约显示整体 watermark,不得复活通用 per-source 拼装;其他真进程边界/外部系统参与时按批准 Journey 决定 |

### G.3 保留不删的(容易误删的三样)

1. **邀请/找回的多因子与分用途 grant**——与拓扑无关,是安全设计(一次性 token 不是单独凭据);
2. **上传两段式本身**(见 G.1 第一行);
3. **公开流程对"资源最终激活异步"的有界处理原则**(J18)——原则保留,但只适用于未来逐 Journey 批准的真实异步资源;单体内不允许再出现"激活窗口",搜索 watermark 也不得借此引入自动有界重试。

### G.4 给 Codex 的判别法

遇到 v2 前端一段逻辑拿不准是否照抄时,问一个问题:**"这段代码是在处理用户的意图,还是在处理后端两份数据暂时不一致?"** 前者带走,后者丢弃。典型嫌疑特征:重试计数器配固定上限、`refetch()` 紧跟已返回数据的 mutation、"稍后重试/暂不可用"文案、同一页面 ≥3 个并行 query 且互相等待、以 Grant/Proof 命名的表单隐藏字段(注意:`xxxRef` 类引用字段本身合法——`logoAssetRef` 就保留;嫌疑的是跨 owner **授权凭证**进表单)。

---

## Part H. 阶段策略:solo + AI 快速迭代期的最小稳定网

**现状裁决(Dexter,2026-07-24)**:当前阶段是一人带两个 AI(Codex 实现、Claude 评审)、一台开发机一台远端服务器,目标是**快速开发测试功能直到符合预期,之后移交正式开发团队维护**。本节按此现状右尺寸化,优先级高于任何"生产化最佳实践"的惯性。

**本阶段唯一真正的敌人**:AI 改新功能时悄悄弄坏已做对的功能,而人没时间手工全量回归。因此该优化的是**带回归底线的迭代速度**——门和测试不是官僚,是敢让两个 AI 全速跑的前提;但底线必须便宜到分钟级,否则会被绕过而名存实亡。

### H.1 现在就做(仅三件 + 一个顺手项)

1. **一条命令的验证入口 `scripts/verify`**:收口 contract/generator `--check`、lint、架构规则、编译/typecheck、单元测试、Testcontainers 真库 migration/integration 与门的 red fixture,分钟级跑完且一次性退出;不启动浏览器或持久 DEV 环境,不读取/写入开发库,不 seed,可与正在运行的 DEV 并行且互不干扰。纪律唯一:Codex 宣称"完成"前必须跑,Claude 评审时重跑。不搭 CI 平台——这是 CI 的 90% 价值、0% 基建。
2. **动态证据独立且不可互替**:Walking skeleton 与受影响 Journey L2/L3 只经 run-scoped 受管入口启动标准反向代理、业务 app、双前端和临时资源,分别记录 business/cleanup;`verify PASS` 不冒充 UI/业务 PASS,动态 PASS 也不覆盖静态/真库门失败。`dev start`、`seed`、`verify` 三命令严格分离,启动 DEV 永不隐式 seed。
3. **Walking skeleton 先行**:先打通"登录 + 一个真实页面"最薄全链(标准反向代理→业务 app→库→前端→L2),并证明外部伪造内部头被覆盖、直连 app 因边缘凭据缺失而拒绝,再批量搬 feature。零成本,防"搬完才发现集成层有坑"的返工。
4. (顺手)**端点 DB 次数预算断言**:计量器已在,写到哪个端点的测试就顺手加一行预算断言;不做专项。

**证据链不绑定执行者**:每次变更必须通过 `verify + walking skeleton + 受影响 L2` 是证据链定义,当前由 Codex 完成前自跑、Claude 评审时重跑;移交后可由真 CI 执行,该平台欠账进入 `HANDOFF.md`,不在本阶段预建。

**受影响 L2 必须确定性派生**:改动触及的模块必须运行 traceability registry 中该模块 owned 的 L2 spec 集,walking skeleton 恒跑;横切/foundation 或无法确定唯一归属的变更运行全量 L2。映射与选择结果由机器复算,不得由实现者临场挑选、按页面是否存在猜测或手写跳过。

**DEV 五命令分权**:

- `scripts/dev/start`:启动标准反向代理、业务 app、双前端与 PostgreSQL,只负责运行拓扑;Spring app 启动时正常由 Flyway 应用尚未执行的 additive schema migration,这里“不迁移”仅指不迁移/注入开发数据语料,绝不表示禁跑 Flyway;不 seed、不清库。已有 active DEV manifest 时只报告已运行,禁止叠加第二套环境;
- `scripts/dev/restart`:按 active manifest 重启进程并保留数据库与开发资产,代码/配置变化后正常使用,不 seed;
- `scripts/dev/stop`:只回收 active manifest 登记的 child tree/容器/资源,不按端口或进程名模糊清理,不删除持久开发数据;
- `scripts/dev/seed`:显式写入开发语料,重复执行必须幂等或以可判别错误拒绝既有数据漂移,禁止静默 reset;
- `scripts/dev/reset`:唯一破坏性 DEV 入口,按显式 allowlist 重建数据库并清理 asset 模块登记的开发存储路径/对象桶;reset 后不自动 seed。执行前后产出 reset report,逐项记录数据库与资产 readback 数量,任一未归零/未达期望即 FAIL。

DEV 数据卷、资产存储与 Testcontainers 临时资源完全隔离;`verify` 和受管测试不得复用 DEV 数据。当前阶段不新建 health/readiness 端点;受管启动直接复用 walking skeleton 的入口断言子集(代理可达、登录页 200、外部伪造内部头被覆盖/剥离),禁止另写会漂移的第二套迷你探针。进程自身仍输出 run-scoped 结构化 `APPLICATION_READY` 事件供 runner 定位启动阶段,但事件本身不替代入口断言。

### H.2 本阶段明确不做

CI 平台、备份/恢复演练、密钥轮换、健康/就绪端点、部署回滚故事、指标体系——**全部不做**。这里不做的是自动化执行平台,不是放弃上文的证据链语义。DEV 数据只在显式 seed/reset 命令下处理,`dev start` 与重启均不隐式清库或 seed;语料与文档在 git,单服务器重启即"部署"。

**与 D.5 的关系(消歧)**:D.5 保留的"独立对抗审查用于高风险类"在本阶段**就是现有的 Claude 评审轮**,不是新增机器;且只在 owner/契约/schema/安全/事务边界变更时触发——日常功能开发的验证就是 `scripts/verify`,不叠加任何仪式。

### H.3 `HANDOFF.md` 欠账单(随仓建立,十分钟)

`HANDOFF.md` 只登记**有意延后的生产化欠账**,不是业务 Roadmap、通用 TODO 或第二份架构真相。初始登记七项:CI 执行平台、备份/恢复、密钥轮换、health/readiness 端点、部署回滚、指标/告警、Q9 单 runtime DB role 的已知权限边界。

每行一次性填写七个字段:`id`、`currentBoundary`、`deferredReason`、`risk`、`activationTrigger`、`futureAcceptanceEvidence`、`decisionSource`。`activationTrigger` 必须是可判定事实,例如“出现第二个真实外部 upstream”“启用搜索引擎”；服务形态的已冻结团队 trigger 是“专职后端开发人数达到 2 人（AI 不计）”。“规模变大后”“业务复杂后”“团队人数超过 N”等模糊词不合格。

`scripts/check/handoff-debt` 只做三件事:检查 manifest 声明的 deferred item 均存在、必填字段完整、稳定 ID 唯一。它解析 Markdown 并在秒级退出,不建立状态机、平台或欠账管理系统。trigger 尚未发生时,未关闭欠账不阻断当前交付;trigger 一旦成立,对应欠账必须先完成并取得证据,不得继续绕过。

关闭欠账不得删行或把历史改写成“从未存在”。关闭裁决原文进入 `doc/decisions/` 并遵守一事一文与 supersede 链;HANDOFF 行只追加 `closedBy: <decision 文件>`。未来验收证据由该 decision 引用。架构真相仍属于 manifest、ADR 与 project-memory,HANDOFF 只保存已知演进债及其可判定触发点。

---

## 附:v2s 开工前置清单(供 Codex)

1. 新服务形态 ADR 已由 Dexter 接受为 `active / W0_FROZEN_INPUT`;本文经 Codex 独立审查后仍须由 Dexter 明确接受才可冻结;
2. ~~枚举统一裁决~~ **已裁决 `EXTERNAL_SYNC`**,契约带入时执行改写;
3. 门体系先于业务代码建立(D.1 布局门、D.2 契约门、D.3 红夹具纪律),**门未绿不写第一行业务代码**;
4. `scripts/verify` 单入口与准备物脚本化工具族随仓初始化(H.1);
5. Walking skeleton 作为第一个交付物(H.1.3);
6. `HANDOFF.md` 随仓建立(H.3);
7. AI-first 底座随仓就位(D.7:AGENTS.md 右尺寸化重写、CLAUDE.md、skills、project-memory 重播种;**无任何 provider**,按退役裁决)——**Dexter 在 v2s 内开首个会话之前完成**;
8. 未来 v2s 建仓入口另行确认后才把 v2 标记为冻结只读,并记录 Part C 的 file:line 冻结时点;本文冻结本身不执行该动作。
