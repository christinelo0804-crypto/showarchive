import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 项目页部署在子路径（https://<user>.github.io/<repo>/）；
// 本地开发或根路径部署时保持 '/'
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ShowArchive',
        short_name: 'ShowArchive',
        description: '个人观演记忆档案馆',
        lang: 'zh-CN',
        theme_color: '#141422',
        background_color: '#141422',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 相对路径：Workbox 会相对 Service Worker 所在目录解析，子路径/根路径都正确
        navigateFallback: 'index.html'
      },
      devOptions: { enabled: false }
    })
  ]
})
