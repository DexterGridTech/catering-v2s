# Backend acceptance DESIGN review：Codex intake 与整改

- reviewTarget: `DESIGN`
- reviewSource: `doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-claude.md`
- reviewSourceSha256: `6d21db4e6d905e0bebb19d33744a51fa0b10b72ca183ba94d04115693328e6f0`
- incomingVerdict: `NO-GO (M=2 / S=2 / N=2)`
- currentAuthority: `DESIGN_ONLY_NO_DYNAMIC_RUNTIME`

## 1. 逐 finding 独立处置

### M-01｜计量 sink 少计没有校准红证

`CONFIRMED`。原设计只拒绝超过 accepted baseline，无法拒绝 no-op sink 或单 metric 少计；下降
无前置条件会把错误少计直接接受。

整改：

- 详设 §3.3、§6.1、§6.2 增加 test-only known-cost calibration；fixture 在单事务内执行
  2 insert + 3 select，独立推导 `LOGICAL_SQL=5/QUERY=3/UPDATE=2/CONNECTION=1/
  TRANSACTION=1/BATCH=0`，严禁由 measured output 回填；
- execution contract 固化 fixture derivation、执行时机和
  `MEASUREMENT_SINK_INTEGRITY_FAILED:<metric>`；
- baseline 首次写入和下降只有当轮 calibration PASS 才合法；no-op、漏任一 metric、错 correlation
  都是 production-harness scratch red。

### M-02｜77.6% 未锚定面使 ALL 成常态，原容量目标失真

`PARTIALLY_CONFIRMED`。571/128/443 与 77.58% 静态 surface ratio 独立复算成立；foundation、
audit-model、execution-context 确为 0 anchor。该比例不是观察到的提交频率，且 audit-read 为 2/2，
所以“每个模块无例外”不成立；但它足以否定 subset 是默认容量模型。

整改：

- 详设 §6.3 明示 ALL 是常态容量模型，并记录逐模块分布与 77.58% 的正确解释；
- per-edit engineering target 改为 full current denominator `<=10m`，最小 lane 数按 fresh scheduling
  weight 反推；资源不足在初始化前失败 `BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY_INSUFFICIENT`；
- 绝不缩 operation/四维/cleanup；未来降低 ALL 频率只能提高 source-derived anchor 覆盖率，禁止
  路径豁免，本包只登记欠账。

### S-01｜owner 无法机械映射 module/provider

`CONFIRMED`。当前 11 个 owner 中有 36 行不能按字符串同名推 module：platform-iam 16、contract
10、platform-workspace 7、platform-asset 3。

整改：execution contract 固化 11 个 owner 到 Gradle module、module root、test-fixtures provider
root/package 的封闭映射；未知 owner 与路径碰撞分别稳定失败
`BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED`、`BACKEND_ACCEPTANCE_PROVIDER_PATH_COLLISION`。

### S-02｜consumerFace 只有存在性，没有 typed schema

`CONFIRMED`。整改为三项封闭枚举：`CONSUMER_CONTRACT_REGENERATED`、
`CONSUMER_UNAFFECTED`、`CONSUMER_BREAKING_ACKNOWLEDGED`，每项都有必需 digest/compatibility/
authority evidence；自由文本、“稍后处理”、未知枚举、缺证据或 PENDING 全部红。

### N-01 / N-02

`CONFIRMED_CLOSED_BY_ABOVE`。provider 延迟物化规则已由 S-01 映射闭合；571/128/443 是复算后的
唯一 checked-in Java 口径，另保留 compiled-main 616/129/487 口径且不混用。

## 2. Dexter 新增的实施可执行性要求

后续 implementation agent 不得依赖本会话或一句“历史问题回放”。已新增机器可读、逐 source
SHA-256 绑定的
`doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`，明确列出：

- 6 条 CONNECTION 回归，其中 `getOperationsCatalogItem` 为 561→1309，其余五条分别为 6→9、
  12→24、12→16、6→12、6→12；六条只允许 `REGRESSION_ADDED`；
- 15 个 operation 级 HTTP failure family：asset staging、platform admin create、invitation
  credentials、store create、workspace accounts、invitation OTP、commercial-group initialize、
  group-workspace create、region create、invitation readback、operations session、invitation reissue、
  catalog workbench、catalog item save、operations workspace login；每行含原 HTTP signal 与 run
  manifest hash；
- 8 个 seed/client/fixture family：revision、schema、bootstrap context、owner chain、expired
  invitation fixture、display-name readback、canonical BOM target、product-SKU owner ref。

BA-U02 为该 catalog 建 exact-set validator 与 implementation disposition artifact；BA-U05 按 owner/
operation 逐 findingId 根因分析并提供 fresh route evidence；BA-U06 在退役前要求 6+15+8 全部闭合。
第 25 类真实 red mutation 拒绝少行、多行、性能行伪装已覆盖、自由文本或陈旧 proof。

历史报告只证明“曾经发生且必须处置”，不自动证明当前仍有 bug。HTTP/non-route 行可在证据充分
时判 seed/fixture-only，但仍必须给 owning source、affected route exact set 与 fresh
CONTRACT/BUSINESS/CLEANUP proof。seed 总耗时和后来的 seed PASS 均不能充抵。

## 3. 修改面

- `doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md`
- `doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md`
- `doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-granularity-manifest.json`
- `doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`
- `contracts/policy/backend-acceptance-execution-contract.json`
- `doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md`
- `project-memory/operations/backend-acceptance.md` 与 required inventory/generated index
- `.agents/skills/cs-managed-runtime-execution/SKILL.md`、`cs-spec-to-plan/SKILL.md`、
  `cs-systematic-debugging/SKILL.md`

## 4. 边界

本整改仍是静态 implementation-facing DESIGN。未实现 production validator/runner/scenario，未运行
Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL，不构成任何动态、业务、
performance 或 cleanup 结论。该段记录 Round 1 整改时的边界；Round 2 已取得 GO，最新实施暂停
裁定见 §5，禁止据此激活 implementation package。

## 5. Round 2 定向复核 intake 与最终设计整改

- reviewCycleId: `BACKEND_ACCEPTANCE_DESIGN_20260813`
- reviewRound: `2`
- reviewRoundLimit: `2`
- roundFinalDecision: `SELF_DECIDED`
- reviewSource: `doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-round2-claude.md`
- reviewSourceSha256: `1d1fc0ef26eae133fb3661d76622fb67570ce3959d0cb531ee150f3d6213becb`
- incomingVerdict: `GO (M=0 / S=1 / N=2)`

### S-01｜六条 PERF finding 的联合收口语义

`CONFIRMED`。独立按 catalog 的 calls/before/after 重算：DBCR 前六条均为每调用
`CONNECTION=3.0`、`TRANSACTION=4.0`；之后均为 `TRANSACTION=2.0`，而 CONNECTION 分别变为
`4.5/6.0/4.0/7.0/6.0/6.0`；QUERY 分别为 `7.5/9.0/7.0/10.0/9.0/9.0` 且前后完全相等，
UPDATE 均为 0。复算未使用 seed 总耗时或评审自报结论。

task-read policy 与 source inventory 又将六条逐项绑定至
`CatalogInventoryCoordinator#readCatalogWorkbenchContext/readCatalogNavigation/readCatalogDictionary/
readCatalogItem/readCatalogItems/readInventoryTargets`。当前六方法均无 `@Transactional`，bindings 与
inventory 均声明 `OUTSIDE_TRANSACTION`；workbench/items/item/inventoryTargets 还继续进入同一
coordinator 内各自不同的 enrichment helper。故“先审查共同 coordinator/task-read/基础设施边界，
而非六个 endpoint 单点修补”成立；“六条已共用一个可单点修改的 enrichment 方法”则不成立。
是否恢复事务、公共开销究竟位于 fact loader/interceptor/owner read 哪层、以及如何减少 QUERY，仍
必须由 fresh route measurement 和 owning source 决定，设计不预写答案。

整改落点：

- catalog 每行新增 perCallBefore/perCallAfter，regression 明示 TRANSACTION 减半；
- performance disposition 增加 QUERY/CONNECTION/TRANSACTION 三项同时不高于 DBCR 前每调用
  baseline 的机器判据；
- 恢复 read-only transaction 仅允许 `CONNECTION_ECONOMY_ONLY`，且本身不构成收口；默认
  READ COMMITTED 下的稳定快照/读一致性理由被封闭拒绝；
- 每条必须是 `QUERY_REDUCED_TO_<n>` 加 mergeMethod/owningSource，或
  `QUERY_ALREADY_MINIMAL` 加逐 statement necessity/owningSource；
- 范围锁定 `BA-HIST-PERF-001..006`，DBCR 继续
  `TERMINATED_BY_DEXTER_SCOPE_REFRAME`。

### N-02｜non-route affected route 推导

`CONFIRMED`。requiredEvidence 新增 `affectedRouteDerivationMethod` 与
`affectedRouteDerivationOwningSource`，method 使用封闭枚举；只有 route 集合而无 source-derived
推导证据必须以 `BACKEND_ACCEPTANCE_HISTORICAL_AFFECTED_ROUTE_DERIVATION_INVALID` 红。

### 当前授权边界

Round 2 的 DESIGN GO 与裁定已闭合设计方向，但 Dexter 最新要求是“先完成设计整改，先不进入实施
阶段”。因此当前设计包保持 `implementationAuthority=false/runtimeAuthority=false`，不激活新包，
不运行任何动态环境；后续实施需 Dexter 新的明确指令。该最新边界覆盖先前的条件自动激活表述。
