# Roadmap 机制退役 · 实现静态复核（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取（本批无前端 UI；提取对象改为 agent 在会话中实际读到的控制面事实：hook 输出、agent-context 输出、kernel 断言、生成索引、残留检索）
VERDICT=NO-GO
M/S/N=0/1/5
L1_ENGINEERING=S-1；N-1 至 N-5
L2_USER_VISIBLE=NOT_APPLICABLE（本批不含任何 UI 字节）
L3_UNVERIFIED=空（没有用户可见 UI）；门级别的未验证项见 §5
SAME_ROOT_SCAN=见 §4
DESIGN_GAPS=新决定的保留清单漏登记两处 programId：contracts/policy/frontend-asset-carryover-manifest.json 第 4 行、tools/platform-boundary-gates/cli.mjs 第 14 行（见 N-5）
TEMPLATE_COVERAGE=NOT_APPLICABLE（IMPLEMENTATION）
EVIDENCE_TIER=仅静态回读；Claude 未运行任何门；Codex 自报的 build-index、project-memory、agent-lifecycle PASS 未独立复跑
SESSION=CONTINUED_SESSION（v2s 仓根，经上下文压缩续接，不是 fresh acceptance）
AUTHORITY=本结论只覆盖 Roadmap 退役涉及的治理、脚本、memory、入口与 active policy 字节；不授权任何修改或动态运行
```

## 1. 结论

退役的主体已经做对：
- 删除清单全部落实；
- 会话入口链不再指向 Roadmap；
- 新 kernel 与生成索引一致；
- 没有误改历史材料。

挡住 GO 的只有一处：两份入口文件仍写死会过期的后台验收范围。这恰好违反了新决定第 37 行自己立的规则，也是本批转交话术点名要改的一行。另外 5 条 N 都是一行级的残留。

我是先独立核完，再读 Codex 的独立审查报告。它第二轮给出 GO（0/0/2），但没有覆盖本文 S-1 与 N-1 至 N-5。

## 2. 已核实成立

- **删除**：以下路径在仓内都已不存在：
  - `doc/platform/roadmap-program-registry.json`
  - `doc/roadmaps/`（包括父目录）
  - `tools/roadmap-registry/`
  - `scripts/check/roadmap-program-registry`
  - `scripts/check/roadmap-control-plane-transfer`
  - `project-memory/operations/roadmap-control-transfer.md`
  - 旧 kernel `01-workspace-and-roadmap.md`

  说明：共享盘第一次用 `-e` 判断时，有两处因旧目录缓存误报“存在”。随后用 `ls`、`cat`、`stat` 与目录列表复核，确认都不存在。
- **入口链**：
  - `scripts/hooks/session-start` 只输出 4 个入口：`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`project-memory/index.md`、`scripts/README.md`。它与 `scripts/check/agent-lifecycle` 第 91 行的期望逐字一致，第 93 行的比较是整串相等，入口一旦改回就会变红。
  - `tools/agent-context/cli.mjs` 的 agent-context 与 working-set 两个命令都已不列 registry。
  - `scripts/hooks/prompt-route` 的记忆路由已去掉 roadmap 与 路线图。
  - `scripts/list` 已删除两个检查条目。
- **入口正文**：
  - `AGENTS.md`：恢复顺序改为“当前任务与授权只来自 Dexter 在会话中的明确指派”；第 57 行改为批次原子交付；旧第 64 行的 R1–R3 进度段已删；foundation、TDP、验证治理三行已去掉 R 编号，其中 foundation 由现状描述改成了条件规则。
  - `CLAUDE.md`：入口段、第 44、48、50、74、95 行同步改写。
  - `PLATFORM-BLUEPRINT.md`：末句的 Registry 已删。
  - 以下文件均已改好：`doc/platform/README.md`、`active-document-index.json`（Roadmap 两条）、`HANDOFF.md` 第 3、34、63 行、`scripts/README.md`（开头进度段、Roadmap 一节、Runtime 一节）。
  - 用 R 编号检索这些入口文件：只剩 `scripts/README.md` 的“R1 检查”（第 35 行已注明是历史冻结记录），以及“R4 verification”“R5 remote Testcontainers”两个能力标题，都不是进度状态。
- **记忆**：
  - 新 kernel `kernel.workspace-authorization` 有 4 条断言：`DEXTER_SESSION_AUTHORITY`、`EXPLICIT_EXPENSIVE_ACTION_AUTHORITY`、`BATCH_ATOMIC_DELIVERY`、`GIT_BY_DEXTER`；六个维度都是 all。
  - 7 个旧断言（`PROGRAM_SCOPED_CURRENT_ONLY`、`R1_ONLY`、`NO_R2_W1`、`PHASE_DUE_FAILS`、`PREPARED_IS_NOT_ACTIVE`、`ONE_STATE_OWNER`、`SOURCE_NO_POST_PASS_WRITE`）和旧 id，在 project-memory、scripts、tools、skills 与两份入口文件中零命中。
  - `required-inventory.json` 与 `index.json` 各 83 条，id 双向一一对应；新 kernel 的路径、断言、来源三方一致；`index.md` 已列出新 kernel。
  - 查询逻辑（`tools/project-memory/cli.mjs` 第 192 行）对 kernel 层一律返回，因此任意六维查询都会带出新 kernel，不可能再带出旧断言。这一条是静态推导，未实际运行。
  - `impacts` 词表已删 roadmap；`status-question`、`cutover` 仍有 3 条记忆在用，保留是对的。
- **skills**：四个 skill 的授权表述都已改为 Dexter 在会话中的明确指派。
- **历史材料**：晚于上一份评审修改的 `doc/` 文件中，属于本批的只有新决定、被取代决定开头新增的两行取代标注、两份 platform 导航和两份评审文件。另外两个历史 JSON 的改动是 store-terminal 并行批次的字段改名（`refs` 改为 `referenceKeys`），与本批无关，也不含 roadmap 或授权字样。
- **没跑到的门**：`scripts/verify` 首败即停（`tools/verify-gates/verify.mjs` 第 210 行），frontend-format 排第 6，后面的门都没在当前字节上跑过。静态核查结论是，这些门里没有会被本批改动打红的：
  - frontend-format 只检查 `apps/frontend` 与 `libraries/frontend`（根 `package.json` 第 30 行），与本批无关；
  - `handoff-debt` 只解析欠账表的行；
  - `foundation-standard-actions` 只查文件存在与可执行；
  - 没有测试钉住 skills 或入口文件的正文。

## 3. Findings

### S-1 · 入口文件仍写死会过期的后台验收范围 · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：
  - `PLATFORM-BLUEPRINT.md` 第 55 行写着“当前实现并运行 28 条真实场景，覆盖 IAM、ORG、商业合同、asset 与 Catalog”。这个文件是会话入口第 2 项，每次必读。
  - `scripts/README.md` 第 80–90 行列了 9 个业务域和 9 个 `*AcceptanceScenarios.java`；而 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/` 下实有 12 个，缺 `SalesMenu`、`StoreServicePoint`、`StoreTerminal`。
  - 新决定第 37 行规定入口文件不写会过期的进度、授权计数或场景条数；本批转交话术的验收第 3 项也点名了 `PLATFORM-BLUEPRINT.md` 第 55 行。`CLAUDE.md` 的同类句子已改（第 56 行不再列计数与覆盖域），这两处漏了。
- **影响**：本批要消除的正是这类误导。agent 读到入口会以为后台验收只有 28 条、5 个域，可能据此判断销售菜单、门店服务点、门店终端等域没有验收覆盖。
- **最小修复**：
  - `PLATFORM-BLUEPRINT.md` 第 55 行只保留规则，不写条数和域清单；
  - `scripts/README.md` 第 80–90 行不再逐个列举，改为写明规则：场景写在该目录下对应业务域的 `*AcceptanceScenarios.java` 中，由 `BackendAcceptanceScenarioCatalog` 自动发现。这句规则第 90 行已有。
- **为什么不更小**：只改数字，下个批次一加场景就会再次过期。

### N-1 · kernel/06 的来源指向了无关文件 · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：
  - `project-memory/kernel/06-heritage-and-change.md` 第 12 行的 `sourceRefs` 只有 Roadmap 退役决定，但那份决定没有一句关于 Heritage 的内容；
  - 它的三条断言（只读、不得 fallback、偏差新增 decision 不回写）在 `AGENTS.md` 第 49 行有原句。
- **影响**：检查器只校验来源文件存在，所以门是绿的；但沿着来源去核 Heritage 规则的人会找不到依据，“owning source”的约定形同虚设。
- **披露**：这是我上一版话术写了“sourceRefs 换成仍存在的 owning source（可用新决定）”，Codex 照做造成的。“可用新决定”对 kernel/06 不成立。
- **验收**：kernel/06 的来源指向确实写有这三条断言的文件，`required-inventory.json` 同步修改，index 重新生成。其余三条换过来源的记忆已核，成立：
  - kernel/01 的断言都出自新决定；
  - kernel/05 的 `NO_GIT_WRITE` 有新决定第 38 行支撑；
  - `deterministic-context-only` 保留了原有两份来源，新决定作为入口链变更的补充来源。

### N-2 · `scripts/list` 仍输出过时的 R1 状态 · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：
  - 第 5、12、16 行以“R1”作分组标题；
  - 第 26 行写着“R1 does not provide DEV, seed, reset, migration, application, or business-runtime commands.”，而 `scripts/dev/` 下早已有 seed 等受管入口；
  - 在 AGENTS.md、CLAUDE.md、scripts、tools、skills、hooks、doc/platform、project-memory 中没有任何地方引用 `scripts/list`，也没有门钉住它的输出。
- **影响**：影响面小，但执行它的 agent 会读到与现状相反的说法。
- **验收**：输出中不再有 R 阶段的状态描述。如果选择删除这个脚本，先确认确实没有消费方。

### N-3 · `scripts/README.md` 第 237 行的“七项”与实际不符 · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：该行写 `HANDOFF.md`“继续只保存冻结的七项生产化欠账”；但 `HANDOFF.md` 第 3 行写“十项”，`scripts/check/handoff-debt` 的 APPROVED 列表也是 10 行。本批改过这一行（删掉了 Roadmap 半句），计数没动。
- **验收**：去掉这个计数，或与 10 行保持一致。按新决定第 37 行，前者更好。

### N-4 · active 文档索引仍把已退役的矩阵标为生效 · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：
  - `doc/platform/active-document-index.json` 把 `contracts/policy/standards-coverage-matrix.json` 标为 `ACTIVE_ENFORCEMENT_TRACE`；
  - 但 `CLAUDE.md` 第 104 行和 `AGENTS.md` 第 60、67 行都写明它属于已退役的 compliance-control；
  - `doc/platform/README.md` 第 9 行正把 agent 引向这份索引。
  - 这不是 Roadmap 问题，但属于同族：本批改过的入口导航文件里仍把退役机制当作生效。
- **验收**：索引不再把已退役的控制标为生效。

### N-5 · 两处退役程序标识没有登记 · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：
  - `contracts/policy/frontend-asset-carryover-manifest.json` 第 4 行是 `"programId": "V2S_W0_W4_EXECUTION"`，即已退役的 Roadmap 程序标识；
  - 这份 manifest 虽有 edge-codegen、authority-source-ledger、verify-gates 读取，但 scripts 与 tools 中没有任何代码读 `programId`，它是一个没有作用的标签；
  - `tools/platform-boundary-gates/cli.mjs` 第 14 行同样是 `programId: "V2S_W0_W4_EXECUTION"`，它与第 15 行的 `roadmapStep` 同属一个冻结证据期望对象；
  - 新决定保留清单只写了该文件的 `roadmapStep` 和 r4 两个文件的 `roadmapStep`，这两处 `programId` 都没有登记。
- **验收**：在新决定的保留清单中登记这两处（platform-boundary-gates 可写成“整个冻结证据期望对象”）；manifest 的字段也可以在确认没有消费方后删除。

## 4. 同族全集扫描

- **S-1 与 N-3“入口文件写死会过期的范围或计数”**：扫了 AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、HANDOFF.md、doc/platform/README.md、scripts/README.md 与 6 个 kernel。
  - 问题成员：`PLATFORM-BLUEPRINT.md` 第 55 行（S-1）、`scripts/README.md` 第 80–90 行（S-1）、`scripts/README.md` 第 237 行（N-3）。
  - 已正确的成员：`CLAUDE.md` 第 56 行已修；`AGENTS.md` 第 83 行的“原 80 条约束”是规则的历史说明；`HANDOFF.md` 第 3 行“十项”与 10 行一致。
- **N-1“sourceRefs 替换是否指向真正的正本”**：共 4 个成员，只有 kernel/06 不成立，其余 3 个已核成立。
- **N-2“R 阶段状态句”**：只有 `scripts/list` 有问题。`scripts/README.md` 的“R1 检查”已注明是历史记录；“R4 verification”“R5 remote Testcontainers”是能力名；其余入口文件零命中。
- **N-4、N-5“退役机制的标识留在活跃文件”**：
  - 问题成员：active 索引中的 standards-coverage（N-4）；carryover manifest 第 4 行与 platform-boundary-gates 第 14 行的 programId（N-5）；
  - 已登记保留：r4 两个文件的 `roadmapStep`、platform-boundary-gates 第 15 行的 `roadmapStep`、`standards-enforcement-verify.test.mjs` 第 56 行的退役标签。

## 5. 未验证清单

- **静态已证**：
  - 删除清单；
  - hook 输出与期望逐字一致；
  - agent-context 的两个输出；
  - kernel 内容；
  - inventory 与 index 双向一致；
  - 残留检索；
  - 历史材料未被误改。
- **仅 Codex 自报、Claude 未复跑**：build-index、build-index --check、project-memory、agent-lifecycle 为 PASS。
- **无人验证**：
  - `scripts/verify` 在 frontend-format 之后的所有门都没在当前字节上运行；
  - `provider-free-context` 与 `foundation-standard-actions` 目前因与本批无关的 capability-invariants 依赖问题失败（Codex 的独立审查报告已记录），因此它们内部的 provider 红例、未知路由红例等检查，在当前字节上也没有运行结果。
  - 前面的静态分析表明本批改动不会让这些门变红，但这只是推导，不是运行结果。

## 6. 方案合理性

- **问题对不对**：对。每次会话都会读到的 kernel 和入口里写着过期、甚至自相矛盾的授权状态，这正是误导的源头。
- **方案优不优**：直接删除，授权以会话指派为准，不另建登记表，这是最简单的方案。把授权口径写进每次必读的 kernel，能防止 agent 再去找 registry。批次原子交付原则改写后保留，没有丢掉有价值的约束。
- **代价配不配**：配。改动集中在文档、hook 与记忆，运行期代码零改动。
- UI 自问：NOT_APPLICABLE，本批没有 UI。
- TR-16：NOT_APPLICABLE，本批没有改动 `apps/terminal`。

## 7. 下一步与边界

- S-1 与 N-1 至 N-5 都是一两行的修改，都不涉及产品或 Journey 语义，可由 Codex 在既有授权内直接修复。修复后，请把受影响的记忆条目重新生成 index，并重跑 project-memory 与 agent-lifecycle。
- 是否再交 Claude 复审，由 Dexter 决定。
- 本结论不授权任何修改、依赖变更、构建、动态环境或数据操作，也不覆盖与本批无关的 frontend-format 与 capability-invariants 问题。
