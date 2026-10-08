# 阶段 B fresh 独立 DESIGN R1

REVIEW_CYCLE_ID=ter-version-update-stage-b-20261007
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INPUT_LIST=doc/review/platform/2026-10-07-ter-version-update-stage-b-design-review-input-claude.md
REVIEWER=/root/stage_b_design_review_r1
BLIND=true
SOURCE_FIRST=true
AUTHOR_INTAKE_READ=false
EVIDENCE_TIER=STATIC
VERDICT=NO-GO
M/S/N=0/4/1
UI_REVIEW=UNSET
DYNAMIC=NOT_RUN
IMPLEMENTATION_AUTHORITY=false

主agent归档独立输出。以下finding正文保留reviewer判断，链接转成仓根相对路径便于交接；主agent处置另在intake，不改原verdict。本轮完整最小输入已读，无剩余缺读；大型源码按相关owning函数读取，不声称全仓逐字覆盖。

## 冻结输入

| 文件 | SHA256 |
| --- | --- |
| 详设 | d93f6713dbfed664b3d46ddf4d46ebc64510da6cea4595b7cfcd5dc3fc15764e |
| 计划 | 75569c37e7f79986c861cd074ef363629c31fa7df9cd0ade9b1bffa80a14ad63 |
| 附件 | 4e1b70edef8df2484f7df4683028a988c2d9ffbb59b5205027e8c5422eeb4537 |
| IA | 6e7b041911547adfc67cad1b72295eaee46a321be53e7526e6ed03244498e02a |
| Journey | 843d4fd36888ac072b12d62894b8c6ce51296f651c17a7413bf0a05f55af741f |
| UI | 68d9e7ff980e2d98b1c5f0529314c8a0bd53d2afde769f291bc7948ac2604905 |

## 独立 findings

### S-01：无 ACK、连接仍存活时，单 inFlight 没有明确释放或恢复出口

详设旧L192–194。设计要求最多一份inFlight，ACK后才能发送pending；DB失败不ACK，以“既有会话事件/有界retry”恢复。当前TDC actor L583–602重送入口仅由L1687 SESSION_READY调用，L1741–1755 PONG只维护心跳。B又明确不复用remote-operation持久账本。

报告R1已发出，PG一次失败或ACK丢失；WS、PING/PONG健康，实际值变化生成R2，但R1一直占inFlight；无新ready/超时出口，R2不能送出。后台最后报告长期旧事实，与需求R15 L228/234、V28在线变化、重试去重不闭合。

最小修正：现有TDC分支明确有限ACK deadline、重送次数及耗尽出口；同连接保留reportId/sequence/body，迟到ACK校验connection/binding identity。耗尽保留最新pending，通过既有受控会话恢复重新ready或其他有限可验证出口；不新增永久账本/轮询。report.recovery增加健康WS、一次DB失败/丢ACK、随后变化。无需Dexter裁决。

### S-02：当前项目已加载的 ESTABLISHED_SOURCE 与真实命令时序不符

Journey旧L37、详设旧L178。storeBasicInformationLoadedCommand用于证明本启动项目已加载，但store-basic actor L388–397先发STORE command，L406才调用organization/path，L423–429才写project/path、标记loaded并flush。selectStoreProject L19–28从持久organizationPath派生（slice L109–115）。

首次command时project为null，同binding重启可能是hydrated旧项目；STORE成功不能证明PROJECT本周期HTTP成功。B没有具体PROJECT成功刷新信号，可能查询旧项目或遗漏首次快照。服务器拒绝旧项目不能代替端侧恢复。

最小修正：本boot/binding STORE成功＋PROJECT HTTP成功且flush组合gate；project真实加载后的刷新触发，优先公开成功信号/资源桥，不能改称现有command为project loaded。首次null、旧hydrated、PROJECT失败/迟到反例。无需Dexter产品裁决。

### S-03：候选与固定refs详情协议未冻结，全部CursorPaged与源码矛盾

详设旧L121、IA旧L40–46/54、UI旧L108–111/147。现有OperationsOrganizationCandidateController L40–45为page/pageSize、单selectedId，无固定refs集合；L71–79返回页码metadata，useOrganizationCandidates L55–67同样页码。useCursorCandidates L177–190同时支持cursor/页码，名称不代表HTTP。

超过一页固定refs受搜索/资格变化时，单selectedId不能完整分页回显；客户端抽干再筛或首批截断违反自己的约束。RULE-CREATE/DETAIL来源/操作/oracle不能唯一落地。

最小修正：选真实协议；可复用PagePaged候选；固定refs定义具名任务read或detail关联参数/DTO/权限/排序/continuation。固定引用不再可选仍按引用存在呈现，不把资格当存在。补两页与非当前候选refs。技术协议无需Dexter，若隐藏引用/改含义需Dexter。

### S-04：IA未充分满足Dexter逐屏后台、菜单、控件和读写权限要求

IA旧L20–44、UI canonical旧L10–20。UI写consumer face，IA主要用actor/路由/现有Card指代；新规则页无具体菜单层级、report无完整用户导航。CREATE/STATUS权限主要是有写权/撤grant/CAS，未各屏标具名cap、PROJECTscope与无权行为；platform stage/register/release散在详设。

影响Dexter需跨文件推断每屏位置/授权，无法作为具体IA确认。依据Dexter最新要求和IA模板L48/62。

最小修正：九屏增后台中文名/face、菜单层级/页面名、完整入口、surface/实际控件、页面读权限、各动作具名权限/scope和无权行为；只读明确无mutation，candidate GET与写cap分开；与真实catalog/routing核对，保持UNSET直到Dexter确认。具体placement/IA需要Dexter确认，技术对账主agent负责。

### N-01：register claim→receipt顺序需明确成功重放分支

附件旧L76/84、详设旧L72。claim/stage在receipt前，承诺同payload重放。PlatformAssetService L625–636一次性grant消费，ACTIVE重用L639–671是catalog明确特例。ZIP新claim未实现，可能另有幂等，所以不宣称必败，不独立阻断。

最小修正：当前身份/space/权限复核后先完成receipt回放分支，首次才claim；或明确ZIP可重放。响应丢失重发不能要求已消费/过期stage，补反例，不借catalog特例。无需Dexter。

## 方案合理性与读取范围

B供给/观察不暗做C；唯一CBS owner、asset私有字节、TDS function-only、TDC凭证边界方向合理。成员hash/time与HTTP snapshotHash分离，原始time无伪递增；首次空/在线同time/完整flush/有限失败已设计。A工件/actual当前缺口条件化，不额外计B缺陷。CP/6b/动态/13c无循环，UI先于L2脚本、TER唯一driver/先Web、admin唯一L2。V01–30都映射本期子断言/A/C边界，需补S01–03反例。默认停用、菜单及IA仍待确认。

输入清单1–8全部读取；包含全部kernel与有效六维命中原文、原需求讨论稿、A三文档与核心产物/port/provider/native、六份B全文、asset/authorization/TDS/TDC/store-basic/foundation/driver/adminL2真实消费者。先需求/规范/source形成判断，再B作者方案，无作者intake/历史B verdict。

未验证：依赖实际解析、tool部署、真实工件/Android、HTTP/WS/PG并发、组件/L2、seed/cleanup均OPEN/NOT_RUN。reviewer未写文件、未执行生成/测试/编译/verify、未读取.runtime、未操作DEV/设备。R1只读任务完成，后续主agent亲自intake/R2；不授权实施运行。
