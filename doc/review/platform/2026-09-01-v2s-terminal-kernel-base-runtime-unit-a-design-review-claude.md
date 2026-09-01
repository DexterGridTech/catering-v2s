# TER `kernel.base.runtime` 单元 A 详细设计 · 独立 DESIGN review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `DESIGN`（详设 843 行 / 47251 字节 / `sha256 54015c97…`） |
| 需求正本 | 冻结版 3066 行；自指 hash 复核步骤按需求 §11 第九轮那段执行，**本轮复算得 `2ac28865`，与作者引用一致** |
| **VERDICT** | **NO-GO** |
| **M / S / N** | **2 / 7 / 9** |
| 方法 | 先从需求 §0-A 独立重建 A 的分母与预期形状，再打开详设比对；所有仓内事实逐文件打开亲验；**本会话不运行任何命令** |
| 会话出处 | fresh，v2s 仓根发起；非续接、非它仓 |

**两条 M 都不大，但都落在冻结接缝上**：一条让 §0-A 那个 B→A 触点在 B 期必然破约，
一条让启动路径唯一可能失败的那一阶段没有失败判据。其余 7 条 S 各自都是行级修订。

---

## 1 · 方案合理性（先于闭环正确）

### 问题对不对

**对。** 我独立从 §0-A 重建了一遍 A 要解决的问题：一个能装配模块、按声明序并发跑 actor、
返回有序中间结果、自持角色、能挂 peer 网关的执行骨架，**且把台账整层挡在外面**。
详设 §1.2 的完成信号（真实消费链 / 五态聚合返回 / 单一事实点 / 五个 seam / owner 身份）
与我的重建一致，没有把 B 的东西拉进来，也没有把 A 的东西推给 B。

### 方案优不优

**优于我能构造的三个替代。** 详设 §2.1 自己列了三个（照搬 POC / 只建 command bus / A+B 一次做完）。
我另外构造了两个它没列的：

- **不建 emitter、让每-actor 路径就地构造记录，B 期再重构** —— 不成立。需求契约二已论证：
  B 期会第二次构造记录，台账与返回值成两份事实。详设取 emitter 是对的。
- **把第一级聚合整个推给 B** —— 不成立，且详设 §10.1 第 8 问自己也这么答：
  A 的 `dispatchCommand` 必须返回 `status`，聚合函数就是它的返回类型来源。

**本轮特别认可四处做减法**，它们都是"少做"而不是"多做"：

1. **删掉保留 `actorKey` 名单**（§5.3）—— 需求自己留了这个逃逸口
   （"若详设发现内部记录并不走注册表…应当整条删掉"），详设的理由成立：
   合成记录经 emitter 直接构造、不进 registry，名单对它无效。**这是最小正确方案。**
   ⚠️ 但删的时候把防伪造那一半也删掉了，见 S-2 —— 那是补一条构造期断言的事，不是恢复名单。
2. **不建 actor 取消 / 副作用栅栏 / production shutdown**（§2.2、§5.4）—— 与需求 §4.3 裁定一致，
   并且在 README 第 12 项把"超时后重入与深度保护不再是取消保证"写成已知边界，没有假装有保证。
3. **不给 `internal` 造 caller 分类学**（§5.10、§10.1 第 9 问）—— 这一条比需求本身更诚实，见 N-7。
4. **单一事实点明确拒绝做成机器门**（§7.2）—— "标识符/调用次数扫描无法证明语义唯一，
   换名或 helper 转发即可假绿"，这句判断是对的，且与仓内"不得用关键词匹配把语义伪装成 checker"一致。

### 代价配不配

**基本相称，一处不相称。**
843 行里公开面 + 类型 + 40 条测试矩阵占了大半，那是交付物本身；4 个 CP 对一个承载
`TR-01/03/04/09` 且要冻结五个跨单元接缝的包不算重。

不相称的是 **CP-A0**（S-7）：把一个**无界**活动（三个已收口包的全量重扫）
放在一个**已冻结、已限定分母**的交付入口上。详见 S-7。

---

## 2 · 独立复算与逐条确认（这些不用再动）

| 核验项 | 我的独立结果 |
|---|---|
| 57 exact exports | **复算 = 57**（3+10+7+7+2+5+6+9+3+5），**无重名** |
| contracts 74 → 73 → 69 | **逐名复算 `expectedPublicExports` = 74**；删 1 得 73、再删 4 得 69 ✓ |
| 契约一 "7 完整 + 2 拆分" | **从 §0-A 表独立重建，结果相同**；详设 §1.4 九项与我的映射逐条对上 |
| 模块 context 9 项 | **逐名比对，与需求 §4.3 完全一致**（顺序都一样） |
| actor context 11 项 | **逐名比对，完全一致** |
| `CommandExecutionObservation` 冻结形状 | **9 字段、无 `requestId`、`target:'local'\|'peer'`、`displayMode` 从 A 起即完整联合而 A 只赋 `null`** —— 四项全部成立 |
| 六条聚合规则 0→5 | **与需求逐字一致**，短路顺序、`completed+timed-out=partial-failed`、`error+timed-out=error` 都在 |
| ⑤b 五行映射 | **五行齐**（在途→running 归 §10.2 人工核，理由成立：A 期无公开观察口） |
| A-5 落点 = 8 处 | **成立**（分组与需求不同但同一个 8）；`50–56` 保持原字节 **正确**；`83–96` 改判 package mismatch **正确** |
| test owners 9 / REAL 4 / NO_TEST 5 | **成立**（现状 8 owners、3 REAL、5 NO_TEST，加 runtime 即 9/4/5） |
| `StateResetActor.handleResetCommand()` | **真实存在**（`state/src/types/runtime.ts` 第 19 至 20 行，经 `getResetActor()` 取得）；详设"不得导出根级 `resetState()`"的写法与真实 API 对上 |
| 角色 slice `isolated` 能挡住入站同步 | **成立且我亲验了机制**：`defineStateRuntimeSlice` 对 `isolated` 强制 `sync` 缺席，`findSyncSlice` 因此找不到它，`applyAuthoritativeSync` 返回 `skipped/SYNC_NOT_DECLARED`。测试 I-3 的断言站得住 |
| 三个记录类型可作 `StateJsonValue` | **成立**：`StateJsonObject` 是 `readonly [key:string]: StateJsonValue`，`type` 别名有隐式索引签名；branded id 是 `string & {...}` ⇒ 可赋给 `string`；`TimestampMs` 是裸 `number` |
| `PlatformPorts` 能喂饱 `createStateRuntime` | **成立**：`logger` / `persistKv` / `persistSecure` 三个端口都在 |
| `plannedKind` 的下游消费者 | **只有 `graph-model.mjs` 第 72、92 行**，全仓无第三处读它 ⇒ 移除 runtime 的 `plannedKind` 爆炸半径很小，§6.3 的改动是可控的 |
| reset 三个洞 | **三个都堵了**：登记键用根 `commandId`（洞①）· 第二次 reason 只进 journal（洞②）· reset 期间的 reset 忽略并进 journal（洞③） |
| journal 承接六类 | **六类都有对应 event kind**，一条不缺 |

---

## 3 · findings

### M-1 · §0-A 那个 B→A 触点，在这份设计里必然破约

**位置**：详设 §5.6（transition 判别联合）+ §5.2（"A 不读 routeContext 的任何字段"）

**仓内/文档事实**：§0-A 触点原文是"A 期在分发器里构造观察时恒写 `null`；B 期改为从 `routeContext` 取值。
**B 只改这一处赋值，不改类型、不改调用点**"。需求那句话成立的前提是
**观察在分发器里构造** —— 分发器天然持有 `routeContext`。
详设按契约二把构造搬进了 `emitLifecycle`（这一步是对的），
但 §5.6 逐项列出的 transition 覆盖面里**没有 `routeContext`**，
§5.2 又明写 A 不读它、只把它交给 gateway。

**可证伪的失败后果**：B 期要把 `displayMode: null` 换成取值时，**emitter 函数体内没有 `routeContext` 可读**。
B 必须同时做两件被触点明令排除的事：① 给 `command.started` 的 transition 类型加字段；
② 改分发器里那个 emit 调用点。触点登记的全部意义就是让 A 的评审拦住这个 —— 现在没拦住。

**最小修复**：A 的 `command.started` transition 显式携带 `routeContext: CommandRouteContext | null`，
**A 不读它的任何字段、只搬运**（与 §5.2 的不透明原则一致）；
emitter 在 A 期写 `displayMode: null`，B 期只把这一个表达式改成 `routeContext?.displayMode ?? null`。
**公开面零变化，A 的行为零变化。**

**为什么不是更小的方案**：不能靠 accumulator 兜 —— accumulator 条目也由 `command.started` 建立，
是同一个入口；也不能让 B 自己去查 —— 观察一旦构造完就与 routeContext 脱钩了。

---

### M-2 · 启动阶段 4 的失败语义没有定义，而两种读法后果相反

**位置**：详设 §5.8

**仓内/文档事实**：按详设自己的 §4.6 与 §5.5，`dispatchCommand` 在 actor 失败、
网关未安装、超时时**一律不 reject**，只返回 `status:'error' | 'timed-out' | 'partial-failed'`。
§5.8 对阶段 4 只写"派发 `initializeCommand` 并 await 完成"，再加一句
"任一阶段失败进入不可逆 `failed`" —— **但"phase 4 失败"是什么，全文没有定义**。
测试矩阵 L-1（四阶段有序）与 L-2（失败后 typed reject）都不覆盖这一支。

**可证伪的失败后果**：业务模块挂在 `initializeCommand` 上的 actor 抛错
⇒ 聚合出 `error` ⇒ `dispatchCommand` 正常 resolve ⇒ `start()` resolve ⇒ `status='started'`。
装配方拿到一个"启动成功"但模块从未初始化的 runtime，
正是需求 §4.5 引 `TR-02` 明令禁止的"什么都没做却返回成功"。
反向读法（非 `completed` 即 `failed`）同样有确定代价：任一业务模块的 initialize actor 出错即整机启动失败。
两种读法都能从现文本读出来，实施者会自己裁一个而没人知道。

**最小修复**：写死判据，并补一条 L 组用例。**我的建议是 fail-closed**
（`initialize` 的聚合结果非 `completed` 即进 `failed`，`AppError` 带专门 key），
因为 §4.5 的整节立意就是"不得让它看起来还能用"，
且 `allowNoActor:true` 已经保证"没有任何模块挂 initialize"这种正常情形算 `completed`。

**⚠️ `DEXTER_DECISION`**：若产品要"单个非关键模块 initialize 失败不阻断启动"，
那是产品裁定不是实现细节 —— 需求 §4.5 同样没定，**这一条是我的需求也漏了**。
未裁决前不得按沉默实现。

---

### S-1 · `parentCommandId` 的规则没有分域，门面路径与约束四对撞

**位置**：详设 §5.2 第 7 条

**事实**：原文"`parentCommandId` 默认取当前 commandId；显式值只允许等于当前 commandId，防止伪造链"
写成一条不分域的规则。同节其它条目有的明写"actor 子命令"，这一条没有。
而门面路径**没有"当前 commandId"**（它就是在创建那条命令）。

**可证伪的失败后果**：两种读法都坏。
① 若规则适用于门面：跨机入站按约束四要带**对端**的 `parentCommandId`，
它必然不等于本机的"当前 commandId" ⇒ 按字面实现即拒 ⇒ 约束四作废，
需求 §4.7.2 ⑤ 的双观察合并连不上。
② 若"默认取当前 commandId"落到门面：新命令的 `parentCommandId` 等于它自己的 `commandId`
⇒ 根命令自成其父 ⇒ B 的 `rootCommandId`（定义是"`parentCommandId` 为空的那条"，需求 §4.7.5）
**恒算不出根**，`RequestExecutionView.rootCommandId` 永远为 `null`。

**最小修复**：拆成两句 —— **actor 上下文**照现规则（默认取当前 commandId，显式值只允许相等）；
**runtime 门面**原样接受调用方给的 `parentCommandId`，**缺省 `null`**。测试 V-4 补一条门面带外部 parent 的断言。

---

### S-2 · 删掉保留名单是对的，但防伪造那一半没有替代物

**位置**：详设 §5.3 最后一段

**事实**：需求那张保留 `actorKey` 名单同时承担两件事 —— ①"内部记录经与业务 actor 相同的注册路径产生"
（详设已论证这条不成立，删得对）；②**与"`actorKey` 重复一律报错"共用同一张注册表 ⇒ 业务模块撞名即报错**。
详设只处置了 ①，保留 `kernel.base.runtime.peer-dispatch` 作为**包内私有常量、不进 registry**。
同时详设 §4.2 只给 `defineCommand` 的裸名禁了 `.`，**`defineActor` 的 `actorName` 没有同款规则**。

**可证伪的失败后果**：模块 `kernel` 声明一个 `actorName = 'base.runtime.peer-dispatch'` 的 actor
⇒ `actorKey` 拼出 `kernel.base.runtime.peer-dispatch`，与合成网关记录的 key **字符串相同**。
registry 不会报错（合成记录根本不在 registry 里）。
B 期台账里这条业务 actor 的执行记录与网关合成记录**不可区分**，
而 ⑤b 的整个语义建立在"这条记录代表网关这次派发"之上。

**最小修复**：`defineActor` 构造期禁止 `actorName` 含 `.`（与 `defineCommand` 的裸名规则同形），
一条构造期断言 + 一条 N 组用例。

**为什么不是更小的方案**：恢复保留名单不行 —— 详设已经论证合成记录不进 registry，
名单对它本来就无效；只有禁点号才把碰撞变回**结构上不可能**，
和 §4.1"业务模块的 `moduleName` 撞不到 `kernel.base.runtime`"是同一类论证。

---

### S-3 · `visibility` 有两个声明源，没有对账规则、没有测试

**位置**：详设 §4.2（`DefineCommandInput.visibility` 必填）+ §5.1 第 7 条（`AppModule.commands` 为"声明权威"）

**事实**：亲验 `apps/terminal/kernel/base/contracts/src/types/module.ts` 第 11 至 14 行 ——
`AppModuleCommandDescriptor = { readonly name: string; readonly visibility?: 'public' | 'internal' }`，
**`visibility` 是可选的**。详设把 `AppModule.commands` 定为命令存在性的"声明权威"，
同时让分发只读 `CommandDefinition.visibility`（必填）。
需求 §4.2 第 4 条要求的"`visibility ?? 'public'` 必须钉死"在详设里**没有任何落点**，
测试矩阵 V 组也没有对应用例。

**可证伪的失败后果**：模块 manifest 写 `{name:'x', visibility:'public'}`，
`defineCommand` 给 `internal` ⇒ 两处声明相反、无人检查。
按详设自己定的"声明权威"去读 manifest 做审计，得到的结论与运行期相反：
审计者以为 `x` 需要 `requestId`，实际不需要。

**最小修复**：一句话定死分工 —— **分发只读 `CommandDefinition.visibility`**；
注册期断言 `AppModule.commands` 里同名条目**若带 `visibility` 必须与定义相等**，否则报错；
V 组补一条用例。（把 contracts 的可选字段改必填是更大的方案，会动第二组契约，本批不该做。）

---

### S-4 · A-5 第 3 项新增的检查没有定序，设计自己的第 6、7 项因此可能不成立

**位置**：详设 §7.3 第 3、6、7 项

**仓内事实**（逐行亲验 `tools/terminal-skeleton/verify.mjs`）：
第 75 至 77 行是 `markers.length !== expected.length` 的**第一道**检查；
第 89 至 97 行是**三条并列的 per-package 硬编码断言**
（contracts / platform-ports / state 必须 REAL_TESTS，各自有自己的错误消息）；
第 98 行才是 `real.length !== 3`。
详设第 3 项说"marker exact-set 分别验证 all owners、REAL owners、差集 NO_TEST owners，
删除 `real.length !== 3`" —— **没说新增的 REAL-owners 精确集检查插在那三条断言的前面还是后面**。

**可证伪的失败后果**：若插在**前面**，夹具 6（`verify.test.mjs:57-69`，
`assert.throws` 期望 `/platform-ports marker must be REAL_TESTS/`）与
夹具 7（`:70-82`，期望 `/state marker must be REAL_TESTS/`）会先命中新检查的消息
⇒ 两条正则都不匹配 ⇒ **两个夹具变红**，而详设第 6、7 项写的是"仍定向命中"。

**最小修复**：明写"REAL / NO_TEST 精确集检查排在三条 per-package 断言**之后**"
（这样两条夹具原样成立），或同批把两条夹具的期望消息改成新检查的消息。二选一，但必须选一个写下来。

---

### S-5 · A-4 明令写进门里的那句反例登记，整个缺失

**位置**：详设 §7.2

**事实**：需求 A-4 原文——"门只建**正向**那一半（「声明了 `owner-only` 的包必须有重启恢复用例」），
并**在门的反例栏明写「反向断言这一半本批无对象可测，B 交付台账后补齐」**"。
详设 §7.2 是编号列表，**没有反例栏**；`RUNTIME_RESTART_POSITIVE` 只写
"角色 descriptor 持久化且测试存在跨 runtime 恢复用例"，全文再无这句登记。

**可证伪的失败后果**：`TR-04` 门看起来是完整交付的，
"反向断言待 B 补齐"这笔欠账在任何文档里都不存在 ⇒ B 期没有触发点。
同一节还有第二层：这道门的判据是**存在性扫描**（"测试存在…用例"），
而详设自己在同一节论证过存在性扫描不能证明语义 —— 这个限制也没有标注在门上。

**最小修复**：给 §7.2 五道门补反例栏；`RUNTIME_RESTART_POSITIVE` 那一行照需求原话写，
并加一句"本门是存在性扫描，不证明恢复语义正确"。

---

### S-6 · `requestMaxResidenceMs` 的校验弱于需求，且需求明令的推导缺失

**位置**：详设 §5.11

**事实**：需求 §4.7.6 第 3b 条立了一条硬不变量 ——
"**上限必须大于「一条命令链可能的最长在途时长」**…命令链的在途时长由每条命令的 `timeoutMs` 决定，
**详设须给出上限与 `timeoutMs` 缺省值的关系并写明依据**"，并建议 4×。
详设只给了 `requestMaxResidenceMs >= requestRetentionMs`，**与 `timeoutMs` 的关系一字未提**。

**可证伪的失败后果**：装配方**合法地**覆盖成 `requestMaxResidenceMs = requestRetentionMs = 1800000`（30 分钟），
而 `maxCommandDepth = 32 × defaultCommandTimeoutMs = 60000` ⇒ 一条满深度命令链的在途时长可达 1920000ms（32 分钟）
⇒ 3b 的**无条件淘汰**会把仍在执行的 request 删掉 —— 正是 3b 用来否掉上一版修法的那个错，只是常数不同。
（默认值 7200000 本身是安全的：2h > 32min。问题在校验规则允许不安全的覆盖。）

**最小修复**：校验改成同时要求
`requestMaxResidenceMs > maxCommandDepth × defaultCommandTimeoutMs` 且 `requestMaxResidenceMs >= 4 × requestRetentionMs`，
并在 §5.11 写一句依据。

---

### S-7 · CP-A0 的位置不对（Dexter 点名要判的那条）

**位置**：详设 §9 CP-A0

**事实**：需求 §7 把"contracts / platform-ports / state 的完整逐行重扫"
定性为**需求完整性欠账**，并明写"**建议与本批并行**、由独立子 agent 分三路做，**结论回填本节**"。
详设把它升格成"实施入口阻断"：三份全量重扫闭合前不得写 A 的任何源码。

**可证伪的失败后果 / 为什么位置不对**：
这把一个**无界**活动放在一个**已冻结、已限定分母**的交付前面，而它与 A 的正确性耦合很弱。
A 对三个包的真实消费面是可枚举的小集合，我本轮花几分钟就核完了：
`createStateRuntime` 的入参 · `getResetActor().handleResetCommand()` · `flushPersistence()` ·
`getStore()/getState()` · `defineStateRuntimeSlice` 的 persist/sync 声明形状 ·
`PlatformPorts` 的 `logger`/`persistKv`/`persistSecure` · contracts 的 id 工厂与 `AppError`/`isAppError`。
全量重扫的绝大多数产出落不到 A 上；而 A 真正的前置风险恰恰是**定向核验**才抓得到的那类
—— 例如 `CreateStateRuntimeInput.runtimeName` 是必填而详设的 `RuntimeStateInput` 里没有（N-3），
全量重扫未必会把它当成 finding，定向核验一眼就看见。
按 `CLAUDE.md` 的"小批量、冻结即审、分钟级"与右尺寸标尺，这个位置用 schedule 风险换了很薄的正确性收益。

**最小修复**（拆成两件，两件都保留）：
- **入口前置**只保留"**A 实际消费的三包 API 面定向核验**" —— 有限清单、分钟级，
  产出直接进 §5.8 / §5.9 / §5.11 的入参与调用形状；
- 需求 §7 那轮**全量重扫并行做**，结论回填**需求 §7**，不阻断 A 的 CP-A1/CP-A2。
  若重扫真推翻了 A 的某条前提，那条前提本身一定出现在上面那份定向清单里。

**为什么不是更小的方案**：不能把入口核验也砍掉 —— N-3 证明确实存在会落到 A 身上的偏差。

**⚠️ 授权边界**：如果 Dexter 就是要借 CP-A0 顺带把三个包的欠账清掉，那是**排期裁定不是设计缺陷**，
但那时应写成"并行、且不阻断 CP-A1/CP-A2"，而不是"实施入口阻断"。

---

### N 组（9 条，逐条都是行级修订）

| # | 位置 | 事实与后果 |
|---|---|---|
| N-1 | §1.4 第 7 项 | 写"record.result 为 `StateJsonValue \| null`"，而 §4.4 的类型块写的是 `readonly result: StateJsonValue`（**正确**）。需求 §4.7.2 明写这是刻意的唯一例外（`null` 本就在 `StateJsonPrimitive` 里，写 `\| null` 是空操作）。摘要与正文不一致，以正文为准即可 |
| N-2 | §5.6 vs §5.10 | §5.6 说"B 的**唯一**改动是在此函数体追加台账 slice dispatch"，§5.10 说"B 只注册'清旧角色 ledger' effect"。B 至少有两处改动（emitter 体 + effect 注册），"唯一"这个词与契约三直接打架 |
| N-3 | §5.8 `RuntimeStateInput` | 亲验 `CreateStateRuntimeInput` 有 **10 个字段**，其中 `runtimeName` **必填**、`persistenceDebounceMs` **必填**。详设的 `RuntimeStateInput` 没有 `runtimeName`，且把 debounce 写成可选却没给缺省值。需求 §4.5 明令"详设须逐字段列出并说明哪些有缺省、哪些必填"。⚠️ 我核过 `runtimeName` **只用作 logger 的 `component` 标签**（`createStateRuntime.ts:97`），不进存储命名空间（那是 `persistenceKey`），所以风险有限；但 §8【A】要求"两个 runtime 实例"，同名会让两边日志不可分 |
| N-4 | §4.5 `Runtime` 形状 | `status` / `failure` 写成 `Readonly<{...}>` 上的**属性**。若真按属性实现，`createRuntime` 返回后它们永远停在 `'created'` / `null`，测试 L-2 断言的 `status=failed` 拿不到 ⇒ 实现必须是访问器，详设应写明。另：`getState` 声明为同步 `() => StateRoot`，§5.8 却说它在失败后"reject" —— 同步函数只能 throw；且 **`created` 阶段（store 尚未创建）调 `getState`/`getStore` 的行为全文未定义** |
| N-5 | §4.1 exact exports | 公开形状里出现了 `RuntimeModuleDispatch`（模块 context）、`ActorDispatch`（actor context）、`RuntimeDispatch`（`Runtime`）三个具名类型，**三个都不在 57 项里**。结构化使用不受影响，但"exact exports"门对这三个名字是盲的，改名不会红 |
| N-6 | §5.7 / §5.6 | "journal append、全局 observer、per-dispatch observer 分别包在独立 catch 中，**失败只写脱敏诊断**"—— 没说诊断写到哪。若写回 journal，就与"`journal.append` 在 `src` 只有一个调用点"冲突，并且在 append 确定性失败时会递归。应明写降级去处是 platform logger。（测试 J-2 注入失败 journal 时会暴露它，所以后果有限） |
| N-7 | §5.10 vs 需求 §4.8a | 详设说"`internal` 不能机械阻止 UI/automation，只冻结 owner 约定"——**这比需求诚实**。需求 §4.8a 的理由句"`internal` 使它只能被模块内的 actor 发出"**是错的**：`setRuntimeInstanceModeCommand` 必须公开导出（display-context 要发它），任何 actor 拿到定义对象都能派发。⚠️ **这是我的需求的缺陷**，详设纠正得对，但应显式记一句"本设计与需求 §4.8a 的该理由句相反"，否则后续读者会把假保护恢复回去 |
| N-8 | §7.1 测试矩阵 | 两处遗漏：① D-2 的 `allowNoActor` 正反与 D-5 的三条判别用例**都没写 `completedAt !== null` 前置**，而 rule 0 排在最前，缺前置时它们会一起退化成 `running`、判别力归零（需求 §8 对这两组明写了前置）；② P-4 只写"按字符串入站复用完整注册 definition"，缺需求点名的那条断言 ——"对端收到一条本机声明 `allowNoActor:true` 的命令且本机无 actor ⇒ 结果是 `completed` 而非 `error`"，那是专门证伪 POC §3.4⑧ 的用例 |
| N-9 | §12 README 清单 | 缺两项需求明令写明的：① 需求 §4.6 ③"reset 会重跑 `initialize` ⇒ 模块的 initialize actor 必须能被重复执行"；② 需求 §4.4 已承认的**本批不满足**项"角色切换的业务留痕在重启后不存在"（台账 `never` + journal 不持久化，而角色本身持久）。⚠️ 后者需求说"登记在 §7 欠账"，但**我的需求 §7.1 表里没有这一行** —— 详设按"承接 §7"抄不到它。请在 HANDOFF 或 §13 单列 |

---

## 4 · 对评审 prompt 逐项的回答

**一、范围与跨单元契约**

1. §0-A 划给 A 的正文十一项（§4.1 · §4.2 · §4.2b 除 ② · §4.2c · §4.3 含 §2.3 要求二/四 · §4.4 · §4.4b · §4.5 · §4.5b · §4.6 · §4.8a）**全部覆盖**；**没有提前实现 B**（无 slice、无 selector、无淘汰、无 latest-wins、无第二级聚合），§5.3 对"单 request 命令数只定义不消费"的处理正确。
2. 契约一 **7 完整 + 2 拆分核对通过**，详设 §1.4 九项与 §0-A 表逐条对得上。
3. 单一 emitter **能**成为四者的唯一产生点 —— 三条合法路径都经它、`journal.append` 单调用点、observation 只在那里构造、accumulator 在同一函数内推进。**但见 M-1**：transition 不带 `routeContext`，B 期接不上。
4. 角色变更 effect **发生在角色字段写入前**（§5.10 明写，测试 I-2 有正反断言），成立。
5. 两种门面**都保留四项身份 options**（§4.2 重载 + V-4），**但 `parentCommandId` 的规则没分域**，见 S-1。
6. **不成立** —— 见 M-1。

**二、类型和执行语义**

1. 57 项：**复算 57、无重名、无冲突**；未过多（B 的三个 limits 默认值必须在 A 冻结，是接口成本不是过度）；**有遗漏**：三个 dispatch 类型别名不在集合内（N-5）。
2. 9 / 11 **逐名准确**。
3. observation **严格保持冻结形状**，三项都对。
4. 六条规则**按 0→5 有序短路**，且明写"不得改为并列布尔"，正确。
5. actor 返回值校验 / 克隆 / 体积 / 迟到完成语义**成立**（一次遍历同时完成校验+克隆+计量是比需求更紧的写法，且"非法只使该 actor 失败、不 reject"与 §4.3 一致）。
6. 未安装 / 超时 / `partial-failed→error` **都仍返回 typed result**，`result` 恒 `null`，成立。
7. `unknown → AppError → LedgerError` **两层闭包完整**，`isAppError` 透传在第一层，五字段投影在记录边界，全包一份，成立。

**三、生命周期与状态**

1. **存在一条半启动路径** —— 见 M-2。其余（构造与启动分离、四阶段有序、失败不可逆、失败后调用 typed reject）成立。
2. reset **只调 `StateResetActor.handleResetCommand()`**，且明令不导出根级 reset，与真实 API 一致，成立。
3. reset reason / reset-during-reset / previousState / initialize 重播顺序**四项完整**。
4. 角色 slice 的 owner-only / immediate / isolated / 重启恢复 / effect 顺序**五项成立**，且 isolated 挡住入站同步这一条我亲验了 state 的实现机制。
5. `internal` **被诚实限定为语义而非 caller 权限** —— 成立，且比需求诚实（N-7）。

**四、验证闭包**

1. 测试矩阵**总体能证伪对应缺陷**（每例带正/反断言 + 所证伪缺陷，是好形态），两处遗漏见 N-8。
2. 单一事实产生点**正确保留为人工源码审查**，且给出了"为什么不能做成机器门"的正确理由，没有伪装成 machine PASS。
3. A-5 八处**准确**；`83–96` 命中 package mismatch **正确**；**但第 3 项定序缺失**，见 S-4。
4. **9 / 4 / 5 正确**。
5. README / HANDOFF / §7 欠账：README 缺两项（N-9），§7 欠账靠 HANDOFF 承接的写法可以，但"角色切换留痕重启后消失"这一项 §7 表里没有行，抄不到。
6. "全绿但 runtime 没建成"的路径：**不存在**（测试矩阵是真实行为测试，不是夹具堆）。但存在"**全绿而 B 接不上**"的路径（M-1）和"**全绿而 initialize 已失败**"的路径（M-2）。

**特别边界**

- **CP-A0 位置不正确** —— 见 S-7，给了最小正确形态。
- **删除广义保留名单是最小正确方案** —— 理由成立、需求本身授权了；**但防伪造那一半需要一条 `defineActor` 禁点号断言替代**，见 S-2。
- **routeContext 只不透明继承/整体替换/交给 gateway、不定义 wire、不解码、不读字段** —— 设计**符合**，且 §5.2 的表述比需求更清楚。
- **A 不建台账 / selector / 淘汰 / latest-wins / displayMode 记账** —— **确认全部没建**。

---

## 5 · IA / UI

`NOT_APPLICABLE`。本包是 kernel 层执行骨架，**无任何用户可见界面、无 Journey 操作、无焦点行为、无文案**；
详设 §0 与 §11 都已如实标注 `N/A` 并说明理由，不是回避。
唯一与 UI 沾边的是"UI 必须先持有 `requestId` 才能订阅台账"，那条的执行点在 B 与调用方，不在本包。

---

## 6 · 结论与授权边界

**`VERDICT = NO-GO`　`M=2  S=7  N=9`**

**NO-GO 的全部理由是 M-1 与 M-2**，两条都是行级/一句话的修订，不涉及方案重做：
M-1 给 `command.started` 的 transition 加一个不透明搬运字段；
M-2 裁一个 initialize 失败判据（其中"要不要 fail-closed"可能需要 Dexter 一句）。
S-1 至 S-6 都是同一批可以一起改的行级项；S-7 是排期/位置的判断，可能是 Dexter 的裁定而非缺陷。

**这个结论授权什么**：什么都不授权。
它是一次**静态设计评审**，不授权实施、不授权开始 CP-A0、不授权修改任何 TER 源码、
不授权运行命令 / 测试 / 动态环境，也不代表"改完 M 就可以开工" ——
修订后是否需要再评一轮由 Dexter 定。

**这个结论不能证明什么**：本轮**没有运行任何命令**。
所有"成立/不成立"都是对**源码与文档字节**的静态核验；
类型是否真的编译通过、40 条测试是否真的能写出来并变绿、五道门的红夹具是否真的定向红，
**本轮一概未证**，那些只能由实施期的新鲜运行输出回答。
