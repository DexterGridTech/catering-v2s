# TER 版本更新阶段 C · 整批实施结果 review

日期：2026-10-11。结论：**NO-GO，M/S/N=0/4/3**。

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=STAGE_C_WHOLE_IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/4/3
L1_ENGINEERING=findings S-1、S-2、S-4；N-1、N-2、N-3
L2_USER_VISIBLE=findings S-3；指定主流程有归档业务证明，但不是所有正常分支的通过证明
L3_UNVERIFIED=两组配对 run 的 SLAVE runtime 结束诊断不可用；归档运行不能自动覆盖全部当前源码；生产/UAT/长期容量未执行
SAME_ROOT_SCAN=见各 finding 与第 6 节
DESIGN_GAPS=规则首订阅原始时间来源；actual.unknownReason 的旧 UI 字典；保留旧 case 的去留
TEMPLATE_COVERAGE=NOT_APPLICABLE_IMPLEMENTATION
EVIDENCE_TIER=当前源码静态核验 + 指定受管 run 范围内的归档业务/cleanup/诊断证据
```

已有确定源码缺陷，因此判 NO-GO；不会因剩余未验证项而把它改成 GO_WITH_UNVERIFIED_UI。本结论不是对 CP/6b 的重新盖章，不宣称当前所有字节 MATCHED，也不替代 13c。本次没有运行测试、生成、构建、verify、DEV、设备、reset/seed、L2 或 UAT。

## 1. 输入、独立性与方法

先从正式需求、C 详设/计划及 Journey/IA/UI 推导职责与行为，再检查 owning source、消费者与直接测试，最后读指定归档。CP/6b、作者记录与既往 verdict 只用于定位，不作为本轮独立证明。

主会话是续接会话，且参与过设计维护，不是 fresh reviewer。按仓规另使用三个新建、无历史继承的只读子 agent，分别审查数据/凭证、更新执行/Runtime/Android、CBS 报告/后台/测试调用链；它们先读最小判据与源码，再作证伪判断。三个分工结果经主 agent 重开 owning source、去重并排除未确认推论后形成本文。子 agent 不写文件、不执行测试或动态操作；本次仅主 agent 写评审及 Dexter 明确授权的远控详设/计划。

主要判据：

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`，尤其 R-06～R-15 及阶段划分。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`，§8.1～§8.8、§9a、§11。
- 同前缀 `implementation-plan-claude.md`、`source-and-api-appendix-claude.md`。
- `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-{journey,ia,ui-interaction}-claude.md`。
- TER/前端规范、deterministic-context-only 及相关 owner/失败处置记忆。

定位当前字节的 SHA-256（只绑定所列文件，不冒充全仓字节冻结）：

| 文件 | SHA-256 |
| --- | --- |
| C implementation-design | `dd835fd162df86e989e0de46d9fb66132c3a1bbd6390cf804b62028b9c88b3af` |
| C implementation-plan | `8bc8a02d97738169862f36eddf13e886220ec8db89dcdfe586e77cb405cec202` |
| integration-assembly/createBrowserTransportNetworkAdapter.ts | `29a304b75b3c2d0f746389ce8f33bd66725423f369d3949e81c65e337dd381e3` |
| terminal-update/terminalUpdateActor.ts | `29a5a49f2d7d519d57a73b4a4f0e940bfa6282dcd9829b0dccf52adcc794a952` |
| project-basic/selectors.ts | `621b18b1fa4366361c6053d53f57682c39ffb1c9e5a48eedb9df16f131a43436` |
| update.android.test.ts | `9ca26c66f040e40c8431b2d7809651aa1495d9c0b39dbe29964b002d5d2b63aa` |
| terminal-automation/runner.ts | `4b8e1bd19094a5572f195b7858d4aef00feb39fff2e197e10bd655eb68366a6e` |

## 2. 从代码提取的业务与可见事实

| 用户任务/事实 | 当前实现路径 | 独立判断 |
| --- | --- | --- |
| 门店先获取，项目与门店后续分别加载 | store loaded command → Runtime local fan-out → store-basic 自身后续与 project-basic listener | 职责分开，不等待项目成功才加载合同/服务点；hydrated 旧值不作为本周期成功 |
| 项目规则是业务资料 | project-basic 持有组织路径/完整规则快照，按本 App、门店筛选和创建时间排序，向 terminal-update 发候选 command | 不是由 base/update 再维护一份实时规则；两 assembly 只提供公开读接缝 |
| 当前值复核后固定一条任务 | update actor 读 actual、资格与候选，固定 policy/工件；任务及执行 boot 本机持久化 | 已固定后不因规则新旧重新选目标；但副机断链接缝有 S-2 |
| 主副机共享凭证而职责不同 | TDC credential 投影/明文持久化；SLAVE 普通 CBS HTTP；MASTER 才 TDS/topic/报告 | 没有恢复 MASTER 逐次 grant 中转；共享 credential 不等于副机独立激活或 TDS 在线 |
| 单机双屏只在本机 PRIMARY 安装邀请 | Runtime presentation/interaction → update owner → Android installer/HOT | 安装与状态事实仍在 base/adapter，未移到 integration 业务路由 |
| 运营右 Tab 查询终端版本与报告 | ProjectTerminalUpdatePage 标准查询/列表/Drawer/cursor；实际 APK/JS/runtime、最近状态/原因、任务历史 | 不是新增运维报告页；actual 未知原因缺失，见 S-3 |
| 报告可从 receipt 找到历史行 | HTTP owner 写 terminal_report → operations page/detail/history → Journey 按 taskId 查页并读 UI | 不是仅看 HTTP 成功；任务唯一性诊断措辞仍需 N-3 收敛 |

本轮不以“符合详设”豁免方案合理性。当前业务目标确实是：CBS 管理普通更新供给与规则，主副机分别执行自己的 APK/JS 更新，运营查看主机真实版本与历次任务。主要链路已经形成，没有必要再建立任务框架、第二账本、MASTER grant relay 或独立 pair runner。下面四项均可在现有 owner/adapter/driver 内修复。

## 3. 阻断 findings

### S-1 · Web HTTP 把正常规则页错误限制为 WebSocket 的 64 KiB

- **性质/处置：** 当前源码事实，CONFIRMED；普通规模反例，不是恶意归档输入。
- **判据：** C 详设 §8.1，L198：decoded HTTP 单页 1,048,576 字节、快照 8,388,608 字节；WS 65,536 独立适用。
- **位置：** `apps/terminal/ui/base/integration-assembly/src/foundations/createBrowserTransportNetworkAdapter.ts:17–42` 的 reader 有界读取，但 L141 传入 `65_536`；L149–153 返回 `BROWSER_HTTP_RESPONSE_TOO_LARGE`。两个实际 assembly 使用它：console `src/assembly/assembly.tsx:175–180`、wallpaper `:162–167`。`project-basic/src/features/actors/actors.ts:523–542` 先收到网络错误，自己的 1 MiB 页面检查无法补救。
- **反例：** 50 条合法规则各含 500 个汉字说明，说明正文即约 75 KiB，仍远低于 1 MiB 页面预算。Web 拒绝完整快照，Android 可接收；没有越过规则业务范围。
- **影响：** 常见项目资料规模增加后 Web 首次/刷新规则失败，TR-16 两端行为不同；不能通过增加 owner 的上界或分 App 剪裁修复。
- **最小修正：** 共享浏览器 HTTP reader 使用设计的 1 MiB decoded 上界，保留取消 reader 和明确超界错误。直接测试改为证明 `64 KiB < body ≤ 1 MiB` 成功及 `1 MiB+1` 拒绝；不能调大 WS 上限。`integration-assembly/test/createBrowserTransportNetworkAdapter.test.ts:78–111` 当前把 65,537 拒绝当正确，应同步。
- **同根：** 两 assembly、Web reader、Android `TerminalNetworkModule.kt:37,41–52,241–243` 均核对；Android 已用 1 MiB。TDC `acceptance/operationsFixture.ts:83–84` 的 HTTP/WS 两个限值也要分别读回；不把 WS 改大。
- **Dexter 裁决：** 不需要，已有明确边界。

### S-2 · 已固定的副机任务仍被当前配对投影 readiness 阻断

- **性质/处置：** 当前调用链事实及可推导普通反例，CONFIRMED。
- **判据：** C §8.6.3 L329：普通配对断链不阻止 fixed 任务持有效 credential 直连 CBS；新候选仍须当前投影就绪。
- **位置：** `project-basic/src/selectors/selectors.ts:96–103,161–166` 令 SLAVE context 依赖 `selectTopologyRequiredProjectionsReady`；`topology/src/selectors/selectTopologyState.ts:21` 在 peer 不可达时返回 false。两个 assembly 将它绑定为 update 当前 context：console L203、wallpaper L190。`terminal-update/src/features/actors/terminalUpdateActor.ts:1168–1184` 在已固定任务 prepare 前读此 context，null 即延后；L1211–1227 在 grant await 后再次使用同一条件。`project-basic/src/features/actors/actors.ts:602` 的恢复入口也先因 context=null 返回。
- **反例：** SLAVE 已固定任务且已持久化共享 credential，FULL 成功换 boot 后还需取得 HOT。此时 MASTER 停机或普通配对断链，空间/门店/项目、绑定资格未变，但 context=null，后续 HOT 工件无法获取。grant 请求等待期间断链也能触发同根拒绝。
- **影响：** 已接受任务不能按批准规则执行到底；区别于无投影时拒绝新规则，也区别于显式解绑必须清 credential。
- **最小修正：** 区分“新候选资格”与“fixed 来源身份”。沿固定任务保存的来源，结合当前 TDC credential、角色与网络身份复核；普通 peer readiness 不应成为 fixed 来源资格。覆盖两个 grant 检查点及 feature 的 fixed 恢复桥；显式解绑/换 binding/换来源仍拒绝。无需新缓存、恢复队列或 fallback。
- **直接测试：** `terminal-update/test/terminalUpdate.test.ts:3289,3343,3422` 使用可控 context mock；不能反驳真实 assembly 的 `peerReachable=false + credentialReady + fixed` 组合。
- **同根：** 两 App 接线及 grant 前/后、恢复桥均核对；已 prepared HOT、已存在 native installer session 不受上述远程获取门影响，不夸大成所有更新均停止。
- **Dexter 裁决：** 不需要。

### S-3 · 实际版本读取失败的原因未呈现在运营报告中

- **性质/处置：** 当前渲染事实，CONFIRMED。
- **判据：** 正式需求 R-15 L230：“读取失败明确未知及原因”；C IA §5 继承既有 B 报告详情。B UI 工件 L177、L413 已要求实际未知原因。
- **位置：** `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:675–695` 仅提取 actual 版本和 recent 任务原因；L1001–1016 最新详情、L1033–1035 历史 actual 只有版本，未使用 `actual.unknownReason`。canonical `contracts/openapi-source/terminal-update.schemas.json:936–938` 有有限 unknownReason；`TerminalUpdateReportController.java:121` 保留该事实。
- **反例：** 原生 actual 读回不可用时，CBS 已保存 `READBACK_UNAVAILABLE`，页面仍仅显示“未知”，最近任务原因甚至可以为“无”。操作者无法知道未知来自读回失败、未安装或身份不符。
- **影响：** 已定义的升级报告不能正确帮助运维判断实际安装状态；任务失败原因不能替代 actual 读取原因。
- **最小修正：** 使用 canonical 当前有限闭集定义一个中文 formatter，在最新详情和历史 actual 展示未知原因，配对应 render focused。列表可保持简要未知；不新增 operation、数据库字段或状态历史。
- **同根：** 列表、最新详情、历史三处已核对；后两处需明确原因，列表可把说明留在详情。服务端/生成物已有事实，无须改报告提交机制。
- **Dexter 裁决：** 不需要。旧 B UI 原因字典与当前 canonical 的差异另见 DESIGN_GAPS，不在本轮擅改 B 文档。

### S-4 · Android 结束诊断读取失败被吞掉，父 runner 仍可返回成功

- **性质/处置：** 当前源码事实，且指定归档含实际信号，CONFIRMED；不把该信号改写为业务失败。
- **判据：** C §8.8 L351、计划 L112：结束日志读失败单列 diagnostics FAIL、runner 非零，business/cleanup 各自保留。
- **位置：** `tools/terminal-automation/journeys/update.android.test.ts:1481–1489,1508–1516` 的两个 catch 只写 `LOG_NOT_AVAILABLE`，不汇总或传出诊断失败；`tools/terminal-automation/src/runner.ts:1483–1492,1516–1526` 最终只检查 suite/business、cleanup、managed DEV diagnostics，未包含 Android 来源。
- **归档反例：** `039c9a27-…/runner.log:2463` 与 `928cfaa0-…/runner.log:2727` 均为 PAIR_SLAVE runtime `LOG_NOT_AVAILABLE`、`OUTPUT_LIMIT`，各自 manifest 仍记录 business/cleanup PASS。
- **影响：** 主副两端诊断闭包没有完成，但父 run 成功摘要不反映它；这不能用于宣布完整诊断成功，也不能推翻实际业务断言和资源 cleanup。
- **最小修正：** 四个 Android 来源（MASTER/SLAVE × runtime/native-update）结果经既有结构化边界交父 runner 聚合，单列 diagnostics 失败并进入最终退出条件；cleanup 必须继续，不用 afterAll 抛错污染 business。`androidDevice.ts:219–241,399–420` 在安全投影前捕获整份 pid 日志触及 2 MiB，可在同一 helper 内限制运行窗口/有限分块后安全投影；不靠不断加 buffer/timeout 或重跑解决。
- **同根：** 四来源与 managed DEV diagnostics 已逐一核对；后者已有独立失败判定，复用其模式而非另建诊断框架。
- **Dexter 裁决：** 不需要。不要求重跑已通过的设备业务；修复的最小证明是读取失败→diagnostics FAIL→非零，同时 business/cleanup 保持原事实。

## 4. 非阻断注记

### N-1 · 仍公开登记的旧 update case 与新 command payload 不一致

- **事实：** `runner.ts:42–89` 仍把旧 case 登记为 implemented。Web `journeys/update.test.ts:577,669,752`，Android `journeys/update.android.test.ts:1788,2211,2530` 三个调用点仍传 `{selectionContext}`；生产 `terminalUpdateActor.ts:1899–1902` 读取 `{target}`，前者会 `TARGET_INVALID`。
- **影响/边界：** 当前 C 顶层 `update.supply-chain`、`update.pair` 通过 project-basic 产生真实 target，不依赖旧调用；没有据此判当前主要 Journey 失败。不要求恢复或重跑范围外旧场景。
- **最小修正：** 同步确实保留的调用者/fixture；不保留的就一致删除 CLI/suite/README 可执行承诺，不给生产 command 增旧 payload fallback。
- **判据与同根：** C §9a.5 API/case/suite 同步；两个 Journey 文件的三个 Web、三个 Android旧形状调用点已核对，当前两条 C 顶层路径已另核对。旧 case 的保留名单未写清，列 DESIGN_GAP。
- **Dexter 裁决：** 修正公开 API 漂移不需要；若要扩大验收旧 case，应另按批准范围决定。

### N-2 · 项目规则首订阅顺序及初始时间与设计不一致

- **事实：** `project-basic/src/features/actors/actors.ts:422–440` 将初始时间写为 0；L512–514 在完整 HTTP snapshot/flush 前登记；L578–585 才提交就绪。C 详设 L196 写末页/hash/flush 后登记，首时间从响应原始记录求值，空集才 0。
- **影响/边界：** 这是确认的设计偏差；没有从源码证实它会造成规则丢失或错误执行，不把额外推论升成 S。当前规则 snapshot page 的 canonical 形状也未明确提供可计算该初始时间的可靠原始更新时间，不能拿 createdAt 代替启停更新时间。
- **最小修正：** 先确定已有 owner 的时间事实来源，或在设计侧明确论证为何 early subscribe+0 合法并同步；不新增轮询/版本机制。初次 HTTP、后续 notification ACK 的两个语义分别保留。
- **同根：** 组织三个 exact topic 初始时间与规则 collection 单独核对，组织已有原始时间路径；后续具体 notification 成功后 ACK 不是再用 0 覆盖，未发现该路径反例。
- **Dexter 裁决：** 技术来源澄清无需新产品裁决；若要改变正式时间语义则需提交具体差异。

### N-3 · history 诊断的 taskMatches=1 只证明找到，不证明唯一

- **事实：** `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts:831` 使用 findIndex，L859 输出 `taskMatches=${taskIndex >= 0 ? 1 : 0}`；L863 找到即停止后续页搜索。
- **影响/边界：** 确实验证找到目标 task、其真实正文及对应 UI 行，但此数字不能引用为“全历史恰一条”的计数证明。CBS 唯一键/同任务更新及 selected acceptance 另有支持；未发现生产重复行，所以只列 N。
- **最小修正：** 把诊断改为 `taskFound`，不要宣传为唯一性计数；如需在当前返回页证明计数，明确仅该页，不要求扫描所有历史或重跑设备矩阵。
- **同根：** 共享 helper 的两个 supply-chain 消费者与 CBS 同任务写入路径已核对。
- **Dexter 裁决：** 不需要。

## 5. 已核验而未另立 finding 的路径

1. **组织迟到结果与 ACK：** project-basic 的 shared organizationReadGeneration、跨 await current 检查、flush 后再复核、required subscription/规则刷新失败不 ACK，能隔离 PROJECT/REGION 并发通知与旧组织路径。`actors.ts:748–756,763,802–832`；直接测试 `projectBasic.test.ts:598–708` 覆盖相应反例。测试只作为代码断言，不声明本轮执行通过。
2. **凭证边界：** 普通 CBS 只用 credential/terminalRef；activation body 与 TDS AUTHENTICATE 仍有真实 deviceId。SLAVE 收 credential 并持久化，不因此激活或连接 TDS；明确解绑通过 Topology→TDC 两个本 owner slice 清理、flush、完成 command，不改成 root reset。
3. **报告 owner：** 当前 binding/授权在 receipt replay 前复核；同任务阶段变化更新同一行，binding 序号单调，旧序号不覆盖；无任务 observation 不造任务历史。报告 HTTP 错误处置保留/暂停/终态拒绝与 current context 分开；未发现新的生产阻断。
4. **供给及 App 身份：** 普通 FULL/HOT 清单与实际工件、grant manifest、App/application identity 一直传入 Android prepare/readback；规则候选按各 App 隔离。未发现 console 接收 wallpaper 工件的当前反例。
5. **UI 与复用：** 运营规则和报告是一个内容页两个 Tab，运维只管理更新包；Drawer lifecycle/cursor/刷新能力使用 foundation。当前正常 supply/pair 行为没有新业务入口、任务后台或第二安装器。
6. **原生与清理：** FULL ZIP→匹配内层 APK、摘要与 staging→原有 installer；HOT candidate/boot/实际身份及失败工件重入核仍由同一原生/update owner 提供。driver 显式 serial、forward/reverse ownership 和产物 cleanup 复用唯一 automation 入口，不恢复旧 topology runner。

## 6. 同根扫描与最小修复范围

| 问题族 | 核验全集及结论 |
| --- | --- |
| HTTP/协议大小 | 两 App assembly、共享 Web reader、Android reader、owner 页面/快照预算、fixture HTTP/WS参数；其余已核对，保留 WS 独立边界 |
| fixed 与候选资格 | 两 App 接线、SLAVE public context、grant 前后、feature fixed 恢复、prepared/native session；其余已核对，不扩大到所有更新阶段 |
| actual 与 task reason | 列表、最新 Drawer、历史三处及 canonical/controller；其余两种任务原因路径已核对，不能替代 actual 原因 |
| 诊断判定 | 两设备各两来源与 managed DEV，四个 Android 来源经过两个 catch；其余 managed DEV 路径已有最终失败判定 |
| 旧 payload | 两 Journey 文件六个旧形状调用点，以及当前 supply/pair 自动候选；后者无需改生产入口 |
| topic 首时间 | 规则 collection 与组织三个 exact topic；其余三个有原始组织时间，后续 ACK 另有身份检查 |
| 历史记录 | 两 App 共用 helper、taskId查页、正文/UI断言、CBS同任务更新/unique；不把 found marker 写成 exact count |

上述问题族关闭应落在已有直接 focused 测试及 review checklist；本轮不授权修改源码，不新增 project-memory/规范规则。已 MATCHED 且未变化的 CP 不需要重复对账；只对确认修复的来源、调用者、测试与消费者做差量检查。没有理由重跑未受修复影响的完整设备矩阵或默认全仓 verify。

## 7. 指定运行产物：业务、cleanup、诊断分档

以下均为本轮读取的归档，而非本轮新运行。路径前缀为 `.runtime/terminal-automation/<ID>/`，各读取 `run-manifest.json` 与 `runner.log`。六份 manifest 都记录 business=PASS、runner cleanup=PASS；没有可据其一键推导全仓当前 SHA 的 source hash 冻结字段。

| run ID | 执行面/范围 | 具体归档事实 |
| --- | --- | --- |
| `87afb762-ea92-44ad-a443-5761feaefeca` | console Expo Web | runner.log L5912 有 CBS 门店更新后 selector revision；L5976–5977 单项 Journey 通过；不是实际 APK 安装证明 |
| `06e78579-a966-4514-bd40-01b2af4cfbd6` | wallpaper Expo Web | L2692–2693 单项 Journey 通过，有实际控件/selector路径；不是 Android adapter 证明 |
| `cdede977-e568-42a9-b1de-5148b3db23aa` | console 真机单机双屏，serial D409P5C2J0285 | L1757 APK改变后boot、L1790实际FULL、L1914成功、L1957主链断言、L2255清理；状态/运营报告实际读回 |
| `24ee070e-76bf-425e-b7aa-55a84ca010ac` | wallpaper mobile，emulator-5554 | L1755 FULL boot、L1807 actual、L2094成功、L2137主链断言、L2435清理 |
| `039c9a27-c918-4ffe-b94a-ad5a1a36269d` | console 同App配对，MASTER 5556/SLAVE 5558 | L1562配对、L2039规则投影、L2067副机HOT实际且inactive/TDS stopped、L2097断言；L2463副机runtime诊断OUTPUT_LIMIT，L2486cleanup |
| `928cfaa0-6aa7-45d4-b0f6-16f289fcba7d` | wallpaper 同App配对，同显式角色serial | L1638配对、L2303投影、L2331副机HOT及inactive/TDS stopped、L2361断言；L2727副机runtime诊断OUTPUT_LIMIT，L2750cleanup |

归档顺序为两 Web（2026-10-10 18:32/18:33 UTC）→ 真机/ mobile → 两配对（2026-10-11）。这支持批准的交叉覆盖 2 单机 + 2 配对设备 run，不宣称两个 App×两种单机形态的 2×2 全矩阵。pair 属 Android topology adapter 例外；不要求伪造 Web topologyHost。

### backend-acceptance 与 DEV 恢复

路径 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791688651328-25736/`：

- manifest 的 **business PASS、Testcontainers 资源 cleanup PASS**；overall status=FAIL，firstFailure=`DEV_RESTART_FAILED`，brokenBoundary=`DEV_RESTORE`，devLifecycle restore/cleanup=FAIL。不能写成整个 run PASS，也不把恢复失败改成业务失败。
- `gradle.log:211` BUILD SUCCESSFUL；归档 XML `test-results/apps/backend/catering-business-server/build/test-results/test/TEST-com.catering.v2s.app.acceptance.BackendAcceptanceTest.xml:467,548` 为精确 selected `terminal-update.report-lifecycle` 的 CONTRACT/BUSINESS PASS、DB_OPERATIONS=17。不是完整所有 backend 场景通过。
- manifest 的 operation measurement discovered/succeeded/failed 计数不是业务 test failures，不能据其中 4 个 failed measurement 宣称四个业务场景失败。
- 后续 `.runtime/r5/run-manifest.json` 的 `r5-dev-1791689029498-26901-d4d6a9a6-9847-465d-bb53-038037487c8f` 及 `readiness-26901.jsonl` 记录受管重新启动、远端 Java、三 TDS/HAProxy/两个入口与本机 Vite/tunnel readiness。此后续恢复记录不改写上述自动 restore 首败。本轮未查询当前活性，也未启动任何环境。

按 Dexter 边界，自动恢复问题不作为本批业务阻断 finding，也不要求重跑验收。

## 8. 未验证项与 DESIGN_GAPS

### L1_ENGINEERING
当前静态发现 S-1/S-2/S-4；作者 focused 与历史对账不自动关闭它们。生成契约/直接测试读回支持对应源码判断，不等于本轮执行 PASS。

### L2_USER_VISIBLE
指定六个 run 有已运行主流程及清理记录；报告 receipt 后真实 HTTP history、UI行及实际版本可读，不是仅 response.ok。实际版本读取异常的可见原因缺失为 S-3。归档 selector/控件断言不冒充本轮重新看图或所有异常分支动态通过。

### L3_UNVERIFIED
两配对 run 的副机结束 runtime 诊断不可用；保存的运行对应各自拓扑/时间/产物，不无条件绑定后来所有当前文件。恶意 ZIP/symlink/截断/压缩炸弹 V-04 的移出范围保持 NOT_COVERED，不据此增加 S。完整默认 verify、生产 HA/长期容量、UAT/生产部署未执行或未获授权，不作为额外验收需求。本轮零动态运行，不要求补交或重跑。

### DESIGN_GAPS
1. **规则初始时间：** C L196 的“原始时间计算”缺当前 rules snapshot 可用字段来源。见 N-2，应在设计侧具体指定来源或收敛条款，不把零值约定自行立成通用规则。
2. **actual 未知原因字典：** B UI L245–247 的旧字典与当前 canonical 四值（READBACK_UNAVAILABLE/NOT_INSTALLED/MISMATCH/OTHER）需对齐。S-3 的生产呈现已有需求判据；这里是字典维护落点。本轮不授权修改 B 工件。
3. **旧 case 公开承诺：** 没有逐项保留/退役说明。见 N-1；不能一边公开 implemented，一边留失效调用，亦不能借此扩大 C 动态分母。

## 9. 对远程控制设计与计划的影响及已完成修订

Dexter 追加授权要求同时调整远控详设/计划；本次已修改且读回两份文件，未修改其需求/Journey/IA/UI、C 源码/文档或规范记忆：

- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md`：L13–24 新增当前 C 源码接缝表；§8.3 补同 Runtime 配对/解绑观察；§12 保留 C 最终出口 OPEN。
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md`：L15 进入条件；CP-01 L30 来源/auth/HTTP核对；CP-03 L53 同 Runtime 失效释放；CP-05 L75 复用当前 owned forward/reverse 与四来源诊断判定。

落地影响：普通 CBS 鉴权仅 credential/terminalRef，TDS/activate 仍真实 deviceId；远控 register/report 的 MASTER 与固定 TDP target 资格必须独立保留。配对或解绑不保证 root reset/重启，remote owner 直接观察角色/pair/TDC失效后释放，不等待重启。普通断链 credential 留存不改变远控“结束整个会话、手工重发”的产品决定。服务配置呈现已并入 admin-shell，不恢复已删除 server-config-panel。网络复用现有 `attachTopologyHostForward`，但 ADB HTTP/WS映射不代表 RTC UDP可达。HTTP/WS/Data三种上界独立；沿共享HTTP adapter，不另造fetch/压缩。设备日志失败必须由父run诊断判定保留，不能沿用成功摘要吞掉的接缝。

修订后 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| remote-control implementation-design | `3fcfce058b8ac7eb9c95fc151803d545c1afa542cf2d382e2aa8e2c99ba58c93` |
| remote-control implementation-plan | `7e7227b88f8d08c9d2cbbaaf93b7d9b29551075b4e3db7cef01859fdc901a529` |

这是设计映射修订，不是远控 independent DESIGN GO 或实施授权；T-01～T-04 仍 OPEN，远控实现、解析依赖、生成、编译、测试、Web/设备/DEV、seed/cleanup 全部 NOT_RUN。UI既有确认不撤回。

## 10. 交付与授权

当前阶段 C 主流程已有业务价值，四项问题均有既有接缝可作小修，不需要换方案。先由主 agent 对本 findings 辩证 intake，重开现字节确认后只修成立部分；只差量复核受影响的调用链，保留未变范围证据。此次 review 不授权源码修复或任何新动态操作，也不要求完整重跑、环境恢复或不相关 verify；后续由 Dexter 决定。
