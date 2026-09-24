# 门店终端管理 · 详设与实施计划 DESIGN 审查记录

REVIEW_CYCLE_ID=TER-DESIGN-20260924-OPTIONAL-CODE；REVIEW_TARGET=DESIGN；REVIEW_ROUND_LIMIT=2；独立 reviewer 均为 fresh subagent、只读，主 agent 只做 finding intake 与修订，未代写独立 verdict。Dexter 2026-09-24 直接新增“创建可手填/留空自动生成激活码、DEV seed 固定码”，构成本 cycle 的实质输入变更；更早一次盲审声明受污染的尝试不计入本 cycle 两轮。

## 独立审查原始结论与输入

| 轮次 / agent | 盲审与最小输入 | reviewer 原始结论 | 主 agent 处置 |
|---|---|---|---|
| 1 / `01a0cee9-5b78-7db2-9cee-cf4bc567b275` | 声明在形成 provisional verdict 前未读需求 §15；读 AGENTS、治理/规范/模板、需求 §0–14、IA/交互/详设/计划、organization/catalog/seed owning source；无写入/运行 | `GO / OKAY`，M/S/N=0/2/2。S-01 手填重复码事务路径未明确；S-02 旧需求与新裁决桥不稳；N-01 acceptance catalog 登记；N-02 型号证据提示 | S-01 `CONFIRMED`：手填与自动共用精确 unique 的 `ON CONFLICT DO NOTHING RETURNING`，零行 409，禁失败事务内重试。S-02 `CONFIRMED`：详设 §0 改为 `ACCEPTED_REQUIREMENT_DELTA`，已接受新口径逐旧条覆盖；保留由需求作者同步原稿的交接。N-01 `ALREADY_COVERED`：计划 CP-05/28 场景已点名 catalog。N-02 `PARTIALLY_CONFIRMED`：硬件型号证据确须 CP-01 核实；reviewer 误以 Brother 是目标型号，现行目标为 Epson/Zebra，Brother 只在交互稿作为撤回错误配对的反例。 |
| 2 / `01a0ceee-d1f8-78f1-a344-c789689c7361` | fresh 只读；声明未读需求 §15 或本 cycle 作者处置正文；读治理/模板/规范、需求 §0–14、四份设计稿与代表 owning source；无写入/运行 | `GO_WITH_UNVERIFIED_UI`，M/S/N=0/0/3；S-01/S-02 与 N-01/N-02 均判 CLOSED。三 Note 为未来激活穷举风险、Brother 负例辨义、L2/testId 尚未动态验证 | N-1 `KNOWN_OUT_OF_SCOPE`：手填弱码已在详设 §0 明示，真实激活和限流不在本期。N-2 `CLOSED`：当前 contract 候选为 Epson/Zebra，Brother 只是错误配对负例。N-3 `NOT_RUN_NOT_AUTHORIZED`：L2 与实现期 UI 检查不得在本 DESIGN 阶段升格为 PASS。 |

完整 reviewer 输出保留在上述 agent id 的任务记录；本文件是主 agent 对原始结论的归档与 intake，不把作者处置冒充新独立 verdict。第二轮后 `ROUND_FINAL_DECISION=SELF_DECIDED`：当前四份工件可以交 Dexter/Claude 做 DESIGN review，**不是实施授权**。

## 作者最后一轮前后文一致性检查

| 核对对象 | 静态结果与边界 |
|---|---|
| 六 IA screen | `TER-P01/C01/C02/E01/A01/M01` 均在 IA 与交互工件中；C02 基本信息选填码、空值自动、E01 无码输入，列表无码而右详情有码。线框原先已接受，新增码控件为 Dexter 直接要求，未声称实现态视觉通过。 |
| 三层激活码语义 | contract：缺席/null/空串=自动、八位 ASCII 数字=手填；owner：手填冲突 409 不换码、自动安全随机并发避撞；DB：集团全状态 unique；幂等：receipt 不存码/可枚举摘要，同键异码读已存码比较；UI：重复原位错；seed：八个固定非生产测试码。 |
| 机制与场景分母 | 详设 §3 固定 18/18 行；计划 §4 独立 scenario 身份 28/28；V-26/27 标非 HTTP；详情、候选和写入共 7 个 operation。此处是静态机械计数，不是动态通过。 |
| seed | `storeTerminals` 新数据集八条 `62000001`..`62000008`；原 `terminalFixtureBoundary` 是邀请到期终态，不混用；四组件后置终端步骤，原 extension host 数 9 不变；`planned/created/readback=8` 和 business/cleanup 均需将来实际证明。 |
| 打印机与场景 | 基本信息→打印机→功能范围；每功能内每场景各自订单类型和无序 printer set；无主备；热敏与标签都依型号已核实允许集选择。Epson/Zebra 三型号矩阵是设计候选，CP-01 厂商证据不足则停，不把静态文档当已生成合同。 |
| 授权与证据 | 本批只写文档与只读审查；业务代码、契约生成、迁移、构建、测试、reset、DEV、seed、Browser L2、UAT、部署均未运行/未获本轮授权。 |

`SELF_DECIDED=GO_FOR_EXTERNAL_DESIGN_REVIEW`；`IMPLEMENTATION_AUTHORITY=false`；`DYNAMIC_EVIDENCE=NOT_RUN/NOT_AUTHORIZED`。Claude 需求正本 §§0–14 仍有被 Dexter 新指示覆盖的旧语句，review 应以详设 §0 已接受增量表逐项对撞；原稿由其作者决定同步，不能让旧句直接驱动实施。
