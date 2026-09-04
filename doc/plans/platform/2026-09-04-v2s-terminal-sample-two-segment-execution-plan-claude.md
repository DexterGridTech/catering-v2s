# TER sample 两段式执行计划（修订版）

~~~text
REVISES=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-implementation-plan-codex.md
REVISION_SCOPE=执行顺序、分段边界，以及第一段 Web 取证方式（Dexter 2026-09-04 裁定）
UNCHANGED=需求正本、IA、交互工件、implementation-facing 详设、全部 S/P 判据的内容与严格度
AUTHORITY=Dexter 2026-09-04 会话裁定
~~~

## 0. 这份文件改什么、不改什么

**改两件事：执行顺序，以及第一段的 Web 取证方式。** 需求、详设与全部判据的**内容与严格度**
一字不动；本文不新增、不删除、不改写任何 S 或 P，只登记其中两条在本轮不以自动化取证（§7.4）。

原计划顺序为 `CP-6 → CP-7 → CP-8 → CP-9`。现改为两段，adapter 与 assembly 整体后移到第一段
review 通过之后。

**换序的结构依据**：详设第 107 行的 CP 依赖表写明 `CP-9` 的依赖**只有 `CP-6`**，
不含 `CP-7`、`CP-8`。因此后移不切断任何依赖边，不需要重排其余 CP。

✅ 原计划的历史元数据已同步：实施授权、禁止范围与计划状态均已标明由本两段计划替代，
不再以设计阶段的 `IMPLEMENTATION_AUTHORITY=false`、`READY_FOR_STATIC_REVIEW`
或旧 CP 顺序约束当前执行；当前只按本文第一段范围推进。

---

## 1. 分段定义

| 段 | 内容 | 原 CP | 收口 |
| --- | --- | --- | --- |
| **第一段** | `kernel` 与 `ui` 两个目录下的 sample 包做完整，并在 Expo Web 上真实启动 | CP-6 ＋ CP-9（不含浏览器自动化） | **先交 Dexter 体验**，再交 Dexter 与 Claude 静态 review |
| **第二段** | `adapter` 与 `assembly`，真机第二段验收与全批对账 | CP-7、CP-8、CP-10、CP-11 | 第一段 review 通过后另行授权 |

**第一段自足性的依据**（本轮亲验）：

- 详设第 207 行：`test-expo` 自己提供「由外壳 `surfaceMode` 状态返回 1/2 的 `DevicePort`」；
- 详设第 332 行：Web 持久化是 `test-expo` 自己的 `StateStoragePort`，真实实现、非 `Map`；
- 需求第 1302–1303 行：「Web 段（第一段）**不依赖** D-6 结论 —— 两棵树同在一个 JS 环境里，
  由同一次 `createSampleAssembly` 的 `createSurface` 各出一棵」。

⇒ 第一段的两个平台端口都由外壳提供，**不经任何 adapter**；而 `test-expo` 位于
`ui/integration/sample-console`，本就在第一段分母内。

---

## 2. 第一段的范围（分母写死）

### 2.1 已完成，不重做

`CP-0` 至 `CP-5` 已完成并通过独立 review：workspace 与 layering checker、全量 rename、
TER framework 三处接缝、两个 `kernel/feature`、两个 `ui/feature`、`ui/base/primitives`
及其后的 P-5d 门与四条 finding 闭合。

### 2.2 本段要做的五项

| 项 | 内容 | 落点 |
| --- | --- | --- |
| **A-1** | `sample-console` 库侧：单一 assembly、两张 catalog、九项 `input.modules` | `ui/integration/sample-console/src` |
| **A-2** | Expo 工程身份：入口、依赖、工程配置、`web` script | 同包根与 `test-expo/` |
| **A-3** | `test-expo` 开发外壳：`surfaceMode`、双 Provider、canvas、切换按钮、Web 持久化 | `test-expo/` |
| **A-4** | 测试接线：从零建 test script、vitest config、tsconfig include、invariants | 同包 |
| **A-5** | Expo Web 启动验收：真实启动、日志可读、零启动期错误，然后停下交体验 | 运行产物 |

### 2.3 明确不在第一段范围

- `ui/base/input`、`ui/base/automation`、`ui/base/admin-shell` —— 空壳，需求 §2.2 押后；
- `kernel/base/transport`、`kernel/base/workflow` —— 空壳，本轮不建；
- `adapter/android/*` 五个包、`assembly/android/sample-terminal` —— 第二段；
- NativeWind、React Native Reusables、automation backend、视觉样式 —— 需求第 310–311 行
  写明留到第一次真实视觉实现时另裁。

⚠️ 「把 `kernel` 与 `ui` 下的 sample 包做完整」中的 sample 包**只有五个**：
两个 `kernel/feature`、两个 `ui/feature`、一个 `ui/integration`。
其中前四个已在 CP-4／CP-5 完成，本段真正新建的是第五个。
**不得**据此把 `ui/base` 或 `kernel/base` 下的空壳一并建起来。

---

## 3. A-1 · `sample-console` 库侧

按详设 §2.3 与需求 §6.7 实现，**唯一公共入口**：

~~~ts
createSampleAssembly(input: {
  platformPorts: PlatformPorts
  persistenceKey?: string
}): Promise<SampleAssembly>

type SampleAssembly = Readonly<{
  runtime: Runtime
  createSurface(displayMode: DisplayMode): ReactElement
}>
~~~

硬约束：

1. **闭包一次性持有** runtime、两张冻结 catalog、`stateSource`、`dispatchCommand`
   与绑定当前 `UiStateModule` 实例的 `selectUiVariable` reader；调用方不能拆成多个 factory。
2. **resolve 时 `runtime.status` 已为 `'started'`**；`await runtime.start()` 在函数内部完成，
   不把 start 推给调用方；start 失败则 Promise reject，不返回半成品。
3. `input.modules` 九项：contracts descriptor、platform-ports descriptor、state descriptor、
   `display-context`、`ui-state`、两个 `kernel/feature`、两个 `ui/feature`；
   `createRuntime` 自动加入自身 internal module，最终十项。
4. **base module descriptors 只建一份**，放在 `sample-console` 内
   （详设 §8.2 记为 D-3 技术欠账）；不得让两个 feature 或 assembly 各抄一份。
5. `persistenceKey` 缺省用固定 sample 值，但测试必须能覆盖以隔离。

---

## 4. A-2 · Expo 工程身份

需求 §6.7 规定 `sample-console` 是**双身份**：库（`exports` 供 `sample-terminal` 消费）
＋ Expo Web 工程。

### 4.1 依赖（需求 §6.7 已定的集合）

`expo`、`expo-status-bar`、`react-dom`、`react-native-web` 一律进 **`devDependencies`**。

⚠️ **版本必须重新核定，不得抄 POC。** 参考实现 `_old_/2-ui/2.3-integrations/mixc-retail`
用的是 `expo ~54.0.31`、`react-dom 18.3.1`、`@types/react ~18.3.12`、
`react-native-web ^0.21.0`、`typescript ^5.9.3` —— **React 18 代**；
而 v2s 是 `react 19.2.3`、`react-native 0.86.3`、`@types/react ~19.2.2`、`typescript ~6.0.3`。
依赖**集合**可以照搬，**版本号一律按 v2s 现有 React/RN 组合重新核定**。

### 4.2 工程配置：需求未规定，需实证确定

⚠️ **这是本段最大的未知面。** 当前事实：

- `apps/terminal` 零 `expo` 依赖，无 `app.json`、无 `metro.config.js`、无 `babel.config.js`，
  无 `web` script；
- 参考实现 `mixc-retail` **同样没有**这三个工程文件，靠 `react-native` 字段
  （值为 `./src/index.ts`）加 Expo 默认值运行，其 script 是
  `EXPO_OFFLINE=1 expo start --web`；
- 但 `mixc-retail` 无独立 `node_modules` 与 lock，说明它当时也在 monorepo 内被提升。

⇒ 需要哪些工程文件、`main`／`react-native`／`exports` 三个字段如何共存，
**必须由一次真实 `expo start --web` 实证确定**，不得纸上推断后写进设计。

### 4.3 入口形态：需求与参考实现不一致，需收口

- 需求 §6.7 写的是：根 `index.js` 内
  `registerRootComponent(require('./test-expo/App').default)`；
- 参考实现是：根 `index.ts` 内 `registerRootComponent(DevApp)`，
  同时 `react-native` 字段指向 `./src/index.ts`（**库入口**，不是外壳入口）。

两者的「库身份入口」与「工程身份入口」如何并存，是本段必须实证回答的问题。
以需求 §6.7 的形态为准；若实证证明该形态在当前 Expo 版本下不可行，
**停下来交 Dexter**，不得自行改写需求形态。

### 4.4 POC 的定位：存在性证明，不是取材来源

⚠️ **不抄 POC**（Dexter 2026-09-04）。`_old_/2-ui/2.3-integrations/mixc-retail` 的作用只有一个：
**证明一个 ui integration 包可以通过 Expo 跑起来**。工程配置、入口形态与版本全部按 v2s
自身实证确定，不以 POC 的写法为准。

仍列一份反面清单作为护栏 —— POC 里这几样如果被顺手带进来，会直接撞上本仓已立的门或核心前提：

| POC 里的写法 | 为什么不能出现在本仓 |
| --- | --- |
| `react-redux` 的 `<Provider store={…}>` | 本仓 Provider 是 `RenderProvider`；`react-redux` 是 P-5c 明令禁止项 |
| `redux-persist` 的 `PersistGate` | 本仓用 `StateStoragePort` ＋ 自有 persist 机制 |
| `ApplicationManager.getInstance().init()` 单例 | 与 `createSampleAssembly` 一次性装配、闭包持有的形态直接冲突 |
| 外壳持有 `storePromise` / store | store 归 assembly；外壳持 store 会击穿单 store 前提 |
| 裸 `<div>Loading store...</div>` | 字符串 host tag，与本轮刚立的 P-5d 同类倒退 |
| `// @ts-ignore` | 本仓不接受 |

## 5. A-3 · `test-expo` 开发外壳

按需求 §6.7a 与详设第 207 行：

1. 外壳持 `surfaceMode: 'single' | 'dual'` 状态；
2. 注入的 `DevicePort.getDisplayInfo()` **闭包读该状态**返回 `displayCount` 1 或 2；
3. 外壳按该状态挂 1 棵或 2 棵 surface 树；
4. 切换按钮翻转状态，**两处同时改变**；
5. **切换不重建 runtime** —— 只挂载／卸载第二棵树，已登记会员与登录态跨切换保留；
6. 一个 React root 下**两个兄弟 `RenderProvider`**，每实例 reader／reporter 独立；
7. 切换按钮的 testID 为 `sample-console:test-expo:surface-toggle`，
   它**不是** catalog part，也不是业务命令；
8. Web 持久化用真实可跨 refresh 的 `StateStoragePort`，**不用** `processMemoryStorage`；
9. canvas 按 `sample-console/package.json` 的 `terminalSurfaces` 声明渲染，
   库侧读取自身配置并导出 typed const，**`test-expo` 不二次解析**。

10. **布局用 flex（Dexter 2026-09-04 裁定 D-7），但 surface 自身不得 `flex: 1`。**
    flex 用于**排布** —— 外壳按 `terminalSurfaces.layout` 的 `row`／`column`
    以 `flexDirection` 排列两棵树，部件内部也用 flex 组织。
    但**每棵 surface 必须保持 `terminalSurfaces` 声明的固定逻辑尺寸**，
    不得改为 `flex: 1` 跟随视口 —— 那正是 S-26 的红向量，会让判据必红。
    ⇒ 一句话：**外层 flex 排布、surface 固定尺寸、内部 flex 组织**。

**边界（需求 §6.7a 的禁止列）**：按钮与 `surfaceMode` 只存在于 `test-expo`；
任何 sample 业务包与 `sample-console` 库侧**不得感知它的存在**；
不得把切换做成 part、command 或 slice。

---

## 6. A-4 · 测试接线

`sample-console` 测试从零建：test script、vitest config（含 `ts`/`tsx`）、
tsconfig include、devDependencies、invariants `REAL_TESTS`、runner 收集路径。

⚠️ **只有实际收集到 focused `.test.tsx` 才允许判 green** —— 空收集不算。

---

## 7. A-5 · Expo Web 启动验收

### 7.1 本段验收边界（Dexter 2026-09-04 裁定）

**本轮 Web 不做自动化测试。** 要求是：**能读日志、确保程序顺利启动；启动正常后停下来，交 Dexter 体验。**

这条裁定同时解掉了原 D-8 —— 不再需要为 S-12 的真实刷新与 S-26 的真实 resize
寻找合规自动化路径，本轮直接不以自动化取证。

### 7.2 被取消的是浏览器自动化，不是 focused test

必须分清两件事，否则会误删本该做的工作：

| 类别 | 本轮状态 |
| --- | --- |
| **focused test**（`vitest` ＋ `react-test-renderer`，A-4 的产物） | **照常做**，不受本裁定影响 |
| **浏览器自动化**（L2／playwright／`ui/base/automation`） | **本轮不做** |

⇒ 场景 1–9 与 Web 适用的 S/P 判据，凡能由 focused test 证明的，**照常证明并报告**；
只有真正依赖真实浏览器行为的两条例外，见 §7.4。

### 7.3 启动验收的具体判据

1. `expo start --web` 能成功启动，页面可加载；
2. 外壳按 `surfaceMode` 挂出一棵或两棵 surface 树，`react-native-web` 下 primitives 真实渲染；
3. **日志可读**：dev server 输出与浏览器 console 都能取到，并在交付中给出获取方式；
4. **启动期零错误**：无未捕获异常、无红屏、无模块解析失败；
   若有告警，逐条说明是否影响功能，不得笼统略过；
5. 切换按钮可用，切换不重建 runtime（状态跨切换保留）。

⚠️ 第 3 条的「日志可读」是**交付项**，不是顺带 —— Dexter 体验时若出问题，
第一手判断依据就是它。

### 7.4 本轮不取证的两条判据（登记，不得冒充）

| 判据 | 需求原文要求 | 本轮处置 |
| --- | --- | --- |
| **S-12**（Web 段） | 「重启」＝刷新页面（进程与 JS 上下文重建） | **不以自动化取证**。persistence 的落盘正确性仍须由 focused test 证明真实 storage 而非内存端口（红向量：换内存端口必红） |
| **S-26 ①** | 浏览器 resize 后宽高与宽高比不变 | **不以自动化取证**。仍须由 focused test 断言外壳容器的尺寸**声明**（红向量：改 `flex: 1` 必红） |

⚠️ 报告中这两条**不得表述为「Web 已验刷新／resize」**，只能表述为
「声明级／落盘级已由 focused test 证明，真实浏览器行为本轮未取证」。
它们进入欠账，与真机段一并处理。

### 7.5 判据分层（需求 §11.1 已写死，本文只是搬过来对齐）

| 层 | 判据 | 本段的意义 |
| --- | --- | --- |
| Web 段专属 | **S-25** | 验外壳开发设施，真机上不存在，**不进第二段复验清单** |
| 本段可终判 | 场景 1–9 单屏路径、S-1…S-11、S-13a/b、S-14、S-15、S-18…S-23 及 active P | focused test 绿即为该判据的最终结果 |
| 本段只作前置证据 | **S-12、S-16、S-17、S-24** 及场景 4–8 的双屏路径 | 第一段绿**不等于完成**，第二段必须复验 |
| 本段给不出证据 | **S-27、S-28、S-29** | Kotlin 拉起副屏、真实 `getDisplayInfo`、MMKV 落盘在 Web 上不存在，**不得以「Web 已验双屏内容分区」代证** |
| 本轮不取证 | **S-12 的刷新语义、S-26 ①** | 见 §7.4，登记欠账 |

### 7.6 S-7b 的双／单屏落点（原计划 §11 已写，不得简化）

必须分别走双屏与单屏两条路径，不以「取消后回表单」一个断言代替两种语义；
两条路径**各自保留 production red vector**，mutation 只改 production、夹具固定。

## 8. 第一段的停止条件

出现下列任一情况，**停下来交 Dexter**，不得自行绕过：

1. 需求 §6.7 的入口形态在当前 Expo 版本下不可行（见 §4.3）；
2. 为了让 Expo Web 跑起来，需要改动 `kernel/base/platform-ports` 的端口签名；
3. 为了让 Expo Web 跑起来，需要让业务包或 `sample-console` 库侧感知 `surfaceMode`；
4. 任一 Web 适用判据无法在不改需求语义的前提下成立；
5. Expo Web 启动后存在无法解释的启动期错误，或日志取不到 —— 此时不得先交体验。

⚠️ **正常路径的收尾也是「停」**：启动验收全部满足后即停下交 Dexter 体验，
不自行继续推进第二段，也不在体验反馈前补做浏览器自动化。

---

## 9. 第二段不得推翻第一段（Dexter 2026-09-04 要求）

### 9.1 已有的制度保障

- 需求第 1302 行：Web 段不依赖 D-6 结论；
- 原计划第 193 行、详设第 232 行：D-6 spike 若只能形成第二 VM、独立进程、独立 store
  或独立 React 实例，**停止交 Dexter，不得自行降级继续**。

⇒ 不存在「为了让 Android 跑起来，回头改 `ui` 层」的合法路径。

### 9.2 真正的风险点：`PlatformPortBindings` 签名

第一段的十项 binding 由 `test-expo` 的外壳实现填满。若第二段接真实 adapter 时发现某个端口
**签名不够用**，改动落在 `kernel/base/platform-ports` —— 22 个包里 16 个依赖它，
这是唯一能真正推翻第一段的路径。

**缓解**：第一段收口 review 必须专门核「外壳实现有没有**因为是外壳**而掩盖了签名缺陷」，
而不只看 Web 跑绿。具体地，逐项对照十个 binding 的签名与第二段真实 adapter 的已知需要
（`getDisplayInfo` 三态、MMKV 字符串边界与版本化 envelope、`launchDisplayId` 与
`initialProps` 两字段），书面回答每一项「真实实现是否能在不改签名的前提下落进来」。

---

## 10. 待裁决与待实证

| 编号 | 事项 | 性质 |
| --- | --- | --- |
| **E-1** | Expo 工程需要哪些配置文件；`main`／`react-native`／`exports` 如何共存 | 实证，见 §4.2 |
| **E-2** | 需求 §6.7 入口形态与参考实现不一致的收口 | 实证，见 §4.3；不可行则交 Dexter |
| **E-3** | `expo`／`react-dom`／`react-native-web` 与 RN 0.86.3 的版本组合 | 实证，见 §4.1 |
| ~~D-7~~ | 部件内部布局用 flex 还是 absolute | ✅ **已裁定：flex**（Dexter 2026-09-04）。⚠️ 边界见 §5 第 10 条 |
| ~~D-8~~ | S-12 与 S-26 ① 的证据档位 | ✅ **已裁定**（Dexter 2026-09-04）：本轮不做浏览器自动化，两条不取证并登记欠账，见 §7.4 |

⚠️ **D-7 已裁定为 flex，但不等于可以 `flex: 1`** —— 见 §5 第 10 条的边界。

---

## 11. 文档性质

本文是**执行顺序修订**，不构成对需求或详设的修改，也不改变任何判据的严格度。
第一段完成并自验通过后，**先停下来交 Dexter 体验**；
体验反馈处理完毕，再交 Dexter 与 Claude 做静态 review；
第二段在该 review 通过后另行授权。
