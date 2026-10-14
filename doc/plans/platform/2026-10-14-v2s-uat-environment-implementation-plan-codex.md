# V2S UAT 环境实施计划

- 日期：2026-10-14
- 对应详设：doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-design-codex.md
- 状态：按Dexter最新指派实施独立UAT环境准备、两个后台发布与完整seed导入；当前独立静态复评为GO（M/S/N=0/0/3），三项非阻断文档修订已完成。
- IMPLEMENTATION_AUTHORITY=true（仅限本次明确授权的UAT源码/脚本/配置、必要构建、受管远端资源、Flyway、首次管理员、完整seed dry-run及首次导入）。
- 不新增或运行功能测试、backend-acceptance、自动浏览器、终端smoke、设备矩阵、故障注入、重复启停或无关verify。
- Dexter原话："UAT环境我只想完成seed数据的导入，方便用户有数据可以看，不做测试"。
- Dexter进一步澄清："UAT环境是给用户体验测试的，所以有测试数据，环境就绪就可以了"。环境准备由agent完成，体验测试由用户进行，用户测试结果不作为本批交付前置。
- 配置复用按详设执行：沿用DEV配置结构、通用服务默认值及部署/seed机制；只替换UAT必须独立的服务地址、资源身份、数据库与业务凭证。CBS两项现有限流HMAC值复用DEV配置，不另设独立密钥或限流策略；UAT资源不会连接DEV数据库、容器、卷、对象存储或LiveKit。

## 1 · 目标与范围

建立独立UAT环境、远端发布两个后台，导入完整r5-full体验数据，交给用户进行体验测试。agent交付目标到环境就绪、体验数据导入和必要操作收口为止。保留此前UAT/DEV独立服务、数据库、身份、端口与环境预算，以及两terminal package的UAT地址输入。

不新增或运行单元、集成、backend-acceptance、浏览器、终端、性能、故障注入或UAT测试；不跑UAT-01～11矩阵、smoke或完整设备拓扑；不为了证明隔离反复启动/停止DEV或UAT，也不跑无关verify。

实际部署与数据导入的host/resource身份预检、服务readiness、现有seed owner readback、阶段报告、日志与临时资源cleanup是操作完成条件，保留但不包装为业务功能测试。必要编译/构建仅用于产出合法可部署物，不代表功能测试通过；本次授权包含这些产物步骤。

## 2 · 复用与唯一来源

- scripts/dev/r5-dev-runner.mjs、managed-process-tree.mjs的受管identity/readiness/日志/cleanup模式；不复用DEV实际资源或大规模复制runner。
- 一个CBS、一个UAT PostgreSQL业务数据库、现Flyway、三个辅助TDS/双HAProxy，以及独立MinIO/Doris/LiveKit；资源具体值在实施获授权后读取，不猜测。
- doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json及唯一六阶段业务executor；仅建立环境target适配，不复制fixture/业务逻辑。
- 两后台既有build脚本与相对API；platform-admin构建前注入VITE_OPERATIONS_ADMIN_ORIGIN，远端gateway提供两个dist及各自同源/API upstream。
- 四个拥有 `serverSpaces` 的package.json（两个integration、两个Android application）与现resolveManagedServerSpaces/server-config消费链，不建立第二份地址来源；每个UAT空间包含CBS、LiveKit与两个UAT HAProxy TDS入口。

## 3 · CP顺序：全部是实施/静态对账，不要求真实seed退出

| CP | 工作与明确住址 | 退出条件 |
| --- | --- | --- |
| CP-01 环境identity/config | 新scripts/uat配置与manifest入口；重开scripts/dev/r5-dev-environment.mjs、r5-dev-runner.mjs、managed-process-tree.mjs和scripts/env/check-runtime-resource-budget。分配独立host/resource/DB/namespace/凭证引用/协议与端口；UAT容器使用`com.catering-v2s.uat-root`，不得使用被DEV全host residue guard扫描的`com.catering-v2s.remote-root`；核对r5-remote-java和managed-diagnostic-protocol仅为DEV身份。解析实际Spring Boot artifact，并记录对应解析版本的官方API/JAR来源；仓内声明版本不能替代解析结果。host容量不足只拒绝新增UAT，不停止DEV | 配置/identity/预算/端口及guard消费者、版本依据静态对读，CP对账MATCHED；不运行共存测试 |
| CP-02 数据与middleware配置 | 受管UAT PG/volume/database/role及MinIO/Doris/LiveKit/HAProxy/Nginx配置。明确CBS内部MinIO endpoint、UAT公开资产ingress、公开bucket与`CATERING_ASSET_PUBLIC_BASE_URL`；同表配置LiveKit signal/API地址、TCP/UDP媒体端口、advertised `node_ip`、CBS signer及终端地址。业务服务、数据库、对象存储、LiveKit密钥及资源独立；CBS现有两项登录限流HMAC配置值直接复用DEV，不新增限流配置。锁实际镜像版本/digest，并记录对应上游版本资料 | 配置与部署/cleanup消费者、镜像版本依据静态对读，CP对账MATCHED；不要求先部署UAT |
| CP-03 CBS/TDS与bootstrap | 复用CBS Flyway/TDS授权与启动逻辑；参照ManagedInvitationBootstrap.java的非WebCLI调用IAM owner，补canonical pa-bootstrap稳定ID/built-in/credential/audit/readback；普通CBS无bootstrap输入。CBS资产与LiveKit signer配置指向同一UAT实例 | 合法可部署物及启动/bootstrap/readback调用链静态对账MATCHED；不运行空/非空反例测试 |
| CP-04 唯一seed target | 详设§10b列出的四主阶段/两post-step/父子报告与validators统一使用environmentKind+managedEnvironmentRunId；同步DEV-only kind、DB/namespace、HTTP、OTP、凭证、进程、诊断与子环境。UAT HTTP只到其CBS ingress，DEV行为保持。唯一`inv-expired`按本次明确批准的受限UAT adapter执行，其余fixture继续走owner API。HTTP endpoint从UAT manifest验证；SSH alias、fingerprint、boot与远端container身份独立验证，不将alias文本与公网地址比较 | seed target、静态消费链与报告验证接线的阶段对账MATCHED；CP退出不运行完整seed dry-run或真实导入。dry-run是全部CP及6b之后、初始化前的批次级准入 |
| CP-05 后台产物与terminal地址 | 两后台既有构建/发布逻辑；platform-admin build前写UAT operations-admin origin，两个dist的/API代理指UAT CBS。CBS写入指向UAT MinIO内部endpoint，生成的业务资产URL由独立公共asset ingress提供。四个终端package.json保留development并新增uat business/livekit/两个TDS地址 | 产物/发布/地址声明与实际消费者静态对读，CP对账MATCHED；不运行浏览器登录、图片或设备连接smoke |
| CP-06 实际init/start装配 | 完成scripts/uat/check/init/seed/start/stop/status接线：`init`须在任何远端资源副作用前原子写入持久manifest为`INITIALIZING/seedAllowed=false`，先登记host/root/run与计划资源身份；部署读回后立即补实际container/volume身份；迁移、服务readiness及临时staging清理全通过后才转为`READY/seedAllowed=true`。init失败记`INIT_FAILED`、阶段/首败/cleanup并保留已登记身份；若实际Docker身份尚未读回，`stop`不得报告清理PASS。readiness后单独运行`seed`，其owner-command阶段调用内部非Web IAM bootstrap，再导入一次完整r5-full；`start/restart`不bootstrap、不seed，`stop`只处理owned服务并保留数据；日志与cleanup复用现能力。不建设测试runner | 全部实现与生命周期静态对账MATCHED；真实init/seed/UAT_READY留到§5实际操作 |

主agent唯一写入/执行。每CP按原需求、详设、适用记忆和源码逐点双读；静态独立对账只覆盖真实变化，不重复核未修改内容。必要编译或构建仅为合法产物，不要求测试。文档中“同步tests/测试映射”仅指保持既有fixture contract、report validator与实现一致，不产生新增测试义务，也不运行测试。每CP完成后再进入下一CP。

CP-01 本地实现已完成且fresh独立三维对账MATCHED：配置入口为`./scripts/uat/check`与`scripts/uat/uat-config.mjs`；资源预算合计为12,288 MiB服务上限、3,072 MiB主机保留、3,072 MiB UAT Docker磁盘预算及1,024 MiB主机磁盘保留。最新受管快照run `uat-host-preflight-20261014T061514584Z-28d76933-3d48-4fbd-a5a3-a88deceb83b2`读取同一受管SSH host alias `catering-remote-dev`，host boot id `b37e1fe3-4e4b-4459-9f5c-7620f3f26063`，架构`x86_64`、8 CPU、可用内存16,698 MiB、Docker可用磁盘5,361 MiB；17个计划端口均空闲，`/srv/catering-v2s/uat`不存在。UAT服务预算加主机保留后余1,338 MiB，磁盘预算加主机保留后余1,265 MiB。该次是身份/容量/端口预检，不是部署、服务readiness或用户体验测试；init前仍按受管入口重新读取。

CP-02 实现完成，fresh独立三维对账`MATCHED`（`uat_cp02_reconciliation_r2`）。主agent finding intake：`OPEN-1=CONFIRMED`，Compose 曾以namespace填入`uat-root`并重复硬编码label key；最小修正为`uat-root=<UAT_REMOTE_ROOT>`、独立UAT namespace label，且host snapshot读取两者；`OPEN-2=CONFIRMED`，缺CBS运行环境唯一投影；最小修正为`renderUatCateringBusinessServerEnvironment`，从UAT凭证和配置常量生成DB/MinIO内外地址与bucket/LiveKit API及signal环境值，并由middleware bundle共同输出。focused proof `UAT_CONFIG_RENDER_AND_YAML_PARSE=PASS`：六项service、四项volume、root与namespace标签、CBS DB/asset/LiveKit projection、UAT HAProxy与Nginx ingress已核对；DEV HAProxy默认loopback与control socket未改变。该对账只覆盖CP-02静态配置和结构解析，不代表镜像拉取、部署、服务readiness或公网可达。CP-01远端快照核实PG/MinIO/Doris/HAProxy现有tag/digest及LiveKit固定source digest；Nginx官方`1.30.5 linux/amd64` manifest digest已固定但尚未部署。实际服务行为仍留到批次级部署步骤。

CP-02 HMAC配置复用差量由fresh只读reviewer `uat_cp02_reconcile_hmac`核为`MATCHED`。复核确认CBS运行所需的两项HMAC配置值直接取自DEV凭证文件；数据库、业务凭证、对象存储、LiveKit、container、volume、端口和UAT服务身份仍独立。此差量仅为源码/文档对账，不代表凭证已写入UAT运行配置或服务已启动；实际合并接线属于CP-06。

CP-02 HMAC helper focused proof：`node --check scripts/uat/uat-environment.mjs`通过；只读调用`readDevelopmentRateLimitHmacCredentials()`输出`UAT_DEV_HMAC_CONFIG_READ=PASS`，仅核对两项预期key均存在，值未输出。该证明验证DEV配置读取，不证明UAT credentials 写入或CBS启动。

CP-03实现完成，fresh独立三维对账`MATCHED`（`uat_cp03_reconciliation_r4`）。finding intake=`CONFIRMED`：`ManagedUatPlatformBootstrap.Input`原先接受任意格式正确的UUID，未绑定唯一r5-full fixture contract 的`pa-bootstrap`稳定身份；最小修正是在唯一`managedUatPlatformBootstrap` Gradle入口解析fixture contract，验证唯一`pa-bootstrap`的ID/login/display/builtIn/status，再以该ID覆盖JVM输入，未复制ID或第二份seed。`./gradlew :apps:backend:catering-business-server:classes`=`BUILD SUCCESSFUL`；只读fixture投影核验输出`UAT_BOOTSTRAP_CANONICAL_ID_SOURCE=PASS; FIXTURE=pa-bootstrap; ID_INJECTED_BY_EXISTING_GRADLE_ENTRY=PASS`。`PlatformAuthenticationService`仍通过窄非HTTP `PlatformUatRootBootstrap` owner command在同一IAM事务校验空表、创建built-in管理员/credential/audit并readback；`ManagedUatPlatformBootstrap`以`WebApplicationType.NONE`运行且不接入普通CBS启动参数。TDS配置由`renderUatTdsServerEnvironment`为A/B/C三节点使用同一UAT数据库、独立`catering_v2s_tds_uat`角色、现有容量值和UAT Doris endpoint/credential；`renderUatTdsDatabaseGrantSql`保留现有读取、session state与owner函数权限，并要求Flyway创建的terminal-control对象完整后才授予两项SQL command。CBS仍提供IAM要求的两个非空HMAC配置值，仅用于既有限流桶指纹，不改变策略；按Dexter本次指示，UAT复用DEV中的这两项配置值。配置证明`UAT_CP03_CONFIG_PROOF=PASS`及类编译成功；未运行功能测试、Flyway、bootstrap、服务或seed。

CP-04 实现完成，fresh独立三维对账`MATCHED`。主 agent finding intake：UAT `inv-expired`受限fixture缺少SQL完成后的owner HTTP readback=`CONFIRMED`，已通过既有`getWorkspaceInvitation`读回并核对同一邀请、`EXPIRED`状态、唯一角色名及目标节点；seed父子报告仍使用DEV专属保留标签=`CONFIRMED`，已按`environmentKind`输出DEV/UAT标识。复核发现owner-command self-test manifest沿用旧形状及seed report引用已移除的`effectiveManagedDevRunId`，均为`CONFIRMED`并已最小修正。CP-04相关七个脚本`node --check`=`PASS`，旧环境变量/报告标识扫描无残留；未运行self-test、功能测试、seed、构建或环境操作。fresh reviewer确认CP-04`MATCHED`；本结果只关闭静态CP-04，不代表dry-run或导入通过。

CP-05实现完成，fresh只读三维对账`MATCHED`（`uat_cp05_reconcile`）。复核确认两个后台build将API/upstream与跨后台origin指向UAT；远端发布将CBS、TDS、两个前端dist与asset ingress放入UAT受管配置；四个`serverSpaces.uat`消费者均含UAT business、LiveKit与两个TDS HAProxy地址，development保留。此结果只关闭发布配置与地址消费者的静态接缝，不代表构建、发布或服务可达。

CP-06 fresh复核 finding intake：`INIT_READY_BEFORE_READINESS=CONFIRMED`，且同根扫描确认`INIT_MANIFEST_AFTER_REMOTE_SIDE_EFFECTS=CONFIRMED`。原实现把持久manifest写成READY早于readiness；前次修复虽延后READY，但仍在远端Compose部署和数据库建库后才持久登记环境身份，若此前失败会留下远端副作用而无可读的UAT状态。最小修正复用现manifest：本地构建成功后、写凭证及任何远端副作用前，先原子写`INITIALIZING/seedAllowed=false`并登记host/root/run和计划资源身份；部署返回后立即持久化真实container/volume身份；所有服务readiness和临时staging清理通过后才写`READY/seedAllowed=true`。失败时按精确`runId`写`INIT_FAILED/FAIL_INIT`、phase、firstFailure和cleanup；若部署未完成资源身份读回，`stop`拒绝清理PASS，不按未知名称删除。`scripts/uat/seed`仅接受READY，`status`读取持久manifest；无新增恢复或reset机制。修订后需重跑三个脚本的`node --check`并由fresh只读reviewer复查完整CP-06；部署、seed、功能测试及环境操作尚未运行。

### 各CP静态失败条件、禁项与重读位置

| CP | 不继续实现/不标MATCHED的条件 | 禁项与理由 | 重读位置 |
| --- | --- | --- | --- |
| CP-01 | 当前受管SSH host fingerprint/boot身份与绑定不符，或预算/端口不足 | 不停止DEV、不清理未知对象；两环境保持独立。Dexter于2026-10-14明确说明当前远端主机安全并授权使用既有SSH通道，故历史安全报告不再单独阻断当前实施；仍保留报告并按受管入口核验当前host/boot与资源身份 | 详设§2.1–2.2；`scripts/dev/r5-remote-host-trust.mjs`、manifest与预算消费者 |
| CP-02 | UAT数据/中间件身份、配置或可用容量不闭合 | 不复用DEV容器/卷、数据库/对象存储/LiveKit业务凭证；按详设§2.2复用的两项IAM HMAC配置值除外。不删除已有数据或镜像缓存 | 详设§2.2–2.3；现有DEV部署配置、环境变量消费者与资源identity |
| CP-03 | Flyway、TDS授权或IAM owner bootstrap链不完整 | 不直接写其他owner schema，不给普通CBS传bootstrap输入 | 详设§4权限表、§10b.6；CBS启动与`ManagedInvitationBootstrap` owner实现 |
| CP-04 | 父子target/run identity不一致，或`inv-expired`的owner HTTP前置/manifest identity不满足 | 不跳过fixture，不伪造DEV身份，不扩展唯一allowlist | 详设§10b.4–10b.6；唯一seed executor、target adapter、报告/context validators与fixture contract |
| CP-05 | 任一UAT URL无法从实际配置/消费者对应到真实UAT资源 | 不猜地址，不在assembly硬编码，不删development | 详设§2.3、§11a UAT-R05；四个终端package与resolver/config消费者、两后台build和gateway |
| CP-06 | 首个远端副作用前未持久化INITIALIZING manifest、实际资源身份/readiness/失败状态未记录，或首次导入前dry-run未通过 | 不清空其他UAT数据、不触碰未知资源；唯一获批的一次性例外见§8，仅可重建本次新环境首次失败r5-full导入所写入的同一UAT数据库；资源身份不完整时stop不得报告cleanup PASS；start/restart不seed | 详设§10b.6、§11b；UAT lifecycle、seed父子报告、日志与cleanup消费者 |

上述为原CP失败条件与复读锚点汇总，不增设门、测试或额外审批步骤。

## 4 · 动态前整体准入与必要日志

全部CP完成后，先做全批6b静态对账；随后在实际init/导入之前，按本次授权和适用准入对当前完整字节执行一次r5-full seed dry-run。所需terminal-update工件如已有合法成功的`update.artifacts`受管source run及完整导出文件则复用；缺失时仅通过既有受管入口准备：设置`R5_TERMINAL_UPDATE_SEED_ARTIFACT_EXPORT=1`并运行`node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --case update.artifacts`，记录成功source run ID，再以`R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<runId>`运行dry-run。不得运行owner-flow、浏览器或设备体验场景。dry-run是批次级导入前置，不是任何CP退出条件。UI/testId/L2为NOT_APPLICABLE_WITH_REASON：无新增UI或L2，本次不做测试。

实际部署/seed入口、target/凭证/权限、owner请求、异步返回/readback、父子报告与cleanup按详设§11b保留结构化日志。已有审查能覆盖当前字节时沿用，只补变化闭包；不新增动态测试或重开历史DESIGN cycle，不把报告存在当运行成功。

## 5 · 一次实际部署与完整数据导入

这是实际环境操作，不是测试或验收矩阵：

1. Dexter于2026-10-14明确确认当前远端主机安全并授权使用既有SSH通道；据此继续当前UAT实施，不再把`.runtime/security-audit/20261011T075735Z/report.md`单独作为停工条件。该报告仍作为历史安全事件保留，不改写为从未发生。通过`scripts/dev/r5-remote-host-trust.mjs`及现有受管入口核对当前SSH fingerprint、host/boot、DEV manifest身份、资源ownership、独立端口/预算与host余量；不使用聊天中暴露的密码，不为UAT停止DEV、不清理未知对象。若当前受管身份或容量实际校验失败，按精确失败项处理，不以历史报告替代当前读数。
2. 通过`scripts/uat/init`建立独立UAT基础设施、执行Flyway并启动seed配置下的CBS/TDS及必要服务，记录服务readiness；`init`不创建管理员、不执行seed。
3. `init` readiness成功且当前字节完整dry-run通过后，单独调用`scripts/uat/seed`。其owner-command阶段通过内部`bootstrap`子命令运行非Web IAM owner bootstrap并读回canonical管理员，再用唯一r5-full target执行四主阶段与两post-step，沿既有owner读回、receipt与父子报告确认实际数据。不得只看exit code；唯一`inv-expired`按详设§10b.6获批的UAT精确例外执行。
4. 发布两个远端后台dist、同源API与正确跨后台origin；核对CBS MinIO内部endpoint、bucket与浏览器可达publicBaseUrl/资产ingress的配置链一致。保留既有静态服务readiness。不启动自动浏览器、图片、终端smoke或新测试。
5. 清理本次临时staging及seed子进程，长期UAT服务/数据标intentional-retain；读取导入日志与阶段报告，分列seed完成/失败、服务readiness、cleanup与未完成项。
6. 服务发布、完整seed及cleanup完成后记录UAT_READY，交付两个后台URL、受管凭证交付方式与导入报告，供用户体验测试；至此本批环境准备交付完成，不等待用户测试结果，也不追加agent功能验收。

普通start/restart不调用bootstrap或seed，不安排重复启停证明。若实际seed失败，默认保留firstFailure/partial report，不自动reset、wipe或重seed；只有Dexter对某个精确失败导入另行明确授权时，才可在该授权明确的资源边界内处理。当前授权只覆盖本次UAT新建数据库的首次r5-full导入失败：必须匹配本UAT run id、host/boot、已登记容器/卷、数据库名、唯一失败阶段与原始父子报告；先归档失败证据，只重建`catering_v2s_uat_r5_full`并读回owner，保留独立UAT TDS角色、其他数据库、DEV、容器、卷、对象存储和未知资源，然后仅完整导入一次。受管命令不成为通用reset入口；失败后不得盲目重复执行。

## 6 · 已批准的唯一 `inv-expired` UAT 适配边界

Dexter已明确批准仅将当前唯一`inv-expired`受管SQL fixture例外扩至UAT。适配器先确认普通owner HTTP创建了唯一精确PENDING invitation，再绑定UAT host、container、database、namespace和唯一intent；受限事务只更新过期状态、时间/version并写关联audit/receipt，之后必须经原owner HTTP readback。保持唯一executor与allowlist，不增加通用SQL通道、业务HTTP或其他fixture；DEV路径继续按原DEV manifest校验。

## 7 · 逐代码与详设对账与交付

实施交付前由fresh只读reviewer对实际变化逐代码与详设对账，范围为UAT脚本/config/manifest、IAM bootstrap、seed target与实际消费者、两后台发布与两terminal地址、README；结论MATCHED/OPEN。已匹配且未修改的内容不重复对账。不以测试矩阵或历史运行替代当前静态对读。

交付目标仅为独立可供用户查看的环境与完整数据导入；附服务地址/版本、实际导入报告、日志、cleanup/retain、OPEN项。功能测试/浏览器/TER/设备/UAT验收均NOT_PLANNED，不得冒充PASS。实施、构建、部署和seed状态依当前字节与受管运行记录更新，不沿用历史NOT_RUN状态。

## 8 · 2026-10-14 本轮实际运行与差量修复

- 受管初始化续接 `uat-continue-init-20261014T094046565Z-102c999d-0663-4b53-9018-984a957c50a8`：CBS、TDS A/B/C、HAProxy、platform-admin 与 operations-admin readiness PASS；临时staging cleanup PASS。UAT manifest `uat-40b223b0-2053-4b16-9760-1e00a6a5acf8` 已到 `READY/seedAllowed=true`。
- 首次完整seed `uat-seed-20261014T094154146Z-ab2d3fa5-5023-4647-9dea-f8895361b7bf`：静态计划PASS；197个owner HTTP调用均有完成事件，失败发生在唯一 `inv-expired` fixture 阶段，`COMPLETE_SEED_OWNER_FAILED:EXIT_2`；父运行cleanup为 `PASS_PRESERVED_UAT_STATE`。owner报告没有导出逐业务实体ID或可续接checkpoint，manifest明确要求失败后不自动reset/重seed。
- 根因已由当前UAT manifest与adapter源码核实：UAT业务ingress为公网地址，SSH host trust保存的是连接别名；adapter错误地要求二者字符串相等，导致在SQL执行前拒绝合法UAT目标。最小修正复用 `seedTargetBaseUrl(manifest)` 校验HTTP目标格式，并继续以databaseName校验目标数据库；SSH alias/fingerprint、boot、PostgreSQL container与namespace仍由现有受管身份链独立核验。未改变fixture范围或SQL mutation。
- Dexter已明确授权在当前首次失败后只重置其新建的UAT数据库并完整导入一次。恢复实现限于`scripts/uat/seed --reset-failed-initial <environmentRunId>`：精确检查唯一seed首败、UAT host/boot、容器/卷身份及database owner；先停本manifest拥有的CBS/TDS，归档首败日志与父子报告，只`DROP/CREATE DATABASE catering_v2s_uat_r5_full`并读回原owner，保留UAT TDS角色及所有其他资源，再恢复CBS/TDS readiness并执行一次完整r5-full seed。若任何身份/readback不符即拒绝，不按名称删除对象；通用seed失败策略不变。该一次性运行授权不扩展为常规reset能力。
- 按DEV reset的受管顺序收敛UAT恢复：先按完整r5-full父报告（`r5-complete-seed-manifest/report`、`runtime/seed/complete/<completeRunId>`）与对应owner-command子报告（`r5-formal-seed-manifest`、`runtime/seed/<environmentRunId>`）核对唯一失败链；再读取当前UAT资源身份，并在停止服务或清理/重建数据库前重新执行当前字节的完整seed dry-run并保存输出摘要；随后才停止manifest拥有的CBS/TDS、归档首败子阶段和诊断文件、重建唯一数据库并读回owner、恢复服务readiness，最后执行唯一一次完整seed。只复用DEV reset的manifest、dry-run、受管身份、首败、readback与顺序纪律，不调用DEV reset，不清理DEV Doris、资产、容器、卷或任何未知资源。恢复入口仍只针对本次首次失败，不成为常规reset能力。
- Dexter随后要求沿用DEV的受管reset顺序完成当前仍未成功的UAT初始导入。当前失败`complete-seed-8177b062-5286-4dfd-86a7-adb7ff3c4f82`为精确HOT工件422；当时仅一个FULL工件已创建、规则为零、owner/post-step cleanup均PASS。新工件受管导出`7982eb43-5a60-4f12-aed7-068361ae6500`与完整`r5-full --dry-run`均PASS。只为本次未成功的初始导入增加一次恢复：要求UAT manifest同一run/host/boot/资源身份、无成功seed、精确父子报告链、当前完整dry-run通过；仅重建`catering_v2s_uat_r5_full`并读回后恢复UAT服务，再完整导入一次。此项不允许已成功seed后的重置，不扩展为常规reset或DEV操作。
- recovery差量复核已确认完整seed父报告与owner子报告是不同run id/kind及不同目录；恢复代码据各自真实manifest链接验证。同步修正`renderUatTdsPrincipalSetupSql`的显式导入；remote DB预检使用脚本内已绑定的TDS角色名，保留该角色并只重建业务数据库。该次修订完成时`node --check`与模块导入检查通过，恢复/seed当时尚未执行。
- 后续同根核验发现`tds_role`虽在资源身份检查remoteRun中绑定，却未绑定到执行数据库reset的独立remoteRun；主agent已在reset shell绑定同一UAT TDS角色常量，保持预检逻辑不变。该次修订后`node --check`通过；当时恢复/seed仍未运行。
- 前次恢复调用在本地报告身份核验阶段以`UAT_SEED_RECOVERY_OWNER_FAILURE_IDENTITY_MISMATCH`退出，破坏性阶段未开始；核对实际seed报告与owner executor后发现owner manifest使用`cleanup`、seed报告使用`cleanupStatus`。已修正为读取各自真实字段，owner manifest与完整seed父子清理判据保持不变；随后恢复成功，详见对应运行manifest。
- 中间检查点（已被最终收口记录取代）：`uat-seed-20261014T094154146Z-ab2d3fa5-5023-4647-9dea-f8895361b7bf` 曾报告 `SEED_TERMINAL_INVITATION_EXPIRED_FAILED`，cleanup=`PASS_PRESERVED_UAT_STATE`；当时最后一次通过仍只是初始化readiness，不代表完整导入通过。后续恢复及当前字节最终状态见下一条，不沿用此中间检查点作为最新结论。
- 最终收口（2026-10-14）：按 DEV 受管运行的同一原则先核对 manifest、host boot、进程与容器身份及 seed 父子报告，再选择最小操作。最新完整 r5-full 导入报告 `complete-seed-4c8211ec-34cb-4c22-9c56-c0559efa1ee8` 对应环境 `uat-40b223b0-2053-4b16-9760-1e00a6a5acf8`，business=`PASS`、cleanup=`PASS_PRESERVED_UAT_STATE`；四个主阶段及两个 post-step 均通过。其后的故障发生在 seed 完成后的普通 CBS 启动，根因是 `CATERING_OTP_DEBUG_CODE_EXPOSURE=true` 只进入 diagnostic 环境投影，未进入普通 UAT CBS 环境；并非 seed 数据失败。已将该现有 UAT 配置加入普通 CBS 环境，并修正 seed 收口逻辑以区分“seed 已通过、CBS 后启动失败”与“seed 本身失败”。因此按受管 `scripts/uat/stop` 停止 owned CBS/TDS/容器并保留数据库、volume 与完整 seed 数据，再经 `scripts/uat/start` 重启服务；没有重置或重跑已成功的 seed。stop run=`uat-stop-20261014T115953985Z-180f56a7-b9f5-4aee-8ad7-8dd02a9d5803`，状态`PASS`、`VOLUMES=RETAINED`、`DATABASE=RETAINED`；start run=`uat-start-20261014T120025882Z-744a83ee-8cc2-4f93-899a-ce47feeb14ed`，CBS 与 TDS A/B/C readiness=`PASS`、`SEED=PASS_EXISTING_REPORT`。最终 status run=`uat-status-20261014T120120227Z-0f3065ca-2573-4f0d-a040-b3d260294140`：环境`READY/PASS_SEED_IMPORTED`，六个UAT容器运行，CBS、三个TDS进程身份匹配，platform-admin与operations-admin公网`/healthz`均为HTTP 200。当前字节最新运行是上述 status/readiness 收口；最后一次完整 seed 通过为`complete-seed-4c8211ec-34cb-4c22-9c56-c0559efa1ee8`，仍与当前数据库字节一致；seed 未重跑。用户体验测试由用户执行，本批不运行功能测试或自动化矩阵。
