---
title: RM1 P6 整包交互详设整改后独立复审（Claude，round-2）
reviewTarget: DESIGN
scope: RM1-P6 current bytes（IA-01…IA-05、P6 预备稿、form/action ledger）
verdict: GO
findings: M=0 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态交互详设复审；不授权 implementation、contract/owner 改动、codegen、动态运行、seed/reset、Roadmap 状态变更或任何仓库控制操作
createdAt: 2026-07-29
---

# RM1 P6 整包交互详设整改后独立复审（round-2）

## 0. 结论

**GO**，`M=0 / S=1 / N=3`。

上一轮 `M=1 / S=4 / N=4` **九条全部真实关闭**，且关闭方式比我建议的更完整——
M1 不是把入口改回去了事，而是按 Dexter 的产品裁决把两个 face 的自助恢复**同时**画完，
并把安全不变量（反枚举、限频、owner-bound flow、一次性 grant、成功后作废会话）写进了 GAP 本身。

| 上一轮 finding | 关闭情况 |
| --- | --- |
| **M1** IA05 发明"登录页忘记密码"、owner 侧无签发路径、未登记 GAP | **已闭合**：Dexter 已裁决该产品能力；IA-01 补 `IA01-PLATFORM-RECOVERY-VERIFY/PASSWORD/COMPLETE` 三屏，IA-05 改为"登录名+手机号+验证码"；`GAP-PLATFORM-SELF-SERVICE-RESET`、`GAP-OPERATIONS-SELF-SERVICE-RESET-ENTRY` 双双登记；旧管理员链**显式 retain** 且明确"不再充当登录页入口" |
| **S1** 公开恢复三屏未适用公开页品牌强制标准 | **已闭合**：IA05 三屏 `USER_VISIBLE_COPY` 改为 `<集团空间 LOGO> <集团空间名称>` + `<运营管理后台标题>` + 动态 `找回<运营管理后台标题>密码`；`GAP-PUBLIC-RESET-BRANDING-READBACK` 已登记 |
| **S2** 表单/确认分母缺整类凭据恢复与任职撤销 | **已闭合**：新增 `K01..K20`（20 条）与 `P01`；`S11` 补入空间账号启停；IA-05 补 `§8.2` 局部矩阵 |
| **S3** 三份 IA 无 ownership roster、IA-02 两个 Shell 跨面 | **已闭合**：IA-01 13、IA-02 15、IA-03 24、IA-04 25、IA-05 17（9 行含两组 ×5），逐一复核与 `### Screen:` 计数一致；两个 Shell 已入 roster，并把任职 Select、可查看范围、用户菜单显式标为 **sibling 插槽并注明 owner screen** |
| **S4** 同一控件三套文案 | **已闭合**：`§13` 三行改为"可用任职"/"当前任职"/"可查看范围"，与 `§4` 的 `USER_VISIBLE_COPY` 逐字一致；"运营角色""数据范围"式旧词在这三处归零 |
| **N1** 章节号重复 | **已闭合**：五份 IA `grep -o "^## [0-9]*\." | uniq -d` 全空 |
| **N2** 三处 §5 空标题 | **已闭合**：IA-03 30 行、IA-04 31 行、IA-05 4 行实质内容 |
| **N3** 邀请列表行尾 `[查看详情]` | **已闭合**：改为"列表业务标识链接'邀请手机号'" |
| **N4** ledger 缺退役/前置 mutation 处置 | **已闭合**：`X01–X03` 记 `RETIRED_BY_R5_CURRENT_P6_SCOPE`，`P01` 记 Logo staging |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。
本轮未开 form-remediation 第三轮，未改写其 round-2。

**授权边界**：仅静态交互详设复审。GO 只表示可交 Dexter 看图并起草 final
implementation-facing design；**不**授权 implementation、contract/owner 改动、codegen、
动态运行、seed/reset、Roadmap 状态变更或任何仓库控制操作。

---

## 1. 自助重置：本会话独立复核 —— `CONFIRMED`

Dexter 点名的三件事逐条重开源码核验：

**① 两后台"账号+手机号+验证码"用户任务**

`IA01-PLATFORM-RECOVERY-VERIFY`（`ia-01…md:144-175`）与
`IA05-RECOVERY-VERIFY`（`ia-05…md:112-136`）都是"登录名 + 手机号 + 验证码 → 设置新密码 → 完成"，
统一提示"如果信息匹配，验证码将发送到该手机号"，并在 `TECHNICAL_BOUNDARY` 明写
"账号是否存在、账号与手机号是否匹配……不显示"。**反枚举做对了**。

安全不变量两稿一致且写在 GAP 里（`ia-01…md:226-230`、`ia-05…md:394-398`）：
start/send 对不存在/停用/不匹配返回同一提示；按 face、规范化账号、手机号与 **HMAC 化来源**限频；
verify/complete 在**同一 owner 事务**内重验账号、手机号、OTP、flow、账号状态、过期与一次性使用；
成功后作废该账号全部有效 session。前端只做格式、冷却与秘密清理。
`FOUNDATION_PRIMITIVE=testId` 且 `HERITAGE_COUNTERPART` 分别为
`NOT_CARRIED_WITH_REASON`（platform，当前无公开恢复协议）与 `PARTIAL_COUNTERPART`（operations）——
**没有把新能力伪装成 carry-over**。

**② 运营端品牌与集团空间上下文**

`ia-05…md:117` 明写"路由已经携带所属集团空间上下文，不额外填写集团空间"；
三屏品牌区来自 owner-approved readback，`TECHNICAL_BOUNDARY` 禁止从 URL / `resetGenerationKey` /
asset ref 推导。这与 IA-01 公开邀请页的处理一致。
`GAP-PUBLIC-RESET-BRANDING-READBACK`（`ia-05…md:380-386`）如实指出**两处**当前缺口：
public reset operation 无集团空间展示 readback，且 operations login-entry 的 LOGO 仍只有 ref /
controller 固定返回 null。

**③ 旧管理员签发链的保留边界**

本会话复核：`WorkspacePasswordResetService#request:37-48` 仍是 `generationKey` 的**唯一**签发者，
其**唯一**调用点仍是 `PlatformWorkspaceAccountController:41 requestCredentialReset`（已认证运维管理员）。
`ia-01…md:219-225` 与 `ia-05…md:387-392` 都写明：该链 **retain** 供空间账号治理，
"替换其作为登录页入口的角色，但不替换该管理链"；ledger `X09–X11` 进一步禁止
"把旧 token completion path 误记为管理员凭据重置或以它假称新入口已存在"。**边界划得准确。**

**④ 上一轮 8 条 GAP 全部仍在，未被整改顺手抹掉**

本会话逐条重开 owner 源码复算，结论与 round-1 完全一致：
`WorkspaceRoleService:66` 的 generic update 仍直写 `status=?`（`GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY` 有效）；
`PlatformOrganizationOverviewController:19`、`PlatformContractOverviewController:22`、
`OperationsStoreManagementController:49/:59`、`WorkspaceUserService#pageForOperations:106`
仍不接筛选参数；`OperationsContractController:48` 的 `record WorkspaceSession(UUID workspaceUuid)`
仍丢弃 assignment/visibleDataNode。**没有一条 GAP 被降级、改写或悄悄删除。**

**⑤ 一处 IA-03 的自我纠正值得记名**

`PlatformAdminGovernanceController:51` 的 `resetCredential` **确实**接收 `body.password()`。
IA-03 上一轮写的"不输入目标密码"与 contract 不符，本轮已改为按 current contract 画成
秘密输入 Drawer（roster `IA03-ADMIN-CREDENTIAL` 行"目标账号、新密码/确认密码"），
ledger `K03` 同步记录。**这是作者自己回读 contract 发现并改正的，不是我提出的。**

---

## 2. S1 ｜action ledger 的三处分母不自洽 —— `CONFIRMED`

**owning source**：`doc/evidence/platform/rm1/p6/rm1-u09-form-command-variant-ledger.md`
`:12`（"以下是唯一 command 分母"）、`:20-23`（`24+11+20+1=56`）、
`:97-98`（"`K06..K20` 必须按五个固定 target 独立保留，不得退化"）、
`:146-147`（"C/S/K/P 的 56 条在 scope variant 与 source controller 间**一一映射**"）、
`:155-157`（"`X01..X11` 已被枚举而非忽略"）。

**本会话同根全量扫描**：`app/edge/**` 下 `@Post/@Patch/@Put/@Delete Mapping` 共 **78** 条。

### (a) 8 条既不在 56 内、也不在 X01–X11 内

| 未列 endpoint | 是否被 IA 画成用户提交 |
| --- | --- |
| `OperationsCatalogAuthenticationController#selectContext`（`POST /session/context`） | **是**：`IA02-OPERATIONS-SHELL-HEADER` 与 `IA02-OPERATIONS-INITIAL-ROLE-SELECTION` 的提交 |
| `OperationsCatalogAuthenticationController#selectDataNode`（`POST /session/data-node`） | **是**：`IA02-OPERATIONS-DATA-SCOPE` 的最终层级提交 |
| `OperationsCatalogAuthenticationController#{login, sendOtp, verifyOtp, logout}` | 登录/OTP 由 `IA01-OPERATIONS-LOGIN` 画出；logout 由 IA02 Shell 用户菜单画出 |
| `PlatformAuthenticationController#{login, logout}` | 由 `IA01-PLATFORM-LOGIN`、IA02 Shell 用户菜单画出 |

**反例最干净的一条**：`selectContext`（`:39`）、`selectDataNode`（`:40`）、`changePassword`（`:41`）
是**同一 controller 的相邻三行**，签名同构——都带 `@RequestHeader("Idempotency-Key")` 与
`requiredVersion(...)`。第三条被计为 `K02`，前两条既不计也不排除。
而 IA-02 `§5:542` 恰恰为 data scope 写明了 "Idempotency-Key + requiredContextVersion" 这组 hidden facts。

### (b) `C01` 折叠 5 条 endpoint，而 ledger 自己禁止对同一五 target 家族这样做

`OperationsWorkspaceInvitationController` 有 `groupCreate/regionCreate/projectCreate/headCompanyCreate/storeCreate`
**5 条** create endpoint，`C01` 用通配 `OperationsWorkspaceInvitation*Controller` 记为 **1 行**；
同一控制器的 cancel/reissue 却按五 target 拆成 `K11–K20` **10 行**，
`K06–K10` 五条 revoke 也各占一行。`:97-98` 明文要求"独立保留，不得退化成……当前节点类型"——
**同一家族、同一理由，create 与 cancel/reissue 处置相反。**

### (c) "一一映射"声明为假

`S04`（大区启停）与 `S05`（项目启停）都指向 `OperationsOrganizationHierarchyController#transitionStatus`
的**同一条** `POST /{nodeId}/status`：2 行 ↔ 1 endpoint。
结果是 56 行实际覆盖 **59** 条 endpoint（C 24 行↔28、S 11 行↔10、K 20↔20、P 1↔1），
`59 + 11(X) = 70 ≠ 78`。

**适用边界**：这**不是**说交互设计错了。上述被漏的 screen 在 IA-01/IA-02 里都已画出并声明了
hidden facts；错的是把自己声明为"唯一/一一映射/已枚举而非忽略"的**审计台账**。
也不是说 login/logout 必须计入 `C/S/K`——完全可以放进 `X12…`，但必须**显式排除**，
这正是 `X01–X11` 已经建立的正确做法。

**为什么现在只是 S 而不是 M**：`STATUS=DESIGN_REPAIR_DRAFT`，且 56 这个数字要到 final
implementation-facing design 才被冻结为 package-exit denominator（P6 `§7` step 3）。
它不影响 Dexter 看图。**但在 56 被当作 exit 分母使用之前必须闭合。**

**最小修法**：① 把 8 条按同一体例记为 `X12–X19`（session/auth security-flow），
其中 `session/context`、`session/data-node` 若判定为已认证提交，应改记入 `K` 而非排除；
② `C01` 拆为五 target 五行（`C01a–e`），或把 `K11–K20` 的拆分规则改写成对全家族一致的显式规则；
③ 把 `S04/S05` 标注为"同一 endpoint 的两个业务 surface"（`C12` 已用过这个正确写法），
并把 `§4` 的"一一映射"改为"行 ↔ endpoint 的显式多对多对照"。**不新增任何产品功能。**

---

## 3. N（观察项，不阻塞）

**N1 ｜roster 用 `REVISE` 表达"等 contract GAP"，而模板定义 `REVISE` = 不得交 Dexter 看图**

六行受影响：`ia-01…md:553-555`（三个 platform recovery 屏）、
`ia-05…md:414-416`（三个 operations recovery 屏），均写
`REVISE：等待 GAP-… owner/contract 闭环`。
但模板 `:81-86` 定义 `REVISE` 的含义是"任一元素的 surface owner 不是当前 screen，
或任何 `USER_VISIBLE_COPY` 没有实际呈现位置"，且**"不得交 Dexter 看图"**；
`REVISE_PENDING_DEXTER` 则专指"冲突候选等待 Dexter 裁决"（此处 Dexter 已裁决，也不适用）。

**根因在模板，不在 IA**：三个允许状态里没有"ownership 干净、但 contract GAP 阻断实施"这一格，
作者只能挑最不坏的一个再加注。当前后果是——包体状态是
`PREPARED_FOR_DEXTER_INTERACTION_ACCEPTANCE`、正在请求看图，却有六行自称"不得交 Dexter 看图"。

建议在模板增第四个状态（例如 `PASS_BLOCKED_BY_GAP:<gap-id>`），
这六行改判 `PASS_BLOCKED_BY_GAP`，GAP 仍在各自 `§8.1`/`§自助恢复边界` 单独追踪。

**N2 ｜平台公开恢复未在 22 surface 台账里获得与运营恢复对等的位置**

`contracts/policy/frontend-asset-carryover-manifest.json` 当前 `surfaces` = **22**（本会话复算）。
P6 `§10` 台账里，运营公开恢复是**独立的第 13 项** `PUBLIC-ACCESS-RECOVERY`，
而新增的平台公开恢复三屏被并进第 1 项 `PLATFORM-AUTH`（`:268`）。
两条是同一产品能力在两个 face 上的平行实现，**surface 粒度却不对称**。

`§5` 的 `D5` 断言"22 surfaces and 25 keys **each** have exact CARRY/ADAPT/NOT_CARRIED reason"——
按当前分法，平台公开恢复没有自己的 surface 级 disposition。
P6 `§7` step 3 本就要求 re-freeze manifest，请在该步一次性裁定：
`PLATFORM-AUTH` 吸收（并写明理由与不对称的正当性），或登记第 23 个 surface。
manifest 是权威，本稿不改它是正确的。

**N3 ｜六个公开恢复屏未声明路由**

模板 `:41` 的 `HOST_AND_ENTRY=<**路由**、宿主页面/壳层位置、打开控件和进入条件>`，路由列第一。
`ia-01…md:147` 只写"IA01-PLATFORM-LOGIN 的'忘记密码'"；
`ia-05…md:117` 只写"已品牌化运营登录页'忘记密码'；路由已经携带所属集团空间上下文"——
**没有给出路由本身**。对比同稿已给出的
`/platform/login`、`/operations/{集团空间编码}/login`、
`/operations/invitations/{集团空间编码}/{邀请令牌}`，这六屏是唯一空缺。

运营侧尤其要紧：整页的品牌与 owner scoping 都依赖那个 workspace locator，
路由形状本身就是需要 Dexter 看图确认的事实（是否沿用 `/operations/{集团空间编码}/…`）。
补一行即可，不改交互。

---

## 4. 处置

`M=0 / S=1 / N=3` → **GO**（仅限静态交互详设与 Dexter 看图接受）。

- **S1 与 N1–N3 全部在既有批准边界内**，可直接交 Codex 自主修复：补排除项、拆/标注分母行、
  加一个 roster 状态、补六条路由、在 re-freeze 时裁定 surface 粒度。**无一需要 Dexter 产品裁决，
  无一需要改代码或 contract。**
- **S1 必须在 `56` 被写成 package-exit denominator 之前闭合**；在此之前它不阻塞看图。
- 本稿列出的全部 `GAP-*` 仍是 implementation-facing design 的阻断条件，本 GO 不解除任何一条。

**本复核不授权**：implementation、contract/owner 改动、codegen、动态运行、seed/reset、
Roadmap 状态变更、任何仓库控制操作。
