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
- 初次CP-01 fresh独立三维对账：`MATCHED`，仅关闭原始资源/版本前置；该结论后因DEV start暴露的resident挂载次序误判而重新打开。后续修复后的CP-01复核见本记录末尾。

当前字节上的最新运行：`r5-doris-preflight-1790875962405-28711-15a18ff2-7737-455d-82b6-8bf126ed492d`，2026-10-01T17:32:42Z，PG容器前缀/主机boot id/Doris image digest核对及受管远端只读预检PASS，`business=NOT_APPLICABLE`，`cleanup=PASS_NO_REMOTE_MUTATION`。

最后一次通过：R-14 resident run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5`，2026-10-01T16:39:38Z–16:40:48Z，限定的resident feasibility与cleanup PASS；未受本次源码修改影响，仍仅覆盖该主机/镜像/挂载范围。

## 后续重新打开：DEV 首次启动诊断

首个 `scripts/dev/start` run `r5-dev-1790906437831-68097-9b0ebb3e-1d48-4f54-928f-90c3020cc80f` 在 `DORIS_RESIDENT` 失败。业务 DEV 未启动；远端临时根/Java/TDS/HAProxy cleanup PASS；resident 状态当时 `NOT_RUN`。失败保留于`.runtime/batch3-dynamic/dev-start-e1.log`及terminal manifest。根因复现后分类为`CONFIRMED`：Docker `.Mounts` 次序是BE后FE，源码却按FE后BE比较拼接字符串，误拒绝了一项本来符合身份的resident容器；失败处理没有等同run attempt的容器完成卸载便移除卷，因此把清理失败附加到了首因上。

由新增受管只读预检 `r5-doris-preflight-1790906704415-73485-f07d9e1e-0319-4372-a968-f53bf6cc4e1e` 捕获的有限字段证明，现存容器ID `d60d3ab2644c7ea5b6faa4fb0ba99187a734bdf3e7ea3a3d6ed5508d329cef0b`、官方固定image/digest、owner `r5-dev-resident`、本机host fingerprint、UUID attempt `bfaca21d-072a-4267-b032-09f364559e96`、healthy/running状态及BE/FE两挂载均相互一致；两个named volume的owner/attempt也相同。该预检`PASS_NO_REMOTE_MUTATION`，没有读取容器环境或写入远端。manifest SHA-256 `3b94c0b8f7277da343f0ac1129eef3b957634ec4240a91434554f5721c83d7a4`；日志SHA-256 `3d4236acdc7fd83ed86d998bc029a013cb85e2b49cb9bdef9dc2db0a5015073e`。

最小修正：resident校验改为比较排序后的挂载集合；本地manifest缺失时，仅依据容器和两个卷的完整固定身份标签、镜像、loopback端口、挂载集合、健康状态/attempt UUID重建manifest；不匹配仍fail closed。创建失败清理先按本attempt精确身份删除容器，并有限轮询确认容器已退出/卸载后才删除卷；容器仍在时保留卷并报告cleanup FAIL。reset与DEV stop使用同一顺序无关挂载事实和含attempt标签的卷摘要。

本次focused proof：`node --check`通过，`node scripts/dev/r5-doris-resident-feasibility.mjs --self-test`通过，挂载顺序shell proof通过，CP-04 focused套件`114/114 PASS`。这些是本地证明；实际managed DEV start尚未复验。读/写边界没有扩大。

mount-order/adoption修复后的fresh CP-01独立复核：`CP-01_RECONCILIATION=MATCHED`，reviewer `/root/batch3_cp01_reconcile_after_mount_fix`，无OPEN。其核对当前预检身份、resident/Docker资源事实、mount无序集合实现、测试夹具与修复后CP-04记录；确认CP-01仍只关闭资源/身份/版本前置，不升级为DEV、Stream Load或业务PASS。当前CP-01、CP-04均已对账MATCHED；全批6b须在这两个当前字节结论后fresh重做。

## 最终 review 后的 CP-01 差量修复

S-1 intake 时发现的一次性只读预检首败根因及修复见 doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-review-intake-codex.md。根因是当前 DEV 已运行时，resident host preflight 错用会将 DEV 本机 SSH tunnel/Vite 计入活动预算的 admin-validation-with-ter；修复复用已有 ter-validation-with-dev 精确排除当前 R5 manifest，并在 --self-test 固定资源 profile。该修复改变 CP-01 的预检 owning source。

受管首次拒绝：工具输出 R5_DORIS_HOST_PREFLIGHT_REFUSED=/.../scripts/env/check-runtime-resource-budget_FAILED；预算门在远端连接及 run manifest 创建前拒绝，因此无 managed run id/manifest。只读核对当时活跃 PID 与当前 DEV manifest 后确认属于 profile 误用，不是异常外部进程；原始拒绝输出只有本地工具结果，没有伪称存在日志文件。

修复后 focused：node --check scripts/dev/r5-doris-resident-feasibility.mjs 与 node scripts/dev/r5-doris-resident-feasibility.mjs --self-test PASS。随后唯一一次同目的 read-only preflight：run r5-doris-preflight-1790910965425-41042-2254380d-5630-455b-a427-ced568f113bd，2026-10-02T03:16:05.427Z–03:16:07.206Z，status PASS、business NOT_APPLICABLE、cleanup PASS_NO_REMOTE_MUTATION；核对远端 boot id、PostgreSQL 16.13、Doris 固定 image digest、resident container及两个volume、Testcontainers容器/卷为空。manifest路径 .runtime/r5/evidence/doris-resident-feasibility/r5-doris-preflight-1790910965425-41042-2254380d-5630-455b-a427-ced568f113bd/run-manifest.json。

CP-01 最终差量复核：`MATCHED`。Fresh 独立只读 reviewer `/root/batch3_final_delta_reconcile` 核验本 CP 全阶段的需求、详设/计划、项目记忆、当前预检源码、自测红例及上述受管 manifest，确认资源 profile 修复与实际证据对应。未重跑 resident probe；R-14 feasibility 的 host/image/mount 没有漂移。该差量复核未运行命令。
