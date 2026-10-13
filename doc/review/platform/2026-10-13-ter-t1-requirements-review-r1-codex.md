# TER T1 正式需求 · R1 fresh 独立对抗审查

REVIEW_CYCLE_ID=TER_T1_REQUIREMENTS_20261013
REVIEW_TARGET=DESIGN
DOCUMENT_KIND=FORMAL_REQUIREMENTS
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-13-ter-t1-requirements-review-r1-inputs-codex.md
reviewedObject=doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md
reviewedObjectSha256=b6c2cb34bbe220938d2cf4bb744b336885042f9f98e94ff697662e2babe56023
reviewerContext=FRESH_V2S_ROOTED_READ_ONLY
blindReviewDeclaration=先读取讨论稿原话/裁决，再独立评审正式需求与 owning source形成 findings/verdict；此后才读取讨论稿剩余作者分析与盘点附件。
authorMaterialReadAfterIndependentVerdict=true

## 1. 结论

NO-GO，0M/1S/0N。

本结论只判断正式需求可接受性，不判断当前代码已符合 T1，不授权详设定稿、实施、生成、编译、测试、Web/Android、DEV、数据操作或部署。

唯一确认的问题是 V-15 对根 reset 的凭证预期存在冲突。可在需求中直接澄清，无需新增机制或更改生产代码。

## 2. 方案合理性

真实任务是降低未来维护者理解包职责、声明、状态和外部依赖的成本，消除 App 补登记与多真相。正式稿没有把任务缩为搬 actors.ts，也没有因搬包成本保留旧结构，符合 Dexter 原始方向。

独立构造的替代方案：

| 方案 | 结果 | 判断 |
|---|---|---|
| 仅拆 actors/slices/selectors 文件，保留 assembly 白名单和 TDC 全业务 client | 文件易找，但维护者仍必须跨包补名单；业务 API 归属不变 | 不满足原始问题 |
| 将所有声明、API、sync 和 UI 贡献收进全局 registry/万能 DSL | 能减少部分 App 接线，但引入第二事实与初始化机制，隐藏包边界 | 复杂度与收益不匹配 |
| 各能力包自持静态声明/行为/私有 API，复用 Runtime/State/transport，装配选择包与真实外部输入 | 消除第二名单，保留唯一 owner 和已有机制；具体类型/认证接缝留详设决定 | 正式稿方向合理 |

declarations、静态 ParameterDefinition、可变地址集合、包内 API 私有化及 transport owner 保留均有本轮明确输入。要求详设核对 operation/身份/生命周期，不在正式需求阶段钉死统一 factory 或认证 API shape，是合理的阶段边界。

UI_INTERACTION_APPLICABILITY=NOT_APPLICABLE_TO_NEW_UI_DESIGN。本稿没有新页面或可见操作；既有 Journey 行为保持和错误消费正确性仍是后续实施义务，不能因此免做未来回归。

## 3. 动作 1-B：事实提取

| 提取项 | 事实 | 需求阶段处置 |
|---|---|---|
| 模板缺项 | 未交付 T1 IA、线框、CP 计划、逐 operation 详设/seed 执行表 | 当前是正式需求，这些不是当前缺陷；R-16/17 约束后续阶段 |
| 目录矛盾 | 现行 terminal §7.1 不含 declarations，正式稿采用 declarations | R-03/R-15 明确未来同步规范/检查器，属明确目标变化，不是偷偷绕规则 |
| 生成分配矛盾 | 当前 generator 每 operation 恰一次 assignment；R-07 允许确有多消费包时各自私有生成 | R-14/R-16 明确更新现有生成链并逐 operation设计，不要求当前生成器已经支持 |
| 实现形状未定 | UI contributions、认证执行、初始化顺序、持久身份与 W/D 面留详设 | §7.2 明确设计义务；未强制新增 registry/第二 engine |
| 数值来源 | 39 功能包/40含聚合包是快照；1/2/10 是合法可变集合例；DEV 两入口是环境事实 | 没有冻结未来包数或重设地址上限 |
| 验收矛盾 | V-15 把根 reset 与“不丢task/credential”放同一预期 | S-1；必须澄清合法保持与明确清除动作 |

## 4. Finding

### S-1 · V-15 将必须清凭证的根 reset 写成“不丢 credential”

状态：CONFIRMED（正式需求验收歧义/冲突，不是本轮发现的生产实现 bug）。

严重度：S。需要修正正式验收预期；否则后续可以为满足该行错误地保留已取消的凭证，或让正确的根 reset 无法通过需求验收。

需求位置：

- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md:223，V-15。
- 同文件:129，R-09 要求根级 reset 例外保持既有判据。
- 同文件:159，R-12 禁止重构时静默丢凭证/任务。

仓内事实：

1. V-15 的动作同时列“重构前已有凭证/业务数据/更新任务重启，角色切换及根reset”，统一预期为“事实读取、persist/sync/reset既有边界保持；不丢task/credential”。
2. doc/platform/terminal-coding-standard.md:365–374 明确：根 reset 默认清各 owner；只有 server-config 与 terminal-update 的持久 descriptor 有 retain 例外；TDC 凭证照常清除。
3. 同规范:1037 明确普通断线保凭证，但明确解绑/换主先由 TDC command 清除并成功 flush；此裁决不扩大 TR-09 retain 例外。
4. apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:259–260，通过 requestApplicationReset('TERMINAL_ACTIVATION_CANCELLED') 发起生产根 reset；取消激活成功:1973–1976、离线取消:1978–1985 使用该路径。
5. apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts:18–21 初始 credential=null；:333–349 的 registration 持久化 credential，未声明 retain。
6. apps/terminal/kernel/base/state/src/foundations/defineStateRuntimeSlice.ts:188、198 默认 resetIntent='clear'。
7. apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:437–479 先 flush，再删除非 retain namespace 键，成功后才 dispatchReset。
8. apps/terminal/kernel/base/state/src/foundations/createStateStore.ts:39–50 让非 retain owner 回初值。

推论与适用边界：

- “根 reset 保持既有边界”与“根 reset 不丢 credential”不能同时作为该行无条件 oracle。
- 这不是要求所有重启/角色动作都清凭证。合法恢复、普通断线和正常投影应保持；明确取消/解绑/换主则按现行 owner 规则清除。
- 最强反向解读是把“不丢”理解为“不意外丢”。R-12 的“静默”支持这种本意，但 V-15 未写该限定，且主动把根 reset 列入动作；验收表应直接说清，不能靠实施方选择解读。
- 不需要修改规范、增加凭证兼容层、重写 reset 或新增运行阶段。

最小需求修正：

只改 V-15 的期望，例如：

“合法重启恢复及普通断线不意外丢失应保留的事实；取消激活根 reset 清除 TDC 凭证及其余非 retain 状态，server-config 与 terminal-update 只按现行持久 descriptor retain；明确解绑/换主按既有 TDC command＋flush 规则清除凭证。不出现第二 boot/state。”

详设再把这些不同动作分别绑定到已有 owner oracle。比“删掉根reset场景”更小且完整：保留真实重要回归，仅澄清预期；比“全部保凭证”正确，因为后者改变明确产品规则。

需否 Dexter 裁决：否。按现行已接受规则澄清即可；如果作者实际希望取消/解绑后继续保留凭证，则属于新增产品差异，才须 Dexter 裁决。

通用失败模式与最小防再犯：

把“结构重构不得意外丢数据”写成覆盖所有生命周期动作的“不丢数据”，会误伤本就要求清除的注销/reset/解绑。审查本问题族时，逐动作分别确认“恢复/保留/明确清除”，不能用统一保真口号作为全部场景 oracle。落点为本 finding 的需求修订及后续详设场景 checklist；无需新增机器门。

## 5. 同根扫描

在正式稿全文搜索 reset、retain、credential、凭证、任务、不丢，展开所有相关条款：

| 条目 | 判断 |
|---|---|
| R-01（47–49） | 保留 owner/现有业务语义，无新 retain 规则 |
| R-03（69） | slice 的 persist/sync/reset 关联要求，无强制保存全部字段 |
| R-04（77） | 单一资源/任务事实，未改变清除动作 |
| R-07（111–113） | 唯一 credential owner、不复制凭证，不允许副机连 TDS |
| R-09（127–131） | 明确保留 root reset 既有判据，正确 |
| R-12（159） | 限制“因文件移动/重构而静默清除”，适用原因明确，无需连带改变 |
| R-13（163） | 盘点 persist/sync/reset 采用，没有新语义 |
| R-17（197） | 无 reset/seed 隐含授权 |
| V-08（216） | 证明无复制凭证/连接，正确 |
| V-15（223） | 确认冲突位置 |

其余 9 个相关条目已核对；未发现另一处无条件要求根 reset 保留凭证。

## 6. 主要证伪攻击与结果

| 攻击 | 结果 |
|---|---|
| API 私有化是否改变 transport owner | 未成立；R-01/07/§0.2 保留 owner，真实 transport moduleKind=owner |
| 各包请求是否需要复制 credential/连接 | 未成立；R-07 明确唯一 credential、共享认证/transport与单连接；最小类型属于详设义务 |
| 当前生成器不支持重复 assignment，需求是否不可实施 | 未成立；已有多 target 接缝，R-14/16 明确同步生成器；不要求冻结当前错误限制 |
| module 自闭环是否成为 workspace 自动扫描/万能 registry | 未成立；R-08 显式只消费已加载 modules并禁止超级 registry |
| sync 自动资格是否误替业务 readiness | 未成立；R-09 单独保留 required projections与遮罩/admin恢复 |
| 可变 URL 是否扩大 DEV 部署或取消 URL/identity 校验 | 未成立；R-11 保留两受管入口与合法性/loopback/manifest边界 |
| 静态 parameters 是否恢复动态 catalog | 未成立；R-06明确排除动态 store/catalog/UI/远端覆盖 |
| 每个 actor 文件是否变成一 handler一 actor/第二资源 owner | 未成立；R-03/04 明确责任、共享资源和不机械拆分 |
| 非新 UI 是否被当成免回归 | 未成立；R-16/17/V-16/17保留未来影响面行为 proof |
| 保真验收是否覆盖本就需要清除的动作 | 成立；S-1 |

## 7. 后读作者材料的差异说明

独立初判产生后，读取讨论稿其余全文和 inventory 的元数据/40包导航。

- 作者分析也区分“sync 资格全集”与“业务 required projections”，与独立源码读取一致。
- 作者指出 generated API 当前集中于 TDC，而非 transport，与当前 policy/index/actor一致。
- 作者提出复用既有生成器并核对其分配约束，不能据此要求需求阶段定认证 factory 形状。
- 作者未给出根 reset 保留 TDC credential 的新裁决；没有材料反驳 S-1。
- inventory 明示不是逐分支语义审计，本轮未把它升级为完整源码证明。
- 独立结论维持 NO-GO / 0M/1S/0N。

## 8. 未验证与证据档位

| 档位 | 当前状态 | 能证明什么 |
|---|---|---|
| 静态原文/源码 | PERFORMED | 需求可追溯、owner/生成/注册/配置接缝可设计，以及 S-1 预期冲突 |
| 测试证明 | NOT_RUN | 本轮没有运行断言结果 |
| Web/Android/DEV/L2/UAT | NOT_RUN | 不证明现有画面、业务闭环或设备行为 |
| cleanup | NOT_APPLICABLE_NO_RESOURCE_STARTED | 本轮未启动资源，不伪造 cleanup PASS |

L3_UNVERIFIED 只用于当前被审 UI 的未验证可见事实。本轮没有新增 UI artifact，因此本轮 L3为空；未来业务保真的 W/D NOT_RUN 记录在本节，不冒充当前 UI finding，也不因此强制把静态需求 verdict写成 GO_WITH_UNVERIFIED_UI。

## 9. 固定结论块

REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=findings:S-1（验收预期与当前owner/reset判据冲突）
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:本轮正式需求不新增页面或交互；既有UI保真留未来实施proof
L3_UNVERIFIED=空
SAME_ROOT_SCAN=S-1的10项reset/credential需求条目已逐项核对；其余9项无同类冲突
DESIGN_GAPS=无新判据缺口；module contributions/认证接缝/operation分配/验证面为R-16及§7.2明确的后续详设义务
TEMPLATE_COVERAGE=四份模板已逐节记录，有/N/A及理由见reviewerInputChecklist §9；未把缺详设或当前运行当需求缺陷
EVIDENCE_TIER=STATIC_ORIGINAL_REQUIREMENT_AND_OWNING_SOURCE_REVIEW_ONLY

## 10. 收口与授权

当前 R1 只读审查已完成，报告交主 agent 辩证 intake。建议仅澄清 V-15 后，在同一 cycle 的 R2 由新的 fresh reviewer核验修订；不重置 cycle，不开启实施。严重度接受度与任何新的产品差异仍归 Dexter。
