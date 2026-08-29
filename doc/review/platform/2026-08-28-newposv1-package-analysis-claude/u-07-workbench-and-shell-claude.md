# 业务 UI 与产品 shell

> `@next/ui-business-catering-master-data-workbench` · `@next/ui-integration-catering-shell`

---

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## A · `catering-master-data-workbench`（业务 UI 层唯一的包）

| 字段 | 值 |
|---|---|
| **TER 批次** | 两个**具体业务包** → **批 D**；但 **integration 这一层本身属于批 F**。⚠️ **身份更正**：Dexter 2026-08-28 明确 integration **不是测试包**，它是**真实的 UI 与业务整合层**；"必须能在 web 上运行测试"是加在它身上的**约束**，不是它的用途。它**不得依赖 adapter**（那是反向依赖）——web 上的能力由**端口默认实例**覆盖。地基批需自建 `ui/integration/<platform-selfcheck>`（**批 F · F10a**，双运行面）。见 `00-ter-build-order` §4B.0 / §4B.1 |
| 路径 | `2-ui/2.2-business/catering-master-data-workbench` |
| 规模 | src **817 行 / 7 文件**；test **0** |
| 依赖 | 8 个（三个主数据 kernel 包 + tcp-control + ui-runtime-v2 + runtime-shell-v2 + runtime-react + input-runtime） |
| 被依赖 | 1（`catering-shell`） |

### A.1 结构

```
ui/screens/MasterDataWorkbenchScreen.tsx      694 行  ← 占全包 85%
foundations/masterDataWorkbenchScreenParts.ts  42 行
application/createModule.ts                    41 行
application/moduleManifest.ts                  24 行
```

**一个屏一个文件，占 85%。**

### A.2 它做什么

展示 terminal-safe 主数据：组织链路（平台/大区/项目/租户/品牌/门店/合同）、
商品/菜单摘要、门店经营摘要、IAM 用户/角色/权限摘要，外加 diagnostics。

全部经 `useSelector` 读 kernel selector（实测 15+ 个 selector 调用），
不自己解析 projection。

### A.3 优点

1. **严格只读 selector**：`selectTcpIdentitySnapshot` / `selectOrganizationIamSummary` /
   `selectCateringProductSummary` / `selectCurrentBrandProfile` / … 十余个，
   **零本地业务状态**。符合 `2.2-business` README 的"不承载业务状态真相"。
2. **显示 diagnostics** —— 现场能看出"这个商品为什么没有"，
   对应 README 的"业务 UI 应显示 diagnostics，便于现场排查主数据缺失或 projection 异常"。
3. **主副屏两个 screen part**（primary / secondary 各一份定义）。
4. **注册了 7 处 `semanticId`**，是业务 UI 里自动化覆盖最好的。

### A.4 缺点 / 风险

1. **零测试。** UI 业务层唯一的包，没有任何测试。
2. **694 行单屏**。它同时展示四个领域（组织/IAM/商品/门店经营）的摘要，
   本质是四个面板挤在一个组件里。
3. **依赖 8 个包**，其中直接依赖三个 kernel 主数据包 ——
   一个"工作台"知道全部主数据域，随域增加会线性膨胀。
4. **`useSelector` 逐个调用 15+ 次**（`MasterDataWorkbenchScreen.tsx:373-390` 一段连续 18 行都是 `useSelector`），
   每次订阅一个 selector。RTK/react-redux 下每个都是独立订阅，
   状态变化时会触发多次比较。（`推论`：未实测渲染开销。）

### A.5 TER 优化方向

| # | 动作 |
|---|---|
| 1 | **按领域拆成四个面板组件**，工作台只做布局与 tab |
| 2 | **补测试**：至少覆盖"主数据为空""projection 有 diagnostics""切主副屏"三态 |
| 3 | **selector 组合收敛成一个 view-model hook**，减少订阅数（与 `u-04` §3.2 同一条规范） |
| 4 | **NativeWind + RNR 重做外观**，业务读写语义不变 |
| 5 | 领域面板与主数据 kernel 包**一一对应**，工作台只依赖面板不依赖 kernel 包 |

---

## B · `catering-shell`（产品集成层唯一的包）

| 字段 | 值 |
|---|---|
| 路径 | `2-ui/2.3-integration/catering-shell` |
| 规模 | src **1,025 行 / 15 文件**；test 954；test-expo 216 |
| 依赖 | **15 个**（全仓最多） |
| 被依赖 | 1（assembly 的 `App.tsx`，不在 `src` 内） |

### B.1 它是 assembly 的唯一注入点

```ts
// assembly App.tsx 全部业务来源
createHostApp({
    RootScreen,                                  // 来自本包
    createShellModule: createCateringShellModule, // 来自本包
    extraKernelModules: createCateringBusinessModules(), // 来自本包
    productConfig: {...},
})
```

`createCateringBusinessModules()` 返回四个模块：
三个主数据 kernel 包 + workbench UI 包。

⇒ **assembly 不直接注入任何业务包**，全部经 shell 收口。
这正是 `2.3-integration` README 要求的形态，且做到了（`KEEP-16` 的另一半）。

### B.2 结构

| 文件 | 行数 | 内容 |
|---|---|---|
| `ui/screens/SecondaryWelcomeScreen.tsx` | 250 | 副屏欢迎页 |
| `ui/screens/WelcomeScreen.tsx` | 200 | 主屏欢迎页 |
| `ui/screens/RootScreen.tsx` | 126 | 根屏（挂 `UiRuntimeRootShell`） |
| `features/actors/hotUpdateRestartPreparationActor.ts` | 103 | 热更新重启前准备 |
| `application/createModule.ts` | 88 | 模块装配 + 路由订阅 |
| `features/actors/runtimeInitializeActor.ts` | 46 | 初始化 |
| `foundations/cateringShellScreenParts.ts` | 45 | screen part 注册 |
| `supports/rootScreenRouter.ts` | 41 | **路由函数** |
| `features/actors/tcpLifecycleActor.ts` | 36 | 激活生命周期 → 路由 |

### B.3 【发现】同一路由有两个触发源

`replaceCateringShellRootScreen(context, {activated, terminalId, source})`
同时被两条路径调用：

**路径一 · 事件驱动**（`tcpLifecycleActor.ts`）
```ts
onCommand(activateTerminalSucceeded,   → replace(activated: true))
onCommand(deactivateTerminalSucceeded, → replace(activated: false))
onCommand(resetTcpControl,             → replace(activated: false))
```

**路径二 · 状态驱动**（`createModule.ts` 的 `install`）
```ts
let lastTcpRouteFingerprint = JSON.stringify({activationStatus, terminalId})
context.subscribeState(() => {
    const next = JSON.stringify({activationStatus, terminalId})
    if (next === lastTcpRouteFingerprint) return
    lastTcpRouteFingerprint = next
    void replaceCateringShellRootScreen(context, {..., source: `${moduleName}.tcpStateSync`})
})
```

**本机激活时两条都会触发** ⇒ `replaceScreen` 被 dispatch 两次（每次两条：主屏 + 副屏，
合计四条 command）。

`replaceScreen` 是幂等的（设置目标 screen），所以**没有可见 bug**；
但"什么时候路由"有两个答案，且 `source` 字段的存在说明作者知道有多个触发源。

**两条各有理由**：事件路径响应快、语义明确；
状态路径能覆盖"状态经 topology 同步过来"与"重启恢复"这类没有本地命令的场景。
问题是**没有一处写明为什么两条都要**。

### B.4 优点

1. **assembly 的唯一注入点**（§B.1）—— 产品组合在 UI 层收口，assembly 保持 30 行。
2. **主副屏各有独立欢迎页**，不是一个页面按条件分支。
3. **路由是一个纯函数 + 两条触发**，路由逻辑本身只有 41 行、集中在一处。
4. **`source` 字段贯穿路由调用**，日志里能看出这次跳转由谁触发。
5. **`hotUpdateRestartPreparationActor`** 把"热更新重启前的 UI 准备"放在 shell 层，
   而不是 assembly（对应 `layered-runtime-communication-standard.md` Priority D 第 3 条的目标形态）。
6. **test 954 行 + test-expo 216 行**，含路由场景测试（`catering-shell-routing.spec.ts`）。
7. **模块依赖显式声明 7 条**，装配顺序由 `resolveKernelRuntimeModuleOrderV2` 保证。

### B.5 缺点 / 风险

1. **依赖 15 个包**，是全仓最多。这是集成层的性质决定的，但也意味着
   **它是变更影响面最大的一个包**。
2. **§B.3 的双触发源**没有文档说明。
3. **`createModule.install` 里做状态订阅 + 指纹比对**，
   把路由策略写进了模块安装函数（88 行里约 20 行是路由）。
   按本仓自己的规则，这更适合放在一个 actor 或 supports 里。
4. **`JSON.stringify` 做指纹**：字段顺序敏感、对象大时有成本。
   当前只有两个字段，可接受。

### B.6 TER 优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **"assembly 只注入一个 shell"的形态整体继承** | `KEEP-16`；assembly 30 行的前提 |
| 2 | **路由触发收敛成一条**：建议只保留**状态驱动**（覆盖事件、同步、恢复三类场景），事件路径删除 | §B.3；一件事一个答案 |
| 3 | 若保留两条，**必须写明各自覆盖哪些场景**，并加测试证明两条都必要 | §B.3 |
| 4 | **路由从 `install` 移进 actor 或 supports** | §B.5.3 |
| 5 | **主副屏欢迎页拆法保留** | 两个用户任务 |
| 6 | TER 单机双屏改一个 store 后，`replaceCateringShellRootScreen` 同时写主副两个 target 的形态**天然成立**（两个 workspace 在同一个 store） | 讨论稿 §7.2 |
| 7 | 指纹改为字段比对而非 `JSON.stringify` | §B.5.4 |

---

## C · 证据档位

`已亲验`：两包的文件清单与行数、`catering-shell/src/index.ts`、`application/createModule.ts` 全文、
`supports/rootScreenRouter.ts` 全文、`features/actors/tcpLifecycleActor.ts` 全文、
workbench 的 `useSelector` 调用段（`MasterDataWorkbenchScreen.tsx:373-390`）、
两包 `package.json` 依赖数、被依赖穷举、assembly `App.tsx` 全文。
`推论`：A §4.4（多订阅的渲染开销）—— 未实测。
**未逐行读**：`MasterDataWorkbenchScreen.tsx` 694 行、两个 Welcome 屏共 450 行、
`hotUpdateRestartPreparationActor.ts` 103 行。
