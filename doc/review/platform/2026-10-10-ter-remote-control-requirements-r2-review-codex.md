# 远控正式需求独立对抗审查 R2

主 agent 忠实转录并压缩独立 reviewer `/root/remote_requirement_review_r2` 的报告。以下 verdict 对应修订前99a4字节；作者后续修订不能改写它。

```text
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_REQUIREMENTS_2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
ACTION_1_VARIANT=1-B 文档提取
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-remote-control-requirements-r2-input-checklist-codex.md
REVIEWED_FILE=doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md
REVIEWED_SHA256=99a4f9c0d10580cc52c4948aa093b0cf3d61a77f72d9f465bc08ffa7defbd1a3
BLIND_REVIEW=true
AUTHOR_INTAKE_READ_BEFORE_INDEPENDENT_VERDICT=false
AUTHOR_MATERIAL_READ_AFTER_INDEPENDENT_VERDICT=true
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=S1
L2_USER_VISIBLE=S1影响正常配对会话持续使用；真实UI与终端行为NOT_RUN
L3_UNVERIFIED=全部真实UI、SDK桥接、四拓扑、触摸、网络及释放NOT_RUN
EVIDENCE_TIER=READ_ONLY_STATIC_CURRENT_REQUIREMENTS_AND_SOURCE_WITH_OFFICIAL_DOCUMENTATION
IMPLEMENTATION_BUILD_TYPECHECK_TEST_VERIFY_DEV_WEB_ANDROID_L2_UAT_DEPLOYMENT=NOT_RUN
BUSINESS_DYNAMIC=NOT_RUN
CLEANUP=NOT_RUN
```

独立顺序：先读正式需求、原始需求/裁决、规则和当前源码，形成并提交NO-GO；随后才读R1/intake。主agent审查期间提示的lease候选修法不是当前字节事实，也没有作为关闭证据。未审查未来修订字节。

## 方案合理性

目标是运营后台远程协助：看到正确屏幕、操作TER正常控件，一个终端一个管理员，无终端批准或提示，任屏断连后结束并手动重发。现有TER command/selector、LiveKit媒体/数据、Window捕获与正常native输入的分工成立。只做视频不能满足操作；系统远程桌面会增加许可或系统提示；手动调用onPress不能等价覆盖拖动/滚动/虚拟键盘。

无需新增私密channel、JWT消费框架、第二token store、通用恢复或全局输入锁。现有Runtime非持久结果和普通peer参数可用；根TDP持久结果、日志及审计沿既有边界。

## S1：副机有限授权领取与持续确认契约缺失

位置（99a4字节）：正式需求R07 L161–162、165、169；R08 L179–189；R16 L311；R17 L325–331。

**事实**：拓扑登记输出只有description/grants，grant的expiresAt是SDK token期限；MASTER续约才输出remainingLeaseMs。副机join仅 `{description,grant}`，没有应用授权剩余期限或领取/确认command。KEEPALIVE/ACK只表示连通与输入就绪；R17却要求副机按当前CBS授权有限停止，且不允许收到时再加30s。JWT不能替代应用授权。[LiveKit官方tokens/grants](https://docs.livekit.io/frontends/reference/tokens-grants/)

**正常反例与影响（推论）**：配对正常持续超过30s，MASTER续约成功，副机仍无当前剩余期来源。保守实现误停全会话；宽松实现需擅自补协议或误用JWT/心跳。不是极端网络场景。

**最小修正**：明确MASTER初始消费哪次已有HTTP结果；副机沿普通peer command领取/确认当前session的非秘密剩余授权，给出输入/输出、peer身份、未知/到期停止与ACTIVE更新。join/confirm不能形成互等。MASTER既有状态接口足够；不新建通道、wire、副机binding或凭证。

**更小替代**：现有gateway增加一项明确领域command/结果，少于新框架。删除有限期限会弱化既有停止规则。**Dexter产品裁决：不需要**；severity仍由Dexter接受或调整。

同根六路径：Browser初始deadline已有；MASTER初始已有可复用状态输出但消费顺序需明示；SLAVE初始缺口；MASTER续约已有；SLAVE续约缺口；ACTIVE几何重握手已有有界规则，但依赖SLAVE期限来源。防再犯落点为本轮review checklist：逐实际端点核对初始来源、更新入口、session绑定与到期动作；心跳、SDK token、应用授权不能互替。

## R1独立关闭核对

| R1项 | 当前99a4核对 |
| --- | --- |
| S1 sender冲突 | CLOSED：R13 L260–267的8类矩阵包含端点间方向 |
| S2 描述/拓扑/grant | CLOSED：R06–09明确selector→登记→冻结description→端点grant，不凭媒体顺序 |
| S3 ACTIVE几何握手 | PARTIALLY：R11/R14/R17期限、暂停续约已补；副机期限来源残余并入本轮S1 |
| S4 错误/主动取消 | CLOSED：不可关联不造回执，未知协议结束，CANCELLED关联已接受DOWN |
| N1 READY到达顺序 | CLOSED：各endpoint ACK.readyStreams证明消费后开放输入 |

8消息、6HTTP、4拓扑及握手/错误/取消逐一核对。reliable发送不是必达：[LiveKit data packets](https://docs.livekit.io/transport/data/packets/)。

## 模板、未验证与治理边界

四模板按章节核对适用性：本次正式需求涵盖用户任务、actor/scope、边界/裁决、owner、协议、状态、验收与OPEN；未来Journey/IA/UI/implementation-facing详设的元数据、14维矩阵、逐屏容器、线框/TestId、Heritage搬运、CP/owner写/同步/迁移/seed/预算/双读/对账和交付槽位不属于本轮工件，NOT_APPLICABLE_WITH_REASON。已退役Manifest B.4/B.5不恢复；没请求高保真，不视为缺项。详细已读范围见checklist。

测试已证：无。UI、SDK/frame桥、持续捕获、MotionEvent、网络、释放全部OPEN/NOT_RUN。[PixelCopy官方API](https://developer.android.com/reference/android/view/PixelCopy)仅证明路线存在。[Expo官方接入](https://docs.livekit.io/home/quickstarts/expo)需要native development build，不证明本仓Expo57/RN0.86.3兼容。

review-standard L172的L3/verdict字面冲突单列治理DESIGN_GAP；真实S存在时保持NO-GO，不以未运行UI掩盖阻断。S关闭后静态结论最多GO_WITH_UNVERIFIED_UI。
