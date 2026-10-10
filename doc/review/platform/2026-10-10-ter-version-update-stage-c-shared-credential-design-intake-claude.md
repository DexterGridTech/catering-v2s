# TER 更新阶段 C：共享终端凭证设计修订与处置

REVIEW_CYCLE_ID=TER_UPDATE_C_SHARED_CREDENTIAL_DESIGN_2026_10_10  
REVIEW_TARGET=DESIGN  
INTAKE_OWNER=CLAUDE_MAIN_AUTHOR  
AUTHOR_SESSION=续接；本记录不是独立verdict  
LAST_INDEPENDENT_VERDICT=R2_GO_WITH_UNVERIFIED_UI_0M_0S_1N
CURRENT_FINAL_BYTES_INDEPENDENT_VERDICT=NONE_AFTER_N_REFERENCE_ONLY_CORRECTION
AUTHOR_CLOSEOUT=SELF_DECIDED_NO_CONFIRMED_BLOCKER
DESIGN_CYCLE=CLOSED_ROUND_2_NO_REOPEN  
IMPLEMENTATION/GENERATION/COMPILE/TEST/VERIFY/DEV/WEB/DEVICE/RESET/SEED/L2/UAT/CLEANUP=NOT_RUN

## 1. 当前授权与产品输入

Dexter要求修订阶段C详设/计划及必要映射，以PROPOSED共享凭证提案为输入；随后明确“主机通过激活获取了凭证，后面CBS鉴权的时候，应该只校验凭证即可”“所有的修改，都纳入到阶段C的范畴”。最后授权：修订后进行几轮对抗review，无问题后回复Codex按最新设计完成目标交付。本会话Claude只改设计文档/处置记录，不改需求正本、规范、源码、测试、依赖，不执行动态。Codex审查无阻断后的委托包括本次C明确列出的正本维护、认证契约及源码目标；不是另拆批次或替代历史C验收证据。

本轮实质新增credential共享及CBS认证scope，使用上述新cycle，最多两轮。不重开旧C、project-basic或提案cycle；提案的两轮GO不迁移成本包verdict。

## 2. 主agent核验与最小修改

| 输入/问题族 | Disposition | 当前源码事实及最小C修订 | 剩余边界 |
| --- | --- | --- | --- |
| 主机逐次relay、副机不能直接CBS | CONFIRMED/CLOSED_AT_DESIGN | 原设计§8.6/计划CP04用requestPeerTerminalUpdateSourceCommand；删生产relay及专用summary分支。各机本机TDC取得CBS grant/完整HTTP manifest，沿原Preparer。CBS短期download grant/content校验保留。 | 未实现，原relay source是否已经写入由Codex重开，删除实际全集 |
| credential唯一owner/单entry | CONFIRMED/CLOSED_AT_DESIGN | TDC原slice protected/isolated；改plain及credential-only authoritative record，不复制其他字段或status；副机仍inactive/stopped，普通HTTP凭证资格分开。 | sync/flush/初始化接线NOT_RUN |
| plain持久化迁移 | CONFIRMED/CLOSED_AT_DESIGN | state现有同key相反storage读回、先写后删；只改credential descriptor并flush，拒绝另造迁移框架。 | 旧存储故障、新存储写失败/删除失败由focused验证 |
| apply非持久成功 | CONFIRMED/CLOSED_AT_DESIGN | StateRuntime/Topology applied不等待flush；TDC先失效资格、owner flush＋完整identity重读后开放/发布；不用通用sync ACK。 | 真正保存时序未运行 |
| 普通断链与显式解绑 | CONFIRMED/CLOSED_AT_DESIGN | topology瞬断留pair，unpair当前未清TDC；共享值保留可直接CBS，显式解绑/换MAIN先TDC command清并flush才改角色，失败不推进、旧apply失效。 | 原注入接缝需C实现 |
| CBS只凭证 | DEXTER_DECISION/INCORPORATED | 旧Verifier/Decision及cancel body仍要求deviceId。本会话覆盖提案master device建议；九GET/grant/report/cancel/generated统一移除设备认证。保留bootstrap真实device输入及scope/有效binding/锁/撤销。 | shared API/TDS消费者边界交独立审查，正式正本未同步 |
| 13项caller闭集 | CONFIRMED/CLOSED_AT_DESIGN | 九GET＋grant两端；activate/cancel/report主机，TDS/topic/PING不放开。cancel沿既有副机admin只读正式需求，不做local reset/peer代取消。 | 仅设计约束，不声称当前13项gate已修 |
| 正式需求R07/R08未同步 | OPEN_SOURCE_SYNC | 详设§12.1列确切新增文本及原激活/规范/canonical同根维护，统一C CP01准入。原提案仍PROPOSED，旧device建议显式被新裁决覆盖。 | 当前未改正本；Codex按最新委托先维护再实施 |

更小方案比较：原TDC一个record/plain descriptor、现有flush/迁移、现有CBS verifier和下载器足够；拒绝第二credential store、全slice复制、每请求MAIN授权、secret envelope、通用迁移/恢复/同步ACK、独立副机binding、恶意归档专项。新clear command只服务真实角色转换风险，不新增root reset或扩大TR-09retain。

## 3. 同根范围

已核对13个generated CBS operation、原TDC credential与非秘密status投影/持久字段、Topology正常断链/显式解绑/换主机、两assembly初始投影、CBS共用认证/cancel/grant/report/TDScodec消费、FULL/HOT普通校验和四run矩阵。正文、计划、Journey、IA、UI差量声明、附件全部交叉读回。既有store/project业务资料仍MASTER HTTP/topic、SLAVE projection；开放TDC普通HTTP能力不等于为副机新增主动feature查询。

## 4. 独立审查与处置

R1独立reviewer `/root/c_shared_credential_design_r1` 为NO-GO 0M/1S/0N，报告与实际输入清单在 `2026-10-10-ter-update-c-shared-credential-design-r1-codex.md` 及同前缀 `r1-reviewer-input-checklist-codex.md`。原SHA固定在R1报告，不追写为当前字节。

S-01=CONFIRMED。主agent亲读VerificationApi/Service/Decision及TDS codec/handler，确认正确secret/generation＋错device当前由Decision拒绝，共同删条件会放宽TDS。最小修法：同owner保留TDS原verify(Credential)，加CBS具名verifyBusinessCredential(BusinessCredential)；复用同一事实查询/分类核，TDS专用设备检查保持原判定顺序。CBS edge/cancel不核设备，cancel保留只第1/2步与锁/审计/notify。已改详设§8.6.2/§9a.6/§11/§12.1、计划CP01/focused、附件§2.0；无第二认证平台/通用模式/额外查询。其余12个HTTP operation及TDS两个真实consumer、取消owner、状态/锁和content grant已同根核对。防再犯由既有CBS/TDS认证tests成对输入＋review checklist承接。

同时把原配对R12/R13与激活R2.2/R4.7正本维护列到§12.1：CBS与TDS设备判据明确分开，不能仅修改更新需求。此为C执行清单，本轮未改正本。后续委托措辞明确为review无阻断后先维护再实施，避免重新索要已明确的授权。

R2独立reviewer `/root/c_shared_credential_design_r2` 已完成，GO_WITH_UNVERIFIED_UI，0M/0S/1N；报告/实际input checklist见 `2026-10-10-ter-update-c-shared-credential-design-r2-codex.md` 与同前缀 `r2-reviewer-input-checklist-codex.md`。独立读取当前工件和source后才读R1/intake；当前S01关闭。

N01=CONFIRMED/CLOSED_AT_DOCUMENT。亲读原激活需求L124/132/138/581–582/641–642，确认取消输入实际R3.1，不是R2.2。只改详设§12.1 L517维护清单：R2.2限TDS/R1.6bootstrap；R2.3 plain；R3.1 cancel无device；R4.7区分用途；V-B4同步CBS旧反例；V-S2保留TDS反例。同族其余13项caller/§8.6/CP01行为与focused不变，原配对R12/R13行保持。正本未写，本次未改变任何设计行为、源码、场景或验证矩阵。

两轮已关闭，不开第三轮。R2 verdict仍绑定修N前SHA；最终字节仅引用/维护清单作者修订，INDEPENDENT_VERDICT=NONE，不把作者收口伪成新独立GO。作者基于已核实处置按SELF_DECIDED记录无确认阻断；真实UI/实现/动态仍NOT_RUN。Dexter当前委托满足按最新包转交Codex继续C的条件。

| finding | 最终处置 | 位置 |
| --- | --- | --- |
| R1 S01 | CONFIRMED/CLOSED_AT_DESIGN，R2独立已核 | 详设§8.6.2 L295、§9a.6 L369、§11 L441；计划CP01 L42/L45；附件§2.0 L45 |
| R2 N01 | CONFIRMED/CLOSED_AT_DOCUMENT，R2后仅源定位补正 | 详设§12.1 L517 |

### 最终六工件SHA-256

| 文件（仓根相对） | SHA-256 |
| --- | --- |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md | 559f8784f7df31946b022cacf4534fb5e2d2cf4161caeee5b3b23d54eafdf658 |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md | 27ea79657d9edc200cde2b75239bedc329acffa82916fb6f0c17fc13e0285582 |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md | 958ae6ade06ebf162583c732d4b6e8efd9e3999410336249b3d648c20e0a2fc7 |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md | 4565fe9227b8fcba80cd98dd278331116ee534c5084720e9128293b4423ffac7 |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md | 09b7a948cc1ac56e65808413a14b320211f5b6b0fcf0b3b72eb192cef26d7d8f |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md | 0f76015acf8426ff5115480e7434021db0d596006d12e2f224680c4fe32cb8fe |

本次变更仅六工件及review/intake。两名reviewer均声明零写入，实际写入全部由主agent完成；并行source scout的结果仅作导航后已重开核实。未运行脚本/测试/生成/构建/verify/动态，除纯读取memory route及hash；未读取.runtime。当前task文档与两轮review完成，无active goal，无剩余需执行实现动作；实现责任转交Codex，未验证项目不被关闭为PASS。

## 5. 已核实与未验证

已核实只是源码结构及文档映射：原TDC归属/descriptor、state同步与迁移能力、当前认证设备比较、generated catalog、取消/root reset反例、原driver/device矩阵。所有新源码、契约生成、保存/HTTP/原生安装、实际UI、两Web/四device、fixture和runner cleanup均NOT_RUN。静态设计可接受不代表C交付通过，不继承旧A/B/C运行或作者声明。
