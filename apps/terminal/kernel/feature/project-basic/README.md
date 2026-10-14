# 终端项目资料与版本规则

## 定位

`kernel.feature.project-basic` 是终端侧项目、大区、集团资料及项目版本规则快照的业务 owner。它依赖 `store-basic` 提供已持久化的门店事实，通过本包私有 HTTP client 调用 CBS，并通过 terminal-data-client 的公开 command 发送已认证请求。它不拥有门店、合同或服务点事实，也不执行或保存更新任务。

## 业务边界

- `store-basic` 持有具体门店及门店范围集合；本包只在收到 `storeBasicInformationLoadedCommand` 后读取该绑定对应的组织路径。
- 本包持有组织路径、规则快照、加载状态及更新候选判断；组织通知变化后重新读取权威组织路径，订阅路径中的项目、大区、集团 topic，并按 `collectionHash` 分页读取项目规则。
- 只有当前 MASTER、当前绑定、已刷新的门店和完整规则快照均匹配时，候选 selector 才返回更新目标。本包向 `terminal-update` 发送公开 command；更新版本比较、任务固定、安装/加载和报告均由 `terminal-update` 负责。
- 项目资料和规则快照由 MASTER 持久化并投影给 SLAVE；本地读取状态、刷新 generation 和失败诊断不进入投影。

## 结构

```text
src/
├── application/module.ts                              # 注册 actor、command、selector 与持久化 slice
├── declarations/commands.ts                           # 初始化与 topic 刷新 command
├── declarations/topics.ts                             # 项目、大区、集团及更新规则 topic 身份
├── features/actors/projectBasicActor.ts               # 唯一 actor；协调加载、通知与更新请求
├── features/actors/shared/createOwnerHttpClient.ts    # 本包专用的 TDC 认证请求适配
├── features/actors/shared/loadProjectContext.ts       # store-ready 后读取组织路径并接续规则刷新
├── features/actors/shared/reconcileProjectTopicSubscriptions.ts # 组织路径 topic 的增删协调
├── features/actors/shared/refreshProjectRuleSnapshot.ts # 规则分页、校验、刷新状态与持久化
├── features/slices/projectBasicState.ts                           # 组织/规则 owner 状态及主副投影
├── selectors/select*.ts                               # 每个公开 selector 独立定义
├── selectors/shared/                                  # 候选与更新资格读取的内部纯 helper
├── selectors/fixedTargetFromProjectCandidate.ts       # 候选转固定更新目标的公开纯转换
├── types/types.ts                                     # 持久化规则与候选类型
├── dependencies.ts / moduleName.ts                    # 依赖声明及目录派生身份
└── index.ts                                           # 唯一公开导出面
test/
├── projectBasic.test.ts                               # actor 读取、刷新、订阅和失败边界
└── projectBasicRuntime.test.ts                        # Runtime 装配及公开调用链
terminal-invariants.json                               # 包公开面和允许的状态写入边界
```

## 公共接口

- Commands：`initializeProjectBasicCommand`、`refreshProjectBasicTopicCommand`、`refreshProjectTerminalUpdateRulesCommand`。
- Selectors：`selectProjectBasicState`、`selectProjectBasicLoadReadiness`、`selectProjectOrganizationPath`、`selectProjectTerminalUpdateContextFacts`、`selectProjectFixedTerminalUpdateContextFacts`、`selectProjectTerminalUpdateCandidate`、`selectProjectTerminalUpdateRules`，以及项目、大区和集团资料 selector。
- 更新任务必须通过本包 actor 调用 `terminal-update` 的公开 command；调用方不能直接改本包 slice。
- `createOwnerHttpClient` 和生成的 CBS client 仅供本包内部使用，不从 package root 导出。

装配后的调用方可通过公开 selector 按当前 App 与门店读取可用候选；尚无完整匹配快照时返回 `null`：

```ts
import {selectProjectTerminalUpdateCandidate} from '@catering-v2s/kernel-feature-project-basic'

const candidate = selectProjectTerminalUpdateCandidate(
  runtime.getState(),
  'com.example.console',
  storeRef,
)
```

`storeRef` 应来自当前已就绪的门店绑定；固定任务仍由本包 actor 通过 `terminal-update` command 发起。

## 刷新与失败处理

规则快照按当前组织路径建立订阅后，通过 `collectionHash` 和 opaque cursor 读取。单页上限为 1 MiB、整份快照上限为 8 MiB；服务端报告集合变化时最多按既有三次预算重读。无效项、重复 cursor、重复规则、超限、订阅失败、读取失败或持久化失败都会保持快照非就绪并记录失败状态；不得把部分页面当作完整快照提交。新的组织读取或规则刷新 generation 会使旧异步结果失效。

订阅、刷新及请求状态由本包 actor 在 Runtime 生命周期内持有；Runtime reset/dispose 后不保留活动请求。失败时不自行启动后台轮询或恢复任务，调用者可依据公开状态和现有通知/刷新 command 继续业务流程。

## 在这个包上迭代时

新增事实前先确认归属；如修改组织路径或规则候选判据，同步本包 selector、slice 持久化/主副投影、公开 barrel、`terminal-invariants.json`、中文 README 和 focused 测试。新增读取仍经 `createOwnerHttpClient` → TDC authenticated command，不旁路配置、凭证或 transport。

修改依赖或公开面后运行：

```sh
yarn workspace @catering-v2s/kernel-feature-project-basic typecheck
yarn workspace @catering-v2s/kernel-feature-project-basic test
```

Runtime 交接由 `projectBasicRuntime.test.ts` 覆盖；selector 单测不能替代真实 actor 调用链测试。
