import { useEffect, useRef, useState } from 'react'
import { IconCalendar } from './icons'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function calendarCells(year: number, month: number): Array<string | null> {
  const padCount = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  const cells: Array<string | null> = Array.from({ length: padCount }, () => null)
  for (let d = 1; d <= count; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`)
  }
  return cells
}

/** 年份选择范围：当前年份往前 50 年、往后 2 年，从新到旧排列。 */
function yearOptions(currentYear: number): number[] {
  const years: number[] = []
  for (let y = currentYear + 2; y >= currentYear - 50; y--) years.push(y)
  return years
}

export function DatePicker({
  value,
  onChange,
  ariaLabel,
  id
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  id?: string
}) {
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [year, setYear] = useState(() => {
    const d = value ? new Date(value) : now
    return Number.isNaN(d.getTime()) ? now.getFullYear() : d.getFullYear()
  })
  const [month, setMonth] = useState(() => {
    const d = value ? new Date(value) : now
    return Number.isNaN(d.getTime()) ? now.getMonth() : d.getMonth()
  })
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setYearOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setYearOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = calendarCells(year, month)
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  function changeMonth(delta: number) {
    setYearOpen(false)
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  return (
    <div className="picker-wrap" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="select-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={`select-label ${value ? '' : 'select-placeholder'}`}>
          {value || '选择日期'}
        </span>
        <IconCalendar />
      </button>
      {open && (
        <div className="picker-pop picker-cal" role="dialog" aria-label="选择日期">
          <div className="picker-cal-head">
            <span className="picker-cal-title">
              <span className="picker-cal-year-wrap">
                <button
                  type="button"
                  className="picker-cal-year"
                  onClick={() => setYearOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={yearOpen}
                >
                  {year} <span className="picker-cal-year-chev">▾</span>
                </button>
                {yearOpen && (
                  <span className="picker-cal-year-menu" role="listbox">
                    {yearOptions(now.getFullYear()).map((y) => (
                      <button
                        key={y}
                        type="button"
                        role="option"
                        aria-selected={y === year}
                        className={`picker-cal-year-opt ${y === year ? 'on' : ''}`}
                        onClick={() => {
                          setYear(y)
                          setYearOpen(false)
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </span>
                )}
              </span>
              年 {month + 1} 月
            </span>
            {year !== now.getFullYear() && (
              <button
                type="button"
                className="picker-cal-today"
                onClick={() => {
                  setYear(now.getFullYear())
                  setMonth(now.getMonth())
                  setYearOpen(false)
                }}
              >
                回到今年
              </button>
            )}
            <div className="picker-cal-nav">
              <button type="button" className="picker-nav-btn" onClick={() => changeMonth(-1)} aria-label="上个月">
                ‹
              </button>
              <button type="button" className="picker-nav-btn" onClick={() => changeMonth(1)} aria-label="下个月">
                ›
              </button>
            </div>
          </div>
          <div className="picker-cal-grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="picker-cal-wd">
                {w}
              </div>
            ))}
            {cells.map((date, i) =>
              date ? (
                <button
                  key={date}
                  type="button"
                  className={`picker-cal-day ${date === value ? 'picker-cal-selected' : ''} ${
                    date === todayStr ? 'picker-cal-today' : ''
                  }`}
                  onClick={() => {
                    onChange(date)
                    setOpen(false)
                  }}
                >
                  {Number(date.slice(-2))}
                </button>
              ) : (
                <span key={`pad-${i}`} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
