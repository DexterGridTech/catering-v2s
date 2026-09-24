# 门店终端管理需求稿 · 独立静态 DESIGN review（Codex，第 1 轮）

REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B 文档提取  
VERDICT=NO-GO  
M/S/N=0/3/1  
L1_ENGINEERING=S-01、S-02、S-03  
L2_USER_VISIBLE=N-01；其余页面形态尚待 IA，不冒充已验证  
L3_UNVERIFIED=空（本轮尚无已实施 UI 可分档）  
SAME_ROOT_SCAN=见各 finding 的「同根范围」  
DESIGN_GAPS=终端引用数的标准处置；激活码审计读取授权/脱敏；停用门店的管理编辑例外或明确豁免；客单场景名称确认  
EVIDENCE_TIER=只读静态需求与源码核验；动态验证均未运行、未授权

本轮由 Codex 主会话独立阅读当前需求正本与 owning source；它是经 Dexter 中转的 Codex—Claude review，不冒充 fresh 独立子 agent 盲审，也不占作者此前两轮的轮次。先读需求 §0–§14 及 Dexter 裁决，再查源码，最后才读 §15；§15 的处置记录没有被当作证明。工作稿仅用于辨认背景，不作为裁定依据。未修改需求稿。

## 动作 1-B：应然事实提取

| 维度 | 提取结果 |
|---|---|
| 模板必填项 | `doc/decisions/templates/` 当前只有 IA、Journey、交互、implementation design 四份模板，没有需求稿专用模板；本轮不能把尚未编写 IA、详设或实施计划判为需求稿缺项。需求稿已有范围、裁决、需求编号、验收、交详设事项。 |
| 文档内部与现行规范的矛盾 | §4.5 第 285 行仍称「客单（压桌单）」合并待确认，§13 第 640、655 行却称无需裁决并将合并视为定稿；§9 第 555 行、§13 第 665 行自行豁免作废确认引用数；R-6.5 第 391 行承认当前平台策略与既有管理编辑标准相反。 |
| 无出处的具体取值/形态 | 8 位激活码、17 场景及纸型范围有 D-13/D-22 或表格依据；IPv4-only、停用门店策略、只读用户看完整激活码、场景合并等属于 §13 作者补充，不应伪称 Dexter 已裁定。这里仅把与标准或正文直接冲突的项列作 finding，不把所有产品建议自动判错。 |

## Findings

### S-01｜作废确认的引用数被无授权地豁免

- **位置**：需求 §9 第 555 行、§13 第 665 行，涉及 R-3.4 第 346 行和 R-3.9 第 357 行。
- **性质与证据**：仓内规范事实 + 产品判断。`project-memory/decisions/owner-read-model-and-lifecycle-standard.md` 第 153–157 行明确规定作废不可撤销，确认时给出当前引用数。终端规则新增对桌台区与生产标签的持久引用，需求却把这两类引用排除在确认数字之外，并称「有意偏离」；§13 第 640 行又声称没有需要 Dexter 拍板的事项。依赖倒置并非不可行：`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/QrChannelEligibilityLookup.java` 第 6–16 行已有 organization 自有窄查找接口、由别的 owner 提供实现的先例。
- **后果**：管理员作废被终端引用的区域/标签时，确认信息低报影响面；标准与本批需求并存而无正式例外，详设无法同时满足。
- **最小修法**：优先保留标准，在作废命令的管理读侧补窄引用计数投影（不授予 organization/catalog 写终端权），确认中计入终端引用；若 Dexter 明确接受本批零运行时消费者时期的例外，则把例外、有效期和未来启用消费者前的收口条件记入裁决，并从 §13 的「无需拍板」中移除。单写「引用仍显示」不能替代作废前的引用数。
- **需 Dexter 裁决**：是，若选择豁免或延后标准。
- **同根范围**：本批两种可被终端引用且可作废的外部对象——桌台区与生产标签——均已核；「全部桌台区/全部生产标签」是动态选择而非逐个持久引用，不计入逐对象引用数。需求中相关落点还包括 V-7/V-8 第 567–568 行和 §15 自述第 707 行；未见第三种外部持久引用。

### S-02｜把完整激活码写入共享审计，却未给审计读取同等授权边界

- **位置**：需求 R-8.6 第 423 行、R-9.6 第 452 行、R-9.9 第 463–468 行、V-25 第 585 行。
- **性质与证据**：仓内事实支持的设计推论，不宣称当前已有终端审计泄漏。当前通用审计入口 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java` 第 30–60 行只取得 workspace read facts 并按实体类型分派，没有检查目标页面 key。`apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/OperationsAuditTaskReadService.java` 第 82–102 行把门店类审计交给 organization 时只传节点类型与可见组织范围；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationAuditHistoryPersistence.java` 第 180–208 行以可见门店集合授权。会话事实其实含 `pageAccessKeys`，见 `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceReadAuthorizationFacts.java` 第 20–25 行。现行语料又明确区分数据可见、页面准入和 capability，见 `project-memory/decisions/confirmed-business-language-corpus.md` 第 91–105 行。
- **后果**：若按「复用既有审计」直接接入终端实体，有门店读取范围但无终端页面权限的人，知道终端 ref 后可能经审计取得 8 位完整激活码；需求只规定终端**页面**的明文展示范围，未规定审计路径。D-13 的页面明文裁决并未授权扩大到通用审计读取面。
- **最小修法**：优先审计「激活码已签发」这一非秘密事件/字段，而不是审计码值；终端详情仍按 D-13 明文读回，并把 V-25 改为断言签发记录不含码值。若坚持审计码值，则必须为终端审计读取增加目标页面准入与门店范围的双重服务端校验，并列有页面权限/无页面权限的正反验收。仅靠前端隐藏审计入口不够。
- **需 Dexter 裁决**：只有坚持在审计历史保留原码值时需要安全/产品裁决；无原码的最小修法不推翻 D-13。
- **同根范围**：现有通用审计 controller 第 44–58 行共 12 类目标，其中 3 类门店服务点目标均经上述相同门店可见性路径；终端是未来新增的第 13 类，而非当前已上线泄漏。需求中「码值」落点为 R-8.6、R-9.6、R-9.9、V-25 与 §13 第 653、657 行，均已核。

### S-03｜R-6.5 将平台现有限制升级为需求，并与管理编辑标准冲突

- **位置**：需求 R-6.5 第 391 行、§9 第 554 行、§13 第 664 行。
- **性质与证据**：仓内事实 + 产品判断。`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolver.java` 第 50–52 行默认 `ENABLED_ONLY`，第 55–72 行只有状态切换与窄化的停用门店解析路径；需求准确指出现有拦截。可是 `project-memory/decisions/owner-read-model-and-lifecycle-standard.md` 第 117–125 行规定「管理编辑、重新启用、未改引用的保存只看自身状态，不得因祖先不可用而阻断」。需求第 391 行自己也承认抵触，却以「其他页面如此」将其写成冻结需求。
- **后果**：门店停用后，管理者不能修复/清理已有终端规则；将现有平台实现误当规范，会使新页面继续固化同一例外，并让 R-6.2「停用终端照常编辑」在门店停用组合下失效。业务语料 G-08 对**新建业务**的阻断，不能自动证明历史管理编辑必须被阻断。
- **最小修法**：明确区分新增候选/业务准入与既有终端管理读写；若本批按现有门店范围保持阻断，应由 Dexter 明确给终端管理一个限域、限期的标准例外，并调整 R-6.2/V-19 的组合状态说明；若不接受例外，详设须提供不放宽新建/业务准入的管理读取与编辑路径。不能仅改注释，因为两种方案会给用户不同的页面可用性。
- **需 Dexter 裁决**：是，决定本批是否允许有意偏离已生效标准。
- **同根范围**：需求中的门店停用表述在 R-6.5、§9、§13 与 §15 第 694、733 行；同一平台 resolver 的默认路径、状态转换路径、停用门店窄路径已全部区分，未把后两者错称为普遍放行。

### N-01｜17 个场景中的「客单（压桌单）」仍被写作待确认

- **位置**：需求 §4.5 第 265、283、285 行，对照 §13 第 640、655 行及 V-9/V-10 第 569–570 行。
- **性质与证据**：文档内部事实 + 产品判断。第 265 行已把合并项纳入 17 行的 contract 列表，第 285 行却说「待确认」，§13 又称没有待裁决项。D-22 第 634 行确认 17 场景的纸型划分，不能单凭这一点推出两个原有场景的命名/语义合并已获确认。
- **后果**：详设会把仍存疑的场景身份烙进唯一 contract 与 17×7 验收分母；之后拆分会牵动前后端字典与持久配置。
- **最小修法**：若 Dexter 已确认合并，补精确裁决来源并删除「待确认」；否则请他明确确认合并或分开，再同步场景表、总数、V-9/V-10 分母。只去掉「待确认」而没有依据，会把产品选择伪装为既定裁决。
- **需 Dexter 裁决**：若无既有明确裁决则是。
- **同根范围**：需求中客单/压桌单仅见 §4.5 两处、§3 场景示例、§8 场景例子及 §13 一处；17 行场景表已逐行核对，没有第二个待合并场景。

## 九个重点的方案判断与亲核事实

1. **owner**：新业务 owner 是合理的职责边界，不是依赖图强制出来的。放 organization 加自有窄查找接口在技术上可行（`organization/api/QrChannelEligibilityLookup.java` 第 6–16 行），但会让终端聚合、激活/打印机规则成为组织域的内生职责；本期另立 owner 较清晰。未因此要求新 deployable，现有单业务 app 红线仍在。
2. **跨 owner 读取**：`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreServicePointOwnerApi.java` 第 8–17 行有区域列表/服务点读取但没有按 ref 读取历史区域；`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogProductionTagOwnerApi.java` 第 16、24–25 行有标签列表和按 ref 读回。前者需新增窄 owner read 才能满足 R-3.4 的已作废旧引用状态/类型读回；需求 §11 第 7–8 项已经把此事交详设，不另报缺陷。R-3.5 的候选不受经营规则开关约束需要走 owner API，而不是复用带页面 gate 的现有 host 路径。
3. **contract**：`scripts/generate/store-operating-rule-catalog.mjs` 第 8–14、143–152 行已示范「catalog JSON 一处→OpenAPI/Java/TS」的生成链形态，但不存在可直接承载这七类终端关系的现成通用生成器。R-C.1–C.6 与 §11 第 2 项要求新声明及后端校验/前端字典的同源生成，方向可实施；不能只生成类型而手写服务端支持矩阵。C.4 的约束收紧须同时处置既有配置，需求已写。
4. **页面/权限**：`contracts/catalog/admin-catalog.json` 第 50 行有 `NAV-STORE-OPERATIONS`，第 747–772 行该组现有 `PG-STORE-PROFILE`，第 831–849 行商品页是四类角色的 STORE 目标页面，第 1494–1505 行 `EDIT_STORE_CATALOG` 采用 `SELECTED_STORE_SCOPE`。新页面与独立写能力可按此形态登记；§13 的导航分组是产品建议，不是已冻结事实。
5. **保存**：R-7.1 的单终端版本、整体事务、全量硬约束复核与既有 owner 命令形态一致；分块写若每块不重校聚合必有旁路，需求已明确禁止。建议详设优先评估一次性保存以降低验证面，不作为 finding。
6. **激活码**：集团空间含作废唯一、测试装配可控取码、并发撞码重试均可设计；数据库冲突后不能在已失败的 PostgreSQL 事务中直接盲目重试，应采用能继续事务的冲突探测/保存点方案。V-14/V-15 覆盖形态、前导零、跨店、跨空间、并发及作废码，静态上可证伪；并发实际效果本轮未运行。
7. **审计**：`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChange.java` 第 5–19、48–55 行支持可展示标量与 2000 字符截断；同目录 `AuditChangePolicy.java` 第 8–22 行封闭字段白名单。名称逐字段、集合按段摘要可以接现有机制，不需新审计系统；原码值与读取授权另见 S-02。
8. **验收**：`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` 第 14–17、42–73 行允许 owner group 内的数据驱动真实 HTTP 场景，不设总条数上限。V-4 的 24 格、V-9 的归属正反格、V-10 的 119 格可在同一受管运行分组执行；本轮无运行证据，不能断言耗时。每格仍须业务 readback/typed reject，不能用纯单元测试替代 backend-acceptance。
9. **§13 的 21 项**：逐项与正文交叉检查后，直接阻断的是「审计原码」（S-02）、「停用门店」（S-03）、「作废引用数」（S-01）和「场景合并待确认」（N-01）。其余扫码归无桌台、改型旧引用、候选不看开关、桌边划菜、排队号票、IPv4-only、安全随机、菜单分组、前导零/不复用、只读页展示、页面不看开关、设备类型可改、名称唯一、厨打无名称、不能换店、三态操作、硬约束收紧等，是可审的作者推论或产品选择；本轮未发现与当前 owning source 的直接反例，但「未发现冲突」不等于 Dexter 已逐项裁定。

## 需 Dexter 裁决与方案合理性

需明确决定：①是否有意豁免作废前的终端引用数；②停用门店的历史终端管理是否允许偏离 CASCADE 标准；③若找不到已有确认，客单与压桌单是否合并。若坚持让完整激活码进入共享审计，则还需决定审计授权与保密边界；不入原码的修法不触碰 D-13 页面明文裁决。D-1–D-24 的已裁决方向本轮没有被重提为 finding。

整体方案以「终端是点位功能集合」为聚合、新 owner 负责规则事实、contract 持有硬约束、软约束不提示不拦截，符合本批只保存/校验/展示的目标。没有以本期名义偷加激活、TDP、派发中心、真实打印或订单路由。四处问题主要是作者补充的策略与既有规范/同一稿件尚未收口，而不是该业务模型不可行；处置后可以进入详设评审。

## 未验证及授权边界

| 档位 | 本轮结论 |
|---|---|
| 静态已证 | 上述源码 API/权限/审计/模板与需求当前字节的存在、调用形态及矛盾。 |
| 测试已证 | 无；未运行构建、契约生成、测试或脚本。 |
| 未验证 | 新 owner、页面、激活码碰撞、全表 backend-acceptance、性能、实际审计权限均尚未实施与运行；IA 控件/浏览器体验亦未设计或验证。 |

本轮仅授权静态 review 和本 review 文件写入；未改需求稿，不授权详设、实施、契约/代码变更、DEV、reset、seed、L2、UAT 或部署。`NO-GO` 仅针对当前需求稿可否无歧义交给详设，不是运行结果判定。
