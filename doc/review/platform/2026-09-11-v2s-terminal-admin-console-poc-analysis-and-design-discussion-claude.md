# TER admin console 讨论稿 · 两版 POC 逐行分析

- 日期：2026-09-11（第九版,已并入 Dexter 八轮裁定;含合并批次的依赖顺序） · 作者：Claude · 状态：**讨论稿,非需求,非评审结论,不授权任何实施**
- 分析对象（只读）：
  - POC-A：`/Volumes/idea/_old_/2-ui/2.1-cores/admin`（`@impos2/ui-core-admin`,src 5,407 行）
  - POC-B：`/Volumes/idea/newPOSv1/2-ui/2.1-base/admin-console`（`@next/ui-base-admin-console`,src 7,328 行）
  - POC-B 的真实接入点：`newPOSv1/2-ui/2.3-integration/catering-shell/src/ui/screens/RootScreen.tsx`
- 目标对象：`catering-v2s/apps/terminal`
- 标注：`已亲验` = 打开源码读过；`推论` = 由已验事实推出；`待裁决` = 需要 Dexter 决定

---

## 1 · TER 现状（已亲验）

`apps/terminal/ui/base/admin-shell/` 已存在,但是**空壳**:`src/` 只有 13 行,内容是
`moduleName` 与 `dependencies`,没有任何实现。依赖边已经声明好了:

```
ui.base.admin-shell → platform-ports · runtime · state · render · primitives · ui-state
```

骨架设计里还规划了 `ui.integration.platform-console`。所以本次是**在已声明的边内填实现**,
不是新建包,也不需要动依赖图。

---

## 2 · 两版 POC 的注册机制（对应您的需求 2）

### 2.1 POC-A：没有注册机制

`_old_/2-ui/2.1-cores/admin/src/ui/modals/AdminPopup.tsx` 共 985 行,其中约 600 行是内联
`StyleSheet`。它的内容装配方式是:

- 第 63 行起 `menuItems` 是一个**七元素字面量数组**,key 类型 `MenuKey` 是闭合 union;
- 第 7 个屏幕全部在文件顶部**直接 import** 自 `../screens/*`,同包内;
- 渲染是**七分支 if 链**:`{selectedMenu === 'device' ? <DeviceStatusScreen /> : null}` × 7;
- `src/ui/moduleScreenParts.ts` 的内容是 `export const uiCoreAdminScreenParts = {}` —— **空对象**;
- `src/application/modulePreSetup.ts` 是**空函数体**。

也就是说,模块系统给了它两个注册接缝（`screenParts` 与 `modulePreSetup`）,POC-A **两个都没用**。
业务内容与框完全焊死在同一个包、同一个文件里。

> **这与您需求 2 里「第一版 POC 的 admin console 应该就是这种机制」不符。** 如果「第一版」指
> `_old_`,那它恰恰是反例。如果您指的是 `newPOSv1`,那注册机制确实存在,但形态是
> `replace` 而不是 `register`,见 §2.2,仍然不是「业务模块把内容注册进去」。

### 2.2 POC-B：有 registry,但是 replace-only 的模块级单例

`newPOSv1/.../admin-console/src/supports/adminSectionRegistry.tsx`（112 行,已亲验全文）:

```
sharedAdminConsoleSectionRegistry = (() => {
    let sections = [...createDefaultAdminConsoleSections()]
    return { list() {...}, replace(nextSections) { sections = [...nextSections] } }
})()
```

对外只导出 `getAdminConsoleSectionRegistry()`、`installAdminConsoleSections(sections)`、
`resetAdminConsoleSections()`。三个问题:

1. **只有 `replace`,没有 `add`。** 业务模块要加一个 section,必须拿到全量列表、拼上自己的、
   整体替换。多个模块同时想加,最后一个写入者赢,没有 owner 身份也没有顺序契约。
2. **默认列表是九个同包屏幕。** `createDefaultAdminConsoleSections()` 里九个 `render` 全部
   import 自 `../ui/screens/*`,合计约 4,000 行。所谓「框」自带了全部内容。
3. **模块级可变单例。** 一个 JS runtime 内只有一份。这一条对 TER 是硬伤,见 §4.2。

而且 registry 并不是唯一一层。实际装配是**三层,全部在 admin-console 包内**:

| 层 | 文件 | 形态 |
|---|---|---|
| tab 目录 | `foundations/adminTabs.ts` | 九元素字面量 + 两个 group 字面量 |
| 屏幕部件 | `foundations/adminScreenParts.tsx` | 由 tab 字面量逐个 `defineUiScreenPart` |
| 渲染表 | `supports/adminSectionRegistry.tsx` | tab → render,可整体 replace |

`AdminConsoleTab` 是 `types/admin.ts` 第 5 行的闭合 union。所以业务模块要新增一个 section,
需要改三个文件,而且三个都在 admin-console 包里。**这是「闭合目录 + 可替换渲染表」,不是开放注册。**

### 2.3 POC-B 里唯一真正的注册:host tools

`supports/adminHostToolsRegistry.ts` 是按 `localNodeId` 分作用域的 Map,提供
`install(localNodeId, partial)` 做**浅合并**而不是替换。这是两版 POC 里**最接近**您要的形态的
一处,而且它已经按节点隔离。但它注册的是**能力**不是**内容**,且 `AdminHostTools`
（`types/admin.ts` 第 302 行）是一个七字段聚合接口:

```
device? logs? control? connector? topology? version? tdp?
```

七个字段的类型全部定义在 admin-console 包内。也就是说**框在声明每一个业务能力长什么样**,
这与「业务模块把内容注册进来」是相反的方向。

---

## 3 · 两版 POC 的调起与门禁（对应您的需求 1）

### 3.1 POC-B 的实际门禁是一个布尔值,而且与您的需求正好相反

`catering-shell/src/ui/screens/RootScreen.tsx` 第 34 行（已亲验）:

```
const standalone = useSelector(state => selectTopologyStandalone(state) ?? true)
const launcherHandlers = useAdminLauncher({
    enabled: standalone,
    onTriggered: () => setShowAdminPopup(true),
})
```

`standalone` 是 topology context 里与 `instanceMode: 'MASTER'|'SLAVE'` **并列**的独立布尔字段
（`topology-runtime-v3/src/types/state.ts` 第 18 行）,语义是「单机」。
`launcherHandlers` 展开在**最外层 root View**（第 108 行）,主副屏两个 RootScreen 实例都挂。

于是实际行为是:

| 场景 | POC-B 行为 | 您的需求 |
|---|---|---|
| 单机双屏 · 主屏 | 可唤起 | 可唤起 ✓ |
| 单机双屏 · 副屏 | **可唤起** | **不可唤起** ✗ |
| 双机 · 主机 | **不可唤起** | **可唤起** ✗ |
| 双机 · 副机 | **不可唤起** | **可唤起** ✗ |

**四种场景里三种是反的。** 这不是参数调优能解决的,是判据维度选错了:它用「是否单机」这一个
维度,而您的规则需要「这块 surface 是不是它所在那台机器的主显示」这个维度。

### 3.2 POC-B 已经有声明式可见性机制,但 admin 全部弃用

`foundations/adminScreenParts.tsx` 里每个 tab 的 screen part 都带:

```
screenModes: ['DESKTOP', 'MOBILE']
workspaces: ['main', 'branch']
instanceModes: ['MASTER', 'SLAVE', 'STANDALONE']
```

九个 tab **全部对三个维度全开**,等于没有过滤。真正的门开在集成层的那个布尔值上。
**机制存在但没被使用**,这是 POC-B 最可惜的一处。

### 3.3 调起手势

`hooks/useAdminLauncher.ts` + `supports/adminLauncherTracker.ts`（已亲验）:
左上角 96×96 区域内,1800ms 窗口里连点 5 次。tracker 是纯函数式、可单测、参数可覆盖,
与 hook 分离得很干净,**这一条值得继承**。

POC-A 没有手势,它的调起点在 shell 里（本稿未追;POC-A 的 `AdminPopup` 只接受 `onClose`）。

---

## 4 · 直接搬到 TER 会坏掉的四处（推论,但依据明确）

### 4.1 手势用的是 `pageX/pageY`,会被逻辑画布的 transform 打偏

`adminLauncherTracker.ts`:`if (event.pageX > areaSize || event.pageY > areaSize) return false`。

TER 现在的承载层对画布施加了 `scaleX/scaleY` 变换。RN 的 `pageX/pageY` 是**宿主窗口坐标**,
不是画布逻辑坐标。副屏 scale 约 1.0016 时影响可忽略,但只要换一台比例不匹配的设备、
或主屏 scale 不为 1,96 这个阈值对应的逻辑区域就会漂移。TER 里这个判据必须用**画布逻辑坐标**。

### 4.2 模块级单例 registry 在 TER 的单 runtime 双 surface 下会串台

TER 主副 surface 共享同一个 JS runtime。POC-B 的 `sharedAdminConsoleSectionRegistry` 是模块级
`let`,两块屏看到的是同一份。POC-B 自己在 host tools 那层用了 `localNodeId` 分作用域,
说明作者知道这个问题,但 section registry 没做。这与我们刚处理完的全局 DisplayMetrics 是同一类
故障形态。**TER 的注册表必须按 surface 或按节点分作用域。**

### 4.3 `Platform.OS` 出现在 UI 包里

`useAdminLauncher.ts` 用 `Platform.OS === 'web'` 决定返回 `onClick` 还是 `onTouchEnd`。
TER 的边界纪律是承载层负责平台差异,UI 包不读 Platform。这一处要上移。

### 4.4 事件直接变回调,违反 TR-11

POC-B 是 `onTriggered: () => setShowAdminPopup(true)` —— 外部事件直接调用业务方回调。
TER 的 TR-11 要求外部事件走 `事件 → command → 关心它的业务方自己的 actor → dispatchAction`。
admin console 的「被唤起」是典型的外部事件,必须走 command。

---

## 5 · 两版 POC 值得继承的部分

| 来源 | 做法 | 为什么好 |
|---|---|---|
| POC-B | 时间派生口令:`deviceId + YYYYMMDDHH` 哈希取 6 位,校验接受 ±1 小时 | 无硬编码、无需联网、每台机器不同、每小时轮换 |
| POC-B | launcher tracker 与 hook 分离,纯函数可单测 | 手势判据可以脱离 UI 验证 |
| POC-B | host tools 按 `localNodeId` 分作用域 + 浅合并 install | 双机下天然隔离,合并而非替换 |
| POC-B | section render context 传 `{runtime, store, closePanel, hostTools}` | section 不需要 import 具体依赖 |
| POC-B | 九个 scenario spec 文件 | 有行为测试而不是只有渲染测试 |
| POC-A | 登录页放设备 ID 二维码 | 远程核验、报障时可直接扫码 |
| POC-A | `connector` tab 按 `displayIndex === 0` 过滤 | 早期就意识到要按显示位置区分能力 |

POC-B 的口令方案有一处需要 Dexter 判断:派生用的是 `hash * 131` 这种非密码学哈希,且同时接受
三个小时窗的口令。对 POS 的管理入口是否够,取决于威胁模型,见 §7。

---

## 6 · Dexter 裁定（2026-09-11）

| 编号 | 裁定 |
|---|---|
| Q-1 | 本稿对两版 POC 的识别正确,§2 与 §3 不必重读 |
| Q-2 | 双机副机显示的是**本机注册**的内容,不做跨机聚合 |
| Q-3 | **有副屏的机器不能作为副机** |
| Q-4 | admin console 渲染在**逻辑画布之内** |
| Q-5 | 鉴权沿用 POC-B 的时间派生口令 |
| Q-6 | 入口一律隐藏,**只有手势**,没有可见控件 |
| Q-7 | admin-shell **自带** `kernel/base` 的配置与测试功能,与 POC 一样；`kernel/feature` 的管理页面由对应的 `ui/feature` 包注册进来 |

---

## 7 · 裁定引出的形态（本稿最重要的一节）

### 7.1 不要造新的 registry —— TER 已经有了,而且比 POC-B 好

Q-7 要的「ui/feature 把管理页面注册到 admin-shell」,TER 现有机制已经能直接表达,
**不需要 POC-B 那套三层目录加可替换渲染表**。已亲验的现有惯例:

- `ui/base/render/src/foundations/definePart.ts` 的 `definePart({partKey, rendererKey,
  containerKeys, displayModes, workspaces, instanceModes, title, description, layerTier, layerGuard})`;
- 每个业务包在 `src/parts/parts.ts` 声明自己的 part,例如
  `ui/feature/sample-member-desk/src/parts/parts.ts` 第 19 行起的五个 part；
- 集成层在 `ui/integration/sample-console/src/assembly/assembly.tsx` 第 149 至 153 行
  **显式展开**各 feature 的 `assembly.parts`,再 `createUiCatalog` + `createRendererCatalog`。

对照 §2.2 与 §4.2 的三个问题,这套机制逐条更优:

| POC-B 的问题 | TER 现有机制 |
|---|---|
| 只有 `replace`,最后写入者赢 | 集成层显式展开数组,天然是 add,冲突在编译期可见 |
| 模块级可变单例,双 surface 串台 | catalog 由 assembly 构造,不是模块级 `let` |
| 没有 owner 身份 | `partKey` 自带包前缀,例如 `sample.desk.member-list` |
| 目录是闭合 union,新增要改框内三个文件 | `partKey` 是字符串,新增 part 只改自己包 |
| 可见性机制全开等于没用 | `displayModes`/`workspaces`/`instanceModes` 是同一个声明的一部分 |

所以建议是:**admin console 的每个 section 就是一个 part,容器键用 `admin.*`。**
「注册」= 该 feature 的 part 数组被集成层展开进来,与业务 part 完全同一条路径。
admin-shell 只需要提供容器与导航,不需要自己维护任何目录。

### 7.2 Q-7 的分工落到包上

- `ui/base/admin-shell` 自带 `kernel/base` 九个包的配置与测试 section。
- `ui/feature/<名字>` 各自声明自己的管理 part,容器键 `admin.*`,由集成层展开。
- admin-shell **永远不 import 任何 `ui/feature`**,方向只能是 feature → admin-shell 的容器键。

**依赖边缺口（已亲验,需要补）**：`kernel/base` 现有九个包
（contracts · display-context · platform-ports · runtime · state · test-support · transport · ui-state · workflow）,
而 admin-shell 的 `src/dependencies.ts` 只声明了六个,**缺 contracts、display-context、transport、workflow**。
其中 display-context 是 §7.3 的门禁必需项,不只是内容需要。

### 7.3 门禁:`displayIndex === 0`,而且 `displayMode` 明确不可用

Q-3 的约束在仓内**已经落地**（已亲验）:`display-context/src/foundations/displayDerivation.ts`
第 52 行 `getSwitchInstanceModeEligibility` 在 `displayCount !== 1` 时返回
`multiple-physical-displays` 拒绝,并由 `switchInstanceModeActor.ts` 第 62 行实际使用。
所以「有副屏的机器不能作为副机」不是待办,是现有不变量,门禁可以依赖它。

于是判据是:

```
可唤起 admin console  ⟺  displayIndex === 0
```

**`displayMode` 不能用作判据,有两个独立理由:**

1. `resolveSurfaceDisplayMode`（第 5 行）把「同机第二块屏」与「副机」合并成同一个 `SECONDARY`,
   而需求 1 恰好要区分这两者。
2. 更糟的是它**会随电源线跳变**。`resolvePowerRoleTarget`（第 57 行）规定:SLAVE 且单屏时,
   接外电且当前 CHIEF → 切 VICE；用电池且当前 VICE → 切 CHIEF。而 VICE + SLAVE → `SECONDARY`。
   也就是说**副机插上电源线,`displayMode` 就从 PRIMARY 翻成 SECONDARY**。
   若门禁挂在 `displayMode` 上,店员插个电源线 admin 入口就消失了。`displayIndex` 是硬件事实,不跳变。

**结构缺口（已亲验）**：`displayIndex` 目前**在整个 UI 层拿不到**。
`ui/base/render/src/contexts/SurfaceContext.ts` 只暴露 `displayMode` 与 `containerKey`,
在 `ui/base/**` 全量搜索 `displayIndex` 零命中。它只存在于 assembly 边界
（`createSurfaceForDisplayIndex`）。**这是需求 1 唯一需要的结构性新增**:把 `displayIndex`
（或一个等价的 `isHostPrimaryDisplay` 派生布尔）纳入 surface 承载事实,由 render 提供给 UI 层。

倾向后者:UI 层不需要知道索引数字,只需要知道「我是不是本机主显示」,语义更窄,也更难误用。

### 7.4 Q-4 画布内 —— 风险比原稿估计的小,但有一条新约束

原稿 §6.4 担心「副屏上 admin 文字太小」。结合需求 1 与 Q-3,**这个担心不成立**:
admin console 只在 `displayIndex === 0` 的 surface 上被唤起,永远不会渲染在同机副屏上。

但产生一条新约束。双机时副机也能唤起,而副机的 `displayMode` 会随电源线在 PRIMARY 与 SECONDARY
之间跳变（§7.3 第 2 点）,对应的固定画布声明也随之在 `1280×800` 与 `960×540` 之间切换。
因此 **admin console 必须在这两个画布下都能正确排版**,不能只按主屏 16:10 设计。
这同时意味着画布声明是**可能在运行时切换**的,承载层已有的 scale 重算能覆盖,但业务与 admin
的布局必须容忍这一点 —— 这一条超出 admin console 范围,建议单独记一笔。

### 7.5 Q-5 沿用时间派生口令 —— 两点须知,不是反对

沿用即可,但把两个性质记下来,免得日后当成疏漏:

1. 派生用的是 `hash * 131` 的非密码学哈希,且校验同时接受前后各一小时,任一时刻有**三个有效口令**。
   知道 deviceId 的人可以离线算出口令。这是「防误触与防店员乱点」级别的门,不是防攻击者的门。
2. POC-B 的 `createAdminPasswordVerifier` 要求 **同步** 的 `deviceIdProvider`,拿到 Promise 会抛错。
   而 TER 的 `DevicePort.getDeviceInfo` 是异步的。接入时必须先把 deviceId 解析好再喂进去,
   或者把 verifier 改成异步。这是一个具体的接线点。

### 7.6 Q-6 入口全隐藏 —— 手势判据与自动化

手势沿用 POC-B 的 tracker 形态（纯函数、可单测、参数可覆盖）,但按 §4.1 必须改用**画布逻辑坐标**,
不能用 `pageX/pageY`。判定区与阈值应当以逻辑单位表达,这样两个画布、两端都一致。

入口全隐藏带来一个副作用:**自动化测试没有可见控件可点**。POC-B 的做法是在
`RootScreen.tsx` 第 70 行起给 launcher 注册了一个 automation 节点,role 为 button、
text 为「管理员入口」,并挂 `onAutomationAction`。TER 有 `ui/base/automation`,
建议同样提供一个仅自动化可见的触发节点,否则 admin console 的行为验收只能靠手点。

---

## 8 · 本轮新产生的待裁决问题

| 编号 | 问题 | 为什么必须您定 |
|---|---|---|
| Q-8 | §7.3 建议向 UI 层暴露的是 `displayIndex` 数字,还是 `isHostPrimaryDisplay` 布尔?本稿倾向后者 | 决定 surface 承载事实的公共面 |
| Q-9 | admin-shell 自带的 `kernel/base` section 覆盖到哪几个包?九个全要,还是先做一部分? | 决定本轮工作量与依赖边补齐范围 |
| Q-10 | admin console 的 section 使用独立容器键 `admin.*`,与业务容器完全分开,是否符合预期? | 决定 catalog 的容器划分 |
| Q-11 | 副机画布随电源线在 `1280×800` 与 `960×540` 之间切换（§7.4）,这是既有设计的预期行为吗?还是本身需要单独处理? | 超出 admin 范围,但会影响 admin 布局约束 |
| Q-12 | 是否需要仅自动化可见的触发节点（§7.6）? | 决定 admin 行为能否进自动化验收 |

---

## 35 · 本稿的边界

本稿只做事实盘点与形态讨论,**不含 GO/NO-GO,不构成需求,不授权实施**。
§2、§3、§7 中标注已亲验的事实均已打开源码核对并给出路径与行号;
§4、§7.4 中的推论未经运行验证。TER 侧只读取,未做任何写入。

---

## 10 · Dexter 第二轮裁定（2026-09-11）

| 编号 | 裁定 |
|---|---|
| Q-8 | 向 UI 层暴露 `isHostPrimaryDisplay` 派生布尔,不暴露 `displayIndex` 数字 |
| Q-9 | **先做一部分**,现在哪些 `kernel/base` 具备条件就做哪个 |
| Q-10 | admin section 使用独立容器键 `admin.*`,与业务容器分开 |
| Q-11 | 副机画布随电源线动态切换是**预期行为**,需要支持动态切换 |
| Q-12 | 需要自动化触发节点,但 automation 包尚无功能,**当前与其他业务页面一致即可** |

---

## 11 · Q-9 的具体答案:现在能做哪几个（已亲验）

逐个打开 `apps/terminal/kernel/base` 的九个包核过导出面与目录后的结论:

| 包 | src 文件数 | 现在可管理的东西 | 建议 |
|---|---|---|---|
| platform-ports | 27 | 十个具名端口,每个可判定「已注入」还是 `ADAPTER_NOT_INJECTED` | **首批** |
| runtime | 54 | journal、lifecycle、module order、command/request 聚合状态、两个 accessor registry、启动诊断七组 | **首批** |
| display-context | 23 | displayRole、instanceMode、displayInfo、切换判据与 command | **首批** |
| state | 23 | 持久化 hydration/engine/codec、keyspace、partition、workspace、sync | 次批 |
| ui-state | 26 | catalog、layers、screen、available parts | 次批 |
| contracts | 14 | 主要是类型、错误模板与时间戳,运行时可观测面很少 | 暂不做 |
| transport | 3 | **空壳**,只有 `moduleName` 与 `dependencies` | 不做 |
| workflow | 3 | **空壳**,同上 | 不做 |

`test-support` 是 dev-only,不计入。

### 11.1 首批三个的依据

**platform-ports 是最有价值的一个,而且立刻能验证。**
`src/types/result.ts` 第 5 行 `PlatformPortName` 是十个具名端口的闭合 union:
`logger · persistKv · persistSecure · device · appControl · script · connector · hotUpdate · logUpload · topologyHost`。
`src/defaults/createUnavailable.ts` 让未注入的端口返回
`{status: 'unavailable', reason: 'ADAPTER_NOT_INJECTED', message}`,
所以**端口是否已注入是运行期可判定的事实**,不需要新增基建。

这一节还有一个直接收益:我们在 Android 验收截图上反复看到的那个持久化浮层,
根因就是 `persistSecure` 未注入。有了这一节,这类问题第一时间能自己看出来,
不用每次靠翻日志。

**runtime 的可观测面最厚。** `src/foundations/` 下已有 `createRuntimeJournal`、
`createRuntimeLifecycle`、`createRuntimeResourceRegistry`、`aggregateCommandStatus`、
`aggregateRequestStatus`、`findExpiredRequestLedgerIds`、`resolveModuleOrder`,
以及可读性整改时新建的 `runtimeResourceAccessorRegistry` 与 `runtimeStateSyncAccessorRegistry`。
再加上启动日志的七组分类,已经足够撑起一节「运行时状态」。

**display-context 本来就绕不开。** §7.3 的门禁要靠它,顺手把 displayRole、instanceMode、
displayInfo 与切换判据做成一节,等于门禁的实现与它的可视化共用同一份事实。

### 11.2 首批只需要补一条依赖边

admin-shell 现有六条依赖边里已经含 platform-ports 与 runtime,**只缺 display-context**。
contracts、transport、workflow 三条本轮不做,边也不必补。
这与 §7.2 记的四个缺口相比,首批的实际改动面收窄到一条边。

### 11.3 次批的两个为什么后放

- **state**:持久化状态值得看,但 `persistSecure` 未注入时它本身就是半残的,
  先做 platform-ports 那一节反而能先把根因暴露出来。
- **ui-state**:展示 catalog 与 available parts 有自我诊断价值,尤其是 admin 自己也走 part 注册
  （§7.1）。但它依赖 admin section 注册机制先跑通,所以放在首批之后。

---

## 11A · Q-11 与 Q-12 的落地含义

### Q-11 画布动态切换是预期行为

这条把 §7.4 的约束从「admin 要能在两个画布下排版」升级为**承载层要支持画布在运行期切换**:

- 副机 displayRole 随电源在 CHIEF 与 VICE 之间变化 → `resolveSurfaceDisplayMode` 的结果变化
  → 该 surface 适用的画布声明在 `1280×800` 与 `960×540` 之间切换;
- `SurfaceHostController` 的 `calculateSurfaceHostGeometry` 每次都按 `canvas` 与 `host` 现算,
  所以 scale 会自动跟着变,这一侧不需要改;
- 但**画布尺寸变化会让所有已挂载的业务与 admin 组件重新布局**,
  `InputSurfaceFrame` 的 measured 也会跟着变。切换瞬间的行为（是否闪烁、焦点与滚动位置是否保留、
  IME 是否需要收起）**目前没有任何设计与证据覆盖**。
- 这超出 admin console 范围,建议作为独立条目登记,不要塞进本次。

### Q-12 当前与业务页面一致

`ui/base/automation` 已亲验也是**空壳**,`src/` 只有 10 行。
所以本轮 admin 的调起与页面按普通业务页面处理:给稳定 testID,用与 `ui/feature` 现有页面
相同的 focused test 形态验证。等 automation 包具备能力后,再补仅自动化可见的触发节点。

**但入口全隐藏（Q-6）意味着手势判据必须能脱离 UI 单测。** POC-B 的 tracker 已经是纯函数形态,
TER 沿用这一点即可:判据用画布逻辑坐标、纯函数、参数可覆盖,这样即使没有 automation,
手势逻辑本身也有行为门。

---

## 11B · 到此为止仍未定的事

以下不是新问题,是已知但本稿尚未展开的部分,留待正式需求阶段:

1. admin-shell 外壳本身的形态:导航用 sidebar 还是 tab rail,是否要沿用 POC-B 的 group 分组。
   两个画布宽度差 25%（1280 与 960 逻辑单位）,外壳布局要同时成立。
2. 口令输入用虚拟键盘还是系统键盘。按既有裁定,数字口令走虚拟数字键盘即可,但需确认。
3. section 之间是否需要跳转,还是只能从导航进入。
4. admin console 打开时,底层业务 surface 的状态如何处理:是否暂停、是否保留焦点。

---

## 13 · Dexter 第三轮补充（2026-09-11）

1. APP 需要知道自己是 mobile 还是 laptop/desktop,因为有些 UI 自适应不了要换页面;admin-shell 自身也如此,手持设备上可能不用 tab。
2. 口令输入用虚拟键盘、纯数字,但要**固定六格、一格一位、输满自动前进、退格可跨格**。
3. section 之间**不能跳转**。
4. admin console 是**全屏遮罩**,不影响后面的业务页面,**不暂停,也没有焦点**。

---

## 14 · 设备形态能力（第 1 条）:两版 POC 都没有可用实现

### 14.1 现状核查（已亲验）

| 位置 | 现状 |
|---|---|
| POC-A | `AdminPopup.tsx` 内的 `getLayoutMode(width, height)`,断点 1280/960/900,四态 `mobilePortrait`/`mobileLandscape`/`tablet`/`desktop`。数据源是 `Dimensions.get('window')`,逻辑写在弹窗组件里 |
| POC-B | `ui-runtime-v2/src/types/screen.ts` 第 40 行有 `screenMode: string`,`screenRegistry.ts` 第 13 行按它过滤 part。但全仓只有 `selectors/index.ts` 第 101 行的 `overrides.screenMode ?? 'DESKTOP'`,**没有任何地方计算或写入 'MOBILE'** |
| TER | `UiCatalogEntry`（`kernel/base/ui-state/src/types/catalog.ts` 第 8 行）只有 `containerKeys`/`displayModes`/`workspaces`/`instanceModes`,**没有形态维度**。input 包只在 `keyboardHeight.ts` 里派生 `orientation` 与 `capacity`,阈值 `MIN_SUPPORTED_FRAME_WIDTH` 是键盘局部判据,不是共享形态概念 |

所以 **POC-B 有槽位没有能力**,它的 `screenMode` 永远是 `'DESKTOP'`。可以抄它的契约形状,抄不到逻辑。

### 14.2 三条路线

| 方案 | 做法 | 代价 |
|---|---|---|
| 甲 从画布几何派生 | 按宽度/比例设断点,如 POC-A | 阈值靠猜;**960×540 的客显会被误判成 mobile**,但它是顾客显示器不是手持设备 |
| 乙 随画布一起声明 | `package.json` 每个画布声明带 `form: 'laptop' \| 'mobile'` | 显式、可测、无阈值;与固定画布同源,Q-11 的动态切换自然跟随。缺点是多一个要维护的字段 |
| 丙 adapter 报设备物理事实 | 由 Android adapter 上报物理尺寸等设备事实,UI 层派生 | 是真设备事实;但客显的歧义仍在,且需要新增 adapter 字段与跨端等价物 |

**倾向乙。** 理由:TER 已经把「画布声明是唯一逻辑真相」立为原则,形态是同一类逻辑事实,
跟着画布声明走最自洽,也不需要在两端各造一套断点。Web 预览天然拿到同一个值,无需模拟设备。

### 14.3 连带的契约代价

若要让 part 按形态过滤（这正是「有些页面适应不了要换页面」的表达方式）,
`UiCatalogEntry` 需要新增一个维度,例如 `forms: readonly SurfaceForm[]`,
与现有 `displayModes`/`workspaces`/`instanceModes` 并列。这是 `kernel/base/ui-state` 的公共契约变更,
影响 `definePart`、`createUiCatalog`、`selectAvailableParts` 与所有已声明 part 的默认值。
**这是本条最大的一笔成本,需要单独确认是否本轮做。**

---

## 15 · 六格口令输入（第 2 条）:TER 已经具备,不需要 OTP 库

### 15.1 通行做法与为什么此处不适用

上网查过,React Native 社区对分格验证码输入的共识是**单个隐藏 TextInput 技术**:
渲染六个 View,底下藏一个 `maxLength=6` 的真实输入框,点击时把焦点交给它。
好处是 OS 把六位当成一个字符串编辑,于是自动前进、跨格退格、粘贴、自动填充全部由 OS 负责。
对应的反面做法是六个独立 TextInput 加 ref 手动管焦点,已知在 Android 上退格行为难做对。
来源见本节末。

**但这两套做法解决的是「OS 拥有文本」时的问题,而 TER 不是这个处境。**

### 15.2 TER 的实际情况（已亲验）

`ui/base/input/src/foundations/editText.ts` 已经有完整的按键驱动编辑模型:

```
EditState  = { value, selection, shift, capsLock }
KeyboardKey = text | backspace | shift | caps | complete
applyKeyboardKey(state, key, maxLength) -> { state, effect }
```

`applyKeyboardKey` **已经接受 `maxLength` 参数**。也就是说:

- 值是应用自己持有的一个字符串,不是 OS 持有的;
- 「输满自动前进」= 往同一个字符串末尾追加,到 `maxLength=6` 为止,**不需要任何前进逻辑**;
- 「退格跨格」= 对同一个字符串删最后一位,**不需要任何跨格逻辑**;
- 六个格子是**纯展示 View**,渲染 `value[0..5]`,没有任何一个是输入框。

**结论:两端的难点在 TER 不存在。** 需要新增的只有一个展示组件,行为全部由既有纯函数提供,
而且 `applyKeyboardKey` 本身已经可单测,六格渲染也可单测。不要引入任何 OTP 库。

### 15.3 唯一需要确认的一点

`PrimitiveInput` 目前包的是原生 `RnrTextInput`（带 `showSoftInputOnFocus`）。
六格口令只走虚拟数字键盘、不需要中文,所以它**可以不要原生输入框**。
但 input 包的焦点模型目前是围绕原生输入建立的（`PrimitiveInputHandle`、`measureInWindow`、
`InputScrollArea`）。所以要确认:**一个没有原生 TextInput 的字段能不能成为虚拟键盘的当前目标。**
若不能,退而求其次仍可用隐藏输入框加六格展示,行为不变,只是多一层。

### 15.4 来源

- [Creating split OTP input fields in React Native · LogRocket](https://blog.logrocket.com/creating-split-otp-input-fields-react-native/)
- [React Native OTP Screen: A Journey Through Development and Challenges](https://zmtmaster.medium.com/react-native-otp-screen-a-journey-through-development-and-challenges-d20e133f1e23)
- [Split text input in React Native for OTP](https://medium.com/@farazirfan47/split-text-input-in-react-native-for-otp-a87663dfe939)

---

## 16 · section 不跳转（第 3 条）

记为约束:section 之间不提供任何跳转入口,进入某个 section 的唯一路径是外壳导航。
含义有两点:section 的实现里不得持有导航能力,渲染上下文也不需要传导航句柄
（POC-B 的 `AdminConsoleSectionRenderContext` 只传 `runtime/store/closePanel/hostTools`,
本来就没有导航,这一点可以照搬）。

---

## 17 · 遮罩语义（第 4 条）:TER 的机制已经齐了

三项要求逐条对应到既有机制（均已亲验）:

| 要求 | 既有机制 |
|---|---|
| 全屏遮罩,压在业务页面之上 | `ui/base/render/src/types/catalog.ts` 第 7 行 `LayerTier = 'standard' \| 'alert'`;`LayerStack.tsx` 第 66 行按 tier 排序,`alert` 高于 `standard` |
| 不被外部点击误关 | 同文件第 8 行 `LayerGuard = 'dismissible' \| 'decisive'`;`LayerStack.tsx` 第 165、177 行只有 `dismissible` 才响应外部关闭 |
| 后面业务页面不暂停,但没有焦点 | `contexts/SurfaceFocusBoundaryContext.tsx` 的 `SurfaceFocusBoundaryPhase = 'suspend' \| 'restore'`,本来就是「挂起焦点但不卸载」的语义 |

所以 admin console 就是一个 `layerTier: 'alert'`、`layerGuard: 'decisive'` 的 part,
打开时向下广播 `suspend`,关闭时 `restore`。**不需要新机制。**

一处要注意:遮罩自己需要焦点（口令输入),而业务页面要失焦。
`SurfaceFocusBoundaryContext` 是按边界向下广播的,admin 层必须在该边界之外或自成边界,
否则会把自己也挂起。这是实现时的具体接线点,不是设计缺口。

---

## 18A · 第四轮新增待裁决

| 编号 | 问题 |
|---|---|
| Q-13 | 设备形态取甲/乙/丙哪条?本稿倾向乙（随画布声明） |
| Q-14 | 是否本轮就给 `UiCatalogEntry` 增加形态维度（§14.3）?这是 kernel 公共契约变更 |
| Q-15 | 六格口令字段是否允许没有原生 TextInput（§15.3）?若不允许则用隐藏输入框 |
| Q-16 | 形态只影响 admin-shell 自身布局,还是所有业务 part 都要按形态过滤? |

---

## 19 · Dexter 第四轮裁定（2026-09-11）

| 编号 | 裁定 |
|---|---|
| Q-13 | 设备形态取**乙**:随画布一起声明 |
| Q-14 | **本轮就给** `UiCatalogEntry` 增加形态维度 |
| Q-15 | **允许**六格口令字段没有原生 TextInput |
| Q-16 | 形态过滤适用于**所有 part**,不只 admin-shell |

补充要求:`ui/base/primitives` 控件太少,需要按生产交互标准补齐,包括各种容器。
sample 阶段为验证 UI 交互可以糊弄,admin console 是正式产品的一部分,不能。

---

## 20 · primitives 补齐（依据来自两版 POC 与 TER 现状,均已亲验）

### 20.1 TER 现状

- **九个组件**:`PrimitiveActions` `PrimitiveButton` `PrimitiveContainer` `PrimitiveHeading`
  `PrimitiveInput` `PrimitiveLabel` `PrimitiveScrollView` `PrimitiveStatus` `PrimitiveText`。
- **`theme/tokens.ts` 只有 31 行、21 个 token**,其中 `keyboardKey`、`keyboardAction`、
  `keyboardButtonText`、`keyboardActionText` 四个是虚拟键盘专用。
- **语义色板只有七个**（`sample-console/theme/global.css` 第 7 至 13 行）:
  `canvas` `surface` `foreground` `muted-foreground` `border` `action` `action-foreground`。
  **没有任何 ok / warn / error / danger 档**。
- `PrimitiveButton` 的三个 variant 是 `default` `key` `key-action` —— **后两个是键盘用途**,
  所以通用按钮实际只有一种形态。有 `disabled` 与 `pressed`,**没有忙碌态**。
- `PrimitiveStatus` 没有 tone。

### 20.2 从两版 POC 反推:原生控件面其实很薄

逐文件解析两版 POC 的 `react-native` import（多行 import 用脚本解析,不用行级 grep）:

| POC | 文件数 | 实际用到的 RN 组件 |
|---|---|---|
| POC-B admin 屏幕 | 11 | `Text` `View` `Pressable` `ScrollView` `useWindowDimensions` |
| POC-A admin 屏幕 | 8 | `ScrollView` `StyleSheet` `Text` `View` `TouchableOpacity` `ActivityIndicator` `TextInput` `FlatList` `Dimensions` |

**一个有价值的负面结论:两版都没用 `Switch`、`Modal`、`Picker`、`SectionList`、`RefreshControl`。**
所以不要为了「补全」去造这些件。真实体量不在控件种类,在**复合件与交互状态**。

对照:POC-B 的 `AdminSectionPrimitives.tsx` 有 687 行,导出十四个复合件 ——
`AdminSectionShell` `AdminSummaryGrid` `AdminSummaryCard` `AdminBlock` `AdminActionGroup`
`AdminSectionUnavailable` `AdminSectionMessage` `AdminDetailRow` `AdminStatusRow`
`AdminActionButton` `AdminPagerControls` `AdminPagedText` `AdminDetailList` `AdminStatusList`。
它们全部是用 `View`/`Text`/`Pressable` 拼出来的。

### 20.3 四类缺口

**A · 语义色调（最硬）。** admin console 满屏是状态展示。POC-B 定义了
`AdminStatusTone = 'neutral' | 'ok' | 'warn' | 'error'`,`AdminActionButton` 有
`tone: 'primary' | 'secondary' | 'danger'`。TER 的色板七个色里一个状态色都没有,
Button 没有语义 tone,Status 没有 tone。**补这一档要同时改色板与组件,不能只改组件。**

**B · 忙碌态。** POC-A 在八个屏幕里用了四次 `ActivityIndicator`。admin 的操作大多是异步的
（重启、清缓存、探测连接器、拉日志),按下到结果返回之间必须有反馈。
TER 的 Button 只有 `disabled` 与 `pressed`,缺 `busy`。这是「生产基本交互标准」里最基本的一条。

**C · 列表渲染。** TER 只有 `PrimitiveScrollView`。日志文件、连接器通道、端口清单都是列表,
其中日志可能很长。POC-A 用了 `FlatList`。需要一个可虚拟化的列表件,或明确裁定用 ScrollView 兜住。

**D · 容器与复合件词汇。** TER 只有一个 `PrimitiveContainer`。生产界面至少还需要:
卡片/面板、分隔线、行（键值对）、栅格、徽标/状态点、空状态、内联提示、等宽代码块。
另外按 Q-15,六格口令输入应当作为一个 primitive 件存在。

### 20.4 边界:什么进 primitives,什么进 admin-shell

POC-B 把通用件与 admin 语义件混在同一个 687 行文件里,**这一点不要复制**。建议分界:

- **primitives** 只放**无业务语义**的件:Button（带 tone 与 busy）、Text、Heading、Label、
  Container、Card、Divider、Row、Grid、Badge、Spinner、EmptyState、InlineMessage、
  List、CodeBlock、SegmentedControl、CodeInput。
- **admin-shell** 只放**admin 语义**的复合件:SectionShell、SummaryGrid、DetailList、StatusList 之类。
- 判据很简单:**一个件如果名字里必须带 Admin 才说得清它是什么,它就不属于 primitives。**

### 20.5 与 Q-16 的交叉:形态会改变 primitives 的 API

Q-16 裁定所有 part 按形态过滤,意味着 primitives 的每个件都要在 laptop 与 mobile 两种形态下成立。
这不是加个开关就行,会改变 API 设计。举例:栅格在 mobile 下几列、
分段控件在 mobile 下是否退化成下拉、键值行在窄屏是否换行。
**建议 primitives 的件不要自己读形态**,而是由调用方传列数/方向这类布局参数,
形态判断留在 part 层。否则形态逻辑会散进每一个基础件。

### 20.6 顺带发现（不属本题,登记即可）

`theme/tokens.ts` 的 `status` 目前是 `text-sm leading-6 pb-1 text-muted-foreground`。
`leading-7` 实验已撤回,但 `pb-1` 还在,那是密度整改期实验路径的中间态。
密度根因已经修好（副屏改用目标 display density),这个 `pb-1` 是否还需要值得单独复核一次。

---

## 21 · 第五轮新增待裁决

| 编号 | 问题 |
|---|---|
| Q-17 | primitives 的补齐范围:**按 admin-shell 首批三节实际需要补**,还是一次补齐一整套设计系统?本稿倾向前者 —— 没有使用者的件既无法验收也容易造错,而项目的判据要求是可证伪 |
| Q-18 | 语义色板扩到几档?建议至少 `ok` `warn` `error` 三档,各带前景/背景/边框三个位,与现有七色同一命名体系 |
| Q-19 | 长列表用可虚拟化列表件,还是先用 ScrollView 兜住、等出现性能问题再说? |
| Q-20 | §20.5 的建议:primitives 的件不自己读形态,由调用方传布局参数。是否采纳? |

---

## 23 · Dexter 第五轮裁定（2026-09-11）

| 编号 | 裁定 |
|---|---|
| Q-17 / Q-18 | primitives 作为公共组件包要**尽量完整**,应该有的都要有;不能每次做业务实施还回来补基础包 |
| Q-19 | 长列表用**虚拟化列表** |
| Q-20 | 按最合理的分工方式,由本稿判断 |

Q-17 推翻了本稿第五版「按需补」的建议。下面按「完整」重做,依据分三层取证。

---

## 24 · primitives 完整清单

### 24.1 仓内已经付出代价的证据（最硬,已亲验）

`ui/feature` 下**两个业务包各有一个 `controls.tsx`,都是 58 行,四个导出逐字相同**:

```
sample-staff-auth/src/components/controls.tsx
sample-member-desk/src/components/controls.tsx
  → DialogSurface · DialogActions · EmptyState · ScrollArea
```

这不是「以后要回来补基础包」,**是现在已经在各包里复制粘贴了**。
十五个业务组件文件里 `react-native` 导入为零,说明业务层的纪律是好的 ——
正因为它只用 primitives,primitives 缺一件,业务就只能本地手搓一件。Dexter 的判断成立。

### 24.2 底层槽是第二道闸（已亲验）

`ui/base/primitives/src/vendor/slots.tsx` 只包了五个 RN 组件:
`View` `Text` `TextInput` `Pressable` `ScrollView`。

所以 Q-19 的虚拟化列表不是加个组件那么简单,**要先在 vendor 层补 `FlatList`**;
忙碌态要补 `ActivityIndicator`。凡是新的 RN 底层组件都得先过这一层。

### 24.3 建议清单

现状取自 TER 源码,证据列注明为什么需要。外部对照用 gluestack-ui 的分类清单查漏。

**排版**:`Text` ✅ · `Heading` ✅ · `Label` ✅ · `CodeBlock` ❌（日志、诊断输出、raw payload 都要等宽）

**布局与容器**:`Container` ✅（只有一个）· `Card` ❌（两个 feature 已各自手搓 DialogSurface）·
`Divider` ❌ · `Stack`（横/纵,带 gap）❌ · `Grid` ❌（POC-B 的 SummaryGrid）· `Center` ❌

**表单**:`Button` ⚠️（三个 variant 里两个是键盘专用,缺语义 tone 与 busy）·
`Input` ✅ · `CodeInput`（六格口令,Q-15）❌ · `Checkbox` ❌ · `Radio` ❌ ·
`Switch` ❌ · `Select` ❌ · `Textarea` ❌ · `FormField`（label + 控件 + 错误位）❌

**反馈**:`Spinner` ❌（POC-A 用了四次 ActivityIndicator）· `InlineAlert` ❌（POC-B 的 SectionMessage）·
`EmptyState` ❌（两个 feature 已各自手搓）· `Progress` ❌ · `Skeleton` ❌

**数据展示**:`Badge` ❌（状态点/标签）· `KeyValueRow` ❌（POC-B 的 DetailRow,admin 用量最大）·
`StatusRow` ❌（带 tone,POC-B 的 StatusRow）· `List`（虚拟化,Q-19）❌ ·
`Table` ❌ · `Tabs` / `SegmentedControl` ❌（admin 外壳导航要用,且形态不同时形态不同）

**已有但要改**:`Actions` ✅ · `ScrollView` ✅（业务仍包了一层 ScrollArea,说明默认形态不够用,要看为什么）·
`Status` ⚠️（无 tone）

### 24.4 语义色板必须同步扩（Q-18）

`sample-console/theme/global.css` 第 7 至 13 行只有七个色,**一档状态色都没有**。
Button 的 tone、Status 的 tone、Badge、InlineAlert 全都依赖它。建议至少补
`ok` `warn` `error` `info` 四档,每档给前景、背景、边框三个位,命名沿用现有体系。
`theme/tokens.ts` 现在 31 行,补完后会显著变长,按可读性整改的职责拆分规则处理。

### 24.5 明确不做,以及为什么

| 不做 | 理由 |
|---|---|
| `Modal` `AlertDialog` `Popover` `Tooltip` `Drawer` `Actionsheet` `BottomSheet` `Portal` | TER 已有 `LayerStack` + `LayerTier` + `LayerGuard`,遮罩层归 render 管。primitives 再造一套会有两个叠放系统 |
| `Toast` | 同上,属 render 的 layer 语义,不属基础件。但需要裁决它是否要做（Q-23） |
| `DateTimePicker` `Calendar` `Slider` `Fab` `Avatar` `Image Viewer` `Link` `ChatAi` | 两版 POC 一个都没用;POS 终端场景也用不到。造了就是死代码 |
| `Accordion` | POC 未用;admin 用 tab 或侧栏导航,不需要折叠 |

### 24.6 Icon 是一个需要单独决定的大件

`Icon` 在 admin 界面上几乎绕不开,但 **TER 全仓没有任何 svg 或图标依赖**
（搜 `react-native-svg`、`vector-icons`、`@expo/vector-icons` 零命中)。
三条路:引入 SVG 依赖、引入图标字体、或只用纯几何图形与文字符号拼。
按项目「不随意新增依赖」的规则,这一条必须由 Dexter 定,见 Q-22。

---

## 25 · Q-20 的裁定:primitives 永不读形态

### 25.1 结论

**primitives 的任何组件都不得读取 `Dimensions`、`Platform`、density 或形态枚举,只接受显式 props。**
形态只在两个地方出现:catalog 的 part 过滤,和 part 自己的实现内部。

### 25.2 为什么这是最合理的分工

第五版我给过同样的建议,但当时的反对理由是「每个调用点都要重复形态判断,反而散得更厉害」。
**Q-16 已经把这个反对理由消掉了。**

Q-16 裁定所有 part 按形态过滤,意味着「手持设备上换一套页面」这种**大差异直接表达为两个 part**,
各自声明自己的形态,由 catalog 选中。于是:

- 大差异 → 两个 part,零新增机制,用的是 Q-14 已经买单的维度;
- 小调整 → 同一个 part 内部,由 part 从**已派生好的形态枚举**读取,再把列数、方向这类
  布局参数显式传给 primitives;
- primitives → 始终只看 props。

调用点根本不会「处处重复判断」,因为大差异压根不在同一个 part 里。

### 25.3 这条规则的副产品

primitives 因此保持**无状态、无平台耦合、可纯渲染测试**,与 TER 既有边界纪律一致
（input 包不读 Platform、业务不读 density 是同一条原则的不同实例)。
它也让 Web 预览与 Android 拿到完全相同的基础件行为,不需要为预览另开分支。

---

## 25A · 第六轮新增待裁决

| 编号 | 问题 |
|---|---|
| Q-21 | §24.3 的清单是否就是本轮「完整」的范围?其中 `Table`、`Progress`、`Skeleton` 在 admin 首批三节里未必用得上,但按「应该有的都要有」仍建议做 |
| Q-22 | `Icon` 走哪条路:新增 SVG 依赖、新增图标字体、还是纯几何拼?（§24.6） |
| Q-23 | `Toast` 要不要做?若要,它属 render 的 layer 还是 primitives? |
| Q-24 | 业务已手搓的 `ScrollArea` 说明默认 `PrimitiveScrollView` 不够用,要先查清它缺什么再决定是并入还是保留两层 |

---

## 27 · Dexter 第六轮裁定（2026-09-11）

| 编号 | 裁定 |
|---|---|
| Q-21 | §24.3 的清单全做,含 `Table` `Progress` `Skeleton` |
| Q-22 | **新增 SVG 依赖** |
| Q-23 | `Toast` 不做。**不用各 native 系统能力,所有形态都要在 APP 内闭环** |
| Q-24 | 要查清 `ScrollArea` 的缺口 |

---

## 28 · Q-24 的调查结果,以及对 §24.1 证据的自我更正

### 28.1 更正

第六版 §24.1 写「两个业务包各有 58 行、四个导出逐字相同」,并据此说明 primitives 缺四件。
**逐个打开后这个推论过头了,四个里只有两个是真复合件。**

| 导出 | 实际内容 | 判定 |
|---|---|---|
| `DialogSurface` | `PrimitiveContainer layout="card"` + `PrimitiveHeading` + children | **真复合件**,primitives 缺一个带标题的 Card |
| `EmptyState` | `PrimitiveContainer layout="content"` + `PrimitiveText` + 可选 `PrimitiveButton` | **真复合件**,primitives 缺 EmptyState |
| `DialogActions` | `<PrimitiveActions testID>{children}</PrimitiveActions>` | **空壳别名**,与 `PrimitiveActions` 完全等价,只是改了名 |
| `ScrollArea` | `<InputScrollArea testID>{children}</InputScrollArea>` | **空壳别名**,透传 `ui-base-input` 的 `InputScrollArea` |

所以「复制粘贴四件」这个说法不准确。准确的说法是:
**两件是 primitives 真缺件,两件是把已有件改名的无谓封装。**
Dexter 的判断本身仍然成立,只是证据强度没有我上一版写的那么高,特此更正。

### 28.2 `ScrollArea` 的真实缺口:不是 `PrimitiveScrollView` 不够用,是层选错了

`PrimitiveScrollView`（已亲验全文）已经提供 `getContentNativeNode`、`measureInWindow`、
`scrollTo` 与 `onScrollOffsetChange`,能力并不薄。业务要的不是它,而是
`ui-base-input` 的 `InputScrollArea` —— 那一层在它之上加了**键盘 scroll-into-view**
（就是本轮密度整改里改成 content 坐标系的那段）。

结论:**表单滚动区天然属于 input 包,不属于 primitives。**
`PrimitiveScrollView` 保持现状即可,不要为了「补齐」把键盘行为塞进 primitives ——
那会让基础件依赖输入焦点模型。

处置建议:删掉两个业务包里的 `ScrollArea` 与 `DialogActions` 别名,业务直接用
`InputScrollArea` 与 `PrimitiveActions`;`DialogSurface` 与 `EmptyState` 上收进 primitives。

---

## 29 · Q-22 的落地:SVG 依赖怎么选

### 29.1 选型

`react-native-svg`（software-mansion）是事实标准,同一作者维护 Reanimated 与 Gesture Handler,
符合「优先成熟、稳定、维护良好」的规则。它明确声明同时支持 React Native 与 React Native Web,
这一点对 TER 是必要条件 —— dev-host 的 Web 预览必须能渲染同一套图标。
自 13.0.0 起支持 Fabric（RN 0.69+),TER 是 `newArchEnabled=true`,满足。

**版本不要手填。** Expo SDK 56 随附 `react-native-svg@15.15.4` 搭 RN 0.85,
SDK 57 从 0.85 升到 0.86 且声明无破坏性变更。TER 是 Expo ~57 + RN 0.86.3,
所以用 Expo 的安装通道让它挑 SDK 匹配版本,比自己钉版本稳妥。

### 29.2 三条必须在接入时验证的风险

1. **Web 预览渲染。** 该库对 RNW 的支持历史上出过回归（issue #1106 记录 9.8.6 破坏过 RNW 兼容）。
   TER 用的是 RNW 0.21.2,必须实测 dev-host 能渲染,不能只看 Android。
2. **缩放画布内的命中与光栅化。** 图标会落在 `scaleX/scaleY` 变换之内。矢量内容理论上比文字更
   适合缩放,但**可点击图标的命中区**要和文字一样,用画布逻辑坐标验证。
   社区已有 SVG 的 `onPress` 与 `pointerEvents` 问题记录（issue #2784),不能假设默认正确。
3. **副屏 Presentation 内的原生视图。** SVG 在 Android 是原生视图,要确认它在 Presentation
   承载的 React surface 内正常工作,这与之前双屏 surface 的验证是同一类问题。

### 29.3 vendor 层要同步开口

`primitives/src/vendor/slots.tsx` 现在只包五个 RN 组件。本轮至少要加三个来源:
`FlatList`（Q-19 虚拟化列表)、`ActivityIndicator`（忙碌态)、以及 `react-native-svg` 的
`Svg`/`Path` 等（Q-22 图标)。**vendor 层是唯一允许接触第三方与 RN 原生的地方**,
其余 primitives 组件只消费 vendor 槽,这条纪律要写进包 README。

### 29.4 图标集本身也要闭环

按 Q-23 的原则,图标不能依赖系统符号或平台字体。所以除了渲染能力,还需要一套**自带的图标路径集**,
放在 primitives 内,按需增补。建议一开始只做 admin 首批三节真正用到的那几个,
图标集的扩充与组件清单的「完整」是两回事 —— 组件要完整,图标集按需长。

---

## 29A · Q-23 的原则边界:一处需要确认

「不用各 native 系统能力,所有形态都要在 APP 内闭环」这条原则,与一个既有裁定存在潜在冲突:

**虚拟键盘不支持中文,需要中文时切系统键盘** —— 这是本仓已定的产品路径,
`InputSurfaceFrame` 的 `imeInset` 与整条 IME 单位换算链都是为它建的。

我的理解是这条新原则约束的是**应用自己渲染的 UI 形态**（弹窗、提示、遮罩、图标),
不约束**输入法**这种系统服务。若理解有误请指出,因为这会决定系统键盘那条链是否要拆。
记为 Q-25。

---

## 29B · 第七轮新增待裁决

| 编号 | 问题 |
|---|---|
| Q-25 | §29A:「APP 内闭环」是否包含输入法?系统键盘那条链是否保留 |
| Q-26 | `DialogActions` 与 `ScrollArea` 两个空壳别名建议删除,业务直接用 `PrimitiveActions` 与 `InputScrollArea`。是否照办 |
| Q-27 | 图标集首批只做 admin 三节用到的几个,之后按需长。是否认可 |

---

## 31 · Dexter 第七轮裁定（2026-09-11）

| 编号 | 裁定 |
|---|---|
| Q-25 | 「APP 内闭环」**不包含输入法**;**系统键盘不保留** |
| Q-26 | 同意删除 `DialogActions` 与 `ScrollArea` 两个空壳别名 |
| Q-27 | 图标集首批只做 admin 三节用到的几个,之后按需长 |

---

## 32 · 系统键盘退役的波及面（已亲验,本节只盘点不设计）

这条裁定的影响远超 admin console,牵动已交付的整条 IME 链。本节把范围钉住,
**不含任何删除设计**,实施方案另开。

### 32.1 一个必须先回答的产品问题

`ui/feature/sample-member-desk/src/components/MemberForm.tsx` 第 35 行,
**会员姓名字段声明的是 `keyboardKind: 'system'`**,同表单的手机号与两个探针字段都是 `'virtual'`。
也就是说全仓唯一使用系统键盘的地方,正是需要输入中文姓名的那个字段,
这与「虚拟键盘不支持中文,要中文就切系统键盘」的既有裁定完全对应。

`keyboardKind: 'system' | 'virtual'` 是**字段级声明**,不是用户可切换的开关
（`ui/base/input/src/types/types.ts` 第 31、47 行)。所以系统键盘退役之后,
姓名字段只能落到虚拟键盘的 `alpha` 布局,即拉丁字母
（`keyboardLayout.ts` 第 1 行的四个布局是 `full` `financial` `numeric` `alpha`,没有中文)。

**结论:去掉系统键盘等于中文无法录入。** 这是产品取舍,不是技术问题,记为 Q-28。

### 32.2 波及的二十二个文件（按层)

**Android 原生**
`TerminalImeInsetsCoordinator.kt`（整文件 108 行,只为 IME 存在)·
`TerminalDualScreenModule.kt`（ime snapshot 与 event)·
`TerminalDualScreenActivityHandler.kt`（`attachPrimaryImeInsets` 及其生命周期挂接)

**adapter JS**
`dual-screen/src/implementations/surfaceHost.ts`（snapshot 的 `ime` 字段)·
`dual-screen/src/implementations/imeInsets.ts`· `dual-screen/test/surfaceHost.test.ts`

**render**
`contexts/SurfaceHostImeContext.ts`· `foundations/surfaceHost.ts`（`calculateSurfaceHostImeInset`,
即本轮反复核验的「除以 scaleY」那段)· `components/SurfaceHostController.tsx`· `test/renderSurface.test.tsx`

**input**
`types/types.ts`（`KeyboardKind` 的 `'system'` 分支、`owner`)· `components/InputProvider.tsx`·
`components/InputSurfaceFrame.tsx`（第 147 行 `owner === 'system'` 的 `paddingBottom`)·
`hooks/useInputField.ts`· `hooks/useInputFocusController.ts`（五处 `Keyboard.dismiss()`)·
`test/provider.test.tsx`· `test/inputFieldOptions.test.ts`

**primitives**
`components/PrimitiveInput.tsx`（`showSoftInputOnFocus`)· `types/types.ts`· `test/primitives.test.tsx`

**业务与集成**
`sample-member-desk/src/components/MemberForm.tsx`（第 35 行)·
`sample-staff-auth/test/staffAuth.test.ts`· `sample-console/src/assembly/assembly.tsx`（`imeInsetsSources` 接线)

### 32.3 连带的简化收益

退役会**删掉**而不是新增复杂度,有三处值得记下:

1. 本轮密度整改里反复核验的 IME 单位换算（`bottomLogicalBeforeCanvasScale / scaleY`)整条消失;
2. 当前实施证据里的 OPEN 项 `real Android IME show/hide roundtrip and scale invariance` **变为不适用**,
   是靠删除关闭而不是靠验证关闭;
3. `useInputFocusController` 里五处 `Keyboard.dismiss()` 与随之而来的「虚拟切系统时首触被吞」
   那类竞态一并消失（那正是更早一轮的 M-1)。

**但 `scaleY != 1` 下滚动 `before + 200` 那条 OPEN 仍然需要**,因为虚拟键盘同样会收缩视口,
`viewportAlreadyShrunk` 路径不受本裁定影响。

### 32.4 本轮与后续的边界

系统键盘退役与 admin console 是两件事,只在一处交汇:admin 的六格口令输入本来就只走虚拟数字键盘
（§15),**不受退役影响**,反而因为不必再考虑 system owner 而更简单。
建议把退役单独开一个条目推进,不要并进 admin console 的需求,否则两件事的验收会缠在一起。

---

## 32A · 第八轮新增待裁决

| 编号 | 问题 |
|---|---|
| Q-28 | §32.1:系统键盘退役后中文无法录入。是接受(姓名等字段改用拉丁字母或拼音),还是虚拟键盘要补中文输入能力? |
| Q-29 | 系统键盘退役是否单独立项,不并入 admin console?本稿倾向单独立项 |

---

## 33 · Dexter 第八轮裁定（2026-09-11）

| 编号 | 裁定 |
|---|---|
| Q-28 | **接受不做中文**。所有输入只用软键盘（虚拟键盘) |
| Q-29 | 系统键盘退役与 admin console **放一起**做 |

Q-29 推翻了本稿 §32.4 的建议。**复核后这个裁定是对的,本稿此前的建议漏看了文件重叠。**

---

## 34 · 合并批次的依赖顺序

### 34.1 为什么「放一起」成立

两件事在同一批文件上相撞,分开做等于把同一个文件改两遍:

| 文件 | 系统键盘退役要改 | primitives 补齐要改 |
|---|---|---|
| `primitives/src/components/PrimitiveInput.tsx` | `showSoftInputOnFocus` 相关处理 | tone、busy、CodeInput 支撑 |
| `primitives/src/types/types.ts` | 输入相关类型 | 新件的 props 类型 |
| `input/src/types/types.ts` | `KeyboardKind` 去掉 `'system'`、`owner` 收窄 | —— |
| `render/src/foundations/surfaceHost.ts` | 删 `ime` 字段与 `calculateSurfaceHostImeInset` | 加 `isHostPrimaryDisplay`（Q-8) |

最后一行尤其明显:render 的结构型 `SurfaceHostSnapshot` 一共只有五行
（`stableHostLogicalSize` 加可选 `ime`),退役要删其中一个字段,Q-8 要加一个字段,
**分两批做就是把同一个五行类型改两次,中间还留一个既有 `ime` 又没有形态事实的中间态。**

### 34.2 Q-8 的成本比上一版估计的小

render 的 `SurfaceHostSnapshot` 只保留了最小面,标识类字段全部没进来。
但 Android adapter 侧的 snapshot **已经带 `windowIdentity: 'primary' | 'secondary'`**
（`adapter/android/dual-screen/src/implementations/surfaceHost.ts` 第 7、35 行),
`captureWindow` 的 surfaceIndex 就是 displayIndex,所以事实本来就在,只是没往上传。

于是 Q-8 的实际改动是:render 的结构型 snapshot 加一个布尔、Android source 一行映射、
Web dev-host source 补一个取值、`SurfaceContext` 透出。**不需要新增任何原生能力。**

### 34.3 建议的批内顺序

顺序的依据是「先删后加,先契约后实现,先基础件后使用者」:

1. **系统键盘退役。** 它只删不加,先做能让后面所有新代码直接写在更小的输入契约上。
   若放在最后,admin 的六格口令、primitives 的 Input 相关件都会先写一遍旧形状再改。
2. **`UiCatalogEntry` 加形态维度（Q-14) + `isHostPrimaryDisplay`（Q-8)。**
   两个都是契约层改动,一次做完,让后面新声明的 part 从第一天就带形态,不必回头补。
3. **vendor 槽开口 + SVG 依赖接入（Q-19、Q-22)。** 三个新来源:`FlatList`、`ActivityIndicator`、
   `react-native-svg`。§29.2 的三条风险（RNW 渲染、缩放画布内命中、Presentation 内原生视图)
   在这一步验完,再往上建件。
4. **语义色板扩档（Q-18) + primitives 完整清单（Q-17、Q-21)。**
   色板必须先于组件,因为 tone 是组件的入参而不是组件内部的硬编码。
   同步删掉两个业务包的 `DialogActions` 与 `ScrollArea` 空壳别名(Q-26),
   把 `DialogSurface`、`EmptyState` 上收。
5. **admin-shell 的框:手势、门禁、鉴权、外壳、容器键 `admin.*`。**
6. **首批三节:platform-ports、runtime、display-context。**

第 1 步与第 2 步没有互相依赖,可并行;第 3 步之后是严格串行。

### 34.4 这一批的规模提示

六个工作流横跨 kernel 契约、adapter、render、primitives、input、两个业务包与集成层,
其中第 4 步是一次性补齐一整套基础件。按仓内既有纪律,**建议在实施计划里给每一步单独的
focused proof 与阶段对账,不要等到最后一次性验收**,否则任一步的回归会淹没在整批里。
这不是反对合并,合并的理由在 §34.1 已经成立;这只是要求批内可分段验证。
