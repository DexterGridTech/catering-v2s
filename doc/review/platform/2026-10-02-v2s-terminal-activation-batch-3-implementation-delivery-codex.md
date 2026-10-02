# 终端激活与长连接批次三实施交付证据

## 当前状态

- 实施范围：批次三，按已接受详设、实施计划、requirements 与 amendment 执行。
- `CP-01`～`CP-06`：各自有 fresh 阶段级三维 `MATCHED` 记录；`CP-01`、`CP-04` 最终差量复核由 `/root/batch3_final_delta_reconcile` 关闭。
- 全批 `6b=MATCHED`；最终修复影响范围差量也 `MATCHED`。
- `13c=MATCHED`；最终 resident/preflight producer 与证据链差量 `MATCHED`。
- 最终 fresh 整批 `REVIEW_TARGET=IMPLEMENTATION`：`/root/batch3_impl_final_review_final` 独立结论 `GO, M/S/N=0/0/0`；L1_ENGINEERING=PASS，L2_USER_VISIBLE=N/A，DESIGN_GAPS=none，Dexter decisions=none。reviewer 只读，未运行动态验证。
- 本批没有新增 UI、L2 action、UAT、生产部署或批次外功能；L2 对本批为 `N/A`。

## 最终复核 finding intake

Fresh reviewer `/root/batch3_impl_final_review` 对整批实施给出 `NO-GO, M/S/N=0/1/0`，唯一 S-1 为 resident Doris adoption 可能沿用与当前 DEV credential 不同的 writer password。主 agent 独立重开 R-6.7/R-14、amendment、详设、CP-04 source、fixture 和 Doris 4.1.3 官方源码后判定 `CONFIRMED`，无产品裁决：

- `scripts/dev/r5-doris-resident.mjs`：在既有 `CREATE USER IF NOT EXISTS` 后，按当前同一 credential owner 的值执行 `ALTER USER ... IDENTIFIED BY ...`，再执行既有表级授权及 grants readback。
- `scripts/dev/r5-doris-resident.test.mjs`：stale-password adoption 红例只有看到当前密码的 ALTER 才允许 PASS；断言密码不进入 stdout/stderr/命令日志。
- preflight 首次拒绝不是外部进程：根因是 DEV 运行期间错用 `admin-validation-with-ter` 资源 profile；改用已有 `ter-validation-with-dev` 精确排除当前 DEV manifest，新增错误 profile 自测红例。首次拒绝发生在远端连接和 run manifest 之前，故没有伪造 run ID/manifest。
- 官方版本依据为 Apache Doris 4.1.3 标签的 parser 与 `AlterUserCommand` / `AlterUserInfo`，详设已记链接；同时用最终 DEV 的真实 Stream Load/readback 证明当前注入的凭证可用。

Focused 当前字节结果：

| 命令 | 结果 |
|---|---|
| `node --check scripts/dev/r5-doris-resident.mjs` | PASS |
| `node --check scripts/dev/r5-doris-resident.test.mjs` | PASS |
| `node --test scripts/dev/r5-doris-resident.test.mjs` | 5/5 PASS，零失败 |
| `node --check scripts/dev/r5-doris-resident-feasibility.mjs` | PASS |
| `node scripts/dev/r5-doris-resident-feasibility.mjs --self-test` | PASS，含错误资源 profile 红例 |
| `scripts/dev/seed --profile r5-full --dry-run` | PASS，当前 seed plan digest `b37af605c2a9a9bda924c5455765efd569c96766b7c4e2a11768b03a5f1e4d1c` |

本次最终修复后没有重跑未受影响的 full backend-acceptance、TDS 场景或全部默认 verify。最新 full backend-acceptance 的 owning source 与 per-run Doris 路径不受此修复影响；resident 凭证、预检 profile 和相应红例通过上述当前 focused proof 及真实 E1 覆盖。默认 `scripts/verify` 全量 run 保留为历史 aggregate PASS；它晚于全量运行的证据边界见下方，不声称该 aggregate 是最终修改后的新运行。

## §11a 逐项验收映射

| 判据 | 动态/静态证据 | 结果与边界 |
|---|---|---|
| R-2.3/V-B1：Doris 不含 credential、激活码、raw deviceId | `r5-tc-1790902194579-72507` 的 TDS `terminal.connection.vs11.secret-search`；49 条 TDS CONTRACT 全通过。 | PASS；凭证搜索与 Doris row shape 均按场景输出核验。 |
| R-4.4/V-S4：跨节点取代、提交至本地登记竞态、sequence 不依赖时钟 | `r5-tc-1790896315855-42187` 的 `terminal.connection.vs13.cross-node-recovery`；子路径与 sequence/旧 session 关闭断言见 CP-05 记录。 | PASS；不宣称注入 OS/JVM 时钟偏差。 |
| R-6.3/V-S6：迟到心跳/断开不覆盖最新值、强制终止后新 session 成为 latest | `r5-tc-1790896315855-42187` 的 `terminal.connection.latest-state-stale-write`。 | PASS，TDS CONTRACT。 |
| R-6.5/V-B9：绑定历史留 PG，审计 actor/reason 正确 | `r5-tc-1790902194579-72507` 的 `storeTerminalAuditHistory` 与相关 store-terminal 业务 scenarios。 | PASS；199/199 business scenarios；具体 assertion 输出和 DB operation 见该受管报告。 |
| R-6.5/V-S7：CONNECTED、DISCONNECTED、每次 RTT 写 Doris | `r5-tc-1790881723798-40772` 的 `terminal.connection.history-records`，Doris SQL readback PASS。 | PASS；独立 per-run Doris、容器与卷 cleanup PASS。 |
| R-6.6/V-B9：Doris writer 挂起不影响激活/取消与 PG audit | `r5-tc-1790897077843-56712` 的 `terminal.connection.history-outage-bounded`，PG audit rows=40。 | PASS；业务最大耗时、超时重试/drop 和 cleanup 见 CP-05。 |
| R-6.6/V-S7：队列有界、写超时、业务响应上界、drop 可观察 | 同上 `history-outage-bounded`。 | PASS；队列上限 4096、writer timeout 10s、最多 3 次、激活/取消各 20 次，DB_OPERATIONS=7。 |
| R-2.3/V-S11：日志、报告及 Doris 无秘密 | `r5-tc-1790902194579-72507` 的 `terminal.connection.vs11.secret-search`。 | PASS；49/49 TDS CONTRACT。 |
| R-6.7/V-E1：per-run Doris 启动、健康、SQL、清理 | `r5-tc-1790902194579-72507` 全量受管 backend-acceptance；另 CP-02 `history-records` focused run。 | PASS；BUSINESS=PASS，TDS CONTRACT=49/49，backend scenarios=199/199，operation budget=296/296，Testcontainers/container/volume/runner cleanup PASS。 |
| R-6.7/V-E3：reset 前有记录、清理后为零并保留 resident infra | E1 run `ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44` 在 reset 前读到 CONNECTED=2、RTT=3、DISCONNECTED=2；之后最终 reset run `r5-reset-f49ecc36-400c-4f21-8002-29181073e33a` SQL 读回 0。 | PASS；reset cleanup 保留同一 Doris container/schema/image/FE/BE volume，DEV 在 reset 后独立重启。 |
| R-7.2/V-S5：另一节点收到业务取消后关闭为 ACTIVATION_CANCELLED | `r5-tc-1790896315855-42187` 的 `terminal.connection.vs13.cross-node-recovery` 子断言：listener恢复、跨节点取代后经真实 HTTP 设备取消。 | PASS；旧节点会话按 SESSION_REPLACED 取代；B节点当前会话以 4000/ACTIVATION_CANCELLED 关闭，Doris断开原因一致；control PONG=2。详设与本映射现使用真实 selector，不伪造独立场景。 |
| R-7.3/V-S13：listener 重建后核验 latest session | `r5-tc-1790888076113-72812` 的 `storeTerminalActivationBusinessPrecedence` + `terminal.connection.vs13.cross-node-recovery`。 | PASS；业务、CONTRACT 及 TDS/Testcontainers/runner cleanup PASS。 |
| R-12/V-G1：新增门与 red fixture | `.runtime/batch3-cp06/validate-only-post-doris-closure.log`：`scripts/verify --validate-only` 46/46 PASS；当前新增 resident/preflight 自测如本报告 focused 表。 | PASS；当前默认 `scripts/verify` aggregate 未因局部末修复而重跑，历史 full run `r5-verify-16215-1790904019356` PASS；受影响当前字节 proof 单列，不升级为全量 aggregate PASS。 |
| R-13：远端同机 Doris、无 Doris/TDS tunnel | 最终 DEV manifest 与 E1；reset/start/seed 最终链。 | PASS；Doris 仅绑定远端 loopback；最终 resident container/image 与 volume identity 见 `.runtime/r5/run-manifest.json`。 |
| R-14：临时/常驻容器、挂载、同机资源、健康、reset/cleanup | R-14 feasibility 报告及 resident run；当前 preflight `r5-doris-preflight-1790910965425-41042-2254380d-5630-455b-a427-ced568f113bd`；最终 DEV/reset manifests。 | PASS（只限本机、固定镜像/挂载、单次观测边界）；不外推生产 HA、长期峰值或容量 SLO。Stream Load 与权限另见当前受管 acceptance/E1，不依靠旧 feasibility 代替。 |

## 最终独立实施复核

- Fresh reviewer `/root/batch3_impl_final_review_final` 对最终生产代码、测试、脚本、详设、计划与运行证据进行了只读整批 `REVIEW_TARGET=IMPLEMENTATION` 复核，结论 `GO, M/S/N=0/0/0`；`L1_ENGINEERING=PASS`、`L2_USER_VISIBLE=N/A`、`DESIGN_GAPS=none`、无 Dexter 裁决项。该 reviewer 未运行构建、测试或受管环境。
- reviewer 完成后，主 agent 发现详设 §11/§11a 曾引用不存在的 `terminal.connection.cross-node-revocation`。生产场景和 run 不变；详设与本报告已改为真实 selector `terminal.connection.vs13.cross-node-recovery` 下的 `device-cancel-after-takeover` 子断言。原 reviewer 随后对该文档差量做只读核验，结论 `MATCHED`，确认源码、CP-03/CP-05 记录与 run `r5-tc-1790896315855-42187` 一致，无其他需修正文案。该差量没有触及生产源码、测试、场景或动态证据。

## 整批动态结果与治理结论

- 当前 full backend-acceptance：`r5-tc-1790902194579-72507`，2026-10-02T00:49:54.586Z–01:01:40.358Z；BUSINESS PASS、TDS CONTRACT 49/49、业务场景 199/199、预算 296/296、资源/runner cleanup PASS。该 run 的来源模块未受 final resident helper/preflight repair 影响。
- Current-byte DEV E1：`ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44`，2026-10-02T03:20:20.193Z–03:21:58.023Z；BUSINESS、fixture cleanup、runner cleanup PASS；同 resident 的真实 Doris readback `CONNECTED=2 / RTT=3 / DISCONNECTED=2`。
- 最终 dry-run：2026-10-02T03:32:08Z，PASS。
- 最终 reset：`r5-reset-f49ecc36-400c-4f21-8002-29181073e33a`，2026-10-02T03:33:38.940Z；Doris truncate/readback=0 后 PG reset/readback absent；cleanup `PASS_DORIS_RESIDENT_RETAINED_DEV_STOPPED`。
- 最终 DEV：`r5-dev-1790912053964-65452-72a75a8c-8084-4b8c-a339-c213db2eba4f`，约 03:34:19.964Z start；readiness PASS，Java/TDS×3/listener/HAProxy/tunnel/Vite 均通过。Doris resident healthy。启动不隐式 seed。
- 最终完整 `r5-full` seed：`complete-seed-16944083-6487-4df6-bde3-665522894b4e`，2026-10-02T03:36:05.312Z–03:40:17.907Z；BUSINESS PASS、四 owner PASS、store-terminal post-step 创建 8/详情读回 8/列表读回 7、cleanup `PASS_PRESERVED_DEV_STATE`。DEV 有意保持运行。
- 默认 `scripts/verify`：最近完整 run `r5-verify-16215-1790904019356` 为历史 PASS；不是 final S-1 修复之后的新 aggregate run。`--validate-only` 46/46 PASS；当前改动覆盖的 resident test、自测、受管 preflight 与 DEV E1 均有当前证据。未改变的全量 gate/acceptance 没有重跑。
- 旧首败与资源预检拒绝均保留，根因及修复在 finding intake 和 CP-01/04 记录中；没有用延长 timeout、换场景或盲目重试抹去失败。

## 最终状态行

当前字节上的最新运行：`complete-seed-16944083-6487-4df6-bde3-665522894b4e`，2026-10-02T03:36:05.312Z–03:40:17.907Z，BUSINESS=PASS，CLEANUP=PASS_PRESERVED_DEV_STATE。

最后一次通过：同一 run；本批生产源码及 seed 输入与最终 DEV/current byte 一致，随后仅新增本交付证据与 review brief 文档；DEV 仍由其受管 manifest 保持运行。

## 尚未验证 / 限制

- 未做 UI/L2、Android/Expo 设备对照、UAT 或生产部署，均在授权范围外或本批 N/A。
- 不声称 Doris 生产 HA、长期高峰容量、历史保留期限或统计查询/API。
- 旧 `scripts/verify` 全量 aggregate PASS 不是最终 localized repair 后的新 run；末次改动的当前受影响 proofs 已逐项列出，没有把针对性 proof 升格为 aggregate PASS。
- Fresh 最终整批 `REVIEW_TARGET=IMPLEMENTATION` verdict 为 `GO, M/S/N=0/0/0`，见本报告“整批动态结果与治理结论”及最后状态。该 verdict 是静态对抗审查，不替代 Claude/Dexter 的交付复评。
