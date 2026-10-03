# 终端激活交互与双机拓扑优化专项 · 当前修订设计包外部静态复评

REVIEW_ORIGIN=DEXTER_RELAYED_EXTERNAL_REVIEW
reviewerKind=EXTERNAL_CLAUDE
SESSION_PROVENANCE=v2s-rooted continuation；参与过需求讨论及前次外部评审，未编写本次五份设计修订；不冒充 fresh client 或动态 acceptance。
AUTHORITY=独立静态设计复评；不重开内部已关闭的两轮 DESIGN cycle。

## 1 · 结论及证据范围

**NO-GO，M/S/N=0/1/1。** 六项原 S 中五项核心修正闭合，原 S-2 的会员路径已补齐，但同根的实例归属错误仍在 IA 总则和壁纸 LMS 工件中。其影响是双机 LMS 的设计输入仍互相矛盾。另有一项当前源码与提案 testId 标注混淆，列 N，不单独作为阻断。

本轮先读正式需求、讨论稿 §9、当前设计及 owning source，再对照作者 intake；作者 CONFIRMED 不作为本结论依据。Dexter 本轮直接裁决优先：active-success 无按钮/计时，integration 随后路由；取消使用当前服务空间，拒绝保留凭证，不回退旧空间。

本轮只使用文件读取、rg、哈希与文档表格结构解析；没有运行生成、构建、测试、verify、DEV、reset/seed、L2、UAT 或部署。结构解析不是业务测试。

当前五份输入 SHA-256（路径均为仓根相对路径）：

| 输入 | 路径 | SHA-256 |
| --- | --- | --- |
| Journey | doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md | ac08eb35322d6834cbe41e6dfaeb7893609561507dc60854e98a6f4ca1b9f098 |
| IA | doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md | d3f3ff4c3244e2e8849fa25b6b8baae8c7ccd6d4f97655f1f5f56cb4f2fdca11 |
| UI | doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md | 50fcc8046349e183310be3d2121cef87cbc8720b5262997ec802b32db6b4446f |
| D | doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md | a1554cd50626163774f5009e488e43144b60abddce09b2ba331160ecdf6a09a1 |
| P | doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md | 2a12d8a0180ea5be76d9e5c263a0f471bdb162e28140b979eab35d6ec2ddc79f |

下文简称按上表。R 指 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`。

## 2 · 当前 findings

### S-1 · 双机 LMS 的实例归属仍存在同根矛盾（原 S-2 部分闭合）

- **性质 / 分类**：仓内事实，CONFIRMED；不是要求额外同步框架。
- **判据**：R §R-01、R-09a/R-09b；`doc/platform/terminal-coding-standard.md:951–966` 明确单机 LMS 是 MASTER 的 SECONDARY，双机 LMS 是 SLAVE+VICE 上的主机 MAIN/SECONDARY 投影。
- **当前位置与反例**：IA `:137` 仍写“MMP/LMP/LMS属主机runtime”；IA `:48` 的 SAMPLE-09-LMS 仍只允许“host同一runtime selector读confirmed”。UI SAMPLE-09-LMS `:1523` 写 host runtime，`:1528` 写“LMS 与 PRIMARY 同属主机 runtime…不新增同步副本”。反例是配对副机确认切到 VICE 后，由另一 SLAVE runtime 呈现 LMS，必须读当前主机 confirmed 投影，不能读自身 LSP 本地 confirmed。D `:159–160,178–179`、P CP-04/CP-05 已要求双机承载和壁纸隔离，因而这些排他性旧条款不能解释为整个专项一致。
- **同根污染**：IA `:43` 的 SAMPLE-04-MMP 混入“双机SLAVE+VICE”确认路径，`:44` 的 SAMPLE-05-LMP 混入单机/双机 LMS 的路径；这两行的 screen 是 MMP/LMP 本页确认，LMS 分支应留在 SAMPLE-06。IA `:45` 与 UI `:1347–1352,1741` 的 SAMPLE-06 新路径本身正确。
- **真实源码参照**：`apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts:25–31,48–74` 当前从 selector 读 pending 并用 peer-intent；`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:33–54` 当前整状态同步。它们是未来最小修改的来源，不因尚未实施而另报实现 finding。
- **影响**：实现者若按逐屏元数据或 IA 总则注册 renderer/选择数据源，可能排除 SLAVE+VICE，或在双机 LMS 展示副机自己的壁纸。会员修订不能消除全包的承载矛盾。
- **最小可验收修正**：只修上述文档条款。总则明确 LMS 的两种承载；SAMPLE-09 分别描述 MASTER 本地 confirmed selector 与 SLAVE+VICE 当前 peer 的 host-confirmed projection selector，保留 branch-local pending/confirmed。SAMPLE-04/05 恢复各自主机本页确认语义，SAMPLE-06 保留两种 LMS 路径。同根检查 ACT/AUTH/SAMPLE 全部 LMS 行，不能再有排除双机的“同一 runtime”断言。无需新增 owner、协议、协调器或动态运行。
- **Dexter 产品裁决**：不需要，已有术语及产品裁决充分。

### N-1 · 新 logout testId 被误标为当前常量

- **性质 / 分类**：仓内事实，CONFIRMED；文档证据标注问题。
- **位置**：UI `:1742` SAMPLE-07 汇总行把含 `logout` 的全集标为“当前常量”。但 `apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts:3–12` 只有 root/title/optionsScroll/options/confirm 与 option 派生器，无 logout。UI `:1438` 将 logout 正确标为 DESIGN_PROPOSAL / NOT_IMPLEMENTED；D §3a 同样是后续提案。
- **影响**：后续实施或绑定清单可能错误认定符号已存在；不影响本轮已明确的登出产品方向。
- **最小可验收修正**：汇总行将已有 IDs 和新增 logout（以及尚不存在的 exit）分别标明当前 / 提案。核对 SAMPLE-07/08/10 同族 roster 与汇总即可；不新增 checker、不修改源码。
- **Dexter 产品裁决**：不需要。

## 3 · 原 findings 核验及方案合理性

| 原项 | 当前静态判断 | 证据 |
| --- | --- | --- |
| S-1 壁纸登出 | 核心闭合 | UI `:1411,1438,1448,1471,1494–1505,1742–1745` 明确主面 logout、exit 区分及 LSP 无 logout；P CP-05 复用现有 staff logoutCommand，失败保留 session/page。剩余 ID 标注见 N-1。 |
| S-2 LMS / pending | 部分闭合 | D `:159,178,285–286`、P CP-04/05 已区分 MASTER 本地与 SLAVE+VICE projection、operationId、显式 peer 回 MASTER，以及 apply 保留 branchPending；同根承载矛盾见 S-1。 |
| S-3 active-success | 闭合 | Journey `:40`、IA `:25–28`、UI 四 ACT 与 `:1786`、D `:171,275`、P CP-02 与本轮直接裁决一致；无需四个新 screen、计时或 CTA。 |
| S-4 生成 / 前缀 / 身份 | 核心设计闭合 | D `:65,140,162,172,176,276`，P CP-02 步骤1a明确 canonical→materialize→edge-codegen→terminal policy/client suffix；client 不读 config，provider 注入 adapter，terminalRef 来自 credential，集团等身份来自验证成功响应；当前空间拒绝保留凭证。当前源码及 policy 尚未实施，未宣称生成或 HTTP PASS。 |
| S-5 配置失败分层 | 闭合 | IA `:154`、UI `:1787`、D `:142,279`、P CP-03 分开拒绝/effective/persistence/sync；与 serverConfigActor `:212–294` 先 dispatch effective 的事实相符。不增默认回滚。 |
| S-6 唯一 baseUrl | 闭合 | IA ADMIN-02、D §3a、P CP-03 地址逐项只有 name/baseUrl/timeout；与 serverConfig.ts `:34–43` 一致，删除额外 prefix 输入。 |
| N-1 模板 / 分母 | 结构核心闭合 | 当前 UI 26 个唯一 screen、26 个 mutation 矩阵、62 条数据行，各矩阵八列；D `:272–293` 20 个 V 场景均七列且 oracle/cleanup 分开；AUTH dependency 图与 memberFormOpened 分母已补齐。标注残留单列当前 N-1。 |

方案方向合理：配置和凭证各留原 owner，integration 只编排，UI 两个呈现包不复制事实；同步只增加当前 peer 所需投影并保留本地 pending。比新增通用路由器、仲裁、队列或恢复框架更小。主机壁纸 logout 是明确用户需求；副机不独立激活/TDS、不改主机配置、不登出，不因 proxy 明文例外而复制终端凭证。修正上述文档即可，不应借复评扩建系统。

## 4 · 模板、同根与证据限制

- Journey 元数据/前提链/范围/corpus/UI适用性/裁决槽位有；IA 可见/不可见维度、容器、错误、对账及完成块有，但实例条款存在 S-1。
- UI canonical §1.1/§1.2、26 screen 字段、线框、roster、输入依赖、八列 mutation、状态/任务合理性/owner/看图范围有；search 明确 N/A。后台 foundation/§3-K 对 TER 为具理由 N/A。已退役 manifest 控制面不要求恢复。
- implementation-design §0–14 各功能槽位含 CP、机制、§3a、迁移、seed N/A、§11a、阶段/全批/逐代码对账；P 的 CP→全批6b→整体验收→13c→实施 review 顺序无本轮新增循环。现有 seed/reset/L2 N/A 不构成跳过未来适用全仓验证的授权。
- 同根扫描覆盖四 ACT、四 AUTH、会员六屏、壁纸四屏及 IA 总则；会员 SAMPLE-06 修正正确，其余 MMP/LMP 确认页不应混入 SLAVE+VICE。所有 26 mutation 表和 20 V 表已解析核对。
- **静态已证**仅指文档规则、源码现有 API 与表结构；没有测试已证项。实际 render、焦点/键盘、遮罩、admin 恢复、HTTP/代理、生成、持久化、并发和同步 apply 都未验证。
- 第三方无本轮新增 API/行为证明；设计中现有封装与解析版本记录不能升级为设备行为证据。实施若依赖新的默认值/API行为仍需相应官方依据。本轮未提出未经验证的新库方案。
- `DESIGN_GAPS`：未发现需新增产品规则的独立缺口；S-1 是已有判据互相矛盾。长期 sample 集合容量不是本轮擅自加 cap 的理由。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/1
L1_ENGINEERING=当前实现/运行均未被误称PASS；testId当前/提案标注存在N-1
L2_USER_VISIBLE=S-1：双机LMS实例归属与壁纸数据源条款矛盾
L3_UNVERIFIED=本轮DESIGN无动态交付断言；实施期未验证清单见§4，全部NOT_RUN
SAME_ROOT_SCAN=ACT/AUTH/会员/壁纸全部LMS及IA总则；26 mutation表、20 V表；剩余同族已按§4核对
DESIGN_GAPS=无新增产品判据；已知判据矛盾见S-1
TEMPLATE_COVERAGE=四模板适用槽位有；IA/UI内容一致性仍有finding；N/A理由见§4
EVIDENCE_TIER=独立外部静态文档/source核验；结构解析非测试；V-01～V-20、Expo Web、VM/device、adapter、business、cleanup全部NOT_RUN
```

本结论仅绑定上述当前输入，不替代旧字节 verdict，不授权源码实施或任何动态运行。只写本评审交付物，其余文件保持只读。
