# `kernel.feature.project-basic`

## 定位

这是终端侧项目资料与项目版本规则的业务 owner，`owner` 包。它依赖 `store-basic` 提供已持久化的门店事实，并通过 terminal-data-client 的公开接口读取 CBS owner 数据；sample integration 装配两个包并消费其公开 command、selector。它不拥有门店、合同或服务点事实，也不执行和保存更新任务。

## 作用与边界

只有属于“项目/大区/集团资料，或项目版本规则快照”的读取、状态和判断才放入本包；属于具体门店、营业规则、合同或服务点的数据放入 `store-basic`；属于版本比较、任务固定、安装/加载和报告的行为放入 `terminal-update`。

store-basic 发出 `storeBasicInformationLoadedCommand` 后，本包读取当前绑定对应的组织路径、订阅项目 topic 并加载适用的版本规则。仅当门店、组织路径和规则快照均与当前绑定匹配时，`selectProjectTerminalUpdateCandidate` 才返回当前应用和门店的候选；候选通过公开更新 command 交给 `terminal-update`。项目资料与规则快照由 MASTER 持久化并投影给 SLAVE，本地读取状态和诊断不进入投影。

## 结构

```text
src/
├── application/module.ts                 # 注册本包的 actor、command、selector 与持久化 slice
├── features/actors/actors.ts              # 组织资料、topic 与规则快照的读取和候选交接
├── features/commands/commands.ts          # 初始化与 topic 刷新的公开 command 定义
├── features/slices/slice.ts                # 项目资料/规则快照的 owner 状态、持久化和主副投影
├── selectors/selectors.ts                  # 对外只读组织资料、就绪状态与升级候选
├── types/types.ts                          # 持久化事实与候选的具名类型
├── dependencies.ts / moduleName.ts         # 依赖声明及目录派生身份
└── index.ts                                # 包的唯一公开导出面
test/
├── projectBasic.test.ts                    # actor 读取、刷新、订阅与边界行为
└── projectBasicRuntime.test.ts             # Runtime 装配、初始化与公开调用链
terminal-invariants.json                    # 公开导出和包级机械约束
```

## 用法

由装配持有的 Runtime 读取当前应用和门店的适用候选；空值表示当前上下文未就绪或没有适用规则：

```ts
import {selectProjectTerminalUpdateCandidate} from '@catering-v2s/kernel-feature-project-basic';

const candidate = selectProjectTerminalUpdateCandidate(runtime.getState(), applicationId, storeRef);
```

selector 的参数顺序和公开入口与 `sample-console`、`sample-wallpaper-console` 的装配一致。提交候选时由本包 actor 调用 `terminal-update` 的公开 command；调用方不直接改本包 slice。

## 在这个包上迭代时

- 新增业务事实前先确认它属于项目/大区/集团或项目规则；同步 slice、持久化/主副投影、selector、公开 barrel、`terminal-invariants.json`、本 README 与 focused 测试。
- 修改候选条件时覆盖绑定、当前门店、应用标识及规则快照上下文；不要把终端实际版本或更新执行状态复制到本包。
- 修改依赖或公开面后运行：

  ```sh
  yarn workspace @catering-v2s/kernel-feature-project-basic typecheck
  yarn workspace @catering-v2s/kernel-feature-project-basic test
  yarn workspace @catering-v2s/kernel-feature-project-basic lint
  node tools/terminal-skeleton/check-static.mjs
  ```

- package root 的导出必须与 `src/index.ts`、`terminal-invariants.json` 和实际消费者保持一致；`projectBasicRuntime.test.ts` 验证 Runtime 交接，不能只靠直接 selector 单测替代。
