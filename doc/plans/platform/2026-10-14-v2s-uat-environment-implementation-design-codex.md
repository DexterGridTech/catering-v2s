# V2S UAT 环境详设

- 日期：2026-10-14
- 任务来源：Dexter 本会话明确需求
- BUSINESS_SOURCE：本会话需求 UAT-R01～UAT-R10（§8）
- JOURNEY_REFS：N/A；本批不新增业务用户 Journey 或页面
- IA_REF：N/A；本批仅部署现有 platform-admin 与 operations-admin 前端
- INTERACTION_REF：N/A
- AUTHORIZED：依 Dexter 2026-10-14 最新指派完成必要文档/源码/脚本/配置修订，创建受管 UAT 资源、Flyway、首次管理员、两个后台远端发布、完整 r5-full seed dry-run 与首次导入，以及产出合法部署物所需的构建/工件校验。
- NOT_AUTHORIZED：生产环境、DEV reset/seed、清空既有 UAT 数据、清理未知资源、功能测试矩阵、backend-acceptance、自动浏览器、终端体验场景、设备 smoke、故障注入、重复启停、L2、UAT 用户体验代测及范围外工作。
- IMPLEMENTATION_AUTHORITY=true（仅限本次 Dexter 指派列明的 UAT 准备与首次导入）。
- 设计复评为独立 GO（M/S/N=0/0/3）；该 verdict 不代表实现、部署或seed通过。后续状态仅按当前字节与受管运行更新。功能测试和用户体验验收为 NOT_PLANNED，不得写成PASS。
- 2026-10-14 Dexter最新裁决（逐字）："UAT环境我只想完成seed数据的导入，方便用户有数据可以看，不做测试"。
- 同日进一步澄清（逐字）："UAT环境是给用户体验测试的，所以有测试数据，环境就绪就可以了"。用户负责体验测试；agent交付条件仅为独立环境就绪、完整体验数据导入及必要操作收口，不承担额外自动化测试、业务验收或替用户测试。
- 配置复用裁决：UAT沿用DEV已有配置结构、服务默认值和同一套部署/seed机制；只将必须隔离的服务地址、资源身份、数据库及对应业务凭证替换为UAT值。CBS两项现有限流HMAC值直接复用DEV配置，不另设独立密钥或新限流策略。该配置复用不令UAT连接DEV数据库、容器、卷、对象存储或LiveKit。
- 范围解释：保留独立UAT服务、两个后台远端发布及完整seed导入；删除测试专项、UAT-01～11矩阵、浏览器/终端smoke、负例注入和为了证明隔离反复启停环境。实际导入的owner读回、服务readiness、资源identity与cleanup是操作完成条件，不作为功能测试。原内部/外部review结论只对应旧字节，本次范围变更不回写历史verdict。

## 1 · 真实目标与方案比较

### 1.1 本批要解决的问题

现在只有供开发调试的 DEV：业务服务和数据在远端，两个后台前端由本机 Vite 提供，终端默认地址指向 DEV。它不能代表一套独立、可交付给验收人员使用的环境。若把 UAT 地址临时塞进 DEV 配置、共享 DEV 数据库或仍依赖本机 Vite，验收请求可能落到 DEV、UAT 前端可能随开发机关闭而不可用，初次部署也没有可复核的业务数据。本次的业务目标是让用户进入UAT后台后有数据可看，不是验证现有业务功能；不建设额外自动化验收套件。

本批要给同一受管远端主机上的 UAT 建立独立服务身份、独立数据库及数据目录、远端静态后台、终端 UAT 地址，以及只在第一次初始化时运行的完整 seed。UAT 与 DEV 互不读写且可以同时运行，各自使用独立服务身份、端口集合、数据库/目录和环境预算。UAT 用量只核对 UAT 预算，DEV 用量只核对 DEV 预算；不把一方环境内预算借给或记入另一方。远端主机仍有共同物理容量边界，init 前按两套已声明预算合计做主机容量可行性检查；它用于避免超卖，不改变两边独立预算，也不因另一环境已运行而停止对方。DEV 的本机 Vite、DEV 数据和日常启动方式保持原用途。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：在现有 scripts/dev runner 中增加 UAT 分支，并继续复用 DEV 数据库、目录和 manifest | 两环境共享身份和生命周期；分支条件可能把 UAT 操作落到 DEV；现有 seed 的 DEV 限制仍在 | 拒绝：不满足独立环境，增加错误操作风险 |
| B：复制整套 DEV runner、seed fixture 和 owner seed executor 到 scripts/uat | 环境分离，但相同业务 seed 逻辑出现两份，后续 fixture 漂移 | 拒绝：重复业务实现成本高 |
| C：增加独立受管 UAT 生命周期和资源身份，复用唯一 r5-full seed 业务流程并增加 UAT target adapter | UAT 有独立远端服务、数据库、目录与 manifest；seed 业务断言仍只有一份；UAT 前端远端静态托管 | 采用 |

我选了 C 而不是 A/B，因为独立环境需要独立身份与数据边界，但同一份 r5-full 业务 fixture 和 owner command 不应复制。

## 2 · 环境形态与边界

### 2.1 部署拓扑

UAT 部署到与 DEV 相同的受管远端主机；所有容器、进程、持久目录和对外端口均使用独立 UAT identity，不复用 DEV 容器名、数据库、bucket、Doris 数据、业务凭证、LiveKit 凭证、HAProxy 配置或运行目录。CBS现有的两项登录限流HMAC配置值按Dexter本次要求复用DEV值，详见§2.2/§2.3；不增加UAT限流策略。Dexter 于 2026-10-14 明确确认当前远端主机安全并授权使用既有 SSH 通道，故历史安全检查不再单独阻断本批；`.runtime/security-audit/20261011T075735Z/report.md`仍保留为历史事件记录，不改写为未发生。CP-01通过`scripts/dev/r5-remote-host-trust.mjs`及受管入口核验当前SSH fingerprint、host/boot身份、DEV资源身份、端口与容量；读取后冻结UAT分配。UAT继续与DEV共享物理主机，但使用独立环境预算、资源身份、数据库、业务凭证、端口与运行目录。

CP-01配置正本为`scripts/uat/uat-config.mjs`：`environmentKind=uat`、远端root `/srv/catering-v2s/uat`、Docker label key `com.catering-v2s.uat-root`及其root路径值、独立`com.catering-v2s.uat-namespace`值、凭证文件 `.runtime/uat/credentials.env`，及UAT独立namespace/数据库/地址/预算。DEV `scripts/dev/r5-dev-runner.mjs`的全host residue guard仅扫描`com.catering-v2s.remote-root`，UAT不设置该label；`r5-remote-java` control kind/root 与`managed-diagnostic-protocol`也都是DEV身份，不由UAT复用。

UAT 组成如下：

| 组件 | UAT 实例数 | UAT 持久/访问边界 |
| --- | ---: | --- |
| catering-business-server（CBS） | 1 | 当前唯一业务 deployable；连接唯一 UAT PostgreSQL 数据库并使用 UAT 资产配置 |
| PostgreSQL | 1 个 UAT 专属实例及其 UAT 数据库 | 独立容器、volume、数据库名和账号；不连 DEV PostgreSQL 服务或数据库；一个数据库、多 owner schema、一个 Flyway history |
| terminal-data-server（TDS） | 3 个独立实例 | 只访问本 UAT 数据库中已授权的 TDS 对象；远端节点只绑定 loopback |
| HAProxy | 1 个 UAT 实例、2 个 UAT WebSocket 入口 | 只把 UAT 入口转发到 3 个 UAT TDS 节点；不引用 DEV upstream |
| 对象存储 | 1 个 UAT 实例 | UAT 专属数据目录、bucket 与凭证；不可读取 DEV 对象 |
| Doris | 1 个 UAT 实例 | 仅 TDS 连接历史 telemetry；独立数据目录/库，不承载业务事实 |
| LiveKit | 1 个 UAT 实例 | UAT 专属配置、密钥及网络入口 |
| 后台静态入口 | 1 个 Nginx gateway | 远端提供两个已构建 dist：platform-admin 和 operations-admin；每个 app 用独立监听端口及 root，/api 同源转发到 UAT CBS |

保留当前 DEV 的三 TDS/双 HAProxy 能力形态是为了让 UAT 具有与当前终端配置相同的连接入口和节点接管路径；不增加跨主机集群、自动扩缩容或生产 HA。

UAT 后台的两个前端仍是两个独立 app。两者 API base URL 当前均为相对根路径；远端 Nginx 对各自 listener 提供 SPA fallback，并将 /api 路由到 UAT CBS。`platform-admin` 的工作空间登录与邀请链接另外读取 `VITE_OPERATIONS_ADMIN_ORIGIN`，所以 UAT build 必须将它设置为远端 UAT `operations-admin` origin，不能依赖仅适用于本机 Vite 的 fallback。禁止将 Vite dev server 或本机 dist 预览服务作为 UAT 前端。使用 IP、域名、HTTP、HTTPS、WS 或 WSS 是部署地址配置；本设计不增加 DNS/证书作为产品前置，也不把某种协议硬编码为非法。终端现有 validateServerAddress 负责按当前契约校验 scheme。

前端使用的 session cookie 名分别来自 RuntimeEnvironmentKeys.V2S_PLATFORM_SESSION 与 RuntimeEnvironmentKeys.V2S_OPERATIONS_SESSION。两个远端 listener 继续通过各自同源请求使用既有登录与权限路径，不改变 cookie 或认证语义。

### 2.2 环境身份

新增 UAT 环境配置由受管 UAT runner 独占读取，至少包含：

- 目标远端 host identity、host boot id、SSH host fingerprint 与 remote root；
- UAT namespace、数据库名、PostgreSQL container/volume、CBS/TDS process identity；
- MinIO、Doris、LiveKit、HAProxy、Nginx 的 UAT container id/image digest/config digest；
- 终端与浏览器可达的 UAT ingress 地址及端口；
- 每项资源的预算、日志路径、readiness、run owner 与 cleanup/retain 状态；
- UAT 专属 `.runtime/uat/credentials.env` 的凭证文件身份与引用；沿用 DEV 受管 credentials-file 入口。UAT初始化时只从 `.runtime/r5/credentials.env` 读取并复用两项现有登录限流HMAC配置值，其余UAT服务/数据库业务凭证独立生成；任何secret值都不写入manifest、日志、普通配置或仓库。

CBS credentials 包含现有 IAM owner 要求的 `CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET` 与 `CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET`。`PlatformAuthenticationService`、`WorkspaceLoginRateLimitService` 在启动时要求各自配置非空值，用于生成账号/来源限流桶指纹；登录阈值与限流行为来自现有 CBS 代码，本专项不新增或改变限制。UAT直接复用DEV credential file中的这两个值，不为其另行生成密钥；其余UAT凭证仍独立。

所有持久 UAT 服务标为 intentional-retain；init/start/stop/status 只操作 manifest 精确拥有的对象。DEV 与 UAT 各持有独立服务/进程预算和 manifest；每个环境自己的预算只计该环境资源。首次 UAT init 读取远端主机实际余量，并验证 DEV+UAT 两套声明预算能同时容纳；预算不交叉扣减，主机容量不足时拒绝新增 UAT 资源并报告差额，不停止已运行 DEV。两环境在同一主机上的 listener 端口必须不冲突，隔离网络中的容器内部端口可复用。首次 init 发现已存在但 identity 不匹配的容器、volume、目录、PID 或端口时 fail closed；不得按名称、端口或路径猜测归属，也不得清理 DEV 或身份不明的对象。

共享主机的 Docker 资源身份必须避开现 DEV residue guard：UAT 容器仅使用 UAT manifest/run identity，并以 `com.catering-v2s.uat-root` 标记 UAT root；不得设置当前 DEV 全主机扫描的 `com.catering-v2s.remote-root` label。DEV 入口 `scripts/dev/r5-dev-runner.mjs` 继续只把 `remote-root` label 当作历史 DEV residue；UAT start/stop/status 只按 UAT manifest 与 `uat-root` 精确读回，不复用 `r5-remote-java.mjs` 的 `r5-dev-*` control kind/root 或 `managed-diagnostic-protocol.mjs` 的 DEV diagnostic transport。这样 UAT 常驻资源不被误判为 DEV residue，DEV 仍不具备停止或清理 UAT 的路径。

### 2.3 部署地址与消费者映射

| 配置/事实 | UAT 值及实际消费者 | 约束与完成观察 |
| --- | --- | --- |
| CBS API 内部与公网入口 | CBS 绑定远端loopback `127.0.0.1:19175`；Nginx `0.0.0.0:19182` 只代理 `/api` 到内部CBS listener；两个后台端口各自的 `/api` 同样代理到`19175`。终端UAT `business` 地址为`http://47.106.121.27:19182`。 | 外部CBS listener由Nginx提供，CBS自身不直接绑定公网；所有路径保留原URI，非`/api`路径返回404。核对三个监听与upstream的端口和配置hash属于同一UAT manifest。 |
| CBS 登录限流指纹密钥 | 现有 `application.yaml` 从 `CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET` 与 `CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET` 注入对应 IAM owner；owner 启动时拒绝空值，并以 HMAC 生成账号/来源限流桶指纹。 | UAT初始化经`scripts/uat/uat-environment.mjs:readDevelopmentRateLimitHmacCredentials`从`.runtime/r5/credentials.env`复用这两个值；不为UAT单独生成密钥，不修改当前限流阈值、锁定策略或认证结果规则，也不新增UAT专属限制。 |
| CBS→MinIO 写入 | `renderUatCateringBusinessServerEnvironment`输出`CATERING_ASSET_OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:19171`、UAT MinIO root 凭证、`CATERING_ASSET_OBJECT_STORAGE_BUCKET=catering-v2s-uat-assets`、对象前缀`v2s-uat-r5-full/`；另设置UAT专属private update bucket `catering-v2s-uat-terminal-update-private`和前缀`terminal-update/`。 | 复用 `MinioAssetObjectStorage` 的endpoint/bucket/access/secret消费者；CBS与Compose从同一个UAT凭证对象读取MinIO凭证；两个bucket均属于独立UAT MinIO，不复用DEV bucket。private update bucket不经公网ingress暴露。 |
| 后台/终端读取业务资产 | CBS 的 `CATERING_ASSET_PUBLIC_BASE_URL` 是浏览器可达的 UAT 资产 ingress；owner 生成地址形状为 `<publicBaseUrl>/<bucket>/<objectKey>`。ingress 指向上述同一个 MinIO 的公开业务资产 bucket。 | 这不是 S3 内部 endpoint，`/api` 的 CBS 代理也不会代替资产 ingress。两个后台用户可见的资产数据只用此地址；不要求新增自动浏览器/图片测试，不公开 private update bucket。 |
| 后台跨应用入口 | `platform-admin` 的 `VITE_OPERATIONS_ADMIN_ORIGIN` 在 Vite build 前设为远端 UAT `operations-admin` origin；两 app 相对 `/api` 分别由自己的 Nginx listener 转发到 UAT CBS。 | build 后的两个 dist 与 Nginx listener/upstream 使用同一 UAT 发布身份；保留两 app 独立 origin、cookie 与认证语义。 |
| LiveKit signaling 与 CBS 签发 | `renderUatCateringBusinessServerEnvironment`输出内网`V2S_LIVEKIT_API_URL=http://127.0.0.1:19184`及API凭证，并设置`V2S_LIVEKIT_SIGNAL_URL=ws://47.106.121.27:19184`；前者供CBS room terminator，后者供`LiveKitRemoteControlGrantSigner`签发给终端。终端`serverSpaces.uat.livekit`与CBS signal URL指向同一UAT LiveKit。 | 同步配置中的地址、credential引用和实例identity；密钥只在UAT credentials/runtime config，不进入package、报告或DEV。不开第二套LiveKit endpoint registry。 |
| LiveKit 网络与版本 | 现有 `scripts/dev/livekit/docker-compose.yaml` 暴露 `7880/tcp` signaling 与 `7882/udp` media；`livekit.yaml.template` 的 `port`、`rtc.udp_port`、`rtc.node_ip`、`keys` 是服务端消费。UAT由`scripts/uat/uat-config.mjs`固定signal TCP `19184`、media UDP `19186`，`node_ip=47.106.121.27`；同一公网主机网络由UAT LiveKit实例直接监听。 | TCP signaling、UDP media 与 advertised address 必须一致；不把WS readiness当媒体路径通过，不增加TURN、DNS、证书或HA要求。镜像按`UAT_IMAGES.livekit.ref`的固定官方source digest；实际image ID仍由首次受管启动readback记录。 |
| 终端 TDS 地址 | `sample-terminal` 与 `sample-wallpaper-terminal` 的 `serverSpaces.uat`：business 指 UAT CBS；livekit 指 UAT signal ingress；两个 TDS 地址指 UAT HAProxy 的两个入口。 | package 声明、server-config consumer、CBS/TDS/HAProxy 与 LiveKit 网络映射逐项一致；4个地址不包含 DEV/localhost。 |

## 3 · CP 总览

所有CP均为实施与静态对账阶段，不以真实seed、部署验收或测试PASS作为CP退出条件。实际初始化/导入在全部CP完成、静态全批对账及适用seed准入之后执行，避免seed依赖CP退出、CP退出又依赖seed的循环。本次授权覆盖全部CP实现；实际部署与seed按计划准入后执行。

| CP | 主题/owner | 主要输出 | 依赖 |
| --- | --- | --- | --- |
| CP-01 | scripts/uat：环境identity与配置 | UAT config/manifest、独立预算、host增量容量及协议/端口分配、凭证引用、`uat-root`与DEV residue guard 的精确相容规则；不得停止DEV腾资源 | 无 |
| CP-02 | scripts/uat：数据与middleware部署配置 | 独立PG/volume/DB/role、MinIO/Doris/LiveKit/HAProxy/Nginx配置和精确ownership；资产内部endpoint/公开ingress/bucket映射、LiveKit TCP/UDP/advertised-address/CBS/终端配置同表；只产出配置与受管部署逻辑 | CP-01 |
| CP-03 | CBS/TDS：启动与首次管理员能力 | 完整Flyway启动链、TDS授权配置、非Web IAM bootstrap entry与canonical pa-bootstrap读回；普通CBS不带bootstrap输入；bootstrap能力由CP-03实现，实际首次调用由CP-06的seed owner-command阶段触发 | CP-02 |
| CP-04 | seed脚本：唯一r5-full target适配 | dev/uat target、六阶段父子报告/validators/OTP/HTTP/凭证及诊断身份接线与静态对账；CP退出不要求或执行完整seed dry-run/真实seed。当前完整字节dry-run是全部CP及6b之后、实际init前的批次级准入 | CP-03 |
| CP-05 | 两后台/两terminal：发布与地址输入 | 两个dist的构建/远端发布逻辑、同源API、跨后台origin、CBS生成的公开资产URL与MinIO公开ingress、两terminal UAT地址集合及LiveKit signal URL闭合 | CP-02、CP-03 |
| CP-06 | scripts/uat：生命周期与导入闭环 | init/seed/start/stop/status装配及静态读回；init创建环境、迁移并启动seed模式服务，readiness后由seed单独运行，owner-command阶段调用内部bootstrap并导入一次；start/restart不bootstrap、不seed；无测试runner或smoke | CP-01～05 |

### 3.1 · 实施控制

- 各CP保持项目规定的原始需求/详设/源码双读和静态独立对账；不新增或运行单元、集成、浏览器、终端、性能、故障注入或UAT测试。
- 必要编译、类型检查及构建只用于产出合法可部署物，不能声称业务测试通过；本次授权允许执行这些产物步骤，不新增或运行功能测试。
- CP退出凭实现、静态对账和需要的产物检查，不索取真实seed六阶段报告或UAT_READY。
- 全部CP静态对账及全批6b完成后，按适用准入执行一次实际部署/完整seed导入；本次Dexter授权已覆盖该动作。实际owner readback、导入报告和cleanup不能省略，也不演变为额外测试矩阵。
- 首管理员bootstrap能力属于CP-03，实际首次调用由CP-06的`seed` owner-command阶段触发，随后CP-04既有owner stages消费该身份。`inv-expired`唯一fixture按Dexter本次批准的UAT受限adapter执行，精确范围见§10b.6。

## 4 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 可观察验证 | ③ 无现成时的实现形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | TDS 数据权限见 scripts/dev/r5-dev-runner.mjs 的 TDS principal 检查；TDS 仍只使用已批准 SQL functions 与读取表 | 静态核对UAT TDS账号的既有grant与SQL权限；不做越权注入测试 | 若 UAT 增加权限入口，沿同一 DB role 与函数执行模型，不给 TDS owner 表 DML | CBS runtime、TDS 三节点、seed/bootstrap |
| 写授权与 grant 复核 | CBS owner command 与 generated edge route；普通UAT seed mutation只调用已有seed API | seed report 的各 owner operation 与数据库 readback 相符 | UAT runner 不直接写业务schema；唯一首管理员初始化由UAT远端的一次性非Web CBS JVM调用平台IAM owner command。Dexter已批准`inv-expired`唯一UAT例外：按§10b.6绑定准确UAT身份和唯一intent执行受限事务，普通fixture不变 | 初始平台管理员、r5-full六个seed stage及单一`inv-expired`terminal fixture |
| 跨 owner 写与事务 | backend owner API、当前 r5-full seed executor | 每阶段使用既有 HTTP owner 操作并核验 owner report | UAT 首管理员由platform-admin IAM owner事务创建；seed runner不写owner schema。`inv-expired`只使用§10b.6获批的唯一manifest-bound adapter，不新增通用SQL或业务HTTP | UAT 首管理员、owner seed stage、单一`inv-expired`fixture |
| 集合形态与分页 | r5-full fixture contract 与当前 owner seed计划 | fixture 分母和执行报告相同，全部列表使用现有 cursor/分页 | 不新增业务集合 | 唯一完整 r5-full fixture |
| 缓存失效/改完刷新什么 | N/A：本批无前端业务状态改动 | N/A：远端页面加载后读取 UAT API | 不新增客户端缓存 | 仅部署构建 |
| RTK 数据读取与加载判定 | 两后台现有 query hooks 与 frontend standards | 静态核对API base与UAT upstream；用户自行使用页面，不运行浏览器测试 | 不新增读取模型 | 两后台现有页面 |
| 同一事实只有一个住址 | PostgreSQL owner schema 与 Doris 遥测边界；DEV/seed manifest 只存环境运行事实 | UAT 数据只在 UAT PostgreSQL，连接 history 只在 UAT Doris | UAT manifest 是资源身份记录，不成为业务数据库副本 | UAT 业务数据、TDS history、资源身份 |
| 失败可见且原因不得改写 | AGENTS.md 日志要求、scripts/dev/r5-dev-runner.mjs 的 firstFailure/lastKnownGood 模式 | manifest 记录首败、最后正常阶段、失败边界及 cleanup | 新 UAT runner 与该 runner 的结构化事件和 owner 绑定进程 readback 同形 | UAT check/init/start/stop/status 与 seed 父流程 |
| owner 错误与 HTTP 映射 | 现有 generated edge 错误映射 | seed 每个 operation 的 HTTP 状态、typed response 与 owner readback 一致 | 不新增 UAT HTTP API | 当前 seed 操作 |
| 新 owner 审计三件套 | N/A：不新增业务 owner 或审计事实；首管理员复用 platform-admin IAM 审计 | bootstrap report 和 platform_iam.audit_event 的唯一审计事实吻合 | 无 | UAT 首管理员 bootstrap |
| 幂等键与重放 | 当前 seed generated clients 与 owner receipts | 同一个 seed operation identity 按现有 receipt 语义读回 | 不为 UAT 增加一套幂等规则 | r5-full owner seed 操作 |
| 生成物 | contracts/openapi 与现有 edge generator | 生成检查确认新增/变更的环境相关路由没有手改 generated | N/A：无新增业务 API | seed 既有 API |
| 日志与诊断 | scripts/dev/r5-dev-runner.mjs、AGENTS.md 结构化日志/manifest 要求 | 逐阶段日志具备 runId、resource identity、phase、readiness、firstFailure、cleanup | 新 runner 使用 run-scoped JSON manifest 与原始子进程输出，不建设日志平台 | UAT实际部署/seed及生命周期命令 |
| DEV/UAT 独立预算与共存 | scripts/env/check-runtime-resource-budget 与 scripts/dev/r5-dev-runner.mjs 资源预检 | 实际部署前分别核对环境预算/identity与host余量；不为测试而启停DEV/UAT | 不增共享调度器；UAT manifest 持有自身预算，CP-01 另做主机 aggregate headroom admission | 同远端 host 上 DEV、UAT 的全部服务与 host listener |
| 迁移回填与可逆性 | CBS 单一 Flyway history，scripts/dev/start 的 additive migration 形态 | UAT 空 DB 启动后 Flyway history 与当前版本一致 | 不新增 UAT migration；数据库初始化是新 DB 的正常迁移 | UAT PostgreSQL schema |
| 前端共享行为 | 两后台依赖 admin-ui-foundation；无新 UI 行为 | 发布配置与实际服务readiness；不执行自动登录或页面测试 | N/A：静态发布不复制 UI lifecycle | platform-admin、operations-admin |
| 管理后台交互一致性 | N/A：本批不改控件或交互 | N/A | 不新增交互 | 不适用 |
| 候选/下拉数据源 | N/A：不改后台业务 | N/A | 不新增数据源 | 不适用 |
| 编码与名称呈现 | UAT 资源名统一以 uat namespace 派生；业务 fixture 名称保持现状 | 列出受管对象 identity，无 DEV 名称混入 UAT 标识 | 命名沿用脚本 namespace 派生规则 | UAT 容器、DB、volume、asset、日志、端口 |
| 原子组 | implementation-task-template 的按完整 CP/批次对账要求 | UAT init 成功必须同时满足服务、seed 与两前端 readiness | 按 CP 与一套 manifest 收口，不拆为独立服务交付 | UAT environment 整批 |

### 第三方组件与官方依据

后台静态托管采用 Docker Official Image 的 Nginx，负责静态 dist 与同源反向代理。对应一手资料：

- Nginx 官方 try_files 文档：https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files
- Nginx 官方 proxy_pass 文档：https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
- Docker Official Image 的 nginx 文档：https://hub.docker.com/_/nginx

UAT运行目标主机架构为`x86_64`；Compose对六个镜像固定`linux/amd64`并使用不可变registry digest。远端快照`uat-host-preflight-20261014T050235795Z-4d3f1f15-4662-46ad-9ddd-a4d911bac60f`读回PostgreSQL、MinIO、Apache Doris、HAProxy官方tag/digest，以及LiveKit当前tag/image身份；LiveKit UAT所用上游digest取自`scripts/dev/r5-livekit-resident.mjs`固定的官方source reference，不把远端tag或mirror名当作上游地址。Nginx依据Docker Official Image的`nginx:1.30.5` linux/amd64官方manifest digest固定，首次实际启动时仍须在manifest记录Docker image ID读回。镜像正本与来源如下，摘要同时固定于`scripts/uat/uat-config.mjs`：PostgreSQL `16-alpine`、MinIO `RELEASE.2025-09-07T16-13-09Z`、Apache Doris `all-in-one-4.1.3`、LiveKit固定官方source digest、HAProxy `3.4.6`、Nginx `1.30.5`；只从各自官方仓库按digest取用，不配置mirror。Docker官方镜像页：https://hub.docker.com/_/postgres、https://hub.docker.com/_/minio、https://hub.docker.com/r/apache/doris、https://hub.docker.com/r/livekit/livekit-server、https://hub.docker.com/_/haproxy、https://hub.docker.com/_/nginx。LiveKit配置沿用仓内受管resident所固定的官方source digest，runtime本地tag只是相同字节的导入别名。首次启动仍以目标官方digest的image readback为准，不将本地同名tag视为一致。

`scripts/uat/uat-service-config.mjs`是UAT服务配置唯一渲染源：渲染六个服务的Compose、LiveKit、复用`createHaproxyConfiguration`生成的两个公网TDS入口、Nginx双后台/API/公开资产入口，以及CBS唯一运行环境投影。PG、MinIO、Doris端口仅绑定loopback供CBS和管理使用；LiveKit、HAProxy及Nginx采用host network以保留公网UDP媒体和服务监听。CBS绑定loopback `19175`；Nginx提供外部CBS API ingress `19182`，仅转发`/api`，两个前端listener也把`/api`代理到同一个内部CBS listener；终端`serverSpaces.uat.business`使用公网`19182`。资产入口只转发公开业务bucket，private update bucket不暴露。CBS MinIO endpoint/公开资产URL/buckets与LiveKit API/signal/credential均由同一UAT地址和credential对象投影，不在CP-03/CP-06另组地址。HAProxy保留DEV默认控制socket位置；UAT配置把socket放在容器已有的`/tmp`，避免复制DEV控制目录。Compose健康检查使用`$$POSTGRES_USER`/`$$POSTGRES_DB`以将变量展开留给容器shell。配置渲染、静态文法解析与读取不等于镜像已下载、服务已启动或公网readiness。

两个后台当前声明并解析 Vite 8.0.0；Vite 官方 Env Variables and Modes 文档说明 `import.meta.env` 在 build 时静态替换，因此 UAT `VITE_OPERATIONS_ADMIN_ORIGIN` 必须在各 app 执行 `vite build` 前注入，build 后再读 dist 中实际链接确认值，不可依赖 Nginx 运行时环境替换。官方依据：https://vite.dev/guide/env-and-mode 。CBS 根构建脚本和 acceptance dependency assertion 声明 Spring Boot 4.1.0；本轮未执行 dependency resolution，当前 `/4.1/` 官方链接仅作为 API 家族导航，不作为 4.1.0 的精确版本证明。实施 CP-01 须读取实际 resolved artifact，并将核实结果绑定到对应官方版本 tag/Javadoc（含 `WebApplicationType.NONE`、`SpringApplicationBuilder.web(...)`），再验证 CLI context 未启动 HTTP server；实际解析版本、对应官方依据与行为验证当前均 OPEN/NOT_RUN。其他 middleware沿用UAT固定digest，不把DEV实际实例作为UAT服务复用。

## 5 · UI、L2 与服务操作集合

3a 状态：

- UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON：不创建或修改业务 screen。
- TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON：无新增自动点击控件。
- L2_SCRIPT_ADMISSION=NOT_APPLICABLE_WITH_REASON：本批设计的是独立 UAT 环境，不新增 browser L2 scenario；UAT 不冒充 L2。

环境命令与服务操作闭集（不是新增业务 HTTP operation）：

| 操作 | 方法/路径 | consumer face | 集合/结果 | 预期规模与增长驱动 |
| --- | --- | --- | --- | --- |
| 检查远端目标与资源 | scripts/uat/check | 受管运维脚本命令 | 单一UAT target snapshot | 每次调用1个UAT环境和1个远端host identity；资源行数按UAT manifest登记项固定增长，不枚举其他环境 |
| 首次部署并完整初始化 | scripts/uat/init后接scripts/uat/seed | 受管运维脚本命令 | 一个UAT environment manifest与完整seed report | 每个环境只做一次首次部署和一次完整导入；服务集合按§2.1固定组件数，不随业务数据增长 |
| 启动已初始化环境 | scripts/uat/start | 受管运维脚本命令 | 所有UAT服务readiness | 每次只操作一个manifest环境；readiness项与§2.1服务集合一一对应 |
| 停止UAT服务 | scripts/uat/stop | 受管运维脚本命令 | UAT-owned process/container stop readback；数据volume保留 | 每次只操作当前UAT manifest已登记资源；不随业务数据增长 |
| 查看UAT状态 | scripts/uat/status | 受管运维脚本命令 | CBS、TDS、HAProxy、PG、middleware、两前端readiness | 固定服务行数；一项资源一条身份/readiness结果，不扫描其他环境 |
| 完整seed | `scripts/uat/seed`调用唯一r5-full seed target；其owner-command阶段通过内部`bootstrap`子命令运行远端非Web one-shot IAM bootstrap，然后由owner HTTP执行既有fixture | owner HTTP face | 现有r5-full report；不是`init`或普通`start`触发的导入 | 固定4个主stage+2个post-step；fixture规模由唯一r5-full contract决定，本专项不加业务数量限制 |
| 发布后台静态产物 | CP-05受管发布阶段 | 受管远端文件发布命令 | 两个dist roots、两个独立listener、两个same-origin `/api` upstream | 固定2个后台app；只发布本次构建产物 |
| 配置terminal UAT地址 | 两terminal app的package.json `serverSpaces.uat` | 两app assembly与server-config selector | business、livekit、2个TDS HAProxy入口，共4个address | 固定4条UAT service address；仅随服务配置变化，不运行时发现或扩张 |

不新增 CBS/TDS 对外业务 operation。终端 service addresses 为业务 CBS group workspace 路由、两个 TDS HAProxy WebSocket entry、LiveKit WebSocket entry。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败事实 |
| --- | --- | --- | --- | --- |
| 首次平台管理员创建 | `scripts/uat/seed`触发的owner-command阶段调用内部`bootstrap`子命令，在远端运行一次性非Web CBS JVM并调用platform-admin IAM owner bootstrap command | N/A | 由IAM owner在一个事务内建管理员、credential与audit | JVM使用 `WebApplicationType.NONE` 且无HTTP listener；非空表拒绝；成功后进程退出并读回canonical管理员与audit；常规seed配置CBS已由`init`启动，普通CBS不接收bootstrap输入 |
| r5-full seed | 各既有 owner 的 generated HTTP command | 由 r5-full orchestrator 顺序调用 | 每个 owner command 保留原事务/receipt，不跨 owner 拼事务 | 父报告记录首个失败 stage；不得报告 UAT_READY |

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| UAT resource identity | UAT environment contract 与 run manifest | scripts/uat 解析、校验并发至远端 runner | 只操作 manifest 绑定的 UAT DB、containers、processes、directories 与 ports；DEV/UAT 同时运行且预算、identity 独立 | 实际部署的各自资源identity不重叠；静态确认UAT生命周期不操作DEV，不为证明而停环境 |
| 数据隔离 | UAT PostgreSQL 独立 container/volume/database/role | CBS 与 TDS 的 UAT credential env | CBS owner schema、TDS 授权只读/SQL command | UAT 业务写读回存在而 DEV 同一业务 identity 未变化 |
| UAT seed | 唯一 r5-full fixture contract + UAT target metadata | UAT bootstrap 后，owner-specific seed requests 进入 CBS | owner table、asset store、TDS/Doris terminal update fixtures | seed report 每阶段 PASS 且对应 owner readback 完整 |
| 首次初始化与普通启动 | scripts/uat/init、scripts/uat/seed 与 scripts/uat/start 是不同命令 | `init`在首次远端副作用前持久写`INITIALIZING/seedAllowed=false`及计划资源身份；读回后补真实container/volume身份；所有服务readiness和临时staging清理通过后才写`READY/seedAllowed=true`。init失败则以`INIT_FAILED/seedAllowed=false`记录首败、阶段和cleanup并保留已登记身份；实际资源ID未读回时`stop`不得报告清理PASS；seed仅消费READY环境；start只允许受管STOPPED环境 | UAT readiness gate | 静态调用链确认init不运行seed、失败不可seed、start不调用bootstrap或seed；不为了证明而重复start |
| 两后台远端入口 | 两个 Vite build 的 dist | Nginx 双 listener 将 /api 转发给 UAT CBS | remote platform-admin / operations-admin browser | 产物与gateway配置指向UAT origin/CBS；不运行浏览器验收 |
| 终端 UAT 地址 | 两 application Android package.json 的 serverSpaces | UAT 地址项由 server-config defaults 合并 | selectServerConfiguration 与 TDC transport | 静态解析UAT地址声明与consumer链，DEV地址保留；不运行设备smoke |
| 失败与 cleanup | run manifest 的 phases、firstFailure、cleanup | local runner 和 remote child process 写同一 run id | operator report | seed failure 不标 READY；stage/temp 上传目录 cleanup 有 readback；持久服务标 intentional-retain |

## 8 · 业务规则与交付要求

| 编号 | 规则 |
| --- | --- |
| UAT-R01 | UAT 位于受管远端主机，与 DEV 使用不同环境 identity、业务数据库、数据库凭证、持久目录及外部端口。 |
| UAT-R02 | UAT 的 CBS/TDS/middleware 与后台静态资源均由远端主机提供；不依赖本机 Vite、Java、TDS、数据库 tunnel 或临时公网代理。 |
| UAT-R03 | UAT 仍是一个 CBS business deployable、一个 PostgreSQL 业务数据库、多 owner schema、单 Flyway history；三个 TDS 仅是辅助 WS runtime，不成为业务 deployable。 |
| UAT-R04 | 两个后台 app 分别由远端静态入口提供；各自 /api same-origin proxy 到 UAT CBS，不共享 DEV API target。 |
| UAT-R05 | sample-terminal 与 sample-wallpaper-terminal 各自 package.json 同时保留 development 与 uat 地址空间；UAT 地址闭集为 business、livekit、terminal-data-server；TDS 必须含两个独立 UAT HAProxy address。 |
| UAT-R06 | 首次准备按`init`→服务readiness→独立`seed`完成：seed在owner-command阶段创建首管理员后运行完整r5-full；全部阶段与owner readback成功前不得报告UAT_READY。 |
| UAT-R07 | UAT start/restart 不执行 seed；UAT 已初始化但 seed report 缺失或失败时拒绝标 READY。 |
| UAT-R08 | UAT seed 使用一份既有完整 r5-full fixture 与 owner executor，不复制业务 fixture；UAT 环境 identity 与 DEV seed identity 严格区分。 |
| UAT-R09 | 正式需求原始范围是设计与计划；Dexter 2026-10-14后续明确授权本次实施，因此该历史句不限制当前实施。实现、部署及seed仍必须以当前字节和实际受管运行记录证明，不能预写为PASS。 |
| UAT-R10 | UAT 与 DEV 可在同一远端主机同时运行；两者使用互相独立的服务身份、端口和资源预算。任一环境启动、停止或达到自身预算，不得把另一方用量记入自身环境预算、停止或清理另一环境资源。主机总容量检查用于避免超卖，不得作为预算共享或强制停掉另一环境的理由。 |
| UAT-R11 | 只完成环境部署与完整seed数据导入，供用户查看；不做测试。真实导入仍保留现有owner readback、阶段报告、日志和临时资源清理，不以此扩展为UAT验收套件。 |

## 9 · owner API 与消费者清单

| owner capability | 消费者 |
| --- | --- |
| CBS 当前 generated owner seed API | UAT target-aware r5-full seed executor |
| platform-admin IAM 初始空库管理员 bootstrap | `scripts/uat/seed`的owner-command阶段调用内部`bootstrap`子命令，在远端启动非Web CBS one-shot IAM owner command；不暴露 HTTP endpoint |
| TDS 既有 connection/terminal-control repositories 与受限 DB identity | UAT TDS 三节点 |
| Doris connection-history writer | UAT TDS 三节点 |
| server-config selector 与 selectedSpace command | 两终端 app 管理配置与UAT地址静态对读 |
| terminal package.json serverSpaces | 两终端 Android application assembly |
| platform-admin Vite build | Nginx platform-admin listener |
| operations-admin Vite build | Nginx operations-admin listener |

不得增加第二份业务 seed executor、业务 SQL seed、终端业务 API 地址表或 UAT 专属运行时 owner。

## 9a · 实施前全链同步变更清单

| 变更事实 | 契约/生成源/生成物 | 后端 owner/edge/migration | 前端/terminal/state | 测试/验证 | fixture/seed | 处置 |
| --- | --- | --- | --- | --- | --- | --- |
| UAT 环境身份、独立预算与 DEV 共存 | 新 UAT config/manifest | 不改业务 edge/migration | 不改业务 UI | 实际部署时分别核identity/预算，静态确认cleanup不消费DEV资源；不做启停隔离测试 | seed target context 使用 UAT identity | 同步修改 |
| 独立 UAT PostgreSQL | 无新 SQL contract | CBS 仍运行完整现有 migration；不加新业务 schema | N/A | 空 DB 启动时迁移版本、DB service/volume identity readback | 不把 UAT 数据写入 DEV profile | 同步修改 |
| 首位平台管理员 | 无 HTTP route | platform-admin IAM owner 的 UAT-only 非Web JVM command 与审计 | N/A | 实际首次创建的canonical built-in root与audit/readback；静态确认普通启动无bootstrap、CLI无HTTP入口，不注入非空反例 | 替换 UAT bootstrap target，不改其他业务 fixture | 同步修改 |
| 完整 r5-full seed 的 UAT target | 当前 fixture contract/target validator；不得手改 generated | 复用 owner seed API | N/A | 完整seed dry-run与实际导入每阶段report/readback；不另建测试 | 当前 profile、fixture contract、plan/executor、资产与 update artifact inputs | 同步修改 |
| 两个 remote admin 前端 | package scripts、Vite build env 与 Vite output | Nginx /api proxy 到 CBS | 无 UI 源变更 | platform-admin build 注入 `VITE_OPERATIONS_ADMIN_ORIGIN`；检查工作空间登录和邀请链接均指向 UAT operations-admin origin | N/A | 同步修改 |
| terminal UAT service addresses | 两终端 application package.json | CBS/TDS ingress config | selectServerConfiguration、server-config effective defaults | package地址/consumer静态对读；不执行终端连接smoke | UAT gw-aurora 必须由 seed readback 启用 | 同步修改 |
| UAT init/start 分离 | scripts/uat command contract | N/A | N/A | 静态确认start/restart不调用bootstrap或seed；不安排重复启停测试 | 首次init后单独seed一次，普通start/restart不seed | 同步修改 |
| UAT 资源/日志清理 | UAT manifest 与 runner | N/A | N/A | temp staging readback absent，UAT 持久容器/volume 标 retained | seed 子阶段 cleanup 单列 | 同步修改 |

## 9b · 变更定位

实现计划以唯一锚点修改：scripts/dev 的受管远端生命周期与 manifest 模式；当前 r5-full fixture contract 和 parent executor；PlatformAuthenticationService 的 bootstrap API；两个 terminal package.json 的 serverSpaces；两后台各自 package.json build 脚本与 vite.config.ts；scripts/README.md 的环境运行矩阵。不得按行号定位或编辑生成 API。

## 10 · 数据迁移

| 迁移 | 内容 | 回填 | 回滚 |
| --- | --- | --- | --- |
| 无业务 schema migration | UAT 在空的专属 PostgreSQL 中运行当前 CBS Flyway history | N/A；不从 DEV 复制业务表或数据库快照 | 删除整套 UAT 属破坏性动作，不在本设计或实施计划中自动执行；需独立明确授权 |

## 10b · seed 数据

### 10b.1 当前 seed 源全集

| 文件 | 当前职责/处置 |
| --- | --- |
| doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json | 当前完整业务 fixture 正本；CP-04 增加明确 dev/uat runtime target 约束，不复制业务对象 |
| scripts/dev/profiles/r5-full.json | 当前 r5-full 组件闭集；迁至环境无关 profile 或由唯一共享 profile 导入 |
| scripts/dev/r5-seed-plan.mjs | 完整 seed 前置计划；改为接受经过校验的 DEV/UAT target identity |
| scripts/dev/r5-complete-seed-executor.mjs | 当前唯一父 seed executor；抽出可由 DEV/UAT wrapper 共用的执行核心，不复制 owner stage |
| scripts/dev/owner-command-seed-executor.mjs | 复用原 owner command seed 顺序，目标 DB 与 runtime identity 参数化 |
| scripts/dev/external-collaboration-business-channel-seed-plan.mjs、scripts/dev/external-collaboration-business-channel-seed-executor.mjs | 复用同一计划与 owner command executor |
| scripts/dev/catalog-inventory-seed-plan.mjs、scripts/dev/catalog-inventory-seed-executor.mjs | 复用同一计划与 owner command executor |
| scripts/dev/sales-menu-seed-plan.mjs、scripts/dev/sales-menu-seed-executor.mjs | 复用同一计划与 owner command executor |
| scripts/dev/store-terminal-seed-executor.mjs | 复用既有 owner post-step |
| scripts/dev/terminal-update-seed-plan.mjs、scripts/dev/terminal-update-seed-executor.mjs | 复用既有规则与终端 post-step；UAT artifact source run 必须来自当前有效构建身份 |
| scripts/dev/r5-seed-bootstrap.mjs | 只属于现 DEV direct-SQL bootstrap；UAT 不调用、不借 DEV 凭证 |
| fixtures/assets/runxin-commercial-logo.png | r5-full group workspace asset 输入；复制到 UAT run-owned staging 后使用，结束读回清除 staging |
| contracts/policy/catalog-inventory-fixture-catalog.json | 当前 catalog inventory fixture 正本；不复制 |
| contracts/policy/frontend-asset-carryover-manifest.json | 当前受管静态资产输入正本；不读取仓外资产 |
| scripts/dev/terminal-fixture-state.mjs | 完整fixture必需的inv-expired唯一受管mutation；同一adapter按各自受管manifest校验DEV/UAT身份，UAT只允许本次批准的精确target与有限mutation，见§10b.6 |

上述列表是当前搜索得到的 seed/fixture 入口候选；实施 CP-01 必须按 scripts/dev 下 seed/fixture 文件重新搜索，补入任何实际被完整 r5-full parent 消费的漏项后才可改写。不可将搜索快照说成完整业务分母。

### 10b.2 新环境与既有数据调整分开

- 新 UAT 环境：使用当前 r5-full 业务 fixture 数据，经现有 owner command 在空的 UAT 数据库创建；不导入 DEV 数据库快照。
- 既有 DEV 业务数据调整：N/A；本批不得改写 DEV fixture 语义、密码或现存数据。

### 10b.3 覆盖判据

UAT seed 仅当四个主阶段 owner-command、external-collaboration-business-channel、catalog-inventory、sales-menu 与两个 owner post-step store-terminal、terminal-update 的 report、business、cleanup 和 owner readback 全部 PASS 才算完整；父报告保存各子报告地址和首败。计数及实际 fixture key 必须和当前 r5-full fixture contract 相符。

### 10b.4 同步项

当前 seed 目标不是只被 `managedDevRunId` 字段限制。`r5-complete-seed-executor.mjs` 与 `owner-command-seed-executor.mjs` 要求 `kind=r5-dev-run-manifest`、`freshDatabase=true`；后者还要求 `otpDebugExposure=true`、`localHttpBaseUrl=http://127.0.0.1:<port>`、`catering_v2s_dev_*` database、DEV namespace/profile/host 字段，并只校验 DEV tunnel process；`r5-dev-environment.mjs` 也只接受 `v2s-dev-*` namespace 和 `catering_v2s_dev_*`。不能把 UAT run id 填入 DEV 字段或伪造 DEV manifest。

CP-04 建立一个环境无关的 seed target 输入：`environmentKind=dev|uat`、`managedEnvironmentRunId`、namespace、database identity、HTTP base URL、remote host binding、credential reference、fresh-database 证明、OTP debug exposure 与 target-specific managed process identities。DEV/UAT wrapper 各自从自己的 manifest 生成该输入。UAT seed 由本机 `scripts/uat/seed` 受管控制命令运行，owner HTTP 请求直连manifest指定的远端UAT CBS ingress；不是localhost tunnel、不是DEV ingress，也不建立数据库连接/tunnel。业务mutation与数据库读写仍只在远端CBS/PostgreSQL执行。UAT使用`uat` namespace/database前缀与UAT credential file；`otpDebugExposure`只在非生产UAT runtime开启，供本次seed登录阶段读取测试OTP。DEV wrapper保留既有loopback tunnel、数据库和OTP行为，不受UAT地址或预算影响。父/子manifest、report、context与所有校验器携带相同环境类型和`managedEnvironmentRunId`，UAT绝不伪造`r5-dev-run-manifest`。target identity不改变owner receipt、业务operation或数据。

完整 seed target 的同根分母为：环境入口和父流程 `scripts/dev/r5-complete-seed-executor.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/r5-dev-environment.mjs`、`scripts/dev/seed-http-client.mjs`；四个主阶段 `scripts/dev/owner-command-seed-executor.mjs`、`external-collaboration-business-channel-seed-plan.mjs` / `-executor.mjs`、`catalog-inventory-seed-plan.mjs` / `-executor.mjs`、`sales-menu-seed-plan.mjs` / `-executor.mjs`；两个后置阶段 `store-terminal-seed-executor.mjs`、`terminal-update-seed-plan.mjs` / `-executor.mjs`；终端 fixture mutation `terminal-fixture-state.mjs`；以及seed report/context declarations、stage parent/child report validators、`scripts/dev/r5-remote-java.mjs`、`scripts/dev/managed-diagnostic-protocol.mjs`和scripts README。既有测试文件仅作源码导航，本批不新增或执行测试。CP-01 用 `rg` 更新此闭集并补入实际父子调用者。同步 `managedDevRunId`、DEV manifest kind、fresh database、OTP、localhost-only HTTP base、DB/name namespace、`V2S_DEV_*` 子进程环境、tunnel process 检查及实际消费者；由唯一 target adapter 按 environmentKind 映射，generated API 不手改，业务 seed executor 不复制。此路径的 HTTP base 是 UAT CBS 公开 ingress，由 UAT manifest 校验 host 与数据库/namespace 身份。

### 10b.5 边界

不把 acceptance fixture 当 seed；不复制 DEV 密码或 root 固定密码；不让 start/restart 执行 seed；不把资产、DB volume 或种子产物写入 DEV namespace；不自动清空已存在的 UAT 数据库。

### 10b.6 执行前提、父流程与角色

首次 scripts/uat/init 前，完整r5-full dry-run必须在全部CP与全批6b之后、实际init/导入之前通过；它不回填CP退出条件。TER更新fixture工件如已有成功受管update.artifacts source run且导出完整则复用；缺少时仅经既有受管产物入口准备：R5_TERMINAL_UPDATE_SEED_ARTIFACT_EXPORT=1 node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --case update.artifacts。记录成功run id，dry-run使用R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<成功runId>；不运行owner-flow、浏览器或设备体验场景。dry-run通过后，init仅接受空UAT DB，完成迁移并启动seed配置下的CBS/TDS与必要服务，记录readiness；init不创建管理员也不导入fixture。随后单独运行`scripts/uat/seed`，其owner-command阶段调用内部`bootstrap`子命令，在远端以CBS同一可执行代码/依赖运行一次性WebApplicationType.NONE JVM，参照ManagedInvitationBootstrap.java的SpringApplicationBuilder形态调用platform-admin IAM owner bootstrap command；唯一`managedUatPlatformBootstrap`入口从fixture contract读取且校验`pa-bootstrap`完整身份，再将其稳定ID传入JVM，不允许由环境调用者替换。该进程无HTTP listener，读取UAT专属secret，在同一owner事务创建canonical pa-bootstrap、credential与bootstrap audit并readback后退出。seed随后通过UAT manifest指定的远端CBS ingress，以新建管理员会话运行四个主阶段及两个post-step；成功后将CBS从seed配置切换为普通配置并验证readiness。runner不直接写IAM SQL或新增HTTP route；UAT secrets仅由专属credentials file注入。UAT target校验HTTP host、database、namespace与UAT manifest identity一致，不映射为DEV字段。

seed fixture contract 将 `pa-bootstrap` 的逻辑身份和 secret binding 保持唯一，把当前 `DEV_BOOTSTRAP_SQL` 实现渠道改为环境 target 的受控 bootstrap 实现：DEV 继续走当前受限的 DEV bootstrap 例外，UAT 走 IAM owner command。密码 secret purpose 改为环境无关的 `PLATFORM_ROOT_LOGIN`，实际 secret 引用按 DEV/UAT target 分开，UAT 不复用固定 `root` 密码。实施需同步 contract、seed plan、UAT target、父/子报告和 tests；不得复制第二份 r5-full fixture。

**获批的唯一UAT terminal fixture例外：** `owner-command-seed-executor.mjs`必需调用唯一terminal fixture；普通owner HTTP不提供时间终态写入。Dexter本次明确批准把现有唯一inv-expired adapter扩至UAT。adapter先要求原owner HTTP已创建精确PENDING invitation；再由当前UAT manifest绑定并校验host identity、PostgreSQL container identity、database、namespace、r5-full profile与run identity。UAT业务HTTP endpoint按manifest的UAT ingress校验，远端主机则按SSH host alias、fingerprint及boot身份校验；二者是同一环境的不同寻址形式，不得要求字符串相等。mutation请求绑定该邀请唯一assignment intent，SQL再次确认邀请恰有一条与role/service-node完全相同的intent。一个受限事务只执行PENDING→EXPIRED、contract允许的历史时间/version更新、同事务SYSTEM audit和同workspace receipt；之后必须经原owner HTTP读回EXPIRED及相同role/service-node intent。DEV继续校验既有DEV身份。普通seed仍只走owner API；不复制executor，不增加其他fixture、通用SQL入口、业务HTTP或第二账本。

首次初始化流程由`init`和`seed`两个受管入口依序完成：`init`在首次远端资源创建前先写持久manifest，记录`runId`、host/root与计划资源身份，状态为`INITIALIZING/seedAllowed=false`；容器和volume读回后逐项补入实际身份。迁移、所有服务readiness及临时staging清理完成后才原子更新为`READY/PASS_SERVICES_READY/seedAllowed=true`。写入初始化manifest后的任何init失败都写`INIT_FAILED/FAIL_INIT`、首败阶段/原因和cleanup结果，并保留已登记的资源身份；status如实显示失败，seed拒绝该状态。若失败发生在容器身份读回前，stop拒绝以不完整身份报告清理成功；不自动reset或按未知名称清理资源。该失败状态不触发自动重试。readiness通过后，单独调用`seed`，其owner-command阶段创建首管理员，再导入完整r5-full。导入成功后seed入口停止seed模式CBS、启动普通配置CBS并核实readiness。若`seed`任一阶段失败，seed运行manifest保留首败与partial report，环境manifest标记seed失败且不置UAT_READY；不自动reset或重跑seed。之后正常start/restart不bootstrap、不seed。

## 11 · 实际部署与seed导入的完成条件

删除原UAT-01～UAT-11的agent测试矩阵及smoke。以下为一次实际部署/导入的完成记录，不是功能验收。环境就绪且体验数据导入完成后即可交给用户体验测试，不要求agent追加自动浏览器、终端、故障注入或业务测试；用户体验测试不作为本批交付前置。

| 结果 | 实际完成条件 | 当前状态 |
| --- | --- | --- |
| 环境可供用户使用 | UAT服务identity/readiness正确，两个后台dist与同源API发布配置、跨后台origin及公共资产URL属于UAT | NOT_RUN |
| 完整数据已导入 | 唯一r5-full四主阶段/两后置阶段完成；沿用现有owner readback及父子报告确认fixture业务数据实际存在 | NOT_RUN；获批UAT inv-expired adapter尚待实施与首次运行 |
| 生命周期边界正确 | 首次准备按`init`后`seed`的顺序执行；bootstrap由seed的owner-command阶段调用，`start/restart`不执行bootstrap或seed；不通过重复启停证明 | 实现NOT_RUN |
| 资源已正确收口 | 实际临时staging/seed子进程cleanup，长期UAT服务/数据标intentional-retain；不碰DEV或未知资源 | NOT_RUN |
| 用户交接 | 给出两个后台地址、受管凭证交付方式、导入报告与未完成项；凭证不落普通报告 | NOT_RUN |

### 11a · 需求映射

| 要求 | 对应实施位置与完成记录 |
| --- | --- |
| UAT-R01/R03/R10：隔离、服务形态与预算 | CP-01～03配置/源码对读；实际部署的manifest/readiness/ownership |
| UAT-R02/R04：远端后台与同源API | CP-05发布逻辑、build输入与gateway配置；实际dist发布记录，无浏览器测试 |
| UAT-R05：两terminal UAT地址 | 两个application与两个integration package.json、resolveManagedServerSpaces及实际配置consumer静态对读，无设备测试 |
| UAT-R06/R08：完整唯一seed | CP-04 target/validators与唯一fixture；实际init父子seed report/现有owner readback |
| UAT-R07：普通启动不seed | CP-06静态调用链，无反复启停测试 |
| UAT-R09：当前授权与证据 | 当前授权范围见文首和实施计划；执行结果只按当前字节与受管run记录更新 |
| UAT-R11：不做测试 | 无UAT测试runner、smoke、自动化测试、负例矩阵或额外拓扑验证 |

### 11b · 实际操作的必要日志

| 链路 | 日志owner/落点与必要关联 |
| --- | --- |
| scripts/uat控制入口→远端runner→资源/服务readiness | 同runId的本机events.jsonl与远端remote-events.jsonl；environmentKind、phase、host/boot、owned resource identity、结果/首败、cleanup/retain |
| seed owner-command→内部bootstrap→非Web CBS→IAM transaction/readback→owner stages | seed runner与CBS owner原日志；bootstrapAttemptId、migration、canonical管理员与audit/readback、CLI identity/exit；无secret值 |
| UAT seed target→UAT CBS→各owner command/readback→六阶段父子报告 | `.runtime/uat/runs/<runId>/seed/`与CBS owner日志；environmentKind、runId、stageId、operation/requestId、结果、receipt/readback及cleanup |
| 两个后台build→dist→远端staging→gateway发布 | app、产物摘要、UAT build origin/upstream/publicAsset配置身份、发布结果与staging cleanup；不启动自动浏览器 |

沿用已有日志、seed报告和owner读回，不新造诊断平台或测试能力。实际导入前做适用的只读链路审查；已有审查覆盖当前字节时沿用，只复核变化闭包，不增加动态测试或重开历史DESIGN cycle。本次授权覆盖实际seed，但仍须按当前准入执行；当前部署与导入状态保持NOT_RUN。

## 12 · 未决输入与实现前置

| 项目 | 状态 | 处置 |
| --- | --- | --- |
| UAT public IP/host 与外部端口 | 已配置`47.106.121.27`与17个独立端口；受管快照run `uat-host-preflight-20261014T050235795Z-4d3f1f15-4662-46ad-9ddd-a4d911bac60f`确认host alias/boot身份一致、端口当时均空闲 | CP-01将实际配置落在`scripts/uat/uat-config.mjs`；实际公网连通与服务readiness留到部署后确认，不把端口空闲写成外部可达 |
| DEV/UAT 并行所需远端磁盘、内存、CPU 与 Docker 资源 | 最新受管快照 `uat-host-preflight-20261014T061514584Z-28d76933-3d48-4fbd-a5a3-a88deceb83b2`：同一 host/boot `catering-remote-dev` / `b37e1fe3-4e4b-4459-9f5c-7620f3f26063`，x86_64、8 CPU、可用内存16,698 MiB、Docker可用磁盘5,361 MiB；UAT服务上限12,288 MiB，另保留主机内存3,072 MiB；UAT磁盘3,072 MiB，另保留主机磁盘1,024 MiB。快照显示UAT root不存在、17个UAT端口均空闲 | DEV与UAT分别记账；本次预检满足门槛，预留余量为1,338 MiB内存和1,265 MiB磁盘。实际init前仍刷新主机读数，不停DEV、不清理未知对象 |
| Nginx 官方镜像的实际 digest | 官方`nginx:1.30.5` linux/amd64 manifest digest已固定于`scripts/uat/uat-config.mjs`；远端尚未拉取/解析image id | 首次受管启动时按固定官方digest读取image id并写入manifest；未发生前保持NOT_RUN |
| UAT 初始 root secret 值 | OPEN；路径已确定为 UAT 专属 `.runtime/uat/credentials.env`，不得复用 DEV 固定 root | 由本次受权的主agent生成UAT专属凭证并写入本机受管凭证文件；CP-01验证文件权限与必需key，不将secret写入manifest、日志或仓库 |
| UAT 的 protocol 与端口分配 | 配置值已在`scripts/uat/uat-config.mjs`固定；本次受管快照确认端口空闲，尚未部署或验证公网连通 | CBS、MinIO、LiveKit、HAProxy、TDS及两个后台按同一配置落值；服务readiness和公网可达在部署后确认。CBS signer与两个终端`serverSpaces.uat.livekit`须指向同一UAT LiveKit |
| Spring Boot 实际解析版本及对应官方依据 | 已解析`org.springframework.boot:spring-boot:4.1.0`；本机缓存的4.1.0 sources JAR中`WebApplicationType.NONE`注释为不启动embedded web server，`SpringApplicationBuilder.web`直接设置application type；JAR SHA-256=`65ec9df3163a0c8cbcfa26a093ee043967969f06f4739ce7b970fb8370c36ea7`。仓内复用点为`ManagedInvitationBootstrap.java:50–54` | API语义与配置调用由精确4.1.0 sources artifact核实；官方Javadoc入口为https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/WebApplicationType.html及https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/builder/SpringApplicationBuilder.html（当前文档站解析到同minor最新4.1.1）。one-shot UAT bootstrap的实际启动/build仅在CP-03 |
| UAT 完整 seed profile | 设计决定：复用当前r5-full业务fixture/所有owner阶段；target identity由CP-04实现，不复制fixture；inv-expired仅按本次获批的manifest-bound UAT adapter执行，见§10b.6 |

这些是实施前环境输入或技术解析项；未关闭前不创建远端资源，也不构成当前运行证据。

## 13 · 停机条件

- 实际受管远端 host identity 不匹配、资源预算不足或端口被未知进程占用：先保留只读证据，不碰未知对象。
- 除本次已明确批准的§10b.6单一`inv-expired` terminal fixture外，
- 前端 API 无法维持同源 /api route，且需要改变产品认证/接口语义：列具体事实再交 Dexter。
- UAT bootstrap owner无可复用方式时只允许在 platform-admin IAM 内补单一首管理员owner操作；禁止脚本直接插写其他owner schema。

## 13b · 实施节奏与三维对账

每个CP完成实现、静态源码/配置/产物检查及必要修复后，由fresh独立子agent对完整CP按需求、本详设和六维路由记忆做独立三维对账，结论为MATCHED/OPEN。全部CP完成后、首次实际seed前另做全批6b与适用准入；各CP退出不要求真实seed，因此不存在循环。已匹配且字节未变的内容可沿用；变化只复核受影响闭包。

## 13c · 逐代码与详设对账

实施计划必须显式安排交付前逐代码与详设对账。范围包括本详设所列每个UAT script/config、CBS IAM bootstrap、seed source/target、两个后台部署配置、两个terminal package address以及实际consumer/manifest/README；不要求运行测试；fresh只读reviewer逐代码检查，检查新增代码零调用者、详设点名产物遗漏。仅MATCHED可交付；任何OPEN先修复并复查，不抽样，不以CP、6b或测试代替。

## 14 · 交付前自查

- 本次授权覆盖必要实现；当前完成状态以实施进展及受管运行证据更新。
- 当前DEV路径与新UAT路径分离；UAT server/database 不通过DEV入口操作；两环境可在同一远端host并行运行并分别核算环境预算。
- 两后台均在远端静态托管；没有引入第二个业务deployable。
- UAT seed只复用一份r5-full fixture与owner executor；
- DEV 专属 `managedDevRunId`、DEV manifest、loopback tunnel、数据库名前缀与 `V2S_DEV_*` target 字段不会被 UAT 冒用；父/子 seed evidence 使用统一环境运行身份并验证 target kind 与 UAT ingress。
- 初始化seed与普通start/restart分离。
- §3维度行完整并对所有不适用项写明理由；§11a覆盖UAT-R01～UAT-R11，旧UAT测试矩阵已删除。
- 未实际运行的部署与seed导入保持NOT_RUN；功能测试、smoke和UAT验收为NOT_PLANNED，不要求执行或补证。
