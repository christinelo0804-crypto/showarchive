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

/**
 * 把滚动容器恢复到指定位置，并在一段守护期内守住它：
 * - 立即设置一次（在绘制前调用，避免先看到顶部再跳回）
 * - 内容高度未就位导致被钳制时逐帧重试
 * - iOS 的滚动恢复可能在稍后才把容器重置为 0，守护期内发现被改回就再放一次
 * - 用户一旦主动滚动（触摸/滚轮/按下）立即停止干预
 */
export function restoreScrollPosition(target: number): () => void {
  if (target <= 0) return () => {}
  markScrollRestore()

  const getMain = () => document.querySelector<HTMLElement>('.app-main')
  let frames = 0
  let stopped = false
  let userInteracted = false

  const apply = () => {
    const main = getMain()
    if (main) main.scrollTop = target
  }
  apply()

  const tick = () => {
    if (stopped || userInteracted) return
    const main = getMain()
    if (!main) return
    if (main.scrollTop !== target) {
      main.scrollTop = target
      if (frames < 90) {
        frames++
        requestAnimationFrame(tick)
      }
    }
  }
  requestAnimationFrame(tick)

  const onScroll = () => {
    if (stopped || userInteracted) return
    const main = getMain()
    if (main && main.scrollTop !== target) main.scrollTop = target
  }
  const onInteract = () => {
    userInteracted = true
  }

  const main = getMain()
  main?.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('touchstart', onInteract, { once: true, passive: true })
  window.addEventListener('wheel', onInteract, { once: true, passive: true })
  window.addEventListener('pointerdown', onInteract, { once: true })

  const timer = window.setTimeout(() => {
    stopped = true
    cleanup()
  }, 1600)

  function cleanup() {
    main?.removeEventListener('scroll', onScroll)
    window.removeEventListener('touchstart', onInteract)
    window.removeEventListener('wheel', onInteract)
    window.removeEventListener('pointerdown', onInteract)
    window.clearTimeout(timer)
  }

  return cleanup
}
