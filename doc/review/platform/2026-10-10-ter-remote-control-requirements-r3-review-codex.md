# TER远控正式需求：R3 fresh独立审查

主agent忠实转录独立reviewer `/root/remote_requirement_review_r3` 的当前字节结论。reviewer未写文件，未读作者intake或历史verdict；主agent不代写独立verdict。

```text
REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_REQUIREMENTS_2026-10-10
REVIEW_TARGET=DESIGN
REVIEW_ROUND=3
REVIEW_ROUND_EXTENSION=DEXTER_EXPLICIT_UNTIL_GO
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=先读取原话、规范与源码独立形成verdict；未读作者intake或历史verdict
authorMaterialReadAfterIndependentVerdict=false
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-remote-control-requirements-r3-input-checklist-codex.md
REVIEWED_SHA256=4fa449bfc45adb6c64ae229ad09bf3a01ac23550e0d070a3611c11fc49cd1730
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS_AT_REQUIREMENTS_STATIC_TIER
L2_USER_VISIBLE=PASS_AT_REQUIREMENTS_SEMANTICS_ONLY
L3_UNVERIFIED=精确SDK兼容/轨道桥、持续双Window、真实触摸及本地并用、ICE/TURN网络与断连、后台交互、资源释放/cleanup
SAME_ROOT_SCAN=R01～R20、V01～V15、T01～T04及四拓扑；无确认finding
DESIGN_GAPS=NONE_AT_REQUIREMENTS_TIER；后续IA/UI/详设与技术前置待履行
EVIDENCE_TIER=SOURCE_ONLY_STATIC_REQUIREMENTS_REVIEW
IMPLEMENTATION_BUILD_TEST_VERIFY_DEV_WEB_DEVICE_L2_UAT_DEPLOYMENT=NOT_RUN
CLEANUP=NOT_RUN
```

Dexter明确要求“做几轮对抗性review，直到Go”，本轮使用该追加授权，沿同cycle编号，不重置默认两轮；R1/R2旧SHA的NO-GO保留。

## 关键证伪结果与事实来源

| 攻击点 | 当前核验 |
| --- | --- |
| 初始有限期限缺来源 | R07 L161、R17 L333：MASTER初始HTTP，副机初始/后续peer；不依赖JWT/KEEPALIVE产生业务资格 |
| 双方互等 | R08 L191：join先返回STARTING，副机独立actor随后confirm，不放进join嵌套等待链 |
| 正常持续>30s必停 | R17 L327–333：MASTER10s续约、副机10s确认；30s是有限租约而非整场寿命 |
| 时延越过CBS截止 | L333：请求前单调t0加剩余期，不从接收再加30s，迟到request/session无效；具体桥接T04 OPEN |
| 几何重建无限等待 | R11 L229、R17 L327/333：使用变化前剩余期限且暂停更新；实际断连直接结束，无恢复状态/调度平台 |
| 为保密自创通路 | R08 L193–195允许非持久request及peer；Runtime requestLedger当前L145–153为persistIntent=never/syncIntent=isolated；peer已有command-request/actorResults |
| 嵌套token进入根持久结果 | TDC actor当前L681–804收口根command actorResults；Runtime按command区分结果。需求根start/stop只回session/status/reason，嵌套对象不拼根结果，无需改全部Runtime |
| 两屏身份/输入混淆 | R10同机同participant的Activity/Presentation；paired两participant各自Activity；Window registry真实ownerWindow与snapshot，Topology facts提供实际角色/屏数/accepted peer，不造slave CBS terminal |
| 任一屏断后降级继续 | R09/R10/R16/R17/V07要求整会话两屏停止/释放，手动新session，无主屏继续分支 |

没有确认finding，无需进一步修改正式稿。上表前六项为当前需求静态事实与链路推论，不是当前生产实现已完成的证明。

## 方案合理性

目标是管理员查看并操作TER。原项目列表/详情动作进入工作区减少新增页面与角色选择；CBS复用terminal-control，TER沿command/actor/selector/port/adapter，LiveKit负责媒体。租约/watchdog仅服务断连释放与独占，未扩为通用平台。保留已有日志与权限，不把“保密”升级新产品目标。

工程数值有文内定位：30/10/15s有限释放、2s×15启动等待、4096bytes消息、30move/s/64条输入、3s回执/10s手势、1280px/15fps初始适配目标；均非实测SLO或隐藏业务限制。

## 模板覆盖

| 模板 | 当前逐节适用性 |
| --- | --- |
| Journey | §1元数据/授权、§2任务、§3前提、§4边界、§5语料、§6后续UI、§7裁决有需求事实；独立Journey模板及完整分类表N/A，本轮不是Journey工件 |
| IA | §1元数据、§2维度、§3共享、§4错误、§5对账、§6完成均N/A于需求工件；R01/R02/§11明确后续IA确认 |
| UI | §1/1.1/1.2、§2–8、§10 N/A于需求工件；§9可选；线框/roster/TestId/焦点/逐项文案未声称已接受 |
| implementation design | §0–14及3a/9a/9b/10b/11a/13b/13c N/A于本轮需求工件；需求给owner/协议/失败/验收输入，不代替详设 |

两份需求材料现行语义对齐operations-admin、应用内无感、本地远程同时操作、插件参考、手动新发起、配对任屏断连全结束。

## 未验证

T01–04、真实UI、SDK桥、native视频/触摸、网络/cleanup均OPEN/NOT_RUN。本轮只放行需求作为后续详设输入，不授予任何实施或运行权限。未读.runtime，未安装/生成/编译/测试/verify/DEV/设备/L2/部署或数据操作。官方资料与实际读取边界见checklist。
