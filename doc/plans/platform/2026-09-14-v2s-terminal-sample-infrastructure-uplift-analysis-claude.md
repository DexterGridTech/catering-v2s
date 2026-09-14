# sample 基础设施上收 base · 需求分析(讨论稿,非正式需求)

```text
DOC_KIND=ANALYSIS_DRAFT —— 供讨论,不作为正式需求稿
AUTHOR=Claude
EVIDENCE_TIER=static;未执行任何命令
前身=2026-09-13-...-integration-shared-extraction-requirements-claude.md(REVISION=3,已被本文取代)
```

## 0. Dexter 的方向

> sample(不仅是 integration,还包括 kernel.feature、ui.feature、assembly 等)的目的就是**专注业务**,基础设施都应该上收到 base 中。

## 1. 为什么这次的条件和上一版根本不同

上一版(2026-09-13)三轮 fresh 盲审推翻,**首要死因是"依据建立在假设上"**——当时只有一个 integration,我靠"假设存在第二个包会照抄"来论证重复。

**现在两个 sample 都有真实代码。** 下面每一条都是两个真实实例的逐字比对结果,不是推测。

⚠️ 按 §10.3 立的规矩,本文所有"相同/重复"的断言都附检索方式与命中量。**cwd = `apps/terminal`,分母 = first-party 源码,不含 `node_modules`。**

---

## 2. 实测重复(这是本文的全部依据)

### 2.1 `assembly/android` 层:几乎 100% 是基础设施

`diff sample-terminal/src/assembly/platformPorts.ts sample-wallpaper-terminal/src/assembly/platformPorts.ts`

**前 33 行逐字相同**(全部 adapter 接线:persist-kv、device、app-control、logger、dual-screen 的组装)。差异只有三处**变量**:

| 差异 | 内容 |
|---|---|
| import 哪个 integration | `ui-integration-sample-console` vs `...-sample-wallpaper-console` |
| `persistenceKey` 字面量 | `'sample-terminal-android'` vs `'sample-wallpaper-terminal-android'` |
| 导出的工厂函数名 | `createSampleTerminalAssembly` vs `createSampleWallpaperTerminalAssembly` |

**连 `surfaceHostSourcesByDisplayIndex` 的 `{0: PRIMARY, 1: SECONDARY}` 两行都逐字相同。**

⇒ **assembly 层本就该零业务。它现在的"业务"只有三个变量。**

### 2.2 `ui/integration` 层:装配编排逐项对应

两个 `assembly.tsx`(389 行 / 313 行)的顶层结构**逐项对应**,只有名字不同:

```
两边都有: defaultPersistenceKey · mainContainerKey · SurfaceInputFrame
          createStateSource · createDispatchCommand · createSurfaceForDisplayIndex
          装配主体内: surfaceForm · environmentMode · surfaceDeclarations
                     deviceInfoResult · deviceIdentity · runtimeFacts
                     definedParts · uiCatalog · rendererCatalog · uiStateModule
                     modules · runtime · stateSource · dispatchCommand
                     selectUiVariable · selectSurfaceForm
                     boundHostSources · getSurfaceHostSource
                     reportedSurfaceModes · createSurface
只 sample-console 有: sampleAdminTestPart · createSampleDefinedParts · variables
```

逐段亲验:

| 段 | 结果 |
|---|---|
| `createStateSource` + `createDispatchCommand` | **逐字相同**(仅末行折行不同) |
| `createSurfaceForDisplayIndex`(16 行) | **只差 2 行**:类型名 + 错误消息前缀 |
| 装配主体的 runtime facts / device identity 块 | **只差折行** |
| `SurfaceInputFrame`(81 / 75 行) | **已逐行比对,约 90% 相同**;唯一真实能力差异是 `hostSourceAttached`(只 sample-console 传)。**其余差异全部是诊断字段的意外漂移,其中一处是真缺陷** —— 见 §2.6 |

### 2.3 `ui/feature` 层

| 文件 | 结果 |
|---|---|
| `components/requestOutcome.ts` | `member-desk` 与 `staff-auth` **逐字相同,15 行** |
| `assembly/assembly.ts` | `member-desk` 与 `wallpaper-picker` **归一化后完全相同** |
| `moduleName.ts` / `index.ts` | 三个 ui/feature 归一化后相同(样板) |

### 2.4 `kernel/feature` 层

`moduleName.ts` / `dependencies.ts` 在 `member-registry` 与 `staff-session` 归一化后相同。

### 2.5 ⚠️ 一个会自我复制的绕行:从 3 处涨到 5 处

上一版记为 D-5 的那个问题——"workspace 依赖被当成运行期模块依赖",**新包原样照抄了同一个 workaround**:

| 形态 | 位置 | 上一版 | 现在 |
|---|---|---|---|
| 手写排除清单 `runtimeModuleDependencies` | `staff-auth:22` · `member-desk:35` · **`wallpaper-picker:12`** | 2 处 | **3 处** |
| 伪造 base module descriptor | `sample-console` · **`sample-wallpaper-console`** | 1 处 | **2 处** |

**这是本文最重要的一条观察:基础设施缺口不会停在原地,它会随每个新 sample 线性复制。** 上一版我把它判为"要动 kernel/base 所以留给抽 base 轮",结果那一轮没做,于是它翻了一倍。

---

### 2.6 🔴 复制体已经漂移到丢掉契约字段,而且没有门抓到

`SurfaceInputFrame` 逐行比对挖出的不是重复,是**缺陷**:

| 字段 | sample-console | sample-wallpaper-console |
|---|---|---|
| `startup.surfaces.declared` 的 `kind` | `kind: 'declared'`(`:121`) | **没有**,被 `source:` 顶替(`:97`) |
| `startup.surfaces.measured` 的 `kind` | `kind: 'measured'`(`:142`) | **没有**(`:117`) |
| 诊断来源字段名 | `sampleSource`(`:103`) | `source` |

**后果是硬的,消费者在 kernel/base**:

- `kernel/base/platform-ports/src/foundations/createPlatformPorts.ts:102` 的 `readSurfaceKind` 读的就是 `kind`;
- `:116-121` 的 `recordStartupSuccess` **只在 `displayMode !== undefined && kind !== undefined` 时**才把该 surface 记进 tracker;
- `:108-110` 的 `allStartupGroupsCompleted` 要求 `surfaces.some(s => s.declared && s.measured)`。

⇒ **sample2 的 `tracker.surfaces` 永远为空 ⇒ "startup complete" 诊断永远不会触发。**

另:`sampleSource` 全仓**只出现一次**(`sample-console:103`),无任何消费者,是同一次复制里改歪的另一处。

⚠️ **这条比任何重复计数都更能说明问题**:两个 console 建立前后相差不到一天,复制体已经漂移到**丢掉一个 kernel/base 消费者依赖的契约字段**,而**没有任何门抓到**——`startup.surfaces` 的字段契约今天只存在于 `createPlatformPorts` 的读取端,写入端靠人记得。

**这是"上收"最直接的收益论据:上收之后写入端只有一处,契约漂移在结构上不可能发生。**

## 3. 按 Dexter 的定义重新划线

他说的是 **"sample 专注业务"**。那判据就不是"重不重复",而是:

> **这段代码,换一个完全不同的业务,会不会一字不改地再写一遍?**

会 ⇒ 基础设施 ⇒ 上收。不会 ⇒ 业务 ⇒ 留在 sample。

这条判据比上一版的"观察到重复才抽"更准,**而且现在可以逐条实测**——两个 sample 的业务确实完全不同(会员登记 vs 壁纸选择),所以"两边一样的东西"就是"与业务无关的东西"。

### 3.1 按这条判据分类

| 分类 | 内容 | 依据 |
|---|---|---|
| **纯基础设施,应上收** | assembly 的全部 adapter 接线;`createStateSource`/`createDispatchCommand`;`createSurfaceForDisplayIndex`;runtime facts / device identity 装配块;`requestOutcome`;ui/feature 的 `assembly.ts` 形状 | §2 逐字比对 |
| **基础设施缺口的症状,应消除而非上收** | `runtimeModuleDependencies` 排除清单(3 处)、伪造 descriptor(2 处) | §2.5 |
| **真业务,留在 sample** | 会员登记的 7 个 actor 与 9 个 part;壁纸的 slice/命令/picker;两个 console 各自的 placement 决定;各自的 theme 取值 | 两边完全不同 |
| **形态上像基础设施但实为产品决定** | `AdminLauncher` 出现在哪块屏;副屏放什么;`sampleAdminTestPart` | 换个 console 答案可以不同 |

---

## 4. 我认为该怎么上收(讨论用,不是结论)

### 4.1 ✅ 新建 `assembly/base/android`(Dexter 2026-09-14 裁定)

> 新建 `assembly/base/android`,增加 `expo-splash-screen`。但是要保留 `assembly/android/*` 一定的自主权,比如 app 名称、icon、开机动画内容的定制等等。

**机制可行性已亲验**:
- 分层方向允许 —— `isInvalidDirection`(`terminal-layering/check-static.mjs`)对 `fromLayer === 'assembly'` 一律返回 false,**assembly 可以依赖 adapter 与 ui**;
- 命名可行 —— `moduleNameToRelativePath` 要求**恰好三段**,`assembly.base.android` → `apps/terminal/assembly/base/android`,合法;包名为 `@catering-v2s/assembly-base-android`。

#### 4.1.1 ⚠️ `expo-splash-screen` 是真新增能力,不是搬运

亲验:**该包当前根本不是依赖**,`sample-terminal/app.json` 里既无 `plugins` 也无 `splash` 键。现在的开机画面是 Expo prebuild 的隐式默认(`assets/splash-icon.png` + 生成的 `Theme.App.SplashScreen`),**JS 侧没有任何控制点**。

引入它的实际价值与本架构直接相关:`createStateRuntime` 在 store 可见前就完成 hydrate,**首帧已是正确内容**;但从 native 启动到 JS ready 之间有一段空窗,现在是 Expo 自己决定何时收起。显式引入后,base 可以把收起时机对齐到 `runtime.start()` 完成。

⚠️ **收起时机要单独定**:是 `runtime.start()` 返回即收,还是等首个 surface 挂载?前者更早、可能闪一下空白;后者更稳、但双屏下"首个 surface"是哪一个要定义。**这条列入 §6。**

#### 4.1.2 归属划线(按 Dexter 的自主权要求)

| 归 `assembly/base/android` | 归各 `assembly/android/<app>` |
|---|---|
| 全部 adapter 接线(persist-kv / device / app-control / logger / dual-screen) | `app.json` 的 `expo.name` / `slug` |
| `createAndroidTerminalAssembly` 工厂 | `assets/` 全部图片(icon、splash-icon、favicon、adaptive icon 三件套) |
| `surfaceHostSourcesByDisplayIndex` 的 `{0:PRIMARY, 1:SECONDARY}` 组装 | `app.json` 的 `splash` 配置(背景色、resizeMode、图片) |
| splash 生命周期控制(何时 `preventAutoHide` / `hideAsync`) | `android/` 原生工程:`applicationId` / `namespace` / Kotlin 包路径 / `rootProject.name` / `strings.xml` 的 `app_name` |
| `App.tsx` 的骨架:读 initial props(`displayIndex` / `surfaceForm`)、assembly 缓存 | `persistenceKey` 字面量 |
| | 注入哪个 integration 工厂 |
| | `tailwind.config.cjs`(主题取值,按 `README:19,44` 不上收) |

**判据**:凡属**身份与观感**的留在各 App(这正是 Dexter 说的自主权);凡属**接线与生命周期**的上收。

⚠️ **`android/` 原生工程不上收** —— 它承载的正是身份(包名、applicationId、app_name)。但**可以考虑上收一份模板或生成指引**,避免每个新 App 靠手抄改名(这是 sample2 实施时 CP-7 的实际痛点)。**是否要模板列入 §6。**

⚠️ **`metro.config.js` / `babel.config.cjs` / `nativewind-env.d.ts` 三者两边几乎相同,但它们是构建期配置、不进包图**(`collectStaticImportSpecifiers` 只扫 `src`)。上收它们需要另一种机制(共享 preset 而非 workspace 依赖)。**本文暂不主张收,列入 §6。**

### 4.2 integration 层:把装配编排做成一个可参数化的骨架

两个 `assembly.tsx` 减去业务后剩下的就是同一套流程。形态大概是:

```
createTerminalConsoleAssembly({
  moduleName, persistenceKey,
  featureAssemblies,        // 各 ui/feature 的 parts + variables + createModule
  kernelModules,            // 各 kernel/feature 的 module 工厂
  placementActor,           // ← 唯一真业务:谁在什么时候占哪块屏
  surfaceChildren,          // ← 壁纸背景这类背景槽内容
  renderContentFrame,       // ← AdminLauncher 等 chrome
})
```

留在各 console 的就只有 `placementActor` 与几个注入项——**这正好对应 sample 治理轮定的"编排层只承接跨 service 的决定"。**

⚠️ 但要小心:上一版我在这里栽过。**`SurfaceInputFrame` 的 81 行我没逐行比对过**(§2.2 标了 UNVERIFIED),它里面大部分是 `__DEV__` 诊断,可能两边差异不小。**先比对再决定它进不进骨架。**

### 4.2b ✅ 参数化优先(Dexter 2026-09-14 裁定:「明显跟业务无关的内容,先参数化吧」)

这条把 §4.2 的开放度定死了:**不追求一步找到完美抽象边界,先把"明显与业务无关"的那部分参数化出去**,边界留给后续真实用例去逼。

具体到 §2 实测的那批:

| 先参数化(明显无关业务) | 暂不动(边界待定) |
|---|---|
| `createStateSource` / `createDispatchCommand`(逐字相同) | `SurfaceInputFrame`(81 行,**未逐行比对**,§2.2 标 UNVERIFIED) |
| `createSurfaceForDisplayIndex`(只差类型名与错误前缀) | `createSampleDefinedParts`(只有一个 console 有) |
| runtime facts / device identity 装配块(只差折行) | `renderContentFrame` 里的 `AdminLauncher` 组合(TR-13 要求存在,但形态是产品决定) |
| `requestOutcome.ts`(逐字相同,15 行) | 各 console 的 placement actor(真业务) |
| ui/feature 的 `assembly.ts` 形状(归一化后相同) | |

⚠️ **`SurfaceInputFrame` 必须先逐行比对再决定。** 它里面大部分是 `__DEV__` 诊断,两边可能差得不少;上一版我栽在"结构看着一样就下结论",这次不重犯。

### 4.3 `runtimeModuleDependencies` / 伪造 descriptor:这个必须先做

它不是"抽取",是**修一个 kernel 契约缺口**:`dependencies.ts` 的 `dependencyModuleNames` 同时被当作 workspace 依赖和运行期模块依赖,而全仓只有两个 base 包真的注册运行期模块。

⚠️ **建议它排在所有抽取之前**,理由不是优先级偏好,而是:**它每多一个 sample 就多两处复制**,而后面的抽取会新建更多包。

⚠️ **按 Dexter 「统一」的裁定(§6 第 3 项),这条与其余上收在同一个立项内完成,但仍建议在该立项内部排在最前** —— 因为 §4.1 的 base assembly 工厂本身要声明依赖,如果契约缺口还在,新包会成为第 6 处、第 3 处复制。

---

## 5. 与既有裁定的冲突检查

上一版死在"没查既有裁定"。这次先查:

| 裁定 | 本文是否冲突 |
|---|---|
| `README:19,44` 主题属 integration,**不建共享 theme 包** | **不冲突** —— §3.1 把 theme 取值划入"真业务",不上收 |
| `README:46` 不在第二处解析 `package.json` | **需注意** —— §4.2 的骨架若接管 `terminalSurfaces`,要保证仍是单一解析点 |
| `README:64` 先在真实旅途中看见重复再下沉 | **满足** —— 本文全部依据是两个真实 sample 的逐字比对 |
| `TR-12` 1:N、partKey 不出 kernel | **不冲突** —— placementActor 留在各 console |
| `TR-13` 每个 integration 必须集成 admin console | **需注意** —— §4.2 的骨架应把 admin console 接入做成默认而非可选,否则新 console 可能漏配 |

---

## 6. 四个问题的裁定与新产生的开放项

### 6.1 ✅ 已裁定(Dexter 2026-09-14)

| # | 原问题 | 裁定 |
|---|---|---|
| 1 | assembly 基础设施落哪一层 | **新建 `assembly/base/android`**,并增加 `expo-splash-screen`;各 App 保留身份与观感的自主权(§4.1) |
| 2 | integration 骨架参数化程度 | **明显与业务无关的先参数化**,不追求一步到位的抽象边界(§4.2b) |
| 3 | 顺序,以及与 sample 治理轮的先后 | **统一** —— 治理轮与基础设施上收**合成一个立项**,不分先后两轮。⚠️ 我按此理解:因为 integration 骨架的参数化边界**就是**治理轮要定的那条边界,分开做等于定义两遍。**理解有偏请纠** |
| 4 | `moduleName.ts` / `index.ts` 这类样板收不收 | **不收** |

### 6.2 ✅ 剩余四项的裁定(Dexter 2026-09-14)

> 收起时机应该是**主屏加载完毕后**,其他的你根据最优最长远的方向定,**上收能力,下放配置项**。

**"上收能力,下放配置项"这条判据同时解掉了另外三项**,逐条按它落:

| # | 项 | 裁定 |
|---|---|---|
| 1 | splash 收起时机 | **✅ Dexter 裁定:主屏加载完毕后。** 即 PRIMARY surface 首次挂载完成时 `hideAsync()`,不是 `runtime.start()` 返回即收。双屏下**只看 PRIMARY**,副屏挂载与否不影响——这也顺带回答了我原来问的"首个 surface 是哪一个" |
| 2 | `android/` 原生工程 | **能力上收、配置下放**:身份值(`applicationId` / `namespace` / Kotlin 包 / `app_name` / `slug`)是**配置**,留各 App;而"新 App 的身份不得与既有 App 相撞、`app.json` 引用的 assets 必须存在"是**能力**,上收为 `assembly/base/android` 侧的一条静态校验。⚠️ **不做模板**——模板是把配置也复制一份,正是要消除的形态 |
| 3 | `metro.config.js` / `babel.config.cjs` / `nativewind-env.d.ts` | **能力上收、配置下放**:三者的**机制**(Metro monorepo 解析、NativeWind 接入、类型垫片)上收为 `assembly/base/android` 导出的共享 preset;各 App 的 `metro.config.js` 只剩"引 preset + 指向自己的 `theme/global.css`"两行。⚠️ 它们不进包图(`collectStaticImportSpecifiers` 只扫 `src`),所以**上收后要补一条"每个 assembly 的 metro 配置必须引用 base preset"的校验**,否则漏引不会红 |
| 4 | `SurfaceInputFrame` | **✅ 已逐行比对完(§2.2 的 UNVERIFIED 解除)**:约 90% 相同,唯一真实能力差异是 `hostSourceAttached`。**上收为能力,`hostSourceAttached` 下放为配置项**。⚠️ 上收时必须以 sample-console 的字段集为准(含 `kind`),并把 §2.6 的漂移一并修掉 |

#### 6.2.1 判据落成一句可执行的话

> **base 提供"怎么做",app 提供"是什么"。** 凡是换个业务仍然一字不改的流程、时机、校验、接线 ⇒ 能力 ⇒ 上收;凡是每个 App 必然不同的名字、图片、颜色、标识、键值 ⇒ 配置 ⇒ 下放。

按这条复查 §4.1.2 的归属表,**无需改动**——它当初划的"身份与观感 vs 接线与生命周期"就是同一条线的另一种说法。

### 6.3 ✅ 批次(Dexter 2026-09-14 裁定:「肯定是不同批次」)

合成一个立项,**内部按改动落点分成互不重叠的批次**,不按"治理 / 上收"这两个概念分。

⚠️ 具体切法待正式需求给,但有一条现在就能定:**§4.3 的契约缺口必须是第一批** —— 因为 `assembly/base/android` 这个新包本身要声明依赖,契约缺口还在的话,它会成为第 6 处排除清单或第 3 处伪造 descriptor。

## 7. 本文的边界

讨论稿,**不是正式需求**。未执行任何命令。§2.2 的 `SurfaceInputFrame` 标 UNVERIFIED,未逐行比对。§4 的三个形态是讨论用草图,**不是设计结论**——正式需求前至少要把 §6 的四个问题定下来,并把每段待上收代码逐行比对一遍(不能再靠"结构看着一样"就下结论,那是上一版栽过的坑)。
