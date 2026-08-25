import { useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  back
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
  back?: boolean | (() => void)
}) {
  return (
    <header className="page-header">
      <div className="page-header-top-row">
        {back && (
          <button
            type="button"
            className="back-btn"
            onClick={typeof back === 'function' ? back : () => window.history.back()}
            aria-label="返回"
          >
            ‹
          </button>
        )}
      </div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="page-header-row">
        <h1 className="page-title">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </header>
  )
}

export function SectionTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div>
      {kicker && <p className="section-kicker">{kicker}</p>}
      <h2 className="section-title">{children}</h2>
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  children
}: {
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {children}
    </div>
  )
}

export function StarRating({
  value,
  onChange
}: {
  value?: number
  onChange?: (value: number) => void
}) {
  function handleClick(n: number, e: MouseEvent<HTMLButtonElement>) {
    if (!onChange) return
    const rect = e.currentTarget.getBoundingClientRect()
    const isLeftHalf = e.clientX - rect.left < rect.width / 2
    const next = isLeftHalf ? n - 0.5 : n
    onChange(value === next ? 0 : next)
  }

  return (
    <div className="star-row" role="radiogroup" aria-label="评分">
      {[1, 2, 3, 4, 5].map((n) => {
        const full = value != null && value >= n
        const half = value != null && value >= n - 0.5 && value < n
        return (
          <button
            key={n}
            type="button"
            className={`star ${full ? 'star-on' : ''} ${half ? 'star-half' : ''}`}
            onClick={(e) => handleClick(n, e)}
            aria-label={`${n - 0.5} 或 ${n} 星`}
            aria-checked={value != null && value >= n - 0.5}
            role="radio"
          >
            ★
          </button>
        )
      })}
      {value != null && value > 0 && (
        <>
          <span className="star-value">{value.toFixed(1)}</span>
          {onChange && (
            <button type="button" className="star-clear" onClick={() => onChange(0)}>
              清除
            </button>
          )}
        </>
      )}
    </div>
  )
}

const ICON_PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  stats: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z'
} as const

export function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

/** 行内「⋯」菜单：编辑 / 迁移 / 删除，删除红色分隔，点击外部自动收起。 */
export function MoreMenu({
  onEdit,
  onMigrate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: {
  onEdit: () => void
  onMigrate: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="more-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        ref={btnRef}
        className="more-btn"
        onClick={() => {
          if (!open) {
            const btn = btnRef.current
            if (btn) {
              const rect = btn.getBoundingClientRect()
              const itemCount =
                (onMoveUp ? 1 : 0) + (onMoveDown ? 1 : 0) + 3
              const menuHeight = itemCount * 40 + 12
              // 按钮位于屏幕底部附近时也向上弹出，避免菜单被底部导航遮挡
              setOpenUp(
                window.innerHeight - rect.bottom < Math.max(menuHeight + 8, 220)
              )
            }
          }
          setOpen((o) => !o)
        }}
        aria-label="更多操作"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className={`menu${openUp ? ' menu-up' : ''}`}>
          {onMoveUp && (
            <button
              type="button"
              className="menu-item"
              disabled={!canMoveUp}
              onClick={() => {
                setOpen(false)
                onMoveUp()
              }}
            >
              上移
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              className="menu-item"
              disabled={!canMoveDown}
              onClick={() => {
                setOpen(false)
                onMoveDown()
              }}
            >
              下移
            </button>
          )}
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
          >
            编辑
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false)
              onMigrate()
            }}
          >
            迁移
          </button>
          <button
            type="button"
            className="menu-item danger"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}
