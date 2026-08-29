# `@next/kernel-base-ui-runtime-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F5** —— 依赖 F4b 的两个 scope selector（`selectTopologyWorkspace` / `selectTopologyDisplayMode`）。⚠️ 本行前一版写「workspace 全局读法须改 routeContext」，**已被 `00-ter-build-order` §4 整节推翻**：workspace 是**设备级事实**、两块屏共享，全局读**是正确的**；两块屏靠 `containerKey`（screen）与 `displayMode` payload（overlay）区分，POC 已做对，**不需要改** |
| 路径 | `1-kernel/1.1-base/ui-runtime-v2` |
| 规模 | src **1,273 行 / 29 文件**；test 974 行 |
| 依赖 | `contracts` · `platform-ports` · `runtime-shell-v2` · `state-runtime` · `topology-runtime-v3` |
| 被依赖 | 8 个包（runtime-react / admin-console / terminal-console / catering-shell / host-runtime-rn84 …） |
| 状态 | 活跃；**"页面状态全走 store、崩溃可恢复"这条能成立的机制所在地** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**在 kernel 层管理 UI 状态，不碰渲染。** README 的边界写得很硬：

> 它不管理：React component / React hook / DOM / RN View / Electron BrowserWindow / 页面 URL。
> kernel 只知道 `rendererKey` 和 UI runtime state；`2-ui` 或 assembly 负责把 `rendererKey` 映射成真实组件。

## 2 · 三个 slice，各按运行职责拆

| slice | 内容 | 展开 |
|---|---|---|
| `screen` | 每个 ScreenContainer 当前显示哪个 screen | 按 `workspace` 轴展开成 `.main` / `.branch` 两份 |
| `overlay` | 主/副屏 overlay 栈 | `primaryOverlays` / `secondaryOverlays` |
| `uiVariables` | 通用 UI 临时变量 | 按 workspace 展开 |

方法论文档 §1.1 的原话："不要为了'都和界面相关'就合并成一个大状态桶。"
三者的**读写命令不同、selector 不同、同步语义不同**，所以拆开。

### 同步方向按 workspace 反向

```ts
syncIntent: {main: 'master-to-slave', branch: 'slave-to-master'}
```

`MAIN` workspace 的 screen 由主机决定，`BRANCH`（standalone slave 的 PRIMARY）由副机决定。
**同一个 slice 定义，两份实例，两个相反的权威方** —— scoped slice 的价值在这里体现得最清楚。

### 持久化

`persistIntent: 'owner-only'` + `kind: 'record'`（按 containerKey 一条一个 key）。
⇒ **重启后当前在哪一页、开着哪个 overlay、UI 变量是什么，全部恢复。**

## 3 · 两条被明确禁止的做法

方法论文档 §0.1 / §0.2 里两条硬禁止：

1. **业务 UI 包不得在自己的 feature slice 中新增 `selectedTab` / `currentPage` / `activeScreen` 这类导航镜像状态。**
   当前在哪一页**只有一个真相源**。这是"恢复原状"能成立的根本原因：
   有第二份镜像，恢复就会出现"页面对了但 tab 不对"。
2. **容器默认页初始化必须走 `useUiScreenOrSetDefault` helper**，
   禁止业务组件手写 `selectUiScreen + useEffect + navigateTo(default)`。
   selector 保持纯读，不允许在 selector 里做默认写入。

## 4 · screen registry：只存定义，带上下文过滤

```ts
matchesContext(def, ctx) =
    def.screenModes.includes(ctx.screenMode)
    && def.workspaces.includes(ctx.workspace)
    && def.instanceModes.includes(ctx.instanceMode)
```

`listByContainer(containerKey, context)` 带缓存（cacheKey 由四段拼成，注册时整体失效），
按 `indexInContainer` 排序；`findFirstReady` 支持 `readyToEnter()` 谓词。

## 5 · alert 用 CommandIntent 表达动作

```ts
interface UiAlertAction {
    commands?: readonly CommandIntent[]
    metadata?: Record<string, unknown>
}
```

"确认后要做什么"是**数据**，不是回调。alert 定义可以完全声明式，
且天然支持 `KEEP-08` 的"请求确认拆两段"（kernel 发 `request-*` → bridge 开 alert →
用户确认 → alert 里带的 command 被 dispatch）。

## 6 · 优点

1. **三 slice 按运行职责拆**，不是按"都属于 UI"堆一起（§2）。
2. **两条导航禁止句**是"崩溃恢复原状"的机制保障（§3），且写进了方法论文档。
3. **同一 slice 定义按 workspace 展开成两个相反权威方**，用 scoped slice 表达得非常干净。
4. **screen 定义按 record 持久化**，粒度到容器级，不是整块。
5. **registry 只存定义 + 上下文过滤 + 缓存**，职责极窄。
6. **alert 动作用 CommandIntent**，声明式（§5）。
7. **kernel 完全不知道 React** —— `hooks/index.ts` 是空壳且注释写明"kernel 不实现 React hook"。

## 7 · 缺点 / 风险

1. **`UiScreenDefinition.readyToEnter?: () => boolean` 是存进 registry 的函数。**
   README 说"registry 只能存定义，不能存组件对象或副作用"——函数是闭包，
   可以捕获任意东西，也可能有副作用。这条边界在类型上没有守住。
2. **`applySyncEntries` reducer 零 dispatch 点**（见 `k-07` §3.5c）：
   `screenState` 与 `uiVariableState` 各有一个带 LWW 语义的 `applySyncEntries`，
   **从未被调用**，且其语义（`updatedAt <` 比较）与实际生效的 authoritative 相反。
   照着它读会得出错误的同步模型结论。
3. **`overlay` 用 `primaryOverlays` / `secondaryOverlays` 两个字段表达双屏**，
   而 screen 用 workspace 轴表达。**同一个"双屏"概念，两种表达方式**。
4. **`selectors/index.ts` 126 行、17 个导出**，是 kernel 里 selector 最多的包；
   其中不少是"first-ready fallback"这类带策略的读，已经不是纯投影。
5. **依赖了 `topology-runtime-v3`**（读 instanceMode/displayMode/workspace）。
   方向上合理，但意味着 UI 状态包与拓扑包耦合，单测时要一起起。

## 8 · 【TER 关键】它就是"一个 store 承载双屏"的现成机制

Dexter 已裁定同机双屏用**一个 store**。本包的 `workspace: main | branch` 轴
**天然就是双屏的状态分区**：

- 主屏渲染 `screen.main` / `overlay.primaryOverlays`
- 副屏渲染 `screen.branch` / `overlay.secondaryOverlays`
- 同一个 store，**零同步、零传输**

这条不需要新设计，只需要**把 workspace 的取值来源从"进程级 topology context"
改成"per-surface 解析"**（与 `k-11` §7 的 `contextState` 改造是同一件事）。

## 9 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **三 slice 拆法 + record 持久化 + 两条导航禁止句整体继承**，禁止句写进 TER 编码规范 | "恢复原状"的机制保障（§3） |
| 2 | **删掉两个 `applySyncEntries` 死 reducer** | 语义与实际相反，是误导源（§7.2） |
| 3 | **overlay 的双屏表达统一到 workspace 轴** | 消掉同一概念两种表达（§7.3） |
| 4 | **`readyToEnter` 改为声明式条件**（如 `requires: {capability, state}`）或移出 registry | 守住"registry 只存定义"（§7.1） |
| 5 | **workspace 取值改为 per-surface 解析** | 一个 store 承载双屏的唯一改造点（§8） |
| 6 | **selector 拆成"纯投影"与"带策略的解析"两组**，后者改名以示区别 | 126 行 17 导出里混着两类（§7.4） |
| 7 | **alert 的 CommandIntent 形态继承**，作为 TER"确认拆两段"的标准载体 | §5 |

## 10 · 证据档位

`已亲验`：三个 slice 的 descriptor、`types/screen.ts`、`foundations/screenRegistry.ts`、
方法论文档 §0.1/§0.2/§1.1。
`applySyncEntries` 零调用：`已亲验`（穷举 `1-kernel` `2-ui` `3-adapter` 下 `*.ts`，命中 2 处均为定义）。
**未逐行读**：四个 actor、`selectors/index.ts` 126 行的全部分支。
