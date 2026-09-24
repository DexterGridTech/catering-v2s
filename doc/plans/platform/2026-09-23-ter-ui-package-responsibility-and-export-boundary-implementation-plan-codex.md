# TER UI 包职责与公共导出边界实施计划

DOCUMENT_KIND=IMPLEMENTATION_PLAN
STATUS=IMPLEMENTATION_AUTHORIZED_BY_DEXTER
REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_DESIGN_20260923
REVIEW_TARGET=DESIGN
REQUIREMENTS=doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md
DESIGN=doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md
DESIGN_DIAGNOSTIC_REVIEW=GO
INDEPENDENT_REVIEW_ADMISSION=NOT_RESTORED
IMPLEMENTATION_AUTHORITY=DEXTER_EXPLICIT_2026-09-23
EVIDENCE_TIER=IMPLEMENTATION_IN_PROGRESS

## 1. 授权、目标与旧计划关系

Dexter 已授权按 CP-0 至 CP-4 实施非收窄公共契约补强、静态/focused 验证，以及单机双屏与 mobile 两类设备动态回归。授权不包含任何未获逐项裁定的 root export 收窄；登录、keyboard、power、业务语义与 UI 形态均不变。本轮只按用户指定的两类设备验证两个 Android app，不启动 Web/Metro 或其他设备类别。71 个根符号与 7 个 export-map path 是待 CP-0 从当前字节重算的基线，不以本文数字代替。

本详设是旧计划 CP-3/CP-5 public-surface 条款的当前执行澄清。Q5 与所有仓外消费者仍为 `OPEN`，本批不处理任何逐项收窄；旧计划第 97、231、350 行不得独立触发对本批五包的导出删除。旧计划第 360–362 行原条件是“如果确有外部消费者，先停止并把消费者、owner 和最小替代交 Dexter”；本计划前移并收紧为“未证明仓外消费者不存在即保持 OPEN、不得收窄”。不让两份计划对同一符号并行给出相反命令。

## 2. 交付顺序与责任边界

未来实施时，主 agent 唯一写入代码/测试/文档；fresh 子 agent 只读对账/审查；Dexter 决定产品、外部消费者与 Git。每项写入前重开原需求或 IA、六维项目 memory 命中的全部原文、owning source、适用详设和可复用能力；focused proof 后用同组原文逐项回读。任何冲突以当前字节为待核事实，不能让评审话术替代源码。

| 顺序 | 动作与精确落点 | 完成判据 / 可失败条件 |
| --- | --- | --- |
| CP-0 | 重算五包 `src/index.ts`、`package.json exports`、根导入与文件消费者；核对详设 §4 每行；不作 Q5/仓外逐项裁定 | 当前字节逐符号消费者矩阵完整，71 root/7 path 实际分母复算一致；任一类别缺失或将内部深路径误算 root 即 `OPEN`。Q5/仓外消费者仍明确 OPEN |
| CP-1 | 五包 non-shrinking README/index/exports/invariants/publicSurface 原子补强，详见 §3 | 五包每个 root（含 type）与 invariant exact-set 相等；五包 export-map key/target 与 invariant deep equal；两 CSS 文件/宿主路径可解析；错指至另一个存在的 CSS 文件也必须红 |
| CP-2 | 本轮无获准逐项收窄；确认 71 个 root export 全保留，不改 production public surface | 写明 `AUTHORIZED_SHRINK_ITEMS=0`；原始 index 与新增 invariant/test 名单一致；不伪造清理量，不把仓外 OPEN 改成 PASS |
| CP-3 | 静态、focused 行为/平台/目录回归与红变异，按 §4；完成两个 Android host typecheck | 全部必需红变异先真红、恢复后真绿；command/module/part/失败恢复/配置/双端结构及 host path `MATCHED`，任何不匹配先修并复核 |
| CP-4 | 全批三维对账先行；之后整体测试、限定双屏/mobile 动态回归、cleanup、逐代码与详设对账、整批独立 implementation review | 三维对账与逐代码对账分开；动态限两个 app × 两种已授权机型；实施差异型 `OPEN` 修复并复查前不得交 review；预先声明且按授权保持的 Q5/外部消费者 OPEN 不冒充实现差异 |

每个 CP 完成且进入下一 CP 前，fresh 独立子 agent 按需求、详设/IA、项目记忆设计规范逐项对账，审查行为、形态、动作、文案、part 关系、失败/恢复、数据来源与限制；任一 `OPEN` 由主 agent 修复并让另一 fresh reviewer 复查。CP-0 未关的**某项收窄**不可借 CP-1 公共合同补强绕过。全部 CP 完成后、**整体测试前**再由 fresh reviewer 做全批逐条三维对账，不是阶段结果汇总；这是测试准入门。

本计划中的逐 CP `OPEN` 仅指授权实施范围内的实现偏差；Q5、仓外消费者、v2 区域标题、dismissal helper 纯度等明列范围外项保持 `OPEN`，不作为本批实现偏差或关闭条件。

## 3. CP-1/CP-2 的精确文件账与原子同步

每个包的五处在同一 CP 改、测、回读，不能分期留下不一致中间状态。`src/index.ts` 对 CSS 子路径是 `N/A`，**不可**通过给 TS root 加 CSS 假 export 凑“五处一致”。

| 包（均位于 `apps/terminal/ui/`） | README / root / map / invariant / 执行体 | 具体动作 |
| --- | --- | --- |
| `feature/sample-member-desk` | `README.md` / `src/index.ts` / `package.json` / `terminal-invariants.json` / 新增 `test/publicSurface.test.ts` | 当前 6 root 全列 `publicExports`，`publicExportMap={".":"./src/index.ts"}`；复用既有 TS checker exact-set 形态；README 解释 assembly 与 root，不因 Ø 删符号 |
| `feature/sample-staff-auth` | 同上；新增 `test/publicSurface.test.ts` | 当前 6 root + 同一 root-only `publicExportMap`，类型计入；保持两个 integration 依赖的 `moduleName` 与 assembly |
| `feature/sample-wallpaper-picker` | `README.md` / `src/index.ts` / `package.json` / `terminal-invariants.json` / 既有 `test/publicSurface.test.ts` | 当前 16 root 逐项核对，root-only `publicExportMap` 入 invariant；本批 `parts`/factory 均保持原样，未获逐项裁定不得收窄 |
| `integration/sample-console` | 同五处，执行体为既有 `test/publicSurface.test.ts` | 当前 20 root + `publicExportMap` 两个 key/target 入 invariant；CSS `./theme/global.css` 与 Android sample-terminal 的 App/metro 及五个根符号保持；扩展 consumer-side 静态检查 |
| `integration/sample-wallpaper-console` | 同五处，执行体为既有 `test/publicSurface.test.ts` | 当前 23 root + `publicExportMap` 两个 key/target 入 invariant；CSS 与 Android sample-wallpaper-terminal 同形保持；扩展 consumer-side 静态检查 |

`publicExportMap` 的检查不是仅断言 key 存在：必须与 `packageJson.exports` 双向 deep equal，且每个 target 对应文件存在；改成另一个存在的 CSS 文件也须因 target 不等而红。root `publicExports` 用 TS checker 的 `getExportsOfModule` exact-set，value/type 均计。两 integration 的执行体从 Android consumer source 的 TS AST 取真实 package-root import 名字（`App.tsx` 的 helper/assembly type/SurfaceForm；`platformPorts.ts` 的 assembly factory/SurfaceForm；`dependencies.ts` 的 moduleName）及 CSS import，并核对 `metro.config.js globalCssPath` 的同一子路径；错名、错包、移走或映射到不存在 CSS 均红。Android 两包既有 `typecheck` 再独立证明真实 TS 消费可解析，未来若授权 Android 构建则单列原生档位。CSS 文件被 `test-expo` 相对导入不算子路径被宿主消费的替代证据。

CP-2 若有获准收窄：仅移除**被裁定的根公开入口**，不删除 assembly 必需的内部定义；先改所有已知 consumer，再同一原子组改 root/README/invariants/test/map。旧文件/导出/别名/README 示例/测试 import 做精确负向扫描；不保留 deprecated 兼容层或绕行深路径。若任何深路径确是受支持跨包路径，先另行归因并交 Dexter，不能静默转移到不可见 API。wallpaper-picker 的两个平行入口只是候选，不预先写成必删结果。

## 4. 行为不变的执行体与红变异

以下是本轮实施期的验证设计。执行前先读各 test 当前断言，必要时在 owning test 中补精确 oracle；只靠 testID、`typeof`、导出存在性不足以判定行为。

| 约束 | 现有/拟补 focused 执行体 | 至少一条真实红变异 |
| --- | --- | --- |
| 三 feature 的 command owner、member 提交/取消、staff 登录、wallpaper 选择与失败恢复 | `feature/sample-member-desk/test/memberDesk.test.tsx`、`feature/sample-staff-auth/test/staffAuth.test.ts`、`feature/sample-wallpaper-picker/test/sampleWallpaperPicker.test.tsx` 与 system-failure tests；检查 command identity、payload、状态/恢复 | 把 dismissed command 换成另一 feature 的；或把 sample-only financial 值写入 member payload → focused 必红 |
| 五包 module identity/依赖与两个 integration 装配 | 上述 feature test + `integration/sample-console/test/sampleAssembly.test.tsx`/`packageSurface.test.ts`、`integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`；精确检查 moduleName、依赖、assembly 组成 | 改一包 `moduleName` 或移掉一个 feature module → focused/依赖 contract 必红 |
| part metadata 与双端结构 | 三 feature、两个 integration 的每个 part 建立 catalog/renderer 完整精确集合快照：`partKey`、`rendererKey`、`containerKeys`、`displayModes`、`workspaces`、`instanceModes`、`title`、layer tier/guard、`surfaceForm`；integration 自有 part 及组合进 assembly 的 feature parts 也要覆盖；同时断言 laptop/mobile siblings 与 wallpaper welcome/waiting laptop-only | 必须实跑非 `partKey`、非 `surfaceForm` 元数据变异：将 `sample.desk.member-form.displayModes` 从仅 `PRIMARY` 改为含 `SECONDARY`，focused 必须红、恢复后同门绿；删除 mobile sibling 可作为另一个变异。仅 `parts.length` 不算通过 |
| 配置、parser、主题/宿主路径 | 两 integration `test/terminalSurfaces.test.ts`、`test/theme.test.ts`（存在者）与 `test/publicSurface.test.ts`；两 Android `typecheck`；精确比较 terminalSurfaces、错误前缀、persistenceKey、state-sync、CSS 子路径 | 改一个 resolution/错误前缀或 `metro globalCssPath` 指错包 → 对应 focused/host 门必红 |
| 键盘跨批依赖不回退 | member 两端 MemberForm 与 `useMemberForm` focused：alpha/financial fieldId/testID、只在 PRIMARY、提交不入业务 payload；保留键盘详设 §6.2 alpha 动态入口 | 删 alpha probe、改 fieldId、把 probe 值入 submit command → focused 必红；v2 区域标题现状差异另列 OPEN，非本批 UI 改动 |

如既有测试缺少某一行的红变异能力，先补它再做公共面收窄，不能用 TypeScript 或 exact-set 的 PASS 代替行为证明。实施本批不主动改登录、keyboard、power、feature UI 文案/形态；如发现原需求与当前 UI 已有差异（例如 v2 探针区域标题），标明既有差异与 owner，另交 Dexter，不借本批掩盖。

必须实跑并记录首次红输出、恢复后绿：`publicExportMap` 的 CSS target 改指另一个存在文件；根导出各做一次增、删；Android consumer import 改名；改一个 `moduleName`；把 dismissed command 换成另一 feature 的；将 `sample.desk.member-form.displayModes` 改为含 `SECONDARY`（这是 part 完整元数据快照的强制变异，不能由删除 sibling 或仅 `parts.length` 代替）；删除一个 mobile sibling part；把 financial probe 值写入 member payload。每项一次只施加一个变异，观察对应 focused/static gate 真红，恢复原字节后重跑同一 gate 真绿；不得用“预计会红”替代结果。

## 5. 失败、停机与证据档位

对外消费者未知、Q5 未裁定、某项收窄需改受禁业务行为、根入口与 host 消费出现矛盾时停止该项，把原始源码事实、反例、最小替代和需 Dexter 决定的问题交回；本轮不得因此擅自收窄，按 CP-2 记录零获准项。测试/构建首次失败保存 first failure、last known good、broken boundary 和日志；同 failure category 第二次出现先完成根因定位，不盲重试或改超时。动态授权仅覆盖 CP-4 单机双屏与 mobile 两类虚拟机；业务结果与 cleanup 分开。

CP-4 动态范围固定为两个 Android app（`sample-terminal`、`sample-wallpaper-terminal`）分别运行在单机双屏与 mobile 上，共四个组合：

- 单机双屏：观察 displayIndex `0` 与 `1` 两块屏均能创建并渲染；各 app 的 integration CSS/主题解析有效，业务 parts 按配置出现在对应屏面。
- mobile：两个 app 的 mobile renderer 可真实渲染；`sample-terminal` 的 MemberForm alpha probe 可进入并弹出 alpha 键盘。`sample-wallpaper-terminal` 不伪造 MemberForm 入口。
- 只有 CP-0 至 CP-3、全部红变异、CP 逐项复核和全批三维对账均 `MATCHED` 后才进入设备动态验证；须由 Dexter 启动指定虚拟机，不自行启动其他机型。不可达帧/行为显式 `OPEN` 并说明缺失条件，不以结构测试代替。
- 使用实际受管 Android 执行入口；每个组合分开记录 business/device 结果、日志与 cleanup。清理本批由我们启动且由 run manifest 拥有的进程/转发。无 UI 变化，`visual=NOT_APPLICABLE_WITH_REASON`，不截图、不宣称视觉验收；Web/Metro 不在本批动态授权内。

交付状态须逐档填写：`static`、`focused`、`Web`、`Android/native/device`、`visual`、`cleanup`；未执行写 `NOT_RUN`，缺条件写 `OPEN`，不可由较低档位升级为设备或视觉通过。行为不变红变异要记真实第一次红与恢复后绿；“预计会红”不是结果。

## 6. 前后双读与独立审查记录

每个实际变更点要留最小可核查记录：变更前的需求条目/IA 或原业务材料、六维路由命中的项目 memory 原文、适用详设、owning source、复用 source；变更后的同一组材料、最终字节与 focused proof。不能以总览阅读代替逐点双读。主 agent 完成当前 CP 后由 fresh 子 agent 对需求、详设/IA、memory 逐项证伪，形成 `MATCHED/OPEN`，缺双读留痕即 finding。全部 CP 完成后的整体三维对账另做，且在第一次整体测试前完成；不把子 agent 的阶段性意见升级为整批 GO。

整批实施完成后，再由 fresh 独立子 agent 按详设做 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查；每条 finding 指明详设条款与实际实现位置，设计无判据时列 `DESIGN_GAPS` 交设计侧。该 review 不由本设计轮次代替。本轮 DESIGN 盲审最多两轮，reviewer 先证伪后读作者处置，主 agent 只负责逐条回源 intake 与文档修订。

## 7. 独立交付门：逐代码与详设对账

**执行时点**：全部实施、步骤级与整体三维对账、相称测试及 cleanup 后，交 Dexter/Claude 做实施后 review **之前**。**执行者**：主 agent 逐代码编制记录，fresh 只读子 agent 独立证伪。**范围**：所有本批新增/修改/删除的生产代码与测试，以及五包 README/index/exports/invariants/publicSurface、Android 实际消费路径、负向扫描；按详设 §3–§8 每条可实现条款逐项对齐，不抽样。**判据**：owner、公共入口、消费归因、atomic 五方、root/子路径解析、行为/形态/part/失败恢复/配置/双端、禁止项与 OPEN 边界均与详设一致，并有对应真实 focused/host 证据。**结论**：逐项只能 `MATCHED` 或 `OPEN`；记录每条的详设位置、代码位置、证据路径、判定人、差异。任何代表本批实施存在偏差的 `OPEN` 未修复并经新独立复查前，**不得交 Dexter/Claude 做实施后 review**。Q5、仓外消费者、v2 区域标题、dismissal helper 纯度等按当前授权明确保持 `OPEN` 的未决项不属实施偏差，不改写为关闭，也不阻止对已授权实施范围作 review。

这道门是“代码 ↔ 本详设”，不能拿“需求 + 详设/IA + 项目 memory”的阶段/整体三维对账替代；反过来亦不成立。对账记录必须随最终实施交付一同提供，缺记录即交付不成立。当前 CP 进度及该门证据以最终实施报告为准。
