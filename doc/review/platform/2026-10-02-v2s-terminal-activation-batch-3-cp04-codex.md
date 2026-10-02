# 批次三 CP-04 实施记录

CP-04：远端 DEV/reset 与 acceptance 容器所有权。

当前状态：`CP_RECONCILIATION=MATCHED`。Fresh 独立 reviewer `/root/batch3_cp04_reconcile_r2` 已对最后一次 cleanup 改动后的 CP-04 当前字节完成需求、详设/计划、项目记忆三维对账，结论 MATCHED、无 OPEN finding。此前 reviewer 对前一版的 `MATCHED` 曾因清理脚本字节变化失效；本次结论绑定目前记录的源文件及 focused proof。本记录不代表全批 6b、整体验收、13c 或整批 IMPLEMENTATION verdict。

## 本阶段实现

- DEV start 通过 `scripts/dev/r5-doris-resident.mjs` 复用固定 Apache Doris 4.1.3 resident 容器；仅使用已缓存且 image ID 与 RepoDigest 均匹配的镜像，不执行 pull。container、FE/BE named volumes、host fingerprint、restart policy、健康状态及 loopback `9030/8030/8040` 绑定均受 manifest 身份约束；DEV stop 保留此基础设施，不删除容器、卷或 image cache。
- resident 初始化失败时，容器与卷带本次唯一 attempt label。退出处理器先用可判定成功/失败的 Docker inventory 命令枚举 attempt 资源，再核对 container 的 name/image/owner/host/attempt 与 volume 的 name/driver/owner/attempt；仅身份全匹配的本次新资源可删除。任何 inventory、identity inspect、删除或删除后 readback 命令失败都将 `R5_DORIS_RESIDENT_PARTIAL_CLEANUP=FAIL`，原始启动失败码保持不变；不匹配的已有资源不删除，image 始终保留。
- `scripts/dev/r5-reset.mjs` 先受管停止历史生产者，再验证 resident Doris 的容器、镜像、挂载与端口身份；清理连接历史并 SQL readback 为 0 后才执行 PostgreSQL reset。Doris 清理失败阻止 PG reset；Doris 已清空而 PG reset 失败时按既有规则保留 partial-reset 并让 DEV 保持停止。
- 每次 backend-acceptance 由远端 Testcontainers 创建隔离 Doris 实例；TDS 使用同侧映射端口，无 Doris tunnel。runner 观察并记录受管容器/卷身份；capture 或 cleanup 缺证时不得形成 PASS。
- readiness 不依赖 Doris 可用；Doris endpoint 必须配置，历史写入仍由异步 writer 隔离。DEV 所有受管 tunnel 只映射批准入口，不暴露 Doris 或 TDS 节点端口。

## CP-04 focused proof

当前字节命令：

```text
node --check scripts/dev/r5-doris-resident.mjs
node --check scripts/dev/r5-dev-runner.mjs
node --check scripts/dev/r5-doris-resident.test.mjs
node --test scripts/dev/r5-doris-resident.test.mjs scripts/dev/r5-reset.test.mjs scripts/dev/r5-dev-command-wrapper.test.mjs scripts/test/r5-remote-testcontainers.test.mjs scripts/test/backend-acceptance-structure.test.mjs
```

结果：`112/112` tests PASS，zero failures/errors. 覆盖 resident manifest/image/loopback/mount 身份、禁止隐式 pull、初始化失败时仅清理本 attempt 的容器与卷、容器或 volume inventory 查询失败时 cleanup 均 fail closed、reset 的 Doris truncate/readback 与 PG reset 顺序、reset 拒绝错误/缺失 manifest、无 Doris tunnel、acceptance 场景发现与 TDS/Doris manifest/cleanup 收口。

额外命令 `node scripts/dev/r5-reset.mjs --self-test` 在修改 CP-04 resident ensure 之前对 reset gate 通过：`R5_DEV_RESET_SELF_TEST=PASS`、红例全 PASS、`CLEANUP=PASS`。reset implementation 与该命令的受影响代码在其后未变；当前 CP focused suite 又验证 reset 的 runner 模块与顺序判据。

### 首败诊断

新增 shell 行为测试首次在 macOS 本地缺少远端 Linux `/proc/sys/kernel/random/boot_id` 时提前退出；之后的 mock 先后暴露 container inspect 参数位置和带标签 volume inspect 的夹具建模错误。根因是测试 mock 没按真实脚本的 argv 与不同 Go-template 输出形状建模，未到真实远端 Docker 执行。夹具现在仅在临时 PATH 中模拟 boot id 和 Docker CLI，并区分 name-only、owner facts、attempt-tag facts 与普通/rollback container facts。第一次 shell proof 通过后，主 agent 检查到 Docker inventory 查询错误被忽略会造成 false cleanup PASS，遂将清理改为可检查返回码的资源枚举、身份核对及删除后 readback；新增 container 与 volume inventory 故障反例。最后同一 focused proof 让 DDL 执行失败，确认原失败码仍可见、inventory 正常时 cleanup 标记 PASS、本 attempt container/FE volume/BE volume 均消失且未运行 image 删除/pull；任一 inventory 不可用时 cleanup 标记 FAIL，无法核明的 container 不删除。此为本地 mock shell proof，不冒称远端 Docker 或 DEV 运行。

## 执行边界与尚未证明

- 本 CP 没有启动受管 backend-acceptance 或 DEV/reset；按计划，它们在所有 CP MATCHED 与全批 6b 之后运行。
- 本 CP 不证明 remote GenericContainer 的业务 Stream Load/readback、Doris resident 真实 stop/start/reset、完整 acceptance 或当前 DEV health。前序指定 R-14 feasibility 与 CP-01 preflight 证据仅在此前已声明的受限范围内有效，未由本记录升级。
- Doris resident feasibility run 与 CP-01 preflight 未发生相关主机、镜像、挂载、runner 字节或资源基线漂移时复用；本阶段没有重复 probe。

## 修改范围

- `scripts/dev/r5-doris-resident.mjs`、`scripts/dev/r5-doris-resident.test.mjs`、`scripts/dev/r5-dev-runner.mjs`、`scripts/dev/r5-reset.mjs`、`scripts/dev/r5-reset.test.mjs`、`scripts/dev/r5-dev-command-wrapper.test.mjs`；
- `scripts/test/r5-remote-testcontainers.mjs`、`scripts/test/r5-remote-testcontainers.test.mjs`、`scripts/test/backend-acceptance-structure.test.mjs`、`scripts/test/backend-acceptance`；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java`、`TdsAcceptanceProcess.java`；
- `scripts/dev/doris/connection-history.sql`。

以上文件属于本批准批次和 CP-04 的 resident/reset/acceptance 生命周期；关联的 CP-01～03 文件范围与动态证据仍以各自阶段记录为准。

## 独立三维对账

- 需求维度：MATCHED。R-6.7、R-13、R-14 与已接受批次三 amendment 要求远端 Doris resident、同 run acceptance 容器、reset 清理与资源保留边界，当前实现和本 CP focused proof 对齐。
- 详设/计划维度：MATCHED。CP-04 的 resident、reset、Testcontainers、tunnel 排除、manifest 及失败清理义务均有 owning source 与 focused proof；本 CP 不要求启动实际 DEV/reset/backend-acceptance，相关运行留到全部 CP 与全批 6b 之后。
- 项目记忆维度：MATCHED。业务与 cleanup 分开、资源身份闭合、资源查询失败不得视为空或 PASS，以及 Doris 只承载连接历史均得到遵守。
- Reviewer 明确核验了 attempt label 资源枚举、inventory/inspect/remove/readback 失败路径、仅删除身份完全匹配资源、保留镜像缓存；没有提出 finding。
- 本次独立对账为只读，没有新跑测试、构建、verify、远端命令或受管环境；`112/112` 是本 CP 上面记录的 focused test 证据，不升级为远端动态证明。
