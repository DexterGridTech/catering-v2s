# TER 应用内远程控制 · 当前实施结果独立评审

> 范围更新：Dexter 后续要求仅做源码静态 review，聚焦常见主流程，不要求极端完整性或运行证据。本文件 §1～§8 保留原评审记录；**当前过滤后结论以 §9 为准：NO-GO，0M/3S/1N**。原六项 S 不再作为当前全部修复清单。

日期：2026-10-13。评审者：Claude 外部复评会话（续接会话，曾参与本需求/设计；不冒充 fresh 主会话）。

## 1. 范围、独立性与授权

本轮从当前需求、Journey/IA/UI、详设和源码重新推导行为，未继承作者或历史 reviewer verdict。三个 fresh、无父会话历史的只读子 reviewer 分别核查终端/Android、CBS、会员/runner，主 reviewer 独立核查运营工作区与四个 run，重开每条 owning source 后汇总、去重、过滤严重度。子 reviewer 没有写文件或运行验证；其子范围 verdict 不是整批结论。

只读命令、源码解析与已有归档读取；没有新增测试、构建、verify、DEV、Web、Android、reset/seed、L2、UAT 或部署。唯一新增文件为本报告。当前 Dexter 的交付范围优先于历史计划：mobile 与同 App paired 的 remote.main smoke；L2 明确为 `NOT_RUN / OUT_OF_SCOPE_FOR_CURRENT_DELIVERY`，没有因未跑 L2 或额外设备矩阵计 finding。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/6/3
L1_ENGINEERING=S-1/S-2/S-4/S-5/S-6；其余合同一致性见 N
L2_USER_VISIBLE=四个历史 smoke 通过；当前源码的并用取消、确认导航和回执未知路径仍有 findings
L3_UNVERIFIED=本轮没有新运行；本轮反例未动态复现；mobile 历史 run 不覆盖随后 paired 修订；L2/额外矩阵不属于当前交付
SAME_ROOT_SCAN=每项见下；不以命中单点代替同族核查
DESIGN_GAPS=本轮 findings 均有已有判据，无需新增业务设计规则
TEMPLATE_COVERAGE=NOT_APPLICABLE（IMPLEMENTATION）
EVIDENCE_TIER=当前源码静态证据＋四份已有 Android smoke 原始归档；没有本轮 fresh 动态证明
```

`L3_UNVERIFIED` 不能消除已确认 S；本轮 NO-GO 源于源码反例，不源于未授权运行。M/S/N 是供 Dexter 裁定的初评。CBS 子 reviewer 对部分问题建议更高严重度；主 reviewer 将不改变准入/控制结果的合同注记降为 N，没有撤回其源码事实。

## 2. 方案合理性与代码提取事实

真实任务是项目管理员看到 TER 应用画面并经原控件协助操作，终端无新增提示，本地人员仍可操作。CBS 复用 terminal-control 与 TDP 在线投递，LiveKit 承担媒体/数据传输，Android 只补真实 Window 捕获和普通 MotionEvent，原业务仍由 feature owner 执行。该路线成立，未发现必须换方案或建设恢复平台的理由。

| 可见事实 | 当前源码位置 | IA/交互对照 |
| --- | --- | --- |
| 原项目报告 Tab 新增三态连接列 | `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:779` | IA §2.1，未新建终端列表 |
| 原 Drawer 的操作菜单；非 ONLINE 禁用并解释 | 同文件 `1154`、`1160`、`1163` | IA §2.1/§3，复用 AdminDetailActionMenu |
| 全屏工作区；主/副屏标签；header 结束/关闭 | `apps/frontend/operations-admin/src/features/remote-control/ui/RemoteControlWorkspace.tsx:194`、`765`、`771` | IA WORKSPACE 与 UI §4/§5 |
| STARTING 占位；ENDED 原位原因与手动重新发起 | 同文件 `791`、`792`、`814` | 没有新增自动恢复状态 |
| 真实 video pointer 与内容矩形归一 | 同文件 `197`、`669`；`model/remoteControlPointer.ts:3` | 原控件链，不调用业务 onPress |

静态映射正确：`remoteControlActor.ts:58–66` 把 SLAVE PRIMARY 对应 secondary；Android port `createAndroidRemoteControlPort.ts:535–554` 从该 screen/stream 选择真实 surface/window/generation；driver 的 PEER 操作使用同一远端槽位。点击、拖动及虚拟键盘没有各自另起一套映射。主副 TDC/配对身份接纳、base/adapter 分工和两个 App 共用接线成立。以下问题都可在现有机制内作最小修正。

## 3. 六项 S

### S-1 · 续约没有复核发起人的实时授权

- 性质：`CONFIRMED` 仓内事实＋可达反例推论。
- 判据：正式需求 R-03 `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md:115`、R-17 `331`；详设 §6.2 `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:123`。
- 实现：`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/TerminalRemoteControlOwnerService.java:222–256`；`validateCurrentTarget:291–300` 只有 binding/PG session 核验，没有 stored actor_account_ref/actor_session_ref 的有效会话、任职及 capability 重核。
- 反例/影响：正常 ACTIVE 后撤销管理员 `CONTROL_PROJECT_TERMINAL` 或任职，MASTER 仍可每十秒报告 ACTIVE、持续把 lease 延长三十秒。拒绝再次领取 token 不能阻止已加入的会话继续控制。
- 最小修正：按 stored 发起人及 PROJECT 事实复用既有 IAM 实时授权查询，在续约写入前核验；失效不延长 lease，走既有授权失效终止。不要建设撤权推送或第二权限缓存。可验收反例为撤权期间的真实 report 拒绝、lease 不增长及终止事实。
- 测试来源：`RemoteControlAcceptanceScenarios.java:352–385` 仅在撤权期间检查运营 start/grant，随后恢复授权，未覆盖终端续约。
- 同根：start、controllerGrant、end 的运营 grant 路径及 register/report 两个终端入口均核查；其余三条运营写入口有 grant，report 的实时 actor 授权缺失，register 同样不能借首次授权替代后续资格。
- 需 Dexter 产品裁决：否。

### S-2 · 到期结束写入被随后抛出的事务异常回滚

- 性质：`CONFIRMED` 源码及实际依赖源码支持的事务推论；没有运行本反例。
- 判据：详设 §6.2 `123–125`，写入口持久化到期 ENDED 及一次审计，GET 不能补写。
- 实现：上述 owner register `170`、`183–188`；report `221`、`231–234`。两处写 endExpired/audit 后抛 `RemoteControlException`；`api/TerminalRemoteControlOwnerApi.java:31` 为 RuntimeException，入口只有默认 `@Transactional`。
- 反例/影响：到期 report 返回 410 时，刚写的 ENDED/END audit 被回滚；库中仍为旧 ACTIVE/STARTING。GET 虽能导出过期结束，却不能补该持久事实；下一次 start 可能才补收口。
- 官方版本依据：读取本机缓存 `spring-tx/7.0.8/.../spring-tx-7.0.8-sources.jar` 的 `DefaultTransactionAttribute.java:180–181`，默认对 RuntimeException/Error 回滚；未执行依赖或测试。
- 最小修正：对“已提交到期终止”的精确分支使用既有事务结果/具名异常处理，使终止提交后再返回 typed 410；不能给全部 RemoteControlException 全局不回滚。可验收条件：410 后立刻读库即为 ENDED，END audit 一次，而正常 start 拒绝仍不留半成品。
- 同根：register/report 两个异常结束分支都受影响；运营 end 的成功返回及新 start 成功后到期回收路径另行核查，不作全局事务放宽。
- 需 Dexter 产品裁决：否。

### S-3 · 主动取消手势链不完整：本地冲突通知丢失，十秒期限未实现

- 性质：两项均 `CONFIRMED` 源码事实；同一手势主动取消闭包合计一条 S，须分别关闭。
- 判据：需求 R-12 `242`、R-15 `309–311`；详设 §8.5 `201`、§8.6 `204`。
- 本地冲突：`apps/terminal/adapter/android/remote/android/src/main/java/com/catering/v2s/terminal/adapter/android/remote/TerminalRemoteModule.kt:148–157` 发送事件不含 streamId；`apps/terminal/adapter/android/remote/src/createAndroidRemoteControlPort.ts:474–480` 却先按 event.streamId 找 track，找不到便 return，永远不到 `488–489`。现场人员触摸同 Window 时 native 已 CANCEL，owner/browser 却仍持有远程 gesture，后续 MOVE/UP 出错。
- 十秒期限：`apps/terminal/kernel/base/remote-control/src/features/actors/remoteControlActor.ts:143–150`、`790` 只保存 gestureId/downSequence；`630–654` 的 tick 无手势期限。native `RemoteTouchDispatcher.kt:57–89` 的 downTime 用于 MotionEvent，没有超时取消。正常 DOWN 保持超过十秒，同时 KEEPALIVE/lease 正常，按压不会自动释放，也不发 GESTURE_EXPIRED。
- 最小修正：冲突事件以已经核验的 surfaceKey/windowIdentity/generation 匹配未释放 track；给当前 session/gesture 复用现有 timer→private command→cancelGesture 通路，十秒到期 CANCEL 并发关联 DOWN 的回执。UP/CANCEL、几何变化、stop/reset/dispose 清期限，旧 timer 不影响新手势；不新增事件总线或手势历史。
- 测试边界：`remoteControlActor.test.ts:727–769` 直接伪造 typed 冲突事件绕过 adapter；缺真实 native 事件形状及 GESTURE_EXPIRED 行为反例。建议最小 adapter/actor focused 向量，未要求本轮执行。
- 同根：主动取消三类——本地冲突、十秒期限、Window 变化；前两项有缺口，其余一类已有 `683–687→cancelGesture`。同一 adapter 的 mobile/MASTER/SLAVE/同机副屏均适用，不只修 paired。
- 需 Dexter 产品裁决：否。

### S-4 · 根 reset 清空 slice 后，旧媒体资源失去清理入口

- 性质：`CONFIRMED` 仓内调用链＋生命周期反例推论。
- 判据：需求 R-05 `144`、R-17 `325`；详设 §8.3 `190`。
- 实现：`apps/terminal/kernel/base/remote-control/src/application/createRemoteControlModule.ts:39–59` 仅注册 dispose，无 onApplicationReset。`runtime/src/application/createRuntime.ts:381–387` 先重置 state 再执行 reset hooks；`runtime/src/foundations/createRuntimeLifecycle.ts:129–134` 只执行已注册的 hook。
- 反例/影响：ACTIVE 根 reset 后 remote slice 变 idle/sessionId=null；模块观察器 `47–49` 不派停止，actor stop `remoteControlActor.ts:304`、watchdog `641–647`、state-change `649–653` 都不再命中旧 session。adapter 私有 Room/track/capture 仍存在，slice 清空不能证明停止。
- 最小修正：接入现有 reset 生命周期，按 previousState/私有当前资源身份撤销旧会话并复用现有 cleanup；启动 reservation 也须失效，释放失败仍可见。不依赖已清空的 slice 再找资源，不增加通用恢复机制。
- 同根：显式 stop、环境变更、watchdog、lease、dispose、根 reset 六类均核查；其余五类不替代 reset hook，现有 dispose 测试也不等于 reset 测试。
- 需 Dexter 产品裁决：否。

### S-5 · 会员确认仅防投影先到，回执先到仍丢失最终导航

- 性质：`CONFIRMED` 当前代码、真实运输优先级及可达业务反例；不否定 paired smoke 这一次通过。
- 判据：Journey `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md:14–16`、详设 V-06 `268`；真实 smoke 的业务断言 `tools/terminal-automation/journeys/remote.android.test.ts:2434–2477` 包含唯一登记、pending 清空和返回 branch member-list。
- 实现：`apps/terminal/kernel/feature/sample-member-registry/src/features/actors/actors.ts:113–117` 成功回执后立即清 pending、发 memberConfirmed；`apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:231–232` 在成员投影尚未到时直接忽略事件。后续投影到达，registry `src/application/module.ts:86–93` 因 pending 已空不再 reconcile。
- 可达性：`apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts:61–65` 优先 controlQueue；command-result `94–101` 属 control，state-full `107–115` 属 data。排队时回执可合法先于状态投影，不需假定同一连接任意乱序。
- 影响：MASTER 已登记、副机 pending 已空，但确认页留住，事件不会重发。相反，投影已证明成功而 peer 回执超时，`actors.ts:113` 先抛错，原 UI request 仍失败；`useCustomerMember.ts:73–74` 与 desk actor `343–355` 可在成功后显示系统失败提示。
- 最小修正：在现有 registry/reconciliation 按同 operation 的权威成员事实统一完成裁决；事实可观察前不同时消费 pending 和发送会被忽略的确认，事实已证明成功时不再报失败。补含真实 desk consumer 的回执先到、投影先到、执行成功但回执丢失三个确定时序；确认恰一次、页面和 notice 正确。不要修改运输优先级来掩盖业务竞态。
- 测试边界：`memberRegistry.test.ts:284–333` 强制投影先到；`242–282` 仅 registry，无 UI consumer；`196–240` 的丢响应模拟没有实际失败 peer request。
- 同根：MASTER 本地、SLAVE 投影先到、SLAVE 回执先到、SLAVE 丢回执四条均核对；其余两条正向路径成立。
- 需 Dexter 产品裁决：否。

### S-6 · 浏览器未实施三秒输入回执期限及 MOVE 合并上限

- 性质：`CONFIRMED` 实现缺失；故障影响是静态推论，未新增网络丢包运行。
- 判据：需求 R-15 `303`、`309`；详设 §8.6 `204`。
- 实现：`apps/frontend/operations-admin/src/features/remote-control/ui/RemoteControlWorkspace.tsx:280–314` 每次直接 publish，无边界回执等待；`513–530` INPUT_RESULT 只处理当前 gesture 的 CANCELLED 和提示，未按 DOWN/UP/CANCEL seq 关闭等待。`698–710` 每个 PointerMove 都 publish，没有三十条/秒的最新位置合并。`model/remoteControlKeepalive.ts:67–78` 只确认 probe，不能证明点击执行结果。
- 反例/影响：正常 UP 已可能执行，INPUT_RESULT 丢失但 KEEPALIVE_ACK 继续到达；浏览器一直 ACTIVE、可继续点击，不在三秒后以 INPUT_RESULT_UNKNOWN 停止。普通高频鼠标拖动也会把超过三十条/秒的 MOVE 全部发送，违背设计的输入容量依据。
- 最小修正：当前手势内保存有限边界 seq/期限，匹配实际 endpoint/session/gesture 的回执；超期沿现有 finishSession 禁输入，不补发。MOVE 只保留最新位置、最多三十条/秒，UP/CANCEL 清待发 MOVE 并优先保留边界；不建设通用 ACK 历史或持久队列。
- 同根：DOWN/UP/CANCEL 三个边界与 MOVE、输入回执、KEEPALIVE_ACK 全部核查；边界全部缺期限，KEEPALIVE 机制已有但语义不同，不能复用它冒充输入完成。
- 需 Dexter 产品裁决：否。

## 4. 三项 N：合同一致性，未上升为新的框架要求

### N-1 · registration 未比较正文和路径 sessionId

附件 §3 `83` 要求一致。`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminalcontrol/TerminalRemoteControlController.java:65–66` 忽略 request.sessionId；同文件 report `154–156` 已检查。path=B/body=A 会给 B 登记，不拒绝冲突。当前合法 generated caller 的两值通常相同，因此列 N；最小修正复用 report 的一致性检查及一个不调用 owner 的红向量。需 Dexter 裁决：否。两个 terminal POST 其余一个已核对。

### N-2 · start 的未激活/离线错误不是 canonical 的对应原因

附件 §3a `118–122`、既有 canonical 要求精确 NOT_ACTIVATED/TERMINAL_OFFLINE。owner `83`、`87`、`119–120` 却用 BINDING_INVALID/NOT_READY，`TerminalRemoteControlWire.java:92–93` 返回 credential-invalid/not-ready。列表之后取消激活或断开仍能被拒绝，但错误原因与 operation 合同不一致。最小修正只补 start 的精确 outcome/wire，保留 register/report 的 credential 错误和 grant 的 preparing/not-ready。需 Dexter 裁决：否。start 的三类分支和另五 operation 已核对，不全局改名。

### N-3 · 等值 ENDED 报告重放返回 410

详设 §6.2 `123`、附件 `81`/`123` 要求等值 ENDED 幂等。owner `231–234` 在比较 state/reason 前对全部 stored ENDED 拒绝；正常管理员先 end、TER 后报告 ENDED，或结束响应丢失重发，都会得到 410。actor stop `remoteControlActor.ts:332–344` 已把 reportAccepted 与 native cleanup 分开，故不把四次 cleanup PASS 误判失败。最小修正等值结束返回原事实，不续约/不重复审计；ACTIVE 或不同结束事实仍拒绝。需 Dexter 裁决：否。运营 end 的等值重放 `274–280` 已核对。

## 5. 四个归档的实际核验与字节边界

每个 manifest 均亲读：stage=FINISHED、business=PASS、diagnostics=PASS、cleanup=PASS、firstFailure=null；runner.log 每份均有 1 file/1 test passed。没有仅凭 manifest 的 PASS 替代读取业务及释放日志。

以下 `L` 为各 run 根下 `runner.log` 的当前行号；完整路径为 `.runtime/terminal-automation/<runId>/runner.log`。

| runId / App / 拓扑 | UTC 开始时间 | 原业务结果 | 端点 cleanup / runner cleanup |
| --- | --- | --- | --- |
| 0e50702f-1104-4ccb-b848-5b4b3e21e5c7 / console / mobile | 2026-10-12 17:34:38 | L3257 真实远程登录 verified | L3322 MASTER roomLeft/inputCancelled=true、tracksReleased=1；L3358 cleanup PASS，L3361–3362 test passed |
| 9c7787af-1f09-40ca-a835-5f258f9a4b1d / wallpaper / mobile | 2026-10-12 17:06:10 | L3514 登录、L3954 壁纸 w3 verified | L4019 MASTER 三项释放事实；L4055 cleanup PASS，L4058–4059 test passed |
| ec6feeb3-ef5c-48f1-afe8-3b706979e024 / console / paired | 2026-10-12 23:11:03 | L3778 登录；L8766 副机会员确认、唯一登记及 pending 清空 verified；脚本还断言返回列表 | L8838 MASTER、L8852 PEER，各释放一个 track；L8911 cleanup PASS，L8914–8915 test passed |
| 7d930c92-a0a9-4919-a563-33b64e8a7aa3 / wallpaper / paired | 2026-10-12 23:14:31 | L3953 登录；L4462 主机 w3；L4887 副机 w2 且主机未变 verified | L4961 MASTER、L4977 PEER；L5027 cleanup PASS，L5030–5031 test passed |

用户提供的时序边界保持不变：mobile 两次早于 paired 专项修复，不能说它们验证了该后继字节；paired 两次在修复后，只证明实际经历的时序，并不穷尽 S-5 的另一合法到达顺序。manifest 不包含一份足以把所有现存源码逐文件等同于 APK 的全量绑定，本报告不作该全称升级，也不因此新增证据门。

smoke 源码重开：`remote.android.test.ts:1630–1651` 从真实 Drawer 菜单 start；`890–912` 通过浏览器 mouse 进入 video PointerEvent/DataChannel；不是原业务 command 的自动化旁路。selector/request 用作结果观察及前提准备。`1438–1533`/`1593–1619` 的收尾断言本次 session、ENDED、本机资源与 run-owned 回收，runner `2002–2018` 拒绝缺失 cleanup 完成信号。

wallpaper 两 run 的滚动分别为 L3537/L3976 `business.remote-scroll.not-applicable`（页面内容未溢出），因此不能称实际滚动已验证。点击、键盘和两路视频有本次 smoke 事实；拖动映射可从同一 source 证明，未覆盖的实际滚动仍未覆盖。diagnostics PASS 证明该 run 的诊断采集完成，不代表业务、所有 native 分支或全部日志策略无缺口。cleanup PASS 只证明对应 run 的清理，不能反证根 reset 释放或本地冲突路径正确。

## 6. 未验证项与边界

- 本轮六项 S 的确定反例没有新动态复现；依据为当前源码和既有判据，不是要求补跑整个矩阵。
- 本轮没有运行 focused tests/typecheck、backend-acceptance、Web 或设备；直接测试源码只用来核对断言覆盖，不称本轮测试 PASS。
- L2、额外拓扑、扩展设备矩阵、UAT、生产部署与生产容量：本轮 `OUT_OF_SCOPE`，不是新增阻断。
- 各技术前置不因文档旧 OPEN 字段或一份编译/首帧日志自动变 PASS；四个实际 smoke 仅支持上表范围。
- 没有必要因这些局部 findings 换传输平台、增加 outbox/轮询/恢复账本或扩大隐私产品目标。

## 7. 当前源码绑定

| 文件 | SHA-256 |
| --- | --- |
| 正式需求 | 57067ccd49b538b2c4adc20436692652924ae4b2e9c162fc8fc5603d8f338789 |
| 详设 | 409b8cba0b123d8d42837378303bc1a083980fdd01908859ebefa69ec4e19030 |
| 计划 | 702fa2245f8b3d9b3df3789754892aa61e5b3361e64a8b68223d6e41efcc3ca8 |
| remoteControlActor.ts | 8dfd6dbe08e260e8784891ffb05f7cad8b37cd79f504687c304a6f9ea1dfaafe |
| createRemoteControlModule.ts | be8f155ce898d9ccbe8a3bcf9168f310eecadd7b44396e087c8c09bb6afcf498 |
| createAndroidRemoteControlPort.ts | acc9db40a34ead8e564fbb4bd695d964fe2faabec52c02b95f8f41d07853492f |
| registry actors.ts | 85b4090045e09b165c456a4368c4e05dc898e666ab9c087e0222282c8dd9c9db |
| registry module.ts | 825e1bb09219fdd08d40ee66d48fa3be910701a0b3bef3e9beca833a3d98014c |
| RemoteControlWorkspace.tsx | 7a1c3f81c750b372c2a03ad14f67bb0b83d96df07d092a81180e7f0a3602b1ff |
| TerminalRemoteControlOwnerService.java | ab5c8b41b59cce5a52adf7ca25714dfe9141b7c7fac039c447f2a6b3ba87b1df |
| remote.android.test.ts | f89ee534e54a47fad43c31e30b860c4fd4fe697fdc2b4e57ff65be2bcf56123e |

## 8. 交付结论

主干能力已经在四个获准 smoke 中产生真实业务结果和资源释放事实；当前整批仍为 NO-GO，因为六项现有要求的实现闭包有确定缺口。最小修正均在当前 owner/adapter/工作区内，无新增产品裁决需求。此 review 不授权修改、定向验证、整体验收或任何新运行；后续处置由 Dexter 安排。

## 9. Dexter 收敛范围后的源码过滤与当前转交口径

### 9.1 当前结论

本次重新打开当前 owning source，仅判定常见主流程。没有重新读取运行产物，没有运行命令验证业务、没有要求补交证据。过滤是续接外部 reviewer 的亲自重评，不冒充一轮新的 fresh 独立子 agent 审查。

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=STATIC_CODE_MAIN_FLOW_ONLY
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/3/1
L1_ENGINEERING=三个当前源码支持的核心缺陷；一个非阻断事务注记
L2_USER_VISIBLE=静态核对本地并用和副机会员完成路径；不裁定动态或视觉通过
L3_UNVERIFIED=动态不属于本轮目标，不据此计 finding 或阻断
SAME_ROOT_SCAN=复用并重开已识别同根路径，不新增全量对账
DESIGN_GAPS=无新增产品或恢复机制要求
TEMPLATE_COVERAGE=NOT_APPLICABLE
EVIDENCE_TIER=STATIC_SOURCE_ONLY
```

方案主干仍成立，无需更换技术栈。三个保留项可通过既有 owner、adapter 和 reconciliation 接缝修复；不要求增加通用恢复、重试、事件总线、ACK 账本或额外持久状态。

### 9.2 三项保留的 S（新的编号）

1. **S-1（原 S-1）：撤销权限后现有远控仍可续约。** 当前 `TerminalRemoteControlOwnerService.java:222–256` 的 report 写 lease 前没有复核 stored 发起账号/会话、任职和 capability；`291–300` 只核 binding/PG target。正常 ACTIVE 后撤权，旧房间仍可继续控制。最小修正是复用已有实时授权能力，在续约前核验，不延长失效授权；不新增撤权推送。判据为需求 R-03:115、详设 §6.2:123。属于已接受权限功能的基本正确性，不是生产安全体系扩建。无需 Dexter 新产品裁决。

2. **S-2（原 S-3 的本地冲突子项）：现场触摸已取消 native 手势，但通知到不了 owner/browser。** `TerminalRemoteModule.kt:148–157` 的事件没有 streamId，`createAndroidRemoteControlPort.ts:474–480` 按该字段找 track 并提前 return。正常远程拖动时现场人员触摸同屏，后续远端 MOVE/UP 与 owner 状态失配。最小修正仅是以已有 surfaceKey/windowIdentity/generation 找当前 track，再走现有 typed command/CANCEL；不新造事件机制。判据为需求 R-12:242、详设 §8.5:201。其余 first-frame/capture-failed 事件形状与 Window 变化取消路径已经核对。无需 Dexter 新产品裁决。

3. **S-3（原 S-5 的正常回执先到子项）：会员已注册，副机却留在确认页。** registry `src/features/actors/actors.ts:113–117` 先清 pending、再发确认；desk `src/features/actors/actors.ts:231–232` 因成员投影还未到而忽略；registry `src/application/module.ts:86–93` 后来因 pending 空不再收敛。真实运输 `createTopologySession.ts:61–65,94–115` 优先控制回执，允许其先于状态投影，这是正常队列顺序。最小修正是成员权威事实可观察后再完成 pending/确认事件收敛，复用现有 reconciliation；不改运输优先级、不加轮询。本次不要求穷尽响应丢失/多重故障组合。判据为已批准 Journey 普通业务结果及详设 V-06。MASTER 本地与 SLAVE 投影先到两条路径已核对。无需 Dexter 新产品裁决。

### 9.3 一项非阻断 N

**N-1（原 S-2）：过期结束写入与 RuntimeException 的事务关系。** owner register:183–188、report:231–234 的 endExpired/audit 随异常回滚，属于源码中的真实一致性问题。但现有读取会导出过期结束，新 start 可回收到期占用，终端已有 lease/watchdog；当前代码证据不足以把它说成主流程必然永久占用或继续控制。因此降为非阻断注记，不要求立即增加到期清理框架。若在现有 owner 内处理，只对精确过期终止分支保证提交，不放宽所有业务异常的回滚规则。详设 §6.2:125 已有该判据；无需新产品裁决。

### 9.4 撤回当前阻断或移出本轮修复要求的部分

| 原项 | 当前处置 | 原因与界限 |
| --- | --- | --- |
| S-3 十秒手势期限 | 不列本轮核心修复门槛 | 设计中确有数值要求，但本次不按协议异常释放的全面完整性扩大修复；不声称原数值已实现 |
| S-4 根 reset | 撤回已确认生产缺陷的阻断判断 | 先前反例假定 ACTIVE 直接根 reset。当前 kernel 唯一 requestApplicationReset 来自 TDC 取消；`terminalDataClientActor.ts:1973–1975,1981–1984,2770–2774` 在 reset 前改变取消/连接状态，remote 已订阅该环境变化。未完整证明此实际调用链仍漏释放，不能把缺 hook 本身等同于常见业务泄漏；不要求为任意未来 reset 入口增加机制 |
| S-5 丢回执/超时复合路径 | 不另作本轮门槛 | 只保留正常回执与投影到达顺序导致的导航缺陷，不要求穷尽所有通信故障组合 |
| S-6 三秒 ACK 与 MOVE 固定上限 | 不列本轮阻断 | 按 Dexter 最新范围，不以固定协议数值的全量实现作为本次交付门；未发现本轮源码支持的正常点击必然失败依据，不要求新 ACK/排队框架 |
| 原 N-1 path/body session 一致性 | 不作为本轮修复要求 | 合法 generated caller 正常使用同一 sessionId；任意矛盾入参不用于扩张核心 review |
| 原 N-2 错误码细分 | 不作为本轮修复要求 | 当前会拒绝未激活/离线发起；仅错误细分不升级成正常控制功能失败 |
| 原 N-3 等值结束报告重放 | 不作为本轮修复要求 | 正常结束本机资源不依赖该 report 成功，已有 stop 将两者分开；不要求为报告重放扩建恢复路径 |

上述是当前 review 范围/严重度收敛，**不是擅自修改正式需求或宣称较宽协议判据全部实现**。本轮不要求补齐证据、重跑 smoke、完整矩阵或 L2，不增加对子系统完整验收的要求。

### 9.5 转交与授权

Codex 亲自对三项 S 辩证 intake，比较最小修法；只有确认的常见路径缺陷驱动修正。N-1 非阻断。此前 §1～§8 不再作为未经筛选的整批返工指令。本次仅源码 review 与结果转交，不另授予动态执行或扩大实施范围；修正按 Dexter 已有实施授权处理。
