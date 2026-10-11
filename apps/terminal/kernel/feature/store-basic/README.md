# `kernel.feature.store-basic`

## 定位

这是终端当前绑定门店资料的业务 owner，`owner` 包。它依赖 terminal-data-client 的公开 command/selector 获取 CBS 事实，由 sample integration 装配并提供 Runtime。它不拥有项目、大区、集团资料和版本规则（由 `project-basic` 拥有），也不承载页面或 HTTP 传输实现。

## 作用与边界

凡是具体门店、营业规则、有效合同、服务点区域或服务点事实，连同这些事实的读取、持久化和刷新，放入本包；组织路径与项目版本规则放入 `project-basic`；终端激活凭证、TDS 协议与 topic 通讯仍归 terminal-data-client。

MASTER 根据当前绑定读取并持久化门店资料和营业规则，成功后发送 `storeBasicInformationLoadedCommand`，由 `project-basic` 据此开始读取项目资料。合同和服务点由本包的对应初始化 command 加载。收到 topic 变更后，本包重新读取 owner 数据并提交通知。SLAVE 只消费 MASTER 投影，不独立读取或订阅 CBS。

owner-only slice 持久化绑定、门店、营业规则、合同、区域和服务点。运行时就绪状态、topic 读取状态与失败诊断保持本地；这些诊断不是可同步业务事实。

## 结构

```text
src/
├── application/module.ts                 # 注册 actor、公开 command/selector 与持久化 slice
├── features/actors/actors.ts              # 读取门店事实、刷新 topic、处理服务点加载
├── features/commands/commands.ts          # 初始化、资料就绪通知、服务点及 topic command
├── features/slices/slice.ts                # 门店 owner 状态、持久化和 MASTER→SLAVE 投影
├── selectors/selectors.ts                  # 门店资料、绑定、就绪状态和 topic 状态读取
├── types/types.ts                          # 绑定、事实包装和读取状态类型
├── dependencies.ts / moduleName.ts         # 依赖声明及目录派生身份
└── index.ts                                # 包的唯一公开导出面
test/
└── storeBasic.test.ts                      # 读取、持久化、topic、投影和竞态行为
terminal-invariants.json                    # 公开导出和包级机械约束
```

## 用法

由装配持有的 Runtime 读取已持久化的门店事实和初始化就绪状态：

```ts
import {selectStore, selectStoreBasicLoadReadiness} from '@catering-v2s/kernel-feature-store-basic';

const store = selectStore(runtime.getState());
const readiness = selectStoreBasicLoadReadiness(runtime.getState());
const storeName = readiness.storeStatus === 'flushed' ? (store?.value.name ?? null) : null;
```

selector 的返回结构来自本包实际公开类型；启动初始化由 `createStoreBasicModule` 注册的 `initializeStoreBasicCommand` 处理，调用方无需直接操作 slice。

## 在这个包上迭代时

- 新增数据前先判定它是否属于具体门店资料；同步 actor、slice 持久化/投影、selector、公开 barrel、`terminal-invariants.json`、本 README 与 focused 测试。
- 不要让 SLAVE 重新读取 CBS；不要把运行时诊断放入 MASTER→SLAVE 业务投影；门店资料就绪后通过 `storeBasicInformationLoadedCommand` 交接，不让本包与 `project-basic` 互相等待。
- 修改后运行：

  ```sh
  yarn workspace @catering-v2s/kernel-feature-store-basic typecheck
  yarn workspace @catering-v2s/kernel-feature-store-basic test
  yarn workspace @catering-v2s/kernel-feature-store-basic lint
  node tools/terminal-skeleton/check-static.mjs
  ```

- `src/index.ts` 是唯一公开面；公开 selector、command 或类型变更必须同步 `terminal-invariants.json` 与消费者。新增初始化/刷新竞态时，在 `storeBasic.test.ts` 加确定性屏障用例，断言最终资料与订阅事实，不能只断言 command 返回值。
