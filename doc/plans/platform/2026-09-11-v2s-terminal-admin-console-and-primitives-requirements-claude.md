# TER admin console、primitives 补齐与系统键盘退役需求

- 日期：2026-09-11（第三版） · 作者：Claude
- 状态：**需求正本,待 Dexter 确认后交 Codex 做详设与实施计划**
- 上游讨论稿：`doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md`
- 目标对象：`catering-v2s/apps/terminal`
- 本文只写需求与验收判据,**不含设计方案,不授权实施**

---

## 0. 版本沿革与盲审处置

第一版由 Dexter 对话裁定构成。共做两轮 fresh 独立盲审,五个 agent,合计 8M / 32S / 21N,两轮均 NO-GO。
本版逐条处置。**本节只陈述改了什么,不作「已完备」这类不可核验的自我认证** ——
判据完备性由 `§9` 的覆盖列逐行自证。

| 盲审发现 | 本版处置 |
|---|---|
| 形态过滤在生产路径零消费:`selectAvailableParts` 无生产调用、`resolvePart` 不比对任何维度 | 新增 `CT-4` 强制点;并让 admin console 成为它的**第一个生产消费者**(见 `AC-5`) |
| 鉴权依赖的设备标识在所有平台不可用 | 新增 `§5`,落到既有 `adapter/android/device` |
| 第一版 `CT-2` 的写法会产出恒等于 `displayMode === 'PRIMARY'` 的布尔 | 第二版据此删除该契约并改用 `displayMode`,**这是对 Dexter 已裁定的 `isHostPrimaryDisplay` 的擅自替换且未上报**。Codex M-01 指出后,Dexter 裁定恢复原方案并把选源修正拉进本轮。`CT-2` 现以正确写法恢复:取值来源是物理显示索引,不由 `displayMode` 派生 |
| **第二版把 `VICE && SLAVE` 误判为「双机才有」,实为单显示器单机才允许进入** | `§1.2` `§3.2` 更正;锁死链登记为 `D-5`;首批三节改为只读 |
| `AC-4.1` 全屏遮罩与 `AC-5.2` 容器键互斥,console 是 layer 还是 screen 从未裁定 | `§4` 裁定 console 是 **layer**,并据此改写 `AC-4.5` 与 `AC-5.2` |
| `admin.*` 容器键在现有 render 契约下无渲染路径 | 随上一条一并解决:section 由 console 层从同一 catalog 枚举,而非经 `ScreenContainer` |
| 端口注入状态在仓内是**方法级**,不是端口级;`device` 今天就是部分注入 | `AC-6.4` 改为按 capability 呈现 |
| 32 条判据中 23 条可被「恶意但合规」实现绕过,13 条子需求零覆盖,8 条无红夹具 | `§9` 重写,增加覆盖列与红夹具列,逐条按盲审给出的绕过路径加固 |
| 「层样式结构上不是全屏」事实错误;layer 容器本就绝对满铺 | `§2.1` 更正;`A-13` 改为量 console 根节点尺寸而非遮罩 |
| suspend 只在 0 层变有层时广播一次,业务层已开时再开 admin 不触发 | `AC-4.3` 补「无论此前是否已有 layer」 |
| `A-18` 的「四处调用点」实为十处 | 改为不带数字的分母 |
| `D-3` 既登记「不修」又排进 `CT-6` | 移出 `§1.3`,本轮随 `CT-6` 关闭 |
| `§3.3` 副屏 console 排版要求是双机移出后的残留 | 删除;primitives 的两画布要求保留在 `§7` |
| 设备标识会打断 `check-static.mjs` 的 device descriptor 静态门 | 新增 `CT-8` |
| **`AC-5.4` 原要求每条注册项带 owner 标识与顺序依据** | **Dexter 2026-09-11 裁定「不需要顺序键,按 list 排序」,本次对账一并去掉 owner 字段**:owner 已由 `partKey` 命名空间承载,顺序取自单一 catalog 列表;若保留 owner,catalog 就需要一个只有 section 才有的可选字段,会重新触发 `assertEntryKeys` 的 exact-key 崩溃路径。`AC-5.4` 与 `A-19` 据此改写,`AC-5.3` `AC-5.5` 不变 |

---

## 1. 目的与范围

### 1.1 目的

1. 建立正式产品级 admin console:框由 `ui/base/admin-shell` 提供,内容由各业务包注册。
2. 建立设备形态维度并让 part 过滤**真正在生产路径上生效**。
3. 把 `ui/base/primitives` 补齐到生产交互标准。
4. 退役系统键盘,所有输入走应用自带虚拟键盘,不做中文。
5. 建立稳定设备标识能力,作为 admin 鉴权的输入。

### 1.2 不在本轮范围

- **双机拓扑**。已核实今天不可达:`kernel/base/transport` 是空壳,`installPeerDispatchGateway` 生产零调用。
- **admin section 的写操作**。Dexter 裁定:admin 当然要能写,否则无法控制;但**本期只读**。写能力立项时必须先解决 `D-5`。
- 竖屏在 Android 真机上的验收。Android sample **本期只按 laptop 虚拟机运行**;竖屏由 `sample-console` 承载,见 `§3.1`。
- `kernel/base` 的 `contracts`、`transport`、`workflow` 三个包的管理界面。
- `ui/feature` 业务功能本身的管理界面(本轮只建通道)。
- 自动化专用触发节点(`ui/base/automation` 是空壳,`src/` 仅 10 行)。

### 1.3 随本轮登记的已知缺陷

| ID | 缺陷 | 依据 |
|---|---|---|
| `D-4` | `environmentMode` 三个入口硬编码为 `'DEV'`,被消费后不暴露给下游,生产零消费者 | `sample-terminal/src/assembly/platformPorts.ts` 第 20 行;`dev-host/src/implementations/webPlatform.ts` 第 70 行;`sample-console/src/assembly/assembly.tsx` 第 175 行;`platform-ports/test/platformPorts.test.ts` 第 64 行 |
| `D-5` | **admin 写能力一旦落地即存在永久锁死路径。** `getSwitchInstanceModeEligibility` 放行 SLAVE 的条件是 `displayCount === 1`,即单显示器单机**可以**进入 SLAVE;再经 `resolvePowerRoleTarget` 或手动切到 VICE,`resolveSurfaceDisplayMode` 即返回 SECONDARY,门禁判假,按 `AC-1.5` 手势节点不挂载,**无自救路径**;`runtimeInstanceMode` 为 `persistIntent: 'owner-only'` 加 `flushMode: 'immediate'`,重启不自愈,且无 instanceMode 的水合校验 actor。**本轮门禁改用物理事实后该链前提消失,见本节下方** | `kernel/base/display-context/src/foundations/displayDerivation.ts` 第 38 至 62 行;`kernel/base/runtime/src/features/slices/runtimeInstanceMode.ts` 第 30 至 36 行 |

`D-4` 本轮不修。若详设认为调试态应与它共用同一条 assembly 配置通道,可一并整改,须写明理由与影响面。

早前登记为 `D-1` 与 `D-2` 的两条缺陷 —— 副机 surface 因选源错误永远停在 pending,以及 adapter 的 `surfaceKey`(物理索引)与 display-context 的 `DisplayMode`(逻辑角色)同名不同义 —— **已移入本轮范围**,由 `CT-2` 的选源修正一并解决,故不再列为登记缺陷。

`D-5` 的处置随之改变:门禁改用物理事实之后,它**不再依赖 `displayMode` 或 `instanceMode`**,
那条锁死链的前提整个消失。`D-5` 由「靠只读规避」升级为**结构上不可能发生**。
本轮 admin section 仍只读,但那是范围裁定,不再是安全兜底。

---

## 2. 已核实的仓内事实

两轮盲审共核 69 条,本节只列本需求据以成立的部分。凡本版更正过的,标注「更正」。

### 2.1 与 admin console 相关

| 事实 | 位置 |
|---|---|
| `ui/base/admin-shell` 是空壳,`src/` 共 13 行,依赖边已声明六条,缺 `display-context` 与 `input` | `ui/base/admin-shell/src/`;`apps/terminal/skeleton-graph.ts` 第 94 至 106 行 |
| `LayerTier = 'standard' \| 'alert'`;`LayerGuard = 'dismissible' \| 'decisive'`;外部点击关闭走 backdrop 的 `Pressable`,受 dismissible 闸门控制 | `ui/base/render/src/types/catalog.ts` 第 7、8 行;`components/LayerStack.tsx` 第 165、194 至 199 行 |
| **更正**:`styles.layer` 与 `styles.backdrop` **都是绝对满铺**;不满铺的是层内居中的子内容,且带 24 内边距 | `components/LayerStack.tsx` 第 39 至 56 行 |
| 焦点挂起是 **surface 级**,且**只在层数从 0 变为非 0 时广播一次**;restore 同理只在回到 0 层时触发 | `components/LayerStack.tsx` 第 136 至 155 行;`ui/base/input/src/hooks/useInputFocusController.ts` 第 34、62、148 至 160 行 |
| layer 型 part 的 `containerKeys` 恒为空数组;`LayerStack` 用 `selectLayers` 取层,**完全不看 containerKey** | `ui/base/render/src/foundations/definePart.ts`;`components/LayerStack.tsx` 第 107 至 109 行 |
| `ScreenContainer` 不接 prop,`containerKey` 只能来自 `SurfaceContext`,Provider 全仓仅一处,集成层写死 `'main'` | `components/ScreenContainer.tsx` 第 11 行;`components/SurfaceRoot.tsx` 第 75 行;`assembly.tsx` 第 34、238 行 |
| layer 位于画布变换之内 | `SurfaceRoot.tsx` 第 61 至 73 行 → `SurfaceHostController.tsx` 第 90 至 99 行 |
| content 容器持久化,**layers 不进持久化面**;content 的 `syncIntent` 为 `isolated` | `kernel/base/ui-state/src/foundations/workspaceSlices.ts` 第 217 至 222、270 至 287 行 |

### 2.2 与形态、门禁相关

| 事实 | 位置 |
|---|---|
| `UiCatalogEntry` 共八个字段,过滤维度三个,无形态维度 | `kernel/base/ui-state/src/types/catalog.ts` 第 8 至 17 行 |
| `selectAvailableParts` **生产路径零调用** | `kernel/base/ui-state/src/foundations/catalog.ts` 第 124 行 |
| `resolvePart` **不比对任何维度** | `ui/base/render/src/components/resolvePart.ts` 第 72 至 111 行 |
| `showScreen` / `openLayer` 的 actor 连 partKey 是否在 catalog 里都不查 | `kernel/base/ui-state/src/features/actors/contentActors.ts` 第 166 至 198 行 |
| `definePart` 生产调用恰 12 处 | `ui/feature/*/src/parts/parts.ts` |
| `assertEntryKeys` 要求 own keys 精确等于批准字段集,`assertClosedArray` 要求非空 | `kernel/base/ui-state/src/foundations/catalog.ts` |
| `SurfaceContextValue` 今天只有 `displayMode` 与 `containerKey`;`UiCatalogContext` 不含形态 | `contexts/SurfaceContext.ts` 第 4 至 7 行;`ui-state/src/types/catalog.ts` 第 24 至 28 行 |
| **更正**:`getSwitchInstanceModeEligibility` 放行 SLAVE 需三个条件同时成立 —— `routeDisplayMode` 非空、不是 `SECONDARY`、且 `displayCount === 1`。关键含义不变:SLAVE 是**单显示器单机可进入**的状态,不是双机专属 | `display-context/src/foundations/displayDerivation.ts` 第 38 至 55 行 |
| `switchInstanceModeCommand` **无外部生产 caller**;command 与 actor 在 `createDisplayContextModule` 中确有生产注册,actor 内部有子 dispatch | 全仓检索 |
| **画布声明已按 orientation 分组,且解析器强制竖屏不得含 SECONDARY** | `sample-console/src/application/terminalSurfaces.ts` 第 42 至 50 行 |
| 当前 package.json 只有 `landscape` 一组,`portrait` 未填 | `sample-console/package.json` 第 11 至 24 行 |
| `sample-terminal` 的 App 只接 `displayIndex`,无方向或形态参数 | `assembly/android/sample-terminal/App.tsx` 第 7、16 行 |
| `adapter/android` 现有五个包:`app-control` `device` `dual-screen` `logger` `persist-kv` | `apps/terminal/adapter/android/` |

### 2.3 与鉴权相关

| 事实 | 位置 |
|---|---|
| `getDeviceInfo` 在**当前已实现并已检查的三个 adapter**(默认、Android、Web 预览)均为 unavailable;Android 原生只实现 `getDisplayInfo` | `adapter/android/device/android/.../TerminalDeviceModule.kt` 第 16 行;`adapter/android/device/src/implementations/androidDevice.ts` 第 70 行;`dev-host/src/implementations/webPlatform.ts` 第 45 行 |
| **`DeviceInfo.deviceId: string` 的契约槽位今天就存在** | `kernel/base/platform-ports/src/types/device.ts` 第 4 至 11 行 |
| `DevicePort` 六个方法全部返回 `Promise` | 同文件 第 54 至 61 行 |
| `check-static.mjs` 把 `getDeviceInfo` 硬编码为 `unavailable`,一旦转 real 该静态门会红 | `tools/terminal-readability/check-static.mjs` 第 66 至 79 行 |
| `createNodeId()` 每次启动都不同,不是设备标识 | `kernel/base/contracts/src/foundations/runtimeId.ts` 第 47 至 55 行 |
| POC 的设备标识:`Settings.Secure.ANDROID_ID` 经 SHA-256 派生 10 位,缓存进 SharedPreferences;无需权限;重启、清数据、重装均不变,仅恢复出厂设置才变 | `newPOSv1/3-adapter/.../DeviceManager.kt` 第 218 至 245 行 |

### 2.4 与输入相关

| 事实 | 位置 |
|---|---|
| `applyKeyboardKey` 已接受 `maxLength`;`insertText` 在上限处插入空串 | `ui/base/input/src/foundations/editText.ts` 第 50 至 53、80 至 84 行 |
| 虚拟键盘四个布局,无中文 | `foundations/keyboardLayout.ts` 第 1 行 |
| 全仓唯一 `keyboardKind: 'system'` 的字段是会员姓名 | `ui/feature/sample-member-desk/src/components/MemberForm.tsx` 第 35 行 |
| **更正**:虚拟键盘可见性是**三个**合取项:`owner === 'virtual'`、`activeFieldId !== null`、`surfaceMetrics.visible` | `components/InputProvider.tsx` 第 177 至 180 行 |
| `InputFieldRegistration.inputRef` 必填,焦点推进依赖它 | `types/types.ts` 第 84、96 行 |
| **更正**:`useInputField` 第 156 行**总是显式传** `showSoftInputOnFocus`;可选性在 `PrimitiveInput` 的 props 类型上 | `hooks/useInputField.ts` 第 156 行;`ui/base/primitives/src/types/types.ts` 第 57 行 |
| Android 侧 IME 可见性参与 stable 尺寸复用判据与快照发布闸门,且**两处都只在 `imeVisible === true` 时改变行为** | `TerminalDualScreenActivityHandler.kt` 第 141、263 行 |

### 2.5 与 primitives 相关

| 事实 | 位置 |
|---|---|
| primitives 九个组件;`vendor/slots.tsx` 只包五个 RN 组件 | `ui/base/primitives/src/` |
| 语义色板七色,零状态色 | `sample-console/theme/global.css` 第 7 至 13 行 |
| `PrimitiveButton` 三个 variant 中两个是虚拟键盘专用,无 tone,无忙碌态;且已有内联 `style` 通道 | `components/PrimitiveButton.tsx` |
| 两个业务包各有 58 行逐字节相同的 `controls.tsx`;`DialogSurface` 与 `EmptyState` 是真复合件,`DialogActions` 与 `ScrollArea` 是零逻辑别名 | `ui/feature/*/src/components/controls.tsx` |
| **更正**:这四个符号在业务侧共 **十处**引用(`DialogActions` 六处、`ScrollArea` 四处),另加 `DialogSurface` 与 `EmptyState` 的引用 | 两个业务包的 `components/` |
| 十五个业务组件文件的 `react-native` 导入为零 | `ui/feature/*/src/components/*.tsx` |
| **更正**:primitives 内 `from 'react-native'` 共三处,其中 `types/types.ts` 与 `PrimitiveButton.tsx` 是 **type-only** 导入,位于 vendor 之外 | `ui/base/primitives/src/` |
| `PrimitiveInput` 有一处 `typeof document === 'undefined'` 的 RNW 分支 | `components/PrimitiveInput.tsx` 第 63 行 |
| **`apps/terminal` 直接依赖中**无 SVG 或图标依赖;NativeWind 声明了 `react-native-svg` 可选 peer,未安装。⚠️ 全仓范围内 `apps/frontend` 两个后台各有 `@ant-design/icons`,故不得写成「全仓无」 | 全仓 package.json 与 `yarn.lock` |

### 2.6 两版 POC 与不应继承的部分

POC-A 无任何注册机制(七元素字面量、七个并列三元表达式、两个注册接缝皆空、口令硬编码 `'123'`)。
POC-B 的 registry 是 replace-only 模块级单例,默认自带九个同包屏幕合计 3,709 行,tab 目录是闭合 union。
POC-B 的 `screenMode` 槽位存在且被 registry 消费,但无任何一处把它置为 `MOBILE`。
POC-B 已在 Expo ~54 加 RNW ^0.21 环境下运行 `react-native-svg` 15.15.3 并渲染二维码。

**不得继承**:通用件与 admin 语义件混放于一个 687 行文件;三维全开等于没有过滤;
以及「POC 只用了几个原生控件」不得被解读为 primitives 只需这几件。

---

## 3. 产品形态矩阵

### 3.1 设备形态与方向绑定(Dexter 2026-09-11 裁定)

**形态与方向是同一根轴,不是两根。**

| 形态 | 方向 | surface 拓扑 | 承载 |
|---|---|---|---|
| `laptop` | 横屏 | PRIMARY 加 SECONDARY | 本轮 Android sample 与 Web 预览 |
| `mobile` | 竖屏 | **仅 PRIMARY,无副屏** | 本轮由 `sample-console` 按不同画布组启动承载 |

1. UI 必须按此设计:`mobile` 一律竖屏呈现,`laptop` 一律横屏呈现。不存在横屏 mobile 或竖屏 laptop。
2. 形态的声明载体就是 `terminalSurfaces.orientations` 这一层:`landscape` 即 `laptop`,`portrait` 即 `mobile`。
   **不新增与画布并列的第二个声明槽**,因而不存在同机两个 surface 形态不一致的非法状态。
3. 解析器已强制竖屏不得含 SECONDARY(`terminalSurfaces.ts` 第 42 至 50 行),该约束保留并成为形态约束的一部分。
4. `portrait` 的画布取值本轮必须填入 `sample-console/package.json`,定为 **360 × 800 逻辑单位**(20:9)。
   依据是安卓手持设备最通行的逻辑尺寸,**不是由横屏数字转置**。取得真实目标机型后可替换,
   偏差由既有的非等比拉伸吸收,见 `O-6`。
5. `sample-console` 必须能在启动时选择画布组,使两种形态在本轮都可达。
6. `sample-terminal`(Android)本期**只按 laptop 虚拟机运行**,但其启动参数面必须完整,
   即方向或形态必须是显式参数而非硬编码。当前 `App.tsx` 只接 `displayIndex`,须补齐。
7. 形态是 part 的过滤维度,**所有 part 都参与过滤**。
8. 通用能力尽量沉淀到 `apps/terminal/adapter/android`,不要堆在 assembly。

### 3.2 调起门禁

| 场景 | 能否唤起 |
|---|---|
| laptop 主屏 | 能 |
| laptop 副屏 | **不能** |
| mobile 唯一屏 | 能 |

**门禁的产品语义是「该 surface 是否承载本机主显示」,实现判据就是这个语义本身。**

1. 向 UI 层暴露 `isHostPrimaryDisplay` 派生布尔(Dexter 原 Q-8 裁定,本版恢复)。
   它的取值来源是**物理显示索引**,不经 `displayMode` 或 `instanceMode` 派生。
2. 连带修正 host source 的选源:当前集成层按**逻辑** `displayMode` 索引 `surfaceHostSources`,
   而 adapter 的 source 是按**物理** surfaceKey 注册的,两者同名不同义。
   选源必须改按物理显示索引。画布仍按 `displayMode` 选,两条选择互不混用。
3. 因此**不需要**任何关于 `instanceMode` 的条件性断言。第二版曾用
   `displayMode === 'PRIMARY'` 加 `instanceMode === 'MASTER'` 断言来近似该语义,
   本版废弃该做法 —— 它是作者在未上报的情况下对 Q-8 裁定的擅自替换。

### 3.3 画布

- admin console 渲染在逻辑画布之内,跟随该 surface 的画布与 scale。
- **画布可在运行时切换,本轮在范围内**(Dexter 2026-09-11 裁定,恢复上游 Q-11)。
  画布按 `displayMode` 选,而 `displayMode` 由 `displayRole` 与 `instanceMode` 派生,
  单显示器机器上 `displayRole` 会随电源在 CHIEF 与 VICE 之间变化,因而画布运行时可变。
  第二版写「挂载后固定不变」是错的,它建立在「VICE 加 SLAVE 属双机」这一已被证伪的前提上。
- 切换时必须明确并验证四件事:几何重算(承载层每次渲染现算,预期自动跟随)、
  已打开的 admin console 的去留、输入焦点的去留、滚动位置的去留。
- **验收档位为 focused,脚本驱动即可**(Dexter 裁定),不要求真机电源插拔。
- **console 本体只需在其可被唤起的画布下排版正确**,即 laptop 的 PRIMARY 画布与 mobile 的唯一画布。
  副屏画布下 console 不可达,不作要求。`§7` 的 primitives 在两个画布下的表现另由 `A-16` 覆盖。

---

## 4. admin console 需求

### `AC-0` 承载形态(本版新裁定)

**admin console 是一个 layer,不是 screen。**

依据:`AC-4.1` 要求全屏遮罩,`PR-7` 禁止第二套叠放系统,故只能用 `LayerStack`。
由此连带确定三件事:

1. console part 的 `containerKeys` 为空数组,由 `selectLayers` 取层,与既有 layer 型 part 一致。
2. **section 不经 `ScreenContainer` 渲染**。`ScreenContainer` 不接 prop 且 `containerKey` 写死为 `'main'`,
   `admin.*` 容器键走不通它。section 由 console 层**从同一个 `UiCatalog` 枚举**得到。
3. 这使 console 成为 `selectAvailableParts` 的**第一个生产消费者**,与 `CT-4` 互为支撑。

### `AC-1` 调起

1. 入口一律隐藏,没有任何可见控件,唯一调起方式是手势。
2. 手势判据为:**画布左上角 96 × 96 逻辑单位区域内,1800 毫秒窗口内连续按压 5 次**。
   四项取值沿用 POC-B 的既有默认,可被调用方覆盖;若 Dexter 要改,改的是这四个数,不影响判据形状。
3. 判据坐标必须是画布逻辑坐标,不得使用宿主窗口坐标。
4. 判据实现必须是可脱离 UI 直接调用的函数。
5. 门禁为假时,该 surface 的渲染树中**不存在带 admin 手势 testID 的节点**;
   手势必须挂在一个有稳定 testID 的独立节点上,不得直接挂在既有 View 的 props 上。
6. 已有 layer 打开时手势**仍生效**(Dexter 裁定)。

### `AC-2` 鉴权

1. **威胁模型(Dexter 裁定):只防误触与店员乱点,不防掌握源码或设备标识的人。**
   派生逻辑随 bundle 下发、无密钥,任何能读到设备标识与源码的人都能算出口令。
   **这不是安全鉴权,后续不得被当作安全边界引用。**
2. 时间派生口令:由稳定设备标识与当前小时派生六位数字,接受前后各一小时。时间基准为设备本地时间。
3. 时钟异常导致的失败必须给出与「口令错误」可区分的提示。
4. 口令输入使用虚拟数字键盘,固定六格、一格一位。
5. 六格是纯展示,该字段允许没有原生 TextInput;其值必须由**单一字符串状态**驱动,
   不得由六个独立状态或六个输入框组成。
6. 口令不得进入任何日志,包括原生侧日志。
7. **每次打开都要重新鉴权**,不设有效期,关闭即失效。

### `AC-3` 外壳

1. 外壳只含:标题、导航、关闭、返回登录,以及 section 容器。
2. 外壳必须在其可被唤起的每一种形态与画布下成立。
3. section 之间不提供任何跳转,唯一路径是外壳导航。
   **导航必须真的切换**:选中某 section 后,该 section 的内容呈现,前一个不再呈现。
4. **关闭必须真的关闭**:console 消失,业务界面恢复焦点;再次打开回到登录态(与 `AC-2.7` 一致)。
5. 登录、关闭、页签切换三条交互路径的接口必须可测,不得只能靠手点。
6. **UI 形态细节归详设,但不得跳过。**(Dexter 2026-09-11 裁定:M-09 属详设范畴)
   需求阶段只定方向与边界:入口隐藏、六格口令、外壳含哪五类成员、section 不跳转、两种形态各自呈现。
   导航采用何种形式、手持形态下 section 如何选择、各状态的文案与恢复路径,
   由详设按仓内 IA 与交互设计模板产出,**不得在详设中略过这一层直接进实施**。
7. section 的渲染上下文类型中不得存在任何导航能力成员;
   且**从 section 内部 dispatch 导航类 command 必须被拒绝**,仅靠类型缺席不足以约束。

### `AC-3A` 承载未就绪时的加载态

1. 已核实 `SurfaceHostController` 在几何未就绪时返回一个**空 View**,
   没有任何加载指示,children 也不渲染 —— 即整屏空白(`components/SurfaceHostController.tsx` 第 84 行)。
2. 该状态必须改为**明确的加载态**,使用 `PR-3` 的 `Spinner`,而不是空白。
3. 由于 children 不渲染,业务界面与 admin 入口在该状态下**同时不存在**,
   因此这不是门禁问题,不存在「业务可用但 admin 进不去」的处境。需求不为此设 fail open 或 fail closed。
4. Web 预览侧 `isHostPrimaryDisplay` 的取值:PRIMARY surface 为真,SECONDARY surface 为假。

### `AC-4` 遮罩与焦点

1. 全屏遮罩,压在业务界面之上,不得被外部点击关闭。
   **console 根节点的测量尺寸必须等于画布声明尺寸**;仅验遮罩满铺不足以证明,层容器本就满铺。
2. 后面的业务界面不暂停,继续运行。
3. 后面的业务界面没有焦点,其输入字段不可聚焦。
   **无论此前是否已有业务 layer 打开**——已核实 suspend 只在层数从 0 变非 0 时广播一次。
4. admin console 自身的字段必须可聚焦,虚拟键盘按键必须写入 admin 自己的字段。
   详设必须解决焦点作用域,且不得新增第二套叠放或第二套输入管线。
5. console 是 layer 而 layer 不进持久化面,因此重启不恢复是结构保证。
   **但已选 section 不得存放在任何持久化位置**,这一条需要判据。

### `AC-5` 内容注册

1. admin-shell 提供容器与导航,不得 import 任何 `ui/feature` 包。
2. admin section 以 part 声明,使用 `admin.*` 容器键,与业务 part 进入**同一个 `UiCatalog` 实例**,
   由 console 层枚举取出(见 `AC-0`)。
3. 注册是增量的:后注册者不得使先注册者消失。
4. 注册项不设独立的 owner 字段与顺序键(**Dexter 2026-09-11 裁定**)。
   owner 由 `partKey` 的命名空间承载(内建三节为 `admin.console.*`,集成层注入为 `sample.console.*`);
   section 顺序等于过滤后单一 `UiCatalog.entries` 的列表顺序。
   `createUiCatalog` 按输入数组顺序构造并冻结,列表顺序即注册顺序,无需额外字段。
5. 注册面源码中不得存在模块级可变绑定,不得有整体替换语义。
6. 每个 section 自带可见性声明,由框统一求值;**声明与实际可见性必须一致**,不得留成摆设。
7. **`sample-console` 必须向 admin console 注入一个测试 section**(Dexter 裁定)。
   该 section 只保留标题占位,内容可以为空。
   它是注册通道的**生产消费者**,不是测试夹具 —— 用来证明「业务包把内容注册进框」这条路真的通,
   而不是只在单测里通。`A-18` 与 `A-20` 应以它为对象,不再另造夹具 part。

### `AC-6` 自带内容范围

1. admin-shell 自带 `kernel/base` 的界面。**本期全部只读**(Dexter 裁定)。
   写能力是 admin 的应有之义,但立项前必须先解决 `D-5`。
2. 本轮首批为**三节 kernel 界面加一节集成层测试 section**:
   `platform-ports`、`runtime`、`display-context`,以及 `AC-5.7` 的注入 section。
3. 每节必须展示其 kernel 包的真实读数,不得是占位。
4. `platform-ports` 一节按 **capability 粒度**呈现:每个端口的每个方法各自的 `state` 与 `source`。
   **不得呈现端口级的二值「已注入/未注入」**——已核实 `ADAPTER_NOT_INJECTED` 是方法级 reason,
   且 `device` 端口今天就是部分注入(`getDisplayInfo` 为 real,其余五个 unavailable)。
5. 该节的数据来源是能力描述符,而描述符目前整块包在 `__DEV__` 内。
   非 DEV 构建下该节的数据来源必须写明,或显式登记该节仅 DEV 可用。
6. 次批 `state`、`ui-state` 本轮不做;`contracts`、`transport`、`workflow` 本轮不做。

---

## 5. 运行时能力需求(设备标识与调试态)

两者都是由 assembly 在构造时提供、下游可读的运行时事实,admin 是它们的第一个消费者但不是唯一消费者。

### `ID-1` 能力与归属

1. 提供稳定设备标识,填充既有 `DeviceInfo.deviceId` 槽位(该槽位今天已存在),经既有 `DevicePort` 暴露,
   不新建第二条端口。
2. Android 实现落在 **`adapter/android/device`**,与「通用能力沉淀到 adapter」一致;
   不得堆在 assembly。
3. 派生方式沿用 POC:由系统设备级标识经哈希派生定长字符串,首次生成后本地缓存。
   **不得使用需要运行时权限的标识。**
4. 稳定性:重启、清除应用数据、卸载重装均不变;恢复出厂设置后允许变化,届时该机需重新登记。

### `ID-2` 时机与形态

1. 标识在**启动期由 assembly 一次性 await 现有 `getDeviceInfo`** 取得,再把已解析的值传给**同步纯函数**做口令派生与校验。
   **不改 `DevicePort` 契约**,它六个方法保持 Promise。
   判据落在纯函数的入参类型是字符串、且校验路径上不存在异步等待,
   **不得以「源码里没有 await」这种关键词判据代替**。
2. 落地位置必须在详设写明,并说明是否进入 state、是否参与持久化。
3. 取不到标识时:console **必须能打开**,标识显示 `unknown`,**口令默认 `123456`**。
   该路径用于 Web 端调试;生产机器不应出现。
4. 降级路径必须有明确可见的标记与一条诊断记录,不得与正常态外观相同。
5. Web 预览侧该能力定义上不可用,其行为按第 3、4 条执行。

### `DBG-1` 归属与形态

1. 调试态是一个**运行时事实**,有唯一真相来源,由 assembly 在构造时提供。
   Dexter 明确:该标记**以后还有其他用途,不要临时应付**。
2. 它**不是** admin console 的参数。任何声明了正当需要的包都应能读到它。
3. 它必须**真正可读**。已核实既有 `environmentMode` 是反面教材:三个入口全部硬编码为 `'DEV'`,
   且 `createPlatformPorts` 消费后不暴露(`platform-ports/test/platformPorts.test.ts` 第 64 行断言
   `'environmentMode' in ports` 为 `false`),生产零消费者。新标记不得重复该形态。

### `DBG-2` 与既有轴正交

1. 调试态**不得**做成 `EnvironmentMode` 的第四个取值。
2. 必须能表达全部组合,尤其是「**PROD 包处于调试态**」与「DEV 包不处于调试态」。

### `DBG-3` 与 `__DEV__` 的关系

1. 调试态**不是** `__DEV__`。后者绑定 bundle 的 dev/prod 形态,而调试态必须能在 release bundle 中开启。
2. 因此调试态的读取路径**不得**被生产构建的死代码消除。
   这与既有「dev-only 诊断必须被 DCE 掉」方向相反,两者不得共用同一个开关。

### `DBG-4` 来源、时机与不可篡改

1. 必须支持两个来源:**打包时**注入与**运行启动时**注入;两者并存时的优先级须明确定义。
2. **默认必须是关。** 开启只能是打包或启动时的显式动作。
3. **应用自身不得提供任何改变该标记的路径**:无界面开关,不写入自己的持久化,
   不接受来自业务状态或远端的翻转。否则它就成了攻击面。

### `DBG-5` 可观测

调试态必须出现在启动诊断中,使「这台机器当前处于调试态」可被发现。

### `DBG-6` 第一个消费者:admin 登录口令提示

1. 调试态开启时,admin console 登录页显示**当前有效的管理口令**。
2. 调试态关闭时,该提示**不得存在于渲染树中**,而非渲染后隐藏。
3. 与 `ID-2.3` 一致:标识不可得而口令为 `123456` 时,提示显示的就是 `123456`。
4. 该提示只上屏,**不进日志**,与 `AC-2.6` 一致。


---

## 6. 输入需求:系统键盘退役

### `IN-1` 范围

1. 所有输入统一走虚拟键盘,不保留系统键盘;接受不做中文。
2. 原先声明为系统键盘的字段改用虚拟键盘既有布局。
3. `KeyboardKind` 与 `owner` 的 `'system'` 分支**整体删除**。
   若删净后该类型只剩单成员且无信息量,**应连同类型一并删除**,不得为兼容而保留空壳
   (与「不为向后兼容长期保留废弃方案」一致)。

### `IN-2` 连带删除与几何保持

删除范围:Android 侧 IME inset 的采集、上报与事件通道;render 侧按 scaleY 的 IME 折算;
input 侧基于 system owner 的视口收缩与焦点竞态处理。

**几何行为必须保持不变。** 已核实 Android 侧两处 IME 条件都只在 `imeVisible === true` 时改变行为,
因此「退役前后同一显示配置下测量一致」是恒真判据,不可用。
判据须改为对复用判据函数的**输入输出真值表**做退役前后的集合比对,可在 Kotlin 单测层判定。

### `IN-3` 必须保留并强制生效

1. 虚拟键盘同样收缩视口,`scroll-into-view` 与 `viewportAlreadyShrunk` 路径保留。
2. **系统软键盘的抑制必须是结构性的、不可撤销的**:
   从 `PrimitiveInput` 的公共 props 面移除 `showSoftInputOnFocus`,在 `vendor/slots.tsx` 内固定。
   已核实该 prop 今天是可选的,新增的输入类组件是最大破口;
   「逐个构造点都传了 false」是快照检查,挡不住下一个漏传的组件。

### `IN-4` 无原生控件字段的接入

口令字段**属于 `ui/base/input` 的字段模型**(Dexter 确认)。扩展既有模型使其接受无原生控件的字段,
说明此类字段如何取得 owner 与焦点;不得另起第二套键盘管线。
已核实虚拟键盘可见性是三个合取项,其中 `activeFieldId !== null` 依赖字段注册,而注册今天要求必填 `inputRef`。

---

## 7. primitives 补齐需求

### `PR-1` vendor 层纪律

1. `vendor/slots.tsx` 是唯一允许接触 RN 原生组件与第三方库的位置。
   **type-only 导入是例外**,已核实 `types/types.ts` 与 `PrimitiveButton.tsx` 今天就有;
   `react` 不计入第三方。
2. 本轮新增三个来源:虚拟化列表、忙碌指示、SVG。
3. 该纪律须写入包 README。

### `PR-2` 语义色板

1. 补 `ok` `warn` `error` `info` 四档,**每档三个位**(前景、背景、边框),共十二个具名 token,取值互异。
2. tone 是组件入参,不得在组件内部写死颜色。禁用面包括 Tailwind 内置色类**与内联 style 中的字面颜色**
   ——已核实 `PrimitiveButton` 已有内联 style 通道。

### `PR-3` 组件清单

**排版** `Text` `Heading` `Label` `CodeBlock`
**布局容器** `Container` `Card` `Divider` `Stack` `Grid` `Center`
**表单** `Button`(含 tone 与忙碌态)`Input` `CodeInput` `Checkbox` `Radio` `Switch` `Select` `Textarea` `FormField`
**反馈** `Spinner` `InlineAlert` `EmptyState` `Progress` `Skeleton`
**数据展示** `Badge` `KeyValueRow` `StatusRow` `List`(虚拟化)`Table` `Tabs` / `SegmentedControl`
**已有需改** `Status` 补 tone;`Actions` 与 `ScrollView` 保持

每件必须有:状态模型(至少 disabled 与 pressed;可交互件另加 busy)、
无障碍属性(角色、标签、状态)。可交互件的定义须在详设列明。

### `PR-4` 归属与清理

1. 判据:名字里必须带 Admin 才说得清的件,不属于 primitives。
2. `EmptyState` 上收进 primitives。**`DialogSurface` 不上收**——已核实它等于
   `Container layout="card"` 加 `Heading`,即 `PR-3` 已有的 `Card` 加 `Heading`,
   上收它会造出一个 `PR-3` 名单外、且与 `PR-7` 对话族禁令语义相邻的件。业务侧直接用 `Card` 组合。
3. 删除 `DialogActions` 与 `ScrollArea` 两个零逻辑别名;
   业务侧**所有**引用点解析到 primitives 或 input 的导出,不得就地内联复制。
   两份 `controls.tsx` 归零。
4. 表单滚动区归属 `ui/base/input`,不得把键盘行为并入 primitives。

### `PR-5` 形态分工

**平台与形态事实只能经显式 props 进入 primitives。** primitives 的任何文件不得读取宿主全局
或平台判定。`PrimitiveInput` 现有的 RNW 分支须迁入 `vendor/`,不得留在组件层。

### `PR-6` 图标

1. 新增 SVG 依赖,版本由 Expo 安装通道按 SDK 匹配选定,不手填。
2. 图标路径集自带于 primitives,不依赖系统符号或平台字体。
3. 图标集首批只做首批三节实际用到的。组件要完整,图标集按需长。

### `PR-7` 明确不做

`Modal` `AlertDialog` `Popover` `Tooltip` `Drawer` `Actionsheet` `BottomSheet` `Portal` `Toast`
——叠放归 `LayerStack`,不得出现第二套。
`DateTimePicker` `Calendar` `Slider` `Fab` `Avatar` `Image Viewer` `Link` `Accordion`
——两版 POC 均未使用,场景用不到。
任何依赖 native 系统 UI 的能力——所有形态在 APP 内闭环。

---

## 8. 契约与工程面变更

| ID | 变更 |
|---|---|
| `CT-1` | `UiCatalogEntry` 新增形态维度,必填非空;`UiCatalogContext` 新增同名字段(它今天恰是三个过滤维度的入参);连带 `definePart`、`createUiCatalog` 校验与十二处既有 `definePart` 调用 |
| `CT-2` | **恢复(Dexter 2026-09-11 裁定拉进本轮)。** render 的结构型 surface host snapshot 新增 `isHostPrimaryDisplay`,并经 `SurfaceContext` 透出;Android source 由**物理显示索引**给值,Web 预览 source 给出对应取值。连带修正集成层 host source 的选源:改按物理显示索引索引 `surfaceHostSources`,不再用 `displayMode`;画布仍按 `displayMode` 选,两条选择互不混用。第二版删除该契约的理由(单机下等价)已被盲审证伪 |
| `CT-3` | `KeyboardKind` 与 `owner` 的 `'system'` 分支删除;render 的结构型 snapshot 去掉 IME 字段;`ui/base/input` 的 invariants 同步 |
| `CT-4` | 建立 part 过滤的生产强制点:**准入拒绝为主、渲染回退兜底**,**现有三个维度一并纳入强制**。**当前形态值存入 state**,与 `instanceMode` 同形态(一台机器一个值、启动时确定);准入点从 state 读,`SurfaceContext` 由同一份 state 派生供渲染回退读。**不得出现第二个形态取值来源** |
| `CT-5` | `skeleton-graph.ts` 与各包 `package.json` 依赖边:admin-shell 补 `display-context` 与 `input`;业务包与集成层到 admin-shell 的边须定方向以避免环;`AC-5.7` 使 `sample-console` 到 admin-shell 的边成为真实存在的边。**admin-shell 的边随其实现落地,排在第 6 步** |
| `CT-6` | 各包 `terminal-invariants.json` 同步。**admin-shell 的 `test` 与 `publicExports` 随其实现落地,排在第 6 步**;primitives 与 input 的导出面同步(含已存在的 `publicExports` 漂移)排在第 2 步 |
| `CT-7` | 本批新建与修改的包补齐或更新中文 README,内容须含定位、作用、结构、用法(TR-10) |
| `CT-8` | device 端口 `getDeviceInfo` 由 unavailable 转 real,连带 adapter 的能力描述符、invariants,以及 `tools/terminal-readability/check-static.mjs` 中硬编码该能力为 unavailable 的期望值 |

---

## 9. 验收矩阵

档位:`static` 源码可判;`focused` 单测可判;`Web` dev-host 可判;`Android` 需模拟器。
本轮可用硬件为单机双屏模拟器;`mobile` 形态由 `sample-console` 承载,不需要手持设备。

**覆盖列写明该判据能证伪哪些需求条款。** 凡「范围陈述」类条款不需判据,在 `§9.2` 单独列出。
**红夹具列给出具体构造**,构造不出的条款在 `§9.3` 显式登记。

| ID | 覆盖 | 判据 | 档位 | 红夹具 |
|---|---|---|---|---|
| `A-1` | AC-1.5 | 同一组件在门禁真、假两种输入下渲染,断言 admin 手势 testID 节点**存在 / 不存在** | focused | 门禁判定移入回调,两棵树都有该节点 |
| `A-2` | AC-1.1、§3.2 | laptop 主屏手势连击打开 console;laptop 副屏同样连击不打开 | Android | 门禁改为恒真 |
| `A-3` | AC-1.2、AC-1.4 | 判据函数直接调用:**先断言四项默认常量等于需求写死的取值**,再验区域内外各一点、窗口内外各一次、以及三项覆盖参数生效 | focused | 默认区域尺寸改为全屏或次数改为 1 |
| `A-4` | AC-1.3 | scale 不为 1 的 surface 上,画布逻辑框内但宿主窗口框外的点**必须命中**,窗口框内但逻辑框外的点**必须不命中**。两点坐标在详设写死 | Android | 判据改用宿主窗口坐标 |
| `A-5` | AC-1.6 | 已有一个 dismissible 业务 layer 打开时,手势仍能打开 console | focused | 手势在有层时被抑制 |
| `A-6` | AC-2.4、AC-2.5 | 口令状态容器是**单一字符串字段**;口令 section 渲染树中原生文本输入控件数量不超过一个;该字段绑定的键盘布局是 `numeric` | focused + static | 改为六个原生输入框或六个独立状态 |
| `A-7` | AC-2.2 | 六位后不再接收;退格连续删至空;错误口令被拒;相邻小时被接受;**非相邻小时被拒** | focused | 接受任意小时窗 |
| `A-8` | AC-2.3、ID-2.4 | 时钟异常与口令错误给出**不同**提示;降级路径有可见标记且产生诊断记录 | focused | 两种失败共用同一提示 |
| `A-9` | AC-2.6 | 口令不出现在 logger 端口输出与原生 Log 调用中;静态上口令变量不流入任何日志参数 | static + focused | 把口令写进诊断日志 |
| `A-10` | AC-2.7 | 关闭 console 后重新打开,停在登录态而非已鉴权态 | focused | 鉴权状态被缓存 |
| `A-11` | AC-3.1 | 外壳渲染树的直接成员集合等于需求列举的五项 | focused | 外壳内混入一个 section 之外的业务件 |
| `A-12` | AC-3.3、AC-3.7 | section 上下文类型无导航成员;且从 section 内 dispatch 导航类 command **被拒绝** | static + focused | section 内 dispatch `showScreen` 成功切屏 |
| `A-13` | AC-0.1、AC-4.1 | **console 根节点测量尺寸等于画布声明尺寸**;外部点击不关闭;console part 的 `containerKeys` 为空且经 layer 选择路径出现 | Android + static | 只验 backdrop 满铺;或把 guard 改为 dismissible |
| `A-14` | AC-4.2 | console 打开期间,一次在途的业务 command 仍能 resolve | focused | 打开时卸载业务树 |
| `A-15` | AC-4.3、AC-4.4 | **先打开一个业务 layer,再打开 console**:业务字段不可聚焦,admin 字段可聚焦且虚拟键盘按键写入 admin 字段,业务字段值不变;关闭后业务焦点可恢复 | focused | admin 层落在既有焦点挂起边界之内 |
| `A-16` | AC-4.5 | console 与已选 section 的 partKey 不出现在任何持久化容器快照中 | focused | 已选 section 写入 content 容器 |
| `A-17` | AC-5.1 | admin-shell 源码不含任何 `ui/feature` 导入 | static | admin-shell 直接 import 一个 feature 屏幕 |
| `A-18` | AC-5.2、AC-0.2、AC-0.3 | **从 `UiCatalog` 中移除某 admin section 的 entry,该 section 在外壳导航中消失**;对象为 `AC-5.7` 的真实注入 section,不得另造夹具 | focused | console 读一份 catalog 之外的 section 数组 |
| `A-19` | AC-5.3、AC-5.4、AC-5.5 | 两次注册后先注册者仍在;section 顺序等于过滤后单一 `UiCatalog.entries` 的列表顺序;catalog 条目不可变且注册面源码无模块级可变绑定 | static + focused | 注册面改为模块级可变数组加整体替换;或出现第二份 section 列表;或过滤后顺序与 catalog 列表顺序不一致 |
| `A-20` | AC-5.6、CT-4、§3.1.7 | 一个声明为仅 `mobile` 的 section,在 laptop 形态下**经生产入口**不渲染,并产生可观测的拒绝信号 | focused | 强制点缺失或该 section 声明改为全开 |
| `A-21` | AC-6.2、AC-6.3 | 三节都在导航中可达;各自渲染其 kernel 包的真实读数 | focused | 某节渲染硬编码文案 |
| `A-22` | AC-6.4、AC-6.5 | **注入一个 capability 为 unavailable 的端口,该节对应行翻转**;呈现粒度为方法级,含 `state` 与 `source`;该节数据来自能力描述符而非硬编码,且非 DEV 构建下的来源与行为与详设声明一致 | focused | 渲染端口级二值表 |
| `A-23` | AC-6.1、§3.2.2 | 首批三节的渲染树中不存在任何 dispatch 写类 command 的路径 | static | 某节提供 instanceMode 切换控件 |
| `A-24` | ID-1.1、ID-1.2、ID-1.3、ID-1.4 | 标识跨应用重启与清除应用数据均不变;**Android 清单未因该能力新增任何运行时权限**;实现落在 `adapter/android/device`,未新建第二条端口,`DeviceInfo.deviceId` 走既有槽位 | Android + static | 标识改为每次启动生成 |
| `A-25` | ID-2.1 | 口令派生与校验是纯函数,入参为已解析的字符串;`DevicePort` 未被改成同步;assembly 启动期存在且仅存在一次 `getDeviceInfo` 解析 | static + focused | 在校验路径内直接调端口 |
| `A-26` | ID-2.3、ID-2.5 | 标识不可得时 console 可打开,`123456` 被接受;**标识可得时 `123456` 必须被拒**;Web 预览侧按不可得路径表现且降级标记可见 | focused + Web | 无条件接受 `123456` |
| `A-27` | IN-1.1、IN-1.2、IN-1.3、CT-3 | **全仓不存在 `keyboardKind: 'system'` 的字段声明**;`'system'` 分支在 input 包源码中不存在;render 的 snapshot 字段集合等于明确枚举;Android 原生模块中 IME 协调文件与类型**不存在**(文件级缺席,改名即红) | static | 把 IME 字段与文件改名保留 |
| `A-28` | IN-2 | 复用判据函数的输入输出真值表,退役前后集合相等 | focused | 删除 IME 条件时顺手放宽其他复用条件 |
| `A-29` | IN-3.2 | `showSoftInputOnFocus` 不在 primitives 公共导出面上;真机聚焦任意字段系统键盘不弹出 | static + Android | 把该 prop 重新暴露为可选 |
| `A-30` | IN-3.1 | scaleY 不为 1 且初始 offset 非零时,聚焦被遮挡字段后该字段底边与键盘顶边间距**不小于详设写死的阈值** | Android | 滚动 delta 改回混坐标系 |
| `A-31` | IN-4 | 无原生控件的口令字段能取得 owner 并接收按键;该路径不引入 input 包之外的键盘实现 | focused | 口令区自带独立键盘 |
| `A-32` | PR-1.1、PR-1.2、PR-4.4 | primitives 除 `vendor/` 外任何文件不得从 `react-native` 或第三方包做**值导入**(type-only 与 `react` 除外);`vendor/` 导出虚拟化列表、忙碌指示与 SVG 三个来源;**primitives 内不存在键盘避让或 scroll-into-view 逻辑** | static | 在组件层值导入 `FlatList` |
| `A-33` | PR-1.3、CT-7 | 本批新建与修改的包 README 含定位、作用、结构、用法四段;primitives README 含 vendor 纪律段 | static | README 为空或缺纪律段 |
| `A-34` | PR-2.1 | 色板含十二个具名状态 token,四档三位结构完整,取值互异 | static | 只加四个变量 |
| `A-35` | PR-2.2 | primitives 中颜色的唯一来源是色板 token:class 面的色名落在白名单内,**且内联 style 与字面颜色量为零** | static | 某组件用 Tailwind 内置色类或内联十六进制色 |
| `A-36` | PR-3 | 清单每一件:`disabled` 下 `onPress` 不触发;可交互件 `busy` 下 `onPress` 不触发且暴露忙碌无障碍状态;每个可交互件有角色与标签 | focused | 某件 disabled 仍触发,或缺角色标签 |
| `A-37` | PR-3 List | 长数据下渲染节点数不超过**详设写死的上界**;滚动到末尾最后一条可见且首批已被回收 | focused | 改为截断渲染前 N 条 |
| `A-38` | PR-4.2、PR-4.3 | 两份 `controls.tsx` 不存在;四个符号的**全部**原引用点解析到 base 包导出;业务包内无同名本地声明 | static | 删文件但就地内联复制 |
| `A-39` | PR-5 | primitives 内不存在非 props 来源的宿主全局或平台判定读取(含 `typeof window`、`typeof document`、`globalThis` 派生的尺寸或平台量、NativeWind 响应式前缀) | static | 在 vendor 导出一个宿主宽度探测函数供组件使用 |
| `A-40` | PR-6.2、PR-7 | SVG 在 Android 与 Web 两端渲染出非空图形;图标不引用系统符号或平台字体;primitives 中不存在绝对满铺加 z 序的叠放宿主,也不存在 `accessibilityViewIsModal` | Android + Web + static | 在 primitives 造一个 overlay 宿主 |
| `A-41` | §3.1.1、§3.1.2、§3.1.4、§3.1.5 | `sample-console` 能按两种画布组启动;`portrait` 组无 SECONDARY;形态取值与画布声明**同一来源**,形态计算面上不存在任何数值比较 | focused + static | 从画布宽度断点派生形态 |
| `A-42` | §3.1.6 | `sample-terminal` 的启动参数面含方向或形态,不是硬编码 | static | 方向写死在 App 内 |
| `A-43` | CT-1、§3.1.7 | 形态字段必填非空;十二处既有 `definePart` 全部显式给值,**且不得全部为全开**——至少存在按形态区分的实际声明 | static | 十二处全部填两个形态值 |
| `A-44` | §3.2.1、CT-2 | `isHostPrimaryDisplay` 的取值链路上不出现 `displayMode` 或 `instanceMode`;`SurfaceContext` 透出该布尔 | static | 由 `displayMode === 'PRIMARY'` 派生该布尔 |
| `A-45` | CT-5、CT-6、CT-8、PR-6.1 | 依赖图、各包 invariants 与实际导出面一致;`check-static.mjs` 的 device 能力期望与实际一致;SVG 依赖版本与 Expo SDK 匹配通道给出的版本一致 | static | 改 device 能力但不改静态门期望 |
| `A-46` | AC-3.2 | 外壳在 laptop 与 mobile 两种形态的画布下分别渲染,导航与全部外壳成员完整可见或可经既有滚动区到达;两种形态下外壳成员集合相同 | focused + Web | 外壳按固定横屏宽度布局,mobile 下溢出 |
| `A-47` | DBG-2.1、DBG-2.2、DBG-3.1、DBG-3.2、DBG-6.1、DBG-6.2、DBG-6.3 | 在 `environmentMode` 为 `PROD` 且非 dev bundle 的构建上开启调试态,口令提示出现;关闭调试态,提示**不在渲染树中**;标识不可得时提示显示的就是当前有效的降级口令 | Android | 把调试态做成 `EnvironmentMode` 取值或直接用 `__DEV__` |
| `A-48` | DBG-1.1、DBG-1.2、DBG-1.3 | 调试态在全仓只有一个取值来源,且不是 admin console 的参数;可被 assembly 之外的包读到,存在至少一个非 admin 的读取点 | static + focused | 只传进 ports 而不暴露,复刻 `environmentMode` 现状 |
| `A-49` | DBG-4.2、DBG-4.3 | 默认为关;应用内不存在任何改变该标记的写入路径 | static + focused | 增加一个界面开关或把标记写进持久化 |
| `A-50` | DBG-5 | 启动诊断中可见调试态取值 | focused | 诊断不含该字段 |
| `A-51` | DBG-6.4 | 调试态开启时口令上屏,但不出现在任何日志输出中 | focused | 把口令一并写进诊断日志 |
| `A-52` | CT-4 | 形态在全仓只有**一个**取值来源;`SurfaceContext` 暴露的形态与 state 中的值恒等 | static + focused | 在集成层另算一份形态传给 render |
| `A-53` | §3.2.2、§3.2.3 | 构造 `displayRole` 为 VICE 且 `instanceMode` 为 SLAVE 的单显示器状态:门禁仍判真,host snapshot 正常到达,surface 不停在 pending | focused | 选源改回按 `displayMode` 索引 |
| `A-54` | AC-3.3、AC-3.5 | 选中第二个 section 后,其内容呈现且第一个不再呈现;两次切换可来回 | focused | 导航只改高亮不换内容 |
| `A-55` | AC-3.4 | 关闭后 console 不在渲染树中,业务字段恢复可聚焦;再次打开停在登录态 | focused | 关闭只隐藏不卸载,或再次打开跳过登录 |
| `A-56` | AC-5.7 | 由 `sample-console` 注入的测试 section 出现在外壳导航中并可选中;**从 catalog 移除其 entry 后它消失** | focused | 框自带该 section 而非由集成层注入 |
| `A-57` | §3.3 | 脚本驱动 `displayRole` 变化使 `displayMode` 翻转:画布声明与 scale 随之改变,新画布下布局正确;切换前后 admin console、输入焦点与滚动位置的去留符合详设声明 | focused | 切换后仍用挂载时的画布 |
| `A-58` | AC-3A.1、AC-3A.2 | 几何未就绪时渲染明确的加载指示而非空白;就绪后加载态消失 | focused | 未就绪时返回空 View |
| `A-59` | AC-3A.4 | Web 预览的 PRIMARY surface `isHostPrimaryDisplay` 为真,SECONDARY 为假 | Web + focused | 两个 surface 取同一值 |

### 9.1 红夹具纪律

每条红夹具必须**先于实现写好并证明会红**。`A-2` `A-4` `A-13` `A-24` `A-29` `A-30` `A-40` 的 Android 半场
无法先于实现构造,其红夹具以 focused 或 static 半场先行,Android 半场作为回归。

### 9.2 不需要判据的条款

以下是范围陈述、威胁模型、详设交付义务或已由解析器结构保证的条款,不单独设判据:

`AC-2.1`(威胁模型是文档约束,不是可测行为)、
`AC-3.6`(UI 形态细节是详设交付义务,由详设评审把关)、
`AC-3A.3`(推理陈述:children 不渲染故不存在门禁处境)、
`AC-6.6`(次批范围声明)、
`ID-2.2`(落地位置写明属详设义务)、
`PR-4.1`(判据本身是分类原则)、
`PR-6.3`(首批图标按需的范围声明;与「不列逐件消费者」的张力已在 `§11.3` 第四层记录)、
`§3.1.3`(解析器已强制竖屏不得含副屏)、`§3.1.8`(沉淀方向声明)、
`DBG-4.1`(打包时与启动时的优先级定义属详设义务,**且必须作为详设准入项,不得略过**)。

本表在 Codex 第二轮 M-05 之后已收缩:原先停放在此的
`AC-0.1` `AC-6.5` `ID-1.1` `ID-1.2` `ID-2.5` `IN-1.1` `IN-1.2` `PR-6.1` `§3.3` `DBG-1.1` `DBG-1.2` `DBG-6.3`
十二条属行为义务,已分别并入 `A-13` `A-22` `A-24` `A-26` `A-27` `A-45` `A-47` `A-48` `A-57` 的判据内容与覆盖列,
**不是新增十二条测试,而是扩充既有判据的断言面**。

⚠️ **`§3.1.7`「所有 part 都参与过滤」不在此列**,它由 `A-20` 与 `A-43` 共同覆盖 —— 前者验过滤在生产入口生效,后者验十二处既有声明不得全部全开。

### 9.3 显式登记:无法构造红夹具的条款

| 条款 | 原因 | 处置 |
|---|---|---|
| `AC-4.5` 的「重启不恢复」 | console 是 layer 而 layer 不进持久化面,是结构保证,红夹具需把 console 建成 screen,而那是 `AC-0` 禁区 | 改由 `A-16` 判「已选 section 不落持久化」,该条可红 |
| `CT-7` 的「README 存在」 | 存在性无意义红夹具 | `A-33` 改判四段内容,内容缺失即红 |

---

## 10. 非目标

- 不做中文输入;不做 Toast;不做 `PR-7` 列出的组件。
- 不做双机。
- 本期 admin section 不做写操作。
- 不新增第二套叠放系统、第二套 part 注册表、第二套输入管线。
- 不为 `ui/feature` 的业务功能实现具体管理界面,本轮只建通道。

---

## 11. OPEN 与前置关系

### 11.1 需要 Dexter 裁决

**无。** 原 `Q-A` 至 `Q-I` 九项,以及 Codex 第二轮提出的动态画布归属与承载未就绪语义两项,已全部闭合。

后两项的裁定:动态画布切换本轮在范围内,验收档位为 focused 脚本驱动;承载未就绪是加载态而非门禁题,须给出明确加载指示。

本节留空是刻意的:需求正本交出时不应残留未决项。若详设阶段发现新的产品语义歧义,
按仓内规矩单列并向 Dexter 求证,不得自行默认。

### 11.2 OPEN

| ID | 内容 | 关闭条件 |
|---|---|---|
| `O-1` | `mobile` 形态在真实手持硬件上的表现 | 取得真机后补。**形态机制本轮必须验完**,由 `A-20` `A-41` 在 `sample-console` 上完成,不需要手持设备 |
| `O-2` | 自动化专用触发节点 | `ui/base/automation` 具备能力后补 |
| `O-3` | SVG 在 RNW 与 Presentation 内的实际表现 | 由 `A-40` 实测。POC-B 的既有运行经验可参考但不可替代实测 |
| `O-4` | 双机拓扑本身(主从通信、`transport` 实现) | 双机立项时处理。**选源修正与门禁判据来源已在本轮完成**,双机来时不必重做 |
| `O-5` | admin 写能力,及 `D-5` 的自救路径 | 写能力立项时一并处理,**先于任何写操作落地** |
| `O-6` | `portrait` 画布取值 360 × 800 的真机校准 | 取得真实手持机型后按其 dp 替换;本轮该值有明确依据,不是占位 |

### 11.3 前置关系与批内顺序

本批横跨六个不同 owner、不同证据档位的工作流。**范围作为一个产品批次成立,但不得以未分层的形态交付详设**;
下面按「语义先于契约、契约先于实现、基础件先于使用者」分层,并标出每层的 owner 包与验收 oracle。

**第一层 · 形态来源**

1. **画布声明补竖屏,`sample-console` 支持按画布组启动**(`§3.1`)。owner 是集成层。
   必须最先做:形态是后续 part 过滤的唯一来源,来源不稳定则 `A-41` `A-43` 都没有可比对的基准。

**第二层 · 契约(原子,内部不可并行)**

2. **系统键盘退役,含现有字段迁移**(`§6`)。owner 是 input 与 primitives。
   **必须是原子步**:`MemberForm` 的姓名字段、`useInputField` 的传参、`PrimitiveInput` 的可选 prop 在同一条 source graph 上,
   先删契约再迁字段会直接编译或行为破坏。**不得与第 3 步并行**——第二版曾把两者标为可并行,是错的。
3. **契约变更**(`CT-1` `CT-2` `CT-3` 的 render 侧、`CT-4` `CT-6` 的 primitives 与 input 部分)。
   owner 是 ui-state 与 render。其中两条内部顺序:
   `CT-2` 的选源修正与 `isHostPrimaryDisplay` 先落;
   `CT-4` 的强制点必须**先定义 layer 型 part 的选择语义**再接第一个消费者,否则 admin 层天生无法被枚举。

**第三层 · 能力**

4. **设备标识**(`§5`、`CT-8`)。owner 是 `adapter/android/device`。
   端口异步语义已定(不改 `DevicePort`,启动期 await 一次),该语义必须先于鉴权实现落笔;
   标识的实际解析可与第五层并行,但**不得先按同步假设写门禁或校验**。
5. **调试态**(`§5` 的 `DBG`)。owner 是 assembly 配置面。

**第四层 · 基础件**

6. **vendor 开口与 SVG 接入**(`PR-1` `PR-6`)。`O-3` 在此步验完再往上建件。
7. **色板扩档与组件补齐**(`PR-2` 至 `PR-5`)。色板必须先于组件。
   ⚠️ Dexter 已裁定 primitives 要全量补齐(不然每次做业务还要回来补基础包),
   因此**本轮刻意不要求逐件列出本轮消费者**。代价是部分件在本轮无真实使用者,
   其契约可能猜错;这是已知且被接受的取舍,不是遗漏。`A-36` 的行为与无障碍判据是对该风险的唯一兜底。

**第四层附加 · 承载态**

7A. **承载未就绪的加载态与动态画布切换**(`AC-3A`、`§3.3`)。owner 是 render。
    加载态依赖 `PR-3` 的 `Spinner`,故排在第 7 步之后;动态切换的脚本验收可与其同批。

**第五层 · 使用者**

8. **admin-shell 的框**(`AC-0` 至 `AC-5`、`CT-5` 与 `CT-6` 的 admin-shell 部分)。
9. **首批三节 kernel 界面加一节集成层注入 section**(`AC-6`、`AC-5.7`)。

### 11.4 焦点风险的前置探针(更正第二版的时间顺序错误)

第二版写「`A-15` 必须排在 admin-shell 之前先验」,**这是时间顺序错误**:`A-15` 要验的是
admin 自己的字段能否接收按键,而 admin-shell 那时还不存在。更正为两段:

- **前置探针,排在第 3 步**:渲染一个 `InputProvider`,打开任意一个带输入字段的 layer,
  验该字段能否聚焦并接收按键。这不需要 admin-shell,只需要一个最小 layer,
  却足以暴露「焦点挂起是 surface 级」这条会推翻设计的事实。探针为红即停,先解决焦点作用域再继续。
- **`A-15` 本身**:在第 8 步 admin-shell 与焦点作用域建立之后验。

### 11.5 证据档位纪律

Web、Android、release 档的证据只能在对应实现存在之后分别取得。
**不得以 static 或 focused 结果、欢迎语文本完整、历史交接记录或既往 review 的 GO,
扩写为完整视觉验收通过。** 每一步须有单独的 focused proof 与阶段对账,不得等到最后一次性验收。
