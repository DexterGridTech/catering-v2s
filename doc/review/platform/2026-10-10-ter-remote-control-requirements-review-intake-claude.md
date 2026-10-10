# 远控正式需求：作者 finding intake

```text
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_REQUIREMENTS_2026-10-10
REVIEW_TARGET=DESIGN
AUTHOR_ROLE=Claude / MAIN_AGENT
R1_VERDICT=NO-GO 0M/4S/1N
R1_REVIEWED_SHA256=82c110e82592064e355aca88e1b54a872fe9f955c28344dbc8b00967e9eff82e
R2_VERDICT=NO-GO 0M/1S/0N
R2_REVIEWED_SHA256=99a4f9c0d10580cc52c4948aa093b0cf3d61a77f72d9f465bc08ffa7defbd1a3
REVISED_SHA256=4fa449bfc45adb6c64ae229ad09bf3a01ac23550e0d070a3611c11fc49cd1730
R3_VERDICT=GO_WITH_UNVERIFIED_UI 0M/0S/0N
INDEPENDENT_VERDICT_ON_REVISED_BYTES=R3_INDEPENDENT_SUBAGENT
IMPLEMENTATION_AND_DYNAMIC=NOT_RUN
```

这是作者核验与处置，不是独立 GO。旧 verdict 保留其旧字节边界。全文只改本需求和评审文档，未修改源码、规范、记忆、依赖或阶段C；未联系Codex、未读.runtime、未进行动态运行。

## 1. 逐条核验与最小修正

| 输入 | 核验分类 | 当前处置/位置 | 更小替代与边界 |
| --- | --- | --- | --- |
| S1 发送者方向冲突 | CONFIRMED | 作者CLOSED：正式稿R13 L254–271；8类type方向/实际sender/receiver表；R14 L277–287；SESSION_END仍整会话终止 | 通用“只接受controller”会阻断正常slave READY；定点消息矩阵足够，不建角色框架或总线；其余7类逐一核对 |
| S2 描述/拓扑来源缺失 | CONFIRMED | 作者CLOSED：R06 L150，R07 L158–171，R08 L180–193，R09 L197–203；先主机selector登记，再CBS描述/端点授权；start不猜expectedScreens；description和grants对象明确 | 不让CBS预知副机；不把self-reported媒体顺序当事实；复用一次登记HTTP及最多两屏描述，不建manifest registry。6个HTTP能力、4拓扑、start/peer/声明/握手同核，余下成员逐一检查 |
| S3 ACTIVE几何握手无界 | CONFIRMED | 作者CLOSED：R11 L226，R14 L285–287，R17 L325；CBS保持ACTIVE、本地ready清空，在当前剩余授权与30s较短期限内重握手，不就绪不续约；V08 L384 | 可直接结束并让用户再点，但会放弃原稿正常几何变化流程；复用原握手与当前租约，未新增phase/store。启动/断连/结束/新发起其余4路径已检查 |
| S4 无法编码错误/主动取消 | CONFIRMED | 作者CLOSED：R13 L252–271，R15 L303–307，R20 L360–363；无法关联不造回执、未知协议用SESSION_END、主动CANCELLED引用DOWN；V10 L386 | 直接使用现有8类消息，不新增通用ERROR/RPC；8种错误/取消路径和全部消息回执逐一检查，无回执循环 |
| N1 READY跨接收者竞态 | CONFIRMED | 作者CLOSED：R09 L201、R14 L285、R16 L311；browser需各endpoint ACK.readyStreams证明输入授权已消费才开输入；V03 L379 | 最小复用原KEEPALIVE_ACK；不新增READY_ACK消息，不重发点击。单屏/同机双屏/paired与重握手均检查 |

上表行号对应 REVISED_SHA256，后续字节变化必须重新读回，不能引用该表替代 current source。

## 2. 真实源码读回与新增裁决

- `topology/src/selectors/selectTopologyFacts.ts:L35–68`：MASTER从已接受peer得到paired事实，displayCount与peerReachable分开；CBS没有已存在的副机业务实体。所以S2不能由CBS臆测拓扑。
- `contracts/src/types/topology.ts:L55–62`：现有TopologyIdentity有moduleName/nodeId；HTTP peerIdentity直接取这两项，不造配对身份规则。
- `runtime/src/features/slices/requestLedger.ts:L152–163`：原request ledger为persistIntent=never、syncIntent=isolated。`cleanupRequestLedgerActor.ts`和`findExpiredRequestLedgerIds.ts`已有有限清理能力；不新建grant结果缓存。
- `topology/src/application/createTopologyPeerCommandController.ts:L555–570`：普通peer command发送payload；目标使用本地Runtime command执行。短期grant应复用该通路，而不是发明“私密消费”接缝。
- `terminal-data-client/src/features/actors/terminalDataClientActor.ts:L681–765`：TDP根command结果可进入remoteOperations持久事实；因此根start/stop仍只回session/status/reason。`L930–1040`认证HTTP路径由TDC持有凭证并调用generated operation。
- LiveKit官方data packets说明reliable仅best effort、有限重传与指定destination。因此握手需要接收完成判据，但不需通用恢复框架。

Dexter在审查期间明确追加：

> 一定要符合TER整体架构的用法，不得再自创一套用法

> 保密根本不是我的需求，请不要过度设计

作者据此撤回初稿R08的“JWT不得进入任何Runtime结果”和“私密直达port通路”要求：它们并非用户需求，且会迫使新增业务传递机制。现稿R08 L189–193明确沿现有command/request/非持久ledger/peer参数；T01 L403只保留SDK/frame桥技术前置。R07、R08、R18、V13、T01及全部slice/日志表述已同根核查。权限/IAM、TDC凭证唯一owner、已有日志脱敏继续适用；不新增加密、secret vault或私密bus。

## 3. 可复用问题模式

本轮问题落入本需求的明确检查项和V03/V08/V10/V13：

1. 协议type允许的发送者必须包含真实调用链；正常端点间消息不能被泛化sender规则排除。
2. 消费者使用的身份/描述要有明示生产者和交付能力；不能用消息自报/数组顺序弥补缺字段。
3. 主状态和局部就绪分开；每个等待路径引用真实期限，不重开已结束会话。
4. 错误回执必须可从现有输入合法编码；不可关联就不造identity，主动取消关联已接受DOWN。
5. 跨接收者发送成功不证明对端已消费；复用已有有限回执，不新增协议族。
6. 临时授权不等于业务持久事实；遵循已有command/request生命周期，不能把作者的额外保密偏好升级为产品/架构要求。

这些是本期有限反例和review checklist，不修改规范/记忆，也不是新的通用机器门。后续实现测试需真正覆盖V场景；本轮测试源码/运行均NOT_RUN。

## 4. 残余与独立性

- T01–T04 OPEN：精确依赖/bridge、连续Window捕获、native输入与真实网络/释放。未从官方API存在推导可运行。
- IA、真实UI、V01–V15、部署及cleanup全部NOT_RUN；具体页面与权限控件仍需未来IA确认。
- review-standard关于L3非空与NO-GO的字面冲突保留为治理DESIGN_GAP，未改正本，不阻止记录真实S。
- R1只读review完成；本稿99a4…已交新fresh R2，从原材料独立形成结论后才读本intake。没有以作者CLOSED代替独立verdict。

## 5. R2有限授权交付：逐条处置

R2 S1=CONFIRMED。正式稿99a4中副机只有SDK grant，没有CBS应用授权剩余期生产—交付—消费路径；正常持续超过30s就可能误停，不是“保密”或极端情况问题。

作者最小修订（4fa449字节）：R07 L161把remainingLeaseMs随主机初始HTTP结果交付；R08 L191具名普通peer `confirmRemoteControlLeaseCommand`，只传sessionId、GRANTED/REJECTED、非秘密remainingLeaseMs和既有reason。join先返回STARTING，副机独立actor随后确认，无双方互等；MASTER读取自己的selector，不替副机续约CBS。R17 L333写明初始/后续来源、请求前本机单调t0、至多一项当前请求及迟到/失败/到期停止。V12增加正常持续>30s和失败/迟到反例。

分类：作者CLOSED；R3在形成独立结论前未读本intake，并静态确认当前4fa449链条无阻断。独立状态CLOSED。不新增DataChannel type、ledger、私密channel、token store或凭证。删除副机期限虽更少字数但弱化既有停止规则；复用原peer command是更小且完整的修法。

同根六路径：browser初始deadline、MASTER初始HTTP、SLAVE初始peer、MASTER续约、SLAVE持续peer、ACTIVE几何重握手均逐项重读；其余5条已核对，没有用JWT/KEEPALIVE替代授权。启动/READY/CONTROL_READY及普通peer actor/request契约重读，不要求native自动恢复框架。

## 6. 轮次授权与当前独立性

R1/R2按默认两轮记录；R2独立NO-GO及SELF_DECIDED旧字节边界不改。Dexter本任务已明确：“写好之后需要做几轮对抗性review，直到Go了之后，就按照项目话术要求组织话术把正式需求文档给另一个Claude做review”。因此R3为同cycle的明确追加授权，REVIEW_ROUND_EXTENSION=DEXTER_EXPLICIT_UNTIL_GO，不重置cycle，也不以作者自决代替新字节独立GO。

已交新的fresh只读reviewer核验4fa449全文与原材料；新增能力、UI、F/V和cleanup继续OPEN/NOT_RUN。

R3独立结论为GO_WITH_UNVERIFIED_UI 0M/0S/0N，已亲验4fa449 SHA；这里只引用独立结果，不由作者代写verdict。正式稿在该次审查后不改字节。T01–04与全部UI/运行继续OPEN/NOT_RUN，GO仅为后续详设输入，不是实施或运行授权。

## 后续字节提示（2026-10-10）

本文件上方 R1/R2/R3 及处置只对应各自旧 SHA。Dexter 后续明确要求按90%核心主流程简化；当前正式需求已删除副机周期租约确认与双层输入握手。新作者处置及当前 SHA 见 `doc/review/platform/2026-10-10-ter-remote-control-requirements-external-review-intake-claude.md`；当前修订字节尚无独立 verdict，不得把本文件的 R3 GO 当作当前字节 GO。
