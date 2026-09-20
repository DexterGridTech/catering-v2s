# TER Admin console 非登录区需求与范围 · 独立评审（Claude）

```text
REVIEW_TARGET=DESIGN（需求与范围）
VERDICT=NO-GO
M/S/N=1/2/3
```

```text
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_READBACK
SESSION=CONTINUED_SESSION（非 fresh；本轮所有行级断言均重新打开源码核对）
COMMANDS_RUN=无构建/测试/设备/Web/Android/Metro/Git 动作
WRITES=仅本文件
AUTHORITY=只评审需求与范围；GO 也不授权 IA、详设、实施、源码、构建、设备或任何 acceptance
```

## 1. 方案合理性（先于闭环正确）

**问题对不对**：对，而且是真问题。我回源码确认了三条现状：`PlatformPortsSection.tsx:32-49` 把
capability 平铺成一张长列表，用户要自己统计；`RuntimeSection` 与 `DisplayContextSection` 是两个
独立入口，而 `SurfaceContextValue`（`render/src/contexts/SurfaceContext.ts:5-14`）只描述当前
surface；`TopologySection` 把资格、身份、配对、服务、原因平铺。用户确实要自己从技术字段推断
"现在是否正常、能点什么"。

**方案优不优**：§10 的六个替代方案我逐个想过，B（三 tab、按任务聚合、laptop/mobile 分别编排）
是我独立推导也会选的。特别认可两点：把 owner 边界写死在 R-16（UI 不重算 `paired`/`peerReachable`、
不复制 evaluator），以及 §9.2 把"解除配对是否要二次确认"这类破坏性语义留给 Dexter 而不是默决。
§11.3 的六条反例自检是真反例，不是形式主义——第 2、4、6 条我代进源码跑过，确实会红。

**代价配不配**：这里有一个范围判断需要 Dexter 拍板，见 M-1。按当前源码事实，这不是一次纯
Admin UI 重组：R-9 的"同时显示主屏与副屏"在不扩展 display facts owner 的前提下，连逻辑分辨率
都拿不到。需求稿把这件事放在 §9.3 的"如果发现必须改动"，但它是必然项。范围批准前必须决定
它在 §6.1 还是在本批之外。

## 2. UI 与交互强制自问

- 操作是否来自已批准 Journey：是。J-0 到 J-3 直接对应 Dexter 本轮的口述要求（端口先看总量比例、
  运行状态合并且双屏都要显示、拓扑先回答能不能用再给角色相关操作）。
- 用户此时这样操作是否合逻辑：是。§2.2 的五个问题排序合理，先"能不能用"再"为什么"。
- 有没有更短路径：没有更短的。相反，R-7 明确禁止"因为数量小就取消层级"，这一条值得保留——
  端口数量会增长，先建层级比以后再拆便宜。
- 不合理之处来自哪：来自**公开 contract 的能力缺口**（M-1、S-1），不是产品语义不清，也不是
  旧文档模糊。这两处都是 owner 侧需要先补的读模型。
- 无障碍：按 Dexter 既有裁定，TER 不关心无障碍，本文不产生相关 finding。

## 3. Findings

### M-1 · 非当前 surface 连逻辑尺寸与就绪状态都没有 owner，不只是物理分辨率；R-9 写的第一版下限不可达 · CONFIRMED

**仓内事实**：
- `kernel/base/platform-ports/src/types/device.ts:16-18` 的 `DisplayInfo` 只有 `displayCount`
  一个字段；`:60` 的 `getDisplayInfo` 返回的就是它。
- `ui/base/render/src/contexts/SurfaceContext.ts:5-14` 的 `SurfaceContextValue` 只有
  `displayMode`、`containerKey`、`surfaceForm`、`isHostPrimaryDisplay`、`surfaceIdentity`、
  `hostLogicalSize`、`surfaceHostAvailability`——全部描述**当前** surface。
- `display-context/src/foundations/displayDerivation.ts` 通篇只做 mode/role/workspace/资格推导，
  没有任何尺寸事实；`resolveSecondarySurfaceAvailable`（`:65-66`）也只读 `displayCount`。
- 我在 `apps/terminal/kernel` 与 `apps/terminal/adapter` 全量检索
  `logicalWidth|logicalHeight|displayMetrics|densityDpi|physicalWidth`，**零命中**。

**推论**：单机双屏时，运行在 PRIMARY 的 Admin console 对 SECONDARY 只知道"它存在"（由
`displayCount >= 2` 推得），既没有逻辑尺寸，也没有就绪状态，更没有物理尺寸。

**与需求稿的冲突**：§5.2 第 301 行承诺"若仓内当前 owner 无法提供 physical resolution，第一版
可以诚实显示未提供，但必须保留 surface 角色、**逻辑分辨率**和状态"；§9.1 第 388 行也只把
"每个 surface 的物理分辨率"列为 admission blocker。按上面的事实，**逻辑分辨率与状态和物理值
一样拿不到**，所以 R-9 给自己写的兜底下限本身不成立。

**这不是复述前一轮审查**：Feynman 的 S-2 与 Singer 的 S-2 原话都是"全 surface **logical/physical**
facts 的 owner/read model 未闭合"，措辞是对的；是需求稿在 intake 时把它收窄成了"物理"。这属于
处置收窄，不是新发现的事实。

**影响面**：它决定本批的性质。§6.1 把范围写成 Admin UI 重组，§9.3 把 kernel/Android contract
扩展写成"如果为了满足 R-9 发现必须改动"的或有项。按当前源码，它是**必然项**。Dexter 本轮要
确定的正是范围，这一条直接改变答案。

**最小修复**：§9.1 改写为"非当前 surface 的逻辑尺寸、就绪状态与物理尺寸都没有公开 owner"；
R-9 给出两个互斥分支，由范围批准时选定其一——
(a) 不扩展 owner：诚实下限降为"角色 + 存在性"，矩形内不写逻辑分辨率，副屏卡片明确标注
    "该屏信息未提供"；
(b) 扩展 owner：把 display facts 的公开读模型扩展显式写进 §6.1 本批范围，并承担 kernel 与
    Android device contract 的跨包影响。
不能把这个选择留到详设——它是范围问题不是机制问题。

**需 Dexter 裁决**：是。**阻断**：是，阻断范围批准。

### S-1 · R-12 要求 owner 提供"全局资格"，而 owner 今天只有 per-operation 资格 · CONFIRMED

**仓内事实**：`topology/src/foundations/evaluateTopologyOperation.ts:26-47` 只返回单个 operation
的 `TopologyOperationEligibility`。两条全局条件写在函数内部并对每个 operation 重复判定：
`:29` `surfaceForm !== 'laptop'` → `TOPOLOGY_UNSUPPORTED_FORM`，`:30` `displayCount !== 1` →
`TOPOLOGY_REQUIRES_SINGLE_SCREEN`。第三条全局态在
`createTopologyAdminCapability.ts:88-92` 的 `unavailableEligibility`，facts 缺失时给
`TOPOLOGY_UNAVAILABLE`。而 `contracts/src/types/topology.ts:109-116` 的
`TopologyAdminCapability` 只有 `getSnapshot`、`getOperationEligibility` 与四个 command，
**没有任何返回整页可用性的方法**。

**推论**：R-12 末句"全局资格与 operation eligibility 均由 topology owner 提供，UI 不得重算"
今天无法满足。UI 只剩两条路，都被需求稿自己禁止：拿某个代表性 operation 的 `reasonCode`
再自行判定"这三个码属于全局"——这就是在 UI 里重建 gate；或直接读 `facts.surfaceForm` 与
`facts.displayCount` 自己判断——R-16 明文禁止。

**反例**：`laptop + displayCount=2`。此时五个 operation 全部 `allowed:false`、`reasonCode` 全是
`TOPOLOGY_REQUIRES_SINGLE_SCREEN`。UI 要得出"整页不可用"，必须知道这个码是 page-level 而
`TOPOLOGY_REQUIRES_MASTER` 不是——这份知识今天不在 topology 包里，只能写在 admin-shell 里。

**为什么值得单列**：需求稿对 display facts 的同构缺口做了 §9.1 登记，对这条只字未提。两处
性质完全一样，处置却不对称。

**最小修复**：§9.1 增列第二条 admission blocker——详设必须二选一：在 topology 包内新增 owner
侧的整页可用性读模型（例如返回 `{available, reasonCode}`），或由 topology owner 显式声明
page-level reasonCode 清单并放在 topology 包内导出，供 admin-shell 直接消费。无论哪种，这份
知识都不能落在 admin-shell。

**需 Dexter 裁决**：否，是 owner 边界问题。但必须在范围批准时登记为 blocker。

### S-2 · 端口摘要的三个桶不共享同一个分母，而 R-6 要求一根比例条 · CONFIRMED

**仓内事实**：`PlatformPortsSection.tsx:32-49`，`descriptorStatus === 'missing-descriptor'` 或
`capabilities.length === 0` 的 port 产出**恰好一行**（`:33-41`）；其余 port 每个 capability 产出
一行（`:42-48`）。

**推论**：可用与不可用天然是 capability 层计数，未提供/未声明天然是 port 层计数。§5.1 第 283
行要求"选择一种并贯穿图表、分类和展开明细"，但两种纯选法都不成立：capability 层里一个
missing-descriptor 的 port 贡献 0 个 capability，根本进不了分母；port 层里一个部分可用的 port
无法表达"3 可用 1 不可用"。而 R-6 要求"用横条比例图表达数量分布"，一根条隐含一个分母。

**反例**：port A 有 4 个 capability（3 real、1 unavailable），port B 是 missing-descriptor。
capability 分母 = 4，B 无处安放；port 分母 = 2，A 内部的不可用被抹掉。两种口径都会让 §5.1
第 285 行"展开所有分类后的数量之和必须与摘要分母一致"这条守恒判据无法定义。

**最小修复**：在需求层就冻结一条规则，二选一——
(a) 比例条按 capability 计数，每个 missing-descriptor 或空 capability 的 port 贡献**恰好一个**
    合成"未声明"单位并计入同一分母；
(b) 比例条只表达 capability 层的可用与不可用，未提供作为条外的独立 port 计数。
选定后把 §5.1 第 285 行的守恒判据按所选口径重写，否则 P-3 的"互相守恒"不可证伪。

### N-1 · `switch-role` 的 owner 资格是无条件放行，文档只要求分类、未要求记录这一事实

`contracts/src/types/topology.ts:7` 的 `TopologyOperation` union 有五个成员，
`:112-115` 的 capability 只有四个执行方法，`switch-role` 没有 command——**这点 R-16 第 259 行与
§7 第 8 项已经要求逐一分类，处置正确，不是 finding**。但还有一层没被覆盖：
`evaluateTopologyOperation` 里没有任何 `switch-role` 分支，它在 laptop + 单屏时对 MASTER 与
SLAVE 一律走到 `:46` 返回 `allowed: true`。R-13 要求"操作可用性和原因必须来自 typed owner
capability"，若将来有人给它接上 command，owner 会告诉副机"你可以切换角色"。建议 §7 第 8 项
补一句：分类时必须记录 `switch-role` 当前的 eligibility 未设门，`allowed:true` 不构成 owner 背书。

### N-2 · 同一块屏在两个 tab 可能被叫成两件事

`evaluateTopologyOperation.ts:49-55` 的 `hasTopologySecondarySurface` 在 `displayCount >= 2` 时
为 true；而同文件 `:30` 对 `displayCount !== 1` 的所有 operation 判否。于是 laptop 双物理屏这一台
机器：运行状态 tab 会表达"存在第二块屏"，拓扑 tab 必须说"功能不可用"。§1.3.5 已经要求
"拓扑副屏可用与物理显示信息必须分开呈现"，方向对；但 §5.4 的术语映射与 §7 第 12 项的语料表
没有覆盖这组并置。建议在术语表里为这一组合明确规定两处的用户文案。

### N-3 · 文档头部状态与实际不符

第 13 行写 `INDEPENDENT_SUBAGENT_REVIEW=REQUIRED_NOT_RUN`，§11.2 第 450 行写"必须在交给 Claude
前完成 fresh 只读 DESIGN 审查"；但该审查已完成并留痕在
`doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-independent-review-codex.md`
（两名 fresh 只读子 agent，round 1），交接话术也说明已经过一轮。头部状态应同步为已执行及其
结论，否则下一个读者会以为盲审未做。

## 4. 逐项核验：成立，不构成 finding

- **四 part 收口为三 tab**：`parts.ts` 的四个非业务 part 与目标三 tab 的映射我核过，没有反例；
  `admin.console.power-confirmation` 确实是独立 alert/layer，排除合理。
- **全局资格与单 operation 资格必须分开**（R-12 后半段）：这正是前一轮 Feynman S-1 的处置，
  处置后的措辞是对的。源码反例成立：`laptop + 单屏 + SLAVE + paired` 时，`pair`/`query-host`/
  `enable-host` 因 `:37`、`:41` 被拒，而 `unpair` 在 `:31-34` 仍 `allowed:true`——整页不能因此折叠。
- **paired 与 peerReachable 正交**：`selectTopologyFacts.ts:38-39` 的 `paired` 只看
  `masterLocator` 与 MASTER 的 `peerIdentity`；`evaluateTopologyOperation.ts:43-46` 的注释明确
  写了可达性"deliberately not an eligibility gate"。R-15、§1.3.3 与之一致。
- **平台端口的 missing-descriptor 不能被吞**：§5.1 的描述与 `PlatformPortsSection.tsx:33-41`
  的实际分支逐项对得上。
- **承载几何等术语必须换掉**：Dexter 的口述要求在 R-10 与 §2.3 都有对应条目，且 §5.4 要求
  内部值到用户语言只建一份映射，避免各 tab 各翻一套。
- **primitives/theme 边界**：R-5 与 §1.3.6 的方向与本仓既有做法一致——公共控件与语义 token 进
  primitives，色值由两个 integration theme 注入，不在 admin-shell 写死品牌色。
- **需求稿没有越界写详设**：通篇没有冻结组件树、className、hook 形态、props、像素值、测试
  文件名或实施批次；§6.2 把这些显式排除。
- **档位诚实**：§11.2 把未运行项逐条列出，physical per-surface resolution 标
  `UNVERIFIED_REQUIRES_DESIGN_OWNER`，§8 的 P-1 到 P-13 每条都写了"不能冒充的证据"。

## 5. 结论

`VERDICT=NO-GO`，`M/S/N=1/2/3`。

需求本身质量很高——用户问题找得准，owner 边界守得住，替代方案比较是真比较，反例自检能逮住
自己。挡住范围批准的只有一件事：**M-1 决定这批到底是不是纯 UI 重组**。按当前公开 contract，
非当前 surface 的逻辑尺寸、就绪状态和物理尺寸都没有 owner，所以 R-9 要么降到"角色 + 存在性"
的诚实下限，要么把 display facts owner 扩展写进本批范围。这一句需要 Dexter 拍。

两条 Significant（拓扑整页资格的 owner 缺口、端口三桶分母）都在 Codex 既有边界内可自行收口，
但都必须在范围批准时登记为 admission blocker，不能留到详设再发现。三条 Note 是补记与状态同步。

本结论只覆盖需求与范围；不授权 IA、详设、实施、源码、测试、构建、Web、Metro、Android、设备
或任何 acceptance/release PASS。
