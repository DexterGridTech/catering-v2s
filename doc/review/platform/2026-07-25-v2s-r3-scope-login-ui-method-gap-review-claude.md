---
title: R3 范围、运营端登录与 UI 设计方法缺口 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/review/platform/2026-07-25-v2s-r3-scope-login-and-ui-design-method-gap-review-request.md
reviewer: Claude
createdAt: 2026-07-25
---

# R3 范围、运营端登录与 UI 设计方法缺口 Claude 独立评审

## 结论

```text
VERDICT=GO(对本"问题识别与裁决框架")
当前 R3-J02 implementation design=NO-GO(阻断,直至 Dexter 裁决范围)
M=3  S=1  N=1
```

范围冲突**成立且比 request 描述的更深一层**:矛盾不是设计稿引入的,而是写在 Dexter 已接受的 J02 裁决文本自身(既禁止创建账号/任职,又要求运营端"仅证明独立登录/session")。设计稿的过错是未按既有 policy 停下求证,而是把矛盾原样物化。裁决框架(A/B/C)完整可用;在 Dexter 裁决前,J02 design 与其 Claude handoff 均应停用。

## 独立推导(先于作者结论)

我先从最高层链独立推导:corpus G-05(运营用户=账号+任职才能登录)+ G-07(新增任职只经邀请且受邀人接受)+ J02 §2(不创建账号/任职/角色)⇒ **J02 范围内不存在任何合法的运营端登录者**。运营端"登录成功"只有四种实现方式:测试/seed 账号、默认账号、匿名 session、把 `/current-session` 200 当登录——全部是 corpus 明令的伪造业务前提。再读作者结论,与我的推导一致。我也主动找了反例:①用平台管理员凭证登运营端?被双后台隔离(两套账号/会话体系不共享,G-03/kernel)禁止;②"仅证明 session 机器而不需要人"?一个没有合法主体的 session 不是业务结果,恰是 Roadmap R2 起反复禁止的假绿。反例不成立,冲突为真。

## Findings

### M-01:运营端真实登录无业务来源——CONFIRMED,J02 design 阻断

- **证据**:J02 selection 行 29("不创建大区、项目、门店、账号、任职或角色")与行 30("运营后台本切片仅证明独立登录/session")自相矛盾;design 行 31/40(operations face 3 个 session 操作)、行 74、行 99(business evidence 含 "operations independently signs in")把矛盾物化为验收条件;corpus G-05(行 93–109)、G-07(行 122–132)封死一切绕行。
- **影响面**:R3 的 business PASS 无法诚实达成;若强行实现,必然落入伪修复清单中的某一种。
- **最小修复**:交 Dexter 在 A/B/C 中裁决(见下),并**同步修订 J02 selection 行 30**——无论选哪条路径,该句必须改写,否则同一矛盾会再次进入下一轮设计。
- **需 Dexter 裁决**:是。

### M-02:platform-admin 登录前提无来源——由 UNVERIFIED 升格为 DEXTER_DECISION

- **证据**:J02 用户任务以"已登录平台管理员"开场(design 行 16),但 v2s 无任何 decision 定义平台管理员账号如何存在。我按纪律主动找反例:Heritage 有明确先例——v1 `two-admin-backends-user-model.md`(运维后台内置 `root` 账户,`builtIn=true`)与 v4 `platform_admin_user` 同构;**但 Heritage 不是 v2s 当前真相**,不能由作者自行沿用。
- **与 M-01 的差别**:运营端登录可以从 R3 移除(路径 B),平台端登录**不可移除**——J02 本身依赖它。所以这不是可推迟项。
- **最小修复**:Dexter 一句话裁决"平台管理员账号是部署期预置的外部前提(参照 v1 内置账户先例)还是 R3 内 Journey";写成一条小 decision,J02 design 引用为显式外部前提。作者"写为外部前提"的方向我认可,但**前提的存在方式必须由 Dexter 拍板**,不能默认。
- **需 Dexter 裁决**:是(粒度:一句话+一条小 decision)。

### M-03:J02 裁决文本自身携带矛盾且入库前无一致性对读——CONFIRMED(request 未列,新增)

- **证据**:J02 selection 是 corpus G-01 之后、G-05/G-07 已确认语义之下形成并被接受的,但行 30 与 corpus 的"登录⇐账号⇐任职⇐邀请"因果链从未对读;acceptance 过程(含我此前对 corpus 的评审)也未覆盖该 decision 文本。
- **影响面**:这是"为什么设计会错"的第一因:作者拿到的输入本身不自洽。若不补上"新 Journey 裁决入库前对读 corpus 前提链"这一步,同类矛盾会再产生。
- **最小修复**:在 solution-reasonableness policy 或 J02 类 decision 模板中加一条人工审查项(**不是机器门**):"逐 actor 核对:该 Journey 每个参与者的身份/数据前提,要么在批准范围内产生,要么有已裁决来源,要么显式标注'外部前提,待 Dexter 确认'"。分钟级,零基建。
- **需 Dexter 裁决**:采纳与否由 Dexter;内容无产品歧义。

### S-01:"无线框"根因=作者执行失误 ⊕ 工件模板缺口(policy 不缺;checker 无责)——PARTIALLY_CONFIRMED(补充第三因)

- **核验**:①policy 已足够——`solution-reasonableness-review-policy.md` §3 六问(行 40–48)与 §4 歧义求证(行 53–59)完全覆盖"登录者是谁"该被问出的场景;作者违反的是既有规则,不是规则缺失。②checker 边界正确——`cli.mjs` 只验 `pageKey/notApplicableReason` 等机械字段(行 206、249 附近),这符合 verification-governance 的 `MACHINE_GATES_MECHANICAL_ONLY`,**不应**升级为伪语义门。③真缺口在**工件层**:policy 要求判断,但没有要求可人工评审的交互工件(interaction map/线框),于是"文字 UI contract"能过门而无从审。④补充第三因(即 M-03):输入文本自带矛盾。三因叠加,作者初步两层分类基本正确但不完整。
- **最小修复**:见 N-01 工件组合;归属为设计模板/skill(`cs-spec-to-plan`)与 standards matrix review checklist 的更新,不建机器门。

### N-01:建议的最小 UI 设计法——CONFIRMED,右尺寸,附两条护栏

request 提议的五件套(interaction map/低保真线框/状态与边界表/任务合理性审查/实施前 review matrix)我逐项核过:全部是人工评审工件、分钟-小时级、零基建,且正确拒绝了视觉稿与组件库预设。**两条护栏**:①只对 UI-bearing Journey 强制,非 UI unit 继续 `NOT_APPLICABLE` 明示;②工件缺失由 review checklist(人审)裁定,不进机械 checker——否则违反 `GATE_ADMISSION_THREE_QUESTIONS`。对已批准的 J02 平台侧,若 Dexter 裁决后范围成立,按 request 行 197–200 列出的九屏画低保真线框即可;operations 端任何线框必须等待用户来源 Journey 裁决(与 M-04 一致)。

### 对 request 其余问题的直接回答

- **M-04(不得以补图/测试账号/seed/新邀请流伪造闭环)**:CONFIRMED,伪修复清单(行 157–166)逐条与 corpus/G-07/验证治理一致,无遗漏;我补一条——**也不得把"operations app 可构建/可部署"当作"运营端登录"的替代证据**。
- **登录与独立 app 边界是否被混为一谈**:是。"两个独立 admin app 的架构边界"(可以由平台侧真实登录+运营侧 app 独立存在证明)与"运营端存在能真实登录的业务用户"(需要用户来源 Journey)是两个主张;Roadmap §9 原文"登录+一个真实页面"写于 J02 选择之前,粒度不足以裁决,须由 Dexter 按 A/B/C 重述。
- **旧 J02 Claude handoff 是否停用**:应停用。带着未闭环前提审架构细节是浪费且会制造"已审"假象;待 Dexter 裁决后按新范围重开 design cycle(REVIEW_TARGET 未变但批准范围实质变化,允许新 cycle,符合两轮制第 4 条)。

## 裁决建议(供 Dexter,非结论)

三条路径都真实可行,我的推荐是 **B(R3 不再宣称运营端真实登录)+ M-02 的 C 式处理(平台管理员=预置外部前提)**:B 保住"不虚构业务"的底线且改动最小——R3 walking skeleton 的产品价值(一条真实链路:登录→真实页面→owner readback)由平台侧完整承载,运营端保留独立 app 骨架与登录页(其唯一诚实行为是"正确地拒绝所有人"),双 app 架构边界照样被 L2 证明;A(补首用户邀请 Journey)拉进角色定义+邀请生命周期+凭证准备,是 R5 体量,与 R3"最薄"定位不匹配。若你在意"运营端连一次真实登录都没有"削弱骨架说服力,可把 A 定为 R3 后紧邻的独立小 Journey,而不是塞进 R3。

## 授权边界

本 GO 仅表示该问题识别与裁决框架可供 Dexter 使用。不授权 R3/W1 实现、contract、migration、app、DEV、动态运行、数据库、seed/reset 或 Git;不代表接受 A/B/C 中任何产品选择;J02 design 在 Dexter 裁决前保持阻断。
