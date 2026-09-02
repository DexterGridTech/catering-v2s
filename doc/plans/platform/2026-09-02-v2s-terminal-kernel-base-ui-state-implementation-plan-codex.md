# V2S TER `kernel.base.ui-state` 实施计划（Codex）

> 状态：`IMPLEMENTATION_COMPLETE`
>
> 设计依据：`doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-ui-state-implementation-design-codex.md`
>
> 本文件记录已获授权执行的 CP 顺序与证据；其中的实施记录不扩大本次授权边界。

## 1 · 目标、边界与完成定义

在不新增并行分区/持久化/渲染机制的前提下，将 `kernel.base.ui-state` 从骨架变为 owner package：

- 两个 workspace partitioned slice family（内容集、变量），每个 family 恰好 MAIN/BRANCH；
- 内容在每个 workspace 内再由显式 `displayMode` 定位；
- catalog 为一次构建、冻结、无 React 的实例值；
- `uiVariable` 的 key/default/type/persistIntent 在 declaration 处，持久化复用 state record descriptor；
- 六条 command 经 actor 写入，业务方不 dispatch action；
- focused proof、静态 exact-set/red vector 和 package documentation 均闭合；角色翻转 proof 同时覆盖
  `BRANCH × PRIMARY → MAIN × SECONDARY → BRANCH × PRIMARY` 两个维度。

不包含 render 空页面、renderer 注册、上游业务 screen、跨节点 sync、adapter/native/assembly、DEV、seed、
L2、UAT 或部署。未来动态命令不得在本计划授权下运行。

## 2 · 前读纪律（每个 CP 均须做）

每个 CP 写前和 focused proof 后必须用同一份输入逐项回读，不以之前 CP 的口头结论代替：

1. 原始需求 §1.1、§2、§4、§6、§8、§8.2；
2. 本详设相应小节；
3. `AGENTS.md`、`doc/platform/terminal-coding-standard.md`（至少 TR-01、TR-04、TR-05、TR-09、TR-10、TR-11）、
   六维 route 命中的 terminal memory；
4. owning source：ui-state 当前文件、state workspace/partition/persistence、runtime actor/command、
   display-context derivation/selector，以及本 CP 将改的 checker/test；
5. focused proof 后重开同一条分母，证明没有引入本地 partition router、React、目录外 UI、或未声明依赖。

每个 CP 结束后、下一 CP 开始前，须有 fresh 独立子 agent 做需求/详设/项目记忆三维对账；全部 CP
完成、整体测试前，再做一次全批三维对账。它们不替代最终 `REVIEW_TARGET=IMPLEMENTATION`。

## 3 · CP 顺序

### UI-P0 · 先固定 package 边界与测试骨架

**RECALL/owning source**：ui-state `package.json`、`tsconfig.json`、`moduleName.ts`、`index.ts`、
`terminal-invariants.json`、`apps/terminal/skeleton-graph.ts`；display-context 已实施的 package/test/README
形态；terminal static runner 先例。

**变更**：

- 在 `package.json` 直接声明现有 `@reduxjs/toolkit: 2.12.0`，加入已有 runner 形态的 `test` script 与
  `vitest` development dependency；不升级任何库；
- `tsconfig` 纳入 `test/**/*.ts`，`moduleName.ts` 导出 owner `moduleKind`；
- skeleton graph 的本包从 `plannedKind:'owner'` 转为实际 kind，保持五条现有 workspace dependencies；
- 建立 `test/`、`vitest.config.ts`、public-surface typecheck、package invariant、中文 `README.md` 与
  `HANDOFF.md` 的基础形态；README 说明本包是状态协议而不是 render/catalog-global owner；
- 建立 ui-state 专属 static checker/test harness，但此 CP 不填写后续行为规则。

**proof**：typecheck 能解析 test 源；owner kind、声明的 RTK、五条 workspace dependency 与 package name
互相一致；新增一个未声明 workspace import、错误 kind、或多 root export 各能使对应静态/类型门变红。

**完成信号**：只完成可运行 package/test/gate 骨架，不把“测试入口存在”报作状态模型完成。

### UI-P1 · catalog 与 variable declaration（无 Redux 写入）

**RECALL/owning source**：需求 §3、§4.2、§4.4、§8 A-5/A-6/A-7/A-8/A-9/A-15；contracts
`createModuleParameterFactory`；state `PersistIntent`/`StateJsonValue`/record descriptor；ui-state package。

**变更**：

- 新增 types/foundations：catalog entry/context/value、catalog builder，UI variable declaration/write 与
  module factory；
- catalog 对 `Reflect.ownKeys` 做批准字段精确校验，拒绝 component/element/lazy/function/symbol/non-enumerable
  extra key；再构造新的 canonical 冻结 entry/list/record index。duplicate `partKey` 拒绝、三维闭集输入验证、无 React component；
- variable full key 由 moduleName 工厂生成；default/persistIntent 留在 declaration；duplicate full key 在
  module factory composition registry 构建时拒绝；declaration 带包内 factory brand，组合边界校验 exact own-key
  集合与 `key` 的 `moduleName.` 前缀，拒绝结构伪造或前缀错配的变量进入 registry；
- `selectAvailableParts(catalog, containerKey, context)` 只作 catalog 枚举，不读 state、更不为 command 提供
  admission gate；
- root index 只接入 §6 的这部分 public types/helpers；`selectUiVariable` 不作脱离 module 的 root export，
  它是 `UiStateModule` 上绑定冻结 declaration registry 的 instance method。

**focused proof**：duplicate partKey throw；builder result/entries/index immutable；catalog 无 register；同 local key 的
不同 module 得到不同 key；write helper 保持 T；模块组合拒绝无 factory brand 或 `key`/`moduleName` 前缀错配的
declaration；`never`/`owner-only` 类型来源为 state；枚举三维过滤；
状态 DTO 不含 title/description/renderer。反向改 map 覆盖、去 module prefix、传入 `{component(){}}`、symbol 或
non-enumerable extra key、或让 show validation 调 catalog 时各自红。

**完成信号**：catalog/variable 是纯实例值与类型能力，尚未添加 command/slice。

### UI-P2 · workspace 内容 family 与显式 surface command

**RECALL/owning source**：需求 §1.1、§2、§4.1、§4.3、§8 A-1/A-2/A-3/A-10/A-13/A-14/A-16/A-17/A-18；
state `workspace.ts`、`workspace.test.ts`、partitioned helper；runtime actor/command API；display-context
`resolveWorkspace`/`resolveSurfaceDisplayMode` 与双屏 SLAVE eligibility test。

**变更**：

- 新增 content types、PRIMARY/SECONDARY 空 initial state、canonical RTK action slice、MAIN/BRANCH 的两个
  registered RTK slices，及 `toWorkspaceStateDescriptors` registrations；
- content descriptor 仅通过 record entries 暴露两组 `containers`，hydrate merge 不触碰 `layers`；
- 定义 `showScreen/openLayer/closeLayer/clearLayers` command、payload guards、actor 与脱敏 duplicate-layer
  diagnostic；actor 先从 root 推导当前 workspace，再以该值调用
  `createWorkspaceActionDispatcher({routeContext:{workspace}, dispatchAction})`；
- selector 通过 root 的 `selectRuntimeInstanceMode + selectDisplayRole + resolveWorkspace` 读取当前 partition，
  并把 `displayMode` 作为不可省略参数；
- `createUiStateModule` 注册 content family 和四 command/actors，catalog 不参与任何写入决定。

**focused proof**：

- 公开 command/selector 覆盖 MAIN/BRANCH × PRIMARY/SECONDARY 四桶：PRIMARY/SECONDARY 隔离、同 mode 跨 workspace
  隔离；SLAVE CHIEF↔VICE 断言 **`BRANCH × PRIMARY → MAIN × SECONDARY → BRANCH × PRIMARY`** 三个端点,
  且原 entry 保持在 BRANCH 分区而不搬运；BRANCH × SECONDARY 保留在四桶隔离矩阵中,但明确记录为当前规则不可达；
- duplicate layer reject/diagnostic/stack unchanged；close absent id idempotent；clear 只清一个 mode；
- payload SECONDARY 与 routeContext PRIMARY 冲突时仍写 SECONDARY；
- empty container selector 返回 undefined；restart 只恢复 containers；
- MAIN 写、BRANCH 读为空；将 content reducers 断为一份 slice 后同一四桶行为用例红；
- U-11 前提：two display SLAVE eligibility 必拒，防止 displayMode 单射证明随上游悄然失效。

**完成信号**：content 有且仅有两个 workspace registration，mode 始终在 state 内显式寻址；无 queue、首屏或
displayIndex state。

### UI-P3 · workspace variable family、声明驱动持久化与余下两条 command

**RECALL/owning source**：需求 §4.4、§4.5、§8 A-8/A-9/A-15/A-16/A-17/A-18；state
`StateRuntimePersistenceRecordDescriptor`、`defineStateRuntimeSlice` 与 X-4；CP-1 declaration table、CP-2
workspace action routing。

**变更**：

- 用同一 workspace 三件套建 variable canonical action slice 和 MAIN/BRANCH registered RTK slices；
- `setUiVariables` payload 只传 JSON-safe `{key,value}` entries，由泛型 `createUiVariableWrite` 在调用点绑定 declaration
  与 `T`；actor 再验证 declaration table、重复 key 与 StateJsonValue，`clearUiVariables` 同样只收已声明 key，随后原子 dispatch；
- variable record descriptor 以 `shouldPersistEntry` 查询 declaration intent，不删内存中的 never entry；
- `UiStateModule.selectUiVariable` 从当前 workspace 读取，先以 object identity 验证 declaration 属于该 module
  的冻结 registry，缺值才回注册 declaration default；
- module factory 注册第二 family 和两 command/actors；补齐 public export exact set。

**focused proof**：typed batch 的每一项与 declaration T 绑定；MAIN/BRANCH 变量隔离；never 不入 fake storage、
新 runtime 不恢复，owner-only sibling 落盘并恢复、clear 后 storage entry 删除且 sibling 不受影响；未知/重复
declaration key 被拒；同 key 但不同 default/persistIntent 的 fake declaration 读取必须 fail closed；去掉
`shouldPersistEntry` 或拍平 workspace 后各自红。

**完成信号**：本包零自有 persistence enum/开关、零 `Record<string, any>`、零分区 helper。

### UI-P4 · 机械控制、包文档与全批静态闭合

**RECALL/owning source**：需求 §8/§8.2；本详设 §6/§7；terminal standard TR-04/TR-09/TR-10；
ui-state root index、all ui-state source、invariant/checker harness、terminal skeleton graph/verify-static。

**变更**：

- 完成 public exports、owner kind、RTK createSlice/no manual action creator（包括无 `@@` 的 `type` string）、workspace import-origin、
  no React/RN、no queue、no own persistence type、no layer persistence、四 registration 显式 isolated/no sync、
  catalog-copy-not-state 等 exact/static gates；
- 为每一道机械门添加独立 target-only red vector，更新 terminal verify-static 组合；A-17 必须注入
  `({type:'legacy/action'})` 这类无 `@@` 的手写 action，A-18 必须覆盖任意命名的本地 helper 与直接 suffix 拼接；
- README 写中文定位/判别式/结构/真实 public API 示例/迭代检查；HANDOFF 仅登记 render/automation/同步等未做边界；
- 在 implementation record 明确 §8.2 三项不可机器判定，不能改写为 PASS。

**focused proof**：A-1 至 A-18 对应行为或 gate 输出均有绿；§7.2 每个 red vector 实施一次并恢复；任一 vector
只红目标 gate。尤其 A-16 的行为、A-17 `@@` 常量、A-18 任意命名的本地 key/router 替换与直接 suffix 拼接必须保留实际 red 证据。

**完成信号**：静态门与 behavior proof 都完成；还不能把它们称作 adapter/native/DEV/L2/UAT 证据。

### UI-P5 · 整体验收与 review handoff

**整体前读**：重新覆盖 UI-P0 至 UI-P4 的原始需求、详设、memory/terminal standard、owning source 和
proof outputs；不得把 CP 结论拼接成代替整体对账。

**本次实施已执行的本机命令**：

```text
yarn workspace @catering-v2s/kernel-base-ui-state typecheck
yarn workspace @catering-v2s/kernel-base-ui-state test
node tools/terminal-ui-state/check-static.test.mjs
node tools/terminal-ui-state/check-static.mjs
node tools/terminal-ui-state/check-behavior.mjs
yarn workspace @catering-v2s/terminal verify:static
yarn workspace @catering-v2s/terminal verify
```

上述命令均只覆盖本机 package/static/assembly export 与 cleanup；本批没有执行 DEV、seed、L2、UAT、部署或
任何数据操作。行为 mutation harness 只在临时副本中改写实现并在 `finally` 清理。

**交付**：保存每个命令的新鲜输出、每个 red vector 的失败输出与恢复读回、public/registration/command/
actor 精确集合、U-1..U-11 的实际绿色用例、不可证明边界。随后发起 fresh
`REVIEW_TARGET=IMPLEMENTATION`，再由 Dexter/Claude 静态 review；“按详设实现”不构成复核豁免。

**本次实施记录（2026-09-02）**：ui-state package typecheck 通过；package test 为 6 files/27 tests；U-1～U-11
acceptance 为 12/12；behavior harness 基线 12/12，U1～U11 及 U6_CLEAR/U6_FORGED/U8_REGISTRATION/U9_SYMBOL/U9_REGISTER
全部以 focused mutation 变红并 cleanup PASS；ui-state static 八道规则、support 与 target-only red vector 全部回绿；
terminal `verify:static` 与修复后 `verify` 均 PASS。机器不可判项仍按 §7.3 保留为评审边界。

## 4 · 逐文件变更清单（本次已实施范围）

| 动作 | 范围 | 唯一职责 |
|---|---|---|
| 修改 | `apps/terminal/kernel/base/ui-state/package.json`、`tsconfig.json` | RTK direct dependency、test runner/type inclusion；保留骨架既有 `platform-ports` dependency（它是 module graph 的已声明边，不为“用上它”新增端口行为） |
| 修改 | `src/moduleName.ts`、`src/dependencies.ts`、`src/index.ts`、`terminal-invariants.json` | owner identity、依赖/精确公开面、invariant |
| 新增 | `src/types/{content,catalog,variable}.ts` | 不含 React 的 state/catalog/declaration 类型 |
| 新增 | `src/foundations/{catalog,uiVariable,workspaceSlices,persistence}.ts` | frozen catalog、key factory、RTK workspace families、descriptor builders |
| 新增 | `src/features/commands/*`、`src/features/actors/*` | 六 command 与唯一写 actor |
| 新增 | `src/selectors/*`、`src/application/createUiStateModule.ts` | 显式 mode read、当前 workspace read、module composition |
| 新增 | `test/*`、`vitest.config.ts` | behavior/type/persistence/red control proof |
| 新增 | `README.md`、`HANDOFF.md` | TR-10 中文包内说明和未做边界 |
| 新增/修改 | `tools/terminal-ui-state/*`、相关 terminal verify-static 输入 | package exact gates 与 target-only red fixtures |
| 修改 | `apps/terminal/skeleton-graph.ts` | 将本包计划 owner 升格为实际 owner |
| 修改（依赖生成结果） | workspace lockfile | 仅反映已存在 RTK 2.12.0 的 direct declaration；不得变更版本集合 |

禁止修改 `state` workspace helpers、`display-context` 产品行为、`runtime` 调度、任何 ui render/automation
生产代码、adapter/native/assembly 或动态脚本。若真实最小变更面超出表格，暂停并交 Dexter 决定。

## 5 · 实施前不可绕过的停机条件

以下任一项出现，停止当前 CP；不得临时降级或用平行实现继续：

1. workspace 三件套无法以 canonical RTK action 正确路由到 MAIN/BRANCH；
2. persistence record descriptor 不能只 hydrate containers 或不能以 declaration filter variable entry；
3. displayMode 不能作为 command payload 的必填闭集或 selector 的必填输入；
4. catalog 构建需要 React/component/global registration 才能工作；
5. public exact set、行为反例或独红 vector 无法真实变红；
6. 需要改变已裁定的 queue、layer persistence、sync、workspace 隔离或 render 责任；
7. 需要任何未获授权的动态/数据/部署动作。

## 6 · 实施自检结论

CP 顺序先建立声明/catalog 的纯输入，再一次性接 workspace 内容、变量和 command；没有“先单 slice
再补分区”的中间形态。每个 CP 都有 owning-source 前后双读、focused proof 与最小静态反例，且将
render/业务时机/未来单射变化的不可机器项诚实隔离。

**独立实施复核记录**：

```text
REVIEW_CYCLE_ID=UI_STATE_IMPLEMENTATION_2026-09-02
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1/2  reviewerKind=INDEPENDENT_SUBAGENT  verdict=NO-GO  M=1 S=1 N=0
REVIEW_ROUND=2/2  reviewerKind=INDEPENDENT_SUBAGENT  ROUND_FINAL_DECISION=SELF_DECIDED  verdict=GO  M=0 S=0 N=0
```

第一轮提出的变量声明组合边界与 workspace 静态 red-vector 两条 finding 已在授权范围内修复；第二轮对当前
源码与新鲜 package/static/focused/local evidence 定向复核为 `GO`，无遗留 finding。该结论不扩展为 DEV/L2/UAT/部署结论。
