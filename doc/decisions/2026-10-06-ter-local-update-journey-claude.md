---
title: TER 本机更新阶段 A Journey
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
implementationAuthority: false
---

# TER 本机更新 Journey

## 1. 裁决元数据

BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md §20.3；R-09～R-14。
JOURNEY_ID=TER-LOCAL-UPDATE；STATUS=PROPOSED_FOR_DEXTER_CLAUDE_REVIEW；SKILL_USED=cs-spec-to-plan；DECISION_OWNER=Dexter；CORPUS_VERSION=当前corpus原文（未创建新版本）。
JOURNEY_DECISION=本文件；DEXTER_ACCEPTANCE=ACCEPTED（仅三个面内容）；DEXTER_WIREFRAME_REVIEW=ACCEPTED；UI_BEARING=true；PREREQUISITE_STATUS=BLOCKED_FOR_DEXTER_DECISION（最低FULL API及实施授权）。
Dexter 于 2026-10-06 明确“界面内容我都确认”，覆盖系统安装/来源设置、启动加载、原生失败文本；取消、恢复与无手工重试语义继续有效。界面内容接受不代表设备行为已运行，不授权实施或运行。

## 2. 用户任务与成功结果

企业分发终端的使用者在系统要求时确认安装；终端更新 owner 执行已固定目标。
成功是实际安装版本、实际运行 JS 及业务持久数据正确，不能以下载或 reload 接受代替。
A 的入口是受管 fixture 调用最终 owner command；没有用户手工更新入口、后台页面或自动项目规则。

## 3. 逐 actor 前提链

| actor | 必须成立的输入 | 来源及失败处理 |
| --- | --- | --- |
| 开发者 | 仓内 application package 声明、签名材料、完整资源 | 打包验证；没有合法企业签名时不产生产包，不能用 debug 签名冒充 |
| 终端使用者 | 当前应用实际安装身份；系统允许发起安装 | PackageInstaller readback；需确认则打开系统原生安装面，取消继续 WAITING |
| 更新 owner | 固定目标与可信摘要；必要业务 slice 已 hydration | 最终 command/selector；flush 失败零提交，未知结果先核对不重派 |
| 原生启动保护 | 当前 candidate/boot 身份及上一成功发布 | 原生原子记录绑定实际已安装 APK；变化先复位 embedded，PRIMARY 成功且必要 hydration 后才确认 |
| 验收操作者 | automation-agent 已交付接口及受管权限 | 本轮 UNVERIFIED；没有入口时修现有 driver，不启用旧 runner |

### 前提类型与责任

| 输入 | 模板来源类型 | 精确来源/责任 | 缺失时 |
| --- | --- | --- | --- |
| 固定target、task/action身份、boot保护 | IN_SCOPE_PRODUCED | 详设§8.3～8.7；本批owner/adapter生产 | CP内补齐，不触发真实更新 |
| hydration、PRIMARY real-ready、Runtime command/selector | ESTABLISHED_SOURCE | runtime/createRuntime、integration-assembly/integrationAssembly.tsx；实施时重开当前接口 | 失败不confirm，不造成功事实 |
| seed终端及激活前提 | ESTABLISHED_SOURCE | r5-full fixture contract与automation/fixtures/managedActivation.ts；仅需要业务数据的case | REQUIRE_INACTIVE；缺数据停止，不seed |
| 企业签名/分发与目标设备/API/安装权限 | EXTERNAL_PREREQUISITE_DEXTER_DECISION | 企业分发已裁定；具体签名配置、受管设备选择和执行授权仍由Dexter提供 | 本包保持BLOCKED_FOR_DEXTER_DECISION；不得用debug产物冒称企业生产包 |
| 最新automation交付接口 | ESTABLISHED_SOURCE | tools/terminal-automation当前源码；尚在验收，完成状态不能从作者描述推定 | 当前静态接口可设计；未来实施先核验交付，不干扰在途任务 |

开发者签名、设备/API/安装资格是外部操作前提，当前OPEN，由未来CP-01/03核验；runtime hydration/PRIMARY与fixed target是owner产品/工程前提，必须同生产链证明。
automation交付是跨任务前置，不能由本文件改他在途范围。若前提不存在，停在相应动作之前并报告，不自动重置/seed/补假数据。

## 4. 任务边界、非目标与禁推

A 提供 FULL/HOT 真实能力与固定执行核；B 才建 CBS、管理后台、规则供给/报告；C 才做 N/M 调度和双机同步。
FULL 用户取消、经成功读回证明 session 已结束且未安装（ENDED_NOT_INSTALLED）均继续等待；下一可呈现时以新 action/session 邀请原固定工件。仍存在而不可判定或读回失败才保持 UNKNOWN；未知归属占用不抢占，结束后重核并解除等待阻塞。没有失败包手工重试；没有 APK 回退。
固定后不能被停用/新规则替换，也不把无限等待重新定义为自动超时失败。
发布纪律要求 FULL 中间内嵌 JS 读得懂此前数据，HOT 启动确认前不作破坏性迁移。任意 APK 身份变化，包括同 runtime FULL 与外部高版本安装，先使旧选包/候选/恢复资格失效并运行新 embedded；embedded 保持 assets://+res，HOT 及文件型恢复目标才走文件根。

## 5. Corpus 命中与冲突

`project-memory/decisions/confirmed-business-language-corpus.md` 是称谓正本。
本阶段没有管理后台 screen；使用“终端”“安装”“更新未完成”，不向用户显示 bootId、preparedId、runtimeVersion。
系统安装按钮与提示归 Android，文档里的示意不能作为逐字 UI 文案承诺。
新增原生失败提示“更新未能启动，请联系管理员”已随三个面内容由 Dexter 确认；本轮不授权写回 corpus，动态显示仍 NOT_RUN。
运维管理后台=platform-admin、运营管理后台=operations-admin，仅在后续 B 出现。

| 语汇/任务 | corpus状态 | 本批处理 |
| --- | --- | --- |
| 两类管理后台名称 | ESTABLISHED_SOURCE | 沿用正本区分，A不建后台 |
| 终端使用者确认安装/取消 | 本批需求已裁，系统文案非corpus逐字产品文案 | 只承诺取消仍等待与实际安装事实 |
| 更新未能启动，请联系管理员 | ACCEPTED_IN_THIS_JOURNEY | Dexter 已确认界面内容；未写回 corpus，不制造新重试入口 |

## 6. UI 适用性与后续工件

IA=doc/decisions/2026-10-06-ter-local-update-ia-claude.md；交互=doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md；详设=doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md。
系统安装面、已有启动加载面与原生保护失败面分别声明；不增加手工更新页。
### 6.1 管理后台交互一致性
N/A_WITH_REASON：A 无管理后台 screen、Drawer、表单或列表；不能据此豁免 TER 的真实动作/状态观察。

## 7. Dexter 裁决

已接受：FULL/HOT 唯一配对方案；取消继续等待；无手工重试；同 native 的 HOT 有界技术恢复；企业分发。Dexter 本轮已批准取消激活根级 state 清除的 TR-09 精确例外，详设§12登记正本同步前置；角色切换只是重载 JS，不能作为该例外理由。规范未修改，须未来实施授权下于 CP-02 前落地，不扩大为其他 root reset。
工程 OPEN：Expo handler/reload 的实际加载、有限技术预算、签名/安装资格仍需实现期证明；FULL 最低设备 API 按详设§12待 Dexter 选择。原生失败面等三个面的内容接受已关闭。
界面内容已接受；本包仍无实施/运行授权，新能力和设备行为全部 NOT_RUN，不以看图确认替代工程证明。
