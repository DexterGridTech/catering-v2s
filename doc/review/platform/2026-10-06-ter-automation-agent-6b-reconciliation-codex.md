# TER automation-agent 全批 6b 三维对账

## 范围

全批 CP-01～CP-06 已分别完成后的批次级独立检查。核对维度为：正式需求及 Dexter 当前指派、详设/Journey/IA/交互工件与实施计划、项目记忆和治理规范；并确认实施证据与该设计范围一致。6b 是独立的整批检查，不由 CP verdict 汇总替代。

重点差量：本轮术语统一为“界面自动化定位标识（TestId）”；`ui.base.dev-host:test-expo` locator-prefix 修复及几何/F4 runner 调用点同步；CP-04 当前字节四个受管主旅途和 console 的 `DEV-DATA-01` selector/readback/restore 证据。业务 `brandId` 未改。

已适用的独立 CP 结论：CP-01 MATCHED、CP-02 MATCHED、CP-03 MATCHED、CP-04 MATCHED、CP-05 MATCHED、CP-06 MATCHED。各 CP 原始对账记录保留在本目录；本文件不以汇总代替全批重核。

## 独立复核要求

Fresh reviewer 只读重开当前需求、设计输入、计划、项目记忆路由原文、当前实现和证据；逐项检查完整批准范围与排除项，尤其确认 CP 内逐点双读/focused proof、Web→Android 顺序、最终 locator 归属、fixture 与 cleanup、未运行范围标注。不得运行命令、修改文件或把历史/计划结果升级为当前 PASS。结论仅 `MATCHED` 或 `OPEN`；列明任何 OPEN 的具体原文、实现/证据位置及最小修正。

## 独立结论

第一次 fresh 全批 reviewer `/root/ter_automation_6b_final` 给出 `OPEN`：旧 Web console `age=37` 主旅途运行早于 runner 源最后修改。该影响项已在当前字节重新运行，run ID `c32f4ee9-e7e5-4c77-a73f-3af21e4ed58d`，`business=PASS`、`cleanup=PASS`，并通过 TDP selector/readback/restore。详情见 CP-04 proof log 与阶段记录。

## 修复后 fresh 复查

fresh reviewer `/root/ter_automation_6b_delta` 只读重开当前需求、设计/Journey/IA、计划、记忆规范、六个 CP 记录及必要运行证据，结论：`MATCHED`。

核验范围与关键证据：

- CP-01～CP-06 各自均有 fresh 独立 `MATCHED` 记录；本轮 reviewer 仍重新核了全批跨阶段关系，没有用 CP 汇总替代 6b。
- CP-04 Web console 主旅途当前字节复验：`c32f4ee9-e7e5-4c77-a73f-3af21e4ed58d`，Business PASS、cleanup PASS，含 `DEV-DATA-01` selector/readback/restore。
- CP-03 F-4a 当前字节复验：`be56cf2e-02fb-4540-9a87-47c7f5ca7f13`，Business PASS、cleanup PASS，视觉差异像素为 0；同根 owner TestId 引用的 driver 单测/typecheck 通过。
- F-4b Android 与 geometry 当前字节动态结果按已批准范围记为 `NOT_RUN`；未使用其历史 run 声称当前字节通过。
- reviewer 未发现当前批准动态范围下阻断 6b 的缺口。此 6b 不代替最终动态清单、13c、整批 IMPLEMENTATION review。
