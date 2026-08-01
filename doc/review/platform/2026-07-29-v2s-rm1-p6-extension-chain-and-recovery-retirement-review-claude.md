---
title: RM1 P6 定向复核：旧管理员恢复链下线影响 + 实体扩展信息定义/使用闭环（Claude）
reviewTarget: DESIGN
scope: Dexter 2026-07-29 追加裁决（旧管理员链下线）的影响面；五类实体扩展信息的定义→录入→展示→消费链条
verdict: NO-GO
findings: M=1 / S=4 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态交互详设复审；不授权 implementation、contract/owner 改动、codegen、动态运行、seed/reset、Roadmap 状态变更或任何仓库控制操作
createdAt: 2026-07-29
supersedes: 本文件的扩展信息部分撤回同日 round-2 复审对该段落的 GO
---

# 定向复核：恢复链下线影响 + 扩展信息闭环

## 0. 结论

**NO-GO**，`M=1 / S=4 / N=1`。

**我需要先撤回一部分上一轮的结论。** 同日 round-2 我给了整包 `GO`。本轮按 Dexter 指定方向
深挖扩展信息链条后，发现 **M1**：门店创建的扩展 revision 在 contract 里根本不存在、edge 硬编码 `0`、
owner 端严格 CAS——**只要运维管理员为"门店"配了任意一个扩展字段，运营用户就再也建不了门店**。
这条链是 P6 已画进 `IA04-STORE-CREATE` 的，上一轮我没有沿"定义→录入"这条线跑到底。
**round-2 的 GO 在扩展信息这一段作废**；其余部分（自助重置、roster、术语、分母）的结论不变。

Dexter 问的三个问题，我的回答是：

| 问题 | 回答 |
| --- | --- |
| **为什么业务上需要扩展信息** | **仓内查不到。** R5 `D01-S07P` 只写"平台人员按五类实际值宿主管理扩展字段 definitions 的完整集合"——这是*做什么*不是*为什么*；`confirmed-business-language-corpus.md` 全文"扩展"命中 **0** 次；IA-03 的 `BUSINESS_SCENARIO/GOAL` 用页面动作复述自己。**这是 S4，需要 Dexter 补输入。** |
| **如何使用扩展信息** | **录入侧设计了，使用侧没有。** 5 类实体的 create/edit 都规定嵌入"补充资料"；但 **6 个只读面（三个详情 Drawer、门店资料页、平台组织/合同详情）无一展示扩展值**，也不可筛选、不可导出。用户填完之后只能靠再打开编辑抽屉才看得到。**S3。** |
| **UI 上是否清晰完整闭环** | **否。** "补充资料"这一整块可见表单区与"未识别的历史资料"只读区，只存在于 IA-04 `§12.4` 的散文里，**在全部 12 个相关 screen 的 `USER_VISIBLE_COPY` 中没有任何位置**，而三份 roster 全标 PASS。**S2。** |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。

---

## 1. 旧管理员恢复链下线：**已被 Dexter 撤销，本节作废**

> **2026-07-29 追加裁决：`K04` 保留。** 本节 1.1–1.3 的下线动作**全部不执行**；
> `§1.4` 提出的"兜底不对称"风险随之消失（`K04` 仍是运营账号的管理员兜底）。
> IA-01 `§:219-225`、IA-05 `§8.1:387-392` 的 **retain 表述保持原样，不要反转**；
> ledger 的 `K=20`、`X09–X11=NOT_APPLICABLE_WITH_REASON`、总数 `56` **维持不变**。
> 本节仅作历史记录保留，不构成 Codex 的任何动作项。

<details>
<summary>原下线影响分析（已作废，仅存档）</summary>

### 1（原）旧管理员恢复链下线：裁决落地输入（不是 finding）

Dexter 已裁决下线。为免误伤，先把**精确边界**钉死——现在有**两条**都叫"重置登录凭据"的链：

### 1.1 在下线范围内

| 项 | current bytes |
| --- | --- |
| `K04` 发起 | `PlatformWorkspaceAccountController:41 requestCredentialReset` |
| owner 签发 | `WorkspacePasswordResetService#request:37-48`（`generation_key_hash` 唯一签发点） |
| `X09–X11` 消费 | `PublicWorkspacePasswordResetController#{sendOtp,verifyOtp,complete}` + `contracts/openapi/paths/public/access-recovery.paths.yaml` 三条 operation |
| UI | `IA03-ACCOUNT-DETAIL` 的"重置登录凭据"按钮、`IA03-ACCOUNT-ACTION` 的同名确认面 |
| Heritage | `AccessRecoveryPage.tsx@2c7d8ec…` 的 `resetGenerationKey` 入口守卫 |

### 1.2 **不**在下线范围内（极易误伤，必须点名）

`K03` = `PlatformAdminGovernanceController:51 resetCredential`：运维管理员为**另一位运维管理员**
直接设置新密码，走 `body.password()` + `expectedVersion`，**完全不经过 `generationKey`**。
它与被下线的链只是**中文名相同**。IA-03 本轮刚把它按 current contract 改画成秘密输入 Drawer，
**不要一起删掉**。

### 1.3 需要同步反转的字节

- ledger：`K` 由 20 → **19**；`§1` 总数 `24+11+20+1=56` → `24+11+19+1=55`；
  `X09–X11` 由 `NOT_APPLICABLE_WITH_REASON` 改 `RETIRED_BY_DEXTER_2026-07-29`；
  `X01–X11` 需新增 `X12`（原 K04）。
- IA-01 `§自助恢复边界:219-225` 与 IA-05 `§8.1 retain/replace:387-392` 的"**保留**该管理链"
  段落必须整体反转为"下线"；IA-05 `§8.4` 第 3 条同理。
- IA-03 roster 的 `IA03-ACCOUNT-ACTION` 行需去掉凭据恢复分支，`§11` 矩阵同步。

### 1.4 一个必须由 Dexter 裁决的业务后果 —— `DEXTER_DECISION`

下线后，**运营用户唯一的找回路径是新自助链（登录名+手机号+验证码）**。本会话复核 `K` 全集确认：
**运营侧管理员从来就没有任何为下属改密/重置的能力**（`K01–K20` 里 operations face 只有 `K02` 本人改密
与 `K06–K10` 撤销任职）。因此一旦 `K04` 下线：

> 账号**未绑手机号 / 手机号已变更 / 手机号停机**的运营用户，**没有任何人能救**——
> 集团管理员救不了（无能力），运维管理员也救不了（能力已下线）。

而平台侧不对称：运维管理员之间仍有 `K03` 兜底。**两个 face 的最后兜底能力从此不对等。**

请裁决三选一：① 接受该风险（自助链是唯一路径，另行保证手机号必绑与可变更）；
② 保留一条**收窄**的管理员兜底（例如仅"重置手机号绑定"而非"签发恢复链接"）；
③ 为运营侧新增集团管理员的受控兜底能力。**在裁决前，final 详设不应先写死下线后的空缺。**

</details>

---

## 2. M1 ｜门店创建的扩展 revision 无契约来源，定义一存在即必然写失败 —— `CONFIRMED`

**owning source（逐条重开）**

1. `contracts/openapi/components/organization/store.schemas.yaml:390`
   `OrganizationStoreCreateRequest.properties` 实测 =
   `["projectId","brandId","tenantId","headCompanyId","code","name","notes","extensionValues"]`
   —— **有 `extensionValues`，没有 `expectedExtensionRuleRevision`**。
   对照 `BrandCreateRequest`：`extensionValues` 与 `expectedExtensionRuleRevision` **两者都有**。
2. `OperationsStoreManagementController:46`
   `entities.createStore(…, body.notes(), 0L, BusinessEntityWireMapper.requestValues(body.extensionValues()), …)`
   —— 第 10 个实参**硬编码 `0L`**。
3. `BusinessEntityService:154` 形参第 10 位确为 `long expectedDefinitionVersion`；`:159`
   `validateValues("STORE", …, expectedDefinitionVersion, extensionValues)`。
4. `BusinessEntityService:329`
   `if (definition.version() != expectedVersion) throw new OrganizationConflictException();`
   —— **严格相等 CAS，无"0 表示跳过"的豁免**。
5. `ExtensionDefinitionService:68` 首次 `replace` 即
   `INSERT … revision, …) VALUES (…, 1, …)` —— 任何已存在的定义 `version >= 1`。

**反例（一句话可复现）**：运维管理员在"扩展字段 → 门店"里配置**任意一个**字段（definition revision 变为 1）
→ 运营用户打开"新建门店"、填完项目/品牌/经营租户/名称/编码 → 点"创建"
→ edge 送 `expectedDefinitionVersion = 0`，owner 读到 `version = 1` → `OrganizationConflictException`。
**该用户永远建不成门店，且界面上没有任何可行动作能解开**（他既看不到 revision，也无权改定义）。

**边界**：门店**编辑**路径正常——`:60` 用 `revision(body.extensionRuleRevision())`，
且 `OrganizationStoreUpdateRequest` 确有 `extensionRuleRevision`。品牌/经营租户/总公司
create/update 也都正常。**只有门店创建这一条断**。另注意字段名不一致：门店用
`extensionRuleRevision`，其余四类用 `expectedExtensionRuleRevision`。

**为什么这是 P6 的 design finding 而不只是实现缺陷**：
IA-04 `§12.4:761` 自己立了规则——"`extensionValues` 和 `expectedExtensionRuleRevision` 都是
`HIDDEN_OWNER_FACT`……未闭合前，任何受控扩展表单**不得提交空 revision**"；
`§12` 行 733 把"新建门店：……扩展 revision/values"列为**已提交**的 `HIDDEN_OWNER_FACT`。
模板 `§1.2.1:197-199` 要求"新增稳定标识……不得靠 UI 猜测：**先重开 owner source**；
当前 contract 没有合法来源时标 `GAP`"。**这一步没做**：作者写对了规则，却没回读
`OrganizationStoreCreateRequest`，于是断言了一个 request 里并不存在的字段。

**最小修法**：`IA04-STORE-CREATE` 的字段事实矩阵把该行改为 `GAP`
（建议 id `GAP-STORE-CREATE-EXTENSION-REVISION`），写明最小闭环 =
`OrganizationStoreCreateRequest` 增 `expectedExtensionRuleRevision` + edge 停止硬编码 `0L`
+ 与其余四类统一字段名 + 一条真实 red mutation（定义 revision≥1 时创建门店必须具名失败）。
**不需要新增任何产品功能。**

---

## 3. S1 ｜`GAP-OPERATIONS-EXTENSION-DEFINITION-READ` 是假 GAP，并掩盖了真 GAP —— `REJECTED_WITH_EVIDENCE`

**当前字节**：IA-04 `§12.4:763-765`

> 当前组织/门店 definition read surface **未在独立 contract 中固定**，故登记
> `GAP-OPERATIONS-EXTENSION-DEFINITION-READ`；未闭合前，任何受控扩展表单不得提交空 revision
> 或假称"按 contract 已可工作"。

**反证（三条运营侧 definition read 都已是一等 contract operation）**：

| host type | operationId | contract path |
| --- | --- | --- |
| STORE | `getOperationsOrganizationStoreExtensionDefinition` | `paths/operations-admin/store-management.paths.yaml:381` |
| BRAND / TENANT / HEAD_COMPANY | `getOperationsOrganizationBusinessEntityExtensionDefinition` | `paths/operations-admin/business-entity-extension.paths.yaml:5`（**独立文件**） |
| CONTRACT | `getOperationsContractExtensionDefinition` | `paths/operations-admin/contract-management.paths.yaml:310` |

实现在 `OperationsOrganizationExtensionController`：`/stores/extension-definition` 与
`/business-entities/extension-definition`，后者带白名单
`Set.of(BRAND, TENANT, HEAD_COMPANY)`，并对两者都做
`session.contextVersion() != expectedContextVersion → SessionInvalidException`。
**五类 host type 的运营侧 definition read 齐全且已鉴权。**

**代价**：① 登记了一个不存在的实施阻断项，会造成无谓返工；
② 更要紧的是——**这条假 GAP 的措辞恰好覆盖了"不得提交空 revision"这句话**，
使真正断掉的 `M1`（门店创建根本没有 revision 字段）被当成"已被同一条 GAP 兜住"，从而没被单独发现。

**最小修法**：删除该 GAP，改为在 `§12.4` 直接引用上表三个 operationId 作为 definition 读取来源；
把"不得提交空 revision"重新挂到 `M1` 的新 GAP 上。

---

## 4. S2 ｜"补充资料"是整块可见表单区，却在 12 个 screen 里都没有 `USER_VISIBLE_COPY` 位置 —— `CONFIRMED`

**owning source**：IA-04 `§12.4:753-759` 规定——每个 create/edit Drawer"在基础业务字段之后
嵌入**'补充资料'分组**"，按 definition 映射 `TEXT→Input`、`NUMBER→InputNumber`、`DATE→DatePicker`、
`BOOLEAN→Switch`、`SELECT→owner options 的 Select`，"仅启用字段展示，required 由 definition 决定，
已存未知 key/value 不删除并在详情以**'未识别的历史资料'**只读保留"。

**本会话逐屏抽取 `USER_VISIBLE_COPY`**（12/12 全部核对）：

| 写面 | 是否出现"补充资料" | 读面 | 是否出现扩展/未识别资料 |
| --- | --- | --- | --- |
| `IA04-BUSINESS-CREATE` | **否** | `IA04-BUSINESS-DETAIL` | **否** |
| `IA04-BUSINESS-EDIT` | **否** | `IA04-STORE-DETAIL` | **否** |
| `IA04-STORE-CREATE` | **否** | `IA04-CONTRACT-DETAIL` | **否** |
| `IA04-STORE-EDIT` | **否** | `IA04-STORE-PROFILE` | **否** |
| `IA04-CONTRACT-CREATE` | **否** | `IA03-ORG-DETAIL` | **否** |
| `IA04-CONTRACT-EDIT` | **否** | `IA03-CONTRACT-DETAIL` | **否** |

全仓 `grep "补充资料\|未识别的历史资料"` 只命中 IA-04 的 **753 与 758 两行散文**。
而 IA-03/IA-04 的 roster 对这些 screen **全部标 PASS**。

模板 `:74` 要求"线框中的每一项可见元素……与其 `USER_VISIBLE_COPY` **一一可追溯**"；
P6 `§4.1:162-166` 明写"任一跨面元素或**无位置文案**为 NO-GO"。
一整块由 owner definition 驱动、含必填校验的表单区没有位置，正是该条针对的情形。

---

## 5. S3 ｜使用侧闭环缺失：扩展值在任何只读面都不展示 —— `CONFIRMED`

这比 S2 更实质：**即使补齐 create/edit 的文案，链条仍然是断的。**

- 6 个只读面（上表右列）无一展示扩展值，也没有"补充资料"分组的线框行。
- `IA04-STORE-PROFILE`（`D02-S07`，门店角色只读页）尤其突出——**门店角色恰恰是最可能需要
  查看这些补充资料的人**，其 `USER_VISIBLE_COPY` 只有"名称/编码/项目/品牌/经营租户/总公司/门店状态"。
- 平台侧 `IA03-ORG-OVERVIEW` / `IA03-CONTRACT-OVERVIEW` 既不展示扩展值，也不把它作为筛选条件
  （其 `§10` 搜索表的条件里没有任何扩展字段）。
- 没有任何 Journey 或矩阵说明扩展值被**谁**、在**什么业务决策**里消费。

**结果**：当前设计下，一个运营用户填完"补充资料"后，**唯一再看到它的方式是重新打开编辑抽屉**。
这不构成一个可用的业务能力——只构成一个可写不可读的数据坑。

**边界**：owner 侧其实**已经把值读回来了**——`BusinessEntityWireMapper:53 extensionValues(...)`
与 `StoreWireMapper:15` 都把 `extensionValues` + `extensionRuleRevision` 放进了 wire。
**是 UI 详设没有安排展示位置，不是后端没给。** 这也说明修法成本很低。

---

## 6. S4 ｜扩展信息的业务动因在仓内无记载 —— `DEXTER_DECISION`

按 CLAUDE.md「方案合理性优先于闭环正确」的第 1 问（**问题对不对**）：

- R5 `journey-decision.md:90` `D01-S07P`：
  "平台人员按五类实际值宿主管理扩展字段 definitions 的完整集合；`ADAPT`"
  —— 描述的是**功能**，不是**用户业务问题**。
- `project-memory/decisions/confirmed-business-language-corpus.md` 全文 `grep "扩展"` = **0 命中**。
  也就是说"扩展字段/补充资料"**从未进入已确认业务语料**。
- IA-03 `IA03-EXTENSION-PAGE` 的 `BUSINESS_SCENARIO` = "先选择业务对象类别，再阅读其完整字段定义"，
  `BUSINESS_GOAL` = "核对或开始整组字段配置编辑" —— **用页面动作复述页面动作**，没有回答
  "哪个业务用户、因为什么、要给品牌/门店/合同挂自定义字段"。

这个能力是从 v2 `ExtensionFieldManagementPage` 整体 carry-over 过来的，**动因随之丢失**。
S2/S3 之所以会发生（定义侧画得很细、使用侧完全没画），根因就在这里——
没有业务问题，就没有人问"填完之后谁看"。

**请 Dexter 裁决/补充四点**，final 详设才有依据：
1. 哪类业务用户、在什么场景需要给品牌/经营租户/总公司/门店/合同挂自定义字段？举一两个真实例子。
2. 这些值**将来被谁读**？只在详情看，还是要参与列表展示、筛选、导出或对账？
3. 定义权在运维后台、使用权在运营后台——**运营用户如何知道字段变了**？需不需要提示？
4. 若当前阶段其实用不到，是否应把它整体降级为 `NOT_CARRIED`／延后，而不是花代价补一条
   写得进、读不出的链？（按 CLAUDE.md 的第 3 问"代价配不配"，这是我会先问的。）

---

## 7. N（观察项，不阻塞）

**N1 ｜跨后台 revision 变更没有用户可感知的处置**

定义在运维后台改（`C09` 原子替换、revision +1），运营用户手上已打开的 Drawer 只会在**提交时** 409。
IA-04 `§12.4:761-763` 写了"应关闭/保留草稿并重读 definition 与实体详情后重填"，
但**没有任何 screen 的状态行或 `USER_VISIBLE_COPY` 承载这个结果**——
`IA04-STORE-EDIT` / `IA04-BUSINESS-EDIT` / `IA04-CONTRACT-EDIT` 的失败提示里都没有这一支。
与 S2 同族，建议一并补。

---

## 7A. DEV/UAT 显示短信验证码：裁决落地输入（Dexter 2026-07-29 追加）

Dexter 已裁决必须加，我按裁决执行，不再论证要不要做。以下是**落地时必须一起处理的三件事**。

### 7A.1 这条裁决与四处已冻结规则直接冲突，必须显式反转、不能悄悄做

| 现行字节 | 原文 |
| --- | --- |
| P6 `§2:45` | P-N1 = "平台管理员需可选 OTP，同时**响应绝不泄露 `testCode`**" |
| IA-01 `:583` | "发送/验证 platform OTP｜P-N1（拟新增，**响应无 testCode**）" |
| RM1 plan `:121` | "……**响应永不含 `testCode`**" |
| RM1 plan `:124`、`:249` | "**OTP 响应重现 testCode** 均有 focused negative fixture"；"OTP response **无 testCode** 的 contract/codegen/controller 三重…" |

后两条是**红门**：当前设计把"OTP 响应里出现验证码"定义成必须失败的负面用例。
若直接加 debug code 而不改这四处，正确实现会被门判红；**更坏的结果是有人为了过门把裁决悄悄阉掉**。
所以 final 详设必须**显式记一条 amendment**（建议 `RM1-P6-OTP-DEBUG-CODE-EXPOSURE-01`），
写明 P-N1 由"绝不返回"修订为"仅在非生产、服务端配置开启时返回"。

### 7A.2 v4 确有这个能力，但 **v4 的形状不能照抄** —— `CONFIRMED`

我重开了 Dexter 指的 v4 源码：

- 契约侧确实有：`CateringOperationsMobileCodeCreateResponse.debugVerificationCode?: string | null`。
- 但实现是 `Iam2OperationsSessionService:502-505`：

```java
private String debugVerificationCode(String seed) {
    int value = Math.abs(seed.hashCode() % 900000) + 100000;
    return Integer.toString(value);
}
```

`:55` 与 `:156` 用它产出的值**就是实际存库的验证码本身**，并且**全路径没有任何环境/profile 判断**，
无条件放进 create 响应。也就是说 v4 的验证码是 **`sessionId.hashCode()` 的纯函数**——
拿到 sessionId 就能算出验证码，OTP 等于形同虚设。

更能说明问题的是：v4 自己的 `contracts/authorization/field-visibility-policy.yaml:22` 写着
`debugVerificationCode: { visibility: NEVER, sensitive: true }` ——**v4 内部就自相矛盾**。

v1 侧我也查了：命中全部落在 `catering-all-v1/.claude/worktrees/*/doc/specs/…` 的 spec 文字
（"`debugVerificationCode` 以 Alert 显（照 v4）"），**不是 v1 的运行代码**。
所以现存实现只有 v4 一份，且不安全。**"v4 有现成能力"成立，"照 v4 搬"不成立。**

### 7A.3 正确形状（给 Codex 的设计输入）

1. **服务端配置门，默认关闭**。本会话确认 v2s 当前**没有任何 profile 机制**——
   `application.yaml` 只有单文件 + 环境变量，`grep "spring.profiles\|@Profile"` 命中 0。
   故建议沿用既有形状新增
   `platform.otp.debug-code-exposure: ${CATERING_OTP_DEBUG_CODE_EXPOSURE:false}`，
   **缺省 false**，生产不配置即天然关闭（fail-closed）。**不得**由前端开关、URL 参数或构建变量决定。
2. **验证码本身必须保持随机**，与 debug 字段解耦。**绝不能像 v4 那样从 sessionId 派生**——
   否则配置门一旦失效就等于没有 OTP。这是 v4 与本设计最本质的差别。
3. **契约**：在 OTP send 响应加 `debugVerificationCode?: string | null`（optional + nullable），
   门关闭时**字段缺省**（不是返回空串）。同时在 v2s 的暴露声明侧标注为 sensitive。
4. **红门要反转，不能删除**。现行"响应含 testCode 即红"改为
   **"`debug-code-exposure=false` 时响应含非空 debug code 即红"** ——
   保留同等强度的负面证据。这一条是我最在意的：便利性裁决不应换掉一条真实安全门，
   只应改变它的触发条件。建议再加一条红："验证码可由 sessionId/请求参数推导"。
5. **UI 落点是 5 处，不是只有登录页**。当前设计里有 OTP 输入的 screen 共五个：
   `IA01-PLATFORM-LOGIN`（OTP tab）、`IA01-OPERATIONS-LOGIN`（OTP tab）、
   `IA01-PUBLIC-INVITATION-OTP`、`IA01-PLATFORM-RECOVERY-VERIFY`、`IA05-RECOVERY-VERIFY`。
   五个都要以 owner 是否返回非空值为唯一渲染条件（沿用 v1 spec 的 Alert 形态），
   文案须自证为非生产提示（例如"当前为测试环境，验证码：<code>"）。
6. **必须落进 IA 的可见文案与 roster**，否则就是本文 `S2` 的同一类缺陷：
   五个 screen 的 `USER_VISIBLE_COPY`、`§5` 状态与边界表、ownership roster 都要有位置，
   且 `TECHNICAL_BOUNDARY` 要写明"生产环境该提示不存在"。

### 7A.4 我保留的一点提醒（不构成阻断）

UAT 常有真实业务方参与验收。若 UAT 也开启该字段，等于 UAT 全程无有效短信验证。
建议 **DEV 开、UAT 由 Dexter 单独决定**，而不是把两个环境绑成一个开关——
第 1 点的配置形状天然支持按环境分别设置，不需要额外设计。这是 `DEXTER_DECISION`，我不替您定。

---

## 7B. v2 是怎么做扩展信息的（Dexter 追问，本会话逐文件重开）

Dexter 裁决"**扩展信息不需要版本管理**"。我把 all-v2 的整条链读完了，
结论是：**这个裁决与 v2 的实际做法一致，而且恰好解释了 M1 是怎么产生的。**

### 7B.1 v2 的写入侧：create **本来就没有** CAS

`all-v2/apps/backend/contract-service/…/application/ContractExtensionValues.java`：

```java
// create：只有 (workspace, submitted) 两个参数——没有 expectedRevision
Prepared create(String workspace, Map<String, Object> submitted) {
    Optional<ExtensionDefinition> definition = definitions.current(workspace, CONTRACT);
    …
    validate(definition.orElse(null), values);
    return serialize(values, definition.map(ExtensionDefinition::getRevision).orElse(0L));
}                                    // ↑ revision 是「写入时按哪套规则」的**留痕戳**，不是前置条件

// update：CAS 存在，但只在调用方真的提交了扩展值时才生效
Prepared update(…, Map<String,Object> submitted, Long expectedRevision) {
    if (submitted == null && expectedRevision == null) return serialize(current, currentRevision);  // 不碰就完全跳过
    …
    if (expectedRevision == null || expectedRevision != revision)
        throw problem(CONFLICT, "经营资料规则已变化，请刷新后重试");
}
```

前端侧完全吻合——`all-v2 StoreManagementPage.tsx:157` 的**创建**请求体：

```ts
const request: OrganizationStoreCreateRequest = {...values, extensionValues: normalize(...),
    expectedContextVersion: …, headCompanyId: …, notes: …};   // 全无 revision 字段
```

而 `:171` 的**编辑**请求才带 `extensionRuleRevision: extensionDefinition.data.revision`。

**所以 v2 的规则是**：创建 = 按当前规则校验后落库并留痕；编辑 = 可选 CAS；不碰扩展值 = 完全不校验。

### 7B.2 M1 的真实成因，比我上一节写的更准确

v2s **把 v2 的 request 形状照搬了**（`OrganizationStoreCreateRequest` 同样没有 revision 字段），
**却在 owner 侧新增了一道 v2 从来没有的 create 前置 CAS**
（`BusinessEntityService:329` 严格相等），再用硬编码 `0L` 去喂它。
两边各自"像 v2"，合起来必然死锁。**这不是漏了一个字段，是多了一道 v2 没有的门。**

### 7B.3 因此 M1 的最小修法要改（推翻我 `§2` 末尾的建议）

我 `§2` 原本建议"给 `OrganizationStoreCreateRequest` 增 `expectedExtensionRuleRevision`"——
**按 Dexter 的裁决和 v2 的事实，这个方向是错的，应当作废。** 正确的最小修法是**反向**的：

1. **create 侧删掉 CAS**：`validateValues` 在创建路径不做 `definition.version() != expectedVersion` 判断，
   直接按**当前** definition 校验值，然后把当前 revision 作为留痕戳写入。门店创建随即恢复正常。
2. **update 侧的 CAS 一并去掉**（Dexter 裁"不需要版本管理"），
   `extensionRuleRevision` / `expectedExtensionRuleRevision` 从**全部** request contract 移除。
   五类实体的字段名不一致问题（门店 `extensionRuleRevision` vs 其余 `expectedExtensionRuleRevision`，
   本是从 v2 原样继承的）随之自然消失。
3. **`extension_rule_revision` 列建议保留为只读留痕**（沿用 v2 的 `serialize(values, revision)` 语义），
   不进 request、不进 UI。这不是版本管理，是"这条记录当时按哪套规则写的"的可追溯性，代价为零。

**这样做为什么仍然安全**：v2 的 `validate()` 是**无条件**跑的——不管有没有 CAS，
写入时都拿**当前** definition 校验"未配置字段/必填缺失/类型或选项不符"。
去掉 CAS 只丢掉"规则刚变过"这一个提示，**不会**让脏数据写进去。
v2s 的 `BusinessEntityService:331` 与 `replaceValues:355` 也有等价校验（含 required 全量复查），
所以这层网在删 CAS 之后依然在。**这是我认为可以放心去掉版本管理的依据，而不是因为 Dexter 说了。**

### 7B.4 更要紧的发现：**v2 的展示侧是完整的，是 v2s 丢了**

我上一节的 `S3`（使用侧闭环缺失）现在有了更硬的证据——**v2 三个消费者全都做了读写两端**：

| v2 消费者 | 详情只读展示 | 创建表单 | 编辑表单 |
| --- | --- | --- | --- |
| `BusinessEntityManagementPage.tsx` | `:521` | `:525` | `:528` |
| `StoreManagementPage.tsx` | `:216` | `:227` | `:238` |
| `ContractManagementPage.tsx` | `:356` | `:359` | `:362` |

共享组件在 `features/entity-extension-fields/`：
`EntityBusinessFieldsDescriptions`（ProDescriptions 只读渲染）与
`EntityBusinessFieldsForm`（按 `type` 映射 `ProFormText/Digit/DatePicker/Switch/Select`），
另有 `orderedEntityBusinessFields` 过滤 `DISABLED` 并按 `displayOrder` 排序、
`display()` 对缺失值渲染 `—`。**即 v2 早就把"定义→录入→展示"闭环了，v2s 的 IA 只继承了录入侧。**

一个可直接采纳的现成事实：**v2 没有给这组字段加分组标题**，
是直接并入同一 DrawerForm / ProDescriptions 的——扩展字段与原生字段在界面上无法区分。

> **更正（Dexter 2026-07-29）**：我上一版在此建议采用「经营资料」作为业务称谓，**这是错的，已撤回**。
> 那四处 `"经营资料…"` 只是 all-v2 后端的报错文案，不是业务概念。Dexter 明确：
> **业务上没有"经营资料"这个东西，只有「实体的扩展字段」——运维管理后台定义，运营管理后台无感使用。**
> 详见 `§7C`。

---

## 7C. 扩展字段的业务定位（Dexter 2026-07-29 裁决）

**裁决原文**：实体的扩展字段，**运维管理后台定义，运营管理后台无感使用**。

这一句同时回答了我 `§6 S4` 的两个问题，并**改判**了我 `S2` 的问题描述。

### 7C.1 「无感使用」是一条实质设计约束，不是措辞

它意味着：运营用户**不应该知道**某个字段是"扩展"来的。因此——

- **不得有任何分组标题、分隔线或"扩展/补充/其他"字样**。
  IA-04 `§12.4:753` 现在写的是"在基础业务字段之后嵌入**'补充资料'分组**"——
  **这句本身违反裁决**，`补充资料` 这个用户可见文案应当整体删除，不是"补上位置"。
  这一点推翻了我 `§4 S2` 的问题描述：`S2` 的正解不是"给补充资料安排位置"，
  而是"删掉这个分组概念，改为把字段并入同一表单/详情区"。v2 的做法恰好就是这样。
- **不应弹出任何暴露定义机制的提示**。"经营资料规则已变化，请刷新后重试"这类
  v2 conflict 文案在 v2s 不应出现——这与 Dexter 前一条"不需要版本管理"的裁决**互相印证**：
  去掉 CAS 之后本来就不会产生这个提示，两条裁决是自洽的。
  校验失败仍按普通字段错误呈现（"未配置字段/必填缺失/格式不符"），用户感知与原生字段一致。

### 7C.2 由此产生的一个 IA 声明方式问题（需要 Codex 按此处理）

扩展字段的**标签由 definition 在运行时给出**，IA 事先不可能枚举。
所以这些字段**无法**写进 `USER_VISIBLE_COPY` 的逐项文案清单——
但模板 `:74` 与 P6 `§4.1` 又要求"每一项可见元素都要有位置、可追溯"。

正确的两全写法是：`USER_VISIBLE_COPY` 声明**槽位**而非**文案**，例如

> "……'备注'；其后依次渲染由运维管理后台定义的该实体字段（按 `displayOrder` 升序，
> 仅 `ENABLED` 项；标签与必填由 definition 给出，不由本稿固定），与前述字段同区、无分组标题"

只读面同理，并补 v2 已有的缺失值表现（`display()` 渲染 `—`）。
这样既满足"无位置文案为 NO-GO"，又不伪造 IA 不可能知道的文案。**建议把这条写进模板 `§1.1`**，
因为任何"owner 定义驱动的动态字段"都会遇到同一问题。

### 7C.3 `S4` 的处置更新

"为什么业务上需要"已由裁决给出：**这是一个配置能力**——
让运维为五类实体按集团空间补充自定义字段，运营侧无感填写与查看。
它不是一个具名业务对象，因此**不需要**补业务语料库条目（我上一版的建议撤回）。
`S4` 由 `DEXTER_DECISION` 降为 `RESOLVED`；仍建议在 IA-03 的
`BUSINESS_SCENARIO`/`BUSINESS_GOAL` 里把这句裁决原文写进去，替换掉现在"选择类别→阅读定义"的自我复述。

---

## 8. 处置

`M=1 / S=4 / N=1` → **NO-GO**（扩展信息链条）。

- **§1 已作废**（`K04` 保留），无动作项。
- **M1 的修法方向以 `§7B.3` 为准**，`§2` 末尾的"增加 `expectedExtensionRuleRevision`"建议**作废**：
  按 Dexter 裁决与 v2 事实，正确做法是**删掉 create 侧那道 v2 从来没有的 CAS**，
  并把 revision 从全部 request 移除、只保留为 owner 侧留痕。
- **M1、S1、S2、S3、N1 在既有批准边界内**，可直接交 Codex：删一个假 GAP、
  把 M1 按 `§7B.3` 重新登记、**删掉 IA-04 `§12.4` 的"补充资料"分组概念**，
  再按 `§7C.2` 的槽位写法给扩展字段在 6 个写面和 6 个读面声明位置。
  **本轮只要求 IA 层如实登记，不改代码或 contract。**
- **`S4` 已由 Dexter 裁决解决**（`§7C.3`），降为 `RESOLVED`，不再需要产品裁决；
  `S2` 的问题描述按 `§7C.1` 改判——是**删分组**，不是**补分组文案**。
- 因此本轮**已无待 Dexter 裁决项**；余下全部为 Codex 可自主修复的 IA 层订正。
- **同日 round-2 复审的 `GO`，在扩展信息这一段撤回**；其余结论（自助重置设计、roster、术语、
  action 分母的 S1）不变，仍有效。
- **§7A（DEV/UAT 显示验证码）是 Dexter 已裁决事项的落地输入，不是 finding。**
  交 Codex 时必须连带处理：显式反转 P-N1 的四处冻结字节、把红门条件反转而非删除、
  五个 OTP screen 的文案与 roster 落位。**不要照抄 v4 的 `sessionId.hashCode()` 实现。**
  `§7A.4`（UAT 是否同开）待 Dexter 一句确认。

**本复核不授权**：implementation、contract/owner 改动、codegen、动态运行、seed/reset、
Roadmap 状态变更、任何仓库控制操作。
