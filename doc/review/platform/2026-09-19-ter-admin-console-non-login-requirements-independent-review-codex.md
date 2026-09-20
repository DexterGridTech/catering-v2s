# TER Admin console 非登录区需求 fresh 独立审查留痕

`REVIEW_TARGET=DESIGN`

`REVIEW_CYCLE_ID=TER_ADMIN_CONSOLE_NON_LOGIN_20260919`

`REVIEW_ROUND=1`

`REVIEW_ROUND_LIMIT=2`

`reviewerKind=INDEPENDENT_SUBAGENT`

`AUTHORITY=READ_ONLY_REVIEW`

`DYNAMIC_ACTIONS=NOT_RUN`

## 1. 审查输入

审查者为两个 fresh 只读独立子 agent，均未修改文件，未运行构建、测试、Web、Metro、Android、设备、DEV、seed、UAT 或部署命令。两位审查者都被要求先回源码验证需求稿，不读取或采信作者结论。

共同输入：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`
- `apps/terminal/ui/base/admin-shell/src/`
- `apps/terminal/kernel/base/contracts/src/types/topology.ts`
- `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`
- `apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts`
- `apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts`
- `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts`
- `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`
- `apps/terminal/kernel/base/platform-ports/src/types/`
- `apps/terminal/ui/base/primitives/src/`
- `apps/terminal/ui/integration/sample-console/theme/`
- `apps/terminal/ui/integration/sample-wallpaper-console/theme/`

## 2. 独立审查结果

### 2.1 Feynman：业务、范围与语义审查

初始结论：`NO-GO`，`M/S/N=0/2/4`。

确认事项：

- 当前平台端口是 capability/source 平面列表，用户需要自行统计状态；
- runtime 与 display-context 是两个入口，display-context 只表示当前 surface，并含“承载几何”等实现术语；
- topology 当前把资格、身份、配对、解绑、服务开关和原因行平铺；
- 三 tab、聚合摘要、全 surface 表达和 topology 旅途化是真实用户问题的对应解；
- 登录、业务 feature、power-confirmation、topology kernel/transport/持久化/协议、后端和部署排除边界合理；
- 需求稿没有把组件树、CSS、hook、像素、测试文件名和实施批次写死。

处置前 finding：

1. `CONFIRMED / S-1`：原 R-12 把“角色不满足”与全局资格并列，可能把已配对副机仍可执行的解绑动作折叠掉。源码反例是 `laptop + 单物理屏 + SLAVE + paired`：query/pair/enable-host 可以不可用，但 unpair 仍可能允许。最小修复是只用全局资格控制整页不可用，角色/状态只控制 operation。
2. `UNVERIFIED_REQUIRES_EVIDENCE / S-2`：全 surface logical/physical facts 的 owner/read model 当前尚未在公开 UI contract 中闭合。当前 `SurfaceContextValue` 主要是 current surface，`DevicePort.DisplayInfo` 只有 displayCount。不能复制当前尺寸伪造副屏；这必须成为 IA/详设 admission blocker。

其它观察：

- 四个现有非业务 part 到三个用户 tab 的映射没有发现反例；power-confirmation 是独立 alert/layer；
- 未发现“需求稿把详设机制写死”或“偷偷扩大 topology kernel/transport”的事实。

### 2.2 Singer：可执行性、owner 与可证伪性审查

初始结论：`PARTIAL`，`M/S/N=0/3/2`。

处置前 finding：

1. `CONFIRMED / S-1`：topology action matrix 的分母未明确覆盖 `TopologyOperation` union、实际 capability command surface 和 eligibility/reason。当前 union 含 `switch-role`，而 `TopologyAdminCapability` 没有同名 command；需求不能让 UI 默默补 command 或默默漏掉它。
2. `UNVERIFIED_REQUIRES_EVIDENCE / S-2`：全 surface/physical resolution 目标必须先选 owner/read model，不能在 Admin shell 内部推导。
3. `CONFIRMED / S-3`：selector 订阅要求如果只检查“调用了 selector”会假绿。需要列出每个 tab 的 selector、render context/capability identity、equality、stable identity 与无关 slice red mutation。

其它观察：

- 当前 primitives 已有 tabs/progress/status/list/table，但没有明确的 expandable group、ratio bar、surface map 专用公共面；后续 IA/详设应把复用和新增分开；
- 四 part 到三 tab 的基本事实无反例。

## 3. 主 agent intake 与处置

### F-01：拓扑全局资格与 operation eligibility 混淆

状态：`CONFIRMED`，已真修复。

落点：需求稿 J-3、R-12、R-13、R-16、§7.7–§7.8。

处置：R-12 现在只把形态、物理屏数、capability 缺失等全局资格作为整页 gate；角色、配对、连接和其它 operation-level 条件只限制对应操作。action matrix 要按 `TopologyOperation` 每个值、capability command 和 eligibility/reason 三者闭合，缺少 command 的值必须显式标为资格-only 或非本批。

反例复核：已配对副机即使不能查询/配对/开启主机服务，仍可保留 owner 允许的解绑或恢复路径；不再被 R-12 的整页不可用语句吞掉。

### F-02：surface facts 公开 owner 未闭合

状态：`UNVERIFIED_REQUIRES_EVIDENCE`，已提升为进入 IA/详设的 admission blocker，不假装关闭。

落点：需求稿 R-9、R-10、R-16、R-20、§5.2、§7.4、§9.1。

处置：保留用户必须同时看到真实 PRIMARY/SECONDARY 的产品要求；明确当前公开 contract 不能提供的物理分辨率不得伪造，详设必须先冻结最小 owner/read-model。若第一版不扩展公共事实，必须诚实显示“物理分辨率未提供”，不得静默退化成复制 current surface。

### F-03：topology action matrix 分母不足

状态：`CONFIRMED`，已真修复。

落点：需求稿 R-13、R-16、§7.8、§9.1。

处置：要求逐一分类 `TopologyOperation` union 当前值、`TopologyAdminCapability` command surface 与 eligibility/reason owner；不允许因为 capability 没有同名方法而由 UI 自行造 command，也不允许无记录地遗漏 `switch-role`。

### F-04：selector 订阅/渲染判据不可证伪

状态：`CONFIRMED`，已真修复为详设输入约束。

落点：需求稿 R-19、§7.10、P-12。

处置：后续详设必须给出完整订阅分母、context/capability identity、equality/stable identity，以及全 root、等价对象漂移、无关 slice 的 red mutation 或不适用理由；仅检查 selector 存在不算证明。本稿不主张性能提升幅度。

### F-05：shared primitive 缺口

状态：`CONFIRMED / NOTE`，不阻塞需求范围。

落点：需求稿 R-5、§7.6、P-11。

处置：保留“优先复用，缺少时扩充 shared primitive/token”的边界；IA/详设必须把既有能力与新增公共能力分表，不能把 expandable group、ratio bar、surface map 当成已经存在。

## 4. 复查结论

主 agent 已按两个独立审查报告重新打开 owning source，并修订需求稿。修订后仍保留以下 OPEN，不把它们写成事实已具备：

- per-surface logical/physical facts 的公开 owner/read model；
- topology action matrix 的具体用户动作映射；
- 三个用户 tab 与四个现有 catalog part/testID 的最终 IA 对账；
- selector/render-count 的详设执行体；
- visual、Web、Android、device、release、cleanup 证据。

本轮 independent review 的输入和 findings 已留痕；本文件不是 Claude review，也不产生 `GO`。下一步由 Claude 与 Dexter 对修订后的需求范围做 DESIGN review，评审通过前不进入 IA、详设、实施或动态验证。

