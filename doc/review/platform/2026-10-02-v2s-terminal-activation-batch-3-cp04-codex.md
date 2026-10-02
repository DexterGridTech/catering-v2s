# 批次三 CP-04 实施记录

CP-04：远端 DEV/reset 与 acceptance 容器所有权。

当前状态：`CP_RECONCILIATION=MATCHED`。Fresh 独立 reviewer `/root/cp04_reconcile_final2` 已核需求、详设/计划、项目记忆、owning source 与当前 CP 记录，确认本 CP 对账 MATCHED、无 OPEN finding。`112/112` 明确为根因修复前历史结果；当前 focused suite 为 `114/114 PASS`，源码 hash 已列明，原始本地 stdout 未单独归档这一证据限制也如实保留。该复核未运行测试或受管环境，不证明真实 DEV/reset/backend-acceptance，不代表全批 6b、整体验收、13c 或整批 IMPLEMENTATION verdict。

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

历史结果：`112/112` tests PASS，zero failures/errors（挂载次序根因修复前）。该结果已被下文当前字节上的 `114/114` focused suite 取代，不作为当前证明。覆盖 resident manifest/image/loopback/mount 身份、禁止隐式 pull、初始化失败时仅清理本 attempt 的容器与卷、容器或 volume inventory 查询失败时 cleanup 均 fail closed、reset 的 Doris truncate/readback 与 PG reset 顺序、reset 拒绝错误/缺失 manifest、无 Doris tunnel、acceptance 场景发现与 TDS/Doris manifest/cleanup 收口。

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

## 首次实际 DEV start 后的根因修正

首次受管 DEV start `r5-dev-1790906437831-68097-9b0ebb3e-1d48-4f54-928f-90c3020cc80f` 在resident mount identity处失败，后续只读预检发现容器本身健康且owner/image/host/attempt/卷身份一致；实际`.Mounts`返回顺序BE后FE，与之前源码的字符串预期顺序相反。原始失败保留于`.runtime/batch3-dynamic/dev-start-e1.log`。这是runner误判，不是Doris服务故障。

主agent已把ensure/verify/reset挂载核验统一为无序集合比较；在缺少本地resident manifest时，只允许按受信host fingerprint、精确owner/image/container名、UUID attempt标签、loopback绑定、两卷owner/attempt及挂载集合验证后重建manifest；失败清理改为等待本attempt容器实际消失后再清卷，仍占用则保留卷并报cleanup FAIL。Doris image cache始终保留。脚本说明同步更新。

当前字节 focused proof：执行命令为 `node --test scripts/dev/r5-doris-resident.test.mjs scripts/dev/r5-reset.test.mjs scripts/dev/r5-dev-command-wrapper.test.mjs scripts/test/r5-remote-testcontainers.test.mjs scripts/test/backend-acceptance-structure.test.mjs`，观察结果 `114/114 PASS`、零失败/错误；另有挂载顺序 shell proof 与 `r5-doris-resident-feasibility.mjs --self-test` 通过。该次本地 Node 执行不是受管运行，无 managed run id；命令输出保留在本任务的执行工具结果中，没有单独归档原始 transcript。对应源码 SHA-256：`r5-doris-resident.mjs=82b8fca64ae587fbf29c1b04a2d26a911673c3dec1e4384e69e74e0ed50587c0`、`r5-doris-resident.test.mjs=fe6f5abb333fcd1de89e8655416d29448de0e048665e779dc2d60101aaf15c1f`、`r5-doris-resident-feasibility.mjs=b8f6fc61931cd9bfd6abefba00e16189f88df86cc8d8cdff6db08691f2cd182d`。此 proof 只证明本地 mocked shell/identity/reset 路径，不替代受管 DEV start、远端 Docker 或 Doris 业务读写证明。

## 独立三维对账

- 需求维度：MATCHED。R-6.7、R-13、R-14 与已接受批次三 amendment 要求远端 Doris resident、同 run acceptance 容器、reset 清理与资源保留边界，当前实现和本 CP focused proof 对齐。
- 详设/计划维度：MATCHED。CP-04 的 resident、reset、Testcontainers、tunnel 排除、manifest 及失败清理义务均有 owning source 与 focused proof；本 CP 不要求启动实际 DEV/reset/backend-acceptance，相关运行留到全部 CP 与全批 6b 之后。
- 项目记忆维度：MATCHED。业务与 cleanup 分开、资源身份闭合、资源查询失败不得视为空或 PASS，以及 Doris 只承载连接历史均得到遵守。
- Reviewer 明确核验了 attempt label 资源枚举、inventory/inspect/remove/readback 失败路径、仅删除身份完全匹配资源、保留镜像缓存；没有提出 finding。
- 本次独立对账为只读，没有新跑测试、构建、verify、远端命令或受管环境。先前 reviewer 的 `112/112` 引用指向挂载修复前历史结果；当前字节 focused 结果为上文明确记录的 `114/114`，不升级为远端动态证明。原始本地测试 stdout 未归档是证据留存限制，不能写成完整 transcript 已保存；如治理复核要求文件化原始 stdout，需在相关字节改变后捕获新的执行结果，当前不因文档问题重复跑未变字节。

## 最终 review 后的 S-1 intake 与修复

fresh整批实施review提出“resident Doris复用时，password文件可能重建而持久账号仍用旧密码”。主agent分类 CONFIRMED，具体判据、同根范围、版本官方证据与执行路径首败见 doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-review-intake-codex.md。该 finding 没有产品语义分歧。

最小修复在 r5-doris-resident.mjs 的 writer SQL 中，将已有 CREATE USER IF NOT EXISTS 后追加 ALTER USER 使用当前 credential 的密码，再执行既有 GRANT 和 SHOW GRANTS readback。它复用同一 credential owner；没有搬移代理密码、增加密码副本或新秘密 owner。详设、计划和 scripts README 已同步写明持久容器重启时的密码对账边界。

回归夹具在 adoption 场景预置 stale-password-from-persisted-resident。mock仅收到 ALTER USER 才把模拟状态改为 reconciled；测试同时断言该 SQL 使用本次传入的64位值、adoption才可PASS且凭证值不进入命令参数/测试输出/错误输出。Doris 4.1.3 grammar与命令实现链接见详设第三方依据；managed E1进一步在同一 resident Doris 与当前DEV writer配置下读取到连接历史行。

当前 focused结果：node --check scripts/dev/r5-doris-resident.mjs、node --check scripts/dev/r5-doris-resident.test.mjs PASS；node --test scripts/dev/r5-doris-resident.test.mjs 5/5 PASS、零失败；r5-doris-resident-feasibility.mjs --self-test PASS。当前源码SHA-256：r5-doris-resident.mjs db0fa11680034afed393b348dd67b9cb973236a0d4b6fc9e513c1fe4b7e8676f；r5-doris-resident.test.mjs 4ace3c4195c45a6b9cb719df3696e0ac89366dac062b492e67bf879545142ffd。

受管证明：当前DEV的前一run r5-dev-1790908864334-5932-aacac3c9-8649-469c-a505-f35aba72e16b 经 scripts/dev/stop 完成；terminal manifest为 PASS，resident Doris为PASS_RETAINED。修复后 start run r5-dev-1790911102051-44163-0bc31ac9-b46a-4643-92b6-8e4d96d5219f PASS，三TDS、Java、HAProxy、两个WebSocket入口、Vite和tunnel readiness均通过，复用了同一 Doris container/image/FE/BE volume。随后单场景 E1 run ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44，2026-10-02T03:20:20.193Z–03:21:58.023Z，terminal.dev.lifecycle-and-compression BUSINESS=PASS、fixture cleanup=PASS、runner cleanup=PASS、exitStatus=0；manifest readback status PASS，CONNECTED=2、HEARTBEAT_RTT=3、DISCONNECTED=2，elapsed 916ms。manifest：.runtime/terminal-client-dev-acceptance/ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44/manifest.json。

本CP因owner/test/doc和真实DEV行为发生变化，之前的CP-04 MATCHED结论不覆盖上述改动。最终差量复核为 `MATCHED`：fresh 独立只读 reviewer `/root/batch3_final_delta_reconcile` 核验 CP-04 全阶段的需求、详设/计划、项目记忆、Doris 4.1.3 官方依据、stale-password 红例、current DEV manifest 与 E1 readback，未发现 OPEN。未重跑完整 CP-04 acceptance/reset 或无关 focused proofs；reviewer 未执行命令。
