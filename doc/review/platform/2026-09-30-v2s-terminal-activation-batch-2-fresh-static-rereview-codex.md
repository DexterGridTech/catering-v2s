# 批次二详设与实施计划 fresh 独立静态复评

日期：2026-09-30。评审身份：Codex 承接 Dexter 指派的 Claude 复评角色；文件按产物归属使用 `-codex`。本稿由主会话唯一写入。范围仅为当前批次二详设与实施计划；不重开已经关闭的作者 DESIGN cycle，不沿用其轮次上限或 SELF_DECIDED 结论。

## 1. 结论与证据边界

```text
REVIEW_TARGET=DESIGN
REVIEW_SCOPE=DEXTER_RELAYED_CLAUDE_BATCH_2_DESIGN_AND_PLAN
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/2/2
L1_ENGINEERING=S-1 阶段依赖环；S-2 生成源链遗漏；N-1/N-2 残余矛盾
L2_USER_VISIBLE=本批无新增操作界面；V-T17 既有只读状态显示仅有计划，未验证
L3_UNVERIFIED=readiness/drain、HTTP兼容、代理/压缩、Node隔离、reset、设备闭集生成、DEV切换与cleanup均未执行
SAME_ROOT_SCAN=各 finding 见第3节，覆盖两份目标文档及对应 owning source
DESIGN_GAPS=两项已有判据的计划缺口；无新产品判据或新增 Dexter 待决项
TEMPLATE_COVERAGE=四份模板逐节见第5节；有章节不等于内容正确
EVIDENCE_TIER=STATIC_DOCUMENT_AND_SOURCE_REVIEW + OFFICIAL_VERSIONED_SOURCE_LOOKUP
```

`NO-GO` 来自具体设计/执行问题，不能被未验证 UI 的 `GO_WITH_UNVERIFIED_UI` 降低；未验证清单完整保留。没有运行生成、编译、测试、门、Node/Vitest 验证、backend-acceptance、DEV、Testcontainers、reset、seed、L2、UAT 或部署。只读上下文查询、文本检索和官方来源查阅不是这些验证的 PASS。

本次三包核心方案合理：client 拥有终端身份、HTTP业务判定、TDS业务协议/心跳/RTT与三个状态 selector；server-config 拥有地址和既有可选代理配置；transport 提供通用通信可靠性与切换。代理密码和终端凭证是不同秘密：前者留在 server-config secure owner，后者只在 client；composition 将配置 provider 注入 transport network adapter，公开 selector 不暴露密码。这一方案不需要恢复直接 owner 依赖、通用事件总线或自写代理/PMD。

## 2. 输入与独立性

原始输入先于历史：AGENTS、CLAUDE、PLATFORM-BLUEPRINT、platform README、scripts README；review/third-party/terminal/implementation-task 标准；四份 `doc/decisions/templates/` 模板；独立审查治理；需求、Journey、service-shape decision、共享协议及当前详设/计划。六维路由为 `review/platform/backend/platform/architecture/review`，命中33份原文（包括六 kernel），另重开 deterministic-context 与 verification-governance 的适用原文。代码影响面通过 `rg` 与 owning source 核查。

先形成判断，再读取 owner-boundary review/reconciliation、Claude 原评审/补充及 r1/r2。历史结论、作者处置表与自查不作为当前正确性的证明。只读 fresh reviewer `/root/batch2_fresh_design` 负责全批独立复评，已完成并返回 NO-GO 0/2/2；`/root/batch2_execution_surface` 已完成 readiness/acceptance/fixture/reset 等执行面专项，只返回 finding 输入，不代替全批 verdict。主会话重开每条 owning source 后汇总。主会话提出的攻击入口已供 reviewer 独立核验，故不宣称双方彼此完全隔离。本稿为便于先看执行阻断，将独立报告的两条S次序调换，未改其性质或重复计数。

独立 reviewer 实读范围：入口与标准/四模板全文；原需求适用正文§0～10、§12～13（§11历史不作为当前需求权威）；Journey、service-shape、protocol全文；当前详设/计划全文；33路由原文；适用owning source；指定六份历史评审。长输出截断后以分段重开补齐，不将截断输出记为已读全文。33-ref路径+SHA集合绑定为 `2c56cd46a6d2d70bb98d0224aa632a22da8addd7d4bf9668620030254edf9431`；定义为query refs路径排序后逐文件shasum输出，再对完整输出做SHA-256。无测试执行与子agent文件写入。

目标字节 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md` | `ee7343150116fc01182d8751c848fff31895ac69f2df7b988f592fbee7f0686d` |
| `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md` | `e3cc186322cc2e41526aa2036cc530b812aa491c1c764862962e1216ceaa8339` |

## 3. Findings

以下简称 D/P 分别为上表完整仓库相对路径；每条定位均指当前字节。四条均为 `CONFIRMED`，不把静态反例称为已经发生的运行故障。severity 为评审建议，接受度由 Dexter 决定。

### S-1：首次整体动态验收与 CP-06 退出构成依赖环

- **位置**：P:153、160、168、169；D:88、202、483。同根还有 P:69、71、219。
- **性质/依据**：执行顺序缺口。`doc/platform/implementation-task-template.md:209` 与 `doc/decisions/templates/implementation-design-template.md:338,340` 要求完整实施阶段对账后、整体测试前做新全批6b。
- **证据**：计划要求 CP-01..06 全部 MATCHED → 6b → 首次 V-S15；CP-06 又包含全部动态验收，退出要求实际动态结果、cleanup PASS、6b以及最终实施 review。这些前置条件无法按文字同时满足。
- **影响**：首次动态验收没有合法进入路径。把 CP-06 临时解释成“仅准备”也与明确退出条件冲突。
- **最小可验收修正**：明确所有实现、测试/runner代码与 focused proof 在首次全批6b前完成，并完成对应阶段对账；随后6b → 动态验收 → 13c/实施 review/交付。可将 CP-01..05 定义为实现阶段、CP-06 定义为其后验收收口；若 CP-06 尚含代码准备，必须把该准备明确排到首次6b前。同步总览、退出条件、动态准入与完成定义；保留原子交付，不拆成独立交付批次。
- **同根与反例**：上述阶段总览、CP-06、6b、动态入口、最终定义均已核对；focused proof 可以在所属实现阶段进行，不应误禁所有阶段测试。问题是整体动态验收与阶段退出相互等待。
- **Dexter 产品裁决**：不需要；按现有阶段/测试前对账规则消除循环。

### S-2：CP-01 将派生 schema 当成修改源，漏掉 materialize 链

- **位置**：P:82（修改全集），D:135、218、222及§9a生成链描述。
- **性质/依据**：唯一生成源与全链同步缺口。`doc/decisions/templates/implementation-design-template.md:212,215-217` 与 `project-memory/pitfalls/generated-output-and-static-gate-drift.md:16-18` 要求先改 owning schema/catalog/override，再 materialize/codegen，不手改生成物。
- **证据**：P:82直接列 `contracts/openapi/components/terminal-binding/terminal-binding.schemas.json`，随后 edge-codegen。实际源为 `contracts/openapi-source/terminal-binding.schemas.json:4,6,32,34`，登记在 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:98-99`。`scripts/generate/r5-edge-materialize.mjs:357-363` 从源 baseline 克隆，`:388` 支持已有 `componentOverrides.additionalProperties`，`:486` 写 component 输出，`:504-505` 重物化并比较生成结果。两份目标文档未列该 canonical 输入或 materialize 步骤。
- **影响**：按“修改全集”执行，下一次物化会恢复源定义或报生成漂移；两个 DTO 的局部测试即使通过，也不能证明 canonical 链已接受 R-15.7。
- **最小可验收修正**：选择现有 catalog 的两个精确 component override，或修改仓内 canonical source并同步登记hash；明确 canonical → r5-edge-materialize → edge-codegen → TER生成/三方对账链。列全源、派生产物及当前链检查；两种终端请求允许 unknown，运营后台请求仍严格。无需新造生成框架；本轮不执行这些步骤。
- **同根与反例**：TerminalActivationRequest、TerminalActivationCancellationRequest 两个目标及 OperationsTerminalActivationCancellationRequest 反例已核对；其余非terminal DTO应保持严格。详设CP-01、operation、跨owner描述与全链同步表一并修正，不能只改P:82。
- **Dexter 产品裁决**：不需要；需求 R-15.7 已明确。

### N-1：§6 仍写 client 消费配置快照

- **位置**：D:222；相反的明确判据在 D:157、275 与 P:109。
- **性质/证据**：残余职责措辞。§6仍称 client“只消费按 package API 注入的有效网络快照”；已修正的CP-03/API表要求快照/provider进入transport network adapter，client不接收snapshot/selector。
- **影响**：核心依赖图已清楚，但全文不能声称无歧义；实现者仍可能让client消费server-config配置快照。
- **最小可验收修正**：将§6同步为 composition → transport network adapter/provider，client仅调用通用transport command。P:109的“不直接import两个owner”也应具体写明禁止server-config selector/state/persistence，允许transport public API，避免禁止自身或合法依赖的另一种解释。无需新增接口层。
- **同根与反例**：已搜索两文 selector/snapshot/provider 注入描述，CP-03和§9明确的正确路径应保留；一处残余不能推成已实现的owner违规。
- **Dexter 产品裁决**：不需要，现有裁决已明确。

### N-2：总顺序仍要求空分母 admission 与无条件 seed 准入

- **位置**：D:202、P:220；相反条款 D:128、467、499 与 P:154、156、170。
- **性质/证据**：程序性措辞未同步。当前§3a为N/A且不扩旧L2 control plane；总顺序/完成定义仍要求“§3a空分母”准入及所有整体动态运行前的seed dry-run/四项记录。
- **影响**：可被误读成恢复已删除的空分母门，或阻断本可独立执行的 backend-acceptance。具体准入表已经收窄，故按N处理；不与S-1阶段依赖环重复计数。
- **最小可验收修正**：总述同步§3a N/A；backend-acceptance不依赖虚构空分母或DEV seed。只有未来确实获授权reset/seed/L2时适用其真实准入条件；保留6b、资源、安全与cleanup条件。
- **同根与反例**：两文全部空分母/admission/seed dry-run段已核对；P:156/170的条件式条款是正确边界，不能删除真实reset/seed准入。
- **Dexter 产品裁决**：不需要，未扩产品范围。

## 4. 原 12S/6N 的当前处置核查

本表是当前静态设计状态，不是对作者“已关闭”的照抄，也不是实施/动态CLOSED。

| 原编号 | 当前原文落点/核验 | 当前状态 |
|---|---|---|
| S-1 来源漂移 | D:44/135登记Journey凭证owner、reset、多实例边界及错引；不再重复等待裁决 | 静态已补，Journey正本未改；无修改授权 |
| S-2 V-S9 | D:178/182/373：wait期旧PONG、新SESSION_READY/登记，期满拒新再drain；V-S15独立CONTRACT | 判据已补；执行顺序另见新S-1；未跑 |
| S-3 默认nodeId | D:183/372：独立unset运行、真实HTTP fixture、SESSION_READY和DB双读回 | 静态已补；非默认V-S15不能代替；未跑 |
| S-4 V-B15 fixture | D:193/371：acceptance helper建数，数组/嵌套/1KiB、known-invalid及后台反例 | fixture设计已补；生成源遗漏见新S-2；未跑 |
| S-5 设备形态/复原 | D:191、P:141：匹配实物形态，取消激活/读回每个被触及fixture；业务复原与资源cleanup分开 | 静态已补；未跑 |
| S-6 设备闭集 | D:163、P:114：laptop/mobile owning类型与generated双向相等，两侧新增值各变红 | 静态已补；无第三枚举；未生成/测试 |
| S-7 TER生成闭包 | D:135/457/462：face↔policy/producer↔TER产物精确三方；generated词汇同步 | 静态已补；canonical链仍缺，新S-2 |
| S-8 retry阶段 | D:161、P:113-114：handshake失败与socket已开但业务未ready分别处理，业务协议由client判断 | 静态已补；未跑 |
| S-9 代理秘密 | D:166：owner secure/hydrated唯一住址，adapter短暂内部使用；不绕过owner读持久库 | 静态已补；日志阴性/重启/代理未跑 |
| S-10 压缩上界 | D:120/166：standalone dispatcher显式65,536，直连/代理/分片路径；旧“默认无限”不成立 | 官方tag支持方案，当前并未引入8.11.2；未跑 |
| S-11 Node加载/隔离 | D:192、P:140：Vitest/Vite独立acceptance include，父mjs不直接import TS；同进程两套真实composition | 静态已补；隔离与实际工具兼容未跑 |
| S-12 三包职责 | D:157/166/275及P:109：client command/协议/三selector闭包；composition→adapter | 核心已补；仍有新N-1残余 |
| N-1 旧L2扩面 | D:128、P:82/154不改旧controlPlaneFiles与action分母 | 主体已收窄；新N-2残余 |
| N-2 Actuator | D:177/190、P:127/139：用户入口精确`/actuator`与子树403，loopback readiness200 | 静态已补；未跑 |
| N-3 Node固定版本 | D:120采用>=22.19.0并记录实际精确运行版本 | 静态已补；不据engine推断任意版本已验证 |
| N-4 standalone路径 | D:54/120明确R-16允许替代，bundled与standalone分开 | 静态已补；实际解析/兼容未验证 |
| N-5 当前TDS | CP-04/05以当前原生Reactor Netty/Netty压缩实现为基线 | 不再把旧手写PMD清理当未来工作；未运行 |
| N-6 TR-09 | D:136、P:99明确新增server-config精确保留；凭证/其他owner/orphan排除，失败不重启 | 静态已补；规范当前未改，reset未跑 |

原Claude补充与原文中的重叠项按上表判据重新核验，不预设成立/关闭。作者r1/r2及SELF_DECIDED记录仅解释修订来源；不能充当最终字节独立GO。本次也不重开那个cycle。

## 5. 方案合理性与模板覆盖

三实例/双HAProxy是已裁定的受管部署验证；共享DB、唯一nodeId不授权跨节点takeover/topic/Doris。readiness只用Actuator，业务未ready由client判定，通信重试由transport执行，符合职责分配。闭集CONTRACT selector用于解除现有`operation=all`限制，不把TDS场景加入BUSINESS catalog。独立standalone Undici与隔离的Vitest acceptance驱动复用现有库/加载链，优于自写代理、WebSocket或在普通单测入口触发DEV。当前无需额外产品裁决。

| 模板 | 逐节判定 |
|---|---|
| implementation-design | §0有；§1有方案比较；§2有但S-1；§3/第三方有；§3a N/A有理由但N-2；§4有但S-1/S-2；§5有；§6有且Java跨owner写N/A，但N-1；§7有；§8有；§9有；§9a有表但唯一源遗漏S-2；§9b有；§10无DB迁移，TER持久/reset有；§10b及10b.1–.6无新增seed，既有fixture/父流程/角色与条件有；§11/11a有逐项判据与执行面；§12有；§13有；§13b有但S-1；§13c有；§14有。 |
| journey-decision | §1元数据、§2目标、§3actor前提、§4边界、§5corpus、§6UI适用性、§7裁决为已有Journey及需求来源；本批不新裁决Journey。§6.1管理后台交互对本批新动作N/A。旧Journey与当前裁决的漂移已登记，不假称正本已同步。 |
| ia-design | §1、§2.1/2.2、§3、§4、§5、§6：本批无新IA-ID、screen或操作，N/A；既有V-T17三行只读投影仍须Web实际观察。非UI状态/失败/恢复判据在实施详设，不据IA N/A豁免。 |
| ui-interaction-design | §1/1.1/1.2、§2、§3、§4（含控件/表单/候选子项）、§5、§6、§7、§8、§9、§10：无新增UI/控件/高保真/看图裁决，N/A；不扩旧L2动作或退役Manifest控制面。V-T17沿既有页面观察，未称已渲染。 |

这里的设计缺口是已有规则下的生成链与执行时序不完整；没有发现必须在正本新设产品判据的问题。最小修正属于两份目标文件同步，不要求重做整批§13c或追加框架。

## 6. 已核实与未核实

**已核实事实**：三包核心职责、代理秘密owner、retry分阶段、wait/drain判据、默认节点独立证据设计、设备闭集/生成三方要求、Node隔离计划、Actuator入口拒绝及TR-09拟新增范围都有明确落点。当前源码的acceptance factory原先只在all运行V-S9，计划明确新增闭集通道；这是待实施工作，不能据旧实现反报本设计没有通道。

官方精确 `undici@8.11.2` 源码支持dispatcher WebSocket参数传递及显式上界方案；默认值为128MiB而非无限。代理路径继承该dispatcher参数，解压超限和累计分片超限在业务message交付前失败并使用1009。该事实不等于当前仓已解析或运行8.11.2，也不等于系统总内存精确封顶65,536字节。[DispatcherBase](https://github.com/nodejs/undici/blob/v8.11.2/lib/dispatcher/dispatcher-base.js)、[ProxyAgent](https://github.com/nodejs/undici/blob/v8.11.2/lib/dispatcher/proxy-agent.js)、[PMD inflater](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/permessage-deflate.js)、[receiver](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/receiver.js)。

**计划中的证据**：V-T/V-B/V-S/V-E/V-G的focused、生成、真实HTTP/WS、Expo Web、DEV与cleanup输出；CP阶段MATCHED、全批6b、13c及IMPLEMENTATION review。它们均未实际通过。

**未核实项目**：standalone8.11.2实际package/lock解析、受管Node/Vitest实际兼容、Boot/Actuator精确artifact与装配行为、HAProxy镜像digest和摘流时间；65,536直连/代理/压缩/分片实际结果；4秒wait期新旧会话、8秒drain/14秒总界；默认nodeId写回；两个请求unknown兼容及后台严格反例；reset保留/失败恢复；多composition隔离；三节点/双入口真实切换；V-T17可见状态；业务fixture复原及所有资源cleanup。当前没有L2/Android/设备业务证据，也不要求本轮补跑。

静态评审没有启动资源，`BUSINESS/CLEANUP=NOT_APPLICABLE_TO_STATIC_REVIEW`。本结论不授权修订需求/Journey/decision、源码/依赖/锁、生成、任何验证执行或批次三。
