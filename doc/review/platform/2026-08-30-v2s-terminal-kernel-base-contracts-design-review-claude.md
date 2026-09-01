# TER `kernel.base.contracts` DESIGN adversarial review · Round 1

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | DESIGN |
| REVIEW_CYCLE_ID | TER_KERNEL_BASE_CONTRACTS_DESIGN_20260830 |
| REVIEW_ROUND | 1 |
| REVIEW_ROUND_LIMIT | 2 |
| reviewerKind | INDEPENDENT_SUBAGENT |
| reviewerInputChecklist | `doc/review/platform/2026-08-30-v2s-terminal-kernel-base-contracts-design-review-input-checklist-claude.md` |
| reviewerInputChecklistSha256 | `4c9654c531971289e19c9e3713b3e1b0cf7351d50ad3f4f3c8dfb6d93f3b5485` |
| blindReviewDeclaration | 先独立形成 findings/verdict 后才对照任何作者处置材料 |
| authorMaterialReadAfterIndependentVerdict | true（本轮没有作者处置材料） |

## 0. 结论

`NO-GO`。

本详设的主体方向可实现：74 名 exact exports 内部计数自洽，TR-05 `A=7/B=7/C=0` 与 F-4 覆盖面自洽，`ParameterDefinition<T>` → `ParameterDescriptor` 的 unknown type guard 形态可成立，`createRuntimeId` kind-brand 修正了 POC 漏洞，`AppError.templateMissingKeys` 解决了缺参静默问题，CP-2/CP-3 对 verifier 与 adapter runner 的方向也基本可执行。

但独立证伪后仍有两个会让设计验收假绿的缺口：

1. `T-6` 被从“远端非法值必须标为 `catalog-fallback`”降级为“literal 不相等”，直接违背需求并留下“测试全绿但 resolver 行为未实现”的路径。
2. 需求要求 C-4 逐个 export 回答共享词汇与消费者，详设只给 group-level 理由；74 名 exact-set 可机械通过，但 review 无法逐项判定哪些符号是根契约、哪些只是未来/内部结构。

## 1. Action 1-B 提取结果

### 1.1 模板缺项

- `implementation-design-template` 的 operation/path/face、owner write、migration/seed/UI 折叠为 `NOT_APPLICABLE`：本批纯 contracts 包，折叠方向成立。
- C-4 模板/需求清单缺口：需求要求“每个导出”逐项回答为什么是共享词汇并列已知消费者，详设 `§4.10` 只按组给理由，不能支撑 74 名逐项 review。

### 1.2 三份文档矛盾

- 需求 `T-6`：远端值非法时 `ResolvedParameter.source` 必须是 `catalog-fallback`。
- 详设/计划：本批只证明三个 source literal 可构造且 `catalog-fallback !== default`，把 invalid remote resolver 行为推迟。
- 这是同一验收项被改写，不是单纯“未来能力未冻结”。

### 1.3 无出处数值/枚举

- `74` exports：详设内 `3+23+14+5+7+7+7+8=74`，自洽。
- TR-05：需求分母为 13 处 `Record<string, unknown>` + 1 处 `any`；详设处置 `A=7/B=7/C=0`，自洽。
- C-6 七处闭集：需求给出 `ErrorCategory(9)`、`ErrorSeverity(4)`、四个 source 三值、`ParameterValueType(4)`，详设门控引用一致。

## 2. Findings

### [M-1] T-6 把远端非法 fallback 行为降级成 literal 差异测试，形成真假绿

分类：`CONFIRMED`

位置：

- `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md:126`
- `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md:522`
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md:122-125`
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md:236`
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md:361`

仓内事实：

- 需求明确说 `ResolvedParameter.source` 三值用于区分“用了默认”与“远端值非法退回默认”（requirements:126）。
- 需求 T-6 的反断言明确要求：远端值非法时 source 必须是 `catalog-fallback`（requirements:522）。
- 详设将 T-6 改成只证明三个 literal 可构造，且 `catalog-fallback` 与 `default` 不相等；并声明“远端非法值如何被解析”为未来 resolver 行为（design:122-125,236,361）。

可复现实证：

- 静态对照即可复现：当前 74 exports 中没有 resolver/resolve 函数；若实现者只创建 `ResolvedParameter` 三个 object literal，T-6、C-6、F-3、support exact-set 都能绿，但没有任何生产代码把“远端非法值”判成 `catalog-fallback`。
- 这正是 requirements:530-537 所警告的“全绿但根契约没用”同类假绿，只是发生在 parameter resolver 语义内。

后果：

- 评审会看到 `T-6=PASS`，但批准需求里的关键语义未实现：调用方无法证明非法远端参数与普通默认值 fallback 被区分。
- 后续 resolver owner 如果按当前 contract 解读，可能只把 `source` 当枚举字段，而不是必须由解析行为驱动的诊断事实。

最小修复：

1. 若当前需求保持不变：在本批 contracts 中增加一个最小、纯函数、无 adapter 的 resolver contract，例如 `resolveParameterValue` / `resolveParameter`，输入为 `ParameterDefinition<T>`、可选远端 raw value 与默认值，输出 `ResolvedParameter<T>`；T-6 必须构造“远端 raw 存在但 validate 失败”的 case，并断言 `source === 'catalog-fallback'`。
2. 若本批确实不应包含 resolver：同步修改 requirements、design、plan，把 T-6 名称和判据改为“source literal closed-set/discriminant only”，并删除“远端值非法时 source 必须是前者”的当前验收语义；同时把 resolver 行为列入未决 owner 和未来验收，不得保留会误导的 T-6 行为名称。

更小替代为何不足：

- 只保留当前 literal test + prose 不足：它能通过所有机器门，却没有任何执行路径接受“远端非法值”输入。
- 只在 test 里写 helper 冒充 resolver 也不足：详设自己禁止 test-owned helper 冒充生产能力；这不能证明真实 contract 可用。

同根全集扫描：

- 扫描范围：requirements 参数协议/T-6/F-3/C-6、design `§4.4`/`§6 CP-1`/`§10 未决项`、plan CP-1、POC parameter definitions、当前 v2s contracts。
- 结果：未找到生产 resolver export 或等价生产行为；其他 T-1/T-3/T-4/T-5/T-7/T-8/T-9 均有明确可观测实现点，未见同样把行为断言退化成 literal construction 的情况。

### [S-1] C-4 要求逐个 export 的共享词汇/消费者回答，详设只给 group-level 理由，74 名 exact-set 仍可能把内部/未来结构送入根包

分类：`CONFIRMED`

位置：

- `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md:37-45`
- `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md:203`
- `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md:630`
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md:83-167`
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md:169-179`
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md:266-268`

仓内事实：

- 需求 C-4 明确是人工 review 清单：每个导出，详设必须回答“为什么是共享词汇而不是某包内部结构”，并列已知消费者；消费者为零时要说明它服务于哪类未来包（requirements:203）。
- 需求交付物再次要求逐项回答 §4.1 每个导出（requirements:630）。
- 详设 `§4` 给出了 74 名 exact-set，`§4.10` 只按“ID/时间、错误协议、参数协议/工厂、模块描述符、request 生命周期、transport 配置”等组给共享性说明（design:169-179）。
- 详设 CP-2 support check 只比对 74 名 exact-set 和禁止 `export *`（design:266-268），无法判断每个 symbol 的性质。

可复现实证：

- 以 `CommandRouteContext` 为例，详设声称只保留“已有语义读者”的 `workspace?`、`instanceMode?`（design:150-152,349），但本轮对 POC/current consumers 的 `rg` 追踪未确认到 routeContext 字段级 reader；这至少要求逐项证据或降级为 `UNVERIFIED_REQUIRES_EVIDENCE`，而不能被 group-level “request 生命周期”说明覆盖。
- 对 `CommandResultPatch`，详设解释其未出现在需求 §4.1 枚举句但因 TR-05 分母列入（design:148-149）；这种单符号差异恰恰说明 group-level 理由不足以替代 per-export 表。

后果：

- 74 名 exact-set 可以保证“导出了这些名字”，但不能保证“每个名字都应在根契约包”。这会让 C-4 这个唯一性质判断门不可审。
- 对未冻结的组 5/6，可能把 runtime 未来会改的内部结构先固定到全仓根依赖面；后续修正成本被放大到所有 consumers。

最小修复：

- 在详设中补一张 74-row export review table，至少包含：symbol、组、POC/sourceRef、共享词汇理由、已知消费者或未来消费者类别、当前证据档位（CONFIRMED / UNVERIFIED_TER_NEED / local-only）、是否有字段级 reader、是否受 C-4b/C-6/F-4/T-* 覆盖。
- 对无法逐项回答的 symbol，不应靠 exact-set 先纳入；应推迟、删除或明确改为 future owner 未冻结，并同步测试/支持检查分母。

更小替代为何不足：

- 只保留 `§4.10` group-level 说明不足：同一组内同时存在 confirmed consumer、future vocabulary、local-only、需求遗漏但 TR-05 引入的 symbol，风险不同。
- 只靠 support check 不足：support check 只做 name exact-set，不能判断“共享词汇 vs 内部结构”。

同根全集扫描：

- 扫描范围：requirements C-4/C-4b/C-6/交付物、design `§4`/`§4.10`/support check、plan CP-1/CP-4、POC request/module/transport/error/parameter consumers、当前 skeleton graph。
- 结果：ID/time、error、transport 的组级消费者较强；parameter、module、request 三组多处仍是 `UNVERIFIED_TER_NEED` 或 local-only。未发现能替代 74-row C-4 表的逐项证据。

## 3. 已核但未形成 finding 的重点

### 3.1 74 名 exact exports

分类：`REJECTED_WITH_EVIDENCE` for “74 count 不自洽”。

详设 `§4` 内部计数为 `3 + 23 + 14 + 5 + 7 + 7 + 8 = 74`。`CommandResultPatch` 虽未出现在 requirements §4.1 request 枚举句，但 requirements TR-05 分母包含它，详设显式解释纳入理由。问题不在数量，而在 S-1 的 per-export C-4 语义证据不足。

### 3.2 TR-05 `A=7/B=7/C=0` 与 F-4

分类：`REJECTED_WITH_EVIDENCE` for “A/B/C 无法自洽”。

requirements:295-307 给出 13 处 `Record<string, unknown>`，另有 `AppModule.parameterDefinitions<any>`；详设 `§5` 将 error args 3、request result 3、`listDefinitions` 1 归为 A，共 7；metadata 6 与 `any` 擦除 1 归为 B，共 7；C=0。F-4 对 error args 三处、result 三处与 `listDefinitions` 各放负夹具，覆盖 A=7。

### 3.3 `ParameterDefinition<unknown>` / `ParameterDescriptor` 型变

分类：`REJECTED_WITH_EVIDENCE` for “unknown 擦除必然不可行”。

详设把 validate 改为 `(value: unknown) => value is T`，使具体定义可作为 `ParameterDefinition<unknown>`/`ParameterDescriptor` 被读；同时 `AppModule.parameterDefinitions` 只读 `ParameterDescriptor[]`，避免 POC `any`。这一路径在 TypeScript 形态上成立。剩余问题是 M-1：resolver 行为没被定义/测试，而不是 descriptor 擦除本身不成立。

### 3.4 C-2/C-4b/C-5/C-6 与 support check gate admission

分类：`PARTIALLY_CONFIRMED`。

设计符合 gate governance 的方向：四门各有 model red，support check 不冒充第五道规则门，真实树与 model 都接入 `verify-static`。未实施前仍需实际源码/红夹具证据；本轮未发现设计上 gate admission 不成立。

### 3.5 单 tsconfig 编译 Vitest config/test

分类：`UNVERIFIED_REQUIRES_EVIDENCE`。

当前 contracts tsconfig 只含 `src/**/*.ts`；详设计划改成唯一闭包覆盖 `src/**/*.ts`、`test/**/*.ts`、`vitest.config.ts`，并用 `--listFilesOnly` 与 4c negative control 证明负夹具入编译面。设计上可行，实施期必须实跑。

### 3.6 `createRuntimeId` kind-brand

分类：`REJECTED_WITH_EVIDENCE` for “仍继承 POC caller-chosen brand 漏洞”。

POC `createRuntimeId<TId extends string>(kind)` 允许调用方给任意 brand；详设要求 kind 到 brand 私有映射/重载，九个 convenience creator 同步核前缀/唯一性。这一方向能堵住 POC 漏洞。

### 3.7 `AppError` missingKeys

分类：`REJECTED_WITH_EVIDENCE` for “缺参仍静默”。

需求要求缺参保留可辨识占位并让缺失 key 可观测；详设引入 `RenderedErrorTemplate.missingKeys` 与 `AppError.templateMissingKeys`，T-3/T-4/T-8 覆盖。设计方向成立。

### 3.8 五 adapter `expo install -- --mode=update-lockfile`

分类：`PARTIALLY_CONFIRMED`。

本轮在 adapter cwd 执行 `npx expo install --help`，help 显示 Expo CLI 接受 `--yarn`、`--dev`，并把 `--` 后参数透传给底层 install；`yarn add --help` 显示 Yarn 4 支持 `--mode=update-lockfile`。因此命令形态设计可执行。完整 latest/template 取值、首包写入面、五包 convergence 与 root `yarn install` 仍必须实施期实跑，不能由本轮静态 help 替代。

### 3.9 TER verify 真跑 test 与 marker 契约

分类：`PARTIALLY_CONFIRMED`。

当前 `tools/terminal-skeleton/verify.mjs` 对 `test` 只做 dry-run，这是真实假绿面；详设 CP-2 明确要改为 contracts + 五 adapters owner exact-set、typecheck 后真实 `turbo run test`、解析 1 个 real marker + 5 个 NO_TEST_FILES marker。设计覆盖了当前问题。实施期要用 contracts test red 证明 verifier 不再假绿。

### 3.10 CP 顺序与并行共享面

分类：`PARTIALLY_CONFIRMED`。

计划顺序为 CP-1 contracts → CP-2 static/verifier → CP-3 adapters → CP-4 全范围，符合先根包、再 verifier、再 terminal test owner 的依赖关系。五 adapter 的 `expo install` 明确串行首包确认后再继续，避免共享 lock/install-state 并行污染。未发现设计层 CP 顺序错误。

## 4. 全绿但 contracts 仍不可用的路径

已确认路径：

1. 按详设实现 `ResolvedParameter.source` 三个 literal。
2. T-6 只断言三个 literal 可构造和 `catalog-fallback !== default`。
3. C-6 只核 `ResolvedParameter.source` 是三值闭集。
4. F-3 只构造一个 `ResolvedParameter`/相关公开类型。
5. support check 只核 74 名 export exact-set。
6. `typecheck`、`test`、static gates、TER verify 均可绿。
7. 但没有任何生产 resolver 接受“远端值非法”输入并输出 `source='catalog-fallback'`，requirements:522 的行为未实现。

这一路径由 M-1 覆盖。

## 5. Verdict block

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_KERNEL_BASE_CONTRACTS_DESIGN_20260830
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M=1
S=1
N=0
L1_STATIC_REVIEW=PASS_WITH_FINDINGS
L2_USER_VISIBLE=NOT_APPLICABLE reason=本批纯 contracts/TER-local 设计，无 UI、浏览器、用户可见流程或文案验收面
L3_RUNTIME=NOT_RUN_NOT_AUTHORIZED reason=本轮为 design read-only review，未获 DEV/L2/UAT/seed/runtime 授权
SAME_ROOT_SCAN=COMPLETED parameter-source/T-6/C-6/F-3/F-4/export-C-4/verifier/adapters/POC-consumers
DESIGN_GAPS=2
EVIDENCE_TIER=STATIC_REPO_SOURCE+POC_SOURCE+CLI_HELP; no dynamic install/test/runtime evidence claimed
```

