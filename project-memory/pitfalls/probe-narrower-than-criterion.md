---
id: pitfalls.probe-narrower-than-criterion
status: active
layer: routed
taskKinds: ["implementation","design","review"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance"]
triggers: ["implementation","review","failure"]
assertions: ["PROBE_MUST_MATCH_CRITERION"]
sourceRefs: ["doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md"]
---

# 用一个窄探针去回答一个宽判据

- **失败模式**:判据是"后台有没有把多个事实拼成字符串返回",而实际执行的探针只是"含中文字面量的 Java `+` 拼接"。探针返回空,就宣布该域干净。
- **实测代价**:同一个判据上连错四次 —— 只扫 `modules/` 漏掉另一个源码根的 416 个文件;只匹配含中文的拼接,漏掉 `code + " " + name` 这种一个中文都没有的;只扫 Java 层,漏掉 SQL 里的 `||` 与 `string_agg`(全角括号的「名称(编码)」正藏在那儿);只列 `+` 与 `String.join`,漏掉 `Collectors.joining` 与 `.reduce((a,b) -> a + sep + b)`。**每一次都得出了"该域零命中"的结论。**
- **叠加陷阱**:本机 `LANG=""`(`LC_CTYPE=C`),**BSD `grep -E '[一-鿿]'` 对 CJK 静默返回 0 命中,不报错**。用它做的"实测"会给出一个看起来正常的空结果。
- **根因**:探针是**实现**,判据是**意图**。探针写窄了不会报错,只会返回空;而空结果与"确实没有"在输出上完全一样。
- **判据**:**写下探针之前,先写下它可能漏掉哪一类,再检查那一类。** 零命中永远先当作探针问题,而不是结论。
- **最小解**:多机制判据必须逐机制列举并各自验证;跨源码根的扫描必须显式列出根;涉及非 ASCII 一律用 locale 无关工具(如 python),不用 BSD grep。
- **与既有条目的关系**:`negative-universal-claim` 要求否定式全称命题穷举后才能写,本条是它的**前置** —— 穷举用的探针本身可能是坏的。
