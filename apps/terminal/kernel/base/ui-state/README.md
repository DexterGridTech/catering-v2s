# `kernel.base.ui-state` · TER UI 状态协议

| 项 | 值 |
|---|---|
| npm 名 | `@catering-v2s/kernel-base-ui-state` |
| moduleName | `kernel.base.ui-state` |
| 层 | `kernel/base` |
| kind | `owner`（最终拥有 UI 状态 slice 与命令） |
| 依赖 | `contracts`、`platform-ports`、`state`、`runtime`、`display-context` |
| 被谁依赖 | `ui/base/render`、`ui/base/admin-shell` 等 UI 包 |

## 1. 这个包是什么

它是终端 screen/layer 内容与声明式 `uiVariable` 的状态协议 owner。判别式是：凡是需要按 workspace
隔离、由 command/actor 写入、由显式 `displayMode` 读取的 UI 状态事实，放在这里；安装期 catalog 也在这里
构建并冻结。

当前已完成 P0 包边界、P1 catalog/variable 输入能力、P2 内容 workspace slice/command/actor/selector、P3
变量 workspace slice/command/actor、P4 机械 gate/red vector 与完整 `createUiStateModule`，以及 S-7 catalog
准入列表契约。U-1～U-11 的整体验收与 S-7 catalog proof 由对应测试和临时副本 mutation harness 覆盖；`owner`
表示本包的最终责任归属。

它不是 React renderer、空页面外观、screen queue、设备能力、业务流程、跨节点同步或 automation owner。
这些职责必须留在对应的 render、platform、业务或 automation 包中。

workspace 的 key、action 路由和 state descriptor 只使用 state 包的 workspace 三件套；本包不自造分区键或
路由。所有 slice 使用 Redux Toolkit `createSlice`，变量持久化复用 state 的 `PersistIntent` 和 record
descriptor 的 `shouldPersistEntry`。

## 2. 目录结构

```text
src/
  moduleName.ts                 moduleName/moduleKind 身份
  dependencies.ts               workspace 依赖元数据
  types/                        catalog、变量和 module 实例的纯类型
  foundations/
    assertNonEmptyString.ts     构建期字符串边界
    catalog.ts                  catalog 校验、canonical copy、冻结和枚举
    uiVariable.ts               module 前缀变量声明与 typed write
    valueValidation.ts          JSON-safe 输入校验与冻结副本
    workspaceSlices.ts          内容的 MAIN/BRANCH RTK slice 与 state descriptor
    variableSlices.ts           变量的 MAIN/BRANCH RTK slice 与声明驱动 descriptor
  application/
    createUiStateModule.ts      catalog、变量 registry、command/actor/registration 组装
  features/
    commands/                   show/open/close/clear 内容 command
    actors/                     内容与变量 command 的 runtime actor
  selectors/
    selectContent.ts            显式 displayMode 的 screen/layer selector
  index.ts                      唯一公开面，逐项显式导出
test/
  module.test.ts                包身份和运行时公开值面
  catalog.test.ts               catalog 反例与三维枚举
  variable.test.ts              声明、前缀、默认值与 JSON 边界
  content.test.ts               workspace、displayMode、layer 与重启 proof
  variableRuntime.test.ts       变量隔离、声明 identity、持久化与清理 proof
  acceptance.test.ts            U-1～U-11 整体验收与双轴/四桶反例 proof
  public-surface.typecheck.ts   类型负夹具，只进 tsc
tools/terminal-ui-state/        本包静态门与 target-only red vector；behavior harness 只改临时副本
```

## 3. 最小用法

```ts
import {
  createModuleUiVariableFactory,
  createUiCatalog,
  createUiVariableWrite,
} from '@catering-v2s/kernel-base-ui-state'

const catalog = createUiCatalog([{
  partKey: 'orders',
  rendererKey: 'orders-screen',
  containerKeys: ['root'],
  displayModes: ['PRIMARY'],
  workspaces: ['MAIN'],
  instanceModes: ['MASTER'],
  title: 'Orders',
  description: 'Orders screen',
}])

const defineVariable = createModuleUiVariableFactory('sales')
const orderNumber = defineVariable.define('order-number', {
  defaultValue: '',
  persistIntent: 'never',
})
const write = createUiVariableWrite(orderNumber, 'A-100')
void catalog
void write
```

`catalog` 是安装期值，不提供运行期 `register`；entry 的 `containerKeys` 是 catalog 准入列表，允许为空，
空列表表示该 part 不参与任何容器枚举。它不改变 screen/layer 放置 command 载荷中仍为单数的
`containerKey`。变量 key 由工厂生成，不能在调用点手写 namespace。
screen/layer command 的 `displayMode` 是命令载荷必填字段，读取则使用显式的 `selectScreen(root, displayMode,
containerKey)` 与 `selectLayers(root, displayMode)`；两侧都不从 routeContext 推断 surface identity。写入完成后
仍不得绕过 actor 直接 dispatch 内部 slice action。

### 3.1 screen 与 layer 的持久化边界

content slice 的 screen 与 layer 使用两个互不混用的 record descriptor：`containers` 保存
`PRIMARY`/`SECONDARY` 下的 `ScreenPlacement`，`layers` 保存同两种 displayMode 下按原序排列的
`LayerEntry[]`。新增 `layers` 不改变既有 `containers` 的 key 或值格式。

旧存档没有 `layers` 键时，hydrate 后的 layer 列表为空，既有 containers 照常恢复，不记录错误。
layer 还原会逐行校验非空 `layerId`/`partKey`、正的有限整数 `openedAt` 与 JSON-safe `props`；非法行
丢弃并保留其他行，重复 `layerId` 保留先出现的一条。结构错误写入 `ui-state-hydration` 诊断，字段为
`workspace`、`displayMode`、`layerId`、`partKey`、`reason`，在 module install 时交给 logger。

install 期只检查本机 `instanceMode` 所拥有的 workspace：`MASTER` 只清理 `MAIN`，`SLAVE` 只清理
`BRANCH`，并在发生清理时 flush；另一侧 workspace 是权威节点的投影目标，不由本机 actor 做
catalog prune。当前 `surfaceForm`、`displayMode` 或 `instanceMode` 暂时不可用但仍在 catalog 的
layer 必须保留，由 renderer 的可见性过滤决定是否显示，不能因为一次不可用就永久删除。layer 的
业务 props 所引用的数据是否仍存在，仍由拥有该业务 part 的 feature 自行处理；本包不创建第二套
恢复或业务校验机制。

P2/P3 已公开的 command/selector 与 module factory 形态如下：

```ts
import {
  createUiStateModule,
  selectScreen,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state'

const uiStateModule = createUiStateModule({catalog, variables: [orderNumber]})
void uiStateModule
void showScreenCommand
void selectScreen
```

## 4. 在这个包上迭代时

1. 先确认新增能力属于 UI 状态协议，而不是 renderer、业务或平台；不得加入 React、默认空页面、队列或
   environment-state 推断。
2. 新分区必须复用 state workspace 三件套；新 slice 必须由 `createSlice` 创建，并显式声明 `isolated`。
3. `displayMode` 在 command payload 和 selector 入参中都必须显式；catalog 的 `containerKeys` 与三维准入只
   用于枚举，不能变成写入门；文案和 renderer 引用不能进入 state 或 persistence payload。
4. 新变量只能复用 `PersistIntent` 与 record descriptor，必须保持 module 前缀、泛型和 declaration default。
5. 变更后必跑：

   ```bash
   yarn workspace @catering-v2s/kernel-base-ui-state typecheck
   yarn workspace @catering-v2s/kernel-base-ui-state test
   node tools/terminal-ui-state/check-static.test.mjs
   node tools/terminal-ui-state/check-static.mjs
   node tools/terminal-ui-state/check-behavior.mjs
   yarn workspace @catering-v2s/terminal verify:static
   ```

   需要重启恢复或真实运行环境的证据，不能用这些静态/包级命令冒充。

P2 已将 screen/layer command 与 selector 纳入 public surface，P3 已补齐变量 slice、变量 command/actor 与
`createUiStateModule` 的实例绑定读取，P4 已补齐完整机械 gate 与反例。behavior harness 每个 U proof 在独立
临时树上运行基线与一个实现反例，仓内生产源不被 mutation。

曾经的高风险坑是把 displayMode 当环境默认值、把 workspace 拍平为一份 slice、让 catalog 变成全局可变
注册表，或把声明式变量退回 `unknown`/自由字符串；这些反例必须保留在 review 与 red vector 中。
