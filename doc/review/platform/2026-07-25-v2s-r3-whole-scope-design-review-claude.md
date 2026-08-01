---
title: R3 全范围 implementation-facing 详设 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md
reviewer: Claude
createdAt: 2026-07-25
---

# R3 全范围 implementation-facing 详设 Claude 独立评审

## 结论

```text
VERDICT=GO
M=0  S=0  N=5
N-01(外部前提 adapter)维持 N=合理;N-02(freeze-before-carry)维持 N=合理
```

按 Dexter 指定的三个镜头逐项审查:**不重犯 v2 的错**——七类 v2 病(分布式往返、假绿、无来源前提、口头修复不闭集、术语漂移、双后台混同、资源不回收)各有显式防线;**继承 v2 优点**——carry-over-first 首次实装(三页 EXACT_COUNTERPART 全哈希、先冻结后适配),B.4 关键条款(生成面三方对账、app-owned 状态、Drawer 生命周期、typed locator、双 app 隔离测试)全部落进单元;**执行不走偏**——串行七单元、Gate 0 前置+Dexter 不可变 checkpoint、逐单元禁止伪修复清单、§8 显式 deferred 封口。四条 N 均为一行级补强,不阻断交 Dexter 接受。

## 亲验记录

1. **机械分母 fresh 复跑**:granularity `--manifest --review` clean PASS(UNITS=7/FINDINGS=2/GO);scratchpad 定向变异(删除 U05 交互工件引用)→ 真红且定位精确(`UNIT_UI_INTERACTION_ARTIFACT:R3-U05_MISSING`);`standards-coverage --phase R3` PASS(150)。
2. **carry-over 哈希**:交互工件三个 all-v2 源文件(WorkspaceManagementPage/WorkspaceDetailDrawer/CommercialGroupInitializationDrawer)完整 SHA-256 与源仓复算逐字一致;交互工件 `DEXTER_WIREFRAME_REVIEW=ACCEPTED`、逐屏"摹自@hash+差异+差异原因"齐备——carry-over-first decision 首次全流程执行。
3. **前提 fail-closed 核验**:`X-Edge-Auth` 只认代理网络、face 固定 PLATFORM_ADMIN、app 无凭证/无登录表单/无 root;既有空间由部署或受管 run manifest 显式提供,生产路由/DEV/页面/command 都不能创建它;外部前提缺失→business `NO_GO` 而非 seed。**与 C-01 卡四项前提逐行对得上,无一处被实现化为产品功能。**
4. **单体 ADR 忠实性**:coordinator 零资产、单 `REQUIRED` 事务、organization 唯一约束+条件写承担"至多一个"、audit 同事务、COMMAND 边与 SCHEMA_FK 分别登记保持 DAG、无 outbox/listener/REQUIRES_NEW/跨 schema DML;typed conflict `COMMERCIAL_GROUP_ALREADY_INITIALIZED` 与 G-01 一致;Idempotency-Key 语义完整(同 key 同请求重放/异请求 conflict)。
5. **operations 边界诚实**:空 generated slice 有 receipt、U03 conformity 断言三方一致、U06 architecture tests 禁跨 app import;全文无一处宣称 operations 登录;C-02/J01/J02 未被复活。
6. **v2 错误清单逐项对防线**:七服务/内部 client→§2.1 排除;发布≠送达式假绿→owner readback+分账 evidence;"提交 toast 即成功"→U05 明令不得继承;闭集扫描→逐单元 forbiddenPseudoFixes+discriminator;Gate 0 事后追认→U01 明令禁止;工作区脏状态冒充 checkpoint→Dexter commit 锚定(顺带把"commit 后评审"协议在 R3 落了第一块)。

## Findings(均 N)

### N-1:U06 operations 边界页按治理定义属用户可见界面,NA 理由构成危险先例

manifest R3-U06 以"boundary screen is not a user business Journey"作 `notApplicableReason`,但该页是真实用户可见 route(访问 operations 入口者会看到"本阶段未开放运营业务")。Batch 1 治理的 UI-bearing 判据是"用户可见页面/route",不是"是否业务 Journey"——留下"非 Journey 即非 UI"的解释口子,恰是未来走偏的种子。**最小修复**:在 C-01 交互工件加一屏边界页附录线框(文案取已裁决词表)请 Dexter 顺带看图,或由 Dexter 明示豁免"纯静态边界页";二选一,一句话即可。**需 Dexter**(轻量)。

### N-2:缺 B.6#6 DB 往返预算断言(防 v2 往返病的核心条款,R3 就应开始执行)

设计对 list/detail/initialize 未提 `databaseOperationCount` 预算(manifest B.6#6:task read endpoint ≤3、简单写 ≤5,断言进测试)。"进程内 N+1 与跨服务 N+1 是同一种病"是 v2s 立仓理由之一,首个真实端点就该带上探针。**最小修复**:U04/U07 evidence 各加一行——三个 endpoint 的 DB 计数断言按 B.6#6 预算进 integration/L2。不需 Dexter。

### N-3:U05 L2 缺页面文案的业务词/禁用词断言

v2 优点"术语门必须扫前端实际 label"(manifest 行 280)在 R3 全门(R4)前的最小前置:C-01 四屏文案分母极小,一条 L2 断言(正向:集团空间/商业集团/编码/名称;禁用:workspaceKey/aggregate/内部错误文案/"诊断")即可防文案漂移。**最小修复**:U07 evidence 加一行。不需 Dexter。

### N-4:设计头部 SKILL_USED 回执标签与哈希不匹配

行 13 `SKILL_USED=cs-spec-to-plan@72190c88…`——`72190c88…` 是 **writing-plans** 的冻结 vendor 哈希,而 `cs-spec-to-plan` 是本仓原生 skill(无 vendor 哈希)。按 Batch 1.5 回执纪律应写 `SKILL_USED=cs-writing-plans@72190c88…`(实现面设计阶段绑定的正是该适配壳),或两行分别声明。**最小修复**:改一行。不需 Dexter。

### N-5:错误码常量与穷尽映射未点名到 R3 端点(规范已成文,设计缺两句)

依据 manifest B.3 错误分层(行 173:每种冲突唯一错误码、按具名约束映射、禁解析 DB 消息)与 Part C"契约是唯一真相"(行 277:错误码等全部生成 typed symbol、生产代码禁裸字面量、改名必须导致双端编译/typecheck 失败),以及 v2 教训"前端 error-code 裸 switch 无漂移保护"(行 64)。**最小修复**:①U03 加一行——Problem `code` 为 OpenAPI components 闭集枚举,codegen 为前后端各生成 typed 常量,双端禁手写错误码字符串;②U05 加一行——前端 code→业务文案映射用穷尽 switch(TS `never` 保底),契约新增错误码时前端 typecheck 即红。不新增规则,只把既有规范点名到 R3 三个 endpoint。不需 Dexter。
(评审方法说明:本条为 Dexter 提示后补扫所得——我对 manifest 的对照此前是采样式,已同步建立"逐章 sweep+章节命中对照表"的评审门,详见交付话术中的制度化建议。)

### 对既有 N-01/N-02 的裁定

- **R3-N-001(外部前提须为可执行且 fail-closed 的 run input)维持 N 合理**:§1.4 与 U02"部署前提适配"已给落点,剩余是实现验收时的核对项,非设计缺口;
- **R3-N-002(Heritage freeze-before-carry)维持 N 合理**:U05 首步即"登记/冻结后才 ADAPT",与 Batch 1.5 的 registry 字节等价门衔接,实施时机械可验。

## 授权边界

本 GO 仅评价 R3 全范围 implementation-facing 设计,可交 Dexter 接受。它不授权实际 implementation、任何 app/contract/database/migration 写入、代码搬运、DEV、动态运行、seed/reset、Git 或 Roadmap step 完成;实施须 Dexter 在接受评审后另行精确授权,且第一动作是 U01 Gate 0 与 Dexter 的不可变 checkpoint。Git 归 Dexter。
