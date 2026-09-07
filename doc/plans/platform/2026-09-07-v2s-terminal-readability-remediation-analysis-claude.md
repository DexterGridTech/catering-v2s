# TER 可读性整改 · 现状与目标分析稿

> ⚠️ **本文已被正式需求 SUPERSEDE（2026-09-07）。**
>
> 正本是 `doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-requirements-claude.md`。
> 本文只保留**现状实测数据**与**裁定过程**的历史价值，⛔ **其结论不得作为设计或实施输入**。
>
> 以下内容已被推翻，读到时以正式需求为准：
> **500 行硬顶**（Dexter 二次裁定只留「按职责拆」，不设行数上限）·
> **A–J 十组规则**（按规范 §6「没有实例的规则不进本文」砍成 7 条规则 ＋ 5 条既成惯例）·
> **13／14 个目录词表**（现为 **15 个**，新增 `implementations/`）·
> **旧批次范围**（现为三处按职责拆、门在批 4 末尾一次性开启）。

- **性质**：**分析稿,不是需求。** 用于与 Dexter 达成一致后再写正式需求。
- **日期**：2026-09-07 · **作者**：Claude
- **范围**：Dexter 四点中的第 2、3、4 点。第 1 点（目录序号）已裁定为 `apps/terminal/README.md` 层次图,**本稿不含**。

⚠️ 本稿所有数字均为本会话实测,未运行任何构建或测试。

---

## 0. 现状总览

| 事实 | 数值 |
| --- | ---: |
| 包总数 | **27** |
| 源码文件（`src/**`,不含 test） | **302** |
| 源码行数 | **约 19,000** |
| 依赖拓扑深度 | **11 层**,无环 |
| 只有 3 个文件的空壳包 | **6** 个 |
| logger 调用点（全仓、非测试） | **20** 处 |

⇒ 这不是一个大代码库。**19,000 行、302 个文件**的规模,意味着整改是可完成的,不是无底洞。

---

## 1. 第 2 点 · 包结构统一

### 1.1 现状：三类偏离

**（一）`src/` 根有散文件的包 —— 5 个**

| 包 | `src/` 根的散文件 |
| --- | --- |
| `kernel/feature/sample-member-registry` | `commands.ts` `errors.ts` `module.ts` `selectors.ts` `slice.ts` `types.ts`（**6 个**） |
| `kernel/feature/sample-staff-session` | 同上（**6 个**） |
| `ui/feature/sample-member-desk` | `assembly.ts` `commands.ts` `parts.ts`（3 个） |
| `ui/feature/sample-staff-auth` | `assembly.ts` `commands.ts` `parts.ts` `variables.ts`（4 个） |
| `ui/integration/sample-console` | `assembly.tsx` `baseModuleDescriptors.ts` `terminalSurfaces.ts`（3 个） |
| `ui/base/dev-host` | `surfacePreview.ts` `testExpoApp.tsx` `webPlatform.ts` `webStorage.ts`（4 个,**零目录**） |
| `ui/base/input` | `context.ts` `types.ts`（2 个） |

**（二）目录词表不统一**

实测 `src/` 下的一级目录名及其出现次数:

```
features 19 · types 7 · foundations 7 · components 4 · selectors 3 · application 3 · hooks 2
theme 1 · testing 1 · supports 1 · rnr 1 · model 1 · defaults 1 · contexts 1
```

⇒ **7 个名字只出现一次**。其中三组是同概念不同名:

| 概念 | 出现的名字 |
| --- | --- |
| 纯函数层 | `foundations`(7) · `model`(1,在 `input`) |
| 辅助/支撑 | `supports`(1,在 `state`) · `defaults`(1,在 `platform-ports`) · `testing`(1,在 `runtime`) |
| React context | `contexts`(1,目录,在 `render`) · `context.ts`(1,文件,在 `input`) |

**（三）单文件承载整层**

`ui/base/primitives/src/components.tsx` 一个文件里 **24 个导出**,把全部控件类型与实现放在一起。

### 1.2 目标形态

**规则**：`src/` 下只允许 `index.ts` ＋ 目录 ＋ **两个法定例外**（`moduleName.ts`、`dependencies.ts`）。

⚠️ 例外的理由：`terminal-coding-standard.md` §2-A 的门**按 `src/moduleName.ts` 这个路径读**。移动它们要同时改门,收益低于成本。它们是包的身份声明,与 `index.ts` 同级合理。

**全局闭合目录词表（Dexter 2026-09-07 裁定：不按层规定,先有全局词表,各包按需取用,不得自造）**

⚠️ 词表**闭合**：需要一个不在表内的目录时,必须先改这张表并说明为什么现有 14 个都装不下,不得就地新建。

| 目录 | 装什么 | 明确不装什么 |
| --- | --- | --- |
| `types/` | 只有 `type`/`interface`/类型级常量,**零运行时值** | 任何有运行时行为的东西 |
| `foundations/` | 纯函数与纯工厂。不触 store、网络、平台 API（`TR-06` 已有门） | 有副作用的东西、React 组件 |
| `features/` | command 驱动的业务单元。固定三个子目录 `actors/` `commands/` `slices/` | 纯函数（去 `foundations`）、React（去 `components`） |
| `selectors/` | 跨包读的唯一入口（`TR-03`） | 写操作 |
| `application/` | 包的组装与入口：module descriptor、runtime 工厂 | 业务逻辑 |
| `components/` | React 组件,一文件一组件,PascalCase | 非组件 |
| `hooks/` | React hooks,一文件一 hook,`useX` 命名 | 非 hook |
| `contexts/` | React context 定义及其 Provider | 消费 context 的业务组件 |
| `defaults/` | 本包**已声明端口**的默认/不可用实现 | 真实平台实现（去 `adapter/`） |
| `parts/` | part 声明（`definePart` 的产物） | 组件实现 |
| `assembly/` | 装配：把 module、catalog、surface 拼起来 | 业务逻辑 |
| `theme/` | 设计 token | 组件 |
| `vendor/` | 外部代码的仓内拷贝,原样保留不改写 | 自己写的代码 |
| `testing/` | ⚠️ 把生产设施暴露给测试的逃生口。**两条硬约束**：不得从 `src/index.ts` 公开导出；必须可编译期剔除（`TR-08`） | 测试本身（去 `test/`）、生产逻辑 |

**词表的用法**：一个包只取自己需要的。`kernel/base/contracts` 只用 `types/` ＋ `foundations/` 是对的；
`ui/base/render` 用 `components/` `contexts/` `hooks/` `foundations/` `types/` 也是对的。
**没有「每层必须有哪些目录」的规定**,只有「用到的必须来自这张表」。

**现有目录的收敛去向**：

| 现名 | 去向 | 理由 |
| --- | --- | --- |
| `model/`（`input`,5 文件） | → `foundations/` | 实测内容是 `editText`/`keyboardHeight`/`keyboardLayout`/`scrollIntoView`/`snapshot`,全是纯函数 |
| `supports/`（`state`,3 文件） | → `foundations/` | 实测是搭在 `foundations/defineStateRuntimeSlice` 之上的组合层,仍是纯函数 |
| `rnr/`（`primitives`,2 文件） | → `vendor/` | 实测是 React Native Reusables 的仓内拷贝 |
| `testing/`（`runtime`,3 文件） | ✅ **保留为 `testing/`** | Dexter 裁定甲：进词表,加「不得公开导出 ＋ 可编译期剔除」两条约束 |
| `context.ts`（`input`,文件） | → `contexts/` | 同概念在 `render` 是目录、在 `input` 是文件 |
| `src/` 根的散文件 | 按上表归位 | `commands.ts`→`features/commands/`；`slice.ts`→`features/slices/`；`selectors.ts`→`selectors/`；`types.ts`→`types/`；`errors.ts`→`foundations/`；`module.ts`→`application/`；`parts.ts`→`parts/`；`assembly.ts`→`assembly/` |

### 1.3 代价

| 项 | 影响 |
| --- | --- |
| 跨包 import | **零影响** —— 走 npm 包名,不走相对路径 |
| 包内 import | 需批量改,但在包内,机械可做 |
| 文档路径引用 | 受影响的是 `src/` 内层路径。⚠️ 在飞的键盘批次 CP-6 用 symbol anchor 不用行号,但**路径仍是锚点** |
| 门与脚本 | 若有按 `src/` 子路径判定的门需同步 |

---

## 2. 第 3 点 · 编码规范与存量整改

### 2.1 现状：既有规范管什么

`doc/platform/terminal-coding-standard.md`（**667 行**）:

- `TR-01`…`TR-12`：**架构正确性** —— reducer 只由 actor 调、跨包读走 selector、持久化要双断言重启测试、端口禁 `any`、foundations 不触 store、集合先声明形态、调试面编译期剔除、包声明 owner/toolkit、每包中文 README、事件变 command、一个 kernel/feature 配多套 ui/feature
- §2-A/2-B/2-C：**三重命名与依赖方向**

⇒ **它管「架构对不对」,不管「代码好不好读」。** Dexter 要的正是缺的那一层。

### 2.2 现状：实测到的可读性问题

**（一）超大单元 —— 三处**

| 位置 | 体量 | 问题 |
| --- | ---: | --- |
| `kernel/base/runtime/src/foundations/createCommandDispatcher.ts` | 单个函数 **762 行**（第 175 行起） | 一个函数承担派发、深度校验、requestId 校验、预算、ledger 写入、错误归一 |
| `kernel/base/state/src/foundations/persistenceEngine.ts` | 单个类 **559 行**（第 263 行起） | 该包 README 自己写着「队列与 health **七项职责**……现在不拆是因为持久化算法内部耦合紧」 |
| `kernel/base/runtime/src/foundations/createLifecycleEmitter.ts` | 单个函数 **277 行** | 同类 |

⚠️ `persistenceEngine` 那句 README **是自认**：七项职责在一个类里,理由是「耦合紧」。这正是需要裁定的地方 —— 耦合紧是不拆的理由,还是拆的理由。

**（二）单组件承担过多 —— `InputProvider.tsx`**

406 行,**20 个 `useCallback`**,一个组件同时管:字段注册表 CRUD、焦点与失焦、键盘 owner 转换与 preflight、capacity 门控、原子快照、按键处理、layer 边界监听。

**（三）`createElement` 仍在用 —— 5 处**

Dexter 2026-09-04 已明确「不能用 `createElement` 做控件」。实测仍在:

```
ui/base/render/src/components/SurfaceRoot.tsx
ui/base/render/src/components/ScreenContainer.tsx
ui/base/render/src/components/RenderProvider.tsx
ui/integration/sample-console/src/assembly.tsx
ui/base/render/src/foundations/resolvePart.ts   ← 动态解析,可能属合理例外
```

⇒ **前四处是一条已下裁定未被执行完。**

**（四）同名字段两种含义**

`LogEvent.category` 是点分小写（`runtime.lifecycle`、`state.persistence`）;
`AppError.category` 是大写枚举（`SYSTEM`、`VALIDATION`、`BUSINESS`、`AUTHENTICATION`）。
两个类型共用字段名 `category`,含义与命名风格都不同。

另有 `LogEvent.category` 内部的不一致:`display-context` 与 `display-context.power-bridge` 深度不一;出现过一个 `static`。

**（五）文件命名实际上是一致的**

实测 302 个文件:**PascalCase 24 个、camelCase 291 个**,且 24 个 PascalCase 全是组件或 context。
⇒ **这一项不需要整改**,只需要把既成惯例写成规则。

### 2.3 目标：可读性规则集

⚠️ CLAUDE.md 明令**不得用关键词匹配把语义伪装成 checker**。故每条都标档位：
**`L`** ＝ lint 可判 · **`R`** ＝ 只能评审判。⚠️ `R` 类**不得**做成正则门假装已强制。

#### A · 单元边界（Dexter 2026-09-07 裁定）

| 档 | 规则 |
| --- | --- |
| `R` | **先按职责拆** —— 拆分轴是「一个变更理由」,不是行数 |
| `L` | **单职责单元超过 500 行必须再拆**,这是硬顶,不因「耦合紧」豁免 |
| `L` | 一文件一主导出；一文件一 React 组件 |

⇒ 按此裁定,现有必拆两处：`createCommandDispatcher`（762 行）、`PersistenceEngine`（559 行）。
`createLifecycleEmitter`（277）与 `InputProvider`（406）不触硬顶,但按职责应拆
（`InputProvider` 一个组件 20 个 `useCallback`,至少含注册表、焦点、owner 转换、
capacity 门控、快照、按键六个变更理由）。

#### B · 文件内顺序（固定,读者永远知道去哪找）

| 档 | 规则 |
| --- | --- |
| `L` | 顺序固定为：① `import` ② 导出类型 ③ 模块常量 ④ 局部辅助 ⑤ 主导出 |
| `L` | 导出**在定义处**写 `export`,禁止文件末尾的 `export {...}` 汇总块 |
| `L` | 模块常量必须在辅助之前,不得散在文件中段 |

⚠️ 「主导出在最后」是本仓 `const` 箭头函数写法的必然结果。它的代价是读者要先趟过辅助
才看到正题 —— 这个代价由 A 的 500 行硬顶与「辅助过多则外提」共同兜住,不单独立规则。

#### C · React 组件内顺序（固定）

| 档 | 规则 |
| --- | --- |
| `L` | 顺序固定为：① context/store hooks ② 局部 `useState`/`useRef` ③ 派生值 ④ `useCallback` ⑤ `useEffect` ⑥ 早返回 ⑦ `return` 渲染 |

⇒ React 本来就强制 hooks 在前；本条把**其余部分也定死**,消除「这个派生值在哪」的搜索成本。

#### D · 声明位置与作用域

| 档 | 规则 |
| --- | --- |
| `R` | 非 hook 的局部变量**在首次使用处声明**,作用域最小化；不在函数顶部堆一批声明 |
| `R` | **复杂条件必须提取具名变量**。⚠️ 这条对可读性收益最大：`if (a && b \|\| c)` → `const canSubmit = ...` |
| `L` | 魔数必须是具名常量,且常量与使用它的公式在同一文件 |
| `R` | 只用一次且表达式短的,不额外命名（避免为规则而规则） |

#### E · 命名

| 档 | 规则 |
| --- | --- |
| `L` | 组件与 context 用 PascalCase,其余 camelCase（⚠️ **实测已一致**：24/291,本条只是把惯例写成规则） |
| `L` | 布尔用 `is`/`has`/`can`/`should` 前缀 |
| `L` | 事件：prop 叫 `onX`,处理函数叫 `handleX`,两者不得混用 |
| `L` | 工厂 `createX` · 断言 `assertX` · 类型守卫 `isX` · React hook `useX` |
| `R` | 禁止缩写,除非它是领域词（`ime`、`dp` 可以；`cfg`、`mgr` 不行） |
| `R` | **同一字段名在不同类型中不得含义冲突** ⇒ 现存反例：`LogEvent.category` 是点分小写,`AppError.category` 是大写枚举 |

#### F · 导出与 import

| 档 | 规则 |
| --- | --- |
| `L` | 每个目录一个 `index.ts`,**只做再导出**,零逻辑 |
| `L` | 跨目录只从目录 `index` 进,禁止深路径 import |
| `L` | 包的公共面只由 `src/index.ts` 定义；零消费者的 export 必须删（已有先例） |

#### G · 签名

| 档 | 规则 |
| --- | --- |
| `L` | 参数超过 **2 个**必须改对象参数 |
| `L` | 公共面的对象类型全部 `Readonly<>` |
| `R` | **禁止布尔参数** —— `f(true)` 在调用点不可读；改对象字段或拆两个函数 |

#### H · 写法

| 档 | 规则 |
| --- | --- |
| `L` | 业务组件禁 `createElement`（Dexter 2026-09-04 已裁,⚠️ **现存 4 处未清**） |
| `R` | 早返回优于嵌套；嵌套深度超过 3 层须重构 |
| `R` | 不在 JSX 里写多行内联逻辑,提到 ④ 段的 callback |

#### I · 类（本仓仅一处）

| 档 | 规则 |
| --- | --- |
| `L` | 顺序：静态成员 → 构造器 → public 方法 → private 方法 |
| `L` | 同样受 A 的 500 行硬顶约束 |

⚠️ 本仓只有 `PersistenceEngine` 一个类。**本节存在的意义是防止将来再长出第二个 559 行的类**,不是为了现在写很多规则。

#### J · 注释

| 档 | 规则 |
| --- | --- |
| `R` | 注释写**为什么**,不写**做什么**；做什么应由命名表达 |
| `R` | 每个非显然的分支/例外要有一行理由 |
| `L` | 禁止被注释掉的死代码 |

### 2.4 存量整改范围

| 批 | 内容 | 规模 |
| --- | --- | ---: |
| A | 结构归位（第 2 点） | 7 个包 |
| B | `createElement` 四处清除 | 4 文件 |
| C | 超大单元拆分 | 4 处 |
| D | `primitives` 单文件拆开 | 1 文件 → 约 10 |
| E | 词表与命名收敛 | 全仓机械改 |

---

## 3. 第 4 点 · 启动结构化日志

### 3.1 现状

- 底座**已有且是结构化的**：`LoggerPort` 提供 `debug/info/warn/error`、`scope(binding)`、`withContext(context)`;`LogEvent` 含 `level/category/event/message/scope/context/data/error/security`
- 全仓 logger 调用点 **仅 20 处**
- **没有任何启动汇总** —— 现有调用全是事件式（reset completed、persistence 失败等）
- 新人启动 App 后,**看不到装了哪些包、注册了哪些 command、slice 的持久化策略、端口是真是假**

### 3.2 目标：打印什么

「比 POC 更好」的判别标准应是：**打印的是架构事实,不是零散字符串**。候选分组:

| 组 | 内容 | 为什么对人有用 |
| --- | --- | --- |
| `startup.modules` | 每个 module 的 `moduleName`、owner/toolkit、依赖 | 装了哪些包、谁依赖谁 |
| `startup.slices` | `slice.name`、`persistIntent`、`syncIntent` | 持久化与同步是最易错又最不可见的维度 |
| `startup.commands` | `name`、`visibility`、owner module | 公共面有多大 |
| `startup.actors` | actor → 监听的 command | 因果链一眼可见,这是 `TR-11` 的核心 |
| `startup.parts` | `partKey`、`containerKeys`、`displayModes`、`layerTier` | UI 拓扑 |
| `startup.surfaces` | 实际 surface 数、每个的 displayMode 与实测尺寸 | 单/双屏、横/竖屏当场可见 |
| `startup.ports` | 每个 port 是真实实现还是 unavailable | **POC 时代最常见的「以为注了其实没注」** |

### 3.3 约束

⚠️ `TR-08`：调试与自动化面必须**编译期剔除**,不靠运行期开关。
⇒ 启动诊断必须能在生产构建中整体消失,不能用运行期 flag。

### 3.4 可证伪判据

删掉任一组,启动输出缺该组即红;把某个 port 换成 unavailable,`startup.ports` 必须显示为 unavailable。

---

## 4. 三点之间的关系与建议顺序

```
第 3 点（规范）先定 ──┬─→ 第 2 点（结构归位）按规范执行
                     └─→ 第 4 点（启动日志）按规范写新代码
```

理由：结构与日志都是**按规范产出的结果**。规范未定就先动结构,会改两遍。

✅ **时机已解**：键盘与形态那一批 Dexter 已验收落地（2026-09-07）,不再有在飞冲突,
整改可以直接排期。

**建议批次（Dexter 已裁：按层分批）**：

| 批 | 范围 | 内容 | 规模 |
| --- | --- | --- | ---: |
| **0** | 全仓 | 规范定稿 ＋ lint 规则落地（只加门,不改代码） | 文档 ＋ 配置 |
| **1** | `kernel/base` | 结构归位（`supports`→`foundations`、`testing` 按 R-8）＋ 两处必拆（`createCommandDispatcher` 762、`PersistenceEngine` 559） | 9 包,最重的一批 |
| **2** | `kernel/feature` | 6 个散文件归位 × 2 包 | 2 包,机械 |
| **3** | `ui/base` | `model`→`foundations`、`rnr`→`vendor`、`context.ts`→`contexts/`、`primitives` 单文件拆开、`dev-host` 4 散文件归位、`InputProvider` 按职责拆 | 6 包 |
| **4** | `ui/feature` ＋ `ui/integration` | 散文件归位 ＋ `createElement` 清除 | 3 包 |
| **5** | 全仓 | 启动结构化日志（第 4 点） | 新增代码 |

⚠️ **批 1 最重**,两处必拆都在里面,而且 `kernel/base` 是所有包的依赖底座。
建议它单独走一轮完整评审,不与其它批合并。

---

## 5. 待裁决项与已裁结果

### 5.1 Dexter 2026-09-07 已裁

| # | 事项 | 裁定 |
| --- | --- | --- |
| **R-1 / R-2** | 单元体量 | **先按职责拆；单职责超过 500 行必须再拆。** ⇒ `createCommandDispatcher`（762）与 `PersistenceEngine`（559）必拆,「耦合紧」不构成豁免 |
| **§1.2** | 目录词表形态 | **不按层规定。先有全局闭合词表,各包按需取用,不得自造** |
| **§2.3** | 可读性规则 | 进一步扩到声明位置、成员顺序等；**以专业判断为准** ⇒ 已扩为 A–J 十组 |
| **R-3** | 纯函数层统一名 | `foundations`（`TR-06` 已按此名写门） |
| **R-4** | 规范载体 | **并入** `terminal-coding-standard.md`,不另起正本 |
| **R-5** | 整改批次 | **按层分批** |
| **R-6** | 启动日志档位 | **只在 dev 构建**（`TR-08` 要求编译期剔除） |
| **R-7** | 时机 | 键盘批次已验收落地,**无需再等** |

### 5.2 新增待裁：R-8

**`kernel/base/runtime/src/testing/` 怎么处置？**

实测它装的是把生产设施暴露给测试的逃生口 —— `releaseRuntimeForTest.ts` 首行自述
「The resource registry is production lifecycle infrastructure; this module only exposes it to tests.」

⚠️ 与 `TR-08`（调试与自动化面必须**编译期剔除**,不靠运行期开关）有张力：它住在 `src/`,
会被打进生产包。

| 选项 | 说明 |
| --- | --- |
| **甲** | `testing/` 进全局词表,但加约束：不得从 `src/index.ts` 公开导出,且必须可编译期剔除 |
| **乙** | 移出 `src/`,改由各包 `test/` 自行搭建,不再跨包复用 |

✅ **Dexter 2026-09-07 裁定：甲。**
⇒ `testing/` 进全局词表（词表由 13 个增至 14 个）,并带两条硬约束：
① 不得从 `src/index.ts` 公开导出；② 必须可编译期剔除。
须补一条门断言它不在包的公共面上。

⇒ 至此全部裁定完成,可进入正式需求。

---

## 6. 我还没做

- 未写正式需求 —— 等 §5 裁完;
- 未改任何源码、规范或配置;
- 未定目录词表最终形态 —— §1.2 是初稿,按 R-3 收敛;
- 未估工时 —— 取决于 R-1 与 R-5。
