# TER Android persistKV/persistSecure 需求正本 — Claude 第二轮独立评审

```text
REVIEW_TARGET=REQUIREMENTS (REMEDIATED BYTES)
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=GO
M/S/N=0/1/1
EVIDENCE_TIER=static（当前源码与文档逐行对账 + 同根扫描）;未执行任何命令,未打开 Android/native/Web/release
```

## 0. 出处、方法与未达材料

- **出处**：v2s-rooted 续接会话,非 fresh acceptance。
- **方法**：按当前字节(文档 480 行,09-12 19:10)重开 owning source 与文档逐行核验。**作者侧处置记录一律未采信为质量证明**——我把处置表的七行逐条回到条款正文验证,结果见 `S-01`。**未执行任何命令。**
- **未达材料**：`/tmp/ter-cp7-android-all.log` 本机不存在(再次确认),`F-03`/`F-04` 的行号我无法复核;MMKV 2.4.2 的 **AAR/classes 在本机未缓存**,我只在构建中间产物里找到 `libmmkv.so`(arm64-v8a 与 x86_64,debug 与 release 各一份),那是 native 库不含 Java API,因此**无法核实 `cryptKey` 实例 API 是否存在**。
- **源码未变**：`androidPersistKv.ts`(09-11 23:53)、`TerminalPersistKvModule.kt`(09-05 05:26)自上轮起零改动,上一轮的源码结论继续有效。

## 1. 结论

`GO`,`0M / 1S / 1N`。

上一轮的全部 finding 在**条款正文层面**均已实质闭合。我对新文字做了对抗构造,九个反例里八个被现有条款挡住,详见 §3。唯一的 `S` 不是内容错误,而是**处置表声称的两处改动没有(完整)落进条款**——这恰好是本 brief 要我警惕的那件事。

两处缺口本身都只是一句话,严重级别低;但处置表是读者确认"finding 已闭合"的索引,索引说了假话比缺那一句更值得记。

**按 Dexter 的授权条件,本文的 `GO` 触发对 Codex 撰写详设与实施计划的授权**,附带三条准入项,见 §8。

## 2. 上一轮 finding 的闭合核验（回到条款正文,不看处置表）

| 上一轮 finding | 条款落点 | 结论 |
|---|---|---|
| `M-01` 零消费者与批量化归属 | 新增 `F-19`(第 120 行) | **CLOSED**。census 与我给的清单逐项一致;且正确写明 `persistenceEngine.ts:287-301,445-466` 的逐键循环是"未来批量化的候选 owner 路径,不是这些 batch 方法的当前 caller",归属没有错记到 Android adapter 头上 |
| `M-02` 跨 mode 隔离缺可证伪面 | `PKV-R01` 第 230 行 | **CLOSED**。"同一 key 在一种 mode 写入后另一种 mode 的 `read` 必须返回 missing,两个 mode 的 `listKeys` 不能包含对方的 key;必须使用不同的物理 namespace identity 或等价的可观察隔离边界" |
| `S-01` "不等于明文"判据太弱 | `PKV-R01` 第 228 行 | **CLOSED,且强于我的建议**。同时写入了黑名单(base64/hex/反转/UTF-16)与我推荐的强判据(两个不同身份输入下相同明文的 protected 表示必须不同),并要求"已命名且可复现的非纯编码/重排可逆变换" |
| `S-02` retryable 影响面过度陈述 | `F-13` 第 114 行、`G-04` 第 148-150 行、`§7` 第 7 项、`§6` 矩阵 | **CLOSED**。四处一致记录"当前无生产重试消费者,风险为潜在";`§7` 第 7 项加了"不得把潜在契约误用写成现行行为" |
| `N-01` 缺 port identity 判据 | `PKV-R13`(descriptor 部分)、`PKV-R01` 第 230/232 行 | **PARTIALLY**。见 `N-01` |
| `N-02` 测试标题超出断言面 | 声称落在 `PKV-R15` | **NOT CLOSED**。见 `S-01` |
| 我指出的两处文档遗漏 | `§7` 第 2 项(mode timeout)、第 10 项(namespace 生命周期)、`PKV-R07` 末段 | **CLOSED**,两处都变成了 Dexter 决策项而不是被静默替选 |
| Dexter 裁决:不动 state 引擎、`read` 保留 | `F-19`、`PKV-R02`、`§6` 矩阵、`PKV-R15`;`§7` 原第 2 项已移出 | **CLOSED**。`PKV-R10` 把延期写成"出现真实 caller 且该 caller 要用 `writeMany` 时才裁",并留了过渡期禁令("不得把逐项 encode 宣称为 atomic,不得把 `NoOutput` 宣称为完整批量 receipt")。**移出 `§7` 没有留下无主的洞** |

## 3. 对抗构造:九个反例的拦截结果

| 反例 | 拦截条款 | 结果 |
|---|---|---|
| 两个 wrapper 共用同一 MMKV namespace | `PKV-R01`:230 + `PKV-R12` | **挡住**。我构造过更刁的变体——共用 namespace 但 protected 给 key 加前缀、两侧 `listKeys` 各自过滤,这能骗过 read-missing 与 listKeys 两条;但 `PKV-R12` 要求"`clear` 须作为 namespace 隔离不变量在专门反例中证明清空后其它 namespace 仍可读",共用实例下 `clearAll` 会连带清掉对方,被抓 |
| protected 经 base64/hex/反转后写入 | `PKV-R01`:228 | 挡住(显式黑名单) |
| protected 正常路径仍写入 plain namespace | `PKV-R01`:230 | 挡住 |
| protected 失败后静默读 plain | `PKV-R18` | 挡住 |
| malformed `{status:'succeeded'}` 被当成成功 | `PKV-R03` | 挡住,且该反例被点名为必需 red mutation |
| `timeoutMs` 被接收但 native 永不返回 | `PKV-R05` + `§7` 第 1 项 | 挡住 |
| `writeMany` 前两项成功第三项失败仍返回 `NoOutput` | `PKV-R10` 过渡期禁令 | 挡住 |
| 只测普通 mode 但 descriptor 标 protected 可用 | `PKV-R13` | 挡住 |
| 测试标题称 every operation 实际只断言 `clear` | 无 | **未挡住**,见 `S-01` |

**我另构造并主动否决的一个**:用设备材料派生的单字节 XOR。它满足全部最小要求——非纯编码重排、可复现、两个身份产出不同字节。单字节 XOR 频率分析下很弱,但本轮目标明文写的是"避免被直接看懂"且**显式不要求抵抗逆向**,文件确实不能直接读。**按该目标它是合格的,我不把它列为 finding**,以免把方案推向 brief 已排除的强密码学。

## 4. S finding

```text
[S-01] 处置表声称的两处改动没有（完整）落进条款正文
状态：CONFIRMED
严重级别：S
证据档位：static
位置：需求文档第 403-411 行处置表；对照 PKV-R15（第 /^### PKV-R15/ 节）与 PKV-R01 第 230-232 行
失败场景：同根扫描——处置表共 7 行，我逐行回到它声称的落点验证：M-02、S-01、S-02、零消费者、namespace 生命周期与 mode timeout 五行**已完整落地**；余下两行不然。

第 409 行声称把"测试名称必须与实际断言面一致，名实不符按未覆盖处理"补进 PKV-R15。全文检索该短语：**只在处置表第 409 行出现一次，PKV-R15 正文六条 bullet 加一句收尾全文无此内容**。即本 brief 第三节点名的第八个反例（测试标题称 every operation 实际只断言 clear）在当前条款下仍无人拦截，而处置表告诉读者它已闭合。

第 408 行声称补了"两个 port 引用不同"的静态/typed 断言。实际 PKV-R13 落实了 descriptor 的 mode/state/source 部分，但"两个 port 引用不同"只在 PKV-R01 第 230 行以"最小隔离证明不能只比较两个 JS port 对象"、第 232 行以"port 对象不相同只是必要条件"的形式出现——**这是把它当作不充分条件来提醒，而不是把它规定为必须断言的项**。
影响面：处置表是读者确认 finding 闭合的索引。索引与条款不一致时，下一轮 review 若采信索引就会漏掉；本 brief 开头要求"不要把作者侧处置记录当作质量证明"，此处正是该风险的实例。两处缺口的直接内容影响都很小（各一句话，原严重级别均为 N）。
最小修复方向：把第 409 行声称的那句真正写进 PKV-R15 的 bullet 列表；把 PKV-R01 第 232 行的措辞从"只是必要条件"改成同时规定"必须断言两个 port 引用不同，且这不充分"。然后对处置表做一次自检：每一行的落点都要能在条款正文检索到。
为什么更小的修复不足：只改处置表措辞（比如把"补"改成"建议补"）会让两个原 finding 重新变成开口；只补条款不做处置表自检，下次同样的索引漂移还会发生。
是否需要 Dexter 裁决：否。
```

## 5. N finding

```text
[N-01] port 对象同一性只以"不充分条件"出现，未被规定为必须断言项
状态：PARTIALLY_CONFIRMED
严重级别：N
证据档位：static
位置：需求文档 PKV-R01 第 230、232 行
失败场景：条款只说"port 对象不相同只是必要条件，不是充分证明"，没有一处正面要求"必须断言两者不是同一对象"。一个较真的实现者可以主张条款并未禁止同一对象。
影响面：为零。同一对象必然共用 namespace，跨 mode read 会返回值而不是 missing，被 PKV-R01 第 230 行的行为判据直接抓住。这是措辞问题不是漏洞。
最小修复方向：随 S-01 一并改一句即可。
是否需要 Dexter 裁决：否。
```

## 6. 被推翻的作者结论

1. **处置表第 409 行（N-02）声称已补入 PKV-R15** —— 推翻。该句只存在于处置表，条款正文无此内容。
2. **处置表第 408 行（N-01）声称已补"两个 port 引用不同"的断言** —— 部分推翻。descriptor 那半确实落在 PKV-R13；port 同一性那半只以"不充分条件"的提醒形式存在，不是断言要求。
3. **无其他推翻。** 上一轮我推翻的 F-13/G-04 影响描述，本轮已按事实改正，我确认改正成立。

## 7. 归属分类（按 brief 第 6 项）

- **属共用 adapter / protected mode 本身**：`PKV-R01` 的混淆强度与跨 mode 隔离、`R03` wire 封闭、`R04` 错误分类、`R05` timeout、`R06` 初始化、`R07` namespace 与身份材料、`R11` 损坏与底层异常、`R12` list/clear 范围、`R13` 双 mode 接线与 descriptor、`R18` 禁止跨 mode fallback。
- **属 state consumer / 批量化 owner（不该由本需求解决）**：`persistenceEngine.ts:287-301` 的逐键 flush 清理与 `:445-466` 的逐键 reset 循环。文档 `F-19` 已正确标注其为"未来批量化的候选 owner 路径",**没有错误归因成 Android adapter 的当前 workload**,这一点我确认。
- **属日志 owner 的邻接问题**：sample 中 protected 未接入导致的重复 `adapter not injected`(`§7` 第 11 项),以及 `PKV-R14` 要求的 mode 维度日志分类。接入 protected mode 后前者应自然消失,但"日志等级与 hydrate 条件"仍是独立决策。

## 8. 未执行的动态证据

- **static**：本评审的全部结论。**我未执行任何命令**;文档自报的任何门与数字一律按自报处理。
- **focused**：当前只有 3 个基于 `requireNativeModule` mock 的用例,不执行 Kotlin/MMKV;protected mode 零用例。
- **native**：`NOT_RUN`。无 Kotlin 单测、无真实 MMKV 读写、无混淆或 `cryptKey` 路径证据。
- **Android**：`NOT_RUN_THIS_ROUND`。文档引用的历史日志本机不可达;无本轮八方法、隔离、进程重启、并发、损坏、空间不足、超时或 protected mode 的运行证据。
- **release**：`NOT_RUN`。ABI、R8、clean build、安装与 module load 全无独立证据。
- **Web**：不在本 Android adapter 的通过矩阵内;文档已正确声明。
- **`cryptKey` 可用性**：**CONFIRMED —— 我在本轮把它从未验证升级为已验证**。AAR 与 classes 未缓存,但我在项目**自己的构建产物**里找到了答案:`apps/terminal/assembly/android/sample-terminal/android/app/build/intermediates/dex/release/mergeDexRelease/classes2.dex` 含 `com/tencent/mmkv/MMKV` 类,其符号表包含 `cryptKey`、`mmkvWithID`、`getMMKVWithID`、`checkReSetCryptKey`、`doCheckReSetCryptKey`、`reKey`、`doReKey`。即**实际解析到的 MMKV 2.4.2 artifact 确实提供 cryptKey 能力,并且自带 reKey/checkReSetCryptKey**。
  **本机无 `dexdump`,我未能提取精确的重载签名**,因此"具体是哪个 `mmkvWithID` 重载、参数顺序如何"仍需详设时确认;但"该能力是否存在"这个问题已经有答案。
  文档的处理原本就正确(`PKV-R01` 与第 216 行写的是"详设准入时必须先核对…若确有应优先复用",没有未经证据声称可用),**本条不构成 finding**;上述证据是我对该准入项的提前交付,可直接写入详设,省掉一次核对。
  **对 §9 方案合理性的影响**:既然能力确实存在且含密钥重置,手写同类变换就是重复造轮子。建议详设把"复用 MMKV `cryptKey`"定为默认路径,并把"两个 mode 用不同 cryptKey 或不同 namespace"作为 `PKV-R01` 隔离要求的自然实现——这同时满足非纯编码变换、身份材料参与、跨 mode 隔离三条最小要求,比自写变换更小。

## 9. 过度设计判断

**本轮无残留过度设计。** 上一轮唯一的一处(为四个零消费者方法要求全档证据)已由 `F-19` 加 `PKV-R02`/`§6`/`PKV-R15` 的 static-only 分层解决,且保留了正确的例外——隔离不变量的专门反例仍可调用 `read`/`listKeys`/`clear`,这与"不为零消费者建立一般 workload 证据"并不矛盾,分寸拿捏准确。

`PKV-R10` 的处理尤其好:把 `writeMany` 原子性的裁决推迟到出现真实 caller,同时留下过渡期禁令,既没有为无人调用的方法消耗 Dexter 的决策,也没有给实现留下"逐项 encode 冒充 atomic"的口子。

## 10. 是否还有必须由 Dexter 先裁的产品语义

**没有新增。** `§7` 现有 12 项我逐条看过,选得准、无遗漏、无越界(没有把强安全方案塞进前置)。上一轮我提的两处遗漏已分别成为第 2 项与第 10 项;上一轮 Dexter 裁掉的 `writeMany` 原子性已正确移出并由 `PKV-R10` 承接延期。

`S-01` 与 `N-01` 都在既有批准目标内,由作者自主修订,不需要裁决。

## 11. 授权边界

本文是对需求正本的独立评审输入。按 Dexter 给出的条件,本文的 `GO` **触发对 Codex 撰写详设与实施计划的授权**,并附三条准入项:

1. 先修 `S-01` 的两处条款缺口并对处置表做一次落点自检;
2. 详设准入时先核实际解析到的 MMKV 2.4.2 artifact 是否提供 `cryptKey` 实例 API,若提供则优先复用,选择手写变换必须给出理由;
3. 详设与实施计划完成后交 Dexter 与我 review,不得据本文直接进入实施。

本文**不授权**源码/测试/依赖修改、Android/Web/native/DEV、seed、UAT、部署或发布。静态、focused mock、README、历史日志与 typecheck 均不得扩写为 Android 或 release acceptance。
