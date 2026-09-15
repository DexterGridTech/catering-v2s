# 过时文件线下处置记录（round2）

DATE=2026-09-15
SCOPE=TER sample infrastructure uplift
ACTION=OFFLINE_MOVE_NOT_DELETE

用户明确要求抽 base 后处理原有可能作废的文件。本轮确认两个零消费 adapter 空壳不是
新能力的 owner，已从仓内工作区移到日期命名的线下保留目录；没有删除，也没有执行 Git。

## 仓内移出对象

| 仓内原路径 | 线下保留路径 | 移出文件数 | 体积 | 当前仓内状态 |
| --- | --- | ---: | ---: | --- |
| `apps/terminal/adapter/android/app-control` | `/tmp/ter-sample2-obsolete-adapter-android-app-control-20260915` | 273 | 1.8M | 不存在 |
| `apps/terminal/adapter/android/logger` | `/tmp/ter-sample2-obsolete-adapter-android-logger-20260915` | 273 | 1.8M | 不存在 |

线下目录保留了原目录中的源码、配置、测试及已有构建缓存，便于 Dexter 后续核查或恢复。
本记录不把 `/tmp` 保留目录当作 workspace package，也不把普通的
`platform-ports` `appControl` / `logger` 能力误判为已废弃 adapter 包。

## 同轮发现的生成产物

静态门第一次重跑时保留的首败是：`SCAFFOLD_HYGIENE=FAIL`，原因是
`apps/terminal/assembly/base/android/node_modules`。该目录只有 Vitest 的
`.vite` / `.vite-temp` 缓存（1 个文件、4.0K），不是 package.json 依赖，也不是源码。
按同一“线下保留、不做 Git 操作”的原则移到：
`/tmp/ter-sample2-generated-assembly-base-android-node_modules-20260915`。

移出后仓内路径不存在，线下目录存在；`node tools/terminal-skeleton/check-static.mjs`
重新执行得到 `SCAFFOLD_HYGIENE=PASS`，其余 7 个规则门仍全部 PASS。该生成产物不计入
业务或动态 cleanup；线下目录若需清除，仍须由 Dexter 另行决定。

## 同步处置

- `apps/terminal/skeleton-graph.ts` 删除两个节点；节点总数由 34 改为 32；
- `package.json` 的逐层 workspace 仍枚举 `apps/terminal/adapter/android/*`，不保留两个
  已移出节点；`yarn.lock` 删除两个 workspace entry；
- `tools/terminal-skeleton/check-static.mjs`、`check-static.test.mjs`、`verify.test.mjs`
  的节点期望、计数和 red mutation 已同步；
- 当前 `apps/terminal/adapter/android` 仅有 `device`、`dual-screen`、`persist-kv`；
- 历史 skeleton/sample2 需求和旧 review 中出现的名称是历史事实，不作当前源码清单，
  不为清理历史文档而改写历史记录。

## 可复核命令

```sh
find apps/terminal/adapter/android -mindepth 1 -maxdepth 1 -type d -print | sort
rg -n "adapter\\.android\\.(app-control|logger)" apps/terminal/skeleton-graph.ts
for p in /tmp/ter-sample2-obsolete-adapter-android-app-control-20260915 /tmp/ter-sample2-obsolete-adapter-android-logger-20260915; do
  find "$p" -type f | wc -l
  du -sh "$p"
done
test ! -e apps/terminal/assembly/base/android/node_modules
find /tmp/ter-sample2-generated-assembly-base-android-node_modules-20260915 -maxdepth 3 -print
node tools/terminal-skeleton/check-static.mjs
```

预期当前仓内命令只列出三个有效 adapter，graph 不再含两个移出节点，两个线下目录各
保留 273 个文件、约 1.8M。线下保留目录不是动态运行资源，不参与 business/cleanup
结论；若后续需要清除，必须由 Dexter 明确决定并另行记录。
