import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from './ui'

const tabs = [
  { to: '/', label: '首页', icon: 'home' as const, end: true },
  { to: '/shows', label: '我的演出', icon: 'list' as const, end: false },
  { to: '/new', label: '新增', icon: 'plus' as const, end: false, primary: true },
  { to: '/stats', label: '统计', icon: 'stats' as const, end: false },
  { to: '/settings', label: '设置', icon: 'settings' as const, end: false }
]

export default function Layout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        {/* 页面切换时只在内容区显示加载态，底栏与滚动容器保持挂载，避免整屏闪动 */}
        <Suspense fallback={<p className="muted">加载中…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-active' : ''} ${'primary' in tab && tab.primary ? 'nav-primary' : ''}`
            }
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
