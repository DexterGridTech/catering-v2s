# TER admin console 讨论稿 · 两版 POC 逐行分析

- 日期：2026-09-11 · 作者：Claude · 状态：**讨论稿,非需求,非评审结论,不授权任何实施**
- 分析对象（只读）：
  - POC-A：`/Volumes/idea/_old_/2-ui/2.1-cores/admin`（`@impos2/ui-core-admin`,src 5,407 行）
  - POC-B：`/Volumes/idea/newPOSv1/2-ui/2.1-base/admin-console`（`@next/ui-base-admin-console`,src 7,328 行）
  - POC-B 的真实接入点：`newPOSv1/2-ui/2.3-integration/catering-shell/src/ui/screens/RootScreen.tsx`
- 目标对象：`catering-v2s/apps/terminal`
- 标注：`已亲验` = 打开源码读过；`推论` = 由已验事实推出；`待裁决` = 需要 Dexter 决定

> ⚠️ **命名待确认**：Dexter 说「两版 POC」。本稿按 `_old_` = 早版、`newPOSv1` = 后版处理,
> 全文一律用路径而不是「第一版/第二版」指代,以免对错版本。若您所说的「第一版」指的是
> `newPOSv1`,请见 §2.1 末尾的第二种读法。

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

## 6 · TER 的建议形态（讨论用,不是结论）

### 6.1 门禁:用 `displayIndex` 一个字段就能表达您的规则

TER 现有词汇（已亲验）:`RuntimeInstanceMode = 'MASTER' | 'SLAVE'`（**没有 STANDALONE**）、
`DisplayMode = 'PRIMARY' | 'SECONDARY'`、`DisplayRole = 'CHIEF' | 'VICE'`,
以及 adapter 传上来的 `displayIndex` 与 `displayCount`。

注意 `resolveSurfaceDisplayMode`（`display-context/src/foundations/displayDerivation.ts` 第 5 行）:

```
displayIndex === 1 || (displayRole === 'VICE' && instanceMode === 'SLAVE') → 'SECONDARY'
```

**`displayMode` 把两种不同处境合并了**:同一台机器的第二块屏,和副机。而您的需求 1 恰恰要
区分这两者。所以 `displayMode` 不能用作判据。

可用的最小判据是:

```
可唤起 admin console  ⟺  displayIndex === 0
```

- 单机双屏:主屏 `displayIndex = 0` 可唤起,副屏 `displayIndex = 1` 不可。✓
- 双机:主机与副机各自的主显示都是 `displayIndex = 0`,两边都可唤起。✓

一个字段、已有事实、两种场景自然满足,而且语义可以一句话说清:
**「只有承载本机主显示的那块 surface 能唤起 admin console」**。

若双机的副机自己也接了第二块屏,该屏 `displayIndex = 1` 同样不可唤起 —— 这看起来与规则
自洽,但**需要您确认是不是想要的**。

### 6.2 框与内容的切分

admin-shell 应当只有五样东西:

1. **调起**:手势判据（用画布逻辑坐标）+ 门禁（§6.1）;
2. **鉴权**:口令校验接缝,具体算法可注入;
3. **外壳**:标题、导航（tab rail 或 sidebar）、关闭、返回登录;
4. **注册表**:按 surface 分作用域,支持 add / remove,带 owner 身份与排序键;
5. **渲染上下文**:传给 section 的最小 context。

除此以外,**一行业务内容都不在 admin-shell 里**。九个屏幕全部由各自的业务包声明并注册。

### 6.3 注册形态的三个必须

- **add 而不是 replace**,并带 owner moduleName,便于诊断「这个 tab 是谁注册的」;
- **按 surface 分作用域**,避免 §4.2;
- **section 自带可见性声明**,例如它允许出现在哪些 `instanceMode`/`displayIndex`,由框统一求值,
  而不是像 POC-B 那样机制全开、真门开在集成层。

### 6.4 一个 TER 特有、两版 POC 都没遇到的问题

**admin console 渲染在逻辑画布之内还是之外?**

- 画布之内:跟着 `scaleX/scaleY` 一起形变,好处是坐标系统一、手势判据简单;坏处是副屏上
  admin 文字会和业务文字一样小,而 admin 是给店员/运维看的,不是给顾客看的。
- 画布之外:作为承载层的 overlay,用宿主真实 dp,好处是可读性;坏处是它与画布是两套坐标系,
  手势、命中、IME inset 都要单独处理一遍。

这是 `待裁决`,而且会显著改变实现量。两版 POC 都没有固定画布,所以都不提供参考。

---

## 7 · 需要 Dexter 裁决的问题

| 编号 | 问题 | 为什么必须您定 |
|---|---|---|
| Q-1 | 「两版 POC」指的是哪两个?本稿按 `_old_` 与 `newPOSv1` 处理 | 若指错,§2 的结论要重读 |
| Q-2 | 双机副机上,admin console 显示的是与主机**相同**的全部 section,还是子集? | 影响注册表是否需要按角色过滤 |
| Q-3 | §6.1 的推论:副机若自带第二块屏,该屏不可唤起。是否符合预期? | 产品语义 |
| Q-4 | admin console 渲染在画布内还是画布外?（§6.4） | 显著改变实现量与坐标处理 |
| Q-5 | 鉴权沿用 POC-B 的时间派生口令吗?口令是每台机器不同,还是全店统一? | 安全模型 + 运维流程 |
| Q-6 | 「唤起」是否也包含「看得见入口」?还是入口一律隐藏、只有手势 | 影响是否需要可见的触发控件 |
| Q-7 | 本轮 admin-shell 要不要自带任何 section?例如「关于/版本」这种框自身的信息 | 决定「框」的下界 |

---

## 8 · 本稿的边界

本稿只做事实盘点与形态讨论,**不含 GO/NO-GO,不构成需求,不授权实施**。
§2、§3 的事实均已打开源码亲验并标注路径与行号;§4、§6 标注为推论的部分尚未经运行验证。
TER 侧只读取了 `ui/base/admin-shell` 现状与 display-context 的既有词汇,未做任何写入。
