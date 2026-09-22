# TER UI 业务可读性需求 · 独立对抗审查第一轮

> 主 agent 保存独立 reviewer 原文，除去会话 memory 引用显示标记外未改写结论。无第二轮。

- reviewer：Gauss，`01a0c96f-c93b-72d1-ade7-1532a0080c41`；fresh、只读。
- `DEXTER_REQUESTED_ROUNDS=1`；原文 `REVIEW_ROUND_LIMIT=2` 是仓库上限，不代表将进行第二轮。
- 送审需求 SHA-256：`95c26ffa3a7b9a0b35607580a425d2295104902c299a9709743de4e2611120c1`。
- 输入清单 SHA-256：`61be85c9c598159c9f5f5f708190835f384de18ef616ffc3b4cd84091f3e7a85`。
- 后续作者修正见需求稿 §10；本报告保留修正前独立结论，不改写为新一轮 PASS。

---

Dexter，本轮独立需求审查完成：**未发现阻断性问题，M/S/N＝0/0/1**。需求方向可接受；唯一 finding 是现有分类器符号写错。未创建或修改任何文件。

## 1. 身份、范围与独立性

```text
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INPUT_LIST=/Users/dexter/Documents/workspace/idea/catering-v2s/doc/review/platform/2026-09-22-ter-ui-business-readability-requirements-review-inputs-round1-codex.md
SCOPE=需求分析；非详设、非计划、非实施验收
```

盲审顺序已执行：入口及授权 → 六维 memory 与适用原文 → 原始要求、标准和指定源码全集 → 自行推导应然 → 最后完整读取需求稿，再回源证伪。

没有读取本轮作者自审、finding dispositions 或其他 reviewer 结论；需求稿中的自报数字、已核声明和双读声明未被作为证据。下面的数量与判断来自独立读取。

## 2. Finding

### N1：现有分类器名称误写，引用不能定位到真实公共能力

**状态：CONFIRMED；非阻断。**

- 需求位置：[需求稿 §3.3，第85行](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md:85)。
- 文档写：`classifyRequestOutcome`。
- 实际定义：[requestOutcome.ts，第10行](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/foundations/requestOutcome.ts:10) 是 `classifyRequestResult`。
- 实际公开导出：[render/index.ts，第59行](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/index.ts:59) 同样为 `classifyRequestResult`。
- 三个 feature 的五处请求编排全部调用后者。

**影响：**读者按需求寻找既有能力时会得到不存在的符号；不过“分类器已有、重复在外围编排”的分析本身成立，不影响推荐方向。

**同根全集：**核对该句列出的五个 API 名称。另四个 `dispatchWithRequestId`、`useTrackedRequest`、`useRequestInFlight`、`useDispatchCommand` 均有对应定义及消费；其余四个已核对，无同类误写。三个消费者中的五处分类调用也已逐处核对。

**最小替代：**仅纠正文档名称。不要为匹配文档增加别名、兼容导出或第二套分类器。

## 3. 动作 1-B：事实提取与判定

| 必查项 | 独立提取结果 | 判定 |
|---|---|---|
| 模板整节/整列缺项 | 四模板分别服务 Journey 裁决、IA、交互工件和 implementation-facing 详设；本轮明确为需求分析，不新增 Journey 或交互 | 没有应补而漏补的本轮模板整节。CP、接口签名、实施清单、focused proof 等均为 **N/A：用户明确要求停在需求阶段** |
| 跨文档冲突 | TR-14 要求单机型 basename 含 Laptop/Mobile；最新用户要求目录区分、文件去后缀 | 冲突真实，但需求稿 R-6 已明确按最新指令处理，并限制未来标准同步范围；不要求用户再次裁决同一命名意图 |
| 跨文档冲突 | 旧 D-14 要求复用系统提示正文；当前六个 feature renderer 仍自写正文 | 需求稿准确识别“能力已有但未消费”，没有把旧设计宣称当成当前实现事实 |
| 跨文档冲突 | member README 的姓名键盘描述与当前 hook 配置不一致 | 需求稿已记录漂移，且明确不据此改键盘行为；不是本轮遗漏 |
| 无出处数值 | 45 个组件文件、14 个语义 part、28 个机型注册、16 个 integration 文件、五处请求编排 | 均独立重数吻合；不是作者计数继承 |
| 无出处数值/枚举 | padding 24、none/w1/w2/w3、request outcome、layer tier/guard、surface/display/instance 条件 | 有当前源码或既有专项要求来源，没有发现新造业务阈值 |
| 精确源码引用 | `classifyRequestOutcome` | 对应 N1 |

§3.3 的“unknown”是阶段解释的简写；当前类型字面值实际为 `unknown-write-phase`。文档没有将其冻结成新 API 枚举，不另列 finding。

## 4. 重点对抗结果与同根全集

### 4.1 纯业务逻辑是否被错误推进 base

该怀疑被当前需求稿反证，**REJECTED_WITH_EVIDENCE，不计 finding**。

已逐项核对：

- auth 的 `authNoticeMessage`；
- member 的 `registryNoticeMessage`、discard intent 对应文案；
- wallpaper 的标签、资产映射、`wallpaperSystemMessage`；
- `phaseFromActorResult`、`classifyWallpaperWritePhase`；
- wallpaper child error 的业务身份与阶段上下文；
- 三个 `systemFailureDismissal` 短绑定。

其中，壁纸标签确实在 hook 与背景组件中重复，适合 **feature 内唯一化**；其他纯业务解释不能仅因“纯函数”“看起来工具化”就迁入 base。

需求稿 §3.2、R-3、§5 已作此区分。尤其没有要求把单一消费者的壁纸写入阶段规则抽成通用业务引擎。

### 4.2 请求编排是否被误当成五个等价函数

五处全集如下，逐处核对了正常结果与 rejection 分支：

| 编排位置 | 必须保留的差异 |
|---|---|
| auth `useStaffLogin.submit` | 输入快照；业务失败清密码；系统失败通知；处理 rejection 后继续抛出 |
| member `useMemberList.logout` | logout 业务意图；处理 rejection 后继续抛出 |
| member `useMemberForm.submit` | 输入快照先于 start；`peer-intent`；处理 rejection 后继续抛出 |
| member `useCustomerMember.decide` | confirm/reject/handBack 共用入口；`peer-intent`；处理 rejection 后继续抛出 |
| wallpaper `runAction` | 同步 ref 防重入；select/confirm 及 phase 解释；消费 rejection 并返回 undefined；finally 释放本地保护 |

五处均完成核对，无遗漏。“五处”是编排骨架分母，不能拿来代替用户动作数量。

需求稿明确保留 catch 策略、routeIntent、业务失败动作、running/terminal、request 身份及已有防重入。没有发现要求公共 helper 抹平这些差异的条款。

### 4.3 公共 notice 是否真的被消费

静态结论：

- `SystemFailureNotice` 已定义并公开导出。
- `AuthSystemNoticeLaptop/Mobile`、`DeskSystemNoticeLaptop/Mobile`、`WallpaperSystemNoticeLaptop/Mobile` 六个 renderer 当前都未调用它。
- 六个均逐文件读过；不是依据文件名或“已导出”推定复用。
- 公共组件内置 padding、居中、bounded card；各 mobile 实现存在布局差异。

因此，需求稿选择“先复用既有能力，再评估必要的有限展示扩展”合理；直接替换六个 JSX 而不保留布局并不成立。业务身份、文案、dismiss command 与 actor 应继续属于 feature，需求稿也明确如此。

### 4.4 part 类型、目录及可达性

独立计数：

| 包 | 语义 part | 机型注册/实现 | 旧无后缀转出 | 真共用组件 | 组件文件 |
|---|---:|---:|---:|---:|---:|
| member-desk | 9 | 18 | 9 | 1 | 28 |
| staff-auth | 3 | 6 | 3 | 1 | 10 |
| wallpaper-picker | 2 | 4 | 2 | 1 | 7 |
| 合计 | 14 | 28 | 14 | 3 | 45 |

另有四个 hook 文件、十四个导出 hook：member 九个、auth 三个、wallpaper 两个。

三个 part wrapper 都使用 `ComponentType<any>`；既有 `definePart<TProps>` 已能保留组件 props 类型。需求稿要求保留类型、显式绑定机型、保留业务元数据，方向合理，无须新建 registry。

可达性不能从注册数量推出：

- `CustomerWelcomeMobile` 注册要求 SECONDARY，而当前 mobile 声明没有 SECONDARY。
- member 的 waiting/withdraw 路径还受到“存在副屏”的业务分支约束，不能仅因其 mobile renderer 注册在 PRIMARY 就认定正常路径可达。
- `CustomerMemberMobile` 有 PRIMARY 的 handheld-confirm 用途，不能与 mobile 副屏不可用一起机械删除。
- wallpaper integration 的 waiting/welcome 是两个 laptop-only SECONDARY part，没有补 mobile 页面的需求。

需求稿已把“注册全集”和“生产可达集合”分开；未把 28 个实现文件冒充 28 个运行页面。

### 4.5 integration 是残留重复，不是缺框架

两个 integration 的 **16 个 src 文件全部读取**。

确认的重复包括：

- 两份 surface 类型、声明解析、选择逻辑；
- 两处 startup-ready 载荷映射与相似日志；
- 两处 stateSyncSlices 筛选。

同时已实际接入 `createConsoleAssembly`；三个 feature 已接入 `createFeatureAssembly`。会员同步输入与壁纸同步输入不同，placement、背景、应用身份仍有真实业务意义。

需求稿没有建议重造 console 框架、自动扫描所有 slice，或绕过 feature-assembly 的 owner 检查。

## 5. 独立方案合理性判断

最小合理方向与需求稿基本一致：

- **明确需要：**机型目录化、去歧义旧转出、hook 按职责定位、业务字典包内唯一化、真实消费既有 notice。
- **合理的有限候选：**复用请求外围生命周期、类型安全的 part 绑定、两份 surface 解析规则。
- **应保持候选而非强制抽取：**startup-ready 短映射、stateSyncSlices 短筛选、邻近诊断辅助。需要实际复用收益，不应仅为减少行数增加跳转层。
- **明确保留业务侧：**command/part 身份、失败恢复、写入阶段解释、字典与资产、placement、同步模块集合、主题和持久化身份。

需求稿已比较“仅搬目录”“机型分支单 renderer”“通用页面/actor 引擎”等替代，未提前冻结 helper API、CP 或实施路线。没有需要本轮升级成详设才能解决的要求。

## 6. 证据分档与固定 verdict

- **静态已证：**文件与注册分母、hook/请求分支、公共能力定义与实际消费、owner 依赖方向、integration 接线及需求文本中的边界。
- **测试已证：**无。本轮没有执行 typecheck、测试或构建，也未继承旧 PASS。
- **无人在本轮验证：**
  1. 整理后的 laptop/mobile 画面、布局和视觉是否不变；
  2. 抽取后的输入、焦点、busy、异常和三种关闭入口是否保持；
  3. Web/Android/native 的真实显示、背景及拓扑行为是否保持。

第三档是未来实施结果的证据边界，**不是要求本轮需求审查补跑动态验证**。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/1
L1_ENGINEERING=N1：分类器符号名称误写；其余需求范围、owner、复用与阶段边界静态核对通过
L2_USER_VISIBLE=PASS（仅需求保留约束与既有交互来源对账；不是实际画面或行为验收）
L3_UNVERIFIED=整理后的双端视觉；抽取后的交互/失败恢复；真实 Web/Android/native 显示与拓扑行为
SAME_ROOT_SCAN=N1 的五个 API 名称已全核，另四个正确；三个 feature、五处请求、六个系统 notice、十四个 part/二十八个注册、两个 integration 已完成同根核对
DESIGN_GAPS=未发现本轮需求阶段阻断缺口；最终接口、布局扩展与执行证明属于另行授权阶段
EVIDENCE_TIER=只读静态文档与当前源码分析；无测试、构建、运行、设备或视觉证据
```

`GO_WITH_UNVERIFIED_UI` 遵守 review-standard 对非空 L3 的固定格式；其含义是**需求方向可接受，但不声称 UI 已验证**。不授权详设、计划或实施，不需要 Claude handoff。

## 7. 实际读取清单

### 7.1 入口、规则及原始材料

已读：

- [AGENTS.md](/Users/dexter/Documents/workspace/idea/catering-v2s/AGENTS.md)、[PLATFORM-BLUEPRINT.md](/Users/dexter/Documents/workspace/idea/catering-v2s/PLATFORM-BLUEPRINT.md)、[平台 README](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/platform/README.md)、[CLAUDE.md](/Users/dexter/Documents/workspace/idea/catering-v2s/CLAUDE.md)。
- [program registry](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/platform/roadmap-program-registry.json)；选定 [V2S_W0_W4_EXECUTION Roadmap](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md) 的授权字段。
- [scripts README](/Users/dexter/Documents/workspace/idea/catering-v2s/scripts/README.md)、[cs-review](/Users/dexter/Documents/workspace/idea/catering-v2s/.agents/skills/cs-review/SKILL.md)、[review-standard](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/platform/review-standard.md)。
- [独立审查治理](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md)、[验证治理 decision](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/decisions/2026-07-24-v2s-verification-governance.md)。
- [TER coding standard](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/platform/terminal-coding-standard.md)全文；[frontend coding standard](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/platform/frontend-coding-standard.md)适用通则 §3-A–F、§4；[foundation charter](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/platform/foundation-charter.md)全文。
- [四份设计模板目录](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/decisions/templates)：Journey、IA、interaction、implementation-design 四份全文，核对适用性；不将其实施字段强加于本轮。
- [09-14 基础设施需求](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md) §0、§3.3–3.5；[同日前缀详设](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md) §9.6 D-14。
- [09-05 交互设计](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md) §2–6。
- [09-13 壁纸需求](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md)：双端/画布、选择确认、背景、状态失败、placement、主题相关章节。
- memory 适用 sourceRefs：[business corpus adoption](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md)；[TER build order](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md) 的架构、双 UI、拓扑与约束章节；[skeleton requirements](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md) §6.2、§9。
- [本轮输入清单](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/review/platform/2026-09-22-ter-ui-business-readability-requirements-review-inputs-round1-codex.md)全文。
- 最后完整读取：[被审需求稿，264行](/Users/dexter/Documents/workspace/idea/catering-v2s/doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md)。

### 7.2 六维 memory

执行了输入清单指定的六维只读查询。已读 [index](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/index.md)、[deterministic-context-only](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/decisions/deterministic-context-only.md)。

[六个 kernel](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/kernel) 全文：01 workspace/roadmap、02 service/owner、03 transaction/data/dependencies、04 contract/consumer/admin、05 evidence/runtime/git、06 heritage/change。

其余十八个命中原文全部读取：

- [decisions 目录](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/decisions)：`confirmed-business-language-corpus.md`、`http-crud-efficiency-design-redlines.md`、`owner-read-model-and-lifecycle-standard.md`、`terminal-architecture-and-stack-rulings.md`、`terminal-build-order-and-batches.md`。
- [operations 目录](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/operations)：`business-corpus-adoption-and-read-policy.md`、`business-corpus-parked-domain-intake.md`、`terminal-coding-standard.md`。
- [pitfalls 目录](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/pitfalls)：`designing-from-conversation-not-system.md`、`invisible-dimension-drifts-at-implementation.md`、`platform-detail-reverse-inference.md`。
- [practices 目录](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/practices)：`backend-acceptance-route-fixture-oracle-integrity.md`、`collection-boundary-modes.md`、`drawer-form-lifecycle.md`、`frontend-capability-lookup.md`、`ordering-only-for-consumer-facing.md`、`ui-visible-business-language-and-dynamic-aggregate-layout.md`、`detail-drawer-action-menu.md`。
- 另读 [verification-governance memory](/Users/dexter/Documents/workspace/idea/catering-v2s/project-memory/operations/verification-governance.md)。

TER 示例业务未找到可替代专项要求的已确认 corpus 条目；未把 parked 会员领域或后台 Drawer 规则套入本任务。

### 7.3 指定生产来源：独立核数共95个文件

**三个 feature 指定范围共71个文件，全部全文读取：**

- [sample-member-desk](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/feature/sample-member-desk)：README；28个组件；`useMemberDesk`；parts；全部 foundations；commands；actors；index。
- [sample-staff-auth](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/feature/sample-staff-auth)：README；10个组件；`useStaffLogin`、`useAuthNotices`；parts；全部 foundations；commands；actors；index。
- [sample-wallpaper-picker](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/feature/sample-wallpaper-picker)：README；7个组件；`useWallpaperPicker`；parts；全部五个 foundations——assets、errors、systemFailureDismissal、wallpaperPickerTestIds、writePhase；commands；actors；index。

组件全集按职责展开：

- member 九组三文件：CustomerMember、CustomerWelcome、DeskSystemNotice、DiscardConfirm、MemberForm、MemberList、RegistryNotice、WaitingConfirm、WithdrawConfirm；各含无后缀/Laptop/Mobile，另有 MemberRow。
- auth 三组三文件：AuthNotice、AuthSystemNotice、StaffLogin；另有 StaffLoginPasscodeInput。
- wallpaper 两组三文件：WallpaperPicker、WallpaperSystemNotice；另有 WallpaperBackground。

**两个 integration 的 src 全集共16个文件，全部全文读取：**

- [sample-console/src](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/integration/sample-console/src)：moduleName、dependencies、index、application/module、application/terminalSurfaces、assembly/assembly，共6个。
- [sample-wallpaper-console/src](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/integration/sample-wallpaper-console/src)：上述六类，加 WaitingLaptop、WelcomeLaptop、features/actors/actors、parts/parts，共10个。

**八个指定 base owner 文件全部全文读取：**

- [definePart](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/foundations/definePart.ts)
- [dispatchWithRequestId](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/foundations/dispatchWithRequestId.ts)
- [requestOutcome](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/foundations/requestOutcome.ts)
- [useRequest](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/hooks/useRequest.ts)
- [useDispatchCommand](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/hooks/useDispatchCommand.ts)
- [SystemFailureNotice](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx)
- [feature-assembly/index](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/feature-assembly/src/index.ts)
- [consoleAssembly，790行](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx)

补充读取：三个 feature 的 application/module 与 assembly/assembly、auth variables、拓扑的 [evaluateTopologyOperation](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts) 与 [selectTopologyFacts](/Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts)。另搜索核对了公开导出、旧别名消费者及公共 notice 消费；这些搜索命中没有冒充测试执行或测试文件全文阅读。

**最小输入遗漏：无。** 无写入、测试、构建、runtime、device 或 Git 操作；无本轮创建的运行资源需要清理。报告可由主 agent 原样保存并逐条 intake。

