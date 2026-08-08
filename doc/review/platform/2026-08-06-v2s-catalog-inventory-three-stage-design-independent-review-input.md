# 商品目录与门店轻库存三阶段设计独立盲审输入

```text
REVIEW_CYCLE_ID=CATALOG-INVENTORY-THREE-STAGE-DESIGN-20260806
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
AUTHOR_MATERIAL_READ_BEFORE_VERDICT=false
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 盲审声明

Reviewer 必须先从需求、IA、Dexter 裁决、项目架构/记忆与当前仓库结构独立推导合理方案、反例和
更小替代，再读取 Codex 详设与 manifest。不得先读取作者 intake、Claude handoff 或作者 verdict。
本轮是同一 cycle 的第二轮且为硬上限。Reviewer 先重开 Round 1 owning sources 与当前字节，独立判断
五条风险是否真实关闭，再读取作者 intake 对照；不得因作者声称 fixed 而降格核验。除修订引入的新
M/S 外，只做定向终审，不重新发散已通过范围。

## 必读业务与 IA 输入（全文，path + hash）

| path | sha256 | 必核查 |
|---|---|---|
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md` | `dd4232e2247bd846f4699dbf97e5c8e51bbded69b9d11791bb949d3e896ce63d` | 模型、读任务、复制闭包/兼容/TOCTOU、seed 代表业务、17 differences |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` | `db7e622a6aa3b2a1bdc3d9e54452d007fe598e59fda85fc0e83170ea638dcd4d` | 89 IA-ID、九 surface、三页、读形状、C-16/17/19 收口 |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-ia-design-review-claude.md` | `3f2a7bbb092ac05350079a939fd29b5286bb9cc0db79d37984a6a64a09407fe3` | §8 GO、§9 Dexter 三项裁决；旧 findings 只作 provenance |
| `project-memory/decisions/confirmed-business-language-corpus.md` | reviewer 实算 | G-11/G-12 正典叫法与禁用词 |

## 必读架构、标准与当前仓库输入

| path | sha256 | 必核查 |
|---|---|---|
| `AGENTS.md` | reviewer 实算 | 单 deployable、owner、动态矩阵、逐点双读与评审治理 |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` | owner/transaction/read edge/face 边界 |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | deterministic source discipline |
| `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `ccc7fce9a7498b1ec528f2a2dad200a50f3ec187824456fd1a5df5de7c82a742` | read model、N+1、command/readback、幂等 |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` | source-first、solution reasonableness、round 规则 |
| `contracts/policy/crud-presentation-standard-catalog.json` | `b77b8f0e822ba600b8540031a2eb89dd7b8a553c0b6c2ecf385a70585051632d` | N-04 policy 窗口与 P1 首项 |
| `contracts/catalog/admin-catalog.json` | `36978594129bf1d08772050d8443e56c45269c1fbf6f1f34636f3417c6a44ff1` | 现有页面/导航/角色结构 |
| `contracts/policy/standards-coverage-matrix.json` | `80aa25c1d87c8d3e53443619475b133eb377e463141aa67b87e9f587d0dfa460` | 150 条 due standards 与 review checklist |
| `apps/backend/catering-business-server/modules` | directory read | 现有模块物理模式与无 catalog/inventory 事实 |
| `contracts/openapi`、`scripts/generate` | directory read | 当前 R5 source→materialize→generated 链，禁止手改 generated |
| `libraries/frontend/admin-ui-foundation` | directory read | 既有 foundation surface 与 App-local 反例边界 |

## Round 1 独立结论与作者 disposition（先核风险，后读 disposition）

| path | sha256 | 用途 |
|---|---|---|
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-independent-review-round1.json` | `65f385f214fab37845f949139a89aa9b9705b8713df3d09534355f67e772d5b5` | Round 1 `NO_GO M=3/S=2/N=0` 的原始 finding |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-intake-codex.md` | `0e6686b5d7c2b33647cc7f81f4be2d6aa4ef69a77a764eeb7812844d1310da0d` | 作者 disposition；只能在 reviewer 独立核验对应风险后读取 |

## 被审当前字节（在独立推导后读取）

| path | sha256 |
|---|---|
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md` | `98a300a0889b91bd82c48f5e72cdc864c38a59e86d82b5439fcbf4bd107b6e0c` |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-granularity-manifest.json` | `88386b4d6b3ec188bc14357fc3572f37e4fb0d16234029bc6436ff4b9d216942` |

## 必须主动证伪的十项

1. P1 是否真的同时定义写命令与全部 UI 所需读模型，尤其库存六区与复制完整 preflight；
2. 42 operation 是否有遗漏、重复、错误 owner/face，asset operations 是否必要且不过度；
3. `IU-01..08` 纵轴与 P1/P2/P3 横轴是否可 exact-set，而不是双套口径继续漂移；
4. 一个 canonical fixture catalog 是否既防 API/L2 漂移，又没有把 seed 与异常测试数据混在一起；
5. 26/100 API 与 18/43 L2 的 case arithmetic、分层理由和重点正反例是否真实、无重复/漏验；
6. 九类 compatibility 中三类 `NOT_APPLICABLE_NO_STRUCTURAL_BITS` 是否正确，是否遗漏真正阻断；
7. C-16 visible-disabled、C-17 immutable code/void-recreate、C-19 no StockTarget code 是否在 IA/contract/DB/UI/test 全链一致；
8. copy closure/rewrite/TOCTOU 是否在 P2 完整收口，P3 是否只验交互；
9. 三 owner、app coordinator、task read、REQUIRED 与单 Flyway 是否合理且无循环/跨 schema DML；
10. 三阶段 exit 是否各自诚实，business/cleanup 与未授权动态面是否清楚。

Reviewer 还必须提出至少一个更简单替代并比较成本；若拒绝替代，要给业务与实现证据。

## 输出

创建：
`doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-independent-review-round2.json`

必须满足 `kind=implementation-design-adversarial-review`、`reviewTarget=DESIGN`、
`reviewerKind=INDEPENDENT_SUBAGENT`、本 cycle/round 元数据、source-first blind 声明、
逐 finding 的 M/S/N、三个 delivery unit verdict、severity counts、GO/NO_GO 和授权边界。
必须逐条给出 Round 1 五条 finding 的 `CLOSED / STILL_OPEN / REGRESSION`，并声明
`ROUND_FINAL_DECISION=SELF_DECIDED`。本轮只审设计，不授权任何实现、contract/policy/generated、
schema/migration、seed/reset、环境或部署；本 cycle 禁止第三轮。
