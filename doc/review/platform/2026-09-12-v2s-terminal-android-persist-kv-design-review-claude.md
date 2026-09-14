# TER Android persistKV/persistSecure 详设与实施计划 — Claude 独立评审

```text
REVIEW_TARGET=DESIGN + IMPLEMENTATION_PLAN
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=NO-GO
M/S/N=1/2/0
EVIDENCE_TIER=static（当前源码 + 三份文档逐行对账 + 同根扫描）;未执行任何命令
```

## 0. 出处与方法

v2s-rooted 续接会话,非 fresh acceptance。按当前字节(需求 481 行 19:27、详设 436 行 19:39、计划 240 行 19:39)重开 owning source 与三份文档逐行核验。**未执行任何命令。** 作者自报的覆盖数字、处置表与自检结论一律未采信——包括 brief 开头那句"两处条款落点已写入 PKV-R01 与 PKV-R15",我回条款验了(结果见 §2)。

## 1. 结论

`NO-GO`,`1M / 2S / 0N`。

这是我在本仓见过质量最高的一份详设。§1.2 列了四个真实替代方案并逐个给拒绝理由;§7 的十四行传递矩阵每行都有 declaration/transfer/consumption/档位;§11.1 的十五条红夹具**把 brief 第 10 项点名的九个恶意合规反例全部覆盖**;§12 的十二项决定全标 `[未定]` 且只给推荐不代选;计划 §5 的逐代码对账闸只允许 `MATCHED` 或 `OPEN`,并点名禁用 `PASS_BY_PLAN`/`ASSUMED`/`COVERED_BY_COUNT` 这类逃逸措辞。

唯一的 M 是一处**输入方向**的缺口:所有校验都设计在"native 结果回到 JS"这一侧,而"JS 把 mode 送进 native"这一侧没有封闭校验。后果恰好落在本批风险最高的那个点上——明文。

## 2. 上一轮 finding 的闭合核验(回条款,不看处置表)

| 上轮 finding | 条款落点 | 结论 |
|---|---|---|
| `S-01` 处置表声称 N-02 已补进 PKV-R15 | 需求第 337 行 | **CLOSED**。"测试名称必须与实际断言面一致;名称声称 every operation 而只断言一个 operation,按未覆盖处理" 已在条款正文 |
| `N-01` port 同一性只作不充分条件 | 需求 `PKV-R01` 末段 | **CLOSED**。已加正断言:"实施/验证必须正面断言 plain 与 protected 的两个 port 引用不是同一对象,并分别断言各自 descriptor 的 mode、state、source 正确" |

**我要更正自己上一条检索。** 我先前用 `引用不同` 做 grep,条款写的是 `引用不是同一对象`,词形不同导致我一度判为未落地。**两处修复都真实存在,brief 的声称属实**,我的漏判已撤回。这是 `grep 词形过窄` 那类错误,记在这里。

## 3. M finding

```text
[M-01] native 侧 mode token 没有封闭校验，未识别值可静默落到 plain
状态：CONFIRMED
严重级别：M
证据档位：static
位置：详设第 108 行（`StorageModeResolver`）、第 110 行；§11.1 全部十五条红夹具；需求 PKV-R03；对照 apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt#withStore
失败场景：详设把 mode 定义为"JS factory 的显式 union"加"Kotlin resolver 的闭合 token"，但**只规定了合法 mode 如何映射，从未规定不合法或缺失的 mode token 该怎么办**。全文检索 `未知 mode`/`invalid mode`/`非法 mode`/`unknown mode`：零命中，只有第 108、146 行两处描述 resolver 对合法值的计算。

于是最自然的 Kotlin 写法就是缺陷：`when (mode) { "protected" -> protectedConfig; else -> plainConfig }`。它满足详设每一条文字，也躲过全部十五条红夹具——第 2 条查的是 resolver 把 protected 映射错，第 3 条查的是 protected **失败后**回退 plain，都不是"输入 token 无法识别"这条路径。任何 mode 字符串拼写漂移、wire 截断、未来新增第三个 mode，都会让本该加密的值明文落进 plain namespace，且无任何报错。

方向性根因：PKV-R03 与详设 §7 的 `result status` 行都只覆盖 **native → JS** 的结果封闭；**JS → native** 的输入封闭没有对应条款。TypeScript 的 union 只在编译期有效，跨不过 Expo bridge。
影响面：PKV-R01 的核心目标（protected 值不得明文落盘）、R18（不得静默退回 plain）、§7 的 mode 与 namespace 两行。这是本批唯一一条"后果是明文"的缺口。
最小修复方向：详设 §2.1 补一句——Kotlin `StorageModeResolver` 必须把 mode token 当作封闭集合，未识别或缺失一律返回 typed failure，**禁止任何 else/default 分支落到某个 mode**；同时 §11.1 增一条红夹具：从 native 边界传入未识别 mode token，断言 typed failure 且两个 namespace 都没有发生写入。
为什么更小的替代不足：只靠 JS 侧 union 是编译期保证，bridge 之后不存在；只在 §11.1 加红夹具而不在 §2.1 规定 resolver 行为，实施者可以用"抛未分类异常"通过夹具却违反 typed failure 要求；只扩写 PKV-R03 也不够，那一条的对象是 `PortResult` 的结果形状，不是入参。
是否需要 Dexter 裁决：否。这是补齐既定目标的实现约束，不改变任何已定语义。
```

## 4. S findings

```text
[S-01] cryptKey 错配的「可检测性」未被设计，Dexter 的三个选项都无法实现
状态：CONFIRMED
严重级别：S
证据档位：static
位置：详设 §10 的 `cryptKey identity change` 行；§0.1 第 49-50 行；需求 §7-9 / 计划 D-09
失败场景：§10 正确禁止了错误结果——"不静默生成新 key 并返回 missing；按 §7-9 定义 typed unavailable/failure、rekey 或拒绝"。但它只约束**结果**，没有建立**检测手段**：实现如何区分"密钥不对"与"这个 namespace 本来就是空的"？MMKV 以错误 cryptKey 打开既有加密 instance 时通常得到空或乱码，而不是抛出可分类错误。

`checkReSetCryptKey` 在整份详设里**只出现在 §0.1 第 49-50 行的 artifact 符号清单中，正文从未把它写成机制**。可检测性是 Dexter 那三个选项（typed failure / rekey / 拒绝）的共同前置——检测不到的状态，三个都实现不了。

最危险的具体路径不是恢复出厂设置（那时 plain 也一并清空），而是身份材料读取瞬时失败或返回空值：派生出不同 key → 全部 protected 数据表现为 missing → hydration 以空 protected 状态继续 → 随后 flush 用新 key 写入，**旧数据被永久孤立**。PKV-R01 已要求"身份材料不可用必须 typed failure"，这一句能挡住"读不到"，挡不住"读到了但和上次不同"。
影响面：protected mode 的重启读回保证；§10 的 identity change 行在裁决后仍无法落地。
最小修复方向：§10 补一句可检测性前置——protected store 打开时必须能判定"当前 cryptKey 与既有文件匹配"，候选手段是 artifact 已确认的 `checkReSetCryptKey`，或在 namespace 创建时写入一条 marker entry 并在每次打开时校验；具体取哪一种由 CP-1 决定，但必须在 §7-9 裁决前就确立"这件事可被检测"。
为什么更小的替代不足：只重申"不得返回 missing"是结果约束，实现者检测不到就只能违反它或抛未分类异常；把它并进 D-09 也不对，D-09 是产品策略（失败还是 rekey），可检测性是工程前置，两者不能互相等待。
是否需要 Dexter 裁决：否。策略仍归 D-09；本条只要求详设确立检测手段存在。
```

```text
[S-02] §9a「完整同步变更面」与计划 CP-3 锚点集合都漏了包的公共导出文件
状态：CONFIRMED
严重级别：S
证据档位：static
位置：详设 §9a 第 290 行的 `package/module graph` 行；计划 §3 的 CP-3 源锚一行；对照 apps/terminal/adapter/android/persist-kv/src/index.ts
失败场景：`src/index.ts` 当前导出三项：`moduleName`、`dependencyModuleNames/devDependencyModuleNames`、`createAndroidPersistKvPort`。本设计要把 factory 签名从一参改为两参、可能新增 mode union 类型或 convenience helper——**公共导出面必然变更**。但 §9a 的 package 行只列了 `package.json`、`dependencies.ts`、`skeleton-graph.ts` 与 sample package，计划 CP-3 的源锚同样只列到 `package.json`/`dependencies.ts`，两处都没有 `index.ts`。

§9a 的抬头明写"'完整'指设计预期会变更或必须重新对账的文件面……实施时不允许只抽样其中一行"，在一个自称完整的表里漏掉包的公共导出文件，是名实不符。
影响面：计划 §5 第 2 条要求每处实际变更都能映射到 design anchor；`index.ts` 无锚点时该行只能判 `OPEN`，而 §5 第 6 条规定任一 `OPEN` 不得交付。所以**这个缺口不会静默逃逸，会在对账闸上变成一次返工**，代价是一个周期而不是一个缺陷。
最小修复方向：§9a 增一行 `public export surface | .../src/index.ts | factory 签名/mode 类型/helper 的导出同步 | CP-2 | NOT_RUN`，计划 CP-3 的源锚同步补上。
为什么更小的替代不足：只在计划里补锚点而不补 §9a，逐代码对账的"design anchor"列仍指不到地方；依赖对账闸事后兜住等于明知会红还让它红一次。附带核过一处并撤回：该包的 `terminal-invariants.json` 只有 `owned` 段、**没有 `publicExports` 字段**，所以导出面变更不触发 invariants 同步义务，这一条我不计入。
是否需要 Dexter 裁决：否。
```

## 5. 逐项回应 brief 的十二个核验点

1. **是否真解决 protected unavailable** — 是。§1.2 方案 A（只修日志/让 state 忽略）被明确拒绝；§9a 的 sample 行要求移除 `unavailablePersistSecurePort` 并注入真实 protected wrapper。不是调 descriptor 或降日志等级。
2. **是否最小合理方案** — 是。四个替代里 B（第二 module/Keystore）与 D（JS 侧编码/fallback）的拒绝理由都成立；我另构造的"单一 wrapper 加运行时 mode 参数"会让两个 port 退化成同一对象，被 R01 直接禁止。C 复用既有 module、MMKV、port contract 与 sample assembly，确为最小。
3. **是否误写成强安全** — 否。§1.3 明确不做 Keystore、硬件绑定、密钥轮换、用户认证与攻击者模型；`LOCAL_OBFUSCATION_ONLY` 的非承诺清单完整。无第二 module、第二 registry、无 fallback。
4. **传递链是否完整且单一** — 是。§7 十四行，mode、logical port、cryptKey、identity、namespace、capability、result、timeout、error、opaque value、init、SINGLE_PROCESS、logging、release 各一行，未决项标 `OPEN` 而非留白。**唯一缺口是输入方向的 mode 校验，见 `M-01`。**
5. **两个 port 是否真隔离** — 需求 `PKV-R01` 末段已有正断言（引用不同 + 各自 descriptor 正确 + 明示不充分），详设 §2.1 的形状图标注"两个 frozen object，不共享 port object"，§11.1 第 1 条红夹具对应。通过。
6. **artifact 证据是否被正确限定** — 是，且比我上轮做得好。他们找到了我没找到的 `mmkv-2.4.2-api.jar`，取到精确签名 `mmkvWithID(String, int, String): MMKV`、`cryptKey(): String`、`reKey`、`checkReSetCryptKey`；第 53 行明写"这证明 artifact 有能力和精确重载形状，**不证明当前 module 已调用它、真实文件已加密、Android 已 load、release 已打包或重启已读回**"。计划 §2.2 同样标为 `static artifact evidence`。**无扩写。**
7. **是否静默替 Dexter 选边** — 否。§12 十二项全标 `[未定]`，只给推荐并注明"由 Dexter 选择"；protected namespace 前缀与 `ANDROID_ID` 都明写为候选、"未裁决前不得落字节"；§12 末句阻断 CP-1。通过。
8. **zero-caller 边界** — 正确。§1.3 明写不替 state engine 改批量、`writeMany` 语义待真实 caller；同时保留例外"R01/R12/R13 的隔离反例仍必须调用需要的 read/listKeys/clear"。**没有把 state engine 的逐键循环当成 writeMany caller。**
9. **CP 顺序与 gate** — 足够。§2.2 每个 CP 有独立 gate；§12 阻断 CP-1；计划 §3 固定串行并说明理由（每步改变下一步的输入契约）；§5 第 6 条使任一 `OPEN` 阻断交付。能阻止未闭 OPEN 向后传播。
10. **red mutation 是否真能区分** — 十五条覆盖 brief 点名的九个反例全部（同一 port object、protected 走 plain、cryptKey 缺失静默降级、malformed wire、module lookup 永久缓存失败、decode failure 改写 missing、writeMany 伪 atomic、README 示例、测试名称）。**唯一未被任何一条覆盖的是 `M-01` 的未识别 mode token。**
11. **逐代码对账是否够严** — 是。§5 六条要求齐全：枚举每个实际变更文件不得抽样、逐处记录 file+symbol+需求 ID+design anchor+行为+档位、逐代码核对 declaration→transfer→consumption 的单一 owner、只允许 `MATCHED`/`OPEN`、点名禁用四种逃逸措辞、任一 `OPEN` 不得交付。
12. **档位是否严格分层** — 是。§7 每行带档位，§9a 每行带当前状态，计划 §2.2 把 artifact 与 source anchor 都限定为"不是行为 PASS"。未见把 artifact、mock、计划、测试数量或历史 evidence 升级为 Android/release 行为证明。

## 6. 被我推翻的作者结论

**无。** 三份文档中我核过的每一条事实陈述都成立,包括 brief 那句"两处条款落点已写入"。反而是**我自己上一轮的一条检索判断被推翻**——见 §2 的更正。

## 7. 详设与计划漏掉、但本轮必须回答的问题

1. **native 侧未识别 mode token 的行为**（`M-01`）。
2. **cryptKey 错配的可检测性**（`S-01`）。
3. **包公共导出面的同步锚点**（`S-02`）。

除此之外我按 brief 的十二项逐条扫过,未发现其他必须在本轮回答而缺席的问题。

## 8. 当前未执行的证据档位

- **static**：本评审的全部结论。**我未执行任何命令**;文档自报的静态核对按自报处理。artifact 签名我这一轮未独立复跑(上一轮我从 release dex 的符号表独立验到过能力存在,本轮他们给的精确签名来自 `-api.jar`,来源不同、结论一致)。
- **focused**：`NOT_RUN`。当前仅 3 个基于 mock 的用例,protected mode 零用例。
- **native**：`NOT_RUN`。无 Kotlin 单测、无真实 MMKV mode/isolation/restart 证据。
- **Android**：`NOT_RUN`。无 module load、八方法、隔离、重启、故障注入或日志的本轮运行。
- **release**：`NOT_RUN`。clean build、API/ABI、R8、install/autolink 全部 `OPEN`。
- **cleanup**：`NOT_RUN`。
- **Web**：不在本 adapter 通过矩阵,文档已正确声明。

**artifact 存在、详设结构完整、计划写得完整,都不构成任何 native/Android/release 行为证据。** 本文的 `NO-GO` 是对详设与计划的判断,与实施验收无关——本轮本就没有实施授权。

## 9. 授权边界

本文是对详设与实施计划的独立评审输入,**不授权源码实施、测试、构建、Android、native、Web、DEV、seed、UAT 或部署**。`M-01`、`S-01`、`S-02` 三条都在既有批准目标内可自主修订,**不需要 Dexter 裁决**;§12 的十二项决定仍未关闭,CP-1 在它们冻结前不得开始。
