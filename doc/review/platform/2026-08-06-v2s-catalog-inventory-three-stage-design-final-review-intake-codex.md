# 商品目录与门店轻库存三阶段详设 · Claude 最终复核 intake

- source review: `doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-final-review-claude.md`
- source verdict: `NO-GO — M=1 / S=1 / N=1`
- disposition rule: finding 仅为待验证输入；逐条重开 owning source、反例与有限分母后裁定
- authorization boundary: design-only；不授权 implementation、OpenAPI/policy/generated 实改、schema/migration、seed/reset、DEV/UAT/L2 或 runtime

## M-01 · `CONFIRMED_FIXED`

Claude 指出的 40/42 个 operation 缺少实施级逻辑、异常条件、调用链和正常 DB 次数属实。整改不是在
Markdown 中堆四列散文，而是建立 42 行、operationId 稳定键的机器可读设计源：

`doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json`

每行包含：

1. `logicSteps[]` 有序逻辑步骤；
2. `conditionToProblem[]` 有序触发条件，code exact-set 等于 `problemCodes[]`；
3. `callChain[]`，initiating/coordinated owner exact-set 等于 assertion matrix；
4. `normalPathDbOperations`，具名 fixture、精确次数、逐 owner read/write breakdown 与假设。

既有项目记忆 `http-crud-efficiency-design-redlines.md` 新增 `PER_OPERATION_DESIGN_CONTRACT`，并明确它是
逐接口正常访问形态的设计限定，不是通用 SQL ceiling 或性能结论；详设规范
`2026-07-25-v2s-design-governance-batch-1.md` 同步定义机器与人工边界。schema v2 的既有
`implementation-design-granularity` 门验证存在性、顺序、problem exact-set、owner exact-set 与 DB 分解求和，
四条真实 red mutation 覆盖缺步骤、owner 漂移、problem 漂移、DB 次数漂移。P2 exit 以
`RequestCompletionEvent.databaseOperationCount` 对同一正常 fixture 做精确对账，漂移必须具名 disposition。

逐行语义复核还发现并关闭了五个原设计宽泛错误集：两个 preflight 把 compatibility blocker 放入 200
完整结果而不是首错 typed failure；local execute 用 `STALE_COPY_PREFLIGHT` 区分 digest/version 漂移；盘点和
正数增加不携带负库存错误；商品 create/save 补资产未就绪错误；品牌复制调用链补 organization owner。

## S-01 · `CONFIRMED_FIXED`

Claude 对技术风险的判断成立：只有 shape 的商品结构位无法阻止“同商品码、同 SKU 码但属性组合不同”时
BOM 被静默重写到错误 SKU。SKU 结构指纹应保留。

Dexter 已授权回写。最终需求 §5.6.6 商品结构判别位已改为“商品形态 + SKU 结构指纹”，§5.9 新增
`D-16`，明确排序算法、静默损坏反例与不新增第十类对象的边界；IA §11.2 与详设 difference exact-set
同步从 17 更新为 18。由此 requirements、IA、fixture、digest 与执行复核重新成为单一真相。

## N-01 · `CONFIRMED_FIXED`

Dexter 已确认 selected=`20`、closure=`500`，同时要求日后方便调整。设计改为：

- 唯一数值声明点：`contracts/policy/catalog-inventory-copy-policy.json`；
- OpenAPI/generated 只冻结两个 typed problem 与 `{actual,limit}` 形状，不冻结数值；
- owner 加载 policy 校验，server readback 把 limit 传给 UI，fixture generator 加载同一 policy；
- `CI-API-016/017` 永远表达“当前 limit 成功、limit+1 typed failure 且实际数正确”，不绑定常量；
- P1 门扫描 owner、UI、fixture 与文案有限分母，除 policy source 外出现 `20/500` limit 字面量即红。

因此后续调整只改一处 policy 数据，契约结构、generated 字节和场景语义不变。

## 当前结论

M-01、S-01 与 N-01 均已完成设计整改，Claude 已对该轮给出 GO。
该 intake 不构成第三轮独立子 agent 审查；同一 review cycle 已达到两轮上限。下述 GO 后 S/N 收口改变了
当前设计字节，因此 manifest 继续诚实保持 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，不把前一 hash 的
GO 冒充为当前字节复核。

## Claude GO 后续 finding intake

Claude 定向复核结论为 `GO — M=0 / S=1 / N=1`。两条均不推翻 GO，但作为已确认问题族继续收口：

### S-02 · `CONFIRMED_FIXED`

共用三步骨架本身是合理压缩，反例边界是复杂操作已分别写出 whole-save、copy、preflight 与 asset 语义；
但分类移动和四个库存动作确实被过度压缩。根因是把“同样经过校验/写入/readback”误当成“业务动作相同”。
有限分母仅为五个 operation：`moveOperationsCatalogCategory`、count/increase/adjust/configuration。

最小修复已落入 backend operation design contract：分类移动明确载入 proposed-parent ancestor closure、环检测、
CAS parent/order；四个库存动作分别明确绝对覆盖、正增量、带原因的有向增减、只改配置不写 balance/ledger，
并保留“流水先于余额”的需求规则。其余 37 个接口未为降低重复率而无收益重写。

### N-02 · `CONFIRMED_FIXED`

exact-set 只能证明零漏项，不能阻止懒映射，该 finding 成立。最小修复不新增关键词 checker：P1 每条
assertion 必须声明具体的前提—动作—结果 `verifiedBusinessBehavior` 并绑定 scenario；独立/Claude review
抽查 IA 绑定数最高五项、每 IU 至少一项，以及复制和库存动作全量高风险 assertion。详设规范和
`ASSERTION_SCENARIO_SEMANTIC_TRACE_REVIEW` checklist 已固化该人工判断；机器门仍只负责 exact-set。
