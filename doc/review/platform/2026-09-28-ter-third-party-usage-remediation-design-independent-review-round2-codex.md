# TER 第三方库整改详设与计划：独立盲审第 2 轮

```text
REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-V3-3-2026-09-28
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=Herschel
reviewerInputChecklist=doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-checklist-v3.3-round2-codex.md
blindReviewDeclaration=先独立形成 findings/verdict，再回读 Round 1 作者处置并比较
authorMaterialReadAfterIndependentVerdict=true
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=GO
M/S/N=0/0/0
EVIDENCE_TIER=只读设计/源码复核；未实施、安装、构建、测试、Web、Android、VM 或设备操作
```

## 独立结论

未发现可执行的 DESIGN blocker。Round 2 reviewer 先依据清单尝试证伪当前需求、详设和计划，形成 verdict 后再打开 Round 1 处置记录；确认 Round 1 四项 finding 已由当前文档解决，并复核了 Dexter 对动态 serial 的补充。

| 核验项 | 独立核验事实 | 结论 |
|---|---|---|
| 虚拟机动态身份与 serial | 当前 runner 仍有旧 serial 默认值；实施计划要求每次从 `adb devices -l` 发现设备，以 AVD/物理身份和实时显示形态唯一绑定角色，显式传入当次 serial，禁止列表顺序/编号推测，身份或形态歧义 fail closed。实施时须删除 runner 内置 fallback。 | PASS；用户补充已落实为计划硬约束 |
| 数据清理边界 | 当前 stage-1 `coldLaunch` 执行 `pm clear`；本批无设备数据清除授权。计划要求 CP-A 删除并以 focused/static 调用图断言禁止 `pm clear`、`pm uninstall -k` 或等价擦除，产品路径无法准备状态时保持 OPEN。 | PASS；风险与实施前置条件清晰 |
| TP-A7 heartbeat | owning source 中 NanoWSD control ping/onPong 与 transport JSON heartbeat 是两套机制。设计/计划分开记录两类计数，限定日志不含 payload/地址，要求生产 timeout 至少 3×的 UI-idle 期间两类心跳前进、非 heartbeat text-frame 为零且无连接 churn。 | PASS；3×生产 timeout 的设备判据与 JVM 判据分离 |
| TP-A7/A9 JVM 真 socket | 计划经生产 `TerminalTopologyHostRegistry.start` 和真实 loopback WebSocket socket，读取生产 JSON timeout，列出半开、20 次连接/断开及线程基线回收判据；明确 VM 验收不取代 JVM proof。 | PASS |
| TP-A8 Journey 分母及拓扑全集 | 计划冻结 `runMemberJourney` 的全部 18 个 labels 并要求 exact-set focused guard；T1–T5 保留配对、恢复、解除配对与同步场景，两台单机单屏 laptop VM 在 JVM gates 后执行。 | PASS |
| 批次授权边界 | 当前文档明确为 DESIGN；设备动态验收仍是计划目标而非已运行证据；两阶段验收与 Web-first、cleanup 分档、不得清数据等边界清楚。 | PASS |

## Round 1 逐项比较

M-1（TP-A7 两机观察 oracle）、M-2（runner 清数据）、S-1（18 个 Journey labels）、S-2（生产 Registry/真 socket/线程基线）均已在 Round 1 处置记录中标为 `CONFIRMED`；本轮 reviewer 对照当前字节确认对应验收要求已写入详设与计划。详见 [Round 1 处置](2026-09-28-ter-third-party-usage-remediation-design-independent-review-round1-codex.md)。

## Round 2 final decision

`ROUND_FINAL_DECISION=SELF_DECIDED`。这是该 DESIGN cycle 第 2 轮；按治理规则硬停止，不派第三轮。此 GO 仅表示详设与计划具备交 Dexter/Claude 评审的条件，不授权实施。设备、业务、Web、Android、虚拟机及动态验证全部仍未运行。
