# TER 人类开发者可读性专项 · 需求分析稿

- **性质**：**分析稿,不是需求**。用于和 Dexter 讨论后再定正式需求。
- **日期**：2026-09-07
- **作者**：Claude
- **来源**：Dexter 2026-09-07 提出的四点

⚠️ 本稿只做事实盘点与选项比较,**不预设结论**。需要 Dexter 裁决的集中在 §6。

---

## 0. 一句话结论

四点里 **三点撞上仓内既有硬约定**,不是加法而是改动:

| 点 | 撞上什么 | 性质 |
| --- | --- | --- |
| 1 · 目录带序号 | `terminal-coding-standard.md` §2-A：目录路径 → `moduleName` → npm 包名**三者必须可互推**,且有门 | **正面冲突**,必须先改规则或换实现方式 |
| 2 · 统一 src 结构 | 无冲突,但 `moduleName.ts`／`dependencies.ts` 现在都在 `src/` 根,而 §2-A 的门**按路径读** `src/moduleName.ts` | 小冲突,需一句裁定 |
| 3 · 统一编码规范 | 已有 `terminal-coding-standard.md` 667 行、`TR-01`…`TR-12` ＋ §2 命名与依赖 | **不是从零建**,是补一层 |
| 4 · 启动结构化日志 | `TR-08`：调试与自动化面必须**编译期剔除**,不靠运行期开关 | 约束档位,不阻断 |

---

## 1. 事实盘点（全部亲验）

### 1.1 POC 的目录命名

```
_old_/
├── 0-mock-server/
├── 1-kernel/     ├── 1.1-cores/  ├── 1.2-modules/  └── server-config/
├── 2-ui/         ├── 2.1-cores/  ├── 2.2-modules/  └── 2.3-integrations/
├── 3-adapter/
├── 4-assembly/
└── _package_template_/
```

⇒ 序号在**一级与二级**都出现,三级是包名。

### 1.2 TER 现状：src 一级条目的离散度

亲验 21 个包,按层归纳:

| 层 | 现状 | 问题 |
| --- | --- | --- |
| `kernel/base` | `contracts`：foundations／types<br>`state`：foundations／**supports**／types<br>`platform-ports`：**defaults**／foundations／types<br>`runtime`：application／features／foundations／selectors／**testing**／types<br>`display-context`／`ui-state`：application／features／foundations／selectors／types<br>`transport`／`workflow`／`test-support`：**零目录** | 目录词表不统一（`supports`／`defaults`／`testing` 各一处）；三个包完全没有目录 |
| `kernel/feature` | `sample-member-registry`／`sample-staff-session`：`features/` ＋ **6 个散文件**（`commands.ts errors.ts module.ts selectors.ts slice.ts types.ts`） | 直接违反第 2 点 |
| `ui/base` | `render`：components／contexts／foundations／hooks／types（**最干净**）<br>`input`：components／hooks／model ＋ 2 散文件<br>`primitives`：**`components.tsx` 单个平铺文件** ＋ rnr／theme<br>`dev-host`：**4 个散文件,零目录** | 词表不一致；`primitives` 把全部控件塞一个文件 |
| `ui/feature` | `components/`／`features/` ＋ **4 个散文件**（`assembly.ts commands.ts parts.ts variables.ts`） | 同 kernel/feature |
| `ui/integration` | **3 个散文件,零目录** | 同上 |

⇒ **Dexter 的判断准确。** 最干净的是 `ui/base/render`,最散的是 `dev-host` 与两个 `ui/feature`。

### 1.3 既有编码规范覆盖了什么

`doc/platform/terminal-coding-standard.md`（667 行）:

- `TR-01`…`TR-12`：**架构规则** —— reducer 只由 actor 调、跨包读走 selector、持久化要双断言重启测试、端口禁 `any`、foundations 不触 store、集合要先声明形态、调试面编译期剔除、包要声明 owner／toolkit、每包中文 README、事件变 command、一个 kernel/feature 配多套 ui/feature
- §2-A／2-B／2-C：**三重命名与依赖方向**

⇒ **缺的正是 Dexter 要的那一层**：文件内的组织、命名粒度、调用写法、可读性。
既有规范管「架构对不对」,不管「代码好不好读」。

### 1.4 启动日志的现有底座

`LoggerPort` 已存在且是结构化的:

```ts
interface LoggerPort {
  debug/info/warn/error(input: LogWriteInput): LogWriteResult;
  scope(binding: LogScopeBinding): LoggerPort;
  withContext(context: LogContext): LoggerPort;
}
// LogEvent: level / category / event / message / scope / context / data / error / security
```

`createRuntime.ts` 已在用 `logger.scope({...})` 与 `logger.info({category, event, message, data})`。

⇒ 第 4 点**不需要造 logger**,只需要定「启动时打什么、怎么排版、什么档位」。

---

## 2. 第 1 点 · 目录带序号

### 2.1 冲突的确切内容

`§2-A` 原文（第 527-543 行）:

```
目录路径     kernel/base/contracts
moduleName   kernel.base.contracts                  ← 目录路径用「.」连接
npm 包名     @catering-v2s/kernel-base-contracts    ← moduleName 用「-」连接 + scope
```

并写明 `moduleName` 是**命名空间真相源**：command key、actor key、slice key、error key、
parameter key、日志 scope **全部由它派生**。附**门**：断言三者可互推；附红夹具。

⇒ 若目录变成 `1-kernel/1.1-base/contracts`,按现规则 `moduleName` 就是
`1-kernel.1.1-base.contracts` —— **全系统的 command／slice／error key 全变**,
npm 名还会出现非法的 `1.1`。

### 2.2 三个选项

| 选项 | 做法 | 代价 |
| --- | --- | --- |
| **甲** | 改 §2-A：`moduleName` 由**剥掉序号前缀后**的路径派生；门也先剥再断言 | 规则改一句、门改一处；**所有 key 不变**。但目录一改,全仓文档里的路径引用全部失效 |
| **乙** | 只给不参与身份派生的层加序号 | ❌ **不可行** —— `kernel`／`base`／`contracts` 三级全都参与派生,没有中立层 |
| **丙** | 目录不动,顺序另外表达：`apps/terminal/README.md` 给一张带序号的层次图与开发顺序 | 零冲突、零迁移成本;但「一眼看出」要打开一份文档,不是看目录树 |

### 2.3 甲的隐藏代价（必须先说清）

1. **全仓路径引用失效。** 需求、详设、实施计划、评审、evidence 里大量 `apps/terminal/ui/base/input/src/...` 形式的引用会一次性变陈旧。仅本会话产出的文档就有十余份。
2. **与在飞批次相撞。** 键盘与形态那一批刚授权进入实施,CP-0…CP-6 的锚点全是路径。目录改名会和它正面冲突。
3. **脚本与配置。** workspace glob、tsconfig paths、`scripts/check/*` 里按路径判层的逻辑都要改。

⚠️ 第 2 条是时机问题,不是技术问题 —— 见 §6 的 Q-C。

---

## 3. 第 2 点 · 统一 src 结构

### 3.1 目标形态（待裁定）

Dexter 的要求是「`src` 下只有一个 `index` 和各个目录」。⇒ 需要一份**按层固定的目录词表**。

初步建议（**不是结论**）:

| 层 | 目录词表 |
| --- | --- |
| `kernel/base` | `application/`（组装与生命周期）· `features/`（actors／commands／slices）· `foundations/`（纯函数）· `selectors/` · `types/` |
| `kernel/feature` | 同上;现在散在 `src/` 根的 `commands.ts`／`slice.ts`／`selectors.ts`／`errors.ts`／`types.ts`／`module.ts` 分别归位 |
| `ui/base` | `components/` · `hooks/` · `contexts/` · `model/`（纯编辑／几何模型）· `foundations/` · `types/` |
| `ui/feature` | `components/` · `features/`（actors）· `parts/`（part 声明）· `types/` |
| `ui/integration` | `assembly/` · `config/` · `types/` |

⚠️ **`model/` 与 `foundations/` 是否重复**需要裁定 —— `input` 用 `model`,`render` 用 `foundations`,两者都是纯函数层。建议**二选一统一**。

### 3.2 `moduleName.ts` 与 `dependencies.ts` 的去留

这两个文件在**每个包**的 `src/` 根,且 §2-A 的门**按 `src/moduleName.ts` 这个路径读**。

| 选项 | 说明 |
| --- | --- |
| **甲** | 声明为「`src` 根的两个法定例外」,与 `index.ts` 并列 |
| **乙** | 移到 `src/meta/`,同步改门的读取路径 |

建议**甲** —— 它们是包的身份声明,和 `index.ts` 同级是合理的;移动只为满足字面规则,收益低于改门的成本。

### 3.3 `primitives` 是单独一案

`ui/base/primitives/src/components.tsx` 把**全部控件塞在一个文件**。这不是目录问题,是**文件粒度**问题,归第 3 点管。

---

## 4. 第 3 点 · 统一编码规范

### 4.1 定位：补一层,不是重建

既有 `terminal-coding-standard.md` 管**架构正确性**。Dexter 要的是**可读性与一致性**,是另一层。

⇒ 建议形态：在同一份文件内**新增一节**（如 §3 · 可读性与一致性,规则编号 `TR-R01` 起），
**不另起新文件** —— 理由是仓内已有教训「规范载体缺失」,再开一份会造成第二个正本。

### 4.2 候选规则域（待裁定取舍）

| 域 | 候选内容 |
| --- | --- |
| 文件粒度 | 一个文件一个主导出;组件一文件一控件;超过 N 行必须拆（N 待定） |
| 命名 | 目录用复数、文件用主导出同名、布尔前缀 `is/has/can`、异步不加 `Async` 后缀、事件处理 `handleX` 与 prop `onX` 分离 |
| 导出 | 每个目录一个 `index.ts` 只做再导出;禁止深路径跨目录 import |
| 调用写法 | 禁止 `createElement` 写业务组件（已有先例：Dexter 2026-09-04 已裁）;early return 优于嵌套;禁止在 JSX 里写多行内联逻辑 |
| 类型 | 公共面全部 `Readonly<>`;禁止 `any`／`Record<string, unknown>`（已在 `TR-05`,此处只做指针） |
| 注释 | 注释写「为什么」不写「做什么」;每个非显然的分支要有一行理由 |

### 4.3 ⚠️ 强制手段的边界

CLAUDE.md 明令：**不得用关键词／字段匹配把语义伪装成 checker**。

⇒ 每条可读性规则必须标明档位:

| 档位 | 手段 |
| --- | --- |
| **机器可判** | lint 规则（命名、导出形态、文件行数、禁用 API） |
| **评审可判** | 职责单一、注释是否说清为什么、抽象是否过度 |

⚠️ **不得**把「评审可判」的规则做成正则 checker 假装已强制。

---

## 5. 第 4 点 · 启动结构化日志

### 5.1 约束：`TR-08`

`TR-08` 要求调试面**编译期剔除**,不靠运行期开关。⇒ 启动诊断日志必须能在生产构建中整体消失,不能用 `if (__DEV__)` 之外的运行期判断。

### 5.2 「核心要素」候选清单（待裁定）

比 POC 做得更好,意味着打印的是**架构事实**而非零散字符串。候选:

| 组 | 内容 | 为什么对人有用 |
| --- | --- | --- |
| 模块注册表 | 每个 module 的 `moduleName`、owner／toolkit、依赖 | 一眼看出装了哪些包、谁依赖谁 |
| slice 表 | `slice.name`、`persistIntent`、`syncIntent` | 持久化与同步策略是最容易出错又最不可见的维度 |
| command 表 | `name`、`visibility`、owner module | 看出公共面有多大 |
| actor 接线 | actor → 监听的 command | 因果链一眼可见,这是 TR-11 的核心 |
| part／renderer catalog | `partKey`、`containerKeys`、`displayModes`、`layerTier` | UI 拓扑 |
| surface 拓扑 | 实际 surface 数、每个的 displayMode 与实测尺寸 | 单／双屏、横／竖屏当场可见 |
| 端口注入状态 | 每个 port 是真实实现还是 unavailable | POC 时代最常见的「以为注了其实没注」 |

### 5.3 形态建议

- 一次性、分组、对齐的表格式输出,不是散落的 `console.log`;
- 走既有 `LoggerPort`,不新引入日志库;
- 每组一个 `category`（如 `startup.modules`／`startup.slices`）,便于过滤;
- **可证伪判据**：删掉任一组,启动日志缺该组即红。

---

## 6. 需要 Dexter 裁决的问题

| # | 问题 | 我的建议 |
| --- | --- | --- |
| **Q-A** | 目录序号：选甲（改 §2-A 派生规则,剥前缀）、还是丙（目录不动,用一份带序号的 `README` 表达顺序）？ | ⚠️ **先回答这个,它决定整个专题的规模。** 我倾向先听你的意图：你要的是「文件树本身有序」,还是「顺序可发现」？若是后者,丙的成本是甲的十分之一 |
| **Q-B** | 若选甲,序号只加到二级（`1-kernel/1.1-base/`）还是三级也加？ | 建议只到二级。三级是包名,加序号会让包名与目录名不一致,又撞 §2-A |
| **Q-C** | 时机：键盘与形态那一批刚授权实施,目录整改是**等它落地后**做,还是**先做**再实施？ | 建议**等它落地**。两批都动同一批文件,并行会互相推翻 |
| **Q-D** | `model/` 与 `foundations/` 二选一统一成哪个？ | 建议 `foundations/` —— 既有规范 `TR-06` 已经按这个名字写了门 |
| **Q-E** | `moduleName.ts`／`dependencies.ts` 留在 `src/` 根（法定例外）还是移进 `src/meta/`？ | 建议留在根 |
| **Q-F** | 可读性规范是并入现有 `terminal-coding-standard.md`,还是另起一份？ | 建议并入,避免第二个正本 |
| **Q-G** | 存量整改的批次粒度：一次性全仓改,还是按层分批（先 `kernel/base`,再 `ui/base`…）？ | 建议按层分批。一次性全改会产生无法评审的巨型 diff |
| **Q-H** | 启动日志：只在 dev 构建打印,还是生产也保留一个精简版？ | 建议只在 dev。`TR-08` 要求编译期剔除,保留精简版会引入运行期开关 |

---

## 7. 我还没做、也不该现在做的事

- 不写正式需求 —— 等 §6 裁完再写;
- 不改任何源码或规范文件;
- 不预设目录词表的最终形态 —— §3.1 是初稿,要按 Q-D 的结果收敛;
- 不估工作量 —— 规模取决于 Q-A 与 Q-G。
