# 前后台重点代码结构正式需求 · 独立对抗审查第 1 轮

主 agent 保存 readonly reviewer `/root/bf_requirements_blind_r1` 返回的独立结论与 finding。输入清单拆至下列文件；未改变独立 verdict 或计数。子 agent 未写文件。

```text
REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_REQUIREMENTS_20261013
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-13-backend-frontend-structure-requirements-review-inputs-r1-codex.md
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO
M/S/N=0/0/1
L1_ENGINEERING=PASS；N-01 为非阻断来源指针缺项
L2_USER_VISIBLE=PASS（仅需求层：沿现 Journey，不新增或重定页面、权限、动作、文案和承载）
L3_UNVERIFIED=空（本轮没有等待看图或运行才能决定的新 UI 方案）
SAME_ROOT_SCAN=已核对全部14族、R01–17与V01–18；N-01扫描整份正式需求
DESIGN_GAPS=无本需求阶段阻断缺口
TEMPLATE_COVERAGE=见下方逐节适用性表
EVIDENCE_TIER=STATIC_REQUIREMENTS_REVIEW_ONLY
authorMaterialReadAfterIndependentVerdict=false（未读取作者自审或本cycle intake）
```

## 1 · 被审字节与独立性

对象：`doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`。
亲算 SHA-256：`c8603b2a33ac69fb67c12da12059f7609f898eeb7595d9f3d1ed5b40542f1c13`；首次及收口复算一致。
来源分析稿 SHA：`c369a9a82e23fd397359195a7b7e738d3972b9fed3205a69c18f76655b04907c`；TER T1原需求 SHA：`b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`。

`blindReviewDeclaration`：我在 fresh 子 agent 上下文中收到明确输入清单，先尝试证伪被审需求，形成本报告 findings 和 verdict，未读取作者自审或 finding 处置。需求正文和来源分析稿仅作为待审输入；可行性与约束判断重新取自 governing source 和实际源码。本轮没有实现变更，逐点 prewrite/post-proof 留痕检查为 `NOT_APPLICABLE`。

## 2 · 方案与证伪结论

真正任务是减少能力维护中的第二名单、规则副本和分散生命周期。较小替代是只增加注释和边界说明；它无法消除 codec 合法闭集、远控 parser 枚举、图标准入和扩展数组 cast 的实际第二住址。较大替代是整体 DTO/FQCN 迁移、通用 registry 或全部 Service/Page 拆分；它超出当前收益与授权。当前有限问题族、现 owner 内提纯和真实复用方案合理。

- **接受五项建议是否失真**：未成立。D01–05 与分析稿 §7 推荐方向相符。B4/B5 明确“已定方向、本期不执行”，R07/V01/V17/§6一致；B7保留构造接缝，不为少几行new加依赖容器。
- **catalog 提纯会否强迫事务拆分**：未成立。promotion self-call、注解、receipt/readback需要保护；R06/V06不强制Bean拆分。制作差异两实例同义，但列表受限SKU不等于详情全集，R06/V05保留反例。
- **canonical与runtime是否纸面复用**：需求可达。TDS loader持canonical及readUniqueTextArray，codec另有TOPIC_KEYS；binding分类与SQL路由不同，不能一起删。远控生成器已有字段enum到union，扩运行值不需新schema/runner。
- **feature边界会否复制会话或迁走权限**：未成立。更新页有start/stale-end，workspace持Room/end；R09/R11收窄公共接缝/资源owner，宿主提供上下文、资格、焦点。现overlay互斥、独立代次和迟到start清理可保留。
- **generation/menu/status是否误合并**：未成立。foundation guard/cursor可复用；PlatformReadPage已有guard、SalesMenu已有read model，需求保留正例。图标filter确为第二准入；R08保留注册/catalog/授权。lifecycle未知值会返raw，R13要求保留现未知反馈。
- **扩展对象是否改变owner协议**：未成立。十个Drawer/十四operation，generated对象、mapper对象null转显式SET/CLEAR与legacy数组并存，owner拒SET null。R12/V12–13区分wire与owner，保留省略、空提交、DATE、false/0、enabled/required，不删legacy。
- **验收和成本是否失控**：未成立。V01–18有可证伪断言与F/H/L2，具体文件/fixture/CP留后续详设。未实施不是阻断；R17不得解为豁免R-READ-07最终acceptance，正文明确表中F不是全仓豁免。

## 3 · Finding（reviewer 原始结论）

### N-01 · 正式需求没有登记命中的业务语料指针

`status=CONFIRMED`；`需Dexter裁决=否`。

- **需求位置**：被审对象 §4，L140–155；全文检索 `G-0|G-1|CIPG|confirmed-business-language` 无命中。
- **判据事实**：`project-memory/operations/business-corpus-adoption-and-read-policy.md:25–27` 要求跨领域任务文档记录相关 `G-xx/TERM_ID` 和来源。
- **本案实际命中**：G02–04（组织/经营实体）、G05/G05A（准入与写权限）、G08/G09（主数据与合同状态）、G10（双后台）、G11/G12与CIPG01（商品/制作/库存边界）。
- **影响**：当前R01/R06/R08/R11/R13已保护语义，故不是产品缺陷；但后续详设无法从正式需求直接定位这些不得推导边界。
- **最小修正**：§4增加一段corpus路径、上述条目及“只作术语/禁推来源，不授予业务/实施权限”指针；不复制正文，不新增台账。
- **同根范围**：整份§0–7及R01–17均已检索；一个文档级来源缺项，其余条款无同族语义冲突。

## 4 · TEMPLATE_COVERAGE

本对象是正式需求，尚非新Journey、IA、交互工件或implementation-facing详设。

| 模板 | 逐节核对及阶段结论 |
|---|---|
| Journey §1–7（含6.1） | §1元数据/授权、§2任务结果、§4范围禁推、§7裁定有需求对应；§5语料指针N01；§3 actor前提链、§6/6.1新UI工件N/A：不新增Journey/操作，现来源与未来保真义务已声明 |
| IA §1–6（含2.1/2.2/2.1.1） | N/A：不定新IA；R01/R10/R11/R16和V07–14承接保真，详设重列真实影响面 |
| UI §1–10及控件/搜索/roster子节 | N/A：无新线框/动作/文案/看图决定，不把未来L2未跑列本轮L3，不免未来逐控件设计 |
| 详设 §0–1 | 需求层有授权、问题、方案/成本对应；不是详设完成 |
| 详设 §2–3/3a/4–9/9a/9b/10/10b/11/11a/12/13/13b/13c/14 | 当前具体实现槽位N/A：未授权详设/代码；R16闭合未来CP/调用者/住址/测试/第三方，R17/V18实际执行前准入，不要求现在造实施分母或运行证据 |

动作1-B非空：N01、逐节N/A及后续义务；B4/B5延期、B7保留、对象形状和独立身份均有明确边界，无出处新增上限未发现。

## 5 · 完成与授权

独立静态报告已完成，N01不阻断需求接受，交主agent intake/最小修订。原始GO只对应本报告SHA，不是之后修订字节的独立verdict。

本轮未写文件、未运行生成/构建/测试/verify/DEV/H/L2/设备/reset/seed/部署。未来整改、真实UI、业务及cleanup均NOT_RUN；GO只表示需求可接受，不表示实现完成或授权下一阶段。
