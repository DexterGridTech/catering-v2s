# 批次三 Doris 可行性证据

## 当前字节的一次性受管探针（2026-10-02）

Dexter 授权的一次性 probe 已经通过现有 `scripts/test/r5-remote-testcontainers.mjs` 完成。它仅启动远端临时容器、等待健康、查询、采样并清理；没有接入 DEV、挂持久数据卷或改变部署拓扑。

| 项 | 当前 probe 结果 | 证据 |
|---|---|---|
| 受管运行 | PASS | run `r5-tc-1790869525054-48267`；manifest 时间 2026-10-01T15:45:25.054Z～15:47:01.361Z；远端 host alias `catering-remote-dev`；task `:apps:backend:catering-business-server:test`；Testcontainers `testExecution=PASS`，`business=NOT_APPLICABLE` |
| 精确测试 | PASS，1/1 | JUnit `tests=1 skipped=0 failures=0 errors=0`；selector `com.catering.v2s.app.acceptance.DorisFeasibilityProbeTest`；探针临时源 SHA-256 `f7a4aafeb7895dba4b2a09ae1db93a015f70de38b139b2f6066344bd60de805b`，已移除，不进入产品源码 |
| 镜像/版本 | PASS | `apache/doris:all-in-one-4.1.3`；container image ID `sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609`，与历史 run 的 image ID 相同；本次 XML 记录 Testcontainers 2.0.5、Docker 29.1.3、Ubuntu 22.04.5 LTS |
| 缓存 | 命中 | XML 记 `DefaultPullPolicy()`；日志只记录创建/启动、没有镜像 pull 事件；同一 image ID 与历史 run 一致。没有认证配置也成功，未配置云镜像中转 |
| 健康与 SQL | PASS | `Wait.forHealthcheck()` 成功；测试记录 health-ready 32,215 ms、容器创建到Testcontainers报告started 31.194 s；容器内 MySQL 客户端执行 `SELECT 1` 得到 `1`，耗时 119 ms |
| 资源样本 | 观测成功，但不等于全栈预算 | 远端 `/proc`：8 CPU；总 RAM 32,155,267,072 B（29.95 GiB），启动前 available 23,351,857,152 B（21.75 GiB），启动后 23,251,214,336 B（21.65 GiB）；根卷总 41,882,943,488 B（39.01 GiB）、可用约 6.23 GiB；容器健康后 cgroup memory.current 1,559,093,248 B（1.45 GiB），memory.max=`max`，即本次没有给临时容器设 memory cap |
| 容器关闭与受管清理 | PASS | `close()` 441 ms；run manifest 的 process、remote workspace、Testcontainers containers/volumes 与两项查询均 PASS；运行前 Testcontainers 容器/卷为空；结束后为空 |
| DEV 生命周期 | 未触及 | manifest `devLifecycle.wasRunning=false`，没有 stop/restore；因此该 probe 不声称 DEV 场景结果 |

证据与摘要哈希：

- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790869525054-48267/run-manifest.json`，SHA-256 `4abf41a5974869202965f9482154d48f1b0ca7db99da48b74f00cc94c6120697`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790869525054-48267/gradle.log`，SHA-256 `614102ee51c27499c1a9a842fbd2f44bac4c9207228e2d9990c8c9652a80f0ce`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790869525054-48267/test-results/apps/backend/catering-business-server/build/test-results/test/TEST-com.catering.v2s.app.acceptance.DorisFeasibilityProbeTest.xml`，SHA-256 `a94ada667c0ccb1ece158fd373c2feac2d0276440fddbe7371657215a6788600`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790869525054-48267/backend-runtime-classpaths.txt`：当前 run 实际 Testcontainers core `2.0.5`，Junit/PostgreSQL/JDBC/database-commons adapters `1.21.4`。

**证据范围结论**：当前受管 probe 证明指定远端主机能用其已缓存的 Apache Doris 4.1.3 镜像在约 32 秒达到健康状态、执行 SQL，并在受管生命周期后完成清理；同时捕获一个临时单实例的主机和 RSS 快照。这足以供设计决策使用，但不证明带有全量 DEV 服务负载时的持续容量，不验证 DEV 常驻 runner、持久挂载/重启读回、受限 memory cap、Stream Load 权限/读回、reset或跨节点行为。设计稿将这些列为实施 CP-01/CP-02 的实测项，不把它们写为当前 PASS。

### 本次使用的第三方 API 与官方依据

- 实际解析的 `org.testcontainers:testcontainers:2.0.5`；测试调用 `GenericContainer`、`Wait.forHealthcheck()`、`withStartupTimeout(Duration)`、`isHealthy()`、`execInContainer()`。Testcontainers 2.0.5 官方 `Wait.java` 明确提供 healthcheck 等待，官方 `Container.java` 明确提供启动超时和容器 exec；官方 image pull policy 指出默认先使用 Docker 本地镜像缓存，只有镜像不存在时才拉取。
- Apache 官方 all-in-one 文档将 `apache/doris:all-in-one-4.1.3` 定位为 CI/开发单容器，记录内置 HEALTHCHECK、9030 MySQL、镜像内 mysql 客户端，以及默认 FE/BE memory tuning。当前 probe 只采用 healthcheck 与 SQL 客户端事实；没有将文档宣称替代本仓实测。
- 精确官方来源见本文件「一手资料」及设计 §10 的 URL。实际测得行为仍只适用于本次运行中的装配与主机。

## 2026-10-01 历史运行与证据范围

本节表格仅描述 2026-10-01 历史run，当时的资源样本为NOT_RUN。文件开头另记录2026-10-02最新一次性探针：该run补了单次host/RSS观察，但两次run都只启动远端临时容器，未证明DEV resident。完整服务共存容量、Docker限制下的持续RSS、持久卷重启、Stream Load写入/读回、reset和跨节点业务仍不据此宣称通过。

| 项 | 结果 | 证据 |
|---|---|---|
| 远端受管 Testcontainers 启停 | PASS，历史运行 | run id r5-tc-1790865119120-67780，2026-10-01 14:31:59.120Z 至 14:33:36.602Z；run-manifest.json 的 testExecution.status=PASS，cleanup.status=PASS，容器和卷查询/回收均 PASS |
| 镜像 | PASS，测试/开发镜像 | Apache 官方镜像 apache/doris:all-in-one-4.1.3；运行记录中的 image id 为 sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609 |
| Doris 健康与 MySQL 协议 | PASS，历史 focused proof | 受管任务中启动 FE+BE 单容器，健康后通过 MySQL 协议执行 SELECT 1 |
| 启动时间 | 有观测，约 32.452 秒 | 当次控制台记录；可保存的 manifest 只记录整个 Testcontainers 任务耗时，未保存 Doris 启动子阶段计时，故不能从归档文件独立重算 |
| 远端镜像缓存 | 命中 | 成功运行日志无 pull 事件；Testcontainers 使用同一远端 Docker daemon。每次创建/删除容器不会删除 daemon 的镜像缓存 |
| 镜像冷拉取 | 已发生过，非当前耗时 | 较早冷拉取约 589 秒，导致一次历史运行未在测试启动期限内完成；不得将其覆盖成 PASS。缓存命中后运行不再重复下载 |
| Testcontainers 资源预检和清理 | PASS | manifest 记录 Testcontainers 标记的容器、卷预检为空；远端进程、workspace、容器、卷和清理查询均 PASS |
| DEV 常驻、挂载和 reset | NOT_RUN | 当前授权排除 DEV 拓扑变更、reset/seed；不据测试容器结论外推 |
| Stream Load、Doris 历史表读回 | NOT_RUN | focused proof 只证明启动和 SQL 连接，不证明写入端点、权限或表模型 |
| 资源容量 | NOT_RUN | manifest 没有主机可用内存、磁盘、CPU、Doris RSS 或与 PostgreSQL/MinIO/HAProxy/TDS 同机的预算快照 |

证据文件：

- .runtime/r5/evidence/remote-testcontainers/r5-tc-1790865119120-67780/run-manifest.json
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1790865119120-67780/gradle.log
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1790865119120-67780/backend-runtime-classpaths.txt

该历史运行的 manifest 将 business 标为 NOT_APPLICABLE、measurementEvidence 标为 NOT_RUN。Gradle 任务为业务后端 test task；R-14 focused 证明是该任务内临时 Doris feasibility test。临时测试源已移除，因此此证据绑定历史运行，不能冒充当前字节测试结果。归档日志未保留 Doris 容器的独立生命周期逐事件记录；启动时长来自当时控制台观测。不同于该run，2026-10-02探针的阶段计时和host/RSS快照记录在归档JUnit XML，但其run manifest的`resources`仍为null；最新数据是单实例瞬时观测，不是全栈预算。

## 镜像与拓扑裁定

- DEV 的 Doris 与 PostgreSQL、HAProxy、TDS 同在受信远端主机；不在本机启动中间件，不转发 Doris 端口，不连接外部云数据库或云代理。
- Testcontainers 经现有受管 runner 连接同一远端 Docker daemon，在每次验收创建独立 Doris 容器；测试后删掉本次容器和卷，保留 Docker daemon 的镜像缓存。
- 使用 Apache 发布的正式版本镜像 apache/doris:all-in-one-4.1.3。首次由远端 Docker daemon 从 Apache 官方发布渠道直接拉取；之后依据解析出的 repository digest 和 image id 复用缓存。不得配置阿里云镜像中转、公共镜像代理或额外云服务。此处所说“官方镜像库”是 Apache 官方发布的镜像，镜像实际 registry 由官方镜像引用解析，不改变到远端主机本机运行的要求。
- DEV 容器持久化元数据和数据目录，reset 清表并验证归零；测试容器不保留数据卷。两种运行都不把镜像缓存当作数据卷。
- Apache 将 all-in-one 4.1.3 定位为测试/开发单容器，不是生产拓扑。它包含 FE、BE、Meta Service；本批不声称生产 Doris 部署已完成。

## 未验证项及实施入口

实施 CP-01 必须在启动任何受管 Doris 场景前记录同一远端主机的 CPU、可用/总内存、磁盘余量、Docker memory/swap 限额、现存 PostgreSQL/MinIO/HAProxy/TDS 预算和 Doris 实际 RSS。资源值使用当前主机实测，不在设计文档里假设固定主机规格。若同机预算无法满足需求，按 R-14 停在实现前提交 Dexter：附实测值、无法满足的约束和候选方案。

实施 CP-02 必须以实际 4.1.3 容器验证 FE SQL 管理、BE Stream Load 直连、最小 Doris 用户授权、入库和 SQL 读回。若最低权限需要扩大到全局 LOAD、或 4.1.3 的 BE 直连无法支持必需的权限/读回路径，先停止并请求 Dexter 决定；不得借用 4.1.4 行为或授予过宽权限。

## 一手资料

- Apache Doris 官方 All-in-One image 文档：https://doris.apache.org/community/developer-guide/all-in-one-image/
- Apache Doris 官方 Stream Load 手册：https://doris.apache.org/docs/4.x/data-operate/import/import-way/stream-load-manual/
- Apache Doris 官方 Duplicate Key 文档：https://doris.apache.org/docs/4.x/table-design/data-model/duplicate/
- Testcontainers Java 2.0.5 官方 image pull policy 文档：https://github.com/testcontainers/testcontainers-java/blob/2.0.5/docs/features/advanced_options.md#image-pull-policy
