# TER 版本更新阶段 C DESIGN 独立审查 R3

```text
REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09
REVIEW_TARGET=DESIGN
REVIEW_ROUND=3
REVIEW_ROUND_LIMIT=4
ROUND_EXTENSION=EXPLICIT_DEXTER_ROUND_EXTENSION
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/stage_c_design_round3
INPUT_CHECKLIST=doc/review/platform/2026-10-09-ter-version-update-stage-c-design-review-input-claude.md
BLIND_REVIEW=true
AUTHOR_INTAKE_READ=false
PREVIOUS_C_REVIEW_READ=false
INDEPENDENT_VERDICT_SEALED_BEFORE_AUTHOR_MATERIAL=true
VERDICT=NO-GO
M/S/N=0/1/0
```

Dexter 当前授权为“IA确认。请再多两轮对抗性review后再移交另一个Claude做review”。本轮沿用原 cycle，明确追加 R3/R4，未通过换 reviewer 或文件名重置轮次。R3 不声明 `ROUND_FINAL_DECISION=SELF_DECIDED`。

本轮只做设计文档与当前调用链接缝的静态审查。未写文件，未测试、生成、构建、verify、启动环境、读取 `.runtime` 或执行仓库控制操作。A/B 未验收、C 未运行与真实 UI 未验证均保持原证据档位，没有因此制造 finding。独立报告由主agent落盘；本文件不含主agent修后结论。

## 1. 冻结输入

| 工件 | SHA-256 |
| --- | --- |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md | 0ed55be74354f05bcbae9ae5691f368822c017b98bfb7f585b12c635cd55ad05 |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md | 167c08d0752028513a836a453ddbeae721e34862983865357b36665fb8ae360b |
| doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md | 115ab84603d6f628aceecde16a61de114ad12aad9cf70d970cc682e06cc5b4ef |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md | 99b78acdc6a41500bbacd8e569c6bd4078b180badc7954bedb8d84d140d4f940 |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md | 991a8ee0dda70a7ba5dd5f52d031d82c74abb40ab6c8410f0f39a2487597c17f |
| doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md | c2b445c8c0e9ef21040db16ff5381298b4e1f3bb1b35bffdc7b7e0cb89d83c01 |

六份全文均已读取；对工具输出截断部分另行补读。封口时复算与上述值一致。本报告绑定修订前冻结字节；未审查主agent随后修订，R4须重开修后工件。

## 2. 实际阅读范围与独立性

- 全文：本仓cs-review skill、AGENTS、CLAUDE、Blueprint、平台和脚本README；index、六kernel、deterministic；C六文、正式需求；四设计模板、实施任务/review/terminal/frontend/third-party标准及handoff模板。
- 按输入清单六维路由读取全部命中原文：confirmed corpus、deterministic、independent review、六kernel；backend acceptance/backend coding/business corpus/handoff/frontend/verification/terminal operations；after-state/check-repo/criterion/line-number/probe/repo-rule六pitfall；atomic-group/business-channel/content-tab/decided/external-collaboration/TER-input practices；terminal-architecture裁决。
- 重开适用sourceRefs：verification/review/solution reasonableness/corpus采用/roadmap与compliance退役/observability/backend acceptance/service shape；foundation owner/授权/证据/生命周期章节、carry-over D7/D8、冻结logging和terminal build-order适用章节。原领域catalog/base-1等历史例证未移作C准入。
- 讨论稿用户裁决，尤其§9、§11–13、§19–21与禁推；corpus组织、三类用户、任职/可视节点、门店状态。未由门店启用推营业，未由可视节点推写权限。
- A三工件固定核/native/FULL/HOT/恢复/fixture/验收清理；B三工件供给/下载/报告/权限/当前同DEV supply-chain/runner与cleanup正文。只读接缝，不声称A/B已验收。
- 源码：update actor/types/slice/module/selectors/commands；runtime context/subscription/lifecycle/resources；SurfaceRoot/LayerStack/primitives、两integration；topology pairByHost/HELLO/projection/state-sync/peer result；TDC grant/report；UpdatePort及Android Module/Runtime/Preparer；automation runner/managedRun/SupplyUi/journey/API/skill；B owner API/service/snapshot persistence/edge/generated/canonical；r5-full契约组织、账号和terminal key/形态。

owning大文件按本次调用链相关章节/符号读取，不声称读取无关代码。旧C R1/R2、作者intake与自评未读；不依靠其结论。

## 3. S-01：同 DEV 供给链入口及 browser 所有权未对齐当前 B 合同

**性质：设计事实冲突；S。** 独立查证成立，仍须主agent亲验intake；severity最终归Dexter。

**冻结位置**：C详设§3a L103、计划CP-05 L82；同根详设L303资源条目。

**事实**：C详设L103与计划L82要求B的“受管browser focused入口”保留browser/context所有权，TER单独控制设备，再按顺序交接。详设L303却将browser列入本run精确cleanup。

当前B合同与source：

- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:507`：同`update.supply-chain`父run使用run-owned Playwright；L513唯一terminal-automation update phase，同父run后台动作，TER React仍经agent；L515借用DEV Vite/tunnel，TER managed case拥有新browser/context/session与设备。B计划§10和附件§20相同。
- `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts:145`创建browser/context，返回browser给父生命周期；runner已登记supply-chain。仅证明当前源码方向，不证明B完成或cleanup通过。

**推论与普通反例**：正常两App产物→运维上传保存→运营PROJECT新建启用→TER自动选中→FULL/HOT→运营同task报告，B用同父run保持身份。C却要求实施者自行决定另一browser入口怎样持session、跨生命周期交fixture、谁cleanup，或者直接违背C明文。DOM与TER工具职责分离能在同父run成立，不能推出两个受管入口。

**影响**：CP-05接线、manifest资源登记及cleanup判据不唯一；可能重复生命周期、错误停止借用DEV资源或用分离fixture拼接证据。属于普通主流程，无需极端输入。

**最小修正**：C§3a/CP-05及控制面资源引用明确同一个B最终terminal-automation update.supply-chain父run：其新建browser/context/session和TER设备owned，DEV Vite/tunnel精确借用；管理端用现有DOM/TestId helper、TER React用agent、installer用driver窄例外。仅扩自动eval/N-M/同App主副及注册；CP-01重读B最终argv/字段/cleanup，不建新runner，不改B/source，不增动态/reset/seed/隔离L2授权。

**同根全集**：命中详设L103、计划L82；详设L101/262/303/319与附件§6核对同步。Journey/IA/UI没有第二browser生命周期。不重复计数。

**防再犯**：现有checklist补当前入口、父run、owned/borrowed、cleanup四项复核，不只引用旧helper名称；无新门/台账/恢复框架。

**Dexter决定**：无需新产品/Journey决定；技术合同对齐在当前文档授权内。严重度与采纳归Dexter。

## 4. 方案合理性与反例结论

核心方案合理：权威集合择最新适用规则、port前固定整规则、两机共用判断核但本机task/actual/click隔离、FULL→HOT跨启动。没有通用恢复平台。

| 攻击面 | 独立判断 |
| --- | --- |
| 较新JS/较旧native | §8.1/8.2区别actual与embedded，未先runtime过滤丢FULL |
| S2续HOT/S3确认择新 | execution boot与确认分离，旧确认不占S3 |
| N重复installer | owner提醒/native exact恢复分离，UNKNOWN不commit |
| M双屏/吞业务点击 | 本机ephemeral点击，SurfaceRoot capture，同boot双屏共享 |
| BRANCH邀请被投影覆盖 | 本机PRIMARY、admin恢复明确；实现待落地不作设计finding |
| task/凭证复制副机 | 仅规则与source context投影，本机事实隔离 |
| 不同App配对 | Dexter禁止，保留module/protocol门 |
| FULL/HOT摘要 | FULL APK publication/HOT自身manifest分源 |
| 停用抢占固定任务 | 固定任务不要求仍在启用集合，非法binding/context仍拒绝 |
| GROUP/PROJECT写权限 | 具名合法shell/capability，非激活STORE session |
| 旧task缺N/M | 有限阻断/可信policy读回或具体产品处置，无默认fallback |
| 极端ZIP/容量 | 没有超出常见主流程的新要求，普通边界保留 |
| fixture代替自动 | C明确要求terminal自动eval |

当前唯一设计阻断是S-01；真实执行与cleanup均NOT_RUN。

## 5. TEMPLATE_COVERAGE

| 模板 | 独立覆盖 |
| --- | --- |
| Journey | 元数据、任务、逐actor前提、禁推、corpus、UI/后台引用、裁决具备 |
| IA | 可见维度/未来观察、容器负载、共用规则、等待失败、交叉对账、完成具备 |
| UI | canonical、map、资产、线框/TestId、状态/焦点、操作合理性、hidden facts、face/owner、B4/B5、看图具备 |
| UI条件项 | 本批无新输入、动态集合、搜索，N/A有理由；高保真NOT_REQUIRED；TER复用primitives |
| implementation | §0–14各适用槽位与§3a/9a/10b/11a/13c具备；§3a及CP-05资源合同仍有S-01实质冲突 |

## 6. 固定结论块与未验证项

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=findings：S-01，供给链入口/父run/browser ownership及cleanup合同未统一
L2_USER_VISIBLE=静态设计未发现额外finding；安装/稍后来自批准Journey；真实供给链合同受S-01影响；真实UI未验证
L3_UNVERIFIED=全部以下项NOT_RUN
SAME_ROOT_SCAN=详设103/计划82；详设101/262/303/319及附件§6已核
DESIGN_GAPS=S-01入口与资源判据不唯一；其余已列OPEN不另造缺口
TEMPLATE_COVERAGE=四模板适用槽位有；条件N/A有理由；§3a/CP-05实质冲突
EVIDENCE_TIER=当前文档＋相关生产源码静态；非测试/L2/Android/业务验收
SOLUTION_REASONABLENESS=核心方案合理；当前因S-01不能GO
```

未验证：邀请真实布局/长版本/小屏/焦点/遮罩恢复；C选择、点击/N-M、boot、迟到、projection/codec/cleanup focused；ExpoWeb/Android/同App双机真实表现；两App FULL/HOT/系统确认/重启actual；同DEV上传→规则→自动执行→CBS报告完整链；B最终schema/API/argv/fixture/验收；生成类型编译机械门/第三方实际运行；timer/订阅/prepared/browser/设备/reverse两侧cleanup。

非空L3限制GO只能GO_WITH_UNVERIFIED_UI；本轮已有实质S，故NO-GO不能被UI未知覆盖。独立子任务已完成；未创建动态资源，无business/cleanup PASS；未参与修后复评，交fresh R4。
