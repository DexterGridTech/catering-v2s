# `ui.base.render` 需求分析稿(非正式)

| 项 | 值 |
|---|---|
| 性质 | **分析稿,不是需求稿**。供 Dexter 与我边讨论边改;定稿后另出 `-requirements-claude.md` |
| 作者 | Claude |
| 日期 | 2026-09-02 |
| 冻结输入 | **两代 POC**:v1 `_old_` 的 `2-ui/2.1-cores/{base, runtime-base}`;v2 `newPOSv1` 的 `2-ui/2.1-base/runtime-react` 及其全部消费方。v2s 侧:已落地的 kernel 六包(含刚完成的 `ui-state`)、骨架需求 §6.4 / §7.1 |
| 未验证 | 本文结论**全部来自静态阅读**,未执行任何命令 |

---

## 1 · 亲验清单

**v1**:`2.1-cores/base` 与 `2.1-cores/runtime-base` 的目录树与文件清单对比;
`runtime-base/src/ui/components/ScreenContainer.tsx`(128 行)与 `base/.../StackContainer.tsx`(175 行)的逐行 diff;
`ui/screens/SSDefaultWelcomeScreen.tsx`;`ui/modals/DefaultAlert.tsx`(477 行);`ui/components/` 与 `ui/screens/` 全清单。

**v2**:`runtime-react` 全部 38 个源文件的清单;`foundations/{rendererRegistry, defaultParts}.ts` 全文;
`ui/components/UiRuntimeRootShell.tsx`;`hooks/useUiScreenOrSetDefault.ts` 头段;
`supports/uiNavigationBridge.ts` 导出面;`ui/components/{DefaultAlert, EmptyScreen, LoadingScreen}.tsx` 行数;
**跨行解析的消费面全集**(10 个消费者)。

**v2s**:`ui-state` 的公共面与需求稿 §6 跨包接缝、§7 跨包欠账;骨架 §6.4 外部依赖基线、§7.1 职责边界。

**v1 的 `admin` / `terminal` / `adapter-test` 已核**:三者都是**业务/功能 UI 包,不是渲染基础设施**
(诊断屏、激活表单、测试台),它们是宿主的**消费者**。
其对渲染基座的实际导入面**极薄**:只有 `uiCoreBaseModule` · `FancyInputV2`(v2s 属 `ui.base.input`)·
`uiBaseCoreUiVariables`(根容器键)· `useLifecycle` —— **没有任何注册或创作接缝**,
因为 v1 的注册走内核。

**仍未读**:
v2 的 `AlertHost` / `OverlayHost` / `UiRuntimeContext` 全文(前两者在 ui-state 轮已读过关键段);
`ScreenContainer.tsx`(980 行)的挂载时序细节(ui-state 轮已核过缓存与 `operation` 面)。

---

## 2 · 三代演进

### 2.1 v1 内部就演进过一次,而且与内核层同步

`@impos2/ui-core-base` 与 `@impos2/ui-core-runtime-base` 是**两个独立包名、文件清单只差一个**:
前者有 `StackContainer.tsx`,后者有 `ScreenContainer.tsx`。逐行 diff 显示这次改名同时:

- import 源从 `kernel-core-navigation` 换成 `kernel-core-ui-runtime`;
- 容器概念 Stack → Screen;
- **175 行降到 128 行** —— 砍掉了 `logChildInfo`、挂载状态 ref、上一次 child ref 等脚手架。

⇒ 与我在 ui-state 轮发现的内核层演进(`navigation` → `ui-runtime`)是**同一次重构的两侧**。
**后者是该研究的版本。**

### 2.2 三代的职责搬迁

| 关注点 | v1 | v2 | 判定 |
|---|---|---|---|
| **组件注册表的家** | **内核**(`ScreenPartRegistration.componentType`;`registerScreenPart` 住在 `navigation` 与 `ui-runtime` 两代内核包里 ✅,渲染侧只在错误提示里提到它) | **渲染包**(`rendererRegistry`,`rendererKey → Component`) | 🟢 **v2 改对了**,与骨架 §7.1 一致 |
| **创作接缝** | 内核的 `registerScreenPart(registration)` | 渲染包的 `defineUiScreenPart` + `registerUiRendererParts`(4 个消费者) | 🟢 随注册表一起搬对了 |
| **根壳** | **不存在**。surface 身份靠环境态 | `UiRuntimeRootShell` 收 `display` prop | 🟢 方向对(读侧显式化),但形态有问题(D-1) |
| **输入控件** | **同包**(`FancyKeyboard*` / `FancyInput*` 六个组件) | 拆出 `input-runtime` | 🟢 已定,v2s 对应 `ui.base.input` |
| **默认外观** | `DefaultAlert` 477 行 + **`SSDefaultWelcomeScreen`**(带 `partKey` 与硬编码配色) | `DefaultAlert` 158 行 + 四个 default part | 🟠 **减重了,结构问题没解决**(D-2) |
| **容器** | `ScreenContainer` 128 行 | `ScreenContainer` 980 行(缓存 + 自动化分槽) | 待评估(ui-state 轮已判缓存属渲染侧) |

---

## 3 · 消费面(跨行解析,10 个消费者)

| 符号 | 消费者数 | 谁 |
|---|---|---|
| `useOptionalUiAutomationBridge` / `RuntimeId` / `Target` | **5** | admin-console · terminal-console · **input-runtime** · workbench · catering-shell |
| `defineUiScreenPart` + `registerUiRendererParts` | **4** | admin-console · terminal-console · workbench · catering-shell |
| `useUiRuntime` | 4 | 同上 |
| `uiRuntimeRootVariables` | 3 | terminal-console · workbench · catering-shell |
| `UiRuntimeProvider` | 3 | admin-console · test-support · assembly(测试) |
| `runtimeReactDefaultParts` | 2 | topology-runtime-bridge · catering-shell |
| `UiRuntimeRootShell` | **1** | catering-shell(集成层)+ 一处测试 |
| `ScreenContainer` · `useUiScreenOrSetDefault` · 三个 screen-active/gated hook | **1** | 仅 admin-console |
| `createUiNavigationBridge` | 2 | admin-console · terminal-console |

**三条结论**:

1. **核心创作接缝是 `defineUiScreenPart` + `registerUiRendererParts`** —— 一次声明组件与定义两半,
   把 JSON 安全的那半交给内核。ui-state 的 catalog entry 正是接收端。
2. **根壳只被集成层用** —— 分层是对的,v2s 照此。
3. ⚠️ **自动化上下文住在 render,而 `input-runtime` 仅为这三个 hook 依赖 render**。
   v2s 里 `ui.base.primitives` 依赖 `automation`、`ui.base.input` 依赖 render + primitives ——
   **这三个 hook 该住 `automation` 而不是 render**,见 D-6。

---

## 4 · 缺陷与结构性问题

### 🔴 D-1 · 根壳的 surface 身份是 fail-open 的可选小写字符串

`UiRuntimeRootShell.tsx`:`display?: 'primary' | 'secondary'`,**默认 `'primary'`**;
`automationRuntimeId ?? \`${display}-runtime\`` 又是一处默认。

v2s 里这是 ui-state 需求稿 §6 的 **S-1 接缝**:每个视口必须提供**自己的** `displayMode`。
⇒ 必须是**必填**的 `DisplayMode`(`'PRIMARY' | 'SECONDARY'` 闭集),**无默认**;
由渲染侧自己用 `resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode})` 求得。

### 🔴 D-2 · 渲染宿主包持有具体 `partKey` 与外观 —— §7.1 明令禁止的形态

- **v1**:`SSDefaultWelcomeScreen.tsx` 带 `partKey: 'default-Welcome-slave-secondary'`、
  `containerKey: secondaryRootContainer.key` 与整套硬编码配色;`DefaultAlert` 477 行。
- **v2**:`runtimeReactDefaultParts` 注册**四个具体 partKey** ——
  `ui.base.empty-screen` · `ui.base.loading-screen` · `ui.base.default-alert` ·
  **`ui.base.hot-update-progress-modal`(一个业务特定的热更新倒计时模态)**,
  且都硬编码 `containerKey: primaryRootContainer.key`。

骨架 §7.1 原文:`ui.base.render` **"不得拥有任何具体 part 的 key;任何外观"**,
并附警告「**fallback 的定位是「诊断兜底」,不是「可用外观」—— 一个做得能看的默认 alert 会挤掉真正的注册**」。

⇒ v2 把 DefaultAlert 从 477 行减到 158 行,**但结构没变,还多了一个业务模态**。

### 🔴 D-3 · `useUiScreenOrSetDefault` —— 渲染层反过来写状态

该 hook 读不到屏就 **dispatch 一条 showScreen 去写默认**。三重问题:

1. 违反"业务方明确指定"—— 变成**渲染层决定显示什么**;
2. 渲染期产生状态写入(effectful render);
3. ui-state 的内容集**会持久化**,这个默认写入可能**覆盖恢复出来的导航位置**。

⚠️ Dexter 已就此裁定过:**"容器有个 default 的空页面"** ——
渲染侧在读不到时**画一个空页面**,**不写状态**。⇒ 这个 hook 不移植。

### 🟠 D-4 · 注册表是模块级可变单例,且重复 `rendererKey` 静默覆盖

`rendererRegistry.ts` 有干净的 `createRendererRegistry()` 工厂,但底下
`const sharedRendererRegistry = createRendererRegistry()`,而对外三个自由函数
(`registerUiRendererParts` / `resolveUiRenderer` / `clearUiRendererRegistry`)全绑在这个单例上。
`clear()` 的唯一用途是测试。`registerPart` 用 `renderers.set(...)` ⇒ **重复 rendererKey 静默覆盖**。

⇒ 与 kernel 整改里 D-7 同类;而 **ui-state 的 catalog 刚刚把同一问题解决掉了**
(安装期构建、构建后冻结、重复 partKey 抛错)。渲染侧的注册表是它的**对偶**,应对称处理。

### 🟠 D-5 · 渲染包替别的模块伪造命令定义

`UiRuntimeRootShell.tsx` 顶部:

```
defineCommand({moduleName: 'kernel.base.tdp-sync-runtime-v2', commandName: 'record-user-operation'})
```

渲染宿主**替 tdp-sync 声明了一条它不拥有的命令**并在交互时派发。
编码规范 §「command 的定义点」写的是**由能依赖 runtime 的那一侧定义,通常是消费方包自己**;
替别人定义会让命令的所有权与版本兼容性失去归属。
⚠️ 且 tdp-sync **不在 TER 范围**,这条行为本身也不移植。

### 🟠 D-6 · 自动化上下文住错了包

`useOptionalUiAutomationBridge` / `RuntimeId` / `Target` 由 render 提供,
**5 个消费者**用它,其中 `input-runtime` **仅为这三个 hook 依赖 render**。

v2s 的依赖表是:`primitives → automation`、`input → platform-ports·runtime·state·render·primitives`。
⇒ 若这三个 hook 住 `automation`,`primitives` 与 `input` 都能拿到,
而 **render 不必成为自动化能力的提供方**。这条会影响两个包的边界,**需要在 render 定稿前定**。

### 🟡 D-7 · 条件调用 hook(rules-of-hooks 违反),两处

`UiRuntimeRootShell.tsx` 与 `ScreenContainer.tsx` 都用
`prop ?? useOptionalXxx()` —— **prop 非空时 hook 不被调用**。
同一组件时有时无地传该 prop 就会触发 React 报错。
(ui-state 需求稿 §7 已登记为 render 移植时修的欠账,此处确认它在**两个**组件里都有。)

### 🟡 D-8 · 准入三维在 v2 是无类型字符串,且大小写与内核不一致

`defaultParts` 里 `workspaces: ['main', 'branch']` 小写,而 v2s 内核是 `'MAIN' | 'BRANCH'`;
`screenModes: ['DESKTOP','MOBILE']` 在 v2s **全仓零命中**(形态因子已裁定不引入)。
⇒ 渲染侧的 part 声明必须与 ui-state catalog 的闭集**同源**,不得各写一套。

---

### 🔴 D-9 · `kind` 概念被发明了,却在边界上丢掉,于是宿主只能靠字符串匹配把它猜回来

v2 **已经有** `UiPartKind = 'screen' | 'modal' | 'alert'`,`defineUiScreenPart` 收 `kind?`(默认 `'screen'`),
`defineUiAlertPart` 设 `kind: 'alert'`。**但**:

```
const {component, kind = 'screen', ...definition} = input
return {kind, definition, component}
```

`kind` 被解构到**包装对象**上,**永远进不了内核的 `UiScreenDefinition`**。
于是 `AlertHost` 只能这样把它猜回来:

```
overlays.filter(o => o.screenPartKey === 'ui.base.default-alert'
                  || o.rendererKey === 'ui.base.default-alert'
                  || o.id.startsWith('overlay.alert'))
```

⇒ **宿主硬编码具体 partKey 字符串并据此分支行为**(比 D-2 更进一步),
而且任何 id 恰好以该前缀开头的层都会被误判成 alert。

⚠️ **但这个分离是承重的,不能一删了之**。根壳的渲染树是
`ScreenContainer` → `OverlayHost` → `AlertHost`,即 **alert 恒在普通层之上** ——
这是真实产品需求(alert 不能被对话框盖住)。`kind` 正是它的正当表达,只是住错了地方(裁决见 §6.5)。

### 🟠 D-10 · 层的渲染器缺失时静默消失

`OverlayHost` 的渲染路径:`const Component = resolveUiRenderer(overlay.rendererKey); if (!Component) return null`
—— **没有任何诊断**。而屏幕路径的 `useChildScreenPart` 有 `missing-renderer` 状态并带完整诊断对象。
两条路径不对称;层的注册漏了就是**无声消失**,排查时无处下手。

### 🟡 D-11 · `createUiNavigationBridge` 是纯多余间接,且沿用旧词汇

71 行,7 条命令逐一 `dispatchCommand(createCommand(...))`,**无隐藏语义、无队列**。但:
给每条命令起了第二个名字(`navigateTo` / `openModal` —— v1 `navigation` 包的旧词汇);
把 `definition` 整个塞进载荷(v2s 已禁);2 个消费者在用而价值为零。

## 5 · 我的设计主张

> ⚠️ 本节是**读完全部材料前**写的草案。凡与 §6 裁决冲突处,**以 §6 为准**;
> §6 是读完 v1 三个业务包、`AlertHost`、`defineUiAlertPart`、根壳渲染树之后做的判断。

### 5.1 这个包回答的唯一问题

> **给定"这块屏是哪个 surface"与"该容器现在显示哪个 partKey",把对应的 React 组件画出来。**

它**不决定**显示什么(那是业务方经 ui-state 命令指定),
**不拥有**任何具体 part 的 key 与外观,**不写**任何状态。

### 5.2 三条不可让

1. **surface 身份必填、闭集、无默认**(D-1)。根壳收 `displayMode: DisplayMode`,
   由渲染侧自己用 `resolveSurfaceDisplayMode` 求得,向下经 context 传递。
2. **零具体 `partKey`**(D-2)。容器读不到内容时画的空页面是**渲染局部兜底**,
   **不是注册的 part**、没有 partKey、不进 ui-state 的 catalog。
   诊断兜底可以刻意做得"不好看"——那正是 §7.1 要的。
3. **只读不写**(D-3)。render 不 dispatch 任何 ui-state 命令去建立默认。
4. **宿主不认识任何具体 `partKey`**(D-2 + D-9)。z 层级靠注册表里的 `kind`,不靠字符串匹配(§6.5)。

### 5.3 注册表:与 ui-state catalog 对称

安装期构建、构建后冻结、**重复 `rendererKey` 抛错**、挂在模块实例上而非模块级单例(D-4)。
⚠️ ui-state 的 catalog 已经这么做了,两侧应形态一致 ——
catalog 管 `partKey → {rendererKey, containerKey, 三维, 文案}`,
render registry 管 `rendererKey → Component`,**两张表都是构建期静态的**。

### 5.4 创作接缝保留

`defineUiScreenPart({...definition, component})` **一次声明两半**、返回 JSON 安全的定义交给 catalog ——
这是 v2 的好设计,4 个消费者在用,继承。

### 5.5 明确不做

| 项 | 为什么 |
|---|---|
| 任何具体 part 与默认外观 | §7.1;D-2 |
| `useUiScreenOrSetDefault` 类首屏写入 | Dexter 已裁;D-3 |
| 替别的模块定义命令 | D-5;且 tdp-sync 不在范围 |
| 形态因子(`screenModes`) | v2s 全仓零命中,已裁定不引入 |
| **屏幕缓存 / keep-alive 本身** | 已裁 **v1 不做**(§6.2);那个缓存深度参数随之无处安放,一并不做 |
| 任何具体容器键 | 已裁 **由集成层传入**(§6.4) |
| 自动化 context 的**提供** | 已裁 **归 `automation`**(§6.1);render 只**接收**不提供 |
| `createUiNavigationBridge` 类薄封装 | 已裁不移植(§6.6) |

---

## 6 · 我的裁决(Dexter 授权,读完全部材料后)

### 6.1 自动化上下文三个 hook → **住 `automation`,不住 render**

依据:5 个消费者在用,而 **`input-runtime` 仅为这三个 hook 依赖 render**。
v2s 依赖表是 `primitives → automation`、`input → …·render·primitives`
⇒ 放进 `automation` 后 primitives 与 input 都能拿到,而 **render 不必成为自动化能力的提供方**。
`automation` 是 ui 层包,可以有 React,不存在障碍。

⚠️ **这条要写进 render 需求稿的跨包接缝**:render 的宿主组件**接收**自动化桥(经 prop 或 automation 的 context),
自己**不提供**该 context。

### 6.2 屏幕缓存 / keep-alive → **v1 不做**

v1 的容器 **128 行、无缓存**;v2 的 980 行里大半是缓存(LRU、recency、`display:'none'` 隐藏)
与自动化分槽。这是**性能优化**,而本阶段没有任何测量说明它必要。
按"先测量再动"。**什么会推翻它**:真机上量到屏幕重挂载的可感卡顿。

### 6.3 loading 兜底 → **不做,只做空页面**

loading 需要"这块屏自己的异步初始化完了没"这一语义(v2 的 `screenReady` 闸门),
而 Dexter 已裁"screenReady 意义不大"。⇒ 容器读不到内容就画空页面,没有第三态。

### 6.4 两个根容器键 → **由集成层声明并传入,render 不持有**

v2s 的内容集已按 `displayMode` **结构化**分离,容器键不再承担 surface 区分职责
(那是 v1/v2 的约定式做法,我们已在 ui-state 用结构替代)。
⇒ 根壳收 `containerKey` 作为 prop,render 包内**零具体容器键**,与 §7.1 的"不得拥有具体 part 的 key"同源。

### 6.5 🔴 `kind`(z 层级)→ **住 render 自己的注册表,不推进内核**

这是读完 D-9 之后新增的一条,也是本文最重要的裁决。

**问题**:alert 恒在普通层之上是真实需求(承重),但 v2 把 `kind` 丢在边界外,
逼得宿主用 partKey 字符串匹配把它猜回来。

**我的裁决**:`kind` 是**渲染关注点**(z 层级 = 视觉层次),归 render:
注册表存 `rendererKey → {component, kind}`,宿主按 `kind` 分层渲染。

**为什么不推进 ui-state 的 catalog**:
① z 层级是外观语义,而 §7.1 要求 ui-state **不得拥有任何外观**;
② ui-state 刚落地,为一个纯渲染语义改它的 catalog 契约不划算;
③ 放 render 后宿主**完全不需要知道任何具体 partKey** —— D-2 与 D-9 一并解决。

**代价与反例**:若将来出现"业务方要在下发时决定这一层压在谁上面"的需求,
z 层级就变成了调用期数据,那时才该进 ui-state 的层载荷。目前没有这样的需求陈述。

### 6.6 顺带定掉的三条

- **`createUiNavigationBridge` 不移植**(D-11):业务直接
  `runtime.dispatchCommand(showScreenCommand, {...})`,少一层间接、只保留一套词汇。
- **`defaultParts` 四个具体 part 全部不移植**(D-2):
  空页面是**渲染局部兜底**,没有 partKey、不进注册表、不进 catalog;
  热更新模态是业务件,归业务包。
- **层的渲染器缺失必须落诊断**(D-10):与屏幕路径的 `missing-renderer` 对称,不得静默 `return null`。

---

## 6.7 仍需 Dexter 裁定的:**无**

以上全部依据仓内事实与已有裁定推出。若你不同意任一条,推翻即可;
我在每条都写了依据与"什么会推翻它"。

---

## 7 · 尚缺证据

- **本轮已把 §1 列出的缺口全部补齐**:v1 三个业务包(核了消费面)、`AlertHost` 与 `OverlayHost` 全文、
  `createUiNavigationBridge` 全文、`defineUiScreenPart` / `defineUiAlertPart` / `defaultParts` 全文、
  根壳渲染树、`UiPartKind` 定义、四个剩余 hook 的规模与签名。
- **仍未逐行读**:`ScreenContainer.tsx` 的 300 至 540 行(自动化桥实现细节,ui-state 轮已核过缓存与 `operation` 面);
  `UiRuntimeContext.tsx` 除两个 controller 外的部分;`useEditableUiVariable`(36 行)内部。
  以上均不影响本文结论。
- 本文全部结论**未跑任何命令**。
