import { Link } from 'react-router-dom'
import { useState } from 'react'
import { PageHeader, SectionTitle } from '../components/ui'
import { applyTheme } from '../lib/theme'

export default function SettingsPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  )

  function pickTheme(next: 'dark' | 'light') {
    setTheme(next)
    applyTheme(next)
    try {
      localStorage.setItem('showarchive-theme', next)
    } catch {
      // 忽略存储不可用的场景
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Settings" title="设置" />

      <section className="form-section">
        <SectionTitle kicker="Appearance">外观</SectionTitle>
        <div className="segmented">
          <button
            type="button"
            className={theme === 'dark' ? 'seg-active' : ''}
            onClick={() => pickTheme('dark')}
          >
            深色
          </button>
          <button
            type="button"
            className={theme === 'light' ? 'seg-active' : ''}
            onClick={() => pickTheme('light')}
          >
            浅色
          </button>
        </div>
      </section>

      <section className="form-section">
        <SectionTitle kicker="Data">数据管理</SectionTitle>
        <div className="settings-list">
          <Link className="settings-row" to="/settings/data">
            <span className="settings-row-name">数据备份</span>
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      <section className="form-section">
        <SectionTitle kicker="Manage">演出信息项管理</SectionTitle>
        <div className="settings-list">
          <Link className="settings-row" to="/settings/categories">
            <span className="settings-row-name">演出分类管理</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-row" to="/settings/cities-venues">
            <span className="settings-row-name">城市与场馆管理</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-row" to="/settings/languages">
            <span className="settings-row-name">演出语言管理</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-row" to="/settings/channels">
            <span className="settings-row-name">购票渠道管理</span>
            <span aria-hidden="true">›</span>
          </Link>
          <button type="button" className="settings-row" disabled>
            <span className="settings-row-name">关于</span>
          </button>
        </div>
      </section>

      <section className="form-section">
        <SectionTitle kicker="Trash">回收站</SectionTitle>
        <div className="settings-list">
          <Link className="settings-row" to="/settings/recycle-bin">
            <span className="settings-row-name">回收站</span>
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
