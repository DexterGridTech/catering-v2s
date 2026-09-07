# 给 Dexter / Claude 的 TER 可读性整改实施后静态 Review Brief

```text
REVIEW_CYCLE_ID=TER_READABILITY_IMPLEMENTATION_2026_09_07
REVIEW_TARGET=IMPLEMENTATION
SCOPE=CP-0..CP-6 implementation and static evidence
IMPLEMENTATION_STATIC_REVIEW_READY=TRUE
UPSTREAM_STATIC_REVIEW=GO M=0/S=1/N=1
FOLLOW_UP_STATUS=AUTHOR_FIXES_APPLIED
FINAL_DECISION=FOLLOW_UP_SELF_DECIDED_NOT_A_NEW_INDEPENDENT_VERDICT
DELIVERY_TO_DEXTER_AND_CLAUDE=READY_FOR_STATIC_IMPLEMENTATION_REVIEW
```

## 背景与目标

本批处理 TER 可读性整改：15 项闭合目录 vocabulary、TR-R01 至 TR-R07（6 条 L、1 条 R）、
12 个包的 35 个散文件归位、runtime testing registry 拆分、dispatcher/persistence/InputProvider
按职责拆分，以及开发期七组 startup 结构化事实。目标是提高人类开发者可读性和诊断可追踪性，
不改变业务 command、state、owner、UI 行为、公共 platform-ports 契约或测试断言语义。

## Review 输入

请按以下仓根相对路径直接打开当前 bytes，不以历史聊天或旧 verdict 代替源码：

- `doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-requirements-claude.md`
- `doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-implementation-design-codex.md`
- `doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-implementation-plan-codex.md`
- `doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-responsibility-test-matrix-codex.md`
- `doc/platform/terminal-coding-standard.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp0-reconciliation-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp1-focused-proof-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp2-focused-proof-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp3-focused-proof-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp4-focused-proof-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp5-focused-proof-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp6-reconciliation-codex.md`

## 当前实施与证据摘要

- `tools/terminal-readability/rule-catalog.json` 保持 7 行两列；`checker-manifest.json` 保持 6 条 L
  规则，当前均 enabled；TR-R01 仍是 review-only，不被伪装成 checker。
- `tools/terminal-readability/check-static.mjs` 真实实现 TR-R02 至 TR-R07 的 AST/graph checker；
  `check-static.test.mjs` 为每条 L 规则提供 red/negative control，并覆盖 RD-9/RD-11/RD-12 等
  反假绿模型。
- runtime production graph 不可达 `src/testing`；两个 registry 的 WeakMap/register 在 foundations，
  testing seam 读取同一 registry，避免创建第二份状态。
- startup descriptor 使用内部非枚举 `Symbol.for` sidecar；14 个真实 attach 位点，支持 unavailable、
  real 与 partial-real capability，不扩展 `PlatformPortBindings`、`CreatePlatformPortsInput` 或
  `PlatformPorts` 公共契约。
- startup 的 modules/slices/commands/actors/parts/surfaces 事实仍由各自 owner 提供；declared surface
  baseline 与真实 `InputSurfaceFrame` `onLayout` measured frame 分开。
- InputSurfaceFrame focused oracle 观察首帧未测量、不渲染键盘、360x640 首次测量、同尺寸去重、
  420x700 resize 以及 focus/blur 收尾。
- runtime startup focused oracle `apps/terminal/kernel/base/runtime/test/startupDiagnostics.dev.test.ts`
  第 6 至 76 行构造已知 module、slice、command、actor，断言真实 startup payload 的确切 count 与
  已知名称；不再只断言键存在或数字类型。
- 责任矩阵的 runtime testing registry owner test files 当前为 16 个 `*.test.ts`、3034 行；
  `public-surface.typecheck.ts` 与 `testSupport.ts` 是支撑文件，不计入该 test-file 分母。

## 最新静态 review finding 处置

- `S-1 / CONFIRMED`：已修复。`apps/terminal/kernel/base/runtime/test/startupDiagnostics.dev.test.ts`
  第 8 至 23 行构造已知 module、slice、command、actor；第 39 至 70 行断言真实 startup payload
  的确切 count 与已知名称/键。该测试现在能识别手写零值或空数组常量，不改变生产 emitter。
- `N-1 / CONFIRMED`：已修复。责任矩阵的章节编号现在为第 4、5、6 节，见其第 63、74、99 行。

本次修复后没有重新召集独立 reviewer；既有实施 review cycle 已达到 2/2。用户明确不授权本轮运行，
但主 agent 误执行了一次 runtime package focused test（实际 `16 files/94 tests PASS`）；该输出已在
CP-6 evidence 中如实登记，不作为本轮静态 GO 或新的全批验证依据，后续未再运行。

## 真实验证结果

```text
runId=ter-local-static-31864-1788793081817
TERMINAL_PACKAGE_TEST=PASS package=@catering-v2s/ui-base-input TestFiles=10 Tests=48
READABILITY_MODEL=PASS
READABILITY_STATIC=PASS
STARTUP_DESCRIPTOR_ATTACH_SITES=14
STARTUP_DESCRIPTOR=PASS
TERMINAL_STATIC=PASS
TERMINAL_TYPECHECK=PASS Tasks=27/27 exit=0
TERMINAL_TEST=PASS Tasks=20/20 exit=0
TERMINAL_LINT_COMMAND=PASS exit=0 (当前 Turbo 无任务执行，不能解释为 lint 规则已运行)
```

## 独立审查处置

CP-6 第 2 轮 fresh 独立 reviewer 的原始结论已保留在 CP-6 evidence：
`FULL_BATCH_3D_RECONCILIATION=OPEN`、`CODE_DESIGN_RECONCILIATION=MATCHED`、`M/S/N=0/2/1`。
两个证据缺口和一个计数问题随后由主 agent 修复并重新回读；CP-0 的缺失阶段记录另行由 fresh
独立 cycle 的第 2 轮确认 `CP0_STAGE_3D_RECONCILIATION=MATCHED`。CP-6 已达 2/2，不再召集第三轮，
最终 `FULL_BATCH_3D_RECONCILIATION=MATCHED` 是主 agent 的 `SELF_DECIDED` 收口，不冒充独立 reviewer
的 GO。

请重点检查：

1. 规则/目录/graph 的实现是否仍与详设逐条一致，尤其 TR-R02、TR-R05、TR-R06、TR-R07；
2. startup 事实是否来自 owner，而不是跨层聚合、调用次数、字符串搜索或手写常量；
3. 三处职责拆分前置矩阵与拆分前后 behavior oracle 是否保持，RD-10 是否有行为变化；
4. public platform-ports 契约、业务 command/state/owner 和测试断言语义是否保持；
5. 不把 static/focused 输出升级为 Web、Android、生产 DCE、DEV、seed、UAT、部署或真实视觉验收。

RD-10 的“断言语义一字不得改”由
`doc/evidence/platform/2026-09-07-v2s-terminal-readability-cp6-reconciliation-codex.md`
第 119 至 151 行的逐锚点记录承担：该记录把详设 §9、各 CP focused proof、责任矩阵的
preObservation/postObservation 与当前 owning test oracle 逐项绑定，并明确测试只允许路径同步、
不得改变既有业务断言语义。该项是静态代码/文档对账证据，不冒充改前字节级 diff 或运行证据。

## Claude 输出格式

请给出 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 必须标注
`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或
`DEXTER_DECISION`，同时给出仓根相对路径、`第 X 行`、失败场景、影响面、最小修复和是否需要 Dexter
裁决。请明确区分静态、focused、Web、Android、生产 DCE、DEV、seed、UAT 与部署证据；不重跑验证也
不得将未取证边界写成 PASS。
