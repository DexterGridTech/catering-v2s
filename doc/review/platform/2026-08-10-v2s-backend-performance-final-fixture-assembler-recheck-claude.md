# Final fixture assembler design —— Claude POST_REMEDIATION_V1 定向复核

`VERDICT=GO`　`M=0`　`S=2`　`N=0`

**Round 2 的两个 M 都真关闭**，而且第二个（direct import 绕过）我自己伪造了一次调用来验证，
不是靠读测试报告。两个 S 都不阻断静态实施：一个是测试不隔离（我在复跑时踩到了），
一个是 selector 解析强度弱于 catalog 自己的词汇所承诺的。

**本 GO 仅允许恢复 final fixture assembler 的静态 implementation。**
不授权动态环境、DEV、seed/reset、L2/UAT、部署、手工 SSH/SQL，
**也不构成任何 SQL 数值优化成功声明**。

## 0. 会话出处、写入边界与一项必须先说的披露

续接会话，非 fresh v2s-rooted acceptance。评审交付物只写本文件。

### 0.1 我在复跑你指定的命令时，往仓库写了一个目录 —— 我的过失，请处置

执行 `node --test scripts/dev/backend-performance-runtime-runner.test.mjs
scripts/dev/backend-performance-final-managed-adapter.test.mjs` 后，仓内多出：

```
.runtime/backend-performance/backend-performance-final-1234567891-abcdef12/run-manifest.json
```

**上一轮复核我明确查过 `.runtime/backend-performance/` 不存在**，本轮跑完测试后它出现，
目录时间 02:47 与我的执行时刻一致，run id 用的是测试里的桩值
（`now: () => 1234567891`、`uuid: () => "abcdef12-…"`）。**所以是我跑测试产生的。**

它是测试残渣而非真实运行（`business.status=FAIL`、
`firstFailure=BP_FINAL_ADAPTER_NESTED_TESTCONTAINERS_FAILED:…LOCAL_GRADLE_DISTRIBUTION_UNAVAILABLE`），
**不构成动态验收发生**。但它落在设计声明的"唯一最终证据根"里，
性质上不该由一次评审复跑产生——**建议由 Dexter 或 Codex 删除该目录**。我不自行删除。
根因不在我，见 S-01。

### 0.2 亲验方式

catalog 变异实验在会话专属 scratchpad 的仓库拷贝上进行（需 `node_modules` 才能解析 OpenAPI，
我第一次漏了它导致基线也红，已修正后重跑）。direct-import 伪造实验在临时脚本中进行，
只读调用生产模块、未写入本仓。

---

## 1. 你指定的四条命令（fresh 复跑）

| 命令 | 结果 |
|---|---|
| `backend-performance-final-fixture-catalog --check` | `PASS`　`ROWS=396`　`U05=78+5`　`U04=79+38`　`U07=196` |
| `backend-performance-final-fixture-catalog --self-test` | `PASS` |
| `node --test …runtime-runner.test.mjs …final-managed-adapter.test.mjs` | **8/8 pass, 0 fail** |
| `backend-performance-final-acceptance.mjs --policy-check` | `PASS` |

测试名里已能看到上一轮我提的 N-01 也被处理了：
`dynamic admission recomputes trim eligibility and treats CLI output only as provenance`。

---

## 2. Round 2 M-01（source selector 只验非空）—— **已关闭，但见 S-02**

### 2.1 它现在确实"解析"了

`scripts/check/backend-performance-final-fixture-catalog:65`：

```js
const selectorResolves = (anchor) => { try { return Boolean(
  anchor?.path && anchor?.selector &&
  readFileSync(path.join(root, anchor.path), "utf8").includes(anchor.selector)); } catch { return false; } };
const validateAnchor = (anchor) => hashMatches(anchor) && selectorResolves(anchor);
```

**我做了真变异**（scratchpad 拷贝，基线先确认 `rc=0`）：

| 变异 | 结果 |
|---|---|
| `row.sourceAnchor.selector` 改成文件中不存在的串 | **RED　`BP_FINAL_FIXTURE_PLAN_SOURCE_SELECTOR_UNRESOLVED`** |
| `row.sourceAnchor.sha256` 篡改 | **RED** |
| `readbackDeclarations[0].sourceAnchor.sha256` 篡改 | **RED　`BP_FINAL_FIXTURE_PLAN_DECLARATION_SOURCE_HASH_DRIFT`** |
| `ownerHttpOperationDeclarations[0].routeTemplate` 篡改 | **RED　`BP_FINAL_FIXTURE_PLAN_OWNER_HTTP_OPENAPI_DRIFT`** |

**这里更正我自己的一个中途判断**：我先按调用点 grep 认为 readback 的 anchor 没被校验，
变异实测推翻了它——readback anchor 的 hash 是被钉住的。结论以实测为准。

### 2.2 196 owner-HTTP 是**真对着 OpenAPI 解析**，不是自证

`:56–57` checker 自己解析 `contracts/openapi/edge.openapi.yaml` 与
`catalog-inventory.openapi.yaml`，为每个 operation 现算出
`{path, sha256(文件), selector: operationId}`；`:87` then 要求每条 owner 声明的
`method` / `routeTemplate` / `transport` / `successStatus` / `producedReadbackKeys`
与该 contract 一致，**且 `sourceAnchor` 的 entries 与 checker 自算的 anchor 逐项相等**。
`:84` 钉住 `ownerOperations.size === 196` 与 id 集合精确相等。

**14 条 predecessor**（`:90–93`）：id 恰为 `PREDECESSOR_<family>` 且与 14 个 family 一一对应，
`ownerHttpOperationIds` 非空且每个都必须存在于那 196 条里，
`producedReadbackKeys` 与 preparation procedure 的 `producedReadbackKeys` 精确相等（`:102`/`:114`）。

---

## 3. Round 2 M-02（direct import 绕过）—— **已关闭，我自己伪造验证过**

### 3.1 机制是对象身份，不是字段检查

`scripts/dev/backend-performance-runtime-runner.mjs:17,22,83`：

```js
const verifiedDynamicAdmissions = new WeakSet();          // 模块私有，从不导出
export const isVerifiedFinalDynamicAdmission = (token) => verifiedDynamicAdmissions.has(token);
…
verifiedDynamicAdmissions.add(token);                      // 只在 runner 自己的准入路径里
```

`scripts/dev/backend-performance-final-managed-adapter.mjs:66` 是
`runFinalManagedLifecycle` 的**第一句**：

```js
if (!isVerifiedFinalDynamicAdmission(token)) fail('BP_FINAL_ADAPTER_DIRECT_IMPORT_ADMISSION_FORBIDDEN');
```

**外部伪造不出对象身份**——只导出只读谓词、不导出 WeakSet 本身，
字段填得再全也进不了那个集合。这比"检查 `admission.runtimeAuthority === true`"强一个量级，
后者（`:68`）只是补充。

### 3.2 我自己跑的伪造实验

直接 import adapter，用一个字段齐全的伪 token 调用：

```js
const forged = {plan: {runId:'forged', runtime:'/tmp/forged-run', …},
  admission: {runtimeAuthority:true, minimalFixtureAuthority:true, resetAuthority:false,
              changedPathsWithinApprovedSurface:'PASS'}};
await runFinalManagedLifecycle(forged);
```

结果：

- 抛出 **`BP_FINAL_ADAPTER_DIRECT_IMPORT_ADMISSION_FORBIDDEN`**
- **`/tmp/forged-run` 未被创建** —— manifest 未写
- **`.runtime/backend-performance/` 条目数 before/after 均为 1，未变** —— 无资源阶段副作用

**拒绝发生在 manifest 创建（`:69`）、资源构造（`:70`）与 `persist`（`:72`）之前**，
与你要求的"在 adapter import、manifest 写入和资源阶段之前被拒绝"一致。

---

## 4. 396 fixturePlan 闭合与无 generic dispatch —— **通过**

`--check` 输出 `ROWS=396 / U05=78+5 / U04=79+38 / U07=196`；
`:125` 另钉住行级分母 `getRows=166 / jsonRows=216 / noneRows=12 / multipartRows=2 /
queryRows=92 / pathBindings=462`。

**无 generic dispatch 有两层，第二层才是真的强**：

- `:115` 禁止 plan 上出现 `operationIdDispatch` / `genericBodyMap` / `routeInference` /
  `defaultFixtureValue` 四个键（键名黑名单，本身较弱）；
- **`:119` 要求 `algorithm.operationIds` 恰为 `[row.operationId]`，`:123` 对 builder 同样要求**。
  `:97` 钉住 `algorithms.size === 113`（103 复用 + 10 新建），
  `:72` 钉住命令 operationId 恰为 113 且与 14 个 family 的分区精确相等。
  **113 个算法对 113 条命令构成一一映射，没有任何一个算法服务两条命令**——
  这在结构上排除了通用分发，而不是靠禁几个字段名。

`:106–109` 逐行要求 `pathBindings` 与 `row.pathParameters` 名称集合精确相等、
`queryBindings` 与 `queryBindingConstraints[operationId].requiredNames` 精确相等，
且每个绑定都有 `stateKey` 与 `producerReadbackKey`——**路径与查询参数来自具名前驱读回，不是默认值**。

---

## 5. 静态边界与动态未发生 —— **通过**

| 项 | 值 |
|---|---|
| active package | `BACKEND-PERFORMANCE-FINAL-ADAPTER-IMPLEMENTATION-20260810` |
| `implementationAuthority` | **True**（本包正是静态实施授权） |
| **`runtimeAuthority`** | **False** |
| `businessStatus` | `NOT_RUN_STATIC_IMPLEMENTATION` |
| package input `status` | `ACTIVE_STATIC_IMPLEMENTATION` |

实施 manifest 的绑定我逐项复算：
`fixturePlanDesignAmendment.sha256` 与 `catalogSha256` **均与实际文件相符**；
`designAdmission.claudeVerdict` 指向**我上一轮的 recheck 文件**，
其 `claudeVerdictSha256` = 实际 sha **相符**——实施包按 hash 绑在我的 GO 上，不是口头引用。
`denominators` = 396 / 78 / 5 / 79 / 38 / 196 / 21，与我历轮复算一致。
`forbidden` 闭集含 **"receipt or after-hash set equality claim in trim admission"**——
我上一轮的 M-01 已被写进本包的禁令表。

21 条 changeSurfaces（update 12 / create 9）；9 条 create 现已存在，
这对一个**已在执行的静态实施包**是正确状态（不是设计包的"create 必须 absent"语义）。

Round 1 原件是**货真价实的 Markdown**（`# Independent fixture-assembler design review — Round 1`），
上一轮那种"原件被转写覆盖"的问题**没有重演**。

---

## 6. Findings

### S-01｜focused test 不隔离：写入设计声明的"唯一最终证据根"，并真的去 spawn 嵌套 Testcontainers

**证据**：`scripts/dev/backend-performance-final-managed-adapter.test.mjs:10` 与 `:18`
把 runtime 路径拼成
`path.join(process.cwd(), '.runtime/backend-performance/backend-performance-final-1234567891-…')`
——即 amendment 里声明的
「The only final evidence root is `.runtime/backend-performance/<final-run-id>/`」。

我复跑后该目录被创建，其 `run-manifest.json` 里
`phases[0] = {phase: "RESOURCE_PREFLIGHT", status: "PASS"}`，
`firstFailure = BP_FINAL_ADAPTER_NESTED_TESTCONTAINERS_FAILED:R5_REMOTE_TESTCONTAINERS=FAIL;
REASON=LOCAL_GRADLE_DISTRIBUTION_UNAVAILABLE`。
**"gradle 不可用"这个失败原因本身就证明测试真的去启动了嵌套 Testcontainers 命令**，
不是纯内存夹具；RESOURCE_PREFLIGHT 也真的跑了。

**影响面**：任何人（包括评审者）按你给的命令复跑，都会在最终证据根里留下一个
`backend-performance-final-*` 目录。后果有二：
① 证据根被污染，将来真实 final run 的目录扫描/准入可能把残渣当成一次运行；
② 在"动态验收是否发生过"这个最要紧的问题上，肉眼一看目录就容易误判——
本轮就是我先看到目录、再逐字段确认它是残渣才排除的。

**为什么是 S 不是 M**：它不影响任何静态结论的正确性，
残渣的 `business.status=FAIL` 与桩化 run id 使它可被识别，
且当前 `runtimeAuthority=false`、无真实动态运行。

**最小修复**：测试用 `mkdtemp` 建临时根（或 `.runtime/test-*` 沙箱），
并通过已有的注入 seam 提供嵌套 Testcontainers 的假结果，使其不 spawn 真实命令。
`.runtime/backend-performance/` 应在测试中被断言**不被写入**。
另请删除我造成的那个残渣目录（§0.1）。

**是否需要 Dexter 裁决**：不需要。

### S-02｜selector 是全文件子串匹配，`exportedProcedure` 无人校验

**证据（变异实测）**：

| selector 取值 | 结果 |
|---|---|
| 文件中不存在的串 | **RED**（M-01 确已修好） |
| `"e"` | **GREEN** |
| `"const"` | **GREEN** |

`selectorResolves` 用的是 `fileText.includes(selector)`——**任何碰巧出现在文件里的字符串都通过**，
包括单个字母、关键字、注释里的词。它证明的是"这个串出现在该文件里"，
**不是"它命名了一个真实的导出过程/operation"**。

而 catalog 自己的词汇承诺了后者：396 条 `readbackDeclarations` 的 anchor 都带
`"exportedProcedure": "createFinalWorkloadRecipes"` 这样的字段，
**但 `exportedProcedure` 在 checker 里零命中——没有任何校验读它。**

**影响面**：396 行的 intra-file 定位强度。
**边界**：文件身份由 `sha256` 钉死（我变异验证过），所以弱 selector**指不到错误的文件**，
风险仅限于"所声明的过程在该文件里可能并不存在"。

**为什么是 S 不是 M**：Round 2 的 M 是"只验非空"，现在错误 selector 会红，
该 finding 实质已闭；要触发本条得**故意**写 `"e"` 这种退化值，肉眼可见且无动机。

**最小修复（两处，都很小）**：
① 把 `.includes(selector)` 换成词边界匹配（`new RegExp(`\\b${escaped}\\b`)`），
并要求 selector 长度下限；
② 对带 `exportedProcedure` 的 anchor，断言该名字以导出/函数声明形式出现
（例如 `export function <name>` / `export const <name>` / `<name>(` 之一），而不只是任意出现。
不改任何分母、行数或 surface。

**是否需要 Dexter 裁决**：不需要。

---

## 7. 方案合理性

本轮修复是**定向且最小**的：selector 从"非空"升为"必须解析"，
adapter 从"检查字段"升为"检查对象身份"。两处都没有借修复扩范围——
没有新增 delivery unit、没有动分母、没有提任何权限。

`WeakSet` 身份准入这个取舍我认为特别好：它用语言层能力把"只能从 runner 进来"变成**结构上不可绕过**，
比再加一串字段校验都强，且代码量更小。这正是"更简单、更直接"的替代方案胜出的例子。

catalog 的 1:1 算法/builder 绑定也是同一思路：与其禁止"通用分发"这个行为（难以机械判定），
不如让**每条命令必须有自己的具名算法**，使通用分发在结构上无处安放。

**UI 与交互**：`NOT_APPLICABLE`。本包只涉及 fixture catalog、runner/adapter 与门脚本，
不触碰 HTTP 契约、页面或用户可见操作。

---

## 8. 结论

**GO**（M=0，S=2，N=0）。

**Round 2 的两个 M 都是真关闭，且我用两种独立方式验证过，不是读测试报告得出的**：
selector 那条，我在 scratchpad 拷贝上做变异——不存在的 selector 红、篡改 sha256 红、
篡改 owner 的 routeTemplate 红（`OWNER_HTTP_OPENAPI_DRIFT`）；
direct-import 那条，我自己写脚本伪造了一个字段齐全的 token 直接调用 adapter，
得到 `BP_FINAL_ADAPTER_DIRECT_IMPORT_ADMISSION_FORBIDDEN`，
且 `/tmp/forged-run` 未创建、证据根条目数未变——**拒绝确实发生在 manifest 与资源阶段之前**。
机制是模块私有 `WeakSet` 的对象身份检查，外部伪造不出来。

196 条 owner-HTTP 是对着 checker 自己解析 OpenAPI 现算出的 contract 逐项比对
（method / routeTemplate / transport / successStatus / producedReadbackKeys / sourceAnchor 全等），
14 条 predecessor 与 14 个 family 一一对应且 readback key 精确闭合。
396 行的无 generic dispatch 不是靠禁四个字段名，而是靠 **113 个算法对 113 条命令的一一映射**。
静态边界正确：`runtimeAuthority=false`、`businessStatus=NOT_RUN_STATIC_IMPLEMENTATION`，
实施 manifest 按 hash 绑在我上一轮的 GO 上，禁令表里已写入我上轮的 M-01。
Round 1 原件是真 Markdown，上一轮的转写覆盖问题没有重演。

两个 S 都不阻断：测试不隔离（我复跑时踩到并留下残渣，已在 §0.1 披露，请删除），
以及 selector 的子串语义弱于 catalog 自己 `exportedProcedure` 词汇所承诺的强度。
两处修复都是几行，且不动任何分母。

**授权边界**：本 GO 仅允许恢复 final fixture assembler 的**静态** implementation。
不授权动态环境、DEV、seed/reset、L2/UAT、部署、手工 SSH/SQL、仓库控制，
**也不构成任何 SQL 数值优化成功声明**。
动态验收仍须在独立的静态 implementation review GO 之后，以独立受管 package 执行。
