import { useEffect, useRef, useState } from 'react'
import { IconClock } from './icons'

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export function TimePicker({
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
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<[string, string]>(['00', '00'])
  const rootRef = useRef<HTMLDivElement | null>(null)
  const hoursRef = useRef<HTMLDivElement | null>(null)
  const minutesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    hoursRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'center' })
    minutesRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'center' })
  }, [open])

  function selectHour(h: string) {
    setDraft([h, draft[1]])
  }

  function selectMinute(m: string) {
    setDraft([draft[0], m])
  }

  function confirm() {
    onChange(`${draft[0]}:${draft[1]}`)
    setOpen(false)
  }

  return (
    <div className="picker-wrap" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="select-trigger"
        onClick={() => {
          if (!open) {
            const [h, m] = value ? value.split(':') : ['00', '00']
            setDraft([h, m])
          }
          setOpen((o) => !o)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={`select-label ${value ? '' : 'select-placeholder'}`}>
          {value || '选择时间'}
        </span>
        <IconClock />
      </button>
      {open && (
        <div className="picker-pop picker-time" role="dialog" aria-label="选择时间">
          <div className="picker-time-cols">
            <div className="picker-time-col">
              <div className="picker-time-col-title">时</div>
              <div className="picker-time-scroll" ref={hoursRef}>
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-selected={h === draft[0]}
                    className={`picker-time-row ${h === draft[0] ? 'picker-time-selected' : ''}`}
                    onClick={() => selectHour(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="picker-time-col">
              <div className="picker-time-col-title">分</div>
              <div className="picker-time-scroll" ref={minutesRef}>
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-selected={m === draft[1]}
                    className={`picker-time-row ${m === draft[1] ? 'picker-time-selected' : ''}`}
                    onClick={() => selectMinute(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="picker-time-foot">
            <button type="button" className="picker-time-confirm" onClick={confirm}>
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
