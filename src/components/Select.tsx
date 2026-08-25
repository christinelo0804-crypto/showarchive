import { Fragment, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { IconChevron } from './icons'

export interface SelectOption {
  value: string
  label: string
  group?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled,
  ariaLabel,
  id,
  className
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  id?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const selected = options.find((o) => o.value === value)
  const label = selected ? selected.label : placeholder

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const index = options.findIndex((o) => o.value === value)
    setHighlight(index)
  }, [open, options, value])

  useEffect(() => {
    if (!open || highlight < 0) return
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, highlight])

  function handleKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (highlight >= 0 && options[highlight]) {
        onChange(options[highlight].value)
        setOpen(false)
      }
    }
  }

  return (
    <div className={`select-wrap ${className ?? ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKey}
      >
        <span className={`select-label ${selected ? '' : 'select-placeholder'}`}>{label}</span>
        <IconChevron className="select-chevron" />
      </button>
      {open && !disabled && (
        <div className="select-pop" role="listbox" ref={listRef}>
          {options.length === 0 ? (
            <div className="select-empty">暂无选项</div>
          ) : (
            options.map((opt, i) => {
              const showGroup = opt.group != null && opt.group !== options[i - 1]?.group
              return (
                <Fragment key={`${opt.group ?? ''}-${opt.value}`}>
                  {showGroup && <div className="select-group">{opt.group}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    data-index={i}
                    className={`select-option ${opt.value === value ? 'select-option-active' : ''} ${
                      highlight === i ? 'select-option-hover' : ''
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                  >
                    {opt.label}
                  </button>
                </Fragment>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
