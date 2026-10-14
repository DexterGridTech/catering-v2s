# V2S UAT 环境修订设计包 · Claude 独立复评请求

## 背景

本轮是对 Claude 先前 `NO-GO, M/S/N=0/2/6` 后修订字节的 Dexter 中转复评。旧评审 SHA 为详设 `a7c9e2fb…`、计划 `275d88fb…`，只保留为历史。Dexter 已把目标收敛为：UAT 供用户体验，agent 负责独立环境就绪和完整体验数据导入；用户体验测试由用户进行，不是交付前置。作者修订已处理CP/seed顺序及部署映射，但 `inv-expired` 的UAT写入渠道仍为明确OPEN，未由作者扩权。

## 评审目标

请独立判断当前详设和计划能否让未来获授权实施者完成远端UAT环境准备与唯一完整r5-full数据导入。重点确认CP退出与全批准入顺序无循环、UAT资源/网络/资产配置有实际消费者映射，并判断 `inv-expired` 的UAT渠道是否应保持为需Dexter裁决的唯一OPEN。不要恢复已退役的agent自动化测试矩阵、浏览器/终端smoke、故障注入或重复启停证明；实际运行证据不是本次DESIGN review前置。

## 需阅读文件

- `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-design-codex.md`：当前详设，SHA-256 `867abc415485985b0bcd349eb8ae3f5547e04abfa544c83bc999d7f60bb3f1a0`。
- `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-plan-codex.md`：当前实施计划，SHA-256 `9fa2380e23c34165167051efdb247ba30b8a8f5eadaa0443079864e4db980acb`。
- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`：唯一r5-full业务fixture正本，核对`inv-expired`适用条件。
- `scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/terminal-fixture-state.mjs`：`inv-expired`当前调用与写入边界。
- `scripts/dev/r5-dev-runner.mjs`、`scripts/dev/r5-remote-java.mjs`、`scripts/dev/managed-diagnostic-protocol.mjs`：DEV资源guard、身份和诊断消费者。
- `scripts/dev/livekit/docker-compose.yaml`、`scripts/dev/livekit/livekit.yaml.template`：LiveKit TCP/UDP与advertised address配置来源。
- `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/MinioAssetObjectStorage.java`、`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/LiveKitRemoteControlGrantSigner.java`：资产URL与LiveKit signer消费者。
- `doc/review/platform/2026-10-14-v2s-uat-environment-external-design-review-codex.md`：旧字节评审与原始finding，仅用于定位历史输入。
- `doc/review/platform/2026-10-14-v2s-uat-environment-external-review-intake-codex.md`：主agent逐项核验/disposition；请独立判断，不将作者结论视为证明。

## 独立核验重点

1. 对照详设CP表和计划CP表，确认所有CP均只需实现与静态对账即可退出；完整字节seed dry-run是否仅在全部CP、全批6b之后、实际init前作为批次准入，实际导入/readback/cleanup是否未回填CP退出。
2. 重新核验seed executor无条件要求`inv-expired`、现fixture contract/adapter的DEV-only activation conditions，以及owner HTTP当前不可生成过期状态的事实。评估文档提出的唯一窄候选是否完整；候选仅扩展该allowlisted fixture至经身份核验的UAT target，并保留owner HTTP创建前置、精确intent、有限单事务mutation、audit/receipt和原owner readback。不授权你或作者将OPEN自行改为批准。
3. 核验DEV的全host residue label与控制/诊断身份，判断独立UAT label/manifest是否能避免UAT和DEV互相误管，而未引入通用调度机制。
4. 核验CBS内部MinIO endpoint、公开业务资产bucket、`CATERING_ASSET_PUBLIC_BASE_URL`及远端公开入口的映射；确认它不依赖`/api`代理且不暴露private update bucket。
5. 核验LiveKit信令TCP、media UDP、advertised `node_ip`、CBS signer配置与terminal UAT server-space的对应关系。Spring Boot和middleware的实际解析版本/digest仍未验证；判断将其明确留给未来实施按精确版本核对是否合适，不要求补动态证据。
6. 按最新范围过滤旧N类测试场景/file mapping注记；不得要求恢复UAT测试矩阵，也不得把NOT_RUN的部署与导入说成已通过。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每项finding列出当前文件/行号、仓内事实与推论、触发条件/影响、最小修正及是否需要Dexter裁决。将`inv-expired`列为OPEN不等于批准其UAT权限扩展；如你认为设计尚不能实施，请具体说明尚缺的裁决或最小设计信息。请单列方案是否简单且符合用户最新范围。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《V2S UAT 环境》修订后的详设与实施计划做一次独立静态 DESIGN 复评。

背景：你此前对旧字节的结论为 NO-GO，M/S/N=0/2/6；旧 verdict 只对应详设 SHA a7c9e2fb…、计划 SHA 275d88fb…。Dexter 随后收敛目标为“UAT环境是给用户体验测试的，所以有测试数据，环境就绪就可以了”：agent只完成环境就绪与完整数据导入，用户自己体验，用户测试不作为交付前置。本次文档已修订，未生成新的独立 verdict。
目标：请以当前文件SHA独立判断设计与计划是否可直接指导未来获授权实施者完成远端UAT环境准备和完整r5-full导入，重点核准CP/6b/seed顺序、唯一`inv-expired`渠道OPEN，以及资源、资产、LiveKit和版本依据映射。不要恢复自动测试矩阵或要求动态证据。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-design-codex.md`，SHA-256 `867abc415485985b0bcd349eb8ae3f5547e04abfa544c83bc999d7f60bb3f1a0`；
- `doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-plan-codex.md`，SHA-256 `9fa2380e23c34165167051efdb247ba30b8a8f5eadaa0443079864e4db980acb`；
- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`；
- `scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/terminal-fixture-state.mjs`；
- `scripts/dev/r5-dev-runner.mjs`、`scripts/dev/r5-remote-java.mjs`、`scripts/dev/managed-diagnostic-protocol.mjs`；
- `scripts/dev/livekit/docker-compose.yaml`、`scripts/dev/livekit/livekit.yaml.template`；
- `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/MinioAssetObjectStorage.java`；
- `apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/LiveKitRemoteControlGrantSigner.java`；
- `doc/review/platform/2026-10-14-v2s-uat-environment-external-design-review-codex.md`：旧字节历史finding；
- `doc/review/platform/2026-10-14-v2s-uat-environment-external-review-intake-codex.md`：主agent处置，仅供对照，不作为独立证明。

请重点独立核验：
1. 所有CP是否仅以实现和静态对账退出；完整当前字节seed dry-run是否只在所有CP及6b之后、实际init前作为批次准入，真实部署/导入没有回填CP条件。
2. `inv-expired`确为唯一必须走terminal fixture的状态，现有fixture contract/adapter仅授权DEV，owner HTTP不能生成该过期状态。判断详设是否准确保留该OPEN，并评估其最小UAT候选：仅将同一allowlisted adapter扩至manifest身份明确的UAT目标，保留owner HTTP创建前置、精确fixture/intent、受限事务mutation、audit/receipt与owner HTTP readback。请勿代替Dexter批准该权限范围。
3. UAT独立资源label/manifest是否与DEV全host guard、控制及诊断身份相容；MinIO内部endpoint/公开资产URL/bucket映射及LiveKit TCP信令、UDP媒体、advertised address、CBS signer和终端配置是否闭合。
4. 自动浏览器、终端smoke、UAT测试矩阵及重复启停均已从本次交付范围删除；部署、seed、owner readback、readiness及cleanup目前NOT_RUN。实际依赖解析与镜像digest仍OPEN，不要求动态证据。

请明确给出 `GO` 或 `NO-GO` 及 `M/S/N`。每项finding写明当前精确路径/行号、事实或推论、影响、最小修正和是否需Dexter裁决，并单列方案是否简单且符合Dexter最新范围。

授权边界：本次只请求对当前文档和指定源码作只读静态DESIGN复评；不授权修改需求/设计/计划/源码/fixture contract，不授权生成、构建、测试、verify、DEV/UAT、部署、数据库操作、reset/seed或动态验收。旧DESIGN cycle不重开；任何新的实现/运行仍须Dexter明确授权。谢谢。
```
