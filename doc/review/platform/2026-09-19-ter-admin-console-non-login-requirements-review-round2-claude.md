# TER Admin console 非登录区需求与范围 · 复评（Claude round 2）

```text
REVIEW_TARGET=DESIGN（需求与范围）
VERDICT=GO
M/S/N=0/0/3
```

```text
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_READBACK
SESSION=CONTINUED_SESSION
COMMANDS_RUN=无构建/测试/设备/Web/Android/Metro/Git 动作
WRITES=仅本文件
AUTHORITY=只批准需求与范围。GO 不授权 IA、详设、实施、源码修改或动态验证；
         §9.1 的两条 admission blocker 仍是进入 IA 的前置条件，GO 不代表它们已解决
```

## 0. 先纠正我自己上一轮的一处证据

上一轮我写"我在 kernel 与 adapter 全量检索 `logicalWidth|logicalHeight|displayMetrics|densityDpi|
physicalWidth`，零命中"。**这句话是错的**：那次检索我限定了 `--include='*.ts'`，Kotlin 文件根本不在
搜索范围内。intake 的纠正属实，我已回源核对：

- `apps/terminal/adapter/android/device/.../TerminalDeviceModule.kt:320-336` 的 `logDisplay` 确实
  计算了每块屏的 `appWidthPx/appHeightPx`、`densityDpi`、`realWidthPx/realHeightPx` 和
  `mode.physicalWidth/physicalHeight`；
- `.../TerminalDualScreenActivityHandler.kt:159-173` 的 `logViewBounds` 确实计算了
  `logicalWidth/logicalHeight`。

我的**结论**不变，而且证据更强：这两处都只走 `Log.i`。`TerminalDeviceModule.kt:66-78` 的
`getDisplayInfo` 逐屏调用 `logDisplay` 之后，返回的仍然只有 `status` 与 `displayCount`。也就是说
这些值在 adapter 侧已经算出来了，却在 port 边界被丢掉，从未进入公开契约。需求稿 §5.2 第 302 行
现在的措辞（"日志/宿主内部事实，不是 Admin 可消费的公共 read model"）准确。

给 Dexter 的一条信息（不是 finding）：既然 `mode.physicalWidth/physicalHeight` 已经在
`logDisplay` 里算出来了，将来若要把物理分辨率做成公开事实，是加字段而不是做研究。本轮按你的
(a) 裁定不做。

## 1. 七项复核结果

**全部关闭。** 逐项：

1. **current surface 显示逻辑尺寸与就绪/可用状态** —— R-9 第 237 行、J-2 第 172 行、§5.2 第 311
   行、§9.1 第 402 行、P-6 第 389 行五处一致，用词都是"现有公开事实"，对应
   `SurfaceContextValue` 的 `hostLogicalSize` 与 `surfaceHostAvailability`，没有超出公开面。
2. **non-current surface 只有存在性 + 主/副角色 + "该屏信息未提供"，且不复制** —— R-9 第 238 至
   239 行、§5.2 第 307 行与第 311 行、§7 第 4 项第 367 行、P-6 第 389 行、§11.3 第 470 行六处
   一致。"不得把当前 surface 的值复制到另一块屏，也不得为了填满矩形而伪造数据"写在 R-9 本体，
   不是脚注。不对称是显式写出来的，没有为了整齐把两边拉平——这正是我上一轮担心的偏差方向。
3. **topology page-level availability 由 owner 提供** —— R-12 第 251 行新增"全局资格必须通过
   topology owner 提供的整页可用性 read model 或等价的 page-level reason 输出；在该 owner 之前，
   Admin shell 不得读取代表性 operation 的 reason 或 raw facts 自行拼出整页 gate"；R-16 第 267 行
   补"整页资格 read model 也属于 topology owner 的公开边界，不能由 Admin shell 从 operation 结果
   反推"；§7 第 7 项第 370 行同口径；§9.1 第 403 行把它登记为 admission blocker 并附源码事实。
   我上一轮指出的两条 UI 侧绕路（挑一个代表性 operation、直接读 raw facts）都被点名禁止，
   第三条（在 admin-shell 维护 reason 清单）也在 intake 第 62 行被点名。
4. **能力单位分母** —— 选了我建议的 (a) 并冻结在 §5.1 第 289 行、第 293 至 295 行，R-6 第 223 行，
   §7 第 3 项，P-3 第 386 行，§11.3 第 6 条。规则精确到"一个 port 不能同时因为缺失 descriptor
   贡献多个单位"。我按 `PlatformPortsSection.tsx:32-49` 验算了 intake 第 79 至 81 行的例子：
   port A 三 real 加一 unavailable、port B 缺 descriptor，分母为 5（4 个真实 capability 加 1 个
   合成单位），与代码的行产出规则一致。P-3 的判据也从"互相守恒"变成了可算的
   `可用 + 不可用 + 未声明 = 总单位数`，可证伪。
5. **`switch-role` 的 `allowed:true` 不是执行授权** —— §5.3 第 325 行把三件事写全了：union 含它、
   capability 无 command、evaluator 无专门分支因而可能 fall through 为 `allowed:true`，并明确
   "这个 `allowed` 只表示当前 eligibility 结果，不构成用户可执行授权"；§7 第 8 项第 371 行要求
   action matrix 记录该事实。这正是我 N-1 要的那一层。
6. **laptop 双物理屏的两套语料不冲突** —— §5.4 第 331 行把两个 tab 的用户文案分别写死：运行状态
   tab 说"检测到两块物理屏"并在非当前 surface 卡片标注"该屏信息未提供"，拓扑 tab 说"当前功能
   不可用"及"双机拓扑要求本机只有一个物理屏"，并补"不能把 `hasTopologySecondarySurface` 当成
   topology operation eligibility"。与 `evaluateTopologyOperation.ts:30` 和 `:49-55` 的实际语义
   对得上。
7. **独立审查状态、事实来源与范围边界一致** —— 头部第 13 至 15 行改为
   `INDEPENDENT_SUBAGENT_REVIEW=ROUND_1_COMPLETE` 并指向留痕文件；§11.2 第 464 行说明它不是
   Claude review、不产生 GO；第 465 行把两条 owner 缺口明确写成"不是已具备的实现能力"。§5.2
   第 302 行的 Kotlin 事实带精确路径行号。没有把未具备的能力写成已具备。

## 2. Findings（三条 Note，均不阻断）

### N-1 · 非当前 surface 的"主/副角色"是可见事实，但没有指定来源

R-9 第 238 行要求非当前 surface 显示主/副角色，而 R-16 第 267 行要求"所有可见状态、计数、
surface 信息……必须来自其现有 owner 或详设中明确的公开 read model"。非当前 surface 的角色今天
没有 owner 提供：可行的来源是当前 surface 的 `displayMode`（`SurfaceContext.ts:6`）加
`DisplayInfo.displayCount`——"我是 PRIMARY 且共两块，则另一块是 SECONDARY"。

这在 displayCount 为 1 或 2 的支持范围内是对公开事实做算术，不是复制 evaluator，我认为可接受；
但它是本稿唯一一处没有写明来源的可见事实，而 owner 归属正是本稿的核心纪律。displayCount 大于 2
时该推断会静默失效。

**最小修复**：§5.2 补一句——非当前 surface 的主/副角色由当前 surface 的 `displayMode` 与
`displayCount` 推得，这是本批允许的唯一推断；`displayCount` 超出支持范围时该卡片同样降级为
"该屏信息未提供"。

### N-2 · R-10 的词汇表没有反映不对称下限

R-10 第 243 行仍写"必须用主屏、副屏、逻辑分辨率、物理分辨率、画面状态、当前形态等用户可理解的
语言"。它本意是替换"承载几何"这类实现术语，是词汇约束不是展示约束；但它与 R-9 相邻，且主题正好
是"显示图形与语言"，单读 R-10 会以为每块屏都要带逻辑与物理分辨率两个标签。R-9 第 238 行、§5.2
第 311 行和 P-6 第 389 行都能纠正它，所以不会走进实现，但这是全稿唯一没有跟上不对称下限的段落。

**最小修复**：R-10 末尾加一句"具体哪一块 surface 显示哪些字段按 R-9 的不对称下限执行"。

### N-3 · §6.2 与 §9.1 对 topology owner 改动的口径可能被读成死锁

§6.2 第 353 行把"改变 `resolveSecondarySurfaceAvailable`、`hasTopologySecondarySurface` 或
topology owner 语义"列为本批不包含；而 §9.1 第 403 行要求进入 IA 前必须有 topology owner 的
page-level availability read model，并说"若该 owner 变化需要改动 topology contract/kernel，必须
按 §9.3 停止并报告 Dexter"。

两者可以调和——§6.2 排除的是改变既有语义，新增一个聚合既有条件的读模型不改语义——但字面上
一个读者可能得出"IA 需要这个 owner，而这个 owner 的改动不在本批"的死锁。

**最小修复**：§6.2 该条加一个限定，明确排除的是改变既有 topology 语义；新增 page-level
availability 读模型属于 §9.1 已登记的 blocker，其处置走 §9.3 交 Dexter，不属于本条排除。

## 3. 结论

`VERDICT=GO`，`M/S/N=0/0/3`。

上一轮的一个 Major、两个 Significant、三个 Note 全部关闭，且都关闭在正确层级——没有把缺失的
owner 能力伪装成已具备，没有把 Dexter 的 (a) 裁定偷偷扩回 (b)，也没有把我的 NO-GO 改写成 GO。
intake 对我证据的那处纠正是对的，我已在 §0 更正。

三条 Note 都是措辞与归属的补齐，可以在进入 IA 时一并带上，不需要再走一轮需求评审。

**GO 的边界**：本结论只批准需求与范围。§9.1 的两条 admission blocker——topology 的 page-level
availability owner，以及按 (a) 不扩展的 display facts 下限——仍是进入 IA/详设的前置条件；GO 不
代表它们已解决。按 Dexter 的流程，下一步是 IA 设计与确认，不得跳过 IA 直接进详设。本轮不授权
任何源码、测试、构建、Web、Metro、Android、设备或 acceptance/release 动作。
