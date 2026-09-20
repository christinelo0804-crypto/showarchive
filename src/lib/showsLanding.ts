const STORE_KEY = 'showarchive:shows-landing'
const EVENT = 'showarchive:shows-landing'

export interface ShowsLanding {
  statuses: string[]
  ts: number
}

/** 请求「我的演出」以指定的状态筛选打开（提醒弹窗跳转用）。 */
export function requestShowsLanding(statuses: string[]): void {
  const landing: ShowsLanding = { statuses, ts: Date.now() }
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(landing))
  } catch {
    // 存储不可用时仅依赖事件通知
  }
  window.dispatchEvent(new CustomEvent<ShowsLanding>(EVENT, { detail: landing }))
}

/** 取出待应用的落地筛选（10 秒内有效，取出后清除）。 */
export function consumeShowsLanding(): ShowsLanding | null {
  let landing: ShowsLanding | null = null
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (raw) landing = JSON.parse(raw) as ShowsLanding
    sessionStorage.removeItem(STORE_KEY)
  } catch {
    landing = null
  }
  if (!landing) return null
  return Date.now() - landing.ts < 10_000 ? landing : null
}

/** 订阅落地筛选：页面已挂载时也能收到通知。返回取消订阅函数。 */
export function onShowsLanding(handler: (landing: ShowsLanding) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ShowsLanding>).detail
    if (detail) handler(detail)
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
