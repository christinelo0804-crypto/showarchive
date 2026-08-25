import { useEffect, useMemo, useRef, useState } from 'react'
import { QUOTES } from '../lib/quotes'
import type { Quote } from '../lib/quotes'
import curtainUrl from '../assets/splash-curtain.jpg'

function sizeClass(length: number): 'short' | 'medium' | 'long' {
  if (length <= 16) return 'short'
  if (length <= 42) return 'medium'
  return 'long'
}

export function Splash({ onDone }: { onDone: () => void }) {
  const quote = useMemo<Quote>(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    []
  )
  const showTrans = quote.lang !== '中文' && quote.lang !== '英语' && Boolean(quote.translation)
  const size = sizeClass(quote.original.length)
  const [phase, setPhase] = useState<'closed' | 'opening' | 'leaving'>('closed')
  const doneRef = useRef(false)
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // 启动页展示期间锁定页面滚动，避免出现滚动条
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const delay = reduced ? 2400 : 3000
    const timer = window.setTimeout(() => setPhase(reduced ? 'leaving' : 'opening'), delay)
    return () => window.clearTimeout(timer)
  }, [reduced])

  useEffect(() => {
    if (phase !== 'opening' && phase !== 'leaving') return
    const delay = reduced ? 350 : 1400
    const timer = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [phase, reduced, onDone])

  function finish() {
    if (!doneRef.current) {
      doneRef.current = true
      onDone()
    }
  }

  return (
    <div className={`splash ${phase} ${reduced ? 'splash-reduced' : ''}`}>
      <div className="splash-curtain-left" style={{ backgroundImage: `url(${curtainUrl})` }}>
      </div>
      <div className="splash-curtain-right" style={{ backgroundImage: `url(${curtainUrl})` }}>
      </div>
      <div className="splash-bloom" />
      <div className="splash-quote-wrap">
        <div className={`splash-quote size-${size}`}>
          <blockquote>
            <p className="quote-original">{quote.original}</p>
            {showTrans && <p className="quote-trans">{quote.translation}</p>}
          </blockquote>
          <figcaption className="quote-source">——{quote.play}</figcaption>
        </div>
      </div>
      <button type="button" className="splash-skip" onClick={finish}>
        跳过
      </button>
    </div>
  )
}
