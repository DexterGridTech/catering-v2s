# TER 骨架批一 · Claude DESIGN NO-GO · Codex intake

```text
REVIEW_TARGET=DESIGN
SOURCE_REVIEW=doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-review-claude.md
SOURCE_VERDICT=NO-GO
SOURCE_M_S_N=2/3/2
INTAKE_KIND=AUTHOR_DISPOSITION
FINDINGS_DISPOSITIONED=7/7
AUTHOR_DISCOVERED_SOURCE_CONFLICTS=1
POST_REMEDIATION_STATUS=AWAITING_CLAUDE_TARGETED_RECHECK
BATCH1_IMPLEMENTATION_STARTED=false
```

本文件只记录作者对 Claude finding 的来源级复核与文档处置，不是新的独立 verdict。内部 DESIGN review
已经达到两轮上限；本次外部 review 修订不创建第三轮内部结论，也不授权实施。

## 1 · 当前正本同步状态

当前需求已同步 Claude 指出的上游根因：

- §3 明确脚手架与模板使用 `latest`，版本表只是 2026-08-29 快照；
- §6.1 明确 assembly 正式依赖同批次其余全部节点，批一 13、批二 21；
- §9.2 仍要求 production entry 可达当前批次每个 package root；
- §8.1 明确两类脚手架产出的 package-local `LICENSE` 都删除。

因此本轮只修订 Codex 详设与计划，没有再修改需求、规范正本或项目记忆。

## 2 · Finding disposition

| finding | 分类 | 独立核对事实 | 后果 | 最小处置 |
|---|---|---|---|---|
| M-1 bootstrap 13 imports 与 assembly 声明边互斥 | `CONFIRMED` | 旧详设 graph 最终只有 8 条 assembly 边，旧计划批一只有 2 条；需求现已改成 21→13 | 声明完整门与入口可达门不可能同时绿 | graph literal 改为其余 21；批一 manifest/import 投影为其余 13；package.json、dependencies.ts、bootstrap 三处 exact-set |
| M-2 固定旧 CLI/template | `DEXTER_DECISION` + `CONFIRMED_EXTERNAL_FACT` | direct authority 要求 latest；fresh latest app probe exit 0 且直出 Expo `~57.0.18` / RN `0.86.3` | 旧设计凭空增加版本规范化和跨 CP 级联 | CP-0/CP-5 使用 latest；精确解析版本只记为当次证据；删除旧模板版本规范化；CP-3 消费 latest app scratch 结果 |
| S-1 hygiene checker 无实现落点 | `CONFIRMED` | 旧验收表引用 filesystem checker，旧工具表没有对应职责 | 判据 8/9 退化成人工核对 | 并入 `check-static.mjs` 为第七项文件检查；固定报告 `RULE_GATES=6`、`SUPPORT_CHECKS=1` |
| S-2 ignore 清单不足 | `CONFIRMED` | 根 `.gitignore` 当前只有 `.runtime/`、node/build/dist/coverage/log；需求 §5.4 另列 Expo/Turbo/Android/Gradle/signing/Kotlin | 实施按旧清单必然不能通过判据 9 | CP-1 与定位锚点逐项列出 9 类规则，并用 `**/` 覆盖深层 Android/Kotlin 目录 |
| S-3 仓级 tuple 接线过早 | `CONFIRMED` | 当前 `verify.mjs` 在 validate-only 与 normal 都先运行 static 且强制 marker | 半成品 TER 会阻断其他并行工作 | CP-6 只建 TER 本地入口；CP-7 本地全部绿后才写两个 tuple，随后只运行仓级 validate-only |
| N-1 LICENSE 规则不一致 | `CONFIRMED` | fresh app 产物与 module template 都含 LICENSE；需求 §8.1 要求删除 | 实施者会在两种脚手架间猜测 | adapter 与 assembly 清理表都明确删除 package-local LICENSE |
| N-2 evidence/runtime 落点 | `CONFIRMED_NO_CHANGE` | `doc/evidence/platform/` 存在；根 `.gitignore` 首行已覆盖 `.runtime/` | 无 | 不修改 |

没有 finding 被驳回，也没有把 reviewer 推论直接升级为实现事实。

### 2.1 作者回读新增：latest 策略仍有一处 owning-source 冲突

```text
CLASSIFICATION=CONFIRMED_SOURCE_CONFLICT
DEXTER_REDECISION_REQUIRED=false
OWNING_SOURCE_SYNC_REQUIRED=true
```

- 需求 §3：脚手架/template 使用实施时 `latest`，快照不钉死，实际值不同时以实际为准；
- 同一需求 §13：仍写“RN 固定 0.86.3”；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：仍把 Expo SDK 57 / RN 0.86.3
  写成 active 技术栈裁定。

当前 fresh latest 恰好仍是 SDK 57 / RN 0.86.3，因此今天的命令没有数值分叉；但一旦 latest 漂移，三处会
给实施者相反指令。Dexter 已直接裁定 latest，故不需要再次做产品选择；最小修复是由 owning source 作者把
需求 §13 与 active memory 改成“版本随实施时 latest template/Expo CLI 解析，0.86.3 只是 2026-08-29
快照”，并按记忆规则重建索引。本轮 Codex 只获授权修改详设、计划和 review 材料，没有代改这两处。

## 3 · Fresh 命令证据

### 3.1 Latest app

在仓外 `mktemp` scratch 实跑：

```sh
npx --yes create-expo-app@latest <scratch>/blank-latest \
  --template blank-typescript \
  --no-agents-md \
  --no-install
```

结果：exit `0`，约 `4871ms`。原始 package manifest 含：

```text
expo=~57.0.18
react=19.2.3
react-native=0.86.3
@types/react=~19.2.2
typescript=~6.0.3
```

原始顶层含 `.git` 与 `LICENSE`，不含 `AGENTS.md`、`CLAUDE.md`、`.claude/`。scratch 已删除，
`scratchRemoved=true`。

### 3.2 Latest module inputs

```sh
npx --yes create-expo-module@latest --help
npm pack expo-module-template@latest --dry-run --json
```

两条均 exit `0`；help 含 `-s, --source <source_dir>`。当前解析结果：

```text
create-expo-app@latest=4.0.0
expo-template-blank-typescript@latest=57.0.20
create-expo-module@latest=57.0.1
expo-module-template@latest=57.0.9
```

module template dry-run 文件表含 `LICENSE`、`android/build.gradle`、Android Kotlin source、
`expo-module.config.json`、iOS source 与 `src/index.ts`。这只证明 latest 输入存在和 source 形状；
**没有**证明 `create-expo-module` 的完整成功闭包。

### 3.3 仓内 verifier/ignore

当前 `tools/verify-gates/verify.mjs` 的 `staticCommands` 是四元组
`[label, command, args, successMarkers]`，`runStatic` 在两种模式都运行并查 marker；`runtimeCommands` 可用
三元组，`remote` 默认 false。当前根 `.gitignore` 仍只有 6 行，未在本轮设计修订中提前修改。

## 4 · 修订后的关键不变量

1. `skeletonGraph` 最终仍是 22 个 literal 节点；assembly row 是其余 21 个正式依赖，batch 1 投影为 13。
2. bootstrap 的本地 `./index` 只计 assembly 自身可达 root，不计 self-edge；13 个 npm root 同时是 assembly
   声明、dependencies.ts 与 bootstrap 的 direct-dependency exact-set。
3. `latest` 是输入选择策略；精确版本是当次运行证据，不变成旧版 pin。
4. `verify:static` 的语义为六道规则门 + 一项单列 hygiene 文件检查；它们全部绿才打印 marker。
5. 仓级两个 tuple 在 CP-7 本地全绿前不存在；写入后只跑 validate-only，不运行仓级 normal。
6. package-local LICENSE 在 adapter 与 assembly 都删除；根 licensing policy 不在本批改变。
7. requirement §13 与 active architecture memory 的 fixed-stack 残留同步前，Claude 不应给出可实施 GO；
   若 latest 已漂移则 `STACK_SOURCE_CONFLICT=BLOCKED`。

## 5 · 仍未验证

- `create-expo-module@latest` + latest 官方 source 的完整成功闭包、原始成功树、退出码与规范化后入仓形态；
- Android Gradle 与 Kotlin 编译/运行；
- 真实批一 14 包与最终 22 包的 typecheck/Metro；
- Turbo 在真实 TER 树上的四个 task exact-set；
- 两条 TER verify 命令实际时长；
- 实施时 npm age gate 状态。
- requirement §13 与 active architecture memory 的 latest 策略同步结果。

上述事项保持 `UNVERIFIED` 或 `UNVERIFIED_REQUIRES_EVIDENCE`，没有因本次文档修订升级。

## 6 · 授权边界

本次只授权详设、计划、intake 与 Claude 定向复核材料。未创建任何 TER 包，未运行 Gradle/Kotlin、真机、
DEV、reset、seed、浏览器 L2、UAT、部署或 EAS，也未启动批一实施。
