import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/playfair-display/latin-600.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/playfair-display/cyrillic-600.css'
import '@fontsource/playfair-display/cyrillic-700.css'
import { registerSW } from 'virtual:pwa-register'
import './styles/tokens.css'
import './styles/global.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

// Service Worker 注册失败（如不支持离线缓存的环境）不应阻塞应用启动。
try {
  registerSW({ immediate: true })
} catch (error) {
  console.warn('Service Worker 注册失败，应用仍可本地使用。', error)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
