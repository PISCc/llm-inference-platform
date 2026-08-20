import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // 保留 dist 中已归档的版本文件；常规构建只更新最新的 index.html。
  build: { emptyOutDir: false },
})
