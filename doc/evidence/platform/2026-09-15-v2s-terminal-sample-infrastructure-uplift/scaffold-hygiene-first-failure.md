# Static scaffold-hygiene first failure

日期：2026-09-15

## 原始失败

命令：

```text
node tools/terminal-skeleton/check-static.test.mjs
```

首个失败：

```text
AssertionError [ERR_ASSERTION]: HYGIENE_FAILURE:scaffold metadata remains: apps/terminal/assembly/base/android/node_modules
```

同一轮的 layering、native projection、startup diagnostics 和 production-bundle
checker 均通过；因此 broken boundary 是 scaffold hygiene，不是 graph/layering 规则。

## 根因与处置

`assembly/base/android/node_modules` 只含该新包测试运行产生的 `.vite`/`.vite-temp`
缓存，没有 package source。该包的 hygiene gate 明确禁止 package 内保留
`node_modules`，故将精确目录移到日期化线下目录：

```text
/tmp/ter-sample2-generated-cache-assembly-base-android-20260915
```

移动后必须再次核验仓内目录不存在，并以同一 static command 重跑；该缓存可由测试
runner 重新生成，不是被删除的业务/源码文件。
