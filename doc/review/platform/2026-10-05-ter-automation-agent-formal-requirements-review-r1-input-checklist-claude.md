# TER automation-agent 正式需求 · 第 1 轮独立盲审输入清单

```text
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_FORMAL_REQUIREMENTS_2026-10-05
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
SESSION=fresh 子 agent，由作者会话派发；工作目录为 catering-v2s 仓内（非续接会话、非它仓会话）
WRITE_SCOPE=仅本文件与同轮 review 文件；未构建、未运行测试/设备、未执行任何 git 命令
REVIEWED_OBJECT=doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md
REVIEWED_OBJECT_SHA256=2fdd117499093a6dcf81ce827c42e1dbf032497da36f268db5adc5e2cca012fb（shasum -a 256 复算，与派发值一致）
```

## 1. 最小输入逐项

| # | 输入 | 路径或命令 | 状态 |
|---|---|---|---|
| 1a | AGENTS.md 全文 | `AGENTS.md`（108 行，分段读完） | 已读 |
| 1b | CLAUDE.md 全文 | `CLAUDE.md`（随会话系统注入全文） | 已读 |
| 2a | Dexter 本轮指派原文 | “先不做spike了。请生成正式需求文档，并完成几轮对抗式review，最后自审上下文冲突和一致性问题”（派发 prompt） | 已读 |
| 2b | Dexter 裁定原文 | 被审对象 §0.2（第 24-36 行），并与讨论稿 §1、§7.1 对照 | 已读 |
| 3a | kernel 01 | `project-memory/kernel/01-workspace-and-authorization.md` | 已读 |
| 3b | kernel 02 | `project-memory/kernel/02-service-shape-and-owner.md` | 已读 |
| 3c | kernel 03 | `project-memory/kernel/03-transaction-data-and-dependencies.md` | 已读 |
| 3d | kernel 04 | `project-memory/kernel/04-contract-consumer-and-admin.md` | 已读 |
| 3e | kernel 05 | `project-memory/kernel/05-evidence-runtime-and-git.md` | 已读 |
| 3f | kernel 06 | `project-memory/kernel/06-heritage-and-change.md` | 已读 |
| 3g | 索引 | `project-memory/index.md` | 已读 |
| 3h | routed recall（design） | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face backend --owner platform --impact architecture --trigger review` | 已运行，命中见 §2 |
| 3i | routed recall（testing） | 同上，`--task-kind testing` | 已运行，命中见 §2 |
| 4 | 业务语料 | `project-memory/decisions/confirmed-business-language-corpus.md`（278 行） | 已检索，见 §3 |
| 5a | 被审对象全文 | 同上，第 1-400 行 | 已读 |
| 5b | 讨论稿全文 | `doc/plans/platform/2026-10-05-ter-ui-automation-requirements-discussion-claude.md`（395 行） | 已读 |
| 5c | `doc/decisions/` 全目录标题 | `ls doc/decisions/`（含 templates/） | 已列 |
| 5d | 独立子 agent 治理 | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | 已读 |
| 5e | 验证治理 | `doc/decisions/2026-07-24-v2s-verification-governance.md` | 已读 |
| 5f | 方案合理性策略 | `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | 已读（§1-§6） |
| 5g | 协作与控制边界 | `doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md` | 已读 |
| 5h | Roadmap 退役 | `doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md` | 已读（裁定、替代口径、保留清单、迁移） |
| 5i | 旅途权威 | `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md` §4（第 680-800 行，§4.1-§4.4a） | 已读 |
| 5j | 交互设计 | `doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md`（标题略读，断点一至七） | 已略读 |
| 5k | 相关在途批次（自行追加） | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md` §0、第 172/194/223/267/273 行 | 已读相关段 |
| 5l | 相关草案（自行追加） | `doc/plans/platform/2026-09-30-ter-rive-soft-keyboard-requirements-claude.md` 头部与 testID/命中段 | 已读相关段 |
| 6a | 四份模板 | `doc/decisions/templates/{journey-decision,ia-design,ui-interaction-design,implementation-design}-template.md` | journey 全文；其余按节标题与 §1/§3 第三方/§11/§11a/§12/§13 读 |
| 6b | 评审规范 | `doc/platform/review-standard.md`（动作 1-B、动作 2-5、§5 结论块） | 已读 |
| 6c | 终端编码规范 | `doc/platform/terminal-coding-standard.md`：TR-03、TR-08、TR-09、TR-16、TR-17（验证段）、§4-C、§4-F（feature 前提段）、§2-A/2-B 标题 | 已读 |
| 6d | 第三方库规范 | `doc/platform/third-party-library-usage-standard.md` | 已读 |
| 6e | 实施任务模板 | `doc/platform/implementation-task-template.md` | 略读（节标题） |
| 6f | review skill | `.agents/skills/cs-review/SKILL.md` | 已读 |
| 6g | 受管执行入口说明（自行追加） | `scripts/README.md` 第 264-280 行 | 已读 |

## 2. routed recall 命中与打开情况

design 与 testing 两次 recall 的并集（kernel 6 份见 §1）：

| 路径 | 打开 |
|---|---|
| project-memory/decisions/confirmed-business-language-corpus.md | 检索（§3） |
| project-memory/decisions/deterministic-context-only.md | 列入，未逐行展开 |
| project-memory/decisions/distributed-topology-is-not-current.md | 列入（与本对象无交集） |
| project-memory/decisions/http-crud-efficiency-design-redlines.md | 列入（后台 HTTP，非本对象） |
| project-memory/decisions/independent-subagent-adversarial-review.md | 以其 sourceRef 正本 5d 代读 |
| project-memory/decisions/owner-read-model-and-lifecycle-standard.md | 列入（后台 read model，非本对象） |
| project-memory/decisions/terminal-architecture-and-stack-rulings.md | 已读全文 |
| project-memory/decisions/terminal-build-order-and-batches.md | 已读全文 |
| project-memory/operations/terminal-coding-standard.md | 已读全文 |
| project-memory/operations/business-corpus-adoption-and-read-policy.md | 列入 |
| project-memory/operations/business-corpus-parked-domain-intake.md | 列入 |
| project-memory/operations/backend-readability-refactor.md | 列入（后台） |
| project-memory/operations/implementation-source-reread-discipline.md | 列入 |
| project-memory/operations/ui-testid-preflight-before-l2.md（自行追加） | 已读 |
| project-memory/practices/ter-input-and-virtual-keyboard-usage.md | 已读全文 |
| project-memory/practices/third-party-library-official-source-verification.md | 已读全文 |
| project-memory/practices/backend-capability-lookup.md、collection-boundary-modes.md、failure-condition-names-the-wrong-shape.md、ordering-only-for-consumer-facing.md、read-model-granularity.md、set-interaction-not-n-times-single.md | 列入（后台/集合形态，与本对象无直接交集） |
| project-memory/pitfalls/designing-from-conversation-not-system.md | 已读 |
| project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md | 已读 |
| project-memory/pitfalls/platform-detail-reverse-inference.md | 已读 |
| project-memory/pitfalls/browser-route-data-scope-drift.md | 已读 |
| project-memory/pitfalls/generated-output-and-static-gate-drift.md（testing 命中） | 已读 |

适用 sourceRefs 已打开：`doc/platform/terminal-coding-standard.md`、`doc/platform/third-party-library-usage-standard.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`、`doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md`。

## 3. 业务语料检索

检索词：`automation`、`自动化`、`selector`、`testID`、`testId`、`测试`、`终端`、`agent`。全部 0 命中。

结论：`NO_CORPUS_ENTRY_MATCHED`。本对象是测试基础设施，不引入业务术语；首个旅途沿用 sample 切片自有术语（staff-login、customer-welcome 等），不在 G-01～G-12 范围。

## 4. 源码亲验清单（只读）

`apps/terminal/kernel/base/runtime/src/types/{module,runtime,execution,journal,command}.ts`、`foundations/createCommandDispatcher.ts`、`application/createRuntime.ts`、`selectors/`；`ui/base/primitives/{src/types/types.ts,README.md}`；`ui/base/render/src/foundations/surfaceHost.ts`、`components/SurfaceRoot.tsx`、`SystemFailureBoundary.tsx`；`ui/base/input/src/components/VirtualKeyboard.tsx`；`ui/base/dev-host/src/components/testExpoApp.tsx`；`kernel/base/display-context/src/foundations/displayDevice.ts`；`kernel/base/platform-ports/src/types/device.ts`、`README.md`；`kernel/base/terminal-data-client/src/{features/slices/terminalDataClient.ts,selectors/selectTerminalDataClientState.ts}`；`adapter/android/dual-screen/{src/implementations/surfaceHost.ts,android/.../TerminalDualScreenModule.kt}`；`application/android/sample-terminal/{package.json,App.tsx,src/components/controlledKeyboardHarness.tsx}`、两个 App 的 `AndroidManifest.xml`；`ui/integration/sample-console/src/assembly/assembly.tsx`；`kernel/feature/sample-staff-session/src/features/actors/actors.ts`；全部包 `select*` 导出计数；全部 TER 源码 testID 计数；`apps/terminal/skeleton-graph.ts`；`tools/terminal-skeleton/{check-static,check-static.test,verify.test}.mjs`；`tools/terminal-sample2/`（含 `check-production-bundle.mjs`、`run-sample1-frozen-journey.mjs`）；`tools/terminal-topology/`；`scripts/test/ter-*`。

## 5. 盲审顺序声明

先读 AGENTS/CLAUDE、kernel、recall、模板与规范，形成独立预期后读被审对象与讨论稿，再逐条回源码亲验。本轮无作者 intake 或自审材料可读。
