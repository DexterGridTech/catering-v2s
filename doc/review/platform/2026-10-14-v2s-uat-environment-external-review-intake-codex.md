# V2S UAT 环境外部 DESIGN review finding intake

- 日期：2026-10-14
- REVIEW_ORIGIN=DEXTER_ROUTED_EXTERNAL_REVIEW
- REVIEW_TARGET=DESIGN
- 内部 `TER_UAT_ENV_2026-10-14` DESIGN cycle 已关闭；本 intake 不重开 cycle、不构成新独立 verdict。
- 依据：Claude 外部评审 `doc/review/platform/2026-10-14-v2s-uat-environment-external-design-review-codex.md`；逐项由主 agent 重开当前需求范围、详设、计划、fixture 正本与实际消费者核验。
- 本次仅修改详设、实施计划及本 intake。未修改源码、规范、fixture contract、配置或依赖；未执行生成、构建、测试、verify、DEV/UAT、部署、数据库、reset 或 seed。环境部署与导入=NOT_RUN；agent 自动化测试=NOT_PLANNED。
- Dexter 最新范围：“UAT环境是给用户体验测试的，所以有测试数据，环境就绪就可以了。”用户体验测试由用户进行，不作为本批交付前置。

## 1 · 当前设计包

| 文件 | 当前 SHA-256 |
| --- | --- |
| `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-design-codex.md` | `867abc415485985b0bcd349eb8ae3f5547e04abfa544c83bc999d7f60bb3f1a0` |
| `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-plan-codex.md` | `9fa2380e23c34165167051efdb247ba30b8a8f5eadaa0443079864e4db980acb` |

旧评审 SHA `a7c9e2fb…` / `275d88fb…` 与原 NO-GO `M/S/N=0/2/6` 保留为历史，不能视为本次修订字节结论。

## 2 · Finding intake

| Finding | Disposition | 主 agent 核验与当前处置 |
| --- | --- | --- |
| S-01 CP/seed准入循环 | CONFIRMED；当前文档已修正 | 旧评审所指循环成立：CP-04/CP-06把完整导入放在退出/全批对账之前。当前详设 §3 CP-04 与计划 §3 CP-04 仅以target/consumer/报告静态对账为CP退出；完整当前字节 dry-run移至所有CP与6b之后、init之前，且要求该次运行有明确授权和适用准入。完整seed/readback/资源cleanup只属之后的实际环境准备记录，不回填CP退出条件。依据当前详设 §3、§10b.6、§13b；计划 §3、§4、§5。 |
| S-02 `inv-expired` UAT渠道 | CONFIRMED；OPEN，需 Dexter 裁决 | 唯一父executor `scripts/dev/owner-command-seed-executor.mjs:890–894` 无条件调用 terminal fixture。`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json:108–140` 将其限制在DEV条件；`scripts/dev/terminal-fixture-state.mjs:17–20,48–63,65–78,81–127,135–140,170–180` 校验 `r5-dev-run-manifest`、`r5-full`、DEV非生产标记、DEV namespace/database，并连固定DEV PostgreSQL容器。owner HTTP目前只有create/cancel/reissue，不能创建该过期时间终态。现行正本没有UAT直接SQL例外。详设 §10b.6、§4权限表和计划 §3/§6 保留此OPEN：不跳过fixture、不称完整seed可执行。候选差异是仅把这一唯一adapter改成按 DEV/UAT manifest 识别target，仍限 `inv-expired`，要求先经owner HTTP创建精确PENDING对象，再验证UAT host/container/DB/namespace和intent，以单事务写PENDING→EXPIRED及同事务audit/receipt，最后走既有owner HTTP readback；普通fixture仍全走owner API，不加通用SQL或第二executor。**请 Dexter 明确批准或拒绝把当前DEV-only窄例外扩展到UAT。**若批准，也只解决设计范围裁决，不授权源码/fixture-contract实施或运行；那些仍需另行授权。 |
| N-01 远端浏览器owner与自动化测试 | REJECTED_WITH_EVIDENCE；最新范围不适用 | Dexter已删除UAT-01～11、浏览器/终端smoke与agent功能测试义务；详设 §1/§11及计划 §1明确自动化测试NOT_PLANNED。当前只要求远端后台发布和数据就绪，不要求引入远端browser owner或恢复测试矩阵。 |
| N-02 资产URL与公开入口映射 | CONFIRMED；已补文档 | 实际资产owner分别消费内部MinIO endpoint、bucket及 `CATERING_ASSET_PUBLIC_BASE_URL`；生成URL形状为 `<publicBaseUrl>/<bucket>/<objectKey>`。详设 §2.3与计划 CP-02/05现在区分内部S3 endpoint、UAT公开资产ingress/publicBaseUrl及公开业务bucket；`/api`代理不替代资产入口，不公开private update bucket，也不增加图片自动测试。对应源码：`scripts/dev/r5-dev-runner.mjs:517–527`、`MinioAssetObjectStorage.java:278–279`、后台资产消费者见原review §4 N-02。 |
| N-03 旧UAT场景文件映射/bootstrap CP | REJECTED_WITH_EVIDENCE；最新范围无测试矩阵义务，bootstrap接缝已一致 | 旧场景ID/验证文件映射基于已删除的UAT测试矩阵，不再是当前交付义务；不恢复场景或测试文件。bootstrap明确由CP-03建立、CP-04消费，详设 CP表与计划 CP-03/04顺序一致；没有当前残余矛盾。实际操作报告沿用bootstrap与六阶段父子报告，不新增测试场景台账。 |
| N-04 Spring Boot官方依据精度 | CONFIRMED；文档已澄清，实际版本OPEN | 当前仓声明Spring Boot 4.1.0，但未做实际依赖解析；官方 `/4.1/`链接是API家族导航，不足以证明4.1.0行为。详设 §12第三方依据说明与计划 CP-01现要求未来实施读取resolved artifact并使用对应精确版本tag/Javadoc；仍标OPEN/NOT_RUN，不声称版本已核实。 |
| N-05 UAT资源标签与DEV residue guard | CONFIRMED；已补文档 | `scripts/dev/r5-dev-runner.mjs:260–261` 按 `com.catering-v2s.remote-root` 做DEV全host residue检查；`scripts/dev/r5-remote-java.mjs:5–21,24–44` 与 `scripts/dev/managed-diagnostic-protocol.mjs:73–83` 也绑定DEV root/kind。详设 §2.2、计划 CP-01/§5指定UAT用独立 `com.catering-v2s.uat-root` 与自己的manifest生命周期，不复用DEV专属控制/诊断协议，避免DEV错误识别或处置UAT资源。 |
| N-06 LiveKit网络与CBS配置映射 | CONFIRMED；已补文档 | `scripts/dev/livekit/docker-compose.yaml:8–9` 暴露signal TCP与media UDP；`livekit.yaml.template:1–9` 消费端口、`rtc.node_ip`、密钥；CBS signer消费signal URL与API凭证。详设 §2.3、CP-02/05和计划 CP-02/03/05要求CBS、终端 `serverSpaces.uat.livekit`、signal/API、TCP/UDP与advertised `node_ip`指向同一UAT实例。实际版本/digest仍待实施按官方发布资料核对；不增TURN、DNS、证书、HA或自动远控测试。 |

## 3 · 最小修订与剩余边界

- S-01：同步详设与计划的CP退出、全批6b、seed dry-run及实际导入顺序；完整seed dry-run不再是CP-04退出条件。
- S-02：保留精确候选实现和权限差异为OPEN，交Dexter裁决；没有在文档中把DEV例外改写成已获UAT授权。
- N-02/N-05/N-06：只补现有资源/消费者配置映射，不建立新测试面、资源控制面或通用调度器。
- N-04：计划将真实依赖解析与官方精确版本依据留给未来获授权实施阶段；未核验内容维持OPEN。
- 最新范围下所有功能测试、浏览器/终端smoke及用户体验测试均NOT_PLANNED或由用户执行；部署、导入、seed、服务readiness、owner readback及实际cleanup仍NOT_RUN。

## 4 · 交 Claude 复评

作者处置不是独立GO。完整交接见 `doc/review/platform/2026-10-14-v2s-uat-environment-external-review-request-codex.md`；已通过 `scripts/check/claude-review-handoff`。请Claude按其中当前文件SHA重新独立核验，重点判断 S-01 阶段顺序是否完全无循环、S-02精确例外是否应在当前裁决状态保持OPEN，以及 N-02/N-04/N-05/N-06 的映射能否让后续获授权实施者找到实际owner和版本依据。不得恢复已删除的agent测试矩阵或要求动态证据，也不得将实际部署/导入误标为已完成。

## 5 · 最新复评及实施授权更新

Dexter本次转交的最新独立静态复评为 `GO`、`M/S/N=0/0/3`。这只表示当前设计可接受，不表示UAT源码、资源、发布或seed已完成。Dexter已在同一指派中授权必要源码/脚本/配置、受管UAT资源、Flyway、首次管理员、两个后台发布、完整`r5-full` dry-run及首次导入；本节不扩展到测试矩阵、DEV reset/seed、既有UAT数据清理、未知资源或生产。

| 最新非阻断项 | 状态与落点 |
| --- | --- |
| N-01：dry-run前TER artifact输入 | 已纳入详设§10b.6、计划§4：有合法成功`update.artifacts` source run和导出文件则复用；否则使用获批的受管artifact export入口，记录`R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID`。不运行owner-flow、浏览器或设备体验场景。 |
| N-02：“同步tests”范围歧义 | 已在计划§3澄清：只同步既有fixture contract/report validator与实现，不新增或运行测试。 |
| N-03：CP静态失败条件/禁项/复读位置 | 已在计划§3新增六行归并，属于现CP操作说明，不新增门或测试机制。 |

S-02现已由Dexter明确批准，处置从`OPEN`更新为“获批的唯一UAT扩展，实施中”：仅限现有`inv-expired` adapter；普通owner HTTP先创建精确PENDING invitation，受UAT manifest绑定host/container/database/namespace/run/唯一intent，在一个受限事务内改过期状态、时间/version并写audit/receipt，之后通过原owner HTTP readback。详设§10b.6、计划§6及fixture contract `terminalFixtureBoundary` 必须保持同一范围。不得复制executor、增加其他fixture或通用SQL/HTTP。

本轮已完成上述计划与fixture contract的文档/契约修改；UAT源码、脚本、四个终端地址、构建、远端资源、bootstrap、seed dry-run和首次导入仍待实施/运行证据，不得标为PASS。

