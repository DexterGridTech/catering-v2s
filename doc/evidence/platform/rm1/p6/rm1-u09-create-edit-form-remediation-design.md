---
title: RM1 P6 新建编辑表单详设整改记录
status: TWO_ROUND_SELF_DECIDED_DESIGN_REMEDIATED_WITH_BLOCKING_GAPS
reviewTarget: DESIGN
implementationAuthority: false
---

# P6 新建/编辑表单整改记录

## 1. 业务目标与边界

本整改解决的不是“把表单字段补满”，而是让平台人员和运营人员在真实业务任务中只编辑他们应该改变的
事实，并由事实 owner 在同一命令中重新核验。原始来源为 R5 Journey `D01-S02/S03/S04/S05/S07P`、
`D02-S02/S03/S04`、`D03-S01/S02/S03`、`D04-S01/S02/S11/S12P`，以及 G-01、G-02、G-04、G-06、G-07、
G-08、G-09。

唯一 command 分母以 `rm1-u09-form-command-variant-ledger.md` 为准：24 个 core create/edit variants、11 个
状态/作废确认、20 个已认证 credential/assignment/invitation action variants，以及 1 个 Logo staging
precondition，共 **56** 条。旧 “24/7/2” 是跨 IA 汇总时漏计真实 command 的不一致计数，已废止；公开
invitation enrollment 与 public password-reset completion 是独立 security-flow，已在 ledger `X04..X11`
显式枚举为 `NOT_APPLICABLE_WITH_REASON`，不以管理表单凑数，也不因此被忽略。
本次只修改详细设计与审查标准；不修改 contract、owner、前端、运行环境或 Roadmap。

## 2. 已完成的设计处置

| 审计 finding | 处置 | owning design source |
| --- | --- | --- |
| M1 经营实体错误合并 | 品牌、经营租户、总公司拆成三个 command variant；后两者固定包含法定名称和统一社会信用代码 | IA04 §12.2 |
| M2 合同货号缩成单值 | 改为至少一项、编码唯一的 `{编码,名称}` 动态商品明细 | IA04 §12.3 |
| M3 项目编辑遗漏分期 | 明确 parent 原样回传、分期完整替换、可零项、历史合同只保留快照 | IA04 §12.1 |
| M4 受控扩展字段缺失 | 声明 host definition read、控件映射、revision、未知历史值与冲突恢复 | IA04 §12.4；IA03 §11 |
| M5 合同范围再授权不实 | 删除“已再验”主张，登记 `GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION` 的 workspace-IAM→contract owner 最小 public task input | IA04 §12.3 |
| M6 新字段 key 无来源 | 禁止 UI/浏览器生成 key，登记 owner 生成并回传稳定 key 的 contract GAP | IA03 §11 |
| M7 既有字段 type 被画成可改 | 既有 type/key 固定只读；仅新行可选择 type | IA03 §11 |
| S1 品牌授权伪原子集合 | 改为现有单条 add/remove command 与逐条失败恢复 | IA04 §12.2 |
| S2/S3/S4/S5 字段证据不足 | 通用 variant matrix；角色 status、workspace Logo ref/grant/intent、管理员创建专属事实均逐条落位 | template §1.2.1；IA02 §14；IA03 §11；IA04 §12 |
| R1-M1 command 分母不可复算 | 初版 source-linked 台账曾只覆盖 core/status/本人安全；现以同根 mutation scan 收敛为 C=24、S=11、K=20、P=1，并将 public/retired 反例显式处置 | `rm1-u09-form-command-variant-ledger.md` |
| R1-M2 角色通用更新可改变状态 | 不再把 status 宣称为 latest hidden fact；登记 `GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY`，要求通用 update 去除 status，仅状态 command 接受 target status | IA03 §11；command ledger §2 |
| Dexter：候选搜索不应各自造接口 | 建立 consumer-side candidate-query protocol；统一 wire/lifecycle，保留 owner task read 与授权边界 | template §1.3.1；command ledger §3 |
| R2-S1 业务角色候选没有 query/page | 角色改为 searchable multi-Select 但在 `GAP-INVITATION-ROLE-CANDIDATE-QUERY` 闭合前禁用；要求 workspace-IAM owner task read 返回 query/page/context-token 的 CandidatePage，adapter 只做统一映射 | IA01 §9；command ledger §3 |
| Claude whole-scope S2/N4：只把 create/edit/status/本人改密放进分母 | 以 edge 所有 mutation annotation 为同根搜索面，按 P6 screen/action 重新得到 C=24、S=11、K=20、P=1；平台账号状态、两类凭据重置、两类任职撤销、五目标邀请取消/重发与 Logo staging 均有独立行；平台 invitation retired 和两类 public flow 也显式列为 X 反例 | command ledger §1、§4 |
| Claude whole-scope S2：平台管理员凭据重置被 IA 写成纯确认 | 不把 UI 表述当作 request 真相；controller 的 request 实际包含 `password`。IA03 已按 current contract 收敛为“新登录密码/确认新登录密码”Drawer，并规定秘密清理、latest version/proof 与 owner 重验；不再伪画为链接发放 | command ledger K03；IA03 §11 |

## 3. 诚实保留的 implementation-facing 关闭条件

1. `GAP-WORKSPACE-LOGO-STAGING-DISPOSITION`：asset owner 必须定义未绑定草稿 Logo 的取消/替换处置；
2. `GAP-EXTENSION-OWNER-KEY-DERIVATION`：新增扩展字段的稳定内部身份只能由 owner 生成和回传；
3. `GAP-OPERATIONS-EXTENSION-DEFINITION-READ`：组织/门店各 host type 的 definition task read 必须明确；
4. `GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION`：合同 list/candidates/create/update 必须以 workspace-IAM 的
   public task input 作当前可写项目的最终再验；
5. 已有搜索设计中记录的 `GAP-STORE-*`、`GAP-CONTRACT-TENANT-READBACK` 与平台 overview 筛选 GAP 不因
   本表单整改而关闭。
6. Dexter 已裁定双后台均支持“账号 + 手机号 + 验证码”自助重置。该未认证 public security-flow 不计入
   管理 mutation 分母；其 platform/operations 发起、反枚举、限频、opaque grant、品牌 readback 与 no-session
   边界由 recovery 详设单独关闭，当前 token-bound completion source 不能被误作该新能力的已实现证据。

这些是 contract/owner 设计缺口，不是用户交互可以用隐藏字段、URL、本地列表或默认值规避的问题。

## 4. 更小方案比较

“只把遗漏字段加进当前 Drawer”更快，但仍会把合同的商品数组、项目分期全量替换、三类主体差异及
扩展字段 revision 误当成普通文案，不能保证 owner 命令事实正确。“按当前 request 强迫管理员输入 key”
会泄露技术身份并把稳定性责任错误下放到浏览器。选择字段事实矩阵是最小方案：它不新造业务功能，
但使每个 command variant、immutable fact、动态明细和 owner recheck 可独立审阅。

## 5. 独立审查与两轮后的作者自决

`RM1-P6-FORM-REMEDIATION-20260729` 已完成两轮 `REVIEW_TARGET=DESIGN` 独立对抗审查：round 1 的两项 M
由 command ledger 与角色状态 GAP 处置；round 2 的 S1 由 `GAP-INVITATION-ROLE-CANDIDATE-QUERY` 处置。
作者重新打开 `OperationsWorkspaceInvitationCandidateController`、其 OpenAPI candidate page 和 IA01 后确认：
当前角色 readback 确无 `queryText/page/pageSize`，且一次性映射 roles；故不把它写成已拥有搜索能力。

`ROUND_FINAL_DECISION=SELF_DECIDED`：不再开第三轮。当前设计修复可以作为**诚实的详细设计**交 Dexter
确认，但不是 implementation-facing GO。必须先闭合角色候选 query、角色 generic update status、Logo staging、
extension key/definition、门店级联、合同租户与 project-scope 等列明 GAP，再另建后续批准范围的 review cycle。
