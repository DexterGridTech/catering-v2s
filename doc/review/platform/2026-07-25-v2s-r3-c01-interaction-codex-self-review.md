---
title: R3-C01 交互设计 Codex 对抗自审
status: SELF_REVIEW_ROUND_1
reviewTarget: doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md
createdAt: 2026-07-25
---

# R3-C01 交互设计 Codex 对抗自审

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-C01-INTERACTION-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
```

## 用户任务

业务用户是已获得部署期平台访问资格的系统服务提供者。用户任务不是“创建一个看起来像集团的
默认对象”，而是在已存在、尚未初始化的集团空间中，明确核对目标后独立录入商业集团名称和
编码，最终看到 owner 读回的唯一商业集团。空空间是合法长期状态；失败后用户不能看到半创建
的集团，也不能因为 C-01 被暗示已经有组织、账号、角色、任职、门店或运营端登录。

## Dexter 立场

Dexter 已接受 C-01 前提链并只授权交互设计与看低保真线框；Dexter 没有授权 implementation-
facing design、认证方式、contract、数据库、app、DEV 或动态运行。因而本轮的成败标准是
“操作能否忠实表达已批准业务任务并暴露未决边界”，不是把常见的账号密码登录页、默认 root 或
旧 J02 流程补齐。C-01 是新 Journey，不得拿 J02 的历史资产缩短工作量。

## 替代方案

1. **列表行直接初始化。** 路径更短，但用户可能在未阅读空间事实时创建不可在本范围替换/解绑
   的商业集团；不选。
2. **创建页中自动带入空间名称/编码。** 表单更少，但把两个独立业务事实偷换为同一事实，违反
   G-01；不选。
3. **详情→抽屉→第二次确认弹窗。** 额外确认看似更安全，但没有提供新信息，代价是一次无意义
   中断；不选。
4. **列表→详情核对→短抽屉独立录入→owner readback。** 多一个有信息价值的详情步骤，仍保持
   单一短表单；推荐。

## 方案合理性

| 发起的攻击 | 复核事实、反例与边界 | 结论 |
| --- | --- | --- |
| 先看详情是否是多余页面？ | 反例是误选空间后直接初始化。G-01 未定义解绑/替换/重建，详情的空间名称、编码与空态为提交前唯一必要核对信息；收益大于一跳成本 | `CONFIRMED`：详情是合理的最小保护 |
| 为什么不直接复制空间信息？ | G-01 明定商业集团名称/编码必须单独录入，反例是“华东空间”自动成为“华东商业集团”；这会产生无法证明用户意图的错误数据 | `CONFIRMED`：两个独立输入不可省略 |
| 泛化确认弹窗是否更安全？ | 当前表单本身已经展示目标空间和两项输入；反例是无新信息的“确定初始化？”导致点击疲劳。并发安全由 owner command/readback，不由弹窗承担 | `CONFIRMED`：不加第二确认是更小方案 |
| 抽屉会不会预设旧仓 UI 或实现？ | 抽屉只作为低保真交互容器；遗产规则仅提供生命周期参考，owner、route、组件、contract 都明确 `TBD`。反例是把 all-v2 component/runtime 复制进本仓 | `CONFIRMED`：没有 Heritage fallback |
| 未画登录页是否让 Journey 不闭环？ | C-01 卡片把 platform 身份与访问资格标为 Dexter 选定的部署期外部受控来源；反例是擅自选择密码、OTP、LDAP 或内置 root。登录方式确实是后续阻断实现的产品/设计边界，不是本交互工件可补的空白 | `PARTIALLY_CONFIRMED`：可审看 C-01 业务交互；不得声称真实登录已设计或已可运行 |

方案的复杂度为一个列表、两种详情状态和一个两字段抽屉；收益是保留“空间不等于集团”的
核心业务边界与并发可恢复性。增加认证、空间创建、组织树、账号治理或高保真 demo 都不会改善
本任务，反而以过度设计掩盖未授权范围。

## UI 与交互

`APPLICABLE`：每个 UI 操作都来自 C-01 已批准 Journey。列表只用于定位、详情只用于核对，
初始化只在 owner 读为未初始化后出现；成功必须经 owner readback 才结束。用户无需切换到
operations-admin，也没有“当前用户可见即可初始化”的前端授权推断。

页面语言使用已确认的“集团空间 / 商业集团 / 尚未初始化”，不使用“租户、root、workspace
初始化”冒充业务语言。唯一产品歧义是平台认证形式及精确平台权限模型：来源是 C-01 前提只裁了
部署期外部受控而没有裁 credential/contract；工件已把它置于屏幕 0 的边界，不擅自绘制。若
Dexter 希望认证也纳入 R3 视觉审查，必须另行批准该交互范围；否则当前线框没有该页面是正确的。

## 审查意见复核

- **Claude inventory review N-1（稳定接受落点）=CONFIRMED。** 重开
  `doc/review/platform/2026-07-25-v2s-r3-r6-journey-inventory-review-claude.md` 与 acceptance
  decision；其要求的稳定锚点已由 acceptance decision §1–§3 提供，C-01 卡片回指该决定。
  反例是继续让卡片自引用；本轮没有复制或绕开该锚点。
- **scope-gap review 的会话出处=UNVERIFIED_REQUIRES_EVIDENCE。** 重开 acceptance decision
  §3：Dexter 尚未提供初始 Claude 会话标识。该事实与 C-01 页面操作不构成可用证据，也没有被
  当作授权；保持原样比伪造 provenance 或增加新 gate 成本更低。
- **“平台登录必须在此图中补齐”的潜在 finding=REJECTED_WITH_EVIDENCE。** C-01 的 actor
  前提是 `ESTABLISHED_SOURCE`，而非 C-01 内产生；重开 C-01 卡片 §3 与 acceptance decision
  §2。适用边界是：这只拒绝在本工件擅自选认证方案，不拒绝未来经过 Dexter 批准的认证 Journey。
  更小处理是显式认证边界，不是制作假的登录 UI。

所有 finding 均重开 owning source，比较反例、适用边界与更小处理；未把 Claude 或 Heritage
材料全盘当成产品真相。

## 闭环核验

- interaction map、四个低保真 screen、状态/边界、逐操作合理性、face/owner 对齐与 B.4/B.5
  人工出处对照完整存在；每屏有唯一锚点；
- C-01 actor、入口空间、独立名称/编码、唯一 readback 和禁推均回指已接受 Journey/corpus；
- 遗产引用均为冻结 path@hash，不引入 runtime/build fallback；没有 mockup、app、contract、DB、
  DEV、动态运行或 Git 产物；
- `DEXTER_WIREFRAME_REVIEW=UNSET`、`DEXTER_HIFI_REVIEW=NOT_REQUIRED` 清楚表明本轮只能交图，
  不能进入 implementation-facing design；
- 当前 cycle 为首轮。线框被 Dexter 评价或修改后，至多可进行一次定向第二轮；不得第三轮。

## 结论

```text
VERDICT=GO
SCOPE=GO_FOR_DEXTER_LOW_FIDELITY_WIREFRAME_REVIEW_ONLY
M=0
S=0
N=1 (平台认证方式与精确权限模型未裁决；已显式留在 C-01 屏幕外，阻断实现但不阻断看图)
NEXT=Dexter 审看低保真线框并给出 ACCEPTED 或 REVISE；未接受前不进入 implementation-facing design。
```
