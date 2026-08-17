# 让实施 agent 一次做对 · 实施输入

- 日期:2026-08-17 · 作者:Claude · **第 3 版**(前两版经四轮盲审,均判不可执行)
- 本文只写**当前状态**与**要做的事**。更正史在
  `doc/review/platform/2026-08-17-v2s-agent-enablement-review-log-claude.md`。

## 0 · 这份文档的事实从哪来

§1 那张表**不是我手写的**,是脚本输出。这一点是本版最重要的改动。

前两版的事实是我用临时 shell 命令采的,**那些命令本身错了七次以上**:
`timeout` 本机不存在(整轮空跑被读成全绿)· 用 bash 跑 node 脚本 · 把信息行当失败标识 ·
zsh 展开 `--include=*.java` · 正则转义 · 用 `git status` 核批次范围 ·
**用正则解析 `verify.mjs` 而它写的是 `Object.freeze([`,于是静默返回空、把「静态档 10 道门」读成 0**。

⇒ **表由 `scripts/check/all` 生成**(本批要建,见 §3 第 1 步)。
它 `import` `verify.mjs` 导出的数组来判档位,**不解析源码**;并在结果为空时**抛错而不是返回空**。

## 1 · 门的当前状态(41 道)

**分母:`41 = 25 绿 + 13 红 + 2 需 `--file` + 1 跳过`**
**档位:`static 10 · runtime 5 · 未接线 26`**
**13 道红,全部未接线。**

⚠️ `--validate-only` **只跑 static 档那 10 道**。runtime 档那 5 道
(`contract-face` · `edge-codegen` · `retirement` · `flyway-layout` · `affected-l2`)
实施者日常**跑不到**。

⚠️ 跳过的那道是 `backend-formatting-bytecode.mjs`。**理由是它跑 gradle 且写 `.runtime/`,慢** ——
**不是**因为它改仓内 Java。我此前多处声称它「会改仓内 Java」,**那是错的**:
读源码可见它 `mkdtempSync` → 复制仓库快照 → 在**临时副本**上 `spotlessApply` → `rmSync`。

| 门 | 档位 | 状态 | 处置 |
|---|---|---|---|
| `admin-boundaries` | 未接线 | 绿 | 接线候选 |
| `affected-l2` | runtime | 绿 | 保持 |
| `agent-lifecycle` | 未接线 | 绿 | 接线候选 |
| `authority-source-ledger` | 未接线 | **红** rc=1 | **待按条核** — 冻结 7 行 path+sha256 |
| `backend-boundaries` | static | 绿 | 保持 |
| `backend-formatting-bytecode.mjs` | 未接线 | 跳过 | 按需工具,不接线 |
| `business-terminology-traceability` | static | 绿 | 保持 |
| `capability-invariants` | 未接线 | **红** rc=1 | **修 4 行生产代码** — 见 §3 第 4 步。⛔ **不要砍 97 冻结**,它当前正确 |
| `catalog-inventory-p1` | 未接线 | 绿 | 接线候选 |
| `catalog-inventory-p2` | 未接线 | **红** rc=1 | **修脆性 + 瘦身** — 硬编码路径致崩;砍 32 条存在性断言,**留** 43 operation 跨源集合 · consumerFaces 基数 · 21 条禁止句 |
| `claude-review-handoff` | 未接线 | 需 `--file` | 按需工具,不接线 |
| `code-layout` | static | 绿 | 保持 |
| `codex-self-review` | 未接线 | 需 `--file` | 按需工具,不接线 |
| `contract-face` | runtime | 绿 | 保持 |
| `database-boundaries` | static | 绿 | 保持 |
| `edge-codegen` | runtime | 绿 | 保持 |
| `flyway-layout` | runtime | 绿 | 保持 |
| `flyway-test-locations` | 未接线 | 绿 | 接线候选 |
| `foundation-standard-actions` | 未接线 | **红** rc=2 | **随上一道** — 它的耗时是转调 `provider-free-context`,非独立成本 |
| `frontend-architecture` | static | 绿 | 保持 |
| `gate-0` | 未接线 | **红** rc=1 | **删除入口** — 前置条件(`apps/` 为空)永久为假 |
| `handoff-debt` | 未接线 | **红** rc=1 | **瘦身** — 砍 `rows.length === 7`;**留** trigger 语法与 anchor 逐行存在 |
| `heritage-registry` | 未接线 | 绿 | 接线候选 |
| `logging-boundaries` | static | 绿 | 保持 |
| `module-dependency-registry` | 未接线 | 绿 | 接线候选 |
| `name-code-density.mjs` | static | 绿 | 保持 |
| `openapi-contracts` | static | 绿 | 保持 |
| `operation-handler-bindings` | 未接线 | **红** rc=1 | **待按条核** — 冻结 route digest |
| `production-conformity` | 未接线 | 绿 | 接线候选 |
| `project-memory` | 未接线 | 绿 | 接线候选 |
| `protable-compact.mjs` | 未接线 | **红** rc=1 | **修代码 + 砍冻结** — 见 §3 第 3 步(**两个动作缺一门仍红**) |
| `provider-free-context` | 未接线 | **红** rc=2 | **先修性能再谈去留** — 见 §3 第 6 步 |
| `query-boundaries` | 未接线 | 绿 | 接线候选 |
| `r5-edge-materialize` | 未接线 | **红** rc=1 | **待按条核** — `cpSync` 整仓致 EBADF |
| `retirement` | runtime | 绿 | 保持 |
| `roadmap-control-plane-transfer` | 未接线 | **红** rc=1 | **待按条核** — 一次性移交收据 + 冻结 hash |
| `roadmap-program-registry` | 未接线 | 绿 | 接线候选 |
| `rp12-final-state` | 未接线 | **红** rc=1 | **修代码** — 见 §3 第 2 步(**两处**) |
| `runtime-environment-keys` | static | 绿 | ⚠️ **绿但有洞** — 见 §4 |
| `security-boundaries` | 未接线 | **红** rc=1 | **待裁** — 13 道红里唯一可能是活缺陷的,见 §4 |
| `ui-wireframe-traceability` | static | 绿 | 保持 |

**处置的判据**(前一版删掉了这条,导致「删除 vs 瘦身」成了无理由断言,现补回):

> **门是断言的集合。价值与成本按「条」分布,不按「门」分布。**
> **除非一道门的每一条断言都已失效,否则正确处置是瘦身而非删除。**

⇒ 所以每一条「瘦身」都必须同时写明**砍什么**和**留什么**。只写砍什么的指令没有下界。

---

## 2 · 入口文件的事实

四份入口文件对 backend-acceptance 说法互斥。**真值 = 28**:

```bash
grep -rho '@AcceptanceScenario' apps/backend/catering-business-server/src/test/java --include='*AcceptanceScenarios.java' | wc -l
```

| 文件 | 它现在说什么 | 判定 |
|---|---|---|
| `AGENTS.md` | 28 条 · 196 个 provider | ✅ |
| `HANDOFF.md` | 28 条 | ✅ |
| `scripts/README.md` | 28 条 | ✅ |
| `CLAUDE.md` | 18 条 + Catalog 8 条(= 26) | ❌ Catalog 实为 **10** |
| `PLATFORM-BLUEPRINT.md` | 只验证 `getPublicInvitationView` · 197 个 provider 是「**未来待办目录**」 | ❌ **不止数字错** |

⚠️ **`PLATFORM-BLUEPRINT.md` 只改数字改不掉它的错** —— 其余三份说 provider「**已下线删除**」,
它说「未来待办目录」,**定性互斥**。只把 197 改成 196 会留下一个仍然错的模型。
**这一条需要 Dexter 一句裁定:是改成「已下线删除」,还是随整段退役一并删掉。**

---

## 3 · 本批动作(有序)

每步:**目标文件 · 目标值 · 失败条件**。失败条件里的命令**已核对解释器**。

### 第 1 步 · 建 `scripts/check/all`

- 目标文件:新建 `scripts/check/all`
- 目标值:遍历 `scripts/check/` 全部条目;按 **shebang** 选解释器;按**退出码**判红绿;
  档位由 `import` `tools/verify-gates/verify.mjs` 导出的 `staticCommands`/`runtimeCommands` 判定,
  **不得解析源码**;档位映射为空时**抛错**,不得返回空。
  输出:`门名 · 档位 · 退出码 · 首败行`,末尾打印分母(总数/绿/红/需参数/跳过)。
  默认跳过 `backend-formatting-bytecode.mjs`(跑 gradle、写 `.runtime/`),`--include-slow` 可覆盖。
- 失败条件:`node scripts/check/all` 输出的 static 档门数为 0(说明档位判定又失效了)
- ⚠️ 它是**过渡期脚手架**:第 8 步完成、未接线集合清空后应删除。请写进脚本头部。

### 第 2 步 · `rp12-final-state` 变绿

- 目标文件:`modules/audit-read/src/main/java/com/catering/v2s/audit/read/OperationsAuditTaskReadService.java`
- 现状:**两处**裸枚举字面量 —— 第 141 行 `type(target, "HEAD_COMPANY")`、第 147 行 `type(target, "STORE")`。
  门逐行 fail 于首个,**只改 141 会立刻在 147 再红**。
- ⚠️ 该文件**未 import** `AuditEntityTypes`(实测命中 0),需新增 import
- 目标值:两处都改用 `AuditEntityTypes.HEAD_COMPANY` / `AuditEntityTypes.STORE`,并补 import
- 失败条件:`node scripts/check/rp12-final-state` 非零
  ⚠️ 它是 `#!/usr/bin/env node`,**用 bash 跑会恒非零**

### 第 3 步 · `protable-compact` 变绿(两个动作,缺一仍红)

- 动作 A:`CatalogWorkbenchPage.tsx` 里缺 `size="small"` 的那个 `<ProTable` 补上
- 动作 B:`scripts/check/protable-compact.mjs` 第 71 行的 `findings.length !== 13` **砍掉**
  (实例数已 15,冻结计数会随正常新增变红);**留**「每个实例必须有 `size="small"`」这条
- 失败条件:`node scripts/check/protable-compact.mjs` 非零
- ⚠️ 动作 A 是**用户可见的 UI 密度变更**,依据是
  `doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md`(该决策要求逐实例显式声明)。
  若该决策已不适用,**停下来问**,不要为了让门变绿而改 UI。

### 第 4 步 · `capability-invariants` 变绿

- 目标文件:`src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java`
- 现状:全仓 `src/main` **唯一**使用通配静态导入的文件,4 行 `import static X.*;`
- 目标值:这 4 行改成**普通嵌套类导入**(`import a.b.Outer.Inner;`,**不带 `static`**)
- ⚠️ 改成 `import static X.Y;` **无效** —— 门的正则 `/^import\s+([\w.]+);$/gm` 同样不匹配
- 失败条件:`bash scripts/check/capability-invariants` 非零
- ⛔ **不要砍那个 97 冻结** —— 它当前正确,且是这道门唯一防「owner 异常集合漂移」的断言
- ⚠️ **更小的替代存在,但我不选它**:门的真缺陷是 `resolveJavaType` 在解析不到简名时
  **静默编造一个 FQCN** 而不是失败。改门能防整类,改代码只消掉今天这一个实例。
  不选的理由:改门属于扩大本批范围。**如果你认为该改门,停下来说** —— 这是一个真实的取舍,不是定论。

### 第 5 步 · 删 `gate-0` 入口

- 目标文件(全部指针,前一版只列了一处):
  - `scripts/check/gate-0`(入口本身)
  - `scripts/run/platform-commercial-group-skeleton` 第 48/53/54 行的 hash 清单
    (**是取 hash,不是调用**)
  - `tools/platform-boundary-gates/cli.mjs`:`commands["gate-0"]` 分支 · `runSelfTest` 的 gate-0 分支 ·
    `validateGateWiring().requiredFiles`
  - ⚠️ 同文件第 11 行 `inventoryRelativePath` 指向 `r3-gate-0-business-source-inventory.json`,
    而它仍被 `contract-face` / `flyway-layout` / `production-conformity` 走的 `assertInventory` 使用 ——
    **这份 evidence JSON 不能删**
- 失败条件:`grep -rn 'scripts/check/gate-0' scripts tools` 非空
- ⚠️ 前一版把失败条件写成「跑 skeleton 脚本」,那是受管运行时动作(要 docker、jar、两个端口),
  不是可随手判定的条件

### 第 6 步 · `provider-free-context` 先修性能

- 现状与根因(与前一版写的**相反**,前一版是错的):
  它的耗时**不是**来自扫 `tools/`(那部分实测只读 20 个文件、耗时约 0s),
  而是来自一个 **5 次迭代的循环,每次跑一遍全仓 `find`**,且只 prune 了 `.git` 和 `.runtime` ——
  `node_modules` / `build` / `.gradle` / `.yarn` 全都走一遍。
- ⛔ **删掉前一版那句「放开白名单只会更慢」** —— `tools/` 早就无条件扫完了,不构成成本
- 目标值:把 5 次 `find` 并成一次,并 prune `node_modules` `build` `.gradle` `.yarn`
- 失败条件:`bash scripts/check/provider-free-context` 耗时仍超过 10 秒
- ⚠️ `foundation-standard-actions` 的耗时**就是转调这一道**,不是独立成本。修完这道,两道一起快。
- **修完性能之后再谈去留** —— 那时成本已经不是问题,「该不该留」是另一个问题

### 第 7 步 · 纠正入口文件事实

- 目标文件:`CLAUDE.md`(Catalog 8 → **10**,总数 26 → **28**)· `PLATFORM-BLUEPRINT.md`(**待裁**,见 §2)
- 失败条件:`grep -rn '18 条\|26\b\|197' CLAUDE.md PLATFORM-BLUEPRINT.md` 仍命中场景/provider 语境
- ⚠️ `AGENTS.md` 与 `CLAUDE.md` 里都有「不超过 80 条」的上限表述,**那是上限不是场景数**,不要改

### 第 8 步 · 按档位接线,先测基线

- ⚠️ **先测当前基线** —— `--validate-only` 现在要多久,**尚无实测**。
  没有基线就没有「分钟级」的分母。
- 接线时每条必须给全 tuple:static 档是 `[label, command, args, successMarkers]`,
  runtime 档是 `[label, command, args, remote]`,**形状不同**
- ⚠️ **marker 有坑**:`agent-lifecycle` 与 `project-memory` 的**首个** `=PASS` 是**红夹具标记**
  不是终判(终判分别是 `AGENT_LIFECYCLE_CHECK=PASS` / `PROJECT_MEMORY_CHECK=PASS`)。
  取错 marker 会造出一道「红夹具通过即算过」的假绿门。
  `query-boundaries` **不打任何 `=PASS`**,接线前要先定它的 marker。
- 失败条件:接线后 `scripts/verify --validate-only` 超过基线的两倍

---

## 4 · 不在本批(但必须知道)

**`runtime-environment-keys` 是绿的,但它有一个结构性的洞。** 它只验「policy 里那 15 个键
在 `scripts`+`tools` 里出现」,**不做反向** —— 代码里有而 policy 里没有的,它看不见。
实测该扫描集内有约 45–46 个不同 `V2S_*` 键,policy 登记 15 个。
⇒ **它在 static 档、是阻断性的、而且是绿的 —— 但它没在守它该守的那件事。**
本批不动它,但**不得把它当成「已核可保留」**。

**`security-boundaries`** —— 它断言 `PlatformAssetService` 出现 `objects.ownsObjectKey(objectKey)`,
实测该方法**生产零调用方**。这是 13 道红里**唯一可能是活缺陷而非门腐烂**的一道。
需先读完该文件写路径判断归属保护是否以别的形式存在。

**待按条核**:`authority-source-ledger` · `operation-handler-bindings` ·
`roadmap-control-plane-transfer` · `r5-edge-materialize` · `catalog-inventory-p1` · `production-conformity`

**其他不在本批**:入口文件的结构瘦身 · 读完其余 8 个 skill 正文 · CP-INV-1/2/4/5 · D-3 ·
后端→脚本跨界盘点 · `contracts/policy/r4-gate-catalog.json` 指向已改名的 `database-operation-budget`

---

## 5 · 什么算「为让门变绿而改代码」

任务模板禁止它,而 §3 有四步都在改代码让门变绿。分界:

> **改的是业务行为,还是表达形式?**
> 表达形式(导入写法、常量替字面量、显式声明属性)⇒ 允许。
> 业务行为(用户看到的、数据变的、判断逻辑变的)⇒ **禁止**,停下来问。

按此:第 2 步(常量替字面量)· 第 4 步(导入写法)**允许**;
第 3 步动作 A(UI 密度)**是用户可见变更**,依据是那份 2026-08-05 决策,**不是为了让门变绿** ——
若该决策已不适用,停下来问。

⚠️ 前一版用的判别式是「这次改动如果门不存在,还该不该做」。**撤回** ——
它会把 §1 里所有「砍冻结断言」的处置一并判为违规(门不存在时你不会去砍它的断言),
自相矛盾。

---

⛔ **模板正本在 `doc/platform/implementation-task-template.md`,此处不放副本。**
派活时从正本**逐字复制**,不得改写、不得重排。

⚠️ 本处原先放过一份副本,它在数小时内就与另外两份产生了措辞差异 ——
**这个模板的全部目的就是防漂移,而它自己先漂了。** 故改为指针。

## 7 · 详设新增 `RECALL` 字段

```text
RECALL    进入前重开:<该项对应的原始业务条目 / 裁决 / 记忆条目,逐条给路径>
          本项失败条件:「出现 <X> 即未做到」
```

失败条件写不出来 ⇒ 详设这一项不合格,实施者应停下来问。

⚠️ 只给**尚未完成**的 CP 补。它**不等效于** hook(只覆盖详设作者写下来的那些),
选它的理由是代价形态更可接受。
