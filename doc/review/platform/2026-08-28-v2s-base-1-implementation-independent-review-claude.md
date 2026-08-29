# base-1 实施独立评审 · NO-GO(M=3 / S=1 / N=3)

**会话出处**:fresh v2s-rooted 独立评审会话。所有门在本会话内新鲜复跑,所有数字独立复算,
不采信任一份 report、详设或此前 Codex review 的自报值。

**⚠️ 利益边界**:`requirements-claude`、`appendix-cascade-and-members-claude`、`design-merge-claude`
与 `2026-08-27-…-merge-delta-independent-verification-claude` **由我撰写**,我对它们不构成独立审查。
对实现、契约、生成物、门与 UI 的核验是独立的。

**⚠️ 我要先更正自己上一轮的一个错误**:在上一轮交给 Codex 的交接里,我写「A-2 的 oracle 完全没有落地,
`.at("/` 零命中」。那是 grep 转义写坏造成的**假阴性**。实测 acceptance 目录下 `.at("/` **45 处**,
registry 覆盖 93 operation / 240 pointer。断言是存在的。该结论作废,详见 N-3。

---

## 结论

**NO-GO** · `M=3` `S=1` `N=3`

三条 M 分别是:A-2 的红夹具证明不了它命名所声称的事(M-1);主门 red(M-2,CP05 的 23 条真实阻断,
我独立确认为 measured fact);`catalog-inventory-p2` 两条与 CP05 无关的独立失败(M-3)。

**必须说清楚的分寸**:base-1 的主体实现质量是好的 —— 分母、exact set、批量 readback 的协议校验、
owner 的 FAILED 不变量强制,这些我逐条亲验都成立,下面「独立确认成立」一节列出。
NO-GO 卡在**证明**与**门**,不是卡在业务实现走偏。

---

## 独立确认成立的部分(逐条亲验,非转述)

- **五个旧 operation exact-zero**:在 `contracts`、`apps`、`scripts`、`libraries`、`tools` 全范围
  (排除 `node_modules`/`dist`/`build`)命中 **0**;当前 CP05 report 内亦 0。
  仅 `doc/evidence/platform/2026-08-22-*` 的历史 CP05 证据仍含旧 id —— 那是当时的实测记录,保留正确。
- **238 分母由唯一人工 source 驱动**:`contracts/policy/backend-performance-operation-counts.json`
  为 `manual:true`、`status:ACTIVE`,声明 `238/102/136/93/34/9`;
  我从 `contracts/openapi/paths/**` 独立枚举得 **238 / reads 102 / commands 136 /
  operations-admin 93 / platform-admin 34 / public 9`,**六值全等**。
- **report 是 238/238 exact set**:CP05 report 的 `operations` 为 238 条、去重 id 238,
  与契约 operation 集合**集合相等**(不只是基数相同)。
- **239 / 243 未被当作 active denominator**:人工 source 内不含这两个值;238 是唯一现行声明。
- **三次 batch cardinality 覆盖 N=1 / 20 / 100**:`source.runs` 三条,`batchCardinality` 分别为
  `1`、`20`、`100`,三个不同 `manifestDigest`;三个 `.runtime/r5/evidence/remote-testcontainers/<runId>`
  目录真实存在、各 9 个文件。
- **五个证据边界分别保持**:`business=PASS`、`cleanup=PASS`、`firstFailure=None`、
  `lastKnownGood` 为三个 runId、`brokenBoundary=None`,互不混用。
- **运行时证据绑定当前后端字节**:report `generatedAt=2026-08-28T17:39:19Z`,
  `CatalogOwnerService.java`(16:10)、`CatalogAcceptanceScenarios.java`(16:55)、
  oracle registry(14:46)均早于它。
- **批量 readback 的协议校验扎实**:前端 `decodeCatalogBatchResults` 做精确键集、UUID 正则、
  `itemRef` 去重、按 `expectedItemRefs` 逐位对齐,`reason` 非 null 时必须为非空 trim 串,否则抛
  `CATALOG_BATCH_RESULT_PROTOCOL_INVALID`;owner 侧强制
  `SUCCEEDED ⇒ problemCode==null && reason==null && version!=null`、
  `FAILED ⇒ problemCode!=null && reason!=null && version==null`,违反即 `RESULT_UNKNOWN`。
  我原本怀疑「reason 为 null 时表格渲染空白」,**该怀疑被 owner 的不变量证伪,不成立**。

---

## M-1 · `RED_MUTATION=PASS` 证明不了它命名所声称的事

**owning source**:`scripts/check/base1-structured-field-oracle.mjs` 第 195–221 行、第 489–505 行。

**仓内事实**(本会话运行 + 读源码):

门输出为
`BASE1_STRUCTURED_FIELD_ORACLE_RED_MUTATION=PASS` / `REGISTRY=PASS OPERATIONS=93 POINTERS=240`。
其 red mutation 实际只做两件事:

1. 第 470–488 行:把 **registry JSON 自身**改掉一条 `operationId\0jsonPointer`,要求 checker 拒绝;
2. 第 489–504 行:把某个 acceptance 源文件里的 `json.at(` 全量替换成 `json.path(`,要求 checker 拒绝。

**两个 mutation 改的都是 checker 自己的输入,没有一个改动产品代码,也没有任何一次 acceptance 运行发生。**
而 `validateProductionMutationAnchor`(第 195–221 行)对 `productionMutationAnchor` 只做两件事:
文件存在于仓内,以及 `new RegExp('\\b' + 符号名 + '\\b').test(source)` —— **一个符号存在性正则**。

**推论**:该门证明的是「registry 完整且 checker 对自身输入严格」与「acceptance 源使用 `json.at(` 而非
`json.path(`」。它**没有**证明「把某个叶值换成另一个合法但错误的成员、或反转数组顺序,
会让 oracle 变红」。评审问题 2 的答案是 **UNVERIFIED**。

**为什么是 M 而不是 S**:A-2 之所以存在,正是因为原 `CONTRACT` verdict 只比 HTTP 状态码而看不见结构。
现在用一道**同样看不见运行时行为**的静态门取代它,而门名 `RED_MUTATION=PASS` 会被读成
「红夹具已执行且被杀死」。详设把 CP-B4/B6 的关闭条件绑在「能杀死错误 production output」上,
该条件未被满足,**后端 closure 不能宣告成立**。这也正撞 CLAUDE.md「不得用关键词/字段匹配把语义伪装成
checker」与本轮评审问题 7「不能把静态 PASS 写成运行时 PASS」。

**可证伪的失败条件**:在 `BusinessChannelWireMapper`(或 registry 中任一 `productionMutationAnchor`
所指符号)把一个合法枚举成员换成另一个合法成员、或反转一个有序数组,随后运行受管 backend-acceptance;
若未出现 `HTTP=200;CONTRACT=PASS;BUSINESS=FAIL;failureCategory=BUSINESS_ORACLE`,则该 pointer 无门。

**最小修复**:不改门的判据,只改两处 —— 一是把输出名改成不声称运行时的名字
(例如 `ORACLE_REGISTRY_SELF_CONSISTENCY=PASS`),二是把「实证一次 production mutation 并记录信号」
作为**受管运行**的产物登记,而不是静态门的输出。

**为什么更小的替代不足**:只加注释或只在文档里说明不够 —— 门的**输出字符串**本身会进证据与交付,
读者看到 `RED_MUTATION=PASS` 不会去读 520 行实现。名字就是接口。

**是否需要 Dexter 裁决**:否。属于证据命名与执行边界,在既有批准边界内可修。

---

## M-2 · 主门 red;CP05 的 23 条是真实 measured fact,未被绕过

**owning source**:`contracts/policy/backend-performance-cp05-calibration-report.json`;
`doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md` 第 135 行。

**本会话新鲜运行的首败**:

- `scripts/verify --validate-only` → `R5_VERIFY=FAIL`,
  `REASON=R5_VERIFY_STATIC_FIRST_FAILURE:openapi-contracts`
- `scripts/check/openapi-contracts` → `R4_GATE=FAIL`,
  `REASON=R4_OPENAPI_GENERATED_DRIFT:BUDGET_NOT_READY_CP05_BLOCKED:23`
- `scripts/check/edge-codegen --self-test` → 同根 `BUDGET_NOT_READY_CP05_BLOCKED:23`

**独立确认 23 是真实事实,而不是被转成 PASS**:report 内 `budget.generated=false`、
`activation=NOT_YET_AUTHORIZED_BY_CP05;CP02_REQUIRES_REMEDIATED_SHAPE`、
`readyCount=215` + `blockedCount=23` = 238,与 operation 全集吻合。23 条**全部**是
`BLOCKED_ABOVE_CLASS_CEILING`,`ceiling=20`,`measuredMax` 分布 25/26/28/29/30/31/47/62。

**重要的独立发现:这 23 条不是 base-1 引入的回归。** 四个新增 catalog transition **全部在 ready 侧**;
23 条散布在既有面:invitation reissue 六条、user assignment revoke 五条、business-channel 五条、
collaboration binding 两条、组织更新两条,以及 `createWorkspaceInvitation`、`transitionWorkspaceAccountStatus`、
`executeOperationsTemporaryCatalogItemPromotion`(measured 62,最高)。

**更小的根因修复存在,且已在 CP05 设计内写明**:该设计第 55 行把 P3 的整改定义为
「同类引用/节点批量化,36 成员 ≤20」,第 155 行给出手段「同类 ref 去重 set-read」。
即根因是同类引用的逐条读(N+1),修法是去重后一次 set-read,**不是抬 ceiling**。
第 135 行明写「高于说明整改未完成,**不通过抬预算解决**」,唯一例外是逐 operation 的完整双准入记录。

**我注意到一处值得 Dexter 知道但我不代裁的事实**:ready 侧存在 P5 且 `FIXED max=24` 的
`cancelWorkspaceInvitation`,而同域 `createWorkspaceInvitation` 是 P3、ceiling 20、实测 26 被阻断。
同一业务域内相邻操作因**分类不同**而适用不同上限,是分类模型的既有形态。
**我不建议用重分类去解 23 条**(那正是本轮明令禁止的绕过),但「P3 的 ≤20 是否对 invitation/assignment
这类天然多表写入的操作成立」属于预算模型的产品级判断。标注 `DEXTER_DECISION`,
在他裁定前只能按现行规则执行:批量化整改,不动阈值。

**可证伪的失败条件**:整改后重跑受管 run,若任一 P3 成员 `measuredMax` 仍 >20 且无双准入记录,门必须仍红。

**是否需要 Dexter 裁决**:分类模型问题需要;23 条本身的处置不需要,按现行规则整改即可。

---

## M-3 · `catalog-inventory-p2` 两条与 CP05 无关的独立失败

**owning source**:`tools/catalog-inventory-p2/cli.mjs` 第 112 行与第 139 行。

本会话运行 `scripts/check/catalog-inventory-p2` 得 `__EXIT_CODE=1`,两条失败:

### (a) `SKU_STRUCTURE_COMPATIBILITY_MISSING`

判据是 `catalogOwner.includes("skuStructureFingerprint") && catalogOwner.includes("SKU 结构指纹不一致")`。
实测:`skuStructureFingerprint` 命中 4 处 ✓;中文串 `"SKU 结构指纹不一致"` 命中 **0** ✗。

**行为未回归,这是一次改文案。** `CatalogOwnerService.java` 第 12430–12436 行守卫完整:
结构指纹不等时返回 `BLOCKED`,typed reason `SKU_STRUCTURE_INCOMPATIBLE` 仍在,只是人读文案改成了
「规格结构不一致」。同一段里「商品形态结构不兼容」「商品引用无法重写」等中文仍在,
所以这不是 base-1 的原则性清理。

**根因是门的判据本身**:它按**中文字面量**匹配语义,正是 CLAUDE.md 明禁的形态。
**最小修复**:门改为断言 typed reason `SKU_STRUCTURE_INCOMPATIBLE` 与 `skuStructureFingerprint` 的存在,
不断言任何展示文案。**为什么不是更小的方案**:把中文改回去能让门变绿,但那是让实现迁就一个错判据,
下一次改文案还会再红。

### (b) `L2_SCENARIO_DENOMINATOR_DRIFT`

`scenarioDenominatorIsValid(l2Scenarios, 18)` 要求 `scenarioCount === 18`。
实测 `contracts/policy/catalog-inventory-l2-scenarios.json` 声明 `scenarioCount: 26`。
另两个子句均通过(`caseCount 65` 与逐场景 `caseCount === cases.length` 全对)。
多出的 8 条是 `CI-L2-019` 至 `CI-L2-026`,均带 `executionSuite: CATALOG_LIBRARY_WORKBENCH`、
`primaryVerifier: browser-business`,`caseCount` 一律为 3。

**推论**:workbench 的 8 条 L2 场景被加进声明分母,而门内硬编码的 18 未同步。
该文件 `kind` 为 `catalog-inventory-l2-scenarios`、`sourceOfTruth` 指向 case-blueprint,
是**声明/计划**而非执行报告,因此声明 26 本身不等于宣称已执行 —— 但**本轮 browser L2 未执行**,
这 8 条的 `browser-business` 覆盖仍是缺失证据。

**最小修复**:确定哪一个是权威 —— 若 workbench 场景属于本批范围,把门的 18 改为 26 并在交付里
明确标注这 8 条为 `UNVERIFIED_REQUIRES_BROWSER_L2`;若不属于,从声明分母中移除。
**是否需要 Dexter 裁决**:是,范围问题 —— `DEXTER_DECISION`:workbench 的 8 条 L2 是否属于 base-1 交付范围。

---

## S-1 · 本批新造的字段里装的是后端写的中文展示句

**owning source**:`CatalogOwnerService.java` 第 762–770 行;
`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogBatchOutcome.tsx` 第 63–69 行。

**仓内事实**:owner 在批量结果里返回 `reason`,值取 `problem.getMessage()`,并在为空时兜底为
中文字面量 `"批量状态项执行失败"`(第 763 行)。同一条结果**同时**返回结构化的 `problemCode`
(focused 测试 fixture 里是 `VERSION_CONFLICT`)。前端 `CatalogBatchOutcome.tsx` 直接把 `reason`
原样渲染进「失败原因」列,**完全没有使用 `problemCode`**(该文件内 `problemCode` 零命中)。

**推论**:这正是 base-1 要消除的形态 —— 后端替前端决定展示措辞 —— 而且发生在**本批新造的字段**上,
不是存量。需求 §1.6 把「错误消息」列为在原则内但**不在 base-1 范围**,所以存量不算违规;
但在本批新增的响应里重新引入同一形态,与本批的目的相抵。结构化事实已经在传输,只是被丢弃了。

**可证伪的失败条件**:若把 owner 的 `reason` 置为 null 而只保留 `problemCode`,前端应仍能显示正确的
中文失败原因;当前实现做不到。

**最小修复**:UI 改为按 `problemCode` 查前端字典出文案,`reason` 仅作为字典未命中时的兜底。
**为什么更小的替代不足**:只把中文从 owner 移走而不建字典,会让失败原因变成裸英文码,是回退;
只加注释则什么都没改变。

**是否需要 Dexter 裁决**:否,但若他认为「错误文案统一留到后续批」,这条可降为登记欠账。

---

## N-1 · `50vh` 魔数与断言该魔数的 focused 测试

`CatalogBatchOutcome.tsx` 第 36 行 `style={{maxHeight: '50vh', overflowY: 'auto'}}`。
该组件渲染在 `CatalogBatchActionModal.tsx` 第 55 行的 antd `<Modal>` 内,modal 未设 body 滚动,
因此内层 50vh 区与 antd 自身的 modal-wrap 滚动构成**嵌套滚动**。功能不破(关闭按钮仍可达),
但用户在长列表下需要在两个滚动区之间切换。

`CatalogManagementPage.test.tsx` 第 1085、1097 行断言 `markup` 包含字符串 `'max-height:50vh'` ——
**测试把实现细节钉死成样式字面量**,与 M-3(a) 的门是同一类错误:改进实现会让测试变红。
同一文件第 1068 行断言「以下 1 个商品未处理成功」是真实内容断言,形态正确,可作对照。

另:该滚动区是 `div` + `overflowY:auto`,无 `tabIndex={0}`,仅键盘用户无法滚动它。
前端规范内未检索到相关条目,故按 WCAG 2.1.1 记为 note 而非规范违反。

## N-2 · 22 组扫描的三类假阳性守卫在实现侧未被验证

设计附录已正确登记 `TypedProblem.code` 与 `CatalogItem.code` 同名异义等三类守卫。
本轮我核了 business-channel 响应侧 enum 已补齐且取齐三值,但**未逐一复核那 22 个名字里
被判为「需回 owning source 才能定」的 12 个是否被误改**。标记 `UNVERIFIED`,建议在下一轮
或由实施方给出逐 pointer 的前后对照。

## N-3 · 更正我上一轮的假阴性

我在上一轮交接里断言「A-2 oracle 一条都没写」,依据是 `.at("/` 零命中。
该 grep 因转义写坏而失效。实测 45 处,registry 覆盖 93 operation / 240 pointer。
**若该交接已被用于指导实施,这条必须先撤回**,否则会导致重做已存在的断言。
真正的缺口是 M-1 所述的「存在」与「能杀死」之间的差距,不是「不存在」。

---

## 方案合理性(不只闭环正确)

- **问题对不对**:是。三句原则针对的是「改一个展示要跨契约/后端/前端/测试/seed 全线跟改」,
  这是真实成本。三态统一同理。
- **方案优不优**:主体方案我认为是对的,且本轮实现质量高于我预期 ——
  批量 readback 的双向不变量强制、前端解码器的严格协议校验,都不是最省事的写法而是最能防回归的写法。
- **代价配不配**:⚠️ 一处需要 Dexter 知道 —— A-2 的 registry 已到 **93 operation / 240 pointer**。
  这是我上一轮提醒过「规模没有上界」的那一项,现在有了具体数字。它换来的门目前**只验存在性**(M-1),
  即代价已经付出而收益尚未兑现。建议顺序是先让少量 pointer 真正具备「能杀死」的实证,
  再决定 240 这个分母是否值得维持。

**UI 十一维**:behavior / form-shape / actions / relationships / placement / copy / limits /
state-control / failure-recovery / accessibility-focus / data-source-invalidation 逐维看过,
其中 failure-recovery 与 copy 命中 S-1(展示文案来源错层),accessibility-focus 与 limits 命中 N-1
(键盘不可达 + 魔数边界),其余未见缺陷。
**未覆盖**:本组件之外的 base-1 UI 面(三态治理页、四个新 transition 的操作路径)本轮未审,
评审请求指定的 UI 文件仅这两个。其余 UI 结论标记 `UNVERIFIED`。

---

## 缺失证据(明确标记,不以静态推断)

`UNVERIFIED` —— 本轮**未执行**、因此不能声称通过的:
browser L2(含 M-3(b) 的 8 条 workbench 场景)、DEV、seed、reset、UAT。
受管 Testcontainers 有 2026-08-28 的三次真实运行证据(N=1/20/100),其边界区分正确;
但那三次运行**早于**本轮我复跑门时的部分前端字节
(`CatalogBatchOutcome.tsx` 17:38:13Z 对 report 17:39:19Z,相差 66 秒,且前端不在后端 acceptance 覆盖内),
前端 focused 证据需以其自身运行为准,不得借后端 run 背书。

---

## 授权边界

本文是**静态与门层面的独立实施评审**。`NO-GO` 不等于产品否决,只表示当前不具备接受条件。
Claude 的 GO/NO-GO **不构成**产品批准、下一 Roadmap step、动态环境执行、数据操作、部署或切流授权。
本轮未新增任何业务语义、operation、数据模型或预算例外,未以任何方式放宽 CP05 阈值。
两处标为 `DEXTER_DECISION`:P3 分类模型对 invitation/assignment 类操作是否适用;
workbench 的 8 条 L2 场景是否属于 base-1 交付范围。
