# TER 门缺陷整改与 workspace scoping 详细设计评审请求（Codex）

```text
REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
REVIEW_TARGET=DESIGN
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
IMPLEMENTATION_AUTHORITY=false
```

## 背景

TER 21 道现役门的缺陷登记经两轮需求 review 后收口，Dexter 授权 Codex 仅产出 D-1…D-14、D-20…D-24 与 workspace scoping 的详细设计和实施计划。D-15…D-19 不在本批。本轮交付没有修改任何 `tools/`、`apps/terminal/` 生产源码、`skeleton-graph.ts` 或规范正本，也没有开始实施。

设计从实施视角对登记重新回源，发现并显式修正三处输入口径：D-22 是 20 个而非 19 个 consumer binding；D-13b 必须是 graph 与 package identity 的合法同步增删而非 graph-only；D-7 实际是四态，且端口保留 `clear` 与 state 禁用它并不矛盾。另登记 display-context owning requirement 仍残留与后续 Dexter 裁定相反的旧句。

## 评审目标

请先从当前源码独立重建现役门、合法演进路径与行为证明边界，再评审设计是否用最小代价完成三件事：

1. 把 AST 能精确证明的事实变成 fail-closed、可定向变红的门；
2. 把重启、PortResult、role effect、workspace 隔离等语义交给真实 focused behavior tests；
3. 对机器无法一般性证明的数据流和产品/架构判断明确标成 `UNENFORCEABLE_BY_MACHINE`，而不是建设全程序分析器或冒充 machine PASS。

重点判断问题是否成立、方案是否比逐门正则补丁更简单、实施成本与当前阶段是否相称，以及计划是否具体到实施者无须自行发明关键判断。

## 需阅读文件

- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md`：已收口的缺陷事实与验收判据；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md`：本轮详细设计；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md`：CP-G0…G11 实施计划；
- `doc/platform/terminal-coding-standard.md`：TR-01、TR-02、TR-03、TR-05、TR-09、TR-10 正本；
- `tools/terminal-skeleton/`、`tools/terminal-contracts/`、`tools/terminal-platform-ports/`、`tools/terminal-state/`、`tools/terminal-runtime/`：现役门与 fixtures；
- `apps/terminal/skeleton-graph.ts`、`apps/terminal/kernel/base/contracts/`、`platform-ports/`、`state/`、`runtime/`：真实被约束源码与测试；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/operations/terminal-coding-standard.md`：TER 路由记忆。

## 独立核验重点

1. 不采信设计的数字，独立复算 D-8 的 `12/312/25/120/457`、D-22 的 `20 consumers × 8 unions`、D-24 的 `ImportTypeNode 15/production 10/export-from 0`；尤其核 `RequestCommandSnapshot.status` 是否确为登记漏项。
2. 核 D-1/D-2 以 `moduleName.ts` 同址 `moduleKind` 加 symbol origin 是否是最小唯一 owner；第二包 scratch fixture 是否足以防止为 runtime 写特例。
3. 核 D-3 的“有限 AST + 六项具名例外 + 多跳 review”是否右尺寸，是否仍有满足门但任意 owner 写入的廉价绕过。
4. 核 D-4 从 package scripts 动态派 owner、runner 产生 marker 的设计，能否同时允许合法新增 owner并拒绝只 echo marker；Vitest/Jest 两 runner family 是否遗漏真实测试形态。
5. 核 D-5 的 readonly `{getState}` facade 与 effect-return-actions 是否改变现有 effect 间语义；action 顺序与 role state 写入完成点是否清楚。
6. 核 workspace scoping 是否正确复用 RTK/state runtime，仅建 workspace 一轴；9 条错误和真实 store isolation 是否真正证伪 silent cross-scope write。
7. D-6 是不可逆退役：核“两种独立重启行为同时红、同时停用才绿、真实树恢复后才删门”是否足够，是否还存在退役净损失路径。
8. 核 D-7 四态事实纠正与 receiver symbol 绑定；机器门只证明不直接丢弃、四态由 behavior tests 接管的边界是否诚实。
9. 核 package-local `terminal-invariants.json` 是否成为合理的 package owner，还是另一套会漂移/冻结功能的过重控制面；中央工具迁移后是否真的不留 312 名单副本。
10. 重点攻击 D-9：TypeScript 没有 friend module，`createStateRuntime` 返回 closure-local sync companion + 唯一 consumer gate 是否可实现、是否只是换名字公开任意 slice 能力；若不可行，请给更小替代。
11. 核 D-14 production/test seam 的 core factory 是否消除生产 closure 对 testing 的依赖，且不把所有 behavior tests 推到 test factory。
12. 核 D-13b 的修正：graph-only 必须红，graph+package identity 合法增删且 tools/tests 零代码改动才绿。判断这是否准确表达“动态分母”。
13. 核 D-24 五类统一 collector 的 API 是否足够给未来 D-16 复用、type-only dependency 分类是否符合 Yarn/TS 实际消费；确认本批没有偷偷提前实施 D-16。
14. 逐条审查详细设计 §10 的 `UNENFORCEABLE_BY_MACHINE` 表与 §11 red matrix：找出任何“判据全过但缺陷原样存在”的实现，或成本明显不相称的 fixture。
15. 核计划 CP 顺序、每步 focused proof、fresh 三维对账、整批对账和停机条件；确认 G1…G4 只形成 display-context 门阻塞出口，不掩盖其 owning requirement 旧句。

## 已知异议、未验证与裁决项

- Codex 对缺陷登记的异议：D-22 分母、D-13b 口径、D-7 状态数/`clear` 关系，均已在设计 §0.1 提供当前源码依据；请独立确认，不能因登记已收口而默认接受。
- `UNVERIFIED_REQUIRES_EVIDENCE` 仍有四类：所有 red 是否仅击穿目标门、共享 helper 是否改变其它工具行为、整改后真实树能否同时绿、D-20…D-24 最终可执行输出。计划 G0/G8/G10/G11 分别安排了闭合。
- 当前无产品/Journey 裁决项。D-9 若真实实现必须扩大 public surface，属于实施停机条件，届时才交 Dexter；不要在 DESIGN review 预先授予该扩张。
- 本轮只评设计文本，不应运行 DEV、seed、reset、设备、browser L2 或仓级 normal verify。若评审方选择运行只读/静态命令，必须把动态输出与静态判断分档。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 写明精确文件与行号、事实/推论/产品判断/未验证的证据档位、可证伪失败条件、最小修复，以及更小替代为何不足；涉及产品或 Journey 才标“需 Dexter 裁决”。

请声明 `REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01`、`REVIEW_ROUND=1`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`，并先盲审形成结论，再对照 Codex 的自查与异议。

## 结论授权边界

本轮 `GO` 只表示详细设计与实施计划可交 Dexter 决定是否接受并授权实施，不授权实际修改 `tools/`、`apps/terminal/`、`skeleton-graph.ts`、规范正本或需求正本，不授权 D-15…D-19、display-context 实施、仓级 normal verify、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER 全部门缺陷整改详细设计与实施计划。

背景：TER 全部门缺陷登记已经过两轮需求 review 收口，Dexter 现授权 Codex 仅产出了整改详细设计与实施计划。本轮 cycle 为 TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01，ROUND=1/2；请不要采信缺陷登记的最终措辞、Codex 的数字或自查结论，先从当前源码独立重建基线并以证伪为立场评审。

目标：评审范围是 D-1 至 D-14、D-20 至 D-24，以及 workspace scoping；D-15 至 D-19 明确不处置。请判断详细设计与计划是否成立、右尺寸且可实施。真实目标不是把门做得更复杂，而是让有限 AST 可证明的事实由机器精确判定，真实语义交 focused behavior tests，机器原理上证明不了的内容明确交独立语义 review。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md：缺陷事实与验收判据；
- doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md：详细设计；
- doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md：CP-G0 至 G11 实施计划；
- doc/platform/terminal-coding-standard.md：TER 规范正本；
- tools/terminal-skeleton/、tools/terminal-contracts/、tools/terminal-platform-ports/、tools/terminal-state/、tools/terminal-runtime/：现役门；
- apps/terminal/skeleton-graph.ts 与 apps/terminal/kernel/base 下 contracts、platform-ports、state、runtime：真实被约束源码；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md 与 project-memory/operations/terminal-coding-standard.md：TER 路由记忆。

请重点独立核验：D-8 的 12/312/25/120/457、D-22 的 20 consumer×8 union、D-24 的 ImportTypeNode 15/production 10/export-from 0；Codex 将 D-22 从 19 修为 20、将 D-13b 收窄成 graph+package identity 合法增删、将 D-7 改按四态且保留 clear 的三处异议是否成立；D-3 的有限 AST 加六项例外、D-4 的动态 owner 加 owned runner、D-5 的只读 facade 加 effect-return-actions、D-6 行为接管后退役、workspace 真实 store 隔离是否能被绕过；package-local invariant 是否过重；D-9 的 sync companion 是否真的能做到单一 consumer而未换名泄漏；D-14 的生产与测试 seam 是否隔离；D-24 是否为未来 D-16 留下唯一且足够的 collector；以及详设的 UNENFORCEABLE_BY_MACHINE 表、逐条 red fixture、CP 顺序和停机条件是否完整、右尺寸、可实施。

请特别构造“全部判据通过但原缺陷仍在”的实现。烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量；每条 finding 写清精确文件与行号、证据档位、失败后果、最小修复、更小替代为何不足，以及是否需要 Dexter 产品裁决。请声明 REVIEW_CYCLE_ID、REVIEW_ROUND=1、REVIEW_ROUND_LIMIT=2、reviewerKind=INDEPENDENT_SUBAGENT 与盲审输入清单。

授权边界：本轮只评详细设计与实施计划。GO 不授权实施，不授权修改 tools、apps/terminal、skeleton-graph.ts、规范或需求，不授权 D-15 至 D-19、display-context、仓级 normal verify、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。谢谢。
```
