# 阶段 C 共享凭证设计独立审查 R1

本记录由主 agent 转录独立 reviewer `/root/c_shared_credential_design_r1` 的结论、finding与核验摘要；完整原始输出保留于本会话。不是作者代写 verdict。reviewer 全程只读，无写入、无动态。

REVIEW_CYCLE_ID=TER_UPDATE_C_SHARED_CREDENTIAL_DESIGN_2026_10_10  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-update-c-shared-credential-design-r1-reviewer-input-checklist-codex.md  
blindReviewDeclaration=先以证伪立场独立形成findings/verdict，未读历史review及作者intake；不继承作者结论  
authorMaterialReadAfterIndependentVerdict=false  
ACTION_1_VARIANT=1-B  
VERDICT=NO-GO  
M/S/N=0/1/0  
L1_ENGINEERING=S-01：共用verifier修改改变TDS服务端设备认证语义  
L2_USER_VISIBLE=邀请、两按钮、本机PRIMARY、副机admin只读及R15主机报告已静态对读；真实行为NOT_RUN  
L3_UNVERIFIED=所有Web/Android/配对/HTTP/cleanup；不是额外finding  
SAME_ROOT_SCAN=共享API/Service/Decision/cancel/13项HTTP caller/TDS codec与handler  
DESIGN_GAPS=无新增产品判据；CBS/TDS认证用途必须明确区分  
TEMPLATE_COVERAGE=四模板及实施模板适用槽位均已提取；§8.6.2/§9a认证用途受S-01影响  
EVIDENCE_TIER=READ_ONLY_SOURCE_AND_DOCUMENT  
IMPLEMENTATION/GENERATION/COMPILE/TEST/VERIFY/DEV/L2/ANDROID/UAT/CLEANUP=NOT_RUN  
RUNTIME_READ=NOT_PERFORMED  
FILESYSTEM_WRITE=NONE

review-standard的非空L3标签不能覆盖真实S；本轮按指派保持NO-GO。仅在阻断消除后才可GO_WITH_UNVERIFIED_UI，不意味着实施或动态通过。

## 冻结字节

| 工件 | SHA-256 |
| --- | --- |
| 详设 `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md` | 1c2a9935e2fe630ed27b82f2f916f99c18fa38725f1fcc4db2d72993bf6e65ff |
| 计划 同前缀 `implementation-plan` | 1d39feade0d42bd66e78fa9aa89c5cc2951e24a0f20a23de567fb3bcb18a918b |
| 附件 同前缀 `source-and-api-appendix` | 83672f6e436d1d70f3554a711961410af44e1c0b36e09cb142542f972e556e5a |
| Journey `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md` | 4565fe9227b8fcba80cd98dd278331116ee534c5084720e9128293b4423ffac7 |
| IA 同前缀 `ia` | 09b7a948cc1ac56e65808413a14b320211f5b6b0fcf0b3b72eb192cef26d7d8f |
| UI 同前缀 `ui-interaction` | 0f76015acf8426ff5115480e7434021db0d596006d12e2f224680c4fe32cb8fe |

六份均由reviewer全文读取并复算匹配。

## S-01 CBS-only裁决扩展为TDS服务端认证变更

性质：冻结设计事实＋当前生产源码支持的确定性反例推论；未运行。

设计位置：详设§8.6.2 L295、§9a.6 L369；计划CP01第7项L42及focused L45；附件§2.0 L45。

源码位置：`apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalCredentialVerificationApi.java:11,30`共同verify及必填deviceId；`application/TerminalCredentialDecision.java:22`当前generation/正确digest仍比较boundDeviceId；`application/TerminalCredentialVerificationService.java:23`将deviceId送入共同分类核。`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionFrameCodec.java:57,70`读取deviceId并构造同一Credential；`websocket/TdsWebSocketHandler.java:417`真正调用verify，431–435注册已认证连接。

反例：当前ACTIVE、正确generation/secret、启用范围，但AUTHENTICATE携带另一deviceId。当前Decision拒绝；按设计删除共同设备比较后TDS会接受。TER主机gate与保留协议device字段均不能保留服务端判据。

影响：CBS裁决被扩展到TDS，CP01无用途区分的focused会固化越界预期。

最小修正：同terminal-binding owner内明确CBS credential-only与TDS device-match入口，复用同一事实查询与generation/digest/撤销/有效状态分类核。cancel按CBS修改，锁/审计/通知保留。成对反例：CBS有效凭证无device头/不同device头均不受影响；TDS正确设备通过、错误设备及缺失/非法字段仍拒绝；两用途错误secret、旧generation、结束binding、禁用状态拒绝。无第二认证平台、事实存储、主机relay或通用模式框架。

Dexter决策：当前CBS-only裁决足够修正，无需重复裁决；如欲放宽TDS则需新明确裁决。

同根全集：九read、grant、report、cancel共12项CBS后续操作适用credential-only；activate保留bootstrapdevice；verify/classify两用途区分；TDS codec/handler保留device判据；isCurrentActiveBinding/lockCurrentActiveBinding保留状态/锁；content保留短期grant/scope。其余12项TER operation与activate已按13项全集逐一核对，不许可整包删MASTER gate。防再犯落在现有认证tests和review checklist的成对用途输入，不建新门。

## 文档提取、模板与方案判断

credential完整六字段/null单entry、原TDC唯一owner、updatedAt=0 authoritative顺序、非持久credentialReady、flush后identity重读、SLAVE inactive/stopped、断链HTTP与业务readiness分离、解绑clear/flush先于角色、plain原能力迁移、CBS短期grant/完整manifest/native原核、13项caller和正本OPEN均已独立对读，无其他确认阻断。

模板覆盖：Journey §1–7/corpus/前提链；IA §1/§2.1/§2.2/§2.1.1/§3–6；UI §1.1/§1.2/§2–10与ownership、copy、mutation、roster；详设§0–14（含3a、9a、10b、11a、13b/13c）；实施模板逐点双读、focused、完整CP/全批三维与cleanup。无输入/搜索/动态候选、高保真按既有任务具名N/A；仅认证用途受S影响。

可见提取：本机PRIMARY既有alert，“稍后/安装”两个local command，当前/目标版本及N分钟，task/action/boot隐藏owner身份，admin上层，HOT无邀请。没有新增凭证显示、副机取消/报告入口或手工坏包重试。

方案合理性：原TDC一个record＋现有plain/flush比第二store或relay小；资格/roleepoch针对真实保存和解绑竞态；同owner两个认证用途更小且不会放宽TDS。副机admin只读和主机报告有原需求来源，不因HTTP能力推导新权限。

## 未验证

测试已证无。本轮只证设计/source结构；真实UI/按钮/焦点/点击、FULL安装/N、HOT闲时、迁移/flush/reload、双机网络/解绑/迟到apply、CBS真实HTTP/TDS设备反例、生成消费者、四run资源及cleanup全部NOT_RUN。不以此另立finding。
