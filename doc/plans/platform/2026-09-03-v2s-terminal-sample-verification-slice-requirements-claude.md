# TER sample 验证切片 —— 正式需求文档

作者：Claude ｜ 日期：2026-09-04 ｜ 版本：**v13**

> **v13：按 Codex 对四份 v12 设计文档的复核结果修正需求。** 我给出 `GO`（M=1／S=2／N=1），
> 但**唯一的 M 与一条 S 打的都是我的需求，不是那四份设计**。
>
> **① M-1 —— §2.1c 让照抄的 POC 形态，与 TER 单 VM 裁定冲突，且我给的理由与事实相反。**
> 我曾写「本轮取独立 Activity 那条，因为 `launchDisplayId` 比 `Presentation` 自建
> `ReactInstanceManager` 更贴合『一个 VM 多个 Root Surface』」。逐条亲验后：
> ✅ `mixc-retail-rn84v2` 的 `AndroidManifest.xml` 第 35 行声明 **`android:process=":secondary"`**
> ⇒ 独立进程、独立 JS VM、独立 store；✅ `mixc-retail` 虽同进程，但 `MultiDisplayManager` 第 46 行
> **自建 `createSecondaryReactInstanceManager()`** ⇒ 仍是独立 React 实例。
> ✅ 而 TER 裁定原文明写「POC 的『副屏独立进程』整套跨进程广播协议**不搬**」。
> ⇒ **两个变体都不是可照抄的答案**。§2.1c 重写为「承载机制未决 ＋ 可定那半」：
> 新增 **D-6 / `OPEN-DUALSCREEN-SINGLE-VM-CARRIER`**（阻塞 CP-7 的 dual-screen 与 CP-8，
> 必须真机 spike 回答，**不得退回独立进程／独立实例形态**，做不到则停下交 Dexter）；
> 拉起时机、目标屏选取、幂等回滚、`initialProps`、同步注册、无 port 六项**与承载机制正交**，仍可定。
> 并给 **S-27 补第⑥项**：副屏与主屏**同属一个 JS VM／一个 store**（主屏 dispatch 后副屏读到同一 store 的新值），
> 这是该架构裁定的真机对应物。
> ⚠️ Codex 没有照抄，而是把 `android:process=:secondary` 标成可行性风险并写「停下」——纪律正确。
>
> **② S-1 —— `V12-DEP-1`：我五轮自审全漏的三处自相矛盾。**
> §2.3a 的 D-B 写「⇒ 直接加依赖」，而 §2.5.4 与 §6.8 写「不加 `display-context` 边、7 条依赖」。
> 成因是 Dexter 裁 D-B 时的前提（宿主要 await 查屏数）已被 v9 的 `initialProps` 机制作废，
> 我改了后两处却没同步 D-B 的结论行。v13 对齐：**立场不变，但本轮无需要它的理由，故不加边**。
> ⚠️ Codex 如实保留了这处相反表述、**未私自裁决**，并把 CP-8 阻塞在它收口之前。



> **v12 是自审四轮的产物**（Dexter：「你自己再 review 几轮 v11 吧，别到时候 codex 设计错」）。
> 找出并修掉**七处**，其中三处若不修 Codex 必然设计错：
>
> **① 三处「dual-screen 押到第三刀」的残留**（§5.1a 表格、§6.8、§11 末段）——
> v9 已把它拉进本轮，这三处没跟着改。⚠️ §6.8 的结论「只有端口表」**仍然成立**，
> 但理由要换：不是「dual-screen 押后」，而是**职责归属**（创建 surface 与传 `initialProps` 是 adapter 的活）。
>
> **② §2.5.4 预期边表里三个新增 adapter 完全缺行** —— 已补，并注明 adapter 只依赖
> `platform-ports` ＋ `contracts`（`kernel ← adapter`，方向合规），**不得依赖任何 `ui/*`**。
>
> **③ 两个宿主上业务 actor 读屏数的通路不同，此前从未写清** —— Android 走
> `adapter-android-device` 的真实 `getDisplayInfo`，Web 走外壳注入的 `DevicePort`；
> **业务侧代码两宿主完全相同**，不同的只是端口背后是谁。并写明 Web 段一致的前提是
> §6.7a 让**挂载棵数与注入端口读同一个状态**，否则会出现「挂了两棵树但业务以为单屏」的错位。
>
> **④ `dual-screen` 原先只有「要建单机双屏启动」一句话，写不出详设** —— 新增 §2.1c，
> 六项规格全部照 POC v1 亲验所得（独立 Activity ＋ 同一已注册组件 ＋ `launchDisplayId` ＋
> 幂等回滚 ＋ `initialProps` 两字段 ＋ 注册保持同步 ＋ **不需要任何 port**）；
> 并写明 POC v1 两个变体各走一条路。⚠️ **该结论已被 v13 推翻** —— 两个变体都达不到单 VM，见 §2.1c。
>
> **⑤ 三个新增 adapter 里两个没有任何判据** —— 建了却没人验，是另一种假绿。
> 新增 **S-27**（dual-screen 启动，五项含幂等与"注册仍同步"的源码断言）、
> **S-28**（device 真实屏数，⚠️ 与 S-27 **必须分别验** —— §2.1a 第 2 条的假绿正是两者只有其一时发生）、
> **S-29**（MMKV 落盘与五类值编码，`null` 与 `"null"` 可区分）。
>
> **⑥ S-25／P-14 缺红向量** —— 已补。
> **⑦ 「URL 参数注入 DevicePort」的旧措辞** —— §6.7a 已改成外壳状态，此处未同步，已修。
>
> ⚠️ **S-27／S-28 是真机段专属**：Web 上这些机制不存在，**第一段给不出任何前置证据**，
> 不得以「Web 段已验双屏内容分区」代证。



> **v11：新增 §6.7b —— surface 尺寸与排布由 integration 的 `package.json` 声明**（Dexter 2026-09-04 要求）。
> 我认为这不是开发便利而是**保真度**：POS 硬件的屏幕尺寸是固定的，拿浏览器响应式尺寸开发，
> 等于为一个永不 resize 的目标做响应式布局。⇒ 每个 `ui/integration` 包声明自己的目标硬件形态
> （`layout` 横向／纵向 ＋ **每个 displayMode 各自的**逻辑尺寸 —— 真实主屏与客显通常不同分辨率）。
> ✅ 可行性亲验：TER 已有自定义 `package.json` 字段先例（五个 adapter 各有 `jest`）；
> 骨架静态门只校验四个依赖字段、不枚举白名单 ⇒ 不触门。
> 「形状不变」的确切含义写死：**等比缩放适配视口不改变形状**，surface 内部布局仍按逻辑尺寸计算。
> 新增 **S-26**（含红向量：容器改 `flex: 1` 跟随视口必红）与 **P-14**（业务包尺寸字面量零命中）。
> 并指出这项声明让 IA／交互工件里「具体尺寸待裁决」的留白**现在可以收口**，
> 但「部件内部用 flex 还是绝对定位」仍是产品决策，本文不替 Dexter 裁。



> **v10：Dexter 一句提问，暴露出各版都没写清的一处，并补了一条零覆盖的核心判据。**
>
> 他问「在一个 web 页面可以显示双屏的内容么」。查下来发现 v2–v9 **从没说过 Web 段用哪种挂载结构**，
> 而两种结构里只有一种和 Android 一致（§5.1a）：结构甲是两棵**自带 `RenderProvider`** 的树并列，
> 与 Android 的两个 Root Surface 同形；结构乙是一个 Provider 里放两个 `SurfaceRoot`，
> **Android 上不存在这种形状**。⇒ 写死用甲。
>
> ⚠️ 而 ✅ 亲验 **render 现有测试恰恰只覆盖结构乙**，「两个独立 Provider 各自订阅同一 runtime、
> 互不干扰」——`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 的核心 ——**至今零验证**。
> ⇒ 新增 **S-24**，含红向量（把 Provider 的 `useMemo` 依赖改成常量使两实例共享 reader 必红）。
>
> 另新增 **§5.1b Web 段与真机段的验证边界表**：`Presentation`／`launchDisplayId`／`initialProps` 送达
> **只能在真机段验**，Web 段绿 ≠ 双屏通了。
>
> 并按 Dexter 要求新增 **§6.7a 形态切换开关**：外壳一个按钮动态切单屏／双屏，
> 注入的 `DevicePort` 与挂载棵数读同一个外壳状态、天然一致；业务侧**零改动零感知**
> （因为 actor 按约束 2 每次实时读、从不缓存）。⚠️ 明确它是**外壳的开发设施、不是产品能力**，
> 也**不是热插拔模拟器**（押后的热插拔指应用能运行时察觉插拔，本开关不需要察觉——外壳自己就是动手的人）；
> 不保证流程中途切换的正确性。新增 **S-25**（Web 段专属，不进真机复验清单）。



> **v9：Dexter 的四句话，纠掉了我三层错误。**
>
> **① 「该加依赖就加依赖，为什么卡那么死呀？」＋ 五条方向原则**
> （`kernel ← ui`／`kernel ← adapter`／`kernel ← assembly`／`ui ← assembly`／`adapter ← assembly`）
> ⇒ 我 v2–v7 的 §2.5「精确依赖白名单」用错了工具：把「我认为各包需要什么」列成表再宣布
> 「多一条即违反 `TR-12`」，于是每条合法新边都要开 OPEN 等裁决；而 `TR-12` 只管
> **kernel 不得知道 UI**，对 `ui → kernel` 一字未言。✅ 亲验现有 22 包对五类逆向依赖零违反。
> §2.5 整节替换为方向原则 ＋ 同层设计判断（J-1/J-2/J-3）＋ **说明性（非白名单）**预期边表；
> P-5 拆成 P-5a／P-5b／P-5c；P-10 收窄。**Codex 保留的两个 design OPEN 因此消解** ——
> 它们不是能力缺口，是我的白名单误判。
>
> **② 「之前不是让你参考 `_old_` 么，还没有答案么」**
> ⇒ 我把 POC v1 早就解决的问题当成待裁决项报了上去。✅ 亲验 `LaunchOptionsFactory` 在 **Kotlin 侧同步**
> `putInt("displayCount", …)` ＋ `putInt("displayIndex", …)`，主屏传 0、副屏传 1，两者挂同一已注册组件，
> `AppRegistry.registerComponent` **始终同步**。⇒ §5.1 约束 3 整条重写：
> **屏身份与屏数经 `initialProps` 送达，JS 侧不查设备、不决定挂几棵树**，与
> `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 原话「Kotlin 按屏传不同 `initialProps`」一致。
> v7 那套「宿主 await 查屏数再决定挂几棵」是**我自造的协议**，第三个 OPEN 与 D-5 随之作废。
>
> **③ 「dual-screen 要承载单机双屏启动的能力，你忘了么」＋「先不管 localwebserver」**
> ⇒ 该能力归 `adapter/android/dual-screen`（✅ 亲验这句是我自己写在它 README 里的），本轮建
> **单机双屏启动**那半，localWebServer 押后。
>
> **④ 「该有的基础设施都要有，不然在 sample 里面各种凑合」**
> ⇒ 我据此逐项扫「本轮会凑合什么」，扫出**三处，其中两处会假绿**（§2.1a）：`dual-screen` 不建则双屏
> 真实机制一次未验；`device` 用 unavailable 则业务分支**永远**降级单屏、判据照样全绿；
> `persistKv` 用内存态则 **S-12 不可能真通过**。⇒ 包清单 6 → **9**，三个 adapter 转为实建；
> `persist-kv` 用 **Kotlin 侧原生 MMKV**（POC v2 形态，§2.1b）；§11 分刀重划，
> 真机从「第三刀」移为本刀**第二段验证环境**，并按 Dexter 同意的
> **「Web 全绿之后才上真机」**排执行顺序（§11.1）。
>
> **v8**：§2.5 方向原则首次替换白名单。**v7**：按 Codex round 4（M=1／S=4）修复计数与措辞。
> **v6**：按 round 3（M=5／S=4／N=1）修复。**v5**：W-7 的 slice 方案被一问击穿，改为三个纯导出。
> **v4**：按 round 2（M=7／S=7）修复。**v3**：按 round 1（M=7／S=11／N=4）修复。
> **v2**：`ui/feature` 拥有自有 module 与 actor。

| 项 | 值 |
| --- | --- |
| 文档性质 | **正式需求**。设计与实施须以本文为准；与分析稿冲突时以本文为准 |
| 前置分析稿 | `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-analysis-claude.md`（第五版，含推导过程与被否方案） |
| 授权边界 | 本文**不授权实施**。Codex 应先出 IA/详设与实施计划，经 Dexter 与 Claude review 后另行授权 |
| 规范正本 | `doc/platform/terminal-coding-standard.md`（**全部 `TR-` 硬规则，含本轮新增的 `TR-12`；条数只增不改，此处不固定数量**）· `project-memory/decisions/terminal-architecture-and-stack-rulings.md` |
| 本轮宿主 | **仅 Android**。Expo Web 仅作开发与测试宿主，非产品形态 |

---

## 1. 目的与判定标准

### 1.1 目的

TER 已建成 7 个包并各自通过评审：`contracts` `platform-ports` `state` `runtime`
`display-context` `ui-state` `render`。**但它们从未被组装到一起运行过。**

✅ 亲验（穷举检索，零重叠）：`createUiStateModule` 只出现在 `ui-state` 自己的 9 个文件里；
`RenderProvider` 只出现在 `render` 自己的 10 个文件里；仓内**没有任何文件**把
真实 runtime ＋ 真实 ui-state module ＋ render 放在一起。

而 `render` 的 21 条用例全部依赖**手搓的 state root**。该形状是对真实 root 的猜测：
若真实 root 的键或层级与之不符，render 会永远显示 `container-empty`，而那 21 条用例**照样全绿**。

**做 sample 不是目的。** 目的是拿真实旅途压 TER，回答三个问题：

1. 框架**完整**吗 —— 该有的位置有没有？
2. **简单健壮**吗？
3. 它**加速**业务开发，还是让业务开发更麻烦？

⇒ 本轮的预期产出**包含对 TER 的修改**（§5），发现缺口是成果而非意外。

### 1.2 判定标准

| # | 标准 | 判定方式 |
| --- | --- | --- |
| G-1 | 真实 root 可被 render 读出（§1.1 的头号风险消除） | S-11 |
| G-2 | **一个 `kernel/feature` 可组合多套 `ui/feature`，供不同 integration 使用** —— Dexter 2026-09-03：**「这是整个 TER 的灵魂」** | P-10 结构判据 ＋ 结构 review |
| G-3 | 设计模式无一处为凑覆盖率让路 | §9.3 全部 P 判据 ＋ P-7 的逐条书面 review |
| G-4 | §5 **四项** TER 优化落地且可证伪（W-7／W-8／W-9／W-11） | S-16 · S-17 · S-19 · S-20 · S-21 |

### 1.3 范围过滤原则（Dexter 2026-09-03 裁定）

> **明确该有的能力，如果不满足要优化；明确还没建的功能先放下。**

---

## 2. 范围

### 2.1 包清单

> ⚠️ **v8 扩容:6 → 9 个包。** 起因是 Dexter 2026-09-04 的裁定:
> 「**支持 sample 运行，该有的基础设施都要有，不然在 sample 里面各种凑合，完全破坏了设计初衷**」。
> 我据此逐项扫过"本轮会凑合什么"，扫出**三处**(见下方 ⚠️)，其中两处会导致**假绿**。

| 层 | 包 | 动作 | 本轮范围 |
| --- | --- | --- | --- |
| `kernel/feature` | `sample-staff-session` | 新建 | 全部 |
| `kernel/feature` | `sample-member-registry` | 新建 | 全部 |
| `ui/feature` | `sample-staff-auth` | 新建 | 全部 |
| `ui/feature` | `sample-member-desk` | 新建 | 全部 |
| `ui/integration` | `sample-console` | 由 `platform-console` **改名** | 全部 ＋ `test-expo` 外壳 |
| `assembly/android` | `sample-terminal` | 由 `pos-desktop` **改名** | 端口表 ＋ Kotlin 侧接 `dual-screen` |
| **`adapter/android`** | **`dual-screen`** | **建（部分）** | **单机双屏启动**：副屏 Activity／`Presentation` ＋ `launchDisplayId` 拉起 ＋ 按屏传 `initialProps`。⚠️ **localWebServer 押后**（Dexter 2026-09-04：「可以先不管 localwebserver，后面再建」） |
| **`adapter/android`** | **`device`** | **建（部分）** | 至少 `getDisplayInfo`；其余方法可留 unavailable |
| **`adapter/android`** | **`persist-kv`** | **建** | **Kotlin 侧原生 MMKV**（`com.tencent.mmkv.MMKV`）经 expo-module 实现 `StateStoragePort`（Dexter 2026-09-04 裁定） |
| `kernel/base` | `display-context` | **修改**（§5.1） | 三个导出 |
| `kernel/base` | `ui-state` | **不修改** | §5.2 改为注入形态后本包零改动 |

骨架 22 → 26 个包（新建 4 个 sample 包，改名 2 个；3 个 adapter 骨架转为实建）。

#### 2.1a 三处"本轮会凑合"的扫描结果

| # | 原计划 | 为什么是凑合 | 后果 |
| --- | --- | --- | --- |
| 1 | `dual-screen` 押到第三刀，本轮双屏只在 Expo Web 用**结构乙**（一个 Provider ＋ 两个 `SurfaceRoot`，见 §5.1a）验 | ✅ 亲验该 adapter 的 README 由我自己写明「**创建/销毁 `Presentation`、挂载/卸载 RN surface**」是它的职责。不建它，双屏的**真实机制**一次都没被验过 | 范本教错写法（Dexter：真实业务包要能完全参照 sample） |
| 2 | `device` 用 `unavailableDevicePort` | 业务 actor 的场景 6 分支靠 `readDisplayInfo`。端口 unavailable ⇒ `?? 1` **降级单屏** ⇒ actor **永远** `showScreen(PRIMARY, confirm)` | **假绿**：dual-screen 把副屏拉起来了、`initialProps` 也送到了，业务却永不往副屏发内容，而所有判据照样绿 |
| 3 | `persistKv` 用 `createProcessMemoryStateStoragePort()` | ✅ 亲验它就是 `new Map<string, string>()`，**进程内**。而 S-12 要求「**重启后** `members` 与 `operator-name` 仍在」 | **S-12 不可能真通过**：要么红，要么被悄悄弱化成「同进程内重建 runtime」——那已不是持久化验证 |

#### 2.1c `dual-screen` 单机双屏启动：**承载机制未决**，只有周边形态可定

> ⚠️ **v13 重写。** v11–v12 写的是「照 POC v1 的形态，不发明新机制……**本轮取独立 Activity 那条**，
> 因为 `launchDisplayId` 的语义比 `Presentation` 自建 `ReactInstanceManager` 更贴合『一个 VM 多个
> Root Surface』」。**那条理由与事实相反，两个 POC 变体都达不到单 VM。**

##### 反证（Codex round-3 复核提出风险，我逐条亲验）

| POC v1 变体 | 承载 | 亲验结果 |
| --- | --- | --- |
| `mixc-retail-rn84v2` | `SecondaryActivity` ＋ `SecondaryDisplayLauncher` | ✅ 其 `AndroidManifest.xml` 第 35 行声明 **`android:process=":secondary"`** ⇒ **独立进程、独立 JS VM、独立 store** |
| `mixc-retail` | `SecondaryDisplayPresentation` ＋ `MultiDisplayManager` | ✅ manifest 无 `android:process`，但 `MultiDisplayManager` 第 46 行 **自建 `createSecondaryReactInstanceManager()`** ⇒ 同进程但仍是**独立 React 实例** |

✅ 而 TER 裁定原文明写：「POC 的『**副屏独立进程**』整套跨进程广播协议**不搬**」。

⇒ **两个变体都不是可照抄的答案**，且我给的「Activity 更贴合单 VM」是**事实相反的理由**。

##### 因此本节分成两半

**未决那半（`OPEN-DUALSCREEN-SINGLE-VM-CARRIER`）**：
单 VM 多 Root Surface 在 **Expo SDK 57 ／ RN 0.86.3** 下**具体如何承载**，仓内**零证据**。
候选包括但不限于：同进程 `Presentation` ＋ **复用同一 `ReactHost`／`ReactSurface`**（不自建实例）、
或 RN 新架构下的多 `ReactSurface` 挂载。

⚠️ **裁前不得动手**：CP-7 的 `dual-screen` 部分与 CP-8 的 native 接线均阻塞于本项。
⚠️ **必须由一次真机 spike 回答**，不得由文档推断，也**不得退回 POC 的独立进程/独立实例形态** ——
那会直接违反 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`。
⚠️ 若 spike 结论是「当前版本组合下做不到单 VM」，**停下交 Dexter**，不得自行降级为双 VM 并继续。

**可定那半（与承载机制无关，照 POC v1 亲验所得）**：

| 件 | 规格 |
| --- | --- |
| 何时拉起 | 主 Activity 的 `onCreate` 内调用启动器；`DisplayManager.displays.size < 2` **直接 return** |
| 目标屏选取 | 取 `displayId != DEFAULT_DISPLAY` 的那块 |
| 幂等与失败回滚 | 已有副屏实例则 return；启动失败**回滚「已请求」标记**，允许后续重试（POC v1 的 `launchRequested` 形态） |
| `initialProps` | 每个 surface **至少含** `displayIndex`（主屏 `0`、副屏 `1`）与 `displayCount`（`displayManager.displays.size`），**均在 Kotlin 侧同步读取** |
| 注册 | `registerRootComponent` / `AppRegistry.registerComponent` **保持同步、一行不改** |
| port | **不需要任何 port** —— 全程在 Kotlin 侧、JS 之前完成。⚠️ 不得为它扩 `AppControlPort` 或另开新 port |

⚠️ 上表的「拉起／幂等／`initialProps`／同步注册」四项**与承载机制正交** ——
无论最终用 `Presentation` 还是别的形态，这四条都成立，可以先写进详设。

⚠️ **本包的边界判据不变**（✅ 亲验其 README）：公共 TS 接口与 Kotlin 中不得出现
`displayMode`／`workspace`／`PRIMARY`／`SECONDARY`／`CHIEF`／`VICE`／`MASTER`／`SLAVE`／`BRANCH`／`MAIN`。
它只报「有几块屏、本屏是第几块」，**谁是主谁是从由 `display-context` 认定**。

⚠️ **S-27 因此要加一条**：副屏 surface 与主屏**同属一个 JS VM／一个 store** ——
可证伪形式：在主屏 dispatch 一条命令后，**副屏读到同一个 store 的新值**；
若两侧各自持有独立 store，该断言必红。这条是 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 的真机对应物。

#### 2.1b `persist-kv` 的形态：Kotlin 侧原生 MMKV

Dexter 2026-09-04 裁定 `adapter/android/persist-kv` **用 MMKV**。两版 POC 走的是相反的路，
本轮取 **POC v2 的形态**：

| | POC v1 | **POC v2（本轮采用）** |
| --- | --- | --- |
| MMKV 在哪 | JS 侧 `react-native-mmkv@^4.3.0` | **Kotlin 侧 `com.tencent.mmkv.MMKV`** |
| 桥接 | 无，JS 直接调 | 原生模块桥接 |
| 落点 | **assembly** 的 `src/foundations/stateStorage.ts` | **adapter** 的存储管理器 |

✅ 亲验 POC v2 的注释已写明改路的理由：「不再沿用 SharedPreferences，而是直接使用 Android 原生
MMKV……assembly 层只保留桥接，**不再直接依赖 JS 侧 `react-native-mmkv`**」。

⇒ 与 TER 骨架吻合：`persist-kv` 已经是 expo-module（带 `TerminalPersistKvModule.kt` ＋ gradle ＋
manifest），本就为 Kotlin 侧原生实现准备；而 POC v1 那种 JS 侧 MMKV 落在 assembly，
违反 §6.8「装配层只有端口表」。**本轮不新增 JS 侧 MMKV 依赖。**

⚠️ **值编码**：`StateStoragePort` 读写的是字符串，而 slice 值有 `null`／`boolean`／`number`／
`string`／对象五类。✅ 亲验 POC v1 用带版本的类型信封（`{v: 1, type, value}`）保住类型区分。
本轮须显式规定编码形态，**不得让 `null` 与字符串 `"null"` 不可区分** —— 那会让 S-12 的
「`passcode` 已消失」与「值为空串」混为一谈。

⚠️ **Web 段的持久化不在本条范围内**：`test-expo` 的端口表自行绑一个 Web 侧
`StateStoragePort`（与它绑 `DevicePort` 同理，属平台绑定层的正当职责）。
两段都是**真持久化**，故 S-12 在两段各自成立、都不是内存态假绿。

⚠️ 第 2、3 条的共同点是**它们会假绿** —— 判据全绿而能力其实没验到。这正是"凑合"最危险的形态。

### 2.2 明确不做（还没建的功能）

| 事项 | 原因 |
| --- | --- |
| 双机 pair 拓扑、命令按拓扑路由、`peer` target | peer 能力还没建。本轮 Android 单机形态下 surface 全在同一 VM 内 |
| `dual-screen` 的 **localWebServer** 半边 | Dexter 2026-09-04：「可以先不管 localwebserver，后面再建」。本轮只建**单机双屏启动**那半，见 §2.1 |
| 数据获取、加载态、重试约定 | 依赖 `transport`。会员数据本轮存本地 slice ＋ persist |
| `ui/base` 通用对话框归属 | 本轮只建最小 typed primitives，不建通用对话框语义；两个提示层仍各归各包 |
| 副屏热插拔 | `DevicePort` 无 display 订阅。⚠️ 本轮屏数在 Kotlin 侧启动时同步读取并经 `initialProps` 送达（§5.1 约束 3），**启动后不变**；热插拔要等 `subscribeDisplayStatus` |
| 浏览器自动化断言 | `ui/base/automation` 还没建 |
| `input` | 仍未建。本轮先由已建的 typed `primitives` 提供最小 RN 展示控件；输入领域行为仍归业务部件，`ui/base/input` 押后 |
| `workspace` 分区、`instanceMode`／`displayRole` 切换 | 第二刀 |
| ~~真机 Android 运行~~ | **v8 移出押后表**：本轮要建三个 adapter，押后真机等于押后它们，又回到「在 sample 里凑合」。真机改为本刀的**第二段验证环境**，见 §11.1 |

**4-C 差异登记（本轮已裁定）**：coding standard 的 4-C 目标形态包含 NativeWind 与 React Native
Reusables，但它们尚未安装，且会牵动 Expo、Metro 与 Tailwind 配置；本轮不引入它们，也不做视觉样式工作。
当前由 `ui/base/primitives` 提供带 TypeScript 类型的裸 React Native 控件，业务部件必须经这些控件用 JSX
构建，且每个控件强制拥有可寻址挂点。automation 后端仍押后，但挂点在 primitives 内是必经路径；将来第一次真实
视觉实现时再接 NativeWind、React Native Reusables 与 automation，不能要求业务包改写这条使用边界。

### 2.3 实施前置（**共 5 条：B-1…B-5**，必须先做，否则包建不起来）

| # | 前置 | 依据 |
| --- | --- | --- |
| B-1 | 仓根 `package.json` 的 `workspaces` **补两条**：`apps/terminal/kernel/feature/*` 与 `apps/terminal/ui/feature/*` | ✅ 亲验现有 workspaces 只列了 `kernel/base/*` `ui/base/*` `ui/integration/*` `adapter/android/*` `assembly/android/*` —— 两个 feature 层不在其中，新包不会被工作区识别 |
| **B-2** | **改名是一整套，须先枚举全部活动文件再动手。** 已确认命中：`tools/terminal-skeleton/check-static.mjs`／`check-static.test.mjs`／`verify.mjs`、`apps/terminal/skeleton-graph.ts`、两个待改名包的 `package.json`／`app.json`／`moduleName.ts`／`dependencies.ts`／`terminal-invariants.json`／`src/skeletonBootstrap.ts`，以及 `platform-console` 被 `pos-desktop` 引用的那条依赖边。⚠️ **实施前必须先产出完整台账**（全部活动 source／tool／test／config ＋ skeleton graph 的基数断言），**只排除历史文档与 evidence，禁止无边界全文替换** | Codex round-1 M-7 · round-2 S-1 |
| **B-3** | `sample-console` 需**从零接测试**：✅ 亲验 `platform-console/package.json` 当前**只有 typecheck 无 test**，`terminal-invariants.json` 是 `"test":{"kind":"ABSENT"}` —— 与它要承载 S-1…S-23 的 `REAL_TESTS` 直接冲突。须补 vitest 配置、test script、`owned.test` 改 `REAL_TESTS`/vitest | Codex review M-7 |
| B-4 | 三处公共面与不变量同步：`render` 现值 **21**（本批新增 `useDispatchCommand`、`useUiVariable`、`dispatchWithRequestId`、`useRequestInFlight`、`useTrackedRequest`；由原 16 经本批增量收口）；`display-context` 由 **17 → 20**（`readDisplayInfo` ＋ `DisplayInfoRead` ＋ `resolveSecondarySurfaceAvailable`；**无新增 slice／command**，§5.1）。⚠️ `ui-state` 公共面**不变**（M-1 修复后不再改它）。每个包的 `terminal-invariants.json` 的 `publicExports` 与各自静态门断言一并改；新增的五个 render 导出分别以“移除该导出”的 production mutation 配红向量，公共面改动不得只由意外新增导出覆盖 | Codex review S-9 |
| B-5 | 新建 `tools/terminal-layering/check-static.mjs` ＋ `check-static.test.mjs`，挂进 `tools/terminal-skeleton/verify-static.mjs`。**承载范围为 P-5a（方向）· P-5c（按 import 来源判定的能力边界）· P-5d（ui/feature 不得以字符串字面量调用 `createElement`）· P-10（kernel 侧 UI 字面量）** 四条机械门。P-5c 必须读 TypeScript AST 的 import 声明/类型 import：允许 UI feature 从 `runtime` 导入自有 `defineCommand` 与 `RuntimeModule`，禁止 state store 构造/句柄能力、`react-redux` 与 reducer/slice 构造；不得以文本黑名单表达该边界。P-5d 的红向量必须是真实 `createElement('...')` 用法，不能追加无调用字符串。⚠️ **P-5b 是同层 review、P-11 属 requestId 规则、P-12 含并发语义 review，一律不归此门** | Codex review S-4 ＋ Dexter 2026-09-04 方向原则 |

⚠️ B-5 **必须与 sample 包同批落地，不得先建空检查器** —— `kernel/feature` 目录当前为空，
扫空树必然空过，是假绿。

### 2.3a Dexter 裁决记录与仍待裁决项

#### 已裁决（2026-09-04）

| # | 事项 | 裁决 |
| --- | --- | --- |
| **D-A** | 部件与 render 拿不到 `createRequestId`／`StateJsonValue` | **该加依赖就加**。按 §2.5.1 方向原则，`kernel ← ui` 合规，**本来就不是违规、不需要裁决** —— 是 v7 的白名单把它判违规了。⇒ request helper 收口到 `render`，由 `render` 加 `contracts`；两个 `ui/feature` 只保留其实际使用的 `state`，不再直接声明 `contracts`；**配套补 P-5c 的 import capability 门** |
| **D-B** | `sample-terminal` 作为宿主拿不到屏数函数 | **立场**：装配层多知道一个 `display-context` 无所谓（Dexter 2026-09-04）。⚠️ **但本轮不加这条边** —— 该裁决的**前提**是「宿主要 await 查屏数」，而 v9 发现屏数经 `initialProps` 送达后该前提已作废（§5.1 约束 3）。⇒ 与 §2.5.4／§6.8 的「7 条依赖、不加 `display-context`」**一致**；`getSurfaceModes()` 方案同时撤销。⚠️ v12 此处曾写「⇒ 直接加依赖」，与 §2.5.4／§6.8 三处打架（Codex round-3 `V12-DEP-1`，`CONFIRMED`），v13 修正 |
| **D-架构** | §2.5 该不该是精确白名单 | **不该**。唯一原则是 §2.5.1 的五条方向；白名单已整节替换。⇒ **将来加合法依赖不必回来开 OPEN** |

#### 仍待裁决（不阻塞详设，可与实施并行）

| # | 事项 | 说明 |
| --- | --- | --- |
| **D-2** | `display-context/README.md` 第 49 行「不要在本包定义 runtime command」 | ✅ 亲验该包**已定义四条 command** ⇒ 字面即与实现不符。应改成「不得定义 runtime-owned command／不得绕过 `TR-11` 形态」，还是删除？**不得由实施者自行解释** |
| **D-3** | W-12：base module descriptor 是否由三个 base 包各自导出 | 见 §6.7。本轮已定为**先在 `sample-console` 内建一份并登记欠账**，此处只待认领长期归属 |
| **D-4** | display-context 正式需求第 320 行「只在 `setRuntimeInstanceMode`……」表述过窄 | 见 §5.1。**纯文档精确化，不影响 W-7 已定形态** |

#### 仍待裁决（**阻塞 CP-7 的 dual-screen 与 CP-8**）

| # | 事项 | 说明 |
| --- | --- | --- |
| **D-6** | `OPEN-DUALSCREEN-SINGLE-VM-CARRIER`：Expo 57 ／ RN 0.86.3 下，单 VM 多 Root Surface **具体如何承载** | 见 §2.1c。✅ 亲验两个 POC v1 变体**都达不到单 VM**（一个独立进程、一个自建 React 实例），而 TER 裁定明写「POC 的副屏独立进程整套不搬」。⇒ **仓内零证据**，必须一次真机 spike 回答，不得由文档推断。⚠️ 若结论是当前版本组合做不到，**停下交 Dexter**，不得自行降级为双 VM |

#### 已作废

| # | 事项 | 作废原因 |
| --- | --- | --- |
| ~~D-5~~ | 第一刀里 `sample-terminal` 的宿主 bootstrap 写不写 / Android pre-mount 异步接缝 | **前提是我自造的协议。** ✅ 亲验 POC v1：`registerRootComponent` **始终同步、一行未改**；副屏由 `SecondaryDisplayLauncher.startIfAvailable()` 在 `MainActivity.onCreate` 里用 `ActivityOptions.launchDisplayId` 拉起；屏数与本屏索引由 `LaunchOptionsFactory` 在 **Kotlin 侧同步**读取并经 `initialProps` 送达。⇒ **根本不需要推迟注册，也不需要 JS 侧异步查询** —— 见 §5.1 约束 3。该能力归 `adapter/android/dual-screen`（§2.1，本轮建） |

### 2.4 规范与记忆的落点（已完成）

本轮确立的层职责模式已写入正本，设计与实施**必须参照并遵守**：

| 载体 | 内容 |
| --- | --- |
| `doc/platform/terminal-coding-standard.md` | **新增 `TR-12`「一个 `kernel/feature` 必须能配多套 `ui/feature`」**，含反例、为什么、门、红夹具、负控制与反例栏 |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md` | 新增 assertion `TER_KERNEL_UI_FEATURE_ONE_TO_MANY`，条目正文**只有一句「见 `TR-12`」**，不复述任何规则内容（Codex review S-4，`CONFIRMED`：v5 曾在条目里复述了「1:N」「灵魂」等规则实质，与本文自己声称的「只放指针」矛盾，已按字面收紧） |
| 本文 §3.5 · §6.1 · §9.3 | 设计约束与可证伪判据 |
| B-5 的 layering 检查器 | 机械门（只承载 P-5a · P-5c · P-10） |

### 2.5 依赖方向（规范性 · Dexter 2026-09-04 裁定的架构原则）

> ⚠️ **本节在 v8 被整节重写。** v2–v7 写的是一张「精确白名单」，并宣布
> 「只允许下表列出的依赖，多一条即违反 `TR-12`」。**那是错的工具**：
> ① 它把「我认为各包需要什么」列成表再当成原则，于是每出现一条合法新边都要回来改文档、开 OPEN、等裁决；
> ② 它拿 `TR-12` 背书，而 `TR-12` 只管 **kernel/feature 不得知道 UI**，对 `ui → kernel` 一字未言。
> 两个原本被判「违规」的需求（部件要 `createRequestId`／`StateJsonValue`、装配层要读屏数）
> 按真实原则**本来就合规**。

#### 2.5.1 唯一的架构原则：五条允许方向

```
kernel  ←  ui
kernel  ←  adapter
kernel  ←  assembly
ui      ←  assembly
adapter ←  assembly
```

**逆向一律禁止**，共五类：

| 禁止 | 理由 |
| --- | --- |
| kernel → ui | kernel 不得知道 UI（`TR-12` 的依赖那半） |
| kernel → adapter | kernel 只认端口契约，不认平台实现 |
| kernel → assembly | 底层不得反向依赖组装 |
| **ui ↔ adapter** | 两者是同级平行层，互不依赖；UI 拿平台能力只能经 kernel 的端口注入 |
| ui / adapter → assembly | 同上，不得反向依赖组装 |

✅ 亲验：现有 22 个包对这五类逆向依赖**零违反**。

⇒ **只要方向合规，加依赖不需要裁决。** 本文不再维护「各包允许依赖」的白名单。

#### 2.5.2 `TR-12` 仍要单独守的那一半

方向原则覆盖了 `TR-12` 的依赖部分（kernel → ui 被禁）。**但字面量那半不在方向原则内**，仍需单独守：

> `kernel/feature/**` 生产源码中 `partKey` / `containerKey` / `displayMode` 字面量**零命中**。

这条是 P-10，独立于方向检查。

#### 2.5.3 同层内的耦合选择（本 sample 的设计判断，**不是原则**）

方向原则管不到同层内部。以下三条是**本轮的设计判断**，违反它们是设计问题而非架构违规，
**不得再表述为「违反 `TR-12`」**：

| 判断 | 内容 | 理由 |
| --- | --- | --- |
| J-1 | 两个 `ui/feature` 包**互不 import** | 兄弟 feature 包耦合会破坏包自治（V-8） |
| J-2 | 两个 `kernel/feature` 包**互不依赖** | 会员登记不需要知道会话包；协作走领域事件命令，不走依赖 |
| J-3 | 两个 `kernel/feature` 包**不依赖 `ui-state`** | 它们从不派 ui-state 命令 —— `showScreen`／`openLayer`／`clearUiVariables` **一律由 `ui/feature` 的 actor 派出**。这是 `TR-12` 约束 1 在依赖图上的体现：kernel 连「有哪些屏」这个概念都接触不到 |

#### 2.5.4 本轮各包实际会用到的边（**说明性，非白名单**）

下表只是**告知实施者预期形状**，便于对账；**出现表外但方向合规的边不构成违规**，
只需在交付里说明它为什么必要。

| 包 | 本轮预期依赖 | 为什么 |
| --- | --- | --- |
| `kernel/feature/sample-staff-session` | `contracts` · `state` · `runtime` | 见 J-2／J-3 |
| `kernel/feature/sample-member-registry` | `contracts` · `state` · `runtime` | 同上 |
| `ui/feature/sample-staff-auth` | `state` · `ui-state` · `render` · `runtime` · `sample-staff-session` · `ui.base.primitives` | `state` 只用于组装描述的 `StateJsonValue`；requestId 与 request helper 由 `render` 收口；本包不直接使用 `display-context`；业务部件经 typed primitives 渲染 |
| `ui/feature/sample-member-desk` | `state` · `ui-state` · `render` · `runtime` · `display-context` · `sample-member-registry` · `sample-staff-session` · `ui.base.primitives` | `state` 只用于组装描述的 `StateJsonValue`；屏数判断另需 `readDisplayInfo` 与 `resolveSecondarySurfaceAvailable`（§5.1）；request helper 由 `render` 收口；业务部件经 typed primitives 渲染 |
| `ui/base/render` | `contracts` · `platform-ports` · `runtime` · `state` · `ui-state` | request helper 使用 `createRequestId`/`RequestId`，Provider 与 helper 使用 `StateJsonValue` |
| `ui/integration/sample-console` | 四个 sample 包 ＋ `ui-state` · `render` · `runtime` · `display-context` · `platform-ports` · `contracts` | 组装全部依赖 |
| **`adapter/android/dual-screen`** | `platform-ports` ＋ `contracts` | 单机双屏启动那半**不需要任何 port**（✅ 亲验 POC v1：全程在 Kotlin 侧、JS 之前完成）；`platform-ports` 边留给押后的 localWebServer（`TopologyHostPort`）。⚠️ **不得依赖任何 `ui/*`**（方向原则：adapter 与 ui 是平行层，互不依赖） |
| **`adapter/android/device`** | `platform-ports` ＋ `contracts` | 实现 `DevicePort` 的 `getDisplayInfo` |
| **`adapter/android/persist-kv`** | `platform-ports` ＋ `contracts` | 实现 `StateStoragePort`；Kotlin 侧原生 MMKV（§2.1b） |
| `assembly/android/sample-terminal` | 5 个 adapter ＋ `platform-ports` ＋ `sample-console` | 只有端口表。⚠️ **不加 `display-context` 边**：屏数经 `initialProps` 送达、surface 创建归 `dual-screen` adapter（**本轮建**，§2.1），装配层不做屏数判断。**Dexter「装配层多知道一个 display-context 无所谓」的立场不变，但本轮已无需要它的理由** |

⚠️ **`state` 边开放后必须配套的门**（否则开了边没人管）：
两个 `ui/feature` 包与 `render` 的能力边界必须由 TypeScript AST 的 import 来源判定，不能再套文本黑名单。
UI feature 可以从 `kernel-base-runtime` 导入自有 `defineCommand` 与类型 `RuntimeModule`，这是 owner 的正当能力；
两个 UI 层包都不得从 `kernel-base-runtime` 导入完整 `Runtime` 或 `createRuntime`，不得从
`kernel-base-state` 导入 state store 构造或句柄类能力，不得导入任何 `react-redux`，不得导入
reducer/slice 构造函数（包括别名）；render 还不得导入 `defineCommand`／`RuntimeModule`。

⚠️ **`StateJsonValue` 允许、`StateRoot` 能力导入禁**：前者是 props 与 uiVariables 的类型契约，
UI 层可以命名它；后者是整棵状态树，必须按导入来源拒绝。此前的 `StateRoot` 文本门是无效机制：render 自身已有四处
`RuntimeStateRoot` 类型别名，改前缀即可绕过。新门应识别 `import type {StateRoot as 任意别名}`、
`import('...state').StateRoot` 与无限定符的 `typeof import('...state')`，而不是匹配某个本地拼写。
同理，完整 Runtime 的 import 别名或无限定符类型 import 也必须被 runtime 来源门拒绝。
`slices: []` 作为 RuntimeModule 描述字段不等于 slice 构造，不得误禁。

---

## 3. 设计模式（规范性，优先级最高）

> **不得为了凑覆盖率丢掉设计模式。** 凑出来的覆盖率是负资产。
> 本章与 §9.3 的判据**同等级于功能需求**，不可豁免。

### 3.1 MVC 映射

| MVC | TER 载体 | 谁可以写 |
| --- | --- | --- |
| **M**odel | 业务包自有 slice ＋ ui-state 的 content／variables | **只有 actor** |
| **V**iew | `definePart` 注册的 React 部件 | 只读；**永不写** |
| **C**ontroller | **command ＋ actor** | actor 是唯一写入点 |

### 3.2 两条唯一路径

**唯一写路径**（`TR-01`）：

```
command → actor → dispatchAction
```

标识符 `dispatchAction` / `store.dispatch` / `useDispatch`
**不得出现在 `features/actors/**` 之外的任何生产文件**。

**唯一事件路径**（`TR-11`，Dexter 2026-09-02 定为「本 TER 工程最重要的设计模式」）：

```
事件（外部端口／内部状态变化） → command → 关心它的业务方自己的 actor → dispatchAction
```

**`install` 不设例外**（`TR-01` 原文）：install **只 `dispatchCommand`**，
读 state 与写 state 一律在 actor 内完成。

### 3.3 View 绝不做决策

View 只做两件事：**读 selector** 与 **`dispatchCommand`**。
它**不判断**「现在该显示什么」—— 那是 actor 的事。

### 3.4 九种「为凑功能丢掉模式」的形态

| # | 违反形态 | 后果 | 判定 |
| --- | --- | --- | --- |
| V-1 | 部件里出现 `dispatchAction` / `store.dispatch` / `useDispatch` | 违反 `TR-01` | ✅ P-1 |
| V-2 | 把 dispatch 藏进改名的包装函数再跨文件传递 | 绕过禁止句 | ❌ P-7 |
| V-3 | **部件自己判断该渲染哪个屏** | View 变 Controller | ❌ P-7 |
| V-4 | **表单值**存组件 `useState`，绕过 uiVariables | 场景 8 直接失效；POC v2 老毛病 | ❌ P-7 ＋ S-8。⚠️ 不可机械判定 —— 瞬时句柄（requestId）用 `useState` 是正当的，禁止句区分不了两者 |
| V-5 | 业务状态（`pendingMember`）塞进 uiVariables | Model 分层错位 | ❌ P-7 |
| V-6 | selector 里写业务决策 | Controller 漏进 Model 读侧 | ❌ P-7 |
| V-7 | **integration 里写业务逻辑** | 业务语义泄漏到编排层 | ❌ P-7 |
| V-8 | 两个 `ui/feature` 包互相 import | 破坏包自治 | ❌ P-5b（同层耦合属设计判断 J-1，非方向违规，故归 review 而非机械门） |
| V-9 | 事件桥缺**播种／去重** | `TR-11` 明载：每次启动翻转一次屏身份 | ⚠️ **本轮不适用**（无事件桥，见 P-6）；规则仍有效 |

⚠️ **九条中本轮仅两条可机械判定**（V-1／V-8）—— V-9 的对象（事件桥）本轮不存在。其余**六条**属 `TR-11` 所称
`UNENFORCEABLE_BY_MACHINE`，实施评审**必须逐条书面回答**（P-7），不得以「门全绿」替代。
⚠️ V-4 曾被 v2 列为可机械判定，实为误判：禁止句区分不了「表单值存 `useState`」与
「requestId 瞬时句柄存 `useState`」，后者是正当的（§6.2 ③）。

### 3.5 一对多复用：TER 的灵魂（规范性）

> **一个 login 的 kernel，可以组合不同 login 的 UI，给不同的 integration 包使用，
> 满足用户不同的交互场景。**（Dexter 2026-09-03）

这是 `kernel/feature` ÷ `ui/feature` 分层**唯一的存在理由**，不是分层洁癖：

| 件 | 复用形态 |
| --- | --- |
| `kernel/feature/<domain>` | **一份**。与后台交互、校验、状态、存储 |
| `ui/feature/<domain>-*` | **多份**。POS 的登录界面、KDS 的登录界面、自助机的登录界面…… |
| `ui/integration/*` | 各自挑选组合 |

**由此推出三条硬约束**：

1. **`kernel/feature` 对 UI 形态零假设** —— 源码中不得出现任何 `partKey`／`containerKey`／
   `displayMode` 字面量，不得依赖任何 `ui/*` 包。一旦出现，这个 kernel 就绑死了一种 UI，灵魂即失；
2. **领域事件命令是 kernel 对外的公开契约面** —— `loginFailedCommand` 之类是**给所有 UI 用的**，
   不是给某一套 UI 用的。因此按结果拆成独立命令、payload 只含业务事实，不含呈现意图；
3. **「失败了该怎么呈现」属 `ui/feature`** —— 每种交互场景答案不同，
   所以 `ui/feature` **必须**有自己的 module 与 actor（§6.1）。

### 3.6 并发约束（本轮硬约束）

✅ 亲验 `createCommandDispatcher.ts` 第 527 行：
`await Promise.all(handlers.map(handler => dispatchActor(...)))`
—— **同一条命令的多个 handler 并行执行**。

⇒ **禁止出现「两个模块的 actor 监听同一命令，其中一方读取另一方本次写入的 slice」的形态。**
有先后依赖时必须走**因果链**：写入方写完后派出新命令，关心方监听那条新命令。
「一命令多 actor」只可用于**互斥动作**。

---

## 4. 用户旅途与场景

### 4.1 旅途：门店会员登记

**角色**：店员（主屏）· 顾客（副屏）

**旅途**：店员登录 → 查看已登记会员 → 新增会员 → **顾客确认后才生效**

选它的理由：`需顾客确认` 是一次**跨 surface 的双向交互** —— 主屏发起、副屏决策、
状态在确认后才提交。这比「主屏操作、副屏展示」苛刻得多。

### 4.2 副屏语义（规范性）

`customer-welcome`（待机）＝ **没有进行中的登记**。
故顾客取消后副屏回**预览**而非待机（表单数据还在，流程未结束）。

### 4.3 双屏场景矩阵

| # | 时刻 | PRIMARY（店员） | SECONDARY（顾客） |
| --- | --- | --- | --- |
| 1 | 开机，未登录 | `staff-login` | `customer-welcome` |
| 2 | 工号或密码错 | `staff-login` ＋ `auth-notice`（alert 层） | `customer-welcome` |
| 3 | 登录成功 | `member-list` | `customer-welcome` |
| 4 | 点「新增会员」 | `member-form`（空） | `customer-member{mode:'preview'}` |
| 5 | 店员录入中 | `member-form`（有值） | 同上，**实时同步** |
| 6 | 点「提交」 | `member-list` ＋ `waiting-confirm`（standard 层） | `customer-member{mode:'confirm'}` |
| 7a | 顾客点「确认」 | `member-list`（含新会员） | `customer-welcome` |
| 7b | 顾客点「取消」 | `member-list` ＋ `waiting-confirm` ＋ `registry-notice`（alert 层） | `customer-member{mode:'preview'}` |
| 8 | 店员点「知道了」 | `member-form`（**数据仍在**） | 不变（preview） |
| 9 | 店员退出 | `staff-login` | `customer-welcome` |

⚠️ **loading 是部件内部呈现态，不进场景矩阵。** 派出 `loginCommand` / `submitMemberCommand`
等 `public` 命令后，发起部件按 §6.2 ④ 观察自己那条 request：未完成显示 `:loading` 并拒绝重复提交，
完成即去掉。**它不改变屏与层的构成**，故不在上表出现；判据见 S-23。

**场景 7b 保留 `waiting-confirm` 再叠 `registry-notice`**，使 standard 与 alert 两层同时在场 ——
alert 必须盖在上面店员才看得见。`layerTier` 排序由真实交互自然要求。

### 4.4 单屏场景矩阵

⚠️ **单屏时 §4.3 的 SECONDARY 整列不存在**（没有第二棵 surface 树被挂载），
不是「有副屏但隐藏」。

单屏与双屏的差异**只在三处**：

| # | 单屏 PRIMARY | 双屏 PRIMARY |
| --- | --- | --- |
| 6 | `customer-member{mode:'confirm'}` **占满整屏**，文案提示店员把设备转给顾客 | `member-list` ＋ `waiting-confirm` |
| 7b | `member-form` ＋ `registry-notice` | `member-list` ＋ `waiting-confirm` ＋ `registry-notice` |
| 8 | 关 `registry-notice` 即可（**无 `waiting-confirm` 可关**） | 关两层并 `showScreen(member-form)` |

其余场景（1／2／3／4／5／7a／9）PRIMARY **完全一致**。

⇒ **单屏下验不到 `layerTier` 排序**（同时只有一层）。S-7b 因此限定「双屏形态」。

**单屏与双屏共用同一个 `customer-member` 部件**，仅 `showScreen` 的目标 displayMode 不同
⇒ 该部件声明 `displayModes: ['PRIMARY','SECONDARY']`。
**分支只出现在 `sample-member-desk` 的 actor 内一处，部件内零分支**（与依赖表第 138 行禁止
kernel/feature 依赖 display-context、以及 P-9 一致，Codex review M-4，`CONFIRMED`——
v5 在此处误写成 `member-registry`，那是 kernel 包，不可能碰屏数判断）。

---

## 5. TER 优化项（五项修复：阻塞 2 ＋ 高 1 ＋ 中 1 ＋ 本轮必办 1；观察 1）

本轮共五项修复（W-11／W-8／W-9／W-7／W-10）＋ **一项观察**（W-12 见 §6.7）。
**它们是本切片的预期产出之一，不是意外**（§1.1）。
⚠️ 下列子节按**发现顺序**编号，严重度顺序以本表为准。

| # | 项 | 包 | 严重度 | 判据 |
| --- | --- | --- | --- | --- |
| **W-11** | 业务部件无法派发任何命令 | `render` | **阻塞** —— 不修则九个场景第一步即不可实现 | S-20 · P-13 |
| **W-8** | 业务部件无法读取 uiVariable | `render`（注入，`ui-state` **零改动**，见 §5.2） | **阻塞** —— 不修则场景 4／5／8 不可实现 | S-19 |
| **W-7** | 「有没有副屏」的三态处理与安全降级无正本，业务包会各自重写 | `display-context` | **中** —— 不修也能跑（业务自己 await 端口），但降级规则会分裂 | S-16 · S-17 · S-18 |
| **W-9** | `useUiStateSelector` 服务不了参数化 selector | `render` | **高** —— 观察 request 必然撞上 | S-21 |
| W-10 | 缺 request 与变量的 React 封装 | `render` | **本轮必办** —— 两个 feature 的实验副本已证实逐字重复，按 §5.5 收口到共享 owner | §5.5 |
| W-12 | base module descriptor 无正本提供方，已在 ui-state 三个测试文件各手抄一份 | — | **观察** —— 本轮 sample 内建一份，归属待裁（D-3） | §6.7 |

⚠️ **W-11 与 W-8 是阻塞级。** 这本身是结论：TER 当前**跑不起任何一个业务界面** ——
部件既发不出命令、也读不到界面变量。这不是本切片挑剔，是第一个真实消费者必然撞到的墙。
⚠️ W-7 在 v5 由「阻塞」降为「中」：✅ 亲验 actor 可自由 await 端口，业务包自己调 `getDisplayInfo` 就能跑通；缺的只是三态处理与降级规则的**正本**。

### 5.1 W-7 · 「有没有副屏」的求值位置（**v5 已推翻 v2–v4 的 slice 方案**）

> ⚠️ **v2–v4 的整个 slice 方案作废**（Dexter 2026-09-03 一问击穿）。
> 我曾断言「actor 只能读 state，而 `readDisplayInfo` 是异步的」——**这个前提是错的**。
> ✅ 亲验 display-context 自己的**四个 actor 全都 `await readDisplayInfo(context.platformPorts.device)`**
> （`powerStatusActor` 第 30 行、`switchInstanceModeActor` 第 33 行、
> `switchDisplayRoleActor` 第 63 行、`validateHydratedDisplayRoleActor` 第 25 行）。
> **actor 是 async 的，可以自由 await 端口。**
>
> 更要命的是：✅ 亲验 display-context **正式需求稿**第 504 行已明令
> 「**actor 在处理命令时实时调 `getDisplayInfo()`，不得由桥缓存后传入**」——
> 而我的 slice 方案正是「桥读一次 → 写 slice → 业务 actor 读 slice」，**就是被点名禁止的那个形态**。
>
> ⇒ 无 slice、无 command、无 actor、无 bridge。**当时登记的那条待裁决项随之取消**（§2.3a 已在 v8 重构为「已裁决／仍待裁决」两栏，旧 D-1 编号不再存在）。

**真实缺口只剩一条**：`sample-member-desk` 的 actor 要按「有没有副屏」分流，
但 ✅ 亲验 `readDisplayInfo` 与 `DisplayInfoRead` **都不在 display-context 的公共面上**
（该包现导出五个纯派生函数与一个 selector，无设备读取助手）。

⇒ 业务包只能自己调 `device.getDisplayInfo({timeoutMs})` 并**各自重写**
`valid`／`unavailable`／`malformed` 三态处理与 `?? 1` 安全降级。
每个业务包重写一遍降级规则 = 迟早不一致。

**修复（三个导出，零状态）**：

| 件 | 规格 |
| --- | --- |
| 新增导出 | `readDisplayInfo(device: DevicePort): Promise<DisplayInfoRead>` —— 既有 foundation 直接上公共面 |
| 新增导出 | `type DisplayInfoRead` —— 三态联合（`valid` ｜ `unavailable` ｜ `malformed`） |
| 新增导出 | `resolveSecondarySurfaceAvailable(info: DisplayInfoRead): boolean` —— **纯函数**，与既有 `resolveSurfaceDisplayMode`／`resolveWorkspace`／`resolvePowerRoleTarget` 并列放进 `displayDerivation.ts` |

**业务侧的标准写法**（与 display-context 自己四个 actor 完全同构）：

```
const info = await readDisplayInfo(context.platformPorts.device)
const hasSecondary = resolveSecondarySurfaceAvailable(info)
```

**三条约束**：

1. **`?? 1` 安全降级只写在 `resolveSecondarySurfaceAvailable` 这一处纯函数里**，
   可测、可变异。未知（`unavailable`／`malformed`）⇒ **单屏**。
   理由是第一性的：单屏流程在双屏设备上**仍可用**（确认页占满主屏）；
   双屏流程在单屏设备上**会卡死**（顾客无处可点）。
2. **每次处理命令时实时求值，不得缓存**（正式需求稿第 504 行原文）。
   ⇒ 场景 4 与场景 6 各读一次端口，这是被裁定的正确形态，不是浪费。
3. **屏身份与屏数经 `initialProps` 送达，不由 JS 侧异步查询**（v8 整条重写）。

   > ⚠️ **v2–v7 这一条是我自己发明的协议，POC v1 从没这么做过，TER 的裁定原文也不是这个。**
   > 我曾写「宿主必须在挂载任何 React 树之前 `await readDisplayInfo` 一次并
   > `resolveSecondarySurfaceAvailable` 一次，据此调一到两次 `createSurface`；两个宿主形态一样」，
   > 并为这个自造协议开了两个 design OPEN、还差点要求修订 owner 文档。

   ✅ 亲验 POC v1（`_old_`）：`LaunchOptionsFactory.create(context, displayIndex)` 在 **Kotlin 侧同步**
   `putInt("displayCount", displayManager.displays.size)` 与 `putInt("displayIndex", …)`；
   `MainActivity` 传 `0`、`SecondaryActivity` 传 `1`，两者挂**同一个已注册组件**；
   `AppRegistry.registerComponent` **保持同步**；`App` 从 `props.displayIndex` / `props.displayCount` 读。

   ✅ 与 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 原话一致：「**Kotlin 按屏传不同 `initialProps`**」。

   **⇒ 两个宿主形态本来就不同，不得强行统一**：

   | 宿主 | 谁创建 surface | 屏数／本屏索引从哪来 | 本轮状态 |
   | --- | --- | --- | --- |
   | Android | **`adapter/android/dual-screen`** —— ✅ 亲验其 README：「创建/销毁 `Presentation`、挂载/卸载 RN surface」是该 adapter 的职责 | Kotlin 查 `DisplayManager`，经 `initialProps` 送进每个 surface | **本轮建**（§2.1；只建单机双屏启动那半，localWebServer 押后）；在 §11.1 的**第二段**验 |
   | Expo Web | **Web 开发外壳**（它自己就是平台边界） | 外壳自身的 `surfaceMode` 状态（切换按钮，§6.7a） | **本轮第一段** |

   ⚠️ **两个宿主上，业务 actor 读屏数的通路也不同 —— 这一点此前从未写清**：

   | 宿主 | 宿主挂载决策的屏数来源 | **业务 actor 的屏数来源** |
   | --- | --- | --- |
   | Android | Kotlin 的 `DisplayManager` → `initialProps` | `readDisplayInfo(context.platformPorts.device)` → **`adapter-android-device` 的真实 `getDisplayInfo`** |
   | Expo Web | 外壳的 `surfaceMode` 状态 | 同一函数 → **外壳注入的 `DevicePort`，其返回值读同一个 `surfaceMode` 状态** |

   ⇒ **业务侧代码两个宿主完全相同**（都是 `readDisplayInfo` ＋ `resolveSecondarySurfaceAvailable`）；
   不同的只是端口背后是谁。⚠️ Web 段之所以一致，正是因为 §6.7a 让**挂载棵数与注入端口读同一个状态** ——
   若两者各读一处，就会出现「挂了两棵树但业务以为单屏」的错位。

   ⚠️ **Android 侧的 `initialProps` 与 `DevicePort` 是两条独立通路，本轮不要求它们互证**：
   前者供宿主挂载、后者供业务分支。二者若不一致（例如启动后屏幕被拔掉），
   属押后的热插拔语义（§2.2），本轮不处理。

   ⚠️ **`sample-terminal` 不做屏数判断、不写 bootstrap** —— 见 §6.8。
   ⚠️ **`registerRootComponent` 不需要推迟**，因此不存在「Android pre-mount 异步接缝」问题。
   v7 曾把它记为待裁决项 D-5，v8 **撤销**：屏数在 Kotlin 侧同步即得。

#### 5.1a 双屏的两种挂载结构，只有一种与 Android 一致

⚠️ **v9 补写：此前各版从未说清 Web 段用哪种结构。**

| 结构 | 形态 | 与 Android 一致？ |
| --- | --- | --- |
| **甲（本轮采用）** | 两棵**自带 `RenderProvider`** 的树并列 —— `assembly.createSurface('PRIMARY')` ＋ `createSurface('SECONDARY')` | ✅ 一致 |
| 乙 | **一个** `RenderProvider` 里放两个 `SurfaceRoot` | ❌ **Android 上不存在这种形状** |

Android 上是**两个 Root Surface**，各自独立 React root、各自的 Provider、各自收到自己的 `initialProps`。
⇒ 用结构乙验完就宣布双屏通了，范本会教出一个真机上不存在的形状。

⚠️ **现有 render 测试恰恰只覆盖结构乙** —— ✅ 亲验 `renderSurface.test.tsx` 是「一个 Provider ＋
两个 SurfaceRoot」，**零条两个 Provider 并存的用例**。而「两个独立 Provider 各自订阅同一 runtime、
互不干扰」正是 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 的核心，**至今零验证**。
⇒ 新增判据 **S-24**（§9.2）。

✅ 结构上可行：亲验 `RenderProvider` 的全部状态都在 `useMemo`／`useRef` 内
（每实例各一份 snapshot reader 与诊断 reporter），两个 Provider 并存无共享可变量。

⚠️ **一处必须澄清的差异**：结构甲在 Web 上仍是**一个 React root**
（`registerRootComponent` 只挂一个），两棵 surface 树作为兄弟放在其中；Android 上是**两个 Root Surface**。
**但这个差异只在宿主摆放，不在包的形状** —— 每棵树自带 Provider、可独立挂载，
树内代码两边完全相同。故不违反「范本不许有临时写法」。

#### 5.1b Web 段与真机段的验证边界

| 能力 | Web 段 | 真机段 |
| --- | --- | --- |
| `contentSets` 按 displayMode 正确分区 | ✅ | ✅ |
| 每个 Provider 只读自己那份 contentSet | ✅ | ✅ |
| **两个独立 Provider 共享同一 store／runtime** | ✅ **Web 段最有价值的一项** | ✅ |
| Kotlin 创建 `Presentation`／`launchDisplayId` 拉起副屏 | ❌ Web 上不存在 | ✅ **只能在此验** |
| 按屏传 `initialProps` 的送达 | ❌ | ✅ **只能在此验** |
| 真实 `getDisplayInfo` 返回 2 | ❌ 靠注入模拟 | ✅ |

⚠️ **Web 段绿 ≠ 双屏通了。** 后三行只能在真机段验（§11.1）。

4. **业务 actor 的分支仍走约束 1／2 的实时读取，与本条无关。**
   actor 拿不到 React props，故场景 4／6 仍各自
   `await readDisplayInfo(context.platformPorts.device)` ＋ `resolveSecondarySurfaceAvailable`。
   ⇒ **W-7 的三个导出不受本条影响**，变的只是宿主那一半。

**公共面变化**：`display-context` 由现有 **17 项 → 20 项**（两个函数 ＋ 一个类型）。✅ 现值取自该包 `terminal-invariants.json` 的 `publicExports` 实测长度，非估算；
`terminal-invariants.json` 与静态门同步，每项配红向量。
⚠️ **不新增 slice、不新增 command** ⇒ 与该包「`displayCount` 永不入 slice」的正式约束**在
本节的用法上不冲突**（Codex review S-1，`CONFIRMED`：v6 说「零冲突」过满，与紧接着承认的
D-4 范围缺口自相矛盾——下段就是那处需要 Dexter 顺手改准的表述缺口，不是「零」）。

⚠️ **但 owner 正式需求里有一句表述过窄，与本节用途及该文档自身后段的实践不一致**
（Codex review M-1，`CONFIRMED`）：✅ 亲验其第 320 行原文
「屏总数……**只在 `setRuntimeInstanceMode` 的准入判据里读一次**，永不入 slice、永不参与屏身份判定」——
字面上只授权了一个消费场景（角色切换准入），没有覆盖本节要的场景（决定挂几棵 surface）。

而 ✅ 该文档自己后段（第 504 行）与四个既有 actor 的实际写法，早已确立的是**「处理命令时实时读」**
这个更宽的模式，不限于 `setRuntimeInstanceMode` 一处。⇒ 第 320 行是该文档**先写窄了、后面用宽了**
留下的表述缺口，不是本节新引入的冲突——本节只是又一个符合「处理命令时实时读」既有模式的消费方。

**不阻塞本节实施**，但请 Dexter 顺手把第 320 行的「只在 `setRuntimeInstanceMode`……」
改成与第 504 行一致的「处理命令时实时读，不限定唯一消费点」，登记为 **D-4**（见 §2.3a）。

### 5.2 W-8 · 业务部件无法读取 uiVariable

**缺陷**：✅ 亲验 `selectUiVariable` **只存在于 `UiStateModule` 实例上**
（`createUiStateModule.ts` 第 92-104 行）。React 部件拿不到 module 实例，
读不到自己声明的界面变量，而 §4.3 场景 4／5／8 全部依赖它。

**⚠️ v2 提出的修复形态已被推翻（Codex review M-1，`CONFIRMED`）。**
v2 曾主张 `ui-state` 导出独立 `selectUiVariableValue(root, declaration)`，
以「`declaration.key` 是否存在于变量 state」等价保留注册校验。**该等价不成立**：

- ✅ 亲验 `variableSlices.ts` 第 99 行 `createInitialVariableState = () => ({values: {}})`
  —— 初始 `values` 是**空对象**。已注册但尚未写入的变量**没有 key**
  ⇒ 按 key 缺失判定会**误拒每一个仍是默认值的变量**（本 sample 四个变量开局全是默认值）；
- ✅ 亲验 `createUiStateModule.ts` 第 99-101 行：module 版比较的是 **registry 中的对象 identity**；
  ✅ 亲验 `variableRuntime.test.ts` 第 133-134 行：同 key、改 `defaultValue` 的 forged 声明
  **必须**抛 `/not registered/` ⇒ 按 key 存在判定会**放过 forged 声明**。

两个方向都错。⇒ **修复改为不动 `ui-state`，走与 W-11 相同的注入形态。**

| 件 | 规格 |
| --- | --- |
| `RenderProvider` props 新增 | `selectUiVariable: <TValue extends StateJsonValue>(root, declaration: UiVariableDeclaration<TValue>) => TValue` |
| 来源 | **integration 从它持有的 `UiStateModule` 实例上取**，与 `stateSource`／`dispatchCommand` 同一注入路径 |
| hook | render 导出 `useUiVariable(declaration)`，内部取 snapshot ＋ 调注入的 reader |
| `ui-state` 改动 | **零**。identity 校验仍由绑定的 module 完成，安全语义**一字不改** |

**为什么这个形态更对**：变量的注册事实**只有 module 知道**，把校验从 module 上剥离必然丢语义；
而 integration 本来就持有 module 实例。⇒ 注入比导出更小、更安全，且与 W-11 同构。

**公共面变化**：render 由 16 → **18**（`useDispatchCommand` ＋ `useUiVariable`）；本轮 W-10 收口再新增
`dispatchWithRequestId`、`useRequestInFlight`、`useTrackedRequest` 三项，最终由 16 → **21**；
`RenderProviderProps` 增两个字段；`ui-state` 公共面**不变**。

⚠️ **render 须新增 `state` 依赖**：本节的 props 签名
`selectUiVariable: <TValue extends StateJsonValue>(...)` **命名了 `StateJsonValue`**，
而 ✅ 亲验该符号在六个 base 包中**只有 `state` 导出**，render 现有依赖
（`platform-ports`／`runtime`／`ui-state`）都拿不到，ui-state 也未转出。
按 §2.5.1 这是 `kernel ← ui`，**方向合规、直接加**。
⚠️ render 静态门继续按 state import 来源禁 `StateRoot` 能力、**不禁 `StateJsonValue`**（§2.5.4 末段的区分），
并按 runtime import 来源禁完整 `Runtime`／`createRuntime`；它不再依赖本地类型别名拼写。

### 5.3 W-11 · 业务部件无法派发任何命令（**阻塞级**）

**缺陷**：✅ 亲验 `RenderProvider` 的 props 仅
`{stateSource, uiCatalog, rendererCatalog, logger, children}`，
`stateSource` 仅 `{getStatus, getState, subscribe}` —— **没有任何派发通路**。
✅ 亲验 render 的 `README.md` 第 15-17 行明写「**不暴露或调用 dispatch**，也不提供 command…接缝」。

⇒ **今天的 TER 里，业务部件点一个按钮都发不出命令。** 本文全部九个场景第一步即不可实现。

**但规范本身是允许的**：✅ 亲验 `terminal-coding-standard.md` 第 83 行 `TR-01` **负控制**原文 ——
> 「**任何位置的 `dispatchCommand` → 绿（发命令不是写 reducer）**」

⇒ render 的排除**比规范更严**。它当初拒绝的是「把完整 Runtime／store 交给 UI」，
而一个窄的 `dispatchCommand` 函数**不是 store，也不写 reducer**，与该理由不冲突。

**判定**：render 已建成、规范明确允许、真实场景第一步即撞上
⇒ **属「该有的能力」，优化 TER。**

**修复**：`RenderProvider` 的 props 增加一个**窄函数**，并由 render 出 hook：

| 件 | 规格 |
| --- | --- |
| props 新增 | `dispatchCommand: <TPayload>(command: CommandIntent<TPayload>, options: {requestId: RequestId}) => Promise<CommandDispatchResult>` |
| hook | `useDispatchCommand(): RenderProviderProps['dispatchCommand']`，经 `RenderContext` 取用 |
| 边界不变 | **仍然**不接收完整 `Runtime`、不使用 `getStore()`、不暴露 `dispatch`／`dispatchAction`。render 源码中 `getStore` / `dispatchAction` / `useDispatch` 仍须零命中 |

**公共面变化**：本项单独看是 16 → 17（新增 `useDispatchCommand`）；§5.2 同批后为 18，W-10 收口再加三项，
本批最终值是 **21**。17 与 18 都只是中间状态；`terminal-invariants.json`、静态门断言、README 与 B-4 一律按 **21** 落地，
全文不得将 17 或 18 写成终值。
`RenderProviderProps` 增字段；`terminal-invariants.json` 同步；
render 现有静态门中「render 公共面必须为 16」的断言须改为 **21**（本批终值，见上一段）。
render 的 `README.md` 第 15-17 行的边界表述须同步修正，
明确「不暴露 store 与 `dispatchAction`」而非「不暴露 dispatch」。

### 5.4 W-9 · `useUiStateSelector` 服务不了参数化 selector

**缺陷**：✅ 亲验 `useUiStateSelector.ts` 第 18 行
`if (cache.current?.root === snapshot.root) return cache.current.result`
—— **只按 root 引用缓存，不看 selector 身份**。

⇒ 观察 request 的唯一写法是参数化 selector：

```
useUiStateSelector(root => selectRequestExecutionView(root, requestId))
```

`requestId` 由闭包捕获。第二次登录时 `requestId` 由 id₁ 变为 id₂ 而 root 尚未变化的那一帧，
hook 返回 **id₁ 的视图**（状态可能是 `complete`）⇒ 新请求被误判为已完成，loading 不出现。

⚠️ 该风险我在 render DESIGN 评审时以 N 级提出，当时的处置是「把 selector 必须为 root 的纯函数
写进契约」；✅ 亲验 render 的 `README.md` 至今**未记载该契约**，且**第一个真实业务场景即撞上**。
⇒ 这不是文档问题，是该 hook 服务不了第一类真实用法。

**修复**：缓存键加入 selector 身份

```
if (cache.current?.root === root && cache.current.selector === selector) return cache.current.result
```

内联箭头每次渲染都是新引用 ⇒ 内联 selector 等同不缓存（每次重算，**正确**）；
模块级稳定 selector 仍命中缓存，保留结果引用稳定性。这与 react-redux 的取舍一致。

**公共面变化**：无（签名不变）。render 现有 `SELECTOR_CACHE` red vector 须相应更新。

### 5.5 W-10 · request 与变量的 React 封装（**本轮收口**）

✅ 亲验 POC v1 `2-ui/2.2-modules/mixc-user/src/hooks/useLogin.ts`：
`useRequestStatus(requestId)` 与 `useEditableUiVariable(decl) → {value, setValue}` 两个 hook 由核心包提供。

TER 的 selector 侧与 POC v1 **平级甚至更完整**（`selectRequestExecutionView` 已处理 peer ledger），
缺的只是 React 封装。实验已经完成：`sample-staff-auth/src/components/commandSupport.ts` 与
`sample-member-desk/src/components/commandSupport.ts` **逐字相同，均为 53 行**。这已实证重复封装会让业务开发更麻烦，
不能继续留在两个 feature 包内。

**本轮处置**：三个 request 能力统一上移到 `ui/base/render`：
`dispatchWithRequestId`、`useRequestInFlight`、`useTrackedRequest`。两个 `ui/feature` 删除各自的
`commandSupport.ts`，部件改从 render 使用；request 观察仍由 render 内部复用 `selectRequestExecutionView`，
不改 `ui-state`，不新增第三方依赖。

---

## 6. 包级需求

### 6.0 全包共同要求

| 项 | 要求 |
| --- | --- |
| README | **中文**，含定位／作用／结构／用法与迭代指引；示例须回源码核过（TR-10） |
| `terminal-invariants.json` | `publicExports` 为**精确集合**；`owned.test.kind` 为 `REAL_TESTS` / vitest |
| `moduleName` | 见 §8 命名约定 |
| 新增第三方依赖 | **口径按「是否新增到 lockfile」判定**（Codex review S-8）：`expo` · `expo-status-bar` · `react-dom` 已在仓内存在，加进 `sample-console` 的 devDependencies **只是新增依赖边、不新增安装包**，版本**必须与仓内既有解析结果一致，不得另钉**。⚠️ **真正新增到 lockfile 的只有 `react-native-web` 一个**，版本对齐 expo 57 的期望值。除此之外一律不得新增 |

### 6.1 层职责划分（规范性 · Dexter 2026-09-03 裁定）

| 层 | 管什么 | 是否有 module／actor | 是否知道 `partKey` |
| --- | --- | --- | --- |
| `kernel/feature` | 与后台的交互与判断、业务状态管理、用户信息存储 | **有** | **不知道** |
| `ui/feature` | 用户交互层：呈现、导航、提示 | **有** | 知道，且**只知道自己包的** |

**事件方向**：`kernel` 派出**领域事件命令**时不知道谁关心；`ui` 的 actor 监听领域事件，
决定呈现与导航。⇒ `partKey` 自始至终不离开拥有它的 `ui/feature` 包。

⚠️ v1 把全部 actor 塞在 `kernel/feature`，导致 kernel 包硬编码 ui 包的 `partKey` ——
ui 侧改名则 kernel 静默失效，无门可抓。本版修正。

### 6.2 UI 发起命令的标准形态（规范性）

```
① 部件调用 render 的 `dispatchWithRequestId`，由 render 使用 `createRequestId` 生成缺省 requestId，
   或把 `useTrackedRequest` 返回的本次交互 requestId 显式传入
② 部件通过 `useDispatchCommand()` 取得窄派发函数，再交给上述 helper       ← W-11 修复后可用
③ 部件可用 `useTrackedRequest` 持有 requestId（本次交互的瞬时句柄，允许组件 local state）
④ 部件通过 `useRequestInFlight` 观察 render 内部的 `selectRequestExecutionView(root, requestId)`
   status 未完成 → loading；完成 → 去 loading
⑤ 失败的业务后果由 kernel actor 派领域事件命令，ui actor 承接并决定呈现
```

⚠️ ✅ 亲验 `createCommandDispatcher.ts` 第 181 行
`if (requestId === null || observation === undefined) return`
—— **ledger 只记录带 requestId 的命令**。无 requestId 的 internal 命令（如现有 power bridge）
**不进 ledger**。⇒ `TR-11` 收益 ④「每次事件进 request ledger」是**有条件的**：
只有带 request 根的链路可观察。本文要求 §6.3 的 bootstrap 带 requestId，
正是为了让恢复链路可观察（Codex review N-1）。

⚠️ ✅ 亲验 `createCommandDispatcher.ts` 第 425-427 行：**`public` 命令强制要求 `requestId`**，
缺失即抛 `ERR_TER_RUNTIME_REQUEST_ID_REQUIRED`。本文全部 `public` 命令的派发**必须带 requestId**。

⚠️ **部件只依据 request 的 `status` / `errors` 决定呈现**，不得据此写业务 slice、
不得据此派业务命令（只可派 ui-state 的呈现类命令）。业务后果（如「三次失败锁定」）一律在 actor。

⚠️ **派发 Promise 不得被静默丢弃**：UI action handler 必须返回或传播 `dispatchWithRequestId` 的 typed Promise，禁止用 `void <Promise>` 或空 `catch` 吞掉拒绝；需要释放本次交互的瞬时 request 句柄时，在 `finally` 中完成，不得把失败改写成成功。

### 6.2a `ui/feature` 向 integration 暴露的组装契约（规范性 · Codex review M-6）

✅ 亲验 `createUiStateModule({catalog, variables})` **必须同时收到 catalog 与 variables**
（`createUiStateModule.ts` 第 39 行）；✅ 亲验 `RuntimeModule` 类型**没有变量声明字段**
（`runtime/src/types/module.ts` 第 73 行）。⇒ 变量声明**无法搭 RuntimeModule 的车**到达 integration。

每个 `ui/feature` 包必须导出**一个组装描述**，integration 只消费它，**不得**重复声明、
不得读包内部文件：

```
export const <pkg>Assembly = {
  parts:       readonly DefinedPart[]      // definePart 的输出，含两半
  variables:   readonly UiVariableDeclaration<StateJsonValue>[]
  createModule: () => RuntimeModule        // 本包的 actor 模块工厂
}
```

**integration 的组装顺序**（规范性）：

⚠️ 与 §6.7 的**九项 modules 清单**必须是同一份数据，此处只是把它按步骤展开
（Codex review M-3，`CONFIRMED`：v5 曾在这里漏写三个 base descriptor，
与 §6.7／S-10 的九项要求不一致）。

```
① 构造 kernel.base.contracts / kernel.base.platform-ports / kernel.base.state
   三个 base descriptor（见 §6.7 的 W-12：本轮由 sample-console 内建一份）
② 汇总两个 ui/feature 的 parts → catalogEntry 半 → createUiCatalog
                              → rendererBinding 半 → createRendererCatalog
③ 汇总两个 ui/feature 的 variables
④ createUiStateModule({catalog, variables})
⑤ createRuntime({ modules: [①的三个 base descriptor, displayContextModule,
                            ④的 uiStateModule,
                            两个 kernel/feature 的 createModule(),
                            两个 ui/feature 的 createModule()], ... })
   —— 3＋1＋1＋2＋2 ＝ **共九项**传入 `input.modules`；`kernel.base.runtime` 由 `createRuntime`
   自动加入，使总注册模块数为**十项**（Codex review M-1，`CONFIRMED`：v6 数错成八项／第九项）
⑥ 从 runtime 闭包构造 stateSource / dispatchCommand / selectUiVariable
⑦ 组成 SampleAssembly 句柄（闭包持有 runtime／两张冻结 catalog／绑定的 reader），
   其 createSurface(displayMode) 挂 RenderProvider
```

⚠️ **变量的 owner 归属**：`sample.login.*` 由 `sample-staff-auth` 声明，
`sample.member.*` 由 `sample-member-desk` 声明 —— 谁的界面谁声明，
`kernel/feature` 不声明任何 uiVariable。

### 6.3 `kernel/feature/sample-staff-session`

`moduleName: 'kernel.feature.sample-staff-session'`，`moduleKind: 'owner'`
依赖：`contracts` · `state` · `runtime`（**不依赖 `ui-state`**，它不碰 partKey）

**slice**

```
sessionSliceName = `${moduleName}.session`
SessionState = { status: 'anonymous' | 'authenticated'; operatorName: string | null }
initial      = { status: 'anonymous', operatorName: null }
persistIntent = 'owner-only'      syncIntent = 'isolated'
```

**命令**

| command | payload | visibility | 谁派 |
| --- | --- | --- | --- |
| `bootstrapSessionCommand` | `{}` | `internal` | 本包 `install` |
| `loginCommand` | `{ operatorName: string; passcode: string }` | `public` | UI 部件 |
| `logoutCommand` | `{}` | `public` | UI 部件 |
| `loginSucceededCommand` | `{ operatorName: string }` | `public` | 本包 actor |
| `loginFailedCommand` | `{ reasonCode: 'invalid-credentials' }` | `public` | 本包 actor |
| `logoutSucceededCommand` | `{}` | `public` | 本包 actor |
| `sessionRestoredAuthenticatedCommand` | `{ operatorName: string }` | `public` | 本包 actor |
| `sessionRestoredAnonymousCommand` | `{}` | `public` | 本包 actor |

⚠️ **五条**领域事件命令（`loginSucceededCommand`／`loginFailedCommand`／`logoutSucceededCommand`／
`sessionRestoredAuthenticatedCommand`／`sessionRestoredAnonymousCommand`）必须 `public` ——
它们要被 `ui/feature` 的 actor 监听（Codex review S-2，`CONFIRMED`：v6 数成「四条」）。
按结果拆成独立命令，而非单条带 boolean：各 actor 只订自己关心的，actor 内无 `if` 分支。

**actor**

| actor | 监听 | 行为 |
| --- | --- | --- |
| `bootstrap` | `bootstrapSessionCommand` | 读已恢复 slice → 按结果派 `sessionRestoredAuthenticatedCommand` **或** `sessionRestoredAnonymousCommand` |
| `login` | `loginCommand` | 校验（§6.3.1）。通过 → 写 slice → 派 `loginSucceededCommand`；**失败 → 不写 slice → 派 `loginFailedCommand` 并使本命令以失败告终** |
| `logout` | `logoutCommand` | 清 slice → 派 `logoutSucceededCommand` |

⚠️ **`TR-02` 硬要求**：`loginCommand` 校验失败时**未完成其名义动作**，
actor **不得返回成功** —— 必须抛出带 `reasonCode` 的业务错误，使该 request 在 ledger 中记为失败。
v1 写「不写 slice ＋ 派 openLayer」而未规定返回值，属 `TR-02` 违反，本版修正。

**`install`**：只 `dispatchCommand(bootstrapSessionCommand, {}, {requestId: createRequestId()})`。
**不读不写**（`TR-01`）。

⚠️ **必须带 requestId**（Codex review M-2，`CONFIRMED`）。
✅ 亲验 `createCommandDispatcher.ts` 第 656 行
`const childRequestId = childOptions.requestId ?? command.requestId ?? undefined`
—— 父命令 requestId 为 `null` 时子命令拿到 `undefined`；
✅ 第 425-427 行 public 子命令缺 requestId **直接抛**
`ERR_TER_RUNTIME_REQUEST_ID_REQUIRED`。
⇒ 若 install 派的 internal bootstrap 无 requestId，其 actor 派出的 **public 恢复事件必然抛错**。
本文全部**会派出 public 子命令的 internal 命令**，其根派发点都必须显式给 requestId。

⚠️ **拆成两条命令**而非单条带 `boolean`：`TR-12` 约束 2 明令
「不得用单条命令带 `boolean` 由各 actor 自行分支」。v2 的 `sessionRestoredCommand{authenticated}`
违反了我自己写进规范的那一条。

#### 6.3.1 校验规则（本地写死）

```
[{operatorName: 'A001', passcode: '1111'},
 {operatorName: 'A002', passcode: '2222'}]
```

匹配即通过，否则失败。使成功与失败两条路径都可达。真接后端待 `transport` 就绪后换 mock 服务。
⚠️ 常量表是**假业务**；校验发生在 actor 内、失败经 ledger 落地，是**真形态**。

### 6.4 `kernel/feature/sample-member-registry`

`moduleName: 'kernel.feature.sample-member-registry'`，`moduleKind: 'owner'`
依赖：`contracts` · `state` · `runtime`（**不依赖 `ui-state`**）

**slice**

```
memberSliceName = `${moduleName}.members`
Member      = { memberId: string; name: string; phone: string; registeredAt: number }
MemberState = { members: readonly Member[]; pending: { name: string; phone: string } | null }
initial     = { members: [], pending: null }
persistIntent = 'owner-only'      syncIntent = 'isolated'
```

**命令**

| command | payload | visibility | 谁派 |
| --- | --- | --- | --- |
| `submitMemberCommand` | `{ name: string; phone: string }` | `public` | UI 部件 |
| `confirmMemberCommand` | `{}` | `public` | UI 部件 |
| `rejectMemberCommand` | `{}` | `public` | UI 部件 |
| `memberPendingCommand` | `{ name: string; phone: string }` | `public` | 本包 actor |
| `memberConfirmedCommand` | `{ memberId: string }` | `public` | 本包 actor |
| `memberRejectedCommand` | `{ reasonCode: 'customer-rejected' }` | `public` | 本包 actor |

**actor**

| actor | 监听 | 行为 |
| --- | --- | --- |
| `submit` | `submitMemberCommand` | 写 `pending` → 派 `memberPendingCommand` |
| `confirm` | `confirmMemberCommand` | `pending` 为 `null` 时**抛错**（`TR-02`）；否则生成 `memberId`／`registeredAt`、入 `members`、清 `pending` → 派 `memberConfirmedCommand` |
| `reject` | `rejectMemberCommand` | 清 `pending` → 派 `memberRejectedCommand` |

**公开 selector**（`TR-03`：跨包读只能走 owner 导出的 selector）

| selector | 返回 |
| --- | --- |
| `selectMembers(root): readonly Member[]` | 已登记会员 |
| `selectPendingMember(root): { name: string; phone: string } \| null` | 待确认登记 |

⚠️ ✅ 亲验 `TR-03`「跨包读只能走 selector，禁止按字符串键读别人的 slice」。
`ui/feature/sample-member-desk` 的部件**只经这两个 selector**读会员业务状态，
**不得**按字符串键取 slice、不得依赖内部 state 形状。

⚠️ `memberId` 与 `registeredAt` 只能在 actor 内生成（状态写入），**不得在部件内生成**。

### 6.5 `ui/feature/sample-staff-auth`

`moduleName: 'ui.feature.sample-staff-auth'`，`moduleKind: 'owner'`
依赖：`state` · `ui-state` · `render` · `runtime` · `sample-staff-session` · `ui.base.primitives`
（**不依赖** `sample-member-desk`、**不依赖** `sample-member-registry`）

⚠️ **`state` 不得省**：组装描述的 `StateJsonValue` 类型仍由本包直接使用；requestId 与 request 观察已经收口到
`render`，所以本包不再直接 import `contracts`。本包也不直接 import `display-context`，因此不声明该边。

**part**

| part | partKey ＝ rendererKey | containerKeys | displayModes | layerTier |
| --- | --- | --- | --- | --- |
| 登录屏 | `sample.auth.login` | `['main']` | `['PRIMARY']` | 省略 |
| 登录失败层 | `sample.auth.notice` | `[]` | `['PRIMARY']` | `'alert'` |

`workspaces` 一律 `['MAIN']`、`instanceModes` 一律 `['MASTER']` —— 只声明本轮可达值。

**本包自有命令**（谁的层谁关，定义在 ui 包，`kernel/feature` 不参与）

| command | payload | visibility | 谁派 |
| --- | --- | --- | --- |
| `authNoticeDismissedCommand` | `{}` | `public` | `sample.auth.notice` 的 `:dismiss` 按钮 |

**uiVariable**（本包 module 声明）

| key | defaultValue | persistIntent |
| --- | --- | --- |
| `sample.login.operator-name` | `''` | **`'owner-only'`**（记住工号） |
| `sample.login.passcode` | `''` | **`'never'`**（密码不落盘） |

⚠️ 两档 `persistIntent` 必须都出现。与 session slice 的 `operatorName` **用不同标识符**，不得混用。

**actor**

| actor | 监听 | 行为 |
| --- | --- | --- |
| `authResult` | `loginFailedCommand` | 派 `openLayer(PRIMARY,'sample.auth.notice', {props:{reasonCode}})` —— **reasonCode 取自命令 payload 显式透传**；再派 `clearUiVariables{keys:['sample.login.passcode']}` |
| `authNav` | `logoutSucceededCommand` | 派 **`clearLayers(PRIMARY)`** ＋ `showScreen(PRIMARY,'main','sample.auth.login')` |
| `authNav` | `sessionRestoredAnonymousCommand` | 派 `showScreen(PRIMARY,'main','sample.auth.login')`。**actor 内无 `if` 分支** —— 事件本身已表达结果（`TR-12` 约束 2） |
| `authNav` | `loginSucceededCommand` | 派 `clearLayers(PRIMARY)`（关掉可能残留的失败提示层） |
| `authNotice` | `authNoticeDismissedCommand`（**本包自有 `public` 命令**，由 `sample.auth.notice` 的 `:dismiss` 按钮派） | 派 `closeLayer(PRIMARY,'sample.auth.notice')` |

**登录屏行为**：两个输入框写 `setUiVariablesCommand`；「登录」按钮按 §6.2 五步派 `loginCommand`；
request 未完成时按钮显示 loading 且**拒绝重复提交**。**零业务判断。**

### 6.6 `ui/feature/sample-member-desk`

`moduleName: 'ui.feature.sample-member-desk'`，`moduleKind: 'owner'`
依赖：`state` · `ui-state` · `render` · `runtime` · `display-context` · `sample-member-registry` · `sample-staff-session` · `ui.base.primitives`
（**不依赖** `sample-staff-auth`）

⚠️ `state` 同 §6.5，不得省；requestId 由 `render` 的 helper 负责，本包不直接 import `contracts`。
⚠️ **不额外声明 `platform-ports`**：本包 actor 用的 `context.platformPorts.device`
由 `ActorExecutionContext` 提供（✅ 亲验 `runtime/src/types/actor.ts` 第 29 行），
是 `runtime` 边带来的能力，不是本包对 `platform-ports` 模块的直接依赖。

**part**

| part | partKey ＝ rendererKey | containerKeys | displayModes | layerTier |
| --- | --- | --- | --- | --- |
| 会员列表 | `sample.desk.member-list` | `['main']` | `['PRIMARY']` | 省略 |
| 登记表单 | `sample.desk.member-form` | `['main']` | `['PRIMARY']` | 省略 |
| 等待确认层 | `sample.desk.waiting-confirm` | `[]` | `['PRIMARY']` | **`'standard'`（显式）** |
| 流程提示层 | `sample.desk.registry-notice` | `[]` | `['PRIMARY']` | `'alert'` |
| 顾客待机 | `sample.desk.customer-welcome` | `['main']` | `['SECONDARY']` | 省略 |
| 顾客信息 | `sample.desk.customer-member` | `['main']` | **`['PRIMARY','SECONDARY']`** | 省略 |

| `sample.member.name` | `''` | `'never'` |
| `sample.member.phone` | `''` | `'never'` |

**本包自有命令**（谁的屏谁导航、谁的层谁关，`kernel/feature` 不参与）

| command | payload | visibility | 谁派 |
| --- | --- | --- | --- |
| `memberFormOpenedCommand` | `{}` | `public` | `member-list` 的 `:add` 按钮 |
| `noticeDismissedCommand` | `{}` | `public` | `registry-notice` 的 `:dismiss` 按钮 |

**actor**（全部分支判据为 `resolveSecondarySurfaceAvailable(await readDisplayInfo(context.platformPorts.device))` —— **实时求值不缓存**，见 §5.1）

| actor | 监听 | 行为 |
| --- | --- | --- |
| `deskNav` | `loginSucceededCommand` · `sessionRestoredAuthenticatedCommand` | `showScreen(PRIMARY,'main','sample.desk.member-list')`；双屏另加 `showScreen(SECONDARY,'main','sample.desk.customer-welcome')` |
| `deskNav` | `logoutSucceededCommand` | 派 **`clearLayers(SECONDARY)`** ＋ 双屏 `showScreen(SECONDARY,'main','sample.desk.customer-welcome')` |
| `deskNav` | `sessionRestoredAnonymousCommand` | 双屏时 `showScreen(SECONDARY,'main','sample.desk.customer-welcome')` |
| `deskForm` | `memberFormOpenedCommand`（本包自有 `public` 命令，由「新增」按钮派） | `showScreen(PRIMARY,'main','sample.desk.member-form')`；双屏另加 `showScreen(SECONDARY,'main','sample.desk.customer-member',{mode:'preview'})` |
| `deskPending` | `memberPendingCommand` | **双屏**：`showScreen(PRIMARY,'main','sample.desk.member-list')` ＋ `openLayer(PRIMARY,'sample.desk.waiting-confirm')` ＋ `showScreen(SECONDARY,'main','sample.desk.customer-member',{mode:'confirm'})`；**单屏**：`showScreen(PRIMARY,'main','sample.desk.customer-member',{mode:'confirm'})` |
| `deskConfirmed` | `memberConfirmedCommand` | `clearUiVariables{keys:['sample.member.name','sample.member.phone']}` ＋ `showScreen(PRIMARY,'main','sample.desk.member-list')`；双屏另加 `closeLayer(PRIMARY,'sample.desk.waiting-confirm')` ＋ `showScreen(SECONDARY,'main','sample.desk.customer-welcome')` |
| `deskRejected` | `memberRejectedCommand` | `openLayer(PRIMARY,'sample.desk.registry-notice', {props:{reasonCode}})` —— **reasonCode 取自命令 payload 显式透传**；双屏另加 `showScreen(SECONDARY,'main','sample.desk.customer-member',{mode:'preview'})`；单屏另加 `showScreen(PRIMARY,'main','sample.desk.member-form')` |
| `deskNotice` | `noticeDismissedCommand`（本包自有 `public` 命令，由「知道了」按钮派） | `closeLayer(PRIMARY,'sample.desk.registry-notice')`；双屏另加 `closeLayer(PRIMARY,'sample.desk.waiting-confirm')` ＋ `showScreen(PRIMARY,'main','sample.desk.member-form')` |

**`customer-member` 的 props**：`{ mode: 'preview' \| 'confirm' }`。
业务数据读 `sample-member-registry` 的 slice 与登记 uiVariable，不经 props 传递。

### 6.7 `ui/integration/sample-console`

**双身份**（参照 POC v1 `catering-shell`）：

| 身份 | 形态 |
| --- | --- |
| 库 | `exports: {".": "./src/index.ts"}`，供 `sample-terminal` 消费 |
| Expo Web 工程 | 根 `index.js` 内 `registerRootComponent(require('./test-expo/App').default)`；`test-expo/` 放 `App.tsx` ＋ 开发外壳 ＋ 自有 tsconfig |

`expo` / `expo-status-bar` / `react-dom` / `react-native-web` 一律进 **devDependencies**。

**公开面（库侧）**

```
createSampleAssembly(input: {
  platformPorts: PlatformPorts
  persistenceKey?: string        // 缺省用固定 sample 值；测试必须能覆盖以隔离
}): Promise<SampleAssembly>

type SampleAssembly = Readonly<{
  runtime: Runtime                                     // resolve 时已 started
  createSurface: (displayMode: DisplayMode) => ReactElement
}>
```

⚠️ **只有这一个入口**（Codex round-2 M-4）。v3 曾拆成 `createSampleRuntime` ＋
`createSampleCatalogs` ＋ `createSampleSurface({runtime, displayMode})` 三个独立导出，
**无法保证三者属于同一次组装** —— `Runtime` 类型不持有 catalog，
`createSurface` 也没有接收 catalog 或 reader 的入参。

`SampleAssembly` 是一个 **assembly 级句柄**：它闭包持有本次组装的
runtime、**冻结的两张 catalog**、以及**绑定该 `UiStateModule` 实例的 `selectUiVariable` reader**。
`createSurface` 从闭包取全部依赖 ⇒ **同一 assembly 的每棵 surface 树必然共用同一组** catalog 与 reader，
由类型与闭包保证，不靠纪律。

⚠️ **生命周期写死**（Codex round-2 S-7）：`createSampleAssembly` 的 Promise **resolve 时
`runtime.status` 已为 `'started'`**。✅ 亲验 `createRuntime` 是**同步创建、再异步 `start()``，
两段分离；S-10 要断言 `started`，故由本函数内部完成 `await runtime.start()`，
**不把 start 的责任推给调用方**。start 失败则 Promise reject，不返回半成品。

⚠️ **runtime 的 modules 必须含 base module descriptor**（Codex round-2 M-3，`CONFIRMED`）：
✅ 亲验 `createRuntime` 只自动加入 runtime 自己的 internal module
（`const declaredModules = [internalModule, ...input.modules]`）；
✅ 亲验 `resolveModuleOrder` 对缺失的非 optional 依赖**直接抛**
`Missing required runtime module dependency`；
✅ 亲验 `ui-state` 的 `dependencyModuleNames` 含 `contracts`／`platform-ports`／`state`／`runtime`／`display-context`。
⇒ 组装时**必须显式注册** `contracts`／`platform-ports`／`state` 三个 descriptor（`runtime` 自动在场）。

**modules 完整清单（9 项，顺序不限，缺一即调用 `createRuntime(...)` 时同步抛错）**：

⚠️ **不是 `start()` 抛错**（Codex review S-4，`CONFIRMED`）：✅ 亲验 `createRuntime` 本身是
**同步函数**，`resolveModuleOrder` 在其内部直接调用（第 196 行），早于任何 `start()` 调用；
缺失依赖在**构造阶段**（即 `createSampleAssembly` 内部调用 `createRuntime(...)` 那一刻）
就会抛错，`start()` 根本不会被调用到。

```
kernel.base.contracts        (toolkit, deps: [])                    ← base descriptor
kernel.base.platform-ports   (toolkit, deps: [contracts])           ← base descriptor
kernel.base.state            (toolkit, deps: [contracts, platform-ports]) ← base descriptor
kernel.base.display-context  createDisplayContextModule()
kernel.base.ui-state         createUiStateModule({catalog, variables})
kernel.feature.sample-staff-session
kernel.feature.sample-member-registry
ui.feature.sample-staff-auth
ui.feature.sample-member-desk
（kernel.base.runtime 由 createRuntime 自动加入，不在 input.modules 中）
```

⚠️ **W-12（观察项）：base descriptor 当前没有正本提供方。**
✅ 亲验 `contracts`／`platform-ports`／`state` 三个包**都不导出 module 工厂**，
而 `ui-state` 的 `content.test.ts`／`variableRuntime.test.ts`／`acceptance.test.ts`
**各自手抄了一份 `createDependencies()`**（三个壳描述符，逐字重复）。
⇒ 本轮 `sample-console` 内建**一份** `createBaseModuleDescriptors()` 并**登记为欠账**：
将来是否由三个 base 包各自导出自己的 descriptor，由 Dexter 另裁。
⚠️ **不得让两个 `ui/feature` 或 assembly 各抄一份** —— 范本一旦示范手抄，真实业务包会照抄到底。

**职责边界**

| 允许 | 禁止 |
| --- | --- |
| 建 catalog（收集两个 ui/feature 包的 `definePart` 输出）、建 runtime（注册 4 个 sample module ＋ ui-state ＋ display-context）、构造 `stateSource` 与 `dispatchCommand`、挂 Provider 与 `SurfaceRoot` | **构造端口**（只接收）· **任何业务判断**（V-7）· 平台判断 · 硬编码 `'PRIMARY'` · 持有任何 `partKey` |

**「挂几棵树」的决策点只有一处，且只存在于 Web 宿主**（`test-expo/App` 的入口函数）：
按 §5.1 约束 3，在 `createSampleAssembly` resolve 之后、挂载 React 树之前，
`await readDisplayInfo` 一次并 `resolveSecondarySurfaceAvailable` 一次，据此调用一到两次
`createSurface(displayMode)`。**与业务 actor 用同一对函数，但这是两次独立求值**
（宿主一次决定挂几棵树，业务 actor 后续处理命令时按约束 2 各自实时求值），
**不是共享同一次读取结果**——两者时机不同，缓存会违反约束 2。
这是**宿主侧的 surface 承载决策**，非业务判断。

⚠️ **Android 宿主没有这个决策点** —— 与 §5.1 约束 3、§6.8 同一裁定，不得回退：
surface 由 `adapter/android/dual-screen` 在 Kotlin 侧创建，屏数与本屏索引经 `initialProps` 送达，
`sample-terminal` **既不查设备、也不决定挂几棵树、不写 bootstrap**，因此也不需要 `display-context` 边。
Android 侧每个 surface 的根组件只按 `props.displayIndex` 取本屏 `displayMode` 调一次 `createSurface`。
⚠️ v2–v7 曾写「两个宿主入口函数形态一样，不是两套独立逻辑」，**v8 已撤销该自造协议**
（§5.1 约束 3 的表：Android 与 Expo Web 的 surface 创建者与屏数来源本来就不同）。

⚠️ **两棵 Android surface 如何共用同一个 assembly（单 VM／单 store）＝ D-6**，
仓内零证据、必须真机 spike 回答（§2.1c、§11.1 第二段），**本节不预设承载形态**；
Web 段（第一段）不依赖该结论 —— 两棵树同在一个 JS 环境里，由同一次
`createSampleAssembly` 的 `createSurface` 各出一棵。

**`test-expo` 端口表**：10 个 binding 全部显式绑定；
`device` 绑一个**其 `getDisplayInfo` 返回值由外壳自身状态决定的 `DevicePort`**（见 §6.7a）。

#### 6.7b surface 尺寸与排布：由 integration 的 `package.json` 声明（Dexter 2026-09-04 要求）

**这不是开发便利，是保真度。** POS 硬件的屏幕尺寸是**固定的** ——
主屏与客显各是一块确定分辨率的屏。拿浏览器的响应式尺寸开发，等于为一个永远不会 resize 的目标
做响应式布局，本身就是错的。⇒ **每个 `ui/integration` 包声明自己的目标硬件形态。**

✅ 可行性亲验：TER 已有自定义 `package.json` 字段的先例（五个 adapter 各有 `jest` 字段）；
✅ 骨架静态门只校验 `dependencies`／`devDependencies`／`peerDependencies`／`optionalDependencies`
四个字段（`tools/terminal-skeleton/check-static.mjs` 第 109 行），**不枚举字段白名单** ⇒ 加自定义字段不触门。

**声明形态**（`ui/integration/sample-console/package.json`）：

```json
"terminalSurfaces": {
  "layout": "row",
  "scaleToFit": true,
  "surfaces": {
    "PRIMARY":   { "width": 1920, "height": 1080 },
    "SECONDARY": { "width": 1024, "height": 600 }
  }
}
```

| 字段 | 含义 |
| --- | --- |
| `layout` | `"row"`（横向并排）｜ `"column"`（纵向堆叠） |
| `surfaces.<displayMode>` | **每个 displayMode 各自的逻辑尺寸** —— 真实 POS 的主屏与客显通常不同分辨率，故不共用一组尺寸 |
| `scaleToFit` | 见下方「形状不变」的说明 |

**「不随浏览器大小改变形状」的确切含义**：surface 按声明的**逻辑尺寸**渲染，
浏览器 resize **不改变它的宽高与宽高比**。但 1920 ＋ 1024 ＝ 2944px 宽装不进多数开发屏，
故 `scaleToFit: true` 时对**整体**做等比缩放以适配视口 —— **等比缩放不改变形状**，
只改变显示倍率；surface 内部的布局计算仍按逻辑尺寸进行。
⇒ 部件永远面对一块确定尺寸的画布，与真机一致。

**谁读这个配置**：

| 消费方 | 怎么用 |
| --- | --- |
| `test-expo` 外壳 | 读它决定两棵树的容器尺寸、排布方向与缩放倍率 |
| Android | **不读** —— 物理屏决定实际尺寸。此处声明的是**设计目标**，真机上是否断言实际分辨率与之相符，本轮不做要求 |

⚠️ **单一来源**：`sample-console` 的库侧读自己的 `package.json` 并**导出一个带类型的常量**，
`test-expo` 只消费那个常量，**不各自解析 package.json** —— 否则同一配置两处解析、迟早漂移。

##### 边界：业务包对尺寸零感知

| 允许 | 禁止 |
| --- | --- |
| 外壳按配置设定容器尺寸、排布与缩放 | 任何 sample 业务包读 `terminalSurfaces`、或出现 `1920`／`1080` 之类的**尺寸字面量** |
| 部件在**给定画布内**用相对／flex 布局 | 部件假定自己一定是 1920 宽 |

⚠️ **对交互工件的影响**：声明了尺寸之后，IA／交互工件里那些「具体尺寸／换行待 Dexter 裁决」
的留白**有了确定画布**。但「部件内部用 flex 还是绝对定位」仍是产品／UI 决策 ——
固定硬件下绝对定位是可辩护的，本文**不替 Dexter 裁**，只指出这个留白现在可以收口了。

#### 6.7a `test-expo` 的形态切换开关（Dexter 2026-09-04 要求）

**外壳提供一个按钮，可在单屏／双屏之间动态切换，无需重启。**

**实现形态**（全部在 `test-expo` 内，见下方边界）：

```
外壳持有一个 surfaceMode 状态：'single' | 'dual'
  ├─ 注入的 DevicePort.getDisplayInfo() 闭包读这个状态 → 返回 displayCount 1 或 2
  └─ 外壳按这个状态挂 1 棵或 2 棵 surface 树
切换按钮翻转该状态 ⇒ 两处同时改变，天然一致
```

**为什么这样就够、不需要额外机制**：业务 actor 按 §5.1 约束 2 **每次处理命令时实时读取、从不缓存**
⇒ 切换后的下一条命令自动读到新屏数，**业务侧零改动、零感知**。

**切换时不重建 runtime**：只挂载／卸载第二棵 surface 树，runtime 与 store 保持。
⇒ 已登记会员、登录态等状态跨切换保留，便于连续对比两种形态。

⚠️ **约束 3 的「一次」是指「每次挂载决策一次」，不是「整个会话一次」**。
每次切换都是一次新的挂载决策，各读一次，仍不缓存。

##### 边界：这是外壳的开发设施，不是产品能力

| 允许 | 禁止 |
| --- | --- |
| 按钮与 `surfaceMode` 状态**只存在于 `test-expo`** | 任何 sample 业务包／`sample-console` 库侧**感知它的存在** |
| 注入的 `DevicePort` 闭包读外壳状态 | 业务包读屏数**不经** `readDisplayInfo` ＋ `resolveSecondarySurfaceAvailable`（纪律 N-2） |
| — | 把切换做成 sample 的 part、command 或 slice —— 那会让范本教出「业务代码里有个屏数开关」这种荒谬形态 |

⚠️ **它不是热插拔模拟器。** §2.2 押后的「副屏热插拔」指的是**应用能在运行时察觉屏幕被插拔**
（需要 `subscribeDisplayStatus`）。本开关不需要察觉 —— **外壳自己就是那个动手的人**，它知道自己翻了状态。

⚠️ **不保证流程中途切换的正确性**：若在场景 6（顾客待确认）中途从双屏切到单屏，
`pending` 仍在 state 里而副屏树已卸载，确认动作无处可点。这属于真正的热插拔语义，**本轮不做**。
⇒ 判据要求**在干净态下切换后重跑场景**，不要求中途切换可用。

### 6.8 `assembly/android/sample-terminal`

**全部代码就是一张端口表**（v8 复核确认此说法**本来就是对的**，见下方 ⚠️）：

| binding | 本轮 | 后续替换 |
| --- | --- | --- |
| `logger` | `consoleLoggerBinding` | `adapter-android-logger` |
| `persistKv` | **`adapter-android-persist-kv`（Kotlin MMKV）** | 已到位 |
| `persistSecure` | `unavailablePersistSecurePort` | 待定 |
| `device` | **`adapter-android-device`（至少 `getDisplayInfo`）** | 其余方法后续补 |
| `appControl` | `unavailableAppControlPort` | `adapter-android-app-control` |
| `script` | `unavailableScriptPort` | 待定 |
| `connector` | `unavailableConnectorPort` | 待 transport |
| `hotUpdate` | `unavailableHotUpdatePort` | 待定 |
| `logUpload` | `unavailableLogUploadPort` | 待定 |
| `topologyHost` | `unavailableTopologyHostPort` | `adapter-android-dual-screen` |

✅ 亲验 `PlatformPortBindings` 的 10 个字段**无一可选** ⇒ 漏一个即编译不过。

⚠️ **它不做屏数判断，也不做宿主 bootstrap**（v8 纠错）。

✅ 亲验 `adapter/android/dual-screen/README.md`：**创建/销毁 `Presentation`、挂载/卸载 RN surface
是该 adapter 的职责**。✅ 亲验 POC v1 的做法：`MainActivity.getLaunchOptions()` 传
`displayIndex = 0`、`SecondaryActivity.getLaunchOptions()` 传 `displayIndex = 1`，
两者挂**同一个已注册组件**，`LaunchOptionsFactory` 在 Kotlin 侧同步
`putInt("displayCount", displayManager.displays.size)` 与 `putInt("displayIndex", …)`；
`AppRegistry.registerComponent` **保持同步、一行未改**。

⇒ **屏数与本屏索引经 initialProps 送达，JS 侧不查设备、不决定挂几棵树。**
这与 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 的原话「**Kotlin 按屏传不同 `initialProps`**」一致。

⚠️ **`sample-terminal` 因此只有端口表** —— 理由不是「dual-screen 押后」（v9 已把它拉进本轮，§2.1），
而是**职责归属**：创建 surface 与传 `initialProps` 是 `adapter/android/dual-screen` 的活，
屏数经 `initialProps` 送达，装配层既不查设备也不决定挂几棵树。
⇒ 既不需要 `display-context` 依赖，也不需要 bootstrap 代码。

**依赖瘦身**：由全部 21 个包的平铺占位削到 **7 条**：5 个 adapter ＋ `platform-ports` ＋ `sample-console`。
⚠️ v8 撤销了曾一度加入的 `display-context` 边 —— 那条边的**理由**（宿主要 await 查屏数）已作废。

### 6.9 部件规格（props · testID · 禁止清单）

八个业务部件必须经 `ui/base/primitives` 的 typed React Native 控件以 JSX 构建；不得在
`ui/feature` 生产源码中以字符串字面量调用 `createElement`，也不得用未注册的字符串 host tag
冒充控件。`MemberRow` 等带业务领域词汇的组合组件留在所属 `ui/feature`，只组合 primitives，
不进入 primitives 公共面。

**props 契约**（`ScreenPlacement.props` 是 `StateJsonValue`，**不得传函数**）

| part | props | 业务数据来源 |
| --- | --- | --- |
| `sample.auth.login` | 无 | 两个登录 uiVariable |
| `sample.auth.notice` | `{ reasonCode: string }` | props |
| `sample.desk.member-list` | 无 | `sample-member-registry` 的 `members` |
| `sample.desk.member-form` | 无 | 两个登记 uiVariable |
| `sample.desk.waiting-confirm` | 无 | `pending` |
| `sample.desk.registry-notice` | `{ reasonCode: string }` | props |
| `sample.desk.customer-welcome` | 无 | 无 |
| `sample.desk.customer-member` | `{ mode: 'preview' 或 'confirm' }` | `pending` 或两个登记 uiVariable |

**testID 清单**（按 §8 约定 `` `${partKey}:<element>` ``，**行为测试据此定位**）

| part | 必须存在的 testID |
| --- | --- |
| `sample.auth.login` | `:operator-name` · `:passcode` · `:submit` · `:loading` |
| `sample.auth.notice` | `:message` · `:dismiss` |
| `sample.desk.member-list` | `:row` · `:add` · `:logout` |
| `sample.desk.member-form` | `:name` · `:phone` · `:submit` · `:loading` |
| `sample.desk.waiting-confirm` | `:message` |
| `sample.desk.registry-notice` | `:message` · `:dismiss` |
| `sample.desk.customer-welcome` | `:message` |
| `sample.desk.customer-member` | `:name` · `:phone`；`confirm` 态另有 `:confirm` · `:reject` |

**八个部件一律禁止**

| # | 禁止 | 依据 |
| --- | --- | --- |
| 1 | `dispatchAction` / `store.dispatch` / `useDispatch` | `TR-01` · P-1 |
| 2 | 表单值存 `useState`（**requestId 除外**，见 §6.2 ③） | V-4 · P-7 |
| 3 | 依据屏数分支 | §4.4 · P-9 |
| 4 | **裸读**别的包的业务 slice：按字符串键从 `getState()` 取、或依赖其内部 state 形状。⚠️ **经 owner 导出的 selector 跨包读是允许的**（`TR-03`），`sample-member-desk` 的部件正是这样读 `selectMembers`／`selectPendingMember` | `TR-03` · P-7 |
| 5 | 决定「该显示哪个屏」 | V-3 · P-7 |
| 6 | 依据 request 结果写业务 slice 或派**业务**命令（只可派 ui-state 呈现类命令） | §6.2 |
| 7 | 生成 `memberId` / `registeredAt` 等业务标识 | §6.4 |
| 8 | 平台判断（`Platform.OS` / `typeof window`） | N-3 · P-4 |

---

## 7. 命令链路总表（规范性）

### 7.1 五条领域事件的监听者（Codex review S-2，`CONFIRMED`：v6 数成「三条」）

| 领域事件（kernel 派） | `sample-staff-auth`（ui） | `sample-member-desk`（ui） |
| --- | --- | --- |
| `sessionRestoredAnonymousCommand` | `showScreen(PRIMARY, login)` | 双屏 `showScreen(SECONDARY, welcome)` |
| `sessionRestoredAuthenticatedCommand` | — | `showScreen(PRIMARY, member-list)` ＋ 双屏 `showScreen(SECONDARY, welcome)` |
| `loginSucceededCommand` | `clearLayers(PRIMARY)` | `showScreen(PRIMARY, member-list)` ＋ 双屏 `showScreen(SECONDARY, welcome)` |
| `loginFailedCommand` | `openLayer(PRIMARY, auth-notice)` ＋ 清 passcode | — |
| `logoutSucceededCommand` | **`clearLayers(PRIMARY)`** ＋ `showScreen(PRIMARY, login)` | **`clearLayers(SECONDARY)`** ＋ 双屏 `showScreen(SECONDARY, welcome)` |

**两包的写入互不重叠** ⇒ 并发执行无竞态（§3.6）。⚠️ 措辞须精确：并非「同一时刻只有一包写 PRIMARY」——
`loginSucceededCommand` 时 auth 写 PRIMARY 的 **layers**、desk 写 PRIMARY 的 **containers**，
二者是 content set 内**互不相交的子状态**；`logoutSucceededCommand` 时则按 displayMode 分开。
两种情形都不产生「一方读另一方本次写入」的依赖，故并行安全。
副屏部件属 desk 包，故 SECONDARY 一律由 desk 派 ⇒ 无跨包 partKey 知识。

⚠️ ✅ 亲验 `createCommandDispatcher.ts` 第 527 行 `await Promise.all(handlers.map(...))`
—— 同一命令的多个 handler **并行**执行。⇒ **跨包时，ui actor 只监听 kernel 派出的领域事件命令，
不监听 kernel 的请求命令**，否则会与 kernel actor 的写入竞态。
⚠️ **同包例外**：`ui/feature` 监听**本包自有**的呈现请求命令
（`memberFormOpenedCommand`／`noticeDismissedCommand`／`authNoticeDismissedCommand`）是允许的 ——
不跨包、无并发对手（与 P-12 一致，Codex round-2 S-4）。

### 7.2 逐场景链路

| # | 部件动作（带 requestId） | kernel actor | kernel 派出的领域事件 | ui actor 承接 |
| --- | --- | --- | --- | --- |
| 1 | 无（`install` 派 internal bootstrap，**带 requestId**） | `bootstrap` 读恢复态 | `sessionRestoredAuthenticatedCommand` **或** `sessionRestoredAnonymousCommand` | 见 §7.1 |
| 2 | `loginCommand` | `login` 失败：**不写 slice，抛错** | `loginFailedCommand` | `authResult` 弹 alert 层 ＋ 清 passcode |
| 3 | `loginCommand` | `login` 通过：写 session slice | `loginSucceededCommand` | 见 §7.1 |
| 4 | `memberFormOpenedCommand` | —（ui 自有命令） | — | `deskForm` |
| 5 | `setUiVariablesCommand` | ui-state 自有 actor | — | — |
| 6 | `submitMemberCommand` | `submit` 写 `pending` | `memberPendingCommand` | `deskPending`（单／双屏分支） |
| 7a | `confirmMemberCommand` | `confirm` 入 `members`、清 `pending` | `memberConfirmedCommand` | `deskConfirmed` |
| 7b | `rejectMemberCommand` | `reject` 清 `pending` | `memberRejectedCommand` | `deskRejected` |
| 8 | `noticeDismissedCommand` | —（ui 自有命令） | — | `deskNotice` |
| 9 | `logoutCommand` | `logout` 清 session slice | `logoutSucceededCommand` | 见 §7.1 —— ⚠️ **两个 displayMode 各派一次 `clearLayers`**：✅ 亲验其 payload 为 `{displayMode}`（一次只清一个），且 `showScreen` 的 reducer **不清层**，**不得以 showScreen 代替清层** |

⚠️ ✅ 亲验 `clearUiVariablesCommand` 的 payload 是 `{keys: readonly string[]}` ——
**按 key 清，不是清全部**。场景 2 只清 passcode，**必须保留 `sample.login.operator-name`**。
**实施不得裸调 `clearUiVariables`。**

⚠️ ✅ 亲验 `clearLayersCommand` 的 payload 是 `{displayMode}` ——
**一次只清一个 displayMode**。

## 8. 命名约定（规范性）

| 对象 | 约定 | 示例 |
| --- | --- | --- |
| `moduleName` | `<layer>.<sublayer>.<package>` | `kernel.feature.sample-staff-session` |
| slice name | `` `${moduleName}.<slice>` `` | `kernel.feature.sample-staff-session.session` |
| `partKey` / `rendererKey` | `sample.<domain>.<part>`，二者取同值 | `sample.desk.member-form` |
| `containerKey` | 本轮唯一容器 `'main'` | — |
| uiVariable key | `sample.<domain>.<name>` | `sample.login.passcode` |
| `layerId` | 与 `partKey` 同值（本轮每类层最多一个实例） | `sample.desk.waiting-confirm` |
| testID | `` `${partKey}:<element>` `` | `sample.desk.member-form:submit` |

### 8a. sample 的写法纪律（规范性 · 补回 v2 重写时遗失的一节）

⚠️ P-3 与 P-4 引用了 N-2／N-3，但纪律表在 v2 重写 §5–§7 时被覆盖丢失，此处补回。

| # | 纪律 | 理由 |
| --- | --- | --- |
| N-1 | part 的 `workspaces` / `instanceModes` 按业务真实语义声明；本轮只声明可达值（`['MAIN']`／`['MASTER']`） | 不可达值无法被任何判据验证。真正需要精确的维度是 `displayMode` |
| N-2 | 业务**不得自行实现三态处理与安全降级**：一律 `readDisplayInfo` ＋ `resolveSecondarySurfaceAvailable`，**不读原始 `displayCount`、不自己写 `?? 1`** | 降级规则只有一处正本，否则各包迟早不一致（§5.1） |
| N-3 | **禁止任何平台判断决定屏数或布局**（`Platform.OS`／`typeof window`／UA 嗅探） | 屏数唯一来源是注入的 `DevicePort`。Web 上「默认单屏」应当是端口不可用 → 降级的**自然结果**，不是被写死的平台分支；写死了，Android 上双屏就验不到同一段代码 |

> 命令的 `defaultTarget` 一律省略（`defineCommand` 省略即 `'local'`）。本轮不涉及 peer，
> **什么都不做就是对的**，不必立为纪律。

---

## 9. 测试要求（前置说明，不得实施时再补）

### 9.1 归属

| 包 | 拥有的测试 |
| --- | --- |
| `sample-console` | **跨包集成行为测试**（S-1…S-19 的主体） |
| 两个 `kernel/feature` | 各自的 slice 与 actor 单元测试 |
| 两个 `ui/feature` | 各自的 part 注册与 props 契约测试 |
| `display-context` | §5.1 新增件的焦点测试 |
| `ui-state` | **无新增测试** —— 本包不修改。S-19 归 `render`（`useUiVariable`）与 `sample-console`（真实链路），验的是**既有 module reader** 经注入后可用，不是新 selector |

### 9.2 场景判据

| # | 判据 |
| --- | --- |
| S-1 | 开机后 PRIMARY 为 `staff-login`；**双屏时 SECONDARY 为 `customer-welcome`，不得是 `container-empty` 兜底** |
| S-2 | 登录失败时 alert 层在场，且 session slice **未**变为 `authenticated` |
| S-3 | 登录成功后 PRIMARY 为 `member-list`，**且该导航由 `sample-member-desk`（ui 层）监听 `loginSucceededCommand` 的 actor 发出** —— `kernel/feature` 侧不得出现该 partKey |
| S-4 | 【双屏】进表单后 SECONDARY 由 `customer-welcome` 换为 `customer-member`，props `mode` 为 `'preview'` |
| S-5 | 【双屏】主屏写入 uiVariable 后**副屏部件读到同值** |
| S-6 | 【双屏】提交后 PRIMARY 为 `member-list`、`waiting-confirm` 层在场、SECONDARY 为 `confirm` 形态，**三者同时成立** |
| S-7a | 顾客确认后会员进入 `members`、`pending` 为 `null`、等待层消失、【双屏】副屏回待机 |
| S-7b | 【双屏】standard 与 alert 两层同时在场，**且 alert 排在 standard 之后**。⚠️ 单屏下同时只有一层，验不到排序（§4.4） |
| S-8 | 关层后回到 `member-form`，**两个登记 uiVariable 值仍在** |
| S-9 | 退出后 **PRIMARY 与 SECONDARY 两个 displayMode 的层都被清空**。⚠️ **夹具必须先制造两屏残留层再 logout**（Codex review N-3）：✅ 亲验 `showScreen` 的 reducer **不清 layer**，若从干净态直接退出，该断言是 vacuous pass |
| S-10 | 真实组装后 `status === 'started'`，且 **§6.7 的九项 modules 清单逐个断言 descriptor 在场**：三个 base descriptor（`contracts`／`platform-ports`／`state`）＋ `display-context` ＋ `ui-state` ＋ 四个 sample module。**缺一即红**，部分组装不得通过。⚠️ `kernel.base.runtime` 由 `createRuntime` 自动加入，单独断言其在场 |
| S-11 | **真实 root 经 `selectScreen` 读出 `showScreenCommand` 写入的 placement** —— 头号目标 |
| S-12 | **重启后** `members` 与 `sample.login.operator-name` 仍在；`sample.login.passcode` 与两个登记变量已消失。⚠️ **「重启」按段各有确切含义，不得含糊**：Web 段＝**刷新页面**（进程与 JS 上下文重建）；真机段＝**杀进程后重开**。⚠️ **两段都必须是真持久化**——Web 段用 `test-expo` 绑的 Web 侧 `StateStoragePort`、真机段用 MMKV；**不得用内存态端口跑此判据**（§2.1a 第 3 条：那会假绿） |
| S-13a | **全 unavailable 矩阵**：10 个 binding 全为 unavailable/memory ⇒ 屏数未知 ⇒ **单屏**。此时 S-1／S-2／S-3／S-7a／S-9 的**单屏形态**成立，且 §4.4 的三处差异按单屏走 |
| S-13b | **双屏矩阵**：仅 `device` 绑一个返回 `displayCount: 2` 的实现、其余九个 binding 仍 unavailable/memory ⇒ S-4／S-5／S-6／S-7b 成立。⚠️ 两个矩阵**不可合并** —— 全 unavailable 时双屏场景在定义上不可达（W-7 的 `?? 1` 降级） |
| S-14 | 五类兜底：`runtime-unavailable` 与 `container-empty` 运行时可达；`missing-catalog-entry` / `missing-renderer` / `invalid-props` 由**测试构造坏 catalog** 覆盖，**不在运行时页面放坏部件** |
| S-15 | **三个**层部件（`sample.auth.notice`／`sample.desk.waiting-confirm`／`sample.desk.registry-notice`，均 `containerKeys: []`）不出现在 `selectAvailableParts('main', …)`；屏级部件按 context 正确出现（Codex review S-3，`CONFIRMED`：v6 写成「四个」） |
| S-16 | **单屏形态**：屏数为 1 时 `customer-member` 出现在 PRIMARY 且无 `waiting-confirm`；屏数为 2 时出现在 SECONDARY 且 PRIMARY 有 `waiting-confirm`。**同一部件、同一 props 形状**。⚠️ **两段都要验**：Web 段用 `test-expo` 注入的 `DevicePort` 造出 1／2 两种屏数；真机段用**真实双屏设备**复验，且此时屏数来自 `adapter-android-device` 的真实 `getDisplayInfo`。**Web 段结果不得当作最终 PASS**（§11.1） |
| S-17 | **屏数未知不崩**：`readDisplayInfo` 返回 `unavailable` 或 `malformed` 时 `resolveSecondarySurfaceAvailable` 为 `false`（降级单屏），actor **不抛错**、流程继续走单屏分支。⚠️ 本判据验的是**降级路径本身**，故仍需一条注入 `unavailable` 端口的用例；**但它不得成为 S-16 的替代** —— 真实屏数路径必须另有 S-16 的真机证据 |
| S-18 | `resolveSecondarySurfaceAvailable` 的**四个分支各一条断言**：`valid` 且 `>= 2` → `true`；`valid` 且 `== 1` → `false`；`unavailable` → `false`；`malformed` → `false`。红向量改这个纯函数 |
| S-19 | **W-8**：部件经 `useUiVariable(declaration)` 读到已注册变量的值（**开局为默认值、尚未写入时也必须读到**）；对同 key、改 `defaultValue` 的 forged 声明**抛错**。⚠️ 两条缺一不可 —— 前者证明未误拒，后者证明未放过（M-1 的两个失败方向） |
| S-20 | **W-11**：部件经 `useDispatchCommand()` 派出的 `public` 命令能被 actor 承接；未带 `requestId` 时抛 `ERR_TER_RUNTIME_REQUEST_ID_REQUIRED` |
| S-21 | **W-9**：同一 root 下 selector 引用变化时 `useUiStateSelector` **重新求值**；模块级稳定 selector 仍返回同一引用 |
| S-22 | **`TR-02`**：`loginCommand` 校验失败时该 request 在 ledger 中记为**失败**，且 session slice 未变 |
| S-23 | 部件观察 request：未完成显示 loading、完成去 loading；**loading 期间重复点击不产生第二条 request** |
| **S-24** | **两个 Provider 并存**（`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 的核心，现有 render 测试**零覆盖**）：同一 runtime 喂两个 `RenderProvider`，① 各自的 snapshot reader 与诊断 reporter **互不干扰**（一侧的 `missing-renderer` 不影响另一侧的去重 Map）；② 一次 store 变更**两侧都重渲染**；③ 卸载其中一侧后另一侧仍正常、且 runtime 的订阅数正确回落。红向量：把 Provider 的 `useMemo` 依赖改成常量使两实例共享 reader ⇒ 必红 |
| **S-25** | **形态切换**（§6.7a）：外壳按钮在干净态下从单屏切到双屏后重跑场景 4–7，双屏路径成立；切回单屏后重跑，单屏路径成立。**runtime 与已登记会员跨切换保留**。⚠️ 不要求流程中途切换可用（那属押后的热插拔） |
| **S-26** | **surface 尺寸与排布**（§6.7b）：外壳按 `terminalSurfaces` 声明的逻辑尺寸渲染两棵树，① 浏览器 resize 后两棵 surface 的**宽高与宽高比不变**；② `layout` 改 `row`／`column` 后排布方向随之改变；③ 两个 displayMode 各自用**自己**那组尺寸（不共用一组）。红向量：把外壳容器改成 `flex: 1` 跟随视口 ⇒ ① 必红 |
| **S-27** | **`dual-screen` 单机双屏启动**（§2.1c，**只能在第二段真机验**）：① 单屏设备上启动器**不拉起**副屏 Activity（`displays.size < 2` 直接 return）；② 双屏设备上副屏 Activity 被拉到**正确的 displayId**；③ 主屏收到 `displayIndex = 0`、副屏收到 `1`，两者 `displayCount` 均为实际屏数；④ **重复调用启动器不产生第二个副屏实例**（幂等）；⑤ `registerRootComponent` 仍是同步调用（源码断言，不得被改成异步） ；⑥ **副屏与主屏同属一个 JS VM／一个 store** —— 可证伪形式：主屏 dispatch 一条命令后**副屏读到同一 store 的新值**；两侧各自持有独立 store 则必红。这是 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 的真机对应物（§2.1c 末段） |
| **S-28** | **`device` 的真实 `getDisplayInfo`**（**只能在第二段真机验**）：单屏设备返回 `displayCount = 1`、双屏设备返回 `2`，且 `readDisplayInfo` 判为 `valid` 态。⚠️ **这条与 S-27 必须分别验**：S-27 证明 Kotlin 侧把屏拉起来了，S-28 证明**业务侧那条通路**也读到了真实屏数 —— §2.1a 第 2 条的假绿正是两者只有其一时发生的 |
| **S-29** | **`persist-kv` 的 MMKV 落盘与值编码**（§2.1b）：① 五类值（`null`／布尔／数字／字符串／对象）写入后读回**类型不变**；② `null` 与字符串 `"null"` **可区分**；③ 杀进程重开后值仍在。红向量：把类型信封去掉、直接存 `String(value)` ⇒ ① ② 必红 |

### 9.3 设计模式判据（与功能判据同等级，不可为凑功能豁免）

| # | 判据 | 手段 |
| --- | --- | --- |
| P-1 | 六个 sample 包生产文件中 `dispatchAction` / `store.dispatch` / `useDispatch` **零命中**（`features/actors/**` 除外） | 禁止句（V-1） |
| ~~P-2~~ | **已撤回。** v1 写「部件中 `useState` 零命中」是我自己发明的禁令；`TR-01` 只禁 `dispatchAction`／`store.dispatch`／`useDispatch`。✅ 亲验 POC v1 `useLogin.ts` 用 `useState` 持有 requestId —— 那是**本次交互的瞬时句柄**，不是业务可见状态。准确规则：**表单值与业务可见的界面状态必须走 uiVariables**，瞬时句柄不在此列，归 P-7 review | — |
| P-3 | `sample-*` 业务与集成源码中 `displayCount` 字面量与 `?? 1` 降级**零命中**（一律走 `resolveSecondarySurfaceAvailable`）；`sample-console/test-expo/**` 端口绑定层**除外** | 禁止句（§8a N-2） |
| P-4 | sample 源码中 `Platform.OS` / `typeof window` / UA 嗅探标识符**零命中** | 禁止句（§8a N-3） |
| P-5a | **方向机械门**：§2.5.1 的五类逆向依赖**零命中**（kernel→ui／kernel→adapter／kernel→assembly／ui↔adapter／ui·adapter→assembly） | ✅ 依赖图。⚠️ **不得退回 v7 的「与白名单逐条一致」写法** —— 那会让每条合法新边误红（§2.5 开头的说明） |
| P-5b | **同层耦合 review**：J-1（两个 `ui/feature` 互不 import）· J-2（两个 `kernel/feature` 互不依赖）· J-3（两个 `kernel/feature` 不依赖 `ui-state`） | ❌ review（§2.5.3）。⚠️ 这三条是**本轮设计判断，不是架构原则**，报告时不得表述为「违反 `TR-12`」 |
| P-5c | **`state` 边的能力来源门**：两个 `ui/feature` 与 `render` 按 TypeScript AST import 来源拒绝 state store 构造/句柄、`StateRoot`、完整 `Runtime`／`createRuntime`、`react-redux`、reducer/slice 构造及 render 不应拥有的 owner 能力；UI feature 从 runtime 导入自有 `defineCommand`/`RuntimeModule` 为正控制 | ✅ import 断言＋正控制（§2.5.4 末段） |
| P-5d | **`ui/feature` 只能以组件值调用 `createElement`**：生产源码中从 React 导入的 `createElement`（含命名别名／React 命名空间别名）不得以字符串字面量类值作为第一个参数；部件必须经 typed primitives 以 JSX 构建，不能回退为字符串 host tag | ✅ TypeScript AST 机械门＋临时夹具上的真实字符串/模板串标签 red mutation；当前生产树清洁另行证明；非字符串组件值为正控制 |
| ~~P-6~~ | **本轮不适用。** v5 撤销 slice 方案后**本轮没有任何事件桥** —— 屏数由 actor 实时 await 端口求值（§5.1）。播种／去重登记为**将来补 `subscribeDisplayStatus` 时的必办项**（`TR-11` 明载）。⚠️ V-9 因此在本轮无对应机械判据，但**规则本身仍然有效**，将来建桥时必须遵守 | — |
| P-7 | **V-2 / V-3 / V-4 / V-5 / V-6 / V-7 逐条书面回答** | ❌ 不可机械判定，实施评审必须逐条作答。⚠️ V-4（表单值存 `useState`）在此 —— 禁止句无法把它与合法的 requestId 瞬时句柄区分开 |
| P-8 | **无竞态**：不存在「两个模块的 actor 监听同一命令、其中一方读取另一方本次写入的 slice」的形态 | ❌ review（§3.6）。红夹具：把 §7.1 的因果链改回「同听 `loginCommand`」，S-3 应变得不稳定 |
| P-9 | 部件源码中**零 `if` 分支依赖屏数**；单屏／双屏分支只在 `sample-member-desk` 的 actor 内 | ❌ review（§4.4） |
| **P-10** | **灵魂判据**：两个 `kernel/feature` 包源码中 `partKey`／`containerKey`／`displayMode` 字面量**零命中** | ✅ 禁止句（§2.5.2 · §3.5）。⚠️ 依赖那半已归 P-5a，此处不重复 |
| P-11 | **按 visibility 判定**：从部件或 `install` 发起的 **`public`** 命令派发点必须显式带 `requestId`；**`internal`** 命令不要求；actor 内的子命令**验证继承**（不显式给，或给与父相同的值）。⚠️ 例外：`install` 派 internal 命令若其 actor 会派出 public 子命令，则该 internal 命令**也必须带** requestId（§6.3） | ⚠️ 半机械 —— 逐点判 visibility，不可写成「所有 `dispatchCommand(` 必须出现 requestId」的一刀切禁止句（会误伤合法 internal） |
| P-12 | `ui/feature` 的 actor **不得监听 `kernel/feature` 的请求命令**（`loginCommand`／`logoutCommand`／`submitMemberCommand`／`confirmMemberCommand`／`rejectMemberCommand`），只监听 kernel 派出的**领域事件命令**。⚠️ **允许**监听本包自有的呈现请求命令（`memberFormOpenedCommand`／`noticeDismissedCommand`／`authNoticeDismissedCommand`）—— 那不跨包、无并发对手 | ✅ 禁止句（按命令来源包判定）＋ ❌ review（§3.6 并发理由） |
| P-13 | render 的 TypeScript AST import-capability 门继续拒绝 `getStore` / `dispatchAction` / `useDispatch` 来源、`react-redux`、state store/句柄及 reducer/slice 构造；W-11 合法的窄 `dispatchCommand` 与 `useDispatchCommand` 不得被误禁 | ✅ import 断言＋W-11 正控制 |
| **P-14** | **业务包对尺寸零感知**（§6.7b 边界）：六个 sample 业务／集成**库侧**源码中 `terminalSurfaces` 与尺寸字面量（`1920`／`1080`／`1024`／`600`）**零命中**；`sample-console/test-expo/**` 与 `package.json` **除外** | ✅ 禁止句。红向量：在任一 part 里写一个尺寸字面量 ⇒ 必红 |

### 9.4 红向量要求

每条 S 与每条可机械判定的 P 至少一条能使对应行为或门失败的 red mutation，并验证 negative 变红、**control 保持绿**。
对业务行为和生产源码约束，red mutation 改生产源码且不改夹具；对纯静态 AST 模型门
（本轮的 P-5d），red mutation 允许作用于一次性临时夹具，以证明门能抓住该语法形态，
并另行证明当前生产树无违规。两类证据不得合并表述，临时夹具必须在测试内清理。

沿用 `tools/terminal-ui-render/check-behavior.mjs` 已验证有效的三道自保：
① `replaceOnce` 锚点出现次数恰为 1；② mutation 前先跑 baseline；
③ **判红前先断言 focused test 收集数非零**。

### 9.5 明确不作为测试手段

- ❌ 不以「人眼在浏览器里看过了」充当判据；
- ❌ S-10 / S-11 全链路**禁止 mock** `ui-state` 或 `runtime`；
- ❌ 不以 `expo start --web` 能启动充当行为证据；
- ❌ **不得以「门全绿」替代 P-7 / P-8 / P-9 的逐条 review**。

---

## 10. 框架观察项（实施后回答，本文不预设计解法）

| # | 观察 | 说明 |
| --- | --- | --- |
| W-1 | **一个业务动作要派 3–4 条 ui-state 命令，且每个业务动作都要额外造一条领域事件命令** | 见 §7.2：`loginCommand` → `loginSucceededCommand` → 两个 ui actor 各自派 2–3 条 ui-state 命令。领域事件是 `TR-12` 的必要代价（kernel 不能知道 partKey），但**一次点击要走三跳**是否过重，实施后回答 |
| W-2 | `clearLayers` 只清一个 displayMode | 场景 9 必须派两次。可能缺一个「清全部」形态 |

⇒ 实施完成后，Codex 须在交付中**正面回答 §1.1 的三个问题**，并对 W-1／W-2 给出结论。
这是本轮的主要产出之一，不是附带。

---

## 11. 分刀

| 刀 | 内容 |
| --- | --- |
| **一** | 本文全部内容：场景 1–9 ＋ 单屏／双屏两形态 ＋ §5 的 TER 优化 ＋ §2.3 的**全部 B 项前置** ＋ 三个 adapter（`dual-screen` 单机双屏启动 · `device` 的 `getDisplayInfo` · `persist-kv`）。**Expo Web 与真机双屏都要验** |
| **二** | `instanceMode` / `displayRole` 切换、`workspace` 分区、切换资格 reasonCode |
| **三** | `dual-screen` 的 **localWebServer** 与双机 pair 拓扑；其余 adapter 逐个替换端口表 |

⚠️ v7 的第三刀原本是"真机 Android"，v8 **消解**它：真机不再是一个独立阶段，
而是第一刀的**验证环境之一** —— 因为本轮已经要建三个 adapter，押后真机就等于押后它们，
又回到"在 sample 里凑合"。第三刀改为承载 localWebServer 与双机拓扑。

### 11.1 执行顺序：Web 全绿之后才上真机（Dexter 2026-09-04 同意）

**这不是把真机押后，是排执行顺序。** 同一刀内分两段：

```
第一段（Web）：场景 1–9 ＋ 全部 S/P 判据在 Expo Web 上跑绿
               此时 device 用 test-expo 注入的实现、persistKv 用 Web 侧真实持久化
                 ↓ 全绿才继续
第二段（真机）：切到真机双屏，验 dual-screen 的单机双屏启动、
               device 的真实 getDisplayInfo、persist-kv 的真实落盘
```

**理由**：本轮**第一次引入 Kotlin 与真机验证**，失败面显著变大。若两段混跑，
一条判据红了分不清是接线、Kotlin 还是设备。分段之后，第一段红＝接线问题，
第二段红＝原生或设备问题。

⚠️ **S-27／S-28 是真机段专属判据**：Kotlin 拉起副屏 Activity、`launchDisplayId`、
真实 `getDisplayInfo` 在 Web 上都不存在，**第一段无法给出任何前置证据**，
不得以「Web 段已验双屏内容分区」代证。

⚠️ **S-25（形态切换）是 Web 段专属判据**：它验的是外壳的开发设施（§6.7a），
真机上不存在这个按钮，故**不进第二段复验清单**。

⚠️ **第一段绿不等于该判据已完成** —— 凡涉及 `dual-screen`／真实 `device`／真实 `persist-kv`
的判据（S-12 · S-16 · S-17 · S-24 · **S-27 · S-28 · S-29** 及场景 4–8 的双屏路径），**必须在第二段复验**，
第一段的 Web 结果只作为接线正确性的前置证据，**不得当作最终 PASS**。

**范本不许有临时写法**：part 的 `displayModes` 从一开始写真实值、
`SampleAssembly.createSurface` 的 displayMode **参数化**。

⚠️ **「不硬编码 `'PRIMARY'`」的范围限于 `ui/integration` 与 `assembly`**（Codex review S-11）：
`ui/feature` 的 part 声明与 actor 必然出现 `'PRIMARY'`／`'SECONDARY'` 字面量 ——
那是它们的业务事实（店员看的 vs 顾客看的），不是硬编码。
integration／assembly 侧的 displayMode 只能来自 `SampleAssembly.createSurface` 的入参，
该入参由**宿主**给出：Web 外壳按 `resolveSecondarySurfaceAvailable` 决定挂一棵还是两棵并各自传值；
真机侧来自 Kotlin 按屏传的 `initialProps`（本轮第二段，§11.1）。

## 12. 文档性质

正式需求。**不构成设计或实施授权** —— Codex 应先出 IA/详设与实施计划，
经 Dexter 与 Claude review 后另行授权实施。

标 ✅ 的事实均为本次会话打开源码亲验；未标注者为设计规定或推论。
§10 的「实施后回答」是**有意留白**，不得在设计阶段预先设计解法。
