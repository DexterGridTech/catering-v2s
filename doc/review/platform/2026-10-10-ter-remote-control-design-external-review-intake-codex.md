# TER 应用内远程控制外部评审：主 agent 辩证处置

REVIEW_TARGET=DESIGN
reviewerKind=AUTHOR_INTAKE
CURRENT_BYTES_INDEPENDENT_VERDICT=NONE
AUTHOR_READINESS=EXTERNAL_STATIC_RECHECK_RECEIVED_NONBLOCKING_N_FIXED
IMPLEMENTATION_AUTHORITY=false
EVIDENCE_TIER=STATIC_DOCUMENT_SOURCE_READBACK

## 1. 输入与判断边界
外部报告为 `doc/review/platform/2026-10-10-ter-remote-control-design-external-review-claude.md`，原始 NO-GO、0M/1S/2N 保持不变，只对应原六工件 SHA。Dexter转交时说“仅供参考，需要你自己判断”。主agent亲自重开下面的源，不由作者处置或reviewer声明推导结论；本文件不是独立verdict，不重开内部已结束的两轮cycle。
本次选择最小文字修法：维持现有PG/TDP资格判定；区别隔离L2与DEV父run；明确各端清理的观察者。不新增数据库列、第四状态、heartbeat公式、runner、cleanup协议或恢复框架。

## 2. 三项 disposition
| 输入 | classification | 状态 | 源码事实与影响 | 最小修订及当前位置 | 更小替代与边界 |
| --- | --- | --- | --- | --- | --- |
| S-1 | CONFIRMED | CLOSED（文档层）：Dexter确认三态，正式需求及六工件已同步 | `apps/backend/catering-business-server/src/main/resources/db/migration/V20260926_000000_000__terminal_binding_owner.sql:141` 全表没有device/generation；`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/persistence/TerminalControlPersistence.java:24` ACTIVE binding及`:35`同scope未断session；`application/TerminalControlOwnerService.java:57`按此投递。原设计无法比较不存在的列，UNCONFIRMED无合法fixture。 | 详设§6.3:114、§9a:215、§10b.3:233；计划CP-02:43/CP-04:66；IA:19/49；UI:20/§5；附件§3a:94/§6:227。只取NOT_ACTIVATED/OFFLINE/ONLINE并同步DTO、文案、错误及fixture；保留observedAt/evaluatedAt、30秒失败边界。 | 不给TDS表加列、不改既有claim保护。`V20261004_020000_000__terminal_control_online_operations.sql:59`分别校验最新node/session/sequence及binding generation，不能为了减少状态去掉这些身份复核。Dexter已授权并完成需求正本三处同步；不扩大到源码或动态执行。 |
| N-1 | CONFIRMED | CLOSED（文档层） | `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts:349`父run能力直接chromium.launch，`:351`创建context；现有隔离browser-l2与DEV/device不属于同一后端生命周期。原附件会误导嵌套启动第二栈。 | 附件§7:237；计划CP-05:74。隔离L2使用browser-l2 runtime；DEV/device由terminal-automation父run直接通过Playwright拥有browser/context，只借用已有DEV的Vite/tunnel，统一本run清理。 | 复用已有Playwright与父run；不新增runner、不停止借用DEV、不把DEV标签说成隔离L2。browser失败必须进入本run cleanup判定，不能复制旧源码的静默吞错。 |
| N-2 | PARTIALLY_CONFIRMED | CLOSED（文档层） | 详设§8.3:176的TER slice有cleanup，本地port有cleanupFacts；附件§3的report body仅sessionId/state/reason/readyScreens，不能凭CBS ENDED证明TER capture/track/Window已释放。需求R-17要求失败可见，并未要求所有本机释放事实回传后台。 | Journey:18；IA§4:44；UI§5:149–151；详设§6.2:112/§8.7:196。后台文案只指浏览器本地Room/track；TER结果经selectRemoteControlStatus.cleanup及结构化日志由automation断言；CBS外部清理故障只作服务端诊断。 | 只写清观察边界；无需新report字段或ENDED后追加上报，也不把该推论升级成当前实现失败。 |

行号是本次读回导航，修改时仍按章节/symbol重开。CLOSED只指设计表达，不指源码实现或动态验收。

## 3. 同根扫描与防再犯
S-1有限六组：列表page/detail读模型、start资格、HTTP错误闭集、IA/UI文案、组件/acceptance oracle、seed/fixture。六组逐一重开；正式需求与六工件均已删除旧状态及其error增补。集合读取失败仍按typed503/原读错误处理，不造第四种连接状态。绑定失效、session取代、不同target的IDENTITY_CONFLICT保留，不与虚构的CONNECTION_UNCONFIRMED混淆。源表缺列只是本次实现可行性证据，不能一般化为“源码没有就删除用户功能”；若Dexter要真实第四态，应先裁决其可观察事实及范围。
N-1核对附件§1控制面、§4b bindings、§7生命周期、计划CP-05、§10.1/10.2；其余五处逐一检查，隔离L2只出现在独立L2执行面。借用与owned资源分开，不建第二账本。
N-2核对Journey失败、IA错误、UI表/线框、详设GET/结束/selector/port、计划CP-03及§10.3、附件report body；剩余成员逐一检查。保持每端资源观察来源和cleanup聚合，不用业务ENDED冒充资源PASS。
防线只落本包review checklist：任何新判定列必须重开DDL和writer；每种运行注明父run/借用资源/cleanup owner；每条可见故障注明由谁观察与现有协议是否携带。未来既有focused测试分别覆盖三态、borrowedDEV不回收、浏览器和TER清理分别失败；当前均NOT_RUN，不新增机器语义门或项目平台。

## 4. Dexter已确认的正本同步
本次追加原话：“同意同步正式需求，删除‘状态待确认’，统一为未激活、离线、在线三态。把需求、详设、实施计划和话术同步好，再给另一个Claude做review。”
先前只读需求SHA为16e4c8474310caad0f6acfeafb34bfd8b74445b6d86f4eee1304e79b47b10ca7；该旧字节及原review verdict只作历史，不覆盖当前结论。
1. R-01：删除旧状态行；无有效ACTIVE binding为NOT_ACTIVATED；有效ACTIVE binding但同scope latest_state无行或已有断开事实为OFFLINE；有效ACTIVE binding及未断开latest_state为ONLINE。
2. R-02：只有NOT_ACTIVATED/OFFLINE禁用远控；ONLINE点击仍经CBS再次核验，未改变占用和授权语义。
3. R-20：删除CONNECTION_UNCONFIRMED；其他IDENTITY_CONFLICT、占用及失败码保留。
三项正本同步及详设/计划待确认标记清理已经完成。讨论稿与原review/history保持历史原文。当前三态来自Dexter裁决，不再是作者候选；不扩授权到其他产品语义、源码、生成或运行。

## 5. 当前SHA-256
| 文件 | SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md` | `af08128a81981c317cd5a3b1309a312bed3433a3747d86a30b53766c73662a19` |
| `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md` | `67e71776f635ac819f2a85e99745e9845d2eaea0eea92114e0d67f069edcbdb9` |
| `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md` | `380cd3371762db2123be6f74f0361ca62482d0f80beda5c67912463efb6edb9c` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md` | `8b1419533246088695ac24323f842ca4896b6c3f66ba028b2bf1285d81f2165c` |
| `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md` | `a7ff8df7c0d276a1d061ae049abcaf4f5f55209d1c841cb34758bcdf9af44561` |
| `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md` | `a504db11ceb8140ba0abfa36d0d73461d18a333d9db50f1af6d47079b8253420` |
| `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md` | `57067ccd49b538b2c4adc20436692652924ae4b2e9c162fc8fc5603d8f338789` |

## 6. 未验证与下一步
外部静态复评已收到（见§7），其GO_WITH_UNVERIFIED_UI只覆盖报告内SHA；作者不宣称本次V-01同步后的当前字节已有新的独立verdict。内部两轮已关闭；旧R1/R2和external NO-GO不改。只做静态文档与source读回，未读取.runtime、未运行测试/生成/构建/verify/DEV/Web/设备/seed/cleanup、未修改生产源码或在途阶段C。
UI三交互面已获Dexter确认（2026-10-10）；T-01～04、阶段C最终出口和原生帧到RN WebRTC公开桥仍OPEN。需求三处已获准并同步；当前SHA与处置记录供外部差量复核；不能从本次intake推导独立GO或实施授权。

## 7. 外部复评 N-1 的最小同步
输入：`doc/review/platform/2026-10-10-ter-remote-control-design-external-recheck-claude.md`，原始 `GO_WITH_UNVERIFIED_UI / 0M/0S/1N` 保持不变。reviewer披露为续接会话，并非fresh；本次作者处置不重开内部cycle，也不代写独立verdict。

| 输入 | classification | 处置 | 原文证据、影响与最小修正 | Dexter裁决 |
| --- | --- | --- | --- | --- |
| 复评 N-1：V-01旧四态 | CONFIRMED | CLOSED（文档层） | 需求§0.2:24和R-01:93–95已确定三态，V-01:383仍保留“四类状态/身份冲突”，会误导fixture与验收。只将V-01改为“未激活、ACTIVE未建连或已断开、当前未断开会话 / 三类状态/时间正确”；详设§10b.3:234和附件:227已经一致，无需再改设计、实现或增加fixture机制。 | 无需新增；Dexter前轮三态同步授权已覆盖。 |

同根检查分母是正式需求及六工件共七份当前文档：R-01定义、R-02禁用、R-20错误、V-01验收与六工件对应场景逐项核对；其余六份已检查，未见其他旧“四类状态”验收条款。`IDENTITY_CONFLICT`作为固定身份变化的发起/会话错误保留，不作为列表连接状态。防再犯沿用§3的review checklist，追加“状态裁决同步必须连同R/V验收表核对”；不新增门、恢复机制或测试运行。

N-1处置时仅需求V-01与本intake改变，六工件SHA未变；此后UI确认同步另见§8，当前SHA已更新。当前需求SHA见§5；复评报告内原需求SHA保持历史，不覆盖修订后字节。T-01～04、阶段C出口仍OPEN，UI线框已获Dexter确认（2026-10-10），所有实现与动态运行/cleanup仍NOT_RUN。外部review中治理正本缺severity定义的DESIGN_GAP仅记录，未据此修改规范。

## 8. Dexter UI确认同步
Dexter本轮原话：“UI确认”。范围为本包三个交互面：现有终端列表扩展、现有详情抽屉扩展、新全屏远控工作区。Journey、IA、UI、详设及计划同步DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-10-10或对应确认文字；§5记录当前摘要。
本次只记录交互设计确认，不改变外部review原SHA/verdict，不重开内部cycle，不推导真实UI动态PASS或实施授权。T-01～04、阶段C最终出口仍OPEN；实现、依赖解析、生成、编译、测试、verify、Web、设备、DEV、seed与cleanup仍NOT_RUN。
