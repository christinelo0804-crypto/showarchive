/** YYYY-MM-DD → MM.DD */
export function formatDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${m}.${d}`
}

/** YYYY-MM-DD → YYYY.MM.DD（带年份） */
export function formatDateWithYear(date: string): string {
  return date.split('-').join('.')
}

/** YYYY-MM-DD → YYYY年M月D日 */
export function formatFullDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function formatMoney(value?: number): string {
  if (value == null) return '—'
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

/** 今天的本地日期（YYYY-MM-DD）。注意不能用 toISOString：那是 UTC，东八区凌晨会差一天。 */
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 目标日期相对今天的天数差：正数=未来，0=今天，负数=已过。 */
export function daysFromToday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const now = new Date()
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}
