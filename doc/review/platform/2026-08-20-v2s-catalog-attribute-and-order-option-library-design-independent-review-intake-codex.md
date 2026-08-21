# 商品属性库、点单选项库与两步新建设计：独立盲审 intake

```text
REVIEW_CYCLE_ID=CATLIB-DESIGN-20260820
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEW_INPUT=正式需求、Journey、UI interaction、IA、implementation-facing design、serial plan、模板、project-memory、owning source
```

## 第 1 轮 findings 的来源级处置

| finding | 处置 | 亲验结论与文档动作 |
| --- | --- | --- |
| M-1：四类集合无规模/1,000 行为 | `CONFIRMED` → 已修复 | IA 分别写库定义、商品属性赋值、商品组选项配置的清库后今天量级、增长驱动、1,000 行行为；定义库 501 typed reject。 |
| S-1：501 problem 名称不一致 | `CONFIRMED` → 已修复 | 统一为 `CATALOG_DEFINITION_LIMIT_EXCEEDED`，写入 IA、详设及 acceptance。 |
| S-2：IA 不可见维度不是观察 | `CONFIRMED` → 已修复 | IA §3.1 为九个 IA-ID × 五个不可见维度补静态/focused/acceptance 的可证伪观察。 |
| S-3：mutation 分母不可逐 variant 对账 | `CONFIRMED` → 已修复 | 交互 §4.2 逐行列 11 个真实 command variant。 |
| S-4：operation/acceptance 合并表达 | `CONFIRMED` → 已修复 | 详设 §5 逐 route 写 operationId、path、face、shape 与 scenario；§11 逐 scenario 写四要素。 |
| S-5：整组删除与单值删除未区分 | `CONFIRMED` → 第2轮继续发现交互矛盾 | 先区分 group delete 与 child deletion；第2轮按已接受 UI 的 aggregate save 语义收敛。 |
| N-1：错误表列不足 | `CONFIRMED` → 已修复 | IA §4 补齐 problem code/HTTP/规则/触发界面-owner/可见处理。 |

## 第 2 轮 finding 的来源级处置

| finding | 处置 | 证据与动作 |
| --- | --- | --- |
| S-1：单值即时 DELETE 与定义整体保存矛盾 | `CONFIRMED` → 已修复 | 已接受交互工件规定“待删除可选项经影响确认后随完整集合保存”；故删除单值收敛为 `updateOperationsCatalogOrderOptionDefinition` 的 aggregate 差集，移除独立 child DELETE route/command。catalog 清该值 override，inventory public command 在同一 REQUIRED 清对应 BOM；同组其他值保留。 |
| N-1：typed problem 数量自证为5但表有6行 | `CONFIRMED` → 已修复 | IA 完成块改为 `TYPED_PROBLEMS=6`。 |

## 结果与证据边界

```text
INDEPENDENT_VERDICT_ROUND_1=NO_GO（M=1,S=5,N=1）
INDEPENDENT_VERDICT_ROUND_2=GO_WITH_UNVERIFIED_UI（M=0,S=1,N=1；修复前）
AUTHOR_INTAKE=第2轮S-1与N-1均已按来源修复；轮次上限已到，不发起第3轮。
STATIC_DESIGN_STATUS=READY_FOR_CLAUDE_DESIGN_REVIEW
L2/L3=未授权、未执行；不以静态设计或 focused 设计冒充 UI/HTTP/runtime 证明。
```
