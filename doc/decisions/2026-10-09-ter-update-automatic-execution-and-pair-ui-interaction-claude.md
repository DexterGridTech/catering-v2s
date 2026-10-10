# TER 更新阶段 C：安装邀请交互

## 1. 元数据与范围

UI_BEARING=true；STATUS=PROPOSED；DEXTER_IA_REVIEW=ACCEPTED@2026-10-09；DEXTER_WIREFRAME_REVIEW=ACCEPTED_IA_CONTENT@2026-10-09；IMPLEMENTATION_AUTHORITY=false。
JOURNEY_DECISION=doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md#2-用户任务与完整旅途
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md#11-r-11full-立即更新与用户提醒
BUSINESS_PROBLEM=下载完成后用户尚未安装，需要持续且不过度打断地邀请。
BUSINESS_USER_OR_OWNER=本机使用终端的店员；更新 owner。
CURRENT_TASK=完成已固定 FULL 安装，不选择新规则。
SUCCESS_OUTCOME=系统安装后真实 actual 达到目标，或用户稍后继续使用。
SKILL_USED=NONE；DEXTER_HIFI_REVIEW=NOT_REQUIRED。
CONSUMER_FACE=TER（后台模板枚举不适用，明确理由；不是新增 HTTP face）。
一个本机邀请，无新业务内容页/管理页面。mobile、laptop 是同一 part 的响应式布局，不是九个新页面。原生 installer、安装来源设置、原生失败文本沿 A 已确认工件；两后台沿 B 已确认工件。Dexter已确认本包IA内容；未实施、未运行，未证明真实呈现。

### 1.1 canonical 字段

| canonical 字段 | INSTALL-INVITATION |
| --- | --- |
| CONSUMER_FACE | TER；N/A_WITH_REASON：不是 platform/operations/public 后台页面，原 HTTP faces 不变 |
| UI_SURFACE | 本机提示，不是新业务内容页或 admin tab |
| HOST_AND_ENTRY | 两 integration 同一 part，owner due；仅 isHostPrimaryDisplay。本机 BRANCH/PRIMARY 上下文，不取主机业务 SECONDARY |
| ACTOR | 正在使用这台机器的店员；不授予系统安装权限 |
| BUSINESS_SCENARIO | 固定 FULL 等待用户、N 到期、本机前台、当前确认可恢复或旧 session 已结束 |
| BUSINESS_GOAL | 完成安装或稍后继续业务，不重选更新规则 |
| USER_VISIBLE_COPY | “安装终端更新”“更新包已准备好，请完成安装。”；“当前安装版本”“更新安装版本”；“稍后将在 N 分钟后再次提醒。”；“稍后”“安装”；失败“暂时无法准备安装，请稍后。” |
| TECHNICAL_BOUNDARY | taskId/actionId/boot/原生 action/session 精确核验；selector 提供本机实际版本。以上身份/路径/grant 不显示 |
| FOUNDATION_PRIMITIVE | NONE_WITH_REASON：后台 foundation 不适用于 TER；用现有 PrimitiveContainer/PrimitiveHeading/PrimitiveText/PrimitiveScrollView/PrimitiveButton/PrimitiveInlineAlert |
| CONTAINER_LAYOUT | safeHostLogicalSize 来自本机 SurfaceRoot/现有布局；宽度复用 baseTokens.containerCard 的 w-11/12、max-w-xl，故 width=min(11×safeWidth/12,当前主题 max-w-xl)；内边距沿其 p-6，不存在 baseTokens.space 字段；外边距取同主题 p-6 的已解析尺寸 g，height≤safeHeight−2g。标题/动作位于同容器边界内，仅正文滚动；长版本换行，不出现嵌套滚动或双列，字号/间距沿 baseTokens |

safe size 未可用不显示邀请，不拿另一个屏的大小猜；不为它新增设备尺寸服务。TestIds 在附件 §5；标题/版本 Text 与真实 Button 挂对应 ID。按钮点击均显式 local，失败不冒充安装成功。

### 1.2 管理后台规范 canonical 对照

| §3-K 槽位 | 本稿 |
| --- | --- |
| 列表/查询/分页、详情/编辑 Drawer、表单 lifecycle、候选、启停、审计、标准空态 | N/A_WITH_REASON：本稿不修改两后台；B 原标准与 TestId 不变 |
| 文案/位置/失败恢复 | TER primitives 的本机提示；说明明确安装与稍后，不谎称成功 |
| 例外 | 无新的后台例外；TER 不是 AntD Drawer，不能据此豁免真实控件/焦点检查 |

### 1.3 查询能力

N/A_WITH_REASON：本机邀请没有搜索、候选、total 或列表；不得增加规则浏览/选择 UI。

## 2. 交互地图

```text
准备完成 → flush → 初次沿 A native apply（平台可静默或系统确认）
  → waiting-user 的 N 再邀请：readFacts/readAction → foreground，区分已知待用户/正在安装或显示/UNKNOWN/已结束
  → 本机 PRIMARY 安装邀请
    → 稍后：关闭本次，waiting-user，N 后可再邀请
    → 安装：flush → 同固定工件的 installer
      → 系统允许：后继启动 actual readback
      → 系统确认/设置：仅由系统交互完成
      → 用户取消/ended-not-installed：waiting-user，N 后再邀请
      → known pending-user 可恢复：N 后再邀请，恢复同 session 确认，零 commit
      → 安装中或正在显示：不叠确认；UNKNOWN：仅观察同 action
      → 技术失败：准确失败，保留实际版本
后台到期 → 只记 due → 回前台 readback 后再作上述判断
```

## 3. 既有资产与 surface

复用上述确切 primitive 和 ui-state/render 的既有 alert tier，不新增 system-update tier/平台。既有 SLAVE/VICE LayerStack 仅投影 MAIN 业务并叠本机 admin，因此补一个有限的 `local-primary` placement scope：仅本机 isHostPrimaryDisplay，从本机 workspace（MASTER=MAIN、SLAVE=BRANCH）PRIMARY 读取本机 part。它使用本机 route context，不能沿 VICE 的逻辑 SECONDARY 去投影主机更新；普通业务仍沿原上下文。

邀请通过既有 openLayer/closeLayer command 打开 ephemeral 层；现有 serializeLayer 已排除 ephemeral 的持久化和同步，不新造过滤框架。该 local-primary alert 不受业务断链遮罩隐藏，admin tier 仍在其上。本机 PRIMARY 一邀请、SECONDARY 零邀请；双机各自一份，既有本机 admin 左上恢复入口不变。

| owner / surface | 唯一责任 |
| --- | --- |
| kernel/base/terminal-update | due/固定任务/策略/本机版本，决定邀请资格，confirm/defer 命令核身份 |
| ui/base/terminal-update-presentation | 单纯 selector→组件＋两个 local command，无 timer/HTTP/native 调用 |
| ui-state/render | 既有 alert layer/ephemeral 生命周期、local-primary scope、PRIMARY 布局和 admin 优先；零更新业务判断 |
| Android UpdatePort | 技术可呈现/精确确认恢复，不选规则、不计 N |
| automation driver | React 真实节点走 agent；系统 installer/设置仅已批准非 React 窄例外 |

同 App 配对沿原 LMS/LSP；不同 App 明确拒绝，不在 C 新造跨 App 副机业务。

## 4. 线框与文案（Dexter已确认IA内容）

```text
laptop / mobile 均采用同一邀请内容：
┌─────────────────────────────────────┐
│ 安装终端更新                         │
│ 更新包已准备好，请完成安装。          │
│ 当前安装版本：2.0.0                  │
│ 更新安装版本：2.1.0                  │
│ 稍后将在 N 分钟后再次提醒。           │
│                                     │
│                  [稍后]  [安装]      │
└─────────────────────────────────────┘
```

容器按 §1.1 的本机 safe size 公式，mobile 仅正文滚动，动作保留在容器边界内。N 用固定任务已保存的分钟值，不重新读最新规则。字体/间距继承 primitives，不自建 Dialog foundation。允许 silent 的平台也复用同一 owner：无需用户确认的动作沿 adapter 事实推进；不得承诺设备均能静默。

## 5. 状态与反馈表

| 事实 | 显示/动作 |
| --- | --- |
| waiting-user、due、前台可呈现 | 本次邀请；安装按钮可用 |
| 安装按钮刚触发 | 禁重复点击；不显示“已更新成功” |
| readback/flush 失败 | 现有 PrimitiveInlineAlert 显示“暂时无法准备安装，请稍后。”并保留准确原因；不伪成功，不提供坏包重试 |
| 用户稍后/系统取消 | 本次关闭；业务继续，下一 N 仍同任务 |
| known pending-user且exact确认可恢复、当前未显示 | N 到期可邀请，安装仅恢复原确认；不重新commit |
| 安装中/系统确认正在显示/UNKNOWN/后台 | 不叠邀请；UNKNOWN仅回读；后台保留due；不改变启动期限T |
| task/action/boot 失效 | 关闭旧邀请，不把点击给新任务 |
| HOT idle | 无邀请，不把 M 判闲绑定某个确认按钮 |

## 6. 控件、焦点与事件

| 控件 | TestId 常量 | 真实目标/动作 | request 关联 |
| --- | --- | --- | --- |
| 邀请 | invitation | 本机 PRIMARY 容器，可见性断言 | 不替代业务结果 |
| 版本 | versions | Text 节点实际文字 | select actual/task 交叉校验 |
| 稍后 | deferInstall | Button，click → local defer command | 动作前 selector/journal 订阅，无空窗 |
| 安装 | confirmInstall | Button，click → local confirm command | 同 taskId/当前 actionId（结束后可空）/bootId，actual readback 判成功 |

打开后聚焦“稍后”，关闭恢复原焦点；不吞内容/admin/键盘点击，不记录坐标/输入文字。本机提示点击也算最后点击，但 FULL 不受 M 调度。SECONDARY、另一机、其他 runtime 不复用本次 nodeInstanceId。

## 7. owner / face / 成功链

Dexter 2026-10-10 追加的数据归属不改变已确认可见交互：project-basic保存项目/大区/商业集团和规则，选候选后发送terminal-update公开local command；后者actor最终比较、固定和执行。store-basic只保门店业务；integration仅装配，ui/base只呈现。副机使用project-basic投影后走同一本机command，不发送peer升级命令。

不可见前提同IA/详设：store具体门店保存flush后发送自身成功command；store自己的listener加载其余门店资料，project listener才加载组织→规则，互不等待。UI不从selector自行发组织HTTP。副机按当前connection和有效entry读投影；MAIN失败导出tombstone后不沿旧规则择新，已固定任务仍保持。本次不增加页面、控件或确认动作。

confirm/defer 的输入均为 taskId＋当前 actionId|null＋bootId；owner 原子核对本机当前 task 与邀请资格，旧点击零 native。

owner 决定是否 due 与 stage；ui/base/terminal-update-presentation 仅 selector→呈现/command，无规则排序、HTTP、timer、native 调用或另一个 task state。render 只承载 local layer。应用成功仍由 A 实际安装/boot/publication 确认，B 主机 HTTP 报告。

## 8. B4/B5 与跨层引用

后台规则及报告 UI→B 同日期 Journey/IA/UI；报告语义使用 R-15 后续裁决的任务历史。不是从 API 反推新用户任务；API 缺口列详设 §0.1，不能由 UI 模拟补齐。

## 9. 看图与运行状态

DEXTER_IA_REVIEW=ACCEPTED@2026-10-09；DEXTER_WIREFRAME_REVIEW=ACCEPTED_IA_CONTENT@2026-10-09；UI_FOCUSED/WEB/ANDROID/PAIR/CLEANUP=NOT_RUN。IA内容确认已完成；内部追加两轮及外部旧字节review已完成，当前为作者修订，不重开cycle。执行面：console真机双屏、wallpaper mobile虚拟机、每App同App双虚拟机配对，共4设备run；非adapter两integration Web先行，pair只focused→双虚拟机，最后13c。全部仍NOT_RUN。实现仍须单独授权。

## 10. 逐操作合理性（仅两个已有业务动作）

| 操作 | 原任务依据 / 用户目的 | 是否有更小路径 | 代价与边界 |
| --- | --- | --- | --- |
| 安装 | R-11，等待的固定FULL已准备；用户同意当前安装 | 恢复同精确系统确认或ended后新action，复用A；不让用户另选包/规则 | 初次silent仍直接adapter；只有再邀请提供按钮，技术失败不等同手工坏包重试 |
| 稍后 | R-11，用户需要继续当前业务，仍按N提醒 | 关闭本次邀请并保留原任务即可；无需取消任务/等待上限 | 同一owner记录下次N；不会释放固定任务或选择新规则 |

### 10.1 FORM_MUTATION_DENOMINATOR / hidden facts

两个local command variant：confirmTerminalUpdateInstallCommand、deferTerminalUpdateInstallCommand。没有可编辑资料，不调用CBS mutation；下表每个variant×fact单独一行。

| variant / command事实 | 可见项 / 分类 | 取值唯一源 | 来源依据 | owner提交时核验 / 失败 |
| --- | --- | --- | --- | --- |
| confirm / taskId | 不显示，HIDDEN_OWNER_FACT | 当前本机selectTerminalUpdatePresentation.taskId | R-09/R-11、详设§8.4 | 原fixed task仍相同；不符零native |
| confirm / actionId|null | 不显示，HIDDEN_OWNER_FACT | 同selector当前action；已结束可为null | A readAction＋C§8.4 | knownpending恢复同session；ended确认后新action；UNKNOWN不创建 |
| confirm / bootId | 不显示，HIDDEN_OWNER_FACT | 同selector绑定的本机actual.bootId | A actual/C§8.2 | 旧boot点击拒绝，不交给新Runtime |
| defer / taskId | 不显示，HIDDEN_OWNER_FACT | 同selector当前taskId | R-11/C§8.4 | 同任务，失效不改新任务 |
| defer / actionId|null | 不显示，HIDDEN_OWNER_FACT | 同selector当前action | C§8.4 | 当前邀请资格、action一致，UNKNOWN不伪结束 |
| defer / bootId | 不显示，HIDDEN_OWNER_FACT | 同selector本机actual.bootId | C§8.2/4 | 当前boot，旧点击拒绝 |

当前/目标版本为FIXED_READONLY展示，不进按钮payload；准备文件、N策略、nextDue及publication由owner从固定task读，clock由owner取，不由UI填写。复制上述事实不授予权限；动作前订阅，owner最终复核，read/flush失败保持准确状态。无输入控件，表单依赖图N/A_WITH_REASON；不会因此省略两个确认variant事实。
