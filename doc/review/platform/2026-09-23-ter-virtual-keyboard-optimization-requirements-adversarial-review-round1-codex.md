# TER 虚拟键盘正式需求：独立对抗审查第一轮

> 本文件由主 agent 原样转录独立 reviewer `01a0cd91-172b-7553-bbc2-268a85f55529` 的结论要点；主 agent 未代写 verdict。被审需求字节 SHA-256：`e7dafd1d5d17fb0a36b1e628b4c9221fb31fc3cc5ff27bb85542bcd10125a7a7`。

## 独立 verdict

```text
REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_REQUIREMENTS_2026-09-23
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
authorMaterialReadAfterIndependentVerdict=false
ACTION_1_VARIANT=1-B
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS_AS_REQUIREMENTS_ONLY
L3_UNVERIFIED=原始 Dexter 会话措辞无法从文件独立重开；Web/Android/device 未运行；后续 IA、详设和代码不在本轮范围
SAME_ROOT_SCAN=旧键盘 v2/2026-09-19 IA 的宽度、CAPS、布局流冲突已在需求 §8 显式替代
DESIGN_GAPS=无阻断项；具体键位排布、交互和实现属于下一阶段
EVIDENCE_TIER=STATIC_SOURCE_REVIEW + REQUIREMENTS_DOC_REVIEW
```

reviewer 的结论是需求已具备进入下一设计阶段的可执行性，未发现 M/S/N finding；其独立反例覆盖 full URL 符号、PIN 覆盖避让、同／异键盘切换。此为静态需求 verdict，绝不是运行或视觉验收。

## reviewer 输入清单和盲审声明

- 仓库入口：`AGENTS.md@6e67d157`、`CLAUDE.md@f08b1fc1`、`PLATFORM-BLUEPRINT.md@19ad1833`、`doc/platform/README.md@b978e9cf`、`doc/platform/roadmap-program-registry.json@f3e232d2`、所选 Roadmap 授权字段 `@a0adbccd`。
- 正本：正式需求 `@e7dafd1d`、分析稿 `@2e9ab881`、2026-09-06 键盘视觉 v2 `@f2f4868c`、输入 surface 需求 `@cb38b009`、2026-09-19 视觉详设 `@67558141`。
- 治理：`doc/platform/review-standard.md@6e12ca56`、独立审查治理 `@bb6b0225`、输入清单模板 `@1150f291`；六份 project-memory kernel、确定性上下文决策和路由命中的 36 条 memory 均已读取。reviewer 报告路由 stdout 截断，后从 index.json 复算。
- owning source：`keyboardHeight.ts@083f5a63`、`InputKeyboard.tsx@69e4c8fe`、`VirtualKeyboard.tsx@2ff3a3b3`、`keyboardLayout.ts@cabf7a5f`、`editText.ts@e531a0fc`、`InputSurfaceFrame.tsx@8b7296cd`、`InputScrollArea.tsx@f6eeda27`。
- business corpus 搜索结果：`NO_CORPUS_ENTRY_MATCHED`，未发现键盘专属业务条目。reviewer 在形成独立 verdict 前未读取作者处置材料；未写文件、未运行测试／设备。

## 主 agent 的独立补充核验（不冒充 reviewer finding）

第一轮结论是 `M/S/N=0/0/0`。并行源码只读核验随后发现几处易在详设阶段被误读的边界：`field` placement 当前只在公共分支和测试使用，其宿主宽度不同于 surface；现有 `editText` 在 maxLength 阻止插入时仍清除 Shift；`dismissActiveField` 对非 business 焦点 scope 提前返回；旧 2026-09-05 输入需求也明确写了收缩模型。主 agent 将回源核验并在正式需求中澄清，第二轮由 fresh reviewer 独立验证，不能把这些说成第一轮 reviewer 已发现。
