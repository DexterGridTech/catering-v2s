# 阶段 A DESIGN R2 独立审查

REVIEW_CYCLE_ID=TER-UPDATE-A-DESIGN-20261006
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/update_design_r2
ROUND_FINAL_DECISION=SELF_DECIDED
INPUT_CHECKLIST=doc/review/platform/2026-10-06-ter-version-update-stage-a-design-review-r2-input-checklist-codex.md
BLIND_REVIEW=先独立判断再对照R1/intake

主agent转录reviewer冻结报告；保留verdict、finding、覆盖与限制。位置只指冻结SHA，不是作者修订后位置。结论NO-GO，0M/1S/0N；后置修订未独立GO，不召开R3。

## R2-S1：update retain未与TR-09正本闭合

Severity=S；性质=仓内事实及其实现冲突推论。
冻结详设:167；冻结计划:44（文件完整路径见checklist）。
Owning source：doc/platform/terminal-coding-standard.md:364–369仅D16 server-config例外、383–384禁止下游自加；doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md:112；apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts:81、persistenceEngine.ts:438；server-config/src/application/createServerConfigModule.ts:39。
Fact：新update currentTask/recentStatus/failedArtifactIds直接retain，现行正本仍只有server-config。state通用支持retain不等于许可。
反例/影响：root reset按现行标准清update，会丢固定任务/坏包事实；按冻结详设retain则违反标准，CP02无法同时三维MATCHED。server-config合法是具名D16，不推导其他owner合法。
最小修正：保留既裁固定任务与不清坏包语义，明确唯一TR09规范依赖；CP02前Dexter接受并在正本具名；只保留update descriptor实际落盘字段，其他owner/orphan/namespace/ephemeral不扩保留；focused/red同时证明保留和禁止扩大。当前授权只文档，不要求现在改规范或运行。无第二存储/任务库/reset平台。
Dexter decision=YES：接受精确TR09例外及未来同步范围，无须重裁FULL/HOT、同boot一rule、A/B/C。
通用失败模式：把机制支持当规范授权；既有design/review checklist必须列现行例外、新owner与唯一正本前置，不新增机器控制面。

## 重点静态核验

| 项 | 冻结位置与判断 |
| --- | --- |
| CP02→03 | 详设36–39/95，计划CP02/03：最终owner/Web先行，native与保护同CP，首次实际HOT正式command |
| immutable boot | 详设194–211：load前T；旧currentContext先绑定，reservation/getter幂等，新context不可变，cold/HOT/recovery/三reset，旧confirm不借全局token |
| installer | 215–233：INTENT/create未记session/STAGED/COMMITTING/callback窗口完整；模糊UNKNOWN不重commit/delete，取消等待 |
| slice/native | 166–179：owner-only/isolated、actualnative回读、task/action flush、dirtyflush；native不复制项目规则/task。retain受S1阻断 |
| 中间包/恢复 | 178–179、CP04：旧embedded到原HOT，原JS下限不降低；data兼容仍未来proof |
| canonical/provider | 133–142：TS/Kotlin schema同源、发布树identity；生产provider无规则，run-owned工件只有automationprofile |
| 资产/Hermes | 140/145–149/342–347：公开file Host/布局有源码依据，实际native解析/load工程OPEN |
| 有限预算 | 236–241：文件/字节/下载/空间候选边界，未声称安全实测 |
| 唯一driver | 275–309：当前runner update phase；DEV特定业务子断言hook，同run包名/签名/storage稳定 |
| cleanup | 计划113与停止条件：UNKNOWN/owned边界，cleanup非PASS不完成，当前NOT_RUN |
| 用户操作 | 合法系统install/cancel/settings；仅OS R10窄例外；无旧runner/手工retry/双机调度/CBS/NM扩张 |
| 两App/表面 | 320–337：两App/mobile/单机双屏，非adapterW→native同场景 |

当前公开Expo/core/RN支持接口、cached Host/context假设，不证明真实更新成功。CP出口→全批6b→整体测试及13c/implementationreview顺序有条款；不以旧MATCHED汇总替代新6b，无重复无关对账。S1应CP02前闭合。

## 四模板逐节覆盖

| 模板槽 | 冻结覆盖 |
| --- | --- |
| Journey1–7 | 元数据、用户任务、actor三类型前提、边界、Corpus、UI后续、Dexter裁决有；仍候选 |
| IA1–6 | 元数据、逐面可见/不可见维度、共用规则、全部错误映射、具体交叉、完成状态有 |
| UI1/1.1/1.2 | 元数据/强制标准/后台一致性适用性有 |
| UI2–4 | interaction map、既有盘点、INSTALL/BOOT/FAILURE线框/责任有 |
| UI字段/搜索派生槽 | 无TER表单或搜索候选，具名N/A；OS不伪TER表单 |
| UI5–7 | 状态恢复、operation合理性、face/surface ownership有，control面明确 |
| UI8–10 | retiredmanifest不恢复、HiFi无需、看图UNSET有 |
| 详设0–3 | 授权/目标/比较/CP/横切固定组/第三方有 |
| 3a/4 | action/control前置与门控，OS例外有 |
| 5–7 | operation/face、跨owner、声明传递消费有，无CBS/DB N/A |
| 8 | 版本/port/状态/FULL/HOT/boot/installer/预算有；retain许可缺口S1 |
| 9/9a/9b | API/消费者/同步/有限门/runner/文件定位有 |
| 10/10b | 数据迁移、seed/fixture角色与父流程边界有 |
| 11/11a | 全A场景和W/native/business/cleanup分开有 |
| 12–14 | OPEN/停机/CP6b/13c/交付自查有 |

覆盖是候选槽填写，不等于被批准或运行通过；形式覆盖不解除S1。

## R1独立对照

| 原项 | 本轮静态关闭 | 依据/尚需证明 |
| --- | --- | --- |
| M1 | CLOSED | 36–39/95、CP02/03正确顺序，FLOAD/INSTALL/BOOT未来 |
| M2 | CLOSED | 194–211旧context/三reset/提前T协议，真实迟到及reload未跑 |
| M3 | CLOSED | 74–90、UI58/95/138–142全control与OS例外，UI UNSET |
| S1 | CLOSED | 四模板及9a/10b/11a/13b/13c补齐；新retain规范冲突另列R2S1 |
| S2 | CLOSED | 215–233全部installer窗及UNKNOWN/cancel |
| N1 | CLOSED | 275–309、CP01/05当前runner/DEVhook/同run身份；agent交付未证明 |

作者R1 CLOSED与本轮静态核验相符，但不能因此无条件实施。真实F/UI/兼容等全部NOT_RUN。

## 同根与方案合理性

扫描rootreset、三reset/reload、retain descriptor/namespace、server-config唯一例外、固定task/坏包事实、installer UNKNOWN，仅确认S1。复杂度来自批准的跨APK/HOT、坏JS和安装崩溃边界；native最小boot/action事实不可全由JS替代。复用state、公开Host、唯一automation比测试分叉/旧runner/双账本简单；无理由增加通用恢复/reset平台。所有可见动作服务安装/恢复，不夹手工更新或后台管理。

## Verdict

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B文档提取
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=R2-S1：terminal-update retain与现行TR-09唯一例外冲突，规范前置未闭合
L2_USER_VISIBLE=静态任务/操作合理性未发现阻断；UI仍UNSET，不是用户可见验收PASS
L3_UNVERIFIED=UI看图；OS安装/取消/settings；同Activity启动遮罩/失败面；file资产/Hermes；中间包兼容/恢复；预算；automation交付/执行
SAME_ROOT_SCAN=retain/reset/namespace、三reload、固定task/坏包、installerUNKNOWN与server-config例外；仅S1
DESIGN_GAPS=R2-S1：新retain在唯一TR09的接受与实施前同步条件
TEMPLATE_COVERAGE=四模板逐节适用槽已覆盖，退役/表单/搜索具名N/A；不解除S1
EVIDENCE_TIER=STATIC_SOURCE_ONLY；动态business/cleanup=NOT_RUN；未读.runtime/evidence
```

S存在保持NO-GO，非仅UI未验证。第二轮硬停止；作者后置标准前置修订是处置，不是本轮独立GO；规范批准/后续授权交Dexter，未来仍有工程闸和IMPLEMENTATIONreview。
