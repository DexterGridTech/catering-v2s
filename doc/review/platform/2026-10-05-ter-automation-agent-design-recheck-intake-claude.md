# TER automation-agent · 外部差量复核 finding intake（再次修订）

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_IMPLEMENTATION_DESIGN_2026-10-05_CLAUDE
AUTHOR_DISPOSITION_ONLY=true
INDEPENDENT_VERDICT=NONE
IMPLEMENTATION_AUTHORITY=false
EVIDENCE_TIER=STATIC_DOCUMENT_AND_SOURCE_INSPECTION
UI_APPROVAL=UNSET
NEW_CAPABILITIES_F_V_AND_CLEANUP=NOT_RUN

## 1. 输入与范围

本次输入为 doc/review/platform/2026-10-05-ter-automation-agent-design-recheck-claude.md 的 NO-GO、0M/3S/4N，旧审阅对象详设3fde4d1cbabd3952、计划7a38b98a8fac4be5、附件74ed7133dcacca07、skill670e0b52ce74db70。外部续接会话结论保留，仅属旧字节；本记录是作者处置，不是独立GO。
按原要求重开复核条款、seed契约、旧runner的按key读取、资源门、DEV readback及类型声明、activation view、Runtime requestLedger与本包相邻条款。Dexter已裁定共享seed key，不再要求独立数据。只修订详设/计划/Journey/附件/skill及intake/交接；IA/UI无此轮内容改动，但哈希一并重算。需求正本、规范、记忆、源码、依赖均未修改。
D/P/K/J/I对应§5完整路径的详设/计划/skill/Journey/附件。行号为本次字节定位；实现前必须重新核对符号，不能继承来源快照。

## 2. 逐项处置

| finding | 分类/状态 | 当前文件、章节与行号 | owning source/事实与最小修订 | Dexter |
|---|---|---|---|---|
| S-A | CONFIRMED / CLOSED | D§4.5:186；D§11a:359；P CP-05第3步:137；I:7832 | RN原生testID:string允许字面量；附件确认55节点/12文件。全生产TSX属性定点checker必须可赋给唯一TestId，直接View字面量红/品牌值绿；品牌prop编译红例与属性门红例分别说明，拒非法cast，不做流分析。 | 否 |
| S-B | CONFIRMED / CLOSED | D§10b.3:316、§10b.4:321；P CP-04:117；J§3:30；I:8126 | seed条目dual=term-front/mobile=term-handheld，两者ENABLED且store-operating。按唯一契约key共享，激活码仅内存，不存受管JSON；删不重合/专用数据要求。串行防争用，REQUIRE_INACTIVE与仅本driver身份回收保留，TDC遗留ACTIVE拒绝。 | 已裁定；不需重裁 |
| S-C | CONFIRMED / CLOSED | D§9a.1:275～279、§9a.2:291；P CP-01第5步:61、CP-04准备:114、CP-06第3步:151 | 资源门preflight拒未豁免live tree，不能留到CP-06。CP-01先登记新根/kind/DEV profile/red及health/format，后续随文件创建登记；CP-04先迁顾客fixture；CP-06对该组只删旧根豁免/旧入口/helper。附件20分类逐项写phaseDisposition。 | 否 |
| N-a | CONFIRMED / CLOSED（未来实施授权待明确） | D§0:16、§9a:250、§10b.4:323；P CP-04:117；I:8139 | r5-dev-runner.mjs:1053/1072现有projection/parse及.d.mts:34须同改。新增跨owner行，明确projection、parse、两函数声明及红例；bound_device_id只内存比对不落盘原值，manifest保留本机deviceId非秘密身份。未来实施授权必须单列，不从TDC抽取裁决推导。 | 未来实施授权须明确包含；当前无需新产品裁定 |
| N-b | CONFIRMED / CLOSED（草案非可运行API） | D§4.4:174、§10b.4:324；K§4:46～65；P CP-04:118 | 补显式fixtures.ensureActivated及真实点击observeUiAction算法/示例：订阅首值后基线，新增request按rootCommandIds/commands的name/display/workspace关联，歧义拒绝，精确初值覆盖快速完成，finite late/finally释放。只薄封装现有公开selector，不新增账本或业务通路；完整imports/具体场景期望结果仍由实施定稿，草案不可当运行能力。 | 否 |
| N-c | CONFIRMED / CLOSED | D§4.4:174；K§4:46 | selectActivationStatusView.ts:12–36真实字段activation.status；非MASTER投影缺失/身份不符返回null，为合法JSON，不是NON_JSON。详设与skill一致。 | 否 |
| N-1（carried） | CONFIRMED / PARTIALLY | D§0:15；D§12:379 | 需求D-1/§8旧开始时间未改；当前Dexter指派允许此设计修订，来源登记但正本同步仍OPEN/NOT_AUTHORIZED，不新增需求修改。 | 源头修改不在授权内；无需重复裁定 |

本轮作者处置统计：6 CLOSED、1 PARTIALLY、0未处置项。三S均是设计文档闭合；这些状态不证明任何新源码、红例或动态通过。上一轮13项关闭表仍以外部复核§2为历史判断，本次仅修订它衍生的新缺口与carried N-1。

## 3. 同根扫描、复用与成本

- 639生产JSX属性位置按附件tag核对：直接RN55个/12文件逐项保留到附件testIdPointTypeControl，其余584个属于拟收窄的项目props/转发等范围，定点属性门仍一视同仁；未将它们当作已有品牌门通过证明。145个testID文件输入哈希只读复算，与附件无漂移；这不是typecheck/机械门执行证明。
- 当前seed8条的key/deviceType/store/status核对，固定两条均ENABLED/store-operating，不另找terminal或发明seed数据。契约sha保存在附件，不打印激活码。取消只在本driver旧intent/device身份与权威读回匹配时，由HTTP owner CAS执行；SQL只读核验，不成为第二业务入口。
- CP-01/04/05/06与9a全部20分类记录同步时机。新资源准入与文件登记前移，旧能力最后删除；只改已有profile/登记门，不新建调度/资源框架。
- 真实点击和直接dispatch是两条观察入口：前者用既有request selector薄封装，后者继续先journal观察后dispatch。新增helper只是提取driver重复准备/观察步骤，普通Promise/JSON，不公开RxJS，不复制状态或账本。
- 失败模式与防再犯：原生string绕过品牌→V-14直接View红例；fixture重复真相→seed-key契约与ACTIVE身份红例；使用前缺准入→CP-01资源/注册红例及CP-04准备checklist；跨owner漏同步→9a的projection/parse/.d.mts和parser红例；skill缺配方→V-18逐字转录与完整API示例；null误判→selector JSON focused。均属未来实施proof或明确review checklist，本轮未新增规范/记忆/源码门。

## 4. 内部 fresh DESIGN 审查工具状态

本次实际尝试 automation_design_delta_r1，fork_turns=none，明确只读盲审、完整最小输入与当前裁决。工具立即返回 `collab spawn failed: agent thread limit reached`。无agent/session ID、已读材料或verdict。随后实际list_agents：root running；四个历史agent tdp_r3_contract、tdp_source_cbs、ter_update_formal_r2、update_simplicity_review均completed。历史agent不是本任务fresh reviewer，现有工具未提供释放历史线程的能力；不复用旧agent冒充fresh。

历史两次分别automation_design_review、automation_design_revised_r1（见先前author-check/intake）也因同一容量边界未创建。没有有效内部轮次，不能按派发次数称第三轮或SELF_DECIDED收口。Dexter本次允许尝试审查或如实记录工具状态，本交付采用后者，不代写独立verdict。未完成完整fresh最小输入阅读，亦不把本次作者处置冒充回退整批review。

FIRST_FAILURE=agent creation thread capacity
LAST_KNOWN_GOOD_PHASE=main静态文档修订/输入核查
BROKEN_BOUNDARY=fresh reviewer creation
CURRENT_REVIEWER_STATUS=NOT_CREATED
VALID_INTERNAL_REVIEW_ROUNDS=0
INTERNAL_DESIGN_REVIEW=OPEN_TOOL_CAPACITY
INDEPENDENT_VERDICT=NONE
AUTHOR_SELF_DECIDED_VERDICT=NOT_USED

同cycle的有效内部第1轮仍待完成；本次外部差量交接不替代fresh内部审查，不重开已结束的需求cycle，不授权实施。

## 5. 本次全部设计包 SHA-256

| 仓根相对路径 | 当前 SHA-256 |
|---|---|
| `doc/decisions/2026-10-05-ter-automation-agent-journey-claude.md` | `18be1f5d97a5289cd190e35a792566107823d40b774ecc959ad98d20264a548d` |
| `doc/decisions/2026-10-05-ter-automation-agent-ia-claude.md` | `be8fa1bd07bc233a6318261adc7135bfc0b2fe7f19cc8ba2f381baa7ebc703ce` |
| `doc/decisions/2026-10-05-ter-automation-agent-ui-interaction-claude.md` | `08c994c9f8aa6e4ad8a47b3f1dd3d01bb8726dd80a9a4838b33312664700789e` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md` | `12b995c8e888bf39424838fb7daaf8902f5417eb4b79d2f7ca785360ba7cc83d` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md` | `8eb041e05b8f4e9ea292cc2fdce6afc05351935f3edc649585eea584bbbaec73` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-source-inventory-claude.json` | `fb48983b92d9c14f656c0865abeefce9f2dbf8f3381547b09c318644d3daea96` |
| `doc/plans/platform/2026-10-05-ter-automation-agent-skill-draft-claude.md` | `3c200f7df972519dfcc7bc7020eaea8cba91a58c571a9b05bc894c31a2aa11dc` |

需求正本未变：`doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`，SHA-256=`37fe9363e79b6db3dbb68a36429d109cb8f7d586e465f701f86de4bf09507739`。

## 6. 证据边界与外部差量范围

静态确认的是文档改动、seed契约与已有源码事实、输入快照；新API、品牌属性门及红例、fixture抽取/readback扩展、资源新根接入均未实现/未运行。UI仍UNSET；F/V、Web/双屏/mobile VM、business/cleanup、依赖解析与未闭合官方依据均OPEN/NOT_RUN。未运行任何生成、安装、编译、构建、测试、verify、DEV、reset/seed、L2、UAT或部署。
外部复核范围：D§4.4（L174）、§4.5（L185–186）及V-14、§9a/9a.1/9a.2、§10b.3/10b.4/10b.6；P CP-01第5步、CP-04准备、CP-05第3步、CP-06第3步；skill§3–4；Journey前提链及附件新增三节。详设N-1保持PARTIALLY不动需求。
下一步仅交外部静态复核；不以当前CLOSED处置表、工具失败或旧review替代独立GO。
