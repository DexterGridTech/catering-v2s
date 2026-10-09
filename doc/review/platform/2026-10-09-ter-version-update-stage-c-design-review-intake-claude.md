# TER 更新阶段 C：作者辩证 intake

REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09
REVIEW_TARGET=DESIGN
AUTHOR_SESSION=续接作者会话
INDEPENDENT_VERDICT_SOURCE=doc/review/platform/2026-10-09-ter-version-update-stage-c-design-review-r4-codex.md
IMPLEMENTATION_AUTHORITY=false
DYNAMIC=NOT_RUN

本文件是作者处置，不是独立 verdict。R1 NO-GO 0M/4S/2N 只对应 R1 报告 SHA。以下只修改 C 六份设计工件和 review 文档；没有修改 A/B/需求/规范/记忆/source，也未读取 .runtime。

## 1. Dexter 本轮输入

- “切勿过度设计，只需要满足90%情况会发生的主流程即可，不要为了满足极端场景做过度设计”。保留通常发生的下载、等待系统确认、HOT闲时、断链保护；不新增极端归档、跨App、协议分片/扩预算、恢复队列或第二账本。
- 配对确认原话：“不同App配对是什么意思？你是说sample-terminal和sample-wallpaper-terminal配对么？他俩肯定是不可以配对的呀”。据此只允许同App配对，覆盖 R-07 旧“不同 App 副机”句；需求正本本轮只读。作者删除误推的跨App方案，不重开既有cycle。
- 新的本机再邀请线框仍 UNSET；A/B此前看图不推成C确认。两后台不新增页面。

## 2. 逐项核验和最小修正

| 输入 | 分类 / 状态 | 重开证据、反例与更小取舍 | 当前 C 落点 |
| --- | --- | --- | --- |
| S-01 | CONFIRMED / CLOSED（文档） | R-09 S1/S2/S3 明确；actor 当前成功 readback 覆写 bootId。只在原 currentTask 加 executionBootId，执行时更新、纯确认不更新；拒绝第二占位账本 | 详设 §8.2 L165、§6；计划 CP-03 L54/59；Journey §2；V-15 |
| S-02 | CONFIRMED＋DEXTER_DECISION / CLOSED（裁决后文档） | VICE 无本地 wallpaper placement，旧跨App承诺不成立。Dexter确认不同App不得配对；直接删除矩阵/protocol2/业务 fallback，保留已有身份检查，比扩独立副机业务更小 | 详设 §0/§8.7、计划 CP-01/04、Journey 前提和全部 pair/V-13；需求原句只读冲突明确 |
| S-03 | CONFIRMED / CLOSED（文档） | Preparer extractFull 仅单APK；builder FULL ZIP 无顶层metadata，grant.manifest.apk有三身份字段；HOT才有顶层publication JSON。FULL带有界apk摘要并核APK embedded metadata，沿原 Preparer/JDK ZipFile，不改包格式/HTTP | 详设 §8.6 L208–215；计划 CP-04 L68–69；附件 §4.4 |
| S-04 | CONFIRMED / CLOSED（文档） | InstallerPolicy known pending-user 可恢复不等于 UNKNOWN；旧foreground只处理权限返回。分已知待用户/当前安装或显示/UNKNOWN/已结束，owner统一N、native仅恢复精确确认。拒绝第二调度器/全局窗口扫描 | 详设 §8.4 L181–190；计划 CP-03 L56；IA §4/UI §2/5 |
| N-01 | CONFIRMED / CLOSED（文档），UI仍UNSET | 模板10项完整填；primitives无Panel/space.md，实际Container等与containerCard布局token复用。物理PRIMARY与VICE逻辑SECONDARY区分，既有alert＋local-primary、ephemeral不投影；不建新tier/Dialog | UI §1.1 L18–31、§3 L64–76；IA §2；详设 §8.5 L200 |
| N-02 | CONFIRMED / CLOSED（文档） | atomic-group 原文要求组内顺序；写定type/canonical→producer→adapter/default→consumer→exports→整组proof。中途类型错不以fallback求绿；没有虚构当前编译 | 详设 §9a 组内顺序；计划 CP-01～06 每组proof |

关闭仅指静态文档反例处置，新增字段、native/session/渲染/自动化均尚未实施或运行。以上行号基于本轮修订读回；后续更新须刷新，不以行号作符号真相。

## 3. 同根扫描与作者主动删减

六份全族扫描并交叉读回：Boot/终态/V-15/CP-03；同App/配对/VICE/前提/fixture/V-13；FULL/HOT摘要/ZIP/签名/场景；N/系统pending/foreground；UIprimitive/本机层；原子组/生成消费者。其余对应条款同步，不保留两个解释。

- 删除跨App兼容/protocol2，保留原双机业务；无需新增业务面。
- 删除预设8MiB＋64KiB扩容和峰值探针；原序列化技术界限可见拒绝、不截断、不添加业务条数上限。真实规模触界再回评。
- 删除壁钟异常检测机制；沿现有clock和非负deadline计算。
- FULL不会读取不存在的ZIP manifest；HOT不凭空增加代码签名方案。
- MAIN固定工件grant不要求规则仍启用，CBS原artifactAssignedToStore未按ENABLED过滤，规则停用不抢占固定目标；当前身份/权限仍复核。
- 报告仅补等待闲时/准入拒绝有限状态和原因，沿原API/单任务历史；FULL成功HOT失败用已有FAILED＋actual/target，不增加部分成功任务类型/流水。
- B最终browser focused入口仍拥有后台资源，TER driver只拥有TER；顺序继承B流程，不造联合orchestrator。该接缝待B最终argv/fixture交接，C不修改在途B。

## 4. 抽象防再犯（明确 review checklist）

同类失败：把结果确认当成新执行、假定另一包格式有相同元数据、把pending等同unknown、把独立版本推成独立业务App、猜不存在primitive/预算。适用全集仅本批六文、现有A/B更新/配对调用链；更小解为真实source判别＋原owner字段/有限状态，非通用平台。主要预防落点：本文件checklist＋实施计划相应existing focused测试意图（尚未运行），不扩大项目记忆授权。

第二轮 reviewer 应针对上述真实主流程以及六份修订同根条款证伪，不继承本处置。所有C实现/动态/cleanup NOT_RUN，A/B相关出口 OPEN，新UI UNSET；不把作者 CLOSED 写成独立GO。

## 5. R2 处置与两轮收口

REVIEW_ROUND=2；REVIEW_ROUND_LIMIT=2；ROUND_FINAL_DECISION=SELF_DECIDED。
独立报告为同目录 `2026-10-09-ter-version-update-stage-c-design-review-r2-claude.md`；保留其 NO-GO、0M/1S/2N 和冻结 SHA，不改写为修订后 verdict。reviewer 为 fresh 独立只读子 agent，先独立形成结论，之后才完整对照 R1/intake；没有文件写入、动态运行或 evidence 读取。主 agent 落盘报告与全部修订，没有子 agent 代写设计。

| R2 输入 | 分类 / 关闭状态 | 重开 owning source、较小修法与当前落点 |
| --- | --- | --- |
| S-01 权限名称 | CONFIRMED / CLOSED（文档） | canonical admin-catalog 和 ProjectTerminalUpdatePage 实际使用 MANAGE_PROJECT_TERMINAL_VERSION。详设 §10b.3 L289 改为该名，并明确 r5-account-multi-role、GROUP 任职→PROJECT 节点及既有 secret reader；禁止用激活 fixture 的 PROJECT/STORE session。Journey §3 L35 同名。其余平台/终端角色与场景权限已核对，不造新 capability/账号/seed |
| N-01 Journey canonical | CONFIRMED / CLOSED（文档） | Journey 模板元数据与前提来源类型缺项；Journey L5–12 补齐，§3 L30–41 使用七列和三类来源。A/B来源可定位不等于已验收，出口仍OPEN；新增看图为外部Dexter前提。其余任务来源已逐条核对，无产品语义变化 |
| N-02 操作与事实矩阵 | CONFIRMED / CLOSED（文档） | UI模板逐操作合理性/variant事实分母不能用“无表单”省略。UI §10 L133–138 两动作各一行；§10.1 L140–153 六行隐藏事实，分别标 task/action/boot 唯一源、owner失败；版本只读。其余控件、selector/command、IA对应已核对，不新增操作 |

这些是当前文档的静态关闭，不是生产实现/运行证据。没有为N项扩功能；source不受本轮修改。权限族根因是猜名称，模板族根因是把无编辑表单等同无提交事实；最小预防为canonical/source读回和本节checklist，实施计划原有 focused 意图承接，无新增通用门。

AUTHOR_FINAL_DECISION=GO_WITH_UNVERIFIED_UI；作者当前残余 finding M/S/N=0/0/0。此 SELF_DECIDED 只说明作者对两轮输入的处置；当前最终字节没有独立 reviewer GO，不替代外部评审。两轮cycle关闭，不发起第三轮。

## 6. Dexter 明确追加 R3 / R4（覆盖原停止指派）

2026-10-09会话原话：“IA确认。请再多两轮对抗性review后再移交另一个Claude做review”。同一cycle只追加R3/R4，REVIEW_ROUND_LIMIT=4；不重命名cycle。上文两轮关闭/作者决策仅保留历史，不是现行停止指派。IA及当前低保真邀请内容已确认；真实UI、C实现和动态仍NOT_RUN，不授权实施。

R3 fresh reviewer `/root/stage_c_design_round3` 先读取当前六文、规范与owning source，未读作者材料时封口 **NO-GO，0M/1S/0N**；旧R1/R2结论未继承。报告由主agent落盘为 `2026-10-09-ter-version-update-stage-c-design-review-r3-codex.md`（新增独立子agent报告按当前命名规则，历史文件不改名）。

| R3 finding | 辩证处置与更小替代 | 当前修订位置 |
| --- | --- | --- |
| S-01 后台浏览器运行归属 | CONFIRMED / CLOSED（文档）。重开B详设§15.2a、runner updateCases/implemented集合、SupplyUi创建browser和Android journey cleanup。普通供给链已是唯一TER父run拥有browser及设备；C旧独立B入口/顺序交接会与本run cleanup冲突。更小解是复用该父run和helper；不新建联合runner、不修改B/source | C详设§3a，计划CP-05第5项，附件§6 |

同根扫描：六份C工件全部核对；冲突操作句在详设和计划，其余四文没有第二入口指令，附件补具名来源。旧intake §3的“B最终browser focused入口独立拥有资源”是此前截面描述，本节明确取代，不再作为实施指令。运行根内backend DOM和TER agent各用其真实工具；父run统一收首败/cleanup；借用DEV-owned Vite/tunnel不停止。当前注册仅Android supply-chain，不偷换C Web/pair能力已完成。

另做来源/确认同步：计划进入条件及附件OPEN说明IA已确认、真实UI未知，不再重复要求Dexter确认同内容。R4封口后提醒B规则时间的来源差异，主agent亲读RuleOwnerApi#RuleSnapshotItem L44–46、RuleOwnerService L216–219、edge L60–64，确认此前把RuleSummary/Artifact的createdAt误推成规则Snapshot传播。详设§0.1 L26已纠正为canonical/generated要求规则时间、owner snapshot/edge仍缺，保留B_INTERFACE_OPEN；仅修来源事实，不改B或产品。该单行最终差量由同R4 reviewer亲读确认并在报告区分原/最终SHA，不另开第五轮。

通用失败模式：把在途源码快照当成长期接口/runner归属，在多个工件分别描述同生命周期，导致入口与cleanup判据矛盾。有限最小解：明确唯一入口、borrowed/owned两类真实资源，再对六文同族指令回读；预防落在本checklist及CP-01/05既有资源focused/red义务，不建新的台账或框架。

R4用新的fresh只读reviewer检查完整修订包，先独立封口再看本intake。作者只做处置，不代写独立GO。所有C运行/生成/编译/测试/verify/环境/cleanup均NOT_RUN；A/B在途来源不是accepted proof。

当前OPEN：IA及低保真邀请内容已确认，真实UI未知；A/B最终接受范围、接口和受管入口交接；所有C源码/生成/编译/测试/verify/DEV/Web/设备/pair/cleanup NOT_RUN。缺少动态运行不是本轮新增finding；C仍无实施或运行授权。§1–5的UNSET是原R1/R2处置截面，不能当作当前确认状态。

## 7. R2 后历史交付 SHA-256（当前表随后更新）

| C 工件（仓根相对路径） | SHA-256 |
| --- | --- |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md | 55616556a5f960e9626fe6854cd1aaa569bed9936853e286a0391383814c6f86 |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md | 08c73da937bb7768728924f24650b8473830ef979756b7ef1124a0433815706c |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md | a986793b6466249c2dddf401dbc3b6bc2c8eae6c8cab1944e028f24394096aea |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md | 13d9e446707397b2f150e38d88fa113bc51f2428b719620f72baf1029a75523b |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md | 1e5393e934af009010aa5bf07fcfdc841719cc5c03696baf0510101c9d1a3421 |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md | c2b445c8c0e9ef21040db16ff5381298b4e1f3bb1b35bffdc7b7e0cb89d83c01 |

## 8. R4 最终处置与停止

新fresh reviewer `/root/stage_c_design_round4` 对完整修订六文先盲审独立封口，再对照历史；结论 **GO_WITH_UNVERIFIED_UI，0M/0S/0N**，DESIGN_GAPS=NONE。报告及封口后唯一来源纠正附记见本文件头引用。无新增finding需修，不凭作者自评替代结论。

| 对照项 | 当前独立结论 | 主agent处置 |
| --- | --- | --- |
| R3 S-01父run/browser | CLOSED；同入口/同父run、DOM与agent职责、owned/borrowed和cleanup指令一致 | 亲读源并作有限C文档修订，无B/source写入，无新runner |
| 原R1/R2输入 | 当前六文无残余finding | 保留历史NO-GO和原SHA，不重写历史；修复只是文档闭合 |
| §0.1规则时间事实 | 唯一封口后来源纠正确认，verdict不变 | RuleSummary/Artifact不代表RuleSnapshot；明示B_INTERFACE_OPEN。D最终SHA有独立附记，其他五不变 |
| IA/运行 | IA和低保真内容已确认，真实用户可见与全部C动态NOT_RUN | 不推UI PASS，不由设计review授权实施 |

同一cycle按Dexter明确指派扩至四轮，现已停止，不召第五轮。当前六文冻结时的PENDING_R3_R4为输入记录；当前结论按R4报告及最终SHA判定，不为更新状态字样破坏独立review字节。A/B最终交接、C实现/运行仍OPEN/NOT_RUN。下一步仅交Dexter及另一Claude外部设计review。

## 9. 当前最终交付 SHA-256

| 工件 | SHA-256 |
| --- | --- |
| Journey | 0ed55be74354f05bcbae9ae5691f368822c017b98bfb7f585b12c635cd55ad05 |
| IA | 167c08d0752028513a836a453ddbeae721e34862983865357b36665fb8ae360b |
| UI | 115ab84603d6f628aceecde16a61de114ad12aad9cf70d970cc682e06cc5b4ef |
| 详设 | 15f790d1901a06f28e3e1a5e4cadb223bd0e203996b167332740fd1056a19fe1 |
| 计划 | 09674c2a8359263c17b65b1e7a6c9e1ed3a642f5df28051af541c95dda3597f6 |
| 附件 | 90260a49a8290533f14fa0d5c18d120333beccc23a2add06fae85498d62dfb7e |
