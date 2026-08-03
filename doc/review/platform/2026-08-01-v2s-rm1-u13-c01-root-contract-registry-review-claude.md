---
title: RM1 U13 C01 root OpenAPI 与 generated route registry exact-set 契约闭合复审（Claude）
reviewTarget: IMPLEMENTATION
scope: C01 静态 root OpenAPI / generated route-registry 分母闭合与其 exact-set guard
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖 C01 静态契约分母闭合；不授权 handler、owner、UI、generated artifact 手改、DEV、seed/reset、L2、HTTP workload、CRUD 性能结论、business/cleanup PASS 或 Roadmap 状态变更
createdAt: 2026-08-01
---

# U13 C01 契约分母闭合复审

## 0. 结论

**GO — `M=0 / S=1 / N=2`。**

**这是正确且最小的分母修复。** 四项指定核验我逐项机器验证通过，其中
「错指到 staging fragment」这条红变异**在总数仍为 147/147 的情况下依然被拒绝**——
证明该 guard 是真正的 tuple exact-set，不是数个数。

唯一的 `S` 与契约工作本身无关：package exit 的 `status: "PASS"` **没有任何执行过的 exit validator 支撑**，
而独立 round-1 也**明确声明不覆盖 package-exit closure**。

## 1. 分母闭合与 exact-set（核验点 1）—— 机器复算确认

我按真实结构重解 root（该文件扩展名 `.yaml` 但内容为 JSON，`$ref` 逐**路径键**指向 shard 内 path item），
并用**权威 owner 键 `x-owner-module`** 组 tuple：

```
root path 条目 = 125     未解析 ref = 0
root tuples (operationId, method, path, consumerFaces, owner) = 147     重复 = 0
generated route registry tuples                                = 147     entries = 147
ROOT-ONLY = []      REGISTRY-ONLY = []      EXACT_SET = True
```

`releasePlatformStagedAsset` 在 root 的 tuple 为
`('releasePlatformStagedAsset', 'post', '/api/platform/assets/staging/{assetRef}/release', ('platform-admin',), 'platform-asset')`，
与 registry 逐字段一致。**147 唯一 tuple、双向差集为空、零重复——全部成立。** ✓

> **披露我自己的一次近失**：首轮我猜 owner 键为 `x-owner`，得到「双向差集各 147」，
> 一度像是全面漂移。实际权威键是 `x-owner-module`（`edge-codegen.mjs:230/307`）。
> **是我的字段名错误，不是缺陷**；改用真实键后 exact-set 成立。

## 2. 没有错误退役既有 route（核验点 3）—— CONFIRMED

三个独立事实证明该 operation**本来就存在**，缺的只是 root 的一个路径键：

1. **shard 权威声明**：`contracts/openapi/paths/platform-admin/group-workspace-management.paths.yaml`
   一直声明该 operation。
2. **controller 实现事实**：`PlatformAssetController.java:20` `@RequestMapping("/api/platform/assets/staging")`
   ＋ `:26` `@PostMapping("/{assetRef}/release") releaseStaged(...)`——真实已实现路由。
3. **root 现在有两个各自独立的路径键**，各指向**自己的** fragment：

```
/api/platform/assets/staging                      -> …#/paths/~1api~1platform~1assets~1staging
/api/platform/assets/staging/{assetRef}/release   -> …#/paths/~1api~1platform~1assets~1staging~1{assetRef}~1release
```

**修复方向正确**：补根路径键，而**不是**退役 registry 条目。
若反向「修复」成删除 registry 项，会把一个已实现、已声明、面向 `platform-admin` 的路由从分母中抹掉。

## 3. 红变异（核验点 2）—— 三类全红，我在 scratchpad 镜像实测

镜像把 `contracts` / `scripts` / `tools` 做成**真实拷贝**（`scripts/check/*` 用
`cd "$(dirname "$0")/../.." && pwd` 解析根目录，符号链接会穿透回真实仓库），其余符号链接；**本仓零写入**。

| 变异 | 结果 |
| --- | --- |
| baseline | `R5_EDGE_CODEGEN_CHECK=PASS` |
| **MUT-1** 删除 root 的 release 路径引用 | **RED** `R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT:root=146:registry=147` |
| **MUT-2** 把 release 键**错指到 staging fragment** | **RED** `R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT:root=147:registry=147` |
| **MUT-3** release 路径键写成 `…/release-typo` | **RED** `R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT:root=147:registry=147` |
| 恢复 | `R5_EDGE_CODEGEN_CHECK=PASS` |

**MUT-2 是决定性的一条**：两侧计数**都是 147**，guard 仍然拒绝——
说明它比较的是 tuple 集合本身（错指造成 `stagePlatformAsset` 的重复 tuple 与 release tuple 缺失），
**不是基数校验**。MUT-3 进一步证明 `path` 分量参与比较。MUT-1 精确复现了修复前的 146/147 状态。

`./scripts/check/edge-codegen --self-test` 我完整跑通：`R5_EDGE_CODEGEN_SELF_TEST=PASS`，
26 条红控制中包含新增的 **`R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT`**，
即该 guard 已进入既有 self-test 的红清单，不是只挂在 `--check` 上。

## 4. generated 输出仍只是投影（核验点 3）—— CONFIRMED

package exit 的 `changedPaths` 共 **10** 条，**其中没有任何 generated artifact**：
无 `edge-route-face-registry.json`、无 `platform-edge.ts` / `operations-edge.ts`、
无 controller、无 owner、无 UI，连 shard 本身都未改（因为它本来就声明了该 operation）。

实际改动只有：root OpenAPI（修复本体）、`scripts/generate/edge-codegen.mjs`（guard）、
`tools/compliance-control/cli.mjs`（见 `N2`）、`active-package.json`，以及 6 份 doc/evidence。

`R5_EDGE_CODEGEN_CHECK=PASS` 意味着**当前 generated 输出与从契约重新生成的结果一致**——
即它仍是纯投影，没有手改。✓

## 5. 结果边界未被越级解释（核验点 4）—— CONFIRMED

package exit 的 `scopeStatement` 原文：

> PASS proves only static root OpenAPI/generated route-registry denominator closure. It is not HTTP
> workload coverage, CRUD efficiency/performance, DEV, seed/reset, managed L2, user-journey business
> PASS, cleanup PASS, or Roadmap closure.

`business = "NOT_APPLICABLE"`、`cleanup = "NOT_APPLICABLE"`。
round-1 的 GO 同样自限「is not package-exit closure and does not grant any broader runtime,
business, performance, cleanup, or Roadmap authority」。**没有任何越级表述。** ✓

`staticProof` 自报的 `rootOpenApiTuples=147 / generatedRouteRegistryTuples=147 / duplicates=0 /
twoWayDifference=0` 与我 `§1` 的独立重算**逐项一致**。
其列出的静态命令我 fresh 复跑：`R5_EDGE_CODEGEN_CHECK=PASS`、`R5_EDGE_CODEGEN_SELF_TEST=PASS`、
`R5_OPENAPI_CONTRACTS=PASS`、`REMEDIATION_COMPLIANCE=PASS`、`STANDARDS_COVERAGE=PASS`。

**N-01 的处置正确且最小**：`--phase RM1-P6-3` 返回 `UNKNOWN_PHASE` 属 phase 词表归属问题，
C01 的 input 绑定 `standardsPhase=R5`，`--phase R5` 我实测 PASS，且**没有**声称 CURRENT_STEP 覆盖。
作者拒绝为它改 C01 源码，符合「不扩大 C01」。✓

## 6. S1 ｜exit 的 `status: "PASS"` 没有任何执行过的 validator 支撑

**仓内事实三条：**

1. `node tools/compliance-control/cli.mjs validate-package-exit <C01 exit>` 实跑
   → **`PACKAGE_EXIT=FAIL` / `REASON=PACKAGE_BASELINE_MISSING`**
   （`cli.mjs:2061`；`.runtime/compliance-control/package-baseline-RM1-C01*` 不存在）。
2. exit 自己记录 `exitMode: "TRIM_OBSERVATION_PATH_LIST_ONLY"`，
   `harnessTrimObservation.legacyBaselineExitValidator = "NOT_INVOKED_DURING_OBSERVATION; its removal
   is a separate control-plane follow-up"`，且 `staticProof.commands` **不含** `validate-package-exit`。
3. 独立 round-1 第 48 行明写「package exit 的 changed-path/incremental-receipt set equality
   尚不属于本次独立 review verdict」，第 103 行明写「**is not package-exit closure**」。

三者叠加的结果是：**`status: "PASS"` 是作者声明值——既没有 validator 执行过，
也被独立 review 明确排除在其 verdict 之外。**

**这不是隐瞒**（作者逐条披露了），也**不是**说该做的事没做——
`PACKAGE_BASELINE_MISSING` 要的正是 Dexter 已在 harness trim 中退役的 prewrite baseline，
所以「去把它跑绿」反而是错的方向。问题在于字段名读起来像门的结果。

**影响面**：U11、U12 的 exit 都由 `validate-package-exit` 机器判定通过；C01 是本序列里第一个
`status: PASS` 无门支撑的包。后续会话按同一字段名横向比较时，会把三者当成同一强度的证据。

**最小修复（二选一）**：
(a) 一个词——把该字段改为 `staticProofStatus`（或 `authorDeclaredStatus`），
在有 validator 之前不要占用 `status: PASS` 这个已有门语义；
(b) 落 exit 自己指出的 control-plane follow-up，让 `validate-package-exit` 认识
`TRIM_OBSERVATION_PATH_LIST_ONLY` 并对该模式给出真实判定。

**是否需要 Dexter 产品裁决**：否——(a) 在既有边界内；(b) 是已登记的独立后续项。

## 7. N

**N1 ｜控制面改动被并入契约分母单元**

`tools/compliance-control/cli.mjs` 在 `changedPaths` 内，实际 diff 是
**successor package admission** 的 bootstrap 路径规则：允许 `deliveryManifestPath` 落在
`doc/review/platform/`（原先强制 `doc/evidence/platform/rm1/p6/`），
并新增两条红自测 `RED_BOOTSTRAP_MANIFEST_MISSING`、`RED_BOOTSTRAP_MANIFEST_ROOT_ESCAPE`，
以及一条 active-package recovery 命令分支。

这确实是**开这个包所必需**的（C01 的 delivery manifest 就在
`doc/review/platform/rm1-u13-c01-root-contract-registry-delivery-manifest.json`），
而且是**带红证据的放宽**而非裸放宽，因此不判 S。
但它与 `scopeStatement` 所述「static root OpenAPI/generated route-registry denominator closure」
不是同一件事。建议在 amendment 里用一句话把它标为「为开包所需的控制面附带改动」，
让分母读者不必自己 diff 才能知道。

**N2 ｜`--phase RM1-P6-3` 的 `UNKNOWN_PHASE` 仍是开放项**

N-01 的处置（C01 只报 package-pinned `R5`）我认可，是正确的最小选择。
但该 phase 词表不一致自本会话若干轮前就存在，且每轮都被重新登记为 N。
它不属于 C01，但建议由 phase 词表 owner 单独收口，避免每个后续包重复承载同一条 N。

## 8. 处置

- **`S1`** 在既有批准边界内，Codex 可自主处置（建议先做 (a) 的一个词，(b) 随控制面 follow-up）。
- **`N1`** 一句话补记；**`N2`** 属 phase 词表 owner。
- **已复核为真、不得回退**：147/147 唯一 tuple 与空双向差集、
  `R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT` 对删除/错指/路径 typo 三类的真实拒绝
  （尤其计数相等仍拒绝）、guard 已进入 `--self-test` 红清单、
  root 两个 staging 路径键各指其 fragment、`PlatformAssetController:26` 的既有实现、
  changedPaths 内零 generated artifact、以及 `scopeStatement` 的非越级表述。
- **本 GO 仅覆盖 C01 静态契约分母闭合**：不授权 handler、owner、UI、generated artifact 手改、
  DEV、seed/reset、L2、HTTP workload、CRUD 性能结论、business/cleanup PASS 或 Roadmap 状态变更。
