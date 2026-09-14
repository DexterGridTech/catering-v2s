# TER Android persistKV/persistSecure 共用 adapter 需求正本 — Claude 独立评审

```text
REVIEW_TARGET=REQUIREMENTS
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=NO-GO
M/S/N=2/2/2（交付后 M-01 由 Dexter 裁决关闭,现为 1M/2S/2N;见 §2b）
EVIDENCE_TIER=static（当前源码逐行对账 + 穷举消费者扫描）;未执行任何命令,未打开 Android/Web/native/release
```

## 0. 出处、方法与未达材料

- **出处**：v2s-rooted 续接会话,非 fresh acceptance。
- **方法**：按当前字节(文档 442 行,09-12 18:50)重开 owning source 逐行核验,**未执行任何命令**。文档自报的覆盖数字、条款数字与"已闭合"结论一律未采信。
- **未达材料(必须先声明)**：`/tmp/ter-cp7-android-all.log` **在本机不存在**。文档 `F-03`/`F-04` 引用的行号我**无法直接复核**,下文对错误归因的确认是**从代码路径独立推导**的,不是对日志的复核。
- **利益冲突**：本文档由 Codex 撰写,与我无关,本轮我是独立的。

## 1. 结论

`NO-GO`,`2M / 2S / 2N`。

文档质量高。`PKV-R01` 把 `LOCAL_OBFUSCATION_ONLY` 的目标、非承诺清单与三条可证伪最小要求写得很清楚,`§7` 的十一条裁决项选得准,`§8` 的排除项与证据分层也没有把静态/mock/历史升级成 Android 或 release。**焦点 1 的十条事实我逐条核过,全部属实**(详见 §2)。

两条 M 都不是"写错了",而是**范围与可证伪性的缺口**:其一,八项方法里有四项生产零消费者,而需求为它们要求全档证据、还让 Dexter 为其中一项做产品裁决;其二,`PKV-R01` 的三条最小要求**挡不住它自己点名的那个反例**——protected wrapper 做了变换却写进 plain namespace。

## 2. 焦点 1:当前事实逐条核验(全部 CONFIRMED)

| 断言 | 结论 | 亲验依据 |
|---|---|---|
| persistKv 已接入八项 | CONFIRMED | `androidPersistKv.ts:56-71` 八个方法;`:72-82` descriptor 八项 `state:'real', source:'adapter'` |
| persistSecure 仍是 unavailable | CONFIRMED | `assembly/android/sample-terminal/src/assembly/platformPorts.ts:24` |
| 历史错误主要来自 protected 未接入 | CONFIRMED（结构推导,非日志复核） | `persistenceHydration.ts:77-82` 按 `storageKinds` 遍历,对每种 kind 调 `port.listKeys`;`persistenceEngine.ts:449,504` 另有两处。`unavailablePersistSecurePort` 八项全部返回 unavailable。因此每轮 hydrate/flush 都会对 protected 产生 unavailable 并打 error——**洪水的机制成立,无需日志即可确认** |
| MMKV 当前是未加混淆的普通实例 | CONFIRMED | `TerminalPersistKvModule.kt:112` 为 `mmkvWithID(id, SINGLE_PROCESS_MODE)`,**无 cryptKey 重载**;persist-kv 包内 `protected/obfusc/encrypt/cipher/crypto` 全文检索**零命中** |
| JS bridge 每次重新查找 module | CONFIRMED | `androidPersistKv.ts:44-45`,`callNative` 每次调用都 `requireNativeModule` |
| native result 无运行时 shape 校验 | CONFIRMED | `androidPersistKv.ts:46` 直接 `return await operation(native)`,无校验 |
| timeoutMs 只是形状 | CONFIRMED | Kotlin 八个 `AsyncFunction` 的参数一律命名 `_timeoutMs` 且函数体内零引用(`:11,23,30,37,55,74,81,87`);`withStore` 不产生 timed-out |
| writeMany 部分提交 | CONFIRMED | `TerminalPersistKvModule.kt:60-69` 按索引逐项 `encode`,首个失败即 `return@withStore failure`,已写入的前项不回滚,返回类型仍是 `NoOutput` |
| focused test 不执行真实 Kotlin/MMKV | CONFIRMED | `test/androidPersistKv.test.ts` 共 113 行 3 个用例,全部基于 `requireNativeModule` 的 vi.mock |
| state 要求 plain/protected 用不同物理 port | **PARTIALLY_CONFIRMED** | `PersistenceStorageKind = 'plain' \| 'protected'`(`types/persistence.ts:11`),state 以 `storagePorts[storageKind]` 索引,**要求两个条目,但全仓无任何同一性或隔离校验**——同一个对象注入两处今天就能通过 |

## 2b. Dexter 裁决（2026-09-12,交付后）

交付后我补查了四个零消费者方法的"本该调用方",定性因此改变并重新提交,Dexter 按我的建议裁定。

**补充事实（我亲验,文档未记）。** `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts` 第 457 至 458 行,reset 的实现是 `listKeys` → 按前缀过滤 → `for (const key of ...) { await this.#removeKey(...) }`,**逐键串行,每次一趟 JS→Kotlin 桥往返**;第 287 至 289 行的 flush 清理是同样的 for-await 循环;写入侧第 184、265、354 行同样每条 entry 一次独立 `await write`。因此:

- `removeMany` 与 `clear` 的潜在调用方就在 reset 路径。按作者自报的 10 个 key 估算(**我未复核该日志**),reset 当前是 1 + 10 = 11 次桥往返,`removeMany` 可降到 2 次,`clear` 可降到 1 次。
- `writeMany` 的潜在调用方是 flush 的多条写入。
- `read` 是四项中**唯一**没有自然调用方的——hydration 走 `readMany`,全仓无单键读需求。

**定性更正。** 这不是"四个方法是死代码",而是"三个方法闲置的原因在 `kernel/base/state` 的逐键串行实现,不在 Android adapter"。文档 `G-10`「有 batch API 不等于当前 workload 高效」指的正是此事,但未点破归属。**批量化属邻接 owner 问题,persistKV 需求不该也无法修它。**

**Dexter 裁决:本轮不动 state 引擎(选项甲),`read` 保留不删。** 据此:

1. `§3` 事实表须补一条零消费者事实,写入完整调用点清单(`listKeys` 3 处、`readMany` 2 处、`write` 1 处、`remove` 1 处,`read`/`writeMany`/`removeMany`/`clear` 各 0 处),并注明后三者的潜在调用方位于 `persistenceEngine` 的 reset 与 flush 循环。
2. `read`、`writeMany`、`removeMany`、`clear` 四项的证据义务**降为 static-only**;`PKV-R02` 正文与 `§6` 矩阵须同步,不得两处互相矛盾。
3. `§7` 第 2 条(`writeMany` 原子性与 `NoOutput` 是否改型)**移出本轮裁决队列**,登记为"出现真实调用方时重开"。
4. `read` 不从 `StateStoragePort` 删除——删它要同步 plain、protected、Web、default 四个实现的 kernel 契约,收益只是少一个无人调的方法,不划算。

**裁决后计数:`1M / 2S / 2N`**(`M-01` 由裁决关闭,转为待作者执行的文档修订)。唯一剩余的 M 是 `M-02`(跨 mode 隔离缺可证伪最小要求)。

## 3. M findings

```text
[M-01] 八项方法中四项生产零消费者，需求却为其要求全档证据并送一条产品裁决
状态：CONFIRMED
严重级别：M
证据档位：static
位置：apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:449,504,513,564,586；persistenceHydration.ts:82,108；对照需求 PKV-R02、§6 矩阵第二行、§7 第 2 条
失败场景：我对 apps/terminal 全树做了穷举扫描（排除测试、adapter 自身实现、defaults、dev-host 实现），StateStoragePort 八项的生产调用点完整清单是：listKeys 3 处、readMany 2 处、write 1 处、remove 1 处，**read、writeMany、removeMany、clear 各 0 处**。PKV-R02 要求八项方法闭合语义，§6 矩阵对该行要求「全部方法正反向量 / 每项 native / 真实 module 全路径」。protected mode 接入后这是 8 方法 × 2 mode = 16 个面，其中 8 个（四个无调用方 × 两 mode）没有任何生产调用方。§7 第 2 条更进一步：让 Dexter 裁决 writeMany 的原子性与是否把 NoOutput 改成带已提交边界的结果——**而 writeMany 今天没有调用方**。
影响面：本批的工作量与 Dexter 的裁决队列。这与上一批 CT-4 要消除的「形态过滤在生产路径零消费」是同一缺陷族；当时的结论是"有实现与 evidence"属存在性判据。本文若照现状执行，会把一个零消费面制度化为 Android/native 证据义务。
最小修复方向：在 §3 事实表补一条零消费者事实（我已给出完整调用点清单），然后二选一并写进需求：（甲）把四项无调用方的方法证据档位显式降为 static-only，并把 §7 第 2 条从 Dexter 队列移出，登记为"出现真实调用方时重开"；（乙）若判定它们本就不该存在，走删除路径——但 StateStoragePort 是 kernel 契约，plain/protected/Web/default 四个实现都要同步，属另一裁决。
为什么更小的修复不足：只在 §6 矩阵里把某几格改成"可选"不够——PKV-R02 的正文仍要求八项闭合，两处会互相矛盾；而且 §7 第 2 条不移出，Dexter 仍会为无调用方的方法做产品裁决。
是否需要 Dexter 裁决：是。问题：writeMany、removeMany、read、clear 当前无任何生产调用方，本轮是把它们的证据义务降为 static-only 并把 writeMany 原子性裁决推迟，还是走 kernel 端口删除？
```

```text
[M-02] PKV-R01 的三条最小要求挡不住它自己点名的跨 mode 反例
状态：CONFIRMED
严重级别：M
证据档位：static
位置：需求 PKV-R01（第 212-218 行）与 PKV-R18（第 334-336 行）；对照 apps/terminal/kernel/base/state/src/types/persistence.ts:11 与 apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt:112,120-121
失败场景：PKV-R01 的可证伪最小要求是三条——plain 保持 opaque、protected 文件内容不直接等于明文、同设备重启可按同 mode 读回，外加身份材料不可用时 typed failure。构造一个恶意但合规实现：protected wrapper **确实做了可逆变换**，但把变换后的值写进 **plain 的同一个 MMKV namespace**（`mmkvWithID` 传同一个 `namespaceId`）。逐条对照：plain 写入仍是原始 opaque ✓；protected 的持久化内容确实不等于明文 ✓；同设备重启能按同 mode 读回 ✓；身份材料不可得时仍可 typed failure ✓。**四条全过，而两个 mode 根本没有隔离。** PKV-R18 只禁止"失败时静默切换"，不覆盖"正常路径就共用 namespace"。
影响面：plain 的 listKeys 会枚举到 protected 的 key，plain 的 clear 会连带清掉 protected 数据；state 的 plain hydration 会读到它无法解码的 protected 值并按损坏处理。这正是本 brief 点名要求构造的第一个反例，当前需求文字放行它。
最小修复方向：给 PKV-R01 补第四条最小要求——同一 key 在一种 mode 下写入后，另一种 mode 的 read 必须返回 missing，且各自 listKeys 不得包含对方的 key；两 mode 的物理 namespace 标识必须不同且可从外部观察。该判据可在 native/Android 档直接证伪，不需要读文件内部。
为什么更小的修复不足：只加"两个 port 对象不得相同"的对象同一性判据不够——两个不同的 wrapper 对象完全可以写进同一 namespace，同一性检查抓不到；只在 PKV-R18 里加一句"不得共用 namespace"也不够，那仍是文字断言，没有可证伪形状。
是否需要 Dexter 裁决：否。这是补齐既有目标的可证伪面，不改变已定的 LOCAL_OBFUSCATION_ONLY 目标。
```

## 4. S findings

```text
[S-01] 「不能直接等于明文」可被 base64 平凡满足，与「避免被直接看懂」的目标脱节
状态：CONFIRMED
严重级别：S
证据档位：static
位置：需求 PKV-R01 第 218 行的最小可证伪要求
失败场景：Dexter 定的目标原文是"避免存储文件被直接看懂"。而判据写成"持久化文件内容不能直接等于明文值"。base64、hex、字符串反转、UTF-16 重编码都满足该判据，却都能被任何人用标准工具一步还原，目标落空。这是本 brief 点名的"只在测试 fake 中完成混淆"的近亲——变换真实存在，但不构成任何阅读障碍。
影响面：PKV-R01 的核心判据；若以此验收，protected mode 可能名存实亡。
最小修复方向：把判据改为可区分"设备材料是否真的参与"的形状——同一明文在两份不同的本机身份材料下，持久化字节必须不同；且不得等于明文的任何标准编码（base64/hex/UTF-16）。前一条是强判据且成本极低，直接证明派生参数进入了变换。
为什么更小的修复不足：只加"不得等于 base64"是枚举式黑名单，下一个人改用 ROT13 照样过；只要求"必须用某算法"又越界进了详设。按"同明文+不同材料→不同字节"来判，既可证伪又不指定算法。
是否需要 Dexter 裁决：否。
```

```text
[S-02] retryable 在全仓没有任何重试消费者，R04 的收益目前只在静态层
状态：PARTIALLY_CONFIRMED（推翻文档的影响描述，不推翻其事实描述）
严重级别：S
证据档位：static
位置：需求 F-13、G-04、PKV-R04；对照 apps/terminal/kernel/base/display-context/src/application/createPowerStatusBridge.ts:32
失败场景：文档 F-13 写"所有错误都允许重试并不安全"，G-04 标题为"全部可重试"，读起来是一条现实风险。我扫了全仓生产代码，`.retryable` 的消费点只有一处，在 createPowerStatusBridge 第 32 行，而且只是把值透传进 bridge 结果，**没有任何地方据此发起重试**。所以"重试不安全"当前是潜在风险，不是正在发生的故障；把它写成现实风险会让 PKV-R04 的优先级被高估。另有一处精度问题：Kotlin 侧其实有五个不同的 code（PERSIST_KV_STRING_DECODE_FAILED、PERSIST_KV_WRITE_FAILED、PERSIST_KV_BATCH_SHAPE_INVALID、PERSIST_KV_INVALID_KEY、PERSIST_KV_OPERATION_FAILED），"所有异常同码"只在 JS 侧成立（一律 PERSIST_KV_BRIDGE_FAILED）。
影响面：PKV-R04 的验收档位。既然无消费者，该需求当前只能有 static/typed 判据，不存在可观测的行为差异。
最小修复方向：在 F-13/G-04 补注"当前无重试消费者，风险为潜在"，并在 PKV-R04 写明其判据本轮只到 static/typed；若要行为判据，必须同时指名未来的重试消费者。同时把"所有异常同码"改为"JS 侧同码，Kotlin 侧五码但 retryable 恒真"。
为什么更小的修复不足：只改措辞不标注档位，下一轮仍会有人去找不存在的行为证据。
是否需要 Dexter 裁决：否。
```

## 5. N findings

```text
[N-01] 「不能把同一个 port 对象同时注入 plain/protected」缺可证伪判据
状态：CONFIRMED　严重级别：N　证据档位：static
位置：需求 PKV-R01 第 214 行；对照 apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:101 与 types/persistence.ts:11
失败场景：state 以 storagePorts[storageKind] 索引，要求两个条目，但全仓无任何同一性或隔离校验，同一对象注入两处今天就能通过。PKV-R01 在正文禁止它，但无判据。
最小修复方向：加一条 static/focused 判据同时断言两件事——两个 port 不是同一对象，且各自 descriptor 的 mode/state/source 不同。注意这**不能替代 M-02**，对象同一性只是必要非充分条件。
是否需要 Dexter 裁决：否。
```

```text
[N-02] 现有测试标题名不副实，PKV-R15 应把它纳入清理面
状态：CONFIRMED　严重级别：N　证据档位：static
位置：apps/terminal/adapter/android/persist-kv/test/androidPersistKv.test.ts:51
失败场景：用例名为 "maps a bridge rejection to a typed failure for every operation"，它确实 mock 了八个 native 方法全部 throw，但**只对 clear 一个做了断言**。文档 F-10 对覆盖面的描述是准确的（"对 clear 做一次 bridge throw"），出问题的是测试标题——它会让后来人以为八项都验过。
最小修复方向：PKV-R15 增一句：测试名称必须与实际断言面一致，名实不符按未覆盖处理。
是否需要 Dexter 裁决：否。
```

## 6. 被我推翻的作者结论

1. **F-13 / G-04 的影响描述**（部分推翻）。"所有错误都允许重试并不安全"隐含现实风险;实际全仓无重试消费者。"所有异常同码"只在 JS 侧成立,Kotlin 侧有五个不同 code。见 `S-02`。
2. **PKV-R01 声称的可证伪性**（推翻）。其三条最小要求无法排除它自己在 §9 brief 中点名的"protected wrapper 实际仍写入 plain namespace"反例。见 `M-02`。
3. **未推翻但须标注来源**：`F-03`/`F-04` 引用的历史日志在本机不可达,我**没有复核那些行号**。错误归因的结论我是从 `persistenceHydration.ts:77-82` 的 storageKind 遍历加 `unavailablePersistSecurePort` 独立推导出来的,**结论相同但证据来源不同**,不要把我的确认当成对日志的复核。

## 7. 文档仍遗漏的问题

- **零消费者事实缺席**（`M-01`）。§3 事实表十八条里没有任何一条陈述"哪些方法有生产调用方"。这是决定本批范围的第一事实。
- **跨 mode 隔离的可证伪面缺席**（`M-02`）。
- **namespace 生命周期**。`namespaceId` 带 `v1.` 前缀(`TerminalPersistKvModule.kt:120-121`),`PKV-R07` 要求冻结迁移/拒绝/清理策略,但 §7 没有对应裁决项;persistenceKey 变更后遗留的旧 MMKV 文件如何处置也无人认领。
- **protected 与 plain 的 timeout 策略是否一致**。混淆与派生会引入额外耗时,而 `StateStorageTimeoutPolicy` 只有 `readMs/writeMs/resetMs` 三个全局值,不分 mode。§7 第 1 条只裁 timeout 语义,未裁是否分 mode。

## 8. 过度设计判断

**有,且集中在一处**:`PKV-R02` 与 §6 矩阵对**四个零消费者方法**要求"全部方法正反向量、每项 native、真实 module 全路径"。这是 `M-01`。

其余不算过度。`PKV-R09` 的并发/顺序要求已被 `SINGLE_PROCESS_MODE` 收窄;`PKV-R14`、`R16`、`R17` 是文档与 release 义务,符合仓内既有约定(如 `TR-10` 的中文 README);`PKV-R08` 明确把"写成功"分层而不是隐含承诺,正是该有的。

## 9. 共用 adapter + 两个 wrapper + Kotlin 简单混淆,是不是当前阶段最小合理方案

**形状是对的。** 共用 Kotlin module 与 MMKV 辅助逻辑、上层分两个 wrapper 与两个 namespace,既避免了第二套存储,又保住了 state 层已有的 `plain | protected` 二分。相对更简单的替代我构造过两个,都更差:把 protected 并进 plain(违背 Dexter 的目标,且 state 的 storageKind 二分会失去意义)、为 protected 单起一个 adapter(第二套 Kotlin module 与第二条 autolink 路径,明显更重)。

**但"简单可逆混淆"的实现选择应当先排除重复造轮子。** `UNVERIFIED_REQUIRES_EVIDENCE`:MMKV 自身提供带 `cryptKey` 的实例重载(AES-CFB),若 2.4.2 确实提供,它比手写变换更小——不新增依赖、不自写密码学、键与值一并覆盖、由上游维护,且与 `LOCAL_OBFUSCATION_ONLY` 的强度目标正好匹配。**我无法在本机确认**:该 AAR 未在本机缓存,我也未联网。建议在详设准入时先核 MMKV 2.4.2 的 API,**默认采用其内建 cryptKey,选择手写变换必须给出理由**。这符合仓内"优先使用成熟库、不重复造轮子"的原则。

## 10. 未执行的证据档位

- **static**：本评审的全部结论。**我未执行任何命令**;文档自报的 typecheck、测试与静态门一律按自报处理。
- **focused**：当前仅 3 个基于 `requireNativeModule` mock 的用例,**不执行 Kotlin/MMKV**。protected mode 当前零用例。
- **native**：`NOT_RUN`。无 Kotlin 单测、无 MMKV 真实读写、无 cryptKey/混淆路径证据。
- **Android**：`NOT_RUN_THIS_ROUND`。文档引用的是历史日志,而该日志在本机不可达;无本轮八方法、进程重启、并发、损坏、空间不足、超时或 protected mode 的运行证据。
- **release**：`NOT_RUN`。ABI、R8、clean build、安装与 module load 全部无独立证据。
- **Web**：不在本 Android adapter 的通过矩阵内;文档已正确声明,我确认该声明成立。

## 11. 需要 Dexter 决策的事项

文档 §7 已列十一条,我认为**选得准且无需增删**,但要加一条,并把其中一条移出:

- **新增**:四个零消费者方法(`read`、`writeMany`、`removeMany`、`clear`)本轮是把证据义务降为 static-only,还是走 kernel 端口删除?见 `M-01`。
- **移出或推迟**:§7 第 2 条(`writeMany` 原子性与 `NoOutput` 是否改型)在出现真实调用方之前不必裁,建议随上一条一并处理。

其余 `M-02`、`S-01`、`S-02`、两条 N 都在既有批准目标内,由作者自主修订即可。

## 12. 授权边界

本文只是对需求正本的独立评审输入,**不自动成为产品裁决或实施授权**。不授权详设、实施、源码/测试/依赖修改、Android/Web/native/DEV、seed、UAT 或部署。
