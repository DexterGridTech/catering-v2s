# 销售菜单实施 · 暂停后全面执行诊断(Claude 静态)

```text
DIAGNOSTIC_VERDICT=NO-GO(继续按原节奏)/ GO(按本文 FAST_PATH 恢复)
M/S/N=2/3/2
EVIDENCE_TIER=STATIC + RUNTIME_MANIFEST_METADATA
```

**方法**:未继承作者总结或既有 verdict;未运行任何动态验证。
所有数字由我从 `.runtime/r5/evidence/remote-testcontainers/` 的 run-manifest 元数据与仓内源码**独立复算**。

---

## 1 · EXECUTION_DIAGNOSIS

### 1.1 业务方向没错,错的是执行节奏与学习效率

`[已确认]` DESIGN review 结论 GO(M=0),我本人做的那轮逐条验证了范围、权限、可售维度、
copy 边界与 G-08 读法,**业务设计方向不需要改**。当前失败没有一条指向产品语义错误。

### 1.2 ⚠️ 最重要的发现:请求正文对时间去向的归因不准确

来函写「主要时间消耗在多次 broad/all 运行、远端构建、源码同步、Testcontainers 启停」。
**实测不成立。**

`[已确认 · 我独立复算]` 2026-09-01 起共 **92 次**受管运行,墙钟跨度
**07:42:25 → 次日 00:03:26,约 16.4 小时**;而**全部 91 次有时长记录的运行合计仅 2.2 小时**,
中位数 **66 秒**,最长 **4.1 分钟**。

> **运行本身只占墙钟的 13%。约 14 小时、86% 的时间不在跑测试。**

`[推论]` 因此"跑得太多、跑得太慢"是**错误的问题定义**。真正的成本在**两次运行之间**:
定位、改、重新推导、再决定下一步。而这段成本乘以 **92 次**,才是那一昼夜的去向。

**这个重定义直接改变提速方案**:下一个模块要提速,不是"少跑几次 broad run"或"让运行更快",
而是**每次运行多学到东西**,以及**不要重新进入已关闭的失败族**。

### 1.3 应该前移的

- **分母类失败必须在第一次业务运行之前一次性关闭**(见 §3 的 9 次复发实证);
- **fixture truth table 与 oracle 的期望值推导**,必须在第一次动态运行前由 fresh 独立 agent 走一遍 ——
  ordered 场景"先加了重复 item 又断言 itemCount 为 0"和 BusinessChannel 的
  false green,都是纸面上就能发现的;
- **跨 owner 前置事实(真实 INTERNAL channel seed)** 应在 SM-00 冻结时就确认存在,
  而不是等 acceptance 跑不动才发现。

### 1.4 本可不做或不该重复做的

- **9 次重复撞同一个 `BUDGET_PROJECTION_OPERATION_MISSING`**;
- **早期 broad/all 运行**:在多个失败族未隔离时同时暴露 405/403/409/422/500/budget,
  单次运行的信息量被噪音稀释;
- **对同一失败族的多次"改一点再跑一次"**:92 次运行、50 次失败,
  说明单次运行平均只推进了很小一步。

---

## 2 · ROOT_CAUSE_MATRIX

| # | 失败现象 | 根因层 | 证据(我独立复核) | 已解决 | 再发防护 |
| --- | --- | --- | --- | --- | --- |
| 1 | 生成分母不一致 | **generated / governance** | `edge-codegen.mjs` 第 24 行曾硬编码 `canonicalOperationCount=180`,第 49 行以 `R5_EDGE_BUDGET_OPERATION_COUNT` fail;另有独立环境变量读取 | 已修(改读 source denominator 并双向校验) | **单一 denominator authority 检查**:任何计数只允许一处住址 |
| 2 | `BUDGET_PROJECTION_OPERATION_MISSING` 复发 9 次 | **evidence/governance(流程)** | 出现于 09:15、11:40、12:42、13:15、14:39、17:27×2、20:41、20:48,**跨 11.5 小时** | 部分 | **失败族 stop condition**:同一 failureCategory 第二次出现即停止业务推进,先关闭该族 |
| 3 | contract nullable 与运行语义不一致(copy 的 `activation: null`) | **contract ↔ oracle** | 来函所述;属 source-first 链路未闭合 | 已修 | **contract nullable/exact-set 校验**进 SM-01 |
| 4 | ordered 场景 oracle 自身错误 | **business oracle** | 先加重复 item 又断言 itemCount=0 | 已修 | **oracle 期望值必须由动作序列重新推导**,不得沿用初始值 |
| 5 | fixture helper 返回值 shape 混用(**当前首败**) | **fixture** | `BusinessChannelAcceptanceScenarios.java` 第 1432 行 `createExternalStoreBinding` 返回裸 `BackendAcceptanceTest.Response`;第 1018、1272–1278 行按 channel response 取 `channelRef`,得空串 → `UUID.fromString("")` → `BackendAcceptanceTest.java:652` | **未修** | 见 §6 控制一 |
| 6 | 跨 owner 前置事实缺失(无 INTERNAL channel) | **owner/seed** | 渠道 seed 三个实例全为 EXTERNAL,`INTERNAL DINE_IN/TAKEAWAY` 实例为零 | 已修源,待验 | **owner 前置数据 truth table** 进 SM-00 |
| 7 | broad run 过早 | **执行策略** | GRADLE 失败集中 11:00–17:00(38 次中 30 次),之后显著下降 | 已纠偏(转 focused) | **先 focused 后 all**,写死为阶段准入 |
| 8 | runner/环境边界 | **runner/environment** | 50 次失败中 `LOCAL_TESTCONTAINERS_RUN_ALREADY_ACTIVE` 与 `STALE_..._LOCK` 各 1 次 | 已部分修 | 保持 runner/business/cleanup 三层分离 |
| 9 | 独立对账介入偏晚 | **evidence/governance** | ordered 与 BusinessChannel 的 false green 由后置 fresh verifier 发现 | 部分 | 对账**前移到第一次动态运行之前** |

### 2.1 ⚠️ 第 5 项的精确定性 —— 这不是"测试写得差",是**偏离了仓内既有主流形态**

`[已确认 · 我独立复算]` acceptance 目录下 helper 的返回类型分布:

- **返回 typed 结构:43 个**
- **返回裸 `BackendAcceptanceTest.Response`:10 个**

**typed 才是仓内主流。** 而这 10 个裸 Response 的分布是:

| 文件 | 裸 Response helper 数 |
| --- | --- |
| `BusinessChannelAcceptanceScenarios.java` | **6** |
| `CollaborationAcceptanceScenarios.java` | 3 |
| `SalesMenuAcceptanceScenarios.java` | 1 |

**全仓 10 个例外里 6 个集中在当前首败所在的那个文件。** 集中度是因果的,不是巧合。

`[推论]` 所以正确的修法**不是"引入 typed fixture record 这项新能力"**,
而是**把这 10 个例外改成 43 个同伴已经在用的形态**。这是一致性收敛,不是新抽象。

---

## 3 · TIME_LOSS_ANALYSIS

`[已确认]` 全部来自 run-manifest 元数据的独立复算:

```
运行次数            92          (2026-09-01 起;全量目录 333)
墙钟跨度            16.4 小时    07:42:25 → 00:03:26
运行时间合计         2.2 小时    仅占墙钟 13%
单次中位             66 秒
单次最长             4.1 分钟
PASS / FAIL         42 / 50
```

**失败首败分布**:`REMOTE_GRADLE_EXIT_NONZERO` 38、`BUDGET_PROJECTION_OPERATION_MISSING` 9、
runner lock 2、其他 1。

**时间去向的结论**:

1. **~14 小时(86%)在运行之外。** 这是分析、编辑、重新推导与决策的时间。
2. **92 次运行 × 每次约 10 分钟的间隙成本 ≈ 15 小时** —— 与墙钟吻合。
   **提速的唯一杠杆是减少运行次数,而减少次数的唯一办法是提高单次运行的信息产出。**
3. **9 次分母复发是纯浪费**,按均摊约 1.5 小时;
4. **早期 broad run 的隐性成本更高**:它不体现在运行时长里,而体现在
   "一次运行暴露五类问题 → 无法判断首个业务根因 → 下一次运行仍不聚焦"的循环里。

`[尚缺证据]` 我**无法**从 manifest 反推每次运行之间人工/agent 的具体耗时构成
(阅读 vs 编辑 vs 重新推导)。上述 86% 是墙钟减去运行时长的**差值**,
其内部构成需要 wall-clock ledger 才能拆分。来函说"不要伪造精确分解",我遵守。

---

## 4 · CURRENT_BOUNDARY

### 4.1 已被真正证明的

- `[已确认]` DESIGN 层:范围、功能权限、可售两维度、copy 边界、G-08 读法、
  31/19/38/15/16 五个分母 —— 我在 DESIGN review 中逐项独立复算。
- `[部分确认]` 若干 focused Testcontainers 场景 PASS 且 business/cleanup 分层记录存在;
  但 **PASS 不等于 oracle 完整** —— BusinessChannel 的 false green 已经证明了这一点。

### 4.2 明确尚未证明的

- SM-05 的 15/15 focused 闭环;
- **31 个 operation 的实际执行覆盖**(设计期矩阵已补,但执行结果未产出);
- normal `scripts/verify` 与 CP-05;
- 全批 backend-acceptance;browser L2;最终 reset/DEV/seed;
- 全批三维对账;SM-06 至 SM-12;实施后两轮对抗审查。

### 4.3 ⚠️ 一条必须写明的边界

`[已确认]` `r5-tc-1788306791709-44961` 曾 CONTRACT/BUSINESS 双 PASS,
但事后发现只构造了 TAKEAWAY,缺 DINE_IN、PROJECT 级、STORE GROUP_BUY、EXTERNAL TAKEAWAY 四类反例。

**因此本批已有的任何 PASS,在其 fixture 分母被独立复核之前,都不构成完成证据。**
这不是对个别运行的怀疑,是对"PASS 的证明力"的定级。

---

## 5 · FAST_PATH_FOR_NEXT_MODULE

设计原则:**每次动态运行前把能静态确定的全部确定完**,因为运行只占 13% 的时间,
而每次运行的间隙成本约 10 分钟。

### 阶段 0 · 冻结(全部静态,一次做完,不允许边跑边补)

1. **三份 denominator inventory**:operation 全集、acceptance 场景全集、L2 case 全集,
   并给出 operation → 场景的映射(不是设计期意图,是**待验证的执行分母**)。
2. **单一 denominator authority 检查**:每个计数只允许一处住址;
   跑一次全仓检索确认没有第二处硬编码或环境变量旁路。
3. **owner 前置数据 truth table**:本模块需要哪些跨 owner 事实
(渠道类型、组织节点、合同、库存对象……),**逐条确认 seed 里真的存在**。
   销售菜单这次栽在"三个 channel 实例全是 EXTERNAL",那是静态可查的。
4. **contract nullable / exact-set 校验**:每个可空字段在 contract、generated、oracle 三处语义一致。
5. **fixture truth table**:每个场景的前置事实、动作序列、**由动作序列重新推导的期望值**、
   以及正向与反向 counterexample。⚠️ 期望值不得沿用前置状态。

### 阶段 1 · 生成链闭环(静态)

`source → materialize → generated → compile` 一次跑通;
**在旧 generated 上先验是无效的**,必须先重生成。

### 阶段 2 · fresh 独立三维对账(静态,前移)

对阶段 0 与 1 的产物做证伪式对账,**在第一次动态运行之前**。
销售菜单这次的两个 false green(ordered oracle、BusinessChannel fixture)
**都是纸面上可发现的**,却等到动态运行后才由后置 verifier 抓到。

### 阶段 3 · 第一次 focused run

**只跑一个失败族**。`--operation` 精确到单场景,不跑 all。

### 阶段 4 · 失败族 stop condition(这是最重要的一条)

> **同一 failureCategory 第二次出现,立即停止业务推进,先把该族关闭到零复发。**

销售菜单这次 `BUDGET_PROJECTION_OPERATION_MISSING` 跨 11.5 小时复发 9 次,
就是因为没有这条规则。

### 阶段 5 · 分层判读

每次运行必须分开读 **runner failure / business failure / cleanup failure**;
记录 **首败、last known good、broken boundary**。
`[仓内]` 本轮 manifest 已有这三个字段,继续用。

### 阶段 6 · 进入下一阶段的准入

同时满足:本族零复发;该族全部场景的 oracle 已被 fresh 独立 agent 复核过;
该阶段三维对账 OPEN 清零。**任一不满足不得进入下一阶段。**

### 阶段 7 · 全部族关闭后才跑 all

`all` 是**回归确认**,不是**发现手段**。

---

## 6 · MINIMAL_REUSABLE_CONTROLS

按"真正能减少重复错误"筛选,**只留四项**,均非通用测试平台:

**控制一 · 把 10 个裸 `Response` helper 收敛为 typed(不是新建能力)**
`[已确认]` 仓内 43 个 helper 已是 typed,10 个是例外,其中 6 个在当前首败文件里。
**这是一致性收敛,零新抽象**,且直接消灭"channel/binding/template 返回结构混用"这一类失败。
优先级最高,成本最低。

**控制二 · 单一 denominator authority 检查**
任何计数(operation、场景、case)只允许一处住址,第二处即红。
`[已确认]` `canonicalOperationCount` 的教训已经付过学费,不要再付第二次。

**控制三 · operation → acceptance/L2 的实际执行映射器**
不是设计期矩阵,是**从运行产物反向汇总**"每个 operation 实际被哪条场景走到"。
设计期矩阵证明不了执行覆盖。

**控制四 · managed run 的耗时与阶段统计**
`[推论]` 本次诊断最有价值的数字(92 次、2.2h/16.4h)是我**事后从 manifest 逐个算出来的**,
当时无人知道。有了它,"运行只占 13%"这个事实会在第 20 次运行时就浮现,而不是第 92 次之后。
**成本极低:manifest 已有 startedAt/finishedAt,只需一个汇总脚本。**

**建议不做**:通用 fixture DSL、测试平台、未来抽象。
**每个业务场景的 fixture truth table 建议做,但作为阶段 0 的交付物,不作为工程能力。**

---

## 7 · DO_NOT_REPEAT

1. **不得在失败族未关闭时进入下一族。** 同一 failureCategory 第二次出现即停。
2. **不得用 broad/all run 做发现手段。** all 只做回归确认。
3. **不得把 PASS 当完成证据,除非其 fixture 分母已被独立复核。**
4. **不得让 oracle 期望值沿用前置状态。** 必须按动作序列重新推导。
5. **不得让同一计数存在第二处住址。**
6. **不得在旧 generated 输出上先验。**
7. **不得把跨 owner 前置事实留到动态运行时才发现。**
8. **不得让 fixture helper 返回不携带资源身份的裸响应。**
9. **不得让 fresh 独立对账后置到动态运行之后。**
10. **不得用延长 timeout、fallback、放宽断言或手改 generated 止血** —— 本轮已守住,继续守。

---

## 8 · SALES_MENU_NEXT_STEP

**最小下一步,按序,不要并行:**

1. **修当前首败**:`BusinessChannelAcceptanceScenarios.java` 第 1018、1272–1278 行的
   `createExternalStoreBinding` 返回值误用。**同时把该文件的 6 个裸 Response helper 一并 typed 化** ——
   它们是同一根因,分开修等于承认还会再撞一次。
2. **把 BusinessChannel 的 fixture 分母补齐并由 fresh 独立 agent 复核**:
   DINE_IN、PROJECT 级不合格、STORE GROUP_BUY 不合格、EXTERNAL TAKEAWAY 不合格四类反例。
3. **在重跑之前**,对 SM-05 的全部 15 条场景做一次静态 fixture truth table 复核 ——
   已知有两条 oracle 是纸面可发现的错误,不排除还有第三条。
4. **关闭 `BUDGET_PROJECTION_OPERATION_MISSING` 族到零复发**,再进业务场景。
5. 然后才是 SM-05 的 15/15 focused 闭环。

**⚠️ 第 3 步是本文最想强调的一步。** 当前的做法是"跑 → 失败 → 修 oracle → 再跑",
每轮约 10 分钟间隙成本;**改成"静态复核全部 15 条 → 一次跑通"**,
即使复核花两小时,也比再来 20 次运行便宜。

---

## 9 · STATIC_EVIDENCE_LIMIT

以下**不能**仅靠静态材料证明,必须动态运行:

- 修好 helper 后 BusinessChannel 场景是否真的通过;
- 15 条 SM-05 场景的 oracle 在补齐分母后是否全部成立;
- 31 个 operation 的**实际**执行覆盖(设计期矩阵不算);
- `scripts/verify`、CP-05、全批 acceptance、browser L2、reset/seed 的当前结果;
- 生产 owner 逻辑在真实 HTTP 下的行为(本文所有关于生产代码的判断都是**未证伪**,不是**已证明正确**)。

**我明确没有做的**:未运行任何测试;未修改任何源码;
未从 manifest 反推运行间隙的内部构成(缺 wall-clock ledger)。

---

## 10 · Findings

### M-1 · 失败族无 stop condition,导致同一分母失败跨 11.5 小时复发 9 次
**层级** evidence/governance · **已确认** · 证据见 §3。
**可证伪失败条件**:若下一模块中任一 failureCategory 出现第二次而业务推进未停止,则该控制未生效。
**最小修复**:把"同一 failureCategory 第二次出现即停止业务推进"写进实施模板的阶段准入。
**需要 Dexter 裁决**:否。

### M-2 · fixture helper 返回裸响应,且例外集中在首败文件
**层级** fixture · **已确认** ·
`BusinessChannelAcceptanceScenarios.java` 第 1432 行;全仓 10 个裸 Response helper 中 6 个在此文件,
而 typed 形态已有 43 个同伴。
**可证伪失败条件**:若该文件仍有 helper 的返回类型不携带资源身份,则同类混用可再次发生。
**最小修复**:该文件 6 个 helper typed 化(其余 4 个可随后)。
**为什么更小的替代不足**:只修当前这一处调用点,不改返回类型,下一个调用者仍会混用。
**需要 Dexter 裁决**:否。

### S-1 · 独立对账后置于动态运行
**层级** evidence/governance · **已确认**(ordered 与 BusinessChannel 两个 false green 均纸面可发现)。
**最小修复**:对账前移到第一次动态运行之前,作为阶段准入。

### S-2 · 无 run 耗时与阶段统计,导致时间去向在事后才可知
**层级** runner/environment · **已确认** · 本次 92/2.2h/16.4h 全部由我事后逐个算出。
**最小修复**:一个汇总脚本,消费 manifest 已有的 startedAt/finishedAt。

### S-3 · 已有 PASS 的证明力未被分级
**层级** evidence · **已确认** · `r5-tc-...-44961` 的 false green 是实例。
**最小修复**:PASS 记录必须附"fixture 分母是否已被独立复核"这一状态位;
未复核的 PASS 不得计入完成度。

### N-1 · broad run 的成本不体现在时长里
**层级** 执行策略 · **推论** · GRADLE 失败集中 11:00–17:00 后显著下降,与转 focused 的时点一致;
但我无法从 manifest 区分哪些是 broad、哪些是 focused。标 `尚缺证据`。

### N-2 · 生产代码质量在本轮未被证伪,也未被证明
**层级** backend owner · **推论**。当前所有已定位根因都落在 fixture、oracle、分母、seed、runner 层;
**没有一条指向生产 owner 逻辑**。但这**不等于生产代码正确** ——
它只等于"尚未有动态证据指向它"。请勿据此得出生产实现已验证的结论。

---

## 诊断结论

**按原节奏继续:NO-GO。** 92 次运行只推进到 SM-05 未闭环,单次运行信息产出过低,
且缺 stop condition 与前置对账,继续下去仍会是同一形状。

**按本文 FAST_PATH 恢复:GO。** 阻断项只有 M-1 与 M-2,两条都是当日可完成的收敛工作,
且 M-2 是把 10 个例外改回 43 个同伴的既有形态,不引入任何新抽象。

**本文是诊断,不是实施授权。** 未修改任何源码,未运行任何动态验证,
不改变产品语义、Journey、权限边界或数据模型。
