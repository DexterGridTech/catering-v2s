# TER 主副机共享终端凭证需求变更稿：R1 finding intake

REVIEW_CYCLE_ID=TER_SHARED_TERMINAL_CREDENTIAL_CHANGE_2026-10-10  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
INTAKE_OWNER=MAIN_AGENT

## N-1 — R-13/R-15 引用

- **Disposition：** `CONFIRMED`。
- **Finding：** R1 复核指出，提案两处将主机实际版本报告边界标成 R-13。主 agent 重新打开正式需求后确认，R-15 才是主机实际版本、最近状态与后台读取；阶段 C 详设的当前报告边界也引用 R-15。
- **证据：** `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 第 224、236、321 行；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md` 第 18 行；修订前提案第 52、89 行。
- **最小修正：** 提案中的两处 R-13 改为 R-15，未调整产品行为或授权范围。
- **修正后检查：** 对提案检索 `R-13`、`R-15` 与 `terminalReadServicePointArea`；报告编号已一致，九个只读 operation 清单无重复项。
- **验证边界：** 仅静态文档核验；不代表阶段 C 详设、计划或源码已修改/实现。

## 主 agent 结论

提案按 R1 注记完成更正，进入第二轮定向独立复核。`cancelTerminalActivation` 的调用端资格继续作为给 Claude 修订正式阶段 C 设计时必须闭合的显式问题；没有据此扩展业务授权。

