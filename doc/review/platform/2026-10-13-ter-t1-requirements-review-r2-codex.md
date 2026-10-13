# TER T1 正式需求 · R2 fresh 独立对抗审查

REVIEW_CYCLE_ID=TER_T1_REQUIREMENTS_20261013
REVIEW_TARGET=DESIGN
DOCUMENT_KIND=FORMAL_REQUIREMENTS
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
reviewerContext=FRESH_V2S_ROOTED_READ_ONLY
reviewerInputChecklist=doc/review/platform/2026-10-13-ter-t1-requirements-review-r2-inputs-codex.md
reviewedObject=doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md
reviewedObjectSha256=b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e
blindReviewDeclaration=先从用户原话/裁决、规范、全部kernel与六维命中原文、完整正式需求及owning source形成独立GO/0M/0S/0N，发送给主agent后才读取R1、作者intake及讨论稿其余作者分析。
authorMaterialReadAfterIndependentVerdict=true

## 1 · 结论及批准边界

**GO，0M/0S/0N。**

该结论仅覆盖上述SHA的完整正式需求可接受性，起读和结束前SHA一致。没有确认到要求需求修改的阻断，也没有需新增Dexter产品裁决的事项。

本轮为同cycle第二轮硬停止；`ROUND_FINAL_DECISION=SELF_DECIDED`由本独立reviewer作出，不由作者代判，不建议第三轮。

需求GO不证明当前生产代码已经达到T1，也不授权详设定稿、实施、规范/记忆变更、生成、编译、构建、测试、verify、DEV、Web、Android/设备、reset/seed、L2、UAT或部署。

## 2 · 方案合理性

Dexter要解决的是维护者理解能力、事实与资源归属时必须跨多个包/App追名单和猜接缝的问题。文件易找只是其中一部分。原始输入明确要求全包职责分析、既定机制采用、包自闭环、地址可变集合和私有外部API。

正式稿§0.1、R-02～R-15覆盖了这个问题，没有缩成“把actors.ts拆开”，也没有把“长期结构”解释为预建框架。

独立构造的替代：

| 方案 | 可解决什么 | 取舍 |
|---|---|---|
| 只拆文件并集中常量，保留App同步白名单及TDC全业务client | 提高局部定位性 | 仍需包外补事实，未解决原始问题 |
| 建全局module/API/sync/UI超级registry或统一DSL | 集中部分接线 | 形成第二事实与初始化机制，隐藏owner，成本不匹配 |
| 各包保有静态声明/行为/私有API，从具体定义派生metadata；复用Runtime/State/transport，App选择包和真实外部输入 | 消除第二名单并保留已存在能力和资源owner | 当前正式稿方向合理；具体类型和初始化留详设验证 |

declarations、静态ParameterDefinition及地址数量变化已有Dexter裁决。API私有化的最终澄清也明确保留transport owner。需求不冻结统一factory签名、不要求每包再建generator、不为了自闭环建立反向依赖，是合理的阶段和复杂度边界。

UI_INTERACTION_APPLICABILITY=NOT_APPLICABLE_TO_NEW_UI_DESIGN。没有新页面或新可见操作。R-16/17与V-04/16/17仍要求未来核验既有Journey保真，不能据无新UI免去实际回归。

## 3 · 动作1-B：应然事实提取

提取不是空清单；以下事实逐项与用户裁决、模板和现行规则对照：

| 提取事实 | 原文位置 | 核验结果 |
|---|---|---|
| 需求阶段不交付CP、IA、线框、逐operation详设和测试文件 | §0.3、R-16、§7.2/7.3 | 是阶段边界；不是缺详设finding |
| declarations与现行闭合目录词表不同 | R-03:65～71；R-15:179～183 | 已明确未来同步规范/门，不是偷偷绕规则 |
| 每actor/slice/公开selector一个文件，但不机械一handler一actor | R-03/04:67～79 | 与用户方向、TR-R01及单资源owner相容 |
| 参数使用静态Definition，不恢复catalog | R-06:93～97 | 有Q-2和原动态catalog退役裁决；无新运行参数平台 |
| API私有化需要改当前TDC集中生成/导出 | R-07:103～113 | 明确目标变化；不改变transport owner/CBS鉴权/唯一凭证 |
| module加载带声明，从具体定义派生metadata | R-08:117～123 | 保留归属/brand/重名/依赖检查，不自动扫描workspace |
| sync资格与业务required projections分开 | R-09:127～131 | 不以资格全集推导业务ready |
| 地址无固定上限，但保留合法性和当前DEV两个入口 | R-11:145～151 | Q-3改变产品上限，不改变部署拓扑 |
| 39功能包/一个聚合包 | R-01:43、R-02:55 | 明确是导航快照；未冻结未来数量 |
| 1/2/10地址 | V-13:221 | 验收样本，不是新的数量枚举或上限 |
| 不意外丢设备数据与合法reset/解绑清除分开 | R-12:159；V-15:223 | 当前V-15已按事件写出准确oracle |
| 未来W/D及cleanup未运行 | :228、§7.3 | 无运行PASS或当前UI通过的暗示 |

四模板逐节适用性见input checklist §9；未以需求文档欠缺未授权详设工件制造finding。

## 4 · 主要证伪攻击

### 4.1 私有API是否只是移文件，实际继续由TDC掌握全业务目录

仓内事实：

- `contracts/policy/terminal-client-generation.json`当前只有TDC target，纳入门店/合同/服务点/项目规则/更新/远控operation。
- `apps/terminal/kernel/base/terminal-data-client/src/index.ts:57`根导出全部generated API。
- 同包`features/actors/terminalDataClientActor.ts:1139～1317`识别`terminalRead`、改写storeRef并为项目规则查询解释query。
- store-basic`features/actors/actors.ts:110～120`、project-basic`features/actors/actors.ts:142～165`通过TDC统一读取。
- terminal-update`features/actors/terminalUpdateActor.ts:731`及remote-control`features/actors/remoteControlActor.ts:251`也通过TDC业务命令。

推论：只移动生成文件而保留这些全业务接缝，不能满足用户边界。

攻击未成立：R-07明确私有client/业务endpoint不能公共导出或deep import，共享认证不能掌握全业务目录/业务path/全部DTO；R-16要求逐operation、类型消费者和认证接缝设计。不是仅搬文件。

最小结构仍是复用现有多target生成器与通用transport/认证，不需要第二credential store、全局业务API代理或逐包fetch。具体接缝未设计不构成需求不可行；若未来详设只能靠重复凭证或反向依赖，才是那个详设的问题。

### 4.2 是否错误把transport改toolkit或削弱其资源owner

事实：`kernel/base/transport/src/moduleName.ts`为owner；`application/createTransportModule.ts`通过commandGateway派发transport command，并管理HTTP关联、连接及资源释放。

攻击未成立：§0.2:29、R-01:47、R-07明确保留定位和通信责任。业务API归使用包不要求transport丢掉command/连接owner，也不要求每个feature新建TDS连接。

### 4.3 module自闭环是否引入另一套registry或破坏基础层方向

事实：

- `kernel/base/runtime/src/types/module.ts`目前同时有AppModule descriptors和concrete definitions。
- `application/createRuntime.ts:108～156`校验声明/definition、brand、归属、visibility和重名。
- `ui/base/feature-assembly/src/foundations/createFeatureAssemblyModule.ts:19～47`已有metadata派生。
- Runtime`createRuntime.ts:412～423`已经从加载模块汇总stateSlices。

攻击未成立：R-08要求从实际定义派生，只处理显式加载包；R-10保留通用Runtime/Render/StateSource/surface装配以及integration应用阶段政策；R-14禁止kernel反依赖UI。可复用已有注册链，不需要扫描全部workspace自动启动或超级registry。

### 4.4 自动同步资格是否会让无关slice阻断业务ready

事实：

- State`types/slice.ts:27～57`已有sync registration。
- console`assembly.tsx:231～239`、wallpaper`assembly.tsx:218～226`另外手写参与名单。
- `ui/base/integration-assembly/src/foundations/stateSyncSlices.ts:11～17`只过滤外部给定名单。
- terminal规范§4-E要求配对恢复依据当前激活/店员及所需投影，不把peer accepted当业务ready。

攻击未成立：R-09:131明确“可同步全集不等于业务required projections”，保留行为owner/应用政策、断链遮罩与本地admin恢复。V-11与V-12分别证明资格、方向和业务恢复。没有把同步全集变成统一业务启动调度。

### 4.5 static ParameterDefinition是否变成动态配置框架

事实：

- contracts`foundations/definition.ts:10～68`已有静态参数工厂与defaultValue/decode/validate。
- 原始裁决`00-ter-build-order-claude.md:491～543`取消动态store catalog，要求包内定义。
- Q-2本次明确统一静态ParameterDefinition。

攻击未成立：R-06区分策略默认值、协议常量、算法数值及command/selector/UI/serverSpaces参数；外部覆盖只在真实存在时由能力owner校验。没有恢复动态catalog、管理UI、远端覆盖或为未用metadata补registry。

### 4.6 可变地址是否只改消费端、遗漏producer或扩张DEV拓扑

事实：

- server-config`validateServerConfigDefaults.ts:15`当前限制地址1～4。
- 两个Android `managedServerSpaces.ts:5～9,43～96`使用One/Two、具名两条替换和aurora路径。
- 两Web入口存在同根映射。
- `tools/terminal-automation/src/runner.ts:978～1075`和环境变量消费者沿用One/Two。
- `scripts/dev/r5-dev-runner.mjs:2993～3020`生产两个受管入口的readiness/manifest信息。

攻击未成立：R-11明确删除One/Two、恰好替换两条及旧上限，纳入Android/Web/driver/DEV producer/fixture/生成与静态消费者；按具名集合匹配，不残留默认地址。保留当前DEV两HAProxy、loopback、process identity与cleanup，不新增服务发现。并未因为“一或十个URL”要求部署十节点。

### 4.7 全包逐逻辑是否被导航快照或文件数量代替

攻击未成立：R-02明确正式详设前重新枚举当前字节，要求全部手写能力的输入输出、owner、跨包、生命周期、调用者和处置结论。generated/vendor/test分别归因。§0.2及§7.1不把讨论盘点提升为完成证明。没有精确数量准入门或每字符审批。

### 4.8 是否把生命周期全部写成保留数据

本轮直接从当前规范和源码推导，未先看R1：

- terminal规范TR-09:365～375：根reset清各owner，只有server-config/terminal-update的持久descriptor retain；TDC凭证照常清除。
- 规范§4-F:1037：普通断线保凭证；明确解绑/换主先TDC command清除并成功flush，不构成retain例外。
- TDC actor:259～260、1973～1985：取消成功/离线取消发起`TERMINAL_ACTIVATION_CANCELLED`根reset。
- TDC slice:335～349：credential持久化，未声明retain。
- State`createStateRuntime.ts:80～102`只恢复retain实际持久字段；`persistenceEngine.ts:437～479`先flush，删除非retain存储键，成功后派发reset。

攻击未成立：当前V-15:223分别列合法重启/恢复、角色切换、解绑/换主与取消激活根reset，并明确各事件允许保留或应清除的事实。没有把“结构重构不意外丢数据”升级为取消后保留凭证。

这不是要求所有角色切换都清凭证，也不是所有重启都保留全部运行状态。当前需求把正确的事件差异留下，未来详设须分别绑定现行owner oracle。

## 5 · Findings与同根扫描

本轮新findings：无。M/S/N=0/0/0。

前述攻击是核验记录，不升级为生产bug修复范围；没有因现有代码不符合未来目标就判需求NO-GO。

生命周期问题族全文展开：

| 条目 | 判定 |
|---|---|
| R-01 | 保留已有业务语义与owner |
| R-03 | persist/sync/reset关联，不要求全字段保留 |
| R-04 | 单一资源/任务事实，不改变清除事件 |
| R-07 | 唯一凭证和连接owner |
| R-09 | reset例外保持现行判据 |
| R-12 | 只禁止因结构移动静默丢数据 |
| R-13 | 盘点机制，不扩大retain |
| R-17 | 不隐含reset/seed授权 |
| V-08 | 无凭证/连接副本 |
| V-12 | 当前required projections和恢复边界 |
| V-15 | 各生命周期事件的保留/清除准确区分 |
| §7.3 | 不将未运行恢复/设备/cleanup写成PASS |

除V-15之外的其余11个相关条目已核对，没有另一处无条件要求取消/解绑后保留凭证。

另外对API问题族R-01/R-07/R-08/R-14/R-16/V-06～08，同步问题族R-08～10/V-09～12，地址问题族R-11/R-12/V-13/14，以及声明/错误/参数问题族R-03～06/R-13/R-15/V-02～05/V-18作了全文同根对照，未发现新的互相冲突预期。

## 6 · 后读R1与作者材料的差异

独立GO形成后才打开R1和intake：

- R1对应旧SHA `b6c2cb34bbe220938d2cf4bb744b336885042f9f98e94ff697662e2babe56023`，结论NO-GO/0M/1S/0N。
- R1 S-1指出旧V-15把根reset与“不丢credential”混写。
- 当前SHA的V-15已与TR-09、§4-F、TDC取消/root-reset和State descriptor一致。**修正内容被本轮独立源码核验支持，不是因为intake写CLOSED而接受。**
- 本轮对原S-1处置核验：`CONFIRMED_RESOLVED_IN_REVIEWED_BYTES`。影响是消除错误oracle；最小修正只是需求按事件写清，没有新增retain、改reset或修改代码；无需Dexter裁决。
- 讨论稿其余作者分析的API归属、sync/readiness分开、assembly合法责任和可变地址方向与独立判断相符。
- 盘点附件明确不是逐分支审计，本轮同样未把它当全实现证明。
- 后读材料未改变独立GO，没有新的M/S/N。

## 7 · 未验证清单和第三方适用性

| 内容 | 本轮状态 |
|---|---|
| 正式需求全文、用户裁决、适用约束/owning source | STATIC_REVIEW_PERFORMED |
| 当前代码是否已完成T1 | NOT_PROVEN；本轮非实施评审 |
| 生成结果、编译、类型、direct tests、verify | NOT_RUN |
| Expo Web、Android/native、主副同步真实运行、DEV、L2/UAT | NOT_RUN |
| 新UI可见工件 | NOT_APPLICABLE：未新增页面/交互 |
| cleanup | NOT_APPLICABLE_NO_RESOURCE_STARTED |

L3指当前被审UI工件的未验证可见事实。本稿无新UI工件，因此L3为空；未来W/D及现有业务保真的NOT_RUN如实保留，不把它们升级为当前无新UI正式需求的阻断，也不冒称运行PASS。

本稿不指定新增第三方API或具体运行时默认值。本轮读取了第三方规范，未执行依赖解析/官网核验/实验；不声称第三方用法已通过。未来详设选择实际API、初始化与native拆分方式时，须按真实解析版本取得官方依据。

## 8 · 固定结论块

REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS:仅正式需求静态可接受性；目标变化、owner边界、规范同步、生命周期oracle与授权范围一致，不代表当前实现或运行PASS
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:本轮正式需求不新增页面或交互；既有UI/业务保真明确留给未来实施proof
L3_UNVERIFIED=空
SAME_ROOT_SCAN=生命周期12项逐项核对，除V-15外其余11项无冲突；API、sync/readiness、地址、声明/错误/参数条款及对应V场景全范围对照，无新finding
DESIGN_GAPS=无需求级新判据缺口；module contributions、认证执行接缝、逐operation生成分配、初始化顺序、持久身份和W/D范围是R-16与§7.2明示的后续详设义务
TEMPLATE_COVERAGE=四模板逐节有/NOT_APPLICABLE及理由见reviewerInputChecklist §9；未把未授权详设或动态证据缺失列为需求finding
EVIDENCE_TIER=STATIC_ORIGINAL_REQUIREMENT_AND_OWNING_SOURCE_REVIEW_ONLY

## 9 · 本轮结束检查

- 被审全文、适用输入、独立结论及后读对照均已完成。
- 无当前task剩余必需只读动作；无资源需清理。
- 本cycle第二轮硬停止，最终综合为GO。
- 只读报告交主agent保存和辩证intake；不产生实施、运行或规范修改授权。
