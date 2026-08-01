---
title: 独立子 agent 对抗审查治理修订 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
reviewTargetSha256: 112f4215df6e2624(前 16 位,全文哈希已复算)
reviewer: Claude
createdAt: 2026-07-25
---

# 独立子 agent 对抗审查治理修订 Claude 独立评审

## 结论

```text
VERDICT=GO
M=0  S=0  N=1
```

规则完整、落点齐全、机械边界干净、生效边界诚实。对 Dexter 原始要求的四点核验全部成立,且 decision 有三处高于要求的正确强化。

## 亲验记录

1. **fresh/盲审/先证伪**:decision §2 明确 fresh 上下文、不读作者材料直至独立 verdict、证伪立场措辞;`SELF_DECIDED` 所有权移交第二轮 reviewer(强化点一);作者角色收窄为供料+intake+处置。✔
2. **六类最小输入缺一即无效**:decision §2 六项与模板逐行对应(kernel 全读、六维 recall 逐条打开、corpus 命中或 `NO_CORPUS_ENTRY_MATCHED`+检索词——强化点二、上游冻结输入、decisions 标题复核、matrix checklist+验证治理);模板要求每轮一份 immutable 清单,状态枚举(READ_ALL/RUN/TITLES_REVIEWED)明确。✔
3. **留痕与机械边界**:四个 review 字段+清单 path/hash+文件存在性由 checker 校验(`INDEPENDENT_SUBAGENT_POLICY_INVALID`/`REVIEWER_KIND_NOT_INDEPENDENT_SUBAGENT` 等);decision §3 明令 checker 不读清单正文、不判独立性、不裁语义;"旧产物不得事后补字段伪造独立性"(强化点三)。fresh self-test PASS 含两条新红;**生产变异亲验**:scratchpad 中废掉 reviewerKind 校验 → self-test 以 `SELF_TEST_RED_DID_NOT_FAIL:REVIEWER_KIND_NOT_INDEPENDENT_SUBAGENT` 精确失败。✔
4. **落点八处齐**:governance decision、输入清单模板、batch-1 §3/§4/§8、policy §10、cs-spec-to-plan、cs-writing-plans、AGENTS(两段完整硬约束)、scripts/README;memory 三件(routed decision 四断言、kernel/04 两断言、required-inventory 路由,`project-memory` 门 PASS);ledger L66 更正为"恢复 v2 原强度"并注 NEXT_REVIEW_CYCLE。✔
5. **生效边界**:`effectiveFrom=NEXT_REVIEW_CYCLE`;Roadmap 现况 `LAST_CLOSED_STEP=R3 / CURRENT_STEP=R4 IN_REVIEW / R4_IMPLEMENTATION_AUTHORIZED=false`——R3 已收口未被重开,R4 design cycle(旧规则下完成)按 decision §4 免于追溯,未来 R4 IMPLEMENTATION cycle 起用新规。CLAUDE.md 无需改动(我的外部 review 职责不变,不替代子 agent 审查已在 decision/README 载明)。✔

## Finding

### N-1:最小输入第 5 项的 decisions 复核范围限定"当日",应放宽为全目录标题

decision §2-5 与模板均写"`doc/decisions/` **当日**相关 decision 的全列表逐标题复核"。相关 decision 未必同日(结构裁决、语料裁决可能早于被审对象数日);而全目录标题列表的成本只是一次 `ls`。今日实施评审的三重误报正是"目录未穷举"类失效。**最小修复**:两处改为"`doc/decisions/` 全目录标题列表逐条过一遍,相关项打开全文"。不需 Dexter 裁决。

## 授权边界

本 GO 仅确认治理修订可交 Dexter 接受(decision status 随接受由 `DEXTER_DIRECTIVE_PENDING_CLAUDE_REVIEW` 转 ACCEPTED);不授权业务、契约、数据库、应用、运行、测试或任何 R4 implementation,不重开既有收口 cycle。Git 归 Dexter。
