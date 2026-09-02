# TER 门缺陷整改详设与实施计划 · DESIGN Review（Claude）

```
REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01
REVIEW_ROUND=2   REVIEW_ROUND_LIMIT=2   ROUND_FINAL_DECISION=SELF_DECIDED
REVIEW_TARGET=DESIGN   reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=NO-GO        M=7   S=17   N=11
L1_ENGINEERING=NO-GO   L2_USER_VISIBLE=NOT_APPLICABLE
EVIDENCE_TIER=CURRENT_SOURCE（零命令执行；全部静态读码 + TS AST 求值）
```

⚠️ **第一轮 review 未落仓**，`doc/review/platform/` 下此前只有两份 request。本文补齐两轮完整 findings。
⚠️ **利益冲突**：本文作者同时是缺陷登记（`…gate-defect-registry-claude.md`）的作者。
本轮有三条 finding 的根因在该文档，已在文中标明并当场更正。

## 完整性核对

| 材料 | 声明 SHA-256 | 实测 | |
|---|---|---|---|
| 修订详设 | `c4c9c546…8927a` | 一致 | ✅ |
| 修订计划 | `9bd50913…589b7` | 一致 | ✅ |

## 盲审输入清单

第一轮：三路 fresh 独立子 agent（D-1…D-14 判据绕过 / workspace+collector+invariant / 实施计划+右尺寸），
均先只读源码独立推导再开详设。第二轮：作者按 Dexter 指示自核（`review codex 的工作，你自己 review 就好了`），
两路后台盲审仅作交叉验证。全程只读、零构建、零测试。

---

## 一、五项结构修订的核验结果

| # | 核验点 | 结论 |
|---|---|---|
| 1 | D-9 是否彻底删除机制 | ✅ **通过**。`runtimeSync` 全文 0 命中；`companion` / `unique-consumer` 的 4 处提法（design `:45/:368/:606`、plan `:210`）全在「删除／不建」语境；`getStore/getState/StateRuntime` 形状明写不动（design `:380/:389`）；`TR-09` 只新增一条消费规范（`:382`）；`UNENFORCEABLE_BY_MACHINE` 有对应行（`:479`）；技术性停机条件已调整 |
| 2 | 缺陷登记旧 D-9 建议是否消歧 | ❌ **本轮发现仍冲突，已由作者当场更正**。登记 D-9 节原写「由 runtime 内部持有」「类型层不可达 `tsc` 必红」「必须有一道门能检出新增的写任意 slice 导出」——三条全部与新裁定相反。已重写该节、裁定表标注 ⑦ 作废并补 ⑪⑫⑬ |
| 3 | 是否零 display-context 前置 | ✅ **通过**。marker 为 `NEXT_OWNER_PACKAGE_GATE_BLOCKERS=PASS`（design `:226`、plan `:29/:127`）；`display-context` 全文仅剩 3 处，均为「解耦声明／不指向／与本批无关」（design `:46/:566`、plan `:132`）；零前置 |
| 4 | D-5 是否只在单元 B 顺序优先 | ✅ **部分通过**。D-5 在 B1，明写「不阻塞任何包」（plan `:31`）。⚠️ 但 exception 计数自相矛盾，见 S-A |
| 5 | D-8 是否在所有合法 delta 前迁移 | ✅ **通过，第一轮 M-6 关闭**。design `:325` 明写 D-8 是单元 A 首个写入 CP、必须先于 D-1…D-4 与全部合法变更；`:327` 迁移完成后删掉一次性总数硬断言；`:84` 单元 B baseline 从当时 invariant 求值、不再期待 312/20；plan `:47-48` 那五个数只作 `A1_MIGRATION_INPUT`；`:59` 删除一次性生产断言；`:138` 只记录当前值；停机条件改为「**仍试图**把迁移时数字当硬常量」（design `:573`）——从「数字变了就停」改成「行为错了才停」，方向正确 |
| 6 | 切分是否合规 | ✅ **通过**。`IMPLEMENTATION_AUTHORITY=false`（plan `:12`）；A 完成独立 `REVIEW_TARGET=IMPLEMENTATION` 后 B 才冻结（`:20/:132`）；**步骤级 fresh 三维对账保留**且明写不产出单元 GO/NO-GO、不消耗正式轮次（`:21`）；未重置本 DESIGN cycle |
| 7 | D-4 先稳定、D-6 后退役 | ⚠️ **顺序对，但不解决问题**。D-4 在 A2、D-6 在 B2，顺序正确；但组合缺陷不是竞态，切分后反而更隐蔽，见 M-4 |

**应予肯定**：第 5 项是本轮质量最高的修订——它把停机条件从「绝对数复现」改成「行为是否错误」，
是对第一轮 M-6 的正确闭合，且顺带消除了「合法变更导致必然停机」这一类问题的整个家族。

---

## 二、Major（7 条，全部 OPEN）

### M-1 · D-22 分母仍只覆盖 33 个闭集 union 中的 8 个

**证据档位**：仓内事实（作者 TS AST 穷举）。
四个已建包内闭集字符串字面量 union 共 **33 个**；详设 `:31` 仍以「§2.2 的 20×8 为迁移 baseline」，
即 **8 个（24%）**。未保护的 25 个含 `PersistIntent` · `CommandVisibility` · `CommandTarget` ·
`PersistenceFailureKind` · `PlatformPortName` · `RuntimeStatus` · `ActorExecutionStatus` 等。

**判据全过但缺陷仍在**：照详设实现 D-22，20 条绑定全绿，同时把
`PersistIntent = 'never' | 'owner-only'` 退化成 `string` ⇒ 全门绿，`persistIntent: 'ownerOnly'` 拼错从此可编译。
🔴 **连带打击 D-6**：退役 `restart-positive` 的唯一行为证据就是变异 `persistIntent`。

**最小修复（已按 Dexter「千万不要过度设计」下修）**：
⚠️ **不要求覆盖 33 个，也不要求建可派生机制。** 真实风险不成比例——
`PersistIntent` 退化会拆掉 D-6 退役的地基，而 `MaskCategory`、`PersistenceEntryKind` 之类退化了几乎无感。
**只做两件事**：① 在 §2.2 写明「为什么是这 8 个、其余 25 个为什么不进」，一段话即可；
② 把 `PersistIntent` 补进去——它是本批**唯一有确证连带后果**的那个（D-6 的退役验收变异就是改它）。
⇒ 从「8 个手挑、无理由」变成「9 个、有理由」，不建任何机制。

**更小替代为何不足**：什么都不做不足——`PersistIntent` 那条连带是实证的，不是假设。
plan `:248` 把「D-22 只保 8/33」列为 B7 对账反例也不足——那只是让同一 finding 在最后一步被重新发现。

⚠️ **本条的药方原为「分母必须可派生」，是评审者自己的过度设计，已撤回。**
根因仍在需求：缺陷登记 D-22 写「集合须有 owning source」却给了手挑样例而未给理由，详设忠实照做；
正确的需求措辞应是「手挑可以，但必须写明取舍」。

### M-2 · D-22 绑定表仍引用仓内不存在的类型名

**证据档位**：仓内事实。详设 `:92`/`:93` 的 `ErrorProjection.category`/`.severity`、
`:95` 的 `RequestSnapshot.status` —— 两个类型名**在 `apps/terminal/kernel/base/*/src` 全域不存在**
（真实为 `DefineErrorInput` 与 `RequestLifecycleSnapshot`）。
而 §3.2 要把这张表**冻进 `terminal-invariants.json`**，且该迁移是**单元 A 的首个写入 CP**。
⇒ 单元 A 会冻结一份含两个不解析符号的名单。
**最小修复**：迁移前对 20 条绑定逐条做 symbol 解析，解析失败即停机。

### M-3 · D-4 的 fail-open 未修，被移进 `UNENFORCEABLE_BY_MACHINE`

**证据档位**：仓内事实 + 推论。详设 §4.3 与第一轮相比实质未变；
`:474` 新增一行「D-4 某 package 是否应有 test/lint/clean｜script 存在只能证明声明，不证明应该声明」。

**两个今天红、整改后绿的变异**（今天由 `verify.mjs:30-34` 冻结数组 **与** `:106` 的
`if (!real.includes(runtimePackageName)…) throw` 双重钉死，详设两者都删）：
1. 删 `runtime/package.json` 的 `scripts.test` ⇒ 该包退出分母 ⇒ PASS；
2. 删光 `runtime/test/` ⇒ owned runner 如实报 `NO_TEST_FILES` ⇒ PASS。

**为什么移进 UNENFORCEABLE 不够**：「某包**应否**有测试」确实是判断题、机器证不了；
但「runtime 从 76 条测试掉到 0」是**机器可钉的回归**——而 §3.2 创建的 `terminal-invariants.json`
正是现成的第二来源。**Codex 把可判定的回归与不可判定的一般问题一起让渡了。**
**最小修复**：各包 invariant 增一个 owned 字段（如 `taskOwnership`），verifier 比对 marker kind 与 owner 归属；
骗过门需同时改包与其 invariant——正是 §3.2 建立的可逆性。
**更小替代为何不足**：保留四段 kernel 身份断言正是 D-4 要消灭的（它禁止 adapter 长出第一个测试）。

### M-4 · D-4 与 D-6 的组合缺陷在切分后更隐蔽

**证据档位**：推论，两条锚点均已亲验。
D-6 退役静态门的理由是行为门接管（`foundations.test.ts:166` 与 `requestLedgerCleanup.test.ts:368` 两条）；
M-3 使这两条可被删光而全门绿。切分后：**单元 A 落地 D-4（fail-open）→ A 通过自己的
`REVIEW_TARGET=IMPLEMENTATION` 收口签字 → 单元 B 再落 D-6（退役）**。
⇒ 缺陷在 A 处已存在但不可见（D-6 尚未退役），在 B 处才成立，而 A 已签字。
**最小修复**：随 M-3 一并闭合；或把 B2（D-6 退役）的出口条件加一条——
「退役当刻，删除任一接管用例必须使 verify 变红」。

### M-5 · workspace 的 store isolation 判据空真通过

**证据档位**：仓内事实。`state/test/testSupport.ts:37/43/49/62` 的 `exampleReducer` 只认
未加 scope 的 `example/setCount` 一类；而改写器（`supports/workspace.ts:73-76`）发出的是 `example.MAIN/setCount`
⇒ 两份 reducer 都不认、都原样返回。详设 §5.2 判据 4 是**纯否定式**「另一份引用和值都不变」
⇒ **一个什么都没写进去的实现拿到绿灯**。
且 §11 的 WS red mutation（「让 BRANCH action 写 MAIN reducer」）**恒绿**——
`workspace.test.ts:43-44` 两侧都是 `exampleReducer`，逐字节相同，用错 reducer 在观测上不可区分。
⚠️ 详设全文 `exampleReducer` **零命中**，本条未被触及。
**最小修复**：MAIN/BRANCH 的 reducer 必须行为可区分且以 `createSlice({name: keys[workspace]})` 生成；
断言拆成正负两半（目标 slice 值等于该 workspace reducer 的预期输出 + 另一份引用不变）。

### M-6 · `toWorkspaceStateDescriptors` 的名字检查是同义反复

**证据档位**：仓内事实。`supports/workspace.ts:86` `const keys = createWorkspaceStateKeys(...)`；
`:95` 把 `keys[workspace]` 递进 `createDescriptor`；`:96` 检查 `descriptor.name !== keys[workspace]`
—— **自产自检**。真正决定行为的 reducer↔命名空间绑定无人验证。
根因：`types/workspace.ts:22` 收裸 `Reducer<TState>`，**丢掉 RTK `Slice.name`** ——
唯一能把 reducer 与其应答命名空间绑起来的一手信息。
**判据全过但静默跨 scope 污染**：消费者两次 `createSlice({name: 'orders.MAIN'})`（第二个本应是 BRANCH）
⇒ BRANCH slice key 注册正确但其 reducer 只应答 `orders.MAIN/setValue`
⇒ BRANCH 路由静默丢写、**MAIN 路由同时写入两个 slice**。9 条 throw 全存活、逐条 mutation 仍红、全绿。
⚠️ 详设全文 `Slice.name` / 「同义反复」**零命中**。
**最小修复**：`reducers` 类型由 `Record<WorkspaceKey, Reducer>` 改为 `Record<WorkspaceKey, Slice>`，
加断言 `slice.name === keys[workspace]`（throw 由 9 变 10，§2.4/§5.2 冻结的「9 条」须同步改口径）。

### M-7 · 「文档结构自洽」不等于第一轮 findings 已关闭

**证据档位**：仓内事实。本轮只处置了三项裁定 + D-8 迁移定序 + 单元切分。
第一轮 8M/16S/11N 中，经逐条核对**仅 M-6（G8 停机）与 D-9 系列关闭**；
以下在两份修订文档中**零命中**、未被触及：
`exampleReducer`（M-5）· `Slice.name`／同义反复（M-6）· handler body（D-3 豁免单元）·
`public-surface.typecheck`（公开名单第三份副本）· `ImportEquals`（collector 分母）·
`Runtime` 无 `stop`/`dispose`（D-14）。
`UNENFORCEABLE_BY_MACHINE` 表 15 行中**仍缺 D-6 行与 D-23 行**（第一轮 S-8 与 route-B S-3）。
plan `:248` 诚实写明「尚未交付的第一轮完整 findings 到达后，须逐条 intake，不在本计划中预判结论」——
**这一点应予肯定**，但它也确认了本轮不构成关闭。

---

## 三、本轮修订新引入的问题

### S-A · D-3 的 exception 计数在同一文档内矛盾

design `:118`「单元 A 完成 D-3 时受控 exception 为 **7** 处」、`:197`「单元 A 的分母因此为 7，不能提前写成 6」、
`:606`「D-3 exception=7」；而 `:502` 的**绿判据**写「生产 dispatch 均为 actor 或**六项例外**」。
D-3 在 A2 交付，此刻应为 7。
**最小修复**：`:502` 改为 7，并在 B1 之后补一条 6 的回归锚。

---

## 四、单元 A 是否可交 Dexter 授权

本轮 GO 的含义是「可交 Dexter 决定是否授权单元 A」。**单元 A = D-8 迁移 + D-1/D-2 + D-3 + D-4。**
其中仍带三条未闭合缺陷：

1. **M-3（D-4 fail-open）** —— 在 A2，是单元 A 自身的缺陷；
2. **M-2（两个不存在的类型名）** —— A1 的 invariant 迁移会把它们冻结；
3. **S-A（exception 6 vs 7）** —— A2 的绿判据与分母不一致；
4. 第一轮 S「D-3 豁免单元是文件不是 handler body」在 A2，未被触及。

⇒ **单元 A 尚不可交付授权**。M-2 与 S-A 是文本级修正，M-3 需要一个 owned 字段，
四条合计工作量不大，闭合后单元 A 具备再次提交的条件。

---

## 五、需 Dexter 裁决

**无。** 本轮七条 Major 与新增 S-A 均属工程与文档可实施性，不涉及产品、Journey 或新业务范围。
第一轮标为 `DEXTER_DECISION` 的三项已全部裁定（⑪ 软规范、⑫ 解耦、⑬ D-5 移出）。

## 六、授权边界

本轮为静态 DESIGN review，**零命令执行**，仓内写入仅限本文件与缺陷登记的三处裁定对齐更正
（裁定表 ⑦ 作废并补 ⑪⑫⑬、D-9 节重写、§6 与 §1 组织轴改写、D-5 阻塞声明撤销）。
**不授权**实施、不授权单元 A 开工、不授权下一个 owner 包、不授权修改
`tools`／`apps/terminal`／`skeleton-graph.ts`／规范正本，不授权 D-15…D-19、仓级 verify、
native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。
本 cycle 两轮上限已达，按 `SELF_DECIDED` 收口，不再发起第三轮。
