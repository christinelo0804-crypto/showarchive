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

/** ISO 时间字符串 → YYYY-MM-DD HH:mm（本地时区，用于「最近一次导出」这类时间戳）。 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatMoney(value?: number): string {
  if (value == null) return '—'
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

/** 带正负号的人民币金额（差价用）：+¥120 / −¥80。 */
export function formatSignedMoney(value?: number): string {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatMoney(Math.abs(value))}`
}

/** 差价措辞：正数=溢价、负数=折扣、0=原价。 */
export function diffLabel(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (value > 0) return '溢价'
  if (value < 0) return '折扣'
  return '原价'
}

/** 实付率 = 实付 ÷ 票面 × 100；票面缺失或为 0 时无法计算，返回 null。 */
export function paidRatio(paid?: number, face?: number): number | null {
  if (paid == null || face == null || face <= 0) return null
  return (paid / face) * 100
}

/** 实付率的展示文本，保留 1 位小数；无法计算时显示「—」。 */
export function formatRatio(ratio: number | null): string {
  if (ratio == null || Number.isNaN(ratio)) return '—'
  return `${ratio.toFixed(1)}%`
}

/** 支持的外币（固定四种，后续需要再扩）。 */
export const CURRENCIES = [
  { code: 'HKD', name: '港币', symbol: 'HK$', decimals: 2 },
  { code: 'MOP', name: '澳门元', symbol: 'MOP$', decimals: 2 },
  { code: 'JPY', name: '日元', symbol: '¥', decimals: 0 },
  { code: 'KRW', name: '韩元', symbol: '₩', decimals: 0 }
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

function currencyMeta(code?: string) {
  return CURRENCIES.find((c) => c.code === code) ?? null
}

/** 外币金额：HK$420 / 16,000 JPY（日元、韩元不带小数，并用代码避免与人民币符号混淆）。 */
export function formatForeign(amount?: number, code?: string): string {
  const meta = currencyMeta(code)
  if (amount == null || !meta) return ''
  const num = amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.decimals
  })
  // 日元 / 韩元的符号与人民币同为 ¥，改用代码避免歧义（16,000 JPY / 494,000 KRW）
  return meta.decimals === 0 ? `${num} ${meta.code}` : `${meta.symbol}${num}`
}

/** 人民币金额 + 外币括注：¥380（HK$420）；没有外币时只返回人民币。 */
export function formatMoneyWithForeign(value?: number, amount?: number, code?: string): string {
  const base = formatMoney(value)
  const fx = formatForeign(amount, code)
  return fx ? `${base}（${fx}）` : base
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
