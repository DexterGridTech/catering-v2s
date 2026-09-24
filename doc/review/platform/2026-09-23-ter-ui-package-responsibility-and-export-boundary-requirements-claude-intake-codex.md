# TER UI 公共导出需求 Claude finding 逐条回源处置

REVIEW_SOURCE=doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-review-claude.md
REVIEW_TARGET=DESIGN
SOURCE_VERDICT=NO-GO,M/S/N=0/3/2
AUTHOR_INTAKE=SOURCE_VERIFIED_NOT_INDEPENDENT_VERDICT
EVIDENCE_TIER=STATIC_SOURCE_READING
IMPLEMENTATION_AUTHORITY=false

本记录是作者对上一轮 Claude finding 的回源处置，不是本轮详设/计划的独立 verdict。先看正本需求、标准和当前源码，再确定是否采纳；本轮没有修改生产源码、测试或构建产物，也没有运行动态验证。

| Finding | 核验结论与反例边界 | 需求修订落点 | 详设/计划防再犯 |
| --- | --- | --- | --- |
| S-1 MemberForm 探针 | `PARTIALLY_CONFIRMED`：键盘需求 v2 §2.1 与键盘详设 §6.2 明定 alpha/financial 是 MemberForm 的 sample-only 验证入口，原稿说“不足以判断产品意图”错误；双端 MemberForm 与 `useMemberForm` 当前保留探针且不进入会员 payload。但 financial 还有 `ui/base/admin-shell` 主机地址消费者，不能称“唯一”；v2 要求的区域标题当前双端未见，属另一个既有差异。 | §3.4 改成已知 v2 意图、跨批动态入口和本批保留；区域标题差异 OPEN，不擅自扩成本批 UI 实施。 | 详设 §6/§8，计划 §4：fieldId/testID、payload 与双端原样不回退，错改会红；标题不伪称 PASS。 |
| S-2 旧计划冲突 | `PARTIALLY_CONFIRMED`：旧计划第 97/231/350 行有无残留/无生产命中判据，本稿必须阻止其被当成“零命中即可删”；但旧计划第 360–362 行已有真实外部消费者时停止交 Dexter 的条款，并非完全无保护。当前 wallpaper-picker 根 `parts` 与 factory 仍在，无法据此判定旧计划未做还是有意保留。 | §1、§7 Q5 明列两份判据关系：逐符号消费者归因前置，外部未知 OPEN；Q5 由 Dexter 在详设 review 决定并入 CP-3/CP-5 或另立，不并行执行互斥规则。 | 详设 §2、计划 §1/§2 精确限定旧计划第 97/231/350/360–362 行；CP-0 不先删。 |
| S-3 非根 CSS 与 Android 消费 | `CONFIRMED`：两 integration `package.json exports` 有 `./theme/global.css`，各自 Android `App.tsx` 与 `metro.config.js` 真消费；当前两个 invariant 只列 root `publicExports`。两个 Android `src/dependencies.ts` 也消费 integration `moduleName`，原需求列表遗漏。 | §3.1/§3.3/R-3/R-7/§6 写全 root + export-map path、CSS invariant 缺口和 Android 宿主集合。 | 详设 §3/§4.6/§5.1，计划 §3：五包 `publicExportPaths`，宿主 AST/path 断言与 typecheck，改错应红。 |
| N-1 wallpaper-picker 全量分母 | `PARTIALLY_CONFIRMED`：根 `src/index.ts` 确有 16 个命名符号，原稿仅聚焦两个平行入口不够；但 `createSampleWallpaperPickerModule` 的本包测试是直连内部实现文件，不能算根 API 测试消费者。 | §3.2 列全 16 项，并区分根入口与深路径；无仓内消费者不等于删除授权。 | 详设 §4.3 每符号一行，§3 分类口径与外部 OPEN；计划 CP-0 重算。 |
| N-2 dismissal helper | `PARTIALLY_CONFIRMED`：三份 feature helper 确实注入 dispatcher 后发 feature command；TR-01 的 `dispatchAction` ledger 反例不能直接套用，因为 TR-01 明许任意位置发 `dispatchCommand`。但 TR-06 末段、§7.1 对 foundations 纯度有张力；现有 `ui/base/render/src/foundations/dispatchWithRequestId.ts` 同形发 command，必须同根核对。 | §3.4/R-9 收窄为目录/标准一致性问题，不直接移入 base 或宣称 TR-01 违规。 | 详设 §7 默认不处理这三份非 root helper；若 Dexter 另授权，先统一核对 base 与三 feature，再选最小纯化，不上收 feature command。 |

通用失败模式：把“仓内未搜到根 import”混同“仓外无消费者”，把文件深路径使用混同 package API 使用，把状态/目录标准的一条规则脱离其反例套用，以及把旧计划完成检查误读为删除准入。有限适用范围是这五个 TER UI 包的 public surface 与当前三份 dismissal helper；反例是 Android CSS 非根子路径、`moduleName` 依赖声明、admin-shell financial 消费和 base 的注入式 command 派发。最小防再犯办法是：逐符号和逐路径分母、外部 OPEN、正反例并列、原子五方合同与会失败的 consumer-side/行为断言。除此不新造全仓通用门。
