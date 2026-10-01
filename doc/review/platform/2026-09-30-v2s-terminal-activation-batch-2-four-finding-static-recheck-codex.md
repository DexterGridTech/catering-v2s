# 批次二四项修正 · 当前字节独立静态复评

日期：2026-09-30。Codex承接Dexter指派的Claude复评角色，产物按归属使用`-codex`；主会话唯一写入。本轮是经Dexter中转的四项修正及相邻同根复评，不重开已关闭的作者DESIGN cycle，不是其第三轮，也不是重新审查整批实现。

## 1. 结论

```text
REVIEW_TARGET=DESIGN
REVIEW_SCOPE=FOUR_FINDING_REMEDIATION_AND_ADJACENT_SAME_ROOT
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/1
L1_ENGINEERING=S-1 reset-only准入被削弱；N-1批次收口阶段归属措辞残余
L2_USER_VISIBLE=NOT_APPLICABLE，本轮修正无新增UI操作
L3_UNVERIFIED=生成、实现、focused、HTTP/WS、Expo Web、DEV、reset/seed及cleanup均未执行
SAME_ROOT_SCAN=阶段/6b/13c、生成源链、配置消费、reset/seed/L2条件全族见第3节
DESIGN_GAPS=无新增产品判据缺口；S-1违反既有明确判据
TEMPLATE_COVERAGE=本轮适用章节及N/A理由见第5节
EVIDENCE_TIER=STATIC_DOCUMENT_AND_OWNING_SOURCE
BUSINESS/CLEANUP=NOT_APPLICABLE_TO_STATIC_REVIEW
```

NO-GO来自有原文判据的准入削弱，不因未运行未来动态验收而否定设计。未验证项不会降低该NO-GO结论。原S-1阶段环、原S-2生成源链、原N-1provider边界的主要修正成立；原N-2移除空分母要求的方向正确，但同时误免除了reset前完整seed试运行。本轮不沿用前轮0/2/2，也不把作者自述当证明。

方案合理性：将CP-06限定为场景/runner实现与focused proof，之后单独全批6b再整体验收，是消除阶段环的最小方案，保留六个CP及原子交付。修改canonical source并同步catalog SHA、沿已有materializer/codegen扩TER生成，比手改派生产物可靠。Composition→transport adapter/provider、client只调用通用command符合三包职责。去除无动作的空分母手续是合理收窄；这不能顺带改变真实reset的既有安全准入。无需新框架、重排整个批次或新增产品决策。

## 2. 目标、输入与独立性

D = `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`。

P = `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`。

| 当前目标 | SHA-256 |
|---|---|
| D | `157bd1ad5e1f99e3fb0fc7d421f7f68c1badffa649c1ad0f575e71d493a414d5` |
| P | `58915a6eeb5378d274b529628a370f1dee97f9f9631291dcc1fa830ead7ab723` |

fresh只读子agent `/root/batch2_four_fix_fresh` 先依据当前需求/规范/目标和owning source判断，再读前轮review。首次返回披露了路由阅读截断，主会话未据此收口；同一任务补齐正式query原文后，reviewer返回正式NO-GO 0/1/1，真实状态completed。主会话逐项重开证据并唯一写本稿。主会话也向reviewer提供了reset-only与阶段残余的攻击入口，故不宣称彼此完全隔离。

输入包括AGENTS、CLAUDE、Blueprint、platform README、scripts README；仓内cs-review/cs-memory-recall；review/task/design模板及其它三模板适用性；本轮四项适用的原始需求、授权及质量门（含R-15.7与D-34）、Journey、service-shape；当前D/P；canonical与materialized terminal-binding schema、edge catalog、materializer与edge-codegen。前轮 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-fresh-static-rereview-codex.md` 仅用于finding对照。

独立reviewer正式六维query为 `review/platform/backend/platform/architecture/review`；33份原文含六kernel和27routed已实读，未读完项为0。此前截断区间重新分段打开，不以hash盘点代替阅读；无关sourceRefs全文未扩大为新分母。路径排序、逐文件SHA输出的集合摘要为 `2c56cd46a6d2d70bb98d0224aa632a22da8addd7d4bf9668620030254edf9431`。本稿只对四项及其同根给结论，不声称重新完成全批所有业务场景审查。

## 3. 当前 findings

### S-1 · 条件式准入误豁免reset-only的完整seed dry-run

- **目标/位置**：D §4 CP-06第203行、§10b.5第359行、§10b.6第363行；P §3 CP-06第155、157行、§4第171行、§8第221行。D/P的完整仓库相对路径见第2节。
- **性质**：`CONFIRMED`，已有质量/破坏性动作准入被弱化；是文档设计问题，未声称已执行不安全reset。
- **仓内证据**：这些段落一致将完整seed dry-run限定为“确实计划执行seed”。`doc/platform/implementation-task-template.md:212-217`规定第一次reset前的整体准入，并在第217行明确完整seed试运行须在reset之前；`doc/decisions/templates/implementation-design-template.md:280-281`明确reset前必须跑通完整seed试运行，未通过不得reset。需求 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:1701` 的D-34保留这些质量门，没有reset-only豁免。
- **静态反例/影响**：未来具体获授权步骤只执行reset、不执行seed，现稿就允许跳过dry-run再清库。backend-acceptance无需DEV seed的正确例外，被扩大到了真实破坏性reset；这不是消除空分母所必需的改变。
- **最小可验收修正**：仅同步上述D/P族：实际包含reset或seed的动作，须先有当前字节完整seed dry-run PASS；发生reset时必须在reset之前。继续保留backend-acceptance和无reset/seed DEV独立、§3a N/A、CP阶段MATCHED、全批6b、资源身份/预算/日志/cleanup。无需改规范、新增例外或在本轮运行dry-run。
- **同根全集与反例边界**：上述七处全部核对；D203/P155虽写“相应reset/seed前”，仍有“只有计划seed”前提，不能据后半句排除reset-only反例。P172无reset/seed DEV独立是正确边界，保留。
- **Dexter产品裁决**：修正不需要；如希望豁免现有reset规则，须另外明确裁决，当前材料不提供该豁免。

### N-1 · 局部表述仍把批次验收/收口归入CP-06

- **目标/位置**：D §13c第491行“CP-06交付前”；P §11第265行V-T17、第266行“CP-06 13c”、第267行最终IMPLEMENTATION review。
- **性质**：`CONFIRMED`，阶段归属残余措辞，按N处理。
- **证据与反证**：D91/210/485、P72/161已明确CP-06退出只到场景/runner实现、focused proof及阶段MATCHED；动态结果、cleanup、13c、最终review属于退出后的批次收口。因此不足以继续认定原S-1真实依赖环，但上述四处尚未与新定义同步。
- **影响**：读§13c或自查表时仍可能把批次收口工作误归CP-06，削弱计划的无歧义性。
- **最小可验收修正**：D491及P265-267明确为“CP-06退出后，批次级整体验收/交付收口”，13c仍在实际批次交付及IMPLEMENTATION handoff前完成。不重构六个CP，也不取消13c/review。
- **同根全集与反例边界**：四处残余及阶段总览、退出、6b、动态表、最终交付定义全部核对。明确退出条款反证真实阶段环，故不把同根N升级为第二条S。
- **Dexter产品裁决**：不需要。

## 4. 前轮四项逐项核验

| 前轮finding | 当前证据 | 本轮判定 |
|---|---|---|
| S-1 阶段环 | D89/91、203/210、485；P70/72、154/161、169/170、220-226：实现阶段退出→全CP MATCHED→单独6b→整体验收；动态/cleanup/13c/review不回流退出 | 原S修正成立；仅N-1局部归属残余 |
| S-2 canonical源链 | D136/139、220/224、296/464；P83-85明确canonical+catalog SHA→materialize→codegen→TER；只改两terminal请求，其他DTO严格，禁止手改输出 | 静态设计修正成立；生成行为未执行 |
| N-1 provider边界 | D158/224/230、276/277、319；P110：composition通过config owner解析API提供provider→transport adapter；client仅transport公开command，不读config selector/snapshot/state/persistence | 修正成立；未发现本轮同根owner矛盾 |
| N-2 空分母/seed手续 | D129及203/359/363；P155/171/221：§3a N/A，backend-acceptance/no-reset DEV不等空分母或seed | 空分母部分修正成立；reset-only准入仍需本轮S-1修正 |

实际生成链的静态证据：canonical `contracts/openapi-source/terminal-binding.schemas.json` 的SHA为 `11511b1e16085d2408809746bf05ea7c67add3fa600fe1e2022482bf9fb3dfd4`，与catalog第98-99行登记一致；第14100-14107行两个baseline均ref对应schema，没有覆盖这些请求的component override。`scripts/generate/r5-edge-materialize.mjs:335-362`校验源SHA并克隆schema，`:486`写component，`:504-505`重物化并比较；`scripts/generate/edge-codegen.mjs:960-965`读取report指向的materialized组件，`:1510-1532`按schema建立strict集合，`:2741-2743`为write入口。这证明计划对应真实既有producer，不证明已运行该链。

当前两个source/generated请求仍为`additionalProperties:false`；TER policy/producer扩展、两个请求unknown subtree处理及三方exact-set红例均是未来实施内容，不将尚未实施状态反报为当前详设缺陷，也不声称这些能力已经通过。

## 5. 模板、设计缺口与未验证项

本次修正范围的模板适用性，不沿用作者自查作为正确性证据：

- implementation-design §0/1有授权/方案；§2/4有阶段定义，主要修正成立、N-1需同步；§3有、§3a N/A有理由；§5/6/7/8/9有operation/owner/消费路径，provider修正成立；§9a有完整生成源链、§9b有定位；§10无DB迁移，持久/reset有；§10b.1-.5有fixture/边界，§10b.6有但与reset试运行判据冲突S-1；§11/11a有场景/执行面；§12有；§13/13b有，§13c有但N-1；§14有自查。
- Journey模板§1-7及§6.1：沿用已有Journey，本轮无新actor/任务/裁决；原有来源漂移登记保留。本轮不修改Journey。
- IA模板§1-6（含§2.1/2.2）：本轮无新增IA-ID/页面或用户操作，新增工件N/A；不能据此豁免既有V-T17运行观察。
- interaction模板§1-10及线框/控件/表单/搜索子项：本轮无新增screen/action，N/A；不恢复退役Manifest控制面、不声称既有UI动态通过。

未发现需要新设产品判据的DESIGN_GAPS；当前S-1已有明确原文。最小修正只需两份目标文档同步，不要求扩批、改业务或重做整批§13c。

**已实际获得**：当前文档、schema/catalog hash关系和generator源码的只读证据；fresh独立静态verdict及主会话owning-source intake。没有任何新编译/测试/门/动态PASS。

**计划中的证据**：各CP focused、阶段MATCHED、全批6b、canonical/materialize/codegen/TER检查及三方exact-set；HTTP未知字段兼容及其他DTO严格反例；真实readiness/drain、Node代理/压缩/隔离、Expo Web、DEV切换、reset/seed、fixture复原、资源cleanup、13c与IMPLEMENTATION review。全部保持未运行/未验证。

**授权边界**：本次仅静态复评和review产物；不授权修改需求/Journey/decision/源码/依赖/锁，不授权生成、编译、测试、verify、backend-acceptance、DEV、Testcontainers、reset、seed、L2、UAT、部署或批次三。未启动运行资源，静态任务business/cleanup为N/A。前轮review保留，本稿不覆盖历史。
