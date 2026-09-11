# 独立 DESIGN 盲审报告（Implementation-facing 详设 Round 1）：到店点餐允许外部接入

\`\`\`text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_DECLARATION=本轮先按当前需求、仓规、标准、owning source 独立找反例；未继承旧 cycle 报告或作者自评作为结论。
EVIDENCE_TIER=STATIC_SOURCE_REVIEW_ONLY
RUNTIME_EXECUTION=NOT_RUN
VERDICT=NO-GO
M/S/N=1/2/0
\`\`\`

## 三维状态

- L1_ENGINEERING=NO-GO：provider descriptor 未达到 implementation-facing 可执行级；另有 contract/UI label 来源和 acceptance oracle 歧义。
- L2_USER_VISIBLE=UNVERIFIED：UI 行为设计大体覆盖 D-01/O5，但 provider 可用性与 label 来源不闭合，浏览器行为未验证。
- L3_UNVERIFIED：HTTP/DB/migration/seed/backend acceptance/browser L2/full-suite/cleanup 均未运行，只能作为实施后必证事实。

## Findings

### M-01 · D-04 真实可用 provider 闭包仍需执行者猜测

status=CONFIRMED。

Journey 要求 checked-in catalog 存在真实“门店自有点单小程序” provider，system capability 与 provider businessScope 都含 DINE_IN 且可绑定 STORE；实施设计只写了 STORE_OWNED_MINI_PROGRAM_DINE_IN、businessScope=[DINE_IN]、bindableNodeTypes=[STORE]，却把 authenticationKind/unbindKind 留给 provider owner 提供。当前 catalog 只有既有 MEITUAN/ELEME/ERP/MEMBER provider，schema 又要求 authenticationKind/unbindKind 为闭集必填，runtime capability closed set 当前也没有 DINE_IN。

后果是实施者必须猜测认证/解绑语义或落成空候选，却仍声称 D-04 完整可用闭包；两者都不能作为可执行详设。

最小修复：若本批坚持完整可用，必须把该 provider 作为产品批准的 checked-in provider 写死，并补齐 authenticationKind、unbindKind、catalog status、enablement/seed 行为及“无外部 adapter”边界；若真实 provider 尚未裁定，则必须降级为 fail-closed 设计并删除正向可用闭包声明。

### S-01 · UI/contract 中文 label 来源不唯一

status=CONFIRMED。

实施设计一方面要求响应继续返回 machine code 与已有中文 display fields，并禁止前端复制新的 enum-label 字典；另一方面 CP-05 又把 collaborationCodeLabels.ts 列入写入范围，而当前该文件正是本地 label map，providerBusinessScope 尚无 DINE_IN。当前 ProviderProfileView 只有 businessScope code，没有 scope displayNames。

后果是实施者会在“新增本地 DINE_IN label”和“消费尚不存在的 generated display field”之间猜路径。

最小修复：明确单一来源。要么在 contract 增加/确认 businessScopeDisplayNames 或 capability display readback，UI 只消费 readback；要么明确 collaborationCodeLabels.ts 是 operations-admin 的唯一闭集 label 源，允许补 DINE_IN，并删除“不得复制新 enum-label 字典”的冲突表述。

### S-02 · 正向 acceptance 场景把 provider 写成可为 null

status=CONFIRMED。

业务矩阵要求 STORE + EXTERNAL + DINE_IN 的 provider 必须是启用且 businessScope 含 DINE_IN 的真实 provider，但实施设计的正向场景写成“POST STORE external DINE_IN with null form/provider”。

后果是实施测试 oracle 可能把 provider 也设为 null，或者让读回断言含混。

最小修复：正向场景明确为 dineInForm=null 且 providerCode=STORE_OWNED_MINI_PROGRAM_DINE_IN；provider 缺失另加负向 providerCode=null -> VALIDATION_ERROR 且 no-write。

## 已核对未形成 finding 的边界

- 外部 DINE_IN 不显示/不提交 POS、QR、KIOSK，内部 DINE_IN 仍要求 POS/QR/KIOSK；当前 Journey/UI/IA/implementation design 一致。
- D-02 只允许 STORE，PROJECT 外部 DINE_IN typed reject/no-write；设计有 policy、DB CHECK、HTTP negative/no-write 闭包。
- D-04 禁止 TAKEAWAY alias/provider；问题是新 DINE_IN provider descriptor 尚未可执行化。
- O5 全部门店渠道读取与 SALES_MENU 资格读取分离；销售菜单仍只认 STORE + INTERNAL + DINE_IN/TAKEAWAY。
- 旧 DINE_IN_MUST_BE_INTERNAL 退役已覆盖 source catalog → generator → generated/OpenAPI/frontend feedback 链。
- migration 采用 additive 方案，不改写旧 migration、不回填。
- L2 admission 明确需要 roster/static proof；本轮没有动态执行。

## 终止条件

本轮 NO-GO 由 M-01 阻断；S-01/S-02 需要在 implementation-facing 文档中最小修复。允许同一 cycle 再做一次定向 Round 2，不能换文件名、换 reviewer 或以局部措辞重置轮次。
