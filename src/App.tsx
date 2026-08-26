import { lazy, Suspense, useEffect } from 'react'
import { useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import DefaultCategoryMigrationGate from './components/DefaultCategoryMigrationGate'
import { Splash } from './components/Splash'
import { seedIfEmpty } from './db/seed'
import { applyTheme } from './lib/theme'

const routerBasename =
  import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/+$/, '')

const HomePage = lazy(() => import('./pages/HomePage'))
const ShowsPage = lazy(() => import('./pages/ShowsPage'))
const DraftsPage = lazy(() => import('./pages/DraftsPage'))
const ShowDetailPage = lazy(() => import('./pages/ShowDetailPage'))
const EditShowPage = lazy(() => import('./pages/EditShowPage'))
const NewShowPage = lazy(() => import('./pages/NewShowPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const DataManagePage = lazy(() => import('./pages/DataManagePage'))
const CategoryManagePage = lazy(() => import('./pages/CategoryManagePage'))
const CityVenueManagePage = lazy(() => import('./pages/CityVenueManagePage'))
const LanguageManagePage = lazy(() => import('./pages/LanguageManagePage'))
const TicketChannelManagePage = lazy(() => import('./pages/TicketChannelManagePage'))
const RecycleBinPage = lazy(() => import('./pages/RecycleBinPage'))

function Loading() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <p className="muted">加载中…</p>
      </main>
    </div>
  )
}

/** 路由切换时回到页面顶部，避免从设置页中部进入管理页仍停留在原滚动位置。 */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.app-main')
    if (main) main.scrollTop = 0
    else window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    void seedIfEmpty()
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('showarchive-theme')
    applyTheme(stored === 'light' ? 'light' : 'dark')
  }, [])

  // iOS 独立模式冷启动时，WebKit 可能先用偏矮的视口布局、底部露出黑边；
  // 趁启动页幕布仍盖着屏幕时，对全高外壳做 display 翻转 + 同步重排，
  // 强制 WebKit 重算视口到真实全屏（社区验证过的修法，启动页不透明，翻转不可见）。
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(display-mode: standalone)').matches) {
      return
    }
    const heal = () => {
      const shell = document.querySelector<HTMLElement>('.app-shell')
      if (!shell) return
      const prev = shell.style.display
      shell.style.display = 'none'
      void shell.offsetHeight // 同步重排，触发 WebKit 重新计算视口
      shell.style.display = prev
    }
    const t1 = window.setTimeout(heal, 80)
    const t2 = window.setTimeout(heal, 500)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  return (
    <>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      <BrowserRouter basename={routerBasename}>
        <ScrollToTop />
        <ToastProvider>
          <DefaultCategoryMigrationGate />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="shows" element={<ShowsPage />} />
                <Route path="drafts" element={<DraftsPage />} />
                <Route path="shows/:id" element={<ShowDetailPage />} />
                <Route path="shows/:id/edit" element={<EditShowPage />} />
                <Route path="new" element={<NewShowPage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/data" element={<DataManagePage />} />
                <Route path="settings/categories" element={<CategoryManagePage />} />
                <Route path="settings/cities-venues" element={<CityVenueManagePage />} />
                <Route path="settings/languages" element={<LanguageManagePage />} />
                <Route path="settings/channels" element={<TicketChannelManagePage />} />
                <Route path="settings/recycle-bin" element={<RecycleBinPage />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </BrowserRouter>
    </>
  )
}
