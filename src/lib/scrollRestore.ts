// 记录路由路径变化（在渲染阶段调用）：页面据此判断「本页是从哪一页过来的」。
let currentPath = ''
let priorPath = ''

export function recordPathname(path: string): void {
  if (path === currentPath) return
  priorPath = currentPath
  currentPath = path
}

/** 上一页的路径；在当前页渲染阶段即可取到。 */
export function previousRoutePathname(): string {
  return priorPath
}

const STORE_PREFIX = 'showarchive:browse:'

/** 把浏览状态写入 sessionStorage（可跨页面重载保留，供返回时恢复筛选与视图）。 */
export function persistBrowseState(key: string, state: unknown): void {
  try {
    sessionStorage.setItem(STORE_PREFIX + key, JSON.stringify({ state, ts: Date.now() }))
  } catch {
    // 存储不可用时忽略（不影响正常使用）
  }
}

/** 读取 sessionStorage 里的浏览状态（含保存时间戳）。 */
export function readBrowseState<T>(key: string): { state: T; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(STORE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as { state: T; ts: number }
  } catch {
    return null
  }
}
