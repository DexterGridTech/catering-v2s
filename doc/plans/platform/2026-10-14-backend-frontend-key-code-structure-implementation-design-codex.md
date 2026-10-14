# 前后台重点代码结构优化 · implementation-facing 详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

## 0 · 输入、授权与设计状态

日期：2026-10-14。BUSINESS_SOURCE=`doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`，输入 SHA-256=`a22ecff163d12b6626f67a1e3a0b28ac3e097092e97cebb68213ab03aff8f193`。需求旧字节外部 NO-GO 与作者文字处置均不是当前独立 GO；Dexter 本次直接授权以修订需求写详设/计划并独立审查。

AUTHORIZED=本详设、计划、源码/交互与验证附件、独立审查及作者处置、给 Claude 的话术；Dexter 2026-10-14 选择 A，另授权同步正式需求 V-09/V-10/V-11/V-14 验证档位。IMPLEMENTATION_AUTHORITY=false。NOT_AUTHORIZED=源码/测试/生成器/fixture/seed/规范/记忆/依赖修改，生成、编译、构建、测试、verify、DEV、Web、设备、reset/seed、L2、UAT、部署。全部未来 proof/cleanup 为 NOT_RUN；UI/testId 当前静态材料不等于优化后用户行为通过。

配套文件：同目录 `2026-10-14-backend-frontend-key-code-structure-{implementation-plan,source-and-verification-appendix}-codex.md`。附件定义精确路径缩写、文件清单、十四 operation、逐动作表、case/fixture/control 面和依赖依据；是本详设的直接组成部分，不是新增规范或证据台账。

复用既有 Journey/IA/交互，不增页面或改变控件：更新与远控分别为 `doc/decisions/2026-10-07-ter-update-supply-and-version-report-{journey,ia,ui-interaction}-claude.md`、`2026-10-10-ter-remote-control-{journey,ia,ui-interaction}-claude.md`；组织/主体/门店/合同用 `2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` 的 REGION/PROJECT/ORG/BUSINESS/STORE/CONTRACT create/edit；平台只读用同日 IA03 的 ORG/CONTRACT overview/detail；销售菜单用 `2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md` 及 `2026-09-07-v2s-sales-menu-target-selection-availability-{journey-amendment,ia-amendment,interaction-design-codex}.md`。原任务、actor、范围、授权、查询与刷新事实保留。无新线框需裁定；若提取需要改变用户操作，停止该点交 Dexter，不能把源码当产品批准。

### 0.1 T1 静态 review 的有限影响（2026-10-14）

Dexter 本次授权只同步本设计包文档，不实施，也不打扰在途 T1。T1 的本轮源码 findings 是问题族入口，不能直接移植为前后台要求；以下判断来自本批真实消费者。原需求、Journey、CP 数量、路线 A、权限和验证档位均保持。

| T1 问题族 | 本批实际影响与最小处置 |
|---|---|
| 检查身份后再次 await；只换变量而已挂载 UI 仍持旧资源 | CP05已有六资源 guard 和受控 currentStart，不新建机制；§8.5补最终提交、已挂载工作区及旧 cleanup 的精确反例 |
| socket 已关闭便跳过 listener 释放；只等某个子 Promise | 本批没有 TER State 持久化队列，不引入 drain/通用资源管理器；远控只处理自己捕获的 Room、listener、keepalive 和现 end Promise，结束状态不能替代资源释放 |
| owner 判断、错误与策略第二真相 | 保留既有 launcher/feature 窄边界、ProblemOf、canonical typed problem及§8.6的有限策略整理；不搬 TER declarations、ParameterDefinition、凭证、错误类别或 HTTP 重试机制 |
| canonical 与 generated 消费漂移 | CP01写前重开当前 generator/renderContract/outputPaths；保留 T1 已有输出和导出，不用旧双目标快照覆盖在途修改；当前核查仍是两个目标，未来差异按§8.1处理 |
| 退出/流清理存在但未验证真实住址 | CP02在现 AssetService 测试分别断言图片与ZIP的自有临时文件及原异常原因；不新增上传 pipeline或极端归档专项 |
| TER HTTP/Runtime 修复影响现 Web Journey 前提 | CP06读取 T1 出口中的真实私有API→TDC→transport与driver接缝；未闭合只阻断依赖它的 W，不借本批修 TER、不恢复旧 runner，也不要求本批重跑 T1 矩阵 |

本补充是当前文档修订，不是独立 verdict；既有设计 review 只适用于其原审阅字节。本轮不重开已关闭 cycle，所有新增判据的实现和运行仍为 NOT_RUN。

### 0.2 当前源码适用性自审（2026-10-14）

Dexter 授权结合当前代码自审完整设计包、修订确认问题后准备实施话术。本次仅修改设计包及自审记录，不实施、不运行，不重开既有 DESIGN cycle；历史 verdict 与输入字节保持。结论与当前文件摘要见 `doc/review/platform/2026-10-14-backend-frontend-structure-current-source-self-audit-codex.md`。

当前仍需整改的真实接缝为 TDS 手写 topic 集、asset 两条物化循环、catalog 两处制作差异和同 owner 纯提取、菜单图标过滤、extension 数组/双 cast/内部引用、更新页六资源和远控双重 session 住址。没有因 T1 或 UAT 的在途改动而整体失去整改价值。当前 remote generator 仍是同 renderer 的两个目标；T1 的 `remote-control/application/readRemoteControlSignalConfiguration.ts` 已通过 server-config 公开能力解释 LiveKit 配置，TDC 公开 `executeTerminalHttpCommand`，两 integration 注入 `serverSpaces`。这里只确认源码接缝可定位，不宣布 T1 整批或本批 Web 已通过；实施写前继续读取当前值，不以历史 OPEN 无期限阻断，也不借本批改 TER 手写源码。

本次最小修订为：CP04 纳入三个现扩展列表的窄出口引用；将残留更新/远控 L2 表述统一为既定路线 A 的 F/W；在既定远控关闭 F 中明确并行 Promise 的拒绝观察。均属 R09/R10/R11/R17 已批准边界，无新业务、页面、HTTP operation、数据库、依赖或框架。尚需实现、解析与运行的项目继续 NOT_RUN/OPEN；后续实施权限只能来自 Dexter 转交的明确授权。

## 1 · 问题、用户任务与方案

### 1.1 实际目标

维护者修改协议合法值、提交转换或异步资源时，应只改其明确住址并能定位消费者；运营用户仍沿已批准的列表、详情、修改、查询及远控路径完成任务。不做会留下图标隐藏授权页、对象契约发送数组、重复纯规则及 Page 跨资源失效分散等常见维护风险。目标不是文件越多越好，也不是重做当前后台。

### 1.2 三个方案

| 方案 | 成本与结果 | 结论 |
|---|---|---|
| 全面搬 TER declarations/actor、每 service 新 facade/Bean、统一加载器 | 多层间接、改公开解析面、改变代理风险，不能解释现 owner | 拒绝 |
| 只改引用/cast/常量，不钉实际资源和消费者 | 可编译但双目标生成、seed、迟到回包和 HTTP 空值仍会漂移 | 拒绝 |
| 现 owner 内纯提取＋现 foundation 接入＋具名窄入口＋原子同步调用链 | 维护住址清楚，保留公开/事务/页面，只有真实重复才抽 | 采用 |

我选了第三项而不是前两项，因为它消除实际重复且保留现正常业务路径；不为极端输入、通用插件或未来模块付费。

## 2 · CP 总览（同一批原子交付）

| CP | 主题/owner | 主要输出 | 依赖 |
|---|---|---|---|
| CP-01 | 生产入口行为钉住、生成/TDS protocol owner | topicKeys 单源、远控 additive 双目标、生产链行为测试 | 当前 canonical、T1 输出位置读回 |
| CP-02 | asset/catalog owner 纯能力 | 一个流式循环、制作差异一处、纯校验/详情值组装 | CP01 MATCHED |
| CP-03 | App registration、feature 窄边界、状态呈现 | icon 回 registration；remote现能力及三组状态/gate/channel出口；局部状态映射 | CP02 MATCHED |
| CP-04 | extension-fields / edge / seed | 对象提交闭环、legacy retirement、HTTP fixture/seed 同步 | CP03 MATCHED |
| CP-05 | terminal-update / remote-control | 四个具名业务读取 hook、创建 Drawer、launcher 与 workspace 分工 | CP04 MATCHED；CP01 生成值 |
| CP-06 | 文档、验证控制面、唯一受管入口 | 三个隔离 L2 case＋现 update/remote Web 回归，日志/fixture/TestId 链 | CP05 MATCHED |

每 CP 内先钉行为再迁移。每个实际改点前后双读，proof 后回读同一原文；整个 CP 完成才 fresh 三维对账。CP 内不按文件另设审查关卡。动态 focused 若在 CP 内执行，先准备该真实链 TEST_CHAIN_PREFLIGHT；不用 CP 出口 MATCHED 反向卡住其自身 proof。全批 6b 是整体测试前另一检查，不用各 CP 的汇总替代。

## 3 · 横切机制（完整固定行集）

| 机制 | 现成能力/正本 | 可执行观察/档位 | 必须形态/反例 | 本批全集 |
|---|---|---|---|---|
| 读侧节点授权 | CBS 原 edge/session task-read；corpus G-05A | H 换同空间未授权节点仍拒绝；L2固定PROJECT授权菜单/宿主读回；可变节点竞态由F | 不由浏览器 URL/窄出口创造读 capability | catalog、十四扩展操作读回、更新页/远控、fixture |
| 写授权/grant 复核 | 原 owner scope grants，R-READ-03 | H stale/wrong-target receipt 不能重放写 | owner 复核先于 receipt；不移动 | catalog、extension host、规则/远控 |
| 跨 owner 写/事务 | 原 REQUIRED/TransactionTemplate | H CAS/中途拒绝无部分写，真实 readback | 新 pure helper 不持 JDBC/锁/receipt/owner API；asset IO 不入 DB 事务 | catalog、asset、extension host |
| 集合形态/分页 | charter §1-J、createCursorQueryIdentity/useCursorStack | F 迟到页丢弃；F六资源页身份＋W_CONTROLLED_UI历史明确跨页无重复，nextCursor/现total各按原契约 | 不将整体 definitions 聚合分页；不凭表格外观把Cursor改Page，不新增不存在的total | 规则/报告/门店/历史 Cursor、FULL/HOT candidates、catalog 既有读取 |
| 缓存失效/刷新 | operationsContentTabRefreshSignal、useRefreshVersion、现 RTK tags | F/L2/W 写后列表与已开详情更新、dirty 不被覆盖 | 保留一条现收口链；无第二全局刷新 | 更新列表/详情、扩展宿主、只改引用的 gate |
| RTK currentData/isFetching | frontend §3-B、useSalesMenuReadModel | F arg 切换不显示旧 scope 数据 | 固定会话 query .data 是反例，保留 | 十 Drawer 可变定义读取、候选、保留 SalesMenu read model |
| 同一事实一个住址 | frontend §3-E | F Page 不再镜像 hook 读回，hook不复制RTK缓存 | 命令式请求结果可由唯一hook持有；不能与query/cache再对齐一份 | 更新六读取资源、扩展纯值 |
| 失败可见/不改原因 | operationsProblemOf/platformProblemOf、原 owner Problem | F catch/finally不会抹错误，H code不变 | 留稿/留面；只精确 VERSION_CONFLICT走CAS | asset/catalog、extension、更新 mutation、remote launcher/workspace |
| owner→HTTP 映射/登记 | edge contract implementation/error disposition catalogs；现 advice | H 同 operation typed code/status 原样；附件 API 表 | 不新注册operation/error；数组拒绝走原非法输入映射 | catalog/asset/十四扩展，规则与远控 |
| 新 owner 审计三件套 | N/A：不新增owner/实体/操作 | H 原审计事实同事务且仍可读 | 不以提取增审计表或删除既有审计 | 全批 |
| 幂等键/重放 | createContentIdempotencyKey、原 receipt | F 相同意图重试键稳定；H 重放不第二写 | payload改为canonical对象后按实际payload派生；fixture不偷偷换键 | 上传、规则启停、扩展设值、catalog |
| 生成值消费 | Protocol loader / remote protocol generator | F canonical新增值派生到目标，未知值拒绝 | 双目标同renderer；合法集≠SQL权限 | TDS codec、Web parser，TER生成物只派生 |
| 日志/诊断 | observability-and-acceptance-standard §3，现 createSafeLogger/HTTP完成事件 | F error含关联；H/L2 首败能到源边界 | 不用 audit/status替日志，不造日志平台 | fixture→HTTP→edge→owner→readback、UI请求/回包/cleanup |
| migration/backfill | N/A：结构/现合法wire，不改DB | 静态无Flyway/schema变化；H现数据可读 | 不设计双写/兼容DB | 全批 |
| 前端共享行为 | asyncGeneration、useCursorStack、useDrawerFormLifecycle、drawerSurface、useOverlayLock | F 独立资源互不取消；门店/合同关面留稿由L2证明；更新/远控关闭与焦点由F/W，历史分页由F/W_CONTROLLED_UI证明 | 实际消费foundation；workspace特殊Room释放仍归remote | 更新四hook/Drawer、remote、十扩展Drawer |
| 管理后台一致性 | frontend §3-K 与上述原交互锚点 | F/L2/W 控件位置/文案/Tag/焦点不变 | 主数据常量不改任务/报告状态；现fallback详列§8.6 | 三个隔离L2case及更新/远控Web回归surface |
| candidates/dropdowns | useOrganizationCandidates、useCursorCandidates | FULL/HOT绑定候选由F/W；门店/合同现选择由L2证明 | 不重造候选查询/操作；内外scope不改 | RuleCreateDrawer、十Drawer现选项 |
| 编码/名称呈现 | formatNameCode/NameCodeText、现owner投影 | 更新详情由W、组织/合同宿主和菜单由L2核标题/字段为code/name，不裸UUID | 如当前合法别名则保持，不跨域统一 | 更新详情、组织/合同宿主、菜单 |
| 原子组 | charter §5-C | F 编译/生成check＋具体红反例 | 全调用者/测试/fixture同步，不让下一CP修旧形状 | 双目标生成；catalog纯提取调用者；extension全链；窄出口；更新hook迁移 |

第三方版本/官方依据见附件§6。仅复用当前 API；不新增依赖/React模式、Spring代理或LiveKit操作。Java classpath解析当前未运行，不把Boot声明当Spring解析事实；实施 CP01 必须用受管 classpath输出确认。若要改变事务/SDK调用形态，必须先更新设计和相应官方依据，不能先编码猜。

## 3a · UI/TestId 前置与 L2 控制面

UI_DESIGN_REVIEW=OPEN（当前已批准交互仅作复用输入）；TESTID_REVIEW=OPEN；L2_SCRIPT_ADMISSION=BLOCKED。附件§4给每个 case/action→fixture→现控件→唯一TestIds→真实动作节点→binding→focused→fresh review→OPEN 的逐动作表；§5枚举所有拟改控制面。没有当前独立节点/控件/日志闭包，不能编写或执行 locator/spec。

Dexter 2026-10-14 选择 A：隔离 admin-ui suite 只保留 admin.menu.registry、extensionForms.store.delta、extensionForms.contract.delta。在现 browser-l2-runtime 的 suite/admission/owner HTTP fixture/Playwright/run/cleanup 接缝扩展，不新增 runner。删除此前隔离 TDS、wire 新模式、报告 credential fixture、工件到 L2 交接；本机不新增 TDS 节点 tunnel，现受管 DEV Journey 只用原两个 HAProxy 入口。

更新页与远控使用现 tools/terminal-automation 的 update.owner-flow（Web/mobile）及 remote.main（Web/mobile-single，对应 remote.web.test.ts），两个 sample 都回归。W=受管 DEV Web Journey，不能写成隔离 L2。附件 §4 分开列 actions/TestIds/oracle/fixture；四 hooks 的六资源竞态、dirty、CAS、迟到 session、全部状态 fallback 仍是 F 义务。

现 update 的历史翻页只在 task 不在当前页时执行，不能当确定分页证明；按附件 §4a 补明确 next/previous/refresh 与同terminal/cursor身份断言（W_CONTROLLED_UI，只读响应fixture，非CBS持久化分页证明），不新增报告 credential 或在线 producer。现 remote Web 接真实 LiveKit Room、synthetic canvas track，不是 Android capture/input proof；只在现路径补开始→结束→重新发起及焦点/同 session 释放回归，资源竞态仍在原 focused mock Room 接缝。不扩媒体、设备矩阵或 LiveKit 部署。全部等待未来授权运行。

## 4 · CP 门控

| CP | 可证伪失败形状 | 不变量/FORBID | 比例proof及理由 | RECALL |
|---|---|---|---|---|
| 01 | Codec仍有手写topic集；Web仍手写reason；只更新一个generated目标 | canonical同源，保留所有帧校验/typed拒绝；TER手写不改 | 真实Protocol/Codec及parser/生成器F；无需设备 | R03/04；canonical；T1 current outputPaths；相关loader/codec/parser/tests |
| 02 | 两个asset流式循环；制作差异仍重复；newpure持有JDBC/owner API | facade/FQCN/构造/tx/锁/readback不改；不搬detail IO或promotion Bean | 原真实服务/PG fixture＋纯值F，原H全量最后做 | R05/06/07/14；R-READ01–10；三个owner源及调用者 |
| 03 | icon仍过滤菜单；十一deep imports或type-only越界；foundation改局部文案 | 窄入口只导出实际消费者；现状态分支保留 | 注册/consumer类型/状态行为F；不新建空index/registry | D01/02；R08/09/13；当前registry/consumer/lifecycleLabel |
| 04 | 十Drawer仍cast数组；seed/HTTP fixture仍发送legacy却删mapper；三个列表仍deep import extension-fields | 对象SET/CLEAR/omission一致，typed owner list保持；表单/列表消费者同走窄出口，不造兼容层 | F全调用者＋H代表原域case；同步seed只改不运行 | R09/12；mapper/owner；十四operation及三个列表；seed helper/测试/父计划 |
| 05 | hook包一层却保留counter双实现；宿主仍start/end；回包写旧target | 分资源guard；当前context/entity/page fence；创建dirty/幂等和远控身份保持 | deferred响应与Room关闭行为F；现update/remote W在全CP后，不增加这两个feature的隔离L2 | R10/11；既有IA/interaction；Page/workspace/foundation |
| 06 | spec引用无testId或旧runner不可执行；fakeONLINE；首败仅status | 全控件/fixture/日志/cleanup闭合；不新runner；不擅自运行 | static控制面红例＋授权后H/L2/W；本CP不提前声称动态PASS | R15–17；模板§3a/6c；L2正本/唯一runner/seed与资源门 |

## 5 · HTTP/face/集合（无新 operation）

附件§2列十四扩展 operation 及继承schema；owner/edge公开方法保持。重点read/control如下；精确method/path以当前 canonical operation解析结果为准，附件给读取来源，不能猜URL或手改generated。

| 意图 | operationId | face与现集合形态/增长 | 边界 |
|---|---|---|---|
| 规则/报告列表 | getOperationsProjectTerminalUpdateRulePage / getOperationsProjectTerminalVersionPage | operations-admin；Cursor，limit=50，随规则/终端增长 | 当前请求cursor/limit和nextCursor保持，不能变更既有分页 |
| 规则详情与门店 | getOperationsProjectTerminalUpdateRuleDetail / getOperationsProjectTerminalUpdateRuleStorePage | operations-admin；单详情＋独立Cursor，门店可过页 | 详情identity与page identity分开 |
| 版本详情与历史 | getOperationsProjectTerminalVersionDetail / getOperationsProjectTerminalUpdateReportHistoryPage | operations-admin；单详情＋独立Cursor，history limit=20，任务历史无定额 | history按同一terminal/binding/scope事实 |
| 规则创建/启停 | createOperationsProjectTerminalUpdateRule / changeOperationsProjectTerminalUpdateRuleStatus | operations-admin；单对象mutation | 原revision/CAS/receipt/readback不变 |
| 远控 | startOperationsTerminalRemoteControl / endOperationsTerminalRemoteControl / getOperationsTerminalRemoteControl / issueOperationsRemoteControlGrant | operations-admin；单session | 同账号requestId、target/context；无新权限 |
| 扩展宿主create/update | 附件十四精确operation | operations-admin；Detail聚合，不加上限/分页 | 仅从已支持legacy输入迁到canonical对象 |

本表不新增operation，以附件静态catalog提取为最终完整值表。读权限仍是session/页面/owner范围，写capability只用于既有写operation。平台scope/capability保持平台super-admin规则，不混用运营授权。

## 6 · 跨 owner 事务保护

| 现路径 | owner事实/命令与调用顺序 | 本批处置 | rollback观察 |
|---|---|---|---|
| catalog save | 原scope/授权→引用与纯规则→receipt→save/关联replace→audit→readback/receipt | 不搬调用顺序/注解；pure方法只接受已读值 | H stale版本/引用错误无关联部分写、重放不重复 |
| promotion self-call | CatalogItemService.executeTemporaryCatalogItemPromotion→executeTemporaryCatalogItemPromotionWithProjection，原@Transactional同路径 | RETAIN，不拆Bean | 原promotion场景重放/失败readback |
| asset stage | 无外层事务→object IO→TransactionTemplate metadata→失败对象cleanup→finally tempfile | 只归并temp stream，两wrapper校验保持 | F存储/读取失败文件释放；H实际asset引用/readback |
| extension host | 原host owner grant/状态/CAS→extension公开API→宿主权威readback/audit | edge只解码；typed owner list不改 | H required/disabled/CLEAR/重放及拒绝无写 |

## 7 · 声明—传递—消费

| fact/机制 | 声明 | 传递 | 消费/proof |
|---|---|---|---|
| topic合法值 | protocol JSON topicKeys | Protocol不可变Set | Codec；F全集/unknown，session SQL独立保留 |
| remote body enum字段 | canonical六个enum字段 | 原generator相同runtime arrays/types到双目标 | Web parser；TERconsumer保留；F非法reason/seq/bytes |
| extension JSON | 现schema对象＋Form值 | enabled/DATE/changed-only→object SET或null CLEAR→edge toSubmission | owner typed SET/CLEAR；F十Drawer/H真实读回 |
| 当前资源identity | 宿主queryContext/target/entity及Cursor栈 | 各hook foundation guard，开始前capture，成功/error/finally都核当前 | UI不会迟到覆盖；F deferred覆盖context/entity/cursor/close，W验证现主流程；本批不新增动态范围切换case |
| 集合形态 | 现IA与canonical | 原page/cursor/filter参数完全传递 | hook不slice；total/Cursor来自owner；F＋W历史过页 |
| 授权执行点 | 既有contract页面/写policy | edge原scope grant/owner first recheck | 不搬到Page/launcher；H wrongscope/stale replay |
| 刷新 | 原RTK失效＋当前页refresh signal | hook接useRefreshVersion、mutation原一次收口 | 当前列表与开详情重读，dirty保持；F/L2/W |
| 错误 | 原owner typed code及canonical error set | 原advice/generated/ProblemOf | 原位错误、不把all409当CAS；F/H/L2 |
| 日志 | 现run/request/context/session身份 | UI dispatch/settle，HTTP completion，owner异常原信息，fixture/readback | run log定位firstFailure；manifest只身份/结果，不复制正文 |

## 8 · 要求到判定点与实现形态

| R | 判定点/具体住址 |
|---|---|
| R01/02 | 原owner/edge/公开构造/事务保留；§6/附件文件表 |
| R03 | §8.1 Protocol→Codec |
| R04 | §8.1双目标generator/Web parser |
| R05 | §8.2 asset两wrapper＋唯一stream方法 |
| R06/07 | §8.3 catalog pure＋原facade/tx；B4/B5 RETAIN |
| R08/09 | §8.4 registry与五组窄入口 |
| R10/11 | §8.5资源hook/remote launcher/workspace |
| R12 | §8.7 extension对象/edge/seed |
| R13/14 | §8.6局部标签/策略；各owner限值与无状态多实例保留 |
| R15/16/17 | §9a/11a/13与计划同步文档、前置及交付 |

### 8.1 Protocol 和生成物

Protocol 新 `private final Set<String> topicKeys`；复用 readUniqueTextArray 并拒绝空集，公开不可变 `topicKeys()`。Codec删除 TOPIC_KEYS，topicKey/requireTopicKey由static改实例消费Protocol。schema集只定义合法key，不动binding门店分类、SQL路由或负载边界。
remote generator遍历 messages[*].body.fields 中每个 enum，按 message type＋field name 派生 readonly as const 数组，复用现 validation/render/typeName，不按相同值集合合并。当前六字段及 export 为 SCREEN_READY.screen→remoteControlScreenReadyScreenValues、POINTER.screen→remoteControlPointerScreenValues、POINTER.phase→remoteControlPointerPhaseValues、INPUT_RESULT.status→remoteControlInputResultStatusValues、INPUT_RESULT.reason→remoteControlInputResultReasonValues、SESSION_END.reason→remoteControlSessionEndReasonValues。未来新增 enum 字段沿同一算法派生，不另建 registry。
“双目标”是当前 outputPaths 的截面，不是另写一份输出名单或长期冻结目标数量。CP01先读取原 generator 及对应测试的当前输入/输出：T1若已增加同源 adapter 私有生成目标或合法导出，原样保留，不能用旧 renderer/测试预期覆盖；本批新增 enum 数组仍由同一 renderer additive 派生。若新目标具有不同格式或超出正式需求 R04 的派生修改边界，则该生成点为 OPEN，先明确授权/设计差异，不能自行分目标渲染或改 TER 手写消费者。本轮当前源码尚无该新增目标，不将其写成已存在能力。
Web parseMessage移到feature/model/parseRemoteControlMessage，消费全部六组；成员判定先 typeof value === 'string'，不以 String(value) 把数组/对象转换成合法枚举。INPUT_RESULT.reason 的 null 显式接受，缺字段/undefined拒绝，null不进字符串数组；cancel可同时省略u/v，其他phase须两项finite且[0,1]，cancel带两项合法坐标的当前parser行为也保持，本批不改控制协议业务。保留record/UUID/seq/bytes/endpoint/screen/gesture/forSeq及participant关联。双目标一致，canonical不新增值，只新增export，不手改TER消费者。F从 canonical 六字段各变异一个合法值并经 producer 派生，核双目标/consumer；另测未知、非字符串、nullable及cancel坐标，不手改generated冒充consumer证明。

### 8.2 asset

只在 PlatformAssetService 内新增 private `materializeStream(source, maximumBytes, prefixCapacity, temporaryPrefix, temporarySuffix)` 与 private结果record(path,size,sha256,prefix,prefixLength)。真正read/limit/prefix/digest/write/close循环只剩一份；两个wrapper各传原限值/前缀并做原ZIP签名或图片magic/decode/declared size验证，失败都删自身temp。正常返回临时文件仍由原stage finally拥有。IOException→原AssetStorageUnavailableException带cause；输入失败→原AssetInputInvalidException。公共video仍拒绝，保留底层video magic反例不当合法上传；无新算法/恶意ZIP专项。
现 PlatformAssetServiceTest 的 temporaryAssetUploads 只查图片前缀；提取后测试必须通过原公共 wrapper 分别核图片与ZIP的自有前缀，不能把图片扫描无残留当ZIP清理证明。用正常小输入及可控读取/对象存储/metadata失败，断言流关闭、自有temp删除和原typed异常/cause保持；合法成功流仍由既有调用者清理。不扫描或删除未知临时文件，不加新的资源账本；诊断复用原 owner logger/异常链。

### 8.3 catalog

CatalogOwnerValueSupport 新 package-private skuPreparationDiffers(JsonNode sections, JsonNode itemProfile)；保留item MissingNode与null不同、SKU missing/null归null、非数组false、totalCount外层判定、list/detail读取范围不同。两Service删重复body。
CatalogItemDraftValidator 为package-private纯值类：迁入 validateSkuCombinations、validateClientDerivedFields/validateDerivedText/capabilityJson、identifierAllowed/preparationAllowed；输入原ArrayNode/ObjectNode/ShapeRule/ObjectMapper，不持 Facts/JDBC/owner command/事务。原 validateIdentificationAndPreparation 继续编排已有低层profile/identifier校验与新shape predicates；required/错误code与顺序不变，不复制低层规则。
CatalogItemDetailAssembler 为package-private纯值类，接收mapper/manifest和值：内部 ItemFacts(ref,code,name,shortName,shapeKey,status,version,updatedAt,sourceScopeRef)，已hydrate sections、dataNodeRef/brandRef、unitDefinitions、inboundBySku、resolvedCompositeGroups。sourceScopeRef来自现ItemRow的已读字段，不新增查询；sourceFact保留AUTO_SYNC优先、TEMPORARY/EXTERNAL_ORDER_TEMPORARY次之、其余按sourceScopeRef为空/非空区分SELF_MANAGED/COPIED。内部InboundReference为现private SkuInboundReference四字段的值投影，service只做值转换，不新增查询。迁入 itemDetail、skuRows、setStoredUnitAssignment、derivedSkuFacts、skuVariantDimensions及其纯值闭包（specificationFacts、preparationFacts/skuPreparationFacts、sourceFact、externalIdentityFact、必要JSON copy/null helpers）；原service其他调用这些helpers处委托同一实现，不复制。纯闭包实际调用清单在写前回读，出现IO的helper留原owner并传已读结果，不能把可达IO伪装pure。原detail读取/production tag/inventory、引用、锁、promotion、自构造及所有公开类型/签名保持。V06必须用相同sections、不同sourceScopeRef钉住两种结果；Workbench同根来源判定仍保留，不增第二次查询。

### 8.4 registration/feature入口

Registration增必填icon:ReactNode，在现每个registration声明该icon；删除Shell menuIconByKey及其filter。成员取catalog∩实际registration∩session.pageAccessKeys，排序仍menuOrder；缺注册/授权不进入。分组navigationIconByKey是另一个呈现事实，保持。registered未知key不以默认icon伪装。
最终五个现feature的index仅导出实际消费者：remote-control的launcher/workspace/Target、extension-fields纯提交能力及现有extensionListAndSearchColumns/extensionQueryValues、organizationStatus的label/toggle、storeOperatingRuleGate的hook/type、businessChannel access/order labels。阶段顺序固定：CP03只export已存在的remote workspace/Target/UUID与三组既有能力；CP04实际新增纯提交能力时才建extension-fields出口，同时将BusinessEntityManagementPage、StoreManagementPage、ContractManagementPage对extension-fields/model/extensionList的引用改为该窄入口；CP05新增launcher时才补remote出口。列表列/搜索转换仍由现extensionList.tsx实现，查询、排序和业务owner不迁移；orderedExtensionFields没有外部消费者，继续内部使用。不得前向export尚未存在文件或建空实现为CP03编译占位。消费者见附件；audit-history现入口不改，不把HTTP执行器复制到feature。

### 8.5 Page与远控

四hook为 useTerminalUpdateRules、useTerminalUpdateRuleDetail、useTerminalUpdateReports、useTerminalUpdateReportDetail；详情hook各拥有自己的门店/历史分页，但detail与page分别有guard。每resource开始前capture(queryContext identity,entityRef,cursor/filter identity,generation)，success/error/finally都核同身份；context/close/unmount主动invalidate，loadingRef在原page guard下释放。分别消费foundation，不新增泛型loadResource或第二counter。Page只消费读回/动作，不再持同一结果副本。
身份检查须紧邻最终状态提交；检查后若还有 await，恢复后再以同一 guard 与当前业务身份复核，不能把 earlier check 当整段有效。覆盖结果、problem、loading及loadingRef和关闭回调；旧 finally只能释放属于自己的在途标记。useAsyncGenerationGuard仅自动处理unmount，不替业务方判定context/entity/cursor变化，也不承诺取消网络。F在本节既定测试文件中补“首次检查通过→后续await挂起→切换/关闭→迟到成功、拒绝与finally”的生产hook反例，不增加测试框架。
RuleCreateDrawer独立文件，搬原lifecycle/幂等/FULL-HOT候选两个独立effect及对选中FULL的绑定，不重新设计表单。规则mutation保留原version/intent/重入锁/CAS准确code和权威readback。
remote useRemoteControlLauncher是currentSession身份的唯一owner，拥有start/restart/closeStaleRemoteStart；start捕获target/context/session-generation，迟到仅end该返回session；关闭/unmount不得清掉新session。Workspace的initialStart改为受控currentStart prop，删除useState(initialStart)/setCurrentStart及restart时写入第二份身份；onRestart只请求launcher更新，prop变化驱动Room effect释放旧资源并建立新资源。Workspace继续统一Room/track/gesture/keepalive/listener/disconnect及description/phase等本次连接的临时呈现值；不将特殊资源清理抽成通用hook，不新增第二会话状态机。每个异步end/cleanup捕获其原sessionId，A迟到不得end或清除新B；launcher提供宿主受控open/currentSession/target与动作，workspace结束反馈经同一关闭链，CBS end幂等；宿主保留资格target与焦点。V11覆盖A→restart B→A迟到结束。不得把同一结束路径在宿主和launcher再实现两遍。
远控清理将“释放旧资源”与“提交当前UI反馈”分开：前者只作用于闭包捕获的旧session/Room/listener/keepalive，CBS end拒绝、会话已ended或身份失效都不能跳过它；后者在最后一次disconnect/end等待后仍须检查是否为当前session。旧A完成不能改B的phase/problem/loading、清空B tracks或调用已指向B的finish/onClose。正常finishSession当前已有disconnect finally移除listener，保持该能力；effect cleanup同步失效和detach，异步disconnect显式处理，不把void Promise或ended标签写成释放完成。F必须保持同一Workspace挂载，仅改变currentStart为B，再交错A的disconnect/end成功或拒绝，核B继续可用及A的精确释放；不能靠卸载重挂掩盖接缝。
end与disconnect可以沿现流程并行，但各自启动时即安装拒绝观察，不能先启动endRequest、等disconnect后才接catch。两项结果分别记录，不能为避免拒绝而串行等HTTP成功才释放Room。既定F增加“end先拒绝、disconnect随后完成或拒绝”的交错，核无未处理拒绝、A资源仍释放且B反馈不受影响；仅使用现Promise/日志/身份闭包，不增加队列或恢复框架。
PlatformReadPage现两个正确foundation guard和SalesMenu现read model RETAIN；本批只改SalesMenu的跨feature引用，不重写其表单effect或RTK数据。

### 8.6 状态与策略

terminalUpdateLifecyclePresentation提供具名ruleTableLabel/color、ruleDetailLabel、ruleStoreLabel，已知值引用LIFECYCLE_LABELS/COLORS；规则列表非ENABLED→停用/warning，详情未知→状态未知；门店UNKNOWN→未知、VOIDED→已作废、DISABLED→停用、其余→启用。保留现异常fallback不证明owner状态；不改foundation生命周期helper，也不套报告/remote状态。可调策略只有实际同一owner/同一用途重复才归一；本次不新参数目录。asset四种限值、协议max bytes与算法0/1是反例。Catalog无状态Facts多个实例不重构依赖容器。

### 8.7 extension

extension-fields/model/extensionFormValues整合现enabled/hydrate/delta/detail纯规则，复用formatTypedExtensionValue及现有列表排序能力；十Drawer用同一pure筛选，不留六份同语义filter/sort。表单沿现displayOrder稳定排序（同序值保留输入顺序）；列表/搜索沿orderedExtensionFields/orderTypedExtensionFields的displayOrder再key排序。这是两种已有呈现语义，不能为复用一个排序函数改变表单顺序；共享enabled过滤，两个具名排序出口各保留原规则。F用相同displayOrder、不同输入key顺序验证差异。serialize返回实际Record<string,JsonValue>：规范化后新值undefined/null/''，有原值→key:null，无原值→omit；false/0保留；相同值omit；空对象{}。不从服务端读取值推导新的业务动作。required最终复核由原owner，DATE仍YYYY-MM-DD。
删除organizationExtensionValues和双cast；OrganizationExtensionFields保留宿主定义query/渲染但不再作为跨feature纯规则出口。schema/generator不改。平台集团初始化和服务点的对象/整体提交是反例，保留其宿主语义，不机械套delta。
同CP将seed extensionSubmission改为真实对象，七个create不再array；保持existing null/undefined→omission与真实fixture值，SERVICE_POINT已object保留。迁移所有已识别array acceptance/mapper测试后，全文扫描 frontend/scripts/tools/host tests，若还有具名实际生产arraycaller先同步，才删除mapper array/legacy helper；不将fixture当永久兼容理由，不改owner ExtensionSubmission typed list。数组成为现schema非法形状，按原edge非法输入映射拒绝；不得更改publicerror身份。

## 9 · owner API/消费者

精确调用者与文件在附件§1/2。所有新pure方法都有现service或十Drawer实际消费者，新hook由当前Page消费，launcher由更新Page消费，parser由workspace消费，测试不是唯一调用者；出现零生产调用者的新代码即删。原owner public APIs、constructor、Record FQCN及edge operation保持，原Facade不双持业务实现。Catalog tabs与IAM应用嵌套类型移位明确延后。

## 9a · 全链原子同步清单

| 变更事实 | canonical/生成物 | owner/edge | frontend | proof | fixture/seed | 处置 |
|---|---|---|---|---|---|---|
| topic合法集 | protocol JSON保留、resource原processResources | Protocol/Codec；session/repository保持 | N/A，不改TDC | 两protocol tests＋现TDS contract | 原topic fixture | 同CP |
| remote合法枚举 | 原generator→双目标additive | CBS/TDS协议消费保持 | parser/workspace | generator/parser tests | 合法/非法message values | 同CP；TERhandwritten反例 |
| asset流 | schema不变 | AssetService两个wrapper | upload消费者保持 | 真service stream/close/temp tests | 原PNG/PK fixtures | 不新增seed事实 |
| catalog纯规则/组装 | shape manifest/DTO保留 | Item/Workbench/ValueSupport/newpure | catalog consumers保持 | pure＋realCategory PG fixture＋现CatalogAcceptance | 原catalog seed、shape fixture保持 | 不搬IO或tabs |
| extension对象 | canonical/generated保持 | mapper/host owner typed list保持 | 十Drawer＋纯helper/入口 | mapper/fields tests＋ExtensionAcceptance及所有依赖域fixtures | owner-command-seed-executor/helper/static tests | array适配与调用者原子退出 |
| 菜单/窄出口/状态 | adminCatalog保留 | 权限owner保持 | registry/Shell/五index/十一引用/状态mapper | public-entry/menu/state/consumer tests | 原角色、规则fixture | 无新权限 |
| Page/remote资源 | HTTP/remotecontract不变 | 原session/CAS/report owner | 四hook/Drawer/launcher/workspace | deferred/Room/component tests | 原report/rule target facts | 无第二事实副本 |
| UI验证控制面 | 附件§5政策/producer＋现Web Journey | L2只原隔离CBS/DB/asset；W用现DEV/HAProxy/LiveKit | 三L2case＋update/remote Web真实节点 | admission/fixture/red及现Journey helper focused | 隔离owner HTTP与DEV既有fixture分开 | CP06同组；准入仍BLOCKED，无隔离TDS |
| 文档/日志 | source pointers/README | 原logger/HTTP completion | 原safe logger/action settle | TEST_CHAIN_PREFLIGHT | manifest资源所有权 | 不新增规范正文 |

## 9b · 定位

用附件§1符号锚点定位，不以行号定位编辑。每个写前实际查该符号在目标文件唯一；移动后引用锚点改到新定义。附件中的source截面是导航，不声称已实施或全仓逐行审计。

## 10 · 数据迁移

NOT_APPLICABLE_WITH_REASON：无DB/schema/持久事实格式变更；HTTP array适配退休不是持久数据迁移。原已持久化extension value与receipt保留；不能清数据库规避兼容事实。

## 10b · seed

### 10b.1–10b.4
唯一会变非法的seed写法在 scripts/dev/owner-command-seed-executor.mjs 的extensionSubmission七个调用；同步其test.mjs断言为真实object。r5-seed-plan、完整fixture contract、父r5-complete-seed-executor当前已存object值，保留counts/角色/业务身份；SERVICE_POINT object反例保留。当前不增新数据/状态，也不改群组capability或项目角色。静态验证对象/false/0/DATE/omission与readback仍同值，不用次数正则代替行为。

### 10b.5–10b.6
本轮不执行seed/reset/start。未来首次L2、reset或seed之前，均必须取得当前字节完整seed dry-run PASS，唯一公开入口为R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<本次工件源runId> scripts/dev/seed --profile r5-full --dry-run，由其委托r5-complete-seed-executor，连同全部CP、6b及控制面准入形成模板6c四项进入条件；不能将此义务缩成“只有reset才需”。dry-run不是实际reset/seed：后两者仍须Dexter明确授权与受管前置。这不是实施默认授权。完整seed仍empty-DB、冲突fail，不新恢复。新L2 fixture用隔离owner HTTP创建，不能借DEVseed运行身份；角色/账号具名见附件§4，秘密只run注入。父报告保留现首败、counts；seed helper修改不新增计数key。完整dry-run只验证计划/准入，不执行 owner-command-seed-executor 的七请求；对象化只有拟定 helper F，真实 seed 对象提交/持久化为 L3/NOT_RUN，须获实际 seed 授权后证明。工件只供dry-run，不传给L2 fixture；由现source owner身份管理导出与cleanup，不新增交接账本。

## 11 · 可执行场景与最低证明层

附件§3/4给identity/fixture/request/businessOracle完整四要素。F覆盖Production class/pure/component/async真实接缝；test fake Room只证明Web资源关闭，不声称原生/媒体行为。H在正确现域AcceptanceScenarios扩展，归backend-acceptance真实HTTP/PG/asset；实际变更的extension对象SET/CLEAR/omission/重放及asset/catalog对应HTTP接缝，必须先受影响focused H的BUSINESS与cleanup PASS，再进入对应L2。不能以F或后来全量H替代此顺序。全部生产/测试改动完成后最终全量backend-acceptance仍是独立义务。L2在唯一隔离runner，仅三个case；W在现terminal-automation，依赖受管DEV及既有fixture，不冒称隔离L2。业务和cleanup分开。

### 11a · 每条验收的具体落点

路径缩写完整展开见附件§1；“新增”均待实施，不代表已存在。

| V | 场景/断言 | 档位 | 具体文件 |
|---|---|---|---|
| V01 | facade/tx/CAS/receipt/readback保持；B4/B5未偷渡 | F/H＋源码 | CAT test CatalogCategoryOwnerIntegrationTest.java；CBS acceptance/CatalogAcceptanceScenarios.java；附件§1保护清单 |
| V02 | topic.canonical-codec 全key与unknown、binding/read源分开 | F/H | TDS protocol/TerminalConnectionProtocolTest.java、TerminalConnectionFrameCodecTest.java；CBS acceptance/TerminalConnectionContractScenarios.java |
| V03 | remote.protocol-values 双目标/非法消息仍拒绝 | F | scripts/test/terminal-remote-control-protocol.test.mjs；新增OPS remote-control/model/parseRemoteControlMessage.test.ts |
| V04 | asset.materialization 两用途stream/limit/digest/cleanup，video公共拒绝 | F/H | ASSET test PlatformAssetServiceTest.java；CBS acceptance/AssetAcceptanceScenarios.java、TerminalUpdateAcceptanceScenarios.java、CatalogAcceptanceScenarios.java |
| V05 | catalog.preparation-diff null/missing/skuSubset/totalCount不变 | F/H | 新增CAT test CatalogOwnerValueSupportTest.java；现CatalogCategoryOwnerIntegrationTest.java/CatalogAcceptanceScenarios.java |
| V06 | catalog.pure-extraction 真service校验/readback/tx保持 | F/H | 新增CAT test CatalogItemDraftValidatorTest.java、CatalogItemDetailAssemblerTest.java；现CatalogCategoryOwnerIntegrationTest.java/CatalogAcceptanceScenarios.java |
| V07 | menu.registered-access 图标不决定成员/未授权不可达 | F/L2 | 新增OPS app/routing/pageRegistry.test.tsx；OPS tests/l2/admin-ui.spec.ts（新增） |
| V08 | feature.public-consumers 三组十一引用/type-only、remote/extension调用者及三个业务列表均走窄入口，无deep import | F/静态 | OPS tests/architecture/public-entry-boundary.test.mjs；各十四request tests/类型；现OPS extension-fields/model/extensionList.test.ts；附件消费表 |
| V09 | update.resource-fences 六资源迟到/error/finally不串 | F/W | 新增OPS terminal-update/model/terminalUpdateReadModels.test.tsx；现tools/terminal-automation/journeys/update.test.ts、terminalUpdateSupplyUi.ts（补跨页） |
| V10 | update.cursor-dirty 切详情/过页/刷新/留稿 | F/W | 上项readModels test、新增ui/RuleCreateDrawer.test.tsx；现tools/terminal-automation/journeys/update.test.ts、terminalUpdateSupplyUi.ts |
| V11 | remote.launcher-identity start/reject/late/restart/end/session精确关闭 | F/W | 新增OPS remote-control/model/useRemoteControlLauncher.test.tsx、ui/RemoteControlWorkspace.test.tsx；现tools/terminal-automation/journeys/remote.web.test.ts（补restart/焦点/释放） |
| V12 | extension.object-submission 十四requests＋SET/CLEAR实际持久化 | F/H | 新增OPS extension-fields/model/extensionFormValues.test.ts、extensionRequestAdapters.test.tsx；CBS edge/extension/ExtensionSubmissionWireMapperTest.java、acceptance/ExtensionAcceptanceScenarios.java |
| V13 | extension.omission-idempotency required/disabled/未变/重放/legacy退出 | F/H | 上项真实HTTP文件；scripts/dev/owner-command-seed-executor.test.mjs；附件列全部legacy fixtures |
| V14 | update.lifecycle-presentation 两domain各fallback/色彩保留 | F/W | 新增OPS terminal-update/model/terminalUpdateLifecyclePresentation.test.ts；现tools/terminal-automation/journeys/update.test.ts、terminalUpdateSupplyUi.ts |
| V15 | strategy-and-construction 同策略single source/合法差异保留 | F/源码 | PlatformAssetServiceTest.java、CatalogInventoryDisplayFactsTest.java、CatalogCategoryOwnerIntegrationTest.java；附件策略反例 |
| V16 | source-boundaries/readme/generation/red-consumer一致 | F/源码 | scripts/test/terminal-remote-control-protocol.test.mjs、OPS tests/architecture/public-entry-boundary.test.mjs；新增scripts/test/admin-ui-l2-p1.test.mjs |
| V17 | design.traceability 所有family/目标/具体proof与CP闭合 | 静态 | 本设计§4/8/9a/11a及附件§1–5、实施计划；独立DESIGN报告 |
| V18 | test-chain/admission/run/cleanup 先日志/两轮再动态 | F/H/L2/W＋源码 | scripts/test/browser-l2-runtime.test.mjs、拟新admin-ui-l2 fixture/admission tests；现terminal-automation helper tests；现r5-remote-testcontainers.test.mjs；计划§8–10 |

## 12 · 未决/依赖与不得猜的事项

| 输入 | 当前状态 | 允许/禁止 |
|---|---|---|
| T1生成输出位置 | current path已读，最终出口待实施前读回 | 跟随原generator目标；不并行改TER手写或另写renderer |
| T1共享生成器/driver与W依赖接缝 | 当前源码可定位，修复后出口仍待读回 | CP01只改已授权additive生成；CP06的W以实际T1出口为前提，未闭合不回退旧API/runner，不扩大本批TER修复范围 |
| 当前Java解析图 | 未运行，不把Boot声明当classpath | CP01用受管输出确认；pure提取不新增代理/第三方行为 |
| 三case L2 / 现Web Journey补强 | 尚未实施/修改 | 按附件原runner接线；L2不借DEV，W不冒称隔离L2，无新TDS接缝 |
| 需求修订新字节外部结论 | 作者处置，独立复核PENDING | 本批审查同时对照修订需求，不继承旧SHA GO |
| 验证路线裁定 | Dexter已选择A，正式V档位同步 | 只改证明路径，不改产品/Journey/权限，不授权当前动态 |

## 13 · 动态准备、停机、交付

日志链固定为唯一入口→隔离fixture身份/角色→UI动作和HTTP→edge授权/mapper→owner规则/事务/资源→异步结果/权威readback→oracle→资源cleanup。每边界至少run/request/operation/fixtureRef/context/session（适用）、阶段、错误message/stack与日志位置；业务日志使用原owner约束，runner原始诊断按当前规范保留。无新日志先诊断，不延timeout盲重跑。
本批原异常保护复用CBS `src/test/java/edge/problem/CatalogInventoryScopeProblemLoggingTest.java#directTypedOwnerProblemWithoutNestedCauseStillLogsItsOwnStack`；无nested cause的typed拒绝也要保留自身stack，HTTP code/status/body不变，不把后台错误套成TER SYSTEM。动态前只核本批实际触达的原日志边界：`src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java#logAssetStorageFailure`及规则known failure handlers、asset `PlatformAssetService#terminalUpdateDiagnostic`、`edge/terminalcontrol/TerminalRemoteControlProblemAdvice#remoteControl`。类型名或Problem response不足以替代异常诊断；沿原logger补原异常及现关联，不新建advice/日志平台或扩大成全域重写。对应现 `src/test/java/com/catering/v2s/app/edge/terminalcontrol/TerminalRemoteControlControllerDiagnosticTest.java` 区分owner拒绝异常与正常无异常completion，不把现“Throwable为null”断言当原异常已保留；具体源码变化仍待实施授权。
顺序：补日志→第一轮fresh TEST_CHAIN_PREFLIGHT→主agent核验最小修复→第二轮新fresh同根核验→确认项关闭→获授权focused动态；CP内proof只为当前链做，不伪造整个CP提前MATCHED。全批新链补影响面，不重复已覆盖未改链。
仅四类止于决策点：不变量冲突、不清、源码前提不符、必须触FORBID；可在授权范围最小修复者继续。不能因预算数字删正确业务，不自主放宽operation预算。

### 13b · 三维对账
每完整CP source/proof齐后fresh需求＋设计/既有IA＋六维规范对账，MATCHED/OPEN；OPEN修复影响面再复查同CP。全CP完成做独立全批6b，再整体动态。不按文件/单次修复开关，不重复对账未改部分。

### 13c · 逐代码与详设对账
计划显式交付步骤覆盖全部新增/修改/删除代码、生成diff、测试/fixture/seed/README/控制面与本设计；fresh逐代码核零调用者/缺文件/真实行为，不抽样。结果MATCHED/OPEN；任一OPEN为实施未就绪。它不替代6b或整批IMPLEMENTATION review。

## 14 · 模板与当前证据

implementation-design-template §0–14逐节在本文件/附件；Journey/IA/UI模板由§0明确当前已批准工件复用，原screen/用户任务/权限/刷新/集合/线框不改，附件§4只规定回归观察，不创造新screen。不存在用新简单线框豁免原复杂操作。菜单行为变化是R08恢复已注册授权页，须F/L2证明入口，不新增产品页。
当前仅静态源码/文档研究；所有新能力/校验/编译/H/L2/cleanup NOT_RUN。L3包括优化后的菜单、Page/Drawer、远控承载和扩展提交；无动态PASS，独立静态无阻断时应GO_WITH_UNVERIFIED_UI。新增scripts Node测试的真实登记/红例与控制面文件同步见附件§5和CP06，不能以文件存在或focused直接执行掩盖入口遗漏；原其他批次的登记现状不能冒称本批已修/全门已PASS。当前正文不自授verdict。
