# TER automation-agent 正式需求 · 第 2 轮独立盲审 · 输入清单

```text
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_FORMAL_REQUIREMENTS_2026-10-05
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewedObject=doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md
reviewedObjectSha256=d96589865d83f6a31bebf0b994811e98371f19a7ff04cc84338096ae253cd982（shasum -a 256 亲算，与指派一致）
SESSION_PROVENANCE=fresh 子 agent，v2s 仓根内；静态只读（cat/sed/grep/rg/ls/shasum/recall-memory）；未构建、未跑测试/设备、未执行 git
```

| # | 输入 | 状态 | 备注 |
|---|---|---|---|
| 1 | `AGENTS.md`、`CLAUDE.md` 全文 | 已读 | AGENTS 日志红线、受管运行、资源预算、批次原子、半小时切小、两轮上限 |
| 2 | Dexter 指派原文 + 对象 §0.2 裁定 | 已读 | 五段裁定逐字核对；D-编号无法从现存讨论稿还原（讨论稿 §7.1 只记结果），已按结果比对 |
| 3a | `project-memory/index.md`、`project-memory/kernel/01`～`06` | 已读 | 重点：`EXPLICIT_EXPENSIVE_ACTION_AUTHORITY`、`BATCH_ATOMIC_DELIVERY`、`AMBIGUITY_REQUIRES_DEXTER`、`RUN_SCOPED_LOG_READ_REQUIRED`、`OBSERVABILITY_REQUIRED_FOR_ACCEPTANCE` |
| 3b | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face backend --owner platform --impact architecture --trigger review` | 已运行 | 返回：confirmed-business-language-corpus、deterministic-context-only、distributed-topology-is-not-current、http-crud-efficiency-design-redlines、independent-subagent-adversarial-review、owner-read-model-and-lifecycle-standard、kernel×6、business-corpus-adoption-and-read-policy、business-corpus-parked-domain-intake、backend-readability-refactor、pitfalls/browser-route-data-scope-drift、designing-from-conversation-not-system、invisible-dimension-drifts-at-implementation、platform-detail-reverse-inference、practices/backend-capability-lookup、collection-boundary-modes、failure-condition-names-the-wrong-shape、ordering-only-for-consumer-facing、read-model-granularity、set-interaction-not-n-times-single、operations/terminal-coding-standard、decisions/terminal-architecture-and-stack-rulings、terminal-build-order-and-batches |
| 3c | TER 相关 memory | 已读 | `terminal-architecture-and-stack-rulings.md`（T-12 键盘、`TER_SCRIPT_EXECUTE_UNRESTRICTED`、"automation 完全自研"）、`terminal-build-order-and-batches.md`（批 F 曾含 automation 包，现仓无此包）、`operations/terminal-coding-standard.md`、`practices/ter-input-and-virtual-keyboard-usage.md`、`practices/third-party-library-official-source-verification.md`；pitfalls 目录逐名过目，打开 designing-from-conversation-not-system、invisible-dimension-drifts-at-implementation、platform-detail-reverse-inference 三条与本对象相关者 |
| 3d | sourceRefs | 已读相关段 | `doc/platform/terminal-coding-standard.md`；build-order 文档 §4B.10 T-12 行（`00-ter-build-order-claude.md:829`） |
| 4 | `confirmed-business-language-corpus.md` | 已检索 | 词项 automation / 自动化 / selector / testID / testId / 测试 / 终端：全部 0 命中 ⇒ `NO_CORPUS_ENTRY_MATCHED` |
| 5a | 对象全文 | 已读 | 478 行，分段读完 |
| 5b | 讨论稿 `2026-10-05-ter-ui-automation-requirements-discussion-claude.md` 全文 | 已读 | 395 行 |
| 5c | `ls doc/decisions/` 及相关 decision | 已读 | independent-subagent-adversarial-review-governance（§1 两轮与 SELF_DECIDED）、verification-governance（三问、§5 半小时切小）、solution-reasonableness-review-policy、agent-coordination-and-control-boundary、roadmap-mechanism-retirement；2026-10-02 激活交互三份 decision 标题过目 |
| 5d | R-17 权威 | 已核引用 | 2026-09-03 需求 §4、2026-09-05 交互设计按对象引用位置核对存在；case 分母以 `run-sample1-frozen-journey.mjs:39-45` 亲验 |
| 5e | 在途计划 `2026-10-02-...-implementation-plan-codex.md` | 已读头部与 runner 引用 | `IMPLEMENTATION_AUTHORITY=true`、`ALL_DYNAMIC_STATUS=IN_PROGRESS`、第 172/194/223/267/273 行 |
| 6a | `doc/decisions/templates/*.md` 四份 | 已读节目录 | 用于 TEMPLATE_COVERAGE |
| 6b | `doc/platform/review-standard.md` | 已读 | 动作 1-B、3、4、5 |
| 6c | `doc/platform/terminal-coding-standard.md` | 已读 | §2-A、TR-03、TR-04、TR-08、TR-09、TR-10、TR-13、TR-16、TR-17、§4-C；TR-R07 标题 |
| 6d | `third-party-library-usage-standard.md`、`implementation-task-template.md`（动态前整体准入 / 失败族阶段准入） | 已读 | 模板第 144-148、211-223、268-269 行 |
| 6e | `.agents/skills/cs-review/SKILL.md`、`.agents/skills/cs-managed-runtime-execution/SKILL.md` | 已读 | 后者 §0a 与第 102 行 TER 设备运行 |
| 7 | R1 评审 `...-review-r1-claude.md` | 已读 | 评审方产物，允许先读 |
| 8 | 仓内事实亲验 | 已核 | display-context `displayDevice.ts:28-36`；platform-ports `device.ts:30`、`README.md:33`；runtime `module.ts:96-108`、`runtime.ts:43-64`、`execution.ts:40-45`、`command.ts:53-71`、`journal.ts:85-100`、`createRuntime.ts:459-473`、`createCommandDispatcher.ts:512-600`；`VirtualKeyboard.tsx:239-250,273-284`；`adminSectionSelection.ts:80`；`stateSyncSlices.ts:12`；`selectTerminalDataClientState.ts:17-37`；两 App `App.tsx`；`SystemFailureBoundary.tsx:20-26`；`check-production-bundle.mjs:8-17` 与调用者；`verify.test.mjs:149`；R-16 文件存在性；`run-sample1-frozen-journey.mjs:39-47`；`sample-console/assembly.tsx:160-210`；`actors.ts:22`；`testExpoApp.tsx:465,480`；`HANDOFF.md` 存在；另核 `SurfaceHostController.tsx:141`、`AdminLauncher.tsx:36-57,150`、`ter-virtual-keyboard-android.mjs:5795-5810`、`run-sample1-frozen-journey.mjs:215-228,337`、版本更新专项文档 automation 0 命中 |

## 盲审纪律披露

- 作者 intake `...-finding-intake-r1-claude.md` 在 verdict 写定前未打开。
- 例外披露：为核对对象 I-2 中 Dexter 原话"需求删了吧"，我对 `doc project-memory HANDOFF.md` 做了 `rg`，输出中出现了 intake 文件第 25 行（S-8 行）的前约 80 字。该片段只含"Rive 草案 Dexter 已说……"一句，未影响 findings 形成；NF-9 的判断依据是 Rive 草案文件本身状态与对象 §0.2 未收录该原话。
- 外部事实：尝试 WebFetch Android 官方 network security config 页面失败（域名受限），相关外部事实一律标 `UNVERIFIED`。
