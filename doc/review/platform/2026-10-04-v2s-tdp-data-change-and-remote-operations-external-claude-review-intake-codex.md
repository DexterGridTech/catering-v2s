# TDP 数据变化通知与远程运维 · Claude 外部评审 finding intake

```text
DOC_KIND=REVIEW_FINDING_INTAKE
DATE=2026-10-04
AUTHOR=Codex
REVIEW_TARGET=DESIGN_FINDING_INTAKE
SOURCE_REVIEW=Claude 经 Dexter 转交的 TDP 详设/计划静态复评
INTERNAL_DESIGN_CYCLE=已关闭；本记录不重开该 cycle
WRITE_SCOPE=本记录及当前 TDP 详设、实施计划的必要修订
DYNAMIC_VERIFICATION=NOT_RUN
```

## 结论与证据边界

Claude 外部复评原 verdict 为 `NO-GO`、M/S/N=`0/7/2`。本记录是主 agent 对 finding 的事实 intake 与已授权文档修订，不构成新的独立 verdict，也不替代任何设计复评。未修改正式需求和 owner 源码；未执行生成、编译、测试、verify、backend-acceptance、DEV 或其他动态运行。TDP 全部运行场景仍为 `NOT_RUN`；第三方依赖解析版本/官方版本依据仍为 `OPEN`。

已逐项重开正式需求、当前详设/计划、Runtime API、真实 Operations Admin 命令与 seed 入口；按 `project-memory/operations/claude-review-finding-intake.md` 由主 agent 完成本轮判断及写入。只对已确认的设计缺口修订 D/P。历史 `NO-GO 0/7/2` 仍对应原评审字节；不得把本文或局部静态核对宣称为整批 `GO`。

## Findings

### S-1｜topic type 数与 identity 实例数

- **分类：** `PARTIALLY_CONFIRMED`。
- **原位置/依据：** 评审指向 D §9a、§12 与 P CP-03；原文把 11 种 topic type 同时当作每 session 11 个 dirty identity 的上限。需求把本期 topic 描述为十一类，且精确详情身份按合同、区域、服务点分别实例化（R §4.1a，`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:342-359`）。完整快照也是集合返回，不是“一类恰一条”（同文件 §7.1，`567-590`）。
- **当前设计证据：** D 明确将 type 闭集与 identity 数分开，并把合法至少 12 个 identity 纳入 CP-03 验收；订阅与 dirty identity 的有限技术容量分别按完整响应 cardinality、单项字节上限和 session 内存预算推导（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:170,363-366`）。P 将该推导列为 CP-03 实现入口；契约无法证明有限合法 cardinality 时 CP-03 保持 OPEN（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:52-56`）。
- **判断/影响：** “11 种 type 就是 11 个 subscription/dirty identity”不成立；拒绝第 12 个合法详情会截断业务。需求同时要求资源有界，所以不能把技术容量删掉。当前尚无响应规模的有限仓内依据及可计算的 session 内存预算，不能虚构数值或变相施加业务限制。
- **最小修正与验收：** 已从 D/P 移除 11 identity 上限。CP-03 开始实现前，必须给出响应完整 cardinality 的仓内依据、identity 序列化最大值及 session 资源计算；先证明至少 12 个合法 identity 可订阅，再证明超技术资源界限时整项拒绝且不部分安装。若无有限合法 cardinality 依据，则 CP-03 保持 OPEN，不能通过另设业务数量限制绕过。
- **残留：** **OPEN（工程容量数值/有限响应依据）**；无需 Dexter 产品裁决，除非后续方案要限制合法业务实体数量。

### S-2｜精确 topic 时间来源

- **分类：** `CONFIRMED`。
- **原位置/依据：** 需求 §4.1a 明确精确 topic 直接读取权威实体原始时间；范围集合才用 collection hash/time（`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:344-346,348-359`）。旧 D 将 TDS 读路径限定为 snapshot，且初始化所有 topic 的 snapshot，与该要求冲突。
- **当前设计证据：** D CP-03 与 P CP-03 已拆成 3 类范围 snapshot、8 类精确 owner task query；后者只返回当前授权范围内实体原始时间，不读取业务正文。缺实体/越权是 typed not-found/denied；缺范围 snapshot 按初始化基线处理，而非一概拒绝（D `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:96-97,207`；P `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:51-52`）。
- **判断/影响：** 若精确 topic 依赖范围 snapshot 行，合法精确订阅会错误拒绝或强迫 owner 复制维护实体时间；违反单一事实来源。
- **最小修正与验收：** 已同步 D/P：三类集合读 owner snapshots，八类精确 topic 调 CBS owner 窄 task query；以精确 raw timestamp、跨 scope 拒绝、缺行 typed 结果及 DB 最小权限红例验收，不增加内部 HTTP 或业务正文读取。
- **残留：** 设计修正已落文档；尚无 owner 实现与运行证明，保持 `NOT_RUN`，不代表实现闭合。

### S-3｜集合缓存并发重算

- **分类：** `CONFIRMED`（设计并发闭包缺口）。
- **原位置/依据：** 需求要求原事实与 cache 一致提交、并发重算不得由旧集合覆盖新集合（`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:142-160,435`）。只依赖事务提交及后续 cache 写入排队，不能保护“snapshot 行尚不存在”时先查集合的交错。
- **当前设计证据：** D CP-02 在集合查询前增加按 owner schema 与完整 scope 的事务级 advisory lock；首次无 cache 行同样先锁；多 scope 按稳定 key 顺序取锁，并将版本/官方 API 核验留在 CP-02（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:96`）。PostgreSQL 15 官方文档将 `pg_advisory_xact_lock` 定义为等待冲突释放的排他事务级 advisory lock；该页仅证明 API 语义，实际运行/测试目标版本仍须在 CP-02 核实：[PostgreSQL 15 System Administration Functions](https://www.postgresql.org/docs/15/functions-admin.html)。P 增加缺 cache 行的双事务 barrier 用例：两事务新增不同成员，第二次集合查询须在第一次提交后，最终 hash/time 包含双方（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:45`）。
- **判断/影响：** 若无 cache 行时才尝试行锁，不能互斥首次集合查询；两个并发成员可能有一个不进入最终摘要，造成后续通知漏失。按 scope 做单一 PostgreSQL 事务锁是比通用锁框架更小的设计。
- **最小修正与验收：** 已写明锁必须早于集合查询，覆盖无 cache 行；以确定性 barrier 检查查询顺序、最终成员/hash/time 与异 scope 独立进展。实施前核实际 PostgreSQL 解析版本及官方 API；此轮未做数据库实验。
- **残留：** API/版本证据与 focused/acceptance 证明 `NOT_RUN`；若实际版本不支持所选 API，再在授权实现范围内核验替代，不把文档推论说成已验证。

### S-4｜数据库写失败时的持久状态承诺

- **分类：** `CONFIRMED`。
- **原位置/依据：** R 要求远程意图、过程、结果可观察，但持久失败本身不承诺可靠保存；存储不可用时不得假报已接受（`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:472-475,479-496`）。同一数据库首次 INSERT 未提交/失败时，不能保证再写入一条失败事实；已有记录 UPDATE 失败也不能使未提交结果成为权威状态。
- **当前设计证据：** D CP-06 区分首次 intent INSERT 失败（同步 typed refusal、绝不 NOTIFY/dispatch）、已存在记录结果 UPDATE 失败（不 ACK，只读最后已提交值）及读库失败（typed unavailable）；明确不承诺在同一不可用数据库持久化新失败（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:100,265`）。P 相同语义进入 CP-06 验收（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:76,90`）。
- **判断/影响：** 原文将“写失败也能持久查询新失败”当成可无条件满足的承诺，会诱发第二失败存储或假成功。
- **最小修正与验收：** 已拆分首次 INSERT、已有 UPDATE、读取失败三个用例，并断言 dispatch/ACK/可读状态分别符合上列事务边界；不新增第二存储。
- **残留：** 动态故障注入 `NOT_RUN`。如将来产品仍要求主数据库不可写时新增失败记录，需另作产品裁决；当前设计不承诺该语义。

### S-5｜TDC 已确认远程记录释放

- **分类：** `CONFIRMED`；已应用 Dexter 本次裁决。
- **原位置/依据：** R-15/16 要求确认丢失可重报、未获确认事实不能静默删除，具体释放策略须明确（`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:479-496`）。原 D/P 对 64 条限制只按未 ACK 计数，却未定义成功后本地正文释放，4 MiB 上界因此不闭合。
- **Dexter 裁决：** “允许 ACK 持久成功后释放；CBS 历史永久保留。”
- **当前设计证据：** D CP-06、场景、容量表写明只有 CBS ACK 已在 TDC 本地持久化后才删该条正文并释放 64 条/4 MiB 容量；ACK 丢失或本地持久化失败则原文继续保留和占额；CBS 已提交历史永久留存、无应用层条数限制（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:100,199,263-268,362,366`）。P 写明同一生命周期与 65 次连续成功确认的边界测试（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:76,124`）。
- **判断/影响：** 该裁决闭合了本地容量回收条件，不把本地清理扩展为 CBS 删除。
- **最小修正与验收：** 已同步详设/计划：连续 65 次操作均获持久 ACK 后，TDC 正文不累计超过界限；ACK 丢失或 ACK 本地写失败时原件仍在、仍占额；CBS 历史跨重启仍可查询。
- **残留：** 运行证明 `NOT_RUN`；此处没有新增未决产品选择。

### S-6｜Runtime late result 与请求关联

- **分类：** `PARTIALLY_CONFIRMED`。
- **原位置/依据：** R-13～15 要求保存操作身份、binding 身份、wire/local request 关联，晚到实际结果可更新未知事实，且绝不因重连重派（`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:466-487`）。只有“使用 Runtime dispatch/selector”不足以确定 late result 与 TDC 持久事实的连接。
- **现有能力：** `Runtime.dispatchCommand` 可带 `CommandDispatchOptions`（`apps/terminal/kernel/base/runtime/src/types/runtime.ts:43-64`）；Runtime journal event 有 `requestId` 且可订阅（`apps/terminal/kernel/base/runtime/src/types/journal.ts:5-13,46-52,95-100`）；可按 requestId 查询 `selectRequestExecutionView`（`apps/terminal/kernel/base/runtime/src/selectors/selectRequestExecutionView.ts:140-152`）。
- **当前设计证据：** D/P 已规定先持久化 remote operation、binding、wire requestId 与唯一 local requestId；dispatch 前订阅 journal 并过滤该 id，再以相同 id dispatch；只在匹配 late event 时 selector 读取实际结果并写回同一事实；结果终态/runtime disposal 退订；selector 记录过期或缺失则保持 UNKNOWN，不能重派（D `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:75,266`；P `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:76,90`）。
- **判断/影响：** reviewer 所指缺口成立于原设计；现有 Runtime API 给出最小关联入口，但静态接口存在不证明 TDC 实际 lifecycle 或持久化写回正确。
- **最小修正与验收：** 已明确上述单条 request 的接线。focused proof 要确定性触发 root timeout、actor late completion，验证同一 remote fact 更新、真实 result 可读、dispatch count=1；selector 已过期/不可用时仍 UNKNOWN。不得建立通用 ledger/recovery。
- **残留：** 实现与测试尚未发生，`NOT_RUN`；Runtime late event 到 selector 的实际 lifecycle 可行性仍待 CP-06 focused proof。

### S-7｜12 条 DEV 数据场景的可执行 oracle

- **分类：** `CONFIRMED`。
- **原位置/依据：** 需求 §7.1 明确要求 DEV-DATA-01～12 使用真实 Operations Admin 操作，并记录字段变化、topic、HTTP、TER selector/持久化和清理，不接受只列标题（`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:565-605`）。仓内 Operations Admin 已有相应 generated/client command，如门店编辑、合同与服务点命令（例如 `apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx:179`、`apps/frontend/operations-admin/src/features/store-management/ui/StoreStatusModal.tsx:31`、`apps/frontend/operations-admin/src/features/contract-management/ui/ContractInvalidateModal.tsx:28`、`apps/frontend/operations-admin/src/features/store-service-point/ui/StoreServicePointPage.tsx:168-180`）。
- **当前设计证据：** D 现列 12 项具体管理操作、合法改动字段/状态、预期 topic 和 owner/selector/持久 state 断言，并明确禁止移店/移区等新增业务（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:332-347`）。
- **判断/影响：** 单列场景标题不能复现输入，也不能证明数据最终到达 feature；成功通知或 HTTP 状态码不构成数据业务断言。
- **最小修正与验收：** 已将 12 项差异展开；保留公共 fixture/setup/cleanup，每项比对 CBS 前后字段及 raw timestamp、topic identity、终端真实 HTTP 类别、selector 和持久状态。后续动态阶段按该表逐行执行，不据本文宣称已执行。
- **残留：** 所有 DEV 场景 `NOT_RUN`；运行前仍须按当前 fixture 与接口字节复核字段可编辑性。

### N-1｜预算模式安排

- **分类：** `CONFIRMED`。
- **证据：** 实际预算模式变量为 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`（`scripts/generate/backend-performance-budget.mjs:450-456`）；验收入口只在 `--calibration` 下接受既有 batch cardinality 1/20/100（`scripts/test/backend-acceptance:179-187`）。`DEFERRED_UNTIL_CP05` 是文档状态，不是脚本模式。D 原已要求区分两者，P 未写顺序。
- **当前修正：** P 明确 CP-05 前预算相关项延后、预算无关门用真实 identity-only 环境值；CP-05 后按既有三种 cardinality 标定，更新 projection，再补预算红例及普通 validate-only/default verify（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:87-90`；D `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:115`）。
- **影响/最小验收：** 防止要求不存在的 CLI 模式或在标定缺项时伪报普通 verify 绿；实施按计划记录实际阶段输出。
- **残留：** 本轮没有执行任何门；所有模式结果 `NOT_RUN`。

### N-2｜当前 seed 输入来源

- **分类：** `CONFIRMED`。
- **证据：** `scripts/dev/r5-seed-plan.mjs:7-12` 读取 r5-full profile、fixture contract、store-terminal rules 与 catalog fixture catalog；profile声明完整组件与 fixture contract（`scripts/dev/profiles/r5-full.json:1-6`）；complete executor编排阶段（`scripts/dev/r5-complete-seed-executor.mjs:17-20`），owner executor执行业务 seed，terminal executor仅管理 terminal fixture（`scripts/dev/owner-command-seed-executor.mjs:14-21`、`scripts/dev/store-terminal-seed-executor.mjs:12-16`）。
- **当前修正：** D §10b.1 已列出上述当前来源、读取/编排责任及无 TDP 专属 fixture 的边界（`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:213-215`）。
- **影响/最小验收：** 避免实施时发明第二份 seed 真相或把终端绑定 fixture 当 TDP 实体来源；开 CP-02/06 前只复核漂移与新 fixture 责任，不在本详设期执行 seed。
- **残留：** 没有运行 seed；运行仍受单独准入与授权约束。

## 修订文件与未决项

- 已修改：
  - `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`
  - `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md`
- 新增：本 finding intake 记录。
- 未修改：正式需求、owner 源码、迁移、脚本、测试、依赖及任何运行配置。
- 未决：S-1 的有限合法响应规模/数值容量依据；S-3 锁 API 的实际解析版本官方核验；S-6 Runtime/TDC 运行期接线证明；所有动态验证和 cleanup。
- 本次仅有静态读取和文档修订；没有调用构建、测试、verify、DEV、seed 或 acceptance。
