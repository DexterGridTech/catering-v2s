# `ui.base.render` DESIGN 独立对抗审查输入清单（round 2 final）

```text
REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
cwd=/Users/dexter/Documents/workspace/idea/catering-v2s
CONTEXT_MODE=DETERMINISTIC_ONLY
AUTHORIZATION=仅复核 S-6 补测与 ui.base.render IA/详设/实施计划；不授权 render implementation、DEV、seed、reset、L2、UAT、部署或仓库控制动作
BLIND_REVIEW=先独立重读第1-3节，形成最终 round-2 findings/verdict；之后才读取第4节作者材料
```

## 1. Round-1 冻结的完整输入清单

先读全文：
`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-input-checklist-codex.md`
（SHA-256=`73f0159545a02572257ee2105d8e13e23304e2f2f51d29270ad19ec5d7ba8f18`）。然后逐项重开该清单第
1–4 节列出的 AGENTS、Blueprint、Roadmap、六个 memory kernel、规范、decision、requirements、POC、
ui-state/runtime/render owning source、S-6 source/tests/harness 与当前 render 骨架；以该清单记录的 path/hash
及当前文件字节为准。其第 5 节旧作者材料不属于 round-2 独立阶段。

## 2. 本轮设计目标输入（独立阶段必须读取）

| 路径 | SHA-256 | 读取要求 |
|---|---|---|
| `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md` | `daf142eb5b36bb742c9539978a5f5a97dabcc54c770a923840233b3163923365` | 全文；四个 IA-ID、current-source precedence、tier 技术约束、README 分母 |
| `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md` | `63f977dbef555a01c4140a546be9641bd4d32fac5d7e402228433b50e20327ae` | 全文；当前 contract、binding canonical shape、T/R、CP 与边界 |
| `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md` | `8caac0b44a0563f426d116f25d2337cbb3ab4d14cfe86507ca4006ce1aeac439` | 全文；CP 顺序、未来 README、public denominator、red vector |
| `doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-design-codex.md` | `c0b17fbb8f8478b0b5f29af3630f73f8c2e27c184a6f1cbb4c09cfff50cadb2d` | 全文；S-6 实际公开形态与 proof 边界 |
| `doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-plan-codex.md` | `600db1dd0a123a5257998178fad215cfe164cff8d3f662a7bc19acf099329e17` | 全文；S-6 测试/红向量范围 |

round-2 reviewer 必须直接以当前 source 核对已变更的设计/计划 hash，不采信任何前一回合摘要。

## 3. 独立阶段要求（本节完成后先写最终 verdict）

1. 站在“找出修订后的 IA/详设/计划为什么仍不成立”的立场，逐条核验 round-1 的 M-1/M-4、S-2/S-3/S-4/S-5/S-6 是否真的关闭，并主动扫描重写引入的新矛盾。
2. 重点核验：current source precedence 是否消除双事实且无兼容层；`standard`→`alert` 是否只是技术排序；`RendererBinding` 具名 generic、默认/显式 undefined、canonical ownKeys 是否唯一可实施；3+13=16 public export denominator 是否对齐当前 index/invariant 计划；T-10 是否覆盖 S-6 消费侧七项；TR-10 README 是否进入 future implementation denominator；所有 T/R、T-13/R-19 双 production red vector、五类 fallback、provider 三件套、L2/un-enforceable 边界是否可证伪。
3. 每条 finding 标记 `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`，给精确 path/line、反例、最小修复与适用边界；不把设计推论、S-6 output 或 future command 写成 render 已实施证据。
4. round-2 是本 cycle 最后一轮，必须写 `ROUND_FINAL_DECISION=SELF_DECIDED`，不得召集第三轮。

## 4. 作者材料（仅在独立 verdict 之后读取）

| 路径 | SHA-256 |
|---|---|
| `doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-independent-review-r1-codex.md` | `12452e849e1255706e38086a91889c9e884cc3b6c57ceccdd7b5104f7c1acc10` |
| `doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md` | `d25f22514b94680ec5c97bb1f8a3abb1f21e662f34d115eb6ce1edac8e049fdd` |

读取后在自己的 round-2 artifact 中逐条记录与独立 verdict 的差异；不得修改 source、requirements、IA、详设、
计划、测试或既有 review artifact。

## 5. Round-2 输出合同

review artifact 必须包含：

```text
REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path:doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-input-checklist-round2-final-codex.md,sha256:<fresh hash>}
blindReviewDeclaration=先读第1-3节独立形成最终 verdict，后读第4节作者材料
authorMaterialReadAfterIndependentVerdict=true
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=GO 或 NO-GO
M=<数量> S=<数量> N=<数量>
```

GO 只表示 design/plan 可交 review，不表示 render 源码、Vitest、React 行为或 L2 已通过。
