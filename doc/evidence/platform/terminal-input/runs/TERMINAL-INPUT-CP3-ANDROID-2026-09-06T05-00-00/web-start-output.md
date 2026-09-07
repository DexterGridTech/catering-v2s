# CP-3 Web 启动输出摘要

命令：

```text
yarn workspace @catering-v2s/ui-integration-sample-console web --port 8082
```

实际输出关键行：

```text
Web: http://localhost:8082
Web Bundled 2505ms apps/terminal/ui/integration/sample-console/index.js (614 modules)
Web  LOG  Running application "main"
Web  INFO ... "event":"startup-ready" ... "runtimeStatus":"started"
```

HTTP 入口核验：

```text
curl -fsS -D ... http://localhost:8082/ ...
HTTP/1.1 200 OK
HTML_BYTES=1335
<title>@catering-v2s/ui-integration-sample-console
id="root"
```

如实登记的开发期/环境告警：

- Expo 提示未配置 `userInterfaceStyle`。
- `display-context.power-bridge` 因 adapter 未注入而 unavailable。
- protected storage adapter 未注入，导致 hydrate/flush persistence failure；这是当前 Web 外壳的既有端口边界，不把它伪装成持久化成功。
- `react-native-css-interop` 报 `Cannot manually set color scheme, as dark mode is type 'media'`。
- Web 不支持 `BackHandler`，`LayerStack` 的硬件返回监听因此记录开发期错误。

本轮没有浏览器自动化；上述输出只证明 Expo Web bundler/HTTP 启动和 runtime startup-ready，不能证明
浏览器刷新、resize 或 Android 行为。
