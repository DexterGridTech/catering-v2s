# 阶段 A DESIGN R1 输入清单

REVIEW_CYCLE_ID=TER-UPDATE-A-DESIGN-20261006
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/update_design_r1
BLIND_REVIEW=true

本文件由主agent转录独立reviewer返回的读取清单；reviewer只读，未写文件、未运行动态验证、未读取.runtime。作者历史intake没有进入盲审预期形成阶段。

## 完整输入

- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md。
- 正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 与讨论稿 `doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`。
- 下表六个目标文件全文。
- project-memory/index.md全部六kernel、deterministic-context-only，query/recall六维命中22篇原文；适用sourceRefs包括终端编码/第三方/verification/authorization/logging/service-shape及终端build/skeleton条款。
- cs-review、cs-memory-recall；review-standard、implementation-task-template、frontend-coding-standard、foundation-charter、terminal-coding-standard、third-party-library-usage-standard。
- Journey/IA/UI/implementation-design四模板全文。
- doc/decisions顶层130项标题/首标题清点；适用治理、服务形态、方案合理性、验证、协作/授权、corpus、前端搬运、独立review、失败抽象、日志、roadmap退役、终端第三方决定原文。
- 当前platform-ports/runtime/state/3类reset路径、application/base/android/两App、integration assembly、automation agent/driver/fixtures源码；installed Expo/RN源码、官方公开Host接缝。

## R1 目标字节

| 文件 | SHA-256 |
| --- | --- |
| 详设 | 33a4116cb57c1325ea694b65ee8ddbf0a8d83be431c4cd240e515e21f04c9a6e |
| 计划 | 53692100dd437d4c55451622f311daad5ee035d31fc70bb87c304dec1843e5ea |
| 附件 | 27c9e10856a7b148621000387be8538d47a5bcdf864e43d360e9005fd907c34a |
| IA | 85f258cbc142e5d726963096e0a17bd738efd4f53c2c8c0cb49c06b71e8af6e9 |
| Journey | 9e4642f5677a19c9df86b83eb721a7a77cd6078caf37d48314bfeaa8aed2be43 |
| UI交互 | a3b192a27fe605c003eb7e6c34e6672767c0424445bfc55296ba44f66bf6e427 |

六文件均为同日2026-10-06，路径在当前intake完整列出。上述SHA仅对应R1旧字节，不等于修订后输入。
