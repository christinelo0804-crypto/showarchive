import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { expireOverdueShows } from '../db/repositories'
import { Modal } from './Modal'
import { daysFromToday, formatDateWithYear, todayISO } from '../lib/format'
import { requestShowsLanding } from '../lib/showsLanding'
import type { Show } from '../types'

/** 记录「今日不再提醒」的日期；为空时每次冷启动都会弹 */
const SNOOZE_KEY = 'showarchive:remind-snooze'
/** 演出前多少天内开始提醒（含当天） */
const SOON_DAYS = 3
/** 弹窗里每段最多列出的条数，超出只显示数量 */
const MAX_ROWS = 3

/** 相对今天的说法：今天 / 明天 / 后天 / N 天后 */
function dayLabel(date: string): string {
  const diff = daysFromToday(date)
  if (diff <= 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  return `${diff} 天后`
}

/**
 * 每天首次冷启动的演出提醒：
 * ① 已过期的演出 →「去修改」；② 今天起 3 天内开演的待观看演出 →「去查看」。
 * 两个入口都跳到「我的演出」并自动勾选状态「待观看 + 已过期」。
 */
export default function ReminderGate() {
  const navigate = useNavigate()
  const [overdue, setOverdue] = useState<Show[]>([])
  const [soon, setSoon] = useState<Show[]>([])
  const [open, setOpen] = useState(false)
  // 与「我的演出」列表一致的副标题：类别 · 城市 · 场馆
  const [names, setNames] = useState<{
    category: Map<string, string>
    city: Map<string, string>
    venue: Map<string, string>
  }>({ category: new Map(), city: new Map(), venue: new Map() })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // 先把「待观看且日期已过」的记录标记为「已过期」，再判断是否需要提醒
      await expireOverdueShows()
      if (cancelled) return
      let last: string | null = null
      try {
        last = localStorage.getItem(SNOOZE_KEY)
      } catch {
        last = null
      }
      if (last === todayISO()) return // 用户今天选择了「今日不再提醒」
      const all = await db.shows.toArray()
      if (cancelled) return
      const [cats, cities, venues] = await Promise.all([
        db.categories.toArray(),
        db.cities.toArray(),
        db.venues.toArray()
      ])
      if (cancelled) return
      setNames({
        category: new Map(cats.map((c) => [c.id, c.name])),
        city: new Map(cities.map((c) => [c.id, c.name])),
        venue: new Map(venues.map((v) => [v.id, v.name]))
      })
      const active = all.filter((s) => !s.deletedAt && !s.isDraft)
      const overdueList = active
        .filter((s) => s.status === 'expired')
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      const soonList = active
        .filter(
          (s) => s.status === 'upcoming' && daysFromToday(s.date) >= 0 && daysFromToday(s.date) <= SOON_DAYS
        )
        .sort((a, b) => (a.date < b.date ? -1 : 1))
      if (overdueList.length === 0 && soonList.length === 0) return
      setOverdue(overdueList)
      setSoon(soonList)
      setOpen(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 只关掉本次：同一天的下一次冷启动仍会弹 */
  function close() {
    setOpen(false)
  }

  /** 今日不再提醒：当天不再弹，次日恢复 */
  function snoozeToday() {
    try {
      localStorage.setItem(SNOOZE_KEY, todayISO())
    } catch {
      // 存储不可用时本次关闭，下次启动仍会提示
    }
    setOpen(false)
  }

  function goList() {
    requestShowsLanding(['upcoming', 'expired'])
    close()
    navigate('/shows')
  }

  const showMeta = (show: Show) => {
    const category =
      (show.categoryLevel2Id ? names.category.get(show.categoryLevel2Id) : undefined) ??
      names.category.get(show.categoryLevel1Id) ??
      ''
    return [category, names.city.get(show.cityId) ?? '', names.venue.get(show.venueId) ?? '']
      .filter(Boolean)
      .join(' · ')
  }

  const rows = (list: Show[], kind: 'overdue' | 'soon') =>
    list.slice(0, MAX_ROWS).map((show) => (
      <div className="remind-row" key={show.id}>
        <span className="remind-date">{formatDateWithYear(show.date)}</span>
        <span className="remind-body">
          <span className="remind-name">{show.title}</span>
          <span className="remind-sub">{showMeta(show)}</span>
        </span>
        <span className={`remind-tag${kind === 'soon' ? ' remind-tag-soon' : ''}`}>
          {kind === 'soon' ? dayLabel(show.date) : '已过期'}
        </span>
      </div>
    ))

  return (
    <Modal
      open={open}
      title="演出提醒"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={snoozeToday}>
            今日不再提醒
          </button>
          <button type="button" className="btn btn-primary" onClick={close}>
            知道了
          </button>
        </>
      }
    >
      {overdue.length > 0 && (
        <section className="remind-section">
          <div className="remind-head">
            <span>
              已过期 <b>{overdue.length}</b> 场待更新状态
            </span>
            <button type="button" className="remind-link" onClick={goList}>
              去修改 →
            </button>
          </div>
          <div className="remind-list">{rows(overdue, 'overdue')}</div>
        </section>
      )}

      {soon.length > 0 && (
        <section className="remind-section">
          <div className="remind-head">
            <span>
              {SOON_DAYS} 天内开演 <b>{soon.length}</b> 场
            </span>
            <button type="button" className="remind-link" onClick={goList}>
              去查看 →
            </button>
          </div>
          <div className="remind-list">{rows(soon, 'soon')}</div>
        </section>
      )}
    </Modal>
  )
}
