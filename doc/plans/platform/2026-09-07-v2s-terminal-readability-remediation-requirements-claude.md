# TER 可读性整改 · 正式需求

- **日期**：2026-09-07 · **作者**：Claude
- **上游**：`doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-analysis-claude.md` ⚠️ **该分析稿已被本文 supersede**,只保留现状实测数据与裁定过程的历史价值,⛔ 其结论不得作为设计或实施输入
- **性质**：正式需求。**不构成设计或实施授权** —— Codex 应先出详设与实施计划,经 Dexter 与 Claude review 后另行授权。

⚠️ 本文所有数字均为 2026-09-07 实测,未运行任何构建或测试。标 ✅ 的是打开源码亲验。

---

## 1. 第一性目标

让**后续接手的人类开发者**能在不问人的前提下:

1. 打开任一包,**从目录名就知道每个文件该在哪、为什么在那**;
2. 打开任一文件,**在固定位置找到想找的东西**;
3. 启动 App,**从日志就看清装了什么、注册了什么、端口是真是假**。

⚠️ **不是**为了「看起来整齐」。每条规则都必须能回答「不这样做,读代码的人会多付出什么」。

---

## 2. 范围与非目标

### 2.1 范围

| # | 需求 | 交付形态 |
| --- | --- | --- |
| 一 | 全局目录词表 | 写入 `doc/platform/terminal-coding-standard.md` |
| 二 | 可读性规则集 | 同上,新增一节,编号 `TR-R01` 起 |
| 三 | 存量结构归位 | 12 个包、35 个散文件 |
| 四 | 必拆单元 | 2 处硬顶必拆 ＋ 2 处按职责拆 |
| 五 | 启动结构化日志 | 新增代码 |

### 2.2 非目标

- 不改目录层级（`kernel`/`ui`/`adapter`/`assembly` 与 `base`/`feature`/`integration` 不动）;
- 不加目录序号（已裁定改为 `apps/terminal/README.md` 层次图,**另立专题**）;
- 不改包名、`moduleName`、npm 名 —— `§2-A` 的三重派生一字不动;
- 不改任何业务行为、command 契约、slice 形状或测试断言的**语义**;
- 不引入新依赖;
- 不重写既有 `TR-01`…`TR-12`。

---

## 3. Dexter 2026-09-07 已裁事实

| 裁定 | 内容 |
| --- | --- |
| 目录词表形态 | **不按层规定。先有全局闭合词表,各包按需取用,不得自造** |
| 单元体量 | ⚠️ **2026-09-07 二次裁定：只留「按职责拆」,不设行数硬顶。** 与既有规范 §5 驳回「文件/函数行数上限」的理由一致（问题是职责不是行数）⇒ 规范 §5 无需修改 |
| 可读性范围 | 扩到声明位置、成员顺序等,**以专业判断为准** |
| 纯函数层统一名 | `foundations` |
| 规范载体 | **并入** `terminal-coding-standard.md`,不另起正本 |
| 整改批次 | **按层分批** |
| 启动日志档位 | **只在 dev 构建** |
| `testing/` 处置 | **进词表 ＋ 两条硬约束**（不得公开导出、必须可编译期剔除） |

---

## 4. 需求一 · 全局目录词表（规范性）

`src/` 下**只允许**：`index.ts` ＋ `moduleName.ts` ＋ `dependencies.ts`（三个法定例外）＋ 下表目录。

⚠️ **法定例外的理由**：`§2-A` 的门按 `src/moduleName.ts` 这个**路径**读；移动它们要同时改门,收益低于成本。

| 目录 | 装什么 | 明确不装什么 |
| --- | --- | --- |
| `types/` | 只有 `type`/`interface`/类型级常量,**零运行时值** | 任何有运行时行为的东西 |
| `foundations/` | 纯函数与纯工厂。⛔ 不触 store、网络、平台 API（`TR-06` 已有门） | 有副作用的东西、React |
| `implementations/` | ⚠️ **本轮新增**。已声明端口的**真实实现**,**允许触达平台 API**（`TR-06` 在本目录不适用,这是它与 `foundations/` 的唯一区别） | 端口以外的业务逻辑 |
| `features/` | command 驱动的业务单元。固定子目录 `actors/` `commands/` `slices/` `variables/` | 纯函数、React |
| `selectors/` | 跨包读的唯一入口（`TR-03`） | 写操作 |
| `application/` | 包的组装与入口：module descriptor、runtime 工厂 | 业务逻辑 |
| `components/` | React 组件,**以及直接产出 `ReactNode` 的渲染函数** | 不产出 `ReactNode` 的东西 |
| `hooks/` | React hooks,一文件一 hook,`useX` 命名 | 非 hook |
| `contexts/` | React context 定义及其 Provider | 消费 context 的业务组件 |
| `defaults/` | 已声明端口的**默认/不可用**实现 | ⚠️ **真实实现去 `implementations/`** |
| `parts/` | part 声明（`definePart` 的产物） | 组件实现 |
| `assembly/` | 装配：把 module、catalog、surface 拼起来 | 业务逻辑 |
| `theme/` | 设计 token | 组件 |
| `vendor/` | 外部代码的仓内拷贝,原样保留不改写 | 自己写的代码 |
| `testing/` | 把生产设施暴露给测试的逃生口 | 测试本身（去 `test/`）、生产逻辑 |

⚠️ **本轮对词表的三处修改（Codex 评审 M-2,亲验后采纳）**：

| 修改 | 触发实例 |
| --- | --- |
| 新增 `implementations/` | ✅ 亲验 `adapter/android/{device,dual-screen,persist-kv}/src/*.ts` 均 import 并调用 `requireNativeModule`,`ui/base/dev-host/src/webPlatform.ts` 读 `globalThis.localStorage` 构造真实绑定 ⇒ 它们**触达平台 API**,进 `foundations/` 违反 `TR-06`；也不是 default/unavailable ⇒ 原词表**无处安放** |
| `features/` 增加 `variables/` 子目录 | ✅ 亲验 `ui/feature/sample-staff-auth/src/variables.ts` 是 `createModuleUiVariableFactory` 的 uiVariable 声明 —— 是模块拥有的运行时状态声明,与 command、slice 同族,不是纯函数 |
| `components/` 扩为「组件 ＋ 直接产出 `ReactNode` 的渲染函数」 | ✅ 亲验 `ui/base/render/src/foundations/resolvePart.ts` 第 1-2 行 import `createElement` 与 `Text` ⇒ 它在「纯函数」目录里做渲染,原词表也无处安放 |

### 4.1 词表是**闭合**的

需要表外目录时,**必须先改这张表**并说明为什么现有 15 个都装不下。⛔ 不得就地新建。

### 4.2 `testing/` 的两条硬约束（Dexter 裁定甲）

1. ⛔ **不得从 `src/index.ts` 公开导出**;
2. ⛔ **必须可编译期剔除**（`TR-08`）。

**判据**：断言包的公共面（`src/index.ts` 的导出集合）中不含任何来自 `testing/` 的符号。
**反例**：把 `testing/` 里任一符号加进 `src/index.ts`,该断言必红。

### 4.3 用法

一个包**只取自己需要的**。`kernel/base/contracts` 只用 `types/` ＋ `foundations/` 是对的。
⛔ **没有**「每层必须有哪些目录」的规定,只有「用到的必须来自这张表」。

---

## 5. 需求二 · 可读性规则（规范性）

### 5.0 ⚠️ 本节已按既有规范的元规则重写

`doc/platform/terminal-coding-standard.md` §6 有两条元规则,原稿两条都违反了：

> **新规则由实例产生,写在修完之后 —— 没有实例的规则不进本文。**
> **每条规则必须自带反例与反例栏,否则它不是规范,是口号。**

✅ 亲验 315 个源文件后逐条量了实例数,据此把原稿的 A–J 十组**砍成两类**：

| 类 | 处置 |
| --- | --- |
| **有实例的** → 进规范,编号 `TR-R01` 起,**每条带反例栏** | 7 条 |
| **已经一致的** → 记为「既成惯例」,写下来给新人看,**不设门**（它不是新规则） | 5 条 |
| **零实例或未测量的** → **不进本文** | 见 §5.3 |

### 5.1 规则（有实例,进规范）

| 编号 | 档 | 规则（禁止句） | ✅ 实测实例 | 反例（门必须红） |
| --- | --- | --- | ---: | --- |
| `TR-R01` | `R` | **单元不得承担多个变更理由。** 拆分轴是职责,⛔ 不是行数 | 3 处 | 把已拆开的两个职责合回一个函数/类/组件 |
| `TR-R02` | `L` | ⛔ 禁止文件末尾的 `export {...}` 汇总块；`export` 必须写在定义处 | **33 文件** | 在任一文件末尾加一个 `export {}` 汇总块 |
| `TR-R03` | `L` | ⛔ 业务组件禁用 `createElement`。**扫描分母**：`apps/terminal/**/src/**` 全部源码;**例外 allowlist 仅一条**：`ui/base/render/src/components/resolvePart.ts`（迁移后路径）。⚠️ 分母不按包名筛,按路径全扫 ＋ allowlist 排除（Codex 复核 S-6,采纳） | 4 处 | 在 allowlist 之外任一文件使用 `createElement` |
| `TR-R04` | `L` | 参数**超过 3 个**必须改对象参数 | 7 处 | 造一个 4 参位置参数函数 |
| `TR-R05` | `L` | 嵌套深度超过 3 层必须重构。⚠️ **档位由 `R` 改 `L`（Codex 复核 M-1,采纳）** —— 嵌套深度是标准 AST 判定（等价 eslint `max-depth`）,标 `R` 会因 RD-9 禁止它进 checker manifest 而永远无门。**深度定义**：函数体内 `if`／`for`／`while`／`switch`／`try` 的词法嵌套层数,三元与 `&&` 短路不计 | 22 处 | 造一个 4 层嵌套分支 |
| `TR-R06` | `L` | `src/` 下只允许三个法定文件 ＋ §4 词表内目录 | 35 散文件 ＋ 3 目录改名 | 在任一包 `src/` 根加第四个文件,或建表外目录 |
| `TR-R07` | `L` | `testing/` ⛔**不得出现在生产 import graph 中** | 1 处 | 见 §5.2 |

⚠️ **`TR-R01` 的档位是 `R`,不是 `L`。** Dexter 2026-09-07 裁定**只留「按职责拆」,不设行数硬顶** ——
与既有规范 §5「文件/函数行数上限」被驳回的理由一致（「冻结计数不是不变量。问题是**职责**不是行数」）。
⇒ **既有规范 §5 无需修改**,本需求与它不再冲突。

⚠️ **`TR-R03` 的一处登记例外**：✅ 亲验 `ui/base/render/src/foundations/resolvePart.ts` 第 1-2 行
import `createElement` 与 `Text`,用于**按 partKey 动态解析并渲染**。它不是业务组件,
⇒ 登记为**明示例外**,并随 §4 的词表修改移入 `components/`。
⛔ 例外只此一处,新增例外须改本表。

### 5.2 `TR-R07` 的判据与当下的违反（Dexter 2026-09-07 裁定）

**裁定**：`./testing` **继续允许**作为跨包测试入口；`TR-R07` 改为
「`testing/` 不得出现在**生产 import graph** 中」。

⇒ 判据从「不得公开导出」改为「**生产入口不可达**」。
✅ 亲验 `runtime/package.json` 的 `exports` 为 `{".": "./src/index.ts", "./testing": "./src/testing/index.ts"}`；
✅ 亲验 6 个测试文件、4 个包在消费该子路径（`ui-state` 3 处、`display-context` 1 处、`sample-console` 2 处）。

#### 5.2a ⚠️ 当下就违反：生产代码自己 import 了 `testing/`

✅ 亲验 `kernel/base/runtime/src/application/createRuntime.ts`
第 49-50 行 import `../testing/releaseRuntimeForTest` 与 `../testing/runtimeStateSyncForTest`,
第 433-434 行**无条件调用**两个 `register*`。

⇒ `src/testing/**` **今天就在生产 import graph 里**,`TR-R07` 开门即红。

**根因**：✅ 亲验两个文件各自同时含 —— 模块级 `WeakMap` ＋ `register*`（**生产调用**）
＋ 读取／释放函数（**测试调用**）。三者同处一个模块 ⇒ 生产为了 register 必须 import 整个模块。

**要求：按调用方拆开。**

| 移到 | 内容 | 谁 import |
| --- | --- | --- |
| `foundations/` | 模块级 `WeakMap` ＋ 两个 `register*` | 生产（`createRuntime`） |
| `testing/` | 只留 `releaseRuntimeForTest` 与 `runtimeStateSyncForTest`,从 `foundations/` 取 `WeakMap` | 仅 `./testing` 子路径 |

⚠️ **不是「两条 graph 互不相交」（Codex 复核 S-1,采纳）** —— 两者都会经过 `foundations/`,
那是**有意共享**同一个 `WeakMap`,不共享就会出现两份注册表。

**准确表述**：**生产 graph 不可达 `src/testing/**`；双方共享 `foundations/` 的 registry。**

⚠️ **另一处需一并规定**：✅ 亲验 `src/testing/index.ts` 只导出 `releaseRuntimeForTest`,
而 `runtimeStateSyncForTest` 被 runtime **自己的测试深路径** import
（`kernel/base/runtime/test/requestLedgerLifecycle.test.ts` 第 20 行 `from '../src/testing/...'`）。

⇒ 规定：**包内测试可深路径进 `src/testing/`；跨包测试只能走 `./testing` 子路径。**
两种都不影响 `TR-R07`,因为判据只看**生产** graph。

#### 5.2b 判据分母

**必须检查生产 import graph**：从 `src/index.ts` 出发可达的模块集合中,⛔ 不得含 `src/testing/**`。

⚠️ ⛔ **只检查 `src/index.ts` 的导出符号是不够的** —— 那是原稿的 false green：
导出集合里没有 `testing` 的符号,但模块图里有。

**反例**：把任一 `register*` 挪回 `testing/`,该断言必红。

⚠️ **顺带记录一条本轮不解的事实**：✅ 亲验 `releaseRuntimeForTest.ts` 的注释自述
「**Runtime has no production-reachable stop or dispose exit**」「**Production has no registry-wide drain**」——
即生产**没有** dispose 出口,资源活到进程退出。
⇒ 这不是测试便利,是**生产缺失的能力被贴上了 ForTest 标签**。
本轮按裁定只做「生产不可达」,⛔ **不动 `Runtime` 契约**；
是否把释放升为一等能力,登记为独立欠账。

### 5.3 既成惯例（记录,不设门）

⚠️ 这些**不是新规则** —— 仓内已经一致,写下来只为让新人知道。⛔ 不为它们造门。

| 惯例 | ✅ 实测 |
| --- | --- |
| React 组件与 context 用 PascalCase,其余 camelCase | 24 / 291,零例外 |
| 布尔用 `is`/`has`/`can`/`should` 前缀 | 54 处在用 |
| 事件处理函数用 `handleX`,prop 用 `onX` | 5 处在用 |
| 工厂 `createX` · 断言 `assertX` · 守卫 `isX` · hook `useX` | 全仓一致 |
| 包内直接 import 具体文件,**不建目录 barrel** | 深路径 256 条 vs 子目录 barrel 5 个 |

### 5.4 本轮**不进**规范的候选

| 候选 | 为什么不进 |
| --- | --- |
| 禁止被注释掉的死代码 | ✅ 实测 **0 处** —— 无实例 |
| 类成员顺序（静态→构造器→public→private） | 全仓仅 1 个类,无违规实例 |
| 文件内顺序 ①import ②类型 ③常量 ④辅助 ⑤主导出 | ⚠️ **未测量**。整改期若发现实例再补 |
| React 组件内七段顺序 | ⚠️ **未测量**。同上 |
| 复杂条件必须提具名变量 | ⚠️ **未测量**。同上 |
| 非 hook 变量在首次使用处声明 | ⚠️ **未测量**。同上 |
| 同名字段在不同类型中不得含义冲突 | 唯一实例 `AppError.category` 在 `kernel/base/contracts` 契约包内,§2.2 已把改契约列为非目标 ⇒ 登记为独立欠账 |
| 禁止布尔参数 | ⚠️ 未测量,且与 `TR-R04` 部分重叠 |

⚠️ **这张表的用途和既有规范 §5 一样**：下次有人再提同样的候选,先看这里。

---

## 6. 需求三 · 存量结构归位（精确清单）

✅ 亲验：**12 个包、35 个散文件**；另有 7 个包已干净（只有目录）；**8 个包只有三个法定文件**（无目录、无散文件）,不在归位范围内。
⚠️ 三者相加 `12 + 7 + 8 = 27`,与包总数吻合（自审第 5 轮校对；原稿写「6 个空壳」漏了 `adapter/android/app-control` 与 `adapter/android/logger`）。

| 包 | 散文件 | 去向 |
| --- | ---: | --- |
| `kernel/feature/sample-member-registry` | 6 | `commands.ts`→`features/commands/` · `slice.ts`→`features/slices/` · `selectors.ts`→`selectors/` · `types.ts`→`types/` · `errors.ts`→`foundations/` · `module.ts`→`application/` |
| `kernel/feature/sample-staff-session` | 6 | 同上 |
| `ui/feature/sample-member-desk` | 4 | `assembly.ts`→`assembly/` · `commands.ts`→`features/commands/` · `module.ts`→`application/` · `parts.ts`→`parts/` |
| `ui/feature/sample-staff-auth` | 5 | 同上 ＋ `variables.ts`→**`features/variables/`**（✅ 亲验是 uiVariable 声明,与 command、slice 同族） |
| `ui/base/dev-host` | 4 | ⚠️ **零目录**。`testExpoApp.tsx`→`components/` · `surfacePreview.ts`→**`foundations/`**（✅ 亲验对 React 的引用数为 **0**,只有类型与纯几何函数 —— 原稿放 `components/` 违反 §4 词表自身定义,Codex 复核 S-4,采纳） · `webPlatform.ts`／`webStorage.ts`→**`implementations/`**（✅ 亲验读 `globalThis.localStorage` 构造真实端口绑定,是真实平台实现,**不是** default） |
| `ui/integration/sample-console` | 3 | `assembly.tsx`→`assembly/` · `baseModuleDescriptors.ts`→`application/` · `terminalSurfaces.ts`→`application/` 或 `types/` |
| `ui/base/input` | 2 | `context.ts`→`contexts/` · `types.ts`→`types/` |
| `ui/base/primitives` | 1 | ⚠️ `components.tsx` **24 个导出**,须拆：类型→`types/`,各控件→`components/` 一文件一控件 |
| `adapter/android/device` | 1 | `androidDevice.ts`→**`implementations/`**（✅ 亲验调用 `requireNativeModule`,触达平台 API,进 `foundations/` 违反 `TR-06`） |
| `adapter/android/dual-screen` | 1 | `imeInsets.ts`→**`implementations/`**（✅ 亲验调用 `requireNativeModule`,触达平台 API,进 `foundations/` 违反 `TR-06`） |
| `adapter/android/persist-kv` | 1 | `androidPersistKv.ts`→**`implementations/`**（✅ 亲验调用 `requireNativeModule`,触达平台 API,进 `foundations/` 违反 `TR-06`） |
| `assembly/android/sample-terminal` | 1 | `platformPorts.ts`→`assembly/` |

**目录改名**：

| 现名 | 新名 | 依据 |
| --- | --- | --- |
| `ui/base/input/src/model/` | `foundations/` | ✅ 5 个文件全是纯函数 |
| `kernel/base/state/src/supports/` | `foundations/` | ✅ 搭在 `foundations/defineStateRuntimeSlice` 之上的组合层,仍是纯函数 |
| `ui/base/primitives/src/rnr/` | `vendor/` | ✅ 是 React Native Reusables 的仓内拷贝 |

`kernel/base/runtime/src/testing/` **保留原名**,按 §4.2 加两条约束。

---

## 7. 需求四 · 必拆单元

### 7.1 按职责必拆

| 位置 | 现状 | 要求 |
| --- | ---: | --- |
| `kernel/base/runtime/src/foundations/createCommandDispatcher.ts` | 单个函数 **762 行** | 按职责拆 |
| `kernel/base/state/src/foundations/persistenceEngine.ts` | 单个类 **559 行** | 按职责拆。⚠️ 该包 README 自述「队列与 health **七项职责**……不拆是因为耦合紧」—— 七项职责在一个类里,**这本身就是拆的理由**；行数只是症状 |
| `ui/base/input/src/components/InputProvider.tsx` | 406 行,**20 个 `useCallback`** | 按职责拆（⚠️ 自 §7.2 上移：S-1 指出它与上两处**同属改变执行边界的拆分**,风险同级,不该只因行数少而少一道前置） |

⚠️ **拆分理由是职责,不是行数。** Dexter 2026-09-07 裁定只留「按职责拆」,不设行数硬顶；
行数在本表只作为**症状记录**,⛔ 不作为判据。

⚠️ **职责清单不得以本文的枚举为分母（Codex 评审 S-2,采纳）**：
原稿写 dispatcher「至少六项」、persistenceEngine「七项职责」。「至少」不能当分母 ——
实际 dispatcher 还涉及 timeout、late completion、peer gateway、reset、cleanup 等行为族。
⇒ **职责分母必须从 owning source 的实际符号、状态转移与测试文件反推**,⛔ 不得照抄本文的枚举。

### 7.1a ⚠️ 拆分前置：先证明行为被测试钉住（自审第 4 轮补）

✅ 亲验两个包的测试覆盖：
`runtime` 16 个测试文件 **3,275 行**（源码 4,262,比 **0.77**）,含 `dispatch`、`visibility`、
`requestLedgerLifecycle`、`requestLedgerCleanup`、`actorResult`、`lifecycle` 专测;
`state` 7 个文件 **1,766 行**（源码 2,789,比 **0.63**）,`persistence.test.ts` 直测引擎。

⇒ 覆盖是好的,两处硬拆的风险可控。**但测试全绿不等于全覆盖** ——
拆分可以在没有测试的路径上悄悄改掉行为,而 RD-10 抓不到。

⇒ **前置要求**：拆分前先产出一张**职责 → 钉住它的测试**对照表。
**任一职责找不到钉住它的测试,必须先补测试再拆**,⛔ 不得先拆后补。

⚠️ **适用于 §7.1 的全部三处**（含 `InputProvider`）,不只两处 —— 判据是「是否改变执行边界」,不是行数。

⚠️ 这是本专题唯一一处「重构风险」大于「可读性收益」的地方,
所以它是**唯一需要前置补测**的动作。批 2 至批 4 只搬文件与改写法,不动逻辑;
批 5 是新增代码,风险面与拆分不同。

### 7.2 待评审判定

| 位置 | 现状 | 要求 |
| --- | ---: | --- |
| `kernel/base/runtime/src/foundations/createLifecycleEmitter.ts` | 单个函数 **277 行** | 评审判定是否单职责；是则**可留**。⛔ 不因行数拆 |

### 7.3 `createElement` 清除

✅ 亲验现存 **5 处**：

| 位置 | 处置 |
| --- | --- |
| `ui/base/render/src/components/SurfaceRoot.tsx` | 改 JSX |
| `ui/base/render/src/components/ScreenContainer.tsx` | 改 JSX |
| `ui/base/render/src/components/RenderProvider.tsx` | 改 JSX |
| `ui/integration/sample-console/src/assembly.tsx` | 改 JSX |
| `ui/base/render/src/foundations/resolvePart.ts` | ✅ **已判定为明示例外**,登记在 `TR-R03` 表内；并随词表修改移入 `components/`（✅ 亲验第 1-2 行 import `createElement` 与 `Text`,是渲染函数不是纯函数） |

⚠️ 前四处是 Dexter 2026-09-04「不能用 `createElement` 做控件」这条裁定**未执行完**的部分。

---

## 8. 需求五 · 启动结构化日志

### 8.1 底座

✅ 亲验已有且是结构化的：`LoggerPort` 提供 `debug/info/warn/error`、`scope(binding)`、`withContext(context)`；
`LogEvent` 含 `level/category/event/message/scope/context/data/error/security`。
⛔ **不引入新日志库**,不改 `LoggerPort` 契约。

✅ 亲验现状：全仓 logger 调用点仅 **20 处**,**没有任何启动汇总**。

### 8.2 必须打印的七组

| `category` | owner 层 | 数据来源 |
| --- | --- | --- |
| `startup.modules` · `startup.slices` · `startup.commands` · `startup.actors` | `kernel/base/runtime` | 已有的 module descriptors 与 actor registry |
| `startup.ports` | `kernel/base/platform-ports` | ⚠️ **当前不存在,须新增,见 §8.2a** |
| `startup.parts` | `ui/base/render` | uiCatalog／rendererCatalog |
| `startup.surfaces` | ⚠️ **两个 owner,见 §8.2b** | — |

### 8.2a `startup.ports` 的事实来源当前不存在（Codex 评审 M-4,亲验后采纳）

✅ 亲验 `kernel/base/platform-ports/src/types/platformPorts.ts` 第 19-30 行：
`PlatformPortBindings` **只有 10 个端口对象,零 provenance 字段**。

⇒ 「这个 port 是真实实现还是 unavailable」这个事实**在类型里根本不存在**,日志无从打印。

⛔ **两条禁止的凑合做法**：

| 禁止 | 为什么 |
| --- | --- |
| 调用端口去探测状态 | 启动期产生副作用 |
| 按对象 identity 与 `defaults/` 的实例比对 | ✅ 亲验 `adapter/android/device/src/androidDevice.ts` 存在 **partial-real 形态**（unavailable port 上补了一个真实 capability）,identity 比对会误判 |

⇒ **要求**：由 `platform-ports` 的 owner 提供**无副作用的 per-port／per-capability 描述源**,
在绑定时记录来源与实现状态。⛔ 日志侧不得自行推断。

⚠️ **契约边界（Codex 复核确认,写死）**：**默认采用 owner 内部的描述源,不改公共契约。**
✅ 亲验 `PlatformPortBindings`／`CreatePlatformPortsInput`／`PlatformPorts` 三个类型
已从 `kernel/base/platform-ports/src/index.ts` 导出 ⇒ **扩展其中任一个都是公共契约变更**,
而 §2.2 已把改契约列为非目标。⛔ 未经 Dexter 单独裁定不得扩展这三个类型。

### 8.2b `startup.surfaces` 有两个 owner,必须分开（同上）

✅ 亲验：Web 的**实测**尺寸在 `ui/base/dev-host/src/testExpoApp.tsx`；
而 `ui/integration/sample-console/src/terminalSurfaces.ts` 读的是 **package.json 的声明尺寸**。

⇒ 原稿把「实测尺寸」的 owner 指向 integration,**它拿不到实测值,只会把声明值误报成实测值**。

**要求**：两个事实分开命名、分开 owner：

| 事实 | owner | 语义 |
| --- | --- | --- |
| `declaredSurfaceSize` | `ui/integration` | package.json 声明的逻辑尺寸,**仅作基线** |
| `measuredSurfaceFrame` | ⚠️ **承载该 frame 的测量 seam**,即 `ui/base/input/src/components/InputSurfaceFrame.tsx` 第 37 行的 `View.onLayout`（Codex 复核 S-5,采纳：✅ 亲验 Android assembly 只创建装配、`TerminalDualScreenActivityHandler` 只挂 view,**都不产生 measured frame**）。assembly 与 dev-host 只**接收或转发**该事实,⛔ 不是它的 owner | `onLayout` 实测值 |

⛔ 二者不得混用同一字段名,⛔ 不得以声明值冒充实测值。

### 8.3 形态与 owner

七组事实**分散在三层**,没有任何单点能看全 ——
✅ 亲验 `createRuntime` 能看到 modules、descriptors、actorRegistry（**七组里的四组**）;
`ports` 需要 §8.2a 的新描述源;`parts` 在 render;`surfaces` 见 §8.2b。
kernel 层够不着 ui,⛔ 让 assembly 反向掏 kernel 内部去凑齐七组就是破坏分层。

⇒ **每组由该事实的 owner 打印**,共用 `startup.*` 前缀。

### 8.3a 同一次启动的关联与完成语义（Codex 评审 S-5,采纳）

分三批出现的日志,读者无法判断七组是否属于同一次启动 ——
✅ 亲验 `LogContext` 当前**没有** run id、phase 或 sequence 字段。

⛔ **不做跨层聚合**（那会撞 §8.3 的分层约束）。改为在 `data` 中统一记录：

| 字段 | 语义 |
| --- | --- |
| `startupRunId` | 同一次启动的关联键 |
| `phase` / `sequence` | 该组在启动序列中的位置 |

并定义两个终态事件：`startup.complete` 与 `startup.failed`。
⛔ 没有终态事件时,读者分不清「还没打完」与「启动失败了」。

### 8.4 档位约束

⛔ **只在 dev 构建**。`TR-08` 要求编译期剔除,⛔ 不得用运行期 flag。

---

## 9. 验收判据（可证伪）

| # | 判据 | 反例（必红） |
| --- | --- | --- |
| **RD-1** | 每个包 `src/` 下只有三个法定文件 ＋ §4 词表内目录 | 任一包 `src/` 根出现第四个文件,或出现表外目录 |
| **RD-2** | ⚠️ **生产 import graph 中不含 `src/testing/**`**（`./testing` 子路径按裁定保留） | 只检查 `src/index.ts` 的导出符号即放行 —— 那是 false green：符号不在,模块图里在。⚠️ 当下即红：`createRuntime.ts` 第 49-50 行正 import `testing/` |
| **RD-3** | ⚠️ **已删除**。原为「无单元超过 500 行」—— Dexter 2026-09-07 裁定只留「按职责拆」,不设行数硬顶 | — |
| **RD-4** | 业务组件零 `createElement`；`resolvePart` 作为**明示例外**登记在 `TR-R03` 表内 | 在任一业务组件恢复 `createElement`；或新增未登记的例外 |
| **RD-5** | 启动输出含全部七组；每组内容来自 **owner 持有的运行时事实源**,四类之一：`registry`（modules／commands／actors）· `catalog`（parts）· `measurement`（surfaces）· `descriptor`（ports） | 删掉任一组；或把某组改为手写常量。⚠️ **措辞已改（Codex 复核 S-8,采纳）**：原写「真实注册表」会误判 measured frame 与 port descriptor —— 二者本就不是 registry,照原措辞要么被判失败,要么逼实施方虚构一个 registry |
| **RD-6** | 把任一 port 换成 unavailable,`startup.ports` 如实显示 | 该组恒显示为真实实现；或用调用探测／identity 比对得出状态（⚠️ 存在 partial-real 形态,identity 比对必误判） |
| **RD-7** | ⚠️ 启动日志在**生产 entry／bundle graph** 中不可达 | ⚠️ **红夹具（Codex 复核 S-3,采纳）**：让生产 entry import 一个 startup diagnostics 模块,并**故意把 category 写成动态拼接、不含 `startup.` 字面量** —— production graph 门**必须红**。⛔ 只搜字符串的实现会在此夹具下假绿,即判该门不成立 |
| **RD-8** | 每条 `L` 规则有对应门且能红 | 任一 `L` 规则无门 |
| **RD-9** | ⚠️ 任何 `R` 规则**不出现在** checker manifest 中 | 故意把一条 `R` 规则加进 checker manifest,RD-9 必须红。⚠️ **不禁止一切正则** —— 词法类 `L` 规则可用正则；禁的是**用正则声称完成 `R` 语义判断** |
| **RD-10** | ⚠️ 被拆出的**每个职责**都有 focused behavior oracle,且拆分前后**观察结果相同** | 仅比对「测试文件文本未改动」即宣称行为不变（✅ 未覆盖路径的行为改变不会让测试文本变化,原判据抓不到） |
| **RD-11** | ⚠️ 批 4 末尾：**从 `ruleId → 档位` 清单反查**,每一条 `L` 规则都有 enabled checker entry,且全部一次性开启并全绿 | 中途开门（现存违规会让门恒红）；结束时仍有门未开；⚠️ **或某条 `L` 规则漏进 checker manifest 而验收只跑 manifest 里已有的门**（Codex 复核 S-2,采纳：无基线方案若不做反查,会退化成「登记了什么就检查什么」） |
| **RD-12** | 启动日志**未新增任何跨层依赖** | 为凑齐七组让 kernel import ui,或让 assembly 读 kernel 内部结构 |
| **RD-13** | §7.1 **三处**拆分前,每个职责都有钉住它的测试,且职责分母来自 **owning source** | 存在某职责无测试覆盖；或职责分母照抄本文的「至少 N 项」枚举 |
| **RD-14** | `declaredSurfaceSize` 与 `measuredSurfaceFrame` 是两个字段、两个 owner | 用声明尺寸冒充实测尺寸 |
| **RD-15** | 七组日志携带同一 `startupRunId`；有 `startup.complete` / `startup.failed` 终态 | 缺关联键（多次启动交错时无法归组）；或无终态事件（分不清「没打完」与「启动失败」） |

### 9.1 ⚠️ 为什么不建违规基线（对 Codex 评审 M-5 的部分反驳）

M-5 指出的**问题成立**：原稿的基线以**路径**为 key,而批 1–4 恰恰在搬文件 ——
搬完之后违规条目会「看似消失」。这是真缺陷。

⚠️ 但 M-5 给的修法**越界**：它要求建一份含 `ruleId`、`checkerOwner`、`redFixture`、
`symbol identity`、旧路径、新路径、**当前字节 hash**、批次归属的 rule catalog。
CLAUDE.md 明令 **「evidence/package/hash-chain 的台账、分母和交叉对账控制已退役」**
⇒ 为一次可读性整改建 hash 台账,是用评审制造过度设计。

⇒ **最小修法：根本不要基线。** 把门的启用时点挪到**批 4 之后**：

- 批 0 只**定义**规则与 checker manifest,⛔ 不落门;
- 批 1–4 修完代码;
- 批 4 末尾**一次性开启全部 `L` 门,必须全绿**。

没有基线,就没有基线身份问题。⇒ RD-11 据此改写。

⚠️ **仍需保留的那一半**：RD-9 确实需要一份**机器可读的 `ruleId → 档位`清单**与 checker manifest,
否则「R 规则不得做成门」无从验。但它只需**两列**（ruleId、tier）,7 条规则,
⛔ 不需要 hash、路径与批次归属。

---

## 10. 批次与顺序

```
第 3 点（规范）先定 ──┬─→ 第 2 点（结构归位）按规范执行
                     └─→ 第 4 点（启动日志）按规范写新代码
```

✅ **时机无阻**：键盘与形态批次 Dexter 已于 2026-09-07 验收落地。

| 批 | 范围 | 内容 | 规模 |
| --- | --- | --- | ---: |
| **0** | 全仓 | `TR-R01`…`TR-R07` 写入既有规范（每条带反例栏）；建 `ruleId → 档位` 两列清单与 checker manifest；⛔ **不落门、不改代码** | 文档 ＋ 清单 |
| **1** | `kernel/base` | `supports`→`foundations`、⚠️ **`testing/` 按 §5.2a 拆开**（`WeakMap` ＋ `register*` 移入 `foundations/`） ＋ `createCommandDispatcher` 与 `persistenceEngine` **按职责拆**（先出职责→测试矩阵） | 层内 9 包,**触及 2**,**最重** |
| **2** | `kernel/feature` | 12 个散文件归位 | 层内 2 包,**触及 2**,机械 |
| **3** | `ui/base` | `model`→`foundations`、`rnr`→`vendor`、`context.ts`→`contexts/`、`webPlatform`／`webStorage`→`implementations/`、`resolvePart`→`components/`、`primitives` 拆开、`dev-host` 归位、`InputProvider` **按职责拆**、`render` 的 3 处 `createElement` 清除 | 层内 7 包,**触及 4** |
| **4** | `ui/feature` ＋ `ui/integration` ＋ `adapter` ＋ `assembly` | 散文件归位（`variables.ts`→`features/variables/`、3 个 adapter 文件→`implementations/`）＋ `sample-console` 的 1 处 `createElement` 清除 ＋ ⚠️ **末尾一次性开启全部 `L` 门** | 层内 9 包,**触及 7** |
| **5** | 全仓 | 启动结构化日志。⚠️ **依赖批 0–4**：`startup.ports` 需先有 §8.2a 的描述源,`startup.surfaces` 需先按 §8.2b 分开 owner | 新增代码 |

⚠️ **批 1 单独走一轮完整评审**,不与其它批合并 ——
两处最难的职责拆分都在里面,且 `kernel/base` 是全部 27 个包的依赖底座。

---

## 11. 明确不做

目录序号（另立专题）· 改包名/`moduleName`/npm 名 · 改目录层级 · 改业务行为 ·
改 command 契约或 slice 形状 · 引入新依赖 · 重写 `TR-01`…`TR-12` ·
把 `R` 档规则做成正则门 · 生产构建保留启动日志。

---

## 12. 文档性质

正式需求。**不构成设计或实施授权。**
标 ✅ 的事实均为 2026-09-07 打开源码亲验；未标注者为设计规定或推论。
