---
title: RM1 P6 静态交互详设整改后独立复审（Claude）
reviewTarget: DESIGN
scope: RM1-P6 current bytes（IA-01…IA-05、P6 预备稿 §8.1、模板 §1.1、action ledger、round-2 intake 与 problem-family）
verdict: GO
findings: M=0 / S=0 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅评审 P6 当前静态交互详设与证据整改；不授权 implementation、契约/owner/codegen 变更、DEV/动态运行、seed/reset、Roadmap 状态变更或历史 review 改写
createdAt: 2026-07-29
---

# RM1 P6 静态交互详设整改后独立复审

## 0. 结论

**GO**，`M=0 / S=0 / N=3`。

两份历史 review 的全部 open finding **真实关闭**，且关闭方式经得起独立复算：
`extension/recovery` 的 `M1 / S1 / S2 / S3 / S4 / N1` 六条、`whole-scope round-2` 的 `S1` 一条，
共七条，逐条在 current bytes 上验证。四项 Dexter 裁决**全部按原文落地，无一处被放大或缩小**。

**没有把静态详设误写成已实现事实**：全仓 17 个 `GAP-*` 全部保留为 implementation-facing 关闭条件；
`§8.1` OTP amendment 明写"当前 package 不修改上述实现、契约、codegen、动态环境或测试"；
`git status` 对 `apps/backend` 与 `contracts/openapi` 无输出——**整改是纯文档的，未触碰生产源码或契约**。

**本轮不改写历史 verdict**：round-2 的 `GO` 与 extension/recovery 的 `NO-GO` 原样保留，
本文件只对 current bytes 作独立判断。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。

---

## 1. 五项重点的独立核验

### 1.1 K04、X09–X11、K=20 与 56 分母 —— `CONFIRMED`

`rm1-u09-form-command-variant-ledger.md` current bytes：`K01..K20` 完整，
`K04 = PlatformWorkspaceAccountController#requestCredentialReset` 原样在列；
`X09–X11` 仍标 `NOT_APPLICABLE_WITH_REASON` 且保留"不得把旧 token completion path
误记为管理员凭据重置"的边界；`§4` 末句显式声明"K04、X09–X11 与总数 56 均按 Dexter 裁决 retain"。
**没有出现任何退役表述**——上一轮我写的 `§1`（下线落地输入）整节已按裁决作废，未被误执行。

**多对多映射与排除边界，本会话独立复算**：

`app/edge/**` 的 `@Post/@Patch/@Put/@Delete Mapping` 本会话实测 **78** 条，与台账一致。

- `C` = 24 行 → **28** endpoint：`C01` 显式展开为
  `{groupCreate,regionCreate,projectCreate,headCompanyCreate,storeCreate}` 五条，23×1 + 5 = 28 ✓
- `S` = 11 行 → **10** endpoint：`S04/S05` 明写共用 `OperationsOrganizationHierarchyController#transitionStatus`
  的同一条 `/{nodeId}/status`，9×1 + 1 = 10 ✓
- `K` = 20 行 → 20，`P` = 1 行 → 1；合计 **59** ✓
- 排除 `X01..X19` = 3+5+3+3+1+1+1+2 = **19** ✓；**59 + 19 = 78** ✓

上一轮 `S1` 点名的 8 条未归类端点，**全部补齐且分类准确**：
`X12–X14`（operations passwordLogin/sendOtp/verifyOtp）、`X15`（selectContext）、
`X16`（selectDataNode）、`X17`（operations logout）、`X18–X19`（platform login/logout）。
`X15/X16` 的理由写得对——"已认证工作上下文提交，但只选择本次任职/可查看范围，
不修改业务实体、凭据、任职或邀请事实"，并且**承认 IA02 已画其 surface**，不是拿"没画"搪塞。
`§4` 也把原先那句"一一映射"改成了"显式多对多对照，不宣称一一映射"。

### 1.2 十条 extension revision 路径的描述准确性 —— `CONFIRMED`

**本会话独立解析 contract**（对 10 个 request schema 逐个展开，含 `allOf` 继承）：

| request | revision 字段 | extensionValues |
| --- | --- | --- |
| Brand / Tenant / HeadCompany **Create** | `expectedExtensionRuleRevision` | 有 |
| Brand / Tenant / HeadCompany **Update** | 经 `allOf` 继承同名字段 | 经 `allOf` 继承 |
| Store **Create** | **无** | 有 |
| Store **Update** | `extensionRuleRevision` | 有 |
| Contract **Create / Update** | `expectedExtensionRuleRevision` | 有 |

即 **9/10 携带 revision，唯一例外是 `OrganizationStoreCreateRequest`**——
与 IA-04 `§12.4` 的表述完全一致。该节明写"当前门店 create 缺 request revision
却被 edge 硬编码 `0L` 的反例属于此同一问题族，**不得反向给 request 增 revision**"，
`intake.md:18` 的反例栏同样点名。**方向正确，没有出现我上一版被撤回的那条错误建议。**

`GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL` 的范围界定也准确：移除 10 条请求、
edge 传递与 owner create/update CAS，**保留** owner 每次以提交瞬间 current definition
无条件校验 key/必填/类型/选项，并把 revision 降为 owner readback 留痕；
实体自身 `expectedVersion`、关系、授权与 idempotency 复核不受影响。
这正是"去掉 CAS 不等于去掉校验"的正确切分。

> **披露一处我自己的核验失误**：我首次用扁平 `properties` 解析 schema，得出
> "Brand/Tenant/HeadCompany Update 既无 revision 也无 extensionValues"，一度准备据此报一条新 finding。
> 复查发现三者都是 `allOf: [<XxxCreateRequest>, {expectedVersion, expectedContextVersion}]`，
> 字段由继承而来，controller 的 `body.expectedExtensionRuleRevision()` 调用可编译即为佐证。
> **是我的解析错误，不是缺陷**，已在报告前更正。记录以免后续会话重蹈。

### 1.3 12 个动态字段 screen 的三处槽位声明 —— `CONFIRMED`

逐屏抽取核对，**12/12 在 `USER_VISIBLE_COPY`、低保真线框、surface ownership roster 三处齐备**：

- 写面 6：`IA04-BUSINESS-CREATE/EDIT`、`IA04-STORE-CREATE/EDIT`、`IA04-CONTRACT-CREATE/EDIT`
- 读面 6：`IA04-BUSINESS-DETAIL`、`IA04-STORE-DETAIL`、`IA04-CONTRACT-DETAIL`、
  `IA04-STORE-PROFILE`、`IA03-ORG-DETAIL`、`IA03-CONTRACT-DETAIL`

线框内实测均含"当前启用的定义字段（按顺序直接插入／直接显示，**无分组标题**）"一行；
roster 槽位行计数 IA-03 = 2、IA-04 = 10，合计 12 ✓。

**"经营资料 / 补充资料"作为用户可见分组已全仓归零**：全仓仅存三处提及，且**全部是禁止性表述**——
IA-04 `:763`（"Dexter 已裁定：业务上不存在……"）、模板 `:103`（"业务上不画'经营资料''补充资料'……"）、
intake 的裁决转述。上一轮 `S2` 的方向错误（我原本建议"给补充资料安排位置"）已被正确改判为"删分组"。

`§12.4` 还多做了一件对的事：**未知或已停用的 key/value 由 owner 保留，但因没有可用业务标签，
不另造"历史资料"用户可见分组**——这既守住了不丢数据，又没有为此发明一个违反"无感"的分组。

`S1`（假 GAP）已闭合：`GAP-OPERATIONS-EXTENSION-DEFINITION-READ` 从 IA-04 删除，
改为直接列出三个真实 operationId（`getOperationsOrganizationStoreExtensionDefinition`、
`getOperationsOrganizationBusinessEntityExtensionDefinition`、`getOperationsContractExtensionDefinition`）
并声明"definition 读取不是 GAP"。与本会话早前重开的
`OperationsOrganizationExtensionController` 及三处 contract path 完全对得上。

模板 `§1.1` 新增的《Owner-definition 驱动字段槽位（强制）》把这条升为通用标准，
且覆盖了"槽位可以不预造运行时字段名称，但不得以此省略可见位置"——
正是动态字段无法枚举文案时的正确写法，不是只修这一处。

### 1.4 OTP 策略 —— `CONFIRMED`

`P6 预备稿 §8.1`（anchor `RM1-P6-OTP-DEBUG-CODE-EXPOSURE-01`）四条逐项核对：

1. **仅服务端配置**：`platform.otp.debug-code-exposure: ${CATERING_OTP_DEBUG_CODE_EXPOSURE:false}`，
   默认 `false`；DEV/UAT 显式 `true`，生产未配置/`false`。明写"前端开关、URL 参数、请求参数、
   构建变量或 session 状态均不得控制该行为" ✓
2. **off 时字段缺省而非空串**：原文"门关闭时字段**缺省**，不是空字符串" ✓
3. **不可推导**：原文"OTP 不得由 sessionId、请求参数或任何可预测输入派生"，
   并明确"v4 的无环境门、由 sessionId 派生验证码的实现明确不适用" ✓
4. **红门反转而非删除**：`exposure=false` 时出现非空 debug code 必须失败；
   OTP 可由 sessionId 或请求参数推导也必须失败 ✓

UI 落点五屏齐全，每屏在 `USER_VISIBLE_COPY` 与线框各命中一次
（`IA01-PLATFORM-LOGIN`、`IA01-OPERATIONS-LOGIN`、`IA01-PUBLIC-INVITATION-OTP`、
`IA01-PLATFORM-RECOVERY-VERIFY`、`IA05-RECOVERY-VERIFY`），
文案固定"当前为测试环境，验证码：<code>"，并写明"不写入草稿、日志、URL、session 或诊断文本"。
IA 文档内 `testCode` 残留为 **0**；`§8.1` 只在描述自己 supersede 哪些行时提到该词。

RM1 plan 的四处旧字节（`:121/:124/:249/:317`）**原样保留未被改写**，
由 amendment 显式声明为被 superseded 的指定行——这是对的：plan 是历史工件，
`§8.1` 也明写"该 amendment 不改写历史 plan"。

### 1.5 GAP 诚实性 —— `CONFIRMED`

全仓 IA 现存 **17** 个 `GAP-*`，上一轮验证过的全部仍在（contract project scope、
contract tenant readback、store create cascade、store list filter、store project filter、
invitation role candidate query、platform/operations self-service reset、public reset branding、
role generic update status、extension owner key derivation、workspace user list filter、
platform org/contract overview filter 与 candidates、workspace logo staging），
新增 `GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL`，删除的只有那个被证伪的 definition-read GAP。

**未发现任何"已实现/已可用/契约已支持"式断言**。`intake.md:26-28` 明写
"保留的 implementation-facing GAP 仅是设计后的未来关闭条件，不是已实现事实"，
并声明"本次未修改历史 review、Roadmap、生产源码或契约"——本会话 `git status` 复核属实。

`problem-family-discovery.json` 的分母与反例也可复算：
`:46` 的 "59 + 11 + 8 = 78" 与 ledger 的 "59 + 19 = 78" 是同一算式的两种拆法，自洽 ✓；
`preventionDispositions` 四条全部落到具体控制点（模板 `§1.1`/`§1.2.1`、ledger `§4`、amendment anchor），
不是"以后注意"。

---

## 2. N（观察项，不阻塞）

**N1 ｜`IA04-CONTRACT-EDIT` 线框的槽位位置与本节规则相反**

`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md`
的 `IA04-CONTRACT-EDIT` 线框顺序为：

```text
合同商品明细 …
当前启用的定义字段（按顺序直接插入，无分组标题）
备注 [____] [取消] [保存]
```

而 `§12.4` 规定"在**原生业务字段之后**……直接插入"，其余 11 屏也都把槽位放在全部原生字段之后。
此处"备注"是原生字段却排在槽位之后。**唯一一处顺序不一致**，
最小修法是把槽位行移到"备注"之后、按钮行之前。不影响任何 owner 或 GAP 判断。

**N2 ｜被证伪的 GAP 仍留在一份已封顶的 evidence 里**

`doc/evidence/platform/rm1/p6/rm1-u09-create-edit-form-remediation-design.md:48` 仍写着
`GAP-OPERATIONS-EXTENSION-DEFINITION-READ`：组织/门店 definition read 未固化。
该结论本轮已被三个真实 operationId 证伪，但那份工件属于**已两轮封顶的 form-remediation cycle**，
按既有边界不应重开改写。

建议不改其正文，只在文件顶部加一行
`SUPERSEDED_BY: IA-04 §12.4（2026-07-29）——该 GAP 已证伪`，
防止它被后续会话当作有效实施输入重新消费。若认为连加注也属改写该 cycle，
则在 P6 final 详设的 `identifiedFindingSet` 里记一条同义 supersede 项亦可。

**N3 ｜IA-04 结尾"四个 `GAP-*`"是陈旧计数**

同文件 `:786` 写"四个 `GAP-*` 是最终 implementation-facing design 的明确关闭条件"，
但本会话对该文件去重实测为 **6** 个：`GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION`、
`GAP-CONTRACT-TENANT-READBACK`、`GAP-STORE-CREATE-CASCADE`、`GAP-STORE-LIST-FILTER-SEMANTICS`、
`GAP-STORE-PROJECT-FILTER`、`GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL`。

六个 GAP 各自出现处的表述都准确，只有这句汇总数字陈旧（本轮新增一个后未同步）。
按本包一贯的"不采信自报数字"标准，建议改为"本 IA 的六个 `GAP-*`"或直接列出 id，
避免读者用它当完整性核对依据。

---

## 3. 处置

`M=0 / S=0 / N=3` → **GO**（仅限 P6 当前静态交互详设与证据整改）。

- **无需 Dexter 产品裁决**。四项裁决均已正确落地；本轮未发现新的产品/Journey 语义歧义。
- **N1–N3 在既有批准边界内**，可直接交 Codex：移一行线框顺序、加一行 supersede 注记、
  改一个汇总计数。均不改代码、契约或历史 review。
- 全部 17 个 `GAP-*` 仍是 implementation-facing design 的阻断条件，本 GO **不解除任何一条**；
  `GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL` 与 `GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY`
  的 contract/owner 收敛属 final 实施详设范围。

**本复核不授权**：implementation、契约/owner/codegen 变更、DEV 或动态运行、seed/reset、
Roadmap 状态变更、历史 review 改写、任何仓库控制操作。
