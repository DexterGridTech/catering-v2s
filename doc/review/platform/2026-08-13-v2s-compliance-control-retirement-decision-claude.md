# evidence / package / hash-chain 控制面退役 · 执行清单

- **裁决**:Dexter 2026-08-13——「这一整套 evidence/package/hash-chain 机制,不要继续存在。」
- 性质:执行清单,交 Codex 执行。**不需要为本次调整写设计、写论证、补 evidence。**
- 原则:**先砍文档,再停 hook,代码最后且不急。** 判据是"它现在还在向你收费吗",不是"它有没有用过"。

---

## 0. 为什么(两句话,不展开)

11070 行控制面代码,真正产出价值的不到 1/10;其余九成是为了管住 AI agent 而建。而这次会话实测:抓到 catalog 全部缺陷的是**人看界面 + 读代码对 IA + 独立盲审**,evidence 与 hash 链**一条都没抓到**,却在 successor package / P0=633→822 / entry bundle pointer 这类自我记账上烧掉了整整一轮。

**用机器防语义,防不住,只会越长越大。** 停在这里。

---

## 1. 第一刀 · 文档(最贵,先砍)

**理由**:代码不读它不花钱;**文档每个新会话的 agent 都会读到并照做**。上一轮的 successor I0 review 请求不是 Codex 自作主张,它在执行文档。文档不改,下一轮还会回到同一条路。

加 `SUPERSEDED` 头,写明「BA-U01→U06 全批次交付作废;evidence/package/hash-chain 机制已退役;当前唯一目标是 bootstrapOperation 端到端跑通」:

```text
doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md
doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md
doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-requirements-and-solution-analysis-codex.md
doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md
```

**`CLAUDE.md` / `AGENTS.md`**:删除或标注所有要求 evidence 台账、package entry/exit、六类 source 分母对账、manifest Part B/C/D、hash 逐条复算、implementation-design-granularity 的段落。**保留**:亲验纪律(不采信自报数字)、独立盲审要求、写入边界、git 边界。

**`project-memory`**:同类断言(`*_EVIDENCE_*`、package exit、granularity)标退役。

---

## 2. 第二刀 · hook 与运行时状态

**已确认**:`.claude/` 下只有 `skills`,**无 `settings.json`**——hook 不是通过 Claude 配置挂的,停用不影响 Claude 会话。

停用:
```text
scripts/hooks/pre-tool-compliance
scripts/hooks/post-tool-compliance
```

删除整个运行时状态目录:
```text
.runtime/compliance-control/
```
(内含 `active-package-recovery.json` / `active-package-recovery-receipt.json`——"恢复机制的恢复机制",本身就是复杂度失控的信号。运行时状态,删了不影响源码。)

**执行前实测一条**:`scripts/generate/edge-codegen.mjs:866/885/1009` 读 `.runtime/compliance-control/` 下的路径。删除后跑一次 edge-codegen,确认它走不到那个分支或能优雅跳过。**这是本次唯一需要实测的依赖。**

---

## 3. 第三刀 · 代码(最后,不急)

停用后即死代码,**不读不花钱**。确认无其他门依赖后再删:

| 删 | 行数 |
|---|---|
| `tools/compliance-control/cli.mjs` | 3563 |
| `tools/implementation-design-granularity/cli.mjs` | 2010 |
| `tools/backend-acceptance/impact.mjs` | 1040 |
| `scripts/check/backend-acceptance-change-impact*` | — |
| `scripts/check/per-edit-runner-evidence`、`per-edit-*` 系列 | — |
| `scripts/check/remediation-compliance` | — |

**绝不能删**(是真正跑测试的部分,不是记账):
```text
tools/backend-acceptance/runner.mjs   677
tools/backend-acceptance/lanes.mjs    331
tools/backend-acceptance/workload.mjs 1248
tools/backend-acceptance/cli.mjs      2201  ← 需先剥离其中的 entry/impact 记账逻辑
```

---

## 4. 必须原样保住的(与控制面无关的真门)

```text
scripts/verify → tools/verify-gates/verify.mjs   编译 / 类型 / 测试
ArchUnit 模块边界测试
契约生成链:openapi → 生成物 → 前后端消费
scripts/check/ 下真正在测东西的:frontend-architecture、code-layout 等
```

**这些一个都不要碰。**

---

## 5. 退役后靠什么保证质量

| 原来靠 | 之后靠 |
|---|---|
| evidence 台账 + hash 链 | 编译 / 类型 / 测试(本来就在跑) |
| package entry/exit 六分母对账 | **独立盲审**——本次实测唯一有效 |
| changed-path 授权 | `git diff` 人工过目 |
| 逐控件对账 evidence | **判据自带反例**(见 `2026-08-13-v2s-evidence-denominator-and-falsifiable-criterion-standard-claude.md`) |

**没有失去任何真正抓到过问题的东西。**

---

## 6. backend-acceptance 的收尾(与本退役同批)

- 停止 successor package / entry bundle pointer / P0 重捕的全部工作;旧 package 就地终止,**不要求收口、不补 evidence**;
- 目标缩为唯一一条:**bootstrapOperation 端到端跑通**(真实 HTTP、真实容器、四维出结果、cleanup 通过);
- 已完成资产**全部保留不动**:196 条 scenario 合约、accepted-baseline、known-uncovered 台账、execution contract、10 个模块 testFixtures 骨架;
- known-uncovered **不要求清空**;原详设「台账清空后才退役旧 196 lane」作废,**旧 lane 继续留着**;
- 后续扩覆盖只挑真正需要盯 DB 开销的 operation,一次几条,不做全量。

---

## 7. 交付要求(只要三样,不写长文档)

1. bootstrapOperation 那一条的四维运行结果与 cleanup 结果;
2. 一页纸:当前能力做到哪 / 196 条 scenario 是什么状态 / 下次扩覆盖该改哪个文件;
3. 已知未完成项一句话列表,进 `HANDOFF.md` 欠账。

**不要做**:为本次调整写新详设或 review 请求;补任何 evidence 或 receipt;让旧 package 变成可收口状态;为"为什么改方案"写论证材料。

---

## 8. 授权边界

本文是执行清单,由 Dexter 授权、交 Codex 执行。**Claude 本会话未执行任何删除或停用动作**(写入边界仅限本目录)。文中行数与依赖关系均为本会话只读亲验;`edge-codegen` 那一条需执行者实测确认。
