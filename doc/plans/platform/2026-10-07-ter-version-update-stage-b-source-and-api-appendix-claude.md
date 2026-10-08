# 阶段 B：当前源码、接口、依赖与验收附件

本附件为设计导航，不是API运行证明。所有路径相对仓根。§2 的 A owning source 已于 2026-10-09 静态读回更新，其余先例仍为 2026-10-07 导航；行号/hash会变化。A 尚未完全验收，CP-01重开所属source，不能把任一截面SHA当最终版本或运行证明。

### 2026-10-07 Dexter 最新裁决（覆盖旧报告方案）

1. 报告存 CBS PostgreSQL，由 `terminal-update` owner 写入；运营右 Tab 可按门店和当前实际版本查询。Dexter 最终更正“仅包含启用”：范围为当前项目 **启用门店下的启用终端**，停用/作废均排除；未报告终端仍有列表行。显示门店名、终端名、实际版本、最新升级报告状态，点击终端打开标准详情 Drawer，显示最新报告及历史报告。
2. 上传成功且解析校验成功后才可保存；按钮名称统一“保存”，之前禁用。HOT 还必须选定与声明五事实完全匹配的最小 FULL。换文件、解析失败、stage 过期或上下文改变立即撤销旧保存资格。
3. 升级报告经 CBS HTTP 上报；失败正文缓存到升级 owner 的持久化 state。TDC 对有效匹配 PONG 发公开本机广播 command，业务 actor 消费后重试自己的未发送内容。TDC 不保存其他 owner 的失败正文，广播不证明 CBS HTTP 成功，不通过报告失败重连 TDS。
4. N/M 界面单位为分钟；InputNumber 正整数分钟 1～1440 为本设计的有限参数，canonical/API/持久字段仍明确为秒，提交乘 60、读取除 60，服务端检查 60～86400 且为 60 的倍数；正常 DEV 用 N=5/M=10 分钟，边界值只进 acceptance fixture。
5. 运维保留 APK、JS、runtime、构建号、applicationId、publicationId、摘要等真实技术字段；不得暴露凭证、下载 grant 或原始异常。
6. 规则详情增加“操作历史”，复用标准审计能力，不新建审计流水/弹窗容器/operation。

后续直接确认：“每个更新任务一条报告”。阶段变化更新同一任务记录，历次任务保留；每次 HTTP 重送与心跳不新增历史行。此前“包含启用和停用”的答复已被“仅包含启用”覆盖，不作为当前输入。

正式需求 R-15 中旧双后台、最后值而无任务历史、TDS 上报路径由上述直接裁决覆盖。本轮只改 B 设计包及 intake；需求正本、开发规范、项目记忆、A、源码均不修改。未来实施授权须覆盖正式来源同步与终端标准唯一正本中的心跳触发重试条款；当前仍无实施或运行授权。大致 IA 已确认，本次新增历史/筛选/审计细节为修订设计，未冒充逐控件看图或动态 PASS。

## 1 · 正本与适用约束

需求 `2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` R01～15、§20.4；讨论稿 `2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`。A三设计文件前缀 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-`；B主稿/计划及三decision工件同日期2026-10-07。

已恢复AGENTS、PLATFORM-BLUEPRINT、platform/scripts README、全部kernel、deterministic-context-only及design六维路由命中。主要适用：confirmed-business-language-corpus G01/02/05A/05B/08/10；http-crud-efficiency-design-redlines；owner-read-model-and-lifecycle-standard；backend-acceptance及route-fixture-oracle-integrity；browser-l2-execution-standard；collection-boundary-modes；ordering-only-for-consumer-facing；criterion-degraded-into-list/invisible-dimension-drifts-at-implementation/platform-detail-reverse-inference。记忆只是导航，判据仍重开需求/源码。

## 2 · A交接与复用源码证据

| 当前source/锚点 | 静态事实 | 截面SHA256（必要项） |
| --- | --- | --- |
| `contracts/terminal/terminal-update-artifact.schema.json:7–54` | manifest shape/五字段minFULL；无显式kind，不替代内容验证 | c0f7b889b5078c07d25efa3821b2eeb7e0fc45174d712b63d2173cd359365df8 |
| `scripts/build/terminal-update-artifact.mjs:800–827,856–873` | 两个FULL分支仅APK＋full.json；HOT ZIP；不能称正式FULL ZIP消费已闭合 | 9de1e8018108cdd05c8fbda907d8f9d819839c9330fb3a017ce1dc253cea2cf1 |
| `apps/terminal/kernel/base/platform-ports/src/types/update.ts:26–59,82–96` | 六方法；actual 与 embedded 分开，当前无授权header | b3965304305067d88ac36094f35de35e19f9cb1c4e3fb63d2bd1dc520d811d60 |
| `apps/terminal/kernel/base/terminal-update/src/types/terminalUpdate.ts:15–25,54–70,73–77` | strategy仅技术参数；recent仅四字段；resolveSourcePath为同步形状 | f144bfb1826b387145cd6f110ad6c5a809dd9dee51b9e6fa75c95d60e6785082 |
| `.../terminal-update/src/features/actors/terminalUpdateActor.ts:99–103,333–342,370–426,436–437,492–505` | 同build误用HOT pub校FULL；普通unknown后FULL成功会丢续接；新boot释放task后没有普通HOT确认；B不得假报成功 | af93ec9ebc70000c0f37a96b55898e4b45c7daca537f6f6011fb60f1ca165243 |
| `apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt:206,266–295,375–418,820–822` | actual已取selected record，embedded另列；每boot重置确认、下一HOT要求已确认；桥的actual仍须核发起上下文 | 65593a11ae195e2e43a059f330a770eb9d4db4d4bf19a17e7ddd1249acf9caf8 |
| 同目录 `TerminalUpdateArtifactPreparer.kt:57–60,103–132,261–277` | JDK ZipFile；full直接APK；当前GET无grantheader | 2fd17d3ed6e32d5c5b32a41c06e5cad8f0f51a911503862b791adfeefea675b7 |
| `.../terminal-data-client/src/features/actors/terminalDataClientActor.ts` | 凭证owner/HTTP/消息；B不复制其身份 | 0d5ed481d12fa840dd061afa21fd5792c864c4f315e5d4f7c48d24b55fcd7835 |
| `.../store-basic/src/features/actors/actors.ts:388–397,574–628,750–763` | 当前周期storeloaded、HTTP/topic/flush前后确认范式 | ac7361811fe986436949a1adf21e31971d2186b4c1f93d3bfac4486207723f17 |

缩写路径 `...` 在本表仅省展示：前两条属于 `apps/terminal/kernel/base/`，store-basic属于 `apps/terminal/kernel/feature/`；精确文件列表在 §4，不供程序解析。

其他实际先例：asset `application/PlatformAssetService.java:282–350` staging拒绝callerTX，`1115–1123`当前usage只图片；`AssetObjectStorage.java:9–22`无get；`MinioAssetObjectStorage.java:166–167`公共URL；`PublicAssetController.java:12–23`匿名public，不能复用给私有更新包。operations `OperationsStoreTerminalController.java:248–267`读与写分开，owner `StoreTerminalOwnerService.java:225–247`授权先于receipt。TDS `TdsTerminalTopicRepository.java:28–66`、`TdsTerminalSessionActors.java:577–656,756–764` topic保存/确认/权威scope；`TdsTerminalControlRepository.java:14–67` SQL function-only权限先例。`scripts/dev/r5-dev-runner.mjs:950–951`是受管TDS principal扩展点。

## 3 · 第三方版本与官方依据

下列“声明”不等于依赖解析。**没有本轮安装、Gradle dependencies、编译或运行结果。** CP-01要保存实际解析、tools source.properties/版本/校验摘要、对应官方tag/source和API focused/red；版本漂移后重核，不按本附件硬写错API。

| 能力/当前依据 | 官方一手来源/可确认限度 | 状态/验证责任 |
| --- | --- | --- |
| ZIP：Java 21 标准库 `java.util.zip.ZipFile`；不新增 Commons Compress | [Java21 ZipFile官方API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/zip/ZipFile.html)：entries 枚举、getInputStream 读取、close/try-with-resources 释放已于本轮只读核对；普通路径/声明文件/摘要/实际字节预算仍由本 owner 负责，不能据该 API 声称识别 Unix symlink | 本轮仅官方文档与当前 A 用法读回；CBS 实际 JDK 补丁/实现及普通有效、无效工件 focused 仍 CP-01/02 NOT_RUN。symlink/截断/炸弹专项 NOT_COVERED/NOT_RUN，无专用依赖或 seam |
| APK：Build Tools 36.0.0候选，不手写签名/manifest | [apksigner官方](https://developer.android.com/tools/apksigner)、[AAPT2官方dump](https://developer.android.com/tools/aapt2)；验签与真实manifest分别核实。官方说明未证明本机/远端实际版本；精确发行源码/工具安装摘要仍OPEN | CP-01工具版本与固定构建输入校验；上传路径不能当argv选项；输出有界/timeout；A来源需相同签名事实 |
| 对象stream：已声明 Minio Java 8.5.17 | [8.5.17 MinioClient](https://github.com/minio/minio-java/blob/8.5.17/api/src/main/java/io/minio/MinioClient.java)，用该tag getObject/GetObjectResponse stream且close；当前latest9.0.3文档不作8.5.17依据 | 声明来自asset/build.gradle.kts；解析/网络/断流/私有bucket政策NOT_RUN |
| SQL：Java21、Spring JDBC4.1.0、PG JDBC42.7.7声明 | 仓内root/asset Gradle；[PostgreSQL16事务隔离](https://www.postgresql.org/docs/16/transaction-iso.html)、[NOTIFY](https://www.postgresql.org/docs/16/sql-notify.html)、[advisory locks](https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS) | 实际Spring/PG解析及DEV server版本OPEN；NOTIFY不是持久消息。并发scope锁/重复同time/读隔离真实PG proof |
| 管理后台 foundation/RTK | 仓内 foundation index/消费者；各app package/lock实际版本CP-01采集 | currentData/isFetching、query identity/focus/overlay真实组件proof；不新增UI库 |
| TER驱动 | `tools/terminal-automation/package.json`现有依赖含source-map0.6.1；正式automation API/skill | 复用当前driver，不恢复旧runner；A安装/loader相关扩展及实际可用性未继承历史PASS |

## 4 · 原子组路径清单（实施才改）

### 4.1 输入/生成/保存
新增 `contracts/openapi-source/terminal-update.schemas.json`；同步R5 edge catalog/error disposition、`contracts/catalog/admin-catalog.json` 与IAM权限/placement owning输入；同existing materializer/codegen链产生platform/operations wire、terminal generatedclient、CBS edge interfaces。新topic/frame只改 `contracts/protocol/terminal-connection-protocol.json` 与 `scripts/generate/terminal-connection-protocol.mjs`，Java/TS generated消费者同批。`settings.gradle.kts`、CBS `build.gradle.kts`、module registry新增 terminal-update；不手改generated。

### 4.2 CBS/TDS
新增根 `apps/backend/catering-business-server/modules/terminal-update/`，api的Command/TaskRead/Download三公开能力、application三个业务服务、persistence Artifact/Rule/Report/Topic/Grant/Audit/Receipt adapters及bounded ArtifactParser/AndroidArtifactVerifier；package路径 `com/catering/v2s/terminalupdate/`，能力名称不带阶段/Journey。
edge新增 `src/main/java/com/catering/v2s/app/edge/platform/PlatformTerminalUpdateController.java`、`edge/operations/OperationsTerminalUpdateController.java`、`edge/terminal/TerminalUpdateController.java`；不扩现有 `OperationsStoreTerminalController`，报告由OperationsTerminalUpdateController的PROJECT task-read提供；single `src/main/resources/db/migration/` 新migration名字按冻结时序选择不撞A/Codex并发migration。
asset扩当前 `PlatformAssetService`/`AssetObjectStorage`/`MinioAssetObjectStorage`与公开API、私有bucket配置；public controller明确排除updateusage。
TDS拟新增 state/TdsTerminalUpdateRepository.java 只读规则topic具名函数。acceptance TdsDatabasePrincipal 和 DEV provisionRemoteTdsDatabasePrincipal 仅授 topic EXECUTE，禁止直接SELECT/DML；无需报告function/写principal。CBS新增 ReportHandler/ReportCommandApi.recordReport，唯一报告事实在 terminal-update schema。

### 4.3 TER
扩 `kernel/base/terminal-update/src/{types,features/commands,features/actors,features/slices,selectors,application}`，新增 `terminalUpdateRuleSnapshot.ts` descriptor和reportprojection，actors共享单一任务owner；更新 `terminalUpdateActor.ts` 的provider调用，不改loader/installer核。
扩 `kernel/base/terminal-data-client/src/{types,features/commands,features/actors,generated,application}`：grant HTTP与typed report POST服务及公开心跳广播；runtime只消费现有资源/command/selector，不新造更新调度；topology B不修改同步投影。
扩 `kernel/base/platform-ports/src/types/update.ts`、`adapter/android/update/src/index.ts`、native `TerminalUpdateArtifactPreparer.kt` transient grant；两application和两ui/integration composition装配同一source provider/快照桥/报告桥。按当前A最终path定位，不强制迁移当前生产目录。

### 4.4 UI/测试/seed/runner
platform `features/terminal-update-package/{model,ui,terminalUpdatePackageTestIds.ts}`；不扩运维报告入口。operations `features/terminal-update-rule/{model,ui,terminalUpdateRuleTestIds.ts}`；新增项目报告标准详情Drawer及同feature TestIds，既有store-terminal不改。两app catalog/routing/generated API/problemFeedback按唯一owning输入生成；所有businessstrings app自有，foundation不持业务文案。
CBS acceptance新增 `src/test/java/com/catering/v2s/app/acceptance/TerminalUpdateAcceptanceScenarios.java`，协议扩 `TerminalConnectionContractScenarios.java`；owner/parser/asset、TDS、TDC、update、两后台直接tests。
TER共享journey能力文件 `tools/terminal-automation/journeys/terminalUpdateSupply.test.ts` 与对应Android能力文件，扩唯一 `tools/terminal-automation/src/runner.ts` 的update.supply/update.supply-chain、case闭集/双平台集合/DEV准入/显式suite映射；wrapper仍 `scripts/test/terminal-automation.mjs`。同DEV链借用DEV-owned两Vite/tunnel，扩当前runner的Playwright browser/context/session及TestId动作、budget/profile/manifest与owned cleanup，复用凭据reader；不得调用browser-l2-runtime读取DEV或另建runner。隔离L2保持原数据面，详情见详设§15.2a。
admin L2八policy文件/生成器、tools/terminal-update-l2-p1/cli.mjs checker、两个spec/唯一browser-l2-runtime suite及合法report生产者在详设§3a；只于UI/TestId前置PASS后写。seed完整paths在详设10b。

### 4.5 保留/删除
保留A加载/installer/bootidentity/splash/失败标记与retainedtask正本；保留TDP监听/队列/ping/认证，不重写genericrecovery。替换旧同步source resolver签名及generated旧消费，删除临时fixture假版本、未消费重复helper；不得为B恢复已退役TER runner、HotUpdatePort或另建APK分发服务器。

## 5 · operation 顺序、error、预算与回放

每个新增operation沿详设§5完整roster映射既有errorSetRef，typed增补统一注册：ARTIFACT_INVALID/MINIMUM_FULL_INVALID/RULE_TARGET_INVALID=422；PUBLICATION_CONFLICT/SNAPSHOT_CHANGED/STALE_STATE/REPORT_IDENTITY_CONFLICT=409；NOT_FOUND=404（跨空间不透露存在）；GRANT_EXPIRED/ARTIFACT_NOT_AUTHORIZED=403；BUSY/DEPENDENCY_UNAVAILABLE=503；SNAPSHOT_TOO_LARGE=413；既有auth/terminal错误仍canonical码/状态，不能简单统一成401。

下表仅概述共用顺序，不作为operation预算声明；完整逐请求计数/fixture以§11为唯一分母，旧“各≤1/身份另计”说明不能覆盖该表。CP-01沿真实复用API核对§11每个origin及statement；预算冲突遵AGENTS operation-scoped决策，不削弱授权/receipt/audit/readback。rowSQL只写owner表/任务型read。

| operation组 | 顺序/回放与条件 | 设计SQL分解（身份前置另按真实链计） |
| --- | --- | --- |
| stage/release | auth→I/O/parse→short stage tx；release仅owned，repeated no-op | stage授权读/元数据写/receipt；releaseowned读/CAS释放；禁止边上传边TX |
| register | 当前auth/space/权限→receipt互斥/同payload完成回放；仅首次stage/full复核→identity锁/claim→artifact/audit/receipt/readback | stage/identity/full读各≤1；identity/assetclaim/artifact/audit/receipt写；readback≤1 |
| platform page/detail | platform/space验证→SQL范围过滤→cursor/detailDTO | page1＋可选count1（不需要总数时不查）；detail1 |
| rule/project-report page/detail/candidates | workspaceRead→PROJECT taskscope（候选独立关联scope）→filter/query | 主scope1＋page/detail1；不把cap查作为GET前置 |
| create/status | grant/currentproject/refs→scope锁→receipt→target→row/audit/topic/receipt/readback | refs批量任务query1不是N；target join1；hash完整scopequery1；有界单rule写/audit/topic/receipt；锁计入DB操作 |
| snapshot page | credential/实际storeproject→REPEATABLE READ hash/page→pagehash核验 | credential/taskscope实际复用计；header1＋cursorpage1，末页再核验1 |
| issueGrant/content | credential/targetproject＋ALL或refs含boundStore的旧规则关联→每次新grant发行（哈希不能反推secret）；contentgrant/binding→private locator→stream | issuance授权join/活跃32项技术预算/写新grant/最多100过期行回收；contentgrant/绑定/read locator≤3任务读；stream无TX |
| HTTP 升级报告 | 当前credential/binding→owner advisory lock→sequence/key/body核验→task UPSERT→提交receipt | 同task一个记录，不同task历史保留；无TDS报告函数/第二失败存储/raw异常正文 |

幂等写key绑定operation、actor、space、canonicalpayload（file为digest，不把grant/token入key）；owner先重核当前权限/事实再receipt。stage parse结果不允许任意register提交重写；register同payload重放一artifact，同版本异内容拒绝。status同请求重放不改变updatedAt/createdAt。

## 6 · V-01～30 当阶段子断言映射

所有状态NOT_RUN。编号只定位需求，非runtime文件名。整条V跨阶段不可用本表局部PASS替代。

| V | B子断言/场景 | 未来执行面 | A/C剩余 |
| --- | --- | --- | --- |
| 01 | update.artifact.register：消费A两App真实产物及四字段 | backend-acceptance＋实际A产物 | A三脚本/安装证明；C自动 |
| 02 | update.artifact.reject：不同app/runtime声明与配对拒绝 | owner/HTTP | A/C本机拒绝 |
| 03 | register/reject/isolation：实际ZIP/APK/pub/签名、跨空间同内容 | backend-acceptance＋Android实际解析 | 无B减档 |
| 04 | reject/download.authorization：普通路径/大小超限/缺文件/坏摘要、ownedcleanup | focused/HTTP＋Android有效FULL/HOT prepare差量 | 恶意 ZIP symlink、截断中央目录、炸弹专项 NOT_COVERED/NOT_RUN；不宣称 V-04 全部通过，A active/native保护另列 |
| 05 | rule.permission/artifact.isolation/admin.journey | HTTP＋两后台L2 | 无B减档 |
| 06 | rule.lifecycle/admin.journey：不可编辑/createdAt/N/M | HTTP＋两后台L2 | C调度 |
| 07 | rule.lifecycle：ALL动态含新store、指定refs不扩、无用途字段 | owner/HTTP | C最新选择/同time稳定/零动作/App过滤 |
| 08 | report.actual：真实A FULL→HOT后报告 | 先Web非native，再Android＋DEV TDP | A执行核；C自动触发 |
| 09 | artifact.reject：同runtime同JS异pub保存拒绝 | owner/HTTP | A/C本机实际比较、已达到与零动作 |
| 10 | rule.lifecycle：CBS静态配对拒绝；report.actual消费A兼容来源 | HTTP＋A真实来源回归 | A中间JS4数据兼容；C自动准入 |
| 11 | rule.snapshot/rules.delivery：首次/重连/空窗/101规则/乱序 | focused＋Expo Web＋DEV真实CBS/TDS | 无B减档；Android同清单非adapter比较 |
| 12 | rules.delivery：本机context失效/退订失败可见 | focused＋Web | C副机常驻及sync |
| 13 | report.order：仅main报告，无副机server对象 | focused/HTTP/PG | C不同App双机执行/保护 |
| 14 | rules.delivery：snapshotflush失败不accept、不prepare | focused＋Web | A/C固定执行/双屏完整断言 |
| 15 | 不新增自动任务；source接口变化回归A续接 | A focused适用差量 | A/C每boot执行完整链 |
| 16 | 无installer改动；A差量仅source/prepare | A focused适用差量 | A/C用户取消/安装/N提醒 |
| 17 | download.authorization：grant过期仍原artifact/撤权/有限重试、无retryUI | HTTP＋Web＋Androidprepare | A失败标记；C规则不绕过 |
| 18 | N仅存规则不schedule | 规则HTTP/focused | C FULL提醒 |
| 19 | M仅存规则不schedule | 规则HTTP/focused | C点击/闲时/双机 |
| 20 | rules.delivery/report.recovery：stateflush失败/跨启动最新报告恢复 | focused＋Web＋Android同清单 | A/C受控应用flush/临时promise |
| 21 | 私有下载真实A HOT供给，字节SHA对应 | HTTP＋Android受影响prepare | A资源/Hermes离线加载；C双机 |
| 22 | sourcegrant/proxy失败、原目标不变 | focused＋Android适用差量 | A进程中断/native续接 |
| 23 | A原生保护不变 | 不重跑未受影响A已验收项 | A专项 |
| 24 | Aboot确认不变；report因reload重建session | focused＋Web/Android报告 | A原生T/双屏专项 |
| 25 | 保存不承诺判断业务schema；消费A发布兼容准入 | artifact/HTTP＋A准入输入 | A发布纪律/恢复专项 |
| 26 | 普通HTTP/报告失败不调用rollback/apply | focused | A真实恢复边界 |
| 27 | report.actual：FULL成功HOT失败实际版本/阶段分列 | Android实际A＋DEV＋PG | C自动/副机仅本地 |
| 28 | report.order/recovery/actual：ready/变化/离线/unknown/迟到 | focused＋Web先＋Android＋HTTP/PG | C自动后全链 |
| 29 | admin.journey：运营项目状态Tab及详情Drawer最后值、读权限/时间/任务报告历史分页 | HTTP＋两后台L2 | 无B减档 |
| 30 | reject/download/report.recovery：结构化脱敏与ownedcleanup | focused＋受管runner/Android适用差量 | A/C未受B修改路径 |

## 7 · UI冻结输入hash

`doc/heritage/frozen/catering-all-v2/apps/frontend/platform-admin/src/features/workspace-management/ui/`：WorkspaceManagementPage.tsx `0af9be8c884de227c28b875f4e41626f6a20d932b43e4ab6064289e7cbfe63dc`；CommercialGroupInitializationDrawer.tsx `3b40a5fdfe5cdcfa90bbc7f80944485acd9e47772893e77bf2d39ec32da85c6c`；WorkspaceDetailDrawer.tsx `f573ca9c02e3fc80cd35ee5e6e9b43933fa7579d87a79ac3c2a09a683e24852a`。本仓冻结检索集合无update对应页；currentfoundation替代基线说明见UI §3。

## 8 · 已冻结的差量接缝

SCOPE：operations新增第15项固定refs分页任务GET，原getOperationsOrganizationCandidates保留PagePaged；不会把现有页码operation冒称cursor。门店候选只作关系读取，固定refs可含已停用/作废对象。store-basic新增storeOrganizationPathLoadedCommand及selectStoreBasicLoadReadiness，返回本boot runtimeId/binding/projectRef/storeStatus/projectStatus（各idle/loading/flushed/failed），各HTTP成功且flush完成才flushed；成功command与selector同一非持久加载事实。ui/integration桥晚装配仍读两项合取；base update不import store-basic feature；PROJECT失败/旧hydrated/null/迟到均明确不触发。

报告走CBS typed HTTP POST；失败正文归升级owner持久pending，由有效PONG public/local command触发补发，无ACK timer/report重连。普通WS断线仍允许有合法凭证的HTTP报告和grant；stage保存完成重放先receipt后跳过已消费stage。秘密不落盘，不把静态设计/旧结果当PASS。

## 9 · UI实际动作、DOM与提交变体（唯一实现定位表）

下表每组动态option/row/field以ref/field参数构造TestId，实施仍逐个表达式挂到真正可交互DOM；列举组不是豁免未列节点。所有proof均PLANNED/NOT_RUN；源码路径为拟新增文件，实施必须核对实际节点、事件handler和请求，不以TestId常量存在判PASS。各交互面只复用foundation行为，不复制dirty/HTTP/分页。UI roster同步引用本表。

P=apps/frontend/platform-admin/src/features/terminal-update-package；O=apps/frontend/operations-admin/src/features/terminal-update-rule。P/O各terminalUpdatePackageTestIds.ts/terminalUpdateRuleTestIds.ts；不使用screen ID命名文件。

| 交互ID/实际action | owning组件/常量（引用9.1） | 真正DOM/行为与提交 | focused/red（计划） |
| --- | --- | --- | --- |
| PKG-LIST查询/重置/筛选/回车 | P/ui/TerminalUpdatePackagePage.tsx；PKG_FILTER_KIND/APP/RUNTIME、PKG_QUERY/RESET | Select/Input/Button；显式提交，cursor重置 | 跨空间/迟到、无查询不乱发 |
| PKG-LIST分页/标题/新建/重试 | 同组件；PKG_PREVIOUS/NEXT、PKG_TITLE(ref)、PKG_UPLOAD、PKG_RETRY | 真实按钮打开编辑/详情、分页/refetch | 页2、scope清除 |
| PKG-UPLOAD文件/解析/最小FULL搜索选择加载 | P/ui/TerminalUpdateArtifactUploadDrawer.tsx；PKG_FILE、PKG_PARSE_STATE/REASON、PKG_MIN_FULL、PKG_MIN_FULL_QUERY_TEXT/OPTION(ref)/NEXT | 真实fileinput；防抖query、Select option、加载更多 | file替换release、两页、五事实拒绝 |
| PKG-UPLOAD保存/关闭/dirty | 同组件；PKG_SAVE/CANCEL/CLOSE、DIRTY_CONFIRM/CANCEL | 当前stage immutable register；既有lifecycle唯一dirty | 响应丢失、换scope、release失败 |
| PKG-DETAIL事实/关闭/重试 | P/ui/TerminalUpdateArtifactDetailDrawer.tsx；PKG_DETAIL、PKG_FACT(field)、PKG_DETAIL_CLOSE/RETRY | Descriptions真实文本＋按钮 | readonly、404 |
| 左右Tab/缺项目引导 | O/ui/ProjectTerminalUpdatePage.tsx；PROJECT_RULES_TAB/PROJECT_REPORT_TAB、PROJECT_SCOPE_GUIDANCE | AntD真实trigger，缺项目引导既有shell | dirty阻断；不造第二项目选择器 |
| RULE-LIST筛选/查询/新建/标题/分页/重试 | O/ui/TerminalUpdateRuleList.tsx；RULE_FILTER_STATUS/APP/CREATED_RANGE、RULE_QUERY/RESET、RULE_CREATE、RULE_TITLE(ref)、RULE_PREVIOUS/NEXT/RETRY | ProTable显式过滤；真实标题/按钮 | 无写cap仍可读、页2 |
| RULE-CREATE目标/候选 | O/ui/TerminalUpdateRuleCreateDrawer.tsx；RULE_TARGET_MODE、RULE_CANDIDATE、RULE_CANDIDATE_QUERY_TEXT/OPTION(ref)/NEXT、RULE_FIXED_FULL/HOT | Select防抖/加载更多，readonly配对 | 模式切换清旧目标 |
| RULE-CREATE门店范围/候选 | 同组件；RULE_STORE_SCOPE/SEARCH/OPTION(ref)/NEXT | Radio、PagePaged多选、防抖搜索/加载更多 | ALL清refs、两页回显 |
| RULE-CREATE条件字段/提交/dirty | 同组件；RULE_INITIAL_STATUS/N/HOT_STRATEGY/M/DESCRIPTION、RULE_FIELD_ERROR(field)、RULE_SAVE/CANCEL/CLOSE、DIRTY_CONFIRM/CANCEL | 真实Select/InputNumber/Radio/TextArea/Button | 撤权零写、失败保留、FULL清HOT字段 |
| RULE-DETAIL事实/操作/启停/门店分页/关闭 | O/ui/TerminalUpdateRuleDetailDrawer.tsx；RULE_DETAIL、RULE_FACT(field)、RULE_DETAIL_ACTION、RULE_AUDIT_OPEN、RULE_ENABLE/DISABLE、RULE_STORES_PREVIOUS/NEXT、RULE_DETAIL_CLOSE/RETRY | header menuitem、只读分页、Descriptions | 无cap无写菜单、历史refs仍展示 |
| RULE-STATUS确认/取消/原因 | 同组件StatusChangeConfirm；RULE_STATUS_MODAL/REASON/CONFIRM/CANCEL | 真实Modal按钮，当前revision/key | CAS失败不重派、焦点归还 |
| PROJECT-REPORT筛选/门店候选/查询 | O/ui/ProjectTerminalVersionReportTab.tsx；PROJECT_REPORT_STORE、PROJECT_REPORT_STORE_SEARCH/OPTION(ref)/NEXT、PROJECT_REPORT_QUERY_TEXT/APK_VERSION/JS_VERSION/RUNTIME_VERSION/QUERY/RESET | 门店防抖＋加载更多；正式列表显式提交storeRef | 跨项目、无写cap、NO_REPORT |
| PROJECT-REPORT标题/事实/分页/重试 | 同组件；PROJECT_REPORT_TABLE、PROJECT_REPORT_TITLE(ref)、PROJECT_REPORT_FACT(ref,field)、PROJECT_REPORT_PREVIOUS/NEXT/RETRY | 真实标题打开只读详情、标准分页 | 未上报终端仍有行、切scope旧回包 |
| PROJECT-REPORT-DETAIL事实/历史分页/关闭/重试 | O/ui/ProjectTerminalVersionDetailDrawer.tsx；PROJECT_REPORT_DETAIL、PROJECT_REPORT_DETAIL_FACT(field)、PROJECT_REPORT_HISTORY_TABLE、PROJECT_REPORT_HISTORY_ROW(taskId)、PROJECT_REPORT_HISTORY_PREVIOUS、PROJECT_REPORT_HISTORY_NEXT、PROJECT_REPORT_HISTORY_RETRY、PROJECT_REPORT_DETAIL_CLOSE/RETRY | 标准Drawer/Descriptions/Table/CursorPagination/Button | NO_REPORT、旧binding、未知码中文、每task一行/跨页 |

### 9.1 唯一TestId常量表

以下为唯一命名来源；UI各roster与§12只引用本表，不能另写近义常量。静态项挂当前真实DOM；ref/field是既有强类型createTestId key输入，非页面/Journey文件命名。DIRTY两项引用既有lifecycle附属确认面，宿主surface上下文限定；page/Drawer容器有标识但不能代替真实按钮/输入。事实wrapper读取textContent，不假设存在内层input。

| 交互面 | 完整常量/工厂（括号为key） |
| --- | --- |
| PKG-LIST | PKG_PAGE、PKG_UPLOAD、PKG_FILTER_KIND、PKG_FILTER_APP、PKG_FILTER_RUNTIME、PKG_QUERY、PKG_RESET、PKG_TITLE(ref)、PKG_PREVIOUS、PKG_NEXT、PKG_RETRY |
| PKG-UPLOAD | PKG_UPLOAD_DRAWER、PKG_FILE、PKG_PARSE_STATE、PKG_PARSE_REASON、PKG_MIN_FULL、PKG_MIN_FULL_QUERY_TEXT、PKG_MIN_FULL_OPTION(ref)、PKG_MIN_FULL_NEXT、PKG_SAVE、PKG_CANCEL、PKG_CLOSE、DIRTY_CONFIRM、DIRTY_CANCEL |
| PKG-DETAIL | PKG_DETAIL、PKG_FACT(field)、PKG_DETAIL_CLOSE、PKG_DETAIL_RETRY |
| RULE-LIST | RULE_PAGE、PROJECT_RULES_TAB、PROJECT_REPORT_TAB、PROJECT_SCOPE_GUIDANCE、RULE_CREATE、RULE_FILTER_STATUS、RULE_FILTER_APP、RULE_FILTER_CREATED_RANGE、RULE_QUERY、RULE_RESET、RULE_TITLE(ref)、RULE_PREVIOUS、RULE_NEXT、RULE_RETRY |
| RULE-CREATE | RULE_CREATE_DRAWER、RULE_TARGET_MODE、RULE_CANDIDATE、RULE_CANDIDATE_QUERY_TEXT、RULE_CANDIDATE_OPTION(ref)、RULE_CANDIDATE_NEXT、RULE_FIXED_FULL、RULE_FIXED_HOT、RULE_STORE_SCOPE、RULE_STORE_SEARCH、RULE_STORE_OPTION(ref)、RULE_STORE_NEXT、RULE_INITIAL_STATUS、RULE_N、RULE_HOT_STRATEGY、RULE_M、RULE_DESCRIPTION、RULE_FIELD_ERROR(field)、RULE_SAVE、RULE_CANCEL、RULE_CLOSE、DIRTY_CONFIRM、DIRTY_CANCEL |
| RULE-DETAIL | RULE_DETAIL、RULE_FACT(field)、RULE_DETAIL_ACTION、RULE_AUDIT_OPEN、RULE_ENABLE、RULE_DISABLE、RULE_STORES_PREVIOUS、RULE_STORES_NEXT、RULE_DETAIL_CLOSE、RULE_DETAIL_RETRY |
| RULE-STATUS | RULE_STATUS_MODAL、RULE_STATUS_REASON、RULE_STATUS_CANCEL、RULE_STATUS_CONFIRM |
| PROJECT-REPORT | PROJECT_REPORT_TABLE、PROJECT_REPORT_STORE、PROJECT_REPORT_STORE_SEARCH、PROJECT_REPORT_STORE_OPTION(ref)、PROJECT_REPORT_STORE_NEXT、PROJECT_REPORT_QUERY_TEXT、PROJECT_REPORT_APK_VERSION、PROJECT_REPORT_JS_VERSION、PROJECT_REPORT_RUNTIME_VERSION、PROJECT_REPORT_QUERY、PROJECT_REPORT_RESET、PROJECT_REPORT_TITLE(ref)、PROJECT_REPORT_FACT(ref,field)、PROJECT_REPORT_PREVIOUS、PROJECT_REPORT_NEXT、PROJECT_REPORT_RETRY |
| PROJECT-REPORT-DETAIL | PROJECT_REPORT_DETAIL、PROJECT_REPORT_DETAIL_FACT(field)、PROJECT_REPORT_HISTORY_TABLE、PROJECT_REPORT_HISTORY_ROW(taskId)、PROJECT_REPORT_HISTORY_PREVIOUS、PROJECT_REPORT_HISTORY_NEXT、PROJECT_REPORT_HISTORY_RETRY、PROJECT_REPORT_DETAIL_CLOSE、PROJECT_REPORT_DETAIL_RETRY |
| RULE-AUDIT | 入口复用本表RULE-DETAIL的RULE_AUDIT_OPEN；Modal内部全部复用OperationsAuditHistoryModal既有TestIds，不另造别名 |


| 提交变体 | visible/mutable字段 | readonly/server-derived或秘密不落UI | 身份与失效（所有失败原位） |
| --- | --- | --- | --- |
| stage/release | ZIP file；release由生命周期发起无用户ref输入 | digest/actual解析/space/actor/stageRef；不显示对象key | session/space+ownedstage，换scope旧结果废弃 |
| register FULL/HOT | 仅HOT minFULL候选可选，必须五事实匹配；保存一次 | parsedidentity/filehash由stage，operation receipt内容key；版本非手填 | 当前actor/space授权→receipt重放→仅首次stage/claim |
| create FULL-only | fullRef、scope/refs、status、N、description | app/platform/runtime、project/createdAt/ref由owner；无hot/M | PROJECT+W-P；server复核refs；不可编辑 |
| create paired HOT | hotRef固定minFULL、scope/refs/status/N/strategy；IDLE有M | minFULL不可改；IMMEDIATE无M | 同上；cutpoint及epoch防旧选项提交 |
| enable/disable | 确认本详情的动作 | ruleRef/revision当前readback、receiptkey；createdAt不改 | 当前授权/CAS；拒绝不自动再派 |
| report/query | storeRef/queryText/currentApkVersion/currentJsVersion/runtimeVersion/pager，纯GET | currentproject=context，binding实际由owner判 | O-P/当前scope；无W-P、无target字段补actual |
| terminal供给/grant/report | 无人工页面/输入 | TDC凭证三头、transient grant、native actual；selector/command通路 | currentboot/binding/config/session；秘密不持久/不落日志 |

## 10 · 标准容器复用表（不新造容器）

| 功能 | 已有真实能力/来源 | 本批只提供的业务参数 | 禁止事项 |
| --- | --- | --- | --- |
| 三列表及查询表单 | @ant-design/pro-components ProTable；platform PlatformReadPage.tsx、operations ContractManagementPage.tsx现有consumer | ProColumns/search字段/filter显式提交/currentData/adminListState/contextScopedQueryArgs | 自建查询面/列表壳/重复HTTP生命周期；用历史页面不规范项推豁免 |
| cursor分页 | foundation useCursorStack/CursorPagination | queryIdentity/cursor/limit/nextCursor；ProTable pagination=false | 用内置page分页代cursor；自己写游标栈/双pager |
| 包/规则/报告详情 | foundation useDetailDrawer/adminWideDrawerSurfaceProps/adminWideDetailDescriptionsProps＋现有AntD Drawer/Descriptions | 当前scope/目标ref/detail currentData/字段/关闭；规则单一AdminDetailActionMenu | 行内展开/Card替代标准详情；空操作菜单/无授权写 |
| 上传/新建表单 | adminDrawerSurfaceProps或标准wide档＋useDrawerFormLifecycle/useSubmissionLifecycle/Form | ZIP真实fileinput/字段规则/业务内容幂等/反馈 | 自建编辑壳/关闭guard/dirty提示；把未知field塞自由JSON |
| 候选 | app useOrganizationCandidates（门店）＋foundation useCursorCandidates（包）；现有Select；PagePaged门店与CursorPaged包分别协议 | query/option label/identity/两页回显 | 自写分页选择器/抽干全量候选 |
| 启停 | foundation StatusChangeConfirm | actionLabel/revision/idempotency/typed失败 | 自建确认面/额外提示 |
| 项目双Tab | 现有AntD Tabs＋shell统一refresh/overlay locked | 左更新规则/右终端更新状态，当前project，各自查询状态 | 自建Tab容器/第二全局刷新事件/dirtyowner |

以上来源已纯读取核对foundation src/index.ts、PlatformReadPage/ContractManagementPage imports。具体库版本解析、组件行为、打包与UI验证仍NOT_RUN，候选API props实施前沿同版本source核实，不凭记忆创造不存在的“通用容器”。

## 11 · 18项 HTTP 的逐请求契约（实施前冻结，非运行证明）

### 11.1 共同来源与明确生成分界

输入正本：`contracts/openapi-source/terminal-update.schemas.json`（拟新增）及R5 edge catalog；基础错误正本 `errorSets`＋逐operation `operationErrorAugmentations`，新增码以 `TERMINAL_UPDATE_` 前缀进入 `2026-07-26-v2s-r5-error-code-disposition-catalog.json.v2sNativeCodes`；下表不以裸family另立孤立异常集合。本文简名INVALID等分别指 `TERMINAL_UPDATE_ARTIFACT_INVALID` 等完整code，已有COMMON/DEPENDENCY/credential code保持原名/状态。NOT_FOUND用现有 `PLATFORM_COMMON_RESOURCE_NOT_FOUND`，CAS旧revision用现有 `PLATFORM_COMMON_VERSION_CONFLICT`，幂等冲突用现有 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`。HTTP层不得把其余typed code全改401。

生成：全局catalog的18项均经r5-edge-materialize→edge-codegen生成三面edge合同；TDC `terminal-client-generation.json.includeOperationIds`只新增 **terminalReadProjectUpdateRuleSnapshotPage、issueTerminalUpdateArtifactDownloadGrant、submitTerminalUpdateReport** 三项JSON（有NoBody请求包装schema/唯一JSON成功schema）。downloadTerminalUpdateArtifact是NoBody＋`TerminalUpdateBinaryContent`（string/binary，application/zip）及grant-only安全方案，不进TDC JSON executor；其binary能力在现有edge-codegen的content/schema分支扩受保护头类型及三面binding，不能虚构JSON response或terminalCredential security。JSON generator仍拒绝binary误入名单的红fixture。

CBS grant JSON response包含 `{relativeContentPath,grant,expiresAt,artifactRef,zipSha256,byteSize}`，path通过edge生成路由常量＋已授权artifactRef构造，grant header名在相同canonical header定义生成后传给source provider；provider用server-config/transport公开地址能力解析当前前缀（不得新读凭证）。UpdatePort拿完整本attempt受保护URL和唯一 `X-Terminal-Update-Grant` header，native按port输入GET bytes，不自拼业务路径，不依赖JSON executor，不另生native SDK。库之外只有此有限descriptor消费；JSON与native source hash/路径/header契约漂移为focused红例。安全scheme `terminalUpdateDownloadGrant` 只用于content，独立于terminalCredential；全局security registration及edge renderer同批支持，暂无实现PASS。

共同请求分类：P为platform cookie＋现有group-workspaces/{groupWorkspaceKey}路径（不是新自造space header）；O为operations cookie＋同workspace路径及query/body required expectedContextVersion；T为三terminal鉴权头。GET全部idempotency FORBIDDEN/expectedVersion FORBIDDEN；新register/create/status REQUIRED_16_128；status revision REQUIRED。stage沿existing stage REQUIRED_16_128及digest；release沿existing release FORBIDDEN且owner stage grant；grant POST FORBIDDEN（每请求发新短期token，不假重放secret）；report POST REQUIRED_16_128（稳定reportId作幂等key，同body重送）；content FORBIDDEN。required参数缺失拒绝，不把客户端project当授权来源。

为下表省列而定义normal前提，都是**本期计划的精确计数假设**，不是已有测量：P=平台session/管理员同一查询1R＋enabled workspace1R（2R）；O=GROUP正常fixture的workspace activeAuthorizationRow1R＋visible hierarchy/store/headCompany3R＋PROJECT任务path1R（5R）；W=commandAuthorizationFacts1R＋enabled PROJECT commandTaskPathFacts1R（2R），generated requirement/capability、context比较和owner grant字段匹配均为内存判断，不调用readAuthorizationFacts扩展候选；owner在其首条目标查询中落实当前scope/invariant，相关查询已在各行target/row中计入，不另造grant表或重复auth读取。T=existing credential currentbinding验证1R＋boundStore真实project任务join1R（2R）。各项包含security/context；不得在edge和owner重新装一份相同事实。这里是固定fresh正常fixture，不含过期session刷新/失败分支/回放。CP-01需沿现有PlatformSessionResolver、OperationsSessionResolver、WorkspaceCapabilityScopeResolver、credential implementation SQL逐项核对origin；发现假设不符即**修订此声明及catalog budget，保留正确性**，不得压缩正常事实来符合数字；CP-01退出前不能留“另计”。实施测量与声明比对，不是提前获准上调。

当前source锚点：platform IAM `PlatformAuthenticationService.requireActiveSession:266`→`PlatformAuthenticationPersistence.findActiveSession:207`是一条查询；workspace `WorkspaceAdministrationService.requireEnabled:136`→require/findByKey一条。operations `WorkspaceAuthenticationService.readAuthorizationFacts:395`与commandAuthorizationFacts:429两条入口不混用；`OrganizationVisibilityPersistence:134–222`的GROUP正常fixture有三条可见事实读取，`OrganizationTaskPathPersistence.requireEnabledProjectTaskPath:232`一条PROJECT路径查询；`WorkspaceCapabilityScopeResolver:390–422`复用command事实中的assignment/capability；`organization/api/OperationsOwnerScopeGrant.java`匹配不访问DB。均在当前源码只读确认；拟新增owner SQL计数仍为计划，不声称实测。

### 11.2 精确 operation 设计表

各表行N-*是具名normal fixture key，fixture在 `TerminalUpdateAcceptanceScenarios.java` 通过真实HTTP创建。**完整 databaseOperationCount=SQL execution＋CONNECTION＋TRANSACTION**，与 `DatabaseOperationTracker.MEASUREMENT_BASIS=JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH` 对齐。下面R/W/锁只是SQL诊断分解，不是完整预算；每个锁执行计一条SQL，pg_notify调用也计一条执行。正常fixture无batch（batch执行0、所有SQL logical batchSize=1）；未来batch按既有tracker同时报告physical execution与logicalStatementCount，不能混替。`CountingDataSource:72–78/109–115/131–136`每次借连接计1、setAutoCommit(false)和commit各计1，因此一次正常独立REQUIRED/read-only事务=1C＋2TX；参与既有REQUIRED不会重复begin/borrow。异常rollback是失败fixture，不能套正常数；对象/工具I/O不算DB。

分页normal为初页limit20、无count、无optional过滤、无cachemiss，关联门店两条；status normal为DISABLED→ENABLED（PROJECT仍enabled，不走组织节点停用路径）；grant normal为0活跃且回收0行（有界DELETE仍算1）；register normal无receipt、无该版本/publication身份行，FULL首次保存，故身份insert计1W且不执行HOT最小FULL校验。HOT/既有同pub重放、非GROUP角色、末页hash复核属于具名边界fixture，另列分解，不能冒充此normal。

register、release、所有GET、rule command、snapshot、grant/content authorize由下述app application operation建立一个短事务，身份与owner参与同一事务，stream/parse始终在外。stage无outerTX：平台session与workspace两个现有短read事务，bounded parse/storage，最后asset stage/receipt短事务，共3C＋6TX；actor/space ownership按asset公开command复核，不为减少借连接把网络I/O包入长事务。CP-01按实际复用origin核对这些正常假设；任何新增事务/connection/batch都进入完整预算，不以SQL数遮蔽，不申请隐性例外。

| operation（详设§5原path/face不变） | 输入→成功DTO/status | errorSetRef；有序增补条件（基础先auth/context） | normal fixture；SQL诊断=R/W/锁（完整计数见下表） | 调用顺序与事务origin（方法见11.3） |
| --- | --- | --- | --- | --- |
| stagePlatformTerminalUpdateArtifact | multipart file＋digest/usage常量→TerminalUpdateStageResult/201 | OWNER_COMMAND；bytes/path/manifest无效→INVALID422；tool不可用→PLATFORM_DEPENDENCY_UNAVAILABLE503；槽满→BUSY503 | N-stage-full；8=5R/2W/1锁：P2、receipt1、space owner1、stage readback1；stage/receipt2；receipt互斥1 | edge→StageHandler无outerTX：P→bounded parse/storage→asset短REQUIRED stage/receipt/readback；失败释放own tmp |
| registerPlatformTerminalUpdateArtifact | stageRef＋stageBindGrant；FULL无minFullRef/HOT必选minFullRef→ArtifactDetail/201 | OWNER_COMMAND；stage非本actor→STAGE_NOT_OWNED403；expired→STAGE_EXPIRED409；五事实错→MINIMUM_FULL_INVALID422；pub冲突→PUBLICATION_CONFLICT409 | N-register-full；14=7R/5W/2锁：P2、receipt/stage/identity/owner/readback5；assetclaim/identity/artifact/audit/receipt5；receipt与pub2 | RegisterHandler REQUIRED中P/context→receipt完成分支；首次stage/full→pub lock→assetclaim→artifact/audit/receipt→readback；无网络 |
| releasePlatformTerminalUpdateArtifactStage | stageRef＋X-Asset-Bind-Grant，NoBody→204 | OWNER_COMMAND；非本actor/space→STAGE_NOT_OWNED403；已释放同owner no-op；秘密坏用现有asset grant拒绝 | N-release；5=4R/1W/0锁：P2＋stage当前1＋owner1；CASrelease1 | ReleaseHandler短REQUIRED→asset既有release参与；对象回收TX外；禁止owner不符回收 |
| getPlatformTerminalUpdateArtifactPage | kind/appId/runtimeVersion/queryText/cursor/limit及可选minimumFullNativeBuildNumber/minimumFullPublicationId/minimumFullApkSha256整组→ArtifactPage/200 | AUTHZ_READ；filter/cursor坏→COMMON_VALIDATION_FAILED422；page预算→SNAPSHOT_TOO_LARGE413 | N-platform-page；3=3R/0W/0：P2＋page1 | app PlatformReadHandler readonly内Pread→TaskRead.page；UUID降序cursor，kind/app/runtime及minimumFull整组为server filter，queryText在相同过滤集合中搜索 |
| getPlatformTerminalUpdateArtifactDetail | artifactRef→ArtifactDetail/200 | AUTHZ_READ；缺失/异space→COMMON_RESOURCE_NOT_FOUND404 | N-platform-detail；3=3R/0W/0：P2＋detail1 | app PlatformReadHandler readonly内Pread→TaskRead.artifact；不返回secret/key/publicURL |
| getOperationsProjectTerminalVersionPage | projectRef；expectedContextVersion/storeRef/queryText/currentApkVersion/currentJsVersion/runtimeVersion/cursor/limit→VersionPage/200 | AUTHZ_READ；filter坏→COMMON_VALIDATION_FAILED422；store异project→SCOPE_MISMATCH403 | N-report-page；6=6R/0W/0：O5＋启用门店＋启用terminal LEFT JOIN当前report page1 | edge→ProjectReadHandler readonly事务内O→TaskRead.reportPage；NO_REPORT合法item |
| getOperationsProjectTerminalUpdateRulePage | projectRef；expectedContextVersion/status/appId/createdFrom/createdTo/cursor/limit→RulePage/200 | AUTHZ_READ；filter/cursor坏→COMMON_VALIDATION_FAILED422 | N-rule-page；6=6R/0W/0：O5＋page1 | ProjectReadHandler O→TaskRead.rules；createdAt DESC UUID DESC |
| getOperationsProjectTerminalUpdateRuleDetail | projectRef/ruleRef；expectedContextVersion→RuleDetail/200 | AUTHZ_READ；无rule/异scope→COMMON_RESOURCE_NOT_FOUND404 | N-rule-detail；6=6R/0W/0：O5＋detail1 | ProjectReadHandler O→TaskRead.rule；refs另专用pager，不全量塞DTO |
| createOperationsProjectTerminalUpdateRule | projectRef；expectedContextVersion/scope/fullRef/hotRef/status/N/strategy/M/description→RuleDetail/201 | OWNER_COMMAND；范围/refs错→SCOPE_MISMATCH403；pair/条件字段错→RULE_TARGET_INVALID422；idempotency同key异内容沿COMMON409 | N-create-pair-all；13=6R/5W/2锁：W2＋receipt/target/hash/readback4；rule/audit/topic/notify/receipt5；scope/receipt2 | RuleCommandHandler REQUIRED：resolve current W（不调用O读投影）→targets→scope lock→receipt→row/audit/hash/topic/notify/receipt/readback；scope查询在锁后 |
| changeOperationsProjectTerminalUpdateRuleStatus | projectRef/ruleRef；expectedContextVersion/revision＋status（ENABLED或DISABLED目标状态）→RuleDetail/200 | OWNER_COMMAND；缺失→COMMON404；CAS旧→COMMON_VERSION_CONFLICT409；目标无效→RULE_TARGET_INVALID422 | N-enable；14=7R/5W/2锁：W2＋row/receipt/target/hash/readback5；与create同5W；scope/receipt2 | 同RuleCommandHandler REQUIRED；禁edge构造CommandContext；owner授权先receipt/CAS；createdAt不变 |
| getOperationsTerminalUpdateArtifactCandidatePage | expectedContextVersion/projectRef/queryText/kind/appId/runtimeVersion/minimumFullRef/cursor/limit→ArtifactCandidatePage/200 | AUTHZ_READ；关联参数不合法→COMMON_VALIDATION_FAILED422 | N-candidate；6=6R/0W/0：O5＋candidate1 | ProjectReadHandler O→TaskRead.candidates，同space可读关联；不以W-P前置 |
| terminalReadProjectUpdateRuleSnapshotPage | T；projectRef/cursor/limit/collectionHash→RuleSnapshotPage/200 | TERMINAL_DATA_READ；hash变化→SNAPSHOT_CHANGED409；总预算→SNAPSHOT_TOO_LARGE413 | N-snapshot-first；4=4R/0W/0：T2＋hash header1＋page1；末页再读hash则5 | TerminalSnapshotHandler短REPEATABLE_READ：T→当前hash→page→末页复核；TDC typed query、完整flush后accept |
| issueTerminalUpdateArtifactDownloadGrant | T；artifactRef/NoBody→DownloadGrantResult/200 | TERMINAL_DATA_READ；target不属覆盖boundStore的合法已创建rule→ARTIFACT_NOT_AUTHORIZED403；32活跃满→BUSY503 | N-grant；8=5R/2W/1锁：T2＋target association1＋active budget1＋readback1；过期DELETE/insert2；复用AdvisoryLock binding预算锁1 | DownloadHandler REQUIRED：T→固定rule association（同project、ALL或refs含boundStore，含停用）→owner binding预算锁→bounded expire→budget→newtoken hash/insert；secret只返回一次 |
| downloadTerminalUpdateArtifact | artifactRef；X-Terminal-Update-Grant/NoBody→application/zip binary/200 | 拟新增TERMINAL_UPDATE_CONTENT_READ={COMMON_VALIDATION_FAILED,COMMON_ACCESS_DENIED,COMMON_GROUP_WORKSPACE_DISABLED,COMMON_RESOURCE_NOT_FOUND,PLATFORM_DEPENDENCY_UNAVAILABLE}；grant坏/过期→GRANT_EXPIRED403；identity/target变→ARTIFACT_NOT_AUTHORIZED403 | N-content；3=3R/0W/0：hashgrant/artifact1＋current binding1＋assetlocator1 | ContentHandler readonly短TX authorizeContent→asset定位；退出TX stream；流中断不改业务成功/不记录rawtoken |
| getOperationsProjectTerminalUpdateRuleStorePage | projectRef/ruleRef；expectedContextVersion/cursor/limit→RuleStorePage/200 | AUTHZ_READ；缺rule→COMMON404；cursor错→COMMON_VALIDATION_FAILED422 | N-fixed-ref-page；7=7R/0W/0：O5＋rule1＋refs组织任务join1 | ProjectReadHandler O→TaskRead.ruleStores；停用/作废及UNKNOWN引用不消失，UUID ASC |
| getOperationsProjectTerminalVersionDetail | projectRef/terminalRef；expectedContextVersion→TerminalVersionDetail/200 | AUTHZ_READ；不存在/异project→COMMON404 | N-report-detail；6=6R/0W/0：O5＋currentterminal/report join1 | ProjectReadHandler O→TaskRead.reportDetail；含NO_REPORT、旧binding；无STORE授权 |
| submitTerminalUpdateReport | T三头；idempotencyKey=reportId，body={reportId,reportSequence,taskId或null,actual,recent}→TerminalUpdateReportReceipt/200 | 拟新增TERMINAL_UPDATE_REPORT_WRITE={TERMINAL_DATA_READ七码,PLATFORM_COMMON_RESULT_UNKNOWN,TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT}；ACCEPTED/SUPERSEDED及各error处置唯一见D§8.5，PG不可用503可重试 | N-report-write；5=3R/1W/1锁：T2＋current/binding maxsequence任务查询1，报告UPSERT1，binding锁1 | app TerminalUpdateReportHandler REQUIRED：credential→owner RecordReportService→PG commit后receipt；首次/同task/旧task覆盖规则按D8.5 |
| getOperationsProjectTerminalUpdateReportHistoryPage | projectRef/terminalRef；expectedContextVersion/cursor/limit≤100→TerminalUpdateReportHistoryPage/200 | AUTHZ_READ；停用目标/异project沿scope/缺失拒绝，cursor坏422 | N-report-history；7=7R/0W/0锁：O5＋启用terminal/project目标1＋task历史page1 | ProjectReadHandler readonly→TaskRead.reportHistory；taskId非空，receivedAt DESC/taskId DESC，cursor绑定scope/terminal/filters |

### 11.2a 正常fixture的完整DB计数（同一18项，禁止以SQL列替代）

| operation / normal fixture | SQL execution | CONNECTION | TRANSACTION(begin＋commit) | batch execution | 完整 databaseOperationCount | normal事务origin |
| --- | --- | --- | --- | --- | --- | --- |
| stagePlatformTerminalUpdateArtifact / N-stage-full | 8 | 3 | 6 | 0 | 17 | 无outerTX；session、workspace、asset stage三个短事务 |
| registerPlatformTerminalUpdateArtifact / N-register-full | 14 | 1 | 2 | 0 | 17 | app RegisterHandler REQUIRED；asset claim参与 |
| releasePlatformTerminalUpdateArtifactStage / N-release | 5 | 1 | 2 | 0 | 8 | app ReleaseHandler短REQUIRED；asset release参与；对象删除在外 |
| getPlatformTerminalUpdateArtifactPage / N-platform-page | 3 | 1 | 2 | 0 | 6 | app PlatformReadHandler readonly |
| getPlatformTerminalUpdateArtifactDetail / N-platform-detail | 3 | 1 | 2 | 0 | 6 | 同上 |
| getOperationsProjectTerminalVersionPage / N-report-page | 6 | 1 | 2 | 0 | 9 | app ProjectReadHandler readonly |
| getOperationsProjectTerminalUpdateRulePage / N-rule-page | 6 | 1 | 2 | 0 | 9 | 同上 |
| getOperationsProjectTerminalUpdateRuleDetail / N-rule-detail | 6 | 1 | 2 | 0 | 9 | 同上 |
| createOperationsProjectTerminalUpdateRule / N-create-pair-all | 13 | 1 | 2 | 0 | 16 | app RuleCommandHandler REQUIRED；当前command facts及owner复核同事务 |
| changeOperationsProjectTerminalUpdateRuleStatus / N-enable | 14 | 1 | 2 | 0 | 17 | 同上 |
| getOperationsTerminalUpdateArtifactCandidatePage / N-candidate | 6 | 1 | 2 | 0 | 9 | app ProjectReadHandler readonly |
| terminalReadProjectUpdateRuleSnapshotPage / N-snapshot-first | 4 | 1 | 2 | 0 | 7 | app SnapshotHandler REPEATABLE_READ；末页额外hash read时完整8 |
| issueTerminalUpdateArtifactDownloadGrant / N-grant | 8 | 1 | 2 | 0 | 11 | app DownloadHandler REQUIRED；owner绑定预算锁在expire/count/insert之前 |
| downloadTerminalUpdateArtifact / N-content | 3 | 1 | 2 | 0 | 6 | app DownloadHandler authorizeContent readonly；退出后stream |
| getOperationsProjectTerminalUpdateRuleStorePage / N-fixed-ref-page | 7 | 1 | 2 | 0 | 10 | app ProjectReadHandler readonly |
| getOperationsProjectTerminalVersionDetail / N-report-detail | 6 | 1 | 2 | 0 | 9 | 同上 |
| submitTerminalUpdateReport / N-report-write | 5 | 1 | 2 | 0 | 8 | app ReportHandler短REQUIRED，owner锁/读/UPSERT；receipt由当前报告行重建，不新建每阶段receipt流水 |
| getOperationsProjectTerminalUpdateReportHistoryPage / N-report-history | 7 | 1 | 2 | 0 | 10 | app ProjectReadHandler readonly；O授权、target、历史分页 |

以上是计划冻结的normal声明，非现有SQL或运行PASS；catalog budget/normalFixture及acceptance fixture必须采用这张完整口径，并输出kindCounts/connectionBorrowCount/transactionBeginCount/logicalStatementCount辅助诊断。CP-01定稿后不得仍以SQL-only数字填databaseOperationCount。事务/测量范围若与现有filter不同，沿CountingDataSource和HTTP completion实际origin修声明，不修改计数器来救绿。

报告已是第17项HTTP operation；normal-count不再有WS旁路。JSON report/receipt沿canonical→edge-codegen→terminal生成链消费，完整预算在§11.2a声明；提交history与当前读取保持单一owner。标准审计复用getOperationsEntityAuditHistory，扩现有entity闭集/TaskRead而非另生operation。

### 11.3 精确方法与调用路径

Pedge=`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/PlatformTerminalUpdateController.java`；Oedge=同edge/operations/OperationsTerminalUpdateController.java；Tedge=同edge/terminal/TerminalUpdateController.java；下面handler全部落在CBS **app源码** `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/terminalupdate/`（拟新增），模式对照当前app `src/main/java/com/catering/v2s/catalog/application/operations/CreateOperationsCatalogItemOperation.java:33–47`。它们承接edge解码后的Invocation，在app application层建立短事务和当前command/read事实，再调用 `modules/terminal-update/.../api` 与其owner application服务。owner module不引用app-edge/EdgeRequestContext/OperationsSessionResolver/generated wire；raw凭证不传到owner，由app把服务器解析的immutable授权事实传入。每个operation controller同名generated方法仅解码request并转交：

| 方法→真实caller | origin及owner消费 |
| --- | --- |
| stage / releaseStage→Pedge stage/release | TerminalUpdateStageHandler.stage 无outerTX调用asset stage API；TerminalUpdateStageHandler.release在app短REQUIRED中建立P并调用assetrelease参与；stage只复用session/workspace/asset三个现有短TX |
| register→Pedge register | TerminalUpdateRegisterHandler.register REQUIRED建立platform command事实→TerminalUpdateCommandApi.register→RegisterService；assetclaim同REQUIRED |
| pageArtifacts / artifact→Pedge page/detail | TerminalUpdatePlatformReadHandler的两同名方法readonly起点内构造Pread→TerminalUpdateTaskReadApi；source stream不在这里暴露 |
| rules / rule / candidates / ruleStores / reportPage / reportDetail / reportHistory→Oedge七具名GET | TerminalUpdateProjectReadHandler readonly内构造PROJECT读事实→TaskReadApi对应方法；report page/detail/history均按启用门店/启用终端；没有写cap前置 |
| createRule / changeRuleStatus→Oedge create/status | TerminalUpdateRuleCommandHandler两方法REQUIRED起点内OperationsSessionResolver＋WorkspaceCapabilityScopeResolver generated requirement→owner command。edge禁止@Transactional/创建OperationsCommandContext；owner重核现grant |
| snapshotPage→Tedge terminalReadProjectUpdateRuleSnapshotPage | TerminalUpdateSnapshotHandler.snapshotPage REPEATABLE_READ内 credential verify与scope→TaskReadApi.snapshotPage；caller TDC readTerminalDataCommand |
| issueGrant / authorizeContent→Tedge grant/content | TerminalUpdateDownloadHandler.issueGrant REQUIRED，复用foundation AdvisoryLock.acquireHashText按workspace/terminal/bindingGeneration锁后expire/count/insert；authorizeContent readonly只取已授权assetLocator。body stream由Tedge方法退出TX后asset API读取；caller TDC grant command/Android UpdatePort |
| read_project_topic→TDS repo | TdsTerminalUpdateRepository→owner security-definer topic函数，固定search_path/principal EXECUTE-only；不含报告写函数 |
| refresh/receive snapshot→composition桥/update actor | apps/terminal/ui/integration/{sample-console,sample-wallpaper-console}/src/application/module.ts经公开commands→kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts，selector公开，禁读他人slice |
| report selector/pending→升级actor→TDC typed command；grant→TDC | 两integration桥只交公开command/selector；升级actor持久失败正文，TDC当前credential→generated HTTP→CBS ReportHandler/owner；TDC public heartbeat广播→业务actor自有pending；无WS report业务副本 |
| recordReport→Tedge submitTerminalUpdateReport | app TerminalUpdateReportHandler REQUIRED构造credential授权事实→TerminalUpdateReportCommandApi.recordReport→owner RecordReportService；无TDS写caller |
| rule audit→既有通用audit GET | OperationsAuditTaskReadService新增TerminalUpdateRule封闭query→TerminalUpdateAuditReadApi PROJECT task read；OperationsAuditHistoryModal调用已有generated GET |
| artifact audit→既有平台audit GET | getPlatformEntityAuditHistory→PlatformAuditHistoryController新增TERMINAL_UPDATE_ARTIFACT映射→PlatformAuditHistoryTaskReadService新增封闭工件query→TerminalUpdateAuditReadApi平台task read；已验证平台session/space，owner复核工件归属，不新增页面或operation |

### 11.4 报告有限值与原始事实归一（S-1）

canonical HTTP 类型经 edge/terminal 生成给 TER 与 CBS DTO；update owner的报告投影负责归一，TDC仅消费同一schema，不建立第二业务映射。A实际reason仍是原事实，不改其slice、异常或native状态。字段缺失、unknown与未发生任务必须分别表达。

| 字段 | 完整闭集/空值 | 来源与约束 |
| --- | --- | --- |
| actual.entryKind | embedded / hot / file-recovery / unknown | 现有UpdateActualVersions原生readback；unknown不能猜内嵌成功 |
| actual.unknownReason | null / ACTUAL_READ_UNAVAILABLE / ACTUAL_IDENTITY_INCOMPLETE / UNCLASSIFIED_REASON | actual可为null；null actual必须给非null原因；缺字段的具体原因只用有限码，不附rawerror |
| recent.phase | null / fixed / preparing-full / preparing-hot / applying-full / applying-hot / waiting-user / waiting-idle / unknown / succeeded / failed | A任务phase原值；waiting-idle由C将来真实闲时策略事实产生，本B不调度；没有任务为null |
| recent.recentState | IDLE / FIXED / PREPARING / APPLYING / WAITING_USER / WAITING_IDLE / REJECTED / PARTIALLY_SUCCEEDED / SUCCEEDED / FAILED / ROLLED_BACK / UNKNOWN | A recent/task/action实际状态映射；扩展显示态只满足R-15，不能替代A执行状态 |
| recent.reasonCode | null / TARGET_REJECTED / IDENTITY_CONFLICT / SOURCE_UNAVAILABLE / RESOURCE_BUSY / PERSISTENCE_FAILED / PREPARE_FAILED / APPLY_FAILED / OPERATION_TIMED_OUT / PORT_UNAVAILABLE / OPERATION_CANCELLED / ACTION_UNKNOWN / ACTION_IDENTITY_MISMATCH / USER_CANCELLED / INSTALLATION_FAILED / BOOT_UNCONFIRMED / RECOVERY_FAILED / UNCLASSIFIED_REASON | 白名单归一；原始非null而未命中必须UNCLASSIFIED_REASON，不能静默抹成null |

白名单归一表（CP-01重开A最终source；新增raw码必须先归类并加focused例，未知已有出口，不为新增码无限扩枚举）：

| A raw原因（精确匹配集合） | 报告reasonCode |
| --- | --- |
| TARGET_INVALID / FAILED_ARTIFACT_REENTRY_FORBIDDEN / ALREADY_ACTIVE | TARGET_REJECTED |
| IDENTITY_CONFLICT | IDENTITY_CONFLICT |
| SOURCE_UNAVAILABLE / UPDATE_SOURCE_OR_NETWORK_UNAVAILABLE | SOURCE_UNAVAILABLE |
| RESOURCE_BUSY / BUSY_UNKNOWN | RESOURCE_BUSY（BUSY_UNKNOWN对应UNKNOWN，不伪技术失败） |
| PERSISTENCE_FAILED_BEFORE_PREPARE / PERSISTENCE_FAILED_BEFORE_APPLY | PERSISTENCE_FAILED |
| PREPARE_FAILED / INSTALL_STAGE_FAILED | PREPARE_FAILED |
| APPLY_FAILED / RELOAD_FAILED / BOOT_RESERVATION_FAILED | APPLY_FAILED |
| PREPARE_TIMED-OUT / APPLY_TIMED-OUT / ACTION_TIMED-OUT / CONFIRM_TIMED-OUT | OPERATION_TIMED_OUT |
| PREPARE_UNAVAILABLE / APPLY_UNAVAILABLE / ACTION_UNAVAILABLE / CONFIRM_UNAVAILABLE | PORT_UNAVAILABLE |
| PREPARE_CANCELLED / APPLY_CANCELLED / ACTION_CANCELLED / CONFIRM_CANCELLED | OPERATION_CANCELLED |
| ACTION_UNKNOWN / INSTALLER_STATE_UNKNOWN / INSTALLER_AWAITING_READBACK / ABORT_UNCLASSIFIED | ACTION_UNKNOWN |
| ACTION_IDENTITY_MISMATCH | ACTION_IDENTITY_MISMATCH |
| ENDED_NOT_INSTALLED | USER_CANCELLED（recentState=WAITING_USER，不标坏包） |
| INSTALL_FAILED / INSTALL_CONFIRMATION_UNAVAILABLE | INSTALLATION_FAILED |
| BOOT_UNCONFIRMED / HOT_BOOT_UNCONFIRMED / HOT_BOOT_TIMEOUT / CURRENT_BOOT_UNCONFIRMED | BOOT_UNCONFIRMED |
| HOT_ROLLBACK_BOOT_UNCONFIRMED / HOT_ROLLBACK_BOOT_TIMEOUT / HOT_BOOT_RECOVERY_UNAVAILABLE | RECOVERY_FAILED |
| null | null |
| 上述集合之外的任意非null字符串（含exception message） | UNCLASSIFIED_REASON；不上送raw字符串，也不写入诊断日志 |

基础recent八态一一归一到大写；扩展显示态只覆盖能由同task/action事实证明的情况：确认恢复用ROLLED_BACK；配对FULL已安装但HOT未成功用PARTIALLY_SUCCEEDED；未出现上述两类时，有真实准入拒绝readback才用REJECTED；确认用户取消用WAITING_USER；C的真实等待闲时用WAITING_IDLE。只返回accept拒绝而未保留最近事实的路径（当前actor的SOURCE_UNAVAILABLE/TARGET_INVALID等）不能凭规则或历史日志编造最近拒绝。CP-01重开A最终readback来源，该输入未闭合时为OPEN_A_HANDOFF；本轮不另造结果缓存、不改A，也不把有限字典当成全部状态可实际报告的证明。`PARTIALLY_SUCCEEDED`须有同固定任务FULL已安装的actual/原生action readback，且配对HOT尚未成功；仍报告对应phase/失败reason，不能仅比较目标或规则推导。`ROLLED_BACK`须同失败HOT action与实际恢复入口已启动确认的readback关联；仅entryKind=file-recovery不足以证明本次回退，恢复失败用FAILED或UNKNOWN＋RECOVERY_FAILED。缺上述证据沿A原state或UNKNOWN，不宣称部分成功/回退。

R-15四类分别为WAITING_USER/WAITING_IDLE、REJECTED、PARTIALLY_SUCCEEDED、FAILED/ROLLED_BACK。B不会创造闲时等待或自动任务：协议/字典与组件合法fixture覆盖全部闭集；真实A用户等待/部分执行/回退由已有A事实消费，C产生WAITING_IDLE。`recent=null`只表示已收到的当前观察没有最近任务信息，不证明终端从未创建任务；state=IDLE只用于A提供的空闲最近状态；NO_REPORT表示PG无行，不与UNKNOWN合并。历史为空仅显示“还没有收到升级任务报告；终端可能尚未上报”，通信失败留本地pending的真实任务仍可能存在。

reportPage/reportDetail在原集合任务SQL中LEFT JOIN规则/工件，返回稳定结构化发布事实（与§17同字段命名）；无行/旧关联有明确null，不添加标题字段、N次查询或新operation。UI§4.2统一字典，未知码不会变成可见ref/raw异常。focused/red覆盖全部finite值、未分类码、USER_CANCELLED等待、假partial/假rollback、missing关联、sameSQL多终端读取与旧binding提示。

## 12 · 每个输入控件的来源、依赖与搜索合同

P/O与组件路径按§9，不新建容器。列表过滤统一用ProTable原有查询表单；初始请求一次，查询/Enter显式提交，重置清cursor。候选统一250ms防抖搜索＋“加载更多”按钮，清空搜索即重置候选页；没有候选“查询/重置/上一页”动作。selected事实与搜索页分离。门店两处直接复用operations app的useOrganizationCandidates（projectId、subjectType=STORE、真实PagePaged）；该hook当前仅暴露onPopupScroll，CP-05最小增加loadNext(isFetching)透传既有foundation状态，无第二分页状态。包候选复用useCursorCandidates的loadNext与真实CursorPaged。表内L/E/F=loading禁选、empty无候选、failed面内可重查；T=输入合法性在提交时校验，不把无值显示成网络错误；readonly解析不算用户输入。每行都包含后端重新验证，前端条件从不替代owner。

| 控件/TestId | 唯一来源/API/匹配 | 上游与级联（无则明确） | 状态/触发 | 提交再核验/任务 |
| --- | --- | --- | --- | --- |
| 包kind/PKG_FILTER_KIND | FULL/HOT闭集，platform artifactPage exact | verified space；换space清filter/cursor | T；query/Enter | parse真实kind，过滤不是授权；找包 |
| 包app/PKG_FILTER_APP | 用户Input；artifactPage appId exact | 无上游依赖；reset清 | T，≤255；query | 不自由构造包身份；找包 |
| 包runtime/PKG_FILTER_RUNTIME | 用户Input；artifactPage runtimeVersion exact | 无上游依赖 | T，≤255；query | server参数校验；找包 |
| 上传ZIP/PKG_FILE | 真实file input，仅.zip筛选；stage multipart | verifiedspace；替换先release旧stage，旧回包废弃 | L禁提交/E无文件/F留原错误 | 真bytes/签名/pub/bounds owner验，不相信扩展名；保存 |
| 最小FULL搜索/PKG_MIN_FULL_QUERY_TEXT | getPlatformTerminalUpdateArtifactPage：queryText包含＋kind FULL＋stage minimumFull五事实server exact | 解析HOT成功才有；换file/space清selected和页 | L/E/F；250ms防抖；加载更多 | owner验证五事实，不能信页面匹配；配对 |
| 最小FULL选择/PKG_MIN_FULL_OPTION(ref) | getPlatformTerminalUpdateArtifactPage当前space已保存且五事实匹配的FULL | 同上；FULL upload无此控件/字段 | L/E/F；选择后保留ref回显 | immutable minimumFull五事实；配对 |
| 规则status/RULE_FILTER_STATUS | ENABLED/DISABLED闭集；rulePage exact | 当前project；切project清页和filter | T；query/Enter | GET O-P即可；找规则 |
| 规则app/RULE_FILTER_APP | Input；rulePage exact appId | 无上游依赖 | T≤255；query | server校验；找规则 |
| 创建起止/RULE_FILTER_CREATED_RANGE | RangePicker用户选；rulePage createdFrom/To | 一对区间，无其他上游；reset清两值 | T；inclusive from/exclusive to UTC millis，from<to | server重复验证范围，createdAt不变；找规则 |
| 目标模式/RULE_TARGET_MODE | FULL_ONLY/PAIRED_HOT闭集 | project；改模式清full/hot/strategy/M失效字段 | T；选择仅改draft | server条件字段合法性；建规则 |
| 工件搜索/RULE_CANDIDATE_QUERY_TEXT | candidatePage queryText包含、kind/app/runtime条件 | 模式→候选kind；project/模式变清页与选项 | L/E/F；250ms防抖＋加载更多 | 同space真实已保存；选目标 |
| FULL选择/RULE_CANDIDATE_OPTION(ref) | candidatePage kind FULL | FULL_ONLY；切模式清 | L/E/F | owner full存在/scope；建规则 |
| HOT选择/RULE_CANDIDATE_OPTION(ref) | candidatePage kind HOT，其minFULL只读联带 | PAIRED_HOT；换HOT清上个pair | L/E/F | server重新取HOT→FULL固定关系，禁止手改FULL；建规则 |
| 门店范围/RULE_STORE_SCOPE | ALL_PROJECT_STORES/STORE_REFS闭集 | 当前project；ALL清selected refs/候选 | T | server validate mode/项目，ALL含未来店；建规则 |
| 门店搜索/RULE_STORE_SEARCH | getOperationsOrganizationCandidates queryText包含；subject STORE/projectId/PagePaged | STORE_REFS＋project；换project清两页已选 | L/E/F；250ms防抖＋加载更多 | scope/data节点合法，不按当前页丢已选；找店 |
| 门店多选/RULE_STORE_OPTION(ref) | 同候选，ref为稳定key；既有selected回显能力 | STORE_REFS；ALL清refs | L/E/F；两页累计选，不抽干 | owner一次任务read验证全部refs项目归属；建规则 |
| 初始状态/RULE_INITIAL_STATUS | 用户Select闭集，已展示默认DISABLED | 无上游依赖，目标变不改用户明确选择 | T | server closedenum；建规则 |
| N/RULE_N | InputNumber整数分钟1～1440，提交×60秒 | 所有规则必有，无其他上游 | T，blank/decimal/outofrange拒绝 | server同range，FULL立即安装提醒参数；建规则 |
| HOT策略/RULE_HOT_STRATEGY | IMMEDIATE/IDLE Radio | PAIRED_HOT才显示；FULL清字段；IMMEDIATE清M | T | FULL absent/null、paired必有；建规则 |
| M/RULE_M | InputNumber整数分钟1～1440，提交×60秒 | paired+IDLE才有；其他情况clear/omit | T | 同range，B仅存储不计闲时；建规则 |
| 说明/RULE_DESCRIPTION | TextArea用户文本 | 无上游依赖 | T≤1000，不把空转假事实 | server长度/统一trim合同；建规则 |
| 状态确认/RULE_STATUS_CONFIRM | 当前详情status决定ENABLE/DISABLE按钮 | current rule/revision；切context关闭；CAS失败重新读后重选 | busy禁双击/F留Modal | generated cap+owner currentgrant+revision；启停 |
| 报告门店搜索/PROJECT_REPORT_STORE_SEARCH | organization candidates subject STORE/projectId，queryText/PagePaged | O-P当前project；切project清filter/cursor | L/E/F | server store同project；找终端 |
| 报告门店选择/PROJECT_REPORT_STORE_OPTION(ref) | 当前project candidate refs；无选择表示当前项目全部启用门店 | 同上；无选择不丢NO_REPORT终端 | L/E/F；正式查询提交storeRef | reportPage实际启用门店/终端join复核，不需要W-P；找终端 |
| 报告终端名/PROJECT_REPORT_QUERY_TEXT | Input；reportPage terminalName包含 | 无其他上游，project为context | T≤255；query/Enter/reset | serverfilter只名称不当identity；观察 |

Readonly解析/实际版本/最小FULL摘要、status/revision/createdAt均为Descriptions，不自造编辑输入。所有失败原位且留合法draft；每候选下一页只请求一页，context变取消旧身份。

## 13 · 每 variant/request fact 的单一来源与可见性

V=VISIBLE_MUTABLE，R=VISIBLE_READONLY，D=SERVER_DERIVED，H=HIDDEN_PROTOCOL（身份/幂等/当前readback），S=SECRET_TRANSIENT。所有facts只能从下面来源传递；D事实不得让用户填入request冒充，S不进入UI/公开selector/log。同shape的变体下面逐fact行写出，删去不适用字段；NoBody只生成框架包装，不添加隐含业务字段。

| variant | 单个fact | 分类 | 唯一来源/失效 |
| --- | --- | --- | --- |
| stage | file | V | file input真实选取；当前context/attempt变即失效 |
| stage | digest | H | digestFileContent真实bytes；当前context/attempt变即失效 |
| stage | usage | H | canonical TERMINAL_UPDATE_ZIP常量；当前context/attempt变即失效 |
| stage | idempotencyKey | H | 同内容digest构造；当前context/attempt变即失效 |
| stage | space/actor | D | 现有平台会话与空间owner；当前context/attempt变即失效 |
| release | stageRef | H | 本Drawer旧stage response；当前context/attempt变即失效 |
| release | stageBindGrant | S | 旧stage response，只本attempt；当前context/attempt变即失效 |
| release | space/actor | D | 请求当前身份，原stage ownership；当前context/attempt变即失效 |
| register FULL | stageRef | H | 本Drawer stage response；当前context/attempt变即失效 |
| register FULL | stageBindGrant | S | 同stage的短期证明；当前context/attempt变即失效 |
| register FULL | idempotencyKey | H | stage digest/immutable payload内容key；当前context/attempt变即失效 |
| register FULL | manifest/versions/pub | R | server已校验stage，owner读取而非自由request；当前context/attempt变即失效 |
| register FULL | minFullRef | D | 本变体禁止字段，不发送；当前context/attempt变即失效 |
| register FULL | space/actor | D | 平台origin；当前context/attempt变即失效 |
| register HOT | stageRef | H | 本Drawer stage response；当前context/attempt变即失效 |
| register HOT | stageBindGrant | S | 同stage短期证明；当前context/attempt变即失效 |
| register HOT | minFullRef | V | 仅五事实匹配候选ref；当前context/attempt变即失效 |
| register HOT | idempotencyKey | H | stage+minFULL canonicalpayload；当前context/attempt变即失效 |
| register HOT | manifest/versions/pub | R | 同stage owner事实；当前context/attempt变即失效 |
| register HOT | space/actor | D | 平台origin；当前context/attempt变即失效 |
| create FULL_ONLY | fullArtifactRef | V | 候选FULL ref；当前context/attempt变即失效 |
| create FULL_ONLY | hotArtifactRef | D | 禁止，省略；当前context/attempt变即失效 |
| create FULL_ONLY | scopeMode | V | Radio；当前context/attempt变即失效 |
| create FULL_ONLY | storeRefs | V | 仅STORE_REFS选定集合，ALL省略；当前context/attempt变即失效 |
| create FULL_ONLY | status | V | 初始状态Select；当前context/attempt变即失效 |
| create FULL_ONLY | N | V | InputNumber整数分钟（提交×60秒）；当前context/attempt变即失效 |
| create FULL_ONLY | hotStrategy | D | 禁止，省略；当前context/attempt变即失效 |
| create FULL_ONLY | M | D | 禁止，省略；当前context/attempt变即失效 |
| create FULL_ONLY | description | V | TextArea；当前context/attempt变即失效 |
| create FULL_ONLY | expectedContextVersion | H | 当前OperationsApp.tsx:222–234由session.contextVersion经contextScopedQueryArgs生成OperationsPageProps.queryContext.expectedContextVersion；新页/Drawer只接该prop，不另造selector/持久副本。提交从当前epoch取值；epoch、assignment、workspace/project或contextVersion改变使旧draft/候选/detail与未提交attempt失效，dirty关闭仍走foundation；app handler在同REQUIRED内重核当前context，不采信幂等key内旧值。 |
| create FULL_ONLY | projectRef | H | 当前context；owner重核；当前context/attempt变即失效 |
| create FULL_ONLY | idempotencyKey | H | createContentIdempotencyKey规范payload（含expectedContextVersion）；当前context/attempt变即失效 |
| create FULL_ONLY | app/platform/runtime/minFULL | D | FULL owner事实；当前context/attempt变即失效 |
| create FULL_ONLY | createdAt/ruleRef | D | owner新建事实；当前context/attempt变即失效 |
| create PAIRED_HOT | hotArtifactRef | V | 候选HOT ref；当前context/attempt变即失效 |
| create PAIRED_HOT | fullArtifactRef | R | 该HOT固定minFULL ref，提交需owner相等重核；当前context/attempt变即失效 |
| create PAIRED_HOT | scopeMode | V | Radio；当前context/attempt变即失效 |
| create PAIRED_HOT | storeRefs | V | STORE_REFS选定，ALL省略；当前context/attempt变即失效 |
| create PAIRED_HOT | status | V | Select；当前context/attempt变即失效 |
| create PAIRED_HOT | N | V | InputNumber；当前context/attempt变即失效 |
| create PAIRED_HOT | hotStrategy | V | IMMEDIATE/IDLE Radio；当前context/attempt变即失效 |
| create PAIRED_HOT | M | V | 仅IDLE整数分钟（提交×60秒）；IMMEDIATE省略；当前context/attempt变即失效 |
| create PAIRED_HOT | description | V | TextArea；当前context/attempt变即失效 |
| create PAIRED_HOT | expectedContextVersion | H | 当前OperationsApp.tsx:222–234由session.contextVersion经contextScopedQueryArgs生成OperationsPageProps.queryContext.expectedContextVersion；新页/Drawer只接该prop，不另造selector/持久副本。提交从当前epoch取值；epoch、assignment、workspace/project或contextVersion改变使旧draft/候选/detail与未提交attempt失效，dirty关闭仍走foundation；app handler在同REQUIRED内重核当前context，不采信幂等key内旧值。 |
| create PAIRED_HOT | projectRef | H | 当前context；当前context/attempt变即失效 |
| create PAIRED_HOT | idempotencyKey | H | 同规范payload；当前context/attempt变即失效 |
| create PAIRED_HOT | app/platform/runtime/minFULL | D | HOT/FULL owner事实；当前context/attempt变即失效 |
| create PAIRED_HOT | createdAt/ruleRef | D | owner新建事实；当前context/attempt变即失效 |
| enable | ruleRef | H | 当前detail身份；当前context/attempt变即失效 |
| enable | status | H | 此确认按钮固定ENABLED；当前context/attempt变即失效 |
| enable | revision | H | 当前detail CAS；当前context/attempt变即失效 |
| enable | idempotencyKey | H | ref/revision/status规范key；当前context/attempt变即失效 |
| enable | projectRef | H | 当前queryContext.scopeRef，与detail PROJECT identity一致；epoch/context变即失效 |
| enable | expectedContextVersion | H | 当前OperationsApp.tsx:222–234由session.contextVersion经contextScopedQueryArgs生成OperationsPageProps.queryContext.expectedContextVersion；新页/Drawer只接该prop，不另造selector/持久副本。提交从当前epoch取值；epoch、assignment、workspace/project或contextVersion改变使旧draft/候选/detail与未提交attempt失效，dirty关闭仍走foundation；app handler在同REQUIRED内重核当前context，不采信幂等key内旧值。 |
| enable | createdAt/target | D | 持久不可变，不提交；当前context/attempt变即失效 |
| disable | ruleRef | H | 当前detail身份；当前context/attempt变即失效 |
| disable | status | H | 此确认按钮固定DISABLED；当前context/attempt变即失效 |
| disable | revision | H | 当前detail CAS；当前context/attempt变即失效 |
| disable | idempotencyKey | H | ref/revision/status规范key；当前context/attempt变即失效 |
| disable | projectRef | H | 当前queryContext.scopeRef，与detail PROJECT identity一致；epoch/context变即失效 |
| disable | expectedContextVersion | H | 当前OperationsApp.tsx:222–234由session.contextVersion经contextScopedQueryArgs生成OperationsPageProps.queryContext.expectedContextVersion；新页/Drawer只接该prop，不另造selector/持久副本。提交从当前epoch取值；epoch、assignment、workspace/project或contextVersion改变使旧draft/候选/detail与未提交attempt失效，dirty关闭仍走foundation；app handler在同REQUIRED内重核当前context，不采信幂等key内旧值。 |
| disable | createdAt/target | D | 持久不可变，不提交；当前context/attempt变即失效 |
| grant | artifactRef | H | 已固定A task sourceRef；当前context/attempt变即失效 ；已提交action按A原事实回读 |
| grant | credential三头 | S | 仅TDC当前identity；当前context/attempt变即失效 ；已提交action按A原事实回读 |
| grant | relativePath/grant/expiry | S | CBS返回，仅provider当前attempt；当前context/attempt变即失效 ；已提交action按A原事实回读 |
| grant | rule association | D | owner已创建规则真实关联；当前context/attempt变即失效 ；已提交action按A原事实回读 |
| HTTP report | reportId/reportSequence/taskId | H | 升级owner在同binding周期持久分配；同task合并最新，不同task保留；非connection-local；根reset/config/binding变化失效旧pending |
| HTTP report | actual | R | 真实native boot selector，entryKind/unknownReason按§11.4；不拿target填实际；已固定任务actual仍按A原事实回读 |
| HTTP report | recent | R | A currentTask/recent按§11.4归一，有taskId则同任务行UPSERT；不上送raw reason；跨binding不重签任务报告 |
| HTTP report | binding/device | D | CBS解析当前TDC凭证三头并owner复核；不需要TDS session/sequence；前端不能自报身份授权 |

### 13.1 每个可见动作的任务与失败恢复

附件§9所有action连同本节新增输入/历史/审计动作明确映射：query/reset/Enter/pager找目标不写业务；保存必须当前file上传与解析成功，HOT配对正确；启停需W-P，规则操作历史只O-P并复用通用审计；报告版本filter消费actual并服务器分页，Drawer历史按task一行。dirty唯一owner、scope变化失效、无手工终端重试不变。

这份映射覆盖§9每行以及§12各输入；真正DOM/handler仍由component focused和准入验证，不以常量存在宣称运行通过。

## 14 · V具名子断言补全与阶段边界

附件§6中以下行的泛称只表示来源，本节为其有限测试定位。生产/测试命名采用能力，不用V或阶段ID。

| 正式V | B实际行为/具名测试或scenario | 执行面及不重复范围 |
| --- | --- | --- |
| V15 | terminalUpdateSourceGrant.test：fixedTargetSurvivesNewSnapshot、reloadKeepsFixedPair | update/provider focused；只B异步source接口影响，不重跑A不受影响执行核 |
| V16 | N_A_REASON：B不改installer取消/等待分支；source resolve变化由download.authorization及sourceGrant prepareFailure覆盖 | 既有A installer判据留A，C自动trigger留C；不把N_A当整条PASS |
| V18 | update.rule.lifecycle：fullOnlyPersistsN、fullOnlyRejectsHotFields | owner真实HTTP；N调度本期不实施，C |
| V19 | update.rule.lifecycle：pairedIdlePersistsM、immediateOmitsM | owner真实HTTP；点击统计/重启时机C |
| V21 | update.download.authorization：zipHashMatchesFixedArtifact；terminalUpdateSourceGrant.test：hotFileSourceDescriptor | HTTP＋Android真实A prepare受影响差量；Hermes完整loader A未受影响不重复 |
| V22 | terminalUpdateSourceGrant.test：proxyGrantFailureKeepsTarget、expiresBeforePrepare、lateSourceAfterContextChange | focused＋Android grant header传递；原生中断/任务续接A/C |
| V23 | N_A_REASON：B不改A native boot保护/期限，只有HTTP source/header | 受影响source见V22；不重跑A独立loader保护 |
| V24 | update.report.actual：reloadRebuildsSessionAndReportsActual；report.recovery：lateOldHttpReceiptIgnored | 先Web非adapter再Androidactual；boot确认机制保持A |
| V25 | update.artifact.reject：missingPublicationCompatibilityFacts；N_A_REASON：B不判断业务持久化schema | 真工件HTTP；业务兼容发布纪律A，不能CBS猜测 |
| V26 | terminalUpdateSourceGrant.test：httpFailureDoesNotApplyOrRollback；terminalVersionReport.test：httpReceiptFailureDoesNotApplyOrRollback | focused；实际原生恢复A不受影响 |

其余V均沿§6已具名scenario，并在§11/15 fixture与执行面核对。新增test file的能力路径拟为 `apps/terminal/kernel/base/terminal-update/test/{terminalUpdateSourceGrant,terminalVersionReport}.test.ts`；已有A测试优先扩同名能力，实施前确认路径，删除替代旧测试不留双份runner。

## 15 · seed与变更锚点精确文件补全

新增 `scripts/dev/terminal-update-seed-plan.mjs`、`terminal-update-seed-plan.test.mjs`、`terminal-update-seed-executor.mjs`、`terminal-update-seed-executor.test.mjs`；拟新增 `scripts/dev/r5-fixture-contract.test.mjs`（当前没有此测试文件，不能宣称已存在）；同步现有 `r5-complete-seed-executor.test.mjs`、`owner-command-seed-executor.test.mjs`，r5-seed-plan的角色/count校验在父executor与owner-command已有tests扩，避免为纯数据复写一份测试。fixture JSON变更与COUNT_KEYS在上述contract test，报告父子首败/count在complete test。README/API/报告模板同步在现有seed报告生成路径按父executor实际caller定位，不新增独立报告系统。

写前唯一锚点：现有source use `COUNT_KEYS`/`seedStages`/`GROUP_SEED_CAPABILITIES`/`expectedCounts`、`resolveSourcePath`、`successResponseCount`、`readTerminalData`、`loadOrganizationPath`、`SESSION_READY`；遇同锚多次必须先定位所属函数再写，不能盲行号替换。新source以§11.3具名handler/api方法作为定义锚点，UI以§9能力组件名与实际handler为锚点。完整同步分母是详设§9a.1，不以此定位清单代替。

## 16 · R3 两条资源反例的精确测试补充

`update.download.authorization`：同binding预先31个有效grant，两个真实HTTP发行在锁前barrier并发；恰一200一503 BUSY，PG有效项32且已有token仍有效；不同binding各自预算，首次空集也取得锁。扩已有TerminalUpdateAcceptanceScenarios具名场景与owner integration test，不另造runner。全部NOT_RUN。

`update.report.recovery`：CBS HTTP不可达/PG不可写/响应丢失，TDP仍有效PONG；首次发送可重试失败后持久正文保留；确定性报告拒绝移出pending并留最近摘要，身份拒绝暂停；每有效PONG最多一个可发送真实IO，重叠tick/Runtime timeout不误释放inFlight。同task新状态等待期间旧receipt不得删新pending；两task断线重启后各有一个任务行，阶段更新/重复不加行；无task观察不造历史。配置/binding/rootreset清旧pending，旧回包不能修改新身份；HTTP失败不得触发transport.invalid/stop/connect。先升级owner/TDC focused，再同清单受管Web→Android，均NOT_RUN。

## 17 · 平台最小 FULL 候选唯一合同

平台HOT最小FULL候选唯一调用 `getPlatformTerminalUpdateArtifactPage`，cookie/space为P，不调用operations candidatePage、不为候选另增 operation（第17项是 HTTP 报告）。沿现appId/runtimeVersion/kind=FULL，增加同组可选query字段 `minimumFullNativeBuildNumber`、`minimumFullPublicationId`、`minimumFullApkSha256`；三者任一出现则三者全需且appId/runtimeVersion必有，组成stage已校验minimumFull的五事实。后端单page SQL按这五事实严格相等过滤；响应只返回对应五事实、artifactRef及原有结构化kind/nativeVersion/bundleVersion等发布事实，不返回拼接后的展示标题或label。包列表标题和候选label由各后台feature从完整结构化事实生成，遵backend§1-K，不新建通用formatter/API/数据库展示列；浏览器不从无约束页二次筛选。queryText在已匹配集合内保留应用/原生版本/JS版本的包含搜索（规范trim），不改变批准的搜索行为或五事实约束；内部搜索表达式不作为响应展示事实。cursor绑定全部过滤条件。普通包列表不传minimumFull组，现normal SQL/完整6不变；候选normal精确匹配1项，真实两页重复保存候选fixture证明翻页/回显且无不匹配工件。register仍重新验证五事实；candidate input不产生信任。canonical schema/header/query和platform generated/UI/test同批同步。

CP-01审查工件page/candidate/detail每响应字段的真实来源，canonical/generated DTO不含由多个事实装配的标题字段；CP-05在既有包feature focused测试中以结构化发布事实证明列表/候选label、翻页和回显，并保持五事实严格匹配反例。其余UI文本“展示标题”只是消费者呈现说明，不授权owner生成；该checklist覆盖本批全部工件响应及其两个后台消费者，不使用关键词门替代判断。以上均为计划/NOT_RUN。

## 18 · 集合正常规模假设与增长驱动（唯一来源）

数字是本期normal seed/测试设计假设，不是生产测量、业务数量上限或容量PASS。UI操作表逐项引用本表；预期增长不得靠抽干/隐藏旧事实解决。

| key/集合 | 正常假设与出处 | 增长驱动 | 形态/超限处理 |
| --- | --- | --- | --- |
| G1 工件/工件page | 本批seed4真实工件（两App各FULL/HOT），normal初页20；单stage/register/detail/content为1 | 每App每发行、空间重复保存的不可变工件及临时stage；正常业务工件永久保留 | CursorPaged≤100，无全库select；256MiBZIP/512MiB展开/8192文件预算及stage过期/明确容量错误；磁盘/对象容量失败不保存可用目标 |
| G2 项目规则 | 本批seed8规则，normal初页20；create/status/detail单对象 | 每次新建不可编辑规则，包括历史停用，启停不新建记录 | CursorPaged≤100；列表不抽干，固定createdAt；规则无业务条数cap |
| G3 项目终端观察列表 | seed终端全集8按当前项目实际归属＋门店ENABLED/终端ENABLED筛选，normal2含NO_REPORT | 项目新增启用门店/终端 | CursorPaged≤100/SQL LEFT JOIN最新任务或observation；无报告亦有行；版本筛实际非target |
| G4 固定门店refs | normal fixture2门店；ALL无refs，现有角色/项目任务读 | 发布时项目门店数与当次显式选取；已创建refs不因停用/作废而隐去 | CursorPaged≤100，batch任务read；detail不用首100冒称全部；UNKNOWN引用保留原因 |
| G5 工件/门店候选 | 工件normal4来自G1，平台5事实候选normal1；门店normal2，选择跨两页边界fixture | 同空间发行包数/项目门店数，不因无写cap缩读范围 | 工件CursorPaged；组织门店既有PagePaged；过滤在server，已选与页分离；技术page失败保留draft |
| G6 启用规则完整snapshot | seed8规则中启用subset；101启用规则反例证明多页 | 所有App/platform的启用规则及各固定门店refs；不先按主机筛掉 | HTTP页≤100且≤1MiB，完整候选≤8MiB；3次hash重读，超限typed拒绝/旧完整snapshot保留，不默截；不得为规模发明业务cap |

release/grant等单对象状态动作不形成新的业务结果集合；grant只临时5分钟/32有效技术预算，锁保证上界。规模超过候审资源假设时CP-01/实施测量修技术预算，不能削弱正确性。

### 18.1 · G7任务历史与pending增长

历史库每实际更新task一行，阶段更新覆盖该行；无任务observation每binding一行且不进任务历史，不能把每个PONG或重送记成任务。增长来源为历次真实任务；CursorPaged≤100，normal两task，101历史反例。没有业务历史条数cap；数据库/磁盘容量失败返回typed不可用，不成功receipt、不删除历史救空间。终端持久pending只存尚需发送的各task最新正文＋当前observation；拒绝与暂停处置见D§8.5（最近失败摘要与pause同slice，不是第二队列），不加通用关联表/消息队列；commit receipt后删除匹配项。不可写/容量不足仍可见，不能宣称保证离线无界容量，长期容量NOT_RUN。

## 19 · 当前源码事实与拟新增心跳/HTTP接缝

| 当前source（本轮只读） | 事实与拟扩展的最小边界 |
| --- | --- |
| apps/terminal/kernel/base/terminal-data-client/src/features/commands/terminalDataClientCommands.ts:117–123 | heartbeat-tick仅internal/local；拟新增公开matchedPONG广播，不误称既有 |
| apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:1741–1770 | 有效seq PONG完成deadline/RTT后才能广播；240–254既有background失败会invalid，不能复用此失败耦合 |
| 同actor:288–298、909–990；src/types/client.ts:144–151 | executor支持method/body；read命令仅GET形状/terminalRead前缀。报告新增typed POST，复用executor/transport，返回后必须身份重验 |
| apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:624–658 | local分发全部handler，已有广播能力，不新造订阅总线 |
| runtime/src/foundations/createCommandActorDispatcher.ts:101–105、325–329、362–371 | allowReentry非全局single-flight；timeout不取消handler，owner在实际IO完成前保持inFlight |
| apps/terminal/ui/feature/store-basic不作为依据；kernel/feature/store-basic/src/dependencies.ts:1 | 业务actor依赖TDC的现成形状；TDC不反向import升级owner |
| apps/frontend/operations-admin/src/features/audit-history/ui/OperationsAuditHistoryModal.tsx:17–20、67–82 | 标准Modal消费getOperationsEntityAuditHistory；target由generated entityType约束 |
| apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/OperationsAuditTaskReadService.java:43–87；modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditEntityTypes.java:3–13 | 当前无TERMINAL_UPDATE_RULE；须扩canonical enum/type、封闭query dispatch、owner任务读与generated DTO，同PROJECT授权、不从按钮反推权限 |

这些行号是当前静态截面，CP-01重开并定位实际字节；无依赖解析/运行证明。标准变更仅列未来CP-01义务，本轮不写规范/记忆。

### 19.1 · 报告HTTP schema/错误与标准审计扩展

report body taskId为null表示无更新任务的当前观察；非null必须等于recent/task关联，actual与recent有限字段来源见§11.4。bindingGeneration不作为客户端授权body；TDC取当前identity，CBS通过凭证三头解析。reportSequence为1..JS safe max持久整数，reportId为稳定UUID；同task更高seq更新原行。receipt={reportId,taskId,acceptedSequence,outcome:ACCEPTED|SUPERSEDED}，200只表示已commit/权威较新同task事实，不能表示升级成功。当前未知实际版本合法，不要求造target。canonical错误集TERMINAL_UPDATE_REPORT_WRITE={PLATFORM_COMMON_VALIDATION_FAILED/422,PLATFORM_COMMON_ACCESS_DENIED/403,PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403,PLATFORM_COMMON_RESOURCE_NOT_FOUND/404,PLATFORM_DEPENDENCY_UNAVAILABLE/503,STORE_TERMINAL_DISABLED/409,TERMINAL_BINDING_CREDENTIAL_INVALID/403,PLATFORM_COMMON_RESULT_UNKNOWN/500,TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT/409}。前三项认证拒绝不与报告identity冲突合并；唯一提交结果/receipt匹配/重试、终态、暂停处置表在D§8.5，CP-01生成全部分支，CP-04逐反例检验，不猜新别名、不持raw正文。

标准审计新增TERMINAL_UPDATE_RULE实体类型和CREATE/ENABLE/DISABLE事件，owner同事务写audit，幂等重放不另写。扩审计canonical error/enum、generated DTO、OperationsAuditTaskReadService封闭query与TerminalUpdateAuditReadApi、operations frontend operation request typing/OperationsAuditHistoryModal target。现有getOperationsEntityAuditHistory operation身份不变；主对象scope为真实PROJECT，GET不要求MANAGE_PROJECT_TERMINAL_VERSION。规则报告历史与规则审计是两种事实，不能互相替代。

工件审计沿详设§3已声明的三件套闭合：TERMINAL_UPDATE_ARTIFACT保存事件由同owner在register事务写入；平台读复用既有getPlatformEntityAuditHistory，不新增包审计界面或HTTP operation。CP-01同步该实体类型的canonical/生成契约及AuditEntityTypes，CP-02扩`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java`的wire映射、`modules/audit-read/src/main/java/com/catering/v2s/audit/read/PlatformAuditHistoryTaskReadService.java`的sealed query/dispatch，以及`modules/audit-read/build.gradle.kts`对terminal-update owner的任务读依赖；任务读限定已验证空间内的实际工件，不授予跨空间读取或写权限。生成后的`contracts/openapi/paths/platform-admin/audit-history.paths.json`枚举与Java/TS消费者必须一致，不手改生成物。规则链同样覆盖OperationsAuditHistoryController、operations-admin/audit-history.paths.json与audit-read依赖。focused及update.artifact.register必须经真实保存→既有平台审计GET读回同一工件的一次保存事件，并证明精确register重放不增事件、跨空间拒绝；update.rule.lifecycle经既有运营审计GET读回CREATE/ENABLE/DISABLE及重放不增事件。当前均PLANNED/NOT_RUN。

### 12.1 · 最新输入协议补充

| 字段/动作 | 来源与匹配 | 上游失效 | 控件/校验与提交 |
| --- | --- | --- | --- |
| currentApkVersion/PROJECT_REPORT_APK_VERSION | 当前报告actual.nativeVersion精确字符串 | project/context/filter epoch清cursor | Input；显式query/Enter；结果APK列可核对，不匹配target |
| currentJsVersion/PROJECT_REPORT_JS_VERSION | actual.bundleVersion精确字符串 | 同上 | Input，结果JS列；unknown不充当某版本命中 |
| runtimeVersion/PROJECT_REPORT_RUNTIME_VERSION | actual.runtimeVersion精确字符串 | 同上 | Input，结果runtime列；过滤在SQL |
| reportHistory cursor | owner返回分页前沿、terminalRef/PROJECT/context | 换terminal/context清；目标停用拒绝回读 | 标准Table/CursorPagination，不下载所有行；页≤100 |
| rule audit target | 当前RuleDetail稳定ruleRef＋TERMINAL_UPDATE_RULE与前端目标标题 | detail/context变化关闭 | 标准OperationsAuditHistoryModal；无写cap仍读，服务端PROJECT复核 |
| PKG_SAVE资格 | 当前file attempt＋owned stage＋successful parse＋HOT exact FULL | 文件替换/解析失败/过期/session/workspace变化撤销 | Button在资格齐全前disabled，后台独立重验，不自动提交 |

### 13.2 · 新request fact来源补充

报告history query={projectRef,terminalRef,expectedContextVersion,cursor,limit}由当前页context/已验证detail/标准pager生成；无写cap，不发送凭证body。规则audit query={entityType:TERMINAL_UPDATE_RULE,entityId:ruleRef,...现有audit分页/context}使用既有generated builder，不另拼URL。报告actual过滤只发三个已提交draft字段，不读当前页item反推。N/M分钟为V输入，canonical seconds为乘60所得V值，服务器验60倍数；读取详情除60明确分钟。

## 20 · 2026-10-09 同DEV完整链与reset修订输入

- 本阶段实施期按需受管reset已获Dexter授权，无需重复申请；当前仅文档。精确命令/准入/失败停止见计划§1.1/§10，UI链、账号、非秘密关联、before/after、两App各一条FULL→HOT正常链见详设§15.2a。
- 同一 `UpdateTargetSourceProvider.readTarget` 输入增加ruleRef，sourceowner由当前完整snapshot物化指定规则并核scope/application/context；不从fixture造target、不实现C自动选择。现有accept command唯一，所有消费者typed差量同步。生产provider挂到两integration/application，真网络bytes只从CBS grant/content。
- root在platform真实space；运营multi-role必须GROUP任职＋PROJECT节点及MANAGE_PROJECT_TERMINAL_VERSION，不能复用激活用PROJECT/STOREsession写规则。现IA权限无需扩展。
- 新update.supply-chain当前未实现；当前A native harness的automation-runId规则、本机/update-target与full/hot供包不用于本链；保留同run package suffix、签名、automation driver/shape/真实CBS/TDS构建配置，移除UPDATE_TARGET_URL/UPDATE_REVISION两fixture输入，三产物真实版本关系见详设§15.2a。借用DEV的两Vite/tunnel不由TER cleanup停止，只回收本case拥有的browser/session等资源。复用其installer/重启/session/selector/cleanup能力不等于复用测试供给。隔离L2 HTTP报告fixture只证明显示，不能充真实更新成功。所有新运行与cleanup均NOT_RUN。

`update.supply-chain` 对应V-03/05/06/10/11/17/27/28/29在B适用的真实工件、双后台权限/规则、静态配对、完整供给、授权下载、实际版本/任务报告和运营显示子断言；详设§11/§15.2a为fixture/oracle唯一正文，不恢复旧双后台报告或补C自动行为。既有V分支表保留focused/隔离L2反例，主线必须补同DEV关联，当前全部NOT_RUN。
