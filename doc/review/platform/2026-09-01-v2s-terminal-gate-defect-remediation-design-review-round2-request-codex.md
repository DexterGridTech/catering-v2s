# TER 门缺陷整改与 workspace scoping 详细设计第二轮定向复核请求（Codex）

```text
REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEW_TARGET=DESIGN
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
IMPLEMENTATION_AUTHORITY=false
```

## 背景

TER 全部门缺陷整改详细设计第一轮 DESIGN review 已给出 `NO-GO（M=8 S=16 N=11）`。在完整 finding 交付前，Dexter 先冻结了三项会改变设计结构的裁定，并要求 Codex 优先修订，避免继续在将被删除的结构上返工：D-9 降级为软性规范且不建机制；整批与 display-context 解耦；D-5 移出阻塞批。另有两项结构问题同时处理：D-8 invariant 迁移必须早于合法分母变化，整批实施按单元 A/B 切小。

本轮仍是同一 DESIGN review cycle 的第二轮，也是两轮硬上限。当前详设与计划只完成上述三项 Dexter 裁定和两项结构修订；第一轮其余 findings 不得因为本轮文档变得自洽而被默认为闭合。请使用第一轮完整 review 结果逐条核验：已闭合的明确判闭合，仍未处置或出现新冲突的继续作为本轮 finding。第二轮结束后由 Codex 做辩证 intake 并按 `ROUND_FINAL_DECISION=SELF_DECIDED` 收口，不再发起第三轮。

本轮仍只交详细设计与实施计划，没有实施任何 `tools/`、`apps/terminal/`、`skeleton-graph.ts` 或规范正本改动，也没有运行整改命令。

## 评审目标

请先以当前仓内字节和第一轮完整 review 为基线，独立判断本轮结构修订是否真实消除了原冲突，而不是只换了措辞。重点回答：

1. D-9 是否真正退回“软规范 + 独立语义 review”，没有残留 companion、friend-module、unique-consumer 门、machine red 或 public-surface 伪证明；
2. D-1…D-4 的阻塞理由是否已经改成与任何具体 owner 包无关的演进事实，且没有继续拿未定稿的 display-context 需求作本批前置；
3. D-5 是否正确成为能力批的顺序优先项，而非阻塞下一个 owner 包；
4. D-8 是否在任何合法 export/consumer delta 之前完成一次性双读迁移，后续是否完全由 package invariant 求值，避免 G8/G/B 阶段必然撞上旧绝对数；
5. 单元 A/B 的实施切分是否足以把每次独立复核控制在可亲验规模，同时不把同一 DESIGN cycle 或步骤级三维对账错误重置/删除。

本轮不能只核上述五项。请把第一轮尚未处置的完整 findings 一并带入最终 verdict；尤其不要把计划中“尚未交付的第一轮完整 findings 到达后再 intake”的文字当成已闭合证据。

## 需阅读文件

- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md`：缺陷事实、验收判据及本轮被 Dexter 直接裁定取代的旧口径；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md`：修订后的详细设计，当前 SHA-256 为 `c4c9c5468b465f03a6817fcdec352ca0c2c4572d1e504ad40c8ca50cefa8927a`；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md`：修订后的单元 A/B 实施计划，当前 SHA-256 为 `9bd50913bfdaa2a00ea3db01b59d2e33e6044c475320220cc68db1f52c6589b7`；
- `doc/review/platform/2026-09-01-v2s-terminal-gate-defect-remediation-design-review-request-codex.md`：第一轮评审输入与当时被评方案；
- Claude 第一轮完整 DESIGN review 交付：本轮必须作为逐条处置基线；若该交付尚未落在仓内，请在本轮交付中先列明其实际路径，不得用本请求对第一轮 finding 的摘要替代；
- `doc/platform/terminal-coding-standard.md`：TR-01、TR-02、TR-03、TR-05、TR-09、TR-10 当前正本；
- `tools/terminal-skeleton/`、`tools/terminal-contracts/`、`tools/terminal-platform-ports/`、`tools/terminal-state/`、`tools/terminal-runtime/`：现役门、模型夹具与真实树入口；
- `apps/terminal/skeleton-graph.ts` 与 `apps/terminal/kernel/base/{contracts,platform-ports,state,runtime}/`：真实受约束代码和测试；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/operations/terminal-coding-standard.md`、`project-memory/decisions/deterministic-context-only.md`：适用项目记忆。

## 独立核验重点

1. **D-9 裁定闭合**：确认 `createStateRuntime` 返回形状、`StateRuntime`、`getStore/getState` 与两项 sync 方法都保持现状；详设与计划不得再要求 sync companion、runtime 自持、unique-consumer machine gate、相关 red fixture 或“扩大 public surface 才能实施”的停机条件。D-9 必须只落 TR-09 一句消费边界、README/HANDOFF 与 `UNENFORCEABLE_BY_MACHINE` checklist；exact public-surface 绿不得冒充 D-9 证明。
2. **D-9 权威冲突**：缺陷登记当前字节仍可能保留“从 StateRuntime 删除/仅 runtime 内部持有”的旧建议。请核详设 §0.2 是否清楚记录 Dexter 的直接新裁定并明确取代旧建议；若仍可能让实施者引用两段互斥文字各称正确，请判 finding，而不是自行挑一段执行。
3. **与 display-context 解耦**：全文确认不存在 `DISPLAY_CONTEXT_GATE_BLOCKERS`、display-context 开工前置或 owning requirement 更正停机条件。核 D-1/D-2 是 graph-model kind 硬编码导致任何第二 owner 包失败，D-3 是 owner actor 被包白名单误红，D-4 是新增 test owner 被冻结集误红；marker 应为 `NEXT_OWNER_PACKAGE_GATE_BLOCKERS=PASS`，且不授权任何下一个包。
4. **D-5 归位**：核 D-5 只以“避免二次迁移、让 D-3 exception 从 7 降至 6”进入单元 B 前部；单元 A 的 D-3 基线必须保留 7 项，不能提前按 6 验收。
5. **D-8 定序与 delta**：独立复算迁移时 `12/312/25/120/457` 与 closed-union `20/8`，确认这些数字只用于单元 A 的迁移当刻双读零差。workspace 合法新增 public export `+1`、D-5 合法新增 consumer binding `+2` 后，单元 B 应从 invariant 求值当前分母；任何后续完成信号或停机条件不得继续写死 exports=312 或 consumers=20。
6. **单元切分**：单元 A 只含 D-8 与 D-1…D-4，A 的独立 `REVIEW_TARGET=IMPLEMENTATION` 收口后才冻结 B；单元 B 含 D-5…D-14、D-20…D-24 与 workspace。两单元是实施切分，不重置本 DESIGN cycle；步骤级 fresh 三维对账是 AGENTS.md 硬约束，不能因切小而删除，也不能冒充正式 review。
7. **D-4/D-6 互相拆台**：核 D-4 owned runner 必须在单元 A 先稳定，D-6 才在单元 B 单独退役；D-6 的退出仍须由复数行为证明接管，不能因为 runner 迁移造成非目标红。
8. **第一轮其余 finding 不得消失**：请逐条重开第一轮完整报告。已知至少包括 workspace 判据可能空真通过、`toWorkspaceStateDescriptors` 名字检查可能同义反复、D-4 fail-open、D-22 只覆盖 33 个闭集 union 中的 8 个等；这些尚未被本次五项结构修订自动解决。若当前文档仍未闭合，请保留原 severity 或按当前后果重新判，不得因 Round 2 是硬上限而降级。
9. **右尺寸与可实施性**：核 A/B 切分后的每个交付仍可在半小时左右被逐项亲验；检查 D-8 的四份 invariant 与 shared helpers 是否仍可能形成另一套冻结控制面；找出任何“两个单元各自判据全绿但合起来原缺陷仍在”的路径。
10. **内部一致性扫描**：核所有 marker、CP 编号、缺陷归属、red 分母、停机条件、文件 ownership 与证据表是否随切分同步；特别找被否掉的 D-9 机制、display-context 前置、旧 G0/G8 绝对数、D-5 blocker 口径是否仍有残留。

## 已完成修订与尚未闭合项

- `CONFIRMED` 并已修订：三项 Dexter 裁定、D-8 迁移定序、实施按 A/B 切分。
- `PARTIALLY_CONFIRMED`：切小只解决交付可审阅性，不替代步骤级三维对账，也不代表第一轮其它 findings 已闭合。
- `UNVERIFIED_REQUIRES_EVIDENCE`：D-8 当前数字尚未在实施入口重新求值；A/B 的 red mutations、shared helper 非回归与真实树共绿均未运行；D-9 软规范只能由独立语义 review 证明。
- 第一轮除上述结构项外的完整 findings 尚未由 Codex 逐条处置。本轮 reviewer 必须据第一轮完整交付保留这些 OPEN，不得补写“全部已处置”的作者结论。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 必须写明精确文件与行号、事实/推论/产品判断/未验证的证据档位、可证伪失败条件、最小修复，以及更小替代为何不足；涉及产品或 Journey 才标“需 Dexter 裁决”。

请声明：

```text
REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
```

本轮必须由 fresh 独立子 agent 执行；先按当前字节和第一轮完整 findings 形成定向 verdict，再对照 Codex 的修订摘要。本轮后不得发起第三轮，也不得通过改文件名、拆 A/B 或更换 reviewer 重置 DESIGN cycle。

## 结论授权边界

本轮 `GO` 只表示修订后的详细设计与实施计划可交 Dexter 决定是否接受并授权单元 A 实施；不自动授权实施。`NO-GO` 也只阻断本设计作为实施输入。两种结论均不授权修改 `tools/`、`apps/terminal/`、`skeleton-graph.ts`、规范或需求，不授权 D-15…D-19、下一个 owner 包、仓级 normal verify、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 全部门缺陷整改详细设计与实施计划做同一 cycle 的第二轮定向复核。

背景：第一轮 DESIGN review 结论为 NO-GO（M=8 S=16 N=11）。在完整 finding 交付前，Dexter 先冻结三项会改变结构的裁定：D-9 降为软规范且不建机制；整批与 display-context 解耦；D-5 移出阻塞批。Codex 同时修订了 D-8 invariant 的迁移定序，并把未来实施切成单元 A/B。本轮为 REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01、ROUND=2/2、ROUND_FINAL_DECISION=SELF_DECIDED，必须由 fresh 独立子 agent 执行。当前只完成上述结构修订，第一轮其余 findings 不得被默认为闭合。

目标：请独立核验这五项修订是否真实消除冲突、是否右尺寸且可实施，并把第一轮完整报告里仍未处置的 findings 一并带入最终 verdict。请特别防止“文档结构现在自洽”被误当成“第一轮 8M/16S/11N 已全部关闭”。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md：缺陷登记及仍可能保留的旧 D-9 建议；
- doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md：修订详设，SHA-256 c4c9c5468b465f03a6817fcdec352ca0c2c4572d1e504ad40c8ca50cefa8927a；
- doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md：修订实施计划，SHA-256 9bd50913bfdaa2a00ea3db01b59d2e33e6044c475320220cc68db1f52c6589b7；
- doc/review/platform/2026-09-01-v2s-terminal-gate-defect-remediation-design-review-request-codex.md：第一轮输入；
- 你在第一轮产出的完整 DESIGN review：本轮逐条处置基线；若尚未落仓，请在交付中写明实际路径；
- doc/platform/terminal-coding-standard.md：TER 规范正本；
- tools/terminal-skeleton/、tools/terminal-contracts/、tools/terminal-platform-ports/、tools/terminal-state/、tools/terminal-runtime/：现役门、fixtures 与真实树入口；
- apps/terminal/skeleton-graph.ts 与 apps/terminal/kernel/base/{contracts,platform-ports,state,runtime}/：真实受约束源码；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md、project-memory/operations/terminal-coding-standard.md、project-memory/decisions/deterministic-context-only.md：适用项目记忆。

请重点独立核验：一，D-9 是否彻底删除 companion、runtime 自持、unique-consumer 门、machine red 与 public-surface 伪证明，只保留 TR-09/README/HANDOFF 软边界和 UNENFORCEABLE_BY_MACHINE checklist，且 getStore/getState 与 StateRuntime 现有形状不动；二，缺陷登记残留的旧 D-9 建议与 Dexter 新裁定是否已被明确消歧；三，D-1 至 D-4 是否只以“阻塞下一个 owner 包”组织，marker 是否为 NEXT_OWNER_PACKAGE_GATE_BLOCKERS=PASS，全文是否零 display-context 前置；四，D-5 是否只在单元 B 顺序优先，D-3 exception 是否严格从 A 的 7 降到 B 的 6；五，D-8 是否在所有合法 delta 前迁移，12/312/25/120/457 与 20/8 只用于迁移当刻双读零差，workspace +1 export 与 D-5 +2 consumers 后全部从 invariant 求值；六，单元 A 只交 D-8+D-1…D-4，A 的 IMPLEMENTATION review 收口后才冻结 B，且切分没有重置本 DESIGN cycle或删除步骤级 fresh 三维对账；七，D-4 owned runner 是否先稳定、D-6 后退役，避免同批互相拆台；八，第一轮其余 findings 是否仍 OPEN，尤其 workspace 空真、toWorkspaceStateDescriptors 同义反复、D-4 fail-open、D-22 仅覆盖 8/33 unions；九，是否仍有两个单元各自全绿但合起来原缺陷存在的路径。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 写清精确文件与行号、证据档位、可证伪失败条件、最小修复、更小替代为何不足，以及是否需要 Dexter 产品裁决。请在交付中声明 REVIEW_CYCLE_ID、REVIEW_ROUND=2、REVIEW_ROUND_LIMIT=2、ROUND_FINAL_DECISION=SELF_DECIDED、reviewerKind=INDEPENDENT_SUBAGENT 与盲审输入清单。本轮后不再发起第三轮，也不得通过切分单元或更换 reviewer 重置 cycle。

授权边界：本轮只评修订后的详细设计与实施计划。GO 只表示可交 Dexter 决定是否授权单元 A，不自动授权实施；不授权修改 tools、apps/terminal、skeleton-graph.ts、规范或需求，不授权 D-15 至 D-19、下一个 owner 包、仓级 normal verify、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。谢谢。
```
