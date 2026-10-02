# 终端激活与长连接批次三 CP-01 实施记录

## 范围与选择

CP-01 关闭受管主机/R-14基线刷新、官方镜像与PG身份核对、当前解析classpath记录。复用已接受的R-14 resident run；主机boot id、Doris image ID/repo digest、持久挂载和resident runner均未漂移，所以选择运行受管只读`preflight`而不是重复启动、停止或拉取Doris容器。

我选择在既有`r5-doris-resident-feasibility`入口增加只读预检，而不是另写SSH/Docker脚本，因为该入口已绑定run manifest、PID/start token、受信host/boot id、日志、资源预算与失败诊断；新增模式只采样并比对身份，不变更远端资源。

## 实际变更与证据

| 文件 | 变更 | 复核方式 |
|---|---|---|
| `scripts/dev/r5-doris-resident-feasibility.mjs` | 增加`preflight`模式：比较受信主机boot id、Doris缓存镜像ID/digest、resident记录的PG容器ID与当前容器；只读采集CPU、RAM、swap、Docker数据盘/内存、PG身份与`server_version`、Testcontainers容器/卷残留；不启动DEV、不创建/删除容器或卷、不拉镜像、不写数据库 | `node --check scripts/dev/r5-doris-resident-feasibility.mjs`；`node scripts/dev/r5-doris-resident-feasibility.mjs --self-test` → `R5_DORIS_RESIDENT_FEASIBILITY_SELF_TEST=PASS`。红例覆盖unsafe root、无效identity、缺少重启读回、host/image/PG-container drift、Testcontainers残留及resident证据缺少PG身份；self-test验证预检不调用远端变更命令 |
| `scripts/README.md` | 记录只读preflight与原resident probe的边界和入口 | 回读命令、无远端变更声明及reset/DEV生命周期说明 |
| `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md` | 更新实际解析版本、远端PostgreSQL版本、官方LISTEN/NOTIFY语义与未验证边界 | 对照两份classpath报告、预检manifest及PostgreSQL官方16文档 |
| `doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md` | 补实际预检run、classpath刷新结果及输出项 | 对照相同原始报告与manifest |

### 受管只读预检

- run id：`r5-doris-preflight-1790875962405-28711-15a18ff2-7737-455d-82b6-8bf126ed492d`
- 时间：2026-10-01T17:32:42.408Z–17:32:43.845Z
- manifest：`.runtime/r5/evidence/doris-resident-feasibility/r5-doris-preflight-1790875962405-28711-15a18ff2-7737-455d-82b6-8bf126ed492d/run-manifest.json`，SHA-256 `309c5f197df58e020e8992737fe0b78324b4d43c8e7668a8efdd6ae8c8e1380d`
- 日志：`.runtime/r5/evidence/doris-resident-feasibility/r5-doris-preflight-1790875962405-28711-15a18ff2-7737-455d-82b6-8bf126ed492d/preflight.log`，SHA-256 `63731a142a60fb141bb127353f010902abdc17100ba3bea37703775d9d544d79`
- script SHA-256：`e3ff709c37af7d2997dff57d987e516599bca9be4f62c2f15eee8571361836a2`
- host `catering-remote-dev`，boot id `b37e1fe3-4e4b-4459-9f5c-7620f3f26063`，与resident记录相同；8 CPU、总/可用内存30665/23336 MiB、swap 0、Docker数据盘可用6519 MiB、Docker 29.1.3。
- PG容器完整ID以resident事实清单中的稳定12位前缀`39d62539cece`与当前inspect结果匹配；`server_version=16.13`。Doris `apache/doris:all-in-one-4.1.3` image ID及repo digest均为`sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609`，与resident记录一致。
- Testcontainers容器/卷均为EMPTY；本run `business=NOT_APPLICABLE`、`status=PASS`、`cleanup=PASS_NO_REMOTE_MUTATION`。未做业务或Stream Load验证。

### 解析依赖报告

为当前TDS Gradle输入刷新报告的任务：`./gradlew --no-daemon :apps:backend:catering-business-server:verifyBackendAcceptanceRuntimeClasspaths`，`BUILD SUCCESSFUL`；这是classpath报告任务，不是Testcontainers、业务验收或生产构建。

- `apps/backend/catering-business-server/build/reports/backend-acceptance/runtime-classpaths.txt`：mtime `2026-10-02T02:23:28+0900`，SHA-256 `ff37a677c5794b705e843733ebb8d8c6456a2b7d53dc52ded2cb9b53927f93e5`。business test runtime解析core `org.testcontainers:testcontainers:2.0.5`；JUnit、PostgreSQL、JDBC、database-commons adapters为`1.21.4`。
- `apps/backend/terminal-data-server/build/reports/backend-acceptance/tds-runtime-classpaths.txt`：mtime `2026-10-02T02:23:28+0900`，SHA-256 `65e362da730ce1a5da641ad231cd2233336a5d100892b82f7c644d00ef878c71`。TDS runtime解析Reactor Netty HTTP `1.3.7`、Reactor Core `3.8.7`、Netty `4.2.18.Final`、PostgreSQL JDBC `42.7.11`；TDS test runtime另含BlockHound `1.0.17.RELEASE`。

第三方行为依据：PostgreSQL 16官方文档要求先提交`LISTEN`，再在新事务检查当前状态，随后依靠通知接收后续提交的变更；通知只在发送方事务提交后交付。因此CP-03按该初始化顺序实现并验证竞态/恢复，当前版本读取本身不表示业务listener通过。[LISTEN](https://www.postgresql.org/docs/16/sql-listen.html)、[NOTIFY](https://www.postgresql.org/docs/16/sql-notify.html)、[PostgreSQL 16.13 release notes](https://www.postgresql.org/docs/16/release-16-13.html)。

## 首次失败与根因

新增预检的首次本地self-test发现远端脚本renderer将数组行以字面量反斜杠-n拼接，无法形成预期shell行分隔。根因是JS字符串转义层与shell文本层混淆；修正为真实换行符，并由同一个`--self-test`覆盖渲染输出，修复后`node --check`与self-test均PASS。没有远端资源被创建或改变。该回归检查留在预检入口自测中，不另加通用hook或记忆控制面。

## 当前证据边界

- R-14 resident run仍是历史受管run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5`，feasibility与probe cleanup PASS。它限定证明该主机、镜像、挂载及单次资源快照下的resident启动/重启读回；没有测峰值、长期容量、Stream Load或最小权限。
- 本次预检只刷新当前主机/PG/Doris identity和资源基线；不替代CP-02的实际Doris写入，不替代CP-03通知/跨节点业务，也不替代backend-acceptance/DEV验收。
- CP-01 fresh独立三维对账：`MATCHED`，三个维度均无OPEN；reviewer指出本记录此前的待复核状态应以其独立结论替代。当前字节上的最新预检为run `r5-doris-preflight-1790875962405-28711-15a18ff2-7737-455d-82b6-8bf126ed492d`，其脚本SHA与预检证据已列于上表；未运行业务或Stream Load。CP-01满足进入CP-02条件。

当前字节上的最新运行：`r5-doris-preflight-1790875962405-28711-15a18ff2-7737-455d-82b6-8bf126ed492d`，2026-10-01T17:32:42Z，PG容器前缀/主机boot id/Doris image digest核对及受管远端只读预检PASS，`business=NOT_APPLICABLE`，`cleanup=PASS_NO_REMOTE_MUTATION`。

最后一次通过：R-14 resident run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5`，2026-10-01T16:39:38Z–16:40:48Z，限定的resident feasibility与cleanup PASS；未受本次源码修改影响，仍仅覆盖该主机/镜像/挂载范围。
