# TDP 全批 6b 三维对账

```text
TASK=TDP data-change and remote-operations
REVIEW_TARGET=WHOLE_BATCH_6B_RECONCILIATION
CP_SCOPE=CP-01..CP-06
VERDICT=MATCHED
REVIEWER_KIND=INDEPENDENT_SUBAGENT
```

## 独立结论

Fresh read-only reviewer `/root/cp02_final_fresh_review2` 对全批做了独立三维对账，结论为 `MATCHED`，未发现跨 CP `OPEN`。该 verdict 不是 CP 结果的汇总，也不覆盖其后的全量 verify、calibration、整体验收、DEV、Expo Web、13c 或最终 `REVIEW_TARGET=IMPLEMENTATION`。

## 三维与跨 CP 核对

- **需求维度：** 正式需求 R-01～R-20，与各CP覆盖范围、阶段边界及不变量闭合。
- **详设/计划维度：** 当前详设和计划与 CP-01～CP-06 阶段记录相符；CP-03 对认证/snapshot/raw-time 的数据库权限与 CP-06 对 terminal-control 对象建立后的权限验证阶段相符；CP-04 的 TDC 协议命令与 CP-05 的 `store-basic` 消费者职责边界相符。
- **项目记忆/治理维度：** 按 `AGENTS.md` 的全批6b要求独立复核跨CP偏移；阶段对账与后续整体验收、最终逐代码对账保持分离。
- **owner与数据链：** CBS mutation → 同事务 owner snapshot/raw time → 提交后 PostgreSQL wake-up → TDS窄数据库命令/真实WS → TDC command/selector → `store-basic` feature消费；远程命令结果经Topology peer wire回Runtime handoff，TDC仅更新仍存在且身份匹配的原map项。
- **授权与证据边界：** CP-06 最新 run `r5-tc-1791130381492-50744` 已核对 manifest、business、TDS contract 与 cleanup；未将该单场景 run 扩大为整批动态结果。其余未运行执行面继续保持 `NOT_RUN`。

## reviewer 核对的定位证据

- 需求阶段边界：`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md`。
- 当前详设/计划及 CP 顺序：`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`、`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md`。
- CP-01：`doc/review/platform/2026-10-04-v2s-tdp-cp-01-focused-proof-codex.md:328-330`，`MATCHED`；原记录的 `scripts/verify --validate-only` 未被升格为 PASS。
- CP-02：`doc/review/platform/2026-10-04-v2s-tdp-cp-02-reconciliation-codex.md:5-31`，`MATCHED`，含 legacy contract hook 与 STORE 双 topic 修复。
- CP-03：`doc/review/platform/2026-10-04-v2s-tdp-cp-03-reconciliation-codex.md:5-24`，`MATCHED`。
- CP-04：`doc/review/platform/2026-10-04-v2s-tdp-cp-04-reconciliation-codex.md:5-25`，`MATCHED`。
- CP-05：`doc/review/platform/2026-10-05-v2s-tdp-cp-05-reconciliation-codex.md:5-35`，修正 principal/bootstrap 后 `MATCHED`。
- CP-06：`doc/review/platform/2026-10-05-v2s-tdp-cp-06-focused-proof-codex.md:27-40`，focused proof 与阶段对账 `MATCHED`，最新 run 为 `r5-tc-1791130381492-50744`。
- 最新远端 run 原始记录：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1791130381492-50744/run-manifest.json`；实际命令 `backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.remote-command`。manifest 记录 selected business 1/1、`CONTRACT=PASS`、`BUSINESS=PASS`、TDS contract 3/3 与远端资源 cleanup `PASS`。

## 尚未由本对账证明

- 全量 `scripts/verify`、三次 `--operation all --calibration`、重新生成预算投影及最终 validate-only/default verify。
- 批次级全目录 backend-acceptance、DEV真实数据链、Expo Web场景和相应 cleanup。
- 最终 §13c 逐代码与详设对账、fresh 整批 implementation review。
- Android/VM/真机及TER adapter：本专项授权边界外，保持 `NOT_COVERED`；L2、reset/seed、UAT和部署未执行。

## CP-01 后续差量复核

CP-01 后续新增 terminal owner-read 的数据库不可用映射后，由 fresh 独立 reviewer `/root/tdp_6b_delta_review` 重新检查其对本全批结论的影响，结论 `MATCHED`。该改动局限于现有八个 terminal GET 的错误投影：`DataAccessResourceFailureException` 与 `TransientDataAccessException` 映射为已声明的 503 `PLATFORM_DEPENDENCY_UNAVAILABLE`，不改变其他 CP 的数据 owner、通知、订阅、权限、终端执行或缓存边界。reviewer 核对了当前 controller/test、CP-01 两个受管 run、CP-01 reconciliation 和 CP-02～06 的现存记录；未发现跨 CP 矛盾。

这次差量复核没有运行全量动态测试，不改变本记录的证据边界。全量 `scripts/verify`、标定、整体验收、DEV、Expo Web、13c 与最终实施 review 仍需各自取得当前字节证据。
