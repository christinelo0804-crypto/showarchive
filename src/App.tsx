import { lazy, Suspense, useEffect } from 'react'
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import DefaultCategoryMigrationGate from './components/DefaultCategoryMigrationGate'
import { Splash } from './components/Splash'
import { seedIfEmpty } from './db/seed'

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

export default function App() {
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    void seedIfEmpty()
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('showarchive-theme')
    document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark'
  }, [])

  return (
    <>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      <BrowserRouter basename={routerBasename}>
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
