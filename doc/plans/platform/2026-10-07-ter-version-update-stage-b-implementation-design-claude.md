# TER 版本定义、完整更新与热更新：阶段 B 详设

### 2026-10-09 · 本轮实施授权与动态执行面（优先于下文旧的计划状态）

Dexter 已授权：先关闭阶段 A 的 `D-S-1` readback 差量并通过受影响 focused proof，随后连续实施本阶段 B。该授权不重开设计 cycle，不授权阶段 C。

本轮终端动态验证仅在**一台单机双屏真机**运行，console 与 wallpaper 两个 App 均按本详设适用场景验证；不运行 Expo Web、mobile、双机、双 VM 或完整设备矩阵。此为 Dexter 对本轮 TER 执行面的明确调整，仅覆盖本次阶段 B，不改变 `TR-16` 的一般规则或其他批次要求。Web 证据记为 `NOT_RUN`，不声明 Web/device parity；范围不适用的双机/其它设备项记为 `NOT_COVERED_BY_THIS_ASSIGNMENT`，不得写作 PASS。

运维和运营后台仍须通过真实页面证明本链的上传、规则配置、版本查询及报告历史。只运行这些页面所需的受管浏览器 focused 场景，不运行无关的全量 Browser L2 suite。后台页面结果、TER 真机结果分别记录，只有同一阶段 B run 可关联的实际工件/规则/绑定/任务/报告身份才组成端到端闭环。

本轮直接相关生成检查、编译、类型检查、构建、focused tests 与必要行为门按 CP 执行；不运行默认全仓 `scripts/verify` 或未受影响的全量回归。受管 DEV、单设备真机验收和必要的阶段 B reset/seed 仍须遵守动态前准入、当前字节完整 seed dry-run、run manifest 身份和业务/cleanup 分列。

### 2026-10-07 Dexter 最新裁决（覆盖旧报告方案）

1. 报告存 CBS PostgreSQL，由 `terminal-update` owner 写入；运营右 Tab 可按门店和当前实际版本查询。Dexter 最终更正“仅包含启用”：范围为当前项目 **启用门店下的启用终端**，停用/作废均排除；未报告终端仍有列表行。显示门店名、终端名、实际版本、最新升级报告状态，点击终端打开标准详情 Drawer，显示最新报告及历史报告。
2. 上传成功且解析校验成功后才可保存；按钮名称统一“保存”，之前禁用。HOT 还必须选定与声明五事实完全匹配的最小 FULL。换文件、解析失败、stage 过期或上下文改变立即撤销旧保存资格。
3. 升级报告经 CBS HTTP 上报；失败正文缓存到升级 owner 的持久化 state。TDC 对有效匹配 PONG 发公开本机广播 command，业务 actor 消费后重试自己的未发送内容。TDC 不保存其他 owner 的失败正文，广播不证明 CBS HTTP 成功，不通过报告失败重连 TDS。
4. N/M 界面单位为分钟；InputNumber 正整数分钟 1～1440 为本设计的有限参数，canonical/API/持久字段仍明确为秒，提交乘 60、读取除 60，服务端检查 60～86400 且为 60 的倍数；正常 DEV 用 N=5/M=10 分钟，边界值只进 acceptance fixture。
5. 运维保留 APK、JS、runtime、构建号、applicationId、publicationId、摘要等真实技术字段；不得暴露凭证、下载 grant 或原始异常。
6. 规则详情增加“操作历史”，复用标准审计能力，不新建审计流水/弹窗容器/operation。

后续直接确认：“每个更新任务一条报告”。阶段变化更新同一任务记录，历次任务保留；每次 HTTP 重送与心跳不新增历史行。此前“包含启用和停用”的答复已被“仅包含启用”覆盖，不作为当前输入。

正式需求 R-15 中旧双后台、最后值而无任务历史、TDS 上报路径由上述直接裁决覆盖。原文记录设计修订时状态；2026-10-09 Dexter 已授权阶段 B 实施，并在本轮指定单机双屏真机及 focused 管理页面执行面。正式需求与终端标准同步属于 CP-01。

## 0 · 元数据与授权边界

```text
STATUS=IMPLEMENTATION_AUTHORIZED@2026-10-09
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=ter-version-update-stage-b-project-tabs-20261007
BUSINESS_SOURCE=doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md
IA_REF=doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md
INTERACTION_REF=doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md
IMPLEMENTATION_AUTHORITY=true
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-10-07_SCOPE_APPROXIMATE_IA_DYNAMIC_NOT_RUN
```

原文授权状态是设计起草时记录。2026-10-09 Dexter 已授权在本详设范围内实施阶段 B、执行必要生成/编译/测试/相关门及受管 DEV/后台 focused browser/单机双屏真机验收；不包括阶段 C、UAT 或生产部署。本轮设备动态验证只在一台单机双屏真机执行，console 与 wallpaper 两个 App；Expo Web、mobile、双机、双 VM 及全设备矩阵均为 NOT_RUN/NOT_COVERED，不写 PASS。此为 Dexter 对本轮执行面的明确调整，不推广为 TR-16 的全仓豁免。后台页面仅执行真实工件、规则及报告链所需的 focused browser 场景，不跑无关全量 Browser L2。历史 PASS 不继承，当前 business 与 cleanup 分列。

### 2026-10-09 · 当前 A 接缝与复杂度收敛

Dexter 本次要求静态审查 A，并同步 B 的影响、避免为极端情况过度设计。此次只修改 B 文档，不宣布 A 已验收，也不授权 B 实施。B 保留普通有效 FULL/HOT 的清单、摘要、路径、大小、APK 签名和真实版本校验；使用 JDK `java.util.zip.ZipFile`，不新增 Commons Compress、Unix symlink 专用解析、归档测试 seam 或恶意归档专项测试。专门构造的 symlink、截断中央目录和压缩炸弹判据留为 NOT_COVERED/NOT_RUN；正式 V-04 未改，也未被本次静态复核证明全部满足。这一取舍仅限本阶段设计，不作为其它上传域的安全豁免。

HTTP 响应丢失、断线/重启、普通拒绝、绑定变化、合法并发下载和分页期间成员改变仍是本批常见路径；保留对应的 owner 持久 pending、single-flight、匹配 receipt、拒绝退队/身份暂停及共享事务锁。它们不增加通用恢复中心，不因“避免极端设计”而删除必要业务事实。A 未受 B 改动的已完成对账不重做，实际接口变化只做受影响差量。

### 0.1 · A 交接前置：当前事实和期望分开

当前静态锚点与 SHA 在附件 §2。实施 CP-01 重开最终字节，不要求重做未受 B 修改影响、已经独立 MATCHED 的 A 对账；但实际被 B 改动的接口/消费者须做差量回归。B 的 CP-01 不授权顺手修复 A；本轮 A 源码 finding 由其实施主 agent 单独核验处置，不能用 B 接缝表替代该评审或 A 验收 verdict。

| 消费事实 | 当前静态事实 | B 实施前条件 |
| --- | --- | --- |
| 两 App 三产物/最终格式 | 原裸APK截面已过期；当前builder已有FULL ZIP与full-package.json，preparer解包接原安装链；A最新差量交接见2026-10-09 source-static-delta-rereview，未把源代码修订或局部proof称整批已验收 | 有效 FULL ZIP 的打包→来源外壳摘要→解出同字节 APK→既有安装链仍 OPEN_A_HANDOFF。B 只交付完整 ZIP，不增加裸 APK fallback；此为普通工件闭包，不是极端归档防护 |
| 发布与外壳身份 | builder 的 publicationId 是文件树摘要；不是 ZIP SHA | A 提供已验收文件清单、APK metadata/资源映射和最终 ZIP；B 的 artifactRef/外壳 SHA 与 publicationId 分开 |
| 最小 FULL/签名/版本 | minimumFull 已有 immutable 五字段；签名核验源码存在 | A 真实产物及企业签名、API≥29/资源/安装证明；B 复验其内容，不另造清单 |
| 实际运行 HOT 版本 | 2026-10-09：readFacts 已从原生 record 的 selectedBundleVersion/selectedPublicationId 取 actual，embedded 另列；bridge 仍传 applicationContext，不能仅据字段名断言已按发起 ReactContext 的 boot reservation 读取 | B 只消费实际 boot 的完整 readback，不拼 target；native/embedded publication 与当前 HOT publication 分开。CP-01核对这条接缝及普通冷启动后的就绪；本轮只核源码，不宣称运行证明 |
| 唯一本机执行核 | accept command 只收 selectionContext，provider 读 target，接受后立即执行；持久化 retain/sync isolated | B 另在同 owner 增纯快照接收 command，不把保存规则接到 accept-target；当前任务 API 最终形状由 A 交接 |
| 受保护下载 | UpdatePort/source provider 尚无下载授权输入 | B 本批新增 transient source grant 接缝；不假称 A 已支持 CBS 私有对象 |
| 最近状态原因与任务关联 | recentStatus 当前仅 taskId/state/reason/changedAt；新 boot 释放终态 currentTask，显式 ruleRef/FULL/HOT 身份随 target 不再可读；reason 仍有开放动态码 | B 在同 owner 已有 recentStatus 中保存报告必需的最近任务关联，且在 task 释放前形成待报告事实；不解析 taskId、不造第二任务账本。有限码归一及拒绝/部分成功/回退仍只消费可读事实；无事实不能编造 |
| 固定目标与后续更新 | FixedUpdateTarget.strategy 当前仅 maxNetworkAttempts/bootTimeoutMs，未包含 N/M/HOT 策略；同 APK 已运行 HOT、FULL unknown→成功续 HOT、已成功 HOT 冷启动→下一 HOT 存在本轮源码问题 | CP-01以本轮 A 静态报告及最终源码确认三个普通执行问题闭合。B snapshot 完整保存 N/M/HOT 策略供 C；本批不补 N/M 调度，不把 A 的技术 strategy 当完整运营规则；C 固定提交前必须携带规则策略，不从新快照改写已有 task |
| TDP 与 automation | 当前真实 topic/HTTP/selector/driver 源码可读；历史 GO 非本轮证明 | CP-01 确认当前接口、受影响测试；TER 动态只使用最新 automation-agent，不接退役 runner |

### 2026-10-07 Dexter 后台职责裁定（本批优先输入）

Dexter：“PLATFORM-REPORT这个业务……做成和RULE-LIST是一个页面，但是两个不同的tab，左边……这个项目中所有的更新规则，右边……这个项目中所有门店终端的更新状态”；随后确认：“运维管理后台，只定义终端的更新版本，运营后台才是规则与更新情况报告”。

platform-admin 只负责更新包/版本定义；operations-admin“项目终端版本管理”同页左“更新规则”、右“终端更新状态”。右 Tab 查询当前项目启用门店下的启用终端，包含尚无报告者；标准详情 Drawer 显示最新报告及按任务保存的历史。规则操作历史使用现有标准审计 Modal；仍只有两个内容页/两个路由，无手工任务重试或任务看板。

当前产品输入以“Dexter 最新裁决”节为准；旧 R-15 文字只作来源对照，不能恢复旧后台或旧报告通道。正式来源同步安排在未来实施授权内，当前仅设计、NOT_RUN。

### 内部 DESIGN 历史与 Dexter 追加两轮授权

同一 cycle `ter-version-update-stage-b-project-tabs-20261007`：R1 原始 NO-GO 3M/4S/0N；R2 原始 NO-GO 2M/2S/0N，原报告和旧字节结论保留。主 agent 亲自核验后作最小文档修订，其处置不是独立 GO；SELF_DECIDED 不表示作者可以替 reviewer 出具 verdict。

Dexter先追加原话“授权你再多两轮对抗性review，然后再给另一个Claude做review”，继而条件授权“如果第四轮还是NO GO，并且也是你确认的真问题，可以再增加两轮”。R4独立NO-GO 0/1/0且主agent已确认，故同cycle完成R3/R4和R5；R6尝试因agent thread limit reached未能创建，NOT_EXECUTED_TOOL_LIMIT/NOT_ISSUED。原始工具状态见doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r6-tool-status-claude.md；不以措辞/文件名重置轮次，不重开cycle，交外部Claude。

`ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION`；`REVIEW_ROUND_LIMIT=6`（仅本cycle的两次显式授权例外；旧报告保留当时limit）。当前大致IA已确认，不重复申请。计数仍是normal设计假设，实际解析/SQL/UI/资源/运行仍OPEN或NOT_RUN；本次不新增实施授权。

### 0.2 · 2026-10-09 reset 授权与完整链路补充

Dexter 本轮明确授权：**阶段 B 实施 agent 可按需要执行受管非生产数据库 reset，无需再次向 Dexter 索取 reset 授权**。此授权在阶段 B 已获实施/动态执行授权后适用；本轮仍只修改设计文档，不立即运行。正常验证所需的受管 reset → DEV start → 完整 r5-full seed 是本计划明确的前置链，实施授权须包含其实际执行面，不再把 reset 单列为待 Dexter 重复批准的事项。

授权不取消机械准入：仅当前 manifest 身份匹配的本批非生产环境，全部 CP/整批 6b、适用 UI/L2 脚本准入及当前完整 seed dry-run 均关闭后才 reset；由受管入口完成 owned stop、Doris/PG 清理及 readback，不手写 SQL、不按端口停未知进程，不涉及生产/UAT。reset 失败不得继续 start/seed，start 不隐式 seed；长运行中不 reset，不把 reset 当作 fixture 回收的替代。

本轮完整链新增验收目标为 §15.2a：真实自产版本包 → 运维 UI 上传并保存 → 运营 UI 新建并启用规则 → TER 消费该规则、经 CBS 下载并由 A 执行核实际更新 → CBS HTTP 接收该任务报告 → 运营 UI 查询与历史读回。原隔离浏览器 L2 继续覆盖后台交互与拒绝分支；另以同一受管 DEV 数据平面完成真实跨后台/TER链，**该 DEV 链不冒称隔离浏览器 L2**。B 不新增 C 的自动择新、闲时调度或副机执行：只有批准验收通过 automation agent 显式调用既有 A owner command 固定一条真实规则；产品收到快照仍不自动执行。

## 1 · 真实业务目标与方案比较

没有 B，真实 A 工件无法由管理员供给，终端既不能保存项目规则，也不能让后台辨认实际版本与最近状态。B 先闭合“供给与观察”，C 再装配自动执行，减少对 A 原生核的并行改动。

| 方案 | 结果 | 判断 |
| --- | --- | --- |
| 上传后直接向在线终端发安装 command | 规则/范围/完整快照失去事实住址，提前做 C | 拒绝 |
| 新 OTA 服务、资产平台、每阶段报告流水和消息队列 | 多 owner/副本/部署，超出目标 | 拒绝；每任务报告历史是本次明确需求 |
| CBS terminal-update owner＋复用 asset/TDP；同 TER owner 存快照并报告实际值 | PostgreSQL 权威、边界可验证；B 无自动 port 触发 | 采用 |

我选择第三种，因为它保持已批准 A/B/C 依赖顺序，只增加本期缺少的事实和通路。下载授权采用短期 opaque grant，而非把终端凭证写入更新任务或发给副机；grant 只授权具体不可变工件，不是第二终端身份系统。

## 2 · CP 总览

| CP | 输出/owner | 前置 |
| --- | --- | --- |
| CP-01 | A 最终交接、canonical/operation/error/IAM/protocol 输入、依赖/资源预算 | A 相关验收接口关闭；本设计接受＋实施授权 |
| CP-02 | CBS asset ZIP/私有对象、工件保存/解析/签名、审计与候选 | CP-01 MATCHED |
| CP-03 | 项目规则、完整 snapshot、topic/SQL 权限、下载 grant | CP-02 MATCHED |
| CP-04 | TER 快照、CBS HTTP 报告/下载授权、持久 pending 和 TDC 有效 PONG 广播 | CP-03 MATCHED |
| CP-05 | 两后台 UI/目录/TestIds；共享验收场景源码与 runner 接线 | CP-04 MATCHED；UI/testId 先于 L2 脚本 |
| CP-06 | 全部代码/生成/seed 静态/focused 收尾、当前入口和差量修正 | CP-05 MATCHED |

CP-06 退出只依赖本 CP 完成/focused proof/完整 CP 对账，不依赖后面的整批 6b、整体验收、13c 或最终 review。全部 CP MATCHED 后单独做 6b→动态准入→整体验收→13c→fresh IMPLEMENTATION→Dexter/Claude；没有回流循环。

## 3 · 横切机制对照表

| 机制 | 现成能力/规范 | 可执行观察与要求（计划） | 无现成时必须同形/限制 | 本批全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | OperationsWorkspaceReadAuthorization/WorkspaceCapabilityScopeResolver；corpus G-05A | PROJECT A 可读角色读 B 规则/报告拒绝；合法包候选无写 cap 可读 | workspace-read实际PROJECT任务join，不由pagecap推写cap | 运营规则 page/detail/report；候选单列关联任务 |
| 写授权与 grant 复核 | generated operation→ownerScopeGrant；owner 首读复核 | 撤 grant 后 create/status 零写、零审计；平台 session 无新 cap | 平台现有session与enabled管理员；运营owner当前scope grant | 两运营 mutation、平台 stage/register/release |
| 跨 owner 写与事务 | app application operation REQUIRED、asset claim command | register 失败 asset claim/owner回执/审计共同回滚；网络 I/O 在事务外 | asset公开claim与新owner同REQUIRED，I/O不入事务 | 包保存；规则 scope read；报告绑定复核 |
| 集合形态与分页 | SQL cursor/useCursorStack/CursorPagination | 造 101 条读到两页；snapshot 变化拒绝拼接 | 按明确UUID cursor协议，门店候选PagePaged，两者不混 | 包/规则/工件候选/报告/固定refs及完整终端snapshot；organization门店候选复用PagePaged |
| 缓存失效/改后刷新 | generated RTK tags/current context identity | 启停只刷当前项目 list/detail；包保存刷本空间包/候选；其他空间无请求 | 生成RTK tag与当前context identity；无新全局事件 | 两 app 全部 query |
| RTK currentData/isFetching | 前端规范 §3-B | 换 scope 时旧 data 不渲染；加载不显示空 | 所有动态query读currentData，加载读isFetching | 所有后台 read screen |
| 同事实单住址 | §3-E；TER 业务 owner 可持久业务镜像 | 后台不用本地 Redux 复制服务器实体；TER仅 update owner 存规则 | 后台不镜像；TER业务snapshot是唯一owner持久slice | 包/规则/报告、TER快照 |
| 失败可见 | §3-D；后端 typed problem | 存盘失败不接受 topic；上传失败不成为候选；未知字段有原因 | 拒绝保留typed原因，flush失败不派accept | 全通路 |
| owner错误→HTTP及注册 | R5 edge catalog errorSetRef＋error augmentations/disposition | 实际 generated error集合与 §5/附件逐 operation 对齐 | operation errorSet与augmentation统一目录生成 | 全部新增 operation |
| 新 owner审计三件套 | audit-model AuditEventWriter、audit-read task join | 规则 create/status 经现有 audit-history 读回；包平台审计经既有平台读取扩展 | 仅本owner audit_event/adapter；读走现有audit taskjoin | terminal-update.audit_event；TERMINAL_UPDATE_RULE/ARTIFACT enum |
| 幂等键/重放 | createContentIdempotencyKey；owner receipt | 同内容重试一条事实；授权复核先于receipt；不同payload同key冲突 | 先当前授权，再receipt互斥/完成重放；仅首次claim | stage/register/create/status |
| 生成物不手搓 | canonical→materialize→edge-codegen；protocol generator | TS/Java消费生成topic/frame/API；漂移红例 | canonical/materialize/codegen/terminal policy/protocol同链 | 三面 edge、IAM/catalog、TDS/TDC |
| 日志脱敏 | observability standard；现有结构化log | 只记录artifactRef/ruleRef/阶段/归一reasonCode/耗时；grant、URL query、凭证/raw包禁输出 | 现有SafeLogger及native结构化logger，无rawsecret | CBS/TDS/TDC/update/native/runner |
| 迁移/回填 | 唯一Flyway | 空表新增；已有终端返回尚无报告，不伪造版本；已有project初始化空topic | 空表/0topic/nullreport；无seed兼容迁移 | terminal-update schema、asset ZIP usage/private bucket |

工件stage以平台actor和当前workspace共同拥有：CBS在现有`artifact_stage`行保存创建者`actor_type/actor_id`，register与release在操作其私有asset之前复核当前actor及workspace。stage调用传给asset owner的幂等键由workspace、actor和客户端幂等键摘要派生，同一actor重放稳定，不同actor不会旋转同一暂存asset的bind grant。缺失或异workspace stage仍用404隐藏资源；同workspace的不同actor用`TERMINAL_UPDATE_STAGE_NOT_OWNED/403`拒绝。创建者字段与原stage写入同一SQL行，不增加查询或事务；stage审计仍记录相同actor。
| 前端共享行为 | admin-ui-foundation exports（IA/UI逐交互面列） | Drawer dirty唯一；失败留表单；context换即失效 | 直接消费foundation实际导出，不包第二lifecycle | 所有后台新增/扩展面 |
| 管理后台交互一致性 | `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10 | 逐交互面位置/颜色/焦点/文案/TestIds；报告详情沿标准Drawer | 附件§10标准容器逐交互面；无自建容器 | UI工件全部screen |
| 候选/下拉源 | generated server候选，无全量下拉 | 搜索/翻页限定当前空间与实际兼容；切包清失效策略输入 | 真实生成分页候选；fixedrefs专用taskread | FULL候选、规则包候选、门店候选 |
| 编码/名称呈现 | corpus/§3-K、backend§1-K；不新增name | owner仅返回结构化事实；前端feature将application＋类型＋版本呈现为首列标题；ref不作标题 | 业务标题可点标准详情Drawer，ref非首列标题；全部候选label也由前端产生 | 包/规则/报告 |
| 原子组 | contract→生成→consumer→test/seed/runner | 原子组不能只改生成输出或遗漏一个app | 同事实的canonical/生成/消费者/test/seed同时改 | 附件 §4保存的整链 |

### 3.1 · 第三方与预算

附件 §3 区分声明/源码核实/实际解析。当前没有解析或运行证明。ZIP 使用 Java 21 标准库 `java.util.zip.ZipFile` 的 entries/getInputStream 与 try-with-resources，不新增 ZIP 依赖；不据此声称识别 Unix symlink。APK复用成熟 Android Build Tools 36.0.0 `apksigner verify --verbose --print-certs` 与 `aapt2 dump badging`，不手写 AndroidManifest二进制解析。仅注册了 argv 的有限 subprocess，不执行上传文件/脚本；stderr 原文不落日志。实际 JDK/工具版本、官方对应源码与部署镜像在 CP-01 核实后才能进入 CP-02；不满足则 OPEN，不凭新版本 API猜测。

起始技术预算（候审、不是测量 PASS）：ZIP 256 MiB、解包512 MiB、8192条、manifest256 KiB；临时盘每动作含 APK二次读取≤1 GiB，至少2 GiB可用余量；单解析120秒、工具单次30秒、2个解析槽且无无限等待（满返回503）。按实际流统计外层 ZIP 声明 payload 的落盘字节/文件数，不只信 ZIP size；APK 验签与 metadata/res 名称核对复用既有工具和有界指定条目读取。工具期限、输出与运行资源沿现有预算，不为双层累计数新增 APK 内部全量解包/扫描器或另一测试 seam。HTTP page最大100，单页≤1 MiB、TER完整候选暂存≤8 MiB；超限明确SNAPSHOT_TOO_LARGE并保持旧快照，不能截断/只保存主机App。预算不限制管理员业务条数；扩大技术预算需资源证明而非删除业务校验。网络下载沿 A 有限attempt/deadline，不新增重试框架。WebSocket单信封≤65,536字节。首次动态前按现有resource profile证明本/远端所有权、RSS、临时盘；不把这些假定数值当容量证明。

## 3a · UI/testId 与 L2 准入

**2026-10-09 Dexter 本轮执行面调整：**本批管理后台只通过 §15.2a 的真实供给链 focused 场景执行页面动作：真实上传并保存 FULL/HOT、运营端创建并启用规则、真机产生报告后在运营端查询最新值与任务历史。本轮不另建或运行独立 Browser L2 的12-case控制面/suite；该 broader UI matrix 保持 `NOT_RUN_BY_DEXTER_EXECUTION_SCOPE`，不得标为本批 PASS。此调整只缩小本轮 UI 验收范围，不改变页面功能、权限、数据契约或控制器职责；TER React 操作仍使用唯一 automation-agent driver，后台页面动作由同一受管供给链 run-owned Playwright 完成。

控制分母是 UI 工件逐交互面 roster（每个实际file input、按钮、输入、候选、分页、Tab、Modal都有TestId），不是商品/包数配额。范围：PKG-LIST/UPLOAD/DETAIL、RULE-LIST/CREATE/DETAIL/STATUS、PROJECT-REPORT、PROJECT-REPORT-DETAIL。DOM/API授权行为各用最低证伪层。

L2脚本开发前：UI源码与强类型TestIds完成→组件/focused门→fresh独立UI/testId复核 PASS；之后才写blueprint/bindings/actions/Playwright逻辑。完整控制文件设计为 `contracts/policy/terminal-update-l2-{case-blueprint,fixture,timing-budget,scenarios,locator-bindings,admission,execution,activation-candidate}.json`，生成器 `scripts/generate/terminal-update-l2-p1.mjs`；实施须对照现有store-terminal链逐个校正实际规范名称，不留重复目录或无消费者文件。

扩唯一 `scripts/test/browser-l2-runtime.mjs` 的 `terminal-update` suite，分别消费两后台 `src/tests/l2/terminal-update.spec.ts`；不新建admin runner。TER用唯一 `scripts/test/terminal-automation.mjs`/`tools/terminal-automation`，两类工具面不能混用。`UI_DESIGN_REVIEW=OPEN`、`TESTID_REVIEW=OPEN`、`L2_SCRIPT_ADMISSION=BLOCKED`，独立准入未 PASS 不得启动 L2。

### 3a.1 后台L2逐case输入（不是业务数量配额）

case名称只在doc/policy元数据；两个spec文件仍能力命名。fixture JSON逐case引用以下key，setup必须在本run隔离DB/assetnamespace内经owner HTTP命令，不能用DEV seed或直接SQL。唯一TestId常量附件§9.1，UI roster/附件§12直接引用；actions不是尚不存在的运行证明。

| caseId | fixtureRef | actions与最终可判定业务事实 |
| --- | --- | --- |
| update-packages-list-detail | FIXTURE-UPDATE-PACKAGES | P登录/选W1→kind/app/runtime查询→重置→标题详情→关闭/刷新；实际结构化版本/摘要，W2不得带入 |
| update-package-create-full | FIXTURE-UPDATE-PACKAGES | 真实FULL ZIP fileinput→解析事实→提交→标题详情核对；清理仅本stage/assetnamespace |
| update-package-create-hot | FIXTURE-UPDATE-PACKAGES | 真实HOT ZIP→防抖五事实FULL候选→加载更多/选择→提交→核对固定配对 |
| update-package-reject-and-exit | FIXTURE-UPDATE-PACKAGES | 坏ZIP拒绝→换合法file→解析/保存请求在途时关闭、换文件、移除均不生效→完成后dirty关闭取消/放弃→回读ownedstage释放；首败停止，不用raw异常当UI文案 |
| update-rules-list-detail | FIXTURE-UPDATE-RULES | O选PROJECT A→三个filters/query/reset→标题详情/fixedrefs pager→刷新；createdAt/status/目标事实 |
| update-rule-create-full | FIXTURE-UPDATE-RULES | 选择FULL→ALL→正常N→初始停用→保存→详情；无HOT/M字段 |
| update-rule-create-pair | FIXTURE-UPDATE-RULES | HOT防抖选择→只读FULL→STORE_REFS两页选→N/IDLE/M→保存→固定refs读回；模式/范围切换清失效值 |
| update-rule-enable-disable | FIXTURE-UPDATE-RULES | 详情操作→带对象名确认启用/取消/启用→读回→停用→读回；只改变供给，createdAt不变 |
| update-project-readonly | FIXTURE-UPDATE-READONLY | 通过真实邀请接受链登入只读角色→两Tab及三详情/关联候选可读→无新建/启停；服务端写拒绝另HTTP验 |
| update-project-scope-and-tabs | FIXTURE-UPDATE-PROJECT-SCOPES | 左/右Tab→各自筛选→PROJECT A/B切换→旧Drawer/旧回包失效；dirty阻断按lifecycle |
| update-report-no-report | FIXTURE-UPDATE-REPORT-NONE | 右Tab门店防抖/加载更多→query/reset→未上报终端仍在→标题详情/关闭；NO_REPORT且oldBinding=false不当空集合 |
| update-report-current-detail | FIXTURE-UPDATE-REPORT-CURRENT | 本 run 激活→HTTP report commit→按门店/实际 APK/JS/runtime 查询→终端 Drawer 最新＋两个任务历史→同 task 更新不增行；ACTIVE本代报告oldBinding=false，结束绑定后同一报告oldBinding=true；停用门店/终端排除；标准历史分页/读回 |

FIXTURE-UPDATE-PACKAGES 为本 run 真实 A 四工件/坏 ZIP；RULES 为实际 PROJECT/门店及两页固定 refs；READONLY 为真实无写cap角色；REPORT-NONE 为启用未报告终端；REPORT-CURRENT 经真实激活＋CBS HTTP 提交两任务与同任务两个阶段，无直接 SQL/旧 DEV 报告。大量分页反例由 HTTP acceptance 覆盖，不为 L2 重建百个发行包。

### 3a.2 报告生产者与P1生命周期

报告生产者已按最新裁决确定：本 run 真实激活 HTTP→凭证三头仅内存→submitTerminalUpdateReport HTTP→commit receipt→运营 GET 最新及任务历史→UI。无需为报告增设 TDS/WS；fixture 与实际原生证明分开。P1 与生成链顺序、isolated run/owned cleanup 不变。

按scripts/README唯一顺序：readiness→同run P1 activation→generated-chain check→finalize→run。拟新增suite CLI/generator/checker均在CP-05源码接线后才可用；不是当前运行命令：

```bash
node scripts/test/browser-l2-runtime.mjs --suite terminal-update readiness
TERMINAL_UPDATE_L2_READINESS_MANIFEST=<same-run-readiness-manifest.json> node scripts/generate/terminal-update-l2-p1.mjs
node tools/terminal-update-l2-p1/cli.mjs
# 同专题完整生成链/check，禁止手工写fixture/bindings/active execution
node scripts/test/browser-l2-runtime.mjs --suite terminal-update finalize
node scripts/test/browser-l2-runtime.mjs --suite terminal-update run
```

新env名/cli依现有store-terminal同形接入而不是声称已存在；CP-05同步八policy、P1 generator与tools/terminal-update-l2-p1/cli.mjs、suite strategy以及各自test/README，failclosed校验same run与全部case join。任阶段失败先保留firstfailure，ownedcleanup未PASS不进下一阶段；不是在hold运行期间继续改源码。

## 4 · 每 CP 门控

写每个实际点前后都双读需求、六维命中记忆、IA/详设、owner/复用源码；focused完成后 fresh只读对子 CP全范围三维对账 MATCHED才下一 CP。单文件不拆独立关卡。A范围外不修，若改变A接口先列消费者、原因及最小回归，取得阶段授权内确认。已有未受影响 MATCHED不重复；B全批6b是新跨CP检查，不以A或CP汇总代替。

| CP | RECALL 原文/唯一source锚点（下述完整仓根路径） | 错误形状/不变量/FORBID | 比例验证与形态理由 |
| --- | --- | --- | --- |
| 01 | 正式需求R02/03/15；A详设§8；schema `minimumFull`；builder `publicationId`；edge-codegen `openApiSchemaName`；terminal-client-api `successResponseCount` | JSON与binary consumer分开；真实发布身份不靠文件名；禁手改generated/假metadata | canonical漂移/二进制误入/跨根红例＋类型检查；沿现有三生成链是最小接缝 |
| 02 | 正式R04；frontend标准§3-G；asset `stage`/`claim`/`release`；A附件发布树规则 | 原始bytes签名/pub可信；短TX无网络；typed拒绝零可用包；禁匿名asset/fallback | parser red及真实HTTP register/replay；复用asset生命周期而不再造存储 |
| 03 | R05/07/11/17；TDP正式topic规则；`OperationsWorkspaceReadAuthorization`/`WorkspaceCapabilityScopeResolver`；PG snapshot/topic | PROJECT读取与W-P分离；锁先查询；grant仅固定artifact；typed CAS/scope拒绝；禁通用队列/人为递增time | 真实HTTP/PG并发/101分页/撤权；PG权威＋原有NOTIFY最小 |
| 04 | R11/15＋最新裁决；TR09及本轮设备执行面；store-basic 当前boot加载；TDC HTTP/PONG与 Runtime 全 handler 分发 | 两 flush；credential唯一owner；HTTP receipt/持久pending/真实single-flight/迟到隔离；禁报告失败 invalid/reconnect | 本CP退出以owner/TDC/store-basic纯逻辑focused及受控typed fixture为准；本轮适用终端场景只在单机双屏真机运行，Expo Web不执行、不声明跨面一致性 |
| 05 | 已确认IA§2；UI§4及附件§12/13；frontend标准§3-K；foundation `useDrawerFormLifecycle/useDetailDrawer`；automation skill/API；browser L2入口suite dispatch | 两页面；PROJECT只读报告；dirty唯一owner；typed拒绝留surface；禁自造容器/旧runner | component/TestId先L2脚本；共享真实Journey/fixture减少两端差异 |
| 06 | task模板6/6b/6c/13c；seedfixture `stableFixtures`/`expectedCounts`；父executor `seedStages` | 4工件/8规则与父计数一致，首败传播；未授权不运行；禁坏包seed/fake actual/无条件reset | 完整dry-run结构focused及生成/compile/verify按授权；扩现有父链而非临时seed脚本 |

上述source完整路径：`contracts/terminal/terminal-update-artifact.schema.json`；`scripts/build/terminal-update-artifact.mjs`；`scripts/generate/{edge-codegen,terminal-client-api}.mjs`；`apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java`；operations scope源按附件§2/4；`apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts`；`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`；`apps/terminal/kernel/base/platform-ports/src/types/update.ts`；`.agents/skills/cs-terminal-automation/SKILL.md`；`scripts/test/browser-l2-runtime.mjs`；`scripts/dev/r5-complete-seed-executor.mjs`。拟新增源锚点在附件§11/14冻结方法名，实施写前确认唯一匹配；本表是RECALL不是新合规控制面。

## 5 · HTTP operation / path / face / 集合

以下为待生成的精确设计名。终端path写generated后缀，groupWorkspaceKey只在server-config前缀。后台沿现有group-workspaces/{groupWorkspaceKey}路径；operations 将 expectedContextVersion 放在 query，业务请求字段留在 body；括号内路径ref不是授权来源。

| operationId | face/HTTP后缀 | 形态/错误增补 | 预期规模与增长驱动 |
| --- | --- | --- | --- |
| stagePlatformTerminalUpdateArtifact | platform POST /api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifact-stages | multipart二进制；ARTIFACT_INVALID/DEPENDENCY_UNAVAILABLE/BUSY | 单次1ZIP；G1（附件§18） |
| registerPlatformTerminalUpdateArtifact | platform POST /api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifacts | 单对象；PUBLICATION_CONFLICT/MINIMUM_FULL_INVALID/STAGE_EXPIRED | 单次1工件；G1（附件§18） |
| releasePlatformTerminalUpdateArtifactStage | platform POST /api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifact-stages/{stageRef}/release | 幂等资源释放；STAGE_NOT_OWNED | 单次1stage；G1（附件§18） |
| getPlatformTerminalUpdateArtifactPage | platform GET /api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifacts | cursor；通用platform读错误 | G1（附件§18） |
| getPlatformTerminalUpdateArtifactDetail | platform GET /api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifacts/{artifactRef} | 单对象；ARTIFACT_NOT_FOUND | 单工件；G1（附件§18） |
| getOperationsProjectTerminalVersionPage | operations GET /api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions | cursor；PROJECT真实读，无写cap；PROJECT_NOT_FOUND | G3（附件§18） |
| getOperationsProjectTerminalUpdateRulePage | operations GET /api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules | cursor；PROJECT_NOT_FOUND | G2（附件§18） |
| getOperationsProjectTerminalUpdateRuleDetail | operations GET /api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules/{ruleRef} | 单对象；RULE_NOT_FOUND | 单规则；G2（附件§18） |
| createOperationsProjectTerminalUpdateRule | operations POST同规则集合 | 单对象；RULE_TARGET_INVALID/SCOPE_MISMATCH | 单规则；G2（附件§18） |
| changeOperationsProjectTerminalUpdateRuleStatus | operations POST同规则/{ruleRef}/status | 单对象/CAS；STALE_STATE/RULE_TARGET_INVALID | 单规则；G2（附件§18） |
| getOperationsTerminalUpdateArtifactCandidatePage | operations GET /api/operations/group-workspaces/{groupWorkspaceKey}/terminal-update-artifact-candidates | cursor关联候选；非GET写cap | G5（附件§18） |
| terminalReadProjectUpdateRuleSnapshotPage | terminal GET /update-rules/projects/{projectRef} | cursor完整snapshot；SNAPSHOT_CHANGED/SNAPSHOT_TOO_LARGE | G6（附件§18） |
| issueTerminalUpdateArtifactDownloadGrant | terminal POST /update-artifacts/{artifactRef}/download-grant | 单对象；ARTIFACT_NOT_FOUND/ARTIFACT_NOT_AUTHORIZED | 单工件授权；G1/32临时grant（附件§18） |
| downloadTerminalUpdateArtifact | terminal GET /update-artifacts/{artifactRef}/content | 二进制；GRANT_EXPIRED/ARTIFACT_NOT_AUTHORIZED/DEPENDENCY_UNAVAILABLE | 单ZIP流；G1（附件§18） |
| getOperationsProjectTerminalUpdateRuleStorePage | operations GET /api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules/{ruleRef}/stores | cursor 固定refs任务读 | G4 |
| getOperationsProjectTerminalVersionDetail | operations GET /api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions/{terminalRef} | 单终端最新，PROJECT真实读 | G3 |
| submitTerminalUpdateReport | terminal POST /update-reports | JSON 报告/commit receipt；身份冲突409 | G7 |
| getOperationsProjectTerminalUpdateReportHistoryPage | operations GET /api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions/{terminalRef}/update-reports | cursor 每任务最新报告，PROJECT真实读 | G7 |

完整新增HTTP roster为18项：platform5、operations9、terminal4。另复用组织候选及通用审计GET，不重复新增。第15固定refs为G4，第16报告详情为单对象G3，第17/18报告写/历史为G7（正常规模/增长来源均见附件§18）。

运营报告详情新增第16条operation getOperationsProjectTerminalVersionDetail：operations GET `/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions/{terminalRef}`，query expectedContextVersion，复用项目分页同一TaskRead DTO/authorization；PROJECT当前scope＋terminal真实storeproject复核，含NO_REPORT单对象，无W-P前置、无新增事实owner。复用标准只读详情Drawer，不扩旧STORE Card。新建规则的门店候选复用现有 `getOperationsOrganizationCandidates`：subjectType=STORE、candidateUsage=DEFAULT、projectId=当前已确认项目、queryText/page/pageSize/selectedId，返回既有 OrganizationCandidatePage；形态是 PagePaged，pageSize≤100，分页选择器复用 useCursorCandidates 的页码模式。每次切项目清游标/页码/已选，当前页筛选结果不是已选集合的事实住址。

新增第15条 operation `getOperationsProjectTerminalUpdateRuleStorePage`：operations GET `/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules/{ruleRef}/stores`，query为 expectedContextVersion、cursor、limit（≤100）；返回 `{items:[{storeRef,name,code,status,unknownReason}],nextCursor}`。`unknownReason` 对已读回实体为 null；已持久引用缺失或已移出项目时为 `MISSING_OR_OUT_OF_PROJECT`，其名称和编码为空字符串。真实PROJECT规则归属/读范围复核后，以规则持久固定refs与organization显式任务join分页，按storeRef UUID16字节序升序；cursor绑定space/project/rule及不可变refs摘要。禁写cap前置、客户端抽干项目候选、以当前可选资格隐藏已有refs。已停用/作废门店仍按owner事实显示状态；无法读取的固定引用仍显示storeRef及原因，不伪造名称、不静默移除。ALL模式返回空items且scope在detail明示。RULE-DETAIL消费此operation，不能靠单selectedId实现全refs读回。

platform使用其实际基础errorSet；operations主读沿workspace-read，写沿generated capability，终端snapshot/grant沿 `TERMINAL_DATA_READ`＋当前三头 `Authorization/X-Terminal-Ref/X-Terminal-Device-Id`。content仅接受CBS颁发的短期grant并每次校验当前binding；它是明确的受保护资产 operation，不匿名publicAsset fallback。错误映射和HTTP状态按附件 §5，不生成同名孤立错误集。

## 6 · 跨 owner 写矩阵

| 调用者→owner | 权限/事务 | 失败闭包 |
| --- | --- | --- |
| edge→asset.stage/validate/read stream | stage/工具/对象I/O无callerTX；短元数据TX独立 | 有限超时；清理拥有的临时资源；stage尚非目标 |
| register edge→app RegisterHandler REQUIRED→asset.claim＋terminal-update.register | 同一 REQUIRED；平台身份/空间均重核 | 全回滚；stage可释放/重试；不长TX流式上传 |
| update owner→organization taskread/IAM授权 | REQUIRED内真实PROJECT/store与grant复核；无跨schema写 | 在receipt前拒绝；不建跨owner FK |
| rule owner→own topic snapshot＋pg_notify | 同一规则TX；提交后通知 | 任何失败全回滚；无outbox |
| TDS→update owner SQL current-topic | 独立 PG principal 仅 EXECUTE 规则 topic 函数 | 固定 search_path/REVOKE PUBLIC；真实 boundStore/project scope；无报告函数/报告写权限 |
| CBS report edge→app ReportHandler REQUIRED→terminal-update owner | 当前凭证三头与 CBS binding 最终复核 | 提交后 HTTP receipt；重复/乱序/旧binding拒绝；PG失败无成功回执、无第二失败存储 |
| update download edge→binding verify→asset protected read | 前置短TX鉴权定位，退出TX后stream | 读断开不保存成功；撤权拒绝后续请求；已开始stream非承诺即时中断 |

## 7 · 声明—传递—消费

| 事实/机制 | 声明 | 传递 | 最终消费/反例 |
| --- | --- | --- | --- |
| 应用/四版本/pub与zipHash | A canonical/签名metadata/实际字节 | register DTO/PG→rule target/generated | 不从文件名/目标拼actual；APK资源映射不等于AAPT后字节相同 |
| 空间/project/store范围 | 已验证上下文＋真实关系 | owner任务read＋snapshotidentity | 跨空间包、跨projectrefs拒绝；ALL动态全项目 |
| capability | catalog新PROJECT cap | generatedoperation→grant→owner | 读可无cap，写撤权零事实 |
| 内容不可编辑/createdAt | owner构造/DB不可变列 | readonlyDTO→UI | 启停不改时间、内容；无PATCH/delete |
| 完整snapshot/hash | PGscope锁＋collectionHash/token | pagecursor→TER候选→ownerflush | hash变化丢候选，不先存第一页 |
| topic原始time | 真实rule.updatedAt毫秒；成员hash | PGNOTIFY→TDS→TDC | 同值在线仍fetch；不造单调时钟；每readyHTTP核对 |
| TDC凭证唯一owner | TDC | terminal HTTP command→CBSgrant | update持久sourceRef；transient grant不持久不广播 |
| actual/recent | A同ownerselectors | 升级owner持久pending→TDC typed CBS HTTP POST→CBS ReportHandler/owner REQUIRED→PG→匹配commit receipt | main当前观察＋每任务UPSERT历史；CBS复核当前binding，TDS不接收/写入报告；回执仅清身份及序号匹配的pending |
| query身份/失败 | session/contextversion/snapshotepoch | generatedquery/currentData与TERcommand payload | 迟到旧空间结果不落state；topic数据存盘失败不接受topic通知 |

## 8 · 规则与实现判定点

### 8.1 · 工件保存

asset扩 `TERMINAL_UPDATE_ZIP`，私有对象与公开图片物理隔离：独立private bucket，禁止anonymouspolicy；公共 `PublicAssetController` 不解析此usage，列表不返回raw object key或publicUrl。仍由同asset owner/storage维护，不建第二资产平台。

stage外层总sha先流式算；JDK ZipFile 枚举条目，按既有普通归档路径校验拒绝重复规范路径、绝对/反斜杠/../NUL、目录冲突和未声明 payload，计实际读取字节和文件数；解析失败返回 typed 工件无效并释放自有临时资源。仅 canonical 结构解析，不执行包内代码。FULL/HOT以经过交接的apk/minimumFull内容闭合识别，kind条件校验不能只相信schema；不接受INSTALL单APK作为平台更新包。Unix 属性/symlink 专项识别、手写中央目录修复或压缩炸弹测试不在本批实现范围，不为其增加库、解析层或 seam。

FULL检查APK digest、真实applicationId/versionName/versionCode、signed metadata runtime/bundle/publication、签名有效及证书事实；APK entry SHA须匹配已声明发布入口。资源至少核对清单和res名/qualifier/映射；AAPT转换资源不做源字节相等断言，理由/准入沿A已验收发布契约。HOT重算完整文件树publicationId，校验entry/resources及同版本冲突。清单未提供/与实际不符拒绝，不替开发人员改清单。

保存 immutable `(workspace,artifactRef,kind,zipSha,byteSize,Amanifest,assetRef,minFullRef)`；HOT选择的已保存FULL五事实精确等于minimumFull，app/platform/runtime/内嵌与HOT版本闭包成立。FULL与HOT保存必须同空间；全局发布identity目录仅键 `(app,platform,runtime,bundleVersion)` 和 publicationId，保存同一内容跨空间保存合法；不跨空间披露另一空间存在，只返回内容冲突。顺序为当前身份/空间/权限复核→receipt键互斥/核验；已有完成receipt同payload直接返回原artifact，不再要求已消费stage；首次执行才核验stage/绑定grant/最小FULL、锁全局identity并调用asset claim，然后artifact/审计/receipt同TX。响应丢失重放不再次消费stage；同key异payload拒绝。ZIP claim不借用catalog ACTIVE特例。

平台候选具体合同与完整18项输入统一见附件§17：只有platform artifactPage，五事实在服务器分页query匹配，不能跨用operations candidatePage。

新旧typed错误到surface/draft/恢复的唯一全映射在IA§4.1；两app problemFeedback Record同步新code，terminal grant/snapshot/report为owner观察，不新增手工更新页。

### 8.2 · 项目规则

 owner数据：ruleRef/projectRef、scope `{ALL_PROJECT_STORES}|{STORE_REFS,refs}`、fullArtifactRef、hotArtifactRef可空、hotStrategy `IMMEDIATE|IDLE`或null、fullReminderIntervalSeconds N、idleSeconds M可空、说明（≤500字符，与canonical schema一致）、status ENABLED/DISABLED、createdAtEpochMillis、updatedAtEpochMillis、CAS revision（仅状态写保护，非TDP版本）。N/M持久/API值为60～86400秒的整数且必须为60的倍数，界面以1～1440整分钟输入及回显；FULL-only没有hotStrategy/M。maxNetworkAttempts/bootTimeout消费A已批准默认技术策略，不由运营管理员任意填。

N/M界面整数分钟1～1440，API秒60～86400且60倍数；上界一天是候审有限参数，非官方值。DEV N=5/M=10分钟。取消旧报告5秒ACK/3次/重连预算；HTTP使用既有transport期限，未来CP-01核实实际配置与timeout/迟到，业务失败等有效PONG重试。grant5分钟是请求发起窗口、32项是临时技术预算，仍按实际测量/红例调整，不限制业务包/规则/历史条数。

create/status事务顺序：真实授权→实际PROJECT/space/store验证→scope互斥锁（含首次无cache）→幂等receipt核验→固定包闭包→写rule→审计→重算启用ruleRef集合→更新topic并notify→receipt。状态无变化回放不假发业务通知；启用重核工件/关系。内容不可编辑，createdAt不变。ALL含以后新建门店；指定refs不可空且逐项同项目；禁止用途/机型、优先级/手工排序。

同project锁先于集合查询，唯一采用事务级PG advisory lock：直接复用foundation `AdvisoryLock.acquire(JdbcTemplate,int,UUID)`，namespaceTag在本owner具名声明，ref为已验证projectRef；不另写64位UUID哈希，现有原语的碰撞只增加串行，不改变scope校验；不锁跨owner project行、不并存第二机制。初次空cache初始化time=0；成员变化空→非空用成员原始updatedAt最大B，非空→空/非空非空用触发rule.updatedAt A；同hash时间保持。`collectionHash=SHA256(有序唯一rule UUID＋LF)`，只存hash/time不存refs。与TDP原始time规则一致，不使用严格递增伪时间。

### 8.3 · 完整快照与 topic

新topic `TERMINAL_UPDATE_RULES`、ownerRef=projectRef。TDS owner function以真实boundStore核验project，PG通知只唤醒，listener重建沿既有全部有效订阅核验。snapshot只返回启用规则，但包含项目所有app/platform，不提前按主机过滤。顺序为 `(createdAt DESC, ruleRef UUID规范小写hex DESC)`，UUID比对以16字节序为准，TER不能用localeCompare。

HTTP页复用 OpaqueCollectionCursor/CanonicalCursorIdentity 的query绑定、类型和frontier校验（现有Base64 JSON不是密码学签名，不新增签名机制），绑定scope、查询、同一个成员collectionHash和lasttuple。snapshot中的执行规则投影只含ruleRef、createdAt与不可变目标/scope/refs/N/M/说明；成员本身即说明当前启用，不重复输出可变CAS revision、updatedAt或状态变化历史。后台RuleDetail仍保留完整状态/CAS事实。因此同一成员集合对应相同执行正文，只复用已持久化collectionHash，不增加snapshotHash或第二正文hash。topic原始时间仍单列，不作为成员hash。每页短REPEATABLE READ读取当前hash与page；hash不符409 SNAPSHOT_CHANGED。末页再读核验成员hash并取得此时topicTime，不允许不同成员集合的前后页混合提交；TER在提交前校验当前contextEpoch。启停往返使hash恢复相同但topicTime变化时，执行正文仍相同，以末页权威topicTime作为接受时间；不能把后台可变revision塞入执行正文破坏此等价。反例须覆盖同一规则停用后再启用、成员hash相同而topicTime变化，以及真正成员变化的409。3次整快照重启后可见失败，旧完整快照保留，下一通知/ready再试，不轮询。

TER source actor位于现有 `kernel/base/terminal-update`，以内部 refresh command、TDC topic-changed command 与 `selectTerminalUpdateRuleSnapshot` 完成刷新和消费。`ruleSnapshot` 只持久保存完整成功的非秘密规则快照；`ruleSnapshotStatus` 的 status/error 不持久。应用 reset 时由该 owner 清除快照字段，保留 A retained task 的既有语义，sync isolated（C才改规则projection）；只有完整snapshot替换并flush成功，才可确认当前快照或接受具体通知。读取失败不清同一上下文的旧完整快照，也不把它标为当前可用；收到空完整快照必须替换旧非空。

资源桥在两ui/integration composition层读取store-basic公开的 `selectStoreBasicLoadReadiness` 与组织路径selector，并用 `selectActivationState` 复核当前激活身份；不直接读store-basic持久化。readiness携带本Runtime id和binding；STORE、PROJECT分别仅在真实HTTP成功、对应事实flush成功且binding仍匹配后变为`flushed`。`readStates.loaded` 早于flush，不能代替此事实。readiness仅为非持久启动事实；重启/hydration/root reset/binding变化后重新加载，旧绑定迟到结果不能置flushed。两个composition通过窄 `readRuleSnapshotContext` callback把已flushed的身份、projectRef与projectUpdatedAt传给terminal-update owner。terminal-update模块在装配、身份变化及TDC连接转为connected时启动refresh；订阅存在时沿用已接受时间，不存在时从0建立，然后经TDC读取完整分页。每ready都HTTP核对；在线同time通知也重新读。snapshot上下文失效时清当前规则snapshot；刷新中旧完整值不可作为当前规则接受。快照刷新不自动调用accept-target/prepare/apply；受管验收按§15.2a用正式command显式固定真实规则，不增加产品操作或C自动调度。


### 8.4 · 授权下载，不复制凭证

**快照到固定目标的生产接缝（CP-04）。** B 扩现有 `FixedUpdateTarget.selectionContext` 与 `acceptTerminalUpdateTargetCommand` 的同一 typed 输入为 `{selectedSpace, contextIdentity, ruleRef}`；不是新增 accept command 或测试专用 API。公开 `selectTerminalUpdateRuleSnapshot` 一并给出当前已完整刷新/flush 的非秘密selectedSpace/contextIdentity/project身份；contextIdentity由更新owner随绑定/项目周期生成并校验，不让调用者拼凭证、从taskId猜身份，旧周期立即失效。该selector可选接收一个`ruleRef`，验收driver按运营UI当前目标查询单条规则摘要；这只裁剪对外selector投影，owner仍持有并消费完整快照，避免一次序列化整个规则集。规则快照中的 FULL 摘要必须携带数据库权威 `apkSha256`，HOT 摘要该字段为 `null`；该值与 ZIP 摘要独立，供后台 HOT 候选五事实核对和终端固定目标读取。Android adapter 从已安装 `ApplicationInfo.sourceDir` 流式计算 base APK 摘要并随实际身份 readback 返回；当本机 native build 与固定 FULL 相同，APK 摘要也必须相同，否则拒绝该 HOT 目标且不得请求 grant/准备工件。native build 高于固定 FULL 时仍按现有更高 APK 兼容判据处理，不要求摘要相同。固定 FULL 的一次性 grant manifest 还必须匹配目标 `apkSha256`；HOT grant 的 `minimumFull` 五项（applicationId、nativeBuildNumber、runtimeVersion、publicationId、apkSha256）必须与同一固定目标的 FULL 完全一致，缺失或不一致时在 prepare 前拒绝。FULL 安装成功读回以及 installer busy 收敛都必须同时匹配已安装 applicationId、nativeBuildNumber、publicationId 与本次 action 持久保存的 `apkSha256`；摘要缺失或不一致不得报告成功。driver核对`applicationId`、工件与门店scope后，向既有accept command发送该selectionContext；accept handler仍须与本机实际applicationId复核，不因selector过滤而省略业务准入。

terminal-update actor直接消费当前持久化完整snapshot，逐项要求contextIdentity/selectedSpace当前有效、ruleRef存在且启用、同项目、当前门店在ALL或指定refs范围内、applicationId与本机实际身份一致、FULL/HOT固定配对成立，随后物化既有FixedUpdateTarget。缺项/旧上下文/不匹配返回拒绝，不选其他规则、不回落本地fixture、不自行选最新；既有未完成task的单任务准入不变。固定目标仅持久保存CBS ruleRef/artifactRef/sourceRef、ZIP摘要与版本/发布身份摘要，不保存完整manifest。FULL/HOT完整manifest由一次性CBS下载授权响应随grant返回；actor在prepare前核对manifest与固定摘要相符后交给既有UpdatePort。临时grant不进入task/state。accept-target 的单命令期限为300秒，覆盖已有 UpdatePort `prepareArtifact` 与 `applyPrepared` 各自最多120秒及状态持久化开销；Runtime request residence 为10,000,000毫秒，必须严格大于32层最大命令链期限。Driver 命令结果观察期限为360秒。保留A有限网络与boot技术策略；N/M执行策略仍属C，完整链选IMMEDIATE。目标持久化后沿A固定执行规则运行，后续规则停用不改写该task。继续执行时仅按固定artifactRef申请CBS grant，不重新选择目标；正常FULL/HOT重启不重新运行目标转换，不因新boot的selector订阅身份改写已固定任务。contextIdentity仅作新目标接受准入，不建立第二任务恢复状态。

CBS 的 `content` 是唯一 `StreamingResponseBody` 下载端点。生产配置 `spring.mvc.async.request-timeout=130s` 必须高于 Android UpdatePort 的 120s 单次下载 `callTimeout`；客户端 120s 仍是有效请求的实际 deadline，服务端仅避免默认异步请求超时先截断合法流。验收必须同时核对完整响应字节数与授权 ZIP SHA-256，并以 `TERMINAL_UPDATE_DOWNLOAD_STREAMED` 或 `...STREAM_FAILED` 作为服务端流完成事实；runner proxy 记录 `BODY_END`/`BODY_FAILED` 并在上游失败时关闭下游响应。此配置只解决单次受保护工件流的超时先后，不延长客户端等待，也不把响应头 200 当作下载成功。

同族 focused：旧context/rule不存在/停用/其他门店/其他App拒绝且不触发port；真实启用rule转换后固定目标字段等于snapshot摘要；grant返回的manifest与摘要不一致时prepare零调用；固定task之后停用仍取原工件；两套integration/Application都装配composition readiness reader。A 的 development/runId/`automation-${runId}` 本地目标provider只留在A focused/native核场景，**不得装配到B完整链**。既有fixture provider只供明确测试输入，不作为生产规则来源。

rule target持久化只保存opaque artifactRef/sourceRef与固定expectedZipSha/Amanifest；不得保存下载URL、grant、Authorization或临时路径。prepare时provider异步经TDC公开 `requestTerminalUpdateDownloadGrantCommand` 调用CBS terminaloperation；TDC独占当前凭证，拒绝非主机/无有效当前绑定授权上下文。普通TDS断线不拒绝仍可HTTP访问的固定任务下载；当前凭证与CBS绑定鉴权是前提，SESSION_READY不是HTTP准入。这个command不解释更新优先级。

CBS短TX复核当前binding、space/project及工件在覆盖boundStore的已创建规则目标中：关联谓词为rule.scope=ALL_PROJECT_STORES，或STORE_REFS确含当前boundStore（包含停用固定目标，不接受任意同空间/同项目其他门店专用包）。范围在原target association任务查询中复核，不增加DB往返。已发grant的content鉴权仍复核当前binding。每次发行新256bit SecureRandom opaque grant，DB仅存SHA256/binding/generation/artifactRef/expiresAt（5分钟）；哈希无法反推token，禁止声称复用旧secret。每binding最多32个未过期grant是临时授权技术预算，满503 BUSY；owner在同一短REQUIRED中先复用foundation `AdvisoryLock.acquireHashText(jdbc, key)`，key为固定 `terminal-update:download-grant:` namespace＋已验证workspaceRef/terminalRef/bindingGeneration的规范字符串；取得该事务级锁后才回收过期、读取有效数并插入新grant。所有发行caller走同一入口，包含首次无grant行；不锁terminal-binding的跨owner业务行、不新增锁表/队列，hash碰撞仅额外串行。锁本身计一次SQL执行，完整normal计数由10改11；既有grant在其有效期内不因另一次发行被撤销，支持合法并发。发行前按过期索引有界回收最多100行，不建轮询或后台队列。transient `{relativeContentPath,grant,expiresAt}`只进当前attempt，专用X-Terminal-Update-Grant请求头，不进URL、持久slice、公开业务selector或日志。content每次短TX重核grant/currentbinding后退出TX流式读取。无Range冒称；完整GET失败沿A有限重试重新发行同artifactgrant，普通TDS断线不改变工件。

UpdatePort/Android adapter prepare网络输入扩transient header（仅这一grant；secret toString遮蔽），source provider `resolveSourcePath`同步形式改为异步具名source resolve，旧签名删除而非永久fallback。端口不持有凭证、不选latest、不在JS/native记录持久grant。需回归A offline/sourcepath/准备失败/有限重试；C副机取得主机授予工件下载能力仍走同peer command，后继细节不在B建立副机服务端身份。收到grant后角色/配置变化但port未提交：当前attempt失效；已提交action按A事实回读不重派。

### 8.5 · CBS HTTP 报告、任务历史与标准重试

本节替换旧 WS 版本报告方案：不新增 VERSION_REPORT/ACK 帧，不新增 TDS 报告 SQL 函数、写 principal 权限、ACK timer 或 report-triggered stop/connect。现有远程运维结果协议保持其独立用途。TDS 只消费规则 topic；升级报告从主机直接向 CBS HTTP 提交。

**事实与身份。** `selectTerminalUpdateVersionReport` 由升级 owner 投影 A 的实际版本及任务/recent；保留附件§11.4有限码，actual 来自原生 readback，不能用目标填充。当前 A 的 recent 不含显式规则/工件关联，B 因报告需求最小扩展同 owner 的 existing recentStatus：保留 taskId 对应的 ruleRef/FULL/HOT publication 关联，复用已有状态变更点，不增第二任务 map 或恢复框架。终态 task 清除前由同 owner 写入最近关联；有合法原报告上下文时，同时形成该任务的 pending 正文并持久化后释放执行 task，不能依赖 integration 晚订阅补捞，也不能解析 taskId 拼规则。没有合法原绑定时只保留最近执行关联，按旧报告失效规则不改签补报；HTTP 是否可达不阻塞本机 task 释放。B 的 focused 反例为终态→普通新 boot→task 已清仍能发送原任务报告及准确关联；尚缺拒绝/回退真实事实的路径继续 OPEN，不从目标编造。持久化报告 descriptor 独立于 A retained 执行核，sync isolated、resetIntent clear；保存 `{bindingIdentity,contextIdentity,nextReportSequence,lastObservationFactsKey,pendingReports,sendPaused,latestDeliveryFailure}`，pending map 以 taskId 为键；无任务当前观察用唯一 `observation` 键。`contextIdentity` 是当前完整规则上下文的非秘密身份，由终端/绑定代次、当前服务空间、门店、项目及项目更新时间组成。`lastObservationFactsKey` 记录当前 binding/context 已生成的最新无任务实际版本观察事实，以实际公开版本字段组成，不包含会随启动变化的 `bootId`；binding 或完整 context 改变时重置该标记，但同一 binding 的 `nextReportSequence` 继续单调。只有当前实际事实与该标记不同才分配新的 `taskId=null` observation；context 改变后允许同一实际事实为新 context 生成 observation，同 context 的重复 reconcile/PONG 不新增报告。该标记与 pending `observation` 同属一个持久 descriptor，不是第二历史或队列；无任务观察不继承旧任务身份。相同上下文的普通断线、重启/hydration保留未提交项；读取到新的完整上下文时，先在同一 slice 持久清空旧 pending、pause 和递送失败摘要，再允许新上下文工作；配置事实暂不可读但绑定仍有效时保留身份标记并暂停发送，待重新读到上下文后比较。绑定结束或 root reset 按既有生命周期清理。task 终态报告沿任务固定的原 selection context 生成，但发送前必须再次匹配当前 context，旧上下文项不能发送到新配置。正文只含公开业务身份/版本/归一状态，无凭证、URL、grant、raw reason/exception。每个业务变化先分配此绑定周期持久的递增 reportSequence/reportId，flush 成功后才发；技术序号只用于报告乱序防护，不改变 TDP topic 的原始更新时间规则。普通断线、同上下文重启/hydration保留未提交项；同任务合并最新状态，不同任务分别保留，不丢旧任务历史。未变化的 selector 求值/PONG 不生成 reportId，不添加历史。持久化失败可见，不能承诺未落盘正文能跨重启恢复。

`submitTerminalUpdateReportCommand` 属 TDC typed HTTP 接缝，payload 为 canonical report，复用 generated executor 与 transport.executeHttp；凭证三头由 TDC 唯一 owner 注入，禁止把 POST/body 塞进 readTerminalDataCommand。升级 actor 通过公开 command 发送，读取身份只用 selector；TDC 不 import 升级业务、不解释状态/历史、不持升级 pending。准入为主机、active、当前 credential 与原记录 bindingIdentity 一致；不要求 SESSION_READY。HTTP 返回后再验当前角色/绑定/配置及调用身份，旧回包不清新记录。配置上下文身份按前文定义；读取到新完整上下文时先清除旧 pending，暂时无法读取时不发送带已知旧身份的记录，且只有确认原项仍存在且身份匹配时才能更新回执。root reset 使本地旧上下文项失效，不影响 CBS 已提交历史；A 已固定任务仍按 A 执行事实回读，当前实际版本可在新绑定以无任务观察上报，不把旧任务冒充新绑定历史。

**CBS 模型。** 唯一表 `terminal_update.terminal_report`：workspace/terminalRef、服务器核验出的 bindingGeneration/device 身份、reportKey（taskId 或 observation）、reportSequence/reportId/bodyHash、actual/recent、规则/工件引用、状态发生时间 changedAt、服务器 receivedAt。唯一键 `(workspace,terminalRef,bindingGeneration,reportKey)`。任务阶段变化 UPSERT 同一行，保留历次 task 行；observation 行只保存该绑定的当前无任务版本观察，不进入任务历史。一个任务行只保存其最新报告，不建设每阶段事件流水。当前终端最新观察按当前绑定中已接受的最大 reportSequence 取；新绑定尚无报告时只显示旧绑定事实并标“上次绑定报告”。历史按 `(receivedAt DESC,taskId DESC)` cursor 分页，仅 taskId 非空记录。阶段更新可能改变排序，保证当前页 cursor/query 身份正确，不承诺跨多次刷新冻结历史快照。

app `TerminalUpdateReportHandler` 在短 REQUIRED 内解析三头、复用 credential verification，再调用 owner `recordReport`；owner 按 workspace/terminal/binding 的 advisory lock 互斥，先取当前行及本绑定最新 sequence。大 sequence 更新相应任务/观察；较小 sequence 只允许补齐另一旧任务的历史而不成为当前最新，同任务旧 sequence 不覆盖较新状态。相同 sequence 必须相同 reportKey/reportId/bodyHash；精确重复返回原 receipt、不改 receivedAt，冲突 typed 409。为保持晚到旧 task 正文的重复识别，同任务低序号重送返回当前更高序号的 `SUPERSEDED` receipt，不能伪称该旧正文已入库；如该低序号撞另一任务已占 sequence，拒绝。正常 `ACCEPTED` receipt 仅在 PG commit 后由 HTTP 返回，含 reportId/taskId/acceptedSequence；`SUPERSEDED` 含请求身份及同 task 的权威更高 sequence。仅可重试失败/响应丢失保留 pending，同正文重送；确定性拒绝与身份拒绝按下表分流，不笼统重发。DB 不可写不承诺能另写失败记录。历史与当前查询都归同 owner，无 TDS DML、第二失败库、审计替代报告或自然时钟排序假设。

**提交结果闭集与队列处置（S-1）。** 新报告 HTTP 的拟错误集合冻结为现有 TERMINAL_DATA_READ 七码，再加 `PLATFORM_COMMON_RESULT_UNKNOWN` 与 `TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT`。下面按合法 code/status、有效 receipt、客户端 IO/协议结果分类；不能只看“非200”或“409”，因为同为409的终端停用与报告冲突处置不同。该表也是未来§4-F标准的最小适用规则；不是新增重试框架。

| 结果及匹配条件 | 分类 | 当前 owner 的最小处置 |
| --- | --- | --- |
| HTTP200，ACCEPTED；reportId/taskId及当前binding/attempt匹配，acceptedSequence等于发送sequence | 已接受 | 删除仍是该发送identity的pending，并flush；旧回包不删同task新项；不代表升级成功 |
| HTTP200，SUPERSEDED；请求reportId/taskId匹配，权威sequence严格大于发送sequence，同task及当前binding/attempt匹配 | 已由较新事实取代 | 同样只清匹配旧pending并flush，不能把未入库旧正文宣称已接受 |
| 网络失败/断线/IO timeout、Runtime结果未知；PLATFORM_DEPENDENCY_UNAVAILABLE/503、PLATFORM_COMMON_RESULT_UNKNOWN/500；无可解码业务problem的5xx | 可重试/结果未知 | 保留相同reportId/sequence/正文，下一有效PONG再试；不无限即时重发、不释放仍在运行IO的inFlight |
| TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT/409；PLATFORM_COMMON_VALIDATION_FAILED/422；PLATFORM_COMMON_RESOURCE_NOT_FOUND/404（报告输入/目标拒绝） | 该报告终态拒绝 | 从pending删除这个仍匹配的项，保存最近递送失败摘要并flush，不再按心跳重送；下一PONG可发送后续task/observation，不重分配序号“绕过”拒绝 |
| TERMINAL_BINDING_CREDENTIAL_INVALID/403；STORE_TERMINAL_DISABLED/409；PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403；PLATFORM_COMMON_ACCESS_DENIED/403；未带合法problem的401/403 | 当前身份/授权不可发送 | 保留pending，持久sendPaused={bindingIdentity,reasonCode}；PONG/普通同配置重连/hydration均不恢复发送。当前绑定或配置变化按原规则清旧pending、pause和旧摘要，不改签旧任务；凭证的清理由TDC唯一owner决定 |
| 不在合法集合的其他4xx/其他HTTP状态；200的body/receipt形状或identity不合法；已完成的本地参数/协议拒绝 | 协议终态拒绝 | 该项同样退出发送集合，最近失败使用本地固定码REPORT_RESPONSE_INVALID或REPORT_SUBMISSION_INVALID，不持raw响应；这不是commit成功 |
| 角色/配置/绑定已经变化后返回的任何结果 | 迟到旧结果 | 忽略对当前slice的写入，沿原identity失效规则清理；不能暂停新绑定或删除新报告 |

`latestDeliveryFailure`是同一个报告slice的一份最新摘要 `{taskId,reportId,reportSequence,reasonCode,observedAt}`，不留原异常/正文，不建设第二队列、失败流水或后台新字段/UI。通过升级owner的公开selector暴露“递送失败/发送暂停”和有限原因，另有脱敏日志；不覆盖A的升级执行recent状态，不把本地失败冒充CBS已存报告。每次有效PONG无请求时不重复写失败摘要。

终态拒绝的移出与摘要写入、身份暂停均通过现有owner slice一次状态变更及flush；flush失败可见。当前Runtime内已拒绝项不得再次成为可发送队首；若落盘失败，重启可能恢复旧pending并再次遇到同拒绝，这是本地存储失败边界，不能宣称持久保证，更不能用新失败库掩盖。后续合法同task业务状态变化可按原规则产生新reportId，但PONG本身不重新生成被拒正文；无手工重试能力。普通同identity重启读取sendPaused保持暂停，原绑定/配置失效清理路径同时清这两个附属字段。

**重试标准。** 拟新增 TDC 公开 `terminalDataHeartbeatCommand`（public、local、allowNoActor:true），仅在匹配且有效 PONG 已完成 deadline/RTT 更新之后发一次，payload 为本机连接身份/seq/observedAt/RTT，不含秘密；非主机无此广播、不转 peer。发送 PING 不另外广播，避免一个心跳重复触发；未知/重复 PONG 沿现有协议拒绝。TDC 异步派发并单独脱敏记录广播拒绝，不能使用现有会把失败接到 transport.invalid 的 dispatchBackgroundCommand，也不 await 业务 HTTP 拉长 PONG 存活处理。Runtime 现有 local handler 分发会调用全部订阅 actor；各 owner 只重试自己的 pending，不能把失败正文交给 TDC/Runtime 或新调度中心。

升级 actor 在首次报告变化/启动恢复时可立即发送；通信失败之后由上述 command 触发重试。一个 owner 同时最多一个真实 HTTP 请求，首个 await 前置 inFlight；Runtime command timeout 不取消真实 handler，不能仅因 timeout 返回就释放 inFlight。请求结束后重验记录/角色/绑定，只有匹配 receipt 才删相应 pending（本地 flush 失败保留，下一 tick 可幂等重送）；await 期间产生的新同 task 报告不能被旧 receipt 删除。每次触发发送一个 pending，其他项留待后续有效 PONG；只从可发送的 pending 中按 reportSequence 升序处理，终态拒绝退出该集合，身份暂停时不选择任何项，合并仅限同 task，真实失败仍是该 owner 可见状态。无独立轮询 timer、无限即时重送、重连救报告、人工重试按钮或通用恢复框架。仅通信/暂时服务失败、未暂停且 PONG 正常时，按既有心跳节奏尝试；终态拒绝不重送，身份暂停不再请求；TDP 不通时缓存继续保留，恢复后有效 PONG 唤醒，不承诺离线期间送达。

未来实施 CP-01 必须把“心跳广播为触发，失败正文/持久化/并发/身份/回执消费归各业务 owner”写入 `doc/platform/terminal-coding-standard.md` §4-F 唯一正本，同步其适用项目记忆/索引；本轮不改这些路径。标准不迫使没有 pending 的 actor 发请求，不用心跳成功宣称业务成功。本批只接升级 owner，后续 owner 按同规则接入。

**查询。** 报告 tab 以当前项目启用门店＋启用终端为主集合，LEFT JOIN owner 报告，不能仅查报告表；该资格不要求终端已有 `latest_binding`。page/detail 返回门店名、终端名、actual、最新任务报告及状态/时间、旧绑定标志。`oldBinding` 仅在存在报告且当前绑定非 ACTIVE、绑定行不存在或报告代次与当前代次不一致时为 true；无报告始终为 false。actual 无值仍有 NO_REPORT 行。page/detail/history 使用同一启用门店、启用终端、当前项目资格，history 对不合格目标返回与 detail 相同的 typed not-found，不伪装成合法空历史。可选 storeRef、queryText（终端名）、currentApkVersion/currentJsVersion/runtimeVersion，均在 SQL 侧按实际报告值精确筛选，不筛目标版本、不过滤当前页、不比较非排序版本字符串。可见版本列完整包含这三项。详情用同 PROJECT 授权，另具名历史 GET，cursor≤100；合格终端无历史显示“还没有收到升级任务报告；终端可能尚未上报”，不将尚无报告与未知/未发生任务混为一谈。已开 Drawer 的门店/终端停用或 scope 改变后读回拒绝/清旧数据；保留数据库历史不等于继续提供停用对象本期页面入口。

**启用范围反例。** fixtures至少区分启用门店＋启用终端（含从未激活且无 `latest_binding`、无报告的终端，显示为 NO_REPORT 且 `oldBinding=false`）、当前绑定 ACTIVE 的本代报告（`oldBinding=false`）、当前绑定 ENDED 仍保留最后报告或重新激活后仅有前代报告（`oldBinding=true`）、启用门店＋停用终端（不显示/拒绝）、停用门店＋启用终端（不显示/拒绝）、双方停用或任一作废（不显示/拒绝）；其中启用且未上报终端必须保留NO_REPORT行。无storeRef时覆盖项目全部符合资格的门店，指定storeRef仍不放宽资格。page、detail与history须用同一资格判断；已打开后停用再读取，拒绝当前目标并清旧内容，原数据库历史保留。验收源码须逐一断言返回身份集合与详情/历史拒绝，不只断言行数。

## 9 · owner API 与消费者

CBS `TerminalUpdateCommandApi`：register/createRule/changeRuleStatus；`TerminalUpdateReportCommandApi.recordReport` 仅供 app ReportHandler；`TerminalUpdateTaskReadApi`：artifact/candidates/rules/snapshot/reportPage/reportDetail/reportHistory；DownloadApi：issueGrant/authorizeContent；TDS 只执行 read_project_topic。TER 升级 actor 通过 TDC typed POST command 上报，TDC广播心跳且不拥有业务pending，transport只通信。所有新 symbol 必须有上述真实 caller。

逐方法caller/事务origin在附件§11、全链同步表在§9a.1。API族不能代替这两表；拟新增方法以表内方法名作为唯一写前锚点，不带Journey/阶段编号。

## 9a · 全链同步变更

精确拟新增路径见附件§4，不手改generated。原子组包含工件/私有asset/运维、规则/IAM/运营/审计、项目topic/TDS/TDC、CBS HTTP报告/PG任务历史/升级pending/TDC心跳/运营筛选与历史。sourceprovider/grant是A消费者差量，不重做A未受影响整批对账。

### 9a.1 · 每事实同步分母

完整路径按附件§4/11/15，以下每行列全部消费层；SYNC=同批改，GENERATED=给定链派生，N_A仅有明确反例。测试是拟交付源码和计划，不是当前PASS。

| 事实 | canonical/生成 | owner/edge/迁移 | UI/state | 测试 | fixture/seed | 同步结论/反例 |
| --- | --- | --- | --- | --- | --- | --- |
| ZIP身份/私有bytes/保存 | terminal-update schemas＋edge catalog→materialize/edge-codegen | asset stage/claim/private storage；Artifact service/controller；artifact/pub/receipt/audit migration | P包页/上传/详情＋生成API | parser/asset owner tests；register/reject/isolation；P组件/L2 | 四真实工件＋新域seed/executor；坏包仅acceptance | SYNC/GENERATED；TER不消费平台stage身份，N_A |
| immutable规则/status/refs/N/M | schemas/cap/page catalog→generated | Rule service/handler＋operations controller/rule audit | O左Tab/create/detail/status；snapshot schema | lifecycle/permission；O component/L2 | 八规则、读/写/撤权fixtures | SYNC；B没有idle执行，C调度N_A |
| topic/hash/完整snapshot | protocol topic＋JSON policy→protocol/terminal generators | topic SQL scope lock/current function/snapshot handler；TDS repo/grants | update snapshot descriptor/actor；无admin副本 | snapshot/delivery/101/并发/listener tests | 当前project/规则HTTP fixtures | SYNC/GENERATED；无副机projection，C N_A |
| currentboot STORE/PROJECT flush | store-basic公开types/command/selector | N_A：CBS只已有HTTP事实，无新owner写 | store-basic readiness＋两integration桥 | gate.first/reload/failure/late tests | typed HTTP/flush controlledfixture | SYNC；不把hydrated readstate当proof |
| grant/binary source | JSON grant schema/policy；binary edge canonical（不进JSON名单） | Download handler/service/private contentedge/grant table | TDC grant command；A provider/UpdatePort/native header | download authorization/expiry/source; A受影响prepare | 当前绑定/固定rule/私有asset | SYNC/GENERATED；不改原生loader/installer，N_A |
| actual/recent/task report | HTTP canonical→generated Java/TS | CBS ReportHandler/owner/terminal_report migration；标准 audit query扩展 | update pending/selector、TDC POST/PONG；运营查询/详情/任务历史 | report.order/recovery/actual、filters/history/audit | 真 A 发布＋本 run 绑定/HTTP；seed不造report | SYNC；无platform报告/no slave row，无 TDS 报告写 |
| L2控制面/TestId | 详设3a八policy/单generator/spec catalog | runner suite/control同步；无新增业务事实migration | 两页面全部实际DOM及强类型TestIds | UI/testId前置＋L2_SCRIPT_ADMISSION红例 | 隔离真实角色/私有objects/报告fixture | SYNC；不操控TER React，N_A |
| TER自动化case/资源 | 既有automation runner case/update phase | DEV profile/manifest binding ownership现有接缝 | 同Web/Android业务selectors/session rebuild | shared update.supply/update.supply-chain/Web/native harness | 共享terminalActivation；seed key读取 | SYNC；禁第二runner/老UiAutomator入口 |
| seed域/父链/count | fixture JSON COUNT_KEYS/seedStages | 新plan/executor；complete父executor/子报告/markdown | N_A：UI读真正服务端事实，不种本地缓存 | 精确seed tests见附件§15 | 四工件/八规则/计数读回 | SYNC；当前无运行 |
| seed角色与权限 | admin catalog/page/cap＋fixture role config | owner-command seed grant/handlers/r5-seed-plan | O menu/write visible capability consumer | 角色count/撤权/只读真实HTTP/L2 | root/account-multi-role/role-group/project | SYNC；不扩STORE/HEAD_COMPANY角色 |

## 9b · 变更定位

新增 terminal-update/CBS edge/migration、两个后台 feature、TER pending/HTTP/PONG及唯一runner；保留 A 加载/installer 核；删除被替代的同步 provider 签名。不建第二 owner/schema/runner、每阶段流水或自动调度/HOT loader；每任务历史按本次裁决实现。

## 10 · 迁移

唯一 CBS Flyway 新增 terminal-update 工件/publication/rule/topic/terminal_report/download_grant/receipt/audit 表。terminal_report任务行按唯一键UPSERT，无task观察不进入历史；当前观察与历史共用单一事实表。已有终端无report合法null，seed不造假报告；asset bucket预检不在Flyway做网络I/O。历史不因门店/终端停用或取消绑定删除；页面资格和留存分开。

## 10b · seed

### 10b.1 文件全集
新增 `scripts/dev/terminal-update-seed-{plan,executor}.mjs` 及其tests；同步 `scripts/dev/r5-fixture-contract.mjs`及`r5-fixture-contract.test.mjs`（COUNT_KEYS/seedStages validator）、`scripts/dev/r5-complete-seed-executor.mjs`/test、`r5-seed-plan.mjs`、`owner-command-seed-executor.mjs`/test、`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`。工件输入来自一次已成功完成的本仓受管 `update.artifacts` 运行：设置 `R5_TERMINAL_UPDATE_SEED_ARTIFACT_EXPORT=1` 后，唯一 driver 将本次生成并校验的两个 App FULL/HOT ZIP、descriptor 与 FULL package record 复制到该 run 自己的 `.runtime/terminal-automation/<runId>/update/seed-inputs/`，逐文件写 SHA-256/长度清单；完整 seed 只接受调用者明确给出的 `R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID`，且 plan 重新核验 source run identity、`update.artifacts`、business/cleanup PASS、文件全集、root confinement、hash、artifact schema 与 FULL/HOT 配对。真实 seed 完成四工件/八规则的服务端 readback 后，只删除该 source run 下精确的 `update/seed-inputs/` 副本并把清理结果写入子报告；不清理 automation run 的其它日志/证据。没有完整成功的输入 run 时 dry-run fail closed，不引用根外/临时 Codex 路径。

### 10b.2～5 新旧事实与覆盖
新域plan造两个App各FULL/配对HOT、FULL-only、ALL/指定门店、启用/停用、立即/闲时，DEV规则使用N=5/M=10分钟；N/M上下界及非法秒值只放acceptance fixture，不混入完整DEV seed。坏包/跨空间/撤权/超限属于acceptance红fixture，不保存成seed可用包；未知/尚无报告通过空初始化合法呈现，不伪造实际版本。旧终端身份/用途数据不变；旧schema/API形状若增加字段需同步static tests。所有scope/cap/真实工件hash输入在dry-run校验。seed无旧数据转换/冲突重跑fallback。

### 10b.6 前提/父流程/角色
在完整seed的organization/store-terminal完成后按序执行新域：读取本仓成功 `update.artifacts` run 的 hash-bound source，将两个 App 的 FULL/HOT 发布包经既有平台 stage/register/detail HTTP 保存，再以现有 multi-role 运营账号选 GROUP 与 PROJECT，经公开 create/detail/page HTTP 建立并读回四工件、八规则；PROJECT 有写 capability，项目外和 STORE 角色不新增权限。父report按 `store-terminal`、`terminal-update` 顺序保留子阶段首败及 business/cleanup，新增 `terminalUpdateArtifacts=4`、`terminalUpdateRules=8` expectedCounts，dry-run/实际report/Markdown 一致。GROUP_SEED_CAPABILITIES与seed管理角色增加项目终端版本管理 PROJECT capability，使用现有运营seed会话；平台上传使用现有platform seed session。真实完整 seed 结束前移除该 source run 下仅供导入的 `update/seed-inputs/` 精确副本并验证已删除；service-side seeded artifacts/rules 是完整 r5 fixture，保留至受管 reset。完整seed只在受管reset后的空库执行；阶段B实施期按需reset授权已由Dexter在§0.2明确给出，无需重复申请。为本批首次reset或seed前，必须CP/全批6b MATCHED、适用准入与当前字节完整seed dry-run PASS齐全；backend-acceptance沿既有准入。dry-run不等于真实seed或reset已执行。

## 11 · 验收场景设计

新 `TerminalUpdateAcceptanceScenarios.java` 承载HTTP真实业务；协议扩现有 `TerminalConnectionContractScenarios.java`；直接component/owner测试覆盖纯分支。每行fixture/request/oracle明确，不能status-only。场景能力名不带阶段/Journey ID。

| id | identity/fixture/request | businessOracle |
| --- | --- | --- |
| update.artifact.register | platform W1；A两App真实FULL/HOT；stage/register/detail/既有平台audit GET | 真实类型/四版本/pub/zipSHA/最小FULL一致，asset私有，无未核验可用记录；保存审计读回一事件，精确register重放不增审计，跨空间audit拒绝 |
| update.artifact.reject | platform W1；坏hash、缺声明文件、重复规范路径、正常大小超限、错APK签名/metadata、同版本不同内容 | 明确reason、零可用包/零引用；owned临时cleanup；工具超时可见；恶意归档专项 NOT_COVERED/NOT_RUN，不要求新增框架 |
| update.artifact.isolation | W1/W2同内容与跨空间refs；register/candidate/download | 同内容跨空间合法保存；跨空间不泄露/不授权；无anonymousread |
| update.rule.permission | PROJECT A只读/有cap/撤cap/PROJECT B；page/detail/candidate/create/status | GET关联候选不附写cap；写撤权无rule/audit；同空间节点外拒绝 |
| update.rule.lifecycle | 真实FULL/HOT/门店；create/status/detail/audit | N/M闭包、空refs/跨project拒绝；只启停createdAt不变，重放一事实；audit可读 |
| update.rule.snapshot | 101启用规则含两App、无cache并发create/disable；页间mutation | 全部规则、0空快照、旧页hash拒绝、并发后PG权威hash/time，same-ms在线通知 |
| update.download.authorization | 同project门店A/B真实绑定；仅B的STORE_REFS规则、ALL规则、包含A的停用固定旧rule、过期grant、取消绑定；grant＋GETcontent | A不能获仅B规则工件grant；ALL或refs含A的固定来源可续（停用不取消固定执行）；失效binding拒绝新请求；无凭证泄露；下载字节zipSHA |
| update.rules.delivery | 受管DEV真实后台创建/启停，两App完整snapshot | mainselector全量/空替换/flush后accept；无prepare/apply；首次project=null、旧hydrated、PROJECT失败/flush失败/迟到隔离，真成功触发；每ready立即核对 |
| update.report.order | 真实 HTTP/PG；两task、同task阶段更新、重复/乱序/旧binding/未知 | 每task一行，最新按报告sequence；重复receivedAt不变；旧HTTP回执不能清新pending；无WS报告函数 |
| update.report.actual | A真实执行核FULL→HOT＋重启，唯一automation driver | actual来自新boot真实APK/JS→同CBS报告HTTP入口→匹配receipt→本run PG及报告GET读回，不造target版本；隔离L2的update-report-current-detail只证明后台消费；§15.2a另以同DEV、同rule/task的真实TER报告完成运营Tab/Drawer读回，不跨环境借报告 |
| update.report.recovery | HTTP失败/响应丢失/本地flush失败/重启/有效PONG/配置与binding变化 | 持久pending不丢不同task；409报告冲突不阻塞后续task、422不阻塞observation、停用/凭证拒绝暂停且重启/重连不重发；有效PONG才唤醒可重试补发；重叠tick最多1真实IO；重复receipt幂等；不触发stop/connect/invalid；无秘密 |
| update.supply-chain | 两App各自产同run INSTALL/FULL/HOT；root平台UI保存＋运营GROUP/PROJECT创建启用＋同DEV主机真实task，fixture/步骤唯一见§15.2a | 同rule/artifact/binding从真实UI返回→snapshot→正式A command→CBS grant→真FULL/HOT actual→CBS HTTP receipt→运营Tab/历史，借用DEV前端与owned cleanup分账；Web只非adapter、Android才native，不覆盖C自动调度 |
| update.admin.journey | 两后台fileinput/解析/保存/候选/规则启停与审计/报告版本查询与历史 | 上传及解析成功前保存禁用；分钟换算；enabled门店＋终端；历史分页/无写cap读取/真实标准容器/cleanup |

### 11a · 正式验收判据映射

附件 §6 逐条列 V-01～30 的 B 子断言及 A/C边界。B核心为 V-03有效包完整性及 V-04普通路径/大小/坏摘要子判据、V-05/06权限与规则、V-10静态配对、V-11完整topic供给、V-17授权下载、V-27/28实际报告及V-29运营后台最后值（Dexter本次裁定覆盖旧双面报告）。正式 V-04 的恶意归档专项仍 NOT_COVERED/NOT_RUN，不从这些子判据宣称全条通过。其余只承接本期实际适用子断言；A原生保护/V-21～26仅被B接口影响时差量回归，不宣称B重新整批PASS；C自动/双机/N/M尚NOT_COVERED_BY_B。

## 12 · 未决项

| 项目 | 状态/关闭条件 | 当前允许/禁止 |
| --- | --- | --- |
| A最终FULL格式与HOT actual readback/续接 | OPEN_A_HANDOFF；§0.1及2026-10-09 A静态报告：有效FULL ZIP、两种publication、FULL UNKNOWN后的固定HOT、普通HOT冷启动后下一更新 | 可写条件设计；A主线问题闭合前不宣称B接缝就绪，不重做未受影响A整批 |
| 最近任务报告关联 | B_CP04_MINIMAL_EXTENSION；当前A recent仅四字段，task释放后缺显式rule/FULL/HOT；§8.5同owner最小补齐 | 不另造任务账本、不解析taskId、不把保留旧task改签新绑定；本轮只写设计，未实现 |
| UI/Journey看图 | ACCEPTED@2026-10-07（仅大致IA）；Dexter允许下一步设计 | 本稿继续详设review；实际UI/运行NOT_RUN，仍需未来实施授权 |
| APK/ZIP/Minio实际解析与SDK工具部署 | OPEN_CP01；精确版本/官方source/toolreadback与反例 | 不新增依赖/运行；不从latest docs猜API |
| 资源预算/多页/私有bucket | NOT_RUN；实际budget/preflight＋有限失败proof | 数值候审，不称容量或匿名隔离PASS |
| 原始topic同值离线漏失 | 已接受TDP限制；B每ready HTTP降低规则遗漏窗口 | 不添加伪时间/轮询/持久通知保证 |
| 最新产品裁决 | 六项＋任务粒度＋仅启用范围均有直接会话确认 | 原外部 verdict 保留旧字节；当前修订未有独立 verdict，不构成实施授权 |
| C自动/副机 | NOT_IN_SCOPE；C另行设计 | 不补自动执行、不上报副机 |

## 13 · 停机条件

前置失效/产品语义改变/新增cross-owner写/预算需削弱事实/未授权昂贵动作，停在对应边界向Dexter交精确问题。第一次失败保留首败、broken boundary、last-known-good，先日志诊断再最小修复；不以延长timeout/盲重跑救绿。cleanup非PASS不得动态完成。

## 13b · 实施节奏与三维对账

逐点双读/focused；每完整CP fresh三维MATCHED；全部CP后独立全批6b。首次CP内动态proof前先对即将运行字节做静态准入，不提前宣布CP退出MATCHED；整体验收前再全批准入。不得重复未受影响A已MATCHED内容，不得跳过B新增跨阶段consumer差量或全批6b。

## 13c · 逐代码与详设对账

实施计划有独立显式步骤，fresh只读reviewer覆盖所有改动生产/测试/脚本/生成输入及输出/迁移/seed/目录/API文档，不抽样；检查零调用者及详设点名但未交文件，结论MATCHED/OPEN。OPEN禁止交付实施review；它不能替代整体6b或fresh IMPLEMENTATION verdict。

## 14 · 交付自查

当前只有源代码静态输入与设计；没有生成/运行PASS。主/副、供给/执行、actual/target、私有/公共对象、topicTime/collectionHash、A当前/已验收六对边界均显式。UI/计划/附件须在本次获授权独立review结束后读回同一条款。最终包交Dexter与外部Claude，不自行把文档状态提升为实施授权。

## 14.1 · 最新裁定的报告任务读取

getOperationsProjectTerminalVersionPage：expectedContextVersion/cursor/limit≤100、storeRef/queryText/currentApkVersion/currentJsVersion/runtimeVersion。SQL主集合为当前PROJECT启用门店＋启用终端，LEFT JOIN当前最新报告，含NO_REPORT；actual字段精确筛选，非target。Page/detail一次任务join返回门店/终端名、actual、最新任务及规则/工件结构化事实、unknown/旧绑定/changedAt/receivedAt，前端组装标题。UUID DESC cursor绑定scope/filter，非当前页过滤；detail同真实PROJECT准入，历史按§8.5单独cursor GET。历史保留不意味着停用对象仍可从本页读取。

不新增getPlatformStoreTerminalVersionPage，不扩运维组织总览Drawer。V-29本期验收改为运维只包库、运营左规则/右当前项目启用门店下启用终端报告与标准详情Drawer；跨项目拒绝、无写cap可读、多门店含无报告终端、分页及切project旧结果隔离须分别证伪。

## 14.2 · TDC 生成与分页消费接缝（CP-01/CP-04）

当前TDC actor仅接受operationId以terminalRead开头，types用排除激活/取消的宽集合且调用固定queryParameters={}。因此新snapshot使用terminalReadProjectUpdateRuleSnapshotPage；不得仅改operation表而省略消费者。CP-01同步contracts/policy/terminal-client-generation.json的canonical/tag/includeOperationIds和现有materialize→codegen→terminal生成链；新增terminalReadProjectUpdateRuleSnapshotPage、issueTerminalUpdateArtifactDownloadGrant、submitTerminalUpdateReport三个JSON operation进入TDC includeOperationIds；binary content仅列全局edge catalog，不进入该JSON消费名单。CP-04把通用只读operation集合改为Extract<TerminalOperationId, `terminalRead${string}`>或生成的等价只读闭集，新增grant/report POST及binary content不得混入readTerminalDataCommand。TerminalDataReadPayload逐operation使用TerminalRequestMap的pathParameters和queryParameters；已有八个无query读可省略并归一{}，snapshot必须传cursor/limit/collectionHash。actor按该operation生成契约校验/序列化，仅生成已声明query字段，不透传raw任意query，身份三头仍仅TDC构造；server-config前缀由transport adapter消费。grant与report各走TDC自己的公开typed POST command，content由native消费受保护source，不造feature HTTP服务或第二凭证owner。反例：非terminalRead名称被拒；新grant/report被误收为read；snapshot第二页cursor漏传重复第一页；旧八读仍typecheck；canonical缺policy白名单导致消费者operation缺失。

本次Dexter改变报告消费后台与同页双Tab Journey，旧cycle R1 NO-GO及R2受控STOPPED_SCOPE_CHANGED/NOT_ISSUED仅历史。当前cycle ter-version-update-stage-b-project-tabs-20261007原按两轮结束；随后Dexter直接授权追加R3/R4；R4独立NO-GO 0M/1S/0N，主agent依据verification-governance§8确认验收顺序矛盾。Dexter随后原话“如果第四轮还是NO GO，并且也是你确认的真问题，可以再增加两轮”的条件已满足；同cycle完成fresh只读R5；R6尝试因agent thread limit reached未执行，NOT_EXECUTED_TOOL_LIMIT/NOT_ISSUED。本次例外上限6、ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION。保留R4当时limit4，不重建cycle，不以作者修订代独立verdict；已停止，交外部Claude。旧scope cycle的停止及结论仍仅历史。所有行为/cleanup仍NOT_RUN。

控件容器以最新Dexter明确裁定为强制输入：现有ProTable查询/列表、foundation cursor分页、标准详情/编辑Drawer、StatusChangeConfirm、AntD Tabs；逐交互面来源和props见附件§10，禁自建查询/列表/分页/dirty/详情容器。

## 15 · 测试脚本与 seed 的完整实施输入

### 15.1 seed稳定key与角色（§10b的可执行补全）

唯一稳定fixture输入仍是r5-full-dev-seed-fixture-contract.json；新增terminalUpdate域，不把新工件/规则塞organization或旧域executor。四个工件key：update-console-full、update-console-hot、update-wallpaper-full、update-wallpaper-hot，两个HOT各自固定对应FULL。appId/package/signature/runtime/publication/zipSHA只能取A实际自产文件与校验摘要，不抄假版本；输入目录在仓根内realpath验证，缺任一FULL/HOT或签名不能dry-run绿。工件由platform账户root的现有session，经stage/register/GET写读回；环境变量V2S_SEED_PLATFORM_ROOT_PASSWORD只由受管credential reader给HTTP，值不写JSON/log。

八条规则key（FULL/HOT引用上述key，project=project-river/space=gw-aurora）：

| key | app/目标 | scope | status | N秒 | HOT策略/M秒 |
| --- | --- | --- | --- | --- | --- |
| update-console-full-all | console/FULL | ALL_PROJECT_STORES | ENABLED | 300 | N/A（无HOT） |
| update-console-hot-all | console/pair | ALL_PROJECT_STORES | ENABLED | 300 | IMMEDIATE / null |
| update-console-hot-operating | console/pair | STORE_REFS:[store-operating] | DISABLED | 300 | IDLE / 600 |
| update-console-hot-preparing | console/pair | STORE_REFS:[store-preparing] | ENABLED | 300 | IDLE / 600 |
| update-wallpaper-full-all | wallpaper/FULL | ALL_PROJECT_STORES | DISABLED | 300 | N/A |
| update-wallpaper-hot-all | wallpaper/pair | ALL_PROJECT_STORES | ENABLED | 300 | IMMEDIATE / null |
| update-wallpaper-hot-operating | wallpaper/pair | STORE_REFS:[store-operating] | ENABLED | 300 | IDLE / 600 |
| update-wallpaper-hot-preparing | wallpaper/pair | STORE_REFS:[store-preparing] | DISABLED | 300 | IDLE / 600 |

DEV用 N=300秒（5分钟）、IDLE M=600秒（10分钟），UI只标分钟。60/86400秒及0/59/61/86401非法值只进acceptance，分钟换算与60倍数校验有focused红例，不进入正常体验。

规则通过现有account-multi-role的运营seed会话，在asg-multi-group/group合法范围选择project-river，经create/status/detail只写本owner；V2S_SEED_OPERATIONS_DEFAULT_PASSWORD经既有reader提供。role-group增加PG-PROJECT-TERMINAL-VERSION-RULES页面与MANAGE_PROJECT_TERMINAL_VERSION动作；role-project增加页面读权限，本期不为其默认新增版本写cap；其他STORE/HEAD_COMPANY角色不借本任务扩PROJECT权限。只读独立账户/撤权/跨项目的真实acceptance/L2 fixture用现有邀请/角色链临时生成，不误用有GROUP授权的多角色账号冒充无写cap。角色配置/capability catalogue/ GROUP_SEED_CAPABILITIES/r5-seed-plan断言必须同批同步。

完整seed顺序：现有四主阶段与store-terminal后处理完成→新增terminal-update子阶段（新增域，不重排已有步骤）；r5-fixture-contract COUNT_KEYS新增terminalUpdateArtifacts/terminalUpdateRules，expectedCounts从四/八条稳定输入推导（4、8），父报告/markdown/子报告/DryRun必须一致，不复制固定计数到profile。新资产合法usage active/staged counts按实际生命周期同步原asset计数来源，不能继续旧数字造假。子阶段首败由父report childFirstFailure原样保留，任何失败不称fullseed PASS。新增计划/executor/tests和r5-fixture-contract.mjs及拟新增r5-fixture-contract.test.mjs、完整父executor/tests、r5-seed-plan、owner-command executor/tests、fixture JSON及相关报告消费README均在CP-06完成；dry-run遍历完整父链验证产物hash/schema/role/cap/refs/count，不上传、不写DB。规则createdAt由owner真实创建，不自行填顺序时钟。

FULL-only规则的HTTP详情/读回保留`hotArtifactRef`字段并允许`null`；该字段在响应中必有，不能因没有HOT工件而省略。请求侧仍按canonical operation schema的可选输入处理；seed在规则读回时以`null`验证FULL-only身份，不为FULL-only制造HOT工件。

既有seed影响：旧“34-key mutation catalog”注释/断言因新增动作必须按actual catalog更新；不改旧终端key、激活码、deviceType/身份/用途。旧group/project页面权限与新expectedCount集合必须同步validator，避免新域被完整父流程遗漏。旧asset计数是新增真实asset事实的计数变更，不生成兼容迁移。无绑定/未上报状态保持真实NO_REPORT，不seed伪actual、未获授权激活或安装任务；坏包/超限/原生失败由独立测试红fixture而非可用seed工件。

### 15.2 各执行面fixture与清理

| 执行面/脚本源码 | 数据前提与合法动作 | 业务断言及失败/cleanup责任 |
| --- | --- | --- |
| TerminalUpdateAcceptanceScenarios.java＋唯一backend-acceptance | 隔离真实PG/Minio/CBS；自己经公开owner HTTP建立两空间/两项目/读写角色/工件/规则，不能依赖DEV seed | 对§11所有HTTP场景实体字段、零写、审计、bytes/hash/scope逐断言；run-owned容器/卷/对象namespace按既有runner回收，保留首败 |
| TerminalConnectionContractScenarios.java＋同受管协议通道 | 本 run topic/principal 与 matched PONG/广播边界 | 仅规则topic协议，不承载升级report；HTTP/PG任务历史由 TerminalUpdateAcceptanceScenarios 证明 |
| tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts＋现有runner update phase | API与后台本链focused browser先关闭；按当前授权及适用准入/current完整dry-run，受管reset→start→本批当前完整seed真实成功，再启动TER；只使用当前已分配单机双屏真机身份，console与wallpaper各自产物，不运行mobile/双机/双VM | seed只供DEV体验前提，不充API fixture；manifest必须绑定唯一设备序列。TER主流程与native actual只在单机双屏真机证明，Web/其它设备均NOT_RUN/NOT_COVERED；state/request断言不以response.ok替代，业务和cleanup分列 |
| tools/terminal-automation既有update native harness差量 | 真A FULL/HOT（失败点/重启前后版本由构建输入），本run设备/application和系统installer窄例外 | currentboot实际值→report→PG，不以mocktarget造成功；只清identity匹配进程/应用/绑定/reverse，cleanup独立 |
| 两app src/tests/l2/terminal-update.spec.ts＋browser-l2-runtime.mjs新suite | 每run隔离backend数据库/assetnamespace；真实邀请链建只读/写/撤权角色；实际ZIP fileinput；不复用DEV绑定或终端安装 | 标准查询/列表/cursor/Drawer/Tab/启停错误及scope、NO_REPORT多门店；读取真正字段；首败停止业务，保留诊断；每方Vite/browser/tunnel/backend所有权cleanup |
| parser/seed/runner focused源码 | 本仓hash绑定好包/普通无效包、fake工具超时、typed ports/fixtures，不造产品运行通道 | 仓根输入 realpath/symlink 逃逸门按 D-41 保留；归档条目的普通相对路径/字节预算/重复、scope/typed拒绝、父链计数及清理失败红例；ZIP Unix symlink/截断/炸弹专项 NOT_COVERED；测试fixture不是DEV真实结果 |

以上脚本只按既有受管入口扩 case，不另建 runner。CP-05 依据最新 CLI/源码把阶段 B update supply case 接入唯一 `terminal-automation` runner，执行参数必须指向 manifest 确认的单机双屏真机和当前sample；不得接入 web/mobile/双机/双VM case 作为本轮执行要求。后台通过同一 `update.supply-chain` 父 run 复用受管 DEV 管理端 origin，以 run-owned Playwright 完成真实页面动作；不调用固定隔离库 `browser-l2-runtime`，不要求或执行无关 Browser L2 suite。backend-acceptance沿既有 operation catalog 按本批真实后端变化选 focused operation；不把计划命令当当前可执行PASS。

本轮整体验收顺序：backend/API focused business＋cleanup→两后台本链 focused browser business＋cleanup→满足准入后受管 DEV reset/start/完整seed→本轮唯一单机双屏真机上依次验证 console 与 wallpaper 的真实更新链→13c/实施 review。不得启动 Expo Web、其它设备或全量 Browser L2。管理页面与真机业务必须以同一规则、绑定、工件、任务和报告身份闭环；所有运行结论以执行后证据为准。

### 15.2a · 必交付的同 DEV 完整升级链（非隔离浏览器 L2）

**执行入口与边界。** 只扩 `scripts/test/terminal-automation.mjs` → `tools/terminal-automation/src/runner.ts` 的 update phase，新增 `update.supply-chain` case，由 `tools/terminal-automation/journeys/update.android.test.ts` 消费；后台页面动作封装在 `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts`，它是 helper，不是独立 case/test 文件。本轮此 case 仅接受 `platform=android && shape=dual`，参数解析 fail closed，mobile 与 web 为拒绝反例。CP-05 同步 case 闭集、implemented 判定、DEV 准入、case 到 suite 的显式映射；只新增 test 文件不算接线。runner 在同一父 run 内复用现有 Playwright/管理端 TestId 操作两个后台，TER React 节点仍经 automation agent；非 React installer/settings 仅 driver 窄例外。管理端动作复用两个 app 现有 locator/操作 helper及附件§9 TestId，必要的最小 helper 抽取由两消费者共享，不导入旧 runner、不用 page.evaluate/fetch 代替 UI。

当前唯一浏览器 L2 固定隔离库，不能改成读取 DEV。本主线借用受管 DEV 已拥有的 platform-admin/operations-admin Vite 与 tunnel（当前 r5-dev-runner.mjs:2403–2432），只在既有 TER managed runner 新增本 case 的 Playwright browser/context/session。CP-05登记借用 DEV manifest/host/boot/source identity及实际管理端origin；Vite/tunnel属于DEV，不能算TER owned tree或由TER cleanup停止。TER新建的browser/设备driver/reverse/安装/绑定按其本机PID/start token/资源身份登记预算与cleanup；资源门仅精确放行借用DEV，不豁免未知树。不另起同端口Vite；已有DEV前端不匹配当前字节时先经受管DEV重启更新并读回，不在本case静默补一个前端进程。远端 Java/TDS/PG/assets 保持现 DEV 受管拓扑，本机只运行 Vite/Playwright/Expo 或设备驱动，禁止 PG tunnel/本机 Java。可复用当前 runner 的后台凭据 reader，不能手工另起浏览器/脚本绕过该生命周期。运行前把全部允许的 UI/terminal HTTP/WS/asset 流列入该 case；首败后停止新业务操作，保留日志、已返回身份并执行 owned cleanup。业务 fixture 不能用于静默补做失败的 UI 动作。

**前提固定（CP-01/CP-05 定稿，不留到验收临场选择）。**

- 应用：console、wallpaper 都验证；各自一条 FULL→HOT 正常生产供给链；FULL-only分支沿已有owner/Web/API及受影响A focused验证，不为重复A主流程再增加原生完整run。复用 A 自产 INSTALL/FULL/HOT 与同签名/同 packageId；nativeBuildNumber(FULL)>INSTALL，配对 HOT 的 runtime/native 身份等于 FULL，bundleVersion(HOT)>FULL内嵌且高于起始当前JS。publicationId、ZIP摘要、内层APK摘要分别从实际产物读取。A 现有工具不能构成上述差异时先修获授权的构建输入/入口，不手改manifest或调用CBS种假版本。复用现有builder的run-scoped applicationId suffix、FULL nativeBuildNumber与HOT bundleVersion输入（terminal-update-artifact.mjs:312–333；update.android.test.ts:612–645），三产物同suffix/签名，避免覆盖既存应用或与seed同App同版本异publication冲突。保留automation agent driver/shape/真实managedCBS/TDS构建注入；明确移除 `EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL` 与旧 `EXPO_PUBLIC_TER_AUTOMATION_UPDATE_REVISION` fixture输入，后台密码等秘密不进入构建env。所用 argv、输入文件、Android API≥29 与明确 device-serial/shape 写入 case 参数；无指定合格设备 fail closed，不猜默认设备。每次仅占用一个契约终端，两个 App 串行。
- 前提数据只来自本批完整 r5-full seed 的 gw-aurora/project-river/store-operating、term-handheld（mobile）；若明确批准主机 shape，则用 term-front，不改 activation code。seed 四包/八规则供普通体验，**不代替本主线的上传/保存/新建/启用动作**。主线用本 run 拥有的不同 publication 与规则说明辨识自己的事实，不能选 seed规则充成功；只有启用门店/启用终端才进入报告Tab。没有副机身份或报告。
- 真实网络配置由 `tools/terminal-automation/src/runner.ts` 的 managedDevContext 提供：现有 `V2S_TERMINAL_DEV_HTTP_BASE_URL`、`V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL`、`V2S_TERMINAL_DEV_TDS_ENTRY_TWO_WS_URL` 对应当前manifest的CBS HTTP/两个HAProxy入口；Web构建注入 `EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL` 为host manifest HTTP入口＋`/api/terminal/group-workspaces/aurora`，两个 `EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_*_WS_URL` 取同host context。Android构建则使用本run reverse的设备侧URL（复用现有设备28080 HTTP、28180/28181 WS接缝并保留真实服务path），不能把host的127.0.0.1 URL直接当设备地址；connection的managedServicePorts分别把这些device端口映射到由同DEV manifest解析的host localPort。两侧端口不要求相等，注册前核验reverse所有权，不能覆盖未知已有映射。Web和Android始终到同一真实CBS/HAProxy数据面；不能照搬A update.android.test.ts的两个socket.destroy() TDS sink、本地/update-target或本地ZIP服务。所有required server-config地址同时完整注入，不让安装包的旧配置残留跨环境；selector读回实际配置/当前TDC ready、HTTP origin与工件URI同DEV。构建/包内装配选择B production provider，明确不设置 `EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL`；启用automation agent不等于启用A测试供包provider。
- 运维 actor=root，密码由 `V2S_SEED_PLATFORM_ROOT_PASSWORD` reader临时提供，真实登录 platform-admin，选择 gw-aurora 集团空间；该 actor 有平台管理员资格即可，不新增项目cap。
- 运营写 actor=r5-account-multi-role（seed key account-multi-role），密码由 `V2S_SEED_OPERATIONS_DEFAULT_PASSWORD` reader临时提供；**真实 shell 选 asg-multi-group 的 GROUP 任职，再选 project-river 的 PROJECT 数据节点**，验证页面授权及 MANAGE_PROJECT_TERMINAL_VERSION 后才新建/启用。不能沿用激活 fixture 的 PROJECT任职＋STORE节点 session 发写请求。只读角色、撤权与跨scope仍由隔离L2/HTTP fixture覆盖，不增加本链账号体系。session/token/激活码仅内存，不落盘原值。

| 顺序 | 真正执行者、路径与动作 | 必须读回的业务事实／关联 |
| --- | --- | --- |
| 1 打包 | 现有受管 artifact build 能力，两个 application 的 INSTALL APK、FULL ZIP、配对 HOT ZIP；通过 package.json 的正式脚本链，run-owned release输入/产物 | 签名、packageId、native/runtime/bundle/publication、ZIP/内层APK摘要与真实before/after差异；无不匹配工件继续 |
| 2 上传 FULL | root→运维 `/platform/terminal-update-packages`→上传Drawer→真实file input；解析后先展示服务端校验的候选类型、applicationId、platform、原生版本/构建、JS版本、runtime、publicationId、ZIP摘要及APK摘要，再“保存”；点击列表标题读详情 | 保存之前按钮不可用；候选类型不匹配时不能提交；保存后真实artifactRef、类型FULL及版本/摘要正确；解析预览来自同次stage响应，真实HTTP/owner读回与显示同一ref |
| 3 上传 HOT | 同页上传HOT→解析并展示同一组候选身份及声明的minimumFull五事实→选择步骤2 FULL作为最小完整包→“保存”→详情 | HOT固定配对FULL ref及五身份一致；所选FULL与解析声明可核对；不靠seed候选或直接HTTP代替保存 |
| 4 建规则 | 运营 `/operations/:groupWorkspaceKey/terminal-update-rules`，选上述GROUP/PROJECT，左“更新规则”Tab→新建Drawer→配对HOT→STORE_REFS含store-operating、N=5分钟，HOT=立即→保存DISABLED→详情“启用”确认 | 实际ruleRef、project/store范围、目标两artifactRef、N=300秒、启用状态和标准操作历史；确认启用前TER不会得到本规则 |
| 5 准备 TER | 同 App真实INSTALL基线装入当前run设备，经既有共享fixture激活启用终端，等当前boot STORE/PROJECT HTTP及flush成功/TDC ready，规则snapshot完整提交 | 真实before actual版本、binding周期与project/store/terminalRef；snapshot恰含步骤4 ruleRef及同工件，不接受旧hydrated或另一个项目的规则 |
| 6 固定目标 | driver先订阅request，再从snapshot selector取selectionContext＋该ruleRef，经agent发送唯一A accept command；§8.4生产provider逐项核验并物化 | commandId/requestId、taskId、fixed ruleRef及artifactRef匹配；运行不装A本地/update-target或/full.zip fixture server，无第二业务入口 |
| 7 下载/安装/热更 | 真实TDC三头CBS grant→CBS私有content→真实ZIP校验；A固定task/真实Android UpdatePort完成FULL安装，需用户确认时driver经系统installer真操作；重启后同task续HOT | grant与同binding/artifact匹配但秘密不落盘；实际APK/embedded身份已变化，HOT实际entry/publication匹配；跨boottask/action身份续接，不重复FULL。pair直到HOT完成才算最终成功；FULL-only无HOT的分支另由owner/Web/API具名断言覆盖，Webfixture不证明nativePASS |
| 8 上报 | 更新owner形成实际任务报告，经TDC的CBS HTTP接口；不可达则原slice pending＋有效PONG command重试 | 同taskId/reportId/sequence/原binding身份，CBS receipt和owner权威读回；actual来自native，不能从目标或fixture填成功，无TDS report写路径 |
| 9 运营看结果 | 同DEV、同PROJECT的右“终端更新状态”Tab→门店/actual版本查询→终端标题→详情/历史 | 同启用terminalRef行显示store/terminal名、实际native/runtime/JS及最新任务状态；Drawer同task真实rule/工件事实。当前完整链的同task历史恰一行，实际规则/版本/结果匹配；阶段更新不是新历史。多task及分页由隔离L2和backend已有具名case覆盖，不为该断言额外升级设备。查询旧版本排除、新版本命中；不借隔离L2造的report |
| 10 回收 | 同父run按manifest身份回收本run安装/进程/reverse/激活绑定、browser/context/session/fixture；两Vite及tunnel属于借用DEV，保留并由DEV受管生命周期控制 | business和cleanup分别判定；绑定device readback必须匹配本run才cancel，未知既存应用/进程不得删除；私有资产及不可删rule/report等正常历史不直接SQL清理，留在已授权DEV数据库，下一独立run必要时受管reset。不得为清理再造删除operation |

步骤5共享激活fixture使用其既有合法运营session只为激活；规则写session单独按上述GROUP/PROJECT建立。顺序2–4与9必须真实UI操作；步骤6是基础设施验收触发，**本期不宣称“启用规则后TER自动择新升级”通过**，该自动行为归C。断线补报/确定拒绝/只读/跨scope等已具名反例沿§11及隔离L2验证，不把正常主线扩大成极端归档或完整A重跑。

同一原生子链从安装基线开始连续保持DEV数据面，不在上传、建规则、升级、报告读回之间reset/seed；重启后重建agent session、selector订阅和后台只读查询，不丢旧task身份。每App只执行一个配对规则、一个任务；不人为多跑一个更新任务以证明已有历史分页断言。每App单独run，App间按所有权回收后再借同seed key；记录关联仅用现有manifest非秘密字段 `{workspaceRef,projectRef,storeRef,terminalRef,bindingGeneration,applicationId,ruleRef,artifactRefs,publicationIds,taskId,requestId,reportId}`，不新增任务账本或重复版本事实。

CP-05必须把该case场景选择、账号/菜单/TestId、上述关联读回、借用DEV前端与本run browser的资源预算/profile/readiness/首败cleanup实现到唯一入口，并写完整argv。TER 场景只接受本轮明确设备序列及双屏形态，分别运行 console 与 wallpaper；不执行 Web/mobile/双机/双VM。后台本链 browser focused case 不由 TER driver 控制，不扩大为全部 Browser L2。case 尚未实现前均为**计划/NOT_RUN**，不得把计划参数当现有可执行命令。

### 15.3 模板完整性检查（作者映射，非独立结论）

逐项以implementation-design-template §0/1/2/3/3a/4/5/6/7/8/9a/9b/10/10b/11/11a/12/13/13b/13c/14与implementation-task-template第6/6b/6c/13c为输入；本详设对应同主题节（字段/隐藏机制在§5～8、附件§9/10；测试/seed在§10b/11/15；§13b/13c由§4＋计划§9/11落实）。审查必须逐槽核验真实内容，不能因此映射宣称全覆盖；缺行、未决数字/字段、不可执行观测、遗漏文件全集必须finding。全部PLANNED/NOT_RUN；规范要求先UI看图但Dexter本次允许完整候审设计，最终实施仍以看图/设计接受为门。

所有§3观察明确执行档：授权/事务/幂等/审计/并发/真实 bytes 使用 backend-acceptance 真实 HTTP/容器；后台 query/dirty/focus 使用组件 focused，用户操作使用本链受管 browser focused case；TER 在 CP 内做纯逻辑 focused，所有 CP/6b及整体验收准入完成后仅在本轮单机双屏真机执行；Expo Web/其他设备不运行。日志/生成/文件布局先静态再适用 focused。所有运行结论以执行后证据为准。

## 15.4 · 独立R1最小补全的唯一定位

附件§11是18 operation逐项输入/成功形状/errorSetRef＋augmentations/具名normal fixture及准确预期SQL拆分/调用与具名事务origin；数字是明确候审假设不是测量或预算例外，实施前核对现有context/security SQL后修正差异，不能减正确性。§12/13为每个输入和真实variant每fact；§14补全部V的具名B子断言或明确A/C N_A；§15为精确seed测试文件和写前锚点。本详设§4逐CP RECALL/比例门与§9a.1每事实全链同步同为实施必填，不以作者覆盖表替代fresh独立证伪。二进制content完全排除JSON TDC白名单，经全局canonical/edge→grant JSON descriptor→native输入传递。

## 17 · 标准审计与保存准入的最新差量

规则详情header菜单“操作历史”无需写cap，只需O-P真实PROJECT主对象读；启停菜单仍W-P。复用OperationsAuditHistoryModal与既有getOperationsEntityAuditHistory，新增TERMINAL_UPDATE_RULE closed type、封闭query路由、terminal-update owner审计TaskRead API、canonical/generated消费者和focused/red。CREATE/ENABLE/DISABLE在同REQUIRED写一次audit；同key回放不重复，授权/CAS拒绝不写。历史Modal的page/pageSize/total沿现有标准，操作人快照和字段前后值由标准审计返回，不重建审计model或日志。当页project/context变化关闭Modal、拒绝旧回包。

包保存资格精确绑定(file selection attempt,workspace/session,stageRef,parsed validated result,minFull selection)。`TerminalUpdateStageResult` 在同次解析成功响应中返回候选类型、应用/平台、原生/JS/runtime、publicationId、ZIP/APK摘要及 nullable minimumFull；UI展示这些只读事实供保存前核对，stageBindGrant不显示。上传或解析未成功、替换文件、过期、上下文变更、候选类型不匹配以及HOT候选五事实不符时PKG_SAVE禁用或提交被拦；upload/parse不自动保存。后台仍重验stage/ownership/签名/配对，不能以按钮资格作为业务防线。附件9.1唯一TestId、UI可见文案与L2源码同步，不复用旧file解析结果。

最新裁决会改变正式R-15及终端§4-F标准，本轮不写其正本。未来实施授权单列这两项来源同步，CP-01在生产消费前完成；A只对B影响的公开签名/报告投影做差量，不重做已MATCHED未受影响内容。所有新测试和cleanup均NOT_RUN。
