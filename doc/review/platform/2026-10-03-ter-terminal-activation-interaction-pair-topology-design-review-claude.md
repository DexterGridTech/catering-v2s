# 终端激活交互与双机拓扑优化专项 · Claude 外部静态设计评审

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_ORIGIN=DEXTER_RELAYED_EXTERNAL_REVIEW
SESSION_PROVENANCE=v2s-rooted continuation；此前参与需求整理，未编写当前五份待审设计
INTERNAL_DESIGN_CYCLE=不重开；不构成第三轮
VERDICT=NO-GO
M/S/N=0/6/1
L1_ENGINEERING=S-2/S-4/S-5/S-6
L2_USER_VISIBLE=S-1/S-2/S-3/S-6；只作静态判断
L3_UNVERIFIED=全部专项实现、V-01～V-20、Expo Web、VM/device、adapter、business、cleanup 为 NOT_RUN
TEMPLATE_COVERAGE=顶层槽位已补；逐屏内容仍有 N-1 所列缺列、遗漏与矛盾
EVIDENCE_TIER=STATIC_CURRENT_REPOSITORY_BYTES_ONLY
```

本结论针对设计缺陷，不把尚未获授权的动态运行作为设计阻断理由。未运行生成、编译、测试、verify、DEV、reset/seed、L2、UAT 或部署；只新增本评审交付物。报告是供 Codex 逐条复核的输入，不自动成为产品或实现权威。

## 1 · 输入身份、独立性与方案合理性

先从正式需求、讨论稿 §9 用户原话、终端规范与 owning source 推导预期，再核对五份设计；先形成候选问题，再阅读内部 review/intake。只读子 agent `/root/activation_external_ui_map_review` 对 26 屏进行独立事实提取，未读内部 intake；主评审重开关键位置、去重并判断严重度。该协助不是内部第三轮，也不是新的整批子 agent verdict。

| 简称 | 仓根相对路径 | 本轮 SHA-256 |
| --- | --- | --- |
| R | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md` | `43c8c0b56fe009b42512fddbf2513e339483dc7f5daafee49998c4e044c78dfb` |
| J | `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md` | `e9106f2dcb2dc1e8a12f0b2cac0e44b02aebb661a156a287895902b08e479256` |
| I | `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md` | `3244904f8be1c87f37a8ccf39257afe3137e1b9aae4b31746951f365d6ff986f` |
| U | `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md` | `d17aa25675defd95c57f9062142039b76c1511278b890a961f287d6b526b5a7f` |
| D | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md` | `1f5d3e9499d0933e7df18f86451463d8af84d2ed9bafca4426b425c8b5fa2eb9` |
| P | `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md` | `929f15a43b26a0e586bf934e0c72cd1f02ebf96f7beb571d61348c42f23666e5` |

以下简称均引用上表的精确路径，行号以本轮字节为准。已恢复 AGENTS、CLAUDE、blueprint、platform/scripts 入口、kernel 与 deterministic-context-only；六维查询使用 `review/platform/backend/frontend-platform/architecture/review`。记忆导航只定位规则，不作产品授权；适用语汇为 G-01/G-03/G-05/G-10，TER 角色由终端规范 §4-D/§4-E 定义。

**方案合理性**：两个共享 UI base 呈现包、integration 持续 selector 路由、既有 owner commands、现有 topology 同步和本地 admin，是符合当前任务的简单方向。无需新流程引擎、通用队列、恢复框架、全局仲裁或独立会员后端。问题发生在具体分支与跨机链路：当前工件并未把所有批准行为落到同一套可实施事实。下面最小修正均以修正文档、补明确链路和已有验收反例为限，不要求现在实施或执行测试。

## 2 · Findings

### S-1 · 主机壁纸页面遗漏店员登出，“退出选择”不能替代

- **性质/判据**：仓内事实及设计影响推论。R:217～222 明确两个主端工作台有店员登出，LSP 没有；原话在讨论稿 §9.1:531～532。
- **位置/证据**：U SAMPLE-07:1406、1431～1442 只有选择和确认；SAMPLE-08:1474 画退出，1486～1497 却未列该动作，1734 明确“退出只结束当前业务页”，1878 仅“结束当前选择流程”。D §3a:102～105 同样未列主端 logout。当前 `apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts:3～12` 只有 title/options/confirm；`src/components/laptop/WallpaperPicker.tsx:22～67` 也没有现成 logout。
- **影响**：按当前工件实施会漏掉已批准的登出；副机店员资格失效与路由也没有该真实动作入口。
- **最小可验收修正**：MMP/LMP 明确 staff logout 文案、真实动作节点/testId、feature→staff owner command、selector readback 和失败路径；映射 V-11/V-14。LSP 不加 logout。若“退出选择”只是取消 pending，应明确复用已批准的取消语义；不要保留没有去向的第二业务出口。
- **Dexter 裁决**：补 logout 不需要。若作者坚持新增“结束业务页”的导航任务，其去向需 Dexter 裁决。
- **同根扫描/反例**：四个壁纸 screen 全部核对；LMS 只读、LSP 无 logout 正确。会员 MMP/LMP 已有 logout，不能据此推定壁纸也覆盖。

### S-2 · 双机 LMS 被当作同 runtime，且 host pending 投影被排除

- **性质/判据**：仓内事实及可实施性推论。R:226～234 要求 LMP 有 LMS 时由 LMS 确认；`doc/platform/terminal-coding-standard.md:951～966` 明确双机 LMS 实际由 `SLAVE + VICE` 承载，内容仍为主机 MAIN/SECONDARY 投影。
- **位置/证据**：I §3:137 把 MMP/LMP/LMS 全部归“主机 runtime”；U SAMPLE-06:1343、1732 写“主机同一 runtime”，SAMPLE-09:1520 明说与 PRIMARY 同属主机 runtime。D §7:157 规定会员仅 confirmed list 投影；P CP-04:122 所需 slices 只有 member confirmed list，CP-05:139 要求 LMS 确认 host pending，140 却又规定“sync只送confirmed list”。
- **owning source**：`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:33～54` 当前 master-to-slave 同步整个含 pending 的 state；`apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts:27～31、48～74` 从 pending selector 得到顾客身份，并通过 command 决定确认/拒绝。只投影 confirmed list 不能供应双机 LMS 的待确认姓名/电话/操作身份。
- **影响**：单机双屏可工作，双机 LMS 却无法读取正确 pending 或回传确认；也可能遗漏 SLAVE renderer 准入。LSP pending 隔离并不能自动解决这个缺口。
- **最小可验收修正**：同一 LMS screen 分列单机 shared runtime 和双机 SLAVE 投影承载；列出 host pending 的必要投影及身份、LMS selector 消费、确认/拒绝明确回到 MASTER owner 的路径。host pending 投影不得覆盖 branch-local pending；沿用既有同步声明，不新增事实 owner。V-12/V-13 必须包含两实例、VICE LMS、host 与 branch 同时 pending、迟到确认的反例。
- **Dexter 裁决**：不需要，角色和确认位置已有裁决。
- **同根扫描/反例**：四个 LMS 业务 screen 核对；ACT/AUTH 已声明主机投影，可作正确对照。单机 LMS 同 runtime 是合法反例，不能将该断言扩展到双机。

### S-3 · 已激活时显式 UI command 的成功提示分支没有设计落点

- **性质/判据**：仓内事实、DESIGN_GAP。R:108～119 要求显式调用时四面都只显示“设备已激活成功”，返回路径由交互设计确定。
- **位置/证据**：J/I/U 未出现该规定文案；ACT-01～04 的入口和线框仅覆盖未激活表单/引导。D §8:169 只有 `already active呈成功`，P CP-02:64～80 未定义该分支的呈现、结束或 stage 路由关系。
- **影响**：公共 `needToActivateTerminalCommand` 的批准分支没有可实现的界面定义；普通激活成功后转登录，不能替代“已激活时显式显示”。
- **最小可验收修正**：在现有四个 ACT screen 增加状态分支即可，不要求增加四个新 screen。明确规定文案、无重复激活、显式显示与持续阶段 selector 的优先级、何时/如何返回以及断链 mask 优先级，并映射 V-02/V-10。
- **Dexter 裁决**：文案和分支无需重裁。返回方式若不能从已批准 Journey 唯一推导，应给 Dexter 最小候选；不得凭空引入自动计时或新导航任务。
- **同根扫描/反例**：四个 ACT screen 均缺该分支；其他 22 屏不承接这个 UI command。status tab 的 active 文案也不是该入口。

### S-4 · 请求前缀链与 client 禁读配置的边界仍有矛盾

- **性质/判据**：仓内事实、设计链路缺口。R:98～101 明确配置 selector provider 注入 transport adapter，client 只调用通用 transport command；R:195～205 要求 generated 后缀、通信层保留 prefix，不解析集团编码重建完整路由。
- **位置/证据**：D §3:65、§7:160 将 prefix 路径组合写成 client operation 的责任；U ACT-01:135～146 写 client 重新读生效配置，并从配置生成 groupWorkspaceKey 路径段。这与 I:136 的正确 provider 边界不一致。D §9a:205 只列现有生成链；P CP-01/02 未明确 consumer suffix policy、command 输入去集团参数和成功凭证身份来源的具体调整。
- **owning source**：`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:155～184` 当前只组 generated descriptor/pathParameters 并提交通用 transport；327～340 仍要求 payload/pending.groupWorkspaceKey；356 从 pending 写凭证集团。`src/generated/terminalApi.ts:26、33～34、63、76` 已有响应集团字段，但 request/descriptor 仍为完整 route。`contracts/policy/terminal-client-generation.json:1～19` 尚无 suffix 派生策略。这些是当前待变更事实，不是“未实施即失败”。
- **影响**：实施者需自行选择 client 直读 config、UI 拆 URL 或保留集团输入，均可能违反裁决；也无法唯一判断重试/配置变化对应的操作身份。
- **最小可验收修正**：在 CP-01/02 写清一条端到端路径：canonical full route→具名 terminal consumer suffix policy→生成 request/descriptor→client 的非配置读 command 输入→通用 transport 的 prefix/revision 消费→成功响应集团身份提交凭证。明确 client 只做后缀参数/query编码；prefix 保留由通用通信路径完成。列明现有生成器/策略/actor/adapter/fixture 同步面，以及配置变化、候选地址集团不一致、取消旧凭证身份的拒绝/复核判据，不新增业务 getter。
- **Dexter 裁决**：不需要重新裁三包职责；若方案要改变跨集团取消或改绑产品语义，才需裁决。
- **同根扫描/反例**：activation/cancel 两个 generated operation 与 TDS 凭证集团消费都受影响；后台 full route 和其他 consumer 保持完整路径是明确反例。

### S-5 · 配置持久化失败被写成回滚旧 effective config，偏离需求

- **性质/判据**：仓内事实。R:164～166 明确 command 返回不等于落盘，内存已生效但持久化失败必须准确反馈。
- **位置/证据**：D §6:140 写“持久化后topology sync apply”“失败保留旧effective config与草稿”；U ADMIN-02:515 却正确写存储失败显示 effective 与 persisted 不同。P CP-03:106 覆盖 storage failure，但没有解释这个矛盾。
- **owning source**：`apps/terminal/kernel/base/server-config/src/features/actors/serverConfigActor.ts:245～252` 先 dispatch 新配置再返回 changed；212～228、254～290 的 select/clear/restore 同族也是 owner 内存事实先变更。不能据当前代码或 command 返回推断事务式落盘回滚。
- **影响**：UI 可能显示旧服务空间/地址，实际后续请求已使用新配置；也可能为错误规格额外实现配置回滚机制。
- **最小可验收修正**：区分校验拒绝（无变化）、内存生效、持久化失败、同步失败；各自按 owner selector/readback 显示真实结果，不要求为落盘失败恢复旧内存。对 select/set/clear/restore 共用该判据，并在 V-06/V-08 指定内存有效但保存失败的反例。
- **Dexter 裁决**：不需要，沿用 R-06。
- **同根扫描/反例**：四个配置 command 均适用；校验拒绝保留旧配置是正确反例，不等于已经提交内存后的持久化失败。

### S-6 · ADMIN-02 另画全局 URL 前缀输入，缺少对应 owner fact

- **性质/判据**：仓内事实及交互可实施性推论。R:158～160、183～205 复用现有服务地址模型与 URL 前缀，不要求新建第二个配置模型。
- **位置/证据**：U ADMIN-02:467～471 同时画独立“URL 前缀”与四个地址 URL，490 登记独立 `terminal.server-config.url-prefix` 输入；515、526 却只定义 addresses[].baseUrl，明确“不另造URL/编码字段”。D §3a:89 也同时保留两类输入。
- **owning source**：`apps/terminal/kernel/base/server-config/src/types/serverConfig.ts:34～43` 的地址只有 addressName/baseUrl/timeoutMs；set override 接收地址集合，没有独立全局 prefix。
- **影响**：用户填了两个 URL 后，无法判断请求使用哪一个；实施可能引入第二事实或无法保存线框中的字段。
- **最小可验收修正**：把“URL 前缀”作为每个地址 baseUrl 的业务标签/说明，合并重复输入并同步 roster、依赖图、字段矩阵、D §3a；或者说明它与哪个同一字段绑定及如何避免两个输入冲突。推荐前者，复用现有模型，不增加配置 fact。
- **Dexter 裁决**：按现有地址模型消除重复不需要。只有坚持新增独立全局前缀才需产品裁决。
- **同根扫描/反例**：ADMIN-02 是唯一配置编辑 screen；ADMIN-03 只读地址列表，不需要额外 mutation。多个候选地址各有完整前缀是合法模型。

### N-1 · 逐屏表格、命令分母与 testId 提案仍有可合并修正的漂移

- **性质/证据**：仓内事实，文档一致性 note，不另要求新机制。U 全 26 个 mutation 矩阵采用六列（首例142、末例1664），缺模板 `doc/decisions/templates/ui-interaction-design-template.md:274～276` 的“用户可见文案/控件”“冲突/失败恢复”。AUTH-01/02:802、861 的输入依赖图漏口令，roster:792、851 却有。SAMPLE-01/02:1023、1097 的新增 ID 为 `member-form:add`，全局 roster:1727 和当前 `apps/terminal/ui/feature/sample-member-desk/src/components/laptop/MemberList.tsx:37` 为 `member-list:add`；1038、1112 漏 memberFormOpenedCommand，LSP:1200 已列。SAMPLE-10:1594～1595 用 host picker ID，而 U:1736/D:105 为 branch 提案。D §11:270～291 声明七列，场景行 businessOracle 和 cleanup 内容未分入独立单元格。
- **影响**：模板不能宣称完整；实施/自动化节点和失败语义会依阅读位置得到不同答案。不能据此要求现在绑定或运行节点。
- **最小修正**：统一文档的唯一 ID/真实 command 分母；补漏控件与规定列；只读页写 N/A；分开 oracle/cleanup 单元格。不新建语义 checker，不复制第二份事实。
- **Dexter 裁决**：不需要。
- **同根范围**：全部 26 screen 表列、两个登录 screen、两个主机会员 screen、四个壁纸 screen、20 条验收表行；上述之外未把单纯用词变化单列 finding。

## 3 · 已核实事实、模板覆盖与未验证

**静态已核实**：26 个 screen 与 26 个 IA-ID 一一对应；ACT 四面、ADMIN 七面、AUTH 四面、SAMPLE 十面、MASK 一面没有缺号或重复。两个新包当前统一放 ui/base，未再要求对它们套用只接受 ui.feature 的 feature assembly。主副机不新增 TDS 身份、credential 不同步、副机配置/取消只读、代理密码明文同步且不回显、LSP 独立页面、本地 admin 高于业务 mask 的目标均有文字判据；这仅证明目标表达，不证明实现。

**旧 finding 复核**：J:55～65 已补 corpus 命中、冲突与不得推导；U:32～81 的 canonical §1.1/§1.2 已补 26 屏索引与后台不适用理由。U:1734 和 D:103 的 SAMPLE-08 当前 picker 交叉引用均指 SAMPLE-07，与 title/options/confirm owning TestIds 源相符。该修复不关闭 S-1 的 logout 缺项。内部 R2 checklist 的 J/I/U/D hash 与本轮不同，P hash 相同；R2 NO-GO 只对当时字节，不被改写成当前 GO。

| 模板 | 逐节静态覆盖 | 内容结论 |
| --- | --- | --- |
| Journey | 元数据、用户任务、逐 actor 前提、序列、边界、corpus、UI适用性/后台 N/A、Dexter裁决均有 | 已补 §5；显式已激活入口需 S-3 补充 |
| IA | §1、§2 可见/不可见维度、容器、§3共用规则、§4错误、§5对账、§6完成判定均有 | 26行存在；S-2/S-6 表示内容未闭合，不能以有列等同 PASS |
| UI | metadata、Interaction map、§1.1/1.2、Heritage盘点、26线框、roster、状态/任务合理性、face/owner、manifest适用性、高保真 N/A、看图结论均有 | 逐屏 mutation 两列缺失、输入和分母漏项见 N-1；S-1/S-3 是真实行为缺口 |
| 详设 | §0～§14、§3a、§9a/9b、§10b各子槽、§11a、CP/6b/13c安排均有 | 无新增PG/seed/L2有理由；§6/7存在 S-2/S-4/S-5，非模板存在即可通过 |

**验收设计**：R-01～R-16 与 V-01～V-20 均有映射行；计划 P:183～192、211 明确 CP→全批6b→整体动态→13c→implementation review，无整体验收回流 CP-06 的循环。D §11a 的 V-12/V-17/V-18 行只写 focused/VM，但 P:189、D:316 已有所有非 adapter 行为 Web→同场景VM 的统一要求：不将局部缩写误报为允许跳过 Web。建议映射行引用统一规则即可。以上六项 S 的修复仍需进入相应场景的具体业务断言，行号齐全不代表验收闭包正确。

**数值与第三方**：24 mounted 窗口有现成 `apps/terminal/ui/base/primitives/src/components/PrimitiveData.tsx:20` 来源，不是会员总量 cap；四地址上界和四壁纸目录均来自现有模型。yarn.lock 的 Expo57.0.18、RN0.86.3、RN-web0.21.2 与 D:70 的版本记录相符。本轮不声称第三方运行行为已验证；没有执行解析命令或官方行为实验。若实施改变网络/列表/焦点语义，必须在采用点按官方精确版本依据补证，不把“已有封装”当作新行为的豁免。

**DESIGN_GAPS**：已激活显式入口的返回/优先级（S-3）、双机 LMS host pending 投影/确认闭包（S-2）、前缀生成与执行分工（S-4）、配置失败结果及重复 URL 输入（S-5/S-6）。这些缺口已有需求判据，不需要新增架构。

**未验证**：所有26屏渲染、触摸/键盘焦点、软键盘与输入穿透、admin离线本地恢复、owner拒绝、credential隔离、代理实际HTTP、持久化重启、current-peer readiness、两端并发及四拓扑 Web/VM 对照、V-01～V-20 business/cleanup 均 NOT_RUN。现有旧源码/测试只证明可复用入口，不能升级为专项当前 PASS。Browser L2=N/A_WITH_REASON；DEV/reset/seed/UAT/deploy 不在授权内。没有要求补生产容量、HA或专项外测试。

## 4 · 结论与后续边界

**NO-GO，M/S/N=0/6/1。** 整体方向合理；六项 S 需要在现有五份设计之间做最小一致修正。Codex 应逐条重开原始材料，按 CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION 处置，并比较更小方案。这里没有源码实施或动态授权，不重开已结束的两轮内部 cycle。文档返回路径或新增导航只有确属产品选择时交 Dexter，其余已裁决边界不需重复讨论。
