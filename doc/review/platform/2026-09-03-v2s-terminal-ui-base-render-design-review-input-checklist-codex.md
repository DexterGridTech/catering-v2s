# ui.base.render DESIGN 独立对抗审查输入清单

```text
REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
cwd=/Users/dexter/Documents/workspace/idea/catering-v2s
CONTEXT_MODE=DETERMINISTIC_ONLY
AUTHORIZATION=当前会话授权 S-6 补测与 ui.base.render IA/详设/实施计划；不授权 render 实施、S-6/S-7 再改、DEV、seed、reset、L2、UAT、部署或仓库控制动作
BLIND_REVIEW=先独立阅读下列输入、形成 findings/verdict，再读取作者材料与本清单的作者说明
```

## 1. 必读入口与授权

以下为当前会话已经重开的确定性入口；reviewer 必须逐项重新打开全文或指定位置，并以当前字节为准。

| 路径 | SHA-256 | 读取要求 |
|---|---|---|
| `AGENTS.md` | `5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6` | 全文；执行入口、授权、独立审查与已退役控制面 |
| `CLAUDE.md` | `5d6ca2f45578c8664b3e8f3743be17c99c1de9c67f764a1382cb89e2219e26c5` | 全文；Claude handoff 与 review 边界 |
| `PLATFORM-BLUEPRINT.md` | `b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7` | 全文；平台架构与依赖边界 |
| `doc/platform/README.md` | `b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80` | 全文；仓内恢复顺序 |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | 解析 `V2S_W0_W4_EXECUTION` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | 只读取保留授权字段；当前 task 授权以 Dexter 会话为准 |
| `scripts/README.md` | `339490510b06895704b7b0f806f44f8af95b93e917668044524614a9a9a42941` | 全文；命令与证据边界 |

当前 Roadmap 的解析结果：`PROGRAM_ID=V2S_W0_W4_EXECUTION`、`R3_DESIGN_AUTHORIZED=true`、`R3_IMPLEMENTATION_FACING_DESIGN_AUTHORIZED=true`；本任务的精确授权仍是本清单头部的 Dexter 指派，不由 Roadmap 的进度字段推导。

## 2. Project-memory 与规范

六个 kernel 必须全部阅读；本任务按 platform / terminal / UI toolkit / governance / review 维度执行 memory recall，并打开命中的原文及其 source refs。

| 路径 | SHA-256 | 读取要求 |
|---|---|---|
| `project-memory/index.md` | `bf361cf37d9383b86f3f67be9d97bc08c0be6bf2d38a9b245eae4df837d7f1a5` | 导航；不把 index 当规则正文 |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | 全文 |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | 全文 |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | 全文 |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | 全文 |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | 全文 |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | 全文 |
| `doc/platform/frontend-coding-standard.md` | `9bb6285436c92431d28610995264e6493799b7cad8129a88dbf975131311c1c2` | 全文；IA 与 React/共享 foundation 边界 |
| `doc/platform/terminal-coding-standard.md` | `4c9ce6804fc5629f5ab417d510951eaf0d0e66dac175086800bef5f2353a9ade` | 全文；TER 包/测试与命名边界 |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | 全文；盲审、输入清单、两轮上限 |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | 全文；red mutation 与证据分层 |
| `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md` | `c475ac4514281ddd2d2a66a2c66b85bf6804aa08b1e62775211cbcbe50958d44` | 全文；UI 资产/基础设施边界 |
| `doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md` | `afeafcf0373bbaaa921c1de7f9ac797af71d95f1540fe5953458ef8dbe63c991` | 全文；两 AI 与仓库控制边界 |

`doc/decisions/` 目录标题列表必须以当前目录重新生成并逐条复核；reviewer 还必须打开所有与 TER、frontend、React、verification、independent review、toolkit/owner、runtime/state contract 相关的 decision 全文。`contracts/policy/standards-coverage-matrix.json`、`scripts/check/standards-coverage` 与 retired compliance-control / implementation-design-granularity 不得作为本轮准入门；这是 `AGENTS.md` 的当前裁定，不是遗漏。

Confirmed business corpus：本包是 `toolkit`，不拥有产品 Journey、用户操作或业务文案；对 `ui.base.render`、`SurfaceRoot`、`LayerStack`、`ui-state`、`RendererCatalog` 检索若无业务 corpus 命中，记录 `NO_CORPUS_ENTRY_MATCHED` 及检索词，不得从 POC、接口或下游名称推导业务 Journey。`JOURNEY_INPUT=NOT_APPLICABLE_WITH_REASON`；`UI_INTERACTION_INPUT=NOT_APPLICABLE_WITH_REASON`；`GRANULARITY_MANIFEST=NOT_APPLICABLE_WITH_REASON:retired compliance-control`。

## 3. 被审需求与冻结输入

| 路径 | SHA-256 | 读取要求 |
|---|---|---|
| `doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md` | `28c3818e90988d0d8b34688efb1709c6f8d23d8a5953e685e944fcee5aca41f1` | 全文；重点核 current-source 漂移、五类 fallback、S-6/S-7、T/R 与范围 |
| `doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-analysis-claude.md` | `a520fb4f5be50e87b7a315d7f220615348fda5ad83dc4e42f6bffd1f1672b9cd` | 全文；未逐行 POC 区域与问题根因 |
| `doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-ui-state-requirements-claude.md` | `da02f4efdabf51b1d1c238d9886e39cd8f0048f2713216058ee31b93b87aa1fc` | 全文；S-7 当前契约与真实 consumer 接缝 |
| `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/u-01-runtime-react-claude.md` | `UNHASHED_INPUT_REQUIRES_READER_CHECK` | 全文；newPOSv1 POC 输入，reviewer 必须运行 SHA-256 后记录 |
| `doc/decisions/templates/ia-design-template.md` | `062925f8aa4b3446e06e74d8bad4166f3b3b3e8b18ebe403df7184acd5cd358f` | 全文；IA 可见/不可见维度与交叉对账 |
| `doc/decisions/templates/implementation-design-template.md` | `bcb84b77c0279d124cb2a5971a432d2d45e1c03157a465dcc7264161f2234fbe` | 全文；机制矩阵、声明—传递—消费矩阵 |

Heritage `_old_` POC 的实际路径由 analysis 文档定位；不得把 POC 行为当作当前需求的权威，只用于反证/差异核对。

## 4. Current owning source 与测试/门输入

| 路径 | SHA-256 | 读取要求 |
|---|---|---|
| `apps/terminal/skeleton-graph.ts` | `e092966d16fc2cd4f972ea8d04e4543965df42d0161ce35934d6cd154b8e5c66` | render kind、依赖与 automation owner |
| `apps/terminal/kernel/base/runtime/src/types/runtime.ts` | `9cc9678c43f5e238c9efc64ab394ac749ce29a495ba0f57e69fa284512ee118b` | current S-6 public shape |
| `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` | `e2184acb9f13c9adf579e886b66aa79a07d4510d090fc38526304c326664c11d` | status/getState/subscribe lifecycle |
| `apps/terminal/kernel/base/ui-state/src/types/catalog.ts` | `b9ceaa10a0474d2ec11fff9b9ea48607d3d85dbb064c58b197fce558c79b3a1e` | current `containerKeys` contract |
| `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts` | `d0d6965f9bf2a7bdbf3d880479dfa1c7efe8ff6c870a75a2d5f6a2188df3a096` | ownKeys, copy/freeze, empty-list asymmetry, includes |
| `apps/terminal/kernel/base/ui-state/src/selectors/selectContent.ts` | `08b21bd76da580aac2f77ab4767ddebe0a0f7a9b9945cadfd59548c5a8417fe2` | explicit displayMode selectors |
| `apps/terminal/kernel/base/ui-state/src/features/commands/showScreen.ts` | `d3eff68c52ab1ad16d22f86fd0cb0d3cc981778de5115d447ff8d04a9961fde1` | singular placement `containerKey` |
| `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts` | `0895da04ccdd86289edf351dca92f3eb9865b086a1745de1bcdf2f31e476ae2d` | direct placement write, no catalog lookup |
| `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts` | `60a33b1928d70a39e0c6d8678412a663332f8dd5b5a46673903bd23bb69c551a` | display/workspace derivation; render does not depend on package |
| `apps/terminal/ui/base/render/package.json` | `47c16b3c7a1ce349bdc64359d74c25984d0d86b401423394ab12e53924d11af5` | current three dependencies, peer React, typecheck-only script |
| `apps/terminal/ui/base/render/tsconfig.json` | `aa32b060a7cf2f29c3e600ee045a772e78baddaf9ac6eae999373ecbf5d4a355` | `.ts`-only current include |
| `apps/terminal/ui/base/render/src/index.ts` | `b7480428e0003f95ea3c03b84a1c5a5da1e2149155bd4626b408e1148b283962` | current empty public shell |
| `apps/terminal/ui/base/render/terminal-invariants.json` | `30b05b269ded5e3ac00140d1842dd8a6e89c1926112a765f212333fd129c1bf9` | current test kind ABSENT |
| `apps/terminal/ui/base/render/src/dependencies.ts` | `60ffba753bb35ccd5e11ce5fd83f6c2c81c8ae022d66c35a3d76ee18e1bbe3d5` | dependency graph |
| `apps/terminal/kernel/base/runtime/test/runtimeSubscription.test.ts` | `65e709c1c4d6b9ac1e69a1674fdd893f454d059b9790462c2786ef1cde2a07fc` | S-6 six runtime scenarios plus separate type proof |
| `tools/terminal-runtime/check-behavior.mjs` | `43b9c10ffaa78963ef0064b5f46152102e3d83d41c85354150603d0404a48bbc` | five production red mutations, timeout, dynamic baseline, cleanup |
| `tools/terminal-runtime/check-static.mjs` | `dc29ba5a4d7efc517daea15ab0450fc2ccf75fb7c1a86d0b517ed64980903241` | runtime static gates |
| `tools/terminal-runtime/check-static.test.mjs` | `d9bc5e8b45d2c68a9165c85f9088d36964c05f6042e0ca5d5ae62a4494f1017d` | runtime static model |

S-6 fresh evidence is part of the author material, not a substitute for source review: focused 1 file/6 tests PASS; runtime package 14 files/89 tests PASS; typecheck PASS; static/model PASS; baseline 6 tests PASS; five production mutations exit nonzero as expected; cleanup PASS. Reviewer must not treat these as render implementation evidence.

## 5. Author materials to read only after independent verdict

| 路径 | SHA-256 |
|---|---|
| `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md` | `ce10dd1eb29c22e5b831ab77c486090f96807ad1e2149155bd4626b408e1148b283962` |
| `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md` | `2b2c4d6fc450ab7c22177215414c8a0daa56b0be1f270becf6b1783c9b9923b9` |
| `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md` | `af37cb63b4c04d1ed086c9b62af78870510589b1aa10274c0b1fbe38c8e51b55` |
| `doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-design-codex.md` | `c0b17fbb8f8478b0b5f29af3630f73f8c2e27c184a6f1cbb4c09cfff50cadb2d` |
| `doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-plan-codex.md` | `600db1dd0a123a5257998178fad215cfe164cff8d3f662a7bc19acf099329e17` |

## 6. Reviewer instructions and output contract

1. 先盲读第 1–4 节（第 4 节精确结束于本文件第 92 行；第 5 节从第 93 行开始），站在“找出 render IA/详设/计划为什么不成立”的立场，独立写出 findings 与 provisional verdict；此阶段不得读取第 5 节作者材料、作者自评或任何既有 finding 处置。
2. 独立阶段必须回答：问题是否真是 toolkit 要解决的问题；窄 `stateSource`、`useSyncExternalStore`、双 catalog、五类 fallback、无业务 owner 是否比更小替代更合适；复杂度是否匹配当前阶段；S-6/S-7 current source 与需求稿历史文字如何处理。
3. 逐条核验：五种不可画结果是否语义/证据独立；status-first 与 `getState` 非 started 抛错；Runtime adapter 是否不泄漏 store/dispatch；`definePart`→ui-state catalog→renderer catalog 两跳；layerTier 稳定性；T-1..T-13、R-1..R-20 的反例可证伪性，尤其 T-13/R-19 是否真实跨包；`.tsx` 收集与新测试接线；un-enforceable/L2 边界；IA 与 implementation design/plan 一致性。
4. 每条 finding 标记 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`，给精确 path/line、反例、最小修复与适用边界；不要把静态设计推论写成运行证据。
5. 形成独立 verdict 后才读取第 5 节作者材料；在 own review artifact 中写出与作者材料的差异。reviewer 只能写自己的 review artifact，不得修改 source、requirements、IA、详设、计划或测试。
6. Review artifact 必须包含：

```text
REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path:doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-input-checklist-codex.md,sha256:<fresh hash>}
blindReviewDeclaration=先读第1-4节独立形成 verdict，后读第5节作者材料
authorMaterialReadAfterIndependentVerdict=true
VERDICT=GO 或 NO-GO
M=<数量> S=<数量> N=<数量>
```

本轮不授权实现与任何外部运行；不得把未来 plan 中的命令、历史 S-6 输出、静态门或 fake/focused 设计写成 render 已验收。
