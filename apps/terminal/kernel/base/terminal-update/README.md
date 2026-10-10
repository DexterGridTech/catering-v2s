# `kernel.base.terminal-update`

| 项目 | 内容 |
|---|---|
| workspace 包 | `@catering-v2s/kernel-base-terminal-update` |
| 类型 | `owner`，拥有 terminal update 的任务状态与 command |
| 层 | `apps/terminal/kernel/base` |
| 依赖 | `kernel.base.contracts`、`kernel.base.platform-ports`、`kernel.base.runtime`、`kernel.base.state` |
| 使用方 | `ui.integration.sample-console`、`ui.integration.sample-wallpaper-console` 的 composition |

## 定位

本包是 Runtime 内终端更新执行任务的唯一 owner：接收 project-basic 选中的单条候选，复核本机实际版本与当前上下文，固定不可变任务，持久化当前任务与最近状态，并以 command 编排注入的 `UpdatePort`。它不是项目规则 owner、Android installer、下载器、React 页面或测试 runner；宿主能力由 platform port 提供，业务候选由 feature owner 提供。

## 作用与边界

当逻辑需要复核、固定或推进一个终端更新任务，并且结果属于更新任务状态时，放在本 owner；项目、大区、集团资料与项目规则由 `kernel.feature.project-basic` 选择并通过 `requestTerminalUpdateCommand` 提交；当逻辑负责 Android 安装、文件加载或宿主生命周期时，放在 adapter/application；当逻辑只呈现状态或发起用户动作时，放在 UI/integration。command 不接受任意 artifact 路径。

本包持久化 `currentTask`、`recentStatus` 与 `failedArtifactIds`，使用 owner-only persistence、slice retain 与 isolated sync。它不保存第二份 APK/HOT 文件账本，也不伪造 Web 上的原生事实。

## 结构

```text
src/
  application/createTerminalUpdateModule.ts  注册 owner、注入 port/provider，并在 initialize 时重协调
  features/commands/commands.ts              声明 public command 与内部重协调 command
  features/actors/terminalUpdateActor.ts     串行固定目标、持久化并编排更新端口
  features/slices/terminalUpdate.ts          唯一任务状态 slice 与持久化描述
  selectors/selectors.ts                     对外读取实际版本、当前任务和最近状态
  types/terminalUpdate.ts                    目标、任务、状态与 provider 契约
  dependencies.ts、moduleName.ts             包依赖和 Runtime 模块身份
  index.ts                                   显式公共导出
test/terminalUpdate.test.ts                  owner command、状态、持久化与并发 focused tests
terminal-invariants.json                     公开面与本包验证归属
```

## 用法

composition 创建模块时注入实际 `UpdatePort`，并从 project-basic 注入当前业务上下文事实与候选复核器。feature 先用 `selectProjectTerminalUpdateCandidate` 选择一条适用规则，再通过公开 command 提交固定候选；base 只复核该候选，不读取或缓存规则集合。以下 command 调用与 selector 读取形态来自本包测试：

```ts
import {
  requestTerminalUpdateCommand,
  createRequestTerminalUpdatePayload,
  selectTerminalUpdateTask,
} from '@catering-v2s/kernel-base-terminal-update';

const result = await runtime.dispatchCommand(
  requestTerminalUpdateCommand,
  createRequestTerminalUpdatePayload(target),
  {requestId},
);
const task = selectTerminalUpdateTask(runtime.getState());
```

`requestTerminalUpdateCommand` 接收业务 feature 已选择的单条候选；update owner 复核当前事实并固定任务，实际版本比较与执行仍归 update。另有 `confirmTerminalUpdateBootCommand` 与 selectors `selectTerminalUpdateActualVersions`、`selectTerminalUpdateRecentStatus`，调用者应继续通过 Runtime 的公开 command/selector 路径访问。

## 在这个包上迭代时

- 先回读正式更新需求、阶段 A 详设/计划、终端编码规范 TR-09/TR-10，以及 `platform-ports` 的 `UpdatePort` 契约；核实当前 adapter 与两处 integration composition 后再改。
- 持久状态只允许按已批准 slice 字段和 reset/sync 意图维护；不要增加第二账本、任意路径输入或绕开 actor 的状态写入。
- 修改后运行本包的 focused tests、typecheck 和 lint：

  ```sh
  yarn workspace @catering-v2s/kernel-base-terminal-update test
  yarn workspace @catering-v2s/kernel-base-terminal-update typecheck
  yarn workspace @catering-v2s/kernel-base-terminal-update lint
  ```

- 改变 command/selector、持久化或原生消费边界时，同步两个 application composition、验收夹具和详设判据；只在对应受管 runner 中验证动态行为。持久化失败不得留下可见的半固定任务，重复命令不得覆盖已固定的不同目标。
