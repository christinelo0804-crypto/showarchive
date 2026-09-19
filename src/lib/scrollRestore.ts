// 页面自行恢复滚动位置时，通知路由的置顶逻辑跳过本次重置。
let pending = false

export function markScrollRestore(): void {
  pending = true
}

export function consumeScrollRestore(): boolean {
  const value = pending
  pending = false
  return value
}
