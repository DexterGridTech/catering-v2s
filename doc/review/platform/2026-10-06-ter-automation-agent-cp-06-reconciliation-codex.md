# TER automation-agent CP-06 当前字节对账

## 范围

CP-06「skill、规范、最后退役」，依据正式需求 R-15/R-16/R-18、详设 §4.6/§9a.1 与实施计划 CP-06。检查 skill 当前字节与实际受管入口一致、旧 UI runner 退役、规范/记忆同步、remaining checker 与 cleanup。

## 当前 proof

详见 [`2026-10-06-ter-automation-agent-cp-06-proof.log`](2026-10-06-ter-automation-agent-cp-06-proof.log)。此前 fresh review 曾判 OPEN：缺少 R-18 fresh skill-only transcript/equality artifact 与独立 CP-06 记录。之后发现 skill 命令没有写出真实 Node 调用形式；路径不存在和 `.mjs` 不可执行两次 launch failure 已保留，skill 与计划改为 `node ./scripts/test/terminal-automation.mjs`，没有改变 runner 权限位。

Fresh skill-only reviewer 先转录当前 skill，再检查本批两条 skill-run manifest/log：Web 与 Android 的参数、业务 PASS、cleanup PASS、TDP selector/readback/restore 标记均与转录内容相符；Android 使用显式 `emulator-5560`，该设备在紧邻启动前的清单中是唯一 phone emulator。

## 独立 CP-06 复核结论

- Reviewer：`/root/ter_automation_cp06`，fresh、只读；未运行命令、未修改文件。
- 结论：`CP-06=MATCHED`。
- reviewer 核实了当前 skill-only transcript 及同一 reviewer 的 post-run equality check；Web/Android skill manifest 参数与命令模板一致，business 与 cleanup PASS，Android serial 明确为 `emulator-5560`。
- reviewer 同时复核了 skill/plan 命令调用修正、两次保留的失败启动记录、旧 runner 静态退役门及红例、规范/README/memory/HANDOFF 同步。唯一证据限制是原始 `adb devices -l` 文本未作为独立文件归档；cp-06 proof log 记录了紧邻运行前的选择依据，manifest/log 绑定所用 serial。该限制不构成 CP-06 OPEN。
