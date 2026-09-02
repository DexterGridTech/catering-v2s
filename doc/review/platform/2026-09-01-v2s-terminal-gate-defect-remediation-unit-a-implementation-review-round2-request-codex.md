# TER gate defect remediation unit A implementation review request — round 2

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_UNIT_A_IMPLEMENTATION_2026_09_01
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
AUTHOR=Codex

## 背景

TER 全部门缺陷整改单元 A 已按 Dexter 授权完成实施。Claude 第一轮静态 IMPLEMENTATION review 结论为 `NO-GO`，M=2、S=5、N=4；本轮只闭合两条必修工程 finding，不扩大单元 A 的范围。

第一轮两条必修 finding 的最小修复如下：

1. M-2：TR-01 不再用裸 `propertyName === 'dispatch'` 判定。新增 `isStoreDispatchProperty`，只有接收者 TypeScript symbol origin 可解析为 Redux `Store` 或 Redux Toolkit `EnhancedStore` 时才命中；非 Redux 对象的同名 `dispatch` 保持绿。state 的 workspace convenience `input.dispatch` exception 已删除，单元 A 的 exception 当前为 6 条。
2. M-1：TR-01 exception 以 `sourceFile + declarationId + dispatchExpression + reasonCategory` 为完整身份，重复完整身份、声明但零命中、以及超过已声明 occurrence 的新增调用均红；同一前三元组的不同 `reasonCategory` 通过确定性 occurrence 顺序分别消费，不能由 `find` 静默复用同一条。

详设与计划也已同步：单元 A exception=6，单元 B D-5 完成后 role-effect exception 降为 5；D-5 使用新版 action-return 方案，不再构造 facade 或伪权限模型。`capabilitySymbol` 字段已统一改名为 `dispatchExpression`。

## 输入材料

- 缺陷登记：`doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md`
- 详设：`doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md`
- 实施计划：`doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md`
- 本轮证据：`doc/evidence/platform/2026-09-01-v2s-terminal-gate-defect-remediation-unit-a-implementation-evidence-codex.md`
- 第一轮 review：`doc/review/platform/2026-09-01-v2s-terminal-gate-defect-remediation-unit-a-implementation-review-request-codex.md`
- 相关源码：`tools/terminal-skeleton/`、`tools/terminal-shared/`、`tools/terminal-runtime/`、`tools/terminal-contracts/`、`tools/terminal-state/`、`tools/terminal-platform-ports/`、`apps/terminal/skeleton-graph.ts`、`apps/terminal/kernel/base/*/terminal-invariants.json`
- 规范正本：`doc/platform/terminal-coding-standard.md`

请 fresh 重新打开当前字节与原始 owning source；不要采信本 brief、第一轮结论或 evidence 的 PASS 叙述。第一轮已确认闭合的 D-1、D-2、D-4、D-8、D-22 结构可以定向核对，不要因本轮修复回退而重复接受旧结论。

## 本轮新鲜命令与原始输出

以下命令均在仓根执行，均 exit 0：

```text
node tools/terminal-shared/package-invariants.test.mjs && node tools/terminal-skeleton/check-static.test.mjs && node tools/terminal-runtime/check-static.test.mjs && node tools/terminal-skeleton/verify.test.mjs
TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS
A2_D3_HANDLER_SCOPE_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_THIRD_STORE_DISPATCH_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_UNUSED_EXCEPTION_RED=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:FAIL,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
A2_TR01_NON_REDUX_DISPATCH_GREEN=graph-comparison:PASS,triple-naming:PASS,dependency-direction:PASS,dependency-declaration-completeness:PASS,tr01-reducer-boundary:PASS,kernel-platform-independence:PASS;SCAFFOLD_HYGIENE=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
RUNTIME_MODEL_CLEANUP=PASS
TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
```

```text
yarn workspace @catering-v2s/terminal verify:static
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_STATIC=PASS
```

```text
yarn workspace @catering-v2s/terminal verify
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=9
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
Tasks: 22 successful, 22 total
Tasks: 9 successful, 9 total
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
Android Bundled 1755ms apps/terminal/assembly/android/pos-desktop/index.ts (710 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

本轮还针对「长时间无输出」补了可观察边界。`verify.mjs` 与 `verify-static.mjs` 在每个
`spawnSync` 子进程开始前立即向 stderr 打印 `TERMINAL_VERIFY_DEBUG`，结束后打印状态、信号、错误码与耗时。
新鲜输出显示首个无输出阶段是 `verify-static` 内的 `check-static.test.mjs` model-test：本机约 30.8 秒；
外层 static 阶段约 42.1 秒后完成。随后四个 Turbo dry-run、typecheck、test 与 Expo export 均有独立 start/finish
边界，最终 `TERMINAL_VERIFY_CLEANUP=PASS`、`TERMINAL_VERIFY=PASS`。请复核这项日志改动不会改变既有 marker/失败语义，
并不要把该日志证据升级为 native、Gradle 或设备证明。

模型测试中的三个 red 与一个 green vector 是新加入的成对控制：

- `A2_D3_HANDLER_SCOPE_RED`：handler 外 dispatch wrapper 只红 `tr01-reducer-boundary`；
- `A2_TR01_THIRD_STORE_DISPATCH_RED`：在 state `createStateRuntime` 内新增第三处 `store.dispatch`，只红 TR-01；
- `A2_TR01_UNUSED_EXCEPTION_RED`：保留 exception 但使一个真实调用不再命中，只有 TR-01 红并报告 `exception not consumed`；
- `A2_TR01_NON_REDUX_DISPATCH_GREEN`：非 actor 文件中的非 Redux 对象 `dispatch`，所有门绿。

## 本轮请重点复核

1. `isStoreDispatchProperty` 是否真的以 Redux/Toolkit 类型 origin 为准，是否覆盖当前 `store.dispatch` 与 `getStore().dispatch`，且不会把带同名方法的普通对象误报；请构造一个非 Redux `Store` 同名类型以及 element access 反例。
2. `tr01Exceptions` 的 schema 与 checker 是否已完全改用 `dispatchExpression`，是否仍有旧字段、旧中央表或 workspace exception 残留。
3. exception 的完整四元组是否逐条消费：重复完整身份必须红；同前三元组不同 reasonCategory 的两条 state exception 必须由两次真实调用分别消费；新增第三次调用或声明零命中必须红。请构造“把两条 reasonCategory 合成一条”与“删除/移动一个调用”的反例。
4. 新增的非 Redux `dispatch` green vector 是否有可能只是因为 fixture 类型解析失败而没有走到类型判据；请检查 scratch fixture 的 Redux 类型链接与真实树的 TypeScript diagnostics。
5. `A2_TR01=PASS exceptions=6`、详设/计划中的单元 A=6、D-5 后=5 是否与当前 invariants 和实现完全一致；不要把 D-5 尚未实施误报为本轮缺陷。
6. D-5 详设/计划是否已删除旧 facade/keys 断言与旧“workspace convenience exception”叙述，避免后续实施者走旧方案；本轮不实施单元 B。
7. 是否仍存在“所有门、模型、TER-local verify 全绿但 TR-01 允许新增未登记写入”的路径，尤其是 occurrence 分配、alias/element access、Redux Store 类型解析失败等边界。

## 结论格式

请给出 `GO` 或 `NO-GO`，报告 `M`、`S`、`N` 数量。每条 finding 写明精确文件与行号、仓内事实/推论、可证伪失败条件、最小修复，并标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`。请区分你亲自运行的命令与仅静态核验的内容；若不运行命令，所有运行结论标 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 授权边界

本 brief 只请求单元 A 的第二轮 IMPLEMENTATION review，不授权 Claude 或任何 agent 修改源码、开始单元 B/D-5、workspace scoping、下一个 owner 包、display-context、仓级 normal `scripts/verify`、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。TER-local model/static/verify 已由 Codex 在本轮运行；Claude 如保持长期约定可只读复核，不得以未运行命令冒充动态证据。
