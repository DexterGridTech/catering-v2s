---
title: R3 全范围详设 Codex 对抗自审
status: SELF_REVIEW_ROUND_1
reviewTarget: doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md
createdAt: 2026-07-25
---

# R3 全范围详设 Codex 对抗自审

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-WHOLE-SCOPE-IMPLEMENTATION-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
RESET_TRIGGER=Dexter materially expanded the approved detail-design target from C-01 alone to the whole R3 technical and delivery scope.
PRIOR_CYCLE=R3-C01-CARRYOVER-FIRST-INTERACTION / ROUND_1
```

## 用户任务

业务用户是已获得部署期 platform-admin 访问的系统服务提供者。其用户任务不是管理账号、创建
空间或浏览一个万能后台，而是在一个已存在且未初始化的集团空间中，核对对象、独立输入商业集团
编码和名称、再看到唯一商业集团的 owner readback。R3 的技术工作只有在它让这条操作真实、安全、
可验证且可撤收时才有价值；operations-admin 没有获批用户任务。

## Dexter 立场

Dexter 要一次性 review 能直接指导开发的整个 R3，而非逐文件设计确认；同时保留单一 C-01 业务
分母、外部受控身份/空间前提、双 app 独立，以及不恢复 J02/C02 的红线。故详设必须把 Gate 0、
代理、契约、owner、DB、前端、脚本和证据写成一个严格顺序的交付链，但不能借“整体”把组织树、
平台账号治理、空间创建或 operations 登录带入。

## 替代方案

1. **只写 C-01 的后端/页面细节。** 代价低，却把版本、代理、双 app、Gate 0 和 dynamic cleanup
   留给实施时猜；不选。
2. **直接复活旧 R3-J01/J02 方案。** 文档多、表面完整，但其真实登录/旧 workspace 任务和分布式
   topology 已被当前裁决否定；不选。
3. **为操作完整性再补一个 operations 登录和空间创建 Journey。** 能让两端看似对称，实则违背
   R3-C02 删除和 C-01 外部前提，范围与成本翻倍；不选。
4. **C-01 为唯一业务 Journey，R3-TECH 作为它的最小交付底座，以外部访问适配器代替自造登录。**
   既覆盖可开发所需路径，也不改变产品语义；采用。

## 方案合理性

| 发起的攻击 | 复核事实、反例和适用边界 | 结论 |
| --- | --- | --- |
| “外部受控身份”会不会让 R3 没有真实访问闭环？ | C-01 前提链明确身份和访问资格为部署期外部受控，且现有交互工件故意不画 credential UI。反例是 app 内置 root/账号密码才算真实；这会创造未批准产品能力。代理注入、app 验签、proxy-mediated runner 仍是真实 v2s 安全/访问链 | `CONFIRMED`：外部 access adapter 是更小且忠实的实现边界；它不是伪造登录完成 |
| 是否因完整 R3 详设而偷带 operations 用户能力？ | Dexter 已明确 C02 从 R3 删除；inventory 将 R3-TECH 定义为非业务 Journey。反例是空 session/current-session 也足够证明独立性；它会制造未来 API 和虚假验收面 | `CONFIRMED`：operations 仅独立 app/proxy/build/import 边界，零 session/业务 operation |
| C-01 是否应直接在列表行初始化以减少一步？ | 已接受交互明确列表→详情→初始化 Drawer；商业集团解绑/替换未定义，操作前核对空间的收益高于一步点击。反例是常规 CRUD 的行内按钮 | `CONFIRMED`：详情承载确认与动作，避免误初始化，不是历史 UI 惯性 |
| 单体 owner/coordinator 设计是否过度复杂？ | ADR 要求跨 owner 写走 public command、同一 REQUIRED、coordinator 零资产。空间事实和商业集团事实确属不同 owner；反例是一个“workspace aggregate”直接写两 schema，短期少类但长期破坏主权 | `CONFIRMED`：两个 owner + 一个窄 coordinator 是最小符合 ADR 的结构；不引入 internal HTTP/outbox |
| Gate 0 是否把 R4 的验证提前堆进 R3？ | Roadmap 要求 R3 最小 D.1/D.2/D.3/Flyway gating 先于代码；全量 ArchUnit/query/retirement/verify 仍属 R4。反例是先实现后补 gate，或提前复制所有 R4 gate | `CONFIRMED`：仅四类 R3 mechanical gate，成本与风险相称 |

结论：问题与方案一致。总代价集中在一次 Gate 0、单 deployable 和三 owner-adapter/module 分界；
收益是避免 R3 在契约、真实 owner readback、proxy 安全或 cleanup 上留下实施期即兴决策。较小方案会
遗漏已被用户指出的闭环问题，较大方案则会引入未批准 Journey。

## UI 与交互

`APPLICABLE`：U05/U07 的所有用户可见操作只来自 C-01 已接受四屏 interaction artifact。列表不
直接初始化，详情确认空间，Drawer 明示独立字段，成功必须 owner readback；失败保留安全草稿、
未知结果先读回。没有把接口 path、数据表或 all-v2 页面反推成“新建空间/编辑/启停/账号管理”操作。

平台访问入口不设计 credential 屏，理由是平台身份与访问资格已由 Dexter 定为部署期外部前提；若
未来要把外部 access provider 改为用户可操作的登录方式，那是新 Journey/交互工件，不可由 U02
实现便利决定。operations 边界屏不是业务用户操作，`NOT_APPLICABLE` 于业务 UI，但它仍需明确说明
“本阶段未开放运营业务”而非伪装成登录成功。

## 审查意见复核

- **“必须先指定具体 IdP/credential UI 才能画完整 R3”=PARTIALLY_CONFIRMED。** 重开 C-01
  前提链、interaction map 和 Dexter 接受 decision 后，产品层面不支持这种推导；适用边界是 app
  必须仍验证可信 provider context。更小处理是 U02 写入可验签 context 的部署契约、把 provider
  配置和测试 precondition 记录为受控输入，而非新建登录系统。N-01 保留为 Claude 核查此契约是否
  足以避免“外部前提”变成空话。
- **“全部照搬 all-v2 workspace-management 才能高效”=REJECTED_WITH_EVIDENCE。** 复核
  carry-over-first decision 和 C-01 UI inventory：三个 source 尚是 `PENDING_HERITAGE_REGISTRATION`，
  且旧页含空间创建/编辑/启停/operations 入口、旧 wire/认证假设。适用边界只限已登记的机械壳和
  Drawer lifecycle。更小处理是 U05 先 freeze 精确 source，再 ADAPT；N-02 让 Claude 核查清单。
- **“必须现在为 R3 建语义 checker 以保证 no downstream facts”=REJECTED_WITH_EVIDENCE。**
  verification governance 的建门三问不成立：这是本 Journey 的语义与数据结果，不是可一行解释的
  回归判定。用 L2/Testcontainers owner readback + fresh review 更直接，避免关键词式假绿。
- **“外部工作空间的测试数据可以偷偷由 C-01 页面创建”=REJECTED_WITH_EVIDENCE。** C-01 禁推与
  external precondition 已明确；反例是 dynamic test 因缺数据而失去业务证明。更小处理是 runner
  manifest 明示 external provider 和 cleanup owner，未提供即 `NO_GO`。

以上 finding 均回读 owning Journey、interaction、carry-over decision、ADR 和验证治理后作处置；
没有因为旧实现或“完整 R3”愿望而全盘接受，也没有以过度设计掩盖外部前提。

## 闭环核验

- 总设计覆盖 R3 Roadmap 交付物的 Gate 0、单 deployable/单 DB、proxy、双 app、OpenAPI、Flyway、
  五命令、C-01 owner readback、test/evidence；每项都归入 U01-U07 和路径级 manifest；
- manifest 的每个 UI-bearing 单元引用已接受 interaction artifact 的唯一锚点；每个 delivery unit
  有 owner/transaction、失败/恢复、evidence、pseudo-fix 和 discriminator；
- R3 scope 的前提、operations 删除、C-01 禁推、Heritage freeze-before-carry 和 R4 不提前完成均被
  明示；没有新建 contract/app/migration/runtime 或 Git；
- 本轮仅为新扩大 scope 的第一轮 Codex 对抗审查。若 Claude finding 或源复核显示实质设计盲点，
  只能做第二轮定向核验，之后由 Codex 自决或交 Dexter。

## 结论

```text
VERDICT=GO
SCOPE=GO_FOR_CLAUDE_REVIEW_OF_WHOLE_R3_IMPLEMENTATION_FACING_DESIGN
M=0
S=0
N=2
N-01=external platform-access/workspace-precondition deployment adapter must be checked as an executable, fail-closed input rather than assumed login.
N-02=C-01 Heritage frontend sources must be registered/frozen before any future carry; this does not block design review.
NEXT=freeze manifest/self-review, validate mechanical controls, then request Claude independent review; implementation remains unauthorized.
```
