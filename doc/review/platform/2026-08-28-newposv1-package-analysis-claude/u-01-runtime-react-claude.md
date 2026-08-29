# `@next/ui-base-runtime-react`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F6** —— 关键路径；`ScreenContainer` 980 行与条件 hook 须先拆 |
| 路径 | `2-ui/2.1-base/runtime-react` |
| 规模 | src **2,547 行 / 39 文件**；test **3,026 行**；test-expo **610 行** |
| 依赖 | `platform-ports` · `runtime-shell-v2` · `topology-runtime-v3` · `ui-runtime-v2` · RTK；peer：react / react-native / react-redux |
| 被依赖 | 8 个包（UI 层几乎全部 + host-runtime-rn84） |
| 状态 | 活跃；**UI 层的中枢，也是问题最集中的一个包** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**`ui-runtime-v2`（kernel UI 状态）的 React Native 渲染桥。**
把 `rendererKey` 映射成真实组件，渲染 screen / overlay / alert，并注册自动化语义节点。

kernel 只知道 `rendererKey`，这个包是那个映射的唯一住址。

## 2 · 核心抽象：part = 定义 + 组件

```ts
interface UiScreenPartDefinition<TProps> {
    kind: 'screen' | 'modal' | 'alert'
    definition: UiScreenDefinition<TProps>   // 来自 kernel
    component: ComponentType<TProps>          // 来自 UI
}
```

三个工厂 `defineUiScreenPart` / `defineUiModalPart` / `defineUiAlertPart`。
**kernel 侧的 definition 与 UI 侧的 component 在这里被绑在一起**，
然后 `rendererRegistry` 只保存 `rendererKey → component` 的映射。

## 3 · 组件结构（8 个文件，1,487 行）

| 组件 | 行数 | 职责 |
|---|---|---|
| **`ScreenContainer.tsx`** | **980** | screen 缓存 / 切换 / 生命周期 / ready gate / 自动化注册 |
| `DefaultAlert.tsx` | 158 | 默认确认框渲染 |
| `UiRuntimeRootShell.tsx` | 97 | 根壳：容器 + OverlayHost + AlertHost |
| `OverlayHost.tsx` | 75 | overlay 栈渲染（过滤 default alert） |
| `AlertHost.tsx` | 76 | 默认 alert 渲染 |
| `HotUpdateProgressModal.tsx` | 65 | 热更新进度弹层 |
| `LoadingScreen.tsx` / `EmptyScreen.tsx` | 36 | 占位 |

## 4 · `ScreenContainer` 里到底有什么

一个组件里同时有 **8 个 `useState` + 6 个 `useRef`**：

```
cachedScreens / activeKey / pendingScreen / shouldMountPendingScreen / transition
cachedScreensRef / pendingScreenRef / transitionRef / requestedKeyRef / cacheRecencyRef / tokenRef
```

以及一整套 screen 缓存机制：
`createScreenCacheKey` · `areScreenPropsEqual`（深比 props 决定能否复用）·
`canReuseScreenCacheItem` · `trimScreenCache`（LRU，按 `cacheRecencyRef`）·
`upsertScreenCacheItem` · `activateScreenCacheItem` ·
`scheduleAfterPaint`（提交后回调）· `LoadingOverlay`（带 transitionKey 的过渡遮罩）·
`ScreenLifecycleSlot` / `ScreenLifecycleContent`（每个缓存屏一个槽）·
`createSlotAutomationBridge`（每槽一个自动化桥）。

**这是一个完整的"页面栈 + 缓存 + 过渡 + 生命周期"状态机，住在一个 React 组件里。**

## 5 · 优点

1. **`rendererKey` 映射是唯一的一层**，kernel 完全不知道组件。
   这条边界在整个 UI 层守得很好。
2. **part 三型（screen/modal/alert）统一形态**，定义与组件成对声明，注册一次。
3. **`OverlayHost` 显式过滤 default alert**，避免 alert 被渲染两次
   —— `2.1-base` README 专门写了这条规则，代码里做到了。
4. **screen 缓存 + LRU + props 深比**：切回上一个页面时不重建，
   这对 POS 的"点单页↔结算页"来回切是必要的。
5. **`scheduleAfterPaint` + `LoadingOverlay`**：切屏时先挂载新屏、绘制完成后再撤遮罩，
   避免白屏闪烁。这是真机体验细节，不是可有可无。
6. **`useUiScreenOrSetDefault` helper** 把"容器默认页初始化"固化成协议，
   业务组件不再手写 `selectUiScreen + useEffect + navigateTo`（`ui-runtime-v2` §3.2 的落点）。
7. **test 3,026 行 > src 2,547 行**，且另有 610 行 test-expo 浏览器自动化。
8. **`test-expo/` 是全仓最有价值的测试资产之一**：Expo Web 起真实页面 + 浏览器自动化，
   已覆盖真实 kernel 启动、主副 root 渲染、命令驱动、**两个浏览器页当 displayIndex=0/1**、
   真实 `dual-topology-host-v3` WS 连通（`KEEP-17`）。

## 6 · 缺点 / 风险

### 6.1 五处条件调用 hook —— 潜伏崩溃（`FIX-07`）

```
UiRuntimeRootShell.tsx  第 35、37 行
ScreenContainer.tsx     第 547、549、553 行
```

形态 `const x = xProp ?? useOptionalXxx() ?? undefined`。
`xProp` 从 `undefined` 变成有值时，**hook 调用数变化**，React 抛
`Rendered fewer hooks than expected`。这两个文件正是最核心的渲染组件。

### 6.2 `ScreenContainer` 980 行 —— renderer 变成了状态机宿主（`FIX-06`）

`2.1-base` 层与 `layered-runtime-communication-standard.md` 都写着
"UI Renderers Stay Renderers … should not become the owner of domain orchestration"。
缓存策略、LRU、过渡时序、ready gate 都是**状态机**，不是渲染。

**而 §6.1 的 3/5 处 hook 违规就在这个文件里** —— 大文件与 hook 违规同时出现不是巧合。

### 6.3 `sharedRendererRegistry` 是模块级可变单例

```ts
const sharedRendererRegistry = createRendererRegistry()
export const getSharedRendererRegistry = () => sharedRendererRegistry
export const registerUiRendererParts = (parts) => sharedRendererRegistry.registerParts(parts)
export const clearUiRendererRegistry = () => sharedRendererRegistry.clear()
```

对"一个 VM 两块屏共享渲染器"是**正好合适**的；
但若 TER 走"一个 VM 两个逻辑 runtime"，两个 runtime 会共用同一份注册表。
另外 `clear()` 是公开导出的，测试之外任何人都能清空全局注册表。

### 6.4 `UiRuntimeVariable.persistence` 声明了三档，但归属不清

```ts
persistence?: 'transient' | 'recoverable' | 'secure-never-persist'
```

这是 UI 层的类型，而真正的持久化由 kernel 的 `uiVariables` slice descriptor 决定。
**两处都在描述同一件事**（这个变量要不要落盘），是 `FIX-11` 同型的"两个住址"风险。
（`推论`：未穷举该字段的消费点，TER 落地前应复验。）

### 6.5 自动化桥每个 slot 一份

`createSlotAutomationBridge` 为每个缓存屏创建一个桥，节点注册要手工写在业务组件里
（`FIX-08`：全仓 `semanticId:` 52 处 vs `testID=` 221 处）。

## 7 · 【TER 关键】这个包是双屏渲染的落点

Dexter 已裁定：一个 ReactHost 挂多 surface、共享 VM、一个 store。

`UiRuntimeRootShell display="primary" | "secondary"` **已经是这个形态** ——
它按 `display` 选容器（`primaryRootContainer` / `secondaryRootContainer`）、
选 overlay 面、选 automation target。

⇒ TER 只需让**两个 surface 各挂一个 `UiRuntimeRootShell`，display 从 surface 的 initialProps 取**。
渲染层不需要新设计。

## 8 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **五处条件 hook 不搬**，`eslint-plugin-react-hooks` 从第一天设 error | 潜伏崩溃（§6.1），且是将来开 React Compiler 的前置 |
| 2 | **`ScreenContainer` 拆成三层**：缓存策略（纯逻辑）/ 生命周期控制器（hook）/ 渲染组件（<150 行） | 980 行状态机（§6.2）。缓存与 LRU 是可单测的纯逻辑 |
| 3 | **`rendererKey → component` 映射整体继承** | kernel 与 UI 的唯一接缝，形状正确 |
| 4 | **part 三型 + 定义/组件成对声明整体继承** | §2 |
| 5 | **`scheduleAfterPaint` + LoadingOverlay 的切屏时序整体继承** | 真机体验细节，重写容易丢（§5.5） |
| 6 | **renderer registry 改为 runtime 作用域**，去掉模块级单例与公开 `clear()` | §6.3；TER 若一个 VM 多 runtime 会撞 |
| 7 | **自动化节点注册下沉到 NativeWind + RNR 的 primitive 包装层** | 把机制从加法变减法（`FIX-08`） |
| 8 | **`UiRuntimeVariable.persistence` 与 kernel descriptor 合一** | 消掉两个住址（§6.4） |
| 9 | **`test-expo/` 浏览器自动化整体继承并铺到全部 UI 包** | 当前只有 2 个包在用（`KEEP-17`） |
| 10 | `UiRuntimeRootShell` 的 `display` 从 surface initialProps 取 | 双屏渲染的唯一改造点（§7） |

## 9 · 证据档位

`已亲验`：`index.ts`、`types/parts.ts`、`foundations/rendererRegistry.ts` 全文、
`ui/components/UiRuntimeRootShell.tsx` 全文、`ScreenContainer.tsx` 的结构与 state/ref 清单（`rg` 提取）、
八个组件的行数、`test-expo/README.md` 与 `package.json` 的脚本面。
`推论`：§6.4（persistence 两个住址）—— 未穷举消费点。
**未逐行读**：`ScreenContainer.tsx` 980 行的完整逻辑、`contexts/UiRuntimeContext.tsx` 的全部 controller。
