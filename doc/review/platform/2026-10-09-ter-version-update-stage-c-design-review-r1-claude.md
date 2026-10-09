# TER 更新阶段 C：fresh 独立 DESIGN Round 1

REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=/root/stage_c_design_round1
INPUT_CHECKLIST=doc/review/platform/2026-10-09-ter-version-update-stage-c-design-review-input-claude.md
VERDICT=NO-GO
M/S/N=0M/4S/2N
EVIDENCE_TIER=STATIC_CURRENT_SOURCE
IMPLEMENTATION_AUTHORITY=false
DYNAMIC=NOT_RUN
FILE_WRITES=NONE
RUNTIME_READS=NONE

本报告正文来自 fresh、fork=none、只读独立 reviewer；主 agent 仅转录其结论和证据。reviewer 先证伪形成 findings/verdict，未读取作者 intake。旧 A/B 结论、作者状态和计划不作为运行证明。NO-GO 原因是下面四个主流程反例，不是 UI 尚未确认或缺少动态 evidence。

## 1. 受审字节与阅读范围

| 文件（仓根） | SHA-256 |
| --- | --- |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md | 1fc04c2c098d86648849742e7b3a0e84874c56b263b279a2c80df562cf9a41a0 |
| 同前缀 ia-claude.md | b139eb9de1c73b95e7833b3d78333d894dc875eb9cd7dd7c1bdf03de71b9fc3f |
| 同前缀 ui-interaction-claude.md | 719dc6cb05c61dfc60da68c20acea5303201996f16d94c344aed3a32493d7518 |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md | 6984dd1382c0ee6a48d73b70c85c4d4a29af5ffa64e8108bf65be28ca54d6b6b |
| 同前缀 implementation-plan-claude.md | 96eb929e1720ee9333ef11c542a0ce3ce930cf241d3a96228315aff14e7958c1 |
| 同前缀 source-and-api-appendix-claude.md | 189c076b7efd1e14d98d268da6eff6a4f4cc4a31582571f391f60fcd8c19b37a |
| INPUT_CHECKLIST | 39b034f924b157cb6675cd45059965dd3b7b020bb2672659be3129bf1185ff79 |

独立 reviewer 声明完整阅读：AGENTS/CLAUDE/Blueprint/两个 README；index 全六个 kernel/deterministic；正式需求及讨论稿；A/B 三份设计文档各全文；C 六份全文；四模板；implementation/review/terminal/frontend/third-party/foundation/backend 标准；治理/verification/方案合理性/corpus/observability/backend acceptance/退役约束；cs-review/cs-memory-recall/cs-terminal-automation。六维只读 recall-memory 的全部 29 命中原文已读，包括 kernel、confirmed corpus、deterministic、独立审查、后台/前端/终端规范、交接、业务语汇、verification、TER architecture、适用 pitfalls/practices。owning source 小文件全读，大文件覆盖相关 owner 调用链；不声称覆盖大文件无关行。未执行测试、编译或动态入口，未读 .runtime，未写文件。

## 2. Findings（位置绑定上述旧字节）

### S-01：确认旧 boot 结果错误地占用新 boot 执行名额

- 位置：详设 §8.2 L159–161；计划 CP-03 L53–58。判据：正式需求 R-09 L162–168、讨论稿 L547–554；源码 terminal-update/src/features/actors/terminalUpdateActor.ts L901–910、1002–1006。
- 性质/事实：R-09 为 S1 FULL→S2 HOT→S3 确认旧结果并可选择新规则；确认不是执行。草案却写最终确认仍占本 boot、必须下一 boot 才领规则，并沿用 A 当前覆写 task.bootId 的形状。
- 反例/影响：S3 已运行 HOT，新 R2 已就绪，却无故等 S4；正常使用不再重启时无法推进。
- 最小修正：同一 currentTask 区分实际执行 boot 与纯确认；S2 续接占 S2，S3 仅确认旧任务可释放后领一条新规则；不另建名额账本。同步 FULL/HOT 场景。
- Dexter：恢复 R-09 无需新裁决；若坚持延至 S4 则需产品改判。

### S-02：不同 App 的 VICE 副机缺少真实业务呈现落点

- 位置：详设 §8.7 L201–205；计划 CP-04 L64–71。源码 topology/src/features/actors/actors.ts L545–559、sample-wallpaper-console/src/application/module.ts L50–67/110–130、render/src/components/LayerStack.tsx L124–136。
- 性质/事实：pair 后 SLAVE/VICE；wallpaper VICE 没有本地业务 placement。草案禁止不同 App 的业务投影，却承诺各 App 本地 feature 保持业务。
- 反例/影响：console MAIN＋wallpaper BRANCH/VICE 无本地 placement、无 wallpaper 投影；实施只能猜角色变化、外国业务或空屏。
- 最小修正：列 App pair×role×workspace×physical surface 的实际展示/来源/readiness/保护/admin 表，不建插件系统。
- Dexter：需要裁定不同 App 副机业务是保护模式还是独立本地业务；独立升级不能推导该产品行为。

### S-03：FULL ZIP 内不存在草案要求读取的 ZIP-level manifest

- 位置：详设 §8.6 L193–195；计划 CP-04 L67–68；附件 §4 L54。源码 TerminalUpdateArtifactPreparer.kt L267–320、CBS TerminalUpdateArtifactOwnerService.java L226–228/256–263、TDC generated terminalApi.ts L238–264。
- 性质/事实：FULL extractFull 要求 ZIP 只有一个 APK；apk.path/sha/certificate 来自 grant.manifest.apk，规则摘要没有这些字段。
- 影响：正常副机 FULL 下载无法进入当前校验链，实施会另造容器格式或绕过验证。
- 最小修正：FULL/HOT 摘要判别类型；FULL 带有界 apk.path/sha/certificate，沿 single-APK extractFull/validateFull；HOT 从 ZIP 内现有 publication JSON 还原。本批不改 CBS operation/ZIP 格式、不传完整 files、不加 parser。
- Dexter：技术修正，无需产品裁决。

### S-04：已知 pending-user 的 N 再邀请被错误排除

- 位置：详设 §8.4 L173–177；UI L39–46/77–81。源码 TerminalUpdateRuntime.kt L379–405/577–591、TerminalUpdateInstallerPolicy.kt L48–54/63–75、TerminalUpdateModule.kt L15–20、terminalUpdateActor.ts L938–943。
- 性质/事实：有 session＋精确 pending-user Intent 属 accepted/applying，并非 UNKNOWN；草案要求无进行中 session 才能再邀请，排除了可恢复的正常等待。
- 反例/影响：目标未安装、应用前台、系统确认不在显示但 session 仍存活；本可恢复 exact Intent，却不再提醒。
- 最小修正：分 known pending-user 可恢复、正在安装/确认显示、UNKNOWN、ended-not-installed 四分支；前者 N 后恢复同确认，不 commit；结束才新 action。同一 owner N，与旧 native foreground 处理统一，不建双调度。
- Dexter：按原持续提醒修正无需裁决；缩减 N 适用面才需裁定。

### N-01：新邀请 UI canonical、容器尺度与归属未完整

- 位置：UI L10–21/59–71；模板 L37–46/63–74/107–121。
- 性质：缺 canonical USER_VISIBLE_COPY/TECHNICAL_BOUNDARY/FOUNDATION 槽位；safe viewport 过泛、无 owner 表。
- 影响/最小修正：写明 TER 适用性、全量文案、既有 primitive、有限 safe viewport 公式/正文滚动及 owner/surface 表。不新建 Dialog。UI 仍 UNSET，单独不是本轮 NO-GO 原因。
- Dexter：新增线框仍待确认。

### N-02：原子组缺组内编辑顺序

- 位置：详设 §9a L230–235；foundation-charter L389–397、atomic-group memory L17–18/37–39。
- 性质：仅列组，未写 producer/consumer 次序与中途错误处置。
- 最小修正：type/canonical→producer→adapter/default→composition/UI/driver→exports/docs→整组 proof；不以 fallback 求临时绿，不伪造本轮编译。
- Dexter：无需产品裁决。

## 3. 方案合理性及已核实项

目标合理；复用 A 执行核/B 供给、同 owner 单 timer、各机独立是适当路线。四处接缝造成主流程反例，修正不需要 scheduler、插件、peer 分片或第二账本。

静态确认：N/M 分钟、同 Runtime 两屏点击共享/双机独立；只同步规则不覆盖 task；当前 connection readiness；TDC 唯一 credential；CBS grant 使用 active binding/project/store/artifact 关联，未按主机 App 排除副机工件；有限 peer 摘要必要；常驻订阅先于初始化；CP→6b→动态→13c 顺序正确。Journey/IA 大体覆盖，UI 为草案；模板有标题不等于行为 PASS。

## 4. OPEN/证据边界

A/B 最终验收及当前接口、C 全部实现/类型/点击/时序/Native/pair/容量峰值/cleanup、新 UI 看图均未证明。本次 F/W/Android/DEV/P/cleanup 全 NOT_RUN；不以未运行阻断静态审查，也不声称动态 PASS。4S 修复后若仅余 UI 可 GO_WITH_UNVERIFIED_UI；产品未决须另列。

CURRENT_TASK_READ_COMPLETE=true
INDEPENDENT_FINDINGS_COMPLETE=true
AUTHOR_INTAKE_READ=false
NEXT=主 agent 辩证 intake、产品事项交 Dexter、同 cycle Round 2 定向硬停止。
