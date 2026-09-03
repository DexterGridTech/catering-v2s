import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {createFrontendWatchBoundary} from '../../../scripts/frontend/vite-watch-boundary';

const gatewayProxyTarget = process.env.VITE_PLATFORM_GATEWAY_PROXY_TARGET;
const gatewayProxy = gatewayProxyTarget ? {'/api': {target: gatewayProxyTarget, changeOrigin: false}} : undefined;

export default defineConfig({
  plugins: [react()],
  resolve: {alias: {'@ant-design/icons-svg/lib/asn': '@ant-design/icons-svg/es/asn'}},
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    watch: createFrontendWatchBoundary(import.meta.dirname),
    proxy: gatewayProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: gatewayProxy,
  },
});
