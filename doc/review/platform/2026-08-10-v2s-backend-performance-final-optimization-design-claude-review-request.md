# Backend-performance final optimization design Claude review request

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-cycle2-review-round2.json

## 背景

本次是一次性覆盖当前全部 196 条后台 operation（113 COMMAND、83 READ）的 implementation-facing
详设。目标不是只整改当前数字，而是建立后续任何后台接口也必须遵守的数据库形态、事务起点、请求内事实装载
与可比较测量规范。详设固定了 196 条逐条源码阅读账本、复用抽象、静态/运行时门、分组 Testcontainers
正式产物、seed 前后比较，以及唯一串行实施与最终实施复核顺序。

独立 DESIGN 审查已依仓规完成一个两轮 cycle。Round 1 的两个实质 M finding（45 条 non-M1 声明类型被误作
物理 adapter 源码、Testcontainers fixture catalog 现有红门未纳入 BPF-U06）已修正；Round 2 只发现 manifest
对旧字节的机械 hash 漂移，按 round-two hard stop 不能再开第三轮。本次 manifest 用
`POST_REMEDIATION_V1` 机械重绑当前设计、目录与 196-row ledger，状态为
`DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，请 Claude 对当前字节独立复核。Claude
2026-08-11 recheck 曾判 `NO-GO (M=2/S=2/N=0)`；本次只收口其 M-01/M-02/S-01/S-02 与
Dexter 已裁决护栏，证据与处置在新的 remediation intake 中，尚未声称 GO。

## 评审目标

请独立确认该详设是否足以让一个后续 static implementation package 在不再要求 Dexter 中途授权、且不改变
HTTP 契约、owner 主权、幂等/CAS/审计/锁/授权复核/必要 readback 的前提下：

- 对 196/196 逐条有业务语义、现有源码事实、形态、预算/例外、验收与反走偏约束；
- 对未来 operation 缺 source inventory、shape/topology/budget、transaction origin 或 fact-loader 声明 fail-closed；
- 将 M1 的 68/68 binding edge 与全部 command 的单一 transaction origin 收口；
- 在 Testcontainers 以可合并分组而非 196 个孤立容器产出同口径正式可比较报告；全部通过后先运行拥有私有 fixture 的本机 managed L2，L2 business+cleanup 关闭后才允许显式 reset → DEV start → r5-full seed；
- 正确保留当前已知前置红门，尤其 BPF-U06 的 fixture catalog drift 与 BPF-U05 的 stale revoke read anchor，不把它们伪报为已关闭。

## 需阅读文件

- `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-requirements-claude.md`：Claude 独立复算的需求、分母、机制与地板定义。
- `doc/plans/platform/2026-08-10-v2s-backend-performance-final-optimization-implementation-design-codex.md`：项目记忆/门/Testcontainers、复用抽象、196 条和 BPF-U01..U06 的串行实施详设。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-command-operation-catalog.json`：113 COMMAND 的逐条约束。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-read-operation-catalog.json`：83 READ 的逐条约束与五个 protocol exemption。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-operation-source-read-ledger.json`：196 条逐项重新打开源码后的阅读证据；45 non-M1 adapter 仅为 declared type 的事实也在此显式登记。
- `doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-cur-anchor-rederivation.json`：45 non-M1 的确定性 edge-field 当前链重导、4 条差异及永久拒绝规则。
- `doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-design-remediation-intake.md`：对 M-01/M-02/S-01/S-02、GAP 和机制-C护栏的逐项处置。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-granularity-manifest.json`：六个 implementation unit、精确 change surface、POST_REMEDIATION_V1 绑定与 design-only authority。
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-cycle2-review-round1.json`、`doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-cycle2-author-intake.md`、`doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-cycle2-review-round2.json`：独立反证、逐项处置及第二轮 hard-stop 证据。
- `project-memory/decisions/http-crud-efficiency-design-redlines.md`：不可突破的 owner、事务、readback 与效率红线。

## 独立核验重点

1. 从 canonical binding、两个 per-operation catalog 与 source ledger 独立重算 196=113+83、五 command profile、78 task read+5 exemption；缺项、重复、以 declared FQCN 冒充物理 source 均必须可被识别。
2. 核验 BPF-U01 的独立 source inventory 是未来 source authority、shape matrix 只消费 inventory ID；核验 floor 是组件公式和超地板解释而不是全局数字 cap，两个 NO_CONTENT command 不会被错误拒绝。
3. 核验 BPF-U01/BPF-U02/BPF-U03：45 条 `cur` 是否以 edge 内声明 owner/protocol 字段调用重导，报告是否如实给出 4/45 差异且永久拒绝 app/edge 锚点；`mandatoryPerEditGate` 是否成为所有包必填、只能解析独立评审过的 closed profile、且 direct activation、active recovery、两类 compliance self-test 与 edge-codegen fixture 的有限模板分母均有兼容选择、不会误卡无关包；edge 无 transaction、每个 command 一 origin、68 declared binding 均至少一 HTTP entry 引用。loader caller 静态准入必须 fail-closed，但 `(runId, requestId, callSite prefix)` 多次装载仅能由 immutable snapshot 回溯证明，不能被虚称编辑时证明。
4. 核验 BPF-U04/BPF-U05：只允许 owner-local 等价折叠，不引入跨 schema 直读/宽 join；每一折叠是否强制记录 folded judgment、原语义、失败反例与保留证据；87 idempotency、45 readback 与 45 ORIGIN/JOIN GAP 是否在源改动前独立审完；READ 的预算继续是设计评审提示，非通用上限；五 exemption 仍留在分母。
5. 核验 BPF-U06：Testcontainers 不是 196 个容器，按兼容 profile/fixture group 执行却必须出具 196/196 operation 覆盖和 kind totals（尤其 UPDATE 不得下降）的可比较正式产物；正式顺序是 static → grouped Testcontainers → 本机 managed L2（私有 fixture、独立 manifest/cleanup）→ explicit reset → managed DEV start → seed comparison，且现有 `BP_FINAL_FIXTURE_PLAN_OWNER_HTTP_OPENAPI_DRIFT` 必须先修复和红验。
6. 核验授权节奏：实施 agent 可在合理、redline-preserving 范围内依据源码事实记录原因后直接继续，不再中途向 Dexter 求授权；但不授权新外部 HTTP/API、弱化门/正确性、未拥有进程，且动态仅能在静态及前序 managed evidence 都 PASS 后按固定顺序进行。
7. 核验五个既有邻接控制的处置是否明确（尤其 database-operation-budget 与新 shape gate 的边界、gate-dispositions 登记、authority-source-ledger/read-budget/fixture-catalog 的红债），以及 granularity checker 是否会拒绝不存在却标 update 的路径。核验本次 POST_REMEDIATION 没有新增实现授权、没有篡改历史审查结论，也没有绕开第三轮限制。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。finding 请按 `M` / `S` / `N` 列出精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品裁决。若 GO，请明确它只批准创建独立的 static implementation package；不能把本详设或既有静态证据表述为 Testcontainers、seed、L2/UAT 或性能数值成功。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次后台性能最终优化的 implementation-facing 详设。

背景：本轮不是只整改当前指标，而是一次性为当前 196 条后台 operation（113 COMMAND、83 READ）及未来后台接口建立数据库形态、单 transaction origin、请求内事实一次装载、owner-local 优化和可比较测量规范。详设包含逐条源码阅读账本、分组 Testcontainers 正式产物、seed 前后比较和最终本机 L2 顺序。独立 DESIGN review cycle 已完成两轮：Round 1 的两项实质 M 已修；Round 2 仅发现 manifest 使用旧字节 hash，按 hard-stop 不能有第三轮 Codex review，现以 POST_REMEDIATION_V1 重绑当前字节，需您独立 recheck。
目标：请独立核验当前字节是否足以约束 196/196 操作与未来接口、是否保持 owner/事务/幂等/CAS/审计/锁/授权/最终 readback 红线、Testcontainers 是否能以合并分组形成正式可比较 196 覆盖产物，以及实施授权和动态顺序是否不会走偏。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-requirements-claude.md：独立复算的需求、分母、机制与地板；
- doc/plans/platform/2026-08-10-v2s-backend-performance-final-optimization-implementation-design-codex.md：详设、复用抽象、门、Testcontainers 与实施计划；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-command-operation-catalog.json 和 doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-read-operation-catalog.json：113+83 的逐条约束；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-operation-source-read-ledger.json：196 条源码阅读证据及 45 条 non-M1 physical adapter gap；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-granularity-manifest.json：六个实施单元与 POST_REMEDIATION_V1；
- doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-cycle2-review-round1.json、doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-cycle2-author-intake.md、doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-cycle2-review-round2.json：两轮独立审查及处置。

请重点独立核验：196 的 exact-set 与 future fail-closed source/shape admission；事务 origin、68/68 binding reachability 和 loader-once 的静态/immutable-snapshot 判定；floor 公式不是数字 cap；owner-local optimization 不跨 schema；Testcontainers 可合并执行但仍产出 operation/profile/UPDATE 可比性，且必须先修当前 fixture catalog drift；随后 local L2 必须使用自身 fixture/manifest 而不消费 seed，seed 只能在 L2 关闭后显式 reset→managed start 执行；以及 post-remediation 是否只是机械重绑、没有绕过 Round 2 hard stop。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO 仅允许创建一个独立的静态 implementation package，并按本文的 BPF-U01 至 BPF-U06 一口气完成实施；实施 agents 在合理、redline-preserving 范围内可记录原因后直接实施，无需中途再向 Dexter 申请授权。它不授权新外部 HTTP/API、弱化正确性或门、未拥有的进程，也不授权在 static 与前序 managed evidence 未 PASS 前运行 Testcontainers、reset、seed、L2/UAT、部署或作出 SQL 性能数值成功声明。谢谢。
```
