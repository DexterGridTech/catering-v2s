---
id: operations.terminal-coding-standard
title: 终端编码规范的唯一内容源在 doc/platform，别处只放指针
type: operation
status: active
layer: routed
scope: every TER (apps/terminal) design, implementation, review, and standards change
createdAt: 2026-08-29
taskKinds: ["design","implementation","review","testing"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform","frontend-platform"]
impacts: ["governance","architecture"]
triggers: ["task-start","implementation","review"]
assertions: ["TERMINAL_STANDARD_SINGLE_SOURCE","TERMINAL_STANDARD_POINTERS_ONLY","TERMINAL_HARD_RULES_NUMBERING_STABLE","TERMINAL_TRIPLE_NAMING_DERIVED","TERMINAL_PORT_REGISTRY_WITH_DEFAULTS","TERMINAL_EVERY_PACKAGE_HAS_CHINESE_README","TERMINAL_WEB_FIRST_DEVICE_PARITY","TERMINAL_INPUT_VIRTUAL_KEYBOARD_USAGE"]
sourceRefs: ["doc/platform/terminal-coding-standard.md"]
---

# 终端编码规范

- `TERMINAL_STANDARD_SINGLE_SOURCE`：唯一内容源是
  [`doc/platform/terminal-coding-standard.md`](../../doc/platform/terminal-coding-standard.md)。
  新增或修改规则**只改那一处**。
- `TERMINAL_STANDARD_POINTERS_ONLY`：项目记忆、skill、评审文档**只写"见正本"**，不复述规则内容。
  通用工作纪律（`currentData`/`isFetching`、`initiate` 义务、同一事实一个住址、幂等键、
  否定式全称命题、finding 带业务场景、动笔前查五处）由正本 §0 指针引用前端规范，同样不复述。
- `TERMINAL_HARD_RULES_NUMBERING_STABLE`：硬规则**编号只增不改**，`TR-01` 起（门的名字、红夹具、
  review checklist 都引用该编号）。⚠️ **条数不在此处复述** —— 2026-09-02 加 `TR-11` 时，
  这里写死的「十条」与正本标题里的数量一起使路由失败。**要查有几条、各是什么，去读正本**：
  reducer 只能 actor 调用 · 「什么都没做」不得返回成功 · 跨包读只走 selector ·
  持久化必须有正反双断言重启测试 · 端口禁 `Record<string,unknown>`/`any` ·
  foundations 不得触达 store/网络/平台 API · 集合先声明形态 ·
  调试面编译期剔除 · 包的 owner/toolkit 归属与 slice 命名 · **每个包必须有中文 README**。
  ⚠️ **本条只列规则标题，不复述内容** —— 规则细节（含骨架阶段的 `plannedKind` 例外）
  一律以正本为准，避免记忆随规范漂移。
- `TERMINAL_TRIPLE_NAMING_DERIVED`：目录路径 → `moduleName`（点连）→ npm 包名（连字符 + scope）
  三者互相可推导；包名禁版本号与框架名；依赖门必须有**方向**与**声明完整性**两条断言。
- `TERMINAL_PORT_REGISTRY_WITH_DEFAULTS`：`PlatformPorts` 无可选字段；
  没人注册就用**声明处自带的零依赖默认实例**；默认分「可用」与「不可用（typed 能力不可用）」两类；
  **不得为了让 web 像真机而给默认实现加戏**。
- `TERMINAL_EVERY_PACKAGE_HAS_CHINESE_README`（`TR-10`）：`apps/terminal/**` 下**每一个 workspace 包**
  在实施收口时必须交付包根 `README.md`，**中文**，至少覆盖**定位 / 作用 / 结构 / 用法**四项，
  并有「在这个包上迭代时」一节。**这是所有 TER 包的长期要求，不是某一批的临时动作。**
  ⚠️ 判据不是"文件存在"：**README 与源码不一致按 finding 处理**，包 review 必须实际读它并对照公开面。
  细则与反例见正本 `TR-10`；已落地范例是 `apps/terminal/kernel/base/contracts/README.md`。
- `TERMINAL_WEB_FIRST_DEVICE_PARITY`（`TR-16`，Dexter 2026-09-24）：被测行为不涉及 adapter 的功能，
  **先在 integration 的 Expo Web 验证通过，再到虚拟机或真机跑 assembly，并用同一份场景清单证明两端表现一致**。
  写实施计划、做动态验证、做实施评审时都要回读正本 `TR-16`；判定范围、证据要求与反例只以正本为准，本条不复述。
- `TERMINAL_INPUT_VIRTUAL_KEYBOARD_USAGE`（`TR-17`，Dexter 2026-09-24）：TER 输入与程序虚拟键盘的
  owner、承载、滚动祖先、一次测量、布局正本、Shift/URL 语义、覆盖动画、性能和验证顺序只按正本
  `TR-17`；本记忆不复述规则，后续 agent 必须在处理任何 TER virtual field 前回读该节及
  `apps/terminal/ui/base/input/README.md`。
