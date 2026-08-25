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
