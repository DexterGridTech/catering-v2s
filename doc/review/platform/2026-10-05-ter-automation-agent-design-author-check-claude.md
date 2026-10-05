# TER automation-agent 设计包 · 作者静态检查与审查状态

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_IMPLEMENTATION_DESIGN_2026-10-05_CLAUDE
REVIEW_STATUS=INDEPENDENT_REVIEW_OPEN
reviewerKind=AUTHOR_SELF_CHECK_NOT_INDEPENDENT_VERDICT
EVIDENCE_TIER=STATIC_DOCUMENT_AND_SOURCE_INSPECTION

## 已完成与边界

本次交付完整待评提案：Journey、IA、两屏线框、源码盘点、详设、计划及未安装 skill 草案。独立评审还没有发生，作者不代写 GO/NO-GO。没有改生产源码、需求正本或开发规范，没有安装依赖或执行生成、构建、测试、verify、DEV、Web、设备、reset/seed。文档交接格式检查与源码静态读取单独记录，不能当成功能证明。

## 独立子 agent 工具失败

- 派发任务：`automation_design_review`，`fork_turns=none`，完整设计包的只读 fresh DESIGN 第一轮。
- 工具返回：`collab spawn failed: agent thread limit reached`；未返回 reviewer/session ID，没有 reviewer 阅读范围、finding 或 verdict。
- last known good：主 agent 完成设计包提案；first failure/broken boundary：协作工具线程容量，而非设计运行或业务失败。
- 状态诊断：`collaboration.list_agents` 实际仅显示 root 运行及四个已完成的历史任务；它们均不是本设计包的 fresh reviewer。可用 API 没有释放/关闭历史线程的方法，不将历史 reviewer 改名或复用为独立审查。
- 未盲重试，不把一次工具失败凑成三次，不启用重复失败后的作者接管例外。没有消耗有效审查轮次，没有形成第一轮 verdict；内部设计 review 保持 OPEN。需求先前的 cycle 与本设计包 cycle 不混用。本包交另一位 Claude 的外部 review 也不冒充内部独立子 agent 留痕。

## 作者检查的具体修订

| 问题族/全集 | 静态发现与最小处置 | 当前范围 |
|---|---|---|
| selector 登记 | 详设写12包而实际附件/计划11包；统一11。签名而非 select 前缀盘点42项；新增项实施重扫 | 详设§9、附件、CP-02 |
| 真实操作与 request 关联 | 含有先press后订阅的矛盾句；改为全部观察先建立。现有 request views 保留结果，UI自建request通过基线/根command/workspace/display匹配；不猜payload或最近一条 | §4.4与计划CP-04；journal先订阅路径一并核对 |
| display 识别/截图 | input logical id 与 SurfaceFlinger id区分；截图含-p；大整数ID保持decimal string；adb只用固定参数数组 | §4.1，两个Android执行面 |
| 地址诊断 | 明确hello session来源、日志地址脱敏与admin配置地址不同的显示责任，禁止token/IP落盘 | §4.1、§7、UI两屏 |
| fixture | 定位真正Node DEV scenario owning source；现成能力是查询已有fixture，不声称可创建code，不取消未知ACTIVE绑定 | §10b、计划CP-04 |
| runner 退役 | 附件新增11份源码的scope/action/anchor/hash，含13种Web场景、7种sample1 case；未迁移场景明确HANDOFF，无假覆盖 | §9a.1与计划CP-06 |

同根检查包括详设六CP、计划六CP、20条R/V表、两屏UI、selector附件与退役附件。未发现需要新增业务slice、平台port、第二账本、通用恢复框架或旧runner兼容层的理由；这只是作者检查，不能证明没有剩余finding。

## 模板与跨文档检查范围

- Journey：§1～7及corpus、前提链、非目标、治理裁决槽位。
- IA：可见/不可见、共享信息、错误状态、交叉对账与完成条件。
- UI：canonical §1.1/1.2、两屏、surface/testID/文案、控件、状态与看图槽位；批准状态均 UNSET。
- 详设：§0～14与§3a、9a/9b、10b六子节、11a、13b/13c；计划逐CP输入、工作、focused proof、退出、6b/终验/13c/交付顺序。
- 数值：协议/订阅/观察/内存/像素/性能/bundle是本提案技术预算，不是Dexter原话或已测容量；review仍需判断其合理性。未把未来F证明当当前PASS。

## 保留的未决与未验证

1. 两条admin常量行线框尚未由Dexter确认；设计提案不能成为实施准入。
2. R-18「fresh agent仅读skill独立写/跑小旅途」与AGENTS「子agent仅只读」有执行者边界；提案按fresh提出/主agent写跑处理。需外部review核验等价性；不等价时交Dexter，不自行豁免。
3. 实际RN Fabric/Presentation几何、虚拟机双display、wss、正常/异常恢复、晚到事件、F-4开销、所有R/V业务及cleanup均未运行。
4. 新依赖尚未安装/解析；官方精确版本/API读取未闭合项见详设§3.1/12。registry版本存在不能替代API/产物证明。
5. Codex在途源码可能变化；实施前重新盘点与读取，不能冻结为实施白名单。

本文件无独立verdict，不满足内部 DESIGN review 关闭条件。当前设计交付完成，下一步是另一位Claude独立审查及Dexter确认；源码实施仍未授权。

## 交付静态检查

需求正本哈希仍与设计一致；盘点采用实际 `hash`/`sha256` 字段复算，生产定位文件及11份runner源码未出现漂移。排除两份dist生成bundle后，盘点为145文件（115源码、30测试）、1,483定位点、639 JSX位置。仅文档交接格式检查 `CLAUDE_REVIEW_HANDOFF=PASS`；未运行项目verify或功能测试。

| 本次提案输入 | SHA-256 |
|---|---|
| `doc/decisions/2026-10-05-ter-automation-agent-journey-claude.md` | `23b6b1d961eed0f8bd62d3e2e22612710947bb29ae50bf80f8830f6b66ca6436` |
| `doc/decisions/2026-10-05-ter-automation-agent-ia-claude.md` | `cbc898abed5762cae2ec7b1cbce8c3de5ec76fdb9ea24b1f1e66ebe3533d4d73` |
| `doc/decisions/2026-10-05-ter-automation-agent-ui-interaction-claude.md` | `445d66bae04a539600a123568f7a6a5467f607244aca1879f69d7a5b462da176` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md` | `dcc53cc1a6480456f28052e0b28c22374fc8a7b05e96a6f945e424b7e9618d9e` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md` | `db2325233bc7a05aee950e4ebeaf2d999b7eec40fcf298865d997337e53664d2` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-source-inventory-claude.json` | `33a5df4eb028b9d76d8a53c8850e7a821a62de74a0af979f7af9d991b1c4451e` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-skill-draft-claude.md` | `f7cfdfbb98d77ceb5973573e180e8203fb9dd8aa674a30e29e6f83f47b278286` |
