# TER 更新正式需求 · 第一轮独立对抗审查

由 `/root/ter_update_formal_r1` fresh 子 agent 只读审查并返回 findings/verdict；主 agent 仅归档。以下保留当轮独立结论、证据与适用边界，不以作者修订追写旧 verdict。

```text
REVIEW_CYCLE_ID=TER_VERSION_JS_APK_UPDATE_FORMAL_REQUIREMENTS_2026-10-05
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-review-r1-input-checklist-claude.md
blindReviewDeclaration=先独立读取需求、原话与owning source并形成findings/verdict；未读取作者intake、旧simplicity-review或作者自评
AUTHOR_INTAKE_READ=false
AUTHOR_TARGET_VERDICT_READ=false
IMPLEMENTATION_AUTHORITY=false
```

被审全文：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`，284 行，当轮开始/结束亲算 SHA 均为 `3a7fa3cb70aeadeeab5c6a8866a7fe8f46b792e3661f813de68d5a59994545b4`。下列行号只对应这一审阅字节。讨论原文全文 638 行已读。

## 1. 动作 1-B：事实提取及方案合理性

目标为三类产物、两后台分工、项目最新适用规则、固定 FULL→HOT 跨启动执行、准确失败及实际版本。只 APK 不满足 HOT；下载后人工处理不满足立即/M策略；复用 Runtime/state/render/TDP/asset/Expo/RN，新建必要 owner/adapter，是当前合理的最小方向。

无需增加跨规则图、自动fingerprint、全量备份、跨机共同提交、服务端副机对象。模板适用与逐节 N/A 见输入清单；纯正式需求不要求提前交付 Journey/IA/交互/CP/端口签名。具体提取出发布变化遗漏、验收 oracle 与 flush 措辞三个问题，不以空提取冒充通过。

## 2. Findings

### S-1：正式 R-01 遗漏新 JS 发布的版本变化要求

- 位置：正式稿 R-01:43、R-03:68、R-06:110；原始讨论稿 §3:43。
- 仓内事实：讨论稿写“每次发布新的 JS 包变化”；正式稿仅保留三整数格式/比较，不可变工件身份不足以替代该发布版本。
- 反例/推论：已运行 HOT A=1.4.2，新内容 HOT B 仍=1.4.2但身份/摘要不同。正文既未禁止登记，也未明确执行、拒绝或已达到；按版本去重与按工件执行可得不同结果，后台版本也无法区分发布。
- 影响：新 JS 内容沿用旧版本时存在规格分歧；相同工件重复/跨空间登记、仅 native 变化未发布新 JS 不属该反例。
- 最小修正：恢复新 JS 发布必须变化 bundleVersion，明确新内容不以相同版本冒充另一发布，补登记/准入反例。**不要求增加严格递增 JS 政策、第五版本或设备盘点。**
- Dexter：忠实恢复已有输入不需新裁决；若要允许不同发布沿用相同版本则需裁决。severity=S建议由Dexter接受度终裁。

### N-1：补正常零动作及失败后继启动释放 oracle

- 位置：正式稿 R-06:110、R-10:161；V-07～10:236、V-15～17:244。
- 事实：R 已写不重复、失败释放；V 未直接点名无适用规则零prepare/download/install/reload、同目标/更高JS零更新，以及失败本boot不领第二条/下boot可领不同修复目标/同坏工件不自动再试。
- 影响/推论：日志可通过而副作用偷偷发生，或失败永久占位。
- 最小修正：在既有 V-07/09/15/17 补明确 oracle，不新建机制；“包含但不限于”允许详设补充，因此为 N。
- Dexter：否。

### N-2：通用 flush 不应因 HOT 章节措辞被收窄

- 位置：正式稿 R-12:179；讨论稿 §19.2:561；`apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts:167`、`persistenceEngine.ts:112`（同目录）。
- 事实：原文通用“重启前flush”；正式稿“应用前”位于HOT节且拒绝只点HOT。真实state有debounced descriptor和异步队列，store写入不证明磁盘完成。
- 反例/边界：实施者可能只对HOT调用flush，FULL终止旧进程前未完成必要durable字段。正式“应用前”也可通用解读，故不是“完全删除FULL flush”或已发生丢失的事实。
- 最小修正：明确FULL/HOT受控应用边界均适用，R-11回指、V-20补同根断言；复用flush，不建全量备份/安装锁。
- Dexter：否。

## 3. 同根扫描与已证伪候选

| 问题族 | 扫描全集 | 结论 |
| --- | --- | --- |
| 发布/身份/去重 | R-01/02/03/06/09/10/13/15；讨论§3/4/11.1/19/20；V-01/03/07/09/15/17/21/28 | S-1；其余native构建严增、runtime匹配、实际报告已核对 |
| 无动作/拒绝/失败释放 | R-06～14、V-07～27 | N-1；其余失败、未知与恢复要求已核对 |
| 持久化/重启 | R-09/11/12/14、V-14/15/20/22/25/27及state/runtime | N-2；任务持久化/HOT flush/有限恢复已核对 |

以下候选已证伪，不驱动修订：CBS须盘点所有/副机版本；必须禁止配对FULL中间JS较旧；副机须上报/TDS连接；Activity token足以确认新HOT；失败页隐藏splash就是成功；已有file-loader/reload就是更新器；缺当前Journey/CP即NO-GO；动态NOT_RUN即需求缺陷。

防再犯落点为正式需求及本轮审查清单：版本变化/身份分离、零副作用oracle、受控应用前durable flush。不新建语义门或控制台账。

## 4. 已核实与未验证

静态已核实：两App版本分处维护；旧marker端口及Android不可用默认；reload不选工件；native网络限长UTF-8；PRIMARY失败可释放视觉加载且Activity token不是bootidentity；Runtime常驻订阅/selector/command/cleanup；topology声明同步不代表全部本机事实应同步；CBSasset只图像/mp4且平台入口仅logo；已安装Expo57.0.18/RN0.86.3/expo-modules-core57.0.14的本地file-loader/host hook存在且Host缓存。

以上只证明候选调查的接缝。全部V-01～30、产物、nativeHermes/工具实际解析、CBS权限/PG/资产动态、资源离线加载、installer、T/恢复、跨启动/两App/双屏/双机、ExpoWeb/DEV/L2/UAT、动态日志及cleanup均`OPEN/NOT_RUN`。没有把工程输入变成新增产品裁决。

## 5. 独立结论（原始值）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/2
L1_ENGINEERING=findings:S-1；N-1/N-2；其余结论仅为需求/源码静态核验
L2_USER_VISIBLE=NOT_RUN：本轮只审需求，不证明页面、提醒、失败恢复或真实用户操作
L3_UNVERIFIED=NOT_RUN：全部V-01～V-30及上述工程/动态OPEN；当前阶段未授权运行
SAME_ROOT_SCAN=发布语义、正常停止/失败释放、持久化重启三族，范围与逐项结果见动作3
DESIGN_GAPS=S-1发布变化遗漏；N-1验收oracle补足；N-2通用flush措辞澄清；无新增端口签名/页面设计要求
TEMPLATE_COVERAGE=四模板全文已读；正式需求适用槽位与逐节N/A见检查清单
EVIDENCE_TIER=READ_ONLY_STATIC_REQUIREMENTS_AND_OWNING_SOURCE；无动态PASS
```

Reviewer 格式解释：review-standard 的 L3“非空只能GO_WITH_UNVERIFIED_UI”未区分实质finding的NO-GO与纯需求阶段未来NOT_RUN。本轮保留S-1的NO-GO及完整L2/L3未运行，不能用GO_WITH抹掉S，也不能写动态PASS；不在本任务修改规范。

阶段状态留痕：运行态期间持续读取材料、补工具截断，无错误/越界/卡死；结束状态completed，返回有效报告。路由refs阶段曾误报32，后亲算更正为30；清单采用30。主agent未将timeout当停止理由。

## 6. 原 verdict 后作者材料对照（非新一轮）

同一 reviewer 已在原 verdict 形成后补读 finding intake，`authorMaterialReadAfterIndependentVerdict=true`，`POST_VERDICT_AUTHOR_MATERIAL_COMPARISON_ONLY=true`；未读取修订需求，不改变原输入 SHA、NO-GO 或轮次。其确认 intake 准确保留原判和三项问题、工程 OPEN/动态 NOT_RUN，未发现改写 verdict。补充指出“同 application/平台/runtime 的版本冲突拒绝”是作者具体收敛范围，R1 未指定 runtime 划分；作者记录明确标注该选择交 R2 核验，不把它冒充 R1 已独立认可。
