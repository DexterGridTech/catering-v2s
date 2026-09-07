# TER 可读性整改 CP-4 focused proof

`REVIEW_TARGET=IMPLEMENTATION_STEP`
`CP=CP-4`
`STATUS=FOCUSED_PROOF_PASS`
`AUTHORITY=DEXTER_IMPLEMENTATION_AUTHORIZATION`

## 范围

本步处理剩余 `ui/feature`、`ui/integration`、`adapter/android` 与
`assembly/android/sample-terminal` 的目录归位，并在目录闭合后启用六个 L 档 checker。
同时处理由 TR-R04/TR-R05 暴露的既有职责体量与控制深度实例；所有拆分均以现有职责与
behavior oracle 为边界，不改变生产行为、公共 API、业务字段、快照语义或测试断言语义。

本步未运行 Web pointer、Android 真实设备、副屏输入、DEV、seed、UAT、部署或视觉验收，
也未把静态或 react-test-renderer 结果写成这些证据。

## 实施观察

- `sample-member-desk` 的 `assembly.ts`、`commands.ts`、`module.ts`、`parts.ts` 已分别归入
  `assembly/`、`features/commands/`、`application/`、`parts/`。
- `sample-staff-auth` 完成同类归位，并将 `variables.ts` 归入
  `features/variables/variables.ts`。
- `sample-console` 的 `assembly.tsx`、`baseModuleDescriptors.ts`、`terminalSurfaces.ts` 已分别归入
  `assembly/` 与两个 `application/` 文件；assembly 中原有四处 `createElement` 已改为 JSX 等价树，
  保留 Provider、content、props、fallback 与 sibling 顺序。运行时装配缺失的
  `localNodeId: createNodeId()` 已按原有契约恢复。
- Android 的 `androidDevice.ts`、`imeInsets.ts`、`androidPersistKv.ts` 已归入各包的
  `implementations/`；sample-terminal 的 `platformPorts.ts` 已归入 `assembly/`。
- `src/index.ts` 与受影响测试只调整了归位后的 import/export 路径；没有新增公共导出、兼容层或
  fallback。六个 L checker 已在 `tools/terminal-readability/checker-manifest.json` 启用。
- CP-4 内对 TR-R04 暴露的多参数职责完成对象参数收敛；对 TR-R05 暴露的深控制流完成按职责的
  focused helper 拆分。拆分前后的测试观察仍是原有结果型 oracle。
- TR-R02 的四个残留 local export 汇总块已分别改为定义处导出或删除无消费者的局部类型导出；
  `stateRuntimeSliceRegistrationBrand` 保持定义处 export，未改变内部唯一 symbol 语义。

## 真实 focused 输出

### TypeScript

`yarn --cwd apps/terminal typecheck` 退出码 `0`，真实结果为 27 个 package 成功。

受 CP-4 直接影响的包在全终端 typecheck 中均通过；在修正搬运时遗漏的原有
`createRuntime` 配置字段后，`sample-console` 与 `sample-terminal` 也重新通过。

### 包测试

`yarn --cwd apps/terminal test` 退出码 `0`，真实结果为 20 个成功任务。
其中受 CP-4 直接影响的有测试包均通过：sample-member-desk 24、sample-staff-auth 7、
sample-console 15、Android device 2；dual-screen 没有测试文件。kernel/base 的既有测试也在
同一次终端测试序列中通过，未修改其断言语义。

### L checker 与模型红向量

`node tools/terminal-readability/check-static.test.mjs` 退出码 `0`，模型套件真实输出为：

```text
MODEL_TR_R02=PASS
MODEL_TR_R03=PASS
MODEL_TR_R04=PASS
MODEL_TR_R05=PASS
MODEL_TR_R06=PASS
MODEL_TR_R07=PASS
MODEL_RD12=PASS
MODEL_RD13=PASS
MODEL_RD14=PASS
MODEL_RD09_RD11=PASS
READABILITY_MODEL=PASS
```

模型测试夹具使用独立的禁用 manifest，避免生产 manifest 已全启用后把“已登记且启用”的状态
误当成模型 red mutation；模型 red fixture 与 negative control 仍由同一个 checker 实现判定。

CP-4 启用后的真实全树 readability gate 输出为：

```text
READABILITY_RULE_GATES=6
RULE_TR_R02=PASS
RULE_TR_R03=PASS
RULE_TR_R04=PASS
RULE_TR_R05=PASS
RULE_TR_R06=PASS
RULE_TR_R07=PASS
READABILITY_STATIC=PASS
```

### 既有 terminal static sequence

命令 `yarn --cwd apps/terminal verify:static` 以 runId
`ter-local-static-76022-1788787241806` 真实退出码 `0`。终态包含：

```text
READABILITY_MODEL=PASS
READABILITY_STATIC=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
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
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
TERMINAL_UI_STATE_STATIC=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_STATIC=PASS
```

过程中保留并修复了两条首次失败：

1. 目录归位后 skeleton fixture 仍指向 `src/platformPorts.ts`；根因是 CP-4 已把生产文件归入
   `src/assembly/platformPorts.ts`。已同步 `tools/terminal-skeleton/check-static.mjs` 及其模型
   fixture 到新 owning path，未放宽 graph comparison。
2. R04 将 persistence 写入函数参数改为对象后，state model mutation 仍匹配旧参数名，首败为
   `FIRST_FAILURE=state-model-test:storage-result-consumed: expected FAIL, got PASS`。已按当前
   owning source 更新 mutation，使它重新真正移除 write result 的消费；模型门恢复 PASS，未改生产
   storage 行为。

### lint 边界

`yarn --cwd apps/terminal lint` 退出码 `0`，但 Turbo 输出
`WARNING No tasks were executed as part of this run. Tasks: 0 successful, 0 total`。
因此本证据只记录命令成功且无任务执行，不把它冒充为 lint 规则已执行的证明。

## 证据边界与阶段结论

上述是静态、TypeScript typecheck、包测试与模型/真实 static sequence 证据。它证明了 CP-4
归位、六个 L checker 的真实全树结果、相关测试与静态门通过，以及 JSX 等价改写和职责拆分没有
破坏现有 focused oracle；它不证明真实 Web pointer 命中、Android 副屏输入、真实视觉结果、
生产 bundle DCE、DEV、seed、UAT 或部署。

`CP-4_FOCUSED_PROOF=PASS`。进入 CP-5 前仍须完成 fresh 独立子 agent 的 CP-4 阶段三维对账；
任何 `OPEN` 必须先修复并复查。

## CP-4 阶段三维对账

`REVIEW_CYCLE_ID=TER_READABILITY_IMPLEMENTATION_2026_09_07`
`REVIEW_TARGET=IMPLEMENTATION_STEP_RECONCILIATION`
`reviewerKind=INDEPENDENT_SUBAGENT`
`REVIEW_ROUND=2`
`REVIEW_ROUND_LIMIT=2`
`ROUND_FINAL_DECISION=SELF_DECIDED`
`CP4_STAGE_3D_RECONCILIATION=MATCHED`
`CP4_GATE_TO_CP5=OPENED`

fresh 独立 reviewer Mencius 的第二轮定向结果为 `M=0 / S=0 / N=0`。上一轮 README finding 已
闭合：device、persist-kv、sample-console 的 README 迁移路径与当前 index/export 一致，
`assembly/android/sample-terminal/README.md` 已具备定位、作用、结构、真实用法和迭代指引；
README stale-path 扫描与旧根路径存在性检查无匹配/无残留。

三维核验摘要：

- 需求维：CP-4 目标包归位、15 项词表、六个 L 门、TR-R02/R03/R04/R05/R06/R07 与 RD-10 边界均
  与当前源码和 README 一致；没有将 CP-5 内容提前计入 CP-4。
- 详设/计划维：迁移后的 `assembly/`、`application/`、`implementations/`、`features/*`、
  `parts/` 路径，sample-console JSX 树和 `localNodeId`，以及 CP-4 proof/static sequence 均可
  与当前 source 对齐；`SELECTED_IMPORT_EXPORT_RESOLUTION=PASS`。
- 项目记忆/规范维：主 agent 写入边界、行为 oracle 证明要求、静态/typecheck/test 证据分层和
  Web/Android/DEV/UAT/DCE 未取证边界均保持；未使用调用次数、prop、字符串或 transform 前尺寸
  作为行为唯一证明。

第二轮 reviewer 未重跑 typecheck、test 或完整 static sequence；这些结果以本文件前述主 agent
  真实 run-scoped 输出为证，不把 reviewer 的只读复核冒充运行证据。CP-4 无未闭 `OPEN`，已允许
  进入 CP-5。
