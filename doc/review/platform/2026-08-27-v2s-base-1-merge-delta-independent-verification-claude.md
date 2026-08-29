# base-1 合并差量 · 独立核验 · GO(0M / 1S / 2N)

**会话出处**:fresh v2s-rooted 独立评审会话,零仓内写入例外为本文与两处**我自己**权威输入的事实更正(见 N-1)。

**⚠️ 利益边界必须先声明**:`requirements-claude`、`appendix-cascade-and-members-claude`、`design-merge-claude`
三份权威输入**由我撰写**,我对它们不构成独立审查。对 `implementation-design-codex` 与 `ia-design-codex`
的核验是独立的。下文凡结论涉及我自己文档的,一律标注。

**方法**:八项重点全部重开原始契约、迁移与源码亲验并独立复算,不采信两份详设的任何自报数字。

---

## 结论

**GO** · `M=0` `S=1` `N=2`

八项重点在设计侧**全部通过**。唯一针对设计的 finding 是 S-1(时序),且已有守卫。
两条 N 都是**我自己权威输入里的错**,设计没有跟随,已更正。

---

## 逐项核验结果

| 项 | 结论 | 独立复算的关键事实 |
|---|---|---|
| 1 · A-2 BUSINESS oracle | **PASS** | `BUSINESS_ORACLE` **已是 harness 现有值**,`BackendAcceptanceTest` 第 1471–1472 行:message 不以 `CONTRACT` 开头即归此类;而 `contractPass` 在 HTTP 200 时仍为 true。故 `HTTP=200;CONTRACT=PASS;BUSINESS=FAIL;failureCategory=BUSINESS_ORACLE` **零新增基建即可达成** |
| 2 · A-3 回填与 CHECK 相容 | **PASS** | 设计 §10.5 先逐表证明"目标值 ∈ 执行当时生效 CHECK",第 3 步对 `business_channel` 严格 drop → UPDATE → 断言只余两值且无 null → 立即 add 三态;第 4 步在旧 CHECK 生效时回填 `catalog_item`/`catalog_sku` 并**顺带删除 DRAFT default**(A-4) |
| 3 · A-1 enum 顺序与分母 | **PASS** | 13 逻辑字段 / 15 schema occurrence **独立复算吻合**(见下);四类额外载荷各给了具体目标 enum 值集;22 组扫描**逐字符复现**且复现了"不排除 `type` 会得到 23";12 条单位状态 response pointer 实测全部存在;字典以 `satisfies Record<GeneratedUnion,string>` 建立,明禁 `Record<string,string>` fallback |
| 4 · D02 普通 UNIQUE | **PASS** | 三处一致:D 裁定表第 30 行、§10.3 第 622–624 行、§10.5 第 5 步"账号手机/登录不进 partial duplicate 分母"。同时 `status` 仍加 `VOIDED`——身份键与状态两件事分得对 |
| 5 · D03 约束与修订 | **PASS** | 约束恰为 `UNIQUE(order_option_definition_ref, code)`;§10.3a 的 SQL 注释点名 `V20260820_010000_002` 且**只限 option-value**;保留 `data_node_ref`/`brand_ref`/复合 FK/父表 `uq_..._scope_ref`/子表 `(parent, display_order)`/非唯一 `ix_..._value_scope_code`;不新增子状态;先新后旧且存量父内重复 fail closed |
| 6 · D01 过渡集与 22 GET | **PASS** | 六值**逐项独立复算完全吻合**;22 个 catalog GET 与我独立枚举的 operationId **逐个相同**,结论全部"保留" |
| 7 · stop_reasons 单一时序 | **PASS** | 列由 `V20260827_010000_001` 在 **B3** 掉(F3 写"回读 **B3 migration** 后 DB 列仍缺席");短命 edge 投影由结构 blocker 派生、活到 F3;CP-B3 失败条件明写"除 §1.3 保留到 F3 的短命投影外**又有第二处兼容面**" |
| 8 · 跨文档矛盾 | **1S / 2N** | 见下 |

### 第 6 项的独立复算

```
当前 operationId 去重总数 = 239
  reads(GET) = 102   commands = 137
  commands 按 face: operations-admin 94 / platform-admin 34 / public 9   (合计 137)
catalog-inventory 下 GET = 22
```

与设计声明的 `239/102/137/94/34/9` **完全一致**。四个新 transition 全在 operations-admin ⇒ 短命
`243/102/141/98/34/9`、最终 `238/102/136/93/34/9` 的投影算术成立。平台现有 `transition*` operation
实测 **17 个**,覆盖 **16 个实体概念**(商品单条与批量同一实体)。

### 第 3 项的独立复算

按 schema pointer 实测:12 个**属性名**、15 个 schema occurrence。设计计 **13 个逻辑字段**,
差异在 `statusDisplayName` 出现于三个 schema 而其实是**两个不同的事实**
(渠道 `ENABLED/DISABLED/VOIDED` 与绑定 `PENDING_AUTHORIZATION/EFFECTIVE/INVALID/DELETED`)。
**设计按概念计是对的**,逐行 schema 归属与实测**完全一致**,合计 15。business-channel 7 + collaboration 6 = 13。

22 组扫描按"全局 property 名、至少一处 enum 且至少一处 bare `string`/`['string','null']`、排除 property
name `type`"复跑,得到的 22 个名字与设计名单**逐字符相同**。⚠️ 我上一轮按(域,属性)配对的扫描漏了
`direction`、`key`、`nodeType` —— **设计的口径更正确**。

---

## Findings

### S-1 · 活跃记忆的改写排在它所描述行为的**下一个** CP

**owning source**:`doc/plans/platform/2026-08-27-v2s-base-1-implementation-design-codex.md` 的
CP-B2 RECALL 行(该 CP 段末行)与 CP-B3 RECALL 行;
`project-memory/practices/business-channel-list-scope-and-validity-display.md` 第 27、39、49 行。

**仓内事实**(亲验):

- 第 27 行仍写「停用对象在主列表与详情中仍可读**但不可编辑**」;
- 第 39 行已写「管理编辑与重新启用**只看自身状态**」—— **同一文件自相矛盾**;
- 第 49 行仍把「经营渠道的 `DRAFT/EFFECTIVE` 仍表达渠道生效条件」作为**现行正例**;
- CP-B2 是实现「接受 DISABLED 编辑」的那一步(失败条件明写「`requireEditable` 仍把 DISABLED 拒绝」);
- CP-B2 的 RECALL **不含**这份记忆,该记忆只出现在 CP-B3 的 RECALL。

**推论**:第 27 行与 Dexter 2026-08-27「停用可以改」的裁定直接冲突,且**现在就是活跃的**。
实施 CP-B2 的 agent 按三维对账要求比对「项目记忆里的设计规范」时,会对到一句写着相反结论的活跃断言。

**这不是设计漏看**:附录 B.2 第 1290 行已精确点名这两句并要求"与本批同 CP 改写"。
问题只在**排到了 B3**,晚于 B2。

**为什么是 S 不是 M**:CP-B2 的失败条件会拦住错误行为,不存在未被守卫的缺陷;
代价是对账冲突与返工,不是错误实现流入。

**验收判据(可证伪)**:CP-B2 开始前,该记忆文件不得同时存在"停用不可编辑"与"只看自身状态"两句;
CP-B2 的 RECALL 必须包含该记忆。

### N-1 · 我的需求稿两处数字错,设计**正确地没有跟随**

**owning source**:`doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md`(**我写的**)。

设计 §10.3 把 `organization.commercial_group_idempotency.status` 判为 `NOT_APPLICABLE_FALSE_MEMBER`。
**亲验确认设计是对的、我错了**:该表列为
`idempotency_key / group_workspace_key / request_fingerprint / commercial_group_id /
commercial_group_code / commercial_group_name / created_at`,**无 `status` 列**。
我原扫描按"最近前置表名"归属 CHECK,被该表的 `ENABLE ROW LEVEL SECURITY` 等 ALTER 带偏。

按严格归属(CREATE TABLE 体内 CHECK 归本表;`ALTER TABLE … ADD CONSTRAINT` 归本 ALTER)重数:
**两值 15 处**(非 16),**须登记豁免 2 处**(非 3)。9 张表的清单不受影响:15 − 4(裁定 11 排除) − 2(inventory) = 9。

**已更正需求稿并写明更正理由。** 设计侧无需改动。

### N-2 · 我的合并稿把 operation 数说成实体数

**owning source**:`doc/plans/platform/2026-08-27-v2s-base-1-design-merge-claude.md`(**我写的**)§3 D01 段。

我写「平台已有 `transitionStatus` 形态的实体 **17 个**」。实测 **17 个 operation / 16 个实体概念**
(`transitionOperationsCatalogItemStatus` 与 `batchTransitionOperationsCatalogItemStatus` 同一实体)。
**设计的表述更准**,不影响 D01=B 的结论。

---

## 方案合理性(不只闭环正确)

- **问题对不对**:合并差量处理的是三类**已亲验会真出事**的缺陷——迁移定序会被约束拒绝、
  唯一交付物的门只比状态码、DisplayName 的成因(响应不声明闭集)。是真问题,不是为改而改。
- **方案优不优**:「短命双投影窗口」是在 Dexter「先后端整体验证再改前端」这一硬约束下的最小机制;
  更简单的替代(前后端同批改)已被该约束排除。窗口本身用 FORBID 围死(禁 adapter/flag/v1 路径/
  fallback/双写/DB 兼容列)且必须同批闭合,不构成兼容层。
- **代价配不配**:⚠️ 一处需要留意——A-2 要求"逐 pointer oracle registry"且 operationId 分母须等于
  附录 A.3 exact set,而 A.3 单是 invitation 一条就写明"共 25 个 operation",全节具名 operation 约 38 个。
  registry 规模在设计里**没有上界**。这是被 Dexter「不能跑测试的时候才发现漏东西」直接换来的,
  方向正确;但实施时若发现它把 backend-acceptance 拖出分钟级,应先砍最弱的 pointer 行而不是接受变慢。
  **不作为 finding**,作为实施期注意事项登记。

**UI 判断**:`NOT_APPLICABLE`。本次核验对象是合并差量的设计正确性与分母完整性,
IA 侧只核了与详设的一致性(`MERGE_DECISIONS`、13/15、`CROSS_CHECK_WITH_DESIGN` 三处一致),
未对具体页面操作路径做产品合理性判断。

---

## 授权边界

本文是**静态设计核验**。`GO` 只表示"合并差量在设计层面成立且分母可证伪",
**不授权**实施、契约生成、迁移、测试、DEV、reset、seed、L2、UAT、数据、部署或任何仓库控制动作。
S-1 属于 Codex 在既有批准边界内可自主处置的范围,不构成再授权门槛。
