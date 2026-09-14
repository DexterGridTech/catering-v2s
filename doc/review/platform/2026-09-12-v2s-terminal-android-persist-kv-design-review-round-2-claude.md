# TER Android persistKV 详设与实施计划 — Claude 第二轮复审

```text
REVIEW_TARGET=DESIGN + IMPLEMENTATION_PLAN (REMEDIATED BYTES)
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=GO
M/S/N=0/0/1
EVIDENCE_TIER=static（三份文档与 owning source 逐行对账）;未执行任何命令
```

## 0. 出处与方法

v2s-rooted 续接会话,非 fresh acceptance。按当前字节(详设 454 行、计划 254 行,均 09-12 23:05;需求 481 行 19:27)重开 owning source 与三份文档核验。**未执行任何命令。** 作者处置表、自检数字与 brief 的声称一律未采信,三条修复我都回到条款正文验证,并对 brief 点名的五个恶意实现逐个做了拦截推演。

**源码零改动已复核**:六个被引源码文件的 mtime 全部早于 23:05 的文档修订(`androidPersistKv.ts` 09-11 23:53、`index.ts` 09-07 21:53、`TerminalPersistKvModule.kt` 09-05 05:26、`package.json` 09-05 03:23、`platformPorts.ts` 09-12 17:23、`skeleton-graph.ts` 09-12 00:45),且 `platformPorts.ts` 第 24 行仍为 `persistSecure: unavailablePersistSecurePort`。文档"没有源码、测试、依赖、构建或动态环境变更"的声称**属实**。

## 1. 结论

`GO`,`0M / 0S / 1N`。上一轮的 `M-01`、`S-01`、`S-02` 三条全部实质闭合,修复方式与我给的最小方向一致且未扩大范围。余下一条 `N` 是我对 `S-01` 修复中一个候选手段的补充意见,不构成缺陷——设计已有的实证要求足以防止错误结局。

## 2. 三条 finding 的闭合核验

### M-01 mode token runtime fail-closed — CLOSED

详设第 110 行现在写明:mode token 是跨边界的**运行时输入,不得只依赖 TypeScript union**;合法集合冻结为精确的 `plain` 与 `protected`;缺失、null、空字符串、未知字符串或未来未登记的 token,必须**在打开 MMKV 之前**返回带 `PERSIST_KV_INVALID_MODE` 的 typed failure;任何 `else`、`default` 或"未知即 plain"分支被禁止;错误输入不得初始化、写入、清理或改变任何 namespace;**JS 侧拒绝与 native 侧独立 fail closed 两者都要**,理由明写为"以防 bridge 绕过编译期类型"。§11.1 新增第 16 条红夹具对应。

我按 brief 点名的五个恶意实现逐个推演拦截:

| 恶意实现 | 拦截点 | 结果 |
|---|---|---|
| `when` 的 `else` 落 plain | §2.1 明文禁止 + 夹具 16 点名该形态 | 挡住 |
| 只靠 TS union 不做 runtime validation | 夹具 16 **从 native 边界进入**,绕过 JS | 挡住 |
| 抛普通异常而非 typed failure | 关键在具名 code。未捕获异常会被现有 `withStore` 的 `catch (_error: Throwable)` 兜成 `PERSIST_KV_OPERATION_FAILED`,与夹具要求的 `PERSIST_KV_INVALID_MODE` **码不同**,断言必红 | 挡住 |
| 先打开或写入 MMKV 再返回 invalid | 夹具 16 断言"failure 前没有 MMKV namespace 的初始化、写入、clear 或其它状态改变" | 挡住 |
| JS 拒绝但 Kotlin 仍接受 | 夹具 16 从 native 边界进入,独立检验 Kotlin;§2.1 亦明写 native 必须独立 fail closed | 挡住 |

第三条能成立**完全依赖 `PERSIST_KV_INVALID_MODE` 这个具名稳定 code**。若后续有人把它改成复用 `PERSIST_KV_OPERATION_FAILED`,该拦截立即失效。这一点值得在实施时守住,但当前文字正确,不计为 finding。

### S-01 cryptKey mismatch 可检测性 — CLOSED

详设 §10 新增段落与计划 CP-1 第 117 行的 `cryptKey compatibility gate` 完全覆盖我的最小修复,逐条对照 brief 的五个检查点:

- **给出可执行候选而非仅禁令**:给了两个——优先实证 `checkReSetCryptKey`/相关 API,退而采用版本化 marker。通过。
- **是否把 artifact 中存在 API 当成行为已知**:**没有**。原文是"核验 MMKV 2.4.2 的 `checkReSetCryptKey`/相关 API **是否能**在不静默重置数据的前提下报告匹配或不匹配"——问的是能不能,不是断言它能。这正是我上一轮强调的区分,措辞准确。
- **marker 能否区分两类状态**:设计**要求实证**而非假定("同时验证'新建空 namespace'和'已有文件但 key 不匹配'能被区分"),并规定"若当前 MMKV 行为和 marker 仍无法区分这两类状态,CP-1 保持 OPEN"。我对候选放置位置有一条补充意见,见 `N-01`。
- **是否被塞进或等待 §7-9**:**没有**。§10 末句明写"可检测性是保护已有文件的工程前置,不能与 §7-9 的产品策略互相等待"。这正是我的原话要点。
- **失败场景是否会导致旧数据被当 missing 后继续 hydrate/flush**:该路径被"在任何 hydrate/read/write 结果可见前"这一时序要求堵住,且不匹配必须映射为稳定 typed unavailable/failure,不得返回 missing、创建新 key 或回退 plain。

### S-02 public export surface — CLOSED

详设 §9a 第 292 行新增 `public export surface` 行,锚点 `apps/terminal/adapter/android/persist-kv/src/index.ts` 与 package public entry,内容为"factory 签名、mode 类型或 convenience helper 的导出与实现同步"。计划 CP-3 的源锚(第 87 行)已含 `src/index.ts`,第 148 行有同步检查项,第 154 行有 static 断言"`src/index.ts` public export 与实现一致"。

逐条对照 brief 的五个检查点:
- factory 签名/mode 类型/helper 与内部实现同步 — 第 148、154 行覆盖。
- `src/index.ts` 是否被完整变更面、CP-3 源锚、逐代码对账三处覆盖 — 三处均已覆盖(§9a 第 292 行、CP-3 第 87 行、§5 第 1 条枚举实际变更文件不得抽样)。
- package entry 是否可能继续暴露旧一参 factory — 被第 154 行的 static 断言与 §11.1 第 14 条(README 示例仍调单参数 factory)双重拦截。
- 是否需同步 `package.json` exports — **不需要**。我亲验该包 `package.json` 的 `exports` 为 `{".": "./src/index.ts"}`,指向文件路径而非符号,`index.ts` 内容变更不触及它。`terminal-invariants.json` 亦无 `publicExports` 字段,不产生同步义务。
- 是否仍可能"内部已改、package entry 未改"逃逸 — 不能。第 154 行是 CP-3 的 static gate,且 §5 第 6 条规定任一 `OPEN` 不得交付。

## 3. brief 第四项:整体计划边界复核

- **CP 顺序** — `CP-0 → CP-1 → CP-2 → CP-3 → CP-4` 不变,串行理由(每步改变下一步输入契约)仍在,CP-4 仍要求前序 gate 与阶段对账全 `MATCHED`。
- **§12 十二项** — 我数过,**仍全部 12 项标 `[未定]`,零项被静默选边**。文档末句亦明写"本轮修复没有引入新的 Dexter 产品决定"。
- **zero-caller 边界** — §1.3 的两句仍在:不替 state engine 改批量、`writeMany` 语义待真实 caller;同时保留"R01/R12/R13 的隔离反例仍必须调用需要的 `read`/`listKeys`/`clear`"。区分未被本轮修订破坏。
- **artifact 证据档位** — 详设第 53 行的限定句与计划第 74 行的 `static artifact evidence` 标注均未改动,未扩写为 native/Android/release 行为证据。
- **逐代码对账** — §5 六条完整:枚举每个实际变更文件不得抽样(第 181 行)、只允许 `MATCHED`/`OPEN`、点名禁用 `PASS_BY_PLAN`/`ASSUMED`/`COVERED_BY_COUNT`/`NOT_RELEVANT`、任一 `OPEN` 不得交付。
- **未引入第二套东西** — 全文未见第二 adapter、第二 module、第二 registry、fallback、复杂密码学或复杂迁移。
- **完整变更面** — README、package graph、native registration、sample wiring 均仍在 §9a 内,本轮另补入 public export surface。

## 4. N finding

```text
[N-01] marker 的候选放置位置是最不可能通过可区分性实证的那一个，且没有第三候选
状态：PARTIALLY_CONFIRMED
严重级别：N
证据档位：static
位置：详设 §10 新增段落（"则采用同一 protected namespace 内的版本化 marker"）
失败场景：以错误 cryptKey 打开既有加密 MMKV instance 时，内容无法解密，读取表现通常与空 namespace 一致。放在**同一 protected namespace 内**的 marker 在这种情况下同样读不出来，因此它恰好无法区分"新建空 namespace"与"已有文件但 key 不匹配"——而这正是该 marker 要证明的事。

设计已要求实证这一点，并规定实证失败则 CP-1 保持 OPEN，所以**不会产生错误结局**。但两个候选（`checkReSetCryptKey` 与 in-namespace marker）若都失败，文档没有给第三条路，CP-1 可能停在无路可走的 OPEN 上。
影响面：CP-1 的一个周期，以及潜在停滞。无正确性风险。
最小修复方向：在 §10 补一个"可在不持有正确 key 的前提下读取"的候选，例如打开前检查 protected namespace 的底层文件是否已存在，或在 plain namespace 记录一条非敏感的"protected namespace vN 已初始化"标记。这类记录不受 cryptKey 影响，天然能区分"从未创建"与"已存在但不可解密"。
为什么更小的替代不足：只把 marker 从"同一 namespace 内"改成"某处"仍然含糊，实施者大概率仍放进 protected store；不补第三候选而依赖 CP-1 实证兜底，等于明知两个候选都可能失败还让它撞一次。
是否需要 Dexter 裁决：否。这是工程候选的补充，不改变 §7-9 的产品策略。
```

## 5. 被推翻的作者结论

**无。** 本轮我核过的每一条声称都成立,包括"源码零改动"与"§7 十二项仍全未定"。上一轮我自己那条 grep 词形过窄的漏判已在上一份交付中更正,此处不重复。

## 6. 文档仍漏掉的问题

除 `N-01` 的候选补充外,按 brief 四大项逐条扫过,**未发现其他必须在本轮回答而缺席的问题**。

## 7. 证据档位

- **static**：本评审的全部结论,来自文档与源码对账。**我未执行任何命令。** 文档自报的静态核对按自报处理。
- **focused**：`NOT_RUN`。当前仅 3 个基于 mock 的用例,protected mode 零用例。
- **native**：`NOT_RUN`。`checkReSetCryptKey` 的**行为**未知——artifact 中存在该符号只证明 API 形状,设计也正确地把"它能否非破坏性地报告匹配"列为 CP-1 待实证项。
- **Android**：`NOT_RUN`。无 module load、八方法、隔离、重启、故障注入或日志的本轮运行。
- **release**：`NOT_RUN`。clean build、API/ABI、R8、install/autolink 全部 `OPEN`。
- **cleanup**：`NOT_RUN`。
- **Web**：不在本 adapter 通过矩阵。

**本轮的 `GO` 只针对详设与实施计划这两份文档,不构成任何 implementation acceptance,也不构成任何动态行为 PASS。**

## 7b. Dexter 裁决:§12 十二项全部冻结（2026-09-12,复审交付后）

Dexter 采纳我的逐项建议,十二项 `[未定]` 全部关闭。以下是冻结文本,`D-06` 与 `D-09` 的机制部分仍带 CP-1 实证义务。

1. **D-01 timeout** — **从 `StateStoragePort` 删除该参数**,不做 deadline/cancellation。MMKV 是 mmap 本地读写,超时语义的复杂度换不来收益;消灭"收参数不执行"的中间态优先于保留形状。删除须同步全部 consumer。
2. **D-02 plain/protected timeout policy** — 随 D-01 消失;若 state 侧保留全局预算,两 mode 共用,不拆分。
3. **D-03 `readMany` 单项损坏** — **整批失败**。半份状态会被 hydration 当作真实状态继续运行,比拿不到更危险。
4. **D-04 `listKeys` 顺序** — **adapter 不承诺任何顺序,state 侧不得依赖顺序**,两侧都写死。当前依赖 MMKV `allKeys()` 的偶然顺序,须终止。
5. **D-05 key 与大小边界** — persistenceKey 非空、无控制字符、长度上限 128;entry key 非空、无控制字符、长度上限 256;单值上限 1 MiB;单批上限 512 条。超限一律 typed invalid failure,不得抛未分类异常。**namespace 总量本批不设硬上限,adapter 不做总量校验**,该边界归 state owner,须在文档明记为"未设上限"以免日后被误读为已有保证。
6. **D-06 durability** — **保证到"正常进程重启可恢复"**,明确不承诺断电或内核崩溃级耐久。⚠️ 该级别在 MMKV 上由哪个 API 达成(是否需要显式 sync/msync),**Claude 未能核验**(该 artifact 在评审机不可达),**CP-1 必须实证并记录**;若默认行为达不到该级别,须在 CP-1 暴露而不是默认满足。
7. **D-07 retryable** — 按错误类型分类,终止"恒为 true"。但**判据本轮只到类型层**:全仓生产代码中无任何位置据 `retryable` 发起重试(唯一消费点 `createPowerStatusBridge` 仅透传),行为判据当前不可验,不得伪造。
8. **D-08 `SINGLE_PROCESS_MODE`** — **保持**,并明写本批不支持多进程,调用方不得假设跨进程可见。
9. **D-09 身份材料** — 采用既有 `Settings.Secure.ANDROID_ID`;材料不可得或与既有文件不匹配时返回 **typed unavailable/failure**,**禁止自动 rekey**——自动 rekey 会用新 key 重写并使旧数据永久不可恢复,报错优于静默换钥匙。版本标记随 protected namespace 前缀一并冻结。⚠️ "不匹配"如何被检测仍受 `N-01` 约束,CP-1 须先落实可检测性。
10. **D-10 旧 v1 namespace 生命周期** — **本批不迁移、不清理、不 fallback**。plain 数据留在 plain,protected 使用全新 namespace,两者不冲突。
11. **D-11 sample protected 日志与 hydrate** — 使用真实 protected port,正常日志等级,不得以 plain 掩盖 protected 失败。阻断 CP-3,不阻断 CP-1。
12. **D-12 release 矩阵** — 阻断 CP-4,不阻断 CP-1;CP-4 前冻结即可。

**裁决后状态:CP-0 的决策锁解除,CP-1 可以开始。** 本文第 8 节"进入 CP-1 的前置仍未满足"一句据此作废。`N-01` 的 marker 候选补充仍建议在 CP-1 前落入 §10。

## 8. 授权边界

本文是对详设与实施计划的独立评审输入。**不授权源码实施、测试、构建、Android、native、Web、DEV、seed、UAT 或部署。** `N-01` 在既有批准目标内可自主处置,不需要 Dexter 裁决。

**进入 CP-1 的前置仍未满足**:§12 的十二项决定全部 `[未定]`,CP-0 的决策锁仍然阻断 CP-1。文档层面的 `GO` 不等于可以开始实现。
