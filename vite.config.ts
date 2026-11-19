import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages は https://<user>.github.io/maro-hado/ で配信されるので、そのときだけ基準パスを変える
  base: process.env.GITHUB_PAGES ? '/maro-hado-sumi/' : '/',
  plugins: [react(), tailwindcss()],
})
