import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // 相对路径构建：方便直接丢到任意子目录 / GitHub Pages 部署
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // 开发期把 /api 代理到本地 FastAPI（server/main.py，默认 8000 端口）；
    // 生产环境请在自己的网关里做同样的转发。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 演示音轨是 wav，体积较大，放宽警告阈值
    chunkSizeWarningLimit: 1200,
  },
})
