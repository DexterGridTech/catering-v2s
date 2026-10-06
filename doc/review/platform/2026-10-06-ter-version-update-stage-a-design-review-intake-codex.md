# 阶段 A DESIGN finding intake

REVIEW_CYCLE_ID=TER-UPDATE-A-DESIGN-20261006
作者处置不是独立verdict。需求/规范/源码未修改；所有实施与动态NOT_RUN。

## R1逐项重开与最小处置

| ID | 核验分类 | 当前处置/最小替代 | 状态 |
| --- | --- | --- | --- |
| M1 | CONFIRMED | 需求§20.3/生产command限制与原CP重开。CP-02先最终owner/Web；CP-03把native和保护同交付再真实触发；无run-only native探针 | CLOSED（静态修订，非运行PASS） |
| M2 | CONFIRMED | 重开Expo Host和3reset族。§8.7写预留token/getter只读/当前旧ReactContext先绑定/新context不可变；不依赖onWill每reload或onDid前置 | CLOSED（API接线未来F-BOOT） |
| M3 | CONFIRMED | §3a全部action/观察与OS系统UI例外、控制面、OPEN；不造额外TER按钮 | CLOSED（UI仍UNSET） |
| S1 | CONFIRMED | 四模板适用槽补齐：详设§3/3a/9a/9b，Journey三类前提/corpus，IA逐面不可见/错误/对账，UI state/action/faceowner | CLOSED（模板静态） |
| S2 | CONFIRMED | §8.7单native action记录+系统session全窗口；UNKNOWN不重commit/不删APK；无第二业务账本 | CLOSED（行为NOT_RUN） |
| N1 | CONFIRMED | §9a.2/10b、计划CP01/05/§8；fixtures与journeys正确路径，device-serial，DEV特定子断言hook | CLOSED（入口待实施） |

severity保留reviewer原提议；没有把未知行为标PASS，工程有限协议不扩大用户功能。same-root分母与反例保留R1报告，修订补旧context首次绑定和reset retain以防同族迟到/清标记再犯；native/session确定性仍需未来proof。比较更小替代：一次记录+系统读回，拒绝poller/第二账本；固定四模板补槽，拒绝新台账；唯一automation driver扩展，拒绝旧runner。

## R2冻结输入

- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md`：`74ae1fc6315c450839420eb799dfce3df6d7cf521beb0b112eddcaae3b12ab24`。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md`：`f32d308ec97bb6ecc934ab63cd3977836c903286cb6ffbd55c62af08652c2f92`。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md`：`760529efaefbc43ba61bf00f9d403ed98453b6b4bf7bb43a8d5081dc68e698af`。
- `doc/decisions/2026-10-06-ter-local-update-journey-claude.md`：`12573920fd97b4c4ec5a67516a748f3e973d0dd435ae028b83b6ecfe9d337faa`。
- `doc/decisions/2026-10-06-ter-local-update-ia-claude.md`：`ed422efd4a13e1e131b570cd976d7af9ac23f4a382888b243144d6eb5df06025`。
- `doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md`：`61a4e6692893f23275c0e51c3912f69109d2539ee25c153d1e23b7e215c357f7`。

R1旧SHA与verdict不升级成当前字节独立结论。R2为同cycle第二轮硬停止；等待独立输入完整读取/报告。

## R2硬停止与作者处置

REVIEW_ROUND=2；REVIEW_ROUND_LIMIT=2；ROUND_FINAL_DECISION=SELF_DECIDED。
独立冻结结论NO-GO，0M/1S/0N，见R2报告；作者收口=HOLD_FOR_DEXTER_CLAUDE_REVIEW，不召开第三轮，不代写独立GO。

R2-S1：CONFIRMED / PARTIALLY（精确设计前置已修，规范裁决仍OPEN）。重开terminal-coding-standard.md:363–369及383–384，state/foundations/createStateRuntime.ts:81与persistenceEngine.ts:438–469；通用retain能实现不等于允许另一个owner。正式需求R09/10不允许以root reset丢固定更新/清坏包事实，也不能自行改成clear。最小修订是详设§0/§8.4/§9a/§12与计划§0/CP02明确规范依赖：由Dexter批准后仅在TR09正本增加terminal-update已声明落盘字段的精确例外，不扩大其他owner/credentials，CP02前完成并有focused/red。本轮不修改规范/源码，不建旁路文件存储。若拒绝该例外需Dexter裁决冲突；不能带规范OPEN进入该CP。

此外作者明确CP总览中CP06的阶段出口先于全批6b/批次整体验收，消除表格把整体验收理解为CP06阶段退出前置的歧义；并校正topology现有reset源码简称为topology/src/features/actors/actors.ts；下载尝试/退避364s与取消结束单次10s分开标注，避免总期限口径夸大。它们是文档澄清，未改已裁产品语义，没有新的独立verdict。R1关闭表是静态处置；真实F/UI/版本兼容与cleanup仍未证明。

### 当前位置

- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:16`：STANDARD_DEPENDENCY=。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:166`：### 8.4。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:344`：OPEN-STANDARD。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:41`：进入前：Dexter。

## 当前交付字节（R2后作者修订，未独立GO）

- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md`：`1fa3f3eb70237ba346b64a712929eed88cd16f926a9c59979a55282f83b02588`。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md`：`8d3f8e7d9f12b229c012e3971ab25da58a4e3795ed563708f061262ae1ffe022`。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md`：`760529efaefbc43ba61bf00f9d403ed98453b6b4bf7bb43a8d5081dc68e698af`。
- `doc/decisions/2026-10-06-ter-local-update-journey-claude.md`：`12573920fd97b4c4ec5a67516a748f3e973d0dd435ae028b83b6ecfe9d337faa`。
- `doc/decisions/2026-10-06-ter-local-update-ia-claude.md`：`ed422efd4a13e1e131b570cd976d7af9ac23f4a382888b243144d6eb5df06025`。
- `doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md`：`61a4e6692893f23275c0e51c3912f69109d2539ee25c153d1e23b7e215c357f7`。
- 只读原始输入 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：`f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22`。
- 只读原始输入 `doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`：`707172f77399323f3dff97063f6b040b82be307aaee1e47af567cb07d678a409`。

需求/讨论正本未修改。外部复评为Dexter中转，不能称内部R3。全部实施、运行与cleanup=NOT_RUN。
