# TER 可读性整改 · CP-2 focused proof

`REVIEW_TARGET=IMPLEMENTATION_STEP_PROOF`
`CP=CP-2`
`evidenceMode=static + focused`

本记录覆盖两个 kernel feature 包的 12 个根目录散文件归位。按已批准 CP-2 边界，实施只
改变物理路径与受路径影响的内部 import/export；没有修改 package.json、外部 package-root
consumer、command/slice/actor/state payload 或测试断言。没有执行 Web、Android、DEV、seed、
UAT 或部署。

## 1. 归位结果

| package | six files moved to | current root source files remaining |
|---|---|---|
| `kernel/feature/sample-member-registry` | `commands.ts`→`features/commands/commands.ts`；`slice.ts`→`features/slices/slice.ts`；`selectors.ts`→`selectors/selectors.ts`；`types.ts`→`types/types.ts`；`errors.ts`→`foundations/errors.ts`；`module.ts`→`application/module.ts` | `index.ts`、`moduleName.ts`、`dependencies.ts` |
| `kernel/feature/sample-staff-session` | `commands.ts`→`features/commands/commands.ts`；`slice.ts`→`features/slices/slice.ts`；`selectors.ts`→`selectors/selectors.ts`；`types.ts`→`types/types.ts`；`errors.ts`→`foundations/errors.ts`；`module.ts`→`application/module.ts` | `index.ts`、`moduleName.ts`、`dependencies.ts` |

`features/actors/actors.ts` 已是既有目录文件，不计入本批 12 个散文件。所有外部使用方仍
通过 package root；本批未引入任何 deep consumer。

## 2. package root public surface

使用 TypeScript AST 读取两个当前 `src/index.ts` 的 named export declarations，实际输出为：

```text
sample-member-registry_ROOT_EXPORT_COUNT=19
sample-member-registry_ROOT_EXPORT_NAMES=dependencyModuleNames,devDependencyModuleNames,moduleName,moduleKind,confirmMemberCommand,memberConfirmedCommand,memberPendingCommand,memberRejectedCommand,memberWithdrawnCommand,rejectMemberCommand,submitMemberCommand,withdrawMemberCommand,createSampleMemberRegistryModule,selectMembers,selectPendingMember,Member,MemberRejectedPayload,MemberState,PendingMember
sample-staff-session_ROOT_EXPORT_COUNT=18
sample-staff-session_ROOT_EXPORT_NAMES=dependencyModuleNames,devDependencyModuleNames,moduleName,moduleKind,bootstrapSessionCommand,loginCommand,loginFailedCommand,loginSucceededCommand,logoutCommand,logoutSucceededCommand,sessionRestoredAnonymousCommand,sessionRestoredAuthenticatedCommand,createSampleStaffSessionModule,selectSessionState,LoginFailedPayload,LoginPayload,SessionState,SessionStatus
```

`sample-staff-session` 原本就是 18 个 named exports；本记录不把预扫描材料中的“19”复述为
事实。两个 package.json 的 package name、`exports["."]`、dependencies、scripts 均未改。

## 3. focused 结果

当前工作区实际执行：

```text
member typecheck: exit 0
member Vitest: Test Files 1 passed (1), Tests 9 passed (9)
staff typecheck: exit 0
staff Vitest: Test Files 1 passed (1), Tests 7 passed (7)
TR_R06_CP2_FEATURE_FINDINGS=0
skeleton static:
  RULE_GATES=6
  RULE_GRAPH_COMPARISON=PASS
  RULE_TRIPLE_NAMING=PASS
  RULE_DEPENDENCY_DIRECTION=PASS
  RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
  RULE_TR01_REDUCER_BOUNDARY=PASS
  RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
  SCAFFOLD_HYGIENE=PASS
```

`TR_R06_CP2_FEATURE_FINDINGS=0` 的调用根为 `apps/terminal/kernel/feature`，因此只覆盖本
批两个 package；全仓 TR-R06 仍由后续批次处理，不把后续未归位 package 的 finding 混入 CP-2。

## 4. 路径重算核对

- 两个 `features/commands/commands.ts` 从 `../../moduleName` 与 `../../types/types` 读取；
  `application/module.ts` 从 `../dependencies`、`../features/commands/commands`、
  `../foundations/errors`、`../features/slices/slice` 读取。
- 两个 `features/slices/slice.ts` 从 `../../moduleName`、`../../types/types` 读取；
  `selectors/selectors.ts` 从 `../features/slices/slice`、`../types/types` 读取。
- 两个既有 `features/actors/actors.ts` 的 commands/errors/selectors/slices/types 相对路径
  已按新目录层级重算；没有把同名 `EmptyPayload` 合并或跨包抽取。
- 两个 root `index.ts` 只更新 re-export path，导出名称、顺序及 type/runtime 分类保持当前
  public surface；测试仍从 `../src/index` 读取 package root。
- 旧的 12 个根散文件路径在两个 package 当前 source tree 中不存在；目标文件均位于 15 项
  词表允许目录或 `features` 四项固定子目录中。

## 5. CP-2 结论边界

本记录是 CP-2 focused proof，不能替代 fresh independent subagent 的阶段三维对账。它证明
当前两包类型解析、owner behavior tests、目录定向检查和相关 skeleton static 结果；不证明
整个 27 package 的 TR-R06、Web/Android 运行、真实生产 bundle、DEV、UAT 或部署行为。下一步
必须先取得 CP-2 阶段 reviewer 的 `MATCHED`，再开始 CP-3。

## CP-2 阶段三维独立对账补录

```text
REVIEW_CYCLE_ID=TER_READABILITY_IMPLEMENTATION_CP2_STAGE_2026_09_07
REVIEW_TARGET=IMPLEMENTATION_STEP_RECONCILIATION
REVIEW_ROUND=1/2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
CP2_STAGE_3D_RECONCILIATION=MATCHED
M/S/N=0/0/0
```

本轮 fresh 独立 reviewer 只读重开了 CP-2 需求、详设、实施计划、责任矩阵、项目记忆、focused proof，
以及两个 kernel feature 包的当前源码、测试、`index.ts` 与 `package.json`；未发现仓内已有等价的
独立阶段报告。结果如下：

- 两个包的 12 个目标源码文件均已按详设归位；两个包的 root source 当前只保留合法入口文件与目录，
  `features/` 直系目录符合 `actors`、`commands`、`slices`、`variables` 约束，fresh scoped TR-R06
  结果为 0。
- module/command/slice/selector/type/error 的导出名、顺序、type/runtime 性质与路径归一化结果保持
  等价；package name、`exports`、dependencies、scripts、测试文件及测试断言语义未变，未发现业务载荷、
  command 语义或外部 deep consumer 变化。
- 现有两份包级 `vitest.config.ts` 的 `__DEV__` 变化属于 CP-1/全局测试环境改动，不在 CP-2 的 12 个
  源码文件、package.json 或测试文件分母中；未将其错误归因于 CP-2，也未用后续 CP 结果替代本轮结论。

本轮未重复运行测试，因此只记录独立静态对账结果；Web、Android、DEV、HTTP、UAT 与生产运行仍是
未取证边界。CP-2 阶段无未闭 `OPEN`，允许保留全批收口前置记录。
