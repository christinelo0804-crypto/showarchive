/** 16px 线性图标：日历 / 时钟 / 下拉箭头，统一尺寸与颜色。 */

export function IconCalendar({ className }: { className?: string }) {
  return (
    <svg
      className={`picker-trigger-icon ${className ?? ''}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6h12M5 1.5V4M11 1.5V4" />
    </svg>
  )
}

export function IconClock({ className }: { className?: string }) {
  return (
    <svg
      className={`picker-trigger-icon ${className ?? ''}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  )
}

export function IconChevron({ className }: { className?: string }) {
  return (
    <svg
      className={`picker-trigger-icon ${className ?? ''}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}
