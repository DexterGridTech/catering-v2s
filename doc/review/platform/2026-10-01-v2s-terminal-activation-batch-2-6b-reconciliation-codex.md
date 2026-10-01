# 终端激活与长连接 · 批次二整批 6b 对账

日期：2026-10-01。整批当前状态：`BATCH2_6B=MATCHED`，初轮 fresh 独立 reviewer `/root/batch2_6b_current_reconciliation` 给出 `M/S/N=0/1/1`；修复后 fresh 独立 delta reviewer `/root/batch2_6b_delta_recheck` 给出 `BATCH2_6B_DELTA=MATCHED`，`M/S/N=0/0/0`。本记录只作整批需求、详设/计划、项目记忆规范及当前证据的三维对账；不表示任何动态验收通过。

## 核验范围与初轮结论

Fresh reviewer 独立阅读当前需求、Journey、service-shape decision、共享协议、详设/计划、项目记忆及规范，并核对六个 CP 的对账证据和源码边界。除下面两项证据绑定问题外，reviewer 未发现 owner 边界、生成链、场景映射、远端拓扑、reset/seed 条件或 CP-06 出口中的三维矛盾。所有未运行的受管动态证明仍按计划标为 `NOT_RUN`，未被提升为 PASS。

### S-1 · CP-03 current-source manifest 漂移

- **状态**：`CONFIRMED`。
- **位置**：`.runtime/review/terminal-activation-batch-2-cp03-focused/current-cp03-source-sha256.txt` 第 108–109 行。
- **证据**：详设/计划摘要与当前文档字节不符。当前详设 SHA-256=`fdf3a26fe218e90ce509c6cbe65083df2f6a0e5f781aee37efdfa948a19ce485`；计划 SHA-256=`de4f22cc72aab1b0ebef89f1038370d20895e8107abe769ee7963d4a83f9a8f2`。变化源于本批已经授权的 CP-06 退出与 reset/seed 顺序修正，不是 CP-03 实现行为变化。
- **影响**：原 CP-03 `MATCHED` 无法证明其读取的是当前完整设计和计划字节；全批 6b 不能以旧摘要代替当前阶段核对。
- **最小修复**：只刷新两行文档摘要，保留全部其他条目；完成后 137/137 `shasum -c`，由 fresh CP-03 reviewer 重开当前阶段并核对三维一致性。
- **主 agent 复核与处置**：确认。manifest 两行已更新；当前清单为 137/137 OK，manifest SHA-256=`8049e092ee8d28893d2f60f450a18f7c9b710b991cd3fe397f073fc26839d25d`。fresh `/root/cp03_manifest_recheck` 已复核并给 `MATCHED`。未修改生产代码、测试、需求、Journey 或产品语义。

### N-1 · CP-02 source manifest 混入生成日志

- **状态**：`CONFIRMED`；同根扫描扩展到同目录的四条同类输出。
- **位置**：`.runtime/review/terminal-activation-batch-2-cp02-current/source-sha256.txt`；此前计数与摘要说明见 CP-02 proof 和 R2 reconciliation。
- **证据**：原 manifest 实际 62 行，包含 server-config/state 各一条 `.turbo/turbo-test.log` 和 `.turbo/turbo-typecheck.log`。两份 test log 在阶段 review 后变化；两份 typecheck log 是空的生成输出。它们都不是源代码、fixture 或生成输入。原始运行 transcript 已分别保存在 `.runtime/review/terminal-activation-batch-2-cp02-current/` 并由 CP-02 proof 逐个列 SHA-256。
- **影响**：把可变构建输出混入源码身份清单，使无源代码变化的后续校验产生 false OPEN；也把“源码字节摘要”与“运行输出证据”两种身份混在一起。
- **最小修复**：从 source manifest 删除四个 `.turbo` 日志项；原始 transcript 继续作为单独 evidence files，不新建重复日志清单。通过条件：无 `.turbo/` 或 `.log` 路径，剩余每个 source/input entry 均校验通过。
- **主 agent 复核与处置**：确认。四行已移除；剩余 58 个 source/test/config/fixture/input 项全部 OK，manifest SHA-256=`559203eeb10a5e0cc4f05dd47c06d25289c7eb1c77b4877aa114bf0a3daa0f12`；`rg '\.turbo/|\.log$'` 对该 manifest 无命中。CP-02 R2 review 曾把条目数记作 137，实际文件是 62 行；报告已更正该计数。fresh `/root/cp02_source_manifest_recheck` 已复核并给 `MATCHED`。

## 主 agent 复核与 fresh 阶段复查

- CP-02 source manifest repair 由 fresh `/root/cp02_source_manifest_recheck` 核实：58 条、manifest SHA 与上表一致、58/58 校验通过、manifest 与修剪生成输出后的 source/config/test inventory 无差异；`CP02_RECONCILIATION=MATCHED`，M/S/N=0/0/0。
- CP-03 document digest repair 由 fresh `/root/cp03_manifest_recheck` 核实：137 条、manifest SHA 与上表一致、137/137 校验通过；重新核对三包职责、endpoint path owner、CP-03 范围与当前设计/计划；`CP03_RECONCILIATION=MATCHED`，M/S/N=0/0/0。
- 两个 reviewer 均只读，未运行构建、测试或受管环境；两项修复仅改摘要与审查记录，无业务源码字节变化。
- 全批 6b 当前结论仍保持 `OPEN`，直到新的 fresh reviewer 对全部当前字节重新完成整批三维核对。6b MATCHED 前不启动任何整体动态验证或 reset/seed。

## 跨 CP 方案复核

初轮 6b 复核中下列事实未发现反例：

- `terminal-data-client` 独占终端凭证、激活/取消 command、TDS 业务协议及 selectors；`server-config` 持有地址/代理配置与其受保护代理秘密；composition 把 provider 注入通用 transport network adapter；transport 不解析 TDS 协议且不持有第二份终端凭证。
- TER 生成链由仓内 canonical schema 出发，经 materialize、edge-codegen 到 TER 生成包；仅 terminal activate/cancel 两请求允许未知字段，运营后台 DTO 保持严格。
- 场景映射包括 V-B15、V-S15、V-T 与 V-E 闭集；静态/focused proof 不代替真实 Node/HTTP/WS/DEV 行为。
- §3a N/A 不制造空分母准入；无 reset/seed 的 backend-acceptance 与 DEV 不依赖虚构 seed dry-run。任何 reset-only、seed-only 或组合动作均要求当前字节完整 `r5-full` dry-run PASS，reset 时 dry-run 必须先于 reset。
- CP-06 只含该阶段场景/runner/focused proof 和 `scripts/verify --validate-only`；default `scripts/verify`、全量 `terminal-verify`、批次动态、cleanup、13c 和最终 implementation review 都在 CP-06 退出后的批次级收口中。

这些条目还需随下一轮 fresh 6b 对当前字节再次核验；此处不是实现动态证据。

## 下一步

CP-02 与 CP-03 fresh 阶段 reviewer 已返回当前字节 `MATCHED`。下一步由新的 fresh reviewer 重做整批 6b。6b `MATCHED` 之前不启动默认 `scripts/verify`、全量 `terminal-verify`、backend-acceptance、DEV、reset 或 seed。

## 6b 第二次复核的增量处置（2026-10-01）

第二位 fresh 全批 reviewer `/root/batch2_6b_current_recheck` 确认先前跨 CP 结论无新增设计矛盾，但发现 CP-05 proof 内的哈希块仍是 CP-05 早期快照；CP-04/CP-06 后续修改了共享 runner、test 与计划文档，因此 CP-05 当前字节绑定失效。该 finding 为 `CONFIRMED`，影响仅为阶段证据与当前源码身份不一致，并非发现 runner 行为缺陷。

- 主 agent 已在 `.runtime/review/terminal-activation-batch-2-cp05/current-source-sha256.txt` 建立当前清单，覆盖 17 个 CP-05 runner、topology、测试、package/config、依赖锁和设计/计划输入；清单 SHA-256=`b975679c71de27614104d534ffc69d9b750ae3b39ce26cc22b235d2fd3e691dc`，`shasum -a 256 -c` 为 17/17 OK。
- 原 proof 已明确将旧摘要标为历史快照；新 proof 记录于 2026-09-30 23:55:54 UTC：runner/场景测试 30/30、catalog self-test PASS（5 项、zero-match red）、精确 Node composition Vitest 1/1 PASS。均为本地 focused proof，不冒充 DEV/远端运行。
- reviewer 的记忆路由缺口基于无效 consumer face `terminal`。`project-memory/required-inventory.json` 当前允许 `all`、`backend`、`operations-admin`、`platform-admin`；schema-valid 路由 `review/platform/backend/platform/evidence/review` 返回 33 条 memory refs。TER 专项 memory/标准另按 owning source 直接核读。无效路由不构成记忆内容缺失。
- 初轮 6b 发现的 CP-02/CP-03 问题仍以既有 fresh `MATCHED` 与已核验当前清单为准，本轮不重跑已完成阶段对账。待关闭项只有此后续发现的 CP-05 current-byte binding 与对第二次 6b 的增量独立确认。

fresh `/root/batch2_6b_delta_recheck` 已对增量独立核验并给出 `BATCH2_6B_DELTA=MATCHED`（M/S/N=0/0/0）。其确认 CP-05 清单 17/17 与当前 focused proof 关闭 stale digest；CP-05/CP-06 共用 runner 的后续改动已有对应场景闭包，不需重跑已 MATCHED 的 CP 阶段对账。记忆 consumer-face `terminal` 非当前 schema 值，合法 `backend` 路由有效，故不构成缺失。

**当前结论：`BATCH2_6B=MATCHED`。** 默认 `scripts/verify`、全量 `terminal-verify`、backend-acceptance、DEV、reset、seed 和 cleanup 动态结果仍是 `NOT_RUN`，按计划进入受管动态阶段。
