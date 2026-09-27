# 评审规范 · 只规定动作

- 建立:2026-08-20 · 作者:Claude
- 适用:一切 review 动作 —— 实施后复核、独立盲审、设计复核、体验问题回溯。
- 入口 skill:`cs-review`。**一提到 review,先调它。**

## 0 · 本文的边界(最重要的一条)

**判据不在本文。** 本文只规定三件:**必须做哪些动作** · **每个动作到哪里取判据** · **产出必须长什么样**。

⛔ **本文出现任何「什么是对的 / 什么是错的」都是重复,应当删除并改为指向正本。**
一条规则同时住在规范和评审规范里,两处就会漂,而漂了没人知道 ——
这正是 `foundation-charter.md` §3-D 与前端规范 §3-E 讲的同一件事。

### 判据的唯一住址(本文只引用,永不复述)

| 要判的是什么 | 唯一住址 |
|---|---|
| 底座、owner 主权、集合形态、分母、门的形态、声称≠行为 | `doc/platform/foundation-charter.md` |
| 后端怎么写才算对 | `doc/platform/backend-coding-standard.md` |
| 前端怎么写才算对 | `doc/platform/frontend-coding-standard.md` |
| **这一批**该长什么样 | 本批的 IA · 交互工件 · implementation-facing 详设 |
| 设计文档本身该含什么 | `doc/decisions/templates/` 四份模板 |
| 已登记的失败模式与正例 | `project-memory/` |
| 业务语义、术语、已确认事实 | `project-memory/decisions/confirmed-business-language-corpus.md` |

**取判据的顺序**:先本批设计文档(它最具体)→ 再领域规范 → 再 charter → 再项目记忆。
冲突时**更具体的那份优先**,并把冲突本身记为 finding。

---

## 1 · 先声明被审对象,它决定动作序列

```text
REVIEW_TARGET=DESIGN | IMPLEMENTATION | EXPERIENCE_RETROSPECTIVE
```

**动作 1 有三个版本,按被审对象选一。选错或不选,本轮无效。**

| 被审对象 | 代码在不在 | 走哪个动作 1 |
|---|---|---|
| `DESIGN` — 只有设计文档,代码未写 | 不在 | **动作 1-B** |
| `IMPLEMENTATION` / 体验类 `EXPERIENCE_RETROSPECTIVE`(用户看到的东西不对) | 在 | **动作 1-A** |
| 过程类 `EXPERIENCE_RETROSPECTIVE`(交付拖延、反复失败) | 在 | **动作 1-C** |

⛔ **零产出即停机,不得当作通过。**
动作 1-A 在没有目标源码时会产出空清单,动作 1-B 在没有目标文档时同样 ——
**空清单一律判为"选错了动作序列"或"输入不全",必须停下来说明,⛔ 不得据此写 PASS。**

> 为什么单列这条:2026-08-20 的演练里,子 agent 自己指出动作 1 假定被审对象是代码,
> 那轮能跑通**纯属该批已经实施**;换一批只有设计文档的,
> **它会静默产出零行而流程不报错** —— 比缺一个动作更坏。

### 动作 1-A · 从代码提取用户可见事实(代码已存在时)

**为什么是动作而不是"仔细看"**:读代码告诉你**存在什么**,不告诉你**渲染成什么**。
2026-08-20 的 21 条体验问题里,20 条属于后者。

对每个改动过的 feature 目录跑一次:

```bash
python3 - <<'PY'
import io,re,glob
for f in sorted(glob.glob('apps/frontend/*/src/features/<FEATURE>/ui/*.tsx')):
    s=io.open(f,encoding='utf-8').read(); print(f"\n--- {f.split('/')[-1]}")
    cols=re.findall(r"title:\s*'([^']+)'\s*,\s*dataIndex:\s*'(\w+)'",s)
    if cols: print("  表格列:",[f"{t}<-{d}" for t,d in cols])
    if re.findall(r"extra=\{",s): print("  header 右侧动作区:",len(re.findall(r"extra=\{",s)),"处")
    lab=re.findall(r"label:\s*'([^']+)'",s)
    if lab: print("  可见标签:",lab[:20])
    forms=re.findall(r"<Form\.Item\s+label=\"([^\"]+)\"[^>]*name=\"(\w+)\"",s)
    if forms: print("  表单字段:",[f"{l}<-{n}" for l,n in forms])
    msg=re.findall(r"message:\s*'([^']+)'",s)
    if msg: print("  校验提示:",msg)
    zh=re.findall(r"[一-鿿]{8,}",s)
    if zh: print("  长中文串:",zh[:5])
    en=re.findall(r"\w+\s*===\s*'[A-Z_]+'\s*\?\s*'[^']+'\s*:\s*'[^']+'",s)
    if en: print("  前端自造枚举文案:",en)
PY
```

**产出**:一张事实清单。**本动作只产出事实,不下判断。**
⚠️ 清单为空 ⇒ 按 §1 的停机规则处理,不得记 PASS。

### 动作 1-B · 从设计文档提取应然事实(代码尚未存在时)

代码不在,就没有"渲染成什么"可提。此时的等价动作是**把设计文档该有而没有的、
以及各文档之间互相矛盾的地方提出来** —— 三样,缺一不可:

| 提取什么 | 怎么做 | 依据住址 |
|---|---|---|
| **模板必填项的缺项** | 逐份文档对照它该用的模板,列出**缺失的整节或整列** | `doc/decisions/templates/` 四份模板 |
| **文档之间的矛盾** | 同一事实在 IA / 交互工件 / 详设 / 串行计划里各写了什么,逐条比 | IA 模板 §5 交叉对账 |
| **无出处的具体数值与形态** | 文档里出现的上界、阈值、页大小、枚举取值,逐个问"哪份文档决定的" | 详设模板(预期规模 · 未决项处置) |

> 2026-08-20 演练的三条 M 正好各出自这三行:
> 缺整节(详设 §3 横切机制表缺失)· 文档打架(IA 说不分页 / 交互工件说标准分页表格)·
> 无出处数值(`BOUNDED_READ_LIMIT=100` 四份文档零处,而它会让第 101 条抛 HTTP 500)。

**产出**:一张缺项与矛盾清单。**同样只产出事实,不下判断;为空同样按停机规则处理。**

⚠️ 模板缺项必须**逐节**列出(有 / 缺 / `NOT_APPLICABLE`),并写进 §5 的 `TEMPLATE_COVERAGE`;挑重点核对不算执行了本动作。

> 实证:2026-09-24 门店终端批的详设缺 §3a 控件分母表,两轮作者盲审与两轮 Claude 设计评审都没发现,
> 实施时 L2 跑了 36 次只通过 1 次。

### 动作 1-C · 从运行产物与过程记录提取事实(过程回溯)

问题出在过程(交付拖延、同一失败反复出现)而不是用户可见体验时,提取四样,缺一不可:

| 提取什么 | 怎么做 |
|---|---|
| **运行时间线** | 按开始时间列出本批每一次受管运行(L2、acceptance、reset、seed,含旁路运行根目录),各写结果与首败 |
| **当前字节的真实状态** | 用最新一次运行与最后一次通过的字节绑定,逐文件比对当前字节 |
| **应有的过程记录** | 逐项查仓内是否有:§3a 准入、CP 对账、整体对账、seed 试运行、逐代码对账 |
| **规则出处** | 每类失败对应的正本条款在哪,它在动作发生时是文字还是工具检查 |

**产出**:事实清单,不下判断;为空同样按停机规则处理。

### 动作 2 · 与本批设计文档逐条对账

把动作 1 的每一项拿去对账。**对账对象随动作 1 的版本变**:

- 走了 **1-A**:与本批 IA 的可见维度 + 交互工件的 `USER_VISIBLE_COPY` 比(下表);
- 走了 **1-B**:与四份模板的必填项、以及各设计文档彼此比 —— 判据住址见 1-B 表。

| 提取到的 | 对账对象 | 判据住址 |
|---|---|---|
| 表格列与首列 | IA `controlType` | 本批 IA |
| `extra=` 有无 | IA `controlType`(动作位置) | 本批 IA |
| 可见标签、Tab 归属 | IA `entryAndSurface` | 本批 IA |
| 表单字段与校验提示 | IA `controlType`(编辑态) | 本批 IA |
| 长中文串 | 交互工件 `USER_VISIBLE_COPY` | `ui-interaction-design-template.md` |
| 前端自造枚举文案 | —— | `frontend-coding-standard.md` **§3-A / §3-E** — 该规范无「枚举文案」字样,判据是这两条通则(同一件事一种写法 · 同一事实一个住址) |

**不一致 ⇒ finding。IA 没写 ⇒ 记为设计侧缺口(见 §2),⛔ 不得因"文档没写"就放行。**

### CP 阶段级独立对账 · 在下一 CP 前完成

独立三维对账的单位是实施计划明确列出的一个完整 CP 阶段。CP 内部的工作项、文件修改、单个 focused proof 或修复都不是新的独立对账关卡。主 agent 完成该 CP 内的全部实现、修复和 focused proof 后、开始下一 CP 前，必须交由 fresh `INDEPENDENT_SUBAGENT` 对整个 CP 对账。没有 CP 划分的任务，仅以计划明确列出的完整批准阶段为单位；不得从单个改动点自行拆出 review 阶段。主 agent 可以设计和实施，但不得对自己刚完成的 CP 作出对账结论。

CP reviewer 必须从该 CP 的 RECALL、IA/交互工件/implementation-facing 详设、owning source、实现、focused proof 及各改动点的前后读回中提取事实，再以证伪为目标逐条比较：行为、形态、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界。输出只能是该 CP 的 `MATCHED` 或逐项 `OPEN`，并指向精确 source/design 位置；不得用“整体看起来一致”、静态通过或后续 L2 代替。CP 内单个改动点的前后读回和 focused proof 仍须完成，但不各自启动 fresh reviewer。

`OPEN` 时，主 agent 必须先按同根范围修复，再由另一 fresh 独立子 agent 对同一个完整 CP 复查后才能开始下一 CP。CP 阶段级对账是实施过程的质量闸，不是整批 `REVIEW_TARGET=IMPLEMENTATION` verdict：不写 `GO`/`NO-GO`，本身不设轮次上限，也不能替代最后的整批独立 review。

### 动作 3 · 同族全集扫描

任何 finding 都要枚举**本批该形态的全集**并逐个判定,在交付里写明"其余 N 个已核对"。

> 为什么单列成动作:2026-08-19 的读侧授权 finding 只修了 6 个接口里的 1 个;
> 2026-08-20 的中文名称修复只接了 2 个同类组件里的 1 个。**两次都是点状止血。**

判别式:**这条规则适用于几个页面/几个接口/几个组件?写不出全集,就是还没扫。**

### 动作 4 · 列未验证清单

把本轮用户可见事实分三档:**静态已证** · **测试已证** · **无人验证**。

> 为什么必须单列:2026-08-19 我写了"本轮为静态复核,未运行浏览器" ——
> **准确,但读的人无法据它决策**。Dexter 读到 `GO`,合理期待一个能用的页面。
> **不是他误读,是结论少了这张表。**

### 动作 5 · 按固定形态收口

```text
REVIEW_TARGET=<DESIGN | IMPLEMENTATION | EXPERIENCE_RETROSPECTIVE>
ACTION_1_VARIANT=<1-A 代码提取 | 1-B 文档提取 | 1-C 过程提取>   ← 与 REVIEW_TARGET 不匹配即本轮无效
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>   ← 严重度定义见 project-memory/operations/verification-governance.md
L1_ENGINEERING=<PASS / findings>          ← 不变量、范围外改动、证据档位、反向 PROOF
L2_USER_VISIBLE=<PASS / findings>         ← 缺这一行的 UI-bearing 复核无效
L3_UNVERIFIED=<空 / 逐条列出>             ← 非空时 VERDICT 只能是 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=<每条 finding 的全集与判定>
DESIGN_GAPS=<评审中发现的、正本里缺判据的条目>
TEMPLATE_COVERAGE=<DESIGN 必填:四份模板逐节 有 / 缺 / NOT_APPLICABLE>
EVIDENCE_TIER=<按 charter 与实施话术的档位定义>
```

---

## 2 · 评审中发现"正本里没有这条判据"怎么办

**记为设计侧缺口,交回设计侧补进正本。⛔ 不得就地在评审里立规则。**

理由:评审就地立的规则没有正本,下一轮没人读得到,而它又会被当成先例 ——
规范就是这样散落的。

**已闭合的一例(留作样板)**:「列表首列必须是业务名称且可点进详情」
在 2026-08-20 的评审中发现全仓无正本。按本节处置 ——
Dexter 裁定它是**通用 UI 约定**,已进 `frontend-coding-standard.md` §3-I,**没有留在本文**。
⚠️ 同时裁定:IA 模板也**不该**包含这条具体规则,只需要求"读前端规范并应用" ——
它是众多前端规范之一,往模板里搬会开始复制整本规范。

## 3 · 三层的分工与既有依据

| 层 | 验什么 | 依据 |
|---|---|---|
| **L1 工程不变量** | 不变量 · 范围外改动 · 证据档位 · 反向 PROOF | `agent-operating-model.md` §8 原四件 |
| **L2 用户可见事实** | 动作 1+2 | 本文新增 |
| **L3 未验证清单** | 动作 4 | 本文新增 |

⚠️ **只做 L1 已被证伪**:2026-08-19 按 L1 评审给出 `GO`,2026-08-20 首次体验发现 21 条问题,
而那轮 5 条 finding **零条关于用户看到什么**。

## 4 · 维护约定

- 本文与两份 coding-standard、charter 平级,是**评审侧动作的唯一权威**。
- 新增动作前先过收录尺度(见 `doc/decisions/templates/implementation-design-template.md`):
  **这次真的坏在它上面 · 漏了不报错 · 评审者必然要做这个判断**。
- **新增判据一律不进本文** —— 送去它该在的正本。
- `agent-operating-model.md` §8 与 `cs-review` skill 指向本文,不再各自带清单。

## 5 · 评审产物命名归属

- 外部 Claude 创建的评审文件使用 `-claude` 后缀，继续遵守 `CLAUDE.md` 的写入边界；
- Codex 创建的文件一律使用 `-codex` 后缀，包括 Codex 作者 intake、reconciliation，以及由 Codex 调度的 `INDEPENDENT_SUBAGENT` review；
- 子 agent 的独立性由文件内 `reviewerKind=INDEPENDENT_SUBAGENT`、轮次、盲审声明和输入清单证明，不由后缀证明；
- 本约定只约束后续新建文件，历史文件不回改名。这样文件名能直接表达外部 Claude 与 Codex 侧产物归属，同时不新造第三套后缀。
