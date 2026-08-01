---
title: 前端资产搬运优先（carry-over-first）
status: DEXTER_DIRECTED
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
heritageRestoration: true
heritageSource: "../catering-all-v2/AGENTS.md#L46@331ad53e5000cbb757f680f339fb779e24c0ada6f881cfe4fcb01b214dd241b4"
---

# 前端资产搬运优先（carry-over-first）

## 1. 裁决与适用范围

这是对 all-v2 已有“先复核并继承经真实 L2/运行验证的组合，避免从零试错”规则的恢复与拓宽，不是 v2s 新增的产品规则。来源为冻结时点 `../catering-all-v2/AGENTS.md#L46` `@331ad53e5000cbb757f680f339fb779e24c0ada6f881cfe4fcb01b214dd241b4`；当前 all-v2 文件行号若漂移，以此 hash 与本裁决语义为准。

对每个获批且 `UI_BEARING=true` 的 Journey，先盘点 all-v2 的对应页面、页面局部、前端壳和
foundation 资产，再决定线框或未来实现的形状。它解决的是重复造相同前端资产、丢失已验证交互
细节的成本问题；不把 all-v2 提升为 v2s 的产品真相、实现授权或 runtime/build fallback。

本裁决立即适用于正在交互设计的 R3-C01；其他 Journey 在获批进入交互设计时适用。它不授权
任何代码搬运、implementation-facing design、contract、数据库、app、DEV、动态运行、seed/reset
或 Git。

## 2. 设计期：先盘点，再画图

每份 UI-bearing Journey interaction artifact 必须含“v2 对应页面盘点”一节，并逐个 user-facing
screen 填写：

| 必填项 | 要求 |
| --- | --- |
| 对应关系 | `EXACT_COUNTERPART`、`PARTIAL_COUNTERPART` 或 `NO_V2_COUNTERPART`；按用户任务和信息层级判断，不能按文件名/组件名猜测 |
| Heritage 锚点 | `all-v2 <sourcePath>@<SHA-256>`；使用前回读精确 source，并检查 hash。若尚未纳入 frozen registry，标为 `PENDING_HERITAGE_REGISTRATION`，只可作静态审看出处，不能作 runtime/build 依赖或实现搬运输入 |
| 静态基线 | 有对应页时，线框必须以该页的静态摹本或可审阅截图为基准，并标“摹自 all-v2 path@hash”；不只列字段。不存在对应页时，写明检索范围、`NO_V2_COUNTERPART` 与新画原因 |
| 差异 | 只逐项标注相对基线的新增、移除、文案/状态改变；每项附原因：`新裁决`、`新范围`、`质量修复` 或 `未裁决不得继承` |

“静态摹本”仅为 reviewable visual artifact，可用 Markdown 低保真框图、图片或静态 demo；不是
对旧代码的复制、import 或隐性实现授权。凡已有对应页，重画完全不同的布局必须写出不能摹本的
理由并由 Dexter 在看图时裁决。

<a id="waiver-record"></a>

Dexter 可以对一个明确 screen 范围豁免绘制静态摹本；该 screen 的“静态基线 / 摹本标注”必须改为
`DEXTER_WAIVED_<YYYY-MM-DD>；等价证据：<review/source path#anchor>`。豁免只替代视觉副本，不能
替代 Heritage `path@SHA-256`、原始业务来源、差异理由、逐 screen foundation 声明或后续实现期的
目标路径/验证责任。

## 3. 实现期：显式搬运优先

未来 implementation-facing design 的 granularity manifest 必须为每个页面、feature component、
app shell 与 foundation 资产列出搬运清单：

| 必填项 | 要求 |
| --- | --- |
| 来源与目标 | Heritage `sourcePath@SHA-256`、v2s `targetPath`、资产类型与 owning app |
| 处理方式 | `CARRY`、`ADAPT`、`REWRITE` 或 `NOT_APPLICABLE`；`REWRITE` 必须写业务/架构/质量原因，不能只写“更干净” |
| 适用边界 | 保留的交互/机械 foundation 不变量，以及不继承的旧业务语义、owner/contract/authorization 假设 |
| 验证 | source hash 再核、目标路径、差异说明、受影响 UI/L2 证据；旧仓零 runtime/build import |

generated wire 层是例外：不搬运 all-v2 generated endpoint/type，而按 v2s 新 edge OpenAPI 与
`x-consumer-faces` 重新生成各 app 自己的 slice。该例外不允许借 shared generated package 或
foundation 绕回旧 wire。

每个最终 screen 详设还必须声明将消费的 `admin-ui-foundation` export，或
`NONE_WITH_REASON` 的具体不适用理由；随后绑定 exact target path、唯一 shared owner 与 focused
evidence。目标路径尚未确定时，不得声称已完成 import-equality 检查；路径确定后才可按三问原则建立
该机械对账与真实 red mutation。

R3-TECH 未来实现前端壳与 foundation 时，整体搬运 all-v2 对应壳/机械 foundation 是默认候选；
逐块重写必须在 manifest 中给出理由。`platform-admin` 与 `operations-admin` 仍是独立 app，
不得借整体搬运合并 shell、router、session/context、theme、page/read model 或业务文案。

## 4. 纪律与优先级

1. 已接受的 Journey、业务 corpus 和 Dexter 新裁决高于 Heritage。旧页与新裁决冲突时，保留
   基线并显式写差异，不静默复制旧语义。
2. Heritage 只读、hash-bound；本仓不得 import、构建依赖或运行时 fallback 到 all-v2。实现期
   的“搬运”是将已授权、已核验的内容复制/适配到 v2s target，而不是引用旧仓路径。
3. 不为此建立关键词或相似度语义 checker。对应关系、摹本质量、差异原因和 rewrite 理由由
   Codex 对抗审查、Claude 独立复核与 Dexter 看图判断。
4. `PENDING_HERITAGE_REGISTRATION` 的资产只能帮助当前设计对照；在获准 implementation 前，
   必须完成 registry/frozen 处置或由 Dexter 明确拒绝搬运，不能绕过 Heritage 纪律。

## 5. 首次应用与后续

R3-C01 必须将 all-v2 `workspace-management` 的列表、详情 Drawer 与商业集团初始化 Drawer 作为
逐屏基线，回补对应关系、静态摹本及差异原因，再交 Dexter 看图。该回补不会恢复 R3-J02，
也不会把 all-v2 的平台账号、集团空间创建、operations 登录或其他非 C-01 操作带入范围。
