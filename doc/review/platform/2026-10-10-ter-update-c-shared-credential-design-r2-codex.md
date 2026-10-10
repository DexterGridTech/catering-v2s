# 阶段C共享凭证独立DESIGN审查R2

主agent转录reviewer `/root/c_shared_credential_design_r2` 的结论、finding及核验摘要；完整原始输出留在会话。非作者代写verdict。

REVIEW_CYCLE_ID=TER_UPDATE_C_SHARED_CREDENTIAL_DESIGN_2026_10_10  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
ROUND_FINAL_DECISION=SELF_DECIDED  
reviewerInputChecklist=doc/review/platform/2026-10-10-ter-update-c-shared-credential-design-r2-reviewer-input-checklist-codex.md  
blindReviewDeclaration=先读当前工件/原输入/规范/owning source形成独立结论，留下消息证据，之后才读R1及作者intake  
ACTION_1_VARIANT=1-B  
VERDICT=GO_WITH_UNVERIFIED_UI  
M/S/N=0/0/1  
L1_ENGINEERING=无确认阻断；N-01正本维护定位需补齐  
L2_USER_VISIBLE=邀请/两按钮/本机PRIMARY/副机admin只读及主机报告静态一致；真实呈现未验证  
L3_UNVERIFIED=真实Web/Android/配对/HTTP/TDS/迁移/cleanup全部未验证  
SAME_ROOT_SCAN=CBS/TDS认证、cancel、13HTTP、credential同步/持久/角色、B下载链及六工件  
DESIGN_GAPS=无新增产品判据；N为既有裁决的出处及维护清单  
TEMPLATE_COVERAGE=四设计模板及实施模板适用槽位逐项提取  
EVIDENCE_TIER=READ_ONLY_DOCUMENT_AND_OWNING_SOURCE  
IMPLEMENTATION/GENERATION/COMPILE/TEST/VERIFY/DEV/WEB/L2/ANDROID/UAT/CLEANUP=NOT_RUN  
RUNTIME_READ=NOT_PERFORMED  
FILESYSTEM_WRITE=NONE

## N-01 维护清单错指取消条款及同根遗漏

位置：详设§12.1 L517，仓根路径 `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`。

事实：写R-2.2删除cancel device body；原激活需求 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:138` 是R-3.1。其:132的R-2.3仍要求persistSecure，:581/582 V-B4仍为CBS旧device拒绝。R-2.2:124设备用途应限TDS/R-1.6bootstrap；V-S2:641/642 TDS反例应保留。

影响/推论：若机械按当前点名正本维护，取消输入、plain及CBS验收会留旧规则。详设284–295及计划42–45已经给正确行为及成对focused，没有形成错误实现方向，定N。

最小修正：只补§12.1，点名R-2.2/2.3/3.1/4.7/V-B4/V-S2各自修改或保留动作，保留日志禁令、bootstrap、取消锁/审计/通知及TDS判据。无需Dexter新决策。主agent修后记录新SHA；本verdict不宣称又有修后独立审查，不增加DESIGN轮次。

## 独立源码及方案核验

现有Credential必填deviceId，Decision在当前代次/正确摘要后比较设备；TDS codec构造同Credential，handler:417调用verify。当前详设295的CBS具名BusinessCredential/verifyBusinessCredential与TDS原verify(Credential)明确分开，复用同owner查询/分类，将设备判断放回TDS原顺序。cancel只原1/2步，不套enabled，锁/事务/审计/notify保留；无第二认证owner/模式平台/查询链。R1 S01在当前冻结字节已关闭。

13项caller：九read/grant两端，activate/cancel/report主机；TDS/topic/PING不开放。业务feature仍主机投影。apply不等于flush；资格同步失效、保存后身份重读，副机inactive/stopped；复用state同key跨storage先写后删；解绑/换主机先清/flush后角色转换、旧连接epoch隔离，瞬断保留credential直接CBS。B真实链update actor:876–945本机TDC grant→fullManifestFromGrant→原prepareArtifact，Android原manifest/entry/摘要/FULL/HOT核。无需peer grant或trusted-summary新平台。

三问：任务是同terminal副机直CBS；一个record、现有sync/迁移/flush/TDC HTTP/Preparer更小；保存失败、迟到apply、解绑、CBS无device/TDS错device及13caller都有有限反例。两Web＋四设备矩阵未扩大；不继承旧PASS。

## Action1B/模板覆盖

提取了六字段/null、唯一TDC owner、plain、持久完成门、13caller、两用途、瞬断/解绑差别、CBS短期grant/完整manifest。剩余是接线和真实行为验证，无未决产品选择。

Journey1–7：metadata/任务/前提/actor/corpus/边界/裁决；IA1–6可见/不可见维度、来源/owner/规模/失败；UI1.1/1.2及2–10邀请按钮/copy/surface/容器/状态/合理性/TestId，输入/搜索/动态表单具名N/A；详设0–14（3a/9a/10b/11a/13c）及实施模板双读/focused/完整CPfresh/全批6b/准入/日志/cleanup均覆盖。不把静态覆盖称运行通过。

## 冻结SHA（主agentN修前）

| 工件 | SHA256 |
| --- | --- |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md | c1d6a2d0d2f8587705521e44a7b367dbeb24d21386407a7c36a58274d282b648 |
| 同前缀 implementation-plan | 27ea79657d9edc200cde2b75239bedc329acffa82916fb6f0c17fc13e0285582 |
| 同前缀 source-and-api-appendix | 958ae6ade06ebf162583c732d4b6e8efd9e3999410336249b3d648c20e0a2fc7 |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md | 4565fe9227b8fcba80cd98dd278331116ee534c5084720e9128293b4423ffac7 |
| 同前缀 ia | 09b7a948cc1ac56e65808413a14b320211f5b6b0fcf0b3b72eb192cef26d7d8f |
| 同前缀 ui-interaction | 0f76015acf8426ff5115480e7434021db0d596006d12e2f224680c4fe32cb8fe |

六件全文及SHA均亲读匹配。本轮无任何实现/测试/运行，未读.runtime，未写文件。
