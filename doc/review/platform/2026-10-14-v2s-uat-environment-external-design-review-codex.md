# V2S UAT 环境 · 当前设计包外部独立静态评审

- 日期：2026-10-14
- REVIEW_ORIGIN=DEXTER_ROUTED_EXTERNAL_REVIEW
- REVIEW_TARGET=DESIGN
- ACTION_1_VARIANT=1-B 文档提取
- 本次不重开 `TER_UAT_ENV_2026-10-14` 已关闭的内部 DESIGN cycle，不构成第三轮内部审查。
- 主会话为续接会话，未起草这两份 UAT 文档；fresh 独立性来自三个 `fork_turns=none` 的只读子 agent。主会话不伪称 fresh。
- 本轮仅新增本评审文件。未修改需求、设计、计划、规范、源码、测试、配置或依赖；未读取 `.runtime/`；未运行生成、编译、构建、测试、verify、DEV/UAT、部署、数据库或 seed。

## 1 · 被审字节、顺序与独立结果

| 文件 | 当前 SHA-256 |
| --- | --- |
| `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-design-codex.md` | `a7c9e2fb60840130cea21a0b737e9285c973036a5bc00a166e5b1d7660fccea7` |
| `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-plan-codex.md` | `275d88fb270099bdf2eb082a34b97682626c7db081aea73174be7fa30b802294` |

以下以“详设”“计划”简称上述两个路径。路径与行号均对应本轮读取字节。

先读当前设计、计划、模板、入口、项目记忆与 owning source，形成独立 findings/verdict；三个 fresh reviewer 均未读历史 intake/R1/R2。主会话随后重开源码、验证反例与更小替代，再读取用户指定的历史三份评审材料。历史 verdict 不回写，作者 disposition 不当作独立证明。

| fresh 只读分工 | 原始独立结论 | 边界 |
| --- | --- | --- |
| `/root/uat_fresh_design` | NO-GO，0M/2S/4N | 完整两份设计包、模板、实际消费者 |
| `/root/uat_seed_review` | NO-GO，0M/2S/0N | seed、bootstrap、准入顺序 |
| `/root/uat_resource_review` | NO-GO，0M/2S/1N | 资源与网络；两项网络 S 由主审核验后收窄为 N-02/N-06 |

资源分工的条件反例成立，但详设已要求 UAT 独立配置、浏览器/终端可达 ingress，以及 CP-01 实际端口分配；不是强制沿用 DEV loopback 或 UDP 端口。主审确认缺少精确消费者映射，未确认不存在合法实现路径，故保留为非阻断补充，而不直接继承原 severity。各分工原 verdict 保留。

## 2 · 整批结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/2/6
L1_ENGINEERING=findings：两项已确认的实施路径矛盾，六项非阻断补充
L2_USER_VISIBLE=无新增业务UI；现有双后台远端登录/链接/图片与终端地址体验未运行
L3_UNVERIFIED=UAT-01～11、远端部署/浏览器/终端/seed/readback/business/cleanup全部NOT_RUN
SAME_ROOT_SCAN=CP-01～06、六seed阶段、两条非HTTP步骤、两后台/两终端、资源与网络消费者已交叉核验
DESIGN_GAPS=本批inv-expired的UAT渠道未定；无须新增通用框架
TEMPLATE_COVERAGE=见§6
EVIDENCE_TIER=STATIC_CURRENT_DOCUMENT_AND_SOURCE；少量官方网页只读核实
```

方案主干合理；NO-GO 不来自缺少运行证明，而来自按当前文字无法同时满足的两条主流程。修订无需换方案、复制 seed 或增加恢复框架。

## 3 · 阻断 findings

### S-01 · 首次 seed 与 CP 退出/全批准入相互依赖

- 性质：仓内事实；CONFIRMED。
- 位置：计划 §2 CP-04/CP-06，第30、32行；共同门第38行；§6第117～119行。详设 §3.1 CP-06 第90行、§13b第344行。
- 证据：CP-04 退出要求完整 seed 六阶段报告/readback/cleanup，CP-06 工作含真实 init→完整 seed→smoke→UAT_READY；但第一次受管 seed 要先完成所有 CP 和全批6b，而6b又安排在CP-01～06全部完成后。
- 正本：`doc/platform/implementation-task-template.md:215–221` 要求首次 seed 前所有 CP 与6b MATCHED。其第168行的 CP 内技术 proof 规定不替代该准入；详设第320行、计划第113行新增日志前置也不能豁免完整 seed。
- 触发：第一次按计划初始化 UAT。实施者只能自行越过 seed 准入，或把尚未完成真实验收的 CP 宣称完成。
- 最小可验收修正：明确 CP-04/06 退出是代码实现、dry-run、允许的 focused proof 与静态对账；报告校验的 fixture proof 与真实完整 seed 分开。将真实 init、完整 seed、UAT-01～11 及 UAT_READY 放到全部 CP MATCHED、6b与适用准入之后的统一整体验收。保持六个 CP，不新造阶段。读回顺序应是一条无循环的 `CP实现/合法proof → CP对账 → 全批6b → seed准入 → init/seed/UAT验收 → 13c/IMPLEMENTATION review`。
- 需要 Dexter 裁决：否，不改变产品范围或正本门槛。
- 同根：六个 CP 退出、§3生命周期、§5动态前置、§6准入及详设§3/§11/§13b均已检查；不能只改第119行。

### S-02 · 完整 fixture 必需的 inv-expired 没有确定 UAT 渠道

- 性质：仓内事实；CONFIRMED；渠道/例外范围须明确。
- 位置：详设 §10b.1第242行、§10b.3第253行、§10b.4第259～261行、§13第338～340行；计划 CP-04第30行。
- 证据：设计要求完整相同 r5-full fixture，并限定写入经远端 CBS owner；对 `terminal-fixture-state.mjs` 却仅写未来“检查是否适用”。
- 实际调用：`scripts/dev/owner-command-seed-executor.mjs:890–894` 无条件调用该适配器生成 `inv-expired`，不是可省略的 terminal 后置步骤。
- fixture正本：`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json:108–140` 明确这是 owner HTTP 不可达的时间终态，正常入口只有 create/cancel/reissue。
- 实际写路径：`scripts/dev/terminal-fixture-state.mjs:114–120` 修改 invitation、审计与receipt；第137行经 SSH 对固定 DEV PostgreSQL 容器执行 SQL。只改环境名、数据库名或 manifest 字段不能解释这条非HTTP渠道是否获准进入UAT。
- 影响：实施者必须自行漏掉必需 fixture、扩大现 SQL 例外，或发明未设计的 owner fixture能力；完整 seed 闭包尚未成立。
- 最小可验收修正：建议明确复用唯一已有 allowlisted fixture 的 UAT 受管远端实现；仅绑定该 fixture、精确 invitation/intent 前提、UAT host/container/DB/namespace、有限 mutation、同事务 audit/receipt 与现 owner HTTP readback。普通 seed mutation 仍走 owner API，不新增业务 HTTP、通用SQL通道或第二executor。若坚持全程仅CBS owner写，必须另写定该唯一fixture的非Web owner路径，不能留给实施者猜。
- 需要 Dexter 裁决：若将现受限 DEV SQL fixture 例外扩至 UAT，需明确确认这个有限适用范围；本review不能自行批准。已有正本若明确覆盖UAT，可给出对应原文后关闭，不需重复授权。
- 同根：两条非HTTP步骤已逐一检查。首管理员已有明确UAT owner方案；其余五个组件/post-step未发现同类直接写库渠道。

## 4 · 非阻断补充

以下不要求新增产品机制、额外完整测试矩阵或重复对账。修订时补对应已有配置/消费者即可。

| Finding | 位置、事实与影响 | 最小修正/裁决 |
| --- | --- | --- |
| N-01 远端浏览器owner不够明确 | 计划§5 UAT-06第91行写“浏览器/本机driver cleanup”；详设§11a第298行要求远端UAT浏览器。`scripts/README.md:189`规定UAT浏览器执行面远端。本机driver可以通过SSH控制远端browser，故不是确定违反，但仅打开remote origin不能证明远端执行。 | 指定远端browser/request执行host、启动入口、身份、日志与cleanup；本机仅控制。无需Dexter裁决。 |
| N-02 公共资产部署映射未点名 | 详设§2.1第42、46、49、53行、§9a第207行；计划CP-02/05。`r5-dev-runner.mjs:517–526`区分内部对象endpoint与`CATERING_ASSET_PUBLIC_BASE_URL`；`MinioAssetObjectStorage.java:278–279`拼独立资产URL；`AssetPreview.tsx:38,81`真实消费，platform工作空间也读logo。`/api`代理不自动代理图片。 | 在已有UAT配置表明确内部endpoint、公共asset ingress/publicBaseUrl与bucket身份；用已有seed资产的实际URL读取/图片加载作业务断言。不强制资产同源，不暴露update私有bucket。无Dexter裁决。 |
| N-03 场景身份/文件落点与bootstrap CP不一致 | 详设第287～288行UAT-09/10为staging cleanup/status identity；计划第94～95行为stop隔离/init失败。同包仍有相关断言，未确认实际漏验。详设第297～306行“所在文件”多为能力泛称，模板§11a要求文件；详设CP总览第76～77行与门控第87行/计划第29行bootstrap分别在CP-04与CP-03。 | 统一11个场景ID含义，补拟新增/复用的具体验证文件与受管入口；bootstrap按已明确的CP-03定位统一。无需新增台账/门，無Dexter裁决。 |
| N-04 Spring官方链接不固定到声明版本 | 详设第125、269行声明4.1.0，引用`/4.1/api/…`；本轮官方页面实际重定向到当前API，标题4.1.1。实际解析被正确保留为CP-01 OPEN，不能将别名当精确4.1.0证明。 | 引用实际解析版本对应官方源码/tag/Javadoc，或明确现链接仅说明API形态、同版本证明OPEN。无需升依赖/构建；无Dexter裁决。 |
| N-05 UAT target需要点名共享guard消费者 | 详设第85～86、203、261行与计划CP-01。`r5-dev-runner.mjs:260–261`全host拒绝任何`com.catering-v2s.remote-root`容器；若UAT复用该label，DEV后续start会拒绝。UAT尚未选label，故条件反例不是必然失败。另`r5-remote-java.mjs:25–29`、`managed-diagnostic-protocol.mjs:76–77`仍有DEV control/root身份校验。 | 明确UAT label/guard处理或窄scope复用决定；同步闭集点名两诊断消费者。共存覆盖UAT存续时DEV生命周期的反向顺序。无需遍改所有runner或共享调度器；无Dexter裁决。 |
| N-06 LiveKit网络与CBS配置要进入同一映射 | 详设第48、146～148、208、317行与计划CP-02/03/05仅点WS。现`livekit/docker-compose.yaml:8–9`含TCP与UDP；`livekit.yaml.template:1–9`含rtc端口/node_ip/密钥；CBS `LiveKitRemoteControlGrantSigner.java:26–28`及DEV runner第513～515行消费key/secret/signal URL。设计已允许CP-01核实际全部端口并禁止复用DEV配置，存在合法路径。 | 现分配表按协议+端口列媒体入口/advertised address；LiveKit、CBS signer、TER地址指同一UAT实例。readiness/WS成功不冒充媒体验证；不新增TURN/DNS/证书/HA或额外完整远控Journey。无Dexter裁决。 |

官方只读核查：

N类表中源码简称的完整仓根路径：

- `scripts/dev/r5-dev-runner.mjs`、`scripts/dev/r5-remote-java.mjs`、`scripts/dev/managed-diagnostic-protocol.mjs`。
- `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/MinioAssetObjectStorage.java`。
- `apps/frontend/operations-admin/src/app/components/AssetPreview.tsx`、`apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx`（logo消费第287行）。
- `scripts/dev/livekit/docker-compose.yaml`、`scripts/dev/livekit/livekit.yaml.template`。
- `apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/LiveKitRemoteControlGrantSigner.java`。

- [SpringApplicationBuilder官方API](https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/builder/SpringApplicationBuilder.html)：本轮返回标题4.1.1、重定向到非精确版本API路径；仅支持N-04，不据此证明仓内实际解析版本。
- [LiveKit Ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/)：区分信令及ICE/UDP网络边界；仓内具体端口以现compose/template为准，目标镜像实际版本仍OPEN。

## 5 · 已核实、历史处置与证据边界

- 两环境独立数据/身份/预算、主机容量仅新增准入、不停DEV的设计相互一致。真实capacity、port与digest未读，保持OPEN；不能因缺这些实施期输入判设计失败。
- 两后台仍为独立app，API相对根路径；工作空间登录与邀请两处均消费`VITE_OPERATIONS_ADMIN_ORIGIN`。当前设计正确要求build前注入、dist与目标链接读回；未运行构建或浏览器。
- 非Web bootstrap有`ManagedInvitationBootstrap.java:50–59`真实装配先例。现IAM diagnostic方法的随机UUID/非canonical身份差异已被详设第269～271行要求补足，不把未实现的owner扩展报为新问题。
- 六阶段target、kind、namespace/DB、凭证、OTP、HTTP、父子报告与validators的普遍同步义务已写入；当前DEV-only源码本身不是设计finding。S-02是现完整fixture唯一渠道未决定，不能被泛称target适配覆盖。
- `update.artifacts`不属于runner必须使用Managed DEV的case集合，不认定UAT工件构建必须连接DEV。
- R1的跨后台origin/Vite构建输入与一般target缺口已在当前文档补入。R2日志矩阵已覆盖UAT-01～11各组的真实调用链、owner/落点/字段，以及“日志→fresh证伪→确认修复→另一fresh核验→关闭→准入+授权dynamic”顺序。是文档层闭合，不是日志实现或运行PASS；S-01仍需纠正首次完整seed的准入顺序。
- 不需要自动恢复、MQ、复制fixture、通用bootstrap HTTP、共享调度器或新增业务owner。

全部UAT-01～11、源码实现、生成、编译、测试、verify、DEV/UAT、容器/DB、seed、前端/终端运行、部署、business及cleanup：NOT_RUN。host/容量/端口、镜像digest、UATsecret、实际依赖解析及网络readback：OPEN。未验证项不单独成为本轮阻断，也不被写成PASS。

## 6 · 模板、输入与同根清单

| 模板/范围 | 状态 |
| --- | --- |
| Journey模板全部业务Journey节 | NOT_APPLICABLE_WITH_REASON：本批无新增业务Journey |
| IA模板screen/控件/交互节 | NOT_APPLICABLE_WITH_REASON：仅部署现有两个app |
| UI模板可见文案/控件/行为节 | NOT_APPLICABLE_WITH_REASON：不改业务UI，不新增L2控制面 |
| implementation §0/1/2/3/3a/4～10/10b/11/12/13b/13c/14 | 有；内容重排。准入与seed渠道问题见S-01/S-02 |
| implementation §9b/11a | 有但落点不完整，见N-03 |

fresh完整reviewer声明完整读取：AGENTS、CLAUDE、Blueprint、platform README、scripts README、index全部kernel、deterministic-context-only、cs-review、review-standard、四模板、独立治理/输入checklist、implementation-task-template、适用六维路由记忆原文和相关sourceRefs、当前两设计文件及对应真实消费者。路由为`review/platform/operations-admin/platform/architecture/review`。主会话对本报告每条finding另重开对应源码。

当前源码核验全集：r5-full父流程、四主stage/两post-step及环境/report/diagnostic校验；首管理员与inv-expired两条非HTTP步骤；CBS IAM事务/CLI；两后台build/API/链接/资产；两terminal package/defaults/selector；DEV资源preflight、ownership/预算、LiveKit与对象存储配置。其余同根成员已检查，没有把下标、数字、对象名计数当业务证明。

所有子agent仅报告只读结果，未调用写入工具；本主agent唯一写入为本报告。历史review/intake读取晚于本轮独立verdict，未改变原独立字节结论。

## 7 · 授权边界与下一步

本结论仅用于修订设计的参考，不授权修改设计、规范、源码、配置或依赖，也不授权任何动态执行。建议先修S-01并明确S-02的唯一fixture渠道；非阻断项只补现有部署映射/文件定位，无须重开内部DESIGN cycle。后续修订、裁决、外部差量复核及实施均由Dexter另行安排。

治理注记：`review-standard.md`指向`verification-governance.md`的M/S/N数值定义仍不完整；本轮沿用S=当前文字无合法主流程/导致功能缺陷、N=具体化与说明残余，severity接受度归Dexter。不是UAT产品finding，也不在本报告就地增加正本规则。
